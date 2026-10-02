import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';

app.setPath('userData', process.env.FORGE3D_EDITOR_TEST_PROFILE);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let win;
const result = {};
const evaluate = code => win.webContents.executeJavaScript(code);
async function waitFor(code, label) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(code)) return;
    await pause(50);
  }
  throw new Error('Timed out: '+label);
}
async function run() {
  try {
    win = new BrowserWindow({ width: 820, height: 520, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await win.loadURL(process.env.FORGE3D_EDITOR_TEST_URL);
    await waitFor('window.editorLifecycle?.ready()', 'cold StrictMode diff result');
    result.initial = await evaluate('window.editorLifecycle.snapshot()');
    console.log('FORGE3D_EDITOR_REFRESH_REQUEST');
    await waitFor(`window.editorLifecycle.calls.creationSubscriptions > ${result.initial.calls.creationSubscriptions}`, 'CodeEditor Fast Refresh effect replay');
    await pause(100);
    result.refreshedDiff = await evaluate('window.editorLifecycle.snapshot()');
    assert.equal(result.refreshedDiff.liveOwnedModels, 2, 'Fast Refresh must preserve the retained diff models');
    assert.equal(result.refreshedDiff.diffEditors, 1);
    assert.deepEqual(result.refreshedDiff.errors, []);
    assert.equal(await evaluate('window.editorLifecycle.insert("// refreshed edit\\n")'), true, 'Fast Refresh must preserve the imperative editor API');
    assert.match((await evaluate('window.editorLifecycle.snapshot()')).modifiedText, /refreshed edit/);
    await evaluate('window.editorLifecycle.update({code:"cube([24,12,8]);"})');
    await waitFor('window.editorLifecycle.snapshot().modifiedText === "cube([24,12,8]);"', 'external update after Fast Refresh');
    assert.equal(result.initial.liveOwnedModels, 2);
    for (let i = 0; i < 3; i++) {
      await evaluate('window.editorLifecycle.update({showDiff:false})');
      await waitFor('window.editorLifecycle.snapshot().diffEditors === 0 && Boolean(document.querySelector(".monaco-editor .view-lines"))', 'ordinary editor');
      await pause(150);
      result.closedDiff = await evaluate('window.editorLifecycle.snapshot()');
      assert.deepEqual(result.closedDiff.errors, [], 'closing Diff must not dispose models while attached');
      assert.equal(result.closedDiff.liveOwnedModels, 1);
      await evaluate(`window.editorLifecycle.update({showDiff:true,theme:'${i % 2 ? 'dark' : 'light'}'})`);
      await waitFor('window.editorLifecycle.ready()', 'diff remount result');
    }
    await evaluate('window.editorLifecycle.unmount()');
    await pause(200);
    result.unmountedDiff = await evaluate('window.editorLifecycle.snapshot()');
    assert.deepEqual(result.unmountedDiff.errors, []);
    assert.equal(result.unmountedDiff.liveOwnedModels, 0);
    assert.equal(result.unmountedDiff.diffEditors, 0);
    assert.equal(result.unmountedDiff.sharedModelAlive, true);
    await evaluate('window.editorLifecycle.mount(false)');
    await waitFor('Boolean(document.querySelector(".monaco-editor .view-lines"))', 'normal remount');
    assert.equal(await evaluate('window.editorLifecycle.insert("// normal edit\\n")'), true);
    await waitFor('window.editorLifecycle.code.includes("normal edit")', 'normal editor onChange');
    await evaluate('window.editorLifecycle.unmount()');
    await pause(200);
    result.settledFinal = await evaluate('window.editorLifecycle.snapshot()');
    assert.deepEqual(result.settledFinal.errors, []);
    assert.equal(result.settledFinal.liveOwnedModels, 0);
    await evaluate('window.editorLifecycle.closeDuringCreation = true; window.editorLifecycle.mount(true)');
    await waitFor('window.editorLifecycle.earlyModels >= 2 && window.editorLifecycle.snapshot().diffEditors === 0', 'close before onMount');
    await pause(200);
    result.earlyClose = await evaluate('window.editorLifecycle.snapshot()');
    assert.equal(result.earlyClose.errors.filter(error => error.includes('TextModel got disposed')).length, 0, 'early close must detach even before onMount');
    // Monaco's separate in-flight worker cancellation error remains observable.
    // This probe targets disposal order, without suppressing that known error.
    assert.ok(result.earlyClose.errors.every(error => error.startsWith('Error: no diff result available')));
    assert.equal(result.earlyClose.liveOwnedModels, 1);
    await evaluate('window.editorLifecycle.unmount()');
    await pause(200);
    result.final = await evaluate('window.editorLifecycle.snapshot()');
    assert.deepEqual(result.final.errors, result.earlyClose.errors);
    assert.equal(result.final.liveOwnedModels, 0);
    assert.equal(result.final.sharedModelAlive, true);
    assert.equal(result.final.calls.subscriptions, result.final.calls.unsubscriptions);
    assert.equal(result.final.calls.creationSubscriptions, result.final.calls.creationUnsubscriptions);
    assert.ok(Object.values(result.final.calls.modelDisposals).every(count => count === 1), 'every owned model must be disposed exactly once');
    console.log('FORGE3D_EDITOR_RESULT '+JSON.stringify({ ok:true,...result }));
    win.close();
    app.exit(0);
  } catch (error) {
    result.final = win ? await evaluate('window.editorLifecycle?.snapshot()').catch(() => null) : null;
    console.error('FORGE3D_EDITOR_RESULT '+JSON.stringify({ ok:false,error:error.stack,...result }));
    win?.close();
    app.exit(1);
  }
}
app.whenReady().then(run);
