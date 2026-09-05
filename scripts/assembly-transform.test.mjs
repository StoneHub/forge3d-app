import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyAssemblyTransform, buildAssemblyTransformMatrix, normalizeTransform,
  getAssemblyPartWorldBox, createFloorAlignedTransform, createCenteredTransform,
  scadToViewportMatrix, viewportToScadMatrix } from '../src/forge3d/assembly-transform.js';
import { createAssemblyPart, serializeAssemblyGeometry, serializeAssemblyScene, deserializeAssemblyScene } from '../src/forge3d/assembly.js';

const near = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-5, `${actual} != ${expected}`));

test('translated, rotated and non-uniformly scaled meshes share the bounds matrix', () => {
  const geometry = new THREE.BoxGeometry(2, 4, 6);
  geometry.computeBoundingBox();
  const transform = { position: [10, 20, 30], rotation: [0, 0, 90], scale: [2, 3, 4] };
  const part = { geometry, transform };
  const mesh = new THREE.Mesh(geometry);
  applyAssemblyTransform(mesh, transform);
  near(mesh.matrix.elements, buildAssemblyTransformMatrix(transform).elements);
  const box = getAssemblyPartWorldBox(part);
  near(box.min.toArray(), [4, 18, 18]);
  near(box.max.toArray(), [16, 22, 42]);
  near(new THREE.Box3().setFromObject(mesh).min.toArray(), box.min.toArray());
});

test('floor and centering use the final override rotation and scale without mutating input', () => {
  const geometry = new THREE.BoxGeometry(2, 4, 6);
  geometry.computeBoundingBox();
  const part = { geometry, transform: { position: [10, 20, 30], rotation: [0, 0, 0], scale: [1, 1, 1] } };
  const overrides = { rotation: [90, 0, 0], scale: [1, 2, 1], position: [10, 100, 30] };
  const floor = createFloorAlignedTransform(part, overrides);
  near(floor.position, [10, 3, 30]);
  near(getAssemblyPartWorldBox({ ...part, transform: floor }).min.toArray(), [9, 0, 26]);
  const centered = createCenteredTransform(part, overrides);
  near(centered.position, [0, 3, 0]);
  near(part.transform.position, [10, 20, 30]);
  near(overrides.position, [10, 100, 30]);
});

test('normalization and scene round-trip preserve finite transforms without sharing arrays', () => {
  const transform = normalizeTransform({ position: [4, NaN], rotation: [0, 90, Infinity], scale: [2] });
  assert.deepEqual(transform, { position: [4, 0, 0], rotation: [0, 90, 0], scale: [2, 1, 1] });
  const part = createAssemblyPart({ geometry: new THREE.BoxGeometry(1, 1, 1), transform });
  const loaded = deserializeAssemblyScene(serializeAssemblyScene({ parts: [part] }));
  assert.deepEqual(loaded.parts[0].transform, transform);
  loaded.parts[0].transform.position[0] = 999;
  assert.equal(part.transform.position[0], 4);
  const mesh = new THREE.Mesh();
  applyAssemblyTransform(mesh, { scale: [0, 1, 1] });
  assert.ok(mesh.matrix.elements.every(Number.isFinite));
});

test('rotated curved geometry touches the floor rather than its oversized local bounding box', () => {
  const part = createAssemblyPart({ geometry: new THREE.SphereGeometry(1, 32, 16),
    transform: { position: [8, 12, 3], rotation: [0, 0, 45], scale: [1, 1, 1] } });
  const transform = createFloorAlignedTransform(part);
  const mesh = new THREE.Mesh(part.geometry);
  applyAssemblyTransform(mesh, transform);
  const actual = new THREE.Box3().setFromObject(mesh, true);
  assert.ok(Math.abs(actual.min.y) < 1e-6, `Sphere floats ${actual.min.y} above floor`);
  near(getAssemblyPartWorldBox({ ...part, transform }).min.toArray(), actual.min.toArray());
});

test('source and viewport coordinate conversions are inverses', () => {
  const source = new THREE.Vector3(3, 5, 7);
  const viewport = source.clone().applyMatrix4(scadToViewportMatrix());
  near(viewport.toArray(), [3, 7, -5]);
  near(viewport.applyMatrix4(viewportToScadMatrix()).toArray(), source.toArray());
});

test('real boolean worker includes operand scale and rotation', async (t) => {
  const previous = globalThis.self;
  let response;
  globalThis.self = { postMessage: (value) => { response = value; } };
  t.after(() => { if (previous === undefined) delete globalThis.self; else globalThis.self = previous; });
  await import('../src/forge3d/assembly-boolean-worker.js');
  const geometry = serializeAssemblyGeometry(new THREE.BoxGeometry(2, 2, 2).toNonIndexed());
  const run = (transform) => {
    self.onmessage({ data: { requestId: 'test', operation: 'union', primary: { geometry, transform },
      operand: { geometry, transform: { position: [10, 0, 0] } } } });
    assert.equal(response.ok, true, response.error);
    const positions = response.geometry.position;
    return [0, 1, 2].map((axis) => {
      const values = positions.filter((_, i) => i % 3 === axis);
      return [Math.min(...values), Math.max(...values)];
    });
  };
  const scaled = run({ scale: [3, 1, 1] });
  near(scaled.flat(), [-3, 11, -1, 1, -1, 1]);
  const combined = run({ position: [2, 4, 0], rotation: [0, 0, 90], scale: [3, 1, 1] });
  near(combined.flat(), [1, 11, -1, 7, -1, 1]);
});
