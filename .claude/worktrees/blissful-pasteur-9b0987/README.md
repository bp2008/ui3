# UI3
UI3 is a powerful, modern HTML5 web interface for Blue Iris.  Since April 20, 2018, UI3 is Blue Iris's default web interface for non-IE browsers and is included with Blue Iris versions 4.7.3 and newer.

![Screenshot of UI3-268](https://github.com/bp2008/ui3/assets/5639911/a3a7fabb-9e08-4df0-a809-13fccda09c1b)

## Discuss on ipcamtalk

UI3 has a dedicated thread on the **ipcamtalk** forum, here:

https://ipcamtalk.com/threads/blue-iris-ui3.23528/

## Manual installation

Be aware that most UI3 releases are developed against the **latest Blue Iris version** at the time of UI3 release.  Compatibility with older Blue Iris versions is not maintained, so any time you update UI3 without being on the latest version of Blue Iris, you risk encountering broken features and other bugs.

If you wish to manually install a UI3 update, you can get it from the releases tab: https://github.com/bp2008/ui3/releases

To install, just extract everything to Blue Iris's `www` directory and overwrite all files.  The default path to this folder is `C:\Program Files\Blue Iris 5\www`.

### Blue Iris 4.x Users

The last Blue Iris 4 release (4.8.6.3) shipped with [UI3-70](https://github.com/bp2008/ui3/releases/tag/70), but you can update to [UI3-77](https://github.com/bp2008/ui3/releases/tag/77) for a few improvements.  Things will begin breaking if you update beyond UI3-77 on a Blue Iris 4.x installation.

## H.265 Support

H.265 support requires UI3-306 or newer and Blue Iris 5.9.9.99 from 2025-11-13 or newer. As of the 2025-11-15 release there are still a few known bugs on Blue Iris's end.

This is a compatibility matrix of systems I've tested H.265 on, along with the results.

|                Environment               |   HTML5 Player  | WebCodecs Player | JavaScript Player |
|:-----------------------------------------|:----------------|:-----------------|:------------------|
| Chrome Win11 Nvidia GPU                  | ✅works         | ✅works         | Not supported     |
| Chrome Win10 Intel iGPU                  | ✅works         | ✅works          | Not supported     |
| Firefox Win11 Nvidia GPU                 | ✅works         | ❌decoder errors | Not supported     |
| Chrome Android                           | ✅works         | ✅works          | Not supported     |
| Chrome Mac OS (M4)                       | ✅works         | ✅works          | Not supported     |
| Firefox Mac OS (M4)                      | ✅works         | ❌decoder errors | Not supported     |
| Safari Mac OS (M4)                       | ✅works         | ✅works          | Not supported     |
| Chrome Linux Mint 22.2 Cinnamon AMD iGPU | ❌decoder errors | ❌decoder errors | Not supported     |

UI3's "JavaScript" player does not support H.265.  While it is within the realm of possibility to support H.265 with a JavaScript-based player, it would be quite inefficient (CPU-intensive).
