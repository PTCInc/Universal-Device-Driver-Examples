# Mettler Toledo - Standard Interface Command Set (SICS)

This profile uses the Standard Interface Command Set (SICS) interface available on select Mettler Toledo scale indicators. This interface allows for a user to read and write to the scale for various configuration and data values.

This profile was developed while connecting to an IND780 model indicator, though it should work with little to no modification for other indicators that use the Standard Interface Command Set interface. Please see Mettler Toledo documentation for complete details on addressing and commands.

## Requirements

- Kepware versions 6.14 or higher that support the UDD v2.0 profile
- Older versions that are not maintained can be found in the [archive](archive) folder

## Tag Configuration

Tags can be created either using a predefined data address to determine the appropriate SICS command defined by the interface.

### SICS Addressing

#### SICS Level 0 Commands

|Tag|Data Type|Access|Description|
| :----------:  | :----------:  | :----------:  | :----------:  |
|I1             |String         |RO             |Inquiry of MT-SICS level and MT-SICS versions. Returns a string of all values|
|I1:Levels      |String         |RO             |Inquiry of MT-SICS levels supported by the device|
|I1:L0_Version  |String         |RO             |Inquiry of MT-SICS L0 version supported by the device|
|I1:L1_Version  |String         |RO             |Inquiry of MT-SICS L1 version supported by the device|
|I1:L2_Version  |String         |RO             |Inquiry of MT-SICS L2 version supported by the device|
|I1:L3_Version  |String         |RO             |Inquiry of MT-SICS L3 version supported by the device|
|I2             |String         |RO             |Inquiry of balance data|
|I3             |String         |RO             |Inquiry of balance SW version and type definition number. Returns a string of all values|
|I3:SW_version  |String         |RO             |Inquiry of balance SW version|
|I3:TypeDefNumber |String       |RO             |Inquiry of balance type definition number.|
|I4             |String         |RO             |Inquiry of serial number|
|I5             |String         |RO             |Inquiry of SW-Identification number|
|S              |Float          |RO             |Send stable weight value|
|S:Unit         |String         |RO             |Send stable weight value unit used by device|
|SI             |Float          |RO             |Send weight value immediately|
|SI:Unit        |Float          |RO             |Send weight value immediately unit used by device|
|Z              |Boolean        |WO             |Zero the balance|
|ZI             |Boolean        |WO             |Zero the balance immediately regardless the stability of the balance|
|@              |Boolean        |WO             |Resets the balance to the condition found after switching on, but without a zero setting being performed|

#### SICS Level 1 Commands

|Tag|Data Type|Access|Description|
| :----------:  | :----------:  | :----------:  | :----------:  |
|DW             |Boolean        |WO             |Switch main display to weight mode|
|T              |Boolean        |WO             |Tare, i.e. store the next stable weight value as a new tare weight value|
|TA             |Float          |RW             |Inquiry of the tare weight value or set preset value|
|TA:Unit        |String         |RO             |Inquiry of the tare weight unit used by device|
|TAC            |Boolean        |WO             |Clear tare value|
|TI             |Boolean        |WO             |Tare immediately, i.e. store the current weight value, which can be stable or non stable (dynamic), as tare weight value|

### System Addressing

The following addresses can be used to manage logging level.

|Tag|Data Type| Access |Description|
| :----------:  | :----------:  | :----------:  |:----------:  |
|LoggingLevel|Word|RW|Tag to modify logging level of script for more diagnostic information; *Only use during troubleshooting as logs go to Kepware Event Log*|

## Models

The profile was developed against an IND780 but you can find various documentation on SICS and supported models at Mettler Toledo [here](https://www.mt.com/us/en/home/search/library.tabs.custom3.html#-191757885(page=1&keyword=SICS)).
