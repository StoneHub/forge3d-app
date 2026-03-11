# Forge3D Technical Architecture

## Module Map

```
Forge3D.jsx (state machine)
  │
  ├── mode: 'design' ──→ CodeEditor + openscad.worker + Viewport (free cam)
  │                        │
  │                        └── openscad.worker.js
  │                              └── openscad-wasm (WASM module)
  │                                    ├── FS.writeFile("/input.scad", code)
  │                                    ├── callMain(["input.scad", "-o", "out.stl"])
  │                                    └── FS.readFile("/out.stl") → Uint8Array
  │
  ├── mode: 'print' ───→ PrintSettings + PrintBed + Viewport (bed cam)
  │                        │
  │                        └── slicer.js (Electron only)
  │                              └── child_process.exec(prusa-slicer-console.exe ...)
  │
  ├── stl-parser.js ────→ Binary STL → THREE.BufferGeometry
  │
  ├── workspace.js ─────→ localStorage persistence
  │
  └── exporter.js ──────→ THREE.Scene → binary STL download
```

## openscad-wasm Worker Protocol

### Message: Main → Worker
```json
{
  "type": "render",
  "id": 42,
  "code": "cube([10,10,10]);",
  "outputFormat": "stl"
}
```

### Message: Worker → Main (success)
```json
{
  "type": "result",
  "id": 42,
  "stl": "<ArrayBuffer>",
  "stdout": "ECHO: ...",
  "stderr": "",
  "renderTime": 1234
}
```

### Message: Worker → Main (error)
```json
{
  "type": "error",
  "id": 42,
  "error": "Parse error at line 5",
  "stdout": "",
  "stderr": "ERROR: ..."
}
```

### Worker Lifecycle
- Worker is created ONCE on app mount (WASM load is expensive ~2-5s)
- Subsequent renders reuse the same worker instance
- If render exceeds 30s timeout, worker is terminated and recreated
- Worker posts progress messages for long renders (future)

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

## State Management

All state lives in `Forge3D.jsx` via `useState`. No external state library.

### Design Mode State
```javascript
code: string                    // .scad source code
stlBinary: Uint8Array | null    // last successful render output
stlGeometry: BufferGeometry     // parsed mesh for viewport
buildTime: number               // ms
buildLogs: string[]             // openscad stdout lines
buildErrors: string[]           // openscad stderr lines
building: boolean               // worker in progress
autoRun: boolean                // auto-build on code change
```

### Print Mode State
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
mode: 'design' | 'print'
theme: 'dark' | 'light'
currentFileName: string
viewSettings: { grid, axes, wireframe }
```
