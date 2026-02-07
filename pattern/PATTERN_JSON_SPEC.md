# Pattern App JSON Specification

## Overview
This document describes the JSON format for importing/exporting patterns in the Desu Pattern App. This specification is designed to be AI-readable for programmatic pattern generation.

## File Format

### Basic Structure
```json
[
  [/* row 0 - 16 cells */],
  [/* row 1 - 16 cells */],
  ...
  [/* row 15 - 16 cells */]
]
```

The pattern is a **16×16 grid** represented as a 2D array:
- Outer array: 16 rows (Y-axis, top to bottom)
- Inner arrays: 16 columns (X-axis, left to right)
- Total: 256 cells

### Cell Structure
Each cell is an object with 4 properties:

```json
{
  "type": "rect" | "triangle" | "arc" | null,
  "corner": "tl" | "tr" | "bl" | "br" | null,
  "color": "#RRGGBB",
  "inverted": true | false
}
```

## Property Specifications

### 1. `type` (string | null)
Defines the shape to draw in this cell.

**Valid values:**
- `"rect"` - Filled rectangle (square)
- `"triangle"` - Triangle pointing to a corner
- `"arc"` - Circular arc (quarter circle)
- `null` - Empty cell (no shape)

**Rules:**
- If `type` is `null`, other properties are ignored
- `"triangle"` and `"arc"` require a `corner` value
- `"rect"` ignores the `corner` property

### 2. `corner` (string | null)
Specifies the corner direction for triangles and arcs.

**Valid values:**
- `"tl"` - Top-Left corner
- `"tr"` - Top-Right corner
- `"bl"` - Bottom-Left corner
- `"br"` - Bottom-Right corner
- `null` - No corner specified

**Rules:**
- **Required** when `type` is `"triangle"` or `"arc"`
- Ignored when `type` is `"rect"` or `null`
- For triangles: The corner indicates which corner the triangle points to
- For arcs: The corner indicates which corner the arc originates from

### 3. `color` (string)
The fill color of the shape in hexadecimal format.

**Format:** `"#RRGGBB"`
- Must start with `#`
- Followed by 6 hexadecimal digits (0-9, A-F)
- Case-insensitive (both `#FF0000` and `#ff0000` are valid)

**Examples:**
- `"#000000"` - Black (default)
- `"#FFFFFF"` - White
- `"#FF0000"` - Red
- `"#00FF00"` - Green
- `"#0000FF"` - Blue
- `"#FF00FF"` - Magenta
- `"#FFFF00"` - Yellow
- `"#00FFFF"` - Cyan

**Rules:**
- Always use 6-digit format (not 3-digit shorthand)
- Uppercase letters recommended but not required
- Applied to all shape types except when cell is `null`

### 4. `inverted` (boolean)
Inverts the shape rendering (background/foreground swap).

**Valid values:**
- `false` - Normal rendering (default)
- `true` - Inverted rendering

**Rules:**
- Applies to all shape types
- When `true`, the shape acts as a "cutout" from the filled cell
- Visual effect depends on the shape type:
  - `rect` + `inverted: true` = empty cell with background
  - `triangle` + `inverted: true` = inverted triangle shape
  - `arc` + `inverted: true` = inverted arc shape

## Complete Examples

### Example 1: Simple Empty Grid
```json
[
  [
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    ...
  ],
  ...
]
```

### Example 2: Single Red Rectangle
```json
[
  [
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    ...
  ],
  [
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    {"type":"rect","corner":null,"color":"#FF0000","inverted":false},
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    ...
  ],
  ...
]
```

### Example 3: Triangles Pointing to Corners
```json
[
  [
    {"type":"triangle","corner":"tl","color":"#FF0000","inverted":false},
    {"type":"triangle","corner":"tr","color":"#00FF00","inverted":false},
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    ...
  ],
  [
    {"type":"triangle","corner":"bl","color":"#0000FF","inverted":false},
    {"type":"triangle","corner":"br","color":"#FFFF00","inverted":false},
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    ...
  ],
  ...
]
```

### Example 4: Arcs Creating Circular Patterns
```json
[
  [
    {"type":"arc","corner":"br","color":"#FF00FF","inverted":false},
    {"type":"arc","corner":"bl","color":"#FF00FF","inverted":false},
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    ...
  ],
  [
    {"type":"arc","corner":"tr","color":"#FF00FF","inverted":false},
    {"type":"arc","corner":"tl","color":"#FF00FF","inverted":false},
    {"type":null,"corner":null,"color":"#000000","inverted":false},
    ...
  ],
  ...
]
```

### Example 5: Mixed Shapes with Inverted Mode
```json
[
  [
    {"type":"rect","corner":null,"color":"#0000FF","inverted":true},
    {"type":"triangle","corner":"tr","color":"#FF0000","inverted":true},
    {"type":"arc","corner":"br","color":"#00FF00","inverted":false},
    ...
  ],
  ...
]
```

## Pattern Design Techniques

### Creating Common Patterns

#### 1. Checkerboard Pattern
Alternate between filled rectangles and null cells:
```json
Row 0: [rect, null, rect, null, ...]
Row 1: [null, rect, null, rect, ...]
Row 2: [rect, null, rect, null, ...]
...
```

#### 2. Gradient Effect
Use varying colors across rows or columns:
```json
Row 0: All cells with color #000000
Row 1: All cells with color #111111
Row 2: All cells with color #222222
...
Row 15: All cells with color #FFFFFF
```

#### 3. Circular Pattern
Combine 4 arcs to create a circle:
```json
[tl arc] [tr arc]
[bl arc] [br arc]
```

#### 4. Diamond Pattern
Use triangles pointing outward from center:
```json
      [tr]
  [tr] X [tl]
[tr] X X X [tl]
  [br] X [bl]
      [br]
```

#### 5. Border Pattern
Fill edge cells with rectangles, leave center empty.

## Constraints and Validation

### Must-Have Rules:
1. ✅ **Grid size**: Exactly 16×16 (256 cells total)
2. ✅ **Cell properties**: All 4 properties must exist in every cell
3. ✅ **Valid types**: Only `null`, `"rect"`, `"triangle"`, `"arc"`
4. ✅ **Color format**: Must match `#[0-9A-Fa-f]{6}` pattern
5. ✅ **Boolean**: `inverted` must be `true` or `false`

### Corner Requirements:
- ✅ If `type === "triangle"` → `corner` must be `"tl"`, `"tr"`, `"bl"`, or `"br"`
- ✅ If `type === "arc"` → `corner` must be `"tl"`, `"tr"`, `"bl"`, or `"br"`
- ✅ If `type === "rect"` → `corner` can be `null` (ignored)
- ✅ If `type === null` → `corner` should be `null`

### Invalid Examples:
```json
// ❌ Missing property
{"type":"rect","color":"#FF0000","inverted":false}

// ❌ Invalid type
{"type":"circle","corner":null,"color":"#FF0000","inverted":false}

// ❌ Invalid color format
{"type":"rect","corner":null,"color":"red","inverted":false}

// ❌ Triangle without corner
{"type":"triangle","corner":null,"color":"#FF0000","inverted":false}

// ❌ Invalid corner value
{"type":"triangle","corner":"top","color":"#FF0000","inverted":false}
```

## File Metadata

### Export Filename Format
```
desu_pattern_YYYYMMDD_HHMMSS.json
```
Example: `desu_pattern_20260207_143052.json`

### Import Methods
1. **File Upload**: Click "Import" button and select JSON file
2. **Drag & Drop**: Drag JSON file onto the browser window
3. **Direct Load**: Load from localStorage key `desu-pattern-state`

## AI Generation Guidelines

When generating patterns programmatically:

1. **Initialize Grid**: Start with 16×16 array of empty cells
   ```javascript
   const grid = Array(16).fill(null).map(() =>
     Array(16).fill(null).map(() => ({
       type: null,
       corner: null,
       color: "#000000",
       inverted: false
     }))
   );
   ```

2. **Set Shapes**: Modify cells with desired shapes
   ```javascript
   grid[y][x] = {
     type: "rect",
     corner: null,
     color: "#FF0000",
     inverted: false
   };
   ```

3. **Validate**: Ensure all cells have all 4 properties

4. **Export**: Convert to JSON string
   ```javascript
   const json = JSON.stringify(grid, null, 2);
   ```

### Coordinate System
```
     0   1   2  ...  15  (X)
  ┌─────────────────────┐
0 │ [0,0] [0,1] ... [0,15]
1 │ [1,0] [1,1] ... [1,15]
2 │ [2,0] [2,1] ... [2,15]
: │   :     :   ...   :
15│[15,0][15,1] ...[15,15]
  └─────────────────────┘
(Y)
```
- Access: `grid[y][x]`
- Top-left: `grid[0][0]`
- Bottom-right: `grid[15][15]`

## Visual Reference

### Shape Rendering

#### Rectangle (`type: "rect"`)
```
┌─────┐
│█████│
│█████│
│█████│
└─────┘
```

#### Triangles
```
"tl"        "tr"        "bl"        "br"
█▀▀▀▀      ▀▀▀▀█      █           ▀
██▀▀▀      ▀▀▀██      ██          ▀▀
███▀▀      ▀▀███      ███         ▀▀▀
████▀      ▀████      ████        ▀▀▀▀
█████      █████      █████       █████
```

#### Arcs
```
"tl"        "tr"        "bl"        "br"
█████      █████          ██       ██
████▀      ▀████           █       █
███▀▀      ▀▀███
██▀▀▀      ▀▀▀██       █████      █████
█▀▀▀▀      ▀▀▀▀█       ████▀      ▀████
```

#### Inverted Mode
When `inverted: true`, the filled/empty areas are swapped.

## Practical Use Cases

### 1. Generative Art
Create algorithmic patterns using mathematical functions:
- Sine waves for organic patterns
- Fractals for complex recursive designs
- Random noise for abstract art
- Cellular automata for emergent patterns

### 2. Pixel Art
Design retro-style graphics:
- Character sprites (16×16 is classic size)
- Icons and symbols
- Logo designs
- Tileable textures

### 3. Data Visualization
Represent data in visual form:
- Heat maps (using color gradients)
- Binary data (filled vs empty cells)
- Charts and graphs
- QR-like patterns

### 4. Teaching Tool
Learn programming and design:
- Coordinate system understanding
- Color theory practice
- Algorithmic thinking
- JSON data structure comprehension

## Version History

- **Current Version**: 1.0
- **Format Stability**: Stable (no planned breaking changes)
- **Backward Compatibility**: Full (simple array format)

## Technical Notes

### Storage
- **Method**: localStorage
- **Key**: `desu-pattern-state`
- **Auto-save**: On every change
- **Size Limit**: ~5-10MB (browser dependent)

### Performance
- **Load Time**: Instant for 256 cells
- **Render Time**: 60 FPS refresh rate
- **File Size**: ~30-50 KB for typical patterns

### Browser Compatibility
- **Required**: Modern browser with Canvas API
- **Tested**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Chrome Android

## Support and Resources

- **Source Code**: `/home/user/desu/pattern/js/app.js`
- **Export Function**: Line 1590-1615
- **Import Function**: Line 1618-1637
- **Storage Functions**: Lines 95-121

## Quick Reference Card

```
GRID: 16×16 (256 cells)
FORMAT: JSON array of arrays

CELL STRUCTURE:
{
  "type": null | "rect" | "triangle" | "arc",
  "corner": null | "tl" | "tr" | "bl" | "br",
  "color": "#RRGGBB",
  "inverted": true | false
}

RULES:
- All properties required
- type=null → no shape
- type=triangle/arc → corner required
- color always 6-digit hex
- inverted always boolean

COORDINATES:
grid[row][col] = grid[y][x]
Top-left: [0][0]
Bottom-right: [15][15]
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-07
**Format**: Markdown
**Encoding**: UTF-8
**License**: Free to use and distribute
