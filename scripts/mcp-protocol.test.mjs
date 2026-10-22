import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import {
  MAX_CODE_BYTES, MAX_PENDING_CALLS, PROTOCOL_VERSIONS, TOOL_DEFINITIONS,
  createMcpProtocol, startStdioServer, validateToolArguments,
} from '../electron/mcp-protocol.mjs'
import { APP_ROOT, createElectronBridge, launchMcpServer, parseLauncherArgs } from '../electron/mcp-server.mjs'

const request = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })
const init = (version = '2025-11-25', id = 0) => request(id, 'initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 'test', version: '1' } })
const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' }
const textResult = (text = 'ok') => ({ content: [{ type: 'text', text }] })
async function readyProtocol(callTool = async () => textResult(), version) {
  const protocol = createMcpProtocol({ callTool })
  await protocol.handle(init(version))
  await protocol.handle(initialized)
  return protocol
}
async function until(predicate, label = 'condition') {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return
    await delay(5)
  }
  assert.fail(`Timed out waiting for ${label}`)
}
function capture(stream) {
  const chunks = []
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  return () => Buffer.concat(chunks).toString('utf8')
}
function stdioFixture(t, options = {}) {
  const input = new PassThrough()
  const output = new PassThrough()
  const outputText = capture(output)
  const closed = []
  const server = startStdioServer({ input, output, callTool: async () => textResult(), onClose: (reason) => closed.push(reason), ...options })
  t.after(() => { server.close(); input.destroy(); output.destroy() })
  return { input, output, outputText, server, closed, messages: () => outputText().split('\n').filter(Boolean).map(JSON.parse) }
}

class MockChild extends EventEmitter {
  constructor({ exitOnShutdown = true, exitOnKill = true } = {}) {
    super()
    this.pid = 123
    this.connected = true
    this.stdout = new PassThrough()
    this.stderr = new PassThrough()
    this.sent = []
    this.kills = []
    this.exitOnShutdown = exitOnShutdown
    this.exitOnKill = exitOnKill
  }
  send(message, callback) {
    this.sent.push(message)
    queueMicrotask(() => callback?.(null))
    if (message.type === 'forge3d:mcp:shutdown' && this.exitOnShutdown) queueMicrotask(() => this.exit(0))
  }
  kill(signal) {
    this.kills.push(signal)
    if (this.exitOnKill) queueMicrotask(() => this.exit(null, signal))
    return true
  }
  exit(code, signal = null) {
    this.connected = false
    this.emit('exit', code, signal)
    this.stdout.end()
    this.stderr.end()
  }
}
function bridgeFixture(t, options = {}, childOptions) {
  const child = new MockChild(childOptions)
  const errors = []
  const bridge = createElectronBridge(child, { onFatal: (error) => errors.push(error), ...options })
  t.after(async () => { await bridge.close() })
  return { child, bridge, errors }
}

test('initialize negotiates all supported protocol versions and preserves request id zero', async () => {
  for (const version of PROTOCOL_VERSIONS) {
    const protocol = createMcpProtocol({ callTool: async () => textResult(), serverVersion: '9.0.1' })
    const response = await protocol.handle(init(version))
    assert.equal(response.id, 0)
    assert.equal(response.result.protocolVersion, version)
    assert.deepEqual(response.result.capabilities, { tools: { listChanged: false } })
    assert.deepEqual(response.result.serverInfo, { name: 'forge3d', version: '9.0.1' })
    assert.match(response.result.instructions, /not your already-open app/)
    assert.match(response.result.instructions, /read local files/)
  }
  const protocol = createMcpProtocol({ callTool: async () => textResult() })
  assert.equal((await protocol.handle(init('2099-01-01'))).result.protocolVersion, PROTOCOL_VERSIONS[0])
})

test('lifecycle gates tools, accepts ping, ignores notifications, and rejects repeated initialize', async () => {
  let calls = 0
  const protocol = createMcpProtocol({ callTool: async () => { calls++; return textResult() } })
  assert.deepEqual((await protocol.handle(request('ping', 'ping'))).result, {})
  assert.equal((await protocol.handle(request(1, 'tools/list'))).error.code, -32002)
  await protocol.handle(init())
  assert.equal((await protocol.handle(request(2, 'tools/list'))).error.code, -32002)
  assert.equal(await protocol.handle({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'forge3d_get_model' } }), null)
  assert.equal(calls, 0)
  assert.equal(await protocol.handle(initialized), null)
  assert.equal((await protocol.handle(request(3, 'tools/list'))).result.tools.length, 6)
  assert.equal((await protocol.handle(init())).error.code, -32600)
  assert.equal(await protocol.handle({ jsonrpc: '2.0', method: 'notifications/something-new' }), null)
  assert.equal(await protocol.handle({ jsonrpc: '2.0', id: 99, result: {} }), null)
})

test('tool discovery exposes conservative annotations and strict schemas', async () => {
  const protocol = await readyProtocol()
  const { result } = await protocol.handle(request('list', 'tools/list'))
  assert.deepEqual(result.tools.map((tool) => tool.name), TOOL_DEFINITIONS.map((tool) => tool.name))
  for (const tool of result.tools) {
    assert.equal(tool.inputSchema.additionalProperties, false)
    assert.equal(tool.annotations.readOnlyHint, ['forge3d_get_model', 'forge3d_capture_viewport'].includes(tool.name))
    if (!tool.annotations.readOnlyHint) assert.equal(tool.annotations.destructiveHint, true)
  }
  const old = await readyProtocol(undefined, '2024-11-05')
  assert.equal('annotations' in (await old.handle(request(1, 'tools/list'))).result.tools[0], false)
  assert.equal((await protocol.handle(request(2, 'tools/list', { cursor: 'invalid' }))).error.code, -32602)
})

test('invalid JSON-RPC, initialize params, methods and tool arguments return protocol errors', async () => {
  const fresh = createMcpProtocol({ callTool: async () => textResult() })
  assert.equal((await fresh.handle(request(1, 'initialize', {}))).error.code, -32602)
  const protocol = await readyProtocol()
  for (const malformed of [null, 3, 'bad', {}, { jsonrpc: '1.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: null, method: 'ping' }, { jsonrpc: '2.0', id: true, method: 'ping' }, { jsonrpc: '2.0', id: 1.5, method: 'ping' }, { jsonrpc: '2.0', id: Number.MAX_SAFE_INTEGER + 1, method: 'ping' }]) {
    assert.equal((await protocol.handle(malformed)).error.code, -32600)
  }
  assert.equal((await protocol.handle(request(1, 'unknown'))).error.code, -32601)
  assert.equal((await protocol.handle(request(2, 'tools/call', []))).error.code, -32602)
  assert.equal((await protocol.handle(request(3, 'tools/call', { name: 'shell' }))).error.code, -32602)
  assert.equal((await protocol.handle(request(4, 'tools/call', { name: 'forge3d_set_code', arguments: { code: 'cube(1);' } }))).result.isError, true)
})

test('tool validation rejects traversal, unexpected properties, bad revisions and unsafe parameter values', () => {
  for (const filename of ['../cube.stl', '..\\cube.stl', '/tmp/cube.stl', 'C:\\cube.stl', 'bad\0.stl', 'cube.obj', '.stl', 'cube:1.stl', 'cube?.stl', 'a'.repeat(201) + '.stl', 'é'.repeat(99) + '.stl']) {
    assert.throws(() => validateToolArguments('forge3d_export_stl', { filename }), { code: -32602 })
  }
  for (const expectedRevision of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
    assert.throws(() => validateToolArguments('forge3d_set_code', { code: '', expectedRevision }), { code: -32602 })
  }
  for (const args of [null, [], { filePath: '/tmp/x' }]) assert.throws(() => validateToolArguments('forge3d_get_model', args), { code: -32602 })
  for (const values of [[], [{ id: 'x', value: null }], [{ id: 'x', value: {} }], [{ id: 'x', value: Infinity }], [{ id: '', value: 1 }], [{ id: 'x', value: 1 }, { id: 'x', value: 2 }], [{ id: 'x', value: 1, extra: true }]]) {
    assert.throws(() => validateToolArguments('forge3d_set_parameters', { values, expectedRevision: 0 }), { code: -32602 })
  }
  assert.throws(() => validateToolArguments('forge3d_set_code', { code: 'é'.repeat(MAX_CODE_BYTES / 2 + 1), expectedRevision: 0 }), { code: -32602 })
  assert.throws(() => validateToolArguments('forge3d_render', { profile: 'best' }), { code: -32602 })
  assert.deepEqual(validateToolArguments('forge3d_render'), { profile: 'final' })
  assert.deepEqual(validateToolArguments('forge3d_export_stl', { filename: 'bracket.STL' }), { filename: 'bracket.STL' })
  const args = { values: [{ id: 'x', value: false }], expectedRevision: 0 }
  assert.deepEqual(validateToolArguments('forge3d_set_parameters', args), args)
  assert.notEqual(validateToolArguments('forge3d_set_parameters', args).values, args.values)
})

test('tool calls forward MCP text/image/error envelopes unchanged and normalize defaults', async () => {
  const results = [textResult('model'), { content: [{ type: 'image', data: 'AA==', mimeType: 'image/png' }] }, { ...textResult('revision conflict'), isError: true }]
  const calls = []
  const protocol = await readyProtocol(async (name, args) => { calls.push({ name, args }); return results[calls.length - 1] })
  for (const [index, name] of ['forge3d_get_model', 'forge3d_capture_viewport', 'forge3d_render'].entries()) {
    assert.deepEqual((await protocol.handle(request(index + 1, 'tools/call', { name }))).result, results[index])
  }
  assert.deepEqual(calls[2].args, { profile: 'final' })
  const broken = await readyProtocol(async () => { throw new Error('native renderer unavailable') })
  const response = await broken.handle(request(1, 'tools/call', { name: 'forge3d_render' }))
  assert.equal(response.result.isError, true)
  assert.equal(response.error, undefined)
  assert.match(response.result.content[0].text, /native renderer unavailable/)
  const invalid = await readyProtocol(async () => undefined)
  assert.equal((await invalid.handle(request(1, 'tools/call', { name: 'forge3d_get_model' }))).result.isError, true)
})

test('batches are supported only in 2025-03-26 and never for initialization', async () => {
  const fresh = createMcpProtocol({ callTool: async () => textResult() })
  assert.equal((await fresh.handle([init('2025-03-26')])).error.code, -32600)
  const protocol = await readyProtocol(undefined, '2025-03-26')
  const response = await protocol.handle([request(1, 'ping'), { jsonrpc: '2.0', method: 'notifications/ignored' }, request(2, 'tools/list')])
  assert.deepEqual(response.map((reply) => reply.id), [1, 2])
  assert.equal(await protocol.handle([{ jsonrpc: '2.0', method: 'notifications/ignored' }]), null)
  assert.equal((await protocol.handle([])).error.code, -32600)
  assert.equal((await protocol.handle([init()])).error.code, -32600)
  for (const version of ['2024-11-05', '2025-06-18', '2025-11-25']) {
    const other = await readyProtocol(undefined, version)
    assert.equal((await other.handle([request(1, 'ping')])).error.code, -32600)
  }
})

test('concurrent requests are correlated and duplicate ids/pending-call overflow are rejected', async () => {
  const resolves = []
  const protocol = await readyProtocol(() => new Promise((resolve) => resolves.push(resolve)))
  const requests = Array.from({ length: MAX_PENDING_CALLS }, (_, i) => protocol.handle(request(i, 'tools/call', { name: 'forge3d_get_model' })))
  assert.equal((await protocol.handle(request(0, 'tools/call', { name: 'forge3d_get_model' }))).error.code, -32600)
  assert.equal((await protocol.handle(request(99, 'tools/call', { name: 'forge3d_get_model' }))).error.code, -32000)
  resolves.forEach((resolve, i) => resolve(textResult(`response ${i}`)))
  const replies = await Promise.all(requests)
  assert.deepEqual(replies.map((reply) => reply.id), Array.from({ length: MAX_PENDING_CALLS }, (_, i) => i))
  assert.equal((await protocol.handle(request(0, 'ping'))).error, undefined)
})

test('stdio handles fragmented and coalesced newline frames including split UTF-8 and CRLF', async (t) => {
  const calls = []
  const f = stdioFixture(t, { callTool: async (name, args) => { calls.push(args); return textResult('line one\nline two') } })
  const encoded = Buffer.from([JSON.stringify(init()), JSON.stringify(initialized), JSON.stringify(request('unicode', 'tools/call', { name: 'forge3d_set_code', arguments: { code: '// café\ncube(1);', expectedRevision: 0 } }))].join('\r\n') + '\r\n')
  const multibyte = encoded.indexOf(Buffer.from('é'))
  f.input.write(encoded.subarray(0, 4))
  f.input.write(encoded.subarray(4, multibyte + 1))
  f.input.write(encoded.subarray(multibyte + 1))
  await until(() => f.messages().length === 2)
  assert.equal(calls[0].code, '// café\ncube(1);')
  assert.equal(f.messages()[1].id, 'unicode')
  assert.equal(f.messages()[1].result.content[0].text, 'line one\nline two')
  assert.equal(f.outputText().split('\n').length, 3)
})

test('stdio recovers after malformed JSON or invalid UTF-8 without writing non-JSON logs', async (t) => {
  const f = stdioFixture(t)
  f.input.write('{bad json}\n')
  f.input.write(Buffer.from([0xff, 0x0a]))
  f.input.write(`${JSON.stringify(request(0, 'ping'))}\n`)
  await until(() => f.messages().length === 3)
  assert.deepEqual(f.messages().slice(0, 2).map((response) => response.error.code), [-32700, -32700])
  assert.equal(f.messages()[2].id, 0)
})

test('oversized incomplete stdio frames close the session with a bounded error', async (t) => {
  const f = stdioFixture(t, { maxMessageBytes: 32 })
  f.input.write('a'.repeat(20))
  f.input.write('a'.repeat(20))
  assert.equal(f.messages()[0].error.code, -32600)
  assert.equal(f.closed.length, 1)
  f.input.write(`${JSON.stringify(request(1, 'ping'))}\n`)
  await delay(5)
  assert.equal(f.messages().length, 1)
})

test('EOF and output errors close stdio once and suppress late tool responses', async (t) => {
  let resolveTool
  const f = stdioFixture(t, { callTool: () => new Promise((resolve) => { resolveTool = resolve }) })
  f.input.write(`${JSON.stringify(init())}\n${JSON.stringify(initialized)}\n${JSON.stringify(request(1, 'tools/call', { name: 'forge3d_get_model' }))}\n`)
  await until(() => resolveTool)
  f.input.end()
  await until(() => f.closed.length)
  resolveTool(textResult())
  f.output.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }))
  await delay(5)
  assert.equal(f.closed.length, 1)
  assert.equal(f.messages().length, 1)
})

test('Electron bridge waits for renderer ready, correlates out-of-order responses, and ignores stale ids', async (t) => {
  const { child, bridge } = bridgeFixture(t)
  const first = bridge.callTool('forge3d_get_model', {})
  const second = bridge.callTool('forge3d_render', { profile: 'final' })
  assert.equal(child.sent.length, 0)
  child.emit('message', { type: 'forge3d:mcp:ready' })
  assert.deepEqual(child.sent.map((message) => message.id), ['mcp-1', 'mcp-2'])
  child.emit('message', { type: 'forge3d:mcp:response', id: 'missing', result: textResult('ignored') })
  child.emit('message', { type: 'forge3d:mcp:response', id: 'mcp-2', result: textResult('second') })
  child.emit('message', { type: 'forge3d:mcp:response', id: 'mcp-1', result: textResult('first') })
  assert.deepEqual(await first, textResult('first'))
  assert.deepEqual(await second, textResult('second'))
  child.emit('message', { type: 'forge3d:mcp:ready' })
  assert.equal(child.sent.length, 2)
})

test('Electron bridge reports application errors and UI close/crashes without hanging', async (t) => {
  const { child, bridge, errors } = bridgeFixture(t)
  child.emit('message', { type: 'forge3d:mcp:ready' })
  const applicationError = bridge.callTool('forge3d_render', {})
  child.emit('message', { type: 'forge3d:mcp:response', id: 'mcp-1', error: { message: 'OpenSCAD missing' } })
  await assert.rejects(applicationError, /OpenSCAD missing/)
  const pending = bridge.callTool('forge3d_get_model', {})
  child.exit(1)
  await assert.rejects(pending, /Forge3D exited/)
  await bridge.finished
  await assert.rejects(bridge.callTool('forge3d_get_model', {}), /Forge3D exited/)
  assert.equal(errors.length, 1)
})

test('startup timeout and tool timeout shut down the session instead of allowing late mutations', async (t) => {
  const first = bridgeFixture(t, { startupTimeoutMs: 10 })
  await assert.rejects(first.bridge.callTool('forge3d_get_model', {}), /did not become ready/)
  await first.bridge.finished
  assert.equal(first.child.sent.at(-1).type, 'forge3d:mcp:shutdown')
  const second = bridgeFixture(t, { callTimeoutMs: 10 })
  second.child.emit('message', { type: 'forge3d:mcp:ready' })
  await assert.rejects(second.bridge.callTool('forge3d_set_code', { code: 'cube(1);', expectedRevision: 0 }), /operation may have completed/)
  await second.bridge.finished
  assert.equal(second.child.sent.at(-1).type, 'forge3d:mcp:shutdown')
  await assert.rejects(second.bridge.callTool('forge3d_get_model', {}), /timed out/)
})

test('shutdown tries IPC cleanup first, then SIGTERM and SIGKILL when the child ignores it', async (t) => {
  const { child, bridge } = bridgeFixture(t, { shutdownGraceMs: 10 }, { exitOnShutdown: false, exitOnKill: false })
  const closing = bridge.close()
  assert.equal(child.sent.at(-1).type, 'forge3d:mcp:shutdown')
  assert.deepEqual(child.kills, [])
  await until(() => child.kills.length === 2)
  assert.deepEqual(child.kills, ['SIGTERM', 'SIGKILL'])
  child.exit(null, 'SIGKILL')
  await closing
})

test('spawn and IPC failures reject pending requests and terminate cleanly', async (t) => {
  const first = bridgeFixture(t)
  const pending = first.bridge.callTool('forge3d_get_model', {})
  first.child.pid = undefined
  first.child.emit('error', new Error('ENOENT'))
  await assert.rejects(pending, /Could not start Forge3D: ENOENT/)
  await first.bridge.finished
  const second = bridgeFixture(t)
  second.child.emit('message', { type: 'forge3d:mcp:ready' })
  second.child.send = (message, callback) => {
    if (message.type === 'forge3d:mcp:shutdown') { second.child.exit(0); return }
    callback(new Error('IPC disconnected'))
  }
  await assert.rejects(second.bridge.callTool('forge3d_get_model', {}), /IPC send failed/)
  await second.bridge.finished
})

test('launcher uses shell-free isolated child IPC and routes all child logs to stderr', async (t) => {
  const child = new MockChild()
  const input = new PassThrough()
  const output = new PassThrough()
  const diagnostics = new PassThrough()
  const stdout = capture(output)
  const stderr = capture(diagnostics)
  let launch
  const server = launchMcpServer({
    input, output, diagnostics, electronPath: '/path with spaces/electron',
    env: { TEST: 'kept', ELECTRON_RUN_AS_NODE: '1' },
    spawnProcess: (...args) => { launch = args; return child },
  })
  t.after(async () => { server.close(); await server.finished })
  assert.equal(launch[0], '/path with spaces/electron')
  assert.deepEqual(launch[1], [APP_ROOT])
  assert.equal(launch[2].shell, false)
  assert.deepEqual(launch[2].stdio, ['ignore', 'pipe', 'pipe', 'ipc'])
  assert.equal(launch[2].env.FORGE3D_MCP_CHILD, '1')
  assert.equal(launch[2].env.FORGE3D_SKIP_START_PREVIEWS, '1')
  assert.equal(launch[2].env.ELECTRON_RUN_AS_NODE, undefined)
  assert.equal(launch[2].env.TEST, 'kept')
  child.stdout.write('renderer chatter\n')
  child.stderr.write('native diagnostic\n')
  input.write(`${JSON.stringify(init())}\n`)
  await until(() => stdout().length)
  assert.equal(JSON.parse(stdout()).result.serverInfo.name, 'forge3d')
  assert.match(stderr(), /renderer chatter/)
  assert.match(stderr(), /native diagnostic/)
  assert.doesNotMatch(stdout(), /chatter|diagnostic/)
  input.end()
  await server.finished
  assert.equal(child.sent.at(-1).type, 'forge3d:mcp:shutdown')
})

test('real child process IPC round trip and stdin EOF shutdown are clean', async (t) => {
  const input = new PassThrough()
  const output = new PassThrough()
  const diagnostics = new PassThrough()
  const stdout = capture(output)
  const stderr = capture(diagnostics)
  const fixtureCode = `
    console.log('fixture stdout log');
    console.error('fixture stderr log');
    process.on('message', message => {
      if (message.type === 'forge3d:mcp:shutdown') { process.disconnect(); process.exit(0); }
      if (message.type === 'forge3d:mcp:request') process.send({type: 'forge3d:mcp:response', id: message.id, result: {content:[{type:'text',text:JSON.stringify(message.arguments)}]}});
    });
    process.send({type: 'forge3d:mcp:ready'});
  `
  const server = launchMcpServer({
    input, output, diagnostics, electronPath: process.execPath,
    spawnProcess: (executable, args, options) => spawn(executable, ['--input-type=module', '--eval', fixtureCode], options),
  })
  t.after(async () => { server.close(); await server.finished })
  input.write(`${JSON.stringify(init())}\n${JSON.stringify(initialized)}\n${JSON.stringify(request('render-1', 'tools/call', { name: 'forge3d_render' }))}\n`)
  await until(() => stdout().trim().split('\n').length === 2, 'real process response')
  const responses = stdout().trim().split('\n').map(JSON.parse)
  assert.equal(responses[1].id, 'render-1')
  assert.deepEqual(JSON.parse(responses[1].result.content[0].text), { profile: 'final' })
  assert.match(stderr(), /fixture stdout log/)
  assert.match(stderr(), /fixture stderr log/)
  input.end()
  await server.finished
  assert.equal(server.child.exitCode, 0)
  assert.equal(server.error, null)
})

test('launcher options are explicit and CLI help never contaminates stdout', () => {
  assert.deepEqual(parseLauncherArgs([]), { electronPath: undefined, appPath: undefined, help: false })
  assert.equal(parseLauncherArgs(['--help']).help, true)
  // Use this platform's absolute executable path (POSIX paths acquire a drive
  // prefix on Windows when the launcher intentionally normalizes them).
  assert.equal(parseLauncherArgs(['--electron', process.execPath]).electronPath, process.execPath)
  assert.equal(parseLauncherArgs(['--electron', 'relative-electron']).electronPath, path.resolve('relative-electron'))
  assert.equal(parseLauncherArgs(['--app', process.execPath]).appPath, process.execPath)
  assert.throws(() => parseLauncherArgs(['--app', 'relative-app']), /absolute path/)
  assert.throws(() => parseLauncherArgs(['--app', process.execPath, '--electron', process.execPath]), /mutually exclusive/)
  assert.throws(() => parseLauncherArgs(['--electron', process.execPath, '--app', process.execPath]), /mutually exclusive/)
  assert.throws(() => parseLauncherArgs(['--app', process.execPath, '--app', process.execPath]), /only one/)
  assert.throws(() => parseLauncherArgs(['--app']), /incomplete/)
  assert.throws(() => parseLauncherArgs(['--app', `${process.execPath}\0`]), /valid executable path/)
  assert.throws(() => parseLauncherArgs(['--no-sandbox']), /Unknown/)
  assert.throws(() => parseLauncherArgs(['--electron']), /incomplete/)
  const result = spawnSync(process.execPath, ['electron/mcp-server.mjs', '--help'], { cwd: APP_ROOT, encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /new isolated visible Forge3D session/)
  assert.match(result.stderr, /--app/)
})

test('packaged launcher spawns only the selected executable while preserving IPC and isolation', async (t) => {
  const child = new MockChild()
  const input = new PassThrough()
  const output = new PassThrough()
  const diagnostics = new PassThrough()
  capture(output)
  capture(diagnostics)
  const appPath = path.join(os.tmpdir(), 'Forge3D release with spaces', process.platform === 'win32' ? 'Forge3D.exe' : 'Forge3D')
  let launch
  const server = launchMcpServer({
    input, output, diagnostics, appPath,
    env: { ELECTRON_RUN_AS_NODE: '1', CHECK: 'preserved' },
    spawnProcess: (...args) => { launch = args; return child },
  })
  t.after(async () => { server.close(); await server.finished })
  assert.equal(launch[0], appPath)
  assert.deepEqual(launch[1], [])
  assert.equal(launch[2].shell, false)
  assert.equal(launch[2].cwd, APP_ROOT)
  assert.deepEqual(launch[2].stdio, ['ignore', 'pipe', 'pipe', 'ipc'])
  assert.equal(launch[2].env.FORGE3D_MCP_CHILD, '1')
  assert.equal(launch[2].env.FORGE3D_SKIP_START_PREVIEWS, '1')
  assert.equal(launch[2].env.ELECTRON_RUN_AS_NODE, undefined)
  assert.equal(launch[2].env.CHECK, 'preserved')
  server.close()
  await server.finished
  assert.equal(child.sent.at(-1).type, 'forge3d:mcp:shutdown')
})

test('programmatic launcher rejects ambiguous or relative packaged targets before spawning', () => {
  let spawned = false
  const spawnProcess = () => { spawned = true; throw new Error('Should not spawn') }
  assert.throws(() => launchMcpServer({ appPath: process.execPath, electronPath: process.execPath, spawnProcess }), /mutually exclusive/)
  for (const appPath of ['', 'relative-app', null, 5, `${process.execPath}\0`]) {
    assert.throws(() => launchMcpServer({ appPath, spawnProcess }), /absolute path/)
  }
  assert.equal(spawned, false)
})

test('packaged CLI validates a native executable file without falling back to source mode', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'forge3d-mcp-app-path-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  for (const [target, diagnostic] of [[directory, /executable file, not a directory/], [path.join(directory, 'missing-app'), /executable not found/]]) {
    const result = spawnSync(process.execPath, ['electron/mcp-server.mjs', '--app', target], { cwd: APP_ROOT, encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, diagnostic)
    assert.doesNotMatch(result.stderr, /Cannot find module 'electron'/)
  }
})

test('standalone companion layout runs packaged IPC without Electron dependency or dist renderer', async (t) => {
  const companion = await fs.mkdtemp(path.join(os.tmpdir(), 'forge3d-mcp-companion-'))
  t.after(() => fs.rm(companion, { recursive: true, force: true }))
  await fs.mkdir(path.join(companion, 'electron'))
  for (const name of ['mcp-server.mjs', 'mcp-protocol.mjs']) {
    await fs.copyFile(path.join(APP_ROOT, 'electron', name), path.join(companion, 'electron', name))
  }
  await fs.writeFile(path.join(companion, 'package.json'), JSON.stringify({ name: 'forge3d-mcp-companion', version: '9.8.7' }))
  await assert.rejects(fs.access(path.join(companion, 'node_modules')), { code: 'ENOENT' })
  await assert.rejects(fs.access(path.join(companion, 'dist')), { code: 'ENOENT' })

  // A Node executable is a portable stand-in for the installed Electron app.
  // NODE_OPTIONS preloads this only in the child; unlike a shebang script, the
  // fixture works on Windows too and requires no shell or executable chmod.
  const preload = path.join(companion, 'fake-packaged-app.mjs')
  await fs.writeFile(preload, `
    if (process.env.FORGE3D_MCP_CHILD === '1') {
      console.log('packaged app stdout diagnostic');
      process.on('message', message => {
        if (message.type === 'forge3d:mcp:shutdown') { process.disconnect(); process.exit(0); }
        if (message.type === 'forge3d:mcp:request') process.send({
          type: 'forge3d:mcp:response', id: message.id,
          result: {content: [{type: 'text', text: JSON.stringify({argv: process.argv, name: message.name})}]}
        });
      });
      process.send({type: 'forge3d:mcp:ready'});
    }
  `)
  const env = { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(preload).href}` }
  delete env.FORGE3D_MCP_CHILD
  delete env.NODE_PATH
  const script = path.join(companion, 'electron', 'mcp-server.mjs')
  const child = spawn(process.execPath, [script, '--app', process.execPath], { cwd: companion, env, stdio: ['pipe', 'pipe', 'pipe'] })
  const stdout = capture(child.stdout)
  const stderr = capture(child.stderr)
  const exited = new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => resolve({ code, signal }))
    child.once('error', reject)
  })
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return
    child.stdin.end()
    const fallback = setTimeout(() => child.kill(), 2000)
    try { await exited } finally { clearTimeout(fallback) }
  })
  child.stdin.write(`${JSON.stringify(init())}\n${JSON.stringify(initialized)}\n${JSON.stringify(request('packaged', 'tools/call', { name: 'forge3d_get_model' }))}\n`)
  await until(() => stdout().trim().split('\n').length === 2, 'standalone packaged tool result')
  const responses = stdout().trim().split('\n').map(JSON.parse)
  assert.equal(responses[0].result.serverInfo.version, '9.8.7')
  assert.equal(responses[1].id, 'packaged')
  const result = JSON.parse(responses[1].result.content[0].text)
  assert.equal(result.name, 'forge3d_get_model')
  assert.deepEqual(result.argv, [process.execPath], 'Packaged executable must receive no checkout argument')
  assert.match(stderr(), /packaged app stdout diagnostic/)
  assert.doesNotMatch(stdout(), /packaged app stdout diagnostic/)
  child.stdin.end()
  assert.deepEqual(await exited, { code: 0, signal: null })

  const sourceMode = spawnSync(process.execPath, [script], { cwd: companion, encoding: 'utf8' })
  assert.equal(sourceMode.status, 1)
  assert.match(sourceMode.stderr, /Renderer build not found/)
  assert.match(sourceMode.stderr, /--app/)
  assert.equal(sourceMode.stdout, '')
})
