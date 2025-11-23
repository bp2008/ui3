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
function MapBi6QualityToBi5Quality(bi6Quality)
{
	if (bi6Quality < 0 || bi6Quality > 100)
		return bi6Quality;
	for (var i = bi6Quality; i <= 100; i++)
	{
		var q = bi6_to_bi5_quality_map[i.toString()];
		if (typeof q !== "undefined")
			return q;
	}
}
function MapBi5QualityToBi6Quality(bi5Quality)
{
	if (bi5Quality < 0 || bi5Quality > 100)
		return bi5Quality;
	for (var i = bi5Quality; i <= 100; i++)
	{
		var q = bi5_to_bi6_quality_map[i.toString()];
		if (typeof q !== "undefined")
			return q;
	}
}
function MapBi6QualityToH264QP(bi6Quality)
{
	return bi6_to_h264_QP_map[bi6Quality];
}
function MapBi6QualityToH265QP(bi6Quality)
{
	return bi6_to_h265_QP_map[bi6Quality];
}
// These maps are computed by a google docs spreadsheet.
var bi6_to_bi5_quality_map = { '0': 6, '2': 7, '3': 8, '5': 9, '6': 10, '8': 11, '9': 12, '11': 13, '12': 14, '14': 15, '16': 16, '17': 17, '19': 18, '20': 19, '22': 20, '23': 21, '25': 22, '27': 23, '28': 24, '30': 25, '31': 26, '33': 27, '34': 28, '36': 29, '37': 30, '39': 31, '41': 32, '42': 33, '44': 34, '45': 35, '47': 36, '48': 37, '50': 38, '52': 39, '53': 40, '55': 41, '56': 42, '58': 43, '59': 44, '61': 45, '62': 46, '64': 47, '66': 48, '67': 49, '69': 50, '70': 51, '72': 52, '73': 53, '75': 54, '77': 55, '78': 56, '80': 57, '81': 58, '83': 59, '84': 60, '86': 61, '87': 62, '89': 63, '91': 64, '92': 65, '94': 66, '95': 67, '97': 68, '98': 69, '100': 70 };
var bi6_to_h264_QP_map = { '0': 48, '1': 48, '2': 47, '3': 47, '4': 47, '5': 46, '6': 46, '7': 46, '8': 45, '9': 45, '10': 45, '11': 44, '12': 44, '13': 44, '14': 44, '15': 43, '16': 43, '17': 43, '18': 42, '19': 42, '20': 42, '21': 41, '22': 41, '23': 41, '24': 40, '25': 40, '26': 40, '27': 39, '28': 39, '29': 39, '30': 38, '31': 38, '32': 38, '33': 37, '34': 37, '35': 37, '36': 36, '37': 36, '38': 36, '39': 36, '40': 35, '41': 35, '42': 35, '43': 34, '44': 34, '45': 34, '46': 33, '47': 33, '48': 33, '49': 32, '50': 32, '51': 32, '52': 31, '53': 31, '54': 31, '55': 30, '56': 30, '57': 30, '58': 29, '59': 29, '60': 29, '61': 28, '62': 28, '63': 28, '64': 28, '65': 27, '66': 27, '67': 27, '68': 26, '69': 26, '70': 26, '71': 25, '72': 25, '73': 25, '74': 24, '75': 24, '76': 24, '77': 23, '78': 23, '79': 23, '80': 22, '81': 22, '82': 22, '83': 21, '84': 21, '85': 21, '86': 20, '87': 20, '88': 20, '89': 20, '90': 19, '91': 19, '92': 19, '93': 18, '94': 18, '95': 18, '96': 17, '97': 17, '98': 17, '99': 16, '100': 16 };
var bi6_to_h265_QP_map = { '0': 51, '1': 51, '2': 50, '3': 50, '4': 50, '5': 49, '6': 49, '7': 49, '8': 48, '9': 48, '10': 48, '11': 47, '12': 47, '13': 47, '14': 47, '15': 46, '16': 46, '17': 46, '18': 45, '19': 45, '20': 45, '21': 44, '22': 44, '23': 44, '24': 43, '25': 43, '26': 43, '27': 42, '28': 42, '29': 42, '30': 41, '31': 41, '32': 41, '33': 40, '34': 40, '35': 40, '36': 39, '37': 39, '38': 39, '39': 39, '40': 38, '41': 38, '42': 38, '43': 37, '44': 37, '45': 37, '46': 36, '47': 36, '48': 36, '49': 35, '50': 35, '51': 35, '52': 34, '53': 34, '54': 34, '55': 33, '56': 33, '57': 33, '58': 32, '59': 32, '60': 32, '61': 31, '62': 31, '63': 31, '64': 31, '65': 30, '66': 30, '67': 30, '68': 29, '69': 29, '70': 29, '71': 28, '72': 28, '73': 28, '74': 27, '75': 27, '76': 27, '77': 26, '78': 26, '79': 26, '80': 25, '81': 25, '82': 25, '83': 24, '84': 24, '85': 24, '86': 23, '87': 23, '88': 23, '89': 23, '90': 22, '91': 22, '92': 22, '93': 21, '94': 21, '95': 21, '96': 20, '97': 20, '98': 20, '99': 19, '100': 19 };
var bi5_to_bi6_quality_map = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 2, '8': 3, '9': 5, '10': 6, '11': 8, '12': 9, '13': 11, '14': 12, '15': 14, '16': 16, '17': 17, '18': 19, '19': 20, '20': 22, '21': 23, '22': 25, '23': 27, '24': 28, '25': 30, '26': 31, '27': 33, '28': 34, '29': 36, '30': 37, '31': 39, '32': 41, '33': 42, '34': 44, '35': 45, '36': 47, '37': 48, '38': 50, '39': 52, '40': 53, '41': 55, '42': 56, '43': 58, '44': 59, '45': 61, '46': 62, '47': 64, '48': 66, '49': 67, '50': 69, '51': 70, '52': 72, '53': 73, '54': 75, '55': 77, '56': 78, '57': 80, '58': 81, '59': 83, '60': 84, '61': 86, '62': 87, '63': 89, '64': 91, '65': 92, '66': 94, '67': 95, '68': 97, '69': 98, '70': 100, '71': 100, '72': 100, '73': 100, '74': 100, '75': 100, '76': 100, '77': 100, '78': 100, '79': 100, '80': 100, '81': 100, '82': 100, '83': 100, '84': 100, '85': 100, '86': 100, '87': 100, '88': 100, '89': 100, '90': 100, '91': 100, '92': 100, '93': 100, '94': 100, '95': 100, '96': 100, '97': 100, '98': 100, '99': 100, '100': 100 };
function GetHtmlQualityTable()
{
	var sb = [];
	sb.push("<table class=\"encoder-quality\">\n");
	sb.push("<thead>\n");
	sb.push("<tr><th><br>Quality %<br>(Blue Iris 5)</th><th>Quality %<br>(Blue Iris 6)</th><th>H.264 QP</th><th>H.265 QP</th></tr>\n");
	sb.push("</thead>\n");
	sb.push("<tbody>\n");
	for (var i = 0; i <= 100; i++)
	{
		sb.push("<tr><td>" + MapBi6QualityToBi5Quality(i).toString() + "%</td><td>" + i.toString() + "%</td><td>QP " + MapBi6QualityToH264QP(i).toString() + "</td><td>QP " + MapBi6QualityToH265QP(i).toString() + "</td></tr>\n");
	}
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