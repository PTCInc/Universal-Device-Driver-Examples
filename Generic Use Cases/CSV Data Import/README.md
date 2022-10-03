# CSV Data Import with Kepware Universal Device Driver

## Quick Start:

1. Load Kepware project file (project file already includes Javascript for Universal Device Driver)
2. Edit the Python script for 
    - filename variable at line 46
    - filepath variable at line 94
    - group-by column at line 55
3. Manually create tags in Kepware per incoming CSV file (see below for instructions)
4. Launch Quick Client from the Kepware Configuration tool
5. Run the Python script (recommend using Task Scheduler for managed runtime)
6.  Create/modify/overwrite target CSV file in target directory
7. Ensure correct values are seen for tags within Quick Client  

## Python and Javascript (UDD Profile) Overview

The Python script connects to companion Kepware Universal Device Driver Javascript profile on the specified IP and TCP port and watches a target directory for a CSV file of a specific name. When the CSV file created, modified or overwritten, the script parses the contents and sends as plain text to a listening UDD profile.

The script expects CSV formats like:

|Column1|Column2|Column3|
| :--:  | :--:  | :--: |
|string1|p1|50|
|string2|p2|77|

Raw format:

*column1,column2,column3*  
*string1,p1,50*  
*string2,p2,77*

After detecting a change, the Python cript sends the data grouped by fields in one selected column (e.g. column2) to the configured Kepware Universal Device Driver:

*{"p1" : {column1 : "string1", column2 : "p1", column3 : "50"}, "p2" : {column1 : "string2", column2 : "p2", column3 : "77"}}*

The data can then be accessed in Kepware from the Universal Device Driver using the following tag address syntax:

|Tag Address|Value from Example|
| :----------:  | :----------:  |
| p1.column1 | string1 |
| p2.column3| 77 |

