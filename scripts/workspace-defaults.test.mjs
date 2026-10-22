import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { getDefaultWorkspace, loadWorkspace, saveWorkspace, STORAGE_KEY } from '../src/forge3d/workspace.js';

function storage(t, raw = null) {
  const previous = globalThis.window;
  const values = new Map(raw === null ? [] : [[STORAGE_KEY, raw]]);
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } };
  t.after(() => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  });
  return values;
}

test('fresh and reset workspace defaults enable Auto Render', (t) => {
  storage(t);
  assert.equal(getDefaultWorkspace().autoRun, true);
  assert.equal(loadWorkspace().autoRun, true);
});

test('workspace round trips preserve explicitly saved Auto Render on and off', (t) => {
  storage(t);
  for (const autoRun of [false, true]) {
    assert.equal(saveWorkspace({ ...getDefaultWorkspace(), autoRun, code: 'cube(3);' }), true);
    const restored = loadWorkspace();
    assert.equal(restored.autoRun, autoRun);
    assert.equal(restored.code, 'cube(3);');
  }
});

test('legacy missing or invalid Auto Render preferences use the enabled default', (t) => {
  const values = storage(t);
  for (const autoRun of [undefined, null, 'false', 'true', 0, 1, {}, []]) {
    values.set(STORAGE_KEY, JSON.stringify({ autoRun, code: 'sphere(2);' }));
    assert.equal(loadWorkspace().autoRun, true, JSON.stringify(autoRun));
    assert.equal(loadWorkspace().code, 'sphere(2);');
  }
});

test('unreadable or corrupt storage falls back to Auto Render enabled', (t) => {
  storage(t, '{broken');
  assert.equal(loadWorkspace().autoRun, true);
  globalThis.window.localStorage.getItem = () => { throw new Error('Storage unavailable'); };
  assert.equal(loadWorkspace().autoRun, true);
});

// Execute the real state initializers and effects with deferred IPC and fake timers.
// This covers ordering, cleanup, and debounce without adding a DOM test dependency.
const source = readFileSync(new URL('../src/Forge3D.jsx', import.meta.url), 'utf8');
const stateStart = source.indexOf('  const [autoRun, setAutoRun] = useState');
const stateEnd = source.indexOf('  const [renderProfile, setRenderProfile]', stateStart);
const effectStart = source.indexOf('  // Automatic renders wait for launch mode');
const effectEnd = source.indexOf('  useEffect(() => () => clearBuildTimeout()', effectStart);
assert.ok(stateStart >= 0 && stateEnd > stateStart && effectStart >= 0 && effectEnd > effectStart);
const effectSource = source.slice(stateStart, stateEnd) + source.slice(effectStart, effectEnd);

function autoRenderFlow(autoRun = true) {
  let resolveContext, rejectContext;
  const launch = new Promise((resolve, reject) => { resolveContext = resolve; rejectContext = reject; });
  const states = [], timers = new Map(), renders = [];
  let nextTimer = 0, cleanupTimer;
  const env = {
    initialWorkspace: { ...getDefaultWorkspace(), autoRun },
    code: 'cube(2);', timerRef: { current: null },
    forgeAPI: { getLaunchContext: () => launch },
    runCode: () => renders.push(env.code),
    setTimeout: (fn, delay) => { assert.equal(delay, 400); timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  };
  function effects() {
    const callbacks = [];
    let index = 0;
    env.useState = (initial) => {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value) => { states[slot] = value; }];
    };
    env.useEffect = (fn) => callbacks.push(fn);
    vm.runInNewContext(`(() => { ${effectSource} })()`, env);
    return callbacks;
  }
  const initialEffects = effects();
  const cleanupLaunch = initialEffects[0]();
  cleanupTimer = initialEffects[1]();
  return {
    states, env, timers, renders, resolveContext, rejectContext,
    update() { cleanupTimer?.(); cleanupTimer = effects()[1](); },
    flushTimers() { const queued = [...timers.values()]; timers.clear(); queued.forEach((fn) => fn()); },
    dispose() { cleanupLaunch(); cleanupTimer?.(); },
  };
}

const ordinaryLaunch = { mcp: { enabled: false }, releaseScreenshot: { enabled: false } };

test('Auto Render waits for confirmed ordinary launch context before scheduling', async () => {
  const flow = autoRenderFlow();
  assert.deepEqual(flow.states, [true, false]);
  flow.flushTimers();
  assert.equal(flow.renders.length, 0);
  flow.resolveContext(ordinaryLaunch);
  await Promise.resolve();
  flow.update();
  assert.equal(flow.timers.size, 1);
  flow.flushTimers();
  assert.deepEqual(flow.renders, ['cube(2);']);
  flow.dispose();
});

test('ordinary launch respects saved off and debounces updates when enabled', async () => {
  const flow = autoRenderFlow(false);
  flow.resolveContext(ordinaryLaunch);
  await Promise.resolve();
  flow.update();
  assert.equal(flow.timers.size, 0);
  flow.states[0] = true;
  flow.update();
  flow.env.code = 'cube(4);';
  flow.update();
  assert.equal(flow.timers.size, 1);
  flow.flushTimers();
  assert.deepEqual(flow.renders, ['cube(4);']);
  flow.env.code = '   ';
  flow.update();
  flow.flushTimers();
  assert.equal(flow.renders.length, 1);
  flow.dispose();
});

test('MCP and release screenshot sessions never automatically render restored or new source', async () => {
  for (const context of [
    { ...ordinaryLaunch, mcp: { enabled: true } },
    { ...ordinaryLaunch, releaseScreenshot: { enabled: true } },
  ]) {
    const flow = autoRenderFlow();
    flow.flushTimers();
    flow.resolveContext(context);
    await Promise.resolve();
    flow.update();
    assert.deepEqual(flow.states, [false, false]);
    // Resetting the workspace or toggling Auto must not bypass explicit-render mode.
    flow.states[0] = getDefaultWorkspace().autoRun;
    flow.env.code = 'sphere(5);';
    flow.update();
    flow.flushTimers();
    assert.equal(flow.renders.length, 0);
    flow.dispose();
  }
});

test('unknown, failed, or disposed launch-context requests cannot enable automatic rendering', async () => {
  for (const context of [undefined, null, {}, { mcp: {} }]) {
    const flow = autoRenderFlow();
    flow.resolveContext(context);
    await Promise.resolve();
    flow.update();
    assert.equal(flow.timers.size, 0);
    flow.dispose();
  }
  const failed = autoRenderFlow();
  failed.rejectContext(new Error('IPC failed'));
  await Promise.resolve();
  await Promise.resolve();
  failed.update();
  assert.equal(failed.timers.size, 0);
  failed.dispose();
  const disposed = autoRenderFlow();
  disposed.dispose();
  disposed.resolveContext(ordinaryLaunch);
  await Promise.resolve();
  assert.deepEqual(disposed.states, [true, false]);
});

test('a workspace reset restores Auto Render to its enabled default', () => {
  const start = source.indexOf('  const resetWorkspace = useCallback');
  const end = source.indexOf('  const openFile = useCallback', start);
  assert.ok(start >= 0 && end > start);
  let autoRun = false;
  const env = {
    getDefaultWorkspace, DEFAULT_FILE_NAME: 'main.scad', useCallback: (fn) => fn,
    setAutoRun: (value) => { autoRun = value; },
  };
  for (const name of ['queueAutoFitView', 'replaceCodeWithoutHistory', 'setActiveReference',
    'setSavedCode', 'setComparisonCode', 'setPendingExternalSnapshot', 'setCurrentFileName',
    'setCurrentFilePath', 'setRenderProfile', 'setSidebarTab', 'setSidebarOpen',
    'setStartState', 'setActiveTab', 'resetAssemblyState', 'setStatusMessage']) env[name] = () => {};
  vm.runInNewContext(`${source.slice(start, end)}; resetWorkspace();`, env);
  assert.equal(autoRun, true);
});
