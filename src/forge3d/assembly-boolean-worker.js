import * as THREE from 'three';
import { CSG } from 'three-csg-ts';

function buildGeometry(payload = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(payload.position || []), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(payload.normal || []), 3));
  geometry.computeBoundingBox();
  return geometry;
}

function applyTransform(mesh, transform = {}) {
  const position = Array.isArray(transform.position) ? transform.position : [0, 0, 0];
  const rotation = Array.isArray(transform.rotation) ? transform.rotation : [0, 0, 0];
  mesh.position.set(...position);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation[0] || 0),
    THREE.MathUtils.degToRad(rotation[1] || 0),
    THREE.MathUtils.degToRad(rotation[2] || 0),
  );
  mesh.updateMatrix();
}

function serializeGeometry(geometry) {
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  prepared.computeVertexNormals();
  prepared.computeBoundingBox();
  const position = prepared.getAttribute('position')?.array;
  const normal = prepared.getAttribute('normal')?.array;

  if (!position || position.length === 0) {
    throw new Error('Boolean operation produced empty geometry');
  }

  return {
    position: Array.from(position),
    normal: Array.from(normal || []),
  };
}

self.onmessage = (event) => {
  const { requestId, operation, primary, operand } = event.data || {};

  try {
    const meshA = new THREE.Mesh(buildGeometry(primary?.geometry), new THREE.MeshStandardMaterial());
    const meshB = new THREE.Mesh(buildGeometry(operand?.geometry), new THREE.MeshStandardMaterial());
    applyTransform(meshA, primary?.transform);
    applyTransform(meshB, operand?.transform);

    const resultMesh = operation === 'union'
      ? CSG.union(meshA, meshB)
      : operation === 'subtract'
        ? CSG.subtract(meshA, meshB)
        : CSG.intersect(meshA, meshB);

    resultMesh.updateMatrix();
    const bakedGeometry = resultMesh.geometry.clone();
    bakedGeometry.applyMatrix4(resultMesh.matrix);

    self.postMessage({
      requestId,
      ok: true,
      geometry: serializeGeometry(bakedGeometry),
    });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
