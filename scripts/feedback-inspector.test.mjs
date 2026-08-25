import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const mainSource = fs.readFileSync(path.join(repoRoot, 'electron', 'main.mjs'), 'utf8')

test('Electron Inspector stays in the development build path', () => {
  assert.match(packageJson.scripts.dev, /bundle:preload:feedback/)
  assert.match(packageJson.scripts.build, /bundle:preload(?!:feedback)/)
  assert.doesNotMatch(packageJson.scripts.build, /bundle:preload:feedback/)
  assert.match(mainSource, /if \(isDev\) \{[\s\S]*require\('@dev-feedback\/electron\/main'\)/)
})
