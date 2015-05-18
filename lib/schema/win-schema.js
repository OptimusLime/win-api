//pull in the validating workhorse -- checks schema and stuff
var tv4 = require('tv4');
//pull in traverse object from the repo please!
var traverse = require('optimuslime-traverse');

//pull in the object that knows what all schema look like!
var schemaSpec = require('./schemaSpec.js');

var addSchemaSupport = require('./addSchema');

module.exports = winSchema;

function winSchema(localConfiguration)
{
  localConfiguration = localConfiguration || {};

	//load up basic win-module stufffff
	var self = this;

  self.pathDelimiter = "///";

  self.log = console.log;

  //this creates "internalAddSchema" to handle the weighty add logic
  //need to thoroughly test and modify incoming schema to align with 
  //logical schema setup for WIN
  addSchemaSupport(self, localConfiguration.metaProperties);

	self.validator = tv4.freshApi();

  //config setups
  self.multipleErrors = (localConfiguration.multipleErrors == true || localConfiguration.multipleErrors == "true");
 
  //by default you can have unknown keys -- the server environment may desire to change this
  //if you don't want to be storing extra info
  //by default, on lockdown -- better that way -- no sneaky stuff
  self.allowUnknownKeys = localConfiguration.allowUnknownKeys || false;

  //all keys are required by default -- this adds in required objects for everything
  self.requireByDefault = (localConfiguration.requireByDefault == undefined ? true : localConfiguration.requireByDefault);

  //do we allow properties with just the type "object" or "array"
  //this would allow ANY data to be fit in there with no validation checks (other than it is an object or array)
  //shouldn't allow this because people could slip in all sorts of terrible things without validation
  self.allowAnyObjects = localConfiguration.allowAnyObjects || false;

  //cache all our schema by type
  self.allSchema = {};
  self.schemaReferences = {};
  self.requiredReferences = {};
  self.fullSchema = {};
  self.primaryPaths = {};
  self.typeProperties = {};

  self.validTypes = "\\b" + schemaSpec.definitions.simpleTypes.enum.join('\\b|\\b') + "\\b"; //['object', 'array', 'number', 'string', 'boolean', 'null'].join('|');
  self.typeRegExp = new RegExp(self.validTypes);

  self.specKeywords = ["\\$ref|\\babcdefg"];
  for(var key in schemaSpec.properties)
    self.specKeywords.push(key.replace('$', '\\$'));

  //join using exact phrasing checks
  self.specKeywords = self.specKeywords.join('\\b|\\b') + "\\b";
  self.keywordRegExp = new RegExp(self.specKeywords);

  // self.log("--Specced types: ".green, self.validTypes);
  // self.log("--Specced keywords: ".green, self.specKeywords);

  self.validateFunction = (self.multipleErrors ? self.validator.validateMultiple : self.validator.validateResult);
  self.errorKey = self.multipleErrors ? "errors" : "error";

  function listTypeIssues(type)
  {
    if(!self.allSchema[type]){
      return "Schema type not loaded: " + type;
    }

    //we have to manually detect missing references -- since the validator is not concerned with such things
    //FOR WHATEVER REASON
    var missing = self.validator.getMissingUris();
    for(var i=0; i < missing.length; i++)
    {
      //if we have this type inside our refernces for this object, it means we're missing a ref schema for this type!
      if(self.requiredReferences[type][missing[i]])
      {
        return "Missing at least 1 schema definition: " + missing[i];
      }
    }
  }

  function internalValidate(schema, object)
  {
    //validate against what type?
    var result = self.validateFunction.apply(self.validator, [object, schema, true, !self.allowUnknownKeys]);

     //if it's not an array, make it an array
    //if it's empty, make it a damn array
    var errors = result[self.errorKey];

    //if you are multiple errors, then you are a non-undefined array, just return as usual
    //otherwise, you are an error but not in an array
    //if errors is undefined then this will deefault to []
    errors = (errors && !Array.isArray(errors)) ? [errors] : errors || [];

    return {valid : result.valid, errors : errors};
  }

  self.validateDataArray = function(type, objects)
  {
    var typeIssues = listTypeIssues(type);

    //stop if we have type issues
    if(typeIssues)
    {
      return {error: typeIssues};
    }
    else if(typeof type != "string" || !Array.isArray(objects))
    {
      return {error: "ValidateMany requires type [string], objects [array]"};
    }

    var schema = self.validator.getSchema(type);
    // self.log('validate many against: ', schema);

    var allValid = true;
    var allErrors = [];
    for(var i=0; i < objects.length; i++)
    {
      var result = internalValidate(schema, objects[i]);

      if(!result.valid){
        allValid = false;
        allErrors.push(result.errors);
      }
      else //no error? just push empty array!
        allErrors.push([]);
    }

    //if we have errors during validation, they'll be passed on thank you!
    //if you're valid, and there are no errors, then don't send nuffin
    return {isValid: allValid, validationErrors: (!allValid ? allErrors : undefined)};
  }
  self.validateData = function(type, object)
  {
    var typeIssues = listTypeIssues(type);

    //stop if we have type issues
    if(typeIssues)
    {
      return {error: typeIssues};
    }

    //log object being checked
    // self.log("Validate: ", object);

    //now we need to validate, we definitely have all the refs we need
    var schema = self.validator.getSchema(type);

    //log what's being validated
    // self.log('validate against: ', schema);
  	 
    var result = internalValidate(schema, object);

    //if we have errors during validation, they'll be passed on thank you!
    //if you're valid, and there are no errors, then don't send nuffin
    return {isValid: result.valid, validationErrors:  (result.errors.length ? result.errors : undefined)};
  }

  //todo: pull reference objects from schema -- make sure those exist as well?
 	self.addSchema = function(type, schemaJSON, options)
 	{
    //pass args into internal adds
    return self.internalAddSchema.apply(self, arguments);
 	}

 	    //todo: pull reference objects from schema -- make sure those exist as well?
 	self.getSchema = function(typeOrArray)
 	{   	
    //did we request one or many?
    var typeArray = typeOrArray;
    if(typeof typeOrArray == "string")
    {
      //make single type to return
      typeArray = [typeOrArray];
    }

    var refArray = [];
    for(var i=0; i < typeArray.length; i++)
    {
      var sType = typeArray[i];

    //failed to get schema for some very odd reason?
      if(!self.allSchema[sType]){
        return {error: "Schema type not loaded: " + sType};
      }
      //push our reference information as a clone
      refArray.push(traverse(self.validator.getSchema(sType)).clone());
      //if you hit an error -send back
      if(self.validator.error){
        return {error: self.validator.error};
      }
    }

    //send the schema objects back
    //send an array regardless of how many requested -- standard behavior
    return {schema: refArray};    

 	}

 	self.getSchemaReferences = function(typeOrArray)
 	{
    var typeArray = typeOrArray;
    if(typeof typeOrArray == "string")
    {
      //make single type to return
      typeArray = [typeOrArray];
    }

    var refArray = [];
    for(var i=0; i < typeArray.length; i++)
    {
      var sType = typeArray[i];

      if(!self.allSchema[sType]){
        return {error: "Schema type not loaded: " + sType};
      }
      //push our reference information as a clone
      refArray.push(traverse(self.requiredReferences[sType]).clone());
    }

		//send the refernece objects back
    //if you are a single object, just send the one -- otherwise send an array
    return {schemaReferences: refArray}; 		
 	}

  var buildFullSchema = function(type)
  {
    var schema = self.validator.getSchema(type);
    var tSchema = traverse(schema);

    // console.log('\t validator schema: '.blue, require('util').inspect(schema,false, 10));

    var clone = tSchema.clone();
    var tClone = traverse(clone);
    var references = self.schemaReferences[type];

    for(var path in references)
    {
      //we get the type of reference
      var schemaInfo = references[path];
      var refType = schemaInfo.schemaType;

      //this is recursive behavior -- itwill call buidl full schema if not finished yet
      var fullRefSchema = internalGetFullSchema(refType);

      if(!fullRefSchema)
        throw new Error("No schema could be created for: " + refType + ". Please check it's defined.");

      //now we ahve teh full object to replace
      var tPath = path.split(self.pathDelimiter);

      // self.log(self.log.testing, 'Path to ref: ', tPath, " replacement: ", fullRefSchema);
      // console.log('\t set schema at path: '.blue, tPath, require('util').inspect(fullRefSchema,false, 10));

      //use traverse to set the path object as our full ref object
      tClone.set(tPath, fullRefSchema);
    }
      // console.log('\t final schema: '.magenta, require('util').inspect(tClone,false, 10));
      // console.log('\t final schema clone: '.green, require('util').inspect(clone,false, 10));

    // self.log(self.log.testing, "Returning schema: ", type, " full: ", clone);

    return clone;
  }
  var inprogressSchema = {};

  function internalGetFullSchema(type)
  {
    if(inprogressSchema[type])
    {
        throw new Error("Infinite schema reference loop: " + JSON.stringify(Object.keys(inprogressSchema)));    
    }

    inprogressSchema[type] = true;

     //if we don't have a full type yet, we build it
    if(!self.fullSchema[type])
    {
      //need to build a full schema object
      var fSchema = buildFullSchema(type);

      // console.log('\t Full schema for type: '.cyan, type, require('util').inspect(fSchema,false, 10));

      self.fullSchema[type] = fSchema;
    }

    //mark the in progress as false!
    delete inprogressSchema[type];

    return self.fullSchema[type];
  }

  self.getFullSchema = function(typeOrArray)
  { 
    var typeArray = typeOrArray;
    if(typeof typeOrArray == "string")
    {
      //make single type to return
      typeArray = [typeOrArray];
    }

    var fullArray = [];
    for(var i=0; i < typeArray.length; i++)
    {
      var sType = typeArray[i];

       if(!self.allSchema[sType]){
        return {error: "Schema type not loaded: " + sType};
      }

      try
      {
        //get the full schema from internal function
        //throws error if something is wrong
        var fullSchema = internalGetFullSchema(sType);

        // console.log('\t Full schema for type: '.cyan, sType, require('util').inspect(fullSchema,false, 10));

       
        //pull the full object -- guaranteed to exist -- send a clone
         fullArray.push(traverse(fullSchema).clone());
      }
      catch(e)
      {
        //send the error if we have one
        return {error: e};
      }
    }

    //send the refernece objects back
    //if you are a single object, just send the one -- otherwise send an array
    return {fullSchema: fullArray};
  }

  self.getSchemaProperties = function(typeOrArray)
  {
     var typeArray = typeOrArray;
    if(typeof typeOrArray == "string")
    {
      //make single type to return
      typeArray = [typeOrArray];
    }

    var propArray = [];
    for(var i=0; i < typeArray.length; i++)
    {
      var sType = typeArray[i];

       if(!self.allSchema[sType]){
        return {error: "Schema type not loaded: " + sType};
      }

      //get our schema properties
      propArray.push({type: sType, primaryPaths: traverse(self.primaryPaths[sType]).clone(), properties: traverse(self.typeProperties[sType]).clone()});

    }


    //send the refernece objects back
    //if you are a single object, just send the one -- otherwise send an array
    return {schemaProperties: propArray};
  }

  //we're going to clone the object, then replace all of the reference wids with new an improved parents
  self.cloneReplaceParentReferences = function(type, object, parentMapping)
  {
    var tClone = traverse(object).clone();

    traverse(tClone).forEach(function(node)
    {
       //if we have a wid object and parents object -- likely we are a tracked reference
      if(this.node.wid && this.node.parents)
      {
        var replaceParents = parentMapping[this.node.wid];

        if(replaceParents)
        {
          //straight up replacement therapy yo
          this.node.parents = replaceParents;

          //then make sure to update and continue onwards!
          this.update(this.node);
        }
      }
    })

    //we've replaced the innards of the object with a better future!
    return {clone: tClone};
  }

  self.getReferencesAndParents = function(type, widObjects)
  {

      //listed by some identifier, then the object, we need to look through the type, and pull references
      var fSchema = internalGetFullSchema(type);
      // self.log("Full schema: ", fSchema);
      if(!fSchema)
      {
        return {error: "Full schema undefined, might be missing a reference type within " + type};
      } 
      var widToParents = {};
      var traverseObjects = {};

      for(var wid in widObjects){
        widToParents[wid] = {};
        traverseObjects[wid] = traverse(widObjects[wid]);
      }

      
      //for every wid object we see, we loop through and pull that 
      traverse(fSchema).forEach(function(node)
      {
        // self.log("Node: ", this.node, "", " key: ", this.key);
        //if we have a wid object and parents object -- likely we are a tracked reference
        if(this.node.wid && this.node.parents)
        {
          //let's pull these bad boys our of our other objects
          var pathToObject = self.stripObjectPath(this.path);
          
          //if you aren't root, split it up!
          if(pathToObject != "")
            pathToObject = pathToObject.split(self.pathDelimiter);

          // self.log("\nKey before :", this.key, " node-p: ", this.parent.node, " path: ", this.path);
          
          var isArray = (this.key == "properties" && this.path[this.path.length - 2] == "items");
          // self.log("Is array? : ", isArray);
          for(var wid in traverseObjects)
          {

            var wtp = widToParents[wid];
            var tob = traverseObjects[wid];


            //fetch object from our traverse thing using this path
            var arrayOrObject = tob.get(pathToObject);

            // self.log("Path to obj: ", pathToObject, " get: ", arrayOrObject);

            //grab wid to parent mappings, always cloning parent arrays
            if(isArray)
            {
              for(var i=0; i < arrayOrObject.length; i++)
              {
                var aobj = arrayOrObject[i];
                //map wid objects to parent wids always thank you
                wtp[aobj.wid] = aobj.parents.slice(0);
              }
            }
            else
              wtp[arrayOrObject.wid] = arrayOrObject.parents.slice(0);

            //now we've aded a mapping from the objects wid to the parents for that wid

          }
        }
      });

      //we send back the wids of the original widObjects mapped to the wid internal reference && the corresponding parents
      //so many damn layers -- it gets confusing
      return {referencesAndParents: widToParents};

  }

  function getAllTypeDependencyArrays(type)
  {
    var allTypes = {};

    var typesToInvestigate = [type];

    while(typesToInvestigate.length)
    {
      var nextType = typesToInvestigate.shift();

      //lets all the types
      if(!allTypes[nextType])
        allTypes[nextType] = [];

      var refs = self.requiredReferences[nextType];

      if(refs && refs.length)
      {
        for(var i=0; i < refs.length; i++)
        {
          var rType = refs[i];

          //never saw this type before -- must investigate!
          if(!allTypes[rType])
          {
            typesToInvestigate.push(rType);
            allTypes[rType] = [];
          }
        }
      }
    }

    return allTypes;    
  }

  function grabArrayRefLocations(splitPath)
  {

    var arrayIxs = [];

    for(var i=0; i < splitPath.length; i++)
      if(splitPath[i] == "items")
        arrayIxs.push(i);

      return arrayIxs;
  }

  function createArrayPaths(rawRefPath, tob)
  {
    var splitPath = rawRefPath.split(self.pathDelimiter);

    var arrayIxs = grabArrayRefLocations(splitPath);

      //we need to build a path for each one
      var compilePaths = [];

      //grab our first ix
      var aIx = arrayIxs[0];

      //clone the path to this location
      var firstArrayPath = self.stripObjectPath(splitPath.slice(0, aIx));

      if(typeof firstArrayPath == "string")
        firstArrayPath = [firstArrayPath];

      // console.log("First array: ", firstArrayPath, " split: ", splitPath, " aIx: ", aIx);

      //get our objects at this path location
      var arrayOfObjects = tob.get(firstArrayPath);

      // console.log("Fetched at first array: ".cyan, arrayOfObjects);

      for(var x=0; x < arrayOfObjects.length; x++)
        compilePaths.push(firstArrayPath.slice(0).concat(x.toString()));

      //where was the last path location of arrays -- this is a nightmare
      var lastIx = aIx;

      for(var i=1; i < arrayIxs.length; i++)
      {
        //grab the next location
        aIx = arrayIxs[i];

        var nextCompile = [];

        //grab the old compiled paths, now we need to build on the next chunk
        var followupLocation = self.stripObjectPath(splitPath.slice(lastIx, aIx));

        //for each compile path, we create the next location
        for(var c=0; c < compilePaths.length; c++)
        {
          var trueLocation = compilePaths[c].concat(followupLocation);

          var objs = tob.get(trueLocation);

          for(var j=0; j < objs.length; j++)
          {
            nextCompile.push(trueLocation.slice(0).concat(j.toString()));
          }
        }

        //move up one, then continue
        lastIx = aIx;

        compilePaths = nextCompile;
      }

      if(lastIx != splitPath.length - 1)
      {
        var fAppend = self.stripObjectPath(splitPath.slice(lastIx, splitPath.length));

        for(var i=0; i < compilePaths.length; i++)
        {
          //append the last pieces -- there are no arrays in those chunks
          compilePaths[i] = compilePaths[i].concat(fAppend);
        }
      }

      // console.log("All Compiled paths: ".magenta, compilePaths);


      //when we're all done, we have ALL the locations for these objects to pull
      return compilePaths;
  }

  self.appendMetaInformation = function(aObjects, metaInfo)
  {
    if(!metaInfo)return;

    for(var i=0; i < aObjects.length; i++)
    {
      //we're going to append meta info anywhere we encounter a Wid
      var mObject = aObjects[i];

      traverse(mObject).forEach(function(node)
      {
        if(this.node.wid){
          node.meta = metaInfo;
          this.update(node);
        }
      });

      // console.log('\tNow with meta'.magenta, mObject);
    }

    return aObjects;
  }

  self.getDatabaseObjects = function(type, widObjects, options)
  {
    options = options || {};
    var typeToObjects = {};

    //set it up before leaving
    typeToObjects[type] = widObjects;

    var typeToParentConnections = {};

    var parentConnections = [];
    typeToParentConnections[type] = parentConnections;

    if(!options.skipConnections)
    {
      for(var wid in widObjects)
      { 
        var o = widObjects[wid];

        for(var p=0; p < o.parents.length; p++)
        { 
          //mark connection between child and parent
          parentConnections.push({child: wid, parent: o.parents[p]});
        }
      }
    }

    //get all of the refernce types for this type
    var allTypeRefs = self.requiredReferences[type];

    if(!allTypeRefs || allTypeRefs.length == 0)
    {


      //we don't have any references -- return our objects -- we're all done
      return {typeToObjects: typeToObjects, typeToParentConnections: typeToParentConnections};
    }

    //otherwise -- we have more to look at

    //we need to tease apart our objects
    var traverseObjects = {};

    for(var wid in widObjects){
      traverseObjects[wid] = traverse(widObjects[wid]);
    }

    //we need to investigate each object -- by looking at each referenced object
    var typeRefs = self.schemaReferences[type];

    //lets search each reference, then send the objects in for recursive checks/replacements
    for(var refPath in typeRefs)
    {

      //we check what type of ref we have
      var schemaRefInfo = typeRefs[refPath];

      //what type is this?
      var schemaType = schemaRefInfo.schemaType;

      var innerWIDToObjects = {};

      //let's pull these bad boys our of our other objects
      var pathToObject = self.stripObjectPath(refPath.split(self.pathDelimiter));
          
      //if you aren't root, split it up!
      if(pathToObject != "")
        pathToObject = pathToObject.split(self.pathDelimiter);

      //are we an array?
      var splitPathRaw = refPath.split(self.pathDelimiter);

      var arrayIxs = grabArrayRefLocations(splitPathRaw);

      //do we have ANY array concepts inside
      var isArray = (arrayIxs.length != 0);//(splitPathRaw[splitPathRaw.length -1] == "items");
          

      // console.log("Investigating: ".red, pathToObject, " isArray? " + isArray);


      for(var wid in traverseObjects)
      {
        var tob = traverseObjects[wid];

        // console.log('Path: ', pathToObject);

        var allObjects;

        if(isArray)
        {
          //we need to fetch all our refernce path locations for this object
          var arrayPathLocations = createArrayPaths(refPath, tob);

          //these contain ALL the path locations for EACH object of interest
          allObjects = [];
          for(var k=0; k < arrayPathLocations.length; k++)
            allObjects.push(tob.get(arrayPathLocations[k]));

          // for(var k=0; k < arrayPathLocations.length; k++)
          // {
          //   tob.set(arrayPathLocations[k], allObjects[k].wid);
          // }

          // console.log("All objects paths: ".blue, arrayPathLocations);
          // console.log("All objects for arrays: ".magenta, allObjects);

        }
        else //no arrays involved? EASY MONEY -- just grab the one object
        {

            //we get potentially multiple objects per references for arrays
            //but if you're not an array, we only get one
            allObjects = [tob.get(pathToObject)];

            // tob.set(pathToObject, allObjects[0].wid);
        }

        for(var x=0; x < allObjects.length; x++)
        {
          var iObject = allObjects[x];

          //grab the inner object
          innerWIDToObjects[iObject.wid] = iObject;

          //replace the object in the overall traversal with a wid string reference
          //do NOT replace -- it's much easier to double up information than it is to perform
          //several reads to construct a single object in the DB -- derrrr

          // if(isArray)
          // {
          //   // console.log("Trying to set: ".red, pathToObject.slice(0).concat(x.toString()), " to: ", iObject.wid);
          //   tob.set(pathToObject.slice(0).concat(x.toString()), iObject.wid);
          // }
          // else{
          //   // console.log("Trying to set: ".red, pathToObject, " to: ", iObject.wid);
          //   tob.set(pathToObject, iObject.wid);
          // }
        }
      }

      var recursiveObjectsForType = self.getDatabaseObjects(schemaType, innerWIDToObjects);

      //now combine according to type!
      var innerTypeToObjects = recursiveObjectsForType.typeToObjects;
      var innerParentConnections = recursiveObjectsForType.typeToParentConnections;

      //merge the two types together
      for(var typeKey in innerTypeToObjects)
      {

        var existingList = typeToObjects[typeKey];
        if(!existingList)
        {
          existingList = {};
          typeToObjects[typeKey] = existingList;
        }

        var objs = innerTypeToObjects[typeKey];
        for(var widKey in objs)
        {
            existingList[widKey] = objs[widKey];
        }

        var existingConnections = typeToParentConnections[typeKey];
        if(!existingConnections)
        {
          existingConnections = [];
          typeToParentConnections[typeKey] = existingConnections;
        }

        existingConnections = existingConnections.concat(innerParentConnections[typeKey]);
        typeToParentConnections[typeKey] = existingConnections;
      }


    }

    //we've gone through everyone -- we're all done
    return {typeToObjects: typeToObjects, typeToParentConnections: typeToParentConnections};
  }


    

	return self;
}



