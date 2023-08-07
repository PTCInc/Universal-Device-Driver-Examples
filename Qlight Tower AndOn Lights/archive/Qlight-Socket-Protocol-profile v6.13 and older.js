/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name: Qlight-Socket-Protocol-profile.js
 * Description: Profile designed to communicate with a Qlight Ethernet based tower/andon 
 * lights. (https://www.qlight.com/en/) Documentation about the socket protocol can be found
 * at the vendors website (https://www.qlight.com/en/customer-support/technical-information/)
 * 
 * Developed against a QT50L-ETN model.
 * 
 * Developed on Kepware Server version 6.13, UDD V2.0
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

const MSGBUFFER = "Buffer"

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

/** Qlight Socket Constants **/
const RESPONSESTATUS = {
    ACK: 'A',
}
const COMMANDS = {
    READ: 'R',
    WRITE: 'W',
}

/**
 * Default Message Structure for QLight Socket Connetion.
 * Byte 0: Command
 * Byte 1: Sound Group Select (for certain models)
 * Byte 2: Red Light
 * Byte 3: Yellow Light
 * Byte 4: Green Light
 * Byte 5: Blue Light
 * Byte 6: White Light
 * Byte 7: Sound Selection
 * Byte 8-9: Spare
 */
const DEFAULTMSG = [0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]



/** Defined Tag Addresses **/
const TAGS_LIST = {
    "red": {
        offset: 2,
        dataType: data_types.WORD,
        readOnly: false
    }, 
    "yellow": {
        offset: 3,
        dataType: data_types.WORD,
        readOnly: false
    }, 
    "green": {
        offset: 4,
        dataType: data_types.WORD,
        readOnly: false
    },
    "blue": {
        offset: 5,
        dataType: data_types.WORD,
        readOnly: false
    }, 
    "white": {
        offset: 6,
        dataType: data_types.WORD,
        readOnly: false
    },
    "sound": {
        offset: 7,
        dataType: data_types.WORD,
        readOnly: false
    },
    "soundtype": {
        offset: 1,
        dataType: data_types.WORD,
        readOnly: false
    },
    // Used to reset all indicators and sounds. Provides no tag value.
    "reset": {
        msg: [0x57, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
}

/**
 * Since UDD v2.0 doesn't have "blocking" requests, the profile uses a read request of the red status
 * to trigger when the read request message gets populated
 */ 

const TRIGGERTAG = 'red'

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

    // Initialize cache for all tags. Used to handle "ps"
    let tag_list = Object.keys(TAGS_LIST)
    for(x of tag_list){
        writeToCache(x, 0)
    }

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

    log(`onValidateTag - info: ${JSON.stringify(info)}`, DEBUG_LOGGING)

    // Check if it's LoggingLevel tag
    if (info.tag.address === LOGGING_LEVEL_TAG.address) {
        info.tag = validateLoggingTag(info.tag)
        log('onValidateTag - address "' + info.tag.address + '" is valid.', DEBUG_LOGGING)
        return info.tag;
    }

    if (info.tag.address in TAGS_LIST) {
        info.tag.valid = true;
        info.tag.dataType = TAGS_LIST[info.tag.address].dataType;
        info.tag.readOnly = TAGS_LIST[info.tag.address].readOnly;
    } 
    else {
        info.tag.valid = false;
        log(`ERROR: Tag address "${info.tag.address}" is not valid`);
        return info.tag;
    }
    
    log(`onValidateTag - address "${info.tag.address}" is valid.`, VERBOSE_LOGGING)
    return info.tag;
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
    switch(info.type){
        // Read Request Handling
        case READ:
            // Only Send Request if it's the TRIGGERTAG that is being requested
            if (tag.address === TRIGGERTAG) {
                let readFrame = [...DEFAULTMSG]
                
                // Update Command byte Read Command
                readFrame[0] = stringToByteArray(COMMANDS.READ)[0];
                log(`onTagsRequest - readFrame: ${readFrame}`, DEBUG_LOGGING)
                return { action: ACTIONRECEIVE, data: readFrame }
            }
            // All other tags will be update via cache.
            else {
                tag.value = readFromCache(tag.address).value
                return { action: ACTIONCOMPLETE, tags: info.tags}
            }
        // Write Request Handling
        case WRITE:
            if (tag.address === 'reset') {
                log(`onTagsRequest - writeFrame: ${TAGS_LIST[tag.address].msg}`, DEBUG_LOGGING);
                return { action: ACTIONRECEIVE, data: TAGS_LIST[tag.address].msg };
            }
        
            if (tag.value > 255){
                tag.value = 255;
            }
            let writeFrame = [...DEFAULTMSG]

            // Update Command byte with Write Command
            writeFrame[0] = stringToByteArray(COMMANDS.WRITE)[0];

            // Update byte to write for command
            writeFrame[TAGS_LIST[tag.address].offset] = tag.value;
            log(`onTagsRequest - writeFrame: ${writeFrame}`, DEBUG_LOGGING);
            return { action: ACTIONRECEIVE, data: writeFrame };
        default:
            log(`ERROR: onTagRequest - Unexpected error. Command type unknown: ${info.type}`);
            return {action: ACTIONFAILURE};
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

    if (!info.hasOwnProperty('tags')){
        log(`ERROR: onData - No Tags in onData - Unexpected Message response.`, STD_LOGGING)
        return {action: ACTIONCOMPLETE};
    }
    
    let inboundData = info.data;
    log(`onData - inboundData: ${inboundData}`, DEBUG_LOGGING)

    /**
     * Test to see if full message response has been received. If not, reject request.
     */
    if (inboundData.length !== 10) {
        log(`ERROR: onData - MSG not complete. MSGBUFFER: ${inboundData}`, STD_LOGGING)
        return { action: ACTIONCOMPLETE }
    }

    // Currently only will receive one tag at a time
    let tag = info.tags[0];

    switch (info.type) {
        case READ:
        case WRITE:
            Object.keys(TAGS_LIST).forEach(key => {
                writeToCache(key, inboundData[TAGS_LIST[key].offset])
            });
            tag.value = readFromCache(tag.address).value
            return { action: ACTIONCOMPLETE, tags: info.tags }
        default:
            log(`ERROR: onData - Unexpected error. Command type unknown: ${info.type}`);
            return {action: ACTIONFAILURE};
    }
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