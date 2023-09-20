/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name: json data processing.js
 * Description: Helper Functions that can be used to make a profile to leverage
 * a JSON-like syntax as a tag address to access data that is JSON in format
 * from the device.
 * 
 * Update History:
 * 0.0.1:   Initial Release
 * 0.1.0:   Updated for bulk tag processing feature added to Kepware 6.14. Will
 *              work with pre-6.14 version since the parameter will be ignored.
 *          Updated for tag quality feature added to Kepware 6.14. Will
 *              work with pre-6.14 version since the parameter will be ignored.
 * 
 * Version: 0.1.0
******************************************************************************/

/** Status types */
const ACTIONRECEIVE = "Receive"
const ACTIONCOMPLETE = "Complete"
const ACTIONFAILURE = "Fail"

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

// Global variable for tag quality options
const TAGQUALITY = {
    GOOD: 'Good',
    BAD: 'Bad',
    UNCERTAIN: 'Uncertain'
}

/**
 * Below are snippets that can be added to the event handler functions for UDD
 */

function onValidateTag(info) {

    /*
     * The regular expression to compare address to the expected JSON-like address format.
     * ^, & Starting and ending anchors respectively. The match must occur between the two anchors
     * [a-zA-Z]+ At least 1 or more characters between 'a' and 'z' or 'A' and 'Z'
     * [0-9]+ At least 1 or more digits between 0 and 9
     * | is an or statement between the expressions in the group
     * ()* Whatever is in the parentheses can appear 0 or unlimited times
     * 
     * Many requests for systems that use HTTP can often return a JSON object. 
     * We can use this object to return multiple tag values.
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
     * Format: *key:key[array_offset]:key*
     * 
     * Replaces a ":" is used where "." would be in standard JSON syntax. It can be many
     * levels deep in the structure as well.
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

    let regex = /^[a-zA-Z]+(\[[0-9]+\]|:[a-zA-Z]+)*$/;

    try {
        // Validate the address against the regular expression
        if (regex.test(info.tag.address)) {
            info.tag.valid = true;

            // Requests that return JSON likely will have multiple values that will be parsed
            // into multiple tags. This means you'll neeed to assign a bulkId for every JSON
            // blob received from the device/source. If developing a profile that supports 
            // different JSON structures with multiple requests, multiple bulkId groups will need to be managed.
            info.tag.bulkId = 1;

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

function onData(info) {
    let tags = info.tags;
    
    // Convert the response to a string
    let stringResponse = "";
    for (let i = 0; i < info.data.length; i++) {
        stringResponse += String.fromCharCode(info.data[i]);
    }
    // Get the JSON body of the response
    let jsonStr = stringResponse.slice(stringResponse.indexOf('{'));
    var jsonObj = {}

    // Parse the JSON string
    try {
        jsonObj = JSON.parse(jsonStr);
    }
    catch (e) {
        log(`ERROR: onData - JSON parsing error: ${e.message}`)
        return { action: ACTIONFAILURE }
    }

    // Evaluate each tag's address and get the JSON value 
    tags.forEach(function (tag) {

        tag.value = null;
        let value = get_value_from_payload(tag.address, jsonObj)
        log(`onData - Value found for address "${tag.address}": ${JSON.stringify(value)}`, VERBOSE_LOGGING)
        
        // If the result is an object not a individual value, then convert to string
        if(typeof(value) === 'object') {
            value = JSON.stringify(value)
        }

        tag.value = value

        // Determine if value was not found in the payload
        if (tag.value === undefined || tag.value === null) {
            tag.quality = TAGQUALITY.BAD
        }
        else {
            tag.quality = TAGQUALITY.GOOD
        }
        
    });

    return { action: ACTIONCOMPLETE, tags: tags };
}


/**
 * Helper Functions for JSON data processing 
 */

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




