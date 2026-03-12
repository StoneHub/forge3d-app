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

  // Native OpenSCAD render (Electron-only)
  renderOpenSCAD: (code) => ipcRenderer.invoke('openscad:render', { code }),

  // LSP bridge (Electron-only)
  lspSend: (msg) => ipcRenderer.send('lsp-send', msg),
  onLspReceive: (cb) => {
    const handler = (_event, msg) => cb(msg)
    ipcRenderer.on('lsp-recv', handler)
    return () => ipcRenderer.removeListener('lsp-recv', handler)
  },
})
