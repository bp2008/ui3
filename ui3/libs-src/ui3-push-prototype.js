/// PUSH NOTIFICATION PROTOTYPE - not part of UI3 releases.
/// Loaded by the "PUSH PROTOTYPE" callouts in ui3.htm.  Remove those callouts before making a release.
///
/// Adds a "Push Notifications" item to the main menu and explains in the About dialog when this browser can't use push notifications.
///
/// Two ways to subscribe:
///   direct: UI3 is in a secure context, so it registers its own service worker (ui3/libs-src/ui3-push-sw.js) and subscribes.
///   relay:  UI3 is not in a secure context, so it opens the relay page (a static site on GitHub Pages) which subscribes
///           on its own origin and returns the subscription to UI3.
/// Either way, UI3 then hands the subscription to the push server, which is the prototype push server
/// (configured in this dialog) or, eventually, Blue Iris itself via the JSON API.
///
/// Push server API (JSON POST, same envelope as Blue Iris's /json API; responses are {result:"success"|"fail", data:{...}}):
///   webpush_info                                                       -> { vapidPublicKey, serverName }
///   webpush_subscribe   { subscription, mode, label, ui3Url, biBaseUrl, userAgent } -> {}
///   webpush_unsubscribe { endpoint }                                   -> {}
///   webpush_status      { endpoint }                                   -> { subscribed, enabled }
///   webpush_test        { endpoint }                                   -> {}
/// Every request also carries "session", the Blue Iris session ID, which the server uses to identify the Blue Iris user.
///
/// Notification images: for "direct" subscriptions, the server may set the payload's "image" to an alert thumbnail on
/// biBaseUrl (e.g. biBaseUrl + "thumbs/@123").  The direct-mode service worker fetches same-origin images itself, with
/// the Blue Iris session cookie, and leaves the image out if that fails.  Relay subscriptions can't do this because
/// the relay site is a different origin from Blue Iris.
"use strict";
var ui3PushPrototype = new (function UI3PushPrototype()
{
	var self = this;
	var DEFAULT_RELAY_URL = "https://ui3-push.bp2008.org/";
	var SW_URL = "ui3/libs-src/ui3-push-sw.js";
	var SW_SCOPE = "ui3/libs-src/ui3-push/";
	var PENDING_MAX_AGE_MS = 60 * 60 * 1000;
	var LS_SERVER_URL = "ui3push_proto_serverUrl";
	var LS_RELAY_URL = "ui3push_proto_relayUrl";
	var LS_FORCE_RELAY = "ui3push_proto_forceRelay";
	var LS_LABEL = "ui3push_proto_label";
	var LS_STATE = "ui3push_state";
	var LS_PENDING = "ui3push_pending";

	var dialog = null;
	var $dlgRoot = null;
	var status = null;
	var refreshCounter = 0;
	var pendingRedirectResult = null;
	var popupWatchInterval = null;

	///////////////////////////////////////////////////////////////
	// Helpers ////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	var Base64UrlDecode = function (str)
	{
		var b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
		while (b64.length % 4)
			b64 += "=";
		var bin = atob(b64);
		var bytes = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++)
			bytes[i] = bin.charCodeAt(i);
		return bytes;
	}
	var BytesEqual = function (a, b)
	{
		if (!a || !b)
			return false;
		a = new Uint8Array(a);
		b = new Uint8Array(b);
		if (a.length !== b.length)
			return false;
		for (var i = 0; i < a.length; i++)
			if (a[i] !== b[i])
				return false;
		return true;
	}
	///////////////////////////////////////////////////////////////
	// Support Detection //////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	/**
	 * Returns { supported: Boolean, secure: Boolean, reason: String } describing whether this browser can use push notifications with UI3.
	 */
	this.GetSupport = function ()
	{
		if (BrowserIsIOS())
			return { supported: false, secure: !!window.isSecureContext, reason: "On iOS and iPadOS, Apple only allows web push notifications in web apps that have been added to the Home Screen, which UI3 does not support yet." };
		if (window.isSecureContext)
		{
			if (!("serviceWorker" in navigator) || !navigator.serviceWorker)
				return { supported: false, secure: true, reason: "This browser does not provide service workers here, so it can't receive push notifications.  Service workers may be disabled, for example in a private browsing window." };
			if (!("PushManager" in window))
				return { supported: false, secure: true, reason: "This browser does not support the Push API." };
			if (!("Notification" in window))
				return { supported: false, secure: true, reason: "This browser does not support the Notifications API." };
			return { supported: true, secure: true, reason: "" };
		}
		// In an insecure context, browsers hide the push APIs entirely, so support can't be detected here.  The relay page will report it if push turns out to be unsupported.
		if (BrowserIsIE() || BrowserIsEdgeLegacy() || typeof window.fetch !== "function" || typeof window.TextDecoder !== "function" || typeof window.URL !== "function")
			return { supported: false, secure: false, reason: "This browser is too old." };
		return { supported: true, secure: false, reason: "" };
	}
	/** Returns "direct" or "relay", the subscription method this page would use now. */
	var GetMode = function ()
	{
		return self.GetSupport().secure && lsGet(LS_FORCE_RELAY) !== "1" ? "direct" : "relay";
	}
	///////////////////////////////////////////////////////////////
	// Settings and State /////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	var lsGet = function (key)
	{
		try { return localStorage.getItem(key) || ""; }
		catch (ex) { return ""; }
	}
	var lsSet = function (key, value)
	{
		try
		{
			if (value === null || value === undefined || value === "")
				localStorage.removeItem(key);
			else
				localStorage.setItem(key, value);
		}
		catch (ex) { console.error(ex); }
	}
	var lsGetJson = function (key)
	{
		try { return JSON.parse(lsGet(key)) || null; }
		catch (ex) { return null; }
	}
	/** Returns the push server base URL with a trailing slash, or "" to use Blue Iris's own JSON API. */
	var GetServerUrl = function ()
	{
		var url = lsGet(LS_SERVER_URL).trim();
		if (url && url[url.length - 1] !== '/')
			url += '/';
		return url;
	}
	var GetRelayUrl = function ()
	{
		var url = lsGet(LS_RELAY_URL).trim() || DEFAULT_RELAY_URL;
		if (url[url.length - 1] === '/')
			url += "index.html";
		return url;
	}
	var GetRelayOrigin = function ()
	{
		try { return new URL(GetRelayUrl(), location.href).origin; }
		catch (ex) { return ""; }
	}
	var GetLabel = function ()
	{
		return lsGet(LS_LABEL).trim() || GetDefaultLabel();
	}
	var GetDefaultLabel = function ()
	{
		var ua = navigator.userAgent;
		var browser = "Web browser";
		if (/ Edg\//.test(ua)) browser = "Edge";
		else if (/ OPR\//.test(ua)) browser = "Opera";
		else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
		else if (/Firefox\//.test(ua)) browser = "Firefox";
		else if (/Chrome\//.test(ua)) browser = "Chrome";
		else if (/Safari\//.test(ua)) browser = "Safari";
		var os = "";
		if (/Android/.test(ua)) os = "Android";
		else if (/Windows/.test(ua)) os = "Windows";
		else if (/CrOS/.test(ua)) os = "ChromeOS";
		else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
		else if (/Linux/.test(ua)) os = "Linux";
		return os ? browser + " on " + os : browser;
	}
	/** The URL that notifications should open when clicked. */
	var GetUi3Url = function ()
	{
		return location.origin + location.pathname;
	}
	/** The Blue Iris web server root as reached from this page (e.g. for "thumbs/@123" alert thumbnail URLs). */
	var GetBiBaseUrl = function ()
	{
		try { return new URL(currentServer.remoteBaseURL || "/", location.href).href; }
		catch (ex) { return location.origin + "/"; }
	}
	/** Returns this browser's subscription record { mode, endpoint, vapidKey, serverUrl, created }, or null. */
	var GetState = function ()
	{
		var state = lsGetJson(LS_STATE);
		return state && state.endpoint ? state : null;
	}
	var SetState = function (state)
	{
		lsSet(LS_STATE, state ? JSON.stringify(state) : null);
	}
	///////////////////////////////////////////////////////////////
	// Push Server API ////////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	/**
	 * Sends a command to the push server and returns a promise that resolves with the response's "data" object.
	 * @param {String} cmd Command name.
	 * @param {Object} args Additional arguments.
	 */
	var CallServer = function (cmd, args)
	{
		args = $.extend({ cmd: cmd, session: sessionManager.GetAPISession() }, args);
		var base = GetServerUrl();
		var promise;
		if (!base)
		{
			promise = ExecJSONPromise(args)["catch"](function (errorHtml)
			{
				throw new Error("Blue Iris did not respond: " + $("<div></div>").html(errorHtml).text());
			});
		}
		else
		{
			// Content-Type text/plain keeps this a "simple" CORS request, so no preflight is needed.
			promise = fetch(base + "json", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(args), cache: "no-store" })
				.then(function (response)
				{
					if (!response.ok)
						throw new Error("The push server responded with HTTP " + response.status + " " + response.statusText);
					return response.json();
				}, function (err)
				{
					var message = "Unable to reach the push server at " + base + " (" + (err && err.message ? err.message : err) + ")";
					// Chrome's private network access rules stop an insecure page from calling a more private address, such as a loopback push server.
					if (!window.isSecureContext && /^https?:\/\/(127\.|localhost|\[::1\])/i.test(new URL(base, location.href).href))
						message += ".  Browsers block insecure pages from calling a push server on this computer's loopback address.  Test relay mode from a secure UI3 address instead, using the \"Use the relay site\" prototype setting.";
					throw new Error(message);
				});
		}
		return promise.then(function (response)
		{
			if (!response || response.result !== "success")
			{
				var reason = (response && response.data && response.data.reason) || (response && response.reason);
				throw new Error(reason ? reason : (base ? "The push server" : "Blue Iris") + ' rejected the "' + cmd + '" command.');
			}
			return response.data || {};
		});
	}
	var RegisterWithServer = function (subscriptionJson, mode, vapidKey)
	{
		return CallServer("webpush_subscribe",
			{
				subscription: subscriptionJson
				, mode: mode
				, label: GetLabel()
				, ui3Url: GetUi3Url()
				, biBaseUrl: GetBiBaseUrl()
				, userAgent: navigator.userAgent
			})
			.then(function ()
			{
				SetState({ mode: mode, endpoint: subscriptionJson.endpoint, vapidKey: vapidKey, serverUrl: GetServerUrl(), created: Date.now() });
			});
	}
	///////////////////////////////////////////////////////////////
	// Direct Subscription (secure context) ///////////////////////
	///////////////////////////////////////////////////////////////
	var RequestPermission = function ()
	{
		return new Promise(function (resolve)
		{
			// Older Safari versions only support the callback form.
			var p = Notification.requestPermission(resolve);
			if (p && typeof p.then === "function")
				p.then(resolve);
		});
	}
	var WaitForActive = function (registration)
	{
		if (registration.active)
			return Promise.resolve(registration);
		return new Promise(function (resolve, reject)
		{
			var worker = registration.installing || registration.waiting;
			if (!worker)
				return reject(new Error("The service worker registration has no worker."));
			worker.addEventListener("statechange", function ()
			{
				if (worker.state === "activated")
					resolve(registration);
				else if (worker.state === "redundant")
					reject(new Error("The service worker failed to install."));
			});
		});
	}
	var GetDirectRegistration = function ()
	{
		if (!self.GetSupport().secure || !navigator.serviceWorker)
			return Promise.resolve(null);
		return navigator.serviceWorker.getRegistration(SW_SCOPE).then(function (registration)
		{
			// getRegistration returns the closest matching scope, which could be UI3's main service worker.
			if (registration && registration.scope === new URL(SW_SCOPE, location.href).href)
				return registration;
			return null;
		});
	}
	var GetDirectSubscription = function ()
	{
		return GetDirectRegistration().then(function (registration)
		{
			return registration ? registration.pushManager.getSubscription() : null;
		});
	}
	var EnableDirect = function (vapidKey)
	{
		// Request permission before doing anything asynchronous, so the browser still considers it a response to the click.
		var permissionPromise = RequestPermission();
		var keyBytes = Base64UrlDecode(vapidKey);
		SetBusy("Waiting for notification permission…");
		permissionPromise
			.then(function (permission)
			{
				if (permission === "denied")
					throw new Error("Notifications are blocked for this site.  Allow them in your browser's site settings, then try again.");
				if (permission !== "granted")
					throw new Error("Notification permission was not granted.");
				SetBusy("Subscribing…");
				return navigator.serviceWorker.register(SW_URL + "?v=" + combined_version + local_bi_session_arg, { scope: SW_SCOPE });
			})
			.then(WaitForActive)
			.then(function (registration)
			{
				return registration.pushManager.getSubscription().then(function (existing)
				{
					if (existing && existing.options && BytesEqual(existing.options.applicationServerKey, keyBytes))
						return existing;
					return (existing ? existing.unsubscribe() : Promise.resolve()).then(function ()
					{
						return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
					});
				});
			})
			.then(function (subscription)
			{
				SetBusy("Registering with the push server…");
				return RegisterWithServer(subscription.toJSON(), "direct", vapidKey);
			})
			.then(function ()
			{
				toaster.Success("Push notifications are enabled in this browser.");
			})
			["catch"](function (err)
			{
				console.error(err);
				toaster.Error("Push notifications were not enabled: " + htmlEncode(err && err.message ? err.message : String(err)), 15000);
			})
			.then(Refresh);
	}
	///////////////////////////////////////////////////////////////
	// Relay Subscription (insecure context) //////////////////////
	///////////////////////////////////////////////////////////////
	var EnableRelay = function (vapidKey, serverName)
	{
		var nonce = getRandomAlphanumericStr(24);
		lsSet(LS_PENDING, JSON.stringify({ nonce: nonce, vapidKey: vapidKey, time: Date.now() }));
		var url = GetRelayUrl()
			+ "#k=" + encodeURIComponent(vapidKey)
			+ "&r=" + encodeURIComponent(GetUi3Url())
			+ "&n=" + encodeURIComponent(serverName || "")
			+ "&o=" + encodeURIComponent(nonce);
		var popup = null;
		try { popup = window.open(url, "ui3push_relay", "popup,width=540,height=680"); }
		catch (ex) { console.error(ex); }
		if (!popup)
		{
			// Popup blocked.  Go there in this tab; the relay page will navigate back with the result.
			location.href = url;
			return;
		}
		SetBusy("Waiting for the relay page.  Finish in the window that just opened.");
		clearInterval(popupWatchInterval);
		popupWatchInterval = setInterval(function ()
		{
			if (popup.closed)
			{
				clearInterval(popupWatchInterval);
				if (status && status.busy)
					Refresh();
			}
		}, 750);
	}
	/** Returns the pending relay request if the nonce matches it, and clears it.  Otherwise returns null. */
	var ConsumePending = function (nonce)
	{
		var pending = lsGetJson(LS_PENDING);
		if (!pending || !nonce || pending.nonce !== nonce || !(Date.now() - pending.time < PENDING_MAX_AGE_MS))
			return null;
		lsSet(LS_PENDING, null);
		return pending;
	}
	var HandleRelayResult = function (result, pending)
	{
		clearInterval(popupWatchInterval);
		if (!result.ok)
		{
			if (result.error !== "cancelled")
				toaster.Warning("Push notifications were not enabled: " + htmlEncode(result.message || result.error || "Unknown error"), 15000);
			Refresh();
			return;
		}
		SetBusy("Registering with the push server…");
		RegisterWithServer(result.subscription, "relay", pending.vapidKey)
			.then(function ()
			{
				toaster.Success("Push notifications are enabled in this browser.");
			})
			["catch"](function (err)
			{
				console.error(err);
				toaster.Error("Push notifications were not enabled: " + htmlEncode(err && err.message ? err.message : String(err)), 15000);
			})
			.then(Refresh);
	}
	// Result delivered by postMessage from the relay popup.
	window.addEventListener("message", function (e)
	{
		var data = e.data;
		if (!data || data.type !== "ui3push-relay-result" || e.origin !== GetRelayOrigin())
			return;
		var pending = ConsumePending(data.nonce);
		if (!pending)
			return;
		try { e.source.postMessage({ type: "ui3push-relay-ack", nonce: data.nonce }, e.origin); }
		catch (ex) { console.error(ex); }
		HandleRelayResult(data, pending);
	});
	// Result delivered in the URL fragment, when the relay page navigated back to UI3.
	(function ()
	{
		var match = location.hash.match(/[#&]ui3push=([A-Za-z0-9_-]+)/);
		if (!match)
			return;
		var newHash = location.hash.replace(/[#&]ui3push=[A-Za-z0-9_-]+/, "").replace(/^#?&/, "#");
		try { history.replaceState(history.state, "", location.pathname + location.search + (newHash.length > 1 ? newHash : "")); }
		catch (ex) { console.error(ex); }
		try
		{
			var result = JSON.parse(new TextDecoder().decode(Base64UrlDecode(match[1])));
			var pending = result && result.type === "ui3push-relay-result" ? ConsumePending(result.nonce) : null;
			if (pending)
				pendingRedirectResult = { result: result, pending: pending };
		}
		catch (ex)
		{
			console.error("Unable to read the push notification relay result", ex);
		}
	})();
	BI_CustomEvent.AddListener("Login Success", function ()
	{
		if (pendingRedirectResult)
		{
			var r = pendingRedirectResult;
			pendingRedirectResult = null;
			HandleRelayResult(r.result, r.pending);
		}
	});
	///////////////////////////////////////////////////////////////
	// Disable and Test ///////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	var Disable = function ()
	{
		var state = GetState();
		var endpoint = state ? state.endpoint : (status && status.endpoint);
		SetBusy("Turning off push notifications…");
		var serverError = null;
		(endpoint ? CallServer("webpush_unsubscribe", { endpoint: endpoint }) : Promise.resolve())
			["catch"](function (err)
			{
				serverError = err;
			})
			.then(function ()
			{
				// Remove the browser's own subscription too.  A relay subscription lives on the relay site's origin, where UI3 can't reach it, but without the server knowing its endpoint, nothing can use it.
				return GetDirectRegistration().then(function (registration)
				{
					if (!registration)
						return;
					return registration.pushManager.getSubscription()
						.then(function (subscription)
						{
							return subscription ? subscription.unsubscribe() : null;
						})
						.then(function ()
						{
							return registration.unregister();
						});
				});
			})
			.then(function ()
			{
				SetState(null);
				if (serverError)
					toaster.Warning("Push notifications were turned off in this browser, but the push server could not be told: " + htmlEncode(serverError.message), 15000);
				else
					toaster.Success("Push notifications are turned off in this browser.");
			})
			["catch"](function (err)
			{
				console.error(err);
				toaster.Error("Unable to turn off push notifications: " + htmlEncode(err && err.message ? err.message : String(err)), 15000);
			})
			.then(Refresh);
	}
	var SendTest = function ()
	{
		if (!status || !status.endpoint)
			return;
		CallServer("webpush_test", { endpoint: status.endpoint })
			.then(function ()
			{
				toaster.Info("Test notification sent.  It should appear within a few seconds.");
			})
			["catch"](function (err)
			{
				toaster.Error("Test notification failed: " + htmlEncode(err && err.message ? err.message : String(err)), 15000);
			});
	}
	///////////////////////////////////////////////////////////////
	// Notification Clicks (direct mode) //////////////////////////
	///////////////////////////////////////////////////////////////
	// The direct-mode service worker focuses an open UI3 window and sends it the clicked notification's URL.
	if (window.isSecureContext && navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === "function")
	{
		navigator.serviceWorker.addEventListener("message", function (e)
		{
			if (e.data && e.data.type === "ui3push-click")
				HandleNotificationClick(e.data.url);
		});
		try { navigator.serviceWorker.startMessages(); }
		catch (ex) { }
	}
	var HandleNotificationClick = function (url)
	{
		if (!url)
			return;
		var params;
		try { params = new URL(url).searchParams; }
		catch (ex) { return; }
		var recId = params.get("rec") || params.get("r");
		var camId = params.get("cam") || params.get("c");
		if (recId)
		{
			var offset = 0;
			var idxHyphen = recId.lastIndexOf('-');
			if (idxHyphen > 0)
			{
				offset = parseInt(recId.substr(idxHyphen + 1));
				if (isNaN(offset))
					offset = 0;
				recId = recId.substr(0, idxHyphen);
			}
			recId = "@" + recId.replace(/^@+/, "");
			clipStatsLoader.LoadClipStats(recId, null, false, function (stats)
			{
				if (!stats)
				{
					toaster.Warning("The recording from the notification could not be opened.");
					return;
				}
				if (offset > 0 && offset < stats.msec)
					stats.offset = offset;
				OpenClipFromStats(stats);
			});
		}
		else if (camId && cameraListLoader)
		{
			var cam = cameraListLoader.GetCameraWithId(camId);
			if (cam)
				videoPlayer.LoadLiveCamera(cam);
		}
	}
	///////////////////////////////////////////////////////////////
	// Dialog /////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	this.OpenDialog = function ()
	{
		CloseDialog();
		$dlgRoot = $('<div class="pushProtoDialog"></div>');
		status = { loading: true };
		Render();
		dialog = $dlgRoot.modalDialog(
			{
				title: "Push Notifications"
				, closeOnOverlayClick: true
				, onClosing: function ()
				{
					dialog = null;
					$dlgRoot = null;
				}
			});
		Refresh();
	}
	var CloseDialog = function ()
	{
		if (dialog)
		{
			dialog.close();
			dialog = null;
			$dlgRoot = null;
		}
	}
	var SetBusy = function (message)
	{
		if (!status)
			status = {};
		status.busy = message;
		Render();
	}
	/** Reloads status from the browser and the push server, then re-renders the dialog. */
	var Refresh = function ()
	{
		var myCounter = ++refreshCounter;
		var support = self.GetSupport();
		var state = GetState();
		var s = { loading: true, support: support, mode: state ? state.mode : GetMode(), state: state };
		status = s;
		Render();
		if (!support.supported)
		{
			s.loading = false;
			Render();
			return;
		}
		if (!GetServerUrl())
		{
			// Blue Iris doesn't implement the webpush_* commands yet, so asking it would only produce a confusing error.
			s.error = "No push server is configured.  Blue Iris doesn't support push notifications yet, so enter the test push server's address in Prototype settings below (for example http://127.0.0.1:8890/).";
			s.loading = false;
			Render();
			return;
		}
		var endpointPromise = (s.mode === "direct")
			? GetDirectSubscription().then(function (subscription) { return subscription ? subscription.endpoint : null; })
			: Promise.resolve(state ? state.endpoint : null);
		Promise.all([CallServer("webpush_info", {}), endpointPromise])
			.then(function (results)
			{
				s.info = results[0];
				s.endpoint = results[1];
				if (!s.info.vapidPublicKey)
					throw new Error("The push server did not provide a VAPID public key.");
				if (!s.endpoint)
					return { subscribed: false };
				return CallServer("webpush_status", { endpoint: s.endpoint });
			})
			.then(function (result)
			{
				s.subscribed = !!(result && result.subscribed);
				s.paused = s.subscribed && result.enabled === false;
				if (state && !s.subscribed && s.endpoint)
					s.serverForgot = true;
			})
			["catch"](function (err)
			{
				console.error(err);
				s.error = err && err.message ? err.message : String(err);
			})
			.then(function ()
			{
				s.loading = false;
				if (myCounter === refreshCounter)
					Render();
			});
	}
	var Render = function ()
	{
		if (!$dlgRoot)
			return;
		var s = status || {};
		var support = s.support || self.GetSupport();
		var mode = s.mode || GetMode();
		var html = [];
		var pill;
		if (!support.supported)
			pill = ["unavailable", "Unavailable"];
		else if (s.loading)
			pill = ["loading", "Checking…"];
		else if (s.error)
			pill = ["warning", "Push server problem"];
		else if (s.paused)
			pill = ["warning", "Paused by the server"];
		else if (s.subscribed)
			pill = ["on", "On in this browser"];
		else
			pill = ["off", "Off in this browser"];
		html.push('<div class="pushProtoStatus pushProto_' + pill[0] + '"><span class="pushProtoDot"></span>' + htmlEncode(pill[1]) + '</div>');

		if (!support.supported)
		{
			html.push('<p>' + htmlEncode(support.reason) + '</p>');
		}
		else
		{
			var serverName = s.info && s.info.serverName ? s.info.serverName : "Blue Iris";
			html.push('<p>Blue Iris can notify this browser about alerts, even when UI3 is closed.</p>');
			if (s.error)
				html.push('<p class="pushProtoError">' + htmlEncode(s.error) + '</p>');
			if (s.serverForgot)
				html.push('<p class="pushProtoWarning">The push server no longer has this browser\'s subscription.  Enable notifications again to receive them.</p>');
			if (s.paused)
				html.push('<p class="pushProtoWarning">This browser is registered, but notifications to it have been paused in the push server\'s device list.</p>');
			else if (s.subscribed)
				html.push('<p>This browser will receive notifications from <b>' + htmlEncode(serverName) + '</b>.  Clicking one opens <span class="pushProtoUrl">' + htmlEncode(GetUi3Url()) + '</span>.</p>');
			if (mode === "direct" && window.Notification && Notification.permission === "denied")
				html.push('<p class="pushProtoWarning">Notifications are blocked for this site.  Allow them in your browser\'s site settings to use this feature.</p>');

			html.push('<div class="pushProtoDelivery">');
			if (mode === "direct")
				html.push('<b>Delivery:</b> direct.  This UI3 address is a secure context, so it receives notifications itself.');
			else
			{
				var relayHost = "";
				try { relayHost = new URL(GetRelayUrl(), location.href).host; } catch (ex) { }
				html.push('<b>Delivery:</b> through the relay site <span class="pushProtoUrl">' + htmlEncode(relayHost) + '</span>.  '
					+ (support.secure ? 'A prototype setting requires the relay site.' : 'This UI3 address is not secure (HTTPS), and browsers only let secure sites receive push notifications.')
					+ '  Notifications will appear to come from that site.');
			}
			html.push('</div>');

			html.push('<div class="pushProtoButtons">');
			if (s.busy)
				html.push('<div class="pushProtoBusy">' + htmlEncode(s.busy) + '</div>');
			else if (!s.loading)
			{
				if (s.subscribed)
				{
					html.push('<input type="button" class="simpleTextButton btnGreen pushProtoBtnTest" value="Send test notification" />');
					html.push('<input type="button" class="simpleTextButton btnTransparent pushProtoBtnDisable" value="Turn off" />');
				}
				else if (s.info && !s.error)
					html.push('<input type="button" class="simpleTextButton btnGreen pushProtoBtnEnable" value="Enable notifications" />');
				else
					html.push('<input type="button" class="simpleTextButton btnTransparent pushProtoBtnRetry" value="Retry" />');
				if (!s.subscribed && s.state)
					html.push('<input type="button" class="simpleTextButton btnTransparent pushProtoBtnDisable" value="Forget this browser\'s subscription" />');
			}
			html.push('</div>');
		}

		html.push('<details class="pushProtoSettings"' + (!GetServerUrl() || s.error ? ' open' : '') + '>');
		html.push('<summary>Prototype settings</summary>');
		html.push('<label>Push server URL<input type="text" class="pushProtoInServer" spellcheck="false" placeholder="http://127.0.0.1:8890/" value="' + htmlEncode(lsGet(LS_SERVER_URL)) + '" /></label>');
		html.push('<label>Relay site URL<input type="text" class="pushProtoInRelay" spellcheck="false" placeholder="' + htmlEncode(DEFAULT_RELAY_URL) + '" value="' + htmlEncode(lsGet(LS_RELAY_URL)) + '" /></label>');
		html.push('<label>Name for this browser<input type="text" class="pushProtoInLabel" spellcheck="false" placeholder="' + htmlEncode(GetDefaultLabel()) + '" value="' + htmlEncode(lsGet(LS_LABEL)) + '" /></label>');
		if (support.secure)
			html.push('<label class="pushProtoCheck"><input type="checkbox" class="pushProtoInForceRelay"' + (lsGet(LS_FORCE_RELAY) === "1" ? ' checked' : '') + ' /> Use the relay site even though this page is secure</label>');
		html.push('<div class="pushProtoHint">The name is sent with the subscription so the push server can tell browsers apart.  Settings changes apply to the next subscription.</div>');
		html.push('</details>');

		var wasOpen = $dlgRoot.find(".pushProtoSettings").prop("open");
		$dlgRoot.html(html.join(""));
		if (typeof wasOpen === "boolean")
			$dlgRoot.find(".pushProtoSettings").prop("open", wasOpen);

		$dlgRoot.find(".pushProtoBtnEnable").on("click", function ()
		{
			if (!s.info || !s.info.vapidPublicKey)
				return;
			if (GetMode() === "direct")
				EnableDirect(s.info.vapidPublicKey);
			else
				EnableRelay(s.info.vapidPublicKey, s.info.serverName);
		});
		$dlgRoot.find(".pushProtoBtnDisable").on("click", Disable);
		$dlgRoot.find(".pushProtoBtnTest").on("click", SendTest);
		$dlgRoot.find(".pushProtoBtnRetry").on("click", Refresh);
		$dlgRoot.find(".pushProtoInServer").on("change", function () { lsSet(LS_SERVER_URL, $(this).val().trim()); Refresh(); });
		$dlgRoot.find(".pushProtoInRelay").on("change", function () { lsSet(LS_RELAY_URL, $(this).val().trim()); Render(); });
		$dlgRoot.find(".pushProtoInLabel").on("change", function () { lsSet(LS_LABEL, $(this).val().trim()); });
		$dlgRoot.find(".pushProtoInForceRelay").on("change", function () { lsSet(LS_FORCE_RELAY, $(this).is(":checked") ? "1" : ""); Refresh(); });

		if (dialog)
			dialog.contentChanged(true);
	}
	///////////////////////////////////////////////////////////////
	// UI3 Integration ////////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	var UpdateAboutDialog = function ()
	{
		$("#ui3PushAboutNote").remove();
		var support = self.GetSupport();
		if (support.supported)
			return;
		var $opt = $("#optionalFeaturesNotSupported");
		var $ul = $opt.children("ul").first();
		if (!$ul.length)
		{
			$ul = $("<ul></ul>");
			$opt.append($ul);
		}
		$ul.append($('<li id="ui3PushAboutNote"></li>').text("Push notifications are not supported.  " + support.reason));
		$opt.show();
	}
	var originalOpenAboutDialog = window.openAboutDialog;
	window.openAboutDialog = function ()
	{
		try { UpdateAboutDialog(); }
		catch (ex) { console.error(ex); }
		return originalOpenAboutDialog.apply(this, arguments);
	}
	$(function ()
	{
		if (!dropdownBoxes || !dropdownBoxes.listDefs["mainMenu"])
			return;
		var listDef = dropdownBoxes.listDefs["mainMenu"];
		var insertAt = listDef.items.length;
		for (var i = 0; i < listDef.items.length; i++)
			if (listDef.items[i].cmd === "copy_current_url")
				insertAt = i + 1;
		listDef.items.splice(insertAt, 0, new DropdownListItem(
			{
				cmd: "push_notifications"
				, text: "Push Notifications"
				, icon: "#svg_x5F_Alert"
				, cssClass: "goldenLarger"
				, tooltip: "Receive Blue Iris notifications in this browser (prototype)"
				, visibleFn: function () { return self.GetSupport().supported; }
			}));
		var originalOnItemClick = listDef.onItemClick;
		listDef.onItemClick = function (item)
		{
			if (item && item.cmd === "push_notifications")
				self.OpenDialog();
			else
				return originalOnItemClick.apply(this, arguments);
		}
	});
})();
