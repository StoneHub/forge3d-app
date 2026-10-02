import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('./fixtures/editor-lifecycle/electron.mjs', import.meta.url), 'utf8');
test('native fixture reports an early BrowserWindow failure and exits', async () => {
  const logs = [];
  const exits = [];
  const fixture = source.replace(/^import .*;\n/gm, '').replace('app.whenReady().then(run);', 'run();');
  await vm.runInNewContext(fixture, {
    app: { setPath() {}, exit(code) { exits.push(code); } },
    BrowserWindow: class { constructor() { throw new Error('synthetic window creation failure'); } },
    process: { env: { FORGE3D_EDITOR_TEST_PROFILE: '/synthetic/disposable/profile' } },
    console: { error(line) { logs.push(line); }, log() {} }, assert, setTimeout,
  });
  assert.deepEqual(exits, [1]);
  assert.equal(logs.length, 1);
  const result = JSON.parse(logs[0].slice('FORGE3D_EDITOR_RESULT '.length));
  assert.equal(result.ok, false);
  assert.match(result.error, /synthetic window creation failure/);
  assert.equal(result.final, null);
});
