# FileReader Watch Directory Profile

## Overview

This Universal Device Driver (UDD) profile monitors a directory for file changes and reads the contents of matching files. It is designed for simple ASCII-based files, including CSV files, and exposes file data as tag values.

When a file is created or modified in the configured directory, the profile reads the file and updates internal cache. Tags can then reference file content, line data, or specific fields.

---

## Features

- Monitors a directory for file **Created** and **Modified** events  
- Supports filtering by file name or extension using wildcard patterns
- Reads file contents and exposes them as tags  
- Parses CSV-style files into:
  - Line-based values  
  - Field-based values  
- Provides access to:
  - Entire file contents  
  - Line count  
  - Specific lines and fields  
  - Last non-empty line and fields  
- Optional handling of missing data via quality settings  

---

## Configuration

### Base Path

Set the directory to monitor using:

**Device Properties → File Mode → Base Path**

---

### User-Defined Settings

**Device Properties → User-Defined Settings  → Input String**

Specify file filters using a comma-separated list:

```
*.csv,*.ini,readme.txt
```

Examples:

- `*.csv` → All CSV files  
- `*.txt` → All text files  
- `readme.txt` → Specific file  
- `*` or empty → All files  

Filtering is case-insensitive and supports `*` and `?` wildcards.

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

### File Processing

When a file is read:

1. The file is converted from byte array to string  
2. The content is split into lines  
3. Each line is stored:
   - `line1`, `line2`, etc.  
4. Each field is extracted:
   - `line1field1`, `line1field2`, etc.  
5. The last non-empty line is stored:
   - `lastline`, `lastfield#`  

---

### Quality Handling

Controlled by the `USEQUALITY` constant:

```js
const USEQUALITY = false;
```

- **false (default)**  
  - Missing data is replaced with:
    - Empty string for string tags  
    - `0` for numeric tags  
  - Quality is set to **Good**

- **true**  
  - Missing data is not initialized  
  - Tag quality is set to **Bad**

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

---

## File Monitoring Behavior

- Directory monitoring is started using `AsyncWatchDir`  
- The profile reacts to:
  - `Created`
  - `Modified`

### File Processing Flow

1. File is detected  
2. File is opened (`OpenFile`)  
3. File is read (`ReadFile`)  
4. Data is parsed and stored  
5. File is closed (`CloseFile`)  

---

## File Filtering

Files are validated using wildcard patterns:

- `*` → any sequence of characters  
- `?` → single character  

Examples:

- `*.csv` → matches all CSV files  
- `data_??.txt` → matches `data_01.txt`, `data_AB.txt`

If no filters are provided, all files are accepted.

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

- File changes are event-driven  
- Each new file read overwrites previously stored data  
- Large or frequently updated files may increase processing frequency  

---

## Future Enhancements

- Optional file deletion after processing  
- Enhanced CSV parsing (quoted fields, edge cases)  
- UTF-8 support  
- Configurable delimiters  

---

## Summary

This profile provides a lightweight mechanism for:

- Monitoring directories  
- Reading file contents  
- Exposing structured data as tags  

It is well suited for simple CSV ingestion and file-based integrations without requiring a full ETL pipeline.