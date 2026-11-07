# Plan: Web Push notifications for UI3 in Blue Iris

> **Note (2026-11-05):** This plan was not followed entirely. It is kept as a historical record. Blue Iris implemented push through the JSON `login` command (`uuid`, `devicetype: "UI3"`, `devicename`, `token`) instead of the `webpush_*` commands proposed below, and has no status or test command yet. See `ui3-push-blueiris-requests.md` for what was actually implemented and the follow-up requests.

**Audience:** the Blue Iris developers (and their AI coding agent).
**From:** bp2008 (UI3 author).
**Status:** UI3's side is built as a prototype and has been verified end to end in Chrome against a stand-in server that does everything this plan asks Blue Iris to do. Blue Iris is the missing piece.

---

## 1. Summary

UI3 users want Blue Iris alerts as notifications in their web browser, the way the iOS and Android apps get them, including when UI3 isn't open. Browsers support this through the standard **Web Push** protocol. The browser gives the web page a *subscription*: a push-service URL plus two keys. The server encrypts each message with those keys and POSTs it to that URL, and the browser's push service delivers it. Google, Mozilla, Microsoft and Apple run the push services. There is no account, fee or API key, and no Perspective Software infrastructure is involved.

Blue Iris needs to:

1. Keep one **VAPID key pair** (P-256), which identifies this Blue Iris server to the push services.
2. Add five **JSON API commands** so UI3 can register and manage the current browser's subscription (§4).
3. Store each browser subscription as a **"UI3" device in the existing Mobile devices list** (§5), so users manage them like phones.
4. Have the existing **Push notification alert action** also send to UI3 devices (§6): encrypt the payload (RFC 8291), sign a VAPID token (RFC 8292), and POST it (§7–§8).

All of this can be done with Windows CNG (BCrypt) and WinHTTP; no third-party libraries are required. The protocol pieces are well specified, and §7 includes the official test vector.

Blue Iris does **not** need to host anything, change its web server's security model, build any UI3 screens, or handle browser compatibility. UI3 and a small static site maintained by bp2008 handle the browser side.

## 2. How it fits together

```
 Browser (UI3)                    Blue Iris                         Push service (FCM / Mozilla / WNS / Apple)
 ─────────────                    ─────────                         ─────────────────────────────────────────
 webpush_info  ─────────────────▶ returns VAPID public key
 subscribes in the browser
 webpush_subscribe {subscription} ▶ stores a "UI3" mobile device
                                   ... later, an alert fires ...
                                   Push notification action:
                                   encrypt payload, sign VAPID JWT
                                   POST endpoint ─────────────────▶ delivers to the browser
 service worker shows the
 notification; click opens UI3
```

**Two subscription modes.** Both are handled identically by Blue Iris; it only stores the mode for display.

- **direct:** UI3 is on a secure context (HTTPS with a trusted certificate, or localhost). UI3 registers its own service worker and subscribes. Notifications come from the UI3 address, and clicking one focuses an open UI3 tab and opens the clip.
- **relay:** UI3 is on plain HTTP or a self-signed certificate, where browsers forbid push. UI3 opens a small static page at `https://ui3-push.bp2008.org/` (GitHub Pages, no server code, stores nothing). That page subscribes on its own secure origin and hands the subscription back to UI3. Notifications appear to come from that site, and clicking one opens UI3.

Most Blue Iris users have no trusted certificate, so relay mode is what makes the feature usable for them.

**Platform notes (for support and expectations):**
- **Android:** Chrome receives pushes through Google Play Services, even with Chrome closed and the phone asleep, as long as alerts are sent with high urgency (§8).
- **Desktop browsers:** a desktop browser only receives pushes while it is running, which includes running in the background or system tray.
- **iOS/iPadOS:** UI3 hides the feature there. Apple only allows Web Push for web apps added to the Home Screen.

## 3. VAPID key pair

- Generate an ECDSA P-256 key pair the first time it's needed. Persist the private key protected, for example with DPAPI (`CryptProtectData`) in the settings store, and never expose it.
- The **public key** is the 65-byte uncompressed point (`0x04 || X || Y`), sent to UI3 as unpadded base64url.
- Every subscription is bound to the public key it was created with. **Changing the key pair invalidates every UI3 device**; push services reject the old ones with 403. If you offer a "regenerate" button, warn about this and delete all UI3 devices. Normally the key never changes.
- Also needed: a VAPID **subject**, a `mailto:` or `https:` URL that push services can use to contact the sender. Apple rejects some values (for example ones containing `localhost`). A fixed value such as `mailto:support@blueirissoftware.com` or `https://blueirissoftware.com/` is fine for every install.

## 4. JSON API: new commands on `/json`

These use the normal `/json` endpoint, session, and response envelope: `{"result":"success","data":{...}}` or `{"result":"fail","data":{"reason":"..."}}`. UI3 shows `data.reason` to the user, so make it readable. UI3's prototype already speaks exactly this contract; if you prefer different names or fields, tell bp2008 and UI3 will follow.

Any authenticated user may use them. A device records the user who registered it (§5); Blue Iris already decides per user which alerts a device receives.

| cmd | Arguments | `data` on success |
| --- | --- | --- |
| `webpush_info` | none | `{ "vapidPublicKey": "<base64url, 65 bytes>", "serverName": "<system name>" }` |
| `webpush_subscribe` | see below | `{}` |
| `webpush_status` | `endpoint` | `{ "subscribed": bool, "enabled": bool }`. `enabled` is the device's "Push notifications: Enable" checkbox. |
| `webpush_test` | `endpoint` | `{}` once the push service accepts the message, else fail with a reason that includes the HTTP status |
| `webpush_unsubscribe` | `endpoint` | `{}`. Also succeed if no such device exists. |

`webpush_subscribe` arguments:

```json
{
  "cmd": "webpush_subscribe", "session": "...",
  "subscription": { "endpoint": "https://fcm.googleapis.com/fcm/send/...", "expirationTime": null,
                    "keys": { "p256dh": "<base64url 65 bytes>", "auth": "<base64url 16 bytes>" } },
  "mode": "direct" | "relay",
  "label": "Chrome on Windows",
  "ui3Url": "https://example.com/ui3.htm",
  "biBaseUrl": "https://example.com/",
  "userAgent": "Mozilla/5.0 ..."
}
```

- `ui3Url` is the page notifications open, as the user reaches it (LAN IP, DDNS name, reverse proxy...). Blue Iris has no other way to know it.
- `biBaseUrl` is Blue Iris's web root as reached from that page. It is used for image URLs in direct mode (§6.3).

**Validation (important):**
- `endpoint` must be `https://` and its host must be a known push service. **This guards against SSRF:** Blue Iris will POST to whatever URL is registered, and any user can register one. Current hosts:
  - `fcm.googleapis.com` (Chrome, Android, Opera, Samsung Internet)
  - `*.push.services.mozilla.com` (Firefox)
  - `*.notify.windows.com` (Edge on Windows)
  - `*.push.apple.com` (Safari on macOS)

  Consider making this list updatable without a release.
- `keys.p256dh` must decode to 65 bytes starting with `0x04`, and `keys.auth` to 16 bytes.
- `ui3Url` and `biBaseUrl` must be `http:` or `https:` and at most 2000 characters. Cap `label` at 100 characters and `userAgent` at 500.
- **Upsert by endpoint.** A browser re-subscribing updates its existing device (keys, URLs, label, last user, last connected) and keeps the admin's Enable checkbox, description and tags.
- Cap the number of UI3 devices, per user and in total, so the list can't be flooded.

**Ownership:** an endpoint URL is an unguessable secret that only the subscribed browser knows. Possessing it is sufficient authority for `webpush_status`, `webpush_test` and `webpush_unsubscribe`. **Never return other devices or endpoints through the API.** UI3 deliberately has no device list, because non-admin users must not see other devices. The Blue Iris Settings GUI remains the management interface.

**Feature detection:** please add a flag to the `login` response's `data`, for example `"webpush": true`, so UI3 knows whether to show the feature without an extra request.

## 5. UI3 devices in Settings > Mobile devices

Each subscription becomes a device in the existing list:

| Mobile device field | UI3 device value |
| --- | --- |
| Type | `UI3` (the Name says which browser, for example "Chrome on Windows") |
| Name | `label` from UI3 (editable) |
| Description, Tags | admin-editable as today. Tags work with the push action's tag filter as today. |
| Push notifications: Enable | default on |
| Push token | the subscription JSON, `{"endpoint":...,"keys":{"p256dh":...,"auth":...}}`. This is the same idea as the JSON token already stored for Windows (WNS) devices. |
| Last user | the session's user at subscribe time |
| Last connected | time of the latest `webpush_subscribe`, `webpush_status` or `webpush_test` |
| Geofence | not applicable; disable or ignore |
| also store | `mode`, `ui3Url`, `biBaseUrl`, `userAgent`, last push result and time, consecutive failures. Showing the mode and browser somewhere helps with support. |

Deleting a UI3 device in the GUI simply stops pushes to it. The browser isn't told, but UI3 shows "not subscribed" the next time it checks status.

The JSON `login` command already accepts `uuid`, `devicename`, `devicetype` and `token` for the apps' push registration. Reusing that path for UI3 devices is possible, but the dedicated commands in §4 also cover the key exchange, status, test and unsubscribe that UI3 needs, so they are recommended.

## 6. Sending: the Push notification alert action

Treat UI3 devices as one more device type for the existing **Push notification** action, with the same targeting rules: device push enabled, matching tags, and **only devices whose last user may receive push notifications for the alerting camera during the active profile**.

### 6.1 Payload (UI3 push payload v1)

The message body before encryption is UTF-8 JSON. Both UI3's service worker and the relay site's service worker read exactly these fields and ignore anything else:

| Field | Type | Value from the action |
| --- | --- | --- |
| `title` | string | Camera name, or the first line of the action's text. Defaults to "Blue Iris". |
| `body` | string | The action's notification text with macros expanded (for example the `&MEMO` AI findings) |
| `tag` | string | `cam-<short name>`. A newer notification for the same camera replaces the older one. |
| `renotify` | bool | true (alert again even when replacing) |
| `url` | string | `ui3Url` + deep link: `?rec=@<alert db id>` opens that alert's clip, or `?cam=<short name>` opens the live camera |
| `ts` | number | Alert time, ms since the Unix epoch |
| `image` | string | optional; see §6.3 |
| `requireInteraction` | bool | optional. A reasonable mapping for iOS "Critical": keeps the notification on screen until dismissed. |
| `silent` | bool | optional |

The action's sound has no Web equivalent; browsers play their own sound.

**Size limit:** the encrypted message body may be at most 4096 bytes. That leaves **at most 3993 bytes of plaintext JSON** (4096 − 86 header − 16 tag − 1 delimiter). Enforce this: drop `image` first, then truncate `body`.

### 6.2 Priority and expiry

- **Action priority High:** `Urgency: high`. Normal: `Urgency: normal`. High is what wakes Android devices from sleep, so default to it like the app pushes.
- **`TTL`:** how long the push service holds a message for an offline browser, for example 3600 seconds. Pick a value; old alerts are of limited use.
- **`Topic`:** a per-camera value, for example the camera short name if it's at most 32 URL-safe characters, or a hash of it. Undelivered alerts for the same camera then collapse into one.

### 6.3 Images ("Send rich push")

Browsers fetch the `image` URL themselves when they display the notification. Findings from the prototype:

- **Plain HTTP and self-signed HTTPS image URLs fail.** The browser blocks or upgrades them as mixed content, and there is no way to click through a certificate warning.
- **Blue Iris sessions don't help.** Sessions expire after about a minute of inactivity and only work from the client address that created them. A session made through a reverse proxy was rejected from 127.0.0.1 and from a LAN address of the Blue Iris machine. So the browser normally has no valid session when an alert arrives, and Blue Iris can't hand one over in the URL.
- **`/thumbs/@<db>` ignores `w`/`q`** and returns the stored alert-list JPEG (7–30 KB on bp2008's system), too big to embed. Pulling a resized snapshot from the clip is expensive and needs a session.

What works, in order of preference:

1. **The existing "Use intermediary tmpfiles.org" option.** If the image is uploaded to a public HTTPS host first, `image` is just that URL. It works in both modes with no authentication, exactly as it does for the apps.
2. **An inline thumbnail.** Downscale the alert image (roughly 240×135 at low quality) until its base64 fits the payload budget (about 2,500 characters with a short title and body). Then send `image` as `data:image/jpeg;base64,...`. This works in both modes with nothing to fetch. Blue Iris can do this cheaply because it already has the image.
3. **Direct mode only, an image token.** Set `image` to `biBaseUrl + "thumbs/@<db>?<token>"`. UI3's direct-mode service worker fetches same-origin images itself and falls back to no image on any failure. The token would be a new feature: valid only for that one image, not tied to a client address, expiring after for example 24 hours. A stateless HMAC token over `db` and the expiry time, keyed with a server secret, avoids storing anything.

Chrome shows images on Windows and Android; Firefox desktop and macOS generally don't. Images are optional decoration; never delay or drop a push because of one.

## 7. Encryption: RFC 8291 (Web Push) over RFC 8188 (`aes128gcm`)

One record per message. Inputs: `ua_public` = decoded `p256dh` (65 bytes) and `auth_secret` = decoded `auth` (16 bytes).

```
as_private, as_public  = new ephemeral ECDH P-256 key pair, one per message (as_public = 0x04||X||Y, 65 bytes)
ecdh_secret            = ECDH(as_private, ua_public)                       // 32-byte raw shared secret (X coordinate)
PRK_key                = HMAC-SHA256(key = auth_secret, ecdh_secret)
key_info               = "WebPush: info" || 0x00 || ua_public || as_public  // 144 bytes
IKM                    = HMAC-SHA256(key = PRK_key, key_info || 0x01)        // 32 bytes
salt                   = 16 random bytes
PRK                    = HMAC-SHA256(key = salt, IKM)
CEK                    = first 16 bytes of HMAC-SHA256(key = PRK, "Content-Encoding: aes128gcm" || 0x00 || 0x01)
NONCE                  = first 12 bytes of HMAC-SHA256(key = PRK, "Content-Encoding: nonce" || 0x00 || 0x01)
ciphertext || tag      = AES-128-GCM(key = CEK, iv = NONCE, plaintext || 0x02)  // 0x02 marks the last record; 16-byte tag
body                   = salt(16) || uint32 big-endian 4096 || uint8 65 || as_public(65) || ciphertext || tag
```

**CNG mapping:**

| Need | CNG |
| --- | --- |
| Ephemeral ECDH key | `BCryptOpenAlgorithmProvider(BCRYPT_ECDH_P256_ALGORITHM)`, `BCryptGenerateKeyPair`, `BCryptFinalizeKeyPair` |
| Export `as_public` | `BCryptExportKey(BCRYPT_ECCPUBLIC_BLOB)`: a `BCRYPT_ECCKEY_BLOB` header, then X and Y (32 bytes each, big-endian). Prefix `0x04`. |
| Import `ua_public` | Build a `BCRYPT_ECCPUBLIC_BLOB` with `BCRYPT_ECDH_PUBLIC_P256_MAGIC`, cbKey 32, X and Y from bytes 1–64, then `BCryptImportKeyPair` |
| `ecdh_secret` | `BCryptSecretAgreement`, then `BCryptDeriveKey` with `BCRYPT_KDF_RAW_SECRET` (Windows 10+). **Its output is little-endian: reverse the 32 bytes.** The test vector catches this. |
| HMAC-SHA256 | `BCRYPT_SHA256_ALGORITHM` with `BCRYPT_ALG_HANDLE_HMAC_FLAG` |
| AES-128-GCM | `BCRYPT_AES_ALGORITHM`, `BCRYPT_CHAIN_MODE_GCM`, `BCryptEncrypt` with `BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO` (12-byte nonce, 16-byte tag) |
| Random salt | `BCryptGenRandom` |

**Required unit test: RFC 8291 Appendix A.** Inject this ephemeral key and salt; the output must match byte for byte. All values are unpadded base64url. bp2008's reference implementation reproduces this exactly.

```
plaintext      When I grow up, I want to be a watermelon
as_private     yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw
as_public      BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8
ua_public      BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4
auth_secret    BTBZMqHH6r4Tts7J_aSIgg
salt           DGv6ra1nlYgDCS1FRnbzlw
expected body  DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN
```

## 8. VAPID and the HTTP request

**JWT (RFC 8292):**
- Header: `{"typ":"JWT","alg":"ES256"}`.
- Claims: `{"aud":"<scheme://host[:port] of the endpoint>","exp":<now + 12 hours; must be at most 24 hours>,"sub":"<VAPID subject>"}`.
- Signature: ES256 over `base64url(header) + "." + base64url(claims)`. With CNG, `BCryptSignHash` on the SHA-256 hash using a `BCRYPT_ECDSA_P256_ALGORITHM` key returns the 64-byte r||s form that JWT needs.
- One token per audience can be cached until shortly before it expires.

**Request:** `POST <endpoint>` with:

```
Content-Type: application/octet-stream
Content-Encoding: aes128gcm
TTL: <seconds>
Urgency: high | normal
Topic: <optional, ≤ 32 URL-safe characters>
Authorization: vapid t=<jwt>, k=<base64url VAPID public key>
<body from §7>
```

**Responses:**

| Status | Meaning | Action |
| --- | --- | --- |
| 201 (also 200/202) | accepted | record success |
| 404, 410 | subscription gone (unsubscribed, expired, browser data cleared) | **delete the UI3 device**, and log it |
| 413 | payload too large | bug: log it |
| 429 | rate limited | honor `Retry-After` |
| 400, 401, 403 | request or VAPID problem (403 often means the subscription was made with a different key) | log the response body and record the error on the device. Don't delete it. |
| 5xx, network error | transient | retry a few times with backoff, within the TTL |

Send to multiple devices concurrently, with a timeout of about 15 seconds. Blue Iris already needs outbound HTTPS to Google and Apple for the app pushes, and these hosts are the same or similar.

## 9. Small web server request

UI3's push handlers will move into the existing `ui3serviceworker.js` at release. Browsers re-fetch that script periodically to check for updates, sometimes without a valid session. **Please serve `ui3serviceworker.js` without requiring authentication**, like the login page's assets. It is a static, public file. If it can't be fetched, updates are delayed, but notifications keep working.

## 10. Security checklist

- Endpoint host allowlist (§4) and size limits on every field.
- Never reveal other devices or endpoints through the API.
- Respect each device's last user's camera and profile permissions when sending (§6).
- Payloads are end-to-end encrypted: push services can't read them; only the subscribed browser can. In relay mode the relay site's service worker decrypts them, so whoever controls that site's code can read payloads. bp2008 protects that repository, and Perspective Software may want to host it under its own domain (§11).
- Keep payloads minimal: camera name, alert text, link, optional image.

## 11. The relay site's domain

The relay site is a static GitHub Pages site (repo `bp2008/ui3-push-service`) currently served at `https://ui3-push.bp2008.org/`. **Push subscriptions belong to the site's origin, so the domain can never change once users subscribe.** We'd like it under a Blue Iris domain before release, so it doesn't depend on one person's domain:
- Create a DNS **CNAME** record `ui3-push.blueirissoftware.com` pointing to `bp2008.github.io`. bp2008 then changes the Pages custom domain and UI3's default.
- If GitHub Pages ever stops being suitable, the site is a handful of static files that any HTTPS host can serve at the same name.

## 12. Testing

- UI3's prototype includes a Push Notifications dialog with **Enable**, **Send test** and **Turn off**. It currently talks to a stand-in server; bp2008 will point it at Blue Iris's `/json` once these commands exist.
- Unit test: the RFC 8291 vector (§7).
- In each browser (Chrome, Edge, Firefox on Windows; Chrome on Android; Safari on macOS if available), test both a direct subscription (UI3 over trusted HTTPS) and a relay subscription (UI3 over plain HTTP):
  - subscribe, then Send test
  - trigger a real alert: text, deep link, and image via each §6.3 method in use
  - Turn off from UI3
  - delete the device in Settings, then check UI3 reports it's no longer subscribed
  - clear the browser's site data, then confirm the next push gets 410 and removes the device
- bp2008 can provide the stand-in server (`ui3-push-test-server.js`, about 300 lines of dependency-free Node.js) as a working reference for every step in §4–§8.
