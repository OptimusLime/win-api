
var assert = require('assert');
var should = require('should');
var color = require('colors');
var util = require('util');
var fs = require('fs');
var traverse = require('optimuslime-traverse');

var winSchemaClass = require('../lib/schema/win-schema.js');

var mongoose = require('mongoose');

var next = function(range)
{
    return Math.floor((Math.random()*range));
};

var dbModifier = "testmongo";

var mongooseConnection;

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

        winschema = new winSchemaClass(configuration);

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
            done();
        });

    });

    // beforeEach(function(done){
    //     console.log('');
    //     var schemaLoader = winapp.winRoutes.schemaLoader;

    //     var allSchema = schemaLoader.getSchemaModels();

    //     var schemaArray = [];
    //     for(var key in allSchema)
    //         schemaArray.push(allSchema[key]);

    //     //we've created an array of models
    //     //now we need to clean out the models, for a clean slate!
    //     var emptyIx = 0;

    //     for(var i=0; i < schemaArray.length; i++)
    //     {
    //         schemaArray[i].remove({}, function(err){

    //             emptyIx++;
    //             if(emptyIx == schemaArray.length)
    //                 done();

    //         });
    //     }

    // });


    var refCountObject = function(obj)
    {
        var allPaths = traverse(obj).paths();
        var refcount = 0;
        allPaths.forEach(function(path)
        {
            if(path.length &&  path[path.length-1] == 'ref')
                refcount++;
        });

        return refcount;
    };


    it('schema generator',function(done){

        var generator = require("../lib/mongo/schemaConverter.js")();

        //let's process a new schema object
        var schemaName = 'complexSchema';
        var neatSchemaName = "NEATGenotype";

        var complexSchemaRead =  fs.readFileSync("./test/schema/" + schemaName + ".json");
        var neatGenotypeSchemaRead =  fs.readFileSync("./test/schema/" + neatSchemaName + ".json");

        var complexSchema= JSON.parse(complexSchemaRead);
        var ngSchema = JSON.parse(neatGenotypeSchemaRead);

        console.log('\tLoaded schema: '.green, ins(ngSchema));

        var e = winschema.addSchema(neatSchemaName, ngSchema);

        //make sure no errors!
        should.not.exist(e.error);

        var e = winschema.addSchema(schemaName, complexSchema);
        should.not.exist(e.error);


        var allSchema = winschema.getSchema([neatSchemaName, schemaName]).schema;
        console.log('\t double trouble schema: '.red, allSchema);
        var ngProcessed = allSchema[0];
        var complexProcessed = allSchema[1];

        console.log("\tProcessed NG Schema: \n".magenta, ins(ngProcessed));

        //do the simple object first
        var ngMappedSchema = generator.mapConvert(ngProcessed);

        //no references please!
        refCountObject(ngMappedSchema).should.equal(0);

        // console.log("\tMapped NG Schema: ".blue, ins(ngMappedSchema));

        //takes a json schema, and turns it into an actual schema
        console.log("\tProcessed COMPLEX Schema: \n".magenta, ins(complexProcessed));

        var cmplxMappedSchema = generator.mapConvert(complexProcessed);

        // //no more references please!
        refCountObject(cmplxMappedSchema).should.equal(0);

        // schemaLoader.traverseProcess(schemaName, schema);

        done();




    });

});
