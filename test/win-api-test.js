
var assert = require('assert');
var should = require('should');
var color = require('colors');
var util = require('util');
var fs = require('fs');
var traverse = require('optimuslime-traverse');

var winAPIClass = require("../lib/win-api.js");

var cuid = require('win-utils').cuid;

var next = function(range)
{
    return Math.floor((Math.random()*range));
};

var dbModifier = "testmongo";
var dbLocation = 'mongodb://localhost/win' + dbModifier;

var winAPIObject;

var ins = function(obj, val)
{
    return util.inspect(obj, false, val || 10);
}

var metaProps = {
    user: "string",
    timeofcreation: "Number",
    session: "String"
}

describe('Testing WIN API -',function(){

    //we need to start up the WIN backend

    before(function(done){

        var configuration = {
            validator: {
                multipleErrors : true,
                allowAnyObjects : false,
                requireByDefault : true,
                metaProperties: metaProps
            },
            mongo : {dbLocation : dbLocation},
            redis: {}
        }

        winAPIClass.asyncLaunch(configuration)
            .catch(function(error)
            {
                //caught error!
                done(new Error(error.message));
            })
            .done(function(winObject)
            {   
                if(!winObject)
                    throw new Error("OOPS. Win object not returned to done");

                winAPIObject = winObject;

                done();
            });
    });

    beforeEach(function(done){

        console.log("\tClearing db now!".magenta)

        //load the schema 
        winAPIObject.dataAccess.loadWINSchemas("./test/schema")
            .then(function()
            {
                return winAPIObject.dataAccess.clearDatabases();
            })
            .catch(function(error)
            {
                console.log("\tDB Clear Fail.".red, error)

                //caught error!
                done(new Error(error.message));
            })
            .done(function(winObject)
            {   
                console.log("\tDBCleared!".green)
                done();
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

        var mainArtifactType = schemaName;
        winAPIObject.winShared.mainArtifactType = mainArtifactType;
        winAPIObject.dataAccess.publishWINArtifacts(examples, metaInfo)
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


        var mainArtifactType = schemaName;
        winAPIObject.winShared.mainArtifactType = mainArtifactType;
        winAPIObject.dataAccess.publishWINArtifacts(examples, metaInfo)
            .then(function()
            {
                //saved!
                console.log("\tValidated and saved, now to load the objects!".green);

                return winAPIObject.dataAccess.loadWINArtifacts(widList);

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

        var mainArtifactType = complexSchemaName;
        winAPIObject.winShared.mainArtifactType = mainArtifactType;
        
        winAPIObject.dataAccess.publishWINArtifacts(examples, metaInfo)
            .then(function()
            {
                //saved!
                console.log("\tValidated and saved, now to load the objects!".green);

                return winAPIObject.dataAccess.loadWINArtifacts(widList);

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

                return winAPIObject.dataAccess.publishWINArtifacts(toSave, nUserInfo)

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
