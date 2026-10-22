import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssemblyPart, createAssemblyGeometryFromDesignGeometry } from '../src/forge3d/assembly.js';
import { parseSTL } from '../src/forge3d/stl-parser.js';
import { assertAssemblyCapacity, assertAssemblyRevision, validateAssemblyTransform, getMcpAssemblySnapshot, updateMcpAssemblyPart, duplicateMcpAssemblyPart, removeMcpAssemblyPart, exportMcpAssemblyStl } from '../src/forge3d/mcp-assembly.js';

function scene() {
  const original = new THREE.BoxGeometry(10, 20, 30).toNonIndexed();
  const geometry = createAssemblyGeometryFromDesignGeometry(original);
  return { parts: [createAssemblyPart({ id: 'block', name: 'Block', geometry })], selectedPartId: 'block', snap: {} };
}

test('assembly edits preserve independent copies and require unlocking before transform/removal', () => {
  const initial = scene();
  const duplicated = duplicateMcpAssemblyPart(initial, { partId: 'block', instances: [ { name: 'Left', transform: { position: [25, 0, 0] } }, { name: 'Right', transform: { position: [-25, 0, 0] } } ] });
  assert.equal(duplicated.parts.length, 3);
  assert.notEqual(duplicated.parts[1].geometry, initial.parts[0].geometry);
  assert.equal(initial.parts.length, 1);
  const locked = updateMcpAssemblyPart(duplicated, { partId: 'block', locked: true });
  assert.throws(() => updateMcpAssemblyPart(locked, { partId: 'block', transform: { position: [1, 2, 3] } }), /Unlock/);
  assert.throws(() => removeMcpAssemblyPart(locked, 'block'), /Unlock/);
  const unlocked = updateMcpAssemblyPart(locked, { partId: 'block', locked: false });
  assert.equal(removeMcpAssemblyPart(unlocked, 'block').parts.length, 2);
});

test('assembly transform validation rejects invalid vectors and handles stale revisions', () => {
  for (const value of [{ position: [1, 2] }, { rotation: [0, Infinity, 0] }, { scale: [1, 0, 1] }, { extra: [0, 0, 0] }]) assert.throws(() => validateAssemblyTransform(value));
  assert.throws(() => assertAssemblyRevision(4, 3), /current revision 4/);
  assert.throws(() => assertAssemblyRevision(0, undefined), /Read forge3d_get_assembly/);
  assertAssemblyRevision(3, 3);
  assert.throws(() => assertAssemblyCapacity(scene(), 1000000, 0), /limit exceeded/);
  assert.throws(() => duplicateMcpAssemblyPart(scene(), { partId: 'block', instances: [] }), /between 1 and 200/);
});

test('combined assembly STL preserves millimeter dimensions and converts viewport placement back to OpenSCAD axes', () => {
  let state = scene();
  state = updateMcpAssemblyPart(state, { partId: 'block', transform: { position: [40, 50, -60] } });
  state = duplicateMcpAssemblyPart(state, { partId: 'block', instances: [{ name: 'Hidden', transform: { position: [500, 500, 500] } }] });
  state = updateMcpAssemblyPart(state, { partId: state.parts[1].id, visible: false });
  const exported = exportMcpAssemblyStl(state);
  const parsed = parseSTL(new TextEncoder().encode(exported));
  assert.equal(parsed.vertices.length / 9, 12);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(parsed.vertices, 3));
  geometry.computeBoundingBox();
  assert.deepEqual(geometry.boundingBox.min.toArray(), [35, 50, 35]);
  assert.deepEqual(geometry.boundingBox.max.toArray(), [45, 70, 65]);
  const snapshot = getMcpAssemblySnapshot(state, 7, 'assembly');
  assert.equal(snapshot.revision, 7);
  assert.equal(snapshot.parts[0].triangles, 12);
  assert.equal(snapshot.coordinateSystem, 'viewport Y-up');
  state.parts.forEach((part) => { part.visible = false; });
  assert.throws(() => exportMcpAssemblyStl(state), /No visible geometry/);
});

test('large instance groups preserve supplied XYZ rotations and scale without UI snap rounding', () => {
  const initial = scene();
  const copies = duplicateMcpAssemblyPart(initial, { partId: 'block', instances: Array.from({ length: 100 }, (_, index) => ({ transform: { position: [index * 20.25, 0, 0], rotation: [0, 3.5 * index, 0], scale: [1, 2, 0.5] } })) });
  assert.equal(copies.parts.length, 101);
  assert.deepEqual(copies.parts[2].transform, { position: [20.25, 0, 0], rotation: [0, 3.5, 0], scale: [1, 2, 0.5] });
  assert.equal(new Set(copies.parts.map((part) => part.id)).size, 101);
});
