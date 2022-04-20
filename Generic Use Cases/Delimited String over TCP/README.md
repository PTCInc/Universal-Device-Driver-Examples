# Delimited Strings over TCP

This profile provides a template to read data from a simple character delimited ASCII data stream. It can be configured to send solicted requests to receive the data stream or listen for the data after a TCP socket is established.

Example TCP stream:

2021-01-29T11:30:440Z|Source|TRAN_1|pH|2.1|EC|3.2|CONC|4.4|FluidTemp|5.5|DO|6.7

For solicited usage, the request message payloads need to be modified to support the needed request messages.

## Requirements

- Kepware versions 6.11 or higher that support the UDD v2.0 profile

## Tag Configuration

Tag addressing uses a simple any word character Regex ```/^\w+$/``` to conduct tag validation. From the TCP stream example, the first object is a timestamp that can be accessed from the 'date' tag address. The rest of the data is key pairs with the first object being the tag address name and the value immediately followed is the value.

### Addressing Syntax

Format: *any string value*

Values based on example stream above:

|Tag Address|Value from Example|
| :----------:  | :----------:  |
| date | 2021-01-29T11:30:440Z |
| Source | TRAN_1 |
| pH | 2.1 |
| CONC | 4.4 |
