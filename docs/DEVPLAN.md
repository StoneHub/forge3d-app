# Forge3D — Development Plan
_Last updated: 2026-03-15 — Electron-native v3.0_

---

## Project Vision
> Seamless single-interface workflow: edit .scad → render → arrange on bed → slice → print. No app hopping.

**Current state:** Core modeling workflow complete with professional UX. Native OpenSCAD render, LSP diagnostics, resilient parameter system, embedded terminal, automatic dimension brackets, and a safer template workflow are shipped. The next goal is a true multi-part scene/reference workflow so users can compare and fit models together without editing everything into one file.

---

## ✅ Already Shipped

### Core Features
- Native OpenSCAD IPC render (`openscad.com` via `execFile`)
- `openscad-lsp` bundled + Problems tab with real-time diagnostics
- Three.js viewport (orbit, pan, zoom, HDRI, shadows, grid, axes)
- Monaco-based editor (syntax highlight, auto-close, undo/redo)
- File open/save (native dialogs), drag-and-drop
- STL export
- MIT license, public GitHub repo

### Power Features
- **Embedded Terminal** — xterm.js + node-pty for PowerShell/bash within app
- **Automatic Dimension Brackets** — CAD-style measurement overlays showing width/depth/height
- **Enhanced Params Tab** — Smart `// @param` annotation parser with sliders, inputs, dropdowns, reset buttons
- **Auto-Parameter Detection** — Automatically detects top-level variables anywhere in the file and infers appropriate UI controls from naming patterns (size, count, angle, gap, etc.)
- **Recent Files** — Track and quick-access last 10 opened files
- **Workspace Folder Browser** — Tree view of workspace `.scad` files with click-to-open
- **Safe Template Insertion** — Templates can append as isolated blocks, insert at cursor, or replace the current buffer

### UI Polish (v3.0)
- Removed clutter (Native badge, primitive insert buttons)
- Improved parameter text readability (white instead of purple)
- Added reset button (↺) for each parameter to restore original value
- AUTO badge for auto-detected parameters
- Dark/light theme support

---

## Phase 1 — UX Improvements (Current Priority)

See [next-features.md](next-features.md) for detailed implementation plans.

### 1A. Resizable Panels ⚡ **SHIPPED**
- Horizontal resize: Code editor ↔ Viewport
- Vertical resize: Editor/Viewport area ↔ Console/Terminal
- Sidebar resize + collapse
- Store sizes in localStorage

### 1B. App Icon 🎨 **SHIPPED**
- Design professional icon (Forge/Anvil + 3D cube theme)
- Create `public/icon.png` (256x256+) and `public/favicon.ico`
- Update `electron-builder` config

### 1C. Smart Code Templates 📋 **SHIPPED**
Replace removed primitive buttons with useful parametric templates:
- Parametric shapes (rounded box, etc.)
- Mechanical parts (brackets, clips)
- Joinery (dovetails, snap-fits, threaded inserts)
- Utilities (grid array, circular pattern, honeycomb)
- Store in `src/forge3d/templates.js`
- UI: "📋 Templates" dropdown with categories plus `Append`, `Cursor`, and `Replace` insertion modes
- Default behavior: append a marked template block at the end of the file so existing parameters stay visible

### 1D. File History / Snapshots ⏱
"Windows Recall" for `.scad` files — never lose work:
- Auto-snapshot on save, every N minutes, before opening new file
- Store in `.forge3d/snapshots/` (gitignored)
- Sidebar tab: "⏱ History" with timeline view
- Diff viewer and restore functionality
- Smart cleanup (keep recent, hourly, daily, weekly)

---

## Phase 2 — Print Pipeline

### 2A. Assembly Layer / Multi-Part Boolean Workflow

Forge3D should grow beyond a single-model editor into a lightweight assembly workspace inspired by Microsoft 3D Builder.

**Goal:** Load multiple rendered parts into one scene, position them visually, and combine them with simple boolean operations without overloading the main `.scad` editor.

See also: `docs/assembly-mode-plan.md` for the recommended split between Assembly Mode and later Print Mode, plus the first-pass UX based on Microsoft 3D Builder patterns.

**Immediate Phase 2A goal ("Reference Parts First"):** add a reference-parts workflow first. Users should be able to load a second template or `.scad` file beside the current model on the same scene/build plate without mutating the working file just to compare fit, spacing, gaps, or intersections.

**Why this matters:**
- Makes kitbashing and print prep much faster
- Unlocks common workflows like cutting holes, making negative molds, and joining parts
- Creates a natural bridge between modeling and print-bed arrangement

**Recommended implementation order:**
1. Reference parts / multi-part scene layer separate from the code editor
2. Per-part transform controls: move, rotate, scale
3. Per-part boolean actions: union, subtract, intersect
4. Export combined result as a single printable asset
5. Evolve that same scene into a print-bed/assembly stage

**Important constraint:** keep this as a dedicated scene/assembly layer, not as more complexity inside the single-file OpenSCAD editing flow.

### 2B. Printer Profiles
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

### 2C. Slicer Settings Embedded in .scad

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

### 2D. PrusaSlicer CLI Integration

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

### 2E. Print Mode UI

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

### Editor UX Follow-Up Batch
This batch addresses the "make Forge3D feel like a real IDE" layer without changing the core native OpenSCAD architecture.

**Scope:**
- IDE-style zoom with `Ctrl+=`, `Ctrl+-`, and `Ctrl+0`, plus a visible zoom indicator and persisted zoom level
- A **Quick Start** surface for simple starter snippets: cube, sphere, cylinder, square/plane, offset, hull, union/difference, transforms, and module/function skeletons
- Smarter template insertion that preserves existing generated parameters instead of clobbering them
- Adaptive parameter slider ranges based on explicit `@param` metadata first, then file-scale heuristics
- A document outline for modules, functions, top-level vars, and template blocks, which can later grow into a lightweight scene/build tree
- Built-in snapshot + diff history so users are not limited to undo/redo

**Recommended implementation order:**
1. IDE-style zoom + Quick Start panel
2. Template merge/preserve flow + adaptive param ranges
3. Outline/symbol navigation
4. Snapshot history + diff preview/restore
5. Inline completions / AI prediction once the editor surface can support ghost text cleanly

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

### 3E. Code ↔ Geometry Explorer
Make the editor and viewport feel connected, similar to how the Params panel already connects code values to UI controls.

**Goal:** Help users understand which parts of the code create which parts of the model.

**Recommended implementation order:**
1. **Param-to-code and param-to-viewport links**
   - Clicking a param jumps to its assignment in the editor
   - Hovering a param highlights the affected region in the model when possible
2. **Object picking → source jump**
   - Clicking a rendered sub-part highlights the originating line/module in code
   - Show a small inspector with source line, transform, dimensions, and material/color
3. **Build tree / scene tree**
   - Show a hierarchical list of generated parts or operations
   - Place the first version in the **View / viewport panel** so visibility toggles live next to the model, not in the Params tab
   - Selecting a tree node isolates/highlights that geometry in the viewport
4. **Step-through construction mode**
   - Let users scrub through unions, differences, hulls, and extrusions in order
   - Great for debugging why a model looks wrong
5. **Module-level visibility toggles**
   - Eye icons to hide/show subassemblies or code blocks without editing source
6. **Agent API / MCP layer**
   - Expose viewport screenshots, orbit presets, model stats, scene/build tree, and source links to coding agents
   - Allow agents to inspect code, geometry, and render state together instead of guessing from text alone

**Practical note:** because Forge3D renders through native OpenSCAD, the most realistic first version is a lightweight scene/build tree plus editor jump/highlight links, not perfect AST-level mapping for every triangle.

### 3F. Inline Completions & AI Prediction
Support both standard code completion and optional AI "ghost text" without coupling Forge3D to any one provider.

**Phase 1: LSP-backed completions**
- Extend the existing OpenSCAD language-server bridge beyond diagnostics
- Request regular completions and document symbols from the bundled server
- Reuse those results for completion lists, jump-to-symbol, and an outline/sidebar tree

**Phase 2: AI inline prediction**
- Add a provider abstraction in Electron: `none`, user API key, local OpenAI-compatible endpoint, or experimental local CLI adapter
- Recommended first-party path: user-owned API keys in `userData/config.json` so Forge3D stays offline-friendly and serverless
- Treat Codex CLI / Claude Code session integration as **explicit experimental adapters**, not as a dependency on scraping an arbitrary live terminal session

**UX guidance borrowed from other IDEs:**
- Keep language-server completions and AI ghost text as separate layers
- Let `Tab` accept a prediction when there is no conflict; use a modifier/subtle mode when a completion menu is already open
- Support "accept next word" and "accept next line" for multi-line predictions
- Make predictions easy to disable per language or globally

**Practical note:** the current textarea + overlay editor is fine for find, jump, and light squiggles, but robust ghost text, diff review, symbol trees, and rich completion UX may justify migrating the editor surface to Monaco or CodeMirror 6 before going deep on AI completions.

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
