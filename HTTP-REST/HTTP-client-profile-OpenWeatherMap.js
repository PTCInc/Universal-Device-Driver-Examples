/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name:        HTTP-client-profile-OpenWeatherMap
 * Description: A simple HTTP example profile that queries from a RESTful endpoint
 * that is expecting a JSON object returned in the response.
 * 
 * OpenWeatherMap (https://openweathermap.org/api) has APIs that can be queried for various
 * weather data. This example uses the One Call API (https://openweathermap.org/api/one-call-api)
 * 
 * User will need to create a free API key to be able to query endpoint
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

/** HTTP Global variables */
const READTYPE = "GET"
const HTTP_HEADER_TERMINATOR = '\r\n'
const CHUNKED_TERMINATOR = '\r\n'
var response_header = {}
var http_response = null

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

    // Initialize the http_response cache to handle multi packet processing
    http_response = new HttpResponse()

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
 * Unlike traditional PLC devices HTTP protocol doesn't use a defined data encoding and
 * the types of data that can be use drastically vary. Many requests for systems that use HTTP 
 * can often return a JSON object. We can use this object to return multiple tag values.
 * 
 * Example JSON:
 * {
 *  "visibility": 1000,
 *  "wind": {
 *      "speed": 8.38,
 *      "direction": "north" 
 *      },
 *  "weather": [
 *      {
 *      "main": "sunny",
 *      "description": "partly sunny"
 *      }
 *      {
 *      "main": "sunny",
 *      "description": "mostly sunny"
 *      }
 *  ]
 * }
 * 
 * Here are three examples of addresses we can use in this JSON use case
 * 1. <key> ex. Tag address = “visibility”
 * 2. <key>:<value> ex. Tag address = “wind:speed”
 * 3. <key>[<index>]:<value> ex. Tag address = “weather[0]:main”
 * 
 * If the value asked for is a JSON object, it will be returned as a string 
 * representation of that value.
 * 
 * Tag address = "wind"
 * Value returned = {"speed": 8.38, "direction": "north"}
 * 
 * We will use this address to help parse the data in onData
*/
function onValidateTag(info) {

    // Check if it's LoggingLevel tag
    if (info.tag.address === LOGGING_LEVEL_TAG.address) {
        info.tag = validateLoggingTag(info.tag)
        log('onValidateTag - address "' + info.tag.address + '" is valid.', VERBOSE_LOGGING)
        return info.tag;
    }
    
    /*
     * The regular expression to compare address to.
     * ^, & Starting and ending anchors respectively. The match must occur between the two anchors
     * [a-zA-Z]+ At least 1 or more characters between 'a' and 'z' or 'A' and 'Z'
     * [0-9]+ At least 1 or more digits between 0 and 9
     * | is an or statement between the expressions in the group
     * ()* Whatever is in the parentheses can appear 0 or unlimited times
     */
    let regex = /^[a-zA-Z]+(\[[0-9]+\]|:[a-zA-Z]+)*$/;

    try {
        // Validate the address against the regular expression
        if (regex.test(info.tag.address)) {
            info.tag.valid = true;
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
 * @param {object}      info       - Object containing the function arguments.
 * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
 * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
 *
 * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
 */
function onTagsRequest(info) {
    log(`onTagsRequest - info: ${JSON.stringify(info)}`, DEBUG_LOGGING)

    // Check if tag is LoggingLevel, update from cached value
    if (info.tags[0].address === LOGGING_LEVEL_TAG.address){
        let returnAction = updateLoggingTag(info);
        return returnAction;
    }

    switch(info.type){
        case READ:
            // Build the request as a string
            let appId = "{Update API Key}";  // API key
            // Host information
            let host = "api.openweathermap.org"; // IP address of REST 
            let port = "80"

            let request = ""
   
            if(READTYPE == "GET"){
                // API that uses teh One Call API 1.0 from OpenWeatherMap.org
                let lat = "43.65" // Latitude of location
                let lon = "-70.25" // Longitude of location 
                let abs_path = `/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${appId}`
                request = `${READTYPE} ${abs_path} HTTP/1.1${HTTP_HEADER_TERMINATOR}`;
                request += `Host: ${host}:${port}${HTTP_HEADER_TERMINATOR}`;
                request += `Accept: application/json${HTTP_HEADER_TERMINATOR}`;
                request += HTTP_HEADER_TERMINATOR;
            }
            else if (READTYPE == "POST"){
                // API Does not support POST commands
                return {action: ACTIONFAILURE}
            }
            else{
                // Error State
                return {action: ACTIONFAILURE}
            }
            
            let readFrame = stringToBytes(request);
            return {action: ACTIONRECEIVE, data: readFrame};
        case WRITE:
            // Writes are not built into example/API
            log(`ERROR: onTagRequest - Write command for address "${info.tags[0].address}" is not supported.`)
            return {action: ACTIONFAILURE};
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
    log(`onValidateTag - info: ${JSON.stringify(info.tags)}`, DEBUG_LOGGING)

    // Writes are not permitted
    if (info.type === WRITE){
        return {action: ACTIONFAILURE}  // tags field not needed in "Failure" case
    }
    let tags = info.tags;

    // Convert the response to a string
    let stringResponse = "";
    for (let i = 0; i < info.data.length; i++) {
        stringResponse += String.fromCharCode(info.data[i]);
    }

    // extract HTTP response header
    if (Object.keys(http_response.response_header).length === 0) {
        http_response.response_header = parseHTTPHeader(stringResponse.substring(0, 
            stringResponse.indexOf(HTTP_HEADER_TERMINATOR+HTTP_HEADER_TERMINATOR)));
        http_response.unprocessed = stringResponse.slice(stringResponse.indexOf(HTTP_HEADER_TERMINATOR+
            HTTP_HEADER_TERMINATOR)+(HTTP_HEADER_TERMINATOR+HTTP_HEADER_TERMINATOR).length)
        log(`onData - HTTP Header Recieved: ${JSON.stringify(http_response.response_header)}`, VERBOSE_LOGGING)
    }
    else {
        // If the header has already been processed on a previous chunk, treat as payload data
        http_response.unprocessed = http_response.unprocessed.concat(...stringResponse)
    }

    // confirm if message is using HTTP chunking and process payload as chunks
    if ('Transfer-Encoding'.toLowerCase() in http_response.response_header) {
        switch (http_response.response_header['Transfer-Encoding'.toLowerCase()]) {
            case 'chunked':
                log(`Unprocessed Length: ${http_response.unprocessed.length}`)
                let result = parseChunkedMsg(http_response.unprocessed);
                http_response.msg = http_response.msg.concat(...result.msg);
                log(`Processed Length: ${http_response.msg.length}`)
                if (!result.complete) {
                    http_response.unprocessed = result.leftover
                    log(`Unprocessed (post parse) Length: ${http_response.unprocessed.length}`)
                    return { action: ACTIONRECEIVE }
                }
                break;
            default:
                log(`ERROR: onData - Not supported Transfer-Encoding type: ${http_response.response_header
                    ['Transfer-Encoding'.toLowerCase()]}`)
        }
    }
    // Confirm if full message payload has been received for non-chunk encoded HTTP payloads
    else if ('Content-Length'.toLowerCase() in http_response.response_header) {
        // Compare data length to Content-Length. If Content-Length is greater then the total received data
        // need to listen for more data from driver
        log(`onData - Content-Length Value: ${http_response.response_header['Content-Length'.toLowerCase()]}`, DEBUG_LOGGING)
        log(`onData - Current Msg Length: ${http_response.msg.length}`, DEBUG_LOGGING)
        log(`onData - New Data Length: ${http_response.unprocessed.length}`, DEBUG_LOGGING)
        if (http_response.response_header['Content-Length'.toLowerCase()] > http_response.msg.length + http_response.unprocessed.length) {
            http_response.msg = http_response.msg.concat(...http_response.unprocessed)
            http_response.unprocessed = ''
            return { action: ACTIONRECEIVE }
        }
        else if (http_response.response_header['Content-Length'.toLowerCase()] == http_response.msg.length + http_response.unprocessed.length) {
            http_response.msg = http_response.msg.concat(...http_response.unprocessed)
        }
        else {
            // FAILURE
            log(`ERROR: onData - Received (${http_response.msg.length + http_response.unprocessed.length} bytes) more then Content-Length 
                value: ${http_response.response_header['Content-Length'.toLowerCase()]}`)
            
            // reset cache of http_response info
            http_response.reset()
            return { action: ACTIONFAILURE }
        }
    }
    // Unsupported format - Unknown message payload type/length to parse
    else {
        log(`ERROR: onData - Unknown Transfer-Encoding/Content-Length in HTTP header: ${JSON.stringify(http_response.response_header)}`)
        http_response.reset()
        return { action: ACTIONFAILURE }
    }

    // After receiving full message, verify response code
    if(http_response.getResponseCode() !== 200) {
        // FAILURE - Non successful response from HTTP server
        log(`ERROR: onData - Received HTTP Code ${http_response.getResponseCode()}; Message: ${JSON.stringify(http_response.msg)}`)
        
        // reset cache of http_response info
        http_response.reset()
        return { action: ACTIONFAILURE }
    }

    // Get the JSON body of the response
    let jsonStr = http_response.msg.slice(http_response.msg.indexOf('{'));
    var jsonObj = {}

    // Parse the JSON string
    try {
        jsonObj = JSON.parse(jsonStr);
    }
    catch (e) {
        log(`ERROR: onData - JSON parsing error: ${e.message}`)
        // reset cache of http_response info
        http_response.reset()
        return { action: ACTIONFAILURE }
    }

    // Evaluate each tag's address and get the JSON value 
    tags.forEach(function (tag) {

        tag.value = null;
        let value = get_value_from_payload(tag.address, jsonObj)
        log(`onData - Value found for address "${tag.address}": ${JSON.stringify(value)}`, VERBOSE_LOGGING)
        // If the result is an object, then convert to string
        if(typeof(value) === 'object') {
            value = JSON.stringify(value)
        }
        tag.value = value
    });

    // reset cache of http_response info
    http_response.reset()

    // Determine if value was not found in the payload
    if (tags[0].value === undefined || tags[0].value === null) {
        return { action: ACTIONFAILURE };
    }

    return { action: ACTIONCOMPLETE, tags: tags };
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

/**
 * Class to create HttpResponse object used to process multipacket HTTP messages
 * and provide easy access to HTTP related data
 */
class HttpResponse {
    constructor () {
        this.response_header = {}
        this.msg = ''
        this.unprocessed = ''
    }
    reset() {
        this.response_header = {}
        this.msg = ''
        this.unprocessed = ''
    }
    getResponseCode() {
        return this.response_header['response_code']
    }
}


/**
 * Parses HTTP Header
 * @param {string} msg 
 * @returns {object} JSON Object of Header parameters
 */
function parseHTTPHeader(msg) {
    let header = {}
    let fields = msg.split(HTTP_HEADER_TERMINATOR)

    // Parse status field of HTTP header to access response code and reason information
    let regex = /^(?:HTTP\/)\d[.]\d[ ]\d+[ ]\w+$/
    if(regex.test(fields[0])) {
        let status_split = fields[0].split(/[ ]/)
        header['version'] = status_split[0];
        header['response_code'] = parseInt(status_split[1]);
        header['reason'] = status_split[2];
    }
    else {
        header['version'] = fields[0]
    }

    // Parse rest of header into keys/values
    fields.slice(1, fields.length).forEach((val) => {
        let element = val.split(': ')
        header[element[0].toLowerCase()] = element[1].trim().toLowerCase();
    });
    return header
}

/**
 * Parse Msg chunk and determine if more data is needed to complete the chunks
 * Used for Chunked Transport-Encoding HTTP responses
 * @param {string} msg 
 * @returns {object} Object with following keys:
 * 
 * complete: Is chunking processing complete
 * 
 * msg: new payload data that has been processed to assemble in final HTTP response
 * 
 * leftover: unprocessed data chunk that needs to be assembled with more data
 */
function parseChunkedMsg(msg) {
    let result = ''
    while(msg.length > 0) {
        let chunk_header = msg.slice(0, msg.indexOf(CHUNKED_TERMINATOR))
        let chunk_size = parseInt(chunk_header, 16);
        log(`parseChunkedMsg - chunk_size: ${chunk_size}`)
        if (chunk_size === 0) {
            msg = msg.slice(msg.indexOf(CHUNKED_TERMINATOR+CHUNKED_TERMINATOR)+(CHUNKED_TERMINATOR+CHUNKED_TERMINATOR).length)
        }
        // Need to wait for more data to be provided from driver buffer
        else if (chunk_size > msg.length) {
            return { complete: false, msg: result, leftover: msg }
        }
        else {
            result = result.concat(...msg.substr(msg.indexOf(CHUNKED_TERMINATOR)+CHUNKED_TERMINATOR.length,chunk_size))
            log(`${msg}`)
            log(`Result start: ${result.slice(0,10)}`)
            // TODO: Verify Terminator before moving on. This currently assumes Terminator is last bytes before next chunk.
            msg = msg.slice(msg.indexOf(CHUNKED_TERMINATOR)+CHUNKED_TERMINATOR.length + chunk_size + CHUNKED_TERMINATOR.length)
            log(`Msg start: ${msg.slice(0,10)}`)
        }
    }
    return { complete: true, msg: result }
}

/**
 * Search Object for value based on Tag address
 * @param {Tag.address} address 
 * @param {object} payload 
 * @returns {*} Returns value at object location. Objects will be transformed to strings
 */
function get_value_from_payload(address, payload) {
    let regex =  /^[a-zA-Z]+\[[0-9]+\]$/

    // Create array from address which will be used to walk through payload
    let array = address.split(':');

    // drill into payload to pull value based on address array
    while (array.length)  {
        let key = array.shift()
        if (regex.test(key)) {
            let name = /[a-zA-Z]+/.exec(key)
            let index = /\[[0-9]+\]/.exec(key)
            index = index[0].replace(/\[|\]/g, '')
            payload = payload[name][parseInt(index)]
        }
        else {
            payload = payload[key];
        }
    }
    return payload
    
}

/**
 * Helper Functions for Logging Tag functionality 
 */

/**
 * Validate LoggingLevel tag
 * @param {Tag} tag 
 * @returns {Tag} LoggingLevel Tag validation results
 */

 function validateLoggingTag(tag) {
    if (tag.dataType === "Default"){
        tag.dataType = "word"
    }
    tag.readOnly = false;
    tag.valid = true;

    return tag
}

/**
 * Update the Logging tag to either read the value or modify the level.
 * @param {object}      info       - Object containing the function arguments.
 * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
 * 
 * @returns {OnTransactionResult} Transaction Result for LoggingLevel Tag
 */
function updateLoggingTag(info) {
    let value = undefined;
    if (info.type === "Write"){
        writeToCache(LOGGING_LEVEL_TAG.address, info.tags[0].value)
        return {action: ACTIONCOMPLETE}
    }
    else {
        value = readFromCache(LOGGING_LEVEL_TAG.address).value
        info.tags[0].value = value;
        return { action: ACTIONCOMPLETE, tags: info.tags};
    }
}