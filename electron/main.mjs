import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'

// ── node-pty import (with fallback) ─────────────────────────────────────────
let pty = null

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// ── OpenSCAD native binary ──────────────────────────────────────────────────
const OPENSCAD_BIN = 'C:\\Program Files\\OpenSCAD\\openscad.com'

// ── Config (userData JSON) ──────────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'forge3d-config.json')
const MAX_RECENT_FILES = 10

function loadConfig() {
  try {
    if (fsSync.existsSync(CONFIG_PATH)) {
      return JSON.parse(fsSync.readFileSync(CONFIG_PATH, 'utf8'))
    }
  } catch (_) {}
  return { recentFiles: [], workspaceFolder: null }
}

function saveConfig(config) {
  try {
    fsSync.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Config] Failed to save:', err.message)
  }
}

function addRecentFile(filePath) {
  const config = loadConfig()
  // Remove duplicate if exists, then prepend
  config.recentFiles = [filePath, ...config.recentFiles.filter(f => f !== filePath)].slice(0, MAX_RECENT_FILES)
  saveConfig(config)
  return config.recentFiles
}

// ── LSP process ────────────────────────────────────────────────────────────
let lspProcess = null
let lspIpcRegistered = false

function getLspBinaryPath() {
  if (process.platform !== 'win32') return null
  return isDev
    ? path.join(__dirname, 'bin', 'openscad-language-server.exe')
    : path.join(process.resourcesPath, 'bin', 'openscad-language-server.exe')
}

function spawnLSP(win) {
  const lspBin = getLspBinaryPath()

  if (!lspBin) {
    console.warn(`[LSP] Disabled on unsupported platform: ${process.platform}/${process.arch}`)
    return
  }

  if (!fsSync.existsSync(lspBin)) {
    console.warn('[LSP] Binary not found:', lspBin)
    return
  }

  try {
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

    lspProcess.stderr.on('data', (d) => console.warn('[LSP stderr]', d.toString()))
    lspProcess.on('error', (err) => {
      console.warn('[LSP] spawn error:', err.message)
      lspProcess = null
    })
    lspProcess.on('exit', (code) => { console.log('[LSP] exited with code', code); lspProcess = null })

    if (!lspIpcRegistered) {
      ipcMain.on('lsp-send', (_event, msg) => {
        if (!lspProcess?.stdin?.writable) return
        const body = JSON.stringify(msg)
        lspProcess.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
      })
      lspIpcRegistered = true
    }

    console.log('[LSP] started PID', lspProcess.pid)
  } catch (err) {
    console.warn('[LSP] failed to spawn:', err.message)
  }
}

// ── Dynamic menu builder ────────────────────────────────────────────────────
let mainWin = null

function buildAppMenu() {
  const config = loadConfig()
  const recentSubmenu = config.recentFiles.length > 0
    ? [
        ...config.recentFiles.map(fp => ({
          label: fp,
          click: () => mainWin?.webContents.send('menu-action', `open-recent:${fp}`),
        })),
        { type: 'separator' },
        { label: 'Clear Recent Files', click: () => {
          const cfg = loadConfig()
          cfg.recentFiles = []
          saveConfig(cfg)
          buildAppMenu() // Rebuild menu
        }},
      ]
    : [{ label: 'No recent files', enabled: false }]

  const sendMenuAction = (action) => mainWin?.webContents.send('menu-action', action)

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-file') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open-file') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save-file') },
        { type: 'separator' },
        { label: 'Recent Files', submenu: recentSubmenu },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Forge3D',
    backgroundColor: '#13141f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWin = win
  buildAppMenu()

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  spawnLSP(win)
}

// ── File dialogs ─────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open SCAD file',
    filters: [{ name: 'SCAD files', extensions: ['scad', 'txt'] }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]
  const content = await fs.readFile(filePath, 'utf8')
  // Auto-add to recent files
  addRecentFile(filePath)
  buildAppMenu()
  return { filePath, content, name: path.basename(filePath) }
})

ipcMain.handle('dialog:saveFile', async (_event, payload = {}) => {
  const { content = '', filePath: existingPath, suggestedName = 'model.scad' } = payload
  let filePath = existingPath

  if (!filePath) {
    const { canceled, filePath: chosenPath } = await dialog.showSaveDialog({
      title: 'Save SCAD file',
      defaultPath: suggestedName,
      filters: [{ name: 'SCAD files', extensions: ['scad'] }],
    })
    if (canceled || !chosenPath) return null
    filePath = chosenPath
  }

  await fs.writeFile(filePath, content, 'utf8')
  return { filePath, name: path.basename(filePath) }
})

ipcMain.handle('dialog:saveStlFile', async (_event, payload = {}) => {
  const { content = '', filePath: existingPath, suggestedName = 'model.stl' } = payload
  let filePath = existingPath

  if (!filePath) {
    const { canceled, filePath: chosenPath } = await dialog.showSaveDialog({
      title: 'Export STL',
      defaultPath: suggestedName,
      filters: [{ name: 'STL files', extensions: ['stl'] }],
    })
    if (canceled || !chosenPath) return null
    filePath = chosenPath
  }

  await fs.writeFile(filePath, content, 'utf8')
  return { filePath, name: path.basename(filePath) }
})

// ── Open a specific file by path (for recent files / workspace) ─────────────
ipcMain.handle('file:openPath', async (_event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    addRecentFile(filePath)
    buildAppMenu()
    return { filePath, content, name: path.basename(filePath) }
  } catch (err) {
    return { error: err.message }
  }
})

// ── Recent files IPC ────────────────────────────────────────────────────────
ipcMain.handle('recentFiles:get', () => {
  const config = loadConfig()
  // Filter out files that no longer exist
  const valid = config.recentFiles.filter(f => fsSync.existsSync(f))
  if (valid.length !== config.recentFiles.length) {
    config.recentFiles = valid
    saveConfig(config)
    buildAppMenu()
  }
  return valid
})

ipcMain.handle('recentFiles:add', (_event, filePath) => {
  const updated = addRecentFile(filePath)
  buildAppMenu()
  return updated
})

ipcMain.handle('recentFiles:clear', () => {
  const config = loadConfig()
  config.recentFiles = []
  saveConfig(config)
  buildAppMenu()
  return []
})

// ── Workspace folder IPC ────────────────────────────────────────────────────
ipcMain.handle('workspace:getFolder', () => {
  const config = loadConfig()
  return config.workspaceFolder || null
})

ipcMain.handle('workspace:setFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Workspace Folder',
    properties: ['openDirectory'],
  })
  if (canceled || filePaths.length === 0) return null
  const folderPath = filePaths[0]
  console.log('[Workspace] Folder set to:', folderPath)
  const config = loadConfig()
  config.workspaceFolder = folderPath
  saveConfig(config)
  return folderPath
})

async function scanScadFiles(dir, baseDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  let results = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results = results.concat(await scanScadFiles(fullPath, baseDir))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.scad')) {
      results.push({
        name: entry.name,
        relativePath: path.relative(baseDir, fullPath),
        fullPath,
      })
    }
  }
  return results
}

ipcMain.handle('workspace:listFiles', async () => {
  const config = loadConfig()
  console.log('[Workspace] Listing files in:', config.workspaceFolder)
  if (!config.workspaceFolder) return []
  try {
    const files = await scanScadFiles(config.workspaceFolder, config.workspaceFolder)
    console.log('[Workspace] Found', files.length, 'scad files:', files.map(f => f.name))
    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  } catch (err) {
    console.warn('[Workspace] Failed to list files:', err.message)
    return []
  }
})

// ── Native OpenSCAD render ────────────────────────────────────────────────────
ipcMain.handle('openscad:render', async (_event, { code }) => {
  const ts = Date.now()
  const inputPath = path.join(os.tmpdir(), `forge3d_${ts}.scad`)
  const outputPath = path.join(os.tmpdir(), `forge3d_${ts}.stl`)

  try {
    await fs.writeFile(inputPath, code, 'utf8')

    await execFileAsync(OPENSCAD_BIN, ['-o', outputPath, inputPath], {
      timeout: 60000,
    })

    const stlBuffer = await fs.readFile(outputPath)
    // Return as a plain array so it survives IPC serialization
    return { stl: Array.from(stlBuffer) }
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message || String(err)
    return { error: msg }
  } finally {
    // Clean up temp files (best-effort)
    fs.unlink(inputPath).catch(() => {})
    fs.unlink(outputPath).catch(() => {})
  }
})

// ── Terminal PTY ────────────────────────────────────────────────────────────
let ptyProcess = null

ipcMain.handle('terminal:spawn', async (_event, cwd) => {
  // Lazy-load node-pty (only when terminal is actually opened)
  if (!pty) {
    try {
      pty = await import('node-pty')
    } catch (err) {
      console.warn('[Terminal] node-pty not available:', err.message)
      return { error: 'Terminal not available. node-pty failed to load. Try running: npm install --save-optional node-pty' }
    }
  }

  const config = loadConfig()
  const workingDir = cwd || config.workspaceFolder || os.homedir()
  const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'

  try {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: process.env,
    })

    ptyProcess.onData((data) => {
      mainWin?.webContents.send('terminal:data', data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      console.log('[Terminal] PTY exited with code', exitCode)
      ptyProcess = null
    })

    console.log('[Terminal] Spawned PTY PID', ptyProcess.pid, 'in', workingDir)
    return { success: true, pid: ptyProcess.pid }
  } catch (err) {
    console.error('[Terminal] Failed to spawn PTY:', err.message)
    return { error: err.message }
  }
})

ipcMain.handle('terminal:write', (_event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data)
  }
})

ipcMain.handle('terminal:resize', (_event, cols, rows) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows)
  }
})

ipcMain.handle('terminal:kill', () => {
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcess = null
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (lspProcess) { lspProcess.kill(); lspProcess = null }
  if (ptyProcess) { ptyProcess.kill(); ptyProcess = null }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
