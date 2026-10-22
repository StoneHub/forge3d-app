// MCP stdio is newline-delimited UTF-8 JSON, not Content-Length/LSP framing.
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
export const MAX_CODE_BYTES = 2 * 1024 * 1024
export const MAX_MESSAGE_BYTES = 4 * 1024 * 1024
export const MAX_PENDING_CALLS = 32

const objectSchema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false })
const revisionSchema = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: 'The revision returned by forge3d_get_model; stale edits are rejected.' }
const readOnly = { readOnlyHint: true, openWorldHint: false }
const mutating = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }

export const TOOL_DEFINITIONS = [
  {
    name: 'forge3d_get_model',
    description: 'Read the active Design model, source filename/path, revision, parameters and render status in this isolated Forge3D session.',
    inputSchema: objectSchema(), annotations: readOnly,
  },
  {
    name: 'forge3d_set_code',
    description: 'Replace the active unsaved Design buffer after checking its revision. Does not save or overwrite a source file. Read the model first.',
    inputSchema: objectSchema({ code: { type: 'string', description: 'OpenSCAD source, at most 2 MiB in UTF-8.' }, expectedRevision: revisionSchema }, ['code', 'expectedRevision']), annotations: mutating,
  },
  {
    name: 'forge3d_set_parameters',
    description: 'Update declared model parameters in the active unsaved buffer after checking its revision. Use parameter IDs from forge3d_get_model.',
    inputSchema: objectSchema({
      values: { type: 'array', minItems: 1, maxItems: 1000, items: objectSchema({ id: { type: 'string', minLength: 1 }, value: { type: ['number', 'string', 'boolean'] } }, ['id', 'value']) },
      expectedRevision: revisionSchema,
    }, ['values', 'expectedRevision']), annotations: mutating,
  },
  {
    name: 'forge3d_render',
    description: 'Render the current Design model using locally installed native OpenSCAD. Defaults to final quality. OpenSCAD include/import may read local files.',
    inputSchema: objectSchema({ profile: { type: 'string', enum: ['quick', 'final'], default: 'final' } }), annotations: mutating,
  },
  {
    name: 'forge3d_export_stl',
    description: 'Export the last successful final native render only if it still matches the current model. Writes a new file in this session\'s temporary export directory, never overwriting an existing file.',
    inputSchema: objectSchema({ filename: { type: 'string', minLength: 5, maxLength: 200, description: 'Optional .stl basename, at most 200 UTF-8 bytes; no directory or path separators.' } }), annotations: mutating,
  },
  {
    name: 'forge3d_capture_viewport',
    description: 'Capture the visible Forge3D viewport as an MCP PNG image. Captures only this session, not the entire desktop.',
    inputSchema: objectSchema(), annotations: readOnly,
  },
]

export class McpProtocolError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}
const invalidParams = (message) => { throw new McpProtocolError(-32602, message) }
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const has = (object, key) => Object.hasOwn(object, key)
const validId = (id) => typeof id === 'string' || (typeof id === 'number' && Number.isSafeInteger(id))
const errorResponse = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })

function assertKeys(value, keys, label) {
  if (!isObject(value)) invalidParams(`${label} must be an object`)
  if (Object.keys(value).some((key) => !keys.includes(key))) invalidParams(`${label} contains an unknown property`)
}

/** Validate before IPC as well as in main. Returns normalized, detached arguments. */
export function validateToolArguments(name, args = {}) {
  const definition = TOOL_DEFINITIONS.find((tool) => tool.name === name)
  if (!definition) invalidParams(`Unknown tool: ${name}`)
  assertKeys(args, Object.keys(definition.inputSchema.properties), 'Tool arguments')
  for (const key of definition.inputSchema.required) {
    if (!has(args, key)) invalidParams(`Missing required argument: ${key}`)
  }
  if (has(args, 'expectedRevision') && (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0)) {
    invalidParams('expectedRevision must be a non-negative safe integer')
  }
  if (name === 'forge3d_set_code') {
    if (typeof args.code !== 'string' || Buffer.byteLength(args.code, 'utf8') > MAX_CODE_BYTES) invalidParams('code must be a string of at most 2 MiB in UTF-8')
  }
  if (name === 'forge3d_set_parameters') {
    if (!Array.isArray(args.values) || args.values.length === 0 || args.values.length > 1000) invalidParams('values must contain between 1 and 1000 parameters')
    const ids = new Set()
    for (const item of args.values) {
      assertKeys(item, ['id', 'value'], 'Parameter')
      if (typeof item.id !== 'string' || !item.id || item.id.length > 1000) invalidParams('Each parameter must have a non-empty id of at most 1000 characters')
      if (ids.has(item.id)) invalidParams(`Duplicate parameter id: ${item.id}`)
      ids.add(item.id)
      if (!['number', 'string', 'boolean'].includes(typeof item.value) || (typeof item.value === 'number' && !Number.isFinite(item.value))) invalidParams('Parameter values must be finite numbers, strings, or booleans')
      if (typeof item.value === 'string' && Buffer.byteLength(item.value, 'utf8') > 65536) invalidParams('Parameter strings must be at most 64 KiB in UTF-8')
    }
  }
  if (name === 'forge3d_render' && has(args, 'profile') && !['quick', 'final'].includes(args.profile)) invalidParams('profile must be quick or final')
  if (name === 'forge3d_export_stl' && has(args, 'filename')) {
    if (typeof args.filename !== 'string' || Buffer.byteLength(args.filename, 'utf8') > 200 || !/^[^<>:"/\\|?*\u0000-\u001f]+\.stl$/i.test(args.filename)) invalidParams('filename must be a .stl basename of at most 200 UTF-8 bytes without path separators or reserved characters')
  }
  return name === 'forge3d_render' ? { profile: args.profile ?? 'final' } : structuredClone(args)
}

export function createMcpProtocol({ callTool, serverVersion = '3.2.0' }) {
  let state = 'new'
  let protocolVersion = null
  let pendingCalls = 0
  const activeIds = new Set()

  async function handleOne(message) {
    if (!isObject(message) || message.jsonrpc !== '2.0') return errorResponse(null, -32600, 'Invalid JSON-RPC request')
    // This server sends no requests; ignore client responses instead of replying to them.
    if (!has(message, 'method') && validId(message.id) && (has(message, 'result') || has(message, 'error'))) return null
    const request = has(message, 'id')
    if (typeof message.method !== 'string' || (request && !validId(message.id))) return errorResponse(null, -32600, 'Invalid JSON-RPC request')
    if (!request) {
      if (message.method === 'notifications/initialized' && state === 'initializing' && (!has(message, 'params') || isObject(message.params))) state = 'ready'
      // Notifications never execute tools, including malformed tools/call notifications.
      return null
    }
    if (activeIds.has(message.id)) return errorResponse(message.id, -32600, 'Request id is already pending')
    activeIds.add(message.id)
    try {
      if (has(message, 'params') && !isObject(message.params)) invalidParams('params must be an object')
      const params = message.params ?? {}
      let result
      if (message.method === 'initialize') {
        if (state !== 'new') throw new McpProtocolError(-32600, 'Already initialized')
        if (typeof params.protocolVersion !== 'string' || !params.protocolVersion || !isObject(params.capabilities) || !isObject(params.clientInfo) || typeof params.clientInfo.name !== 'string' || typeof params.clientInfo.version !== 'string') invalidParams('initialize requires protocolVersion, capabilities, and clientInfo with name and version')
        protocolVersion = PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0]
        state = 'initializing'
        result = {
          protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'forge3d', version: serverVersion },
          instructions: 'Tools control a new isolated visible Forge3D session, not your already-open app. Read the model revision before edits. Render before exporting. Source edits stay unsaved. OpenSCAD source is executable input and may read local files; only use trusted code.',
        }
      } else if (message.method === 'ping') {
        result = {}
      } else {
        if (state !== 'ready') throw new McpProtocolError(-32002, 'Initialize and send notifications/initialized before using tools')
        if (message.method === 'tools/list') {
          if (has(params, 'cursor')) invalidParams('This tool list does not use pagination cursors')
          result = { tools: protocolVersion === '2024-11-05' ? TOOL_DEFINITIONS.map(({ annotations, ...tool }) => tool) : TOOL_DEFINITIONS }
        } else if (message.method === 'tools/call') {
          if (typeof params.name !== 'string') invalidParams('tools/call requires a tool name')
          if (!TOOL_DEFINITIONS.some((tool) => tool.name === params.name)) invalidParams(`Unknown tool: ${params.name}`)
          if (has(params, 'arguments') && !isObject(params.arguments)) invalidParams('Tool arguments must be an object')
          if (pendingCalls >= MAX_PENDING_CALLS) throw new McpProtocolError(-32000, 'Too many pending tool calls; wait for an earlier call to finish')
          pendingCalls++
          try {
            // A known tool's schema/domain validation is a tool execution error,
            // so clients can show it to the model and correct the arguments.
            const args = validateToolArguments(params.name, params.arguments)
            result = await callTool(params.name, args)
            if (!isObject(result) || !Array.isArray(result.content) || (has(result, 'isError') && typeof result.isError !== 'boolean')) throw new Error('Forge3D returned an invalid tool result')
          } catch (error) {
            result = { content: [{ type: 'text', text: error?.message || 'Forge3D tool execution failed' }], isError: true }
          } finally {
            pendingCalls--
          }
        } else {
          throw new McpProtocolError(-32601, `Method not found: ${message.method}`)
        }
      }
      return { jsonrpc: '2.0', id: message.id, result }
    } catch (error) {
      return errorResponse(message.id, error instanceof McpProtocolError ? error.code : -32603, error instanceof McpProtocolError ? error.message : 'Internal server error')
    } finally {
      activeIds.delete(message.id)
    }
  }

  return {
    async handle(message) {
      if (!Array.isArray(message)) return handleOne(message)
      // Batches existed in 2025-03-26, then were removed in 2025-06-18.
      if (state !== 'ready' || protocolVersion !== '2025-03-26' || message.length === 0 || message.length > MAX_PENDING_CALLS || message.some((entry) => entry?.method === 'initialize')) return errorResponse(null, -32600, 'Batch requests require an initialized 2025-03-26 session and at most 32 entries; initialize cannot be batched')
      const replies = (await Promise.all(message.map(handleOne))).filter(Boolean)
      return replies.length ? replies : null
    },
  }
}

/** Attach real streams; closing stdin ends the session, including pending work. */
export function startStdioServer({ input, output, callTool, serverVersion, onClose = () => {}, maxMessageBytes = MAX_MESSAGE_BYTES }) {
  const protocol = createMcpProtocol({ callTool, serverVersion })
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = Buffer.alloc(0)
  let closed = false

  function close(reason) {
    if (closed) return
    closed = true
    buffer = Buffer.alloc(0)
    input.removeListener('data', onData)
    input.removeListener('end', onEnd)
    input.removeListener('error', onError)
    // Retain the output error listener: late EPIPE must never become unhandled.
    input.pause()
    onClose(reason)
  }
  function write(message) {
    if (closed || !message) return
    try {
      if (!output.write(`${JSON.stringify(message)}\n`)) input.pause()
    } catch (error) {
      close(error)
    }
  }
  function frame(line) {
    if (line.length === 0 || (line.length === 1 && line[0] === 13)) return
    let message
    try { message = JSON.parse(decoder.decode(line)) } catch { write(errorResponse(null, -32700, 'Parse error: expected one UTF-8 JSON message per line')); return }
    void protocol.handle(message).then(write, () => write(errorResponse(null, -32603, 'Internal server error')))
  }
  function onData(chunk) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    let offset = 0
    while (!closed && offset < bytes.length) {
      const newline = bytes.indexOf(10, offset)
      const end = newline < 0 ? bytes.length : newline
      if (buffer.length + end - offset > maxMessageBytes) {
        write(errorResponse(null, -32600, `Message exceeds ${maxMessageBytes} bytes`))
        close(new Error('MCP input message too large'))
        return
      }
      buffer = Buffer.concat([buffer, bytes.subarray(offset, end)])
      if (newline < 0) return
      const line = buffer
      buffer = Buffer.alloc(0)
      frame(line)
      offset = newline + 1
    }
  }
  const onEnd = () => close()
  const onError = (error) => close(error)
  input.on('data', onData)
  input.on('end', onEnd)
  input.on('error', onError)
  output.on('error', onError)
  output.on('drain', () => { if (!closed) input.resume() })
  return { close }
}
