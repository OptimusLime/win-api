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


module.exports = function(schemaManager)
{
    var mongoQuery = this;

    //lets return the latest for a particular type

    mongoQuery.getMostRecent = function(type, count)
    {
        var defer = Q.defer();

        //we need to ask our schema manager for mongo models
        var MongoModel = schemaManager.getMongoModel(type);

        if(!MongoModel)
        {
            Q.fcall(function()
            {
                defer.reject(new Error("No mongo model for " + type));
            })

            return;
        }

        //otherwise we're fine, lets get the most recent objects


        return defer.promise;
    }








    return mongoQuery;
};
