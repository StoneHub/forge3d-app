import * as THREE from 'three';
import { parseSTL } from './stl-parser.js';

import { normalizeTransform, getAssemblyPartWorldBox, scadToViewportMatrix } from './assembly-transform.js';
export { buildAssemblyTransformMatrix, getAssemblyPartWorldBox, createFloorAlignedTransform, createCenteredTransform } from './assembly-transform.js';

function roundMetric(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round((value || 0) * factor) / factor;
}

function makePartId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `part-${crypto.randomUUID()}`;
  }
  return `part-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createGeometryFromArrays(vertices, normals) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(vertices), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(normals), 3));
  geometry.computeBoundingBox();
  return geometry;
}

export function serializeAssemblyGeometry(geometry) {
  const position = geometry?.getAttribute('position')?.array;
  const normal = geometry?.getAttribute('normal')?.array;
  return {
    position: Array.from(position || []),
    normal: Array.from(normal || []),
  };
}

export function createAssemblyGeometryFromPayload(payload) {
  return createGeometryFromArrays(payload?.position || [], payload?.normal || []);
}

export function createAssemblyGeometryFromStlBytes(bytes) {
  const parsed = parseSTL(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const geometry = createGeometryFromArrays(parsed.vertices, parsed.normals);
  geometry.applyMatrix4(scadToViewportMatrix());
  geometry.computeBoundingBox();
  return geometry;
}

export function createAssemblyGeometryFromDesignGeometry(geometry) {
  const nextGeometry = geometry.clone();
  nextGeometry.applyMatrix4(scadToViewportMatrix());
  nextGeometry.computeBoundingBox();
  return nextGeometry;
}

export function cloneAssemblyGeometry(geometry) {
  const nextGeometry = geometry.clone();
  nextGeometry.computeBoundingBox();
  return nextGeometry;
}

export function createAssemblyPart({
  id,
  name,
  source,
  geometry,
  transform,
  visible = true,
  locked = false,
  metadata = {},
}) {
  const nextGeometry = cloneAssemblyGeometry(geometry);
  return {
    id: id || makePartId(),
    name: name || 'Part',
    source: source || { kind: 'stl-file', filePath: null },
    geometry: nextGeometry,
    transform: normalizeTransform(transform),
    visible,
    locked,
    metadata,
  };
}

export function duplicateAssemblyPart(part) {
  const size = getAssemblyPartMetrics(part)?.size;
  const offset = Math.max(size?.x || 0, 8);
  return createAssemblyPart({
    name: `${part.name} Copy`,
    source: { ...part.source },
    geometry: part.geometry,
    transform: {
      position: [
        part.transform.position[0] + offset,
        part.transform.position[1],
        part.transform.position[2],
      ],
      rotation: [...part.transform.rotation],
      scale: [...part.transform.scale],
    },
    visible: part.visible,
    locked: part.locked,
    metadata: { ...part.metadata },
  });
}

export function getAssemblyPartMetrics(part) {
  const worldBox = getAssemblyPartWorldBox(part);
  if (!worldBox || worldBox.isEmpty()) return null;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  worldBox.getSize(size);
  worldBox.getCenter(center);
  return {
    size: {
      x: roundMetric(size.x, 2),
      y: roundMetric(size.y, 2),
      z: roundMetric(size.z, 2),
    },
    center: {
      x: roundMetric(center.x, 2),
      y: roundMetric(center.y, 2),
      z: roundMetric(center.z, 2),
    },
    floorDistance: roundMetric(worldBox.min.y, 2),
    min: {
      x: roundMetric(worldBox.min.x, 2),
      y: roundMetric(worldBox.min.y, 2),
      z: roundMetric(worldBox.min.z, 2),
    },
    max: {
      x: roundMetric(worldBox.max.x, 2),
      y: roundMetric(worldBox.max.y, 2),
      z: roundMetric(worldBox.max.z, 2),
    },
  };
}

export function serializeAssemblyScene(assemblyScene = {}) {
  return {
    version: 1,
    snap: assemblyScene.snap || { enabled: true, translateStepMm: 1, rotateStepDeg: 15 },
    selectedPartId: assemblyScene.selectedPartId || null,
    parts: (assemblyScene.parts || []).map((part) => ({
      id: part.id,
      name: part.name,
      source: part.source,
      transform: normalizeTransform(part.transform),
      visible: part.visible !== false,
      locked: part.locked === true,
      metadata: part.metadata || {},
      geometry: {
        position: Array.from(part.geometry.getAttribute('position')?.array || []),
        normal: Array.from(part.geometry.getAttribute('normal')?.array || []),
      },
    })),
  };
}

export function deserializeAssemblyScene(payload) {
  const parts = Array.isArray(payload?.parts)
    ? payload.parts
        .filter((part) => Array.isArray(part?.geometry?.position) && Array.isArray(part?.geometry?.normal))
        .map((part) => createAssemblyPart({
          id: part.id,
          name: part.name,
          source: part.source,
          transform: part.transform,
          visible: part.visible !== false,
          locked: part.locked === true,
          metadata: part.metadata || {},
          geometry: createAssemblyGeometryFromPayload(part.geometry),
        }))
    : [];

  return {
    parts,
    selectedPartId: parts.some((part) => part.id === payload?.selectedPartId) ? payload.selectedPartId : parts[0]?.id || null,
    snap: {
      enabled: payload?.snap?.enabled !== false,
      translateStepMm: Number(payload?.snap?.translateStepMm) > 0 ? Number(payload.snap.translateStepMm) : 1,
      rotateStepDeg: Number(payload?.snap?.rotateStepDeg) > 0 ? Number(payload.snap.rotateStepDeg) : 15,
    },
  };
}
