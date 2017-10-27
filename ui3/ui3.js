/// <reference path="ui3-local-overrides.js" />
/// <reference path="libs-src/jquery-1.11.3.js" />
/// <reference path="libs-ui3.js" />
/// This web interface is licensed under the GNU LGPL Version 3
"use strict";
var developerMode = false;

///////////////////////////////////////////////////////////////
// Feature Detect /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var h264_playback_supported = false;
var web_workers_supported = false;
var fetch_supported = false;
var readable_stream_supported = false;
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
			// All critical tests pass
			// Non-critical tests can run here and store their results in global vars.
			web_workers_supported = typeof Worker !== "undefined";
			fetch_supported = typeof fetch == "function";
			readable_stream_supported = typeof ReadableStream == "function";
			h264_playback_supported = web_workers_supported && fetch_supported && readable_stream_supported;
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
var clipboardHelper;
var uiSizeHelper = null;
var uiSettingsPanel = null;
var audioPlayer = null;
var diskUsageGUI = null;
var systemConfig = null;
var cameraProperties = null;
var cameraListDialog = null;
var clipProperties = null;
var clipDownloadDialog = null;
var statusBars = null;
var dropdownBoxes = null;
var genericQualityHelper = null;
var jpegQualityHelper = null;
var h264QualityHelper = null;
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
var nerdStats = null;
var sessionTimeout = null;

var currentPrimaryTab = "";
var skipTabLoadClipLoad = false;

var togglableUIFeatures =
	[
		// The uniqueId is also used in the name of a setting which remembers the enabled state.
		// If you add a new togglabe UI feature here, also add the corresponding default setting value.
		// [selector, uniqueId, displayName, onToggle, extraMenuButtons, shouldDisableToggler, labels]
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

// TODO: Thoroughly test camera cycles and ensure their performance is acceptable.
//       -- I've found bugs related to the cycles and reported them.  Awaiting fixes.
// TODO: Handle alerts as bookmarks into the clip.  Requires BI changes to do cleanly for both streaming methods.
// TODO: Server-side ptz preset thumbnails.  Prerequisite: Server-side ptz preset thumbnails.
// TODO: Read the "tzone" value earlier, either at login/session check or at page load via an HTML macro, whatever Blue Iris will provide.  Currently there is a race between status load and clip list load that could cause the clip list to load with no time zone offset.
// TODO: Implement audio playback using data from the /video/ stream.
// 		-- Split Video and Audio stream bit rates into different graphs.
//      -- Add a tooltip to the volume control that indicates it does not work while streaming jpegs.  Or hide the volume control outright.

// TODO: Show a warning to users who have more than one camera available but no group stream.
// TODO: Test a single-camera system (limited user account with 1-camera group).  Clicking the camera should not interrupt streaming.
// TODO: It should not take a full click to hide a context menu.  A simple mousedown or touchstart should do it!
// TODO: The (touch) gesture that shows the playback controls should not be able to activate click actions on the playback controls.  I'm not sure what the best way to handle this is.  Perhaps a flag set on mousedown/touchstart that is unset with a 0ms timeout after mouseup/touchend/touchcancel/etc.
// CONSIDER: An input event within the bounds of the live playback controls that also show the live playback controls should not count toward MouseHelper clicks or double-clicks.
// TODO: Nerdstats writes caused by MeasurePerformance should include null/0 inputs for the unrelated values to keep their graphs in sync and indicate a moment of no rendering.  Non-graphed inputs should be updated accordingly too.

// CONSIDER: (+1 Should be pretty easy) Admin login prompt could pass along a callback method, to refresh panels like the server log, server configuration, full camera list, camera properties.  Also, test all functionality as a standard user to see if admin prompts are correctly shown.

// CONSIDER: I am aware that pausing H.264 playback before the first frame loads will cause no frame to load, and this isn't the best user-experience.  Currently this is more trouble than it is worth to fix.
// CONSIDER: Show status icons in the upper right corner of H.264 video based on values received in the Status blocks.
// CONSIDER: Remove the "Streaming Quality" item from the Live View left bar and change UI scaling sizes to match.
// CONSIDER: The video streaming loop is recursive and in theory this would lead to a stack overflow eventually.  Consider using a setTimeout(..., 0) every 100 or something pump calls to clear the call stack and in theory avoid a stack overflow.
// CONSIDER: Prevent "The video stream was lost. Attempting to reconnect..." from occurring too rapidly e.g. in the event of a stream parsing error (do not reconnect if 5 occurrences in 10 second interval measured using a class similar to the FPS counter?)

///////////////////////////////////////////////////////////////
// Settings ///////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var settings = null;
var settingsCategoryList = ["General Settings", "Hotkeys"];
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
			key: "ui3_audioMute"
			, value: "1"
		}
		, {
			key: "ui3_streamingQuality"
			, value: "S0"
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
			key: "ui3_collapsible_ptz"
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
			key: "ui3_timeout"
			, value: 10
			, inputType: "number"
			, minValue: 0
			, maxValue: 525600
			, label: "The UI will close itself after this many minutes of inactivity. (0 to disable)"
			, category: "General Settings"
		}
		, {
			key: "ui3_preferred_ui_scale"
			, value: "Auto"
			, inputType: "select"
			, options: ["Auto", "Large", "Medium", "Small", "Smaller"]
			, label: "Preferred UI Scale"
			, onChange: OnChange_ui3_preferred_ui_scale
			, category: "General Settings"
		}
		, {
			key: "ui3_doubleClick_behavior"
			, value: "Recordings"
			, inputType: "select"
			, options: ["None", "Live View", "Recordings", "Both"]
			, label: 'Double-Click to Fullscreen<br><a href="javascript:Learn_More_About_Double_Click_to_Fullscreen()">(learn more)</a>'
			, category: "General Settings"
		}
		, {
			key: "ui3_contextMenus_longPress"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Context Menu Compatibility Mode<br><a href="javascript:Learn_More_About_Context_Menu_Compatibility_Mode()">(learn more)</a>'
			, onChange: OnChange_ui3_contextMenus_longPress
			, category: "General Settings"
		}
		, {
			key: "ui3_hotkey_togglefullscreen2"
			, value: "0|0|0|192" // 192: tilde (~`)
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
				defaultSettings[i].label = null;
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
	$DialogDefaults.theme = "dark";

	if (location.protocol == "file:")
	{
		var fileSystemErrorMessage = "This interface must be loaded through the Blue Iris web server, and cannot function when loaded directly from your filesystem.";
		alert(fileSystemErrorMessage);
		toaster.Error(fileSystemErrorMessage, 60000);
	}

	HandlePreLoadUrlParameters();

	LoadDefaultSettings();

	currentPrimaryTab = ValidateTabName(settings.ui3_defaultTab);

	ptzButtons = new PtzButtons();

	if (!h264_playback_supported)
		loadingHelper.SetLoadedStatus("h264"); // We aren't going to load the player, so clear the loading step.

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

	clipboardHelper = new ClipboardHelper();

	uiSizeHelper = new UiSizeHelper();

	uiSettingsPanel = new UISettingsPanel();

	audioPlayer = new AudioPlayer();

	diskUsageGUI = new DiskUsageGUI();

	systemConfig = new SystemConfig();

	cameraProperties = new CameraProperties();

	cameraListDialog = new CameraListDialog();

	clipProperties = new ClipProperties();

	clipDownloadDialog = new ClipDownloadDialog();

	statusBars = new StatusBars();
	statusBars.setLabel("volume", $("#pcVolume"));
	statusBars.addDragHandle("volume");
	statusBars.addOnProgressChangedListener("volume", function (newVolume)
	{
		newVolume = Clamp(parseFloat(newVolume), 0, 1);
		if (!audioPlayer.SuppressAudioVolumeSave())
		{
			settings.ui3_audioMute = "0";
			settings.ui3_audioVolume = newVolume;
		}
		audioPlayer.SetVolume(newVolume);
	});
	statusBars.addLabelClickHandler("volume", function ()
	{
		settings.ui3_audioMute = (settings.ui3_audioMute == "1" ? "0" : "1");
		audioPlayer.SetAudioVolumeFromSettings();
	});
	audioPlayer.SetAudioVolumeFromSettings();

	dropdownBoxes = new DropdownBoxes();

	genericQualityHelper = new GenericQualityHelper();

	jpegQualityHelper = new JpegQualityHelper();

	h264QualityHelper = new H264QualityHelper();

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
	videoPlayer.PreLoadPlayerModules();

	imageRenderer = new ImageRenderer();

	statusLoader = new StatusLoader();

	sessionManager = new SessionManager();

	cameraListLoader = new CameraListLoader();

	clipLoader = new ClipLoader("#clipsbody");

	nerdStats = new UI3NerdStats();

	sessionTimeout = new SessionTimeout();

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
///////////////////////////////////////////////////////////////
// Incoming URL Parameters ////////////////////////////////////
///////////////////////////////////////////////////////////////
function HandlePreLoadUrlParameters()
{
	// Parameter "tab"
	var tab = UrlParameters.Get("tab");
	if (tab != '')
		OverrideDefaultSetting("ui3_defaultTab", tab, true, true, 0);

	// Parameter "group"
	var group = UrlParameters.Get("group");
	if (group != '')
		OverrideDefaultSetting("ui3_defaultCameraGroupId", group, true, true, 0);

	// Parameter "cam"
	var cam = UrlParameters.Get("cam");
	if (cam != '')
	{
		BI_CustomEvent.AddListener("FinishedLoading", function ()
		{
			var camData = cameraListLoader.GetCameraWithId(cam);
			if (camData != null)
				videoPlayer.ImgClick_Camera(camData);
		});
	}
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
	var camimg_loading_anim = $("#camimg_loading_anim,#camimg_false_loading_anim");
	var videoCenter_Icons = $("#camimg_playIcon,#camimg_pauseIcon");
	var videoCenter_Bg = $("#camimg_centerIconBackground");

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
	layoutbody.css("top", topH + "px");
	layoutbody.css("left", leftW + "px");
	var bodyW = windowW - leftW;
	var bodyH = windowH - topH - botH;
	layoutbody.css("width", bodyW + "px");
	layoutbody.css("height", bodyH + "px");

	// Size camimg_loading_anim
	var camimg_loading_anim_Size = Clamp(Math.min(bodyW, bodyH), 10, 120);
	camimg_loading_anim.css("top", ((bodyH - camimg_loading_anim_Size) / 2) + "px");
	camimg_loading_anim.css("left", ((bodyW - camimg_loading_anim_Size) / 2) + "px");
	camimg_loading_anim.css("width", camimg_loading_anim_Size + "px");
	camimg_loading_anim.css("height", camimg_loading_anim_Size + "px");

	// Size videoCenter_Bg
	var videoCenter_Bg_Size = Clamp(Math.min(bodyW, bodyH), 10, 72);
	videoCenter_Bg.css("top", ((bodyH - videoCenter_Bg_Size) / 2) + "px");
	videoCenter_Bg.css("left", ((bodyW - videoCenter_Bg_Size) / 2) + "px");
	videoCenter_Bg.css("width", videoCenter_Bg_Size + "px");
	videoCenter_Bg.css("height", videoCenter_Bg_Size + "px");

	// Size videoCenter_Icons
	var videoCenter_Icon_Size = Clamp(Math.min(bodyW, bodyH), 10, 40);
	videoCenter_Icons.css("top", ((bodyH - videoCenter_Icon_Size) / 2) + "px");
	videoCenter_Icons.css("left", ((bodyW - videoCenter_Icon_Size) / 2) + "px");
	videoCenter_Icons.css("width", videoCenter_Icon_Size + "px");
	videoCenter_Icons.css("height", videoCenter_Icon_Size + "px");

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
	var largeMinH = 1042; // 1075
	var mediumMinH = 786; // 815
	var largeMinW = 670;// 550 575 1160;
	var mediumMinW = 540;// 450 515 900;
	var smallMinW = 350;//680;
	var currentSize = "large";
	var autoSize = true;

	this.SetMostAppropriateSize = function (availableWidth, availableHeight)
	{
		if (autoSize)
		{
			if (availableWidth < smallMinW)
				SetSize("smaller");
			else if (availableHeight < mediumMinH || availableWidth < mediumMinW)
				SetSize("small");
			else if (availableHeight < largeMinH || availableWidth < largeMinW)
				SetSize("medium");
			else
				SetSize("large");
		}
	}
	var SetSize = function (size)
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
	this.SetUISizeByName = function (size)
	{
		if (size)
			size = size.toLowerCase();
		autoSize = size == "auto";
		if (!autoSize)
			SetSize(size);
		resized();
		//setTimeout(resized);
	}

	setTimeout(function () { self.SetUISizeByName(settings.ui3_preferred_ui_scale); }, 0);
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
	this.setLabel = function (name, label)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			for (var i = 0; i < statusEles.length; i++)
				statusEles[i].$label && statusEles[i].$label.append(label);
	};
	this.getLabelObjs = function (name)
	{
		var statusEles = statusElements[name];
		if (statusEles)
			return $(statusEles);
		return $();
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
	this.addLabelClickHandler = function (name, onLabelClick)
	{
		var $labels = self.getLabelObjs(name);
		$labels.each(function (idx, ele)
		{
			$(ele).children('.statusBarLabel').on('click', onLabelClick);
		});
	}
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
	var streamingQualityList = this.listDefs["streamingQuality"] = new DropdownListDefinition("streamingQuality",
		{
			selectedIndex: -1
			, items:
			[
				new DropdownListItem({ player: "jpeg", text: "Jpeg Best Quality", uniqueQualityId: "A", abbr: "HD", shortAbbr: "HD" })
				, new DropdownListItem({ player: "jpeg", text: "Jpeg SD (640)", uniqueQualityId: "B", abbr: "SD", shortAbbr: "SD" })
				, new DropdownListItem({ player: "jpeg", text: "Jpeg Low (320)", uniqueQualityId: "C", abbr: "Low", shortAbbr: "LD" })
			]
			, onItemClick: function (item)
			{
				settings.ui3_streamingQuality = item.uniqueQualityId;
				videoPlayer.SelectedQualityChanged();
			}
			, getDefaultLabel: function ()
			{
				for (var i = 0; i < this.items.length; i++)
					if (settings.ui3_streamingQuality == this.items[i].uniqueQualityId)
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
					settings.ui3_streamingQuality = this.items[index].uniqueQualityId;
				}
			}
		});
	if (h264_playback_supported)
	{
		streamingQualityList.items.splice(0, 0
			, new DropdownListItem({ player: "h264", text: "H.264 Streaming 0", uniqueQualityId: "S0", abbr: "H.264 0", shortAbbr: "S0" })
			, new DropdownListItem({ player: "h264", text: "H.264 Streaming 1", uniqueQualityId: "S1", abbr: "H.264 1", shortAbbr: "S1" })
			, new DropdownListItem({ player: "h264", text: "H.264 Streaming 2", uniqueQualityId: "S2", abbr: "H.264 2", shortAbbr: "S2" })
		);
	}
	var selectPreferredQuality = function ()
	{
		streamingQualityList.selectedIndex = 0;
		for (var i = 0; i < streamingQualityList.items.length; i++)
		{
			if (settings.ui3_streamingQuality == streamingQualityList.items[i].uniqueQualityId)
			{
				streamingQualityList.selectedIndex = i;
				return;
			}
		}
		if (streamingQualityList.items.length > 0)
			settings.ui3_streamingQuality = streamingQualityList.items[0].uniqueQualityId;
	}
	selectPreferredQuality();
	this.listDefs["mainMenu"] = new DropdownListDefinition("mainMenu",
		{
			selectedIndex: -1
			, items:
			[
				new DropdownListItem({ cmd: "ui_settings", text: "UI Settings", icon: "#svg_x5F_Settings", cssClass: "goldenLarger", tooltip: "User interface settings are stored in this browser and are not shared with other computers." })
				, new DropdownListItem({ cmd: "about_this_ui", text: "About This UI", icon: "#svg_x5F_About", cssClass: "goldenLarger" })
				, new DropdownListItem({ cmd: "system_log", text: "System Log", icon: "#svg_x5F_SystemLog", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "user_list", text: "User List", icon: "#svg_x5F_User", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "device_list", text: "Device List", icon: "#svg_mio_deviceInfo", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "full_camera_list", text: "Full Camera List", icon: "#svg_x5F_FullCameraList", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "disk_usage", text: "Disk Usage", icon: "#svg_x5F_Information", cssClass: "blueLarger" })
				, new DropdownListItem({ cmd: "system_configuration", text: "System Configuration", icon: "#svg_x5F_SystemConfiguration", cssClass: "blueLarger", tooltip: "Blue Iris Settings" })
				, new DropdownListItem({ cmd: "logout", text: "Log Out", icon: "#svg_x5F_Logout", cssClass: "goldenLarger" })
			]
			, onItemClick: function (item)
			{
				switch (item.cmd)
				{
					case "ui_settings":
						uiSettingsPanel.open();
						break;
					case "about_this_ui":
						openAboutDialog();
						break;
					case "system_log":
						systemLog.open();
						break;
					case "user_list":
						userList.open();
						break;
					case "device_list":
						deviceList.open();
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
		if (item.icon)
			$item.prepend('<div class="mainMenuIcon"><svg class="icon' + (item.icon.indexOf('_x5F_') == -1 ? " noflip" : "") + '"><use xlink:href="' + item.icon + '"></use></svg></div>');
		if (item.tooltip)
			$item.attr('title', item.tooltip);
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
		var $descInput = $('<input type="text" />');
		$descInput.val(self.GetPresetDescription(presetNum));
		var $question = $('<div style="margin:7px 3px 20px 3px;text-align:center;">Enter a description:<br><br></div>');
		$question.append($descInput);
		AskYesNo($question, function ()
		{
			PTZ_set_preset(presetNum, $descInput.val());
		}, null, toaster.Error, "Set Preset " + presetNum, "Cancel", videoPlayer.Loading().cam.optionDisplay);
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
		if (settings.ui3_contextMenus_longPress != "1")
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
	var self = this;
	var $canvas = $("#canvas_clipTimeline");
	var canvas = $canvas.get(0);
	var dpiScale = BI_GetDevicePixelRatio();
	var isDragging = false;
	var currentSelectedRelativePosition = -1;
	var currentGhostRelativePosition = -1;
	var currentSoftGhostRelativePosition = -1;
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
		var startOfDay = GetReverseServerDate(new Date(noonDateObj.getFullYear(), noonDateObj.getMonth(), noonDateObj.getDate()));
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
	this.hideTimeMs_Live = 1500;
	this.hideTimeMs_Recordings = 3000;
	var $layoutbody = $("#layoutbody");
	var $pc = $("#playbackControls");
	var $playbackSettings = $();
	var buttonContainer = $("#pcButtonContainer");
	var $progressText = $("#playbackProgressText");
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
	this.SetProgressText = function (text)
	{
		$progressText.text(text);
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
		if (videoPlayer.Loading().image.isLive)
		{
			playbackHeader.Hide();
			$("#seekBarWrapper").hide();
			$("#pcButtonContainer .hideWhenLive").hide();
		}
		else
		{
			playbackHeader.Show();
			$("#seekBarWrapper").show();
			$("#pcButtonContainer .hideWhenLive").show();
		}
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
		if (videoPlayer.Loading().image.isLive)
			playbackHeader.Hide();
		else
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
	this.Live = function ()
	{
		self.Show();
		$pc.addClass("live");
		self.SetProgressText("Loading...");
		self.setPlayPauseButtonState();
	}
	this.Recording = function ()
	{
		self.Show();
		$pc.removeClass("live");
		self.SetProgressText("Loading...");
		self.setPlayPauseButtonState();
	}
	this.setPlayPauseButtonState = function (paused)
	{
		if (videoPlayer.Loading().image.isLive)
		{
			$("#pcPlay").hide();
			$("#pcPause").hide();
		}
		else if (paused)
		{
			$("#pcPlay").show();
			$("#pcPause").hide();
		}
		else
		{
			$("#pcPlay").hide();
			$("#pcPause").show();
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
		if (pointInsideElement($layoutbody, e.pageX, e.pageY))
			return;
		clearHideTimout();
		self.FadeOut();
	});
	$layoutbody.on("mouseenter mousemove mousedown mouseup touchstart touchmove touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		self.FadeIn();
		clearHideTimout();
		if (!pointInsideElement($pc, e.pageX, e.pageY) && !pointInsideElement($playbackSettings, e.pageX, e.pageY))
			hideTimeout = setTimeout(function () { self.FadeOut(); }, videoPlayer.Loading().image.isLive ? self.hideTimeMs_Live : self.hideTimeMs_Recordings);
	});
	$(document).mouseup(function (e)
	{
		if (!self.MouseInSettingsPanel(e))
			CloseSettings();
	});
	this.OpenSettingsPanel = function ()
	{
		if (new Date().getTime() - 33 <= settingsClosedAt)
			return;
		if (videoPlayer.Loading().image.isLive)
			return OpenQualityPanel();
		RebuildSettingsPanelEmpty();
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
			+ genericQualityHelper.GetAbbr()
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
				videoPlayer.PlaybackSpeedChanged(playSpeed);
			});
			$playbackSettings.append($item);
		}

		$layoutbody.append($playbackSettings);
	}
	var OpenQualityPanel = function ()
	{
		RebuildSettingsPanelEmpty();
		$playbackSettings.addClass("qualityPanel");
		var live = videoPlayer.Loading().image.isLive;
		var $backBtn = $('<div class="playbackSettingsLine playbackSettingsHeading">'
			+ (live ? '' : '<div class="playbackSettingsLeftArrow"><svg class="icon"><use xlink:href="#svg_x5F_PTZcardinalLeft"></use></svg></div> ')
			+ (live ? 'Streaming ' : '') + 'Quality</div>');
		if (!live)
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
				videoPlayer.SelectedQualityChanged();
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
		videoPlayer.PlaybackDirectionChanged(playReverse);
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
			hintText = genericQualityHelper.GetShortAbbr();
		$("#playbackSettingsQualityMark").removeClass("HD SD LD S0 S1 S2");
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
	var $layoutbody = $("#layoutbody");
	var wrapper = $("#seekBarWrapper");
	var bar = $("#seekBarMain");
	var left = $("#seekBarLeft");
	var handle = $("#seekBarHandle");
	var seekhint = $("#seekhint");
	var seekhint_img = $("#seekhint_img");
	var seekhint_canvas = $("#seekhint_canvas");
	var seekhint_loading = $("#seekhint_loading");
	var seekhint_helper = $("#seekhint_helper");
	var seekhint_label = $("#seekhint_label");
	var highlight = $("#seekBarHighlight");
	var seekHintVisible = false;
	var isDragging = false;
	var isTouchDragging = false;
	var didPauseOnDrag = false;
	var seekHintInfo = { canvasVisible: false, helperVisible: false, visibleMsec: -1, queuedMsec: -1, loadingMsec: -1, lastSnapshotId: "" }

	seekhint_img.load(function ()
	{
		if (isDragging)
			jpegPreviewModule.RenderImage("seekhint_img");
		CopyImageToCanvas("seekhint_img", "seekhint_canvas");
		seekhint_loading.hide();
		seekHintInfo.loading = false;
		seekHintInfo.visibleMsec = seekHintInfo.loadingMsec;
		if (seekHintInfo.queuedMsec != -1)
			loadSeekHintImg(seekHintInfo.queuedMsec);
	});
	seekhint_img.error(function ()
	{
		ClearCanvas("seekhint_canvas");
		seekhint_loading.hide();
		seekHintInfo.loading = false;
		seekHintInfo.loadingMsec = seekHintInfo.visibleMsec = -1;
		if (seekHintInfo.queuedMsec != -1)
			loadSeekHintImg(seekHintInfo.queuedMsec);
	});

	this.resized = function ()
	{
		self.drawSeekbarAtPercent(videoPlayer.GetClipPlaybackPositionPercent());
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
				seekhint_loading.hide();
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
		var bodyO = $layoutbody.offset();
		var barO = bar.offset();
		var barW = bar.width();

		var hintX = Clamp(e.pageX - barO.left, 0, barW);
		var seekHintW = seekhint.outerWidth();
		var seekHintL = (hintX + barO.left) - (seekHintW / 2) - bodyO.left;
		var barMarginL = barO.left - bodyO.left;
		seekHintL = Clamp(seekHintL, barMarginL, (barMarginL + barW) - seekHintW);
		seekhint.css("left", seekHintL + "px");
		var positionRelative = (hintX / barW);
		var seekHintMs = Clamp(parseInt(positionRelative * (msec - 1)), 0, msec);
		if (videoPlayer.Playback_IsPaused())
		{
			// show preview image
			setSeekHintCanvasVisibility(!isDragging);
			setSeekHintHelperVisibility(false);
			if (seekHintInfo.visibleMsec == seekHintInfo.loadingMsec)
				loadSeekHintImg(seekHintMs);
			else
				seekHintInfo.queuedMsec = seekHintMs;
		}
		else
		{
			setSeekHintCanvasVisibility(false);
			setSeekHintHelperVisibility(true);
		}
		seekhint_label.html(msToTime(seekHintMs, msec < 30000 ? 1 : 0));
		seekhint.css("top", ((barO.top - 10) - seekhint.outerHeight(true) - bodyO.top) + "px");
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
			var h = (160 / videoPlayer.Loading().image.aspectratio);
			seekhint_canvas.css('height', h + 'px');
			seekhint_loading.css('height', h + 'px');
			if (seekHintInfo.canvasVisible)
				seekhint_loading.show();
			if (isDragging)
				videoOverlayHelper.ShowLoadingOverlay(true, true);
			seekhint_img.attr('src', videoPlayer.GetLastSnapshotUrl().replace(/time=\d+/, "time=" + msec) + "&w=160&q=50");
		}
	}
	this.resetSeekHintImg = function ()
	{
		seekHintInfo.loadingMsec = seekHintInfo.queuedMsec = seekHintInfo.visibleMsec = -1;
		seekhint_canvas.css('height', (160 / videoPlayer.Loading().image.aspectratio) + 'px');
		ClearCanvas("seekhint_canvas");
		seekhint_loading.hide();
	}
	this.drawSeekbarAtPercent = function (percentValue)
	{
		var seekbarW = bar.width();
		var x = percentValue * seekbarW;
		x = Clamp(x, 0, seekbarW);
		left.css("width", x + "px");
		handle.css("left", x + "px");
		var msec = videoPlayer.Loading().image.msec;
		var timeValue;
		if (percentValue >= 1)
			timeValue = msec;
		else if (percentValue <= 0)
			timeValue = 0;
		else
			timeValue = (msec - 1) * percentValue;
		if (!videoPlayer.Loading().image.isLive)
			playbackControls.SetProgressText(msToTime(timeValue, 0) + " / " + msToTime(msec, 0));
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
		if (!videoPlayer.Loading().image.isLive)
			playbackControls.SetProgressText(msToTime(timeValue, 0) + " / " + msToTime(msec, 0));
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
	var mouseUp = function (e)
	{
		mouseCoordFixer.fix(e);

		if (!isDragging)
			return;

		mouseMoved(e);

		var barO = bar.offset();
		var barW = bar.width();
		var x = (e.pageX - barO.left);
		x = Clamp(x, 0, barW);
		var msec = videoPlayer.Loading().image.msec;
		if (msec <= 1)
			videoPlayer.SeekToPercent(0, didPauseOnDrag);
		else
		{
			var positionRelative = x / barW;
			videoPlayer.SeekToPercent(positionRelative, didPauseOnDrag);
		}
		didPauseOnDrag = false;

		isTouchDragging = false;
		isDragging = false;
		if (touchEvents.isTouchEvent(e) || !pointInsideElement(wrapper, e.pageX, e.pageY))
			SetBarState(0);
		updateSeekHint(e);
	}
	var mouseMoved = function (e)
	{
		if (isDragging)
		{
			var barO = bar.offset();
			var barW = bar.width();
			var x = (e.pageX - barO.left);
			x = Clamp(x, 0, barW);
			left.css("width", x + "px");
			handle.css("left", x + "px");
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
			isDragging = true;
			didPauseOnDrag = !videoPlayer.Playback_IsPaused();
			videoPlayer.Playback_Pause();
			isTouchDragging = touchEvents.isTouchEvent(e);

			videoOverlayHelper.ShowLoadingOverlay();

			SetBarState(1);

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
	var mouseEventsBlockedUntil = -60000;
	this.Gate = function (e)
	{
		// Returns true if the event handler should be prevented due to being a non-touch event after recent touch events
		if (self.isTouchEvent(e))
		{
			mouseEventsBlockedUntil = performance.now() + 1000;
			return false;
		}
		else
			return mouseEventsBlockedUntil > performance.now();
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
	var loadClipsInternal = function (listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList, previousClipDate)
	{
		if ((currentPrimaryTab != "clips" && currentPrimaryTab != "alerts") || self.suppressClipListLoad)
		{
			QueuedClipListLoad = null;
			return;
		}
		if (!previousClipDate)
			previousClipDate = new Date(0);
		if (typeof (listName) == "undefined" || listName == null)
			listName = currentPrimaryTab == "clips" ? "cliplist" : "alertlist";
		if (!isContinuationOfPreviousLoad && !isUpdateOfExistingList)
		{
			if (isLoadingAClipList)
			{
				QueuedClipListLoad = function ()
				{
					loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList, previousClipDate);
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
					clipData.displayDate = GetServerDate(clipData.date);
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

					if (!isSameDay(previousClipDate, clipData.displayDate))
					{
						// TODO: (minor importance) Deal with adding new date tiles when isUpdateOfExistingList is true.  Perhaps just fake it and do a full clip list load when the system time changes from one day to the next.
						if (previousClipDate.getTime() == 0)
							$clipListTopDate.attr("defaultStr", GetDateDisplayStr(clipData.displayDate)); // Do not add the first date tile because it is redundant with a date display above the list.
						else if (!isUpdateOfExistingList)
						{
							tileLoader.registerOnAppearDisappear({ isDateTile: true, date: clipData.displayDate }, DateTileOnAppear, DateTileOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
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
					return loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, true, isUpdateOfExistingList, previousClipDate);
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

				if (TotalUniqueClipsLoaded == 0)
				{
					$clipsbody.append('<div class="clipListText">No recordings were found in the specified time range.</div>');
				}
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
				var tryAgain = !isContinuationOfPreviousLoad && ++failedClipListLoads < 5
				toaster.Error("Failed to load " + (listName == "cliplist" ? "clip list" : "alert list") + ".<br/>Will " + (tryAgain ? "" : "NOT ") + "try again.<br/>" + textStatus + "<br/>" + errorThrown, 5000);

				if (tryAgain)
				{
					setTimeout(function ()
					{
						loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList, previousClipDate);
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
			var date = GetDateStr(clipData.displayDate);
			date = date.replace(/\//g, '-').replace(/:/g, '.');
			retVal.download = cameraListLoader.GetCameraName(clipData.camera) + " " + date + clipData.path.substr(extensionIdx);
		}
		return retVal;
	}
	this.GetClipDisplayName = function (clipData)
	{
		var date = GetDateStr(clipData.displayDate);
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
			var timeStr = GetTimeStr(clipData.displayDate);
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
					function (message)
					{
						toaster.Warning(message, 10000);
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
var serverTimeZoneOffsetMs = 0;
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
		if (fps > 0.5)
			statusBars.setColor("fps", "default");
		else if (fps > 0.25)
			statusBars.setColor("fps", "#CCAA00");
		else if (fps > 0.1)
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
				serverTimeZoneOffsetMs = parseInt(parseFloat(response.data.tzone) * -60000);
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
				ProfileChanged(oldStatus.data.profile, newStatus.data.profile);
		}
	}
	var ProfileChanged = function (oldProfileNum, newProfileNum)
	{
		// Refresh the clips and camera lists.
		toaster.Info("Your profile has changed from &quot;<b>" + self.GetProfileName(oldProfileNum)
			+ "</b>&quot; to &quot;<b>" + self.GetProfileName(newProfileNum) + "</b>&quot;", 5000);
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
			for (var i = 0; i < currentProfileNames.length; i++)
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
	this.GetProfileName = function (profileNum)
	{
		profileNum = parseInt(profileNum);
		if (currentProfileNames && profileNum >= 0 && profileNum < currentProfileNames.length)
			return currentProfileNames[profileNum];
		return "Profile " + profileNum;
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
		var $dud = $('<div id="diskUsageDialog"></div>');
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
		$legend.append(CreateLegendItem('#333333', 'Other files'));
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
		$dud.dialog({ title: "Disk Usage" });
	}
	var CreateLegendItem = function (color, label)
	{
		return $('<div class="pieLegendItem"><div class="pieLegendBox" style="background-color:' + color + ';"></div>' + label + '</div>');
	}
	var GetDisk = function (disk)
	{
		// Make sure we have numeric values for all of these, no strings. Units are MiB.
		disk.allocated = parseInt(disk.allocated);
		disk.used = parseInt(disk.used);
		disk.free = parseInt(disk.free);
		disk.total = parseInt(disk.total);

		var bi_allocated = disk.allocated;
		var bi_used = disk.used;
		var disk_freeSpace = disk.free;
		var disk_capacity = disk.total;

		// Compensate for minor rounding errors.
		if (disk_capacity - disk.used - disk.free < -5)
			toaster.Warning("Reported disk info is invalid.  Possibly Blue Iris's clip database is corrupt and needs repaired.", 30000);
		if (disk_capacity - disk.used - disk.free < 0)
			disk_capacity = disk.used + disk.free;

		// Extrapolate complete disk usage information from the 4 values provided
		var bi_free = bi_allocated - bi_used; // Remaining space in allocation.  This may be negative, or may be larger than actual free space.
		var disk_usedSpace = disk_capacity - disk_freeSpace; // Overall disk used space
		var other_used = disk_usedSpace - bi_used; // Space used by other files
		var other_free = disk_freeSpace - bi_free; // Free space outside BI's allocation
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
		if (lastResponse.data && lastResponse.data.profiles && lastResponse.data.profiles.length > 0)
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
		if (unscaled == null)
			return null;
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

	var currentlyLoadingCamera = null;
	var currentlyLoadedCamera = null;
	var currentlyLoadingImage = new BICameraData();
	var currentlyLoadedImage = new BICameraData();

	var lastLiveCameraOrGroupId = "";
	var currentlySelectedHomeGroupId = null;

	var mouseHelper = null;

	this.suppressMouseHelper = function ()
	{
		/// <summary>Call this from mouse or touch events that conflict with the VideoPlayer's double-click helper, and past events will no longer count toward new clicks or drags.</summary>
		if (mouseHelper)
			mouseHelper.Invalidate();
	}

	this.getDoubleClickTime = function ()
	{
		return mouseHelper.getDoubleClickTime();
	}

	this.CurrentPlayerModuleName = function ()
	{
		if (playerModule == moduleHolder["jpeg"])
			return "jpeg";
		else if (playerModule == moduleHolder["h264"])
			return "h264";
		return "none";
	}
	this.DeactivatePlayer = function ()
	{
		if (playerModule)
			playerModule.Deactivate();
	}
	this.SetPlayerModule = function (moduleName, refreshVideoNow)
	{
		var position = 0;
		var paused = false;
		if (playerModule != null)
		{
			if (playerModule == moduleHolder[moduleName])
				return;
			position = playerModule.GetSeekPercent();
			paused = playerModule.Playback_IsPaused();
			playerModule.Deactivate();
		}

		if (moduleName == "jpeg")
		{
			playerModule = moduleHolder[moduleName];
		}
		else if (moduleName == "h264")
		{
			playerModule = moduleHolder[moduleName];
		}
		if (refreshVideoNow)
			playerModule.OpenVideo(currentlyLoadingImage, position, paused);
	}
	this.RefreshVideoStream = function ()
	{
		if (playerModule)
			playerModule.OpenVideo(currentlyLoadingImage, playerModule.GetSeekPercent(), playerModule.Playback_IsPaused());
	}
	this.PreLoadPlayerModules = function ()
	{
		if (moduleHolder["jpeg"] == null)
			moduleHolder["jpeg"] = new JpegVideoModule();
		if (moduleHolder["h264"] == null && h264_playback_supported)
		{
			$("#loadingH264").parent().show();
			moduleHolder["h264"] = new FetchOpenH264VideoModule();
		}
	}

	this.Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;

		self.PreLoadPlayerModules();
		self.SetPlayerModule(genericQualityHelper.GetPlayerID(), true);

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
		mouseHelper = new MouseEventHelper($("#layoutbody,#zoomhint")
			, $("#playbackHeader,#playbackControls") // Excluded while viewing recordings
			, $("#playbackControls .pcButton,#volumeBar") // Excluded while viewing live
			, function (e) { return playbackControls.MouseInSettingsPanel(e); } // exclude click if returns true
			, function (e, confirmed) // Single Click
			{
				videoOverlayHelper.HideFalseLoadingOverlay();
				if (currentlyLoadingImage.isLive)
				{
					// Live View
					if (IsDoubleClickFullscreenEnabled())
					{
						if (confirmed)
							ImgClick(e);
						else
							DoThingIfImgClickEligible(e, videoOverlayHelper.ShowFalseLoadingOverlay);
					}
					else if (!confirmed)
						ImgClick(e);
				}
				else
				{
					// Recording
					if (!confirmed)
					{
						if (self.Playback_IsPaused())
							videoOverlayHelper.ShowTemporaryPlayIcon();
						else
							videoOverlayHelper.ShowTemporaryPauseIcon();
					}
					var dblClickEnabled = IsDoubleClickFullscreenEnabled();
					if ((confirmed && dblClickEnabled) || (!confirmed && !dblClickEnabled))
					{
						self.Playback_PlayPause();
					}
				}
			}
			, function (e) // Double Click
			{
				if (!IsDoubleClickFullscreenEnabled())
					return;
				videoOverlayHelper.HideFalseLoadingOverlay();
				if (currentlyLoadingImage.isLive)
				{
					fullScreenModeController.toggleFullScreen();
				}
				else
				{
					videoOverlayHelper.HideTemporaryIcons();
					fullScreenModeController.toggleFullScreen();
				}
			}
			, imageRenderer.CamImgDragStart
			, imageRenderer.CamImgDragMove
			, imageRenderer.CamImgDragEnd
		);
	}
	var IsDoubleClickFullscreenEnabled = function ()
	{
		if (settings.ui3_doubleClick_behavior == "Both")
			return true;
		if (currentlyLoadingImage.isLive)
			return settings.ui3_doubleClick_behavior == "Live View"
		else
			return settings.ui3_doubleClick_behavior == "Recordings"
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
	this.GetClipPlaybackPositionPercent = function ()
	{
		if (currentlyLoadingImage.isLive)
			return 0;
		return playerModule.GetSeekPercent();
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
	var DoThingIfImgClickEligible = function (event, thing)
	{
		/// <summary>A silly method that does all the validation and clicked-camera identification from the ImgClick function, then calls a callback method.</summary>
		if (!currentlyLoadingImage.isLive)
			return;
		// mouseCoordFixer.fix(event); // Don't call this more than once per event!
		var camData = self.GetCameraUnderMousePointer(event);
		if (camData != null && !cameraListLoader.HasOnlyOneCamera() && !cameraListLoader.CameraIsCycle(camData))
		{
			thing(camData);
		}
	}
	var ImgClick = function (event)
	{
		DoThingIfImgClickEligible(event, self.ImgClick_Camera);
	}
	// CONSIDER: Make ImgClick_Camera private
	this.ImgClick_Camera = function (camData)
	{
		var scaleOut = false;
		if (camData.optionValue == currentlyLoadedImage.id)
		{
			// Back to Group
			camData = cameraListLoader.GetGroupCamera(currentlySelectedHomeGroupId);
			if (scaleOut && playerModule.DrawFullCameraAsThumb)
				playerModule.DrawFullCameraAsThumb(currentlyLoadedImage.id, camData.optionValue);
			self.LoadLiveCamera(camData);
			if (scaleOut && playerModule.DrawFullCameraAsThumb)
				self.CameraOrResolutionChange(); // TODO: Verify this is working correctly here
		}
		else
		{
			// Maximize
			if (playerModule.DrawThumbAsFullCamera)
				playerModule.DrawThumbAsFullCamera(camData.optionValue);
			self.LoadLiveCamera(camData);
			if (playerModule.DrawThumbAsFullCamera)
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

		playbackControls.Live();
		ptzButtons.UpdatePtzControlDisplayState();
		dropdownBoxes.setLabelText("currentGroup", CleanUpGroupName(clc.optionDisplay));

		if (skipTabLoadClipLoad)
			skipTabLoadClipLoad = false;
		else
			clipLoader.LoadClips(); // This method does nothing if not on the clips/alerts tabs.

		videoOverlayHelper.ShowLoadingOverlay(true);
		if (playerModule)
			playerModule.OpenVideo(cli);

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
			playbackControls.Recording();
			playbackControls.SetDownloadClipLink(clipData);
			if (clipLoader.ClipDataIndicatesFlagged(clipData))
				$("#clipFlagButton").addClass("flagged");
			else
				$("#clipFlagButton").removeClass("flagged");
			seekBar.drawSeekbarAtPercent(0);
			seekBar.resetSeekHintImg();

			videoOverlayHelper.ShowLoadingOverlay(true);
			if (playerModule)
				playerModule.OpenVideo(cli);
		}
		else
			toaster.Error("Could not find camera " + htmlEncode(clipData.camera) + " associated with clip.");

		fullScreenModeController.updateFullScreenButtonState();
	}

	this.SeekToPercent = function (pos, play)
	{
		seekBar.drawSeekbarAtPercent(pos);
		playerModule.OpenVideo(currentlyLoadingImage, pos, !play);
	}
	this.SeekByMs = function (offset)
	{
		var msLength = currentlyLoadingImage.msec - 1;
		if (msLength <= 0)
			return;
		var currentMs = playerModule.GetSeekPercent() * msLength;
		var newPos = (currentMs + offset) / msLength;
		newPos = Clamp(newPos, 0, 1);
		self.SeekToPercent(newPos);
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
		if (playerModule.Playback_IsPaused())
			playerModule.Playback_Play();
		else
			playerModule.Playback_Pause();
	}
	this.Playback_NextClip = function ()
	{
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
	this.PlaybackSpeedChanged = function (playSpeed)
	{
		if (typeof playerModule.PlaybackSpeedChanged == "function")
			playerModule.PlaybackSpeedChanged(playSpeed);
	}
	this.SelectedQualityChanged = function ()
	{
		var requiredPlayer = genericQualityHelper.GetPlayerID();
		if (requiredPlayer != self.CurrentPlayerModuleName())
		{
			// playerModule must change, no need to notify the new one of the quality change.
			self.SetPlayerModule(requiredPlayer, true);
		}
		else
		{
			// playerModule remains the same, so we should notify it of the quality change.
			if (typeof playerModule.SelectedQualityChanged == "function")
				playerModule.SelectedQualityChanged();
		}
	}
	this.PlaybackDirectionChanged = function (playReverse)
	{
		if (typeof playerModule.PlaybackDirectionChanged == "function")
			playerModule.PlaybackDirectionChanged(playReverse);
	}
	// Callback methods for a player module to inform the VideoPlayerController of state changes.
	this.CameraOrResolutionChange = function ()
	{
		imageRenderer.SetDigitalZoom(0);
		currentlyLoadedImage.CopyValuesFrom(currentlyLoadingImage);
		currentlyLoadedCamera = currentlyLoadingCamera;
		resized();
	}
	this.ImageRendered = function (path, width, height, lastFrameLoadingTime, lastFrameDate)
	{
		jpegPreviewModule.Hide();
		if (currentlyLoadedImage.path != path)
			self.CameraOrResolutionChange();

		// actualwidth and actualheight must be set after [CameraOrResolutionChange]
		currentlyLoadedImage.actualwidth = width;
		currentlyLoadedImage.actualheight = height;

		RefreshFps(lastFrameLoadingTime);

		if (currentlyLoadingImage.isLive && lastFrameDate)
		{
			var str = "";
			var w = $("#layoutbody").width();
			if (w < 240)
				str = "LIVE";
			else if (w < 325)
				str = "LIVE: " + GetTimeStr(GetServerDate(lastFrameDate))
			else
				str = "LIVE: " + GetDateStr(GetServerDate(lastFrameDate))
			playbackControls.SetProgressText(str);
		}

		if (currentlyLoadingImage.path != path)
			return;

		if (!currentlyLoadedImage.isLive)
			seekBar.drawSeekbarAtPercent(playerModule.GetSeekPercent());
		videoOverlayHelper.HideLoadingOverlay();
	}
	this.Playback_Ended = function (isLeftBoundary)
	{
		// The module may call this repeatedly 
		videoOverlayHelper.HideLoadingOverlay();
		if (isLeftBoundary)
		{
			seekBar.drawSeekbarAtPercent(0);
			if (playbackControls.GetPlayReverse())
			{
				if (playbackControls.GetLoopingEnabled())
					self.SeekToPercent(1);
				else if (playbackControls.GetAutoplay())
					self.Playback_PreviousClip();
				else
					self.Playback_Pause();
			}
		}
		else
		{
			seekBar.drawSeekbarAtPercent(1);
			if (!playbackControls.GetPlayReverse())
			{
				if (playbackControls.GetLoopingEnabled())
					self.SeekToPercent(0);
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
		var currentFps = fpsCounter.getFPS(imgRequestMs);
		var maxFps = currentlyLoadingCamera.FPS || 10;
		statusBars.setProgress("fps", (currentFps / maxFps), currentFps);

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
// Jpeg Preview Module ////////////////////////////////////////
///////////////////////////////////////////////////////////////
var jpegPreviewModule = new (function JpegPreviewModule()
{
	/// <summary>Manages showing and hiding a canvas as necessary to render seek previews in the full video area.</summary>
	var self = this;
	var isActivated = false;
	var isInitialized = false;
	var isVisible = false;
	var $myImgEle = null;
	var Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;
		$("#camimg_store").append('<canvas id="camimg_preview" class="videoCanvas"></canvas>');
		$myImgEle = $('<img crossOrigin="Anonymous" id="jpegPreview_img" alt="" style="display: none;" />');
		$myImgEle.load(function ()
		{
			var img = $myImgEle.get(0);
			if (!img.complete || typeof img.naturalWidth == "undefined" || img.naturalWidth == 0)
			{
				// Failed
				toaster.Error("Unable to decode jpeg image.");
			}
			else
			{
				// Calling ImageRendered will hide the jpegPreviewModule so we should call it before rendering the image
				videoPlayer.ImageRendered(img.myPath, this.naturalWidth, this.naturalHeight, performance.now() - img.startTime, false);
				// Rendering the image shows the jpegPreviewModule again.
				self.RenderImage(img.id);
			}
		});
		$myImgEle.error(function ()
		{
			console.log('Bad image assigned to #jpegPreview_img.');
		});
		$("#camimg_store").append($myImgEle);
	}
	var Show = function ()
	{
		if (isVisible)
			return;
		isVisible = true;
		$("#camimg_preview").appendTo("#camimg_wrapper");
	}
	this.Hide = function ()
	{
		if (!isVisible)
			return;
		isVisible = false;
		$("#camimg_preview").appendTo("#camimg_store");
	}
	this.RenderImage = function (imgId)
	{
		Initialize();
		CopyImageToCanvas(imgId, "camimg_preview");
		Show();
		videoOverlayHelper.HideLoadingOverlay();
	}
	this.RenderDataURI = function (startTime, path, dataUri)
	{
		Initialize();
		var img = $("#jpegPreview_img").get(0);
		img.startTime = startTime;
		img.myPath = path;
		img.src = dataUri;
	}
})();
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

	var clipPlaybackPosition = 0; // milliseconds

	var loading = new BICameraData();

	var Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;
		// Do one-time initialization here
		$("#camimg_store").append('<canvas id="camimg_canvas" class="videoCanvas"></canvas>');
		$("#camimg_store").append('<img crossOrigin="Anonymous" id="camimg" src="" alt="" style="display: none;" />');
		$("#camimg_store").append('<canvas id="backbuffer_canvas" style="display: none;"></canvas>');

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
				loadedFirstFrame = true;
				var msLoadingTime = new Date().getTime() - currentImageRequestedAtMs;
				videoPlayer.ImageRendered(loading.path, this.naturalWidth, this.naturalHeight, msLoadingTime, new Date(currentImageRequestedAtMs));

				var loaded = videoPlayer.Loaded().image;
				if (loaded.id.startsWith("@"))
				{
					loaded.maxwidth = this.naturalWidth;
					loaded.maxheight = this.naturalHeight;
					if (lastCycleWidth != this.naturalWidth || lastCycleHeight != this.naturalHeight)
					{
						// TODO: Thoroughly test cycles and switching streaming methods and see what happens with sizes.
						lastCycleWidth = this.naturalWidth;
						lastCycleHeight = this.naturalHeight;
						loaded.aspectratio = lastCycleWidth / lastCycleHeight;
						resized();
					}
				}
				else
				{
					loaded.maxwidth = loaded.fullwidth;
					loaded.maxheight = loaded.fullheight;
					lastCycleWidth = lastCycleHeight = 0;
				}

				currentLoadedImageActualWidth = this.naturalWidth;

				CopyImageToCanvas("camimg", "camimg_canvas");

				if (nerdStats.IsOpen())
				{
					nerdStats.BeginUpdate();
					nerdStats.UpdateStat("Viewport", $("#layoutbody").width() + "x" + $("#layoutbody").height());
					nerdStats.UpdateStat("Stream Resolution", loaded.actualwidth + "x" + loaded.actualheight);
					nerdStats.UpdateStat("Native Resolution", loading.fullwidth + "x" + loading.fullheight);
					nerdStats.UpdateStat("Seek Position", loading.isLive ? "LIVE" : (parseInt(self.GetSeekPercent() * 100) + "%"));
					nerdStats.UpdateStat("Frame Offset", loading.isLive ? "LIVE" : Math.floor(clipPlaybackPosition) + "ms");
					nerdStats.UpdateStat("Codecs", "jpeg");
					nerdStats.UpdateStat("Jpeg Loading Time", msLoadingTime, msLoadingTime + "ms", true);
					nerdStats.EndUpdate();
				}
			}
			GetNewImage();
		});
		camObj.error(function ()
		{
			ClearImageLoadTimeout();
			setTimeout(GetNewImage, 1000);
		});
	}
	var Activate = function ()
	{
		if (isCurrentlyActive)
			return;
		isCurrentlyActive = true;
		// Show yourself
		ClearCanvas("camimg_canvas");
		videoOverlayHelper.ShowLoadingOverlay(true);
		$("#camimg_canvas").appendTo("#camimg_wrapper");
	}
	this.Deactivate = function ()
	{
		if (!isCurrentlyActive)
			return;
		isCurrentlyActive = false;
		loadedFirstFrame = false;
		// Stop what you are doing and hide
		//clipPlaybackPosition = 0;
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

	var openVideoTimeout = null;
	var lastOpenVideoCallAt = -60000;
	var timeBetweenOpenVideoCalls = 300;
	this.OpenVideo = function (videoData, offsetPercent, startPaused)
	{
		if (openVideoTimeout != null)
			clearTimeout(openVideoTimeout);

		var perfNow = performance.now();
		var waited = perfNow - lastOpenVideoCallAt;
		if (waited < timeBetweenOpenVideoCalls)
		{
			openVideoTimeout = setTimeout(function ()
			{
				self.OpenVideo(videoData, offsetPercent, startPaused);
			}, timeBetweenOpenVideoCalls - waited);
			return;
		}
		lastOpenVideoCallAt = perfNow;
		console.log("jpeg.OpenVideo");
		loading.CopyValuesFrom(videoData);
		if (!offsetPercent)
			offsetPercent = 0;
		if (loading.isLive)
			startPaused = false;
		Activate();
		clipPlaybackPosition = Clamp(offsetPercent, 0, 1) * (loading.msec - 1);
		timeLastClipFrame = Date.now();
		if (startPaused)
			self.Playback_Pause();
		else
			self.Playback_Play();
		videoOverlayHelper.ShowLoadingOverlay(true);
		GetNewImage();
	}
	this.GetSeekPercent = function ()
	{
		return Clamp(clipPlaybackPosition / (loading.msec - 1), 0, 1);
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
			if ((isLoadingRecordedSnapshot
				&& loading.path == videoPlayer.Loaded().image.path
				&& !CouldBenefitFromWidthChange(widthToRequest))
				|| !isVisible
			)
			{
				if (isLoadingRecordedSnapshot)
					videoOverlayHelper.HideLoadingOverlay();
				GetNewImageAfterTimeout();
			}
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
		playbackPaused = true;
		playbackControls.setPlayPauseButtonState(playbackPaused);
	}
	this.Playback_Play = function ()
	{
		playbackPaused = false;
		playbackControls.setPlayPauseButtonState(playbackPaused);
		if (loading.isLive)
			return;
		if (clipPlaybackPosition >= loading.msec - 1 && !playbackControls.GetPlayReverse())
			clipPlaybackPosition = 0;
		else if (clipPlaybackPosition <= 0 && playbackControls.GetPlayReverse())
			clipPlaybackPosition = loading.msec - 1;
		if (clipPlaybackPosition < 0)
			clipPlaybackPosition = 0;
	}
	this.DrawFullCameraAsThumb = function (cameraId, groupId)
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
	this.DrawThumbAsFullCamera = function (cameraId)
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
	Initialize();
}
///////////////////////////////////////////////////////////////
// Fetch and OpenH264 Video Module ////////////////////////////
///////////////////////////////////////////////////////////////
function FetchOpenH264VideoModule()
{
	/*
	A low level video player module which streams H.264 using the fetch API, and decodes/plays it using JavaScript.
	*/
	var self = this;
	var isInitialized = false;
	var isCurrentlyActive = false;
	var lastActivatedAt = 0;
	var openh264_player;
	var isVisible = !documentIsHidden();
	var currentSeekPositionPercent = 0;
	var lastFrameAt = 0;
	var playbackPaused = false;
	var perfMonInterval;
	var lastNerdStatsUpdate = performance.now();
	var isLoadingRecordedSnapshot = false;
	var endSnapshotDisplayTimeout = null;
	var currentImageDateMs = GetServerDate(new Date()).getTime();

	var loading = new BICameraData();


	var Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;
		// Do one-time initialization here
		console.log("Initializing openh264_player");
		openh264_player = new OpenH264_Player(FrameRendered, PlaybackReachedNaturalEnd);
	}
	var Activate = function ()
	{
		if (isCurrentlyActive)
			return;
		isCurrentlyActive = true;
		lastActivatedAt = performance.now();
		// Show yourself
		console.log("Activating openh264_player");
		openh264_player.GetCanvasRef().appendTo("#camimg_wrapper");
		ClearCanvas("openh264_player_canvas");
		videoOverlayHelper.ShowLoadingOverlay(true);
	}
	this.Deactivate = function ()
	{
		if (!isCurrentlyActive)
			return;
		isCurrentlyActive = false;
		// Stop what you are doing and hide
		console.log("Deactivating openh264_player");
		StopStreaming();
		openh264_player.GetCanvasRef().appendTo("#camimg_store");
	}
	var StopStreaming = function ()
	{
		clearTimeout(endSnapshotDisplayTimeout);
		safeFetch.CloseStream();
		openh264_player.Flush();
		setTimeout(MeasurePerformance, 0);
	}
	this.VisibilityChanged = function (visible)
	{
		isVisible = visible;
		if (isVisible && isCurrentlyActive)
		{
			if (loading.isLive)
				self.OpenVideo(loading);
			else if (!playbackPaused)
				self.Playback_Play();
		}
		else
		{
			StopStreaming();
		}
	}
	this.LoadedFrameSinceActivate = function ()
	{
		return openh264_player.GetRenderedFrameCount() > 0;
	}
	var openVideoTimeout = null;
	this.OpenVideo = function (videoData, offsetPercent, startPaused)
	{
		// Delay if the player has not fully loaded yet.
		if (openVideoTimeout != null)
			clearTimeout(openVideoTimeout);
		if (!openh264_player.IsLoaded())
		{
			openVideoTimeout = setTimeout(function ()
			{
				self.OpenVideo(videoData, offsetPercent, startPaused);
			}, 5);
			return;
		}
		console.log("h264.OpenVideo");
		loading.CopyValuesFrom(videoData);
		if (!offsetPercent)
			offsetPercent = 0;
		if (loading.isLive)
			startPaused = false;
		Activate();
		currentSeekPositionPercent = Clamp(offsetPercent, 0, 1);
		lastFrameAt = performance.now();
		currentImageDateMs = Date.now();
		isLoadingRecordedSnapshot = false;
		clearTimeout(endSnapshotDisplayTimeout);
		var videoUrl;
		if (loading.isLive)
		{
			videoUrl = "/video/" + loading.path + "/2.0" + currentServer.GetRemoteSessionArg("?", true) + "&audio=0&stream=" + h264QualityHelper.getQualityArg() + "&extend=2";
		}
		else
		{
			var speed = 100 * playbackControls.GetPlaybackSpeed();
			if (playbackControls.GetPlayReverse())
				speed *= -1;
			if (startPaused)
				speed = 0;
			var clipData = clipLoader.GetCachedClip(loading.id, loading.path);
			if (clipData)
			{
				isLoadingRecordedSnapshot = clipData.isSnapshot;
				currentImageDateMs = clipData.date.getTime();
			}
			var widthAndQualityArg = "";
			if (speed == 0)
				widthAndQualityArg = "&w=" + imageRenderer.GetWidthToRequest() + "&q=50";
			videoUrl = "/file/clips/" + loading.path + currentServer.GetRemoteSessionArg("?", true) + "&pos=" + parseInt(currentSeekPositionPercent * 10000) + "&speed=" + speed + "&audio=0&stream=" + h264QualityHelper.getQualityArg() + "&extend=2" + widthAndQualityArg;
		}
		videoOverlayHelper.ShowLoadingOverlay(true);
		if (startPaused)
		{
			self.Playback_Pause(); // If opening the stream while paused, the stream will stop after one frame.
			safeFetch.OpenStream(videoUrl, acceptFrame, StreamEnded);
		}
		else
		{
			playbackPaused = false;
			playbackControls.setPlayPauseButtonState(playbackPaused);
			// Calling StopStream before opening the new stream will drop any buffered frames in the decoder, allowing the new stream to begin playback immediately.
			StopStreaming();
			safeFetch.OpenStream(videoUrl, acceptFrame, StreamEnded);
		}
	}
	var acceptFrame = function (frame)
	{
		if (frame.jpeg)
		{
			if (isLoadingRecordedSnapshot && !playbackPaused)
			{
				clearTimeout(endSnapshotDisplayTimeout);
				endSnapshotDisplayTimeout = setTimeout(function ()
				{
					PlaybackReachedNaturalEnd(1);
				}, loading.msec);
			}
			jpegPreviewModule.RenderDataURI(frame.startTime, loading.path, frame.jpeg);
		}
		else
			openh264_player.AcceptFrame(frame);
	}
	this.GetSeekPercent = function ()
	{
		return currentSeekPositionPercent;
	}
	this.GetLastSnapshotUrl = function ()
	{
		if (loading.isLive)
			return currentServer.remoteBaseURL + "image/" + loading.path + '?time=' + Date.now() + currentServer.GetRemoteSessionArg("&", true);
		else
			return currentServer.remoteBaseURL + "file/clips/" + loading.path + '?time=' + parseInt(currentSeekPositionPercent * loading.msec - 1) + currentServer.GetRemoteSessionArg("&", true);
	}
	this.GetLastSnapshotFullUrl = function ()
	{
		return self.GetLastSnapshotUrl();
	}
	this.GetStaticSnapshotId = function ()
	{
		return "";
	}
	this.GetCurrentImageTimeMs = function ()
	{
		return currentImageDateMs;
	}
	this.Playback_IsPaused = function ()
	{
		return playbackPaused;
	}
	this.Playback_Pause = function ()
	{
		playbackPaused = true;
		playbackControls.setPlayPauseButtonState(playbackPaused);
		if (!loading.isLive)
			StopStreaming();
	}
	this.Playback_Play = function ()
	{
		playbackPaused = false;
		playbackControls.setPlayPauseButtonState(playbackPaused);
		if (!loading.isLive)
			ReopenStreamAtCurrentSeekPosition();
	}
	this.PlaybackSpeedChanged = function (playSpeed)
	{
		if (!playbackPaused)
			ReopenStreamAtCurrentSeekPosition();
	}
	this.SelectedQualityChanged = function ()
	{
		ReopenStreamAtCurrentSeekPosition();
	}
	this.PlaybackDirectionChanged = function (playReverse)
	{
		if (!playbackPaused)
			ReopenStreamAtCurrentSeekPosition();
	}
	var ReopenStreamAtCurrentSeekPosition = function ()
	{
		if (loading.isLive)
			currentSeekPositionPercent = 0;
		else
		{
			if (currentSeekPositionPercent >= 1 && !playbackControls.GetPlayReverse())
				currentSeekPositionPercent = 0;
			else if (currentSeekPositionPercent <= 0 && playbackControls.GetPlayReverse())
				currentSeekPositionPercent = 1;
			currentSeekPositionPercent = Clamp(currentSeekPositionPercent, 0, 1);
		}
		self.OpenVideo(loading, currentSeekPositionPercent, playbackPaused);
	}
	var FrameRendered = function (frame)
	{
		currentImageDateMs = frame.utc;
		currentSeekPositionPercent = frame.pos / 10000;
		var timeNow = performance.now();
		videoPlayer.ImageRendered(loading.path, frame.width, frame.height, lastFrameAt - timeNow, new Date(frame.utc));
		var interFrame = timeNow - lastFrameAt;
		lastFrameAt = timeNow;
		if (nerdStats.IsOpen())
		{
			nerdStats.BeginUpdate();
			nerdStats.UpdateStat("Viewport", $("#layoutbody").width() + "x" + $("#layoutbody").height());
			nerdStats.UpdateStat("Stream Resolution", frame.width + "x" + frame.height);
			nerdStats.UpdateStat("Native Resolution", loading.fullwidth + "x" + loading.fullheight);
			nerdStats.UpdateStat("Seek Position", loading.isLive ? "LIVE" : ((frame.pos / 100).toFixed() + "%"));
			nerdStats.UpdateStat("Frame Offset", frame.timestamp + "ms");
			nerdStats.UpdateStat("Frame Time", GetDateStr(new Date(frame.utc + GetServerTimeOffset()), true));
			nerdStats.UpdateStat("Codecs", "h264");
			var bitRate_Video = bitRateCalc_Video.GetBPS() * 8;
			var bitRate_Audio = bitRateCalc_Audio.GetBPS() * 8;
			nerdStats.UpdateStat("Video Bit Rate", bitRate_Video, formatBitsPerSecond(bitRate_Video, 1), true);
			nerdStats.UpdateStat("Audio Bit Rate", bitRate_Audio, formatBitsPerSecond(bitRate_Audio, 1), true);
			nerdStats.UpdateStat("Frame Size", frame.size, formatBytes(frame.size, 2), true);
			var interFrameError = Math.abs(frame.expectedInterframe - interFrame);
			nerdStats.UpdateStat("Inter-Frame Time", interFrame, interFrame.toFixed() + "ms", true);
			nerdStats.UpdateStat("Frame Timing Error", interFrameError, interFrameError.toFixed() + "ms", true);
			writeDelayStats();
			nerdStats.EndUpdate();

		}
		if (playbackPaused && !loading.isLive)
		{
			StopStreaming();
		}
	}
	var StreamEnded = function (message, wasJpeg, wasAppTriggered, videoFinishedStreaming)
	{
		console.log("fetch stream ended: ", message);
		if (wasJpeg)
			return;
		if (videoFinishedStreaming)
			openh264_player.PreviousFrameIsLastFrame();
		else
		{
			if (!wasAppTriggered && !safeFetch.IsActive())
			{
				StopStreaming();
				toaster.Warning("The video stream was lost. Attempting to reconnect...", 5000);
				ReopenStreamAtCurrentSeekPosition();
			}
		}
	}
	var PlaybackReachedNaturalEnd = function (frameCount)
	{
		console.log("playback reached natural end of file after " + frameCount + " frames");
		if (loading.isLive)
			return;
		var reverse = playbackControls.GetPlayReverse();
		if (reverse)
			currentSeekPositionPercent = 0;
		else
			currentSeekPositionPercent = 1;
		videoPlayer.Playback_Ended(reverse);
	}
	var writeDelayStats = function ()
	{
		if (nerdStats.IsOpen())
		{
			var netDelay = openh264_player.GetNetworkDelay().toFloat();
			var decoderDelay = openh264_player.GetBufferedTime().toFloat();
			nerdStats.UpdateStat("Network Delay", netDelay, netDelay.toFixed().padLeft(4, '0') + "ms", true);
			nerdStats.UpdateStat("Player Delay", decoderDelay, decoderDelay.toFixed().padLeft(4, '0') + "ms", true);
			nerdStats.UpdateStat("Delayed Frames", openh264_player.GetBufferedFrameCount(), openh264_player.GetBufferedFrameCount(), true);
			lastNerdStatsUpdate = performance.now();
		}
	}
	var perf_warning_net = null;
	var perf_warning_cpu = null;
	var MeasurePerformance = function ()
	{
		var perfNow = performance.now();
		if (!openh264_player || !isCurrentlyActive || !safeFetch.IsActive() || isLoadingRecordedSnapshot || perfNow - lastActivatedAt < 1000)
			return;
		if (perfNow - lastNerdStatsUpdate > 3000 && perfNow - lastActivatedAt > 3000)
			writeDelayStats();
		if (perf_warning_net)
		{
			perf_warning_net.remove();
			perf_warning_net = null;
		}
		if (perf_warning_cpu)
		{
			perf_warning_cpu.remove();
			perf_warning_cpu = null;
		}
		var bufferedTime = openh264_player.GetBufferedTime();
		var netDelay = openh264_player.GetNetworkDelay();
		if (netDelay + bufferedTime > 60000)
		{
			toaster.Warning("Video delay has exceeded 60 seconds. The stream is being automatically reinitialized.");
			ReopenStreamAtCurrentSeekPosition();
			return;
		}
		if (netDelay > 2000) // Blue Iris appears to drop frames when it detects the network buffer getting too large, so this needs to be fairly low.
			perf_warning_net = toaster.Warning('Your network connection is not fast enough to handle this stream in realtime.  Consider changing the streaming quality.', 10000);
		if (bufferedTime > 3000)
			perf_warning_cpu = toaster.Warning('Your CPU is not fast enough to handle this stream in realtime.  Consider changing the streaming quality.', 10000);
	}
	Initialize();
	perfMonInterval = setInterval(MeasurePerformance, 10000);
}
///////////////////////////////////////////////////////////////
// openh264_player ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function OpenH264_Player(frameRendered, PlaybackReachedNaturalEndCB)
{
	var self = this;
	var $canvas;
	var canvas;
	var canvasW = 0;
	var canvasH = 0;
	var display;
	var decoder;
	var acceptedFrameCount = 0; // Number of frames submitted to the decoder.
	var decodedFrameCount = 0; // Number of frames rendered.
	var finishedFrameCount = 0; // Number of frames rendered or dropped.
	var netDelayCalc = new NetDelayCalc();
	var timestampFirstAcceptedFrame = -1; // Frame timestamp (ms) of the first frame to be submitted to the decoder.
	var timestampFirstDecodedFrame = -1; // Frame timestamp (ms) of the first frame to be decoded.
	var timestampFirstRenderedFrame = -1; // Frame timestamp (ms) of the first frame to be rendered.
	var timestampLastAcceptedFrame = -1; // Frame timestamp (ms) of the last frame to be submitted to the decoder.
	var timestampLastDecodedFrame = -1; // Frame timestamp (ms) of the last frame to be decoded.
	var timestampLastRenderedFrame = -1; // Frame timestamp (ms) of the last frame to be rendered.
	var firstFrameReceivedAt = performance.now(); // The performance.now() reading at the moment the first frame was received from the network.
	var lastFrameReceivedAt = performance.now(); // The performance.now() reading at the moment the last frame was received from the network.
	var firstFrameDecodedAt = performance.now(); // The performance.now() reading at the moment the first frame was finished decoding.
	var lastFrameDecodedAt = performance.now(); // The performance.now() reading at the moment the last frame was finished decoding.
	var firstFrameRenderedAt = performance.now(); // The performance.now() reading at the moment the first frame was finished rendering.
	var lastFrameRenderedAt = performance.now(); // The performance.now() reading at the moment the last frame was finished rendering.
	var lastFrameRenderTime = 0; // Milliseconds it took to render the last frame.
	var averageRenderTime = new RollingAverage();
	var averageDecodeTime = new RollingAverage();
	var playbackClockOffset = 0;
	var loadState = 0; // 0: Initial, 1: Loading, 2: Ready to accept frames
	var isValid = true;
	var allFramesAccepted = false;
	var renderScheduler = null;

	var onLoad = function ()
	{
		loadState = 2;
		loadingHelper.SetLoadedStatus("h264");
	}
	var onLoadFail = function ()
	{
		isValid = false;
		toaster.Error("Failed to load H.264 player.", 15000);
		decoder.Dispose();
	}
	var frameDecoded = function (frame)
	{
		var timeNow = performance.now();
		decodedFrameCount++;
		timestampLastDecodedFrame = frame.timestamp;
		lastFrameDecodedAt = timeNow;
		if (timestampFirstDecodedFrame == -1)
		{
			timestampFirstDecodedFrame = frame.timestamp;
			firstFrameDecodedAt = timeNow;
		}
		renderScheduler.AddFrame(frame, averageRenderTime);
	}
	var renderFrame = function (frame)
	{
		if (canvasW != frame.width)
			canvas.width = canvasW = frame.width;
		if (canvasH != frame.height)
			canvas.height = canvasH = frame.height;
		var drawStart = performance.now();
		display.drawNextOuptutPictureGL(frame.width, frame.height, null, new Uint8Array(frame.data));
		var drawEnd = performance.now();
		lastFrameRenderTime = drawEnd - drawStart;
		averageRenderTime.Add(lastFrameRenderTime);
		finishedFrameCount++;
		timestampLastRenderedFrame = frame.timestamp;
		lastFrameRenderedAt = drawEnd;
		if (timestampFirstRenderedFrame == -1)
		{
			timestampFirstRenderedFrame = frame.timestamp;
			firstFrameRenderedAt = drawEnd;
		}
		frameRendered(frame);
		CheckStreamEndCondition();
	}
	var dropFrame = function (frame)
	{
		finishedFrameCount++;
		CheckStreamEndCondition();
	}
	var CheckStreamEndCondition = function ()
	{
		if (allFramesAccepted && (finishedFrameCount) >= acceptedFrameCount)
		{
			if (PlaybackReachedNaturalEndCB)
				PlaybackReachedNaturalEndCB(finishedFrameCount);
		}
	}

	var lastFrameWarning = performance.now() - 60000;
	var frameError = function (badFrame)
	{
		console.log("Frame Error", badFrame);
		var timeNow = performance.now();
		if (timeNow - lastFrameWarning > 3000)
		{
			lastFrameWarning = timeNow;
			toaster.Warning("Error decoding H.264 frame(s)", 3000);
		}
	}
	var lastCriticalError = performance.now() - 60000;
	var criticalWorkerError = function (error)
	{
		toaster.Error('H.264 decoder error!<br/><br/>' + error.message + '<br/><br/>Check your encoder profiles in Blue Iris Options &gt; Web server &gt; Advanced, and try a lower bit rate.', 15000, true);
		var timeNow = performance.now();
		if (timeNow - lastCriticalError < 2000)
		{
			toaster.Error('H.264 decoder errors occurred too rapidly.  Decoder will not be restarted automatically.', 600000, true);
		}
		else
		{
			if (decoder)
			{
				decoder.Dispose();
				decoder = new OpenH264_Decoder(onLoad, onLoadFail, frameDecoded, frameError, criticalWorkerError);
			}
		}
		lastCriticalError = timeNow;
	}

	var Initialize = function ()
	{
		if (loadState != 0)
			return;
		loadState = 1;

		renderScheduler = new RenderScheduler(renderFrame, dropFrame);
		decoder = new OpenH264_Decoder(onLoad, onLoadFail, frameDecoded, frameError, criticalWorkerError);

		$("#openh264_player_canvas").remove();
		$canvas = $('<canvas id="openh264_player_canvas" class="videoCanvas" width="100%" height="100%"></canvas>');
		canvas = $canvas.get(0);
		display = new WebGLCanvas(canvas);
	}
	this.Dispose = function ()
	{
		decoder.Dispose();
	}
	this.IsLoaded = function ()
	{
		return loadState == 2;
	}
	this.IsValid = function ()
	{
		return isValid;
	}
	this.GetRenderedFrameCount = function ()
	{
		return finishedFrameCount;
	}
	this.GetBufferedFrameCount = function ()
	{
		/// <summary>
		/// Returns the number of buffered video frames that have not yet been rendered. 
		/// If the system has sufficient computational power, this number should remain close to 0.
		/// </summary>
		return acceptedFrameCount - finishedFrameCount;
	}
	this.GetNetworkDelay = function ()
	{
		/// <summary>
		/// Returns the approximate number of milliseconds of video delay caused by insufficient network speed.
		/// If the system has sufficient network bandwidth, this number should remain close to 0.
		/// One or two frames worth of delay is nothing to worry about.
		/// </summary>
		return netDelayCalc.Calc();
	}
	this.GetBufferedTime = function ()
	{
		/// <summary>
		/// Returns the number of milliseconds of buffered video frames, calculated as 
		/// timestampLastAcceptedFrame - timestampLastRenderedFrame.
		/// If the system has sufficient computational power, this number should remain close to 0.
		/// </summary>
		return timestampLastAcceptedFrame - timestampLastRenderedFrame;
	}
	this.GetLastFrameRenderTime = function ()
	{
		return lastFrameRenderTime;
	}
	this.Flush = function ()
	{
		decoder.Flush();
		// CONSIDER: consider constructing new averageRenderTime and averageDecodeTime here.
		renderScheduler.Reset(averageRenderTime);
		acceptedFrameCount = 0;
		decodedFrameCount = 0;
		finishedFrameCount = 0;
		netDelayCalc.Reset();
		timestampFirstAcceptedFrame = -1;
		timestampFirstDecodedFrame = -1;
		timestampFirstRenderedFrame = -1;
		timestampLastAcceptedFrame = -1;
		timestampLastDecodedFrame = -1;
		timestampLastRenderedFrame = -1;
		var timeNow = performance.now();
		firstFrameReceivedAt = timeNow;
		lastFrameReceivedAt = timeNow;
		firstFrameDecodedAt = timeNow;
		lastFrameDecodedAt = timeNow;
		firstFrameRenderedAt = timeNow;
		lastFrameRenderedAt = timeNow;
		playbackClockOffset = 0;
		allFramesAccepted = false;
	}
	this.AcceptFrame = function (frame)
	{
		acceptedFrameCount++;
		decoder.Decode(frame);
		timestampLastAcceptedFrame = frame.time;
		lastFrameReceivedAt = performance.now();
		if (timestampFirstAcceptedFrame == -1)
		{
			timestampFirstAcceptedFrame = frame.time;
			firstFrameReceivedAt = lastFrameReceivedAt;
			firstFrameRenderedAt = lastFrameReceivedAt; // This value is faked so the timing starts more reasonably.
		}
		netDelayCalc.Frame(frame.time, lastFrameReceivedAt);
	}
	this.GetCanvasRef = function ()
	{
		return $canvas;
	}
	this.PreviousFrameIsLastFrame = function ()
	{
		allFramesAccepted = true;
		CheckStreamEndCondition();
	}

	Initialize();
}
function RenderScheduler(renderFunc, dropFunc, averageRenderTime)
{
	/// <summary>Manages the playback clock and keeps frames rendering as closely as possible to their intended timestamps.</summary>
	var self = this;
	var frameQueue = [];
	var timeout = null;
	var maxQueuedFrames = 2; // Do not set this negative, but 0 is okay.
	var playbackClockStart = performance.now();
	var playbackClockOffset = 0;
	var numFramesAccepted = 0;
	var lastFrameTS = 0;
	this.AddFrame = function (frame)
	{
		if (numFramesAccepted == 0)
			playbackClockStart = performance.now();
		numFramesAccepted++;
		frame.expectedInterframe = (frame.timestamp - lastFrameTS);
		lastFrameTS = frame.timestamp;
		frameQueue.push(frame);
		// Sort the frame queue by timestamp, as this can improve playback if frames come in out-of-order.
		frameQueue.sort(function (a, b) { return a.timestamp - b.timestamp; });

		if (frameQueue.length > maxQueuedFrames)
		{
			// Frame queue is overfull.
			// Adjust the playback clock to match the oldest queued frame.
			// When we MaintainSchedule later, this will cause at least one frame to be rendered immediately.
			var timeRemaining = GetTimeUntilRenderOldest();
			if (timeRemaining > 0)
				OffsetPlaybackClock(timeRemaining); // Jump the clock ahead because we are getting too many frames queued.
		}
		MaintainSchedule();
	}
	var MaintainSchedule = function ()
	{
		/// <summary>Renders or queues a frame, if any are available. This method will call itself if necessary after rendering until the frame queue is empty.</summary>
		clearTimeout(timeout);
		if (frameQueue.length > 0)
		{
			var clock = ReadPlaybackClock();
			var timeToWait = GetTimeUntilRenderOldest();
			if (timeToWait <= 0)
			{
				if (timeToWait < 0)
					OffsetPlaybackClock(timeToWait); // Roll the clock back because frames are coming in late.
				renderFunc(DequeueOldest());
				MaintainSchedule();
			}
			else
			{
				timeout = setTimeout(function ()
				{
					renderFunc(DequeueOldest());
					MaintainSchedule();
				}, timeToWait);
			}
		}
	}
	var OffsetPlaybackClock = function (offset)
	{
		playbackClockOffset += offset;
	}
	var GetTimeUntilRenderOldest = function ()
	{
		return (PeekOldest().timestamp - ReadPlaybackClock()) - averageRenderTime.Get();
	}
	var ReadPlaybackClock = function ()
	{
		return (performance.now() - playbackClockStart) + playbackClockOffset;
	}
	var PeekOldest = function ()
	{
		/// <summary>Returns a reference to the first item in the queue. Do not call if the queue is empty.</summary>
		return frameQueue[0];
	}
	var DequeueOldest = function ()
	{
		/// <summary>Removes and returns a reference to the first item in the queue. Do not call if the queue is empty.</summary>
		return frameQueue.splice(0, 1)[0];
	}
	this.Reset = function (newAverageRenderTime)
	{
		averageRenderTime = newAverageRenderTime;
		clearTimeout(timeout);
		numFramesAccepted = 0;
		playbackClockOffset = 0;
		playbackClockStart = performance.now();
		while (frameQueue.length > 0)
			dropFunc(DequeueOldest());
	}
}
///////////////////////////////////////////////////////////////
// openh264_decoder ///////////////////////////////////////////
///////////////////////////////////////////////////////////////
function OpenH264_Decoder(onLoad, onLoadError, onFrameDecoded, onFrameError, onCriticalWorkerError)
{
	var self = this;
	// Note: I hand-edited openh264_decoder.js to remove {u, v, y} attributes of 
	// each decoded frame because I don't need them.  I'm not sure how significant 
	// this optimization is (each removed field was a new Uint8ClampedArray of 
	// significant size, but maybe data didn't have to be copied to make them).
	var worker = new Worker("ui3/openh264_decoder.js?v=" + combined_version);
	var encodedFrameQueue = new Queue();
	var is_decoding = false;
	var dropNextDecodedFrame = false;

	this.Decode = function (frame)
	{
		if (!worker)
		{
			console.log("OpenH264_Decoder.Decode called after Dispose.");
			return;
		}
		if (is_decoding)
		{
			encodedFrameQueue.enqueue(frame);
			return;
		}
		dropNextDecodedFrame = false;
		is_decoding = true;
		worker.onmessage = function (ev2)
		{
			ev2.data.timestamp = frame.time;
			ev2.data.pos = frame.pos;
			ev2.data.utc = frame.utc;
			ev2.data.size = frame.size;
			DecodeDone(ev2.data);
		};
		worker.postMessage({ timestamp: frame.time, data: frame.frameData.buffer });
	}
	var DecodeDone = function (frame)
	{
		is_decoding = false;
		if (!encodedFrameQueue.isEmpty())
			self.Decode(encodedFrameQueue.dequeue());
		if (dropNextDecodedFrame)
			return;

		if (frame.status == 0)
		{
			try
			{
				onFrameDecoded(frame);
			}
			catch (ex)
			{
				toaster.Warning(ex);
			}
		}
		else
			onFrameError(frame);
	}
	this.Flush = function ()
	{
		if (!encodedFrameQueue.isEmpty())
			encodedFrameQueue = new Queue();
		if (is_decoding)
			dropNextDecodedFrame = true;
	}

	this.Dispose = function ()
	{
		if (worker)
			worker.terminate();
		worker = null;
	}
	// Initialize
	worker.onerror = function (error)
	{
		if (onCriticalWorkerError)
			onCriticalWorkerError(error);
	}
	worker.onmessage = function (ev)
	{
		if (ev.data.status == 0)
			onLoad(ev.data);
		else
			onLoadError(ev.data);
	};
	worker.postMessage({
		params: {},
		packet: null
	});
};
///////////////////////////////////////////////////////////////
// Network Delay Calculator - An Imperfect Science ////////////
///////////////////////////////////////////////////////////////
function NetDelayCalc()
{
	var self = this;

	var frameCounter = 0;
	var baseFrameTime = 0;
	var lastFrameTime = 0;
	var baseRealTime = -1;
	var lastRealTime = -1;
	var firstRealTime = -1;
	var adjustBaseline = true;
	var avgTimestampDiff = new RollingAverage(30);

	this.Reset = function ()
	{
		frameCounter = 0;
		baseFrameTime = 0;
		lastFrameTime = 0;
		baseRealTime = -1;
		lastRealTime = -1;
		firstRealTime = -1;
		adjustBaseline = true;
		avgTimestampDiff = new RollingAverage(30);
	}
	this.Frame = function (frameTime, realTime)
	{
		frameCounter++;
		if (frameTime != 0)
			avgTimestampDiff.Add(frameTime - lastFrameTime);
		lastFrameTime = frameTime;
		lastRealTime = realTime;
		if (baseRealTime == -1)
		{
			baseFrameTime = frameTime;
			baseRealTime = realTime;
			firstRealTime = realTime;
		}
		else if (adjustBaseline)
		{
			// Keep adjusting the baseline over the first 1 second.
			// The timing of the first few frames is a bit unstable sometimes and can result in reporting 
			// of several hundred ms of network lag that doesn't really exist.
			if (realTime - firstRealTime >= 2000)
			{
				adjustBaseline = false;
			}
			else
			{
				var delay = CalcSimple(lastFrameTime, lastRealTime, baseFrameTime, baseRealTime);
				if (delay > 0)
				{
					baseFrameTime = frameTime;
					baseRealTime = realTime;
				}
			}
		}
	}
	this.Calc = function ()
	{
		if (baseRealTime == -1)
			return 0;
		var realTimePassed = performance.now() - baseRealTime;
		// CONSIDER: Blue Iris does not increase frame timestamps at a rate equivalent to real time while encoding a reduced-speed video.
		// I know it is overcompensating wildly, but I'm using playSpeed as a multiplier here to ensure we don't show erroneous network delay messages in the UI.
		// The network would have to be performing exceptionally poorly to show high network delay while playing at a reduced speed.
		if (!videoPlayer.Loading().image.isLive)
		{
			var playSpeed = playbackControls.GetPlaybackSpeed();
			if (playSpeed < 1)
				realTimePassed *= playSpeed;
		}
		var streamTimePassed = lastFrameTime - baseFrameTime;
		var delay = realTimePassed - streamTimePassed;
		var avgTsDiff = avgTimestampDiff.Get();
		delay -= avgTsDiff;
		if (delay < 0)
			delay = 0;
		//console.log("delay " + delay + " = clock " + realTimePassed + " - timestamp " + streamTimePassed + " - interFrame " + avgTsDiff);
		return delay;
	}
	var CalcSimple = function (ft, rt, b_ft, b_rt)
	{
		var realTimePassed = rt - b_rt;
		var streamTimePassed = ft - b_ft;
		return realTimePassed - streamTimePassed;
	}
}
///////////////////////////////////////////////////////////////
// Image Renderer                                            //
// provides rendering and scaling services                   //
///////////////////////////////////////////////////////////////
function CopyImageToCanvas(imgId, canvasId)
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
function ClearCanvas(canvasId)
{
	var canvas = $("#" + canvasId).get(0);
	var context2d = canvas.getContext("2d");
	if (context2d != null)
	{
		context2d.clearRect(0, 0, canvas.width, canvas.height);
	}
	else
	{
		var contextGl = canvas.getContext("webgl");
		if (contextGl != null)
			contextGl.clear(contextGl.COLOR_BUFFER_BIT);
	}
}
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
	this.ImgResized = function (isFromKeyboard)
	{
		dpiScalingFactor = BI_GetDevicePixelRatio();

		var imgAvailableWidth = $("#layoutbody").width();
		var imgAvailableHeight = $("#layoutbody").height();

		// Calculate new size based on zoom levels
		var imgForSizing = videoPlayer.Loaded().image;
		var imgDrawWidth = imgForSizing.fullwidth * (zoomTable[digitalZoom]);
		var imgDrawHeight = imgForSizing.fullheight * (zoomTable[digitalZoom]);
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
	this.CamImgDragStart = function (e)
	{
		mouseX = e.pageX;
		mouseY = e.pageY;
		imageIsDragging = true;
		SetCamCellCursor();
	}
	this.CamImgDragMove = function (e, mouseIsDown, dragHasMoved)
	{
		if (mouseIsDown && !dragHasMoved)
			return;

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
	}
	this.CamImgDragEnd = function (e)
	{
		imageIsDragging = false;
		SetCamCellCursor();

		mouseX = e.pageX;
		mouseY = e.pageY;
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
}
///////////////////////////////////////////////////////////////
// VideoCenter Icons and Video Loading/Buffering Overlay //////
///////////////////////////////////////////////////////////////
var videoOverlayHelper = new (function ()
{
	var self = this;
	var loadingOverlayHidden = true;
	var loadingAnimHidden = true;
	var falseLoadingOverlayHidden = true;
	var overlayIsLessIntense = false;

	this.HideLoadingOverlay = function ()
	{
		if (!loadingOverlayHidden)
		{
			loadingOverlayHidden = true;
			$("#camimg_loading").hide();
		}
		self.HideLoadingAnimation();
	}
	this.HideLoadingAnimation = function ()
	{
		if (!loadingAnimHidden)
		{
			loadingAnimHidden = true;
			$("#camimg_loading_anim").hide();
		}
	}
	this.ShowLoadingOverlay = function (showAnimation, lessIntenseOverlay)
	{
		if (loadingOverlayHidden)
		{
			loadingOverlayHidden = false;
			$("#camimg_loading").show();
		}
		if (lessIntenseOverlay && !overlayIsLessIntense)
			$("#camimg_loading").addClass("lessIntense");
		else if (!lessIntenseOverlay && overlayIsLessIntense)
			$("#camimg_loading").removeClass("lessIntense");
		if (showAnimation)
			self.ShowLoadingAnimation();
		else
			self.HideLoadingAnimation();
	}
	this.ShowLoadingAnimation = function ()
	{
		if (loadingAnimHidden)
		{
			loadingAnimHidden = false;
			$("#camimg_loading_anim").show();
		}
	}
	this.HideFalseLoadingOverlay = function ()
	{
		if (!falseLoadingOverlayHidden)
		{
			falseLoadingOverlayHidden = true;
			$("#camimg_false_loading").hide();
		}
	}
	this.ShowFalseLoadingOverlay = function ()
	{
		if (falseLoadingOverlayHidden)
		{
			falseLoadingOverlayHidden = false;
			$("#camimg_false_loading").show();
		}
	}
	this.ShowTemporaryPlayIcon = function (duration)
	{
		self.HideTemporaryIcons();
		fadeIcons($("#camimg_playIcon,#camimg_centerIconBackground"), duration);
	}
	this.ShowTemporaryPauseIcon = function ()
	{
		self.HideTemporaryIcons();
		fadeIcons($("#camimg_pauseIcon,#camimg_centerIconBackground"));
	}
	var fadeIcons = function ($icons, duration)
	{
		if (!duration)
			duration = 1000;
		$icons.show().fadeOut(duration);
	}
	this.HideTemporaryIcons = function ()
	{
		$("#camimg_playIcon,#camimg_pauseIcon,#camimg_centerIconBackground").stop(true, true);
	}
})();
///////////////////////////////////////////////////////////////
// Generic Quality Helper /////////////////////////////////////
///////////////////////////////////////////////////////////////
function GenericQualityHelper()
{
	var self = this;
	this.GetID = function ()
	{
		return dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().uniqueQualityId;
	}
	this.GetShortAbbr = function ()
	{
		return dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().shortAbbr;
	}
	this.GetAbbr = function ()
	{
		return dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().abbr;
	}
	this.GetName = function ()
	{
		return dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().text;
	}
	this.GetPlayerID = function ()
	{
		return dropdownBoxes.listDefs["streamingQuality"].getCurrentlySelectedItem().player;
	}
}
///////////////////////////////////////////////////////////////
// Jpeg Quality Helper ////////////////////////////////////////
///////////////////////////////////////////////////////////////
function JpegQualityHelper()
{
	var self = this;
	this.getQualityArg = function ()
	{
		var currentQualityId = genericQualityHelper.GetID();
		if (currentQualityId == "B") // Standard Definition
			return "&q=50";
		else if (currentQualityId == "C") // Low Definition
			return "&q=20";
		else // ("A" or other) High Definition
			return "";
	}
	this.ModifyImageDimension = function (imgDimension)
	{
		var currentQualityId = genericQualityHelper.GetID();
		if (currentQualityId == "B") // Standard Definition
			return Math.min(imgDimension, 640);
		else if (currentQualityId == "C") // Low Definition
			return Math.min(imgDimension, 320);
		else // ("A" or other) High Definition
			return imgDimension;
	}
}
///////////////////////////////////////////////////////////////
// H.264 Quality Helper ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function H264QualityHelper()
{
	var self = this;
	this.getQualityArg = function ()
	{
		var currentQualityId = genericQualityHelper.GetID();
		if (currentQualityId == "S0") // Streaming 0 profile
			return "0";
		else if (currentQualityId == "S1") // Streaming 1 profile
			return "1";
		else // ("S2" or other) Streaming 2 profile
			return "2";
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
		if (!videoPlayer.Loading().image.isLive)
			return false;

		videoPlayer.suppressMouseHelper();

		var downloadButton = $("#cmroot_liveview_downloadbutton_findme").closest(".b-m-item");
		if (downloadButton.parent().attr("id") == "cmroot_liveview_downloadlink")
			downloadButton.parent().attr("href", videoPlayer.GetLastSnapshotUrl());
		else
			downloadButton.wrap('<a id="cmroot_liveview_downloadlink" style="display:block" href="'
				+ videoPlayer.GetLastSnapshotUrl()
				+ '" onclick="saveSnapshot(&quot;#cmroot_liveview_downloadlink&quot;)" target="_blank"></a>');
		$("#cmroot_liveview_downloadlink").attr("download", "temp.jpg");

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
			case "copyimageaddress":
				clipboardHelper.CopyText(location.origin + videoPlayer.GetLastSnapshotUrl());
				break;
			case "saveas":
				return true;
			case "statsfornerds":
				nerdStats.Open();
				break;
			default:
				toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	}
	var onCancelLiveContextMenu = function ()
	{
	}
	var optionLive =
		{
			alias: "cmroot_live", width: 200, items:
			[
				{ text: "Open image in new tab", icon: "#svg_mio_Tab", iconClass: "noflip", alias: "opennewtab", action: onLiveContextMenuAction }
				, { text: '<div id="cmroot_liveview_downloadbutton_findme" style="display:none"></div>Save image to disk', icon: "#svg_x5F_Snapshot", alias: "saveas", action: onLiveContextMenuAction }
				, { text: "Open HLS Stream", icon: "#svg_mio_ViewStream", iconClass: "noflip", alias: "openhls", tooltip: "Opens a live H.264 stream in an efficient, cross-platform player. This method delays the stream by several seconds.", action: onLiveContextMenuAction }
				, { text: "Copy image address", icon: "#svg_mio_copy", iconClass: "noflip", alias: "copyimageaddress", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "<span id=\"contextMenuCameraName\">Camera Name</span>", icon: "", alias: "cameraname" }
				, { type: "splitLine" }
				, { text: "<span id=\"contextMenuMaximize\">Maximize</span>", icon: "#svg_mio_Fullscreen", iconClass: "noflip", alias: "maximize", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "Trigger Now", icon: "#svg_x5F_Alert1", iconClass: "iconBlue", alias: "trigger", action: onLiveContextMenuAction }
				, { text: "<span id=\"manRecBtnLabel\">Toggle Recording</span>", icon: "#svg_x5F_Stoplight", iconClass: "iconBlue", alias: "record", tooltip: "Toggle Manual Recording", action: onLiveContextMenuAction }
				, { text: "Snapshot in Blue Iris", icon: "#svg_x5F_Snapshot", iconClass: "iconBlue", alias: "snapshot", tooltip: "Blue Iris will record a snapshot", action: onLiveContextMenuAction }
				, { text: "Restart Camera", icon: "#svg_x5F_Restart", iconClass: "iconBlue", alias: "restart", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "Stats for nerds", icon: "#svg_x5F_Info", alias: "statsfornerds", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "Properties", icon: "#svg_x5F_Viewdetails", alias: "properties", action: onLiveContextMenuAction }
			]
			, onContextMenu: onTriggerLiveContextMenu
			, onCancelContextMenu: onCancelLiveContextMenu
			, onShow: onShowLiveContextMenu
			, clickType: GetPreferredContextMenuTrigger()
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

		videoPlayer.suppressMouseHelper();

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
			case "statsfornerds":
				nerdStats.Open();
				return;
			case "copyimageaddress":
				clipboardHelper.CopyText(location.origin + videoPlayer.GetLastSnapshotUrl());
				break;
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
				, { text: "Copy image address", icon: "#svg_mio_copy", iconClass: "noflip", alias: "copyimageaddress", action: onLiveContextMenuAction }
				, { type: "splitLine" }
				, { text: "<span id=\"contextMenuClipName\">Clip Name</span>", icon: "", alias: "clipname" }
				, { type: "splitLine" }
				, { text: "Close Clip", icon: "#svg_x5F_Error", alias: "closeclip", action: onRecordContextMenuAction }
				, { type: "splitLine" }
				, { text: "Stats for nerds", icon: "#svg_x5F_Info", alias: "statsfornerds", action: onRecordContextMenuAction }
				, { type: "splitLine" }
				, { text: "Properties", icon: "#svg_x5F_Viewdetails", alias: "properties", action: onRecordContextMenuAction }
			]
			, onContextMenu: onTriggerRecordContextMenu
			, onShow: onShowRecordContextMenu
			, clickType: GetPreferredContextMenuTrigger()
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
			, clickType: GetPreferredContextMenuTrigger()
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
			, clickType: GetPreferredContextMenuTrigger()
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
			, clickType: GetPreferredContextMenuTrigger()
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
	var loadedOnce = false;
	this.open = function ()
	{
		CloseCameraListDialog();
		modal_cameralistdialog = $('<div id="cameralistdialog">'
			+ '<div id="cameralistcontent" class="cameralistcontent"></div>'
			+ '</div>'
		).dialog({
			title: "Camera List"
			, onClosing: DialogClosing
			, onRefresh: function () { self.refresh(); }
		});

		BI_CustomEvent.AddListener("CameraListLoaded", CameraListLoaded);

		self.refresh();
	}
	this.refresh = function ()
	{
		if (modal_cameralistdialog)
		{
			modal_cameralistdialog.setLoadingState(true);
			cameraListLoader.LoadCameraList();
		}
	}
	var CameraListLoaded = function ()
	{
		var $cameralistcontent = $("#cameralistcontent");
		if ($cameralistcontent.length == 0 || modal_cameralistdialog == null)
			return;
		modal_cameralistdialog.setLoadingState(false);
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
		modal_cameralistdialog.contentChanged(!loadedOnce);
		loadedOnce = true;
	}
	var DialogClosing = function ()
	{
		BI_CustomEvent.RemoveListener("CameraListLoaded", CameraListLoaded);
		loadedOnce = false;
		modal_cameralistdialog = null;
	}
	var CloseCameraListDialog = function ()
	{
		if (modal_cameralistdialog != null)
			modal_cameralistdialog.close();
	}
	this.ShowRawCameraList = function ()
	{
		$('<div class="cameralistcontent selectable"></div>').append(ArrayToHtmlTable(cameraListLoader.GetLastResponse().data)).dialog({ title: "Raw Camera List" });
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
	var loadedOnce = false;
	this.open = function (camId)
	{
		CloseCameraProperties();

		var camName = cameraListLoader.GetCameraName(camId);
		modal_cameraPropDialog = $('<div id="campropdialog">'
			+ '<div id="campropcontent" class="dialogOptionPanel"><div style="text-align: center">Loading...</div></div>'
			+ '</div>'
		).dialog({
			title: "Camera Properties"
			, overlayOpacity: 0.3
			, closeOnOverlayClick: true
			, onClosing: function ()
			{
				loadedOnce = false;
				modal_cameraPropDialog = null;
				cameraListDialog.refresh();
			}
			, onRefresh: function () { self.refresh(camId); }
		});

		self.refresh(camId);
	}
	this.refresh = function (camId)
	{
		if (modal_cameraPropDialog)
		{
			modal_cameraPropDialog.setLoadingState(true);

			cameraConfig.get(camId, function (response)
			{
				if (modal_cameraPropDialog == null)
					return;
				modal_cameraPropDialog.setLoadingState(false);

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
						var collapsible = new CollapsibleSection("info", "Information", modal_cameraPropDialog);
						$camprop.append(collapsible.$heading);
						var $infoSection = collapsible.$section;
						$infoSection.append(GetInfo("ID", cam.optionValue));
						$infoSection.append(GetInfo("Name", cam.optionDisplay));
						$infoSection.append(GetInfo("Status", cam.isEnabled ? ("Enabled, " + (cam.isOnline ? "Online" : "Offline")) : "Disabled"));
						$infoSection.append(GetInfo("Video", cam.width + "x" + cam.height + " @ " + cam.FPS + " FPS"));
						$infoSection.append(GetInfo("Audio", cam.audio ? "Yes" : "No"));
						$infoSection.append(GetInfo("PTZ", cam.ptz ? "Yes" : "No"));
						$camprop.append($infoSection);
					}

					var collapsible = new CollapsibleSection('gs', "General Settings", modal_cameraPropDialog);
					$camprop.append(collapsible.$heading);
					var $generalSection = collapsible.$section;
					$generalSection.append(GetCamPropCheckbox("schedule|" + camId, "Override Global Schedule", response.data.schedule, camPropOnOffBtnClick));
					$generalSection.append(GetCamPropCheckbox("ptzcycle|" + camId, "PTZ preset cycle", response.data.ptzcycle, camPropOnOffBtnClick));
					$generalSection.append(GetCamPropCheckbox("ptzevents|" + camId, "PTZ event schedule", response.data.ptzevents, camPropOnOffBtnClick));
					$generalSection.append(GetCamPropCheckbox("output|" + camId, "DIO output 1", response.data.output, camPropOnOffBtnClick));
					$generalSection.append(GetCamPropCheckbox("push|" + camId, "Mobile App Push", response.data.push, camPropOnOffBtnClick));
					$generalSection.append('<div class="dialogOption_item dialogOption_item_ddl">'
						+ '<select mysetting="record|' + camId + '" onchange="cameraProperties.camPropSelectChange(this)">'
						+ GetHtmlOptionElementMarkup("-1", "Only manually", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("0", "Every X.X minutes", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("1", "Continuously", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("2", "When triggered", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("3", "Triggered + periodically", response.data.record.toString())
						+ '</select>' + GetDialogOptionLabel("Record:")
						+ '</div>');
					$generalSection.append('<div class="dialogOption_item dialogOption_item_ddl">'
						+ '<select mysetting="alerts|' + camId + '" onchange="cameraProperties.camPropSelectChange(this)">'
						+ GetHtmlOptionElementMarkup("-1", "Never", response.data.alerts.toString())
						+ GetHtmlOptionElementMarkup("0", "This camera is triggered", response.data.alerts.toString())
						+ GetHtmlOptionElementMarkup("1", "Any camera in group is triggered", response.data.alerts.toString())
						+ GetHtmlOptionElementMarkup("2", "Any camera is triggered", response.data.alerts.toString())
						+ '</select>' + GetDialogOptionLabel("Alerts:")
						+ '</div>');
					$camprop.append($generalSection);

					var collapsible = new CollapsibleSection('mt', "Motion/Trigger", modal_cameraPropDialog);
					$camprop.append(collapsible.$heading);
					var $motionSection = collapsible.$section;
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
					$motionSection.append('<div class="dialogOption_item dialogOption_item_ddl">'
						+ '<select mysetting="setmotion.showmotion|' + camId + '" onchange="cameraProperties.camPropSelectChange(this)">'
						+ GetHtmlOptionElementMarkup("0", "No", response.data.setmotion.showmotion.toString())
						+ GetHtmlOptionElementMarkup("1", "Motion", response.data.setmotion.showmotion.toString())
						+ GetHtmlOptionElementMarkup("2", "Objects", response.data.setmotion.showmotion.toString())
						+ GetHtmlOptionElementMarkup("3", "Motion + Objects", response.data.setmotion.showmotion.toString())
						+ '</select>' + GetDialogOptionLabel("Highlight:")
						+ '</div>');
					$camprop.append($motionSection);

					var collapsible = new CollapsibleSection('mro', "Manual Recording Options", modal_cameraPropDialog);
					$camprop.append(collapsible.$heading);
					var $manrecSection = collapsible.$section;
					$manrecSection.append('<div class="dialogOption_item dialogOption_item_center">'
						+ GetCameraPropertyButtonMarkup("Trigger", "trigger", "largeBtnYellow", camId)
						+ GetCameraPropertyButtonMarkup("Snapshot", "snapshot", "largeBtnBlue", camId)
						+ GetCameraPropertyButtonMarkup("Toggle Recording", "manrec", "largeBtnRed", camId)
						+ '</div>');
					$camprop.append($manrecSection);

					var collapsible = new CollapsibleSection('mgmt', "Camera Management", modal_cameraPropDialog);
					$camprop.append(collapsible.$heading);
					var $mgmtSection = collapsible.$section;
					$mgmtSection.append('<div class="dialogOption_item dialogOption_item_center">'
						+ GetCameraPropertyButtonMarkup("Pause", "pause", "largeBtnDisabled", camId)
						+ GetCameraPropertyButtonMarkup("Restart", "reset", "largeBtnBlue", camId)
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
					$camprop.append('<div class="dialogOption_item dialogOption_item_center"><input type="button" class="simpleTextButton btnTransparent" onclick="cameraProperties.OpenRaw(&quot;' + camId + '&quot;)" value="view raw data" /></div>');

				modal_cameraPropDialog.contentChanged(!loadedOnce);
				loadedOnce = true;
			}, function ()
				{
					CloseCameraProperties();
				});
		}
	}
	var CloseCameraProperties = function ()
	{
		if (modal_cameraPropDialog != null)
			modal_cameraPropDialog.close();
	}
	var GetInfo = function (label, value)
	{
		var $info = $('<div class="dialogOption_item dialogOption_item_info"></div>');
		$info.text(label + ": " + value);
		return $info;
	}
	var GetCamPropCheckbox = function (tag, label, checked, onChange)
	{
		var $parent = $('<div class="dialogOption_item dialogOption_item_cb"></div>');
		$parent.append(GetCustomCheckbox(tag, label, checked, onChange));
		return $parent;
	}
	var GetRangeSlider = function (tag, label, value, min, max, step, invert, scalingMethod, onChange)
	{
		if (invert)
			value = (max - value) + min;

		if (!scalingMethod)
			scalingMethod = function (v) { return v; };

		var $parent = $('<div class="dialogOption_item dialogOption_item_range"></div>');
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
	var GetCameraPropertyButtonMarkup = function (text, buttonId, colorClass, camId)
	{
		return '<input type="button" id="camprop_button_' + buttonId + '" class="largeTextButton ' + colorClass + '" onclick="cameraProperties.camPropButtonClick(&quot;' + camId + '&quot;, &quot;' + buttonId + '&quot;)" value="' + text + '" />';
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

		var $dlg = $('<div id="campropdialog">'
			+ '<div id="campropcontent"></div>'
			+ '</div>');

		var $camprop = $dlg.find("#campropcontent");

		try
		{
			var $thumb = $('<img class="clipPropertiesThumb" src="" alt="clip thumbnail"></img>');
			var thumbPath = currentServer.remoteBaseURL + "thumbs/" + clipData.thumbPath + currentServer.GetRemoteSessionArg("?");
			$thumb.attr('src', thumbPath);
			$thumb.css("border-color", "#" + clipData.colorHex);
			$camprop.append($thumb);

			//$camprop.append(GetInfo("Path", clipData.path));
			$camprop.append(GetInfo("Date", GetDateStr(clipData.displayDate)));
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
			$camprop.append('<div class="dialogOption_item dialogOption_item_center"><input type="button" class="simpleTextButton btnTransparent" onclick="clipProperties.OpenRaw(&quot;' + clipId + '&quot;)" value="view raw data" /></div>');

		$dlg.dialog({
			title: htmlEncode(camName) + ' ' + (clipData.isClip ? "Clip" : "Alert") + ' Properties'
			, overlayOpacity: 0.3
			, closeOnOverlayClick: true
		});
	}
	var GetInfo = function (label, value)
	{
		var $info = $('<div class="dialogOption_item clipprop_item_info"></div>');
		$info.text(label + ": " + value);
		return $info;
	}
	var GetInfoEleValue = function (label, ele)
	{
		var $info = $('<div class="dialogOption_item clipprop_item_info"></div>');
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
		var $dlg = $('<div id="campropdialog">'
			+ '<div id="campropcontent"></div>'
			+ '</div>');

		var $camprop = $dlg.find("#campropcontent");
		$camprop.append('<div class="dialogOption_item clipprop_item_info">Click each link to download the desired clips.</div>');
		$camprop.append('<div class="dialogOption_item clipprop_item_info">Each link will disappear after it is clicked, so you can\'t accidentally download duplicates.</div>');
		for (var i = 0; i < allSelectedClipIDs.length; i++)
			$camprop.append(GetLink(allSelectedClipIDs[i]));

		$dlg.dialog({ title: "Download Multiple Clips" });
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
		return $('<div class="dialogOption_item clipprop_item_info"></div>').append($link);
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
		var $root = $('<div class="ObjectVisualizer"></div>');
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
		$root.dialog({ title: "Object Visualizer" });
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
			var msg = "Failed to delete " + clipOrAlert + ".<br/>" + (sessionManager.IsAdministratorSession() ? ("The " + clipOrAlert + " may be still recording.") : ("You need administrator permission to delete " + clipOrAlert + "s."));
			if (typeof cbFailure == "function")
				cbFailure(msg);
			else
				toaster.Warning(msg, 10000);
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
			var msg = 'Unable to contact Blue Iris server.';
			if (typeof cbFailure == "function")
				cbFailure(msg);
			else
				toaster.Error(msg, 3000);
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
		CloseSysConfigDialog();
		modal_systemconfigdialog = $('<div id="sysconfigdialog"><div id="sysconfigcontent"></div></div>')
			.dialog({
				title: "System Configuration"
				, onClosing: function () { modal_systemconfigdialog = null; }
			});
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

			if (modal_systemconfigdialog != null)
				modal_systemconfigdialog.contentChanged(true);
		}, function ()
			{
				toaster.Error('Unable to contact Blue Iris server.', 3000);
				CloseSysConfigDialog();
			});
	}
	var CloseSysConfigDialog = function ()
	{
		if (modal_systemconfigdialog != null)
			modal_systemconfigdialog.close();
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
// List Dialog ////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ListDialog(options_arg)
{
	var self = this;
	var modal_dialog = null;
	var loadedOnce = false;
	var $content;

	var settings = $.extend({
		title: "Unnamed List Dialog"
		, json_command: ""
		, headers: []
		, get_row: function (data) { return ""; }
	}, options_arg);

	this.open = function ()
	{
		CloseListDialog();
		var $dlg = $('<div class="listDialog"></div>');
		$content = $('<div class="listDialogContent"><div style="text-align: center; margin-top: 20px;">Loading...</div></div>');
		$dlg.append($content);
		modal_dialog = $dlg.dialog({
			title: settings.title
			, onRefresh: function () { refreshListDialog(); }
			, onClosing: function ()
			{
				modal_dialog = null;
				loadedOnce = false;
			}
		});
		refreshListDialog();
	}
	var refreshListDialog = function ()
	{
		modal_dialog.setLoadingState(true);
		ExecJSON({ cmd: settings.json_command }, function (response)
		{
			if (modal_dialog == null)
				return;
			modal_dialog.setLoadingState(false);
			if (typeof response.result == "undefined")
			{
				CloseListDialog();
				toaster.Error("Unexpected response when requesting " + settings.title + " from server.");
				return;
			}
			if (response.result == "fail")
			{
				CloseListDialog();
				openLoginDialog();
				return;
			}
			if (!$content || $content.length == 0)
				return;
			var sb = [];
			sb.push('<table><thead><tr>');
			for (var i = 0; i < settings.headers.length; i++)
			{
				sb.push('<th>');
				sb.push(settings.headers[i]);
				sb.push('</th>');
			}
			sb.push('</tr></thead><tbody></tbody></table>');
			$content.html(sb.join(""));
			var $tbody = $content.find("tbody");
			for (var i = 0; i < response.data.length; i++)
				$tbody.append(settings.get_row(response.data[i]));
			modal_dialog.contentChanged(!loadedOnce);
			loadedOnce = true;
		}, function ()
			{
				toaster.Error('Unable to contact Blue Iris server.', 3000);
				CloseListDialog();
			});
	}
	var CloseListDialog = function ()
	{
		if (modal_dialog != null)
			modal_dialog.close();
	}
}
function GetLevelImageMarkup(level)
{
	if (level == 0)
		return GetSysLogIcon("#svg_x5F_Info", "#0088FF");
	if (level == 1)
		return GetSysLogIcon("#svg_x5F_Warning", "#FFFF00");
	if (level == 2)
		return GetSysLogIcon("#svg_x5F_Error", "#FF0000");
	if (level == 3)
		return GetSysLogIcon("#svg_x5F_Alert1", "#FF0000");
	if (level == 4)
		return GetSysLogIcon("#svg_x5F_OK", "#00FF00");
	if (level == 10)
		return GetSysLogIcon("#svg_x5F_User", "#FFFFFF");
	return '<span title="Log level ' + level + ' is unknown">' + level + '</span>';
}
function GetSysLogIcon(iconId, color)
{
	return '<div class="logicon" style="color: ' + color + '"><svg class="icon"><use xlink:href="' + iconId + '"></use></svg></div>';
}
///////////////////////////////////////////////////////////////
// System Log /////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var systemLog = new ListDialog({
	title: "System Log"
	, json_command: "log"
	, headers: ["", "#", "Time", "Object", "Message"]
	, get_row: function (data)
	{
		var date = GetServerDate(new Date(data.date * 1000));
		var dateStr = GetDateStr(date);
		var level = GetLevelImageMarkup(data.level);
		var count = typeof data.count == "undefined" ? "" : parseInt(data.count);
		return '<tr><td class="levelcolumn">' + level + '</td><td class="centercolumn" style="font-weight: bold;">' + count + '</td><td>' + dateStr + '</td><td style="font-weight: bold;">' + htmlEncode(data.obj) + '</td><td>' + htmlEncode(data.msg) + '</td></tr>';
	}
});
///////////////////////////////////////////////////////////////
// User List //////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var userList = new ListDialog({
	title: "User List"
	, json_command: "users"
	, headers: ["Online", "#", "Last Connected", "User", "Object", "Message"]
	, get_row: function (data)
	{
		var date = GetServerDate(new Date(data.date * 1000));
		var dateStr = data.date == 0 ? "never" : GetDateStr(date);
		var level = GetLevelImageMarkup(data.level);
		var count = typeof data.count == "undefined" ? "" : parseInt(data.count);
		return '<tr>'
			+ '<td>' + (data.isOnline ? "Online" : "") + '</td>'
			+ '<td class="centercolumn" style="font-weight: bold;">' + count + '</td>'
			+ '<td>' + dateStr + '</td>'
			+ '<td>' + htmlEncode(data.obj) + '</td>'
			+ '<td style="font-weight: bold;">' + htmlEncode(data.object) + '</td>'
			+ '<td>' + htmlEncode(data.msg) + '</td>'
			+ '</tr>';
	}
});
///////////////////////////////////////////////////////////////
// Devices List ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var deviceList = new ListDialog({
	title: "Device List"
	, json_command: "devices"
	, headers: ["#", "Last Connected", "Name", "Type", "Inside", "Push"]
	, get_row: function (data)
	{
		var date = GetServerDate(new Date(data.date * 1000));
		var dateStr = data.date == 0 ? "never" : GetDateStr(date);
		var level = GetLevelImageMarkup(data.level);
		var count = typeof data.count == "undefined" ? "" : parseInt(data.count);
		return '<tr>'
			+ '<td class="centercolumn" style="font-weight: bold;">' + count + '</td>'
			+ '<td>' + dateStr + '</td>'
			+ '<td title="ID: ' + htmlEncode(data.id) + '">' + data.name + '</td>'
			+ '<td>' + data.type + '</td>'
			+ '<td>' + data.inside + '</td>'
			+ '<td>' + (data.push == 0 ? "" : "Enabled") + '</td>'
			+ '</tr>';
	}
});
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
var aboutDialog = null;
function openAboutDialog()
{
	closeAboutDialog();
	aboutDialog = $("#aboutDialog").dialog({ title: "About UI3" });
}
function closeAboutDialog()
{
	if (aboutDialog != null)
	{
		aboutDialog.close();
		aboutDialog = null;
	}
}
///////////////////////////////////////////////////////////////
// Login Dialog ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var loginModal = null;
function openLoginDialog()
{
	closeLoginDialog();
	if (settings.bi_rememberMe == "1")
	{
		$('#loginDialog input[type="text"][varname="user"]').val(Base64.decode(settings.bi_username));
		$('#loginDialog input[type="password"][varname="pass"]').val(Base64.decode(settings.bi_password));
		$("#cbRememberMe").prop("checked", true);
	}
	else
		$("#cbRememberMe").prop("checked", false);
	loginModal = $("#loginDialog").dialog(
		{
			overlayOpacity: 0.3
			, closeOnOverlayClick: true
			, title: "Administrator Login"
		});
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
	var audioStopTimeout = null;
	var suppressAudioVolumeSave = false;

	this.SuppressAudioVolumeSave = function ()
	{
		return suppressAudioVolumeSave;
	}
	this.SetAudioVolumeFromSettings = function ()
	{
		var effectiveVolume = settings.ui3_audioMute == "1" ? 0 : parseFloat(settings.ui3_audioVolume);
		suppressAudioVolumeSave = true;
		setTimeout(function () { suppressAudioVolumeSave = false; }, 0);
		statusBars.setProgress("volume", effectiveVolume, "");
	}
	this.SetVolume = function (newVolume)
	{
		newVolume = Clamp(newVolume, 0, 1);
		clearMuteStopTimeout();
		audioobj.volume = newVolume;
		volumeIconHelper.setIconForVolume(newVolume);
		if (newVolume == 0)
			audioStopTimeout = setTimeout(function () { self.audioStop(); }, 1000);
		else
			self.audioPlay();
	}
	this.GetVolume = function ()
	{
		return Clamp(audioobj.volume, 0, 1);
	}

	var clearMuteStopTimeout = function ()
	{
		if (audioStopTimeout != null)
		{
			clearTimeout(audioStopTimeout);
			audioStopTimeout = null;
		}
	}
	this.audioPlay = function ()
	{
		volumeIconHelper.setEnabled(false);
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
		volumeIconHelper.setEnabled(true);
		var newSrc = currentServer.remoteBaseURL + "audio/" + videoPlayer.Loading().image.id + "/temp.wav" + currentServer.GetRemoteSessionArg("?", true);
		if ($audiosourceobj.attr("src") != newSrc)
		{
			$audiosourceobj.attr("src", newSrc);
			audioobj.load();
			var playPromise = audioobj.play();
			if (playPromise)
				playPromise["catch"](function (e) { }); // .catch == ["catch"], but .catch is invalid in IE 8-
		}
	}
	this.audioStop = function ()
	{
		volumeIconHelper.setEnabled(false);
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
		volumeIconHelper.setEnabled(false);
		$("#volumeBar").removeClass("up down mute off").addClass("off").css("color", "#F00000");
	});
	$(audioobj).on('waiting', function (e)
	{
		$("#volumeBar").css("color", "#F0F000");
	});
	$(audioobj).on('play playing', function (e)
	{
		volumeIconHelper.setEnabled(true);
		$("#volumeBar").css("color", "#00F000");
	});
	$(audioobj).on('emptied ended pause', function (e)
	{
		$("#volumeBar").css("color", "#969BA7");
	});
}
///////////////////////////////////////////////////////////////
// Volume Icon Helper /////////////////////////////////////////
///////////////////////////////////////////////////////////////
var volumeIconHelper = new (function ()
{
	var self = this;
	var isEnabled = false;
	var iconName = "off";
	this.setEnabled = function (enabled)
	{
		isEnabled = enabled;
		ApplyIcon();
	}
	this.setIconForVolume = function (volume)
	{
		if (volume > 0.5)
			self.setIcon("up");
		else if (volume > 0)
			self.setIcon("down");
		else
			self.setIcon("mute");
	}
	this.setIcon = function (newIconName)
	{
		if (newIconName != "up" && newIconName != "down" && newIconName != "mute" && newIconName != "off")
			newIconName = "mute";
		iconName = newIconName;
		ApplyIcon();
	}
	var ApplyIcon = function ()
	{
		var $icon = $("#pcVolume").removeClass("up down mute off");
		if (isEnabled)
			$icon.addClass(iconName);
		else
			$icon.addClass("off");
	}
	ApplyIcon();
})();
///////////////////////////////////////////////////////////////
// Save Snapshot Button ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function saveSnapshot(btnSelector)
{
	if (typeof btnSelector == "undefined")
		btnSelector = "#save_snapshot_btn";
	var camName = cameraListLoader.GetCameraName(videoPlayer.Loading().image.id);
	var date = GetDateStr(new Date(videoPlayer.GetCurrentImageTimeMs() + GetServerTimeOffset()), true);
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
		container = $('<div style="overflow: hidden;padding:0px;"></div>');
		dialog = container.dialog(
			{
				title: "HTTP Live Stream (HLS) - " + htmlEncode(cameraListLoader.GetCameraName(camId))
				, overlayOpacity: 0.3
				, closeOnOverlayClick: true
				, onClosing: function ()
				{
					container = null;
					dialog = null;
					if (playerObj != null)
						playerObj.stop();
					playerObj = null;
					videoPlayer.RefreshVideoStream();
				}
			});
		videoPlayer.DeactivatePlayer();
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

			dialog.contentChanged(true);
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
	this.IsOpen = function ()
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
			, clickType: GetPreferredContextMenuTrigger()
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
	$(document).on("webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange", function (event)
	{
		if (self.isFullScreen())
			$("#layoutleft,#layouttop").hide();
		else
			$("#layoutleft,#layouttop").show();
		resized();
		self.updateFullScreenButtonState();
	});
	$("#clipFullscreenButton,#clipExitFullscreenButton")
		.on("click", function () { self.toggleFullScreen(); })
		.on("mousedown touchstart", function (e)
		{
			// Prevents the button click from causing camera maximize actions.
			// Do not use touchEvents.Gate(e) here, otherwise events sneak through on touchscreens.
			// stopPropagation prevents the event from reaching videoPlayer.
			e.stopPropagation();
			// And [suppressMouseHelper] clears the state in case the event got there before we stopped propagation.
			videoPlayer.suppressMouseHelper();
		});
	this.updateFullScreenButtonState = function ()
	{
		if (self.isFullScreen())
		{
			$("#clipFullscreenButton").hide();
			$("#clipExitFullscreenButton").show();
		}
		else
		{
			$("#clipFullscreenButton").show();
			$("#clipExitFullscreenButton").hide();
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
	{
		if (videoPlayer.Playback_IsPaused())
			videoOverlayHelper.ShowTemporaryPlayIcon();
		else
			videoOverlayHelper.ShowTemporaryPauseIcon();
		videoPlayer.Playback_PlayPause();
	}
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
		var charCode = e.which ? e.which : event.keyCode;
		var hotkeysBeingRepeated = currentlyDownKeys[charCode];
		if (hotkeysBeingRepeated)
		{
			for (var i = 0; i < hotkeysBeingRepeated.length; i++)
			{
				var s = hotkeysBeingRepeated[i];
				if (s.allowRepeatKey)
				{
					var val = settings[s.key];
					if (!val)
						continue;
					var parts = val.split("|");
					if (parts.length >= 4)
					{
						if ((e.ctrlKey ? "1" : "0") == parts[0]
							&& (e.altKey ? "1" : "0") == parts[1]
							&& (e.shiftKey ? "1" : "0") == parts[2]
							&& (charCode == parts[3]))
						{
							s.actionDown();
						}
					}
				}
			}
			return false;
		}
		var isRepeatKey = currentlyDownKeys[charCode];
		currentlyDownKeys[charCode] = [];
		var retVal = true;
		if ($(".dialog_overlay").length == 0)
		{
			for (var i = 0; i < defaultSettings.length; i++)
			{
				var s = defaultSettings[i];
				if (s.hotkey)
				{
					if (typeof s.actionDown == "function")
					{
						var val = settings[s.key];
						if (!val)
							continue;
						var parts = val.split("|");
						if (parts.length >= 4)
						{
							if ((e.ctrlKey ? "1" : "0") == parts[0]
								&& (e.altKey ? "1" : "0") == parts[1]
								&& (e.shiftKey ? "1" : "0") == parts[2]
								&& (charCode == parts[3]))
							{
								currentlyDownKeys[charCode].push(s);
								s.actionDown();
								retVal = false;
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
		var charCode = e.which ? e.which : event.keyCode;
		var hotkeysBeingReleased = currentlyDownKeys[charCode];
		currentlyDownKeys[charCode] = false;
		var retVal = true;
		if (hotkeysBeingReleased)
		{
			for (var i = 0; i < hotkeysBeingReleased.length; i++)
			{
				var s = hotkeysBeingReleased[i];
				if (typeof s.actionUp == "function")
				{
					s.actionUp();
					retVal = false;
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

	this.getKeyName = function (charCode)
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
	if (toastr)
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
	var showToastInternal = function (type, message, showTime, closeButton, onClick)
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

		if (typeof onClick == "function")
			overrideOptions.onclick = onClick;

		var myToast = toastr[type](message, null, overrideOptions);

		bilog.info(type + " toast: " + message);

		return myToast;
	}
	this.Success = function (message, showTime, closeButton, onClick)
	{
		return showToastInternal('success', message, showTime, closeButton, onClick);
	}
	this.Info = function (message, showTime, closeButton, onClick)
	{
		return showToastInternal('info', message, showTime, closeButton, onClick);
	}
	this.Warning = function (message, showTime, closeButton, onClick)
	{
		return showToastInternal('warning', message, showTime, closeButton, onClick);
	}
	this.Error = function (message, showTime, closeButton, onClick)
	{
		return showToastInternal('error', message, showTime, closeButton, onClick);
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
			if (jqXHR && jqXHR.status == 404 && currentServer.remoteBaseURL == "")
			{
				currentServer.remoteBaseURL = "/";
				ExecJSON(args, callbackSuccess, callbackFail, synchronous);
				return;
			}
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
			var newFps = 1000.0 / lastFrameLoadingTime;
			if (newFps > 2)
				newFps = 2;
			return newFps.toFloat(1);
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
			if (++tickindex == MAXSAMPLES)   /* inc buffer index */
				tickindex = 0;
		}
		/* return average */
		return (ticksum / MAXSAMPLES);
	}
	this.getFPS = function (newtick)
	{
		return (1000 / CalcAverageTick(newtick)).toFloat(1);
	}
}
///////////////////////////////////////////////////////////////
// Bit rate calculator ////////////////////////////////////////
///////////////////////////////////////////////////////////////
var bitRateCalc_Video = new BitRateCalculator();
var bitRateCalc_Audio = new BitRateCalculator();
function BitRateCalculator()
{
	var self = this;
	var first = null;
	var last = null;
	this.averageOverMs = 1000;
	var sum = 0;
	this.AddDataPoint = function (bytes)
	{
		cleanup();
		sum += bytes;
		if (last == null)
			first = last = new BitRateDataPoint(bytes);
		else
			last = last.next = new BitRateDataPoint(bytes);
	}
	this.GetBPS = function ()
	{
		cleanup();
		return sum;
	}
	var cleanup = function ()
	{
		var now = performance.now();
		while (first != null && now - first.time > self.averageOverMs)
		{
			sum -= first.bytes;
			first = first.next;
		}
		if (first == null)
			last = null;
	}
}
function BitRateDataPoint(bytes)
{
	this.bytes = bytes;
	this.time = performance.now();
	this.next = null;
}
///////////////////////////////////////////////////////////////
// Efficient Rolling Average Calculator ///////////////////////
///////////////////////////////////////////////////////////////
function RollingAverage(MAXSAMPLES)
{
	/// <summary>Calculates rolling averages.</summary>
	if (!MAXSAMPLES)
		MAXSAMPLES = 10;
	var tickindex = 0;
	var ticksum = 0;
	var ticklist = [];
	for (var i = 0; i < MAXSAMPLES; i++)
		ticklist.push(0);
	this.Add = function (newValue)
	{
		if (newValue !== null)
		{
			ticksum -= ticklist[tickindex];  // subtract value falling off
			ticksum += newValue;              // add new value
			ticklist[tickindex] = newValue;   // save new value so it can be subtracted later
			if (++tickindex == MAXSAMPLES)   // inc buffer index
				tickindex = 0;
		}
	}
	this.Get = function ()
	{
		return (ticksum / MAXSAMPLES);
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
// Session Timeout ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function SessionTimeout()
{
	var self = this;
	var idleTimer = null;
	var timerStarted = performance.now();

	var idleLogoff = function ()
	{
		if (getTimeoutMs() > 0)
		{
			currentServer.isLoggingOut = true;
			location.href = 'timeout.htm?path=' + encodeURIComponent(location.pathname + location.search);
		}
	}

	var resetTimer = function ()
	{
		if (idleTimer != null)
			clearTimeout(idleTimer);
		if (getTimeoutMs() > 0)
		{
			timerStarted = performance.now();
			idleTimer = setTimeout(idleLogoff, getTimeoutMs());
		}
	}

	var getTimeoutMs = function ()
	{
		return parseFloat(settings.ui3_timeout) * 60 * 1000;
	}
	this.GetMsUntilTimeout = function ()
	{
		/// <summary>Returns the number of milliseconds until idle timeout occurs, or the string "Idle timeout is not enabled".</summary>
		if (getTimeoutMs() > 0)
		{
			var waited = performance.now() - timerStarted;
			return getTimeoutMs() - waited;
		}
		return "Idle timeout is not enabled";
	}

	$(document.body).bind('mousemove keydown click', resetTimer);
	resetTimer();
}
///////////////////////////////////////////////////////////////
// Loading Helper /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function LoadingHelper()
{
	var self = this;
	var loadingFinished = false;
	var things =
		[
			// name, selector, isLoaded
			["window", "#loadingWebContent", false]
			, ["cameraList", "#loadingCameraList", false]
			, ["status", "#loadingServerStatus", false]
			, ["login", "#loadingLogin", false]
			, ["svg", "#loadingSVG", false]
			, ["h264", "#loadingH264", false]
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
// Fetch /video/ h.264 streaming //////////////////////////////
///////////////////////////////////////////////////////////////
var safeFetch = new (function ()
{
	// This object makes sure only one fetch connection is open at a time, to keep from overloading Blue Iris.
	// And to (slightly) reduce the risk of this bug:
	// (as of 2016/2017) Opening fetch objects too rapidly results in some connections getting stuck in "pending" 
	// state and access to the server is blocked until the page is refreshed.  This is a Chrome bug, because when I 
	// proxied all connections through fiddler, the "pending" connection never even made it out of Chrome.
	//
	// I'm tentatively declaring this bug SQUASHED since requiring that the first chunk of data be read from the 
	// fetch stream before it can be canceled.
	var self = this;
	var streamer;
	var queuedRequest = null;
	var stopTimeout = null;
	var streamEndedCbForActiveFetch = null;
	this.OpenStream = function (url, frameCallback, streamEnded)
	{
		queuedRequest = { url: url, frameCallback: frameCallback, streamEnded: streamEnded, activated: false };
		if (streamer)
		{
			// A fetch stream is currently active.  Try to stop it.
			streamer.StopStreaming();
			if (stopTimeout == null)
				stopTimeout = setTimeout(StopTimedOut, 15000);
		}
		else
			OpenStreamNow();
	}
	this.CloseStream = function ()
	{
		// Disable any queued request, because the caller is expecting to not receive any frames after calling CloseStream
		if (queuedRequest)
			queuedRequest.activated = true;
		if (streamer)
			streamer.StopStreaming();
	}
	this.IsActive = function ()
	{
		return streamer ? true : false;
	}
	var OpenStreamNow = function ()
	{
		if (queuedRequest.activated)
			return;
		if (stopTimeout != null)
		{
			clearTimeout(stopTimeout);
			stopTimeout = null;
		}
		queuedRequest.activated = true;
		streamEndedCbForActiveFetch = queuedRequest.streamEnded;
		streamer = new FetchVideoH264Streamer(queuedRequest.url, queuedRequest.frameCallback, StreamEndedWrapper);
	}
	var StreamEndedWrapper = function (message, wasJpeg, wasAppTriggered, videoFinishedStreaming)
	{
		if (stopTimeout != null)
		{
			clearTimeout(stopTimeout);
			stopTimeout = null;
		}
		streamer = null;
		if (streamEndedCbForActiveFetch)
			streamEndedCbForActiveFetch(message, wasJpeg, wasAppTriggered, videoFinishedStreaming);
		OpenStreamNow();
	}
	var StopTimedOut = function ()
	{
		stopTimeout = null;
		toaster.Error('Video streaming connection stuck open! You should reload the page.', 600000, true);
	}
})();
function FetchVideoH264Streamer(url, frameCallback, streamEnded)
{
	var self = this;
	var cancel_streaming = false;
	var stopCalledByApp = false;
	var reader = null;

	// Since at any point we may not have received enough data to finish parsing, we will keep track of parsing progress via a state integer.
	// State 0: Waiting for first 6 bytes of stream header to be available:
	//		DWORD 'blue'
	//		BYTE streams ... 1 for video only, 2 for both audio and video
	//		BYTE size of header total
	// State 1: Waiting for entire header to be available, length determined by 6th byte read in state 0
	// State 2: Waiting for first 5 bytes of block header to be available.
	//		DWORD 'Blue'
	//		BYTE type ... 0 = video, 1 = audio, 2 = status
	// State 3: Waiting for entire block header to be available, length determined by its type.
	// State 4: Waiting for entire audio or video frame data chunk to be available.
	var state = 0;
	var myStream = new GhettoStream();
	var availableStreams = 0; // 1 for video only, 2 for audio and video
	var streamHeaderSize = 0;
	var blockType = -1;
	var currentVideoFrame = { pos: 0, time: 0, utc: 0, size: 0 };
	var currentAudioFrame = { size: 0 };
	var statusBlockSize = 0;
	var bitmapHeader = null;
	var audioHeader = null;

	this.StopStreaming = function ()
	{
		stopCalledByApp = true;
		stopStreaming_Internal();
	}
	var stopStreaming_Internal = function ()
	{
		cancel_streaming = true;
		if (reader)
		{
			myStream = new GhettoStream(); // This is mostly just to release any data stored in the old stream.
			reader.cancel("Streaming canceled");
			reader = null;
		}
	}
	var Start = function ()
	{
		var startTime = performance.now();
		fetch(url).then(function (res)
		{
			if (res.headers.get("Content-Type") == "image/jpeg")
			{
				var blobPromise = res.blob();
				blobPromise.then(function (jpegBlob)
				{
					if (parseInt(res.headers.get("Content-Length")) != jpegBlob.size)
					{
						CallStreamEnded("fetch graceful exit (jpeg incomplete)", true, true);
						return;
					}
					var jpegObjectURL = URL.createObjectURL(jpegBlob);
					frameCallback({ startTime: startTime, jpeg: jpegObjectURL })
					CallStreamEnded("fetch graceful exit (jpeg)", true, true);
				})
				["catch"](function (e)
				{
					CallStreamEnded(e);
				});
				return blobPromise;
			}
			else
			{
				// Do NOT return before the first reader.read() or the fetch can be left in a bad state!
				reader = res.body.getReader();
				return pump(reader);
			}
		})
		["catch"](function (e)
		{
			CallStreamEnded(e);
		});
	}
	function CallStreamEnded(message, naturalEndOfStream, wasJpeg)
	{
		if (typeof streamEnded == "function")
			streamEnded(message, wasJpeg, stopCalledByApp, naturalEndOfStream);
		streamEnded = null;
	}
	function protocolError(error)
	{
		stopStreaming_Internal();
		CallStreamEnded("/video/ Protocol Error: " + error);
	}

	function pump()
	{
		// Do NOT return before the first reader.read() or the fetch can be left in a bad state!
		// Except if reader is null of course.
		if (reader == null)
			return;
		reader.read().then(function (result)
		{
			if (result.done)
			{
				CallStreamEnded("fetch graceful exit (type 1)");
				return;
			}
			else if (cancel_streaming)
			{
				stopStreaming_Internal();
				CallStreamEnded("fetch graceful exit (type 2)");
				return;
			}

			myStream.Write(result.value);

			while (true)
			{
				if (cancel_streaming)
				{
					stopStreaming_Internal();
					CallStreamEnded("fetch graceful exit (type 3)");
				}
				if (state == 0) // Read Stream Header Start
				{
					var buf = myStream.Read(6);
					if (buf == null)
						return pump();

					// First 4 bytes are supposed to be ASCII "blue"
					if (buf[0] != 98 || buf[1] != 108 || buf[2] != 117 || buf[3] != 101)
						return protocolError("stream did not start with \"blue\"");

					availableStreams = buf[4];
					if (availableStreams != 1 && availableStreams != 2)
						return protocolError("availableStreams (" + availableStreams + ") was supposed to be 1 (video) or 2 (audio+video)");

					streamHeaderSize = buf[5];

					state = 1;
				}
				else if (state == 1) // Read Stream Header Remainder
				{
					var buf = myStream.Read(streamHeaderSize);
					if (buf == null)
						return pump();

					// Read BITMAPINFOHEADER structure
					var offsetWrapper = { offset: 0 };
					var bitmapHeaderSize = ReadUInt32LE(buf.buffer, offsetWrapper) - 4;
					if (bitmapHeaderSize > 0)
						bitmapHeader = new BITMAPINFOHEADER(ReadSubArray(buf, offsetWrapper, bitmapHeaderSize));

					if (offsetWrapper.offset < streamHeaderSize)
					{
						// Audio stream was provided.
						// Assuming the remainder of the header is WAVEFORMATEX structure
						audioHeader = new WAVEFORMATEX(ReadSubArray(buf, offsetWrapper, streamHeaderSize - offsetWrapper.offset));
					}

					state = 2;
				}
				else if (state == 2) // Read Block Header Start
				{
					var buf = myStream.Read(5);
					if (buf == null)
						return pump();

					// First 4 bytes are supposed to be ASCII "Blue"
					if (buf[0] != 66 || buf[1] != 108 || buf[2] != 117 || buf[3] != 101)
						return protocolError("block did not start with \"Blue\"");

					blockType = buf[4];

					state = 3;
				}
				else if (state == 3) // Read Block Header Remainder
				{
					if (blockType == 0) // Video
					{
						var buf = myStream.Read(18); // 2 + 4 + 8 + 4
						if (buf == null)
							return pump();
						var offsetWrapper = { offset: 0 };
						currentVideoFrame.pos = ReadUInt16(buf.buffer, offsetWrapper);
						currentVideoFrame.time = ReadUInt32(buf.buffer, offsetWrapper);
						currentVideoFrame.utc = ReadUInt64LE(buf.buffer, offsetWrapper);
						currentVideoFrame.size = ReadUInt32(buf.buffer, offsetWrapper);
						if (currentVideoFrame.size > 10000000)
							return protocolError("Video frame size of " + currentVideoFrame.size + " was rejected.");

						state = 4;
					}
					else if (blockType == 1) // Audio
					{
						var buf = myStream.Read(4);
						if (buf == null)
							return pump();

						currentAudioFrame.size = ReadInt32(buf.buffer, { offset: 0 });
						if (currentAudioFrame.size > 2000000)
							return protocolError("Audio frame size of " + currentAudioFrame.size + " was rejected.");

						state = 4;
					}
					else if (blockType == 2) // Status
					{
						var buf = myStream.Read(1);
						if (buf == null)
							return pump();

						statusBlockSize = buf[0];

						if (statusBlockSize < 6)
							return protocolError("Status block size was invalid (" + statusBlockSize + ")!");

						state = 4;
					}
					else if (blockType == 4)
					{
						stopStreaming_Internal();
						CallStreamEnded("natural end of stream", true);
						return;
					}
					else
						return protocolError("Unknown block type " + blockType + " at state " + state);
				}
				else if (state == 4) // Read AV frame data
				{
					if (blockType == 0) // Video
					{
						var buf = myStream.Read(currentVideoFrame.size);
						if (buf == null)
							return pump();

						bitRateCalc_Video.AddDataPoint(currentVideoFrame.size);

						frameCallback(new VideoFrame(buf, currentVideoFrame));

						state = 2;
					}
					else if (blockType == 1) // Audio
					{
						var buf = myStream.Read(currentAudioFrame.size);
						if (buf == null)
							return pump();

						bitRateCalc_Audio.AddDataPoint(currentAudioFrame.size);

						state = 2;
					}
					else if (blockType == 2) // Status
					{
						var buf = myStream.Read(statusBlockSize - 6); // We already read the first 6 bytes ['B', 'L', 'U', 'E', 2, statusBlockSize]
						if (buf == null)
							return pump();

						var statusBlock = new StatusBlock(buf);

						state = 2;
					}
					else
						return protocolError("Unknown block type " + blockType + " at state " + state);
				}
			}
		}
		)["catch"](function (e)
		{
			stopStreaming_Internal();
			CallStreamEnded(e);
		});
	}

	Start();
}
function StatusBlock(buf)
{
	var offsetWrapper = { offset: 0 };
	this.bRec = ReadByteFromArray(buf, offsetWrapper);
	this.bMotion = ReadByteFromArray(buf, offsetWrapper);
	this.bCheckFPS = ReadByteFromArray(buf, offsetWrapper);
	this.bTriggered = ReadByteFromArray(buf, offsetWrapper);
	this.bSignalLost = ReadByteFromArray(buf, offsetWrapper);

	this.bPushError = ReadByteFromArray(buf, offsetWrapper);
	this.bFlashError = ReadByteFromArray(buf, offsetWrapper);
	this.bForceMovie = ReadByteFromArray(buf, offsetWrapper);

	this.bOther0 = ReadByteFromArray(buf, offsetWrapper);
	this.bOther1 = ReadByteFromArray(buf, offsetWrapper);

	this.fps = ReadInt32(buf.buffer, offsetWrapper); // in 100ths
	this.apeak = ReadInt32(buf.buffer, offsetWrapper); // out of 32767
	this.tpause = ReadInt32(buf.buffer, offsetWrapper);
}
function BITMAPINFOHEADER(buf)
{
	var offsetWrapper = { offset: 0 };
	this.biWidth = ReadUInt32LE(buf.buffer, offsetWrapper); // Width in pixels
	this.biHeight = ReadUInt32LE(buf.buffer, offsetWrapper); // Height in pixels
	this.biPlanes = ReadUInt16LE(buf.buffer, offsetWrapper); // Number of planes (always 1)
	this.biBitCount = ReadUInt16LE(buf.buffer, offsetWrapper); // Bits Per Pixel
	this.biCompression = ReadUInt32LE(buf.buffer, offsetWrapper); // ['J','P','E','G'] or ['M','J','P','G'] (this can be ignored)
	this.biSizeImage = ReadUInt32LE(buf.buffer, offsetWrapper); // Image size in bytes
	this.biXPelsPerMeter = ReadUInt32LE(buf.buffer, offsetWrapper);
	this.biYPelsPerMeter = ReadUInt32LE(buf.buffer, offsetWrapper);
	this.biClrUsed = ReadUInt32LE(buf.buffer, offsetWrapper);
	this.biClrImportant = ReadUInt32LE(buf.buffer, offsetWrapper);
}
function WAVEFORMATEX(buf)
{
	/// <summary>This is only loosely based on the WAVEFORMATEX structure.</summary>
	this.raw = buf;
	var offsetWrapper = { offset: 0 };
	if (buf.length >= 14)
	{
		this.valid = true;
		this.wFormatTag = ReadUInt16LE(buf.buffer, offsetWrapper);
		this.nChannels = ReadUInt16LE(buf.buffer, offsetWrapper);
		this.nSamplesPerSec = ReadUInt32LE(buf.buffer, offsetWrapper);
		this.nAvgBytesPerSec = ReadUInt32LE(buf.buffer, offsetWrapper);
		this.nBlockAlign = ReadUInt16LE(buf.buffer, offsetWrapper);
		this.wBitsPerSample = 0;
		this.cbSize = 0;
		if (buf.length >= 18)
		{
			this.wBitsPerSample = ReadUInt16LE(buf.buffer, offsetWrapper);
			this.cbSize = ReadUInt16LE(buf.buffer, offsetWrapper);
		}
	}
	else
		this.valid = false;
}
function VideoFrame(buf, metadata)
{
	var self = this;
	this.frameData = buf;
	this.pos = metadata.pos;
	this.time = metadata.time;
	this.utc = metadata.utc;
	this.size = metadata.size;
}
///////////////////////////////////////////////////////////////
// GhettoStream ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
// A class which consumes Uint8Array objects and produces Uint8Array objects of whatever size you want by concatenating the inputs as needed.
function GhettoStream()
{
	var self = this;
	var dataQueue = new Queue();
	var totalCachedBytes = 0;
	this.Count = function ()
	{
		return totalCachedBytes;
	}
	this.Write = function (newArray)
	{
		/// <summary>Writes the specified Uint8Array to the stream so it can be read later.</summary>
		dataQueue.enqueue(newArray);
		totalCachedBytes += newArray.length;
	}
	this.Read = function (byteCount)
	{
		/// <summary>Reads the specified number of bytes from the stream, returning null if not enough bytes are available yet.</summary>
		if (byteCount > totalCachedBytes)
			return null;

		var readBuf = new Uint8Array(byteCount);
		var alreadyRead = 0;
		var remainingToRead = byteCount - alreadyRead;

		while (remainingToRead > 0)
		{
			var chunk = dataQueue.peek();
			if (chunk.length > remainingToRead)
			{
				// This chunk will have left-overs.
				readBuf.set(chunk.subarray(0, remainingToRead), alreadyRead);
				dataQueue.replaceFront(chunk.subarray(remainingToRead));
				alreadyRead += remainingToRead;
			}
			else
			{
				// This entire chunk goes into the output buffer.
				readBuf.set(chunk, alreadyRead);
				dataQueue.dequeue();
				alreadyRead += chunk.length;
			}
			remainingToRead = byteCount - alreadyRead;
		}
		totalCachedBytes -= readBuf.length;
		return readBuf;
	}
}
///////////////////////////////////////////////////////////////
// Binary Reading /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ReadByte(buf, offsetWrapper)
{
	var v = new Uint8Array(buf, offsetWrapper.offset, 1)[0];
	offsetWrapper.offset += 1;
	return v;
}
function ReadByteFromArray(buf, offsetWrapper)
{
	return buf[offsetWrapper.offset++];
}
function ReadUInt16(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 2).getUint16(0, false);
	offsetWrapper.offset += 2;
	return v;
}
function ReadUInt16LE(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 2).getUint16(0, true);
	offsetWrapper.offset += 2;
	return v;
}
function ReadInt16(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 2).getInt16(0, false);
	offsetWrapper.offset += 2;
	return v;
}
function ReadInt16LE(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 2).getInt16(0, true);
	offsetWrapper.offset += 2;
	return v;
}
function ReadUInt32(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 4).getUint32(0, false);
	offsetWrapper.offset += 4;
	return v;
}
function ReadUInt32LE(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 4).getUint32(0, true);
	offsetWrapper.offset += 4;
	return v;
}
function ReadInt32(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 4).getInt32(0, false);
	offsetWrapper.offset += 4;
	return v;
}
function ReadInt32LE(buf, offsetWrapper)
{
	var v = new DataView(buf, offsetWrapper.offset, 4).getInt32(0, true);
	offsetWrapper.offset += 4;
	return v;
}
function ReadUInt64(buf, offsetWrapper)
{
	// This is a hack because JavaScript only has 64 bit doubles with 53 bit int precision.
	// If a number were to be higher than 2 ^ 53, this method would return the wrong value.
	var mostSignificant = (ReadUInt32(buf, offsetWrapper) & 0x001FFFFF) * 4294967296;
	var leastSignificant = ReadUInt32(buf, offsetWrapper);
	return mostSignificant + leastSignificant;
}
function ReadUInt64LE(buf, offsetWrapper)
{
	// This is a hack because JavaScript only has 64 bit doubles with 53 bit int precision.
	// If a number were to be higher than 2 ^ 53, this method would return the wrong value.
	var leastSignificant = ReadUInt32LE(buf, offsetWrapper);
	var mostSignificant = (ReadUInt32LE(buf, offsetWrapper) & 0x001FFFFF) * 4294967296;
	return mostSignificant + leastSignificant;
}
function ReadUTF8(buf, offsetWrapper, byteLength)
{
	var v = Utf8ArrayToStr(new Uint8Array(buf, offsetWrapper.offset, byteLength));
	offsetWrapper.offset += byteLength;
	return v;
}
function ReadSubArray(buf, offsetWrapper, byteLength)
{
	var readBuf = new Uint8Array(byteLength);
	readBuf.set(buf.subarray(offsetWrapper.offset, offsetWrapper.offset += byteLength));
	return readBuf;
}
///////////////////////////////////////////////////////////////
// Stats For Nerds ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function UI3NerdStats()
{
	var self = this;
	var dialog = null;
	var $root;
	var isInitialized = false;
	var isUpdating = false;
	var hideOnEndUpdate = {};
	var statsRows = [];
	this.orderedStatNames =
		[
			"Viewport"
			, "Stream Resolution"
			, "Native Resolution"
			, "Seek Position"
			, "Frame Offset"
			, "Frame Time"
			, "Codecs"
			, "Jpeg Loading Time"
			, "Frame Size"
			, "Video Bit Rate"
			, "Audio Bit Rate"
			, "Inter-Frame Time"
			, "Frame Timing Error"
			, "Network Delay"
			, "Player Delay"
			, "Delayed Frames"
		];
	this.Open = function ()
	{
		if (dialog)
			dialog.close();
		isInitialized = false;
		$root = $('<div class="statsForNerds">Video playback must start before stats are available.</div>');
		dialog = $root.dialog(
			{
				title: "Stats for nerds"
				, onClosing: function ()
				{
					dialog = null;
					statsRows = [];
				}
			});
	}
	var Initialize = function ()
	{
		if (isInitialized || !dialog)
			return;
		isInitialized = true;

		$root.empty();
		for (var i = 0; i < self.orderedStatNames.length; i++)
			CreateStat(self.orderedStatNames[i]);
	}
	this.IsOpen = function ()
	{
		return dialog != null;
	}
	var CreateStat = function (name)
	{
		/// <summary>Creates a row for the specified statistic if it does not already exist.</summary>
		if (!dialog)
			return;
		var row = statsRows[name];
		if (!row)
		{
			row = statsRows[name] = new StatsRow(name);
			$root.append(row.GetEleRef());
			dialog.contentChanged(false, true);
		}
	}
	this.BeginUpdate = function ()
	{
		/// <summary>Marks all rows to be hidden during [EndUpdate] unless their values are set during the update.</summary>
		if (isUpdating)
			return;
		Initialize();
		isUpdating = true;
		hideOnEndUpdate = {};
		for (var i = 0; i < self.orderedStatNames.length; i++)
			hideOnEndUpdate[self.orderedStatNames[i]] = true;
	}
	this.EndUpdate = function ()
	{
		/// <summary>Hides all rows that were not updated since [BeginUpdate] was called.</summary>
		if (!isUpdating)
			return;
		Initialize();
		isUpdating = false;
		var hidSome = false;
		for (var i = 0; i < self.orderedStatNames.length; i++)
			if (hideOnEndUpdate[self.orderedStatNames[i]])
			{
				if (statsRows[self.orderedStatNames[i]].Hide())
					hidSome = true;
			}
		if (hidSome)
			dialog.contentChanged(false, true);
	}
	this.UpdateStat = function (name, value, htmlValue, onGraph)
	{
		/// <summary>Adds or updates the value with the specified name.</summary>
		if (!dialog)
			return;
		Initialize();
		var row = statsRows[name];
		if (!row)
		{
			self.orderedStatNames.push(name);
			CreateStat(name);
			row = statsRows[name];
		}
		if (isUpdating)
			hideOnEndUpdate[name] = false;
		row.SetValue(value, htmlValue, onGraph);
	}
	this.HideStat = function (name)
	{
		/// <summary>Immediately hides the specified row.  Designed to be called outside of an organized update.</summary>
		if (!dialog)
			return;
		Initialize();
		var row = statsRows[name];
		if (row)
			row.Hide();
	}
}
function StatsRow(name)
{
	var self = this;
	var $root = $('<div class="statsRow"></div>');
	var $name = $('<div class="statsName">' + name + '</div>');
	var $value = $('<div class="statsValue"></div>');
	var $graphValue = $('<div class="statsGraphValue"></div>');
	var $htmlValue = $('<div class="statsHtmlValue"></div>');
	$value.append($graphValue).append($htmlValue);
	$root.append($name);
	$root.append($value);
	$root.hide();
	var currentValue = null;
	var hidden = true;
	var graph = null;

	this.SetValue = function (value, htmlValue, addToGraph)
	{
		if (hidden)
		{
			hidden = false;
			$root.show();
		}
		currentValue = value;
		if (addToGraph && isNaN(value))
			return;
		if (typeof htmlValue == "undefined")
			htmlValue = htmlEncode(value);
		if (addToGraph)
		{
			CreateGraph();
			graph.AddValue(value, true);
			$htmlValue.html(htmlValue);
		}
		else
		{
			DestroyGraph();
			$htmlValue.html(htmlValue);
		}
	}
	this.GetValue = function ()
	{
		return currentValue;
	}
	this.GetEleRef = function ()
	{
		return $root;
	}
	this.Hide = function ()
	{
		if (hidden)
			return false;
		hidden = true;
		console.log("Hid " + name);
		$root.hide();
		return true;
	}
	this.Hidden = function ()
	{
		return hidden;
	}
	var CreateGraph = function ()
	{
		if (graph)
			return;
		graph = new SimpleGraph();
		$graphValue.append(graph.Get$Canvas());
		$graphValue.css("display", "inline-block");
	}
	var DestroyGraph = function ()
	{
		if (!graph)
			return;
		$graphValue.empty();
		$graphValue.hide();
		graph = null;
	}
}
///////////////////////////////////////////////////////////////
// Simple Graph ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function SimpleGraph()
{
	var self = this;
	var $canvas = $('<canvas class="simpleGraph"></canvas>');
	var canvas = $canvas.get(0);
	var dpiScale = 1;//BI_GetDevicePixelRatio();
	var dataIndex = 0;
	var buffer = null;
	var previousMaximum;

	this.Get$Canvas = function ()
	{
		return $canvas;
	}
	this.AddValue = function (value, drawNow)
	{
		if (!buffer)
			Refresh();
		if (dataIndex >= buffer.length)
			dataIndex = 0;
		buffer[dataIndex] = value;
		dataIndex++;
		if (drawNow)
			Draw();
	}
	var Refresh = function ()
	{
		dpiScale = 1;//BI_GetDevicePixelRatio();
		var h = Math.ceil($canvas.height() * dpiScale);
		if (canvas.height != h)
			canvas.height = h;
		var w = Math.ceil($canvas.width() * dpiScale);
		if (canvas.width != w || !buffer)
		{
			canvas.width = w;
			var ctx = canvas.getContext("2d");
			ctx.translate(0.5, 0);
			ctx.imageSmoothingEnabled = false;
			var newBuffer = new Array(canvas.width);
			// Consider: Handle buffer resizes, preserving as much recent data as possible.
			//if (buffer)
			//{
			//	for (var i = 0, l = Math.min(buffer.length, newBuffer.length); i < l; i++)
			//		newBuffer[i] = buffer[i];
			//}
			dataIndex = 0;
			buffer = newBuffer;
		}
		Draw();
	};
	var Draw = function ()
	{
		var w = canvas.width;
		if (buffer.length != w)
		{
			setTimeout(Refresh, 1);
			return;
		}
		var h = canvas.height;
		var ctx = canvas.getContext("2d");

		ctx.fillStyle = "#222222";
		ctx.fillRect(0, 0, w, h);
		ctx.lineWidth = 1;
		//var min = 9007199254740991;
		var max = 0;
		for (var i = 0; i < w; i++)
		{
			if (buffer[i] > max)
				max = buffer[i];
		}
		ctx.strokeStyle = "#aaaaaa";
		ctx.beginPath();
		for (var i = 0; i < w; i++)
		{
			var v = buffer[i];
			if (v <= 0)
				continue;
			var percentH = 1 - (v / max);
			var scaledH = percentH * h;
			ctx.moveTo(i, h);
			ctx.lineTo(i, scaledH);
		}
		ctx.stroke();
		ctx.strokeStyle = "#0097F0";
		ctx.beginPath();
		ctx.moveTo(dataIndex, 0);
		ctx.lineTo(dataIndex, h);
		ctx.stroke();
	}
}
///////////////////////////////////////////////////////////////
// Mouse Event Helper / Double Click Helper ///////////////////
///////////////////////////////////////////////////////////////
function MouseEventHelper($ele, $excludeRecordings, $excludeLive, excludeFunc, cbOnSingleClick, cbOnDoubleClick, cbDragStart, cbDragMove, cbDragEnd, doubleClickTimeMS, mouseMoveTolerance)
{
	/// <summary>Handles double-click events in a consistent way between touch and non-touch devices.</summary>
	/// <param name="$ele">jQuery object containing elements to listen for clicks on.</param>
	/// <param name="$exclude">jQuery object containing elements to ignore clicks on (maybe these are nested inside [$ele]). May be null.</param>
	/// <param name="cbOnSingleClick">Callback function that is called when a single click occurs.  The first argument is the event object, and the second argument is a boolean indicating whether the single click is confirmed (If false, it may be part of a future double-click.  If true, it is to be treated as a standalone single-click.).</param>
	/// <param name="cbOnDoubleClick">Callback function that is called when a double click occurs.  The first argument is the event object.</param>
	/// <param name="doubleClickTimeMS">(Optional; default: 300) Maximum milliseconds between clicks to consider two clicks a double-click.</param>
	var self = this;
	if (!$ele || $ele.length < 1)
		return;

	if (typeof excludeFunc != "function")
		excludeFunc = function () { };
	if (typeof cbOnSingleClick != "function")
		cbOnSingleClick = function () { };
	if (typeof cbOnDoubleClick != "function")
		cbOnDoubleClick = function () { };
	if (typeof cbDragStart != "function")
		cbDragStart = function () { };

	if (!doubleClickTimeMS || doubleClickTimeMS < 0)
		doubleClickTimeMS = 300;

	if (!mouseMoveTolerance || mouseMoveTolerance < 0)
		mouseMoveTolerance = 5;

	var lastMouseDown1 = { X: -1000, Y: -1000, Time: performance.now() - 600000, Excluded: false };
	var lastMouseDown2 = $.extend({}, lastMouseDown1);
	var lastMouseUp1 = $.extend({}, lastMouseDown1);
	var lastMouseUp2 = $.extend({}, lastMouseDown1);

	var lastEvent = 0; // Workaround for problem in Chrome where some mouse events are missed a moment after fullscreen change.

	var singleClickTimeout = null;
	var singleClickFunction = null;


	var exclude = false;
	var clearExclusion = function ()
	{
		exclude = false;
	}

	if ($excludeRecordings)
	{
		$excludeRecordings.on("mousedown touchstart", function (e)
		{
			if (videoPlayer.Loading().image.isLive)
				return;
			exclude = true;
			setTimeout(clearExclusion, 0);
		});
		$excludeRecordings.on("mouseup touchend touchcancel", function (e)
		{
			if (videoPlayer.Loading().image.isLive)
				return;
			exclude = true;
			setTimeout(clearExclusion, 0);
		});
	}
	if ($excludeLive)
	{
		$excludeLive.on("mousedown touchstart", function (e)
		{
			if (!videoPlayer.Loading().image.isLive)
				return;
			exclude = true;
			setTimeout(clearExclusion, 0);
		});
		$excludeLive.on("mouseup touchend touchcancel", function (e)
		{
			if (!videoPlayer.Loading().image.isLive)
				return;
			exclude = true;
			setTimeout(clearExclusion, 0);
		});
	}

	$ele.on("mousedown touchstart", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (e.which == 3)
			return;
		handleExcludeFunc(e);
		if (lastEvent == 1)
			RecordMouseEvent(2, e); // Inject mouse event that the browser likely missed.
		RecordMouseEvent(1, e);
		cbDragStart(e);
	});
	$ele.on("mouseup touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (e.which == 3)
			return;
		handleExcludeFunc(e);
		var fakeMouseDown = lastEvent == 2;
		if (fakeMouseDown)
			RecordMouseEvent(1, e); // Inject mouse event that the browser likely missed.
		RecordMouseEvent(2, e);
		if (!positionsAreWithinTolerance(lastMouseUp1, lastMouseDown1))
			return; // It doesn't count as a click if the mouse moved too far between down and up.
		if (lastMouseDown1.Excluded || lastMouseUp1.Excluded)
			return;
		// A single click has occurred.
		if (!fakeMouseDown)
			cbOnSingleClick(e, false);
		if (lastMouseUp1.Time - lastMouseUp2.Time < doubleClickTimeMS
			&& lastMouseUp1.Time - lastMouseDown2.Time < doubleClickTimeMS
			&& lastMouseUp2.Time - lastMouseDown2.Time < doubleClickTimeMS
			&& positionsAreWithinTolerance(lastMouseUp2, lastMouseDown2)
			&& positionsAreWithinTolerance(lastMouseDown1, lastMouseDown2)
			&& !lastMouseDown2.Excluded
			&& !lastMouseUp2.Excluded
			&& singleClickTimeout)
		{
			clearTimeout(singleClickTimeout);
			singleClickTimeout = null;
			cbOnDoubleClick(e);
		}
		else if (!fakeMouseDown)
		{
			if (singleClickTimeout)
			{
				// If we get here, a second single click has occurred while another is still unconfirmed.
				// In this case, the previously unconfirmed click gets confirmed early.
				// A typical way this could happen is if the mouse moved between clicks.
				clearTimeout(singleClickTimeout);
				if (singleClickFunction)
					singleClickFunction();
			}
			singleClickFunction = function ()
			{
				singleClickTimeout = null;
				singleClickFunction = null;
				cbOnSingleClick(e, true);
			};
			singleClickTimeout = setTimeout(singleClickFunction, doubleClickTimeMS);
		}
	});
	$(document).on("mousemove touchmove", function (e)
	{
		mouseCoordFixer.fix(e);
		// Determine if this move event starts a drag.
		// When a drag starts, the MouseDown event becomes excluded from further consideration by this helper.
		if (lastMouseDown1.Time > lastMouseUp1.Time)
		{
			// The mouse button is down.
			if (!lastMouseDown1.Excluded)
			{
				// Has the curser moved far enough to start drag?
				if (!positionsAreWithinTolerance(lastMouseDown1, { X: e.pageX, Y: e.pageY }))
				{
					lastMouseDown1.Excluded = true; // Cursor has moved far enough to start a drag.
				}
			}
			cbDragMove(e, true, lastMouseDown1.Excluded);
		}
		else
		{
			cbDragMove(e, false, lastMouseDown1.Excluded);
		}
	});
	$(document).on("mouseup mouseleave", function (e)
	{
		mouseCoordFixer.fix(e);
		cbDragEnd(e);
	});
	var RecordMouseEvent = function (eventNum, e)
	{
		var src, dst;
		if (eventNum == 1)
		{
			src = lastMouseDown1;
			dst = lastMouseDown2;
		}
		else if (eventNum == 2)
		{
			src = lastMouseUp1;
			dst = lastMouseUp2;
		}
		else
			return;
		dst.X = src.X;
		dst.Y = src.Y;
		dst.Time = src.Time;
		dst.Excluded = exclude;
		src.X = e.pageX;
		src.Y = e.pageY;
		src.Time = performance.now();
		src.Excluded = exclude;
		lastEvent = eventNum;
	}
	var positionsAreWithinTolerance = function (positionA, positionB)
	{
		return Math.abs(positionA.X - positionB.X) <= mouseMoveTolerance && Math.abs(positionA.Y - positionB.Y) <= mouseMoveTolerance;
	}
	var handleExcludeFunc = function (e)
	{
		if (excludeFunc(e))
		{
			exclude = true;
			setTimeout(clearExclusion, 0);
		}
	}
	this.Invalidate = function ()
	{
		/// <summary>Sets the Excluded flag on all logged mouse events, causing them to not count toward clicks or double clicks.</summary>
		lastMouseUp1.Excluded = lastMouseUp2.Excluded = lastMouseDown1.Excluded = lastMouseDown2.Excluded = true;
	}
	this.getDoubleClickTime = function ()
	{
		return doubleClickTimeMS;
	}
}
///////////////////////////////////////////////////////////////
// Clipboard Helper ///////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipboardHelper()
{
	var self = this;
	var textToCopy = "";

	var $ele = $('<div class="clipboardHelper" style="display:none;"></div>');
	$('body').append($ele);

	var clipboard = new Clipboard($ele.get(0), { text: function (trigger) { return textToCopy; } });

	self.CopyText = function (text)
	{
		if (text == null)
			textToCopy = "";
		else
			textToCopy = text;
		$ele.click();
	}
}
///////////////////////////////////////////////////////////////
// UI Settings ////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function UISettingsPanel()
{
	var self = this;
	var initialized = false;
	var modal_dialog = null;
	var $dlg = $();
	var $content = $();
	var inputs = {};

	var Initialize = function ()
	{
		if (initialized)
			return;
		initialized = true;

		for (var i = 0; i < defaultSettings.length; i++)
		{
			var s = defaultSettings[i];
			if (s.label)
			{
				if (typeof s.category == "undefined")
					s.category = "Uncategorized";
				if (settingsCategoryList.indexOf(s.category) == -1)
				{
					toaster.Warning("Category " + s.category + " did not exist in the category list!");
					settingsCategoryList.push(s.category);
				}
			}
		}
	}

	this.open = function ()
	{
		Initialize();
		CloseDialog();
		$dlg = $('<div id="uiSettingsPanel" class="dialogOptionPanel"></div>');
		$content = $('<div id="uiSettingsPanelContent"></div>');
		$dlg.append($content);
		modal_dialog = $dlg.dialog({
			title: "UI Settings"
			, overlayOpacity: 0.3
			, closeOnOverlayClick: true
		});

		for (var i = 0; i < settingsCategoryList.length; i++)
			LoadCategory(i, settingsCategoryList[i]);

		modal_dialog.contentChanged(true);
	}
	var LoadCategory = function (index, category)
	{
		var cat = new CollapsibleSection("uiSettings_category_" + index, category, modal_dialog);

		var rowIdx = 0;
		if (category == "General Settings")
		{
			if (settings.bi_rememberMe == "1")
				rowIdx = Add_ForgetSavedCredentialsButton(cat, rowIdx);
		}
		for (var i = 0; i < defaultSettings.length; i++)
		{
			var s = defaultSettings[i];
			if (s.label && s.category == category)
			{
				var $row = $('<div class="uiSettingsRow"></div>');
				if (rowIdx++ % 2 == 1)
					$row.addClass('everyOther');
				if (s.hotkey)
				{
					var $input = $('<input type="text" />');
					AddKeydownEventToElement(HandleHotkeyChange, s, $input);
					var val = settings[s.key];
					if (!val)
						val = "";
					var parts = val.split("|");
					if (parts.length < 4)
						$input.val("unset");
					else
						$input.val((parts[0] == "1" ? "CTRL + " : "")
							+ (parts[1] == "1" ? "ALT + " : "")
							+ (parts[2] == "1" ? "SHIFT + " : "")
							+ hotkeys.getKeyName(parts[3]));
					$row.addClass('dialogOption_item dialogOption_item_info');
					$row.append($input);
					$row.append(GetDialogOptionLabel(s.label));
				}
				else if (s.inputType == "checkbox")
				{
					$row.append(GetCustomCheckbox(s, s.label, settings[s.key] == "1", CheckboxChanged));
				}
				else if (s.inputType == "select")
				{
					var sb = [];
					sb.push('<select>');
					for (var n = 0; n < s.options.length; n++)
						sb.push(GetHtmlOptionElementMarkup(s.options[n], s.options[n], settings[s.key]));
					sb.push('</select>');
					var $select = $(sb.join(''));
					AddChangeEventToElement(SelectChanged, s, $select);
					$row.addClass('dialogOption_item dialogOption_item_ddl');
					$row.append($select);
					$row.append(GetDialogOptionLabel(s.label));
				}
				else if (s.inputType == "number")
				{
					var $input = $('<input type="number" />');
					$input.val(settings[s.key]);
					AddChangeEventToElement(NumberChanged, s, $input);
					$row.addClass('dialogOption_item dialogOption_item_info');
					$row.append($input);
					$row.append(GetDialogOptionLabel(s.label));
				}
				cat.$section.append($row);
			}
		}

		$content.append(cat.$heading);
		$content.append(cat.$section);
	}
	var Add_ForgetSavedCredentialsButton = function (cat, rowIdx)
	{
		var $row = $('<div id="forgetSavedCredentialsRow" class="uiSettingsRow dialogOption_item dialogOption_item_info"></div>');
		var $input = $('<input type="button" value="Forget Now" />');
		$input.on('click', function ()
		{
			$("#forgetSavedCredentialsRow").remove();
			settings.bi_rememberMe = "0";
			settings.bi_username = "";
			settings.bi_password = "";
			toaster.Info("Saved credentials have been forgotten.", 5000);
		});
		$row.append($input);
		$row.append(GetDialogOptionLabel("Forget Saved Credentials"));
		if (rowIdx++ % 2 == 1)
			$row.addClass('everyOther');
		cat.$section.append($row);
		return rowIdx;
	}
	var CheckboxChanged = function (defaultSetting, checked)
	{
		settings[defaultSetting.key] = checked ? "1" : "0";
		CallOnChangeCallback(defaultSetting);
	}
	var SelectChanged = function (e, s, $select)
	{
		var selectedValue = $select.val();
		if (s.options.indexOf(selectedValue) != -1)
			settings[s.key] = selectedValue;
		CallOnChangeCallback(s);
	}
	var NumberChanged = function (e, defaultSetting, $input)
	{
		settings[defaultSetting.key] = parseFloat($input.val());
		CallOnChangeCallback(defaultSetting);
	}
	var HandleHotkeyChange = function (e, defaultSetting, $input)
	{
		var charCode = e.which ? e.which : event.keyCode;

		var modifiers = "";
		if (e.ctrlKey)
			modifiers += "CTRL + ";
		if (e.altKey)
			modifiers += "ALT + ";
		if (e.shiftKey)
			modifiers += "SHIFT + ";

		var keyName = hotkeys.getKeyName(charCode);

		$input.val(modifiers + keyName);

		var hotkeyValue = (e.ctrlKey ? "1" : "0") + "|" + (e.altKey ? "1" : "0") + "|" + (e.shiftKey ? "1" : "0") + "|" + charCode + "|" + keyName;
		settings.setItem(defaultSetting.key, hotkeyValue);

		return false;
	}
	var AddChangeEventToElement = function (eventHandler, defaultSetting, $input)
	{
		/// <summary>Adds a change event handler to the input element.  Doing this in a separate function forces the creation of a new scope and that ensures the arguments to the event handler stay correct.</summary>
		$input.on('change', function (e) { return eventHandler(e, defaultSetting, $input); });
	}
	var AddKeydownEventToElement = function (eventHandler, defaultSetting, $input)
	{
		/// <summary>Adds a keydown event handler to the input element.</summary>
		$input.on('keydown', function (e) { return eventHandler(e, defaultSetting, $input); });
	}
	var CallOnChangeCallback = function (s)
	{
		if (s && typeof s.onChange == "function")
		{
			try
			{
				s.onChange(settings[s.key]);
			}
			catch (ex)
			{
				toaster.Error(ex);
			}
		}
	}
	var CloseDialog = function ()
	{
		if (modal_dialog != null)
		{
			modal_dialog.close();
			modal_dialog = null;
		}
	}
}
function OnChange_ui3_preferred_ui_scale(newValue)
{
	uiSizeHelper.SetUISizeByName(newValue);
}
var ui3_contextMenus_longPress_toast = null;
function OnChange_ui3_contextMenus_longPress(newValue)
{
	if (ui3_contextMenus_longPress_toast)
		ui3_contextMenus_longPress_toast.remove();
	ui3_contextMenus_longPress_toast = toaster.Info("This setting will take effect when you reload the page.<br><br>Clicking this message will reload the page.", 60000, false
		, function ()
		{
			location.reload();
		});
}
function Learn_More_About_Context_Menu_Compatibility_Mode()
{
	$('<div style="padding:10px;font-size: 1.2em;max-width:500px;">'
		+ 'Many useful functions in this interface are accessed by context menus (a.k.a. "Right-click menus").<br><br>'
		+ 'Context menus are normally opened by right clicking.  On most touchscreen devices, instead you must press and hold.<br><br>'
		+ 'However on some devices it is impossible to open context menus the normal way.  If this applies to you,'
		+ ' enable "Context Menu Compatibility Mode".  This will change how context menus'
		+ ' are triggered so they should open when the left mouse button is held down for a moment.'
		+ '</div>')
		.modalDialog({ title: "Context Menu Compatibility Mode" });
}
function Learn_More_About_Double_Click_to_Fullscreen()
{
	$('<div style="padding:10px;font-size: 1.2em;max-width:500px;">'
		+ 'This setting controls whether or not double-clicking the video area triggers fullscreen mode.<br><br>'
		+ 'When double-clicking is enabled, single-click actions on the same area will be delayed by ' + videoPlayer.getDoubleClickTime()
		+ ' milliseconds.  This is to allow the browser time to determine if you intended a single-click or a double-click.<br><br>'
		+ 'In live view, single-clicking a camera selects the camera.'
		+ (settings.ui3_doubleClick_behavior == "Both" || settings.ui3_doubleClick_behavior == "Live View"
			? '<br><span style="color:#ff4700;font-weight:bold;margin-left:15px;">The current setting will delay this behavior by ' + videoPlayer.getDoubleClickTime() + ' milliseconds.</span>'
			: '<br><span style="color:#26cb26;font-weight:bold;margin-left:15px;">The current setting will not delay this behavior.</span>')
		+ '<br><br>'
		+ 'When a recording is open, single-clicking the video invokes Play/Pause.'
		+ (settings.ui3_doubleClick_behavior == "Both" || settings.ui3_doubleClick_behavior == "Recordings"
			? '<br><span style="color:#ff4700;font-weight:bold;margin-left:15px;">The current setting will delay this behavior by ' + videoPlayer.getDoubleClickTime() + ' milliseconds.</span>'
			: '<br><span style="color:#26cb26;font-weight:bold;margin-left:15px;">The current setting will not delay this behavior.</span>')
		+ '</div>')
		.modalDialog({ title: "Double-Click to Fullscreen" });
}
function GetPreferredContextMenuTrigger()
{
	return settings.ui3_contextMenus_longPress == "1" ? "longpress" : "right";
}
///////////////////////////////////////////////////////////////
// Collapsible Section for Dialogs ////////////////////////////
///////////////////////////////////////////////////////////////
function CollapsibleSection(id, htmlTitle, dialogToNotify)
{
	var self = this;

	var GetSectionHeading = function ()
	{
		var $heading = $('<div class="collapsible_section_heading">' + htmlTitle + '</div>');
		$heading.on('click', SectionHeadingClick);
		if (settings.getItem("ui3_cps_" + id + "_visible") == "1")
			$heading.addClass("expanded");
		return $heading;
	}
	var GetSection = function ()
	{
		var $section = $('<div class="collapsible_section"></div>');
		if (settings.getItem("ui3_cps_" + id + "_visible") == "0")
			$section.hide();
		return $section;
	}
	var SectionHeadingClick = function ()
	{
		var $ele = $(this);
		var $section = $ele.next('.collapsible_section');
		$section.slideToggle(
			{
				duration: 150
				, always: function ()
				{
					if (dialogToNotify != null)
						dialogToNotify.contentChanged(false, true);
					var expanded = $section.is(":visible");
					settings.setItem("ui3_cps_" + id + "_visible", expanded ? "1" : "0");
					if (expanded)
						$ele.addClass("expanded");
					else
						$ele.removeClass("expanded");
				}
			});
	}

	this.$heading = GetSectionHeading();
	this.$section = GetSection();
}
///////////////////////////////////////////////////////////////
// Misc ///////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
// Date.now() and performance.now() polyfills
(function ()
{
	window.Date.now = (Date.now || function () { return new Date().getTime(); });
	if ("performance" in window == false)
		window.performance = {};
	if ("now" in window.performance == false)
	{
		var start = Date.now();
		window.performance.now = function () { return Date.now() - start; }
	}
})();
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
function GetDialogOptionLabel(text)
{
	return '<div class="dialogOption_label">' + text + '</div>';
}
function GetHtmlOptionElementMarkup(value, name, selectedValue)
{
	return '<option value="' + value + '"' + (selectedValue == value ? ' selected="selected"' : '') + '>' + name + '</option>';
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
function AskYesNo(question, onYes, onNo, onError, yesText, noText, title)
{
	SimpleDialog.ConfirmHtml(question, onYes, onNo,
		{
			title: title
			, onError: onError
			, yesText: yesText
			, noText: noText
		});
}
String.prototype.padLeft = function (len, c)
{
	var str = this;
	while (str.length < len)
		str = (c || "&nbsp;") + str;
	return str;
};
Number.prototype.padLeft = function (len, c)
{
	return this.toString().padLeft(len, c);
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
	var w = $ele.outerWidth(true);
	var h = $ele.outerHeight(true);
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
String.prototype.toFloat = function (digits)
{
	return parseFloat(this.toFixed(digits));
};
Number.prototype.toFloat = function (digits)
{
	return parseFloat(this.toFixed(digits));
};
function msToTime(totalMs, includeMs)
{
	var ms = totalMs % 1000;
	var totalS = totalMs / 1000;
	var totalM = totalS / 60;
	var totalH = totalM / 60;
	var s = Math.floor(totalS) % 60;
	var m = Math.floor(totalM) % 60;
	var h = Math.floor(totalH);

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
	var sameDay = isSameDay(date, GetServerDate(new Date()));
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
jQuery.cachedScript = function (url, options)
{
	options = $.extend(options || {}, { dataType: "script", cache: true, url: url });
	return jQuery.ajax(options);
};
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
		dm = typeof decimals != "undefined" ? decimals : 2,
		sizes = ['B', 'K', 'M', 'G', 'T', 'PB', 'EB', 'ZB', 'YB'],
		i = Math.floor(Math.log(bytes) / Math.log(k));
	return (negative ? '-' : '') + (bytes / Math.pow(k, i)).toFloat(dm) + sizes[i];
}
function formatBitsPerSecond(bits)
{
	if (bits == 0) return '0 bps';
	var negative = bits < 0;
	if (negative)
		bits = -bits;
	var k = 1000,
		dm = typeof decimals != "undefined" ? decimals : 2,
		sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps', 'Ebps', 'Zbps', 'Ybps'],
		decimals = [0, 0, 1, 2, 2, 2, 2, 2, 2],
		i = Math.floor(Math.log(bits) / Math.log(k));
	return (negative ? '-' : '') + (bits / Math.pow(k, i)).toFloat(decimals[i]) + ' ' + sizes[i];
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
function GetServerDate(date)
{
	/// <summary>
	/// Given a date in local time, returns a new date with the time adjusted so that it reads as if the browser shared a time zone with the server.
	/// </summary>
	return new Date(date.getTime() + GetServerTimeOffset());
}
function GetReverseServerDate(date)
{
	/// <summary>
	/// For use when GetServerDate() caused the date to be offset in the wrong direction for the desired effect.
	/// Due to complex time zone handling, sometimes you need to subtract the time zone offset instead of add it.  This method does that.
	/// </summary>
	return new Date(date.getTime() - GetServerTimeOffset());
}
function GetServerTimeOffset()
{
	/// <summary>
	/// Returns the difference in milliseconds between this browser's time zone and the server's time zone such that this code would print the date and time that it currently is on the server:
	///
	/// var utcMs = new Date().getTime();
	/// var serverTime = new Date(utcMs + GetServerTimeOffset());
	/// console.log(serverTime.toString());
	/// </summary>
	var localOffsetMs = new Date().getTimezoneOffset() * 60000;
	var serverOffsetMs = serverTimeZoneOffsetMs;
	return localOffsetMs - serverOffsetMs;
}