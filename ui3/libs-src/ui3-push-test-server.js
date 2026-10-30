// PUSH NOTIFICATION PROTOTYPE - not part of UI3 releases.
// Web Push test server for the UI3 push prototype (Node.js 18+, no dependencies).
// It stands in for Blue Iris, which will eventually take over this role.
//
// Usage: node ui3-push-test-server.js [port] [listenAddress]     (defaults: 8890 127.0.0.1)
// Environment variables (all optional):
//   UI3PUSH_REQUIRE_SESSION   "1" to validate the Blue Iris session UI3 sends with each request.  Off by default because
//                             Blue Iris sessions only work from the client address that created them, so validation
//                             fails unless the browser reaches Blue Iris from the same address this server does
//                             (e.g. UI3 at http://127.0.0.1:81/).  The server only listens on loopback by default anyway.
//   UI3PUSH_BI_URL            Blue Iris web server used for session validation.  Default http://127.0.0.1:81/
// Data, including the VAPID private key and trigger key, is stored in ~/.ui3-push-test-server.json.
//
// Endpoints:
//   POST /json      UI3's API: {cmd: webpush_info|webpush_subscribe|webpush_unsubscribe|webpush_status|webpush_test, session, ...}
//                   Requires a valid Blue Iris session.  This is the only endpoint to expose through a reverse proxy.
//   GET  /send?title=&body=&tag=&q=&cam=&name=&type=&memo=&db=    Push to every subscription.  Local requests only.
//   GET  /subs      List subscriptions.  Local requests only.
//   GET or POST /trigger?key=<triggerKey>&cam=&name=&type=&memo=&db=   Push an alert to every subscription.  Local requests only.
//        For a Blue Iris camera alert action ("Web request or MQTT", HTTP, payload box empty so it uses GET):
//        127.0.0.1:8890/trigger?key=<triggerKey>&cam=&CAM&name=&NAME&type=&TYPE&memo=&MEMO&db=&ALERT_DB
//        With db, notifications open that alert's clip, and direct-mode subscriptions get the alert thumbnail as the image.
//   "Local" means a loopback connection with no proxy forwarding headers.
//
// Test from a browser on this machine and set UI3's "Push server URL" to http://127.0.0.1:8890/.  That works from
// HTTPS UI3 pages too, because browsers exempt loopback addresses from mixed-content blocking.  Chrome may ask
// once for permission to access the local network.  Browsers on other machines can't reach this server.
"use strict";
const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const port = parseInt(process.argv[2] || "8890");
const listenAddress = process.argv[3] || "127.0.0.1";
const biUrl = process.env.UI3PUSH_BI_URL || "http://127.0.0.1:81/";
const requireSession = process.env.UI3PUSH_REQUIRE_SESSION === "1";
const MAX_SUBSCRIPTIONS = 200;
/** Push services that browsers use.  The server POSTs to registered endpoints, so anything else is refused (SSRF guard). */
const allowedPushHosts = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];

const dataFile = path.join(os.homedir(), ".ui3-push-test-server.json");
let data = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, "utf8")) : {};
if (!data.vapid)
{
	const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
	data.vapid = privateKey.export({ format: "jwk" });
	data.subs = [];
	save();
}
if (!data.triggerKey)
{
	data.triggerKey = crypto.randomBytes(16).toString("hex");
	save();
}
function save() { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2)); }
const vapidPrivate = crypto.createPrivateKey({ key: data.vapid, format: "jwk" });
const vapidPublicRaw = Buffer.concat([Buffer.from([4]), Buffer.from(data.vapid.x, "base64url"), Buffer.from(data.vapid.y, "base64url")]);
const vapidPublicB64 = vapidPublicRaw.toString("base64url");

const hmac = (key, msg) => crypto.createHmac("sha256", key).update(msg).digest();

///////////////////////////////////////////////////////////////
// Web Push ///////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
/** RFC 8291 / RFC 8188 aes128gcm encryption, single record. */
function encrypt(plaintext, p256dh, auth)
{
	const uaPublic = Buffer.from(p256dh, "base64url");
	const authSecret = Buffer.from(auth, "base64url");
	const ecdh = crypto.createECDH("prime256v1");
	ecdh.generateKeys();
	const asPublic = ecdh.getPublicKey();
	const ecdhSecret = ecdh.computeSecret(uaPublic);
	const prkKey = hmac(authSecret, ecdhSecret);
	const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0", "latin1"), uaPublic, asPublic, Buffer.from([1])]));
	const salt = crypto.randomBytes(16);
	const prk = hmac(salt, ikm);
	const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "latin1")).subarray(0, 16);
	const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "latin1")).subarray(0, 12);
	const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
	const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext, "utf8"), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
	const header = Buffer.alloc(21);
	salt.copy(header, 0);
	header.writeUInt32BE(4096, 16);
	header[20] = asPublic.length;
	return Buffer.concat([header, asPublic, body]);
}

function vapidHeader(endpoint)
{
	const aud = new URL(endpoint).origin;
	const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
	const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:ui3-push-test@example.com" });
	const sig = crypto.sign("sha256", Buffer.from(unsigned), { key: vapidPrivate, dsaEncoding: "ieee-p1363" }).toString("base64url");
	return "vapid t=" + unsigned + "." + sig + ", k=" + vapidPublicB64;
}

async function sendPush(sub, payloadObj)
{
	const payload = JSON.stringify(payloadObj);
	const body = encrypt(payload, sub.subscription.keys.p256dh, sub.subscription.keys.auth);
	const res = await fetch(sub.subscription.endpoint, {
		method: "POST",
		headers: { "TTL": "3600", "Urgency": "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "Authorization": vapidHeader(sub.subscription.endpoint) },
		body
	});
	const text = await res.text();
	console.log("push ->", sub.label, "(" + new URL(sub.subscription.endpoint).host + ")", res.status, payload.length + " bytes", text.substring(0, 200));
	sub.lastStatus = res.status;
	sub.lastTime = Date.now();
	if (res.status === 404 || res.status === 410)
		data.subs = data.subs.filter(s => s !== sub);
	save();
	return res.status;
}

/** Builds the notification payload for one subscription from /send or /trigger parameters. */
function buildAlertPayload(sub, p)
{
	const db = /^@?[A-Za-z0-9._-]+$/.test(p.db || "") ? "@" + p.db.replace(/^@/, "") : "";
	let link = p.q || "";
	if (!link && db) link = "?rec=" + db; // db contains only URL-safe characters (validated above)
	else if (!link && p.cam) link = "?cam=" + encodeURIComponent(p.cam);
	const payload = {
		title: p.title || p.name || p.cam || "Blue Iris",
		body: p.body || p.memo || p.type || (p.cam ? "Alert" : ""),
		tag: p.tag || (p.cam ? "cam-" + p.cam : undefined),
		url: sub.ui3Url + link,
		ts: Date.now()
	};
	// Only a direct-mode service worker shares Blue Iris's origin, so only it can fetch the thumbnail, using the browser's
	// Blue Iris session cookie.  Sessions expire after about a minute of inactivity and only work from the address that
	// created them, so this succeeds when UI3 was used recently or the browser's address is exempt from authentication.
	// Otherwise the notification arrives without an image.
	if (db && sub.mode === "direct" && sub.biBaseUrl)
		payload.image = new URL("thumbs/" + db, sub.biBaseUrl).href;
	return payload;
}

async function sendAlert(p)
{
	const targets = data.subs.filter(sub => sub.enabled !== false);
	return Promise.all(targets.map(sub => sendPush(sub, buildAlertPayload(sub, p)).catch(e => String(e))));
}

///////////////////////////////////////////////////////////////
// Blue Iris //////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
async function biJson(args)
{
	const res = await fetch(new URL("json", biUrl), { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(args) });
	return res.json();
}

const sessionCache = new Map();
/** Returns { user, admin } for a valid Blue Iris session, or throws. */
async function validateSession(session)
{
	if (!requireSession)
		return { user: "", admin: false };
	if (typeof session !== "string" || !session || session.length > 100)
		throw new Error("A Blue Iris session is required.");
	const cached = sessionCache.get(session);
	if (cached && Date.now() - cached.time < 60000)
		return cached;
	let response;
	try { response = await biJson({ cmd: "login", session: session }); }
	catch (e) { throw new Error("The push server could not reach Blue Iris to validate your session."); }
	if (!response || response.result !== "success")
		throw new Error("Your Blue Iris session is not valid.  Reload UI3 and try again.");
	const result = { user: (response.data && response.data.user) || "", admin: !!(response.data && response.data.admin), time: Date.now() };
	sessionCache.set(session, result);
	return result;
}

///////////////////////////////////////////////////////////////
// UI3 API ////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function findSub(endpoint) { return data.subs.find(s => s.subscription.endpoint === endpoint); }

function validateSubscription(s)
{
	if (!s || typeof s.endpoint !== "string" || !s.keys)
		throw new Error("Invalid subscription.");
	let url;
	try { url = new URL(s.endpoint); }
	catch (e) { throw new Error("Invalid subscription endpoint."); }
	if (url.protocol !== "https:" || !allowedPushHosts.some(re => re.test(url.hostname)))
		throw new Error("This push service is not supported: " + url.hostname);
	const p256dh = Buffer.from(String(s.keys.p256dh || ""), "base64url");
	const auth = Buffer.from(String(s.keys.auth || ""), "base64url");
	if (p256dh.length !== 65 || p256dh[0] !== 4 || auth.length !== 16)
		throw new Error("Invalid subscription keys.");
}

function httpUrlOrEmpty(value)
{
	try
	{
		const url = new URL(String(value));
		return (url.protocol === "http:" || url.protocol === "https:") && url.href.length <= 2000 ? url.href : "";
	}
	catch (e) { return ""; }
}

async function handleJson(args)
{
	const session = await validateSession(args.session);
	switch (args.cmd)
	{
		case "webpush_info":
			return { vapidPublicKey: vapidPublicB64, serverName: "Test Push Server" };
		case "webpush_subscribe":
			{
				const s = args.subscription;
				validateSubscription(s);
				let existing = findSub(s.endpoint);
				if (!existing)
				{
					if (data.subs.length >= MAX_SUBSCRIPTIONS)
						throw new Error("The push server has too many subscriptions.");
					existing = { created: Date.now() };
					data.subs.push(existing);
				}
				Object.assign(existing, {
					subscription: { endpoint: s.endpoint, expirationTime: s.expirationTime || null, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
					mode: args.mode === "direct" ? "direct" : "relay",
					label: String(args.label || "").substring(0, 100),
					user: session.user,
					ui3Url: httpUrlOrEmpty(args.ui3Url),
					biBaseUrl: httpUrlOrEmpty(args.biBaseUrl),
					userAgent: String(args.userAgent || "").substring(0, 500),
					lastSeen: Date.now()
				});
				save();
				console.log("subscribed:", existing.label, "user:", existing.user, "mode:", existing.mode);
				return {};
			}
		case "webpush_unsubscribe":
			data.subs = data.subs.filter(s => s.subscription.endpoint !== args.endpoint);
			save();
			return {};
		case "webpush_status":
			{
				const sub = findSub(args.endpoint);
				return { subscribed: !!sub, enabled: !!sub && sub.enabled !== false };
			}
		case "webpush_test":
			{
				const sub = findSub(args.endpoint);
				if (!sub) throw new Error("This browser is not subscribed.");
				const status = await sendPush(sub, { title: "Test notification", body: "Sent from the test push server at " + new Date().toLocaleTimeString(), tag: "test", url: sub.ui3Url, ts: Date.now() });
				if (status !== 201) throw new Error("Push service responded with HTTP " + status);
				return {};
			}
	}
	throw new Error("Unknown command " + args.cmd);
}

///////////////////////////////////////////////////////////////
// HTTP Server ////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
/** Merges query string parameters with a form or JSON request body. */
async function readParams(req, url)
{
	const p = Object.fromEntries(url.searchParams);
	if (req.method === "POST")
	{
		const body = (await readBody(req)).trim();
		if (body.startsWith("{"))
			Object.assign(p, JSON.parse(body));
		else if (body)
			Object.assign(p, Object.fromEntries(new URLSearchParams(body)));
	}
	return p;
}

async function readBody(req)
{
	let body = "";
	for await (const chunk of req)
	{
		body += chunk;
		if (body.length > 64 * 1024)
			throw new Error("Request body too large");
	}
	return body;
}

/** True for loopback connections that were not forwarded by a proxy. */
function isLocalRequest(req)
{
	const a = req.socket.remoteAddress || "";
	const loopback = a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
	return loopback && !req.headers["x-forwarded-for"] && !req.headers["x-real-ip"] && !req.headers["forwarded"];
}

function sendJson(res, status, obj)
{
	res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
	res.end(JSON.stringify(obj, null, 2));
}

http.createServer(async (req, res) =>
{
	const url = new URL(req.url, "http://x");
	try
	{
		if (url.pathname === "/json")
		{
			// UI3 sends text/plain, so the browser makes a simple CORS request.  Authentication is the Blue Iris session in the body.
			res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
			res.setHeader("Access-Control-Allow-Private-Network", "true");
			res.setHeader("Vary", "Origin");
			if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
			if (req.method !== "POST") { res.writeHead(405); return res.end(); }
			let out;
			try
			{
				const args = JSON.parse(await readBody(req));
				console.log("json", args.cmd);
				out = { result: "success", data: await handleJson(args) };
			}
			catch (e) { out = { result: "fail", data: { reason: e.message } }; }
			return sendJson(res, 200, out);
		}
		if (url.pathname === "/send" || url.pathname === "/trigger" || url.pathname === "/subs")
		{
			if (!isLocalRequest(req)) { res.writeHead(403); return res.end("Local requests only"); }
			if (url.pathname === "/subs")
				return sendJson(res, 200, data.subs.map(s => ({ label: s.label, user: s.user, mode: s.mode, enabled: s.enabled !== false, ui3Url: s.ui3Url, biBaseUrl: s.biBaseUrl, host: new URL(s.subscription.endpoint).host, lastStatus: s.lastStatus })));
			const p = await readParams(req, url);
			if (url.pathname === "/trigger" && p.key !== data.triggerKey) { res.writeHead(403); return res.end("Invalid key"); }
			console.log(url.pathname, JSON.stringify(Object.assign({}, p, { key: undefined })));
			return sendJson(res, 200, await sendAlert(p));
		}
		res.writeHead(404); res.end();
	}
	catch (e)
	{
		console.error(e);
		res.writeHead(500); res.end("Internal error");
	}
}).listen(port, listenAddress, () =>
{
	console.log("Test push server on " + listenAddress + ":" + port);
	console.log("  VAPID key:   " + vapidPublicB64);
	console.log("  Trigger key: " + data.triggerKey);
	console.log("  Sessions:    " + (requireSession ? "validating UI3 sessions with " + biUrl : "not validated (set UI3PUSH_REQUIRE_SESSION=1 to validate)"));
});
