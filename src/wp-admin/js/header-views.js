/* globals jQuery, _, Backbone, _wpMediaViewsL10n, _wpCustomizeHeader */
;( function( $, wp, _ ) {
	if ( ! wp || ! wp.customize ) { return; }
	var api = wp.customize, frame, CombinedList, UploadsList, DefaultsList;


	/**
	 * wp.customize.HeaderTool.CurrentView
	 *
	 * Displays the currently selected header image, or a placeholder in lack
	 * thereof.
	 *
	 * Instantiate with model wp.customize.HeaderTool.currentHeader.
	 *
	 * @constructor
	 * @augments Backbone.View
	 */
	api.HeaderTool.CurrentView = Backbone.View.extend({
		template: _.template($('#tmpl-header-current').html()),

		initialize: function() {
			this.listenTo(this.model, 'change', this.render);
			this.render();
		},

		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
			this.setPlaceholder();
			this.setButtons();
			return this;
		},

		getHeight: function() {
			var image = this.$el.find('img'),
				saved = this.model.get('savedHeight'),
				height = image.height() || saved;

			if (image.length) {
				this.$el.find('.inner').hide();
			} else {
				this.$el.find('.inner').show();
			}

			// happens at ready
			if (!height) {
				var d = api.get().header_image_data;

				if (d && d.width && d.height) {
					var w = d.width,
						h = d.height;
					// hardcoded container width
					height = 260 / w * h;
				}
				// fallback for when no image is set
				else height = 40;
			}

			return height;
		},

		setPlaceholder: function(_height) {
			var height = _height || this.getHeight();
			this.model.set('savedHeight', height);
			this.$el
				.add(this.$el.find('.placeholder'))
				.height(height);
		},

		setButtons: function() {
			var elements = $('.actions .remove');
			if (this.model.get('choice'))
				elements.show();
			else
				elements.hide();
		}
	});


	/**
	 * wp.customize.HeaderTool.ChoiceView
	 *
	 * Represents a choosable header image, be it user-uploaded,
	 * theme-suggested or a special Randomize choice.
	 *
	 * Takes a wp.customize.HeaderTool.ImageModel.
	 *
	 * Manually changes model wp.customize.HeaderTool.currentHeader via the
	 * `select` method.
	 *
	 * @constructor
	 * @augments Backbone.View
	 */
	(function () { // closures FTW
	var lastHeight = 0;
	api.HeaderTool.ChoiceView = Backbone.View.extend({
		template: _.template($('#tmpl-header-choice').html()),

		className: 'header-view',

		events: {
			'click .choice,.random': 'select',
			'click .close': 'removeImage'
		},

		initialize: function() {
			var properties = [
				this.model.get('header').url,
				this.model.get('choice')
			];

			this.listenTo(this.model, 'change', this.render);
			if (_.contains(properties, api.get().header_image))
				api.HeaderTool.currentHeader.set(this.extendedModel());
		},

		render: function() {
			var model = this.model;

			this.$el.html(this.template(this.extendedModel()));

			if (model.get('random'))
				this.setPlaceholder(40);
			else
				lastHeight = this.getHeight();

			this.$el.toggleClass('hidden', model.get('hidden'));
			return this;
		},

		extendedModel: function() {
			var c = this.model.get('collection'),
				t = _wpCustomizeHeader.l10n[c.type] || '';

			return _.extend(this.model.toJSON(), {
				// -1 to exclude the randomize button
				nImages: c.size() - 1,
				type: t
			});
		},

		getHeight: api.HeaderTool.CurrentView.prototype.getHeight,

		setPlaceholder: api.HeaderTool.CurrentView.prototype.setPlaceholder,

		select: function() {
			this.model.save();
			api.HeaderTool.currentHeader.set(this.extendedModel());
			this.sendStats();
		},

		removeImage: function(e) {
			e.stopPropagation();
			this.model.destroy();
			this.remove();
		},

		sendStats: function() {
			if (this.model.get('random')) {
				Backbone.trigger('custom-header:stat', this.model.get('choice') + '-selected');
				return;
			}

			if (this.model.get('header').defaultName) {
				Backbone.trigger('custom-header:stat', 'default-header-image-selected');
			} else {
				Backbone.trigger('custom-header:stat', 'uploaded-header-image-selected');
			}

		}
	});
	})();


	/**
	 * wp.customize.HeaderTool.ChoiceListView
	 *
	 * A container for ChoiceViews. These choices should be of one same type:
	 * user-uploaded headers or theme-defined ones.
	 *
	 * Takes a wp.customize.HeaderTool.ChoiceList.
	 * 
	 * @constructor
	 * @augments Backbone.View
	 */
	api.HeaderTool.ChoiceListView = Backbone.View.extend({
		slimScrollOptions: {
			disableFadeOut: true,
			allowPageScroll: true,
			height: 'auto'
		},

		initialize: function() {
			this.listenTo(this.collection, 'add', this.addOne);
			this.listenTo(this.collection, 'remove', this.render);
			this.listenTo(this.collection, 'sort', this.render);
			this.listenTo(this.collection, 'change:hidden', this.toggleTitle);
			this.listenTo(this.collection, 'change:hidden', this.setMaxListHeight);
			this.render();
		},

		render: function() {
			this.$el.empty();
			this.collection.each(this.addOne, this);
			this.toggleTitle();
			if (this.$el.parents().hasClass('uploaded')) {
				this.setMaxListHeight();
			}
		},

		setMaxListHeight: function() {
			if (this.$el.parents().hasClass('uploaded')) {
				var uploaded = this.$el.parents('.uploaded'),
					height   = this.maxListHeight();

				uploaded.height(height);
				this.$el.slimScroll(this.slimScrollOptions);
			}
		},

		maxListHeight: function() {
			var shown = this.collection.shown(),
				imgsHeight = shown.reduce( function(memo, img, index) {
					var imgMargin = (shown.length - 1)  === index ? 0 : 9,
						height = (260 / img.get('header').width) * img.get('header').height;

					return memo + height + 5 + imgMargin;
				}, 0);
			return Math.min( Math.ceil(imgsHeight), 180 );
		},

		addOne: function(choice) {
			var view;
			choice.set({ collection: this.collection });
			view = new api.HeaderTool.ChoiceView({ model: choice });
			this.$el.append(view.render().el);
		},

		toggleTitle: function() {
			var title = this.$el.parents().prev('.customize-control-title');
			if (this.collection.shouldHideTitle())
				title.hide();
			else
				title.show();
		}
	});


	/**
	 * wp.customize.HeaderTool.CombinedList
	 *
	 * Aggregates wp.customize.HeaderTool.ChoiceList collections (or any
	 * Backbone object, really) and acts as a bus to feed them events.
	 * 
	 * @constructor
	 * @augments Backbone.View
	 */
	api.HeaderTool.CombinedList = Backbone.View.extend({
		initialize: function(collections) {
			this.collections = collections;
			this.on('all', this.propagate, this);
		},
		propagate: function(event, arg) {
			_.each(this.collections, function(collection) {
				collection.trigger(event, arg);
			});
		},
	});

})( jQuery, this.wp, _ );
