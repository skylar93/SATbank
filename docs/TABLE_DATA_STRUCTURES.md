# Table Data Structures Documentation

## Overview
This document explains the various table data structures used in the SAT Mock Exam system, particularly in answer choices. Understanding these structures is crucial for debugging and maintaining table-related functionality.

## Data Structure Variations

### 1. Direct Table Structure (Most Common)
When answer choices contain tables, the data is often stored directly in the option object:

```json
{
  "A": {
    "headers": ["Column 1", "Column 2"],
    "rows": [
      ["Row 1 Col 1", "Row 1 Col 2"],
      ["Row 2 Col 1", "Row 2 Col 2"],
      ["Row 3 Col 1", "Row 3 Col 2"]
    ]
  }
}
```

**Key Points:**
- ✅ `optionData.headers` exists directly
- ✅ `optionData.rows` exists directly  
- ❌ NO `optionData.table_data` wrapper
- ❌ NO `text` field in this case

### 2. Nested Table Structure
Some tables may be nested under a `table_data` property:

```json
{
  "A": {
    "text": "Some additional text",
    "table_data": {
      "headers": ["Column 1", "Column 2"],
      "rows": [
        ["Row 1 Col 1", "Row 1 Col 2"]
      ]
    }
  }
}
```

### 3. Markdown Table Structure
Tables converted to markdown format for editing:

```json
{
  "A": {
    "text": "{{table}}\nColumn 1 | Column 2\n--- | ---\nRow 1 Col 1 | Row 1 Col 2\n{{/table}}"
  }
}
```

## Detection Logic in Code

### In Edit Mode (question-display.tsx)
The table detection follows this priority order:

```javascript
// 1. First try to parse from markdown
let tableDataInOption = parseTableFromMarkdown(optionText);

// 2. Check for nested table_data structure
if (!tableDataInOption && optionData.table_data && optionData.table_data.headers && optionData.table_data.rows) {
  tableDataInOption = optionData.table_data;
}

// 3. Check for direct table structure (MOST COMMON)
if (!tableDataInOption && optionData.headers && optionData.rows) {
  tableDataInOption = { headers: optionData.headers, rows: optionData.rows };
}
```

### In Preview Mode
The rendering logic checks multiple formats:

```javascript
// Direct table structure
if (optionData.headers && optionData.rows) {
  return renderTable(optionData, true);
}

// Nested table structure  
if (optionData.table_data && optionData.table_data.headers && optionData.table_data.rows) {
  return renderTable(optionData.table_data, true);
}

// Text with image content
if (optionData.text || optionData.imageUrl) {
  return renderContent();
}
```

## Common Issues and Solutions

### Issue 1: Tables Not Showing in Edit Mode
**Symptoms:** Tables visible in preview but disappear in edit mode
**Cause:** Detection logic only checking for `table_data` wrapper, missing direct structure
**Solution:** Add check for direct `headers` and `rows` properties

### Issue 2: Data Structure Confusion
**Symptoms:** `hasTableData: false` but table data actually exists
**Cause:** Checking wrong property (`optionData.table_data` vs `optionData.headers`)
**Solution:** Check all possible structures in order of priority

### Issue 3: JSON Parsing Errors
**Symptoms:** Answer choices show as raw JSON strings
**Cause:** Double-stringified JSON or malformed JSON structure
**Solution:** Robust parsing with fallback to string representation

## File Locations

### Key Files for Table Handling:
- `apps/web/components/exam/question-display.tsx` - Main question display and editing
- `apps/web/components/admin/TableEditor.tsx` - Table editing component
- `apps/web/lib/utils.ts` - Table markdown parsing utilities

### Functions to Know:
- `parseTableFromMarkdown()` - Converts markdown table to object
- `buildTableMarkdown()` - Converts object to markdown table
- `renderTable()` - Renders table HTML from data structure
- `renderAnswerChoiceContent()` - Main answer choice rendering logic

## Debug Tips

### Quick Debug Checks:
1. **Log the raw option data:** `console.log('Option data:', optionData)`
2. **Check structure:** Look for `headers`, `rows`, `table_data`, or `text` properties
3. **Verify parsing:** Test `parseTableFromMarkdown()` with sample markdown
4. **Check conditions:** Ensure all boolean conditions match actual data structure

### Common Debug Commands:
```javascript
// Check what properties exist
Object.keys(optionData)

// Check data types
typeof optionData.headers // should be 'object' (array)
Array.isArray(optionData.headers) // should be true
Array.isArray(optionData.rows) // should be true

// Check content
optionData.headers.length // number of columns
optionData.rows.length // number of rows
```

## Last Updated
2025-08-16 - After fixing direct table structure detection in edit mode