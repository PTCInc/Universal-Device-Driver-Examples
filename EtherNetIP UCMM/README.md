# EtherNet/IP UCMM Profile

## Overview

This Universal Device Driver (UDD) profile implements an EtherNet/IP (CIP) client based on **UCMM (Unconnected Message Manager)** messaging. It enables communication with EtherNet/IP devices to:

- Access CIP object attributes/services
- Get device identity information
- Read tag values via Symbol Object

This profile establishes an Ethernet/IP session with the target device and exchanges CIP messages using the `SendRRData` service.

---

## Features

- EtherNet/IP session management (RegisterSession / UnregisterSession)
- UCMM messaging via `SendRRData`
- CIP Object Class abstraction
- Identity Object (Class 0x01) support
- Symbol Object (Class 0x6B) support (tag reads)
- Basic message routing support (hardcoded path)
- Request/response correlation using context tracking
- Multi-part response handling

---

## Connection Behavior

The communication sequence follows:

1. RegisterSession
2. Store Session ID
3. Build and send `SendRRData` (UCMM message)
4. Process response and update tag values
5. Handle retries for fragmented responses

---

## Supported Tag Address Formats

### 1. CIP Object Addressing

Format:

```
CLASS <class>, INSTANCE <instance>, [ATTRIBUTE <attribute>], SERVICE <service>
```

Examples:

```
CLASS 1, INSTANCE 1, ATTRIBUTE 1, SERVICE 14
CLASS 1, INSTANCE 1, SERVICE 14
```

Notes:
- ATTRIBUTE is optional depending on service
- Values are numeric (decimal)
- Keywords are case-insensitive

---

### 2. Symbol Object (Tag-Based Read)

Format:

```
TAG MyTagName
TAG MyStruct.Field
```

Examples:

```
TAG MotorSpeed
TAG Pump.Status
```

Notes:
- Uses Symbol Object (Class 0x6B)
- Internally converted to CIP symbolic segments
- Supports nested fields via dot notation

---

## Supported CIP Objects

### Identity Object (Class 0x01)

Supported service:
- `0x0E` Get_Attribute_Single

Supported attributes:

| ID | Name            | Type   |
|----|-----------------|--------|
| 1  | Vendor ID       | Word   |
| 2  | Device Type     | Word   |
| 3  | Product Code    | Word   |
| 4  | Revision        | String |
| 5  | Status          | Word   |
| 6  | Serial Number   | String |
| 7  | Product Name    | String |

---

### Symbol Object (Class 0x6B)

Supported services:
- `0x4C` Read Tag
- `0x52` Read Tag Fragment (partial support)

Notes:
- Primarily used for reading Logix PLCs tag values
- Supports simple scalar reads
- Partial datatype decoding implemented
- The method shown in this profile is just an example how to retrieve tag value from Logix PLCs
- The profile user still needs to extend the datatype support based on their own usage

---

## Routing Configuration

Message routing is currently **hardcoded** in the script:

```
Backplane → Slot 1
```

Notes:
- Must be manually modified in script based on the hardware network topology
- No dynamic routing configuration available

---

## Data Handling

### Request Flow

- Tag address parsed into CIP parameters
- Mapped to corresponding CIP object
- CIP request constructed
- Wrapped in EtherNet/IP encapsulation (SendRRData)

### Response Flow

- Response matched using context ID
- Routed to appropriate CIP object
- Data decoded and stored in tag

---

## Logging Control

Logging levels:

| Level | Description |
|------|------------|
| 0 | Verbose logging |
| 1 | Standard logging |
| 2 | Request logging |
| 3 | Response logging |

Controlled by:

```
LOGGING_LEVEL
```

---

## Limitations

- Routing path is hardcoded (no runtime configuration)
- Limited CIP object coverage
- Partial datatype support for Symbol Object
- No support for multi-tag batch optimization
- UTF-8 / multibyte strings not supported
- Write services not implemented
- Fragmented reads only partially handled

---

## Known Considerations

- Session must be established before data exchange
- Invalid session triggers automatic re-registration
- Tag validation enforces strict address format
- Responses must match request context or will be ignored
- Some services may require multiple request cycles

---

## Future Enhancements

- Dynamic routing configuration
- Additional CIP object support
- Full datatype decoding
- Write service support
- Improved fragmented read handling
- UTF-8 support
- Batch request optimization

---

## Summary

This profile provides a flexible framework for EtherNet/IP UCMM communications, enabling:

- Direct CIP object access
- Tag-based symbolic reads
- Modular extension of CIP object handling

It is well-suited for:

- Testing and validation scenarios
- Custom CIP integrations
