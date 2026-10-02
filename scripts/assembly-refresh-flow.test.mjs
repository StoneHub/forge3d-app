import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from 'three';
import { createAssemblyGeometryFromDesignGeometry } from '../src/forge3d/assembly.js';
import { isCurrentDesignRender } from '../src/forge3d/assembly-refresh.js';

// Exercise the production callbacks, including their captured render-time values.
// This catches stale React closures that pure geometry tests cannot reproduce.
const source = readFileSync(new URL('../src/Forge3D.jsx', import.meta.url), 'utf8');
function callback(name, next) {
  const start = source.indexOf(`  const ${name} = useCallback`);
  const end = source.indexOf(`  const ${next} = useCallback`, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

function assemblyFlow() {
  let finishRender;
  const added = [];
  const document = { documentId: 'document-a', filePath: null, sourceCode: 'cube(2);' };
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const env = {
    useCallback: (fn) => fn,
    latestRenderedGeometryRef: { current: geometry }, stlGeometry: geometry,
    latestRenderMetaRef: { current: { ...document, profileId: 'quick' } },
    latestDesignDocumentRef: { current: document }, renderRequestIdRef: { current: null },
    hasCurrentRenderableGeometry: true, currentFileName: 'A.scad', currentFilePath: null,
    designDocumentIdRef: { current: document.documentId },
    addAssemblyPart: (part) => { added.push(part); return part; },
    createAssemblyGeometryFromDesignGeometry, isCurrentDesignRender,
    setStatusMessage() {}, setMode() {}, setSidebarTab() {}, setSidebarOpen() {}, setRenderProfile() {},
    assemblyScene: { parts: [] }, hasCurrentFinalRender: false, renderProfile: 'quick',
    runCode: () => new Promise((resolve) => { finishRender = resolve; }),
  };
  vm.runInNewContext(
    callback('addCurrentRenderToAssembly', 'updateAssemblyPart')
      + callback('enterAssemblyMode', 'returnToDesignMode')
      + ';globalThis.enter = enterAssemblyMode;', env,
  );
  return { env, added, finish: (ok) => finishRender(ok) };
}

test('pending Final-to-Assembly handoff cannot stamp an old unsaved mesh with a new document identity', async () => {
  const { env, added, finish } = assemblyFlow();
  const pending = env.enter();
  env.designDocumentIdRef.current = 'document-b';
  env.latestDesignDocumentRef.current = { ...env.latestDesignDocumentRef.current, documentId: 'document-b' };
  // Even if an earlier async success reaches the old closure, it must fail closed.
  finish(true);
  await pending;
  assert.equal(added.length, 0);
});

test('pending Final handoff rejects edits and newer builds instead of adding an outdated mesh', async () => {
  for (const change of ['edit', 'build']) {
    const { env, added, finish } = assemblyFlow();
    const pending = env.enter();
    if (change === 'edit') env.latestDesignDocumentRef.current = { ...env.latestDesignDocumentRef.current, sourceCode: 'cube(3);' };
    else env.renderRequestIdRef.current = 'newer-build';
    finish(true);
    await pending;
    assert.equal(added.length, 0, change);
  }
});

test('successful Final handoff uses the fresh geometry and its matching provenance', async () => {
  const { env, added, finish } = assemblyFlow();
  const pending = env.enter();
  env.latestRenderedGeometryRef.current = new THREE.BoxGeometry(4, 6, 8);
  env.latestRenderMetaRef.current = { ...env.latestDesignDocumentRef.current, profileId: 'final' };
  finish(true);
  await pending;
  assert.equal(added.length, 1);
  assert.equal(added[0].source.documentId, 'document-a');
  assert.equal(added[0].source.filePath, null);
  assert.deepEqual(added[0].geometry.boundingBox.getSize(new THREE.Vector3()).toArray(), [4, 8, 6]);
});

test('starting a different document invalidates and cancels the active render before its result arrives', async () => {
  const cancelled = [];
  let timeoutCleared = false;
  const env = {
    useCallback: (fn) => fn, crypto: { randomUUID: () => 'new-document' },
    designDocumentIdRef: { current: 'old-document' }, buildIdRef: { current: 7 },
    clearBuildTimeout: () => { timeoutCleared = true; }, renderRequestIdRef: { current: 'render-7' },
    forgeAPI: { cancelOpenScadRender: async (id) => cancelled.push(id) },
    latestRenderedGeometryRef: { current: {} },
    updateCurrentRenderMeta: (meta) => { env.meta = meta; },
    setStlGeometry: (geometry) => { env.geometry = geometry; },
    setBuilding: (building) => { env.building = building; }, setBuildStatusDetail() {},
    setAssemblyHistory() {}, replaceHistoryState: (state) => state, DEFAULT_ASSEMBLY_SCENE: {},
    setAssemblyMeasurement() {}, DEFAULT_ASSEMBLY_MEASUREMENT: {},
    setAssemblyScenePath() {}, setBooleanOperandId() {}, setMode() {},
  };
  vm.runInNewContext(callback('resetAssemblyState', 'replaceAssemblySceneWithoutHistory') + ';resetAssemblyState();', env);
  await Promise.resolve();
  assert.equal(env.designDocumentIdRef.current, 'new-document');
  assert.equal(env.buildIdRef.current, 8);
  assert.equal(env.renderRequestIdRef.current, null);
  assert.equal(env.latestRenderedGeometryRef.current, null);
  assert.equal(env.geometry, null);
  assert.equal(env.meta.sourceCode, null);
  assert.equal(env.building, false);
  assert.equal(timeoutCleared, true);
  assert.deepEqual(cancelled, ['render-7']);
});

function renderFlow() {
  const requests = [];
  const timers = [];
  const loaded = [];
  const env = {
    useCallback: (fn) => fn,
    getRenderProfileConfig: (id) => ({ id, label: id, defineOverrides: [] }),
    renderProfile: 'final', previewCode: 'cube(2);', currentFileName: 'A.scad', currentFilePath: '/A.scad',
    DEFAULT_FILE_NAME: 'main.scad', designDocumentIdRef: { current: 'document-a' },
    buildIdRef: { current: 0 }, renderRequestIdRef: { current: null },
    currentBuildProfileRef: { current: null }, renderLogBufferRef: { current: [] },
    buildStartRef: { current: 0 }, buildTimeoutRef: { current: null },
    latestRenderedGeometryRef: { current: {} }, BUILD_TIMEOUT: 1000,
    performance: { now: () => 100 },
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearBuildTimeout() {},
    setBuilding: (value) => { env.building = value; }, setBuildElapsedMs() {}, setBuildStatusDetail() {},
    setStatusMessage() {}, setResult() {}, setActiveTab() {}, setStlGeometry() {},
    formatBuildElapsed: () => '1s',
    updateCurrentRenderMeta: (meta) => { env.meta = meta; },
    loadStlBytes: (bytes) => { loaded.push(bytes); return 12; },
    buildRenderDiagnostics: () => ({ errors: [], warnings: [], logs: [] }),
    buildRenderLifecycleLogEntries: () => [],
    forgeAPI: { renderOpenSCAD: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
  };
  vm.runInNewContext(callback('runCode', 'cancelBuild') + ';globalThis.run = runCode;', env);
  return { env, requests, timers, loaded };
}

test('timed-out native results never restore refreshable geometry', async () => {
  const { env, requests, timers, loaded } = renderFlow();
  const pending = env.run();
  timers[0]();
  requests[0].resolve({ stl: [1, 2, 3] });
  await pending;
  assert.equal(loaded.length, 0);
  assert.equal(env.meta.sourceCode, null);
  assert.equal(env.latestRenderedGeometryRef.current, null);
});

test('late success and failure cannot overwrite a newer successful render', async () => {
  for (const outcome of ['success', 'failure']) {
    const { env, requests, loaded } = renderFlow();
    const older = env.run();
    const newer = env.run();
    requests[1].resolve({ stl: [4, 5, 6] });
    assert.equal(await newer, true);
    const newestMeta = env.meta;
    if (outcome === 'success') requests[0].resolve({ stl: [1, 2, 3] });
    else requests[0].reject(new Error('old render failed'));
    await older;
    assert.equal(loaded.length, 1, outcome);
    assert.equal(env.meta, newestMeta, outcome);
  }
});

test('a native response for a replaced document is rejected even without a newer build', async () => {
  const { env, requests, loaded } = renderFlow();
  const pending = env.run();
  env.designDocumentIdRef.current = 'document-b';
  requests[0].resolve({ stl: [1, 2, 3] });
  assert.equal(await pending, false);
  assert.equal(loaded.length, 0);
});

test('cancellation invalidates immediately and cannot clear a newer render when native cancellation resolves late', async () => {
  let finishCancel;
  const env = {
    useCallback: (fn) => fn, buildIdRef: { current: 1 }, clearBuildTimeout() {},
    renderRequestIdRef: { current: 'render-a' }, latestRenderedGeometryRef: { current: { name: 'a' } },
    forgeAPI: { cancelOpenScadRender: () => new Promise((resolve) => { finishCancel = resolve; }) },
    updateCurrentRenderMeta: (meta) => { env.meta = meta; },
    setBuilding: (value) => { env.building = value; },
    setBuildStatusDetail: (value) => { env.detail = value; },
    setStatusMessage: (value) => { env.status = value; },
  };
  vm.runInNewContext(callback('cancelBuild', 'startResize') + ';globalThis.cancel = cancelBuild;', env);
  const pending = env.cancel();
  assert.equal(env.latestRenderedGeometryRef.current, null);
  assert.equal(env.meta.sourceCode, null);
  assert.equal(env.building, false);
  const geometryB = { name: 'b' };
  const metaB = { documentId: 'document-b', sourceCode: 'cube(3);' };
  env.latestRenderedGeometryRef.current = geometryB;
  env.meta = metaB;
  env.detail = 'Render complete';
  env.status = 'Render complete';
  finishCancel();
  await pending;
  assert.equal(env.latestRenderedGeometryRef.current, geometryB);
  assert.equal(env.meta, metaB);
  assert.equal(env.detail, 'Render complete');
  assert.equal(env.status, 'Render complete');
});
