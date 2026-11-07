// UI3's service worker.  It shows push notifications from Blue Iris (see "Push Notifications" in ui3.js) and enables installing UI3 as an app.
//
// Push payload (JSON, encrypted end-to-end by Blue Iris, so only this browser can read it):
//   title, body, tag, renotify, url, ts, image, requireInteraction, silent
// "url" is the UI3 page to open when the notification is clicked, normally with a ?rec= or ?cam= deep link.
// "image" is a public https URL or a small data:image URL.
// The relay site (https://ui3-push.bp2008.org/sw.js) shows the same payloads for UI3 pages that are not secure contexts.

self.addEventListener('install', function (event)
{
	console.log('UI3 Service Worker installing...');
	self.skipWaiting();
});

self.addEventListener('activate', function (event)
{
	console.log('UI3 Service Worker activating...');
});

self.addEventListener('fetch', function (event)
{
	// Stub necessary for browser to suggest installing PWA.
});

self.addEventListener('push', function (event)
{
	var data = {};
	if (event.data)
	{
		try { data = event.data.json() || {}; }
		catch (e) { data = { body: event.data.text() }; }
	}
	var options = {
		body: pushStr(data.body),
		icon: pushSafeUrl(data.icon, true) || "applet/logos/launcher-icon168.png",
		timestamp: typeof data.ts === "number" ? data.ts : Date.now(),
		requireInteraction: !!data.requireInteraction,
		silent: !!data.silent,
		data: { url: pushSafeUrl(data.url, false) }
	};
	var image = pushSafeUrl(data.image, true);
	if (image)
		options.image = image;
	var tag = pushStr(data.tag);
	if (tag)
	{
		options.tag = tag;
		options.renotify = data.renotify !== false;
	}
	event.waitUntil(self.registration.showNotification(pushStr(data.title) || "Blue Iris", options));
});

self.addEventListener('notificationclick', function (event)
{
	event.notification.close();
	var url = event.notification.data && event.notification.data.url;
	event.waitUntil(focusOrOpenUi3(url));
});

/**
 * Focuses an open UI3 window and asks it to open the notification's clip or camera, or opens a new window if UI3 isn't open.
 * @param {String} url URL from the push payload, or undefined.
 */
function focusOrOpenUi3(url)
{
	var targetPath = url ? stripQueryAndHash(url) : null;
	return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows)
	{
		var match = null;
		for (var i = 0; i < windows.length; i++)
		{
			var clientPath = stripQueryAndHash(windows[i].url);
			if (targetPath ? clientPath === targetPath : /\/ui3\.htm$/i.test(clientPath))
			{
				match = windows[i];
				if (windows[i].focused)
					break;
			}
		}
		if (match)
		{
			return match.focus().then(function (client)
			{
				(client || match).postMessage({ type: "ui3push-click", url: url });
			});
		}
		if (url)
			return self.clients.openWindow(url);
	});
}

function stripQueryAndHash(url)
{
	return String(url).replace(/[?#].*$/, "");
}

function pushStr(value)
{
	return typeof value === "string" ? value : "";
}

/** Returns the URL if it is http(s), or (when allowDataImage) a data:image URL.  Otherwise returns undefined. */
function pushSafeUrl(value, allowDataImage)
{
	if (typeof value !== "string" || !value)
		return undefined;
	if (allowDataImage && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(value))
		return value;
	try
	{
		var url = new URL(value, self.location.href);
		if (url.protocol === "http:" || url.protocol === "https:")
			return url.href;
	}
	catch (e) { }
	return undefined;
}


