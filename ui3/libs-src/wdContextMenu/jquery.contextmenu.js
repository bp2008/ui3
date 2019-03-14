// ==ClosureCompiler==
// @output_file_name default.js
// @compilation_level SIMPLE_OPTIMIZATIONS
// @language ECMASCRIPT5
// ==/ClosureCompiler==

(function ($)
{
	var allJQContextMenus = [];
	$.hideAllContextMenus = function ()
	{
		for (var i = 0; i < allJQContextMenus.length; i++)
			allJQContextMenus[i].hideAll();
	}
	function returnfalse() { return false; };
	$.fn.contextmenu = function (option)
	{
		option = $.extend({ alias: "cmroot", width: 150, clickType: "long" }, option);
		var ruleName = null;
		var target = null;
		var groups = {};
		var mitems = {};
		var actions = {};
		var showGroups = [];
		var itemTpl = "<div class='b-m-$[type]' unselectable=on><nobr unselectable=on><div class=\"b-m-icon$[iconClass]\"><svg class=\"icon\"><use xlink:href=\"$[icon]\"></use></svg></div><span unselectable=on>$[text]</span></nobr></div>";
		var gTemplet = $("<div/>").addClass("b-m-mpanel").attr("unselectable", "on").css("display", "none");
		var iTemplet = $("<div/>").addClass("b-m-item").attr("unselectable", "on");
		var sTemplet = $("<div/>").addClass("b-m-split");
		var nTemplet = $('<div style="display:none"/>').addClass("b-m-none");
		var suppressCloseByDocClick = false;
		function preventCloseByDocClick()
		{
			suppressCloseByDocClick = true;
			setTimeout(allowCloseByDocClick, 0);
		}
		function allowCloseByDocClick()
		{
			suppressCloseByDocClick = false;
		}
		//build group item, which has sub items
		var buildGroup = function (obj)
		{
			groups[obj.alias] = this;
			this.gidx = obj.alias;
			this.id = obj.alias;
			if (obj.disable)
			{
				this.disable = obj.disable;
				this.className = "b-m-idisable";
			}
			$(this).width(obj.width)/*.click(returnfalse)*/.on('mousedown touchstart', preventCloseByDocClick).appendTo($("body"));
			obj = null;
			return this;
		};
		var buildItem = function (obj)
		{
			var T = this;
			//T.title = obj.text;
			T.idx = obj.alias;
			T.gidx = obj.gidx;
			T.data = obj;
			var tooltip = obj["tooltip"];
			if (tooltip)
				$(T).attr('title', tooltip);
			T.innerHTML = itemTpl.replace(/\$\[([^\]]+)\]/g, function ()
			{
				var value = obj[arguments[1]];
				if (!value)
					value = "";
				if (arguments[1] == "iconClass")
					return value == "" ? "" : " " + value;
				return value;
			});
			if (obj.disable)
			{
				T.disable = obj.disable;
				T.className = "b-m-idisable";
			}
			obj.items && (T.group = true);
			obj.action && (actions[obj.alias] = obj.action);
			mitems[obj.alias] = T;
			T = obj = null;
			return this;
		};
		//add new items
		var addItems = function (gidx, items)
		{
			var tmp = null;
			for (var i = 0; i < items.length; i++)
			{
				if (items[i].type == "skip")
					tmp = nTemplet.clone()[0];
				else if (items[i].type == "splitLine")
				{
					//split line
					tmp = sTemplet.clone()[0];
				}
				else
				{
					items[i].gidx = gidx;
					if (items[i].type == "group")
					{
						//group 
						buildGroup.apply(gTemplet.clone()[0], [items[i]]);
						arguments.callee(items[i].alias, items[i].items);
						items[i].type = "arrow";
						tmp = buildItem.apply(iTemplet.clone()[0], [items[i]]);
					}
					else
					{
						//normal item
						items[i].type = "ibody";
						tmp = buildItem.apply(iTemplet.clone()[0], [items[i]]);
						$(tmp).click(function (e)
						{
							var skipReturn = false;
							if (!this.disable)
							{
								if ($.isFunction(actions[this.idx]))
								{
									if (actions[this.idx].call(this, target))
										skipReturn = true;
								}
								hideMenuPane();
							}
							if (!skipReturn)
								return false;
						});

					} //end if
					$(tmp).bind("contextmenu", returnfalse).hover(overItem, outItem);
				}
				groups[gidx].appendChild(tmp);
				tmp = items[i] = items[i].items = null;
			} //end for
			gidx = items = null;
		};
		var overItem = function (e)
		{
			//menu item is disabled          
			if (this.disable)
				return false;
			hideMenuPane.call(groups[this.gidx]);
			//has sub items
			if (this.group)
			{
				var pos = $(this).offset();
				var width = $(this).outerWidth();
				showMenuGroup.apply(groups[this.idx], [pos, width]);
			}
			this.className = "b-m-ifocus";
			return false;
		};
		//menu loses focus
		var outItem = function (e)
		{
			//disabled item
			if (this.disable)
				return false;
			if (!this.group)
			{
				//normal item
				this.className = "b-m-item";
			} //Endif
			return false;
		};
		//show menu group at specified position
		var showMenuGroup = function (pos, width)
		{
			var bwidth = $("body").width();
			var bheight = document.documentElement.clientHeight;
			var mwidth = $(this).outerWidth();
			var mheight = $(this).outerHeight();
			pos.left = (pos.left + width + mwidth > bwidth) ? (pos.left - mwidth < 0 ? 0 : pos.left - mwidth) : pos.left + width;
			pos.top = (pos.top + mheight > bheight) ? (pos.top - mheight + (width > 0 ? 25 : 0) < 0 ? 0 : pos.top - mheight + (width > 0 ? 25 : 0)) : pos.top;
			$(this).css(pos).show();
			showGroups.push(this.gidx);
		};
		//to hide menu
		var hideMenuPane = function (e)
		{
			var alias = null;
			for (var i = showGroups.length - 1; i >= 0; i--)
			{
				if (showGroups[i] == this.gidx)
					break;
				alias = showGroups.pop();
				groups[alias].style.display = "none";
				mitems[alias] && (mitems[alias].className = "b-m-item");
			} //Endfor
			if (option.onCancelContextMenu && $.isFunction(option.onCancelContextMenu))
				option.onCancelContextMenu.call(this, e);
			//CollectGarbage();
		};
		function applyRule(rule)
		{
			if (ruleName && ruleName == rule.name)
				return false;
			for (var i in mitems)
				disable(i, !rule.disable);
			for (var i = 0; i < rule.items.length; i++)
				disable(rule.items[i], rule.disable);
			ruleName = rule.name;
		};
		function disable(alias, disabled)
		{
			var item = mitems[alias];
			item.className = (item.disable = item.lastChild.disabled = disabled) ? "b-m-idisable" : "b-m-item";
		};

		/* to show menu  */
		function showMenu(e, menutarget)
		{
			target = menutarget;
			showMenuGroup.call(groups[option.alias], { left: e.pageX, top: e.pageY }, 0);
			$(document).one('mousedown touchstart', docClickHideMenuPane);
		}
		function docClickHideMenuPane(e)
		{
			if (suppressCloseByDocClick)
				$(document).one('mousedown touchstart', docClickHideMenuPane);
			else
				hideMenuPane(e);
		}
		var $root = $("#" + option.alias);
		var root = null;
		if ($root.length == 0)
		{
			root = buildGroup.apply(gTemplet.clone()[0], [option]);
			root.applyrule = applyRule;
			root.showMenu = showMenu;
			addItems(option.alias, option.items);
		}
		else
		{
			root = $root[0];
		}
		var me = $(this).each(function ()
		{
			var clickHandler = function (e, self)
			{
				var bShowContext = (option.onContextMenu && $.isFunction(option.onContextMenu)) ? option.onContextMenu.call(this, e) : true;
				if (bShowContext)
				{
					if (option.onShow && $.isFunction(option.onShow))
					{
						option.onShow.call(self, root);
					}
					root.showMenu(e, self);
				}
				return false;
			};
			if (option.clickType == "left")
				return $(this).click(function (e)
				{
					if (e.which == 1)
						return clickHandler(e, this);
				});
			else if (option.clickType == "middle")
				return $(this).click(function (e)
				{
					if (e.which == 2)
						return clickHandler(e, this);
				});
			else if (option.clickType == "right")
				return $(this).bind('contextmenu', function (e)
				{
					return clickHandler(e, this);
				});
			else if (option.clickType == "double")
				return $(this).bind('dblclick', function (e)
				{
					return clickHandler(e, this);
				});
			else
				return $(this).longpress(function (e)
				{
					return clickHandler(e, this);
				});
		});
		//to apply rule
		if (option.rule)
		{
			applyRule(option.rule);
		}
		gTemplet = iTemplet = sTemplet = nTemplet = itemTpl = buildGroup = buildItem = null;
		addItems = overItem = outItem = null;
		me.hideAll = function ()
		{
			hideMenuPane();
		}
		allJQContextMenus.push(me);
		//CollectGarbage();
		return me;
	}
})(jQuery);