import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('vendored inspector detaches owned hooks after native window destruction', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'forge3d-inspector-close-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const manifest = JSON.parse(await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'))
  const archive = path.join(repoRoot, manifest.devDependencies['@dev-feedback/electron'].slice('file:'.length))
  await run('tar', ['-xzf', archive, '-C', directory])
  const electronModule = path.join(directory, 'node_modules', 'electron')
  await fs.mkdir(electronModule, { recursive: true })
  await fs.writeFile(path.join(electronModule, 'index.js'), `
    const { EventEmitter } = require('node:events')
    const app = new EventEmitter()
    app.isPackaged = false
    app.isReady = () => true
    app.getName = () => 'Forge3D synthetic close test'
    app.getPath = app.getAppPath = () => ${JSON.stringify(directory)}
    const contents = new EventEmitter()
    contents.isDestroyed = () => window.destroyed
    contents.send = () => {}
    const window = new EventEmitter()
    window.destroyed = false
    window.isDestroyed = () => window.destroyed
    Object.defineProperty(window, 'webContents', { get() {
      if (window.destroyed) throw new TypeError('Object has been destroyed')
      return contents
    } })
    const handlers = new Map()
    const defaultSession = {
      preloads: ['/host/preload.cjs'],
      getPreloads() { return [...this.preloads] },
      setPreloads(value) { this.preloads = [...value] }
    }
    module.exports = { app, contents, window, handlers, session: {defaultSession},
      ipcMain: {handle(name, handler) {handlers.set(name, handler)}, removeHandler(name) {handlers.delete(name)}},
      BrowserWindow: {getFocusedWindow() {return null}, getAllWindows() {return [window]}}
    }
  `)
  const script = `
    (async () => {
      const assert = require('node:assert/strict')
      const electron = require('electron')
      const {registerElectronInspector} = require(${JSON.stringify(path.join(directory, 'package', 'register.cjs'))})
      const registration = await registerElectronInspector()
      assert.equal(electron.contents.listenerCount('before-input-event'), 1)
      assert.equal(electron.window.listenerCount('closed'), 1)
      electron.window.destroyed = true
      electron.window.emit('closed')
      assert.equal(electron.contents.listenerCount('before-input-event'), 0)
      assert.equal(electron.window.listenerCount('closed'), 0)
      await registration.dispose()
      await registration.dispose()
      assert.equal(electron.app.listenerCount('session-created'), 0)
      assert.equal(electron.app.listenerCount('browser-window-created'), 0)
      assert.equal(electron.handlers.size, 0)
      assert.deepEqual(electron.session.defaultSession.preloads, ['/host/preload.cjs'])
    })().catch(error => {console.error(error);process.exit(1)})
  `
  await run(process.execPath, ['-e', script], { cwd: directory })
})
