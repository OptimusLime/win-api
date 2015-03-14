
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

var metaProps = {
    user: "string",
    timeofcreation: "Number",
    session: "String"
}

describe('Testing Generator Schema Processing -',function(){

    //we need to start up the WIN backend

    before(function(done){

        var configuration = 
        {
            multipleErrors : true,
            allowAnyObjects : false,
            requireByDefault : true,
            metaProperties: metaProps
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

        var metaInfo = {user: "doofus", timeofcreation: Date.now(), session: "funtimesession"};

        schemaManager.asyncValidateAndSaveObjects(schemaName, examples, metaInfo)
            .then(function()
            {
                //saved!
                console.log("\tValidated and saved!".green);

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

        var allDone = false;
        
        var metaInfo = {user: "doofus", timeofcreation: Date.now(), session: "funtimesession"};


        schemaManager.asyncValidateAndSaveObjects(schemaName, examples, metaInfo)
            .then(function()
            {
                //saved!
                console.log("\tValidated and saved, now to load the objects!".green);

                return schemaManager.asyncLoadObjects(schemaName, widList);

            }, function(err)
            {

                console.log("\tFailed validation or saving :(\n".red);
                console.log("\tValidation errors: ".blue, ins(err));

                done(new Error(err.message));

                allDone = true;

            }).then(function(loadedObjects)
            {

                if(allDone)
                    return;

                //check our loaded objects for correctness
                // console.log(loadedObjects)


                done();

            }, function(err){if(allDone) return; done(new Error(err.message));allDone = true;})

    });

    it('Schema Manager Complex Schema',function(done){

        var schemaName = "NEATGenotype";
        var complexSchemaName = "complexSchema";

        //now we test that certain elements exist
        var ngExample = {wid: cuid(), nodes: [], connections: [], parents: [], dbType: schemaName};

        var child = traverse(ngExample).clone();
        child.wid = cuid();
        child.parents = [ngExample.wid];

        var c2 = traverse(child).clone();
        c2.wid = cuid();
        c2.parents = [child.wid, ngExample.wid];

        //now lets build something a bit more complex
        var complexExample = {wid: cuid(), dbType: complexSchemaName, parents: [], pictureGenotype: ngExample, 
            arrayGenotype: [{example: 0, genotypes: [{example2: 1, genotype2: ngExample}, {example2: 2, genotype2: child}]}],
            secondTest : {second: "doofus", genoSecond: child}};

        var complexDouble = traverse(complexExample).clone();
        complexDouble.wid = cuid();
        complexDouble.parents = [complexExample.wid];
        complexDouble.arrayGenotype.push({example: 3, genotypes: [{example2:4, genotype2: c2}]});

        //create an example to validate and save to db :)
        var examples = {};
        examples[complexExample.wid] = complexExample;
        // examples[ngExample.wid] = ngExample;
        // examples[child.wid] = child;

        var widList = [complexExample.wid];//[ngExample.wid, child.wid];

        //
        var allDone = false;

        var metaInfo = {user: "doofus", timeofcreation: Date.now(), session: "funtimesession"};

        schemaManager.asyncValidateAndSaveObjects(complexSchemaName, examples, metaInfo)
            .then(function()
            {
                //saved!
                console.log("\tValidated and saved, now to load the objects!".green);

                return schemaManager.asyncLoadObjects(complexSchemaName, widList);

            }, function(err)
            {
                allDone = true;
                console.log("\tFailed validation or saving :(\n".red);
                console.log("\tValidation errors: ".blue, ins(err));

                done(new Error(err.message));
            }).then(function(loadedObjects)
            {
                if(allDone)return;
                //check our loaded objects for correctness -- super complex!
                // console.log(loadedObjects)
                
                var nUserInfo = {user: "clown", timeofcreation: Date.now(), session: "funtimesession2"};

                var toSave = {};
                toSave[complexDouble.wid] = complexDouble;

                return schemaManager.asyncValidateAndSaveObjects(complexSchemaName, toSave, nUserInfo)

            }, function(err){ if(allDone)return; done(new Error(err.message)); allDone=true;})
            .then(function()
            {
                if(allDone)
                    return;

                console.log('\tSaved double complex object too!'.green);
                //we have to check to see if there are no duplicates in the database -- and that the correct meta inforation is returned
                done();
            }, function(err){ 
                console.log('\tFinal error: '.red, ins(err));
                if(allDone)return; done(new Error(err.message)); allDone=true;});

    });

});
