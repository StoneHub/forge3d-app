import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { installMcpBridge } from '../electron/mcp-bridge.mjs'
import * as THREE from 'three'
import { createAssemblyPart } from '../src/forge3d/assembly.js'
import { exportMcpAssemblyStl } from '../src/forge3d/mcp-assembly.js'
import { parseSTL } from '../src/forge3d/stl-parser.js'

async function until(predicate, label = 'bridge event') {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return
    await delay(5)
  }
  assert.fail(`Timed out waiting for ${label}`)
}
const textResult = (text) => ({ content: [{ type: 'text', text }] })

async function fixture(t) {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'forge3d-mcp-bridge-test-'))
  const ipcMain = new EventEmitter()
  const channel = new EventEmitter()
  channel.connected = true
  channel.sent = []
  channel.send = (message, callback) => { channel.sent.push(message); callback?.() }
  const webContents = new EventEmitter()
  webContents.sent = []
  webContents.isDestroyed = () => false
  webContents.send = (name, message) => webContents.sent.push({ name, message })
  const window = new EventEmitter()
  window.webContents = webContents
  window.isDestroyed = () => false
  let native = { requestId: 'render-1', stlBuffer: Buffer.from('solid native\nendsolid native\n') }
  let shutdowns = 0
  let nextId = 0
  const bridge = installMcpBridge({
    ipcMain, getWindow: () => window, sessionRoot,
    getNativeRender: () => native,
    shutdown: () => { shutdowns++ }, channel,
  })
  bridge.watchWindow(window)
  t.after(async () => {
    channel.emit('message', { type: 'forge3d:mcp:shutdown' })
    await delay(0)
    await fs.rm(sessionRoot, { recursive: true, force: true })
  })
  return {
    ipcMain, channel, webContents, window, sessionRoot,
    get shutdowns() { return shutdowns },
    setNative: (value) => { native = value },
    ready: (sender = webContents) => ipcMain.emit('mcp:ready', { sender }),
    request(name = 'forge3d_get_model', args = {}) {
      const id = `request-${++nextId}`
      channel.emit('message', { type: 'forge3d:mcp:request', id, name, arguments: args })
      return id
    },
    respond(id, result, sender = webContents) { ipcMain.emit('mcp:response', { sender }, { id, result }) },
    fail(id, error) { ipcMain.emit('mcp:response', { sender: webContents }, { id, error }) },
    response(id) { return channel.sent.find((message) => message.type === 'forge3d:mcp:response' && message.id === id) },
    async waitForResponse(id) { await until(() => this.response(id)); return this.response(id) },
  }
}

test('main bridge allows initial loading, ignores untrusted readiness, and waits for its own renderer', async (t) => {
  const f = await fixture(t)
  f.window.webContents.emit('did-start-loading')
  assert.equal(f.shutdowns, 0)
  f.ready(new EventEmitter())
  assert.equal(f.channel.sent.length, 0)
  const notReady = f.request()
  assert.equal((await f.waitForResponse(notReady)).result.isError, true)
  assert.equal(f.webContents.sent.length, 0)
  f.ready()
  assert.equal(f.channel.sent.at(-1).type, 'forge3d:mcp:ready')
  const id = f.request()
  await until(() => f.webContents.sent.length === 1)
  assert.equal(f.webContents.sent[0].name, 'mcp:request')
  f.respond(id, textResult('ready'))
  assert.deepEqual((await f.waitForResponse(id)).result, textResult('ready'))
})

test('main bridge serializes calls and continues the queue after renderer errors', async (t) => {
  const f = await fixture(t)
  f.ready()
  const first = f.request('forge3d_set_code', { code: 'cube(2);', expectedRevision: 0 })
  const second = f.request('forge3d_render', { profile: 'final' })
  await until(() => f.webContents.sent.length === 1)
  await delay(5)
  assert.equal(f.webContents.sent.length, 1)
  assert.equal(f.webContents.sent[0].message.id, first)
  f.fail(first, 'Model changed; read current revision')
  await until(() => f.webContents.sent.length === 2)
  assert.equal((await f.waitForResponse(first)).result.isError, true)
  assert.equal(f.webContents.sent[1].message.id, second)
  f.respond(second, textResult('rendered'))
  assert.deepEqual((await f.waitForResponse(second)).result, textResult('rendered'))
})

test('main bridge rejects forged response senders and unknown response IDs', async (t) => {
  const f = await fixture(t)
  f.ready()
  const id = f.request()
  await until(() => f.webContents.sent.length === 1)
  f.respond(id, textResult('forged'), new EventEmitter())
  f.respond('unknown-id', textResult('unsolicited'))
  await delay(5)
  assert.equal(f.response(id), undefined)
  f.respond(id, textResult('trusted'))
  assert.deepEqual((await f.waitForResponse(id)).result, textResult('trusted'))
})

test('reload after readiness closes the revision namespace and ignores later commands/readiness', async (t) => {
  const f = await fixture(t)
  f.ready()
  const active = f.request()
  const queued = f.request('forge3d_set_code', { code: 'cube(9);', expectedRevision: 0 })
  await until(() => f.webContents.sent.length === 1)
  f.webContents.emit('did-start-loading')
  assert.equal(f.shutdowns, 1)
  const error = await f.waitForResponse(active)
  assert.equal(error.result.isError, true)
  assert.match(error.result.content[0].text, /reloaded/)
  const readyMessages = f.channel.sent.filter((message) => message.type === 'forge3d:mcp:ready').length
  f.ready()
  f.request('forge3d_set_code', { code: 'cube(99);', expectedRevision: 0 })
  await delay(5)
  assert.equal(f.webContents.sent.length, 1)
  assert.equal(f.response(queued), undefined)
  assert.equal(f.channel.sent.filter((message) => message.type === 'forge3d:mcp:ready').length, readyMessages)
})

test('shutdown and disconnect reject active work, stop queued edits, and invoke app cleanup', async (t) => {
  for (const trigger of ['shutdown', 'disconnect']) {
    const f = await fixture(t)
    f.ready()
    const active = f.request()
    f.request('forge3d_set_code', { code: 'cube(99);', expectedRevision: 0 })
    await until(() => f.webContents.sent.length === 1)
    if (trigger === 'shutdown') f.channel.emit('message', { type: 'forge3d:mcp:shutdown' })
    else f.channel.emit('disconnect')
    assert.equal(f.shutdowns, 1)
    assert.match((await f.waitForResponse(active)).result.content[0].text, /disconnected/)
    f.request()
    await delay(5)
    assert.equal(f.webContents.sent.length, 1)
  }
})

test('renderer crash and window close fail pending work and shut down the isolated app', async (t) => {
  for (const trigger of ['render-process-gone', 'closed']) {
    const f = await fixture(t)
    f.ready()
    const id = f.request()
    await until(() => f.webContents.sent.length === 1)
    if (trigger === 'closed') f.window.emit('closed')
    else f.webContents.emit('render-process-gone')
    assert.equal(f.shutdowns, 1)
    assert.equal((await f.waitForResponse(id)).result.isError, true)
  }
})

test('native STL exports use exact bytes, unique session paths, and exclusive creation', async (t) => {
  const f = await fixture(t)
  f.ready()
  const nativeBytes = Buffer.from([0, 1, 2, 3, 0xff, 0, 10])
  f.setNative({ requestId: 'render-1', stlBuffer: nativeBytes })
  const writeOptions = []
  const writeFile = fs.writeFile
  t.mock.method(fs, 'writeFile', async (file, data, options) => {
    writeOptions.push(options)
    return writeFile(file, data, options)
  })
  const exported = []
  for (let i = 0; i < 2; i++) {
    const id = f.request('forge3d_export_stl', { filename: 'part.stl' })
    await until(() => f.webContents.sent.length === i + 1)
    f.respond(id, { nativeRenderRequestId: 'render-1', model: { revision: 4, triangles: 12 } })
    const result = (await f.waitForResponse(id)).result
    assert.notEqual(result.isError, true)
    const artifact = JSON.parse(result.content[0].text)
    assert.equal(path.dirname(artifact.filePath), path.join(f.sessionRoot, 'exports'))
    assert.match(path.basename(artifact.filePath), /^[0-9a-f-]+-part\.stl$/)
    assert.equal(artifact.bytes, nativeBytes.length)
    assert.equal(artifact.revision, 4)
    assert.equal(artifact.triangles, 12)
    assert.deepEqual(await fs.readFile(artifact.filePath), nativeBytes)
    exported.push(artifact.filePath)
  }
  assert.notEqual(exported[0], exported[1])
  assert.deepEqual(writeOptions, [{ flag: 'wx' }, { flag: 'wx' }])
  assert.deepEqual(await fs.readFile(exported[0]), nativeBytes)
})

test('export refuses stale/missing native output and preserves renderer errors without writing', async (t) => {
  const f = await fixture(t)
  f.ready()
  for (const [index, native] of [null, { requestId: 'different-render', stlBuffer: Buffer.from('wrong') }].entries()) {
    f.setNative(native)
    const id = f.request('forge3d_export_stl', { filename: 'part.stl' })
    await until(() => f.webContents.sent.length === index + 1)
    f.respond(id, { nativeRenderRequestId: 'render-1', model: { revision: 4 } })
    const result = (await f.waitForResponse(id)).result
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, /native render changed/)
  }
  const id = f.request('forge3d_export_stl', {})
  await until(() => f.webContents.sent.length === 3)
  f.respond(id, { ...textResult('Need a current final render'), isError: true })
  assert.equal((await f.waitForResponse(id)).result.isError, true)
  await assert.rejects(fs.access(path.join(f.sessionRoot, 'exports')), { code: 'ENOENT' })
})

test('main validates path/revision/tool arguments independently before renderer dispatch', async (t) => {
  const f = await fixture(t)
  f.ready()
  for (const args of [{ filename: '../outside.stl' }, { filename: 'x\\outside.stl' }, { filename: 'outside.obj' }, { filename: 'é'.repeat(100) + '.stl' }, { filename: 'part.stl', directory: '/tmp' }]) {
    const id = f.request('forge3d_export_stl', args)
    assert.equal((await f.waitForResponse(id)).result.isError, true)
  }
  const invalidRevision = f.request('forge3d_set_code', { code: 'cube(2);', expectedRevision: -1 })
  assert.equal((await f.waitForResponse(invalidRevision)).result.isError, true)
  const unknown = f.request('forge3d_run_shell', {})
  assert.equal((await f.waitForResponse(unknown)).result.isError, true)
  assert.equal(f.webContents.sent.length, 0)
  await assert.rejects(fs.access(path.join(f.sessionRoot, 'exports')), { code: 'ENOENT' })
})

test('main bounds its own serialized request queue independently of the launcher', async (t) => {
  const f = await fixture(t)
  f.ready()
  for (let i = 0; i < 32; i++) f.request()
  const overflow = f.request()
  assert.match((await f.waitForResponse(overflow)).error, /Too many pending/)
  await until(() => f.webContents.sent.length === 1)
  assert.equal(f.webContents.sent.length, 1)
})

test('assembly exports write actual transformed STL bytes with exclusive unique paths and explicit selection', async (t) => {
  const f = await fixture(t)
  f.ready()
  // Assembly export must not depend on the Design native-render cache.
  f.setNative(null)
  const scene = { parts: [
    createAssemblyPart({ id: 'chosen', geometry: new THREE.BoxGeometry(10, 20, 30).toNonIndexed(), transform: { position: [40, 50, -60] } }),
    createAssemblyPart({ id: 'excluded', geometry: new THREE.BoxGeometry(20, 20, 20).toNonIndexed(), transform: { position: [1000, 1000, 1000] } }),
  ] }
  const stl = exportMcpAssemblyStl(scene, ['chosen'])
  const exported = []
  const writes = []
  const writeFile = fs.writeFile
  t.mock.method(fs, 'writeFile', async (file, data, options) => { writes.push(options); return writeFile(file, data, options) })
  for (let i = 0; i < 2; i++) {
    const id = f.request('forge3d_export_assembly_stl', { expectedRevision: 7, filename: 'assembly.stl', partIds: ['chosen'] })
    await until(() => f.webContents.sent.length === i + 1)
    assert.deepEqual(f.webContents.sent.at(-1).message.arguments.partIds, ['chosen'])
    f.respond(id, { assemblyStlContent: stl, model: { revision: 7, parts: 1, triangles: 12 } })
    const result = (await f.waitForResponse(id)).result
    assert.notEqual(result.isError, true)
    const artifact = JSON.parse(result.content[0].text)
    assert.equal(path.dirname(artifact.filePath), path.join(f.sessionRoot, 'exports'))
    assert.equal(artifact.revision, 7)
    assert.equal(artifact.parts, 1)
    const bytes = await fs.readFile(artifact.filePath)
    assert.deepEqual(bytes, Buffer.from(stl))
    const parsed = parseSTL(bytes)
    assert.equal(parsed.vertices.length / 9, 12)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(parsed.vertices, 3))
    geometry.computeBoundingBox()
    assert.deepEqual(geometry.boundingBox.min.toArray(), [35, 45, 40])
    assert.deepEqual(geometry.boundingBox.max.toArray(), [45, 75, 60])
    exported.push(artifact.filePath)
  }
  assert.notEqual(exported[0], exported[1])
  assert.deepEqual(writes, [{ flag: 'wx' }, { flag: 'wx' }])
})

test('assembly export rejects stale renderer revision and malformed output without creating files', async (t) => {
  const f = await fixture(t)
  f.ready()
  const stale = f.request('forge3d_export_assembly_stl', { expectedRevision: 2 })
  await until(() => f.webContents.sent.length === 1)
  f.fail(stale, 'Assembly changed (current revision 3). Read forge3d_get_assembly before editing.')
  const staleResult = (await f.waitForResponse(stale)).result
  assert.equal(staleResult.isError, true)
  assert.match(staleResult.content[0].text, /current revision 3/)
  for (const [index, assemblyStlContent] of [undefined, 'not an STL', Buffer.from('solid x')].entries()) {
    const id = f.request('forge3d_export_assembly_stl', { expectedRevision: 3 })
    await until(() => f.webContents.sent.length === index + 2)
    f.respond(id, { assemblyStlContent, model: { revision: 3 } })
    assert.equal((await f.waitForResponse(id)).result.isError, true)
  }
  await assert.rejects(fs.access(path.join(f.sessionRoot, 'exports')), { code: 'ENOENT' })
})

test('main independently validates assembly/print arguments before IPC and file writes', async (t) => {
  const f = await fixture(t)
  f.ready()
  const invalid = [
    ['forge3d_export_assembly_stl', { expectedRevision: 0, filename: '../escape.stl' }],
    ['forge3d_export_assembly_stl', { expectedRevision: 0, partIds: ['a', 'a'] }],
    ['forge3d_export_assembly_stl', { filename: 'assembly.stl' }],
    ['forge3d_update_assembly_part', { expectedRevision: 0, partId: 'a', transform: { scale: [1, -1, 1] } }],
    ['forge3d_prepare_print', { expectedRevision: 0, bed: { widthMm: 10001, depthMm: 100, heightMm: 100 } }],
    ['forge3d_prepare_print', { expectedRevision: 0, bed: { widthMm: 100, depthMm: 100, heightMm: 100 }, spacingMm: 1001 }],
  ]
  for (const [name, args] of invalid) {
    const id = f.request(name, args)
    assert.equal((await f.waitForResponse(id)).result.isError, true)
  }
  assert.equal(f.webContents.sent.length, 0)
  await assert.rejects(fs.access(path.join(f.sessionRoot, 'exports')), { code: 'ENOENT' })
})
