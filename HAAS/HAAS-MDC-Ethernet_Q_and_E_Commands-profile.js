/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name: HAAS-MDC-Ethernet_Q_and_E_Commands-profile.js
 * Description: Profile designed to communicate with a HAAS CNC machines
 * using the Machine Data Collection (MDC) interface with Q and E commands. 
 * https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/machine-data-collection---ngc.html
 * 
 * Be aware that this profile is not tested against an actual MDC interface.
 * 
 * Developed on Kepware Server version 6.13
 * 
 * 
 * Version: 0.1.0
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

//Incoming data buffer
const MSGBUFFER = ""

/** Global variable for Write only tag value */
const WRITEONLYVALUE = "WRITE ONLY";

/** HAAS Constants **/
const COMMAND_TERMINATOR = '\n';
const RESPONSE_TERMINATOR = '\r\n';
const SPACE_CHARACTER = ' ';

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
 * Logging Level System tag - control logging level from client application
 * This can be used to avoid logging verbose SDS protocol messages unless 
 * needed for debugging
 */

const LOGGING_LEVEL_TAG = {
    address: "LoggingLevel",
    dataType: data_types.WORD,
    readOnly: false,
}
const STD_LOGGING = 0;
const VERBOSE_LOGGING = 1;
const DEBUG_LOGGING = 2;
// Sets initial Logging Level
const LOGGING_LEVEL = DEBUG_LOGGING;

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


/**
 * Retrieve driver metadata.
 * 
 * @return {OnProfileLoadResult}  Driver metadata.
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

    // Initialize message buffer
    writeToCache(MSGBUFFER, '')


    return { version: VERSION, mode: MODE };
}


/**
 * Validate an address.
 *
 * @param {object}  info          Object containing the function arguments.
 * @param {Tag}     info.tag      Single tag.
 *
 * @return {OnValidateTagResult}  Single tag with a populated '.valid' field set.
 */

function onValidateTag(info) {
 
    // Check if it's LoggingLevel tag
    if (info.tag.address === LOGGING_LEVEL_TAG.address) {
        info.tag = validateLoggingTag(info.tag)
        log('onValidateTag - address "' + info.tag.address + '" is valid.', DEBUG_LOGGING)
        return info.tag;
    }

    /*
     * The regular expression to compare address to.
     * Tag syntax is allowed in 3 formats:
     * ?Qxxx (except ?Q600)
     * ?Q600 xxxxx
     * ?Exxxxx
     */
    let regex = /^([?]E[0-9]{1,5}|[?]Q(?!600)[0-9]{1,3}|[?]Q600\s[0-9]{1,5})*?$/;

    try {
        // Validate the address against the regular expression
        if (regex.test(info.tag.address)) {
            info.tag.valid = true;
            info.tag.readOnly = false;
            // Fix the data type to the correct one
            if (info.tag.dataType === data_types.DEFAULT){
                info.tag.dataType = data_types.STRING
            }
            log('onValidateTag - address "' + info.tag.address + '" is valid.', VERBOSE_LOGGING)
        } else {
            info.tag.valid = false;
            log("ERROR: Tag address '" + info.tag.address + "' is not valid");
        }
        return info.tag
    }
    catch (e) {
        // Use log to provide helpful information that can assist with error resolution
        log("ERROR: onValidateTag - Unexpected error: " + e.message);
        info.tag.valid = false;
        return info.tag;
    }
}


/**
 * Handle request for a tag to be completed.
 *
 * @param {object}      info       Object containing the function arguments.
 * @param {MessageType} info.type  Communication mode for tags. Can be undefined.
 * @param {Tag[]}       info.tags  Tags currently being processed. Can be undefined.
 *
 * @return {OnTransactionResult}   The action to take, tags to complete (if any) and/or data to send (if any).
 */

function onTagsRequest(info) {
    log(`onTagsRequest - info: ${JSON.stringify(info)}`, VERBOSE_LOGGING)

    // Currently only will receive one tag at a time
    let tag = info.tags[0];

    // Check if tag is LoggingLevel, update from cached value
    if (tag.address === LOGGING_LEVEL_TAG.address){
       let returnAction = updateLoggingTag(info);
       return returnAction;
    }


    // Validate the address against the regular expression for ?E addresses
    let regexE = /^([?]E[0-9]{1,5})*?$/;

    switch(info.type){
        case READ:
            // Provide "WRITE ONLY" for E addresses
            if (regexE.test(tag.address)) {
                tag.value = WRITEONLYVALUE
                return { action: ACTIONCOMPLETE, tags: info.tags }
            }
            // Send command as same as tag address for Q addresses
            else{
                let command_string = `${tag.address}${COMMAND_TERMINATOR}`
                log(`onTagsRequest - command_string: ${command_string}`, DEBUG_LOGGING)
                let writeFrame = stringToByteArray(command_string)
                log(`onTagsRequest - writeFrame: ${writeFrame}`, DEBUG_LOGGING)
                return { action: ACTIONRECEIVE, data: writeFrame }
            }
        case WRITE:
            // Send command to write for E addresses
            if (regexE.test(tag.address)) {
                let command_string = `${tag.address}${SPACE_CHARACTER}${tag.value}${COMMAND_TERMINATOR}`
                log(`onTagsRequest - command_string: ${command_string}`, DEBUG_LOGGING)
                let writeFrame = stringToByteArray(command_string)
                log(`onTagsRequest - writeFrame: ${writeFrame}`, DEBUG_LOGGING)

                // no check to verify or acknowledge Write requests. Transaction is completed after the write requests is sent.
                return { action: ACTIONCOMPLETE, data: writeFrame }
            }
            // Writing is not possible for Q addresses
            else{
                log(`ERROR: onTagRequest - Tags with Q type addresses cannot be written.`);
                return {action: ACTIONFAILURE};
            }
        default:
            log(`ERROR: onTagRequest - Unexpected error: ${info.type}`);
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
    log(`onData - info: ${JSON.stringify(info)}`, DEBUG_LOGGING)

    // Convert message data to string
    let inboundData = byteToString(info.data);

    // Currently only will receive one tag at a time
    let tag = info.tags[0];

    //Read buffer and add incoming data
    let buffer = readFromCache(MSGBUFFER).value
    buffer = `${buffer}${inboundData}`

    /**
     * Test to see if full message response has been received. If not, wait for more data from the device.
     * For connections to devices with serial to ethernet convertors the payload may not come in one Ethernet message.
     */
    if (!buffer.includes(RESPONSE_TERMINATOR)) {
        log(`onData - Response is not complete. Response: ${buffer}`, DEBUG_LOGGING)
        writeToCache(MSGBUFFER, buffer);
        return { action: ACTIONRECEIVE }
    }

    /** 
     * Special condition for ?Q500 (Three-in-one (PROGRAM, Oxxxxx, STATUS, PARTS, xxxxx)). 
     * There are multiple information provided for this command. The response is provide as value as-is without any parsing.
    */
    if (tag.address == "?Q500") {
        tag.value = buffer
        log(`tag.value: ${tag.value}`, DEBUG_LOGGING)
        // Reset MSGBUFFER for next response
        writeToCache(MSGBUFFER, '');
        return { action: ACTIONCOMPLETE, tags: info.tags }
    }

    // Parsing for any other Q commands, done by splitting on comma
    let response = buffer.split(', ')
    let responseValue = response[1]
    log(`responseValue: ${responseValue}`)

    tag.value = responseValue
    log(`tag.value: ${tag.value}`, DEBUG_LOGGING)

    // Reset MSGBUFFER for next response
    writeToCache(MSGBUFFER, '');

    return { action: ACTIONCOMPLETE, tags: info.tags};

}


/**
 * Helper function to translate string to bytes.
 * Required.
 * 
 * @param {string} str
 * @return {Data} 
 */
function stringToByteArray(str) {
    let byteArray = [];
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i) & 0xFF;
        byteArray.push(char);
    }

    // return an array of bytes
    return byteArray;
}

/**
 * Converts a byte or byte array into a string
 * @param   {byte[] or byte} byteAry The byte or byte array to stringify
 * @returns {string}                 A stringified version of the byte or byte array
 */
 function byteToString(byteAry){
    let stringResponse = "";
    if (!Array.isArray(byteAry)){
        return String.fromCharCode(byteAry);
    }
    for (let i = 0; i < byteAry.length; i++) {
        stringResponse += String.fromCharCode(byteAry[i]);
    }
    return stringResponse
}

/**
 * Validate LoggingLevel tag
 * @param {Tag} tag 
 * @returns {Tag} LoggingLevel Tag validation results
 */

 function validateLoggingTag(tag) {
    if (tag.dataType === data_types.DEFAULT){
        tag.dataType = data_types.WORD
    }
    tag.readOnly = false;
    tag.valid = true;

    return tag
}

/**
 * Update the Logging tag to either read the value or modify the level.
 * @param {info} info 
 * @returns {OnTransactionResult} Transaction Result for LoggingLevel Tag
 */
function updateLoggingTag(info) {
    let value = undefined;
    if (info.type === WRITE){
        writeToCache(LOGGING_LEVEL_TAG.address, info.tags[0].value)
        return {action: ACTIONCOMPLETE}
    }
    else {
        value = readFromCache(LOGGING_LEVEL_TAG.address).value
        info.tags[0].value = value;
        return { action: ACTIONCOMPLETE, tags: info.tags};
    }
}
