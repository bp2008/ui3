/*
 * UI3Modal - jQuery Plugin
 * Created for UI2, a custom Blue Iris web interface. Adapted for UI3.
 */
/// <reference path="jquery-1.11.3.js" />

(function ($)
{
	var zIndexAutoIncrement = 200;
	$.fn.modal = function (options)
	{
		var dialog = new UI2Dialog(this, options);
		show(dialog);
		return dialog;
	}
	function UI2Dialog($content, options)
	{
		this.isOpen = false;
		this.$content = $content;
		this.settings = $.extend(
			{
				// These are the default settings
				maxWidth: 999999,
				maxHeight: 999999,
				sizeToFitContent: false,
				shrinkOnBothResizePasses: false,
				removeElementOnClose: false,
				onClosing: null,
				overlayOpacity: 0.3
			}, options);
	}
	function show(self)
	{
		if (self.isOpen)
			return;
		self.isOpen = true;

		self.myIndex = zIndexAutoIncrement;
		self.$overlay = $(document.createElement('div'));
		self.$overlay.addClass("ui2modal_overlay");
		self.$overlay.css("position", "absolute");
		self.$overlay.css("width", "100%");
		self.$overlay.css("height", "100%");
		self.$overlay.css("top", "0px");
		self.$overlay.css("left", "0px");
		self.$overlay.css("background-color", "#000000");
		self.$overlay.css("opacity", self.settings.overlayOpacity.toString());
		self.$overlay.css("z-index", ++zIndexAutoIncrement);
		self.$overlay.click(function () { self.close(); });

		self.$dialog = $(document.createElement('div'));
		self.$dialog.addClass("ui2modal");
		self.$dialog.css("position", "absolute");
		self.$dialog.css("border", "4px ridge #377EC0");
		self.$dialog.css("background-color", "#373737");
		self.$dialog.css("color", "#DDDDDD");
		self.$dialog.css("overflow-y", "auto");
		self.$dialog.css("z-index", ++zIndexAutoIncrement);
		self.$dialog.append(self.$content);

		self.$closebtn = $('<div><svg viewbox="0 0 40 40">'
			+ '<circle fill="white" cx="20" cy="20" r="20"/>'
			+ '<circle fill="black" cx="20" cy="20" r="17"/>'
			+ '<path stroke="white" stroke-width="5" d="M 16,11 L 24,29 M 29,11 L 11,29" />'
			+ '</svg></div>');
		self.$closebtn.addClass("ui2modal_close");
		self.$closebtn.css("position", "absolute");
		self.$closebtn.css("width", "25px");
		self.$closebtn.css("height", "25px");
		self.$closebtn.css("cursor", "pointer");
		self.$closebtn.css("z-index", ++zIndexAutoIncrement);
		self.$closebtn.click(function () { self.close(); });

		$("body").append(self.$overlay);
		$("body").append(self.$dialog);
		$("body").append(self.$closebtn);
		self.$content.show();

		$(window).bind("resize.ui2modal" + self.myIndex + " orientationchange.ui2modal" + self.myIndex, function () { onResize(self); });

		onResize(self);
	}
	UI2Dialog.prototype.close = function (suppressCallback)
	{
		if (!this.isOpen)
			return;
		this.isOpen = false;

		if (typeof suppressCallback == "undefined" || suppressCallback == null)
			suppressCallback = false;

		if (typeof this.settings.onClosing == "function" && !suppressCallback)
			if (this.settings.onClosing())
				return false;

		$(window).unbind(".ui2modal" + this.myIndex);

		if (this.settings.removeElementOnClose)
			this.$content.remove();
		else
		{
			this.$content.hide();
			$("body").append(this.$content);
		}

		this.$overlay.remove();
		this.$dialog.remove();
		this.$closebtn.remove();

		return true;
	}
	function onResize(self, isSecondPass)
	{
		var windowW = $(window).width();
		var windowH = $(window).height();

		var dialogW = windowW * 0.7;
		var dialogH = windowH * 0.8;

		if (dialogW < 300)
			dialogW = 300;
		if (dialogH < 150)
			dialogH = 150;

		if (self.settings.sizeToFitContent && (self.settings.shrinkOnBothResizePasses || isSecondPass))
		{
			var contentW = self.$content.outerWidth(true);
			var contentH = self.$content.outerHeight(true);
			if (dialogW > contentW)
				dialogW = contentW;
			if (dialogH > contentH)
				dialogH = contentH;
		}

		if (dialogW > self.settings.maxWidth)
			dialogW = self.settings.maxWidth;
		if (dialogH > self.settings.maxHeight)
			dialogH = self.settings.maxHeight;

		var dialogT = ((windowH - dialogH) / 2);
		var dialogL = ((windowW - dialogW) / 2);

		self.$dialog.css("top", dialogT + "px");
		self.$dialog.css("left", dialogL + "px");
		self.$dialog.css("width", dialogW + "px");
		self.$dialog.css("height", dialogH + "px");

		self.$closebtn.css("top", (dialogT - 8) + "px");
		self.$closebtn.css("left", ((dialogL + dialogW) - 8) + "px");

		if (self.settings.sizeToFitContent)
		{
			if (!isSecondPass)
				onResize(self, true);
		}
	}
}(jQuery));