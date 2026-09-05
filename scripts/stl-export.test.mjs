import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { exportSceneToSTL } from '../src/forge3d/exporter.js';
import { parseSTL } from '../src/forge3d/stl-parser.js';
import { applyAssemblyTransform, scadToViewportMatrix, createFloorAlignedTransform } from '../src/forge3d/assembly-transform.js';
import { createAssemblyGeometryFromStlBytes } from '../src/forge3d/assembly.js';

const near = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-5, `${actual} != ${expected}`));
function exported(scene) {
  const parsed = parseSTL(exportSceneToSTL(scene));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(parsed.vertices, 3));
  geometry.computeBoundingBox();
  return { ...parsed, geometry, box: geometry.boundingBox };
}

test('Design export preserves asymmetric source dimensions, origin and orientation', () => {
  const source = new THREE.BoxGeometry(10, 20, 30);
  source.translate(8, 15, 22); // bounds (3,5,7)..(13,25,37)
  const mesh = new THREE.Mesh(source);
  mesh.applyMatrix4(scadToViewportMatrix());
  const scene = new THREE.Scene(); scene.add(mesh);
  const result = exported(scene);
  near(result.box.min.toArray(), [3, 5, 7]);
  near(result.box.max.toArray(), [13, 25, 37]);
  assert.equal(result.triangleCount, 12);
  near(mesh.rotation.toArray().slice(0, 3), [-Math.PI / 2, 0, 0]);
});

test('combined export preserves parent transforms, part scale and placement; reimport is stable', () => {
  const scene = new THREE.Scene();
  const parent = new THREE.Group(); parent.position.set(3, 4, 5); scene.add(parent);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6));
  applyAssemblyTransform(mesh, { position: [10, 20, 30], rotation: [0, 0, 90], scale: [2, 3, 4] });
  parent.add(mesh);
  const other = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)); other.position.set(-10, 1, 0); scene.add(other);
  const result = exported(scene);
  near(result.box.min.toArray(), [-11, -47, 0]);
  near(result.box.max.toArray(), [19, 1, 26]);
  assert.equal(result.triangleCount, 24);
  const reopened = createAssemblyGeometryFromStlBytes(new TextEncoder().encode(exportSceneToSTL(scene)));
  near(reopened.boundingBox.min.toArray(), [-11, 0, -1]);
  near(reopened.boundingBox.max.toArray(), [19, 26, 47]);
});

test('floor-aligned rotated parts export onto Z=0', () => {
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  const transform = createFloorAlignedTransform({ geometry, transform: { position: [5, 12, 8], rotation: [23, 15, 45], scale: [2, 1, 3] } });
  const mesh = new THREE.Mesh(geometry); applyAssemblyTransform(mesh, transform);
  const scene = new THREE.Scene(); scene.add(mesh);
  assert.ok(Math.abs(exported(scene).box.min.z) < 1e-5);
});

test('hidden parts, hidden parents and marked helper subtrees never enter the STL', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  for (const reason of ['hidden', 'helper']) {
    const group = new THREE.Group();
    if (reason === 'hidden') group.visible = false;
    else group.userData.forgeExcludeFromExport = true;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100)));
    scene.add(group);
  }
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100)); hidden.visible = false; scene.add(hidden);
  scene.add(new THREE.GridHelper());
  assert.equal(exported(scene).triangleCount, 12);
  scene.children[0].visible = false;
  assert.throws(() => exportSceneToSTL(scene), /No visible geometry/);
});

test('mirrored exports retain outward winding without mutating source indices', () => {
  const scene = new THREE.Scene();
  const source = new THREE.BoxGeometry(2, 2, 2);
  const indices = Array.from(source.index.array);
  const mesh = new THREE.Mesh(source); mesh.scale.set(-2, 3, 4); scene.add(mesh);
  const { vertices } = exported(scene);
  let volume = 0;
  for (let i = 0; i < vertices.length; i += 9) {
    const a = new THREE.Vector3().fromArray(vertices, i);
    const b = new THREE.Vector3().fromArray(vertices, i + 3);
    const c = new THREE.Vector3().fromArray(vertices, i + 6);
    volume += a.dot(b.cross(c)) / 6;
  }
  assert.ok(Math.abs(volume - 192) < 1e-5, `Signed volume ${volume}`);
  assert.deepEqual(Array.from(source.index.array), indices);
  near(mesh.scale.toArray(), [-2, 3, 4]);
});
