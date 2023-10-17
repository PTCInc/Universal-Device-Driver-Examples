/*****************************************************************************
 * 
 * This file is copyright (c) 2023 PTC Inc.
 * All rights reserved.
 * 
 * Name: Lightweight Extract, Tranform and Load Stream Processor using 
 * Kepware Universal Device Driver and IoT Gateway Plugin
 * 
 * Description: This example profile receives, prepares and processes continuous 
 * incoming data and caches the results for access and distribution across all 
 * Kepware publisher and server interfaces. 
 * 
 * Data input is expected from a local Kepware IoT Gateway (IOTG) REST Client Agent 
 * configured to publish on Interval in Wide Format using default Standard Message 
 * Template. Tags can be added or removed from the REST Agent via GUI or API to include
 * or exclude from UDD ETL stream processing. 
 * 
 * Fewer bytes - e.g. fewer keys and shorter paths - allows more tags per UDD processor.
 * 
 * Version: 1.0.0
 * 
 * Notes: To create one complete processor one IOTG REST Client Agent should publish 
 * to one UDD channel/device. This single profile can be shared across all UDD channels.
 * 
 * Benchmark: Light testing of this simple profile showed a maximum throughput
 * and stable performance of ~100,000 byte message sizes processed at <500 ms intervals. 
 * This allows ~1200 tags with ~32 char full path names & default IOTG REST Client 
 * JSON format.
 * -- Time measured from observation of IOTG HTTP POST to observation of UDD HTTP ACK
 * -- Specs used for testing: Kepware Server 6.14.263 - Windows 11 - i7-12800H
 * 
******************************************************************************


/** OPTIONAL DEVELOPER GLOBALS AND FUNCTIONS */

// Global variable for driver version
const VERSION = "2.0";

// Global variable for driver mode
const MODE = "Server"

// Status types
const ACTIONRECEIVE = "Receive"
const ACTIONCOMPLETE = "Complete"
const ACTIONFAILURE = "Fail"
const READ = "Read"
const WRITE = "Write"

// Add buffer to handle fragmentation of messages above typical MTU/1500 bytes
var BUFFER = ''

// Helper function to translate string to bytes
function stringToBytes(str) {
    let byteArray = [];
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i) & 0xFF;
        byteArray.push(char);
    }
    return byteArray;
}

/* REQUIRED DRIVER FUNCTIONS (onProfileLoad, onValidateTag, onTagsRequest, onData) */

/**
 * onProfileLoad() - Allow the server to retrieve driver profile metadata
 * 
 * @return {OnProfileLoadResult}  - Driver metadata
 */

 function onProfileLoad() {

    // Initialize driver cache
    try {
        initializeCache();
        
    } catch (e){
        log('Error from initializeCache() during onProfileLoad(): ' + e.message)
    }

    return { version: VERSION, mode: MODE };
}

/**
 * onValidateTag(info) - Allow the server to validate a tag address
 *
 * @param {object}  info          - Object containing the function arguments.
 * @param {Tag}     info.tag      - Single tag.
 *
 * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set. 
*/

function onValidateTag(info) {

    /** 
     * Define Regular Expression rules
     * 
     * @param {string} regex - a regex string
    */

    // This example supports any address syntax
    let regex = /^(.*?)/; 

    // Test tag address against regex and if valid cache address and initial value
    try {
        // Validate the address against the regular expression
        if (regex.test(info.tag.address)) {
            info.tag.valid = true;
            // This example assigns a default data types of string
            if (info.tag.dataType === 'Default'){
                info.tag.dataType = 'String'
            }
            log('onValidateTag - address "' + info.tag.address + '" is valid')
            return info.tag
        } 
        else {
            info.tag.valid = false;
            log("ERROR: Tag address '" + info.tag.address + "' is not valid");
        }

        return info.tag.valid;
        }

    catch(e) {
        // Use log to provide helpful information that can assist with error resolution
        log("ERROR: onValidateTag - Unexpected error: " + e.message);
        info.tag.valid = false;
        return info.tag;
        }
}

/**
 * onTagsRequest(info) - Handle server requests for tags to be read and written
 *
 * @param {object}      info       - Object containing the function arguments.
 * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
 * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
 *
 * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
 */

 function onTagsRequest(info) {
    switch(info.type){
        case READ:
            // If first read of value then intialize cache with appropriate default value
            if (readFromCache(info.tags[0].address).value !== undefined){
                info.tags[0].value = readFromCache(info.tags[0].address).value 
                return { action: ACTIONCOMPLETE, tags: info.tags }
            }
            else {
                writeToCache(info.tags[0].address, '')
                info.tags[0].value = ''
                return { action: ACTIONCOMPLETE, tags: info.tags }
            }
        
        case WRITE:
            // Writes are not built into this example
            log(`ERROR: onTagRequest - Write command for address "${info.tags[0].address}" is not supported.`)
            return { action: ACTIONFAILURE };
        default:
            log(`ERROR: onTagRequest - Unexpected error. Command type unknown: ${info.type}`);
            return { action: ACTIONFAILURE };
    }
}

/**
 * onData(info) - Process raw driver data
 *
 * @param {object}      info       - Object containing the function arguments.
 * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
 * @param {Tag[]}       info.tags  - [Not used in this example] Tags currently being processed. Can be undefined. 
 * @param {Data}        info.data  - Incoming set of "raw" bytes; parse and assign other data types as needed
 *
 * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
 */

 function onData(info) {

    /*
        PREPARATION: This first section prepares the received data for processing
    */

    // This example expects to receive plain text messages so the entire set of bytes is assigned string
    let stringData = "";
    for (let i = 0; i < info.data.length; i++) {
        stringData += String.fromCharCode(info.data[i]);
        }    

    // Append received data to buffer
    BUFFER+=stringData

    // Create object to hold parsed JSON object of tag names and values from Kepware IOTG 
    var jsonData
    
    // Parse JSON structure from buffer and assign to object
    try {
        let jsonStr = BUFFER.substring(BUFFER.indexOf('{'), BUFFER.lastIndexOf('}]}') + 3 );
        jsonData = JSON.parse(jsonStr)
        // Clear buffer if parsing succeeds
        BUFFER = ''
    }
    catch(e) {
        // If parsing fails wait for more and try again
        return { action: ACTIONRECEIVE }
    }

    /*
        PROCESSING: This next section processes the prepared data and saves results to cache
    */

    // If a tag value is True add tag name to comma-seperated list
    try {
        const tagList = []
        if (jsonData.values) {
            jsonData.values.forEach(({ id, v }) => {
                if (v !== false) {
                    tagList.push(id)
                }
            })
            let tagStringNames = tagList.toString()
            writeToCache('result:true_tags', tagStringNames)
        }
        // Send HTTP ACK to related HTTP Publisher in Kepware IOTG after data is processed
        let httpAck = 'HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nKeep-Alive: timeout=10\r\nContent-Length: 0\r\n\r\n'
        const httpABytes = stringToBytes(httpAck)
        return { action: ACTIONCOMPLETE, data: httpABytes }  
    } 
    catch(e) {
        log(`ERROR: ${e}`);
        let httpNAck = 'HTTP/1.1 400 BAD REQUEST\r\n'
        let httpNBytes = stringToBytes(httpNAck)
        return { action: ACTIONFAILURE, data: httpNBytes }  
        }  
}