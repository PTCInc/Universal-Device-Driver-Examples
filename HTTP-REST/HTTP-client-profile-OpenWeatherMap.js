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
 * Developed on Kepware Server version 6.13, UDD V2.0
 * 
 * Update History:
 * 0.1.4:   Added handling for incomplete HTTP headers in response.
 * 0.1.5:   Fixed chunking message parsing error. https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/18
 *          Added reset of http response buffer to handle failures/reconnects. https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/15
 * 0.1.6:   Fixed HTTP reason code and description parsing. https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/21
 *          Added handling for potential extra responses received during retry 
 *              process https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/16
 *  
 * Version:     0.1.6
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

/** HTTP Global variables */
const METHOD = {
    GET: 'GET',
    POST: 'POST',
}
var http_request = null
var http_response = null

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
 * SEE https://openweathermap.org/api/one-call-3 for JSON example of One Call API 
 * this example uses from OpenWeatherMap
 * 
 * Example JSON for tag addressing discussion:
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

    // Clear response in event this is a tag transaction after a failure.
    http_response.reset()

    // Check if tag is LoggingLevel, update from cached value
    if (info.tags[0].address === LOGGING_LEVEL_TAG.address){
        let returnAction = updateLoggingTag(info);
        return returnAction;
    }

    switch(info.type){
        case READ:
            http_request = new HttpRequest();

            // API that uses the One Call API 1.0 from OpenWeatherMap.org
            let appId = "{API KEY}";  // API key
            let lat = "43.65" // Latitude of location
            let lon = "-70.25" // Longitude of location 
            let rel_path = `/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${appId}`;
            
            http_request.host = "api.openweathermap.org"; 
            http_request.port = 80;
            http_request.method = METHOD.GET;
            http_request.path = rel_path;

            let request = http_request.buildRequest()
            if (!request) {
                log(`ERROR: onTagRequest - http_request build failed for "${info.tags[0].address}"`)
                return { action: ACTIONFAILURE }
            }
            
            let readFrame = stringToBytes(request);
            return {action: ACTIONRECEIVE, data: readFrame};
        case WRITE:
            // Writes are not built into example/API
            log(`ERROR: onTagRequest - Write command for address "${info.tags[0].address}" is not supported`)
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
    log(`onData - info.tags: ${JSON.stringify(info.tags)}`, DEBUG_LOGGING)

    // For situations where request retries are sent from the driver, it could result in the webserver sending multiple responses back.
    // In these situations, data would be received that is not connected to a tag transaction event. This looks like an "unsolicited" data receipt
    // and the driver will call the onData without any tags.

    // Since HTTP is solicited, this will assume that any responses without a tag in the transaction will be ignored.

    if (info.tags == undefined){
        log(`onData - info.tags does not exist. Info: ${JSON.stringify(info)}`, DEBUG_LOGGING)

        log(`ERROR - Unexpected data received without a tag request. Possibly an extra response from a retry event.`)

        // reset cache of http_response info
        // This preps for the next message transaction to be received 
        http_response.reset()
        
        return { action: ACTIONCOMPLETE }
    }

    let tags = info.tags;

    // Convert the response to a string
    let stringResponse = "";
    for (let i = 0; i < info.data.length; i++) {
        stringResponse += String.fromCharCode(info.data[i]);
    }

    // Process HTTP payload message. When the result is true, this indicates that the complete HTTP message has been processed
    // Otherwise a return object to send back to the UDD driver is returned to either get more of the HTTP paylod or indicate a failure
    let status = null
    try {
        status = http_response.processHTTPmsg(stringResponse)
    }
    catch(err)
    {
        log(`ERROR - Processing message for HTTP response with processHTTPmsg() failure. Msg: ${err}`)
        // reset cache of http_response info after completing processing the whole message. 
        // This preps for the next message transaction to be received 
        http_response.reset()

        // Action is completed but not returning tags puts tag value associated with onData request into bad quality.
        return { action: ACTIONCOMPLETE }
    }

    // If processing HTTP message isn't complete, returned status will wait for more data from the network

    if (status !== true) { return status }

    
    // After receiving full message, verify/handle response code
    if(http_response.getResponseCode() !== 200) {
        // FAILURE - Non successful response from HTTP server
        log(`ERROR: Failed HTTP response. Received HTTP Response Code ${http_response.getResponseCode()}; Reason: ${http_response.headers['reason']}; Message: ${http_response.msg}`)
        
        // reset cache of http_response info
        http_response.reset()
        // Action is completed but not returning tags puts tag value associated with onData request into bad quality.
        return { action: ACTIONCOMPLETE }
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
    // If not, don't send tags object which will set tag to bad quality
    if (tags[0].value === undefined || tags[0].value === null) {
        log(`ERROR: Value for tag address "${tags[0].address}" not found in JSON payload`)
        return { action: ACTIONCOMPLETE };
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

/*****************************************************************************************************
 * Class to create HttpRequest object used to create HTTP request messages
 * and provide easy methods to build the payload
 * 
 * Properties:
 * @param {String} path - relative path for URL - defaults to '/'
 * @param {String} method - HTTP method to use [GET, POST, etc]
 * @param {String} host - host to connect to - IP/HOST/DNS NAME
 * @param {Number} port - port to connect
 * @param {Object} headers - JSON Object of HTTP headers to configure 
 * 
 * Methods:
 * @method buildRequest - Builds the necessary HTTP request message based on the properties configured.
 *****************************************************************************************************/
 class HttpRequest {
    #HEADERS = {
        CONTENTTYPE: 'Content-Type',
        HOST: 'Host',
        CONNECTION: 'Connection',
        CONTENTLENGTH: 'Content-Length'
    }
    #HTTP_HEADER_TERMINATOR = '\r\n'
    constructor () {
        this.path = '/'
        this.headers = {}
        this.method = null
        this.host = null
        this.port = null
    }
    /**
     * Builds the necessary HTTP request message based on the properties configured.
     * @param {String} payload 
     * @returns {String} complete message to send
     */
    buildRequest(payload = null) {
        // Check to see if required parameters have been updated
        if (this.method === null | this.host === null | this.port === null) {
            log(`HttpRequest.buildRequest - parameters have not been set correctly. method: ${this.method} | host: ${this.host} | port: ${this.port}`, DEBUG_LOGGING)
            return false
        }

        let header_copy = {...this.headers}
        // Builds start-line of message
        let request =  `${this.method} ${this.path} HTTP/1.1${this.#HTTP_HEADER_TERMINATOR}`;

        // Builds message headers
        // Unless specified Content-Type will default to application/json
        if (header_copy.hasOwnProperty(this.#HEADERS.CONTENTTYPE)) {
            request += `${this.#HEADERS.CONTENTTYPE}: ${header_copy[this.#HEADERS.CONTENTTYPE]}${this.#HTTP_HEADER_TERMINATOR}`;
            delete header_copy[this.#HEADERS.CONTENTTYPE]
        }
        else {
            request += `${this.#HEADERS.CONTENTTYPE}: application/json${this.#HTTP_HEADER_TERMINATOR}`;
        }
        // Add Host header
        request += `${this.#HEADERS.HOST}: ${this.host}:${this.port}${this.#HTTP_HEADER_TERMINATOR}`;

        // Unless specified Connection will default to keep-alive
        if (header_copy.hasOwnProperty(this.#HEADERS.CONNECTION)) {
            request += `${this.#HEADERS.CONNECTION}: ${header_copy[this.#HEADERS.CONNECTION]}${this.#HTTP_HEADER_TERMINATOR}`
            delete header_copy[this.#HEADERS.CONNECTION]
        }
        else{
            request += `${this.#HEADERS.CONNECTION}: keep-alive${this.#HTTP_HEADER_TERMINATOR}`;
        }

        // Add rest of headers provided
        for (const key in header_copy) {
            // don't overwrite certain headers
            if (Object.values(this.#HEADERS).indexOf(key) === -1){
                request += `${key}: ${header_copy[key]}${this.#HTTP_HEADER_TERMINATOR}`
            }
        }
        // Add and calculate Content-Length header
        let length = 0
        if (payload !== null) {
            length = payload.length
        }
        request += `${this.#HEADERS.CONTENTLENGTH}: ${length}${this.#HTTP_HEADER_TERMINATOR}`;
        request += this.#HTTP_HEADER_TERMINATOR;

        // Adds message body of payload if provided
        if (payload !== null) {
            request += payload 
        }
        log(`HttpRequest.buildRequest - Request: ${request}`, VERBOSE_LOGGING)
        return request;
    }
}



/*****************************************************************************************************
 * Class to create HttpResponse object used to process HTTP messages
 * and provide easy access to HTTP related data
 * 
 * Handles data processing of single and multi-packet responses, supporting responses
 * identifeid as chunked or content lengths beyond a single transport payload size.
 * 
 * Properties:
 * @param {Object} headers - JSON object of the HTTP headers from the response message
 * @param {String} msg - payload or message body from the response message
 * 
 * Methods:
 * @method processHTTPmsg - processes HTTP message to determine if the complete message is received or not.
 *****************************************************************************************************/
 class HttpResponse {
    #HTTP_HEADER_TERMINATOR = '\r\n'
    #CHUNKED_TERMINATOR = '\r\n'
    constructor () {
        this.headers = {}
        this.msg = ''
        this.unprocessed = ''
    }
    reset() {
        this.headers = {}
        this.msg = ''
        this.unprocessed = ''
    }
    getResponseCode() {
        return this.headers['response_code']
    }
    /**
     * Method used to process the HTTP response data that is received from the UDD driver.
     * 
     * @param {String} stringResponse - string value from the message data received from the UDD driver 
     * @returns {true | action response} - will return true if the complete HTTP message has been received or 
     *                                      actions to listen for more data from the UDD driver
     * 
    * Exceptions:
    * @throws {string} - Error message if processing fails
    */
    processHTTPmsg(stringResponse) {
        this.unprocessed = this.unprocessed.concat(...stringResponse)
        
        // extract HTTP response header. If the header has already been processed on a previous chunk, treat as payload data
        if (Object.keys(this.headers).length === 0) {
            // Check to ensure that the full header payload has been received, if not then return to receive more.
            if (this.unprocessed.search(this.#HTTP_HEADER_TERMINATOR+this.#HTTP_HEADER_TERMINATOR) === -1){
                return { action: ACTIONRECEIVE }
            }
            this.headers = this.#parseHTTPHeader(this.unprocessed.substring(0, 
                this.unprocessed.indexOf(this.#HTTP_HEADER_TERMINATOR+this.#HTTP_HEADER_TERMINATOR)));
            this.unprocessed = this.unprocessed.slice(this.unprocessed.indexOf(this.#HTTP_HEADER_TERMINATOR+
                this.#HTTP_HEADER_TERMINATOR)+(this.#HTTP_HEADER_TERMINATOR+this.#HTTP_HEADER_TERMINATOR).length)
            log(`processHTTPmsg - HTTP Header Received: ${JSON.stringify(this.headers)}`, VERBOSE_LOGGING)
        }

        // confirm if message is using HTTP chunking and process payload as chunks
        if ('Transfer-Encoding'.toLowerCase() in this.headers) {
            switch (this.headers['Transfer-Encoding'.toLowerCase()]) {
                case 'chunked':
                    log(`processHTTPmsg - Unprocessed Length: ${this.unprocessed.length}`, DEBUG_LOGGING)
                    let result = this.#parseChunkedMsg(this.unprocessed);
                    this.msg = this.msg.concat(...result.msg);
                    log(`processHTTPmsg - Processed Length: ${this.msg.length}`, DEBUG_LOGGING)
                    if (!result.complete) {
                        this.unprocessed = result.leftover
                        log(`processHTTPmsg - Chunk Msg Not Complete. Unprocessed (post parse) Length: ${this.unprocessed.length}`, DEBUG_LOGGING)
                        return { action: ACTIONRECEIVE }
                    }
                    break;
                default:
                    log(`ERROR: onData - Not supported Transfer-Encoding type: ${this.headers
                        ['Transfer-Encoding'.toLowerCase()]}`)
                    return { action: ACTIONFAILURE }
            }
        }
        // Confirm if full message payload has been received for non-chunk encoded HTTP payloads
        else if ('Content-Length'.toLowerCase() in this.headers) {
            // Compare data length to Content-Length. If Content-Length is greater then the total received data
            // need to listen for more data from driver
            log(`processHTTPmsg - Content-Length Value: ${this.headers['Content-Length'.toLowerCase()]}`, DEBUG_LOGGING)
            log(`processHTTPmsg - Current Msg Length: ${this.msg.length}`, DEBUG_LOGGING)
            log(`processHTTPmsg - New Data Length: ${this.unprocessed.length}`, DEBUG_LOGGING)
            if (this.headers['Content-Length'.toLowerCase()] > this.msg.length + this.unprocessed.length) {
                this.msg = this.msg.concat(...this.unprocessed)
                this.unprocessed = ''
                return { action: ACTIONRECEIVE }
            }
            else if (this.headers['Content-Length'.toLowerCase()] == this.msg.length + this.unprocessed.length) {
                this.msg = this.msg.concat(...this.unprocessed)
            }
            else {
                // FAILURE
                log(`ERROR: onData - Received (${this.msg.length + this.unprocessed.length} bytes) more then Content-Length 
                    value: ${this.headers['Content-Length'.toLowerCase()]}`)
                
                // reset cache of http_response info
                this.reset()
                return { action: ACTIONFAILURE }
            }
        }
        // Unsupported format - Unknown message payload type/length to parse
        else {
            log(`ERROR: onData - Unknown Transfer-Encoding/Content-Length in HTTP header: ${JSON.stringify(this.headers)}`)
            this.reset()
            return { action: ACTIONFAILURE }
        }

        return true;

    }
    /**
     * Parses HTTP Header
     * @param {string} msg 
     * @returns {object} JSON Object of Header parameters
     * 
     * @throws {string} error message thrown if header parsing fails
     */
    #parseHTTPHeader(msg) {
        let header = {}
        let fields = msg.split(this.#HTTP_HEADER_TERMINATOR)

        // Parse status field of HTTP header to access response code and reason information
        let regex = /^((?:HTTP\/)\d[.]\d)[ ](\d+)[ ]([\w| ]+)$/
        let status_split = regex.exec(fields[0])
        if(status_split !== null) {
            header['version'] = status_split[1];
            header['response_code'] = parseInt(status_split[2]);
            header['reason'] = status_split[3];
        }
        else {
            // header['version'] = fields[0]
            throw "HEADER PARSE FAILURE"
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
    #parseChunkedMsg(msg) {
        let result = ''
        while(msg.length > 0) {
            if (msg.indexOf(this.#CHUNKED_TERMINATOR) === -1) {
                return { complete: false, msg: result, leftover: msg }
            }
            let chunk_header = msg.slice(0, msg.indexOf(this.#CHUNKED_TERMINATOR))
            let chunk_size = parseInt(chunk_header, 16);
            log(`parseChunkedMsg - chunk_size: ${chunk_size}`, DEBUG_LOGGING)
            if (chunk_size === 0) {
                msg = msg.slice(msg.indexOf(this.#CHUNKED_TERMINATOR+this.#CHUNKED_TERMINATOR)+(this.#CHUNKED_TERMINATOR+this.#CHUNKED_TERMINATOR).length)
                return { complete: true, msg: result }
            }
            // Need to wait for more data to be provided from driver buffer
            else if (chunk_size + chunk_header.length + this.#CHUNKED_TERMINATOR.length >= msg.length) {
                return { complete: false, msg: result, leftover: msg }
            }
            else {
                result = result.concat(...msg.substr(msg.indexOf(this.#CHUNKED_TERMINATOR)+this.#CHUNKED_TERMINATOR.length,chunk_size))
                // TODO: Verify Terminator before moving on. This currently assumes Terminator is last bytes before next chunk.
                msg = msg.slice(msg.indexOf(this.#CHUNKED_TERMINATOR)+this.#CHUNKED_TERMINATOR.length + chunk_size + this.#CHUNKED_TERMINATOR.length)

            }
        }
        return { complete: false, msg: result, leftover: msg }
    }

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