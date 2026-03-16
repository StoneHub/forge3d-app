# Forge3D Workflow Design — Future Print Mode Guidance

> Status: future-facing reference only. Assembly Mode is now the active post-build workflow priority; this document should not be treated as the current implementation target.

## Overview

Forge3D has two modes. The UI physically transforms between them — this is not a tab switch, it's a mode change that repurposes the existing panels.

```
┌─────────────────────────────────────────────────────────────┐
│                    DESIGN MODE                               │
│  Left: Code Editor    │  Right: 3D Preview (free camera)     │
│  Bottom: Console/Errors                                      │
│  Button: [▶ Build]  [🖨 Print Mode →]                        │
└─────────────────────────────────────────────────────────────┘
                         ↕ toggle
┌─────────────────────────────────────────────────────────────┐
│                    PRINT MODE                                │
│  Left: Print Settings │  Right: Print Bed (constrained cam)  │
│  Bottom: Slice Log/Stats                                     │
│  Button: [← Design Mode]  [➕ Add STL]  [🔪 Slice]          │
└─────────────────────────────────────────────────────────────┘
```

---

## DESIGN MODE (Current Default)

### Layout
```
┌──────────┬──────────────────┬───────────────────────────┐
│ Sidebar  │  Code Editor     │  3D Viewport              │
│ Examples │                  │  (orbit/pan/zoom)         │
│ Params   │                  │                           │
│          │──────────────────│  Scene tree overlay       │
│          │  Console/Errors  │  View controls overlay    │
└──────────┴──────────────────┴───────────────────────────┘
```

### Behavior
- User writes/edits `.scad` code
- **Build** sends code through Electron IPC → native OpenSCAD binary → returns STL bytes
- STL is parsed into Three.js BufferGeometry and displayed in viewport
- Console shows render status, build timing, and native OpenSCAD errors
- Auto-build on 400ms debounce (toggleable)

### Build Pipeline (native OpenSCAD)
```
User code (string)
  → Renderer: forgeAPI.renderOpenSCAD(code)
    → Electron IPC: 'openscad:render'
      → Main process writes temp .scad file
      → Run openscad.com -o output.stl input.scad
      → Read STL bytes from temp file
  → Renderer: parse STL binary → Three.js BufferGeometry
  → Render in viewport
```

### Transition to Print Mode
- User clicks **[🖨 Print Mode →]** button in toolbar
- The current rendered STL mesh carries over to the print bed
- Code editor panel transforms into Print Settings panel
- Viewport switches from free camera to print-bed-constrained camera

---

## PRINT MODE

### Layout
```
┌──────────┬──────────────────┬───────────────────────────┐
│ Sidebar  │  Print Settings  │  Print Bed Viewport       │
│ Printer  │                  │  (top-down default cam)   │
│ Filament │  ┌─ Printer ───┐ │                           │
│ STL List │  │ Profile: [▼]│ │  Grid = actual bed size   │
│          │  │ Bed: 250×210│ │  Parts shown with shadow  │
│          │  └─────────────┘ │  Gizmo for move/rotate    │
│          │  ┌─ Print ─────┐ │                           │
│          │  │ Layer: 0.2  │ │                           │
│          │  │ Infill: 20% │ │                           │
│          │  │ Support: off│ │                           │
│          │  └─────────────┘ │                           │
│          │  ┌─ Filament ──┐ │                           │
│          │  │ PLA Generic │ │                           │
│          │  │ Temp: 215°C │ │                           │
│          │  └─────────────┘ │                           │
│          │──────────────────│                           │
│          │  Slice Log/Stats │                           │
│          │  Time: 2h 14m   │                           │
│          │  Filament: 23g  │                           │
│          │  Layers: 150    │                           │
└──────────┴──────────────────┴───────────────────────────┘
```

### Print Bed Viewport

**Visual elements:**
- Rectangular grid matching actual printer bed dimensions (e.g., 250×210mm for Prusa MK3S)
- Grid lines every 10mm, bold lines every 50mm
- Semi-transparent bed surface at Y=0
- Parts rendered as solid meshes with drop shadows on bed
- Red outline if any part extends outside bed bounds
- Origin marker at front-left corner (matching printer home)

**Camera:**
- Default: top-down orthographic view of full bed
- Can orbit/zoom but floor is always visible
- Reset button snaps back to top-down view

**Part manipulation (Three.js TransformControls or custom gizmo):**
- **Click** part to select (highlight outline)
- **Drag** to move on XY plane (snap to 1mm grid, hold Shift for 0.1mm)
- **R key** or rotate handle: rotate around Z axis (snap to 15° increments)
- **S key** or scale handle: uniform scale
- **Delete key**: remove part from bed
- **Ctrl+D**: duplicate selected part
- Parts auto-avoid collision (optional snap/align)

**Toolbar (inside viewport or top bar):**
- `[← Design Mode]` — return to code editor
- `[➕ Add STL]` — file picker to load additional `.stl` files onto the bed
- `[Auto-Arrange]` — pack all parts efficiently on the bed
- `[Center Selected]` — move selected part to bed center
- `[🔪 Slice]` — send to PrusaSlicer CLI
- `[💾 Export G-code]` — save sliced output

### Print Settings Panel (replaces code editor)

This panel replaces the code editor area. It is a scrollable form with collapsible sections.

**Section 1: Printer Profile**
```
Printer:     [▼ Prusa MK3S+ ]     ← dropdown populated from PrusaSlicer profiles
Bed Size:    250 × 210 mm          ← auto-filled from profile, read-only
Nozzle:      0.4 mm                ← auto-filled
```

**Section 2: Print Settings**
```
Layer Height:    [▼ 0.20 mm ]      ← dropdown: 0.10, 0.15, 0.20, 0.28, 0.30
First Layer:     [▼ 0.20 mm ]
Perimeters:      [ 3 ]             ← number input
Infill:          [ 20 ] %          ← slider 0-100
Infill Pattern:  [▼ Gyroid ]       ← dropdown
Support:         [☐ None] [☑ Auto] [☐ Everywhere]
Brim:            [☐ Off ] [☑ On  ] Width: [3] mm
```

**Section 3: Filament**
```
Filament:    [▼ Generic PLA ]      ← from PrusaSlicer filament profiles
Nozzle Temp: [ 215 ] °C
Bed Temp:    [ 60  ] °C
Fan Speed:   [ 100 ] %
```

**Section 4: Speed**
```
Print Speed:     [ 60 ] mm/s
Travel Speed:    [ 150 ] mm/s
First Layer:     [ 20 ] mm/s
```

**Section 5: Advanced (collapsed by default)**
```
Seam Position:   [▼ Nearest ]
Z-Hop:           [☐]  Height: [0.4] mm
Retraction:      [ 0.8 ] mm  Speed: [ 35 ] mm/s
```

### Sidebar in Print Mode

The sidebar switches from examples/params to:

**Panel 1: Printer selector** (quick switch between saved printers)

**Panel 2: STL file list**
```
┌─ Parts on Bed ──────────┐
│ ☑ magnetic_M.stl    ×1  │  ← click to select, badge shows count
│ ☑ magnetic_O.stl    ×2  │
│ ☑ clip_holder.stl   ×1  │
│                          │
│ [➕ Add STL...]          │
│ [🗑 Remove Selected]    │
└──────────────────────────┘
```

### Bottom Panel: Slice Log / Stats

Replaces console/errors panel. Shows:
- Real-time PrusaSlicer stdout during slicing
- After slice completes:
  ```
  ✓ Sliced in 4.2s
  Print Time:  2h 14m (normal mode)
  Filament:    23.4g / 7.82m
  Layers:      150
  G-code:      magnetic_M.gcode (4.2 MB)
  [💾 Save G-code]  [📋 Copy to USB]
  ```

---

## SLICING PIPELINE

### Desktop App Scope
- Forge3D is Electron-only.
- Until PrusaSlicer wiring is complete, the safe fallback is native STL export and optional handoff to the PrusaSlicer GUI.

### PrusaSlicer CLI Mode
```
1. Write all STL parts to temp directory
2. Build PrusaSlicer CLI command:
   prusa-slicer-console.exe \
     --export-gcode \
     --load printer_profile.ini \
     --load print_profile.ini \
     --load filament_profile.ini \
     --layer-height 0.2 \
     --fill-density 20% \
     --output /tmp/output.gcode \
     part1.stl part2.stl part3.stl
3. Stream stdout to Slice Log panel
4. Parse G-code comments for time/filament estimates
5. Offer save/copy actions
```

### Profile Discovery
On startup (Electron only), scan PrusaSlicer config directory:
```
%APPDATA%/PrusaSlicer/
  printer/     → *.ini files → populate Printer dropdown
  print/       → *.ini files → populate Print Settings presets
  filament/    → *.ini files → populate Filament dropdown
```

Each `.ini` file is a key=value config. Parse for display names and key values (bed size, nozzle diameter, temperatures, etc).

---

## DATA FLOW BETWEEN MODES

```
DESIGN MODE                          PRINT MODE
───────────                          ──────────
.scad code                           STL meshes[]
    │                                    │
    ▼                                    ▼
Electron IPC render                  Three.js scene
    │                                    │
    ▼                                    ▼
STL binary ──── carries over ────→  Mesh on print bed
    │                                    │
    ▼                                    ▼
Three.js mesh                        PrusaSlicer CLI
(free camera)                            │
                                         ▼
                                     G-code file
                                     Print stats
```

### State that persists across mode switch:
- `stlBinary: Uint8Array` — raw STL from last build
- `stlMesh: THREE.BufferGeometry` — parsed mesh
- `fileName: string` — current file name (used for G-code naming)

### State unique to Print Mode:
- `bedParts: Array<{ mesh, position, rotation, scale, fileName }>` — parts on bed
- `selectedPartIndex: number`
- `printerProfile: string` — selected printer .ini
- `printSettings: object` — layer height, infill, etc.
- `filamentProfile: string`
- `sliceResult: { gcodePath, time, filament, layers } | null`

---

## IMPLEMENTATION PHASES

### Phase 1: Print Mode UI Shell (Future Stage)
- [ ] Add `mode` state: `'design' | 'print'`
- [ ] Create `src/forge3d/PrintBed.jsx` — print bed viewport component
- [ ] Create `src/forge3d/PrintSettings.jsx` — settings form component
- [ ] Create `src/forge3d/PartsList.jsx` — sidebar parts list
- [ ] Wire mode toggle in toolbar
- [ ] Print bed grid with configurable dimensions
- [ ] Part selection, drag, rotate on bed

### Phase 2: PrusaSlicer Integration (Electron)
- [ ] Create `src/forge3d/slicer.js` — profile discovery + CLI invocation
- [ ] Scan `%APPDATA%/PrusaSlicer/` for profiles on startup
- [ ] Populate dropdowns from discovered profiles
- [ ] Invoke `prusa-slicer-console.exe` with selected settings
- [ ] Parse G-code output for stats (time, filament, layers)
- [ ] Stream CLI output to slice log panel

### Phase 3: Polish
- [ ] Auto-arrange algorithm (bin packing)
- [ ] Collision detection between parts
- [ ] G-code preview in viewport (layer-by-layer visualization)
- [ ] Undo/redo for part manipulation
- [ ] Save/load print bed arrangements
- [ ] USB drive detection for "Copy to USB" feature

---

## OPEN QUESTIONS
- Should we support LycheeSlicer for SLA/resin prints? (installed on dev machine)
- G-code preview: build custom or use an existing viewer library?
- OPENCLAW integration: when co-hosted, how do agents coordinate on the same project files?
