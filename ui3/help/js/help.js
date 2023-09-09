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