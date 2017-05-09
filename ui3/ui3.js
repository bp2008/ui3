/// <reference path="ui3-local-overrides.js" />
/// <reference path="libs-src/jquery-1.11.3.js" />
/// <reference path="libs-ui3.js" />
/// This web interface is licensed under the GNU LGPL Version 3
"use strict";
var developerMode = false;

var toaster = new Toaster();
var loadingHelper = new LoadingHelper();
var touchEvents = new TouchEventHelper();
var uiSizeHelper = null;
var audioPlayer = null;
var diskUsageGUI = null;
var systemLog = null;
var systemConfig = null;
var cameraProperties = null;
var statusBars = null;
var dropdownBoxes = null;
var imageQualityHelper = null;
var ptzButtons = null;
var playbackControls = null;
var seekBar = null;
var clipTimeline = null;
var hotkeys = null;
var dateFilter = null;
var hlsPlayer = null;
var jpegSuppressionDialog = null;
var canvasContextMenu = null;
var calendarContextMenu = null;
var togglableContextMenus = null;
var cameraConfig = null;
var imageLoader = null;
var imageRenderer = null;
var sessionManager = null;
var statusLoader = null;
var cameraListLoader = null;
var clipLoader = null;

var currentPrimaryTab = "";

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
				getName: function (ele) { return "Goto Preset " + ele.getAttribute("presetnum"); }
				, action: function (ele) { ptzButtons.PTZ_goto_preset(ele.presetnum); }
				, shouldDisable: function () { return !ptzButtons.isEnabledNow(); }
			}
				, {
				getName: function (ele) { return "Set Preset " + ele.getAttribute("presetnum"); }
				, action: function (ele) { ptzButtons.PresetSet(ele.getAttribute("presetnum")); }
				, shouldDisable: function () { return !ptzButtons.isEnabledNow(); }
			}]
			, function () { return !imageLoader.currentlyLoadingImage.ptz; }
		]
	];

// TODO: Add camera properties:
//	- audio_sense 0-32000
//	- sense 11000 - 1000
//	- contrast 12-84
//	- maketime 0-100 (tenths of a second)
//	- breaktime 0-9000 (tenths of a second)
// TODO: Fix bug where mousing over SVG graphics in Firefox causes main menu (and dropdown menus) to close.
// TODO: Integrate my custom scroll bars with ui2modal.
// TODO: Context menu for Clip List Items (Requires clip multi-select feature, and ability to delete or flag multiple clips with one API call!)
// -- TODO: Flag/unflag
// -- TODO: Download
// -- TODO: Delete
// -- Flagging or downloading more than 1 clip at once requires confirmation.  Deleting always requires confirmation.  Deleting one clip shows a copy of the clip tile in the confirmation dialog, as in UI2.
// TODO: Fullscreen mode for clips and live view using a placeholder button in lower right.  Fullscreen mode should allocate all available space to the video, hiding unnecessary UI elements.  It should also request that the browser enters full-screen mode.
// TODO: Clip title appears at top of clip player when mouse draws near.
// TODO: Close button appears at top right of clip player when mouse draws near.

// TODO: UI Settings
// -- Including an option to forget saved credentials.
// TODO: Full Camera List
// TODO: Clip properties

// TODO: Automatic clip list refresh.
// -- Automatic clip list updates will only work if the date filter is cleared, but they will work automatically and without user-interaction.
// -- Consider making the automatic clip list update only request clips starting with the date of the most recent clip already found, and add new items to the top of the list.  This will almost certainly break layout, but hopefully the UI sizing code I already wrote can be leveraged to re-do the layout efficiently.
// -- Before automatically loading a new clip list, the current clip should be remembered, as well as its position onscreen, and if possible the clip list scroll/selection state should be restored upon loading the new list.
// -- Automatic clip list updates should only happen if there has been no user input to the clip list within the last N seconds, to minimize the chance of disruption.
// -- Auto-scroll to top if the clip list was previously scrolled to top, even if clips are selected.

// TODO: Redesign the video player to be more of a plug-in module so the user can switch between jpeg and H.264 streaming, or MAYBE even the ActiveX control.  This is tricky as I still want the download snapshot and Open in new tab functions to work regardless of video streaming method.  I probably won't start this until Blue Iris has H.264/WebSocket streaming capability.

// TODO: Enable the local_overrides file callouts

// TODO: Fix bug in IE where main menu scroll bar appears unnecessarily in medium and large sizes.

// TODO: Fix bug where some browsers can't show a scroll bar in the main menu

// CONSIDER: "Your profile has changed" messages could include the previous and new profile names and numbers.
// CONSIDER: Clicking the speaker icon should toggle volume between 0 and its last otherwise-set position.
// CONSIDER: Multiple-server support, like in UI2
// TODO: Adjust frame rate status bar maximum based on currently active camera or group (defaulting to 10 FPS if none is available)
// CONSIDER: Artificially limit the jpeg refresh rate if Blue Iris reports the camera has a lower frame rate than we are actually streaming.  This would reduce wasted bandwidth.
// CONSIDER: Timeline control.  Simplified format at first.  Maybe show the current day, the last 24 hours, or the currently loaded time range.  Selecting a time will scroll the clip list (and begin playback of the most appropriate clip?)
// CONSIDER: Double-click in the clip player could perform some action, like play/pause or fullscreen mode.

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
			key: "ui3_enableHotkeys"
			, value: "1"
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
		if (typeof (Storage) !== "undefined")
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
	if (typeof (Storage) !== "undefined")
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
		BI_CustomEvent.Invoke("TabLoaded_" + currentPrimaryTab);
		resized();
	});
	BI_CustomEvent.AddListener("TabLoaded_live", function () { imageLoader.goLive(); });
	BI_CustomEvent.AddListener("TabLoaded_clips", function () { clipLoader.LoadClips("cliplist"); });
	BI_CustomEvent.AddListener("TabLoaded_alerts", function () { clipLoader.LoadClips("alertlist"); });

	uiSizeHelper = new UiSizeHelper();

	audioPlayer = new AudioPlayer();

	diskUsageGUI = new DiskUsageGUI();

	systemLog = new SystemLog();

	systemConfig = new SystemConfig();

	cameraProperties = new CameraProperties();

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

	imageQualityHelper = new ImageQualityHelper();

	SetupCollapsibleTriggers();

	playbackControls = new PlaybackControls();

	seekBar = new SeekBar();

	clipTimeline = new ClipTimeline();

	hotkeys = new BI_Hotkeys();

	dateFilter = new DateFilter("#dateRangeLabel");

	hlsPlayer = new HLSPlayer();

	jpegSuppressionDialog = new JpegSuppressionDialog();

	canvasContextMenu = new CanvasContextMenu();

	calendarContextMenu = new CalendarContextMenu();

	cameraConfig = new CameraConfig();

	imageLoader = new ImageLoader();

	imageRenderer = new ImageRenderer();

	statusLoader = new StatusLoader();

	sessionManager = new SessionManager();

	cameraListLoader = new CameraListLoader();

	clipLoader = new ClipLoader("#clipsbody");

	togglableContextMenus = new Array();
	for (var i = 0; i < togglableUIFeatures.length; i++)
		togglableContextMenus.push(new ContextMenu_EnableDisableItem(togglableUIFeatures[i][0], togglableUIFeatures[i][1], togglableUIFeatures[i][2], togglableUIFeatures[i][3], togglableUIFeatures[i][4], togglableUIFeatures[i][5]));

	// This makes it impossible to text-select or drag certain UI elements.
	makeUnselectable($("#layouttop, #layoutleft, #layoutdivider, #layoutbody"));

	sessionManager.Initialize();

	$(window).resize(resized);
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
					if ($ele.next().is(":visible"))
						$ele.removeClass("collapsed");
					else
						$ele.addClass("collapsed");
					if ($ele.hasClass("serverStatusLabel"))
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

	var topH = layouttop.height();
	var botH = layoutbottom.is(":visible") ? layoutbottom.height() : 0;
	var leftH = windowH - topH;
	var leftW = layoutleft.width();
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
				cameraListLoader.SelectCameraGroup(item.id);
			}
			, rebuildItems: function (data)
			{
				this.items = [];
				for (var i = 0; i < data.length; i++)
				{
					if (data[i].group)
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
			$ddl.css("min-width", ($ddl.width() + 1) + "px"); // Workaround for "System Configuration" wrapping bug

		var width = $ddl.outerWidth();
		var height = $ddl.outerHeight();
		var top = (offset.top + $ele.outerHeight());
		var left = offset.left;
		if (ele.extendLeft)
			left = (left + $ele.outerWidth()) - width;

		// Adjust box position so the box doesn't extend off the bottom, top, right, left, in that order.
		var windowH = $(window).height();
		if (top + height > windowH)
			top = windowH - height;
		if (top < 0)
			top = 0;
		var windowW = $(window).width();
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

	var ptzControlsEnabled = false; // TODO: Implement PTZ hotkeys.
	var $hoveredEle = null; // TODO: Implement clip navigation hotkeys.
	var $activeEle = null; // TODO: Throttle rapid clip changes to prevent heavy Blue Iris server load.

	var currentlyLoadedPtzThumbsCamId = "";

	var unsafePtzActionNeedsStopped = false;
	var currentPtz = "0";
	var currentPtzCamId = "";
	var unsafePtzActionQueued = null;
	var unsafePtzActionInProgress = false;

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
		self.SendOrQueuePtzCommand(imageLoader.currentlyLoadingImage.id, btn.ptzcmd, false);
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
			return visibleGraphicContainer.graphicObjects[buttonId];
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
	this.UpdatePtzControlDisplayState = function ()
	{
		var featureEnabled = GetUi3FeatureEnabled("ptzControls");
		LoadPtzPresetThumbs();
		if (imageLoader.currentlyLoadingImage.ptz)
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
		self.UpdatePtzControlDisplayState();
	}
	this.PresetSet = function (presetNumStr)
	{
		if (!ptzControlsEnabled)
			return;
		if (!imageLoader.currentlyLoadingImage.ptz)
			return;
		if (!sessionManager.IsAdministratorSession())
		{
			openLoginDialog();
			return;
		}
		var presetNum = parseInt(presetNumStr);
		AskYesNo('<div style="margin-bottom:20px;width:300px;">' + CleanUpGroupName(cameraListLoader.currentlyLoadingCamera.optionDisplay) + '<br/><br/>Set preset ' + presetNum
			+ ' now?</div>', function ()
			{
				PTZ_set_preset(presetNum);
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
		$ele.mouseenter(function (e)
		{
			if (!ptzControlsEnabled)
				return;
			var imgData = settings.getItem("ui2_preset_" + imageLoader.currentlyLoadingImage.id + "_" + ele.presetnum);
			if (imgData != null && imgData.length > 0)
			{
				var thumb = $("#presetBigThumb");
				if (thumb.length == 0)
				{
					$("body").append('<img id="presetBigThumb" alt="" />');
					thumb = $("#presetBigThumb");
				}
				thumb.attr("src", imgData);

				var thisOffset = $(this).parent().offset();
				thumb.css("left", thisOffset.left + "px");
				thumb.css("top", (thisOffset.top - thumb.height()) + "px");
				thumb.show();
			}
		});
		$ele.mouseleave(function (e)
		{
			var thumb = $("#presetBigThumb");
			thumb.hide();
		});
	});
	// Presets //
	var LoadPtzPresetThumbs = function ()
	{
		if (imageLoader.currentlyLoadingImage.ptz && GetUi3FeatureEnabled("ptzControls"))
		{
			if (currentlyLoadedPtzThumbsCamId != imageLoader.currentlyLoadingImage.id)
			{
				$ptzPresets.each(function (idx, ele)
				{
					var imgData = settings.getItem("ui2_preset_" + imageLoader.currentlyLoadingImage.id + "_" + ele.presetnum);
					if (imgData != null && imgData.length > 0)
					{
						$(ele).empty();
						var $thumb = $('<img src="" alt="' + ele.presetnum + '" title="Preset ' + ele.presetnum + '" class="presetThumb" />');
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
				currentlyLoadedPtzThumbsCamId = imageLoader.currentlyLoadingImage.id;
			}
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
		if (!imageLoader.currentlyLoadingImage.ptz)
		{
			toaster.Error("Current camera is not PTZ");
			return;
		}
		self.PTZ_async_noguarantee(imageLoader.currentlyLoadingImage.id, 100 + parseInt(presetNumber));
	}
	var PTZ_set_preset = function (presetNumber)
	{
		if (!ptzControlsEnabled)
			return;
		if (!imageLoader.currentlyLoadingImage.ptz)
		{
			toaster.Error("Current camera is not PTZ");
			return;
		}
		var cameraId = imageLoader.currentlyLoadingImage.id;
		var args = { cmd: "ptz", camera: cameraId, button: (100 + presetNumber), description: "Preset " + presetNumber };
		ExecJSON(args, function (response)
		{
			if (response && typeof response.result != "undefined" && response.result == "success")
			{
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
		if (cameraId != imageLoader.currentlyLoadingImage.id)
			return;

		var sizeArg = "&w=160";
		if (imageLoader.currentlyLoadingImage.aspectratio < 1)
			sizeArg = "&h=160";
		var tmpImgSrc = currentServer.remoteBaseURL + "image/" + imageLoader.currentlyLoadingImage.path + '?time=' + new Date().getTime() + sizeArg + "&q=50" + currentServer.GetRemoteSessionArg("&", true);
		PersistImageFromUrl("ui2_preset_" + cameraId + "_" + presetNumber, tmpImgSrc
			, function (imgAsDataURL)
			{
				LoadPtzPresetThumbs();
			}, function (message)
			{
				toaster.Error("Failed to save preset image. " + message, 10000);
			});
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
		var $btn = $("#clipDownloadButton");
		$btn.attr("href", currentServer.remoteBaseURL + "clips/" + clipData.path + currentServer.GetRemoteSessionArg("?"));
		var extensionIdx = clipData.path.indexOf(".");
		if (extensionIdx == -1)
			$btn.removeAttr("download");
		else
		{
			var date = GetDateStr(clipData.date);
			date = date.replace(/\//g, '-').replace(/:/g, '.');
			var fileName = clipData.camera + " " + date + clipData.path.substr(extensionIdx);

			$btn.attr("download", fileName);
		}
	}
	this.GetDownloadClipLink = function ()
	{
		return $("#clipDownloadButton").attr("href");
	}
	this.GetDownloadClipFileName = function ()
	{
		return $("#clipDownloadButton").attr("download");
	}
	$layoutbody.on("mouseleave", function (e)
	{
		mouseCoordFixer.fix(e);
		CloseSettings();
		if (imageLoader.currentlyLoadingImage.isLive || pointInsideElement($layoutbody, e.pageX, e.pageY))
			return;
		clearHideTimout();
		self.FadeOut();
	});
	$layoutbody.on("mouseenter mousemove touchstart touchmove touchend touchcancel", function (e)
	{
		if (imageLoader.currentlyLoadingImage.isLive)
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
			+ imageQualityHelper.GetQualityAbbr()
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
		self.drawSeekbarAtTime(imageLoader.GetClipPlaybackPosition());
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
		var msec = imageLoader.currentlyLoadingImage.msec;
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
			&& ((!touch && !isDragging && imageLoader.Playback_IsPaused()) || (touch && isDragging)))
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
			if (seekHintInfo.lastSnapshotId != "" && seekHintInfo.lastSnapshotId == imageLoader.staticSnapshotId)
				return; // No need to load same snapshot as before
			seekHintInfo.lastSnapshotId = imageLoader.staticSnapshotId;
			seekhint_img.attr('src', imageLoader.lastSnapshotUrl.replace(/time=\d+/, "time=" + msec) + "&w=160&q=50");
			seekhint_canvas.css('height', (160 / imageLoader.currentlyLoadingImage.aspectratio) + 'px');
		}
	}
	this.resetSeekHintImg = function ()
	{
		seekHintInfo.loadingMsec = seekHintInfo.queuedMsec = seekHintInfo.visibleMsec = -1;
		seekhint_canvas.css('height', (160 / imageLoader.currentlyLoadingImage.aspectratio) + 'px');
		imageRenderer.ClearCanvas("seekhint_canvas");
	}
	this.drawSeekbarAtTime = function (timeValue)
	{
		var msec = imageLoader.currentlyLoadingImage.msec;
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
		imageLoader.Playback_PlayPause();
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
			$("#camimg_canvas").css("opacity", "1");
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
				var msec = imageLoader.currentlyLoadingImage.msec;
				if (msec <= 1)
					imageLoader.SetClipPlaybackPosition(0);
				else
				{
					var positionRelative = x / barW;
					var posX = Clamp(parseInt(positionRelative * (msec - 1)), 0, msec - 1);
					imageLoader.SetClipPlaybackPosition(posX);
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
				$("#camimg_canvas").css("opacity", "0.5");
			SetBarState(1);

			if (thisTime < lastMouseDown.Time + doubleClickTime && mouseStillSinceLastClick(e))
				lastDoubleMouseDownStarted = lastMouseDown.Time;
			lastMouseDown.Time = thisTime;
			lastMouseDown.X = e.pageX;
			lastMouseDown.Y = e.pageY;
			mouseMoved(e);
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
	var clipListCache = new Object();
	var lastLoadedClipIds = new Array();
	var lastClickedClip = null;
	var isLoadingAClipList = false;
	var QueuedClipListLoad = null;
	var failedClipListLoads = 0;
	var TotalUniqueClipsLoaded = 0;
	var TotalDateTilesLoaded = 0;
	var lastUiSizeWasSmall; // Initialized at end of constructor
	var currentTopDate = new Date(0);
	var lastLoadedCameraFilter = "index";
	this.suppressClipListLoad = false;

	this.LoadClips = function (listName)
	{
		if (cameraListLoader.currentlyLoadingCamera)
			lastLoadedCameraFilter = cameraListLoader.currentlyLoadingCamera.optionValue;
		loadClipsInternal(listName, lastLoadedCameraFilter, dateFilter.BeginDate, dateFilter.EndDate, false);
	}
	var loadClipsInternal = function (listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad)
	{
		if ((currentPrimaryTab != "clips" && currentPrimaryTab != "alerts") || self.suppressClipListLoad)
		{
			QueuedClipListLoad = null;
			return;
		}
		if (!isContinuationOfPreviousLoad)
		{
			if (isLoadingAClipList)
			{
				QueuedClipListLoad = function ()
				{
					loadClipsInternal(listName, cameraId, myDateStart, myDateEnd);
				};
				return;
			}
			if (typeof (listName) == "undefined" || listName == null)
				listName = currentPrimaryTab == "clips" ? "cliplist" : "alertlist";

			tileLoader.AppearDisappearCheckEnabled = false;
			lastClickedClip = null;
			TotalUniqueClipsLoaded = 0;
			TotalDateTilesLoaded = 0;
			lastLoadedClipIds = new Array();

			$clipsbody.empty();
			$("#clipListTopDate").html("...");
			$clipsbody.html('<div class="clipListText">Loading...<br/><br/><span id="clipListDateRange"></span></div>');
			$.CustomScroll.callMeOnContainerResize();

			tileLoader.unregisterAllOnAppearDisappear();
			asyncThumbnailDownloader.Stop();

			isLoadingAClipList = true;
			//return;
		}

		var allowContinuation = false;
		var args = { cmd: listName, camera: cameraId };
		if (myDateStart != 0 && myDateEnd != 0)
		{
			allowContinuation = true;
			args.startdate = myDateStart;
			args.enddate = myDateEnd;
		}

		ExecJSON(args, function (response)
		{
			if (response.result != "success")
			{
				$clipsbody.html('<div class="clipListText">Failed to load!</div>');
				return;
			}
			failedClipListLoads = 0;
			var clipTileHeight = getClipTileHeight();
			if (typeof (response.data) != "undefined")
			{
				clipListCache = new Object();
				lastLoadedClipIds = new Array(response.data.length);
				var lastClipDate = new Date(0);
				for (var lastLoadedClipIds_idx = 0, i = 0; i < response.data.length; i++)
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

					var clip = response.data[i];
					var clipData = new Object();
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

					lastLoadedClipIds[lastLoadedClipIds_idx++] = clipData.clipId;
					if (!isSameDay(lastClipDate, clipData.date))
					{
						if (lastClipDate.getTime() == 0)
							$("#clipListTopDate").attr("defaultStr", GetDateDisplayStr(clipData.date)); // Do not add the first date tile because it is redundant with a date display above the list.
						else
						{
							tileLoader.registerOnAppearDisappear({ isDateTile: true, date: clipData.date }, DateTileOnAppear, DateTileOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
							TotalDateTilesLoaded++;
						}
					}
					lastClipDate = clipData.date;

					if (!clipListCache[clip.camera])
						clipListCache[clip.camera] = new Object();
					if (!clipListCache[clip.camera][clip.path]) // Only register if not already registered
					{
						tileLoader.registerOnAppearDisappear(clipData, ClipOnAppear, ClipOnDisappear, TileOnMove, clipTileHeight, HeightOfOneDateTilePx);
						TotalUniqueClipsLoaded++;
						clipListCache[clip.camera][clip.path] = clipData;
					}

				}
				if (!imageLoader.currentlyLoadingImage.isLive && self.GetCachedClip(imageLoader.currentlyLoadingImage.id, imageLoader.currentlyLoadingImage.path) == null)
					imageLoader.goLive();
				else
				{
					// TODO: If a clip is playing, make it get selected now in the list, but do not interfere with the playback state.
					// Probably scroll to the clip in the list, too.
				}
				// Trim the lastLoadedClipIds array in case we filtered something(s) out, such as snapshots.
				lastLoadedClipIds.length = lastLoadedClipIds_idx;

				if (QueuedClipListLoad != null)
				{
					isLoadingAClipList = false;
					QueuedClipListLoad();
					QueuedClipListLoad = null;
					return;
				}

				if (allowContinuation && response.data.length >= 1000)
				{
					myDateEnd = response.data[response.data.length - 1].date;
					$("#clipListDateRange").html("&nbsp;Remaining to load:<br/>&nbsp;&nbsp;&nbsp;" + parseInt((myDateEnd - myDateStart) / 86400) + " days");
					$.CustomScroll.callMeOnContainerResize();
					return loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, true);
				}
			}

			isLoadingAClipList = false;
			$clipsbody.empty();

			// Force clip list to be the correct height before clip tiles load.
			$clipsbody.append('<div id="clipListHeightSetter" style="height:' + ((clipTileHeight * TotalUniqueClipsLoaded) + (HeightOfOneDateTilePx * TotalDateTilesLoaded)) + 'px;width:0px;"></div>');

			asyncThumbnailDownloader = new AsyncThumbnailDownloader();
			tileLoader.AppearDisappearCheckEnabled = true;
			tileLoader.appearDisappearCheck();

			$.CustomScroll.callMeOnContainerResize();
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
						loadClipsInternal(listName, cameraId, myDateStart, myDateEnd, isContinuationOfPreviousLoad);
					}, 1000);
				}
				else
				{
					isLoadingAClipList = false;
					failedClipListLoads = 0;
				}
			});
	};
	this.resizeClipList = function ()
	{
		var currentUiSizeIsSmall = useSmallClipTileHeight();
		if ((lastUiSizeWasSmall && !currentUiSizeIsSmall) || (!lastUiSizeWasSmall && currentUiSizeIsSmall))
		{
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
		var $clip = $("#c" + clipData.clipId);
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
				+ '<div class="clipdesc"><div class="cliptime">' + timeStr + '</div><div class="clipcam">' + clipData.camera + '</div></div>'
				+ '</div>');

			var $img = $("#t" + clipData.clipId).get(0).thumbPath = clipData.thumbPath;

			$clip = $("#c" + clipData.clipId);
			$clip.click(ClipClicked);
			//$clip.hover(ClipTileHoverOver, ClipTileHoverOut);
			var clipEle = $clip.get(0).clipData = clipData;

			//TODO: registerClipListContextMenu($clip);

			if (self.ClipDataIndicatesFlagged(clipData))
				self.ShowClipFlag(clipData);
		}
		ThumbOnAppear($("#t" + clipData.clipId).get(0));
	}
	var ClipOnDisappear = function (clipData)
	{
		ThumbOnDisappear($("#t" + clipData.clipId).get(0));
		//$("#c" + clipData.clipId).remove(); // Removing the clip while a thumbnail loading "thread" might be working on it causes the thread to fail.
	}
	var ClipClicked = function ()
	{
		if (lastClickedClip)
			$(lastClickedClip).removeClass("selected");
		lastClickedClip = this;

		$(this).addClass("selected");

		cameraListLoader.LoadClipWithClipData(this.clipData);
	}
	this.UnselectAllClips = function ()
	{
		if (lastClickedClip)
		{
			$(lastClickedClip).removeClass("selected");
			lastClickedClip = null;
		}
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
			$("#clipListTopDate").html($("#clipListTopDate").attr("defaultStr"));
		}
		else if (!isSameDay(dateTileData.date, currentTopDate))
		{
			currentTopDate = dateTileData.date;
			$("#clipListTopDate").html(GetDateDisplayStr(dateTileData.date));
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
		if (lastClickedClip == null)
			return;
		// Find current flag state
		var clipData = lastClickedClip.clipData;
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
		});
	}
	this.HideClipFlag = function (clipData)
	{
		if (lastClickedClip.clipData == clipData)
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
		if (lastClickedClip != null && lastClickedClip.clipData == clipData)
			$("#clipFlagButton").addClass("flagged");
		var $clip = $("#c" + clipData.clipId);
		if ($clip.length == 0)
			return;
		$clip.append('<div class="clipFlagWrapper"><svg class="icon"><use xlink:href="#svg_x5F_Flag"></use></svg></div>');
	}
	this.ClipDataIndicatesFlagged = function (clipData)
	{
		return (clipData.flags & 2) > 0;
	}
	this.GetCurrentClipEle = function ()
	{
		return lastClickedClip;
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
		if (clipIdx != -1 && clipIdx + 1 < lastLoadedClipIds.length)
			return $("#c" + lastLoadedClipIds[clipIdx + 1]);
		return null;
	}
	this.GetClipAboveClip = function ($clip)
	{
		var clipIdx = GetClipIndexFromClipId(GetClipIdFromClip($clip));
		if (clipIdx > 0 && clipIdx - 1 < lastLoadedClipIds.length)
			return $("#c" + lastLoadedClipIds[clipIdx - 1]);
		return null;
	}
	var GetClipIndexFromClipId = function (clipId)
	{
		if (lastLoadedClipIds == null || lastLoadedClipIds.length == 0)
			return -1;
		for (var i = 0; i < lastLoadedClipIds.length; i++)
		{
			if (lastLoadedClipIds[i] == clipId)
				return i;
		}
		return -1;
	}
	// End of Helpers
	// Some things must be initialized after methods are defined ...
	lastUiSizeWasSmall = useSmallClipTileHeight();
	var tileLoader = new ClipListDynamicTileLoader(clipsBodySelector, DateTileOnBecomeCurrent);
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
		obj.isAppeared = false;
		obj.isDateTile = obj.isDateTile;
		obj.y = nextY;
		obj.h = obj.isDateTile ? HeightOfOneDateTilePx : HeightOfOneClipTilePx;
		nextY += obj.h;
		obj.callbackOnAppearFunc = callbackOnAppearFunc;
		obj.callbackOnDisappearFunc = callbackOnDisappearFunc;
		obj.callbackOnMoveFunc = callbackOnMoveFunc;
		appearDisappearRegisteredObjects.push(obj);
	}
	this.unregisterAllOnAppearDisappear = function ()
	{
		nextY = 0;
		appearDisappearRegisteredObjects = new Array();
		appearedObjects = new Array();
	}
	this.resizeClipList = function (HeightOfOneClipTilePx, HeightOfOneDateTilePx)
	{
		nextY = 0;
		var scrollTop = $clipsbody.scrollTop();
		var topmostVisibleElement = null;
		var scrollToAtEnd = -1;
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
		self.appearDisappearCheck();
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
		toaster.Info("Your profile has changed.<br/>Reinitializing shortly...", 5000);
		if (profileChangedTimeout != null)
		{
			clearTimeout(profileChangedTimeout);
			profileChangedTimeout = null;
		}
		profileChangedTimeout = setTimeout(function ()
		{
			cameraListLoader.firstCameraListLoaded = false;
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
	this.currentlyLoadingCamera = null;
	this.currentlyLoadedCamera = null;
	this.firstCameraListLoaded = false;
	var currentlySelectedHomeGroupId = null;
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
				if (self.firstCameraListLoaded)
					toaster.Error("Camera list is empty!");
				else
				{
					lastResponse = response;
					loadingHelper.SetErrorStatus("cameraList", "Camera list is empty! Try reloading the page.");
				}
				return;
			}
			lastResponse = response;
			dropdownBoxes.listDefs["currentGroup"].rebuildItems(response.data);
			var containsGroup = false;
			for (var i = 0; i < response.data.length; i++)
			{
				if (response.data[i].group)
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
			if (!self.firstCameraListLoaded || self.GetCameraWithId(self.currentlyLoadingCamera.optionValue) == null)
			{
				if (self.GetGroupCamera(settings.ui3_defaultCameraGroupId) == null)
					self.SelectCameraGroup(lastResponse.data[0].optionValue);
				else
					self.SelectCameraGroup(settings.ui3_defaultCameraGroupId);
			}
			if (!self.firstCameraListLoaded)
			{
				loadingHelper.SetLoadedStatus("cameraList");
				self.firstCameraListLoaded = true;
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
	this.ImgClick = function (event)
	{
		if (!imageLoader.currentlyLoadingImage.isLive || hasOnlyOneCamera)
			return;
		mouseCoordFixer.fix(event);
		var camData = self.GetCameraUnderMousePointer(event);
		if (camData != null)
		{
			self.ImgClick_Camera(camData);
		}
	}
	var viewChangeMode = 4;
	this.SetViewChangeMode = function (mode)
	{
		viewChangeMode = mode;
	}
	this.ImgClick_Camera = function (camData)
	{
		var fadeIn = viewChangeMode == 2 || viewChangeMode == 4 || viewChangeMode == 5;
		var scaleIn = viewChangeMode == 1 || viewChangeMode == 3 || viewChangeMode == 4 || viewChangeMode == 5;
		var fadeOut = viewChangeMode == 2 || viewChangeMode == 3 || viewChangeMode == 4 || viewChangeMode == 5;
		var scaleOut = viewChangeMode == 1 || viewChangeMode == 5;
		if (camData.optionValue == imageLoader.currentlyLoadedImage.id)
		{
			// Back to Group
			camData = self.GetGroupCamera(currentlySelectedHomeGroupId);
			if (scaleOut)
				imageRenderer.DrawCameraFullCameraAsThumb(imageLoader.currentlyLoadedImage.id, camData.optionValue);
			if (fadeOut)
				imageRenderer.DarkenFrameBy(127);
			self.LoadLiveCamera(camData);
			if (scaleOut)
				imageLoader.LoadingImageIsNowLoaded();
		}
		else
		{
			// Maximize
			// TODO: Consider making the instant image change optional
			if (scaleIn)
				imageRenderer.DrawCameraThumbAsFullCamera(camData.optionValue);
			if (fadeIn)
				imageRenderer.DarkenFrameBy(127);
			self.LoadLiveCamera(camData);
			if (scaleIn)
				imageLoader.LoadingImageIsNowLoaded();
		}
	}
	this.GetCameraUnderMousePointer = function (event)
	{
		// Find out which camera is under the mouse pointer, if any.
		imageRenderer.SetMousePos(event.pageX, event.pageY);

		var imgPos = $("#camimg_canvas").position();
		var layoutbodyOffset = $("#layoutbody").offset();
		var mouseRelX = parseFloat((event.pageX - layoutbodyOffset.left) - imgPos.left) / imageRenderer.GetPreviousImageDrawInfo().w;
		var mouseRelY = parseFloat((event.pageY - layoutbodyOffset.top) - imgPos.top) / imageRenderer.GetPreviousImageDrawInfo().h;

		var x = imageLoader.currentlyLoadedImage.fullwidth * mouseRelX;
		var y = imageLoader.currentlyLoadedImage.fullheight * mouseRelY;
		var camData = self.currentlyLoadedCamera;
		if (camData)
		{
			if (camData.group)
			{
				for (var j = 0; j < camData.rects.length; j++)
				{
					if (x > camData.rects[j][0] && y > camData.rects[j][1] && x < camData.rects[j][2] && y < camData.rects[j][3])
						return self.GetCameraWithId(camData.group[j]);
				}
			}
			else
				return camData;
		}
		return null;
	}
	this.GetCameraBoundsInCurrentGroupImageScaled = function (cameraId, groupId)
	{
		var coordScale = imageLoader.currentlyLoadedImage.actualwidth / imageLoader.currentlyLoadedImage.fullwidth;
		var unscaled = self.GetCameraBoundsInCurrentGroupImageUnscaled(cameraId, groupId);
		// The first line of the array definition must be on the same line as the return statement
		return [Math.round(unscaled[0] * coordScale)
			, Math.round(unscaled[1] * coordScale)
			, Math.round(unscaled[2] * coordScale)
			, Math.round(unscaled[3] * coordScale)];
	}
	this.GetCameraBoundsInCurrentGroupImageUnscaled = function (cameraId, groupId)
	{
		var camData = self.currentlyLoadedCamera;
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
		var camData = lastResponse.data;
		for (var i = 0; i < camData.length; i++)
		{
			if (cameraId == camData[i].optionValue)
				return camData[i];
		}
		return null;
	}
	this.GetCameraName = function (cameraId)
	{
		var camData = lastResponse.data;
		for (var i = 0; i < camData.length; i++)
		{
			if (cameraId == camData[i].optionValue)
				return camData[i].optionDisplay;
		}
		return cameraId;
	}
	this.LoadLiveCamera = function (camData)
	{
		self.currentlyLoadingCamera = camData;
		self.UpdateSelectedLiveCameraFields();
	}
	this.LoadClipWithClipData = function (clipData)
	{
		var camData = lastResponse.data;
		for (var i = 0; i < camData.length; i++)
		{
			if (clipData.camera == camData[i].optionValue)
			{
				self.currentlyLoadingCamera = camData[i];
				self.UpdateSelectedClipFields(clipData.path, clipData.msec);
				playbackControls.SetDownloadClipLink(clipData);
				if (clipLoader.ClipDataIndicatesFlagged(clipData))
					$("#clipFlagButton").addClass("flagged");
				else
					$("#clipFlagButton").removeClass("flagged");
				imageLoader.Playback_Play();
				seekBar.drawSeekbarAtTime(0);
				seekBar.resetSeekHintImg();
				break;
			}
		}
	}
	this.SelectCameraGroup = function (groupId)
	{
		dropdownBoxes.setLabelText("currentGroup", "...");
		for (var i = 0; i < lastResponse.data.length; i++)
		{
			if (lastResponse.data[i].optionValue == groupId)
			{
				if (self.CameraIsGroupOrCycle(lastResponse.data[i]))
				{
					settings.ui3_defaultCameraGroupId = currentlySelectedHomeGroupId = groupId;
					self.currentlyLoadingCamera = lastResponse.data[i];
					var groupName = CleanUpGroupName(self.currentlyLoadingCamera.optionDisplay);
					dropdownBoxes.setLabelText("currentGroup", groupName);

					self.UpdateSelectedLiveCameraFields();
					break;
				}
			}
		}
	}
	this.UpdateSelectedLiveCameraFields = function ()
	{
		imageRenderer.SetDigitalZoom(0);
		var cli = imageLoader.currentlyLoadingImage;
		var clc = self.currentlyLoadingCamera;
		cli.id = clc.optionValue;
		cli.fullwidth = cli.actualwidth = clc.width;
		cli.fullheight = cli.actualheight = clc.height;
		cli.aspectratio = clc.width / clc.height;
		cli.path = clc.optionValue;
		cli.isLive = true;
		cli.ptz = clc.ptz;
		cli.audio = clc.audio;
		cli.isGroup = clc.group ? true : false;
		imageLoader.lastLiveCameraOrGroupId = clc.optionValue;
		imageLoader.ResetClipPlaybackFields();
		playbackControls.Hide();
		ptzButtons.UpdatePtzControlDisplayState();

		audioPlayer.audioPlay();

		dropdownBoxes.setLabelText("currentGroup", CleanUpGroupName(clc.optionDisplay));
		if (imageLoader.hasStarted)
			imageLoader.GetNewImage();

		clipLoader.LoadClips(); // This method does nothing if not on the clips/alerts tabs.
	}
	this.UpdateSelectedClipFields = function (clipPath, msec)
	{
		imageRenderer.SetDigitalZoom(0);
		var cli = imageLoader.currentlyLoadingImage;
		var clc = self.currentlyLoadingCamera;
		cli.id = clc.optionValue;
		cli.fullwidth = cli.actualwidth = clc.width;
		cli.fullheight = cli.actualheight = clc.height;
		cli.aspectratio = clc.width / clc.height;
		cli.path = clipPath;
		cli.isLive = false;
		cli.ptz = false;
		cli.audio = false;
		cli.msec = parseInt(msec);
		cli.isGroup = false;
		imageLoader.ResetClipPlaybackFields();
		playbackControls.Show();
		audioPlayer.audioStop();
		if (imageLoader.hasStarted)
			imageLoader.GetNewImage();
	}
	this.GetGroupCamera = function (groupId)
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
	this.CameraIsGroupOrCamera = function (cameraObj)
	{
		return cameraObj.group || !cameraObj.optionValue.startsWith("@");
	}
	this.LoadHomeGroup = function (groupId)
	{
		if (typeof groupId == "undefined")
			groupId = currentlySelectedHomeGroupId;
		self.currentlyLoadingCamera = self.GetGroupCamera(groupId);
		self.UpdateSelectedLiveCameraFields();
	}
	this.GetCurrentHomeGroupObj = function ()
	{
		return self.GetGroupCamera(currentlySelectedHomeGroupId);
	}
}
///////////////////////////////////////////////////////////////
// Image Loading //////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ImageLoader()
{
	var self = this;
	this.hasStarted = false;
	var timeLastClipFrame = 0;
	var clipPlaybackPosition = 0;
	this.staticSnapshotId = "";
	this.lastSnapshotUrl = "";
	this.lastSnapshotFullUrl = "";
	this.currentImageDateMs = new Date().getTime();
	this.currentImageLoadedAtMs = new Date().getTime();
	var lastCycleWidth = 0;
	var lastCycleHeight = 0;
	var lastRequestedWidth = 0;
	var currentLoadedImageActualWidth = 1;
	var fpsZeroTimeout = null;

	var playbackPaused = false;

	this.currentlyLoadingImage = new BICameraData();
	this.currentlyLoadedImage = new BICameraData();
	this.isFirstCameraImageLoaded = false;
	var repeatedSameImageURLs = 1;

	this.lastLiveCameraOrGroupId = "";

	this.Start = function ()
	{
		self.hasStarted = true;
		imageRenderer.ImgResized(false);
		var camObj = $("#camimg");
		camObj.load(function ()
		{
			ClearImageLoadTimeout();
			if (!this.complete || typeof this.naturalWidth == "undefined" || this.naturalWidth == 0)
			{
				// Failed
			}
			else
			{
				self.currentlyLoadedImage.actualwidth = this.naturalWidth;
				self.currentlyLoadedImage.actualheight = this.naturalHeight;

				if (self.currentlyLoadingImage.id != self.currentlyLoadedImage.id || self.currentlyLoadingImage.path != self.currentlyLoadedImage.path)
				{
					// The loaded image has just changed to a different camera.
					if (!self.isFirstCameraImageLoaded)
					{
						self.isFirstCameraImageLoaded = true;
						imageRenderer.RegisterCamImgClickHandler();
					}
					if ($("#camimg").attr('loadingimg') == self.currentlyLoadingImage.id)
					{
						self.LoadingImageIsNowLoaded();
					}
				}
			}
			RefreshFps();

			if (self.currentlyLoadedImage.id.startsWith("@"))
			{
				if (lastCycleWidth != this.naturalWidth || lastCycleHeight != this.naturalHeight)
				{
					self.currentlyLoadedImage.fullwidth = this.naturalWidth;
					self.currentlyLoadedImage.fullheight = this.naturalHeight;
					self.currentlyLoadedImage.aspectratio = self.currentlyLoadedImage.fullwidth / self.currentlyLoadedImage.fullheight;
					resized();
				}
			}
			else
				lastCycleWidth = lastCycleHeight = 0;

			currentLoadedImageActualWidth = this.naturalWidth;

			imageRenderer.DrawToCanvas();
			self.GetNewImage();
		});
		camObj.error(function ()
		{
			ClearImageLoadTimeout();
			setTimeout(self.GetNewImage, 1000);
		});
		self.GetNewImage();
	}
	this.LoadingImageIsNowLoaded = function ()
	{
		imageRenderer.SetDigitalZoom(0);
		self.currentlyLoadedImage.CopyValuesFrom(self.currentlyLoadingImage);

		cameraListLoader.currentlyLoadedCamera = cameraListLoader.currentlyLoadingCamera;

		resized();
	}
	this.GetNewImage = function ()
	{
		ClearGetNewImageTimeout();
		if (currentServer.isLoggingOut)
			return;
		sessionManager.ApplyLatestAPISessionIfNecessary();
		var timeValue = self.currentImageDateMs = self.currentImageLoadedAtMs = new Date().getTime();
		var isLoadingRecordedSnapshot = false;
		if (!self.currentlyLoadingImage.isLive)
		{
			var timePassed = timeValue - timeLastClipFrame;
			timeLastClipFrame = timeValue;
			var speedMultiplier = playbackControls.GetPlaybackSpeed()
			timePassed *= speedMultiplier;
			if (playbackPaused || seekBar.IsDragging())
				timePassed = 0;
			else if (playbackControls.GetPlayReverse())
				timePassed *= -1;
			clipPlaybackPosition += timePassed;

			if (clipPlaybackPosition < 0)
			{
				clipPlaybackPosition = 0;
				if (playbackControls.GetPlayReverse())
				{
					if (playbackControls.GetLoopingEnabled())
						clipPlaybackPosition = self.currentlyLoadingImage.msec - 1;
					else if (playbackControls.GetAutoplay())
					{
						self.Playback_Pause();
						self.Playback_PreviousClip();
					}
					else
						self.Playback_Pause();
					if (clipPlaybackPosition < 0)
						clipPlaybackPosition = 0;
				}
			}
			else if (clipPlaybackPosition >= self.currentlyLoadingImage.msec)
			{
				clipPlaybackPosition = self.currentlyLoadingImage.msec - 1;
				if (!playbackControls.GetPlayReverse())
				{
					if (playbackControls.GetLoopingEnabled())
						clipPlaybackPosition = 0;
					else if (playbackControls.GetAutoplay())
					{
						self.Playback_Pause();
						self.Playback_NextClip();
					}
					else
						self.Playback_Pause();
					if (clipPlaybackPosition < 0)
						clipPlaybackPosition = 0;
				}
			}
			timeValue = clipPlaybackPosition;
			// Update currentImageDateMs so that saved snapshots know the time for file naming
			var clipData = clipLoader.GetCachedClip(self.currentlyLoadingImage.id, self.currentlyLoadingImage.path);
			if (clipData != null)
			{
				self.currentImageDateMs = clipData.date.getTime() + clipPlaybackPosition;
				isLoadingRecordedSnapshot = clipData.isSnapshot;
				if (isLoadingRecordedSnapshot)
					self.staticSnapshotId = self.currentlyLoadingImage.path;
				else
					self.staticSnapshotId = "";
			}
		}

		var widthToRequest = imageRenderer.GetWidthToRequest();
		$("#camimg").attr('loadingimg', self.currentlyLoadingImage.id);

		var qualityArg = imageQualityHelper.getQualityArg();

		if (self.currentlyLoadingImage.isLive)
			self.lastSnapshotUrl = currentServer.remoteBaseURL + "image/" + self.currentlyLoadingImage.path + '?time=' + timeValue + currentServer.GetRemoteSessionArg("&", true);
		else
			self.lastSnapshotUrl = currentServer.remoteBaseURL + "file/clips/" + self.currentlyLoadingImage.path + '?time=' + timeValue + currentServer.GetRemoteSessionArg("&", true);
		var imgSrcPath = self.lastSnapshotFullUrl = self.lastSnapshotUrl + "&w=" + widthToRequest + qualityArg;

		if ($("#camimg").attr('src') == imgSrcPath)
			GetNewImageAfterTimeout();
		else
		{
			if (!self.currentlyLoadingImage.isLive)
				seekBar.drawSeekbarAtTime(timeValue);

			if ((isLoadingRecordedSnapshot
				&& self.currentlyLoadingImage.path == self.currentlyLoadedImage.path
				&& !CouldBenefitFromWidthChange(widthToRequest))
				|| hlsPlayer.IsBlockingJpegRefresh()
				|| jpegSuppressionDialog.IsOpen()
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
	var RefreshFps = function ()
	{
		var currentFps = fpsCounter.getFPS(new Date().getTime() - self.currentImageLoadedAtMs);
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
	var CouldBenefitFromWidthChange = function (newWidth)
	{
		return newWidth > lastRequestedWidth && currentLoadedImageActualWidth >= lastRequestedWidth;
	}
	this.ResetClipPlaybackFields = function ()
	{
		timeLastClipFrame = new Date().getTime();
		clipPlaybackPosition = 0;
	}
	this.SetClipPlaybackPosition = function (pos)
	{
		timeLastClipFrame = new Date().getTime();
		clipPlaybackPosition = pos;
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
			if (clipPlaybackPosition >= self.currentlyLoadingImage.msec - 1 && !playbackControls.GetPlayReverse())
				clipPlaybackPosition = 0;
			else if (clipPlaybackPosition <= 0 && playbackControls.GetPlayReverse())
				clipPlaybackPosition = self.currentlyLoadingImage.msec - 1;
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
	this.Playback_Skip = function (amountMs)
	{
		clipPlaybackPosition += amountMs;
	}
	this.Playback_NextClip = function ()
	{
		var clip = clipLoader.GetCurrentClipEle();
		if (clip == null)
			return;
		var $clip = clipLoader.GetClipAboveClip($(clip));
		Playback_ClipObj($clip);
	}
	this.Playback_PreviousClip = function ()
	{
		var clip = clipLoader.GetCurrentClipEle();
		if (clip == null)
			return;
		var $clip = clipLoader.GetClipBelowClip($(clip));
		Playback_ClipObj($clip);
	}
	var Playback_ClipObj = function ($clip)
	{
		if ($clip != null && $clip.length > 0)
		{
			var offset = ($("#clipsbody").height() / 2) - ($clip.height() / 2);
			$("#clipsbody").scrollTop(($("#clipsbody").scrollTop() + $clip.position().top) - offset);
			$clip.click();
		}
	}
	this.GetClipPlaybackPosition = function ()
	{
		return clipPlaybackPosition;
	}
	this.goLive = function ()
	{
		if (self.currentlyLoadingImage == null || self.currentlyLoadingImage.isLive)
			return;
		var camData = cameraListLoader.GetCameraWithId(self.lastLiveCameraOrGroupId);
		if (camData)
		{
			clipLoader.suppressClipListLoad = true;
			cameraListLoader.LoadLiveCamera(camData);
			clipLoader.suppressClipListLoad = false;
		}
		else
		{
			cameraListLoader.LoadHomeGroup();
		}
	}
	var imgLoadTimeout = null;
	var SetImageLoadTimeout = function ()
	{
		ClearImageLoadTimeout();
		imgLoadTimeout = setTimeout(function ()
		{
			bilog.debug("Image load timed out");
			self.GetNewImage();
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
		getNewImageTimeout = setTimeout(self.GetNewImage, Math.min(500, 25 + 2 * repeatedSameImageURLs++));
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
function BICameraData()
{
	var self = this;
	this.id = "";
	this.fullwidth = 1280;
	this.fullheight = 720;
	this.aspectratio = 1280 / 720;
	this.actualwidth = 1280;
	this.actualheight = 720;
	this.path = "";
	this.isLive = true;
	this.ptz = false;
	this.msec = 10000;
	this.isGroup = false;

	this.CopyValuesFrom = function (other)
	{
		self.id = other.id;
		self.fullwidth = other.fullwidth;
		self.fullheight = other.fullheight;
		self.aspectratio = other.aspectratio;
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
// Image Quality Helper ///////////////////////////////////////
///////////////////////////////////////////////////////////////
function ImageQualityHelper()
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
//qualityArg = "&q=" + 20;
//widthToRequest = parseInt(widthToRequest * 0.5);
///////////////////////////////////////////////////////////////
// Image Renderer /////////////////////////////////////////////
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

	this.GetWidthToRequest = function ()
	{
		// Calculate the size of the image we need
		var ciLoading = imageLoader.currentlyLoadingImage;
		var imgDrawWidth = ciLoading.fullwidth * dpiScalingFactor * (zoomTable[digitalZoom]);
		var imgDrawHeight = ciLoading.fullheight * dpiScalingFactor * (zoomTable[digitalZoom]);
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
			imgDrawHeight = imageQualityHelper.ModifyImageDimension(imgDrawHeight);
			imgDrawWidth = imgDrawHeight * ciLoading.aspectratio;
		}
		else
		{
			imgDrawWidth = imageQualityHelper.ModifyImageDimension(imgDrawWidth);
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
	this.DrawToCanvas = function ()
	{
		self.CopyImageToCanvas("camimg", "camimg_canvas");
	}
	this.CopyImageToCanvas = function (imgId, canvasId)
	{
		var camimg = $("#" + imgId).get(0);
		var canvas = $("#" + canvasId).get(0);
		if (canvas.width != camimg.naturalWidth)
			canvas.width = camimg.naturalWidth;
		if (canvas.height != camimg.naturalHeight)
			canvas.height = camimg.naturalHeight;

		var context2d = canvas.getContext("2d");
		context2d.drawImage(camimg, 0, 0);
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

		canvas.width = backbuffer_canvas.width;
		canvas.height = backbuffer_canvas.height;
		var context2d = canvas.getContext("2d");
		context2d.drawImage(backbuffer_canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
	}
	this.DarkenFrameBy = function (amount)
	{
		var canvas = $("#camimg_canvas").get(0);
		var context2d = canvas.getContext("2d");
		var imgData = context2d.getImageData(0, 0, canvas.width, canvas.height);
		var rgba = imgData.data;
		for (var i = 3; i < rgba.length; i += 4)
			rgba[i] = amount;
		context2d.putImageData(imgData, 0, 0);
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
		var imgForSizing = imageLoader.isFirstCameraImageLoaded ? imageLoader.currentlyLoadedImage : imageLoader.currentlyLoadingImage;

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
		$("#camimg_canvas").css("width", imgDrawWidth + "px").css("height", imgDrawHeight + "px");

		imageIsLargerThanAvailableSpace = imgDrawWidth > imgAvailableWidth || imgDrawHeight > imgAvailableHeight;

		if (previousImageDraw.z > -1 && previousImageDraw.z != digitalZoom)
		{
			// We just experienced a zoom change
			// Find the mouse position percentage relative to the center of the image at its old size
			var imgPos = $("#camimg_canvas").position();
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

		$("#camimg_canvas").css("left", proposedX + "px").css("top", proposedY + "px");

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
			xPos = layoutbodyOffset.left + ($("#layoutbody").outerWidth(true));
			yPos = layoutbodyOffset.top + ($("#layoutbody").outerHeight(true));
		}
		$("#zoomhint").css("left", (xPos - $("#zoomhint").outerWidth(true)) + "px").css("top", (yPos - $("#zoomhint").outerHeight(true)) + "px");
	}
	var SetCamCellCursor = function ()
	{
		var outerObjs = $('#layoutbody,#camimg_canvas,#zoomhint');
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
			var innerObjs = $('#camimg_canvas,#zoomhint');
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
					cameraListLoader.ImgClick(e);
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
// Video Canvas Context Menu //////////////////////////////////
///////////////////////////////////////////////////////////////
function CanvasContextMenu()
{
	var lastLiveContextMenuSelectedCamera = null;
	var lastRecordContextMenuSelectedClip = null;
	var self = this;

	var onShowLiveContextMenu = function (menu)
	{
		if (lastLiveContextMenuSelectedCamera == null || cameraListLoader.CameraIsGroupOrCycle(lastLiveContextMenuSelectedCamera))
		{
			menu.applyrule(
				{
					name: "disable_camera_buttons",
					disable: true,
					items: ["cameraname", "trigger", "record", "snapshot", "maximize", "restart", "properties"]
				});
		}
		else
		{
			menu.applyrule(
				{
					name: "disable_cameraname",
					disable: true,
					items: ["cameraname"]
				});
		}
	}
	var onTriggerLiveContextMenu = function (e)
	{
		var downloadButton = $("#cmroot_liveview_downloadbutton_findme").parents(".b-m-item");
		if (downloadButton.parent().attr("id") == "cmroot_liveview_downloadlink")
			downloadButton.parent().attr("href", imageLoader.lastSnapshotUrl);
		else
			downloadButton.wrap('<a id="cmroot_liveview_downloadlink" style="display:block" href="'
				+ imageLoader.lastSnapshotUrl
				+ '" onclick="saveSnapshot(&quot;#cmroot_liveview_downloadlink&quot;)" target="_blank"></a>');
		$("#cmroot_liveview_downloadlink").attr("download", "temp.jpg");
		if (imageLoader.currentlyLoadingImage.isLive)
		{
			imageRenderer.CamImgClickStateReset();
			var homeGroupObj = null;
			var camData = cameraListLoader.GetCameraUnderMousePointer(e);
			if (camData == null)
				camData = homeGroupObj = cameraListLoader.GetCurrentHomeGroupObj();
			lastLiveContextMenuSelectedCamera = camData;
			if (camData != null)
			{
				LoadDynamicManualRecordingButtonState(camData);
				$("#contextMenuCameraName").text(CleanUpGroupName(camData.optionDisplay));
				$("#contextMenuCameraName").closest("div.b-m-item,div.b-m-idisable").attr("title", "The buttons in this menu are specific to the camera: " + camData.optionDisplay);
				var $maximize = $("#contextMenuMaximize");
				var isMaxAlready = (camData.optionValue == imageLoader.currentlyLoadedImage.id && homeGroupObj == null);
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
					cameraListLoader.ImgClick_Camera(lastLiveContextMenuSelectedCamera);
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
				hlsPlayer.OpenDialog(imageLoader.currentlyLoadingImage.id);
				break;
			case "opennewtab":
				jpegSuppressionDialog.Open();
				window.open(imageLoader.lastSnapshotFullUrl);
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
				cameraListLoader.SetViewChangeMode(0);
				break;
			case "viewChangeMode_Scale":
				cameraListLoader.SetViewChangeMode(1);
				break;
			case "viewChangeMode_Fade":
				cameraListLoader.SetViewChangeMode(2);
				break;
			case "viewChangeMode_ScaleInFadeOut":
				cameraListLoader.SetViewChangeMode(3);
				break;
			case "viewChangeMode_FadeScaleInFadeOut":
				cameraListLoader.SetViewChangeMode(4);
				break;
			case "viewChangeMode_FadeScale":
				cameraListLoader.SetViewChangeMode(5);
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
				{ text: "<span id=\"contextMenuCameraName\">Camera Name</span>", icon: "", alias: "cameraname" }
				, { type: "splitLine" }
				, { text: "Open image in new tab", icon: "#svg_mio_Tab", iconClass: "noflip", alias: "opennewtab", action: onLiveContextMenuAction }
				, { text: '<div id="cmroot_liveview_downloadbutton_findme" style="display:none"></div>Save image to disk', icon: "#svg_x5F_Snapshot", alias: "saveas", action: onLiveContextMenuAction }
				, { text: "Open HLS Stream", icon: "#svg_mio_ViewStream", iconClass: "noflip", alias: "openhls", tooltip: "Opens a live H.264 stream in an efficient, cross-platform player. This method delays the stream by several seconds.", action: onLiveContextMenuAction }
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
		var downloadButton = $("#cmroot_recordview_downloadbutton_findme").parents(".b-m-item");
		if (downloadButton.parent().attr("id") == "cmroot_recordview_downloadlink")
			downloadButton.parent().attr("href", imageLoader.lastSnapshotUrl);
		else
			downloadButton.wrap('<a id="cmroot_recordview_downloadlink" style="display:block" href="'
				+ imageLoader.lastSnapshotUrl
				+ '" onclick="saveSnapshot(&quot;#cmroot_recordview_downloadlink&quot;)" target="_blank"></a>');
		$("#cmroot_recordview_downloadlink").attr("download", "temp.jpg");

		var downloadClipButton = $("#cmroot_recordview_downloadclipbutton_findme").parents(".b-m-item");
		if (downloadClipButton.parent().attr("id") == "cmroot_recordview_downloadcliplink")
			downloadClipButton.parent().attr("href", playbackControls.GetDownloadClipLink());
		else
			downloadClipButton.wrap('<a id="cmroot_recordview_downloadcliplink" style="display:block" href="'
				+ playbackControls.GetDownloadClipLink()
				+ '" target="_blank"></a>');
		$("#cmroot_recordview_downloadcliplink").attr("download", playbackControls.GetDownloadClipFileName());

		if (!imageLoader.currentlyLoadingImage.isLive)
		{
			imageRenderer.CamImgClickStateReset();
			lastRecordContextMenuSelectedClip = clipLoader.GetCachedClip(imageLoader.currentlyLoadingImage.id, imageLoader.currentlyLoadingImage.path);
			if (lastRecordContextMenuSelectedClip != null)
			{
				//console.log(lastRecordContextMenuSelectedClip);
				// TODO: use this clip information to load the properties.
			}
			$("#contextMenuClipName").text(playbackControls.GetDownloadClipFileName());
			return true;
		}
		return false;
	}
	var onRecordContextMenuAction = function ()
	{
		switch (this.data.alias)
		{
			//case "properties":
			//	break;
			case "opennewtab":
				imageLoader.Playback_Pause();
				window.open(imageLoader.lastSnapshotFullUrl);
				break;
			case "saveas":
				return true;
			case "downloadclip":
				return true;
			case "closeclip":
				imageLoader.goLive();
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
				, { text: '<div id="cmroot_recordview_downloadclipbutton_findme" style="display: none"></div>Download clip', icon: "#svg_x5F_Download", alias: "downloadclip", action: onRecordContextMenuAction }
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
function ContextMenu_EnableDisableItem(selector, uniqueSettingsId, itemName, onToggle, extraMenuButtons, shouldDisableToggler)
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
			label.html("Disable");
		else
			label.html("Enable");
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
	var menuItemArray = [{ text: '<span id="cmToggleLabel_' + uniqueSettingsId + '">Toggle</span> ' + itemName, icon: "", alias: "toggle", action: onContextMenuAction }];
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
// Camera Properties Dialog ///////////////////////////////////
///////////////////////////////////////////////////////////////
function CameraProperties()
{
	var self = this;
	var modal_cameraPropDialog = null;
	var modal_cameraPropRawDialog = null;
	this.open = function (camId)
	{
		CloseCameraProperties();

		var camName = cameraListLoader.GetCameraName(camId);
		modal_cameraPropDialog = $('<div id="campropdialog"><div class="campropheader">'
			+ '<div class="camproptitle">' + htmlEncode(camName)
			+ ' Properties <div id="camprop_refresh_btn" class="rotating_refresh_btn noflip"><svg class="icon"><use xlink:href="#svg_mio_Refresh"></use></svg></div></div>'
			+ '</div>'
			+ '<div id="campropcontent"><div style="text-align: center">Loading...</div></div>'
			+ '</div>'
		).modal({
			removeElementOnClose: true
			, maxWidth: 500
			, onClosing: function ()
			{
				if ($("#cameralistcontent").length != 0)
					ShowCameraList();
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
				$motionSection.append(GetCamPropCheckbox("setmotion.objects|" + camId, "Object detection", response.data.setmotion.objects, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.usemask|" + camId, "Mask/hotspot", response.data.setmotion.usemask, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.luminance|" + camId, "Black &amp; white", response.data.setmotion.luminance, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.shadows|" + camId, "Cancel shadows", response.data.setmotion.shadows, camPropOnOffBtnClick));
				$motionSection.append(GetCamPropCheckbox("setmotion.audio_trigger|" + camId, "Audio trigger enabled", response.data.setmotion.audio_trigger, camPropOnOffBtnClick));
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

				var cam = cameraListLoader.GetCameraWithId(camId);
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
		//toaster.Info("Pretending to set " + settingName + " = " + $btn.hasClass("on") + " for camera " + camId);
		cameraConfig.set(camId, settingName, buttonStateIsOn);
	}
	this.camPropSelectChange = function (select)
	{
		var mysetting = $(select).attr("mysetting");
		var parts = mysetting.split('|');
		var settingName = parts[0];
		var camId = parts[1];
		var selectedValue = parseInt(select.value);
		//toaster.Info("Pretending to set " + settingName + " = " + selectedValue + " for camera " + camId);
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
		var camName = cameraListLoader.GetCameraName(camId);
		cameraConfig.get(camId, function (response)
		{
			modal_cameraPropDialog = $('<div id="campropdialog"><div class="campropheader">'
				+ '<div>' + htmlEncode(camName)
				+ ' Raw Properties</div>'
				+ '</div>'
				+ '<div class="selectable" style="word-wrap: break-word; border:1px solid #000000; background-color: #FFFFFF; color: #000000; margin: 10px; padding: 10px;">'
				+ JSON.stringify(response)
				+ '</div>'
				+ '</div>'
			).modal({ removeElementOnClose: true, maxWidth: 600, maxHeight: 500 });
		}, function ()
			{
				toaster.Warning("Unable to load camera properties for " + camName);
			});
	}
}
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
		if (!imageLoader)
			return;
		if (!imageLoader.currentlyLoadingImage.audio || self.GetVolume() == 0)
		{
			self.audioStop();
			return;
		}
		if (currentServer.isLoggingOut)
			return;
		var newSrc = currentServer.remoteBaseURL + "audio/" + imageLoader.currentlyLoadingImage.id + "/temp.wav" + currentServer.GetRemoteSessionArg("?", true);
		if ($audiosourceobj.attr("src") != newSrc)
		{
			$audiosourceobj.attr("src", newSrc);
			audioobj.load();
			audioobj.play().catch(function (e) { });
		}
	}
	this.audioStop = function ()
	{
		if (!imageLoader)
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
	var camId = imageLoader.currentlyLoadingImage.id;
	if (camId.startsWith("@") || camId.startsWith("+"))
		camId = camId.substr(1);
	var date = GetDateStr(new Date(imageLoader.currentImageDateMs), true);
	date = date.replace(/\//g, '-').replace(/:/g, '.');
	var fileName = camId + " " + date + ".jpg";
	$(btnSelector).attr("download", fileName);
	$(btnSelector).attr("href", imageLoader.lastSnapshotUrl);
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
				jpegSuppressionDialog.Open();
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
// Jpeg Refresh Suppression Dialog ////////////////////////////
///////////////////////////////////////////////////////////////
function JpegSuppressionDialog()
{
	var self = this;
	var dialog = null;

	this.Open = function ()
	{
		self.Close();
		dialog = $('<div class="jpegSuppressionDialog" onclick="jpegSuppressionDialog.Close();">'
			+ 'To save bandwidth, video is paused until you close this dialog.'
			+ '<br/><div style="width:50px;height:50px;display:inline-block;text-align:center;margin:30px 0px 0px 65px;">'
			+ '<svg class="icon"><use xlink:href="#svg_x5F_Play"></use></svg>'
			+ '</div></div>').modal(
			{
				removeElementOnClose: true
				, onClosing: function ()
				{
					dialog = null;
				}
				, maxWidth: 200
				, maxHeight: 200
			});
	}
	this.IsOpen = function ()
	{
		return dialog != null;
	}
	this.Close = function ()
	{
		if (dialog != null)
			if (dialog.close())
				dialog = null;
	}
}
//////////////////////////////////////////////////////////////////////
// Hotkeys ///////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
function BI_Hotkeys()
{
	var self = this;
	var currentlyDownKeys = {};
	$(document).keydown(function (e)
	{
		var charCode = e.which ? e.which : event.keyCode;
		if (currentlyDownKeys[charCode])
			return;
		currentlyDownKeys[charCode] = true;
		return; // TODO: Implement hotkeys.
		var retVal = true;
		if (settings.ui3_enableHotkeys == "1" && $(".ui2modal").length == 0)
		{
			for (var i = 0; i < self.hotkeyDefs.length; i++)
			{
				var s = self.hotkeyDefs[i];
				if (typeof s.actionDown == "function")
				{
					var parts = settings[s.key].split("|");
					if (parts.length == 5)
					{
						if ((e.ctrlKey ? "1" : "0") == parts[0]
							&& (e.altKey ? "1" : "0") == parts[1]
							&& (e.shiftKey ? "1" : "0") == parts[2]
							&& (charCode == parts[3]))
						{
							s.hotkeyAction();
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
		var charCode = e.which ? e.which : event.keyCode;
		currentlyDownKeys[charCode] = false;
		return;
		var retVal = true;
		if (settings.ui3_enableHotkeys == "1" && $(".ui2modal").length == 0)
		{
			for (var i = 0; i < self.hotkeyDefs.length; i++)
			{
				var s = self.hotkeyDefs[i];
				if (typeof s.actionUp == "function")
				{
					var parts = settings[s.key].split("|");
					if (parts.length == 5)
					{
						var charCode = e.which ? e.which : event.keyCode
						if (charCode == parts[3])
						{
							s.hotkeyUpAction();
							retVal = false;
						}
					}
				}
			}
		}
		if (!retVal)
			return retVal;
	});
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

		toastr[type](message, null, overrideOptions);

		bilog.info(type + " toast: " + message);
	}
	this.Success = function (message, showTime, closeButton)
	{
		showToastInternal('success', message, showTime, closeButton);
	}
	this.Info = function (message, showTime, closeButton)
	{
		showToastInternal('info', message, showTime, closeButton);
	}
	this.Warning = function (message, showTime, closeButton)
	{
		showToastInternal('warning', message, showTime, closeButton);
	}
	this.Error = function (message, showTime, closeButton)
	{
		showToastInternal('error', message, showTime, closeButton);
	}
}
function showSuccessToast(message, showTime, closeButton)
{
	toaster.Success(message, showTime, closeButton);
}
function showInfoToast(message, showTime, closeButton)
{
	toaster.Info(message, showTime, closeButton);
}
function showWarningToast(message, showTime, closeButton)
{
	toaster.Warning(message, showTime, closeButton);
}
function showErrorToast(message, showTime, closeButton)
{
	toaster.Error(message, showTime, closeButton);
}
///////////////////////////////////////////////////////////////
// JSON ///////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
function ExecJSON(args, callbackSuccess, callbackFail, synchronous)
{
	if (currentServer.isLoggingOut && args.cmd != "logout")
		return;
	BI_CustomEvent.Invoke("BeforeExecJSON", args);
	sessionManager.ApplyLatestAPISessionIfNecessary();
	var isLogin = args.cmd == "login";
	var oldSession = $.cookie("session");
	if (typeof args.session == "undefined" && !isLogin)
	{
		args.session = oldSession;
	}
	$.ajax({
		type: 'POST',
		url: currentServer.remoteBaseURL + "json",
		contentType: "text/plain",
		data: JSON.stringify(args),
		dataType: "json",
		async: !synchronous,
		success: function (data)
		{
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
		remoteBaseURL: "/"
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
		Invoke: function (eventName, args)
		{
			if (typeof this.customEventRegistry[eventName] != "undefined")
				for (var i = 0; i < this.customEventRegistry[eventName].length; i++)
					this.customEventRegistry[eventName][i](args);
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
		imageLoader.Start();
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
			// TODO: Implement this. SendToServerListOnStartup();
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
function AskYesNo(question, onYes, onNo)
{
	var $dialog = $('<div></div>');
	$dialog.css("text-align", "center");
	$dialog.css("margin", "10px");
	$dialog.addClass("inlineblock");
	if (typeof question == "string")
		$dialog.append("<div>" + question + "</div>");
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
	return this.indexOf(prefix) === 0;
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
function toggleFullScreen()
{
	if (!isFullScreen())
		requestFullScreen();
	else
		exitFullScreen();
}
function isFullScreen()
{
	return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
}
function requestFullScreen()
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
function exitFullScreen()
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
			if (typeof e.pageX == "undefined")
			{
				if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 0)
				{
					mouseCoordFixer.last.x = e.pageX = e.originalEvent.touches[0].pageX;
					mouseCoordFixer.last.y = e.pageY = e.originalEvent.touches[0].pageY;
				}
				else
				{
					e.pageX = mouseCoordFixer.last.x;
					e.pageY = mouseCoordFixer.last.y;
				}
			}
			else
			{
				mouseCoordFixer.last.x = e.pageX;
				mouseCoordFixer.last.y = e.pageY;
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