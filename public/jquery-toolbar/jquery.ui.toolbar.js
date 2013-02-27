/*!
 * jquery.ui.toolbar.js
 * Generic toolbar widget.
 * 
 * Copyright (C) 2012 Leftclick.com.au
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*jslint devel: true, bitwise: true, regexp: true, browser: true, unparam: true, evil: true, white: true, nomen: true, plusplus: true, maxerr: 50, indent: 4 */
/*global jQuery */

(function($) {
	"use strict";

	var __DEBUG__ = false,

		itemDefaults = {
			cssClass: {},
			attributes: {},
			icon: {}
		};

	/**
	 * Configurable and programmable toolbar widget.
	 */
	$.widget('ui.toolbar', {

		options: {

			/**
			 * Sequential array of toolbar item definition objects.  This is one method of adding items to the toolbar
			 * widget.  The other two ways are programmatically calling the addItem() and addSeparator() methods, and
			 * by providing relevant markup in the element used for the widget (i.e. progressive enhancement).
			 */
			items: [],

			/**
			 * Whether or not to display labels at the top-level.
			 */
			labels: true,

			/**
			 * URL prefix for all icon images.  Useful if all icons are in the same directory.
			 */
			iconSrcPrefix: '',

			/**
			 * Default alt text for icon images.
			 */
			defaultIconAlt: '',

			/**
			 * CSS class settings.  To apply additional classes per-item, use the cssClass key in the items entry.
			 */
			cssClass: {
				toolbar: 'ui-toolbar',
				toolbarLabels: 'ui-toolbar-labels',
				toolbarNoLabels: 'ui-toolbar-no-labels',

				item: 'ui-toolbar-item',
				itemButton: 'ui-toolbar-item-button',
				itemExpanderProxy: 'ui-toolbar-item-expander-proxy',
				itemExpanderButton: 'ui-toolbar-item-expander-button',
				itemSeparator: 'ui-toolbar-item-separator',

				hover: 'ui-state-hover',
				active: 'ui-state-active',

				wrapper: 'ui-toolbar-wrapper',
				icon: 'ui-toolbar-icon',
				label: 'ui-toolbar-label',
				expander: 'ui-toolbar-expander-list'
			},

			/**
			 * Helper and base widget classes.  These should not need changing, they are collected here for ease of
			 * reference.
			 */
			cssClassAdditional: {
				toolbar: 'ui-widget-content ui-helper-reset ui-helper-clearfix',
				item: 'ui-state-default',
				expander: 'ui-widget-content ui-helper-reset'
			},

			/**
			 * Attributes to pass to all icon, button and label elements attr() methods, repsectively.  To pass
			 * per-item attributes use the attributes key in the items entry.
			 */
			attributes: {
				item: {},
				icon: {},
				label: {}
			}
		},

		/**
		 * Widget constructor.
		 */
		_create: function() {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', '_create()'); }
			var self = this, o = this.options;
			$.Widget.prototype._create.call(this);
			this.toolbarInitialised = false;
			this.expandersMap = {};
			this.$toolbar = $('<ul></ul>').appendTo(this.element);
			this.$toolbar.addClass(o.cssClass.toolbar)
				.addClass(o.labels ? o.cssClass.toolbarLabels : o.cssClass.toolbarNoLabels)
				.addClass(o.cssClassAdditional.toolbar);
			if ($.isArray(o.items) && o.items.length > 0) {
				$.each(o.items, function(itemIndex, item) {
					if (!$.isPlainObject(item)) {
						item = {
							type: item
						};
					}
					item.properties = item.properties || {};
					switch (item.type || 'button') {
						case 'button':
							self.addButtonItem(item.id, item.group, item.properties, '_last', null, item.selected);
							break;
						case 'separator':
							self.addSeparatorItem(item.id, '_last', null);
							break;
						case 'expander-proxy':
							self.addExpanderProxyItem(item.id, item.group, item.properties, '_last', null);
							break;
						case 'expander-button':
							self.addExpanderButtonItem(item.id, item.group, item.properties, '_last', null, item.selected);
							break;
						default:
							throw 'Error: Unknown item type "' + (typeof item) + '" in toolbar constructor';
					}
				});
				$.each(o.items, function(itemIndex, item) {
					if (item.group) {
						var $items = self.getItemsInGroup(item.group);
						if ($items.filter('.' + o.cssClass.active).length === 0) {
							self.selectItem($items.eq(0));
						}
					}
				});
			}
			this.toolbarInitialised = true;
			this._fixHeight();
		},

		/**
		 * Widget destructor.
		 */
		destroy: function() {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'destroy()'); }
			var self = this;
			this.getAllItems().each(function(i, item) {
				self.removeItem($(item));
			});
			$(this.element).empty();
			$.Widget.prototype.destroy.call(this);
		},

		/**
		 * Set option override.  Note that setting the iconSrcPrefix or the defaultIconAlt will only affect items
		 * that have not yet been created.
		 *
		 * @param option
		 * @param value
		 */
		_setOption: function(option, value) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', '_setOption', option, value); }
			var o = this.options;
			switch (option) {
				case 'labels':
					if (value) {
						this.$toolbar.removeClass(o.cssClass.toolbarNoLabels).addClass(o.cssClass.toolbarLabels);
					} else {
						this.$toolbar.removeClass(o.cssClass.toolbarLabels).addClass(o.cssClass.toolbarNoLabels);
					}
					this._fixHeight();
					break;
			}
			$.Widget.prototype._setOption.call(this, option, value);
		},


		/**
		 * Add a standard, top-level button item.
		 *
		 * @param id Identifier for the new item.  If omitted, a unique id will be generated.
		 * @param group Group to assign the item to.
		 * @param properties Properties to assign to the new item.
		 * @param position Position within the toolbar to add the item.  If omitted the item will be added at the end.
		 * @param relativeTo Reference to another item that the item should be positioned relative to.  Only relevant
		 *   if position is "before" or "after".
		 * @param selected Whether to initially select the new item.  False by default.
		 *
		 * @return This object, for method chaining.
		 */
		addButtonItem: function(id, group, properties, position, relativeTo, selected) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'addButtonItem()', id, group, properties, position, relativeTo, selected); }
			id = id || this._generateUniqueId('item');
			properties = $.extend(true, {}, itemDefaults, ($.isPlainObject(properties) ? properties : {}));
			position = position === null ? '_last' : position;
			var isFirst = this.getItemsInGroup(group).length === 0,
				$item = this._createButtonItem(id, group, properties, 'ui-toolbar-item-button');
			this._addItem($item, this.$toolbar, position, relativeTo);
			if (selected || (isFirst && this.toolbarInitialised && properties.toggle)) {
				this.selectItem($item);
			}
			return this._fixHeight();
		},

		/**
		 * Add a separator item.
		 *
		 * @param id Identifier for the new separator.  If omitted or null, a unique id will be generated.
		 * @param position Where to position the separator relative to other items and separators in the toolbar.  If
		 *   omitted the separator will be added at the end.
		 * @param relativeTo Reference to another item that the separator should be positioned relative to.  Only
		 *   used when position is either 'before' or 'after'.
		 *
		 * @return This object, for method chaining.
		 */
		addSeparatorItem: function(id, position, relativeTo) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'addSeparatorItem()', id, position, relativeTo); }
			id = id || this._generateUniqueId('separator');
			var $separator;
			$separator = this._createSeparatorItem(id);
			this._addItem($separator, this.$toolbar, position, relativeTo);
			return this._fixHeight();
		},

		/**
		 * Add a proxy button item for a hidden / expandable group.
		 *
		 * @param id Identifier for the new item.  If omitted, a unique id will be generated.
		 * @param group Group to assign the item to.
		 * @param properties Properties to assign to the new item.
		 * @param position Position within the toolbar to add the item.  If omitted the item will be added at the end.
		 * @param relativeTo Reference to another item that the item should be positioned relative to.  Only relevant
		 *   if position is "before" or "after".
		 *
		 * @return This object, for method chaining.
		 */
		addExpanderProxyItem: function(id, group, properties, position, relativeTo) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'addExpanderProxyItem()', id, group, properties, position, relativeTo); }
			if (this.expandersMap[group]) {
				throw 'Error: Cannot create duplicate proxy for group "' + group + '"';
			}
			id = id || this._generateUniqueId('item');
			properties = $.extend(true, {}, itemDefaults, ($.isPlainObject(properties) ? properties : {}));
			position = position === null ? '_last' : position;
			var $item = this._createButtonItem(id, group, properties, 'ui-toolbar-item-expander-proxy'),
				$wrapper = this._addItem($item, this.$toolbar, position, relativeTo);
			this.expandersMap[group] = $('<ul></ul>')
				.addClass(this.options.cssClass.expander)
				.addClass(this.options.cssClassAdditional.expander)
				.appendTo($wrapper);
			return this._fixHeight();
		},

		/**
		 * Add an item to an expander.
		 *
		 * @param id Identifier for the new item.  If omitted, a unique id will be generated.
		 * @param group Group to assign the item to.
		 * @param properties Properties to assign to the new item.
		 * @param position Position within the toolbar to add the item.  If omitted the item will be added at the end.
		 * @param relativeTo Reference to another item that the item should be positioned relative to.  Only relevant
		 *   if position is "before" or "after".
		 *
		 * @return This object, for method chaining.
		 */
		addExpanderButtonItem: function(id, group, properties, position, relativeTo, selected) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'addExpanderButtonItem()', id, group, properties, position, relativeTo, selected); }
			id = id || this._generateUniqueId('item');
			properties = $.extend(true, {}, itemDefaults, ($.isPlainObject(properties) ? properties : {}));
			position = position === null ? '_last' : position;
			var isFirst = this.getItemsInGroup(group).length === 0,
				$item = this._createButtonItem(id, group, properties, 'ui-toolbar-item-expander-button'),
				$target = $('<li></li>').appendTo(this.expandersMap[group]);
			this._addItem($item, $target, position, relativeTo);
			if (selected || (isFirst && this.toolbarInitialised)) {
				this.selectItem($item);
			}
			return this._fixHeight();

		},

		/**
		 * Remove the specified item.
		 *
		 * @param itemReference Item reference, which may be the item jQuery object, the item identifier, the special
		 *   strings "_first" or "_last", or a numeric index.
		 *
		 * @return This object, for method chaining.
		 */
		removeItem: function(itemReference) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'removeItem()', itemReference); }
			this.getItem(itemReference).remove();
			return this._fixHeight();
		},

		/**
		 * Retrieve the specified item.
		 *
		 * @param itemReference Item reference, which may be the item jQuery object, the item identifier, the special
		 *   strings "_first" or "_last", or a numeric index.
		 *
		 * @return Item jQuery object as identified by the reference, or null if no such item exists.
		 */
		getItem: function(itemReference) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'getItem()', itemReference); }
			var result = null,
				$items = this.getAllItems();
			itemReference = itemReference || '_last';
			if (typeof itemReference === 'number') {
				result = $items.eq(itemReference);
			} else if (typeof itemReference === 'string') {
				switch (itemReference) {
					case '_first':
						result = $items.first();
						break;
					case '_last':
						result = $items.last();
						break;
					default:
						$items.each(function(itemIndex, item) {
							var $item = $(item);
							if (result ===  null && $item.data('toolbar.item').id === itemReference) {
								result = $item;
							}
						});
				}
			} else if ($items.index(itemReference) >= 0) {
				result = itemReference;
			}
			return result;
		},

		/**
		 * Get all items and separators in the toolbar.
		 *
		 * @return jQuery object containing all items and separators in the toolbar.
		 */
		getAllItems: function() {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'getAllItems()'); }
			return this.$toolbar.find('.' + this.options.cssClass.item);
		},

		/**
		 * Get thte set of all items and separators in the specified group.
		 *
		 * @param group Group name.
		 *
		 * @return jQuery object containing all items and separators in the given group.  This does not include
		 *   proxy items.
		 */
		getItemsInGroup: function(group) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'getItemsInGroup()', group); }
			return this.getAllItems().not('.' + this.options.cssClass.itemExpanderProxy).filter(function() {
				return $(this).data('toolbar.item').group === group;
			});
		},

		getProxyButtonForGroup: function(group) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'getProxyButtonForGroup()', group); }
			return this.getAllItems().filter('.' + this.options.cssClass.itemExpanderProxy).filter(function() {
				return $(this).data('toolbar.item').group === group;
			});
		},

		/**
		 * Select the specified item.
		 *
		 * @param itemReference Item reference, which may be the item jQuery object, the item identifier, the special
		 *   strings "_first" or "_last", or a numeric index.
		 *
		 * @return True if the selection is successful, otherwise false.
		 */
		selectItem: function(itemReference) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'selectItem()', itemReference); }
			var o = this.options, proceed = true, $icon, $proxyButton,
				$item = this.getItem(itemReference),
				properties = $item.data('toolbar.item'),
				isActive = $item.is('.' + o.cssClass.active);
			if (properties.group) {
				if ($item.is('.' + o.cssClass.itemExpanderProxy)) {
					this.expandersMap[properties.group].slideToggle();
				} else {
					this.hideAllExpanders();
					this.getItemsInGroup(properties.group).filter('.' + o.cssClass.active).each(function(itemIndex, itemToDeselect) {
						var itemToDeselectProperties = $(itemToDeselect).data('toolbar.item');
						$(this).removeClass(o.cssClass.active);
						if (proceed && $.isFunction(itemToDeselectProperties.toggle)) {
							proceed = (itemToDeselectProperties.toggle.call(this, false) !== false);
						}
					});
					if (proceed) {
						$item.addClass(o.cssClass.active);
					}
				}
				if (proceed) {
					$icon = $item.children('.' + o.cssClass.icon);
					$proxyButton = this.getProxyButtonForGroup(properties.group);
					$proxyButton.children('.' + o.cssClass.icon).attr({
						src: $icon.attr('src'),
						alt: $icon.attr('alt')
					});
					$proxyButton.children('.' + o.cssClass.label).text($item.children('.' + o.cssClass.label).text());
				}
			} else if (properties.toggle) {
				$item.toggleClass(o.cssClass.active);
			}
			if (proceed && $.isFunction(properties.toggle)) {
				proceed = (properties.toggle.call(this, !isActive) !== false);
			}
			if (proceed && $.isFunction(properties.action)) {
				proceed = (properties.action.call(this, !isActive) !== false);
			}
			return proceed;
		},

		/**
		 * Hide all expanders.
		 *
		 * @return This object, for method chaining.
		 */
		hideAllExpanders: function() {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', 'hideAllExpanders()'); }
			this.$toolbar.find('.' + this.options.cssClass.expander).hide();
			return this;
		},


		/**
		 * Generate a unique ID using the given prefix.
		 *
		 * @param prefix String to prepend to the random string to generate the id.
		 *
		 * @return Generated id.
		 */
		_generateUniqueId: function(prefix) {
			return prefix + '_' + (Math.random() * 0xffff);
		},

		/**
		 * Create an item jQuery object.
		 *
		 * @param id
		 * @param properties
		 *
		 * @return jQuery object.
		 */
		_createButtonItem: function(id, group, properties, additionalCssClass) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', '_createButtonItem()', id, group, properties); }
			var self = this, o = this.options;
			return $('<a></a>')
				.attr(o.attributes.item || {})
				.attr(properties.attributes.item || {})
				.attr({
					href: '#',
					title: properties.tooltip || ''
				})
				.addClass(o.cssClass.item || '')
				.addClass(properties.cssClass.item || '')
				.addClass(additionalCssClass)
				.addClass(o.cssClassAdditional.item)
				.append(
					$('<img/>')
						.attr(o.attributes.icon || {})
						.attr(properties.attributes.icon || {})
						.attr({
							src: o.iconSrcPrefix + properties.icon.src,
							alt: properties.icon.alt || o.defaultIconAlt
						})
						.addClass(o.cssClass.icon || '')
						.addClass(properties.cssClass.icon || '')
				)
				.append(
					$('<span></span>')
						.attr(o.attributes.label || {})
						.attr(properties.attributes.label || {})
						.addClass(o.cssClass.label || '')
						.addClass(properties.cssClass.label || '')
						.text(properties.text || '')
				)
				.data('toolbar.item', $.extend(true, {}, properties, {
					id: id,
					group: group
				}))
				.hover(
					function() {
						$(this).addClass(o.cssClass.hover);
					},
					function() {
						$(this).removeClass(o.cssClass.hover);
					}
				)
				.click(function(evt) {
					var $item = $(this);
					setTimeout(function() {
						$item.blur();
					}, 0);
					self.selectItem($item);
					// Prevent default because we have expander buttons inside the expander proxy element.
					// If we don't do this, they both get clicked at the same time when selecting an expander button.
					evt.preventDefault();
					return false;
				});
		},

		/**
		 * Create a separator jQuery object.
		 *
		 * @param id
		 *
		 * @return jQuery object.
		 */
		_createSeparatorItem: function(id) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', '_createSeparatorItem()', id); }
			return $('<span></span>')
				.addClass(this.options.cssClass.item)
				.addClass(this.options.cssClass.itemSeparator)
				.data('toolbar.item', {
					id: id
				});
		},

		/**
		 * Add the given item to the toolbar.
		 *
		 * @param $item
		 * @param position
		 * @param relativeTo
		 *
		 * @return Created wrapper for the item.
		 */
		_addItem: function($item, $target, position, relativeTo) {
			if (__DEBUG__) { console.log('jquery.ui.toolbar', '_addItem()', $item, $target, position, relativeTo); }
			var $wrapper = $('<li></li>').append($item).addClass(this.options.cssClass.wrapper);
			switch (position) {
				case '_first':
					$target.prepend($wrapper);
					break;
				case '_last':
				case undefined:
				case null:
					$target.append($wrapper);
					break;
				case '_before':
					$target = this.getItem(relativeTo);
					if ($target === null) {
						throw 'Error: Cannot position relative to unkown item "' + relativeTo + '" in _addItem()';
					}
					$target.before($wrapper);
					break;
				case '_after':
					$target = this.getItem(relativeTo);
					if ($target === null) {
						throw 'Error: Cannot position relative to unkown item "' + relativeTo + '" in _addItem()';
					}
					$target.after($wrapper);
					break;
				default:
					throw 'Error: Unknown position "' + position + '" in _addItem()';
			}
			return $wrapper;
		},

		/**
		 * Fix the heights of the buttons and separators at the top level, so that they are all equal height
		 * corresponding to the height required by the tallest item.
		 */
		_fixHeight: function() {
			// Don't attempt to fix the height until after the _create() constructor is done.
			if (!this.toolbarInitialised) {
				return;
			}

			if (__DEBUG__) { console.log('jquery.ui.toolbar', '_fixHeight()'); }
			var o = this.options,
				maxButtonHeight = 0,
				$items = this.getAllItems();

			// We need to remove any previously set fixed height to determine the correct largest element.
			$items.css({
				height: 'auto'
			});

			// Iterate through the elements and find the one with greatest natural height.
			$.each($items, function(itemIndex, item) {
				var $item = $(item);
				maxButtonHeight = Math.max(maxButtonHeight, $item.innerHeight() - parseInt($item.css('paddingTop'), 10) - parseInt($item.css('paddingBottom'), 10));
			});

			// Set all buttons to that height.
			$items.css({
				height: maxButtonHeight + 'px'
			});

			// Set all separators to that height.
			this.$toolbar.find('.' + o.cssClass.itemSeparator).css({
				height: maxButtonHeight + 'px'
			});
			return this;
		}
	});
}(jQuery));
