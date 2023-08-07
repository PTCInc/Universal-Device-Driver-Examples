/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name: MT-SICS-profile.js
 * Description: Profile designed to communicate with a Mettler Toledo scales 
 * using the Standard Interface Command Set interface. Only Level 0 and Level 1 commands
 * are implemented in this proile.
 * 
 * Please refer to Mettler Toledo documentation for specific details for specific models.
 * 
 * Developed against a IND780 model indicator with SICS set to serial interface with a serial 
 * to Ethernet convertor.
 * 
 * Developed on Kepware Server version 6.12, UDD V2.0
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

/** SICS Constants **/
const SICS_TERMINATOR = '\r\n';
const RESPONSESTATUS = {
    ACK: 'A',
    NACK: 'I',
    OVER: '+',
    UNDER: '-',
    DYNAMIC: 'D',
    STABLE: 'S',
    L: 'L',
}
const SICSERRORS = {
    ES: 'SYNTAX ERROR', // The balance has not recognized the received command.
    ET: 'TRANSMISSION ERROR', // The balance has received a "faulty" command, e.g. owing to a parity error or interface break
    EL: 'LOGICAL ERROR', // The balance can not execute the received command.
}


/** Defined Tag Addresses separated by SICS Level **/
const LEVEL0_TAGS_LIST = {
    // TODO: I0 - Read all SICS commands available. Likely implement as a "write" tag that 
    // would trigger reading the data only when written to and store in cache.
    // "I0": {
    //     dataType: data_types.STRING,
    //     readOnly: true
    // },
    "I1": {
        command: 'I1',
        dataType: data_types.STRING,
        readOnly: true
    }, 
    "I2": {
        command: 'I2',
        dataType: data_types.STRING,
        readOnly: true
    }, 
    "I3": {
        command: 'I3',
        dataType: data_types.STRING,
        readOnly: true
    },
    "I4": {
        command: 'I4',
        dataType: data_types.STRING,
        readOnly: true
    }, 
    "I5": {
        command: 'I5',
        dataType: data_types.STRING,
        readOnly: true
    },
    "S": {
        command: 'S',
        dataType: data_types.FLOAT,
        readOnly: true
    },
    "SI": {
        command: 'SI',
        dataType: data_types.FLOAT,
        readOnly: true
    },
    // TODO: SIR implementation - SIR is a subscription based call. Returns values periodically.
    // "SIR": {
    //     command: 'SIR',
    //     dataType: data_types.FLOAT,
    //     readOnly: true
    // },
    "Z": {
        command: 'Z',
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
    "ZI": {
        command: 'ZI',
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
    "@": {
        command: '@',
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
}

const LEVEL1_TAGS_LIST = {
    // "D": {
    //     command: 'D',
    //     dataType: data_types.STRING,
    //     readOnly: false
    // }, 
    "DW": {
        command: 'DW',
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
    // "K": {
    //     dataType: data_types.STRING,
    //     readOnly: false
    // }, 
    // "SR": {
    //     dataType: data_types.FLOAT,
    //     readOnly: false
    // }, 
    "T": {
        command: 'T',
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
    "TA": {
        command: 'TA',
        dataType: data_types.FLOAT,
        readOnly: true
    },
    "TAC": {
        command: 'TAC',
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
    "TI": {
        command: 'TI',
        dataType: data_types.BOOLEAN,
        readOnly: false
    },
}

const tag_list = {...LEVEL0_TAGS_LIST, ...LEVEL1_TAGS_LIST}
const write_only_list = ['Z', 'ZI', '@', 'DW', 'T', 'TAC', 'TI']

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

    // Initialize Write Only tags
    for(x of write_only_list){
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

    if (info.tag.address in tag_list) {
        info.tag.valid = true;
        info.tag.dataType = tag_list[info.tag.address].dataType;
        info.tag.readOnly = tag_list[info.tag.address].readOnly;
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
        case READ:
            switch(tag_list[tag.address].command) {
                // Tags with simple request command structure
                case 'I1':
                case 'I2':
                case 'I3':
                case 'I4':
                case 'I5':
                case 'S':
                case 'SI':
                case 'TA':
                    let command_string = `${tag_list[tag.address].command}${SICS_TERMINATOR}`
                    log(`onTagsRequest - command_string: ${command_string}`, DEBUG_LOGGING)
                    let writeFrame = stringToByteArray(command_string)
                    log(`onTagsRequest - writeFrame: ${writeFrame}`, DEBUG_LOGGING)
                    return { action: ACTIONRECEIVE, data: writeFrame }
                // All tags to be updated from cache, not request from device
                case 'Z':
                case 'ZI':
                case '@':
                case 'DW':
                case 'T':
                case 'TAC':
                case 'TI':
                    tag.value = readFromCache(tag.address).value
                    return { action: ACTIONCOMPLETE, tags: info.tags }
                default:
                    log(`ERROR: onTagRequest - Unexpected error. SICS command type unknown: ${tag_list[tag.address].command}`);
                    return {action: ACTIONFAILURE};
            }
        case WRITE:
            switch(tag_list[tag.address].command) {
                case 'Z':
                case 'ZI':
                case '@':
                case 'DW':
                case 'T':
                case 'TAC':
                case 'TI':
                    let command_string = `${tag_list[tag.address].command}${SICS_TERMINATOR}`
                    let writeFrame = stringToByteArray(command_string)
                    return { action: ACTIONRECEIVE, data: writeFrame }
                case 'TA':
                default:
                    log(`ERROR: onTagRequest - Unexpected error. SICS command type unknown: ${tag_list[tag.address].command}`);
                    return {action: ACTIONFAILURE};
            }
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
    
    // Verify this isn't a sporatic response without a onTagRequest tied to the data. Stable weight command ('S') will delay a response 
    // until either the scale stablizes or the scale timeout is met (set in the 'stability' parameters on  the indicator). If the driver 
    // timeout is less than the scale stability timeout and the scale is not stable before the driver timeout, the driver will retry. 
    // The scale will queue the requests and eventually send an "extra" response.
    // TODO: Modify once SIR is implemented
    if (!info.hasOwnProperty('tags')){
        log(`onData - No Tags in onData - Likley 'S' command timeout edge case. See profile code comments.`, DEBUG_LOGGING)
        writeToCache(MSGBUFFER, '');
        return {action: ACTIONCOMPLETE};
    }

    let buffer = readFromCache(MSGBUFFER).value
    
    // Convert message data to string and separate into multiple SDS messages as needed.
    let inboundData = byteToString(info.data);

    buffer = `${buffer}${inboundData}`
    log(`onData - buffer: ${buffer}`, DEBUG_LOGGING)
    

    /**
     * Test to see if full message response has been received. If not, wait for more data from the device.
     * For connections to devices with serial to ethernet convertors the payload may not come in one Ethernet message.
     */
    if (!buffer.includes(SICS_TERMINATOR)) {
        log(`onData - MSG not complete. MSGBUFFER: ${MSGBUFFER}`, DEBUG_LOGGING)
        writeToCache(MSGBUFFER, buffer);
        return { action: ACTIONRECEIVE }
    }

    buffer = buffer.replace(/\r\n$/g,'')

    // Split on space and remove all empty elements
    let responseData = buffer.split(' ').filter(n=>n)

    let responseID = responseData[0]

    // Currently only will receive one tag at a time
    let tag = info.tags[0];

    if (SICSERRORS.hasOwnProperty(responseID)) {
        log(`ERROR: SICS Error for tag address '${tag_list[tag.address].command}'. Returned '${responseID}': ${SICSERRORS[responseID]}`);
        // Reset MSGBUFFER for next response
        writeToCache(MSGBUFFER, '');
        return {action: ACTIONCOMPLETE};
    }

    // Validating Response from SICS interface. Certain responses expect different command IDs from the sent message.
    switch (tag_list[tag.address].command) {
        case 'SI':
        // TODO: Placeholder for SIR implementation 
        // case 'SIR':
            if (responseID !== 'S') {
                // TODO: ERROR HANDLING FOR KNOWN ERROR MESSAGES
                log(`ERROR: Unexpected Command Response. SICS response ID expected: ${tag_list[tag.address].command} Device returned: ${responseID}`);
                // Reset MSGBUFFER for next response
                writeToCache(MSGBUFFER, '');
                return {action: ACTIONCOMPLETE};
            }
            break;
        case '@':
            if (responseID !== 'I4') {
                // TODO: ERROR HANDLING FOR KNOWN ERROR MESSAGES
                log(`ERROR: Unexpected Command Response. SICS response ID expected: ${tag_list[tag.address].command} Device returned: ${responseID}`);
                // Reset MSGBUFFER for next response
                writeToCache(MSGBUFFER, '');
                return {action: ACTIONCOMPLETE};
            }
            break;
        default:
            if (responseID !== tag_list[tag.address].command) {
                // TODO: ERROR HANDLING FOR KNOWN ERROR MESSAGES
                log(`ERROR: Unexpected Command Response. SICS response ID expected: ${tag_list[tag.address].command} Device returned: ${responseID}`);
                // Reset MSGBUFFER for next response
                writeToCache(MSGBUFFER, '');
                return {action: ACTIONCOMPLETE};
            }
    }

    let responseStatus = responseData[1]
    let responseValue = responseData.slice(2)
    log(`onData - responseValue: ${responseValue}`, DEBUG_LOGGING)
    let returnAction = {}
    switch(info.type){
        case READ:
            switch(tag_list[tag.address].command) {
                case 'I1':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            let value = responseValue.join(' ')
                            tag.value = value
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform SICS Level and Versions read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'I2':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            let value = responseValue.join(' ')
                            tag.value = value
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Balance Data read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'I3':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            let value = responseValue.join(' ')
                            tag.value = value
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform SW Version and Type Definition read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'I4':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            let value = responseValue.join(' ')
                            tag.value = value
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Serial Number read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'I5':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            let value = responseValue.join(' ')
                            tag.value = value
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform SW Identification Number read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'S':
                    switch(responseStatus) {
                        case RESPONSESTATUS.STABLE:
                            tag.value = responseValue[0]
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Stable Weight read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.OVER:
                            log(`ERROR: Overload range of Stable Weight during read.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.UNDER:
                            log(`ERROR: Underload range of Stable Weight during read.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    } 
                    break;
                case 'SI':
                    switch(responseStatus) {
                        case RESPONSESTATUS.DYNAMIC:
                        case RESPONSESTATUS.STABLE:
                            tag.value = responseValue[0]
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Stable Weight Immediate read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.OVER:
                            log(`ERROR: Overload range of Stable Weight Immediate during read.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.UNDER:
                            log(`ERROR: Underload range of Stable Weight Immediate during read.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    } 
                    break;
                case 'TA':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            tag.value = responseValue[0]
                            returnAction = { action: ACTIONCOMPLETE, tags: info.tags}
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Tare Weight Value read command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                default:
                    log(`ERROR: onTagRequest - Unexpected error. SICS command type unknown: ${tag_list[tag.address].command}`);
                    returnAction = {action: ACTIONFAILURE};
            }
            break;
        case WRITE:
            switch(tag_list[tag.address].command) {
                // All tags to be updated from cache, not request from device
                case 'Z':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Zero setting command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.OVER:
                            log(`ERROR: Upper limit of Zero setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.UNDER:
                            log(`ERROR: Lower limit of Zero setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'ZI':
                    switch(responseStatus) {
                        // TODO: Provide Stable or Dynamic result back.
                        case RESPONSESTATUS.DYNAMIC:
                        case RESPONSESTATUS.STABLE:
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Zero Immediately setting command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.OVER:
                            log(`ERROR: Upper limit of Zero Immediately setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.UNDER:
                            log(`ERROR: Lower limit of Zero Immediately setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case '@':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'DW':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Display Weight setting command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                // TODO: Handle response with weight value change
                case 'T':
                    switch(responseStatus) {
                        case RESPONSESTATUS.STABLE:
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Tare setting command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.OVER:
                            log(`ERROR: Upper limit of Tare setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.UNDER:
                            log(`ERROR: Lower limit of Tare setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'TAC':
                    switch(responseStatus) {
                        case RESPONSESTATUS.ACK:
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Clear Tare setting command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                case 'TI':
                    switch(responseStatus) {
                        // TODO: Provide Stable or Dynamic result back.
                        case RESPONSESTATUS.DYNAMIC:
                        case RESPONSESTATUS.STABLE:
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.NACK:
                            log(`ERROR: Unable to perform Tare Immediately setting command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.OVER:
                            log(`ERROR: Upper limit of Tare Immediately setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.UNDER:
                            log(`ERROR: Lower limit of Tare Immediately setting range exceeded during command.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                        case RESPONSESTATUS.L:
                            log(`ERROR: Unable to perform Tare Immediately setting command. Device responds that it is CERTIFIED.`)
                            returnAction = { action: ACTIONCOMPLETE }
                            break;
                    }
                    break;
                default:
                    log(`ERROR: onTagRequest - Unexpected error. SICS command type unknown: ${tag_list[tag.address].command}`);
                    returnAction = {action: ACTIONFAILURE};
            }
            break;
        default:
            log(`ERROR: onTagRequest - Unexpected error. Command type unknown: ${info.type}`);
            returnAction = {action: ACTIONFAILURE};
    }

    // Reset MSGBUFFER for next response
    writeToCache(MSGBUFFER, '');
    return returnAction;
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