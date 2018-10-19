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