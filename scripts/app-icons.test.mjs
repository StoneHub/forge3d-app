import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { getAppIconPath, setDevelopmentDockIcon } from '../electron/app-icons.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

test('runtime icon format matches the platform in source and packaged layouts', (t) => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forge3d-icon-test-'))
  t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }))
  for (const directory of ['public', 'dist']) {
    fs.mkdirSync(path.join(appRoot, directory))
    for (const name of ['icon.png', 'icon.ico']) fs.writeFileSync(path.join(appRoot, directory, name), '')
  }
  for (const isPackaged of [true, false]) {
    for (const [platform, filename] of [['darwin', 'icon.png'], ['linux', 'icon.png'], ['win32', 'icon.ico']]) {
      assert.equal(getAppIconPath({ appRoot, isPackaged, platform }), path.join(appRoot, isPackaged ? 'dist' : 'public', filename))
    }
  }
})

test('source macOS sessions set the Dock to the existing Forge3D PNG', () => {
  const calls = []
  const app = { isPackaged: false, dock: { setIcon: (icon) => calls.push(icon) } }
  assert.equal(setDevelopmentDockIcon({ app, appRoot: root, platform: 'darwin' }), true)
  assert.deepEqual(calls, [path.join(root, 'public', 'icon.png')])
  assert.equal(fs.readFileSync(calls[0]).subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
})

test('packaged apps and non-macOS sessions do not override native Dock branding', () => {
  const dock = { setIcon: () => assert.fail('Unexpected Dock mutation') }
  for (const platform of ['darwin', 'linux', 'win32']) {
    assert.equal(setDevelopmentDockIcon({ app: { isPackaged: true, dock }, appRoot: root, platform }), false)
  }
  for (const platform of ['linux', 'win32']) {
    assert.equal(setDevelopmentDockIcon({ app: { isPackaged: false, dock }, appRoot: root, platform }), false)
  }
})

test('absent Dock or icon leaves startup alone', () => {
  assert.equal(setDevelopmentDockIcon({ app: { isPackaged: false }, appRoot: root, platform: 'darwin' }), false)
  assert.equal(setDevelopmentDockIcon({ app: { isPackaged: false, dock: {} }, appRoot: root, platform: 'darwin' }), false)
  const app = { isPackaged: false, dock: { setIcon: () => assert.fail('Missing icon must not be applied') } }
  assert.equal(setDevelopmentDockIcon({ app, appRoot: path.join(root, 'nonexistent-icon-directory'), platform: 'darwin' }), false)
})

test('a cosmetic Dock failure cannot prevent the application from starting', (t) => {
  const warning = t.mock.method(console, 'warn', () => {})
  const app = { isPackaged: false, dock: { setIcon: () => { throw new Error('Image decode failed') } } }
  assert.equal(setDevelopmentDockIcon({ app, appRoot: root, platform: 'darwin' }), false)
  assert.equal(warning.mock.callCount(), 1)
  assert.equal(warning.mock.calls[0].arguments[1], 'Image decode failed')
})

test('main applies source Dock branding after Electron is ready, before creating the window', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.mjs'), 'utf8').replace(/\r\n/g, '\n')
  const start = main.indexOf('app.whenReady().then(async () => {')
  const branding = main.indexOf('setDevelopmentDockIcon({ app, appRoot:', start)
  const window = main.indexOf('createWindow()', start)
  assert.ok(start >= 0 && branding > start && window > branding)
})
