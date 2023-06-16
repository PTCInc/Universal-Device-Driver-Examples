# HAAS - MDC - Ethernet Q and E Commands

This profile uses the Machine Data Collection (MDC) interface available on HAAS CNC machine. This interface allows for a user to read and write to the machine using different commands.

This profile was developed against a simulator with example responses provided by HAAS documentation, not against an actual MDC interface. Please be cautious using this profile and see HAAS documentation for complete details on addressing and commands.

## Requirements

- Kepware versions 6.13 or higher

## Tag Configuration

### Machine Data Collection (MDC) Addressing

#### Q Commands

|Tag Address|Data Type|Access|Description|
| :----------:  | :----------:  | :----------:  | :----------:  |
|?Q100          |String         |RO             |Machine Serial Number|
|?Q101          |String         |RO             |Control Software Version|
|?Q102          |String         |RO             |Machine Model Number|
|?Q104          |String         |RO             |Mode (LIST PROG, MDI, etc.)|
|?Q200          |String         |RO             |Tool Changes (total)|
|?Q201          |String         |RO             |Tool Number in use|
|?Q300          |String         |RO             |Power-on Time (total)|
|?Q301          |String         |RO             |Motion Time (total)|
|?Q303          |String         |RO             |Last Cycle Time|
|?Q304          |String         |RO             |Previous Cycle Time|
|?Q402          |String         |RO             |M30 Parts Counter #1 (resettable at control)|
|?Q403          |String         |RO             |M30 Parts Counter #2 (resettable at control)|
|?Q500          |String         |RO             |Three-in-one (PROGRAM, Oxxxxx, STATUS, PARTS, xxxxx)|
|?Q600 xxxx     |String         |RO             |Read a Macro or system variable|

?Q600 should be followed by the address of a macro or system variable

#### E Commands

|Tag Address|Data Type|Access|Description|
| :----------:  | :----------:  | :----------:  | :----------:  |
|?Exxxx         |String         |WO             |Write to Macro or system variable|

E type tags should contain the address of a macro or system variable. These tags are write only and this example profile provides "WRITE ONLY" as value when read.
**Note**: When you write to a global variable, make sure that no other programs on the machine use that variable.
**Caution**: Use extreme caution when you write to a system variable. Incorrect values for a system variable can cause damage to the machine.

### System Addressing

The following addresses can be used to manage logging level.

|Tag|Data Type| Access |Description|
| :----------:  | :----------:  | :----------:  |:----------:  |
|LoggingLevel|Word|RW|Tag to modify logging level of script for more diagnostic information; *Only use during troubleshooting as logs go to Kepware Event Log*|

## Models

The profile was developed against Machine Data Collection (MDC) - Ethernet Q Commands documentation [here](https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/machine-data-collection---ngc.html).
