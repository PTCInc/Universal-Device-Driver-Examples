/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name: MT-SDS-profile.js
 * Description: Profile designed to communicate with a Mettler Toledo scale 
 * using Shared Data Server commands. The commands may be equivelant for other devivces.
 * Please refer to Mettler Toledo documentation for specific details for specific models.
 * 
 * Developed against a IND780 model scale
 * Developed on Kepware Server version 6.11, UDD V2.0
 * 
 * 
 * Version: 0.1.1
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

/** SDS Connection State **/
let ActiveConnection = false;

/** SDS Login State and Parameters */
let ActiveLogin = false;
let Access_State = null;
// Login Defaults
const SDS_USERNAME = "";
const SDS_PASSWORD = "";


/** SDS Subscription State **/
let ActiveSubscriptions = [];
let failedSubscriptions = [];

/** SDS Constants **/
const SDS_TERMINATOR = [10,13,62]; // Decimal encoded ASCII objects
// SDS Commands
const SDS_USER_CMD = "user";
const SDS_PASS_CMD = "pass";
const SDS_CALLBACK_CMD = "callback";
const SDS_READ_CMD = "read";
const SDS_WRITE_CMD = "write";

/** SDS Response Message Types **/
const SDS_RESP_SUBSCRIBE = "B";
const SDS_RESP_CALLBACK = "C";
const SDS_RESP_READ = "R";
const SDS_RESP_WRITE = "W";
// SDS Response Codes
const SDS_LOGIN_READY = 53;
const SDS_PASS_READY = 51;
const SDS_ACCESS_OK = 12;
const SDS_NO_ACCESS = 93;
const SDS_SUCCESS = 0;
const SDS_FAILURE = 99;
const SDS_ERROR_SYNTAX = 81;
const SDS_ERROR_CMD_NOT_RECOGNIZED = 83;

/** SDS System Tags */
// Tags that can be used to control Login credentials from a client application.
const LOGIN_TAGS_LIST = {
    "Username": {
        address: "Username",
        dataType: data_types.STRING,
        readOnly: false
    },
    "Password": {
        address: "Password",
        dataType: data_types.STRING,
        readOnly: false
    },
    // Writes to this tag will force a relogin of the SDS interface
    "Relogin": {
        address: "Relogin",
        dataType: data_types.BOOLEAN,
        readOnly: false
    }
}

const SYSTEM_TAGS_LIST = {
    // Monitor the Transaction ID from the messages
    "TransactionID": {
        address: "TransactionID",
        dataType: data_types.WORD,
        readOnly: true
    },
    ...LOGIN_TAGS_LIST
}

/** Pre-Defined Tags **/
// Predefined tags that can be created in the driver without knowing the raw SDS addressing
const PREDEF_TAGS_LIST = {
    "GrossWeight": {
        class: "wt",
        attribute: "01",
        dataType: data_types.FLOAT,
        readOnly: true
    }, 
    "NetWeight": {
        class: "wt",
        attribute: "02",
        dataType: data_types.FLOAT,
        readOnly: true
    }, 
    "TareWeight": {
        class: "ws",
        attribute: "10",
        dataType: data_types.FLOAT,
        readOnly: true,
    },
    "Units": {
        class: "wt",
        attribute: "03",
        dataType: data_types.STRING,
        readOnly: true,
    },
    "ScaleID": {
        class: "cs",
        attribute: "03",
        dataType: data_types.STRING,
        readOnly: true,
    },
    "ScaleMode": {
        class: "ws",
        attribute: "01",
        dataType: data_types.STRING,
        readOnly: true,
    }
}

/*
* The regular expression to compare addresses to.
* Raw addressing for SDS is as follows:
*   sp0106 - Where
*   sp = Class
*   01 = Instance or Scale #
*   06 = Attribute
*/

const SDS_RAW_ADDRESS = /([a-z]){2}(\d){4}/;
const TAG_TYPE_ADDRESS = /(read|callback)/;





/** Avoid logging verbose SDS protocol messages unless needed for debugging **/
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

    // Initialize Needed System Tags
    writeToCache(LOGIN_TAGS_LIST.Username.address, SDS_USERNAME);
    writeToCache(LOGIN_TAGS_LIST.Password.address, SDS_PASSWORD);
    writeToCache(SYSTEM_TAGS_LIST.TransactionID.address, 0);
    writeToCache(LOGIN_TAGS_LIST.Relogin.address, false);

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

    // Create Regext for raw SDS addressing format
    let SDSRegex = new RegExp("(" + SDS_RAW_ADDRESS.source + "[.]" + TAG_TYPE_ADDRESS.source + ")$");
    let addressData = new SDSAddress(info.tag)
    let dataType = info.tag.dataType;

    // Check for valid address formats
    if (getSystemRegEx().test(info.tag.address)) {
        // Tag is a System Tag
        log(`onValidateTag - System addressData: ${JSON.stringify(addressData)}`, DEBUG_LOGGING)

        // Fix the data type to the correct one
        if (addressData.dataType !== dataType){
            info.tag.dataType = addressData.dataType
        }

        // Fix the tag reference to readOnly if necessary
        if (addressData.readOnly){
            info.tag.readOnly = true;
        } 

        info.tag.valid = true;

    }
    else if (getPredefRegEx().test(info.tag.address)) {
        // Tag is a predefined data tag
        log(`onValidateTag - Predefined addressData: ${JSON.stringify(addressData)}`, DEBUG_LOGGING)

        // Fix the data type to the correct one
        if (addressData.dataType !== dataType){
            info.tag.dataType = addressData.dataType
        }

        // Fix the tag reference to readOnly if necessary
        if (addressData.readOnly){
            info.tag.readOnly = true;
        } 

        info.tag.valid = true;

    }
    else if (SDSRegex.test(info.tag.address)) {
        // Tag is SDS raw address format
        log(`onValidateTag - SDS addressData: ${JSON.stringify(addressData)}`, DEBUG_LOGGING)

        // Fix the data type to string if set to Default
        if (dataType === data_types.DEFAULT){
            info.tag.dataType = data_types.STRING
        }
        info.tag.valid = true;
    }
    else{
        // Tag is invalid format
        info.tag.valid = false;
        log("ERROR: Tag address '" + info.tag.address + "' is not valid");
        return info.tag;
    }
    
    log('onValidateTag - address "' + info.tag.address + '" is valid.', VERBOSE_LOGGING)
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
    log(`Active Connection: ${ActiveConnection}; Active Login: ${ActiveLogin}`, DEBUG_LOGGING)
    log(`onTagsRequest - info: ${JSON.stringify(info)}`, VERBOSE_LOGGING)

    // Ensure that tags exist in the request before proceeding
    let check = checkTagExists(info);
    if(check !== true) {
        return check
    }
    
    // Currently only will receive one tag at a time
    let tag = info.tags[0];
    let addressData = undefined;

    // Check if tag is LoggingLevel, update from cached value
    if (tag.address === LOGGING_LEVEL_TAG.address){
        let returnAction = updateLoggingTag(info);
        return returnAction;
    }

    // Ensure we are connected to the scale
    if (!ActiveConnection) {
        // Establish TCP socket and listen for response for login
        log('onTagsRequest - Socket connected to scale. Waiting for initial response.', VERBOSE_LOGGING);
        return { action: ACTIONRECEIVE}; 
    }

    // Ensure we are logged in to the scale
    if (!ActiveLogin){
        // Check to see if this is an attempt after the Access was denied due to credentials
        if (Access_State != SDS_NO_ACCESS){
            data = serializeLoginData(new SDSConnect());
            log('onTagRequest - Sending Login Command to scale: ' + data, VERBOSE_LOGGING);
            return { action: ACTIONRECEIVE, data: data };
        }
        // Credentials have previously failed so do not attempt automatically. Relogin tag would need to be used
        // to command reattempt.
        return {action: ACTIONCOMPLETE}
    }

    // Retreive the SDS address information to use
    addressData = new SDSAddress(tag)
    log(`onTagsRequest - addressData: ${JSON.stringify(addressData)}`, DEBUG_LOGGING)

    // If connection and loging is active, then process transaction request
    if (info.type === READ) {
        let result = processReadCmd(info.tags)
        return result
    }
    
    if (info.type === WRITE){
        let result = processWriteCmd(tag);
        return result;
    }
    return { action: ACTIONCOMPLETE }
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
    /**
     * SDS supports both solicited commands and unsolicited "callbacks" or subscriptions. The data provided from the UDD
     * driver could include multiple messages depending on the timing the data is received from the scale.
     */
    let addressData = undefined;
    let SDS_Failure = false;
    let tag = undefined;

    log(`onData - info: ${JSON.stringify(info)}`, VERBOSE_LOGGING)

    // Check to see if a tag response is expected from the driver
    if (info.hasOwnProperty("tags")) {
        // Ensure that tags exist in the request before proceeding
        let check = checkTagExists(info);
        if (check) {
            tag = info.tags[0];
            addressData = new SDSAddress(info.tags[0]);
            log(`addressData: ${JSON.stringify(addressData)}`, DEBUG_LOGGING)
        }
        else {
            return check
        }
    }
    
    // Convert message data to string and separate into multiple SDS messages as needed.
    let inboundData = byteToString(info.data);
    let inboundDataArray = inboundData.split(byteToString(SDS_TERMINATOR));
    
    // Remove last array element as it is typically length 0 due to .split function behavior. 
    // When separator is at begining or end of string, an element with a string of length 0 is created.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split
    if (inboundDataArray[inboundDataArray.length - 1].length === 0){
        inboundDataArray.pop();
    }
    
    /** 
     * Process each of the messages received and populate a listing or response actions based on the multiple messages.
     * This will build an array of all the responses if there are multiple messages to process.
     */
    let respActions = [];
    for(i=0; i < inboundDataArray.length; i++){
        let msg = inboundDataArray[i]
        let responseType = undefined;
        let transactionID = undefined;

        const responseCode = parseInt(msg.substring(2,4));
        log(`onData - Received ${responseStringFromEnum (responseCode)} from scale: ${msg}`, VERBOSE_LOGGING);

        switch (responseCode) {
            case SDS_LOGIN_READY:
                // TCP connection is made and login is ready
                // Reset active states incase this is a reconnection
                ActiveLogin = false;
                ActiveConnection = true;
                ActiveSubscriptions = [];

                // Build and send Login message 
                data = serializeLoginData(new SDSConnect());
                log('onData - Sending Login Command to scale: ' + data, VERBOSE_LOGGING);
                respActions.push({ action: ACTIONRECEIVE, data: data });
                break;
            
            case SDS_PASS_READY:
                // If user needs to provide a password provide password data
                data = serializePasswordData(new SDSConnect());
                log('onData - Sending Password Command to scale: ' + data, VERBOSE_LOGGING);
                respActions.push({ action: ACTIONRECEIVE, data: data });
                break;

            case SDS_ACCESS_OK:
                // Approved access for username
                ActiveLogin = true;
                Access_State = SDS_ACCESS_OK;

                log(`STATUS: Login to SDS Successful`)
                // Verify if a tag request was part of the login event
                if (tag !== undefined){
                    if (info.type === WRITE){
                        let result = processWriteCmd(tag);
                        respActions.push(result)
                    }
                    else if (info.type === READ){
                        let result = processReadCmd(info.tags)
                        respActions.push(result)
                    }
                    else{
                        log(`ERROR: onData - info.type value not provided - info: ${JSON.stringify(info)}`)
                    }
                }
                else{
                    // On reconnect there may not be a tag as part of the event
                    respActions.push({ action: ACTIONCOMPLETE })
                }
                break;
            
            case SDS_NO_ACCESS:
                // Access is denied from the scale
                Access_State = SDS_NO_ACCESS;
                log('ERROR: Login failed or User does not have access permissions.')
                respActions.push({ action: ACTIONCOMPLETE });
                break;

            case SDS_SUCCESS:
                // SUCCESSFUL MESSAGE - Either in response to a command or is a data callback
                responseType = msg.charAt(4);
                transactionID = msg.slice(5,8);
                log(`onData - ${responseStringFromEnum (responseCode)} - RESPONSETYPE: ${responseType}`, DEBUG_LOGGING);

                // Update Transation Counter Tag
                writeToCache(SYSTEM_TAGS_LIST.TransactionID.address, parseInt(transactionID));

                // Process the message based on the response type
                if (responseType === SDS_RESP_SUBSCRIBE) {
                    //CALLBACK IS ACTIVE response from scale
                    ActiveSubscriptions.push(addressData.address);
                    log(`onData - ${responseStringFromEnum (responseCode)} - ACTIVESUBSCRIPTIONS: ${ActiveSubscriptions}`, DEBUG_LOGGING);

                    // Initialize values to 0 for subscriptions
                    writeToCache(addressData.address, 0)
                    info.tags[0].value = 0;
                    respActions.push({ action: ACTIONCOMPLETE , tags: info.tags});
                }
                else if(responseType === SDS_RESP_CALLBACK) {
                    // RECEIVED DATA from callback
                    // Split callback into multiple signal response. Scale sends multiple signals in a subscription response as needed.
                    const callback_msgs = msg.split('~');
                    log(`onData - ${responseStringFromEnum (responseCode)} - CALLBACK MSGS: ${callback_msgs}`, DEBUG_LOGGING);
                    
                    // Remove header
                    let data_msgs = callback_msgs.slice(1);

                    // Remove last array element as it is typically length 0 due to .split function behavior. 
                    // When separator is at begining or end of string, an element with a string of length 0 is created.
                    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split
                    if (data_msgs[data_msgs.length - 1].length === 0){
                        data_msgs.pop();
                    }

                    log(`onData - ${responseStringFromEnum (responseCode)} - DATA MSGS: ${data_msgs}`, DEBUG_LOGGING);

                    // Update driver cache for each value received from callback
                    data_msgs.forEach((msg) => {
                        let values = msg.split('=');
                        log(`Values: ${values[0]} = ${values[1]}`, DEBUG_LOGGING);
                        writeToCache(values[0], parseFloat(values[1]));
                    });
                    respActions.push({ action: ACTIONCOMPLETE });
                }
                else if(responseType === SDS_RESP_READ) {
                    // RECEIVED DATA from solicited read request

                    // Split read into multiple signal responses
                    const read_msgs = msg.split('~');
                    log(`onData - ${responseStringFromEnum (responseCode)} - READ MSGS: ${read_msgs}`, DEBUG_LOGGING);
                    
                    // Remove header
                    let data_msgs = read_msgs.slice(1);
                    
                    // Remove last array element as it is typically length 0 due to .split function behavior. 
                    // When separator is at begining or end of string, an element with a string of length 0 is created.
                    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split
                    if (data_msgs[data_msgs.length - 1].length === 0){
                        data_msgs.pop();
                    }

                    log(`onData - ${responseStringFromEnum (responseCode)} - DATA MSGS: ${data_msgs}`, DEBUG_LOGGING);

                    // Update driver cache for each value received from callback
                    data_msgs.forEach((msg) => {
                        log(`Tag: ${JSON.stringify(addressData)}`, DEBUG_LOGGING)
                        log(`Values: ${msg}`, DEBUG_LOGGING);
                    });

                    // Update tag - Currently assumes only one tag based on current UDD functionality
                    info.tags[0].value = updateTagValue(info.tags[0], data_msgs[0]);
                    respActions.push({ action: ACTIONCOMPLETE, tags: info.tags});
                }
                else if(responseType === SDS_RESP_WRITE) {
                    // Write command response is ACK/Good
                    respActions.push({ action: ACTIONCOMPLETE });
                }
                else {
                    // Unsupported or Unknown response type
                    log(`ERROR: onData - Unrecognized responseType ${commandStringFromEnum(responseType)} from ${responseStringFromEnum (responseCode)} message`)
                    respActions.push({ action: ACTIONFAILURE });
                }
                break;
            case SDS_FAILURE:
                // FAILURE MESSAGE - Either in response to a command or a data callback subscription
                responseType = msg.charAt(4);
                transactionID = msg.slice(5,8);
                SDS_Failure = true;

                log(`onData - ${responseStringFromEnum (responseCode)} - RESPONSETYPE: ${responseType}`, DEBUG_LOGGING);

                // Update Transation Counter Tag
                writeToCache(SYSTEM_TAGS_LIST.TransactionID.address, parseInt(transactionID));

                log(`ERROR: Failed ${commandStringFromEnum(responseType)} command for address ${tag.address}.`)

                // Check for subscription Failure and add to list to prevent resubscription
                if (responseType === SDS_RESP_SUBSCRIBE) {
                    failedSubscriptions.push(addressData.address)
                }
                respActions.push({ action: ACTIONCOMPLETE });
                break;
            default:
                log(`ERROR: onData - Unrecognized SDS response code! Code: ${responseCode}`);
                respActions.push({ action: ACTIONFAILURE });
                break;
        }
    }

    /**
     * Process and consolidate the responses for all messages receieved to one transaction response. The UDD v2.0 driver engine
     * at this does not support being able to provide responses individually for separate messages. This leads to needing to build 
     * some handling to determine what the next state machine condition the driver needs to move to.
     * 
     * For this profile, iterate responses and move to ACTIONRECEIVE as needed ensuring that any tag values to update 
     * or messages that need to be sent out will be processed by the driver.
     */ 

    let returnActions = { action: ACTIONFAILURE };
    for(i=0; i < respActions.length; i++) {
        log(`respActions[${i}]= ${JSON.stringify(respActions[i])}`, DEBUG_LOGGING)
        if (respActions[i].action === ACTIONRECEIVE){
            returnActions.action === respActions[i].action;
        }
        else {
            if (respActions[i].action === ACTIONCOMPLETE && returnActions.action !== ACTIONRECEIVE){
                returnActions.action = respActions[i].action;
            }
        }
        if (respActions[i].tags !== undefined) {
            returnActions.tags = respActions[i].tags
        }
        if (respActions[i].data !== undefined) {
            returnActions.data = respActions[i].data
        }
    }

    // Check to ensure that if a solicited read request is in this transaction and ensure that if there is no value to 
    // update the tag, then do another ACTIONRECEIVE to wait for the read response.
    if (info.type === READ && !returnActions.hasOwnProperty("tags") && returnActions.action !== ACTIONRECEIVE && !SDS_Failure){
        log(`onData - Tag response is expected, but didn't have response yet. Update action to '${ACTIONRECEIVE}'`, DEBUG_LOGGING)
        returnActions.action = ACTIONRECEIVE;
    }

    log(`onData: returnActions = ${JSON.stringify(returnActions)}`, VERBOSE_LOGGING)
    return returnActions;
}

/**
 * Process Read Command helper function
 * 
 * @param {Tags[]} tags Tags currently being processed for a read command
 * @returns {OnTransactionResult} The action to take, tags to complete (if any) and/or data to send (if any).
 */
function processReadCmd (tags) {
    let data = undefined;
    let value = undefined;
    let tag = tags[0];
    let addressData = new SDSAddress(tag);

    if (SYSTEM_TAGS_LIST.hasOwnProperty(addressData.address)){
        // Process System tags
        value = readFromCache(addressData.address).value;
    }
    else if (addressData.functionType === "callback"){
        // Process callback tag after relogin
        // Create a subscription/callback if one is not already active.
        if (!ActiveSubscriptions.includes(addressData.address)) {
            // If a sub has failed for this SDS address previously, prevent resubsciption
            if (failedSubscriptions.includes(addressData.address)) {
                return { action: ACTIONCOMPLETE }   
            }
            // Build SUBSCRIBE message
            data = serializeSubscribeData(addressData.address);
            log(`processReadCmd - Sending SUBSCRIBE data for tag '${tag.address}' to Scale: ` + data, VERBOSE_LOGGING);
            return { action: ACTIONRECEIVE, data: data }; 
        }

        // Otherwise read latest value from cache
	    value = readFromCache(addressData.address).value;
    }
    else {
        // Process all other read requests
        data = serializeReadData(addressData.address)
        log('processReadCmd - Sending READ data for tag "' + tag.address + '" to Scale: ' + data, VERBOSE_LOGGING);
        return { action: ACTIONRECEIVE, data: data};
    }

    // confirm that a value from cache was found
    if (value !== undefined){
        tag.value = value;
        log(`processReadCmd - Cache Read for ${tag.address} - return: ${JSON.stringify(tags)}`, DEBUG_LOGGING)
        return { action: ACTIONCOMPLETE, tags: tags};
    } else {
        log(`ERROR: processReadCmd - No cache for address '${tag.address}'.`)
        return { action: ACTIONCOMPLETE };
    }
}

/**
 * Process Write Command helper function
 * 
 * @param {Tag} tag Tag currently being processed for a write command
 * @returns {OnTransactionResult} The action to take, tags to complete (if any) and/or data to send (if any).
 */
function processWriteCmd (tag) {
    let data = undefined;
    // Process Tag Request
    let addressData = new SDSAddress(tag)

    if (LOGIN_TAGS_LIST[tag.address] !== undefined){
        if (addressData.address === LOGIN_TAGS_LIST.Relogin.address){
            ActiveLogin = false
            ActiveSubscriptions = []
            Access_State = null;
            data = serializeLoginData(new SDSConnect());
            log(`onTagRequest - Sending updated Login Command from '${LOGIN_TAGS_LIST.Relogin.address}' tag to scale: ` + data, VERBOSE_LOGGING);
            return { action: ACTIONCOMPLETE, data: data };
        }
        else {
            writeToCache(tag.address, tag.value)
            log(`onTagRequest - Updating ${tag.address} value: ` + tag.value, VERBOSE_LOGGING)
            return { action: ACTIONCOMPLETE }
        }
    }
    else {
        data = serializeWriteData(addressData.address, tag.value)
        log('onTagsRequest - Sending WRITE data for tag "' + tag.address + '" to Scale: ' + `${data}`, VERBOSE_LOGGING);
        return { action: ACTIONRECEIVE, data: data };
    }
}



/**
 * parses the string representing a float and converts it to a float 
 * with the decimal in the correct location
 * @param   {string}  float String number to parse 
 * @param   {sta}     sta Status word A 
 * @returns {float}       The float with the decimal in the correct location
 */
function ParseFloat(float, sta){
    switch(sta & 0x07){
        case 0: float *= 100.0; break;
        case 1: float *= 10.0; break;
        case 2: break;
        case 3: float /= 10.0; break;
        case 4: float /= 100.0; break;
        case 5: float /= 1000.0; break;
        case 6: float /= 10000.0; break;
        case 7: float /= 100000.0; break;
    }

    return float;
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
 * Note:
 * This function does not support UTF-8 encoded multibyte characters!
 */
 function stringToByteArray (str) {
    var arr = [];
    for (var i = 0; i < str.length; i++) {
        arr.push(str.charCodeAt(i));
    }    
    return arr;
}

/**
 * Quick check to ensure driver provides tags list.
 * 
 * @param {Object} info 
 * @returns Return action if failed or true if found
 */
 function checkTagExists(info) {
    if (!info.hasOwnProperty("tags")) {
        log("CATCH********************************************", DEBUG_LOGGING)
        log(`onTagsRequest - Tag Address in request did not exist. info: ${JSON.stringify(info)}`, DEBUG_LOGGING)
        return {action: ACTIONCOMPLETE}
    }
    // Verifies if Tag is provided, moves on if it is not received
    else if (info.tags.length === 0){
        log("CATCH********************************************", DEBUG_LOGGING)
        log(`onTagsRequest - Tag Address in request did not exist. info: ${JSON.stringify(info)}`, DEBUG_LOGGING)
        return {action: ACTIONCOMPLETE}
    }
    else {
        return true
    }
}

/**
 * Object to store connection info.
 */
class SDSConnect {
    constructor () {
        this.username = readFromCache(LOGIN_TAGS_LIST.Username.address).value       
        this.password = readFromCache(LOGIN_TAGS_LIST.Password.address).value
    }
}


/**
 * Helper functions to serialize the messages to send to the scale
 */

function serializeLoginData (obj) {
    let data = []
    data.push(...stringToByteArray(SDS_USER_CMD))           // command
    data.push(0x20)                                         // space
    data.push(...stringToByteArray (obj.username));         // username  
    data.push(...SDS_TERMINATOR);                           // Terminator
    return data;
}

function serializePasswordData (obj) {
    let data = []
    data.push(...stringToByteArray(SDS_PASS_CMD))           // command
    data.push(0x20)                                         // space
    data.push(...stringToByteArray (obj.password));         // password  
    data.push(...SDS_TERMINATOR);                           // Terminator
    return data;
}

function serializeSubscribeData (obj) {
    let data = []  
    data.push(...stringToByteArray(SDS_CALLBACK_CMD))               // command
    data.push(0x20)                                                 // space
    data.push(...stringToByteArray (obj))                           // variable address
    data.push(...SDS_TERMINATOR);                                   // Terminator
    return data
}

function serializeReadData (obj) {
    let data = []  
    data.push(...stringToByteArray(SDS_READ_CMD))                   // command
    data.push(0x20)                                                 // space
    data.push(...stringToByteArray (obj))                           // variable address
    data.push(...SDS_TERMINATOR);                                   // Terminator
    return data
}

function serializeWriteData (obj, value) {
    let data = []  
    data.push(...stringToByteArray(SDS_WRITE_CMD))                  // command
    data.push(0x20)                                                 // space
    data.push(...stringToByteArray (obj))                           // variable address
    data.push(0x20)                                                 // space
    if (typeof(value) === 'boolean') {
        let convValue = Number(value)
        data.push(...stringToByteArray(convValue.toString()))       // value to write
    }
    else if (typeof(value) === 'number') {
        data.push(...stringToByteArray(value.toString()))           // value to write
    }
    else if (typeof(value) === 'string') {
        data.push(...stringToByteArray(value))                      // value to write
    }   
    else{
        // Other types like Array or Objects - Treat as a string
        let convValue = JSON.stringify(value)
        data.push(...stringToByteArray(convValue))                  // value to write
    }                                           
    data.push(...SDS_TERMINATOR);                                   // Terminator
    return data
}

/**
 * Helper functions to stringify responses and command items
 */

function responseStringFromEnum (response) {
    switch (response) {
        case SDS_LOGIN_READY:
            return "READY FOR USER"
        case SDS_PASS_READY:
            return "READY FOR PASSWORD"
        case SDS_ACCESS_OK:
            return "ACCESS OK. LOGIN COMPLETE."
        case SDS_NO_ACCESS:
            return "NO ACCESS."
        case SDS_SUCCESS:
            return "SUCCESS"
        case SDS_FAILURE:
            return "FAILURE"
        case SDS_ERROR_SYNTAX:
            return "PARAMETER SYNTAX ERROR"
        case SDS_ERROR_CMD_NOT_RECOGNIZED:
            return "CMD NOT RECOGNIZED"
        default:
            return "[!!!!UNKNOWN!!!!]";
    }
}

function commandStringFromEnum (command) {
    switch (command) {
        case SDS_RESP_CALLBACK:
            return "CALLBACK"
        case SDS_RESP_READ:
            return "READ"
        case SDS_RESP_WRITE:
            return "WRITE"
        case SDS_RESP_SUBSCRIBE:
            return "SUBSCRIBE"
        default:
            return "[!!!!UNKNOWN!!!!]";
    }
}

/**
 * Provides the resulting tag value based on the data type
 * 
 * @param {Tag[]} tag 
 * @param {*} value 
 * @returns Value to update Tag
 */
function updateTagValue (tag, value) {
    if (tag.dataType === data_types.STRING) {
        return value;
    }
    else if (tag.dataType === data_types.FLOAT || tag.dataType === data_types.DOUBLE ){
        return parseFloat(value)
    }
    else {
        return parseInt(value)
    }
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

/**
 * Class object to return valid address data for the tag referenced. Used to help bridge system/predefined tags with SDS addressing
 * needed in the requests.
 */
class SDSAddress {
    constructor (tag) {
        if (getPredefRegEx().test(tag.address)) {
            // PreDefined Tag processing
            let predefObj = new SDSPredefAddress(tag.address)
            this.address = predefObj.SDS_address;
            this.datatype = PREDEF_TAGS_LIST[predefObj.name].dataType;
            this.readOnly = PREDEF_TAGS_LIST[predefObj.name].readOnly;
            this.functionType = this.getSDSFunctionType(tag.address)
    
        }
        else if (getSystemRegEx().test(tag.address)){
            // System Tag Processing
            for (let key in SYSTEM_TAGS_LIST[tag.address]) {
                this[key] = SYSTEM_TAGS_LIST[tag.address][key]
            }
            this.functionType = this.getSDSFunctionType(tag.address)
        }
        else {
            // SDS Address Tag Processing
            for (let key in tag) {
                this[key] = tag[key]
            }
            this.functionType = this.getSDSFunctionType(tag.address)
            this.address = this.getSDSAddress(tag.address)
        }
    }
    getSDSAddress(address){
        let tagAddressArray = address.split(".");
        let tagAddress = tagAddressArray[0];
        return(tagAddress)
    }
    getSDSFunctionType(address){
        let tagAddressArray = address.split(".");
        let functionType = tagAddressArray[1]
        return(functionType)
    }
}

/**
 * Used to help define appropriate addressing of predefined tags and map them to SDS addresses used
 * in the protocol/device
 */
class SDSPredefAddress {
    constructor (address) {
        let tagAddressArray = address.split(".");
        let name = tagAddressArray[0].slice(0,-2);
        let scale = tagAddressArray[0].slice(-2);
        let tagAddress = undefined;
    
        if(PREDEF_TAGS_LIST.hasOwnProperty(name)) {
            let tagData = PREDEF_TAGS_LIST[name];
            tagAddress = `${tagData.class}${scale}${tagData.attribute}`
        }

        this.SDS_address = tagAddress;
        this.scale = scale;
        this.name = name;
    }
}

/**
 * Regular Expressions for predefined tags
 * Format as follows:
 *  GrossWeight01
 *  GrossWeight = Predefined Tag
 *  01 = Instance or Scale #
 * 
 * @returns {RegExp} Returns Predefined Tags RegEx to validate against tag address
 */
 function getPredefRegEx () {
    let pre_def_list_REGEX = "";
    let itrArray = [];

    for (let key in PREDEF_TAGS_LIST){
        itrArray.push(key);
    }

    pre_def_list_REGEX = itrArray.join("|");

    let addressPattern = new RegExp("(" + pre_def_list_REGEX + ")(\\d){2}[.]" + TAG_TYPE_ADDRESS.source + "$")
    
    return addressPattern;
}

/**
 * 
 * @returns {RegExp} Returns System Tags RegEx to validate against tag address
 */

function getSystemRegEx () {
    // Build Regex with system tags
    let system_list_REGEX = "";
    let itrArray = [];

    for (let key in SYSTEM_TAGS_LIST){
        itrArray.push(key);
    }

    system_list_REGEX = itrArray.join("|");

    let addressPattern = new RegExp("(" + system_list_REGEX + ")$")

    return addressPattern;
}
