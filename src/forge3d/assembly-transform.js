import * as THREE from 'three';

// SCAD/STL use Z-up millimeters; the interactive viewport uses Y-up.
export const scadToViewportMatrix = () => new THREE.Matrix4().makeRotationX(-Math.PI / 2);
export const viewportToScadMatrix = () => new THREE.Matrix4().makeRotationX(Math.PI / 2);

function vector(value, fallback) {
  return fallback.map((entry, index) => Number.isFinite(value?.[index]) ? value[index] : entry);
}

export function normalizeTransform(transform = {}) {
  return {
    position: vector(transform.position, [0, 0, 0]),
    rotation: vector(transform.rotation, [0, 0, 0]),
    scale: vector(transform.scale, [1, 1, 1]),
  };
}

function components(transform) {
  const { position, rotation, scale } = normalizeTransform(transform);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    ...rotation.map(THREE.MathUtils.degToRad), 'XYZ',
  ));
  return { position: new THREE.Vector3(...position), quaternion, scale: new THREE.Vector3(...scale) };
}

export function buildAssemblyTransformMatrix(transform = {}) {
  const { position, quaternion, scale } = components(transform);
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

export function applyAssemblyTransform(object, transform) {
  const { position, quaternion, scale } = components(transform);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
  object.scale.copy(scale);
  object.updateMatrix();
  object.updateMatrixWorld(true);
}

export function getAssemblyPartWorldBox(part) {
  if (!part?.geometry?.boundingBox) return null;
  return part.geometry.boundingBox.clone().applyMatrix4(buildAssemblyTransformMatrix(part.transform));
}

export function createFloorAlignedTransform(part, overrides = {}) {
  const transform = normalizeTransform({ ...part?.transform, ...overrides });
  const box = getAssemblyPartWorldBox({ ...part, transform });
  if (box && !box.isEmpty()) transform.position[1] -= box.min.y;
  return transform;
}

export function createCenteredTransform(part, overrides = {}) {
  const transform = normalizeTransform({ ...part?.transform, ...overrides });
  const box = getAssemblyPartWorldBox({ ...part, transform });
  if (box && !box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    transform.position[0] -= center.x;
    transform.position[2] -= center.z;
  }
  return createFloorAlignedTransform({ ...part, transform });
}
