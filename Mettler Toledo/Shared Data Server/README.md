# Mettler Toledo - Shared Data Server Profile

This profile uses the Shared Data Server (SDS) interface available on select Mettler Toledo scale terminals or indicators. This interface allows for a user to read, subscribe and write to the scale terminal for various configuration and data values.

This profile was developed while connecting to an IND780 model indicator, though it should work with little to no modification for other indicators that use the Shared Data Server interface. Please see Mettler Toledo documentation for complete details on addressing and commands.

## Requirements

- Kepware versions 6.11 or higher that support the UDD v2.0 profile

## Profile Notes

- SDS Message termination characters may vary by model and implementation from Mettler Toledo. Use the `SDS_TERMINATOR_SEND` and `SDS_TERMINATOR_RECEIVE` variables to modify message terminators as needed.

## Tag Configuration

Tags can be created either using a predefined data address, system address or an SDS address defined by the interface.

### SDS Addressing

- Format: *sdsaddress.function*
  - sdsaddress – address for object in SDS documentation
    - Example: wt0106 – Aux Weight Units for scale 1
      - wt - Class
      - 01 - Instance or Scale #
      - 06 - Attribute
  - function – method to read object
    - read – solicited read requests for object value
    - callback – subscription for object value

- Examples:
  - wt0106.read – solicited reads for value
  - wt0106.callback – subscription setup and listen for values published

### Predefined Data Addressing

- Format: *predefaddress##.function*
  - predefaddress – predefined address as defined in table below
  - \## - Instance or Scale #
  - function – method to read object
    - read – solicited read requests for object value
    - callback – subscription for object value

- Examples:
  - GrossWeight01.read – solicited reads for value
  - GrossWeight01.callback – subscription setup and listen for values published

The following addresses can be used to monitor predefined values.

|Tag|Data Type| Description|
| :----------:  | :----------:  | :----------:  |
|GrossWeight|Float|Gross weight for first scale only; Equivilent to wt##01 SDS address|
|NetWeight|Float|Net weight for first scale only; Equivilent to wt##02 SDS address|
|TareWeight|Float|Tare weight for first scale only; Equivilent to ws##10 SDS address|
|Units|String|Units for weight values of first scale only; Equivilent to wt##03 SDS address|
|ScaleID|String|Text Identifier name for first scale only; Equivilent to cs##03 SDS address|
|ScaleMode|String|Scale mode (Gross or Net) configured for first scale only; Equivilent to ws##01 SDS address|

### System Addressing

The following addresses can be used to manage login and other various data.

|Tag|Data Type| Access |Description|
| :----------:  | :----------:  | :----------:  |:----------:  |
|Username|String|RW|Username used to login to the interface during the "user" command|
|Password|String|RW|Username used to login to the interface during the "user" command|
|Relogin|Boolean|W|When a value is written to this tag, the "user" command will be resent to reauthenticate the connection |
|TransactionID|Word|RO|Monitor Transaction ID value in messaging|
|LoggingLevel|Word|RW|Tag to modify logging level of script for more diagnostic information; *Only use during troubleshooting as logs go to Kepware Event Log*|

## Models

The profile was developed against an IND780 but below is a list of other terminal models that support SDS according to Mettler Toledo documentation.

|   Model  |    Product Page    |   SDS Manual  |
| :----------:  | :----------:  | :----------:  |
|IND780|[Link](https://www.mt.com/us/en/home/products/Industrial_Weighing_Solutions/Terminals-and-Controllers/terminals-bench-floor-scales/advanced-bench-floor-applications/IND780/IND780.html)|[Link](https://www.mt.com/dam/product_organizations/industry/IndustrialTerminals/64059110_12_MAN_SDREF_IND780_EN.pdf)|
|IND560|[Link](https://www.mt.com/us/en/home/products/Industrial_Weighing_Solutions/Terminals-and-Controllers/terminals-bench-floor-scales/advanced-bench-floor-applications/IND560.html)|[Link](https://bradysystems.com/wp-content/uploads/2012/10/IND560-User-Manual.pdf)|
|IND570|[Link](https://www.mt.com/us/en/home/products/Industrial_Weighing_Solutions/Terminals-and-Controllers/terminals-bench-floor-scales/advanced-bench-floor-applications/IND570/IND570.html)|[Link](https://www.mt.com/dam/product_organizations/industry/IndustrialTerminals/30205337_05_MAN_SDREF_IND570_EN.pdf)|
|IND256|[Link](https://www.mt.com/us/en/home/products/Industrial_Weighing_Solutions/Hazardous_Area_Weighing/haz-area-weighing-terminals/IND256x/weigh-term-IND256x.html)|[Link](https://www.mt.com/dam/product_organizations/industry/IndustrialTerminals/ind256x-documents/30517677_02_MAN_SDREF_IND256x_EN.pdf)|
