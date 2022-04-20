/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name:        generic-string-delimited-tcp-example
 * Description: A simple example profile that can connect to a TCP server that sends simple
 * delimited string data as values.
 * 
 * Can be setup to be a solicited request (request response) or unsolicted listener from
 * the TCP server.
 * 
 * Developed on Kepware Server version 6.11, UDD V2.0
 * 
 * Version:     0.1.0
******************************************************************************/
/**
 * @typedef {string} MessageType - Type of communication "Read", "Write".
 */

/**
 * @typedef {string} DataType - Kepware datatype "Default", "String", "Boolean", "Char", "Byte", "Short", "Word", "Long", "DWord", "Float", "Double", "BCD", "LBCD", "Date", "LLong", "QWord".
 */

/**
 * @typedef {number[]} Data - Array of data bytes. Uint8 byte array.
 */

/**
 * @typedef {object} Tag
 * @property {string}   Tag.address  - Tag address.
 * @property {DataType} Tag.dataType - Kepware data type.
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
 * @property {DataType} dataType    - (optional) Fixed up Kepware data type. Required if input dataType is "Default".
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
const MODE = "Client"

/** Status types */
const ACTIONRECEIVE = "Receive"
const ACTIONCOMPLETE = "Complete"
const ACTIONFAILURE = "Fail"
const READ = "Read"
const WRITE = "Write"

// Change profile to solicit string or listen for unsolicited data publishes
// Values are "Solicited" or "Unsolicited"
const DATAMODE = "Unsolicited"

/**
 * Logging Level System tag - control logging level from client application
 * This can be used to avoid logging verbose SDS protocol messages unless 
 * needed for debugging
 */

 const LOGGING_LEVEL_TAG = {
    address: "LoggingLevel",
    dataType: "word",
    readOnly: false,
}
const STD_LOGGING = 0;
const VERBOSE_LOGGING = 1;
const DEBUG_LOGGING = 2;
// Sets initial Logging Level
const LOGGING_LEVEL = STD_LOGGING;

/** Captures the global log function so that it can be wrapped **/
let originalLogFunction = log;
log = function (msg, level = STD_LOGGING) {
    switch (readFromCache(LOGGING_LEVEL_TAG.address).value) {
        case VERBOSE_LOGGING:
            if (level <= VERBOSE_LOGGING) {
                originalLogFunction(msg);
            }
            break;
        case DEBUG_LOGGING:
            if (level <= DEBUG_LOGGING) {
                originalLogFunction(msg);
            }
            break;
        default:
            if (level == STD_LOGGING) {
                originalLogFunction(msg);
            } 
            break;
    }
}

// Global variable for all Kepware supported data_types
const data_types = {
    DEFAULT: "Default",
    STRING: "String", 
    BOOLEAN: "Boolean", 
    CHAR: "Char",
    BYTE: "Byte",
    SHORT: "Short",
    WORD: "Word",
    LONG: "Long",
    DWORD: "DWord",
    FLOAT: "Float",
    DOUBLE: "Double",
    BCD: "BCD",
    LBCD: "LBCD",
    LLONG: "LLong",
    QWORD: "QWord" 
}



/**
 * Retrieve driver metadata.
 * 
 * @return {OnProfileLoadResult}  - Driver metadata.
 */
 function onProfileLoad() {

    // Initialized our internal cache
    try {
        initializeCache();
        
    } catch (e){
        // If this fails it means the cache has already been initialized
    }

    // Initialize LoggingLevel control
    writeToCache(LOGGING_LEVEL_TAG.address, LOGGING_LEVEL);

    return { version: VERSION, mode: MODE };
}

/**
 * Validate an address.
 *
 * @param {object}  info          - Object containing the function arguments.
 * @param {Tag}     info.tag      - Single tag.
 *
 * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set.
 *
 * 
 * 
*/
function onValidateTag(info) {

    // Check if it's LoggingLevel tag
    if (info.tag.address === LOGGING_LEVEL_TAG.address) {
        info.tag = validateLoggingTag(info.tag)
        log('onValidateTag - address "' + info.tag.address + '" is valid.', VERBOSE_LOGGING)
        return info.tag;
    }

    
    /** 
     * The regular expression to compare address to. This example just validates that 
     * the address is at least one any "word" character, similar to [a-zA-Z0-9_]
     * 
     * Example TCP stream:
     * 2021-01-29T11:30:440Z|Source|TRAN_1|pH|2.1|EC|3.2|CONC|4.4|FluidTemp|5.5|DO|6.7
     * 
    */
    let regex = /^\w+$/;

    try {
        // Validate the address against the regular expression
        if (regex.test(info.tag.address)) {
            info.tag.valid = true;
            // Fix the data type to the correct one
            if (info.tag.dataType === data_types.DEFAULT){
                info.tag.dataType = data_types.STRING
            }
            log('onValidateTag - address "' + info.tag.address + '" is valid.', VERBOSE_LOGGING)
        } 
        else {
            info.tag.valid = false;
            log("ERROR: Tag address '" + info.tag.address + "' is not valid");
        }

        return info.tag
    }
    catch(e) {
        // Use log to provide helpful information that can assist with error resolution
        log("ERROR: onValidateTag - Unexpected error: " + e.message);
        info.tag.valid = false;
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
    log(`onTagsRequest - info: ${JSON.stringify(info)}`, DEBUG_LOGGING)

    switch(info.type){
        case READ:
            if(DATAMODE == "Solicited"){
                /**
                 * Put appropriate handlers to build request message based on
                 * protocol definitions 
                 */ 

                let request = "BUILD REQUEST MESSAGE HERE";
                let readFrame = stringToBytes(request);
                return { action: ACTIONRECEIVE, data: readFrame };
            }
            else if (DATAMODE == "Unsolicited"){
                /**
                 * Unsolicited data will be stored in the driver cache. Update tag 
                 * from driver cache
                 */ 

                // If first read of value, intialize cache with 0 value.
                if (readFromCache(info.tags[0].address).value !== undefined){
                    info.tags[0].value = readFromCache(info.tags[0].address).value 
                    return { action: ACTIONCOMPLETE, tags: info.tags }
                }
                else {
                    writeToCache(info.tags[0].address, 0)
                    info.tags[0].value = 0 
                    return { action: ACTIONCOMPLETE, tags: info.tags }
                }
            }
            else{
                log(`ERROR: onData - Unexpected error. DATAMODE unknown ${DATAMODE}`);
                return { action: ACTIONFAILURE }
            }
            
            
        case WRITE:
            // Writes are not built into example/API
            log(`ERROR: onTagRequest - Write command for address "${info.tags[0].address}" is not supported.`)
            return { action: ACTIONFAILURE };
        default:
            log(`ERROR: onTagRequest - Unexpected error. Command type unknown: ${info.type}`);
            return { action: ACTIONFAILURE };
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
    log(`onValidateTag - info: ${JSON.stringify(info.tags)}`, DEBUG_LOGGING)

    // Writes are not permitted
    if (info.type === WRITE){
        return {action: ACTIONFAILURE}  // tags field not needed in "Failure" case
    }

    // Convert the response to a string
    let stringResponse = "";
    for (let i = 0; i < info.data.length; i++) {
        stringResponse += String.fromCharCode(info.data[i]);
    }
    
    var data = stringResponse;
    log(`onData - String Response: ${stringResponse}`, DEBUG_LOGGING)

    var data_array = data.split('|');
    log(`onData - Array of String response: ${JSON.stringify(data_array)}`, DEBUG_LOGGING)

    writeToCache('date', data_array.shift())

    for(let i=0; i<data_array.length; i=i+2) {
        writeToCache(data_array[i],data_array[i+1])
    }

    switch(DATAMODE) {
        case "Solicited":
            let tags = info.tags;
            // Evaluate each tag's address and get the JSON value 
            tags.forEach(function (tag) {
                tag.value = readFromCache(tag.address).value
                if (tag.value == undefined || tag.value == null) {
                    log(`ERROR: onData - Unexpected error. Address ${tag.address} not found in cache.`);
                    return { action: ACTIONFAILURE }
                }
            });
            return { action: ACTIONCOMPLETE, tags: info.tags };
        case "Unsolicited":
            // No action needed tags are updated during onTagsRequest() event
            return { action: ACTIONCOMPLETE }
        default:
            log(`ERROR: onData - Unexpected error. DATAMODE unknown ${DATAMODE}`);
            return { action: ACTIONFAILURE }
    }
}


/**
 * Helper function to translate string to bytes.
 * Required.
 * 
 * @param {string} str
 * @return {Data} 
 */
 function stringToBytes(str) {
    let byteArray = [];
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i) & 0xFF;
        byteArray.push(char);
    }

    // return an array of bytes
    return byteArray;
}