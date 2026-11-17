// Launch helpers for recording site demos from the real Electron app.
// See README.md in this folder.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..');
export const modelPath = (name) => path.join(here, 'models', name);
export const framesDir = (name) => path.join(process.env.DEMO_FRAMES_DIR || path.join(os.tmpdir(), 'forge3d-site-demos'), name);
// Playwright is not a project dependency: run with NODE_PATH="$(npm root -g)" after npm i -g playwright.
const require = createRequire(import.meta.url);
const { _electron } = require('playwright');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const W = 1440, H = 900;
export async function launch() {
  const app = await _electron.launch({
    executablePath: require(path.join(repoRoot, 'node_modules', 'electron')),
    args: [repoRoot, '--no-sandbox', '--skip-start-previews'],
    cwd: repoRoot,
    env: { ...process.env, FORGE3D_SKIP_START_PREVIEWS: '1', ELECTRON_DISABLE_SANDBOX: '1' },
  });
  await sleep(6000);
  const win = app.windows().find(w => w.url().includes('5173'));
  if (!win) throw new Error('No app window on http://localhost:5173. Start the dev server first: npx vite --port 5173');
  for (const w of app.windows()) if (w !== win) await w.close().catch(()=>{});
  await app.evaluate(({ BrowserWindow }, [w, h]) => {
    for (const b of BrowserWindow.getAllWindows()) { if (!b.webContents.getURL().includes('5173')) continue; b.setBounds({ x: 0, y: 0, width: w, height: h }); b.focus(); }
  }, [W, H]);
  await sleep(1500);
  return { app, win };
}
export async function showParams(win) {
  const exp = win.locator('button[title="Expand sidebar panel"]');
  if (await exp.count()) { await exp.click(); await sleep(800); }
  if (!await win.locator('input[type=range]').first().isVisible().catch(() => false)) { await win.locator('button[title="Params"]').click(); await sleep(1500); }
}

export async function newWithCode(app, win, file) {
  await win.locator('button[title="New"]').click(); await sleep(1200);
  const code = fs.readFileSync(file, 'utf8');
  await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), code);
  await win.locator('.monaco-editor').first().click();
  await win.keyboard.press('ControlOrMeta+A');
  await win.keyboard.press('ControlOrMeta+V');
  await sleep(500);
  await win.keyboard.press('ControlOrMeta+Home');
  await sleep(3000);
}
