# HTTP/RESTful Client Profile Examples

These are various examples of UDD profiles that can create simple HTTP/RESTful client profiles. Basic functionality that is included in these examples are:

- GET and POST HTTP Methods
- Chunked HTTP Transport Encoding when larger payload returns are chunked
- JSON payloads
- Access to HTTP header objects

These could be extended to add additional functionality as needed to support other methods or scenarios.

**NOTE:** Since these are not fully functional HTTP client examples, encrypted connections (HTTPS) **CANNOT** be supported.

## Requirements

- Kepware versions 6.14 or higher that support the UDD v2.0 profile
- Older versions that are not maintained can be found in the [archive](archive) folder

## Tag Configuration

Tag addressing uses a modified syntax that mimics JSON key addressing to access the data in the payload of HTTP messages.

### Addressing Syntax

Format: *key:key[array_offset]:key*

Replaces a ":" is used where "." would be in standard JSON syntax

Example JSON:

 ```json
 {
    "visibility": 1000,
    "wind": {
        "speed": 8.38,
        "direction": "north" 
        },
    "weather": [
        {
        "main": "sunny",
        "description": "partly sunny"
        }
        {
        "main": "cloudy",
        "description": "mostly cloudy"
        }
    ]
   }
```

|Tag Address|Value from Example|
| :----------:  | :----------:  |
| visibility | 1000 |
| wind | {"speed": 8.38, "direction": "north"} |
| weather[1]:main | cloudy |

```json
{
    "readResults": [
        {
            "id": "Machine.Device.Tempo1-iVariant",
            "s": true,
            "r": "",
            "v": 0,
            "t": 1651773774273
        }
    ]
}
```

|Tag Address|Value from Example|
| :----------:  | :----------:  |
| readResults | [ {"id": "Machine.Device.Tempo1-iVariant", "s": true, "r": "", "v": 0, "t": 1651773774273}] |
| readResults[0] | {"id": "Machine.Device.Tempo1-iVariant", "s": true, "r": "", "v": 0, "t": 1651773774273} |
| readResults[0]:v | 0 |
