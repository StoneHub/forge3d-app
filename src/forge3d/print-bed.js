import * as THREE from 'three';

/** Visible reference only; never include the printer bed in model exports. */
export function createPrintBedOutline(bed, theme = 'dark') {
  if (!bed || ![bed.widthMm, bed.depthMm, bed.heightMm].every((value) => Number.isFinite(value) && value > 0 && value <= 10000)) return null;
  const x = bed.widthMm / 2, z = bed.depthMm / 2;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-x, 0, -z), new THREE.Vector3(x, 0, -z),
    new THREE.Vector3(x, 0, z), new THREE.Vector3(-x, 0, z),
  ]);
  const outline = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({
    color: theme === 'dark' ? 0x65bda8 : 0x217a65, transparent: true, opacity: 0.8,
    depthWrite: false,
  }));
  outline.userData = { forgeExcludeFromExport: true, printBed: { ...bed } };
  return outline;
}
