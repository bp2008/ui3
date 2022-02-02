
/**
 * FasterObjectMap can be used in lieu of regular empty objects as a slightly faster key/value map which does not require the use of hasOwnProperty when iterating over keys.
 * In fact it doesn't have a hasOwnProperty function. 
 */
function FasterObjectMap() { }
FasterObjectMap.prototype = Object.create(null);

function WrapperMap()
{
	var map;
	if (typeof Map === "function")
	{
		map = new Map();
		this.get = function (key)
		{
			return map.get(key);
		};
		this.set = function (key, value)
		{
			map.set(key, value);
		};
	}
	else
	{
		map = new FasterObjectMap();
		this.get = function (key)
		{
			return map[key];
		};
		this.set = function (key, value)
		{
			map[key] = value;
		};
	}
	this.internalMap = map;
}

/**
 * Contains source data to draw the timeline from.
 * Alerts contains alerts.
 * colorMap contains video ranges.
 * colors is an array of all colors used as keys in colorMap, sorted in the order they should be drawn.
 * cameraNumbers is an object that maps camera short name to a unique number.
 */
var srcdata = { alerts: [], colorMap: new WrapperMap(), colors: [], cameraNumbers: {} };

onmessage = function (e)
{
	var m = e.data;
	if (m.type === "timelineData")
		IngestTimelineData(m.requestInfo, m.data, m.cameraColorMap);
	else if (m.type === "timelineReduce")
		ReduceTimeline(m.args);
}
function IngestTimelineData(requestInfo, data, cameraColorMap)
{
	try
	{
		// Ingest ranges array
		var ranges = data.ranges;
		for (var i = 0; i < ranges.length; i++)
			AddRange(ranges[i], requestInfo.start, requestInfo.end, requestInfo.days, cameraColorMap);
	}
	catch (ex)
	{
		postMessage({ type: "error", ex: ex });
	}

	try
	{
		// Ingest alerts array
		var alerts = data.alerts;
		for (var i = 0; i < alerts.length; i++)
			AddAlert(alerts[i], requestInfo.start, requestInfo.end, requestInfo.days);
		if (alerts.length)
			FinalizeAfterAddingAlerts();
	}
	catch (ex)
	{
		postMessage({ type: "error", ex: ex });
	}

	postMessage({ type: "timelineDataProcessed" });
}

/**
 * 
 * @param {any} range A range object.
 * @param {any} start Point in time marking the start of the requested time range.
 * @param {any} end Point in time marking the end of the requested time range.
 * @param {Array} cutpoints Array of timestamps marking the start of new days within the requested time range.  Ranges that span any of these cutpoints must be split into multiple ranges.
 * @param {Object} cameraColorMap Map of camera short name to color int.
 */
function AddRange(range, start, end, cutpoints, cameraColorMap)
{
	// Bounds check.  Any range that starts before the requested time range should be truncated.  The truncated portion will be added later if we load the previous time range.
	if (range.time < start)
	{
		var diff = start - range.time;
		range.time = start;
		range.len -= diff;
		if (range.len <= 0)
			return;
	}
	// Bounds check.  Any range that ends after the requested time range should be truncated.  The truncated portion will be added later if we load the next time range.
	if (range.time + range.len > end)
	{
		var diff = (range.time + range.len) - end;
		range.len -= diff;
		if (range.len <= 0)
			return;
	}
	// If the range spans a cutpoint timestamp, we should cut it into multiple ranges and add each of them separately.
	for (var i = 1; i < cutpoints.length; i++) // Begin loop at index 1 because the 0th cutpoint is equal to [start].
	{
		var cut = cutpoints[i];
		if (range.time < cut && range.time + range.len > cut)
		{
			// This range spans the cutpoint. Make a copy that goes up to the cutpoint, and add the copy separately to our source data.
			var copy = JSON.parse(JSON.stringify(range));
			copy.len = cut - copy.time;
			AddRangeInternal(copy, cameraColorMap);

			// Truncate original range.
			range.time = cut;
			range.len -= copy.len;
		}
	}
	AddRangeInternal(range, cameraColorMap);
}

function AddRangeInternal(range, cameraColorMap)
{
	// This timeline is designed to handle 100,000+ records efficiently.
	// Ranges are organized under several levels of structure to provide a balance between loading speed and reading speed.
	// WrapperMap srcdata.colorMap						(keyed on color int)
	//	-> FasterObjectMap map_of_cameras_to_days		(keyed on camera short name)
	//		-> Array rangeChunkCollection				(contains day-sized chunks of time ranges, sorted by timestamp of the day)
	//			-> RangeChunk chunk						(RangeChunk has fields `ts` (timestamp) and `ranges` (array of ranges))
	//				-> range							(range has fields `time` and `len`)
	var color = GetCameraColor(cameraColorMap, range.cam);
	var map_of_cameras_to_days = srcdata.colorMap.get(color);
	if (!map_of_cameras_to_days)
	{
		srcdata.colors.push(color);
		srcdata.colors.sort(CompareBlueIrisColors);
		srcdata.colorMap.set(color, map_of_cameras_to_days = new FasterObjectMap());
	}

	var rangeChunkCollection = map_of_cameras_to_days[range.cam];
	if (!rangeChunkCollection)
		map_of_cameras_to_days[range.cam] = rangeChunkCollection = [];

	var preciseDate = new Date(range.time);
	var day = timeCache.get(preciseDate.getFullYear(), preciseDate.getMonth(), preciseDate.getDate());
	var chunkIdx = binarySearch(rangeChunkCollection, { ts: day }, CompareRangeChunks);
	if (chunkIdx < 0)
	{
		chunkIdx = -chunkIdx - 1;
		rangeChunkCollection.splice(chunkIdx, 0, new RangeChunk(day));
	}
	var chunk = rangeChunkCollection[chunkIdx];

	range = { time: range.time, len: range.len }; // Recreate range object with only the fields we need to persist.
	var ranges = chunk.ranges;
	if (!ranges.length)
		ranges.push(range); // First range in this array.
	else
	{
		var last = ranges[ranges.length - 1];
		if (last.time < range.time) // Normal case. New range goes on end of array. Sort order is maintained.
			ranges.push(range);
		else if (last.time > range.time) // New range is out of order! We try not to let this happen.
		{
			var idx = binarySearch(ranges, range, RangeCompare);
			if (idx < 0)
			{
				idx = -idx - 1; // Match was approximate. This calculation gets us the index we should insert at.
				console.log("Slow operation warning: Timeline range was added out of order at index " + idx + " out of " + ranges.length, "last: " + last, "range: " + JSON.stringify(range), chunk);
				ranges.splice(idx, 0, range);
			}
			else
			{
				// This range already exists. Replace it.
				ranges[idx] = range;
			}
		}
		else // New range has same exact time as last added range. Update last added range len field.
			ranges[ranges.length - 1] = range.len;
	}
}
function AddAlert(alert)
{
	var camNum = srcdata.cameraNumbers[alert.cam];
	if (!camNum)
		camNum = srcdata.cameraNumbers[alert.cam] = Object.keys(srcdata.cameraNumbers).length + 1;
	alert = { num: camNum, time: alert.time };
	srcdata.alerts.push(alert);
}
function FinalizeAfterAddingAlerts()
{
	srcdata.alerts.sort(AlertCompare);
}

function ReduceTimeline(args)
{
	var left = args.left;
	var right = args.right;
	var dpr = args.dpr;
	var zoomFactor = args.zoomFactor / dpr;
	var visibleMilliseconds = args.visibleMilliseconds;
	var filters = args.filters;
	filters.allowedCameraNumbers = new FasterObjectMap();
	for (var camId in filters.allowedCameras)
		filters.allowedCameraNumbers[srcdata.cameraNumbers[camId]] = true;

	var alertImgNaturalWidth = args.alertImgNaturalWidth;
	var alertImgNaturalHeight = args.alertImgNaturalHeight;
	var timelineInternalHeight = args.timelineInternalHeight;

	var leftmostDate = new Date(left);
	var leftmostDateTs = new Date(leftmostDate.getFullYear(), leftmostDate.getMonth(), leftmostDate.getDate()).getTime();

	var result = { alerts: [], colorSets: [] };

	// Reduce alert icons down to an array of X-coordinates.
	var perfBeforeAlerts = performance.now();
	if (alertImgNaturalWidth && alertImgNaturalHeight)
	{
		var alertImgScale = (alertImgNaturalHeight / 12) / dpr;
		var alertImgW = alertImgNaturalWidth / alertImgScale;
		var alertImgH = alertImgNaturalHeight / alertImgScale;
		var alertImgXOffset = alertImgW / 2;
		var alertImgYOffset = 0 * dpr;

		var nextAllowedX = 0;
		var x;

		var alerts = srcdata.alerts;
		for (var i = findFirstAlertSinceTime(alerts, left); i < alerts.length; i++)
		{
			var alert = alerts[i];
			if (alert.time >= right)
				break;
			if (filters.allowedCameraNumbers[alert.num])
			{
				x = ((alert.time - left) / zoomFactor) - alertImgXOffset;
				// For speed and legibility, do not draw overlapping icons. 
				// Also, leave 1 icon width of padding to the right of any drawn 
				// icon, to achieve spacing similar to the local console.
				if (x >= nextAllowedX)
				{
					nextAllowedX = x + (alertImgW * 2);
					result.alerts.push({ x: x, y: alertImgYOffset, w: alertImgW, h: alertImgH });
				}
			}
		}
	}
	var perfAfterAlerts = performance.now();

	// Motion-triggered systems can have hundreds of thousands of time ranges when the timeline is zoomed out.
	// This is far too much to render efficiently.
	// We combine close-together ranges so we don't have to draw as many objects.

	var allReducedRanges = [];
	var perfBeforeRanges = performance.now();
	for (var ci = 0; ci < srcdata.colors.length; ci++)
	{
		var colorKey = srcdata.colors[ci];
		if (!filters.allowedColors[colorKey])
			continue;
		var map_of_cameras_to_days = srcdata.colorMap.get(colorKey);
		var reducedRanges = [];
		allReducedRanges.push({ ranges: reducedRanges, color: colorKey });

		// We're reducing the dataset by creating an array of true/false buckets.
		// Each bucket represents a time slot and the bucket is filled (set = true) if the time slot contains any video.
		var bucketSize = zoomFactor / 2; // One bucket represents this many milliseconds.
		var buckets = new Array((visibleMilliseconds / bucketSize) | 0);
		for (var cam in map_of_cameras_to_days)
		{
			if (!filters.allowedCameras[cam])
				continue;
			var rangeChunkCollection = map_of_cameras_to_days[cam];
			if (!rangeChunkCollection)
				continue;
			for (var chunkIdx = findFirstChunkInChunkCollection(rangeChunkCollection, leftmostDateTs); chunkIdx < rangeChunkCollection.length; chunkIdx++)
			{
				var chunk = rangeChunkCollection[chunkIdx];
				if (chunk.ts >= right)
					break;

				var ranges = chunk.ranges;
				// Set the value = true for every bucket that has some video data.
				for (var i = 0; i < ranges.length; i++)
				{
					var range = ranges[i];
					if (range.time <= right && range.time + range.len >= left)
					{
						var leftOffsetMs = range.time - left;
						var rightOffsetMs = leftOffsetMs + range.len - 1; // -1 millisecond so we don't accidentally mark a bucket that actually has no video
						var firstBucketIdx = Clamp((leftOffsetMs / bucketSize) | 0, 0, buckets.length - 1); // Bitwise or with zero is a cheap way to round down, as long as numbers fit in a 32 bit signed int.
						var lastBucketIdx = Clamp((rightOffsetMs / bucketSize) | 0, 0, buckets.length - 1);
						for (var n = firstBucketIdx; n <= lastBucketIdx; n++)
							buckets[n] = true;
					}
				}
			}
		}

		// Build an array containing the minimum number of ranges required to draw these buckets.
		var inBucket = false;
		var currentRange = { color: colorKey };
		for (var i = 0; i < buckets.length; i++)
		{
			if (buckets[i])
			{
				if (inBucket)
					continue;
				else
				{
					currentRange.time = left + (i * bucketSize);
					inBucket = true;
				}
			}
			else
			{
				if (!inBucket)
					continue;
				else
				{
					currentRange.len = (left + (i * bucketSize)) - currentRange.time;
					reducedRanges.push(currentRange);
					currentRange = { color: colorKey };
					inBucket = false;
				}
			}
		}
		if (inBucket)
		{
			currentRange.len = (left + (i * bucketSize)) - currentRange.time;
			reducedRanges.push(currentRange);
		}
	}

	var alertIconSpace = 12 * dpr;
	var timelineColorbarHeight = ((timelineInternalHeight - alertIconSpace) / allReducedRanges.length);
	var h = timelineColorbarHeight;
	for (var ri = 0; ri < allReducedRanges.length; ri++)
	{
		var ranges = allReducedRanges[ri].ranges;
		var colorSet = { color: "#" + BlueIrisColorToCssColor(allReducedRanges[ri].color), rects: [] };
		var y = alertIconSpace + (ri * timelineColorbarHeight);
		for (var i = 0; i < ranges.length; i++)
		{
			var range = ranges[i];
			colorSet.rects.push({ x: (range.time - left) / zoomFactor, y: y, w: Math.max(0.5, range.len / zoomFactor), h: h });
		}
		result.colorSets.push(colorSet);
	}
	var perfAfterRanges = performance.now();

	if (args.developerMode)
		console.log("Reduce alerts took " + (perfAfterAlerts - perfBeforeAlerts).toFixed(1) + " ms. Reduce ranges took " + (perfAfterRanges - perfBeforeRanges).toFixed(1) + " ms.");

	postMessage({ type: "timelineReduced", data: result });
}

function RangeChunk(ts)
{
	/** Key (timestamp of the day this chunk represents) */
	this.ts = ts;
	this.ranges = [];
}
function CompareRangeChunks(a, b)
{
	return a.ts - b.ts;
}
function findFirstChunkInChunkCollection(collection, ts)
{
	var idx = binarySearch(collection, { ts: ts }, CompareRangeChunks);
	if (idx < 0)
		idx = -idx - 1;
	return idx;
}
function AlertCompare(a, b)
{
	return a.time - b.time;
}
function findFirstAlertSinceTime(collection, time)
{
	var idx = binarySearch(collection, { time: time }, AlertCompare);
	if (idx < 0)
		idx = -idx - 1;
	return idx;
}
function GetCameraColor(cameraColorMap, cameraId)
{
	var color = cameraColorMap[cameraId];
	if (typeof color !== "undefined")
		return color;
	return 8151097; // Default camera color
}
/**
 * Performs binary search and returns the index of a matching element.
 * If there is no match, the returned index will be negative and you can negate it 
 * and subtract 1 ((-idx - 1)) to get the index where the item should be inserted.
 * @param {Array} ar Array
 * @param {any} el Value to find
 * @param {Function} compare_fn A function that compares two values of the appropriate type.  Should return a positive number if the first argument is greater, negative number if the first argument is lesser.
 */
function binarySearch(ar, el, compare_fn)
{
	var m = 0;
	var n = ar.length - 1;
	while (m <= n)
	{
		var k = (n + m) >> 1;
		var cmp = compare_fn(el, ar[k]);
		if (cmp > 0)
			m = k + 1;
		else if (cmp < 0)
			n = k - 1;
		else
			return k;
	}
	return -m - 1;
}

function BlueIrisColorToCssColor(biColor)
{
	var colorHex = biColor.toString(16).padLeft(8, '0').substr(2);
	return colorHex.substr(4, 2) + colorHex.substr(2, 2) + colorHex.substr(0, 2);
}
function BlueIrisColorToHsl(biColor)
{
	var o = HexColorToRgbObj(BlueIrisColorToCssColor(biColor));
	return rgbToHsl(o.r, o.g, o.b);
}
function HexColorToRgbObj(c)
{
	if (c.startsWith('#'))
		c = c.substr(1);
	return { r: parseInt(c.substr(0, 2), 16), g: parseInt(c.substr(2, 2), 16), b: parseInt(c.substr(4, 2), 16) };
}
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; var e = Math.max(r, g, b), a = Math.min(r, g, b), h = (e + a) / 2; if (e == a) var f = a = 0; else { var z = e - a; a = .5 < h ? z / (2 - e - a) : z / (e + a); switch (e) { case r: f = (g - b) / z + (g < b ? 6 : 0); break; case g: f = (b - r) / z + 2; break; case b: f = (r - g) / z + 4 }f /= 6 } return { h: f, s: a, l: h } };
function CompareBlueIrisColors(a, b)
{
	return CompareHSLColors(BlueIrisColorToHsl(a), BlueIrisColorToHsl(b));
}
function CompareHSLColors(a, b)
{
	var diff = a.h - b.h;
	if (diff === 0)
		diff = a.s - b.s;
	if (diff === 0)
		diff = a.l - b.l;
	return diff;
}
String.prototype.padLeft = function (len, c)
{
	var pads = len - this.length;
	if (pads > 0)
	{
		var sb = [];
		var pad = c || "&nbsp;";
		for (var i = 0; i < pads; i++)
			sb.push(pad);
		sb.push(this);
		return sb.join("");
	}
	return this;
};
function Clamp(i, min, max)
{
	if (i < min)
		return min;
	if (i > max)
		return max;
	if (isNaN(i))
		return min;
	return i;
}
/**
 * Caches the timestamp value for any given day.
 */
var timeCache = new (function ()
{
	var map = new WrapperMap();
	/**
	 * Returns the timestamp of the specified date.
	 * @param {Number} year The full year.
	 * @param {Number} month The month where 0 is January.
	 * @param {Number} day The day of the month (e.g. 1-31).
	 */
	this.get = function (year, month, day)
	{
		var key = year + ":" + month + ":" + day;
		var cached = map.get(key);
		if (cached)
			return cached;
		var time = new Date(year, month, day);
		map.set(key, time);
		return time;
	}
})();

postMessage({ type: "workerLoaded" });