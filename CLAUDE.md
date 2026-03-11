# Forge3D — Project Guide for AI Agents

## What Is This?
Forge3D is a browser-based (+ Electron desktop) parametric 3D modeling IDE that reads OpenSCAD `.scad` files. It is evolving into a **unified modeling-to-print pipeline**: edit `.scad` → render STL → arrange on print bed → slice → export G-code.

## Tech Stack
- **Vite + React 18** — SPA, no router
- **Three.js 0.170** — 3D viewport
- **openscad-wasm** — (planned) real OpenSCAD engine compiled to WASM, runs in a Web Worker
- **Electron 33** — optional desktop wrapper with native file I/O
- **PrusaSlicer CLI** — (planned) slicing via `prusa-slicer-console.exe`

## Project Structure
```
src/
  main.jsx              # React entry
  Forge3D.jsx           # Main app component (all UI state lives here)
  forge3d/
    editor.jsx          # CodeMirror-style editor component
    examples.js         # Built-in .scad example gallery
    exporter.js         # STL export (Three.js scene → binary STL)
    icons.jsx           # 18 SVG icon components
    interpreter.js      # LEGACY — custom OpenSCAD parser (being replaced by openscad-wasm)
    interpreter.worker.js # LEGACY — Web Worker wrapper for interpreter
    renderer.js         # Three.js scene builder (useThreeRenderer hook)
    workspace.js        # localStorage persistence, file open/save
electron/
  main.mjs              # Electron main process
  preload.cjs           # IPC bridge
Samples/                # Test .scad files
```

## Build & Run
```bash
npm install
npm run dev          # Vite dev server on :5173
npm run build        # Production build to dist/
npm run electron:dev # Desktop app
```

## Architecture Decisions

### Rendering: openscad-wasm (replaces custom interpreter)
The custom interpreter (`interpreter.js`) is being **fully replaced** by openscad-wasm. Do NOT invest time improving the custom interpreter. The WASM module gives pixel-perfect OpenSCAD compatibility including text(), offset(), hull(), minkowski(), CSG booleans, fonts, and every other feature.

### Two-Mode UI: Design Mode ↔ Print Mode
See `docs/WORKFLOW.md` for the full specification.

### Slicing: PrusaSlicer CLI (Electron only)
Desktop builds shell out to the locally installed PrusaSlicer for slicing. Browser-only builds show an "Export STL" button instead.

## Local Tools Available on Dev Machine
| Tool | Path | Notes |
|------|------|-------|
| OpenSCAD | `C:\Program Files\OpenSCAD\openscad.com` | v2021.01 |
| PrusaSlicer | `C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe` | CLI slicing |
| LycheeSlicer | Desktop shortcut | SLA/resin (future) |
| PrusaSlicer profiles | `%APPDATA%\PrusaSlicer\` | print/printer/filament configs |

## Coding Conventions
- Inline styles (no CSS files) — all styling in JSX
- Functional components with hooks only
- Colors via `colors` theme object (dark/light)
- Web Workers for all heavy computation
- No external UI libraries (custom buttons, panels, etc.)

## Key Gotchas
- `$`-prefixed OpenSCAD variables (`$fn`, `$preview`) must be handled in tokenizer — the `$` char needs to be in BOTH the identifier start AND continuation regex
- Web Workers can't access DOM — pass serializable data only
- Three.js scene is rebuilt on every render (no diffing)
- localStorage auto-saves on every code change — bad code persists across reloads
