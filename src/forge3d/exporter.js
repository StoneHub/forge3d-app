import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

/**
 * Serializes the user mesh subset of a Three.js scene into ASCII STL text.
 * @param {THREE.Scene} scene The scene to export
 * @returns {string}
 */
export function exportSceneToSTL(scene) {
  // Create a clean scene just for export
  const exportScene = scene.clone();

  // Remove helpers, overlays, and any renderer-only controls before export.
  const toRemove = [];
  exportScene.traverse((child) => {
    if (child.isLineSegments) toRemove.push(child); // Wireframes
    if (child.isLight) toRemove.push(child); // Lights
    if (child.isGridHelper || child.isAxesHelper) toRemove.push(child); // Helpers
    if (child.userData?.forgeExcludeFromExport) toRemove.push(child);
  });

  toRemove.forEach(obj => obj.removeFromParent());

  // Use the Three.js STLExporter
  const exporter = new STLExporter();
  return exporter.parse(exportScene);
}
