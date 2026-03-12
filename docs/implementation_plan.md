# Embedded Terminal Pane

Embed a real terminal (PowerShell on Windows, bash on Linux/macOS) inside Forge3D, opening to the workspace folder.

## Dependencies

- `xterm` — terminal UI renderer
- `@xterm/addon-fit` — auto-resize terminal to container
- `node-pty` — spawn real PTY shell processes

> [!IMPORTANT]
> `node-pty` is a **native module** that needs to be rebuilt for Electron's Node version. We'll need `@electron/rebuild` and a build step. If this causes issues, we can fall back to `child_process.spawn` (works but loses some terminal features like colors in some programs).

## Proposed Changes

### Dependencies
#### [MODIFY] [package.json](file:///c:/Users/monro/Codex/forge3d-app/package.json)
- Add: `xterm`, `@xterm/addon-fit`, `node-pty`
- Add: `@electron/rebuild` as devDependency
- Add script: `"postinstall": "electron-rebuild"` to auto-rebuild native modules

---

### Electron Main Process
#### [MODIFY] [main.mjs](file:///c:/Users/monro/Codex/forge3d-app/electron/main.mjs)
- Import `node-pty` (or fallback to `child_process.spawn` if unavailable)
- IPC handlers:
  - `terminal:spawn` — create PTY with shell, CWD = workspace folder (or home dir)
  - `terminal:write` — send keystrokes from renderer to PTY stdin
  - `terminal:resize` — resize PTY cols/rows
  - `terminal:kill` — kill the PTY process
- Send PTY output back to renderer via `win.webContents.send('terminal:data', data)`
- Clean up PTY on window close

### Preload Bridge
#### [MODIFY] [preload.cjs](file:///c:/Users/monro/Codex/forge3d-app/electron/preload.cjs)
- `spawnTerminal(cwd?)` → invoke `terminal:spawn`
- `writeTerminal(data)` → send `terminal:write`
- `resizeTerminal(cols, rows)` → invoke `terminal:resize`
- `killTerminal()` → invoke `terminal:kill`
- `onTerminalData(cb)` → listen for `terminal:data`

---

### Terminal UI Component
#### [NEW] [terminal.jsx](file:///c:/Users/monro/Codex/forge3d-app/src/forge3d/terminal.jsx)
- Initializes `xterm.js` Terminal + FitAddon
- On mount: calls `forgeAPI.spawnTerminal(cwd)` 
- Pipes `xterm.onData` → `forgeAPI.writeTerminal`
- Pipes `forgeAPI.onTerminalData` → `xterm.write`
- On resize: calls FitAddon.fit() + `forgeAPI.resizeTerminal(cols, rows)`
- Clean up on unmount

### Layout Integration  
#### [MODIFY] [Forge3D.jsx](file:///c:/Users/monro/Codex/forge3d-app/src/Forge3D.jsx)
- Add `terminalOpen` state (default: false)
- Add `>_ Terminal` toggle button in toolbar
- When open: render `<TerminalPane>` in the bottom panel (replacing or tabbed with Console/Problems)
- New bottom panel tab: `>_ Terminal` alongside Console and Problems
- Terminal CWD = workspace folder if set, otherwise app path

---

### Terminal CSS
#### [NEW] [terminal.css](file:///c:/Users/monro/Codex/forge3d-app/src/forge3d/terminal.css)
- Import xterm.js base CSS
- Dark theme overrides to match Forge3D color scheme

## Verification Plan

### Manual
- `npm run dev` → Electron launches
- Click `>_ Terminal` button → terminal pane appears in bottom panel
- Type [ls](file:///c:/Users/monro/Codex/forge3d-app/electron/preload.cjs#27-29) or `dir` → see workspace files listed
- Terminal auto-scrolls, colors work, resize works
- Close terminal tab → PTY process is killed
