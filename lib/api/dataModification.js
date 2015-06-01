
var Q = require('q');

module.exports = function(winShared)
{
	var self = this;

	self.getPopularityTypeName = function(type)
	{
		return "pop_" + type.toLowerCase();
	}

	function wrapEmit(property)
	{
		return "function() { emit(this." + property + ", 1); }";
	}

	self.createPopularitySchema = function(property, type)
	{
		type = winShared.schemaManager.connectionDatabaseName(type) || winShared.schemaManager.connectionDatabaseName(winShared.mainArtifactType);

		// console.log('Mongo type: ', type);
		var MongoModel = winShared.schemaManager.getMongoModel(type);
		var propType = MongoModel.schema.paths[property].instance;

		var modelSchema = {schemaName: self.getPopularityTypeName(type), schemaJSON: {_id: propType, value: "Number"}};

		console.log(modelSchema);
		return modelSchema;
	}

	self.getArtifactsByHighestPropertyCount = function(property, popularityType, options)
	{
		popularityType = popularityType || self.getPopularityTypeName(winShared.schemaManager.connectionDatabaseName(winShared.mainArtifactType));
	
		var MongoModel = winShared.schemaManager.getMongoModel(popularityType);

		var queryObject = {};
		//sort by descending on this property value!
		var queryOptions = {remapID: property, sort: {value: -1}};

		options = options || {};
		for(var key in options)
			queryOptions[key] = options[key];

		//now lets fetch the highest values -- puhlease
		return winShared.schemaManager.asyncLoadRecentObjectsByProperties(queryObject, popularityType, queryOptions);
	}

	//need need to calculate popularity of an artifact
	self.countModelByProperty = function(propertyQuery, type)
	{
		var defer = Q.defer();

		type = winShared.schemaManager.connectionDatabaseName(type) || winShared.schemaManager.connectionDatabaseName(winShared.mainArtifactType);

		console.log('Count model by type: ', type);
		var MongoModel = winShared.schemaManager.getMongoModel(type);
		var popName = self.getPopularityTypeName(type);
		var o = {};

		
		// o.map = function () { emit(this.parent, 1) }
		o.map = wrapEmit(propertyQuery);
		o.reduce = function (k, vals) { return vals.length }
		o.out = {merge: popName};

		//now we need to run a map reduce on all these objects counting a certain property
		MongoModel.mapReduce(o, function (err, results, stats) {
		  // console.log(results);
		  if(err)
		  	defer.reject(err);
		  else
		  {
		  	console.log('popularity map reduce took %d ms', (stats || results).processtime)
		  	defer.resolve(results);
		  }
		});

		return defer.promise;
	}


	return self;
}

