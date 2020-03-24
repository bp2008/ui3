function ExecJSON(args, callbackSuccess, callbackFail, jsonBaseUrl, appPathFallback)
{
	if (typeof jsonBaseUrl === "undefined" || jsonBaseUrl === null)
		jsonBaseUrl = appPath;
	var reqUrl = jsonBaseUrl + "json";
	$.ajax({
		type: "POST",
		url: reqUrl,
		contentType: "text/plain",
		data: JSON.stringify(args),
		dataType: "json",
		success: function (c)
		{
			callbackSuccess && callbackSuccess(c);
		},
		error: function (jqXHR, textStatus, errorThrown)
		{
			if (jqXHR && jqXHR.status === 404)
			{
				if (jsonBaseUrl === appPath && appPath !== "" && !appPathFallback)
				{
					console.log('JSON API unreachable at "' + reqUrl + '"');
					ExecJSON(args, callbackSuccess, callbackFail, "", true); // First fallback
					return;
				}
				else if (jsonBaseUrl === "" && appPath !== "/")
				{
					ExecJSON(args, callbackSuccess, callbackFail, "/", true); // Second fallback
					return;
				}
			}
			callbackFail && callbackFail(jqXHR, textStatus, errorThrown);
		}
	});
}
var UrlParameters = {
	loaded: !1,
	parsed_url_params: {},
	Get: function (a)
	{
		if (!this.loaded)
		{
			var b = this.parsed_url_params;
			window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (a, c, e)
			{
				b[c.toLowerCase()] = decodeURIComponent(e)
			});
			this.loaded = !0
		}
		return "undefined" != typeof this.parsed_url_params[a.toLowerCase()] ? this.parsed_url_params[a.toLowerCase()] : ""
	}
};