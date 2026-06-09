/*****************************************************************************
 * 
 * This file is copyright (c) 2024 PTC Inc.
 * All rights reserved.
 * 
 * Name: EtherNet/IP-UCMM-profile
 * Description: A UCMM communication client profile which can connect with Ethernet/IP device
 * Version: 0.1.0
 * Revision history:
 *  v3  CIP object class support
 *      In this version, cip object is described by class. The CIP request and response of a CIP object are
 *      encapsulated into the CIP class. 
 *      
 * 
 *  v4  Message Routing support
 *      CIP message could be routed to the downstream devices. 
 *      The Route info is hardcode in the javascript as there is no way to pass them in currently.
 *      The user of this script has to manually edit it.
 *      
 *      Symbol Object support
 *      User could read the tag values via symbol read method.
 * 
 *  v5  issue fix
 *      Tags passed in OnData may not match with the one in the response message (data)
 *
 * 
******************************************************************************/
/**
 * @typedef {string} MessageType - Type of communication "Read", "Write".
 */

/**
 * @typedef {string} DataType - KEPServerEx datatype "Default", "String", "Boolean", "Char", "Byte", "Short", "Word", "Long", "DWord", "Float", "Double", "BCD", "LBCD", "Date", "LLong", "QWord".
 */

/**
 * @typedef {number[]} Data - Array of data bytes. Uint8 byte array.
 */

/**
 * @typedef {object} Tag
 * @property {string}   Tag.address  - Tag address.
 * @property {DataType} Tag.dataType - Kepserver data type.
 * @property {boolean}  Tag.readOnly - Indicates permitted communication mode.
 * @property {integer}  Tag.bulkId   - Integer that identifies the group into which to bulk the tag with other tags.
 */ 
 
 /**
 * @typedef {object} CompleteTag
 * @property {string}   Tag.address  - Tag address.
 * @property {*}        Tag.value    - (optional) Tag value.
 * @property {string}   Tag.quality  - (optional) Tag quality "Good", "Bad", or "Uncertain".
 */

/**
 * @typedef {object} OnProfileLoadResult
 * @property {string}   version     - Version of the driver.
 * @property {string}   mode        - Operation mode of the driver "Client", "Server".
 */

 /**
 * @typedef {object} OnValidateTagResult
 * @property {string}   address     - (optional) Fixed up tag address.
 * @property {DataType} dataType    - (optional) Fixed up Kepserver data type. Required if input dataType is "Default".
 * @property {boolean}  readOnly    - (optional) Fixed up permitted communication mode.
 * @property {integer}  bulkId      - (optional) Integer that identifies the group into which to bulk the tag with other tags.
 *                                    Universal Device Driver assigns the next available bulkId, if undefined. If defined for one tag,
 *                                    must define for all tags.
 * @property {boolean}  valid       - Indicates address validity.
 */ 

/**
 * @typedef {object} OnTransactionResult
 * @property {string}        action - Action of the operation: "Complete", "Receive", "Fail".
 * @property {CompleteTag[]} tags   - Array of tags (if any active) to complete. Undefined indicates tag is not complete.
 * @property {Data}          data   - The resulting data (if any) to send. Undefined indicates no data to send.
 */

/* Parameters defined for CIP */
// begin
/**
 * @typedef {object} CIPParam
 * @property {BOOL}   cipParam.validFormat
 * @property {Number}   cipParam.classCode
 * @property {Number}   cipParam.instanceID
 * @property {Number}   cipParam.attributeID
 * @property {Number}   cipParam.serviceCode
 * @property {Number[]}   cipParam.symbolSegment
 */ 
/**
 * @typedef {object} CIPRequestCacheElement
 * @property {Number}   element.key  - element key.
 * @property {string}   element.name - element name.
 * @property {DataType} element.datatype - Kepserver data type.
 * @property {CIPParam}  element.cipParam  - element value.
 */ 



var g_cipObjects = []
var g_eipRequestCache = []
var g_context2 
// end

/** Global variable for driver version */
const VERSION = "2.0";

/** Global variable for driver mode */
const MODE = "Client"

/** Status types */
const ACTIONRECEIVE = "Receive"
const ACTIONCOMPLETE = "Complete"
const ACTIONFAILURE = "Fail"

/** Current ID, increments when a new bulkId is assigned to a new topic**/
var CURR_ID = 0;

/* Parameters defined for CIP */
// begin
/** EtherNet/IP Connection State **/
let ListService_status = false; 
let RegisterSession_status = false; 
let SendRRData_Complete = false;
let UnregisterSession_status = false; 

/** Ethernet/IP session number **/
let EIP_Session_ID = [0x00, 0x00, 0x00, 0x00];
// end

/** Global variables to use for logging level */
const STD_LOGGING = 1;
const VERBOSE_LOGGING = 0;
const STD_LOGGING_REQUEST = 2;
const STD_LOGGING_RESPONSE = 3;

// Avoid logging verbose protocol messages unless needed for debugging
// To use verbose logging, set this logging level to VERBOSE_LOGGING
const LOGGING_LEVEL = STD_LOGGING_RESPONSE;

/** Captures the global log function so that it can be wrapped **/
let originalLogFunction = log;
log = function (msg, level = LOGGING_LEVEL) {
    // Always log the STD_LOGGING even if logging VERBOSE_LOGGING
    if (level === LOGGING_LEVEL || level === STD_LOGGING) {
        originalLogFunction(msg);
    }
}

/**
 * Retrieve driver metadata.
 * 
 * @return {OnProfileLoadResult}  - Driver metadata.
 */
function onProfileLoad() {
    /* Initialize our internal global cache to store topic PUBLISH responses */
    initializeCache();
    g_cipObjects = [
        {classcode: 0x01, cipobject: new IdentityObject(1)},
        {classcode: 0x6B, cipobject: new SymbolObject(0)},

    ]
    g_context2 = 0x00000000;
    return { version: VERSION, mode: MODE };
}

 /**
 * Validate an address.
 *
 * @param {object}  info          - Object containing the function arguments.
 * @param {Tag}     info.tag      - Single tag.
 *
 * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set.
 */
function onValidateTag(info) {
    // To do:
    // the tag address in this profile is class xx, instance xx, [attribute xx], service xx
    // onValidateTag will verfiy the tag address by
    // a) verify the tag address if has "class" "instance" and "service" code. attribute is optional
    //    the key word class instance service attribute is none case sensitive 
    // b) get the cip object instance from g_cipobjects, verify if the address class instance attribute service is supported.
    //
    //
    // assign bulkId to the tag
    info.tag.valid = false;
    let cipParam = GetCIPParamFromTagAddress(info.tag.address.toUpperCase());

    if (cipParam.validFormat != true){
        log(`onValidateTag: invalid tag address format ${info.tag.address}`, VERBOSE_LOGGING);
        return info.tag;    
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    let cipobject = GetCIPObject(cipParam.classCode);
    if (!cipobject){
        log(`onValidateTag: Unrecognized tag address ${info.tag.address}`, VERBOSE_LOGGING);
        return info.tag;    
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    let vaildresult =  cipobject.OnValidateCIPAddress(info);

    if (!info.tag.valid) 
    {
        log(`onValidateTag: unsupported CIP address ${info.tag.address} in this profile`, VERBOSE_LOGGING);
    }
    return info.tag;
}
// TODO:
// ListIdentity ListService UnRegisterSession
// 
function ListService() {
    ListService_status = false;
    let listService_data = [];
    return listService_data;
}
function OnListService() {
    ListService_status = true;
    return;
}

function RegisterSession() {    
    let RegisterSession_data = [];
    RegisterSession_data = [
        0x65, 0x00,                             // EIP_CMD_REGISTER_SESSION 
        0x04, 0x00,                             // Length of the message
        0x00, 0x00, 0x00, 0x00,                 // Session handle
        0x00, 0x00, 0x00, 0x00,                 // Status
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Sender Context
        0x00, 0x00, 0x00, 0x00,                         // Options
        0x01, 0x00,                                     // Protocol version 
        0x00, 0x00                                      // Option flags
        ]
    return RegisterSession_data;
}
/**
 * Handle the response of the RegisterSession request.
 *
 * @param {Data}        data  - The incoming data.
 *
 */
function OnRegisterSession(data) {
    let command = data[1]<<8|data[0];
    let status = (data[11]<<24|data[10]<<16|data[9]<<8||data[8])&0x00000000FFFFFFFFFF;

    if (command == 0x65 && status == 0x00000000) {
        
        EIP_Session_ID[0] = data[4];
        EIP_Session_ID[1] = data[5];
        EIP_Session_ID[2] = data[6];
        EIP_Session_ID[3] = data[7];

        log(`OnRegisterSession: RegisterSession Success to Downstream Device, Session ID: ${Bytes2Str(EIP_Session_ID)}`, VERBOSE_LOGGING);
        RegisterSession_status = true;
    }
    else if (command == 0x65 && status == 1 && (EIP_Session_ID.toString()!=[0,0,0,0].toString())) {
        log(`OnRegisterSession: RegisterSession Invalid Request to Downstream Device as already had one Session ID: ${Bytes2Str(EIP_Session_ID)}`, VERBOSE_LOGGING);
    }
    else {
        log(`OnRegisterSession: RegisterSession Failed to Downstream Device, Command: ${command.toString(16)}, Status: ${status.toString(16)}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, VERBOSE_LOGGING);
    }
    return RegisterSession_status
}

function UnregisterSession() {
    UnregisterSession_status = true;
    EIP_Session_ID = [0,0, 0, 0];
    return UnRegisterSession_data;
}
function OnUnregisterSession() {
    ListService_status = false;
    RegisterSession_status = false;
    UnregisterSession_status = false;
    return;
}
/**
 * Build the SendRRData request, with tag information
 *
 * @param {object}      info       - Object containing the function arguments.
 * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
 * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
 * @return {Data}} 
*/
function SendRRData(info) {
    let tag_address = info.tags[0].address;
    g_context2 ++;
    let cipRequestParam = GetCIPParamFromTagAddress(tag_address.toUpperCase());
    log(`SendRRData: GetCIPParamFromTagAddress for tag ${tag_address}, class ${cipRequestParam.classCode}`, STD_LOGGING_REQUEST);

    let eipEncapsulationData = [
        ///////////////////////////////////////////////////////////////////////////
        //Command
        0x6f, 0x00,
        // Length for command specfic data block 
        // index in array, 2
        0x16, 0x00, 
        //Session handle
        EIP_Session_ID [0], EIP_Session_ID [1], EIP_Session_ID [2], EIP_Session_ID [3],
        //Status
        0x00, 0x00, 0x00, 0x00, 
        //set sender context1 
        cipRequestParam.classCode, cipRequestParam.instanceID, cipRequestParam.attributeID,cipRequestParam.serviceCode, 
        //set sender context2
        g_context2&0x000000FF, (g_context2&0x0000FF00)>>8, (g_context2&0x00FF0000)>>16, (g_context2&0xFF000000)>>24,
        //Options
        0x00, 0x00, 0x00, 0x00, 

        //command specfic data block
        //{{{
        //Interface handle
        0x00, 0x00, 0x00, 0x00,
        //Timeout 
        0x00, 0x00,
        //Encapsulated Packet 
        0x02, 0x00,
        ////Address Type ID, 0 for UCMM
        0x00, 0x00, 
        ////Address length, 0 for UCMM
        0x00, 0x00,
        ////Data Type ID, B2 for UCMM
        0xb2, 0x00, 

        ////////////////////////////////////////////////////////////////////////////////

        //CIP Package length
        // Index in array, 38
        0x00, 0x00,

        //CIP Package Begin
        //Unconnected Send Command, connection manager
        0x52,
        0x02,
        0x20, 0x06,
        0x24, 0x01,
        //Priority timout ticks
        0x07, 0x80,

        //Embeded Message Size
        // Index in array, 48
        0x00, 0x00,

        //Multiple Service Request, message router
        0x0A, 
        0x02,
        0x20, 0x02,
        0x24, 0x01,
        
        //CIP message command count
        // offset position 0
        0x01, 0x00,

        //offset of 1st CIP msg cmd.
        0x04, 0x00

        // offset position 4
        // 1st CIP msg cmd





    ];
    
    let cipCmd= [];
    let cipobject = GetCIPObject(cipRequestParam.classCode);
    if (!cipobject){
        log(`SendRRData: unsupported cip class ${cipRequestParam.classCode}`, STD_LOGGING_REQUEST);
        return cipCmd;
    }

     cipCmd = cipobject.OnCIPServiceRequest(cipRequestParam,info);


    cipCmd.forEach(element => {
        eipEncapsulationData.push(element);
    });
////////////////////////////////////////////////////////////////////////////////
// add route path size
    eipEncapsulationData.push(0x01);
    eipEncapsulationData.push(0x00);
// add rout info, backplane, slot 1
    eipEncapsulationData.push(0x01);
    eipEncapsulationData.push(0x00);
// CIP Package End
//}}}
    eipEncapsulationData[48] = cipCmd.length + 10;
    eipEncapsulationData[38] = 4 + cipCmd.length + 20;
    eipEncapsulationData[2] = 4 + cipCmd.length + 36;

    g_eipRequestCache.push({key:g_context2, name:tag_address, cipParam:cipRequestParam});
    log(`SendRRData: push g_eipRequestCache, context1 ${cipRequestParam.classCode.toString(16)} ${cipRequestParam.instanceID.toString(16)} ${cipRequestParam.attributeID.toString(16)} ${cipRequestParam.serviceCode.toString(16)} context2 ${g_context2} for tag ${tag_address} `, STD_LOGGING_REQUEST);

    
    log(`SendRRData: Build SendRRData Request context1 ${cipRequestParam.classCode.toString(16)} ${cipRequestParam.instanceID.toString(16)} ${cipRequestParam.attributeID.toString(16)} ${cipRequestParam.serviceCode.toString(16)} context2 ${g_context2} for tag ${tag_address} to Downstream Device: ${Bytes2Str(eipEncapsulationData)}`, STD_LOGGING_REQUEST);
    return eipEncapsulationData;
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
function OnSendRRData(info) {
    log(`OnSendRRData: Received response from Downstream Device: ${Bytes2Str(info.data)}`, VERBOSE_LOGGING);
    let data = info.data;
    let command = data[1]<<8|data[0];
    let cipParam = {    }
    let classCode = data[12];
    let instanceID = data[13];
    let attributeID = data[14];
    let serviceCode = data[15];


    let context2= (data[19]<<24)|(data[18]<<16)|(data[17]<<8)|data[16];
    let sessionID =[data[4],data[5], data[6], data[7]];
    let status = (data[11]<<24)|(data[10]<<16)|(data[9]<<8)||data[8];
    log(`OnSendRRData: command ${command.toString(16)}, sessionID ${Bytes2Str(sessionID)}, status ${status.toString(16)}`, VERBOSE_LOGGING);

    let cipNextRequestElement = {};
    let result = {};

    g_eipRequestCache.forEach(cipRequestElement => {
        if(cipRequestElement.key == context2){
            cipNextRequestElement = cipRequestElement;
            cipParam.validFormat = cipRequestElement.cipParam.validFormat;
            cipParam.classCode   = cipRequestElement.cipParam.classCode;
            cipParam.instanceID   = cipRequestElement.cipParam.instanceID;
            cipParam.attributeID   = cipRequestElement.cipParam.attributeID;
            cipParam.serviceCode   = cipRequestElement.cipParam.serviceCode;
            cipParam.symbolSegment = cipRequestElement.cipParam.symbolSegment;
            log(`OnSendRRData: find context2 ${context2}  in g_eipRequestCache, result is cipParam.classCode ${cipParam.classCode}, cipParam.instanceID ${cipParam.instanceID}, cipParam.attributeID ${cipParam.attributeID}, cipParam.serviceCode ${cipParam.serviceCode}`, VERBOSE_LOGGING);

        }
    });

    if (cipParam.classCode != classCode ||
        cipParam.serviceCode != serviceCode ||
        cipParam.instanceID != instanceID ||
        cipParam.attributeID != attributeID
    ){
        log(`OnSendRRData: SendRRData failed due to mismatched context2 ${context2} with cip requests: class ${classCode}, instance ${instanceID}, atti ${attributeID}, service ${serviceCode}}`, STD_LOGGING_RESPONSE);
        return { action: ACTIONCOMPLETE };
    }
    //log(`OnSendRRData: find context2 in g_eipRequestCache, result is cipParam.classCode ${cipParam.classCode}, cipParam.instanceID ${cipParam.instanceID}, cipParam.attributeID ${cipParam.attributeID}, cipParam.symbolSegment ${Bytes2Str(cipParam.symbolSegment)}`, VERBOSE_LOGGING);
    log(`OnSendRRData: find context2 ${context2} in g_eipRequestCache, result is cipParam.classCode ${cipParam.classCode}, cipParam.instanceID ${cipParam.instanceID}, cipParam.attributeID ${cipParam.attributeID}`, VERBOSE_LOGGING);
    g_eipRequestCache.forEach(function(item, index, arr) {
        if(item.key == context2) {
            arr.splice(index, 1);
        }
    });



    

    if (command == 0x6f && status == 0x00000000 && info.tags && (typeof (info.tags) != "undefined")) 
    {
        
        if(sessionID.toString() == EIP_Session_ID.toString()) 
        {


            let cipobject = GetCIPObject(classCode);
            let result = cipobject.OnCIPServiceResponse(cipParam, info);

            if(result.action == ACTIONRECEIVE){
                log(`OnSendRRData: Need to extra SendRRData to get the whole response for class ${cipParam.classCode} instance ${cipParam.instanceID} attribute ${cipParam.attributeID} service ${cipParam.serviceCode}`, STD_LOGGING_RESPONSE|STD_LOGGING_REQUEST|STD_LOGGING|VERBOSE_LOGGING);
                let tags= [{MessageType:"READ", address: cipNextRequestElement.name }]
                let extraCIPRequest = SendRRData({tags:tags});
                result = {action:ACTIONRECEIVE, data:extraCIPRequest};
                log(`OnSendRRData: sending extra SendRRData to get the whole response for class ${cipParam.classCode} instance ${cipParam.instanceID} attribute ${cipParam.attributeID} service ${cipParam.serviceCode} data ${Bytes2Str(extraCIPRequest)}`, STD_LOGGING_RESPONSE|STD_LOGGING_REQUEST|STD_LOGGING|VERBOSE_LOGGING);

            }
            /*
            switch (context1)    
            {
                case 0x01010100:
                    {

                    }
                    break;
                case 0x0101010E:
                    {
                        let servicecode = data[40];
                        let statuscode = data[43]<<8|data[42];
                        let vendorID = data[45]<<8|data[44];
                        
                        let writeResult;

                        g_map.forEach(element => {
                            if (element.key == 0x0101010E) {
                                // could Write to Cache here, if it is needed. 
                                //element.value = vendorID;
                                //writeResult = writeToCache(element.key.toString(16), vendorID.toString() );
                                info.tags[0].value = vendorID;
                            }
                        });
                        // if Write to Cache , then return Action complete, no need to update tags
                        //result = { action: ACTIONCOMPLETE};
                        result = { action: ACTIONCOMPLETE,  tags: info.tags};
                        log(`OnSendRRData: Success to process the response for Tag: ${element.name}, Session ID: ${Bytes2Str(EIP_Session_ID)}, write result ${writeResult}`, VERBOSE_LOGGING);
                    }
                    break;
                default:
                    {
                        result = { action: ACTIONFAILURE};
                        log(`OnSendRRData: Failed to process the response for Context1: ${context1.toString(16)}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, VERBOSE_LOGGING);
                    }
                    break;
            }*/
            return result;
        }
        else {
            log(`OnSendRRData: Failed due to incorrect sessionID ${sessionID.toString(16)}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);
            return { action: ACTIONFAILURE };
        }
    }
    else if (command == 0x6f && status == 0x00000000 && !info.tags) {
        log(`OnSendRRData: SendRRData failed due to no tags to process, Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);
        return { action: ACTIONFAILURE };
    }
    else if (command == 0x6f && status == 0x00000000 && (typeof (info.tags) == "undefined")) {
        log(`OnSendRRData: SendRRData failed due to tags are "undefined", Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);
        return { action: ACTIONFAILURE };
    }
    else if (command == 0x6f && status != 0x00000000 ) {
        log(`OnSendRRData: SendRRData failed, status: ${status.toString(16)}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);
        if(status === 0x64){
            log(`OnSendRRData: SendRRData failed because Session ID: ${Bytes2Str(EIP_Session_ID)} invalid`, STD_LOGGING_RESPONSE);
            log(`OnSendRRData: Re-register Session`, STD_LOGGING_RESPONSE);
            EIP_Session_ID =[0, 0, 0, 0];
            RegisterSession_status = false;
            return {action: ACTIONCOMPLETE };

        }
        log(`OnSendRRData: SendRRData failed due to no error handling for status: ${status.toString(16)}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);
        return { action: ACTIONFAILURE };
    }
    else {
        log(`OnSendRRData: SendRRData failed status reported from Downstream Device, Status: ${status.toString(16)}, tags count: ${info.tags.length}`, STD_LOGGING_RESPONSE);
        return { action: ACTIONFAILURE };
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
    let data = [];
    log(`onTagsRequest: Processing Request for tag: ${info.tags[0].address}`, STD_LOGGING_REQUEST);
    // Ensure EtherNet/IP connection is established
    //if (!ListService_status) {
    //    // Build ListService request
    //    data = ListService ();
    //    log(`onTagsRequest: Sending ListService Request to Downstream Device: ${data}`, VERBOSE_LOGGING);
    //    return { action: ACTIONRECEIVE, data: data }; 
    //}   
    if (/*ListService_status && */
        !RegisterSession_status) 
    {
        // Build RegisterSession request
        data = RegisterSession ();
        log(`onTagsRequest: Sending RegisterSession Request to Downstream Device: ${Bytes2Str(data)}`, STD_LOGGING_REQUEST);
        return { action: ACTIONRECEIVE, data: data }; 
    }   
    // Build EtherNet/IP UCMM request for normal tags 
    //  
    //      if RegisterSession_status is false, 
    //      means the EtherNet/IP connection is not established    
    //      if it is true, then the EtherNet/IP connection should be established 
    //      then we need to chech the session id, 
    //      if the session id is 0, then we can send the request to get the tag values   
    if(/*ListService_status && */
        RegisterSession_status ) 
    {
        if(EIP_Session_ID.toString() != [0, 0, 0, 0].toString()) {

            let cipRequest = SendRRData (info);
            if(!cipRequest){
                log(`onTagsRequest: failed to get RR data!`, STD_LOGGING_REQUEST);
                return { action: ACTIONFAILURE };
            }
            if (!SendRRData_Complete){
                log(`onTagsRequest: WARNING, Issue SendRRData Request before previous one responsed from Downstream Device, tag: ${info.tags[0].address}`, STD_LOGGING_REQUEST);            
            }
            log(`onTagsRequest: Sending SendRRData Request for tag ${info.tags[0].address} to Downstream Device: ${Bytes2Str(cipRequest)}`, STD_LOGGING_REQUEST);
            SendRRData_Complete = true;

            let result = {action: ACTIONRECEIVE, data: cipRequest};
            //  The value saved in Cache, then we can retrieve the value here.
            //  Need to update value and send next request at the same time
            //  we should return Action complete, tags, also the request 
            //  
            //  if just not read from cache but from response, then just return
            //  with action receive, and next reqest.
            //return { action: ACTIONCOMPLETE, tags: info.tags, data: data }; 

            /*
            let tag_address = info.tags[0].address;

            
            let cipRequestParam = GetCIPParamFromTagAddress(tag_address.toUpperCase());
            let cipobject = GetCIPObject(cipRequestParam.classCode);
            let retGetValue  = cipobject.GetAttributeValues(cipRequestParam, info);
            if (retGetValue){
                result = { action: ACTIONRECEIVE, tags: info.tags, data: cipRequest }; 
            }
            else{
                result = { action: ACTIONRECEIVE, data: cipRequest }; 
            }
            */

            return result;

        }
        else {
            log(`onTagsRequest: invalid EIP_Session_ID, Unrecognized status!`, STD_LOGGING_REQUEST);
            return { action: ACTIONFAILURE };
        }
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
    const inboundData = info.data;

    let command = inboundData[1]<<8|inboundData[0];
    let status = inboundData[11]<<24|inboundData[10]<<16|inboundData[9]<<8||inboundData[8];
    
    log(`onData: Received response from Downsteam Device: command ${command.toString(16)}, status ${status.toString(16)}`, VERBOSE_LOGGING);

    switch (command) {
        case 0x65:
        {
            // RegisterSession response
            let result = OnRegisterSession(inboundData);
            if (result) {
                if(info.tags)
                    info.tags[0].value = 0;
                return { action: ACTIONCOMPLETE, tags: info.tags };
            }
            else {
                log(`onData: OnRegisterSession Failed to get the session ID, Command: ${command.toString(16)}, Status: ${status.toString(16)}`, STD_LOGGING_RESPONSE);
                return { action: ACTIONFAILURE };
            }
        }    
        case 0x6f:
        {
            // SendRRData response
            let result = OnSendRRData(info);
            
            //////////////////////////////////////
            /*
            let tag_address = info.tags[0].address;

            
            let cipRequestParam = GetCIPParamFromTagAddress(tag_address.toUpperCase());
            let cipobject = GetCIPObject(cipRequestParam.classCode);
            let retGetValue  = cipobject.GetAttributeValues(cipRequestParam, info);
            if (retGetValue){
                result = { action: ACTIONCOMPLETE, tags: info.tags }; 
            }
            else{
                result = { action: ACTIONCOMPLETE }; 
            }*/
            /////////////////////////////////////
            log(`onData: OnSendRRData Done, result: ${result.action}`, VERBOSE_LOGGING);
            SendRRData_Complete = false;
            
            return result;
        }
        default:
            log(`onData: Unrecognized Ethernet/IP command! Command: ${command.toString(16)}, Status: ${status.toString(16)}`, STD_LOGGING_RESPONSE);
            return { action: ACTIONFAILURE };
    }
}

/* *******************************
 * Helper functions
 * *******************************/ 

/* *******************************
 * Nibble manipulation helpers
 * *******************************/
function hiNibble (byte) {        
    return (byte & 0xF0) >> 4
}

function loNibble (byte) {
    return (byte & 0xF)
}

function byteFromNibble (hi, lo) {
    return hi << 4 | lo
}

/* *******************************
 * Word manipulation helpers
 * *******************************/ 
function hiByte (word) {
    return (word & 0xFF00) >> 8;
}

function loByte (word) {
    return (word & 0xFF);
}

function wordFromBytes (hi, lo) {
    return hi << 8 | lo;
}

/**
 * Note:
 * This function does not support UTF-8 encoded multibyte characters!  
 * It must be extended to work with topics, payloads, and client names
 * that include such extended unicode characters. 
 */
function stringToByteArray (str) {
    var arr = [];
    for (var i = 0; i < str.length; i++) {
        arr.push(str.charCodeAt(i));
    }    
    return arr;
}

/**
 * Note:
 * This function does not handle UTF-8 encoded multibyte characters!
 * It must be extended to work with topics, payloads, and client names
 * that include such extended unicode characters. 
 */
function byteArrayToString(data) {
    return String.fromCharCode.apply(null, data);
}

function Bytes2Str(arr) {
    var str = "";
    for (var i = 0; i < arr.length; i++) {
      var tmp;
      var num=arr[i];
      if (num < 0) {
        tmp =(255+num+1).toString(16);
      } else {
        tmp = num.toString(16);
      }
      if (tmp.length == 1) {
        tmp = "0" + tmp;
      }
      str += tmp;
      str += " ";
    }
    return str;
  }

function GetCIPParamFromTagAddress(tagAddress){
    let validFormat = false;
    let classCode = 0;
    let instanceID = 0;
    let attributeID = 0;
    let serviceCode = 0;
    let symbolSegment = [];
    let tag_address = tagAddress;

    //class 1, instance 1, attribute 1, service 14
    if(tag_address.includes("TAG")){
        if (tag_address.includes("CLASS") || tag_address.includes("INSTANCE") ||tag_address.includes("SERVICE")){
            
            log(`GetCIPParamFromTagAddress for address ${tagAddress}, invalid format`, VERBOSE_LOGGING);  
            return {validFormat:validFormat, classCode:classCode, instanceID:instanceID, attributeID:attributeID, serviceCode: serviceCode, symbolSegment:symbolSegment};
        }
        
        if(tag_address.includes("TAG ")&& (tag_address.indexOf("TAG ")== 0)){
            classCode = 0x6B;
            instanceID = 0;
            attributeID = 0;
            serviceCode = 0x4C;
            symbolSegment = [];
            let TagNameOffset = tag_address.indexOf("TAG ") + "TAG ".length;

            let TagName = String (tag_address.slice(TagNameOffset));
            let TempSymbol = TagName;
            while(TempSymbol.length){
                if(TempSymbol.includes(".")&&TempSymbol.indexOf(".")!=0){

                    let subTempSymbol = TempSymbol.slice(0, TempSymbol.indexOf('.'));
                    TempSymbol = TempSymbol.slice(indexOf('.')+1);

                    symbolSegment.push(0x91);
                    symbolSegment.push(subTempSymbol.length);
                    for (var i = 0; i < subTempSymbol.length; i++) {
                        symbolSegment.push(subTempSymbol.charCodeAt(i));
                    } 
                    if(subTempSymbol.length%2 == 1)
                        symbolSegment.push(0);
                    continue;
                }
                
                else if(TempSymbol.includes("[")&&TempSymbol.indexOf("[")){
                    let arrayDim = TempSymbol.slice(TempSymbol.indexOf("[")+1, TempSymbol.indexOf("]"));
                    TempSymbol = TempSymbol.slice(TempSymbol.indexOf("]")+1);

                    //TempSymbol.split
                }

                else{
                    let subTempSymbol = TempSymbol.slice(0);
                    TempSymbol = TempSymbol.slice(TempSymbol.length+1);

                    symbolSegment.push(0x91);
                    symbolSegment.push(subTempSymbol.length);
                    for (var i = 0; i < subTempSymbol.length; i++) {
                        symbolSegment.push(subTempSymbol.charCodeAt(i));
                    } 
                    if(subTempSymbol.length%2 == 1)
                        symbolSegment.push(0);
                    
                    continue;
                }
            }
            validFormat = true;
        }
        else{
            log(`GetCIPParamFromTagAddress for address ${tagAddress}, invalid format`, VERBOSE_LOGGING);  
            return {validFormat:validFormat, classCode:classCode, instanceID:instanceID, attributeID:attributeID, serviceCode: serviceCode, symbolSegment:(symbolSegment)};
        }
    }
    else{
        if (tag_address.includes("CLASS ")&& (tag_address.indexOf("CLASS ")== 0) && tag_address.includes(", INSTANCE ")&& tag_address.includes(", SERVICE ")){
            let classCodeOffset = tag_address.indexOf("CLASS ") + "CLASS ".length;
            let instanceOffset = tag_address.indexOf(", INSTANCE ") + ", INSTANCE ".length;
            let serviceOffset = tag_address.indexOf(", SERVICE ") + ", SERVICE ".length;
            let attibuteOffset = 0;
            //log(`GetCIPParamFromTagAddress for address ${tagAddress}, class offset ${classCodeOffset}, instance offset ${instanceOffset}, service offset ${serviceOffset}`, VERBOSE_LOGGING);  
    
            if(tag_address.includes(", ATTRIBUTE ")){
                
                attibuteOffset = tag_address.indexOf(", ATTRIBUTE ") + ", ATTRIBUTE ".length;
                //log(`GetCIPParamFromTagAddress for address ${tagAddress}, includes attribute, attribute offset ${attibuteOffset}`, VERBOSE_LOGGING);  
                if ((classCodeOffset < instanceOffset) && (instanceOffset < attibuteOffset)&& (attibuteOffset < serviceOffset)){
                    validFormat = true;
                    classCode = Number(tag_address.slice(classCodeOffset, instanceOffset - ", INSTANCE ".length));
                    instanceID = Number(tag_address.slice(instanceOffset, attibuteOffset - ", ATTRIBUTE ".length));
                    attributeID = Number(tag_address.slice(attibuteOffset, serviceOffset - ", SERVICE ".length));
                    serviceCode = Number(tag_address.slice(serviceOffset));
                }
            }
            else{
                //log(`GetCIPParamFromTagAddress for address ${tagAddress}, doesn't include attribute`, VERBOSE_LOGGING);  
                if (classCodeOffset < instanceOffset && instanceOffset < serviceOffset){
                    validFormat = true;
                    classCode = Number(tag_address.slice(classCodeOffset, instanceOffset - ", INSTANCE ".length));
                    instanceID = Number(tag_address.slice(instanceOffset, serviceOffset - ", SERVICE ".length));
                    serviceCode = Number(tag_address.slice(serviceOffset));
                }
    
            }
            //log(`GetCIPParamFromTagAddress for address ${tagAddress}, class ${classCode}, instance ${instanceID}, attribute ${attributeID}, service ${serviceCode}`, VERBOSE_LOGGING);  
        }
    } 
    log(`GetCIPParamFromTagAddress for address ${tagAddress}, class ${classCode}, instance ${instanceID}, attribute ${attributeID}, service ${serviceCode}, symbol ${Bytes2Str(symbolSegment)}`, VERBOSE_LOGGING);  
    return {validFormat:validFormat, classCode:classCode, instanceID:instanceID, attributeID:attributeID, serviceCode: serviceCode, symbolSegment:(symbolSegment)};
}
function GetCIPObject(classcode){
    let cipobject;
    //log(`GetCIPObject for class ${classcode}`, VERBOSE_LOGGING); 
    g_cipObjects.forEach(element =>{
        if (element.classcode == classcode) {
            cipobject = element.cipobject;
        }
    }); 
    //log(`GetCIPObject for class ${classcode}, cipobject ${cipobject}`, VERBOSE_LOGGING); 
    return cipobject;
}
/* *******************************
 * class CIPObject
 * *******************************/ 
class CIPObject {
    constructor() {
        this.classCode = 0x00;
        this.instanceID = 0x00;
    
        this.services = [];
        

        this.attributes= [];
    }
    /**
     * Validate CIP address.
     *
     * @param {object}  info          - Object containing the function arguments.
     * @param {Tag}     info.tag      - Single tag.
     *
     * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set.
     */
    OnValidateCIPAddress(info) {
        // To do:
        // 1. validate tag address and check if it exists in the NL20
        // 2. assign bulkId to the tag
        info.tag.valid = false;

        return info.tag;
    }
    /**
     * Build the service request message.
     *
     * @param {CIPParam}    cipParam 
     * @param {object}      info       - Object containing the function arguments.
     * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
     * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
     * 
     * @return {Data}   - The action to take, tags to complete (if any) and/or data to send (if any).
     *
     **/
    OnCIPServiceRequest(cipParam, info){

    }
    /**
     * Processing the incoming data pacakge
     * Reterive the attibutes and update the property of the class
     * 
     * @param {CIPParam}    cipParam
     * @param {object}      info       - Object containing the function arguments.
     * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
     * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
     * @param {Data}        info.data  - The incoming data.
     *
     * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
     *
     **/
    OnCIPServiceResponse(cipParam, info) {
 
    }
    /**
     * Get the attribute value from the property of the class
    * @param {CIPParam}    cipParam
    * @param {object}      info       - Object containing the function arguments.
    * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
    * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
    * 
    * @return {Boolean}
    *  
    **/
    GetAttributeValues(){

    }
}

class IdentityObject extends CIPObject{
    
    constructor(instanceID){
        super();
        this.classCode = 0x01;
        this.instanceID = instanceID;
    
        this.services = [
            {serviceCode: 0x0E, serviceName: "Get_Attribute_Single", serviceResult:0x00}
        ];
        

        this.attributes= [
            {attr_Id:1, attr_Name:"vendor ID",attr_Datatype:"Word", attr_ReadOnly: true,  attr_Value:0x00},
            {attr_Id:2, attr_Name:"Device Type",attr_Datatype:"Word", attr_ReadOnly: true,  attr_Value:0x00},
            {attr_Id:3, attr_Name:"Product Code",attr_Datatype:"Word", attr_ReadOnly: true,  attr_Value:0x00},
            {attr_Id:4, attr_Name:"Revision",attr_Datatype:"String", attr_ReadOnly: true,  attr_Value:0x00},
            {attr_Id:5, attr_Name:"Status",attr_Datatype:"Word", attr_ReadOnly: true,  attr_Value:0x00},
            {attr_Id:6, attr_Name:"Serial Number",attr_Datatype:"String", attr_ReadOnly: true,  attr_Value:0x00},
            {attr_Id:7, attr_Name:"Product Name",attr_Datatype:"String", attr_ReadOnly: true,  attr_Value:""}
        ];
        log(`Identity Object, constructor succeed`, VERBOSE_LOGGING);    
    }
     /**
     * Validate CIP address.
     *
     * @param {object}  info          - Object containing the function arguments.
     * @param {Tag}     info.tag      - Single tag.
     *
     * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set.
     */
    OnValidateCIPAddress(info) {
        // To do:
        // 1. validate CIP address and verify class instance attribute and service
        // 2. assign bulkId to the tag
        //constructor
        info.tag.valid = false;

        log(`Identity Object, OnValidateCIPAddress, for tag ${info.tag.address}`, VERBOSE_LOGGING); 

        let cipParam = GetCIPParamFromTagAddress(info.tag.address.toUpperCase());
        log(`Identity Object, OnValidateCIPAddress, GetCIPParamFromTagAddress validformat ${cipParam.validFormat}, class ${cipParam.classCode}, instance ${cipParam.instanceID}, attribute ${cipParam.attributeID}, service ${cipParam.serviceCode}`, VERBOSE_LOGGING); 
        if(cipParam.validFormat != true){
            log(`Identity Object, OnValidateCIPAddress, return as invlid format`, VERBOSE_LOGGING); 
            return info.tag;
        }

        if(this.classCode != cipParam.classCode){
            log(`Identity Object, OnValidateCIPAddress, return as class code not match this.classcode ${this.classCode} cipParam.classcode ${cipParam.classCode}`, VERBOSE_LOGGING);
            return info.tag;
        }

        if(this.instanceID != cipParam.instanceID){
            log(`Identity Object, OnValidateCIPAddress, return as instance code not match this.instanceID ${this.instanceID} cipParam.instanceID ${cipParam.instanceID}`, VERBOSE_LOGGING);
            return info.tag;
        }

        let service;
        this.services.forEach(element =>{
            if(element.serviceCode == cipParam.serviceCode)
            {
                service = element;
            }
        });
        if(!service){
            log(`Identity Object, OnValidateCIPAddress, return as service code not supported, cipParam.servicecode ${cipParam.serviceCode}`, VERBOSE_LOGGING);
            return info.tag;
        }

        if(cipParam.attributeID == 0){
            // To Do:
            // for no attribute param, the data type of result could be different
            // should return based on document 
            // for now, temperately return with invalid
        }
        else
        {
            let attribute;
            this.attributes.forEach(attrelement => {
                if(attrelement.attr_Id == cipParam.attributeID){
                    attribute = attrelement;
                }            
            });
            if(!attribute){
                log(`Identity Object, OnValidateCIPAddress, return as attribute not supported, cipParam.attributeID ${cipParam.attributeID}`, VERBOSE_LOGGING);
                return info.tag;
            }
            info.tag.dataType = attribute.attr_Datatype;
            info.tag.readOnly = attribute.attr_ReadOnly;
            info.tag.valid = true;
        }



        return info.tag;
    }
    /**
    * Get the attribute value from the property of the class
    * @param {CIPParam}    cipParam
    * @param {object}      info       - Object containing the function arguments.
    * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
    * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
    *  
    * @return {Boolean}
    **/
    GetAttributeValues(cipParam, info){

        if(cipParam.classCode!= this.classCode ||
            cipParam.instanceID != this.instanceID
        ){
            return false;
        }

        this.attributes.forEach(element => {
            if(element.attr_Id == cipParam.attributeID){
                info.tags[0].value = element.attr_Value;
                log(`Identity Object, GetAttributeValues, retrive attribute ${cipParam.attributeID}, value ${element.attr_Value}`, VERBOSE_LOGGING);
                return true;
            }            
        });
        return false;
        
    }
    /**
     * Build the service request message.
     *
     * @param {CIPParam}    cipParam 
     * @param {object}      info       - Object containing the function arguments.
     * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
     * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
     * 
     * @return {Data}
     *
     **/
    OnCIPServiceRequest(cipParam, info){
        // Get_Vender_ID, class 01, instance 01, attribute 01, service code 0E
        
        log(`Identity Object, OnCIPServiceRequest, for class ${cipParam.classCode}, instance ${cipParam.instanceID}, attribute ${cipParam.attributeID}`, STD_LOGGING_REQUEST); 
        let cipData = [];
        switch (cipParam.serviceCode)
        {
            case 0x0E:{
                cipData =[      
                    cipParam.serviceCode, 
                    0x03, 
                    0x20, cipParam.classCode, 
                    0x24, cipParam.instanceID,
                    0x30, cipParam.attributeID
                    ];
                break;
            }
            default:
                break;
        }
        

        return cipData ;
    }
    /**
     * Processing the incoming data pacakge
     * Reterive the attibutes and update the property of the class
     * 
     * @param {CIPParam}    cipParam 
     * @param {object}      info       - Object containing the function arguments.
     * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
     * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
     * @param {Data}        info.data  - The incoming data.
     *
     * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
     *
     **/
    OnCIPServiceResponse(cipParam, info){
        let data = info.data;

        info.tags.forEach(element => {
            log(`Identity Object, OnCIPServiceResponse: process the response for tag ${element.address}`, VERBOSE_LOGGING);    
            
        });
 

        let cipResponse = [];

        for (let index = 48; index <= data.length; index ++){
            cipResponse.push(data[index]);
        }
        let servicecode = cipResponse[0];
        let statuscode = cipResponse[3]<<8|cipResponse[2];

        let attribute;
        this.attributes.forEach(element => {
            if(element.attr_Id == cipParam.attributeID){
                attribute = element;
            }            
        });
        if(!attribute){
            log(`Identity Object, OnCIPServiceResponse: Failed to process the response for attribute ${cipParam.attributeID}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);    
            return { action: ACTIONFAILURE};
        }

        switch (cipParam.attributeID)
        {
            case 0x01:{
                let vendorID = cipResponse[5]<<8|cipResponse[4];
                attribute.attr_Value = vendorID;
                break;
            }
            case 0x02:{
                let DeviceType = cipResponse[5]<<8|cipResponse[4];
                attribute.attr_Value = DeviceType;
                break;
            }
            case 0x03:{
                let productCode = cipResponse[5]<<8|cipResponse[4];
                attribute.attr_Value = productCode;
                break;
            }
            case 0x04:{
                let maj = cipResponse[4];
                let min = cipResponse[5];
                attribute.attr_Value = maj.toLocaleString()+"."+min.toLocaleString();
                break;
            }
            case 0x05:{
                let Status = cipResponse[5]<<8|cipResponse[4];
                attribute.attr_Value = Status;
                break;
            }
            case 0x06:{
                let serialNumber = cipResponse[7].toString(16).toUpperCase()+cipResponse[6].toString(16).toUpperCase()+cipResponse[5].toString(16).toUpperCase()+cipResponse[4].toString(16).toUpperCase();
                attribute.attr_Value = serialNumber;
                break;
            }
            case 0x07:{
                let length = cipResponse[4];
                let productnamebuffer = [];
                for(let index = 0; index < length; index++ ){
                    productnamebuffer.push(cipResponse[5 + index]);
                } 
                //log(`Identity Object, OnCIPServiceResponse: ProductNameBuffer value ${productnamebuffer}, String value ${productnamebuffer.toLocaleString()}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, VERBOSE_LOGGING);  
                let productName = String.fromCharCode(...productnamebuffer);
                //log(`Identity Object, OnCIPServiceResponse: Success to process the response for Tag: ${info.tags[0].address}, value ${productName}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, VERBOSE_LOGGING);  
                attribute.attr_Value = productName;
                break;
            }
            default:
                break;
        }

 //6f 00 20 00 75 73 00 40 00 00 00 00 01 01 06 0e 00 00 00 00 00 00 00 00 00 00 00 00 00 00 02 00 00 00 00 00 b2 00 10 00 8a 00 00 00 01 00 04 00 8e 00 00 00 fb 7a 06 00 '.
        let cipRequestParam = GetCIPParamFromTagAddress(info.tags[0].address.toUpperCase());

        let result;

        if(cipRequestParam.classCode == this.classCode && cipRequestParam.instanceID == this.instanceID){
            
            this.attributes.forEach(element => {
                if(element.attr_Id == cipRequestParam.attributeID){
                    attribute = element;
                }            
            });
            info.tags[0].value = attribute.attr_Value;
            result = { action: ACTIONCOMPLETE,  tags: info.tags};
  
            log(`Identity Object, OnCIPServiceResponse: Success to process the response for Tag: ${info.tags[0].address}, value ${info.tags[0].value}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, VERBOSE_LOGGING);   
        }
        else{
            //Save value to attributes, but not update tags here, as the tag from info may not match with the response message.
            result = { action: ACTIONCOMPLETE};
            log(`Identity Object, OnCIPServiceResponse: Success to process the response for attribute ${cipParam.attributeID}, value ${info.tags[0].value}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);   
        }        

        return result;
    }
}
class SymbolObject extends CIPObject{
    constructor(instanceID){
        super();
        this.classCode = 0x6B;
        this.instanceID = 0;
    
        this.services = [
            {serviceCode: 0x4C, serviceName: "Read_Tag", serviceResult:0x00},
            {serviceCode: 0x52, serviceName: "Read_Tag_Fregment", serviceResult:0x00}
        ];
        
        log(`Symbol Object, constructor succeed`, VERBOSE_LOGGING);    
    }
     /**
     * Validate CIP address.
     *
     * @param {object}  info          - Object containing the function arguments.
     * @param {Tag}     info.tag      - Single tag.
     *
     * @return {OnValidateTagResult}  - Single tag with a populated '.valid' field set.
     */
    OnValidateCIPAddress(info) {
        // To do:
        // 1. validate CIP address and verify class instance attribute and service
        // 2. assign bulkId to the tag
        //constructor
        info.tag.valid = false;

        log(`Symbol Object, OnValidateCIPAddress, for tag ${info.tag.address}`, VERBOSE_LOGGING); 

        let cipParam = GetCIPParamFromTagAddress(info.tag.address.toUpperCase());
        log(`Symbol Object, OnValidateCIPAddress, GetCIPParamFromTagAddress validformat ${cipParam.validFormat}, class ${cipParam.classCode}, instance ${cipParam.instanceID}, attribute ${cipParam.attributeID}, service ${cipParam.serviceCode}`, VERBOSE_LOGGING); 
        if(cipParam.validFormat != true){
            log(`Symbol Object, OnValidateCIPAddress, return as invlid format`, VERBOSE_LOGGING); 
            return info.tag;
        }

        if(this.classCode != cipParam.classCode){
            log(`Symbol Object, OnValidateCIPAddress, return as class code not match this.classcode ${this.classCode} cipParam.classcode ${cipParam.classCode}`, VERBOSE_LOGGING);
            return info.tag;
        }

        if(this.instanceID != cipParam.instanceID){
            log(`Symbol Object, OnValidateCIPAddress, return as instance code not match this.instanceID ${this.instanceID} cipParam.instanceID ${cipParam.instanceID}`, VERBOSE_LOGGING);
            return info.tag;
        }

        let service;
        this.services.forEach(element =>{
            if(element.serviceCode == cipParam.serviceCode)
            {
                service = element;
            }
        });
        if(!service){
            log(`Symbol Object, OnValidateCIPAddress, return as service code not supported, cipParam.servicecode ${cipParam.serviceCode}`, VERBOSE_LOGGING);
            return info.tag;
        }

        info.tag.dataType = "Byte";
        info.tag.readOnly = true;
        info.tag.valid = true;




        return info.tag;
    }
    /**
    * Get the attribute value from the property of the class
    * @param {CIPParam}    cipParam
    * @param {object}      info       - Object containing the function arguments.
    * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
    * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
    * 
    * @return {Boolean} 
    **/
    GetAttributeValues(cipParam, info){
        return false;   
    }
    /**
     * Build the service request message.
     *
     * @param {CIPParam}    cipParam 
     * @param {object}      info       - Object containing the function arguments.
     * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
     * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
     * @return {Data}   - The action to take, tags to complete (if any) and/or data to send (if any).
     *
     **/
    OnCIPServiceRequest(cipParam, info){
        // Get_Vender_ID, class 01, instance 01, attribute 01, service code 0E
        
        log(`Symbol Object, OnCIPServiceRequest, for class ${cipParam.classCode}, instance ${cipParam.instanceID}, attribute ${cipParam.attributeID}`, STD_LOGGING_REQUEST); 
        let cipData = [];
        switch (cipParam.serviceCode)
        {
            case 0x4C:{
                cipData =[0x4C];  
                cipData.push(cipParam.symbolSegment.length/2);

                cipParam.symbolSegment.forEach(element => {
                    cipData.push(element);                    
                });

                cipData.push(0x01);
                cipData.push(0x00);
                break;
            }
            default:
                break;
        }
        log(`Symbol Object, OnCIPServiceRequest, cipdata ${Bytes2Str(cipData)}`, VERBOSE_LOGGING); 
        return cipData;
    }
    /**
     * Processing the incoming data pacakge
     * Reterive the attibutes and update the property of the class
     * 
     * @param {CIPParam}    cipParam 
     * @param {object}      info       - Object containing the function arguments.
     * @param {MessageType} info.type  - Communication mode for tags. Can be undefined.
     * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
     * @param {Data}        info.data  - The incoming data.
     *
     * @return {OnTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
     *
     **/
    OnCIPServiceResponse(cipParam, info){
        let data = info.data;

        info.tags.forEach(element => {
            log(`SymbolObject Object, OnCIPServiceResponse: process the response for tag ${element.address}`, VERBOSE_LOGGING);    
            
        });

        let cipResponse = [];
        for (let index = 48; index <= data.length; index ++){
            cipResponse.push(data[index]);
        }
        //log(`Symbol Object, OnCIPServiceResponse, cipResponse ${Bytes2Str(cipResponse)}`, VERBOSE_LOGGING); 

        let servicecode = cipResponse[0];
        let statuscode = cipResponse[3]<<8|cipResponse[2];

        let datatype = cipResponse[5]<<8|cipResponse[4];
        let value;
        switch (datatype)
        {
            case 0x00C6:
            case 0x00C2:
            case 0x00C1:{
                value = cipResponse[6];
                break;
            }
            case 0x00C3:{
                value = (cipResponse[7]<<8)|cipResponse[6];
                break;
            }
            case 0x00D3:
            case 0x00CA:
            case 0x00C4:{
                value = (cipResponse[9]<<24)|(cipResponse[8]<<16)|(cipResponse[7]<<8)|cipResponse[6];
                break;
            }

            default:
                break;
        }

        let cipRequestParam = GetCIPParamFromTagAddress(info.tags[0].address.toUpperCase());


        if(cipParam.symbolSegment.join() != cipRequestParam.symbolSegment.join()){
            
            log(`SymbolObject Object, OnCIPServiceResponse: failed to process the response for Tag: ${info.tags[0].address}, as cip symbol segment ${cipParam.symbolSegment}, symbol segment from address ${cipRequestParam.symbolSegment}`, STD_LOGGING_RESPONSE);    
            return { action: ACTIONCOMPLETE};
        }
        else{
            info.tags[0].dataType = "Byte"
            info.tags[0].value = value;
    
            log(`SymbolObject Object, OnCIPServiceResponse: Success to process the response for Tag: ${info.tags[0].address}, Session ID: ${Bytes2Str(EIP_Session_ID)}`, STD_LOGGING_RESPONSE);  
            return { action: ACTIONCOMPLETE,  tags: info.tags};

        }
    }
}
