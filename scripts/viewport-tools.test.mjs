import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import { appendMeasurementPick, clearMeasurementDraft } from '../src/forge3d/measurement.js';
import { createHoleTool } from '../src/forge3d/surface-hole.js';
import { createAssemblyPart, serializeAssemblyScene, deserializeAssemblyScene } from '../src/forge3d/assembly.js';
import { buildAssemblyTransformMatrix, viewportToScadMatrix } from '../src/forge3d/assembly-transform.js';

const near = (actual, expected, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
function volume(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = g.getAttribute('position');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let result = 0;
  for (let i = 0; i < p.count; i += 3) result += a.fromBufferAttribute(p, i).dot(b.fromBufferAttribute(p, i + 1).cross(c.fromBufferAttribute(p, i + 2))) / 6;
  return Math.abs(result);
}

test('surface picks preserve real coordinates, show a 3-4-5 distance, and begin a fresh pair', () => {
  let state = {};
  for (const position of [[12, -8, 5], [15, -4, 5]]) state = appendMeasurementPick(state, { position, partId: 'a' }, () => 'Part').nextMeasurement;
  near(state.distance, 5);
  assert.deepEqual(state.points[0].position, [12, -8, 5]);
  assert.equal(state.history.length, 1);
  state = appendMeasurementPick(state, { position: [100, 0, 0] }, () => 'Part').nextMeasurement;
  assert.equal(state.points.length, 1);
  assert.equal(state.distance, null);
  assert.equal(clearMeasurementDraft(state).enabled, false);
});

test('through-hole removes the expected cylinder volume and retains source and cutter through scene round-trip', () => {
  const part = createAssemblyPart({ name: 'Block', geometry: new THREE.BoxGeometry(20, 10, 20).toNonIndexed() });
  const tool = createHoleTool(part, { position: [0, 5, 0], normal: [0, 1, 0] }, 4);
  const result = CSG.subtract(new THREE.Mesh(part.geometry), new THREE.Mesh(tool.geometry));
  const polygonArea = 64 / 2 * 2 ** 2 * Math.sin(2 * Math.PI / 64);
  near(volume(result.geometry), 4000 - polygonArea * 10, 0.01);
  near(volume(part.geometry), 4000);
  const cutter = createAssemblyPart({ name: 'Cutter', geometry: tool.geometry, visible: false, metadata: { scad: tool.scad } });
  const restored = deserializeAssemblyScene(serializeAssemblyScene({ parts: [part, cutter] }));
  assert.equal(restored.parts[1].visible, false);
  assert.equal(restored.parts[1].metadata.scad, tool.scad);
  near(volume(restored.parts[1].geometry), volume(tool.geometry));
});

test('surface normal and SCAD frame agree for rotated, nonuniformly scaled parts', () => {
  const part = createAssemblyPart({ geometry: new THREE.BoxGeometry(20, 10, 14).toNonIndexed(), transform: { position: [13, 27, -8], rotation: [33, -19, 61], scale: [2, 0.6, 1.5] } });
  const matrix = buildAssemblyTransformMatrix(part.transform);
  const point = new THREE.Vector3(0, 5, 0).applyMatrix4(matrix);
  const normal = new THREE.Vector3(0, 1, 0).applyMatrix3(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();
  const tool = createHoleTool(part, { position: point.toArray(), normal: normal.toArray() }, 3);
  const rows = JSON.parse(tool.scad.match(/multmatrix\((.*)\)/)[1]);
  const scadMatrix = new THREE.Matrix4().set(...rows.flat());
  const scadCenter = new THREE.Vector3().applyMatrix4(scadMatrix);
  near(scadCenter.distanceTo(new THREE.Vector3(...tool.center).applyMatrix4(viewportToScadMatrix())), 0);
  const scadAxis = new THREE.Vector3(0, 0, 1).transformDirection(scadMatrix);
  near(scadAxis.distanceTo(normal.clone().transformDirection(viewportToScadMatrix())), 0);
  const mesh = new THREE.Mesh(part.geometry.clone().applyMatrix4(matrix));
  const result = CSG.subtract(mesh, new THREE.Mesh(tool.geometry));
  assert.ok(volume(result.geometry) < volume(mesh.geometry) - 1);
  assert.ok(volume(result.geometry) > 0);
});

test('invalid hole sizes and surface normals are rejected', () => {
  const part = createAssemblyPart({ geometry: new THREE.BoxGeometry(10, 10, 10) });
  for (const d of [0, -1, NaN, Infinity, 10001]) assert.throws(() => createHoleTool(part, { position: [0, 5, 0], normal: [0, 1, 0] }, d));
  assert.throws(() => createHoleTool(part, { position: [0, 5, 0], normal: [0, 0, 0] }, 3));
});
