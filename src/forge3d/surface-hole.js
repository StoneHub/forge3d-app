import * as THREE from 'three';
import { getAssemblyPartWorldBox, viewportToScadMatrix } from './assembly-transform.js';

// The cutter spans the complete projection of the target along the picked
// surface normal, including a small overlap at both ends (no coplanar caps).
export function createHoleTool(part, pick, diameter) {
  if (!Number.isFinite(diameter) || diameter <= 0 || diameter > 10000) throw new Error('Enter a diameter between 0 and 10000 mm.');
  if (![pick?.position, pick?.normal].every((v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) throw new Error('Pick a surface first.');
  const normal = new THREE.Vector3(...pick.normal);
  if (normal.lengthSq() < 1e-12) throw new Error('Invalid surface normal.');
  normal.normalize();
  const box = getAssemblyPartWorldBox(part);
  if (!box || box.isEmpty()) throw new Error('Part has no geometry.');
  const projections = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) projections.push(new THREE.Vector3(x, y, z).dot(normal));
  const low = Math.min(...projections) - 1;
  const high = Math.max(...projections) + 1;
  const depth = high - low;
  const point = new THREE.Vector3(...pick.position);
  const center = point.clone().addScaledVector(normal, (low + high) / 2 - point.dot(normal));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const matrix = new THREE.Matrix4().compose(center, quaternion, new THREE.Vector3(1, 1, 1));
  const indexed = new THREE.CylinderGeometry(diameter / 2, diameter / 2, depth, 64);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.applyMatrix4(matrix);
  // OpenSCAD's cylinder is Z-up; Three's is Y-up. Convert the entire frame,
  // including assembly placement, back to SCAD coordinates exactly once.
  const scadMatrix = viewportToScadMatrix().multiply(matrix).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const rows = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => Number(scadMatrix.elements[c * 4 + r].toFixed(8))));
  const scad = `// Cutter in assembly world coordinates (Z-up, millimeters).\n// Subtract from a base exported in the same assembly coordinates:\n// difference() { import("base.stl"); forge3d_hole(); }\nmodule forge3d_hole() {\n  multmatrix(${JSON.stringify(rows)})\n    cylinder(d=${diameter}, h=${Number(depth.toFixed(8))}, center=true, $fn=64);\n}\nforge3d_hole();\n`;
  return { geometry, scad, depth, center: center.toArray(), normal: normal.toArray() };
}
