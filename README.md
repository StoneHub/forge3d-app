# Forge3D — OpenSCAD Modeling IDE

A desktop IDE for OpenSCAD built with Electron — write parametric code, render instantly via the native OpenSCAD binary, then send directly to your slicer.

![Version](https://img.shields.io/badge/version-3.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

![Forge3D running as Electron app with native OpenSCAD rendering](docs/screenshots/forge3d-electron-demo.png)

> *Chess pawn rendered in 3.3s via native OpenSCAD binary. ⚡ Native badge — full OpenSCAD compatibility including all fonts and file includes.*

---

## What it is

Forge3D wraps the OpenSCAD you already have installed into a modern, integrated IDE experience. No WASM emulation, no compatibility gaps — it runs your actual `openscad.com` binary and shows the result in a Three.js viewport with orbit controls.

**The goal:** write `.scad` → render → arrange on print bed → slice → print, without leaving the app.

---

## Requirements

- **Windows** (x64)
- **[OpenSCAD](https://openscad.org/downloads.html)** installed at `C:\Program Files\OpenSCAD\openscad.com`
- **Node.js 22+** and **npm 10+**

---

## Quick Start

```bash
git clone https://github.com/StoneHub/forge3d-app
cd forge3d-app
npm install

# Terminal 1 — renderer (Vite dev server)
npm run dev

# Terminal 2 — Electron shell
npx electron .
```

Or use the combined script:
```bash
npm run electron:dev
```

---

## Features

- **Full OpenSCAD compatibility** — runs your installed binary, supports all fonts, includes, and libraries
- **Live build** — Auto-run mode re-renders on every keystroke (debounced 400ms)
- **OpenSCAD LSP** — bundled `openscad-lsp` binary, diagnostics appear in Problems tab as you type
- **Syntax-highlighted editor** — bracket matching, auto-close, auto-indent, tab-to-spaces
- **Three.js viewport** — orbit (LMB), pan (RMB), zoom (scroll), grid, axes, edge overlay
- **STL export** — one-click export of the rendered geometry
- **Dark / light theme**

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Shift+Enter` / `F5` | Build |
| `Ctrl+S` | Save |
| `Ctrl+O` | Open |
| `Ctrl+N` | New workspace |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `LMB drag` | Orbit |
| `RMB drag` | Pan |
| Scroll | Zoom |

---

## Project Structure

```
forge3d-app/
├── electron/
│   ├── main.mjs                    # IPC: native render, file dialogs, LSP
│   ├── preload.cjs                 # Context bridge
│   └── bin/
│       └── openscad-language-server.exe
├── src/
│   ├── Forge3D.jsx                 # Main UI
│   └── forge3d/
│       ├── renderer.js             # Three.js viewport
│       ├── editor.jsx              # Code editor
│       ├── lsp-client.js           # LSP hook
│       ├── stl-parser.js           # Binary + ASCII STL
│       ├── interpreter.js          # Tokenizer (syntax highlight only)
│       └── workspace.js            # localStorage persistence
├── public/fonts/                   # Liberation Sans TTFs
├── Samples/                        # Example .scad files
└── docs/
    ├── DEVPLAN.md                  # Active development plan
    └── WORKFLOW.md                 # UX spec
```

---

## Roadmap

- [x] Native OpenSCAD binary render (Electron IPC)
- [x] OpenSCAD LSP diagnostics (Problems tab)
- [x] STL export, file open/save with native dialogs
- [x] MIT license, public repo
- [ ] Recent files menu + workspace folder browser
- [ ] Print Mode — bed arrangement + PrusaSlicer integration
- [ ] Slicer settings embedded in `.scad` file as comment block
- [ ] Enhanced Params tab with slider/input UI from `// @param` annotations
- [ ] AI code generation (plain English → OpenSCAD)
- [ ] Editor upgrades: LSP squiggles, find/replace, multi-cursor

---

## License

MIT © 2026 monro
