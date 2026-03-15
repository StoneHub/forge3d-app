# Forge3D Technical Architecture
_Updated for v3.0 — Electron-native with IPC rendering_

## Module Map

```
Forge3D.jsx (state machine)
  │
  ├── mode: 'design' ──→ CodeEditor + Electron IPC + Viewport + LSP + Terminal
  │                        │
  │                        ├── forgeAPI.renderOpenSCAD(code) → IPC → Main Process
  │                        │      └── child_process.execFile("openscad.com", ["-o", "out.stl"])
  │                        │            → returns STL binary via IPC
  │                        │
  │                        ├── lsp-client.js → openscad-language-server.exe (stdio)
  │                        │      → diagnostics posted to Problems tab
  │                        │
  │                        └── terminal.jsx → node-pty (PTY shell) → PowerShell/bash
  │                               → xterm.js UI rendering
  │
  ├── mode: 'print' ───→ PrintSettings + PrintBed + Viewport (bed cam)
  │   (planned)            │
  │                        └── slicer.js (Electron only)
  │                              └── child_process.exec(prusa-slicer-console.exe ...)
  │
  ├── renderer.js ──────→ Three.js viewport with:
  │                        ├── Orbit/pan/zoom controls
  │                        ├── Grid, axes, wireframe overlays
  │                        └── Dimension brackets (CAD-style measurements)
  │
  ├── param-parser.js ──→ Parse // @param annotations + auto-detect variables
  │                        → Render sliders/inputs in Params tab
  │
  ├── stl-parser.js ────→ Binary + ASCII STL → THREE.BufferGeometry
  │
  ├── workspace.js ─────→ localStorage persistence + file I/O via IPC
  │
  └── exporter.js ──────→ THREE.Scene → STL serialization + native save dialog
```

## Native OpenSCAD Rendering (Electron IPC)

### Render Flow
```
Renderer (Forge3D.jsx)
  → forgeAPI.renderOpenSCAD(code)
    → IPC: 'openscad:render'
      → Main Process (electron/main.mjs)
        → Write code to temp file in os.tmpdir()
        → child_process.execFile('C:/Program Files/OpenSCAD/openscad.com', ['-o', outputPath, inputPath])
        → Read STL binary from outputPath
        → Return { stl } or { error }
      ← IPC response
  → Parse STL → Three.js geometry → render viewport
```

### Benefits of Native Rendering
- **Full OpenSCAD compatibility** — all features, fonts, libraries work
- **Fast** — no WASM overhead, direct binary execution
- **Reliable** — battle-tested OpenSCAD engine
- **File includes** — can reference external `.scad` files in workspace

### OpenSCAD LSP Integration

**Binary:** `electron/bin/openscad-language-server.exe` (bundled)

**Flow:**
```
lsp-client.js (React hook)
  → Send LSP messages via forgeAPI.lspSend()
    → Main Process forwards JSON-RPC to the bundled language server
  → Receive diagnostics via forgeAPI.onLspReceive()
  → Display in Problems tab with line numbers
```

**Supported LSP features:**
- Real-time syntax/semantic diagnostics
- Error squiggles (planned for editor overlay)
- Hover info (future)
- Auto-complete (future)

## STL Parser

Binary STL format:
```
Bytes 0-79:    Header (ignored)
Bytes 80-83:   Triangle count (uint32 LE)
Per triangle (50 bytes each):
  12 bytes: Normal vector (3× float32)
  36 bytes: 3 vertices (3× 3× float32)
  2 bytes:  Attribute byte count (uint16, ignored)
```

Parser outputs:
```javascript
{
  vertices: Float32Array,   // [x,y,z, x,y,z, ...] — 9 floats per triangle
  normals: Float32Array,    // [nx,ny,nz, ...] — 3 floats per vertex (expanded from face normal)
  triangleCount: number
}
```

Converted to Three.js:
```javascript
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
// OR: geometry.computeVertexNormals() for smooth shading
```

## PrusaSlicer Integration (Electron IPC)

### Profile Discovery (on app start)
```
Renderer → IPC → Main Process
  → fs.readdir('%APPDATA%/PrusaSlicer/printer/')
  → Parse each .ini for: printer_model, bed_shape, nozzle_diameter
  → Return list of { name, fileName, bedSize, nozzle }

Same for print/ and filament/ directories.
```

### Slicing
```
Renderer → IPC → Main Process
  → Write STL parts to temp dir
  → Spawn: prusa-slicer-console.exe --export-gcode \
      --load <printer.ini> \
      --load <print.ini> \
      --load <filament.ini> \
      --output <temp/output.gcode> \
      <temp/part1.stl> <temp/part2.stl>
  → Stream stdout/stderr back to renderer via IPC
  → On exit: parse gcode for time estimate, return stats
```

### G-code Stats Parsing
PrusaSlicer embeds stats as comments at the end of G-code:
```gcode
; estimated printing time (normal mode) = 2h 14m 30s
; total filament used [g] = 23.4
; total filament used [mm] = 7820.5
; total layers count = 150
```
Regex these out and display in the Slice Log panel.

## Print Bed Coordinate System

```
OpenSCAD:           Three.js:           Print Bed:
  Y up                Y up                Z up (but we use Y up in Three)
  Z forward           Z toward camera     Origin at front-left
  X right             X right

Mapping:
  OpenSCAD X → Three X (no change)
  OpenSCAD Y → Three Z (swap Y↔Z)
  OpenSCAD Z → Three Y (swap Y↔Z)

Print bed in Three.js:
  Bed surface at Y=0
  Grid on XZ plane
  Parts sit on Y=0, extend upward in +Y
  Camera default: elevated top-down looking at -Y
```

## Terminal Integration (xterm.js + node-pty)

**Components:**
- **terminal.jsx** — xterm.js UI component with FitAddon
- **electron/main.mjs** — IPC handlers for PTY spawn/write/resize/kill
- **node-pty** — Native addon for pseudo-terminal (PowerShell/bash)

**Flow:**
```
Terminal.jsx
  → forgeAPI.spawnTerminal(cwd)
    → IPC: 'terminal:spawn'
      → Main Process: pty.spawn(shell, [], { cwd, cols, rows })
      → Return terminalId
  → forgeAPI.onTerminalData((data) => xterm.write(data))
  → User types → xterm.onData → forgeAPI.writeTerminal(input)
    → IPC: 'terminal:write' → ptyProcess.write(input)
```

**Features:**
- Full ANSI color support
- Resize handling (syncs terminal cols/rows with xterm UI)
- Auto-cleanup on window close
- Fallback message if node-pty fails to build

## State Management

All state lives in `Forge3D.jsx` via `useState`. No external state library.

### Design Mode State
```javascript
code: string                    // .scad source code
lastSavedCode: string           // for param reset functionality
stlBinary: Uint8Array | null    // last successful render output
stlGeometry: BufferGeometry     // parsed mesh for viewport
buildTime: number               // ms
buildLogs: string[]             // openscad stdout lines
lspDiagnostics: Array<{         // LSP errors/warnings
  line: number,
  message: string,
  severity: 'error' | 'warning'
}>
building: boolean               // render in progress
autoRun: boolean                // auto-build on code change
currentFileName: string         // e.g., "main.scad"
recentFiles: string[]           // last 10 opened file paths
workspaceFolder: string | null  // workspace root directory
```

### Viewport State
```javascript
viewSettings: {
  grid: boolean,                // show grid plane
  axes: boolean,                // show XYZ axes
  wireframe: boolean,           // edge overlay
  dimensions: boolean           // CAD-style measurement brackets
}
cameraState: {                  // persisted camera position
  position: [x, y, z],
  target: [x, y, z]
}
```

### Parameters State
```javascript
params: Array<{
  name: string,                 // variable name
  value: any,                   // current value
  type: 'number' | 'string' | 'boolean' | 'enum',
  min?: number,                 // for number type
  max?: number,
  step?: number,
  options?: string[],           // for enum type
  auto?: boolean,               // true if auto-detected
  line: number,                 // annotation line
  assignmentLine: number        // actual assignment line
}>
```

### Print Mode State (Planned)
```javascript
bedParts: Array<{
  id: string,
  fileName: string,
  stlBinary: Uint8Array,
  geometry: BufferGeometry,
  position: [x, y, z],         // mm, relative to bed origin
  rotation: [rx, ry, rz],      // degrees
  scale: number,               // uniform scale factor
  copies: number,              // for duplicate display
}>
selectedPartId: string | null
printerProfile: { name, file, bedSize: [w,d], nozzle }
printProfile: { layerHeight, infill, perimeters, support, brim, ... }
filamentProfile: { name, file, nozzleTemp, bedTemp }
slicing: boolean
sliceLog: string[]
sliceResult: { gcodePath, time, filament, layers } | null
```

### Shared State (persists across mode switch)
```javascript
mode: 'design' | 'print'       // currently always 'design'
theme: 'dark' | 'light'
currentTab: 'examples' | 'params' | 'workspace'
bottomTab: 'console' | 'problems' | 'terminal'
```
