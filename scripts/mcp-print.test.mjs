import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAssemblyPart } from '../src/forge3d/assembly.js';
import { getMcpPrintSnapshot, prepareMcpPrint } from '../src/forge3d/mcp-print.js';
import { createPrintBedOutline } from '../src/forge3d/print-bed.js';

const bed = { widthMm: 100, depthMm: 100, heightMm: 100 };
const part = (id, size = [20, 10, 20], transform) => createAssemblyPart({ id, name: id, geometry: new THREE.BoxGeometry(...size), transform });
const scene = (...parts) => ({ parts, selectedPartId: parts[0]?.id, snap: { enabled: true } });

test('print snapshot checks actual world placement, floor, height, and conservative overlap', () => {
  const result = getMcpPrintSnapshot(scene(part('a'), part('b'), part('outside', [20, 10, 20], { position: [60, 120, 0] })), { bed });
  assert.equal(result.placementReady, false);
  assert.deepEqual(result.overlapPairs, [['a', 'b']]);
  assert.deepEqual(result.parts[0].issues, ['outside-bed-volume', 'below-floor', 'aabb-overlap']);
  assert.deepEqual(result.parts[2].issues, ['outside-bed-volume', 'above-floor']);
  assert.equal(result.capabilities.slicing, false);
  assert.equal(result.capabilities.gcode, false);
});

test('preparation floors, spaces, and wraps parts while preserving rotation/scale and source scene', () => {
  const parts = [part('a', [30, 10, 30], { position: [100, 80, 20], rotation: [0, 90, 0], scale: [2, 1, 1] }), part('b', [50, 10, 20]), part('c')];
  const original = scene(...parts);
  const before = JSON.stringify(parts.map((entry) => entry.transform));
  const prepared = prepareMcpPrint(original, { bed, spacingMm: 5 });
  assert.equal(prepared.print.placementReady, true);
  assert.deepEqual(prepared.print.overlapPairs, []);
  assert.equal(JSON.stringify(parts.map((entry) => entry.transform)), before);
  assert.deepEqual(prepared.scene.parts[0].transform.rotation, parts[0].transform.rotation);
  assert.deepEqual(prepared.scene.parts[0].transform.scale, parts[0].transform.scale);
  assert.deepEqual(prepared.print.parts.map((entry) => entry.bounds.min.y), [0, 0, 0]);
  assert.ok(prepared.print.parts[2].bounds.min.z > prepared.print.parts[0].bounds.min.z);
  assert.deepEqual(prepareMcpPrint(original, { bed, spacingMm: 5 }).scene.parts.map((entry) => entry.transform), prepared.scene.parts.map((entry) => entry.transform));
  assert.deepEqual(getMcpPrintSnapshot(prepared.scene).bed, { ...bed, origin: 'center-xz-floor-y', source: 'prepared-scene' });
});

test('selected scope is explicit and untouched excluded parts retain identity', () => {
  const a = part('a'), b = part('b');
  const prepared = prepareMcpPrint(scene(a, b), { bed, partIds: ['b'] });
  assert.equal(prepared.scene.parts[0], a);
  assert.deepEqual(prepared.print.partIds, ['b']);
  assert.deepEqual(prepared.print.excludedPartIds, ['a']);
});

test('failed arrangement is atomic, with clear oversized, crowded, hidden, and locked failures', () => {
  const crowded = scene(part('a', [60, 10, 60]), part('b', [60, 10, 60]));
  const before = JSON.stringify(crowded.parts.map((entry) => entry.transform));
  assert.throws(() => prepareMcpPrint(crowded, { bed }), /Shelf arrangement does not fit/);
  assert.equal(JSON.stringify(crowded.parts.map((entry) => entry.transform)), before);
  assert.throws(() => prepareMcpPrint(scene(part('huge', [101, 10, 10])), { bed, spacingMm: 0 }), /does not fit/);
  assert.throws(() => prepareMcpPrint(scene({ ...part('a'), locked: true }), { bed }), /Unlock/);
  assert.throws(() => prepareMcpPrint(scene({ ...part('a'), visible: false }), { bed, partIds: ['a'] }), /Show/);
});

test('touching boundaries are valid and touching parts are not AABB overlaps', () => {
  const result = prepareMcpPrint(scene(part('a', [50, 100, 100]), part('b', [50, 100, 100])), { bed, spacingMm: 0 });
  assert.equal(result.print.placementReady, true);
  assert.deepEqual(result.print.overlapPairs, []);
});

test('invalid arguments and geometry fail before mutating a scene', () => {
  const original = scene(part('a'));
  for (const invalid of [{ ...bed, widthMm: Infinity }, { ...bed, depthMm: -1 }, {}]) {
    assert.throws(() => getMcpPrintSnapshot(original, { bed: invalid }), /Print bed/);
  }
  assert.throws(() => prepareMcpPrint(original), /explicit bed/);
  assert.throws(() => prepareMcpPrint(original, { bed, spacingMm: NaN }), /spacingMm/);
  for (const partIds of [[], ['a', 'a'], ['missing'], [42]]) assert.throws(() => getMcpPrintSnapshot(original, { partIds }));
  assert.equal(getMcpPrintSnapshot(scene()).placementReady, false);
  const invalid = part('invalid');
  invalid.geometry.getAttribute('position').setX(0, NaN);
  assert.deepEqual(getMcpPrintSnapshot(scene(invalid)).parts[0].issues, ['invalid-or-degenerate-geometry']);
  assert.throws(() => prepareMcpPrint(scene(invalid), { bed }), /invalid or degenerate/);
  const flat = part('flat', [20, 0, 20]);
  assert.throws(() => prepareMcpPrint(scene(flat), { bed }), /degenerate/);
});

test('print bed outline matches centered XZ floor bounds and is excluded from exports', () => {
  const outline = createPrintBedOutline({ widthMm: 250, depthMm: 210, heightMm: 200 });
  assert.equal(outline.userData.forgeExcludeFromExport, true);
  const bounds = new THREE.Box3().setFromObject(outline);
  assert.deepEqual(bounds.min.toArray(), [-125, 0, -105]);
  assert.deepEqual(bounds.max.toArray(), [125, 0, 105]);
  assert.equal(createPrintBedOutline({ widthMm: Infinity, depthMm: 210, heightMm: 200 }), null);
  assert.equal(createPrintBedOutline(undefined), null);
  outline.geometry.dispose();
  outline.material.dispose();
});
