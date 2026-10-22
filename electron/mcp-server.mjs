#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { MAX_PENDING_CALLS, startStdioServer } from './mcp-protocol.mjs'

const require = createRequire(import.meta.url)
export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** One private IPC connection to one Electron session. No ports or shared tokens. */
export function createElectronBridge(child, {
  startupTimeoutMs = 60_000,
  callTimeoutMs = 6 * 60_000,
  shutdownGraceMs = 2000,
  onFatal = () => {},
} = {}) {
  let nextId = 0
  let ready = false
  let closed = false
  let fatalError = null
  let exited = false
  let shutdownTimer = null
  let killTimer = null
  let finish
  const finished = new Promise((resolve) => { finish = resolve })
  const pending = new Map()

  function rejectPending(error) {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
  }
  function finishShutdown() {
    clearTimeout(startupTimer)
    clearTimeout(shutdownTimer)
    clearTimeout(killTimer)
    finish()
  }
  function close(reason = new Error('Forge3D session closed')) {
    if (closed) return finished
    closed = true
    clearTimeout(startupTimer)
    rejectPending(reason)
    if (exited) { finishShutdown(); return finished }
    // Main owns renderer and native OpenSCAD cleanup; give it the first chance.
    try {
      if (child.connected) child.send({ type: 'forge3d:mcp:shutdown' }, () => {})
    } catch { /* The process may have already disconnected. */ }
    if (exited) return finished
    shutdownTimer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch { /* Already exited. */ }
      if (exited) return
      killTimer = setTimeout(() => {
        try { child.kill('SIGKILL') } catch { /* Already exited. */ }
      }, shutdownGraceMs)
    }, shutdownGraceMs)
    return finished
  }
  function fail(error) {
    if (closed) return
    fatalError = error
    void close(error)
    onFatal(error)
  }
  function send(entry, id) {
    try {
      child.send({ type: 'forge3d:mcp:request', id, name: entry.name, arguments: entry.args }, (error) => {
        if (error) fail(new Error(`Forge3D IPC send failed: ${error.message}`))
      })
    } catch (error) {
      fail(new Error(`Forge3D IPC send failed: ${error.message}`))
    }
  }
  const startupTimer = setTimeout(() => fail(new Error(`Forge3D did not become ready within ${startupTimeoutMs} ms. Check the application and Electron's stderr output.`)), startupTimeoutMs)

  child.on('message', (message) => {
    if (closed || !message || typeof message !== 'object') return
    if (message.type === 'forge3d:mcp:ready') {
      if (ready) return
      ready = true
      clearTimeout(startupTimer)
      for (const [id, entry] of pending) send(entry, id)
      return
    }
    if (message.type !== 'forge3d:mcp:response') return
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.error) entry.reject(new Error(typeof message.error === 'string' ? message.error : message.error.message || 'Forge3D request failed'))
    else entry.resolve(message.result)
  })
  child.on('error', (error) => {
    fail(new Error(`Could not start Forge3D: ${error.message}`))
    // A failed spawn has no exit event or process to shut down.
    if (!child.pid) { exited = true; finishShutdown() }
  })
  child.on('exit', (code, signal) => {
    exited = true
    fail(new Error(`Forge3D exited (${signal || `code ${code}`})`))
    finishShutdown()
  })
  child.on('disconnect', () => fail(new Error('Forge3D IPC connection was lost')))

  return {
    finished,
    close,
    get error() { return fatalError },
    callTool(name, args) {
      if (closed) return Promise.reject(fatalError || new Error('Forge3D session closed'))
      if (pending.size >= MAX_PENDING_CALLS) return Promise.reject(new Error('Too many pending Forge3D requests'))
      const id = `mcp-${++nextId}`
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          // Abort the session, not just the Promise: a timed-out queued edit must
          // never mutate the document later after the client retries it.
          fail(new Error(`Forge3D tool ${name} timed out after ${callTimeoutMs} ms. The isolated session is shutting down; the operation may have completed. Reconnect and inspect before retrying.`))
        }, callTimeoutMs)
        const entry = { name, args, timer, resolve, reject }
        pending.set(id, entry)
        if (ready) send(entry, id)
      })
    },
  }
}

export function launchMcpServer({
  input = process.stdin,
  output = process.stdout,
  diagnostics = process.stderr,
  electronPath,
  appPath,
  appRoot = APP_ROOT,
  env = process.env,
  spawnProcess = spawn,
  bridgeOptions = {},
} = {}) {
  if (appPath !== undefined && electronPath !== undefined) throw new Error('--app and --electron are mutually exclusive')
  if (appPath !== undefined && (typeof appPath !== 'string' || !path.isAbsolute(appPath) || appPath.includes('\0'))) throw new Error('--app requires an absolute path to the packaged Forge3D executable')
  // The companion ZIP has no npm dependencies. Resolve Electron only when
  // launching a source checkout, never when an installed app was selected.
  const executable = appPath ?? electronPath ?? require('electron')
  const args = appPath === undefined ? [appRoot] : []
  const serverVersion = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')).version
  const childEnv = { ...env, FORGE3D_MCP_CHILD: '1', FORGE3D_SKIP_START_PREVIEWS: '1' }
  delete childEnv.ELECTRON_RUN_AS_NODE
  const child = spawnProcess(executable, args, {
    cwd: appRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], shell: false,
  })
  // Electron and native tools are chatty. Stdout belongs exclusively to MCP.
  child.stdout?.pipe(diagnostics, { end: false })
  child.stderr?.pipe(diagnostics, { end: false })
  let server
  const bridge = createElectronBridge(child, {
    ...bridgeOptions,
    onFatal(error) {
      diagnostics.write(`[Forge3D MCP] ${error.message}\n`)
      // Let pending request rejections produce their MCP error result first.
      setImmediate(() => server?.close(error))
    },
  })
  server = startStdioServer({
    input, output, serverVersion,
    callTool: (name, args) => bridge.callTool(name, args),
    onClose: (reason) => { void bridge.close(reason) },
  })
  return { child, close: server.close, finished: bridge.finished, get error() { return bridge.error } }
}

export function parseLauncherArgs(argv) {
  let electronPath
  let appPath
  let help = false
  for (let i = 0; i < argv.length; i++) {
    const option = argv[i]
    if (option === '--help' || option === '-h') help = true
    else if ((option === '--electron' || option === '--app') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      if (electronPath !== undefined || appPath !== undefined) throw new Error('Specify only one --app or --electron option; they are mutually exclusive')
      const executable = argv[++i]
      if (executable.includes('\0')) throw new Error(`${option} requires a valid executable path`)
      if (option === '--app') {
        if (!path.isAbsolute(executable)) throw new Error('--app requires an absolute path to the packaged Forge3D executable')
        appPath = executable
      } else electronPath = path.resolve(executable)
    } else throw new Error(`Unknown or incomplete option: ${option}`)
  }
  return { electronPath, appPath, help }
}

async function main() {
  const { help, electronPath, appPath } = parseLauncherArgs(process.argv.slice(2))
  if (help) {
    process.stderr.write('Forge3D MCP stdio server\nUsage: node electron/mcp-server.mjs [--electron /path/to/electron | --app /absolute/path/to/Forge3D]\nSource mode: install dependencies and run npm run build first.\nPackaged mode (--app): Node.js and the matching installed Forge3D app; no npm install or dist build required.\nStarts a new isolated visible Forge3D session.\n')
    return
  }
  if (appPath !== undefined) {
    let executable
    try { executable = fs.statSync(appPath) } catch { throw new Error(`Packaged Forge3D executable not found: ${appPath}`) }
    if (!executable.isFile()) throw new Error('--app must point to the executable file, not a directory or .app bundle. On macOS use Forge3D.app/Contents/MacOS/Forge3D.')
  } else if (!fs.existsSync(path.join(APP_ROOT, 'dist', 'index.html'))) throw new Error('Renderer build not found. Run npm run build before starting Forge3D MCP, or use --app with an installed Forge3D executable.')
  const server = launchMcpServer({ electronPath, appPath })
  const stop = () => server.close()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  await server.finished
  process.removeListener('SIGINT', stop)
  process.removeListener('SIGTERM', stop)
  if (server.error) process.exitCode = 1
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`[Forge3D MCP] ${error.message}\n`)
    process.exitCode = 1
  })
}
