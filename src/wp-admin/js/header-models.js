/* globals jQuery, _wpCustomizeHeaderVars, _wpCustomizeHeaderUploads, _wpCustomizeHeaderDefaults */
;( function( $, wp ) {
	var api = wp.customize;
	api.HeaderTool = {};

	api.HeaderTool.ImageModel = Backbone.Model.extend({

		defaults: function() {
			return {
				header: {
					attachment_id: 0,
					url: '',
					timestamp: Date.now(),
					thumbnail_url: ''
				},
				choice: '',
				hidden: false,
				random: false
			};
		},

		initialize: function() {
			this.on('remove', this.remove, this);
		},

		remove: function() {
			this.set('choice', '');
			api('header_image').set('remove-header');
			api('header_image_data').set('remove-header');
		},

		save: function() {
			if (this.get('random')) {
				api('header_image').set(this.get('header').random);
				api('header_image_data').set(this.get('header').random);
			} else {
				if (this.get('header').defaultName) {
					api('header_image').set(this.get('header').url);
					api('header_image_data').set(this.get('header').defaultName);
				} else {
					api('header_image').set(this.get('header').url);
					api('header_image_data').set(this.get('header'));
				}
			}

			api.HeaderTool.combinedList.trigger('control:setImage', this);
		},

		importImage: function() {
			var data = this.get('header');
			if (data.attachment_id === undefined)
				return;

			data.nonces = { add: _wpCustomizeHeaderVars.nonce };
			$.post(_wpCustomizeSettings.url.ajax, {
				wp_customize: 'on',
				theme: api.settings.theme.stylesheet,
				dataType: 'json',
				action: 'header_add',
				data: data
			});
		},

		shouldBeCropped: function() {
			if ( this.get('themeFlexWidth') === true &&
						this.get('themeFlexHeight') === true )
			{
				return false;
			}

			if ( this.get('themeFlexWidth') === true &&
					 this.get('themeHeight') === this.get('imageHeight') )
			{
				return false;
			}

			if ( this.get('themeFlexHeight') === true &&
					 this.get('themeWidth') === this.get('imageWidth') )
			{
				return false;
			}

			if ( this.get('themeWidth') === this.get('imageWidth') &&
					 this.get('themeHeight') === this.get('imageHeight') )
			{
				return false;
			}

			return true;
		}
	});

	api.HeaderTool.ChoiceList = Backbone.Collection.extend({
		model: api.HeaderTool.ImageModel,

		comparator: function(model) {
			return -model.get('header').timestamp;
		},

		initialize: function() {
			var current = api.HeaderTool.currentHeader.get('choice').replace(/^https?:\/\//, ''),
				isRandom = this.isRandomChoice(api.get().header_image);

			if (!this.type)
				this.type = 'uploaded';

			if (!this.data)
				this.data = _wpCustomizeHeaderUploads;

			if (isRandom) {
				// So that when adding data we don't hide regular images
				current = api.get().header_image;
				// We need a Controls rewrite so that we can just change the
				// model for the current image and have the Views react to
				// that. In the meantime, this is acceptable:
				api.HeaderTool.currentHeader.trigger('setImage', this.randomImageUrl);
			}

			this.on('control:setImage', this.setImage, this);
			this.on('control:removeImage', this.removeImage, this);
			this.on('add', this.maybeAddRandomChoice, this);

			_.each(this.data, function(elt, index) {
				if (!elt.attachment_id)
					elt.defaultName = index;

				this.add({
					header: elt,
					choice: elt.url.split('/').pop(),
					hidden: current == elt.url.replace(/^https?:\/\//, '')
				}, { silent: true });
			}, this);

			if (this.size() > 0)
				this.addRandomChoice(current);
		},

		maybeAddRandomChoice: function() {
			if (this.size() === 1)
				this.addRandomChoice();
		},

		addRandomChoice: function(initialChoice) {
			var isRandomSameType = RegExp(this.type).test(initialChoice),
				randomChoice = 'random-' + this.type + '-image';

			this.add({
				header: {
					timestamp: 0,
					random: randomChoice,
					width: 245,
					height: 41
				},
				choice: randomChoice,
				random: true,
				hidden: isRandomSameType
			});
		},

		isRandomChoice: function(choice) {
			return /^random-(uploaded|default)-image$/.test(choice);
		},

		shouldHideTitle: function() {
			return _.every(this.pluck('hidden'));
		},

		setImage: function(model) {
			this.each(function(m) {
				m.set('hidden', false);
			});

			if (model) {
				model.set('hidden', true);
				// Bump images to top except for special "Random Image" images
				if (!model.get('random')) {
					model.get('header').timestamp = Date.now();
					this.sort();
				}
			}
		},

		removeImage: function() {
			this.each(function(m) {
				m.set('hidden', false);
			});
		},

		shown: function() {
			var filtered = this.where({ hidden: false });
			return new api.HeaderTool.ChoiceList( filtered );
		}
	});

	api.HeaderTool.DefaultsList = api.HeaderTool.ChoiceList.extend({
		initialize: function() {
			this.type = 'default';
			this.data = _wpCustomizeHeaderDefaults;
			api.HeaderTool.ChoiceList.prototype.initialize.apply(this);
		}
	});

})( jQuery, this.wp );
