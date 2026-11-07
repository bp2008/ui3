# UI3 push notifications in Blue Iris: what was resolved

A record of the problems found while connecting UI3 to Blue Iris's push notification support, and how each turned out. All measured through Blue Iris's JSON API with throwaway device uuids that were removed afterwards:

- as an administrator, from 127.0.0.1
- as a regular user (`claude`), from the LAN address

Final measurements are from Blue Iris 6.1.4.17, `BlueIris.exe` dated 2026-11-06 1:58 PM. An earlier download with the same version number had none of the 6.1.4.17 fixes below.

## How UI3 uses the API now

Everything goes through the JSON `login` command, sent with the current session:

- `uuid` + `devicetype: "UI3"` returns `vapidPublicKey` and `pushenabled`.
- Add `devicename` + `token: { endpoint, keys, url, mode }` to register or update the device.
- `token: ""` unregisters it.

UI3 sends `uuid` only with a valid session, never in the password challenge or response steps. See [Logging in with only a uuid](#logging-in-with-only-a-uuid) below.

## Resolved

| Problem | First seen | Resolution |
| --- | --- | --- |
| `vapidPublicKey` came only in the sessionless first login step. Its value was unquoted, so the JSON was invalid and UI3 password logins broke. Session-only logins and 127.0.0.1 logins never got it. | 6.1.4.15 (11/4) | **Fixed in 6.1.4.16.** A session `login` with `uuid` + `devicetype: "UI3"` returns it, quoted, for any user. |
| Every push failed with WinHTTP 12005 `INVALID_URL`. | 6.1.4.15 | **Fixed in 6.1.4.16.** Delivery confirmed in Chrome (direct and relay) and Firefox (direct), including thumbnails in Chrome. |
| Registration by a regular user was silently ignored. | 6.1.4.15 | **Fixed in 6.1.4.16.** The device is created with Push off until an administrator turns it on. When an administrator registers, Push starts on. Re-registering keeps the Push setting. |
| Two VAPID key pairs in the registry, and signatures rejected by the push services (Chrome `403 invalid JWT`, Firefox `401 InvalidSignature`). | 6.1.4.15 | **Fixed in practice.** Blue Iris signs with `vapidkey`, which matches the advertised key, and real deliveries work. The unused `vapidprivate`/`vapidpublic` values are still in the registry as of 6.1.4.17. |
| A `login` with `uuid` + `devicetype` but no `token` deleted the device. UI3 had to send its whole registration with every login, which re-created devices an administrator had deleted. | 6.1.4.16 | **Fixed in 6.1.4.17.** Without a token nothing changes, except that `devicename` renames an existing device. Only `token: ""` deletes. UI3 no longer sends the token on every login. |
| UI3 could not tell whether its device had Push on, had been turned off, or had been deleted. | 6.1.4.15 | **Fixed in 6.1.4.17** with `pushenabled`. `true` means Push is on. `false` means the device exists with Push off. A missing field means there is no device. UI3 shows "Turned off in Blue Iris" or "Removed from Blue Iris" and doesn't re-register on its own. |
| A rejected registration (endpoint not on the push-service allowlist) answered `"success"`. | 6.1.4.16 | **Detectable in 6.1.4.17.** The answer is still `"success"`, but `pushenabled` is missing because the device is deleted. UI3 reports the failure. |
| Clicking a notification opened live view (`?cam=`) instead of the alert. | 6.1.4.17 | **Configuration.** The Push action must be under the camera's **On alert** actions. Under **On trigger** no alert exists yet, so the url can't carry `?rec=@<db>`. UI3 already opens `?rec=` links for playback. |

Behavior worth keeping:

- Blue Iris only accepts endpoints on known push services: FCM, Mozilla, WNS and Apple. That stops it being used to send requests to arbitrary URLs.
- A 404 or 410 answer from the push service deletes the device.

## Still open

### Logging in with only a uuid

When the password challenge step includes `uuid`, Blue Iris links the challenge's session to that uuid. Once the password response logs that session in, a `login` with only the `uuid` returns **that same logged-in session**. The request needs no session and no password response. Measured on 2026-11-07:

- **From any address:** it works from client addresses other than the one that logged in (tested from 4 source addresses).
- **Unregistering doesn't remove the link:** it still works after the device is deleted with `token: ""`, and after its registry record is gone.
- **`logout` does remove the link:** after logout, the uuid-only login gets the password challenge. But the logged-out session string itself still works, because `logout` doesn't end sessions. That's a separate, older problem.
- **A uuid sent only alongside an already-valid session is never linked.** It still gets the password challenge.

So the uuid works like the session ID, from any address, until logout. Anyone who learns a device's uuid can take over its live session. Uuids are visible to administrators in Settings > Mobile devices and stored in the registry. This may be intended for the mobile apps. In UI3 it showed up as a phase-1 login that answered "success" instead of the password challenge.

UI3 no longer sends `uuid` in password logins.

A separate, address-based effect showed up during the same testing. From an address where a user is logged in, a `login` with a made-up session string also comes back logged in as that user, with a new session, even after logout. No uuid is involved, and it doesn't work from other addresses.

### `pushenabled` only for `devicetype: "UI3"`

The goal was for any web app to be able to check its own push state, without pretending to be UI3. With any other `devicetype`, or with `uuid` alone, Blue Iris returns neither `pushenabled` nor `vapidPublicKey`. Measured side effects:

- `uuid` + another `devicetype` on an existing UI3 device changes its type.
- `uuid` alone, or `uuid` + another `devicetype`, for an unknown uuid creates an empty "No device name" device (type "Other", or the given type).
- Registering with another `devicetype` and a token creates the device with Push off, even when an administrator registers it.

Requested: return `pushenabled` and `vapidPublicKey` for a `login` with a `uuid`, whatever the `devicetype`, without creating a device or changing an existing one's type.

### Smaller items

- **Regular users need an administrator.** Brian's 11/5 email proposed a "push notifications allowed" user permission, always on for administrators. Users with that permission would get Push on when they register.
- **A test push from UI3** (lower priority), sent only to the requesting device.
