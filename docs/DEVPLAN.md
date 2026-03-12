# Forge3D — Development Plan
_Last updated: 2026-03-11 (session 4) — Electron-native v3.0_

---

## Project Vision
> Seamless single-interface workflow: edit .scad → render → arrange on bed → slice → print. No app hopping.

**Current state:** Core loop works. Native OpenSCAD render via IPC, LSP diagnostics, Three.js viewport, full editor. Now building out the power features.

---

## ✅ Already Shipped
- Native OpenSCAD IPC render (`openscad.com` via `execFile`)
- `openscad-lsp` bundled + Problems tab wired
- Three.js viewport (orbit, pan, zoom, HDRI, shadows)
- CodeMirror-style editor (syntax highlight, auto-close, undo/redo)
- File open/save (native dialogs), drag-and-drop
- STL export
- MIT license, public GitHub repo

---

## Phase 1 — Quality of Life (Next Session)

### 1A. Recent Files
**Files:** `electron/main.mjs`, `electron/preload.cjs`, `src/Forge3D.jsx`

- Store last 10 opened file paths in `electron-store` or a JSON file in `app.getPath('userData')`
- Add `File → Recent Files` submenu in Electron menu (rebuild on open)
- Expose `forgeAPI.getRecentFiles()` and `forgeAPI.clearRecentFiles()` via preload
- In app: show recents in File menu AND in a "Recent" section at the top of the sidebar

### 1B. Workspace Folder Browser
**New tab in sidebar:** `📁 Workspace` tab alongside Examples and Params

- User sets a workspace folder via native folder picker (`forgeAPI.setWorkspaceFolder()`)
- IPC: `fs.readdir` the folder recursively for `.scad` files, return a tree
- Sidebar renders the file tree — click to open
- Folder path persisted in `userData` JSON
- Show folder name in tab: `📁 my-parts`

### 1C. Params Tab — Enhanced UX
**File:** `src/Forge3D.jsx` (params sidebar section)

Current state: reads `result.variables` (only works with legacy interpreter, now dead).  
New approach: **parse `// @param` annotations directly from the `.scad` source**.

**Annotation format:**
```openscad
// @param letter = "M"        // type: string, options: A-Z
// @param magnet_d = 6.0      // type: number, min: 3, max: 12, step: 0.5
// @param wall_thickness = 2  // type: number, min: 1, max: 5
letter = "M";
magnet_d = 6.0;
wall_thickness = 2;
```

- Parse `// @param` comments from code with a small regex parser
- Render as: sliders for numbers, text inputs for strings, dropdowns for options
- On change: patch the value in source code and trigger auto-rebuild
- This replaces the dead variable slider system

---

## Phase 2 — Print Pipeline

### 2A. Printer Profiles
**Stored in:** `{userData}/printers.json` — user-owned, git-friendly if they want.

A "printer" is a named JSON object with bed dimensions, PrusaSlicer profile name, and default material settings:

```json
[
  {
    "id": "geeetech-m1-mini",
    "name": "Geeetech M1 Mini",
    "active": true,
    "bed": { "x": 100, "y": 110, "z": 100 },
    "prusaslicer_profile": "0.2mm QUALITY",
    "filament": "PLA",
    "filament_color": "#4fc3f7",
    "nozzle_diameter": 0.4,
    "defaults": {
      "layer_height": 0.2,
      "infill": 15,
      "infill_pattern": "gyroid",
      "supports": false,
      "brim": 0,
      "first_layer_temp": 215,
      "temp": 205,
      "bed_temp": 60
    }
  }
]
```

**UI:** A "Printers" panel (accessible from Print Mode or a settings page):
- List of configured printers with radio-select for active
- `+ Add Printer` → form with all fields
- Active printer dimensions drive the print bed visualization

**IPC:**
- `forgeAPI.getPrinters()` → printer array
- `forgeAPI.savePrinters(printers)` → write to JSON
- `forgeAPI.getActivePrinter()` → active one

---

### 2B. Slicer Settings Embedded in .scad

Per-model slicer preferences stored as a structured comment block at the bottom of the file — travels with the model, git-versionable, survives copy-paste.

**Format:**
```openscad
/* @forge3d
printer: geeetech-m1-mini
layer_height: 0.2
infill: 15
infill_pattern: gyroid
supports: false
brim: 0
filament: PLA
material_color: #4fc3f7
*/
```

**Implementation (`src/forge3d/slicer-settings.js`):**
```js
readSlicerSettings(code)   // regex parse → object (or printer defaults if no block)
writeSlicerSettings(code, settings) // upsert the @forge3d block
```

- On file open: read block → pre-fill Print Mode sliders
- On slider change: `writeSlicerSettings()` → update code (maintains undo history)
- On `New` file: inherit active printer defaults, write block if user enters Print Mode

---

### 2C. PrusaSlicer CLI Integration

**Binary discovery (in order):**
1. `C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe` (default install)
2. `C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer.exe` (older versions)
3. User-set path in settings JSON

**IPC handler (`electron/main.mjs`):**
```js
ipcMain.handle('slicer:slice', async (_e, { stlPath, settings, printer }) => {
  const args = [
    '--export-gcode',
    `--layer-height=${settings.layer_height}`,
    `--fill-density=${settings.infill}%`,
    `--fill-pattern=${settings.infill_pattern}`,
    settings.supports ? '--support-material' : '--no-support-material',
    `--brim-width=${settings.brim}`,
    `--temperature=${settings.temp}`,
    `--first-layer-temperature=${settings.first_layer_temp}`,
    `--bed-temperature=${settings.bed_temp}`,
    `--output=${outputPath}`,
    stlPath,
  ];
  const result = await execFileAsync(PRUSASLICER_BIN, args);
  return { gcodeSize, outputPath, stdout: result.stdout };
});

ipcMain.handle('slicer:openInPS', (_e, { stlPath }) => {
  shell.openPath(stlPath); // opens in PS GUI — user slices manually
});
```

**Slice button flow:**
1. Forge3D runs native render → gets STL bytes
2. Write STL to temp file in `{userData}/temp/`
3. Call `slicer:slice` IPC
4. Show progress (indeterminate spinner)
5. On success: show estimated time + filament use; offer "Open G-code folder"

---

### 2D. Print Mode UI

**Mode switch** in toolbar (toggle button):
```
[⚙ Design]  [🖨 Print]
```

**Print Mode layout:**
```
┌─────────────────┬──────────────────────────────────────────┐
│ 🖨 Geeetech M1  │  Print Bed (Three.js top-down view)      │
│ ─────────────── │                                          │
│ Layer:  [0.2mm] │    ┌───────────┐                        │
│ Infill: [15%  ] │    │  model    │  ← draggable           │
│ Pattern:[gyroid]│    └───────────┘                        │
│ Supports: [ ]   │                                          │
│ Brim:   [0mm  ] │    100 × 110mm bed (M1 Mini)            │
│                 │                                          │
│ Filament: PLA   │  [Auto Arrange]  [+ Add Part]           │
│ ─────────────── │                                          │
│ [Change Printer]│                                          │
├─────────────────┴──────────────────────────────────────────┤
│  [🖨 Slice with PrusaSlicer]    [Open in PrusaSlicer GUI]  │
└────────────────────────────────────────────────────────────┘
```

**Print bed (Three.js):**
- Top-down orthographic camera, bed shown as flat plane with grid lines
- Bed dimensions from active printer profile (M1 Mini = 100×110mm)
- Gray out-of-bounds area to show what fits
- Parts shown as XY bounding-box footprints (later: real contour)
- **Drag** to reposition, **R key** to rotate 90°
- **Auto Arrange**: simple greedy bin-packing, sorted by area descending
- Red highlight if part footprint exceeds bed bounds



---

## Phase 3 — Editor Upgrades

### 3A. LSP Inline Squiggles
The LSP is running, sending diagnostics. Wire them into the editor as visual underlines.

**Current editor:** custom `<textarea>` + `<pre>` overlay approach.  
**Approach:** in the `<pre>` highlight layer, for lines with LSP errors, wrap the relevant span in a `<mark>` with red wavy underline CSS:
```css
.lsp-error { text-decoration: underline wavy #e57373; text-underline-offset: 2px; }
```
- Store `lspDiagnostics` line numbers → render in `HighlightedCode` overlay
- Pass `diagnostics` prop into `CodeEditor`, map line → mark in the rendered spans

### 3B. Find / Replace
`Ctrl+F` opens a floating find bar at top of editor:
- Input field + next/prev arrows + match count
- `Ctrl+H` adds a replace field
- Highlight all matches in the overlay layer (yellow `<mark>`)

### 3C. Go-to-Line / Command Palette
`Ctrl+G` → line number input → jumps editor  
`Ctrl+P` → command palette (fuzzy search commands + example files)

### 3D. Line Folding
Collapse `{ ... }` blocks by clicking a ▶ in the gutter.  
Minimal: just hide the content lines, show `▶ ...` placeholder.

---

## Phase 4 — AI Code Generation

### 4A. Natural Language → OpenSCAD

**The workflow:**
1. User types in a "Sketch" input box: _"a flat letter M, 50mm tall, 3mm thick, with two 6mm cylindrical holes for magnets on the back"_
2. Forge3D constructs a prompt with OpenSCAD context and sends to Claude/GPT API
3. Response is inserted into the editor (with undo step)
4. Build fires automatically

**Implementation options (user picks):**
- **A: Local API key** — user provides their own Claude/OpenAI key, stored in `userData/config.json`
- **B: Copy prompt to clipboard** — extends existing "Ask AI" button pattern, zero infrastructure
- **C: Bundled Ollama** — run a local model (requires user to have Ollama installed)

**Prompt template:**
```
You are an OpenSCAD expert. Generate valid OpenSCAD code for:

"{user_description}"

Rules:
- Output ONLY valid OpenSCAD code, no explanation
- Use Liberation Sans for any text()
- Include all necessary parameters as variables at the top
- Add // @param annotations for each variable
```

### 4B. Pseudocode Mode
A toggle in the editor: `// Sketch Mode`  
Lines starting with `//!` are treated as natural language intent:

```openscad
//! a rounded rectangle base, 80x40mm, 3mm tall
//! subtract a cylinder from each corner, 5mm diameter
//! add a lip around the edge, 1mm wide
```

Click "Generate" → sends the `//!` lines as a prompt → replaces with OpenSCAD code.

---

## Key Files Reference

```
src/
  Forge3D.jsx                 # Main UI + state
  forge3d/
    renderer.js               # Three.js (add print bed plane here for Phase 2)
    editor.jsx                # Editor (add squiggles, find/replace in Phase 3)
    lsp-client.js             # LSP hook (already wired)
    workspace.js              # Add workspace folder IPC here
    slicer-settings.js        # NEW Phase 2 — parse/write @forge3d block
electron/
  main.mjs                    # Add: recent files, workspace IPC, slicer:slice
  preload.cjs                 # Add: getRecentFiles, setWorkspaceFolder, slice
```

---

## Architecture Decisions
1. **No WASM** — Electron-native only from v3.0+
2. **Slicer settings live in the .scad file** — portable, version-controllable
3. **@param annotations** drive the Params tab — no runtime reflection
4. **AI via user's own API key first** — no server infrastructure needed
5. **Print bed in Three.js** — same renderer, new scene mode
