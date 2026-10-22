import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { validateToolArguments } from './mcp-protocol.mjs'

// An inherited IPC channel, never a socket or a persistent listener. The
// launcher is the sole caller and owns this isolated app's lifetime.
export function installMcpBridge({ ipcMain, getWindow, sessionRoot, getNativeRender, shutdown, channel = process }) {
  let ready = false, hasBeenReady = false, closed = false, queue = Promise.resolve(), queued = 0
  const pending = new Map()
  const send = (message) => {
    try { if (channel.connected) channel.send(message, () => {}) } catch { /* Client already exited. */ }
  }
  const failPending = (message) => {
    ready = false
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(message)) }
    pending.clear()
  }
  const requestRenderer = (request) => new Promise((resolve, reject) => {
    const win = getWindow()
    if (!ready || !win || win.isDestroyed() || win.webContents.isDestroyed()) {
      reject(new Error('Forge3D model is not ready.')); return
    }
    const timer = setTimeout(() => {
      pending.delete(request.id)
      reject(new Error('Forge3D model request timed out; the isolated session is closing.'))
      shutdown()
    }, 330_000)
    pending.set(request.id, { resolve, reject, timer, sender: win.webContents })
    try { win.webContents.send('mcp:request', request) } catch (error) {
      clearTimeout(timer); pending.delete(request.id); reject(error)
    }
  })

  ipcMain.on('mcp:ready', (event) => {
    if (closed || event.sender !== getWindow()?.webContents) return
    ready = true
    hasBeenReady = true
    send({ type: 'forge3d:mcp:ready' })
  })
  ipcMain.on('mcp:response', (event, response) => {
    const entry = pending.get(response?.id)
    if (!entry || event.sender !== entry.sender) return
    pending.delete(response.id)
    clearTimeout(entry.timer)
    if (response.error) entry.reject(new Error(response.error))
    else entry.resolve(response.result)
  })

  const dispatch = async (message) => {
    try {
      validateToolArguments(message.name, message.arguments ?? {})
      const result = await requestRenderer({ id: message.id, name: message.name, arguments: message.arguments ?? {} })
      if (['forge3d_export_stl', 'forge3d_export_assembly_stl'].includes(message.name) && !result.isError) {
        let stlBuffer
        if (message.name === 'forge3d_export_stl') {
          const native = getNativeRender()
          if (!native || native.requestId !== result.nativeRenderRequestId) throw new Error('The native render changed. Render the current model again before exporting.')
          stlBuffer = native.stlBuffer
        } else {
          if (typeof result.assemblyStlContent !== 'string' || !result.assemblyStlContent.startsWith('solid ') || Buffer.byteLength(result.assemblyStlContent, 'utf8') > 128 * 1024 * 1024) throw new Error('Invalid or oversized assembly STL output.')
          stlBuffer = Buffer.from(result.assemblyStlContent, 'utf8')
        }
        const directory = path.join(sessionRoot, 'exports')
        await fs.mkdir(directory, { recursive: true })
        const filename = message.arguments?.filename || 'model.stl'
        // A unique prefix plus exclusive creation avoids overwriting any file.
        const filePath = path.join(directory, `${randomUUID()}-${filename}`)
        await fs.writeFile(filePath, stlBuffer, { flag: 'wx' })
        send({ type: 'forge3d:mcp:response', id: message.id, result: {
          content: [{ type: 'text', text: JSON.stringify({ ...result.model, filePath, bytes: stlBuffer.length }) }],
        } })
      } else send({ type: 'forge3d:mcp:response', id: message.id, result })
    } catch (error) {
      send({ type: 'forge3d:mcp:response', id: message.id, result: {
        isError: true, content: [{ type: 'text', text: error.message }],
      } })
    }
  }

  channel.on('message', (message) => {
    if (message?.type === 'forge3d:mcp:shutdown') { closed = true; failPending('MCP client disconnected.'); shutdown(); return }
    if (message?.type !== 'forge3d:mcp:request' || closed) return
    if (queued >= 32) {
      send({ type: 'forge3d:mcp:response', id: message.id, error: 'Too many pending model requests.' }); return
    }
    queued++
    queue = queue.then(() => closed ? undefined : dispatch(message)).finally(() => { queued-- })
  })
  channel.on('disconnect', () => { closed = true; failPending('MCP client disconnected.'); shutdown() })
  return {
    watchWindow(win) {
      win.webContents.on('did-start-loading', () => {
        failPending('Forge3D reloaded. Reconnect to a fresh session before editing.')
        // Revisions are renderer-scoped. Never reuse an old revision namespace
        // after reload, even when localStorage restores an identical buffer.
        if (hasBeenReady) { closed = true; shutdown() }
      })
      win.webContents.on('render-process-gone', () => { failPending('Forge3D renderer exited.'); shutdown() })
      win.on('closed', () => { failPending('Forge3D window closed.'); shutdown() })
    },
  }
}
