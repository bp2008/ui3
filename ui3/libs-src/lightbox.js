/*
 * lightbox - jQuery Plugin for zooming images with a single click
 * MIT License - https://opensource.org/licenses/MIT
 */
/// <reference path="jquery-3.1.1.js" />
"use strict";
(function ($)
{
	$.fn.lightbox = function (options)
	{
		return new Lightbox(this, options);
	}
	function Lightbox($img, options)
	{
		var $overlay, $bigImg, isIn;
		$img.css("cursor", "zoom-in");
		$img.click(toggle);
		function toggle(e)
		{
			if (isIn)
			{
				$overlay.remove();
				$bigImg.remove();
			}
			else
			{
				$overlay = $('<div style="display:none;z-index:9999999;position:absolute;top:0px;left:0px;width:100%;height:100%;background-color:rgba(0,0,0,0.5)"></div>');
				$overlay.css("cursor", "zoom-out")
					.click(toggle);
				$("body").append($overlay);
				$bigImg = $('<img style="position:absolute;top:0px;left:0px;maxwidth:100vw;max-height:100vh;" />');
				$bigImg.load(function ()
				{
					var windowW = $(window).width();
					var windowH = $(window).height();
					var w = $bigImg.width();
					var h = $bigImg.height();

					var left = $(window).scrollLeft() + ((windowW - w) / 2);
					if (left < 0)
						left = 0;

					var top = $(window).scrollTop() + ((windowH - h) / 2);
					if (top < 0)
						top = 0;

					$bigImg.css("left", left + "px").css("top", top + "px");
				});
				$bigImg.attr('src', $img.attr('src'));
				$overlay.append($bigImg);
				$overlay.fadeIn(200);
			}
			isIn = !isIn;
		}
	}
}(jQuery));
