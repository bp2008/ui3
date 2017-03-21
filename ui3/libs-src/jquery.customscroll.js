/*
 *  jquery.customscrollbar.js
 *  by Brian Pearce, 2016
 *
 *  Usage:
 *    Divs you wish to apply custom scrollbars to should be wrapped in another div which defines the location and size of the visible element.
 *    The parent div should be explicitly sized and contain no other child elements.  The scroll bar track will be appended to the parent div.
 *      <div class="myWrapper1"><div id="myScrollableElement1">...</div></div>
 *      <div style="width: 300px; height: 300px;"><div id="myScrollableElement2">...</div></div>
 *    Call CustomScroll for each element that needs to scroll.
 *      $("#myScrollableElement1").CustomScroll();
 *      $("#myScrollableElement2").CustomScroll({ trackClass: "CS-Track", handleClass: "CS-Handle" }));
 *    When any of the elements you called CustomScroll on are resized, call this:
 *      $.CustomScroll.callMeOnContainerResize();
 *
 *  Known issues:
 *    * Scroll bars capture "mousedown" and "touchdown" events even if there is another element on top of the scroll bar.
 *
 *  
 * -------------- This library is based on: -----------------
 *
 *  jquery-boilerplate - v4.0.0
 *  A jump-start for jQuery plugins development.
 *  http://jqueryboilerplate.com
 *
 *  Made by Zeno Rocha
 *  Under MIT License
 *
 * ----------------------------------------------------------
 */
; (function ($, window, document, undefined)
{
    "use strict";

    var pluginName = "CustomScroll",
        defaults = {
            trackClass: null // If defined, a width MUST be provided by css and this width must never change
            , handleClass: null
            , changeMarginRightToScrollBarWidth: true // If true, makes room for the scroll bar by assigning the margin-right css style to the scroll track's width
            , handleMinSize: 30 // Minimum height, in pixels, of the scroll bar handle
        };

    var customScrollObjects = [];

    function CustomScroll(element, options)
    {
        this.element = element;

        this.settings = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
        customScrollObjects.push(this);
    }

    $.extend(CustomScroll.prototype, {
        init: function ()
        {
            var self = this;
            this.isHandleDragging = false;
            var $ele = this.$ele = $(this.element);
            var $parent = this.$parent = $ele.parent();
            var $document = this.$document = $(document);

            $ele.css("height", "100%");

            // Measure width of native scroll bar
            var $measureRoot = $('<div style="position:absolute;width:300px;height:300px;overflow:hidden;top:-1000px;left:-1000px"></div>');
            $(document.documentElement).append($measureRoot);
            var widthIncludingScrollbar = $measureRoot.width();
            $measureRoot.css("overflow-y", "scroll");
            var $measurer = $('<div style="position:relative;width:100%;height:10px"></div>');
            $measureRoot.append($measurer);
            this.nativeScrollBarWidth = widthIncludingScrollbar - $measurer.width();
            $measureRoot.remove();

            // Create and append a custom scrollbar track
            var hasTrackClass = this.settings.trackClass != null;
            this.$track = $('<div track="track"' + (hasTrackClass ? (' class="' + this.settings.trackClass + '"') : '') + '></div>');
            if (!hasTrackClass)
                this.$track.css("width", "8px").css("background-color", "#DDDDDD");
            this.trackWidth = this.$track.outerWidth(true);
            this.$track.css("position", "absolute").css("height", "100%").css("right", 0 + "px").css("overflow", "hidden");
            $parent.append(this.$track);

            // Hide the native scroll bar
            $parent.css("overflow", "hidden");
            if ($parent.css("position") == "static")
                $parent.css("position", "relative");
            $ele.css("position", "absolute").css("overflow-x", "hidden").css("overflow-y", "scroll");
            if (this.settings.changeMarginRightToScrollBarWidth)
                $ele.css("padding-right", this.trackWidth + "px");

            // Create and append a custom scrollbar handle
            var hasHandleClass = this.settings.handleClass != null;
            this.$handle = $('<div handle="handle"' + (hasHandleClass ? (' class="' + this.settings.handleClass + '"') : '') + '></div>');
            if (!hasHandleClass)
                this.$handle.css("width", "100%").css("background-color", "#AAAAAA");
            this.$handle.css("position", "absolute");
            this.$track.append(this.$handle);

            // Assign the appropriate sizes
            this.recalculateScrollbarSizes(this);

            // Force all mouse events to treat the track/handle as transparent, so that mouse wheel events can pass through to the container.
            this.$track.css("pointer-events", "none");
            this.$handle.css("pointer-events", "none");

            // Bind events
            $ele.on("scroll", function () { return self.onScroll(self) });
            $document.on("mousedown touchstart", function (e) { return self.onMouseDown(e, self) });
            $document.on("mousemove touchmove", function (e) { return self.onMouseMove(e, self) });
            $document.on("mouseup touchend", function (e) { return self.onMouseUp(e, self) });
            $document.on("touchcancel", function (e) { return self.onMouseCancel(e, self) });
        }
        , onScroll: function (self)
        {
            var height_offset_by_visible_height = (self.$ele.get(0).scrollHeight - self.$ele.height());
            var scrollPosPercent = height_offset_by_visible_height <= 0 ? 0 : (self.$ele.scrollTop() / height_offset_by_visible_height);
            self.$handle.css("top", (scrollPosPercent * (self.$track.height() - self.$handle.height())) + "px");
        }
        , onMouseDown: function (e, self)
        {
            if (self.hitTest(self.$handle, e.pageX, e.pageY))
            {
                var y = e.pageY - self.$ele.offset().top;
                self.isHandleDragging = true;
                self.draggingOriginalY = y;
                self.scrollStartPosition = self.$ele.scrollTop();
                e.stopImmediatePropagation();
                return false;
            }
            else if (self.hitTest(self.$track, e.pageX, e.pageY))
            {
                var direction = e.pageY < self.$handle.offset().top ? -1 : 1;
                self.scrollRelative(self, self.$ele.height() * 0.8 * direction);
                e.stopImmediatePropagation();
                return false;
            }
            return true;
        }
        , onMouseMove: function (e, self)
        {
            if (self.isHandleDragging)
            {
                var localY = e.pageY - self.$ele.offset().top;
                var deltaY = localY - self.draggingOriginalY;
                var trackRange = self.$track.height() - self.$handle.height();
                var deltaPercent = trackRange <= 0 ? 0 : (deltaY / trackRange);
                var scrollRange = self.$ele.get(0).scrollHeight - self.$ele.height();
                self.scrollAbsolute(self, self.scrollStartPosition + (deltaPercent * scrollRange));
            }
        }
        , onMouseUp: function (e, self)
        {
            self.isHandleDragging = false;
        }
        , onMouseCancel: function (e, self) // Touch events can "cancel", allowing us to restore the original scroll position
        {
            self.isHandleDragging = false;
            self.scrollAbsolute(self, self.scrollStartPosition);
        }
        , hitTest: function ($ele, x, y)
        {
            var offset = $ele.offset();
            return x > offset.left && y > offset.top && x < (offset.left + $ele.width()) && y < (offset.top + $ele.height());
        }
        , scrollRelative: function (self, distance)
        {
            self.$ele.scrollTop(self.$ele.scrollTop() + distance);
        }
        , scrollAbsolute: function (self, y)
        {
            self.$ele.scrollTop(y);
        }
        , recalculateScrollbarSizes: function (self)
        {
            if (!self.$ele.is(":visible"))
                return;
            var visibleWidth = self.$parent.width();
            if (this.settings.changeMarginRightToScrollBarWidth)
                self.$ele.css("width", ((visibleWidth + self.nativeScrollBarWidth) - self.trackWidth) + "px");
            else
                self.$ele.css("width", (visibleWidth + self.nativeScrollBarWidth) + "px");
            var scrollHeight = self.$ele.get(0).scrollHeight;
            var visibleRegionSize = scrollHeight <= 0 ? 0 : (self.$ele.height() / scrollHeight);
            if (visibleRegionSize >= 1)
                self.$track.hide();
            else
            {
                self.$track.show();
                var newHandleSize = Math.max(self.settings.handleMinSize, visibleRegionSize * self.$track.height());
                self.$handle.css("height", newHandleSize + "px");
                self.onScroll(self);
            }
        }
    });

    $.fn[pluginName] = function (options)
    {
        return this.each(function ()
        {
            if (!$.data(this, "plugin_" + pluginName))
                $.data(this, "plugin_" + pluginName, new CustomScroll(this, options));
        });
    };
    $.extend($, {
        CustomScroll:
        {
            callMeOnContainerResize: function ()
            {
                for (var i = 0; i < customScrollObjects.length; i++)
                {
                    if (jQuery.contains(document.documentElement, customScrollObjects[i].element))
                        customScrollObjects[i].recalculateScrollbarSizes(customScrollObjects[i]);
                    else
                        customScrollObjects.splice(i, 1);
                }
            }
        }
    });

})(jQuery, window, document);