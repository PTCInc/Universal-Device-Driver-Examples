/************************************************************************************************************************
 * 
 * All rights reserved.
 * 
 * FileReader-DirectoryWatch-profile.js
 * Version 1.1
 * 
 * This profile will watch for changes (modify or add) in the directory that  * is specified as the Base Path in 
 * Device Properties. Optionally, specific files or file types can be listed in User-Defined Settings. Tag values 
 * will be assigned according to the addresses below. This profile will work with various ASCII file types and 
 * can be used with CSV.
 * 
 * Caveats:
 * - Input file is limited to 200KB. 
 * 
 * Address examples (without quotes):
 * 'file' - contents of entire file
 * 'count' - number of lines in the file
 * 'line#' - contents of the specified line. Example: line1
 * 'line#field#' - value of the specified field in the specified line. Line must be comma separated. Example: line3field4
 * 'lastline' - contents of the last non-empty line
 * 'lastfield#' - value of the specified field in the last non-empty line. Example: lastfield4
 * 
 * User-Defined Settings > Input String example (comman seperated, without quotes):
 * '*.csv,*.ini,readme.txt' - this will allow any csv or any ini file and a file named readme.txt
 * '' or '*' - will allow any file
 * 
 * TODO:
 * Add option for file deleting when file is created (maybe ignore modified) 
 * 
 * Change Log:
 * - v1.0 Initial release
 * - v1.1 Changed to optionally not initialize tag values when no data is present, but instead set quality to Bad. Behavior
 *      is controlled by USEQUALITY constant at top of file. 
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
    WaitingForFile: 1,
    FileOpened: 2,
    FileRead: 3,
    FileClosed: 4
}
/** Global Constants */
const USEQUALITY = false; // If true, tags with no data will show QUALITYBAD instead of initializing value to 0 or NULL

/** Global Variables */
var state = States.Initialize;
var currentFile = "";
var storage = {}; // Because built-in cache is not large enough 

var validFiles 

/**
 * Retrieve driver metadata.
 * 
 * @return {OnProfileLoadResult}  - Driver metadata.
 */
function onProfileLoad() {
   
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
            //info.tag.dataType = data_types.STRING;
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
* Retrieve the new profile inputs from Device Properties -> User-Defined Settings -> Profile Inputs.
*
* @param {object}    info                 - Object containing the value of the profile inputs
* @param {string}    info.stringInput     - Current value of input string property
*
* @return {OnProfileInputsChangeResult}   - Whether the input was validated '.valid'.
*/
function onProfileInputsChange(info) {
    log(`onProfileInputsChange called with parameter '${info.stringInput}`, VERBOSE_LOGGING);
    var input_string = info.stringInput;

    try {
        validFiles = input_string.split(",");
        
        log("onProfileInputsChange successfully parsed Input String", VERBOSE_LOGGING);
        return { valid: true };
    }
    catch {
        log("onProfileInputsChange failed to parse Input String", VERBOSE_LOGGING);
        return { valid: false };
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

    log(`onFileTagsRequest called with ${info.tags.length} tags of type ${info.tags[0].bulkId} in state ${state}.`, VERBOSE_LOGGING);

    //Logging tag  
    if (info.tags[0].bulkId === LOGGING_LEVEL_TAG.bulkId) {
        let value = undefined;
        if (info.type === WRITE){
            writeToCache(LOGGING_LEVEL_TAG.address, info.tags[0].value)
            return { action: ACTIONCOMPLETE };
        }
        else {
            value = readFromCache(LOGGING_LEVEL_TAG.address).value
            info.tags[0].value = value;
            return { action: ACTIONCOMPLETE, tags: info.tags };
        }     
    }  

    // CSV Data Tags
    if (info.tags[0].bulkId=== TAGTYPECSVDATA) {
        if (state == States.Initialize) {            
            state = States.WaitingForFile;
            return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.ASYNCWATCHDIR] };        
        
        } else {
            for (let i = 0; i < info.tags.length; i++) {
                const tag = info.tags[i];
                const result = storage[tag.address];
                if (result !== undefined) {
                    tag.value = result;
                    tag.quality = QUALITYGOOD;
                    //log(`Setting '${tag.address}' = '${tag.value}' from storage.`, VERBOSE_LOGGING);
                } else {
                    //log(`No data in storage for '${tag.address}', setting QUALITYBAD.`, VERBOSE_LOGGING);
                    if (USEQUALITY){
                        tag.quality = QUALITYBAD; //rely on quality 
                    } else {
                        if (tag.dataType === data_types.STRING){ //or initalize the value with 0 or NULL
                            tag.value = "";
                        } else {
                            tag.value = 0;
                        }
                        tag.quality = QUALITYGOOD;
                    }
                    
                }
            }
            return { action: ACTIONCOMPLETE, tags: info.tags }
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

    log(`onFileOperations called in state ${state}.`, VERBOSE_LOGGING);
    currentFile = info.lastFileOrPath;

    if (info.lastOperation == FILEOPERATIONS.ASYNCWATCHDIR) {
        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            state = States.Initialize;
            log(`Failed to watch Base Path directory: ${info.lastOperationResult}`); // currentFile cannot in message be used as it is empty
            return { action: ACTIONFAILURE };
        }

		log(`Operation '${info.lastOperation}' on Base Path directory succeeded.`, VERBOSE_LOGGING); // currentFile cannot be used in message as it is empty
		return { action: ACTIONCOMPLETE };	       
    }

    if (info.lastOperation === FILEOPERATIONS.OPENFILE) {
        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            state = States.Initialize;
            log(`Failed to open '${currentFile}': ${info.lastOperationResult}`);            
            return { action: ACTIONCOMPLETE };	// Or should this clear cache? 
        }

        state = States.FileRead;
        log(`Operation '${info.lastOperation}' on '${currentFile}' succeeded.`, VERBOSE_LOGGING);
        return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.READFILE], fileOrPath: currentFile }
    }

    if (info.lastOperation === FILEOPERATIONS.READFILE) {
        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            state = States.Initialize;
            log(`Failed to read '${currentFile}': ${info.lastOperationResult}`);
            return { action: ACTIONCOMPLETE };
        }

        if (!info.data || info.data.length === 0) {
            log(`No data received in '${currentFile}'`);
            return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.CLOSEFILE], fileOrPath: currentFile };
        }

        log(`Operation '${info.lastOperation}' on '${currentFile}' succeeded.`, VERBOSE_LOGGING);
        log(`Read ${info.data.length} bytes from '${currentFile}'`, VERBOSE_LOGGING);
        
        const dataAsText = byteArrayToString(info.data);
        const lines = dataAsText.split(/\r?\n/); // split on any combination of CR, LF or CRLF
        
        // Clear values in cache to prep for a CSV with less lines
        if (USEQUALITY){
            for (var each in storage) delete storage[each] //This will show bad quality with previous values in the extra tags since the client cannot access the addresses.
        } else {
            for (var each in storage){ // This will set the values to 0 or NULL
                if (each.datatype === data_types.STRING){
                    storage[each] = "";
                } else {
                    storage[each] = 0;
                }
            } 
        }
        
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

        state = States.FileClosed;
        return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.CLOSEFILE], fileOrPath: currentFile };
    }

    if (info.lastOperation === FILEOPERATIONS.CLOSEFILE) {
        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            state = States.Initialize;
            log(`Failed to close '${currentFile}': ${info.lastOperationResult}`);
            return { action: ACTIONCOMPLETE };
        }

        log(`Operation '${info.lastOperation}' on '${currentFile}' succeeded.`, VERBOSE_LOGGING);

        state = States.WaitingForFile;
        return { action: ACTIONCOMPLETE };
    }

    if (info.lastOperation === FILEOPERATIONS.DELETEFILE) {

        if (info.lastOperationResult !== OPERATIONSUCCESSFUL) {
            state = States.Initialize;
            log(`Failed to delete '${currentFile}': ${info.lastOperationResult}`);
            return { action: ACTIONCOMPLETE };
        }

        log(`Operation '${info.lastOperation}' on '${currentFile}' succeeded.`, VERBOSE_LOGGING);

        return { action: ACTIONCOMPLETE };
    }

    log(`Error: Unexpected state in onFileOperations '${state}'`, VERBOSE_LOGGING);
    state = States.Initialize;
    return { action: ACTIONFAILURE };
}

/**
 * onFileChange: Asynchronously handle a change to a file or directory.
 *
 * @param {object}              info                     - Object containing the function arguments.
 * @param {MessageType}         info.type                - Communication mode for tags. Can be undefined.
 * @param {Tag[]}               info.tags                - Tags currently being processed. Can be undefined.
 * @param {FileChange}          info.change              - Reason file or path changed
 * @param {string}              info.fileOrPath          - File or path that changed
 *
 * @return {OnFileTransactionResult}   - The action to take, tags to complete (if any) and/or data to send (if any).
 */

function onFileChange(info) {
	// Handle asynchronous change to info.fileOrPath
	log(`onFileChange called on file '${info.fileOrPath}' as '${info.change}'.`, VERBOSE_LOGGING);
	
	if (state == States.WaitingForFile && (info.change == "Modified" || info.change == "Created")) {
        if (isValidFile(info.fileOrPath,validFiles)){
            state = States.FileOpened
		    log(`Opening '${info.fileOrPath}' from onFileChange.`, VERBOSE_LOGGING);
		    return { action: ACTIONOPERATE, operations: [FILEOPERATIONS.OPENFILE], fileOrPath: info.fileOrPath, data: [OPENMODEREAD, OPENTYPEBINARY, OPENACCESSDENYNONE, OPENCREATEMODECREATENOTRUNCATE] };
        } else {
            // Ignoring invalid files
		    log(`Ignoring invalid file from onFileChange.`, VERBOSE_LOGGING);
		    return { action: ACTIONCOMPLETE }

        }
    } else {
		// Ignoring all other file or path changes
		log(`Ignoring file or path change from onFileChange.`, VERBOSE_LOGGING);
		return { action: ACTIONCOMPLETE }
	}
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

function isValidFile(filename, validPatterns) {
    // If no patterns are provided, allow all files
    if (!Array.isArray(validPatterns) || validPatterns.length === 0) {
        return true;
    }
    const regexes = validPatterns.map(pattern => {
      // Escape all regex special characters, except * and ?
      const escaped = pattern.replace(/([.+^${}()|[\]\\])/g, '\\$1');
  
      // Replace wildcard characters with regex equivalents and add "^" at the beginning and "$" at the end to ensure the pattern matches the entire filename
      const regexPattern = '^' +
        escaped
          .replace(/\*/g, '.*')   // * → any sequence
          .replace(/\?/g, '.')    // ? → single character
        + '$';
  
      // Build RegExp object with case-insensitive flag
      return new RegExp(regexPattern, 'i');
    });
  
    return regexes.some(regex => regex.test(filename));
}
