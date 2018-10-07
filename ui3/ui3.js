/* eslint eqeqeq: 0, no-extra-parens: 0, semi: 0, no-redeclare: 0, no-empty: 0 */
/// <reference path="ui3-local-overrides.js" />
/// <reference path="libs-src/jquery-1.12.4.js" />
/// <reference path="libs-ui3.js" />
/// This web interface is licensed under the GNU LGPL Version 3
"use strict";
var developerMode = false;

///////////////////////////////////////////////////////////////
// Feature Detect /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var _browser_is_ie = -1;
function BrowserIsIE()
{
	if (_browser_is_ie === -1)
		_browser_is_ie = /MSIE \d|Trident.*rv:/.test(navigator.userAgent) ? 1 : 0;
	return _browser_is_ie == 1;
}
var _browser_is_edge = -1;
function BrowserIsEdge()
{
	if (_browser_is_edge === -1)
		_browser_is_edge = window.navigator.userAgent.indexOf(" Edge/") > -1 ? 1 : 0;
	return _browser_is_edge === 1;
}
var _browser_is_firefox = -1;
function BrowserIsFirefox()
{
	if (_browser_is_firefox === -1)
		_browser_is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1 ? 1 : 0;
	return _browser_is_firefox === 1;
}
var h264_playback_supported = false;
var audio_playback_supported = false;
var web_workers_supported = false;
var export_blob_supported = false;
var exporting_clips_to_avi_supported = false;
var fetch_supported = false;
var readable_stream_supported = false;
var webgl_supported = false;
var web_audio_supported = false;
var web_audio_buffer_source_supported = false;
var web_audio_buffer_copyToChannel_supported = false;
var web_audio_requires_user_input = false;
var fullscreen_supported = false;
var browser_is_ios = false;
var browser_is_android = false;
var pnacl_player_supported = false;
var mse_mp4_h264_supported = false;
var mse_mp4_aac_supported = false;
var vibrate_supported = false;
var web_audio_autoplay_disabled = false;
function DoUIFeatureDetection()
{
	try
	{
		requestAnimationFramePolyFill();
		if (!isCanvasSupported())
			MissingRequiredFeature("HTML5 Canvas"); // Excludes IE 8
		else if (!areCookiesEnabled())
			MissingRequiredFeature("Cookies", "Cookies are required for UI3's session management.");
		else
		{
			// All critical tests pass
			// Non-critical tests can run here and store their results in global vars.
			browser_is_ios = BrowserIsIOS();
			browser_is_android = BrowserIsAndroid();
			web_workers_supported = typeof Worker !== "undefined";
			export_blob_supported = detectIfCanExportBlob();
			fetch_supported = typeof fetch == "function";
			readable_stream_supported = typeof ReadableStream === "function";
			webgl_supported = detectWebGLContext();
			detectAudioSupport();
			vibrate_supported = detectVibrateSupport();
			fullscreen_supported = ((document.documentElement.requestFullscreen || document.documentElement.msRequestFullscreen || document.documentElement.mozRequestFullScreen || document.documentElement.webkitRequestFullscreen) && (document.exitFullscreen || document.msExitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen)) ? true : false;
			h264_playback_supported = web_workers_supported && fetch_supported && readable_stream_supported && webgl_supported;
			audio_playback_supported = h264_playback_supported && web_audio_supported && web_audio_buffer_source_supported && web_audio_buffer_copyToChannel_supported;
			exporting_clips_to_avi_supported = h264_playback_supported && export_blob_supported;

			if (h264_playback_supported)
			{
				pnacl_player_supported = detectIfPnaclSupported();
				var mse_support = detectMSESupport();
				mse_mp4_h264_supported = (mse_support & 1) > 0;
				mse_mp4_aac_supported = (mse_support & 2) > 0; // Not yet used
			}

			$(function ()
			{
				var ul_root = $('<ul></ul>');
				if (!h264_playback_supported)
				{
					var ul = $('<ul></ul>');
					if (!web_workers_supported)
						ul.append('<li>Web Workers</li>');
					if (!fetch_supported)
						ul.append('<li>Fetch API</li>');
					if (!readable_stream_supported)
						ul.append('<li>ReadableStream</li>');
					if (!webgl_supported)
						ul.append('<li>WebGL</li>');
					ul_root.append($('<li>The H.264 video player requires these unsupported features:</li>').append(ul));
				}
				if (!audio_playback_supported)
				{
					var ul = $('<ul></ul>');
					if (!h264_playback_supported)
						ul.append('<li>H.264 Video Player</li>');
					if (!web_audio_supported)
						ul.append('<li>Web Audio API</li>');
					if (!web_audio_buffer_source_supported)
						ul.append('<li>AudioBufferSourceNode</li>');
					if (!web_audio_buffer_copyToChannel_supported)
						ul.append('<li>AudioBuffer.copyToChannel</li>');
					ul_root.append($('<li>The audio player requires these unsupported features:</li>').append(ul));
				}
				if (!fullscreen_supported)
				{
					ul_root.append('<li>Fullscreen mode is not supported.</li>');
				}
				if (browser_is_ios)
				{
					ul_root.append('<li>Context menus are not supported.</li>');
				}
				if (!isHtml5HistorySupported())
				{
					ul_root.append('<li>The back button will not close the current clip or camera, like it does on most other platforms.</li>');
				}
				if (!exporting_clips_to_avi_supported)
				{
					ul_root.append('<li>Exporting clips to AVI is not supported.</li>');
				}
				if (ul_root.children().length > 0)
				{
					var $opt = $('#optionalFeaturesNotSupported');
					$opt.append(ul_root);
					$opt.show();
				}
				var $videoPlayers = $("<ul></ul>");
				$videoPlayers.append("<li>Jpeg</li>");
				if (h264_playback_supported)
					$videoPlayers.append("<li>H.264 via JavaScript</li>");
				if (pnacl_player_supported)
					$videoPlayers.append("<li>H.264 via NaCl</li>");
				if (mse_mp4_h264_supported)
					$videoPlayers.append("<li>H.264 via HTML5</li>");
				$('#videoPlayersSupported').append($videoPlayers);
			});
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
function MissingRequiredFeature(featureName, description)
{
	alert("This web interface requires a feature that is unavailable or disabled in your web browser.\n\nMissing feature: " + featureName + (description ? ". " + description : "") + "\n\nYou will be redirected to a simpler web interface.");
}
function isCanvasSupported()
{
	var elem = document.createElement('canvas');
	return !!(elem.getContext && elem.getContext('2d'));
}
function areCookiesEnabled()
{
	try
	{
		var session = $.cookie("session");
		if (session)
			return true;
		$.cookie("session", "test", { path: "/" });
		session = $.cookie("session")
		$.cookie("session", "", { path: "/" });
		return session === "test";
	} catch (e) { }
	return false;
}
function isLocalStorageEnabled()
{
	try // May throw exception if local storage is disabled by browser settings!
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
		if (BrowserIsIOSChrome())
			return false; // Chrome on iOS has too many history bugs.
		if (BrowserIsAndroid())
			return false; // If the back button is overridden on Android, it can't be used to close the browser while UI3 is the first item in history.
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
function detectWebGLContext()
{
	var canvas = document.createElement("canvas");
	var gl = canvas.getContext("webgl")
		|| canvas.getContext("experimental-webgl");
	return gl && gl instanceof WebGLRenderingContext;
}
function detectIfCanExportBlob()
{
	try
	{
		return typeof window.URL !== "undefined" && typeof window.URL.revokeObjectURL === "function" && typeof Blob !== "undefined";
	}
	catch (ex)
	{
	}
	return false;
}
function detectIfPnaclSupported()
{
	try
	{
		return navigator.mimeTypes['application/x-pnacl'] !== undefined;
	}
	catch (ex) { }
	return false;
}
function detectMSESupport()
{
	try
	{
		if (window.MediaSource)
		{
			if (MediaSource.isTypeSupported("video/mp4; codecs=\"avc1.640033\""))
				return 1;
		}
	}
	catch (ex) { }
	return 0;
}
function detectAudioSupport()
{
	try
	{
		// Web Audio (camera sound)
		var AudioContext = window.AudioContext || window.webkitAudioContext;
		if (AudioContext)
		{
			var context = new AudioContext();

			if (typeof context.createGain === "function")
			{
				web_audio_supported = true;
				web_audio_autoplay_disabled = context.state === "suspended";

				if (typeof context.createBuffer === "function" && typeof context.createBufferSource === "function")
				{
					var buffer = context.createBuffer(1, 1, 22050);
					if (buffer)
					{
						web_audio_buffer_source_supported = true;
						if (typeof buffer.copyFromChannel === "function" && typeof buffer.copyToChannel === "function")
							web_audio_buffer_copyToChannel_supported = true;
					}
				}
			}
		}
	}
	catch (ex) { }
}
function detectVibrateSupport()
{
	try
	{
		return typeof window.navigator.vibrate === "function";
	}
	catch (ex) { }
	return false;
}

DoUIFeatureDetection();
///////////////////////////////////////////////////////////////
// Globals (most of them) /////////////////////////////////////
///////////////////////////////////////////////////////////////
var toaster = new Toaster();
var ajaxHistoryManager;
var loadingHelper = new LoadingHelper();
var touchEvents = new TouchEventHelper();
var clipboardHelper;
var uiSizeHelper = null;
var uiSettingsPanel = null;
var pcmPlayer = null;
var diskUsageGUI = null;
var systemConfig = null;
var cameraListDialog = null;
var clipProperties = null;
var clipDownloadDialog = null;
var statusBars = null;
var dropdownBoxes = null;
var leftBarBools = null;
var cornerStatusIcons = null;
var genericQualityHelper = null;
var jpegQualityHelper = null;
var streamingProfileUI = null;
var ptzButtons = null;
var playbackHeader = null;
var exportControls = null;
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
var cameraNameLabels = null;
var sessionManager = null;
var statusLoader = null;
var cameraListLoader = null;
var clipLoader = null;
var clipThumbnailVideoPreview = null;
var nerdStats = null;
var sessionTimeout = null;

var currentPrimaryTab = "";

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

///////////////////////////////////////////////////////////////
// Notes that require BI changes //////////////////////////////
///////////////////////////////////////////////////////////////

// TODO: Around May 11, 2018 with BI 4.7.4.1, Blue Iris began enforcing a default jpeg height of 720px sourced from the Streaming 0 profile's frame size setting and I haven't been able to talk the developer out of it.  UI3 now works around this by appending w=99999 to jpeg requests that are intended to be native resolution.  If this limit goes away, the workarounds should be removed.  The workarounds are tagged with "LOC0" (approximately 9 locations).  Since shortly after, this affects quality too, so a q=85 argument has been added at LOC0 locations too.

///////////////////////////////////////////////////////////////
// High priority notes ////////////////////////////////////////
///////////////////////////////////////////////////////////////

// TODO: Properly handle playback and stream reloads of clips that are still being recorded.
// * non-BVR should refuse to open
// * when we get new clip length data for the playing clip, handle it correctly. don't just throw out the new data.
// * reloading the stream (change playback speed) should not cause the current position to change suddenly.
// * don't forget jpeg streams

///////////////////////////////////////////////////////////////
// Low priority notes /////////////////////////////////////////
///////////////////////////////////////////////////////////////

// CONSIDER: Android Chrome > Back button can't close the browser if there is no history, so the back button override is disabled on Android.  Also disabled on iOS for similar bugs.
// CONSIDER: Seeking while paused in Chrome, the canvas sometimes shows the image scaled using nearest-neighbor.
// CONSIDER: Add "Remote Control" menu based on that which is available in iOS and Android apps.
// CONSIDER: Stop using ImageToDataUrl for the clip thumbnail mouseover popup, now that clip thumbnails are cacheable.  I'm not sure there is a point though.
// CONSIDER: Sometimes the clip list scrolls down when you're trying to work with it, probably related to automatic refreshing addings items at the top.

///////////////////////////////////////////////////////////////
// Settings ///////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var CameraLabelTextValues = {
	Name: "Name",
	ShortName: "Short Name",
	Both: "Name (Short Name)"
}
var CameraLabelPositionValues = {
	Above: "Above",
	Top: "Top",
	Bottom: "Bottom",
	Below: "Below"
}
var H264PlayerOptions = {
	JavaScript: "JavaScript",
	HTML5: "HTML5",
	NaCl_HWVA_Auto: "NaCl (Auto hw accel)",
	NaCl_HWVA_No: "NaCl (No hw accel)",
	NaCl_HWVA_Yes: "NaCl (Only hw accel)"
}
function GetH264PlayerOptions()
{
	var arr = new Array();
	if (mse_mp4_h264_supported)
		arr.push(H264PlayerOptions.HTML5);
	if (pnacl_player_supported)
	{
		arr.push(H264PlayerOptions.NaCl_HWVA_Auto);
		arr.push(H264PlayerOptions.NaCl_HWVA_No);
		arr.push(H264PlayerOptions.NaCl_HWVA_Yes);
	}
	arr.push(H264PlayerOptions.JavaScript);
	return arr;
}
function GetDefaultH264PlayerOption()
{
	if (BrowserIsEdge())
		return H264PlayerOptions.JavaScript;
	return GetH264PlayerOptions()[0];
}
var HTML5DelayCompensationOptions = {
	None: "None",
	Weak: "Weak",
	Normal: "Normal",
	Strong: "Strong"
}
var Zoom1xOptions = {
	Camera: "Camera",
	Stream: "Stream"
}
var settings = null;
var settingsCategoryList = ["General Settings", "Video Player", "Clip / Alert Icons", "Event-Triggered Icons", "Event-Triggered Sounds", "Hotkeys", "Camera Labels", "Digital Zoom", "Extra"]; // Create corresponding "ui3_cps_uiSettings_category_" default when adding a category here.
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
			, value: "720p^"
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
			key: "ui3_recordings_flagged_only"
			, value: "0"
		}
		, {
			key: "ui3_cliplist_larger_thumbnails"
			, value: "0"
		}
		, {
			key: "ui3_cliplist_mouseover_thumbnails"
			, value: "1"
		}
		, {
			key: "ui3_clip_export_withAudio"
			, value: "1"
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
			key: "ui3_webcasting_disabled_dontShowAgain"
			, value: "0"
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
			key: "ui3_cps_info_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_gs_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_mt_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_mro_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_mgmt_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_General_Settings_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Video_Player_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Clip___Alert_Icons_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Event_Triggered_Icons_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Event_Triggered_Sounds_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Hotkeys_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Camera_Labels_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Digital_Zoom_visible"
			, value: "1"
		}
		, {
			key: "ui3_cps_uiSettings_category_Extra_visible"
			, value: "1"
		}
		, {
			key: "ui3_streamingProfileArray"
			, value: "[]"
			, category: "Streaming Profiles" // This category isn't shown in UI Settings, but has special-case logic in ui3-local-overrides.js export.
		}
		, {
			key: "ui3_clipPreviewEnabled"
			, value: "1"
			, inputType: "checkbox"
			, label: "Clip Preview Animations"
			, hint: "When enabled, mousing over the alert/clip list shows a rapid animated preview.  Video streaming performance may suffer while the animation is active."
			, category: "General Settings"
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
			key: "ui3_time24hour"
			, value: "0"
			, inputType: "checkbox"
			, label: '24-Hour Time'
			, onChange: OnChange_ui3_time24hour
			, category: "General Settings"
		}
		, {
			key: "ui3_doubleClick_behavior"
			, value: "Recordings"
			, inputType: "select"
			, options: ["None", "Live View", "Recordings", "Both"]
			, label: 'Double-Click to Fullscreen<br><a href="javascript:UIHelp.LearnMore(\'Double-Click to Fullscreen\')">(learn more)</a>'
			, category: "Video Player"
		}
		, {
			key: "ui3_h264_choice2"
			, value: GetDefaultH264PlayerOption()
			, inputType: "select"
			, options: GetH264PlayerOptions()
			, label: 'H.264 Player <a href="javascript:UIHelp.LearnMore(\'H.264 Player Options\')">(learn more)</a>'
			, onChange: OnChange_ui3_h264_choice2
			, preconditionFunc: Precondition_ui3_h264_choice2
			, category: "Video Player"
		}
		, {
			key: "ui3_streamingProfileBitRateMax"
			, value: -1
			, inputType: "number"
			, minValue: -1
			, maxValue: 8192
			, label: 'Maximum H.264 Kbps<div class="settingDesc">(10-8192, disabled if less than 10)</div>'
			, hint: "Useful for slow connections. Audio streams are not affected by this setting."
			, onChange: OnChange_ui3_streamingProfileBitRateMax
			, preconditionFunc: Precondition_ui3_streamingProfileBitRateMax
			, category: "Video Player"
		}
		, {
			key: "ui3_html5_delay_compensation"
			, value: HTML5DelayCompensationOptions.Normal
			, inputType: "select"
			, options: [HTML5DelayCompensationOptions.None, HTML5DelayCompensationOptions.Weak, HTML5DelayCompensationOptions.Normal, HTML5DelayCompensationOptions.Strong]
			, label: 'HTML5 Video Delay Compensation <a href="javascript:UIHelp.LearnMore(\'HTML5 Video Delay Compensation\')">(learn more)</a>'
			, preconditionFunc: Precondition_ui3_html5_delay_compensation
			, category: "Video Player"
		}
		, {
			key: "ui3_force_gop_1sec"
			, value: "1"
			, inputType: "checkbox"
			, label: '<span style="color:#FF0000">Firefox Stutter Fix</span> <a href="javascript:UIHelp.LearnMore(\'Firefox Stutter Fix\')">(learn more)</a>'
			, onChange: OnChange_ui3_force_gop_1sec
			, preconditionFunc: Precondition_ui3_force_gop_1sec
			, category: "Video Player"
		}
		, {
			key: "ui3_jpegSupersampling"
			, value: 1
			, minValue: 0.01
			, maxValue: 2
			, step: 0.01
			, inputType: "range"
			, label: 'Jpeg Video Supersampling Factor'
			, changeOnStep: true
			, hint: "(Default: 1)\n\nJpeg video frames loaded by UI3 will have their dimensions scaled by this amount.\n\nLow values save bandwidth, while high values improve quality slightly."
			, category: "Video Player"
		}
		, {
			key: "ui3_web_audio_autoplay_warning"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Warn if audio playback requires user input'
			, hint: 'When set to "Yes", a full-page overlay will appear if camera audio playback requires user input. Otherwise, the audio icon will simply turn red.'
			, category: "Video Player"
		}
		, {
			key: "ui3_clipicon_trigger_motion"
			, value: "0"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip"><use xlink:href="#svg_mio_run"></use></svg> for motion-triggered alerts'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_clipicon_trigger_audio"
			, value: "1"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip"><use xlink:href="#svg_mio_volumeUp"></use></svg> for audio-triggered alerts'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_clipicon_trigger_external"
			, value: "1"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon"><use xlink:href="#svg_x5F_Alert2"></use></svg> for externally-triggered alerts'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_clipicon_trigger_group"
			, value: "1"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip"><use xlink:href="#svg_mio_quilt"></use></svg> for group-triggered alerts'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_clipicon_clip_audio"
			, value: "1"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip"><use xlink:href="#svg_mio_volumeUp"></use></svg> for clips with audio'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_clipicon_clip_backingup"
			, value: "0"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip"><use xlink:href="#svg_mio_cloudUploading"></use></svg> for clips that are being backed up'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_clipicon_clip_backup"
			, value: "0"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip"><use xlink:href="#svg_mio_cloudUploaded"></use></svg> for clips that have been backed up'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_clipicon_protect"
			, value: "1"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip"><use xlink:href="#svg_mio_lock"></use></svg> for protected items'
			, category: "Clip / Alert Icons"
		}
		, {
			key: "ui3_comment_eventTriggeredIcons_Heading"
			, value: ""
			, inputType: "comment"
			, comment: GenerateEventTriggeredIconsComment
			, category: "Event-Triggered Icons"
		}
		, {
			key: "ui3_icon_motion"
			, value: "0"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon noflip" style="fill: rgba(120,205,255,1)"><use xlink:href="#svg_mio_run"></use></svg> on Motion Detected'
			, category: "Event-Triggered Icons"
		}
		, {
			key: "ui3_icon_trigger"
			, value: "0"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon" style="fill: rgba(255,64,64,1)"><use xlink:href="#svg_x5F_Alert2"></use></svg> on Camera Triggered'
			, category: "Event-Triggered Icons"
		}
		, {
			key: "ui3_icon_recording"
			, value: "0"
			, inputType: "checkbox"
			, label: '<svg class="icon clipicon" style="fill: rgba(255,0,0,1)"><use xlink:href="#svg_x5F_Stoplight"></use></svg> on Camera Recording'
			, hint: "Does not appear when viewing a group of cameras"
			, category: "Event-Triggered Icons"
		}
		, {
			key: "ui3_icons_extraVisibility"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Extra Visibility For Icons'
			, onChange: OnChange_ui3_icons_extraVisibility
			, category: "Event-Triggered Icons"
		}
		, {
			key: "ui3_comment_eventTriggeredSounds_Heading"
			, value: ""
			, inputType: "comment"
			, comment: GenerateEventTriggeredSoundsComment
			, category: "Event-Triggered Sounds"
		}
		, {
			key: "ui3_sound_motion"
			, value: "None"
			, inputType: "select"
			, options: []
			, getOptions: getBISoundOptions
			, alwaysRefreshOptions: true
			, label: 'Motion Detected'
			, onChange: function () { biSoundPlayer.PlayEvent("motion"); }
			, category: "Event-Triggered Sounds"
		}
		, {
			key: "ui3_sound_trigger"
			, value: "None"
			, inputType: "select"
			, options: []
			, getOptions: getBISoundOptions
			, alwaysRefreshOptions: true
			, label: 'Camera Triggered'
			, onChange: function () { biSoundPlayer.PlayEvent("trigger"); }
			, category: "Event-Triggered Sounds"
		}
		, {
			key: "ui3_eventSoundVolume"
			, value: 100
			, minValue: 0
			, maxValue: 100
			, step: 1
			, unitLabel: "%"
			, inputType: "range"
			, label: 'Sound Effect Volume'
			, onChange: function () { biSoundPlayer.AdjustVolume(); }
			, changeOnStep: true
			, category: "Event-Triggered Sounds"
		}
		, {
			key: "ui3_hotkey_maximizeVideoArea"
			, value: "1|0|0|192" // 192: tilde (~`)
			, hotkey: true
			, label: "Maximize Video Area"
			, hint: "Shows or hides the left and top control bars. This can be triggered on page load via the url parameter \"maximize=1\"."
			, actionDown: BI_Hotkey_MaximizeVideoArea
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_togglefullscreen"
			, value: "0|0|0|192" // 192: tilde (~`)
			, hotkey: true
			, label: "Full Screen Mode"
			, hint: "Toggles Full Screen Mode and shows or hides the left and top control bars according to UI defaults."
			, actionDown: BI_Hotkey_FullScreen
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_tab_live"
			, value: "0|0|0|112" // 112: F1
			, hotkey: true
			, label: "Load Tab: Live View"
			, hint: "Opens the Live View tab"
			, actionDown: BI_Hotkey_Load_Tab_Live
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_tab_alerts"
			, value: "0|0|0|113" // 113: F2
			, hotkey: true
			, label: "Load Tab: Alerts"
			, hint: "Opens the Alerts tab"
			, actionDown: BI_Hotkey_Load_Tab_Alerts
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_tab_clips"
			, value: "0|0|0|114" // 114: F3
			, hotkey: true
			, label: "Load Tab: Clips"
			, hint: "Opens the Clips tab"
			, actionDown: BI_Hotkey_Load_Tab_Clips
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_cameraLabels"
			, value: "1|0|0|76" // 76: L
			, hotkey: true
			, label: "Toggle Camera Labels"
			, actionDown: BI_Hotkey_Toggle_Camera_Labels
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_downloadframe"
			, value: "1|0|0|83" // 83: S
			, hotkey: true
			, label: "Download Frame"
			, actionDown: BI_Hotkey_DownloadFrame
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_toggleMute"
			, value: "1|0|0|77" // 77: M
			, hotkey: true
			, label: "Toggle Camera Mute"
			, actionDown: BI_Hotkey_ToggleMute
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_nextCamera"
			, value: "0|0|0|190" // 190: . (period)
			, hotkey: true
			, label: "Next Camera"
			, hint: "Manually cycles to the next camera when a camera is maximized."
			, actionDown: BI_Hotkey_NextCamera
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_prevCamera"
			, value: "0|0|0|188" // 188: , (comma)
			, hotkey: true
			, label: "Previous Camera"
			, hint: "Manually cycles to the previous camera when a camera is maximized."
			, actionDown: BI_Hotkey_PreviousCamera
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_nextGroup"
			, value: "1|0|1|190" // 190: CTRL + SHIFT + . (period)
			, hotkey: true
			, label: "Next Group"
			, hint: "Manually loads your next group or cycle stream."
			, actionDown: BI_Hotkey_NextGroup
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_prevGroup"
			, value: "1|0|1|188" // 188: CTRL + SHIFT + , (comma)
			, hotkey: true
			, label: "Previous Group"
			, hint: "Manually loads your previous group or cycle stream."
			, actionDown: BI_Hotkey_PreviousGroup
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
			key: "ui3_hotkey_toggleReverse"
			, value: "0|0|0|8" // 8: backspace
			, hotkey: true
			, label: "Reverse Playback"
			, hint: "Toggles between Forward and Reverse playback."
			, actionDown: BI_Hotkey_ToggleReverse
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_newerClip"
			, value: "0|0|0|38" // 38: up arrow
			, hotkey: true
			, label: "Next Clip"
			, hint: "Load the next clip, higher up in the list."
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
			, label: "Skip Ahead"
			, hint: "Skips ahead in the current recording by a configurable number of seconds."
			, actionDown: BI_Hotkey_SkipAhead
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_skipBack"
			, value: "0|0|0|37" // 37: left arrow
			, hotkey: true
			, label: "Skip Back"
			, hint: "Skips back in the current recording by a configurable number of seconds."
			, actionDown: BI_Hotkey_SkipBack
			, category: "Hotkeys"
		}
		, {
			key: "ui3_skipAmount"
			, value: 10
			, inputType: "number"
			, minValue: 0
			, maxValue: 9999
			, label: "Skip Time (seconds)"
			, hint: "[0.01-9999] (default: 10) \r\nNumber of seconds to skip forward and back when using hotkeys to skip."
			, onChange: OnChange_ui3_skipAmount
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_skipAhead1Frame"
			, value: "0|0|0|190" // 190: . (period)
			, hotkey: true
			, label: "Skip Ahead 1 Frame"
			, hint: "Skips ahead in the current recording by approximately one frame."
			, actionDown: BI_Hotkey_SkipAhead1Frame
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_skipBack1Frame"
			, value: "0|0|0|188" // 188: , (comma)
			, hotkey: true
			, label: "Skip Back 1 Frame"
			, hint: "Skips back in the current recording by approximately one frame."
			, actionDown: BI_Hotkey_SkipBack1Frame
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_playback_faster"
			, value: "0|0|0|221" // 221: ]
			, hotkey: true
			, label: "Playback Faster"
			, hint: "Increases clip playback speed"
			, actionDown: BI_Hotkey_PlaybackFaster
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_playback_slower"
			, value: "0|0|0|219" // 219: [
			, hotkey: true
			, label: "Playback Slower"
			, hint: "Decreases clip playback speed"
			, actionDown: BI_Hotkey_PlaybackSlower
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_close_clip"
			, value: "0|0|0|27" // 27: escape
			, hotkey: true
			, label: "Close Clip"
			, hint: "Closes the current clip."
			, actionDown: BI_Hotkey_CloseClip
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_close_camera"
			, value: "0|0|0|27" // 27: escape
			, hotkey: true
			, label: "Close Camera"
			, hint: "Closes the current live camera and returns to the group view."
			, actionDown: BI_Hotkey_CloseCamera
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalZoomIn"
			, value: "0|0|1|187" // 187: =
			, hotkey: true
			, label: "Digital Zoom In"
			, hint: "This has the same function as rolling a mouse wheel one notch."
			, actionDown: BI_Hotkey_DigitalZoomIn
			, allowRepeatKey: true
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_digitalZoomOut"
			, value: "0|0|1|189" // : 189: -
			, hotkey: true
			, label: "Digital Zoom Out"
			, hint: "This has the same function as rolling a mouse wheel one notch."
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
			key: "ui3_hotkey_ptzFocusFar"
			, value: "0|0|0|221" // 221: ]
			, hotkey: true
			, label: "PTZ Focus Far"
			, hint: "If the current live camera is PTZ, focuses the camera further away."
			, actionDown: BI_Hotkey_PtzFocusFar
			, actionUp: BI_Hotkey_PtzFocusFar_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzFocusNear"
			, value: "0|0|0|219" // 219: [
			, hotkey: true
			, label: "PTZ Focus Near"
			, hint: "If the current live camera is PTZ, focuses the camera closer."
			, actionDown: BI_Hotkey_PtzFocusNear
			, actionUp: BI_Hotkey_PtzFocusNear_Up
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset1"
			, value: "0|0|0|49" // 49: 1
			, hotkey: true
			, label: "Load Preset 1"
			, hint: "If the current live camera is PTZ, loads preset 1."
			, actionDown: function () { BI_Hotkey_PtzPreset(1); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset2"
			, value: "0|0|0|50" // 50: 2
			, hotkey: true
			, label: "Load Preset 2"
			, hint: "If the current live camera is PTZ, loads preset 2."
			, actionDown: function () { BI_Hotkey_PtzPreset(2); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset3"
			, value: "0|0|0|51" // 51: 3
			, hotkey: true
			, label: "Load Preset 3"
			, hint: "If the current live camera is PTZ, loads preset 3."
			, actionDown: function () { BI_Hotkey_PtzPreset(3); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset4"
			, value: "0|0|0|52" // 52: 4
			, hotkey: true
			, label: "Load Preset 4"
			, hint: "If the current live camera is PTZ, loads preset 4."
			, actionDown: function () { BI_Hotkey_PtzPreset(4); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset5"
			, value: "0|0|0|53" // 53: 5
			, hotkey: true
			, label: "Load Preset 5"
			, hint: "If the current live camera is PTZ, loads preset 5."
			, actionDown: function () { BI_Hotkey_PtzPreset(5); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset6"
			, value: "0|0|0|54" // 54: 6
			, hotkey: true
			, label: "Load Preset 6"
			, hint: "If the current live camera is PTZ, loads preset 6."
			, actionDown: function () { BI_Hotkey_PtzPreset(6); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset7"
			, value: "0|0|0|55" // 55: 7
			, hotkey: true
			, label: "Load Preset 7"
			, hint: "If the current live camera is PTZ, loads preset 7."
			, actionDown: function () { BI_Hotkey_PtzPreset(7); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset8"
			, value: "0|0|0|56" // 56: 8
			, hotkey: true
			, label: "Load Preset 8"
			, hint: "If the current live camera is PTZ, loads preset 8."
			, actionDown: function () { BI_Hotkey_PtzPreset(8); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset9"
			, value: "0|0|0|57" // 57: 9
			, hotkey: true
			, label: "Load Preset 9"
			, hint: "If the current live camera is PTZ, loads preset 9."
			, actionDown: function () { BI_Hotkey_PtzPreset(9); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset10"
			, value: "0|0|0|48" // 48: 0
			, hotkey: true
			, label: "Load Preset 10"
			, hint: "If the current live camera is PTZ, loads preset 10."
			, actionDown: function () { BI_Hotkey_PtzPreset(10); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset11"
			, value: "1|0|0|49" // 49: 1
			, hotkey: true
			, label: "Load Preset 11"
			, hint: "If the current live camera is PTZ, loads preset 11."
			, actionDown: function () { BI_Hotkey_PtzPreset(11); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset12"
			, value: "1|0|0|50" // 50: 2
			, hotkey: true
			, label: "Load Preset 12"
			, hint: "If the current live camera is PTZ, loads preset 12."
			, actionDown: function () { BI_Hotkey_PtzPreset(12); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset13"
			, value: "1|0|0|51" // 51: 3
			, hotkey: true
			, label: "Load Preset 13"
			, hint: "If the current live camera is PTZ, loads preset 13."
			, actionDown: function () { BI_Hotkey_PtzPreset(13); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset14"
			, value: "1|0|0|52" // 52: 4
			, hotkey: true
			, label: "Load Preset 14"
			, hint: "If the current live camera is PTZ, loads preset 14."
			, actionDown: function () { BI_Hotkey_PtzPreset(14); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset15"
			, value: "1|0|0|53" // 53: 5
			, hotkey: true
			, label: "Load Preset 15"
			, hint: "If the current live camera is PTZ, loads preset 15."
			, actionDown: function () { BI_Hotkey_PtzPreset(15); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset16"
			, value: "1|0|0|54" // 54: 6
			, hotkey: true
			, label: "Load Preset 16"
			, hint: "If the current live camera is PTZ, loads preset 16."
			, actionDown: function () { BI_Hotkey_PtzPreset(16); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset17"
			, value: "1|0|0|55" // 55: 7
			, hotkey: true
			, label: "Load Preset 17"
			, hint: "If the current live camera is PTZ, loads preset 17."
			, actionDown: function () { BI_Hotkey_PtzPreset(17); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset18"
			, value: "1|0|0|56" // 56: 8
			, hotkey: true
			, label: "Load Preset 18"
			, hint: "If the current live camera is PTZ, loads preset 18."
			, actionDown: function () { BI_Hotkey_PtzPreset(18); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset19"
			, value: "1|0|0|57" // 57: 9
			, hotkey: true
			, label: "Load Preset 19"
			, hint: "If the current live camera is PTZ, loads preset 19."
			, actionDown: function () { BI_Hotkey_PtzPreset(19); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_hotkey_ptzPreset20"
			, value: "1|0|0|48" // 48: 0
			, hotkey: true
			, label: "Load Preset 20"
			, hint: "If the current live camera is PTZ, loads preset 20."
			, actionDown: function () { BI_Hotkey_PtzPreset(20); }
			, category: "Hotkeys"
		}
		, {
			key: "ui3_cameraLabels_enabled"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Camera Labels Enabled'
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_multiCameras"
			, value: "1"
			, inputType: "checkbox"
			, label: 'Label multi-camera streams'
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_singleCameras"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Label single-camera streams'
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_text"
			, value: CameraLabelTextValues.Name
			, inputType: "select"
			, options: [CameraLabelTextValues.Name, CameraLabelTextValues.ShortName, CameraLabelTextValues.Both]
			, label: "Label Text"
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_position"
			, value: CameraLabelPositionValues.Top
			, inputType: "select"
			, options: [CameraLabelPositionValues.Above, CameraLabelPositionValues.Top, CameraLabelPositionValues.Bottom, CameraLabelPositionValues.Below]
			, label: "Label Position"
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_fontSize"
			, value: 10
			, inputType: "number"
			, minValue: 0
			, maxValue: 128
			, label: "Font Size"
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_minimumFontSize"
			, value: 6
			, inputType: "number"
			, minValue: 0
			, maxValue: 128
			, label: "Min Font Size"
			, hint: "When a group view is rendered smaller than native resolution, font size is scaled down no smaller than this."
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_backgroundColor"
			, value: "#000000"
			, inputType: "color"
			, label: 'Background Color'
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_textColor"
			, value: "#FFFFFF"
			, inputType: "color"
			, label: 'Text Color'
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_cameraColor"
			, value: "1"
			, inputType: "checkbox"
			, label: 'Use Camera Color<div class="settingDesc">(ignore colors set above)</div>'
			, onChange: onui3_cameraLabelsChanged
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_backgroundOpacity"
			, value: 100
			, minValue: 0
			, maxValue: 100
			, step: 1
			, unitLabel: "%"
			, inputType: "range"
			, label: 'Background Opacity'
			, onChange: onui3_cameraLabelsChanged
			, changeOnStep: true
			, category: "Camera Labels"
		}
		, {
			key: "ui3_cameraLabels_textOpacity"
			, value: 100
			, minValue: 0
			, maxValue: 100
			, step: 1
			, unitLabel: "%"
			, inputType: "range"
			, label: 'Text Opacity'
			, onChange: onui3_cameraLabelsChanged
			, changeOnStep: true
			, category: "Camera Labels"
		}
		, {
			key: "ui3_wheelZoomMethod"
			, value: "Adjustable"
			, inputType: "select"
			, options: ["Adjustable", "Legacy"]
			, label: "Digital Zoom Method"
			, onChange: OnChange_ui3_wheelZoomMethod
			, category: "Digital Zoom"
		}
		, {
			key: "ui3_wheelAdjustableSpeed"
			, value: 400
			, minValue: 0
			, maxValue: 2000
			, step: 1
			, inputType: "range"
			, label: 'Digital Zoom Speed<br/>(Requires zoom method "Adjustable")'
			, changeOnStep: true
			, hint: "Default: 400"
			, category: "Digital Zoom"
		}
		, {
			key: "ui3_wheelZoomReverse"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Reverse Mouse Wheel Zoom'
			, hint: "By default, UI3 follows the de-facto standard for mouse wheel zoom, where up zooms in."
			, category: "Digital Zoom"
		}
		, {
			key: "ui3_zoom1x_mode"
			, value: Zoom1xOptions.Camera
			, inputType: "select"
			, options: [Zoom1xOptions.Camera, Zoom1xOptions.Stream]
			, label: 'At 1x zoom, match resolution of: '
			, hint: 'Choose "' + Zoom1xOptions.Stream + '" if clip playback has the wrong aspect ratio.'
			, category: "Digital Zoom"
		}
		, {
			key: "ui3_fullscreen_videoonly"
			, value: "1"
			, inputType: "checkbox"
			, label: 'Full Screen: "Video Only"'
			, hint: 'If "yes", then the left and top control bars are hidden when the UI enters fullscreen mode.'
			, onChange: OnChange_ui3_fullscreen_videoonly
			, category: "Extra"
		}
		, {
			key: "ui3_pc_next_prev_buttons"
			, value: "1"
			, inputType: "checkbox"
			, label: 'Playback Controls: Next/Previous'
			, onChange: OnChange_ui3_pc_next_prev_buttons
			, category: "Extra"
		}
		, {
			key: "ui3_pc_seek_buttons"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Playback Controls: Skip Buttons'
			, onChange: OnChange_ui3_pc_seek_buttons
			, category: "Extra"
		}
		, {
			key: "ui3_pc_seek_1frame_buttons"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Playback Controls: Skip 1 Frame Buttons'
			, onChange: OnChange_ui3_pc_seek_1frame_buttons
			, category: "Extra"
		}
		, {
			key: "ui3_extra_playback_controls_padding"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Playback Controls: Extra Padding'
			, onChange: OnChange_ui3_extra_playback_controls_padding
			, category: "Extra"
		}
		, {
			key: "ui3_extra_playback_controls_timestamp"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Playback Controls: Real Timestamp<br>When Streaming H.264'
			, hint: 'Adds a real-world timestamp to the playback controls, available only when streaming .bvr recordings with an H.264 streaming method.'
			, category: "Extra"
		}
		, {
			key: "ui3_extra_playback_controls_alwaysVisible"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Playback Controls: Always Visible'
			, category: "Extra"
		}
		, {
			key: "ui3_ir_brightness_contrast"
			, value: "0"
			, inputType: "checkbox"
			, label: 'PTZ: IR, Brightness, Contrast<br><a href="javascript:UIHelp.LearnMore(\'IR Brightness Contrast\')">(learn more)</a>'
			, onChange: OnChange_ui3_ir_brightness_contrast
			, category: "Extra"
		}
		, {
			key: "ui3_show_session_success"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Show Session Status at Startup'
			, hint: 'If enabled, session status is shown in the lower-right corner when the UI loads.'
			, category: "Extra"
		}
		, {
			key: "ui3_contextMenus_longPress"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Context Menu On Long-Press<br><a href="javascript:UIHelp.LearnMore(\'Context Menu On Long-Press\')">(learn more)</a>'
			, onChange: OnChange_ui3_contextMenus_longPress
			, category: "Extra"
		}
		, {
			key: "ui3_openFirstRecording"
			, value: "0"
			, inputType: "checkbox"
			, label: 'Automatically Open First Recording<div class="settingDesc">when loading Alerts or Clips tab</div>'
			, category: "Extra"
		}
		, {
			key: "ui3_system_name_button"
			, value: "About This UI"
			, inputType: "select"
			, options: []
			, getOptions: getSystemNameButtonOptions
			, label: 'System Name Button Action'
			, hint: 'This action occurs when you click the system name in the upper left.'
			, onChange: setSystemNameButtonState
			, category: "Extra"
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
	if (settings == null) // This null check allows local overrides to replace the settings object.
		settings = SetupStorageSniffing(GetLocalStorageWrapper());
	for (var i = 0; i < defaultSettings.length; i++)
	{
		if (settings.getItem(defaultSettings[i].key) == null
			|| defaultSettings[i].AlwaysReload
			|| IsNewGeneration(defaultSettings[i].key, defaultSettings[i].Generation))
			settings.setItem(defaultSettings[i].key, defaultSettings[i].value);
	}
}
function RevertSettingsToDefault()
{
	for (var i = 0; i < defaultSettings.length; i++)
		settings.setItem(defaultSettings[i].key, defaultSettings[i].value);
}
function GetLocalStorage()
{
	/// <summary>
	/// Returns the localStorage object, or a dummy localStorage object if the localStorage object is not available.
	/// This method should be used only when the wrapped localStorage object is not desired (e.g. when using settings that are persisted globally, not specific to a Blue Iris server).
	/// </summary>
	if (isLocalStorageEnabled())
		return localStorage;
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
	if (isLocalStorageEnabled())
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
	return GetDummyLocalStorage();
}
function GetRemoteServerLocalStorage()
{
	var serverNamePrefix = currentServer.remoteServerName.toLowerCase().replace(/ /g, '_') + "_";

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
	AttachDefaultSettingsProperties(wrappedStorage);
	return wrappedStorage;
}
var localStorageDummy = null;
function GetDummyLocalStorage()
{
	if (localStorageDummy === null)
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
function SetupStorageSniffing(storageObj)
{
	if (typeof Object.defineProperty === "function")
	{
		var isInvokingChangedEvent = {};
		var storageWrapper = new Object();
		storageWrapper.getItem = function (key)
		{
			return storageObj.getItem(key);
		};
		storageWrapper.setItem = function (key, value)
		{
			if (isInvokingChangedEvent[key])
				storageObj.setItem(key, value);
			else
			{
				var oldValue = storageObj.getItem(key);
				storageObj.setItem(key, value);
				isInvokingChangedEvent[key] = true;
				BI_CustomEvent.Invoke("SettingChanged", { key: key, value: value, oldValue: oldValue });
				isInvokingChangedEvent[key] = false;
			}
		};
		AttachDefaultSettingsProperties(storageWrapper);
		return storageWrapper;
	}
	else
	{
		console.log('The custom event "SettingChanged" requires Object.defineProperty which is not available.');
		return storageObj;
	}
}
function AttachDefaultSettingsProperties(storageWrapper)
{
	if (typeof Object.defineProperty !== "function")
		return;
	for (var i = 0; i < defaultSettings.length; i++)
	{
		var tmp = function (key)
		{
			Object.defineProperty(storageWrapper, key,
				{
					get: function ()
					{
						return storageWrapper.getItem(key);
					},
					set: function (value)
					{
						return storageWrapper.setItem(key, value);
					}
				});
		}(defaultSettings[i].key);
	}
}
///////////////////////////////////////////////////////////////
// UI Loading /////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
// Load svg before document.ready, to give it a head-start.
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
		loadingHelper.SetErrorStatus("svg", "Error trying to load icons.svg<br/>" + jqXHR.ErrorMessageHtml);
	}
});
$(function ()
{
	BI_CustomEvent.Invoke("UI_Loading_Start");

	$DialogDefaults.theme = "dark";

	if (location.protocol == "file:")
	{
		var fileSystemErrorMessage = "This interface must be loaded through the Blue Iris web server, and cannot function when loaded directly from your filesystem.";
		alert(fileSystemErrorMessage);
		toaster.Error(fileSystemErrorMessage, 60000);
		return;
	}

	if (!isLocalStorageEnabled())
	{
		toaster.Warning("Local Storage is disabled or unavailable in your browser. Settings will not be saved between sessions.", 10000);
	}

	$("#ui_version_label").text(ui_version);
	$("#bi_version_label").text(bi_version);

	HandlePreLoadUrlParameters();

	LoadDefaultSettings();

	biSoundPlayer.TestUserInputRequirement();

	currentPrimaryTab = ValidateTabName(settings.ui3_defaultTab);

	setSystemNameButtonState();

	ptzButtons = new PtzButtons();

	if (!h264_playback_supported)
		loadingHelper.SetLoadedStatus("h264"); // We aren't going to load the player, so clear the loading step.

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

		if (settings.ui3_openFirstRecording === "1")
			clipLoader.OpenFirstRecordingAfterNextClipListLoad();

		BI_CustomEvent.Invoke("TabLoaded_" + currentPrimaryTab);

		resized();
	});
	BI_CustomEvent.AddListener("TabLoaded_live", function () { videoPlayer.goLive(); });
	BI_CustomEvent.AddListener("TabLoaded_clips", function () { clipLoader.LoadClips("cliplist"); });
	BI_CustomEvent.AddListener("TabLoaded_alerts", function () { clipLoader.LoadClips("alertlist"); });

	clipboardHelper = new ClipboardHelper();

	uiSizeHelper = new UiSizeHelper();

	uiSettingsPanel = new UISettingsPanel();

	pcmPlayer = new PcmAudioPlayer();

	diskUsageGUI = new DiskUsageGUI();

	systemConfig = new SystemConfig();

	cameraListDialog = new CameraListDialog();

	clipProperties = new ClipProperties();

	clipDownloadDialog = new ClipDownloadDialog();

	statusBars = new StatusBars();
	statusBars.setLabel("volume", $("#pcVolume"));
	statusBars.addDragHandle("volume");
	statusBars.addOnProgressChangedListener("volume", function (newVolume)
	{
		newVolume = Clamp(parseFloat(newVolume), 0, 1);
		if (!pcmPlayer.SuppressAudioVolumeSave())
		{
			settings.ui3_audioMute = "0";
			settings.ui3_audioVolume = newVolume;
		}
		pcmPlayer.SetVolume(newVolume);
	});
	statusBars.addLabelClickHandler("volume", CameraAudioMuteToggle);
	pcmPlayer.SetAudioVolumeFromSettings();

	dropdownBoxes = new DropdownBoxes();

	leftBarBools = new LeftBarBooleans();

	cornerStatusIcons = new CornerStatusIcons();

	genericQualityHelper = new GenericQualityHelper();

	jpegQualityHelper = new JpegQualityHelper();

	streamingProfileUI = new StreamingProfileUI();

	SetupCollapsibleTriggers();

	exportControls = new ExportControls();

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

	cameraNameLabels = new CameraNameLabels();

	statusLoader = new StatusLoader();

	sessionManager = new SessionManager();

	cameraListLoader = new CameraListLoader();

	clipLoader = new ClipLoader("#clipsbody");

	clipThumbnailVideoPreview = new ClipThumbnailVideoPreview_BruteForce();

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

	OnChange_ui3_time24hour();
	OnChange_ui3_skipAmount();
	OnChange_ui3_pc_next_prev_buttons();
	OnChange_ui3_pc_seek_buttons();
	OnChange_ui3_pc_seek_1frame_buttons();
	OnChange_ui3_extra_playback_controls_padding();
	OnChange_ui3_ir_brightness_contrast();

	// This makes it impossible to text-select or drag certain UI elements.
	makeUnselectable($("#layouttop, #layoutleft, #layoutdivider, #layoutbody"));

	sessionManager.Initialize();

	$(window).resize(resized);
	$('.topbar_tab[name="' + currentPrimaryTab + '"]').click(); // this calls resized()

	BI_CustomEvent.Invoke("UI_Loading_End");
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
		if (collapsibleid && collapsibleid.length > 0 && settings.getItem("ui3_collapsible_" + collapsibleid) != "1")
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
						settings.setItem("ui3_collapsible_" + collapsibleid, vis ? "1" : "0");
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
	var maximize = UrlParameters.Get("maximize");
	if (maximize == "1" || maximize.toLowerCase() == "true")
		BI_Hotkey_MaximizeVideoArea();
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
	this.isHtml = false;
	this.autoSetLabelText = true;
	// End options
	this.GetTooltip = function ()
	{
		if (typeof self.tooltip == "function")
			return self.tooltip(self);
		else if (self.tooltip)
			return self.tooltip;
		else
			return "";
	}
	$.extend(this, options);
}
function DropdownBoxes()
{
	var self = this;
	var handleElements = {};
	var $dropdownBoxes = $(".dropdownBox,#btn_main_menu,.dropdownTrigger");
	var currentlyOpenList = null;
	var preventDDLClose = false;

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
					if (schedulesArray)
					{
						if (schedulesArray.length == 0)
						{
							console.log("Schedules array is empty. Opening login dialog because login responses provide the schedule list");
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
			items: [new DropdownListItem({ text: "Not Loaded!", uniqueId: "Not Loaded!" })]
			, onItemClick: function (item)
			{
				genericQualityHelper.QualityChoiceChanged(item.uniqueId);
			}
		});
	this.listDefs["mainMenu"] = new DropdownListDefinition("mainMenu",
		{
			selectedIndex: -1
			, items:
				[
					new DropdownListItem({ cmd: "ui_settings", text: "UI Settings", icon: "#svg_x5F_Settings", cssClass: "goldenLarger", tooltip: "User interface settings are stored in this browser and are not shared with other computers." })
					, new DropdownListItem({ cmd: "about_this_ui", text: "About This UI", icon: "#svg_x5F_About", cssClass: "goldenLarger" })
					, new DropdownListItem({ cmd: "streaming_profiles", text: "Streaming Profiles", icon: "#svg_mio_VideoFilter", cssClass: "goldenLarger" })
					, new DropdownListItem({ cmd: "system_log", text: "System Log", icon: "#svg_x5F_SystemLog", cssClass: "blueLarger" })
					, new DropdownListItem({ cmd: "user_list", text: "User List", icon: "#svg_x5F_User", cssClass: "blueLarger" })
					, new DropdownListItem({ cmd: "device_list", text: "Device List", icon: "#svg_mio_deviceInfo", cssClass: "blueLarger" })
					, new DropdownListItem({ cmd: "full_camera_list", text: "Full Camera List", icon: "#svg_x5F_FullCameraList", cssClass: "blueLarger" })
					, new DropdownListItem({ cmd: "disk_usage", text: "Disk Usage", icon: "#svg_x5F_Information", cssClass: "blueLarger" })
					, new DropdownListItem({ cmd: "system_configuration", text: "System Configuration", icon: "#svg_x5F_SystemConfiguration", cssClass: "blueLarger", tooltip: "Blue Iris Settings" })
					, new DropdownListItem({ cmd: "help", text: "Help", icon: "#svg_mio_help", cssClass: "goldenLarger" })
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
					case "streaming_profiles":
						streamingProfileUI.open();
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
					case "help":
						window.open("ui3/help/help.html#overview");
						break;
					case "logout":
						logout();
						break;
				}
			}
		});

	this.listDefs["ptzIR"] = new DropdownListDefinition("ptzIR",
		{
			items:
				[
					new DropdownListItem({ cmd: "off", text: "IR Off" })
					, new DropdownListItem({ cmd: "on", text: "IR On" })
					, new DropdownListItem({ cmd: "auto", text: "IR Auto" })
				]
			, onItemClick: function (item)
			{
				var loading = videoPlayer.Loading().image;
				if (loading.ptz && loading.isLive)
					switch (item.cmd)
					{
						case "off":
							ptzButtons.PTZ_unsafe_async_guarantee(loading.id, 34);
							ptzButtons.SetIRButtonState(0);
							break;
						case "on":
							ptzButtons.PTZ_unsafe_async_guarantee(loading.id, 35);
							ptzButtons.SetIRButtonState(1);
							break;
						case "auto":
							ptzButtons.PTZ_unsafe_async_guarantee(loading.id, 36);
							ptzButtons.SetIRButtonState(2);
							break;
					}
			}
		});
	this.listDefs["ptzBrightness"] = new DropdownListDefinition("ptzBrightness",
		{
			items: GetNumberedDropdownListItems("Brightness", 0, 15)
			, onItemClick: function (item)
			{
				var loading = videoPlayer.Loading().image;
				if (loading.ptz && loading.isLive)
				{
					var newBrightness = Clamp(parseInt(item.cmd), 0, 15);
					ptzButtons.PTZ_unsafe_async_guarantee(loading.id, 11 + newBrightness);
					ptzButtons.SetBrightnessButtonState(newBrightness);
				}
			}
		});
	this.listDefs["ptzContrast"] = new DropdownListDefinition("ptzContrast",
		{
			items: GetNumberedDropdownListItems("Contrast", 0, 6)
			, onItemClick: function (item)
			{
				var loading = videoPlayer.Loading().image;
				if (loading.ptz && loading.isLive)
				{
					var newContrast = Clamp(parseInt(item.cmd), 0, 6);
					ptzButtons.PTZ_unsafe_async_guarantee(loading.id, 27 + newContrast);
					ptzButtons.SetContrastButtonState(newContrast);
				}
			}
		});

	function GetNumberedDropdownListItems(name, min, max)
	{
		var items = [];
		for (var i = min; i <= max; i++)
			items.push(new DropdownListItem({ cmd: i.toString(), text: name + " " + i }));
		return items;
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
		else if ($ele.hasClass('dropdownTrigger'))
		{
			ele.$label = $ele.find('div.invisibleLabel');
		}
		else
		{
			ele.$label = $();
			ele.$arrow = $();
		}
		$ele.on('click', function ()
		{
			if ($ele.hasClass("disabled"))
				return;
			LoadDropdownList(name, $ele);
		});
		if (!handleElements[name])
			handleElements[name] = [];
		handleElements[name].push(ele);
	});
	this.setLabelText = function (name, labelText, isHtml)
	{
		var handleEles = handleElements[name];
		if (handleEles)
			for (var i = 0; i < handleEles.length; i++)
			{
				var ele = handleEles[i];
				if (ele)
				{
					if (isHtml)
						ele.$label.html(labelText);
					else
						ele.$label.text(labelText);
				}
			}
	};
	this.getLabelText = function (name, isHtml)
	{
		var handleEles = handleElements[name];
		if (handleEles)
			for (var i = 0; i < handleEles.length; i++)
			{
				var ele = handleEles[i];
				if (ele)
				{
					if (isHtml)
						return ele.$label.html();
					else
						return ele.$label.text();
				}
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
		preventDDLClose = true;
		setTimeout(allowDDLClose, 0);
		self.Resized();

		var $selectedItem = $ddl.children('.selected');
		if ($selectedItem.length > 0)
		{
			// Determine ideal scroll position
			var eleCenter = $selectedItem.position().top + $selectedItem.outerHeight(true) / 2;
			var visibleHeight = $ddl.innerHeight();
			var idealScrollTop = eleCenter - (visibleHeight / 2);
			if (idealScrollTop > 0)
				$ddl.scrollTop(idealScrollTop);
		}
	}
	var AddDropdownListItem = function ($ddl, listDef, i, selectedText)
	{
		var item = listDef.items[i];
		var $item = $("<div></div>");
		if (item.isHtml)
			$item.html(item.text);
		else
			$item.text(item.text);
		if (selectedText == item.text)
			$item.addClass("selected");
		if (item.cssClass)
			$item.addClass(item.cssClass);
		$item.click(function ()
		{
			if (listDef.items[i].autoSetLabelText)
				self.setLabelText(listDef.name, item.text, item.isHtml);
			listDef.selectedIndex = i;
			listDef.onItemClick && listDef.onItemClick(listDef.items[i]); // run if not null
			closeDropdownLists();
		});
		if (item.icon)
			$item.prepend('<div class="mainMenuIcon"><svg class="icon' + (item.icon.indexOf('_x5F_') == -1 ? " noflip" : "") + '"><use xlink:href="' + item.icon + '"></use></svg></div>');
		var tooltip = item.GetTooltip();
		if (tooltip)
			$item.attr('title', tooltip);
		$ddl.append($item);
	}
	$(document).mouseup(function (e)
	{
		if (!preventDDLClose)
			closeDropdownLists();
	});
	$(document).mouseleave(function (e)
	{
		if (!preventDDLClose)
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
	var allowDDLClose = function ()
	{
		/// <summary>This exists to prevent a glitch where dropdown lists close immediately in Edge when using a touchscreen, giving the appearance that the dropdown lists never even open.</summary>
		preventDDLClose = false;
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
function GetTooltipForStreamQuality(index)
{
	var arr = sessionManager.GetStreamsArray();
	if (arr && arr.length > 0 && index > -1 && index < arr.length)
		return arr[index];
	return "";
}
///////////////////////////////////////////////////////////////
// System Name Button /////////////////////////////////////////
///////////////////////////////////////////////////////////////
var systemNameButton;
function getSystemNameButtonOptions()
{
	var mmItems = dropdownBoxes.listDefs["mainMenu"].items;
	var opts = new Array();
	for (var i = 0; i < mmItems.length; i++)
		opts.push(mmItems[i].text);
	opts.push("Do Nothing");
	return opts;
}
function systemNameButtonClick()
{
	var mmItems = dropdownBoxes.listDefs["mainMenu"].items;
	for (var i = 0; i < mmItems.length; i++)
		if (settings.ui3_system_name_button == mmItems[i].text)
		{
			dropdownBoxes.listDefs["mainMenu"].onItemClick(mmItems[i]);
			return;
		}
}
function setSystemNameButtonState()
{
	if (settings.ui3_system_name_button == "Do Nothing")
		$("#systemnamewrapper").removeClass("hot");
	else
		$("#systemnamewrapper").addClass("hot");
}
///////////////////////////////////////////////////////////////
// Left Bar Boolean Options ///////////////////////////////////
///////////////////////////////////////////////////////////////
function LeftBarBooleans()
{
	var $items = $('#layoutleft .leftBarBool');
	$items.each(function (idx, ele)
	{
		var $ele = $(ele);
		var name = $ele.attr("name");
		switch (name)
		{
			case "flaggedOnly":
				{
					var $cb = $('<input type="checkbox" />');
					if (settings.ui3_recordings_flagged_only == "1")
						$cb.prop('checked', 'checked');
					$cb.on('change', function ()
					{
						settings.ui3_recordings_flagged_only = $cb.is(':checked') ? "1" : "0";
						clipLoader.LoadClips();
					});
					var $label = $('<label></label>');
					$label.append('<div class="smallFlagIcon"><svg class="icon"><use xlink:href="#svg_x5F_Flag"></use></svg></div>');
					$label.append($cb);
					$label.append($ele.html());
					$ele.empty();
					$ele.append($label);
				}
				break;
		}
	});
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
	var $ptzPresets = $("#ptzPresetsContent .ptzpreset");
	var $ptzButtons = $("#ptzButtonsMain");
	var $ptzControlsContainers = $("#ptzPresetsContent,#ptzButtonsMain");
	var $ptzExtraDropdowns = $("#ptzIrBrightnessContrast .dropdownTrigger");
	var $irButtonText = $("#irButtonText");
	var $irButtonLabel = $("#irButtonLabel");
	var $brightnessButtonLabel = $("#brightnessButtonLabel");
	var $contrastButtonLabel = $("#contrastButtonLabel");

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
	// Hide long-press square that appears when using ptz controls on Windows touchscreen devices.  Unfortunately, it can only be hidden in IE and Edge.
	$ptzGraphicWrapper.get(0).addEventListener("MSHoldVisual", function (e) { e.preventDefault(); }, false);
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
			$ptzExtraDropdowns.removeClass("disabled");
			$ptzBackgroundGraphics.css("color", $ptzBackgroundGraphics.get(0).defaultColor);
		}
		else
		{
			$ptzControlsContainers.attr("title", featureEnabled ? "PTZ not available for current camera" : "PTZ disabled by user preference");
			$ptzPresets.addClass("disabled");
			$ptzButtons.addClass("disabled");
			$ptzExtraDropdowns.addClass("disabled");
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
			openLoginDialog(function () { self.PresetSet(presetNumStr); });
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
			bigThumbHelper.Hide();
			self.PTZ_goto_preset(ele.presetnum);
		});
		if (settings.ui3_contextMenus_longPress != "1")
			$ele.longpress(function (e) { self.PresetSet($ele.attr("presetnum")); });
		$ele.on("mouseenter touchstart", function (e)
		{
			if (!ptzControlsEnabled)
				return;

			// Show big preset thumbnail
			var imgData = ptzPresetThumbLoader.GetImgData(videoPlayer.Loading().image.id, ele.presetnum);
			var imgUrl = null;
			var imgW = 0;
			var imgH = 0;
			if (imgData && !imgData.error)
			{
				if (imgData.loaded)
					imgUrl = imgData.imgEle;
				else
					imgUrl = imgData.src;
				imgW = imgData.w;
				imgH = imgData.h;
			}
			bigThumbHelper.Show($ele, $ele.parent(), self.GetPresetDescription(ele.presetnum), imgUrl, imgW, imgH);
		});
		$ele.on("mouseleave touchend touchcancel", function (e)
		{
			bigThumbHelper.Hide();
		});
	});
	$(document).on('touchend touchcancel', function (e)
	{
		bigThumbHelper.Hide();
	});
	// Presets //
	var LoadPtzPresetThumbs = function ()
	{
		var loading = videoPlayer.Loading().image;
		if (loading.ptz && GetUi3FeatureEnabled("ptzControls"))
		{
			ptzPresetThumbLoader.NotifyPtzCameraSelected(loading.id);
			LoadPTZPresetDescriptions(loading.id);
		}
		else
		{
			$ptzPresets.each(function (idx, ele)
			{
				$(ele).text(ele.presetnum);
			});
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

		// Wait a moment in case Blue Iris needs time to save the updated preset image.
		setTimeout(function ()
		{
			ptzPresetThumbLoader.ReloadPresetImage(cameraId, presetNumber);
		}, 50);
	}
	var LoadPTZPresetDescriptions = function (cameraId)
	{
		if (currentPtzData && currentPtzData.cameraId == cameraId)
			return;
		ExecJSON({ cmd: "ptz", camera: cameraId }, function (response)
		{
			if (videoPlayer.Loading().image.id == cameraId)
			{
				/*
					brightness:-1
					contrast:0
					irmode:0
					powermode:-1
					presetnum:15
					presets:[""]
					talksamplerate:8000
				*/
				currentPtzData = response.data;
				currentPtzData.cameraId = cameraId;
				self.SetIRButtonState();
				self.SetBrightnessButtonState();
				self.SetContrastButtonState();
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
		var args = { cmd: "ptz", camera: cameraId, button: parseInt(ptzCmd) };
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
		var args = { cmd: "ptz", camera: cameraId, button: parseInt(ptzCmd) };
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
	this.Get$PtzPresets = function ()
	{
		return $ptzPresets;
	}
	this.SetIRButtonState = function (irmode)
	{
		if (typeof irmode != "undefined")
			currentPtzData.irmode = irmode;

		if (currentPtzData.irmode == 1)
		{
			$irButtonText.text("*").parent().addClass("yellow");
			$irButtonLabel.text("IR On");
		}
		else if (currentPtzData.irmode == 2)
		{
			$irButtonText.text("A").parent().removeClass("yellow");
			$irButtonLabel.text("IR Auto");
		}
		else // if (currentPtzData.irmode == 0)
		{
			$irButtonText.text("").parent().removeClass("yellow");
			$irButtonLabel.text("IR Off");
		}
	}
	this.SetBrightnessButtonState = function (brightness)
	{
		if (typeof brightness != "undefined")
			currentPtzData.brightness = brightness;
		$brightnessButtonLabel.text("Brightness " + currentPtzData.brightness);
	}
	this.SetContrastButtonState = function (contrast)
	{
		if (typeof contrast != "undefined")
			currentPtzData.contrast = contrast;
		$contrastButtonLabel.text("Contrast " + currentPtzData.contrast);
	}
}
///////////////////////////////////////////////////////////////
// PtzPresetThumbLoader ///////////////////////////////////////
///////////////////////////////////////////////////////////////
var ptzPresetThumbLoader = new (function ()
{
	var self = this;
	// A two-level cache.  The first level is a map of camera names.  The second level is a map of preset numbers to image elements.
	var cache = {};
	var asyncThumbLoader = null;

	var Initialize = function ()
	{
		if (asyncThumbLoader)
			return;
		asyncThumbLoader = new AsyncPresetThumbnailDownloader(thumbLoaded, thumbError);
	}
	this.NotifyPtzCameraSelected = function (cameraId)
	{
		/// <summary>Call this when a PTZ camera is selected so the thumbnails can begin loading (unless they are already cached).</summary>
		if (!CameraIsEligible(cameraId))
			return;

		var camCache = cache[cameraId];
		if (!camCache)
		{
			camCache = cache[cameraId] = {}; // Note: cache and camCache are maps, not arrays.
			for (var i = 1; i <= 20; i++)
			{
				var $img = $('<img src="" alt="' + i + '" class="presetThumb" />');
				$img.hide();
				var img = camCache[i] = $img[0];
				// Unfortunately, we can't allow the browser cache to be used for these, or the cached images become stale when updated and reloading the page doesn't fix it.
				img.imgData = {
					src: UrlForPreset(cameraId, i, true),
					w: 0,
					h: 0,
					imgEle: img
				};
				asyncThumbLoader.Enqueue(img, img.imgData.src);
			}
		}
		ptzButtons.Get$PtzPresets().each(function (idx, ele)
		{
			var $ele = $(ele).empty();
			var img = camCache[ele.presetnum];
			if (img.imgData.w == 0)
				$ele.append('<span>' + ele.presetnum + '</span>')
			$ele.append(img);
		});
	}
	this.ReloadPresetImage = function (cameraId, presetNumber)
	{
		/// <summary>Force-reloads a preset image from the server.</summary>
		if (currentServer.isLoggingOut)
			return false;

		if (presetNumber < 1 || presetNumber > 20)
			return;
		var camCache = cache[cameraId];
		if (camCache)
		{
			var img = camCache[presetNumber];
			img.imgData.src = UrlForPreset(cameraId, presetNumber, true);
			asyncThumbLoader.Enqueue(img, img.imgData.src);
		}
		else
			self.NotifyPtzCameraSelected(cameraId); // This case shouldn't happen.
	}
	this.GetImgData = function (cameraId, presetNumber)
	{
		if (presetNumber >= 1 && presetNumber <= 20)
		{
			var camCache = cache[cameraId];
			if (camCache)
				return camCache[presetNumber].imgData;
		}
		return null;
	}
	var thumbLoaded = function (img)
	{
		if (img.complete && typeof img.naturalWidth != "undefined" && img.naturalWidth > 0)
		{
			img.imgData.error = false;
			img.imgData.w = img.naturalWidth
			img.imgData.h = img.naturalHeight;
			img.imgData.loaded = true;
			var $img = $(img);
			$img.prev('span').remove();
			$img.show();
			try
			{
				var remainder = img.getBoundingClientRect().height % 1;
				if (remainder != 0)
					$thumb.css("padding-bottom", (1 - remainder) + "px");
			}
			catch (ex) { }
		}
		else
			img.imgData.error = true;
	}
	var thumbError = function (img)
	{
		img.imgData.error = true;
	}
	var UrlForPreset = function (cameraId, presetNumber, overrideCache)
	{
		if (presetNumber < 1 || presetNumber > 20)
			return "";
		var sessionArg = currentServer.GetRemoteSessionArg("?");
		var cacheArg = overrideCache ? ((sessionArg ? "&" : "?") + "cache=" + Date.now()) : "";
		return currentServer.remoteBaseURL + "image/" + cameraId + "/preset_" + presetNumber + ".jpg" + sessionArg + cacheArg;
	}
	var CameraIsEligible = function (cameraId)
	{
		if (currentServer.isLoggingOut)
			return false;
		var loading = videoPlayer.Loading().image;
		if (cameraId != loading.id)
			return false;
		if (!loading.ptz)
			return false;
		if (!GetUi3FeatureEnabled("ptzControls"))
			return false;
		Initialize();
		return true;
	}
})();
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
	var mayClose = true;
	var isVisible = false;

	$("#dateRange").add($datePickerDialog).on('mousedown mouseup touchstart touchend touchcancel', function (e)
	{
		if (e.currentTarget.id == "dateRange" && e.button == 2)
			return; // Right click here doesn't prevent close.
		mayClose = false;
		setTimeout(function () { mayClose = true; }, 0);
	});
	$(document).on('mousedown mouseup touchstart touchend touchcancel', function (e)
	{
		if (mayClose && isVisible)
			self.CloseDatePicker();
	});

	this.OpenDatePicker = function (ele)
	{
		if (isVisible)
			self.CloseDatePicker();
		else if (performance.now() - 33 > timeClosed)
		{
			var $ele = $(ele);
			var offset = $ele.offset();
			$datePickerDialog.css("left", offset.left + $ele.outerWidth(true) + "px");
			$datePickerDialog.css("top", offset.top + "px");
			$datePickerDialog.show();
			isVisible = true;
		}
	};
	this.CloseDatePicker = function (ele)
	{
		if (isVisible)
		{
			isVisible = false;
			$datePickerDialog.hide();
			timeClosed = performance.now();
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

	var pcFrameTimestampVisible = false;
	var $playbackFrameTimestamp = $('#playbackFrameTimestamp');

	if (!audio_playback_supported)
		$("#volumeBar").addClass("permanentlyUnavailable");

	this.resized = function ()
	{
		var paddingSize = $pc.innerWidth() - $pc.width();
		var width = $pc.parent().width() - paddingSize;
		$pc.css("width", width + "px");

		if (width > 475)
			$("#volumeBar").addClass("wide");
		else
			$("#volumeBar").removeClass("wide");

		seekBar.resized();
		exportControls.resized();
	}
	this.SetProgressText = function (text)
	{
		$progressText.text(text);
	}
	this.IsVisible = function ()
	{
		return isVisible;
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
			$("#pcButtonContainer .hideWhenLive").addClass('temporarilyUnavailable');
		}
		else
		{
			playbackHeader.Show();
			$("#seekBarWrapper").show();
			$("#pcButtonContainer .hideWhenLive").removeClass('temporarilyUnavailable');
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
			if (self.IsSeekbarDragging() || exportControls.IsEnabled() || settings.ui3_extra_playback_controls_alwaysVisible === "1")
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
	var hideAfterTimeout = function ()
	{
		clearHideTimout();
		hideTimeout = setTimeout(function () { self.FadeOut(); }, videoPlayer.Loading().image.isLive ? self.hideTimeMs_Live : self.hideTimeMs_Recordings);
	}
	this.Live = function ()
	{
		self.Show();
		hideAfterTimeout();
		$pc.addClass("live");
		self.SetProgressText("Loading...");
		self.setPlayPauseButtonState();
	}
	this.Recording = function (clipData)
	{
		self.Show();
		hideAfterTimeout();
		$pc.removeClass("live");
		self.SetProgressText("Loading...");
		self.setPlayPauseButtonState();
		SetDownloadClipLink(clipData);
	}
	this.IsSeekbarDragging = function ()
	{
		return seekBar.IsDragging() || exportControls.IsDragging();
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
	var SetDownloadClipLink = function (clipData)
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
		if (pointInsideElement($layoutbody, e.pageX, e.pageY))
			return;
		CloseSettings();
		clearHideTimout();
		self.FadeOut();
	});
	$layoutbody.on("mouseenter mousemove mousedown mouseup touchstart touchmove touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		var wasHidden = !isVisible;
		self.FadeIn();
		clearHideTimout();
		if (!pointInsideElement($pc, e.pageX, e.pageY)
			&& !pointInsideElement($playbackSettings, e.pageX, e.pageY)
			&& !pointInsideElement(playbackHeader.Get$Ref(), e.pageX, e.pageY))
			hideAfterTimeout();
		else
		{
			if (wasHidden && (e.type == "mousedown" || e.type == "touchstart"))
			{
				// Playback controls were invisible before this event.  This code prevents the event from triggering playback button actions.
				// stopImmediatePropagation (instead of stopPropagation) would prevent it from reaching MouseEventHelper too.
				// On one hand, this might be more intuitive (maybe the touch was meant to reveal those controls).
				// On the other hand, maybe the touch was meant to affect the video view.  There is no perfect solution.
				e.stopPropagation();
				e.preventDefault();
			}
		}
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
			+ '<input id="cbAutoplay" type="checkbox" class="sliderCb" onclick="playbackControls.AutoplayClicked()" '
			+ (autoplay ? ' checked="checked"' : '')
			+ '/>'
			+ '<label for="cbAutoplay"><span class="ui"></span>Autoplay<div class="playbackSettingsSpacer"></div></label>'
			+ '</div>');
		$playbackSettings.append('<div class="playbackSettingsCheckboxWrapper">'
			+ '<input id="cbReverse" type="checkbox" class="sliderCb" onclick="playbackControls.ReverseClicked()" '
			+ (playReverse ? ' checked="checked"' : '')
			+ '/>'
			+ '<label for="cbReverse"><span class="ui"></span>Reverse<div class="playbackSettingsSpacer"></div></label>'
			+ '</div>');
		$playbackSettings.append('<div class="playbackSettingsCheckboxWrapper">'
			+ '<input id="cbLoop" type="checkbox" class="sliderCb" onclick="playbackControls.LoopClicked()" '
			+ (loopingEnabled ? ' checked="checked"' : '')
			+ '/>'
			+ '<label for="cbLoop"><span class="ui"></span>Loop<div class="playbackSettingsSpacer"></div></label>'
			+ '</div>');
		var $speedBtn = $('<div class="playbackSettingsLine speedBtn">'
			+ 'Speed<div class="playbackSettingsFloatRight">'
			+ (playSpeed == 1 ? "Normal" : playSpeed)
			+ '<div class="playbackSettingsRightArrow"><svg class="icon"><use xlink:href="#svg_x5F_PTZcardinalRight"></use></svg></div>'
			+ '</div></div>');
		$speedBtn.click(self.OpenSpeedPanel);
		$playbackSettings.append($speedBtn);
		var $qualityBtn = $('<div class="playbackSettingsLine">'
			+ 'Quality<div class="playbackSettingsFloatRight">'
			+ htmlEncode(genericQualityHelper.GetCurrentProfile().GetNameText())
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
			+ 'Quality</div>');
		if (!live)
			$backBtn.click(self.OpenSettingsPanel);
		else
			$backBtn.css('cursor', 'default');

		var $editBtn = $('<div class="playbackSettingsEditProfiles" title="Edit Streaming Profiles"><svg class="icon noflip"><use xlink:href="#svg_mio_edit"></use></svg></div>');
		$editBtn.on('click', function (e)
		{
			streamingProfileUI.open();
			CloseSettings();
			return false;
		});
		$backBtn.append($editBtn);

		$playbackSettings.append($backBtn);

		var currentProfile = genericQualityHelper.GetCurrentProfile();
		var $selectedItem = $();
		for (var i = 0; i < genericQualityHelper.profiles.length; i++)
		{
			var p = genericQualityHelper.profiles[i];
			if (!p.IsCompatible())
				continue;
			var $item = $('<div class="playbackSettingsLine alignRight"></div>');
			var name = $item.get(0).qualityName = p.name;
			$item.append(p.GetNameEle());
			var tooltip = p.GetTooltipText();
			if (tooltip)
				$item.attr('title', tooltip);
			if (name === currentProfile.name)
				$selectedItem = $item.addClass("selected");
			$item.click(function ()
			{
				genericQualityHelper.QualityChoiceChanged(this.qualityName);
				SetQualityHint();
				CloseSettings();
			});
			$playbackSettings.append($item);
		}

		$layoutbody.append($playbackSettings);

		if ($selectedItem.length > 0)
		{
			// Determine ideal scroll position
			var eleCenter = $selectedItem.position().top + $selectedItem.outerHeight(true) / 2;
			var visibleHeight = $playbackSettings.innerHeight();
			var idealScrollTop = eleCenter - (visibleHeight / 2);
			if (idealScrollTop > 0)
				$playbackSettings.scrollTop(idealScrollTop);
		}
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
		self.FadeIn();
		hideAfterTimeout();
		autoplay = $("#cbAutoplay").is(":checked");
		settings.ui3_playback_autoplay = autoplay ? "1" : "0";
	}
	this.ReverseClicked = function ()
	{
		self.FadeIn();
		hideAfterTimeout();
		playReverse = $("#cbReverse").is(":checked");
		settings.ui3_playback_reverse = playReverse ? "1" : "0";
		videoPlayer.PlaybackDirectionChanged(playReverse);
	}
	this.ToggleReverse = function ()
	{
		self.FadeIn();
		hideAfterTimeout();
		if ($("#cbReverse").length > 0)
		{
			if ($("#cbReverse").is(":checked"))
				$("#cbReverse").removeProp("checked");
			else
				$("#cbReverse").prop("checked", "checked");
		}
		playReverse = !playReverse;
		settings.ui3_playback_reverse = playReverse ? "1" : "0";
		videoPlayer.PlaybackDirectionChanged(playReverse);
	}
	this.LoopClicked = function ()
	{
		self.FadeIn();
		hideAfterTimeout();
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
	this.ChangePlaySpeed = function (offset)
	{
		for (var i = 0; i < SpeedOptions.length; i++)
			if (SpeedOptions[i] == playSpeed)
			{
				i += offset;
				if (i >= 0 && i < SpeedOptions.length)
				{
					settings.ui3_playback_speed = playSpeed = SpeedOptions[i];
					videoPlayer.PlaybackSpeedChanged(playSpeed);
					self.FadeIn();
					hideAfterTimeout();
					NotifySpeedChanged();
				}
				return;
			}
	}
	this.FrameTimestampUpdated = function (utc)
	{
		if (utc && settings.ui3_extra_playback_controls_timestamp === "1")
		{
			var dateStr = GetDateStr(GetServerDate(new Date(utc)));
			$playbackFrameTimestamp.text(dateStr);
			if (!pcFrameTimestampVisible)
			{
				$playbackFrameTimestamp.show();
				pcFrameTimestampVisible = true;
			}
		}
		else if (pcFrameTimestampVisible)
		{
			$playbackFrameTimestamp.hide();
			pcFrameTimestampVisible = false;
		}
	}
	var NotifySpeedChanged = function ()
	{
		/// <summary>Updates several GUI elements with the new playSpeed value.</summary>
		SetPlaySpeedLabel();
		if ($playbackSettings && $playbackSettings.length > 0)
		{
			if ($playbackSettings.hasClass("speedPanel"))
				self.OpenSpeedPanel();
			else
				$playbackSettings.find("div.speedBtn .playbackSettingsFloatRight").html((playSpeed == 1 ? "Normal" : playSpeed));
		}
	}
	var SetQualityHint = function ()
	{
		var p = genericQualityHelper.GetCurrentProfile();
		if (p.abbr)
		{
			var aClr = p.GetAbbrColor();
			var bgColor = "#" + aClr;
			var fgColor = "#" + GetReadableTextColorHexForBackgroundColorHex(aClr, "000000", "FFFFFF");
			$("#playbackSettingsQualityMark").css("background-color", bgColor).css("color", fgColor).text(p.abbr.substr(0, 4)).show();
		}
		else
			$("#playbackSettingsQualityMark").hide();
	}
	$(document).on("mousemove touchmove", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (!exportControls.mouseMove(e))
			seekBar.mouseMove(e, true);
	});
	$(document).on("mouseup mouseleave touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (!exportControls.mouseUp(e))
			seekBar.mouseUp(e);
	});
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
	this.Get$Ref = function ()
	{
		return $ph;
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
	var seekhint_img_ele = seekhint_img.get(0);
	var seekhint_canvas_ele = seekhint_canvas.get(0);
	var seekhint_loading = $("#seekhint_loading");
	var seekhint_helper = $("#seekhint_helper");
	var seekhint_label = $("#seekhint_label");
	var highlight = $("#seekBarHighlight");
	var seekHintVisible = false;
	var isDragging = false;
	var isTouchDragging = false;
	var didPauseOnDrag = false;
	var mouseDidActuallyDrag = false; // This is set only for the duration of the mousedown handler which causes playback pausing for dragging.  Helps work around a bug where a seek hint image is loaded simply due to a single click on the seek bar while a clip is playing.
	var seekHintInfo = { canvasVisible: false, helperVisible: false, visibleMsec: -1, queuedMsec: -1, loadingMsec: -1, lastSnapshotId: "" }

	seekhint_img.load(function ()
	{
		if (isDragging)
		{
			jpegPreviewModule.RenderImage(seekhint_img_ele);
			var msecTotal = videoPlayer.Loading().image.msec;
			playbackControls.SetProgressText(msToTime(seekHintInfo.loadingMsec, 0) + " / " + msToTime(msecTotal, 0));
		}
		CopyImageToCanvas(seekhint_img_ele, seekhint_canvas_ele);
		seekhint_loading.addClass('hidden');
		seekHintInfo.loading = false;
		seekHintInfo.visibleMsec = seekHintInfo.loadingMsec;
		if (seekHintInfo.queuedMsec != -1)
			loadSeekHintImg(seekHintInfo.queuedMsec);
	});
	seekhint_img.error(function ()
	{
		ClearCanvas(seekhint_canvas_ele);
		seekhint_loading.addClass('hidden');
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
				seekhint_loading.addClass('hidden');
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
		if (videoPlayer.Playback_IsPaused() && mouseDidActuallyDrag)
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
			var largestDimensionKey;
			var largestDimensionValue;
			var hintW;
			var hintH;
			var loadingImg = videoPlayer.Loading().image;
			if (loadingImg.aspectratio >= 1)
			{
				largestDimensionKey = "w";
				largestDimensionValue = imageRenderer.GetSizeToRequest(false).w;
				hintW = 160;
				hintH = (hintW / videoPlayer.Loading().image.aspectratio);
			}
			else
			{
				largestDimensionKey = "h";
				largestDimensionValue = imageRenderer.GetSizeToRequest(false).h;
				hintH = 160;
				hintW = (hintH * videoPlayer.Loading().image.aspectratio);
			}
			var hintMarginLeft = Clamp((160 - hintW) / 2, 0, 160);
			seekhint_canvas.css("margin-left", hintMarginLeft + "px").css('width', hintW + 'px').css('height', hintH + 'px');
			seekhint_loading.css("margin-left", hintMarginLeft + "px").css('width', hintW + 'px').css('height', hintH + 'px');
			if (seekHintInfo.canvasVisible)
			{
				var loadSize = Math.min(hintW, hintH);
				$("#seekhint_loading_anim").css('width', loadSize + 'px').css('height', loadSize + 'px')
				seekhint_loading.removeClass('hidden');
			}
			var qualityArgs;
			if (isDragging)
			{
				videoOverlayHelper.ShowLoadingOverlay(true, true);

				qualityArgs = genericQualityHelper.getSeekPreviewQualityArgs(largestDimensionKey, largestDimensionValue);
			}
			else
				qualityArgs = "&" + largestDimensionKey + "=160&q=50"
			seekhint_img.attr('src', videoPlayer.GetLastSnapshotUrl().replace(/time=\d+/, "time=" + msec) + qualityArgs);
		}
	}
	this.resetSeekHintImg = function ()
	{
		seekHintInfo.loadingMsec = seekHintInfo.queuedMsec = seekHintInfo.visibleMsec = -1;
		seekhint_canvas.css('height', (160 / videoPlayer.Loading().image.aspectratio) + 'px');
		ClearCanvas(seekhint_canvas_ele);
		seekhint_loading.addClass('hidden');
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
	this.getWidth = function ()
	{
		return bar.width();
	}
	this.getOffset = function ()
	{
		return bar.offset();
	}
	var SetBarState = function (state)
	{
		if (state == 1)
		{
			bar.addClass("focus");
			if (!exportControls.IsDragging())
			{
				handle.addClass("focus");
				seekhint.removeClass('hidden');
			}
			seekHintVisible = true;
		}
		else
		{
			handle.removeClass("focus");
			bar.removeClass("focus");
			seekhint.addClass('hidden');
			seekHintVisible = false;
			highlight.css("width", "0px");
		}
	}
	this.mouseUp = function (e)
	{
		if (!isDragging)
			return;

		self.mouseMove(e, true);

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
	this.mouseMove = function (e, isRealMoveEvent)
	{
		mouseDidActuallyDrag = isRealMoveEvent;
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
	this.mouseDown = function (e)
	{
		mouseDidActuallyDrag = false;
		if (e.which != 3)
		{
			isDragging = true;
			didPauseOnDrag = !videoPlayer.Playback_IsPaused();
			videoPlayer.Playback_Pause();
			isTouchDragging = touchEvents.isTouchEvent(e);

			videoOverlayHelper.ShowLoadingOverlay();

			SetBarState(1);

			self.mouseMove(e);
			$.hideAllContextMenus();
			return stopDefault(e);
		}
		else
			self.mouseMove(e);
	}
	wrapper.on("mousedown touchstart", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		return self.mouseDown(e);
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
// Clip Export Controls ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function ExportControls()
{
	var self = this;
	var $layoutBottom = $('#layoutbottom');
	var $exportOffsetWrapper = $("#exportOffsetWrapper");
	var $exportControlsWrapper = $("#exportControlsWrapper");
	var $exportControlsAudioButton = $("#exportControlsAudioButton");
	var $audioDisabled = $exportControlsAudioButton.children(".audioDisabled");
	var $audioEnabled = $exportControlsAudioButton.children(".audioEnabled");
	var exportOffsetStart;
	var exportOffsetEnd;
	var $exportControlsStatus = $("#exportControlsStatus");
	var $exportControlsExportBtn = $("#exportControlsExportBtn");
	var $exportControlsCancelBtn = $("#exportControlsCancelBtn");

	var clipData = null;
	var fileDuration = 2;
	var fileSizeBytes = 2;

	var controlsEnabled = false;
	var clipStatsLoaded = false;

	var Initialize = function ()
	{
		$exportOffsetWrapper.hide();
		$exportControlsWrapper.hide();
		exportOffsetStart = new ExportOffsetControl($("#exportOffsetStart"), 0.75, offsetChanged);
		exportOffsetEnd = new ExportOffsetControl($("#exportOffsetEnd"), 0.25, offsetChanged);
		BI_CustomEvent.AddListener("OpenVideo", CheckCurrentClip);
		$exportControlsExportBtn.on('click', beginExport);
		$exportControlsCancelBtn.on('click', self.Disable);
		$exportControlsAudioButton.on('click', ToggleAudioButtonState);
		SetAudioButtonState();
	}
	var ToggleAudioButtonState = function ()
	{
		settings.ui3_clip_export_withAudio = settings.ui3_clip_export_withAudio === "1" ? "0" : "1";
		SetAudioButtonState();
	}
	var SetAudioButtonState = function ()
	{
		var not = "";
		if (settings.ui3_clip_export_withAudio === "1")
		{
			$exportControlsAudioButton.attr("title", "Audio will be included in the export, if available.");
			$audioDisabled.hide();
			$audioEnabled.show();
		}
		else
		{
			$exportControlsAudioButton.attr("title", "Audio will NOT be included in the export.");
			$audioDisabled.show();
			$audioEnabled.hide();
		}
	}
	this.resized = function ()
	{
		if (!controlsEnabled)
			return;
		var w = $layoutBottom.width();

		exportOffsetStart.resized();
		exportOffsetEnd.resized();

		var labelFontSize = Clamp(w * 0.04, 11, 18);
		$exportControlsStatus.css('font-size', labelFontSize + 'px');
		$exportControlsStatus.css('line-height', labelFontSize + 'px');

		offsetChanged();
	}
	this.IsDragging = function ()
	{
		return exportOffsetStart.IsDragging() || exportOffsetEnd.IsDragging();
	}
	this.IsEnabled = function ()
	{
		return controlsEnabled;
	}
	this.mouseMove = function (e)
	{
		var r1 = exportOffsetStart.mouseMove(e);
		var r2 = exportOffsetEnd.mouseMove(e);
		return r1 || r2;
	}
	this.mouseUp = function (e)
	{
		var r1 = exportOffsetStart.mouseUp(e);
		var r2 = exportOffsetEnd.mouseUp(e);
		return r1 || r2;
	}
	this.Enable = function (recId)
	{
		if (!exporting_clips_to_avi_supported)
		{
			toaster.Warning("This browser does not support the necessary features to export clips to AVI.", 15000);
			return;
		}
		if (controlsEnabled)
			return;
		controlsEnabled = true;

		clipData = clipLoader.GetClipFromId(recId);

		if (!videoPlayer.Playback_IsPaused())
			videoPlayer.Playback_Pause();

		$exportControlsWrapper.show();

		if (clipData.isClip)
			ClipStatsLoaded();
		else
		{
			// We've probably already loaded the clip duration for this alert because that happens when starting to stream it.
			if (clipData.hasLoadedClipStats)
				ClipStatsLoaded(); // We have
			else // We have not, so our clip duration and size values need updated.
			{
				$exportControlsStatus.text('Loading…');
				$exportControlsExportBtn.attr('disabled', 'disabled');
				// call global resized
				resized();
				clipStatsLoader.LoadClipStats("@" + clipData.clipId, function (stats)
				{
					// This success callback can be called more than once. clipStatsLoaded will tell.
					if (clipStatsLoaded || !controlsEnabled)
						return;
					clipLoader.ApplyMissingStatsToClipData(stats, clipData);
					ClipStatsLoaded();
				});
			}
		}
	}
	var ClipStatsLoaded = function ()
	{
		if (!controlsEnabled)
			return;
		clipStatsLoaded = true;

		fileDuration = Math.max(clipData.msec, 2);
		fileSizeBytes = getBytesFromBISizeStr(clipData.fileSize);

		var startTime = 0;
		var endTime = 1;
		if ((clipData.flags & alert_flag_offsetMs) !== 0)
		{
			startTime = clipData.offsetMs / fileDuration;
			endTime = (clipData.offsetMs + clipData.roughLengthMs) / fileDuration;
		}

		exportOffsetStart.setClipData(clipData);
		exportOffsetEnd.setClipData(clipData);
		exportOffsetStart.setPosition(startTime);
		exportOffsetEnd.setPosition(endTime);

		$exportOffsetWrapper.show();

		$exportControlsExportBtn.removeAttr('disabled');

		var $selectOffsetsMessage = $('<div class="exportOffsetMessage">Choose offsets by dragging the handles</div>');
		var labelFontSize = Clamp($layoutBottom.width() * 0.04, 9, 18);
		$selectOffsetsMessage.css('font-size', labelFontSize + 'px');
		$selectOffsetsMessage.fadeIn(function ()
		{
			setTimeout(function ()
			{
				$selectOffsetsMessage.fadeOut(function ()
				{
					$selectOffsetsMessage.remove();
				});
			}, 4000);
		});
		$exportOffsetWrapper.append($selectOffsetsMessage);

		// call global resized
		resized();
	}
	this.Disable = function ()
	{
		if (!controlsEnabled)
			return;
		controlsEnabled = false;
		clipStatsLoaded = false;

		clipData = null;

		$exportOffsetWrapper.hide();
		$exportControlsWrapper.hide();

		// call global resized
		resized();
	}
	var CheckCurrentClip = function ()
	{
		if (!controlsEnabled)
			return;
		if (clipData.recId !== videoPlayer.Loading().image.uniqueId)
		{
			toaster.Info("The clip export operation was canceled because the clip was closed!", 10000);
			self.Disable();
		}
	}
	var offsetChanged = function ()
	{
		if (!controlsEnabled || !clipStatsLoaded)
			return;
		var percentOfClip = Math.abs(exportOffsetEnd.getPosition() - exportOffsetStart.getPosition());
		var durationMs = percentOfClip * fileDuration;
		var estimatedSize = percentOfClip * fileSizeBytes;
		$exportControlsStatus.text('Ready to Export ' + msToTime(durationMs) + ' (' + formatBytes2(estimatedSize, 1) + ')');
	}
	var beginExport = function ()
	{
		CheckCurrentClip();
		var startTimeMs = exportOffsetStart.getPosition() * fileDuration;
		var endTimeMs = exportOffsetEnd.getPosition() * fileDuration;
		var durationMs = endTimeMs - startTimeMs;
		if (durationMs === 0)
		{
			// Both markers are in exactly the same spot.
			// Adjust end time offset 10 seconds forward.
			endTimeMs = Clamp(endTimeMs + 10000, 0, fileDuration);
			startTimeMs = Clamp(endTimeMs - 10000, 0, fileDuration);
		}
		else if (durationMs < 0)
		{
			// End marker is before Start marker.  Swap them.
			var tmp = startTimeMs;
			startTimeMs = endTimeMs;
			endTimeMs = tmp;
		}
		var percentOfClip = durationMs / fileDuration;
		var estimatedSize = percentOfClip * fileSizeBytes;
		var proceedFunc = function ()
		{
			new ActiveClipExportDialog(clipData, startTimeMs, endTimeMs, settings.ui3_clip_export_withAudio === "1");
			self.Disable();
		}
		if (estimatedSize >= 950000000)
		{
			// 1 GB is the supposed limit for AVI files produced by UI3 at this time.
			SimpleDialog.ConfirmText("Your selection size is very large, approximately " + formatBytes2(estimatedSize, 1) + ", and the export will probably fail.  Do you wish to try anyway?", proceedFunc);
		}
		else if (estimatedSize >= 450000000)
		{
			// 500-600 MB is the supposed limit for Blobs / Data URIs in some browsers.
			SimpleDialog.ConfirmText("Your selection size is very large, approximately " + formatBytes2(estimatedSize, 1) + ", and the export may fail.  Do you wish to try anyway?", proceedFunc);
		}
		else
			proceedFunc();
	}

	Initialize();
}
function ExportOffsetControl($handle, polePosition, offsetChanged)
{
	var self = this;
	var $parent = $handle.parent();
	var percent;
	var po = $parent.offset();
	var pw = Math.max(2, $parent.width());
	var pwm1 = pw - 1;
	var w = $handle.width();
	var seekBarW = pw;
	var seekBarWm1 = pwm1;
	var seekBarO = po;
	var dragOffset = 0;
	var isDragging = false;
	var $label = $('<div class="exportOffsetFlagLabel"></div>');
	$handle.append($label);
	$handle.append('<div class="exportOffsetFlagpole"></div>');
	var clipData;
	this.setClipData = function (cd)
	{
		clipData = cd;
		self.resized();
	}
	this.setPosition = function (newPercent)
	{
		percent = Clamp(newPercent, 0, 1);
		self.resized();
		offsetChanged();
	}
	this.resized = function ()
	{
		if (!seekBar)
			return;
		po = $parent.offset();
		pw = Math.max(2, $parent.width());
		pwm1 = pw - 1;
		w = $handle.width();
		seekBarW = seekBar.getWidth();
		seekBarWm1 = seekBarW - 1;
		seekBarO = seekBar.getOffset();

		$handle.css('left', ((seekBarWm1 * percent) - (w * polePosition) + (seekBarO.left - po.left)) + 'px');

		if (clipData)
			$label.text(msToTime(percent * clipData.msec));
	}
	this.getPosition = function ()
	{
		return percent;
	}
	this.IsDragging = function ()
	{
		return isDragging;
	}
	var FakeMouseEventForSeekBar = function (e)
	{
		return {
			pageX: e.pageX - dragOffset,
			pageY: e.pageY,
			type: e.type,
			noSeekHint: true,
			which: e.which,
			preventDefault: function ()
			{
				if (e.preventDefault)
					e.preventDefault();
			}
		};
	}
	var Initialize = function ()
	{
		$handle.attr('title', 'Right-click handle to set to current playback position');
		$handle.on('contextmenu', function (e)
		{
			self.setPosition(videoPlayer.GetClipPlaybackPositionPercent());
			return false;
		});
		$handle.on("mousedown touchstart", function (e)
		{
			mouseCoordFixer.fix(e);
			if (touchEvents.Gate(e))
				return;
			if (e.which != 3)
			{
				self.mouseDown(e);
				seekBar.mouseDown(FakeMouseEventForSeekBar(e));
				return false;
			}
		});
	}

	this.mouseDown = function (e)
	{
		dragOffset = (e.pageX - $handle.offset().left) - (w * polePosition);
		isDragging = true;
		if (!videoPlayer.Playback_IsPaused())
			videoPlayer.Playback_Pause();
	}
	this.mouseMove = function (e)
	{
		if (isDragging)
		{
			var newPosX = (e.pageX - seekBarO.left) - dragOffset;
			self.setPosition(newPosX / seekBarWm1);
			seekBar.mouseMove(FakeMouseEventForSeekBar(e), true);
			return true;
		}
		return false;
	}
	this.mouseUp = function (e)
	{
		self.mouseMove(e);
		if (isDragging)
		{
			isDragging = false;
			seekBar.mouseUp(FakeMouseEventForSeekBar(e));
			return true;
		}
		return false;
	}

	Initialize();
}
///////////////////////////////////////////////////////////////
// Big Thumbnail Helper (PTZ Presets, Alerts, Clips) //////////
///////////////////////////////////////////////////////////////
var bigThumbHelper = new BigThumbHelper();
function BigThumbHelper()
{
	var self = this;
	var $thumb, $desc, $img, img, $canvas, canvas;
	var isShowing = false;
	var initialized = false;
	var imgCompleteCallback;
	var imgCompleteUserContext;
	var Initialize = function ()
	{
		if (initialized)
			return;
		initialized = true;
		$thumb = $('<div id="bigThumb"></div>');
		$("body").append($thumb);
		$desc = $('<div class="bigThumbDescription"></div>');
		$thumb.append($desc);
		$img = $('<img />');
		$img.on('load', imgLoaded);
		$img.on('error', imgErrored);
		img = $img[0];
		$canvas = $("<canvas>HTML5 canvas not supported</canvas>");
		$thumb.append($canvas);
		canvas = $canvas[0];
	}
	var imgLoaded = function ()
	{
		if ($img.attr("src") != "")
			renderImage(img, $img);
	}
	var renderImage = function (imgEle, $imgEle)
	{
		if (isShowing)
		{
			CopyImageToCanvas(imgEle, canvas);
			if (imgCompleteCallback)
				imgCompleteCallback($imgEle, imgCompleteUserContext, true);
		}
	}
	var imgErrored = function ()
	{
		if (isShowing)
		{
			if (imgCompleteCallback)
				imgCompleteCallback($img, imgCompleteUserContext, false);
		}
	}
	this.Show = function ($vAlign, $hAlign, descriptionText, imgSrc, imgW, imgH, imgComplete, userContext, noClear)
	{
		Initialize();

		isShowing = true;

		// These callbacks are handled really clumsily such that they won't be called correctly if Show() is called again before the callback from the previous Show().
		imgCompleteCallback = null;
		imgCompleteUserContext = null;

		$desc.text(descriptionText);

		var isImgEle = imgSrc && typeof imgSrc == "object" && typeof imgSrc.getAttribute == "function";

		if (!isImgEle && !noClear && (!imgSrc || !imgSrc.startsWith('data:image/')))
		{
			canvas.width = canvas.height = 0;
		}

		var assumedWidth = 0;
		var assumedHeight = 0;
		if (imgSrc)
		{
			if (isImgEle)
			{
				$img.attr("src", "");
				imgCompleteCallback = imgComplete;
				imgCompleteUserContext = userContext;
				renderImage(imgSrc, $(imgSrc));
			}
			else
			{
				imgCompleteCallback = imgComplete;
				imgCompleteUserContext = userContext;
				$img.attr("src", imgSrc);
			}
			assumedWidth = imgW;
			assumedHeight = imgH;
		}
		var bW = $('#layoutbody').width();
		var shrinkBy = assumedWidth ? bW / assumedWidth : 0;
		if (shrinkBy > 0 && shrinkBy < 1)
			assumedHeight = assumedHeight * shrinkBy;
		var left = $hAlign.offset().left + $hAlign.width() + 3;
		var wH = $(window).height();
		var top = ($vAlign.offset().top + ($vAlign.height() / 2)) - (assumedHeight / 2) - 20; // 20 for the description
		if (top + (assumedHeight + 20) > wH)
			top = (wH - (assumedHeight + 20));
		if (top < 0)
			top = 0;
		$thumb.css("left", left + "px");
		$thumb.css("top", top + "px");
		$thumb.css("max-width", bW + "px");
		$thumb.show();
	}
	this.Hide = function ()
	{
		if (isShowing)
		{
			isShowing = false;
			$thumb.hide();
		}
	}
	this.IsShowing = function ()
	{
		return isShowing;
	}
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
	var HeightOfOneSizeLargeLargeThumbClipTilePx = 137;
	var HeightOfOneSizeMediumLargeThumbClipTilePx = 130;
	var HeightOfOneSizeSmallLargeThumbClipTilePx = 115;
	var HeightOfOneDateTilePx = 27;
	var asyncThumbnailDownloader = new AsyncClipThumbnailDownloader();
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
	var lastClipTileSize; // Initialized at end of constructor
	var lastClipListLargerThumbs = getLargerClipThumbnails(); // Initialized at end of constructor
	if (lastClipListLargerThumbs)
		$clipsbody.addClass("largerThumbs");
	var currentTopDate = new Date(0);
	var lastLoadedCameraFilter = "index";
	this.suppressClipListLoad = false;

	// For updating an existing clip list
	var newestClipDate = 0;
	var clipListGrew = false;
	var lastClipListLoadedAt = performance.now();

	// For handling multi-select only
	var selectedClips = [];
	var selectedClipsMap = new Object();
	var lastSelectedClipId = null;

	var bulkOperationInProgress = false;

	// Too many clip tiles bogs down the UI, and clip tiles must exist to be selected.
	var clipTileSelectLimit = 1000;
	var clipVisibilityMap = {};

	this.LoadClips = function (listName)
	{
		var loading = videoPlayer.Loading();
		if (loading.image && loading.image.isLive)
			lastLoadedCameraFilter = loading.image.id;
		loadClipsInternal(listName, lastLoadedCameraFilter, dateFilter.BeginDate, dateFilter.EndDate, false, false, null, settings.ui3_recordings_flagged_only == "1");
	}
	this.UpdateClipList = function ()
	{
		if (documentIsHidden())
			return;
		if (isLoadingAClipList)
			return;
		if (performance.now() - lastClipListLoadedAt < 5000)
			return;
		if (newestClipDate == 0)
			return;
		if (!videoPlayer.Loading().cam)
			return;
		if (dateFilter.BeginDate != 0 && dateFilter.EndDate != 0)
			return;
		if (settings.ui3_recordings_flagged_only == "1")
			return;
		// We request clips starting from 60 seconds earlier so that metadata of recent clips may be updated.
		loadClipsInternal(null, lastLoadedCameraFilter, newestClipDate - 60, newestClipDate + 86400, false, true);
	}
	this.LoadClipsRange = function (listName, camFilter, dateBegin, dateEnd)
	{
		if (!camFilter)
		{
			var loading = videoPlayer.Loading();
			if (loading.image && loading.image.isLive)
				camFilter = loading.image.id;
		}
		loadClipsInternal(listName, camFilter, dateBegin, dateEnd, false, false, null, false);
	}
	var loadClipsInternal = function (listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList, previousClipDate, flaggedOnly)
	{
		if (!videoPlayer.Loading().cam)
			return; // UI hasn't loaded far enough yet.
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
					loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList, previousClipDate, flaggedOnly);
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

			clipVisibilityMap = {};

			$clipsbody.empty();
			$clipListTopDate.html("...");
			$clipsbody.html('<div class="clipListText">Loading...<br/><br/><span id="clipListDateRange"></span></div>');
			$.CustomScroll.callMeOnContainerResize();

			tileLoader.unregisterAllOnAppearDisappear();
			asyncThumbnailDownloader.Stop();
		}
		if (isUpdateOfExistingList)
		{
			if (isLoadingAClipList)
				return;
		}
		isLoadingAClipList = true;

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
				$clipsbody.html('<div class="clipListText">Failed to load.</div>');
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
					clipData.rawClipData = clip;
					clipData.isClip = isClipList;
					clipData.roughLength = CleanUpFileSize(clip.filesize);
					clipData.roughLengthMs = GetClipLengthMs(clipData.roughLength);
					clipData.camera = clip.camera;
					clipData.recId = clip.path.replace(/@/g, "").replace(/\..*/g, ""); // Unique ID, not used for loading imagery
					clipData.thumbPath = clip.path; // Path used for loading the thumbnail
					clipData.res = clip.res;
					if (isClipList)
					{
						clipData.isSnapshot = clipData.roughLength == "Snapshot"
						clipData.clipId = clipData.recId; // Unique ID of the underlying clip.
						clipData.path = clip.path; // Path used for loading the video stream
					}
					else
					{
						clipData.isSnapshot = clip.clip.startsWith("@-1.");
						if (clipData.isSnapshot)
						{
							clipData.clipId = ""; // Unique ID of the underlying clip.
							clipData.path = clip.path; // Path used for loading the video stream
						}
						else
						{
							clipData.clipId = clip.clip.replace(/@/g, "").replace(/\..*/g, ""); // Unique ID of the underlying clip.
							clipData.path = clip.clip; // Path used for loading the video stream
						}
					}
					clipData.alertPath = clip.path; // Alert path if this is an alert, otherwise just another copy of the clip path.
					clipData.offsetMs = clip.offset ? clip.offset : 0;
					clipData.flags = clip.flags;
					if (flaggedOnly && (clip.flags & clip_flag_flag) == 0)
						continue;
					clipData.audio = (clip.flags & clip_flag_audio) > 0;
					clipData.date = new Date(clip.date * 1000);
					clipData.displayDate = GetServerDate(clipData.date);
					clipData.colorHex = BlueIrisColorToCssColor(clip.color);
					clipData.fileSize = GetFileSize(clip.filesize);
					if (clipData.isSnapshot)
						clipData.msec = clipData.roughLengthMs = 2000;
					else if (typeof clip.msec != "undefined" && !isNaN(clip.msec))
						clipData.msec = clip.msec;
					else
						clipData.msec = clipData.offsetMs + clipData.roughLengthMs;


					if (!clipListCache[clipData.camera])
						clipListCache[clipData.camera] = new Object();
					var existingClipData = clipListCache[clipData.camera][clipData.recId];

					if (!isSameDay(previousClipDate, clipData.displayDate))
					{
						if (previousClipDate.getTime() == 0)
							$clipListTopDate.attr("defaultStr", GetDateDisplayStr(clipData.displayDate)); // Do not add the first date tile because it is redundant with a date display above the list.
						else
						{
							if (isUpdateOfExistingList)
							{
								if (!existingClipData)
								{
									// This adds the appropriate date tile if a day boundary is found within a background update.
									newUpdateClips.push({ isDateTile: true, date: clipData.displayDate });
									TotalDateTilesLoaded++;
								}
							}
							else
							{
								tileLoader.registerOnAppearDisappear({ isDateTile: true, date: clipData.displayDate }, DateTileOnAppear, DateTileOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
								TotalDateTilesLoaded++;
							}
						}
					}

					previousClipDate = clipData.displayDate;

					if (existingClipData)
					{
						UpdateExistingClipData(existingClipData, clipData);
					}
					else // Only register if not already registered
					{
						if (isUpdateOfExistingList)
						{
							newUpdateClips.push(clipData);
							newUpdateClipIds.push(clipData.recId);
						}
						else
						{
							loadedClipIds.push(clipData.recId);
							tileLoader.registerOnAppearDisappear(clipData, ClipOnAppear, ClipOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
						}
						TotalUniqueClipsLoaded++;
						clipListCache[clipData.camera][clipData.recId] = clipData;
						clipListIdCache[clipData.recId] = clipData;
						if (!isUpdateOfExistingList && previouslyOpenedClip == null && !loadingImage.isLive && loadingImage.uniqueId == clipData.recId)
							previouslyOpenedClip = clipData;
					}

				}
				if (isUpdateOfExistingList && newUpdateClipIds.length > 0)
				{
					var oldestOfNewClipIds = newUpdateClipIds[newUpdateClipIds.length - 1];
					if (loadedClipIds.length > 0 && !isSameDay(clipListIdCache[loadedClipIds[0]].displayDate, clipListIdCache[oldestOfNewClipIds].displayDate))
					{
						// This adds the appropriate date tile if a day boundary is found between a background update and the previously-loaded clips.
						newUpdateClips.push({ isDateTile: true, date: clipListIdCache[loadedClipIds[0]].displayDate });
						TotalDateTilesLoaded++;
					}
					loadedClipIds = newUpdateClipIds.concat(loadedClipIds);
					tileLoader.preserveScrollPosition(clipTileHeight, HeightOfOneDateTilePx, newUpdateClipIds.length);
					tileLoader.injectNewClips(newUpdateClips, ClipOnAppear, ClipOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx, DateTileOnAppear, DateTileOnDisappear);
					clipListGrew = true;
				}

				if (QueuedClipListLoad != null)
				{
					isLoadingAClipList = false;
					lastClipListLoadedAt = performance.now();
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
						lastClipListLoadedAt = performance.now();
						self.LoadClips();
						return;
					}
					for (var i = response.data.length - 1; i >= 0 && i >= response.data.length - 200; i--)
						if (typeof response.data[i].newalerts === "undefined")
						{
							myDateEnd = response.data[i].date;
							break;
						}
					$("#clipListDateRange").html("&nbsp;Remaining to load:<br/>&nbsp;&nbsp;&nbsp;" + parseInt((myDateEnd - myDateStart) / 86400) + " days");
					$.CustomScroll.callMeOnContainerResize();
					return loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, true, isUpdateOfExistingList, previousClipDate, flaggedOnly);
				}
			}

			isLoadingAClipList = false;
			lastClipListLoadedAt = performance.now();
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
					$clipsbody.append('<div class="clipListText">No recordings were found matching your filters.</div>');
				}
				asyncThumbnailDownloader = new AsyncClipThumbnailDownloader();
				tileLoader.AppearDisappearCheckEnabled = true;
				tileLoader.appearDisappearCheck();

				if (!loadingImage.isLive && !isUpdateOfExistingList)
				{
					if (previouslyOpenedClip == null)
						self.CloseCurrentClip();
					else
					{
						// A clip is still playing, and it is in the new list.  Select it and scroll to it.
						self.SelectClipIdNoOpen(previouslyOpenedClip.recId);
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
				toaster.Error("Failed to load " + (listName == "cliplist" ? "clip list" : "alert list") + ".<br/>Will " + (tryAgain ? "" : "NOT ") + "try again.<br/>" + jqXHR.ErrorMessageHtml, 5000);

				if (tryAgain)
				{
					setTimeout(function ()
					{
						isLoadingAClipList = false;
						loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad, isUpdateOfExistingList, previousClipDate, flaggedOnly);
					}, 1000);
				}
				else
				{
					isLoadingAClipList = false;
					lastClipListLoadedAt = performance.now();
					failedClipListLoads = 0;
				}
			});
	};
	this.resizeClipList = function ()
	{
		var currentClipTileSize = getClipTileSize();
		var desiredLargerClipThumbnails = getLargerClipThumbnails();
		if (lastClipTileSize != currentClipTileSize
			|| clipListGrew
			|| lastClipListLargerThumbs != desiredLargerClipThumbnails)
		{
			clipListGrew = false;
			lastClipTileSize = currentClipTileSize;
			lastClipListLargerThumbs = desiredLargerClipThumbnails;
			if (lastClipListLargerThumbs)
				$clipsbody.addClass("largerThumbs");
			else
				$clipsbody.removeClass("largerThumbs");
			var clipTileHeight = getClipTileHeight();
			tileLoader.resizeClipList(clipTileHeight, HeightOfOneDateTilePx);
			$("#clipListHeightSetter").css("height", ((clipTileHeight * TotalUniqueClipsLoaded) + (HeightOfOneDateTilePx * TotalDateTilesLoaded)) + "px");
		}
	}
	var getClipTileHeight = function ()
	{
		var currentClipTileSize = getClipTileSize();
		if (currentClipTileSize == "s")
		{
			if (getLargerClipThumbnails())
				return HeightOfOneSizeSmallLargeThumbClipTilePx;
			else
				return HeightOfOneSizeSmallClipTilePx;
		}
		else if (currentClipTileSize == "m")
		{
			if (getLargerClipThumbnails())
				return HeightOfOneSizeMediumLargeThumbClipTilePx;
			else
				return HeightOfOneClipTilePx;
		}
		else
		{
			if (getLargerClipThumbnails())
				return HeightOfOneSizeLargeLargeThumbClipTilePx;
			else
				return HeightOfOneClipTilePx;
		}
	}
	var getClipTileSize = function ()
	{
		if (uiSizeHelper.GetCurrentSize() == "small" || uiSizeHelper.GetCurrentSize() == "smaller")
			return "s";
		else if (uiSizeHelper.GetCurrentSize() == "medium")
			return "m";
		else
			return "l";
	}
	this.GetCachedClip = function (cameraId, recId)
	{
		/// <summary>Gets the clip with the specified camera ID and clip ID. I'm only keeping this more complicated cache around in case I want to enumerate clips by camera ID in the future.</summary>
		var camClips = clipListCache[cameraId];
		if (camClips)
			return camClips[recId];
		return null;
	}
	this.GetClipFromId = function (recId)
	{
		/// <summary>Gets the clip with the specified clip ID.</summary>
		return clipListIdCache[recId];
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
		var date = GetDateStr(clipData.displayDate);
		date = date.replace(/\//g, '-').replace(/:/g, '.');
		retVal.fileNameNoExt = cameraListLoader.GetCameraName(clipData.camera) + " " + date;
		var extensionIdx = clipData.path.indexOf(".");
		if (extensionIdx == -1)
		{
			toaster.Warning('Could not find file extension in clip path "' + clipData.path + '"');
			retVal.download = retVal.fileNameNoExt
		}
		else
		{
			retVal.download = retVal.fileNameNoExt + clipData.path.substr(extensionIdx);
		}
		return retVal;
	}
	this.GetClipDisplayName = function (clipData)
	{
		var date = GetDateStr(clipData.displayDate);
		return cameraListLoader.GetCameraName(clipData.camera) + " " + date;
	}
	this.IsClipSelected = function (recId)
	{
		return selectedClipsMap[recId] ? true : false;
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
	this.ApplyMissingStatsToClipData = function (stats, clipData)
	{
		if (stats.path != clipData.path)
			return false;
		clipData.hasLoadedClipStats = true;
		clipData.msec = stats.msec;
		clipData.fileSize = GetFileSize(stats.filesize);
		clipData.rawClipData = stats;
		return true;
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
		var seconds = 0;

		var match = new RegExp("(\\d+)h").exec(str);
		if (match)
			hours = parseInt(match[1]);

		match = new RegExp("(\\d+)m").exec(str);
		if (match)
			minutes = parseInt(match[1]);

		match = new RegExp("(\\d+)s").exec(str);
		if (match)
			seconds = parseInt(match[1]);

		if (hours == 0 && minutes == 0 && seconds == 0)
			seconds = 10;

		return { hours: hours, minutes: minutes, seconds: seconds };
	}
	var UpdateExistingClipData = function (oldClipData, newClipData)
	{
		if (oldClipData.recId != newClipData.recId)
			return;
		var loading = videoPlayer.Loading().image;
		if (loading.uniqueId == newClipData.recId)
			return; // If Blue Iris is currently playing this clip, it has cached a copy of the metadata and if we refresh it clientside it will be out of sync.
		var $clip = $("#c" + oldClipData.recId);

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
		if (oldClipData.flags != newClipData.flags)
		{
			oldClipData.flags = newClipData.flags;
			self.RepairClipFlagState(oldClipData);
		}
		if (oldClipData.msec != newClipData.msec)
		{
			oldClipData.msec = newClipData.msec;

			//var loaded = videoPlayer.Loaded().image;
			//if (loaded.uniqueId == newClipData.recId)
			//	loaded.msec = newClipData.msec;

			//var loading = videoPlayer.Loading().image;
			//if (loading.uniqueId == newClipData.recId)
			//{
			//	loading.msec = newClipData.msec;
			//	videoPlayer.NotifyClipMetadataChanged(newClipData);
			//}
		}
	}
	var ThumbOnAppear = function (ele)
	{
		if (!ele)
		{
			console.error("ThumbOnAppear called with undefined ele");
			return;
		}
		var path = currentServer.remoteBaseURL + "thumbs/" + ele.thumbPath + currentServer.GetRemoteSessionArg("?");
		if (ele.getAttribute('src') != path)
			asyncThumbnailDownloader.Enqueue(ele, path);
	}
	var ThumbOnDisappear = function (ele)
	{
		if (!ele)
		{
			console.error("ThumbOnDisappear called with undefined ele");
			return;
		}
		asyncThumbnailDownloader.Dequeue(ele);
	}
	var ClipOnAppear = function (clipData)
	{
		ClipTileCreate(clipData);
		ThumbOnAppear($("#t" + clipData.recId).get(0));
		clipVisibilityMap[clipData.recId] = true;
	}
	var ClipOnDisappear = function (clipData)
	{
		ThumbOnDisappear($("#t" + clipData.recId).get(0));
		clipVisibilityMap[clipData.recId] = false;
		if (!selectedClipsMap[clipData.recId]) // We need clip elements to stick around if they're selected, for the sake of multi-select.
			$("#c" + clipData.recId).remove();
		self.HideBigClipThumb();
	}
	var ClipTileCreateFromId = function (recId)
	{
		var $clip = $("#c" + recId);
		if ($clip.length == 0)
		{
			var clipData = self.GetClipFromId(recId);
			if (clipData)
				$clip = ClipTileCreate(clipData, $clip);
		}
		return $clip;
	}
	var ClipTileCreate = function (clipData, $clip)
	{
		if (!$clip)
			$clip = $("#c" + clipData.recId);
		if ($clip.length == 0)
		{
			var timeStr = GetTimeStr(clipData.displayDate);
			var clipDur = GetClipDurStrFromMs(clipData.roughLength);
			var clipDurTitle = clipDur == 'S' ? ' title="Snapshot"' : '';
			var camName = cameraListLoader.GetCameraName(clipData.camera);
			$clip = $('<div id="c' + clipData.recId + '" class="cliptile" style="top:' + clipData.y + 'px">'
				+ '<div class="verticalAlignHelper"></div>'
				+ '<div class="clipimghelper">'
				+ '<div class="verticalAlignHelper"></div>'
				+ '<div class="clipdur"' + clipDurTitle + '>' + clipDur + '</div>'
				+ '<img id="t' + clipData.recId + '" src="ui3/LoadingImage.png" />'
				+ '</div>'
				+ '<div class="clipcolorbar" style="background-color: #' + clipData.colorHex + ';"></div>'
				+ '<div class="clipdesc"><div class="cliptime">' + timeStr + '</div><div class="clipcam">' + camName + '</div></div>'
				+ '<div class="clipIconWrapper ' + GetClipIconClasses(clipData) + '">'
				+ GetClipIcons(clipData)
				+ '</div>'
				+ '</div>');
			$clipsbody.append($clip);

			var thumbEle = $("#t" + clipData.recId).get(0);
			thumbEle.thumbPath = clipData.thumbPath;

			$clip.click(ClipClicked);
			$clip.on("mouseenter touchstart touchmove", function (e)
			{
				if (touchEvents.Gate(e) || touchEvents.isTouchEvent(e))
					return;

				if (getMouseoverClipThumbnails())
				{
					var thumbPath = currentServer.remoteBaseURL + "thumbs/" + clipData.thumbPath + currentServer.GetRemoteSessionArg("?");
					if (thumbEle.getAttribute("src") == thumbPath)
						thumbPath = thumbEle;
					bigThumbHelper.Show($clip, $clip, camName + " " + timeStr, thumbPath, thumbEle.naturalWidth, thumbEle.naturalHeight);
					if (!clipData.isSnapshot)
						clipThumbnailVideoPreview.Start($clip, clipData, camName);
				}
			});
			$clip.on("mouseleave touchend touchcancel", function (e)
			{
				touchEvents.Gate(e);
				self.HideBigClipThumb();
			});
			var clipEle = $clip.get(0).clipData = clipData;

			clipListContextMenu.AttachContextMenu($clip);

			if (self.ClipDataIndicatesFlagged(clipData))
				self.ShowClipFlag(clipData);

			if (selectedClipsMap[clipData.recId])
			{
				if (videoPlayer.Loading().image.uniqueId == clipData.recId)
				{
					lastOpenedClipEle = $clip.get(0);
					$clip.addClass("opened");
				}
				$clip.addClass("selected");
			}
		}
		return $clip;
	}
	this.HideBigClipThumb = function ()
	{
		bigThumbHelper.Hide();
		clipThumbnailVideoPreview.Stop();
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
		var recId = this.clipData.recId;
		if (e.shiftKey && lastSelectedClipId)
		{
			// Multi-select add-range
			var range = self.GetClipIdsBetween(lastSelectedClipId, this.clipData.recId);

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
						if (CheckSelectionLimit())
							return;
						ClipTileCreateFromId(range[i]);
						$("#c" + range[i]).addClass("selected");
						selectedClips.push(range[i]);
						selectedClipsMap[range[i]] = true;
					}
				}
			}

			if (e.ctrlKey)
				lastSelectedClipId = recId;
		}
		else if (e.ctrlKey)
		{
			// Multi-select toggle item
			lastSelectedClipId = recId;
			if (selectedClipsMap[recId] === true)
			{
				var idx = selectedClips.indexOf(recId);
				if (idx > -1)
				{
					selectedClips.splice(idx, 1);
					if (!clipVisibilityMap[recId])
						ClipOnDisappear(self.GetClipFromId(recId));
				}
				selectedClipsMap[recId] = false;
				$("#c" + recId).removeClass("selected");
			}
			else
			{
				if (CheckSelectionLimit())
					return;
				selectedClips.push(recId);
				selectedClipsMap[recId] = true;
				$("#c" + recId).addClass("selected");
			}
		}
		else
		{
			self.HideBigClipThumb();
			self.OpenClip(this, recId, true);
		}
	}
	var CheckSelectionLimit = function ()
	{
		if (selectedClips.length >= clipTileSelectLimit)
		{
			toaster.Warning("For performance reasons, you can't select more than " + clipTileSelectLimit + " items at once.");
			return true;
		}
		return false;
	}
	this.OpenFirstRecordingAfterNextClipListLoad = function ()
	{
		BI_CustomEvent.AddListener("ClipList_Loaded", openFirstRecordingCallback);
	}
	var openFirstRecordingCallback = function (response)
	{
		BI_CustomEvent.RemoveListener("ClipList_Loaded", openFirstRecordingCallback);
		self.OpenFirstRecording();
	}
	var openFirstRecordingAfterUILoadCallback = function (response)
	{
		BI_CustomEvent.RemoveListener("FinishedLoading", openFirstRecordingAfterUILoadCallback);
		self.OpenFirstRecording();
	}
	this.OpenFirstRecording = function ()
	{
		if (!loadingHelper.DidLoadingFinish())
		{
			BI_CustomEvent.AddListener("FinishedLoading", openFirstRecordingAfterUILoadCallback);
			return;
		}
		if (loadedClipIds.length === 0)
			return;

		var recId = loadedClipIds[0];
		var clipData = self.GetClipFromId(recId);
		self.ScrollClipList(clipData.y, getClipTileHeight());
		var $ele = $("#c" + recId);
		if ($ele.length > 0)
			self.OpenClip($ele.get(0), recId, true);
	}
	this.OpenClip = function (clipEle, recId, alsoLoadClip)
	{
		self.UnselectAllClips(true);
		lastOpenedClipEle = clipEle;

		$(clipEle).addClass("opened");
		$(clipEle).addClass("selected");
		if (alsoLoadClip)
			videoPlayer.LoadClip(clipEle.clipData);

		// Multi-select start
		lastSelectedClipId = recId;
		selectedClipsMap = new Object();
		selectedClipsMap[recId] = true;
		selectedClips = [];
		selectedClips.push(recId);
	}
	this.SelectClipIdNoOpen = function (recId)
	{
		if (selectedClipsMap[recId] !== true)
		{
			selectedClips.push(recId);
			selectedClipsMap[recId] = true;
			$("#c" + recId).addClass("selected");
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
		var unselectedOffscreen = new Array();
		if (alsoRemoveOpenedStatus && lastOpenedClipEle)
		{
			$(lastOpenedClipEle).removeClass("opened");
			lastOpenedClipEle = null;
		}
		for (var i = 0; i < selectedClips.length; i++)
		{
			if (!clipVisibilityMap[selectedClips[i]])
				unselectedOffscreen.push(selectedClips[i]);
			$("#c" + selectedClips[i]).removeClass("selected");
		}
		lastSelectedClipId = null;
		selectedClipsMap = new Object();
		selectedClips = [];

		for (var i = 0; i < unselectedOffscreen.length; i++)
			ClipOnDisappear(self.GetClipFromId(unselectedOffscreen[i]));
	}
	var DateTileOnAppear = function (dateTileData)
	{
		var time = dateTileData.date.getTime();
		var $dateTile = $("#dt" + time);
		if ($dateTile.length == 0)
		{
			var timeStr = GetDateDisplayStr(dateTileData.date);
			$clipsbody.append('<div id="dt' + time + '" class="datetile" style="top:' + dateTileData.y + 'px">'
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
			$("#c" + obj.recId).css("top", obj.y + "px");
	}
	this.FlagCurrentClip = function ()
	{
		if (lastOpenedClipEle == null)
			return;
		// Find current flag state
		var clipData = lastOpenedClipEle.clipData;
		self.ToggleClipFlag(clipData);
	}
	var GetClipIconClasses = function (clipData)
	{
		if ((clipData.flags & clip_flag_flag) > 0)
			return GetClipIconClass("flag");
		if ((clipData.flags & clip_flag_protect) > 0)
			return GetClipIconClass("protect");
		return "";
	}
	var GetClipIconClass = function (name)
	{
		return "icon_" + name;
	}
	var GetClipIcons = function (clipData)
	{
		var icons = [];
		if ((clipData.flags & alert_flag_trigger_motion) > 0 && settings.ui3_clipicon_trigger_motion == "1")
			icons.push(self.GetClipIcon("trigger_motion"));
		if ((clipData.flags & alert_flag_trigger_audio) > 0 && settings.ui3_clipicon_trigger_audio == "1")
			icons.push(self.GetClipIcon("trigger_audio"));
		if ((clipData.flags & alert_flag_trigger_external) > 0 && settings.ui3_clipicon_trigger_external == "1")
			icons.push(self.GetClipIcon("trigger_external"));
		if ((clipData.flags & alert_flag_trigger_group) > 0 && settings.ui3_clipicon_trigger_group == "1")
			icons.push(self.GetClipIcon("trigger_group"));
		if ((clipData.flags & clip_flag_audio) > 0 && settings.ui3_clipicon_clip_audio == "1")
			icons.push(self.GetClipIcon("clip_audio"));
		if ((clipData.flags & clip_flag_backingup) > 0 && settings.ui3_clipicon_clip_backingup == "1")
			icons.push(self.GetClipIcon("clip_backingup"));
		if ((clipData.flags & clip_flag_backedup) > 0 && settings.ui3_clipicon_clip_backup == "1")
			icons.push(self.GetClipIcon("clip_backedup"));
		icons.push(self.GetClipIcon("protect"));
		icons.push(self.GetClipIcon("flag"));
		return icons.join("");
	}
	this.GetClipIcon = function (name)
	{
		switch (name)
		{
			case "trigger_motion":
				return GetClipIcon_Internal(name, "#svg_mio_run", true, "Triggered by motion detection")
			case "trigger_audio":
				return GetClipIcon_Internal(name, "#svg_mio_volumeUp", true, "Triggered by audio");
			case "trigger_external":
				return GetClipIcon_Internal(name, "#svg_x5F_Alert2", false, "Triggered by external source");
			case "trigger_group":
				return GetClipIcon_Internal(name, "#svg_mio_quilt", true, "The group was triggered");
			case "clip_audio":
				return GetClipIcon_Internal(name, "#svg_mio_volumeUp", true, "Clip has audio");
			case "clip_backingup":
				return GetClipIcon_Internal(name, "#svg_mio_cloudUploading", true, "Clip is being backed up");
			case "clip_backedup":
				return GetClipIcon_Internal(name, "#svg_mio_cloudUploaded", true, "Clip has been backed up");
			case "protect":
				return GetClipIcon_Internal(name, "#svg_mio_lock", true, "Item is protected");
			case "flag":
				return GetClipIcon_Internal(name, "#svg_x5F_Flag", false, "Item is flagged");
			case "is_recording":
				return GetClipIcon_Internal(name, "#svg_x5F_Stoplight", false, "Clip is still recording");
			case "nosignal":
				return GetClipIcon_Internal(name, "#svg_x5F_Error", false, "Camera was in a no-signal state");
		}
		return "";
	}
	var GetClipIcon_Internal = function (name, svgId, noflip, title)
	{
		return '<div class="clipicon ' + GetClipIconClass(name) + '"'
			+ (title ? (' title="' + title + '"') : '')
			+ '><svg class="icon' + (noflip ? ' noflip' : '') + '"><use xlink:href="' + svgId + '"></use></svg></div>'
	}
	this.ToggleClipProtect = function (clipData, onSuccess, onFailure)
	{
		ToggleFlag(clipData, clip_flag_protect, function (clipData, flagIsSet)
		{
			if (flagIsSet)
				self.HideClipProtect(clipData);
			else
				self.ShowClipProtect(clipData);
			if (onSuccess)
				onSuccess(clipData);
		}, onFailure);
	}
	this.ToggleClipFlag = function (clipData, onSuccess, onFailure)
	{
		ToggleFlag(clipData, clip_flag_flag, function (clipData, flagIsSet)
		{
			if (flagIsSet)
				self.HideClipFlag(clipData);
			else
				self.ShowClipFlag(clipData);
			if (onSuccess)
				onSuccess(clipData);
		}, onFailure);
	}
	var ToggleFlag = function (clipData, flag, onSuccess, onFailure)
	{
		var flagIsSet = (clipData.flags & flag) > 0;
		var newFlags = flagIsSet ? clipData.flags ^ flag : clipData.flags | flag;
		UpdateClipFlags('@' + clipData.recId, newFlags, function ()
		{
			// Success setting flag state
			clipData.flags = newFlags;
			if (onSuccess)
				onSuccess(clipData, flagIsSet);
		}, onFailure);
	}
	this.HideClipFlag = function (clipData)
	{
		if (lastOpenedClipEle && lastOpenedClipEle.clipData == clipData)
			$("#clipFlagButton").removeClass("flagged");
		var $clip = $("#c" + clipData.recId);
		if ($clip.length == 0)
			return;
		var $flags = $clip.find(".clipIconWrapper");
		$flags.removeClass(GetClipIconClass("flag"));
	}
	this.ShowClipFlag = function (clipData)
	{
		if (lastOpenedClipEle && lastOpenedClipEle.clipData == clipData)
			$("#clipFlagButton").addClass("flagged");
		var $clip = $("#c" + clipData.recId);
		if ($clip.length == 0)
			return;
		var $flags = $clip.find(".clipIconWrapper");
		$flags.addClass(GetClipIconClass("flag"));
	}
	this.HideClipProtect = function (clipData)
	{
		var $clip = $("#c" + clipData.recId);
		if ($clip.length == 0)
			return;
		var $flags = $clip.find(".clipIconWrapper");
		$flags.removeClass(GetClipIconClass("protect"));
	}
	this.ShowClipProtect = function (clipData)
	{
		var $clip = $("#c" + clipData.recId);
		if ($clip.length == 0)
			return;
		var $flags = $clip.find(".clipIconWrapper");
		$flags.addClass(GetClipIconClass("protect"));
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
		return (clipData.flags & clip_flag_flag) > 0;
	}
	this.Multi_Flag = function (allSelectedClipIDs, flagEnable, idx, myToast)
	{
		if (!sessionManager.IsAdministratorSession())
			return openLoginDialog(function () { self.Multi_Flag(allSelectedClipIDs, flagEnable, idx, myToast); });
		Multi_Operation("flag", allSelectedClipIDs, { flagEnable: flagEnable }, 0, null, 0);
	}
	this.Multi_Protect = function (allSelectedClipIDs, protectEnable, idx, myToast)
	{
		if (!sessionManager.IsAdministratorSession())
			return openLoginDialog(function () { self.Multi_Protect(allSelectedClipIDs, protectEnable, idx, myToast); });
		Multi_Operation("protect", allSelectedClipIDs, { protectEnable: protectEnable }, 0, null, 0);
	}
	this.Multi_Delete = function (allSelectedClipIDs)
	{
		if (!sessionManager.IsAdministratorSession())
			return openLoginDialog(function () { self.Multi_Delete(allSelectedClipIDs); });
		Multi_Operation("delete", allSelectedClipIDs, null, 0, null, 0);
	}
	var Multi_Operation = function (operation, allSelectedClipIDs, args, idx, myToast, errorCount)
	{
		if (!idx)
			idx = 0;
		if (!errorCount)
			errorCount = 0;

		if (idx == 0 && bulkOperationInProgress)
		{
			toaster.Warning("Another bulk operation is in progress.  Please wait for it to finish before starting another.", 10000);
			return;
		}

		if (idx >= allSelectedClipIDs.length)
		{
			Multi_Operation_Stop(operation, myToast, allSelectedClipIDs.length, errorCount);
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
			var verb = "ERROR";
			if (operation == "flag")
				verb = args.flagEnable ? "Flagging" : "Unflagging";
			else if (operation == "protect")
				verb = args.protectEnable ? "Protecting" : "Unprotecting";
			else if (operation == "delete")
				verb = "Deleting";
			myToast = toaster.Info('<div id="multi_' + operation + '_status_toast" class="multi_operation_status_toast">'
				+ '<div>' + verb + ' ' + (currentPrimaryTab == "clips" ? "clip" : "alert") + ' <span class="multi_operation_count">' + (idx + 1) + '</span> / ' + allSelectedClipIDs.length + '</div>'
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
						Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast, errorCount);
					}, function ()
						{
							Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast, errorCount + 1);
						});
					return;
				}
			}
			else if (operation == "protect")
			{
				var isProtected = (clipData.flags & clip_flag_protect) > 0;
				if ((isProtected && !args.protectEnable) || (!isProtected && args.protectEnable))
				{
					self.ToggleClipProtect(clipData, function ()
					{
						Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast, errorCount);
					}, function ()
						{
							Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast, errorCount + 1);
						});
					return;
				}
			}
			else if (operation == "delete")
			{
				if (videoPlayer.Loading().image.uniqueId == clipData.recId)
				{
					self.CloseCurrentClip();
					setTimeout(function ()
					{
						bulkOperationInProgress = false; // This prevents error message if idx is 0
						Multi_Operation(operation, allSelectedClipIDs, args, idx, myToast, errorCount);
					}, 500);
					return;
				}
				DeleteAlert("@" + clipData.recId, clipData.isClip, function ()
				{
					Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast, errorCount);
				},
					function (message)
					{
						toaster.Warning(message, 10000);
						Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast, errorCount + 1);
					});
				return;
			}
		}
		else
		{
			console.log('Null clipData encountered (clip ID "' + allSelectedClipIDs[idx] + '")');
			errorCount++;
		}
		setTimeout(function ()
		{
			Multi_Operation(operation, allSelectedClipIDs, args, idx + 1, myToast, errorCount);
		}, 0);
	}
	var Multi_Operation_Stop = function (operation, myToast, totalItems, errorCount)
	{
		bulkOperationInProgress = false;
		if (myToast)
			myToast.remove();
		if (errorCount > 0)
		{
			if (totalItems == 1 && operation == "delete")
			{
				// Deletion errors are already reported, and since this was a single deletion, there is no reason to create another error toast.
			}
			else
				toaster.Error("Bulk " + operation + " operation failed on<br/> " + errorCount + " / " + totalItems + " items.", 15000);
		}
		if (totalItems - errorCount > 0)
		{
			if (operation == "delete")
			{
				// Some deletions were successful, so reload.
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
			return ClipTileCreateFromId(loadedClipIds[clipIdx + 1]);
		return null;
	}
	this.GetClipAboveClip = function ($clip)
	{
		var clipIdx = GetClipIndexFromClipId(GetClipIdFromClip($clip));
		if (clipIdx > 0 && clipIdx - 1 < loadedClipIds.length)
			return ClipTileCreateFromId(loadedClipIds[clipIdx - 1]);
		return null;
	}
	var GetClipIndexFromClipId = function (recId)
	{
		if (loadedClipIds == null || loadedClipIds.length == 0)
			return -1;
		for (var i = 0; i < loadedClipIds.length; i++)
		{
			if (loadedClipIds[i] == recId)
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
	lastClipTileSize = getClipTileSize();
	var tileLoader = new ClipListDynamicTileLoader(clipsBodySelector, DateTileOnBecomeCurrent);
	setInterval(self.UpdateClipList, 6000);
	BI_CustomEvent.AddListener("ClipList_Updated", ClipList_Updated);
	$clipsbody.on('scroll', ClipsBodyScroll);
}
///////////////////////////////////////////////////////////////
// Clip Res Parser ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipRes(res)
{
	this.width = 0;
	this.height = 0;
	this.valid = false;

	if (typeof res === "string" && res.length >= 3)
	{
		let idxX = res.indexOf('x');
		if (idxX > 0 && idxX + 1 < res.length)
		{
			this.width = parseInt(res.substr(0, idxX));
			this.height = parseInt(res.substr(idxX + 1));
			if (!isNaN(this.width) && !isNaN(this.height) && this.width > 0 && this.height > 0)
				this.valid = true;
		}
	}
}
///////////////////////////////////////////////////////////////
// Clip Thumbnail Video Preview ///////////////////////////////
///////////////////////////////////////////////////////////////
function ClipThumbnailVideoPreview_BruteForce()
{
	var self = this;
	var lastThumbLoadTime = -60000;
	var thumbVideoTimeout = null;
	var clipPreviewNumFrames = 8;
	var clipPreviewNumLoopsAllowed = 3;
	var clipThumbPlaybackActive = false;
	var clipPreviewStartTimeout = null;
	var queuedPreview = null;
	var lastItemId = null;

	this.Start = function ($clip, clipData, camName, frameNum, loopNum)
	{
		var duration = clipData.isClip ? clipData.msec : clipData.roughLengthMs;
		if (settings.ui3_clipPreviewEnabled != "1" || duration < 500)
			return;
		if (lastItemId != clipData.recId)
		{
			if (clipPreviewStartTimeout != null)
			{
				// A preview recently started. Schedule this to start later.
				queuedPreview = { clip: $clip, clipData: clipData, camName: camName };
				return;
			}
			clipPreviewStartTimeout = setTimeout(function ()
			{
				clipPreviewStartTimeout = null;
				if (queuedPreview)
				{
					self.Start(queuedPreview.clip, queuedPreview.clipData, queuedPreview.camName);
				}
			}, 500);
		}
		queuedPreview = null;
		if (!frameNum)
			frameNum = 0;
		if (!loopNum)
			loopNum = 0;

		// Throttle image loads to one per 200ms.
		var perfNow = performance.now();
		var timeWaited = perfNow - lastThumbLoadTime;
		var timeToWait = Clamp(200 - timeWaited, 0, 1000);
		if (timeToWait > 0)
		{
			clearTimeout(thumbVideoTimeout);
			thumbVideoTimeout = setTimeout(function ()
			{
				self.Start($clip, clipData, camName, frameNum, loopNum);
			}, timeToWait);
			return;
		}
		lastThumbLoadTime = perfNow;
		lastItemId = clipData.recId;
		var aspectRatio;
		var camData = cameraListLoader.GetCameraWithId(clipData.camera);
		if (camData && camData.height != 0)
			aspectRatio = camData.width / camData.height;
		else
			aspectRatio = 16 / 9;
		var expectedHeight = 240;
		var expectedWidth = expectedHeight * aspectRatio;
		clipThumbPlaybackActive = true;
		var timeValue = ((frameNum % clipPreviewNumFrames) / clipPreviewNumFrames) * duration;
		var thumbPath = currentServer.remoteBaseURL + "file/clips/" + clipData.thumbPath + '?time=' + timeValue + "&cache=1&h=" + expectedHeight + currentServer.GetRemoteSessionArg("&", true);
		var thumbLabel = camName + " " + GetTimeStr(new Date(clipData.displayDate.getTime() + timeValue));
		bigThumbHelper.Show($clip, $clip, thumbLabel, thumbPath, expectedWidth, expectedHeight, function ($img, userContext, success)
		{
			if (clipThumbPlaybackActive)
			{
				frameNum++;
				if (frameNum >= clipPreviewNumFrames)
				{
					frameNum = 0;
					loopNum++;
				}
				if (loopNum >= clipPreviewNumLoopsAllowed && performance.now() - lastThumbLoadTime > 40)
					return;

				self.Start($clip, clipData, camName, frameNum, loopNum);
			}
		}, null, true);
	}
	this.Stop = function ()
	{
		ClearTimeouts();
		clipThumbPlaybackActive = false;
		bigThumbHelper.Hide();
	}
	var ClearTimeouts = function ()
	{
		if (thumbVideoTimeout != null)
		{
			clearTimeout(thumbVideoTimeout);
			thumbVideoTimeout = null;
		}
		if (clipPreviewStartTimeout != null)
		{
			clearTimeout(clipPreviewStartTimeout);
			clipPreviewStartTimeout = null;
		}
	}
}
///////////////////////////////////////////////////////////////
// Asynchronous Image Downloading /////////////////////////////
///////////////////////////////////////////////////////////////
function AsyncClipThumbnailDownloader()
{
	var asyncThumbnailDownloader = new AsyncThumbnailDownloader(3, onLoad, onError, loadCondition);
	var fallbackImg = 'ui3/noimage.png';
	this.Stop = function ()
	{
		asyncThumbnailDownloader.Stop();
	}
	this.Enqueue = function (img, path)
	{
		asyncThumbnailDownloader.Enqueue(img, path);
	}
	this.Dequeue = function (img)
	{
		asyncThumbnailDownloader.Dequeue(img);
	}

	function onLoad(img)
	{
		var $img = $(img);
		$img.css("width", "auto");
		$img.css("height", "auto");
	}
	function onError(img)
	{
		var $img = $(img);
		$img.css("width", "auto");
		$img.css("height", "auto");
		$img.attr('src', fallbackImg);
	}
	function loadCondition(obj)
	{
		var src = obj.img.getAttribute('src');
		return !src || src.length == 0 || src == "ui3/LoadingImage.png" || (src != obj.path && src != fallbackImg);
	}
}
function AsyncPresetThumbnailDownloader(thumbLoaded, thumbError)
{
	var asyncThumbnailDownloader = new AsyncThumbnailDownloader(3, thumbLoaded, thumbError, loadCondition);

	this.Stop = function ()
	{
		asyncThumbnailDownloader.Stop();
	}
	this.Enqueue = function (img, path)
	{
		asyncThumbnailDownloader.Enqueue(img, path);
	}
	this.Dequeue = function (img)
	{
		asyncThumbnailDownloader.Dequeue(img);
	}
	function loadCondition(obj)
	{
		return true;
	}
}
function AsyncThumbnailDownloader(numThreads, onLoad, onError, loadCondition)
{
	var self = this;
	var asyncImageQueue = new Array();
	var currentlyLoadingImages = new Array();
	var stopImageQueue = false;
	numThreads = Clamp(numThreads, 1, 5);
	var loadTimeoutMs = 5000;

	this.Stop = function ()
	{
		stopImageQueue = true;
		asyncImageQueue = new Array();
		currentlyLoadingImages = new Array();
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
			if (loadCondition(obj))
			{
				var $img = $(obj.img);
				$img.bind("load.asyncimage", function ()
				{
					ImgNotLoading(obj.img);
					clearTimeout(obj.loadTimeout);
					$img.unbind("load.asyncimage error.asyncimage");
					if (onLoad)
						onLoad(obj.img);
					if (!obj.timedOut)
						AsyncDownloadQueuedImage();
				});
				$img.bind("error.asyncimage", function ()
				{
					ImgNotLoading(obj.img);
					clearTimeout(obj.loadTimeout);
					$img.unbind("load.asyncimage error.asyncimage");
					if (onError)
						onError(obj.img);
					if (!obj.timedOut)
						AsyncDownloadQueuedImage();
				});
				obj.loadTimeout = setTimeout(function ()
				{
					ImgNotLoading(obj.img);
					$img.unbind("load.asyncimage error.asyncimage");
					obj.timedOut = true; // This timeout occurs if the element is removed from the DOM before the load is completed.
					AsyncDownloadQueuedImage();
				}, loadTimeoutMs);
				currentlyLoadingImages.push(obj);
				$img.attr('src', obj.path);
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
		newObj.timedOut = false;
		asyncImageQueue.push(newObj);
	}
	var ImgNotLoading = function (img)
	{
		for (var i = 0; i < currentlyLoadingImages.length; i++)
		{
			if (currentlyLoadingImages[i].img == img)
			{
				currentlyLoadingImages.splice(i, 1);
				return;
			}
		}
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
		for (var i = 0; i < currentlyLoadingImages.length; i++)
		{
			if (currentlyLoadingImages[i].img == img)
			{
				clearTimeout(currentlyLoadingImages[i].loadTimeout);
				$(img).unbind("load.asyncimage error.asyncimage").attr('src', 'ui3/LoadingImage.png');
				currentlyLoadingImages.splice(i, 1);
				setTimeout(AsyncDownloadQueuedImage, 250);
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
		if (!self.AppearDisappearCheckEnabled || appearDisappearRegisteredObjects.length == 0 || currentPrimaryTab == "live")
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
	this.injectNewClips = function (newClips, ClipOnAppear, ClipOnDisappear, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx, DateTileOnAppear, DateTileOnDisappear)
	{
		for (var i = 0; i < newClips.length; i++)
		{
			if (newClips[i].isDateTile)
				prepareClipDataForRegistration(newClips[i], DateTileOnAppear, DateTileOnDisappear, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx);
			else
				prepareClipDataForRegistration(newClips[i], ClipOnAppear, ClipOnDisappear, callbackOnMoveFunc, HeightOfOneClipTilePx, HeightOfOneDateTilePx);
		}
		appearDisappearRegisteredObjects = newClips.concat(appearDisappearRegisteredObjects);
	}
	this.resizeClipList = function (HeightOfOneClipTilePx, HeightOfOneDateTilePx)
	{
		/// <summary>Calculates new positions for all clip and date tiles in the list. Should be called after UI resizes and after registering new objects.</summary>
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
	var lastStatusUpdateAt = performance.now() - 600000;
	var lastResponse = null;
	var currentProfileNames = null;
	var currentlySelectedSchedule = null;
	var globalScheduleEnabled = false;
	var profileChangedTimeout = null;
	var statusUpdateTimeout = null;
	var $profileBtns = $(".profilebtn");
	var $scheduleLockBtn = $("#schedule_lock_button");
	var $scheduleLockIcon = $("#schedule_lock_icon use");
	var $stoplightDiv = $("#stoplightBtn div");
	var $stoplightRed = $("#stoplightRed");
	var $stoplightGreen = $("#stoplightGreen");
	var $stoplightYellow = $("#stoplightYellow");
	var $profileStatusBox = $("#profileStatusBox");

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
		if (documentIsHidden())
		{
			if (browser_is_android || browser_is_ios || performance.now() - lastStatusUpdateAt < 45000)
			{
				statusUpdateTimeout = setTimeout(function ()
				{
					self.LoadStatus();
				}, updateDelay);
				return;
			}
		}
		var args = { cmd: "status" };
		if (typeof profileNum != "undefined" && profileNum != null)
		{
			if (sessionManager.IsAdministratorSession())
				args.profile = parseInt(profileNum);
			else
				openLoginDialog(function () { loadStatusInternal(profileNum, stoplightState, schedule); });
		}
		if (typeof stoplightState != "undefined" && stoplightState != null)
		{
			if (sessionManager.IsAdministratorSession())
				args.signal = parseInt(stoplightState);
			else
				openLoginDialog(function () { loadStatusInternal(profileNum, stoplightState, schedule); });
		}
		if (typeof schedule != "undefined" && schedule != null)
		{
			if (sessionManager.IsAdministratorSession())
				args.schedule = schedule;
			else
				openLoginDialog(function () { loadStatusInternal(profileNum, stoplightState, schedule); });
		}
		ExecJSON(args, function (response)
		{
			lastStatusUpdateAt = performance.now();
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
				$stoplightDiv.css("opacity", "");
				if (response.data.signal == "0")
					$stoplightRed.css("opacity", "1");
				else if (response.data.signal == "1")
					$stoplightGreen.css("opacity", "1");
				else if (response.data.signal == "2")
					$stoplightYellow.css("opacity", "1");

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
			var $selectedProfileBtn = $profileStatusBox.find('.profilebtn[profilenum="' + selectedProfile + '"]');
			$selectedProfileBtn.addClass("selected");
			$selectedProfileBtn.css("color", $selectedProfileBtn.attr("selColor"));
			if (lock == 0)
			{
				$scheduleLockBtn.removeClass("hold");
				$scheduleLockBtn.removeClass("temp");
				$scheduleLockIcon.attr("href", "#svg_x5F_RunProfile");
				$scheduleLockBtn.attr("title", 'Schedule "' + schedule + '" is active. Click to disable automatic scheduling.');
			}
			else if (lock == 1)
			{
				$scheduleLockBtn.addClass("hold");
				$scheduleLockBtn.removeClass("temp");
				$scheduleLockIcon.attr("href", "#svg_x5F_HoldProfile");
				$scheduleLockBtn.attr("title", 'Schedule "' + schedule + '" is currently disabled. Click to re-enable.');
			}
			else if (lock == 2)
			{
				$scheduleLockBtn.removeClass("hold");
				$scheduleLockBtn.addClass("temp");
				$scheduleLockIcon.attr("href", "#svg_x5F_TempProfile");
				$scheduleLockBtn.attr("title", 'Schedule "' + schedule + '" is temporarily overridden. Click to resume schedule, or wait some hours and it should return to normal.');
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
				$profileStatusBox.find('.profilebtn[profilenum="' + i + '"]').attr("title", tooltipText);
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
	var currentDialog = null;
	this.open = function (disks)
	{
		self.close();
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
			$legend.append(CreateLegendItem('#0065AA', 'Used by recordings'));
			$legend.append(CreateLegendItem('#0097F0', 'Allocated free space'));
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
		currentDialog = $dud.dialog({
			title: "Disk Usage",
			onClosing: function () { currentDialog = null; }
		});
	}
	this.close = function ()
	{
		if (currentDialog)
		{
			currentDialog.close();
			currentDialog = null;
		}
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
					, [bi_used, '#0065AA']
					, [disk_freeSpace, '#0097F0'] // Unused available allocation
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
					, [bi_used, '#0065AA']
					, [bi_free, '#0097F0']
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
	var permission_ptz = true;
	var permission_audio = true;
	var permission_clips = true;
	var biSoundOptions = ["None"];
	this.supportedHTML5AudioFormats = [".mp3", ".wav"]; // File extensions, in order of preference
	this.Initialize = function ()
	{
		// Called once during page initialization
		if (currentServer.isUsingRemoteServer)
		{
			LogInWithCredentials(currentServer.remoteServerUser, currentServer.remoteServerPass, function (failResponse, errorMessage)
			{
				// The login failed
				loadingHelper.SetErrorStatus("login", 'UI3 was unable to log in to the remote server. ' + errorMessage);
			}, true);
		}
		else
		{
			// First, check the current session status
			var oldSession = self.GetSession();
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
									LogInWithCredentials(user, pass, function (failResponse, errorMessage)
									{
										// The login failed
										toaster.Error(errorMessage, 3000);
										self.HandleSuccessfulLogin(response, true); // Session is valid
									}, true);
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
			}, function (jqXHR, textStatus, errorThrown)
				{
					loadingHelper.SetErrorStatus("login", 'Error contacting Blue Iris server to check session status.<br/>' + jqXHR.ErrorMessageHtml);
				});
		}
	}
	var LogInWithCredentials = function (user, pass, onFail, isAutomatic)
	{
		var oldSession = self.GetSession();
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
						self.HandleSuccessfulLogin(response, isAutomatic);
						setTimeout(function () { logoutOldSession(oldSession); }, 1000);
					}
					else
					{
						settings.bi_username = "";
						settings.bi_password = "";
						onFail(response, 'Failed to log in. ' + GetFailReason(response));
					}
				}, function (jqXHR, textStatus, errorThrown)
					{
						onFail(null, 'Error contacting Blue Iris server during login phase 2.<br/>' + jqXHR.ErrorMessageHtml);
					});
			}
			else
				onFail(response, 'Failed to log in. ' + GetFailReason(response));
		}, function (jqXHR, textStatus, errorThrown)
			{
				onFail(null, 'Error contacting Blue Iris server during login phase 1.<br/>' + jqXHR.ErrorMessageHtml);
			});
	}
	var GetFailReason = function (response)
	{
		if (response)
			return response.data && response.data.reason ? " " + response.data.reason : JSON.stringify(response);
		else
			return "null response";
	}
	this.HandleSuccessfulLogin = function (response, wasAutomatic)
	{
		lastResponse = response;
		var user = response && response.data && response.data.user ? response.data.user : "";
		loadingHelper.SetLoadedStatus("login");
		latestAPISession = lastResponse.session;
		self.ApplyLatestAPISessionIfNecessary();

		$("#systemname").text(lastResponse.data["system name"]);
		if (lastResponse.data && lastResponse.data.profiles && lastResponse.data.profiles.length > 0)
			statusLoader.SetCurrentProfileNames(lastResponse.data.profiles);
		if (lastResponse && lastResponse.data && lastResponse.data.schedules)
			dropdownBoxes.listDefs["schedule"].rebuildItems();

		if (typeof lastResponse.data.tzone != "undefined")
			serverTimeZoneOffsetMs = parseInt(parseFloat(lastResponse.data.tzone) * -60000);

		permission_ptz = getBoolMaybe(lastResponse.data.ptz, true);
		permission_audio = getBoolMaybe(lastResponse.data.audio, true);
		permission_clips = getBoolMaybe(lastResponse.data.clips, true);

		HandleUpdatedPermissions();

		statusLoader.LoadStatus();
		cameraListLoader.LoadCameraList();

		if (lastResponse.data.streamtimelimit)
		{
			toaster.Info('This user account has time limits enabled.<br/><ul>'
				+ '<li>Video streams may be interrupted periodically.</li>'
				+ '<li>Your session may expire after some time, even if you are not idle.</li>'
				+ '<li>You may have to wait some minutes between sessions.</li>'
				+ '<li>You may have a daily limit of viewing time.</li>'
				+ '<ul>', 60000, true);
		}

		if (lastResponse.data.admin)
		{
			isAdministratorSession = true;
			if (user == "")
				user = "administrator";
			if (typeof adminLoginCallbackSuccess == "function")
			{
				adminLoginCallbackSuccess(lastResponse);
				adminLoginCallbackSuccess = null;
			}
			closeLoginDialog();
		}
		else
		{
			isAdministratorSession = false;
			if (user == "")
				user = "user";
		}
		if (!wasAutomatic || settings.ui3_show_session_success == "1")
		{
			var message = 'Logged in as ' + htmlEncode(user) + '<br/>(' + (isAdministratorSession ? "Administrator" : "Limited User") + ')<br/><br/>Server "' + lastResponse.data["system name"] + '"<br/>UI3 version: ' + ui_version + '<br>Blue Iris version: ' + lastResponse.data.version;
			if (isAdministratorSession)
				toaster.Success(message);
			else
				toaster.Info(message);
		}
		if (lastResponse.data.version)
			$("#bi_version_label").text(lastResponse.data.version);

		ProcessSoundsArray();

		BI_CustomEvent.Invoke("Login Success", response);
	}
	var ProcessSoundsArray = function ()
	{
		biSoundOptions = ["None"];
		// Find the best format of each sound.
		var formats = new Object(); // This object maps file names without extensions to the best format available.
		if (lastResponse && lastResponse.data)
		{
			var soundsArr = lastResponse.data.www_sounds;
			if (!soundsArr)
				soundsArr = lastResponse.data["www-sounds"];
			if (!soundsArr)
				soundsArr = lastResponse.data.sounds;
			if (soundsArr)
			{
				for (var i = 0; i < soundsArr.length; i++)
				{
					var file = soundsArr[i];
					// Determine the format of this file.
					for (var f = 0; f < self.supportedHTML5AudioFormats.length; f++)
					{
						var ext = self.supportedHTML5AudioFormats[f];
						if (file.endsWithCaseInsensitive(ext))
						{
							// This file is one of our supported formats.
							var nameNoExt = file.substr(0, file.length - ext.length)

							var previousFormat = formats[nameNoExt];
							if (previousFormat && previousFormat.priority < i)
								continue; // Already found a better format.

							// The format is an improvement over the last one we found (or this is the first we found).
							formats[nameNoExt] = {
								ext: ext
								, priority: i
								, fullName: file
							};
							break;
						}
					}
				}
				var choices = new Array(); // This array is used for ordering
				for (var nameNoExt in formats)
					choices.push(formats[nameNoExt].fullName);
				choices.sort();

				for (var i = 0; i < choices.length; i++)
					biSoundOptions.push(choices[i]);
			}
		}
	}
	var getBoolMaybe = function (boolMaybe, defaultValue)
	{
		if (typeof boolMaybe == "undefined")
			return defaultValue;
		return boolMaybe ? true : false;
	}
	var HandleUpdatedPermissions = function ()
	{
		if (permission_ptz)
			$("#ptzControlsBox").show();
		else
			$("#ptzControlsBox").hide();

		if (permission_audio)
			$("#volumeBar").removeClass("audioNoPermission");
		else
			$("#volumeBar").addClass("audioNoPermission");

		if (permission_clips)
		{
			$("#topbar_tab_alerts,#topbar_tab_clips").show();
		}
		else
		{
			$("#topbar_tab_alerts,#topbar_tab_clips").hide();
			if (currentPrimaryTab != "live")
				$("#topbar_tab_live").click();
		}
	}
	this.ApplyLatestAPISessionIfNecessary = function ()
	{
		if (latestAPISession == null || currentServer.isUsingRemoteServer)
			return;
		if (self.GetSession() != latestAPISession)
		{
			// If this happens a lot, usually the cause is another window with a web UI open that has a different latestAPISession value
			bilog.verbose("SessionManager changing session from " + self.GetSession() + " to " + latestAPISession);
			this.SetSession(latestAPISession);
		}
	}
	this.GetSession = function ()
	{
		return currentServer.isUsingRemoteServer ? latestAPISession : $.cookie("session");
	}
	this.SetSession = function (session)
	{
		if (currentServer.isUsingRemoteServer)
			latestAPISession = session;
		else
			$.cookie("session", session, { path: "/" });
	}
	this.GetAPISession = function ()
	{
		return latestAPISession;
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
		LogInWithCredentials($('#loginDialog input[type="text"][varname="user"]').val(), $('#loginDialog input[type="password"][varname="pass"]').val(),
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
	this.GetStreamsArray = function ()
	{
		if (lastResponse && lastResponse.data && lastResponse.data.streams && lastResponse.data.streams.length == 3)
			return lastResponse.data.streams;
		return ["", "", ""];
	}
	this.HasPermission_Ptz = function ()
	{
		return permission_ptz;
	}
	this.HasPermission_Audio = function ()
	{
		return permission_audio;
	}
	this.HasPermission_Clips = function ()
	{
		return permission_clips;
	}
	this.GetBISoundOptions = function ()
	{
		return biSoundOptions;
	}
}
function getBISoundOptions()
{
	return sessionManager.GetBISoundOptions();
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
	var cameraListUpdateTimeout = null;
	var webcastingWarning;
	this.LoadCameraList = function (successCallbackFunc)
	{
		if (cameraListUpdateTimeout != null)
			clearTimeout(cameraListUpdateTimeout);
		if (documentIsHidden() && lastResponse !== null && typeof successCallbackFunc !== "function")
		{
			cameraListUpdateTimeout = setTimeout(function ()
			{
				self.LoadCameraList();
			}, 5000);
			return;
		}
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
			var numGroups = 0;
			var numCameras = 0;
			var camIdsInGroups = {};
			// See what we've got.
			for (var i = 0; i < lastResponse.data.length; i++)
			{
				var obj = lastResponse.data[i];
				if (obj.group)
				{
					numGroups++;
					for (var n = 0; n < obj.group.length; n++)
						camIdsInGroups[obj.group[n]] = true;
				}
				else
					numCameras++;
			}
			// Are any of the cameras not in a group?
			var camsNotInGroup = [];
			for (var i = 0; i < lastResponse.data.length; i++)
			{
				var obj = lastResponse.data[i];
				if (!self.CameraIsGroupOrCycle(obj) && obj.isEnabled)
				{
					if (!camIdsInGroups[obj.optionValue])
						camsNotInGroup.push(obj);
				}
			}
			if (camsNotInGroup.length > 0)
			{
				// Create a fake group for each of these cameras.
				for (var i = 0; i < camsNotInGroup.length; i++)
				{
					var fakeGroup = MakeFakeGroup(camsNotInGroup[i]);
					lastResponse.data.push(fakeGroup);
				}

				if (!firstCameraListLoaded && numCameras > 1 && settings.ui3_webcasting_disabled_dontShowAgain != "1")
				{
					webcastingWarning = toaster.Info('Webcasting may not be enabled for some of your camera groups.<br><br>'
						+ camsNotInGroup.length + ' camera' + (camsNotInGroup.length == 1 ? ' has' : 's have')
						+ ' been individually added to the Current Group dropdown list.<br><br>'
						+ '<input type="button" class="simpleTextButton btnGreen" value="Learn more" onclick="UIHelp.LearnMore(\'Camera Group Webcasting\')" /><br><br>'
						+ '<input type="button" class="simpleTextButton btnRed" value="Do not warn again" onclick="DontShowWebcastingWarningAgain()" />'
						, 60000, true);
				}
			}

			dropdownBoxes.listDefs["currentGroup"].rebuildItems(lastResponse.data);
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
	var MakeFakeGroup = function (cameraObj)
	{
		return $.extend({}, cameraObj, {
			optionDisplay: "+" + cameraObj.optionDisplay
			, xsize: 1
			, ysize: 1
			, group: []
			, rects: []
			, isFakeGroup: true
		});
	}
	this.HideWebcastingWarning = function ()
	{
		if (webcastingWarning)
			webcastingWarning.remove();
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
	this.GetGroupAndCycleList = function ()
	{
		var arr = new Array();
		if (lastResponse && lastResponse.data)
		{
			for (var i = 0; i < lastResponse.data.length; i++)
			{
				if (self.CameraIsGroupOrCycle(lastResponse.data[i]))
				{
					arr.push(lastResponse.data[i]);
				}
			}
		}
		return arr;
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
	this.CameraIsAlone = function (cameraObj)
	{
		return cameraObj.isFakeGroup || !self.CameraIsGroupOrCycle(cameraObj);
	}
	this.GetLastResponse = function ()
	{
		return lastResponse;
	}
}
function DontShowWebcastingWarningAgain()
{
	settings.ui3_webcasting_disabled_dontShowAgain = "1";
	cameraListLoader.HideWebcastingWarning();
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

	var playerModule = null;
	var moduleHolder = {};

	var currentlyLoadingCamera = null;
	var currentlyLoadedCamera = null;
	var currentlyLoadingImage = new BICameraData();
	var currentlyLoadedImage = new BICameraData();

	var lastLiveCameraOrGroupId = "";
	var currentlySelectedHomeGroupId = null;
	var $layoutbody = $("#layoutbody");
	var $camimg_wrapper = $("#camimg_wrapper");

	var mouseHelper = null;

	this.suppressMouseHelper = function (invalidateNextEvent)
	{
		/// <summary>Call this from mouse or touch events that conflict with the VideoPlayer's double-click helper, and past events will no longer count toward new clicks or drags.</summary>
		if (mouseHelper)
			mouseHelper.Invalidate(invalidateNextEvent);
	}

	this.getDoubleClickTime = function ()
	{
		return mouseHelper.getDoubleClickTime();
	}

	this.CurrentPlayerModuleName = function ()
	{
		if (playerModule === moduleHolder["jpeg"])
			return "jpeg";
		else if (playerModule === moduleHolder["h264"])
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
			if (playerModule === moduleHolder[moduleName])
				return;
			position = playerModule.GetSeekPercent();
			paused = playerModule.Playback_IsPaused();
			playerModule.Deactivate();
		}

		if (moduleName === "jpeg")
		{
			playerModule = moduleHolder[moduleName];
		}
		else if (moduleName === "h264")
		{
			playerModule = moduleHolder[moduleName];
		}
		else
			toaster.Error("Video Player was asked to load unexpected module \"" + moduleName + "\".", 30000);

		if (!playerModule)
			toaster.Error("Video Player was asked to load module \"" + moduleName + "\" which does not exist.", 30000);
		else if (refreshVideoNow)
			playerModule.OpenVideo(currentlyLoadingImage, position, paused);
	}
	this.RefreshVideoStream = function ()
	{
		if (playerModule)
			playerModule.OpenVideo(currentlyLoadingImage, playerModule.GetSeekPercent(), playerModule.Playback_IsPaused());
	}
	this.PreLoadPlayerModules = function ()
	{
		if (!moduleHolder["jpeg"])
			moduleHolder["jpeg"] = new JpegVideoModule();
		if (h264_playback_supported)
		{
			if (!moduleHolder["h264"])
				moduleHolder["h264"] = new FetchH264VideoModule();
		}
		else
			$("#loadingH264").parent().hide();
	}

	this.Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;

		self.PreLoadPlayerModules();
		self.SetPlayerModule(genericQualityHelper.GetCurrentProfile().vcodec, true);

		var visProp = getHiddenProp();
		if (visProp)
		{
			var evtname = visProp.replace(/[H|h]idden/, '') + 'visibilitychange';
			document.addEventListener(evtname, function ()
			{
				// Called when page visibility changes.
				var visibleNow = !documentIsHidden();
				if (moduleHolder["jpeg"])
					moduleHolder["jpeg"].VisibilityChanged(visibleNow);
				if (moduleHolder["h264"])
					moduleHolder["h264"].VisibilityChanged(visibleNow);
			});
		}
		mouseHelper = new MouseEventHelper($("#layoutbody,#zoomhint")
			, $("#playbackHeader,#playbackControls") // Excludes clicks while viewing recordings
			, $("#playbackControls .pcButton,#volumeBar,#closeClipLeft") // Excludes clicks while viewing live and excludes dragging always
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
		if (settings.ui3_doubleClick_behavior === "Both")
			return true;
		if (currentlyLoadingImage.isLive)
			return settings.ui3_doubleClick_behavior === "Live View"
		else
			return settings.ui3_doubleClick_behavior === "Recordings"
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
	this.GetExpectedFrameIntervalOfCurrentCamera = function ()
	{
		if (typeof currentlyLoadingCamera.FPS === "number")
			return 1000 / currentlyLoadingCamera.FPS;
		else
			return 100;
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
	this.GetClipPlaybackPositionMs = function ()
	{
		if (currentlyLoadingImage.isLive)
			return 0;
		return playerModule.GetClipPlaybackPositionMs();
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

		var imgPos = $camimg_wrapper.position();
		var layoutbodyOffset = $layoutbody.offset();
		var mouseRelX = parseFloat((event.pageX - layoutbodyOffset.left) - imgPos.left) / imageRenderer.GetPreviousImageDrawInfo().w;
		var mouseRelY = parseFloat((event.pageY - layoutbodyOffset.top) - imgPos.top) / imageRenderer.GetPreviousImageDrawInfo().h;

		var x = currentlyLoadedImage.fullwidth * mouseRelX;
		var y = currentlyLoadedImage.fullheight * mouseRelY;
		var camData = currentlyLoadedCamera;
		if (camData)
		{
			if (camData.group && camData.rects.length > 0)
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
		if (camData != null && !camData.isFakeGroup && !cameraListLoader.CameraIsCycle(camData))
		{
			thing(camData);
		}
	}
	var ImgClick = function (event)
	{
		DoThingIfImgClickEligible(event, self.ImgClick_Camera);
	}
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
				self.CameraOrResolutionChange();
		}
		else
		{
			// Maximize
			if (playerModule.DrawThumbAsFullCamera)
				playerModule.DrawThumbAsFullCamera(camData.optionValue);
			self.LoadLiveCamera(camData);
			if (playerModule.DrawThumbAsFullCamera)
				self.CameraOrResolutionChange();
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
		imageRenderer.zoomHandler.ZoomToFit();
		var cli = currentlyLoadingImage;
		var clc = currentlyLoadingCamera = camData;
		cli.id = clc.optionValue;
		cli.fullwidth = cli.actualwidth = clc.width;
		cli.fullheight = cli.actualheight = clc.height;
		cli.aspectratio = clc.width / clc.height;
		cli.path = clc.optionValue;
		cli.uniqueId = clc.optionValue;
		cli.isLive = true;
		cli.ptz = clc.ptz;
		cli.audio = clc.audio;
		cli.msec = -1;
		cli.isGroup = clc.group ? true : false;

		lastLiveCameraOrGroupId = clc.optionValue;

		playbackControls.Live();
		ptzButtons.UpdatePtzControlDisplayState();
		dropdownBoxes.setLabelText("currentGroup", CleanUpGroupName(clc.optionDisplay));

		clipLoader.LoadClips(); // This method does nothing if not on the clips/alerts tabs.

		videoOverlayHelper.ShowLoadingOverlay(true);
		if (playerModule)
			playerModule.OpenVideo(cli, 0, false);

		fullScreenModeController.updateFullScreenButtonState();
	}
	this.LoadClip = function (clipData)
	{
		var cam = cameraListLoader.GetCameraWithId(clipData.camera);
		if (cam)
		{
			imageRenderer.zoomHandler.ZoomToFit();
			var cli = currentlyLoadingImage;
			var clc = currentlyLoadingCamera = cam;
			cli.id = clc.optionValue;
			cli.fullwidth = cli.actualwidth = clc.width;
			cli.fullheight = cli.actualheight = clc.height;
			var clipRes = new ClipRes(clipData.res);
			if (clipRes.valid)
			{
				cli.fullwidth = clipRes.width;
				cli.fullheight = clipRes.height;
			}
			cli.aspectratio = clc.width / clc.height;
			cli.path = clipData.path;
			cli.uniqueId = clipData.recId;
			cli.isLive = false;
			cli.ptz = false;
			cli.audio = clipData.audio || (!clipData.isClip && cli.audio); // Alerts never have the audio flag set.
			cli.msec = parseInt(clipData.msec);
			cli.isGroup = false;

			playbackHeader.SetClipName(clipData);
			playbackControls.Recording(clipData);
			if (clipLoader.ClipDataIndicatesFlagged(clipData))
				$("#clipFlagButton").addClass("flagged");
			else
				$("#clipFlagButton").removeClass("flagged");
			seekBar.drawSeekbarAtPercent(0);
			seekBar.resetSeekHintImg();

			videoOverlayHelper.ShowLoadingOverlay(true);
			if (playerModule)
				playerModule.OpenVideo(cli, -1, false);
		}
		else
			toaster.Error("Could not find camera " + htmlEncode(clipData.camera) + " associated with clip.");

		fullScreenModeController.updateFullScreenButtonState();
	}

	this.SeekToPercent = function (pos, play)
	{
		pos = Clamp(pos, 0, 1);
		seekBar.drawSeekbarAtPercent(pos);
		playerModule.OpenVideo(currentlyLoadingImage, pos, !play);
	}
	this.SeekByMs = function (offset, play)
	{
		var msLength = currentlyLoadingImage.msec - 1;
		if (msLength <= 0)
			return;
		var currentMs = playerModule.GetSeekPercent() * msLength;
		var newPos = (currentMs + offset) / msLength;
		newPos = Clamp(newPos, 0, 1);
		if (typeof play == "undefined")
			play = !playerModule.Playback_IsPaused();
		self.SeekToPercent(newPos, play);
	}
	this.AudioToggleNotify = function (audioEnabled)
	{
		if (playerModule && typeof playerModule.AudioToggleNotify == "function")
			playerModule.AudioToggleNotify(audioEnabled);
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
		var requiredPlayer = genericQualityHelper.GetCurrentProfile().vcodec;
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
	this.NotifyClipMetadataChanged = function (clipData)
	{
		// <summary>Tells the video player about a clip's new duration.  As of BI 4.6.5.2, this currently should not be called as it will make UI3 and Blue Iris disagree about the clip duration.</summary>
		if (videoPlayer.Loading().image.uniqueId == clipData.recId && typeof playerModule.NotifyClipMetadataChanged == "function")
			playerModule.NotifyClipMetadataChanged(clipData);
	}
	// Callback methods for a player module to inform the VideoPlayerController of state changes.
	this.CameraOrResolutionChange = function ()
	{
		imageRenderer.zoomHandler.ZoomToFit();
		currentlyLoadedImage.CopyValuesFrom(currentlyLoadingImage);
		currentlyLoadedCamera = currentlyLoadingCamera;
		resized();
	}
	var lastCycleWidth = 0;
	var lastCycleHeight = 0;
	this.ImageRendered = function (uniqueId, width, height, lastFrameLoadingTime, lastFrameDate)
	{
		jpegPreviewModule.Hide();
		if (currentlyLoadedImage.uniqueId != uniqueId)
			self.CameraOrResolutionChange();
		else if (currentlyLoadingImage.isLive && uniqueId.startsWith("@"))
		{
			if (lastCycleWidth != width || lastCycleHeight != height)
			{
				lastCycleWidth = width;
				lastCycleHeight = height;
				currentlyLoadedImage.aspectratio = lastCycleWidth / lastCycleHeight;
				resized();
			}
		}
		else
		{
			lastCycleWidth = lastCycleHeight = 0;
		}

		var imageSizeIsChanging = currentlyLoadedImage.actualwidth !== width || currentlyLoadedImage.actualheight !== height;

		// actualwidth and actualheight must be set after [CameraOrResolutionChange]
		currentlyLoadedImage.actualwidth = width;
		currentlyLoadedImage.actualheight = height;

		if (imageSizeIsChanging)
			imageRenderer.ImgResized(false);

		RefreshFps(lastFrameLoadingTime);

		if (currentlyLoadingImage.isLive && lastFrameDate)
		{
			var str = "";
			var w = $layoutbody.width();
			if (w < 240)
				str = "LIVE";
			else if (w < 325)
				str = "LIVE: " + GetTimeStr(GetServerDate(lastFrameDate));
			else
				str = "LIVE: " + GetDateStr(GetServerDate(lastFrameDate));
			playbackControls.SetProgressText(str);
		}

		if (currentlyLoadingImage.uniqueId != uniqueId)
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
					self.SeekToPercent(1, true);
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
					self.SeekToPercent(0, true);
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
	this.fullwidth = 1280; // Native resolution of image; used when calculating with group rects and as a base for digital zoom
	this.fullheight = 720;
	this.aspectratio = 1280 / 720;
	this.actualwidth = 1280; // Actual size of image (can be smaller than fullwidth)
	this.actualheight = 720;
	this.path = "";
	this.uniqueId = "";
	this.isLive = true;
	this.ptz = false;
	this.msec = 10000; // Millisecond duration of clips/alerts.  Ignore this if isLive is set.
	this.isGroup = false;
	this.audio = false;

	this.CopyValuesFrom = function (other)
	{
		self.id = other.id;
		self.fullwidth = other.fullwidth;
		self.fullheight = other.fullheight;
		self.aspectratio = other.aspectratio;
		self.actualwidth = other.actualwidth;
		self.actualheight = other.actualheight;
		self.path = other.path;
		self.uniqueId = other.uniqueId;
		self.isLive = other.isLive;
		self.ptz = other.ptz;
		self.msec = other.msec;
		self.isGroup = other.isGroup;
		self.audio = other.audio;
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
	var $camimg_wrapper = $("#camimg_wrapper");
	var $camimg_store = $("#camimg_store");
	var $camimg_preview = $('<canvas id="camimg_preview" class="videoCanvas"></canvas>');
	var camimg_preview_ele = $camimg_preview.get(0);
	var Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;
		$camimg_store.append($camimg_preview);
		$myImgEle = $('<img crossOrigin="Anonymous" id="jpegPreview_img" alt="" style="display: none;" />');
		var myImgEle_ele = $myImgEle.get(0);
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
				videoPlayer.ImageRendered(img.myUniqueId, img.naturalWidth, img.naturalHeight, performance.now() - img.startTime, false);
				// Rendering the image shows the jpegPreviewModule again.
				self.RenderImage(myImgEle_ele);
			}
		});
		$myImgEle.error(function ()
		{
			console.log('Bad image assigned to #jpegPreview_img.');
		});
		$camimg_store.append($myImgEle);
	}
	var Show = function ()
	{
		if (isVisible)
			return;
		Initialize();
		isVisible = true;
		$camimg_preview.appendTo($camimg_wrapper);
	}
	this.Hide = function ()
	{
		if (!isVisible)
			return;
		Initialize();
		isVisible = false;
		$camimg_preview.appendTo($camimg_store);
	}
	this.RenderImage = function (imgEle)
	{
		Initialize();
		CopyImageToCanvas(imgEle, camimg_preview_ele);
		Show();
		videoOverlayHelper.HideLoadingOverlay();
		playbackControls.FrameTimestampUpdated(false);
	}
	this.RenderDataURI = function (startTime, uniqueId, dataUri)
	{
		Initialize();
		var img = $("#jpegPreview_img").get(0);
		img.startTime = startTime;
		img.myUniqueId = uniqueId;
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
	var lastRequestedWidth = 0;
	var lastLoadedTimeValue = -1;

	var currentImageTimestampMs = new Date().getTime();
	var currentImageRequestedAtMs = new Date().getTime();
	var staticSnapshotId = "";
	var lastSnapshotUrl = "";
	var lastSnapshotFullUrl = "";
	var honorAlertOffset = false;

	var playbackPaused = false;

	var clipPlaybackPosition = 0; // milliseconds

	var loading = new BICameraData();

	var $layoutbody = $("#layoutbody");
	var $camimg_wrapper = $("#camimg_wrapper");
	var $camimg_store = $("#camimg_store");
	var $camimg_canvas;
	var camimg_canvas_ele;
	var backbuffer_canvas;

	var Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;
		// Do one-time initialization here
		$camimg_canvas = $('<canvas id="camimg_canvas" class="videoCanvas"></canvas>');
		camimg_canvas_ele = $camimg_canvas.get(0);
		var camObj = $('<img crossOrigin="Anonymous" id="camimg" src="" alt="" style="display: none;" />');
		var $backbuffer_canvas = $('<canvas id="backbuffer_canvas" style="display: none;"></canvas>');
		backbuffer_canvas = $backbuffer_canvas.get(0);
		$camimg_store.append($camimg_canvas);
		$camimg_store.append(camObj);
		$camimg_store.append($backbuffer_canvas);

		var camimg_ele = camObj.get(0);
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
				videoPlayer.ImageRendered(loading.uniqueId, this.naturalWidth, this.naturalHeight, msLoadingTime, new Date(currentImageRequestedAtMs));

				playbackControls.FrameTimestampUpdated(false);

				CopyImageToCanvas(camimg_ele, camimg_canvas_ele);

				if (nerdStats.IsOpen())
				{
					var loaded = videoPlayer.Loaded().image;
					nerdStats.BeginUpdate();
					nerdStats.UpdateStat("Viewport", $layoutbody.width() + "x" + $layoutbody.height());
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
		ClearCanvas(camimg_canvas_ele);
		videoOverlayHelper.ShowLoadingOverlay(true);
		$camimg_canvas.appendTo($camimg_wrapper);
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
		$camimg_canvas.appendTo($camimg_store);
	}
	this.VisibilityChanged = function (visible)
	{
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
		if (developerMode)
			console.log("jpeg.OpenVideo");
		loading.CopyValuesFrom(videoData);
		honorAlertOffset = offsetPercent === -1;
		if (!offsetPercent)
			offsetPercent = 0;
		if (loading.isLive)
			startPaused = false;
		Activate();
		if (playbackControls.GetPlayReverse() && offsetPercent === 0)
			offsetPercent = 1;
		clipPlaybackPosition = Clamp(offsetPercent, 0, 1) * (loading.msec - 1);
		timeLastClipFrame = Date.now();
		if (startPaused)
			self.Playback_Pause();
		else
			self.Playback_Play();
		videoOverlayHelper.ShowLoadingOverlay(true);
		var clipData = clipLoader.GetClipFromId(loading.uniqueId);
		if (clipData && !clipData.isSnapshot && !clipData.isClip)
		{
			if (honorAlertOffset && (clipData.flags & alert_flag_offsetMs) == 0)
				toaster.Warning("Blue Iris did not provide an offset in milliseconds for this alert, so it may begin at the wrong position.", 10000);
			// Load clip stats for this alert.
			clipStatsLoader.LoadClipStats("@" + clipData.clipId, function (stats)
			{
				clipLoader.ApplyMissingStatsToClipData(stats, clipData);
				if (loading.uniqueId == clipData.recId)
					loading.msec = stats.msec;
				var loadingImg = videoPlayer.Loading().image;
				if (loadingImg.uniqueId == clipData.recId)
					loadingImg.msec = stats.msec;
			});
		}
		GetNewImage();
		BI_CustomEvent.Invoke("OpenVideo", loading);
	}
	this.GetSeekPercent = function ()
	{
		var lastMs = loading.msec - 1;
		if (lastMs === 0)
			return 0;
		else
			return Clamp(clipPlaybackPosition / lastMs, 0, 1);
	}
	this.GetLastSnapshotUrl = function ()
	{
		return lastSnapshotUrl;
	}
	this.GetLastSnapshotFullUrl = function ()
	{
		return lastSnapshotFullUrl;
	}
	this.GetClipPlaybackPositionMs = function ()
	{
		return clipPlaybackPosition.dropDecimals();
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
		var isVisible = !documentIsHidden();
		if (!loading.isLive)
		{
			var timePassed = timeValue - timeLastClipFrame;
			timeLastClipFrame = timeValue.toFixed(0);
			var speedMultiplier = playbackControls.GetPlaybackSpeed();
			timePassed *= speedMultiplier;
			if (playbackPaused || playbackControls.IsSeekbarDragging() || !isVisible)
				timePassed = 0;
			else if (playbackControls.GetPlayReverse())
				timePassed *= -1;
			clipPlaybackPosition += timePassed;

			var clipData = clipLoader.GetClipFromId(loading.uniqueId);
			if (honorAlertOffset && clipData != null)
			{
				clipPlaybackPosition = clipData.offsetMs; // This offset is where the alert begins within the clip.
				if (playbackControls.GetPlayReverse()) // If playing in reverse, lets start at the end of the alert's bounds.
					clipPlaybackPosition += clipData.roughLengthMs;
			}
			honorAlertOffset = false;

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
			if (clipData != null)
			{
				currentImageTimestampMs = (clipData.date.getTime() - clipData.offsetMs) + clipPlaybackPosition;
				isLoadingRecordedSnapshot = clipData.isSnapshot;
				if (isLoadingRecordedSnapshot)
					staticSnapshotId = loading.uniqueId;
				else
					staticSnapshotId = "";
			}
		}

		var widthToRequest = imageRenderer.GetSizeToRequest(true).w;
		$("#camimg").attr('loadingimg', loading.id);

		var qualityArg = genericQualityHelper.GetCurrentProfile().GetUrlArgs(loading.fullwidth, loading.fullheight);

		if (loading.isLive)
			lastSnapshotUrl = currentServer.remoteBaseURL + "image/" + loading.path + '?time=' + timeValue.dropDecimalsStr() + currentServer.GetRemoteSessionArg("&", true);
		else
			lastSnapshotUrl = currentServer.remoteBaseURL + "file/clips/" + loading.path + '?time=' + timeValue.dropDecimalsStr() + currentServer.GetRemoteSessionArg("&", true);
		var imgSrcPath = lastSnapshotFullUrl = lastSnapshotUrl + "&w=" + widthToRequest + qualityArg;

		if ($("#camimg").attr('src') == imgSrcPath)
		{
			videoOverlayHelper.HideLoadingOverlay();
			GetNewImageAfterTimeout();
		}
		else
		{
			if ((lastLoadedTimeValue == timeValue
				&& loading.uniqueId == videoPlayer.Loaded().image.uniqueId
				&& !CouldBenefitFromWidthChange(widthToRequest)
				&& loadedFirstFrame)
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
				lastLoadedTimeValue = timeValue;
				$("#camimg").attr('src', imgSrcPath);
			}
		}
	}
	var CouldBenefitFromWidthChange = function (newWidth)
	{
		return newWidth > lastRequestedWidth && loading.fullwidth > lastRequestedWidth;
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
	this.NotifyClipMetadataChanged = function (clipData)
	{
		loading.msec = clipData.msec;
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

		backbuffer_canvas.width = groupObj.width;
		backbuffer_canvas.height = groupObj.height;
		FitRectangleIntoCanvas(thumbBounds, backbuffer_canvas);

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
		var canvas = camimg_canvas_ele;
		FitRectangleIntoCanvas(thumbBounds, canvas);

		backbuffer_canvas.width = cameraObj.width;
		backbuffer_canvas.height = cameraObj.height;

		var backbuffer_context2d = backbuffer_canvas.getContext("2d");

		backbuffer_context2d.drawImage(canvas
			, thumbBounds[0], thumbBounds[1], thumbBounds[2] - thumbBounds[0], thumbBounds[3] - thumbBounds[1]
			, 0, 0, backbuffer_canvas.width, backbuffer_canvas.height);

		$camimg_wrapper.css("width", backbuffer_canvas.width + "px").css("height", backbuffer_canvas.height + "px");
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
// Fetch H264 Video Module ////////////////////////////////////
// Using OpenH264 or Pnacl_Player /////////////////////////////
///////////////////////////////////////////////////////////////
function FetchH264VideoModule()
{
	/*
	A low level video player module which streams H.264 using the fetch API, and decodes/plays it using JavaScript.
	*/
	var self = this;
	var isInitialized = false;
	var isCurrentlyActive = false;
	var lastActivatedAt = 0;
	var h264_player;
	var currentSeekPositionPercent = 0;
	var lastFrameAt = 0;
	var playbackPaused = false;
	var perfMonInterval;
	var lastNerdStatsUpdate = performance.now();
	var isLoadingRecordedSnapshot = false;
	var endSnapshotDisplayTimeout = null;
	var currentImageDateMs = GetServerDate(new Date()).getTime();
	var failLimiter = new FailLimiter(5, 20000);
	var willNotReconnectToast = null;
	var failureRecoveryTimeout = null;
	var didRequestAudio = false;
	var canRequestAudio = false;
	var streamHasAudio = 0; // -1: no audio, 0: unknown, 1: audio
	var lastFrameMetadata = { width: 0, height: 0, pos: 0, timestamp: 0, utc: Date.now(), expectedInterframe: 100 };
	var audioCodec = "";

	var loading = new BICameraData();

	var $layoutbody = $("#layoutbody");
	var $camimg_wrapper = $("#camimg_wrapper");
	var $camimg_store = $("#camimg_store");
	var $volumeBar = $("#volumeBar");

	var lastStatusBlock = null;

	var Initialize = function ()
	{
		if (isInitialized)
			return;
		isInitialized = true;
		// Do one-time initialization here
		//console.log("Initializing h264_player");
		if (mse_mp4_h264_supported && settings.ui3_h264_choice2 === H264PlayerOptions.HTML5)
			h264_player = new HTML5_MSE_Player($camimg_wrapper, FrameRendered, PlaybackReachedNaturalEnd, playerErrorCb);
		else if (pnacl_player_supported &&
			(settings.ui3_h264_choice2 === H264PlayerOptions.NaCl_HWVA_Auto
				|| settings.ui3_h264_choice2 === H264PlayerOptions.NaCl_HWVA_No
				|| settings.ui3_h264_choice2 === H264PlayerOptions.NaCl_HWVA_Yes))
			h264_player = new Pnacl_Player($camimg_wrapper, FrameRendered, PlaybackReachedNaturalEnd);
		else
			h264_player = new OpenH264_Player(FrameRendered, PlaybackReachedNaturalEnd);
	}
	var Activate = function ()
	{
		if (isCurrentlyActive)
			return;
		isCurrentlyActive = true;
		lastActivatedAt = performance.now();
		// Show yourself
		//console.log("Activating h264_player");
		$volumeBar.removeClass("audioTemporarilyUnavailable");
		h264_player.Toggle($camimg_wrapper, true);
		h264_player.ClearDrawingSurface();
		videoOverlayHelper.ShowLoadingOverlay(true);
	}
	this.Deactivate = function ()
	{
		if (!isCurrentlyActive)
			return;
		isCurrentlyActive = false;
		// Stop what you are doing and hide
		//console.log("Deactivating h264_player");
		$volumeBar.addClass("audioTemporarilyUnavailable");
		StopStreaming();
		h264_player.Toggle($camimg_store, false);
	}
	var StopStreaming = function ()
	{
		clearTimeout(failureRecoveryTimeout);
		clearTimeout(endSnapshotDisplayTimeout);
		safeFetch.CloseStream();
		h264_player.Flush();
		pcmPlayer.Reset();
		if (!safeFetch.IsActive())
			volumeIconHelper.setColorIdle();
		setTimeout(MeasurePerformance, 0);
	}
	this.VisibilityChanged = function (visible)
	{
		if (visible && isCurrentlyActive)
		{
			if (loading.isLive)
				self.OpenVideo(loading);
			else if (!playbackPaused)
				self.Playback_Play();
		}
		else if (!ui3ClipIsExporting)
		{
			StopStreaming();
		}
	}
	this.LoadedFrameSinceActivate = function ()
	{
		return h264_player.GetRenderedFrameCount() > 0;
	}
	var AreSameClip = function (uid1, uid2)
	{
		var cd1 = clipLoader.GetClipFromId(uid1);
		var cd2 = clipLoader.GetClipFromId(uid2);
		if (cd1 && cd2 && cd1.clipId == cd2.clipId)
			return true;
		return false;
	}
	var openVideoTimeout = null;
	this.OpenVideo = function (videoData, offsetPercent, startPaused)
	{
		// Delay if the player has not fully loaded yet.
		if (openVideoTimeout != null)
			clearTimeout(openVideoTimeout);
		if (!h264_player.IsLoaded())
		{
			openVideoTimeout = setTimeout(function ()
			{
				self.OpenVideo(videoData, offsetPercent, startPaused);
			}, 5);
			return;
		}
		if (developerMode)
			console.log("h264.OpenVideo");
		var isSameClipAsBefore = AreSameClip(loading.uniqueId, videoData.uniqueId);
		loading.CopyValuesFrom(videoData);
		var honorAlertOffset = offsetPercent === -1;
		if (!offsetPercent)
			offsetPercent = 0;
		if (loading.isLive)
			startPaused = false;
		Activate();
		lastStatusBlock = null;
		if (playbackControls.GetPlayReverse() && offsetPercent === 0)
			offsetPercent = 1;
		currentSeekPositionPercent = Clamp(offsetPercent, 0, 1);
		lastFrameAt = performance.now();
		currentImageDateMs = Date.now();
		isLoadingRecordedSnapshot = false;
		clearTimeout(failureRecoveryTimeout);
		clearTimeout(endSnapshotDisplayTimeout);
		streamHasAudio = 0;
		didRequestAudio = pcmPlayer.AudioEnabled();
		canRequestAudio = true;
		var audioArg = "&audio=" + (didRequestAudio ? "1" : "0");
		var videoUrl;
		if (loading.isLive)
		{
			videoUrl = currentServer.remoteBaseURL + "video/" + loading.path + "/2.0" + currentServer.GetRemoteSessionArg("?", true) + audioArg + genericQualityHelper.GetCurrentProfile().GetUrlArgs(loading.fullwidth, loading.fullheight) + "&extend=2";
		}
		else
		{
			var speed = 100 * playbackControls.GetPlaybackSpeed();
			if (playbackControls.GetPlayReverse())
				speed *= -1;
			if (startPaused)
				speed = 0;
			var clipData = clipLoader.GetClipFromId(loading.uniqueId);
			var offsetArg = "";
			var path = loading.path;
			if (clipData)
			{
				isLoadingRecordedSnapshot = clipData.isSnapshot;
				if (!clipData.isSnapshot && !clipData.isClip)
				{
					clipStatsLoader.LoadClipStats("@" + clipData.clipId, function (stats)
					{
						clipLoader.ApplyMissingStatsToClipData(stats, clipData);
						if (loading.uniqueId == clipData.recId)
							loading.msec = stats.msec;
						var loadingImg = videoPlayer.Loading().image;
						if (loadingImg.uniqueId == clipData.recId)
							loadingImg.msec = stats.msec;
					});
				}
				var lastMs = (clipData.msec - 1);
				if (honorAlertOffset && !clipData.isClip && !clipData.isSnapshot)
				{
					var offsetMs = clipData.offsetMs;
					if ((clipData.flags & alert_flag_offsetMs) == 0)
					{
						toaster.Warning("Blue Iris did not provide an offset in milliseconds for this alert, so it may begin at the wrong position.", 10000);
						path = clipData.alertPath;
					}
					else
					{
						// We are starting the alert at a specific offset that was provided in milliseconds.
						if (speed < 0) // If playing in reverse, lets start at the end of the alert's bounds.
							offsetMs += clipData.roughLengthMs;
						offsetArg = "&time=" + offsetMs;
					}
					// The "pos" argument must be provided alongside "kbseek", even though "pos" will be ignored by Blue Iris.
					// We recalculate the seek position here anyway because it helps with UI accuracy before the first frame arrives.
					if (lastMs === 0)
						currentSeekPositionPercent = 0;
					else
						currentSeekPositionPercent = Clamp(offsetMs / lastMs, 0, 1);
				}
				currentImageDateMs = clipData.date.getTime() + (currentSeekPositionPercent * lastMs);
			}
			if (speed !== 100)
			{
				canRequestAudio = false; // We won't receive audio if speed isn't exactly 100
				didRequestAudio = false;
				audioArg = "";
			}
			var posInt = parseInt(currentSeekPositionPercent * 10000);
			if (speed === 0 && posInt >= 10000)
				posInt = 9999;
			var posArg = "&pos=" + posInt;
			if (honorAlertOffset)
				posArg = "";
			if (isSameClipAsBefore && offsetArg === "")
			{
				// Another hack to work around API limitations.
				// This allows us to seek frame-by-frame with millisecond precision 
				// instead of precision equalling 1/10000th of the clip's duration.
				// isSameClipAsBefore helps ensure we have an accurate msec value.
				var offsetMsec = currentSeekPositionPercent === 1 && !startPaused ? 0 : -1;
				offsetArg = "&time=" + (currentSeekPositionPercent * (loading.msec + offsetMsec)).dropDecimals();
				posArg = "";
			}
			var urlArgs = genericQualityHelper.GetCurrentProfile().GetUrlArgs(loading.fullwidth, loading.fullheight);
			var widthAndQualityArg = "";
			if (speed === 0)
			{
				// speed == 0 means we'll get a jpeg, so we should include w and q arguments.
				if (urlArgs.indexOf("&h=") === -1)
					widthAndQualityArg += "&w=" + imageRenderer.GetSizeToRequest(false).w;
				widthAndQualityArg += "&q=50";
			}
			videoUrl = currentServer.remoteBaseURL + "file/clips/" + path + currentServer.GetRemoteSessionArg("?", true) + posArg + "&speed=" + speed + audioArg + urlArgs + "&extend=2" + offsetArg + widthAndQualityArg;
		}
		// We can't 100% trust loading.audio, but we can trust it enough to use it as a hint for the GUI.
		volumeIconHelper.setEnabled(loading.audio);
		if (didRequestAudio && loading.audio)
			volumeIconHelper.setColorLoading();
		else
			volumeIconHelper.setColorIdle();
		videoOverlayHelper.ShowLoadingOverlay(true);
		if (willNotReconnectToast)
		{
			willNotReconnectToast.remove();
			willNotReconnectToast = null;
		}
		if (startPaused)
		{
			self.Playback_Pause(); // If opening the stream while paused, the stream will stop after one frame.
			safeFetch.OpenStream(videoUrl, acceptFrame, acceptStatusBlock, streamInfoCallback, StreamEnded);
		}
		else
		{
			playbackPaused = false;
			playbackControls.setPlayPauseButtonState(playbackPaused);
			// Calling StopStream before opening the new stream will drop any buffered frames in the decoder, allowing the new stream to begin playback immediately.
			StopStreaming();
			safeFetch.OpenStream(videoUrl, acceptFrame, acceptStatusBlock, streamInfoCallback, StreamEnded);
		}
		BI_CustomEvent.Invoke("OpenVideo", loading);
	}
	var acceptFrame = function (frame, streams)
	{
		if (documentIsHidden())
		{
			console.log("Stopping H.264 stream because the page is believed to be inactive.");
			StopStreaming();
			return;
		}
		if (streamHasAudio === 0 && didRequestAudio && streams !== 2)
		{
			// We requested audio, but the stream says it doesn't contain any.
			canRequestAudio = false;
			volumeIconHelper.setEnabled(false);
		}
		streamHasAudio = streams === 2 ? 1 : -1;
		if (frame.isVideo)
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
				jpegPreviewModule.RenderDataURI(frame.startTime, loading.uniqueId, frame.jpeg);
			}
			else
				h264_player.AcceptFrame(frame);
		}
		else if (frame.isAudio)
		{
			// The only supported format is mu-law encoding with one audio channel.
			if (frame.format.wFormatTag === 7 && frame.format.nChannels === 1)
			{
				// 7 is mu-law, mu-law is 8 bits per sample but decodes to 16 bits per sample.
				audioCodec = "mu-law " + frame.format.nSamplesPerSec + "hz";
				var pcm16Bit = muLawDecoder.DecodeUint8ArrayToFloat32Array(frame.frameData);
				pcmPlayer.AcceptBuffer(pcm16Bit, frame.format.nChannels, frame.format.nSamplesPerSec);
			}
			else
			{
				audioCodec = "";
				console.log("Unsupported audio frame format", frame.format);
			}
		}
	}
	var acceptStatusBlock = function (status)
	{
		if (!status)
		{
			cornerStatusIcons.HideAll();
			lastStatusBlock = null;
			return;
		}
		cornerStatusIcons.Set("motion", status.bMotion);
		cornerStatusIcons.Set("trigger", status.bTriggered);
		cornerStatusIcons.Set("recording", status.bRec);

		if (lastStatusBlock)
		{
			if (status.bMotion && !lastStatusBlock.bMotion)
				biSoundPlayer.PlayEvent("motion");
			if (status.bTriggered && !lastStatusBlock.bTriggered)
				biSoundPlayer.PlayEvent("trigger");
		}

		BI_CustomEvent.Invoke("Video Status Block", arguments);

		lastStatusBlock = status;
	}
	var streamInfoCallback = function (bitmapInfoHeader, waveFormatEx)
	{
		if (typeof h264_player.streamInfoCallback === "function")
			h264_player.streamInfoCallback(bitmapInfoHeader, waveFormatEx);
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
			return currentServer.remoteBaseURL + "file/clips/" + loading.path + '?time=' + self.GetClipPlaybackPositionMs() + currentServer.GetRemoteSessionArg("&", true);
	}
	this.GetLastSnapshotFullUrl = function ()
	{
		return self.GetLastSnapshotUrl();
	}
	this.GetClipPlaybackPositionMs = function ()
	{
		return (currentSeekPositionPercent * loading.msec - 1).dropDecimals();
	}
	this.GetStaticSnapshotId = function ()
	{
		if (isLoadingRecordedSnapshot)
			return loading.uniqueId;
		else
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
		if (!loading.isLive && h264_player.GetRenderedFrameCount() > 0)
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
	this.NotifyClipMetadataChanged = function (clipData)
	{
		loading.msec = clipData.msec;
	}
	this.AudioToggleNotify = function (audioEnabled)
	{
		if (!safeFetch.IsActive())
			return;
		if (audioEnabled)
		{
			if (canRequestAudio && !didRequestAudio)
				ReopenStreamAtCurrentSeekPosition(); // We want audio. We didn't request it yet, so we should do it now.
		}
		else
		{
			if (didRequestAudio && streamHasAudio != -1)
				ReopenStreamAtCurrentSeekPosition(); // We don't want audio, but we requested it and may be receiving it.
		}
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
		lastFrameMetadata.width = frame.width;
		lastFrameMetadata.height = frame.height;
		lastFrameMetadata.pos = frame.pos;
		lastFrameMetadata.timestamp = frame.timestamp;
		lastFrameMetadata.utc = frame.utc;
		lastFrameMetadata.size = frame.size;
		lastFrameMetadata.expectedInterframe = frame.expectedInterframe;

		currentImageDateMs = frame.utc;
		currentSeekPositionPercent = frame.pos / 10000;
		var timeNow = performance.now();
		videoPlayer.ImageRendered(loading.uniqueId, frame.width, frame.height, lastFrameAt - timeNow, new Date(frame.utc));
		if (loading.isLive)
			playbackControls.FrameTimestampUpdated(false);
		else
			playbackControls.FrameTimestampUpdated(frame.utc);
		writeNerdStats(frame, timeNow);
		lastFrameAt = timeNow;
		if (playbackPaused && !loading.isLive)
		{
			StopStreaming();
		}
	}
	var playerErrorCb = function (message)
	{
		StopStreaming();
		if (message !== "INPUT REQUIRED")
			toaster.Error(message, 15000);
	}
	var StreamEnded = function (message, wasJpeg, wasAppTriggered, videoFinishedStreaming, responseError)
	{
		if (currentServer.isLoggingOut)
			return;
		if (developerMode)
			console.log("fetch stream ended: ", message);
		cornerStatusIcons.Hide("trigger");
		cornerStatusIcons.Hide("motion");
		cornerStatusIcons.Hide("recording");
		BI_CustomEvent.Invoke("Video Stream Ended", arguments);
		if (!safeFetch.IsActive())
			volumeIconHelper.setColorIdle();
		if (wasJpeg)
			return;
		if (videoFinishedStreaming)
			h264_player.PreviousFrameIsLastFrame();
		else
		{
			if (!wasAppTriggered && !safeFetch.IsActive())
			{
				StopStreaming();
				if (failLimiter.Fail())
				{
					willNotReconnectToast = toaster.Error("The video stream was lost.  Due to rapid failures, automatic reconnection will not occur.", 99999999);
				}
				else
				{
					toaster.Warning("The video stream was lost. Attempting to reconnect...", 5000);
					clearTimeout(failureRecoveryTimeout);
					failureRecoveryTimeout = setTimeout(ReopenStreamAtCurrentSeekPosition, 2000);
				}
			}
		}
	}
	var PlaybackReachedNaturalEnd = function (frameCount)
	{
		//console.log("playback reached natural end of file after " + frameCount + " frames");
		if (!safeFetch.IsActive())
			volumeIconHelper.setColorIdle();
		if (loading.isLive)
			return;
		var reverse = playbackControls.GetPlayReverse();
		if (reverse)
			currentSeekPositionPercent = 0;
		else
			currentSeekPositionPercent = 1;
		videoPlayer.Playback_Ended(reverse);
	}
	var writeNerdStats = function (frame, perfNow)
	{
		if (!perfNow)
			perfNow = performance.now();
		if (nerdStats.IsOpen())
		{
			var codecs = "h264";
			if (streamHasAudio == 1 && audioCodec)
				codecs += ", " + audioCodec;
			var bitRate_Video = bitRateCalc_Video.GetBPS() * 8;
			var bitRate_Audio = bitRateCalc_Audio.GetBPS() * 8;
			var bufferSize = pcmPlayer.GetBufferedMs();
			var interFrame = perfNow - lastFrameAt;
			var interFrameError = Math.abs(frame.expectedInterframe - interFrame);
			var netDelay = h264_player.GetNetworkDelay().toFloat();
			var decoderDelay = h264_player.GetBufferedTime().toFloat();
			if (h264_player.isMsePlayer)
			{
				interFrame = frame.duration ? frame.duration : 0;
				interFrameError = 0;
			}
			nerdStats.BeginUpdate();
			nerdStats.UpdateStat("Viewport", $layoutbody.width() + "x" + $layoutbody.height());
			nerdStats.UpdateStat("Stream Resolution", frame.width + "x" + frame.height);
			nerdStats.UpdateStat("Native Resolution", loading.fullwidth + "x" + loading.fullheight);
			nerdStats.UpdateStat("Seek Position", loading.isLive ? "LIVE" : ((frame.pos / 100).toFixed() + "%"));
			nerdStats.UpdateStat("Frame Offset", frame.timestamp + "ms");
			nerdStats.UpdateStat("Frame Time", GetDateStr(new Date(frame.utc + GetServerTimeOffset()), true));
			nerdStats.UpdateStat("Codecs", codecs);
			nerdStats.UpdateStat("Video Bit Rate", bitRate_Video, formatBitsPerSecond(bitRate_Video, 1), true);
			nerdStats.UpdateStat("Audio Bit Rate", bitRate_Audio, formatBitsPerSecond(bitRate_Audio, 1), true);
			nerdStats.UpdateStat("Audio Buffer", bufferSize, bufferSize.toFixed(0) + "ms", true);
			nerdStats.UpdateStat("Frame Size", frame.size, formatBytes(frame.size, 2), true);
			nerdStats.UpdateStat("Inter-Frame Time", interFrame, interFrame.toFixed() + "ms", true);
			nerdStats.UpdateStat("Frame Timing Error", interFrameError, interFrameError.toFixed() + "ms", true);
			nerdStats.UpdateStat("Network Delay", netDelay, netDelay.toFixed().padLeft(4, '0') + "ms", true);
			nerdStats.UpdateStat("Player Delay", decoderDelay, decoderDelay.toFixed().padLeft(4, '0') + "ms", true);
			nerdStats.UpdateStat("Delayed Frames", h264_player.GetBufferedFrameCount(), h264_player.GetBufferedFrameCount(), true);
			lastNerdStatsUpdate = performance.now();
			nerdStats.EndUpdate();
		}
	}
	var perf_warning_net = null;
	var perf_warning_cpu = null;
	var perf_warning_net_ticks = 0;
	var perf_warning_cpu_ticks = 0;
	var MeasurePerformance = function ()
	{
		var perfNow = performance.now();
		if (!h264_player || !isCurrentlyActive || !safeFetch.IsActive() || isLoadingRecordedSnapshot || perfNow - lastActivatedAt < 1000)
			return;
		if (perfNow - lastNerdStatsUpdate > 3000 && perfNow - lastActivatedAt > 3000)
			writeNerdStats(lastFrameMetadata, perfNow);
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
		var bufferedTime = h264_player.GetBufferedTime();
		var netDelay = h264_player.GetNetworkDelay();
		if (netDelay + bufferedTime > 60000)
		{
			toaster.Warning("Video delay has exceeded 60 seconds. The stream is being automatically reinitialized.");
			ReopenStreamAtCurrentSeekPosition();
			return;
		}
		if (netDelay > 2000)
		{
			if (perf_warning_net_ticks++ > 0)
			{
				// Blue Iris appears to drop frames when it detects the network buffer getting too large, so this needs to be fairly low.
				perf_warning_net = toaster.Warning('Your network connection is not fast enough to handle this stream in realtime. Consider changing the streaming quality.', 10000);
			}
		}
		else
			perf_warning_net_ticks = 0;
		if (h264_player.isMsePlayer)
		{
			if (bufferedTime > h264_player.MaxBufferedTime)
			{
				if (perf_warning_cpu_ticks++ > 0)
					perf_warning_cpu = toaster.Warning('This stream is becoming very delayed, which probably indicates a compatibility issue with the browser you are using. Please try a different browser, or open UI Settings and change the H.264 player to a different option.', 10000);
			}
			else
				perf_warning_cpu_ticks = 0;
		}
		else if (bufferedTime > 3000)
		{
			if (perf_warning_cpu_ticks++ > 0)
				perf_warning_cpu = toaster.Warning('This stream is becoming delayed because your CPU is not fast enough. Consider changing the streaming quality.', 10000);
		}
		else
			perf_warning_cpu_ticks = 0;
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
	this.Toggle = function ($wrapper, activate)
	{
		$canvas.appendTo($wrapper);
	}
	this.ClearDrawingSurface = function ()
	{
		ClearCanvas(canvas);
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
}
///////////////////////////////////////////////////////////////
// pnacl_player ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function Pnacl_Player($startingContainer, frameRendered, PlaybackReachedNaturalEndCB)
{
	var self = this;
	var player;
	var acceptedFrameCount = 0; // Number of frames submitted to the decoder.
	var finishedFrameCount = 0; // Number of frames rendered or dropped.
	var netDelayCalc = new NetDelayCalc();
	var timestampLastAcceptedFrame = -1; // Frame timestamp (ms) of the last frame to be submitted to the decoder.
	var timestampLastRenderedFrame = -1; // Frame timestamp (ms) of the last frame to be rendered.
	var lastFrameReceivedAt = performance.now(); // The performance.now() reading at the moment the last frame was received from the network.
	var averageRenderTime = new RollingAverage();
	var isLoaded = false;
	var allFramesAccepted = false;
	var frameMetadataCache = new FrameMetadataCache();

	var moduleDidLoad = function ()
	{
		if (developerMode)
			console.log("NACL Module loaded");
	}
	var onLoadFail = function ()
	{
		toaster.Error("Failed to load H.264 player.", 999999);
		self.Dispose();
	}
	var handleError = function (event)
	{
		console.error(event);
		checkErrorBeforeLoad(false);
	}
	var handleCrash = function (event)
	{
		try
		{
			if (player.exitStatus == -1)
				console.error("Pnacl_Player CRASH! Last error: " + player.lastError);
			else
				console.error("Pnacl_Player EXITED [" + player.exitStatus + "]");
		}
		catch (ex)
		{
			console.error(ex);
		}
		console.error(event);
		checkErrorBeforeLoad(true);
	}
	var checkErrorBeforeLoad = function (isCrash)
	{
		var $err = $('<div>Native H.264 player ' + (isCrash ? "crashed" : "error") + '!<br><br>' + player.lastError + '</div>');
		if (!isLoaded)
		{
			loadingHelper.SetErrorStatus("h264");
			$err.append($disablePnaclButton);
			var $explanation = $('<div>This button will disable the native player and allow you to load UI3:</div>');
			$explanation.css('margin-top', '12px');
			$err.append($explanation);
			var $disablePnaclButton = $('<input type="button" value="Fall back to JavaScript player" />');
			$disablePnaclButton.css('margin-top', '10px');
			$disablePnaclButton.on('click', function ()
			{
				settings.ui3_h264_choice2 = H264PlayerOptions.JavaScript;
				location.reload();
			});
			$err.append($disablePnaclButton);
		}
		toaster.Error($err, isCrash || !isLoaded ? 99999 : 15000, true);
	}
	var handleMessage = function (message_event)
	{
		if (typeof message_event.data === 'string')
		{
			if (message_event.data == "decoder initialized")
			{
				isLoaded = true;
				loadingHelper.SetLoadedStatus("h264");
			}
			else if (message_event.data.startsWith("rf ")) // Rendered Frame
			{
				//console.log(message_event.data);
				var dataObj = JSON.parse(message_event.data.substr("rf ".length));
				handleFrameRendered(dataObj);
			}
			else if (message_event.data.startsWith("df ")) // Dropped Frame
			{
				var dataObj = JSON.parse(message_event.data.substr("df ".length));
				var loading = videoPlayer.Loading().image;
				//console.log(message_event.data);
				dropFrame();
			}
			else if (message_event.data.startsWith("vr ")) // Video Resized and the player is about to start painting a frame of this size.
			{
				videoPlayer.CameraOrResolutionChange();
			}
			//else if (message_event.data.startsWith("Received frame "))
			//{
			//	console.log(message_event.data);
			//}
			else
			{
				console.log("NaCl Player Message: " + message_event.data);
			}
		}
		else
		{
			console.log("NaCl Player Message of unhandled type: " + (typeof message_event.data));
			console.log(message_event.data);
		}
	}
	var handleFrameRendered = function (dataObj)
	{
		var meta = frameMetadataCache.Remove(dataObj.t);
		if (!meta)
			return; // Most likely from a stream we canceled
		meta.width = dataObj.w;
		meta.height = dataObj.h;
		meta.expectedInterframe = dataObj.i;
		meta.timestamp = meta.time;
		finishedFrameCount++;
		timestampLastRenderedFrame = meta.timestamp;
		frameRendered(meta);
		CheckStreamEndCondition();
	}
	var dropFrame = function ()
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

	var Initialize = function ()
	{
		if (developerMode)
			console.log("pnacl_player.Initialize()");
		var $parent = $("#videoElement_wrapper");
		$parent.remove();
		$parent = $('<div id="videoElement_wrapper" class="deactivated"></div>');
		$startingContainer.append($parent);

		var listenerDiv = $parent.get(0);
		listenerDiv.addEventListener('load', moduleDidLoad, true);
		listenerDiv.addEventListener('message', handleMessage, true);
		listenerDiv.addEventListener('error', handleError, true);
		listenerDiv.addEventListener('crash', handleCrash, true);

		var hwva = "0";
		if (settings.ui3_h264_choice2 === H264PlayerOptions.NaCl_HWVA_Auto)
			hwva = "1";
		else if (settings.ui3_h264_choice2 === H264PlayerOptions.NaCl_HWVA_Yes)
			hwva = "2";
		var $player = $('<embed id="pnacl_player_module" name="pnacl_player_module" width="100%" height="100%" path="pnacl" src="ui3/pnacl/pnacl_player.nmf" type="application/x-pnacl" hwaccel="' + hwva + '" />');
		$parent.append($player);
		player = document.getElementById("pnacl_player_module");
	}
	this.Dispose = function ()
	{
		console.log("pnacl_player.Dispose()");
		var $parent = $("#videoElement_wrapper");
		var listenerDiv = $parent.get(0);
		listenerDiv.removeEventListener('load', moduleDidLoad, true);
		listenerDiv.removeEventListener('message', handleMessage, true);
		listenerDiv.removeEventListener('error', handleError, true);
		listenerDiv.removeEventListener('crash', handleCrash, true);
		$parent.remove();
	}
	this.IsLoaded = function ()
	{
		return isLoaded;
	}
	this.IsValid = function ()
	{
		return true;
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
		/// Returns the number of milliseconds of buffered video frames, calculated as timestampLastAcceptedFrame - timestampLastRenderedFrame.
		/// If the system has sufficient computational power, this number should remain close to 0.
		/// </summary>
		return timestampLastAcceptedFrame - timestampLastRenderedFrame;
	}
	this.Flush = function ()
	{
		if (developerMode)
			console.log("Posting reset");
		player.postMessage("reset");
		acceptedFrameCount = 0;
		finishedFrameCount = 0;
		frameMetadataCache.Reset();
		netDelayCalc.Reset();
		timestampLastAcceptedFrame = -1;
		timestampLastRenderedFrame = -1;
		var timeNow = performance.now();
		lastFrameReceivedAt = timeNow;
		allFramesAccepted = false;
	}
	this.AcceptFrame = function (frame)
	{
		frameMetadataCache.Add(frame);
		//if (developerMode)
		//	console.log("Posting frame " + frame.time);
		acceptedFrameCount++;
		player.postMessage("f " + frame.time);
		player.postMessage(frame.frameData.buffer);
		timestampLastAcceptedFrame = frame.time;
		lastFrameReceivedAt = performance.now();
		netDelayCalc.Frame(frame.time, lastFrameReceivedAt);
	}
	this.Toggle = function ($wrapper, activate)
	{
		if (activate)
			$("#videoElement_wrapper").removeClass('deactivated');
		else
			$("#videoElement_wrapper").addClass('deactivated');
	}
	this.ClearDrawingSurface = function ()
	{
	}
	this.PreviousFrameIsLastFrame = function ()
	{
		allFramesAccepted = true;
		CheckStreamEndCondition();
	}

	Initialize();
}
///////////////////////////////////////////////////////////////
// Frame Metadata Cache ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function FrameMetadataCache()
{
	var self = this;
	var cache = {};
	this.Add = function (frame)
	{
		cache[frame.time] = frame.meta;
	}
	this.Get = function (timestamp)
	{
		return cache[timestamp];
	}
	this.Remove = function (timestamp)
	{
		var value = cache[timestamp];
		delete cache[timestamp];
		return value;
	}
	this.Reset = function ()
	{
		cache = {};
	}
}
function FrameMetadataQueue()
{
	var self = this;
	var q = new Queue();
	this.Add = function (frame)
	{
		q.enqueue(frame.meta);
	}
	this.Get = function ()
	{
		return q.peek();
	}
	this.Remove = function ()
	{
		return q.dequeue();
	}
	this.IsEmpty = function ()
	{
		return q.isEmpty();
	}
	this.GetLength = function ()
	{
		return q.getLength();
	}
	this.Reset = function ()
	{
		q = new Queue();
	}
}
///////////////////////////////////////////////////////////////
// HTML5 + Media Source Extensions Player /////////////////////
///////////////////////////////////////////////////////////////
function HTML5_MSE_Player($startingContainer, frameRendered, PlaybackReachedNaturalEndCB, playerErrorHandler)
{
	var self = this;
	var jmuxer;
	var player;
	var acceptedFrameCount = 0; // Number of frames submitted to the decoder.
	var finishedFrameCount = 0; // Number of frames rendered or dropped.
	var fedFrameCount = 0; // Number of frames fed to jmuxer
	var netDelayCalc = new NetDelayCalc();
	var timestampLastAcceptedFrame = -1; // Frame timestamp (ms) of the last frame to be submitted to the decoder.
	var timestampLastRenderedFrame = -1; // Frame timestamp (ms) of the last frame to be rendered.
	var lastFrameReceivedAt = performance.now(); // The performance.now() reading at the moment the last frame was received from the network.
	var averageRenderTime = new RollingAverage();
	var isLoaded = false;
	var allFramesAccepted = false;
	var frameMetadataQueue = new FrameMetadataQueue();
	var currentStreamBitmapInfo = null;

	var lastFrame;
	var lastFrameDuration = 16;
	var hasToldPlayerToPlay = false;
	var playerW;
	var playerH;

	var earlyFrames = new Queue();
	var mseReady = false;

	this.isMsePlayer = true;
	this.MaxBufferedTime = 6500;

	var delayCompensation;
	var badAutoplay = new BadAutoplayPreventionDetector();

	var onTimeUpdate = function (e)
	{
		var currentTime = player.currentTime * 1000;
		var w = player.videoWidth;
		var h = player.videoHeight;
		while (!frameMetadataQueue.IsEmpty())
		{
			var meta = frameMetadataQueue.Get();
			if (meta.time > currentTime)
				break;
			frameMetadataQueue.Remove();
			meta.width = w;
			meta.height = h;
			meta.timestamp = meta.time;
			finishedFrameCount++;
			timestampLastRenderedFrame = meta.timestamp;
			frameRendered(meta);
			CheckStreamEndCondition();
		}
		if (finishedFrameCount > 1)
			badAutoplay.Reset();
		if (finishedFrameCount > 3)
			delayCompensation.Tick(self.GetBufferedTime());
	}
	var onVideoError = function (e)
	{
		if (!inputRequiredOverlay.IsActive())
			playerErrorHandler(player.error.message + ": " + GetMediaErrorMessage(player.error.code));
	}
	var onPlayerPaused = function (e)
	{
		if (hasToldPlayerToPlay)
		{
			if (badAutoplay.NotifyPause())
			{
				// This is a sign that playback is being prevented without the courtesy of telling us explicitly.
				InputIsRequiredToPlay();
			}
			else
			{
				setTimeout(function ()
				{
					StartPlayback();
				}, 1);
			}
		}
	}
	var onPlayerStalled = function (e)
	{
		if (acceptedFrameCount > 0)
			console.log("HTML5 video stalled");
	}
	var dropFrame = function ()
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

	var Initialize = function ()
	{
		if (developerMode)
			console.log("HTML5_MSE_Player.Initialize()");
		var $parent = $("#videoElement_wrapper");
		$parent.remove();
		$parent = $('<div id="videoElement_wrapper" class="deactivated"></div>');
		$startingContainer.append($parent);

		// If the video element is muted, browsers are more likely to let it play without user interaction.
		var $player = $('<video id="html5MseVideoEle" muted></video>');
		$parent.append($player);
		player = $player.get(0);
		delayCompensation = new HTML5DelayCompensationHelper(player);

		//player.addEventListener('abort', function (e) { console.log("HTML5 video abort"); });
		player.addEventListener('error', onVideoError);
		player.addEventListener('timeupdate', onTimeUpdate);
		player.addEventListener('loadedmetadata', onTimeUpdate);
		player.addEventListener('pause', onPlayerPaused);
		player.addEventListener('stalled', onPlayerStalled);
		player.addEventListener('suspend', function (e) { console.log("HTML5 video suspended"); });

		isLoaded = true;
		loadingHelper.SetLoadedStatus("h264");
	}
	this.Dispose = function ()
	{
		if (developerMode)
			console.log("HTML5_MSE_Player.Dispose()");
		var $parent = $("#videoElement_wrapper");
		$parent.remove();
		if (jmuxer)
		{
			jmuxer.destroy();
			jmuxer = null;
		}
	}
	this.IsLoaded = function ()
	{
		return isLoaded;
	}
	this.IsValid = function ()
	{
		return true;
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
		if (allFramesAccepted)
			return 0;
		return netDelayCalc.Calc();
	}
	this.GetBufferedTime = function ()
	{
		/// <summary>
		/// Returns the number of milliseconds of buffered video frames, calculated as timestampLastAcceptedFrame - timestampLastRenderedFrame.
		/// If the system has sufficient computational power, this number should remain close to 0.
		/// </summary>
		return timestampLastAcceptedFrame - timestampLastRenderedFrame;
	}
	this.Flush = function ()
	{
		earlyFrames = new Queue();
		if (jmuxer && fedFrameCount > 0)
		{
			mseReady = false;
			player.pause();
			jmuxer.destroy();
			jmuxer = null;
		}
		hasToldPlayerToPlay = false;
		player.pause();
		delayCompensation = new HTML5DelayCompensationHelper(player);
		lastFrame = false;
		lastFrameDuration = 16;
		acceptedFrameCount = 0;
		finishedFrameCount = 0;
		fedFrameCount = 0;
		frameMetadataQueue.Reset();
		netDelayCalc.Reset();
		timestampLastAcceptedFrame = -1;
		timestampLastRenderedFrame = -1;
		var timeNow = performance.now();
		lastFrameReceivedAt = timeNow;
		allFramesAccepted = false;
		currentStreamBitmapInfo = null;
		badAutoplay.Reset();
	}
	var onMSEReady = function ()
	{
		mseReady = true;
		while (!earlyFrames.isEmpty())
			self.AcceptFrame(earlyFrames.dequeue());
	}
	var StartPlayback = function ()
	{
		hasToldPlayerToPlay = true;
		var playPromise = badAutoplay.Play(player);
		if (playPromise && playPromise.catch)
			playPromise.catch(function (ex)
			{
				if (ex.name === "NotAllowedError")
				{
					InputIsRequiredToPlay();
				}
				else if (acceptedFrameCount === 0)
				{
					// Probably we just Flushed the player.
				}
				else
					toaster.Warning("HTML5 Player: " + ex.message, 15000);
				//toaster.Warning(ex);
				//if (ex.name === "DOMException")
				//{
				//}
			});
	}
	var InputIsRequiredToPlay = function ()
	{
		hasToldPlayerToPlay = false;
		inputRequiredOverlay.Show("HTML5 player", function ()
		{
			var playPromise = player.play();
			if (playPromise && typeof playPromise.then === "function")
				playPromise.then(function ()
				{
					player.pause()
				});
			videoPlayer.RefreshVideoStream();
		});
		playerErrorHandler("INPUT REQUIRED");
	}
	this.AcceptFrame = function (frame)
	{
		if (!jmuxer)
		{
			jmuxer = new JMuxer({
				node: 'html5MseVideoEle',
				mode: 'video',
				flushingTime: 1,
				clearBuffer: true,
				cleanOffset: 600, // This is an extension of the original jmuxer.
				onReady: onMSEReady,
				debug: developerMode
			});
		}
		if (!mseReady)
		{
			earlyFrames.enqueue(frame);
			return;
		}

		acceptedFrameCount++;
		timestampLastAcceptedFrame = frame.time;
		lastFrameReceivedAt = performance.now();
		netDelayCalc.Frame(frame.time, lastFrameReceivedAt);

		frame.meta.duration = lastFrameDuration;
		frame.meta.expectedInterframe = lastFrameDuration;
		frameMetadataQueue.Add(frame);

		if (lastFrame)
		{
			lastFrameDuration = frame.time - lastFrame.time;
			jmuxer.feed({
				video: lastFrame.frameData,
				duration: lastFrameDuration
			});
			if (finishedFrameCount === 0 && currentStreamBitmapInfo)
			{
				// Some browsers started having a noticeable delay before their first onTimeUpdate call, so we call frameRendered early for the first frame, causing the video element to be resized at a more appropriate time.
				var startMeta = $.extend({}, frame.meta);
				startMeta.width = currentStreamBitmapInfo.biWidth;
				startMeta.height = currentStreamBitmapInfo.biHeight;
				startMeta.timestamp = startMeta.time;
				frameRendered(startMeta);
			}
			fedFrameCount++;
			if (!hasToldPlayerToPlay)
				StartPlayback();
			if (jmuxer.bufferControllers && jmuxer.bufferControllers.video)
			{
				jmuxer.bufferControllers.video.cleanOffset = 600;
			}
		}
		lastFrame = frame;
	}
	this.Toggle = function ($wrapper, activate)
	{
		if (activate)
			$("#videoElement_wrapper").removeClass('deactivated');
		else
			$("#videoElement_wrapper").addClass('deactivated');
	}
	this.ClearDrawingSurface = function ()
	{
	}
	this.PreviousFrameIsLastFrame = function ()
	{
		if (jmuxer)
		{
			if (lastFrame)
			{
				jmuxer.feed({
					video: lastFrame.frameData,
					duration: lastFrameDuration
				});
			}
			jmuxer.mediaSource.endOfStream();
		}
		allFramesAccepted = true;
		CheckStreamEndCondition();
	}
	this.streamInfoCallback = function (bitmapInfoHeader, waveFormatEx)
	{
		if (bitmapInfoHeader)
			currentStreamBitmapInfo = bitmapInfoHeader;
	}

	Initialize();
}
function HTML5DelayCompensationHelper(player)
{
	var self = this;
	var averager = new TimedAverage(3000, 10);
	var nextPlaybackRateChangeAllowedAt = 0;
	var aggressionLevel = 3;
	var minSpeed = 1;
	var maxSpeed = 1;
	var tolerance = 1;
	var lastSetRate = 0;
	var setPlaybackRate = function (rate)
	{
		if (lastSetRate !== rate)
		{
			player.playbackRate = rate;
			if (player.playbackRate !== rate)
			{
				console.log("HTML5 Delay Compensator failed to set playback rate to " + rate, player.playbackRate);
				nextPlaybackRateChangeAllowedAt = performance.now() + 10000;
			}
			lastSetRate = rate;
		}
	}
	this.Tick = function (delayedTime)
	{
		if (averager.done)
		{
			UpdateAggressionLevel();
			if (aggressionLevel > 0)
			{
				var now = performance.now();
				if (now >= nextPlaybackRateChangeAllowedAt)
				{
					var avg = averager.Get();
					var adjustedTolerance = tolerance;
					if (avg < 1000)
					{
						if (avg <= 0)
							avg = 1;
						var adjustmentStrength = 1000 / avg;
						adjustedTolerance = adjustmentStrength * tolerance;
					}
					var toleranceOffset = (avg * adjustedTolerance);
					var min = avg - toleranceOffset;
					var max = avg + toleranceOffset;
					var diff;
					if (delayedTime < min)
						diff = Math.max(delayedTime / min, minSpeed);
					else if (delayedTime > max)
						diff = Math.min(delayedTime / max, maxSpeed);
					else
						diff = 1;
					setPlaybackRate(diff);
					nextPlaybackRateChangeAllowedAt = now + 250;
				}
			}
			else
				setPlaybackRate(1);
		}
		else
		{
			averager.Add(delayedTime);
		}
	}
	var UpdateAggressionLevel = function ()
	{
		var value = settings.ui3_html5_delay_compensation;
		var level;
		if (value === HTML5DelayCompensationOptions.Weak)
			level = 1;
		else if (value === HTML5DelayCompensationOptions.Normal)
			level = 2;
		else if (value === HTML5DelayCompensationOptions.Strong)
			level = 3;
		else
			level = 0;

		if (aggressionLevel !== level)
		{
			aggressionLevel = level;

			if (level == 1)
			{
				tolerance = 0.15;
				minSpeed = 0.95;
				maxSpeed = 1.05;
			}
			else if (level == 2)
			{
				tolerance = 0.1;
				minSpeed = 0.75;
				maxSpeed = 1.25;
			}
			else if (level == 3)
			{
				tolerance = 0.05;
				minSpeed = 0.25;
				maxSpeed = 2;
			}
			else
				minSpeed = maxSpeed = tolerance = 1;
		}
	}
	UpdateAggressionLevel();
	setPlaybackRate(1);
}
/**
 * Tries to detect when HTML5 autoplay is being prevented without the courtesy of a "NotAllowedError".
 * This class also circumvents several browser extensions which use non-standard methods to prevent autoplay, some of which are really incompatible with UI3!
 */
function BadAutoplayPreventionDetector()
{
	var self = this;
	var q = new Queue();
	var pauseLimit = 5;
	var timeIntervalMs = 1000;
	var circ1 = 0;
	var circ2 = 0;
	/**
	 * Call this to reset the detector.
	 */
	this.Reset = function ()
	{
		if (q.getLength() > 0)
			q = new Queue();
		if (circ2 < 1)
		{
			// This action circumvents the Chrome extension "Disable HTML5 Autoplay (Reloaded)".
			circ2++;
			postMessage({ msg: 'dh5a:send-msg-to-frames', msgToSend: { msg: 'input-recieved', event: "mousedown", value: true } }, '*');
		}
	};
	/**
	 * Call this when the player gets paused.
	 * @returns {Boolean} true if it appears that the player is being prevented from playing.
	 */
	this.NotifyPause = function ()
	{
		var now = performance.now();
		q.enqueue(now);
		while (!q.isEmpty() && now - q.peek() >= timeIntervalMs)
			q.dequeue();
		return q.getLength() >= pauseLimit;
	};
	/**
	 * Call this to begin media playback.
	 * @param player {Object} the video player instance
	 * @returns {Promise} the promise returned by calling player.play()
	 */
	this.Play = function (player)
	{
		if (circ1 < 2)
		{
			// This action circumvents the Chrome extension "HTML5 Video Autoplay Blocker"
			circ1++;
			var $ele = $("body > .video-blocker-overlay-btn");
			if ($ele.length > 0)
			{
				$ele.click();
				$ele.remove();
				circ1 = 1000;
			}
		}
		if (typeof html5PlayFunc === "function")
			return html5PlayFunc.call(player); // This action circumvents the Chrome extension "Disable HTML5 Autoplay"
		else
			return player.play();
	};
}
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
		// Blue Iris does not increase frame timestamps at a rate equivalent to real time while encoding a reduced-speed video.
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
function CopyImageToCanvas(imgEle, canvas)
{
	if (canvas.width != imgEle.naturalWidth)
		canvas.width = imgEle.naturalWidth;
	if (canvas.height != imgEle.naturalHeight)
		canvas.height = imgEle.naturalHeight;

	var context2d = canvas.getContext("2d");
	context2d.drawImage(imgEle, 0, 0);
}
function ClearCanvas(canvas)
{
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

	var $layoutbody = $("#layoutbody");
	var $camimg_wrapper = $("#camimg_wrapper");
	var sccc_outerObjs = $('#layoutbody,#camimg_wrapper,#zoomhint');

	this.zoomHandler = null;

	this.GetSizeToRequest = function (modifyForJpegQualitySetting)
	{
		// Calculate the size of the image we need
		var ciLoading = videoPlayer.Loading().image;
		var ssFactor = parseFloat(settings.ui3_jpegSupersampling);
		if (isNaN(ssFactor) || ssFactor < 0.01 || ssFactor > 2)
			ssFactor = 1;
		var imgDrawWidth = ciLoading.fullwidth * dpiScalingFactor * ssFactor * self.zoomHandler.GetZoomFactor();
		var imgDrawHeight = ciLoading.fullheight * dpiScalingFactor * ssFactor * self.zoomHandler.GetZoomFactor();
		if (imgDrawWidth === 0)
		{
			// Image is supposed to scale to fit the screen (first zoom level)
			imgDrawWidth = $layoutbody.width() * dpiScalingFactor * ssFactor;
			imgDrawHeight = $layoutbody.height() * dpiScalingFactor * ssFactor;

			var availableRatio = imgDrawWidth / imgDrawHeight;
			if (availableRatio < ciLoading.aspectratio)
				imgDrawHeight = imgDrawWidth / ciLoading.aspectratio;
			else
				imgDrawWidth = imgDrawHeight * ciLoading.aspectratio;
		}
		if (ciLoading.aspectratio < 1)
		{
			if (modifyForJpegQualitySetting)
				imgDrawHeight = jpegQualityHelper.ModifyImageDimension("h", imgDrawHeight);
			imgDrawWidth = imgDrawHeight * ciLoading.aspectratio;
		}
		else
		{
			if (modifyForJpegQualitySetting)
				imgDrawWidth = jpegQualityHelper.ModifyImageDimension("w", imgDrawWidth);
			imgDrawHeight = imgDrawWidth / ciLoading.aspectratio;
		}
		// Now we have the size we need.  Determine what argument we will send to Blue Iris
		return { w: parseInt(Math.round(imgDrawWidth)), h: parseInt(Math.round(imgDrawHeight)) };
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

		var imgAvailableWidth = $layoutbody.width();
		var imgAvailableHeight = $layoutbody.height();

		// Calculate new size based on zoom levels
		var imgForSizing = videoPlayer.Loaded().image;
		var widthForSizing;
		var heightForSizing;
		if (settings.ui3_zoom1x_mode === "Stream")
		{
			widthForSizing = imgForSizing.actualwidth;
			heightForSizing = imgForSizing.actualheight;
		}
		else
		{
			widthForSizing = imgForSizing.fullwidth;
			heightForSizing = imgForSizing.fullheight;
		}
		var imgDrawWidth = widthForSizing * self.zoomHandler.GetZoomFactor();
		var imgDrawHeight = heightForSizing * self.zoomHandler.GetZoomFactor();
		if (imgDrawWidth === 0)
		{
			imgDrawWidth = imgAvailableWidth;
			imgDrawHeight = imgAvailableHeight;

			var aspectRatio = imgForSizing.actualwidth / imgForSizing.actualheight;
			var newRatio = imgDrawWidth / imgDrawHeight;
			if (newRatio < aspectRatio)
				imgDrawHeight = imgDrawWidth / aspectRatio;
			else
				imgDrawWidth = imgDrawHeight * aspectRatio;
		}
		$camimg_wrapper.css("width", imgDrawWidth + "px").css("height", imgDrawHeight + "px");

		imageIsLargerThanAvailableSpace = imgDrawWidth > imgAvailableWidth || imgDrawHeight > imgAvailableHeight;

		if (previousImageDraw.z > -1 && previousImageDraw.z !== self.zoomHandler.GetZoomFactor())
		{
			// We just experienced a zoom change
			// Find the mouse position percentage relative to the center of the image at its old size
			var imgPos = $camimg_wrapper.position();
			var layoutbodyOffset = $layoutbody.offset();
			if (!layoutbodyOffset) // Edge complained about this once
				layoutbodyOffset = { left: 0, top: 0 };
			var xPos = mouseX;
			var yPos = mouseY;
			if (isFromKeyboard)
			{
				xPos = layoutbodyOffset.left + ($layoutbody.outerWidth(true) / 2);
				yPos = layoutbodyOffset.top + ($layoutbody.outerHeight(true) / 2);
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

		$camimg_wrapper.css("left", proposedX + "px").css("top", proposedY + "px");

		// Store new image position for future calculations
		previousImageDraw.x = proposedX;
		previousImageDraw.x = proposedY;
		previousImageDraw.w = imgDrawWidth;
		previousImageDraw.h = imgDrawHeight;
		previousImageDraw.z = self.zoomHandler.GetZoomFactor();

		BI_CustomEvent.Invoke("ImageResized");
	}
	this.DigitalZoomNow = function (deltaY, isFromKeyboard)
	{
		self.setZoomHandler();
		self.zoomHandler.OffsetZoom(deltaY);

		$("#zoomhint").stop(true, true);
		$("#zoomhint").show();
		zoomHintIsVisible = true;
		var zoomFactor = self.zoomHandler.GetZoomFactor();
		$("#zoomhint").html(zoomFactor === 0 ? "Fit" : ((Math.round(zoomFactor * 10) / 10) + "x"));
		RepositionZoomHint(isFromKeyboard);
		if (zoomHintTimeout !== null)
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
			var layoutbodyOffset = $layoutbody.offset();
			xPos = layoutbodyOffset.left + ($layoutbody.outerWidth(true) / 2);
			yPos = layoutbodyOffset.top + ($layoutbody.outerHeight(true) / 2);
		}
		$("#zoomhint").css("left", (xPos - $("#zoomhint").outerWidth(true)) + "px").css("top", (yPos - $("#zoomhint").outerHeight(true)) + "px");
	}
	var SetCamCellCursor = function ()
	{
		if (imageIsLargerThanAvailableSpace)
		{
			if (imageIsDragging)
			{
				sccc_outerObjs.removeClass("grabcursor");
				sccc_outerObjs.addClass("grabbingcursor");
			}
			else
			{
				sccc_outerObjs.removeClass("grabbingcursor");
				sccc_outerObjs.addClass("grabcursor");
			}
		}
		else
		{
			sccc_outerObjs.removeClass("grabcursor");
			sccc_outerObjs.removeClass("grabbingcursor");
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
	$layoutbody.on('wheel', function (e)
	{
		if (settings.ui3_wheelZoomMethod !== "Adjustable")
			return;
		if (typeof e.deltaY === "undefined")
		{
			e.deltaX = e.originalEvent.deltaX;
			e.deltaY = -e.originalEvent.deltaY;
			e.deltaMode = e.originalEvent.deltaMode;
		}
		handleMouseWheelEvent(e, e.delta, e.deltaX, e.deltaY, e.deltaMode);
	});
	$layoutbody.mousewheel(function (e, delta, deltaX, deltaY)
	{
		if (settings.ui3_wheelZoomMethod !== "Legacy")
			return;
		handleMouseWheelEvent(e, delta, deltaX, deltaY, 2);
	});
	var handleMouseWheelEvent = function (e, delta, deltaX, deltaY, deltaMode)
	{
		mouseCoordFixer.fix(e);
		self.SetMousePos(e.pageX, e.pageY);
		if (playbackControls.MouseInSettingsPanel(e))
			return;
		e.preventDefault();
		if (deltaMode === 1)
			deltaY *= 33.333;
		else if (deltaMode === 2)
			deltaY *= 100;
		if (settings.ui3_wheelZoomReverse === "1")
			deltaY *= -1;
		self.DigitalZoomNow(deltaY, false);
	}
	this.setZoomHandler = function ()
	{
		if (settings.ui3_wheelZoomMethod === "Adjustable")
			self.zoomHandler = zoomHandler_Adjustable;
		else
			self.zoomHandler = zoomHandler_Legacy;
	}
	self.setZoomHandler();
}
///////////////////////////////////////////////////////////////
// Digital Zoom ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var zoomHandler_Adjustable = new (function ()
{
	var self = this;
	var zoomIndex = 0; // All values less than 1 are treated as "zoom to fit".
	var maxZoomFactor = Math.sqrt(Math.sqrt(50));
	this.OffsetZoom = function (deltaY)
	{
		if (deltaY > 100)
			deltaY = 100;
		else if (deltaY < -100)
			deltaY = -100;
		var speed = Clamp(2001 - parseFloat(settings.ui3_wheelAdjustableSpeed), 0, 2000);
		var delta = deltaY / speed;
		if (delta > 0 && zoomIndex < 1)
			zoomIndex = 1; // This ensures we always hit "1x" zoom precisely when zooming in.
		else
		{
			var wasGreaterThan1 = zoomIndex > 1;
			zoomIndex += delta;
			if (zoomIndex < 1 && wasGreaterThan1)
				zoomIndex = 1; // This ensures we always hit "1x" zoom precisely when zooming out.
			var zoomFactor = self.GetZoomFactor();
			if (zoomIndex < 1)
				zoomIndex = 0;
			if (zoomIndex > maxZoomFactor)
				zoomIndex = maxZoomFactor;
		}
	}
	this.GetZoomFactor = function ()
	{
		var zoomFactor = Math.pow(zoomIndex, 4);
		if (zoomFactor < 1)
			zoomFactor = 0;
		else if (zoomFactor > 50)
			zoomFactor = 50;
		return zoomFactor;
	}
	this.ZoomToFit = function ()
	{
		zoomIndex = 0;
	}
})();
var zoomHandler_Legacy = new (function ()
{
	var self = this;
	var zoomTable = [0, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 23, 26, 30, 35, 40, 45, 50];
	var digitalZoom = 0;
	this.OffsetZoom = function (deltaY)
	{
		if (deltaY < 0)
			digitalZoom -= 1;
		else if (deltaY > 0)
			digitalZoom += 1;
		if (digitalZoom < 0)
			digitalZoom = 0;
		else if (digitalZoom >= zoomTable.length)
			digitalZoom = zoomTable.length - 1;
	}
	this.GetZoomFactor = function ()
	{
		return zoomTable[digitalZoom];
	}
	this.ZoomToFit = function ()
	{
		digitalZoom = 0;
	}
})();
///////////////////////////////////////////////////////////////
// Camera Name Labels /////////////////////////////////////////
///////////////////////////////////////////////////////////////
function onui3_cameraLabelsChanged()
{
	cameraNameLabels.show();
}
function CameraNameLabels()
{
	var self = this;
	var $camimg_wrapper = $("#camimg_wrapper");
	var $camLabels_wrapper = $("#cameraLabelsWrapper");

	BI_CustomEvent.AddListener("ImageResized", onui3_cameraLabelsChanged);

	this.show = function (isHotkeyShow)
	{
		self.hide();
		var loaded = videoPlayer.Loaded();
		if (!loaded.cam || !loaded.image.uniqueId || settings.ui3_cameraLabels_enabled != "1")
			return;

		var showName = settings.ui3_cameraLabels_text === CameraLabelTextValues.Name;
		var showShortName = settings.ui3_cameraLabels_text === CameraLabelTextValues.ShortName;
		if (settings.ui3_cameraLabels_text === CameraLabelTextValues.Both)
			showName = showShortName = true;
		if (!showName && !showShortName)
			return;

		if ((loaded.image.isGroup && settings.ui3_cameraLabels_multiCameras === "1") || (!loaded.image.isGroup && settings.ui3_cameraLabels_singleCameras === "1"))
		{
			var scaleX = imageRenderer.GetPreviousImageDrawInfo().w / loaded.image.fullwidth;
			var scaleY = imageRenderer.GetPreviousImageDrawInfo().h / loaded.image.fullheight;
			var offsetCamHeight = settings.ui3_cameraLabels_position === CameraLabelPositionValues.Bottom || settings.ui3_cameraLabels_position === CameraLabelPositionValues.Below;
			var offsetNegativeLabelHeight = settings.ui3_cameraLabels_position === CameraLabelPositionValues.Above || settings.ui3_cameraLabels_position === CameraLabelPositionValues.Bottom;

			// Calculate label font size
			var fontSizePt = parseFloat(settings.ui3_cameraLabels_fontSize);

			var zoomAmount = (scaleX + scaleY) / 2; // scaleX and scaleY are probably the same or very close anyway.
			fontSizePt *= zoomAmount;
			var minScaledFontSize = parseFloat(settings.ui3_cameraLabels_minimumFontSize);
			if (fontSizePt < minScaledFontSize)
				fontSizePt = minScaledFontSize;

			var imgPos = $camimg_wrapper.position();
			var group = loaded.cam.group;
			var rects = loaded.cam.rects;
			if (!group || group.length === 0)
			{
				group = [loaded.cam.optionValue];
				rects = [[0, 0, loaded.cam.width, loaded.cam.height]];
			}
			for (var i = 0; i < group.length; i++)
			{
				var cam = cameraListLoader.GetCameraWithId(group[i]);
				var rect = rects[i];

				// Calculate scaled/adjusted rectangle boundaries
				var adjX = rect[0] * scaleX;
				var adjY = rect[1] * scaleY;
				var adjW = (rect[2] - rect[0]) * scaleX;
				var adjH = (rect[3] - rect[1]) * scaleY;

				// Create and style labels.
				var $label = $('<div class="cameraNameLabel"></div>');
				if (showName && showShortName)
					$label.text(CleanUpGroupName(cam.optionDisplay) + " (" + cam.optionValue + ")");
				else if (showName)
					$label.text(CleanUpGroupName(cam.optionDisplay));
				else
					$label.text(cam.optionValue);
				$label.css("width", adjW + "px");
				var bgOpacity = PercentTo01Float(settings.ui3_cameraLabels_backgroundOpacity);
				var textOpacity = PercentTo01Float(settings.ui3_cameraLabels_textOpacity);
				if (settings.ui3_cameraLabels_cameraColor == "1")
				{
					var colorHex = BlueIrisColorToCssColor(cam.color);
					var colorRgba = HexColorToRgbaColor(colorHex, bgOpacity);
					$label.css("background-color", colorRgba);
					colorRgba = HexColorToRgbaColor(GetReadableTextColorHexForBackgroundColorHex(colorHex), textOpacity);
					$label.css("color", colorRgba);
				}
				else
				{
					var bg = HexColorToRgbObj(settings.ui3_cameraLabels_backgroundColor);
					var tx = HexColorToRgbObj(settings.ui3_cameraLabels_textColor);
					$label.css("background-color", "rgba(" + bg.r + "," + bg.g + "," + bg.b + "," + bgOpacity + ")");
					$label.css("color", "rgba(" + tx.r + "," + tx.g + "," + tx.b + "," + textOpacity + ")");
				}
				$label.css("font-size", fontSizePt + "pt");
				$label.css("left", (adjX + imgPos.left) + "px");
				$camLabels_wrapper.append($label);

				var yOffset = 0;
				if (offsetCamHeight)
					yOffset += adjH;
				if (offsetNegativeLabelHeight)
					yOffset -= $label.height();
				$label.css("top", (adjY + imgPos.top + yOffset) + "px");
			}
		}
		else if (isHotkeyShow)
		{
			toaster.Info("Camera name labels can only be shown on groups of cameras.");
		}
	}
	this.hide = function ()
	{
		$camLabels_wrapper.empty();
	}
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
	var $loadingOverlay = $("#camimg_loading");
	var $loadingAnim = $("#camimg_loading_anim");
	var $falseLoadingOverlay = $("#camimg_false_loading");
	var $tempPlayIcon = $("#camimg_playIcon,#camimg_centerIconBackground");
	var $tempPauseIcon = $("#camimg_pauseIcon,#camimg_centerIconBackground");
	var $temporaryIcons = $("#camimg_playIcon,#camimg_pauseIcon,#camimg_centerIconBackground");

	this.HideLoadingOverlay = function ()
	{
		if (!loadingOverlayHidden)
		{
			loadingOverlayHidden = true;
			$loadingOverlay.addClass('hidden').removeClass('visible');
		}
		self.HideLoadingAnimation();
	}
	this.HideLoadingAnimation = function ()
	{
		if (!loadingAnimHidden)
		{
			loadingAnimHidden = true;
			$loadingAnim.addClass('hidden').removeClass('visible');
		}
	}
	this.ShowLoadingOverlay = function (showAnimation, lessIntenseOverlay)
	{
		if (loadingOverlayHidden)
		{
			loadingOverlayHidden = false;
			$loadingOverlay.removeClass('hidden').addClass('visible');
		}
		if (lessIntenseOverlay && !overlayIsLessIntense)
			$loadingOverlay.addClass("lessIntense");
		else if (!lessIntenseOverlay && overlayIsLessIntense)
			$loadingOverlay.removeClass("lessIntense");
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
			$loadingAnim.removeClass('hidden').addClass('visible');
		}
	}
	this.HideFalseLoadingOverlay = function ()
	{
		if (!falseLoadingOverlayHidden)
		{
			falseLoadingOverlayHidden = true;
			$falseLoadingOverlay.addClass('hidden').removeClass('visible');
		}
	}
	this.ShowFalseLoadingOverlay = function ()
	{
		if (falseLoadingOverlayHidden)
		{
			falseLoadingOverlayHidden = false;
			$falseLoadingOverlay.removeClass('hidden').addClass('visible');
		}
	}
	this.ShowTemporaryPlayIcon = function (duration)
	{
		self.HideTemporaryIcons();
		fadeIcons($tempPlayIcon, duration);
	}
	this.ShowTemporaryPauseIcon = function (duration)
	{
		self.HideTemporaryIcons();
		fadeIcons($tempPauseIcon, duration);
	}
	var fadeIcons = function ($icons, duration)
	{
		if (!duration)
			duration = 1000;
		$icons.show().fadeOut(duration);
	}
	this.HideTemporaryIcons = function ()
	{
		$temporaryIcons.stop(true, true);
	}
})();
///////////////////////////////////////////////////////////////
// Corner Status Icons ////////////////////////////////////////
///////////////////////////////////////////////////////////////
function CornerStatusIcons()
{
	var self = this;
	var iconMap = new Object();
	// Icon names should be unique and alphanumeric ([0-9A-Za-z_]) because they are used to build the name of a setting.
	self.iconList = new Array();
	self.iconList.push({
		name: "recording",
		iconHtml: '<svg class="icon"><use xlink:href="#svg_x5F_Stoplight"></use></svg>',
		rgb: "255,0,0",
		title: "A camera is recording"
	});
	self.iconList.push({
		name: "trigger",
		iconHtml: '<svg class="icon"><use xlink:href="#svg_x5F_Alert2"></use></svg>',
		rgb: "255,64,64",
		title: "A camera is triggered"
	});
	self.iconList.push({
		name: "motion",
		iconHtml: '<svg class="icon noflip"><use xlink:href="#svg_mio_run"></use></svg>',
		rgb: "120,205,255",
		title: "Motion is detected"
	});
	this.Set = function (iconName, show)
	{
		if (show && self.IsIconEnabled(iconName))
			self.Show(iconName);
		else
			self.Hide(iconName);
	}
	this.Show = function (iconName)
	{
		var icon = iconMap[iconName];
		if (icon && !icon.visible && icon.$ele)
		{
			icon.$ele.show();
			icon.visible = true;
		}
	}
	this.Hide = function (iconName)
	{
		var icon = iconMap[iconName];
		if (icon && icon.visible && icon.$ele)
		{
			icon.$ele.hide();
			icon.visible = false;
		}
	}
	this.ShowAll = function ()
	{
		for (var key in iconMap)
			this.Show(key);
	}
	this.HideAll = function ()
	{
		for (var key in iconMap)
			this.Hide(key);
	}
	this.IsIconEnabled = function (iconName)
	{
		return settings.getItem("ui3_icon_" + iconName) !== "0";
	}
	this.ReInitialize = function ()
	{
		/// <summary>This can be called at any time to recreate icons from iconList, e.g. if new icons were added to the array.</summary>
		var $container = $("#cornerStatusIcons");
		$container.empty();
		iconMap = new Object();
		for (var i = 0; i < self.iconList.length; i++)
		{
			var icon = self.iconList[i];
			iconMap[icon.name] = icon;
			icon.$ele = $('<div class="cornerStatusIconWrapper"></div>');
			icon.$ele.attr('iconName', icon.name);
			icon.$ele.attr('title', icon.title);
			icon.$ele.html(icon.iconHtml);
			if (icon.rgb)
			{
				icon.$ele.css("color", "rgba(" + icon.rgb + ",1)");
				if (settings.ui3_icons_extraVisibility === "1")
				{
					icon.$ele.css("border-color", "rgba(" + icon.rgb + ",0.5)");
					icon.$ele.css("background-color", "rgba(" + icon.rgb + ",0.3)");
				}
			}
			if (icon.visible)
			{
				icon.visible = false;
				self.Show(icon.name);
			}
			$container.append(icon.$ele);
		}
	}
	this.ReInitialize();
}
///////////////////////////////////////////////////////////////
// Sound Effect Player ////////////////////////////////////////
///////////////////////////////////////////////////////////////
function BISoundEffect()
{
	var self = this;
	var audio = null;
	this.Play = function (file, volume)
	{
		if (!volume)
			volume = 0;
		if (file)
		{
			if (file == "None")
			{
				if (audio && !audio.ended)
					audio.pause();
				return;
			}
			var path = currentServer.remoteBaseURL + "sounds/" + file;
			if (!audio)
			{
				audio = new Audio(path);
				audio.addEventListener("error", function ()
				{
					if (audio)
						HandleAudioError(audio.error);
				});
			}
			else if (audio.src != path)
			{
				if (!audio.ended)
					audio.pause();
				audio.src = path;
			}
			self.AdjustVolume(volume);
			var playPromise = audio.play();

			if (playPromise && playPromise["catch"])
				playPromise["catch"](function (ex)
				{
					try
					{
						toaster.Error("Audio Play Error: " + htmlEncode(ex.name) + "<br>" + htmlEncode(ex.message), 15000);
					}
					catch (e)
					{
						console.error(e);
					}
				});
		}
	}
	this.AdjustVolume = function (volume)
	{
		if (audio)
			audio.volume = volume / 100;
	}
	var HandleAudioError = function (error)
	{
		try
		{
			var sb = new StringBuilder("<br>");
			sb.Append("Audio Error: ");
			if (error)
			{
				sb.Append("code ");
				sb.Append(htmlEncode(error.code));
				sb.Append(" (");
				sb.Append(GetMediaErrorMessage(error.code));
				sb.AppendLine(")");
				sb.Append(htmlEncode(error.message));
			}
			else
				sb.Append("Unknown error");
			toaster.Warning(sb.ToString(), 10000);
		}
		catch (e)
		{
			console.error(error, e);
		}
	}
}
var biSoundPlayer = new (function ()
{
	var self = this;
	var playerCache = new Object();
	this.PlayEvent = function (event)
	{
		var player = playerCache[event];
		if (!player)
			player = playerCache[event] = new BISoundEffect();

		var file = settings.getItem("ui3_sound_" + event);
		player.Play(file, settings.ui3_eventSoundVolume);
	}
	this.AdjustVolume = function ()
	{
		for (var event in playerCache)
		{
			var player = playerCache[event];
			player.AdjustVolume(settings.ui3_eventSoundVolume);
		}
	}
	this.TestUserInputRequirement = function ()
	{
		if ((settings.ui3_sound_motion !== "None" || settings.ui3_sound_trigger !== "None")
			&& settings.ui3_eventSoundVolume > 0)
		{
			try
			{
				// HTML5 audio (sound effect player)
				if (typeof Audio === "function")
				{
					var audio = new Audio();
					audio.play().catch(function (ex)
					{
						if (ex.name === "NotAllowedError")
						{
							inputRequiredOverlay.Show("event-triggered sound player");
						}
					});
				}
			}
			catch (ex) { }
		}
	}
})();
///////////////////////////////////////////////////////////////
// Input Required Overlay /////////////////////////////////////
///////////////////////////////////////////////////////////////
var inputRequiredOverlay = new (function ()
{
	var self = this;
	var $inputOverlay = $('<div class="inputRequiredToPlay"><div>Click anywhere to begin streaming.<br>The <span class="inputRequiredBy">HTML5 player</span> requires user input before playback can begin.</div></div>');
	var $inputRequiredBy = $inputOverlay.find('.inputRequiredBy');
	var listeners = [];

	var isActive = false;
	var isCallingListeners = false;

	var overlayClicked = function ()
	{
		self.Hide();
		isCallingListeners = true;
		for (var i = 0; i < listeners.length; i++)
		{
			try
			{
				listeners[i]();
			}
			catch (ex)
			{
				toaster.Warning(ex);
			}
		}
		isCallingListeners = false;
		listeners = [];
	}

	$inputOverlay.on('click', overlayClicked);

	this.AddListener = function (callbackFn)
	{
		if (isCallingListeners)
			return;
		if (typeof callbackFn === "function")
			listeners.push(callbackFn);
	}
	this.Show = function (name, callbackFn)
	{
		self.Hide();
		self.AddListener(callbackFn);
		$inputRequiredBy.text(name);
		$('body').append($inputOverlay);
		$inputOverlay.on('click', overlayClicked);
		isActive = true;
	}
	this.Hide = function ()
	{
		$inputOverlay.off('click', overlayClicked);
		$inputOverlay.remove();
		isActive = false;
	}
	this.IsActive = function ()
	{
		return isActive;
	}
})();
///////////////////////////////////////////////////////////////
// Customizable Streaming Profiles ////////////////////////////
///////////////////////////////////////////////////////////////
function StreamingProfileUI()
{
	var self = this;
	var initialized = false;
	var dialog = null;
	var $dlg = $();
	var $content = $();
	var $profileList = $();
	var dragDropHelper;

	this.open = function ()
	{
		CloseDialog();
		$dlg = $('<div class="streamingProfileUiPanel dialogOptionPanel"></div>');
		$content = $('<div class="streamingProfileUiPanelContent"></div>');
		$dlg.append($content);

		$content.append('<div class="dialogOption_item_info">These streaming profiles are unique to your browser. Changing them will not affect anyone else.</div>');

		var $defaultBtn = $('<input type="button" value="Restore missing default profiles" />"');
		$defaultBtn.on('click', function ()
		{
			genericQualityHelper.RestoreDefaultProfiles(false);
			RepopulateProfileList();
		});
		$content.append($('<div class="dialogOption_item_info"></div>').append($defaultBtn));

		var $addBtn = $('<input type="button" value="Create new profile" />"');
		$addBtn.on('click', AddProfile);
		$content.append($('<div class="dialogOption_item_info"></div>').append($addBtn));

		$content.append('<div class="dialogOption_item_info">Click to edit, hold and drag to reorder:</div>');

		$profileList = $('<ol class="profileList"></ol>');
		$content.append($profileList);
		dragDropHelper = new DragAndDropHelper($profileList, UserChangedOrder);

		RepopulateProfileList();

		dialog = $dlg.dialog({ title: "UI3 Streaming Profiles" });
	}
	var RepopulateProfileList = function ()
	{
		$profileList.empty();
		for (var i = 0; i < genericQualityHelper.profiles.length; i++)
		{
			var p = genericQualityHelper.profiles[i];
			var $p = $('<li class="profileListItem"></li>');
			$p.attr('name', p.name);
			$p.append(p.GetNameEle());
			$p.append($('<div class="profileCodec"></div>').text("(" + p.vcodec + ")"))
			$p.attr('title', p.GetTooltipText());
			$p.on('click', ProfileClicked);
			if (!p.IsCompatible())
				$p.addClass('unsupportedProfile');
			$profileList.append($p);
		}
		dragDropHelper.Rebind();
	}
	var ProfileClicked = function (e)
	{
		var name = this.getAttribute('name');
		new StreamingProfileEditor(genericQualityHelper.GetProfileWithName(name), ProfileEditedCallback);
	}
	var AddProfile = function ()
	{
		var newProfileNumber = 0;
		var newProfile = new StreamingProfile();
		newProfile.name = name;
		var validName = false;
		while (!validName)
		{
			newProfileNumber++;
			newProfile.name = "New Profile " + newProfileNumber;
			validName = true;
			for (var i = 0; i < genericQualityHelper.profiles.length; i++)
				if (genericQualityHelper.profiles[i].name === newProfile.name)
				{
					validName = false;
					break;
				}
		}
		genericQualityHelper.profiles.splice(0, 0, newProfile);
		genericQualityHelper.SaveProfiles();
		RepopulateProfileList();
		$profileList.children().eq(0).click();
	}
	var UserChangedOrder = function (e, ui)
	{
		var sortHelper = {};
		$profileList.children().each(function (idx, ele)
		{
			sortHelper[ele.getAttribute('name')] = idx;
		});
		genericQualityHelper.profiles.sort(function (a, b)
		{
			return sortHelper[a.name] - sortHelper[b.name];
		});
		genericQualityHelper.SaveProfiles();
	}
	var ProfileEditedCallback = function ()
	{
		RepopulateProfileList();
	}
	var CloseDialog = function ()
	{
		if (dragDropHelper)
		{
			dragDropHelper.Destroy();
			dragDropHelper = null;
		}
		if (dialog != null)
		{
			dialog.close();
			dialog = null;
		}
	}
}
function StreamingProfileEditor(srcProfile, profileEditedCallback)
{
	var self = this;
	var p = srcProfile.Clone();
	var dialog = null;
	var $dlg = $();
	var $content = $();
	var rowIdx;

	var Initialize = function ()
	{
		var alreadyOpen = false;
		$('.streamingProfileEditorPanel').each(function (idx, ele)
		{
			if (ele.getAttribute('profileName') === srcProfile.name)
			{
				alreadyOpen = true;
				$(ele).parent().trigger('mousedown');
			}
		});
		if (alreadyOpen)
			return;
		$dlg = $('<div class="streamingProfileEditorPanel dialogOptionPanel"></div>');
		$dlg.attr('profileName', srcProfile.name);
		$content = $('<div class="streamingProfileEditorPanelContent"></div>');

		ReRender();

		$dlg.append($content);
		dialog = $dlg.dialog({
			title: '<span>Profile: ' + srcProfile.GetNameEle().html() + '</span>'
			, onClosing: DialogClosing
		});
	}
	var ReRender = function ()
	{
		$content.empty();
		rowIdx = 0;
		AddEditorField("Profile Name", "name", { max: 21 });
		AddEditorField("Abbreviation (0-4 characters)", "abbr", { max: 4 });
		AddEditorField("Abbreviation Color", "aClr", { type: "color" });
		AddEditorField("Video Codec", "vcodec", { type: "select", options: ["jpeg", "h264"], onChange: ReRender });
		if (!p.IsCompatible())
			AddEditorField("UI3 can't play this codec in your current web browser. This profile will not be available.", "vcodec", { type: "errorComment" });
		AddEditorField("Base Server Profile", "stream", { type: "select", options: [GetServerProfileString(0), GetServerProfileString(1), GetServerProfileString(2)] });
		AddEditorField("Each profile inherits encoding parameters from one of the server's streaming profiles. You may override individual parameters below.", "stream", { type: "comment" });
		AddEditorField("Max Frame Width", "w", { min: 1, max: 99999 });
		AddEditorField("Max Frame Height", "h", { min: 1, max: 99999 });
		AddEditorField("Quality [0-100]", "q", { min: 0, max: 100 });
		if (p.vcodec === "h264")
		{
			AddEditorField("Frame Rate [0-60]", "fps", { min: 0, max: 60 });
			AddEditorField("Limit Bit Rate", "limitBitrate", { type: "select", options: ["inherit", "No Limit", "Yes Limit"] });
			AddEditorField("Max Bit Rate (Kbps) [10-8192]", "kbps", { min: 10, max: 8192 });
			AddEditorField("Keyframe Interval [1-99999]", "gop", { min: 1, max: 99999 });
			AddEditorField("Preset", "pre", { type: "select", options: ["inherit", "ultrafast", "superfast", "veryfast"] });
			AddEditorField("Profile", "pro", { type: "select", options: ["inherit", "default", "baseline", "main", "extended", "high", "high 10"] });
			AddEditorField("Zero-Frame Latency", "zfl", { type: "select", options: ["inherit", "No", "Yes"] });
		}
		var $deleteBtn = $('<input type="button" value="Delete This Profile" />');
		$deleteBtn.on('click', DeleteClicked);
		var $cancelBtn = $('<input type="button" style="float:right; margin-right: 10px;" value="Cancel" />');
		$cancelBtn.on('click', CloseDialog);
		var $saveBtn = $('<input type="button" style="float:right;" value="Save" />');
		$saveBtn.on('click', SaveAndClose);
		$content.append($('<div class="dialogOption_item_info"></div>').append($deleteBtn).append($saveBtn).append($cancelBtn));
	}
	var GetServerProfileString = function (i)
	{
		var str = "Streaming " + i;
		var desc = GetTooltipForStreamQuality(i);
		if (desc)
			str += " (" + desc + ")";
		return str;
	}
	var AddEditorField = function (label, key, options)
	{
		if (!options)
			options = {};
		var $row = $('<div class="profileEditorRow"></div>');
		if (rowIdx++ % 2 === 1)
			$row.addClass('everyOther');

		var value = p[key];
		var valueType = typeof value;
		var type = options.type;
		if (!type)
			type = valueType;

		if (valueType === "number")
		{
			if (value < 0)
			{
				p[key] = -1;
				value = "";
			}
			else if (typeof options.min === "number" && value < options.min)
			{
				p[key] = options.min;
				value = options.min;
			}
			else if (typeof options.max === "number" && value > options.max)
			{
				p[key] = options.max;
				value = options.max;
			}
		}

		var formFields = {
			value: value
			, label: label
			, tag: key
		};
		if (type === "boolean")
		{
			formFields.inputType = "checkbox";
			formFields.onChange = CheckboxChanged;
		}
		else if (type === "string")
		{
			formFields.inputType = "text";
			formFields.onChange = TextChanged;
			formFields.maxValue = options.max;
		}
		else if (type === "color")
		{
			formFields.inputType = "color";
			formFields.onChange = TextChanged;
			formFields.maxValue = 7;
			if (formFields.value.length === 6)
				formFields.value = "#" + formFields.value;
		}
		else if (type === "number")
		{
			formFields.inputType = "number";
			formFields.onChange = NumberChanged;
			formFields.minValue = options.min;
			formFields.maxValue = options.max;
		}
		else if (type === "select")
		{
			formFields.inputType = "select";
			formFields.onChange = SelectChanged
			formFields.options = options.options;
			if (valueType === "number")
			{
				if (valueType < 0 || valueType >= options.options.length)
					toaster.Error("Profile Editor Error: invalid value for " + label + ": " + value, 30000);
				else
					formFields.value = options.options[value];
			}
		}
		else if (type === "comment")
		{
			formFields.inputType = "commentText";
		}
		else if (type === "errorComment")
		{
			formFields.inputType = "errorCommentText";
		}
		else
		{
			formFields.inputType = "noteText";
			formFields.label = "Unknown object type: '" + type + "' with value '" + value + "' and label '" + label + "'";
		}
		if (typeof options.onChange === "function")
		{
			// An extra onChange method was provided. Create a wrapper to see both applied.
			var oldOnChange = formFields.onChange;
			formFields.onChange = function ()
			{
				if (typeof oldOnChange === "function")
					oldOnChange.apply(this, arguments);
				options.onChange.apply(this, arguments);
			}
		}
		$row.append(UIFormField(formFields));

		$content.append($row);
	}
	var CheckboxChanged = function (key, checked)
	{
		p[key] = checked;
	}
	var TextChanged = function (e, key, $input)
	{
		p[key] = $input.val();
	}
	var SelectChanged = function (e, key, $select)
	{
		var type = typeof p[key];
		if (type === "number")
			$select.children('option').each(function (idx, ele)
			{
				if ($(ele).is(':selected'))
				{
					p[key] = idx;
					return;
				}
			});
		else
			p[key] = $select.val();
	}
	var NumberChanged = function (e, key, $input)
	{
		var value = parseFloat($input.val());
		if (isNaN(value))
			p[key] = -1;
		else
		{
			var min = parseFloat($input.attr('min'));
			var max = parseFloat($input.attr('max'));
			if (min > max)
			{
				var tmp = min;
				min = max;
				max = tmp;
			}
			if (!isNaN(min) && value < min)
				$input.val(value = min);
			else if (!isNaN(max) && value > max)
				$input.val(value = max);
			p[key] = value;
		}
	}
	var SaveAndClose = function ()
	{
		if (isNullOrWhitespace(p.name))
		{
			SimpleDialog.Text("A profile must have at least one printable character in its name.");
			return;
		}
		p.name = p.name.trim();
		if (srcProfile.name !== p.name)
			for (var i = 0; i < genericQualityHelper.profiles.length; i++)
			{
				if (genericQualityHelper.profiles[i].name === p.name)
				{
					SimpleDialog.Text("A profile with the name '" + p.name + "' already exists.");
					return;
				}
			}
		for (var i = 0; i < genericQualityHelper.profiles.length; i++)
		{
			if (genericQualityHelper.profiles[i].name === srcProfile.name)
			{
				genericQualityHelper.profiles[i] = p;
				if (settings.ui3_streamingQuality === srcProfile.name)
				{
					// Current profile is changing
					genericQualityHelper.QualityChoiceChanged(p.name);
					if (playbackControls.IsVisible())
					{
						playbackControls.FadeOut();
						playbackControls.Show();
					}
				}
				genericQualityHelper.SaveProfiles();
				if (typeof profileEditedCallback === "function")
					profileEditedCallback(p.name);
				CloseDialog();
				toaster.Success("Saved Profile " + p.GetNameEle().html(), 1500);
				return true;
			}
		}
		SimpleDialog.Text("Unable to locate original profile to replace it. Name: '" + srcProfile.name + "'")
	}
	var DialogClosing = function ()
	{
		if (!p.Equals(srcProfile))
		{
			SimpleDialog.ConfirmText("Save changes to this profile?", function ()
			{
				SaveAndClose();
			}, function ()
				{
					CloseDialog();
				});
			return true;
		}
	}
	var DeleteClicked = function ()
	{
		SimpleDialog.ConfirmText("Delete this profile?", function ()
		{
			for (var i = 0; i < genericQualityHelper.profiles.length; i++)
			{
				if (genericQualityHelper.profiles[i].name === srcProfile.name)
				{
					genericQualityHelper.profiles.splice(i, 1);
					genericQualityHelper.SaveProfiles();
					if (typeof profileEditedCallback === "function")
						profileEditedCallback();
					CloseDialog();
					return;
				}
			}
		});
	}
	var CloseDialog = function ()
	{
		if (dialog != null)
		{
			dialog.close(true);
			dialog = null;
		}
	}
	Initialize();
}
function StreamingProfile()
{
	var self = this;
	this.dv = 2; // default version
	this.name = "Unnamed Streaming Profile";
	this.abbr = "";
	this.aClr = "#004882";
	this.vcodec = "h264";
	this.stream = 0;
	// All the remaining options are "optional".  Values of -1 mean to inherit the argument from the server-side stream.
	this.w = -1;
	this.h = -1;
	this.q = -1;
	// Above values apply to H.264 and JPEG.
	// Below values apply only to H.264.
	this.limitBitrate = 0; // 0: Inherit, 1: No, 2: Yes
	this.kbps = -1; // Only if limitBitrate === 2
	this.fps = -1;
	this.gop = -1;
	this.zfl = -1;
	this.pre = -1; // Preset
	this.pro = -1; // Profile

	this.GetNameText = function ()
	{
		return self.name.replace('^', '');
	}
	this.GetNameEle = function ()
	{
		var $ele = $('<span></span>');
		if (self.name.indexOf('^') > -1)
		{
			$ele.text(self.GetNameText());
			var $sup = $('<sup></sup>');
			$sup.text(self.abbr);
			var aClr = self.GetAbbrColor();
			$sup.css('margin-left', '3px');
			$sup.css('padding', '0px 2px');
			$sup.css('background-color', "#" + aClr);
			$sup.css('color', "#" + GetReadableTextColorHexForBackgroundColorHex(aClr, "000000", "FFFFFF"));
			$ele.append($sup);
		}
		else
			$ele.text(self.name);
		return $ele;
	}
	this.GetAbbrColor = function ()
	{
		/// <summary>Returns the 6-digit hex string representing the abbreviation color.</summary>
		if (self.aClr && self.aClr.length === 6)
			return self.aClr;
		else if (self.aClr && self.aClr.length === 7)
			return self.aClr.substr(1);
		return "004882";
	}
	this.Equals = function (other)
	{
		for (var prop in self)
		{
			var value = self[prop];
			var type = typeof value;
			if ((type === 'string' || type === 'number' || type === 'boolean') && value !== other[prop])
				return false;
		}
		return true;
	}
	this.Clone = function ()
	{
		var newProfile = new StreamingProfile();
		for (var prop in self)
		{
			var value = self[prop];
			var type = typeof value;
			if (type === 'string' || type === 'number' || type === 'boolean')
				newProfile[prop] = value;
		}
		return newProfile;
	}

	this.GetUrlArgs = function (w, h)
	{
		var sb = new StringBuilder();

		sb.Append("&stream=").Append(self.stream);

		if (self.q >= 0)
			sb.Append("&q=").Append(self.q);

		// Jpeg size arguments are handled elsewhere.
		if (self.vcodec === "h264")
		{
			// function args w and h are the native resolution of the stream, and will help us determine what to request here.
			// However this method should still work if w and h were omitted.
			var nativePx = 0;
			var aspect;
			if (w && h)
			{
				aspect = w / h;
				nativePx = w * h;
			}
			else
				aspect = 16 / 9;
			if (self.w > 0 && self.h > 0 && nativePx > 0)
			{
				// If both width and height are provided in the profile, UI3 treats them as just a total pixel count.
				// This enables decent handling of rotated views and different aspect ratios.
				var profilePx = self.w * self.h;
				var reducer = Math.sqrt(profilePx / nativePx);
				if (reducer < 1)
					sb.Append("&h=").Append(Math.round(h * reducer)); // Profile requests fewer pixels than native
				else if (self.h > h)
					sb.Append("&h=").Append(self.h);
				else
					sb.Append("&h=").Append(h);
			}
			else if (self.h >= 1)
				sb.Append("&h=").Append(self.h);
			else if (self.w >= 1)
				sb.Append("&h=").Append(Math.round(self.w / aspect));

			var kbps = -1; // -1: inherit, 0: no limit, 10-8192: limit
			if (self.limitBitrate === 1)
				kbps = 0; // Sentinel value instructing Blue Iris to use no limit
			else if (self.limitBitrate === 2)
				kbps = Clamp(self.kbps, 10, 8192);
			var max = settings.ui3_streamingProfileBitRateMax;
			if (max)
			{
				max = Clamp(parseInt(max), -1, 8192);
				if (max >= 10 && (max < kbps || kbps === -1 || kbps === 0))
					kbps = max;
			}
			if (kbps === 0 || kbps >= 10)
				sb.Append("&kbps=").Append(kbps);

			if (self.fps >= 0)
				sb.Append("&fps=").Append(self.fps);

			if (Precondition_ui3_force_gop_1sec() && settings.ui3_force_gop_1sec === "1")
			{
				var forced_GOP = videoPlayer.Loading().cam.FPS || 10;
				if (self.fps > 0 && self.fps < forced_GOP)
					forced_GOP = self.fps;
				sb.Append("&gop=").Append(Clamp(forced_GOP, 3, 60));
			}
			else if (self.gop >= 1)
				sb.Append("&gop=").Append(self.gop);

			if (self.zfl > 0)
				sb.Append("&zfl=").Append(self.zfl - 1);

			if (self.pre > 0)
				sb.Append("&preset=").Append(self.pre - 1);

			if (self.pro > 0)
				sb.Append("&profile=").Append(self.pro - 1);
		}
		return sb.ToString();
	}
	this.GetTooltipText = function ()
	{
		var sb = new StringBuilder('\n');

		sb.Append(self.vcodec + ' ');

		if (self.w > 0 && self.h > 0)
			sb.Append(self.w + 'x' + self.h + ' ');
		else if (self.w > 0)
			sb.Append(self.w + 'w ');
		else if (self.h > 0)
			sb.Append(self.h + 'h ');

		if (self.fps >= 0)
			sb.Append('@' + self.fps + 'fps ');

		if (self.q > -1)
			sb.Append('q' + self.q + ' ');

		if (self.limitBitrate === 1)
			sb.Append('no bitrate limit ');
		else if (self.limitBitrate === 2 && self.kbps > -1)
			sb.Append('<' + Clamp(self.kbps, 10, 8192) + ' Kbps ');

		sb.AppendLine().AppendLine();

		var streamDesc = GetTooltipForStreamQuality(self.stream);
		sb.Append('Inherits from Streaming ' + self.stream + (streamDesc ? (' (' + GetTooltipForStreamQuality(self.stream) + ')') : ''));

		return sb.ToString();
	}
	this.IsCompatible = function ()
	{
		return self.vcodec === "jpeg" || (h264_playback_supported && self.vcodec === "h264");
	}
}
///////////////////////////////////////////////////////////////
// Generic Quality Helper /////////////////////////////////////
///////////////////////////////////////////////////////////////
function GenericQualityHelper()
{
	var self = this;
	self.profiles = new Array();

	this.GetCurrentProfile = function ()
	{
		if (!self.profiles || self.profiles.length === 0)
			self.RestoreDefaultProfiles();
		for (var i = 0; i < self.profiles.length; i++)
			if (self.profiles[i].name === settings.ui3_streamingQuality)
			{
				if (!self.profiles[i].IsCompatible())
					continue;
				return self.profiles[i];
			}
		return self.GetAnyCompatibleProfile();
	}
	this.GetAnyCompatibleProfile = function (didRestoreDefaults)
	{
		// Try to find the best profile
		// First, one with a max bit rate nearest 1000
		var best = null;
		if (h264_playback_supported)
		{
			// Find one near 1400 Kbps
			if (!best) best = self.FindBestProfile("h264", function (p)
			{
				if (p.limitBitrate === 2 && p.kbps > 0)
					return Math.abs(p.kbps - 1400);
				return -1;
			});
			// Then, one around 1 MP
			if (!best) best = self.FindBestProfile("h264", function (p) { return p.w < 1 || p.h < 1 ? -1 : Math.abs((p.w * p.h) - 1000000); });
			if (!best) best = self.FindBestProfile("h264", function (p) { return p.w < 1 ? -1 : Math.abs(p.w - 1000); });
			if (!best) best = self.FindBestProfile("h264", function (p) { return p.h < 1 ? -1 : Math.abs(p.h - 1000); });
			// Then, one with q near 25
			if (!best) best = self.FindBestProfile("h264", function (p) { return p.q < 0 ? -1 : Math.abs(p.q - 25); });
		}
		// Fall back to the best jpeg profile
		if (!best) best = self.FindBestProfile("jpeg", function (p)
		{
			return (p.w <= 1 && p.h <= 1) || (p.w > 2000 && p.h > 2000) ? 1 : -1;
		});
		// As a last resort, just pick one
		if (!best) best = self.FindBestProfile("any", function (p) { return 1; });
		if (best)
			return best;

		if (didRestoreDefaults)
		{
			toaster.Error("Unable to locate a compatible streaming profile even after restoring default profiles.", 30000);
			return null;
		}
		toaster.Info("Unable to locate a compatible streaming profile. Restoring default profiles.", 5000);
		self.RestoreDefaultProfiles();
		return self.GetAnyCompatibleProfile(true);
	}
	this.FindBestProfile = function (vcodec, valuationFn)
	{
		/// <summary>Returns the compatible profile with the lowest non-negative output from valuationFn.</summary>
		var bestProfile = null;
		var valueOfBest = -1;
		for (var i = 0; i < self.profiles.length; i++)
		{
			var p = self.profiles[i];
			if (p.IsCompatible() && (vcodec === "any" || vcodec === p.vcodec))
			{
				var valueOfP = valuationFn(p);
				if (valueOfP >= 0 && (valueOfBest < 0 || valueOfP < valueOfBest))
				{
					bestProfile = p;
					valueOfBest = valueOfP;
				}
			}
		}
		return bestProfile;
	}
	this.QualityChoiceChanged = function (name)
	{
		var p = self.GetProfileWithName(name);
		if (!p || !p.IsCompatible())
		{
			p = self.GetAnyCompatibleProfile();
			NotifyQualitySelectionChanged(p);
			name = p.name;
		}
		for (var i = 0; i < self.profiles.length; i++)
			if (self.profiles[i].name === name)
			{
				settings.ui3_streamingQuality = name;
				dropdownBoxes.setLabelText("streamingQuality", self.profiles[i].GetNameText());
				if (videoPlayer)
					videoPlayer.SelectedQualityChanged();
				return;
			}
	}
	var NotifyQualitySelectionChanged = function (p)
	{
		toaster.Info("The active streaming profile has changed to " + p.GetNameEle().html(), 3000);
	}
	this.SetStreamingQualityDropdownBoxItems = function ()
	{
		var arr = new Array();
		for (var i = 0; i < self.profiles.length; i++)
		{
			var p = self.profiles[i];
			if (p.IsCompatible())
				arr.push(new DropdownListItem({ text: p.GetNameText(), uniqueId: p.name, GetTooltip: p.GetTooltipText }));
		}
		dropdownBoxes.listDefs["streamingQuality"].items = arr;
	}
	this.GetProfileWithName = function (name)
	{
		for (var i = 0; i < self.profiles.length; i++)
			if (self.profiles[i].name === name)
				return self.profiles[i];
		return null;
	}
	this.getSeekPreviewQualityArgs = function (dimKey, dimValue)
	{
		var playerId = self.GetCurrentProfile().vcodec;
		if (playerId == "h264")
		{
			var bitRate_Video = bitRateCalc_Video.GetBestGuess() * 8;
			var bitRate_Audio = bitRateCalc_Audio.GetBestGuess() * 8;
			var bitRateMbps = (bitRate_Video + bitRate_Audio) / 1000000;
			var sizeLimit;
			var quality;
			if (bitRateMbps < 0.5)
			{
				sizeLimit = Math.min(dimValue, 320);
				quality = 20;
			}
			else if (bitRateMbps < 1)
			{
				sizeLimit = Math.min(dimValue, 480);
				quality = 20;
			}
			else if (bitRateMbps < 1.67)
			{
				sizeLimit = Math.min(dimValue, 640);
				quality = 25;
			}
			else if (bitRateMbps < 2.33)
			{
				sizeLimit = Math.min(dimValue, 640);
				quality = 50;
			}
			else if (bitRateMbps < 3.5)
			{
				sizeLimit = Math.min(dimValue, 1280);
				quality = 50;
			}
			else // Plenty of bandwidth. Get whatever resolution fits best.
			{
				sizeLimit = dimValue;
				quality = 50;
			}
			return "&" + dimKey + "=" + sizeLimit + "&q=" + quality;
		}
		else
			return "&" + dimKey + "=" + jpegQualityHelper.ModifyImageDimension(dimKey, dimValue) + jpegQualityHelper.getQualityArg();
	}

	this.GenerateDefaultProfiles = function ()
	{
		var profiles = new Array();
		{
			var p = new StreamingProfile();
			p.name = "2160p^";
			p.abbr = "4K";
			p.aClr = "#008248";
			p.w = 3840;
			p.h = 2160;
			p.limitBitrate = 2;
			p.kbps = 8192;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "1440p^";
			p.abbr = "4MP";
			p.aClr = "#0048A2";
			p.w = 2560;
			p.h = 1440;
			p.limitBitrate = 2;
			p.kbps = 4096;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "1080p^";
			p.abbr = "2MP";
			p.aClr = "#004882";
			p.w = 1920;
			p.h = 1080;
			p.limitBitrate = 2;
			p.kbps = 2048;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "720p^";
			p.abbr = "1MP";
			p.aClr = "#003862";
			p.w = 1280;
			p.h = 720;
			p.limitBitrate = 2;
			p.kbps = 1024;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "480p";
			p.abbr = "480p";
			p.aClr = "#884400";
			p.w = 856;
			p.h = 480;
			p.limitBitrate = 2;
			p.kbps = 456;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "360p";
			p.abbr = "360p";
			p.aClr = "#883000";
			p.w = 640;
			p.h = 360;
			p.limitBitrate = 2;
			p.kbps = 256;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "240p";
			p.abbr = "240p";
			p.aClr = "#882000";
			p.w = 427;
			p.h = 240;
			p.limitBitrate = 2;
			p.kbps = 114;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "144p";
			p.abbr = "144p";
			p.aClr = "#880000";
			p.w = 256;
			p.h = 144;
			p.limitBitrate = 2;
			p.kbps = 41;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "Jpeg HD";
			p.vcodec = "jpeg";
			p.abbr = "HD";
			p.aClr = "#004882";
			p.w = 99999;
			p.h = 99999;
			p.q = 85;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "Jpeg SD";
			p.vcodec = "jpeg";
			p.abbr = "SD";
			p.aClr = "#884400";
			p.w = 640;
			p.h = 640;
			p.q = 50;
			profiles.push(p);
		}
		{
			var p = new StreamingProfile();
			p.name = "Jpeg Low";
			p.vcodec = "jpeg";
			p.abbr = "LD";
			p.aClr = "#880000";
			p.w = 320;
			p.h = 320;
			p.q = 20;
			profiles.push(p);
		}
		return profiles;
	}
	var upgradeDefaultProfileData = function (profileData)
	{
		var upgradeMap = {
			"1440p^": { abbr: "4MP", aClr: "#0048A2" },
			"1080p^": { abbr: "2MP", aClr: "#004882" },
			"720p^": { abbr: "1MP", aClr: "#003862" },
			"480p": { abbr: "480p", aClr: "#884400" },
			"360p": { abbr: "360p", aClr: "#883000" },
			"240p": { abbr: "240p", aClr: "#882000" },
			"144p": { abbr: "144p", aClr: "#880000" }
		};
		var upgradeMade = false;
		for (var i = 0; i < profileData.length; i++)
		{
			if (profileData[i].dv && profileData[i].dv >= 2)
				continue;
			var u = upgradeMap[profileData[i].name];
			if (u)
			{
				profileData[i].dv = 2;
				for (var key in u)
					profileData[i][key] = u[key];
				upgradeMade = true;
			}
		}
		return upgradeMade;
	}
	this.RestoreDefaultProfiles = function (replaceExisting)
	{
		var defaultProfiles = self.GenerateDefaultProfiles();
		if (self.profiles && self.profiles.length > 0)
		{
			for (var i = 0; i < defaultProfiles.length; i++)
			{
				var foundExisting = false;
				for (var n = 0; n < self.profiles.length; n++)
				{
					if (defaultProfiles[i].name === self.profiles[n].name)
					{
						foundExisting = true;
						if (replaceExisting)
							self.profiles[n] = defaultProfiles[i];
						break;
					}
				}
				if (!foundExisting)
					self.profiles.push(defaultProfiles[i]);
			}
		}
		else
			self.profiles = defaultProfiles;
		self.SaveProfiles();
	}
	this.LoadProfiles = function ()
	{
		try
		{
			self.profiles = new Array();
			var profileData = JSON.parse(settings.ui3_streamingProfileArray);
			var upgradeMade = upgradeDefaultProfileData(profileData);
			for (var i = 0; i < profileData.length; i++)
				self.profiles.push($.extend(new StreamingProfile(), profileData[i]));
			self.SetStreamingQualityDropdownBoxItems();
			if (upgradeMade)
				self.SaveProfiles();
		}
		catch (ex)
		{
			alert("Your streaming profiles could not be loaded, and will be restored to defaults.");
		}
	}
	var isInSavingProfilesFunc = false;
	this.SaveProfiles = function ()
	{
		try
		{
			settings.ui3_streamingProfileArray = JSON.stringify(self.profiles);

			if (isInSavingProfilesFunc)
				return; // Prevent infinitely looping here in case the default profiles don't have anything compatible.
			try
			{
				isInSavingProfilesFunc = true;
				for (var i = 0; i < self.profiles.length; i++)
					if (self.profiles[i].name === settings.ui3_streamingQuality)
					{
						if (!self.profiles[i].IsCompatible())
							continue;
						return;
					}
				var p = self.GetAnyCompatibleProfile();
				self.QualityChoiceChanged(p.name);
				NotifyQualitySelectionChanged(p);
			}
			finally
			{
				isInSavingProfilesFunc = false;
			}
		}
		finally
		{
			self.SetStreamingQualityDropdownBoxItems();
		}
	}

	self.LoadProfiles();
	if (!self.profiles || self.profiles.length === 0)
		this.RestoreDefaultProfiles();
	self.QualityChoiceChanged(settings.ui3_streamingQuality);
}
///////////////////////////////////////////////////////////////
// Jpeg Quality Helper ////////////////////////////////////////
///////////////////////////////////////////////////////////////
function JpegQualityHelper()
{
	var self = this;
	this.getQualityArg = function ()
	{
		var p = genericQualityHelper.GetCurrentProfile();
		if (p.q)
			return "&q=" + p.q;
		else
			return "";
	}
	this.ModifyImageDimension = function (dimKey, dimValue)
	{
		var p = genericQualityHelper.GetCurrentProfile();
		if (dimKey === "w")
		{
			if (p.w > 0)
				return Math.min(dimValue, p.w);
			return dimValue;
		}
		else
		{
			if (p.h > 0)
				return Math.min(dimValue, p.h);
			return dimValue;
		}
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
		if (lastLiveContextMenuSelectedCamera == null || !cameraListLoader.CameraIsAlone(lastLiveContextMenuSelectedCamera))
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
			if (lastLiveContextMenuSelectedCamera.isFakeGroup)
				itemsToDisable.push("maximize");
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
		videoOverlayHelper.HideFalseLoadingOverlay();

		var downloadButton = $("#cmroot_liveview_downloadbutton_findme").closest(".b-m-item");
		if (downloadButton.parent().attr("id") == "cmroot_liveview_downloadlink")
			downloadButton.parent().attr("href", videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85" /* LOC0 */);
		else
			downloadButton.wrap('<a id="cmroot_liveview_downloadlink" style="display:block" href="'
				+ videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85" /* LOC0 */
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
				if (!cameraListLoader.CameraIsAlone(lastLiveContextMenuSelectedCamera))
					toaster.Warning("Function is unavailable.");
				else
					videoPlayer.ImgClick_Camera(lastLiveContextMenuSelectedCamera);
				break;
			case "trigger":
				if (!cameraListLoader.CameraIsAlone(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot trigger cameras that are part of an auto-cycle.");
				else
					TriggerCamera(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "record":
				if (!cameraListLoader.CameraIsAlone(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot toggle recording of cameras that are part of an auto-cycle.");
				else
					ManualRecordCamera(lastLiveContextMenuSelectedCamera.optionValue, $("#manRecBtnLabel").attr("start"));
				break;
			case "snapshot":
				if (!cameraListLoader.CameraIsAlone(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot save a snapshot of cameras that are part of an auto-cycle.");
				else
					SaveSnapshotInBlueIris(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "restart":
				if (!cameraListLoader.CameraIsAlone(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot restart cameras that are part of an auto-cycle.");
				else
					ResetCamera(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "properties":
				if (!cameraListLoader.CameraIsAlone(lastLiveContextMenuSelectedCamera))
					toaster.Warning("You cannot view properties of cameras that are part of an auto-cycle.");
				else
					new CameraProperties(lastLiveContextMenuSelectedCamera.optionValue);
				break;
			case "openhls":
				hlsPlayer.OpenDialog(videoPlayer.Loading().image.id);
				break;
			case "opennewtab":
				window.open(videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85"); /* LOC0 */
				break;
			case "copyimageaddress":
				var relUrl = videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85"; /* LOC0 */
				if (!relUrl.startsWith("/"))
					relUrl = "/" + relUrl;
				clipboardHelper.CopyText(location.origin + relUrl);
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
		videoOverlayHelper.HideFalseLoadingOverlay();
		videoOverlayHelper.HideTemporaryIcons();

		var clipData = lastRecordContextMenuSelectedClip = clipLoader.GetClipFromId(videoPlayer.Loading().image.uniqueId);
		var clipInfo = clipLoader.GetDownloadClipInfo(clipData);

		var downloadButton = $("#cmroot_recordview_downloadbutton_findme").closest(".b-m-item");
		if (downloadButton.parent().attr("id") == "cmroot_recordview_downloadlink")
			downloadButton.parent().attr("href", videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85" /* LOC0 */);
		else
			downloadButton.wrap('<a id="cmroot_recordview_downloadlink" style="display:block" href="'
				+ videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85" /* LOC0 */
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
					clipProperties.open(lastRecordContextMenuSelectedClip.recId);
				break;
			case "opennewtab":
				videoPlayer.Playback_Pause();
				window.open(videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85"); /* LOC0 */
				break;
			case "saveas":
				return true;
			case "downloadclip":
				return true;
			case "exportavi":
				exportControls.Enable(videoPlayer.Loading().image.uniqueId);
				break;
			case "closeclip":
				clipLoader.CloseCurrentClip();
				return;
			case "statsfornerds":
				nerdStats.Open();
				return;
			case "copyimageaddress":
				var relUrl = videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85"; /* LOC0 */
				if (!relUrl.startsWith("/"))
					relUrl = "/" + relUrl;
				clipboardHelper.CopyText(location.origin + relUrl);
				break;
			default:
				toaster.Error(this.data.alias + " is not implemented!");
				break;
		}
	}
	var exportListItem = exporting_clips_to_avi_supported ? { text: 'Export as AVI', icon: "#svg_mio_VideoFilter", iconClass: "noflip", alias: "exportavi", action: onRecordContextMenuAction } : { type: "skip" };
	var optionRecord =
	{
		alias: "cmroot_record", width: 200, items:
			[
				{ text: "Open image in new tab", icon: "", alias: "opennewtab", action: onRecordContextMenuAction }
				, { text: '<div id="cmroot_recordview_downloadbutton_findme" style="display:none"></div>Save image to disk', icon: "#svg_x5F_Snapshot", alias: "saveas", action: onRecordContextMenuAction }
				, { text: '<span id="cmroot_recordview_downloadclipbutton">Download clip</span>', icon: "#svg_x5F_Download", alias: "downloadclip", action: onRecordContextMenuAction }
				, exportListItem
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
	var protectEnable = false;

	var onShowMenu = function (menu)
	{
		var itemsToEnable = ["flag", "protect", "download", "delete", "larger_thumbnails", "mouseover_thumbnails"];
		var itemsToDisable = [];

		var singleClipItems = itemsToEnable;
		if (clipLoader.GetAllSelected().length > 1)
			singleClipItems = itemsToDisable;
		singleClipItems.push("properties");
		if (exporting_clips_to_avi_supported)
			singleClipItems.push("exportavi");

		menu.applyrule({ name: "disable_items", disable: true, items: itemsToDisable });
		menu.applyrule({ name: "enable_items", disable: false, items: itemsToEnable });

	}
	var onTriggerContextMenu = function (e)
	{
		var downloadClipButton = $("#cm_cliplist_download").closest(".b-m-item");
		if (downloadClipButton.parent().attr("id") != "cmroot_cliplist_downloadcliplink")
			downloadClipButton.wrap('<a id="cmroot_cliplist_downloadcliplink" style="display:block" href="javascript:void(0)" target="_blank"></a>');
		var $dl_link = $("#cmroot_cliplist_downloadcliplink");

		var recId = e.currentTarget.id.substr(1);
		if (!clipLoader.IsClipSelected(recId))
		{
			clipLoader.UnselectAllClips();
			clipLoader.SelectClipIdNoOpen(recId);
		}

		allSelectedClipIDs = clipLoader.GetAllSelected();

		flagEnable = false; // Turn all off, but if one is already off, then turn all on.
		protectEnable = false;
		for (var i = 0; i < allSelectedClipIDs.length; i++)
		{
			var clipData = clipLoader.GetClipFromId(allSelectedClipIDs[i]);
			if (clipData)
			{
				if ((clipData.flags & clip_flag_flag) == 0)
					flagEnable = true;
				if ((clipData.flags & clip_flag_protect) == 0)
					protectEnable = true;
			}
		}

		if (allSelectedClipIDs.length == 1)
		{
			var clipData = clipLoader.GetClipFromId(allSelectedClipIDs[0]);

			$("#cm_cliplist_flag").text(flagEnable ? "Flag" : "Unflag");
			$("#cm_cliplist_protect").text(protectEnable ? "Protect" : "Unprotect");
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
			$("#cm_cliplist_protect").text((protectEnable ? "Protect" : "Unprotect") + label);
			$("#cm_cliplist_download").text("Download" + label);
			$("#cm_cliplist_delete").text("Delete" + label);
			$dl_link.attr("href", "javascript:void(0)");
			$dl_link.removeAttr("download");
		}

		if (getLargerClipThumbnails())
			$("#cm_cliplist_larger_thumbnails").text("Shrink Thumbnails");
		else
			$("#cm_cliplist_larger_thumbnails").text("Enlarge Thumbnails");

		if (getMouseoverClipThumbnails())
			$("#cm_cliplist_mouseover_thumbnails").text("Disable Mouseover Thumbs");
		else
			$("#cm_cliplist_mouseover_thumbnails").text("Enable Mouseover Thumbs");
		return true;
	}
	var onContextMenuAction = function ()
	{
		switch (this.data.alias)
		{
			case "flag":
				var whatAction = (flagEnable ? "flag" : "unflag");
				var whichKind = (currentPrimaryTab == "clips" ? "clip" : "alert") + (allSelectedClipIDs.length == 1 ? "" : "s");
				if (allSelectedClipIDs.length <= 12)
					clipLoader.Multi_Flag(allSelectedClipIDs, flagEnable);
				else
					AskYesNo("Confirm " + whatAction + " of " + allSelectedClipIDs.length + " " + whichKind + "?", function ()
					{
						clipLoader.Multi_Flag(allSelectedClipIDs, flagEnable);
					});
				break;
			case "protect":
				var whatAction = (protectEnable ? "protect" : "unprotect");
				var whichKind = (currentPrimaryTab == "clips" ? "clip" : "alert") + (allSelectedClipIDs.length == 1 ? "" : "s");
				if (allSelectedClipIDs.length <= 12)
					clipLoader.Multi_Protect(allSelectedClipIDs, protectEnable);
				else
					AskYesNo("Confirm " + whatAction + " of " + allSelectedClipIDs.length + " " + whichKind + "?", function ()
					{
						clipLoader.Multi_Protect(allSelectedClipIDs, protectEnable);
					});
				break;
			case "download":
				if (allSelectedClipIDs.length == 1)
					return true;
				else
					clipDownloadDialog.open(allSelectedClipIDs);
				break;
			case "delete":
				var whichKind = (currentPrimaryTab == "clips" ? "clip" : "alert") + (allSelectedClipIDs.length == 1 ? "" : "s");
				AskYesNo("Confirm deletion of " + allSelectedClipIDs.length + " " + whichKind + "?", function ()
				{
					clipLoader.Multi_Delete(allSelectedClipIDs);
				});
				break;
			case "larger_thumbnails":
				toggleLargerClipThumbnails();
				break;
			case "mouseover_thumbnails":
				toggleMouseoverClipThumbnails();
				break;
			case "exportavi":
				if (allSelectedClipIDs.length >= 1)
				{
					videoPlayer.LoadClip(clipLoader.GetClipFromId(allSelectedClipIDs[0]));
					exportControls.Enable(videoPlayer.Loading().image.uniqueId);
				}
				else
					toaster.Warning("No " + (currentPrimaryTab == "clips" ? "clip" : "alert") + " is selected.");
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
	var exportListItemSplitline = exporting_clips_to_avi_supported ? { type: "splitLine" } : { type: "skip" };
	var exportListItem = exporting_clips_to_avi_supported ? { text: "Export as AVI", icon: "#svg_mio_VideoFilter", iconClass: "noflip", alias: "exportavi", action: onContextMenuAction } : { type: "skip" };
	var menuOptions =
	{
		alias: "cmroot_cliplist", width: 200, items:
			[
				{ text: '<span id="cm_cliplist_flag">Flag</span>', icon: "#svg_x5F_Flag", iconClass: "", alias: "flag", action: onContextMenuAction }
				, { text: '<span id="cm_cliplist_protect">Protect</span>', icon: "#svg_mio_lock", iconClass: "noflip", alias: "protect", action: onContextMenuAction }
				, { text: '<span id="cm_cliplist_download">Download</span>', icon: "#svg_x5F_Download", alias: "download", action: onContextMenuAction }
				, { text: '<span id="cm_cliplist_delete">Delete</span>', icon: "#svg_mio_Trash", iconClass: "noflip", alias: "delete", action: onContextMenuAction }
				, { type: "splitLine" }
				, { text: '<span id="cm_cliplist_larger_thumbnails">Enlarge Thumbnails</span>', icon: "#svg_mio_imageLarger", iconClass: "noflip", alias: "larger_thumbnails", action: onContextMenuAction }
				, { text: '<span id="cm_cliplist_mouseover_thumbnails">Enlarge Thumbnails</span>', icon: "#svg_mio_popout", iconClass: "noflip rotate270", alias: "mouseover_thumbnails", action: onContextMenuAction }
				, exportListItemSplitline
				, exportListItem
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
function getLargerClipThumbnails()
{
	return settings.ui3_cliplist_larger_thumbnails == "1";
}
function toggleLargerClipThumbnails()
{
	settings.ui3_cliplist_larger_thumbnails = getLargerClipThumbnails() ? "0" : "1";
	resized();
}
function getMouseoverClipThumbnails()
{
	return settings.ui3_cliplist_mouseover_thumbnails == "1";
}
function toggleMouseoverClipThumbnails()
{
	settings.ui3_cliplist_mouseover_thumbnails = getMouseoverClipThumbnails() ? "0" : "1";
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
// Get Clip Stats /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var clipStatsLoader = new ClipStatsLoader();
function ClipStatsLoader()
{
	var self = this;
	var cache = {};
	var maxCacheAge = 10000;
	var queuedLoad = null;
	var activeLoad = null;
	this.LoadClipStats = function (clipId, onSuccess, preferCached)
	{
		/// <summary>Gets clipstats for the specified clip and sends the results to the onSuccess method.  If cached results are available (regardless of age), onSuccess will be called before this method returns.  If there is no cached value, or if the cached value is beyond the max age and "preferCached" is false, fresh data may be requested asynchronously and onSuccess may be called again later.  This method can be provided alert IDs as well, but it is preferable to provide clip IDs as these will be hit more often in the cache.</summary>
		if (!clipId)
			return;
		var cachedValue = cache[clipId];
		if (cachedValue)
		{
			if (onSuccess)
				onSuccess(cachedValue.getStats());
			if (preferCached || cachedValue.getAgeMs() < maxCacheAge)
				return;
		}
		GetFresh(clipId, onSuccess);
	}
	var GetFresh = function (clipId, onSuccess)
	{
		if (activeLoad)
		{
			activeLoad.canceled = true; // Prevent onSuccess from being raised for previous requests.
			queuedLoad = { clipId: clipId, onSuccess: onSuccess };
		}
		else
		{
			activeLoad = { clipId: clipId, onSuccess: onSuccess, canceled: false };
			GetClipStats(clipId, function (stats)
			{
				cache[clipId] = new CachedClipStats(stats);
				if (activeLoad && !activeLoad.canceled && onSuccess)
					onSuccess(stats, clipId);
				activeLoad = null;
				processQueuedLoad();
			}, function ()
				{
					activeLoad = null;
					processQueuedLoad();
				});
		}
	}
	var processQueuedLoad = function ()
	{
		if (queuedLoad)
		{
			GetFresh(queuedLoad.clipId, queuedLoad.onSuccess);
			queuedLoad = null;
		}
	}
	var GetClipStats = function (clipId, onSuccess, onFail)
	{
		ExecJSON({ cmd: "clipstats", path: clipId }, function (response)
		{
			if (typeof response.result == "undefined")
			{
				toaster.Error("Unexpected response when getting clip stats from server. This alert may have an inaccurate duration.");
				if (onFail)
					onFail(clipId);
			}
			else if (response.result == "fail")
			{
				toaster.Error("Fail response when getting clip stats from server. This alert may have an inaccurate duration.");
				if (onFail)
					onFail(clipId);
			}
			else
			{
				if (onSuccess)
					onSuccess(response.data, clipId);
			}
		}, function (jqXHR, textStatus, errorThrown)
			{
				toaster.Error("Error response when getting clip stats from server: " + jqXHR.status + " " + jqXHR.statusText + "<br>This alert may have an inaccurate duration.");
				if (onFail)
					onFail(clipId);
			});
	}
}
function CachedClipStats(stats)
{
	var created = performance.now();
	this.getStats = function ()
	{
		return stats;
	}
	this.getAgeMs = function ()
	{
		return performance.now() - created;
	}
}
///////////////////////////////////////////////////////////////
// Get / Set Camera Config ////////////////////////////////////
///////////////////////////////////////////////////////////////
function CameraConfig()
{
	var self = this;
	this.get = function (camId, successCallbackFunc, failCallbackFunc, adminLoginCallback)
	{
		ExecJSON({ cmd: "camconfig", camera: camId }, function (response)
		{
			if (typeof response.result == "undefined")
			{
				toaster.Error("Unexpected response when getting camera configuration from server.");
				if (failCallbackFunc)
					failCallbackFunc(camId);
				return;
			}
			if (response.result == "fail")
			{
				if (failCallbackFunc)
					failCallbackFunc(camId);
				openLoginDialog(adminLoginCallback);
				return;
			}
			if (successCallbackFunc)
				successCallbackFunc(response, camId);
		}, function (jqXHR, textStatus, errorThrown)
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
				openLoginDialog(function () { self.set(camId, key, value, successCallbackFunc, failCallbackFunc); });
				return;
			}
			console.log('CameraConfig Set ("' + htmlEncode(camId) + '", "' + htmlEncode(key) + '", "' + htmlEncode(value) + '")');
			if (successCallbackFunc)
				successCallbackFunc(response, camId, key, value);
		}, function (jqXHR, textStatus, errorThrown)
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
		new CameraProperties(camId);
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
function CameraProperties(camId)
{
	var self = this;
	var modal_cameraPropDialog = null;
	var loadedOnce = false;
	var $dlg = $('<div class="campropdialog"></div>');
	var $camprop = $('<div class="campropcontent dialogOptionPanel"><div style="text-align: center">Loading...</div></div>');
	$dlg.append($camprop);

	var $btnPause = $();
	var $btnManrec = $();
	var $btnDisable = $();
	var initialize = function ()
	{
		var camName = cameraListLoader.GetCameraName(camId);
		modal_cameraPropDialog = $dlg.dialog({
			title: "Camera Properties"
			, overlayOpacity: 0.3
			, closeOnOverlayClick: true
			, onClosing: function ()
			{
				BI_CustomEvent.RemoveListener("CameraListLoaded", CameraListLoadedCb);
				modal_cameraPropDialog = null;
				cameraListDialog.refresh();
			}
			, onRefresh: function () { self.refresh(); }
		});
		BI_CustomEvent.AddListener("CameraListLoaded", CameraListLoadedCb);

		self.refresh();
	}
	this.refresh = function ()
	{
		if (modal_cameraPropDialog)
		{
			modal_cameraPropDialog.setLoadingState(true);

			cameraConfig.get(camId, function (response)
			{
				if (modal_cameraPropDialog == null)
					return;
				modal_cameraPropDialog.setLoadingState(false);

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
						$infoSection.append(GetInfo("Name", CleanUpGroupName(cam.optionDisplay)));
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
					var $selectRecord = GetSelectRow("Record:", "record",
						GetHtmlOptionElementMarkup("-1", "Only manually", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("0", "Every X.X minutes", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("1", "Continuously", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("2", "When triggered", response.data.record.toString())
						+ GetHtmlOptionElementMarkup("3", "Triggered + periodically", response.data.record.toString()));
					$generalSection.append($selectRecord);
					var $selectAlerts = GetSelectRow("Alerts:", "alerts",
						GetHtmlOptionElementMarkup("-1", "Never", response.data.alerts.toString())
						+ GetHtmlOptionElementMarkup("0", "This camera is triggered", response.data.alerts.toString())
						+ GetHtmlOptionElementMarkup("1", "Any camera in group is triggered", response.data.alerts.toString())
						+ GetHtmlOptionElementMarkup("2", "Any camera is triggered", response.data.alerts.toString()));
					$generalSection.append($selectAlerts);
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
					var $selectHighlight = GetSelectRow("Highlight:", "setmotion.showmotion",
						GetHtmlOptionElementMarkup("0", "No", response.data.setmotion.showmotion.toString())
						+ GetHtmlOptionElementMarkup("1", "Motion", response.data.setmotion.showmotion.toString())
						+ GetHtmlOptionElementMarkup("2", "Objects", response.data.setmotion.showmotion.toString())
						+ GetHtmlOptionElementMarkup("3", "Motion + Objects", response.data.setmotion.showmotion.toString()));
					$motionSection.append($selectHighlight);
					$camprop.append($motionSection);

					var collapsible = new CollapsibleSection('mro', "Manual Recording Options", modal_cameraPropDialog);
					$camprop.append(collapsible.$heading);
					var $manrecSection = collapsible.$section;
					var $btnSet1 = $('<div class="dialogOption_item dialogOption_item_center"></div>');
					$btnSet1.append(GetCameraPropertyButton("Trigger", "trigger", "largeBtnYellow", camId));
					$btnSet1.append(GetCameraPropertyButton("Snapshot", "snapshot", "largeBtnBlue", camId));
					$btnSet1.append($btnManrec = GetCameraPropertyButton("Toggle Recording", "manrec", "largeBtnRed", camId));
					$manrecSection.append($btnSet1);
					$camprop.append($manrecSection);

					var collapsible = new CollapsibleSection('mgmt', "Camera Management", modal_cameraPropDialog);
					$camprop.append(collapsible.$heading);
					var $mgmtSection = collapsible.$section;
					var $btnSet2 = $('<div class="dialogOption_item dialogOption_item_center"></div>');
					$btnSet2.append($btnPause = GetCameraPropertyButton("Pause", "pause", "largeBtnYellow", camId));
					$btnSet2.append(GetCameraPropertyButton("Restart", "reset", "largeBtnBlue", camId));
					$btnSet2.append($btnDisable = GetCameraPropertyButton("Disable", "disable", "largeBtnRed", camId));
					$mgmtSection.append($btnSet2);
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
					$camprop.append('<div class="dialogOption_item dialogOption_item_center"><input type="button" class="simpleTextButton btnTransparent" onclick="Camera_OpenRaw(&quot;' + camId + '&quot;)" value="view raw data" /></div>');

				modal_cameraPropDialog.contentChanged(!loadedOnce);
				loadedOnce = true;
				CameraListLoaded(response.data);
			}
				, function ()
				{
					modal_cameraPropDialog.close();
				}
				, function ()
				{
					self.open(camId);
				});
		}
	}
	var CameraListLoadedCb = function ()
	{
		CameraListLoaded();
	}
	var CameraListLoaded = function (cam)
	{
		if (!cam)
			cam = cameraListLoader.GetCameraWithId(camId);
		if (!cam)
			return;
		if (cam.pause == 0)
			$btnPause.val("Pause")
		else if (cam.pause < 0)
			$btnPause.val("Paused (no limit)");
		else
			$btnPause.val("Paused (" + msToTime(cam.pause * 1000) + ")");
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
	var GetCameraPropertyButton = function (text, buttonId, colorClass, camId)
	{
		var $btn = $('<input type="button" class="largeTextButton ' + colorClass + '" value="' + text + '" />');
		$btn.click(function ()
		{
			camPropButtonClick(camId, buttonId);
		});
		return $btn;
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
	var GetSelectRow = function (label, settingKey, options)
	{
		var $row = $('<div class="dialogOption_item dialogOption_item_ddl"></div>');
		var $select = $('<select></select>');
		$select.on('change', function ()
		{
			var selectedValue = parseInt($select.val());
			cameraConfig.set(camId, settingKey, selectedValue);
		});
		$select.append(options);
		$row.append($select);
		$row.append(GetDialogOptionLabel(label));
		return $row;
	}
	var camPropButtonClick = function (camId, button)
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
				ManualRecordCamera(camId, $btnManrec.attr("start"), SetCameraPropertyManualRecordButtonState);
				break;
			case "reset":
				ResetCamera(camId);
				break;
			case "disable":
				cameraConfig.set(camId, "enable", $btnDisable.attr("enabled") != "1"
					, function ()
					{
						SetCameraPropertyEnableButtonState($btnDisable.attr("enabled") != "1");
					});
				break;
			case "pause":
				new CameraPauseDialog(camId);
				break;
			default:
				toaster.Error(button + " not implemented in this UI version");
				break;
		}
	}
	var SetCameraPropertyManualRecordButtonState = function (is_recording)
	{
		if (is_recording)
		{
			$btnManrec.val("Stop Recording");
			$btnManrec.attr("start", "0");
		}
		else
		{
			$btnManrec.val("Start Recording");
			$btnManrec.attr("start", "1");
		}
	}
	var SetCameraPropertyEnableButtonState = function (is_enabled)
	{
		if (is_enabled)
		{
			$btnDisable.val("Disable");
			$btnDisable.attr("enabled", "1");
			$btnDisable.removeClass("largeBtnGreen");
			$btnDisable.addClass("largeBtnRed");
		}
		else
		{
			$btnDisable.val("Enable");
			$btnDisable.attr("enabled", "0");
			$btnDisable.removeClass("largeBtnRed");
			$btnDisable.addClass("largeBtnGreen");
		}
	}

	initialize();
}
function Camera_OpenRaw(camId)
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
///////////////////////////////////////////////////////////////
// Clip Properties Dialog /////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipProperties()
{
	var self = this;
	this.open = function (recId)
	{
		var dialog = null;
		var clipData = clipLoader.GetClipFromId(recId);

		var camName = cameraListLoader.GetCameraName(clipData.camera);

		var $dlg = $('<div class="campropdialog"></div>');
		var $camprop = $('<div class="campropcontent selectable"></div>');
		$dlg.append($camprop);

		try
		{
			var $thumb = $('<img class="clipPropertiesThumb" src="" alt="clip thumbnail"></img>');
			var thumbPath = currentServer.remoteBaseURL + "thumbs/" + clipData.thumbPath + currentServer.GetRemoteSessionArg("?");
			$thumb.attr('src', thumbPath);
			$thumb.css("border-color", "#" + clipData.colorHex);
			$camprop.append($thumb);

			$camprop.append(GetInfo("Date", GetDateStr(clipData.displayDate)));
			if (clipData.isClip)
				$camprop.append(GetInfo("Real Time", clipData.roughLength).attr("title", "Real Time: Length of real time this clip covers.\nMay be significantly longer than Play Time if created from multiple alerts."));
			$camprop.append(GetInfo("Play Time", msToTime(clipData.msec)));
			if (clipData.isClip)
				$camprop.append(GetInfo("Size", clipData.fileSize));
			else
				$camprop.append(GetInfo("Zones", clipData.rawData.zones));

			if ((clipData.flags & alert_flag_trigger_motion) > 0)
				$camprop.append(GetIcon("trigger_motion", "Triggered by motion detection"));
			if ((clipData.flags & alert_flag_trigger_audio) > 0)
				$camprop.append(GetIcon("trigger_audio", "Triggered by audio"));
			if ((clipData.flags & alert_flag_trigger_external) > 0)
				$camprop.append(GetIcon("trigger_external", "Triggered by external source such as DIO or manual trigger"));
			if ((clipData.flags & alert_flag_trigger_group) > 0)
				$camprop.append(GetIcon("trigger_group", "The group was triggered"));
			if ((clipData.flags & clip_flag_audio) > 0)
				$camprop.append(GetIcon("clip_audio", "Clip has audio"));
			if ((clipData.flags & clip_flag_backingup) > 0)
				$camprop.append(GetIcon("clip_backingup", "Clip is currently being backed up"));
			if ((clipData.flags & clip_flag_backedup) > 0)
				$camprop.append(GetIcon("clip_backedup", "Clip has been backed up"));
			if ((clipData.flags & clip_flag_protect) > 0)
				$camprop.append(GetIcon("protect", "Item is protected"));
			if ((clipData.flags & clip_flag_flag) > 0)
				$camprop.append(GetIcon("flag", "Flagged"));
			if ((clipData.flags & clip_flag_is_recording) > 0)
				$camprop.append(GetIcon("is_recording", "Clip is still recording"));
			if ((clipData.flags & alert_flag_nosignal) > 0)
				$camprop.append(GetIcon("nosignal", "Camera had no signal"));

			var $link = $('<a href="javascript:void(0)">Click here to download the clip.</a>');
			var clipInfo = clipLoader.GetDownloadClipInfo(clipData);
			$link.attr("href", clipInfo.href);
			if (clipInfo.download)
			{
				$link.text(clipInfo.download);
				$link.attr("download", clipInfo.download);
			}
			$camprop.append(GetInfoEleValue("Download", $link));

			if (exporting_clips_to_avi_supported)
			{
				var $exportBtn = $('<a href="javascript:void(0)">Export a section of the clip.</a>');
				$exportBtn.on('click', function ()
				{
					videoPlayer.LoadClip(clipData);
					exportControls.Enable(videoPlayer.Loading().image.uniqueId);
					dialog.close();
				});
				$camprop.append(GetInfoEleValue("Export as AVI", $exportBtn));
			}

			if (developerMode)
			{
				$camprop.append(GetInfo("Flags", InsertSpacesInBinary(dec2bin(clipData.flags), 32)));
			}
		}
		catch (ex)
		{
			toaster.Error(ex);
		}
		if (developerMode)
			$camprop.append('<div class="dialogOption_item dialogOption_item_center"><input type="button" class="simpleTextButton btnTransparent" onclick="ClipProperties_OpenRaw(&quot;' + recId + '&quot;)" value="view raw data" /></div>');

		dialog = $dlg.dialog({
			title: htmlEncode(camName) + ' ' + (clipData.isClip ? "Clip" : "Alert") + ' Properties'
			, overlayOpacity: 0.3
			, closeOnOverlayClick: true
		});
	}
	var GetIcon = function (icon, label)
	{
		var $iconRow = $('<div class="dialogOption_item clipprop_item_info"></div>');
		$iconRow.append(clipLoader.GetClipIcon(icon)).append(label);
		return $iconRow;
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
}
function ClipProperties_OpenRaw(recId)
{
	var clipData = clipLoader.GetClipFromId(recId);
	objectVisualizer.open(clipData, "Clip Properties (raw)");
}
///////////////////////////////////////////////////////////////
// Clip Download Dialog ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function ClipDownloadDialog()
{
	var self = this;
	this.open = function (allSelectedClipIDs)
	{
		var $dlg = $('<div class="campropdialog"></div>');
		var $camprop = $('<div class="campropcontent"></div>');
		$dlg.append($camprop);

		$camprop.append('<div class="dialogOption_item clipprop_item_info">Click each link to download the desired clips.</div>');
		$camprop.append('<div class="dialogOption_item clipprop_item_info">Each link will disappear after it is clicked, so you can\'t accidentally download duplicates.</div>');
		for (var i = 0; i < allSelectedClipIDs.length; i++)
			$camprop.append(GetLink(allSelectedClipIDs[i]));

		$dlg.dialog({ title: "Download Multiple Clips" });
	}
	var GetLink = function (recId)
	{
		var clipData = clipLoader.GetClipFromId(recId);
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
// Clip Export Dialog /////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ActiveClipExportDialog(clipData, startTimeMs, endTimeMs, includeAudio)
{
	// <summary>This dialog controls the actual export operation and lacks a normal close button.</summary>
	var self = this;
	var clipInfo = clipLoader.GetDownloadClipInfo(clipData);
	var durationMs = endTimeMs - startTimeMs;
	var userHasDownloadedAVI = false;

	var fastExport = false;
	if (clipData.rawClipData.filetype)
	{
		var fileTypeParts = clipData.rawClipData.filetype.split(' ');
		for (var i = 0; i < fileTypeParts.length; i++)
			fileTypeParts[i] = fileTypeParts[i].toLowerCase();
		var isBVR = fileTypeParts.indexOf("bvr") > -1;
		var isH264 = fileTypeParts.indexOf("h264") > -1;
		fastExport = isBVR && isH264;
	}

	var $dlg = $('<div class="activeExportDialog"></div>');
	var $content = $('<div class="campropcontent"></div>');
	$dlg.append($content);

	var $exportTypeRow = $('<div class="dialogOption_item clipprop_item_info">Export Type: </div>');
	var $exportType = $('<span></span>');
	$exportTypeRow.append($exportType);
	$exportTypeRow.append('<a href="javascript:UIHelp.LearnMore(\'Export Types\')">(learn more)</a>');
	$content.append($exportTypeRow);

	var $linkLabel = $('<div class="dialogOption_item clipprop_item_info">Your AVI file is being generated.</div>');
	$content.append($linkLabel);

	var $status = $('<div class="dialogOption_item clipprop_item_info">Starting export…</div>');
	$content.append($status);

	var $closeBtn = $('<input type="button" value="Cancel" style="display:block;margin:40px auto 0px auto;" iscancel="1" />');
	$content.append($closeBtn);

	var updateExportType = function ()
	{
		if (fastExport)
			$exportType.text("Native ");
		else
			$exportType.text("Slow Transcode ");
	}
	updateExportType();

	var progressUpdate = function (state, message)
	{
		$status.text(message);
	}
	var exportComplete = function (dataUri, finishedSuccessfully)
	{
		if (dataUri)
		{
			$status.after(GetLink(dataUri));
			$status.remove();
			if (finishedSuccessfully)
				$linkLabel.text("Click the link below to save!");
			else
				$linkLabel.text("The export did not complete, but we got some video data.  Click the link below to save it!");
		}
		else
		{
			$linkLabel.text("Error!");
			userHasDownloadedAVI = true;
		}

		$closeBtn.val("Close");
		$closeBtn.attr('iscancel', '0');
	}

	var GetLink = function (dataUri)
	{
		var $link = $('<a href=""></a>');
		$link.attr("href", dataUri);
		$link.text(clipInfo.fileNameNoExt + ".avi");
		$link.attr("download", clipInfo.fileNameNoExt + ".avi");
		$link.on('click', function ()
		{
			userHasDownloadedAVI = true;
			return true;
		});
		return $('<div class="dialogOption_item clipprop_item_info"></div>').append($link);
	}

	var dialog = $dlg.dialog({
		title: "Export in Progress"
		, includeCloseButton: false
		, overlayOpacity: 0.5
		, onClosing: function ()
		{
			if (exportStreamer)
				exportStreamer.Dispose();
		}
	});
	$closeBtn.on('click', function ()
	{
		if ($closeBtn.attr('iscancel') == '1')
		{
			SimpleDialog.ConfirmText("Are you sure you wish to cancel this export?", function ()
			{
				dialog.close();
			});
		}
		else if (!userHasDownloadedAVI)
		{
			SimpleDialog.ConfirmHtml("You have not yet saved the exported AVI.<br>If you close this dialog now, the exported AVI file will be lost.<br><br>Are you sure you wish to close?", function ()
			{
				dialog.close();
			});
		}
		else
			dialog.close();
	});

	var exportStreamer = new ClipExportStreamer(clipData.path, startTimeMs, durationMs, !fastExport, includeAudio, progressUpdate, exportComplete, enableRecordingOffsetWorkaround);
}
///////////////////////////////////////////////////////////////
// Clip Export Streaming //////////////////////////////////////
///////////////////////////////////////////////////////////////
var ui3ClipIsExporting = false; // This flag helps the H.264 player module not end the fetch stream if the browser tab visibility changes.
var enableRecordingOffsetWorkaround = true;
function ClipExportStreamer(path, startTimeMs, durationMs, useTranscodeMethod, includeAudio, progressUpdate, exportCompleteCb, recordingOffsetWorkaround)
{
	var self = this;
	var aviEncoder = null;
	var dataUri = null;
	var totalVideoFrames = 0;
	var totalExportedTimeMs = 0;

	this.Dispose = function ()
	{
		ui3ClipIsExporting = false;
		if (dataUri)
		{
			setTimeout(function ()
			{
				window.URL.revokeObjectURL(dataUri);
			}, 1000);
		}
		aviEncoder = null;
		exportCompleteCb = null;
		if (safeFetch.IsActive())
		{
			safeFetch.CloseStream();
			console.log("Closed stream");
		}
	}

	var acceptFrame = function (frame, streams)
	{
		if (!exportCompleteCb)
			return;
		if (!aviEncoder)
		{
			toaster.Error("Streaming protocol error: Stream metadata was not received by ClipExportStreamer before the first frame!");
			return;
		}
		if (frame.isVideo)
		{
			aviEncoder.AddVideoFrame(frame.frameData, frame.isKeyframe());
			totalVideoFrames++;
			totalExportedTimeMs = frame.time;
			if (frame.time >= durationMs)
			{
				HandleAviReady(true, -1);
				safeFetch.CloseStream();
			}
			else
			{
				var percent = Math.round((frame.time / durationMs) * 100);
				progressUpdate(2, "Export progress: " + percent + "%");
			}
		}
		else if (frame.isAudio)
			aviEncoder.AddAudioFrame(frame.frameData, frame.isKeyframe());
	}
	var acceptStatusBlock = function (status)
	{
	}
	var streamInfoCallback = function (bitmapInfoHeader, waveFormatEx)
	{
		if (!exportCompleteCb)
			return;
		aviEncoder = new AVIEncoder("H264", bitmapInfoHeader, waveFormatEx ? "ulaw" : null, waveFormatEx);
		progressUpdate(1, "Export progress: 0%");
	}
	var StreamEnded = function (message, wasJpeg, wasAppTriggered, videoFinishedStreaming, responseError)
	{
		if (!exportCompleteCb)
			return;
		if (videoFinishedStreaming)
			HandleAviReady(true, 0);
		else
		{
			if (aviEncoder && totalVideoFrames > 0)
			{
				// At least one frame was received before the failure.  Provide the AVI but let it be known that we didn't get all we expected.
				HandleAviReady(false, -1);
			}
			else
			{
				console.error("Export Failed: " + message, responseError);
				if (responseError)
					HandleExportFailure("Export failed because the fetch video response was \"" + responseError + "\"");
				else
					HandleExportFailure("Export failed because the data stream ended prematurely!");
				exportCompleteCb = null;
			}
		}
	}
	var HandleAviReady = function (finishedSuccessfully, frameCountOffset)
	{
		if (exportCompleteCb)
		{
			if (finishedSuccessfully)
				progressUpdate(3, "Export progress: 100%");
			if (aviEncoder)
			{
				var fps;
				if (totalVideoFrames <= 0)
					HandleExportFailure("Export failed because no video frames were received.");
				else if (totalVideoFrames == 1 || totalExportedTimeMs <= 0)
					fps = 1;
				else
				{
					// frameCountOffset accounts for the fact that sometimes our totalExportedTimeMs value will not include the duration of the last frame.  In theory this results in a more accurate FPS calculation.
					fps = ((totalVideoFrames + frameCountOffset) / totalExportedTimeMs) * 1000;
				}
				exportCompleteCb(Uint8ArrayToDataURI(aviEncoder.FinishAndGetUint8Array(fps)), finishedSuccessfully);
			}
			else
				HandleExportFailure("Export failed because no stream metadata was received.");
			exportCompleteCb = null;
		}
	}
	var HandleExportFailure = function (reason)
	{
		progressUpdate(3, reason);
		toaster.Error(reason, 30000);
		if (exportCompleteCb)
			exportCompleteCb();
	}
	// Begin the clip export.

	if (typeof exportCompleteCb !== "function")
	{
		toaster.Error("API Error: no exportCompleteCb callback was provided to ClipExportStreamer");
		return;
	}

	ui3ClipIsExporting = true;
	videoPlayer.Playback_Pause();

	var beginRecording = function ()
	{
		var recordArg = useTranscodeMethod ? "" : "&record=1";
		var audioArg = "&audio=" + (includeAudio ? "1" : "0");
		var videoUrl = currentServer.remoteBaseURL + "file/clips/" + path + currentServer.GetRemoteSessionArg("?", true) + recordArg + audioArg + "&speed=100&stream=0&extend=2&time=" + startTimeMs;
		safeFetch.OpenStream(videoUrl, acceptFrame, acceptStatusBlock, streamInfoCallback, StreamEnded);
	}
	if (recordingOffsetWorkaround)
		DoExportRecordingOffsetWorkaround(beginRecording, path, startTimeMs);
	else
		beginRecording();
}
function DoExportRecordingOffsetWorkaround(callbackMethod, path, startTimeMs)
{
	// <summary>As of BI 4.7.4.4, seeking with "time" does not work if record=1, so this method performs a low-cost seek without the record argument and then the playback object will already be at the correct position, or close enough.</summary>
	var anyCallback = function ()
	{
		if (callbackMethod)
		{
			safeFetch.CloseStream();
			callbackMethod();
			callbackMethod = null;
		}
	}
	var videoUrl = currentServer.remoteBaseURL + "file/clips/" + path + currentServer.GetRemoteSessionArg("?", true) + "&speed=0&audio=0&stream=0&extend=2&w=160&q=10&time=" + startTimeMs;
	safeFetch.OpenStream(videoUrl, anyCallback, anyCallback, anyCallback, anyCallback);
}
///////////////////////////////////////////////////////////////
// Camera Pause Dialog ////////////////////////////////////////
///////////////////////////////////////////////////////////////
function CameraPauseDialog(camId)
{
	var self = this;
	var $status = $();
	var initialize = function ()
	{
		var camData = cameraListLoader.GetCameraWithId(camId);
		var $dlg = $('<div class="campausedialog"></div>');
		var $camprop = $('<div class="campropcontent"></div>');
		$dlg.append($camprop);

		$status = $('<div class="dialogOption_item clipprop_item_info"></div>');
		$camprop.append($status);
		$camprop.append(GetButton(camId, "Off (unpause)", 0));
		$camprop.append(GetButton(camId, "Add 30 seconds", 1));
		$camprop.append(GetButton(camId, "Add 5 minutes", 2));
		$camprop.append(GetButton(camId, "Add 30 minutes", 3));
		$camprop.append(GetButton(camId, "Add 1 hour", 4));
		$camprop.append(GetButton(camId, "Add 2 hours", 5));
		$camprop.append(GetButton(camId, "Add 3 hours", 6));
		$camprop.append(GetButton(camId, "Add 4 hours", 7));
		$camprop.append(GetButton(camId, "Add 10 hours", 8));
		$camprop.append(GetButton(camId, "Add 24 hours", 9));
		$camprop.append(GetButton(camId, "Indefinitely", -1));

		CameraListLoaded();
		BI_CustomEvent.AddListener("CameraListLoaded", CameraListLoadedCb);

		$dlg.dialog({
			title: "Pause " + camData.optionDisplay
			, overlayOpacity: 0.3
			, onClosing: function ()
			{
				BI_CustomEvent.RemoveListener("CameraListLoaded", CameraListLoadedCb);
			}
		});

	}
	var GetButton = function (camId, label, pauseValue)
	{
		var $row = $('<div class="dialogOption_item clipprop_item_info"></div>');
		var $btn = $('<input type="button" class="smallBtnYellow" value="' + label + '" />');
		$btn.click(function () { DoPause(camId, pauseValue); });
		$row.append($btn);
		return $row;
	}
	var DoPause = function (camId, pauseValue)
	{
		if (!sessionManager.IsAdministratorSession())
			openLoginDialog(function () { DoPause(camId, pauseValue); });
		else
			cameraConfig.set(camId, "pause", pauseValue, function (response)
			{
				CameraListLoaded(response.data);
			});
	}
	var CameraListLoadedCb = function ()
	{
		CameraListLoaded();
	}
	var CameraListLoaded = function (cam)
	{
		if (!cam)
			cam = cameraListLoader.GetCameraWithId(camId);
		if (!cam)
			return;
		if (cam.pause == 0)
			$status.text("Not paused")
		else if (cam.pause < 0)
			$status.text("Paused indefinitely");
		else
			$status.text("Paused for next " + msToTime(cam.pause * 1000));
	}

	initialize();
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
						toaster.Error("Unable to load jsonview library.<br>" + jqXHR.ErrorMessageHtml, 5000);
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

	if (cameraListLoader.CameraIsAlone(camData))
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
			openLoginDialog(function () { TriggerCamera(camId); });
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
			openLoginDialog(function () { UpdateClipFlags(path, flags, cbSuccess, cbFailure); });
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
			var msg = "Failed to delete " + clipOrAlert + ".<br/>";
			if (response.data && response.data.reason)
				msg += htmlEncode(response.data.reason);
			else
				msg += (sessionManager.IsAdministratorSession() ? ("The " + clipOrAlert + " may be still recording.") : ("You need administrator permission to delete " + clipOrAlert + "s."));
			if (typeof cbFailure == "function")
				cbFailure(msg);
			else
				toaster.Warning(msg, 10000);
			if (!sessionManager.IsAdministratorSession())
				openLoginDialog(function () { DeleteAlert(path, isClip, cbSuccess, cbFailure); });
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
	var $cb = $('<input id="ccb_' + myId + '" type="checkbox" class="sliderCb" ' + (checked ? 'checked="checked" ' : '') + '/>');
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
		$sysconfig.html('<div style="text-align: center">Loading...</div>');
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
				openLoginDialog(self.open);
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
				openLoginDialog(function () { SetSysConfig(key, value); });
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
	var dialog = null;
	var loadedOnce = false;
	var $content;

	var listSettings = $.extend({
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
		dialog = $dlg.dialog({
			title: listSettings.title
			, onRefresh: function () { refreshListDialog(); }
			, onClosing: function ()
			{
				dialog = null;
				loadedOnce = false;
			}
		});
		refreshListDialog();
	}
	var refreshListDialog = function ()
	{
		dialog.setLoadingState(true);
		ExecJSON({ cmd: listSettings.json_command }, function (response)
		{
			if (dialog == null)
				return;
			dialog.setLoadingState(false);
			if (typeof response.result == "undefined")
			{
				CloseListDialog();
				toaster.Error("Unexpected response when requesting " + listSettings.title + " from server.");
				return;
			}
			if (response.result == "fail")
			{
				CloseListDialog();
				openLoginDialog(self.open);
				return;
			}
			if (!$content || $content.length == 0)
				return;
			var sb = [];
			sb.push('<table><thead><tr>');
			for (var i = 0; i < listSettings.headers.length; i++)
			{
				sb.push('<th>');
				sb.push(listSettings.headers[i]);
				sb.push('</th>');
			}
			sb.push('</tr></thead><tbody></tbody></table>');
			$content.html(sb.join(""));
			var $tbody = $content.find("tbody");
			if (response.data)
			{
				for (var i = 0; i < response.data.length; i++)
					$tbody.append(listSettings.get_row(response.data[i]));
			}
			else
				$tbody.append('<tr><td colspan="' + listSettings.headers.length + '" style="text-align: center; padding: 16px 0px;">This list is empty.</td></tr>');
			dialog.contentChanged(!loadedOnce);
			loadedOnce = true;
		}, function ()
			{
				toaster.Error('Unable to contact Blue Iris server.', 3000);
				CloseListDialog();
			});
	}
	var CloseListDialog = function ()
	{
		if (dialog != null)
			dialog.close();
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
		.fail(function (jqXHR, textStatus, errorThrown)
		{
			if (jqXHR && jqXHR.status == 403)
				openLoginDialog(function () { SaveSnapshotInBlueIris(camId); });
			else
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
var adminLoginCallbackSuccess = null;
function openLoginDialog(callbackSuccess)
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
	adminLoginCallbackSuccess = callbackSuccess;
	loginModal = $("#loginDialog").dialog(
		{
			overlayOpacity: 0.3
			, closeOnOverlayClick: true
			, title: "Administrator Login"
			, onClosing: function ()
			{
				adminLoginCallbackSuccess = null;
			}
		});
}
function closeLoginDialog()
{
	adminLoginCallbackSuccess = null;
	if (loginModal != null)
	{
		loginModal.close();
		loginModal = null;
	}
}
///////////////////////////////////////////////////////////////
// Audio Decoder: mu-law //////////////////////////////////////
///////////////////////////////////////////////////////////////
var muLawDecoder = new MuLawDecoder();
function MuLawDecoder()
{
	var self = this;
	var decHelper = [-32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
	-23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
	-15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
	-11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
	-7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
	-5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
	-3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
	-2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
	-1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
	-1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
	-876, -844, -812, -780, -748, -716, -684, -652,
	-620, -588, -556, -524, -492, -460, -428, -396,
	-372, -356, -340, -324, -308, -292, -276, -260,
	-244, -228, -212, -196, -180, -164, -148, -132,
	-120, -112, -104, -96, -88, -80, -72, -64,
	-56, -48, -40, -32, -24, -16, -8, -1,
		32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
		23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
		15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
		11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
		7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
		5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
		3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
		2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
		1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
		1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
		876, 844, 812, 780, 748, 716, 684, 652,
		620, 588, 556, 524, 492, 460, 428, 396,
		372, 356, 340, 324, 308, 292, 276, 260,
		244, 228, 212, 196, 180, 164, 148, 132,
		120, 112, 104, 96, 88, 80, 72, 64,
		56, 48, 40, 32, 24, 16, 8, 0
	];
	this.DecodeUint8ArrayToInt16Array = function (encoded)
	{
		var decoded = new Int16Array(encoded.length);
		for (var i = 0; i < encoded.length; i++)
			decoded[i] = decHelper[encoded[i]];
		return decoded;
	}
	this.DecodeUint8ArrayToFloat32Array = function (encoded)
	{
		var decoded = new Float32Array(encoded.length);
		for (var i = 0; i < encoded.length; i++)
			decoded[i] = decHelper[encoded[i]] / 32768;
		return decoded;
	}
}
///////////////////////////////////////////////////////////////
// Audio Filter (silences crackle at frame boundaries) ////////
///////////////////////////////////////////////////////////////
function AudioEdgeFilter(buffer)
{
	var tmp = new Float32Array(1);

	buffer.copyFromChannel(tmp, 0, 0);

	var wasPositive = (tmp[0] > 0);

	for (var i = 0; i < buffer.length; i += 1)
	{
		buffer.copyFromChannel(tmp, 0, i);

		if ((wasPositive && tmp[0] < 0) || (!wasPositive && tmp[0] > 0))
			break;

		tmp[0] = 0;
		buffer.copyToChannel(tmp, 0, i);
	}

	buffer.copyFromChannel(tmp, 0, buffer.length - 1);

	wasPositive = (tmp[0] > 0);

	for (var i = buffer.length - 1; i > 0; i -= 1)
	{
		buffer.copyFromChannel(tmp, 0, i);

		if ((wasPositive && tmp[0] < 0) || (!wasPositive && tmp[0] > 0))
			break;

		tmp[0] = 0;
		buffer.copyToChannel(tmp, 0, i);
	}

	return buffer;
}
///////////////////////////////////////////////////////////////
// Audio Playback /////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function PcmAudioPlayer()
{
	var self = this;
	var supported = audio_playback_supported;
	var AudioContext;
	if (supported)
		AudioContext = window.AudioContext || window.webkitAudioContext;
	else
		AudioContext = FakeAudioContext_Dummy;

	var context = new AudioContext();
	context.suspend();
	var volumeController = context.createGain();
	var nextTime = 0; // This is the playback time in seconds at which we run out (or ran out) of audio.
	var audioStopTimeout = null;
	var suppressAudioVolumeSave = false;
	var suspended = true;
	var pendingBufferQueue = new Queue();
	//context.onstatechange = function ()
	//{
	//	switch (context.state)
	//	{
	//		case "suspended":
	//			break;
	//		case "running":
	//			break;
	//		case "closed":
	//			volumeIconHelper.setColorIdle();
	//			break;
	//	}
	//};
	this.AcceptBuffer = function (audio32, channels, sampleRate)
	{
		/// <summary>Queues a Float32Array of raw audio data (range -1.0 to 1.0) for playback.</summary>
		if (!supported)
			return;
		if (suspended)
		{
			suspended = false;
			context.resume();
		}
		var buffer = context.createBuffer(channels, audio32.length, sampleRate);
		buffer.copyToChannel(audio32, 0);

		var bufferSource = context.createBufferSource();
		bufferSource.buffer = AudioEdgeFilter(buffer);
		bufferSource.connect(volumeController);
		volumeController.connect(context.destination);

		var currentTime = context.currentTime;
		if (nextTime == 0)
			nextTime = currentTime + 0.2; // Add the initial audio delay in seconds.

		var duration = bufferSource.buffer.duration;
		var offset = currentTime - nextTime;
		if (offset > 0)
		{
			// This frame is late. Play it immediately.
			nextTime = currentTime;
			//console.log("Audio frame is LATE by", offset);
			offset = 0;
		}
		else if (offset < -0.7)
		{
			CheckUserInputRequirement();
			// We have received so many frames that we are queued at least 700ms ahead. Drop this frame.
			if (managedUserInputRequirement)
				console.log("Audio buffer is overfull at " + currentTime.toFixed(6) + " with " + Math.abs(offset.toFixed(6)) + " seconds queued. Dropping audio frame to keep delay from growing too high.");
			return;
		}
		pendingBufferQueue.enqueue(bufferSource);
		bufferSource.onended = DequeueBufferSource;
		volumeIconHelper.setEnabled(true);
		volumeIconHelper.setColorPlaying();

		bufferSource.start(nextTime);
		//bufferSource.stop(nextTime + duration);
		nextTime += duration;
	}
	var DequeueBufferSource = function ()
	{
		pendingBufferQueue.dequeue();
		if (pendingBufferQueue.isEmpty())
			volumeIconHelper.setColorLoading();
	}
	this.GetBufferedMs = function ()
	{
		if (!supported)
			return 0;
		var buffered = nextTime - context.currentTime;
		if (buffered < 0)
			return 0;
		return buffered * 1000;
	}
	this.SuppressAudioVolumeSave = function ()
	{
		return suppressAudioVolumeSave;
	}
	this.SetAudioVolumeFromSettings = function ()
	{
		if (!supported)
			return;
		var effectiveVolume = settings.ui3_audioMute == "1" ? 0 : parseFloat(settings.ui3_audioVolume);
		suppressAudioVolumeSave = true;
		setTimeout(function () { suppressAudioVolumeSave = false; }, 0);
		statusBars.setProgress("volume", effectiveVolume, "");
	}
	this.SetVolume = function (newVolume)
	{
		if (!supported)
			return;
		clearMuteStopTimeout();
		newVolume = Clamp(newVolume, 0, 1);
		volumeController.gain.value = newVolume * newVolume; // Don't use setValueAtTime method because it has issues (UI3-v17 + Chrome 66 was affected)
		volumeIconHelper.setIconForVolume(newVolume);
		if (newVolume == 0)
			audioStopTimeout = setTimeout(toggleAudioPlayback, 1000);
		else
			toggleAudioPlayback();
	}
	this.GetVolume = function ()
	{
		if (!supported)
			return 0;
		return Clamp(Math.sqrt(volumeController.gain.value), 0, 1);
	}
	var clearMuteStopTimeout = function ()
	{
		if (audioStopTimeout != null)
		{
			clearTimeout(audioStopTimeout);
			audioStopTimeout = null;
		}
	}
	var toggleAudioPlayback = function ()
	{
		if (!supported)
			return;
		clearMuteStopTimeout();
		if (videoPlayer)
			videoPlayer.AudioToggleNotify(self.AudioEnabled());
	}
	var startedUserInputRequirement = false;
	var managedUserInputRequirement = false;
	var userInputRequirementEvents = ['keydown', 'click', 'mousedown'];
	var CheckUserInputRequirement = function ()
	{
		if (!startedUserInputRequirement && context.currentTime === 0 && !suspended && context.state === "suspended")
		{
			startedUserInputRequirement = true;
			if (settings.ui3_web_audio_autoplay_warning === "1")
				inputRequiredOverlay.Show("audio player", HandleUserInputRequirement);
			for (var i = 0; i < userInputRequirementEvents.length; i++)
				document.addEventListener(userInputRequirementEvents[i], HandleUserInputRequirement);
			volumeIconHelper.setColorError();
		}
	}
	var HandleUserInputRequirement = function (e)
	{
		managedUserInputRequirement = true;
		for (var i = 0; i < userInputRequirementEvents.length; i++)
			document.removeEventListener(userInputRequirementEvents[i], HandleUserInputRequirement);
		self.Reset();
	}
	this.AudioEnabled = function ()
	{
		return self.GetVolume() > 0;
	}
	this.Reset = function ()
	{
		if (!supported)
			return;
		if (!suspended)
		{
			suspended = true;
			context.suspend();
			nextTime = 0;
		}
		while (!pendingBufferQueue.isEmpty())
		{
			var buffer = pendingBufferQueue.dequeue();
			buffer.onended = function () { }
			buffer.stop();
		}
	}
}
function FakeAudioContext_Dummy()
{
	/// <summary>This object provides a fake implementation to prevent script errors when a real implementation is unavailable.</summary>
	this.isFakeAudioContext = true;
	this.createGain = function () { }
	this.onstatechange = null;
	this.createBuffer = function () { }
	this.createBufferSource = function () { }
	this.destination = null;
	this.currentTime = 0;
	this.suspend = function () { }
	this.resume = function () { }
}
function CameraAudioMuteToggle()
{
	settings.ui3_audioMute = (settings.ui3_audioMute == "1" ? "0" : "1");
	if (settings.ui3_audioMute === "0" && parseFloat(settings.ui3_audioVolume) === 0)
		settings.ui3_audioVolume = 1;
	if (pcmPlayer)
		pcmPlayer.SetAudioVolumeFromSettings();
}
///////////////////////////////////////////////////////////////
// Volume Icon Helper /////////////////////////////////////////
///////////////////////////////////////////////////////////////
var volumeIconHelper = new (function ()
{
	var self = this;
	var isEnabled = false;
	var iconName = "off";

	this.setColorError = function () { setColor("#F00000"); }
	this.setColorLoading = function () { setColor("#F0F000"); }
	this.setColorPlaying = function () { setColor("#00F000"); }
	this.setColorIdle = function () { setColor("#969BA7"); }
	var setColor = function (color)
	{
		$("#volumeBar").css("color", color);
	}

	this.setEnabled = function (enabled)
	{
		var changed = (isEnabled && !enabled) || (!isEnabled && enabled);
		isEnabled = enabled;
		if (enabled)
			$("#volumeBar").attr("title", "");
		else
			$("#volumeBar").attr("title", "Audio is not available from the current stream");

		if (changed)
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
		if (iconName != newIconName)
		{
			iconName = newIconName;
			ApplyIcon();
		}
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
	$(btnSelector).attr("href", videoPlayer.GetLastSnapshotUrl() + "&w=99999&q=85" /* LOC0 */);
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
				toaster.Error("Failed to load HLS player script.<br>" + jqXHR.ErrorMessageHtml);
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
			container.append('<div style="width:50px;height:50px;margin: 20px auto" class="spin1s">'
				+ '<svg class="icon noflip stroke"><use xlink:href="#svg_stroke_loading_circle"></use></svg>'
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
			playerObj = new Clappr.Player({ source: src, parentId: "#hlsPlayer", autoPlay: false, disableVideoTagContextMenu: true, allowUserInteraction: true, actualLiveTime: true, hlsMinimumDvrSize: 1 });
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
				window.open("livestream.htm?cam=" + encodeURIComponent(hlsPlayerLastCamId));
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
		if (self.isFullScreen() && settings.ui3_fullscreen_videoonly == "1")
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
			$("#clipFullscreenButton").addClass('fullscreenButtonHidden');
			$("#clipExitFullscreenButton").removeClass('fullscreenButtonHidden');
		}
		else
		{
			$("#clipFullscreenButton").removeClass('fullscreenButtonHidden');
			$("#clipExitFullscreenButton").addClass('fullscreenButtonHidden');
		}
		resized();
	}
	this.toggleFullScreen = function ()
	{
		if (fullscreen_supported)
		{
			if (!self.isFullScreen())
				requestFullScreen();
			else
				exitFullScreen();
		}
		else
		{
			BI_Hotkey_MaximizeVideoArea();
		}
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
		buttonOverride = new HistoryButtonOverride(BackButtonPressed);
}
//////////////////////////////////////////////////////////////////////
// Hotkeys ///////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
function BI_Hotkey_MaximizeVideoArea()
{
	if ($("#layoutleft").is(":visible"))
		$("#layoutleft,#layouttop").hide();
	else
		$("#layoutleft,#layouttop").show();
	if (loadingHelper.DidLoadingFinish())
		resized();
}
function BI_Hotkey_FullScreen()
{
	fullScreenModeController.toggleFullScreen();
}
function BI_Hotkey_Load_Tab_Live()
{
	$('.topbar_tab[name="live"]').click();
}
function BI_Hotkey_Load_Tab_Alerts()
{
	$('.topbar_tab[name="alerts"]').click();
}
function BI_Hotkey_Load_Tab_Clips()
{
	$('.topbar_tab[name="clips"]').click();
}
function BI_Hotkey_Toggle_Camera_Labels()
{
	settings.ui3_cameraLabels_enabled = settings.ui3_cameraLabels_enabled === "1" ? "0" : "1";
	cameraNameLabels.show();
}
function BI_Hotkey_DownloadFrame()
{
	$("#save_snapshot_btn").get(0).click();
}
function BI_Hotkey_ToggleMute()
{
	CameraAudioMuteToggle();
}
function BI_Hotkey_NextCamera()
{
	LoadNextOrPreviousCamera(1);
}
function BI_Hotkey_PreviousCamera()
{
	LoadNextOrPreviousCamera(-1);
}
function LoadNextOrPreviousCamera(offset)
{
	var loading = videoPlayer.Loading();
	if (!loading.image.isLive || cameraListLoader.CameraIsCycle(loading.cam))
		return;
	//if (cameraListLoader.CameraIsGroup(loading.cam))
	//	return;
	var groupCamera = videoPlayer.GetCurrentHomeGroupObj();
	var idxCurrentMaximizedCamera = -1;
	for (var i = 0; i < groupCamera.group.length; i++)
	{
		if (groupCamera.group[i] == loading.cam.optionValue)
		{
			idxCurrentMaximizedCamera = i;
			break;
		}
	}
	if (offset == 1 && idxCurrentMaximizedCamera >= groupCamera.group.length - 1)
		idxCurrentMaximizedCamera = -1;
	else if (offset == -1 && idxCurrentMaximizedCamera <= -1)
		idxCurrentMaximizedCamera = groupCamera.group.length - 1;
	else
		idxCurrentMaximizedCamera += offset;

	var newCamera = groupCamera;
	if (idxCurrentMaximizedCamera != -1)
	{
		var newCameraId = groupCamera.group[idxCurrentMaximizedCamera];
		newCamera = cameraListLoader.GetCameraWithId(newCameraId);
	}
	videoPlayer.ImgClick_Camera(newCamera);
}
function BI_Hotkey_NextGroup()
{
	LoadNextOrPreviousGroup(1);
}
function BI_Hotkey_PreviousGroup()
{
	LoadNextOrPreviousGroup(-1);
}
function LoadNextOrPreviousGroup(offset)
{
	var loading = videoPlayer.Loading();
	if (!loading.image.isLive)
		return;
	var groupCamera = videoPlayer.GetCurrentHomeGroupObj();
	var groupList = cameraListLoader.GetGroupAndCycleList();
	var idxCurrentGroup = -1;
	for (var i = 0; i < groupList.length; i++)
	{
		if (groupList[i] == groupCamera)
		{
			idxCurrentGroup = i;
			break;
		}
	}
	var idxDesiredGroup;
	var safeOffset = (idxCurrentGroup + offset) % groupList.length;
	if (safeOffset < 0)
		idxDesiredGroup = groupList.length + safeOffset;
	else
		idxDesiredGroup = safeOffset;

	videoPlayer.SelectCameraGroup(groupList[idxDesiredGroup].optionValue);
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
function BI_Hotkey_ToggleReverse()
{
	if (!videoPlayer.Loading().image.isLive)
		playbackControls.ToggleReverse();
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
		videoPlayer.SeekByMs(1000 * GetSkipAmount());
}
function BI_Hotkey_SkipBack()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.SeekByMs(-1000 * GetSkipAmount());
}
function GetSkipAmount()
{
	return Clamp(parseFloat(settings.ui3_skipAmount), 0.01, 9999);
}
function BI_Hotkey_SkipAhead1Frame()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.SeekByMs(videoPlayer.GetExpectedFrameIntervalOfCurrentCamera(), false);
}
function BI_Hotkey_SkipBack1Frame()
{
	if (!videoPlayer.Loading().image.isLive)
		videoPlayer.SeekByMs(-1 * videoPlayer.GetExpectedFrameIntervalOfCurrentCamera(), false);
}
function BI_Hotkey_PlaybackFaster()
{
	if (!videoPlayer.Loading().image.isLive)
		playbackControls.ChangePlaySpeed(1);
}
function BI_Hotkey_PlaybackSlower()
{
	if (!videoPlayer.Loading().image.isLive)
		playbackControls.ChangePlaySpeed(-1);
}
function BI_Hotkey_CloseClip()
{
	if (!videoPlayer.Loading().image.isLive)
	{
		clipLoader.CloseCurrentClip();
		// Prevent this same hotkey event from closing the current camera, too.
		suppress_Hotkey_CloseCamera = true;
		setTimeout(function () { suppress_Hotkey_CloseCamera = false; }, 0);
	}
}
var suppress_Hotkey_CloseCamera = false;
function BI_Hotkey_CloseCamera()
{
	if (suppress_Hotkey_CloseCamera)
		return;
	var loading = videoPlayer.Loading();
	if (loading.image.isLive && !loading.image.isGroup)
		videoPlayer.ImgClick_Camera(loading.cam);
}
function BI_Hotkey_DigitalZoomIn()
{
	imageRenderer.DigitalZoomNow(100, true);
}
function BI_Hotkey_DigitalZoomOut()
{
	imageRenderer.DigitalZoomNow(-100, true);
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
function BI_Hotkey_PtzFocusFar() { BI_PTZ_Action(-2); }
function BI_Hotkey_PtzFocusFar_Up() { BI_PTZ_Action(-2, true); }
function BI_Hotkey_PtzFocusNear() { BI_PTZ_Action(-1); }
function BI_Hotkey_PtzFocusNear_Up() { BI_PTZ_Action(-1, true); }
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
		var charCode = e.which;
		if (!charCode
			|| $("body").children(".dialog_overlay").length !== 0
			|| $("body").children(".dialog_wrapper").children(".streamingProfileEditorPanel").length !== 0)
			return;
		var hotkeysBeingRepeated = currentlyDownKeys[charCode];
		if (hotkeysBeingRepeated)
		{
			for (var i = 0; i < hotkeysBeingRepeated.length; i++)
			{
				var s = hotkeysBeingRepeated[i];
				if (s.allowRepeatKey)
				{
					var val = settings.getItem(s.key);
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
		for (var i = 0; i < defaultSettings.length; i++)
		{
			var s = defaultSettings[i];
			if (s.hotkey)
			{
				if (typeof s.actionDown == "function")
				{
					var val = settings.getItem(s.key);
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
		if (!retVal)
			return retVal;
	});
	$(document).keyup(function (e)
	{
		var charCode = e.which;
		if (!charCode)
			return;
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
		m[176] = "Media Next";
		m[177] = "Media Previous";
		m[178] = "Media Stop";
		m[179] = "Media Play/Pause";
		m[186] = "semicolon (;)";
		m[187] = "=";
		m[188] = "comma (,)";
		m[189] = "hyphen (-)";
		m[190] = "period (.)";
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
			"extendedTimeOut": "10000",
			"showEasing": "swing",
			"hideEasing": "linear",
			"showMethod": "fadeIn",
			"hideMethod": "fadeOut"
		}
	var showToastInternal = function (type, message, showTime, closeButton, onClick)
	{
		if (typeof message === "object" && typeof message.message === "string" && typeof message.stack === "string")
		{
			console.error(type + " toast", message);
			message = htmlEncode(message.message + ": " + message.stack);
		}
		else if (typeof message === "object" && typeof message.name === "string" && typeof message.message === "string" && typeof message.code === "number")
		{
			message = message.name + " (code " + message.code + "): " + message.message, message;
			console.error(type + " toast", message);
			message = htmlEncode(message);
		}
		else
		{
			if (type === "error")
				bilog.debug(type + " toast: ", message);
			else
				bilog.info(type + " toast: ", message);
		}
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
	var oldSession = sessionManager.GetSession();
	if (typeof args.session == "undefined" && !isLogin)
	{
		args.session = oldSession;
	}
	var eventArgs = { id: execJsonCounter++, args: args };
	BI_CustomEvent.Invoke("ExecJSON_Start", eventArgs);
	var reqUrl = currentServer.remoteBaseURL + "json";
	$.ajax({
		type: 'POST',
		url: reqUrl,
		contentType: "text/plain",
		data: JSON.stringify(args),
		dataType: "json",
		async: !synchronous,
		success: function (data)
		{
			eventArgs.data = data;
			BI_CustomEvent.Invoke("ExecJSON_Success", eventArgs);
			if (isLogin)
				sessionManager.SetSession(oldSession);
			else if (!currentServer.isUsingRemoteServer && typeof data.session != "undefined" && data.session != sessionManager.GetSession())
			{
				// If this happens a lot, usually the cause is another window with a web UI open that has a different latestAPISession value
				bilog.verbose('ExecJSON("' + args.cmd + '").success changing session from ' + sessionManager.GetSession() + ' to ' + data.session);
				sessionManager.SetSession(data.session);
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
			if (!jqXHR)
				jqXHR = { status: 0, statusText: "No jqXHR object was created" };
			jqXHR.OriginalURL = reqUrl;
			jqXHR.ErrorMessageHtml = 'Response: ' + jqXHR.status + ' ' + jqXHR.statusText + '<br>Status: ' + textStatus + '<br>Error: ' + errorThrown + '<br>URL: ' + reqUrl;
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
	var queue = new Queue();
	this.getFPS = function (lastFrameLoadingTime)
	{
		var now = performance.now();
		// Trim times older than 1 second
		while (!queue.isEmpty() && now - queue.peek() >= 1000)
			queue.dequeue();
		queue.enqueue(now);
		if (queue.getLength == 1)
		{
			// No history. Return predicted FPS based on last frame loading time.
			if (lastFrameLoadingTime <= 0)
				lastFrameLoadingTime = 10000;
			var newFps = 1000.0 / lastFrameLoadingTime;
			if (newFps > 2)
				newFps = 2;
			return newFps.toFloat(1);
		}
		return queue.getLength();
	}
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
	var queue = new Queue();
	this.averageOverMs = 1000;
	var sum = 0;
	var best = 0;
	this.AddDataPoint = function (bytes)
	{
		cleanup();
		sum += bytes;
		queue.enqueue(new BitRateDataPoint(bytes));
		if (sum > best)
			best += ((sum - best) * 0.1);
		else if (sum < best)
			best += ((sum - best) * 0.01);
	}
	this.GetBPS = function ()
	{
		cleanup();
		return sum;
	}
	this.GetBestGuess = function ()
	{
		return best;
	}
	var cleanup = function ()
	{
		var now = performance.now();
		while (!queue.isEmpty() && now - queue.peek().time > self.averageOverMs)
			sum -= queue.dequeue().bytes;
	}
}
function BitRateDataPoint(bytes)
{
	this.bytes = bytes;
	this.time = performance.now();
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
	var numTicks = 0;
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
			if (numTicks < MAXSAMPLES)
				numTicks++;
		}
	}
	this.Get = function ()
	{
		if (numTicks == 0)
			return 0;
		return (ticksum / numTicks);
	}
}
///////////////////////////////////////////////////////////////
// Efficient Timed Average Calculator ///////////////////////
///////////////////////////////////////////////////////////////
function TimedAverage(maxMs, minRecords)
{
	/// <summary>Calculates the average of values provided for a limited time. The timer starts upon the first Add operation.</summary>
	var self = this;
	var itemCount = 0;
	var sum = 0;
	var endTime = -1;
	this.done = false;
	this.Add = function (newValue)
	{
		if (!self.done && newValue !== null)
		{
			if (endTime == -1)
				endTime = performance.now() + maxMs;
			if (performance.now() < endTime || itemCount < minRecords)
			{
				sum += newValue;
				itemCount++;
				return true;
			}
			self.done = true;
			return false;
		}
	}
	this.Get = function ()
	{
		if (itemCount == 0)
			return 0;
		return (sum / itemCount);
	}
}
///////////////////////////////////////////////////////////////
// Failure Limiter ////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function FailLimiter(maxFailsInTimePeriod, timePeriodMs)
{
	var self = this;
	var queue = new Queue();
	var sum = 0;

	this.Fail = function ()
	{
		queue.enqueue(performance.now());
		return self.IsLimiting();
	}
	this.IsLimiting = function ()
	{
		cleanup();
		return queue.getLength() > maxFailsInTimePeriod;
	}

	var cleanup = function ()
	{
		var now = performance.now();
		while (!queue.isEmpty() && now - queue.peek() > timePeriodMs)
			queue.dequeue();
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
	, remoteServerName: ""
	, remoteServerUser: ""
	, remoteServerPass: ""
	, isLoggingOut: false
	, isUsingRemoteServer: false
	, GetRemoteSessionArg: function (prefix, overrideRemoteRequirement)
	{
		if (currentServer.isUsingRemoteServer || overrideRemoteRequirement)
			return prefix + "session=" + sessionManager.GetSession();
		else
			return "";
	}
	, SetRemoteServer: function (serverName, baseUrl, user, pass)
	{
		if (!currentServer.ValidateRemoteServerNameSimpleRules(serverName))
		{
			toaster.Error("Unable to validate remote server name. Connecting to local server instead.", 10000);
			serverName = "";
		}
		if (serverName == "")
		{
			currentServer.remoteBaseURL = "";
			currentServer.remoteSession = "";
			currentServer.remoteServerName = "";
			currentServer.remoteServerUser = "";
			currentServer.remoteServerPass = "";
			currentServer.isUsingRemoteServer = false;
		}
		else
		{
			currentServer.remoteBaseURL = baseUrl;
			currentServer.remoteSession = "";
			currentServer.remoteServerName = serverName;
			currentServer.remoteServerUser = user;
			currentServer.remoteServerPass = pass;
			currentServer.isUsingRemoteServer = true;
		}
	}
	, ValidateRemoteServerNameSimpleRules: function (val)
	{
		if (val.length == 0)
			return false;
		if (val.length > 16)
			return false;
		for (var i = 0; i < val.length; i++)
		{
			var c = val.charAt(i);
			if ((c < "a" || c > "z") && (c < "A" || c > "Z") && (c < "0" || c > "9") && c != " ")
				return false;
		}
		return true;
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
		{
			var handler = handlers[idx];
			if (handler.isExecutingEventHandlerNow)
				handler.removeEventHandlerWhenFinished = true;
			else
				handlers.splice(idx, 1);
		}
	},
	Invoke: function (eventName, args)
	{
		if (typeof this.customEventRegistry[eventName] != "undefined")
			for (var i = 0; i < this.customEventRegistry[eventName].length; i++)
				try
				{
					var handler = this.customEventRegistry[eventName][i];
					handler.isExecutingEventHandlerNow = true;
					handler(args);
					handler.isExecutingEventHandlerNow = false;
					if (handler.removeEventHandlerWhenFinished)
					{
						this.customEventRegistry[eventName].splice(i, 1);
						i--;
					}
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
		if (inputRequiredOverlay.IsActive())
		{
			inputRequiredOverlay.AddListener(FinishLoadingIfConditionsMet);
			return;
		}
		ajaxHistoryManager = new AjaxHistoryManager();
		loadingFinished = true;
		$("#loadingmsgwrapper").remove();
		resized();
		videoPlayer.Initialize();
		BI_CustomEvent.Invoke("FinishedLoading");
	}
	this.DidLoadingFinish = function ()
	{
		return loadingFinished;
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
			console.log.apply(null, arguments);
		}
		catch (ex)
		{
		}
	}
	var errorInner = function (msg)
	{
		try
		{
			console.error.apply(null, arguments);
		}
		catch (ex)
		{
		}
	}
	this.verbose = logInner;
	this.info = logInner;
	this.debug = errorInner;
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
function ImageToDataUrl(imgEle)
{
	var imgCanvas = document.createElement("canvas");

	// Make sure canvas is as big as the picture
	imgCanvas.width = imgEle.naturalWidth;
	imgCanvas.height = imgEle.naturalHeight;

	// Draw image into canvas element
	var imgContext = imgCanvas.getContext("2d");
	imgContext.drawImage(imgEle, 0, 0, imgEle.naturalWidth, imgEle.naturalHeight);

	return imgCanvas.toDataURL("image/jpeg");
}
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

			// Get canvas contents as a data URL
			var imgAsDataURL = ImageToDataUrl(tmpImg);

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
	this.OpenStream = function (url, frameCallback, statusBlockCallback, streamInfoCallback, streamEnded)
	{
		queuedRequest = { url: url, frameCallback: frameCallback, statusBlockCallback: statusBlockCallback, streamInfoCallback: streamInfoCallback, streamEnded: streamEnded, activated: false };
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
		streamer = new FetchVideoH264Streamer(queuedRequest.url, queuedRequest.frameCallback, queuedRequest.statusBlockCallback, queuedRequest.streamInfoCallback, StreamEndedWrapper);
	}
	var StreamEndedWrapper = function (message, wasJpeg, wasAppTriggered, videoFinishedStreaming, responseError)
	{
		if (stopTimeout != null)
		{
			clearTimeout(stopTimeout);
			stopTimeout = null;
		}
		streamer = null;
		if (streamEndedCbForActiveFetch)
			streamEndedCbForActiveFetch(message, wasJpeg, wasAppTriggered, videoFinishedStreaming, responseError);
		OpenStreamNow();
	}
	var StopTimedOut = function ()
	{
		stopTimeout = null;
		toaster.Error('Video streaming connection stuck open! You should reload the page.', 600000, true);
	}
})();
function FetchVideoH264Streamer(url, frameCallback, statusBlockCallback, streamInfoCallback, streamEnded)
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
	var abort_controller = null;
	var responseError = null;

	this.StopStreaming = function ()
	{
		stopCalledByApp = true;
		stopStreaming_Internal();
	}
	var stopStreaming_Internal = function ()
	{
		cancel_streaming = true;
		// Aborting the AbortController must happen first, or else some versions of MS Edge leave the stream open in the background.
		if (abort_controller)
		{
			abort_controller.abort();
			abort_controller = null;
		}
		if (reader)
		{
			myStream = new GhettoStream(); // This is mostly just to release any data stored in the old stream.
			var cancelPromise = reader.cancel("Streaming canceled");
			if (cancelPromise && cancelPromise["catch"])
				cancelPromise["catch"](function (e)
				{
					if (DOMException && DOMException.ABORT_ERR && e && e.code === DOMException.ABORT_ERR)
					{
						// Expected result. Don't spam console.
					}
					else if (DOMException && DOMException.INVALID_STATE_ERR && e && e.code === DOMException.INVALID_STATE_ERR)
					{
						// Expected result in MS Edge.
					}
					else
						console.error(e);
				});
			reader = null;
		}
	}
	var Start = function ()
	{
		var startTime = performance.now();

		var fetchArgs = { credentials: "same-origin" };
		var fetchPromise;
		if (typeof AbortController == "function")
		{
			// FF 57+, Edge 16+ (in theory)
			abort_controller = new AbortController();
			fetchArgs.signal = abort_controller.signal;
		}
		fetchPromise = fetch(url, fetchArgs);

		fetchPromise.then(function (res)
		{
			try
			{
				if (res.headers.get("Content-Type") == "image/jpeg")
				{
					var blobPromise = res.blob();
					blobPromise.then(function (jpegBlob)
					{
						try
						{
							if (parseInt(res.headers.get("Content-Length")) != jpegBlob.size)
							{
								CallStreamEnded("fetch graceful exit (jpeg incomplete)", true, true);
								return;
							}
							var jpegObjectURL = URL.createObjectURL(jpegBlob);
							try
							{
								CallFrameCallback({ startTime: startTime, jpeg: jpegObjectURL, isVideo: true }, 1);
							}
							catch (e)
							{
								toaster.Error(e);
							}
							CallStreamEnded("fetch graceful exit (jpeg)", true, true);
						}
						catch (e)
						{
							toaster.Error(e);
						}
					})
					["catch"](function (e)
					{
						CallStreamEnded(e);
					});
					return blobPromise;
				}
				else
				{
					if (!res.ok)
						responseError = res.status + " " + res.statusText;
					// Do NOT return before the first reader.read() or the fetch can be left in a bad state!
					reader = res.body.getReader();
					return pump(reader);
				}
			}
			catch (e)
			{
				toaster.Error(e);
			}
		});
		fetchPromise["catch"](function (e)
		{
			try
			{
				CallStreamEnded(e);
			}
			catch (e)
			{
				toaster.Error(e);
			}
		});
	}
	function CallStreamEnded(message, naturalEndOfStream, wasJpeg)
	{
		if (typeof streamEnded == "function")
		{
			try
			{
				streamEnded(message, wasJpeg, stopCalledByApp, naturalEndOfStream, responseError);
			}
			catch (e)
			{
				if (typeof message == "object" && typeof message.stack == "string")
					message = message.stack;
				var e2 = e;
				if (typeof e2 == "object" && typeof e2.stack == "string")
					e2 = e2.stack;
				toaster.Error("An unhandled error occurred while handling the end-of-stream event: " + htmlEncode(e2) + "<br>The stream ended because: " + htmlEncode(message));
			}
		}
		streamEnded = null;
	}
	function CallFrameCallback()
	{
		try
		{
			frameCallback.apply(this, arguments);
		}
		catch (e)
		{
			toaster.Error(e);
		}
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
			try
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

				while (myStream) // was "while (true)" but eslint doesn't like that.
				{
					if (cancel_streaming)
					{
						stopStreaming_Internal();
						CallStreamEnded("fetch graceful exit (type 3)");
						return;
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
						var bitmapHeaderSize = ReadUInt32LE(buf, offsetWrapper);
						offsetWrapper.offset -= 4; // Reverse the previous read so it will be included in the object.
						if (bitmapHeaderSize > 0)
							bitmapHeader = new BITMAPINFOHEADER(ReadSubArray(buf, offsetWrapper, bitmapHeaderSize));

						if (offsetWrapper.offset < streamHeaderSize)
						{
							// Audio stream was provided.
							// Assuming the remainder of the header is WAVEFORMATEX structure
							audioHeader = new WAVEFORMATEX(ReadSubArray(buf, offsetWrapper, streamHeaderSize - offsetWrapper.offset));
						}

						try
						{
							streamInfoCallback(bitmapHeader, audioHeader);
						}
						catch (e)
						{
							toaster.Error(e);
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
							currentVideoFrame.pos = ReadUInt16(buf, offsetWrapper);
							currentVideoFrame.time = ReadUInt32(buf, offsetWrapper);
							currentVideoFrame.utc = ReadUInt64LE(buf, offsetWrapper);
							currentVideoFrame.size = ReadUInt32(buf, offsetWrapper);
							if (currentVideoFrame.size > 10000000)
								return protocolError("Video frame size of " + currentVideoFrame.size + " was rejected.");

							state = 4;
						}
						else if (blockType == 1) // Audio
						{
							var buf = myStream.Read(4);
							if (buf == null)
								return pump();

							currentAudioFrame.size = ReadInt32(buf, { offset: 0 });
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

							CallFrameCallback(new VideoFrame(buf, currentVideoFrame), availableStreams);

							state = 2;
						}
						else if (blockType == 1) // Audio
						{
							var buf = myStream.Read(currentAudioFrame.size);
							if (buf == null)
								return pump();

							bitRateCalc_Audio.AddDataPoint(currentAudioFrame.size);

							CallFrameCallback(new AudioFrame(buf, audioHeader), availableStreams);

							state = 2;
						}
						else if (blockType == 2) // Status
						{
							var buf = myStream.Read(statusBlockSize - 6); // We already read the first 6 bytes ['B', 'L', 'U', 'E', 2, statusBlockSize]
							if (buf == null)
								return pump();

							var statusBlock = new StatusBlock(buf);

							try
							{
								statusBlockCallback(statusBlock);
							}
							catch (e)
							{
								toaster.Error(e);
							}

							state = 2;
						}
						else
							return protocolError("Unknown block type " + blockType + " at state " + state);
					}
				}
			}
			catch (e)
			{
				toaster.Error(e);
			}
		}
		)["catch"](function (e)
		{
			try
			{
				stopStreaming_Internal();
				CallStreamEnded(e);
			}
			catch (e)
			{
				toaster.Error(e);
			}
		});
	}

	Start();
}
function StatusBlock(buf)
{
	var offsetWrapper = { offset: 0 };
	this.bRec = ReadByte(buf, offsetWrapper);
	this.bMotion = ReadByte(buf, offsetWrapper);
	this.bCheckFPS = ReadByte(buf, offsetWrapper);
	this.bTriggered = ReadByte(buf, offsetWrapper);
	this.bSignalLost = ReadByte(buf, offsetWrapper);

	this.bPushError = ReadByte(buf, offsetWrapper);
	this.bFlashError = ReadByte(buf, offsetWrapper);
	this.bForceMovie = ReadByte(buf, offsetWrapper);

	this.bOther0 = ReadByte(buf, offsetWrapper);
	this.bOther1 = ReadByte(buf, offsetWrapper);

	this.fps = ReadInt32(buf, offsetWrapper); // in 100ths
	this.apeak = ReadInt32(buf, offsetWrapper); // out of 32767
	this.tpause = ReadInt32(buf, offsetWrapper);
}
function BITMAPINFOHEADER(buf)
{
	var offsetWrapper = { offset: 0 };
	this.raw = buf;
	this.biSize = ReadUInt32LE(buf, offsetWrapper);
	this.biWidth = ReadInt32LE(buf, offsetWrapper); // Width in pixels
	this.biHeight = ReadInt32LE(buf, offsetWrapper); // Height in pixels
	this.biPlanes = ReadUInt16LE(buf, offsetWrapper); // Number of planes (always 1)
	this.biBitCount = ReadUInt16LE(buf, offsetWrapper); // Bits Per Pixel
	this.biCompression = ReadUInt32LE(buf, offsetWrapper); // ['J','P','E','G'] or ['M','J','P','G'] (this can be ignored)
	this.biSizeImage = ReadUInt32LE(buf, offsetWrapper); // Image size in bytes
	this.biXPelsPerMeter = ReadInt32LE(buf, offsetWrapper);
	this.biYPelsPerMeter = ReadInt32LE(buf, offsetWrapper);
	this.biClrUsed = ReadUInt32LE(buf, offsetWrapper);
	this.biClrImportant = ReadUInt32LE(buf, offsetWrapper);
}
function WAVEFORMATEX(buf)
{
	/// <summary>This is only loosely based on the WAVEFORMATEX structure.</summary>
	this.raw = buf;
	var offsetWrapper = { offset: 0 };
	if (buf.length >= 14)
	{
		this.valid = true;
		this.wFormatTag = ReadUInt16LE(buf, offsetWrapper);
		this.nChannels = ReadUInt16LE(buf, offsetWrapper);
		this.nSamplesPerSec = ReadUInt32LE(buf, offsetWrapper);
		this.nAvgBytesPerSec = ReadUInt32LE(buf, offsetWrapper);
		this.nBlockAlign = ReadUInt16LE(buf, offsetWrapper);
		this.wBitsPerSample = 0;
		this.cbSize = 0;
		if (buf.length >= 18)
		{
			this.wBitsPerSample = ReadUInt16LE(buf, offsetWrapper);
			this.cbSize = ReadUInt16LE(buf, offsetWrapper);
		}
	}
	else
		this.valid = false;
}
function VideoFrame(buf, metadata)
{
	var self = this;
	this.meta = $.extend({}, metadata);
	this.isVideo = true;
	this.frameData = buf;
	this.pos = metadata.pos;
	this.time = metadata.time;
	this.utc = metadata.utc;
	this.size = metadata.size;
	this.isKeyframe = function ()
	{
		if (self.frameData && self.frameData.length > 0)
		{
			// The NALU type is the last 5 bits of the first byte after a start code.
			// This method will look in the first 1000 bytes to find a "VCL NALU" (types 1-5) and assume the 
			// first found indicates the frame type.
			var end = Math.min(self.frameData.length, 1001) - 1;
			var zeroBytes = 0;
			for (var i = 0; i < end; i++)
			{
				if (self.frameData[i] === 0)
					zeroBytes++;
				else
				{
					if (zeroBytes >= 2 && self.frameData[i] === 1)
					{
						// Identified a start code.  Check the NALU type.
						var NALU_Type = self.frameData[i + 1] & 31; // 31 is 0b00011111
						if (NALU_Type == 5) // This is a slice of a keyframe.
							return true;
						else if (0 < NALU_Type && NALU_Type < 5) // This is another frame type
							return false;
					}
					zeroBytes = 0;
				}
			}
		}
		return false;
	}
}
function AudioFrame(buf, formatHeader)
{
	var self = this;
	this.isAudio = true;
	this.frameData = buf;
	this.format = formatHeader;
	this.isKeyframe = function ()
	{
		return self.format.wFormatTag === 7;
	}
}
///////////////////////////////////////////////////////////////
// GhettoStream ///////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function GhettoStream()
{
	// <summary>A class which consumes Uint8Array objects and produces Uint8Array objects of whatever size you want by concatenating the inputs as needed.</summary>
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
	return buf[offsetWrapper.offset++];
}
function ReadUInt16(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 2).getUint16(0, false);
	offsetWrapper.offset += 2;
	return v;
}
function ReadUInt16LE(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 2).getUint16(0, true);
	offsetWrapper.offset += 2;
	return v;
}
function ReadInt16(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 2).getInt16(0, false);
	offsetWrapper.offset += 2;
	return v;
}
function ReadInt16LE(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 2).getInt16(0, true);
	offsetWrapper.offset += 2;
	return v;
}
function ReadUInt32(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 4).getUint32(0, false);
	offsetWrapper.offset += 4;
	return v;
}
function ReadUInt32LE(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 4).getUint32(0, true);
	offsetWrapper.offset += 4;
	return v;
}
function ReadInt32(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 4).getInt32(0, false);
	offsetWrapper.offset += 4;
	return v;
}
function ReadInt32LE(buf, offsetWrapper)
{
	var v = new DataView(buf.buffer, offsetWrapper.offset, 4).getInt32(0, true);
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
//function ReadUTF8(buf, offsetWrapper, byteLength)
//{
//	var v = Utf8ArrayToStr(new Uint8Array(buf, offsetWrapper.offset, byteLength));
//	offsetWrapper.offset += byteLength;
//	return v;
//}
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
			, "Video Bit Rate"
			, "Audio Bit Rate"
			, "Audio Buffer"
			, "Frame Size"
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
		dpiScale = 1;//BI_GetDevicePixelRatio(); // Rendering pixel-perfect on high DPI devices makes the graph harder to read because one pixel horizontally is one frame.
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
			// CONSIDER: Handle buffer resizes, preserving as much recent data as possible.
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
// Drag and Drop //////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function DragAndDropHelper($list, onItemMoved)
{
	var self = this;
	var $items = $();
	var x = 0;
	var y = 0;
	var offsetX = 0;
	var offsetY = 0;
	var down = false;
	var drag = false;
	var moved = false;
	var $lastTouched = null;
	var $drag = null;
	var $blank = null;
	var $ghost = null;
	var startDragTimeout = null;
	var startDragHoldTimeMs = 500;

	this.Rebind = function ()
	{
		$items = $list.children();
		$items.each(RebindItem);
	}
	var RebindItem = function (idx, ele)
	{
		var $ele = $(ele);
		$ele.off('touchstart.ddh mousedown.ddh contextmenu.ddh');
		$ele.on('touchstart.ddh mousedown.ddh', function (e)
		{
			OnStart(e, $ele);
			return false;
		});
		$ele.on('contextmenu.ddh', function (e)
		{
			return false;
		});
	}
	var ClearDragTimeout = function ()
	{
		if (startDragTimeout)
		{
			clearTimeout(startDragTimeout);
		}
	}
	var OnStart = function (e, $ele)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e) || e.which === 3)
			return;
		down = true;
		x = e.pageX;
		y = e.pageY;
		var ofst = $ele.offset();
		offsetX = x - ofst.left;
		offsetY = y - ofst.top;
		ClearDragTimeout();
		$lastTouched = $ele;
		if (touchEvents.isTouchEvent(e))
			startDragTimeout = setTimeout(function ()
			{
				DragStart($ele);
			}, startDragHoldTimeMs);
		else
			DragStart($ele);
	}
	var DragStart = function ($ele)
	{
		if (vibrate_supported)
			navigator.vibrate(25);
		drag = true;
		$drag = $ele;
		$ghost = $ele.clone();
		$blank = $ele.clone().css('opacity', 0);
		$ghost.addClass('ghost');
		$ghost.css('left', mouseCoordFixer.last.x - offsetX).css('top', mouseCoordFixer.last.y - offsetY);
		$ghost.css('width', $ele.width() + 'px').css('height', $ele.height() + 'px');
		$('body').append($ghost);
		$drag.hide();
		$drag.after($blank);
	}

	var OnMove = function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e) || !down)
			return;
		var distance = Math.max(Math.abs(e.pageX - x), Math.abs(e.pageY - y));
		if (!moved && distance > 5)
		{
			moved = true;
			ClearDragTimeout();
		}
		if ($lastTouched && distance > 50)
			$lastTouched = null;
		if (drag)
		{
			$ghost.css('left', e.pageX - offsetX).css('top', e.pageY - offsetY);
			if (pointInsideElementBorder($drag.parent(), e.pageX, e.pageY))
			{
				$ghost.css("cursor", "move");
				for (var i = 0; i < $items.length; i++)
				{
					var $item = $items.eq(i);
					if (pointInsideElementBorder($item, e.pageX, e.pageY))
					{
						moved = true;
						if ($blank.position().top > $item.position().top)
							$item.before($blank);
						else
							$item.after($blank);
					}
				}
			}
			else
			{
				$ghost.css("cursor", "no-drop");
				$drag.after($blank);
			}
		}
	}
	var OnEnd = function (e)
	{
		mouseCoordFixer.fix(e);
		touchEvents.Gate(e);
		if (down)
			DragFinished(e, drag && pointInsideElementBorder($drag.parent(), e.pageX, e.pageY));
	}
	var DragFinished = function (e, success)
	{
		ClearDragTimeout();
		if (drag)
		{
			if (success && moved)
			{
				$blank.after($drag);
				onItemMoved($drag);
			}
			$drag.show();
			$blank.remove();
			$ghost.remove();
			if (!moved)
				TimedClick($drag);
			$drag = $blank = $ghost = null;
		}
		else
		{
			if ($lastTouched && $lastTouched.length > 0 && pointInsideElement($lastTouched, e.pageX, e.pageY))
			{
				TimedClick($lastTouched);
				$lastTouched = null;
			}
		}
		down = drag = moved = false;
	}
	var OnCancel = function (e)
	{
		mouseCoordFixer.fix(e);
		touchEvents.Gate(e);
		DragFinished(e, false);
	}
	var TimedClick = function ($ele)
	{
		setTimeout(function ()
		{
			$ele.trigger('click');
		}, 0);
	}
	this.Destroy = function ()
	{
		// Only one DragAndDropHelper can be active at a time; calling Destroy deactivates previous helpers.
		$(document).off('touchmove.ddh mousemove.ddh touchend.ddh mouseup.ddh touchcancel.ddh');
	}
	$(document).on('touchmove.ddh mousemove.ddh', OnMove);
	$(document).on('touchend.ddh mouseup.ddh', OnEnd);
	$(document).on('touchcancel.ddh', OnCancel);
}
///////////////////////////////////////////////////////////////
// Mouse Event Helper / Double Click Helper ///////////////////
///////////////////////////////////////////////////////////////
function MouseEventHelper($ele, $excludeRecordings, $excludeLive, excludeFunc, cbOnSingleClick, cbOnDoubleClick, cbDragStart, cbDragMove, cbDragEnd, doubleClickTimeMS, mouseMoveTolerance)
{
	/// <summary>Handles double-click events in a consistent way between touch and non-touch devices.</summary>
	/// <param name="$ele">jQuery object containing elements to listen for clicks on.</param>
	/// <param name="$excludeRecordings">jQuery object containing elements to ignore clicks on while viewing a recording (maybe these are nested inside [$ele]). May be null.</param>
	/// <param name="$excludeLive">jQuery object containing elements to ignore clicks on while viewing live video (maybe these are nested inside [$ele]). Also, cbOnDragStart will not be called when the drag starts in one of these elements regardless of playback mode.  May be null.</param>
	/// <param name="excludeFunc">Called by all mouse/touch down/up events; if this returns true, the event is excluded from consideration for clicks and drag starts.</param>
	/// <param name="cbOnSingleClick">Callback function that is called when a single click occurs.  The first argument is the event object, and the second argument is a boolean indicating whether the single click is confirmed (If false, it may be part of a future double-click.  If true, it is to be treated as a standalone single-click.).</param>
	/// <param name="cbOnDoubleClick">Callback function that is called when a double click occurs.  The first argument is the event object.</param>
	/// <param name="cbDragStart">Called when dragging begins, which happens after a non-excluded mouse/touch down event followed by cursor movement exceeding mouseMoveTolerance.</param>
	/// <param name="cbDragMove">Called when the cursor moves while a button is down.</param>
	/// <param name="cbDragEnd">Called when dragging ends, which is on any mouse or touch up event whether the drag start callback was called or not.</param>
	/// <param name="doubleClickTimeMS">(Optional; default: 300) Maximum milliseconds between clicks to consider two clicks a double-click.</param>
	/// <param name="mouseMoveTolerance">(Optional; default: 5) Maximum number of pixels the mouse can move before it is considered a drag instead of a click.</param>
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
	if (typeof cbDragMove != "function")
		cbDragMove = function () { };
	if (typeof cbDragEnd != "function")
		cbDragEnd = function () { };
	var callCBTimeout = null;
	var callCB = function (cb, delay, e, confirmed)
	{
		var saveArgs = new Array(arguments.length - 2);
		for (var i = 2; i < arguments.length; i++)
			saveArgs[i - 2] = arguments[i];
		var execute = function ()
		{
			callCBTimeout = null;
			if (!lastMouseUp1.Excluded)
				cb.apply(self, saveArgs);
		};
		if (callCBTimeout)
		{
			clearTimeout(callCBTimeout);
			callCBTimeout = null;
		}
		if (delay)
			callCBTimeout = setTimeout(execute, 0);
		else
			execute();
	}
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

	var excludeNextEvent = false;
	var exclude = false;
	var excludeDragStart = false;
	var clearExclusion = function ()
	{
		exclude = false;
		excludeDragStart = false;
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
			if (videoPlayer.Loading().image.isLive)
				exclude = true;
			excludeDragStart = true;
			setTimeout(clearExclusion, 0);
		});
		$excludeLive.on("mouseup touchend touchcancel", function (e)
		{
			if (videoPlayer.Loading().image.isLive)
				exclude = true;
			excludeDragStart = true;
			setTimeout(clearExclusion, 0);
		});
	}

	$ele.on("mousedown touchstart", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (e.which === 3)
			return;
		handleExcludeFunc(e);
		if (lastEvent === 1)
			RecordMouseEvent(2, e); // Inject mouse up event that the browser likely missed.
		RecordMouseEvent(1, e);
		if (!excludeDragStart)
			cbDragStart(e);
	});
	$ele.on("mouseup touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		if (touchEvents.Gate(e))
			return;
		if (e.which === 3)
			return;
		handleExcludeFunc(e);
		var fakeMouseDown = lastEvent == 2;
		if (fakeMouseDown)
			RecordMouseEvent(1, e); // Inject mouse down event that the browser likely missed.
		RecordMouseEvent(2, e);
		if (!positionsAreWithinTolerance(lastMouseUp1, lastMouseDown1))
			return; // It doesn't count as a click if the mouse moved too far between down and up.
		if (lastMouseDown1.Excluded || lastMouseUp1.Excluded)
			return;
		// A single click has occurred.
		if (!fakeMouseDown)
			callCB(cbOnSingleClick, touchEvents.isTouchEvent(e), e, false);
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
			callCB(cbOnDoubleClick, false, e);
		}
		else if (!fakeMouseDown)
		{
			if (singleClickTimeout)
			{
				// If we get here, a second single click has occurred while another is still unconfirmed.
				// In this case, the previously unconfirmed click gets confirmed early.
				// A typical way this could happen is if the mouse moved between clicks.
				clearTimeout(singleClickTimeout);
				singleClickTimeout = null;
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
	$(document).on("mouseup mouseleave touchend touchcancel", function (e)
	{
		mouseCoordFixer.fix(e);
		cbDragEnd(e);
	});
	var RecordMouseEvent = function (eventType, e)
	{
		var src, dst;
		if (eventType === 1)
		{
			src = lastMouseDown1;
			dst = lastMouseDown2;
		}
		else if (eventType === 2)
		{
			src = lastMouseUp1;
			dst = lastMouseUp2;
		}
		else
			return;
		dst.X = src.X;
		dst.Y = src.Y;
		dst.Time = src.Time;
		dst.Excluded = src.Excluded;
		src.X = e.pageX;
		src.Y = e.pageY;
		src.Time = performance.now();
		src.Excluded = exclude || excludeNextEvent;
		lastEvent = eventType;
		excludeNextEvent = false;
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
			excludeDragStart = true;
			setTimeout(clearExclusion, 0);
		}
	}
	this.Invalidate = function (invalidateNextEvent)
	{
		/// <summary>Sets the Excluded flag on all logged mouse events, causing them to not count toward clicks or double clicks.</summary>
		lastMouseUp1.Excluded = lastMouseUp2.Excluded = lastMouseDown1.Excluded = lastMouseDown2.Excluded = true;
		excludeNextEvent = invalidateNextEvent;
		clearTimeout(singleClickTimeout);
		singleClickTimeout = null;
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
			LoadCategory(settingsCategoryList[i]);

		modal_dialog.contentChanged(true);
	}
	var LoadCategory = function (category)
	{
		var cat = new CollapsibleSection("uiSettings_category_" + category, category, modal_dialog);

		var rowIdx = 0;
		if (category === "General Settings")
		{
			if (settings.bi_rememberMe === "1")
				rowIdx = Add_ForgetSavedCredentialsButton(cat, rowIdx);
			rowIdx = Add_ResetAllSettingsButton(cat, rowIdx);
		}
		for (var i = 0; i < defaultSettings.length; i++)
		{
			var s = defaultSettings[i];
			var isDisplayable = (s.label || (s.comment && s.inputType === "comment")) && s.category === category;
			if (isDisplayable && (typeof s.preconditionFunc !== "function" || s.preconditionFunc()))
			{
				var $row = $('<div class="uiSettingsRow"></div>');
				if (s.hint && s.hint.length > 0)
					$row.attr('title', s.hint);
				if (rowIdx++ % 2 === 1)
					$row.addClass('everyOther');
				var formFields = {
					inputType: s.inputType
					, value: settings.getItem(s.key)
					, label: s.label
					, tag: s
				};
				if (s.hotkey)
				{
					var $input = $('<input type="text" />');
					AddKeydownEventToElement(HandleHotkeyChange, s, $input);
					var val = settings.getItem(s.key);
					if (!val)
						val = "";
					var parts = val.split("|");
					if (parts.length < 4)
						$input.val("unset");
					else
						$input.val((parts[0] === "1" ? "CTRL + " : "")
							+ (parts[1] === "1" ? "ALT + " : "")
							+ (parts[2] === "1" ? "SHIFT + " : "")
							+ hotkeys.getKeyName(parts[3]));
					$row.addClass('dialogOption_item dialogOption_item_info');
					$row.append($input);
					var label = s.label;
					if (!fullscreen_supported && s.key === 'ui3_hotkey_togglefullscreen')
						label += '<br>(Unavailable)';
					$row.append(GetDialogOptionLabel(label));
				}
				else if (s.inputType === "checkbox")
				{
					formFields.onChange = CheckboxChanged;
					$row.append(UIFormField(formFields));
				}
				else if (s.inputType === "select")
				{
					if ((s.options.length === 0 || s.alwaysRefreshOptions) && typeof s.getOptions === "function")
						s.options = s.getOptions();
					formFields.options = s.options;
					formFields.onChange = SelectChanged;
					$row.append(UIFormField(formFields));
				}
				else if (s.inputType === "number" || s.inputType === "range")
				{
					formFields.minValue = s.minValue;
					formFields.maxValue = s.maxValue;
					formFields.step = s.step;
					formFields.onChange = NumberChanged;
					formFields.defaultValue = s.value;
					if (s.inputType === "range")
					{
						if (s.changeOnStep)
							formFields.onInput = NumberChanged;
						formFields.unitLabel = s.unitLabel;
					}
					$row.append(UIFormField(formFields));
				}
				else if (s.inputType === "comment")
				{
					var comment = typeof s.comment === "function" ? s.comment() : s.comment;
					$row.append(GetDialogOptionLabel(comment));
				}
				else if (s.inputType === "text" || s.inputType === "color")
				{
					formFields.onChange = TextChanged;
					$row.append(UIFormField(formFields));
				}
				cat.$section.append($row);
			}
		}
		if (category === "Extra")
		{
			if (sessionManager.IsAdministratorSession())
			{
				rowIdx = Add_CreateLocalOverridesJsButton(cat, rowIdx);
			}
		}

		$content.append(cat.$heading);
		$content.append(cat.$section);
	}
	var Add_CreateLocalOverridesJsButton = function (cat, rowIdx)
	{
		var $row = $('<div id="createLocalOverridesScript" class="uiSettingsRow dialogOption_item dialogOption_item_info"></div>');
		var $input = $('<a class="input" href="javascript:void(0)" download="ui3-local-overrides.js">Download</a>');
		$input.on('click', function ()
		{
			var text = BuildLocalOverridesTemplate();

			if (!text)
				return false;

			$input.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
			setTimeout(function () { $input.attr('href', 'javascript:void(0)'); }, 0);
			return true;
		});
		$row.append($input);
		$row.append(GetDialogOptionLabel('Create Script: "ui3-local-overrides.js"<br><a href="javascript:UIHelp.LearnMore(\'ui3-local-overrides\')">(learn more)</a>'));
		if (rowIdx++ % 2 == 1)
			$row.addClass('everyOther');
		cat.$section.append($row);
		return rowIdx;
	}
	var BuildLocalOverridesTemplate = function ($input)
	{
		try
		{
			var sb = new StringBuilder("\r\n");
			sb.AppendLine('/*');
			sb.AppendLine('\tTHIS IS FOR ADVANCED USE ONLY');
			sb.AppendLine('\t');
			sb.AppendLine('\tIf you want to modify UI3\'s default behavior, ');
			sb.AppendLine('\tyou must rename this file (if necessary) to "ui3-local-overrides.js"');
			sb.AppendLine('\tand place it in the "ui3" subdirectory where "ui3.js" is located.');
			sb.AppendLine('\t');
			sb.AppendLine('\t"ui3-local-overrides.js" is not included with Blue Iris and should');
			sb.AppendLine('\tnot be overwritten by updates.');
			sb.AppendLine('*/');
			sb.AppendLine();
			sb.AppendLine();
			for (var i = 0; i < settingsCategoryList.length; i++)
				BuildLocalOverridesTemplate_Category(sb, settingsCategoryList[i]);
			BuildLocalOverridesTemplate_Category(sb, null);
			BuildLocalOverridesTemplate_Category(sb, "Streaming Profiles"); // This category isn't shown in UI Settings
			return sb.ToString();
		}
		catch (ex)
		{
			toaster.Error(ex);
			return false;
		}
	}
	var BuildLocalOverridesTemplate_Category = function (sb, category)
	{
		// Output Category heading
		sb.AppendLine('// Category "' + (category ? category : "Uncategorized") + '"');

		// Output parameter legend, which requires measuring key and value max lengths beforehand
		//                       Settings Key   Value   Options Window   Always Reload   Generation
		//OverrideDefaultSetting(key,           value,  true,            false,          0);
		var max_key = 14;
		var max_value = 7;
		for (var i = 0; i < defaultSettings.length; i++)
		{
			var s = defaultSettings[i];
			if (s.category != category || !s.key)
				continue;
			var value = settings.getItem(s.key);
			if (typeof value == "string")
				value = JavaScriptStringEncode(value, true);
			else
				value = value.toString();
			max_key = Math.max(max_key, JavaScriptStringEncode(s.key, true).length + 1);
			max_value = Math.max(max_value, value.length + 1);
		}
		sb.Append('//                     ');
		sb.Append('Settings Key'.padRight(max_key + 1, ' '));
		sb.Append('Value'.padRight(max_value + 1, ' '))
		sb.AppendLine('Options Window   Always Reload   Generation');
		// Output override lines
		for (var i = 0; i < defaultSettings.length; i++)
		{
			var s = defaultSettings[i];
			if (s.category != category)
				continue;
			var key = s.key;
			if (!key || key === "bi_rememberMe" || key === "bi_username" || key === "bi_password")
				continue; // Don't write these to the file!
			var value = settings.getItem(key);
			sb.Append('OverrideDefaultSetting(');
			sb.Append((JavaScriptStringEncode(key, true) + ",").padRight(max_key, ' '));
			sb.Append(' ')
			if (typeof value == "string")
				sb.Append((JavaScriptStringEncode(value, true) + ",").padRight(max_value, ' '));
			else
				sb.Append((value.toString() + ",").padRight(max_value, ' '));
			if (typeof s.IncludeInOptionsWindow == "undefined")
				s.IncludeInOptionsWindow = true;
			if (typeof s.AlwaysReload == "undefined")
				s.AlwaysReload = false;
			sb.Append(' ').Append((!!s.IncludeInOptionsWindow + ",").padRight(16, ' '));
			sb.Append(' ').Append((!!s.AlwaysReload + ",").padRight(15, ' '));
			sb.Append(' ');

			// Increment generation.
			sb.Append(GetNextGenerationForLocalOverrides(s).toString());
			sb.AppendLine(");");
		}
		sb.AppendLine();
	}
	var GetNextGenerationForLocalOverrides = function (s)
	{
		if (typeof s.gen == "undefined" || s.gen == null)
			return 1;
		else
			return parseInt(s.gen) + 1;
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
	var Add_ResetAllSettingsButton = function (cat, rowIdx)
	{
		var $row = $('<div id="resetAllSettingsRow" class="uiSettingsRow dialogOption_item dialogOption_item_info"></div>');
		var $input = $('<input type="button" value="Reset" />');
		$input.on('click', function ()
		{
			AskYesNo('All UI settings will revert to their default values and the page will reload.<br><br><center>Continue?</center>', function ()
			{
				RevertSettingsToDefault();
				location.reload();
			});
		});
		$row.append($input);
		$row.append(GetDialogOptionLabel("Reset All Settings"));
		if (rowIdx++ % 2 == 1)
			$row.addClass('everyOther');
		cat.$section.append($row);
		return rowIdx;
	}
	var CheckboxChanged = function (s, checked)
	{
		settings.setItem(s.key, checked ? "1" : "0");
		CallOnChangeCallback(s);
	}
	var SelectChanged = function (e, s, $select)
	{
		var selectedValue = $select.val();
		if (s.options.indexOf(selectedValue) != -1)
			settings.setItem(s.key, selectedValue);
		CallOnChangeCallback(s);
	}
	var NumberChanged = function (e, s, $input)
	{
		settings.setItem(s.key, parseFloat($input.val()));
		CallOnChangeCallback(s);
	}
	var TextChanged = function (e, s, $input)
	{
		settings.setItem(s.key, $input.val());
		CallOnChangeCallback(s);
	}
	var HandleHotkeyChange = function (e, s, $input)
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
		settings.setItem(s.key, hotkeyValue);

		return false;
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
				s.onChange(settings.getItem(s.key));
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
function GenerateEventTriggeredSoundsComment()
{
	return GenerateH264RequirementString() + "<br/>Sounds are loaded from Blue Iris's \"sounds\" directory. Supported extensions: " + sessionManager.supportedHTML5AudioFormats.join(", ");
}
function GenerateEventTriggeredIconsComment()
{
	return GenerateH264RequirementString() + "<br/>Icons are shown in the upper-right corner of the video player.";
}
function GenerateH264RequirementString()
{
	return '-- Requires an H.264 stream. --' + (h264_playback_supported ? '' : '<br/><span class="settingsCommentError">-- H.264 streams are not supported by this browser --</span>');
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
	ui3_contextMenus_longPress_toast = toaster.Info("This setting will take effect when you reload the page.<br><br>Context menus will open on " + (settings.ui3_contextMenus_longPress == "1" ? "long-press" : "right click") + ".<br><br>Clicking this message will reload the page.", 60000, false
		, function ()
		{
			location.reload();
		});
}
function GetPreferredContextMenuTrigger()
{
	return settings.ui3_contextMenus_longPress == "1" ? "longpress" : "right";
}
function OnChange_ui3_time24hour()
{
	use24HourTime = settings.ui3_time24hour == "1";
}
function OnChange_ui3_h264_choice2()
{
	ui3_contextMenus_longPress_toast = toaster.Info("This setting will take effect when you reload the page.<br><br>Clicking this message will reload the page.", 60000, false
		, function ()
		{
			location.reload();
		});
}
function Precondition_ui3_h264_choice2()
{
	return (pnacl_player_supported || mse_mp4_h264_supported);
}
function OnChange_ui3_streamingProfileBitRateMax()
{
	videoPlayer.RefreshVideoStream();
}
function Precondition_ui3_streamingProfileBitRateMax()
{
	return h264_playback_supported;
}
function Precondition_ui3_html5_delay_compensation()
{
	return (mse_mp4_h264_supported && settings.ui3_h264_choice2 === H264PlayerOptions.HTML5);
}
function Precondition_ui3_force_gop_1sec()
{
	return (mse_mp4_h264_supported && settings.ui3_h264_choice2 === H264PlayerOptions.HTML5 && BrowserIsFirefox());
}
function OnChange_ui3_force_gop_1sec()
{
	videoPlayer.SelectedQualityChanged();
}
function OnChange_ui3_icons_extraVisibility()
{
	cornerStatusIcons.ReInitialize();
}
function OnChange_ui3_wheelZoomMethod()
{
	zoomHandler_Adjustable.ZoomToFit();
	zoomHandler_Legacy.ZoomToFit();
	imageRenderer.ImgResized();
}
function OnChange_ui3_fullscreen_videoonly()
{
	if (fullScreenModeController.isFullScreen())
	{
		if (settings.ui3_fullscreen_videoonly == "1")
			$("#layoutleft,#layouttop").hide();
		else
			$("#layoutleft,#layouttop").show();
		resized();
	}
}
function OnChange_ui3_skipAmount()
{
	$('#lblSkipBack,#lblSkipAhead').text(GetSkipAmount().dropDecimalsStr() + "s");
}
function OnChange_ui3_pc_next_prev_buttons()
{
	if (settings.ui3_pc_next_prev_buttons == "1")
		$('#pcPrevClip,#pcNextClip').removeClass("hidden");
	else
		$('#pcPrevClip,#pcNextClip').addClass("hidden");
}
function OnChange_ui3_pc_seek_buttons()
{
	if (settings.ui3_pc_seek_buttons == "1")
		$('#pcSkipBack,#pcSkipAhead').removeClass("hidden");
	else
		$('#pcSkipBack,#pcSkipAhead').addClass("hidden");
}
function OnChange_ui3_pc_seek_1frame_buttons()
{
	if (settings.ui3_pc_seek_1frame_buttons == "1")
		$('#pcSkipBack1Frame,#pcSkipAhead1Frame').removeClass("hidden");
	else
		$('#pcSkipBack1Frame,#pcSkipAhead1Frame').addClass("hidden");
}
function OnChange_ui3_extra_playback_controls_padding()
{
	if (settings.ui3_extra_playback_controls_padding == "1")
		$('#pcButtonContainer').addClass("extraPadding");
	else
		$('#pcButtonContainer').removeClass("extraPadding");
}
function OnChange_ui3_ir_brightness_contrast()
{
	if (settings.ui3_ir_brightness_contrast == "1")
		$('#ptzIrBrightnessContrast').show();
	else
		$('#ptzIrBrightnessContrast').hide();
}
///////////////////////////////////////////////////////////////
// Form Field Helpers /////////////////////////////////////////
///////////////////////////////////////////////////////////////
function UIFormField(args)
{
	var o = $.extend({
		inputType: "unset" // required
		, value: null // required
		, label: ""
		, tag: null // Object passed through to event handlers
		, onChange: null // Called when the input's value is changed
		, onInput: null // Some inputs emit this rapidly while the user types or drags
		, options: null // array of option strings for "select" inputs
		, minValue: undefined // number / range types
		, maxValue: undefined // number / range types
	}, args);

	if (o.inputType === "checkbox")
		return GetCustomCheckbox(o.tag, o.label, o.value === true || o.value === "1", o.onChange);
	else if (o.inputType === "select")
	{
		var sb = new StringBuilder();
		sb.Append('<select>');
		for (var i = 0; i < o.options.length; i++)
			sb.Append(GetHtmlOptionElementMarkup(o.options[i], o.options[i], o.value));
		sb.Append('</select>');
		var $input = $(sb.ToString());
		$input.on('change', function (e) { return o.onChange(e, o.tag, $input); });
		return $('<div class="dialogOption_item dialogOption_item_ddl"></div>').append($input).append(GetDialogOptionLabel(o.label));
	}
	else if (o.inputType === "number" || o.inputType === "range")
	{
		var $input = $('<input type="' + o.inputType + '" />');
		if (typeof o.minValue !== "undefined") $input.attr('min', o.minValue);
		if (typeof o.maxValue !== "undefined") $input.attr('max', o.maxValue);
		if (typeof o.step !== "undefined") $input.attr('step', o.step);
		$input.val(o.value);
		$input.on('change', function (e) { return o.onChange(e, o.tag, $input); });
		var $label = $(GetDialogOptionLabel(o.label));
		var classes = "dialogOption_item dialogOption_item_info";
		if (o.inputType === "range")
		{
			if (typeof o.onInput === "function")
				$input.on('input', function (e) { return o.onInput(e, o.tag, $input); });
			// Set up numeric output for range control
			$label.append('<span>: </span>');
			var $numericValue = $('<span></span>');
			$numericValue.text(o.value);
			$label.append($numericValue);
			if (o.unitLabel)
				$label.append($('<span></span>').text(o.unitLabel));
			$input.on('input change', function ()
			{
				$numericValue.text($input.val());
			});
			if (typeof o.defaultValue === 'number')
				$input.on('dblclick', function ()
				{
					$input.val(o.defaultValue);
					$input.trigger('change');
				});
			return $('<div class="' + classes + ' dialogOption_item_range"></div>').append($label).append($input);
		}
		else
			return $('<div class="' + classes + '"></div>').append($input).append($label);
	}
	else if (o.inputType === "text" || o.inputType === "color")
	{
		var $input = $('<input type="' + o.inputType + '" data-lpignore="true" autocomplete="off" />');
		if (o.maxValue)
			$input.attr('maxlength', o.maxValue);
		$input.val(o.value);
		$input.on('change', function (e) { return o.onChange(e, o.tag, $input); });
		return $('<div class="dialogOption_item dialogOption_item_info"></div>').append($input).append(GetDialogOptionLabel(o.label));
	}
	else if (o.inputType === "errorCommentText")
	{
		return $('<div class="dialogOption_item dialogOption_item_info dialogOption_item_comment settingsCommentError"></div>').text(o.label);
	}
	else if (o.inputType === "errorCommentHtml")
	{
		return $('<div class="dialogOption_item dialogOption_item_info dialogOption_item_comment settingsCommentError"></div>').html(o.label);
	}
	else if (o.inputType === "commentText")
	{
		return $('<div class="dialogOption_item dialogOption_item_info dialogOption_item_comment"></div>').text(o.label);
	}
	else if (o.inputType === "commentHtml")
	{
		return $('<div class="dialogOption_item dialogOption_item_info dialogOption_item_comment"></div>').html(o.label);
	}
	else if (o.inputType === "noteText")
	{
		return $('<div class="dialogOption_item dialogOption_item_info"></div>').text(o.label);
	}
	else if (o.inputType === "noteHtml")
	{
		return $('<div class="dialogOption_item dialogOption_item_info"></div>').html(o.label);
	}
	else
	{
		console.error("Invalid arguments sent to UIFormField", args);
		return $('<div class="dialogOption_item dialogOption_item_info">Invalid arguments sent to UIFormField.</div>');
	}
}
///////////////////////////////////////////////////////////////
// UI Help ////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
var UIHelp = new UIHelpTool();
function UIHelpTool()
{
	var self = this;
	this.LearnMore = function (topic)
	{
		switch (topic)
		{
			case 'Double-Click to Fullscreen':
				Double_Click_to_Fullscreen();
				break;
			case 'Context Menu On Long-Press':
				Context_Menu_On_Long_Press();
				break;
			case 'Camera Group Webcasting':
				Camera_Group_Webcasting();
				break;
			case "IR Brightness Contrast":
				IR_Brightness_Contrast();
				break;
			case "ui3-local-overrides":
				UI3_Local_Overrides_Help();
				break;
			case "Export Types":
				UI3_Export_Types_Help();
				break;
			case "H.264 Player Options":
				UI3_H264_Player_Options_Help();
				break;
			case "HTML5 Video Delay Compensation":
				UI3_HTML5_Delay_Compensation_Help();
				break;
			case "Firefox Stutter Fix":
				UI3_Firefox_Stuffer_fix_Help();
				break;
		}
	}
	var Context_Menu_On_Long_Press = function ()
	{
		$('<div class="UIHelp" style="max-width:500px;">'
			+ 'Many useful functions in this interface are accessed by context menus (a.k.a. "Right-click menus").<br><br>'
			+ 'Context menus are normally opened by right clicking.  On most touchscreen devices, instead you must press and hold.<br><br>'
			+ 'However on some devices it is impossible to open context menus the normal way.  If this applies to you,'
			+ ' enable "Context Menu On Long-Press".  This will change how context menus'
			+ ' are triggered so they should open when the left mouse button is held down for a moment.'
			+ (browser_is_ios
				? ('<br><br>Your operating system was detected as iOS, where there is a known compatibility issue with context menus.'
					+ '  You may be unable to access the context menu regardless of this setting.')
				: '')
			+ '</div>')
			.modalDialog({ title: "Context Menu On Long-Press", closeOnOverlayClick: true });
	}
	var Double_Click_to_Fullscreen = function ()
	{
		$('<div class="UIHelp" style="max-width:500px;">'
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
			.modalDialog({ title: "Double-Click to Fullscreen", closeOnOverlayClick: true });
	}
	var Camera_Group_Webcasting = function ()
	{
		var $root = $('<div class="UIHelp">'
			+ 'This interface is easier to use when all your camera groups have webcasting enabled.<br><br>'
			+ 'Enable webcasting for your groups using the group settings panel.  This panel is found in the lower-left corner of the Blue Iris console (only when PTZ controls are enabled):<br><br>'
			+ '</div>');
		var $img = $('<img src="ui3/help/img/GroupProperties.png" style="width:400px; height:320px;" />');
		$root.append($img);
		$img.lightbox();
		$root.modalDialog({ title: 'Camera Group Webcasting', closeOnOverlayClick: true });
	}
	var IR_Brightness_Contrast = function ()
	{
		var $root = $('<div class="UIHelp">'
			+ 'Infrared, Brightness, and Contrast controls do not work well with many cameras, so they are disabled by default to save space.<br><br>'
			+ 'When enabled, these controls appear in the PTZ section below the presets, and only work when you have maximized a camera that has PTZ enabled in Blue Iris.'
			+ '</div>');
		$root.modalDialog({ title: 'IR, Brightness, and Contrast', closeOnOverlayClick: true });
	}
	var UI3_Local_Overrides_Help = function ()
	{
		$('<div class="UIHelp">'
			+ 'Click "Download" to download a ui3-local-overrides.js file which is pre-configured to change the defaults for all of UI3\'s settings to match your current configuration.<br><br>'
			+ 'The ui3-local-overrides system allows you to override default UI3 behavior for all your users.<br><br>'
			+ '<a href="ui3/help/help.html#extensions" target="_blank">Click here to learn more about ui3-local-overrides.</a>'
			+ '</div>').modalDialog({ title: 'ui3-local-overrides', closeOnOverlayClick: true });
	}
	var UI3_Export_Types_Help = function ()
	{
		$('<div class="UIHelp">'
			+ 'UI3 will export in "Native" mode or "Slow Transcode" mode depending on the format of the source recording.<br><br>'
			+ '"Native" mode is used when the source recording has H.264 video in a .bvr container.  This mode is fast (depending on network speed) and results in excellent video quality.<br><br>'
			+ '"Slow Transcode" mode is used when "Native" mode is not possible.  This mode transcodes the source video to H.264 in real-time using your Streaming 0 profile.  The export will take about as many seconds as the size of the exported section.'
			+ '</div>').modalDialog({ title: 'Export Types', closeOnOverlayClick: true });
	}
	var UI3_H264_Player_Options_Help = function ()
	{
		$('<div class="UIHelp">'
			+ 'UI3 has several H.264 player options. Not all options are available in all browsers.'
			+ '<br><br><b>JavaScript</b> - ' + (h264_playback_supported ? '<span style="color:#66FF66;">Available</span>' : '<span style="color:#FF3333;">Not Available</span>') + '<br><br>'
			+ '&nbsp; &nbsp; The JavaScript player is the most robust and compatible player option, but also the slowest.'
			+ '<br><br><b>HTML5</b> - ' + (mse_mp4_h264_supported ? '<span style="color:#66FF66;">Available</span>' : '<span style="color:#FF3333;">Not Available</span>') + '<br><br>'
			+ '&nbsp; &nbsp; The HTML5 player works by converting each frame into a fragmented MP4 which is played using Media Source Extensions.  This is usually the fastest option, but has compatibility problems with some browsers.'
			+ '<br><br><b>NaCl</b> - ' + (pnacl_player_supported ? '<span style="color:#66FF66;">Available</span>' : '<span style="color:#FF3333;">Not Available</span>') + '<br><br>'
			+ '&nbsp; &nbsp; The NaCl player is much faster than the JavaScript player. It is not quite as fast as the HTML5 player, and takes longer to load when you open UI3, but it is more stable. This player is only available in in ChromeOS and in the Chrome browser on a desktop OS (such as Windows or Mac).  It uses Google\'s "NaCl" technology, which is expected to be removed from Chrome in 2018.  ChromeOS may lose NaCl support around the same time, or it may remain supported for a while longer. '
			+ (pnacl_player_supported ? ('<br><br>The NaCl player has 3 modes available, each with different behavior regarding Hardware Accelerated Video Decoding.<br>'
				+ '<ul>'
				+ '<li><b>' + H264PlayerOptions.NaCl_HWVA_Auto + '</b><br>The player will try to use hardware decoding, but will fall back to software decoding if hardware decoding is unavailable. The fallback process may increase loading times.</li>'
				+ '<li><b>' + H264PlayerOptions.NaCl_HWVA_No + '</b><br>The player will use software decoding only.</li>'
				+ '<li><b>' + H264PlayerOptions.NaCl_HWVA_Yes + '</b><br>The player will use hardware decoding only, and may fail if hardware acceleration is unavailable.</li>'
				+ '</ul>'
			) : '')
			+ '</div>').modalDialog({ title: 'H.264 Player Options', closeOnOverlayClick: true });
	}
	var UI3_HTML5_Delay_Compensation_Help = function ()
	{
		$('<div class="UIHelp">'
			+ 'HTML5 video was not designed for low-latency playback, so brief stream interruptions build up to a noticeable delay. UI3 is built with an experimental delay compensator which can speed up or slow down the video player to keep video delay at a consistent level. This delay compensator is configurable via the HTML5 Video Delay Compensation option.'
			+ '</div>').modalDialog({ title: 'HTML5 Video Delay Compensation', closeOnOverlayClick: true });
	}
	var UI3_Firefox_Stuffer_fix_Help = function ()
	{
		$('<div class="UIHelp">'
			+ "Firefox's HTML5 video player has trouble with low-latency streams. Basically, it requires frequent keyframes or else performance degrades rapidly.  The Firefox Stutter Fix option forces your keyframe interval to be equal to the camera\'s frame rate while you are using the HTML5 player for H.264 video.  This reduces video quality somewhat, but ensures relatively good decoding performance.<br><br>"
			+ "If this bothers you, it is recommended to use a different H.264 player option."
			+ '</div>').modalDialog({ title: 'Firefox Stutter Fix', closeOnOverlayClick: true });
	}
}
///////////////////////////////////////////////////////////////
// Collapsible Section for Dialogs ////////////////////////////
///////////////////////////////////////////////////////////////
function CollapsibleSection(id, htmlTitle, dialogToNotify)
{
	var self = this;
	var settingsKey = "ui3_cps_" + id.replace(/\W/g, '_') + "_visible";
	var visibleSetting = settings.getItem(settingsKey);
	if (visibleSetting !== "0" && visibleSetting !== "1")
	{
		// The setting should have been added to defaultSettings.
		console.error("SETTING DOES NOT EXIST", settingsKey);
		visibleSetting = "1";
		settings.setItem(settingsKey, visibleSetting);
	}

	var GetSectionHeading = function ()
	{
		var $heading = $('<div class="collapsible_section_heading">' + htmlTitle + '</div>');
		$heading.on('click', SectionHeadingClick);
		if (settings.getItem(settingsKey) == "1")
			$heading.addClass("expanded");
		return $heading;
	}
	var GetSection = function ()
	{
		var $section = $('<div class="collapsible_section"></div>');
		if (settings.getItem(settingsKey) == "0")
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
					settings.setItem(settingsKey, expanded ? "1" : "0");
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
// Binary Constants ///////////////////////////////////////////
///////////////////////////////////////////////////////////////
var b0000_0001 = 1;
var b0000_0010 = 2;
var b0000_0100 = 4;
var b0000_1000 = 8;
var b0001_0000 = 16;
var b0010_0000 = 32;
var b0100_0000 = 64;
var b1000_0000 = 128;
var b0001_0000_0000 = 256;
var b0000_0001_0000_0000_0000_0000 = 65536;
var b0000_0010_0000_0000_0000_0000 = 131072;
var b0000_0100_0000_0000_0000_0000 = 262144;
var b0000_1000_0000_0000_0000_0000 = 524288;
var b0001_0000_0000_0000_0000_0000 = 1048576;
var b0010_0000_0000_0000_0000_0000 = 2097152;
var b0100_0000_0000_0000_0000_0000 = 4194304;
var b1000_0000_0000_0000_0000_0000 = 8388608;
var clip_flag_audio = b0000_0001;
var clip_flag_flag = b0000_0010;
var clip_flag_protect = b0000_0100;
var clip_flag_backingup = b0100_0000;
var clip_flag_backedup = b1000_0000;
var clip_flag_is_recording = b0001_0000_0000;
var alert_flag_offsetMs = b0000_0001_0000_0000_0000_0000;
var alert_flag_trigger_motion = b0000_0010_0000_0000_0000_0000;
var alert_flag_nosignal = b0000_0100_0000_0000_0000_0000;
var alert_flag_trigger_audio = b0000_1000_0000_0000_0000_0000;
var alert_flag_trigger_external = b0001_0000_0000_0000_0000_0000;
var alert_flag_trigger_group = b0100_0000_0000_0000_0000_0000;
///////////////////////////////////////////////////////////////
// StringBuilder //////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function StringBuilder(lineBreakStr)
{
	var self = this;
	var strings = [];
	if (!lineBreakStr)
		lineBreakStr = "\r\n";
	this.Append = function (value)
	{
		if (typeof value !== "undefined")
			strings.push(value);
		return this;
	}
	this.AppendLine = function (value)
	{
		if (typeof value !== "undefined")
			strings.push(value);
		strings.push(lineBreakStr);
		return this;
	}
	this.Clear = function ()
	{
		strings = [];
		return this;
	}
	this.ToString = function ()
	{
		return strings.join("");
	}
	this.Length = function ()
	{
		var size = 0;
		for (var i = 0; i < strings.length; i++)
			size += strings[i].length;
		return size;
	}
}
///////////////////////////////////////////////////////////////
// Uint8Array to Data URI /////////////////////////////////////
///////////////////////////////////////////////////////////////
function Uint8ArrayToDataURI(someUint8Array)
{
	// <summary>The dataUri returned from this method should be sent to window.URL.revokeObjectURL() when it is done being used!</summary>
	var blob = new Blob([someUint8Array]);
	return window.URL.createObjectURL(blob);
}
///////////////////////////////////////////////////////////////
// Misc ///////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function IsStandaloneApp()
{
	return navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches == true);
}
(function ()
{
	// Date.now() and performance.now() polyfills
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
	var fallbackLogoutUrl = currentServer.remoteBaseURL + 'logout.htm' + currentServer.GetRemoteSessionArg("?");
	if (currentServer.isUsingRemoteServer)
	{
		ExecJSON({ cmd: "logout" }, function (response)
		{
			if (response && response.result == "success")
			{
				// If implementing remote server connections:  Here, we would do SendToServerListOnStartup();
				location.href = fallbackLogoutUrl;
			}
			else
				location.href = fallbackLogoutUrl;
		}, function ()
			{
				location.href = fallbackLogoutUrl;
			});
	}
	else
	{
		ExecJSON({ cmd: "logout" }, function (response)
		{
			if (response && response.result == "success")
				location.href = currentServer.remoteBaseURL + "login.htm?autologin=0&page=" + encodeURIComponent(location.pathname);
			else
				location.href = fallbackLogoutUrl;
		}, function ()
			{
				location.href = fallbackLogoutUrl;
			});
	}
}
function logoutOldSession(oldSession)
{
	// When running multiple instances of the UI in the same browser, this causes instances to log out the session belonging to another instance.
	// As long as cookies are sharing sessions between multiple browser tabs, this code should not be enabled.
	// With the user name in the session data, we avoid creating most unnecessary new sessions in the first place, but it does not make this feature safe to turn on.
	// NOTE: Blue Iris fails to log out the session anyway if it is currently in use by an active connection.
	//if (oldSession != null && oldSession != sessionManager.GetSession())
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
function FitRectangleIntoCanvas(rect, canvas)
{
	var w = canvas.width;
	var h = canvas.height;
	if (w < 1 || h < 1)
		return;
	rect[0] = Clamp(rect[0], 0, w - 1);
	rect[1] = Clamp(rect[1], 0, h - 1);
	rect[2] = Clamp(rect[2], rect[0] + 1, w);
	rect[3] = Clamp(rect[3], rect[1] + 1, h);
}
function Clamp(i, min, max)
{
	if (i < min)
		return min;
	if (i > max)
		return max;
	if (isNaN(i))
		return min;
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
function isNullOrWhitespace(input)
{
	return !input || !input.trim();
}
String.prototype.padLeft = function (len, c)
{
	var pads = len - this.length;
	if (pads > 0)
	{
		var sb = [];
		var pad = c || "&nbsp;";
		for (var i = 0; i < pads; i++)
			sb.push(pad);
		sb.push(this);
		return sb.join("");
	}
	return this;

};
String.prototype.padRight = function (len, c)
{
	var pads = len - this.length;
	if (pads > 0)
	{
		var sb = [];
		sb.push(this);
		var pad = c || "&nbsp;";
		for (var i = 0; i < pads; i++)
			sb.push(pad);
		return sb.join("");
	}
	return this;
};
Number.prototype.padLeft = function (len, c)
{
	return this.toString().padLeft(len, c);
};
Number.prototype.padRight = function (len, c)
{
	return this.toString().padRight(len, c);
};
function NumToHex4(num)
{
	return num.ToString(16).toUpperCase().padLeft(4, '0');
}
function NumToHexUpper(num)
{
	return num.ToString(16).toUpperCase();
}
function makeUnselectable($target)
{
	$target
		.addClass('unselectable') // All these attributes are inheritable
		.attr('unselectable', 'on') // For IE9 - This property is not inherited, needs to be placed onto everything
		.attr('draggable', 'false') // For moz and webkit, although Firefox 16 ignores this when -moz-user-select: none; is set, it's like these properties are mutually exclusive, seems to be a bug.
		.on('dragstart', function () { return false; });  // Needed since Firefox 16 seems to ingore the 'draggable' attribute we just applied above when '-moz-user-select: none' is applied to the CSS 

	$target // Apply non-inheritable properties to the child elements
		.find('*:not(.selectable)')
		.attr('draggable', 'false')
		.attr('unselectable', 'on');
}
function pointInsideElement($ele, pX, pY)
{
	if ($ele.length == 0)
		return false;
	var o = $ele.offset();
	var w = $ele.outerWidth(true);
	var h = $ele.outerHeight(true);
	return pX >= o.left && pX < o.left + w && pY >= o.top && pY < o.top + h;
}
function pointInsideElementBorder($ele, pX, pY)
{
	if ($ele.length == 0)
		return false;
	var o = $ele.offset();
	var w = $ele.outerWidth();
	var h = $ele.outerHeight();
	return pX >= o.left && pX < o.left + w && pY >= o.top && pY < o.top + h;
}
function BlueIrisColorToCssColor(biColor)
{
	var colorHex = biColor.toString(16).padLeft(8, '0').substr(2);
	return colorHex.substr(4, 2) + colorHex.substr(2, 2) + colorHex.substr(0, 2);
}
function HexColorToRgbObj(c)
{
	if (c.startsWith('#'))
		c = c.substr(1);
	return { r: parseInt(c.substr(0, 2), 16), g: parseInt(c.substr(2, 2), 16), b: parseInt(c.substr(4, 2), 16) };
}
function HexColorToRgbaColor(c, alpha)
{
	c = HexColorToRgbObj(c);
	return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
}
function GetReadableTextColorHexForBackgroundColorHex(c, dark, light)
{
	/// <summary>Returns a hex color not including "#", such as "222222" or "DDDDDD".</summary>
	c = HexColorToRgbObj(c);
	var o = Math.round(((c.r * 299) + (c.g * 587) + (c.b * 114)) / 1000);
	if (o > 125)
	{
		if (dark)
			return dark;
		else
			return "222222";
	}
	else
	{
		if (light)
			return light;
		else
			return "DDDDDD";
	}
}
function hslToRgb(h, s, l) { if (0 == s) l = s = h = l; else { var f = function (l, s, c) { 0 > c && (c += 1); 1 < c && --c; return c < 1 / 6 ? l + 6 * (s - l) * c : .5 > c ? s : c < 2 / 3 ? l + (s - l) * (2 / 3 - c) * 6 : l }, e = .5 > l ? l * (1 + s) : l + s - l * s, g = 2 * l - e; l = f(g, e, h + 1 / 3); s = f(g, e, h); h = f(g, e, h - 1 / 3) } return [255 * l, 255 * s, 255 * h] }
function PercentTo01Float(s, defaultValue)
{
	s = parseFloat(s) / 100;
	if (typeof s === 'undefined' || isNaN(s))
		s = defaultValue;
	return Clamp(s, 0, 1);
}
function stopDefault(e)
{
	if (e && e.preventDefault)
	{
		e.preventDefault();
	}
	else if (window.event)
	{
		window.event.returnValue = false;
	}
	return false;
}
function JavaScriptStringEncode(str, wrapInQuotes)
{
	/// <summary>Encodes a string so it can safely be written to a string literal in a JavaScript file.  Characters such as tab, carriage return, line feed, single and double quotes are escaped.</summary>
	var sb = [];
	if (wrapInQuotes)
		sb.push('"');
	for (var i = 0; i < str.length; i++)
	{
		var c = str.charCodeAt(i);
		if ((c >= 0 && c <= 7) || c == 11 || (c >= 14 && c <= 31) || c == 39 || c == 60 || c == 62)
			sb.push("\\u" + NumToHex4(c));
		else if (c == 8)
			sb.push("\\b");
		else if (c == 9)
			sb.push("\\t");
		else if (c == 10)
			sb.push("\\n");
		else if (c == 12)
			sb.push("\\f");
		else if (c == 13)
			sb.push("\\r");
		else if (c == 34)
			sb.push("\\\"");
		else if (c == 39)
			sb.push("\\'");
		else if (c == 92)
			sb.push("\\\\");
		else
			sb.push(str.charAt(i));
	}
	if (wrapInQuotes)
		sb.push('"');
	return sb.join("");
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
String.prototype.startsWithCaseInsensitive = function (prefix)
{
	if (this.length < suffix.length)
		return false;
	return this.substr(0, suffix.length).toLowerCase() === suffix.toLowerCase();
}
String.prototype.endsWith = function (suffix)
{
	if (this.length < suffix.length)
		return false;
	return this.substr(this.length - suffix.length) === suffix;
};
String.prototype.endsWithCaseInsensitive = function (suffix)
{
	if (this.length < suffix.length)
		return false;
	return this.substr(this.length - suffix.length).toLowerCase() === suffix.toLowerCase();
};
String.prototype.toFloat = function (digits)
{
	return parseFloat(this.toFixed(digits));
};
Number.prototype.toFloat = function (digits)
{
	return parseFloat(this.toFixed(digits));
};
Number.prototype.toFixedNoE = function (digits)
{
	var str = this.toFixed(digits);
	if (str.indexOf('e+') < 0)
		return str;

	// if number is in scientific notation, pick (b)ase and (p)ower
	return str.replace('.', '').split('e+').reduce(function (p, b)
	{
		return p + Array(b - p.length + 2).join(0);
	}) + (digits > 0 ? ('.' + Array(digits + 1).join(0)) : '');
};
Number.prototype.dropDecimals = function ()
{
	return Number(this.dropDecimalsStr());
};
Number.prototype.dropDecimalsStr = function ()
{
	var str = this.toFixedNoE(20);
	var idxDot = str.indexOf('.');
	if (idxDot > -1)
		str = str.substr(0, idxDot);
	return str;
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
var use24HourTime = false;
function GetTimeStr(date, includeMilliseconds)
{
	var ampm = "";
	var hour = date.getHours();
	if (!use24HourTime)
	{
		if (hour == 0)
		{
			hour = 12;
			ampm = " AM";
		}
		else if (hour == 12)
		{
			ampm = " PM";
		}
		else if (hour > 12)
		{
			hour -= 12;
			ampm = " PM";
		}
		else
		{
			ampm = " AM";
		}
	}
	var ms = includeMilliseconds ? ("." + date.getMilliseconds()) : "";

	var str = hour.toString().padLeft(2, '0') + ":" + date.getMinutes().toString().padLeft(2, '0') + ":" + date.getSeconds().toString().padLeft(2, '0') + ms + ampm;
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
function formatBytes2(bytes, decimals)
{
	if (bytes == 0) return '0 B';
	var negative = bytes < 0;
	if (negative)
		bytes = -bytes;
	var k = 1024,
		dm = typeof decimals != "undefined" ? decimals : 2,
		sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
		i = Math.floor(Math.log(bytes) / Math.log(k));
	return (negative ? '-' : '') + (bytes / Math.pow(k, i)).toFloat(dm) + ' ' + sizes[i];
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
function BrowserIsChrome()
{
	return navigator.appVersion.indexOf(" Chrome/") > -1;
}
function BrowserIsIOS()
{
	return !!navigator.userAgent.match(/iPad|iPhone|iPod/);
}
function BrowserIsIOSSafari()
{
	return BrowserIsIOS() && !!navigator.userAgent.match(/ Safari\//) && !navigator.userAgent.match(/ CriOS\//);
}
function BrowserIsIOSChrome()
{
	return BrowserIsIOS() && !!navigator.userAgent.match(/ Safari\//) && !!navigator.userAgent.match(/ CriOS\//);
}
function BrowserIsAndroid()
{
	return !!navigator.userAgent.match(/ Android /);
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
function dec2bin(dec)
{
	/// <summary>Returns the binary representation of a number.</summary>
	return (dec >>> 0).toString(2);
}
function InsertSpacesInBinary(binaryString, maxLength)
{
	if (binaryString.length < maxLength)
		binaryString = binaryString.padLeft(maxLength, '0');
	var output = [];
	for (var i = 0; i < binaryString.length; i++)
	{
		if (i != 0 && i % 8 == 0)
			output.push(" ");
		else if (i != 0 && i % 4 == 0)
			output.push("_");
		output.push(binaryString[i]);
	}
	return output.join("");
}
function GetMediaErrorMessage(code)
{
	if (MediaError)
	{
		if (code === MediaError.MEDIA_ERR_ABORTED)
			return "MEDIA_ERR_ABORTED";
		else if (code === MediaError.MEDIA_ERR_NETWORK)
			return "MEDIA_ERR_NETWORK";
		else if (code === MediaError.MEDIA_ERR_DECODE)
			return "MEDIA_ERR_DECODE";
		else if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)
			return "MEDIA_ERR_SRC_NOT_SUPPORTED";
	}
	return "unknown error code (" + code + ")";
}