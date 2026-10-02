import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('native CodeEditor detaches diff models before disposal under StrictMode', {
  skip: process.env.FORGE3D_RUN_ELECTRON_TESTS !== '1' && 'opt in with FORGE3D_RUN_ELECTRON_TESTS=1',
  timeout: 60_000,
}, async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'forge3d-editor-lifecycle-'));
  const server = await createServer({ root: repo, configFile: path.join(repo, 'vite.config.js'), server: { port: 5176, strictPort: true, host: '127.0.0.1' } });
  let child;
  try {
    await server.listen();
    const output = await new Promise((resolve, reject) => {
      child = spawn(electron, [path.join(repo, 'scripts/fixtures/editor-lifecycle/electron.mjs')], {
        cwd: repo,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '', FORGE3D_EDITOR_TEST_PROFILE: profile,
          FORGE3D_EDITOR_TEST_URL: 'http://127.0.0.1:5176/scripts/fixtures/editor-lifecycle/index.html' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let text = '';
      child.stdout.on('data', data => { text += data; });
      child.stderr.on('data', data => { text += data; });
      const deadline = setTimeout(() => child.kill(), 45_000);
      child.once('error', error => { clearTimeout(deadline); reject(error); });
      child.once('exit', code => { clearTimeout(deadline); resolve({ code, text }); });
    });
    assert.equal(output.code, 0, output.text);
    assert.match(output.text, /FORGE3D_EDITOR_RESULT .*"ok":true/);
    console.log(output.text);
  } finally {
    child?.kill();
    await server.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
