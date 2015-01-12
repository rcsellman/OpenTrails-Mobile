(function (ng) {
  'use strict';

  //
  // CONFIGURATION
  //

  var LOCALHOST = "http://localhost:3000";
  var STAGING = "http://staging.outerspatial.com";
  var PRODUCTION = "http://www.outerspatial.com";
  var BASE_ENDPOINT = PRODUCTION + '/api/v0/applications/1';
  var Configuration = {
    MIN_ZOOM_LEVEL: 1,
    MAX_ZOOM_LEVEL: 18,
    MAX_BOUNDS: [[41.838746, -82.276611],[40.456287,-81.035156]],
    DEFAULT_ZOOM_LEVEL: 3,
    // Center of the United States
    DEFAULT_MAP_CENTER: [ 39.8282, -98.5795 ],
    SELECTED_TRAILHEAD_ZINDEX_OFFSET: 9000,

    MAX_SIMILTANEOUS_DOWNLOADS: 3,
    // Ohio
    // DEFAULT_MAP_CENTER: [ 41.082020, -81.518506 ],
    // Boulder
    // DEFAULT_MAP_CENTER: [ 40.0293099,-105.2399774 ],
    TRAIL_DATA_ENDPOINT: BASE_ENDPOINT + '/cached_trails_csv',
    TRAILHEAD_DATA_ENDPOINT: BASE_ENDPOINT + "/cached_trailheads",
    TRAILSEGMENT_API_ENDPOINT: BASE_ENDPOINT + "/trail_segments",
    TRAILSEGMENT_DATA_ENDPOINT: BASE_ENDPOINT + "/cached_trail_segments",
    STEWARD_DATA_ENDPOINT: BASE_ENDPOINT + "/cached_stewards_csv",
    STEWARD_DETAIL_ENDPOINT: BASE_ENDPOINT + "/organizations",
    NOTIFICATION_DATA_ENDPOINT: BASE_ENDPOINT + "/notifications?per_page=200",
    PHOTO_DATA_ENDPOINT: BASE_ENDPOINT + "/images?per_page=200",
    TERRAIN_MAP_TILE_ENDPOINT: "trailheadlabs.b9b3498e",
    SATELLITE_MAP_TILE_ENDPOINT: "trailheadlabs.jih1cig0",
    TRAILSEGMENT_MAP_TILE_ENDPOINT: "trailheadlabs.ad9272f9",
    MAPBOX_ACCESS_TOKEN: "pk.eyJ1IjoidHJhaWxoZWFkbGFicyIsImEiOiJnNDFLZ1Q4In0.t7YwoIwtzS_ghFsx8gU62A",
    ATTRIBUTION: "<a href='https://www.mapbox.com/about/maps/' target='_system'>Maps &copy; Mapbox &copy; OpenStreetMap</a>"
  };

  //
  // MODEL DEFINITION
  //

  function Model (attrs) {
    this.attributes = {};
    if ( ng.isObject(attrs) ) {
      for (var key in this.defaults) {
        if (this.defaults.hasOwnProperty(key))
          this.attributes[key] = attrs[key] || this.defaults[key];
      }
    } else {
      this.attributes = utils.defaults(this.attributes, this.defaults);
    }
    this.initialize.apply(this, arguments);
  }

  ng.extend(Model.prototype, {
    initialize: ng.noop,
    attributes: {},
    set: function (attrs) {
      for (var key in attrs) {
        if ( utils.has(this.defaults, key) ) this.attributes[key] = attrs[key];
      }
      return attrs;
    },
    get: function (attr) {
      return this.attributes[attr];
    },
  });

  Model.inherit = utils.inherit;


  //
  // QUERY MODEL
  //
  function Query () {
    this.initialize.apply(this, arguments);
    this.identity_map = {};  //  used for faster access
  }

  Query.EVALUATORS = {
    "equals": function (lhs, rhs) {
      return lhs === rhs;
    },
    "doesNotEqual": function (lhs, rhs) {
      return lhs !== rhs;
    },
    "contains": function (lhs, rhs) {
      if ( ng.isString(lhs) && ng.isString(rhs) ) {
        lhs = lhs.toLowerCase();
        rhs = rhs.toLowerCase();
        return lhs.indexOf(rhs) !== -1;
      } else {
        return false;
      }
    },
    "doesNotContain": function (lhs, rhs) {
      if ( ng.isString(lhs) && ng.isString(rhs) ) {
        lhs = lhs.toLowerCase();
        rhs = rhs.toLowerCase();
        return lhs.indexOf(rhs) === -1;
      } else {
        return false;
      }
    },
    "includes": function (lhs, rhs) {
      if ( ng.isArray(lhs) ) {
        return lhs.indexOf(rhs) !== -1;
      } else {
        return false;
      }
    },
    "intersects": function (lhs, rhs) {
      var ai=0, bi=0;
      while( ai < lhs.length && bi < rhs.length ) {
        if ( lhs[ai] < rhs[bi] ) { 
          ai++; } else if ( lhs[ai] > rhs[bi] ) { 
          bi++; 
        } else { 
          return true; 
        }   
      }    
      return false; 
    },
    "doesNotInclude": function (lhs, rhs) {
      if ( ng.isArray(lhs) ) {
        return lhs.indexOf(rhs) === -1;
      } else {
        return false;
      }
    },
    "in": function (lhs, rhs) {
      if ( ng.isArray(rhs) ) {
        return rhs.indexOf(lhs) !== -1;
      }
    },
    "notIn": function (lhs, rhs) {
      if ( ng.isArray(rhs) ) {
        return rhs.indexOf(lhs) === -1;
      }
    }
  };

  Query.findEvaluator = function (id) {
    return Query.EVALUATORS[id] || ng.noop;
  };

  Query.perform = function (record, param) {
    var evaluator = Query.findEvaluator(param.evaluator),
        lhs = record.get(param.key),
        rhs = param.value;

    return !!evaluator(lhs, rhs);
  };

  Query.prototype.initialize = function (collection) {
    this.setCollection(collection);
  };

  Query.prototype.setCollection = function (collection) {
    if (!ng.isArray(collection)) collection = [];
    this.collection = collection;
  };

  Query.prototype.where = function (params) {
    var results = [];

    if ( !ng.isArray(params) ) params = [ params ];

    ng.forEach(this.collection, function (record) {
      ng.forEach(params, function (param) {
        if ( Query.perform(record, param) ) results.push(record);
      });
    });

    return new Query(results);
  };

  Query.prototype.find = function (params) {
    return this.where(params).first();
  };

  Query.prototype.sort = function (func) {
    return new Query(this.collection.sort(func));
  };

  Query.prototype.sortBy = function (attr, dir) {
    var ASC = 'ASC';
    var DESC = 'DESC';

    var results = this.collection.sort(function (a,b) {
      if (dir === ASC) {
        return a.get(attr) > b.get(attr);
      } else if (dir === DESC) {
        return a.get(attr) < b.get(attr);
      } else {
        return true;
      }
    });

    return new Query(results);
  };

  Query.prototype.groupBy = function (obj) {
    var results = {};
    ng.forEach(this.collection, function (record) {
      var value;

      if ( ng.isString(obj) ) {
        value = record.get(obj);
      } else if ( ng.isFunction(obj) ) {
        value = obj.call(record, record);
      } else {
        return false;
      }

      results[value] = results[value] || [];
      results[value].push(record);
    });

    return results;
  };

  Query.prototype.first = function () {
    return this.collection[0];
  };

  Query.prototype.last = function () {
    return this.collection[this.collection.length - 1];
  };

  Query.prototype.all = function () {
    return this.collection;
  };

  Query.prototype.count = function () {
    return this.collection.length;
  };

  Query.prototype.each = function (f) {
    return ng.forEach(this.collection, f);
  };

  Query.prototype.map = function (f) {
    return utils.map(this.collection, f);
  };

  //
  // TRAILSEARCH
  //

  function TrailSearch () {
  }

  TrailSearch.perform = function (params) {
    var nameQuery = [];
    var descQuery = [];

    params = params || {};

    if (params.keywords) {
      nameQuery.push({ key: 'name', evaluator: 'contains', value: params.keywords });
      descQuery.push({ key: 'descriptn', evaluator: 'contains', value: params.keywords });
    }

    var trailheads = [];

    trailheads = trailheads.concat( TrailHead.query.where(nameQuery) );
    trailheads = trailheads.concat( TrailHead.query.where(descQuery) );

    var results = TrailHead.query.map(function (trailhead) {
      var trails;

      if (trailheads.indexOf(trailhead) === -1 &&
        (nameQuery.length > 0 || descQuery.length > 0)) {
        var trails = trailhead.cachedTrails().filter(function(trail) {
          if (
            Query.EVALUATORS.contains(trail.get('name'), params.keywords) ||
            Query.EVALUATORS.contains(trail.get('descriptn'), params.keywords)
            )
            return true;
          else
            return false;
        });

        trails = utils.unique(trails);
      } else {
        trails = trailhead.cachedTrails();
      }
      if (params.filters) {
        var filteredTrails = [];
        ng.forEach(trails,function(trail){
          // Use bitwise AND operator to compare the currently toggled filters to
          // those in the trail. If trail values are within the filters' values,
          // there will be no change in the filters bitmap.
          if ((params.filters.filterBitmap & trail.filterBitmap()) === params.filters.filterBitmap)
            filteredTrails.push(trail);
        });
        trails = filteredTrails;
      }
      if (trails.length > 0) {
        return new SearchResult(trailhead, trails);
      }
    });


    results = utils.compact(results);

    if (params.position) {
      results = results.sort(function (a,b) {
        return a.distanceFrom(params.position) - b.distanceFrom(params.position);
      });
    }

    var uniqueTrails = [];
    var filteredResults  = [];

    ng.forEach(results, function (result) {
      var resultTrails = [];

      ng.forEach(result.trails, function (trail) {
        if (uniqueTrails.indexOf(trail) === -1) {
          uniqueTrails.push(trail);
          resultTrails.push(trail);
        }
      });

      if (resultTrails.length > 0) {
        result.trails = resultTrails;
        filteredResults.push(result);
      }
    });

    return filteredResults;
  };

  //
  // SEARCHRESULT MODEL
  //

  function SearchResult (trailhead, trails) {
    this.trailhead = trailhead;
    this.trails = trails;
  }

  SearchResult.prototype.distanceFrom = function (position) {
    var dist;

    if (this.trailhead) {
      dist = this.trailhead.distanceFrom(position.get('latitude'), position.get('longitude'));
    } else {
      dist = 0;
    }

    return dist;
  };

  //
  // ASSOCIATION MODEL
  //

  var Association = Model.inherit({

    defaults: {
      primary: null,
      foreign: null,
      scope: null
    },

    where: function () {
      return this.perform('where', arguments);
    },

    find: function () {
      return this.perform('find', arguments);
    },

    sort: function () {
      return this.perform('sort', arguments);
    },

    sortBy: function () {
      return this.perform('sortBy', arguments);
    },

    first: function () {
      return this.perform('first', arguments);
    },

    last: function () {
      return this.perform('last', arguments);
    },

    all: function () {
      return this.perform('all', arguments);
    },

    count: function () {
      return this.perform('count', arguments);
    },

    map: function () {
      return this.perform('map', arguments);
    },

    each: function () {
      return this.perform('each', arguments);
    },

    toQuery: function () {
      var foreign = this.get('foreign'),
      scope = this.get('scope');
      return foreign.query.where(scope);
    },

    perform: function (name, args) {
      var query = this.toQuery();
      return query[name].apply(query, args);
    }

  });

  //
  // TRAIL MODEL
  //

  var Trail = Model.inherit({

    defaults: {
      "id": null,
      "name": null,
      "segment_ids": null,
      "segment_map": null,
      "description": null,
      "part_of": null
    },

    initialize: function () {

      this.trailSegments = new Association({
        primary: this,
        foreign: TrailSegment,
        scope: {
          key: 'id',
          evaluator: 'in',
          value: this.get('segment_ids')
        }
      });

      this.photos = new Association({
        primary: this,
        foreign: Photo,
        scope: {
          key: 'trail_ids',
          evaluator: 'includes',
          value: this.get('id')
        }
      });
    },

    getLength: function () {
      var total = 0;
      var ts;
      ng.forEach(this.get('segment_ids'), function (ts_id) {
        ts = TrailSegment.query.identity_map[ts_id];
        total = total + ts.getLength();
      });
      return total;
    },

    canFoot: function () {
      var result = this._canFoot;
      if (!result) {
        result = true;
        var ts;
        ng.forEach(this.get('segment_ids'), function (ts_id) {
          ts = TrailSegment.query.identity_map[ts_id];
          if ( !ts.canFoot() ) {
            result = false;
            return result;
          }
        });
      }
      return result;
    },

    canBicycle: function () {
      var result = this._canBicycle;
      if (!result) {
        result = true;
        var ts;
        ng.forEach(this.get('segment_ids'), function (ts_id) {
          ts = TrailSegment.query.identity_map[ts_id];
          if ( !ts.canBicycle() ) {
            result = false;
            return result;
          }
        });
      }
      return result;
    },

    canHorse: function () {
      var result = this._canHorse;
      if (!result) {
        result = true;
        var ts;
        ng.forEach(this.get('segment_ids'), function (ts_id) {
          ts = TrailSegment.query.identity_map[ts_id];
          if ( !ts.canHorse() ) {
            result = false;
            return result;
          }
        });
      }
      return result;
    },

    canSki: function () {
      var result = this._canSki;
      if (!result) {
        result = true;
        var ts;
        ng.forEach(this.get('segment_ids'), function (ts_id) {
          ts = TrailSegment.query.identity_map[ts_id];
          if ( !ts.canSki() ) {
            result = false;
            return result;
          }
        });
      }
      return result;
    },

    canWheelChair: function () {
      var result = this._canWheelChair;
      if (!result) {
        result = true;
        var ts;
        ng.forEach(this.get('segment_ids'), function (ts_id) {
          ts = TrailSegment.query.identity_map[ts_id];
          if ( !ts.canWheelChair() ) {
            result = false;
            return result;
          }
        });
      }
      return result;
    },

    _bitmap : null,

    filterBitmap : function () {
      if (!this._bitmap) {
        this._bitmap = this.canFoot()    ? this._bitmap |= 1 : this._bitmap;
        this._bitmap = this.canBicycle() ? this._bitmap |= 2 : this._bitmap;
        this._bitmap = this.canHorse()   ? this._bitmap |= 4 : this._bitmap;
        this._bitmap = this.canSki()     ? this._bitmap |= 8 : this._bitmap;
      }
      return this._bitmap;
    },

    toGeoJson: function () {
      var features = this.trailSegments.map(function (trailSegment) {
        return trailSegment.toGeoJson();
      });
      return {
        "type": "FeatureCollection",
        "features": features
      };
    }

  }, {

    query: new Query(),

    load: function (data) {
      var results = this.query.collection || [];
      var identity_map = this.query.identity_map || {};
      if (data) {
        ng.forEach(data, function (trail) {
          if(trail.outerspatial_id){
            trail.id = trail.outerspatial_id;
            trail.segment_ids = trail.outerspatial_segment_ids.split(';');
          } else {
            trail.segment_ids = trail.segment_ids.split(';')
          }
          if (trail.segment_ids.length) {
            var t = new Trail(trail);
            results.push( t );
            //  create a map so that a trail can be quickly accessed by segment_id
            ng.forEach(trail.segment_ids, function (id) {
              if (!identity_map[id])
                identity_map[id] = [];
              identity_map[id].push(t);
            });
          }
        });
      }
      this.query.setCollection(results);
      this.loaded = true;
    }

  });

  //
  // TRAILHEAD MODEL
  //

  var TrailHead = Model.inherit({

    defaults: {
      "id": null,
      "name": null,
      "segment_ids": null,
      "steward_id": null,
      "address": null,
      "parking": null,
      "kiosk": null,
      "restroom": null,
      "geometry": null,
      "_trails": null
    },

    initialize: function () {

      this.trailSegments = new Association({
        primary: this,
        foreign: TrailSegment,
        scope: {
          key: 'id',
          evaluator: 'in',
          value: this.get('segment_ids')
        }
      });

      this.trails = new Association({
        primary: this,
        foreign: Trail,
        scope: {
          key: 'segment_ids',
          evaluator: 'intersects',
          value: this.get('segment_ids')
        }
      });


      this.stewards = new Association({
        primary: this,
        foreign: Steward,
        scope: {
          key: 'id',
          evaluator: 'equals',
          value: this.get('steward_id')
        }
      });

    },
    
    // Since there is no direct association between trails and trailheads, 
    // cache the association to avoid searching for mutual segment_ids every time.
    cachedTrails: function() {
      if (!this._trails) {
        var _trails = [];
        ng.forEach(this.get('segment_ids'), function (id) {            
            if ( Trail.query.identity_map[id] ) 
              _trails = _trails.concat(Trail.query.identity_map[id]);
        });
        this._trails = utils.unique(_trails);
      }
      return this._trails;
    },

    hasWater: function () {
      return (this.get('water') || '').toLowerCase() === 'yes';
    },

    hasParking: function () {
      return (this.get('parking') || '').toLowerCase() === 'yes';
    },

    hasKiosk: function () {
      return (this.get('kiosk') || '').toLowerCase() === 'yes';
    },

    hasRestroom: function () {
      return (this.get('restroom') || '').toLowerCase() === 'yes';
    },

    distanceFrom: function (lat, lng) {
      return utils.haversine(this.getLat(), this.getLng(), lat, lng);
    },

    getLat: function () {
      var geom = this.get('geometry');
      if (geom && geom.coordinates) return geom.coordinates[1];
    },

    getLng: function () {
      var geom = this.get('geometry');
      if (geom && geom.coordinates) return geom.coordinates[0];
    },

    getLatLng: function () {
      return [ this.getLat(), this.getLng() ];
    },

    toPosition: function () {
      return new Position({latitude: this.getLat(), longitude: this.getLng() });
    },

    toGeoJson: function () {
      var properties = utils.without(this.attributes, ['geometry']);
      var geometry = this.get('geometry');

      return {
        "type": 'Feature',
        "properties": properties,
        "geometry": geometry
      };
    }
  }, {

    query: new Query(),

    load: function (data) {
      var results = this.query.collection || [];

      if (data.features) {
        ng.forEach(data.features, function (feature) {
          feature.properties.geometry = feature.geometry;
          if(feature.properties.outerspatial){
            feature.properties.id = feature.properties.outerspatial.id;
            feature.properties.steward_id = feature.properties.outerspatial.steward_id;
            feature.properties.segment_ids = feature.properties.outerspatial.segment_ids;
          }
          results.push( new TrailHead( feature.properties ) );
        });
      }

      this.query.setCollection(results);
      this.loaded = true;
    }

  });

  //
  // TRAILSEGMENT MODEL
  //

  var TrailSegment = Model.inherit({

    defaults: {
      "id": null,
      "name": null,
      "steward_id": null,
      "highway": null,
      "motor_vehicles": null,
      "foot": null,
      "bicycle": null,
      "horse": null,
      "ski": null,
      "wheel_chair": null,
      "osm_tags": null,
      "geometry": null
    },

    initialize: function () {
      this.trails = new Association({
        primary: this,
        foreign: Trail,
        scope: {
          key: 'segment_ids',
          evaluator: 'includes',
          value: this.get('id')
        }
      });

      this.trailHeads = new Association({
        primary: this,
        foreign: TrailHead,
        scope: {
          key: 'segment_ids',
          evaluator: 'includes',
          value: this.get('id')
        }
      });

    },

    getLength: function () {
      var geom = this.get('geometry');

      function calc (obj, total) {

        for (var i = 0; i < obj.length; i++) {
          if ( ng.isArray(obj[i][0]) ) {
            total = calc(obj[i], total);
          } else {
            var j = i + 1;

            if (j === obj.length) break;

            var a = obj[i];
            var b = obj[j];
            var dist = utils.haversine(a[1], a[0], b[1], b[0]);

            total = total + dist;
          }
        }

        return total;
      }

      return calc(geom.coordinates, 0);
    },

    canFoot: function () {
      return (this.get('foot') || '').toLowerCase() === 'yes';
    },

    canBicycle: function () {
      return (this.get('bicycle') || '').toLowerCase() === 'yes';
    },

    canHorse: function () {
      return (this.get('horse') || '').toLowerCase() === 'yes';
    },

    canSki: function () {
      return (this.get('ski') || '').toLowerCase() === 'yes';
    },

    canWheelChair: function () {
      return (this.get('wheelchair') || '').toLowerCase() === 'yes';
    },

    toGeoJson: function () {
      var properties = utils.without(this.attributes, ['geometry']);
      var geometry = this.get('geometry');

      return {
        "type": 'Feature',
        "properties": properties,
        "geometry": geometry
      };
    }

  }, {

    query: new Query(),

    load: function (data) {
      var results = this.query.collection || [];
      var identity_map = this.query.identity_map || {};

      if (data.features) {

        ng.forEach(data.features, function (feature) {
          if(feature.properties.outerspatial){
            feature.properties.id = feature.properties.outerspatial.id;
            feature.properties.steward_id = feature.properties.outerspatial.steward_id;
          }

          feature.properties.geometry = feature.geometry;
          var trailSegment = new TrailSegment(feature.properties);
          results.push( trailSegment );
          identity_map[feature.properties.id] = trailSegment;
        });
      }
    }
  });

  //
  // PHOTO MODEL
  //

  var Photo = Model.inherit({

    defaults: {
      "id": null,
      "trail_ids": null,
      "url": null
    },

    initialize: function () {

      this.trails = new Association({
        primary: this,
        foreign: Trail,
        scope: {
          key: 'id',
          evaluator: 'in',
          value: this.get('trail_ids')
        }
      });

    }

  },
  {
    query: new Query(),

    load: function (data) {
      var results = this.query.collection || [];

      if (data.length) {
        ng.forEach(data, function (photo) {
          results.push( new Photo(photo) );
        });
      }

      this.query.setCollection(results);
      this.loaded = true;
    }
  });

  //
  // STEWARD MODEL
  //

  var Steward = Model.inherit({

    defaults: {
      "id": null,
      "name": null,
      "url": null,
      "phone": null,
      "address": null
    },

    initialize: function () {
      this.trailHeads = new Association({
        primary: this,
        foreign: TrailHead,
        scope: {
          key: 'steward_id',
          evaluator: 'equals',
          value: this.get('id')
        }
      });

      this.notifications = new Association({
        primary: this,
        foreign: Notification,
        scope: {
          key: 'source_id',
          evaluator: 'equals',
          value: this.get('id')
        }
      });
    }

  }, {

    query: new Query(),

    load: function (data) {
      var results = this.query.collection || [];

      if (data.length) {
        ng.forEach(data, function (steward) {
          if(steward.outerspatial_id){
            steward.id = steward.outerspatial_id;
          }
          results.push( new Steward(steward) );
        });
      }

      this.query.setCollection(results);
      this.loaded = true;
    }

  });

 var StewardDetail = Model.inherit({

    defaults: {
      "id": null,
      "optimized_trail_segments_url": null,
      "extent": null,
      "offline_tiles": null,
      "offline_tiles_status": null,
      "offline_tiles_progress": null,
      "low_size": null,
      "high_size": null
    },
    getBounds: function() {
      var coor = this.get('extent').coordinates[0];
      var southWest = L.latLng(coor[2][1], coor[2][0]), northEast = L.latLng(coor[0][1], coor[0][0]);
      return L.latLngBounds(southWest, northEast);
    },
    getOfflineTileJson: function(onSuccess) {
      var base_dir_name = 'tiles-' + this.get('id');
      window.resolveLocalFileSystemURL(cordova.file.dataDirectory + base_dir_name,
        function(dir) {
          dir.getFile('layer.json', {exclusive: false}, function (fileEntry) {
            fileEntry.file(function(file) {
              var reader = new FileReader();
              reader.onloadend = function(e) {
                onSuccess(JSON.parse(this.result));
              }
              reader.readAsText(file);
            });
          }, function (err) {alert(err)});
        },
        function(err) {
        }
      );  
    },
    deleteTiles: function(onSuccess) {
      var base_dir_name = 'tiles-' + this.get('id');
      window.resolveLocalFileSystemURL(cordova.file.dataDirectory + base_dir_name,
        function(dir) {
          dir.removeRecursively( function() {
            onSuccess();
          }, 
          function() { 
            alert("Error deleting!"); 
          });
        },
        function(err) {
        }
      );      
    },
    downloadTiles: function(size, onProgress) {    
      this.set( {offline_tiles_status: 'loading'} );
      var urls = [];
      var base_dir, level, tile, url, pending = 0, total, completed = 0;
      var offline_tiles = this.get('offline_tiles');
      var base_dir_name = 'tiles-' + this.get('id');
      var template = L.Browser.retina ? offline_tiles.url_template.replace('{y}', '{y}@2x') : offline_tiles.url_template;

      window.resolveLocalFileSystemURL(cordova.file.dataDirectory,
        function(dir) {
          dir.getDirectory(base_dir_name, {create:true, exclusive: false} ,function(dir){
            onResolveDirectory(dir);
          });
        },
        function(err) {
        }
      );  

      function onResolveDirectory(dir) {
        var max_zoom = 0;
        for(var i = 0; i < offline_tiles.zoom_levels.length; i++) {
          level = offline_tiles.zoom_levels[i];
          max_zoom = level.z > max_zoom ? level.z : max_zoom;
          if (level.z >= 15 && size === 'low')
            continue;
          for(var j = 0; j < level.tiles.length; j++) {
            tile = level.tiles[j];

            url = offline_tiles.url_template.replace('{z}/{x}/{y}', [level.z,'/',tile[0],'/',tile[1]].join(''));
            urls.push(url);
          }
        }
        total = urls.length;

        var tileJSON = {
          "tilejson": "2.0.0",
          "scheme": "xyz",
          "tiles": [
                dir.toURL() + '{z}.{x}.{y}.png'
          ],
          "maxzoom": 14
        }
        dir.getFile('layer.json', {create: true, exclusive: false}, function (file) {
          file.createWriter(function (writer) {
            writer.onwriteend = function (evt) {
            };
            writer.write(JSON.stringify(tileJSON));
          }, function (err) {alert(err)});
        }, function (err) {alert(err)});

        for (var i = Configuration.MAX_SIMILTANEOUS_DOWNLOADS - 1; i >= 0; i--) {
          downloadTile(urls, dir);
        };
      }

      function downloadTile(urls, dir) {
        var url = urls.pop();
        if (!url)
          return;
        pending++;
        var fname = url.split('/').slice(-3).join('.');   
        dir.getFile(fname, {create:true, exclusive: false} ,function(file){
            var fileTransfer = new FileTransfer();
            fileTransfer.download(url, file.toURL(), 
                function(theFile) { 
                      pending--;
                      completed++;
                      onProgress(completed * 100.0 / total);
                      downloadTile(urls, dir);
                },
                function(error) { 
                    alert("download error code: " + error.code); 
                }
            );    
        },
        function(error) { 
          alert(" error code: " + error.code); 
        });
      }
        
    }


  }, {

    query: new Query(),

    load: function (data) {
      var results = this.query.collection || [];
      var low_size = 0;
      var high_size = 0;
      var stewardDetail = new StewardDetail(data);
      var base_dir_name = 'tiles-' + stewardDetail.get('id');
      var size_key = L.Browser.retina ? 'retina_kilobytes' : 'kilobytes';

      ng.forEach(stewardDetail.get('offline_tiles').zoom_levels, function (level) {
        var size = level[size_key];
        if (level.z < 15) {
          low_size += size;
          high_size += size;
        }
        else
          high_size += size;
      });

      stewardDetail.set( {low_size: utils.bytesToSize(low_size * 1000), high_size: utils.bytesToSize(high_size * 1000)} );

      window.resolveLocalFileSystemURL(cordova.file.dataDirectory + base_dir_name,
        function(dir) {
          stewardDetail.set( {offline_tiles_status: 'loaded'} );
        },
        function(err) {
          stewardDetail.set( {offline_tiles_status: 'empty'} );
        }
      );      
      results.push( stewardDetail );

      this.query.setCollection(results);

    }

  });
  //
  // NOTIFICATION MODEL
  //

  var Notification = Model.inherit({
    defaults: {
      "id": null,
      "title": null,
      "body": null,
      "source_id": null,
      "level": null,
      "created_at": null,
      "read": false,
      "deleted": false
    },

    markAsRead: function () {
      this.set({ read: true });
      return this;
    },

    markAsUnread: function () {
      this.set({ read: false });
      return this;
    },

    isRead: function () {
      return this.get('read');
    },

    isUnread: function () {
      return !this.isRead();
    },

    markAsDeleted: function () {
      this.set({ deleted: true });
      return this;
    },

    markAsUndeleted: function () {
      this.set({ deleted: false });
      return this;
    },

    isDeleted: function () {
      return this.get('deleted');
    },

    isUndeleted: function () {
      return !this.isDeleted();
    },

    getCreatedAt: function () {
      // Return the creation date as a timestamp
      // so view can format it per https://docs.angularjs.org/api/ng/filter/date#example
      return new Date(this.get('created_at')).getTime();
    }

  }, {

    query: new Query(),

    load: function (data) {
      var results = this.query.collection || [];

      if (data.length) {
        ng.forEach(data, function (notification) {
          notification.source_id = notification.source.id;
          results.push( new Notification(notification) );
        });
      }

      this.query.setCollection(results);
      this.loaded = true;
    }

  });

  //
  // POSITION MODEL
  //

  var Position = Model.inherit({

    defaults: {
      latitude: null,
      longitude: null
    },

    distanceFrom: function (position) {
      return utils.haversine(this, position);
    },

    toArray: function () {
      return [this.get('latitude'),this.get('longitude')];
    }

  });

  //
  // GEOPOSITION MODEL
  //

  var GeoPosition = Model.inherit({

    defaults: {
      accuracy: null,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: null,
      longitude: null,
      speed: null
    },

    getLatLng: function () {
      return [ this.get('latitude'), this.get('longitude') ];
    }

  });

  //
  // MAP MODEL
  //

  var Map = Model.inherit({

    DEFAULT_ZOOM: Configuration.DEFAULT_ZOOM_LEVEL,

    DEFAULT_CENTER: Configuration.DEFAULT_MAP_CENTER,

    defaults: {
      el: 'map-container',
      options: {
        "zoomControl": false,
        "detectRetina": true,
        "attributionControl": false,
        "minZoom": Configuration.MIN_ZOOM_LEVEL,
        "maxZoom": Configuration.MAX_ZOOM_LEVEL
      }
    },

    initialize: function () {
      L.mapbox.accessToken = Configuration.MAPBOX_ACCESS_TOKEN;
      this.delegate = L.mapbox.map( this.get('el'), null, this.get('options') );
      var attribution = L.control.attribution().addTo(this.delegate);
      attribution.setPrefix('');
      attribution.addAttribution(Configuration.ATTRIBUTION);
    },

    setView: function (position, zoom) {
      this.delegate.setView(position, zoom);
      return this;
    },

    panTo: function (position) {
      this.delegate.panTo(position);
      return this;
    },

    getZoom: function () {
      return this.delegate.getZoom();
    },

    getCenter: function () {
      return this.delegate.getCenter();
    },

    addLayer: function (layer) {
      this.delegate.addLayer(layer.delegate);
      return this;
    },

    hasLayer: function (layer) {
      this.delegate.hasLayer(layer.delegate);
      return this;
    },

    removeLayer: function (layer) {
      this.delegate.removeLayer(layer.delegate);
      return this;
    },

    on: function (e, f) {
      this.delegate.on(e, f);
      return this;
    },

    off: function (e, f) {
      this.delegate.off(e, f);
      return this;
    },

    trigger: function (e) {
      this.delegate.trigger(e);
      return this;
    },

    fitBounds: function (bounds, options) {
      this.delegate.fitBounds(bounds, options);
      return this;
    }

  });

  //
  // MAPLAYER MODEL
  //

  var MapLayer = Model.inherit({

    defaults: {
      options: {}
    },

    initialize: function () {
      this.delegate = undefined;
    },

    on: function (e,f) {
      this.delegate.on(e, f);
      return this;
    },

    off: function (e,f) {
      this.delegate.off(e, f);
      return this;
    },

    trigger: function (e) {
      this.delegate.trigger(e);
      return this;
    },

    bringToFront: function () {
      this.delegate.bringToFront();
      return this;
    },

    bringToBack: function () {
      this.delegate.bringToBack();
      return this;
    },

    addTo: function (map) {
      map.addLayer(this);
      return this;
    },

    removeFrom: function (map) {
      map.removeLayer(this);
      return this;
    },

    setOpacity: function (n) {
      this.delegate.setOpacity(n);
      return this;
    },

    getBounds: function () {
      return this.delegate.getBounds();
    }

  });

  //
  // MAPTILELAYER MODEL
  //

  var TILE_LAYERS = {
    "terrain": {
      name: "Terrain",
      url: Configuration.TERRAIN_MAP_TILE_ENDPOINT
    },
    "satellite": {
      name: "Satellite",
      url: Configuration.SATELLITE_MAP_TILE_ENDPOINT
    }
  };

  var MapTileLayer = MapLayer.inherit({

    defaults: {
      key: null,
      url: TILE_LAYERS.terrain.url,
      options: {
        tileLayer: {
          "detectRetina": true
        }
      }
    },

    initialize: function () {
      this.delegate = L.mapbox.tileLayer( TILE_LAYERS[this.get('key')].url, this.get('options') );
    },

  });

  MapTileLayer.INDEX = TILE_LAYERS;

  var OfflineMapTileLayer = MapTileLayer.inherit({

    defaults: {
      tileJson: null,
      options: {
          "detectRetina": true
      }
    },

    initialize: function () {
      var options = this.get('options');
      var tileJson = this.get('tileJson');
      options.maxNativeZoom = tileJson.maxzoom;
      options.minZoom = 0;
      this.delegate = L.tileLayer( tileJson.tiles[0], options );
    }
  });

  var VectorLayer = MapLayer.inherit({

     defaults: {
      options: {
        url: Configuration.TRAILSEGMENT_API_ENDPOINT,
        uniqueField: "id",
        scaleRange: [10,18],
        autoUpdate: true,
        symbology: {
          type: "single",
          vectorOptions: {
            fillColor: "#2f4a00",
            fillOpacity: 0.4,
            weight: 1.8,
            color: "#2f4a00",
            opacity: 1,
            clickable: false
          }
        }
      }
    },

    initialize: function () {
      this.delegate = new lvector.Outerspatial(this.get('options'));
    },

    setMap: function (map) {
      this.delegate.setMap(map.delegate);
    },

    setOrganizations: function (organizations) {
      this.delegate.setOrganizations(organizations);
    },

    setGeoJsonProvider: function (provider) {
      this.delegate.setGeoJsonProvider(provider);
    },

  });

  //
  // MAPGEOJSONLAYER MODEL
  //

  var MapGeoJsonLayer = MapLayer.inherit({

    defaults: {
      geojson: null,
      options: {}
    },

    initialize: function () {
      this.delegate = L.mapbox.geoJson(this.get('geojson'), this.get('options'));
    }

  });

  //
  // MAPMARKER MODEL
  //

  var MapMarker = MapLayer.inherit({

    defaults: {
      position: null,
      options: {}
    },

    initialize: function () {
      this.delegate = L.marker(this.get('position'), this.get('options'));
    },

    getPosition: function () {
      return this.delegate.getLatLng();
    },

    setPosition: function (position) {
      this.delegate.setLatLng(position);
      return this;
    },

    setIcon: function (icon) {
      this.delegate.setIcon(icon.delegate);
      return this;
    },

    remove: function () {
      this.delegate.remove();
      return this;
    }

  });

  var MapMarkerClusterGroup = Model.inherit({

    defaults: {
      "maxClusterRadius": 30,
      "showCoverageOnHover": false,

      // This is a duplicate of the default icon
      // creation function, which is provided
      // here as a guide for updating the
      // cluster icon appearance in the future.
      // Note that there are three cluster icon
      // sets: marker-cluster-small, -medium, and -large.
      "iconCreateFunction": function(cluster) {
        var childCount = cluster.getChildCount();

        var c = ' marker-cluster-';
        if (childCount < 10) {
          c += 'small';
        } else if (childCount < 100) {
          c += 'medium';
        } else {
          c += 'large';
        }

        return new L.DivIcon({
            html: '<div><span></div>',
            className: 'trailhead-icon-multi',
            iconSize: new L.Point(40, 40),
            iconAnchor: new L.Point(20,40)
          });
      }
    },

    initialize: function () {
      this.delegate = new L.MarkerClusterGroup(this.attributes);
    },

    removeLayer: function (layer) {
      this.delegate.removeLayer(layer.delegate);
      return this;
    },

    addLayer: function (layer) {
      this.delegate.addLayer(layer.delegate);
      return this;
    },

    addTo: function (map) {
      map.addLayer(this);
      return this;
    }

  });

  //
  // MAPCIRCLEMARKER MODEL
  //

  var MapCircleMarker = MapMarker.inherit({

    defaults: {
      position: null,
      options: {}
    },

    initialize: function () {
      this.delegate = L.circleMarker(this.get('position'), this.get('options'));
    }

  });

  //
  // MAPICON MODEL
  //

  var MapIcon = Model.inherit({

    defaults: {
      iconUrl: null,
      iconRetinaUrl: null,
      iconSize: null,
      iconAnchor: null,
      popupAnchor: null,
      shadowUrl: null,
      shadowRetinaUrl: null,
      shadowSize: null,
      shadowAnchor: null
    },

    initialize: function () {
      this.delegate = L.icon(this.attributes);
    }

  });

  //
  // MAPTRAILHEADMARKER MODEL
  //

  var MapTrailHeadMarker = MapMarker.inherit({

    selected: false,

    defaults: {
      position: null,
      record: null
    },

    initialize: function () {
      MapMarker.prototype.initialize.apply(this, arguments);
      this.setIcon(MapTrailHeadMarker.DeselectedIcon);
    },

    toggle: function () {
      this.selected ? this.deselect() : this.select();
    },

    select: function () {
      this.selected = true;
      this.setIcon(MapTrailHeadMarker.SelectedIcon);
      this.delegate.setZIndexOffset(Configuration.SELECTED_TRAILHEAD_ZINDEX_OFFSET);
      return this;
    },

    bringToFront: function () {
      this.delegate.setZIndexOffset(Configuration.SELECTED_TRAILHEAD_ZINDEX_OFFSET);
    },

    deselect: function () {
      this.selected = false;
      this.setIcon(MapTrailHeadMarker.DeselectedIcon);
      return this;
    }

  });

  MapTrailHeadMarker.DeselectedIcon = new MapIcon({
    iconUrl: 'img/trailhead-marker-deselected.png',
    shadowUrl: 'img/trailhead-marker-deselected-shadow.png',
    shadowRetinaUrl: 'img/trailhead-marker-deselected-shadow@2x.png',
    shadowSize: [ 40, 19 ],
    shadowAnchor: [ 7, 21 ],
    iconRetinaUrl: 'img/trailhead-marker-deselected@2x.png',
    iconSize: [ 34, 34 ],
    iconAnchor: [ 17, 34 ]
  });

  MapTrailHeadMarker.SelectedIcon = new MapIcon({
    iconUrl: 'img/trailhead-marker-selected.png',
    shadowUrl: 'img/trailhead-marker-selected-shadow.png',
    shadowRetinaUrl: 'img/trailhead-marker-selected-shadow@2x.png',
    iconRetinaUrl: 'img/trailhead-marker-selected@2x.png',
    shadowSize: [ 80, 39 ],
    shadowAnchor: [ 14, 42 ],
    iconSize: [ 48, 48 ],
    iconAnchor: [ 24, 48 ]
  });

  MapTrailHeadMarker.fromTrailHead = function (trailHead) {
    return new MapTrailHeadMarker({ position: trailHead.getLatLng(), record: trailHead });
  };

  //
  // MAPTRAILLAYER MODEL
  //

  var MapTrailLayer = MapLayer.inherit({

    defaults: {
      selectedBounds: null,
      options: {
        style: {
          color: "#e2504a",
          opacity: 1
        },
        smoothFactor: 2,
      }
    },

    initialize: function () {
      this.delegate = L.layerGroup();
    },

    select: function (ids) {
      this.delegate.clearLayers();
      this.selectedBounds = new L.LatLngBounds();
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var segment = TrailSegment.query.where({'key':'id','evaluator':'equals','value':id}).first();
        var layer = L.geoJson(segment.toGeoJson(), this.get('options')).addTo(this.delegate);
        this.selectedBounds.extend(layer.getBounds());
      }
      return this;
    },

    deselect: function () {
      this.delegate.clearLayers();
      return this;
    },

    getSelectedBounds : function() {
      return this.selectedBounds;
    }
  });


  //
  // MODULE DEFINITION
  //

  var module = ng.module('trails.services', [ ]);

  module.factory('MapMarkerClusterGroup', [

    function () {
      return MapMarkerClusterGroup;
    }

  ]);

  module.factory('MapTileLayer', [
    function () {
      return MapTileLayer;
    }
  ]);

  module.factory('VectorLayer', [
    function () {
      return VectorLayer;
    }
  ]);

  module.factory('OfflineMapTileLayer', [
    function () {
      return OfflineMapTileLayer;
    }
  ]);

  module.factory('MapTrailLayer', [

    function () {
      return MapTrailLayer;
    }

  ]);

  module.factory('MapTrailHeadMarker', [

    function () {
      return MapTrailHeadMarker;
    }

  ]);

  module.factory('GeoPositionMarker', [

    function () {
      return MapCircleMarker;
    }

  ]);

  module.factory('Map', [

    function () {
      return new Map();
    }

  ]);

  module.factory('GeoPosition', [

    function () {
      return new GeoPosition();
    }

  ]);

  module.factory('utils', [

    function () {
      return utils;
    }

  ]);

  module.factory('TrailSearch', [

    function () {
      return TrailSearch;
    }

  ]);

  //
  // DATA LOADER
  //

  module.factory('Models', [

    '$http',

    function ($http) {

      var LOADABLE = [
        "TrailHead", "Trail", "Steward","Notification","StewardDetail"
      ];

      var Models = {
        "TrailHead": TrailHead,
        "Trail": Trail,
        "TrailSegment": TrailSegment,
        "Steward": Steward,
          "StewardDetail": StewardDetail,
          "Notification": Notification,
          "Photo": Photo
        };

      var data_dir;

      Models.loaded = function () {
        var loaded = true;

        for (var i = 0; i < LOADABLE.length; i++) {
          var model = LOADABLE[i];
          if (!Models[model].loaded) {
            loaded = false;
            break;
          }
        }

        return loaded;
      };

      Models.loadModel = function (model, key, url, callback) {
        var network = window.navigator.onLine;
        if (network) { 
          $http.get(url).then(
            function (res) {
              var fname = url.split('://')[1].split('/').join('.');
              data_dir.getFile(fname, {create: true, exclusive: false}, function (file) {
                file.createWriter(function (writer) {
                  writer.onwriteend = function (evt) {
                  };
                  if (fname.substring(fname.length - 3, fname.length) === 'csv')
                    writer.write(res.data); 
                  else
                    writer.write(JSON.stringify(res.data));
                }, function (err) {alert(err)});
              }, function (err) {alert(err)});

              process(res, model, key, callback);

            }
          );
        }
        else {
          var fname = url.split('://')[1].split('/').join('.');
          data_dir.getFile(fname, {exclusive: false}, function (fileEntry) {
            $http.get(fileEntry.toURL()).then(
              function (res) {
                process(res, model, key, callback);
              }
            );
          }, function (err) {});          
        }
      }

      function process (res, model, key, callback) {
        var data = res.data;
        if (key === "GeoJson") {
          callback(data);
          return;
        }

        if (key === "TrailData" || key === "StewardData") {
          data = parseCSV(data);
        }

        if (key === "StewardData") {
           // we need to load the details to get the bounds
          ng.forEach(data, function (steward) {
            Models.loadModel(StewardDetail, "StewardDetail", Configuration.STEWARD_DETAIL_ENDPOINT + '/' + steward.outerspatial_id);
            if (StewardDetail.pending)
              StewardDetail.pending++;
            else
              StewardDetail.pending = 1;
          });
        }
        if (key === "StewardDetail") {
           StewardDetail.pending--;
           if (StewardDetail.pending === 0)
            StewardDetail.loaded = true;
        }
        model.load(data,true);
      }

      function parseCSV(data){
        return Papa.parse(data,{header:true}).data;
      }

      function loadModels () {
        Models.loadModel(Trail, "TrailData", Configuration.TRAIL_DATA_ENDPOINT);
        Models.loadModel(TrailHead, "TrailHeadData", Configuration.TRAILHEAD_DATA_ENDPOINT);
        Models.loadModel(TrailSegment, "TrailSegmentData", Configuration.TRAILSEGMENT_DATA_ENDPOINT);
        Models.loadModel(Steward, "StewardData", Configuration.STEWARD_DATA_ENDPOINT);
        Models.loadModel(Notification, "NotificationData", Configuration.NOTIFICATION_DATA_ENDPOINT);
        Models.loadModel(Photo, "PhotoData", Configuration.PHOTO_DATA_ENDPOINT);
      }

      if (window.resolveLocalFileSystemURL) { 
        window.resolveLocalFileSystemURL(cordova.file.dataDirectory,
          function(dir) {
            dir.getDirectory('data', {create:true, exclusive: false} ,function(dir){
              data_dir = dir;
              loadModels();
            });
          },
          function(err) {
          }
        );  
      }
      else
        loadModels();

      window.Trail = Trail;
      window.Photo = Photo;

      return Models;
    }

  ]);

})(angular);
