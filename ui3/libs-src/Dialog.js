/*
 * Dialog - jQuery Plugin for creating simple dialog boxes
 * MIT License - https://opensource.org/licenses/MIT
 */
/// <reference path="jquery-3.1.1.js" />
"use strict";
var $DialogDefaults = { theme: "light" };
(function ($)
{
	var idAutoIncrement = 0;
	var zIndexAutoIncrement = 1000;
	$.fn.dialog = function (options)
	{
		return new Dialog(this, options);
	}
	$.fn.modalDialog = function (options)
	{
		if (!options)
			options = {};
		if (!options.overlayOpacity)
			options.overlayOpacity = 0.3;
		return new Dialog(this, options);
	}
	function Dialog($content, options)
	{
		var self = this;

		this.$overlay = $("");
		this.$dialog = $("");
		this.$titlebar = $("");
		this.$title = $("");
		this.$closebtn = $("");
		this.$refreshbtn = $("");

		var myId = idAutoIncrement;
		var isOpen = false;
		var mouseMem = { offsetX: 0, offsetY: 0, down: false, originalX: 0, originalY: 0 };
		this.settings = $.extend(
			{
				// These are the default settings
				title: "Message"
				, closeOnOverlayClick: false
				, onClosing: null
				, overlayOpacity: 0
				, cssClass: ""
				, reattachContentAfterClose: true
				, onRefresh: null
				, theme: $DialogDefaults.theme
			}, options);

		var open = function ()
		{
			if (isOpen)
				return;
			isOpen = true;
			var opacity = parseFloat(self.settings.overlayOpacity);

			if (opacity > 0)
			{
				self.$overlay = $('<div class="dialog_overlay"></div>');
				self.$overlay.css('opacity', opacity);
				self.$overlay.css("z-index", zIndexAutoIncrement++);
				if (self.settings.closeOnOverlayClick)
				{
					self.$overlay.on("contextmenu", function () { self.close(); return false; });
					self.$overlay.click(function (e) { self.close(); });
				}
				$("body").append(self.$overlay);
			}

			{
				self.$dialog = $('<div class="dialog_wrapper"></div>');
				if (self.settings.cssClass)
					self.$dialog.addClass(self.settings.cssClass);
				if (self.settings.theme == "dark")
					self.$dialog.addClass("darkTheme");
				self.$dialog.on('mousedown touchstart', focusSelf);
				{
					self.$titlebar = $('<div class="dialog_titlebar"></div>');
					{
						self.$title = $('<div class="dialog_title"></div>');
						self.$title.html(self.settings.title);
						self.$title.on('mousedown touchstart', dragStart);
						$(document).on('mousemove touchmove', dragMove);
						$(document).on('mouseup touchend mouseleave', dragEnd);
						$(document).on('touchcancel', dragCancel);
						self.$titlebar.append(self.$title);
					}
					if (typeof self.settings.onRefresh == "function")
					{
						self.$refreshbtn = $('<div class="dialog_refresh">'
							+ '<div class="dialog_refresh_icon"><svg viewBox="4 4 16 16">'
							+ '<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99'
							+ ' 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31'
							+ ' 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>'
							+ '</svg></div></div>');
						self.$refreshbtn.click(function (e) { self.settings.onRefresh(); });
						self.$titlebar.append(self.$refreshbtn);
					}
					{
						self.$closebtn = $('<div class="dialog_close">'
							+ '<div class="dialog_close_icon"><svg viewbox="0 0 12 12">'
							+ '<path stroke-width="1.4" d="M 1,1 L 11,11 M 1,11 L 11,1" />'
							+ '</svg></div></div>');
						self.$closebtn.click(function (e) { self.close(); });
						self.$titlebar.append(self.$closebtn);
					}
					self.$dialog.append(self.$titlebar);
				}

				if (!$content.hasClass("dialog_content"))
					$content.addClass("dialog_content");
				if (self.settings.reattachContentAfterClose && $content.parent().length > 0)
				{
					self.$placeholder = $('<div style="display:none;" title="Placeholder for dialog content"></div>');
					$content.after(self.$placeholder);
					if (!$content.is(":visible"))
						self.showAndHideContent = true;
				}
				self.$dialog.append($content);

				if (self.showAndHideContent)
					$content.show();

				$("body").append(self.$dialog);

				self.bringToTop();
			}

			positionCentered();

			$(window).bind("resize.dialog" + myId + " orientationchange.dialog" + myId + " scroll.dialog" + myId, onResize);

			onResize();
		}
		this.bringToTop = function ()
		{
			self.$dialog.css("z-index", zIndexAutoIncrement++);
		}
		this.close = function (suppressCallback)
		{
			if (!isOpen)
				return;
			isOpen = false;

			if (typeof self.settings.onClosing == "function" && !suppressCallback)
				if (self.settings.onClosing())
					return false;

			$(window).unbind(".dialog" + myId);

			self.$overlay.remove();

			if (self.showAndHideContent)
				$content.hide();
			if (self.settings.reattachContentAfterClose && self.$placeholder)
				self.$placeholder.replaceWith($content);
			self.$dialog.remove();


			return true;
		}
		this.contentChanged = function (reCenter, setFullyOnScreen)
		{
			if (reCenter)
			{
				self.$dialog.css("left", "0px");
				self.$dialog.css("top", "0px");
				positionCentered();
			}
			else
			{
				var offset = self.$dialog.offset();
				var coords = keepOnScreen(offset.left, offset.top, setFullyOnScreen);
				if (offset.left != coords.X)
					self.$dialog.css("left", coords.X + "px");
				if (offset.top != coords.Y)
					self.$dialog.css("top", coords.Y + "px");
			}
		}
		this.setLoadingState = function (loading)
		{
			if (loading)
				self.$dialog.addClass("loading");
			else
				self.$dialog.removeClass("loading");
		}
		var positionCentered = function ()
		{
			var windowW = $(window).width();
			var windowH = $(window).height();

			var w = self.$dialog.width();
			var h = self.$dialog.height();

			self.$dialog.css("left", $(window).scrollLeft() + ((windowW - w) / 2) + "px");
			self.$dialog.css("top", $(window).scrollTop() + ((windowH - h) / 2) + "px");
		}
		var onResize = function ()
		{
			if (!isOpen)
				return;
			var offset = self.$dialog.offset();

			var offset = self.$dialog.offset();
			var coords = keepOnScreen(offset.left, offset.top, false);
			if (offset.left != coords.X)
				self.$dialog.css("left", coords.X + "px");
			if (offset.top != coords.Y)
				self.$dialog.css("top", coords.Y + "px");

			self.$overlay.css('width', $(document).width()).css('height', $(document).height());
		}
		var focusSelf = function (e)
		{
			self.bringToTop();
		}
		var dragStart = function (e)
		{
			mouseCoordFixer.fix(e);
			mouseMem.down = true;
			var pos = self.$dialog.position();
			mouseMem.originalX = pos.left;
			mouseMem.originalY = pos.top;
			mouseMem.offsetX = pos.left - e.pageX;
			mouseMem.offsetY = pos.top - e.pageY;
		}
		var dragMove = function (e)
		{
			mouseCoordFixer.fix(e);
			if (mouseMem.down)
			{
				var newX = e.pageX + mouseMem.offsetX;
				var newY = e.pageY + mouseMem.offsetY;

				var coords = keepOnScreen(newX, newY, false);
				self.$dialog.css("left", coords.X + "px");
				self.$dialog.css("top", coords.Y + "px");
			}
		}
		var dragEnd = function (e)
		{
			dragMove(e);
			mouseMem.down = false;
		}
		var dragCancel = function (e)
		{
			mouseCoordFixer.fix(e);
			if (mouseMem.down)
			{
				mouseMem.down = false;
				self.$dialog.css("left", mouseMem.originalX + "px");
				self.$dialog.css("top", mouseMem.originalY + "px");
			}
		}
		var keepOnScreen = function (newX, newY, keepFullyOnScreen)
		{
			var windowW = $(window).width();
			var windowH = $(window).height();
			var topOfWindow = $(window).scrollTop();
			var leftOfWindow = $(window).scrollLeft();
			var bottomOfWindow = (topOfWindow + windowH);
			var rightOfWindow = (leftOfWindow + windowW);

			var w = self.$dialog.outerWidth(true);
			var h = self.$dialog.outerHeight(true);

			if (keepFullyOnScreen)
			{
				if (newX < leftOfWindow)
					newX = leftOfWindow;
				else if (newX + w > rightOfWindow)
					newX = rightOfWindow - w;

				if (newY < topOfWindow)
					newY = topOfWindow;
				else if (newY > bottomOfWindow - h)
					newY = bottomOfWindow - h;
			}
			else
			{
				var w01 = w * 0.1;
				var w09 = w * 0.9;
				if (w >= 100 && w - w09 < 100)
					w09 = w - 100;
				if (newX + w09 < leftOfWindow)
					newX = leftOfWindow - w09;
				else if (newX + w01 > rightOfWindow)
					newX = rightOfWindow - w01;

				if (newY < topOfWindow)
					newY = topOfWindow;
				else if (newY > bottomOfWindow - 24)
					newY = bottomOfWindow - 24;
			}

			return { X: newX, Y: newY };
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

		open();
	}
}(jQuery));
var SimpleDialog = new function ()
{
	var self = this;
	this.text = this.Text = function (message)
	{
		return $('<div></div>').text(message).modalDialog();
	}
	this.html = this.Html = function (message)
	{
		return $('<div></div>').html(message).modalDialog();
	}
	this.confirmText = this.ConfirmText = function (question, onYes, onNo, options)
	{
		return Confirm($('<div></div>').text(question), onYes, onNo, GetConfirmOptions(options));
	}
	this.confirmHtml = this.ConfirmHtml = function (question, onYes, onNo, options)
	{
		return Confirm($('<div></div>').html(question), onYes, onNo, GetConfirmOptions(options));
	}
	var GetConfirmOptions = function (options)
	{
		return $.extend(
			{
				// These are the default settings for a basic confirm box
				title: "Confirm"
				, onError: null
				, yesText: "Yes"
				, noText: "No"
			}, options);
	}
	var Confirm = function (questionEle, onYes, onNo, options)
	{
		if (!options.onError && console)
			options.onError = console.log;
		if (!options.onError)
			options.onError = function (ex) { };
		var $dlg = $('<div></div>');
		$dlg.append(questionEle);

		var $yes = $('<input type="button" value="Yes" style="margin-right:15px;" />');
		var $no = $('<input type="button" value="No" />');
		if (options.yesText)
			$yes.val(options.yesText);
		if (options.noText)
			$no.val(options.noText);
		$dlg.append($('<div style="margin: 20px 0px 10px 0px; text-align: center;"></div>').append($yes).append($no));

		var dlg = $dlg.modalDialog({ title: options.title });
		$yes.click(function ()
		{
			dlg.close();
			if (typeof onYes == "function")
				try { onYes(); } catch (ex) { options.onError(ex); }
		});
		$no.click(function ()
		{
			dlg.close();
			if (typeof onNo == "function")
				try { onNo(); } catch (ex) { options.onError(ex); }
		});
		return dlg;
	}
}();