/* globals jQuery, _, Backbone, _wpMediaViewsL10n, _wpCustomizeHeaderL10n */
;( function( $, wp, _ ) {
	if ( ! wp || ! wp.customize ) { return; }
	var api = wp.customize, frame, CombinedList, UploadsList, DefaultsList;
	api.HeaderTool.currentImage = {};

	/* Customizer Controls */


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


	(function () { // closures FTW
	var lastHeight = 0;
	api.HeaderTool.ChoiceView = Backbone.View.extend({
		template: _.template($('#tmpl-header-choice').html()),

		events: {
			'click': 'select'
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
			this.$el.html(this.template(this.extendedModel()));

			if (this.model.get('random'))
				this.setPlaceholder(40);
			else
				lastHeight = this.getHeight();

			this.$el.toggleClass('hidden', this.model.get('hidden'));
			return this;
		},

		extendedModel: function() {
			var c = this.model.get('collection'),
				t = _wpCustomizeHeaderL10n[c.type] || '';

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


	api.HeaderTool.ChoiceListView = Backbone.View.extend({
		slimScrollOptions: {
			disableFadeOut: true,
			allowPageScroll: true,
			height: 'auto'
		},

		initialize: function() {
			this.listenTo(this.collection, 'add', this.addOne);
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
						var imgMargin = ( shown.length - 1)  === index ? 0 : 9,
								height = ( 260 / img.get('header').width ) * img.get('header').height;

						return memo + height + 5 + imgMargin;
					}, 0);
			return Math.min( Math.ceil( imgsHeight ), 180 );
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

	// we'll need to rework these names, eh
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
