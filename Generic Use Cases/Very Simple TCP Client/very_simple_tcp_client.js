/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name:        Very Simple TCP ASCII Driver Example
 * Description: A simple example profile that demonstrates how to send a
 * request, handle the response and share data with the server
 * 
 * Developed on Kepware Server version 6.15, UDD V2.0
 * 
 * Version:     0.1.1
******************************************************************************/

/** Global variable for UDD API version */
const VERSION = "2.0";

/** Global variable for driver mode */
const MODE = "Client"

/* Global variables for action */
const ACTIONCOMPLETE = "Complete"
const ACTIONFAILURE = "Fail"
const ACTIONRECEIVE = "Receive"

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

    /** 
     * The regular expression to compare address to. This example only validates that 
     * the address is at least one character - letter or number
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
            log('onValidateTag - address "' + info.tag.address + '" is valid.');
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
    log(`onTagsRequest - info: ${JSON.stringify(info)}`)

    let request = "YOUR REQUEST MESSAGE HERE\n"
    // let request = "Hello Server!\n";
    let readFrame = stringToBytes(request);
    return { action: ACTIONRECEIVE, data: readFrame };
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
    log(`onData - info.tags: ${JSON.stringify(info.tags)}`)

    // Convert the response to a string
    let stringResponse = "";
    for (let i = 0; i < info.data.length; i++) {
        stringResponse += String.fromCharCode(info.data[i]);
    }
    
    log(`onData - String Response: ${stringResponse}`)

    info.tags[0].value = stringResponse

    return {action: ACTIONCOMPLETE, tags: info.tags}

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
