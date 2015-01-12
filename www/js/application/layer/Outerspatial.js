lvector.Outerspatial = lvector.GeoJSONLayer.extend({
    initialize: function(options) {

        // Check for required parameters
        for (var i = 0, len = this._requiredParams.length; i < len; i++) {
            if (!options[this._requiredParams[i]]) {
                throw new Error("No \"" + this._requiredParams[i] + "\" parameter found.");
            }
        }

        // Extend Layer
        lvector.Layer.prototype.initialize.call(this, options);

        // Create an array to hold the features
        this._vectors = [];

        this._organizations = [];

        this._rendered_organizations = [];

        if (this.options.map) {
            if (this.options.scaleRange && this.options.scaleRange instanceof Array && this.options.scaleRange.length === 2) {
                var z = this.options.map.getZoom();
                var sr = this.options.scaleRange;
                this.options.visibleAtScale = (z >= sr[0] && z <= sr[1]);
            }
            this._show();
        }
    },

    options: {
        limit: null,
        uniqueField: null,
        pageSize: null
    },

    setOrganizations: function(organizations) {
        this._organizations = organizations;
    },

    setGeoJsonProvider: function(provider) {
        this._geoJsonProvider = provider;
    },

    _requiredParams: ["url"],

    _getFeatures: function() {
        if (!this.options.showAll) {
            var bounds = this.options.map.getBounds();
            for (var i = this._organizations.length - 1; i >= 0; i--) {
                var org = this._organizations[i];
                var orgBounds = org.getBounds();
                if (!_.contains(this._rendered_organizations,org) && (bounds.contains(orgBounds) || bounds.intersects(orgBounds))) {
                    this._rendered_organizations.push(org);
                    self = this;
                    this._geoJsonProvider(null, 'GeoJson', org.get('optimized_trail_segments_url'), function(data){
                        var dataLayer = L.geoJson(data, {
                            onEachFeature: function(feature, layer) {
                                layer.setStyle({
                                    weight: 3,
                                    color: "#ed8d2d",
                                    opacity: 1
                                });
                            }
                        }).addTo(self.options.map);
                    });
                }
            };
        }
    },



});
