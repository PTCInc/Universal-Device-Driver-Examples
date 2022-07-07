/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name:        HTTP-client-profile-generic
 * Description: A simple HTTP example profile that queries from a RESTful endpoint
 * that is expecting a JSON object returned in the response.
 * 
 * Generic HTTP client to show how to use the Http_Request and Http_Response classes
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
 * Validate an address.
 *
 * @param {object}  info          - Object containing the function arguments.
 * @param {Tag}     info.tag      - Single tag.
 *
 * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set.
 *
 * */

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

function onValidateTag(info) {
    
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

function onTagsRequest(info) {

    switch(info.type){
        case READ:
            http_request = new HttpRequest();

            let json = tag_list[info.tags[0].address].input_tag_list;
            let payload = JSON.stringify(json);
            
            // Configure parameters for building the HTTP Request
            http_request.host = "localhost"; 
            http_request.port = 80;
            http_request.method = METHOD.GET;

            // Path parameter is the relative path without the base host/IP. Defaults to '/'
            // example: http://host/device1/read
            // relative path: /device1/read
            http_request.path = '/relative/path'

            // HTTP headers can be populated by JSON key value pairs. headers built with parameters will not be
            // overwritten by these definitions
            http_request.headers = {
                'HeaderKey': 'headervalue',
            }

            let request = http_request.buildRequest(payload)
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


function onData(info) {

    let tags = info.tags;

    // Convert the response to a string
    let stringResponse = "";
    for (let i = 0; i < info.data.length; i++) {
        stringResponse += String.fromCharCode(info.data[i]);
    }

    // Process HTTP payload message. When the result is true, this indicates that the complete HTTP message has been processed
    // Otherwise a return object to send back to the UDD driver is returned to either get more of the HTTP paylod or indicate a failure
    let status = http_response.processHTTPmsg(stringResponse)
    if (status !== true) { return status }

    // After receiving full message, verify/handle response code
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
    
    // reset cache of http_response info after completing processing the whole message. This preps for the next message to be received
    http_response.reset()

    // Determine if value was not found in the payload
    if (tags[0].value === undefined || tags[0].value === null) {
        return { action: ACTIONFAILURE };
    }

    return { action: ACTIONCOMPLETE, tags: tags };

}

/*****************************************************************************************************
 * Class to create HttpRequest object used to create HTTP request messages
 * and provide easy methods to build the payload
 * 
 * Properties:
 * @param {String} path - relative path for URL - defaults to '/'
 * @param {String} method - HTTP method to use [GET, POST]
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
        CONTENTLENGTH: 'Content-Length',
        AUTHORIZATION: 'Authorization',
    }
    #HTTP_HEADER_TERMINATOR = '\r\n'
    constructor () {
        this.path = '/'
        this.headers = {}
        this.method = null
        this.host = null
        this.port = null
        this.username = null
        this.password = null
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
        // Add Basic Authentication if required
        if (this.username !== null & this.password !== null) {
            request += this.#buildAuthString(this.username, this.password)
        }

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

    #buildAuthString(username, password) {
        if (typeof(username) != 'string' | typeof(password) != 'string') {
            return false
        }
        let str = username + ':' + password;
        let bytestr = stringToBytes(str);
        let base64 = this.#bytesArrToBase64(bytestr)
        let authstr = `${this.#HEADERS.AUTHORIZATION}: Basic ${base64}${this.#HTTP_HEADER_TERMINATOR}`
        return authstr
    }
    /**
     * Function to do Base64 encoding since it's not native. 
     * 
     * Response from https://stackoverflow.com/a/62362724
     * 
     * @param {*} arr ByteArray to convert
     * @returns Base64Encoded string
     */
    #bytesArrToBase64(arr) {
        const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; // base64 alphabet
        const bin = n => n.toString(2).padStart(8,0); // convert num to 8-bit binary string
        const l = arr.length
        let result = '';
      
        for(let i=0; i<=(l-1)/3; i++) {
          let c1 = i*3+1>=l; // case when "=" is on end
          let c2 = i*3+2>=l; // case when "=" is on end
          let chunk = bin(arr[3*i]) + bin(c1? 0:arr[3*i+1]) + bin(c2? 0:arr[3*i+2]);
          let r = chunk.match(/.{1,6}/g).map((x,j)=> j==3&&c2 ? '=' :(j==2&&c1 ? '=':abc[+('0b'+x)]));  
          result += r.join('');
        }
      
        return result;
      }
}



/**
 * Class to create HttpResponse object used to process HTTP messages
 * and provide easy access to HTTP related data
 * 
 * Handles data processing of single and multi-packet responses, supporting responses
 * identifeid as chunked or content lengths beyond a single transport payload size.
 */
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
     * 
     * @param {String} stringResponse 
     * @returns {}
     */
    processHTTPmsg(stringResponse) {
        // extract HTTP response header
        if (Object.keys(http_response.headers).length === 0) {
            http_response.headers = this.#parseHTTPHeader(stringResponse.substring(0, 
                stringResponse.indexOf(this.#HTTP_HEADER_TERMINATOR+this.#HTTP_HEADER_TERMINATOR)));
            http_response.unprocessed = stringResponse.slice(stringResponse.indexOf(this.#HTTP_HEADER_TERMINATOR+
                this.#HTTP_HEADER_TERMINATOR)+(this.#HTTP_HEADER_TERMINATOR+this.#HTTP_HEADER_TERMINATOR).length)
            log(`onData - HTTP Header Received: ${JSON.stringify(http_response.headers)}`, VERBOSE_LOGGING)
        }
        else {
            // If the header has already been processed on a previous chunk, treat as payload data
            http_response.unprocessed = http_response.unprocessed.concat(...stringResponse)
        }

        // confirm if message is using HTTP chunking and process payload as chunks
        if ('Transfer-Encoding'.toLowerCase() in http_response.headers) {
            switch (http_response.headers['Transfer-Encoding'.toLowerCase()]) {
                case 'chunked':
                    log(`Unprocessed Length: ${http_response.unprocessed.length}`, DEBUG_LOGGING)
                    let result = this.#parseChunkedMsg(http_response.unprocessed);
                    http_response.msg = http_response.msg.concat(...result.msg);
                    log(`Processed Length: ${http_response.msg.length}`, DEBUG_LOGGING)
                    if (!result.complete) {
                        http_response.unprocessed = result.leftover
                        log(`Unprocessed (post parse) Length: ${http_response.unprocessed.length}`, DEBUG_LOGGING)
                        return { action: ACTIONRECEIVE }
                    }
                    break;
                default:
                    log(`ERROR: onData - Not supported Transfer-Encoding type: ${http_response.headers
                        ['Transfer-Encoding'.toLowerCase()]}`)
                    return { action: ACTIONFAILURE }
            }
        }
        // Confirm if full message payload has been received for non-chunk encoded HTTP payloads
        else if ('Content-Length'.toLowerCase() in http_response.headers) {
            // Compare data length to Content-Length. If Content-Length is greater then the total received data
            // need to listen for more data from driver
            log(`onData - Content-Length Value: ${http_response.headers['Content-Length'.toLowerCase()]}`, DEBUG_LOGGING)
            log(`onData - Current Msg Length: ${http_response.msg.length}`, DEBUG_LOGGING)
            log(`onData - New Data Length: ${http_response.unprocessed.length}`, DEBUG_LOGGING)
            if (http_response.headers['Content-Length'.toLowerCase()] > http_response.msg.length + http_response.unprocessed.length) {
                http_response.msg = http_response.msg.concat(...http_response.unprocessed)
                http_response.unprocessed = ''
                return { action: ACTIONRECEIVE }
            }
            else if (http_response.headers['Content-Length'.toLowerCase()] == http_response.msg.length + http_response.unprocessed.length) {
                http_response.msg = http_response.msg.concat(...http_response.unprocessed)
            }
            else {
                // FAILURE
                log(`ERROR: onData - Received (${http_response.msg.length + http_response.unprocessed.length} bytes) more then Content-Length 
                    value: ${http_response.headers['Content-Length'.toLowerCase()]}`)
                
                // reset cache of http_response info
                http_response.reset()
                return { action: ACTIONFAILURE }
            }
        }
        // Unsupported format - Unknown message payload type/length to parse
        else {
            log(`ERROR: onData - Unknown Transfer-Encoding/Content-Length in HTTP header: ${JSON.stringify(http_response.headers)}`)
            http_response.reset()
            return { action: ACTIONFAILURE }
        }

        return true;

    }
    /**
     * Parses HTTP Header
     * @param {string} msg 
     * @returns {object} JSON Object of Header parameters
     */
    #parseHTTPHeader(msg) {
        let header = {}
        let fields = msg.split(this.#HTTP_HEADER_TERMINATOR)

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
    #parseChunkedMsg(msg) {
        let result = ''
        while(msg.length > 0) {
            let chunk_header = msg.slice(0, msg.indexOf(this.#CHUNKED_TERMINATOR))
            let chunk_size = parseInt(chunk_header, 16);
            log(`parseChunkedMsg - chunk_size: ${chunk_size}`, DEBUG_LOGGING)
            if (chunk_size === 0) {
                msg = msg.slice(msg.indexOf(this.#CHUNKED_TERMINATOR+this.#CHUNKED_TERMINATOR)+(this.#CHUNKED_TERMINATOR+this.#CHUNKED_TERMINATOR).length)
            }
            // Need to wait for more data to be provided from driver buffer
            else if (chunk_size > msg.length) {
                return { complete: false, msg: result, leftover: msg }
            }
            else {
                result = result.concat(...msg.substr(msg.indexOf(this.#CHUNKED_TERMINATOR)+this.#CHUNKED_TERMINATOR.length,chunk_size))
                // TODO: Verify Terminator before moving on. This currently assumes Terminator is last bytes before next chunk.
                msg = msg.slice(msg.indexOf(this.#CHUNKED_TERMINATOR)+this.#CHUNKED_TERMINATOR.length + chunk_size + this.#CHUNKED_TERMINATOR.length)
            }
        }
        return { complete: true, msg: result }
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