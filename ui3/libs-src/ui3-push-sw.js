// PUSH NOTIFICATION PROTOTYPE - not part of UI3 releases.
// Service worker used when UI3 is in a secure context and subscribes to push notifications directly (no relay page).
// Registered by ui3-push-prototype.js with scope "ui3/libs-src/ui3-push/" so it stays separate from ui3serviceworker.js.
// If this graduates to a release, these handlers would move into ui3serviceworker.js.
//
// The payload format is the same one the relay site's sw.js handles; see ui3-push-prototype.js.
"use strict";

self.addEventListener("install", function (event)
{
	self.skipWaiting();
});

self.addEventListener("push", function (event)
{
	event.waitUntil(showPushNotification(event));
});

self.addEventListener("notificationclick", function (event)
{
	event.notification.close();
	var url = event.notification.data && event.notification.data.url;
	event.waitUntil(focusOrOpenUi3(url));
});

/**
 * Focuses an open UI3 window and asks it to show the notification's target, or opens a new window if UI3 isn't open.
 * @param {String} url URL from the payload, or undefined.
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

function showPushNotification(event)
{
	var data = {};
	if (event.data)
	{
		try { data = event.data.json() || {}; }
		catch (e) { data = { body: event.data.text() }; }
	}
	var tag = str(data.tag);
	var options = {
		body: str(data.body),
		icon: safeUrl(data.icon, true) || "../../applet/logos/launcher-icon168.png",
		timestamp: typeof data.ts === "number" ? data.ts : Date.now(),
		requireInteraction: !!data.requireInteraction,
		silent: !!data.silent,
		data: { url: safeUrl(data.url, false) }
	};
	if (tag)
	{
		options.tag = tag;
		options.renotify = data.renotify !== false;
	}
	return loadImage(data.image).then(function (image)
	{
		if (image)
			options.image = image;
		return self.registration.showNotification(str(data.title) || "Blue Iris", options);
	});
}

var IMAGE_TIMEOUT_MS = 5000;
/**
 * Resolves with an image for the notification, or undefined if there isn't one.
 * Same-origin images (Blue Iris alert thumbnails) are fetched here rather than by the notification system, so the
 * request carries the Blue Iris session cookie and any failure (expired session, server unreachable, slow network,
 * login page instead of an image) just leaves the image out of the notification.
 * @param {String} value Image URL or data:image URL from the payload.
 */
function loadImage(value)
{
	var url = safeUrl(value, true);
	if (!url || url.indexOf("data:") === 0 || new URL(url).origin !== self.location.origin)
		return Promise.resolve(url); // The browser loads other URLs itself and silently omits the image if it can't.
	var controller = typeof AbortController === "function" ? new AbortController() : null;
	var timeout = setTimeout(function () { if (controller) controller.abort(); }, IMAGE_TIMEOUT_MS);
	return fetch(url, { credentials: "same-origin", cache: "no-store", signal: controller ? controller.signal : undefined })
		.then(function (response)
		{
			var type = response.headers.get("Content-Type") || "";
			if (!response.ok || type.indexOf("image/") !== 0)
				throw new Error("HTTP " + response.status + " " + type);
			return response.blob();
		})
		.then(blobToDataUrl)
		["catch"](function (err)
		{
			console.log("Notification image unavailable: " + url, err);
			return undefined;
		})
		.then(function (image)
		{
			clearTimeout(timeout);
			return image;
		});
}

function blobToDataUrl(blob)
{
	return blob.arrayBuffer().then(function (buffer)
	{
		var bytes = new Uint8Array(buffer);
		var binary = "";
		for (var i = 0; i < bytes.length; i += 0x8000)
			binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
		return "data:" + (blob.type || "image/jpeg") + ";base64," + btoa(binary);
	});
}

function stripQueryAndHash(url)
{
	return String(url).replace(/[?#].*$/, "");
}

function str(value)
{
	return typeof value === "string" ? value : "";
}

/** Returns the URL if it is http(s), or (when allowDataImage) a data:image URL.  Otherwise returns undefined. */
function safeUrl(value, allowDataImage)
{
	if (typeof value !== "string" || !value)
		return undefined;
	if (allowDataImage && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(value))
		return value;
	try
	{
		var url = new URL(value);
		if (url.protocol === "http:" || url.protocol === "https:")
			return url.href;
	}
	catch (e) { }
	return undefined;
}
