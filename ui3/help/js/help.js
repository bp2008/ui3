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
var bi6_to_bi5_quality_map = { '0': 7, '4': 8, '4': 9, '7': 10, '7': 11, '10': 12, '10': 13, '13': 14, '13': 15, '16': 16, '16': 17, '19': 18, '19': 19, '22': 20, '22': 21, '25': 22, '25': 23, '29': 24, '29': 25, '32': 26, '32': 27, '35': 28, '35': 29, '38': 30, '38': 31, '41': 32, '41': 33, '44': 34, '44': 35, '47': 36, '47': 37, '50': 38, '50': 39, '54': 40, '54': 41, '57': 42, '57': 43, '60': 44, '60': 45, '63': 46, '63': 47, '66': 48, '66': 49, '69': 50, '69': 51, '72': 52, '72': 53, '75': 54, '75': 55, '79': 56, '79': 57, '82': 58, '82': 59, '85': 60, '85': 61, '88': 62, '88': 63, '91': 64, '91': 65, '94': 66, '94': 67, '97': 68, '97': 69, '100': 70 };
var bi6_to_h264_QP_map = { '0': 48, '1': 48, '2': 48, '3': 48, '4': 47, '5': 47, '6': 47, '7': 46, '8': 46, '9': 46, '10': 45, '11': 45, '12': 45, '13': 44, '14': 44, '15': 44, '16': 43, '17': 43, '18': 43, '19': 42, '20': 42, '21': 42, '22': 41, '23': 41, '24': 41, '25': 40, '26': 40, '27': 40, '28': 40, '29': 39, '30': 39, '31': 39, '32': 38, '33': 38, '34': 38, '35': 37, '36': 37, '37': 37, '38': 36, '39': 36, '40': 36, '41': 35, '42': 35, '43': 35, '44': 34, '45': 34, '46': 34, '47': 33, '48': 33, '49': 33, '50': 32, '51': 32, '52': 32, '53': 32, '54': 31, '55': 31, '56': 31, '57': 30, '58': 30, '59': 30, '60': 29, '61': 29, '62': 29, '63': 28, '64': 28, '65': 28, '66': 27, '67': 27, '68': 27, '69': 26, '70': 26, '71': 26, '72': 25, '73': 25, '74': 25, '75': 24, '76': 24, '77': 24, '78': 24, '79': 23, '80': 23, '81': 23, '82': 22, '83': 22, '84': 22, '85': 21, '86': 21, '87': 21, '88': 20, '89': 20, '90': 20, '91': 19, '92': 19, '93': 19, '94': 18, '95': 18, '96': 18, '97': 17, '98': 17, '99': 17, '100': 16 };
var bi6_to_h265_QP_map = { '0': 51, '1': 51, '2': 51, '3': 51, '4': 50, '5': 50, '6': 50, '7': 49, '8': 49, '9': 49, '10': 48, '11': 48, '12': 48, '13': 47, '14': 47, '15': 47, '16': 46, '17': 46, '18': 46, '19': 45, '20': 45, '21': 45, '22': 44, '23': 44, '24': 44, '25': 43, '26': 43, '27': 43, '28': 43, '29': 42, '30': 42, '31': 42, '32': 41, '33': 41, '34': 41, '35': 40, '36': 40, '37': 40, '38': 39, '39': 39, '40': 39, '41': 38, '42': 38, '43': 38, '44': 37, '45': 37, '46': 37, '47': 36, '48': 36, '49': 36, '50': 35, '51': 35, '52': 35, '53': 35, '54': 34, '55': 34, '56': 34, '57': 33, '58': 33, '59': 33, '60': 32, '61': 32, '62': 32, '63': 31, '64': 31, '65': 31, '66': 30, '67': 30, '68': 30, '69': 29, '70': 29, '71': 29, '72': 28, '73': 28, '74': 28, '75': 27, '76': 27, '77': 27, '78': 27, '79': 26, '80': 26, '81': 26, '82': 25, '83': 25, '84': 25, '85': 24, '86': 24, '87': 24, '88': 23, '89': 23, '90': 23, '91': 22, '92': 22, '93': 22, '94': 21, '95': 21, '96': 21, '97': 20, '98': 20, '99': 20, '100': 19 };
var bi5_to_bi6_quality_map = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 4, '9': 4, '10': 7, '11': 7, '12': 10, '13': 10, '14': 13, '15': 13, '16': 16, '17': 16, '18': 19, '19': 19, '20': 22, '21': 22, '22': 25, '23': 25, '24': 29, '25': 29, '26': 32, '27': 32, '28': 35, '29': 35, '30': 38, '31': 38, '32': 41, '33': 41, '34': 44, '35': 44, '36': 47, '37': 47, '38': 50, '39': 50, '40': 54, '41': 54, '42': 57, '43': 57, '44': 60, '45': 60, '46': 63, '47': 63, '48': 66, '49': 66, '50': 69, '51': 69, '52': 72, '53': 72, '54': 75, '55': 75, '56': 79, '57': 79, '58': 82, '59': 82, '60': 85, '61': 85, '62': 88, '63': 88, '64': 91, '65': 91, '66': 94, '67': 94, '68': 97, '69': 97, '70': 100, '71': 100, '72': 100, '73': 100, '74': 100, '75': 100, '76': 100, '77': 100, '78': 100, '79': 100, '80': 100, '81': 100, '82': 100, '83': 100, '84': 100, '85': 100, '86': 100, '87': 100, '88': 100, '89': 100, '90': 100, '91': 100, '92': 100, '93': 100, '94': 100, '95': 100, '96': 100, '97': 100, '98': 100, '99': 100, '100': 100 };
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