import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

/**
 * Exports a Three.js scene to an STL file format and triggers a browser download.
 * @param {THREE.Scene} scene The scene to export
 * @param {string} filename The name of the downloaded file (e.g. 'model.stl')
 */
export function exportSceneToSTL(scene, filename = 'model.stl') {
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
  const stlString = exporter.parse(exportScene);

  // Trigger download
  const blob = new Blob([stlString], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Append to body, click, and cleanup
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
