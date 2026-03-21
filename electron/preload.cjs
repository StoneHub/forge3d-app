const { contextBridge, ipcRenderer, clipboard } = require('electron')

contextBridge.exposeInMainWorld('forgeAPI', {
  // File dialogs
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action)
    ipcRenderer.on('menu-action', handler)
    return () => ipcRenderer.removeListener('menu-action', handler)
  },
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (payload) => ipcRenderer.invoke('dialog:saveFile', payload),
  saveStlFile: (payload) => ipcRenderer.invoke('dialog:saveStlFile', payload),
  openFilePath: (filePath) => ipcRenderer.invoke('file:openPath', filePath),
  readFileSnapshot: (filePath) => ipcRenderer.invoke('file:readSnapshot', filePath),
  watchFile: (filePath) => ipcRenderer.invoke('file:watch', filePath),
  unwatchFile: () => ipcRenderer.invoke('file:unwatch'),
  importAssemblyPart: (options) => ipcRenderer.invoke('assembly:importPart', options),
  openAssemblyScene: () => ipcRenderer.invoke('assembly:openScene'),
  saveAssemblyScene: (payload) => ipcRenderer.invoke('assembly:saveScene', payload),

  // Zoom controls
  getZoomFactor: () => ipcRenderer.invoke('zoom:get'),
  setZoomFactor: (factor) => ipcRenderer.invoke('zoom:set', factor),
  adjustZoomFactor: (delta) => ipcRenderer.invoke('zoom:adjust', delta),
  onZoomChanged: (cb) => {
    const handler = (_event, zoomFactor) => cb(zoomFactor)
    ipcRenderer.on('zoom:changed', handler)
    return () => ipcRenderer.removeListener('zoom:changed', handler)
  },

  // Recent files
  getRecentFiles: () => ipcRenderer.invoke('recentFiles:get'),
  addRecentFile: (filePath) => ipcRenderer.invoke('recentFiles:add', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('recentFiles:clear'),

  // Workspace folder
  getWorkspaceFolder: () => ipcRenderer.invoke('workspace:getFolder'),
  setWorkspaceFolder: () => ipcRenderer.invoke('workspace:setFolder'),
  listWorkspaceFiles: () => ipcRenderer.invoke('workspace:listFiles'),

  // Native OpenSCAD render (Electron-only)
  renderOpenSCAD: (code, options = {}) => ipcRenderer.invoke('openscad:render', { code, ...options }),

  // LSP bridge (Electron-only)
  lspSend: (msg) => ipcRenderer.send('lsp-send', msg),
  onLspReceive: (cb) => {
    const handler = (_event, msg) => cb(msg)
    ipcRenderer.on('lsp-recv', handler)
    return () => ipcRenderer.removeListener('lsp-recv', handler)
  },

  // Terminal bridge (Electron-only)
  listTerminalShells: () => ipcRenderer.invoke('terminal:listShells'),
  getTerminalState: () => ipcRenderer.invoke('terminal:getState'),
  spawnTerminal: (options) => ipcRenderer.invoke('terminal:spawn', options),
  restartTerminal: (options) => ipcRenderer.invoke('terminal:restart', options),
  writeTerminal: (data) => ipcRenderer.invoke('terminal:write', data),
  resizeTerminal: (cols, rows) => ipcRenderer.invoke('terminal:resize', cols, rows),
  killTerminal: () => ipcRenderer.invoke('terminal:kill'),
  onTerminalData: (cb) => {
    const handler = (_event, data) => cb(data)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },
  onTerminalState: (cb) => {
    const handler = (_event, state) => cb(state)
    ipcRenderer.on('terminal:state', handler)
    return () => ipcRenderer.removeListener('terminal:state', handler)
  },

  // Viewport capture
  saveViewportCapture: (payload) => ipcRenderer.invoke('viewport:saveCapture', payload),

  // System helpers
  openExternalUrl: (url) => ipcRenderer.invoke('system:openExternal', url),

  // Clipboard helpers
  readClipboardText: () => clipboard.readText(),
  writeClipboardText: (text) => clipboard.writeText(text || ''),

  // File sync events
  onFileChanged: (cb) => {
    const handler = (_event, payload) => cb(payload)
    ipcRenderer.on('file:changed', handler)
    return () => ipcRenderer.removeListener('file:changed', handler)
  },
})
