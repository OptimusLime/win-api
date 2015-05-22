
var DataAccessClass = require("./api/dataAccess.js");
var DataModificationClass = require("./api/dataModification.js");
var SchemaManagerClass = require("./mongo/schemaManager.js");
var SchemaConverterClass = require("./mongo/schemaConverter.js");
var SchemaValidatorClass = require("./schema/win-schema.js");

var mongoose = require('mongoose');

var Q = require('q');
var winAPI = {};

module.exports = winAPI;

function createWINShared(mongoConnection, redisConnection, configuration)
{
  //create our winshared object -- this will hold all our necessary components
  var winShared = {};

  configuration = configuration || {};

  //copy over teh configuration into the winshared by default
  for(var key in configuration)
    winShared[key] = configuration[key];

  winShared.schemaConverter = new SchemaConverterClass();
  winShared.schemaConverter.setConnection(mongoConnection);

  winShared.schemaValidator = new SchemaValidatorClass(configuration.validator);

  winShared.schemaManager = new SchemaManagerClass(winShared.schemaConverter, winShared.schemaValidator);

  //send back the win object!
  return winShared;
}

winAPI.apiObject = function(winShared)
{
  var self = this;

  self.winShared = winShared;
  self.dataAccess = new DataAccessClass(winShared);
  self.winShared.dataAccess = self.dataAccess;
  self.dataModification = new DataModificationClass(winShared);
  self.winShared.dataModification = self.dataModification;

  return self;
}

function asyncMongoConnection(properties)
{
  var defer = Q.defer();

  var mongooseConnection = mongoose.createConnection(properties.dbLocation);

    mongooseConnection.on('error', function(e)
    {
        console.log('Mongoose connection error: ', e);

        defer.reject(e);
    });

    mongooseConnection.on('open', function(){
      defer.resolve(mongooseConnection);
    });

  return defer.promise;
}

function asyncRedisConnection(properties)
{
  return Q.fcall(function()
  {
    return {};
  })
}

function reject(promise, reason)
{
  promise.reject(reason);
}

//requires mongo, redis configs
winAPI.asyncLaunch = function(configuration)
{
  var defer = Q.defer();

  //now we need to launch all our connections
  var promises = [asyncMongoConnection(configuration.mongo), asyncRedisConnection(configuration.redis)];

  Q.allSettled(promises)
    .then(function(results)
    {
      var mongoResult = results[0];
      var redisResult = results[1];
      if(mongoResult.state !== "fulfilled")
      {  
        reject(defer, mongoResult.reason);
        return;
      }

      if(redisResult.state !== "fulfilled")
      {  
        reject(defer, redisResult.reason);
        return;
      }

      var mongoConnection = mongoResult.value;
      var redisConnection = redisResult.value;

        //now we have our connections, let's build our shared objects
        var winShared = createWINShared(mongoConnection, redisConnection, configuration);

        //now let's build our objects
        var winAPIObject = new winAPI.apiObject(winShared);

        winAPIObject.dataAccess.loadWINSchemas(configuration.schemaLocation)

        //send back just the object to deal with
        defer.resolve(winAPIObject);
    })
    .catch(function (error) {
      // Handle any error from all above steps
      reject(defer, error);
    })


  return defer.promise;
}
