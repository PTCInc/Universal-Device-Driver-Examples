/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name:        dpm_pacemaker_preprocess.js
 * Description: An example profile that can preprocess data from within Kepware. It uses 
 * the IoT Gateway REST server to access tag data in Kepware, processes the values and updates
 * tags within the UDD driver.
 * 
 * This example specifically setups up standard parameters needed for preprocessing or recalculating
 * raw values from the automation layer to be received by the DPM solution in Thingworx.
 * 
 * 
 * Developed on Kepware Server version 6.13, UDD V2.0
 * 
 * Update History:
 * 0.1.2:   Added handling for incomplete HTTP headers in response.
 * 0.1.3:   Fixed chunking message parsing error. https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/18
 *          Added reset of http response buffer to handle failures/reconnects. https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/15
 * 0.1.4:   Fixed HTTP reason code and description parsing. https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/21 
 *          Added handling for potential extra responses received during retry 
 *              process https://github.com/PTCInc/Universal-Device-Driver-Examples/issues/16
 *          Modified failed result logic to ensure http_response object gets reset in all failed conditions and 
 *              to only put tag in bad quality during a failure instead of a "DNR" (ACTIONFAILURE) state
 * 
 * Version:     0.1.4
******************************************************************************/

/**
 * @typedef {object}    Tag
 * @property {string}   Tag.address  - Tag address.
 * @property {DataType} Tag.dataType - Kepserver data type.
 * @property {boolean}  Tag.readOnly - Indicates permitted communication mode(s).
 * @property {boolean}  Tag.valid    - Indicates address validity.
 * @property {*}        Tag.value    - Tag value. Only used in ParseMessage.
 */

/**
 * @typedef {string} MessageType - Type of communication "Read", "Write"
 */
 
/**
 * @typedef {number[]} Data - Array of data bytes to write. Uint8 byte array.
 */

 /**
 * @typedef {object}  OnProfileLoadResult
 * @property {string} version  - Version of the driver
 * @property {string} mode     - Mode of the profile ["Client", "Server"]
 */
 
/**
 * @typedef {object}  OnTagsResult
 * @property {string} status  - Status of the operation ["Complete", "Receive", "Failure"]
 * @property {Tag[]}  tags    - Array of Tags (if any active) to complete
 * @property {Data}   data    - The resulting data (if any) to send.
 */
 
 /**
 * @typedef {object}  OnDataResult
 * @property {string} status    - Status of the operation ["Complete", "Receive", "Failure"]
 * @property {Tag[]}  tags      - Array of tags with .value field set to value parsed from incoming data. Must be same length and order as input.
 */
 
 /**
 * @typedef {object}  BuildMessageResult
 * @property {string} status    - Status of the operation ["Complete", "Receive", "Failure"]
 * @property {Data}   data      - Array of tags with .value field set to value parsed from incoming data. Must be same length and order as input.
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
const METHOD = {
    GET: 'GET',
    POST: 'POST',
}
var http_request = null
var http_response = null

// Global variable for all supported data_types
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
 * Tag Addresses - Properties that are used by DPM and are calculated 
 * using this profile
 */

const FAULTCODEADDRESS = 'AvailablyEventFaultCode'
const MATERIALIDADDRESS = 'MaterialMasterID'
const PRODUCTIONCOUNTADDRESS = 'ProductionCount'
const JOBORDERIDADDRESS = 'JobOrderID'
const TARGETQUANTITYADDRESS = 'TargetQuantity'
const SCRAPCOUNTSADDRESS = 'ScrapCounts'

// References to IoT Gateway tags to be read
const MACHINE1IALARMID = "Channel1.Device1.machine1-iAlarmID"
const MACHINE1MAUTO = "Channel1.Device1.machine1-mAuto"
const MACHINE1MERROR = "Channel1.Device1.machine1-mError"
const MACHINE1MWAIT = "Channel1.Device1.machine1-mWait"
const MACHINE1MWAITIN = "Channel1.Device1.machine1-mWaitIn"
const MACHINE1IVARIANT = "Channel1.Device1.machine1-iVariant"
const MACHINE2IALARMID = "Channel1.Device1.machine2-iAlarmID"
const MACHINE2MAUTO = "Channel1.Device1.machine2-mAuto"
const MACHINE2MERROR = "Channel1.Device1.machine2-mError"
const MACHINE2MWAIT = "Channel1.Device1.machine2-mWait"
const MACHINE2MWAITIN = "Channel1.Device1.machine2-mWaitIn"
const MACHINE2MPARTOUT = "Channel1.Device1.machine2-mPartOut"


// Initialize Tag List
var tag_list = {};
tag_list[PRODUCTIONCOUNTADDRESS] = {
    dataType: data_types.DWORD,
    input_tag_list: [MACHINE2MPARTOUT]
}
tag_list[MATERIALIDADDRESS] = {
    dataType: data_types.STRING,
    input_tag_list: [MACHINE1IVARIANT]
}
tag_list[FAULTCODEADDRESS] = {
    dataType: data_types.STRING,
    input_tag_list: [MACHINE1IALARMID,MACHINE1MAUTO,
        MACHINE1MERROR,MACHINE1MWAIT,MACHINE1MWAITIN,
        MACHINE2IALARMID,MACHINE2MAUTO,
        MACHINE2MERROR,MACHINE2MWAIT,MACHINE2MWAITIN,]
}
tag_list[JOBORDERIDADDRESS] = {
    dataType: data_types.STRING,
    input_tag_list: []
}
tag_list[TARGETQUANTITYADDRESS] = {
    dataType: data_types.DWORD,
    input_tag_list: []
}
tag_list[SCRAPCOUNTSADDRESS] = {
    dataType: data_types.DWORD,
    input_tag_list: []
}

/**
 * Logging Level System tag - control logging level from client application
 * This can be used to avoid logging verbose UDD log messages unless 
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
 * Retrieve driver metadata
 * Required.
 * 
 * @return {OnProfileLoadResult} result - Driver metadata
 */
function onProfileLoad() {
    //Tell the driver what version of the script we’re using and mode of the socket connection
    //VERSION should currently be set to “2.0”
    //For unsolicited drivers, MODE is typically “Server”

    try {
        initializeCache();
        
    } catch (e){
        // If this fails it means the cache has already been initialized
    }

    // Initialize LoggingLevel control
    writeToCache(LOGGING_LEVEL_TAG.address, LOGGING_LEVEL);

    // Initialize the http_response cache to handle multi packet processing
    http_response = new HttpResponse()

    // Initialize cache for tags - Can modify as needed depending on use case
    writeToCache(FAULTCODEADDRESS, 0)
    writeToCache(MATERIALIDADDRESS, '')
    writeToCache(PRODUCTIONCOUNTADDRESS, 0)
    writeToCache(JOBORDERIDADDRESS, '')
    writeToCache(TARGETQUANTITYADDRESS, 0)
    writeToCache(SCRAPCOUNTSADDRESS, 0)

    return { version: VERSION, mode: MODE};
}

/**
 * Validate an address.
 * Required.
 * Used by the driver to check if a tag address is valid. Can also optionally either fail if the data type is not valid for the given address or correct the data type to one that is valid.
 * @param {object}  info        - Object containing the function arguments.
 * @param {Tag}     info.tag    - Single tag
 *
 * @return {Tag} info.tag - Single tag 
 */

function onValidateTag(info) {
    //Check for valid address, return fail if not (Address is info.tag.address)
    //Check if data type is valid for this address (Data Type is info.tag.dataType)
    //Optionally correct the data type if incorrect by updating the data type in the tag object being returned
    //Set read only to true or false (info.tag.readOnly)
    //Return tag object with validated address and data type

    log(`onValidateTag - info: ${JSON.stringify(info)}`, VERBOSE_LOGGING)
    
   // Check if it's LoggingLevel tag
   if (info.tag.address === LOGGING_LEVEL_TAG.address) {
        info.tag = validateLoggingTag(info.tag)
        log('onValidateTag - address "' + info.tag.address + '" is valid.', DEBUG_LOGGING)
        return info.tag;
    }

    if (info.tag.address in tag_list) {
        info.tag.valid = true;
        info.tag.dataType = tag_list[info.tag.address].dataType;
        info.tag.readOnly = true;
    } 
    else {
        info.tag.valid = false;
    }

    return info.tag;
}

/**
 * Process an array of Tags.
 * Required.
 * @param {object}      info            - Object containing the function arguments.
 * @param {MessageType} info.type       - Communication mode for the data array being formed (are we reading or writing a tag?)
 * @param {Tag[]}       info.tags       - Tags currently being processed; v2.0 does not support blocking / bulk reads or writes, so only a single Tag is processed at a time.
 * @return {OnTagsResult} result - The status of the operation and the data to send (if any).
 */
function onTagsRequest(info) {
    log(`onTagsRequest - info: ${JSON.stringify(info)}`, VERBOSE_LOGGING)
    
    // Clear response in event this is a tag transaction after a failure.
    http_response.reset()

    // Check if tag is LoggingLevel, update from cached value
    if (info.tags[0].address === LOGGING_LEVEL_TAG.address){
        let returnAction = updateLoggingTag(info);
        return returnAction;
    }
    
    switch(info.type){
        case READ:
            // If it's a tag to read data. Determines when data is read and update all tags
            if (tag_list[info.tags[0].address].input_tag_list.length) {
                http_request = new HttpRequest();

                let json = tag_list[info.tags[0].address].input_tag_list;
                let payload = JSON.stringify(json);
                
                http_request.host = "localhost"; 
                http_request.port = 39320;
                http_request.method = METHOD.POST;
                http_request.path = '/iotgateway/read'
                http_request.headers = {
                    'HeaderKey': 'headervalue',
                }
                http_request.username = 'Administrator'
                http_request.password = ''

                let request = http_request.buildRequest(payload)
                if (!request) {
                    log(`ERROR: onTagRequest - http_request build failed for "${info.tags[0].address}"`)
                    return { action: ACTIONFAILURE }
                }
                
                let readFrame = stringToBytes(request);
                return {action: ACTIONRECEIVE, data: readFrame};
            }
            else {
                info.tags[0].value = readFromCache(info.tags[0].address).value
                return { action: ACTIONCOMPLETE, tags: info.tags}
            }
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
 * Parse an array of bytes from the device.
 * Required.
 * @param {object}      info            - Object containing the function arguments.
 * @param {MessageType} info.type       - Communication mode for the data being formed.
 * @param {Tag[]}       info.tags       - Tags currently being processed; v2.0 does not support blocking / bulk reads or writes, so only a single Tag is processed at a time.
 *                                      - Parsed values will be inserted into the array.
 * @param {Data}        info.data       - The incoming data.
 *
 * @return {OnDataResult} result - The status and tags processed.
 */
function onData(info) {
    log(`onData - info.tags: ${JSON.stringify(info.tags)}`, VERBOSE_LOGGING)

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
        
        // reset cache of http_response info in the event of a failure
        http_response.reset()
        // Action is completed but not returning tags puts tag value associated with onData request into bad quality.
        return { action: ACTIONCOMPLETE }
    }

    // Get the JSON body of the response
    let jsonStr = http_response.msg.slice(http_response.msg.indexOf('{'));
    var jsonObj = {}

     // Parse the JSON string
    try {
        jsonObj = JSON.parse(jsonStr).readResults;
    }
    catch (e) {
        log(`ERROR: onData - JSON parsing error: ${e.message}`)
        // reset cache of http_response info
        http_response.reset()
        return { action: ACTIONFAILURE }
    }

    let values = {}
    /**
     * Transform the JSON response to an easier model where:
     * 
     * { 'tag name': {
     *      'v': value,
     *      's': success,
     *      'r': reason,
     *      't': timestamp
     *      },
     *  'tag name 2': {},...
     * }
     * 
     * See IoT Gateway documentation for definitions of the data returned 
     * by the REST server interface
     * 
     *  
     * */ 
    for (x of jsonObj){
        if (tag_list[tags[0].address].input_tag_list.includes(x.id)){
            values[x.id] = {}
            for (const key in x) {
                if (key !== 'id') {
                    values[x.id][key] = x[key]
                }
            }
        }
    }

    log(`Values Array: ${JSON.stringify(values)}`, DEBUG_LOGGING)

    // Execute logic based on tag being read.
    let result = false;
    switch(tags[0].address){
        case FAULTCODEADDRESS:
            result = getEventFaultCode(values)
            break;
        case PRODUCTIONCOUNTADDRESS:
            result = getProductionCount(values)
            break;
        case MATERIALIDADDRESS:
            result = getMaterialID(values)
            break;
        case JOBORDERIDADDRESS:
        case TARGETQUANTITYADDRESS:
        case SCRAPCOUNTSADDRESS:
            // Not used in example
            result = false;
        default:
            log(`onData - ERROR - Unknown address ${tags[0].address} received`)
            result = false;
    }

    // reset cache of http_response info
    http_response.reset()

    // check to see if result failed from data check
    if (result === false){
        // Don't return tags to set tag in transaction to bad quality.
        return { action: ACTIONCOMPLETE };
    }
    writeToCache(tags[0].address, result)
    tags[0].value = result

    return { action: ACTIONCOMPLETE, tags: tags};

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
                    log(`processHTTPmsg -Unprocessed Length: ${this.unprocessed.length}`, DEBUG_LOGGING)
                    let result = this.#parseChunkedMsg(this.unprocessed);
                    this.msg = this.msg.concat(...result.msg);
                    log(`processHTTPmsg -Processed Length: ${this.msg.length}`, DEBUG_LOGGING)
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


/* ********************************************************************************************************************
 * Helper functions
 * *******************************************************************************************************************/
 
/**
 * Parse an array of bytes from the device.
 * Required.
 * @param {object}      info            - Object containing the function arguments.
 * @param {MessageType} info.type       - Communication mode for the data being formed.
 * @param {Tag[]}       info.tags       - Tags currently being processed. Can be null. Parsed values will be inserted into the array.
 * @param {Data}        info.data       - The incoming data.
 *
 * @return {ParseMessageResult} result - The status, bytes read, and tags processed.
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
 * Helper Functions for Logging Tag functionality 
 */

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





/********************************************************************
 * Calculate Fault Codes for AvailabilityEventFaultCode
 * @param {Object} values 
 * @returns {String} Value of Fault Code
 ********************************************************************/

// Error Code Statuses used as outputs for AvailabilityEventFaultCode
const STATCODES = {
    waiting: 1,
    starving: 2,
    running: 0,
    other: -999
}

function getEventFaultCode(values) {
    // Waiting Check
    if (values[MACHINE1MWAIT].v && values[MACHINE2MWAIT].v) {
        return STATCODES.waiting
    }
    // Starving Checks
    else if ((values[MACHINE1MWAITIN].v && values[MACHINE2MWAITIN].v) || (values[MACHINE1MWAITIN].v && values[MACHINE2MWAIT].v)) {
        return STATCODES.starving
    }
    else if (values[MACHINE1MERROR].v && values[MACHINE2MWAITIN].v) {
        return values[MACHINE1IALARMID].v
    }
    else if (values[MACHINE2MERROR].v && values[MACHINE1MWAIT].v) {
        return values[MACHINE2IALARMID].v
    }
    else if (values[MACHINE1MERROR].v && values[MACHINE2MERROR].v) {
        return values[MACHINE1IALARMID].v
    }
    else if (!(values[MACHINE1MAUTO].v) && values[MACHINE2MERROR].v) {
        return STATCODES.other
    }
    else if (!values[MACHINE2MAUTO].v && values[MACHINE1MERROR].v) {
        return STATCODES.other
    }
    else if (!values[MACHINE1MAUTO].v && !values[MACHINE2MAUTO].v) {
        return STATCODES.other
    }
    // Running state if no other conditions are true
    else {
        return STATCODES.running
    }
}

/********************************************************************
 * Calculates Part Count
 * @param {Object} values 
 * @returns {Number} Count value calculated
 ********************************************************************/
function getProductionCount(values) {
    let count = readFromCache(PRODUCTIONCOUNTADDRESS).value
    if (readFromCache(MACHINE2MPARTOUT).value === undefined) {
        writeToCache(MACHINE2MPARTOUT, values[MACHINE2MPARTOUT])
    }
    if (values[MACHINE2MPARTOUT].v && !readFromCache(MACHINE2MPARTOUT).value) {
        count++;
    }
    writeToCache(MACHINE2MPARTOUT, values[MACHINE2MPARTOUT].v)
    return count
}




/********************************************************************
 * Provides Material Code for MaterialMasterID
 * @param {Object} values 
 * @returns {String} Material Code
 ********************************************************************/

// Material Code lookups used as output for MaterialMasterID
const UNKNOWNMATERIALID = 'MaterialUnknown'
const MATERIALIDCODES = {
    1: 216706,
    2: 229285,
    3: 134589,
    4: 219823,
    5: 202310,
    7: 216860,
    8: 222431,
    9: 205766,
}

function getMaterialID(values) {
    // Initial read will verify if previous value exists. Returns current if it does not exist.
    if (readFromCache(MACHINE1IVARIANT).value === undefined) {
        writeToCache(MACHINE1IVARIANT, values[MACHINE1IVARIANT])
    }

    if (values[MACHINE1IVARIANT].v !== readFromCache(MACHINE1IVARIANT).value) {
        // reset Production Count to 0
        writeToCache(PRODUCTIONCOUNTADDRESS, 0)    
        writeToCache(MACHINE1IVARIANT, values[MACHINE1IVARIANT].v)
    }
    
    if (MATERIALIDCODES.hasOwnProperty(values[MACHINE1IVARIANT].v)) {
        return MATERIALIDCODES[values[MACHINE1IVARIANT].v]
    }
    else {
        return UNKNOWNMATERIALID
    }
}




