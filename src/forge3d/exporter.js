import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

/**
 * Serializes the user mesh subset of a Three.js scene into ASCII STL text.
 * @param {THREE.Scene} scene The scene to export
 * @returns {string}
 */
export function exportSceneToSTL(scene) {
  // We only want to export the actual user-created objects, not the grid, axes, or lights.
  // We can do this by cloning the root scene and removing any helpers before exporting,
  // or by selecting only standard Meshes.
  
  // Create a clean scene just for export
  const exportScene = scene.clone();
  
  // Remove objects we don't want (GridHelper, AxesHelper, Lights, Edges wireframes)
  const toRemove = [];
  exportScene.traverse((child) => {
    if (child.isLineSegments) toRemove.push(child); // Wireframes
    if (child.isLight) toRemove.push(child); // Lights
    if (child.isGridHelper || child.isAxesHelper) toRemove.push(child); // Helpers
  });
  
  toRemove.forEach(obj => obj.removeFromParent());

  // Use the Three.js STLExporter
  const exporter = new STLExporter();
  return exporter.parse(exportScene);
}
