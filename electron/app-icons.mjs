import fs from 'node:fs'
import path from 'node:path'

export function getAppIconPath({ appRoot, isPackaged, platform = process.platform }) {
  const name = platform === 'win32' ? 'icon.ico' : 'icon.png'
  const iconPath = path.join(appRoot, isPackaged ? 'dist' : 'public', name)
  return fs.existsSync(iconPath) ? iconPath : undefined
}

// BrowserWindow's icon does not brand the macOS Dock when using the stock
// Electron executable. Call after app.whenReady(); packaged apps keep their
// native bundle icon and do not need a runtime override.
export function setDevelopmentDockIcon({ app, appRoot, platform = process.platform }) {
  if (platform !== 'darwin' || app.isPackaged || typeof app.dock?.setIcon !== 'function') return false
  const iconPath = getAppIconPath({ appRoot, isPackaged: false, platform })
  if (!iconPath) return false
  try {
    app.dock.setIcon(iconPath)
    return true
  } catch (error) {
    console.warn('[Forge3D] Could not set development Dock icon:', error.message)
    return false
  }
}
