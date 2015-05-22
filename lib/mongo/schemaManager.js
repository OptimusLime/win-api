var fs = require('fs'),
//use nodejs to find all js files, and update them
    path = require('path'),
    util = require('util');

var Q = require('q');

var fileReader = require("../utilities/fileReader.js")();
var traverse = require('optimuslime-traverse');

//can use same mongoose object across many apps
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;


module.exports = function(schemaConverter, schemaValidator)
{
    //max tries for saving things that are stubborn
    var maxSaveAttempts = 4;

    var schemaManager = this;
    var schemaConverter = schemaConverter;

    var initializedSchemas = false;

    //keep our mongo models here
    var mongoModels = {};

    var connectionSchema = {child: "String", parent: "String"};

    function connectionName(type)
    {
        return type + "_connection"; 
    }

    schemaManager.connectionDatabaseName = connectionName;

    schemaManager.getMongoModel = function(type)
    {
        return mongoModels[type];
    }

    //TODO: Schema dependences at the artifact level
    schemaManager.loadAllSchemas = function(paths)
    {
        if(initializedSchemas)
            return;

        var allSchema = {};

        if(typeof paths == "string")
            paths = [paths];

        for(var i=0; i < paths.length; i++)
        {
            //grab the path
            var allSchemaInPath = fileReader.recursiveReadDirectorySync(paths[i], '/');

            //grab all the json objects
            for(var type in allSchemaInPath)
                allSchema[type] = JSON.parse(allSchemaInPath[type]);
        }

        console.log('Loading schema: ',allSchema);

        //we now have a bunch of schema objects that need to be processed and added as mongoose objects
        for(var type in allSchema)
        {
            //loads the scheam for validation
            //we pull out this loaded schema -- it's been modified to include win required objects
            var processedSchema = schemaManager.addSchemaToValidator(type, allSchema[type]);

            if(processedSchema.error)
                throw new Error(processedSchema.error);
        }

        //now we have added all the schema, we can build a FULL schema object
        for(var type in allSchema)
        {
            schemaManager.addSchemaToManager(type, allSchema[type], true);
        }

        initializedSchemas = true;
    };

    schemaManager.addSchemaToValidator = function(type, schemaJSON, options)
    {
        return schemaValidator.addSchema(type, schemaJSON, options);
    }
    
    schemaManager.addSchemaToManager = function(type, schemaJSON, addConnectionType)
    {
        //grab the whole scheam
        var processedSchema = schemaValidator.getFullSchema(type, schemaJSON);

        if(processedSchema.error)
            throw new Error(processedSchema.error);

        //no error? grab the schema -- the whole thing!
        processedSchema = processedSchema.fullSchema[0];

        // console.log('\t processed full schema for type: '.blue, type, require('util').inspect(processedSchema,false, 10));

        //loads in the schema into the database
        schemaConverter.schema(type, processedSchema);
        
        //store the mongo model type for later reference
        mongoModels[type] = schemaConverter.getConnection().model(type);

        if(addConnectionType)
        {   
            //get our schema connection name
            var schemaConnection = connectionName(type);

             //for storing connections for this schema type -- we store parent/child relationships for all objects
            schemaConverter.schema(schemaConnection, traverse(connectionSchema).clone());
            
            //we also have all our connections :)
            mongoModels[schemaConnection] = schemaConverter.getConnection().model(schemaConnection);
        }
    }

    schemaManager.asyncClearAllObjects = function()
    {
        //promise to get it done please
        var defer = Q.defer();

        var clearPromises = [];

        for(var type in mongoModels)
        {
            clearPromises.push(asyncClearModelDB(type));
        }

        Q.allSettled(clearPromises)
            .then(function (results) {

                for(var i=0; i < results.length; i++){

                    var res = results[i];

                    //one failed, wtf?
                    if (res.state !== "fulfilled")
                    {
                        defer.reject(res.reason);
                        return;
                    }
                }

                //all successful!
                defer.resolve();
            });

        return defer.promise;
    }

    function asyncClearModelDB(type)
    {
        var defer = Q.defer();

        var MongoModel = mongoModels[type];

        MongoModel.remove({}).exec(function(err)
        {
            if(err)
                defer.reject(err);
            else
                defer.resolve();
        });

        return defer.promise;
    }

    //remove any mongodb junk from the saving process for lean mongo objects
    function cleanModels(models)
    {
        //need to remove anything resembling ids
        for(var i=0; i < models.length; i++)
        {
            models[i] = traverse(models[i]).map(function(node)
                {
                    if(this.key == "_id" || this.key == "__v")
                        this.remove();
                });
        }

        return models;
    }

    //keep in mind, we aren't doing any checks on who can access what -- that must come before calling these objects
    schemaManager.asyncLoadObjects = function(type, widList)
    {
        //lets fetch these from the appropriate model!  
        var defer = Q.defer();

        var MongoModel = mongoModels[type];

        if(!MongoModel){
            Q.fcall(function()
            {
                defer.reject({message: "MongoModel does not exist for type: " + type});
            })
            return;
        }

        //find anything matching these wids
        MongoModel.find({wid: {"$in": widList}}).lean().exec(function(err, models)
        {
            if(err)
            {
                defer.reject(err);
                return;
            }

            //return the full models -- do we need to strip anything out?
            //that's somebody elses business -- we just get you your data :)
            defer.resolve(cleanModels(models));
        });

        return defer.promise;
    }

    schemaManager.asyncLoadRecentObjects = function(startDate, count, type)
    {
         //lets fetch these from the appropriate model!  
        var defer = Q.defer();

        var MongoModel = mongoModels[type];

        if(!MongoModel){
            Q.fcall(function()
            {
                defer.reject({message: "MongoModel does not exist for type: " + type});
            })
            return;
        }

        var dateQuery;
        if(startDate.before)
        {
            dateQuery = {date: {$lt: startDate.before}};
        }
        else if(startDate.after)
        {
            dateQuery = {date: {$gt: startDate.after}};
        }
        else
        {
            //just find most recent
            dateQuery = {};
        }

        //find anything matching these wids
        MongoModel
            .find(dateQuery)
            .sort({date: -1})
            .limit(count)
            .lean()
            .exec(function(err, models)
            {
                if(err)
                {
                    defer.reject(err);
                    return;
                }

                //return the full models -- do we need to strip anything out?
                //that's somebody elses business -- we just get you your data :)
                defer.resolve(cleanModels(models));
            });

        return defer.promise;
    }

    schemaManager.asyncLoadRecentObjectsByProperties = function(queryObject, startDate, count, type)
    {
         //lets fetch these from the appropriate model!  
        var defer = Q.defer();

        var MongoModel = mongoModels[type];

        if(!MongoModel){
            Q.fcall(function()
            {
                defer.reject({message: "MongoModel does not exist for type: " + type});
            })
            return;
        }

        var dateQuery;
        if(startDate.before)
        {
            dateQuery = {date: {$lt: startDate.before}};
        }
        else if(startDate.after)
        {
            dateQuery = {date: {$gt: startDate.after}};
        }
        else
        {
            //just find most recent
            dateQuery = {};
        }

        for(var key in queryObject)
            dateQuery[key] = queryObject[key];

        //search for all matching hashtags too!
        // dateQuery.hashtag = hashtag;

        //find anything matching these wids
        MongoModel
            .find(dateQuery)
            .sort({date: -1})
            .limit(count)
            .lean()
            .exec(function(err, models)
            {
                if(err)
                {
                    defer.reject(err);
                    return;
                }

                //return the full models -- do we need to strip anything out?
                //that's somebody elses business -- we just get you your data :)
                defer.resolve(cleanModels(models));
            });

        return defer.promise;
    }

    schemaManager.replaceExisting = function(toSaveObject, existing)
    {
        //loop through an object that is about to be saved
        //and make sure the insides have the right information
        traverse(toSaveObject).forEach(function(node)
        {
            if(this.node.wid && existing[this.node.wid])
            {
                //replace with the already existing object! Do not continue replacing internals -- no need
                this.update(existing[this.node.wid], true);
            }
        });
    }

    //this handles the WHOLE save process 
    //we validate the objects match the schema
    //we pull the inner database objects out
    //we check for which of those inner objects has been saved before
    //anything that hasn't been saved gets saved
    schemaManager.asyncValidateAndSaveObjects = function(type, widToObjects, metaInformation, options)
    {
        //this is async function -- resolve when complete or reject on error
        var defer = Q.defer();

        // console.log('Validating objects to save for type : ' + type);

        options = options || {};

        //we need to validate all the objects first
        var objToValide = [];
        for(var wid in widToObjects)
            objToValide.push(widToObjects[wid]);

        //send it to add validation
        if(metaInformation)
            schemaValidator.appendMetaInformation(objToValide, metaInformation);

        //validate
        var validateObjects = schemaValidator.validateDataArray(type, objToValide);

        // console.log('Validated for type: ' + type + " object: ", validateObjects);

        //all valid objects
        if(validateObjects.isValid)
        {
            //in the end, we have to save everything -- what to do on failure?? Retry?
            var allModelsToSave = [];

            //now we're ready to save the objects

            //we need to convert them into database objects
            var allRawDB = schemaValidator.getDatabaseObjects(type, widToObjects, options);

            var rawObjects = allRawDB.typeToObjects;
            var rawConnections = allRawDB.typeToParentConnections;

            // console.log("DB objects: ", require('util').inspect(allRawDB, false, 10));

            //gotta check some wids for each type
            var typeTowidsToCheck = {};

            //we now have all of the objects that need to be converted into corresponding database types
            for(var refType in rawObjects)
            {

                var oObjects = rawObjects[refType];

                // console.log('ref type: ' + type + " object: ", oObjects);

                //grab the type
                var MongoModel = mongoModels[refType];

                typeTowidsToCheck[refType] = [];

                if(!MongoModel){

                    Q.fcall(function()
                    {
                        defer.reject({message: "Mongo Model for " + refType + " doesn't exist"});
                    });

                    return defer.promise;
                }

                //these are all the objects to create
                for(var wid in oObjects)
                {
                    //grab the wids
                    typeTowidsToCheck[refType].push(wid);
                }

                //no zero length checks -- thanks
                if(typeTowidsToCheck[refType].length == 0)
                    delete typeTowidsToCheck[refType];
            }

            // console.log('check existing ', typeTowidsToCheck);

            asyncCheckExisting(typeTowidsToCheck)
                .then(function(saveAndExisting)
                {
                    var trueWids = saveAndExisting.save;
                    var existing = saveAndExisting.existing;

                    //we have a list of wids we are sure to want
                    //we now have all of the objects that need to be converted into corresponding database types
                    for(var refType in rawObjects)
                    {
                        var oObjects = rawObjects[refType];

                        //grab the type
                        var MongoModel = mongoModels[refType];

                        // console.log('check existing ', Object.keys(mongoModels));
                        // console.log('ref existing ', refType);

                        //these are all the objects to create
                        for(var wid in oObjects)
                        {
                            //grab the wids
                            if(trueWids[wid])
                            {
                                var toSaveObject = oObjects[wid];
                                
                                schemaManager.replaceExisting(toSaveObject, existing);

                                //ready for saving, thanks
                                var dbReady = MongoModel(toSaveObject);
                                
                                //store meta info if you require it
                                if(metaInformation)
                                    dbReady.meta = metaInformation;

                                // console.log("\tDBOrig: ".cyan, toSaveObject);
                                // console.log("\tDBSAving: ".rainbow, dbReady);

                                //push it for saving please
                                allModelsToSave.push(dbReady);
                            }                         
                        }
                    }

                    if(!options.skipConnections){
                         //lets now create our parent connections please
                        for(var refType in rawConnections)
                        {
                            //connection type name for this reference
                            var connType = connectionName(refType);

                            var aConns = rawConnections[refType];

                            //grab the type
                            var MongoConnModel = mongoModels[connType];

                            //now we push all connections for saving
                            for(var i=0; i < aConns.length; i++)
                            {
                                var pc = aConns[i];

                                //if we haven't saved you yet, we can save this connection
                                if(trueWids[pc.child])
                                {
                                    //ready for saving, thanks
                                    var dbReady = MongoConnModel(pc);

                                    //ready here we go!
                                    allModelsToSave.push(dbReady);                                
                                }
                            }
                        }
                    }

                    // console.log('Models to save: ', allModelsToSave);

                    //go ahead and start the save process for ALL of these objects
                    return saveAllModels(allModelsToSave);

                })
                .then(function() //when we get back from saving all the models -- we are all done!
                {   
                    defer.resolve();

                })
                .catch(function(err)
                {
                    defer.reject(err);
                });           
        }
        else{
            Q.fcall(function()
            {
                defer.reject({message: "Objects cannot be validated. Check validation errors. ", error: validateObjects.error, validationErrors: validateObjects.validationErrors});
            });
            
            return defer.promise;
        }

        return defer.promise;
    }

    function asyncCheckExisting(typeTowidsToCheck)
    {
        var defer = Q.defer();

        var trueWidsToSave = {};
        var existingWids = {};
        var allPromises = [];

        for(var refType in typeTowidsToCheck)
        {
            //get our model
            var MongoModel = mongoModels[refType];

            var aChecks = typeTowidsToCheck[refType];

            allPromises.push(asyncReturnExisting(refType, MongoModel, aChecks));
        }

        Q.allSettled(allPromises)
            .then(function(results)
            {
                //check the results
                for(var i=0; i < results.length; i++)
                {
                    var sResult = results[i];

                    //we finished!
                    if(sResult.state === "fulfilled")
                    {
                        var res = sResult.value;

                        var refType = res.type;
                        var alreadySaved = res.existing;
                        var map = res.map;
                        var saveMap = {};
                        for(var s=0; s < alreadySaved.length; s++)
                            saveMap[alreadySaved[s]] = true;

                        var aChecks = typeTowidsToCheck[refType];

                        for(var s =0; s < aChecks.length; s++)
                        {
                            var wid = aChecks[s];
                            if(!saveMap[wid])
                            {
                                //we want to save this object -- it doesn't exist
                                if(existingWids[wid] == undefined)
                                    trueWidsToSave[wid] = true;
                            }
                            else //make sure we do not save it if it's in there anywhere
                                existingWids[wid] = map[wid];
                        }

                        //now we have a mark of the true wids for this type
                    }
                    else
                    {
                        defer.reject({message: "Checking for existing wids failed. Try again."});
                        return;
                    }
                }

                //when we're all done, resolve with the true objects
                defer.resolve({save: trueWidsToSave, existing: existingWids});
            })


        return defer.promise;
    }


    function asyncReturnExisting(type, MongoModel, widList)
    {
        var defer = Q.defer();

        MongoModel.find({})
            .where('wid').in(widList)
            .lean().exec(function(err, aModels)
        {
            if(err)
            {
                defer.reject(err);
                return;
            }
            //how many discovered? i dunno
            var discovered = [];
            var map = {};

            for(var i=0; i < aModels.length; i++)
            {
                discovered.push(aModels[i].wid);
                map[aModels[i].wid] = aModels[i];
            }
            defer.resolve({type: type, existing: discovered, map: map});
        });



        return defer.promise;
    }

    function saveAllModels(modelObjects, saveCount)
    {
        //defer for later
        var defer = Q.defer();

        if(saveCount == undefined)
            saveCount = 0;

        var allPromises = [];
        for(var i=0; i < modelObjects.length; i++)
            allPromises.push(saveModelPromise(modelObjects[i]));

        Q.allSettled(allPromises)
            .then(function(results)
            {
                //make sure everything is saved!
                var retryObjects = [];

                for(var i=0; i < results.length; i++)
                {
                    var result = results[i];
                    //if not fulfilled -- then you've failed!
                    if(result.state !== "fulfilled")
                        retryObjects.push(modelObjects[i]);

                }
                //we have nothign that failed :)
                if(retryObjects.length == 0)
                {
                    defer.resolve();
                }
                else //more to try!
                {   
                    saveCount++;
                    if(saveCount >= maxSaveAttempts)
                    {
                        //we're out of tries! 
                        defer.reject({message: "Attempting to save failed more than max save attempts of " + maxSaveAttempts});
                        return;
                    }
                    else
                    {
                        saveAllModels(retryObjects, saveCount)
                            .then(function()
                            {
                                defer.resolve();
                            },function(err)
                            {
                                defer.reject(err);
                            });
                    }
                }             
            });

        return defer.promise;
    }

    function saveModelPromise(model)
    {
        var defer = Q.defer();
        model.save(function(err, obj)
        {
            if(err)
                defer.reject(err);
            else
                defer.resolve(obj);
        });

        return defer.promise;
    }

    return schemaManager;
};
