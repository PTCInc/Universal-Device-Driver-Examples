/*****************************************************************************
 * 
 * This file is copyright (c) 2022 PTC Inc.
 * All rights reserved.
 * 
 * Name: Unsolicited TCP Parser 
 * Description: Sets up a listening TCP server and parses expected data received 
 * into tags. Current configuration is for comma-seperated values modeled in JSON 
 * format by Python helper script.
 * Version: 1.0.0
 * 
 * Notes: 
 * -- Currently configured for use with Python helper script 
 * ---- "csvfile_to_tcp_with_watchdog.py"
 * -- If not using Python helper script, users must customize tag parsing function 
 * ---- based on incoming TCP data
 * 
******************************************************************************/
/**
 * @typedef {string} MessageType - Type of communication "Read", "Write".
 */

/**
 * @typedef {string} DataType - KEPServerEx datatype "Default", "String", "Boolean", "Char", "Byte", "Short", "Word", "Long", "DWord", "Float", "Double", "BCD", "LBCD", "Date", "LLong", "QWord".
 */

/**
 * @typedef {number[]} Data - Array of data bytes. Uint8 byte array.
 */

/**
 * @typedef {object} Tag
 * @property {string}   Tag.address  - Tag address.
 * @property {DataType} Tag.dataType - Kepserver data type.
 * @property {boolean}  Tag.readOnly - Indicates permitted communication mode.
 */ 
 
 /**
 * @typedef {object} CompleteTag
 * @property {string}   Tag.address  - Tag address.
 * @property {*}        Tag.value    - (optional) Tag value.
 */

/**
 * @typedef {object} OnProfileLoadResult
 * @property {string}   version     - Version of the driver.
 * @property {string}   mode        - Operation mode of the driver "Client", "Server".
 */

 /**
 * @typedef {object} OnValidateTagResult
 * @property {string}   address     - (optional) Fixed up tag address.
 * @property {DataType} dataType    - (optional) Fixed up Kepserver data type. Required if input dataType is "Default".
 * @property {boolean}  readOnly    - (optional) Fixed up permitted communication mode.
 * @property {boolean}  valid       - Indicates address validity.
 */ 

/**
 * @typedef {object} OnTransactionResult
 * @property {string}        action - Action of the operation: "Complete", "Receive", "Fail".
 * @property {CompleteTag[]} tags   - Array of tags (if any active) to complete. Undefined indicates tag is not complete.
 * @property {Data}          data   - The resulting data (if any) to send. Undefined indicates no data to send.
 */



/** Global variable for driver version */
const VERSION = "2.0";

/** Global variable for driver mode */
const MODE = "Server"

/** Status types */
const ACTIONRECEIVE = "Receive"
const ACTIONCOMPLETE = "Complete"
const ACTIONFAILURE = "Fail"

/** Avoid logging verbose protocol messages unless needed for debugging **/
const VERBOSE_LOGGING = true;

/** Captures the global log function so that it can be wrapped **/
let originalLogFunction = log;
log = function (msg) {
    if (VERBOSE_LOGGING == true) {
        originalLogFunction(msg);
    }
}

/**
 * Retrieve driver metadata.
 * 
 * @return {OnProfileLoadResult}  - Driver metadata.
 */
function onProfileLoad() {
    /* Initialize our internal global cache to store topic PUBLISH responses */
    initializeCache();

    return { version: VERSION, mode: MODE };
}

 /**
 * Validate an address.
 *
 * @param {object}  info          - Object containing the function arguments.
 * @param {Tag}     info.tag      - Single tag.
 *
 * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set.
 */
function onValidateTag(info) {
    // If tag is left with "Default" data type convert to String type and validate address as long as length is not null
    if (info.tag.dataType == 'Default') {
        info.tag.dataType = "String"
        info.tag.valid = info.tag.address.length > 0;
        return info.tag;
    }
    
    // If not Default, respect configured data type and validate address as long as length is not null
    else {
        info.tag.valid = info.tag.address.length > 0;
        return info.tag;
    }
}

/**
 * Handle request for a tag to be completed.
 *
 * @param {object}      info       - Object containing the function arguments.
 * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
 * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
 *
 * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
 */
function onTagsRequest(info) {
    // Perform a lookup in our internal cache for the tag
    const result = readFromCache(info.tags[0].address);
    if (result.value !== undefined) {
        info.tags[0].value = result.value;

        return { action: ACTIONCOMPLETE, tags: info.tags };
    }

    else {
        info.tags[0].value = 0
        return { action: ACTIONCOMPLETE, tags: info.tags };
    }
}

/**
 * Handle incoming data.
 *
 * @param {object}      info       - Object containing the function arguments.
 * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
 * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
 * @param {Data}        info.data  - The incoming data.
 *
 * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
 */
function onData(info) {
    const inboundData = info.data;
   
    log(`ParseMessage - Received payload from TCP client: ${inboundData}`);

    // Convert the response to a string
    let stringResponse = "";
    for (let i = 0; i < info.data.length; i++) {
        stringResponse += String.fromCharCode(info.data[i])
    }

    log(`onData - String Response: ${stringResponse}`)
    
    // Get the JSON body of the response
    let jsonStr = stringResponse.substring(stringResponse.indexOf('{'), stringResponse.lastIndexOf('}') + 1 );

    // Parse the JSON string and dump each feature's attribute-value pair into cache
    let jsonObj = JSON.parse(jsonStr);    
    for(var feature in jsonObj){
        var featureObj = jsonObj[feature]
        for (var attr in featureObj){
            var value = featureObj[attr]
            log(`${feature}.${attr}` + '=' + value)
            writeToCache(`${feature}.${attr}`, value)
        }
    }

    return { action: ACTIONCOMPLETE }
}