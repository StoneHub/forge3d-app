import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { prepareMcpCompanion } from './package-mcp-companion.mjs'

test('release companion is self-contained, dependency-free, and matches release version', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forge3d-companion-test-'))
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }))
  const directory = prepareMcpCompanion({ outputRoot })
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  const source = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.version, source.version)
  assert.equal(manifest.dependencies, undefined)
  assert.equal(fs.existsSync(path.join(directory, 'node_modules')), false)
  assert.equal(fs.existsSync(path.join(directory, 'dist')), false)
  const result = spawnSync(process.execPath, [path.join(directory, 'electron/mcp-server.mjs'), '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /--app/)
  assert.match(fs.readFileSync(path.join(directory, 'README.md'), 'utf8'), /not a filesystem sandbox/)
  assert.ok(fs.existsSync(path.join(directory, 'docs/screenshots/forge3d-mcp-bracket.png')))
  for (const file of ['electron/mcp-server.mjs', 'electron/mcp-protocol.mjs']) {
    assert.deepEqual(fs.readFileSync(path.join(directory, file)), fs.readFileSync(new URL(`../${file}`, import.meta.url)))
  }
})
