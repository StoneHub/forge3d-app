import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.setPath('userData', process.env.FORGE3D_TERMINAL_TEST_PROFILE);
let win;
const result = {};
const evaluate = (code) => win.webContents.executeJavaScript(code);
async function waitFor(code, label) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(code)) return;
    await pause(50);
  }
  throw new Error(`Timed out: ${label}`);
}
async function run() {
try {
  win = new BrowserWindow({ width: 800, height: 420, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', (_event, _level, message) => console.log('renderer:', message));
  await win.loadURL(process.env.FORGE3D_TERMINAL_TEST_URL);
  await waitFor('Boolean(window.terminalLifecycle?.update)', 'fixture mount');
  for (let i = 0; i < 12; i++) {
    await evaluate('window.terminalLifecycle.update()');
    await pause(30);
  }
  result.hiddenStartup = await evaluate('({ errors: window.terminalLifecycle.errors, opened: Boolean(document.querySelector(".xterm")), calls: window.terminalLifecycle.calls })');
  assert.deepEqual(result.hiddenStartup.errors, [], 'hidden startup must not run callbacks against disposed xterm renderers');
  assert.equal(result.hiddenStartup.opened, false, 'an inactive hidden terminal must wait before opening');

  win.show();
  await evaluate('window.terminalLifecycle.update({ active: true })');
  await waitFor('Boolean(document.querySelector(".xterm-screen"))', 'terminal open');
  await pause(150);
  await evaluate('window.terminalLifecycle.originalElement = document.querySelector(".xterm"); window.terminalLifecycle.sendData("history sentinel\\r\\n")');
  await waitFor('document.querySelector(".xterm-screen")?.textContent.includes("history sentinel")', 'terminal output');
  for (let i = 0; i < 12; i++) {
    await evaluate(`window.terminalLifecycle.update({ theme: '${i % 2 ? 'dark' : 'light'}', focusToken: ${i + 1} })`);
    await pause(30);
  }
  assert.equal(await evaluate('document.querySelector(".xterm") === window.terminalLifecycle.originalElement'), true, 'rerenders and theme changes must keep one terminal');
  assert.equal(await evaluate('document.querySelector(".xterm-screen")?.textContent.includes("history sentinel")'), true, 'theme changes must preserve scrollback');
  await evaluate('window.terminalLifecycle.update({ theme: "light" })');
  await pause(100);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".xterm-viewport")).backgroundColor'), 'rgb(255, 255, 255)', 'theme updates must reach the existing viewport');
  result.visibleSize = await evaluate('window.terminalLifecycle.calls.resizes.at(-1)');
  assert.ok(result.visibleSize?.[0] > 0 && result.visibleSize?.[1] > 0, 'visible terminal must fit the PTY');
  assert.equal(await evaluate('document.activeElement?.classList.contains("xterm-helper-textarea")'), true, 'terminal must focus');
  await evaluate('window.terminalLifecycle.update({ width: 500, height: 250 })');
  await waitFor(`window.terminalLifecycle.calls.resizes.at(-1)?.[0] < ${result.visibleSize[0]} && window.terminalLifecycle.calls.resizes.at(-1)?.[1] < ${result.visibleSize[1]}`, 'container resize fit');
  result.resizedSize = await evaluate('window.terminalLifecycle.calls.resizes.at(-1)');
  const resizeCount = await evaluate('window.terminalLifecycle.calls.resizes.length');
  for (let i = 0; i < 5; i++) {
    win.hide();
    await evaluate('window.terminalLifecycle.update({ active: false }); window.dispatchEvent(new Event("resize"))');
    await pause(60);
    win.show();
    await evaluate(`window.terminalLifecycle.update({ active: true, focusToken: ${i + 20} })`);
    await pause(120);
  }
  assert.ok(await evaluate(`window.terminalLifecycle.calls.resizes.length > ${resizeCount}`), 'showing the terminal must refit');
  await evaluate('window.terminalLifecycle.update({ resetToken: 1 })');
  await pause(120);
  assert.equal(await evaluate('document.querySelector(".xterm-screen")?.textContent.includes("history sentinel")'), false, 'explicit reset must clear terminal');
  await evaluate('window.terminalLifecycle.unmount()');
  await pause(250);
  result.final = await evaluate('({ errors: window.terminalLifecycle.errors, calls: window.terminalLifecycle.calls })');
  assert.deepEqual(result.final.errors, []);
  assert.equal(result.final.calls.subscriptions, result.final.calls.unsubscriptions, 'all bridge listeners must detach');
  await evaluate('window.terminalLifecycle.mount(true)');
  await waitFor('Boolean(document.querySelector(".xterm-screen"))', 'remounted active terminal');
  await pause(150);
  win.webContents.sendInputEvent({ type: 'char', keyCode: 'x' });
  await waitFor('window.terminalLifecycle.calls.writes.includes("x")', 'remounted terminal input');
  await evaluate('window.terminalLifecycle.unmount()');
  await pause(250);
  result.remounted = await evaluate('({ errors: window.terminalLifecycle.errors, calls: window.terminalLifecycle.calls })');
  assert.deepEqual(result.remounted.errors, []);
  assert.equal(result.remounted.calls.subscriptions, result.remounted.calls.unsubscriptions);
  console.log('FORGE3D_TERMINAL_RESULT ' + JSON.stringify({ ok: true, ...result }));
  app.exit(0);
} catch (error) {
  if (win && !win.isDestroyed()) result.final = await evaluate('({ errors: window.terminalLifecycle.errors, calls: window.terminalLifecycle.calls })').catch(() => null);
  console.error('FORGE3D_TERMINAL_RESULT ' + JSON.stringify({ ok: false, error: error.stack, ...result }));
  app.exit(1);
}

}
app.whenReady().then(run);
