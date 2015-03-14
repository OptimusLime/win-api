
var assert = require('assert');
var should = require('should');
var color = require('colors');
var util = require('util');
var fs = require('fs');
var traverse = require('optimuslime-traverse');

var ValidatorClass = require('../lib/schema/win-schema.js');
var ConverterClass = require('../lib/mongo/schemaConverter.js');
var SchemaManagerClass = require('../lib/mongo/schemaManager.js');

var mongoose = require('mongoose');

var cuid = require('win-utils').cuid;

var next = function(range)
{
    return Math.floor((Math.random()*range));
};

var dbModifier = "testmongo";

var mongooseConnection;
var winSchemaValidator, mongoSchemaConverter;

var schemaManager;

var ins = function(obj, val)
{
    return util.inspect(obj, false, val || 10);
}

describe('Testing Generator Schema Processing -',function(){

    //we need to start up the WIN backend

    before(function(done){

        var configuration = 
        {
            multipleErrors : true,
            allowAnyObjects : false,
            requireByDefault : true
        };

        winSchemaValidator = new ValidatorClass(configuration);
        mongoSchemaConverter = new ConverterClass();

        //need to launch mongo we do
        // connect to Mongo when the app initializes
        mongooseConnection = mongoose.createConnection('mongodb://localhost/win' + dbModifier);

        mongooseConnection.on('error', function(e)
        {
            console.log('Mongoose connection error');
            console.log(e);
    //        console.error.bind(console, 'connection error:');
            done(e.message);
        });

        mongooseConnection.on('open', function(){

            //need to wire up our mongoose object!
            mongoSchemaConverter.setConnection(mongooseConnection);

            //create generic manager plz!
            schemaManager = new SchemaManagerClass(mongoSchemaConverter, winSchemaValidator);

            done();
        });

    });

    beforeEach(function(done){

        console.log("\tClearing db now!".magenta)

        //we load up the schema manager for all our schema 
        schemaManager.loadAllSchemas("./test/schema");

        //clear everything out before each test please! 
        schemaManager.asyncClearAllObjects().then(function(){

            console.log("\tDB all clear now!".green)


            done();
        }, function(err){
            // console.log(err);
            done(new Error(err.message));
        });
    });

    it('Schema Manager Saving/Validation',function(done){

        var schemaName = "NEATGenotype";

        //now we test that certain elements exist
        var ngExample = {wid: cuid(), nodes: [], connections: [], parents: [], dbType: schemaName};

        var child = traverse(ngExample).clone();
        child.wid = cuid();
        child.parents = [ngExample.wid];

        //create an example to validate and save to db :)
        var examples = {};
        examples[ngExample.wid] = ngExample;
        examples[child.wid] = child;

        //

        schemaManager.asyncValidateAndSaveObjects(schemaName, examples)
            .then(function()
            {
                //saved!
                console.log("Validated and saved!".green);

                done();
            }, function(err)
            {

                console.log("\tFailed validation or saving :(\n".red);
                console.log("\tValidation errors: ".blue, ins(err));

                done(new Error(err.message));
            });

    });


    it('Schema Manager Loading',function(done){

        var schemaName = "NEATGenotype";

        //now we test that certain elements exist
        var ngExample = {wid: cuid(), nodes: [], connections: [], parents: [], dbType: schemaName};

        var child = traverse(ngExample).clone();
        child.wid = cuid();
        child.parents = [ngExample.wid];

        //create an example to validate and save to db :)
        var examples = {};
        examples[ngExample.wid] = ngExample;
        examples[child.wid] = child;

        var widList = [ngExample.wid, child.wid];

        //

        schemaManager.asyncValidateAndSaveObjects(schemaName, examples)
            .then(function()
            {
                //saved!
                console.log("Validated and saved, now to load the objects!".green);

                return schemaManager.asyncLoadObjects(schemaName, widList);

            }, function(err)
            {

                console.log("\tFailed validation or saving :(\n".red);
                console.log("\tValidation errors: ".blue, ins(err));

                done(new Error(err.message));
            }).then(function(loadedObjects)
            {
                //check our loaded objects for correctness
                console.log(loadedObjects)


                done();

            }, function(err){done(new Error(err.message));})

    });

    it('Schema Manager Complex Schema',function(done){

        var schemaName = "NEATGenotype";
        var complexSchemaName = "complexSchema";

        //now we test that certain elements exist
        var ngExample = {wid: cuid(), nodes: [], connections: [], parents: [], dbType: schemaName};

        var child = traverse(ngExample).clone();
        child.wid = cuid();
        child.parents = [ngExample.wid];

        //now lets build something a bit more complex
        var complexExample = {wid: cuid(), dbType: complexSchemaName, parents: [], pictureGenotype: ngExample, 
            arrayGenotype: [{example: 0, genotypes: [{example2: 1, genotype2: ngExample}, {example2: 2, genotype2: child}]}],
            secondTest : {second: "doofus", genoSecond: child}};


        //create an example to validate and save to db :)
        var examples = {};
        examples[complexExample.wid] = complexExample;
        // examples[ngExample.wid] = ngExample;
        // examples[child.wid] = child;

        var widList = [complexExample.wid];//[ngExample.wid, child.wid];

        //

        schemaManager.asyncValidateAndSaveObjects(complexSchemaName, examples)
            .then(function()
            {
                //saved!
                console.log("Validated and saved, now to load the objects!".green);

                return schemaManager.asyncLoadObjects(complexSchemaName, widList);

            }, function(err)
            {

                console.log("\tFailed validation or saving :(\n".red);
                console.log("\tValidation errors: ".blue, ins(err));

                done(new Error(err.message));
            }).then(function(loadedObjects)
            {
                //check our loaded objects for correctness -- super complex!
                console.log(loadedObjects)
                

                done();

            }, function(err){done(new Error(err.message));})

    });

});
