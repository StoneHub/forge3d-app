import { getAssemblyPartWorldBox, normalizeTransform } from './assembly-transform.js';

export const DEFAULT_PRINT_BED = Object.freeze({ widthMm: 220, depthMm: 220, heightMm: 250 });
const EPSILON = 1e-4;

function validateBed(value = DEFAULT_PRINT_BED) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Provide print bed widthMm, depthMm, and heightMm.');
  const bed = {};
  for (const key of ['widthMm', 'depthMm', 'heightMm']) {
    if (!Number.isFinite(value[key]) || value[key] <= 0 || value[key] > 10000) {
      throw new Error(`Print bed ${key} must be a finite number greater than zero and at most 10000 mm.`);
    }
    bed[key] = value[key];
  }
  return bed;
}

function selectParts(scene, partIds) {
  const parts = scene?.parts || [];
  if (partIds === undefined) return parts.filter((part) => part.visible !== false);
  if (!Array.isArray(partIds) || !partIds.length || partIds.some((id) => typeof id !== 'string' || !id)) {
    throw new Error('partIds must be a non-empty array of part IDs.');
  }
  if (new Set(partIds).size !== partIds.length) throw new Error('partIds must not contain duplicates.');
  return partIds.map((id) => {
    const part = parts.find((entry) => entry.id === id);
    if (!part) throw new Error(`Unknown assembly part: ${id}`);
    return part;
  });
}

function partBox(part) {
  const position = part.geometry?.getAttribute('position');
  if (!position || position.count < 3) return null;
  // Bounds alone can conceal invalid vertices because comparisons with NaN fail.
  for (let index = 0; index < position.count; index++) {
    if (![position.getX(index), position.getY(index), position.getZ(index)].every(Number.isFinite)) return null;
  }
  const box = getAssemblyPartWorldBox(part);
  if (!box || box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) return null;
  if (['x', 'y', 'z'].some((axis) => box.max[axis] - box.min[axis] <= EPSILON)) return null;
  return box;
}

const point = (value) => ({ x: value.x, y: value.y, z: value.z });
const overlaps = (a, b) => ['x', 'y', 'z'].every((axis) => Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]) > EPSILON);

/** Placement checks only: no manifold analysis, support generation, slicing, or G-code. */
export function getMcpPrintSnapshot(scene = {}, args = {}) {
  const bed = validateBed(args.bed ?? scene.printBed ?? DEFAULT_PRINT_BED);
  const parts = selectParts(scene, args.partIds);
  const boxes = parts.map(partBox);
  const overlapPairs = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (boxes[i] && boxes[j] && overlaps(boxes[i], boxes[j])) overlapPairs.push([parts[i].id, parts[j].id]);
    }
  }
  const checks = parts.map((part, index) => {
    const box = boxes[index];
    const issues = [];
    if (!box) issues.push('invalid-or-degenerate-geometry');
    if (part.visible === false) issues.push('hidden');
    const fitsBed = Boolean(box && box.min.x >= -bed.widthMm / 2 - EPSILON && box.max.x <= bed.widthMm / 2 + EPSILON
      && box.min.z >= -bed.depthMm / 2 - EPSILON && box.max.z <= bed.depthMm / 2 + EPSILON
      && box.min.y >= -EPSILON && box.max.y <= bed.heightMm + EPSILON);
    const onFloor = Boolean(box && Math.abs(box.min.y) <= EPSILON);
    if (box && !fitsBed) issues.push('outside-bed-volume');
    if (box && !onFloor) issues.push(box.min.y < 0 ? 'below-floor' : 'above-floor');
    if (overlapPairs.some((pair) => pair.includes(part.id))) issues.push('aabb-overlap');
    return {
      id: part.id, name: part.name, transform: normalizeTransform(part.transform),
      bounds: box ? { min: point(box.min), max: point(box.max) } : null,
      fitsBed, onFloor, placementReady: issues.length === 0, issues,
    };
  });
  return {
    units: 'mm', coordinateSystem: 'viewport-y-up',
    bed: { ...bed, origin: 'center-xz-floor-y', source: args.bed ? 'request' : scene.printBed ? 'prepared-scene' : 'default' },
    partIds: parts.map((part) => part.id),
    excludedPartIds: (scene.parts || []).filter((part) => !parts.includes(part)).map((part) => part.id),
    placementReady: checks.length > 0 && checks.every((part) => part.placementReady),
    parts: checks, overlapPairs, issues: checks.length ? [] : ['no-parts'],
    capabilities: { arrangement: true, placementChecks: true, slicing: false, gcode: false },
    limitations: ['AABB overlaps are conservative; they do not prove mesh intersections.',
      'Placement checks do not validate manifold geometry, supports, printer profiles, or printability.'],
  };
}

/** Pure and atomic: caller applies the new scene only after successful preparation. */
export function prepareMcpPrint(scene = {}, args = {}) {
  if (!args.bed) throw new Error('Provide explicit bed dimensions before arranging parts.');
  const bed = validateBed(args.bed);
  const spacingMm = args.spacingMm ?? 2;
  if (!Number.isFinite(spacingMm) || spacingMm < 0 || spacingMm > 1000) throw new Error('spacingMm must be a finite number between 0 and 1000 mm.');
  const parts = selectParts(scene, args.partIds);
  if (!parts.length) throw new Error('Add a visible assembly part before preparing print placement.');
  const replacements = new Map();
  const left = -bed.widthMm / 2 + spacingMm;
  const right = bed.widthMm / 2 - spacingMm;
  const back = bed.depthMm / 2 - spacingMm;
  let x = left, z = -bed.depthMm / 2 + spacingMm, rowDepth = 0;
  for (const part of parts) {
    if (part.locked) throw new Error(`Unlock ${part.name || part.id} before arranging it.`);
    if (part.visible === false) throw new Error(`Show ${part.name || part.id} before arranging it.`);
    const box = partBox(part);
    if (!box) throw new Error(`Part ${part.name || part.id} has invalid or degenerate geometry.`);
    const width = box.max.x - box.min.x, depth = box.max.z - box.min.z, height = box.max.y - box.min.y;
    if (width > right - left + EPSILON || depth > bed.depthMm - 2 * spacingMm + EPSILON || height > bed.heightMm + EPSILON) {
      throw new Error(`Part ${part.name || part.id} does not fit the bed with ${spacingMm} mm edge clearance.`);
    }
    if (x + width > right + EPSILON) { x = left; z += rowDepth + spacingMm; rowDepth = 0; }
    if (z + depth > back + EPSILON) throw new Error('Shelf arrangement does not fit the bed. Use fewer parts, a larger bed, smaller spacing, or arrange manually.');
    const transform = normalizeTransform(part.transform);
    transform.position[0] += x - box.min.x;
    transform.position[1] -= box.min.y;
    transform.position[2] += z - box.min.z;
    replacements.set(part.id, { ...part, transform });
    x += width + spacingMm;
    rowDepth = Math.max(rowDepth, depth);
  }
  const nextScene = { ...scene, printBed: bed, parts: (scene.parts || []).map((part) => replacements.get(part.id) || part) };
  const print = getMcpPrintSnapshot(nextScene, { partIds: parts.map((part) => part.id) });
  if (!print.placementReady) throw new Error('Print placement validation failed; the assembly was not changed.');
  return { scene: nextScene, print: { ...print, arrangement: { strategy: 'shelf', spacingMm, edgeClearanceMm: spacingMm } } };
}
