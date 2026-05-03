(function ($)
{
	if (navigator.cookieEnabled)
		NavRemoveUrlParams("session");
	$('.nav-pills').stickyTabs();
	//$(function ()
	//{
	//	$("#navEle").resize(navResized);
	//	navResized();
	//});
	//function navResized()
	//{
	//	$('body').css("padding-top", ($("#navEle").height()) + "px");
	//}
})(jQuery);
/**
 * Changes the current URL by removing the specified query string parameter(s) from it.
 * @returns {String} Returns null if successful, otherwise returns the new URL if changing the history state failed.
 */
function NavRemoveUrlParams()
{
	var url = RemoveUrlParams.apply(this, arguments);
	try { history.replaceState(history.state, "", url); return null; } catch (ex) { return url; }
}
function RemoveUrlParams()
{
	var s = location.search;
	for (var i = 0; i < arguments.length; i++)
	{
		var param = arguments[i];
		var rx = new RegExp('(&|\\?)' + param + '=[^&?#%]+', 'gi');
		s = s.replace(rx, "");
		while (s.indexOf("&") === 0)
		{
			if (s.length > 1)
				s = s.substr(1);
			else
				s = "";
		}
		if (s.length > 0 && s.indexOf("?") === -1)
			s = "?" + s;
	}
	return location.origin + location.pathname + s + location.hash;
}


$(function ()
{
	var imgs = document.getElementsByTagName("img");
	for (var i = 0; i < imgs.length; i++)
	{
		var src = imgs[i].getAttribute("mysrc");
		if (src)
			imgs[i].src = src + (navigator.cookieEnabled ? "" : "?session=" + local_bi_session);
	}
	try
	{
		var profileData = JSON.parse(localStorage.ui3_streamingProfileArray);
		for (var i = 0; i < profileData.length; i++)
		{
			var row = $('<tr></tr>');
			var cell_name = $('<td></td>').text(profileData[i].name);
			var cell_nameEnc = $('<td></td>').append($('<code></code>').text(encodeURIComponent(profileData[i].name)));
			row.append(cell_name);
			row.append(cell_nameEnc);
			$("#streamingProfileTbody").append(row);
		}
		$("#streamingProfileListParagraph").show();
	}
	catch (ex)
	{
		console.log("Unable to load streaming profiles. Local storage is probably not enabled.");
		console.error(ex);
	}

	try
	{
		// Set the current time minus one minute in the Timeline example link on the URL Parameters page
		$("#timelineLink").attr("href", $("#timelineLink").attr("href") + (Date.now() - 60000));
		$("#timelineLink").text($("#timelineLink").text() + (Date.now() - 60000));
	}
	catch (ex)
	{
		console.log("Unable to set timelineLink.");
		console.error(ex);
	}

	function GetFirstHeading(ele)
	{
		for (var i = 1; i <= 9; i++)
		{
			var h = ele.find("h" + i).first();
			if (h.length)
				return h;
		}
		return null;
	}

	try
	{
		// Copy all navbar links to a list on the Home page.
		var tabPanels = $('div.tab-pane');
		var homeLinks = [];
		var allTabPanes = [];
		for (var i = 0; i < tabPanels.length; i++)
		{
			var tabPanel = tabPanels.eq(i);
			allTabPanes.push(tabPanel);
			var firstHeading = GetFirstHeading(tabPanel);
			if (firstHeading)
			{
				var id = tabPanel.attr('id');
				if (id && id !== '' && id !== 'home' && id !== 'template')
				{
					var dst = $('<a class="list-group-item"></a>');
					dst.attr('href', "#" + id);
					var text = firstHeading.text().trim();
					dst.text(text);

					homeLinks.push({ key: text, a: dst });
				}
			}
		}

		homeLinks.sort(function (a, b)
		{
			return a.key.localeCompare(b.key);
		});

		var homeIndex = $("#homeIndex");
		for (var i = 0; i < homeLinks.length; i++)
			homeIndex.append(homeLinks[i].a);

		if (!$("#home").is(":hidden"))
			$('div.tab-pane').addClass("active");
	}
	catch (ex)
	{
		console.log("Unable to create list of section links in Home page.");
		console.error(ex);
	}
});
$("#nav-home").on("shown.bs.tab", function ()
{
	$('div.tab-pane').addClass("active");
});
///////////////////////////////////////////////////////////////
// Streaming Quality Maps /////////////////////////////////////
///////////////////////////////////////////////////////////////
var quality_qp_map = new (function ()
{
	var self = this;

	var bi5_h264_min_qp = 1;
	var bi5_h264_max_qp = 51;
	var bi6_h264_min_qp = 16;
	var bi6_h264_max_qp = 48;
	var bi6_h265_min_qp = 19;
	var bi6_h265_max_qp = 51;

	var bi5_h264_qp_range = bi5_h264_max_qp - bi5_h264_min_qp;
	var bi6_h264_qp_range = bi6_h264_max_qp - bi6_h264_min_qp;
	var bi6_h265_qp_range = bi6_h265_max_qp - bi6_h265_min_qp;

	function bi_qualities_from_h264_qp(qp, qp_min, qp_range)
	{
		var k = (qp_range + qp_min) - qp;
		if (k < 0 || k > qp_range) return [];
		var q_low = Math.ceil((100 * k) / qp_range);
		var q_high = Math.ceil((100 * (k + 1)) / qp_range) - 1;
		var qualities = [];
		for (var q = q_low; q <= q_high && q <= 100; q++)
		{
			qualities.push(q);
		}
		return qualities;
	}

	// --- public API ---
	this.bi5_q_to_h264_qp = function (q)
	{
		return bi5_h264_max_qp - Math.floor((q * bi5_h264_qp_range) / 100);
	};
	this.bi6_q_to_h264_qp = function (q)
	{
		return bi6_h264_max_qp - Math.floor((q * bi6_h264_qp_range) / 100);
	};
	this.bi6_q_to_h265_qp = function (q)
	{
		return bi6_h265_max_qp - Math.floor((q * bi6_h265_qp_range) / 100);
	};

	this.bi5_to_bi6_qualities = function (q)
	{
		var qp = self.bi5_q_to_h264_qp(q);
		return bi_qualities_from_h264_qp(qp, bi6_h264_min_qp, bi6_h264_qp_range);
	};
	this.bi5_to_bi6_quality = function (q)
	{
		var qualities = self.bi5_to_bi6_qualities(q);
		if (qualities.length)
			return qualities[~~((qualities.length - 1) / 2)]; // ~~ means cast to int
		// This convenience function should map out of range values to 0 or 100 to ensure we do not return an invalid value.
		if (q < 50)
			return 0;
		else
			return 100;
	};
	this.h264_qp_to_bi6_qualities = function (qp)
	{
		return bi_qualities_from_h264_qp(qp, bi6_h264_min_qp, bi6_h264_qp_range);
	};
	this.bi6_to_bi5_qualities = function (q)
	{
		var qp = self.bi6_q_to_h264_qp(q);
		return bi_qualities_from_h264_qp(qp, bi5_h264_min_qp, bi5_h264_qp_range);
	};
	this.bi6_to_bi5_quality = function (q)
	{
		var qualities = self.bi6_to_bi5_qualities(q);
		if (qualities.length)
			return qualities[~~((qualities.length - 1) / 2)]; // ~~ means cast to int
		// This convenience function should map out of range values to 0 or 100 to ensure we do not return an invalid value.
		if (q < 50)
			return 0;
		else
			return 100;
	};
	this.h264_qp_to_bi5_qualities = function (qp)
	{
		return bi_qualities_from_h264_qp(qp, bi5_h264_min_qp, bi5_h264_qp_range);
	};
})();

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

function GetHtmlQualityTable()
{
	function normalizeQuality(val)
	{
		val = val.toString();
		return val ? (val + "%") : "";
	}
	function normalizeQP(val)
	{
		return val === null ? "" : ("QP " + val);
	}

	var sb = [];
	sb.push("<table class=\"encoder-quality\">\n");
	sb.push("<thead>\n");
	sb.push("<tr><th>Quality %<br>(Blue Iris 5)</th><th>Quality %<br>(Blue Iris 6)</th><th>H.264 QP</th><th>H.265 QP</th></tr>\n");
	sb.push("</thead>\n");
	sb.push("<tbody>\n");

	function AddBI5ExclusiveRow(bi5_q)
	{
		var bi5_q_str = bi5_q.toString();
		var h264_qp = quality_qp_map.bi5_q_to_h264_qp(bi5_q);
		while (bi5_q + 1 <= 100
			&& h264_qp === quality_qp_map.bi5_q_to_h264_qp(bi5_q + 1))
		{
			bi5_q++;
		}
		if (bi5_q_str !== bi5_q.toString())
			bi5_q_str += "-" + bi5_q.toString();
		sb.push('<tr><td>' + normalizeQuality(bi5_q_str) + '</td><td class="not-applicable">N/A</td><td>' + normalizeQP(h264_qp) + '</td><td class="not-applicable">N/A</td></tr>\n');
		return bi5_q;
	}
	var lastBi5Quality = -1;
	for (var q = 0; q <= 100; q++)
	{
		var bi5_qualities = quality_qp_map.bi6_to_bi5_qualities(q);
		var bi5_q_str = "";
		if (bi5_qualities.length > 1)
			bi5_q_str = bi5_qualities[0] + "-" + bi5_qualities[bi5_qualities.length - 1];
		else if (bi5_qualities.length)
			bi5_q_str = bi5_qualities[0].toString();

		if (bi5_qualities.length)
			lastBi5Quality = bi5_qualities[bi5_qualities.length - 1];

		if (q === 0 && bi5_qualities && bi5_qualities[0] > 0)
		{
			for (var i = 0; i < bi5_qualities[0]; i++)
				i = AddBI5ExclusiveRow(i);
		}

		var bi6_q_str = q.toString();
		var h264_qp = quality_qp_map.bi6_q_to_h264_qp(q);
		var h265_qp = quality_qp_map.bi6_q_to_h265_qp(q);
		while (q + 1 <= 100
			&& h264_qp === quality_qp_map.bi6_q_to_h264_qp(q + 1)
			&& h265_qp === quality_qp_map.bi6_q_to_h265_qp(q + 1))
		{
			q++;
		}
		if (bi6_q_str !== q.toString())
			bi6_q_str += "-" + q.toString();
		sb.push("<tr><td>" + normalizeQuality(bi5_q_str) + "</td><td>" + normalizeQuality(bi6_q_str) + "</td><td>" + normalizeQP(h264_qp) + "</td><td>" + normalizeQP(h265_qp) + "</td></tr>\n");
	}
	for (var i = lastBi5Quality + 1; i <= 100; i++)
		i = AddBI5ExclusiveRow(i);
	sb.push("</tbody>\n");
	sb.push("</table>\n");
	return sb.join("");
}
try
{
	var html = GetHtmlQualityTable();
	$('#encoder-quality-table-container').html(html);
}
catch (ex)
{
	console.error(ex);
	alert("An error occurred while generating the Video Encoder quality tables: " + ex.message);
}