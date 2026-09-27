/*
 * KVStore legacy reference client.
 *
 * A variant of kvstore-client.js for pages that are not a secure context (plain http, where crypto.subtle is undefined), and for old
 * browsers down to Internet Explorer 9 in standards mode (a page with <!DOCTYPE html>).  It implements exactly the same client-side
 * encryption convention, so data written by either client can be read by the other:
 *
 *   phrase     = 6 words from the EFF short wordlist #1                (~62 bits)
 *   material   = PBKDF2-SHA256(phrase, salt="bp2008-kv-v1", iterations=600000, dkLen=64)    (10000 iterations in "fast" mode)
 *   lookupKey  = base32(material[0..20])  -> 32 chars, sent to the server
 *   contentKey = material[32..64]         -> AES-256-GCM key, never transmitted
 *   stored     = 12-byte IV, then the AES-256-GCM ciphertext, then the 16-byte tag
 *
 * "fast" mode (new KVStoreClientLegacy(url, { keyDerivation: "fast" })) derives keys 60 times faster, at the cost of making phrases 60
 * times cheaper to guess offline.  Use it only with randomly generated phrases of at least 6 words, and use the same mode on every
 * device, because the two modes derive different keys.  See "Key derivation modes" in kvstore-client.js.
 *
 * Usage:
 *   var kv = new KVStoreClientLegacy("http://kv.example.com");
 *   kv.phrase(6, function (err, phrase)                          // or KVStoreClientLegacy.generatePhrase(wordList, 6)
 *   {
 *       if (err) return showError(err);
 *       kv.putEncrypted(phrase, "some settings JSON", function (err, result) { ... },   // device A
 *           function (fraction) { showProgress(fraction); });   // optional key derivation progress, 0 to 1
 *   });
 *   kv.getEncryptedText(phrase, function (err, text) { ... });  // device B; text is null if nothing is stored
 *   kv.getEncryptedText(phrase).then(function (text) { ... });  // without a callback, returns a Promise where Promise exists
 *
 * Prefer kvstore-client.js wherever it works (secure contexts in current browsers).  It is smaller and much faster.
 *
 * DESIGN NOTES
 *
 * Language.  ES5 syntax only, with no build step, and no use of typed arrays, Promise, fetch, TextEncoder/TextDecoder, or atob/btoa
 * unless they are detected at run time.  Bytes are plain Arrays of numbers from 0 to 255.  Byte inputs may be any array-like of
 * bytes, such as a Uint8Array.  Byte outputs are always plain Arrays (use new Uint8Array(result) if you need one).  UTF-8, base64,
 * and base32 are implemented here.  UTF-8 decoding matches TextDecoder: invalid sequences become U+FFFD, and a leading BOM is dropped.
 * The native JSON object is required (IE8 and later, in standards mode).
 *
 * Asynchronous API.  Every network or crypto method takes a Node-style callback(err, result), which is always called exactly once and
 * never synchronously.  If the callback is omitted (or null) and Promise exists, the method returns a Promise instead.  Without
 * Promise, a callback is required.  Method names match kvstore-client.js.  Differences:
 *   - putRaw/getRaw use the "put"/"get" operations with base64 values, not "putraw"/"getraw", which need typed arrays.  They store and
 *     read the same items, so the two clients interoperate.  putRaw also accepts a string, which it encodes as UTF-8.
 *   - deriveKeys returns contentKey as a plain Array of 32 bytes, not a CryptoKey, and takes the key derivation mode as its fourth
 *     argument, after callback and onProgress: deriveKeys(phrase, callback, onProgress, mode).
 *   - The phrase argument of putEncrypted/getEncrypted/getEncryptedText may also be the object returned by deriveKeys, to avoid
 *     repeating the slow key derivation.
 *   - Errors that are not from the server have status 0 and one of these codes: "network_error" (no response: offline, DNS failure,
 *     blocked request), "timeout" (only if options.timeout is set), "xdr_failed" and "xdr_scheme_mismatch" (see Transport), and
 *     "no_transport".  Local errors are Errors with a code: "decrypt_failed", "no_secure_random", "invalid_argument", "invalid_base64".
 *
 * Crypto.  SHA-256, HMAC-SHA256, PBKDF2, AES-256 (encryption direction only, which is all GCM needs), and GCM (with a 4-bit table
 * GHASH) are implemented in plain JavaScript.  PBKDF2's inner loop (Pbkdf2Loop) is derived from asmcrypto.js, under the MIT License
 * (see the notice there).  Where crypto.subtle exists (secure contexts) and KVStoreClientLegacy.useNativeCrypto is true (the default),
 * PBKDF2 and AES-GCM use it instead.  If a native call fails, for example in a browser without native PBKDF2, the pure-JS code runs
 * instead.  Native AES-GCM decryption failures are also retried in pure JS, which then reports "decrypt_failed".
 * Long pure-JS work is split into slices of about KVStoreClientLegacy.sliceMs milliseconds (default 50), separated by a yield to the
 * event loop (a MessageChannel message where MessageChannel exists, otherwise setTimeout).  This keeps the page responsive, and keeps
 * every single script execution short, which is what old Internet Explorer's "A script on this page is causing Internet Explorer to
 * run slowly" warning looks for.  The optional onProgress(fraction) callback reports key derivation progress.
 * 600,000 PBKDF2 iterations in pure JavaScript is slow.  Measured on one desktop PC: about 0.37 seconds in Node 24 (V8), 0.62 seconds
 * in Chromium 152, versus about 0.12 seconds natively in both, and about 1.3 seconds in Windows 11's MSHTML (the IE11 engine) in IE9
 * document mode.  A real IE9, with its older engine on hardware of its era, will probably take tens of seconds (an estimate, not a
 * measurement).  Show a progress indicator.  "fast" mode (10,000 iterations) took about 7 milliseconds in Node and 45 milliseconds in
 * MSHTML, and should take well under a second in a real IE9.
 *
 * Randomness.  crypto.getRandomValues (all current browsers, including on plain-http pages) or msCrypto.getRandomValues (IE11) is
 * used when present.  IE9 and IE10 have no cryptographically secure random number generator (CSPRNG), and Math.random is not one.
 *   - Secrets never come from Math.random: generatePhrase() and randomKey() throw an Error with code "no_secure_random" when there is no
 *     CSPRNG.  Call KVStoreClientLegacy.hasSecureRandom() first, and if it returns false, get a phrase from the server with kv.phrase().
 *     Over plain http, that phrase is visible to anyone who can watch the network traffic.
 *   - AES-GCM IVs come from the CSPRNG when there is one: 12 random bytes, as in kvstore-client.js.  Without one, a synthetic IV is
 *     used, as in SIV mode: IV = the first 12 bytes of HMAC-SHA256(ivKey, nonce + plaintext), where
 *     ivKey = HMAC-SHA256(contentKey, "bp2008-kv-v1 legacy synthetic IV") and nonce is 32 bytes built from the time, a per-page counter,
 *     Math.random(), and performance.now().  Because the nonce has a fixed length, two encryptions under one key can get the same IV only
 *     if (a) HMAC outputs collide for different inputs, which is as unlikely as two random 96-bit IVs colliding, or (b) the nonce and the
 *     plaintext are both identical, in which case the whole ciphertext is identical too, which reveals only that the same value was
 *     stored twice.  GCM's IV-reuse failures (keystream reuse and tag forgery) need two different plaintexts under one IV, so they can
 *     not happen, however predictable Math.random is.  Readers need no changes, because the IV is stored in front of the ciphertext.
 *
 * Transport.  XMLHttpRequest, sending the JSON body as text/plain, so no CORS preflight request is needed.  IE8 and IE9's
 * XMLHttpRequest can not make cross-origin requests, so for a cross-origin URL in a browser whose XMLHttpRequest lacks CORS support,
 * XDomainRequest (XDR) is used.  XDR's limitations:
 *   - It can only send GET and POST, and can not set request headers.  It sends text/plain (or no Content-Type), which the server
 *     accepts, because it parses every body as JSON.
 *   - The page and the API must use the same scheme: an http page can only call an http API.  (An https page can not call an http API
 *     in any browser, because that is mixed content.)  This client reports a scheme mismatch as "xdr_scheme_mismatch" without sending
 *     anything.  The API must also answer http requests directly: a redirect to https breaks XDR, and POST requests in general.
 *   - It reveals nothing about a response whose status is not 2xx: only onerror fires, with no status, headers, or body.  So every
 *     server error (rate_limited, too_large, storage_full, invalid_key, ...) and every network failure is reported as a KVStoreError with
 *     status 0 and code "xdr_failed", and retryAfter is unknown (0).  The one case that matters for normal use is handled: when "get" fails
 *     under XDR, getRaw (and so getEncrypted) asks "info", which answers 200 even for a missing key.  If the key does not exist, the
 *     result is null, exactly as for not_found; otherwise the original "xdr_failed" error is reported.  "info", "del", "buckets", and
 *     "phrase" succeed with 200 in all normal cases, so under XDR they only fail for rate limits, bad arguments, or network failures.
 *   - The request is sent from a setTimeout, with onprogress and ontimeout handlers set and a reference kept until it completes,
 *     which works around widely reported IE9 bugs in which XDR requests are silently aborted.
 *
 * Security.  On a page that is not a secure context, anyone who can modify the network traffic can also modify the page, including
 * this script, and so can steal the phrase.  Encryption still protects stored data from the KVStore server and anyone with its disk,
 * but not from an active attacker on the page's network path.  Serving the page over https is the real fix.  Very old browsers also
 * handle large values slowly and with a lot of memory (every byte is an Array element), so keep values small (tens of KB).
 */
(function (root)
{
	"use strict";

	var SALT = "bp2008-kv-v1";
	var PBKDF2_ITERATIONS = { standard: 600000, fast: 10000 };
	var BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
	var BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var SYNTHETIC_IV_LABEL = "bp2008-kv-v1 legacy synthetic IV";
	// Exactly the characters that /[\s\-_.,]/ matches in current engines (ES2015+ \s with current Unicode data), listed explicitly so that old engines, whose \s differs, split phrases the same way.
	var PHRASE_SEPARATORS = /[\t\n\x0b\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\-_.,]+/;

	// #region Errors
	/**
	 * An error returned by the KVStore server, or a transport failure (status 0).
	 * @param {number} status HTTP status code, or 0 if there was no readable response.
	 * @param {string} code Error code from the response, e.g. "not_found" or "rate_limited", or a transport error code such as "network_error" or "xdr_failed".
	 * @param {number} retryAfter Seconds to wait before retrying (for "rate_limited"), otherwise 0.
	 * @param {string} [message]
	 */
	function KVStoreError(status, code, retryAfter, message)
	{
		this.name = "KVStoreError";
		this.status = status;
		this.code = code;
		this.retryAfter = retryAfter || 0;
		this.message = message || ("KVStore error " + status + ": " + code + (retryAfter ? " (retry after " + retryAfter + " seconds)" : ""));
		this.stack = new Error(this.message).stack;
	}
	function ErrorPrototype() { }
	ErrorPrototype.prototype = Error.prototype;
	KVStoreError.prototype = new ErrorPrototype();
	KVStoreError.prototype.constructor = KVStoreError;

	function makeError(code, message)
	{
		var e = new Error(message);
		e.code = code;
		return e;
	}
	function decryptError()
	{
		return makeError("decrypt_failed", "Decryption failed: the phrase or key is wrong, or the data was modified.");
	}
	function transportError(code)
	{
		var messages = {
			network_error: "The KVStore request failed without a response (offline, DNS failure, or blocked by the browser).",
			timeout: "The KVStore request timed out.",
			xdr_failed: "The KVStore request failed.  XDomainRequest (IE8/IE9 cross-origin) does not report why: the server may have returned an error such as rate_limited or too_large, or the network may have failed.",
			xdr_scheme_mismatch: "IE8/IE9 can only make cross-origin requests to a URL with the same scheme as the page (an http page can only call an http API).",
			no_transport: "This browser has neither XMLHttpRequest nor XDomainRequest."
		};
		return new KVStoreError(0, code, 0, messages[code] || ("KVStore request failed: " + code));
	}
	// #endregion

	// #region Async helpers
	function now()
	{
		return new Date().getTime();
	}
	/**
	 * Runs executor(done), where done(err, result) must be called once.  Calls callback(err, result) if callback is a function, otherwise returns a Promise.  The callback is never called synchronously.
	 */
	function invoke(callback, executor)
	{
		if (typeof callback === "function")
		{
			start(executor, callback);
			return undefined;
		}
		if (typeof Promise === "undefined")
			throw new Error("KVStoreClientLegacy: this browser has no Promise, so a callback is required.");
		return new Promise(function (resolve, reject)
		{
			start(executor, function (err, result)
			{
				if (err)
					reject(err);
				else
					resolve(result);
			});
		});
	}
	function start(executor, callback)
	{
		var sync = true, called = false;
		function done(err, result)
		{
			if (called)
				return;
			called = true;
			if (sync)
				setTimeout(function () { callback(err, result); }, 0);
			else
				callback(err, result);
		}
		try
		{
			executor(done);
		}
		catch (e)
		{
			done(e);
		}
		sync = false;
	}
	function reportProgress(onProgress, fraction)
	{
		if (typeof onProgress !== "function")
			return;
		try
		{
			onProgress(fraction);
		}
		catch (e)
		{
			// Report the caller's exception without abandoning the operation.
			setTimeout(function () { throw e; }, 0);
		}
	}
	/**
	 * Returns an object whose post() schedules fn to run soon, and whose close() releases resources.  A MessageChannel is used where available, because setTimeout has a minimum delay of several milliseconds.
	 */
	function makeYielder(fn)
	{
		if (typeof MessageChannel !== "undefined")
		{
			try
			{
				var channel = new MessageChannel();
				channel.port1.onmessage = function () { fn(); };
				return {
					post: function () { channel.port2.postMessage(0); },
					close: function ()
					{
						channel.port1.onmessage = null;
						channel.port1.close();
						channel.port2.close();
					}
				};
			}
			catch (e)
			{
				// Fall through to setTimeout.
			}
		}
		return {
			post: function () { setTimeout(fn, 0); },
			close: function () { }
		};
	}
	/**
	 * Runs a job in time slices.  createJob() returns an object with step() (does a small amount of work and returns true when finished), result, and progress().  Calls done(err, job.result).
	 */
	function runJob(createJob, onProgress, done)
	{
		var job = null;
		var yielder = makeYielder(slice);
		function slice()
		{
			var finished = false, error = null;
			try
			{
				if (!job)
					job = createJob();
				var deadline = now() + (KVStoreClientLegacy.sliceMs > 0 ? KVStoreClientLegacy.sliceMs : 50);
				do
				{
					finished = job.step();
				}
				while (!finished && now() < deadline);
			}
			catch (e)
			{
				error = e || new Error("Unknown error.");
			}
			if (error || finished)
			{
				yielder.close();
				if (error)
					done(error);
				else
					done(null, job.result);
				return;
			}
			reportProgress(onProgress, job.progress());
			yielder.post();
		}
		yielder.post();
	}
	function runJobSync(job)
	{
		while (!job.step())
		{
			// Keep stepping.
		}
		return job.result;
	}
	// #endregion

	// #region Bytes, UTF-8, base64, base32
	/**
	 * Copies part of an array-like of bytes into a new plain Array.
	 */
	function sliceBytes(bytes, startIndex, endIndex)
	{
		var out = [], i;
		if (endIndex === undefined || endIndex > bytes.length)
			endIndex = bytes.length;
		for (i = startIndex; i < endIndex; i++)
			out.push(bytes[i] & 255);
		return out;
	}
	function toBytes(data)
	{
		if (typeof data === "string")
			return utf8Encode(data);
		if (data && typeof data === "object" && typeof data.length === "number")
			return data;
		throw makeError("invalid_argument", "Expected an array of bytes (or a Uint8Array) or a string.");
	}
	function codeUnitsToString(units)
	{
		var parts = [], i;
		for (i = 0; i < units.length; i += 8192)
			parts.push(String.fromCharCode.apply(null, units.slice(i, i + 8192)));
		return parts.join("");
	}
	/**
	 * Encodes a string as UTF-8, like TextEncoder: unpaired surrogates become U+FFFD.
	 * @param {string} str
	 * @returns {number[]}
	 */
	function utf8Encode(str)
	{
		var s = String(str), out = [], n = s.length, i, c, d;
		for (i = 0; i < n; i++)
		{
			c = s.charCodeAt(i);
			if (c < 0x80)
				out.push(c);
			else if (c < 0x800)
				out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
			else if (c >= 0xd800 && c <= 0xdfff)
			{
				d = i + 1 < n ? s.charCodeAt(i + 1) : 0;
				if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff)
				{
					c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
					i++;
					out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
				}
				else
					out.push(0xef, 0xbf, 0xbd);
			}
			else
				out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
		}
		return out;
	}
	/**
	 * Decodes UTF-8, like TextDecoder: a leading BOM is dropped, and each invalid sequence becomes U+FFFD (following the WHATWG Encoding Standard).
	 * @param {number[]} bytes
	 * @returns {string}
	 */
	function utf8Decode(bytes)
	{
		var units = [], n = bytes.length, i = 0, need = 0, seen = 0, cp = 0, lower = 0x80, upper = 0xbf, b;
		if (n >= 3 && (bytes[0] & 255) === 0xef && (bytes[1] & 255) === 0xbb && (bytes[2] & 255) === 0xbf)
			i = 3;
		for (; i < n; i++)
		{
			b = bytes[i] & 255;
			if (need === 0)
			{
				if (b <= 0x7f)
					units.push(b);
				else if (b >= 0xc2 && b <= 0xdf)
				{
					need = 1;
					cp = b & 0x1f;
				}
				else if (b >= 0xe0 && b <= 0xef)
				{
					if (b === 0xe0)
						lower = 0xa0;
					else if (b === 0xed)
						upper = 0x9f;
					need = 2;
					cp = b & 0xf;
				}
				else if (b >= 0xf0 && b <= 0xf4)
				{
					if (b === 0xf0)
						lower = 0x90;
					else if (b === 0xf4)
						upper = 0x8f;
					need = 3;
					cp = b & 0x7;
				}
				else
					units.push(0xfffd);
				continue;
			}
			if (b < lower || b > upper)
			{
				// Invalid continuation byte: emit U+FFFD for the incomplete sequence, then process this byte again.
				need = seen = cp = 0;
				lower = 0x80;
				upper = 0xbf;
				units.push(0xfffd);
				i--;
				continue;
			}
			lower = 0x80;
			upper = 0xbf;
			cp = (cp << 6) | (b & 0x3f);
			if (++seen === need)
			{
				if (cp > 0xffff)
				{
					cp -= 0x10000;
					units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
				}
				else
					units.push(cp);
				need = seen = cp = 0;
			}
		}
		if (need !== 0)
			units.push(0xfffd);
		return codeUnitsToString(units);
	}
	var BASE64_DECODE = [];
	(function ()
	{
		var i;
		for (i = 0; i < 128; i++)
			BASE64_DECODE[i] = -1;
		for (i = 0; i < 64; i++)
			BASE64_DECODE[BASE64_ALPHABET.charCodeAt(i)] = i;
		BASE64_DECODE[45] = 62; // "-" (URL-safe alphabet)
		BASE64_DECODE[95] = 63; // "_" (URL-safe alphabet)
	})();
	/**
	 * Base64-encodes bytes (standard alphabet, with padding).
	 * @param {number[]} bytes
	 * @returns {string}
	 */
	function bytesToBase64(bytes)
	{
		var parts = [], n = bytes.length, i, b0, b1, b2, a = BASE64_ALPHABET;
		for (i = 0; i + 2 < n; i += 3)
		{
			b0 = bytes[i] & 255;
			b1 = bytes[i + 1] & 255;
			b2 = bytes[i + 2] & 255;
			parts.push(a.charAt(b0 >> 2) + a.charAt(((b0 & 3) << 4) | (b1 >> 4)) + a.charAt(((b1 & 15) << 2) | (b2 >> 6)) + a.charAt(b2 & 63));
		}
		if (n - i === 1)
		{
			b0 = bytes[i] & 255;
			parts.push(a.charAt(b0 >> 2) + a.charAt((b0 & 3) << 4) + "==");
		}
		else if (n - i === 2)
		{
			b0 = bytes[i] & 255;
			b1 = bytes[i + 1] & 255;
			parts.push(a.charAt(b0 >> 2) + a.charAt(((b0 & 3) << 4) | (b1 >> 4)) + a.charAt((b1 & 15) << 2) + "=");
		}
		return parts.join("");
	}
	/**
	 * Decodes base64 (standard or URL-safe alphabet, padding optional, whitespace ignored).
	 * @param {string} b64
	 * @returns {number[]}
	 */
	function base64ToBytes(b64)
	{
		var s = String(b64), out = [], buffer = 0, bits = 0, i, c, v;
		for (i = 0; i < s.length; i++)
		{
			c = s.charCodeAt(i);
			if (c === 61) // "=" ends the data.
				break;
			if (c === 32 || c === 9 || c === 10 || c === 13)
				continue;
			v = c < 128 ? BASE64_DECODE[c] : -1;
			if (v < 0)
				throw makeError("invalid_base64", "Invalid base64.");
			buffer = ((buffer << 6) | v) & 0xffff;
			bits += 6;
			if (bits >= 8)
			{
				bits -= 8;
				out.push((buffer >>> bits) & 255);
			}
		}
		return out;
	}
	/**
	 * RFC 4648 base32, lower case, unpadded.
	 * @param {number[]} bytes
	 * @returns {string}
	 */
	function base32Encode(bytes)
	{
		var out = "", buffer = 0, bits = 0, i;
		for (i = 0; i < bytes.length; i++)
		{
			buffer = (buffer << 8) | (bytes[i] & 255);
			bits += 8;
			while (bits >= 5)
			{
				bits -= 5;
				out += BASE32_ALPHABET.charAt((buffer >>> bits) & 31);
			}
			buffer &= (1 << bits) - 1;
		}
		if (bits > 0)
			out += BASE32_ALPHABET.charAt((buffer << (5 - bits)) & 31);
		return out;
	}
	function readWord(b, off)
	{
		return ((b[off] & 255) << 24) | ((b[off + 1] & 255) << 16) | ((b[off + 2] & 255) << 8) | (b[off + 3] & 255);
	}
	function wordsToBytes(words)
	{
		var out = [], i, w;
		for (i = 0; i < words.length; i++)
		{
			w = words[i];
			out.push((w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255);
		}
		return out;
	}
	function hi32(n)
	{
		return Math.floor(n / 4294967296) | 0;
	}
	function lo32(n)
	{
		return (n % 4294967296) | 0;
	}
	// #endregion

	// #region SHA-256, HMAC-SHA256, PBKDF2
	var SHA256_K = [
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	];
	var SHA256_IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
	(function ()
	{
		var i;
		for (i = 0; i < 64; i++)
			SHA256_K[i] = SHA256_K[i] | 0;
		for (i = 0; i < 8; i++)
			SHA256_IV[i] = SHA256_IV[i] | 0;
	})();

	/**
	 * The SHA-256 compression function.  Reads the state from st (8 words) and the message block from w[0..15], uses w[16..63] as scratch space, and writes the new state to out (which may be st).
	 */
	function sha256Compress(st, w, out)
	{
		var a = st[0], b = st[1], c = st[2], d = st[3], e = st[4], f = st[5], g = st[6], h = st[7];
		var i, x, y, t1, t2, K = SHA256_K;
		for (i = 16; i < 64; i++)
		{
			x = w[i - 15];
			y = w[i - 2];
			w[i] = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) + w[i - 16] + w[i - 7] | 0;
		}
		for (i = 0; i < 64; i++)
		{
			t1 = h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + w[i] | 0;
			t2 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c)) | 0;
			h = g;
			g = f;
			f = e;
			e = d + t1 | 0;
			d = c;
			c = b;
			b = a;
			a = t1 + t2 | 0;
		}
		out[0] = st[0] + a | 0;
		out[1] = st[1] + b | 0;
		out[2] = st[2] + c | 0;
		out[3] = st[3] + d | 0;
		out[4] = st[4] + e | 0;
		out[5] = st[5] + f | 0;
		out[6] = st[6] + g | 0;
		out[7] = st[7] + h | 0;
	}
	function loadBlock(w, b, off)
	{
		for (var j = 0; j < 16; j++, off += 4)
			w[j] = readWord(b, off);
	}
	/**
	 * Incremental SHA-256.  Optionally starts from a state that has already processed prefixLength bytes (a multiple of 64), which is how HMAC's precomputed pad states are used.
	 */
	function Sha256(state, prefixLength)
	{
		this.h = (state || SHA256_IV).slice(0);
		this.length = prefixLength || 0;
		this.buffer = [];
		this.w = new Array(64);
	}
	Sha256.prototype.update = function (bytes, startIndex, endIndex)
	{
		var buf = this.buffer, w = this.w, i = startIndex || 0, end = endIndex === undefined ? bytes.length : endIndex;
		this.length += end - i;
		while (buf.length > 0 && i < end)
		{
			buf.push(bytes[i++] & 255);
			if (buf.length === 64)
			{
				loadBlock(w, buf, 0);
				sha256Compress(this.h, w, this.h);
				buf.length = 0;
			}
		}
		for (; i + 64 <= end; i += 64)
		{
			loadBlock(w, bytes, i);
			sha256Compress(this.h, w, this.h);
		}
		while (i < end)
			buf.push(bytes[i++] & 255);
		return this;
	};
	/**
	 * Finishes the hash and returns it as 8 words.  The object can not be used afterwards.
	 */
	Sha256.prototype.digestWords = function ()
	{
		var total = this.length, r = total % 64, zeros = r < 56 ? 55 - r : 119 - r, pad = [0x80], i;
		for (i = 0; i < zeros; i++)
			pad.push(0);
		pad = pad.concat(wordsToBytes([hi32(total * 8), lo32(total * 8)]));
		this.update(pad);
		return this.h.slice(0);
	};
	function sha256(bytes)
	{
		return wordsToBytes(new Sha256().update(bytes).digestWords());
	}
	/**
	 * Returns the SHA-256 states after processing the HMAC key XOR ipad and XOR opad, so each HMAC computation with this key skips those two blocks.
	 */
	function hmacStates(key)
	{
		var k = key.length > 64 ? sha256(key) : key, ipad = [], opad = [], i, b, w = new Array(64);
		var si = SHA256_IV.slice(0), so = SHA256_IV.slice(0);
		for (i = 0; i < 64; i++)
		{
			b = i < k.length ? k[i] & 255 : 0;
			ipad.push(b ^ 0x36);
			opad.push(b ^ 0x5c);
		}
		loadBlock(w, ipad, 0);
		sha256Compress(si, w, si);
		loadBlock(w, opad, 0);
		sha256Compress(so, w, so);
		return { inner: si, outer: so };
	}
	function hmacFinish(states, innerHash)
	{
		return new Sha256(states.outer, 64).update(wordsToBytes(innerHash.digestWords())).digestWords();
	}
	function hmacSha256(key, message)
	{
		var states = hmacStates(key);
		return wordsToBytes(hmacFinish(states, new Sha256(states.inner, 64).update(message)));
	}

	/**
	 * PBKDF2-HMAC-SHA256 as a time-sliceable job.  Each block's first iteration uses Sha256.  The rest, which are almost all of the work, run in Pbkdf2Loop.
	 */
	function Pbkdf2Job(password, salt, iterations, dkLen)
	{
		var states = hmacStates(password), si = states.inner, so = states.outer;
		this.states = states;
		this.salt = sliceBytes(salt, 0);
		this.iterations = iterations;
		this.dkLen = dkLen;
		this.blocks = Math.ceil(dkLen / 32);
		this.block = 0;
		this.iteration = 0;
		this.output = [];
		this.result = null;
		this.loop = Pbkdf2Loop();
		this.loop.setPads(si[0], si[1], si[2], si[3], si[4], si[5], si[6], si[7], so[0], so[1], so[2], so[3], so[4], so[5], so[6], so[7]);
	}
	Pbkdf2Job.prototype.step = function ()
	{
		var loop = this.loop, u, end;
		if (this.iteration === 0)
		{
			// U1 = HMAC(password, salt + INT32BE(block number)).
			u = hmacFinish(this.states, new Sha256(this.states.inner, 64).update(this.salt).update(wordsToBytes([this.block + 1])));
			loop.setFirst(u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7]);
			this.iteration = 1;
		}
		end = Math.min(this.iteration + 256, this.iterations);
		loop.iterate(end - this.iteration);
		this.iteration = end;
		if (end < this.iterations)
			return false;
		this.output = this.output.concat(wordsToBytes([loop.result(0), loop.result(1), loop.result(2), loop.result(3), loop.result(4), loop.result(5), loop.result(6), loop.result(7)]));
		this.block++;
		this.iteration = 0;
		if (this.block < this.blocks)
			return false;
		this.result = this.output.slice(0, this.dkLen);
		return true;
	};
	Pbkdf2Job.prototype.progress = function ()
	{
		return (this.block * this.iterations + this.iteration) / (this.blocks * this.iterations);
	};
	// #endregion

	// #region PBKDF2 inner loop (asm.js, from asmcrypto.js)
	/*
	 * Pbkdf2Loop is derived from the SHA-256 module of asmcrypto.js 0.22.0 (src/hash/sha256/sha256.asm.js, https://github.com/asmcrypto/asmcrypto.js).
	 * _core is copied unchanged except for indentation and brace placement.  The iteration loop is pbkdf2_generate_block's, split into
	 * functions so that the work can be time sliced, and without the heap (typed array), so it also runs in browsers without typed arrays.
	 * _core is fully unrolled and keeps everything in local variables, which makes it much faster than sha256Compress (about 2.6 times in
	 * V8 and 6 times in IE's Chakra).  Where the engine compiles asm.js ahead of time, as Node 24's V8 does, it is faster again.
	 *
	 * The MIT License (MIT)
	 *
	 * Copyright (c) 2013 Artem S Vybornov
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy of
	 * this software and associated documentation files (the "Software"), to deal in
	 * the Software without restriction, including without limitation the rights to
	 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
	 * the Software, and to permit persons to whom the Software is furnished to do so,
	 * subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in all
	 * copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
	 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
	 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
	 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
	 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	 */
	function Pbkdf2Loop()
	{
		"use asm";

		// SHA256 state
		var H0 = 0, H1 = 0, H2 = 0, H3 = 0, H4 = 0, H5 = 0, H6 = 0, H7 = 0;

		// HMAC state: the SHA-256 states after the inner and outer pad blocks
		var I0 = 0, I1 = 0, I2 = 0, I3 = 0, I4 = 0, I5 = 0, I6 = 0, I7 = 0,
			O0 = 0, O1 = 0, O2 = 0, O3 = 0, O4 = 0, O5 = 0, O6 = 0, O7 = 0;

		// PBKDF2 state: the latest U, and the XOR of every U so far
		var U0 = 0, U1 = 0, U2 = 0, U3 = 0, U4 = 0, U5 = 0, U6 = 0, U7 = 0,
			X0 = 0, X1 = 0, X2 = 0, X3 = 0, X4 = 0, X5 = 0, X6 = 0, X7 = 0;

		function _core(w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, w11, w12, w13, w14, w15)
		{
			w0 = w0|0;
			w1 = w1|0;
			w2 = w2|0;
			w3 = w3|0;
			w4 = w4|0;
			w5 = w5|0;
			w6 = w6|0;
			w7 = w7|0;
			w8 = w8|0;
			w9 = w9|0;
			w10 = w10|0;
			w11 = w11|0;
			w12 = w12|0;
			w13 = w13|0;
			w14 = w14|0;
			w15 = w15|0;

			var a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0;

			a = H0;
			b = H1;
			c = H2;
			d = H3;
			e = H4;
			f = H5;
			g = H6;
			h = H7;

			// 0
			h = ( w0 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0x428a2f98 )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 1
			g = ( w1 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0x71374491 )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 2
			f = ( w2 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0xb5c0fbcf )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 3
			e = ( w3 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0xe9b5dba5 )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 4
			d = ( w4 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0x3956c25b )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 5
			c = ( w5 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0x59f111f1 )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 6
			b = ( w6 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0x923f82a4 )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 7
			a = ( w7 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0xab1c5ed5 )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			// 8
			h = ( w8 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0xd807aa98 )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 9
			g = ( w9 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0x12835b01 )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 10
			f = ( w10 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0x243185be )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 11
			e = ( w11 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0x550c7dc3 )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 12
			d = ( w12 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0x72be5d74 )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 13
			c = ( w13 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0x80deb1fe )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 14
			b = ( w14 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0x9bdc06a7 )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 15
			a = ( w15 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0xc19bf174 )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			// 16
			w0 = ( ( w1>>>7  ^ w1>>>18 ^ w1>>>3  ^ w1<<25 ^ w1<<14 ) + ( w14>>>17 ^ w14>>>19 ^ w14>>>10 ^ w14<<15 ^ w14<<13 ) + w0 + w9 )|0;
			h = ( w0 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0xe49b69c1 )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 17
			w1 = ( ( w2>>>7  ^ w2>>>18 ^ w2>>>3  ^ w2<<25 ^ w2<<14 ) + ( w15>>>17 ^ w15>>>19 ^ w15>>>10 ^ w15<<15 ^ w15<<13 ) + w1 + w10 )|0;
			g = ( w1 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0xefbe4786 )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 18
			w2 = ( ( w3>>>7  ^ w3>>>18 ^ w3>>>3  ^ w3<<25 ^ w3<<14 ) + ( w0>>>17 ^ w0>>>19 ^ w0>>>10 ^ w0<<15 ^ w0<<13 ) + w2 + w11 )|0;
			f = ( w2 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0x0fc19dc6 )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 19
			w3 = ( ( w4>>>7  ^ w4>>>18 ^ w4>>>3  ^ w4<<25 ^ w4<<14 ) + ( w1>>>17 ^ w1>>>19 ^ w1>>>10 ^ w1<<15 ^ w1<<13 ) + w3 + w12 )|0;
			e = ( w3 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0x240ca1cc )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 20
			w4 = ( ( w5>>>7  ^ w5>>>18 ^ w5>>>3  ^ w5<<25 ^ w5<<14 ) + ( w2>>>17 ^ w2>>>19 ^ w2>>>10 ^ w2<<15 ^ w2<<13 ) + w4 + w13 )|0;
			d = ( w4 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0x2de92c6f )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 21
			w5 = ( ( w6>>>7  ^ w6>>>18 ^ w6>>>3  ^ w6<<25 ^ w6<<14 ) + ( w3>>>17 ^ w3>>>19 ^ w3>>>10 ^ w3<<15 ^ w3<<13 ) + w5 + w14 )|0;
			c = ( w5 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0x4a7484aa )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 22
			w6 = ( ( w7>>>7  ^ w7>>>18 ^ w7>>>3  ^ w7<<25 ^ w7<<14 ) + ( w4>>>17 ^ w4>>>19 ^ w4>>>10 ^ w4<<15 ^ w4<<13 ) + w6 + w15 )|0;
			b = ( w6 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0x5cb0a9dc )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 23
			w7 = ( ( w8>>>7  ^ w8>>>18 ^ w8>>>3  ^ w8<<25 ^ w8<<14 ) + ( w5>>>17 ^ w5>>>19 ^ w5>>>10 ^ w5<<15 ^ w5<<13 ) + w7 + w0 )|0;
			a = ( w7 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0x76f988da )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			// 24
			w8 = ( ( w9>>>7  ^ w9>>>18 ^ w9>>>3  ^ w9<<25 ^ w9<<14 ) + ( w6>>>17 ^ w6>>>19 ^ w6>>>10 ^ w6<<15 ^ w6<<13 ) + w8 + w1 )|0;
			h = ( w8 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0x983e5152 )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 25
			w9 = ( ( w10>>>7  ^ w10>>>18 ^ w10>>>3  ^ w10<<25 ^ w10<<14 ) + ( w7>>>17 ^ w7>>>19 ^ w7>>>10 ^ w7<<15 ^ w7<<13 ) + w9 + w2 )|0;
			g = ( w9 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0xa831c66d )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 26
			w10 = ( ( w11>>>7  ^ w11>>>18 ^ w11>>>3  ^ w11<<25 ^ w11<<14 ) + ( w8>>>17 ^ w8>>>19 ^ w8>>>10 ^ w8<<15 ^ w8<<13 ) + w10 + w3 )|0;
			f = ( w10 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0xb00327c8 )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 27
			w11 = ( ( w12>>>7  ^ w12>>>18 ^ w12>>>3  ^ w12<<25 ^ w12<<14 ) + ( w9>>>17 ^ w9>>>19 ^ w9>>>10 ^ w9<<15 ^ w9<<13 ) + w11 + w4 )|0;
			e = ( w11 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0xbf597fc7 )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 28
			w12 = ( ( w13>>>7  ^ w13>>>18 ^ w13>>>3  ^ w13<<25 ^ w13<<14 ) + ( w10>>>17 ^ w10>>>19 ^ w10>>>10 ^ w10<<15 ^ w10<<13 ) + w12 + w5 )|0;
			d = ( w12 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0xc6e00bf3 )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 29
			w13 = ( ( w14>>>7  ^ w14>>>18 ^ w14>>>3  ^ w14<<25 ^ w14<<14 ) + ( w11>>>17 ^ w11>>>19 ^ w11>>>10 ^ w11<<15 ^ w11<<13 ) + w13 + w6 )|0;
			c = ( w13 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0xd5a79147 )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 30
			w14 = ( ( w15>>>7  ^ w15>>>18 ^ w15>>>3  ^ w15<<25 ^ w15<<14 ) + ( w12>>>17 ^ w12>>>19 ^ w12>>>10 ^ w12<<15 ^ w12<<13 ) + w14 + w7 )|0;
			b = ( w14 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0x06ca6351 )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 31
			w15 = ( ( w0>>>7  ^ w0>>>18 ^ w0>>>3  ^ w0<<25 ^ w0<<14 ) + ( w13>>>17 ^ w13>>>19 ^ w13>>>10 ^ w13<<15 ^ w13<<13 ) + w15 + w8 )|0;
			a = ( w15 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0x14292967 )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			// 32
			w0 = ( ( w1>>>7  ^ w1>>>18 ^ w1>>>3  ^ w1<<25 ^ w1<<14 ) + ( w14>>>17 ^ w14>>>19 ^ w14>>>10 ^ w14<<15 ^ w14<<13 ) + w0 + w9 )|0;
			h = ( w0 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0x27b70a85 )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 33
			w1 = ( ( w2>>>7  ^ w2>>>18 ^ w2>>>3  ^ w2<<25 ^ w2<<14 ) + ( w15>>>17 ^ w15>>>19 ^ w15>>>10 ^ w15<<15 ^ w15<<13 ) + w1 + w10 )|0;
			g = ( w1 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0x2e1b2138 )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 34
			w2 = ( ( w3>>>7  ^ w3>>>18 ^ w3>>>3  ^ w3<<25 ^ w3<<14 ) + ( w0>>>17 ^ w0>>>19 ^ w0>>>10 ^ w0<<15 ^ w0<<13 ) + w2 + w11 )|0;
			f = ( w2 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0x4d2c6dfc )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 35
			w3 = ( ( w4>>>7  ^ w4>>>18 ^ w4>>>3  ^ w4<<25 ^ w4<<14 ) + ( w1>>>17 ^ w1>>>19 ^ w1>>>10 ^ w1<<15 ^ w1<<13 ) + w3 + w12 )|0;
			e = ( w3 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0x53380d13 )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 36
			w4 = ( ( w5>>>7  ^ w5>>>18 ^ w5>>>3  ^ w5<<25 ^ w5<<14 ) + ( w2>>>17 ^ w2>>>19 ^ w2>>>10 ^ w2<<15 ^ w2<<13 ) + w4 + w13 )|0;
			d = ( w4 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0x650a7354 )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 37
			w5 = ( ( w6>>>7  ^ w6>>>18 ^ w6>>>3  ^ w6<<25 ^ w6<<14 ) + ( w3>>>17 ^ w3>>>19 ^ w3>>>10 ^ w3<<15 ^ w3<<13 ) + w5 + w14 )|0;
			c = ( w5 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0x766a0abb )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 38
			w6 = ( ( w7>>>7  ^ w7>>>18 ^ w7>>>3  ^ w7<<25 ^ w7<<14 ) + ( w4>>>17 ^ w4>>>19 ^ w4>>>10 ^ w4<<15 ^ w4<<13 ) + w6 + w15 )|0;
			b = ( w6 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0x81c2c92e )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 39
			w7 = ( ( w8>>>7  ^ w8>>>18 ^ w8>>>3  ^ w8<<25 ^ w8<<14 ) + ( w5>>>17 ^ w5>>>19 ^ w5>>>10 ^ w5<<15 ^ w5<<13 ) + w7 + w0 )|0;
			a = ( w7 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0x92722c85 )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			// 40
			w8 = ( ( w9>>>7  ^ w9>>>18 ^ w9>>>3  ^ w9<<25 ^ w9<<14 ) + ( w6>>>17 ^ w6>>>19 ^ w6>>>10 ^ w6<<15 ^ w6<<13 ) + w8 + w1 )|0;
			h = ( w8 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0xa2bfe8a1 )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 41
			w9 = ( ( w10>>>7  ^ w10>>>18 ^ w10>>>3  ^ w10<<25 ^ w10<<14 ) + ( w7>>>17 ^ w7>>>19 ^ w7>>>10 ^ w7<<15 ^ w7<<13 ) + w9 + w2 )|0;
			g = ( w9 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0xa81a664b )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 42
			w10 = ( ( w11>>>7  ^ w11>>>18 ^ w11>>>3  ^ w11<<25 ^ w11<<14 ) + ( w8>>>17 ^ w8>>>19 ^ w8>>>10 ^ w8<<15 ^ w8<<13 ) + w10 + w3 )|0;
			f = ( w10 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0xc24b8b70 )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 43
			w11 = ( ( w12>>>7  ^ w12>>>18 ^ w12>>>3  ^ w12<<25 ^ w12<<14 ) + ( w9>>>17 ^ w9>>>19 ^ w9>>>10 ^ w9<<15 ^ w9<<13 ) + w11 + w4 )|0;
			e = ( w11 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0xc76c51a3 )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 44
			w12 = ( ( w13>>>7  ^ w13>>>18 ^ w13>>>3  ^ w13<<25 ^ w13<<14 ) + ( w10>>>17 ^ w10>>>19 ^ w10>>>10 ^ w10<<15 ^ w10<<13 ) + w12 + w5 )|0;
			d = ( w12 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0xd192e819 )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 45
			w13 = ( ( w14>>>7  ^ w14>>>18 ^ w14>>>3  ^ w14<<25 ^ w14<<14 ) + ( w11>>>17 ^ w11>>>19 ^ w11>>>10 ^ w11<<15 ^ w11<<13 ) + w13 + w6 )|0;
			c = ( w13 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0xd6990624 )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 46
			w14 = ( ( w15>>>7  ^ w15>>>18 ^ w15>>>3  ^ w15<<25 ^ w15<<14 ) + ( w12>>>17 ^ w12>>>19 ^ w12>>>10 ^ w12<<15 ^ w12<<13 ) + w14 + w7 )|0;
			b = ( w14 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0xf40e3585 )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 47
			w15 = ( ( w0>>>7  ^ w0>>>18 ^ w0>>>3  ^ w0<<25 ^ w0<<14 ) + ( w13>>>17 ^ w13>>>19 ^ w13>>>10 ^ w13<<15 ^ w13<<13 ) + w15 + w8 )|0;
			a = ( w15 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0x106aa070 )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			// 48
			w0 = ( ( w1>>>7  ^ w1>>>18 ^ w1>>>3  ^ w1<<25 ^ w1<<14 ) + ( w14>>>17 ^ w14>>>19 ^ w14>>>10 ^ w14<<15 ^ w14<<13 ) + w0 + w9 )|0;
			h = ( w0 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0x19a4c116 )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 49
			w1 = ( ( w2>>>7  ^ w2>>>18 ^ w2>>>3  ^ w2<<25 ^ w2<<14 ) + ( w15>>>17 ^ w15>>>19 ^ w15>>>10 ^ w15<<15 ^ w15<<13 ) + w1 + w10 )|0;
			g = ( w1 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0x1e376c08 )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 50
			w2 = ( ( w3>>>7  ^ w3>>>18 ^ w3>>>3  ^ w3<<25 ^ w3<<14 ) + ( w0>>>17 ^ w0>>>19 ^ w0>>>10 ^ w0<<15 ^ w0<<13 ) + w2 + w11 )|0;
			f = ( w2 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0x2748774c )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 51
			w3 = ( ( w4>>>7  ^ w4>>>18 ^ w4>>>3  ^ w4<<25 ^ w4<<14 ) + ( w1>>>17 ^ w1>>>19 ^ w1>>>10 ^ w1<<15 ^ w1<<13 ) + w3 + w12 )|0;
			e = ( w3 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0x34b0bcb5 )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 52
			w4 = ( ( w5>>>7  ^ w5>>>18 ^ w5>>>3  ^ w5<<25 ^ w5<<14 ) + ( w2>>>17 ^ w2>>>19 ^ w2>>>10 ^ w2<<15 ^ w2<<13 ) + w4 + w13 )|0;
			d = ( w4 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0x391c0cb3 )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 53
			w5 = ( ( w6>>>7  ^ w6>>>18 ^ w6>>>3  ^ w6<<25 ^ w6<<14 ) + ( w3>>>17 ^ w3>>>19 ^ w3>>>10 ^ w3<<15 ^ w3<<13 ) + w5 + w14 )|0;
			c = ( w5 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0x4ed8aa4a )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 54
			w6 = ( ( w7>>>7  ^ w7>>>18 ^ w7>>>3  ^ w7<<25 ^ w7<<14 ) + ( w4>>>17 ^ w4>>>19 ^ w4>>>10 ^ w4<<15 ^ w4<<13 ) + w6 + w15 )|0;
			b = ( w6 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0x5b9cca4f )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 55
			w7 = ( ( w8>>>7  ^ w8>>>18 ^ w8>>>3  ^ w8<<25 ^ w8<<14 ) + ( w5>>>17 ^ w5>>>19 ^ w5>>>10 ^ w5<<15 ^ w5<<13 ) + w7 + w0 )|0;
			a = ( w7 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0x682e6ff3 )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			// 56
			w8 = ( ( w9>>>7  ^ w9>>>18 ^ w9>>>3  ^ w9<<25 ^ w9<<14 ) + ( w6>>>17 ^ w6>>>19 ^ w6>>>10 ^ w6<<15 ^ w6<<13 ) + w8 + w1 )|0;
			h = ( w8 + h + ( e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7 ) +  ( g ^ e & (f^g) ) + 0x748f82ee )|0;
			d = ( d + h )|0;
			h = ( h + ( (a & b) ^ ( c & (a ^ b) ) ) + ( a>>>2 ^ a>>>13 ^ a>>>22 ^ a<<30 ^ a<<19 ^ a<<10 ) )|0;

			// 57
			w9 = ( ( w10>>>7  ^ w10>>>18 ^ w10>>>3  ^ w10<<25 ^ w10<<14 ) + ( w7>>>17 ^ w7>>>19 ^ w7>>>10 ^ w7<<15 ^ w7<<13 ) + w9 + w2 )|0;
			g = ( w9 + g + ( d>>>6 ^ d>>>11 ^ d>>>25 ^ d<<26 ^ d<<21 ^ d<<7 ) +  ( f ^ d & (e^f) ) + 0x78a5636f )|0;
			c = ( c + g )|0;
			g = ( g + ( (h & a) ^ ( b & (h ^ a) ) ) + ( h>>>2 ^ h>>>13 ^ h>>>22 ^ h<<30 ^ h<<19 ^ h<<10 ) )|0;

			// 58
			w10 = ( ( w11>>>7  ^ w11>>>18 ^ w11>>>3  ^ w11<<25 ^ w11<<14 ) + ( w8>>>17 ^ w8>>>19 ^ w8>>>10 ^ w8<<15 ^ w8<<13 ) + w10 + w3 )|0;
			f = ( w10 + f + ( c>>>6 ^ c>>>11 ^ c>>>25 ^ c<<26 ^ c<<21 ^ c<<7 ) +  ( e ^ c & (d^e) ) + 0x84c87814 )|0;
			b = ( b + f )|0;
			f = ( f + ( (g & h) ^ ( a & (g ^ h) ) ) + ( g>>>2 ^ g>>>13 ^ g>>>22 ^ g<<30 ^ g<<19 ^ g<<10 ) )|0;

			// 59
			w11 = ( ( w12>>>7  ^ w12>>>18 ^ w12>>>3  ^ w12<<25 ^ w12<<14 ) + ( w9>>>17 ^ w9>>>19 ^ w9>>>10 ^ w9<<15 ^ w9<<13 ) + w11 + w4 )|0;
			e = ( w11 + e + ( b>>>6 ^ b>>>11 ^ b>>>25 ^ b<<26 ^ b<<21 ^ b<<7 ) +  ( d ^ b & (c^d) ) + 0x8cc70208 )|0;
			a = ( a + e )|0;
			e = ( e + ( (f & g) ^ ( h & (f ^ g) ) ) + ( f>>>2 ^ f>>>13 ^ f>>>22 ^ f<<30 ^ f<<19 ^ f<<10 ) )|0;

			// 60
			w12 = ( ( w13>>>7  ^ w13>>>18 ^ w13>>>3  ^ w13<<25 ^ w13<<14 ) + ( w10>>>17 ^ w10>>>19 ^ w10>>>10 ^ w10<<15 ^ w10<<13 ) + w12 + w5 )|0;
			d = ( w12 + d + ( a>>>6 ^ a>>>11 ^ a>>>25 ^ a<<26 ^ a<<21 ^ a<<7 ) +  ( c ^ a & (b^c) ) + 0x90befffa )|0;
			h = ( h + d )|0;
			d = ( d + ( (e & f) ^ ( g & (e ^ f) ) ) + ( e>>>2 ^ e>>>13 ^ e>>>22 ^ e<<30 ^ e<<19 ^ e<<10 ) )|0;

			// 61
			w13 = ( ( w14>>>7  ^ w14>>>18 ^ w14>>>3  ^ w14<<25 ^ w14<<14 ) + ( w11>>>17 ^ w11>>>19 ^ w11>>>10 ^ w11<<15 ^ w11<<13 ) + w13 + w6 )|0;
			c = ( w13 + c + ( h>>>6 ^ h>>>11 ^ h>>>25 ^ h<<26 ^ h<<21 ^ h<<7 ) +  ( b ^ h & (a^b) ) + 0xa4506ceb )|0;
			g = ( g + c )|0;
			c = ( c + ( (d & e) ^ ( f & (d ^ e) ) ) + ( d>>>2 ^ d>>>13 ^ d>>>22 ^ d<<30 ^ d<<19 ^ d<<10 ) )|0;

			// 62
			w14 = ( ( w15>>>7  ^ w15>>>18 ^ w15>>>3  ^ w15<<25 ^ w15<<14 ) + ( w12>>>17 ^ w12>>>19 ^ w12>>>10 ^ w12<<15 ^ w12<<13 ) + w14 + w7 )|0;
			b = ( w14 + b + ( g>>>6 ^ g>>>11 ^ g>>>25 ^ g<<26 ^ g<<21 ^ g<<7 ) +  ( a ^ g & (h^a) ) + 0xbef9a3f7 )|0;
			f = ( f + b )|0;
			b = ( b + ( (c & d) ^ ( e & (c ^ d) ) ) + ( c>>>2 ^ c>>>13 ^ c>>>22 ^ c<<30 ^ c<<19 ^ c<<10 ) )|0;

			// 63
			w15 = ( ( w0>>>7  ^ w0>>>18 ^ w0>>>3  ^ w0<<25 ^ w0<<14 ) + ( w13>>>17 ^ w13>>>19 ^ w13>>>10 ^ w13<<15 ^ w13<<13 ) + w15 + w8 )|0;
			a = ( w15 + a + ( f>>>6 ^ f>>>11 ^ f>>>25 ^ f<<26 ^ f<<21 ^ f<<7 ) +  ( h ^ f & (g^h) ) + 0xc67178f2 )|0;
			e = ( e + a )|0;
			a = ( a + ( (b & c) ^ ( d & (b ^ c) ) ) + ( b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10 ) )|0;

			H0 = ( H0 + a )|0;
			H1 = ( H1 + b )|0;
			H2 = ( H2 + c )|0;
			H3 = ( H3 + d )|0;
			H4 = ( H4 + e )|0;
			H5 = ( H5 + f )|0;
			H6 = ( H6 + g )|0;
			H7 = ( H7 + h )|0;
		}

		/**
		 * Sets the HMAC key's inner and outer pad states.
		 */
		function setPads(i0, i1, i2, i3, i4, i5, i6, i7, o0, o1, o2, o3, o4, o5, o6, o7)
		{
			i0 = i0 | 0;
			i1 = i1 | 0;
			i2 = i2 | 0;
			i3 = i3 | 0;
			i4 = i4 | 0;
			i5 = i5 | 0;
			i6 = i6 | 0;
			i7 = i7 | 0;
			o0 = o0 | 0;
			o1 = o1 | 0;
			o2 = o2 | 0;
			o3 = o3 | 0;
			o4 = o4 | 0;
			o5 = o5 | 0;
			o6 = o6 | 0;
			o7 = o7 | 0;

			I0 = i0; I1 = i1; I2 = i2; I3 = i3; I4 = i4; I5 = i5; I6 = i6; I7 = i7;
			O0 = o0; O1 = o1; O2 = o2; O3 = o3; O4 = o4; O5 = o5; O6 = o6; O7 = o7;
		}

		/**
		 * Starts a block with its first iteration's output, U1.
		 */
		function setFirst(u0, u1, u2, u3, u4, u5, u6, u7)
		{
			u0 = u0 | 0;
			u1 = u1 | 0;
			u2 = u2 | 0;
			u3 = u3 | 0;
			u4 = u4 | 0;
			u5 = u5 | 0;
			u6 = u6 | 0;
			u7 = u7 | 0;

			U0 = u0; U1 = u1; U2 = u2; U3 = u3; U4 = u4; U5 = u5; U6 = u6; U7 = u7;
			X0 = u0; X1 = u1; X2 = u2; X3 = u3; X4 = u4; X5 = u5; X6 = u6; X7 = u7;
		}

		/**
		 * Performs count more iterations: U = HMAC(password, U), X = X xor U.  Each HMAC is two compressions of one block, because U is 32 bytes.
		 */
		function iterate(count)
		{
			count = count | 0;

			var t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0, t7 = 0,
				x0 = 0, x1 = 0, x2 = 0, x3 = 0, x4 = 0, x5 = 0, x6 = 0, x7 = 0;

			t0 = U0; t1 = U1; t2 = U2; t3 = U3; t4 = U4; t5 = U5; t6 = U6; t7 = U7;
			x0 = X0; x1 = X1; x2 = X2; x3 = X3; x4 = X4; x5 = X5; x6 = X6; x7 = X7;

			while ((count | 0) > 0)
			{
				H0 = I0; H1 = I1; H2 = I2; H3 = I3; H4 = I4; H5 = I5; H6 = I6; H7 = I7;
				_core(t0, t1, t2, t3, t4, t5, t6, t7, 0x80000000, 0, 0, 0, 0, 0, 0, 768);
				t0 = H0; t1 = H1; t2 = H2; t3 = H3; t4 = H4; t5 = H5; t6 = H6; t7 = H7;

				H0 = O0; H1 = O1; H2 = O2; H3 = O3; H4 = O4; H5 = O5; H6 = O6; H7 = O7;
				_core(t0, t1, t2, t3, t4, t5, t6, t7, 0x80000000, 0, 0, 0, 0, 0, 0, 768);
				t0 = H0; t1 = H1; t2 = H2; t3 = H3; t4 = H4; t5 = H5; t6 = H6; t7 = H7;

				x0 = x0 ^ t0;
				x1 = x1 ^ t1;
				x2 = x2 ^ t2;
				x3 = x3 ^ t3;
				x4 = x4 ^ t4;
				x5 = x5 ^ t5;
				x6 = x6 ^ t6;
				x7 = x7 ^ t7;

				count = count - 1 | 0;
			}

			U0 = t0; U1 = t1; U2 = t2; U3 = t3; U4 = t4; U5 = t5; U6 = t6; U7 = t7;
			X0 = x0; X1 = x1; X2 = x2; X3 = x3; X4 = x4; X5 = x5; X6 = x6; X7 = x7;
		}

		/**
		 * Returns word i (0 to 7) of the block's output so far, the XOR of every U.
		 */
		function result(i)
		{
			i = i | 0;

			switch (i | 0)
			{
				case 0:
					return X0 | 0;
				case 1:
					return X1 | 0;
				case 2:
					return X2 | 0;
				case 3:
					return X3 | 0;
				case 4:
					return X4 | 0;
				case 5:
					return X5 | 0;
				case 6:
					return X6 | 0;
				case 7:
					return X7 | 0;
			}
			return 0;
		}

		return {
			setPads: setPads,
			setFirst: setFirst,
			iterate: iterate,
			result: result
		};
	}
	// #endregion

	// #region AES-256 (encryption only) and GCM
	var AES_SBOX = [], AES_T0 = [], AES_T1 = [], AES_T2 = [], AES_T3 = [];
	function xtime(x)
	{
		return ((x << 1) ^ ((x & 0x80) ? 0x11b : 0)) & 255;
	}
	(function ()
	{
		// Build the S-box from GF(2^8) inverses and the affine transform, then the combined SubBytes/ShiftRows/MixColumns tables.
		var exp = [], log = [], x = 1, i, inv, s, s2, t;
		for (i = 0; i < 255; i++)
		{
			exp[i] = x;
			log[x] = i;
			x ^= xtime(x); // Multiply by the generator 3.
		}
		for (i = 0; i < 256; i++)
		{
			inv = i === 0 ? 0 : exp[(255 - log[i]) % 255];
			// The affine transform: inv XOR inv rotated left by 1, 2, 3, and 4 bits, XOR 0x63.  Folding the bits shifted past bit 7 back into the low byte performs the rotations.
			s = inv ^ (inv << 1) ^ (inv << 2) ^ (inv << 3) ^ (inv << 4);
			s = (s >> 8) ^ (s & 255) ^ 0x63;
			AES_SBOX[i] = s;
			s2 = xtime(s);
			t = (s2 << 24) | (s << 16) | (s << 8) | (s2 ^ s);
			AES_T0[i] = t;
			AES_T1[i] = (t >>> 8) | (t << 24);
			AES_T2[i] = (t >>> 16) | (t << 16);
			AES_T3[i] = (t >>> 24) | (t << 8);
		}
	})();
	function aesSubWord(t)
	{
		var S = AES_SBOX;
		return (S[t >>> 24] << 24) | (S[(t >>> 16) & 255] << 16) | (S[(t >>> 8) & 255] << 8) | S[t & 255];
	}
	/**
	 * AES-256 key expansion: 32 key bytes to 60 round key words.
	 */
	function aesExpandKey(key)
	{
		var w = [], i, t, rcon = 1;
		for (i = 0; i < 8; i++)
			w[i] = readWord(key, i * 4);
		for (i = 8; i < 60; i++)
		{
			t = w[i - 1];
			if (i % 8 === 0)
			{
				t = aesSubWord((t << 8) | (t >>> 24)) ^ (rcon << 24);
				rcon = xtime(rcon);
			}
			else if (i % 8 === 4)
				t = aesSubWord(t);
			w[i] = w[i - 8] ^ t;
		}
		return w;
	}
	/**
	 * Encrypts one block (4 big-endian words) with AES-256, writing 4 words to out.
	 */
	function aesEncryptBlock(rk, s0, s1, s2, s3, out)
	{
		var T0 = AES_T0, T1 = AES_T1, T2 = AES_T2, T3 = AES_T3, S = AES_SBOX, t0, t1, t2, t3, k, r;
		s0 ^= rk[0];
		s1 ^= rk[1];
		s2 ^= rk[2];
		s3 ^= rk[3];
		for (r = 1, k = 4; r < 14; r++, k += 4)
		{
			t0 = T0[s0 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s3 & 255] ^ rk[k];
			t1 = T0[s1 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s0 & 255] ^ rk[k + 1];
			t2 = T0[s2 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s1 & 255] ^ rk[k + 2];
			t3 = T0[s3 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s2 & 255] ^ rk[k + 3];
			s0 = t0;
			s1 = t1;
			s2 = t2;
			s3 = t3;
		}
		out[0] = ((S[s0 >>> 24] << 24) | (S[(s1 >>> 16) & 255] << 16) | (S[(s2 >>> 8) & 255] << 8) | S[s3 & 255]) ^ rk[56];
		out[1] = ((S[s1 >>> 24] << 24) | (S[(s2 >>> 16) & 255] << 16) | (S[(s3 >>> 8) & 255] << 8) | S[s0 & 255]) ^ rk[57];
		out[2] = ((S[s2 >>> 24] << 24) | (S[(s3 >>> 16) & 255] << 16) | (S[(s0 >>> 8) & 255] << 8) | S[s1 & 255]) ^ rk[58];
		out[3] = ((S[s3 >>> 24] << 24) | (S[(s0 >>> 16) & 255] << 16) | (S[(s1 >>> 8) & 255] << 8) | S[s2 & 255]) ^ rk[59];
	}

	// GHASH reduction constants for shifting 4 bits out of the low end of a block (the GCM polynomial, in GCM's reflected bit order).
	var GHASH_R4 = [0x0000, 0x1c20, 0x3840, 0x2460, 0x7080, 0x6ca0, 0x48c0, 0x54e0, 0xe100, 0xfd20, 0xd940, 0xc560, 0x9180, 0x8da0, 0xa9c0, 0xb5e0];
	(function ()
	{
		for (var i = 0; i < 16; i++)
			GHASH_R4[i] = GHASH_R4[i] << 16;
	})();
	/**
	 * Returns the block multiplied by x in GCM's field (a right shift in GCM's bit order).
	 */
	function ghashMulX(v)
	{
		var r = [v[0] >>> 1, (v[1] >>> 1) | (v[0] << 31), (v[2] >>> 1) | (v[1] << 31), (v[3] >>> 1) | (v[2] << 31)];
		if (v[3] & 1)
			r[0] ^= 0xe1000000;
		return r;
	}
	/**
	 * Precomputes H times every 4-bit value (Shoup's method), as four arrays of words.
	 */
	function ghashTables(h)
	{
		var basis = [], m0 = [], m1 = [], m2 = [], m3 = [], i, bit, a0, a1, a2, a3;
		basis[8] = [h[0] | 0, h[1] | 0, h[2] | 0, h[3] | 0];
		basis[4] = ghashMulX(basis[8]);
		basis[2] = ghashMulX(basis[4]);
		basis[1] = ghashMulX(basis[2]);
		for (i = 0; i < 16; i++)
		{
			a0 = a1 = a2 = a3 = 0;
			for (bit = 8; bit >= 1; bit >>= 1)
			{
				if (i & bit)
				{
					a0 ^= basis[bit][0];
					a1 ^= basis[bit][1];
					a2 ^= basis[bit][2];
					a3 ^= basis[bit][3];
				}
			}
			m0[i] = a0;
			m1[i] = a1;
			m2[i] = a2;
			m3[i] = a3;
		}
		return { m0: m0, m1: m1, m2: m2, m3: m3 };
	}
	function Ghash(tables)
	{
		this.tables = tables;
		this.y0 = this.y1 = this.y2 = this.y3 = 0;
		this.x = [0, 0, 0, 0];
	}
	/**
	 * Y = (Y xor X) * H.
	 */
	Ghash.prototype.block = function (x0, x1, x2, x3)
	{
		var x = this.x, t = this.tables, m0 = t.m0, m1 = t.m1, m2 = t.m2, m3 = t.m3, R4 = GHASH_R4;
		var z0 = 0, z1 = 0, z2 = 0, z3 = 0, wi, word, sh, r, nib;
		x[0] = x0 ^ this.y0;
		x[1] = x1 ^ this.y1;
		x[2] = x2 ^ this.y2;
		x[3] = x3 ^ this.y3;
		// Horner's rule over the 32 nibbles, from the last (highest power of x) to the first.
		for (wi = 3; wi >= 0; wi--)
		{
			word = x[wi];
			for (sh = 0; sh < 32; sh += 4)
			{
				r = z3 & 15;
				z3 = (z3 >>> 4) | (z2 << 28);
				z2 = (z2 >>> 4) | (z1 << 28);
				z1 = (z1 >>> 4) | (z0 << 28);
				z0 = (z0 >>> 4) ^ R4[r];
				nib = (word >>> sh) & 15;
				z0 ^= m0[nib];
				z1 ^= m1[nib];
				z2 ^= m2[nib];
				z3 ^= m3[nib];
			}
		}
		this.y0 = z0;
		this.y1 = z1;
		this.y2 = z2;
		this.y3 = z3;
	};
	/**
	 * Hashes bytes[startIndex..endIndex), zero-padding the last block.
	 */
	Ghash.prototype.bytes = function (bytes, startIndex, endIndex)
	{
		var i, j, blk = [];
		for (i = startIndex; i < endIndex; i += 16)
		{
			for (j = 0; j < 16; j++)
				blk[j] = i + j < endIndex ? bytes[i + j] & 255 : 0;
			this.block(readWord(blk, 0), readWord(blk, 4), readWord(blk, 8), readWord(blk, 12));
		}
	};

	/**
	 * AES-256-GCM encryption or decryption as a time-sliceable job.  Encryption's result is the ciphertext followed by the 16-byte tag.  Decryption's result is the plaintext, and step() throws a "decrypt_failed" error if the tag does not match.
	 */
	function GcmJob(key, iv, input, aad, encrypting, tag)
	{
		if (!key || key.length !== 32)
			throw makeError("invalid_argument", "The content key must be 32 bytes.");
		if (!iv || iv.length < 1)
			throw makeError("invalid_argument", "The IV must not be empty.");
		var rk = aesExpandKey(key), h = [], tables, j0, gi;
		aesEncryptBlock(rk, 0, 0, 0, 0, h);
		tables = ghashTables(h);
		if (iv.length === 12)
			j0 = [readWord(iv, 0), readWord(iv, 4), readWord(iv, 8), 1];
		else
		{
			gi = new Ghash(tables);
			gi.bytes(iv, 0, iv.length);
			gi.block(0, 0, hi32(iv.length * 8), lo32(iv.length * 8));
			j0 = [gi.y0, gi.y1, gi.y2, gi.y3];
		}
		this.rk = rk;
		this.j0 = j0;
		this.counter = [j0[0], j0[1], j0[2], j0[3]];
		this.ghash = new Ghash(tables);
		this.ghash.bytes(aad, 0, aad.length);
		this.aadLength = aad.length;
		this.input = input;
		this.encrypting = encrypting;
		this.tag = tag;
		this.position = 0;
		this.output = [];
		this.keystream = [0, 0, 0, 0];
		this.result = null;
	}
	GcmJob.prototype.step = function ()
	{
		var input = this.input, n = input.length, out = this.output, ks = this.keystream, g = this.ghash, rk = this.rk, enc = this.encrypting;
		var pos = this.position, end = Math.min(pos + 4096, n), c = this.counter, c3 = c[3];
		var a0, a1, a2, a3, o0, o1, o2, o3, j, len, ksBytes, cipherBytes, ib, ob;
		while (pos < end)
		{
			c3 = c3 + 1 | 0;
			aesEncryptBlock(rk, c[0], c[1], c[2], c3, ks);
			if (pos + 16 <= n)
			{
				a0 = readWord(input, pos);
				a1 = readWord(input, pos + 4);
				a2 = readWord(input, pos + 8);
				a3 = readWord(input, pos + 12);
				o0 = a0 ^ ks[0];
				o1 = a1 ^ ks[1];
				o2 = a2 ^ ks[2];
				o3 = a3 ^ ks[3];
				out.push((o0 >>> 24) & 255, (o0 >>> 16) & 255, (o0 >>> 8) & 255, o0 & 255, (o1 >>> 24) & 255, (o1 >>> 16) & 255, (o1 >>> 8) & 255, o1 & 255,
					(o2 >>> 24) & 255, (o2 >>> 16) & 255, (o2 >>> 8) & 255, o2 & 255, (o3 >>> 24) & 255, (o3 >>> 16) & 255, (o3 >>> 8) & 255, o3 & 255);
				if (enc)
					g.block(o0, o1, o2, o3);
				else
					g.block(a0, a1, a2, a3);
				pos += 16;
			}
			else
			{
				len = n - pos;
				ksBytes = wordsToBytes(ks);
				cipherBytes = [];
				for (j = 0; j < len; j++)
				{
					ib = input[pos + j] & 255;
					ob = ib ^ ksBytes[j];
					out.push(ob);
					cipherBytes.push(enc ? ob : ib);
				}
				g.bytes(cipherBytes, 0, len);
				pos = n;
			}
		}
		this.position = pos;
		c[3] = c3;
		if (pos < n)
			return false;
		// Final GHASH block: the bit lengths of the additional data and of the ciphertext.
		g.block(hi32(this.aadLength * 8), lo32(this.aadLength * 8), hi32(n * 8), lo32(n * 8));
		var e = [], tagBytes;
		aesEncryptBlock(rk, this.j0[0], this.j0[1], this.j0[2], this.j0[3], e);
		tagBytes = wordsToBytes([e[0] ^ g.y0, e[1] ^ g.y1, e[2] ^ g.y2, e[3] ^ g.y3]);
		if (enc)
		{
			for (j = 0; j < 16; j++)
				out.push(tagBytes[j]);
			this.result = out;
			return true;
		}
		var diff = this.tag && this.tag.length === 16 ? 0 : 1;
		for (j = 0; j < 16 && diff === 0; j++)
			diff |= tagBytes[j] ^ (this.tag[j] & 255);
		if (diff !== 0)
			throw decryptError();
		this.result = out;
		return true;
	};
	GcmJob.prototype.progress = function ()
	{
		return this.input.length ? this.position / this.input.length : 1;
	};

	/**
	 * Computes a synthetic IV (see "Randomness" in the header): the first 12 bytes of HMAC-SHA256(ivKey, nonce + plaintext).
	 */
	var syntheticIvCounter = 0;
	function SyntheticIvJob(contentKey, plaintext)
	{
		var ivKey = hmacSha256(contentKey, utf8Encode(SYNTHETIC_IV_LABEL));
		this.states = hmacStates(ivKey);
		this.hash = new Sha256(this.states.inner, 64);
		this.hash.update(weakNonce());
		this.data = plaintext;
		this.position = 0;
		this.result = null;
	}
	SyntheticIvJob.prototype.step = function ()
	{
		var end = Math.min(this.position + 16384, this.data.length);
		this.hash.update(this.data, this.position, end);
		this.position = end;
		if (end < this.data.length)
			return false;
		this.result = wordsToBytes(hmacFinish(this.states, this.hash)).slice(0, 12);
		return true;
	};
	SyntheticIvJob.prototype.progress = function ()
	{
		return this.data.length ? this.position / this.data.length : 1;
	};
	/**
	 * Returns exactly 32 bytes that are very likely to differ between calls.  They are not secret and not required to be unpredictable.
	 */
	function weakNonce()
	{
		var t = now(), perf = 0, i, words;
		syntheticIvCounter = (syntheticIvCounter + 1) % 4294967296;
		try
		{
			if (typeof performance !== "undefined" && performance && typeof performance.now === "function")
				perf = Math.floor(performance.now() * 1000) % 4294967296;
		}
		catch (e)
		{
			perf = 0;
		}
		words = [hi32(t), lo32(t), syntheticIvCounter | 0, perf | 0];
		for (i = 0; i < 4; i++)
			words.push(Math.floor(Math.random() * 4294967296) | 0);
		return wordsToBytes(words);
	}
	// #endregion

	// #region Randomness
	function secureRandomSource()
	{
		if (KVStoreClientLegacy._testNoSecureRandom || typeof Uint8Array === "undefined")
			return null;
		var c = typeof crypto !== "undefined" ? crypto : null;
		if (!c || typeof c.getRandomValues !== "function")
			c = typeof msCrypto !== "undefined" ? msCrypto : null;
		return c && typeof c.getRandomValues === "function" ? c : null;
	}
	/**
	 * Returns n bytes from a CSPRNG, or null if there is none.
	 */
	function secureRandomBytes(n)
	{
		var c = secureRandomSource();
		if (!c)
			return null;
		try
		{
			var buf = new Uint8Array(n);
			c.getRandomValues(buf);
			return sliceBytes(buf, 0);
		}
		catch (e)
		{
			return null;
		}
	}
	function requireSecureRandomBytes(n)
	{
		var bytes = secureRandomBytes(n);
		if (!bytes)
			throw makeError("no_secure_random", "This browser has no cryptographically secure random number generator, so secrets can not be generated locally.  Get a phrase from the server with phrase() instead.");
		return bytes;
	}
	// #endregion

	// #region Native WebCrypto fast path
	function nativeSubtle()
	{
		if (!KVStoreClientLegacy.useNativeCrypto || typeof Uint8Array === "undefined" || typeof crypto === "undefined" || !crypto)
			return null;
		var s = crypto.subtle;
		return s && typeof s.importKey === "function" && typeof s.deriveBits === "function" && typeof s.encrypt === "function" && typeof s.decrypt === "function" ? s : null;
	}
	function toUint8Array(bytes)
	{
		var u = new Uint8Array(bytes.length), i;
		for (i = 0; i < bytes.length; i++)
			u[i] = bytes[i];
		return u;
	}
	/**
	 * Calls done(err, result) outside the promise chain, so exceptions thrown by callers are reported normally instead of becoming unhandled rejections.
	 */
	function settleOutsidePromise(promise, done)
	{
		promise.then(function (result)
		{
			setTimeout(function () { done(null, sliceBytes(new Uint8Array(result), 0)); }, 0);
		}, function (err)
		{
			setTimeout(function () { done(err || new Error("Native crypto failed.")); }, 0);
		});
	}
	function nativePbkdf2(passwordBytes, iterations, done)
	{
		var s = nativeSubtle();
		if (!s)
		{
			done(new Error("Native crypto is not available."));
			return;
		}
		try
		{
			settleOutsidePromise(s.importKey("raw", toUint8Array(passwordBytes), { name: "PBKDF2" }, false, ["deriveBits"]).then(function (baseKey)
			{
				return s.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: toUint8Array(utf8Encode(SALT)), iterations: iterations }, baseKey, 512);
			}), done);
		}
		catch (e)
		{
			done(e);
		}
	}
	function nativeAesGcm(encrypting, key, iv, data, done)
	{
		var s = nativeSubtle();
		if (!s)
		{
			done(new Error("Native crypto is not available."));
			return;
		}
		try
		{
			settleOutsidePromise(s.importKey("raw", toUint8Array(key), { name: "AES-GCM" }, false, [encrypting ? "encrypt" : "decrypt"]).then(function (cryptoKey)
			{
				var params = { name: "AES-GCM", iv: toUint8Array(iv) };
				return encrypting ? s.encrypt(params, cryptoKey, toUint8Array(data)) : s.decrypt(params, cryptoKey, toUint8Array(data));
			}), done);
		}
		catch (e)
		{
			done(e);
		}
	}
	// #endregion

	// #region Key derivation, encryption, decryption (internal, callback-based)
	function keysFromMaterial(material)
	{
		return { lookupKey: base32Encode(material.slice(0, 20)), contentKey: material.slice(32, 64) };
	}
	/**
	 * Returns the PBKDF2 iteration count for a key derivation mode ("standard" if omitted), or 0 if the mode is unknown.
	 */
	function pbkdf2Iterations(mode)
	{
		mode = mode || "standard";
		return Object.prototype.hasOwnProperty.call(PBKDF2_ITERATIONS, mode) ? PBKDF2_ITERATIONS[mode] : 0;
	}
	function unknownModeError(mode)
	{
		return makeError("invalid_argument", "Unknown key derivation mode \"" + mode + "\".  Use \"standard\" or \"fast\".");
	}
	function deriveKeysInternal(phrase, mode, onProgress, done)
	{
		var iterations = pbkdf2Iterations(mode);
		if (!iterations)
		{
			done(unknownModeError(mode));
			return;
		}
		var password = utf8Encode(KVStoreClientLegacy.normalizePhrase(phrase));
		nativePbkdf2(password, iterations, function (err, material)
		{
			if (!err)
			{
				reportProgress(onProgress, 1);
				done(null, keysFromMaterial(material));
				return;
			}
			runJob(function () { return new Pbkdf2Job(password, utf8Encode(SALT), iterations, 64); }, onProgress, function (err2, material2)
			{
				if (err2)
				{
					done(err2);
					return;
				}
				reportProgress(onProgress, 1);
				done(null, keysFromMaterial(material2));
			});
		});
	}
	function isKeys(obj)
	{
		return !!obj && typeof obj === "object" && typeof obj.lookupKey === "string" && !!obj.contentKey && obj.contentKey.length === 32;
	}
	function withKeys(phraseOrKeys, mode, onProgress, done)
	{
		if (isKeys(phraseOrKeys))
			done(null, phraseOrKeys);
		else
			deriveKeysInternal(phraseOrKeys, mode, onProgress, done);
	}
	function contentKeyError(key)
	{
		if (!key || typeof key.length !== "number" || key.length !== 32)
			return makeError("invalid_argument", "The content key must be 32 bytes (the contentKey returned by deriveKeys).");
		return null;
	}
	function makeIv(contentKey, plaintext, done)
	{
		var iv = secureRandomBytes(12);
		if (iv)
			done(null, iv);
		else
			runJob(function () { return new SyntheticIvJob(contentKey, plaintext); }, null, done);
	}
	// encryptInternal and decryptInternal report every error through done, never by throwing, because they are called from asynchronous continuations.
	function encryptInternal(contentKey, plaintext, done)
	{
		var keyError = contentKeyError(contentKey);
		if (keyError)
		{
			done(keyError);
			return;
		}
		makeIv(contentKey, plaintext, function (err, iv)
		{
			if (err)
			{
				done(err);
				return;
			}
			nativeAesGcm(true, contentKey, iv, plaintext, function (err2, ciphertext)
			{
				if (!err2)
				{
					done(null, iv.concat(ciphertext));
					return;
				}
				runJob(function () { return new GcmJob(sliceBytes(contentKey, 0), iv, plaintext, [], true); }, null, function (err3, ciphertext3)
				{
					if (err3)
						done(err3);
					else
						done(null, iv.concat(ciphertext3));
				});
			});
		});
	}
	function decryptInternal(contentKey, data, done)
	{
		var keyError = contentKeyError(contentKey);
		if (keyError || data.length < 12 + 16)
		{
			done(keyError || makeError("decrypt_failed", "Encrypted data is too short."));
			return;
		}
		var iv = sliceBytes(data, 0, 12), body = sliceBytes(data, 12);
		nativeAesGcm(false, contentKey, iv, body, function (err, plaintext)
		{
			if (!err)
			{
				done(null, plaintext);
				return;
			}
			// Either native AES-GCM is unavailable, or authentication failed.  The pure-JS path gives the definitive answer.
			runJob(function () { return new GcmJob(sliceBytes(contentKey, 0), iv, body.slice(0, body.length - 16), [], false, body.slice(body.length - 16)); }, null, done);
		});
	}
	// #endregion

	// #region Transport
	var pendingXdr = [];
	function hasXhrCors()
	{
		try
		{
			return "withCredentials" in new XMLHttpRequest();
		}
		catch (e)
		{
			return false;
		}
	}
	var URL_ORIGIN = /^([a-z][a-z0-9+.\-]*:)?\/\/([^\/?#]*)/i;
	function normalizeHost(host, scheme)
	{
		host = String(host).toLowerCase();
		if ((scheme === "http:" && /:80$/.test(host)) || (scheme === "https:" && /:443$/.test(host)))
			host = host.replace(/:\d+$/, "");
		return host;
	}
	function pageScheme()
	{
		return typeof location !== "undefined" && location && location.protocol ? String(location.protocol).toLowerCase() : "";
	}
	function isSameOrigin(url)
	{
		var m = URL_ORIGIN.exec(url);
		if (!m)
			return true; // A relative URL.
		var page = pageScheme();
		if (!page || typeof location.host !== "string")
			return false;
		var scheme = m[1] ? m[1].toLowerCase() : page;
		return scheme === page && normalizeHost(m[2], scheme) === normalizeHost(location.host, page);
	}
	/**
	 * POSTs a text body.  Calls done(response) asynchronously, exactly once, where response is {status, text, retryAfter} or {error: code}.
	 */
	function postText(url, body, timeoutMs, done)
	{
		var hasXhr = typeof XMLHttpRequest !== "undefined", hasXdr = typeof XDomainRequest !== "undefined";
		if (hasXhr && (!hasXdr || isSameOrigin(url) || hasXhrCors()))
			xhrPost(url, body, timeoutMs, done);
		else if (hasXdr)
			xdrPost(url, body, timeoutMs, done);
		else
			setTimeout(function () { done({ error: "no_transport" }); }, 0);
	}
	function xhrPost(url, body, timeoutMs, done)
	{
		var xhr = new XMLHttpRequest(), finished = false, timer = null;
		function finish(response)
		{
			if (finished)
				return;
			finished = true;
			if (timer)
				clearTimeout(timer);
			setTimeout(function () { done(response); }, 0);
		}
		function onReadyStateChange()
		{
			if (xhr.readyState !== 4 || finished)
				return;
			var status = 0, text = "", retryAfter = null;
			try { status = xhr.status; } catch (e) { status = 0; }
			try { text = xhr.responseText; } catch (e) { text = ""; }
			try { retryAfter = xhr.getResponseHeader("Retry-After"); } catch (e) { retryAfter = null; }
			// IE reports network failures as WinINet error codes (12000 to 12999) instead of status 0.
			if (!status || (status >= 12000 && status < 13000))
				finish({ error: "network_error" });
			else
				finish({ status: status, text: text, retryAfter: retryAfter });
		}
		try
		{
			xhr.open("POST", url, true);
			xhr.onreadystatechange = onReadyStateChange;
			xhr.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
			if (timeoutMs > 0)
			{
				timer = setTimeout(function ()
				{
					finish({ error: "timeout" });
					try { xhr.abort(); } catch (e) { /* ignore */ }
				}, timeoutMs);
			}
			xhr.send(body);
		}
		catch (e)
		{
			finish({ error: "network_error" });
		}
	}
	function xdrPost(url, body, timeoutMs, done)
	{
		var m = URL_ORIGIN.exec(url);
		if (m && m[1] && m[1].toLowerCase() !== pageScheme())
		{
			setTimeout(function () { done({ error: "xdr_scheme_mismatch" }); }, 0);
			return;
		}
		var xdr = new XDomainRequest(), finished = false;
		function finish(response)
		{
			if (finished)
				return;
			finished = true;
			for (var i = 0; i < pendingXdr.length; i++)
			{
				if (pendingXdr[i] === xdr)
				{
					pendingXdr.splice(i, 1);
					break;
				}
			}
			setTimeout(function () { done(response); }, 0);
		}
		// XDR fires onload only for 2xx responses, and onerror, with no details, for everything else.
		xdr.onload = function ()
		{
			var text = "";
			try { text = xdr.responseText; } catch (e) { text = ""; }
			finish({ status: 200, text: text, retryAfter: null });
		};
		xdr.onerror = function () { finish({ error: "xdr_failed" }); };
		xdr.ontimeout = function () { finish({ error: "timeout" }); };
		xdr.onprogress = function () { };
		try
		{
			xdr.open("POST", url);
			if (timeoutMs > 0)
				xdr.timeout = timeoutMs;
		}
		catch (e)
		{
			finish({ error: "xdr_failed" });
			return;
		}
		// Keep a reference until the request completes, and send from a timer; both work around IE9 bugs that abort XDR requests.
		pendingXdr.push(xdr);
		setTimeout(function ()
		{
			try
			{
				xdr.send(body);
			}
			catch (e)
			{
				finish({ error: "xdr_failed" });
			}
		}, 0);
	}
	/**
	 * Interprets a response from postText.  Calls done(null, json) if "ok" is true, otherwise done(KVStoreError).
	 */
	function readJsonResponse(response, done)
	{
		if (response.error)
		{
			done(transportError(response.error));
			return;
		}
		var json = null;
		try
		{
			json = JSON.parse(response.text);
		}
		catch (e)
		{
			json = null;
		}
		if (json && json.ok === true)
		{
			done(null, json);
			return;
		}
		var retryAfter = parseInt(response.retryAfter, 10) || 0;
		done(new KVStoreError(response.status, json && typeof json.error === "string" ? json.error : "http_" + response.status, retryAfter));
	}
	// #endregion

	// #region Client
	/**
	 * Constructs a client.
	 * @param {string} baseUrl Base URL of the KVStore server, e.g. "http://kv.example.com".
	 * @param {Object} [options]
	 * @param {string} [options.bucket] Bucket to use.  If omitted, the server's default bucket is used.
	 * @param {number} [options.timeout] Request timeout in milliseconds.  If omitted or 0, requests have no timeout.
	 * @param {string} [options.keyDerivation] "standard" (the default, 600,000 PBKDF2 iterations) or "fast" (10,000).  Used by putEncrypted, getEncrypted, and getEncryptedText.
	 */
	function KVStoreClientLegacy(baseUrl, options)
	{
		this.baseUrl = String(baseUrl).replace(/\/+$/, "");
		this.bucket = options && options.bucket ? options.bucket : undefined;
		this.timeout = options && options.timeout > 0 ? options.timeout : 0;
		this.keyDerivation = options && options.keyDerivation ? options.keyDerivation : "standard";
		if (!pbkdf2Iterations(this.keyDerivation))
			throw unknownModeError(this.keyDerivation);
	}
	/**
	 * POSTs a JSON body to an API endpoint, as text/plain (a CORS-safelisted content type, so no preflight request is needed).
	 */
	KVStoreClientLegacy.prototype._post = function (endpoint, body, done)
	{
		postText(this.baseUrl + "/v1/" + endpoint, JSON.stringify(body || {}), this.timeout, function (response)
		{
			readJsonResponse(response, done);
		});
	};
	KVStoreClientLegacy.prototype._keyBody = function (key)
	{
		var body = { key: key };
		if (this.bucket)
			body.bucket = this.bucket;
		return body;
	};
	KVStoreClientLegacy.prototype._putRaw = function (key, bytes, ttl, done)
	{
		var body = this._keyBody(key);
		body.value = bytesToBase64(bytes);
		if (ttl)
			body.ttl = ttl;
		this._post("put", body, done);
	};
	KVStoreClientLegacy.prototype._getRaw = function (key, done)
	{
		var self = this;
		this._post("get", this._keyBody(key), function (err, json)
		{
			if (err)
			{
				if (err.code === "not_found")
					done(null, null);
				else if (err.code === "xdr_failed")
				{
					// XDR hides the error.  "info" answers 200 for a missing key, so it can tell not_found from other failures.
					self._post("info", self._keyBody(key), function (err2, info)
					{
						if (!err2 && info.exists === false)
							done(null, null);
						else
							done(err);
					});
				}
				else
					done(err);
				return;
			}
			var bytes = null, error = null;
			try
			{
				if (typeof json.value !== "string")
					throw makeError("invalid_base64", "The server's response has no value.");
				bytes = base64ToBytes(json.value);
			}
			catch (e)
			{
				error = e;
			}
			if (error)
				done(error);
			else
				done(null, bytes);
		});
	};

	/**
	 * Stores a value without encrypting it.  Overwrites any existing value with the same key.  Uses the "put" operation (base64 in JSON).
	 * @param {string} key 32 base32 characters.
	 * @param {number[]|Uint8Array|string} bytes The value.  A string is encoded as UTF-8.
	 * @param {number} [ttl] Requested lifetime in seconds.  The server clamps it to the bucket's limits.
	 * @param {function(Error, {ok: boolean, expires: number, ttl: number, size: number})} [callback] If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.prototype.putRaw = function (key, bytes, ttl, callback)
	{
		if (typeof ttl === "function")
		{
			callback = ttl;
			ttl = undefined;
		}
		var self = this;
		return invoke(callback, function (done) { self._putRaw(key, toBytes(bytes), ttl, done); });
	};
	/**
	 * Retrieves a value stored with putRaw (or by any other client).  The result is null if the key does not exist (or has expired).  Uses the "get" operation (base64 in JSON).
	 * @param {string} key
	 * @param {function(Error, number[]|null)} [callback] If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.prototype.getRaw = function (key, callback)
	{
		var self = this;
		return invoke(callback, function (done) { self._getRaw(key, done); });
	};
	/**
	 * Returns whether a value exists, without downloading it.  Useful for polling while another device uploads.
	 * @param {string} key
	 * @param {function(Error, {ok: boolean, exists: boolean, expires?: number, size?: number})} [callback] If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.prototype.info = function (key, callback)
	{
		var self = this;
		return invoke(callback, function (done) { self._post("info", self._keyBody(key), done); });
	};
	/**
	 * Deletes a value.
	 * @param {string} key
	 * @param {function(Error, boolean)} [callback] Receives true if a value was deleted.  If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.prototype.del = function (key, callback)
	{
		var self = this;
		return invoke(callback, function (done)
		{
			self._post("del", self._keyBody(key), function (err, r) { done(err, r ? r.deleted : undefined); });
		});
	};
	/**
	 * Lists the server's enabled buckets and their limits.
	 * @param {function(Error, {ok: boolean, defaultBucket: string, buckets: Array<{name: string, maxItemSizeBytes: number, defaultTtl: number, maxTtl: number}>})} [callback] If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.prototype.buckets = function (callback)
	{
		var self = this;
		return invoke(callback, function (done) { self._post("buckets", {}, done); });
	};
	/**
	 * Asks the server for a random phrase.  Use this when hasSecureRandom() is false.  Over plain http, the phrase is visible to network eavesdroppers.
	 * @param {number} [words] 5 to 10 (default 6).
	 * @param {function(Error, string)} [callback] If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.prototype.phrase = function (words, callback)
	{
		if (typeof words === "function")
		{
			callback = words;
			words = undefined;
		}
		var self = this;
		return invoke(callback, function (done)
		{
			self._post("phrase", { words: words || 6 }, function (err, r) { done(err, r ? r.phrase : undefined); });
		});
	};

	/**
	 * Encrypts and stores data under the lookup key derived from the phrase.
	 * @param {string|{lookupKey: string, contentKey: number[]}} phrase The secret phrase, or the result of deriveKeys.
	 * @param {number[]|Uint8Array|string} data Bytes, or a string (encoded as UTF-8).
	 * @param {number} [ttl] Requested lifetime in seconds.
	 * @param {function(Error, {ok: boolean, expires: number, ttl: number, size: number})} [callback] If omitted (or null), a Promise is returned.
	 * @param {function(number)} [onProgress] Receives key derivation progress, from 0 to 1.
	 */
	KVStoreClientLegacy.prototype.putEncrypted = function (phrase, data, ttl, callback, onProgress)
	{
		if (typeof ttl === "function")
		{
			onProgress = callback;
			callback = ttl;
			ttl = undefined;
		}
		var self = this;
		return invoke(callback, function (done)
		{
			var bytes = toBytes(data);
			withKeys(phrase, self.keyDerivation, onProgress, function (err, keys)
			{
				if (err)
				{
					done(err);
					return;
				}
				encryptInternal(keys.contentKey, bytes, function (err2, ciphertext)
				{
					if (err2)
						done(err2);
					else
						self._putRaw(keys.lookupKey, ciphertext, ttl, done);
				});
			});
		});
	};
	/**
	 * Retrieves and decrypts data stored with putEncrypted (by either client).  The result is null if nothing is stored under the phrase.  Fails with code "decrypt_failed" if decryption fails (wrong phrase or tampered data).
	 * @param {string|{lookupKey: string, contentKey: number[]}} phrase The secret phrase, or the result of deriveKeys.
	 * @param {function(Error, number[]|null)} [callback] If omitted (or null), a Promise is returned.
	 * @param {function(number)} [onProgress] Receives key derivation progress, from 0 to 1.
	 */
	KVStoreClientLegacy.prototype.getEncrypted = function (phrase, callback, onProgress)
	{
		var self = this;
		return invoke(callback, function (done)
		{
			withKeys(phrase, self.keyDerivation, onProgress, function (err, keys)
			{
				if (err)
				{
					done(err);
					return;
				}
				self._getRaw(keys.lookupKey, function (err2, ciphertext)
				{
					if (err2)
						done(err2);
					else if (ciphertext === null)
						done(null, null);
					else
						decryptInternal(keys.contentKey, ciphertext, done);
				});
			});
		});
	};
	/**
	 * Like getEncrypted, but decodes the result as UTF-8 text.
	 * @param {string|{lookupKey: string, contentKey: number[]}} phrase The secret phrase, or the result of deriveKeys.
	 * @param {function(Error, string|null)} [callback] If omitted (or null), a Promise is returned.
	 * @param {function(number)} [onProgress] Receives key derivation progress, from 0 to 1.
	 */
	KVStoreClientLegacy.prototype.getEncryptedText = function (phrase, callback, onProgress)
	{
		var self = this;
		return invoke(callback, function (done)
		{
			self.getEncrypted(phrase, function (err, bytes)
			{
				if (err)
					done(err);
				else
					done(null, bytes === null ? null : utf8Decode(bytes));
			}, onProgress);
		});
	};

	// #region Static helpers
	/**
	 * If true (the default), crypto.subtle is used for PBKDF2 and AES-GCM where it exists.  Set to false to always use the pure-JS implementation.
	 */
	KVStoreClientLegacy.useNativeCrypto = true;
	/**
	 * Approximate length in milliseconds of each slice of pure-JS crypto work between yields to the event loop.
	 */
	KVStoreClientLegacy.sliceMs = 50;
	/**
	 * Returns true if a cryptographically secure random number generator is available, so generatePhrase() and randomKey() work.
	 * @returns {boolean}
	 */
	KVStoreClientLegacy.hasSecureRandom = function ()
	{
		return !!secureRandomBytes(1);
	};
	/**
	 * Normalizes a phrase as typed by a user: lower case, words separated by single hyphens.  Spaces, hyphens, underscores, dots, and commas are all accepted as separators.
	 * @param {string} phrase
	 * @returns {string}
	 */
	KVStoreClientLegacy.normalizePhrase = function (phrase)
	{
		var parts = String(phrase).toLowerCase().split(PHRASE_SEPARATORS), words = [], i;
		for (i = 0; i < parts.length; i++)
		{
			if (parts[i].length > 0)
				words.push(parts[i]);
		}
		return words.join("-");
	};
	/**
	 * Generates a random phrase locally using a cryptographically secure random number generator.  Throws an Error with code "no_secure_random" if there is none (IE9, IE10); use phrase() instead.
	 * @param {string[]} wordList The EFF short wordlist #1 (1296 words).
	 * @param {number} [words] Number of words (default 6; 6 is the recommended minimum).
	 * @returns {string}
	 */
	KVStoreClientLegacy.generatePhrase = function (wordList, words)
	{
		words = words || 6;
		var n = wordList.length;
		// Rejection sampling avoids modulo bias.
		var limit = Math.floor(4294967296 / n) * n;
		var chosen = [], b, v;
		while (chosen.length < words)
		{
			b = requireSecureRandomBytes(4);
			v = readWord(b, 0) >>> 0;
			if (v < limit)
				chosen.push(wordList[v % n]);
		}
		return chosen.join("-");
	};
	/**
	 * Derives the lookup key and content key from a phrase.  This is deliberately slow (600,000 PBKDF2 iterations, or 10,000 in "fast" mode), and in pure JavaScript slower than natively.
	 * @param {string} phrase The secret phrase.  It is normalized first.
	 * @param {function(Error, {lookupKey: string, contentKey: number[]})} [callback] If omitted (or null), a Promise is returned.
	 * @param {function(number)} [onProgress] Receives progress, from 0 to 1.
	 * @param {string} [mode] "standard" (the default) or "fast".  Data written with one mode can only be read with the same mode.
	 */
	KVStoreClientLegacy.deriveKeys = function (phrase, callback, onProgress, mode)
	{
		return invoke(callback, function (done) { deriveKeysInternal(phrase, mode, onProgress, done); });
	};
	/**
	 * Encrypts with AES-256-GCM.  The result is the 12-byte IV followed by the ciphertext and the 16-byte authentication tag.
	 * @param {number[]} contentKey 32 bytes (the contentKey returned by deriveKeys).
	 * @param {number[]|Uint8Array|string} bytes A string is encoded as UTF-8.
	 * @param {function(Error, number[])} [callback] If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.encrypt = function (contentKey, bytes, callback)
	{
		return invoke(callback, function (done) { encryptInternal(contentKey, toBytes(bytes), done); });
	};
	/**
	 * Decrypts data produced by encrypt() (of either client).  Fails with code "decrypt_failed" if the key is wrong or the data was modified.
	 * @param {number[]} contentKey 32 bytes.
	 * @param {number[]|Uint8Array} data IV followed by ciphertext and tag.
	 * @param {function(Error, number[])} [callback] If omitted, a Promise is returned.
	 */
	KVStoreClientLegacy.decrypt = function (contentKey, data, callback)
	{
		return invoke(callback, function (done) { decryptInternal(contentKey, toBytes(data), done); });
	};
	/**
	 * RFC 4648 base32, lower case, unpadded.
	 * @param {number[]} bytes
	 * @returns {string}
	 */
	KVStoreClientLegacy.base32Encode = base32Encode;
	/**
	 * Returns a random key suitable for putRaw: 20 random bytes as 32 base32 characters (160 bits).  Throws an Error with code "no_secure_random" if there is no cryptographically secure random number generator.
	 * @returns {string}
	 */
	KVStoreClientLegacy.randomKey = function ()
	{
		return base32Encode(requireSecureRandomBytes(20));
	};
	/**
	 * Base64-encodes bytes.
	 * @param {number[]} bytes
	 * @returns {string}
	 */
	KVStoreClientLegacy.bytesToBase64 = bytesToBase64;
	/**
	 * Decodes base64 to bytes.
	 * @param {string} b64
	 * @returns {number[]}
	 */
	KVStoreClientLegacy.base64ToBytes = base64ToBytes;
	/**
	 * Encodes a string as UTF-8 bytes.
	 * @param {string} str
	 * @returns {number[]}
	 */
	KVStoreClientLegacy.utf8Encode = utf8Encode;
	/**
	 * Decodes UTF-8 bytes to a string.
	 * @param {number[]} bytes
	 * @returns {string}
	 */
	KVStoreClientLegacy.utf8Decode = utf8Decode;
	// #endregion

	/**
	 * Test hook: if true, behave as if there were no cryptographically secure random number generator.
	 */
	KVStoreClientLegacy._testNoSecureRandom = false;
	/**
	 * Synchronous building blocks, exposed for testing.  Not part of the supported API.
	 */
	KVStoreClientLegacy._internals = {
		sha256: sha256,
		hmacSha256: hmacSha256,
		pbkdf2: function (password, salt, iterations, dkLen) { return runJobSync(new Pbkdf2Job(password, salt, iterations, dkLen)); },
		aesEncryptBlock: function (key, block)
		{
			var out = [];
			aesEncryptBlock(aesExpandKey(key), readWord(block, 0), readWord(block, 4), readWord(block, 8), readWord(block, 12), out);
			return wordsToBytes(out);
		},
		gcmEncrypt: function (key, iv, plaintext, aad) { return runJobSync(new GcmJob(key, iv, plaintext, aad || [], true)); },
		gcmDecrypt: function (key, iv, ciphertext, aad, tag) { return runJobSync(new GcmJob(key, iv, ciphertext, aad || [], false, tag)); },
		syntheticIv: function (contentKey, plaintext) { return runJobSync(new SyntheticIvJob(contentKey, plaintext)); },
		runJob: runJob,
		Pbkdf2Job: Pbkdf2Job
	};
	// #endregion

	KVStoreClientLegacy.KVStoreError = KVStoreError;
	root.KVStoreClientLegacy = KVStoreClientLegacy;
	if (typeof module === "object" && module && module.exports)
		module.exports = KVStoreClientLegacy;
})(typeof self !== "undefined" ? self : this);
