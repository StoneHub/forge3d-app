# Forge3D — Development Plan for Next Agent
_Last updated: 2026-03-11 (session 3)_

---

## Project Vision (User's Words)
> "Seamless single-interface workflow: edit .scad → render STL → arrange on print bed → slice → print. I hate hopping between tools."

The user makes 3D-printed fridge magnet letters using OpenSCAD. Their files work perfectly in desktop OpenSCAD. Forge3D should render them identically in the browser, then hand off to PrusaSlicer without leaving the app.

---

## Current Status

### ✅ DONE
| Feature | File(s) | Notes |
|---------|---------|-------|
| React + Vite + Electron scaffold | `src/Forge3D.jsx`, `electron/main.mjs` | Stable |
| Three.js 3D viewport | `src/forge3d/renderer.js` | Orbit, pan, zoom, shadows, HDRI |
| CodeMirror-style editor | `src/forge3d/editor.jsx` | Syntax highlight, auto-close, undo/redo |
| openscad-wasm worker | `src/forge3d/openscad.worker.js` | **Primary render path** |
| STL parser (binary + ASCII) | `src/forge3d/stl-parser.js` | Auto-detects format |
| Legacy interpreter (fallback) | `src/forge3d/interpreter.js` | Tokenizer kept for syntax highlight |
| File open/save (browser + Electron) | `src/forge3d/workspace.js` | Drag-and-drop also works |
| Error display with line jump | `src/Forge3D.jsx` | [object Object] bug fixed |
| Ask AI (clipboard dump) | `src/Forge3D.jsx` | Copies debug prompt to clipboard |
| Sample file: magnetic_letter_only.scad | `Samples/` | Uses Liberation Sans:style=Bold |

### ⚠️ CONFIRMED BROKEN — Fix this first
| Feature | Root Cause | Fix |
|---------|-----------|-----|
| `text()` / font support in WASM | **The CDN URL for Liberation Sans returns 404.** `fetch('https://cdn.jsdelivr.net/gh/liberationfonts/...')` fails silently, no fonts are written to WASM FS, `text()` produces empty geometry. | See Font Fix section below. |

### ✅ CONFIRMED WORKING
- WASM render pipeline — simple shapes (cube, sphere, cylinder) render correctly in browser
- STL parser — binary and ASCII both work
- Three.js display — orbit, pan, shadows, correct coordinate system

### ❌ NOT STARTED
| Feature | Priority | Notes |
|---------|----------|-------|
| OpenSCAD LSP in Electron | **HIGH** | See LSP Implementation Plan below |
| Print Mode UI | MEDIUM | See `docs/WORKFLOW.md` |
| PrusaSlicer CLI integration | MEDIUM | See `docs/WORKFLOW.md` |
| Print bed arrangement | LOW | Three.js scene with drag/rotate |

---

## 🔥 Font Fix — Do This First

### Root cause (confirmed)
The CDN URL `https://cdn.jsdelivr.net/gh/liberationfonts/liberation-fonts@2.1.5/...` returns **404**. Font loading silently fails. OpenSCAD's `text()` produces no geometry. All letter files render blank.

### Fix option A — Bundle fonts in `/public/fonts/` (recommended)
1. Research agent: find working download URLs for Liberation Sans Bold + Regular TTF (try GitHub releases, Google Fonts, or the `npm` package `liberation-fonts-ttf`)
2. Download to `public/fonts/LiberationSans-Bold.ttf` and `public/fonts/LiberationSans-Regular.ttf`
3. Update `src/forge3d/openscad.worker.js` `loadFonts()` to fetch from local URL:
   ```js
   // Replace CDN urls with:
   { name: 'LiberationSans-Bold.ttf',    url: '/fonts/LiberationSans-Bold.ttf' },
   { name: 'LiberationSans-Regular.ttf', url: '/fonts/LiberationSans-Regular.ttf' },
   ```
   In a Web Worker `fetch('/fonts/...')` resolves to `http://localhost:5173/fonts/...` which Vite serves from `public/`. ✓
4. Test: load `Samples/magnetic_letter_only.scad`, click Build — should render letter M with magnet pockets.

### Fix option B — Use desktop OpenSCAD binary via Electron IPC (Electron-only, simpler)
The user has OpenSCAD installed at `C:\Program Files\OpenSCAD\openscad.com`. In Electron mode, skip WASM entirely for the render:
1. In `electron/main.mjs`, add `ipcMain.handle('openscad:render', async (_e, { code, outputPath }) => { ... })` that writes code to temp file, runs `openscad.com -o output.stl input.scad`, returns STL bytes.
2. In `src/Forge3D.jsx`, when `window.forgeAPI?.renderOpenSCAD` is available, use it instead of WASM worker.
3. Result: 100% OpenSCAD compatibility including all system fonts, no WASM font headaches.

**Recommendation**: Do Option A for the browser WASM path (needed for non-Electron), and Option B for Electron (better quality). Both can coexist — Electron uses native, browser uses WASM.

---

## Immediate Debug Checklist (WASM rendering)

Before building new features, confirm the WASM pipeline is actually working:

1. Run `npm run dev` in `C:\Users\monro\Codex\forge3d-app`
2. Open browser at `http://localhost:5173` (or whatever port Vite picks)
3. Open DevTools → Console tab
4. Load `Samples/magnetic_letter_only.scad` (drag-drop or Open button)
5. Click **Build** (or wait for Auto-run)
6. Watch for errors in Console. Common scenarios:

| Console error | Cause | Fix |
|---------------|-------|-----|
| `Failed to fetch` on worker import | Vite can't serve openscad-wasm module | Check vite config; try `optimizeDeps: { exclude: ['openscad-wasm'] }` |
| `WebAssembly.instantiate` error | WASM compile failed | Check if browser supports WASM (should be fine on modern Chrome) |
| `FS.readFile: /output.stl not found` | OpenSCAD render failed silently | Check stderr for actual OpenSCAD error |
| Blank viewport, console clean | STL parsed but 0 triangles | Font issue — text() produced no geometry |
| `STL parse error` in Problems tab | Parser failed on output | Check what `stlText` looks like; add `console.log(stlText.slice(0, 200))` to worker |

**Quick test**: Replace the letter file with a simple no-font shape first to isolate whether the issue is font-related or pipeline-related:
```openscad
cube([20, 20, 20]);
```
If the cube renders, the pipeline works and the issue is fonts only.

---

## Next Feature: OpenSCAD LSP Integration

### Goal
Inline diagnostics (red squiggles), hover docs, and autocomplete inside Forge3D's code editor, powered by the real OpenSCAD language server.

### Architecture

```
Renderer process (browser)        Main process (Electron Node.js)
  editor.jsx                         electron/main.mjs
    └─ LSP messages over IPC  ───▶   spawnLSP()
                                        └─ child_process.spawn('openscad-language-server')
                                              stdio: [pipe, pipe, pipe]
                                        └─ bridge: stdin/stdout ↔ ipcMain
                                   ipcMain.on('lsp-send') → write to LSP stdin
                                   LSP stdout → win.webContents.send('lsp-recv')
```

### Files to create/modify

| File | Change |
|------|--------|
| `electron/main.mjs` | Add `spawnLSP()` function, add `lsp-send`/`lsp-recv` IPC handlers |
| `electron/preload.cjs` | Expose `lspSend(msg)` and `onLspReceive(callback)` via contextBridge |
| `src/forge3d/lsp-client.js` | LSP JSON-RPC message framing (`Content-Length: N\r\n\r\n{...}`) |
| `src/forge3d/editor.jsx` | Add `useLSP` hook — send `textDocument/didOpen`, `didChange`; receive `publishDiagnostics` |
| `src/Forge3D.jsx` | Pass LSP diagnostics into the errors/warnings panel |

### Step-by-step implementation

#### Step 1 — Install the LSP binary
The `antyos.openscad` VS Code extension ships `openscad-language-server.exe`. It can also be built from:
- https://github.com/Leathong/openscad-language-server (Rust, `cargo build --release`)
- Or downloaded from the VS Code extension's `bin/` folder

**Easiest path on Windows**: Install `antyos.openscad` in VS Code, then find the binary at:
```
%USERPROFILE%\.vscode\extensions\antyos.openscad-*\bin\openscad-language-server.exe
```
Copy it to `electron/bin/openscad-language-server.exe` and bundle it with the Electron app.

#### Step 2 — Electron main process
Add to `electron/main.mjs`:
```js
import { spawn } from 'child_process'

let lspProcess = null

function spawnLSP(win) {
  const lspBin = isDev
    ? path.join(__dirname, 'bin', 'openscad-language-server.exe')
    : path.join(process.resourcesPath, 'bin', 'openscad-language-server.exe')

  lspProcess = spawn(lspBin, [], { stdio: ['pipe', 'pipe', 'pipe'] })

  let buf = ''
  lspProcess.stdout.on('data', (chunk) => {
    buf += chunk.toString()
    // Parse LSP framing: Content-Length: N\r\n\r\n{...}
    while (true) {
      const headerEnd = buf.indexOf('\r\n\r\n')
      if (headerEnd === -1) break
      const header = buf.slice(0, headerEnd)
      const lenMatch = header.match(/Content-Length:\s*(\d+)/i)
      if (!lenMatch) { buf = buf.slice(headerEnd + 4); continue }
      const len = parseInt(lenMatch[1])
      if (buf.length < headerEnd + 4 + len) break
      const body = buf.slice(headerEnd + 4, headerEnd + 4 + len)
      buf = buf.slice(headerEnd + 4 + len)
      try { win.webContents.send('lsp-recv', JSON.parse(body)) } catch (_) {}
    }
  })

  ipcMain.on('lsp-send', (_event, msg) => {
    const body = JSON.stringify(msg)
    lspProcess.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
  })
}
```
Call `spawnLSP(win)` at the end of `createWindow()`.

#### Step 3 — Preload bridge
Add to `electron/preload.cjs`:
```js
lspSend: (msg) => ipcRenderer.send('lsp-send', msg),
onLspReceive: (cb) => {
  const handler = (_event, msg) => cb(msg)
  ipcRenderer.on('lsp-recv', handler)
  return () => ipcRenderer.removeListener('lsp-recv', handler)
},
```

#### Step 4 — LSP client hook
Create `src/forge3d/lsp-client.js`:
- Sends `initialize` on mount
- Sends `textDocument/didOpen` when file opens
- Sends `textDocument/didChange` on every keystroke (throttled 300ms)
- Receives `textDocument/publishDiagnostics` and returns `{ errors, warnings }` arrays

#### Step 5 — Wire into editor
In `editor.jsx`, call `useLSP(code, currentFilePath)` and surface diagnostics as inline squiggles on the line number gutter. Pass them up to `Forge3D.jsx` via a callback so they also appear in the Problems tab.

### Notes for LSP implementation
- LSP uses 1-based line/character indexing
- The editor's line jump already works — LSP diagnostics include line numbers
- Only enable LSP when running in Electron (`window.forgeAPI` exists); browser mode skips it
- The `openscad-language-server` binary needs OpenSCAD to be installed for full functionality — check `C:\Program Files\OpenSCAD\openscad.com` exists

---

## Phase 2: Print Mode (after LSP is working)

Full spec in `docs/WORKFLOW.md`. Short summary:

```
[Design Mode]                     [Print Mode]
┌──────────┬──────────┐           ┌──────────┬──────────┐
│ Editor   │ 3D View  │  ─────▶   │ Settings │ Print Bed│
│ (code)   │ (orbit)  │   mode    │ (panel)  │ (arrange)│
└──────────┴──────────┘   switch  └──────────┴──────────┘
```

- Mode switch button in toolbar (existing WASM badge area)
- Print bed: flat Three.js plane, parts are draggable/rotatable
- Settings panel: layer height, infill, support options (fed to PrusaSlicer)
- Slice button: Electron only, shells out to `prusa-slicer-console.exe --export-gcode`

---

## Architecture Decisions (do not revisit)

1. **Custom interpreter is DEAD** — do not improve `interpreter.js` beyond tokenizer
2. **openscad-wasm is the render engine** — `src/forge3d/openscad.worker.js`
3. **No external UI libraries** — all styling inline in JSX
4. **Web Workers for heavy computation** — WASM runs in worker, never on main thread
5. **Electron for desktop features** (LSP, PrusaSlicer, native file dialogs)
6. **Browser mode still works** for basic editing + rendering (no LSP, no slicer)

---

## Key File Map

```
src/
  Forge3D.jsx                 # All UI state, mode switching, build orchestration
  forge3d/
    openscad.worker.js        # ⭐ WASM render worker (primary render path)
    stl-parser.js             # Binary + ASCII STL → Three.js BufferGeometry data
    renderer.js               # Three.js scene builder (useThreeRenderer hook)
    editor.jsx                # Code editor with syntax highlight + LSP squiggles (TODO)
    interpreter.js            # LEGACY — tokenizer only (syntax highlight), not for rendering
    lsp-client.js             # TODO — LSP JSON-RPC client hook
    workspace.js              # localStorage persistence + file I/O
    exporter.js               # Scene → binary STL export
electron/
  main.mjs                    # Electron main: window, menus, file dialogs, LSP spawn (TODO)
  preload.cjs                 # IPC bridge: forgeAPI.* exposed to renderer
  bin/
    openscad-language-server.exe  # TODO — copy from VS Code extension
docs/
  DEVPLAN.md                  # ← this file
  WORKFLOW.md                 # UX spec for Design ↔ Print Mode
  ARCHITECTURE.md             # Technical architecture deep-dive
Samples/
  magnetic_letter_only.scad   # User's primary test file — fridge magnet letters
```

---

## User Context

- **Name**: monro (Windows 11)
- **Goal**: Print fridge magnet letters with embedded magnet pockets for family/home use
- **Pain point**: Desktop OpenSCAD is clunky, no integrated print workflow
- **Style**: Values speed and results over process. Dislikes half-measures. Direct communication.
- **Other agents**: "OPENCLAW" — another AI assistant the user works with
- **Fonts**: Uses `"Liberation Sans:style=Bold"` (WASM-compatible). Previously used Comic Sans MS which is not available in WASM sandbox.
