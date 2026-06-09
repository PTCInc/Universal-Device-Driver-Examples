/************************************************************************************************************************
 * 
 * All rights reserved.
 * 
 * FileReader-FilePoll-profile.js
 * Version 1.0
 * 
 * This profile will "poll" the file that is specified in Device Properties at the rate specified by the client 
 * application. Tag values will be assigned according to the addresses below. This profile will work with various 
 * ASCII file types and can be used with CSV.
 * 
 * Caveats:
 * - Input file is limited to 200KB.  See https://thingworx.jira.com/browse/KEPA-85686
 * 
 * Address examples (without quotes):
 * 'file' - contents of entire file
 * 'count' - number of lines in the file
 * 'line#' - contents of the specified line. Example: line1
 * 'line#field#' - value of the specified field in the specified line. Line must be comma separated. Example: line3field4
 * 'lastline' - contents of the last non-empty line
 * 'lastfield#' - value of the specified field in the last non-empty line. Example: lastfield4
 * 
 * Change Log:
 * - v1.0 Initial release
 * 
************************************************************************************************************************/
/**
 * @typedef {string} MessageType - Type of tag(s) "Read", "Write".
 */

/**
 * @typedef {string} DataType - KEPServerEx datatype "Default", "String", "Boolean", "Char", "Byte", "Short", "Word", "Long", "DWord", "Float", "Double", "BCD", "LBCD", "Date", "LLong", "QWord".
 */

/**
 * @typedef {number[]} Data - Array of data bytes. Uint8 byte array.
 */
 
/**
 * @typedef {string} FileOperation - "OpenFile",
                                     "CloseFile",
                                     "ReadFile",
                                     "WriteFile",
                                     "ReadLine",
                                     "WriteLine",
                                     "AsyncWatchDir",
                                     "AsyncUnWatchDir",
                                     "CreateFile",
                                     "DeleteFile"
 *
 * See File Operation Descriptions below for further detail
 */
 
/**
 * @typedef {string} FileOperationResult - "Success" if successful and error string if operation failed :
                                           "Access denied",
                                           "Bad path",
                                           "Bad seek",
                                           "Directory does not exist",
                                           "Directory full",
                                           "Directory path has syntax error",
                                           "Directory path must be relative to Base Path",
                                           "Directory path traversal not allowed",
                                           "Disk full",
                                           "End of file",
                                           "File already closed",
                                           "File already open",
                                           "File is not open",
                                           "File not found",
                                           "File to be created already exists",
                                           "File too large",
                                           "Generic file exception",
                                           "Hard IO",
                                           "Internal error",
                                           "Invalid file",
                                           "Invalid open flags provided",
                                           "Invalid position value provided",
                                           "Lock violation",
                                           "No active watch on specified directory",
                                           "No file specified in path",
                                           "Operation not supported for file opened in binary mode",
                                           "Operation not supported for file opened in text mode",
                                           "Path cannot end in a '.'",
                                           "ReadLine only supports 1 data byte",
                                           "Remove current directory",
                                           "Sharing violation",
                                           "Too many open files",
                                           "Write data too large",
                                           "WriteFile requires at least 1 data byte",
                                           "WriteLine requires at least 2 data bytes",
 */
 
 /**
 * @typedef {string} FileChange - "Created", "Deleted", "RenamedFrom", "RenamedTo", "Modified"
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
 * @property {string}   mode        - Operation mode of the driver "Client", "Server", "File".
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

 /**
 * @typedef {object} OnFileTransactionResult
 * @property {string}          action      - (required) Action of the operation: "Complete", "Operate", "Fail".
 * @property {CompleteTag[]}   tags        - (optional) Array of tags to complete if action "Complete" or "Fail". Undefined indicates tag is not complete.
 * @property {FileOperation[]} operations  - (optional) File operation to perform if action "Operate". Undefined indicates no operation to perform.
 * @property {string}          fileOrPath  - (optional) Relative path of file or directory to operate on. Undefined indicates a file or path is not applicable.
 * @property {Data}            data        - (optional) Data/arguments for the specified operation. For example, open flags for OpenFile, write data for WriteFile, etc. Undefined indicates no argument.
 */
 

/** Global constants */
const PROFILEVERSION = "2.0";
const PROFILEMODE = "File";
const MAXCACHESIZE = 65536; // 64kB

// Tag Qualities
const QUALITYBAD = "Bad";
const QUALITYGOOD = "Good"

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
    QWORD: "QWord",
  };

// File Actions
const ACTIONCOMPLETE = "Complete";
const ACTIONFAILURE = "Fail";
const ACTIONOPERATE = "Operate";

const READ = "Read"
const WRITE = "Write"

// File Operations
const FILEOPERATIONS = {
    OPENFILE: "OpenFile",
    CLOSEFILE: "CloseFile",
    READFILE: "ReadFile",
    WRITEFILE: "WriteFile",
    READLINE: "ReadLine",
    WRITELINE: "WriteLine",
    ASYNCWATCHDIR: "AsyncWatchDir",
    ASYNCUNWATCHDIR: "AsyncUnWatchDir",
    CREATEFILE: "CreateFile",
    DELETEFILE: "DeleteFile"
}

// Last Operation Results
const OPERATIONSUCCESSFUL = "Success";

// OpenFile Enumerations
// data[0] - Mode Byte
const OPENMODEREAD = 0;
const OPENMODEWRITE = 1;
const OPENMODEREADWRITE = 2;

// data[1] - Type Byte
const OPENTYPEBINARY = 0;
const OPENTYPETEXT = 1;

// data[2] - Access Byte
const OPENACCESSEXCLUSIVE = 0;
const OPENACCESSDENYWRITE = 1;
const OPENACCESSDENYREAD = 2;
const OPENACCESSDENYNONE = 3;

// data[3] - Create Mode Byte
const OPENCREATEMODEOPENEXISTING = 0;
const OPENCREATEMODECREATETRUNCATE = 1;
const OPENCREATEMODECREATENOTRUNCATE = 2;

// WriteLine Enumerations
// data[0] - File Position Byte
const WRITELINECURRENTPOSITION = 0; //Not supported
const WRITELINESEEKTOBEGIN = 1; //Not supported
const WRITELINESEEKTOEND = 2;

// Valid bulk ID's for tags
const TAGTYPECSVDATA = 1;
const TAGTYPESYSTEM = 9999;

/**
 * Logging Level System tag - control logging level from client application
 * This can be used to avoid logging verbose UDD log messages unless
 * needed for debugging
 */

const LOGGING_LEVEL_TAG = {
    address: "LoggingLevel",
    dataType: data_types.WORD,
    bulkId: TAGTYPESYSTEM,
    readOnly: false,
};

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

// State Machine States
const States = {
    Initialize: 0,
};

/** Global Variables */
let state = States.Initialize;
let currentFile = "";
let storage = {}; // Because built-in cache is not large enough 

/**
 * Retrieve driver metadata.
 * 
 * @return {OnProfileLoadResult}  - Driver metadata.
 */
function onProfileLoad() {
    // log(`onProfileLoad called`);
    
    initializeCache(MAXCACHESIZE); 

    // Initialize LoggingLevel control
    writeToCache(LOGGING_LEVEL_TAG.address, LOGGING_LEVEL);

    return { version: PROFILEVERSION, mode: PROFILEMODE };
}

/**
 * Validate a tag's address and populate relevant fields.
 *
 * @param {object} info - Object containing the function arguments.
 * @param {Tag} info.tag - The tag to validate.
 * @returns {OnValidateTagResult} - Tag object with the `.valid` field populated.
 */
function onValidateTag(info) {
    const address = info.tag.address;
    log(`onValidateTag called for address '${address}'`, VERBOSE_LOGGING);

    // Check if it's the special LoggingLevel tag
    if (address === LOGGING_LEVEL_TAG.address) {
        info.tag.dataType = LOGGING_LEVEL_TAG.dataType
        info.tag.bulkId = LOGGING_LEVEL_TAG.bulkId
        info.tag.valid = true;

        log(`onValidateTag - address "${address}" is valid.`, DEBUG_LOGGING);
        return info.tag;
    }

    try {
        // Matches specific address patterns:
        // - "file" or "linecount" or "lastline"
        // - "line" followed by digits (e.g., "row1"), optionally followed by "field" and more digits (e.g., "row2col3")
        // - "lastfield" followed by digits (e.g., "last10")
        // Entire string must match exactly (no partial matches)
        const regex = /^(file|linecount|lastline|line\d+(field\d+)?|lastfield\d+)$/;

        if (regex.test(address.toLowerCase())) {

            info.tag.bulkId = TAGTYPECSVDATA;
            info.tag.dataType = data_types.STRING;
            info.tag.readOnly = true;
            info.tag.address = address.toLowerCase()
            info.tag.valid = true;

            log(`onValidateTag - address "${address}" is valid.`, DEBUG_LOGGING);    
            return info.tag;
        }
        // Address did not match
        info.tag.valid = false;
        return info.tag;

    } catch (e) {
        log(`UDD onValidateTag Unexpected error: ${e.message}`);
        info.tag.valid = false;
        return info.tag;
    }
}

/**
 * onFileTagsRequest: Handle file mode tag.
 *
 * @param {object}      info       - Object containing the function arguments.
 * @param {MessageType} info.type  - Read or write request. Can be undefined.
 * @param {Tag[]}       info.tags  - Tags currently being processed. Can be undefined.
 *
 * @return {OnFileTransactionResult}   - The action to take, tags to complete (if any) and/or data to process (if any).
 */
function onFileTagsRequest(info) {
    log(`onFileTagsRequest called with ${info.tags.length} tags in state ${state}.`, VERBOSE_LOGGING);

    const tag = info.tags[0];
    //Logging tag  
    if (info.tags[0].bulkId === LOGGING_LEVEL_TAG.bulkId) {
        let value = undefined;
        if (info.type === READ){
            value = readFromCache(LOGGING_LEVEL_TAG.address).value
            info.tags[0].value = value;
            return { action: ACTIONCOMPLETE, tags: info.tags };            
        } else {
            writeToCache(LOGGING_LEVEL_TAG.address, info.tags[0].value)
            return { action: ACTIONCOMPLETE };            
        }     
    } 

    // CSV Data Tags
    if (tag.bulkId === TAGTYPECSVDATA) {
        if (info.type === READ) {
            if (state === States.Initialize) {
                return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.OPENFILE], data: [OPENMODEREAD, OPENTYPEBINARY, OPENACCESSDENYNONE, OPENCREATEMODECREATENOTRUNCATE] };                
            }
        } else {
            //Ignore writes
            return { action: ACTIONCOMPLETE };
        }
    }

    log(`Error: Unexpected tag type in onFileTagsRequest '${info.tags[0].bulkId}'`);
    state = States.Initialize;
    return { action: ACTIONFAILURE };
}

/**
 * onFileOperations: Handle single file operation result.
 *
 * @param {object}              info                       - Object containing the function arguments.
 * @param {MessageType}         info.type                  - Read or write request. Can be undefined.
 * @param {Tag[]}               info.tags                  - Tags currently being processed. Can be undefined.
 * @param {FileOperation}       info.lastOperation         - Last file operation performed
 * @param {FileOperationResult} info.lastOperationResult   - Last file operation result
 * @param {string}              info.lastFileOrPath        - Relative path of last file or directory operated on
 *
 * @return {OnFileTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
 */
function onFileOperations(info) {
    const tag = info.tags[0];
    const bulkId = tag.bulkId;

    log(`onFileOperations called with ${info.tags.length} tags in state ${state}.`, VERBOSE_LOGGING);
    log(`Last operation: ${info.lastOperation} | Result: ${info.lastOperationResult}`, VERBOSE_LOGGING);

    currentFile = info.lastFileOrPath;

    if (info.lastOperation === FILEOPERATIONS.OPENFILE) {
        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            log(`Failed to open '${currentFile}': ${info.lastOperationResult}`);
            return { action: ACTIONCOMPLETE };	// Or should this clear cache? 
        }

        if (info.type === READ) {
            log(`Opened '${currentFile}' successfully for READFILE (entire file).`, VERBOSE_LOGGING);
            return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.READFILE], fileOrPath: currentFile };
        }
    }

    if (info.lastOperation === FILEOPERATIONS.READFILE) {
        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            log(`Read from '${currentFile}' failed: ${info.lastOperationResult}`);
            return { action: ACTIONCOMPLETE };
        }

        if (!info.data || info.data.length === 0) {
            log("No data received in READFILE operation.", VERBOSE_LOGGING);
            return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.CLOSEFILE] };
        }

        log(`Read ${info.data.length} bytes from '${currentFile}'.`, VERBOSE_LOGGING);

        if (bulkId === TAGTYPECSVDATA) {
            const dataAsText = byteArrayToString(info.data);
            const lines = dataAsText.split(/\r?\n/); // split on any combination of CR, LF or CRLF

            // Clear values in cache to prep for a CSV with less lines
            //for (var each in storage) storage[each] = "";
            for (var each in storage) storage[each] = 0;
            // Or delete values in cache to prep for a CSV with less lines.  This will show bad quality with previous values in the extra tags since the client cannot access the addresses.
			//for (var each in storage) delete storage[each];

            // Set value for "file" tag 
            storage["file"]= dataAsText; 
            // Set value for "linecount" tag  
            storage["linecount"] = lines.length;
        
            for (let i = 0; i < lines.length; i++) {
                const lineNumber = i + 1;
                const sanitizedLine = lines[i].replace(/[^\x20-\x7E\n\r\t]/g, '');  // Remove non-printable characters from the line
        
                // Set values for "line" tags  
                storage[`line${lineNumber}`] = sanitizedLine;

                const columns = sanitizedLine.split(',');
                for (let j = 0; j < columns.length; j++) {
                    const colNumber = j + 1;
                    // Set values for "line/field" tags  
                    storage[`line${lineNumber}field${colNumber}`] = columns[j];
                }
            }
            const nonEmptyLines = lines.filter(str => !/^[\s\r\n]*$/.test(str)); // Remove all empty/whitespace lines
            const lastLine = nonEmptyLines[nonEmptyLines.length - 1] || "";
            const lastValues = lastLine.split(',');
            
            // Set value for "lastline" tag (last line)
            storage[`lastline`] = lastLine;   

            for (let i = 0; i < lastValues.length; i++) {
                // Set values for "lastfield" tags  
                storage[`lastfield${i + 1}`] = lastValues[i];                
            }      
        }

        return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.CLOSEFILE] };
    }

    if (info.lastOperation === FILEOPERATIONS.CLOSEFILE) {
        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            log(`Close file failed for '${currentFile}': ${info.lastOperationResult}`, VERBOSE_LOGGING);
            return { action: ACTIONCOMPLETE, tags: info.tags };
        }

        log(`Closed '${currentFile}' successfully.`, VERBOSE_LOGGING);

        if (bulkId === TAGTYPECSVDATA) {
            for (let i = 0; i < info.tags.length; i++) {
                const tag = info.tags[i];
                const result = storage[tag.address];
                if (result !== undefined) {
                    tag.value = result;
                    tag.quality = QUALITYGOOD;
                    //log(`Setting '${tag.address}' = '${tag.value}' from storage.`, VERBOSE_LOGGING);
                } else {
                    tag.quality = QUALITYBAD;
                    //log(`No data in storage for '${tag.address}', setting QUALITYBAD.`, VERBOSE_LOGGING);
                }
            }
        }

        return { action: ACTIONCOMPLETE, tags: info.tags };
    }

    log(`Error: Unexpected state in onFileOperations '${state}'`, VERBOSE_LOGGING);
    state = States.Initialize;
    return { action: ACTIONFAILURE };
}

/**
 * Helper function to translate bytes to string.
 *
 * Note: This function does not handle UTF-8 encoded multibyte characters!
 */
function byteArrayToString(data) {
    return String.fromCharCode.apply(null, data);
}

/**
 * Helper function to translate string to bytes.
 *
 * Note: This function does not handle Unicode characters.
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
