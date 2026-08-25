import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { bundlePreload } from './bundle-preload.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const mainSource = fs.readFileSync(path.join(repoRoot, 'electron', 'main.mjs'), 'utf8')

test('Electron Inspector stays in the development build path', () => {
  assert.match(packageJson.scripts.dev, /bundle:preload:feedback/)
  assert.match(packageJson.scripts.build, /bundle:preload(?!:feedback)/)
  assert.doesNotMatch(packageJson.scripts.build, /bundle:preload:feedback/)
  assert.match(mainSource, /if \(isDev\) \{[\s\S]*require\('@dev-feedback\/electron\/main'\)/)
})

test('built preload includes the inspector only when the development adapter is enabled', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'forge3d-preload-'))
  t.after(() => fsPromises.rm(tempRoot, { recursive: true, force: true }))
  const productionPath = path.join(tempRoot, 'production.cjs')
  const developmentPath = path.join(tempRoot, 'development.cjs')

  await bundlePreload({ outfile: productionPath, feedbackEnabled: false, logLevel: 'silent' })
  await bundlePreload({ outfile: developmentPath, feedbackEnabled: true, logLevel: 'silent' })

  const productionBundle = await fsPromises.readFile(productionPath, 'utf8')
  const developmentBundle = await fsPromises.readFile(developmentPath, 'utf8')
  assert.doesNotMatch(productionBundle, /dev-feedback-electron:start/)
  assert.match(developmentBundle, /dev-feedback-electron:start/)
  assert.match(developmentBundle, /Copy History/)
})
