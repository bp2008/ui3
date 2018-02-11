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
			var mouse_down_time;
			var timeout;
			var mouse_down_x = 0;
			var mouse_down_y = 0;
			var mouseMoveTolerance = 5;
			// mousedown or touchstart callback
			function mousedown_callback(e)
			{
				if (e.which != 1)
					return;
				mouse_down_time = new Date().getTime();
				var context = this;
				mouse_down_x = e.pageX;
				mouse_down_y = e.pageY;
				// set a timeout to call the longpress callback when time elapses
				timeout = setTimeout(function ()
				{
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
				if (e.which != 1)
					return;
				var press_time = new Date().getTime() - mouse_down_time;
				if (press_time < duration)
				{
					// cancel the timeout
					clearTimeout(timeout);

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
				if (Math.abs(mouse_down_x - e.pageX) > mouseMoveTolerance
					|| Math.abs(mouse_down_y - e.pageY) > mouseMoveTolerance)
				{
					if (timeout != null)
						clearTimeout(timeout);
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
} (jQuery));