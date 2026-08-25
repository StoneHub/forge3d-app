import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const mainSource = fs.readFileSync(path.join(repoRoot, 'electron', 'main.mjs'), 'utf8')
const preloadSource = fs.readFileSync(path.join(repoRoot, 'electron', 'preload.cjs'), 'utf8')

test('Electron Inspector costs the Host App one development-only registration line', () => {
  assert.match(mainSource, /if \(isDev\) await import\('@dev-feedback\/electron\/register'\)/)
  assert.equal((mainSource.match(/@dev-feedback\/electron/g) || []).length, 1)
  assert.doesNotMatch(preloadSource, /@dev-feedback\/electron/)
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /bundle:preload/)
  assert.equal(packageJson.devDependencies['@dev-feedback/electron'].startsWith('file:vendor/'), true)
})
