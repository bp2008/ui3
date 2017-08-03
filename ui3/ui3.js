/// <reference path="ui3-local-overrides.js" />
/// <reference path="libs-src/jquery-1.11.3.js" />
/// <reference path="libs-ui3.js" />
/// This web interface is licensed under the GNU LGPL Version 3
"use strict";
var developerMode = false;

var pnacl_player_supported = false;

///////////////////////////////////////////////////////////////
// Feature Detect /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function DoUIFeatureDetection()
{
	try
	{
		requestAnimationFramePolyFill();
		if (!isCanvasSupported())
			MissingRequiredFeature("HTML5 Canvas"); // Excludes IE 8
		else if (!isLocalStorageEnabled())
			MissingRequiredFeature("Local Storage");
		else
		{
			pnacl_player_supported = BrowserIsChrome() && navigator.mimeTypes['application/x-pnacl'] !== undefined;
			// All critical tests pass
			return;
		}
		// A critical test failed
		location.href = "/jpegpull.htm";
	}
	catch (ex)
	{
		alert("Unknown error during feature detection. This web browser is likely incompatible.");
		try
		{
			console.log(ex);
		}
		catch (ex2)
		{
		}
	}
}
function MissingRequiredFeature(featureName)
{
	alert("This web interface requires a feature that is unavailable or disabled in your web browser.\n\nMissing feature: " + featureName + "\n\nYou will be redirected to a simpler web interface.");
}
function isCanvasSupported()
{
	var elem = document.createElement('canvas');
	return !!(elem.getContext && elem.getContext('2d'));
}
function isLocalStorageEnabled()
{
	try
	{
		var key = "local_storage_test_item";
		localStorage.setItem(key, key);
		localStorage.removeItem(key);
		return true;
	} catch (e)
	{
		return false;
	}
}
function isHtml5HistorySupported()
{
	try
	{
		if (window.history && typeof window.history.state == "object" && typeof window.history.pushState == "function" && typeof window.history.replaceState == "function")
			return true;
		return false;
	} catch (e)
	{
		return false;
	}
}
function requestAnimationFramePolyFill()
{
	try
	{
		if (typeof requestAnimationFrame != "function")
			requestAnimationFrame = function (callback) { setTimeout(callback, 33); };
		return true;
	}
	catch (e)
	{
		return false;
	}
}

DoUIFeatureDetection();
///////////////////////////////////////////////////////////////
// Globals (most of them) /////////////////////////////////////
///////////////////////////////////////////////////////////////
var toaster = new Toaster();
var loadingHelper = new LoadingHelper();
var touchEvents = new TouchEventHelper();
var uiSizeHelper = null;
var audioPlayer = null;
var diskUsageGUI = null;
var systemLog = null;
var systemConfig = null;
var cameraProperties = null;
var cameraListDialog = null;
var clipProperties = null;
var clipDownloadDialog = null;
var statusBars = null;
var dropdownBoxes = null;
var jpegQualityHelper = null;
var ptzButtons = null;
var playbackHeader = null;
var seekBar = null;
var playbackControls = null;
var clipTimeline = null;
var hotkeys = null;
var dateFilter = null;
var hlsPlayer = null;
var fullScreenModeController = null;
var canvasContextMenu = null;
var calendarContextMenu = null;
var clipListContextMenu = null;
var togglableContextMenus = null;
var cameraConfig = null;
var videoPlayer = null;
var imageRenderer = null;
var sessionManager = null;
var statusLoader = null;
var cameraListLoader = null;
var clipLoader = null;

var currentPrimaryTab = "";
var skipTabLoadClipLoad = false;

var togglableUIFeatures =
	[
		// The uniqueId is also used in the name of a setting which remembers the enabled state.
		// If you add a new togglabe UI feature here, also add the corresponding default setting value.
		// [selector, uniqueId, displayName, onToggle, extraMenuButtons]
		["#volumeBar", "volumeBar", "Volume Controls", function (enabled)
		{
			statusBars.setEnabled("volume", enabled);
			if (enabled)
				$("#volumeBar").removeClass("disabled")
			else
				$("#volumeBar").addClass("disabled")
		}, null, null]
		, ["#profileStatusBox", "profileStatus", "Profile Status Controls", function (enabled) { statusLoader.SetProfileButtonsEnabled(enabled); }, null, null]
		, ["#stoplightBtn", "stopLight", "Stoplight Controls", function (enabled) { statusLoader.SetStoplightButtonEnabled(enabled); }, null, null]
		, ["#globalScheduleBox", "globalSchedule", "Schedule Controls", function (enabled) { dropdownBoxes.setEnabled("schedule", enabled); }, null, null]
		// The PTZ Controls hot area specifically does not include the main button pad because a context menu on that pad would break touchscreen usability
		, [".ptzpreset", "ptzControls", "PTZ Controls", function (enabled) { ptzButtons.setEnabled(enabled); }
			, [{
				getName: function (ele) { return "Goto Preset " + ele.getAttribute("presetnum") + htmlEncode(ptzButtons.GetPresetDescription(ele.getAttribute("presetnum"), true)); }
				, action: function (ele) { ptzButtons.PTZ_goto_preset(ele.presetnum); }
				, shouldDisable: function () { return !ptzButtons.isEnabledNow(); }
			}
				, {
				getName: function (ele) { return "Set Preset " + ele.getAttribute("presetnum"); }
				, action: function (ele) { ptzButtons.PresetSet(ele.getAttribute("presetnum")); }
				, shouldDisable: function () { return !ptzButtons.isEnabledNow(); }
			}]
			, function () { return !videoPlayer.Loading().image.ptz; }
		]
		, ["#playbackHeader", "clipNameLabel", "Clip Name", function (enabled)
		{
			if (enabled)
				$("#clipNameHeading").show();
			else
				$("#clipNameHeading").hide();
		}, null, null, ["Show", "Hide", "Toggle"]]
	];
// TODO: Make PTZ presets work better on touchscreens.  Including the text box to set preset description on a phone. (android)
// TODO: Add URL parameters for loading a camera, group, or fullscreen mode.
// TODO: Delay start of h264 streaming until player is fully loaded.
// TODO: Handle single-deletion failure messages better.

// TODO: Suppress hotkeys while dialogs are open.

// TODO: Throttle rapid clip changes to prevent heavy Blue Iris server load.

// TODO: Server-side ptz preset thumbnails.  Prerequisite: Server-side ptz preset thumbnails.

// TODO: UI Settings
// -- Including an option to forget saved credentials.
// -- MAYBE Including an option to update the clip list automatically (on by default) ... to reduce bandwidth usage ??
// -- Hardware acceleration option for pnacl_player (off by default, because it significantly slows the stream startup time)
// -- -- on the embed element, hwaccel value 0 is NO HWVA.  1 is HWVA with fallback.  2 is HWVA only.
// -- Long press to open context menus (enabling this should disable longpress to set preset).  Affects some devices, e.g. samsung smart TV remote control
// -- Idle Timeout (minutes).  Enabled by default, overridable in local overrides script.
// -- Option for UI size.

// TODO: Redesign the video player to be more of a plug-in module so the user can switch between jpeg and H.264 streaming, or MAYBE even the ActiveX control.  This is tricky as I still want the download snapshot and Open in new tab functions to work regardless of video streaming method.  I probably won't start this until Blue Iris has H.264/WebSocket streaming capability.

// CONSIDER: (+1 Should be pretty easy) Admin login prompt could pass along a callback method, to refresh panels like the server log, server configuration, full camera list, camera properties.
// CONSIDER: (+1 Should be pretty easy) "Your profile has changed" messages could include the previous and new profile names and numbers.
// CONSIDER: (+1 Should be pretty easy) Clicking the speaker icon should toggle volume between 0 and its last otherwise-set position.
// CONSIDER: (-1 Most people would not use it, and forces backwards compatibility) Multiple-server support, like in UI2
// TODO: Adjust frame rate status bar maximum based on currently active camera or group (defaulting to 10 FPS if none is available)
// CONSIDER: (-1 Likely not useful except on LAN, where bandwidth is abundant) Artificially limit the jpeg refresh rate if Blue Iris reports the camera has a lower frame rate than we are actually streaming.  This would reduce wasted bandwidth.
// CONSIDER: (-1 Added complexity and space usage, not necessarily useful without multi-clip simultaneous playback) Timeline control.  Simplified format at first.  Maybe show the current day, the last 24 hours, or the currently loaded time range.  Selecting a time will scroll the clip list (and begin playback of the most appropriate clip?)
// CONSIDER: Double-click in the clip player could perform some action, like play/pause or fullscreen mode.
// CONSIDER: Single-click in the clip player could clear the current clip selection state, select the active clip, and scroll to it.
// CONSIDER: Replace dialog panels with better versions.  More modern.  Draggable.  Maybe resizable.  Remember to suppress hotkeys while any dialog is open.
// CONSIDER: Allow an open clip to remain open even if the clip list no longer contains the clip.  This requires that the clip list is never queried again as long as the clip remains open, but opens the door to linking someone to a specific clip in the future, without forcing them to find the clip in their own clip list.
// CONSIDER: An alternate layout that automatically loads when the UI has significantly more height than width (e.g. portrait view)

///////////////////////////////////////////////////////////////
// Settings ///////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var settings = null;
var defaultSettings =
	[
		{
			key: "ui3_defaultTab"
			, value: "live"
		}
		, {
			key: "ui3_defaultCameraGroupId"
			, value: "index"
		}
		, {
			key: "ui3_audioVolume"
			, value: 0
		}
		, {
			key: "ui3_jpegStreamingQuality"
			, value: "A"
		}
		, {
			key: "ui3_playback_reverse"
			, value: "0"
		}
		, {
			key: "ui3_playback_speed"
			, value: "1"
		}
		, {
			key: "ui3_playback_autoplay"
			, value: "0"
		}
		, {
			key: "ui3_playback_loop"
			, value: "0"
		}
		, {
			key: "bi_rememberMe"
			, value: "0"
		}
		, {
			key: "bi_username"
			, value: ""
		}
		, {
			key: "bi_password"
			, value: ""
		}
		, {
			key: "ui3_feature_enabled_volumeBar" // ui3_feature_enabled keys are tied to unique IDs in togglableUIFeatures
			, value: "1"
		}
		, {
			key: "ui3_feature_enabled_profileStatus"
			, value: "1"
		}
		, {
			key: "ui3_feature_enabled_stopLight"
			, value: "1"
		}
		, {
			key: "ui3_feature_enabled_globalSchedule"
			, value: "1"
		}
		, {
			key: "ui3_feature_enabled_ptzControls"
			, value: "1"
		}
		, {
			key: "ui3_feature_enabled_clipNameLabel"
			, value: "1"
		}
		, {
			key: "ui3_collapsible_ptzPresets"
			, value: "1"
		}
		, {
			key: "ui3_collapsible_profileStatus"
			, value: "1"
		}
		, {
			key: "ui3_collapsible_schedule"
			, value: "1"
		}
		, {
			key: "ui3_collapsible_currentGroup"
			, value: "1"
		}
		, {
			key: "ui3_collapsible_streamingQuality"
			, value: "1"
		}
		, {
			key: "ui3_collapsible_serverStatus"
			, value: "1"
		}
		, {
			key: "ui3_collapsible_filterRecordings"
			, value: "1"
		}
		, {
			key: "ui3_hotkey_togglefullscreen"
			, value: "1|0|0|192" // 192: tilde (~`)
			, hotkey: true
			, label: "Full Screen Mode"
			, hint: "Toggles the browser between full screen and windowed mode.  Most browsers also go fullscreen when you press F11, regardless of what you set here."
			, actionDown: BI_Hotkey_FullScreen
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_playpause"
			, value: "0|0|0|32" // 32: space
			, hotkey: true
			, label: "Play/Pause"
			, hint: "Plays or pauses the current recording."
			, actionDown: BI_Hotkey_PlayPause
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_newerClip"
			, value: "0|0|0|38" // 38: up arrow
			, hotkey: true
			, label: "Next Clip"
			, hint: '<img src="ui2/NextClip.png" style="float:right;height:48px" />'
			+ "Load the next clip, higher up in the list."
			, actionDown: BI_Hotkey_NextClip
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_olderClip"
			, value: "0|0|0|40" // 40: down arrow
			, hotkey: true
			, label: "Previous Clip"
			, hint: "Load the previous clip, lower down in the list."
			, actionDown: BI_Hotkey_PreviousClip
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_skipAhead"
			, value: "0|0|0|39" // 39: right arrow
			, hotkey: true
			, label: "Skip Ahead:"
			, hint: "Skips ahead in the current recording by a configurable number of seconds."
			, actionDown: BI_Hotkey_SkipAhead
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_skipBack"
			, value: "0|0|0|37" // 37: left arrow
			, hotkey: true
			, label: "Skip Back:"
			, hint: "Skips back in the current recording by a configurable number of seconds."
			, actionDown: BI_Hotkey_SkipBack
			, category: "Hotkeys"
		}
		, {
			key: "ui3_skipAmount"
			, value: 10
			, inputType: "number"
			, inputWidth: 40
			, minValue: 1
			, maxValue: 9999
			, label: "Skip Time (seconds)"
			, hint: "[1-9999] (default: 10) \r\nNumber of seconds to skip forward and back when using hotkeys to skip."
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalZoomIn"
			, value: "0|0|1|187" // 187: =
			, hotkey: true
			, label: "Digital Zoom In"
			, hint: "This has the same function as rolling a mouse wheel upward."
			, actionDown: BI_Hotkey_DigitalZoomIn
			, allowRepeatKey: true
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalZoomOut"
			, value: "0|0|1|189" // : 189: -
			, hotkey: true
			, label: "Digital Zoom Out"
			, hint: "This has the same function as rolling a mouse wheel downward."
			, actionDown: BI_Hotkey_DigitalZoomOut
			, allowRepeatKey: true
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalPanUp"
			, value: "0|0|1|38" // 38: up arrow
			, hotkey: true
			, label: "Digital Pan Up"
			, hint: "If zoomed in with digital zoom, pans up."
			, actionDown: BI_Hotkey_DigitalPanUp
			, actionUp: BI_Hotkey_DigitalPanUp_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalPanDown"
			, value: "0|0|1|40" // 40: down arrow
			, hotkey: true
			, label: "Digital Pan Down"
			, hint: "If zoomed in with digital zoom, pans down."
			, actionDown: BI_Hotkey_DigitalPanDown
			, actionUp: BI_Hotkey_DigitalPanDown_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalPanLeft"
			, value: "0|0|1|37" // 37: left arrow
			, hotkey: true
			, label: "Digital Pan Left"
			, hint: "If zoomed in with digital zoom, pans left."
			, actionDown: BI_Hotkey_DigitalPanLeft
			, actionUp: BI_Hotkey_DigitalPanLeft_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalPanRight"
			, value: "0|0|1|39" // 39: right arrow
			, hotkey: true
			, label: "Digital Pan Right"
			, hint: "If zoomed in with digital zoom, pans right."
			, actionDown: BI_Hotkey_DigitalPanRight
			, actionUp: BI_Hotkey_DigitalPanRight_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzUp"
			, value: "0|0|0|38" // 38: up arrow
			, hotkey: true
			, label: "PTZ Up"
			, hint: "If the current live camera is PTZ, moves the camera up."
			, actionDown: BI_Hotkey_PtzUp
			, actionUp: BI_Hotkey_PtzUp_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzDown"
			, value: "0|0|0|40" // 40: down arrow
			, hotkey: true
			, label: "PTZ Down"
			, hint: "If the current live camera is PTZ, moves the camera down."
			, actionDown: BI_Hotkey_PtzDown
			, actionUp: BI_Hotkey_PtzDown_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzLeft"
			, value: "0|0|0|37" // 37: left arrow
			, hotkey: true
			, label: "PTZ Left"
			, hint: "If the current live camera is PTZ, moves the camera left."
			, actionDown: BI_Hotkey_PtzLeft
			, actionUp: BI_Hotkey_PtzLeft_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzRight"
			, value: "0|0|0|39" // 39: right arrow
			, hotkey: true
			, label: "PTZ Right"
			, hint: "If the current live camera is PTZ, moves the camera right."
			, actionDown: BI_Hotkey_PtzRight
			, actionUp: BI_Hotkey_PtzRight_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzIn"
			, value: "0|0|0|187" // 187: =
			, hotkey: true
			, label: "PTZ Zoom In"
			, hint: "If the current live camera is PTZ, zooms the camera in."
			, actionDown: BI_Hotkey_PtzIn
			, actionUp: BI_Hotkey_PtzIn_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzOut"
			, value: "0|0|0|189" // 189: -
			, hotkey: true
			, label: "PTZ Zoom Out"
			, hint: "If the current live camera is PTZ, zooms the camera out."
			, actionDown: BI_Hotkey_PtzOut
			, actionUp: BI_Hotkey_PtzOut_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset1"
			, value: "0|0|0|49" // 49: 1
			, hotkey: true
			, label: "Load Preset 1:"
			, hint: "If the current live camera is PTZ, loads preset 1."
			, actionDown: function () { BI_Hotkey_PtzPreset(1); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset2"
			, value: "0|0|0|50" // 50: 2
			, hotkey: true
			, label: "Load Preset 2:"
			, hint: "If the current live camera is PTZ, loads preset 2."
			, actionDown: function () { BI_Hotkey_PtzPreset(2); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset3"
			, value: "0|0|0|51" // 51: 3
			, hotkey: true
			, label: "Load Preset 3:"
			, hint: "If the current live camera is PTZ, loads preset 3."
			, actionDown: function () { BI_Hotkey_PtzPreset(3); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset4"
			, value: "0|0|0|52" // 52: 4
			, hotkey: true
			, label: "Load Preset 4:"
			, hint: "If the current live camera is PTZ, loads preset 4."
			, actionDown: function () { BI_Hotkey_PtzPreset(4); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset5"
			, value: "0|0|0|53" // 53: 5
			, hotkey: true
			, label: "Load Preset 5:"
			, hint: "If the current live camera is PTZ, loads preset 5."
			, actionDown: function () { BI_Hotkey_PtzPreset(5); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset6"
			, value: "0|0|0|54" // 54: 6
			, hotkey: true
			, label: "Load Preset 6:"
			, hint: "If the current live camera is PTZ, loads preset 6."
			, actionDown: function () { BI_Hotkey_PtzPreset(6); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset7"
			, value: "0|0|0|55" // 55: 7
			, hotkey: true
			, label: "Load Preset 7:"
			, hint: "If the current live camera is PTZ, loads preset 7."
			, actionDown: function () { BI_Hotkey_PtzPreset(7); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset8"
			, value: "0|0|0|56" // 56: 8
			, hotkey: true
			, label: "Load Preset 8:"
			, hint: "If the current live camera is PTZ, loads preset 8."
			, actionDown: function () { BI_Hotkey_PtzPreset(8); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset9"
			, value: "0|0|0|57" // 57: 9
			, hotkey: true
			, label: "Load Preset 9:"
			, hint: "If the current live camera is PTZ, loads preset 9."
			, actionDown: function () { BI_Hotkey_PtzPreset(9); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset10"
			, value: "0|0|0|48" // 48: 0
			, hotkey: true
			, label: "Load Preset 10:"
			, hint: "If the current live camera is PTZ, loads preset 10."
			, actionDown: function () { BI_Hotkey_PtzPreset(10); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset11"
			, value: "1|0|0|49" // 49: 1
			, hotkey: true
			, label: "Load Preset 11:"
			, hint: "If the current live camera is PTZ, loads preset 11."
			, actionDown: function () { BI_Hotkey_PtzPreset(11); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset12"
			, value: "1|0|0|50" // 50: 2
			, hotkey: true
			, label: "Load Preset 12:"
			, hint: "If the current live camera is PTZ, loads preset 12."
			, actionDown: function () { BI_Hotkey_PtzPreset(12); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset13"
			, value: "1|0|0|51" // 51: 3
			, hotkey: true
			, label: "Load Preset 13:"
			, hint: "If the current live camera is PTZ, loads preset 13."
			, actionDown: function () { BI_Hotkey_PtzPreset(13); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset14"
			, value: "1|0|0|52" // 52: 4
			, hotkey: true
			, label: "Load Preset 14:"
			, hint: "If the current live camera is PTZ, loads preset 14."
			, actionDown: function () { BI_Hotkey_PtzPreset(14); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset15"
			, value: "1|0|0|53" // 53: 5
			, hotkey: true
			, label: "Load Preset 15:"
			, hint: "If the current live camera is PTZ, loads preset 15."
			, actionDown: function () { BI_Hotkey_PtzPreset(15); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset16"
			, value: "1|0|0|54" // 54: 6
			, hotkey: true
			, label: "Load Preset 16:"
			, hint: "If the current live camera is PTZ, loads preset 16."
			, actionDown: function () { BI_Hotkey_PtzPreset(16); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset17"
			, value: "1|0|0|55" // 55: 7
			, hotkey: true
			, label: "Load Preset 17:"
			, hint: "If the current live camera is PTZ, loads preset 17."
			, actionDown: function () { BI_Hotkey_PtzPreset(17); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset18"
			, value: "1|0|0|56" // 56: 8
			, hotkey: true
			, label: "Load Preset 18:"
			, hint: "If the current live camera is PTZ, loads preset 18."
			, actionDown: function () { BI_Hotkey_PtzPreset(18); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset19"
			, value: "1|0|0|57" // 57: 9
			, hotkey: true
			, label: "Load Preset 19:"
			, hint: "If the current live camera is PTZ, loads preset 19."
			, actionDown: function () { BI_Hotkey_PtzPreset(19); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_BI_Hotkey_PtzPreset20"
			, value: "1|0|0|48" // 48: 0
			, hotkey: true
			, label: "Load Preset 20:"
			, hint: "If the current live camera is PTZ, loads preset 20."
			, actionDown: function () { BI_Hotkey_PtzPreset(20); }
			, category: "Hotkeys"
		}
	];

function OverrideDefaultSetting(key, value, IncludeInOptionsWindow, AlwaysReload, Generation)
{
	/// <summary>
	/// Overrides a default setting. This method is intended to be called by the ui3_local_overrides.js file.
	/// </summary>
	for (var i = 0; i < defaultSettings.length; i++)
		if (defaultSettings[i].key == key)
		{
			defaultSettings[i].value = value;
			defaultSettings[i].AlwaysReload = AlwaysReload;
			defaultSettings[i].Generation = Generation;
			if (!IncludeInOptionsWindow)
				defaultSettings[i].preLabel = null;
			break;
		}
}
function LoadDefaultSettings()
{
	if (settings == null) // This null check allows previously-available local overrides templates to replace the settings object.
		settings = GetLocalStorageWrapper();
	for (var i = 0; i < defaultSettings.length; i++)
	{
		if (settings.getItem(defaultSettings[i].key) == null
			|| defaultSettings[i].AlwaysReload
			|| IsNewGeneration(defaultSettings[i].key, defaultSettings[i].Generation))
			settings.setItem(defaultSettings[i].key, defaultSettings[i].value);
	}
}
function GetLocalStorage()
{
	/// <summary>
	/// Returns the localStorage object, or a dummy localStorage object if the localStorage object is not available.
	/// This method should be used only when the wrapped localStorage object is not desired (e.g. when using settings that are persisted globally, not specific to a Blue Iris server).
	/// </summary>
	try
	{
		if (typeof (Storage) !== "undefined" && localStorage)
			return localStorage; // May throw exception if local storage is disabled by browser settings!
	}
	catch (ex)
	{
	}
	return GetDummyLocalStorage();
}
function IsNewGeneration(key, gen)
{
	if (typeof gen == "undefined" || gen == null)
		return false;

	gen = parseInt(gen);
	var currentGen = settings.getItem("ui3_gen_" + key);
	if (currentGen == null)
		currentGen = 0;
	else
		currentGen = parseInt(currentGen);

	var isNewGen = gen > currentGen;
	if (isNewGen)
		settings.setItem("ui3_gen_" + key, gen);
	return isNewGen;
}
function GetLocalStorageWrapper()
{
	/// <summary>Returns the local storage object or a wrapper suitable for the current Blue Iris server. The result of this should be stored in the settings variable.</summary>
	if (typeof (Storage) !== "undefined" && localStorage)
	{
		if (currentServer.isUsingRemoteServer)
		{
			if (typeof Object.defineProperty == "function")
				return GetRemoteServerLocalStorage();
			else
			{
				toaster.Error("Your browser is not compatible with Object.defineProperty which is necessary to use remote servers.", 10000);
				SetRemoteServer("");
				return GetLocalStorage();
			}
		}
		else
			return GetLocalStorage();
	}
	return GetDummyLocalStorage()
}
function GetRemoteServerLocalStorage()
{
	if (!ValidateRemoteServerNameSimpleRules(remoteServerName))
	{
		toaster.Error("Unable to validate remote server name. Connecting to local server instead.", 10000);
		SetRemoteServer("");
		return GetLocalStorage();
	}

	var serverNamePrefix = remoteServerName.toLowerCase().replace(/ /g, '_') + "_";

	var myLocalStorage = GetLocalStorage();
	var wrappedStorage = new Object();
	wrappedStorage.getItem = function (key)
	{
		return myLocalStorage[serverNamePrefix + key];
	};
	wrappedStorage.setItem = function (key, value)
	{
		return (myLocalStorage[serverNamePrefix + key] = value);
	};
	for (var i = 0; i < defaultSettings.length; i++)
	{
		var tmp = function (key)
		{
			Object.defineProperty(wrappedStorage, key,
				{
					get: function ()
					{
						return wrappedStorage.getItem(key);
					},
					set: function (value)
					{
						return wrappedStorage.setItem(key, value);
					}
				});
		}(defaultSettings[i].key);
	}
	return wrappedStorage;
}
var localStorageDummy = null;
function GetDummyLocalStorage()
{
	if (localStorageDummy == null)
	{
		var dummy = new Object();
		dummy.getItem = function (key)
		{
			return dummy[key];
		};
		dummy.setItem = function (key, value)
		{
			return (dummy[key] = value);
		};
		localStorageDummy = dummy;
	}
	return localStorageDummy;
}
///////////////////////////////////////////////////////////////
// UI Loading /////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
$(function ()
{
	if (location.protocol == "file:")
	{
		var fileSystemErrorMessage = "This interface must be loaded through the Blue Iris web server, and cannot function when loaded directly from your filesystem.";
		alert(fileSystemErrorMessage);
		toaster.Error(fileSystemErrorMessage, 60000);
	}

	LoadDefaultSettings();

	currentPrimaryTab = ValidateTabName(settings.ui3_defaultTab);

	ptzButtons = new PtzButtons();

	$.ajax({
		url: "ui3/icons.svg?v=" + combined_version,
		dataType: "html",
		cache: true,
		success: function (data)
		{
			$("#svgContainer").html(data);
			loadingHelper.SetLoadedStatus("svg");

			BI_CustomEvent.Invoke("svgLoaded");
		},
		error: function (jqXHR, textStatus, errorThrown)
		{
			loadingHelper.SetErrorStatus("svg", "When trying to load icons.svg, server returned status:<br/>" + jqXHR.status + " " + jqXHR.statusText);
		}
	});

	$("#layoutleftLiveScrollable").CustomScroll(
		{
			changeMarginRightToScrollBarWidth: false
			, trackClass: 'layoutleft-track'
			, handleClass: 'layoutleft-track-handle'
		});
	$("#clipsbody").CustomScroll(
		{
			changeMarginRightToScrollBarWidth: false
			, trackClass: 'layoutleft-track'
			, handleClass: 'layoutleft-track-handle'
		});
	$(".topbar_tab").click(function ()
	{
		var $ele = $(this);
		$(".topbar_tab").removeClass("selected");
		$ele.addClass("selected");

		currentPrimaryTab = settings.ui3_defaultTab = $ele.attr("name");

		var tabDisplayName;
		if (currentPrimaryTab == "live")
		{
			tabDisplayName = "Live";
			$("#layoutleftLive").show();
			$("#layoutleftRecordings").hide();
			//$("#layoutbottom").hide();
		}
		else
		{
			tabDisplayName = currentPrimaryTab == "clips" ? "Clips" : "Alerts";
			$("#layoutleftLive").hide();
			$("#layoutleftRecordings").show();
			//$("#layoutbottom").show();
			$("#recordingsFilterByHeading").text("Filter " + tabDisplayName + " by:");
		}
		if (skipTabLoadClipLoad)
			skipTabLoadClipLoad = false;
		else
			BI_CustomEvent.Invoke("TabLoaded_" + currentPrimaryTab);
		resized();
	});
	BI_CustomEvent.AddListener("TabLoaded_live", function () { videoPlayer.goLive(); });
	BI_CustomEvent.AddListener("TabLoaded_clips", function () { clipLoader.LoadClips("cliplist"); });
	BI_CustomEvent.AddListener("TabLoaded_alerts", function () { clipLoader.LoadClips("alertlist"); });

	uiSizeHelper = new UiSizeHelper();

	audioPlayer = new AudioPlayer();

	diskUsageGUI = new DiskUsageGUI();

	systemLog = new SystemLog();

	systemConfig = new SystemConfig();

	cameraProperties = new CameraProperties();

	cameraListDialog = new CameraListDialog();

	clipProperties = new ClipProperties();

	clipDownloadDialog = new ClipDownloadDialog();

	statusBars = new StatusBars();
	statusBars.setLabel("volume", '<svg class="volumeButton icon"><use xlink:href="#svg_x5F_Volume"></use></svg>');
	statusBars.addDragHandle("volume");
	statusBars.addOnProgressChangedListener("volume", function (newVolume)
	{
		newVolume = Clamp(parseFloat(newVolume), 0, 1);
		settings.ui3_audioVolume = newVolume;
		audioPlayer.SetVolume(newVolume);
	});
	statusBars.setProgress("volume", parseFloat(settings.ui3_audioVolume), "");

	dropdownBoxes = new DropdownBoxes();

	jpegQualityHelper = new JpegQualityHelper();

	SetupCollapsibleTriggers();

	seekBar = new SeekBar();

	playbackHeader = new PlaybackHeader();

	playbackControls = new PlaybackControls();

	clipTimeline = new ClipTimeline();

	hotkeys = new BI_Hotkeys();

	dateFilter = new DateFilter("#dateRangeLabel");

	hlsPlayer = new HLSPlayer();

	fullScreenModeController = new FullScreenModeController();

	canvasContextMenu = new CanvasContextMenu();

	calendarContextMenu = new CalendarContextMenu();

	clipListContextMenu = new ClipListContextMenu();

	cameraConfig = new CameraConfig();

	videoPlayer = new VideoPlayerController();

	imageRenderer = new ImageRenderer();

	statusLoader = new StatusLoader();

	sessionManager = new SessionManager();

	cameraListLoader = new CameraListLoader();

	clipLoader = new ClipLoader("#clipsbody");

	togglableContextMenus = new Array();
	for (var i = 0; i < togglableUIFeatures.length; i++)
	{
		var item = togglableUIFeatures[i];
		if (item.length < 4)
			continue;
		if (item.length < 5)
			item.push(null);
		if (item.length < 6)
			item.push(null);
		if (item.length < 7)
			item.push(["Enable", "Disable", "Toggle"]);
		else if (item[6].length != 3)
			item[6] = ["Enable", "Disable", "Toggle"];

		togglableContextMenus.push(new ContextMenu_EnableDisableItem(item[0], item[1], item[2], item[3], item[4], item[5], item[6]));
	}

	// This makes it impossible to text-select or drag certain UI elements.
	makeUnselectable($("#layouttop, #layoutleft, #layoutdivider, #layoutbody"));

	sessionManager.Initialize();

	$(window).resize(resized);
	if (currentPrimaryTab == "alerts" || currentPrimaryTab == "clips")
		skipTabLoadClipLoad = true; // Prevent one clip load, to keep from loading twice.
	$('.topbar_tab[name="' + currentPrimaryTab + '"]').click(); // this calls resized()
});
function ValidateTabName(tabName)
{
	if (tabName == "live" || tabName == "alerts" || tabName == "clips")
		return tabName;
	return "live";
}
function SetupCollapsibleTriggers()
{
	$(".collapsibleTrigger,.serverStatusLabel").each(function (idx, ele)
	{
		var $ele = $(ele);
		var collapsibleid = $ele.attr('collapsibleid');
		if (collapsibleid && collapsibleid.length > 0 && settings["ui3_collapsible_" + collapsibleid] != "1")
			$ele.next().hide();
		if ($ele.next().is(":visible"))
			$ele.removeClass("collapsed");
		else
			$ele.addClass("collapsed");
		$ele.click(function (e)
		{
			$ele.next().slideToggle({
				duration: 100
				, complete: function ()
				{
					var vis = $ele.next().is(":visible");
					if (vis)
						$ele.removeClass("collapsed");
					else
						$ele.addClass("collapsed");
					if (collapsibleid && collapsibleid.length > 0)
						settings["ui3_collapsible_" + collapsibleid] = vis ? "1" : "0";
					if ($ele.hasClass("serverStatusLabel") || $ele.attr("id") == "recordingsFilterByHeading")
						resized();
				}
			});
		});
		if (!$ele.hasClass("serverStatusLabel"))
			$ele.prepend('<svg class="icon collapsibleTriggerIcon"><use xlink:href="#svg_x5F_PTZcardinalDown"></use></svg>');
	});
}
function SetUISize(size)
{
	uiSizeHelper.autoSize = size == "auto";
	if (!uiSizeHelper.autoSize)
		uiSizeHelper.SetSize(size);
	resized();
	//setTimeout(resized);
}
///////////////////////////////////////////////////////////////
// UI Resize //////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function resized()
{
	var windowW = $(window).width();
	var windowH = $(window).height();

	// Adjust UI style presets based on window size
	uiSizeHelper.SetMostAppropriateSize(windowW, windowH);

	// Learn some sizes
	var layouttop = $("#layouttop");
	var layoutleft = $("#layoutleft");
	var layoutbody = $("#layoutbody");
	var layoutbottom = $("#layoutbottom");
	var statusArea = $("#statusArea");
	var llrControls = $("#layoutLeftRecordingsControls");
	var systemnamewrapper = $("#systemnamewrapper");

	var topVis = layouttop.is(":visible");
	var leftVis = layoutleft.is(":visible");
	var botVis = layoutbottom.is(":visible");

	var topH = topVis ? layouttop.height() : 0;
	var botH = botVis ? layoutbottom.height() : 0;
	var leftH = leftVis ? (windowH - topH) : 0;
	var leftW = leftVis ? layoutleft.width() : 0;
	var statusH = statusArea.outerHeight(true);

	// Size layouttop
	// Measure width of objects in top bar
	var systemNameWidth = systemnamewrapper.width();
	var topTabCurrentWidth = -1000;
	var topWidthNoTabs = 5; // Workaround for rounding errors
	layouttop.children().each(function (idx, ele)
	{
		var $ele = $(ele);
		var w = $ele.outerWidth(true);
		if ($ele.hasClass("topbar_tab"))
			topTabCurrentWidth = w;
		else if ($ele.attr("id") != "systemnamewrapper")
			topWidthNoTabs += w;
	});
	// Determine how much space is needed for top bar
	var topTabDesiredWidth = leftW;
	var topTabAllowableWidth = topTabDesiredWidth;
	var systemNameAllowableWidth = topTabDesiredWidth;
	var topBarDesiredWidth = topWidthNoTabs + (4 * topTabDesiredWidth);
	var topTabMinWidth = 42;
	if (topBarDesiredWidth > windowW)
	{
		topTabAllowableWidth = Math.min(topTabDesiredWidth, ((windowW - topWidthNoTabs) - topTabDesiredWidth) / 3);
		if (topTabAllowableWidth < topTabMinWidth)
		{
			topTabAllowableWidth = topTabMinWidth;
			systemNameAllowableWidth = (windowW - topWidthNoTabs) - (topTabAllowableWidth * 3);
		}
	}
	if (topTabCurrentWidth != topTabAllowableWidth)
		layouttop.children(".topbar_tab").css("width", topTabAllowableWidth + "px");
	if (systemNameWidth != systemNameAllowableWidth)
		systemnamewrapper.css("width", systemNameAllowableWidth + "px");

	// Size layoutleft
	layoutleft.css("top", topH);
	layoutleft.css("height", leftH + "px");

	if (currentPrimaryTab == "live")
		$("#layoutleftLiveScrollableWrapper").css("height", leftH - statusH + "px");
	else
	{
		var llrControlsH = llrControls.outerHeight(true);
		$("#clipsbodyWrapper").css("height", leftH - statusH - llrControlsH + "px");
	}

	var statusArea_margins = statusArea.outerWidth(true) - statusArea.width();
	statusArea.css("width", (leftW - statusArea_margins) + "px");

	// Size layoutbody
	layoutbody.css("top", topH);
	layoutbody.css("left", leftW + "px");
	layoutbody.css("width", windowW - leftW + "px");
	layoutbody.css("height", windowH - topH - botH + "px");

	playbackControls.resized();

	playbackHeader.resized();

	// Size layoutbottom
	layoutbottom.css("left", leftW + "px");
	layoutbottom.css("width", windowW - leftW + "px");

	clipTimeline.Resized();
	clipTimeline.Draw();

	// Size misc items
	imageRenderer.ImgResized(false);

	dropdownBoxes.Resized();

	// Call other methods to notify that resizing is done
	clipLoader.resizeClipList();
	$.CustomScroll.callMeOnContainerResize();
	BI_CustomEvent.Invoke("afterResize");
}
function UiSizeHelper()
{
	var self = this;
	var largeMinH = 1075;
	var mediumMinH = 815;
	var largeMinW = 670;// 550 575 1160;
	var mediumMinW = 540;// 450 515 900;
	var smallMinW = 350;//680;
	var currentSize = "large";
	this.autoSize = true;

	this.SetMostAppropriateSize = function (availableWidth, availableHeight)
	{
		if (self.autoSize)
		{
			if (availableWidth < smallMinW)
				self.SetSize("smaller");
			else if (availableHeight < mediumMinH || availableWidth < mediumMinW)
				self.SetSize("small");
			else if (availableHeight < largeMinH || availableWidth < largeMinW)
				self.SetSize("medium");
			else
				self.SetSize("large");
		}
	}
	this.SetSize = function (size)
	{
		if (currentSize == size)
			return;
		currentSize = size;
		var $roots = $('body');
		$roots.removeClass("sizeSmaller sizeSmall sizeMedium sizeLarge");
		if (size == "smaller")
			$roots.addClass("sizeSmall sizeSmaller");
		else if (size == "small")
			$roots.addClass("sizeSmall");
		else if (size == "medium")
			$roots.addClass("sizeMedium");
		else
			$roots.addClass("sizeLarge");
	}
	this.GetCurrentSize = function ()
	{
		return currentSize;
	}
}
///////////////////////////////////////////////////////////////
// Progress bar / Scrub bar / Status bar //////////////////////
///////////////////////////////////////////////////////////////
function StatusBars()
{
	var self = this;
	var statusElements = {};
	$(".statusBar").each(function (idx, ele)
	{
		var $ele = $(ele);
		if ($ele.children().length > 0)
			return;
		var statusTiny = $ele.hasClass("statusTiny");
		if (!statusTiny)
			ele.$label = $('<div class="statusBarLabel">' + $ele.attr('label') + '</div>');
		ele.$pb = $('<div></div>');
		if (!statusTiny)
			ele.$amount = $('<div class="statusBarAmount">' + $ele.attr('defaultAmountText') + '</div>');
		$ele.append(ele.$label);
		$ele.append(ele.$pb);
		$ele.append(ele.$amount);
		ProgressBar.initialize(ele.$pb);
		var name = $ele.attr("name");
		if (!statusElements[name])
			statusElements[name] = [];
		statusElements[name].push(ele);
	});
	this.setProgress = function (name, progressAmount, progressAmountText, progressColor, progressBackgroundColor)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
			{
				ProgressBar.setProgress(statusEles[i].$pb, progressAmount);
				ProgressBar.setColor(statusEles[i].$pb, progressColor, progressBackgroundColor);
				statusEles[i].$amount && statusEles[i].$amount.text(progressAmountText);
			}
	};
	this.setTooltip = function (name, tooltipText)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
				$(statusEles[i]).attr("title", tooltipText);
	};
	this.setColor = function (name, progressColor, progressBackgroundColor)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
				ProgressBar.setColor(statusEles[i].$pb, progressColor, progressBackgroundColor);
	};
	this.setLabel = function (name, labelHtml)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
				statusEles[i].$label && statusEles[i].$label.html(labelHtml);
	};
	this.getLabelObjs = function (name, labelHtml)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			return $(statusEles);
	};
	this.addDragHandle = function (name)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
				ProgressBar.addDragHandle(statusEles[i].$pb, function (newValue) { self.setProgress(name, newValue, parseInt(newValue * 100) + "%") });
	};
	this.getValue = function (name)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
				return statusEles[i].getValue();
		return -1;
	};
	this.addOnProgressChangedListener = function (name, onProgressChanged)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			if (statusEles.length > 0) // Add the listener only to the first element, so in case of multiple elements with the same name, we only create one callback.
				ProgressBar.addOnProgressChangedListener(statusEles[0].$pb, onProgressChanged);
	};
	this.setEnabled = function (name, enabled)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
				ProgressBar.setEnabled(statusEles[0].$pb, enabled);
	};
}
var ProgressBar =
	{
		initialize: function ($ele)
		{
			if ($ele.children().length == 0)
			{
				var ele = $ele.get(0);
				ele.$progressBarInner = $('<div class="progressBarInner"></div>');
				$ele.append(ele.$progressBarInner);
				$ele.addClass("progressBarOuter");
				ele.defaultColor = ele.$progressBarInner.css("background-color");
				ele.defaultBackgroundColor = $ele.css("background-color");
			}
		}
		, setProgress: function ($ele, progressAmount)
		{
			var ele = $ele.get(0);
			progressAmount = Clamp(progressAmount, 0, 1);
			var changed = typeof ele.pbValue == "undefined" || ele.pbValue != progressAmount;
			ele.pbValue = progressAmount;
			ele.$progressBarInner.css("width", (progressAmount * 100) + "%");
			if (typeof ele.moveDragHandleElements == "function")
				ele.moveDragHandleElements();
			if (changed && typeof ele.onProgressChanged == "function")
				ele.onProgressChanged(progressAmount);
		}
		, addDragHandle: function ($ele, onDrag)
		{
			$ele.addClass("withDragHandle");
			var ele = $ele.get(0);
			ele.$dragHandle = $('<div class="statusBarDragHandle"><div class="statusBarDragHandleInner"></div></div>');
			var dragHandleWidth = ele.$dragHandle.width();
			$ele.prepend(ele.$dragHandle);

			ele.onDragHandleDragged = function (pageX)
			{
				var relX = pageX - $ele.offset().left;
				var progressPercentage = Clamp(relX / $ele.width(), 0, 1);
				onDrag(progressPercentage);
			};
			ele.moveDragHandleElements = function ()
			{
				ele.$dragHandle.css("left", (ele.pbValue * $ele.width()) - (ele.$dragHandle.width() / 2) + "px");
			};
			ele.moveDragHandleElements();
			BI_CustomEvent.AddListener("afterResize", ele.moveDragHandleElements);

			// Set up input events
			$ele.on("mousedown touchstart", function (e)
			{
				mouseCoordFixer.fix(e);
				if (e.which != 3)
				{
					if ($ele.hasClass("disabled"))
						return;
					ele.isDragging = true;
					ele.onDragHandleDragged(e.pageX);
				}
			});
			$(document).on("mouseup touchend touchcancel", function (e)
			{
				mouseCoordFixer.fix(e);
				ele.isDragging = false;
			});
			$(document).on("mousemove touchmove", function (e)
			{
				mouseCoordFixer.fix(e);
				if (ele.isDragging)
					ele.onDragHandleDragged(e.pageX);
			});
		}
		, getValue: function ($ele)
		{
			return $ele.get(0).pbValue;
		}
		, addOnProgressChangedListener: function ($ele, onProgressChanged)
		{
			$ele.get(0).onProgressChanged = onProgressChanged;
		}
		, setColor: function ($ele, progressColor, progressBackgroundColor)
		{
			if (progressColor)
			{
				if (progressColor == "default")
					progressColor = $ele.get(0).defaultColor;
				$ele.get(0).$progressBarInner.css("background-color", progressColor);
			}
			if (progressBackgroundColor)
			{
				if (progressBackgroundColor == "default")
					progressBackgroundColor = $ele.get(0).Background;
				$ele.css("background-color", progressBackgroundColor);
			}
		}
		, setEnabled: function ($ele, enabled)
		{
			if (enabled)
				$ele.removeClass("disabled");
			else
				$ele.addClass("disabled");
		}
	};
///////////////////////////////////////////////////////////////
// Dropdown Boxes /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function DropdownListDefinition(name, options)
{
	var self = this;
	this.name = name;
	this.timeClosed = 0;
	// Default Options
	this.items = [];
	this.onItemClick = null;
	this.getDefaultLabel = function () { return "..."; };
	// End options
	$.extend(this, options);
}
function DropdownListItem(options)
{
	var self = this;
	// Default Options
	this.text = "List Item";
	this.autoSetLabelText = true;
	// End options
	$.extend(this, options);
}
function DropdownBoxes()
{
	var self = this;
	var handleElements = {};
	var $dropdownBoxes = $(".dropdownBox,#btn_main_menu");
	var currentlyOpenList = null;

	this.listDefs = {};
	this.listDefs["schedule"] = new DropdownListDefinition("schedule",
		{
			onItemClick: function (item)
			{
				var scheduleName = item.id;
				if (scheduleName != null)
				{
					self.setLabelText("schedule", "...");
					statusLoader.ChangeSchedule(scheduleName);
				}
			}
			, rebuildItems: function ()
			{
				this.items = [];
				if (statusLoader.IsGlobalScheduleEnabled())
				{
					var schedulesArray = sessionManager.GetSchedulesArray();
					if (schedulesArray && schedulesArray.length == 0)
					{
						openLoginDialog();
						return;
					}
					for (var i = 0; i < schedulesArray.length; i++)
					{
						var scheduleName = schedulesArray[i];
						this.items.push(new DropdownListItem(
							{
								text: scheduleName
								, id: scheduleName
								, selected: scheduleName == statusLoader.GetCurrentlySelectedScheduleName()
							}));
					}
				}
				else
					this.items.push(new DropdownListItem(
						{
							text: "The global schedule must first be configured in Blue Iris."
							, id: null
							, selected: false
							, autoSetLabelText: false
						}));
			}
		});
	this.listDefs["currentGroup"] = new DropdownListDefinition("currentGroup",
		{
			onItemClick: function (item)
			{
				videoPlayer.SelectCameraGroup(item.id);
			}
			, rebuildItems: function (data)
			{
				this.items = [];
				for (var i = 0; i < data.length; i++)
				{
					if (cameraListLoader.CameraIsGroupOrCycle(data[i]))
					{
						this.items.push(new DropdownListItem(
							{
								text: CleanUpGroupName(data[i].optionDisplay)
								, id: data[i].optionValue
							}));
					}
				}
			}
		});
	this.listDefs["streamingQuality"] = new DropdownListDefinition("streamingQuality",
		{
			selectedIndex: -1
			, items:
			[
				new DropdownListItem({ text: "High Definition", uniqueQualityId: "A", abbr: "HD", shortAbbr: "HD" })
				, new DropdownListItem({ text: "Standard Definition", uniqueQualityId: "B", abbr: "SD", shortAbbr: "SD" })
				, new DropdownListItem({ text: "Low Definition", uniqueQualityId: "C", abbr: "Low", shortAbbr: "LD" })
			]
			, onItemClick: function (item)
			{
				settings.ui3_jpegStreamingQuality = item.uniqueQualityId;
			}
			, getDefaultLabel: function ()
			{
				for (var i = 0; i < this.items.length; i++)
					if (settings.ui3_jpegStreamingQuality == this.items[i].uniqueQualityId)
						return this.items[i].text;
				if (this.items.length > 0)
					return this.items[0].text;
				return "Error";
			}
			, getCurrentlySelectedItem: function ()
			{
				if (this.selectedIndex < 0 || this.selectedIndex >= this.items.length)
					return null;
				return this.items[this.selectedIndex];
			}
			, selectItemByIndex: function (index)
			{
				if (index >= 0 && index < this.items.length)
				{
					this.selectedIndex = index;
					settings.ui3_jpegStreamingQuality = this.items[index].uniqueQualityId;
				}
			}
		});
	this.listDefs["mainMenu"] = new DropdownListDefinition("mainMenu",
		{
			selectedIndex: -1
			, items:
			[
				new DropdownListItem({ cmd: "ui_settings", text: "UI Settings", icon: "#svg_x5F_Settings", cssClass: "goldenLarger" })
				, new DropdownListItem({ cmd: "about_this_ui", text: "About This UI", icon: "#svg_x5F_About", cssClass: "goldenLarger" })
				, new DropdownListItem({ cmd: "system_log", text: "System Log", icon: "#svg_x5F_SystemLog", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "system_configuration", text: "System Configuration", icon: "#svg_x5F_SystemConfiguration", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "full_camera_list", text: "Full Camera List", icon: "#svg_x5F_FullCameraList", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "disk_usage", text: "Disk Usage", icon: "#svg_x5F_Information", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "logout", text: "Log Out", icon: "#svg_x5F_Logout", cssClass: "goldenLarger" })
			]
			, onItemClick: function (item)
			{
				switch (item.cmd)
				{
					case "ui_settings":
						if (developerMode)
							location.reload(true);
						break;
					case "about_this_ui":
						openAboutDialog();
						break;
					case "system_log":
						systemLog.open();
						break;
					case "system_configuration":
						systemConfig.open();
						break;
					case "full_camera_list":
						cameraListDialog.open();
						break;
					case "disk_usage":
						statusLoader.diskUsageClick();
						break;
					case "logout":
						logout();
						break;
				}
			}
		});
	var streamingQualityList = this.listDefs["streamingQuality"];
	streamingQualityList.selectedIndex = 0;
	for (var i = 0; i < streamingQualityList.items.length; i++)
		if (settings.ui3_jpegStreamingQuality == streamingQualityList.items[i].uniqueQualityId)
		{
			streamingQualityList.selectedIndex = i;
			break;
		}

	$dropdownBoxes.each(function (idx, ele)
	{
		var $ele = $(ele);
		var name = $ele.attr("name");
		var listDef = self.listDefs[name];
		if (listDef == null)
		{
			toaster.Warning("Unknown dropdown box name: " + htmlEncode(name));
			return;
		}
		ele.extendLeft = $ele.attr("extendLeft") == "1";
		if ($ele.hasClass('dropdownBox'))
		{
			ele.$label = $('<div class="dropdownLabel"></div>');
			ele.$label.text(listDef.getDefaultLabel());
			ele.$arrow = $('<div class="dropdownArrow"><svg class="icon"><use xlink:href="#svg_x5F_DownArrow"></use></svg></div>');
			$ele.append(ele.$label);
			$ele.append(ele.$arrow);
		}
		else
		{
			ele.$label = $();
			ele.$arrow = $();
		}
		$ele.click(function ()
		{
			if ($ele.hasClass("disabled"))
				return;
			LoadDropdownList(name, $ele);
		});
		if (!handleElements[name])
			handleElements[name] = [];
		handleElements[name].push(ele);
	});
	this.setLabelText = function (name, labelText)
	{
		var handleEles = handleElements[name];
		if (handleEles)
			for (var i = 0; i < handleEles.length; i++)
			{
				var ele = handleEles[i];
				if (ele)
					ele.$label.text(labelText);
			}
	};
	this.getLabelText = function (name)
	{
		var handleEles = handleElements[name];
		if (handleEles)
			for (var i = 0; i < handleEles.length; i++)
			{
				var ele = handleEles[i];
				if (ele)
					return ele.$label.text();
			}
		return "";
	}
	this.setEnabled = function (name, enabled)
	{
		var handleEles = handleElements[name];
		if (handleEles)
			for (var i = 0; i < handleEles.length; i++)
			{
				var ele = handleEles[i];
				if (ele)
				{
					if (enabled)
						$(ele).removeClass("disabled");
					else
						$(ele).addClass("disabled");
				}
			}
	}
	var getFirstVisibleEle = function (name)
	{
		var handleEles = handleElements[name];
		if (handleEles)
			for (var i = 0; i < handleEles.length; i++)
			{
				var ele = handleEles[i];
				if (ele && $(ele).is(":visible"))
					return ele;
			}
		return null;
	}
	var LoadDropdownList = function (name, $parent)
	{
		var ele = getFirstVisibleEle(name);
		if (ele == null)
			return;
		var listDef = self.listDefs[name];
		if (listDef == null)
			return;
		if (new Date().getTime() - 33 <= listDef.timeClosed)
			return;
		var $ele = $(ele);
		var offset = $ele.offset();

		var $ddl = listDef.$currentListEle = $('<div class="dropdown_list"></div>');
		$ddl.on("mouseup", function ()
		{
			return false;
		});

		var selectedText = self.getLabelText(name);
		for (var i = 0; i < listDef.items.length; i++)
			AddDropdownListItem($ddl, listDef, i, selectedText);
		if (listDef.items.length == 0)
			$ddl.append("<div>This list is empty!</div>");

		$("body").append($ddl);

		if ($parent.length > 0)
			$ddl.css('min-width', $parent.innerWidth() + "px");

		if (name == "mainMenu")
		{
			$ddl.css("min-width", ($ddl.width() + 1) + "px"); // Workaround for "System Configuration" wrapping bug
			if (BrowserIsIE())
				$ddl.css("height", ($ddl.height() + 3) + "px"); // Workaround for IE bug that adds unnecessary scroll bars
		}

		var windowH = $(window).height();
		var windowW = $(window).width();
		var width = $ddl.outerWidth();
		var height = $ddl.outerHeight();
		var top = (offset.top + $ele.outerHeight());
		var left = offset.left;
		if (ele.extendLeft)
		{
			left = (left + $ele.outerWidth()) - width;
			if ((BrowserIsIE() || BrowserIsEdge()) && height > windowH)
				left -= 20; // Workaround for Edge/IE bug that renders scroll bar offscreen
		}

		// Adjust box position so the box doesn't extend off the bottom, top, right, left, in that order.
		if (top + height > windowH)
			top = windowH - height;
		if (top < 0)
			top = 0;
		if (left + width > windowW)
			left = windowW - width;
		if (left < 0)
			left = 0;

		$ddl.css("top", top + "px");
		$ddl.css("left", left + "px");

		closeDropdownLists();
		currentlyOpenList = listDef;

		self.Resized();
	}
	var AddDropdownListItem = function ($ddl, listDef, i, selectedText)
	{
		var item = listDef.items[i];
		var $item = $("<div></div>");
		$item.text(item.text);
		if (selectedText == item.text)
			$item.addClass("selected");
		if (item.cssClass)
			$item.addClass(item.cssClass);
		$item.click(function ()
		{
			if (listDef.items[i].autoSetLabelText)
				self.setLabelText(listDef.name, item.text);
			listDef.selectedIndex = i;
			listDef.onItemClick && listDef.onItemClick(listDef.items[i]); // run if not null
			closeDropdownLists();
		});
		if (item.icon && item.icon != "")
			$item.prepend('<div class="mainMenuIcon"><svg class="icon"><use xlink:href="' + item.icon + '"></use></svg></div>');
		$ddl.append($item);
	}
	$(document).mouseup(function (e)
	{
		closeDropdownLists();
	});
	$(document).mouseleave(function (e)
	{
		closeDropdownLists();
	});
	var closeDropdownLists = function ()
	{
		if (currentlyOpenList != null)
		{
			currentlyOpenList.$currentListEle.remove();
			currentlyOpenList.$currentListEle = null;
			currentlyOpenList.timeClosed = new Date().getTime();
			currentlyOpenList = null;
		}
	}
	this.Resized = function ()
	{
		var windowH = $(window).height();
		$(".dropdown_list").each(function (idx, ele)
		{
			var $ele = $(ele);
			$ele.css("max-height", (windowH - $ele.offset().top - 2) + "px");
		});
	}
}
///////////////////////////////////////////////////////////////
// PTZ Pad Buttons ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function PtzButtons()
{
	var self = this;

	var ptzControlsEnabled = false;
	var $hoveredEle = null;
	var $activeEle = null;

	var currentlyLoadedPtzThumbsCamId = "";

	var unsafePtzActionNeedsStopped = false;
	var currentPtz = "0";
	var currentPtzCamId = "";
	var unsafePtzActionQueued = null;
	var unsafePtzActionInProgress = false;
	var currentPtzData = null;

	var $ptzGraphicWrapper = $("#ptzGraphicWrapper");
	var $ptzGraphics = $("#ptzGraphicWrapper div.ptzGraphic");
	var $ptzBackgroundGraphics = $("#ptzGraphicWrapper div.ptzBackground");
	var $ptzGraphicContainers = $("#ptzGraphicWrapper .ptzGraphicContainer");
	var $ptzPresets = $(".ptzpreset");
	var $ptzButtons = $("#ptzButtonsMain");
	var $ptzControlsContainers = $("#ptzPresetsContent,#ptzButtonsMain");

	var hitPolys = {};
	hitPolys["PTZzoomIn"] = [[64, 64], [82, 82], [91, 77], [99, 77], [106, 81], [126, 64], [116, 58], [105, 53], [86, 53], [74, 58]];
	hitPolys["PTZzoomOut"] = [[64, 126], [82, 108], [91, 113], [99, 113], [106, 109], [126, 126], [116, 132], [105, 137], [86, 137], [74, 132]];
	hitPolys["PTZfocusNear"] = [[126, 64], [108, 82], [113, 91], [113, 99], [109, 106], [126, 126], [132, 116], [137, 105], [137, 86], [132, 74]];
	hitPolys["PTZfocusFar"] = [[64, 64], [82, 82], [77, 91], [77, 99], [81, 106], [64, 126], [58, 116], [53, 105], [53, 86], [58, 74]];
	hitPolys["PTZstop"] = [[82, 82], [91, 77], [99, 77], [108, 82], [113, 91], [113, 99], [108, 108], [99, 113], [91, 113], [82, 108], [77, 99], [77, 91]];
	hitPolys["PTZcardinalUp"] = [[52, 9], [74, 58], [86, 53], [105, 53], [116, 58], [138, 9], [96, 0]];
	hitPolys["PTZcardinalRight"] = [[181, 52], [132, 74], [138, 86], [138, 105], [132, 116], [181, 138], [190, 96]];
	hitPolys["PTZcardinalDown"] = [[52, 181], [74, 132], [86, 138], [105, 138], [116, 132], [138, 181], [96, 190]];
	hitPolys["PTZcardinalLeft"] = [[9, 52], [58, 74], [53, 86], [53, 105], [58, 116], [9, 138], [0, 96]];
	hitPolys["PTZordinalNE"] = [[138, 9], [116, 58], [124, 63], [127, 66], [132, 74], [181, 52], [171, 19]];
	hitPolys["PTZordinalNW"] = [[52, 9], [74, 58], [66, 63], [63, 66], [58, 74], [9, 52], [19, 19]];
	hitPolys["PTZordinalSW"] = [[52, 181], [74, 132], [66, 127], [63, 124], [58, 116], [9, 138], [19, 171]];
	hitPolys["PTZordinalSE"] = [[138, 181], [116, 132], [124, 127], [127, 124], [132, 116], [181, 138], [171, 171]];

	var ptzCmds = {};
	ptzCmds["PTZzoomIn"] = 5;
	ptzCmds["PTZzoomOut"] = 6;
	ptzCmds["PTZfocusNear"] = -1;
	ptzCmds["PTZfocusFar"] = -2;
	ptzCmds["PTZstop"] = 64;
	ptzCmds["PTZcardinalUp"] = 2;
	ptzCmds["PTZcardinalRight"] = 1;
	ptzCmds["PTZcardinalDown"] = 3;
	ptzCmds["PTZcardinalLeft"] = 0;
	ptzCmds["PTZordinalNE"] = 60;
	ptzCmds["PTZordinalNW"] = 59;
	ptzCmds["PTZordinalSW"] = 61;
	ptzCmds["PTZordinalSE"] = 62;

	var ptzTitles = {};
	ptzTitles["PTZzoomIn"] = "Zoom In";
	ptzTitles["PTZzoomOut"] = "Zoom Out";
	ptzTitles["PTZfocusNear"] = "Focus Near";
	ptzTitles["PTZfocusFar"] = "Focus Far";
	ptzTitles["PTZstop"] = "Stop";
	ptzTitles["PTZcardinalUp"] = "Up";
	ptzTitles["PTZcardinalRight"] = "Right";
	ptzTitles["PTZcardinalDown"] = "Down";
	ptzTitles["PTZcardinalLeft"] = "Left";
	ptzTitles["PTZordinalNE"] = "Up Right";
	ptzTitles["PTZordinalNW"] = "Up Left";
	ptzTitles["PTZordinalSW"] = "Down Left";
	ptzTitles["PTZordinalSE"] = "Down Right";

	$ptzGraphicContainers.each(function (idx, ele)
	{
		ele.graphicObjects = {};
	});

	// Layout PTZ buttons //
	$ptzGraphics.each(function (idx, ele)
	{
		var $ele = $(ele);
		ele.svgid = $ele.attr('svgid');
		ele.ptzcmd = ptzCmds[ele.svgid];
		ele.tooltipText = ptzTitles[ele.svgid];
		var layoutParts = $ele.attr('layoutR').split(' ');
		ele.layout =
			{
				x: parseFloat(layoutParts[0])
				, y: parseFloat(layoutParts[1])
				, w: parseFloat(layoutParts[2])
				, h: parseFloat(layoutParts[3])
			};

		$ele.css("left", ele.layout.x + "px");
		$ele.css("top", ele.layout.y + "px");
		$ele.css("width", ele.layout.w + "px");
		$ele.css("height", ele.layout.h + "px");

		$ele.append('<svg class="icon"><use xlink:href="#svg_x5F_' + ele.svgid + '"></use></svg>');
		ele.defaultColor = $ele.hasClass("ptzBackground") ? "#363B46" : "#15171B";
		$ele.css('color', ele.defaultColor);
		ele.parentNode.graphicObjects[ele.svgid] = ele;
	});

	// PTZ button input events //

	// onHoverEnter called whenever a mouse pointer begins hovering over any button.
	var onHoverEnter = function (btn)
	{
		$ptzButtons.attr("title", btn.tooltipText);
		$hoveredEle = $(btn);
		$hoveredEle.css("color", "#969BA7");
	}
	// onHoverLeave called whenever a mouse pointer leaves any button or a mouse up event is triggered
	var onHoverLeave = function ()
	{
		if ($hoveredEle != null)
		{
			$ptzButtons.removeAttr("title");
			$hoveredEle.css('color', $hoveredEle.get(0).defaultColor);
			$hoveredEle = null;
		}
		if ($activeEle != null)
		{
			self.SendOrQueuePtzCommand(null, null, true);
			$activeEle.css('color', $activeEle.get(0).defaultColor);
			$activeEle = null;
		}
	}
	var onButtonMouseDown = function (btn)
	{
		self.SendOrQueuePtzCommand(videoPlayer.Loading().image.id, btn.ptzcmd, false);
		$activeEle = $(btn);
		$activeEle.css("color", "#FFFFFF");
	}
	var onPointerMove = function (e)
	{
		if (pointInsideElement($ptzGraphicWrapper, e.pageX, e.pageY))
		{
			// Hovering near buttons, maybe over one
			if ($activeEle == null && !touchEvents.isTouchEvent(e))
			{
				var offset = $ptzGraphicWrapper.offset();
				var x = e.pageX - offset.left;
				var y = e.pageY - offset.top;
				var btn = GetHoveredPTZButton(x, y);
				if (btn == null)
				{
					// Not hovering on any buttons
					onHoverLeave();
				}
				else if ($hoveredEle == null || $hoveredEle.get(0).svgid != btn.svgid)
				{
					onHoverLeave();
					onHoverEnter(btn);
				}
			}
		}
		else
		{
			// Not hovering on any buttons
			onHoverLeave();
		}
	}
	$ptzGraphicWrapper.on('mousedown touchstart', function (e)
	{
		if (!ptzControlsEnabled)
			return;
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (e.which != 3)
		{
			var offset = $ptzGraphicWrapper.offset();
			var x = e.pageX - offset.left;
			var y = e.pageY - offset.top;
			var btn = GetHoveredPTZButton(x, y);
			if (btn != null)
			{
				onHoverLeave();
				onButtonMouseDown(btn);
				$.hideAllContextMenus();
				return stopDefault(e);
			}
		}
		onPointerMove(e);
	});
	$(document).on('mouseup mouseleave touchend touchcancel', function (e)
	{
		if (!ptzControlsEnabled)
			return;
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		onHoverLeave();
		onPointerMove(e);
	});
	$(document).on('mousemove touchmove', function (e)
	{
		if (!ptzControlsEnabled)
			return;
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		onPointerMove(e);
	});
	var GetHoveredPTZButton = function (x, y)
	{
		var sizeMultiplier = $ptzGraphicWrapper.width() / 190;
		var point = [x / sizeMultiplier, y / sizeMultiplier];
		var buttonId = FindPolyForPoint(point);
		if (buttonId != null)
		{
			var visibleGraphicContainer = GetVisibleGraphicContainer();
			return visibleGraphicContainer ? visibleGraphicContainer.graphicObjects[buttonId] : null;
		}
		return null;
	}
	var FindPolyForPoint = function (point)
	{
		var keys = Object.keys(hitPolys);
		for (var i = 0; i < keys.length; i++)
		{
			if (pointInPolygon(point, hitPolys[keys[i]]))
				return keys[i];
		}
		return null;
	}
	var GetVisibleGraphicContainer = function ()
	{
		return $ptzGraphicContainers.filter(':visible').get(0);
	}

	// PTZ Control display state //
	this.UpdatePtzControlDisplayState = function (loadThumbsOverride)
	{
		var featureEnabled = GetUi3FeatureEnabled("ptzControls");
		LoadPtzPresetThumbs(loadThumbsOverride);
		if (videoPlayer.Loading().image.ptz)
			ptzControlsEnabled = featureEnabled;
		else
		{
			onHoverLeave();
			ptzControlsEnabled = false;
		}
		if (ptzControlsEnabled)
		{
			$ptzControlsContainers.removeAttr("title");
			$ptzPresets.removeClass("disabled");
			$ptzButtons.removeClass("disabled");
			$ptzBackgroundGraphics.css("color", $ptzBackgroundGraphics.get(0).defaultColor);
		}
		else
		{
			$ptzControlsContainers.attr("title", featureEnabled ? "PTZ not available for current camera" : "PTZ disabled by user preference");
			$ptzPresets.addClass("disabled");
			$ptzButtons.addClass("disabled");
			$ptzBackgroundGraphics.css("color", "#20242b");
		}
	}
	this.isEnabledNow = function ()
	{
		return ptzControlsEnabled;
	}
	this.setEnabled = function (enabled)
	{
		self.UpdatePtzControlDisplayState(true);
	}
	this.PresetSet = function (presetNumStr)
	{
		if (!ptzControlsEnabled)
			return;
		if (!videoPlayer.Loading().image.ptz)
			return;
		if (!sessionManager.IsAdministratorSession())
		{
			openLoginDialog();
			return;
		}
		var presetNum = parseInt(presetNumStr);
		var $question = $('<div style="margin-bottom:20px;width:300px;">' + CleanUpGroupName(videoPlayer.Loading().image.id) + '<br/><br/>Set Preset ' + presetNum
			+ ' now?<br/><br/>Description:<br/></div>');
		var $descInput = $('<input type="text" />');
		$question.append($descInput);
		$descInput.val(self.GetPresetDescription(presetNum));
		AskYesNo($question, function ()
		{
			PTZ_set_preset(presetNum, $descInput.val());
		});
	}
	// Enable preset buttons //
	$ptzPresets.each(function (idx, ele)
	{
		var $ele = $(ele);
		ele.presetnum = parseInt($ele.attr("presetnum"));
		$ele.text(ele.presetnum);
		$ele.click(function (e)
		{
			self.PTZ_goto_preset(ele.presetnum);
		});
		$ele.longpress(function (e) { self.PresetSet($ele.attr("presetnum")); });
		$ele.mouseenter(function (e)
		{
			if (!ptzControlsEnabled)
				return;

			var thumb = $("#presetBigThumb");
			thumb.remove();
			$("body").append('<div id="presetBigThumb"></div>');
			thumb = $("#presetBigThumb");

			var $desc = $('<div class="presetDescription"></div>');
			$desc.text(self.GetPresetDescription(ele.presetnum));
			thumb.append($desc);

			var imgData = settings.getItem("ui2_preset_" + videoPlayer.Loading().image.id + "_" + ele.presetnum);
			if (imgData != null && imgData.length > 0)
			{
				var $img = $('<img alt="" />');
				$img.attr("src", imgData);
				thumb.append($img);
			}

			var $parent = $(this).parent();
			var thisOffset = $parent.offset();
			var centerOffset = ($parent.width() - thumb.width()) / 2;
			if (centerOffset <= 0)
				centerOffset = 0;
			thumb.css("left", (thisOffset.left + centerOffset) + "px");
			thumb.css("top", (thisOffset.top - thumb.height() - 3) + "px");
			thumb.show();
		});
		$ele.mouseleave(function (e)
		{
			var thumb = $("#presetBigThumb");
			thumb.hide();
		});
	});
	// Presets //
	var LoadPtzPresetThumbs = function (loadThumbsOverride)
	{
		var loading = videoPlayer.Loading().image;
		if (loading.ptz && GetUi3FeatureEnabled("ptzControls"))
		{
			if (loadThumbsOverride || currentlyLoadedPtzThumbsCamId != loading.id)
			{
				$ptzPresets.each(function (idx, ele)
				{
					var imgData = settings.getItem("ui2_preset_" + loading.id + "_" + ele.presetnum);
					if (imgData != null && imgData.length > 0)
					{
						$(ele).empty();
						var $thumb = $('<img src="" alt="' + ele.presetnum + '" class="presetThumb" />');
						$thumb.load(function ()
						{
							try
							{
								var remainder = $thumb[0].getBoundingClientRect().height % 1;
								if (remainder != 0)
									$thumb.css("padding-bottom", (1 - remainder) + "px");
							}
							catch (ex) { }
						});
						$thumb.attr("src", imgData);
						$(ele).append($thumb);
					}
					else
						$(ele).text(ele.presetnum);
				});
				currentlyLoadedPtzThumbsCamId = loading.id;
			}
			LoadPTZPresetDescriptions(loading.id);
		}
		else
		{
			$ptzPresets.each(function (idx, ele)
			{
				$(ele).text(ele.presetnum);
			});
			currentlyLoadedPtzThumbsCamId = "";
		}
	}
	this.PTZ_goto_preset = function (presetNumber)
	{
		if (!ptzControlsEnabled)
			return;
		if (!videoPlayer.Loading().image.ptz)
		{
			toaster.Error("Current camera is not PTZ");
			return;
		}
		self.PTZ_async_noguarantee(videoPlayer.Loading().image.id, 100 + parseInt(presetNumber));
	}
	var PTZ_set_preset = function (presetNumber, description)
	{
		if (!ptzControlsEnabled)
			return;
		if (!videoPlayer.Loading().image.ptz)
		{
			toaster.Error("Current camera is not PTZ");
			return;
		}
		var cameraId = videoPlayer.Loading().image.id;
		if (description == null || description == "")
			description = "Preset " + presetNumber;
		var args = { cmd: "ptz", camera: cameraId, button: (100 + presetNumber), description: description };
		ExecJSON(args, function (response)
		{
			if (response && typeof response.result != "undefined" && response.result == "success")
			{
				RememberPresetDescription(cameraId, presetNumber, description);
				toaster.Success("Preset " + presetNumber + " set successfully.");
				UpdatePresetImage(cameraId, presetNumber);
			}
		}, function ()
			{
				toaster.Error("Unable to save preset");
			});
	}
	var UpdatePresetImage = function (cameraId, presetNumber)
	{
		if (currentServer.isLoggingOut)
			return;
		if (cameraId != videoPlayer.Loading().image.id)
			return;

		var sizeArg = "&w=160";
		if (videoPlayer.Loading().image.aspectratio < 1)
			sizeArg = "&h=160";
		var tmpImgSrc = currentServer.remoteBaseURL + "image/" + videoPlayer.Loading().image.path + '?time=' + new Date().getTime() + sizeArg + "&q=50" + currentServer.GetRemoteSessionArg("&", true);
		PersistImageFromUrl("ui2_preset_" + cameraId + "_" + presetNumber, tmpImgSrc
			, function (imgAsDataURL)
			{
				LoadPtzPresetThumbs(true);
			}, function (message)
			{
				toaster.Error("Failed to save preset image. " + message, 10000);
			});
	}
	var LoadPTZPresetDescriptions = function (cameraId)
	{
		if (currentPtzData && currentPtzData.cameraId == cameraId)
			return;
		ExecJSON({ cmd: "ptz", camera: cameraId }, function (response)
		{
			if (videoPlayer.Loading().image.id == cameraId)
			{
				currentPtzData = response.data;
				currentPtzData.cameraId = cameraId;
			}
		}, function ()
			{
				if (videoPlayer.Loading().image.id == cameraId)
					toaster.Warning("Unable to load PTZ metadata for camera: " + cameraId);
			});
	}
	this.GetPresetDescription = function (presetNum, asAnnotation)
	{
		presetNum = parseInt(presetNum);
		if (presetNum < 0 || presetNum > 20)
			return asAnnotation ? "" : ("Preset " + presetNum);
		var desc = null;
		if (currentPtzData && currentPtzData.cameraId == videoPlayer.Loading().image.id && currentPtzData.presets && currentPtzData.presets.length > presetNum - 1)
			desc = currentPtzData.presets[presetNum - 1];
		if (desc == null || desc == "")
			desc = "Preset " + presetNum;
		if (asAnnotation)
		{
			if (desc.match(/^Preset [0-9]+$/i) == null)
				desc = ' (' + desc + ')';
			else
				desc = '';
		}
		return desc;
	}
	var RememberPresetDescription = function (cameraId, presetNum, description)
	{
		presetNum = parseInt(presetNum);
		if (presetNum < 0 || presetNum > 20)
			return;
		if (currentPtzData && currentPtzData.cameraId == cameraId)
		{
			if (!currentPtzData.presets)
				currentPtzData.presets = [];
			while (currentPtzData.presets.length < presetNum)
				currentPtzData.presets.push('Preset' + (currentPtzData.presets.length + 1));
			currentPtzData.presets[presetNum - 1] = description;
		}
	}
	// PTZ Actions //
	window.onbeforeunload = function ()
	{
		if (unsafePtzActionNeedsStopped)
		{
			unsafePtzActionNeedsStopped = false;
			unsafePtzActionQueued = null;
			if (!unsafePtzActionInProgress)
				self.PTZ_unsafe_sync_guarantee(currentPtzCamId, currentPtz, 1);
		}
		return;
	}
	this.SendOrQueuePtzCommand = function (ptzCamId, ptzCmd, isStopCommand)
	{
		ptzCmd = parseInt(ptzCmd);
		if (isStopCommand)
		{
			if (unsafePtzActionNeedsStopped)
			{
				if (currentPtzCamId != null && currentPtz != null)
				{
					if (unsafePtzActionInProgress)
					{
						unsafePtzActionQueued = function ()
						{
							self.PTZ_unsafe_async_guarantee(currentPtzCamId, currentPtz, 1);
						};
					}
					else
						self.PTZ_unsafe_async_guarantee(currentPtzCamId, currentPtz, 1);
				}
				unsafePtzActionNeedsStopped = false;
			}
		}
		else
		{
			if (!unsafePtzActionNeedsStopped && !unsafePtzActionInProgress && unsafePtzActionQueued == null)
			{
				// All-clear for new start command
				currentPtzCamId = ptzCamId;
				currentPtz = ptzCmd;
				unsafePtzActionNeedsStopped = true;
				self.PTZ_unsafe_async_guarantee(currentPtzCamId, currentPtz, 1);
			}
		}
	}
	this.PTZ_async_noguarantee = function (cameraId, ptzCmd, updown)
	{
		var args = { cmd: "ptz", camera: cameraId, button: parseInt(ptzCmd) };
		if (updown == "1")
			args.updown = 1;
		else if (updown == "2")
			args.button = 64;
		ExecJSON(args, function (response)
		{
		}, function ()
			{
			});
	}
	this.PTZ_unsafe_async_guarantee = function (cameraId, ptzCmd, updown)
	{
		unsafePtzActionInProgress = true;
		var args = { cmd: "ptz", camera: cameraId, button: ptzCmd };
		if (updown == "1")
			args.updown = 1;
		else if (updown == "2")
			args.button = 64;
		ExecJSON(args, function (response)
		{
			unsafePtzActionInProgress = false;
			if (unsafePtzActionQueued != null)
			{
				unsafePtzActionQueued();
				unsafePtzActionQueued = null;
			}
		}, function ()
			{
				setTimeout(function ()
				{
					self.PTZ_unsafe_async_guarantee(cameraId, ptzCmd, updown);
				}, 100);
			});
	}
	this.PTZ_unsafe_sync_guarantee = function (cameraId, ptzCmd, updown)
	{
		unsafePtzActionInProgress = true;
		var args = { cmd: "ptz", camera: cameraId, button: ptzCmd };
		if (updown == "1")
			args.updown = 1;
		else if (updown == "2")
			args.button = 64;
		ExecJSON(args, function (response)
		{
			unsafePtzActionInProgress = false;
			if (unsafePtzActionQueued != null)
			{
				unsafePtzActionQueued();
				unsafePtzActionQueued = null;
			}
		}, function ()
			{
				self.PTZ_unsafe_sync_guarantee(cameraId, ptzCmd, updown);
			}, true);
	}
}
///////////////////////////////////////////////////////////////
// Timeline ///////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipTimeline()
{
	var $canvas = $("#canvas_clipTimeline");
	var canvas = $canvas.get(0);
	var dpiScale = BI_GetDevicePixelRatio();
	var isDragging = false;
	var currentSelectedRelativePosition = -1;
	var currentGhostRelativePosition = -1;
	var currentSoftGhostRelativePosition = -1;
	var self = this;
	$canvas.on("mousedown touchstart", function (e)
	{
		mouseCoordFixer.fix(e);
		isDragging = true;
		currentGhostRelativePosition = pageXToRelativePosition(e.pageX);
		self.Draw();
	});
	$(document).on("mouseup touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		if (isDragging)
		{
			isDragging = false;
			var newPosition = pageXToRelativePosition(e.pageX);
			if (newPosition != -1)
				currentSelectedRelativePosition = newPosition;
			currentGhostRelativePosition = -1;
			self.Draw();
		}
	});
	$(document).on("mousemove touchmove", function (e)
	{
		mouseCoordFixer.fix(e);
		var newSoftGhost = -1;
		if (pointInsideElement($canvas, e.pageX, e.pageY))
			newSoftGhost = pageXToRelativePosition(e.pageX);
		var changedGhost = currentSoftGhostRelativePosition != newSoftGhost;
		currentSoftGhostRelativePosition = newSoftGhost;
		if (isDragging)
		{
			currentGhostRelativePosition = pageXToRelativePosition(e.pageX);
			self.Draw();
		}
		else if (changedGhost)
			self.Draw();
	});
	$canvas.on("mouseleave", function (e)
	{
		mouseCoordFixer.fix(e);
		currentSoftGhostRelativePosition = -1;
		self.Draw();
	});
	this.Resized = function ()
	{
		if (!$canvas.is(":visible"))
			return;
		dpiScale = BI_GetDevicePixelRatio();
		canvas.width = $canvas.width() * dpiScale;
		canvas.height = $canvas.height() * dpiScale;
	};
	this.Draw = function ()
	{
		drawInternal(currentSelectedRelativePosition, currentGhostRelativePosition, currentSoftGhostRelativePosition);
	}
	var drawInternal = function (handlePosition, ghostPosition, softGhostPosition)
	{
		if (!$canvas.is(":visible"))
			return;
		var timelineBorder = getTimelineBorder();

		var timelineHourLabelsY = 30 * dpiScale;
		var timelineTickMarkStartY = 33 * dpiScale;
		var timelineTickMarkEndY = timelineBorder.startY;
		var timelineTickMarksH = 4 * dpiScale;

		var fontSize = 16 * dpiScale;
		if (canvas.width < 1000)
			fontSize = Math.max(8, fontSize * (canvas.width / 1000));

		var ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = ctx.fillStyle = "#FFFFFF";
		//ctx.strokeStyle = ctx.fillStyle = "#969BA7";
		ctx.font = fontSize + "px Arial";

		// Draw timeline rectangle
		ctx.strokeRect(timelineBorder.startX, timelineBorder.startY, timelineBorder.width, timelineBorder.height);

		// Draw tick marks
		ctx.beginPath();
		var tickMarkDistance = timelineBorder.width / 24;
		for (var i = 0; i <= 24; i++)
		{
			var x = timelineBorder.startX + (i * tickMarkDistance);
			ctx.moveTo(x, timelineTickMarkStartY);
			ctx.lineTo(x, timelineTickMarkEndY);
		}
		ctx.stroke();

		// Draw hour labels
		for (var i = 0; i <= 24; i++)
		{
			var label = (i + "").padLeft(2, '0');
			var width = ctx.measureText(label).width;
			var x = (timelineBorder.startX + (i * tickMarkDistance)) - (width / 2);
			ctx.fillText(label, x, timelineHourLabelsY);
		}

		// Draw handle
		if (typeof handlePosition != "undefined" && handlePosition != -1)
			drawHandle(ctx, timelineBorder.startX + (handlePosition * timelineBorder.width), "1", "1");

		// Draw ghost handle
		if (typeof ghostPosition != "undefined" && ghostPosition != -1)
			drawHandle(ctx, timelineBorder.startX + (ghostPosition * timelineBorder.width), ".5", "0.1");

		// Draw softer ghost handle
		if (typeof softGhostPosition != "undefined" && softGhostPosition != -1)
			drawHandle(ctx, timelineBorder.startX + (softGhostPosition * timelineBorder.width), ".2", "0");
	};
	var drawHandle = function (ctx, handleX, strokeAlpha, fillAlpha)
	{
		var handleTopY = 33 * dpiScale;
		var handlePointY = 61 * dpiScale;
		var handleRectTopY = 67 * dpiScale;
		var handleRectBotY = 83 * dpiScale;
		var handleWidth = 16 * dpiScale;
		var handleLeft = handleX - (handleWidth / 2);
		var handleRight = handleX + (handleWidth / 2);

		ctx.strokeStyle = "rgba(0,151,240," + strokeAlpha + ")";
		ctx.fillStyle = "rgba(0,151,240," + fillAlpha + ")";
		ctx.beginPath();
		ctx.moveTo(handleX, handlePointY);
		ctx.lineTo(handleLeft, handleRectTopY);
		ctx.lineTo(handleLeft, handleRectBotY);
		ctx.lineTo(handleRight, handleRectBotY);
		ctx.lineTo(handleRight, handleRectTopY);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(handleX, handlePointY);
		ctx.lineTo(handleX, handleTopY);
		ctx.stroke();
	};
	var pageXToRelativePosition = function (pageX)
	{
		var timelineBorder = getTimelineBorder();
		var position = (pageX - timelineBorder.startX - $canvas.offset().left) / timelineBorder.width;
		if (position < -0.1 || position > 1.1)
			return -1;
		position = Clamp(position, 0, 1);
		return position;
	};
	var getTimelineBorder = function ()
	{
		var sideMarginSize = canvas.width * 0.1;
		if (canvas.width < 600)
		{
			var halfDiff = (600 - canvas.width) / 2;
			sideMarginSize = Math.max(7, sideMarginSize - halfDiff);
		}

		var timelineStartX = sideMarginSize;
		var timelineEndX = canvas.width - sideMarginSize;
		var timelineWidth = timelineEndX - timelineStartX;

		var timelineStartY = 38 * dpiScale;
		var timelineEndY = timelineStartY + 16 * dpiScale;
		var timelineHeight = timelineEndY - timelineStartY;

		var retVal = { startX: timelineStartX, endX: timelineEndX, width: timelineWidth, startY: timelineStartY, endY: timelineEndY, height: timelineHeight };
		return retVal;
	}
}
///////////////////////////////////////////////////////////////
// Zebra Date Picker //////////////////////////////////////////
///////////////////////////////////////////////////////////////
function DateFilter(dateRangeLabelSelector)
{
	var self = this;
	this.BeginDate = 0;
	this.EndDate = 0;
	var suppressDatePickerCallbacks = false;
	var $dateRangeLabel = $(dateRangeLabelSelector);
	var $datePickerDialog = $("#datePickerDialog");
	var dp1 = new DatePicker("datePicker1Container", 1, self);
	var dp2 = new DatePicker("datePicker2Container", 2, self);
	var timeClosed = 0;

	$datePickerDialog.mouseup(function (e)
	{
		return false;
	});
	$(document).mouseup(function (e)
	{
		if ($datePickerDialog.is(":visible"))
		{
			$datePickerDialog.hide();
			timeClosed = new Date().getTime();
		}
	});

	this.OpenDatePicker = function (ele)
	{
		if (new Date().getTime() - 33 > timeClosed)
		{
			var $ele = $(ele);
			var offset = $ele.offset();
			$datePickerDialog.css("left", offset.left + $ele.outerWidth(true) + "px");
			$datePickerDialog.css("top", offset.top + "px");
			$datePickerDialog.show();
		}
	};
	this.SelectToday = function ()
	{
		if (suppressDatePickerCallbacks)
			return;
		suppressDatePickerCallbacks = true;
		dp1.SelectToday();
		suppressDatePickerCallbacks = false;
		dp2.SelectToday();
	}
	this.Clear = function ()
	{
		if (suppressDatePickerCallbacks)
			return;
		suppressDatePickerCallbacks = true;
		dp1.Clear();
		dp2.Clear();
		suppressDatePickerCallbacks = false;
		self.BeginDate = self.EndDate = 0;
		$dateRangeLabel.text("All Recent");
		$dateRangeLabel.addClass("oneLine");
		// Maybe change color of calendar icon while there is a date range selected.
		clipLoader.LoadClips();
	}
	this.OnSelect = function (dateCustom, dateYMD, noonDateObj, ele, datePickerNum)
	{
		if (suppressDatePickerCallbacks)
			return;
		var startOfDay = new Date(noonDateObj.getFullYear(), noonDateObj.getMonth(), noonDateObj.getDate());
		if ($dateRangeLabel.hasClass("oneLine"))
		{
			$dateRangeLabel.removeClass("oneLine");
			$dateRangeLabel.html('<span id="lblClipDateSub1"></span><br/><span id="lblClipDateSub2"></span>');
		}
		if (datePickerNum == 1)
		{
			self.BeginDate = startOfDay.getTime() / 1000;
			$("#lblClipDateSub1").text(dateYMD);
			if (self.BeginDate >= self.EndDate)
			{
				self.EndDate = self.BeginDate + 86400; // (86400 seconds in a day)
				$("#lblClipDateSub2").text(dateYMD);
				suppressDatePickerCallbacks = true;
				dp2.SetDate(dateYMD);
				suppressDatePickerCallbacks = false;
			}
		}
		else
		{
			self.EndDate = (startOfDay.getTime() / 1000) + 86400; // (86400 seconds in a day)
			$("#lblClipDateSub2").text(dateYMD);
			if (self.BeginDate >= self.EndDate || self.BeginDate == 0)
			{
				self.BeginDate = self.EndDate - 86400; // (86400 seconds in a day)
				$("#lblClipDateSub1").text(dateYMD);
				suppressDatePickerCallbacks = true;
				dp1.SetDate(dateYMD);
				suppressDatePickerCallbacks = false;
			}
		}
		// Maybe change color of calendar icon while there is a date range selected.
		clipLoader.LoadClips();
	};
}
function DatePicker(calendarContainerId, datePickerNum, dateFilterObj)
{
	var $calendarContainer = $("#" + calendarContainerId);
	var self = this;
	var suppressDatePickerCallbacks = false;

	$calendarContainer.before('<input type="text" id="datePickerDate_' + calendarContainerId + '" class="takeNoSpace" />');
	var $dateInput = $('#datePickerDate_' + calendarContainerId);
	$dateInput.Zebra_DatePicker({
		always_visible: $calendarContainer
		, first_day_of_week: 0
		, onClear: function (ele)
		{
			if (suppressDatePickerCallbacks)
				return;
			suppressDatePickerCallbacks = true;
			dateFilterObj.Clear();
			suppressDatePickerCallbacks = false;
		}
		, onSelect: function (dateCustom, dateYMD, noonDateObj, ele)
		{
			if (suppressDatePickerCallbacks)
				return;
			suppressDatePickerCallbacks = true;
			dateFilterObj.OnSelect(dateCustom, dateYMD, noonDateObj, ele, datePickerNum);
			suppressDatePickerCallbacks = false;
		}
	});
	this.Clear = function ()
	{
		if (suppressDatePickerCallbacks)
			return;
		suppressDatePickerCallbacks = true;
		$dateInput.data('Zebra_DatePicker').clear_date();
		suppressDatePickerCallbacks = false;
	}
	this.SelectToday = function ()
	{
		$calendarContainer.find("td.dp_today").click();
	}
	this.SetDate = function (dateYMD)
	{
		if (suppressDatePickerCallbacks)
			return;
		suppressDatePickerCallbacks = true;
		$dateInput.data('Zebra_DatePicker').set_date(dateYMD);
		suppressDatePickerCallbacks = false;
	}
}
///////////////////////////////////////////////////////////////
// Playback Controls //////////////////////////////////////////
///////////////////////////////////////////////////////////////
function PlaybackControls()
{
	var self = this;
	var $layoutbody = $("#layoutbody");
	var $pc = $("#playbackControls");
	var $playbackSettings = $();
	var buttonContainer = $("#pcButtonContainer");
	var hideTimeout = null;
	var isVisible = $pc.is(":visible");
	var settingsClosedAt = 0;
	var playReverse = settings.ui3_playback_reverse == "1";
	var autoplay = settings.ui3_playback_autoplay == "1";
	var loopingEnabled = settings.ui3_playback_loop == "1";
	var SpeedOptions =
		[
			0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256
		];
	var playSpeed = 1;
	for (var i = 0; i < SpeedOptions.length; i++)
		if (SpeedOptions[i] == settings.ui3_playback_speed)
			playSpeed = SpeedOptions[i];

	var SetPlaySpeedLabel = function ()
	{
		$("#playbackSpeedText").text(playSpeed + "x");
	};
	SetPlaySpeedLabel();

	this.resized = function ()
	{
		var paddingSize = $pc.innerWidth() - $pc.width();
		$pc.css("width", ($pc.parent().width() - paddingSize) + "px");
		seekBar.resized();
	}
	this.Show = function ()
	{
		if (!isVisible)
		{
			SetQualityHint();
			$pc.stop(true, true);
			$pc.show();
			isVisible = true;
			self.resized();
		}
		playbackHeader.Show();
	}
	this.Hide = function ()
	{
		if (isVisible)
		{
			CloseSettings();
			$pc.stop(true, true);
			$pc.hide();
			isVisible = false;
			self.resized();
			seekBar.onHide();
		}
		playbackHeader.Hide();
	}
	this.FadeIn = function ()
	{
		if (!isVisible)
		{
			SetQualityHint();
			$pc.stop(true, true);
			$pc.fadeIn(100);
			isVisible = true;
			self.resized();
		}
		playbackHeader.FadeIn();
	}
	this.FadeOut = function ()
	{
		if (isVisible)
		{
			CloseSettings();
			if (seekBar.IsDragging())
				return;
			$pc.stop(true, true);
			$pc.fadeOut(100);
			isVisible = false;
			self.resized();
			seekBar.onHide();
		}
		playbackHeader.FadeOut();
	}
	var clearHideTimout = function ()
	{
		if (hideTimeout != null)
		{
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
	}
	this.SetDownloadClipLink = function (clipData)
	{
		var clipInfo = clipLoader.GetDownloadClipInfo(clipData);
		var $btn = $("#clipDownloadButton");
		$btn.attr("href", clipInfo.href);
		if (clipInfo.download)
			$btn.attr("download", clipInfo.download);
		else
			$btn.removeAttr("download");
	}
	$layoutbody.on("mouseleave", function (e)
	{
		mouseCoordFixer.fix(e);
		CloseSettings();
		if (videoPlayer.Loading().image.isLive || pointInsideElement($layoutbody, e.pageX, e.pageY))
			return;
		clearHideTimout();
		self.FadeOut();
	});
	$layoutbody.on("mouseenter mousemove touchstart touchmove touchend touchcancel", function (e)
	{
		if (videoPlayer.Loading().image.isLive)
			return;
		mouseCoordFixer.fix(e);
		self.FadeIn();
		clearHideTimout();
		if (!pointInsideElement($pc, e.pageX, e.pageY) && !pointInsideElement($playbackSettings, e.pageX, e.pageY))
			hideTimeout = setTimeout(function () { self.FadeOut(); }, 3000);
	});
	$(document).mouseup(function ()
	{
		CloseSettings();
	});
	this.OpenSettingsPanel = function ()
	{
		if (new Date().getTime() - 33 <= settingsClosedAt)
			return;
		RebuildSettingsPanelEmpty();
		$playbackSettings.addClass("qualityPanel");
		$playbackSettings.append('<div class="playbackSettingsCheckboxWrapper">'
			+ '<input id="cbAutoplay" type="checkbox" onclick="playbackControls.AutoplayClicked()" '
			+ (autoplay ? ' checked="checked"' : '')
			+ '/>'
			+ '<label for="cbAutoplay"><span class="ui"></span>Autoplay<div class="playbackSettingsSpacer"></div></label>'
			+ '</div>');
		$playbackSettings.append('<div class="playbackSettingsCheckboxWrapper">'
			+ '<input id="cbReverse" type="checkbox" onclick="playbackControls.ReverseClicked()" '
			+ (playReverse ? ' checked="checked"' : '')
			+ '/>'
			+ '<label for="cbReverse"><span class="ui"></span>Reverse<div class="playbackSettingsSpacer"></div></label>'
			+ '</div>');
		$playbackSettings.append('<div class="playbackSettingsCheckboxWrapper">'
			+ '<input id="cbLoop" type="checkbox" onclick="playbackControls.LoopClicked()" '
			+ (loopingEnabled ? ' checked="checked"' : '')
			+ '/>'
			+ '<label for="cbLoop"><span class="ui"></span>Loop<div class="playbackSettingsSpacer"></div></label>'
			+ '</div>');
		var $speedBtn = $('<div class="playbackSettingsLine">'
			+ 'Speed<div class="playbackSettingsFloatRight">'
			+ (playSpeed == 1 ? "Normal" : playSpeed)
			+ '<div class="playbackSettingsRightArrow"><svg class="icon"><use xlink:href="#svg_x5F_PTZcardinalRight"></use></svg></div>'
			+ '</div></div>');
		$speedBtn.click(self.OpenSpeedPanel);
		$playbackSettings.append($speedBtn);
		var $qualityBtn = $('<div class="playbackSettingsLine">'
			+ 'Quality<div class="playbackSettingsFloatRight">'
			+ jpegQualityHelper.GetQualityAbbr()
			+ '<div class="playbackSettingsRightArrow"><svg class="icon"><use xlink:href="#svg_x5F_PTZcardinalRight"></use></svg></div>'
			+ '</div></div>');
		$qualityBtn.click(OpenQualityPanel);
		$playbackSettings.append($qualityBtn);
		$layoutbody.append($playbackSettings);
	}
	this.OpenSpeedPanel = function ()
	{
		RebuildSettingsPanelEmpty();
		$playbackSettings.addClass("speedPanel");
		var $backBtn = $('<div class="playbackSettingsLine playbackSettingsHeading">'
			+ '<div class="playbackSettingsLeftArrow"><svg class="icon"><use xlink:href="#svg_x5F_PTZcardinalLeft"></use></svg></div> '
			+ 'Speed</div>');
		$backBtn.click(self.OpenSettingsPanel);
		$playbackSettings.append($backBtn);

		for (var i = 0; i < SpeedOptions.length; i++)
		{
			var $item = $('<div class="playbackSettingsLine alignRight"></div>');
			$item.text(SpeedOptions[i] == 1 ? "Normal" : SpeedOptions[i]);
			if (SpeedOptions[i] == playSpeed)
				$item.addClass("selected");
			$item.get(0).listItemIndex = i;
			$item.click(function ()
			{
				settings.ui3_playback_speed = playSpeed = SpeedOptions[this.listItemIndex];
				SetPlaySpeedLabel();
				CloseSettings();
			});
			$playbackSettings.append($item);
		}

		$layoutbody.append($playbackSettings);
	}
	var OpenQualityPanel = function ()
	{
		RebuildSettingsPanelEmpty();
		var $backBtn = $('<div class="playbackSettingsLine playbackSettingsHeading">'
			+ '<div class="playbackSettingsLeftArrow"><svg class="icon"><use xlink:href="#svg_x5F_PTZcardinalLeft"></use></svg></div> '
			+ 'Quality</div>');
		$backBtn.click(self.OpenSettingsPanel);
		$playbackSettings.append($backBtn);

		var qualityListDef = dropdownBoxes.listDefs["streamingQuality"];
		for (var i = 0; i < qualityListDef.items.length; i++)
		{
			var $item = $('<div class="playbackSettingsLine alignRight"></div>');
			$item.text(qualityListDef.items[i].text);
			if (i == qualityListDef.selectedIndex)
				$item.addClass("selected");
			$item.get(0).listItemIndex = i;
			$item.click(function ()
			{
				SetQualityHint(qualityListDef.items[this.listItemIndex].shortAbbr);
				dropdownBoxes.setLabelText("streamingQuality", qualityListDef.items[this.listItemIndex].text);
				qualityListDef.selectItemByIndex(this.listItemIndex);
				CloseSettings();
			});
			$playbackSettings.append($item);
		}

		$layoutbody.append($playbackSettings);
	}
	var CloseSettings = function ()
	{
		if ($playbackSettings.length > 0)
		{
			$playbackSettings.remove();
			$playbackSettings = $();
			settingsClosedAt = new Date().getTime();
		}
	}
	var RebuildSettingsPanelEmpty = function ()
	{
		CloseSettings();

		var pcHeight = $pc.height();
		var availableHeight = $("#layoutbody").height() - pcHeight;

		$playbackSettings = $('<div class="playbackSettings"></div>');
		$playbackSettings.css("bottom", (pcHeight + 12) + "px");
		$playbackSettings.css("max-height", (availableHeight - 44) + "px");
		$playbackSettings.on("mouseup", function () { return false; });
		$playbackSettings.on("mousedown touchstart", function (e)
		{
			$.hideAllContextMenus();
			return stopDefault(e);
		});
	}
	this.AutoplayClicked = function ()
	{
		autoplay = $("#cbAutoplay").is(":checked");
		settings.ui3_playback_autoplay = autoplay ? "1" : "0";
	}
	this.ReverseClicked = function ()
	{
		playReverse = $("#cbReverse").is(":checked");
		settings.ui3_playback_reverse = playReverse ? "1" : "0";
	}
	this.LoopClicked = function ()
	{
		loopingEnabled = $("#cbLoop").is(":checked");
		settings.ui3_playback_loop = loopingEnabled ? "1" : "0";
	}
	this.MouseInSettingsPanel = function (e)
	{
		return pointInsideElement($playbackSettings, e.pageX, e.pageY);
	}
	this.SettingsPanelIsOpen = function (e)
	{
		return $playbackSettings.length > 0;
	}
	this.GetPlaybackSpeed = function ()
	{
		return playSpeed;
	}
	this.GetPlayReverse = function ()
	{
		return playReverse;
	}
	this.GetAutoplay = function ()
	{
		return autoplay;
	}
	this.GetLoopingEnabled = function ()
	{
		return loopingEnabled;
	}
	var SetQualityHint = function (hintText)
	{
		if (!hintText)
			hintText = dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().shortAbbr;
		$("#playbackSettingsQualityMark").removeClass("HD SD LD");
		$("#playbackSettingsQualityMark").addClass(hintText);
		$("#playbackSettingsQualityMark").text(hintText);
	}
}
///////////////////////////////////////////////////////////////
// Playback Controls //////////////////////////////////////////
///////////////////////////////////////////////////////////////
function PlaybackHeader()
{
	var self = this;
	var $layoutbody = $("#layoutbody");
	var $ph = $("#playbackHeader");
	var $closeBtnL = $("#closeClipLeft");
	var $clipNameHeading = $("#clipNameHeading");
	var isVisible = $ph.is(":visible");

	$closeBtnL.click(function ()
	{
		clipLoader.CloseCurrentClip();
	});
	this.resized = function ()
	{
		$clipNameHeading.css("width", $ph.width() - $closeBtnL.outerWidth(true));
	}
	this.Show = function ()
	{
		if (!isVisible)
		{
			$ph.stop(true, true);
			$ph.show();
			isVisible = true;
			self.resized();
		}
	}
	this.Hide = function ()
	{
		if (isVisible)
		{
			$ph.stop(true, true);
			$ph.hide();
			isVisible = false;
			self.resized();
		}
	}
	this.FadeIn = function ()
	{
		if (!isVisible)
		{
			$ph.stop(true, true);
			$ph.fadeIn(100);
			isVisible = true;
			self.resized();
		}
	}
	this.FadeOut = function ()
	{
		if (isVisible)
		{
			$ph.stop(true, true);
			$ph.fadeOut(100);
			isVisible = false;
			self.resized();
		}
	}
	this.SetClipName = function (clipData)
	{
		var name = clipLoader.GetClipDisplayName(clipData);
		$clipNameHeading.text(name);
	}
}
///////////////////////////////////////////////////////////////
// Seek Bar ///////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function SeekBar()
{
	var self = this;
	var wrapper = $("#seekBarWrapper");
	var bar = $("#seekBarMain");
	var left = $("#seekBarLeft");
	var handle = $("#seekBarHandle");
	var seekhint = $("#seekhint");
	var seekhint_img = $("#seekhint_img");
	var seekhint_canvas = $("#seekhint_canvas");
	var seekhint_helper = $("#seekhint_helper");
	var seekhint_label = $("#seekhint_label");
	var highlight = $("#seekBarHighlight");
	var seekHintVisible = false;
	var isDragging = false;
	var isTouchDragging = false;
	var doubleClickTime = 750;
	var lastMouseDown = { X: -1000, Y: -1000, Time: 0 };
	var lastDoubleMouseDownStarted = 0;
	var seekHintInfo = { canvasVisible: false, helperVisible: false, visibleMsec: -1, queuedMsec: -1, loadingMsec: -1, lastSnapshotId: "" }

	seekhint_img.load(function ()
	{
		imageRenderer.CopyImageToCanvas("seekhint_img", "seekhint_canvas");
		seekHintInfo.loading = false;
		seekHintInfo.visibleMsec = seekHintInfo.loadingMsec;
		if (seekHintInfo.queuedMsec != -1)
			loadSeekHintImg(seekHintInfo.queuedMsec);
	});
	seekhint_img.error(function ()
	{
		imageRenderer.ClearCanvas("seekhint_canvas");
		seekHintInfo.loading = false;
		seekHintInfo.loadingMsec = seekHintInfo.visibleMsec = -1;
		if (seekHintInfo.queuedMsec != -1)
			loadSeekHintImg(seekHintInfo.queuedMsec);
	});

	this.resized = function ()
	{
		self.drawSeekbarAtTime(videoPlayer.GetClipPlaybackPositionMs());
	}
	var setSeekHintCanvasVisibility = function (visible)
	{
		if (visible)
		{
			if (!seekHintInfo.canvasVisible)
			{
				seekhint_canvas.show();
				seekHintInfo.canvasVisible = true;
			}
		}
		else
		{
			if (seekHintInfo.canvasVisible)
			{
				seekhint_canvas.hide();
				seekHintInfo.canvasVisible = false;
			}
		}
	}
	var setSeekHintHelperVisibility = function (visible)
	{
		if (visible)
		{
			if (!seekHintInfo.helperVisible)
			{
				seekhint_helper.show();
				seekHintInfo.helperVisible = true;
			}
		}
		else
		{
			if (seekHintInfo.helperVisible)
			{
				seekhint_helper.hide();
				seekHintInfo.helperVisible = false;
			}
		}
	}
	var updateSeekHint = function (e)
	{
		if (!seekHintVisible)
			return;
		// Update seek hint text and location
		var msec = videoPlayer.Loading().image.msec;
		var barO = bar.offset();
		var barW = bar.width();

		var hintX = Clamp(e.pageX - barO.left, 0, barW);
		var seekHintW = seekhint.outerWidth();
		var seekHintL = (hintX + barO.left) - (seekHintW / 2);
		seekHintL = Clamp(seekHintL, barO.left, (barO.left + barW) - seekHintW);
		seekhint.css("left", seekHintL + "px");
		var seekHintMs = Clamp(parseInt((hintX / barW) * (msec - 1)), 0, msec);
		var touch = touchEvents.isTouchEvent(e);
		if (!touch && isDragging)
		{
			// Mouse dragging: show time offset only
			setSeekHintCanvasVisibility(false);
			setSeekHintHelperVisibility(false);
		}
		else if (!playbackControls.SettingsPanelIsOpen()
			&& ((!touch && !isDragging && videoPlayer.Playback_IsPaused()) || (touch && isDragging)))
		{
			// (Mouse hovering while paused) or (touch dragging): show preview image
			setSeekHintCanvasVisibility(true);
			setSeekHintHelperVisibility(false);
			if (seekHintInfo.visibleMsec == seekHintInfo.loadingMsec)
				loadSeekHintImg(seekHintMs);
			else
				seekHintInfo.queuedMsec = seekHintMs;
			if (touch && isDragging)
			{
				// touch dragging: dim main image and prevent it from showing
			}
		}
		else
		{
			setSeekHintCanvasVisibility(false);
			setSeekHintHelperVisibility(!playbackControls.SettingsPanelIsOpen());
		}
		seekhint_label.html(msToTime(seekHintMs, msec < 30000 ? 1 : 0));
		seekhint.css("top", ((barO.top - 10) - seekhint.outerHeight(true)) + "px");
		highlight.css("width", hintX + "px");
	}
	var loadSeekHintImg = function (msec)
	{
		seekHintInfo.queuedMsec = -1;
		if (seekHintInfo.visibleMsec != msec)
		{
			seekHintInfo.loadingMsec = msec;
			if (seekHintInfo.lastSnapshotId != "" && seekHintInfo.lastSnapshotId == videoPlayer.GetStaticSnapshotId())
				return; // No need to load same snapshot as before
			seekHintInfo.lastSnapshotId = videoPlayer.GetStaticSnapshotId();
			seekhint_img.attr('src', videoPlayer.GetLastSnapshotUrl().replace(/time=\d+/, "time=" + msec) + "&w=160&q=50");
			seekhint_canvas.css('height', (160 / videoPlayer.Loading().image.aspectratio) + 'px');
		}
	}
	this.resetSeekHintImg = function ()
	{
		seekHintInfo.loadingMsec = seekHintInfo.queuedMsec = seekHintInfo.visibleMsec = -1;
		seekhint_canvas.css('height', (160 / videoPlayer.Loading().image.aspectratio) + 'px');
		imageRenderer.ClearCanvas("seekhint_canvas");
	}
	this.drawSeekbarAtTime = function (timeValue)
	{
		var msec = videoPlayer.Loading().image.msec;
		var currentSeekBarPositionRelative;
		if (msec <= 1)
			currentSeekBarPositionRelative = 0;
		else
			currentSeekBarPositionRelative = parseFloat(timeValue / (msec - 1));
		var seekbarW = bar.width();
		var x = currentSeekBarPositionRelative * seekbarW;
		x = Clamp(x, 0, seekbarW);
		left.css("width", x + "px");
		handle.css("left", x + "px");
		if (timeValue == msec - 1)
			timeValue = msec;
		$("#playbackProgressText").html(msToTime(timeValue, 0) + " / " + msToTime(msec, 0));
	}
	this.IsDragging = function ()
	{
		return isDragging;
	}
	this.onHide = function ()
	{
		handle.removeClass("unfocus");
		bar.removeClass("unfocus");
		handle.removeClass("focus");
		bar.removeClass("focus");
	}
	var SetBarState = function (state)
	{
		if (state == 1)
		{
			handle.addClass("focus");
			bar.addClass("focus");
			seekhint.show();
			seekHintVisible = true;
		}
		else
		{
			handle.removeClass("focus");
			bar.removeClass("focus");
			seekhint.hide();
			seekHintVisible = false;
			highlight.css("width", "0px");
		}
	}
	this.dblClick = function ()
	{
		videoPlayer.Playback_PlayPause();
	}
	var mouseStillSinceLastClick = function (e)
	{
		return Math.abs(e.pageX - lastMouseDown.X) < 20 && Math.abs(e.pageY - lastMouseDown.Y) < 20;
	}
	var mouseUp = function (e)
	{
		mouseCoordFixer.fix(e);
		if (isTouchDragging)
		{
			imageRenderer.ChangeFrameDefaultOpacity(1);
			imageRenderer.SetFrameOpacity_Default();
			mouseMoved(e, true);
		}
		isTouchDragging = false;
		if (isDragging)
		{
			isDragging = false;
			if (touchEvents.isTouchEvent(e) || !pointInsideElement(wrapper, e.pageX, e.pageY))
				SetBarState(0);
		}
	}
	var mouseMoved = function (e, overrideSetPlaybackPosition)
	{
		if (isDragging)
		{
			var barO = bar.offset();
			var barW = bar.width();
			var x = (e.pageX - barO.left);
			x = Clamp(x, 0, barW);
			left.css("width", x + "px");
			handle.css("left", x + "px");
			if (!isTouchDragging || overrideSetPlaybackPosition)
			{
				var msec = videoPlayer.Loading().image.msec;
				if (msec <= 1)
					videoPlayer.SeekToMs(0);
				else
				{
					var positionRelative = x / barW;
					var posX = Clamp(parseInt(positionRelative * (msec - 1)), 0, msec - 1);
					videoPlayer.SeekToMs(posX);
				}
			}
		}
		updateSeekHint(e);
	}
	wrapper.on("mousedown touchstart", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (e.which != 3)
		{
			var thisTime = new Date().getTime();
			isDragging = true;
			isTouchDragging = touchEvents.isTouchEvent(e);
			if (isTouchDragging)
			{
				imageRenderer.ChangeFrameDefaultOpacity(0.5);
				imageRenderer.SetFrameOpacity_Default();
			}
			SetBarState(1);

			if (thisTime < lastMouseDown.Time + doubleClickTime && mouseStillSinceLastClick(e))
				lastDoubleMouseDownStarted = lastMouseDown.Time;
			lastMouseDown.Time = thisTime;
			lastMouseDown.X = e.pageX;
			lastMouseDown.Y = e.pageY;
			mouseMoved(e);
			$.hideAllContextMenus();
			return stopDefault(e);
		}
		else
			mouseMoved(e);
	});
	$(document).on("mousemove touchmove", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		mouseMoved(e);
	});
	$(document).on("mouseup mouseleave touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		mouseUp(e);
		if (new Date().getTime() < lastDoubleMouseDownStarted + doubleClickTime && mouseStillSinceLastClick(e))
		{
			lastDoubleMouseDownStarted -= doubleClickTime;
			self.dblClick();
		}
	});
	wrapper.on("mouseenter", function (e)
	{
		mouseCoordFixer.fix(e);
		SetBarState(1);
		updateSeekHint(e);
	});
	wrapper.on("mouseleave", function (e)
	{
		mouseCoordFixer.fix(e);
		if (!isDragging)
			SetBarState(0);
	});
}
///////////////////////////////////////////////////////////////
// Touch Event Helper /////////////////////////////////////////
///////////////////////////////////////////////////////////////
function TouchEventHelper()
{
	var self = this;
	var mouseEventsBlockedUntil = 0;
	this.Gate = function (e)
	{
		// Returns true if the event handler should be prevented due to being a non-touch event after recent touch events
		if (self.isTouchEvent(e))
		{
			mouseEventsBlockedUntil = new Date().getTime() + 1000;
			return false;
		}
		else
			return mouseEventsBlockedUntil > new Date().getTime();
	}
	this.isTouchEvent = function (e)
	{
		return e.type.startsWith("touch");
	}
}
///////////////////////////////////////////////////////////////
// Load Clip List /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipLoader(clipsBodySelector)
{
	var self = this;
	var HeightOfOneClipTilePx = 53;
	var HeightOfOneSizeSmallClipTilePx = 40;
	var HeightOfOneDateTilePx = 27;
	var asyncThumbnailDownloader = new AsyncThumbnailDownloader();
	var $clipsbody = $(clipsBodySelector);
	var $clipListTopDate = $('#clipListTopDate');
	var clipListCache = new Object();
	var clipListIdCache = new Object();
	var loadedClipIds = new Array();
	var lastOpenedClipEle = null;
	var isLoadingAClipList = false;
	var QueuedClipListLoad = null;
	var failedClipListLoads = 0;
	var TotalUniqueClipsLoaded = 0;
	var TotalDateTilesLoaded = 0;
	var lastUiSizeWasSmall; // Initialized at end of constructor
	var currentTopDate = new Date(0);
	var lastLoadedCameraFilter = "index";
	this.suppressClipListLoad = false;

	// For updating an existing clip list
	var newestClipDate = 0;
	var clipListGrew = false;
	var lastClipListLoadedAtTime = new Date().getTime();

	// For handling multi-select only
	var selectedClips = [];
	var selectedClipsMap = new Object();
	var lastSelectedClipId = null;

	var bulkOperationInProgress = false;

	this.LoadClips = function (listName)
	{
		var loading = videoPlayer.Loading();
		if (loading.image && loading.image.isLive)
			lastLoadedCameraFilter = loading.image.id;
		loadClipsInternal(listName, lastLoadedCameraFilter, dateFilter.BeginDate, dateFilter.EndDate, false);
	}
	this.UpdateClipList = function ()
	{
		if (isLoadingAClipList)
			return;
		if (new Date().getTime() - lastClipListLoadedAtTime < 5000)
			return;
		if (newestClipDate == 0)
			return;
		if (!videoPlayer.Loading().cam)
			return;
		if (dateFilter.BeginDate != 0 && dateFilter.EndDate != 0)
			return;
		// We request clips starting from 60 seconds earlier so that metadata of recent clips may be updated.
		loadClipsInternal(null, lastLoadedCameraFilter, newestClipDate - 60, newestClipDate + 86400, false, true);
	}
	var loadClipsInternal = function (listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList)
	{
		if ((currentPrimaryTab != "clips" && currentPrimaryTab != "alerts") || self.suppressClipListLoad)
		{
			QueuedClipListLoad = null;
			return;
		}
		if (typeof (listName) == "undefined" || listName == null)
			listName = currentPrimaryTab == "clips" ? "cliplist" : "alertlist";
		if (!isContinuationOfPreviousLoad && !isUpdateOfExistingList)
		{
			if (isLoadingAClipList)
			{
				QueuedClipListLoad = function ()
				{
					loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList);
				};
				return;
			}

			tileLoader.AppearDisappearCheckEnabled = false;

			self.UnselectAllClips(true);
			TotalUniqueClipsLoaded = 0;
			TotalDateTilesLoaded = 0;
			loadedClipIds = new Array();

			newestClipDate = 0;
			clipListCache = new Object();
			clipListIdCache = new Object();

			$clipsbody.empty();
			$clipListTopDate.html("...");
			$clipsbody.html('<div class="clipListText">Loading...<br/><br/><span id="clipListDateRange"></span></div>');
			$.CustomScroll.callMeOnContainerResize();

			tileLoader.unregisterAllOnAppearDisappear();
			asyncThumbnailDownloader.Stop();

			isLoadingAClipList = true;
			//return;
		}
		if (isUpdateOfExistingList)
		{
			if (isLoadingAClipList)
				return;
			isLoadingAClipList = true;
		}

		var allowContinuation = false;
		var args = { cmd: listName, camera: cameraId };
		if (myDateStart != 0 && myDateEnd != 0)
		{
			allowContinuation = true;
			args.startdate = myDateStart;
			args.enddate = myDateEnd;
		}

		var isClipList = listName == "cliplist";

		ExecJSON(args, function (response)
		{
			if (response.result != "success")
			{
				$clipsbody.html('<div class="clipListText">Failed to load!</div>');
				return;
			}
			failedClipListLoads = 0;
			var clipTileHeight = getClipTileHeight();
			var previouslyOpenedClip = null;
			var loadingImage = videoPlayer.Loading().image;
			if (typeof (response.data) != "undefined")
			{
				var newUpdateClipIds = [];
				var newUpdateClips = [];
				var previousClipDate = new Date(0);
				for (var clipIdx = 0; clipIdx < response.data.length; clipIdx++)
				{
					// clip.camera : "shortname"
					// clip.path : "@0000123.bvr"
					// clip.offset : 0
					// clip.date : 12345
					// clip.color : 8151097
					// clip.flags : 128
					// clip.msec : 6261
					// clip.filesize : "10sec (3.09M)"
					// clip.filetype : "bvr H264 New"

					var clip = response.data[clipIdx];
					if (newestClipDate < clip.date)
						newestClipDate = clip.date;
					var clipData = new Object();
					clipData.rawData = clip;
					clipData.isClip = isClipList;
					clipData.roughLength = CleanUpFileSize(clip.filesize);
					clipData.isSnapshot = clipData.roughLength == "Snapshot";
					clipData.camera = clip.camera;
					clipData.path = clip.path;
					clipData.flags = clip.flags;
					clipData.date = new Date(clip.date * 1000);
					clipData.colorHex = BlueIrisColorToCssColor(clip.color);
					clipData.fileSize = GetFileSize(clip.filesize);
					if (clipData.isSnapshot)
						clipData.msec = 2000;
					else if (typeof clip.msec != "undefined" && listName == "cliplist")
						clipData.msec = clip.msec;
					else
						clipData.msec = GetClipLengthMs(clipData.roughLength);

					clipData.clipId = clip.path.replace(/@/g, "").replace(/\..*/g, "");
					clipData.thumbPath = clip.path;

					if (!isSameDay(previousClipDate, clipData.date))
					{
						// TODO: (minor importance) Deal with adding new date tiles when isUpdateOfExistingList is true.  Perhaps just fake it and do a full clip list load when the system time changes from one day to the next.
						if (previousClipDate.getTime() == 0)
							$clipListTopDate.attr("defaultStr", GetDateDisplayStr(clipData.date)); // Do not add the first date tile because it is redundant with a date display above the list.
						else if (!isUpdateOfExistingList)
						{
							tileLoader.registerOnAppearDisappear({ isDateTile: true, date: clipData.date }, DateTileOnAppear, DateTileOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
							TotalDateTilesLoaded++;
						}
					}
					previousClipDate = clipData.date;

					if (!clipListCache[clip.camera])
						clipListCache[clip.camera] = new Object();
					var existingClipData = clipListCache[clip.camera][clip.path];
					if (existingClipData)
					{
						UpdateExistingClipData(existingClipData, clipData);
					}
					else // Only register if not already registered
					{
						if (isUpdateOfExistingList)
						{
							newUpdateClips.push(clipData);
							newUpdateClipIds.push(clipData.clipId);
						}
						else
						{
							loadedClipIds.push(clipData.clipId);
							tileLoader.registerOnAppearDisappear(clipData, ClipOnAppear, ClipOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
						}
						TotalUniqueClipsLoaded++;
						clipListCache[clip.camera][clip.path] = clipData;
						clipListIdCache[clipData.clipId] = clipData;
						if (!isUpdateOfExistingList && previouslyOpenedClip == null && !loadingImage.isLive && loadingImage.path == clip.path)
							previouslyOpenedClip = clipData;
					}

				}
				if (isUpdateOfExistingList && newUpdateClipIds.length > 0)
				{
					loadedClipIds = newUpdateClipIds.concat(loadedClipIds);
					tileLoader.preserveScrollPosition(clipTileHeight, HeightOfOneDateTilePx, newUpdateClipIds.length);
					tileLoader.injectNewClips(newUpdateClips, ClipOnAppear, ClipOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
					clipListGrew = true;
				}

				if (QueuedClipListLoad != null)
				{
					isLoadingAClipList = false;
					lastClipListLoadedAtTime = new Date().getTime();
					QueuedClipListLoad();
					QueuedClipListLoad = null;
					return;
				}

				if (allowContinuation && response.data.length >= 1000)
				{
					if (isUpdateOfExistingList)
					{
						toaster.Info("Automatic " + (listName == "cliplist" ? "clip list" : "alert list") + " update got too many items.  Refreshing clip list now.", 10000);
						isLoadingAClipList = false;
						lastClipListLoadedAtTime = new Date().getTime();
						self.LoadClips();
						return;
					}
					myDateEnd = response.data[response.data.length - 1].date;
					$("#clipListDateRange").html("&nbsp;Remaining to load:<br/>&nbsp;&nbsp;&nbsp;" + parseInt((myDateEnd - myDateStart) / 86400) + " days");
					$.CustomScroll.callMeOnContainerResize();
					return loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, true, isUpdateOfExistingList);
				}
			}

			isLoadingAClipList = false;
			lastClipListLoadedAtTime = new Date().getTime();
			if (isUpdateOfExistingList)
			{
				if (clipListGrew)
				{
					resized();
					BI_CustomEvent.Invoke("ClipList_Updated", response);
				}
			}
			else
			{
				$clipsbody.empty();

				// Force clip list to be the correct height before clip tiles load.
				$clipsbody.append('<div id="clipListHeightSetter" style="height:' + ((clipTileHeight * TotalUniqueClipsLoaded) + (HeightOfOneDateTilePx * TotalDateTilesLoaded)) + 'px;width:0px;"></div>');

				asyncThumbnailDownloader = new AsyncThumbnailDownloader();
				tileLoader.AppearDisappearCheckEnabled = true;
				tileLoader.appearDisappearCheck();

				if (!loadingImage.isLive && !isUpdateOfExistingList)
				{
					if (previouslyOpenedClip == null)
						self.CloseCurrentClip();
					else
					{
						// A clip is still playing, and it is in the new list.  Select it and scroll to it.
						self.SelectClipIdNoOpen(previouslyOpenedClip.clipId);
						self.ScrollClipList(previouslyOpenedClip.y, clipTileHeight);
					}
				}

				$.CustomScroll.callMeOnContainerResize();

				BI_CustomEvent.Invoke("ClipList_Loaded", response);
			}
		}
			, function (jqXHR, textStatus, errorThrown)
			{
				$clipsbody.html('<div class="clipListText">Failed to load!</div>');
				var tryAgain = ++failedClipListLoads < 5
				toaster.Error("Failed to load " + (listName == "cliplist" ? "clip list" : "alert list") + ".<br/>Will " + (tryAgain ? "" : "NOT ") + "try again.<br/>" + textStatus + "<br/>" + errorThrown, 5000);

				if (tryAgain)
				{
					setTimeout(function ()
					{
						loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList);
					}, 1000);
				}
				else
				{
					isLoadingAClipList = false;
					lastClipListLoadedAtTime = new Date().getTime();
					failedClipListLoads = 0;
				}
			});
	};
	this.resizeClipList = function ()
	{
		var currentUiSizeIsSmall = useSmallClipTileHeight();
		if ((lastUiSizeWasSmall && !currentUiSizeIsSmall) || (!lastUiSizeWasSmall && currentUiSizeIsSmall) || clipListGrew)
		{
			clipListGrew = false;
			lastUiSizeWasSmall = currentUiSizeIsSmall;
			var clipTileHeight = getClipTileHeight();
			tileLoader.resizeClipList(clipTileHeight, HeightOfOneDateTilePx);
			$("#clipListHeightSetter").css("height", ((clipTileHeight * TotalUniqueClipsLoaded) + (HeightOfOneDateTilePx * TotalDateTilesLoaded)) + "px");
		}
	}
	var getClipTileHeight = function ()
	{
		return useSmallClipTileHeight() ? HeightOfOneSizeSmallClipTilePx : HeightOfOneClipTilePx;
	}
	var useSmallClipTileHeight = function ()
	{
		return uiSizeHelper.GetCurrentSize() == "small" || uiSizeHelper.GetCurrentSize() == "smaller";
	}
	this.GetCachedClip = function (cameraId, clipPath)
	{
		var camClips = clipListCache[cameraId];
		if (camClips)
			return camClips[clipPath];
		return null;
	}
	this.GetClipFromId = function (clipId)
	{
		return clipListIdCache[clipId];
	}
	this.GetClipIdsBetween = function (first, last)
	{
		var between = [];
		var idxFirst = loadedClipIds.indexOf(first);
		if (idxFirst == -1)
			return between;
		var idxLast = loadedClipIds.indexOf(last);
		if (idxLast == -1)
			return between;
		if (idxFirst == idxLast)
		{
			between.push(first);
			return;
		}
		if (idxFirst > idxLast)
		{
			var tmp = idxLast;
			idxLast = idxFirst;
			idxFirst = tmp;
		}
		for (var i = idxFirst; i <= idxLast; i++)
			between.push(loadedClipIds[i]);
		return between;
	}
	this.GetDownloadClipInfo = function (clipData)
	{
		var retVal = {};
		retVal.href = currentServer.remoteBaseURL + "clips/" + clipData.path + currentServer.GetRemoteSessionArg("?");
		var extensionIdx = clipData.path.indexOf(".");
		if (extensionIdx == -1)
			retVal.download = null;
		else
		{
			var date = GetDateStr(clipData.date);
			date = date.replace(/\//g, '-').replace(/:/g, '.');
			retVal.download = cameraListLoader.GetCameraName(clipData.camera) + " " + date + clipData.path.substr(extensionIdx);
		}
		return retVal;
	}
	this.GetClipDisplayName = function (clipData)
	{
		var date = GetDateStr(clipData.date);
		return cameraListLoader.GetCameraName(clipData.camera) + " " + date;
	}
	this.IsClipSelected = function (clipId)
	{
		return selectedClipsMap[clipId] ? true : false;
	}
	this.GetAllSelected = function ()
	{
		return selectedClips;
	}
	var CleanUpFileSize = function (fileSize)
	{
		var indexSpace = fileSize.indexOf(" ");
		if (indexSpace > 0)
			fileSize = fileSize.substring(0, indexSpace);
		return fileSize;
	}
	var GetFileSize = function (fileSize)
	{
		var parentheticals = fileSize.match(/\(.*?\)$/);
		if (parentheticals && parentheticals.length > 0)
			return parentheticals[0].substr(1, parentheticals[0].length - 2);
		return "";
	}
	var GetClipLengthMs = function (str)
	{
		var time = GetTimeFromBIStr(str);
		return (time.hours * 3600000) + (time.minutes * 60000) + (time.seconds * 1000);
	}
	var GetClipDurStrFromMs = function (str)
	{
		if (str == "Snapshot")
			return "S";
		var time = GetTimeFromBIStr(str);
		var hours;
		var minutes;
		if (time.hours == 0)
		{
			hours = "";
			minutes = time.minutes.toString();
		}
		else
		{
			hours = time.hours.toString() + ":";
			minutes = time.minutes.toString().padLeft(2, '0');
		}
		return hours + minutes + ":" + time.seconds.toString().padLeft(2, '0');
	}
	var GetTimeFromBIStr = function (str)
	{
		var hours = 0;
		var minutes = 0;
		var seconds = 10;

		var match = new RegExp("(\\d+)h").exec(str);
		if (match)
			hours = parseInt(match[1]);

		match = new RegExp("(\\d+)m").exec(str);
		if (match)
			minutes = parseInt(match[1]);

		match = new RegExp("(\\d+)sec").exec(str);
		if (match)
			seconds = parseInt(match[1]);
		return { hours: hours, minutes: minutes, seconds: seconds };
	}
	var UpdateExistingClipData = function (oldClipData, newClipData)
	{
		if (oldClipData.clipId != newClipData.clipId)
			return;

		var $clip = $("#c" + oldClipData.clipId);

		if (oldClipData.roughLength != newClipData.roughLength)
		{
			oldClipData.roughLength = newClipData.roughLength;
			if ($clip.length > 0)
				$clip.find('.clipdur').html(GetClipDurStrFromMs(oldClipData.roughLength));
		}
		if (oldClipData.fileSize != newClipData.fileSize)
		{
			oldClipData.fileSize = newClipData.fileSize;
		}
		if (oldClipData.msec != newClipData.msec)
		{
			oldClipData.msec = newClipData.msec;
		}
		if (oldClipData.flags != newClipData.flags)
		{
			oldClipData.flags = newClipData.flags;
			self.RepairClipFlagState(oldClipData);
		}
	}
	var ThumbOnAppear = function (ele)
	{
		var path = currentServer.remoteBaseURL + "thumbs/" + ele.thumbPath + currentServer.GetRemoteSessionArg("?");
		if (ele.getAttribute('src') != path)
			asyncThumbnailDownloader.Enqueue(ele, path);
	}
	var ThumbOnDisappear = function (ele)
	{
		asyncThumbnailDownloader.Dequeue(ele);
	}
	var ClipOnAppear = function (clipData)
	{
		ClipTileCreate(clipData);
		ThumbOnAppear($("#t" + clipData.clipId).get(0));
	}
	var ClipOnDisappear = function (clipData)
	{
		ThumbOnDisappear($("#t" + clipData.clipId).get(0));
		// We need clip elements to stick around after they've been created
	}
	var ClipTileCreateFromId = function (clipId)
	{
		var $clip = $("#c" + clipId);
		if ($clip.length > 0)
			return;
		var clipData = self.GetClipFromId(clipId);
		if (clipData)
			ClipTileCreate(clipData, $clip);
	}
	var ClipTileCreate = function (clipData, $clip)
	{
		if (!$clip)
			$clip = $("#c" + clipData.clipId);
		if ($clip.length == 0)
		{
			var timeStr = GetTimeStr(clipData.date);
			var clipDur = GetClipDurStrFromMs(clipData.roughLength);
			var clipDurTitle = clipDur == 'S' ? ' title="Snapshot"' : '';
			$("#clipsbody").append('<div id="c' + clipData.clipId + '" class="cliptile" style="top:' + clipData.y + 'px">'
				+ '<div class="verticalAlignHelper"></div>'
				+ '<div class="clipimghelper">'
				+ '<div class="verticalAlignHelper"></div>'
				+ '<div class="clipdur"' + clipDurTitle + '>' + clipDur + '</div>'
				+ '<img id="t' + clipData.clipId + '" src="ui3/LoadingImage.png" />'
				+ '</div>'
				+ '<div class="clipcolorbar" style="background-color: #' + clipData.colorHex + ';"></div>'
				+ '<div class="clipdesc"><div class="cliptime">' + timeStr + '</div><div class="clipcam">' + cameraListLoader.GetCameraName(clipData.camera) + '</div></div>'
				+ '</div>');

			var $img = $("#t" + clipData.clipId).get(0).thumbPath = clipData.thumbPath;

			$clip = $("#c" + clipData.clipId);
			$clip.click(ClipClicked);
			var clipEle = $clip.get(0).clipData = clipData;

			clipListContextMenu.AttachContextMenu($clip);

			if (self.ClipDataIndicatesFlagged(clipData))
				self.ShowClipFlag(clipData);

			if (selectedClipsMap[clipData.clipId])
			{
				if (videoPlayer.Loading().image.path == clipData.path)
					self.OpenClip($clip.get(0), clipData.clipId, false);
				else
					$clip.addClass("selected");
			}
		}
	}
	this.ScrollToClipObj = function ($clip)
	{
		var offset = ($clipsbody.height() / 2) - ($clip.height() / 2);
		$clipsbody.scrollTop(($clipsbody.scrollTop() + $clip.position().top) - offset);
	}
	this.ScrollClipList = function (yPos, clipHeight)
	{
		var offset = ($clipsbody.height() / 2) - (clipHeight / 2);
		$clipsbody.scrollTop(yPos - offset);
	}
	var ClipClicked = function (e)
	{
		var clipId = this.clipData.clipId;
		if (e.shiftKey && lastSelectedClipId)
		{
			// Multi-select add-range
			var range = self.GetClipIdsBetween(lastSelectedClipId, this.clipData.clipId);

			if (!e.ctrlKey)
			{
				var lastSelSave = lastSelectedClipId;
				self.UnselectAllClips();
				lastSelectedClipId = lastSelSave;
			}

			if (range)
			{
				for (var i = 0; i < range.length; i++)
				{
					if (!selectedClipsMap[range[i]])
					{
						ClipTileCreateFromId(range[i]);
						$("#c" + range[i]).addClass("selected");
						selectedClips.push(range[i]);
						selectedClipsMap[range[i]] = true;
					}
				}
			}

			if (e.ctrlKey)
				lastSelectedClipId = clipId;
		}
		else if (e.ctrlKey)
		{
			// Multi-select toggle item
			lastSelectedClipId = clipId;
			if (selectedClipsMap[clipId] === true)
			{
				var idx = selectedClips.indexOf(clipId);
				if (idx > -1)
					selectedClips.splice(idx, 1);
				selectedClipsMap[clipId] = false;
				$("#c" + clipId).removeClass("selected");
			}
			else
			{
				selectedClips.push(clipId);
				selectedClipsMap[clipId] = true;
				$("#c" + clipId).addClass("selected");
			}
		}
		else
		{
			self.OpenClip(this, clipId, true);
		}
	}
	this.OpenClip = function (clipEle, clipId, alsoLoadClip)
	{
		self.UnselectAllClips(true);
		lastOpenedClipEle = clipEle;

		$(clipEle).addClass("opened");
		$(clipEle).addClass("selected");
		if (alsoLoadClip)
			videoPlayer.LoadClip(clipEle.clipData);

		// Multi-select start
		lastSelectedClipId = clipId;
		selectedClipsMap = new Object();
		selectedClipsMap[clipId] = true;
		selectedClips = [];
		selectedClips.push(clipId);
	}
	this.SelectClipIdNoOpen = function (clipId)
	{
		if (selectedClipsMap[clipId] !== true)
		{
			selectedClips.push(clipId);
			selectedClipsMap[clipId] = true;
			$("#c" + clipId).addClass("selected");
		}
	}
	this.CloseCurrentClip = function ()
	{
		if (lastOpenedClipEle)
		{
			if (selectedClips.length == 1 && selectedClipsMap[lastOpenedClipEle.id.substr(1)])
				self.UnselectAllClips(true);
			else
			{
				$(lastOpenedClipEle).removeClass("opened");
				lastOpenedClipEle = null;
			}
		}
		videoPlayer.goLive();
	}
	this.UnselectAllClips = function (alsoRemoveOpenedStatus)
	{
		if (alsoRemoveOpenedStatus && lastOpenedClipEle)
		{
			$(lastOpenedClipEle).removeClass("opened");
			lastOpenedClipEle = null;
		}
		for (var i = 0; i < selectedClips.length; i++)
			$("#c" + selectedClips[i]).removeClass("selected");
		lastSelectedClipId = null;
		selectedClipsMap = new Object();
		selectedClips = [];
	}
	var DateTileOnAppear = function (dateTileData)
	{
		var time = dateTileData.date.getTime();
		var $dateTile = $("#dt" + time);
		if ($dateTile.length == 0)
		{
			var timeStr = GetDateDisplayStr(dateTileData.date);
			$("#clipsbody").append('<div id="dt' + time + '" class="datetile" style="top:' + dateTileData.y + 'px">'
				+ timeStr
				+ '</div>');
		}
	}
	var DateTileOnDisappear = function (dateTileObj)
	{
	}
	var DateTileOnBecomeCurrent = function (dateTileData)
	{
		if (dateTileData == null)
		{
			currentTopDate = new Date(0);
			$clipListTopDate.html($clipListTopDate.attr("defaultStr"));
		}
		else if (!isSameDay(dateTileData.date, currentTopDate))
		{
			currentTopDate = dateTileData.date;
			$clipListTopDate.html(GetDateDisplayStr(dateTileData.date));
		}
	}
	var TileOnMove = function (obj)
	{
		if (obj.isDateTile)
			$("#dt" + obj.date.getTime()).css("top", obj.y + "px");
		else
			$("#c" + obj.clipId).css("top", obj.y + "px");
	}
	this.FlagCurrentClip = function ()
	{
		if (lastOpenedClipEle == null)
			return;
		// Find current flag state
		var clipData = lastOpenedClipEle.clipData;
		self.ToggleClipFlag(clipData);
	}
	this.ToggleClipFlag = function (clipData, onSuccess, onFailure)
	{
		var camIsFlagged = (clipData.flags & 2) > 0;
		var newFlags = camIsFlagged ? clipData.flags ^ 2 : clipData.flags | 2;
		UpdateClipFlags(clipData.path.replace(/\..*/g, ""), newFlags, function ()
		{
			// Success setting flag state
			clipData.flags = newFlags;
			if (camIsFlagged)
				self.HideClipFlag(clipData);
			else
				self.ShowClipFlag(clipData);
			if (onSuccess)
				onSuccess(clipData);
		}, function ()
			{
				if (onFailure)
					onFailure(clipData);
			});
	}
	this.HideClipFlag = function (clipData)
	{
		if (lastOpenedClipEle && lastOpenedClipEle.clipData == clipData)
			$("#clipFlagButton").removeClass("flagged");
		var $clip = $("#c" + clipData.clipId);
		if ($clip.length == 0)
			return;
		var $flag = $clip.find(".clipFlagWrapper");
		if ($flag.length > 0)
			$flag.remove();
	}
	this.ShowClipFlag = function (clipData)
	{
		if (lastOpenedClipEle && lastOpenedClipEle.clipData == clipData)
			$("#clipFlagButton").addClass("flagged");
		var $clip = $("#c" + clipData.clipId);
		if ($clip.length == 0)
			return;
		var $flag = $clip.find(".clipFlagWrapper");
		if ($flag.length == 0)
			$clip.append('<div class="clipFlagWrapper"><svg class="icon"><use xlink:href="#svg_x5F_Flag"></use></svg></div>');
	}
	this.RepairClipFlagState = function (clipData)
	{
		if (self.ClipDataIndicatesFlagged(clipData))
			self.ShowClipFlag(clipData);
		else
			self.HideClipFlag(clipData);
	}
	this.ClipDataIndicatesFlagged = function (clipData)
	{
		return (clipData.flags & 2) > 0;
	}
	this.Multi_Flag = function (allSelectedClipIDs, flagEnable, idx, myToast)
	{
		Multi_Operation("flag", allSelectedClipIDs, { flagEnable: flagEnable }, 0, null);
	}
	this.Multi_Delete = function (allSelectedClipIDs)
	{
		Multi_Operation("delete", allSelectedClipIDs, null, 0, null);
	}
	var Multi_Operation = function (operation, allSelectedClipIDs, args, idx, myToast)
	{
		if (!idx)
			idx = 0;

		if (idx == 0 && bulkOperationInProgress)
		{
			toaster.Warning("Another bulk operation is in progress.  Please wait for it to finish before starting another.", 10000);
			return;
		}

		if (idx >= allSelectedClipIDs.length)
		{
			Multi_Operation_Stop(operation, myToast, false);
			return;
		}

		bulkOperationInProgress = true;

		if (myToast)
		{
			var $root = $("#multi_" + operation + "_status_toast");
			if ($root.length > 0)
			{
				var $count = $root.find(".multi_operation_count");
				$count.text(idx + 1);
				var $wrap = $root.find(".multi_operation_status_wrapper");
				var $bar = $wrap.find(".multi_operation_status_bar");
				var progressPercent = idx / allSelectedClipIDs.length;
				$bar.css("width", (progressPercent * 100) + "%");
			}
		}
		else
		{
			myToast = toaster.Info('<div id="multi_' + operation + '_status_toast" class="multi_operation_status_toast">'
				+ '<div>' + (operation == "flag" ? "Flagging" : "Deleting") + ' ' + (currentPrimaryTab == "clips" ? "clip" : "alert") + ' <span class="multi_operation_count">' + (idx + 1) + '</span> / ' + allSelectedClipIDs.length + '</div>'
				+ '<div class="multi_operation_status_wrapper"><div class="multi_operation_status_bar"></div></div>'
				+ '</div>', 60000, true);
		}

		var clipData = self.GetClipFromId(allSelectedClipIDs[idx]);
		if (clipData)
		{
			if (operation == "flag")
			{
				var isFlagged = self.ClipDataIndicatesFlagged(clipData);
				if ((isFlagged && !args.flagEnable) || (!isFlagged && args.flagEnable))
				{
					self.ToggleClipFlag(clipData, function ()
					{
						Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast);
					}, function ()
						{
							Multi_Operation_Stop(operation, myToast, true);
						});
					return;
				}
			}
			else if (operation == "delete")
			{
				DeleteAlert(clipData.path, clipData.isClip, function ()
				{
					Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast);
				},
					function ()
					{
						Multi_Operation_Stop(operation, myToast, true);
					});
				return;
			}
		}
		else
		{
			Multi_Operation_Stop(operation, myToast, true);
			return;
		}
		setTimeout(function ()
		{
			Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast);
		}, 0);
	}
	var Multi_Operation_Stop = function (operation, myToast, endedEarly)
	{
		bulkOperationInProgress = false;
		if (myToast)
			myToast.remove();
		if (endedEarly)
		{
			toaster.Error("Bulk " + operation + " operation failed without completing.", 15000);
		}
		else
		{
			if (operation == "delete")
			{
				self.LoadClips();
			}
		}
	}
	this.GetCurrentClipEle = function ()
	{
		return lastOpenedClipEle;
	}
	// Next / Previous Clip Helpers
	var GetClipIdFromClip = function ($clip)
	{
		try
		{
			return $clip.attr('id').substr(1);
		}
		catch (ex)
		{
			return "";
		}
	}
	this.GetClipBelowClip = function ($clip)
	{
		var clipIdx = GetClipIndexFromClipId(GetClipIdFromClip($clip));
		if (clipIdx != -1 && clipIdx + 1 < loadedClipIds.length)
			return $("#c" + loadedClipIds[clipIdx + 1]);
		return null;
	}
	this.GetClipAboveClip = function ($clip)
	{
		var clipIdx = GetClipIndexFromClipId(GetClipIdFromClip($clip));
		if (clipIdx > 0 && clipIdx - 1 < loadedClipIds.length)
			return $("#c" + loadedClipIds[clipIdx - 1]);
		return null;
	}
	var GetClipIndexFromClipId = function (clipId)
	{
		if (loadedClipIds == null || loadedClipIds.length == 0)
			return -1;
		for (var i = 0; i < loadedClipIds.length; i++)
		{
			if (loadedClipIds[i] == clipId)
				return i;
		}
		return -1;
	}
	// End of Helpers
	var ClipList_Updated = function (response)
	{
		if ($clipsbody.scrollTop() > 30)
		{
			EndNewDataFlashing();
			$clipListTopDate.addClass("newData");
			var ele = $clipListTopDate.get(0);
			ele.defaultTitle = $clipListTopDate.attr("title");
			$clipListTopDate.attr("title", "Click to see new items at top");
			ele.flashInterval = setInterval(function ()
			{
				$clipListTopDate.toggleClass("newData");
			}, 1000);
		}
	}
	this.ScrollToTop = function ()
	{
		$clipsbody.scrollTop(0);
	}
	var ClipsBodyScroll = function ()
	{
		if ($clipsbody.scrollTop() < 30)
			EndNewDataFlashing();
	}
	var EndNewDataFlashing = function ()
	{
		var ele = $clipListTopDate.get(0);
		if (ele.flashInterval)
		{
			clearInterval(ele.flashInterval);
			ele.flashInterval = null;
			$clipListTopDate.removeClass("newData");
			$clipListTopDate.attr("title", ele.defaultTitle);
			$clipListTopDate.off('click', self.ScrollToTop);
		}
	}
	// Some things must be initialized after methods are defined ...
	lastUiSizeWasSmall = useSmallClipTileHeight();
	var tileLoader = new ClipListDynamicTileLoader(clipsBodySelector, DateTileOnBecomeCurrent);
	setInterval(self.UpdateClipList, 6000);
	BI_CustomEvent.AddListener("ClipList_Updated", ClipList_Updated);
	$clipsbody.on('scroll', ClipsBodyScroll);
}
///////////////////////////////////////////////////////////////
// Asynchronous Image Downloading /////////////////////////////
///////////////////////////////////////////////////////////////
function AsyncThumbnailDownloader()
{
	var asyncImageQueue = new Array();
	var stopImageQueue = false;
	var fallbackImg = 'ui3/noimage.png';
	var numThreads = 3; //Clamp(input, 1, 5);

	this.Stop = function ()
	{
		stopImageQueue = true;
		asyncImageQueue = new Array();
	}
	var AsyncDownloadQueuedImage = function ()
	{
		if (stopImageQueue || currentServer.isLoggingOut)
			return;
		var obj = popHighestPriorityImage();
		if (obj == null)
			setTimeout(AsyncDownloadQueuedImage, 250);
		else
		{
			var src = $(obj.img).attr('src');
			if (!src || src.length == 0 || src == "ui3/LoadingImage.png" || (src != obj.path && src != fallbackImg))
			{
				$(obj.img).bind("load.asyncimage", function ()
				{
					$(this).css("width", "auto");
					$(this).css("height", "auto");
					$(this).unbind("load.asyncimage");
					$(this).unbind("error.asyncimage");
					AsyncDownloadQueuedImage();
				});
				$(obj.img).bind("error.asyncimage", function ()
				{
					$(this).css("width", "auto");
					$(this).css("height", "auto");
					$(this).unbind("load.asyncimage");
					$(this).unbind("error.asyncimage");
					$(this).attr('src', fallbackImg);
					AsyncDownloadQueuedImage();
				});
				$(obj.img).attr('src', obj.path);
			}
			else // Image is already loaded
				AsyncDownloadQueuedImage();
		}
	}
	var popHighestPriorityImage = function ()
	{
		if (asyncImageQueue.length > 0)
		{
			var highest = asyncImageQueue[0];
			asyncImageQueue.splice(0, 1);
			return highest;
		}
		return null;
	}
	this.Enqueue = function (img, path)
	{
		var newObj = new Object();
		newObj.img = img;
		newObj.path = path;
		asyncImageQueue.push(newObj);
	}
	this.Dequeue = function (img)
	{
		for (var i = 0; i < asyncImageQueue.length; i++)
		{
			if (asyncImageQueue[i].img == img)
			{
				asyncImageQueue.splice(i, 1);
				return;
			}
		}
	}

	for (var i = 0; i < numThreads; i++)
		AsyncDownloadQueuedImage();
}
///////////////////////////////////////////////////////////////
// Appear / Disappear in clips body logic /////////////////////
///////////////////////////////////////////////////////////////
function ClipListDynamicTileLoader(clipsBodySelector, callbackCurrentDateFunc)
{
	var self = this;
	var $clipsbody = $(clipsBodySelector);
	var aboveAllowance = 500;
	var belowAllowance = 1000;
	var appearDisappearRegisteredObjects = new Array();
	var appearedObjects = new Array();
	var callbackCurrentDateFunc = callbackCurrentDateFunc;
	this.AppearDisappearCheckEnabled = true;
	var nextY = 0;
	var scrollToAtEnd = -1;

	this.appearDisappearCheck = function ()
	{
		if (!self.AppearDisappearCheckEnabled || appearDisappearRegisteredObjects.length == 0 || !$clipsbody.is(":visible"))
			return;
		var scrollTop = $clipsbody.scrollTop();
		var yMin = scrollTop - aboveAllowance;
		var yMax = scrollTop + $clipsbody.height() + belowAllowance;
		var yTopmostMin = scrollTop;
		for (var i = 0; i < appearedObjects.length; i++)
		{
			var obj = appearedObjects[i];
			if (obj.y < yMin || obj.y > yMax)
			{
				obj.isAppeared = false;
				if (obj.callbackOnDisappearFunc)
					obj.callbackOnDisappearFunc(obj);
				appearedObjects.splice(i, 1);
				i--;
			}
		}
		// The registered objects are sorted by Y coordinate, so we can quickly find the first item that should be visible.
		var idx = binarySearch(appearDisappearRegisteredObjects, yMin, compare_y_with_obj);
		if (idx < 0)
			idx = (-idx) - 1;
		var firstVisibleObjIdx = idx;
		for (var i = idx; i < appearDisappearRegisteredObjects.length; i++)
		{
			var obj = appearDisappearRegisteredObjects[i];
			if (obj.y >= yMin && obj.y <= yMax)
			{
				// obj is Visible (or nearly visible)
				if (!obj.isAppeared)
				{
					appearedObjects.push(obj);
					obj.isAppeared = true;
					if (obj.callbackOnAppearFunc)
						obj.callbackOnAppearFunc(obj);
				}
				if (obj.y >= yTopmostMin && firstVisibleObjIdx == idx)
					firstVisibleObjIdx = i;
			}
			else
				break;
		}
		var foundCurrentDate = false;
		for (var i = firstVisibleObjIdx; i >= 0; i--)
		{
			var obj = appearDisappearRegisteredObjects[i];
			if (obj.isDateTile)
				if (obj.y <= yTopmostMin)
				{
					foundCurrentDate = true;
					callbackCurrentDateFunc(obj);
					break;
				}
		}
		if (!foundCurrentDate)
			callbackCurrentDateFunc(null);
	}
	// This method was not needed and is not supported
	//this.unregisterOnAppearDisappear = function (obj)
	//{
	//	for (var i = 0; i < appearDisappearRegisteredObjects.length; i++)
	//	{
	//		if (appearDisappearRegisteredObjects[i] == obj)
	//		{
	//			appearDisappearRegisteredObjects.splice(i, 1);
	//			return;
	//		}
	//	}
	//}
	this.registerOnAppearDisappear = function (obj, callbackOnAppearFunc, callbackOnDisappearFunc, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx)
	{
		prepareClipDataForRegistration(obj, callbackOnAppearFunc, callbackOnDisappearFunc, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx);
		appearDisappearRegisteredObjects.push(obj);
	}
	var prepareClipDataForRegistration = function (obj, callbackOnAppearFunc, callbackOnDisappearFunc, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx)
	{
		obj.isAppeared = false;
		obj.isDateTile = obj.isDateTile;
		obj.y = nextY;
		obj.h = obj.isDateTile ? HeightOfOneDateTilePx : HeightOfOneClipTilePx;
		nextY += obj.h;
		obj.callbackOnAppearFunc = callbackOnAppearFunc;
		obj.callbackOnDisappearFunc = callbackOnDisappearFunc;
		obj.callbackOnMoveFunc = callbackOnMoveFunc;
	}
	this.unregisterAllOnAppearDisappear = function ()
	{
		nextY = 0;
		appearDisappearRegisteredObjects = new Array();
		appearedObjects = new Array();
	}
	this.injectNewClips = function (newClips, callbackOnAppearFunc, callbackOnDisappearFunc, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx)
	{
		for (var i = 0; i < newClips.length; i++)
			prepareClipDataForRegistration(newClips[i], callbackOnAppearFunc, callbackOnDisappearFunc, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx);
		appearDisappearRegisteredObjects = newClips.concat(appearDisappearRegisteredObjects);
	}
	this.resizeClipList = function (HeightOfOneClipTilePx, HeightOfOneDateTilePx)
	{
		nextY = 0;
		var scrollTop = $clipsbody.scrollTop();
		var topmostVisibleElement = null;
		for (var i = 0; i < appearDisappearRegisteredObjects.length; i++)
		{
			var obj = appearDisappearRegisteredObjects[i];
			var myHeight = obj.isDateTile ? HeightOfOneDateTilePx : HeightOfOneClipTilePx;
			if (scrollToAtEnd == -1 && obj.y + obj.h >= scrollTop)
			{
				var offset = (obj.y + obj.h) - scrollTop;
				var offsetPercent = 1 - (obj.h == 0 ? 0 : (offset / obj.h));
				scrollToAtEnd = nextY + (myHeight * offsetPercent);
			}
			obj.y = nextY;
			obj.h = myHeight;
			obj.callbackOnMoveFunc(obj);
			nextY += myHeight;
		}
		if (scrollToAtEnd > -1)
			$clipsbody.scrollTop(scrollToAtEnd);
		scrollToAtEnd = -1;
		self.appearDisappearCheck();
	}
	this.preserveScrollPosition = function (HeightOfOneClipTilePx, HeightOfOneDateTilePx, numNewClipTiles)
	{
		// Preserves the current scroll position plus the height of a number of new clip tiles, unless the current scroll position is near 0
		scrollToAtEnd = -1;
		var tmpY = 0;
		var scrollTop = $clipsbody.scrollTop();
		if (scrollTop <= 10)
			return;
		var topmostVisibleElement = null;
		for (var i = 0; i < appearDisappearRegisteredObjects.length; i++)
		{
			var obj = appearDisappearRegisteredObjects[i];
			var myHeight = obj.isDateTile ? HeightOfOneDateTilePx : HeightOfOneClipTilePx;
			if (scrollToAtEnd == -1 && obj.y + obj.h >= scrollTop)
			{
				var offset = (obj.y + obj.h) - scrollTop;
				var offsetPercent = 1 - (obj.h == 0 ? 0 : (offset / obj.h));
				scrollToAtEnd = tmpY + (myHeight * offsetPercent) + (numNewClipTiles * HeightOfOneClipTilePx);
				return;
			}
			tmpY += myHeight;
		}
	}
	var compare_y_with_obj = function (a, b)
	{
		return a - b.y;
	}
	$(window).resize(self.appearDisappearCheck);
	$clipsbody.scroll(self.appearDisappearCheck);
}
///////////////////////////////////////////////////////////////
// Status Update //////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function StatusLoader()
{
	var self = this;
	var updateDelay = 5000;
	var lastResponse = null;
	var currentProfileNames = null;
	var currentlySelectedSchedule = null;
	var globalScheduleEnabled = false;
	var profileChangedTimeout = null;
	var statusUpdateTimeout = null;
	var $profileBtns = $(".profilebtn");

	statusBars.addOnProgressChangedListener("cpu", function (cpu)
	{
		//if (cpu < 0.5)
		//	statusBars.setColor("cpu", "#default");
		//else
		if (cpu < 0.7)
			statusBars.setColor("cpu", "default"); // or "#00DDFF");
		else if (cpu < 0.8)
			statusBars.setColor("cpu", "#CCCC00");
		else if (cpu < 0.87)
			statusBars.setColor("cpu", "#CCAA00");
		else if (cpu < 0.95)
			statusBars.setColor("cpu", "#CC3300");
		else
			statusBars.setColor("cpu", "#CC0000");
	});
	statusBars.addOnProgressChangedListener("mem", function (mem)
	{
		if (mem < 0.95)
			statusBars.setColor("mem", "default");
		else
			statusBars.setColor("mem", "#CCAA00");
	});
	statusBars.addOnProgressChangedListener("fps", function (fps)
	{
		if (fps > 0.2)
			statusBars.setColor("fps", "default");
		else if (fps > 0.1)
			statusBars.setColor("fps", "#CCAA00");
		else if (fps > 0.05)
			statusBars.setColor("fps", "#CC3300");
		else
			statusBars.setColor("fps", "#CC0000");
	});

	this.LoadStatus = function ()
	{
		loadStatusInternal();
	}
	var loadStatusInternal = function (profileNum, stoplightState, schedule)
	{
		if (statusUpdateTimeout != null)
			clearTimeout(statusUpdateTimeout);
		var args = { cmd: "status" };
		if (typeof profileNum != "undefined" && profileNum != null)
		{
			if (sessionManager.IsAdministratorSession())
				args.profile = parseInt(profileNum);
			else
				openLoginDialog();
		}
		if (typeof stoplightState != "undefined" && stoplightState != null)
		{
			if (sessionManager.IsAdministratorSession())
				args.signal = parseInt(stoplightState);
			else
				openLoginDialog();
		}
		if (typeof schedule != "undefined" && schedule != null)
		{
			if (sessionManager.IsAdministratorSession())
				args.schedule = schedule;
			else
				openLoginDialog();
		}
		ExecJSON(args, function (response)
		{
			if (response && typeof response.result != "undefined" && response.result == "fail")
			{
				toaster.Warning('Your Blue Iris session may have expired.  This page will reload momentarily.', 10000);
				setTimeout(function ()
				{
					location.reload();
				}, 5000);
				return;
			}

			HandleChangesInStatus(lastResponse, response);
			lastResponse = response;
			if (response && response.data)
			{
				$("#stoplightBtn div").css("opacity", "");
				if (response.data.signal == "0")
					$("#stoplightRed").css("opacity", "1");
				else if (response.data.signal == "1")
					$("#stoplightGreen").css("opacity", "1");
				else if (response.data.signal == "2")
					$("#stoplightYellow").css("opacity", "1");

				var cpu = parseInt(response.data.cpu);
				statusBars.setProgress("cpu", cpu / 100.0, cpu + "%");
				statusBars.setTooltip("cpu", "Total CPU usage on server: " + cpu + "%");
				var mem = response.data.mem;
				var memFree = response.data.memfree;
				var memLoad = response.data.memload;
				var memLoadNum = parseFloat(memLoad) / 100;
				statusBars.setProgress("mem", memLoadNum, memLoad);
				statusBars.setTooltip("mem", "Total Computer Memory Usage: " + memLoad
					+ "\n\nBlue Iris: " + mem + "."
					+ "\nFree memory: " + memFree + ".");

				// Disk info example: "disks":[{ "disk":"V:", "allocated":1841152, "used":1563676, "free":343444, "total":1907599 }]
				// Values are in Mebibytes (MiB)
				if (response.data.disks)
				{
					var totalAvailable = 0;
					var totalUsed = 0;
					for (var i = 0; i < response.data.disks.length; i++)
					{
						var disk = response.data.disks[i];
						totalAvailable += disk.allocated;
						totalUsed += disk.used;
					}
					var diskPercent = totalAvailable == 0 ? 0 : totalUsed / totalAvailable;
					statusBars.setProgress("disk", diskPercent, parseInt(diskPercent * 100) + "%");
					statusBars.setTooltip("disk", "Click to visualize disk usage." + (response.data.clips ? "\n\n" + response.data.clips : ""));
				}
				else if (response.data.clips)
				{
					// Fall back to old format
					var match = new RegExp(", (.+)\/(.+);").exec(response.data.clips);
					if (match)
					{
						var used = getBytesFromBISizeStr(match[1]);
						var total = getBytesFromBISizeStr(match[2]);
						var diskPercent = total == 0 ? 0 : used / total;
						statusBars.setProgress("disk", diskPercent, parseInt(diskPercent * 100) + "%");
						statusBars.setTooltip("disk", response.data.clips);
					}
					else
					{
						statusBars.setProgress("disk", 0, "ERR");
						statusBars.setTooltip("disk", "Disk information was in an unexpected format: " + response.data.clips);
					}
				}

				UpdateProfileStatus();
				UpdateScheduleStatus();
			}
			loadingHelper.SetLoadedStatus("status");

			var nextStatusUpdateDelay = updateDelay;
			if (typeof args.schedule != "undefined")
				nextStatusUpdateDelay = 1000; // We just updated the schedule. Refresh again soon in case of profile change.
			if (statusUpdateTimeout != null)
				clearTimeout(statusUpdateTimeout);
			statusUpdateTimeout = setTimeout(function ()
			{
				self.LoadStatus();
			}, nextStatusUpdateDelay);
		}, function ()
			{
				if (statusUpdateTimeout != null)
					clearTimeout(statusUpdateTimeout);
				statusUpdateTimeout = setTimeout(function ()
				{
					self.LoadStatus();
				}, updateDelay);
			});
	}
	var HandleChangesInStatus = function (oldStatus, newStatus)
	{
		if (oldStatus && oldStatus.data && newStatus && newStatus.data)
		{
			if (oldStatus.data.profile != newStatus.data.profile)
				ProfileChanged();
		}
	}
	var ProfileChanged = function ()
	{
		// Refresh the clips and camera lists.
		// TODO: Update this message to show the old and new profile names, not a "Reinitializing shortly" message.
		toaster.Info("Your profile has changed.<br/>Reinitializing shortly...", 5000);
		if (profileChangedTimeout != null)
		{
			clearTimeout(profileChangedTimeout);
			profileChangedTimeout = null;
		}
		profileChangedTimeout = setTimeout(function ()
		{
			cameraListLoader.LoadCameraList();
		}, 5000);
	}
	var UpdateProfileStatus = function ()
	{
		if (lastResponse != null)
		{
			var selectedProfile = lastResponse.data.profile;
			var schedule = lastResponse.data.schedule;
			if (schedule == "")
				schedule = "N/A";
			var lock = lastResponse.data.lock;
			$profileBtns.removeClass("selected");
			$profileBtns.css("color", "");
			var $selectedProfileBtn = $('.profilebtn[profilenum="' + selectedProfile + '"]');
			$selectedProfileBtn.addClass("selected");
			$selectedProfileBtn.css("color", $selectedProfileBtn.attr("selColor"));
			if (lock == 0)
			{
				$("#schedule_lock_button").removeClass("hold");
				$("#schedule_lock_button").removeClass("temp");
				$("#schedule_lock_icon use").attr("href", "#svg_x5F_RunProfile");
				$("#schedule_lock_button").attr("title", 'Schedule "' + schedule + '" is active. Click to disable automatic scheduling.');
			}
			else if (lock == 1)
			{
				$("#schedule_lock_button").addClass("hold");
				$("#schedule_lock_button").removeClass("temp");
				$("#schedule_lock_icon use").attr("href", "#svg_x5F_HoldProfile");
				$("#schedule_lock_button").attr("title", 'Schedule "' + schedule + '" is currently disabled. Click to re-enable.');
			}
			else if (lock == 2)
			{
				$("#schedule_lock_button").removeClass("hold");
				$("#schedule_lock_button").addClass("temp");
				$("#schedule_lock_icon use").attr("href", "#svg_x5F_TempProfile");
				$("#schedule_lock_button").attr("title", 'Schedule "' + schedule + '" is temporarily overridden. Click to resume schedule, or wait some hours and it should return to normal.');
			}
			else
				toaster.Error("unexpected <b>lock</b> value from Blue Iris status");
		}
		if (currentProfileNames)
			for (var i = 0; i < 8; i++)
			{
				var tooltipText = currentProfileNames[i];
				if (i == 0 && tooltipText == "Inactive")
					tooltipText = "Inactive profile";
				$('.profilebtn[profilenum="' + i + '"]').attr("title", tooltipText);
			}
	}
	this.SetCurrentProfileNames = function (newProfileNames)
	{
		currentProfileNames = newProfileNames;
		UpdateProfileStatus();
	}
	var UpdateScheduleStatus = function ()
	{
		if (lastResponse == null)
			return;
		currentlySelectedSchedule = lastResponse.data.schedule;
		globalScheduleEnabled = currentlySelectedSchedule != "";
		if (!globalScheduleEnabled)
			currentlySelectedSchedule = "N/A";
		dropdownBoxes.listDefs["schedule"].rebuildItems();
		dropdownBoxes.setLabelText("schedule", currentlySelectedSchedule);
	}
	this.IsGlobalScheduleEnabled = function ()
	{
		return globalScheduleEnabled;
	}
	this.GetCurrentlySelectedScheduleName = function ()
	{
		return currentlySelectedSchedule;
	}
	this.ChangeSchedule = function (scheduleName)
	{
		loadStatusInternal(null, null, scheduleName);
	}
	this.SetProfileButtonsEnabled = function (enabled)
	{
		if (enabled)
			$("#schedule_lock_button,.profilebtn").removeClass("disabled");
		else
			$("#schedule_lock_button,.profilebtn").addClass("disabled");
	}
	this.SetStoplightButtonEnabled = function (enabled)
	{
		if (enabled)
			$("#stoplightBtn").removeClass("disabled");
		else
			$("#stoplightBtn").addClass("disabled");
	}
	$("#schedule_lock_button").click(function ()
	{
		if ($(this).hasClass("disabled"))
			return;
		loadStatusInternal(-1);
	});
	$(".profilebtn").click(function ()
	{
		if ($(this).hasClass("disabled"))
			return;
		loadStatusInternal($(this).attr("profilenum"));
	});
	$("#stoplightBtn").click(function ()
	{
		if ($(this).hasClass("disabled"))
			return;
		if (lastResponse == null)
			return;
		var newSignal = 0;
		if (lastResponse.data.signal != 0)
			newSignal = 0;
		else
			newSignal = 2;
		loadStatusInternal(null, newSignal);
	});
	this.diskUsageClick = function ()
	{
		if (lastResponse == null)
		{
			toaster.Error("Server status was not loaded!");
			return;
		}
		if (lastResponse.data && lastResponse.data.disks && lastResponse.data.disks.length > 0)
			diskUsageGUI.open(lastResponse.data.disks);
	};
}
///////////////////////////////////////////////////////////////
// Disk Usage GUI /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function DiskUsageGUI()
{
	var self = this;
	var exceededAllocationOccurred = false;
	var overAllocatedOccurred = false;
	var normalStateOccurred = false;
	this.open = function (disks)
	{
		exceededAllocationOccurred = overAllocatedOccurred = normalStateOccurred = false;
		var $dud = $('<div id="diskUsageDialog"><div class="title">Disk Usage</div></div>');
		$dud.append('<div class="diskUsageSeparator"></div>');
		var $legend = $('<div class="pieLegend"></div>');
		$dud.append($legend);
		for (var i = 0; i < disks.length; i++)
		{
			var disk = disks[i];
			$dud.append(GetDisk(disk));
		}
		//var fakeDisk =
		//	{
		//		disk: "Y:",
		//		allocated: 102400,
		//		used: 122880,
		//		free: 30720,
		//		total: 163840
		//	};
		//$dud.append(GetDisk(fakeDisk));
		//var fakeDisk2 =
		//	{
		//		disk: "Z:",
		//		allocated: 140,
		//		used: 100,
		//		free: 25,
		//		total: 150
		//	};
		//$dud.append(GetDisk(fakeDisk2));
		$legend.append(CreateLegendItem('#666666', 'Other files'));
		if (normalStateOccurred || overAllocatedOccurred)
		{
			$legend.append(CreateLegendItem('#0097F0', 'Used by recordings'));
			$legend.append(CreateLegendItem('#0065aa', 'Allocated free space'));
		}
		if (exceededAllocationOccurred)
		{
			$legend.append(CreateLegendItem('#FF9900', 'Allocated space (exceeded)'));
			$legend.append(CreateLegendItem('#FF0000', 'Recordings exceeding allocation'));
		}
		if (overAllocatedOccurred)
		{
			$legend.append(CreateLegendItem('#FF00FF', 'Overallocated space'));
		}
		$legend.append(CreateLegendItem('#66DD66', 'Unallocated free space'));
		$dud.modal({ removeElementOnClose: true });
	}
	var CreateLegendItem = function (color, label)
	{
		return $('<div class="pieLegendItem"><div class="pieLegendBox" style="background-color:' + color + ';"></div>' + label + '</div>');
	}
	var GetDisk = function (disk)
	{
		// Make sure we have numeric values for all of these, no strings.
		disk.allocated = parseInt(disk.allocated);
		disk.used = parseInt(disk.used);
		disk.free = parseInt(disk.free);
		disk.total = parseInt(disk.total);

		var bi_allocated = disk.allocated;
		var bi_used = disk.used;
		var disk_freeSpace = disk.free;
		var disk_capacity = disk.total;

		// Extrapolate complete disk usage information from the 4 values provided
		if (disk_capacity - disk.used - disk.free < -5)
			toaster.Warning("Reported disk info is invalid.  Possibly Blue Iris's clip database is corrupt and needs repaired.", 30000);
		if (disk_capacity - disk.used - disk.free < 0)
			disk_capacity = disk.used + disk.free;

		var disk_usedSpace = disk_capacity - disk_freeSpace; // Overall disk used space
		var other_used = disk_usedSpace - bi_used; // Space used by other files
		var other_free = disk_capacity - other_used - bi_used; // Free space outside BI's allocation
		var bi_free = bi_allocated - bi_used; // Remaining space in allocation.  This may be negative, or may be larger than actual free space.
		var exceededAllocation = bi_free < 0; // We have more recordings than we're supposed to
		var overAllocated = bi_free > disk_freeSpace;  // There isn't enough free space for BI to fill its allocation.

		var diskStatus;
		var problemExplanation = "";
		var chartData;
		if (exceededAllocation)
		{
			exceededAllocationOccurred = true;
			diskStatus = '<span class="diskStatusOverallocated">Exceeded allocation</span>';
			problemExplanation = "Blue Iris is currently keeping more recordings than allowed.";
			chartData =
				[
					[other_used, '#333333']
					, [bi_allocated, '#FF9900']
					, [-bi_free, '#FF0000'] // Amount over allocation
					, [other_free, '#66DD66']
				];
		}
		else if (overAllocated)
		{
			overAllocatedOccurred = true;
			diskStatus = '<span class="diskStatusOverallocated">Overallocated</span>';
			problemExplanation = "There is not enough free space on the disk for Blue Iris to fill its allocation.";
			var unavailableAllocatedSpace = bi_free - disk_freeSpace;
			chartData =
				[
					[other_used, '#333333']
					, [bi_used, '#0097F0']
					, [disk_freeSpace, '#0065aa'] // Unused available allocation
					, [bi_free - disk_freeSpace, '#FF00FF'] // Unused unavailable allocation
				];
		}
		else
		{
			normalStateOccurred = true;
			diskStatus = '<span class="diskStatusNormal">Normal</span>';
			chartData =
				[
					[other_used, '#333333']
					, [bi_used, '#0097F0']
					, [bi_free, '#0065aa']
					, [other_free, '#66DD66']
				];
		}

		var $disk = $('<div class="diskUsageDisk"></div>');
		$disk.append('<div class="diskName">' + disk.disk + ' ' + diskStatus + '</div>');
		$disk.append(GetPieChart(chartData));
		if (problemExplanation != "")
		{
			$disk.append('<div class="diskInfo">' + problemExplanation + '</div>');
			$disk.append('<div class="diskUsageSeparator"></div>');
		}

		var allocatedSpaceUsage = (bi_allocated == 0 ? 0 : parseInt((bi_used / bi_allocated) * 100)) + "%";
		var allocatedSpaceUsagePercentStr = (exceededAllocation ? '<span class="diskStatusOverallocated">' + allocatedSpaceUsage + '</span>' : allocatedSpaceUsage);

		$disk.append('<div class="diskInfo">Allocated: ' + formatBytes(getBytesFrom_MiB(bi_allocated)) + '</div>');
		$disk.append('<div class="diskInfo">Used: ' + formatBytes(getBytesFrom_MiB(bi_used)) + ' (' + allocatedSpaceUsagePercentStr + ')</div>');
		if (overAllocated)
			$disk.append('<div class="diskInfo">Overallocated by: ' + formatBytes(getBytesFrom_MiB(bi_free - disk_freeSpace)) + '</div>');

		$disk.attr('title', 'Disk "' + disk.disk + '" is ' + parseInt(disk_usedSpace / disk_capacity * 100) + '% full.'
			+ '\n\n' + formatBytes(getBytesFrom_MiB(disk_freeSpace)) + ' free of ' + formatBytes(getBytesFrom_MiB(disk_capacity)));

		return $disk;
	}
	var GetPieChart = function (data, sizePx)
	{
		if (sizePx)
			sizePx = parseInt(sizePx);
		else
			sizePx = 200;

		var $canvas = $('<canvas width="' + sizePx + '" height="' + sizePx + '" />');
		var canvas = $canvas.get(0);
		var ctx = canvas.getContext("2d");
		var lastend = 0;
		var myColor = ['#000099', '#0099FF', '#666666', '#222222']

		var myTotal = 0;
		for (var i = 0; i < data.length; i++)
			myTotal += data[i][0];

		for (var i = 0; i < data.length; i++)
		{
			ctx.fillStyle = data[i][1];
			ctx.beginPath();
			ctx.moveTo(canvas.width / 2, canvas.height / 2);
			ctx.arc(canvas.width / 2, canvas.height / 2, canvas.height / 2, lastend, lastend + (Math.PI * 2 * (data[i][0] / myTotal)), false);
			ctx.lineTo(canvas.width / 2, canvas.height / 2);
			ctx.fill();
			lastend += Math.PI * 2 * (data[i][0] / myTotal);
		}
		return $canvas;
	}
}
///////////////////////////////////////////////////////////////
// Session Manager ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function SessionManager()
{
	var self = this;
	var isAdministratorSession = false;
	var lastResponse = null;
	var latestAPISession = null;
	this.Initialize = function ()
	{
		// Called once during page initialization
		// First, check the current session status
		var oldSession = currentServer.isUsingRemoteServer ? "" : $.cookie("session");
		ExecJSON({ cmd: "login", session: oldSession }, function (response)
		{
			lastResponse = response;
			var errorInfo = "";
			if (response.result)
			{
				if (response.result == "success")
				{
					if (settings.bi_rememberMe == "1")
					{
						var user = Base64.decode(settings.bi_username);
						if (user != "")
						{
							var sessionUser = response && response.data && response.data.user ? response.data.user : "";
							if (user.toLowerCase() != sessionUser.toLowerCase())
							{
								var pass = Base64.decode(settings.bi_password);
								LoginWithCredentials(user, pass, function (failResponse, errorMessage)
								{
									// The login failed
									toaster.Error(errorMessage, 3000);
									self.HandleSuccessfulLogin(response, true); // Session is valid
								});
								return;
							}
						}
					}
					self.HandleSuccessfulLogin(response, true);
				}
				else if (response.result == "fail")
				{
					if (response.data)
					{
						if (response.data.reason == "missing response")
						{
							// The { cmd: "login", session: oldSession } method of learning session status always seemed a little hacky.  If this error ever arises, it means Blue Iris has broken this method and we need a replacement.
							loadingHelper.SetErrorStatus("login", 'Blue Iris sent an authentication challenge instead of session data (probably indicates a Blue Iris bug).');
							return;
						}
						else
							errorInfo = JSON.stringify(response);
					}
					else
					{
						loadingHelper.SetErrorStatus("login", 'The current session is invalid or expired.  Reloading this page momentarily.');
						setTimeout(function () { location.reload(); }, 5000);
						return;
					}
				}
				else
				{
					errorInfo = JSON.stringify(response);
					loadingHelper.SetErrorStatus("login", 'Unrecognized response when getting session status. ' + errorInfo);
				}
			}
		}, function ()
			{
				loadingHelper.SetErrorStatus("login", 'Unable to contact Blue Iris server to check session status.');
			});

		//if (settings.bi_rememberMe == "1")
		//{
		//	var user = Base64.decode(settings.bi_username);
		//	var pass = Base64.decode(settings.bi_password);

		//	if (user != "" || pass != "")
		//	{
		//		LoginWithCredentials(user, pass, function (response, errorMessage)
		//		{
		//			// The login failed
		//			toaster.Error(errorMessage, 3000);
		//			Init_LearnSessionStatus();
		//		});
		//	}
		//	else
		//		Init_LearnSessionStatus();
		//}
		//else
		//	Init_LearnSessionStatus();
	}
	var LoginWithCredentials = function (user, pass, onFail)
	{
		var oldSession = currentServer.isUsingRemoteServer ? "" : $.cookie("session");
		var args = { cmd: "login" };
		ExecJSON(args, function (response)
		{
			// We expect a result of "fail" and data.reason of "missing response"
			if (response && response.result == "fail" && response.data && response.data.reason == "missing response")
			{
				// We need to log in
				args.session = response.session;
				args.response = md5(user + ":" + response.session + ":" + pass);
				ExecJSON(args, function (response)
				{
					lastResponse = response;
					if (response.result && response.result == "success")
					{
						self.HandleSuccessfulLogin(response);
						//setTimeout(function () { logoutOldSession(oldSession); }, 1000);
					}
					else
						onFail(response, 'Failed to log in. ' + GetFailReason(response));
				}, function ()
					{
						onFail(null, "Unable to contact server.");
					});
			}
			else
				onFail(response, 'Failed to log in. ' + GetFailReason(response));
		}, function ()
			{
				onFail(null, "Unable to contact server.");
			});
	}
	var GetFailReason = function (response)
	{
		if (response)
			return response.data && response.data.reason ? " " + response.data.reason : JSON.stringify(response);
		else
			return "null response";
	}
	this.HandleSuccessfulLogin = function (response, wasJustCheckingSessionStatus)
	{
		lastResponse = response;
		var user = response && response.data && response.data.user ? response.data.user : "";
		loadingHelper.SetLoadedStatus("login");
		latestAPISession = lastResponse.session;
		self.ApplyLatestAPISessionIfNecessary();

		$("#systemname").text(lastResponse.data["system name"]);
		if (lastResponse.data.admin)
		{
			isAdministratorSession = true;
			if (user == "")
				user = "administrator";
			toaster.Success("Logged in as " + htmlEncode(user) + "<br/>(Administrator)<br/><br/>Server \"" + lastResponse.data["system name"] + "\"<br/>Blue Iris version " + lastResponse.data.version);
			closeLoginDialog();
		}
		else
		{
			isAdministratorSession = false;
			if (user == "")
				user = "user";
			if (!wasJustCheckingSessionStatus)
				toaster.Info("Logged in as " + htmlEncode(user) + "<br/>(Limited User)<br/><br/>Server \"" + lastResponse.data["system name"] + "\"<br/>Blue Iris version " + lastResponse.data.version);
		}
		if (lastResponse.data && lastResponse.data.profiles && lastResponse.data.profiles.length == 8)
			statusLoader.SetCurrentProfileNames(lastResponse.data.profiles);
		if (lastResponse && lastResponse.data && lastResponse.data.schedules)
			dropdownBoxes.listDefs["schedule"].rebuildItems();

		statusLoader.LoadStatus();
		cameraListLoader.LoadCameraList();
	}
	this.ApplyLatestAPISessionIfNecessary = function ()
	{
		if (latestAPISession == null)
			return;
		if ($.cookie("session") != latestAPISession)
		{
			// If this happens a lot, usually the cause is another window with a web UI open that has a different latestAPISession value
			bilog.verbose("APISession Changing session from " + $.cookie("session") + " to " + latestAPISession);
			$.cookie("session", latestAPISession, { path: "/" });
		}
	}

	this.AdminLoginRememberMeChanged = function ()
	{
		if ($("#cbRememberMe").is(":checked"))
		{
			settings.bi_rememberMe = "1";
			settings.bi_username = Base64.encode($('#loginDialog input[type="text"][varname="user"]').val());
			settings.bi_password = Base64.encode($('#loginDialog input[type="password"][varname="pass"]').val());
		}
		else
		{
			settings.bi_rememberMe = "0";
			settings.bi_username = "";
			settings.bi_password = "";
		}
	}
	this.DoAdministratorDialogLogin = function ()
	{
		self.AdminLoginRememberMeChanged();
		LoginWithCredentials($('#loginDialog input[type="text"][varname="user"]').val(), $('#loginDialog input[type="password"][varname="pass"]').val(),
			function (response, errorMessage)
			{
				// The login failed
				toaster.Error(errorMessage, 3000);
			});
	}
	this.PwKeypress = function (ele, e)
	{
		var keycode;
		if (window.event) keycode = window.event.keyCode;
		else if (typeof e != "undefined" && e) keycode = e.which;
		else return true;

		if (keycode == 13)
		{
			self.DoAdministratorDialogLogin();
			return false;
		}
		else
			return true;
	}
	this.IsAdministratorSession = function ()
	{
		return isAdministratorSession;
	}
	this.GetSchedulesArray = function ()
	{
		if (lastResponse && lastResponse.data)
			return lastResponse.data.schedules;
		return null;
	}
}
///////////////////////////////////////////////////////////////
// Camera List ////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function CameraListLoader()
{
	var self = this;
	var lastResponse = null;
	var cameraIdToCameraMap = new Object();
	var firstCameraListLoaded = false;
	var hasOnlyOneCamera = false;
	var cameraListUpdateTimeout = null;
	this.LoadCameraList = function (successCallbackFunc)
	{
		if (cameraListUpdateTimeout != null)
			clearTimeout(cameraListUpdateTimeout);
		ExecJSON({ cmd: "camlist" }, function (response)
		{
			if (typeof (response.data) == "undefined" || response.data.length == 0)
			{
				if (firstCameraListLoaded)
					toaster.Error("Camera list is empty!");
				else
				{
					lastResponse = response;
					loadingHelper.SetErrorStatus("cameraList", "Camera list is empty! Try reloading the page.");
				}
				return;
			}
			lastResponse = response;
			dropdownBoxes.listDefs["currentGroup"].rebuildItems(lastResponse.data);
			var containsGroup = false;
			for (var i = 0; i < lastResponse.data.length; i++)
			{
				if (lastResponse.data[i].group)
				{
					containsGroup = true;
					break;
				}
			}
			hasOnlyOneCamera = !containsGroup;
			if (!containsGroup)
			{
				// No group was found, so we will add one.
				var newDataArray = new Array();
				newDataArray.push(GetFakeIndexCameraData());
				for (var i = 0; i < lastResponse.data.length; i++)
					newDataArray.push(lastResponse.data[i]);
				lastResponse.data = newDataArray;
			}
			cameraIdToCameraMap = new Object();
			for (var i = 0; i < lastResponse.data.length; i++)
				cameraIdToCameraMap[lastResponse.data[i].optionValue] = lastResponse.data[i];
			if (!firstCameraListLoaded || self.GetCameraWithId(videoPlayer.Loading().image.id) == null)
			{
				if (self.GetGroupCamera(settings.ui3_defaultCameraGroupId) == null)
					videoPlayer.SelectCameraGroup(lastResponse.data[0].optionValue);
				else
					videoPlayer.SelectCameraGroup(settings.ui3_defaultCameraGroupId);
			}
			if (!firstCameraListLoaded)
			{
				loadingHelper.SetLoadedStatus("cameraList");
				firstCameraListLoaded = true;
			}
			try
			{
				if (successCallbackFunc)
					successCallbackFunc(lastResponse);
			}
			catch (ex)
			{
				toaster.Error(ex, 30000);
			}

			BI_CustomEvent.Invoke("CameraListLoaded", lastResponse);

			if (cameraListUpdateTimeout != null)
				clearTimeout(cameraListUpdateTimeout);
			cameraListUpdateTimeout = setTimeout(function ()
			{
				self.LoadCameraList();
			}, 5000);
		}, function ()
			{
				if (cameraListUpdateTimeout != null)
					clearTimeout(cameraListUpdateTimeout);
				setTimeout(function ()
				{
					self.LoadCameraList(successCallbackFunc);
				}, 1000);
			});
	}
	var GetFakeIndexCameraData = function ()
	{
		var camName;
		var camWidth;
		var camHeight;
		var ptz;

		for (var i = 0; i < lastResponse.data.length; i++)
		{
			var cameraObj = lastResponse.data[i];
			if (!self.CameraIsGroupOrCycle(cameraObj) && cameraObj.isEnabled)
			{
				camName = cameraObj.optionValue;
				camWidth = cameraObj.width;
				camHeight = cameraObj.height;
				ptz = cameraObj.ptz;
				break;
			}
		}

		return {
			optionDisplay: "+All cameras"
			, optionValue: camName
			, isMotion: false
			, isTriggered: false
			, xsize: 1
			, ysize: 1
			, width: camWidth
			, height: camHeight
			, ptz: ptz
			, group: []
			, rects: []
		};
	}
	this.GetCameraBoundsInCurrentGroupImageScaled = function (cameraId, groupId)
	{
		var coordScale = videoPlayer.Loaded().image.actualwidth / videoPlayer.Loaded().image.fullwidth;
		var unscaled = self.GetCameraBoundsInCurrentGroupImageUnscaled(cameraId, groupId);
		// The first line of the array definition must be on the same line as the return statement
		return [Math.round(unscaled[0] * coordScale)
			, Math.round(unscaled[1] * coordScale)
			, Math.round(unscaled[2] * coordScale)
			, Math.round(unscaled[3] * coordScale)];
	}
	this.GetCameraBoundsInCurrentGroupImageUnscaled = function (cameraId, groupId)
	{
		var camData = videoPlayer.Loaded().cam;
		if (camData)
		{
			if (!camData.group)
			{
				if (groupId && lastResponse && lastResponse.data)
				{
					for (var i = 0; i < lastResponse.data.length; i++)
					{
						if (lastResponse.data[i].group && lastResponse.data[i].optionValue == groupId)
						{
							camData = lastResponse.data[i];
							break;
						}
					}
				}
				if (!camData.group)
					return null;
			}
			for (var j = 0; j < camData.rects.length; j++)
			{
				if (camData.group[j] == cameraId)
				{
					return camData.rects[j];
				}
			}
		}
		return null;
	}
	this.GetCameraWithId = function (cameraId)
	{
		return cameraIdToCameraMap[cameraId];
	}
	this.GetCameraName = function (cameraId)
	{
		var cam = cameraIdToCameraMap[cameraId];
		if (cam)
		{
			if (self.CameraIsGroupOrCycle(cam))
				return CleanUpGroupName(cam.optionDisplay);
			return cam.optionDisplay;
		}
		return cameraId;
	}
	this.GetGroupCamera = function (groupId)
	{
		if (lastResponse && lastResponse.data)
		{
			for (var i = 0; i < lastResponse.data.length; i++)
			{
				if (self.CameraIsGroupOrCycle(lastResponse.data[i]))
				{
					if (lastResponse.data[i].optionValue == groupId)
					{
						return lastResponse.data[i];
					}
				}
			}
		}
		return null;
	}
	this.CameraIsGroup = function (cameraObj)
	{
		return cameraObj.group;
	}
	this.CameraIsGroupOrCycle = function (cameraObj)
	{
		return cameraObj.group || cameraObj.optionValue.startsWith("@");
	}
	this.CameraIsCycle = function (cameraObj)
	{
		return cameraObj.optionValue.startsWith("@");
	}
	this.CameraIsGroupOrCamera = function (cameraObj)
	{
		return cameraObj.group || !cameraObj.optionValue.startsWith("@");
	}
	this.HasOnlyOneCamera = function ()
	{
		return hasOnlyOneCamera;
	}
	this.GetLastResponse = function ()
	{
		return lastResponse;
	}
}
///////////////////////////////////////////////////////////////
// Video Player Controller ////////////////////////////////////
///////////////////////////////////////////////////////////////
function VideoPlayerController()
{
	/*
	This object is intended to be a high level interface for video playback and related operations (such as video surface click handling).
	*/
	var self = this;
	var isInitialized = false;

	var ajaxHistoryManager = new AjaxHistoryManager();

	var playerModule = null;
	var moduleHolder = {};
	this.useH264ForLiveView_TempVar = false; // TODO: Remove this variable once H.264 is available for clips.

	var currentlyLoadingCamera = null;
	var currentlyLoadedCamera = null;
	var currentlyLoadingImage = new BICameraData();
	var currentlyLoadedImage = new BICameraData();

	var lastLiveCameraOrGroupId = "";
	var currentlySelectedHomeGroupId = null;

	var viewChangeMode = 4;

	this.CurrentPlayerModuleName = function ()
	{
		if (playerModule == moduleHolder["jpeg"])
			return "jpeg";
		else if (playerModule == moduleHolder["h264"])
			return "h264";
		return "unknown";
	}
	this.SetPlayerModule = function (moduleName, refreshVideoNow)
	{
		if (playerModule != null && playerModule != moduleHolder[moduleName])
			playerModule.Deactivate();

		if (moduleName == "jpeg")
		{
			if (moduleHolder[moduleName] == null)
				moduleHolder[moduleName] = new JpegVideoModule();
			playerModule = moduleHolder[moduleName];
		}
		else if (moduleName == "h264")
		{
			if (moduleHolder[moduleName] == null)
			{
				toaster.Info("Loading experimental raw H.264 live video player");
				moduleHolder[moduleName] = new FetchPNaClH264VideoModule();
			}
			playerModule = moduleHolder[moduleName];
		}
		if (refreshVideoNow)
			playerModule.OpenVideo();
	}

	this.Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;

		imageRenderer.RegisterCamImgClickHandler();
		self.SetPlayerModule("jpeg");
		playerModule.OpenVideo();

		var visProp = getHiddenProp();
		if (visProp)
		{
			var evtname = visProp.replace(/[H|h]idden/, '') + 'visibilitychange';
			document.addEventListener(evtname, function ()
			{
				// Called when page visibility changes.
				playerModule.VisibilityChanged(!documentIsHidden());
			});
		}
	}

	// Methods for querying what is currently playing
	this.Loading = function ()
	{
		return { cam: currentlyLoadingCamera, image: currentlyLoadingImage };
	}
	this.Loaded = function ()
	{
		return { cam: currentlyLoadedCamera, image: currentlyLoadedImage };
	}
	this.GetCurrentHomeGroupObj = function ()
	{
		return cameraListLoader.GetGroupCamera(currentlySelectedHomeGroupId);
	}
	this.GetClipPlaybackPositionMs = function ()
	{
		if (currentlyLoadingImage.isLive)
			return 0;
		return playerModule.GetSeekMs();
	}
	this.IsFrameVisible = function ()
	{
		if (playerModule)
			return playerModule.LoadedFrameSinceActivate();
		return false;
	}
	this.GetLastSnapshotUrl = function ()
	{
		return playerModule.GetLastSnapshotUrl();
	}
	this.GetLastSnapshotFullUrl = function ()
	{
		return playerModule.GetLastSnapshotFullUrl();
	}
	this.GetStaticSnapshotId = function ()
	{
		return playerModule.GetStaticSnapshotId();
	}
	this.Playback_IsPaused = function ()
	{
		return playerModule.Playback_IsPaused();
	}
	this.GetCurrentImageTimeMs = function ()
	{
		return playerModule.GetCurrentImageTimeMs();
	}

	// Methods dealing with mouse clicks.
	// TODO: Make ImgClick, ImgClick_Camera private
	this.SetViewChangeMode = function (mode)
	{
		viewChangeMode = mode;
	}
	this.GetCameraUnderMousePointer = function (event)
	{
		// Find out which camera is under the mouse pointer, if any.
		imageRenderer.SetMousePos(event.pageX, event.pageY);

		var imgPos = $("#camimg_wrapper").position();
		var layoutbodyOffset = $("#layoutbody").offset();
		var mouseRelX = parseFloat((event.pageX - layoutbodyOffset.left) - imgPos.left) / imageRenderer.GetPreviousImageDrawInfo().w;
		var mouseRelY = parseFloat((event.pageY - layoutbodyOffset.top) - imgPos.top) / imageRenderer.GetPreviousImageDrawInfo().h;

		var x = currentlyLoadedImage.fullwidth * mouseRelX;
		var y = currentlyLoadedImage.fullheight * mouseRelY;
		var camData = currentlyLoadedCamera;
		if (camData)
		{
			if (camData.group)
			{
				for (var j = 0; j < camData.rects.length; j++)
				{
					if (x > camData.rects[j][0] && y > camData.rects[j][1] && x < camData.rects[j][2] && y < camData.rects[j][3])
						return cameraListLoader.GetCameraWithId(camData.group[j]);
				}
			}
			else
				return camData;
		}
		return null;
	}
	this.ImgClick = function (event)
	{
		if (!currentlyLoadingImage.isLive)
			return;
		// mouseCoordFixer.fix(event); // Don't call this more than once per event!
		var camData = self.GetCameraUnderMousePointer(event);
		if (camData != null && !cameraListLoader.HasOnlyOneCamera() && !cameraListLoader.CameraIsCycle(camData))
		{
			self.ImgClick_Camera(camData);
		}
	}
	this.ImgClick_Camera = function (camData)
	{
		var fadeIn = viewChangeMode == 2 || viewChangeMode == 4 || viewChangeMode == 5;
		var scaleIn = viewChangeMode == 1 || viewChangeMode == 3 || viewChangeMode == 4 || viewChangeMode == 5;
		var fadeOut = viewChangeMode == 2 || viewChangeMode == 3 || viewChangeMode == 4 || viewChangeMode == 5;
		var scaleOut = viewChangeMode == 1 || viewChangeMode == 5;
		if (camData.optionValue == currentlyLoadedImage.id)
		{
			// Back to Group
			camData = cameraListLoader.GetGroupCamera(currentlySelectedHomeGroupId);
			if (scaleOut && playerModule.DrawCameraFullCameraAsThumb)
				playerModule.DrawCameraFullCameraAsThumb(currentlyLoadedImage.id, camData.optionValue);
			if (fadeOut)
				imageRenderer.SetFrameOpacity(0.5);
			self.LoadLiveCamera(camData);
			if (scaleOut && playerModule.DrawCameraFullCameraAsThumb)
				self.CameraOrResolutionChange(); // TODO: Verify this is working correctly here
		}
		else
		{
			// Maximize
			if (scaleIn && playerModule.DrawCameraThumbAsFullCamera)
				playerModule.DrawCameraThumbAsFullCamera(camData.optionValue);
			if (fadeIn)
				imageRenderer.SetFrameOpacity(0.5);
			self.LoadLiveCamera(camData);
			if (scaleIn && playerModule.DrawCameraThumbAsFullCamera)
				self.CameraOrResolutionChange(); // TODO: Verify this is working correctly here
		}
	}

	// Methods for changing what the player is playing
	this.goLive = function ()
	{
		if (currentlyLoadingImage == null || currentlyLoadingImage.isLive)
			return;
		var camData = cameraListLoader.GetCameraWithId(lastLiveCameraOrGroupId);
		if (camData)
		{
			clipLoader.suppressClipListLoad = true;
			self.LoadLiveCamera(camData);
			clipLoader.suppressClipListLoad = false;
		}
		else
		{
			self.LoadHomeGroup();
		}
	}
	this.isLive = function ()
	{
		return currentlyLoadingImage != null && currentlyLoadingImage.isLive;
	}
	this.LoadHomeGroup = function (groupId)
	{
		if (typeof groupId == "undefined")
			groupId = currentlySelectedHomeGroupId;
		self.LoadLiveCamera(cameraListLoader.GetGroupCamera(groupId));
	}
	this.SelectCameraGroup = function (groupId)
	{
		dropdownBoxes.setLabelText("currentGroup", "...");
		var camList = cameraListLoader.GetLastResponse();
		for (var i = 0; i < camList.data.length; i++)
		{
			if (camList.data[i].optionValue == groupId)
			{
				if (cameraListLoader.CameraIsGroupOrCycle(camList.data[i]))
				{
					settings.ui3_defaultCameraGroupId = currentlySelectedHomeGroupId = groupId;

					self.LoadLiveCamera(camList.data[i]);
					break;
				}
			}
		}
	}
	this.LoadLiveCamera = function (camData)
	{
		imageRenderer.SetDigitalZoom(0);
		var cli = currentlyLoadingImage;
		var clc = currentlyLoadingCamera = camData;
		cli.id = clc.optionValue;
		cli.maxwidth = cli.fullwidth = cli.actualwidth = clc.width;
		cli.maxheight = cli.fullheight = cli.actualheight = clc.height;
		cli.aspectratio = clc.width / clc.height;
		cli.path = clc.optionValue;
		cli.isLive = true;
		cli.ptz = clc.ptz;
		cli.audio = clc.audio;
		cli.msec = -1;
		cli.isGroup = clc.group ? true : false;

		lastLiveCameraOrGroupId = clc.optionValue;

		audioPlayer.audioPlay();

		playbackControls.Hide();
		ptzButtons.UpdatePtzControlDisplayState();
		dropdownBoxes.setLabelText("currentGroup", CleanUpGroupName(clc.optionDisplay));

		if (skipTabLoadClipLoad)
			skipTabLoadClipLoad = false;
		else
			clipLoader.LoadClips(); // This method does nothing if not on the clips/alerts tabs.

		if (playerModule)
		{
			if (self.useH264ForLiveView_TempVar)
				self.SetPlayerModule("h264");
			playerModule.OpenVideo();
		}

		fullScreenModeController.updateFullScreenButtonState();
	}
	this.LoadClip = function (clipData)
	{
		var cam = cameraListLoader.GetCameraWithId(clipData.camera);
		if (cam)
		{
			imageRenderer.SetDigitalZoom(0);
			var cli = currentlyLoadingImage;
			var clc = currentlyLoadingCamera = cam;
			cli.id = clc.optionValue;
			cli.maxwidth = cli.fullwidth = cli.actualwidth = clc.width;
			cli.maxheight = cli.fullheight = cli.actualheight = clc.height;
			cli.aspectratio = clc.width / clc.height;
			cli.path = clipData.path;
			cli.isLive = false;
			cli.ptz = false;
			cli.audio = false;
			cli.msec = parseInt(clipData.msec);
			cli.isGroup = false;

			audioPlayer.audioStop();

			playbackHeader.SetClipName(clipData);
			playbackControls.Show();
			playbackControls.SetDownloadClipLink(clipData);
			if (clipLoader.ClipDataIndicatesFlagged(clipData))
				$("#clipFlagButton").addClass("flagged");
			else
				$("#clipFlagButton").removeClass("flagged");
			seekBar.drawSeekbarAtTime(0);
			seekBar.resetSeekHintImg();

			if (playerModule)
			{
				if (self.useH264ForLiveView_TempVar)
					self.SetPlayerModule("jpeg");
				playerModule.OpenVideo();
			}
		}
		else
			toaster.Error("Could not find camera " + htmlEncode(clipData.camera) + " associated with clip.");

		fullScreenModeController.updateFullScreenButtonState();
	}

	this.SeekToMs = function (pos)
	{
		playerModule.SeekToMs(pos);
	}
	this.SeekByMs = function (offset)
	{
		var newPos = playerModule.GetSeekMs() + offset;
		if (newPos < 0)
			newPos = 0;
		if (newPos > currentlyLoadingImage.msec - 1)
			newPos = currentlyLoadingImage.msec - 1;
		playerModule.SeekToMs(newPos);
	}
	this.Playback_Pause = function ()
	{
		playerModule.Playback_Pause();
	}
	this.Playback_Play = function ()
	{
		playerModule.Playback_Play();
	}
	this.Playback_PlayPause = function ()
	{
		playerModule.Playback_PlayPause();
	}
	this.Playback_NextClip = function ()
	{
		// TODO: Hotkey this to down arrow
		var clip = clipLoader.GetCurrentClipEle();
		if (clip != null && clipLoader.GetAllSelected().length <= 1)
		{
			if (clipLoader.GetAllSelected().length == 0 || clipLoader.IsClipSelected(clip.id.substr(1)))
			{
				var $clip = clipLoader.GetClipAboveClip($(clip));
				if (Playback_ClipObj($clip))
					return;
			}
		}
		self.Playback_Pause();
	}
	this.Playback_PreviousClip = function ()
	{
		// TODO: Hotkey this to up arrow
		var clip = clipLoader.GetCurrentClipEle();
		if (clip != null && clipLoader.GetAllSelected().length <= 1)
		{
			if (clipLoader.GetAllSelected().length == 0 || clipLoader.IsClipSelected(clip.id.substr(1)))
			{
				var $clip = clipLoader.GetClipBelowClip($(clip));
				if (Playback_ClipObj($clip))
					return;
			}
		}
		self.Playback_Pause();
	}
	var Playback_ClipObj = function ($clip)
	{
		if ($clip != null && $clip.length > 0)
		{
			clipLoader.ScrollToClipObj($clip);
			$clip.click();
			return true;
		}
		return false;
	}

	// Callback methods for a player module to inform the VideoPlayerController of state changes.
	this.CameraOrResolutionChange = function ()
	{
		imageRenderer.SetDigitalZoom(0);
		currentlyLoadedImage.CopyValuesFrom(currentlyLoadingImage);
		currentlyLoadedCamera = currentlyLoadingCamera;
		resized();
	}
	this.ImageRendered = function (imgRequestMs)
	{
		RefreshFps(imgRequestMs);
		if (!currentlyLoadedImage.isLive)
			seekBar.drawSeekbarAtTime(playerModule.GetSeekMs());
		imageRenderer.SetFrameOpacity_Default();
	}
	this.Playback_Ended = function (isLeftBoundary)
	{
		// The module may call this repeatedly 
		if (isLeftBoundary)
		{
			if (playbackControls.GetPlayReverse())
			{
				if (playbackControls.GetLoopingEnabled())
					playerModule.SeekToMs(currentlyLoadingImage.msec - 1);
				else if (playbackControls.GetAutoplay())
					self.Playback_PreviousClip();
				else
					self.Playback_Pause();
			}
		}
		else
		{
			if (!playbackControls.GetPlayReverse())
			{
				if (playbackControls.GetLoopingEnabled())
					playerModule.SeekToMs(0);
				else if (playbackControls.GetAutoplay())
					self.Playback_NextClip();
				else
					self.Playback_Pause();
			}
		}
	}
	var fpsZeroTimeout = null;
	var RefreshFps = function (imgRequestMs)
	{
		var currentFps = fpsCounter.getFPS(new Date().getTime() - imgRequestMs);
		statusBars.setProgress("fps", (currentFps / 10), currentFps);

		// This allows the FPS to change to 0 if connectivity is lost or greatly reduced
		if (fpsZeroTimeout != null)
			clearTimeout(fpsZeroTimeout);
		fpsZeroTimeout = setTimeout(ZeroFps, 4000);
	}
	var ZeroFps = function ()
	{
		statusBars.setProgress("fps", 0, 0);
	}
}
function BICameraData()
{
	var self = this;
	this.id = "";
	this.fullwidth = 1280; // Native resolution of image; used when calculating with group rects
	this.fullheight = 720;
	this.aspectratio = 1280 / 720;
	this.maxwidth = 1280; // Max image size available from Blue Iris; used as a base for digital zoom
	this.maxheight = 720;
	this.actualwidth = 1280; // Actual size of image (when streaming jpeg, this is smaller than maxwidth)
	this.actualheight = 720;
	this.path = "";
	this.isLive = true;
	this.ptz = false;
	this.msec = 10000; // Millisecond duration of clips/alerts.  Ignore this if isLive is set.
	this.isGroup = false;

	this.CopyValuesFrom = function (other)
	{
		self.id = other.id;
		self.fullwidth = other.fullwidth;
		self.fullheight = other.fullheight;
		self.aspectratio = other.aspectratio;
		self.maxwidth = other.maxwidth;
		self.maxheight = other.maxheight;
		self.actualwidth = other.actualwidth;
		self.actualheight = other.actualheight;
		self.path = other.path;
		self.isLive = other.isLive;
		self.ptz = other.ptz;
		self.msec = other.msec;
		self.isGroup = other.isGroup;
	}
}
///////////////////////////////////////////////////////////////
// Jpeg Video Module //////////////////////////////////////////
///////////////////////////////////////////////////////////////
function JpegVideoModule()
{
	/*
	A low level video player module which refreshes jpeg images using http.
	*/
	var self = this;
	var isInitialized = false;
	var isCurrentlyActive = false;
	var timeLastClipFrame = 0;
	var repeatedSameImageURLs = 1;
	var loadedFirstFrame = false;
	var lastCycleWidth = 0;
	var lastCycleHeight = 0;
	var lastRequestedWidth = 0;
	var currentLoadedImageActualWidth = 1;

	var currentImageTimestampMs = new Date().getTime();
	var currentImageRequestedAtMs = new Date().getTime();
	var staticSnapshotId = "";
	var lastSnapshotUrl = "";
	var lastSnapshotFullUrl = "";

	var playbackPaused = false;

	var isVisible = !documentIsHidden();

	var clipPlaybackPosition = 0;

	var Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;
		// Do one-time initialization here

		$("#camimg_store").append('<canvas id="camimg_canvas"></canvas>');
		$("#camimg_store").append('<img crossOrigin="Anonymous" id="camimg" src="" alt="" style="display: none;" />');
		$("#camimg_store").append('<canvas id="backbuffer_canvas" style="display: none;"></canvas>');

		imageRenderer.ImgResized(false);

		var camObj = $("#camimg");
		camObj.load(function ()
		{
			ClearImageLoadTimeout();
			if (!isCurrentlyActive)
				return;
			if (!this.complete || typeof this.naturalWidth == "undefined" || this.naturalWidth == 0)
			{
				// Failed
			}
			else
			{
				var loading = videoPlayer.Loading().image;
				var loaded = videoPlayer.Loaded().image;

				loaded.actualwidth = this.naturalWidth;
				loaded.actualheight = this.naturalHeight;

				if (!loadedFirstFrame || loading.id != loaded.id || loading.path != loaded.path)
				{
					// The loaded image has just changed to a different camera.
					if ($("#camimg").attr('loadingimg') == loading.id)
					{
						loadedFirstFrame = true;
						videoPlayer.CameraOrResolutionChange();
					}
				}

				videoPlayer.ImageRendered(currentImageRequestedAtMs);

				if (loaded.id.startsWith("@"))
				{
					if (lastCycleWidth != this.naturalWidth || lastCycleHeight != this.naturalHeight)
					{
						loaded.maxwidth = lastCycleWidth = this.naturalWidth;
						loaded.maxheight = lastCycleHeight = this.naturalHeight;
						loaded.aspectratio = loaded.maxwidth / loaded.maxheight;
						resized();
					}
				}
				else
					lastCycleWidth = lastCycleHeight = 0;

				currentLoadedImageActualWidth = this.naturalWidth;

				imageRenderer.CopyImageToCanvas("camimg", "camimg_canvas");
			}
			GetNewImage();
		});
		camObj.error(function ()
		{
			ClearImageLoadTimeout();
			setTimeout(GetNewImage, 1000);
		});
		GetNewImage();
	}
	var Activate = function ()
	{
		Initialize();
		if (isCurrentlyActive)
			return;
		isCurrentlyActive = true;
		// Show yourself
		// Reset max* = full* because h.264 player modules will have set max* equal to actual*.
		var loading = videoPlayer.Loading().image;
		loading.maxwidth = loading.fullwidth;
		loading.maxheight = loading.fullheight;
		var loaded = videoPlayer.Loaded().image;
		loaded.maxwidth = loaded.fullwidth;
		loaded.maxheight = loaded.fullheight;
		imageRenderer.ClearCanvas("camimg_canvas");
		$("#camimg_canvas").appendTo("#camimg_wrapper");
	}
	this.Deactivate = function ()
	{
		if (!isCurrentlyActive)
			return;
		isCurrentlyActive = false;
		loadedFirstFrame = false;
		// Stop what you are doing and hide
		clipPlaybackPosition = 0;
		ClearImageLoadTimeout();
		ClearGetNewImageTimeout();
		$("#camimg_canvas").appendTo("#camimg_store");
	}
	this.VisibilityChanged = function (visible)
	{
		isVisible = visible;
	}
	this.LoadedFrameSinceActivate = function ()
	{
		return loadedFirstFrame;
	}

	this.OpenVideo = function ()
	{
		Activate();
		clipPlaybackPosition = 0;
		timeLastClipFrame = new Date().getTime();
		self.Playback_Pause();
		self.Playback_Play();
		GetNewImage();
	}
	this.SeekToMs = function (pos)
	{
		Activate();
		clipPlaybackPosition = pos;
	}
	this.GetSeekMs = function ()
	{
		return clipPlaybackPosition;
	}
	this.GetLastSnapshotUrl = function ()
	{
		return lastSnapshotUrl;
	}
	this.GetLastSnapshotFullUrl = function ()
	{
		return lastSnapshotFullUrl;
	}
	this.GetStaticSnapshotId = function ()
	{
		return staticSnapshotId;
	}
	this.GetCurrentImageTimeMs = function ()
	{
		return currentImageTimestampMs;
	}
	var GetNewImage = function ()
	{
		ClearGetNewImageTimeout();
		if (currentServer.isLoggingOut || !isCurrentlyActive)
			return;
		var loading = videoPlayer.Loading().image;
		sessionManager.ApplyLatestAPISessionIfNecessary();
		var timeValue = currentImageTimestampMs = currentImageRequestedAtMs = new Date().getTime();
		var isLoadingRecordedSnapshot = false;
		if (!loading.isLive)
		{
			var timePassed = timeValue - timeLastClipFrame;
			timeLastClipFrame = timeValue;
			var speedMultiplier = playbackControls.GetPlaybackSpeed();
			timePassed *= speedMultiplier;
			if (playbackPaused || seekBar.IsDragging() || !isVisible)
				timePassed = 0;
			else if (playbackControls.GetPlayReverse())
				timePassed *= -1;
			clipPlaybackPosition += timePassed;

			if (clipPlaybackPosition < 0)
			{
				clipPlaybackPosition = 0;
				videoPlayer.Playback_Ended(true);
			}
			else if (clipPlaybackPosition >= loading.msec)
			{
				clipPlaybackPosition = loading.msec - 1;
				videoPlayer.Playback_Ended(false);
			}

			timeValue = clipPlaybackPosition;
			// Update currentImageTimestampMs so that saved snapshots know the time for file naming
			var clipData = clipLoader.GetCachedClip(loading.id, loading.path);
			if (clipData != null)
			{
				currentImageTimestampMs = clipData.date.getTime() + clipPlaybackPosition;
				isLoadingRecordedSnapshot = clipData.isSnapshot;
				if (isLoadingRecordedSnapshot)
					staticSnapshotId = loading.path;
				else
					staticSnapshotId = "";
			}
		}

		var widthToRequest = imageRenderer.GetWidthToRequest();
		$("#camimg").attr('loadingimg', loading.id);

		var qualityArg = jpegQualityHelper.getQualityArg();

		if (loading.isLive)
			lastSnapshotUrl = currentServer.remoteBaseURL + "image/" + loading.path + '?time=' + timeValue + currentServer.GetRemoteSessionArg("&", true);
		else
			lastSnapshotUrl = currentServer.remoteBaseURL + "file/clips/" + loading.path + '?time=' + timeValue + currentServer.GetRemoteSessionArg("&", true);
		var imgSrcPath = lastSnapshotFullUrl = lastSnapshotUrl + "&w=" + widthToRequest + qualityArg;

		if ($("#camimg").attr('src') == imgSrcPath)
			GetNewImageAfterTimeout();
		else
		{
			// TODO: Instead of checking hlsPlayer.IsBlockingJpegRefresh(), try having the dialog instruct the videoPlayer to Stop().  This can deactivate the playerModule.  Configure the Activate procedure to clear the image by using imageRenderer's opacity options to hide or severely darken the frame while waiting for video to begin again.
			if ((isLoadingRecordedSnapshot
				&& loading.path == videoPlayer.Loaded().image.path
				&& !CouldBenefitFromWidthChange(widthToRequest))
				|| hlsPlayer.IsBlockingJpegRefresh()
				|| !isVisible
			)
				GetNewImageAfterTimeout();
			else
			{
				lastRequestedWidth = widthToRequest;
				repeatedSameImageURLs = 1;
				SetImageLoadTimeout();
				$("#camimg").attr('src', imgSrcPath);
			}
		}
	}
	var CouldBenefitFromWidthChange = function (newWidth)
	{
		return newWidth > lastRequestedWidth && currentLoadedImageActualWidth >= lastRequestedWidth;
	}

	this.Playback_IsPaused = function ()
	{
		return playbackPaused;
	}
	this.Playback_Pause = function ()
	{
		if (!playbackPaused)
			self.Playback_PlayPause();
	}
	this.Playback_Play = function ()
	{
		if (playbackPaused)
			self.Playback_PlayPause();
	}
	this.Playback_PlayPause = function ()
	{
		if (playbackPaused)
		{
			playbackPaused = false;
			$("#pcPlay").hide();
			$("#pcPause").show();
			if (clipPlaybackPosition >= videoPlayer.Loading().image.msec - 1 && !playbackControls.GetPlayReverse())
				clipPlaybackPosition = 0;
			else if (clipPlaybackPosition <= 0 && playbackControls.GetPlayReverse())
				clipPlaybackPosition = videoPlayer.Loading().image.msec - 1;
			if (clipPlaybackPosition < 0)
				clipPlaybackPosition = 0;
		}
		else
		{
			playbackPaused = true;
			$("#pcPlay").show();
			$("#pcPause").hide();
		}
	}
	this.DrawCameraFullCameraAsThumb = function (cameraId, groupId)
	{
		var thumbBounds = cameraListLoader.GetCameraBoundsInCurrentGroupImageUnscaled(cameraId, groupId);
		if (!thumbBounds)
			return;
		var groupObj = cameraListLoader.GetCameraWithId(groupId);
		if (!groupObj)
			return;
		var canvas = $("#camimg_canvas").get(0);

		var backbuffer_canvas = $("#backbuffer_canvas").get(0);
		backbuffer_canvas.width = groupObj.width;
		backbuffer_canvas.height = groupObj.height;

		var backbuffer_context2d = backbuffer_canvas.getContext("2d");
		backbuffer_context2d.clearRect(0, 0, backbuffer_canvas.width, backbuffer_canvas.height);

		var thumbW = thumbBounds[2] - thumbBounds[0];
		var thumbH = thumbBounds[3] - thumbBounds[1];

		// Draw rectangles around each image's grid space
		backbuffer_context2d.strokeStyle = "#888888";
		backbuffer_context2d.lineWidth = 2;
		for (var i = 0; i < groupObj.rects.length; i++)
		{
			var rect = groupObj.rects[i];
			backbuffer_context2d.strokeRect(rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]);
		}

		// Draw radial gradient under the thumbnail image
		//var thumbCenterX = thumbBounds[0] + (thumbW / 2);
		//var thumbCenterY = thumbBounds[1] + (thumbH / 2);
		//var innerR = (thumbW + thumbH) / 2;
		//var outerR = (groupObj.width + groupObj.height) / 4;
		//var grd = backbuffer_context2d.createRadialGradient(thumbCenterX, thumbCenterY, innerR, thumbCenterX, thumbCenterY, outerR);
		//grd.addColorStop(0, "#222222");
		//grd.addColorStop(1, "#000000");
		//backbuffer_context2d.fillStyle = grd;
		//backbuffer_context2d.fillRect(0, 0, backbuffer_canvas.width, backbuffer_canvas.height);
		backbuffer_context2d.drawImage(canvas
			, 0, 0, canvas.width, canvas.height
			, thumbBounds[0], thumbBounds[1], thumbW, thumbH);

		canvas.width = backbuffer_canvas.width;
		canvas.height = backbuffer_canvas.height;
		var context2d = canvas.getContext("2d");
		context2d.drawImage(backbuffer_canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
	}
	this.DrawCameraThumbAsFullCamera = function (cameraId)
	{
		var thumbBounds = cameraListLoader.GetCameraBoundsInCurrentGroupImageScaled(cameraId);
		if (!thumbBounds)
			return;
		var cameraObj = cameraListLoader.GetCameraWithId(cameraId);
		if (!cameraObj)
			return;
		var canvas = $("#camimg_canvas").get(0);

		var backbuffer_canvas = $("#backbuffer_canvas").get(0);

		backbuffer_canvas.width = cameraObj.width;
		backbuffer_canvas.height = cameraObj.height;

		var backbuffer_context2d = backbuffer_canvas.getContext("2d");

		backbuffer_context2d.drawImage(canvas
			, thumbBounds[0], thumbBounds[1], thumbBounds[2] - thumbBounds[0], thumbBounds[3] - thumbBounds[1]
			, 0, 0, backbuffer_canvas.width, backbuffer_canvas.height);

		$("#camimg_wrapper").css("width", backbuffer_canvas.width + "px").css("height", backbuffer_canvas.height + "px");
		canvas.width = backbuffer_canvas.width;
		canvas.height = backbuffer_canvas.height;
		var context2d = canvas.getContext("2d");
		context2d.drawImage(backbuffer_canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
	}

	var imgLoadTimeout = null;
	var SetImageLoadTimeout = function ()
	{
		ClearImageLoadTimeout();
		imgLoadTimeout = setTimeout(function ()
		{
			bilog.debug("Image load timed out");
			GetNewImage();
		}, 15000);
	}
	var ClearImageLoadTimeout = function ()
	{
		if (imgLoadTimeout != null)
		{
			clearTimeout(imgLoadTimeout);
			imgLoadTimeout = null;
		}
	}
	var getNewImageTimeout = null;
	var GetNewImageAfterTimeout = function ()
	{
		// <summary>Calls GetNewImage after increasing delay, to reduce CPU usage a bit while idling</summary>
		getNewImageTimeout = setTimeout(GetNewImage, Math.min(500, 25 + 2 * repeatedSameImageURLs++));
	}
	var ClearGetNewImageTimeout = function ()
	{
		if (getNewImageTimeout != null)
		{
			clearTimeout(getNewImageTimeout);
			getNewImageTimeout = null;
		}
	}
}
///////////////////////////////////////////////////////////////
// Fetch and PNaCl H.264 Video Module /////////////////////////
///////////////////////////////////////////////////////////////
function FetchPNaClH264VideoModule()
{
	/*
	A low level video player module which streams H.264 using the fetch API, and decodes/plays it using a PNaCl program.
	*/
	var self = this;
	var isInitialized = false;
	var isCurrentlyActive = false;
	var pnacl_player;
	var fetchStreamer;
	var isVisible = !documentIsHidden();

	var Initialize = function ()
	{
		if (isInitialized)
			return;
		console.log("Initializing pnacl_player");
		isInitialized = true;
		// Do one-time initialization here
		$("#camimg_wrapper").append('<div id="pnacl_player_wrapper"></div>');
		pnacl_player = new Pnacl_Player("#pnacl_player_wrapper", videoPlayer.ImageRendered, videoPlayer.CameraOrResolutionChange);
	}
	var Activate = function ()
	{
		Initialize();
		if (isCurrentlyActive)
			return;
		console.log("Activating pnacl_player");
		isCurrentlyActive = true;
		// Show yourself
		$("#pnacl_player_wrapper").removeClass("camimg_offscreen");
	}
	this.Deactivate = function ()
	{
		// TODO: Throttle the rate of Activate/Deactivate so that rapid minimize/maximize can't break the fetch API and leave connections open.
		if (!isCurrentlyActive)
			return;
		console.log("Deactivating pnacl_player");
		isCurrentlyActive = false;
		// Stop what you are doing and hide
		if (fetchStreamer)
		{
			fetchStreamer.StopStreaming();
			fetchStreamer = null;
		}
		pnacl_player.Reset();
		$("#pnacl_player_wrapper").addClass("camimg_offscreen");
	}
	this.VisibilityChanged = function (visible)
	{
		isVisible = visible;
		if (isVisible && !isCurrentlyActive)
			self.OpenVideo();
		else
			self.Deactivate();
	}
	this.LoadedFrameSinceActivate = function ()
	{
		return pnacl_player.GetRenderedFrameCount() > 0;
	}
	var openVideoTimeout = null;
	this.OpenVideo = function ()
	{
		Activate();
		if (openVideoTimeout != null)
			clearTimeout(openVideoTimeout);
		if (!pnacl_player.IsLoaded())
		{
			openVideoTimeout = setTimeout(self.OpenVideo, 5);
			return;
		}
		if (fetchStreamer)
		{
			fetchStreamer.StopStreaming();
			fetchStreamer = null;
		}
		pnacl_player.Reset();
		fetchStreamer = new FetchRawH264Streamer("/h264/" + videoPlayer.Loading().image.id + "/temp.h264" + currentServer.GetRemoteSessionArg("?", true), pnacl_player.AcceptFrame,
			function (e)
			{
				console.log("fetch stream ended");
				console.log(e);
			});
	}
	this.SeekToMs = function (pos)
	{
	}
	this.GetSeekMs = function ()
	{
		return 0;
	}
	this.GetLastSnapshotUrl = function ()
	{
		return "";
	}
	this.GetLastSnapshotFullUrl = function ()
	{
		return "";
	}
	this.GetStaticSnapshotId = function ()
	{
		return "";
	}
	this.GetCurrentImageTimeMs = function ()
	{
		return new Date().getTime();
	}
	this.Playback_IsPaused = function ()
	{
		return false;
	}
	this.Playback_Pause = function ()
	{
	}
	this.Playback_Play = function ()
	{
	}
	this.Playback_PlayPause = function ()
	{
	}
}
///////////////////////////////////////////////////////////////
// pnacl_player ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function Pnacl_Player(parentSelector, frameRendered, cameraOrResolutionChange)
{
	var self = this;
	var $player;
	var player;
	var acceptedFrameCount = 0;
	var renderedFrameCount = 0;
	var isLoaded = false;

	var moduleDidLoad = function ()
	{
		isLoaded = true;
		console.log("Pnacl_Player Loaded!");
	}
	var handleMessage = function (message_event)
	{
		if (typeof message_event.data === 'string')
		{
			if (message_event.data == "initialized")
			{
				console.log(message_event.data);
			}
			else if (message_event.data.startsWith("Rendered frame: "))
			{
				var dataObj = JSON.parse(message_event.data.substr("Rendered frame: ".length));
				var loading = videoPlayer.Loading().image;
				if (loading.actualwidth != dataObj.w || loading.actualheight != dataObj.h || renderedFrameCount == 0)
				{
					console.log(message_event.data);
					loading.actualwidth = dataObj.w;
					loading.actualheight = dataObj.h;
					loading.maxwidth = dataObj.w;
					loading.maxheight = dataObj.h;
					cameraOrResolutionChange();
				}
				frameRendered(new Date().getTime());
				//console.log(message_event.data);
				renderedFrameCount++;
			}
			else if (message_event.data == "Received frame")
			{
				//console.log(message_event.data);
			}
			else if (message_event.data.startsWith("Video resized to "))
			{
				var parts = message_event.data.substring("Video resized to ".length).split("x");
				if (parts.length == 2)
				{
					var width = parseInt(parts[0]);
					var height = parseInt(parts[1]);

					//cameraOrResolutionChange();
				}
				console.log(message_event.data);
			}
			else
			{
				console.log(message_event.data);
			}
		}
		else
		{
			console.log("Pnacl_Player Message of unhandled type " + (typeof message_event.data));
			console.log(message_event.data);
		}
	}
	var handleError = function (event)
	{
		console.log("Pnacl_Player ERROR: " + player.lastError);
		console.log(event);
	}
	var handleCrash = function (event)
	{
		if (common.naclModule.exitStatus == -1)
			console.log("Pnacl_Player CRASH! Last error: " + player.lastError);
		else
			console.log("Pnacl_Player EXITED [" + common.naclModule.exitStatus + "]");
		console.log(event);
	}

	var Initialize = function ()
	{
		var $parent = $(parentSelector);
		$parent.empty();

		var listenerDiv = $parent.get(0);
		listenerDiv.addEventListener('load', moduleDidLoad, true);
		listenerDiv.addEventListener('message', handleMessage, true);
		listenerDiv.addEventListener('error', handleError, true);
		listenerDiv.addEventListener('crash', handleCrash, true);

		var $player = $('<embed id="pnacl_player_module" name="pnacl_player_module" width="100%" height="100%" path="pnacl/Release" src="ui3/pnacl/Release/pnacl_player.nmf" type="application/x-pnacl" hwaccel="0" />');
		$parent.append($player);
		player = document.getElementById("pnacl_player_module");

	}
	this.Dispose = function ()
	{
		var listenerDiv = $parent.get(0);
		listenerDiv.removeEventListener('load', moduleDidLoad, true);
		listenerDiv.removeEventListener('message', handleMessage, true);
		listenerDiv.removeEventListener('error', handleError, true);
		listenerDiv.removeEventListener('crash', handleCrash, true);

		$parent.empty();
	}
	this.IsLoaded = function ()
	{
		return isLoaded;
	}
	this.GetRenderedFrameCount = function ()
	{
		return renderedFrameCount;
	}
	this.Reset = function ()
	{
		player.postMessage("reset");
		console.log("this.Reset");
		acceptedFrameCount = 0;
		renderedFrameCount = 0;
	}
	this.AcceptFrame = function (dataArr)
	{
		player.postMessage("f " + (acceptedFrameCount * 200));
		player.postMessage(dataArr.buffer);
		acceptedFrameCount++;
	}

	Initialize();
}
///////////////////////////////////////////////////////////////
// Image Renderer                                            //
// provides rendering and scaling services                   //
///////////////////////////////////////////////////////////////
function ImageRenderer()
{
	var self = this;
	var dpiScalingFactor = BI_GetDevicePixelRatio();
	var zoomHintTimeout = null;
	var zoomHintIsVisible = false;
	var digitalZoom = 0;
	this.SetDigitalZoom = function (newZoom)
	{
		digitalZoom = newZoom;
	}
	var zoomTable = [0, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 23, 26, 30, 35, 40, 45, 50];
	var imageIsDragging = false;
	var imageIsLargerThanAvailableSpace = false;
	var mouseX = 0;
	var mouseY = 0;
	var imgDigitalZoomOffsetX = 0;
	var imgDigitalZoomOffsetY = 0;
	var previousImageDraw = {
		x: -1, y: -1, w: -1, h: -1, z: 10
	};
	previousImageDraw.x = -1;
	previousImageDraw.y = -1;
	previousImageDraw.w = -1;
	previousImageDraw.h = -1;
	previousImageDraw.z = 10;

	var mouseMoveTolerance = 5;
	var camImgClickState = new Object();
	camImgClickState.mouseDown = false;
	camImgClickState.mouseX = 0;
	camImgClickState.mouseY = 0;

	var frameOpacity = 1;
	var frameDefaultOpacity = 1;

	this.GetWidthToRequest = function ()
	{
		// Calculate the size of the image we need
		var ciLoading = videoPlayer.Loading().image;
		var imgDrawWidth = ciLoading.maxwidth * dpiScalingFactor * (zoomTable[digitalZoom]);
		var imgDrawHeight = ciLoading.maxheight * dpiScalingFactor * (zoomTable[digitalZoom]);
		if (imgDrawWidth == 0)
		{
			// Image is supposed to scale to fit the screen (first zoom level)
			imgDrawWidth = $("#layoutbody").width() * dpiScalingFactor;
			imgDrawHeight = $("#layoutbody").height() * dpiScalingFactor;

			var availableRatio = imgDrawWidth / imgDrawHeight;
			if (availableRatio < ciLoading.aspectratio)
				imgDrawHeight = imgDrawWidth / ciLoading.aspectratio;
			else
				imgDrawWidth = imgDrawHeight * ciLoading.aspectratio;
		}
		if (ciLoading.aspectratio < 1)
		{
			imgDrawHeight = jpegQualityHelper.ModifyImageDimension(imgDrawHeight);
			imgDrawWidth = imgDrawHeight * ciLoading.aspectratio;
		}
		else
		{
			imgDrawWidth = jpegQualityHelper.ModifyImageDimension(imgDrawWidth);
			imgDrawHeight = imgDrawWidth / ciLoading.aspectratio;
		}
		// Now we have the size we need.  Determine what argument we will send to Blue Iris
		return parseInt(Math.round(imgDrawWidth));
	}
	this.SetMousePos = function (x, y)
	{
		mouseX = x;
		mouseY = y;
	}
	this.GetPreviousImageDrawInfo = function ()
	{
		return previousImageDraw;
	}
	this.CopyImageToCanvas = function (imgId, canvasId)
	{
		var imgEle = $("#" + imgId).get(0);
		var canvas = $("#" + canvasId).get(0);
		if (canvas.width != imgEle.naturalWidth)
			canvas.width = imgEle.naturalWidth;
		if (canvas.height != imgEle.naturalHeight)
			canvas.height = imgEle.naturalHeight;

		var context2d = canvas.getContext("2d");
		context2d.drawImage(imgEle, 0, 0);
	}
	this.ChangeFrameDefaultOpacity = function (opacity)
	{
		frameDefaultOpacity = opacity;
	}
	this.SetFrameOpacity_Default = function ()
	{
		self.SetFrameOpacity(frameDefaultOpacity);
	}
	this.SetFrameOpacity = function (opacity)
	{
		if (frameOpacity != opacity)
		{
			frameOpacity = opacity;
			$("#camimg_wrapper").css("opacity", opacity);
		}
	}
	this.ClearCanvas = function (canvasId)
	{
		var canvas = $("#" + canvasId).get(0);
		var context2d = canvas.getContext("2d");
		context2d.clearRect(0, 0, canvas.width, canvas.height);
	}
	this.ImgResized = function (isFromKeyboard)
	{
		dpiScalingFactor = BI_GetDevicePixelRatio();

		var imgAvailableWidth = $("#layoutbody").width();
		var imgAvailableHeight = $("#layoutbody").height();

		// Calculate new size based on zoom levels
		var imgForSizing = videoPlayer.Loaded().image;
		var imgDrawWidth = imgForSizing.maxwidth * (zoomTable[digitalZoom]);
		var imgDrawHeight = imgForSizing.maxheight * (zoomTable[digitalZoom]);
		if (imgDrawWidth == 0)
		{
			imgDrawWidth = imgAvailableWidth;
			imgDrawHeight = imgAvailableHeight;

			var newRatio = imgDrawWidth / imgDrawHeight;
			if (newRatio < imgForSizing.aspectratio)
				imgDrawHeight = imgDrawWidth / imgForSizing.aspectratio;
			else
				imgDrawWidth = imgDrawHeight * imgForSizing.aspectratio;
		}
		$("#camimg_wrapper").css("width", imgDrawWidth + "px").css("height", imgDrawHeight + "px");

		imageIsLargerThanAvailableSpace = imgDrawWidth > imgAvailableWidth || imgDrawHeight > imgAvailableHeight;

		if (previousImageDraw.z > -1 && previousImageDraw.z != digitalZoom)
		{
			// We just experienced a zoom change
			// Find the mouse position percentage relative to the center of the image at its old size
			var imgPos = $("#camimg_wrapper").position();
			var layoutbodyOffset = $("#layoutbody").offset();
			var xPos = mouseX;
			var yPos = mouseY;
			if (isFromKeyboard)
			{
				xPos = layoutbodyOffset.left + ($("#layoutbody").outerWidth(true) / 2);
				yPos = layoutbodyOffset.top + ($("#layoutbody").outerHeight(true) / 2);
			}
			var mouseRelX = -0.5 + (parseFloat((xPos - layoutbodyOffset.left) - imgPos.left) / previousImageDraw.w);
			var mouseRelY = -0.5 + (parseFloat((yPos - layoutbodyOffset.top) - imgPos.top) / previousImageDraw.h);

			// Get the difference in image size
			var imgSizeDiffX = imgDrawWidth - previousImageDraw.w;
			var imgSizeDiffY = imgDrawHeight - previousImageDraw.h;
			// Modify the zoom offsets by % of difference
			imgDigitalZoomOffsetX -= mouseRelX * imgSizeDiffX;
			imgDigitalZoomOffsetY -= mouseRelY * imgSizeDiffY;
		}

		// Enforce digital panning limits
		var maxOffsetX = (imgDrawWidth - imgAvailableWidth) / 2;
		if (maxOffsetX < 0)
			imgDigitalZoomOffsetX = 0;
		else if (imgDigitalZoomOffsetX > maxOffsetX)
			imgDigitalZoomOffsetX = maxOffsetX;
		else if (imgDigitalZoomOffsetX < -maxOffsetX)
			imgDigitalZoomOffsetX = -maxOffsetX;

		var maxOffsetY = (imgDrawHeight - imgAvailableHeight) / 2;
		if (maxOffsetY < 0)
			imgDigitalZoomOffsetY = 0;
		else if (imgDigitalZoomOffsetY > maxOffsetY)
			imgDigitalZoomOffsetY = maxOffsetY;
		else if (imgDigitalZoomOffsetY < -maxOffsetY)
			imgDigitalZoomOffsetY = -maxOffsetY;

		// Calculate new image position
		var proposedX = (((imgAvailableWidth - imgDrawWidth) / 2) + imgDigitalZoomOffsetX);
		var proposedY = (((imgAvailableHeight - imgDrawHeight) / 2) + imgDigitalZoomOffsetY);

		$("#camimg_wrapper").css("left", proposedX + "px").css("top", proposedY + "px");

		// Store new image position for future calculations
		previousImageDraw.x = proposedX;
		previousImageDraw.x = proposedY;
		previousImageDraw.w = imgDrawWidth;
		previousImageDraw.h = imgDrawHeight;
		previousImageDraw.z = digitalZoom;

		BI_CustomEvent.Invoke("ImageResized");
	}
	this.DigitalZoomNow = function (deltaY, isFromKeyboard)
	{
		if (deltaY < 0)
			digitalZoom -= 1;
		else if (deltaY > 0)
			digitalZoom += 1;
		if (digitalZoom < 0)
			digitalZoom = 0;
		else if (digitalZoom >= zoomTable.length)
			digitalZoom = zoomTable.length - 1;

		$("#zoomhint").stop(true, true);
		$("#zoomhint").show();
		zoomHintIsVisible = true;
		$("#zoomhint").html(digitalZoom == 0 ? "Fit" : (zoomTable[digitalZoom] + "x"))
		RepositionZoomHint(isFromKeyboard);
		if (zoomHintTimeout != null)
			clearTimeout(zoomHintTimeout);
		zoomHintTimeout = setTimeout(function ()
		{
			$("#zoomhint").fadeOut({
				done: function ()
				{
					zoomHintIsVisible = false;
				}
			})
		}, 200);

		self.ImgResized(isFromKeyboard);

		SetCamCellCursor();
	}
	this.DigitalPan = function (dx, dy)
	{
		imgDigitalZoomOffsetX += dx;
		imgDigitalZoomOffsetY += dy;
		self.ImgResized(true);
	}
	this.RegisterCamImgClickHandler = function ()
	{
		_registerCamImgClickHandler();
	}
	var _registerCamImgClickHandler = function ()
	{
		$('#layoutbody').mousedown(function (e)
		{
			mouseCoordFixer.fix(e);
			camImgClickState.mouseDown = true;
			camImgClickState.mouseX = e.pageX;
			camImgClickState.mouseY = e.pageY;
		});
	}
	var RepositionZoomHint = function (isFromKeyboard)
	{
		var xPos = mouseX;
		var yPos = mouseY;
		if (isFromKeyboard)
		{
			var layoutbodyOffset = $("#layoutbody").offset();
			xPos = layoutbodyOffset.left + ($("#layoutbody").outerWidth(true) / 2);
			yPos = layoutbodyOffset.top + ($("#layoutbody").outerHeight(true) / 2);
		}
		$("#zoomhint").css("left", (xPos - $("#zoomhint").outerWidth(true)) + "px").css("top", (yPos - $("#zoomhint").outerHeight(true)) + "px");
	}
	var SetCamCellCursor = function ()
	{
		var outerObjs = $('#layoutbody,#camimg_wrapper,#zoomhint');
		if (imageIsLargerThanAvailableSpace)
		{
			if (imageIsDragging)
			{
				outerObjs.removeClass("grabcursor");
				outerObjs.addClass("grabbingcursor");
			}
			else
			{
				outerObjs.removeClass("grabbingcursor");
				outerObjs.addClass("grabcursor");
			}
		}
		else
		{
			outerObjs.removeClass("grabcursor");
			outerObjs.removeClass("grabbingcursor");
			// TODO: Evaluate if the innerObjs cursor set can be skipped. This appears to be the only place the style is set.
			var innerObjs = $('#camimg_wrapper,#zoomhint');
			innerObjs.css("cursor", "default");
		}
	}
	this.CamImgClickStateReset = function ()
	{
		camImgClickState.mouseDown = false;
	}
	// Initialization script for ImageRenderer -- called on document ready
	$('#layoutbody').mousewheel(function (e, delta, deltaX, deltaY)
	{
		mouseCoordFixer.fix(e);
		if (playbackControls.MouseInSettingsPanel(e))
			return;
		e.preventDefault();
		self.DigitalZoomNow(deltaY, false);
	});
	$('#layoutbody,#zoomhint').mousedown(function (e)
	{
		mouseCoordFixer.fix(e);
		if (e.which == 1)
		{
			mouseX = e.pageX;
			mouseY = e.pageY;
			imageIsDragging = true;
			SetCamCellCursor();
			e.preventDefault();
		}
	});
	$(document).mouseup(function (e)
	{
		mouseCoordFixer.fix(e);
		if (e.which == 1)
		{
			if (camImgClickState.mouseDown)
			{
				if (Math.abs(camImgClickState.mouseX - e.pageX) <= mouseMoveTolerance
					|| Math.abs(camImgClickState.mouseY - e.pageY) <= mouseMoveTolerance)
				{
					camImgClickState.mouseDown = false;
					videoPlayer.ImgClick(e);
				}
			}
			imageIsDragging = false;
			SetCamCellCursor();

			mouseX = e.pageX;
			mouseY = e.pageY;
		}
	});
	$('#layoutbody').mouseleave(function (e)
	{
		mouseCoordFixer.fix(e);
		camImgClickState.mouseDown = false;
		mouseX = e.pageX;
		mouseY = e.pageY;
	});
	$(document).mouseleave(function (e)
	{
		mouseCoordFixer.fix(e);
		camImgClickState.mouseDown = false;
		imageIsDragging = false;
		SetCamCellCursor();
	});
	$(document).on("mousemove touchmove", function (e)
	{
		mouseCoordFixer.fix(e);

		if (camImgClickState.mouseDown)
		{
			if ((Math.abs(camImgClickState.mouseX - e.pageX) > mouseMoveTolerance
				|| Math.abs(camImgClickState.mouseY - e.pageY) > mouseMoveTolerance))
			{
				camImgClickState.mouseDown = false;
			}
			else
				return;
		}
		var requiresImgResize = false;
		if (imageIsDragging && imageIsLargerThanAvailableSpace)
		{
			imgDigitalZoomOffsetX += (e.pageX - mouseX);
			imgDigitalZoomOffsetY += (e.pageY - mouseY);
			requiresImgResize = true;
		}

		mouseX = e.pageX;
		mouseY = e.pageY;

		if (requiresImgResize)
			self.ImgResized(false);

		if (zoomHintIsVisible)
			RepositionZoomHint(false);
	});
}
///////////////////////////////////////////////////////////////
// Jpeg Quality Helper ////////////////////////////////////////
///////////////////////////////////////////////////////////////
function JpegQualityHelper()
{
	var self = this;
	self.getQualityArg = function ()
	{
		var currentQualityId = dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().uniqueQualityId;
		if (currentQualityId == "B") // Standard Definition
			return "&q=50";
		else if (currentQualityId == "C") // Low Definition
			return "&q=20";
		else // ("A" or other) High Definition
			return "";
	}
	self.ModifyImageDimension = function (imgDimension)
	{
		var currentQualityId = dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().uniqueQualityId;
		if (currentQualityId == "B") // Standard Definition
			return Math.min(imgDimension, 640);
		else if (currentQualityId == "C") // Low Definition
			return Math.min(imgDimension, 320);
		else // ("A" or other) High Definition
			return imgDimension;
	}
	self.GetQualityAbbr = function ()
	{
		return dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().abbr;
	}
	self.GetQualityName = function ()
	{
		return dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().text;
	}
}
///////////////////////////////////////////////////////////////
// Video Canvas Context Menu //////////////////////////////////
///////////////////////////////////////////////////////////////
function CanvasContextMenu()
{
	var lastLiveContextMenuSelectedCamera = null;
	var lastRecordContextMenuSelectedClip = null;
	var self = this;

	var onShowLiveContextMenu = function (menu)
	{
		var itemsToDisable = ["cameraname"];
		if (!pnacl_player_supported)
			itemsToDisable.push("h264module");
		if (lastLiveContextMenuSelectedCamera == null || cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
		{
			itemsToDisable = itemsToDisable.concat(["trigger", "record", "snapshot", "maximize", "restart", "properties"]);
			menu.applyrule(
				{
					name: "disable_camera_buttons",
					disable: true,
					items: itemsToDisable
				});
		}
		else
		{
			menu.applyrule(
				{
					name: "disable_cameraname",
					disable: true,
					items: itemsToDisable
				});
		}
	}
	var onTriggerLiveContextMenu = function (e)
	{
		if (pnacl_player_supported)
			$("#playerModuleEnable").text(videoPlayer.CurrentPlayerModuleName() == "jpeg" ? "Enable" : "Disable");
		else
			$("#playerModuleEnable").text("(chrome) ");
		var downloadButton = $("#cmroot_liveview_downloadbutton_findme").closest(".b-m-item");
		if (downloadButton.parent().attr("id") == "cmroot_liveview_downloadlink")
			downloadButton.parent().attr("href", videoPlayer.GetLastSnapshotUrl());
		else
			downloadButton.wrap('<a id="cmroot_liveview_downloadlink" style="display:block" href="'
				+ videoPlayer.GetLastSnapshotUrl()
				+ '" onclick="saveSnapshot(&quot;#cmroot_liveview_downloadlink&quot;)" target="_blank"></a>');
		$("#cmroot_liveview_downloadlink").attr("download", "temp.jpg");
		if (videoPlayer.Loading().image.isLive)
		{
			imageRenderer.CamImgClickStateReset();
			var homeGroupObj = null;
			var camData = videoPlayer.GetCameraUnderMousePointer(e);
			if (camData == null)
				camData = homeGroupObj = videoPlayer.GetCurrentHomeGroupObj();
			lastLiveContextMenuSelectedCamera = camData;
			if (camData != null)
			{
				LoadDynamicManualRecordingButtonState(camData);
				var camName = CleanUpGroupName(camData.optionDisplay);
				$("#contextMenuCameraName").text(camName);
				$("#contextMenuCameraName").closest("div.b-m-item,div.b-m-idisable").attr("title", "The buttons below are specific to the camera: " + camName);
				var $maximize = $("#contextMenuMaximize");
				var isMaxAlready = (camData.optionValue == videoPlayer.Loaded().image.id && homeGroupObj == null);
				$maximize.text(isMaxAlready ? "Back to Group" : "Maximize");
				$maximize.parent().prev().find("use").attr("xlink:href", isMaxAlready ? "#svg_mio_FullscreenExit" : "#svg_mio_Fullscreen");
			}
			return true;
		}
		return false;
	}
	var onLiveContextMenuAction = function ()
	{
		switch (this.data.alias)
		{
			case "maximize":
				if (cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
					toaster.Warning("Function is unavailable.");
				else
					videoPlayer.ImgClick_Camera(lastLiveContextMenuSelectedCamera);
				break;
			case "trigger":
				if (cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot trigger cameras that are part of an auto-cycle.");
				else
					TriggerCamera(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "record":
				if (cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot toggle recording of cameras that are part of an auto-cycle.");
				else
					ManualRecordCamera(lastLiveContextMenuSelectedCamera.optionValue, $("#manRecBtnLabel").attr("start"));
				break;
			case "snapshot":
				if (cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot save a snapshot of cameras that are part of an auto-cycle.");
				else
					SaveSnapshotInBlueIris(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "restart":
				if (cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot restart cameras that are part of an auto-cycle.");
				else
					ResetCamera(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "properties":
				if (cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot view properties of cameras that are part of an auto-cycle.");
				else
					cameraProperties.open(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "openhls":
				hlsPlayer.OpenDialog(videoPlayer.Loading().image.id);
				break;
			case "opennewtab":
				window.open(videoPlayer.GetLastSnapshotFullUrl());
				break;
			case "saveas":
				return true;
			case "sizeAuto":
				SetUISize('auto');
				break;
			case "sizeLarge":
				SetUISize('large');
				break;
			case "sizeMedium":
				SetUISize('medium');
				break;
			case "sizeSmall":
				SetUISize('small');
				break;
			case "sizeSmaller":
				SetUISize('smaller');
				break;
			case "viewChangeMode_Traditional":
				videoPlayer.SetViewChangeMode(0);
				break;
			case "viewChangeMode_Scale":
				videoPlayer.SetViewChangeMode(1);
				break;
			case "viewChangeMode_Fade":
				videoPlayer.SetViewChangeMode(2);
				break;
			case "viewChangeMode_ScaleInFadeOut":
				videoPlayer.SetViewChangeMode(3);
				break;
			case "viewChangeMode_FadeScaleInFadeOut":
				videoPlayer.SetViewChangeMode(4);
				break;
			case "viewChangeMode_FadeScale":
				videoPlayer.SetViewChangeMode(5);
				break;
			case "h264module":
				if (videoPlayer.CurrentPlayerModuleName() == "jpeg")
				{
					videoPlayer.useH264ForLiveView_TempVar = true;
					if (videoPlayer.Loading().image.isLive)
						videoPlayer.SetPlayerModule("h264", true);
				}
				else
				{
					videoPlayer.useH264ForLiveView_TempVar = false;
					if (videoPlayer.Loading().image.isLive)
						videoPlayer.SetPlayerModule("jpeg", true);
				}
				break;
			default:
				toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	}
	var onCancelContextMenu = function ()
	{
	}
	var optionLive =
		{
			alias: "cmroot_live", width: 200, items:
			[
				{ text: "Open image in new tab", icon: "#svg_mio_Tab", iconClass: "noflip", alias: "opennewtab", action: onLiveContextMenuAction }
				, { text: '<div id="cmroot_liveview_downloadbutton_findme" style="display:none"></div>Save image to disk', icon: "#svg_x5F_Snapshot", alias: "saveas", action: onLiveContextMenuAction }
				, { text: "Open HLS Stream", icon: "#svg_mio_ViewStream", iconClass: "noflip", alias: "openhls", tooltip: "Opens a live H.264 stream in an efficient, cross-platform player. This method delays the stream by several seconds.", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "<span id=\"contextMenuCameraName\">Camera Name</span>", icon: "", alias: "cameraname" }
				, { type: "splitLine" }
				, { text: "<span id=\"contextMenuMaximize\">Maximize</span>", icon: "#svg_mio_Fullscreen", iconClass: "noflip", alias: "maximize", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, {
					text: "UI Size (Temporary)", icon: "", alias: "uiSize", type: "group", width: 180, items:
					[
						{ text: "Auto", icon: "", alias: "sizeAuto", action: onLiveContextMenuAction }
						, { text: "Large", icon: "", alias: "sizeLarge", action: onLiveContextMenuAction }
						, { text: "Medium", icon: "", alias: "sizeMedium", action: onLiveContextMenuAction }
						, { text: "Small", icon: "", alias: "sizeSmall", action: onLiveContextMenuAction }
						, { text: "Smaller", icon: "", alias: "sizeSmaller", action: onLiveContextMenuAction }
					]
				}
				, {
					text: "View Change Mode", icon: "", alias: "viewChangeMode", type: "group", width: 180, items:
					[
						{ text: "Traditional (0)", icon: "", alias: "viewChangeMode_Traditional", action: onLiveContextMenuAction }
						, { text: "Scale (1)", icon: "", alias: "viewChangeMode_Scale", action: onLiveContextMenuAction }
						, { text: "Fade (2)", icon: "", alias: "viewChangeMode_Fade", action: onLiveContextMenuAction }
						, { text: "Scale/Fade (3)", icon: "", alias: "viewChangeMode_ScaleInFadeOut", action: onLiveContextMenuAction }
						, { text: "FadeScale/Fade (4)", icon: "", alias: "viewChangeMode_FadeScaleInFadeOut", action: onLiveContextMenuAction }
						, { text: "FadeScale (5)", icon: "", alias: "viewChangeMode_FadeScale", action: onLiveContextMenuAction }
					]
				}
				, { text: "<span id=\"playerModuleEnable\">Enable</span> h.264 module", icon: "", alias: "h264module", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "Trigger Now", icon: "#svg_x5F_Alert1", iconClass: "iconBlue", alias: "trigger", action: onLiveContextMenuAction }
				, { text: "<span id=\"manRecBtnLabel\">Toggle Recording</span>", icon: "#svg_x5F_Stoplight", iconClass: "iconBlue", alias: "record", tooltip: "Toggle Manual Recording", action: onLiveContextMenuAction }
				, { text: "Snapshot in Blue Iris", icon: "#svg_x5F_Snapshot", iconClass: "iconBlue", alias: "snapshot", tooltip: "Blue Iris will record a snapshot", action: onLiveContextMenuAction }
				, { text: "Restart Camera", icon: "#svg_x5F_Restart", iconClass: "iconBlue", alias: "restart", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "Properties", icon: "#svg_x5F_Viewdetails", alias: "properties", action: onLiveContextMenuAction }
			]
			, onContextMenu: onTriggerLiveContextMenu
			, onCancelContextMenu: onCancelContextMenu
			, onShow: onShowLiveContextMenu
			, clickType: "right"
		};
	$("#layoutbody").contextmenu(optionLive);
	var onShowRecordContextMenu = function (menu)
	{
		menu.applyrule(
			{
				name: "disable_clipname",
				disable: true,
				items: ["clipname"]
			});
	}
	var onTriggerRecordContextMenu = function (e)
	{
		if (videoPlayer.Loading().image.isLive)
			return false;

		lastRecordContextMenuSelectedClip = clipLoader.GetCachedClip(videoPlayer.Loading().image.id, videoPlayer.Loading().image.path);
		var clipData = clipLoader.GetClipFromId(lastRecordContextMenuSelectedClip.clipId);
		var clipInfo = clipLoader.GetDownloadClipInfo(clipData);

		var downloadButton = $("#cmroot_recordview_downloadbutton_findme").closest(".b-m-item");
		if (downloadButton.parent().attr("id") == "cmroot_recordview_downloadlink")
			downloadButton.parent().attr("href", videoPlayer.GetLastSnapshotUrl());
		else
			downloadButton.wrap('<a id="cmroot_recordview_downloadlink" style="display:block" href="'
				+ videoPlayer.GetLastSnapshotUrl()
				+ '" onclick="saveSnapshot(&quot;#cmroot_recordview_downloadlink&quot;)" target="_blank"></a>');
		$("#cmroot_recordview_downloadlink").attr("download", "temp.jpg");

		var $dlBtnLabel = $("#cmroot_recordview_downloadclipbutton");
		var $dlBtn = $dlBtnLabel.closest(".b-m-item");
		if (clipData.fileSize)
			$dlBtnLabel.text("Download clip (" + htmlEncode(clipData.fileSize) + ")");
		else
			$dlBtnLabel.text("Download clip");
		if ($dlBtn.parent().attr("id") != "cmroot_recordview_downloadcliplink")
			$dlBtn.wrap('<a id="cmroot_recordview_downloadcliplink" style="display:block" href="" target="_blank"></a>');
		$dlBtn.parent().attr("href", clipInfo.href).attr("download", clipInfo.download);

		var name = clipLoader.GetClipDisplayName(clipData);
		$("#contextMenuClipName").text(name).closest(".b-m-item,.b-m-idisable").attr("title", name);

		imageRenderer.CamImgClickStateReset();
		return true;
	}
	var onRecordContextMenuAction = function ()
	{
		switch (this.data.alias)
		{
			case "properties":
				if (lastRecordContextMenuSelectedClip != null)
					clipProperties.open(lastRecordContextMenuSelectedClip.clipId);
				break;
			case "opennewtab":
				videoPlayer.Playback_Pause();
				window.open(videoPlayer.GetLastSnapshotFullUrl());
				break;
			case "saveas":
				return true;
			case "downloadclip":
				return true;
			case "closeclip":
				clipLoader.CloseCurrentClip();
				return;
			default:
				toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	}
	var optionRecord =
		{
			alias: "cmroot_record", width: 200, items:
			[
				{ text: "Open image in new tab", icon: "", alias: "opennewtab", action: onRecordContextMenuAction }
				, { text: '<div id="cmroot_recordview_downloadbutton_findme" style="display:none"></div>Save image to disk', icon: "#svg_x5F_Snapshot", alias: "saveas", action: onRecordContextMenuAction }
				, { text: '<span id="cmroot_recordview_downloadclipbutton">Download clip</span>', icon: "#svg_x5F_Download", alias: "downloadclip", action: onRecordContextMenuAction }
				, { type: "splitLine" }
				, { text: "<span id=\"contextMenuClipName\">Clip Name</span>", icon: "", alias: "clipname" }
				, { type: "splitLine" }
				, { text: "Close Clip", icon: "#svg_x5F_Error", alias: "closeclip", action: onRecordContextMenuAction }
				, { type: "splitLine" }
				, { text: "Properties", icon: "#svg_x5F_Viewdetails", alias: "properties", action: onRecordContextMenuAction }
			]
			, onContextMenu: onTriggerRecordContextMenu
			, onShow: onShowRecordContextMenu
			, clickType: "right"
		};
	$("#layoutbody").contextmenu(optionRecord);
}
///////////////////////////////////////////////////////////////
// Calendar Context Menu //////////////////////////////////////
///////////////////////////////////////////////////////////////
function CalendarContextMenu()
{
	var self = this;

	var onContextMenuAction = function ()
	{
		switch (this.data.alias)
		{
			case "select":
				dateFilter.OpenDatePicker($("#dateRange").get(0));
				break;
			case "today":
				dateFilter.SelectToday();
				break;
			case "clear":
				dateFilter.Clear();
				break;
			default:
				toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	}
	var menuOptions =
		{
			alias: "cmroot_calendar", width: 200, items:
			[
				{ text: "Filter by Date Range", icon: "", alias: "select", action: onContextMenuAction }
				, { text: "Today Only", icon: "", alias: "today", action: onContextMenuAction }
				, { text: "Clear Filter", icon: "", alias: "clear", action: onContextMenuAction }

			]
			, clickType: "right"
		};
	$("#dateRange").contextmenu(menuOptions);
}
///////////////////////////////////////////////////////////////
// Clip list Context Menu /////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipListContextMenu()
{
	var self = this;
	var allSelectedClipIDs = [];
	var flagEnable = false;

	var onShowMenu = function (menu)
	{
		var itemsToEnable = ["flag", "download", "delete"];
		var itemsToDisable = [];
		if (clipLoader.GetAllSelected().length > 1)
			itemsToDisable.push("properties");
		else
			itemsToEnable.push("properties");
		menu.applyrule({ name: "disable_items", disable: true, items: itemsToDisable });
		menu.applyrule({ name: "enable_items", disable: false, items: itemsToEnable });

	}
	var onTriggerContextMenu = function (e)
	{
		var downloadClipButton = $("#cm_cliplist_download").closest(".b-m-item");
		if (downloadClipButton.parent().attr("id") != "cmroot_cliplist_downloadcliplink")
			downloadClipButton.wrap('<a id="cmroot_cliplist_downloadcliplink" style="display:block" href="javascript:void(0)" target="_blank"></a>');
		var $dl_link = $("#cmroot_cliplist_downloadcliplink");

		var clipId = e.currentTarget.id.substr(1);
		if (!clipLoader.IsClipSelected(clipId))
		{
			clipLoader.UnselectAllClips();
			clipLoader.SelectClipIdNoOpen(clipId);
		}

		allSelectedClipIDs = clipLoader.GetAllSelected();

		flagEnable = false; // Turn all off, but if one is already off, then turn all on.
		for (var i = 0; i < allSelectedClipIDs.length; i++)
		{
			var clipData = clipLoader.GetClipFromId(allSelectedClipIDs[i]);
			if (clipData && !clipLoader.ClipDataIndicatesFlagged(clipData))
			{
				flagEnable = true;
				break;
			}
		}

		if (allSelectedClipIDs.length == 1)
		{
			var clipData = clipLoader.GetClipFromId(allSelectedClipIDs[0]);

			$("#cm_cliplist_flag").text(flagEnable ? "Flag" : "Unflag");
			if (clipData.fileSize)
				$("#cm_cliplist_download").text("Download (" + htmlEncode(clipData.fileSize) + ")");
			else
				$("#cm_cliplist_download").text("Download");
			$("#cm_cliplist_delete").text("Delete");

			var clipInfo = clipLoader.GetDownloadClipInfo(clipData);
			$dl_link.attr("href", clipInfo.href);
			if (clipInfo.download)
				$dl_link.attr("download", clipInfo.download);
			else
				$dl_link.removeAttr("download");
		}
		else if (allSelectedClipIDs.length > 1)
		{
			var label = " " + allSelectedClipIDs.length + " " + (currentPrimaryTab == "clips" ? "clips" : "alerts");
			$("#cm_cliplist_flag").text((flagEnable ? "Flag" : "Unflag") + label);
			$("#cm_cliplist_download").text("Download" + label);
			$("#cm_cliplist_delete").text("Delete" + label);
			$dl_link.attr("href", "javascript:void(0)");
			$dl_link.removeAttr("download");
		}
		return true;
	}
	var onContextMenuAction = function ()
	{
		switch (this.data.alias)
		{
			case "flag":
				if (!sessionManager.IsAdministratorSession())
				{
					openLoginDialog();
					return;
				}
				if (allSelectedClipIDs.length <= 12)
					clipLoader.Multi_Flag(allSelectedClipIDs, flagEnable);
				else
					AskYesNo("Confirm " + (flagEnable ? "flag" : "unflag") + " of " + allSelectedClipIDs.length + " " + (currentPrimaryTab == "clips" ? "clip" : "alert") + (allSelectedClipIDs.length == 1 ? "" : "s") + "?", function ()
					{
						clipLoader.Multi_Flag(allSelectedClipIDs, flagEnable);
					});
				break;
			case "download":
				if (allSelectedClipIDs.length == 1)
					return true;
				else
					clipDownloadDialog.open(allSelectedClipIDs);
				break;
			case "delete":
				if (!sessionManager.IsAdministratorSession())
				{
					openLoginDialog();
					return;
				}
				AskYesNo("Confirm deletion of " + allSelectedClipIDs.length + " " + (currentPrimaryTab == "clips" ? "clip" : "alert") + (allSelectedClipIDs.length == 1 ? "" : "s") + "?", function ()
				{
					clipLoader.Multi_Delete(allSelectedClipIDs);
				});
				break;
			case "properties":
				if (allSelectedClipIDs.length >= 1)
					clipProperties.open(allSelectedClipIDs[0]);
				else
					toaster.Warning("No " + (currentPrimaryTab == "clips" ? "clip" : "alert") + " is selected.");
				break;
			default:
				toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	}
	var menuOptions =
		{
			alias: "cmroot_cliplist", width: 200, items:
			[
				{ text: '<span id="cm_cliplist_flag">Flag</span>', icon: "#svg_x5F_Flag", iconClass: "", alias: "flag", action: onContextMenuAction }
				, { text: '<span id="cm_cliplist_download">Download</span>', icon: "#svg_x5F_Download", alias: "download", action: onContextMenuAction }
				, { text: '<span id="cm_cliplist_delete">Delete</span>', icon: "#svg_mio_Trash", iconClass: "noflip", alias: "delete", action: onContextMenuAction }
				, { type: "splitLine" }
				, { text: "Properties", icon: "#svg_x5F_Viewdetails", alias: "properties", action: onContextMenuAction }

			]
			, clickType: "right"
			, onContextMenu: onTriggerContextMenu
			, onShow: onShowMenu
		};
	this.AttachContextMenu = function ($ele)
	{
		$ele.contextmenu(menuOptions);
	}
}
///////////////////////////////////////////////////////////////
// Generic Enable/Disable Item Context Menu ///////////////////
///////////////////////////////////////////////////////////////
function GetUi3FeatureEnabled(uniqueSettingsId)
{
	return settings.getItem("ui3_feature_enabled_" + uniqueSettingsId) == "1";
}
function SetUi3FeatureEnabled(uniqueSettingsId, enabled)
{
	return settings.setItem("ui3_feature_enabled_" + uniqueSettingsId, enabled ? "1" : "0");
}
function ContextMenu_EnableDisableItem(selector, uniqueSettingsId, itemName, onToggle, extraMenuButtons, shouldDisableToggler, labels)
{
	var self = this;
	var onShowContextMenu = function (menu)
	{
		var itemsToDisable = [];
		var itemsToEnable = [];
		if (shouldDisableToggler && shouldDisableToggler())
			itemsToDisable.push("toggle");
		else
			itemsToEnable.push("toggle");
		if (extraMenuButtons)
			for (var i = 0; i < extraMenuButtons.length; i++)
				if (extraMenuButtons[i].shouldDisable && extraMenuButtons[i].shouldDisable())
					itemsToDisable.push(uniqueSettingsId + '_extra_alias_' + i);
				else
					itemsToEnable.push(uniqueSettingsId + '_extra_alias_' + i);
		menu.applyrule({ name: "enable_items_" + uniqueSettingsId, disable: false, items: itemsToEnable });
		menu.applyrule({ name: "disable_items_" + uniqueSettingsId, disable: true, items: itemsToDisable });
	};
	var onTriggerContextMenu = function (e)
	{
		// Set text for Enable/Disable button
		var label = $("#cmToggleLabel_" + uniqueSettingsId);
		if (GetUi3FeatureEnabled(uniqueSettingsId))
			label.html(labels[1]);
		else
			label.html(labels[0]);
		// Set text for Extra buttons.
		if (extraMenuButtons)
			for (var i = 0; i < extraMenuButtons.length; i++)
				$("#" + uniqueSettingsId + "_extra_" + i).html(extraMenuButtons[i].getName(e.currentTarget));
		return true;
	};
	var onContextMenuAction = function (ele)
	{
		switch (this.data.alias)
		{
			case "toggle":
				var enabled = !GetUi3FeatureEnabled(uniqueSettingsId);
				SetUi3FeatureEnabled(uniqueSettingsId, enabled);
				if (onToggle)
					onToggle(enabled);
				break;
			default:
				if (extraMenuButtons && this.data.alias.startsWith(uniqueSettingsId + '_extra_alias_'))
				{
					var i = parseInt(this.data.alias.substr((uniqueSettingsId + '_extra_alias_').length));
					if (!isNaN(i) && i >= 0 && i < extraMenuButtons.length)
						extraMenuButtons[i].action(ele);
				}
				else
					toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	};
	var menuItemArray = [{ text: '<span id="cmToggleLabel_' + uniqueSettingsId + '">' + labels[2] + '</span> ' + itemName + "&nbsp;", icon: "", alias: "toggle", action: onContextMenuAction }];
	if (extraMenuButtons)
		for (var i = 0; i < extraMenuButtons.length; i++)
		{
			var btnDef = extraMenuButtons[i];
			menuItemArray.push({ text: '<span id="' + uniqueSettingsId + '_extra_' + i + '">Extra ' + i + '</span>', icon: "", alias: uniqueSettingsId + '_extra_alias_' + i, action: onContextMenuAction });
		}
	var menuOptions =
		{
			alias: "cmroot_" + uniqueSettingsId
			, width: "auto"
			, items: menuItemArray
			, onContextMenu: onTriggerContextMenu
			, onShow: onShowContextMenu
			, clickType: "right"
		};
	$(selector).contextmenu(menuOptions);
	if (onToggle)
		onToggle(GetUi3FeatureEnabled(uniqueSettingsId));
}
///////////////////////////////////////////////////////////////
// Get / Set Camera Config ////////////////////////////////////
///////////////////////////////////////////////////////////////
function CameraConfig()
{
	this.get = function (camId, successCallbackFunc, failCallbackFunc)
	{
		ExecJSON({ cmd: "camconfig", camera: camId }, function (response)
		{
			if (typeof response.result == "undefined")
			{
				toaster.Error("Unexpected response when getting camera configuration from server.");
				return;
			}
			if (response.result == "fail")
			{
				if (failCallbackFunc)
					failCallbackFunc(camId);
				openLoginDialog();
				return;
			}
			if (successCallbackFunc)
				successCallbackFunc(response, camId);
		}, function ()
			{
				if (failCallbackFunc)
					failCallbackFunc(camId);
			});
	}
	this.set = function (camId, key, value, successCallbackFunc, failCallbackFunc)
	{
		var args = { cmd: "camconfig", camera: camId };
		if (key == "manrec")
			args.manrec = value;
		else if (key == "reset")
			args.reset = value;
		else if (key == "enable")
			args.enable = value;
		else if (key == "pause")
			args.pause = value;
		else if (key == "motion")
			args.motion = value;
		else if (key == "schedule")
			args.schedule = value;
		else if (key == "ptzcycle")
			args.ptzcycle = value;
		else if (key == "ptzevents")
			args.ptzevents = value;
		else if (key == "alerts")
			args.alerts = value;
		else if (key == "record")
			args.record = value;
		else if (key == "push")
			args.push = value;
		else if (key == "output")
			args.output = value;
		else if (key.startsWith("setmotion."))
		{
			args.setmotion = {};
			if (key == "setmotion.audio_trigger")
				args.setmotion.audio_trigger = value;
			else if (key == "setmotion.audio_sense")
				args.setmotion.audio_sense = value;
			else if (key == "setmotion.usemask")
				args.setmotion.usemask = value;
			else if (key == "setmotion.sense")
				args.setmotion.sense = value;
			else if (key == "setmotion.contrast")
				args.setmotion.contrast = value;
			else if (key == "setmotion.showmotion")
				args.setmotion.showmotion = value;
			else if (key == "setmotion.shadows")
				args.setmotion.shadows = value;
			else if (key == "setmotion.luminance")
				args.setmotion.luminance = value;
			else if (key == "setmotion.objects")
				args.setmotion.objects = value;
			else if (key == "setmotion.maketime")
				args.setmotion.maketime = value;
			else if (key == "setmotion.breaktime")
				args.setmotion.breaktime = value;
			else
			{
				toaster.Error('Unknown camera configuration key: ' + htmlEncode(key), 3000);
				return;
			}
		}
		else
		{
			toaster.Error('Unknown camera configuration key: ' + htmlEncode(key), 3000);
			return;
		}
		ExecJSON(args, function (response)
		{
			if (typeof response.result == "undefined")
			{
				toaster.Error("Unexpected response when setting camera configuration on server.");
				return;
			}
			if (response.result == "fail")
			{
				openLoginDialog();
				return;
			}
			console.log('CameraConfig Set ("' + htmlEncode(camId) + '", "' + htmlEncode(key) + '", "' + htmlEncode(value) + '")');
			if (successCallbackFunc)
				successCallbackFunc(response, camId, key, value);
		}, function ()
			{
				if (failCallbackFunc)
					failCallbackFunc(camId, key, value);
				else
					toaster.Warning("Failed to set camera configuration!");
			});
	}
}
///////////////////////////////////////////////////////////////
// Camera List Dialog /////////////////////////////////////////
///////////////////////////////////////////////////////////////
function CameraListDialog()
{
	var self = this;
	var modal_cameralistdialog = null;
	var timeBetweenCameraListThumbUpdates = 1000 * 60 * 60 * 24; // 1 day
	this.open = function ()
	{
		CloseCameraListDialog();
		modal_cameralistdialog = $('<div id="cameralistdialog"><div class="cameralisttitle">' + htmlEncode($("#system_name").text()) + ' Camera List <div id="camlist_refresh_btn" class="rotating_refresh_btn noflip spin2s"><svg class="icon"><use xlink:href="#svg_mio_Refresh"></use></svg></div></div>'
			+ '<div id="cameralistcontent" class="cameralistcontent"></div></div>'
		).modal({ removeElementOnClose: true, onClosing: DialogClosing });

		$("#camlist_refresh_btn").click(function () { self.open(); });

		BI_CustomEvent.AddListener("CameraListLoaded", CameraListLoaded);

		cameraListLoader.LoadCameraList();
	}
	var CameraListLoaded = function ()
	{
		$("#camlist_refresh_btn").removeClass("spin2s");
		var $cameralistcontent = $("#cameralistcontent");
		if ($cameralistcontent.length == 0)
			return;
		$cameralistcontent.empty();
		var lastCameraListResponse = cameraListLoader.GetLastResponse();
		if (!lastCameraListResponse || !lastCameraListResponse.data || lastCameraListResponse.data.length == 0)
		{
			$cameralistcontent.html("The camera list is empty! Please try reloading the page.");
			return;
		}
		// Add camera boxes
		for (var i = 0; i < lastCameraListResponse.data.length; i++)
		{
			var cam = lastCameraListResponse.data[i];
			if (!cameraListLoader.CameraIsGroupOrCycle(cam))
			{
				$cameralistcontent.append('<div class="camlist_item">'
					+ GetCameraListLabel(cam)
					+ '</div>');
			}
		}
		// Finish up
		$cameralistcontent.append('<div></div>'
			+ '<div class="camlist_item_center"><input type="button" class="simpleTextButton btnTransparent" onclick="cameraListDialog.UpdateCameraThumbnails(true)" value="force refresh thumbnails" title="Thumbnails otherwise update only once per day" />'
			+ (developerMode ? ' <input type="button" class="simpleTextButton btnTransparent" onclick="cameraListDialog.ShowRawCameraList()" value="view raw data" />' : '')
			+ '</div>');
		self.UpdateCameraThumbnails();
	}
	var DialogClosing = function ()
	{
		BI_CustomEvent.RemoveListener("CameraListLoaded", CameraListLoaded);
	}
	var CloseCameraListDialog = function ()
	{
		if (modal_cameralistdialog != null)
			modal_cameralistdialog.close();
		$("#cameralistdialog").remove();
	}
	this.ShowRawCameraList = function ()
	{
		$('<div class="cameralistcontent selectable"></div>').append(ArrayToHtmlTable(cameraListLoader.GetLastResponse().data)).modal({ removeElementOnClose: true });
	}
	var GetCameraListLabel = function (cam)
	{
		var labelText = cam.optionDisplay + " (" + cam.optionValue + ")";
		var colorHex = BlueIrisColorToCssColor(cam.color);
		var nameColorHex = GetReadableTextColorHexForBackgroundColorHex(colorHex);

		var floatingBadges = '';
		if (cam.isPaused)
			floatingBadges += '<div class="icon16" style="color:#FFFF00;" title="paused"><svg class="icon"><use xlink:href="#svg_x5F_Stoplight"></use></svg></div>';
		if (cam.isRecording)
			floatingBadges += '<div class="icon16" style="color:#FF0000;" title="recording"><svg class="icon"><use xlink:href="#svg_x5F_Stoplight"></use></svg></div>';
		if (cam.isAlerting)
			floatingBadges += '<div class="icon16" style="color:#FF0000;" title="alerting"><svg class="icon"><use xlink:href="#svg_x5F_Alert1"></use></svg></div>';
		if (cam.isEnabled && (!cam.isOnline || cam.isNoSignal))
			floatingBadges += '<div class="icon16" style="color:#FF0000;" title="offline / no signal"><svg class="icon"><use xlink:href="#svg_x5F_Warning"></use></svg></div>';
		if (!cam.isEnabled)
			floatingBadges += '<div class="icon16" style="color:#FF0000;" title="disabled"><svg class="icon"><use xlink:href="#svg_x5F_Logout"></use></svg></div>';
		if (floatingBadges != '')
			floatingBadges = '<div style="float: right;">' + floatingBadges + '</div>';

		return '<div class="camlist_thumbbox" onclick="cameraListDialog.camListThumbClick(\'' + cam.optionValue + '\')" style="background-color: #' + colorHex + ';">'
			+ '<div class="camlist_thumb">'
			+ '<div class="camlist_thumb_aligner"></div>'
			+ '<div class="camlist_thumb_helper"><img src="" alt="" class="camlist_thumb_img" camid="' + cam.optionValue + '" isEnabled="' + (cam.isEnabled ? '1' : '0') + '" aspectratio="' + (cam.width / cam.height) + '" />'
			+ '<span style="display:none;">No Image</span></div></div>'
			+ '<div class="camlist_label" style="background-color: #' + colorHex + '; color: #' + nameColorHex + ';">' + floatingBadges + htmlEncode(labelText) + '</div>'
			+ '</div>';
	}
	this.camListThumbClick = function (camId)
	{
		cameraProperties.open(camId);
	}
	this.UpdateCameraThumbnails = function (overrideImgDate)
	{
		$("#cameralistcontent").find("img.camlist_thumb_img").each(function (idx, ele)
		{
			var $ele = $(ele);
			var camId = $ele.attr("camId");
			var settingsKey = "ui3_camlistthumb_" + camId;
			var imgData = settings.getItem(settingsKey);
			if (imgData != null && imgData.length > 0)
			{
				$ele.attr("src", imgData);
				$ele.css("display", "block");
				$ele.parent().parent().find(".camlist_thumb_aligner").css("height", "120px");
			}
			else
			{
				$ele.next('span').show();
			}
			if ($ele.attr('isEnabled') == '1')
			{
				var imgDate = settings.getItem(settingsKey + "_date");
				if (!imgDate)
					imgDate = 0;
				if (imgDate + timeBetweenCameraListThumbUpdates < new Date().getTime() || overrideImgDate)
				{
					var sizeArg = "&w=160";
					if (parseFloat($ele.attr("aspectratio")) < (160 / 120))
						sizeArg = "&h=120";
					var tmpImgSrc = currentServer.remoteBaseURL + "image/" + camId + '?time=' + new Date().getTime() + sizeArg + "&q=50" + currentServer.GetRemoteSessionArg("&", true);
					PersistImageFromUrl(settingsKey, tmpImgSrc, function (imgAsDataURL)
					{
						settings.setItem(settingsKey + "_date", new Date().getTime())
						$ele.next('span').hide();
						$ele.attr("src", imgAsDataURL);
						$ele.css("display", "block");
						$ele.parent().parent().find(".camlist_thumb_aligner").css("height", "120px");
					}
						, function (message)
						{
							settings.setItem(settingsKey + "_date", new Date().getTime())
						});
				}
			}
		});
	}
}
///////////////////////////////////////////////////////////////
// Camera Properties Dialog ///////////////////////////////////
///////////////////////////////////////////////////////////////
function CameraProperties()
{
	var self = this;
	var modal_cameraPropDialog = null;
	this.open = function (camId)
	{
		CloseCameraProperties();

		var camName = cameraListLoader.GetCameraName(camId);
		modal_cameraPropDialog = $('<div id="campropdialog"><div class="campropheader">'
			+ '<div class="camproptitle">' + htmlEncode(camName)
			+ ' Properties <div id="camprop_refresh_btn" class="rotating_refresh_btn noflip spin2s"><svg class="icon"><use xlink:href="#svg_mio_Refresh"></use></svg></div></div>'
			+ '</div>'
			+ '<div id="campropcontent"><div style="text-align: center">Loading...</div></div>'
			+ '</div>'
		).modal({
			removeElementOnClose: true
			, maxWidth: 500
			, onClosing: function ()
			{
				if ($("#cameralistcontent").length != 0)
					cameraListLoader.LoadCameraList();
			}
		});
		$("#camprop_refresh_btn").click(function ()
		{
			self.open(camId);
		});
		cameraConfig.get(camId, function (response)
		{
			$("#camprop_refresh_btn").removeClass("spin2s");
			var $camprop = $("#campropcontent");
			$camprop.empty();
			if ($camprop.length == 0)
				return;
			/* Example Response
			{
			  "result": "success",
			  "session": "...",
			  "data": {
				"pause": 0,
				"push": false,
				"motion": true,
				"schedule": false,
				"ptzcycle": false,
				"ptzevents": false,
				"alerts": 0,
				"output": false,
				"setmotion": {
				  "audio_trigger": false,
				  "audio_sense": 10000,
				  "usemask": true,
				  "sense": 8650,
				  "contrast": 67,
				  "showmotion": 0,
				  "shadows": true,
				  "luminance": false,
				  "objects": true,
				  "maketime": 16,
				  "breaktime": 70
				},
				"record": 2
			  }
			}
			*/
			try
			{
				var cam = cameraListLoader.GetCameraWithId(camId);
				if (cam)
				{
					$camprop.append(GetCameraPropertySectionHeading('info', "Information"));
					var $infoSection = GetCameraPropertySection('info');
					$infoSection.append(GetInfo("ID", cam.optionValue));
					$infoSection.append(GetInfo("Name", cam.optionDisplay));
					$infoSection.append(GetInfo("Status", cam.isEnabled ? ("Enabled, " + (cam.isOnline ? "Online" : "Offline")) : "Disabled"));
					$infoSection.append(GetInfo("Video", cam.width + "x" + cam.height + " @ " + cam.FPS + " FPS"));
					$infoSection.append(GetInfo("Audio", cam.audio ? "Yes" : "No"));
					$infoSection.append(GetInfo("PTZ", cam.ptz ? "Yes" : "No"));
					$camprop.append($infoSection);
				}

				$camprop.append(GetCameraPropertySectionHeading('gs', "General Settings"));
				var $generalSection = GetCameraPropertySection('gs');
				$generalSection.append(GetCamPropCheckbox("schedule|" + camId, "Override Global Schedule", response.data.schedule, camPropOnOffBtnClick));
				$generalSection.append(GetCamPropCheckbox("ptzcycle|" + camId, "PTZ preset cycle", response.data.ptzcycle, camPropOnOffBtnClick));
				$generalSection.append(GetCamPropCheckbox("ptzevents|" + camId, "PTZ event schedule", response.data.ptzevents, camPropOnOffBtnClick));
				$generalSection.append(GetCamPropCheckbox("output|" + camId, "DIO output 1", response.data.output, camPropOnOffBtnClick));
				$generalSection.append(GetCamPropCheckbox("push|" + camId, "Mobile App Push", response.data.push, camPropOnOffBtnClick));
				$generalSection.append('<div class="camprop_item camprop_item_ddl">' + GetCameraPropertyLabel("Record:")
					+ '<select mysetting="record|' + camId + '" onchange="cameraProperties.camPropSelectChange(this)">'
					+ GetHtmlOptionElementMarkup("-1", "Only manually", response.data.record.toString())
					+ GetHtmlOptionElementMarkup("0", "Every X.X minutes", response.data.record.toString())
					+ GetHtmlOptionElementMarkup("1", "Continuously", response.data.record.toString())
					+ GetHtmlOptionElementMarkup("2", "When triggered", response.data.record.toString())
					+ GetHtmlOptionElementMarkup("3", "Triggered + periodically", response.data.record.toString())
					+ '</select>'
					+ '</div>');
				$generalSection.append('<div class="camprop_item camprop_item_ddl">' + GetCameraPropertyLabel("Alerts:")
					+ '<select mysetting="alerts|' + camId + '" onchange="cameraProperties.camPropSelectChange(this)">'
					+ GetHtmlOptionElementMarkup("-1", "Never", response.data.alerts.toString())
					+ GetHtmlOptionElementMarkup("0", "This camera is triggered", response.data.alerts.toString())
					+ GetHtmlOptionElementMarkup("1", "Any camera in group is triggered", response.data.alerts.toString())
					+ GetHtmlOptionElementMarkup("2", "Any camera is triggered", response.data.alerts.toString())
					+ '</select>'
					+ '</div>');
				$camprop.append($generalSection);

				$camprop.append(GetCameraPropertySectionHeading('mt', "Motion/Trigger"));
				var $motionSection = GetCameraPropertySection('mt');
				$motionSection.append(GetCamPropCheckbox("motion|" + camId, "Motion sensor", response.data.motion, camPropOnOffBtnClick));
				$motionSection.append(GetRangeSlider("setmotion.sense|" + camId, "Min. object size: "
					, response.data.setmotion.sense, 1000, 11000, 50, true, motionSenseScalingMethod
					, camPropSliderChanged));
				$motionSection.append(GetRangeSlider("setmotion.contrast|" + camId, "Min. contrast: "
					, response.data.setmotion.contrast, 12, 84, 1, false, null
					, camPropSliderChanged));
				$motionSection.append(GetRangeSlider("setmotion.maketime|" + camId, "Make time: "
					, response.data.setmotion.maketime, 0, 100, 1, false, timeScalingMethod
					, camPropSliderChanged));
				$motionSection.append(GetRangeSlider("setmotion.breaktime|" + camId, "Break time: "
					, response.data.setmotion.breaktime, 0, 9000, 10, false, timeScalingMethod
					, camPropSliderChanged));
				$motionSection.append(GetCamPropCheckbox("setmotion.objects|" + camId, "Object detection", response.data.setmotion.objects, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.usemask|" + camId, "Mask/hotspot", response.data.setmotion.usemask, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.luminance|" + camId, "Black &amp; white", response.data.setmotion.luminance, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.shadows|" + camId, "Cancel shadows", response.data.setmotion.shadows, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.audio_trigger|" + camId, "Audio trigger enabled", response.data.setmotion.audio_trigger, camPropOnOffBtnClick));
				$motionSection.append(GetRangeSlider("setmotion.audio_sense|" + camId, "Audio Sensitivity: "
					, response.data.setmotion.audio_sense, 0, 32000, 320, false, percentScalingMethod
					, camPropSliderChanged));
				$motionSection.append('<div class="camprop_item camprop_item_ddl">' + GetCameraPropertyLabel("Highlight:")
					+ '<select mysetting="setmotion.showmotion|' + camId + '" onchange="cameraProperties.camPropSelectChange(this)">'
					+ GetHtmlOptionElementMarkup("0", "No", response.data.setmotion.showmotion.toString())
					+ GetHtmlOptionElementMarkup("1", "Motion", response.data.setmotion.showmotion.toString())
					+ GetHtmlOptionElementMarkup("2", "Objects", response.data.setmotion.showmotion.toString())
					+ GetHtmlOptionElementMarkup("3", "Motion + Objects", response.data.setmotion.showmotion.toString())
					+ '</select>'
					+ '</div>');
				$camprop.append($motionSection);

				$camprop.append(GetCameraPropertySectionHeading('mro', "Manual Recording Options"));
				var $manrecSection = GetCameraPropertySection('mro');
				$manrecSection.append('<div class="camprop_item camprop_item_center">'
					+ GetCameraPropertyButtonMarkup("Trigger", "trigger", "largeBtnYellow", camId)
					+ GetCameraPropertyButtonMarkup("Snapshot", "snapshot", "largeBtnBlue", camId)
					+ GetCameraPropertyButtonMarkup("Toggle Recording", "manrec", "largeBtnRed", camId)
					+ '</div>');
				$camprop.append($manrecSection);

				$camprop.append(GetCameraPropertySectionHeading('mgmt', "Camera Management"));
				var $mgmtSection = GetCameraPropertySection('mgmt');
				$mgmtSection.append('<div class="camprop_item camprop_item_center">'
					+ GetCameraPropertyButtonMarkup("Pause", "pause", "largeBtnDisabled", camId)
					+ GetCameraPropertyButtonMarkup("Reset", "reset", "largeBtnBlue", camId)
					+ GetCameraPropertyButtonMarkup("Disable", "disable", "largeBtnRed", camId)
					+ '</div>');
				$camprop.append($mgmtSection);

				if (cam)
				{
					SetCameraPropertyManualRecordButtonState(cam.isRecording);
					SetCameraPropertyEnableButtonState(cam.isEnabled);
				}
			}
			catch (ex)
			{
				toaster.Error(ex);
			}
			if (developerMode)
				$camprop.append('<div class="camprop_item camprop_item_center"><input type="button" class="simpleTextButton btnTransparent" onclick="cameraProperties.OpenRaw(&quot;' + camId + '&quot;)" value="view raw data" /></div>');
		}, function ()
			{
				CloseCameraProperties();
			});
	}
	var GetInfo = function (label, value)
	{
		var $info = $('<div class="camprop_item camprop_item_info"></div>');
		$info.text(label + ": " + value);
		return $info;
	}
	var GetCameraPropertySectionHeading = function (id, html)
	{
		var $heading = $('<div class="camprop_section_heading" mysettingsid="' + id + '">' + html + '</div>');
		$heading.on('click', CameraPropertiesSectionHeadingClick);
		return $heading;
	}
	var GetCameraPropertySection = function (id)
	{
		var $section = $('<div class="camprop_section"></div>');
		if (settings.getItem("ui3_cps_" + id + "_visible") == "0")
			$section.hide();
		return $section;
	}
	var CameraPropertiesSectionHeadingClick = function ()
	{
		var $ele = $(this);
		var $section = $ele.next('.camprop_section');
		$section.slideToggle(
			{
				duration: 150
				, always: function ()
				{
					settings.setItem("ui3_cps_" + $ele.attr('mysettingsid') + "_visible", $section.is(":visible") ? "1" : "0");
				}
			});
	}
	var GetCamPropCheckbox = function (tag, label, checked, onChange)
	{
		var $parent = $('<div class="camprop_item camprop_item_cb"></div>');
		$parent.append(GetCustomCheckbox(tag, label, checked, onChange));
		return $parent;
	}
	var GetRangeSlider = function (tag, label, value, min, max, step, invert, scalingMethod, onChange)
	{
		if (invert)
			value = (max - value) + min;

		if (!scalingMethod)
			scalingMethod = function (v) { return v; };

		var $parent = $('<div class="camprop_item camprop_item_range"></div>');
		$parent.append('<span>' + label + '</span>');

		var $valLabel = $('<span></span>');
		$valLabel.text(scalingMethod(value, min, max));
		$parent.append($valLabel);

		var $range = $('<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" />');
		$range.val(value);
		$parent.append($range);

		var changeTimeout = null;
		var inputCb = function () { $valLabel.text(scalingMethod($range.val(), min, max)); };
		$range.on('input', inputCb); // Raised on every drag
		$range.on('change', function ()
		{
			inputCb();
			// Some browsers, particularly old versions, will raise the 'change' event like the 'input' event
			if (onChange)
			{
				var v = parseInt($range.val());
				if (invert)
					v = (max - v) + min;
				if (changeTimeout != null)
					clearTimeout(changeTimeout);
				changeTimeout = setTimeout(function ()
				{
					changeTimeout = null;
					onChange(tag, v);
				}, 500);
			}
		});
		return $parent;
	}
	var percentScalingMethod = function (value, min, max)
	{
		value -= min;
		var range = max - min;
		if (range == 0)
			value = 0;
		else
			value = parseInt(Math.round((value / range) * 100));
		return value + "%";
	}
	var timeScalingMethod = function (value, min, max)
	{
		return value / 10 + " sec";
	}
	var motionSenseScalingMethod = function (value, min, max)
	{
		return parseInt(value / 10);
	}
	var GetCameraPropertyLabel = function (text)
	{
		return '<div class="camprop_label" title="' + text + '">' + text + '</div>';
	}
	var GetHtmlOptionElementMarkup = function (value, name, selectedValue)
	{
		return '<option value="' + value + '"' + (selectedValue == value ? ' selected="selected"' : '') + '>' + name + '</option>';
	}
	var GetCameraPropertyButtonMarkup = function (text, buttonId, colorClass, camId)
	{
		return '<input type="button" id="camprop_button_' + buttonId + '" class="largeTextButton ' + colorClass + '" onclick="cameraProperties.camPropButtonClick(&quot;' + camId + '&quot;, &quot;' + buttonId + '&quot;)" value="' + text + '" />';
	}
	var CloseCameraProperties = function ()
	{
		if (modal_cameraPropDialog != null)
			modal_cameraPropDialog.close();
		$("#campropdialog").remove();
	}
	var camPropOnOffBtnClick = function (mysetting, buttonStateIsOn)
	{
		var parts = mysetting.split('|');
		var settingName = parts[0];
		var camId = parts[1];
		cameraConfig.set(camId, settingName, buttonStateIsOn);
	}
	var camPropSliderChanged = function (tag, value)
	{
		var parts = tag.split('|');
		var settingName = parts[0];
		var camId = parts[1];
		cameraConfig.set(camId, settingName, value);
	}
	this.camPropSelectChange = function (select)
	{
		var mysetting = $(select).attr("mysetting");
		var parts = mysetting.split('|');
		var settingName = parts[0];
		var camId = parts[1];
		var selectedValue = parseInt(select.value);
		cameraConfig.set(camId, settingName, selectedValue);
	}
	this.camPropButtonClick = function (camId, button)
	{
		switch (button)
		{
			case "trigger":
				TriggerCamera(camId);
				break;
			case "snapshot":
				SaveSnapshotInBlueIris(camId);
				break;
			case "manrec":
				ManualRecordCamera(camId, $("#camprop_button_manrec").attr("start"), SetCameraPropertyManualRecordButtonState);
				break;
			case "reset":
				ResetCamera(camId);
				break;
			case "disable":
				cameraConfig.set(camId, "enable", $("#camprop_button_disable").attr("enabled") != "1"
					, function ()
					{
						SetCameraPropertyEnableButtonState($("#camprop_button_disable").attr("enabled") != "1");
					});
				break;
			case "pause":
			default:
				toaster.Error(button + " not implemented in this UI version");
				break;
		}
	}
	var SetCameraPropertyManualRecordButtonState = function (is_recording)
	{
		if (is_recording)
		{
			$("#camprop_button_manrec").val("Stop Recording");
			$("#camprop_button_manrec").attr("start", "0");
		}
		else
		{
			$("#camprop_button_manrec").val("Start Recording");
			$("#camprop_button_manrec").attr("start", "1");
		}
	}
	var SetCameraPropertyEnableButtonState = function (is_enabled)
	{
		if (is_enabled)
		{
			$("#camprop_button_disable").val("Disable");
			$("#camprop_button_disable").attr("enabled", "1");
			$("#camprop_button_disable").removeClass("largeBtnGreen");
			$("#camprop_button_disable").addClass("largeBtnRed");
		}
		else
		{
			$("#camprop_button_disable").val("Enable");
			$("#camprop_button_disable").attr("enabled", "0");
			$("#camprop_button_disable").removeClass("largeBtnRed");
			$("#camprop_button_disable").addClass("largeBtnGreen");
		}
	}
	this.OpenRaw = function (camId)
	{
		cameraConfig.get(camId, function (response)
		{
			var cam = cameraListLoader.GetCameraWithId(camId);
			objectVisualizer.open({ data: cam, config: response.data }, cam.optionDisplay + " Properties (Raw)");
		}, function ()
			{
				toaster.Warning("Unable to load camera properties for " + camId);
			});
	}
}
///////////////////////////////////////////////////////////////
// Clip Properties Dialog /////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipProperties()
{
	var self = this;
	this.open = function (clipId)
	{
		var clipData = clipLoader.GetClipFromId(clipId);

		var camName = cameraListLoader.GetCameraName(clipData.camera);

		$('<div id="campropdialog">'
			+ '<div class="campropheader">'
			+ '<div class="camproptitle">' + htmlEncode(camName) + ' ' + (clipData.isClip ? "Clip" : "Alert") + ' Properties</div>'
			+ '</div>'
			+ '<div id="campropcontent"></div>'
			+ '</div>'
		).modal({ removeElementOnClose: true, maxWidth: 500, maxHeight: 510 });

		var $camprop = $("#campropcontent");

		try
		{
			var $thumb = $('<img class="clipPropertiesThumb" src="" alt="clip thumbnail"></img>');
			var thumbPath = currentServer.remoteBaseURL + "thumbs/" + clipData.thumbPath + currentServer.GetRemoteSessionArg("?");
			$thumb.attr('src', thumbPath);
			$thumb.css("border-color", "#" + clipData.colorHex);
			$camprop.append($thumb);

			//$camprop.append(GetInfo("Path", clipData.path));
			$camprop.append(GetInfo("Date", GetDateStr(clipData.date)));
			if (clipData.isClip)
				$camprop.append(GetInfo("Real Time", clipData.roughLength).attr("title", "Real Time: Length of real time this clip covers.\nMay be significantly longer than Play Time if created from multiple alerts."));
			$camprop.append(GetInfo("Play Time", msToTime(clipData.msec)));
			if (clipData.isClip)
				$camprop.append(GetInfo("Size", clipData.fileSize));
			else
				$camprop.append(GetInfo("Zones", clipData.rawData.zones));

			var $link = $('<a href="javascript:void(0)">Click here to download the clip.</a>');
			var clipInfo = clipLoader.GetDownloadClipInfo(clipData);
			$link.attr("href", clipInfo.href);
			if (clipInfo.download)
			{
				$link.text(clipInfo.download);
				$link.attr("download", clipInfo.download);
			}
			$camprop.append(GetInfoEleValue("Download", $link));
		}
		catch (ex)
		{
			toaster.Error(ex);
		}
		if (developerMode)
			$camprop.append('<div class="camprop_item camprop_item_center"><input type="button" class="simpleTextButton btnTransparent" onclick="clipProperties.OpenRaw(&quot;' + clipId + '&quot;)" value="view raw data" /></div>');
	}
	var GetInfo = function (label, value)
	{
		var $info = $('<div class="camprop_item clipprop_item_info"></div>');
		$info.text(label + ": " + value);
		return $info;
	}
	var GetInfoEleValue = function (label, ele)
	{
		var $info = $('<div class="camprop_item clipprop_item_info"></div>');
		$info.text(label + ": ").append(ele);
		return $info;
	}
	this.OpenRaw = function (clipId)
	{
		var clipData = clipLoader.GetClipFromId(clipId);
		objectVisualizer.open(clipData, "Clip Properties (raw)");
	}
}
///////////////////////////////////////////////////////////////
// Clip Download Dialog ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipDownloadDialog()
{
	var self = this;
	this.open = function (allSelectedClipIDs)
	{
		$('<div id="campropdialog">'
			+ '<div class="campropheader">'
			+ '<div class="camproptitle">Download Multiple Clips</div>'
			+ '</div>'
			+ '<div id="campropcontent"></div>'
			+ '</div>'
		).modal({ removeElementOnClose: true, maxWidth: 500, maxHeight: 500 });

		var $camprop = $("#campropcontent");
		$camprop.append('<div class="camprop_item clipprop_item_info">Click each link to download the desired clips.</div>');
		$camprop.append('<div class="camprop_item clipprop_item_info">Each link will disappear after it is clicked, so you can\'t accidentally download duplicates.</div>');
		for (var i = 0; i < allSelectedClipIDs.length; i++)
			$camprop.append(GetLink(allSelectedClipIDs[i]));
	}
	var GetLink = function (clipId)
	{
		var clipData = clipLoader.GetClipFromId(clipId);
		var clipInfo = clipLoader.GetDownloadClipInfo(clipData);
		var $link = $('<a href=""></a>');
		$link.attr("href", clipInfo.href);
		if (clipInfo.download)
		{
			$link.text(clipInfo.download);
			$link.attr("download", clipInfo.download);
		}
		else
			$link.text("Click Here");
		$link.click(function ()
		{
			$link.remove();
			return true;
		});
		return $('<div class="camprop_item clipprop_item_info"></div>').append($link);
	}
}
///////////////////////////////////////////////////////////////
// Object/JSON Visualize //////////////////////////////////////
///////////////////////////////////////////////////////////////
var objectVisualizer = new (function ObjectVisualizer()
{
	var self = this;
	var isLoaded = false;
	var isLoading = false;

	this.open = function (obj, title)
	{
		if (!isLoaded)
		{
			if (isLoading)
				setTimeout(function () { self.open(obj, title); }, 500);
			else
			{
				isLoading = true;
				$('<style type="text/css">@import url("ui3/libs-src/jsonview/jsonview.min.css?v=' + combined_version + '")</style>').appendTo("head");
				$.getScript("ui3/libs-src/jsonview/jsonview.min.js?v=" + combined_version)
					.done(function ()
					{
						isLoaded = true;
						self.open(obj, title);
					})
					.fail(function (jqxhr, settings, exception)
					{
						isLoaded = isLoading = false;
						toaster.Error("Unable to load jsonview library.", 5000);
					});
			}
			return;
		}
		var $root = $('<div class="ObjectVisualizer"><div class="campropheader"><div class="camproptitle">' + title + '</div></div></div>');
		var $viewer = $('<div class="selectable" style="word-wrap: break-word; border:1px solid #000000; background-color: #FFFFFF; color: #000000; margin: 10px; padding: 10px;"></div>');
		$root.append($viewer);
		if (obj)
		{
			if (typeof obj == "object")
				$viewer.JSONView(obj);
			else
				$viewer.find(".selectable").text(obj);
		}
		else
			$viewer.find(".selectable").text("null");
		$root.modal({ removeElementOnClose: true, maxWidth: 600 });
	}
})();
///////////////////////////////////////////////////////////////
// Reset Camera ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ResetCamera(camId)
{
	var camName = cameraListLoader.GetCameraName(camId);
	cameraConfig.set(camId, "reset", true, function (response)
	{
		toaster.Success("Camera " + camName + " is restarting");
	}, function ()
		{
			toaster.Error("Camera " + camName + " could not be restarted");
		});
}
///////////////////////////////////////////////////////////////
// Manual Recording Start / Stop //////////////////////////////
///////////////////////////////////////////////////////////////
function ManualRecordCamera(camId, start, successCallback)
{
	if (start == "1")
		start = true;
	else if (start == "0")
		start = false;
	else
	{
		start = false;
		var camData = cameraListLoader.GetCameraWithId(camId);
		if (camData != null)
			start = !camData.isRecording;
	}
	cameraConfig.set(camId, "manrec", start, function ()
	{
		setTimeout(function ()
		{
			cameraListLoader.LoadCameraList(function (camList)
			{
				var camData = cameraListLoader.GetCameraWithId(camId);
				if (camData != null)
				{
					toaster.Info(camData.optionDisplay + " " + (camData.isRecording ? '<span style="font-weight: bold;color:Red; background-color: #000000;">IS RECORDING</span>' : '<span style="font-weight: bold;color:Green; background-color: #000000;">IS NOT RECORDING</span>'));
					if (successCallback)
						successCallback(camData.isRecording);
				}
			});
		}, 250);
	}, function ()
		{
			toaster.Error("Failed to toggle manual recording for " + camId);
		});
}
function LoadDynamicManualRecordingButtonState(camData)
{
	$("#manRecBtnLabel").text("Toggle Recording");
	$("#manRecBtnLabel").removeAttr("start");

	if (!cameraListLoader.CameraIsGroupOrCycle(camData))
	{
		UpdateManRecButtonState(camData.optionValue);
		cameraListLoader.LoadCameraList(function (camList)
		{
			UpdateManRecButtonState(camData.optionValue);
		});
	}
}
function UpdateManRecButtonState(camId)
{
	var camData = cameraListLoader.GetCameraWithId(camId);
	if (camData != null)
	{
		if (camData.isRecording)
		{
			$("#manRecBtnLabel").text("Stop Recording");
			$("#manRecBtnLabel").attr("start", "0");
			return true;
		}
		else
		{
			$("#manRecBtnLabel").text("Start Recording");
			$("#manRecBtnLabel").attr("start", "1");
			return false;
		}
	}
}
///////////////////////////////////////////////////////////////
// Trigger Camera /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function TriggerCamera(camId)
{
	ExecJSON({ cmd: "trigger", camera: camId }, function (response)
	{
		if (typeof response.result != "undefined" && response.result == "fail")
		{
			openLoginDialog();
			return;
		}
		if (response.result == "success")
			toaster.Success("Triggered camera " + camId);
		else
			toaster.Error("Failed to trigger camera " + camId);
	}, function ()
		{
			toaster.Error("Failed to contact Blue Iris server to trigger camera " + camId);
		});
}
///////////////////////////////////////////////////////////////
// Change Clip Flags State ////////////////////////////////////
///////////////////////////////////////////////////////////////
function UpdateClipFlags(path, flags, cbSuccess, cbFailure)
{
	ExecJSON({ cmd: "update", path: path, flags: flags }, function (response)
	{
		if (typeof response.result != "undefined" && response.result == "fail")
		{
			if (typeof cbFailure == "function")
				cbFailure();
			else
				toaster.Warning("Failed to update clip properties");
			openLoginDialog();
			return;
		}
		else
		{
			if (typeof cbSuccess == "function")
				cbSuccess();
			else
				toaster.Success("Clip properties updated");
		}
	}, function ()
		{
			toaster.Warning("Failed to update clip properties because of a connection failure");
			if (typeof cbFailure == "function")
				cbFailure();
		});
}
///////////////////////////////////////////////////////////////
// Delete Alert/Clip //////////////////////////////////////////
///////////////////////////////////////////////////////////////
function DeleteAlert(path, isClip, cbSuccess, cbFailure)
{
	var clipOrAlert = isClip ? "clip" : "alert";
	ExecJSON({ cmd: "del" + clipOrAlert, path: path }, function (response)
	{
		if (typeof response.result != "undefined" && response.result == "fail")
		{
			if (typeof cbFailure == "function")
				cbFailure();
			else
				toaster.Warning("Failed to delete " + clipOrAlert + ".<br/>" + (sessionManager.IsAdministratorSession() ? ("The " + clipOrAlert + " may be still recording.") : ("You need administrator permission to delete " + clipOrAlert + "s.")), 5000);
			if (!sessionManager.IsAdministratorSession())
				openLoginDialog();
			return;
		}
		else
		{
			if (typeof cbSuccess == "function")
				cbSuccess();
			else
				toaster.Success(clipOrAlert + " deleted");
		}
	}, function ()
		{
			if (typeof cbFailure == "function")
				cbFailure();
			else
				toaster.Error('Unable to contact Blue Iris server.', 3000);
		});
}
///////////////////////////////////////////////////////////////
// Custom Checkboxes //////////////////////////////////////////
///////////////////////////////////////////////////////////////
var customCheckboxId = 0;
function GetCustomCheckbox(tag, label, checked, onChange)
{
	var myId = customCheckboxId++;
	var $wrapper = $('<div class="customCheckboxWrapper"></div>');
	var $cb = $('<input id="ccb_' + myId + '" type="checkbox" ' + (checked ? 'checked="checked" ' : '') + '/>');
	$cb.on('change', function () { onChange(tag, $(this).is(":checked")); });
	$wrapper.append($cb);
	$wrapper.append('<label for="ccb_' + myId + '"><span class="ui"></span>' + label + '<div class="customCheckboxSpacer"></div></label>');
	return $wrapper;
}
///////////////////////////////////////////////////////////////
// Get System Configuration ///////////////////////////////////
///////////////////////////////////////////////////////////////
function SystemConfig()
{
	var self = this;
	var modal_systemconfigdialog = null;
	this.open = function ()
	{
		if ($("#sysconfigdialog").length == 0)
			ShowSysConfigDialog();
		var $sysconfig = $("#sysconfigcontent");
		if ($sysconfig.length == 0)
			return;
		$sysconfig.html('<div style="text-align: center"><img src="ui2/ajax-loader-clips.gif" alt="Loading..." /></div>');
		ExecJSON({ cmd: "sysconfig" }, function (response)
		{
			if (typeof response.result == "undefined")
			{
				CloseSysConfigDialog();
				toaster.Error("Unexpected response when requesting system configuration from server.");
				return;
			}
			if (response.result == "fail")
			{
				CloseSysConfigDialog();
				openLoginDialog();
				return;
			}
			var $sysconfig = $("#sysconfigcontent");
			if ($sysconfig.length == 0)
				return;
			$sysconfig.empty();
			$sysconfig.append(GetCustomCheckbox('archive', "Clip Web Archival (FTP)", response.data.archive, SetSysConfig));
			$sysconfig.append(GetCustomCheckbox('schedule', "Global Schedule", response.data.schedule, SetSysConfig));
		}, function ()
			{
				toaster.Error('Unable to contact Blue Iris server.', 3000);
				CloseSysConfigDialog();
			});
	}
	var ShowSysConfigDialog = function ()
	{
		CloseSysConfigDialog();
		modal_systemconfigdialog = $('<div id="sysconfigdialog"><div class="sysconfigtitle">' + htmlEncode($("#system_name").text()) + ' System Configuration</div>'
			+ '<div id="sysconfigcontent"></div></div>'
		).modal({ removeElementOnClose: true, maxWidth: 400, maxHeight: 350 });
	}
	var CloseSysConfigDialog = function ()
	{
		if (modal_systemconfigdialog != null)
			modal_systemconfigdialog.close();
		$("#sysconfigdialog").remove();
	}
	var SetSysConfig = function (key, value)
	{
		var args = { cmd: "sysconfig" };
		if (key == "archive")
			args.archive = value;
		else if (key == "schedule")
			args.schedule = value;
		else
		{
			toaster.Error('Unknown system configuration key: ' + htmlEncode(key), 3000);
			return;
		}
		ExecJSON(args, function (response)
		{
			if (typeof response.result == "undefined")
			{
				toaster.Error("Unexpected response when attempting to set system configuration on server.");
				return;
			}
			if (response.result == "fail")
			{
				openLoginDialog();
				return;
			}
			toaster.Success('Set configuration field "' + htmlEncode(key) + '" = "' + htmlEncode(value) + '"');
		}, function ()
			{
				toaster.Error('Unable to contact Blue Iris server to set ' + htmlEncode(key) + ' value.', 3000);
			});
	}
}
///////////////////////////////////////////////////////////////
// System Log /////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function SystemLog()
{
	var self = this;
	var modal_systemlogdialog = null;
	this.open = function ()
	{
		if ($("#systemlogdialog").length == 0)
			ShowLogDialog();
		var $syslog = $("#systemlogcontent");
		if ($syslog.length == 0)
			return;
		$syslog.html('<div style="text-align: center; margin-top: 20px;">Loading...</div>');
		$("#systemlog_refresh_btn").addClass("spin2s");
		ExecJSON({ cmd: "log" }, function (response)
		{
			if (typeof response.result == "undefined")
			{
				CloseLogDialog();
				toaster.Error("Unexpected response when requesting system log from server.");
				return;
			}
			if (response.result == "fail")
			{
				CloseLogDialog();
				openLoginDialog();
				return;
			}
			var $syslog = $("#systemlogcontent");
			if ($syslog.length == 0)
				return;
			$("#systemlog_refresh_btn").removeClass("spin2s");
			$syslog.html('<table><thead><tr><th></th><th>#</th><th>Time</th><th>Object</th><th>Message</th></tr></thead><tbody></tbody></table>');
			var $tbody = $syslog.find("tbody");
			for (var i = 0; i < response.data.length; i++)
			{
				var data = response.data[i];
				var date = new Date(data.date * 1000)
				var dateStr = GetDateStr(date);
				var level = GetLevelImageMarkup(data.level);
				var count = typeof data.count == "undefined" ? "" : data.count;
				$tbody.append('<tr><td class="levelcolumn">' + level + '</td><td class="centercolumn" style="font-weight: bold;">' + count + '</td><td>' + dateStr + '</td><td style="font-weight: bold;">' + htmlEncode(data.obj) + '</td><td>' + htmlEncode(data.msg) + '</td></tr>');
			}
		}, function ()
			{
				toaster.Error('Unable to contact Blue Iris server.', 3000);
				CloseLogDialog();
			});
	}
	var GetLevelImageMarkup = function (level)
	{
		if (level == 0)
			return GetLogIcon("#svg_x5F_Info", "#0088FF");
		if (level == 1)
			return GetLogIcon("#svg_x5F_Warning", "#FFFF00");
		if (level == 2)
			return GetLogIcon("#svg_x5F_Error", "#FF0000");
		if (level == 3)
			return GetLogIcon("#svg_x5F_Alert1", "#FF0000");
		if (level == 4)
			return GetLogIcon("#svg_x5F_OK", "#00FF00");
		if (level == 10)
			return GetLogIcon("#svg_x5F_User", "#FFFFFF");
		return '<span title="Log level ' + level + ' is unknown">' + level + '</span>';
	}
	var GetLogIcon = function (iconId, color)
	{
		return '<div class="logicon" style="color: ' + color + '"><svg class="icon"><use xlink:href="' + iconId + '"></use></svg></div>';
	}
	var ShowLogDialog = function ()
	{
		CloseLogDialog();
		modal_systemlogdialog = $('<div id="systemlogdialog"><div class="syslogheader">'
			+ '<div class="systemlogtitle">' + $("#system_name").text()
			+ ' System Log <div id="systemlog_refresh_btn" class="rotating_refresh_btn noflip" onclick="systemLog.open()"><svg class="icon"><use xlink:href="#svg_mio_Refresh"></use></svg></div>'
			+ '</div></div>'
			+ '<div id="systemlogcontent"></div></div>'
		).modal({ removeElementOnClose: true });
	}
	var CloseLogDialog = function ()
	{
		if (modal_systemlogdialog != null)
			modal_systemlogdialog.close();
		$("#systemlogdialog").remove();
	}
}
///////////////////////////////////////////////////////////////
// Save Snapshot in Blue Iris /////////////////////////////////
///////////////////////////////////////////////////////////////
function SaveSnapshotInBlueIris(camId)
{
	if (currentServer.isLoggingOut)
		return;
	$.ajax(currentServer.remoteBaseURL + "cam/" + camId + "/pos=100" + currentServer.GetRemoteSessionArg("?"))
		.done(function (response)
		{
			if (response.indexOf(">Ok<") != -1)
				toaster.Success("Blue Iris saved a snapshot for camera " + camId);
			else
				toaster.Error("Blue Iris did not save a snapshot for camera " + camId);
		})
		.fail(function ()
		{
			toaster.Error("Blue Iris did not save a snapshot for camera " + camId);
		});
}
///////////////////////////////////////////////////////////////
// About Dialog ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function openAboutDialog()
{
	$("#aboutDialog").modal({ maxWidth: 550, maxHeight: 600 });
}
///////////////////////////////////////////////////////////////
// Login Dialog ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var loginModal = null;
function openLoginDialog()
{
	if (settings.bi_rememberMe == "1")
	{
		$('#loginDialog input[type="text"][varname="user"]').val(Base64.decode(settings.bi_username));
		$('#loginDialog input[type="password"][varname="pass"]').val(Base64.decode(settings.bi_password));
		$("#cbRememberMe").prop("checked", true);
	}
	else
		$("#cbRememberMe").prop("checked", false);
	loginModal = $("#loginDialog").modal({ maxWidth: 500, maxHeight: 325 });
}
function closeLoginDialog()
{
	if (loginModal != null)
	{
		loginModal.close();
		loginModal = null;
	}
}
///////////////////////////////////////////////////////////////
// Audio Playback /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function AudioPlayer()
{
	var self = this;
	var $audiosourceobj = $("#audiosourceobj");
	var audioobj = $("#audioobj").get(0);
	var muteStopTimeout = null;

	this.SetVolume = function (newVolume)
	{
		newVolume = Clamp(newVolume, 0, 1);
		clearMuteStopTimeout();
		audioobj.volume = newVolume;
		if (newVolume == 0)
			muteStopTimeout = setTimeout(function () { self.audioStop(); }, 1000);
		else
			self.audioPlay();
	}
	this.GetVolume = function ()
	{
		return Clamp(audioobj.volume, 0, 1);
	}

	var clearMuteStopTimeout = function ()
	{
		if (muteStopTimeout != null)
		{
			clearTimeout(muteStopTimeout);
			muteStopTimeout = null;
		}
	}
	this.audioPlay = function ()
	{
		// Plays audio for the current live camera if it is not already playing
		if (!videoPlayer)
			return;
		if (!videoPlayer.Loading().image.audio || self.GetVolume() == 0)
		{
			self.audioStop();
			return;
		}
		if (currentServer.isLoggingOut)
			return;
		var newSrc = currentServer.remoteBaseURL + "audio/" + videoPlayer.Loading().image.id + "/temp.wav" + currentServer.GetRemoteSessionArg("?", true);
		if ($audiosourceobj.attr("src") != newSrc)
		{
			$audiosourceobj.attr("src", newSrc);
			audioobj.load();
			audioobj.play()["catch"](function (e) { }); // .catch == ["catch"], but .catch is invalid in IE 8-
		}
	}
	this.audioStop = function ()
	{
		if (!videoPlayer)
			return;
		// Stops audio if it is playing
		$("#volumeBar").css("color", "#969BA7");
		if ($audiosourceobj.attr("src") != "")
		{
			$audiosourceobj.attr("src", "");
			try
			{
				audioobj.load();
			}
			catch (ex)
			{
			}
		}
	}

	$(audioobj).on('abort error stalled suspend', function (e)
	{
		$("#volumeBar").css("color", "#F00000");
	});
	$(audioobj).on('waiting', function (e)
	{
		$("#volumeBar").css("color", "#F0F000");
	});
	$(audioobj).on('play playing', function (e)
	{
		$("#volumeBar").css("color", "#00F000");
	});
	$(audioobj).on('emptied ended pause', function (e)
	{
		$("#volumeBar").css("color", "#969BA7");
	});
}
///////////////////////////////////////////////////////////////
// Save Snapshot Button ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function saveSnapshot(btnSelector)
{
	if (typeof btnSelector == "undefined")
		btnSelector = "#save_snapshot_btn";
	var camName = cameraListLoader.GetCameraName(videoPlayer.Loading().image.id);
	var date = GetDateStr(new Date(videoPlayer.GetCurrentImageTimeMs()), true);
	date = date.replace(/\//g, '-').replace(/:/g, '.');
	var fileName = camName + " " + date + ".jpg";
	$(btnSelector).attr("download", fileName);
	$(btnSelector).attr("href", videoPlayer.GetLastSnapshotUrl());
	setTimeout(function ()
	{
		$(btnSelector).attr("download", "temp.jpg");
		$(btnSelector).attr("href", "javascript:void(0)");
	}, 0);
}
///////////////////////////////////////////////////////////////
// HLS H264 Streaming with Clappr /////////////////////////////
///////////////////////////////////////////////////////////////
function HLSPlayer()
{
	var self = this;
	var initStarted = false; // True if script loading has begun.
	var initFinished = false; // True if script loading has succeeded or failed.
	var initSucceeded = false; // True if script loading has succeeded.
	var dialog = null;
	var container = null;
	var playerObj = null;
	var hlsPlayerLastCamId = "";
	var Initialize = function (camId)
	{
		if (initStarted)
			return;
		$(window).resize(resizeHlsPlayer);
		initStarted = true;
		$.getScript("clappr/clappr.min.js?v=" + combined_version)
			.done(function (script, textStatus)
			{
				initFinished = true;
				initSucceeded = true;
				BeginHlsPlayback(camId);
			})
			.fail(function (jqxhr, settings, exception)
			{
				initFinished = true;
				self.CloseDialog();
				toaster.Error("Failed to load HLS player script.");
			});
	}
	this.OpenDialog = function (camId)
	{
		hlsPlayerLastCamId = camId;
		container = $('<div style="overflow: hidden;"></div>');
		dialog = container.modal(
			{
				removeElementOnClose: true
				, onClosing: function ()
				{
					container = null;
					dialog = null;
					if (playerObj != null)
						playerObj.stop();
					playerObj = null;
				}
			});
		if (!initFinished)
		{
			container.append('<div style="width:50px;height:50px;margin:20px" class="spin2s">'
				+ '<svg class="icon"><use xlink:href="#svg_x5F_Settings"></use></svg>'
				+ '</div>');
			Initialize(camId);
		}
		else
		{
			if (initSucceeded)
				BeginHlsPlayback(camId);
		}
	}
	this.CloseDialog = function ()
	{
		if (dialog != null)
			if (dialog.close())
				dialog = null;
	}
	var BeginHlsPlayback = function (camId)
	{
		if (container != null)
		{
			container.empty();
			container.append('<div id="hlsPlayer"></div>');

			var src = currentServer.remoteBaseURL + "h264/" + camId + "/temp.m3u8" + currentServer.GetRemoteSessionArg("?", true);
			playerObj = new Clappr.Player({ source: src, parentId: "#hlsPlayer", autoPlay: false, disableVideoTagContextMenu: true });
			playerObj.on('error', onHlsError);
			playerObj.on('fullscreen', function ()
			{
				setTimeout(resizeHlsPlayer, 0); setTimeout(resizeHlsPlayer, 100);
			});
			playerObj.play();
			resizeHlsPlayer();

			registerHlsContextMenu($("#hlsPlayer"));
			registerHlsContextMenu($("#hlsPlayer video"));
		}
	}
	var onHlsError = function (obj)
	{
		var description = "Unknown";
		try
		{
			var code = obj.error.code;
			if (code == 1)
				description = "Aborted";
			else if (code == 2)
				description = "Network Error";
			else if (code == 3)
				description = "Decoding Error";
			else if (code == 4)
				description = "Source Not Supported";
		}
		catch (ex)
		{
		}
		toaster.Error("Video player reports error: " + description);
	}
	this.IsBlockingJpegRefresh = function ()
	{
		return dialog != null;
	}
	var resizeHlsPlayer = function ()
	{
		if (container != null && dialog != null)
		{
			var playerSizeObj = container.find('[data-player]');
			playerSizeObj.css('width', dialog.$dialog.width());
			playerSizeObj.css('height', dialog.$dialog.height());
		}
	}
	// Context Menu
	var onHlsContextMenuAction = function ()
	{
		switch (this.data.alias)
		{
			case "newtab":
				self.CloseDialog();
				window.open(currentServer.remoteBaseURL + "livestream.htm?cam=" + encodeURIComponent(hlsPlayerLastCamId));
				break;
			default:
				toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	}
	var optionHls =
		{
			alias: "cmroot_hls", width: 200, items:
			[
				{ text: "Open stream in New Tab", icon: "", alias: "newtab", action: onHlsContextMenuAction }
			]
			, clickType: "right"
		};

	var registerHlsContextMenu = function ($ele)
	{
		$ele.contextmenu(optionHls);
	};
}
///////////////////////////////////////////////////////////////
// FullScreen Mode ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function FullScreenModeController()
{
	var self = this;
	var isFullScreen_cached = false;
	$(document).on("mousemove touchmove", function (e)
	{
		mouseCoordFixer.fix(e);
		var ele = isFullScreen_cached ? $("#liveExitFullscreenButton") : $("#liveFullscreenButton");
		var distance = getDistanceBetweenPointAndElementCenter(e.pageX, e.pageY, ele);
		var distanceLimit = ($(window).width() + $(window).height()) / 8;
		distanceLimit = Math.max(1, distanceLimit);
		var fullOpacityDistance = distanceLimit / 5;
		distance -= fullOpacityDistance;
		distanceLimit -= fullOpacityDistance;

		var transparency = distance / distanceLimit;
		var opacity = Clamp(1 - transparency, 0, 1);
		$("#liveFullscreenButton,#liveExitFullscreenButton").css("opacity", opacity);
	});
	$("#layoutbody").on("mouseleave", function (e)
	{
		mouseCoordFixer.fix(e);
		$("#liveFullscreenButton,#liveExitFullscreenButton").css("opacity", 0);
	});
	$(document).on("webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange", function (event)
	{
		if (self.isFullScreen())
			$("#layoutleft,#layouttop").hide();
		else
			$("#layoutleft,#layouttop").show();
		resized();
		self.updateFullScreenButtonState();
	});
	$("#liveFullscreenButton,#liveExitFullscreenButton,#clipFullscreenButton,#clipExitFullscreenButton")
		.on("click", function () { self.toggleFullScreen(); })
		.on("mousedown touchstart", function ()
		{
			// Prevents the button click from causing camera maximize actions.
			setTimeout(function () { imageRenderer.CamImgClickStateReset(); }, 0);
		});
	this.updateFullScreenButtonState = function ()
	{
		if (self.isFullScreen())
		{
			$("#clipFullscreenButton,#liveFullscreenButton").hide();
			$("#clipExitFullscreenButton").show();

			if (videoPlayer.isLive())
				$("#liveExitFullscreenButton").show();
			else
				$("#liveExitFullscreenButton").hide();
		}
		else
		{
			$("#clipFullscreenButton").show();
			$("#clipExitFullscreenButton,#liveExitFullscreenButton").hide();

			if (videoPlayer.isLive())
				$("#liveFullscreenButton").show();
			else
				$("#liveFullscreenButton").hide();
		}
		resized();
	}
	this.toggleFullScreen = function ()
	{
		if (!self.isFullScreen())
			requestFullScreen();
		else
			exitFullScreen();
	}
	this.isFullScreen = function ()
	{
		isFullScreen_cached = (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) ? true : false;
		return isFullScreen_cached;
	}
	var requestFullScreen = function ()
	{
		if (document.documentElement.requestFullscreen)
			document.documentElement.requestFullscreen();
		else if (document.documentElement.msRequestFullscreen)
			document.documentElement.msRequestFullscreen();
		else if (document.documentElement.mozRequestFullScreen)
			document.documentElement.mozRequestFullScreen();
		else if (document.documentElement.webkitRequestFullscreen)
			document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
	}
	var exitFullScreen = function ()
	{
		if (document.exitFullscreen)
			document.exitFullscreen();
		else if (document.msExitFullscreen)
			document.msExitFullscreen();
		else if (document.mozCancelFullScreen)
			document.mozCancelFullScreen();
		else if (document.webkitExitFullscreen)
			document.webkitExitFullscreen();
	}
}
//////////////////////////////////////////////////////////////////////
// Ajax History //////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
function AjaxHistoryManager()
{
	// This class manages the back and forward buttons in a custom way.
	var self = this;
	var buttonOverride;

	var ForwardButtonPressed = function ()
	{
		return false;
	}
	var BackButtonPressed = function ()
	{
		var loading = videoPlayer.Loading();
		if (!loading.image.isLive)
			clipLoader.CloseCurrentClip();
		else if (!loading.image.isGroup)
			videoPlayer.LoadHomeGroup();
		else
			return false;
		return true;
	}
	if (isHtml5HistorySupported())
		buttonOverride = new HistoryButtonOverride(BackButtonPressed, ForwardButtonPressed);
}
//////////////////////////////////////////////////////////////////////
// Hotkeys ///////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
function BI_Hotkey_FullScreen()
{
	fullScreenModeController.toggleFullScreen();
}
function BI_Hotkey_PlayPause()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.Playback_PlayPause();
}
function BI_Hotkey_NextClip()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.Playback_NextClip();
}
function BI_Hotkey_PreviousClip()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.Playback_PreviousClip();
}
function BI_Hotkey_SkipAhead()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.SeekByMs(1000 * parseInt(settings.ui3_skipAmount));
}
function BI_Hotkey_SkipBack()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.SeekByMs(-1000 * parseInt(settings.ui3_skipAmount));
}
function BI_Hotkey_DigitalZoomIn()
{
	imageRenderer.DigitalZoomNow(1, true);
}
function BI_Hotkey_DigitalZoomOut()
{
	imageRenderer.DigitalZoomNow(-1, true);
}
function BI_Hotkey_DigitalPanUp()
{
	hotkeys.digitalPanUp_isActive = true;
	hotkeys.StartDigitalPanning();
}
function BI_Hotkey_DigitalPanDown()
{
	hotkeys.digitalPanDown_isActive = true;
	hotkeys.StartDigitalPanning();
}
function BI_Hotkey_DigitalPanLeft()
{
	hotkeys.digitalPanLeft_isActive = true;
	hotkeys.StartDigitalPanning();
}
function BI_Hotkey_DigitalPanRight()
{
	hotkeys.digitalPanRight_isActive = true;
	hotkeys.StartDigitalPanning();
}
function BI_Hotkey_DigitalPanUp_Up()
{
	hotkeys.digitalPanUp_isActive = false;
}
function BI_Hotkey_DigitalPanDown_Up()
{
	hotkeys.digitalPanDown_isActive = false;
}
function BI_Hotkey_DigitalPanLeft_Up()
{
	hotkeys.digitalPanLeft_isActive = false;
}
function BI_Hotkey_DigitalPanRight_Up()
{
	hotkeys.digitalPanRight_isActive = false;
}
function BI_Hotkey_PtzUp() { BI_PTZ_Action(2); }
function BI_Hotkey_PtzUp_Up() { BI_PTZ_Action(2, true); }
function BI_Hotkey_PtzDown() { BI_PTZ_Action(3); }
function BI_Hotkey_PtzDown_Up() { BI_PTZ_Action(3, true); }
function BI_Hotkey_PtzLeft() { BI_PTZ_Action(0); }
function BI_Hotkey_PtzLeft_Up() { BI_PTZ_Action(0, true); }
function BI_Hotkey_PtzRight() { BI_PTZ_Action(1); }
function BI_Hotkey_PtzRight_Up() { BI_PTZ_Action(1, true); }
function BI_Hotkey_PtzIn() { BI_PTZ_Action(5); }
function BI_Hotkey_PtzIn_Up() { BI_PTZ_Action(5, true); }
function BI_Hotkey_PtzOut() { BI_PTZ_Action(6); }
function BI_Hotkey_PtzOut_Up() { BI_PTZ_Action(6, true); }
function BI_Hotkey_PtzPreset(presetNum)
{
	var loading = videoPlayer.Loading();
	if (loading.image.ptz && loading.image.isLive)
		ptzButtons.PTZ_async_noguarantee(loading.image.id, 100 + parseInt(presetNum));
}
function BI_PTZ_Action(ptzCmd, isStopCommand)
{
	var loading = videoPlayer.Loading();
	if (loading.image.ptz && loading.image.isLive)
		ptzButtons.SendOrQueuePtzCommand(loading.image.id, ptzCmd, isStopCommand);
}
function BI_Hotkeys()
{
	var self = this;
	var charCodeToKeyNameMap;

	var currentlyDownKeys = {};
	$(document).keydown(function (e)
	{
		console.log("DN: " + getKeyName(e.keyCode));
		var charCode = e.which ? e.which : event.keyCode;
		var isRepeatKey = currentlyDownKeys[charCode];
		currentlyDownKeys[charCode] = true;
		var retVal = true;
		if ($(".ui2modal").length == 0)
		{
			for (var i = 0; i < defaultSettings.length; i++)
			{
				var s = defaultSettings[i];
				if (s.hotkey)
				{
					if (!isRepeatKey || s.allowRepeatKey)
					{
						if (typeof s.actionDown == "function")
						{
							var parts = settings[s.key].split("|");
							if (parts.length >= 4)
							{
								if ((e.ctrlKey ? "1" : "0") == parts[0]
									&& (e.altKey ? "1" : "0") == parts[1]
									&& (e.shiftKey ? "1" : "0") == parts[2]
									&& (charCode == parts[3]))
								{
									s.actionDown();
									retVal = false;
								}
							}
						}
					}
				}
			}
		}
		if (!retVal)
			return retVal;
	});
	$(document).keyup(function (e)
	{
		console.log("UP: " + getKeyName(e.keyCode));
		var charCode = e.which ? e.which : event.keyCode;
		currentlyDownKeys[charCode] = false;
		var retVal = true;
		if ($(".ui2modal").length == 0)
		{
			for (var i = 0; i < defaultSettings.length; i++)
			{
				var s = defaultSettings[i];
				if (s.hotkey && typeof s.actionUp == "function")
				{
					var parts = settings[s.key].split("|");
					if (parts.length >= 4)
					{
						var charCode = e.which ? e.which : event.keyCode
						if (charCode == parts[3])
						{
							s.actionUp();
							retVal = false;
						}
					}
				}
			}
		}
		if (!retVal)
			return retVal;
	});

	var lastDigitalPanAction = 0;
	var isPanning = false;
	this.digitalPanUp_isActive = false;
	this.digitalPanDown_isActive = false;
	this.digitalPanLeft_isActive = false;
	this.digitalPanRight_isActive = false;

	this.StartDigitalPanning = function ()
	{
		if (isPanning)
			return;
		isPanning = true;
		DoDigitalPan();
	}
	var DoDigitalPan = function ()
	{
		var dx = 0;
		var dy = 0;
		var timeNow = new Date().getTime();
		var timePassed = lastDigitalPanAction == 0 ? 16 : Math.min(1000, timeNow - lastDigitalPanAction);
		// Pan speed will increase with a larger browser window.
		var panSpeed = (timePassed / 1000) * (($(window).width() + $(window).height()) / 2);
		console.log(panSpeed);
		if (self.digitalPanUp_isActive)
			dy += panSpeed;
		if (self.digitalPanDown_isActive)
			dy -= panSpeed;
		if (self.digitalPanLeft_isActive)
			dx += panSpeed;
		if (self.digitalPanRight_isActive)
			dx -= panSpeed;
		if (dx == 0 && dy == 0
			&& !self.digitalPanUp_isActive
			&& !self.digitalPaDown_isActive
			&& !self.digitalPanLeft_isActive
			&& !self.digitalPanRight_isActive)
		{
			EndDigitalPanning();
			return;
		}
		imageRenderer.DigitalPan(dx, dy);
		requestAnimationFrame(DoDigitalPan);
	}
	var EndDigitalPanning = function ()
	{
		isPanning = false;
		lastDigitalPanAction = 0;
	}

	var getKeyName = function (charCode)
	{
		var name = charCodeToKeyNameMap[charCode];
		if (typeof name == "undefined")
			name = String.fromCharCode(charCode);
		return name;
	}
	var buildKeyMap = function ()
	{
		var m = {};
		m[8] = "backspace";
		m[9] = "tab";
		m[13] = "enter";
		m[16] = "";
		m[17] = "";
		m[18] = "";
		m[19] = "pause/break";
		m[20] = "caps lock";
		m[27] = "escape";
		m[32] = "space";
		m[33] = "page up";
		m[34] = "page down";
		m[35] = "end";
		m[36] = "home";
		m[37] = "left arrow";
		m[38] = "up arrow";
		m[39] = "right arrow";
		m[40] = "down arrow";
		m[45] = "insert";
		m[46] = "delete";
		m[91] = "left window";
		m[92] = "right window";
		m[93] = "select key";
		m[96] = "numpad 0";
		m[97] = "numpad 1";
		m[98] = "numpad 2";
		m[99] = "numpad 3";
		m[100] = "numpad 4";
		m[101] = "numpad 5";
		m[102] = "numpad 6";
		m[103] = "numpad 7";
		m[104] = "numpad 8";
		m[105] = "numpad 9";
		m[106] = "multiply";
		m[107] = "add";
		m[109] = "subtract";
		m[110] = "decimal point";
		m[111] = "divide";
		m[112] = "F1";
		m[113] = "F2";
		m[114] = "F3";
		m[115] = "F4";
		m[116] = "F5";
		m[117] = "F6";
		m[118] = "F7";
		m[119] = "F8";
		m[120] = "F9";
		m[121] = "F10";
		m[122] = "F11";
		m[123] = "F12";
		m[144] = "num lock";
		m[145] = "scroll lock";
		m[186] = ";";
		m[187] = "=";
		m[188] = ",";
		m[189] = "-";
		m[190] = ".";
		m[191] = "/";
		m[192] = "tilde (~`)";
		m[219] = "[";
		m[220] = "\\";
		m[221] = "]";
		m[222] = "apostrophe (')";
		return m;
	}
	charCodeToKeyNameMap = buildKeyMap();
}
///////////////////////////////////////////////////////////////
// On-screen Toast Messages ///////////////////////////////////
///////////////////////////////////////////////////////////////
function Toaster()
{
	toastr.options = {
		"closeButton": false,
		"debug": false,
		"positionClass": "toast-bottom-right",
		"onclick": null,
		"showDuration": "300",
		"hideDuration": "1000",
		"timeOut": "3000",
		"extendedTimeOut": "3000",
		"showEasing": "swing",
		"hideEasing": "linear",
		"showMethod": "fadeIn",
		"hideMethod": "fadeOut"
	}
	var showToastInternal = function (type, message, showTime, closeButton)
	{
		if (typeof message == "object" && typeof message.stack == "string")
			message = message.stack;
		var overrideOptions = {};

		if (showTime)
			overrideOptions.timeOut = showTime;

		if (closeButton)
		{
			overrideOptions.closeButton = true;
			overrideOptions.tapToDismiss = false;
			overrideOptions.extendedTimeOut = 60000;
		}

		var myToast = toastr[type](message, null, overrideOptions);

		bilog.info(type + " toast: " + message);

		return myToast;
	}
	this.Success = function (message, showTime, closeButton)
	{
		return showToastInternal('success', message, showTime, closeButton);
	}
	this.Info = function (message, showTime, closeButton)
	{
		return showToastInternal('info', message, showTime, closeButton);
	}
	this.Warning = function (message, showTime, closeButton)
	{
		return showToastInternal('warning', message, showTime, closeButton);
	}
	this.Error = function (message, showTime, closeButton)
	{
		return showToastInternal('error', message, showTime, closeButton);
	}
}
function showSuccessToast(message, showTime, closeButton)
{
	return toaster.Success(message, showTime, closeButton);
}
function showInfoToast(message, showTime, closeButton)
{
	return toaster.Info(message, showTime, closeButton);
}
function showWarningToast(message, showTime, closeButton)
{
	return toaster.Warning(message, showTime, closeButton);
}
function showErrorToast(message, showTime, closeButton)
{
	return toaster.Error(message, showTime, closeButton);
}
///////////////////////////////////////////////////////////////
// JSON ///////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var execJsonCounter = 0;
function ExecJSON(args, callbackSuccess, callbackFail, synchronous)
{
	if (currentServer.isLoggingOut && args.cmd != "logout")
		return;
	sessionManager.ApplyLatestAPISessionIfNecessary();
	var isLogin = args.cmd == "login";
	var oldSession = $.cookie("session");
	if (typeof args.session == "undefined" && !isLogin)
	{
		args.session = oldSession;
	}
	var eventArgs = { id: execJsonCounter++, args: args };
	BI_CustomEvent.Invoke("ExecJSON_Start", eventArgs);
	$.ajax({
		type: 'POST',
		url: currentServer.remoteBaseURL + "json",
		contentType: "text/plain",
		data: JSON.stringify(args),
		dataType: "json",
		async: !synchronous,
		success: function (data)
		{
			eventArgs.data = data;
			BI_CustomEvent.Invoke("ExecJSON_Success", eventArgs);
			if (isLogin)
				$.cookie("session", oldSession, { path: "/" });
			else if (typeof data.session != "undefined" && data.session != $.cookie("session"))
			{
				// If this happens a lot, usually the cause is another window with a web UI open that has a different latestAPISession value
				bilog.verbose('ExecJSON("' + args.cmd + '").success Changing session from ' + $.cookie("session") + ' to ' + data.session);
				$.cookie("session", data.session, { path: "/" });
			}
			if (callbackSuccess)
				callbackSuccess(data);
		},
		error: function (jqXHR, textStatus, errorThrown)
		{
			BI_CustomEvent.Invoke("ExecJSON_Fail", eventArgs);
			if (callbackFail)
				callbackFail(jqXHR, textStatus, errorThrown);
		}
	});
}
///////////////////////////////////////////////////////////////
// Frame rate counter /////////////////////////////////////////
///////////////////////////////////////////////////////////////
var fpsCounter = new FPSCounter1();
function FPSCounter1()
{
	// Counts the exact number of frames that arrived within the last 1000 ms.
	var frameTimes = null;
	this.getFPS = function (lastFrameLoadingTime)
	{
		var now = new Date().getTime();
		// Trim times older than 1 second
		while (frameTimes != null && now - frameTimes.value > 1000)
			frameTimes = frameTimes.next;
		if (frameTimes == null)
		{
			// No history. Add current time and return predicted FPS based on last frame loading time.
			frameTimes = new LinkedListNode(now);
			if (lastFrameLoadingTime <= 0)
				lastFrameLoadingTime = 10000;
			var newFps = (1000.0 / lastFrameLoadingTime).toFixed(1);
			if (newFps > 2)
				newFps = 2;
			return newFps;
		}
		// Count live nodes
		var iterator = frameTimes;
		var count = 1; // 1 for the head of our linked list
		while (iterator.next != null)
		{
			iterator = iterator.next;
			count++;
		}
		iterator.next = new LinkedListNode(now);
		count++;
		return count;
	}
}
function LinkedListNode(value)
{
	this.value = value;
	this.next = null;
}
function FPSCounter2()
{
	// Calculates frame rate based on the average loading time of the last 10 frames.
	var MAXSAMPLES = 10;
	var tickindex = 0;
	var ticksum = 0;
	var ticklist = [];
	for (var i = 0; i < MAXSAMPLES; i++)
		ticklist.push(0);
	var CalcAverageTick = function (newtick)
	{
		if (newtick !== null)
		{
			ticksum -= ticklist[tickindex];  /* subtract value falling off */
			ticksum += newtick;              /* add new value */
			ticklist[tickindex] = newtick;   /* save new value so it can be subtracted later */
			if (++tickindex == MAXSAMPLES)    /* inc buffer index */
				tickindex = 0;
		}
		/* return average */
		return (ticksum / MAXSAMPLES);
	}
	this.getFPS = function (newtick)
	{
		return (1000 / CalcAverageTick(newtick)).toFixed(1);
	}
}
///////////////////////////////////////////////////////////////
// Host Redirection ///////////////////////////////////////////
// Incomplete / Placeholder ///////////////////////////////////
///////////////////////////////////////////////////////////////
var currentServer =
	{
		remoteBaseURL: ""
		, remoteSession: ""
		, isLoggingOut: false
		, isUsingRemoteServer: false
		, GetRemoteSessionArg: function (prefix, overrideRemoteRequirement)
		{
			if (currentServer.isUsingRemoteServer)
				return prefix + "session=" + latestAPISession;
			else if (overrideRemoteRequirement)
				return prefix + "session=" + $.cookie("session");
			else
				return "";
		}
	};
///////////////////////////////////////////////////////////////
// Custom Events //////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var BI_CustomEvent =
	{
		customEventRegistry: new Object(),
		AddListener: function (eventName, eventHandler)
		{
			if (typeof this.customEventRegistry[eventName] == "undefined")
				this.customEventRegistry[eventName] = new Array();
			this.customEventRegistry[eventName].push(eventHandler);
		},
		RemoveListener: function (eventName, eventHandler)
		{
			if (typeof this.customEventRegistry[eventName] == "undefined")
				return;
			var handlers = this.customEventRegistry[eventName];
			var idx = handlers.indexOf(eventHandler);
			if (idx > -1)
				handlers.splice(idx, 1);
		},
		Invoke: function (eventName, args)
		{
			if (typeof this.customEventRegistry[eventName] != "undefined")
				for (var i = 0; i < this.customEventRegistry[eventName].length; i++)
					try
					{
						this.customEventRegistry[eventName][i](args);
					}
					catch (ex)
					{
						toaster.Error(ex);
					}
		}
	};
///////////////////////////////////////////////////////////////
// Loading Helper /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function LoadingHelper()
{
	var self = this;
	var loadingFinished = false;
	var things =
		[
			["window", "#loadingWebContent", false]
			, ["cameraList", "#loadingCameraList", false]
			, ["status", "#loadingServerStatus", false]
			, ["login", "#loadingLogin", false]
			, ["svg", "#loadingSVG", false]
		];

	this.SetLoadedStatus = function (name)
	{
		var thing = GetThing(name);
		if (thing[2])
			return;
		thing[2] = true;
		var loadingStatusObj = $(thing[1]);
		if (loadingStatusObj.length > 0)
		{
			loadingStatusObj.html("OK");
			loadingStatusObj.css("color", "#00CC00");
		}
		FinishLoadingIfConditionsMet();
	}
	this.SetErrorStatus = function (name, errorMessage)
	{
		var thing = GetThing(name);
		var loadingStatusObj = $(thing[1]);
		if (loadingStatusObj.length > 0)
		{
			loadingStatusObj.html("FAIL");
			loadingStatusObj.css("color", "#CC0000");
		}
		if (typeof errorMessage != "undefined" && errorMessage != null && errorMessage != "")
			toaster.Error(errorMessage, 600000);
	}
	var GetThing = function (name)
	{
		for (var i = 0; i < things.length; i++)
			if (things[i][0] === name)
				return things[i];
		return null;
	}
	var FinishLoadingIfConditionsMet = function ()
	{
		if (loadingFinished)
			return;
		for (var i = 0; i < things.length; i++)
			if (!things[i][2])
				return;
		loadingFinished = true;
		$("#loadingmsgwrapper").remove();
		resized();
		videoPlayer.Initialize();
		BI_CustomEvent.Invoke("FinishedLoading");
	}
	$(window).load(function ()
	{
		self.SetLoadedStatus("window");
	});
}
///////////////////////////////////////////////////////////////
// Logging ////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var BILogger = function ()
{
	var logInner = function (msg)
	{
		try
		{
			console.log(msg);
		}
		catch (ex)
		{
		}
	}
	this.verbose = logInner;
	this.info = logInner;
	this.debug = logInner;
}
var bilog = new BILogger();
///////////////////////////////////////////////////////////////
// Object To Html Table ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function ArrayToHtmlTable(a)
{
	var $table = $("<table></table>");
	var $thead = $("<thead></thead>");
	var $theadrow = $("<tr></tr>");
	var $tbody = $("<tbody></tbody>");
	$thead.append($theadrow);
	$table.append($thead);
	$table.append($tbody);
	var columnSpec = new Object();
	var columnIdx = 0;
	for (var i = 0; i < a.length; i++)
	{
		for (var key in a[i])
		{
			if (typeof columnSpec[key] == "undefined")
			{
				$theadrow.append($("<th></th>").text(key));
				columnSpec[key] = columnIdx++;
			}
		}
	}
	for (var i = 0; i < a.length; i++)
	{
		var newRow = new Object();
		for (var key in a[i])
		{
			var value = a[i][key];
			var idx = columnSpec[key];
			newRow[idx] = value;
		}
		var $row = $("<tr></tr>");
		for (var n = 0; n < columnIdx; n++)
		{
			if (typeof newRow[n] == "undefined")
				$row.append("<td></td>");
			else
				$row.append($("<td></td>").text(newRow[n]));
		}
		$tbody.append($row);
	}
	return $table;
}
///////////////////////////////////////////////////////////////
// Save Images to Local Storage ///////////////////////////////
///////////////////////////////////////////////////////////////
function PersistImageFromUrl(settingsKey, url, onSuccess, onFail)
{
	if (!isCanvasSupported())
	{
		if (onFail)
			onFail("Browser does not support the Canvas element.");
		return;
	}
	var tries = 0;
	var tmpImg = document.createElement("img");
	tmpImg.crossOrigin = "Anonymous";
	var $tmpImg = $(tmpImg);
	$("#preloadcontainer").append(tmpImg);
	$tmpImg.load(function ()
	{
		if (!this.complete || typeof this.naturalWidth == "undefined" || this.naturalWidth == 0)
		{
			// Failed
			if (tries++ < 2)
				$tmpImg.attr("src", url);
			else
			{
				$tmpImg.remove();
				if (onFail)
					onFail("Image was invalid.");
			}
		}
		else
		{
			var imgCanvas = document.createElement("canvas"),
				imgContext = imgCanvas.getContext("2d");

			// Make sure canvas is as big as the picture
			imgCanvas.width = tmpImg.width;
			imgCanvas.height = tmpImg.height;

			// Draw image into canvas element
			imgContext.drawImage(tmpImg, 0, 0, tmpImg.width, tmpImg.height);

			// Get canvas contents as a data URL
			var imgAsDataURL = imgCanvas.toDataURL("image/jpeg");

			$tmpImg.remove();

			// Save image into settings
			try
			{
				settings.setItem(settingsKey, imgAsDataURL);
			}
			catch (e)
			{
				// either the settings object does not exist or it is full
				if (onFail)
					onFail("Local Storage may be full!");
				return;
			}

			if (onSuccess)
				onSuccess(imgAsDataURL);
		}
	});
	$tmpImg.error(function ()
	{
		if (tries++ < 2)
			$tmpImg.attr("src", url);
		else
		{
			$tmpImg.remove();
			if (onFail)
				onFail("Unable to load image from server.");
		}
	});
	$tmpImg.attr("src", url);
}
///////////////////////////////////////////////////////////////
// Fetch raw h.264 streaming //////////////////////////////////
///////////////////////////////////////////////////////////////
function FetchRawH264Streamer(url, frameCallback, streamEnded)
{
	var self = this;
	var cancel_streaming = false;
	var is_streaming = false;
	var reader = null;

	this.StopStreaming = function ()
	{
		cancel_streaming = true;
		if (reader)
		{
			reader.cancel("Streaming canceled");
			reader = null;
		}
	}
	var Start = function ()
	{
		console.log("Fetching: " + url);
		fetch(url)
			.then(function (res)
			{
				if (cancel_streaming)
					return;
				reader = res.body.getReader();
				return pump(reader);
			})
		["catch"](function (e)
		{
			is_streaming = false;
			streamEnded(e);
		});
	}

	function pump()
	{
		if (reader == null)
			return;
		reader.read().then(function (result)
		{
			if (result.done)
			{
				is_streaming = false;
				streamEnded("fetch graceful exit");
				return;
			}
			else if (cancel_streaming)
			{
				streamEnded("fetch less graceful exit");
				return;
			}

			var buf = result.value;

			for (var i = 0; i < buf.byteLength; i++)
			{
				var sentinelLength = GetSentinelLength(buf[i]);
				if (sentinelLength > 0)
				{
					// Found NAL unit sentinel value
					// i + 1 is the index of the first byte after a sentinel value

					if (NALBuf.length == 0)
					{
						// This is the start of the very first NAL unit
						NALStart = i + 1;
						AddSentinelValueToNALBuf(sentinelLength);
					}
					else
					{
						if (NALStart == -1)
							NALStart = 0;
						var NALEnd = i - 3;
						AddToNALBuf(buf, NALStart, NALEnd);

						// Here is a complete NAL Unit
						var copy = GetNALBufComplete();
						frameCallback(copy);

						ResetNALBuf();
						NALStart = i + 1;
						AddSentinelValueToNALBuf(sentinelLength);
					}
				}
			}
			if (NALStart == -1)
			{
				// No NAL unit started or ended in this buffer
				AddToNALBuf(buf, 0, buf.length);
				//console.log("No NAL unit started or ended in this buffer");
			}
			else
			{
				// A NAL started within this buffer, but did not end
				//console.log("A NAL started within this buffer, but did not end");
				AddToNALBuf(buf, NALStart, buf.length);
				NALStart = -1;
			}

			return pump();
		}
		)["catch"](function (e)
		{
			is_streaming = false;
			console.log(e);
			StreamingEnded();
		});
	}
	var nals = 0;
	var NALStart = -1;
	var NALBuf = [];
	var concurrentZeros = 0;
	var GetSentinelLength = function (byte)
	{
		// Returns 4 or 3 upon encountering the 1 in [0,0,0,1] or [0,0,1]
		if (byte == 0)
			concurrentZeros++;
		else
		{
			if (byte == 1 && concurrentZeros > 1)
			{
				var retVal = concurrentZeros > 2 ? 4 : 3;
				concurrentZeros = 0;
				return retVal;
			}
			else
				concurrentZeros = 0;
		}
		return 0;
	}
	var ResetNALBuf = function ()
	{
		NALBuf = [];
	}
	var AddSentinelValueToNALBuf = function (sentinelLength)
	{
		if (sentinelLength == 3)
			NALBuf.push(new Uint8Array([0, 0, 1]));
		else
			NALBuf.push(new Uint8Array([0, 0, 0, 1]));
	}
	var AddToNALBuf = function (buf, idxStart, idxEnd)
	{
		NALBuf.push(buf.subarray(idxStart, idxEnd));
	}
	var GetNALBufComplete = function ()
	{
		var totalSize = 0;
		for (var i = 0; i < NALBuf.length; i++)
			totalSize += NALBuf[i].length;
		var tmpBuf = new Uint8Array(totalSize);
		var tmpIdx = 0;
		for (var i = 0; i < NALBuf.length; i++)
			for (var n = 0; n < NALBuf[i].length; n++)
				tmpBuf[tmpIdx++] = NALBuf[i][n];
		return tmpBuf;
	}

	Start();
}
///////////////////////////////////////////////////////////////
// Misc ///////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function isCanvasSupported()
{
	var elem = document.createElement('canvas');
	return !!(elem.getContext && elem.getContext('2d'));
}
function logout()
{
	currentServer.isLoggingOut = true;
	if (currentServer.isUsingRemoteServer)
	{
		ExecJSON({ cmd: "logout" }, function ()
		{
			// If implementing remote server connections:  Here, we would do SendToServerListOnStartup();
		}, function ()
			{
				location.href = currentServer.remoteBaseURL + 'logout.htm' + GetRemoteSessionArg("?");
			});
	}
	else
	{
		ExecJSON({ cmd: "logout" }, function ()
		{
			location.href = currentServer.remoteBaseURL + "login.htm?autologin=0&page=" + encodeURIComponent(location.pathname);
		}, function ()
			{
				location.href = currentServer.remoteBaseURL + 'logout.htm';
			});
	}
}
function logoutOldSession(oldSession)
{
	// When running multiple instances of the UI in the same browser, this causes instances to log out the session belonging to another instance.
	// As long as cookies are sharing sessions between multiple browser tabs, this code should not be enabled.
	// An alternative would be to have Ken include the user name in the session data, so we could avoid creating unnecessary new sessions in the first place.  Then maybe it would be safe to turn this feature on.
	//if (oldSession != null && oldSession != $.cookie("session"))
	//	ExecJSON({ cmd: "logout", session: oldSession });
}
function Clamp(i, min, max)
{
	if (i < min)
		return min;
	if (i > max)
		return max;
	return i;
}
function getDistanceBetweenPointAndElementCenter(x, y, $ele)
{
	var offset = $ele.offset();
	var eX = offset.left + ($ele.outerWidth(true) / 2);
	var eY = offset.top + ($ele.outerHeight(true) / 2);
	var dX = Math.abs(x - eX);
	var dY = Math.abs(y - eY);
	return Math.sqrt((dX * dX) + (dY * dY));
}
function AskYesNo(question, onYes, onNo)
{
	var $dialog = $('<div></div>');
	$dialog.css("text-align", "center");
	$dialog.css("margin", "10px");
	$dialog.addClass("inlineblock");
	if (typeof question == "string")
		$dialog.append('<div class="questionDialogQuestion">' + question + '</div>');
	else if (typeof question == "object")
		$dialog.append(question);

	var $yesBtn = $('<input type="button" class="simpleTextButton btnGreen" style="font-size:1.5em;" value="Yes" draggable="false" unselectable="on" />');
	var $noBtn = $('<input type="button" class="simpleTextButton btnRed" style="font-size:1.5em;" value="No" draggable="false" unselectable="on" />');
	var $yesNoContainer = $("<div></div>");
	$yesNoContainer.append($yesBtn).append("<span>&nbsp;&nbsp;&nbsp;</span>").append($noBtn);
	$dialog.append($yesNoContainer);

	var modalDialog = $dialog.modal({ sizeToFitContent: true, shrinkOnBothResizePasses: true });

	$yesBtn.click(function ()
	{
		if (typeof onYes == "function")
			try
			{
				onYes();
			} catch (ex) { toaster.Error(ex); }
		modalDialog.close();
	});
	$noBtn.click(function ()
	{
		if (typeof onNo == "function")
			try
			{
				onNo();
			} catch (ex) { toaster.Error(ex); }
		modalDialog.close();
	});
}
String.prototype.padLeft = function (len, c)
{
	var str = this;
	while (str.length < len)
		str = (c || "&nbsp;") + str;
	return str;
};
function makeUnselectable($target)
{
	$target
		.addClass('unselectable') // All these attributes are inheritable
		.attr('unselectable', 'on') // For IE9 - This property is not inherited, needs to be placed onto everything
		.attr('draggable', 'false') // For moz and webkit, although Firefox 16 ignores this when -moz-user-select: none; is set, it's like these properties are mutually exclusive, seems to be a bug.
		.on('dragstart', function () { return false; });  // Needed since Firefox 16 seems to ingore the 'draggable' attribute we just applied above when '-moz-user-select: none' is applied to the CSS 

	$target // Apply non-inheritable properties to the child elements
		.find('*')
		.attr('draggable', 'false')
		.attr('unselectable', 'on');
};
function pointInsideElement($ele, pX, pY)
{
	if ($ele.length == 0)
		return false;
	var o = $ele.offset();
	var w = $ele.width();
	var h = $ele.height();
	return pX >= o.left && pX < o.left + w && pY >= o.top && pY < o.top + h;
}
function BlueIrisColorToCssColor(biColor)
{
	var colorHex = biColor.toString(16).padLeft(8, '0').substr(2);
	return colorHex.substr(4, 2) + colorHex.substr(2, 2) + colorHex.substr(0, 2);
}
function GetReadableTextColorHexForBackgroundColorHex(c)
{
	var r = parseInt(c.substr(0, 2), 16);
	var g = parseInt(c.substr(2, 2), 16);
	var b = parseInt(c.substr(4, 2), 16);
	var o = Math.round(((r * 299) + (g * 587) + (b * 114)) / 1000);
	return o > 125 ? "222222" : "DDDDDD";
}
function stopDefault(e)
{
	if (e && e.preventDefault)
	{
		e.preventDefault();
	}
	else
	{
		window.event.returnValue = false;
	}
	return false;
}
function JavaScriptStringEncode(str)
{
	return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
function CleanUpGroupName(groupName)
{
	while (groupName.indexOf("+") == 0)
		groupName = groupName.substr(1);
	return groupName;
}
String.prototype.startsWith = function (prefix)
{
	return this.lastIndexOf(prefix, 0) === 0;
}

String.prototype.endsWith = function (suffix)
{
	return this.match(suffix + "$") == suffix;
};
function msToTime(totalMs, includeMs)
{
	var ms = totalMs % 1000;
	var s = parseInt((totalMs / 1000)) % 60;
	var m = parseInt((totalMs / 60000)) % 60;
	var h = parseInt((totalMs / 3600000));

	var retVal;
	if (h != 0)
		retVal = h + ":" + m.toString().padLeft(2, "0");
	else
		retVal = m;

	retVal += ":" + s.toString().padLeft(2, "0");

	if (includeMs)
		retVal += '<span style="opacity:0.6;">.' + ms.toString().padLeft(3, "0") + "</span>";

	return retVal;
}
function GetTimeStr(date, includeMilliseconds)
{
	var ampm = "AM";
	var hour = date.getHours();
	if (hour == 0)
	{
		hour = 12;
	}
	else if (hour == 12)
	{
		ampm = "PM";
	}
	else if (hour > 12)
	{
		hour -= 12;
		ampm = "PM";
	}
	var ms = includeMilliseconds ? ("." + date.getMilliseconds()) : "";

	var str = hour.toString().padLeft(2, '0') + ":" + date.getMinutes().toString().padLeft(2, '0') + ":" + date.getSeconds().toString().padLeft(2, '0') + ms + " " + ampm;
	return str;
}
function GetDateStr(date, includeMilliseconds)
{
	var str = date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate() + " " + GetTimeStr(date, includeMilliseconds);
	return str;
}
function GetDateDisplayStr(date)
{
	var sameDay = isSameDay(date, new Date());
	return (sameDay ? "Today, " : "") + date.getMonthName() + " " + date.getDate() + (sameDay ? "" : ", " + date.getFullYear());
}
Date.prototype.getMonthName = function (lang)
{
	lang = lang && (lang in Date.locale) ? lang : 'en';
	return Date.locale[lang].month_names[this.getMonth()];
};

Date.prototype.getMonthNameShort = function (lang)
{
	lang = lang && (lang in Date.locale) ? lang : 'en';
	return Date.locale[lang].month_names_short[this.getMonth()];
};

Date.locale = {
	en: {
		month_names: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		month_names_short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
	}
};
// Performs a deep clone of the specified element, removing all id attributes, data, and event handlers.
function CloneAndStripIdAttributes($ele)
{
	var $clone = $ele.clone(false);
	StripIdAttributesRecursive($clone);
	return $clone;
}
function StripIdAttributesRecursive($ele)
{
	$ele.removeAttr("id");
	$ele.children().each(function (idx, child)
	{
		StripIdAttributesRecursive($(child));
	});
}
var UrlParameters =
	{
		loaded: false,
		parsed_url_params: {},
		Get: function (key)
		{
			if (!this.loaded)
			{
				var params = this.parsed_url_params;
				window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (str, key, value)
				{
					params[key.toLowerCase()] = decodeURIComponent(value);
				})
				this.loaded = true;
			}
			if (typeof this.parsed_url_params[key.toLowerCase()] != 'undefined')
				return this.parsed_url_params[key.toLowerCase()];
			return "";
		}
	};
var UrlHashParameters =
	{
		Get: function (key)
		{
			var params = {};
			window.location.hash.replace(/[?#&]+([^=&]+)=([^&]*)/gi, function (str, key, value)
			{
				params[key.toLowerCase()] = decodeURIComponent(value);
			})
			if (typeof params[key.toLowerCase()] != 'undefined')
				return params[key.toLowerCase()];
			return "";
		}
	};
function htmlEncode(value)
{
	return $('<div/>').text(value).html();
}
function htmlDecode(value)
{
	return $('<div/>').html(value).text();
}
function isSameDay(date1, date2)
{
	if (date1.getDate() != date2.getDate())
		return false;
	if (date1.getMonth() != date2.getMonth())
		return false;
	if (date1.getFullYear() != date2.getFullYear())
		return false;
	return true;
}
function binarySearch(ar, el, compare_fn)
{
	var m = 0;
	var n = ar.length - 1;
	while (m <= n)
	{
		var k = (n + m) >> 1;
		var cmp = compare_fn(el, ar[k]);
		if (cmp > 0)
			m = k + 1;
		else if (cmp < 0)
			n = k - 1;
		else
			return k;
	}
	return -m - 1;
}
function getBytesFromBISizeStr(str)
{
	if (str.endsWith("K"))
		return parseInt(parseFloat(str) * 1024);
	else if (str.endsWith("M"))
		return parseInt(parseFloat(str) * 1048576);
	else if (str.endsWith("G"))
		return parseInt(parseFloat(str) * 1073741824);
	else if (str.endsWith("T"))
		return parseInt(parseFloat(str) * 1073741824 * 1024);
	else
		return parseInt(parseFloat(str));
}
function getBytesFrom_MiB(MiB)
{
	return MiB * 1048576;
}
function formatBytes(bytes, decimals)
{
	if (bytes == 0) return '0B';
	var negative = bytes < 0;
	if (negative)
		bytes = -bytes;
	var k = 1024,
		dm = decimals || 2,
		sizes = ['B', 'K', 'M', 'G', 'T', 'PB', 'EB', 'ZB', 'YB'],
		i = Math.floor(Math.log(bytes) / Math.log(k));
	return (negative ? '-' : '') + parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
}
var mouseCoordFixer =
	{
		last: {
			x: 0, y: 0
		}
		, fix: function (e)
		{
			if (e.alreadyMouseCoordFixed)
				return;
			e.alreadyMouseCoordFixed = true;
			if (typeof e.pageX == "undefined")
			{
				if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 0)
				{
					mouseCoordFixer.last.x = e.pageX = e.originalEvent.touches[0].pageX + $(window).scrollLeft();
					mouseCoordFixer.last.y = e.pageY = e.originalEvent.touches[0].pageY + $(window).scrollTop();
				}
				else
				{
					e.pageX = mouseCoordFixer.last.x;
					e.pageY = mouseCoordFixer.last.y;
				}
			}
			else
			{
				mouseCoordFixer.last.x = e.pageX = e.pageX + $(window).scrollLeft();
				mouseCoordFixer.last.y = e.pageY = e.pageY + $(window).scrollTop();
			}
		}
	};
function IE_GetDevicePixelRatio()
{
	return Math.sqrt(screen.deviceXDPI * screen.deviceYDPI) / 96;
}

function BI_GetDevicePixelRatio()
{
	var returnValue = window.devicePixelRatio || IE_GetDevicePixelRatio() || 1;
	if (returnValue <= 0)
		returnValue = 1;
	return returnValue;
}
var _browser_is_ie = -1;
function BrowserIsIE()
{
	if (_browser_is_ie == -1)
		_browser_is_ie = /MSIE \d|Trident.*rv:/.test(navigator.userAgent) ? 1 : 0;
	return _browser_is_ie == 1;
}
var _browser_is_edge = -1;
function BrowserIsEdge()
{
	if (_browser_is_edge == -1)
		_browser_is_edge = window.navigator.userAgent.indexOf(" Edge/") > -1 ? 1 : 0;
	return _browser_is_edge == 1;

}
function BrowserIsChrome()
{
	return navigator.appVersion.indexOf(" Chrome/") > -1;
}
function getHiddenProp()
{
	var prefixes = ['webkit', 'moz', 'ms', 'o'];

	// if 'hidden' is natively supported just return it
	if ('hidden' in document) return 'hidden';

	// otherwise loop over all the known prefixes until we find one
	for (var i = 0; i < prefixes.length; i++)
	{
		if ((prefixes[i] + 'Hidden') in document)
			return prefixes[i] + 'Hidden';
	}

	// otherwise it's not supported
	return null;
}
function documentIsHidden()
{
	var prop = getHiddenProp();
	if (!prop) return false;

	return document[prop];
}