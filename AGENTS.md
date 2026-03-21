# Forge3D — Project Guide for AI Agents

## What Is This?
Forge3D is an Electron desktop parametric 3D modeling IDE for OpenSCAD `.scad` files. It is evolving into a **unified modeling-to-print pipeline**: edit `.scad` → render STL → arrange on print bed → slice → export G-code.

## Tech Stack
- **Vite + React 18** — SPA, no router
- **Three.js 0.170** — 3D viewport
- **Electron 33** — desktop shell, preload bridge, native file I/O
- **Native OpenSCAD (`openscad.com`)** — invoked through Electron IPC for real renders
- **PrusaSlicer CLI** — (planned) slicing via `prusa-slicer-console.exe`

## Project Structure
```
src/
  main.jsx              # React entry
  Forge3D.jsx           # Main app component (all UI state lives here)
  forge3d/
    editor.jsx          # Monaco-based editor component
    examples.js         # Built-in .scad example gallery
    exporter.js         # STL export (Three.js scene → STL text)
    icons.jsx           # 18 SVG icon components
    interpreter.js      # Tokenizer data for syntax highlighting only
    lsp-client.js       # OpenSCAD language server client
    param-parser.js     # Parse // @param annotations
    renderer.js         # Three.js scene builder (useThreeRenderer hook)
    stl-parser.js       # Binary + ASCII STL parsing
    terminal.jsx        # Embedded terminal pane
    workspace.js        # localStorage persistence
electron/
  main.mjs              # Electron main process
  preload.cjs           # IPC bridge
```

## Build & Run
```bash
npm install
npm run dev          # Electron dev mode (starts Vite renderer + Electron)
npm run build        # Production build to dist/
npm run dist         # Package desktop app / installer
```

## Branch Hygiene
- Before editing files, check the current branch with `git status --short --branch` and compare it to both `main` and `origin/main`.
- If the current branch is stale, already merged, or has a gone upstream, move the work to a fresh `codex/...` branch based on updated `origin/main` before continuing.
- If this mismatch is discovered after edits have started, preserve the changes first, then restack them onto the correct branch instead of continuing on the stale branch.

## Architecture Decisions

### Rendering: Native OpenSCAD via Electron IPC
Forge3D renders by shelling out to the locally installed `openscad.com` binary from the Electron main process. Do NOT invest time improving the legacy custom interpreter beyond tokenizer support for the editor.

### Evolving Workflow: Design → Assembly → Print
Forge3D is moving toward a three-stage workflow:
- `Design Mode` for OpenSCAD authoring
- `Assembly Mode` for mesh placement, measurement, and booleans
- `Print Mode` for printer-bed and slicer workflows

See:
- `docs/WORKFLOW.md` for the existing design/print draft
- `docs/assembly-mode-plan.md` for the recommended Assembly Mode split
- `docs/agent-ops.md` for practical Codex/Tavily operating notes

### Slicing: PrusaSlicer CLI
Desktop builds will shell out to the locally installed PrusaSlicer for slicing.

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
- Keep heavy work out of the renderer; prefer Electron IPC / native processes
- No external UI libraries (custom buttons, panels, etc.)

## Key Gotchas
- `$`-prefixed OpenSCAD variables (`$fn`, `$preview`) must be handled in tokenizer — the `$` char needs to be in BOTH the identifier start AND continuation regex
- `window.forgeAPI` is required — Forge3D does not support standalone browser runtime
- Three.js scene is rebuilt on every render (no diffing)
- localStorage auto-saves on every code change — bad code persists across reloads
