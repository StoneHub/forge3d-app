# Forge3D — Current Status

_Last updated: 2026-04-09_

## ✅ Completed Features

### Core Functionality
- [x] Native OpenSCAD rendering via Electron IPC (`openscad.com`)
- [x] Three.js 3D viewport with orbit/pan/zoom controls
- [x] Code editor with syntax highlighting, auto-close, undo/redo
- [x] File operations (open, save, drag-and-drop) via native dialogs
- [x] STL export (binary format)
- [x] Dark/light theme support
- [x] Auto-run mode (debounced 400ms)

### Advanced Features
- [x] **OpenSCAD LSP integration** — Real-time diagnostics in Problems tab
- [x] **Embedded terminal** — xterm.js + node-pty for PowerShell/bash
- [x] **Automatic dimension brackets** — CAD-style measurement overlays (width/depth/height)
- [x] **Enhanced parameter system** — Parse `// @param` annotations with smart UI controls
- [x] **Auto-parameter detection** — Infer UI controls from top-level variables anywhere in the file
- [x] **Recent files tracking** — Quick access to last 10 opened files
- [x] **Workspace folder browser** — Tree view of `.scad` files in workspace
- [x] **Smart template library** — Toolbar dropdown for inserting categorized OpenSCAD snippets
- [x] **Template insertion modes** — `Append` (safe default), `Cursor`, and `Replace` workflows
- [x] **App icon wiring** — Browser favicon, window icon, and packaged PNG/ICO assets

### UI/UX Polish
- [x] Removed primitive insert buttons (Cube/Sphere/Cylinder)
- [x] Removed "Native" badge clutter
- [x] Improved parameter text readability (white color)
- [x] Added reset button (↺) for each parameter
- [x] Params panel can jump back to parameter assignments in the editor
- [x] Params panel shows appended template source sections
- [x] AUTO badge for auto-detected parameters
- [x] Grid/axes/wireframe/dimension toggles in viewport controls
- [x] Resizable layout panels with persisted sizes (sidebar, editor, console/terminal)

---

## 🚧 Known Issues

### Build Issues (Resolved)
- ✅ node-pty build errors — Fixed with non-fatal postinstall script
- ✅ Electron startup errors — Fixed with lazy-loading of node-pty module

---

## 📋 Next Priorities

See [next-features.md](next-features.md) for detailed implementation plans.

### Current Goal
1. **Reference Parts First / Assembly layer** 🧩
   - Load a second `.scad` file or template beside the current model without mutating the working code
   - Show multiple parts on the same build plate / scene so joins, gaps, overlaps, and fit are visible
   - Build toward move/rotate/scale, boolean operations, and print-bed layout

### Lower Priority
2. **File history/snapshots** ⏱
   - Auto-snapshot on save, every N minutes
   - Timeline view with diff viewer
   - Never lose work

3. **Code ↔ geometry explorer** 🔎
   - Jump from viewport/build tree/params back to source
   - Highlight model regions tied to code blocks
   - Debug model construction step-by-step
   - Expose an API/MCP layer so agents can inspect screenshots, scene state, and code links together

---

## 📁 Documentation Status

### Up-to-Date
- ✅ [README.md](../README.md) — Feature overview, quick start, roadmap
- ✅ [CLAUDE.md](../CLAUDE.md) — Project guide for AI agents
- ✅ [DEVPLAN.md](DEVPLAN.md) — Development roadmap (just updated)
- ✅ [ARCHITECTURE.md](ARCHITECTURE.md) — Technical architecture (just updated)
- ✅ [next-features.md](next-features.md) — Implementation plans for upcoming features
- ✅ [STATUS.md](STATUS.md) — This file

### Needs Review
- ⚠️ [WORKFLOW.md](WORKFLOW.md) — UX spec for Print Mode (future feature)
  - Still relevant but describes unimplemented Print Mode UI
  - Keep for reference when implementing Phase 2

### Removed
- ❌ `docs/implementation_plan.md` — Deleted (terminal feature completed)

---

## 🔧 Technical Debt

### Low Priority
- Terminal: node-pty is a native addon, may break on Electron version updates
  - Current workaround: non-fatal postinstall, lazy-loading
  - Consider: electron-rebuild automation or alternative terminal backend

- Custom OpenSCAD interpreter (`interpreter.js`) still exists but unused
  - All rendering now via native OpenSCAD binary
  - Safe to delete in future cleanup

---

## 📦 Dependencies

### Core
- Electron 33
- React 18
- Three.js 0.170
- Vite 6

### Terminal
- xterm 5.3
- @xterm/addon-fit 0.11
- node-pty 1.1 (native addon)

### LSP
- openscad-language-server (bundled binary in `electron/bin/`)

### Build Tools
- electron-builder
- electron-rebuild (for node-pty)

---

## 🎯 Project Goals

**Short-term:** Ship the "Reference Parts First" assembly workflow so extra templates and files can be compared on the same scene without unsafe code insertion

**Medium-term:** Add a dedicated assembly layer for multi-part move/rotate/scale and union/subtract/intersect, then connect it to print-bed arrangement and PrusaSlicer CLI

Planning note: see `docs/assembly-mode-plan.md` for the current recommendation to separate Assembly Mode from printer-specific Print Mode.

**Long-term:** AI code generation (natural language → OpenSCAD)
