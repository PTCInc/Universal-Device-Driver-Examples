# FileReader File Poll Profile

Script File: FileReader_FilePoll.js

## Overview

This Universal Device Driver (UDD) profile reads a single file by polling it at the rate configured by the client application. It is designed for simple ASCII-based files, including CSV files, and exposes file content as tag values.

Unlike directory-based monitoring, this profile does not react to file system events. Instead, it reads the file each time a client issues a read request.

---

## Features

- Polls a single file based on client read rate  
- Reads and parses ASCII and CSV files  
- Exposes file data through tag addresses  
- Supports:
  - Line-based access  
  - Field-based access  
  - Last line and field extraction  
- Includes runtime logging control  

---

## Configuration

### File Path

Set the file to be read using:

**Device Properties → File Mode → Base Path**  
**Device Properties → File Mode → File Name**

This profile operates on a single file and does not support directory monitoring.

---

## Supported Tag Addresses

| Address        | Description |
|----------------|-------------|
| `file`         | Entire file contents |
| `linecount`    | Number of lines in the file |
| `line#`        | Contents of a specific line (e.g. `line1`) |
| `line#field#`  | Specific field in a line (e.g. `line3field2`) |
| `lastline`     | Last non-empty line |
| `lastfield#`   | Field from the last non-empty line |

### Notes

- Line numbering starts at **1**  
- Field numbering starts at **1**  
- Fields are split using a comma delimiter (`,`)

---

## Data Handling Behavior

### Polling Model

- Data is read when a client issues a **read request**
- There is no background file monitoring
- Each read operation:
  - Opens the file  
  - Reads its contents  
  - Parses and updates internal storage  
  - Returns values to the requesting tags  

---

### File Processing

When the file is read:

1. The file is converted from byte array to string  
2. The content is split into lines  
3. Each line is stored:
   - `line1`, `line2`, etc.  
4. Each field is extracted:
   - `line1field1`, `line1field2`, etc.  
5. The last non-empty line is stored:
   - `lastline`, `lastfield#`  

---

### Data Reset Behavior

Before processing a new file read:

- Previously stored values are reset to `0`
- This ensures stale data is cleared if the new file contains fewer lines or fields

Note:
- Tags with no matching data after parsing are returned with **Bad quality**

---

## Logging Control

A system tag is available:

```
LoggingLevel
```

### Supported Levels

| Value | Description |
|------|------------|
| 0 | Standard logging |
| 1 | Verbose logging |
| 2 | Debug logging |

Logging level can be changed dynamically at runtime.

---

## File Operations Flow

Each read follows this sequence:

1. `OpenFile`  
2. `ReadFile`  
3. Parse and store data  
4. `CloseFile`  
5. Return tag values  

---

## Limitations

- Maximum file size: **200 KB**  
- Only supports ASCII-compatible text  
- Does not support UTF-8 multibyte characters  
- CSV parsing assumes:
  - Comma-separated values  
  - No quoted or escaped delimiters  

---

## Known Considerations

- File reads occur on every client request  
- Frequent polling may impact performance depending on file size  
- File access conflicts may occur if another process is writing to the file  

---

## Future Enhancements

- Optional caching to reduce repeated file reads  
- UTF-8 support  
- Configurable delimiters  
- Improved CSV parsing (quoted fields, edge cases)  

---

## Summary

This profile provides a simple polling-based approach for reading file data and exposing it as tags.

It is well suited for:

- Static or periodically updated files  
- Environments where event-based file monitoring is not required  
- Lightweight CSV ingestion scenarios  
