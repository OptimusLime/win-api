
var assert = require('assert');
var should = require('should');
var colors = require('colors');

var winSchemaClass = require('../lib/schema/win-schema.js');

var winschema;

var Q = require('q');
var util = require('util');


var otherSchema = {
    type : "array",
    things : "string"
    // {"$ref" : "exampleSchema"}
};
var exampleSchema  = {
    // noFirst : "object",
    // yesFirst : {type: "object", yesSecond: {noThird: "array", noFourth: "object"}},
    bugger : {aThing : "string", inner: {type: "array", test: "string"}},
    // noSecond : "array",
    ref : {"$ref": "secondSchema"},
    firstArray: {
        type : "array",
        "$ref": "secondSchema",
        // items : {
            // type : "object",
            // properties :{
                // stuff : "string"
            // }
        // }
    }
    // required : ['hope', 'stuff']     
};

describe('Testing Win Schema -',function(){

    //we need to start up the WIN backend
    before(function(done){

		var configuration = 
		{
			multipleErrors : true,
			allowAnyObjects : false,
			requireByDefault : true
		};

        winschema = new winSchemaClass(configuration);

        done();

    });

   it('Should tell me references successfully',function(done){

        var otherSchema = {
            type : "object",
            things : "string"
        };
        var exampleSchema  = {
            bugger : {aThing : "string", inner: {type: "array", test: "string"}},
            ref : {"$ref": "t1Schema2"},
            firstArray: {
                type : "array",
                "$ref": "t1Schema2",
            }
        };
        var validExample = {
            bugger : {aThing : "help", inner:[]},
            // hope : { notProp: 5, isProp: 5},
            ref : {wid: "refWID", parents: ["refp1", "refp2"], things : "stuff"},
            firstArray : [{wid: "arrayWID", parents: ["arrayp1", "arrayp2"], dbType: "t1Schema2", things: "stuff"}],
            wid : "originalObject"
            ,dbType : "t1Schema"
            ,parents : ["op1"]
        };

        var e = winschema.addSchema("t1Schema1", exampleSchema);
        console.log('Add 1', e);
        e = winschema.addSchema("t1Schema2", otherSchema, {skipWINAdditions: false});
        console.log('Add 2', e);

        var fullSchema = winschema.getFullSchema("t1Schema1");

        console.log('Full: ', fullSchema);

        var tests = {};
        tests[validExample.wid] = validExample;

        var refsAndParents = winschema.getReferencesAndParents("t1Schema1", tests).referencesAndParents;
        // console.log("Parent refs: ", refsAndParents);

        console.log("\tSchema ref and parents: \n".cyan, util.inspect(refsAndParents, false, 10), "\n");

        var refs = refsAndParents[validExample.wid];
        validExample.parents.join(',').should.equal(refs[validExample.wid].join(','));
        validExample.ref.parents.join(',').should.equal(refs[validExample.ref.wid].join(','));
        validExample.firstArray[0].parents.join(',').should.equal(refs[validExample.firstArray[0].wid].join(','));


        done();

    });

   it('Should replace references successfully',function(done){

        var otherSchema = {
            type : "object",
            things : "string"
        };
        var exampleSchema  = {
            bugger : {aThing : "string", inner: {type: "array", test: "string"}},
            ref : {"$ref": "t2Schema-2"},
            firstArray: {
                type : "array",
                "$ref": "t2Schema-2",
            }
        };
        var validExample = {
            bugger : {aThing : "help", inner:[]},
            // hope : { notProp: 5, isProp: 5},
            ref : {wid: "refWID", parents: ["refp1", "refp2"], things : "stuff"},
            firstArray : [{wid: "arrayWID", parents: ["arrayp1", "arrayp2"], dbType: "t2Schema-2", things: "stuff"}],
            wid : "originalObject"
            ,dbType : "t2Schema-1"
            ,parents : ["op1"]
        };

        var toReplace = {};

        winschema.addSchema("t2Schema-1", exampleSchema);
        winschema.addSchema("t2Schema-2", otherSchema, {skipWINAdditions: false});

        var fullSchema = winschema.getFullSchema("t2Schema-1");

        toReplace[validExample.wid] = ["rootReplace"];
        toReplace[validExample.ref.wid] = ["refReplace1", "refReplace2"];
        toReplace[validExample.firstArray[0].wid] = ["farrayReplace1", "farrayReplace2"]

        var replaceClone = winschema.cloneReplaceParentReferences("t2Schema-1", validExample, toReplace);

        var replaced = replaceClone.clone;

        console.log("\tOriginal: \n".magenta, validExample);
        console.log('\tReplaced: \n'.blue, replaced)

        validExample.dbType = "bubbly";
        //test that we made an actual clone, not the same object
        validExample.dbType.should.not.equal(replaced.ref);

        toReplace[validExample.wid].join('').should.equal(replaced.parents.join(''));
        toReplace[validExample.ref.wid].join('').should.equal(replaced.ref.parents.join(''));
        toReplace[validExample.firstArray[0].wid].join('').should.equal(replaced.firstArray[0].parents.join(''));

        done();
        
    });

    it('Should strip smaller database objects from full objects', function(done)
    {

        var otherSchema = {
            type : "object",
            things : "string"
        };

        var exampleSchema  = {
            bugger : {aThing : "string", inner: {type: "array", test: "string"}},
            ref : {"$ref": "t4Schema"},
            firstArray: {
                type : "array",
                "$ref": "t4Schema",
            }
        };

        var validExample = {
            bugger : {aThing : "help", inner:[]},
            // hope : { notProp: 5, isProp: 5},
            ref : {wid: "refWID", parents: ["refp1", "refp2"], things : "stuff"},
            firstArray : [{wid: "arrayWID", parents: ["arrayp1", "arrayp2"], dbType: "t4Schema", things: "stuff"}],
            wid : "originalObject"
            ,dbType : "t3Schema"
            ,parents : ["op1"]
        };


        var toReplace = {};

        winschema.addSchema("t3Schema", exampleSchema);
        winschema.addSchema("t4Schema", otherSchema);
        

        var tests = {};
        tests[validExample.wid] = validExample;

        var fullObjectsForDatabase =  winschema.getDatabaseObjects("t3Schema", tests);

        console.log('\tFull DB Objects: '.blue, util.inspect(fullObjectsForDatabase, false, 10));
       

        done();

    });

    it('Should add schema successfully',function(done){

        console.log('Skipping a schema test for add schema'.red);
        done();
        return;

        var otherSchema = {
            type : "object",
            things : "string"
        };

        var exampleSchema  = {
            bugger : {aThing : "string", inner: {type: "array", test: "string"}},
            ref : {"$ref": "t2Schema-2"},
            firstArray: {
                type : "array",
                "$ref": "t2Schema-2",
            }
        };

    	var thingy = {
    		bugger : {skip : "string"},
    		hope : "stuff",
    		stuff : {
    			num : 4,
    			inner : {

    				geno : {things : []},
    				geno2 : "some string"
    			}
    		}
    	}

    	var validExample = {
    		bugger : {aThing : "help", inner:[]},
    		// hope : { notProp: 5, isProp: 5},
    		ref :[ 
    			{things : "stuff"}
    		],
    		firstArray : [[{things: "stuff"}]],
    		wid : "abcded"
    		,dbType : "exampleSchema"
    		,parents : []
    		// , stuff : {
    			// num : "5",
    			// inner: {
    				// geno : {},
    				// geno2 : "some string"
    			// },
    			// wrong : "things"
    		// },
    		// not : "the right stuff"
    	};


        console.log("\tAdding schema".green);

        winschema.addSchema("exampleSchema", exampleSchema);
        winschema.addSchema("secondSchema", otherSchema, {skipWINAdditions: false});


        var sRefs = winschema.getSchemaReferences("exampleSchema");
        console.log("\tSchema refs: ".cyan, util.inspect(sRefs, false, 10));

        var fullSchema = winschema.getFullSchema("exampleSchema");

        console.log("\tFull schema: ".blue, util.inspect(fullSchema, false, 10));


        var validate = winschema.validateData("exampleSchema", validExample);

        console.log('Valid? ' + validate.isValid);

        if(validate.isValid)
            should.not.exist(validate.validationErrors);// issues.errors.should.not.exist();
        else
            should.exist(validate.validationErrors);


        var schemaProps = winschema.getSchemaProperties(["exampleSchema", "secondSchema"]).schemaProperties;

        console.log("\n\tSchema props: ".magenta, schemaProps[0], "\n")
        console.log("\n\tSchema props2: ".magenta, schemaProps[1], "\n")

        var validateArray = winschema.validateDataArray("exampleSchema", [validExample, thingy]);

        console.log('All valid? ' + validateArray.isValid);

        var issues = validateArray.validationErrors;

        if(!validateArray.isValid)
        {
            var validity = [];
            for(var i=0; i < issues.length; i++)
            {
                console.log("Is object " + i + " valid? ".green, (issues[i].length ? "No.".red : "Yes.".blue));
                var aIssue = issues[i];
                for(var e=0; e < aIssue.length; e++)
                {
                    validity.push(aIssue[e].dataPath + "- issue: " + aIssue[e].message);
                }
            }
            throw new Error(JSON.stringify(validity));
        }

        if(validateArray.isValid)
            should.not.exist(issues);// issues.errors.should.not.exist();
        else
            should.exist(issues);
        
        done();
    });

});