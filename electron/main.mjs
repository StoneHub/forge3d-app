import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { spawn, execFile, spawnSync } from 'child_process'
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
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.1

function loadConfig() {
  try {
    if (fsSync.existsSync(CONFIG_PATH)) {
      return JSON.parse(fsSync.readFileSync(CONFIG_PATH, 'utf8'))
    }
  } catch (_) {}
  return { recentFiles: [], workspaceFolder: null, zoomFactor: 1 }
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

function clampZoomFactor(value) {
  if (!Number.isFinite(value)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
}

function getSavedZoomFactor() {
  return clampZoomFactor(loadConfig().zoomFactor ?? 1)
}

function getWindowZoomFactor(win) {
  if (!win?.webContents) return getSavedZoomFactor()
  return clampZoomFactor(win.webContents.getZoomFactor())
}

function safeSendToWindow(win, channel, ...args) {
  if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) return false
  try {
    win.webContents.send(channel, ...args)
    return true
  } catch (err) {
    console.warn(`[IPC] Failed to send ${channel}:`, err.message)
    return false
  }
}

function persistZoomFactor(zoomFactor) {
  const config = loadConfig()
  config.zoomFactor = clampZoomFactor(zoomFactor)
  saveConfig(config)
  return config.zoomFactor
}

function notifyZoomChange(win, zoomFactor = getWindowZoomFactor(win)) {
  safeSendToWindow(win, 'zoom:changed', clampZoomFactor(zoomFactor))
}

function setWindowZoomFactor(win, zoomFactor, { persist = true, notify = true } = {}) {
  const nextZoom = clampZoomFactor(zoomFactor)
  if (win?.webContents && !win.isDestroyed()) {
    win.webContents.setZoomFactor(nextZoom)
  }
  if (persist) persistZoomFactor(nextZoom)
  if (notify) notifyZoomChange(win, nextZoom)
  return nextZoom
}

function adjustWindowZoomFactor(win, delta, options) {
  return setWindowZoomFactor(win, getWindowZoomFactor(win) + delta, options)
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
        try { safeSendToWindow(win, 'lsp-recv', JSON.parse(body)) } catch (_) {}
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
let activeFileWatcher = null
let activeWatchedFilePath = null
let activeFileWatchTimer = null

function getWindowIconPath() {
  const iconName = process.platform === 'linux' ? 'icon.png' : 'icon.ico'
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', iconName)
    : path.join(__dirname, '..', 'dist', iconName)

  return fsSync.existsSync(iconPath) ? iconPath : undefined
}

function stopWatchingFile() {
  if (activeFileWatchTimer) {
    clearTimeout(activeFileWatchTimer)
    activeFileWatchTimer = null
  }
  if (activeFileWatcher) {
    try {
      activeFileWatcher.close()
    } catch (_) {}
    activeFileWatcher = null
  }
  activeWatchedFilePath = null
}

function watchFilePath(filePath) {
  stopWatchingFile()

  if (!filePath || !fsSync.existsSync(filePath)) {
    return { watching: false, filePath: null }
  }

  activeWatchedFilePath = filePath

  try {
    activeFileWatcher = fsSync.watch(filePath, { persistent: false }, (eventType) => {
      if (!activeWatchedFilePath) return
      if (activeFileWatchTimer) clearTimeout(activeFileWatchTimer)
      activeFileWatchTimer = setTimeout(() => {
        const watchedPath = activeWatchedFilePath
        const exists = fsSync.existsSync(watchedPath)
        safeSendToWindow(mainWin, 'file:changed', {
          filePath: watchedPath,
          eventType,
          exists,
        })
        if (!exists) {
          stopWatchingFile()
          return
        }
        watchFilePath(watchedPath)
      }, 120)
    })

    activeFileWatcher.on?.('error', (err) => {
      console.warn('[FileWatch] Watch error:', err.message)
      stopWatchingFile()
    })

    return { watching: true, filePath }
  } catch (err) {
    console.warn('[FileWatch] Failed to watch file:', err.message)
    stopWatchingFile()
    return { watching: false, filePath, error: err.message }
  }
}

function buildAppMenu() {
  const config = loadConfig()
  const recentSubmenu = config.recentFiles.length > 0
    ? [
        ...config.recentFiles.map(fp => ({
          label: fp,
          click: () => safeSendToWindow(mainWin, 'menu-action', `open-recent:${fp}`),
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

  const sendMenuAction = (action) => safeSendToWindow(mainWin, 'menu-action', action)

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
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => setWindowZoomFactor(mainWin, 1) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => adjustWindowZoomFactor(mainWin, ZOOM_STEP) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => adjustWindowZoomFactor(mainWin, -ZOOM_STEP) },
        { role: 'togglefullscreen' },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  const initialZoom = getSavedZoomFactor()
  const windowIcon = getWindowIconPath()
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Forge3D',
    backgroundColor: '#13141f',
    icon: windowIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWin = win
  buildAppMenu()
  setWindowZoomFactor(win, initialZoom, { persist: false, notify: false })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.webContents.on('did-finish-load', () => {
    notifyZoomChange(win, getWindowZoomFactor(win))
  })

  win.webContents.on('before-input-event', (event, input) => {
    const modifier = input.control || input.meta
    if (!modifier || input.alt || input.type !== 'keyDown') return

    const code = input.code || ''
    const key = input.key || ''

    if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
      event.preventDefault()
      setWindowZoomFactor(win, 1)
      return
    }

    if (key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract') {
      event.preventDefault()
      adjustWindowZoomFactor(win, -ZOOM_STEP)
      return
    }

    if (key === '+' || key === '=' || code === 'Equal' || code === 'NumpadAdd') {
      event.preventDefault()
      adjustWindowZoomFactor(win, ZOOM_STEP)
    }
  })

  spawnLSP(win)
}

function buildRenderPaths(sourcePath) {
  const ts = Date.now()
  const preferredDir = sourcePath && !String(sourcePath).includes('.asar')
    ? path.dirname(sourcePath)
    : os.tmpdir()

  return {
    inputPath: path.join(preferredDir, `.forge3d-preview-${ts}.scad`),
    outputPath: path.join(os.tmpdir(), `forge3d_${ts}.stl`),
  }
}

function buildRenderCommand(inputPath, outputPath) {
  return `"${OPENSCAD_BIN}" -o "${outputPath}" "${inputPath}"`
}

async function renderScadInput(inputPath, outputPath, { removeInput = false, cwd = undefined } = {}) {
  let execResult = { stdout: '', stderr: '' }
  let renderSucceeded = false

  try {
    execResult = await execFileAsync(OPENSCAD_BIN, ['-o', outputPath, inputPath], {
      cwd,
      timeout: 60000,
    })

    renderSucceeded = true

    return {
      stlBuffer: await fs.readFile(outputPath),
      stdout: execResult.stdout || '',
      stderr: execResult.stderr || '',
    }
  } finally {
    if (removeInput && renderSucceeded) {
      fs.unlink(inputPath).catch(() => {})
    }
    fs.unlink(outputPath).catch(() => {})
  }
}

function formatRenderFailure(err, { inputPath, sourceName = 'Current buffer' } = {}) {
  const replaceInputPath = (value) => {
    if (!value) return ''
    let next = String(value)
    if (inputPath) {
      next = next.split(inputPath).join(sourceName)
      next = next.split(path.basename(inputPath)).join(sourceName)
    }
    return next.trim()
  }

  const parts = [err?.stderr, err?.stdout, err?.message]
    .map(replaceInputPath)
    .filter(Boolean)

  return [...new Set(parts)].join('\n') || 'OpenSCAD render failed.'
}

async function renderScadCode(code, { sourceName = 'Current buffer', sourcePath = null } = {}) {
  const { inputPath, outputPath } = buildRenderPaths(sourcePath)
  const cwd = sourcePath && !String(sourcePath).includes('.asar')
    ? path.dirname(sourcePath)
    : undefined
  const startedAt = Date.now()

  try {
    await fs.writeFile(inputPath, code, 'utf8')
    const result = await renderScadInput(inputPath, outputPath, { removeInput: true, cwd })
    return {
      ...result,
      command: buildRenderCommand(inputPath, outputPath),
      elapsedMs: Date.now() - startedAt,
      debugSourcePath: null,
      sourceName,
    }
  } catch (err) {
    err.forgeMessage = formatRenderFailure(err, { inputPath, sourceName })
    err.command = buildRenderCommand(inputPath, outputPath)
    err.debugSourcePath = inputPath
    err.elapsedMs = Date.now() - startedAt
    throw err
  }
}
// ── File dialogs ─────────────────────────────────────────────────────────────
function buildCaptureFileName() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `forge3d-render-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`
}

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
  addRecentFile(filePath)
  buildAppMenu()
  return { filePath, name: path.basename(filePath) }
})

ipcMain.handle('assembly:importPart', async (_event, options = {}) => {
  const requestedKind = options?.kind === 'stl' || options?.kind === 'scad' ? options.kind : 'any'
  const extensions = requestedKind === 'stl'
    ? ['stl']
    : requestedKind === 'scad'
      ? ['scad']
      : ['scad', 'stl']

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: requestedKind === 'stl' ? 'Import STL Part' : requestedKind === 'scad' ? 'Import SCAD Part' : 'Import Assembly Part',
    filters: [
      { name: requestedKind === 'stl' ? 'STL files' : requestedKind === 'scad' ? 'SCAD files' : 'Assembly files', extensions },
      { name: 'All supported files', extensions: ['scad', 'stl'] },
    ],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]
  const extension = path.extname(filePath).toLowerCase()

  try {
    let stlBuffer = null
    let sourceKind = 'stl-file'

    if (extension === '.stl') {
      stlBuffer = await fs.readFile(filePath)
      sourceKind = 'stl-file'
    } else if (extension === '.scad') {
      stlBuffer = await renderScadInput(filePath, { cwd: path.dirname(filePath) })
      sourceKind = 'scad-file'
    } else {
      return { error: `Unsupported file type: ${extension}` }
    }

    addRecentFile(filePath)
    buildAppMenu()

    return {
      name: path.basename(filePath),
      source: {
        kind: sourceKind,
        filePath,
      },
      stl: Array.from(stlBuffer),
    }
  } catch (err) {
    return { error: err.stderr || err.stdout || err.message || String(err) }
  }
})

ipcMain.handle('assembly:openScene', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Assembly Scene',
    filters: [{ name: 'Forge3D Assembly Scene', extensions: ['json'] }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]
  const content = await fs.readFile(filePath, 'utf8')
  return { filePath, content, name: path.basename(filePath) }
})

ipcMain.handle('assembly:saveScene', async (_event, payload = {}) => {
  const { content = '', filePath: existingPath, suggestedName = 'assembly.forge3dscene.json' } = payload
  let filePath = existingPath

  if (!filePath) {
    const { canceled, filePath: chosenPath } = await dialog.showSaveDialog({
      title: 'Save Assembly Scene',
      defaultPath: suggestedName,
      filters: [{ name: 'Forge3D Assembly Scene', extensions: ['json'] }],
    })
    if (canceled || !chosenPath) return null
    filePath = chosenPath
  }

  await fs.writeFile(filePath, content, 'utf8')
  return { filePath, name: path.basename(filePath) }
})

ipcMain.handle('viewport:saveCapture', async (_event, payload = {}) => {
  const { dataUrl = '', preferredDir = null, suggestedName = buildCaptureFileName() } = payload
  const dataMatch = String(dataUrl).match(/^data:image\/png;base64,(.+)$/)
  if (!dataMatch) {
    return { error: 'Invalid PNG capture payload.' }
  }

  let filePath = null
  if (preferredDir && fsSync.existsSync(preferredDir)) {
    filePath = path.join(preferredDir, suggestedName)
  } else {
    const { canceled, filePath: chosenPath } = await dialog.showSaveDialog({
      title: 'Save Render Capture',
      defaultPath: path.join(app.getPath('pictures'), suggestedName),
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    })
    if (canceled || !chosenPath) return null
    filePath = chosenPath
  }

  await fs.writeFile(filePath, Buffer.from(dataMatch[1], 'base64'))
  return { filePath, name: path.basename(filePath) }
})

ipcMain.handle('system:openExternal', async (_event, url) => {
  if (!url) return false
  await shell.openExternal(url)
  return true
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

ipcMain.handle('file:readSnapshot', async (_event, filePath) => {
  try {
    const stats = await fs.stat(filePath)
    const content = await fs.readFile(filePath, 'utf8')
    return {
      exists: true,
      filePath,
      name: path.basename(filePath),
      content,
      mtimeMs: stats.mtimeMs,
    }
  } catch (err) {
    return {
      exists: false,
      filePath,
      error: err.message,
    }
  }
})

ipcMain.handle('file:watch', async (_event, filePath) => {
  return watchFilePath(filePath)
})

ipcMain.handle('file:unwatch', async () => {
  stopWatchingFile()
  return { watching: false }
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

// ── Zoom IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('zoom:get', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return getWindowZoomFactor(win)
})

ipcMain.handle('zoom:set', (event, zoomFactor) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return setWindowZoomFactor(win, zoomFactor)
})

ipcMain.handle('zoom:adjust', (event, delta = 0) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return adjustWindowZoomFactor(win, Number(delta) || 0)
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
ipcMain.handle('openscad:render', async (_event, { code, sourceName, sourcePath } = {}) => {
  try {
    const renderResult = await renderScadCode(code, { sourceName, sourcePath })
    // Return as a plain array so it survives IPC serialization
    return {
      stl: Array.from(renderResult.stlBuffer),
      stdout: renderResult.stdout,
      stderr: renderResult.stderr,
      command: renderResult.command,
      elapsedMs: renderResult.elapsedMs,
    }
  } catch (err) {
    const msg = err.forgeMessage || formatRenderFailure(err, { sourceName })
    return {
      error: msg,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      command: err.command || null,
      exitCode: Number.isInteger(err.code) ? err.code : null,
      debugSourcePath: err.debugSourcePath || null,
      elapsedMs: err.elapsedMs || null,
    }
  }
})

// ── Terminal PTY ────────────────────────────────────────────────────────────
let ptyProcess = null
let terminalSessionId = 0
let terminalState = {
  status: 'idle',
  pid: null,
  cwd: null,
  shellId: null,
  shellLabel: null,
  shellCommand: null,
  exitCode: null,
  error: null,
}

function emitTerminalState() {
  safeSendToWindow(mainWin, 'terminal:state', terminalState)
}

function resolveCommand(command) {
  if (!command) return null
  if (path.isAbsolute(command)) {
    return fsSync.existsSync(command) ? command : null
  }

  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], {
    encoding: 'utf8',
    windowsHide: true,
  })

  if (result.status !== 0) return null
  const resolved = result.stdout.split(/\r?\n/).find(Boolean)
  return resolved || null
}

function getShellLabel(command) {
  const normalized = path.basename(command).toLowerCase()
  if (normalized === 'powershell.exe') return 'Windows PowerShell'
  if (normalized === 'pwsh.exe') return 'PowerShell 7'
  if (normalized === 'cmd.exe') return 'Command Prompt'
  if (normalized === 'bash' || normalized === 'bash.exe') return 'Bash'
  if (normalized === 'zsh') return 'Zsh'
  if (normalized === 'sh') return 'Shell'
  return path.basename(command)
}

function getTerminalShells() {
  const envShell = process.env.SHELL
  const candidates = process.platform === 'win32'
    ? [
        { id: 'powershell', command: 'powershell.exe', args: ['-NoLogo'] },
        { id: 'pwsh', command: 'pwsh.exe', args: ['-NoLogo'] },
        { id: 'cmd', command: 'cmd.exe', args: [] },
        { id: 'git-bash', command: 'C:\\Program Files\\Git\\bin\\bash.exe', args: ['--login', '-i'] },
      ]
    : [
        ...(envShell ? [{ id: 'login-shell', command: envShell, args: [] }] : []),
        { id: 'zsh', command: '/bin/zsh', args: [] },
        { id: 'bash', command: '/bin/bash', args: [] },
        { id: 'sh', command: '/bin/sh', args: [] },
      ]

  const seen = new Set()
  return candidates.reduce((shells, candidate) => {
    const resolvedCommand = resolveCommand(candidate.command)
    if (!resolvedCommand || seen.has(resolvedCommand)) return shells
    seen.add(resolvedCommand)
    shells.push({
      id: candidate.id,
      label: getShellLabel(resolvedCommand),
      command: resolvedCommand,
      args: candidate.args || [],
    })
    return shells
  }, [])
}

function getTerminalStateSnapshot() {
  return { ...terminalState }
}

function normalizeTerminalCwd(requestedCwd) {
  if (requestedCwd && fsSync.existsSync(requestedCwd)) return requestedCwd
  const config = loadConfig()
  if (config.workspaceFolder && fsSync.existsSync(config.workspaceFolder)) return config.workspaceFolder
  return os.homedir()
}

async function ensureNodePty() {
  if (pty) return null
  try {
    pty = await import('node-pty')
    return null
  } catch (err) {
    const error = 'Terminal not available. node-pty failed to load. Try running: npm install --save-optional node-pty'
    console.warn('[Terminal] node-pty not available:', err.message)
    terminalState = {
      ...terminalState,
      status: 'error',
      pid: null,
      error,
    }
    emitTerminalState()
    return error
  }
}

async function spawnTerminalSession(options = {}) {
  const { cwd, forceRestart = false, shellId = null } = options
  const ptyError = await ensureNodePty()
  if (ptyError) {
    return { error: ptyError, state: getTerminalStateSnapshot() }
  }

  if (ptyProcess && !forceRestart) {
    return { success: true, reused: true, state: getTerminalStateSnapshot() }
  }

  if (ptyProcess && forceRestart) {
    try {
      ptyProcess.kill()
    } catch (_) {}
    ptyProcess = null
  }

  const shells = getTerminalShells()
  const shell = shells.find((candidate) => candidate.id === shellId) || shells[0]
  if (!shell) {
    terminalState = {
      ...terminalState,
      status: 'error',
      pid: null,
      error: 'No supported shell was detected on this system.',
    }
    emitTerminalState()
    return { error: terminalState.error, state: getTerminalStateSnapshot() }
  }

  const sessionId = ++terminalSessionId
  const workingDir = normalizeTerminalCwd(cwd)

  try {
    ptyProcess = pty.spawn(shell.command, shell.args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: process.env,
    })

    terminalState = {
      status: 'running',
      pid: ptyProcess.pid,
      cwd: workingDir,
      shellId: shell.id,
      shellLabel: shell.label,
      shellCommand: shell.command,
      exitCode: null,
      error: null,
    }
    emitTerminalState()

    ptyProcess.onData((data) => {
      if (sessionId !== terminalSessionId) return
      safeSendToWindow(mainWin, 'terminal:data', data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      if (sessionId !== terminalSessionId) return
      console.log('[Terminal] PTY exited with code', exitCode)
      ptyProcess = null
      terminalState = {
        ...terminalState,
        status: 'exited',
        pid: null,
        exitCode,
      }
      emitTerminalState()
    })

    console.log('[Terminal] Spawned PTY PID', ptyProcess.pid, 'in', workingDir)
    return { success: true, reused: false, state: getTerminalStateSnapshot() }
  } catch (err) {
    console.error('[Terminal] Failed to spawn PTY:', err.message)
    terminalState = {
      ...terminalState,
      status: 'error',
      pid: null,
      cwd: workingDir,
      shellId: shell.id,
      shellLabel: shell.label,
      shellCommand: shell.command,
      error: err.message,
    }
    emitTerminalState()
    return { error: err.message, state: getTerminalStateSnapshot() }
  }
}

ipcMain.handle('terminal:listShells', () => {
  const shells = getTerminalShells()
  return { shells, defaultShellId: shells[0]?.id || null }
})

ipcMain.handle('terminal:getState', () => getTerminalStateSnapshot())

ipcMain.handle('terminal:spawn', async (_event, options = {}) => {
  return spawnTerminalSession(options)
})

ipcMain.handle('terminal:restart', async (_event, options = {}) => {
  return spawnTerminalSession({ ...options, forceRestart: true })
})

ipcMain.handle('terminal:write', (_event, data) => {
  if (ptyProcess) {
    try {
      ptyProcess.write(data)
    } catch (err) {
      console.warn('[Terminal] Write failed:', err.message)
      terminalState = {
        ...terminalState,
        status: 'exited',
        pid: null,
        error: null,
      }
      ptyProcess = null
      emitTerminalState()
    }
  }
})

ipcMain.handle('terminal:resize', (_event, cols, rows) => {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows)
    } catch (err) {
      console.warn('[Terminal] Resize failed:', err.message)
      terminalState = {
        ...terminalState,
        status: 'exited',
        pid: null,
        error: null,
      }
      ptyProcess = null
      emitTerminalState()
    }
  }
})

ipcMain.handle('terminal:kill', () => {
  if (ptyProcess) {
    try {
      ptyProcess.kill()
    } catch (_) {}
    ptyProcess = null
    terminalState = {
      ...terminalState,
      status: 'exited',
      pid: null,
      exitCode: null,
      error: null,
    }
    emitTerminalState()
  }
  return getTerminalStateSnapshot()
})

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  stopWatchingFile()
  if (lspProcess) { lspProcess.kill(); lspProcess = null }
  if (ptyProcess) { ptyProcess.kill(); ptyProcess = null }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
