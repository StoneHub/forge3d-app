import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// ── OpenSCAD native binary ──────────────────────────────────────────────────
const OPENSCAD_BIN = 'C:\\Program Files\\OpenSCAD\\openscad.com'

// ── LSP process ────────────────────────────────────────────────────────────
let lspProcess = null

function spawnLSP(win) {
  const lspBin = isDev
    ? path.join(__dirname, 'bin', 'openscad-language-server.exe')
    : path.join(process.resourcesPath, 'bin', 'openscad-language-server.exe')

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
    lspProcess.on('exit', (code) => { console.log('[LSP] exited with code', code); lspProcess = null })

    ipcMain.on('lsp-send', (_event, msg) => {
      if (!lspProcess?.stdin?.writable) return
      const body = JSON.stringify(msg)
      lspProcess.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
    })

    console.log('[LSP] started PID', lspProcess.pid)
  } catch (err) {
    console.error('[LSP] failed to spawn:', err.message)
  }
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

  const sendMenuAction = (action) => win.webContents.send('menu-action', action)

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-file') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open-file') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save-file') },
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

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (lspProcess) { lspProcess.kill(); lspProcess = null }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
