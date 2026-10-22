import * as THREE from 'three';
import { createAssemblyPart, getAssemblyPartMetrics } from './assembly.js';
import { applyAssemblyTransform, normalizeTransform } from './assembly-transform.js';
import { exportSceneToSTL } from './exporter.js';

export function assertAssemblyCapacity(scene, addedTriangles = 0, addedParts = 0) {
  const triangles = scene.parts.reduce((sum, part) => sum + part.geometry.getAttribute('position').count / 3, 0);
  if (scene.parts.length + addedParts > 1000 || triangles + addedTriangles > 1000000) throw new Error('Assembly limit exceeded: at most 1,000 parts and 1,000,000 total triangles.');
}

export function validateAssemblyTransform(transform = {}) {
  if (!transform || typeof transform !== 'object' || Array.isArray(transform)) throw new Error('transform must be an object.');
  for (const key of Object.keys(transform)) {
    if (!['position', 'rotation', 'scale'].includes(key)) throw new Error(`Unknown transform component: ${key}`);
    const value = transform[key];
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new Error(`${key} requires three finite numbers.`);
    if (key === 'scale' && value.some((entry) => entry <= 0)) throw new Error('Scale components must be positive.');
  }
  return transform;
}

export function getMcpAssemblySnapshot(scene, revision, mode) {
  return {
    revision, mode, units: 'mm', coordinateSystem: 'viewport Y-up',
    transformConvention: 'position XYZ millimeters; rotation XYZ Euler degrees; positive scale XYZ. OpenSCAD [x,y,z] maps to viewport [x,z,-y].',
    selectedPartId: scene.selectedPartId,
    parts: scene.parts.map((part) => ({
      id: part.id, name: part.name,
      source: { kind: part.source?.kind, filePath: part.source?.filePath || null, hasCode: typeof part.source?.code === 'string' },
      transform: normalizeTransform(part.transform), visible: part.visible !== false, locked: Boolean(part.locked),
      triangles: part.geometry.getAttribute('position').count / 3, bounds: getAssemblyPartMetrics(part),
    })),
  };
}

export function assertAssemblyRevision(revision, expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || revision !== expectedRevision) throw new Error(`Assembly changed (current revision ${revision}). Read forge3d_get_assembly before editing.`);
}

export function requireAssemblyPart(scene, id) {
  const part = scene.parts.find((entry) => entry.id === id);
  if (!part) throw new Error(`Unknown assembly part: ${id}`);
  return part;
}

export function updateMcpAssemblyPart(scene, args) {
  const part = requireAssemblyPart(scene, args.partId);
  if (part.locked && (args.transform || args.name !== undefined)) throw new Error(`Unlock ${part.name} before changing it.`);
  if (args.transform) validateAssemblyTransform(args.transform);
  const updated = {
    ...part,
    ...(args.name !== undefined ? { name: args.name } : {}),
    ...(args.visible !== undefined ? { visible: args.visible } : {}),
    ...(args.locked !== undefined ? { locked: args.locked } : {}),
    transform: normalizeTransform({ ...part.transform, ...args.transform }),
  };
  return { ...scene, parts: scene.parts.map((entry) => entry.id === part.id ? updated : entry), selectedPartId: part.id };
}

export function duplicateMcpAssemblyPart(scene, args) {
  const source = requireAssemblyPart(scene, args.partId);
  if (!Array.isArray(args.instances) || !args.instances.length || args.instances.length > 200) throw new Error('Provide between 1 and 200 instances.');
  assertAssemblyCapacity(scene, source.geometry.getAttribute('position').count / 3 * args.instances.length, args.instances.length);
  args.instances.forEach((entry) => validateAssemblyTransform(entry.transform || {}));
  const copies = args.instances.map((entry, index) => createAssemblyPart({
    name: entry.name || `${source.name} Copy ${index + 1}`, source: { ...source.source }, geometry: source.geometry,
    transform: { ...source.transform, ...entry.transform }, visible: source.visible, locked: false, metadata: { ...source.metadata },
  }));
  return { ...scene, parts: [...scene.parts, ...copies], selectedPartId: copies.at(-1).id };
}

export function removeMcpAssemblyPart(scene, partId) {
  const part = requireAssemblyPart(scene, partId);
  if (part.locked) throw new Error(`Unlock ${part.name} before deleting it.`);
  const parts = scene.parts.filter((entry) => entry.id !== partId);
  return { ...scene, parts, selectedPartId: scene.selectedPartId === partId ? parts[0]?.id || null : scene.selectedPartId };
}

// Export the model state directly, without relying on an asynchronously rebuilt
// viewport or accidentally including its selection outlines and measurement UI.
export function selectMcpAssemblyExportParts(assemblyScene, partIds) {
  if (partIds === undefined) return assemblyScene.parts.filter((part) => part.visible !== false);
  if (!Array.isArray(partIds) || !partIds.length || new Set(partIds).size !== partIds.length) throw new Error('partIds must contain unique assembly part IDs.');
  return partIds.map((id) => {
    const part = requireAssemblyPart(assemblyScene, id);
    if (part.visible === false) throw new Error(`Show ${part.name} before exporting it.`);
    return part;
  });
}

export function exportMcpAssemblyStl(assemblyScene, partIds) {
  const scene = new THREE.Scene();
  const material = new THREE.MeshBasicMaterial();
  try {
    for (const part of selectMcpAssemblyExportParts(assemblyScene, partIds)) {
      const mesh = new THREE.Mesh(part.geometry, material);
      applyAssemblyTransform(mesh, part.transform);
      scene.add(mesh);
    }
    return exportSceneToSTL(scene);
  } finally { material.dispose(); }
}
