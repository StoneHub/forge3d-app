import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { createMcpConfig } from '../electron/mcp-config.mjs'

const NODE = '/Users/mstone/Documents/Codex/2026-10-22/task/runtime/node-v22.23.4-darwin-arm64/bin/node'
const SCRIPT = new URL('../electron/mcp-config.mjs', import.meta.url).pathname

function executable(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  fs.chmodSync(file, 0o755)
}

test('config generator resolves an app bundle and paths with spaces to absolute real paths', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'Forge3D Companion Test '))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const bundle = path.join(root, 'Installed Forge3D.app')
  const appBin = path.join(bundle, 'Contents', 'MacOS', 'Forge3D')
  const openscad = path.join(root, 'Native OpenSCAD', 'openscad')
  executable(appBin)
  executable(openscad)

  const config = createMcpConfig({ app: bundle, openscad })
  assert.deepEqual(config, {
    mcpServers: {
      forge3d: {
        command: process.execPath,
        args: [fs.realpathSync(new URL('../electron/mcp-server.mjs', import.meta.url)), '--app', fs.realpathSync(appBin)],
        env: { FORGE3D_OPENSCAD_BIN: fs.realpathSync(openscad) },
      },
    },
  })
})

test('CLI prints portable MCP JSON and resolves a symlinked app executable', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge3d-cli-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const app = path.join(root, 'Forge3D')
  const linkedApp = path.join(root, 'linked app')
  executable(app)
  fs.symlinkSync(app, linkedApp)
  const result = spawnSync(NODE, [SCRIPT, '--app', linkedApp], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  const config = JSON.parse(result.stdout)
  assert.equal(config.mcpServers.forge3d.command, NODE)
  assert.deepEqual(config.mcpServers.forge3d.args, [
    fs.realpathSync(new URL('../electron/mcp-server.mjs', import.meta.url)), '--app', fs.realpathSync(app),
  ])
  assert.equal(config.mcpServers.forge3d.env, undefined)
})

test('CLI rejects a relative or missing app path without printing partial JSON', () => {
  const relative = spawnSync(NODE, [SCRIPT, '--app', 'Forge3D'], { encoding: 'utf8' })
  assert.notEqual(relative.status, 0)
  assert.equal(relative.stdout, '')
  assert.match(relative.stderr, /must be absolute/)

  const missing = spawnSync(NODE, [SCRIPT, '--app', '/no/such/Forge3D'], { encoding: 'utf8' })
  assert.notEqual(missing.status, 0)
  assert.equal(missing.stdout, '')
  assert.match(missing.stderr, /was not found/)
})

test('CLI help prints usage to stderr without requiring an app path', () => {
  const result = spawnSync(NODE, [SCRIPT, '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /Usage: node electron\/mcp-config\.mjs --app/)
  assert.match(result.stderr, /does not launch Forge3D or edit client configuration/)
})
