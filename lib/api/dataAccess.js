
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

	self.syncLoadCustomSchema = function(type, schemaJSON, collectionName)
	{
		try{
			//first we add to validation -- make sure to skip adding any WIN additions like wid, parents, dbType, etc.
			var add = winShared.schemaManager.addSchemaToValidator(type, schemaJSON, {skipWINAdditions: true});

			if(add.error)
				throw new Error(add.error);
			//force add a schema type to the manager -- this will allow for custom types
			winShared.schemaManager.addSchemaToManager(type, schemaJSON, collectionName);
		}
		catch(e)
		{
			console.log('Failed sync load: ', e);
			throw e;
		}
	}

	self.saveDatabaseObjects = function(type, widObjects, metaInformation)
	{
		//TODO: check input objects and handle errors!
		var defer = Q.defer();

		//we can now publish by calling our schema manager -- this is a simple wrapper
		//in the future, we will handle all the errors coming out with more specificity 
		 winShared.schemaManager.asyncValidateAndSaveObjects(type, widObjects, metaInformation, {skipConnections: true})
			.then(function(args)
			{
				defer.resolve(args);
			}, function(err){

				//TODO: handle errors in a custom way!
				defer.reject(err);
			});
	
		return defer.promise;
	}

	self.publishWINArtifacts = function(widArtifacts, metaInformation)
	{
		//TODO: check input objects and handle errors!
		var defer = Q.defer();

		console.log('Publishing win artifacts');

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

	self.loadRecentArtifacts = function(startDate, count, type)
	{
		if(!type)
			type = winShared.mainArtifactType;

		var defer = Q.defer();

		//we can now load by calling our schema manager -- this is a simple wrapper
		//in the future, we will handle all the errors coming out with more specificity 
		 winShared.schemaManager.asyncLoadRecentObjects(startDate, count, type)
			.then(function(args)
			{
				defer.resolve(args);
			}, function(err){

				//TODO: handle errors in a custom way!
				defer.reject(err);
			});
	
		return defer.promise;
	}

	self.loadRecentArtifactsByProperties = function(queryProps, type, options)
	{
		if(!type)
			type = winShared.mainArtifactType;

		var defer = Q.defer();

		//we can now load by calling our schema manager -- this is a simple wrapper
		//in the future, we will handle all the errors coming out with more specificity 
		 winShared.schemaManager.asyncLoadRecentObjectsByProperties(queryProps, type, options)
			.then(function(args)
			{
				defer.resolve(args);
			}, function(err){

				//TODO: handle errors in a custom way!
				defer.reject(err);
			});
	
		return defer.promise;
	}

	//just wrap the schema manager here
	self.asyncCreateOrRemove = function(type, properties, obj, options)
	{
		return winShared.schemaManager.asyncCreateOrRemove(type, properties, obj, options);
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

