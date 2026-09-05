import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateMeasurementOverlay } from '../src/forge3d/measurement-overlay.js';

test('measurement labels retain their pixel size across zoom and viewport sizes', () => {
  const root = new THREE.Group();
  const label = new THREE.Sprite();
  label.position.set(2, 3, 0);
  label.userData.measurePixelSize = [128, 32];
  root.add(label);
  for (const [width, height, distance] of [[800, 600, 35], [800, 600, 350], [1600, 900, 350]]) {
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.z = distance;
    camera.updateMatrixWorld();
    updateMeasurementOverlay(root, camera, width, height);
    const a = label.position.clone().add(new THREE.Vector3(-label.scale.x / 2, 0, 0)).project(camera);
    const b = label.position.clone().add(new THREE.Vector3(label.scale.x / 2, 0, 0)).project(camera);
    assert.ok(Math.abs((b.x - a.x) * width / 2 - 128) < 1e-6);
    assert.equal(label.visible, true);
  }
});

test('measurement sprites behind the camera are hidden', () => {
  const root = new THREE.Group();
  const marker = new THREE.Sprite();
  marker.position.z = 11;
  marker.userData.measurePixelSize = [22, 22];
  root.add(marker);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  updateMeasurementOverlay(root, camera, 600, 600);
  assert.equal(marker.visible, false);
});

test('large dimension labels remain inside the viewport without accumulating offsets', () => {
  const root = new THREE.Group();
  const label = new THREE.Sprite();
  label.position.set(8, 0, 0);
  label.center.set(0.5, -0.35);
  label.userData.labelAnchor = label.position.clone();
  label.userData.measurePixelSize = [128, 32];
  root.add(label);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  updateMeasurementOverlay(root, camera, 600, 600);
  const firstPosition = label.position.clone();
  const projected = label.position.clone().project(camera);
  assert.ok((projected.x + 1) * 300 + 64 <= 592.000001);
  updateMeasurementOverlay(root, camera, 600, 600);
  assert.ok(firstPosition.distanceTo(label.position) < 1e-9);
});
