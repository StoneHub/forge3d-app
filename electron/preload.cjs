const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('forgeAPI', {
  // File dialogs
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action)
    ipcRenderer.on('menu-action', handler)
    return () => ipcRenderer.removeListener('menu-action', handler)
  },
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (payload) => ipcRenderer.invoke('dialog:saveFile', payload),
  openFilePath: (filePath) => ipcRenderer.invoke('file:openPath', filePath),

  // Recent files
  getRecentFiles: () => ipcRenderer.invoke('recentFiles:get'),
  addRecentFile: (filePath) => ipcRenderer.invoke('recentFiles:add', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('recentFiles:clear'),

  // Workspace folder
  getWorkspaceFolder: () => ipcRenderer.invoke('workspace:getFolder'),
  setWorkspaceFolder: () => ipcRenderer.invoke('workspace:setFolder'),
  listWorkspaceFiles: () => ipcRenderer.invoke('workspace:listFiles'),

  // Native OpenSCAD render (Electron-only)
  renderOpenSCAD: (code) => ipcRenderer.invoke('openscad:render', { code }),

  // LSP bridge (Electron-only)
  lspSend: (msg) => ipcRenderer.send('lsp-send', msg),
  onLspReceive: (cb) => {
    const handler = (_event, msg) => cb(msg)
    ipcRenderer.on('lsp-recv', handler)
    return () => ipcRenderer.removeListener('lsp-recv', handler)
  },

  // Terminal bridge (Electron-only)
  spawnTerminal: (cwd) => ipcRenderer.invoke('terminal:spawn', cwd),
  writeTerminal: (data) => ipcRenderer.invoke('terminal:write', data),
  resizeTerminal: (cols, rows) => ipcRenderer.invoke('terminal:resize', cols, rows),
  killTerminal: () => ipcRenderer.invoke('terminal:kill'),
  onTerminalData: (cb) => {
    const handler = (_event, data) => cb(data)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },
})
