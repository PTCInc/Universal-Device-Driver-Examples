# Qlight Tower (Andon) Light Socket Protocol

This profile uses a simple socket interface available on Ethernet based Qlight Tower lights. This interface allows for a user to read status of the tower lights as well as control the state of each light. For models that have sound indication, the profile can also provide status on the signal played as well as control the signal that the tower light is playing.

This profile was developed while connecting to a [QT50L-ETN](https://www.qlight.com/en/products/?qpcateid=7&prodidx=350&prodcode=QT50L-W) model tower, though it should work with no modification for other towers that use the socket protocol interface. Please see Qlight documentation for complete details..

## Requirements

- Kepware versions 6.11 or higher that support the UDD v2.0 profile

## Tag Configuration

Below are the tags specific to monitoring and controlling the status of each light and sound/buzzer signal.

*NOTE: Transactions are triggered by reading the "red" tag. To get any data, a client must read the "red" tag by default. This can be changed in the profile code if desired.*

|Tag|Data Type|Access|Description|
| :----------:  | :----------:  | :----------:  | :----------:  |
|red            |Word           |RW             |Red indicator status and command (0: Off, 1: On, 2: Blink)|
|yellow         |Word           |RW             |Yellow indicator status and command (0: Off, 1: On, 2: Blink)|
|green          |Word           |RW             |Green indicator status and command (0: Off, 1: On, 2: Blink)|
|blue           |Word           |RW             |Blue indicator status and command (0: Off, 1: On, 2: Blink)|
|white          |Word           |RW             |White indicator status and command (0: Off, 1: On, 2: Blink)|
|sound          |Word           |RW             |Sound selcted or commanded (0: Off, 1-5: sound/alarm/buzzer)|
|soundtype      |Word           |RW             |Change sound group (special models only)|
|reset          |Boolean        |RW             |Reset all indicators and sound. Write any value to tag to reset. No value other than 0 will be seen.|

### System Addressing

The following addresses can be used to manage logging level.

|Tag|Data Type| Access |Description|
| :----------:  | :----------:  | :----------:  |:----------:  |
|LoggingLevel|Word|RW|Tag to modify logging level of script for more diagnostic information; *Only use during troubleshooting as logs go to Kepware Event Log*|

## Models

The profile was developed against an QT50L-ETN but you can find various documentation on the protocol and supported models at Qlight [here](https://www.qlight.com/en/customer-support/technical-information/).
