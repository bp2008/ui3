/**
* Longpress is a jQuery plugin that makes it easy to support long press
* events on mobile devices and desktop borwsers.
*
* @name longpress
* @version 0.1.2
* @requires jQuery v1.2.3+
* @author Vaidik Kapoor
* @license MIT License - http://www.opensource.org/licenses/mit-license.php
*
* For usage and examples, check out the README at:
* http://github.com/vaidik/jquery-longpress/
*
* Copyright (c) 2008-2013, Vaidik Kapoor (kapoor [*dot*] vaidik -[at]- gmail [*dot*] com)
*
* Modified for UI3 by bp2008
*/

(function ($)
{
	$.fn.longpress = function (longCallback, shortCallback, duration)
	{
		if (typeof duration === "undefined")
		{
			duration = 500;
		}

		return this.each(function ()
		{
			var $this = $(this);

			// to keep track of how long something was pressed
			var timeout = null;
			var mouse_down_x = 0;
			var mouse_down_y = 0;
			var mouseMoveTolerance = 5;
			// mousedown or touchstart callback
			function mousedown_callback(e)
			{
				if (e.which != 1 && e.which != 0)
					return;
				var context = this;
				mouseCoordFixer.fix(e);
				mouse_down_x = e.mouseX;
				mouse_down_y = e.mouseY;
				// set a timeout to call the longpress callback when time elapses
				clearTimeout(timeout);
				timeout = setTimeout(function ()
				{
					timeout = null;
					if (typeof longCallback === "function")
					{
						longCallback.call(context, e);
					} else
					{
						$.error('Callback required for long press. You provided: ' + typeof longCallback);
					}
				}, duration);
			}

			// mouseup or touchend callback
			function mouseup_callback(e)
			{
				if (e.which != 1 && e.which != 0)
					return;
				if (timeout == null && e.type.indexOf('touch') == 0)
					e.preventDefault();
				if (timeout != null)
				{
					// cancel the timeout
					clearTimeout(timeout);
					timeout = null;

					// call the shortCallback if provided
					if (typeof shortCallback === "function")
					{
						shortCallback.call($(this), e);
					} else if (typeof shortCallback === "undefined")
					{
						;
					} else
					{
						$.error('Optional callback for short press should be a function.');
					}
				}
			}

			// cancel long press event if the finger or mouse was moved
			function move_callback(e)
			{
				mouseCoordFixer.fix(e);
				if (Math.abs(mouse_down_x - e.mouseX) > mouseMoveTolerance
					|| Math.abs(mouse_down_y - e.mouseY) > mouseMoveTolerance)
				{
					clearTimeout(timeout);
					timeout = null;
				}
			}

			// Browser Support
			$this.on('mousedown', mousedown_callback);
			$this.on('mouseup', mouseup_callback);
			$this.on('mousemove', move_callback);

			// Mobile Support
			$this.on('touchstart', mousedown_callback);
			$this.on('touchend', mouseup_callback);
			$this.on('touchmove', move_callback);
		});
	};
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
					mouseCoordFixer.last.x = e.mouseX = e.originalEvent.touches[0].pageX + $(window).scrollLeft();
					mouseCoordFixer.last.y = e.mouseY = e.originalEvent.touches[0].pageY + $(window).scrollTop();
				}
				else if (e.touches && e.touches.length > 0)
				{
					mouseCoordFixer.last.x = e.mouseX = e.touches[0].pageX;
					mouseCoordFixer.last.y = e.mouseY = e.touches[0].pageY;
				}
				else
				{
					e.mouseX = mouseCoordFixer.last.x;
					e.mouseY = mouseCoordFixer.last.y;
				}
			}
			else
			{
				mouseCoordFixer.last.x = e.mouseX = e.pageX + $(window).scrollLeft();
				mouseCoordFixer.last.y = e.mouseY = e.pageY + $(window).scrollTop();
			}
		}
	};
} (jQuery));