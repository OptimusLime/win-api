
var Q = require('q');

module.exports = function(winShared)
{
	var self = this;

	//we need some objects from winShared
	//we call the accordingly

	self.loadWINSchemas = function(paths)
	{
		//we load up the schema manager for all our schema 
        return Q.fcall(function()
        	{
        		 winShared.schemaManager.loadAllSchemas(paths);
        	});
	}

	self.publishWINArtifacts = function(widArtifacts, metaInformation)
	{
		//TODO: check input objects and handle errors!
		var defer = Q.defer();

		//we can now publish by calling our schema manager -- this is a simple wrapper
		//in the future, we will handle all the errors coming out with more specificity 
		 winShared.schemaManager.asyncValidateAndSaveObjects(winShared.mainArtifactType, widArtifacts, metaInformation)
			.then(function(args)
			{
				defer.resolve(args);
			}, function(err){

				//TODO: handle errors in a custom way!
				defer.reject(err);
			});
	
		return defer.promise;
	}

	self.loadWINArtifacts = function(widList, type)
	{
		//didn't provide a type? it wasn't expected that a type gets sent in
		//most of the time, you'd only load the main type
		if(!type)
			type = winShared.mainArtifactType;

		var defer = Q.defer();

		//we can now load by calling our schema manager -- this is a simple wrapper
		//in the future, we will handle all the errors coming out with more specificity 
		 winShared.schemaManager.asyncLoadObjects(type, widList)
			.then(function(args)
			{
				defer.resolve(args);
			}, function(err){

				//TODO: handle errors in a custom way!
				defer.reject(err);
			});
	
		return defer.promise;
	}

	self.clearDatabases = function()
	{
		var defer = Q.defer();

		//we can now load by calling our schema manager -- this is a simple wrapper
		//in the future, we will handle all the errors coming out with more specificity 
		 winShared.schemaManager.asyncClearAllObjects()
			.then(function(args)
			{
				defer.resolve(args);
			}, function(err){

				//TODO: handle errors in a custom way!
				defer.reject(err);
			});
	
		return defer.promise;
	}




	return self;
}

