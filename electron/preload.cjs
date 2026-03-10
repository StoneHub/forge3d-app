const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('forgeAPI', {
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action)
    ipcRenderer.on('menu-action', handler)
    return () => ipcRenderer.removeListener('menu-action', handler)
  },
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (payload) => ipcRenderer.invoke('dialog:saveFile', payload),
})
