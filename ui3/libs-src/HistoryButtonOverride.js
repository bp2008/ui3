﻿/*
	HistoryButtonOverride.js
	by bp2008
	The HistoryButtonOverride code is released to the public domain.
	IMPORTANT: Safari on mac will not raise the window.load event if you create an instance of this object before window.load is raised.
*/
function HistoryButtonOverride(BackButtonPressed, ForwardButtonPressed)
{
	var activated = false;
	var Reset = function ()
	{
		if (history.state === null)
			return;
		if (history.state.customHistoryStage === 1)
			history.forward();
		else if (history.state.customHistoryStage === 3)
			history.back();
	};
	function hboPopState()
	{
		// Called when history navigation occurs.
		if (history.state === null || !activated)
			return;
		if (history.state.customHistoryStage === 1)
		{
			if (typeof BackButtonPressed === "function" && BackButtonPressed())
			{
				Reset();
				return;
			}
			if (history.state.initialHistoryLength > 1)
				history.back(); // There is back-history to go to.
			else
				history.forward(); // No back-history to go to, so undo the back operation.
		}
		else if (history.state.customHistoryStage === 3)
		{
			if (typeof ForwardButtonPressed === "function" && ForwardButtonPressed())
			{
				Reset();
				return;
			}
			if (history.length > history.state.initialHistoryLength + 2)
				history.forward(); // There is forward-history to go to.
			else
				history.back(); // No forward-history to go to, so undo the forward operation.
		}
	}
	$(window).on("popstate", hboPopState);
	if (history.state === null)
	{
		// This is the first page load. Inject new history states to help identify back/forward button presses.
		var initialHistoryLength = history.length;
		history.replaceState({ customHistoryStage: 1, initialHistoryLength: initialHistoryLength }, "", location.href);
		history.pushState({ customHistoryStage: 2, initialHistoryLength: initialHistoryLength }, "", location.href);
		if (typeof ForwardButtonPressed === "function")
		{
			history.pushState({ customHistoryStage: 3, initialHistoryLength: initialHistoryLength }, "", location.href);
			history.back();
		}
	}
	else if (history.state.customHistoryStage === 1)
		history.forward();
	else if (history.state.customHistoryStage === 3)
		history.back();

	this.Destroy = function ()
	{
		activated = false;
		$(window).off("popstate", hboPopState);
		history.back();
	}

	activated = true;
}