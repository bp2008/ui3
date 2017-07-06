/*
	HistoryButtonOverride.js
	by bp2008
	The HistoryButtonOverride code is released to the public domain.
*/
function HistoryButtonOverride(BackButtonPressed, ForwardButtonPressed)
{
	var Reset = function ()
	{
		if (history.state == null)
			return;
		if (history.state.customHistoryStage == 1)
			history.forward();
		else if (history.state.customHistoryStage == 3)
			history.back();
	}
	var BuildURLWithHash = function ()
	{
		// The URLs of our 3 history states must have hash strings in them so that back and forward events never cause a page reload.
		return location.origin + location.pathname + location.search + (location.hash && location.hash.length > 1 ? location.hash : "#");
	}
	if (history.state == null)
	{
		// This is the first page load. Inject new history states to help identify back/forward button presses.
		var initialHistoryLength = history.length;
		history.replaceState({ customHistoryStage: 1, initialHistoryLength: initialHistoryLength }, "", BuildURLWithHash());
		history.pushState({ customHistoryStage: 2, initialHistoryLength: initialHistoryLength }, "", BuildURLWithHash());
		history.pushState({ customHistoryStage: 3, initialHistoryLength: initialHistoryLength }, "", BuildURLWithHash());
		history.back();
	}
	else if (history.state.customHistoryStage == 1)
		history.forward();
	else if (history.state.customHistoryStage == 3)
		history.back();

	$(window).bind("popstate", function ()
	{
		// Called when history navigation occurs.
		if (history.state == null)
			return;
		if (history.state.customHistoryStage == 1)
		{
			if (typeof BackButtonPressed == "function" && BackButtonPressed())
			{
				Reset();
				return;
			}
			if (history.state.initialHistoryLength > 1)
				history.back(); // There is back-history to go to.
			else
				history.forward(); // No back-history to go to, so undo the back operation.
		}
		else if (history.state.customHistoryStage == 3)
		{
			if (typeof ForwardButtonPressed == "function" && ForwardButtonPressed())
			{
				Reset();
				return;
			}
			if (history.length > history.state.initialHistoryLength + 2)
				history.forward(); // There is forward-history to go to.
			else
				history.back(); // No forward-history to go to, so undo the forward operation.
		}
	});
};