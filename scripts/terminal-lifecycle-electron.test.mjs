import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('native xterm survives hidden startup, rerenders, themes, hide/show and disposal', {
  skip: process.env.FORGE3D_RUN_ELECTRON_TESTS !== '1' ? 'opt in on a graphical desktop with FORGE3D_RUN_ELECTRON_TESTS=1' : false,
  timeout: 60_000,
}, async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'forge3d-terminal-lifecycle-'));
  const server = await createServer({ root: repoRoot, configFile: path.join(repoRoot, 'vite.config.js'), server: { port: 5175, strictPort: true, host: '127.0.0.1' } });
  let child;
  try {
    await server.listen();
    const address = server.httpServer.address();
    const output = await new Promise((resolve, reject) => {
      child = spawn(electron, [path.join(repoRoot, 'scripts/fixtures/terminal-lifecycle/electron.mjs')], {
        cwd: repoRoot,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '', FORGE3D_TERMINAL_TEST_PROFILE: profile,
          FORGE3D_TERMINAL_TEST_URL: `http://127.0.0.1:${address.port}/scripts/fixtures/terminal-lifecycle/index.html` },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let text = '';
      child.stdout.on('data', (data) => { text += data; });
      child.stderr.on('data', (data) => { text += data; });
      const deadline = setTimeout(() => { text += '\nElectron terminal fixture exceeded 45 seconds'; child.kill(); }, 45_000);
      child.on('error', (error) => { clearTimeout(deadline); reject(error); });
      child.on('exit', (code) => { clearTimeout(deadline); resolve({ code, text }); });
    });
    assert.equal(output.code, 0, output.text);
    assert.match(output.text, /FORGE3D_TERMINAL_RESULT .*"ok":true/);
    console.log(output.text);
  } finally {
    child?.kill();
    await server.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
