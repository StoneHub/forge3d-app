import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAssemblyPart, deserializeAssemblyScene, duplicateAssemblyPart, serializeAssemblyScene } from '../src/forge3d/assembly.js';
import { getAssemblyRefreshBlockReason, isCurrentDesignRender, refreshAssemblyPartFromRender } from '../src/forge3d/assembly-refresh.js';
import { createHistoryState, pushHistoryState, redoHistoryState, undoHistoryState } from '../src/forge3d/history.js';

function fixture({ filePath = '/models/bracket.scad' } = {}) {
  const document = { documentId: 'document-a', filePath, sourceCode: 'cube(4);' };
  const part = createAssemblyPart({
    name: 'Bracket', geometry: new THREE.BoxGeometry(2, 2, 2),
    source: { kind: 'active-render', filePath, documentId: document.documentId },
    transform: { position: [19, 23, -7], rotation: [31, 42, 53], scale: [2, 3, 4] },
    visible: false, metadata: { note: 'keep me' },
  });
  const context = { geometry: new THREE.BoxGeometry(4, 8, 12), document,
    renderMeta: { ...document, profileId: 'final' }, building: false };
  return { part, context };
}

test('refresh clones and converts geometry without changing placement or part properties', () => {
  const { part, context } = fixture();
  const before = serializeAssemblyScene({ parts: [part] });
  const refreshed = refreshAssemblyPartFromRender(part, context);
  assert.notEqual(refreshed, part);
  assert.notEqual(refreshed.geometry, part.geometry);
  assert.notEqual(refreshed.geometry, context.geometry);
  assert.deepEqual(refreshed.transform, part.transform);
  for (const key of ['id', 'name', 'source', 'visible', 'locked', 'metadata']) assert.deepEqual(refreshed[key], part[key]);
  assert.deepEqual(refreshed.geometry.boundingBox.getSize(new THREE.Vector3()).toArray(), [4, 12, 8]);
  assert.deepEqual(serializeAssemblyScene({ parts: [part] }), before);
  assert.deepEqual(new THREE.Box3().setFromBufferAttribute(context.geometry.getAttribute('position')).getSize(new THREE.Vector3()).toArray(), [4, 8, 12]);
});

test('unrelated saved files cannot refresh even when their code is identical', () => {
  const { part, context } = fixture();
  context.document = { ...context.document, filePath: '/other/bracket.scad' };
  context.renderMeta = { ...context.document };
  assert.equal(refreshAssemblyPartFromRender(part, context), part);
  assert.match(getAssemblyRefreshBlockReason(part, context), /original source/);
});

test('unsaved buffers require a matching session identity; legacy null paths fail closed', () => {
  const { part, context } = fixture({ filePath: null });
  assert.notEqual(refreshAssemblyPartFromRender(part, context), part);
  context.document = { ...context.document, documentId: 'other-unsaved-document' };
  context.renderMeta = { ...context.document };
  assert.equal(refreshAssemblyPartFromRender(part, context), part);
  const legacy = { ...part, source: { kind: 'active-render', filePath: null } };
  assert.equal(refreshAssemblyPartFromRender(legacy, context), legacy);
});

test('saving an unsaved document keeps its identity, but requires a render at the new path', () => {
  const { part, context } = fixture({ filePath: null });
  context.document = { ...context.document, filePath: '/models/saved.scad' };
  assert.equal(refreshAssemblyPartFromRender(part, context), part);
  context.renderMeta = { ...context.document };
  const refreshed = refreshAssemblyPartFromRender(part, context);
  assert.notEqual(refreshed, part);
  assert.equal(refreshed.source.filePath, '/models/saved.scad');
  const restored = deserializeAssemblyScene(serializeAssemblyScene({ parts: [refreshed] })).parts[0];
  context.document.documentId = 'reopened-after-save';
  context.renderMeta = { ...context.document };
  assert.notEqual(refreshAssemblyPartFromRender(restored, context), restored);
  assert.equal(part.source.filePath, null);
});

test('saved scene round trips and legacy saved sources can refresh only their original file', () => {
  const { part, context } = fixture();
  delete part.source.documentId;
  const restored = deserializeAssemblyScene(serializeAssemblyScene({ parts: [part] })).parts[0];
  context.document.documentId = 'reopened-session';
  context.renderMeta = { ...context.document };
  assert.notEqual(refreshAssemblyPartFromRender(restored, context), restored);
  const duplicate = duplicateAssemblyPart(restored);
  const updated = refreshAssemblyPartFromRender(duplicate, context);
  assert.deepEqual(updated.transform, duplicate.transform);
});

test('locked, stale, missing, busy, failed, cancelled and wrong-document renders fail closed', () => {
  const { part, context } = fixture();
  const scenarios = [
    { ...context, geometry: null },
    { ...context, building: true },
    { ...context, renderMeta: { profileId: null, sourceCode: null } },
    { ...context, document: { ...context.document, sourceCode: 'cube(5);' } },
    { ...context, renderMeta: { ...context.renderMeta, documentId: 'old-session' } },
    { ...context, renderMeta: { ...context.renderMeta, filePath: '/other.scad' } },
  ];
  for (const scenario of scenarios) {
    assert.equal(isCurrentDesignRender(scenario), false);
    assert.equal(refreshAssemblyPartFromRender(part, scenario), part);
  }
  const locked = { ...part, locked: true };
  assert.equal(refreshAssemblyPartFromRender(locked, context), locked);
  assert.match(getAssemblyRefreshBlockReason(locked, context), /Unlock/);
  for (const kind of ['scad-file', 'stl-file', 'boolean']) {
    const imported = { ...part, source: { ...part.source, kind } };
    assert.equal(refreshAssemblyPartFromRender(imported, context), imported);
  }
  assert.equal(refreshAssemblyPartFromRender(null, context), null);
});

test('refresh is one undoable geometry update; repeated refreshes preserve transforms', () => {
  const { part, context } = fixture();
  const other = duplicateAssemblyPart(part);
  const scene = { parts: [part, other], selectedPartId: part.id };
  const refreshed = refreshAssemblyPartFromRender(part, context);
  const next = { ...scene, parts: [refreshed, other] };
  const history = pushHistoryState(createHistoryState(scene), next);
  const undone = undoHistoryState(history);
  assert.equal(undone.state.present, scene);
  assert.equal(redoHistoryState(undone.state).state.present, next);
  assert.equal(next.parts[1], other);
  assert.deepEqual(refreshAssemblyPartFromRender(refreshed, context).transform, part.transform);
});
