# CSV Data Import with Kepware Universal Device Driver

This example provides a reference architecture for how to build a custom solution to monitor file values in CSV format and push the data in JSON format to a listener profile for UDD.

While this example uses a Python script as the file watcher and processor, the file solution could be built with any programming languge to monitor and process the CSV data.

## Requirements

- Kepware versions 6.11 or higher that support the UDD v2.0 profile
- For CSV watcher, Python 3+ is required with [watchdog](https://github.com/gorakhargosh/watchdog) package installation

## Quick Start

1. Load Kepware project file (project file already includes Javascript for Universal Device Driver)
2. Edit the Python script variables to identify FILEPATH, FILENAME and COLUMN_KEY variables.
3. Manually create tags in Kepware per incoming CSV file (see below for instructions)
4. Launch Quick Client from the Kepware Configuration tool
5. Run the Python script (recommend using Task Scheduler or create a service for managed runtime) on same host as Kepware for testing purposes
6. Create/modify/overwrite target CSV file in target directory
7. Ensure correct values are seen for tags within Quick Client  

## Python and Javascript (UDD Profile) Overview

The Python script connects to companion Kepware UDD Javascript profile on the specified IP and TCP port and watches a target directory for a CSV file of a specific name. When the CSV file created, modified or overwritten, the script parses the contents and sends a JSON formatted test to a listening UDD profile.

The script expects CSV formats like:

|Column1|Column2|Column3|
| :--:  | :--:  | :--: |
|string1|p1|50|
|string2|p2|77|

CSV text:
```
column1,column2,column3  
string1,p1,50
string2,p2,77
```

After detecting a change, the Python script sends the data grouped by fields in one selected column (e.g. column2) to the configured Kepware UDD channel in a JSON blob as below:

```json
{
    "p1": {
        "column1": "string1", 
        "column2": "p1", 
        "column3": "50"
        },
    "p2": {
        "column1": "string2", 
        "column2": "p2", 
        "column3": "77"
        }
}
```

## Tag Configuration

Tag addressing uses leverages the source CSV header names to define which column value you want to monitor in a tag.

### Addressing Syntax

The data can then be accessed in Kepware from the Universal Device Driver using the following tag address syntax:

Format: *key_column_name.column_name*

Below are examples based on the above data set:

|Tag Address|Value from Example|
| :----------:  | :----------:  |
| p1.column1 | string1 |
| p2.column3| 77 |
