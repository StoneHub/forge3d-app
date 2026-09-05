import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import * as THREE from 'three';
import { viewportToScadMatrix } from './assembly-transform.js';

/**
 * Serializes visible user meshes from the Y-up viewport into Z-up STL millimeters.
 * @param {THREE.Scene} scene The scene to export
 * @returns {string}
 */
export function exportSceneToSTL(scene) {
  const exportScene = new THREE.Scene();
  const ownedGeometry = [];
  scene.updateWorldMatrix(true, true);

  const collect = (object) => {
    if (!object.visible || object.userData?.forgeExcludeFromExport) return;
    if (object.isMesh && object.geometry?.getAttribute('position')?.count) {
      const mesh = object.clone(false);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(viewportToScadMatrix().multiply(object.matrixWorld));
      // Reflections reverse face winding. Correct only the export copy so the
      // resulting STL still describes outward-facing solid surfaces.
      if (mesh.matrix.determinant() < 0) {
        mesh.geometry = object.geometry.clone();
        ownedGeometry.push(mesh.geometry);
        if (!mesh.geometry.index) {
          mesh.geometry.setIndex(Array.from({ length: mesh.geometry.getAttribute('position').count }, (_, i) => i));
        }
        const index = mesh.geometry.index;
        for (let i = 0; i < index.count; i += 3) {
          const second = index.getX(i + 1);
          index.setX(i + 1, index.getX(i + 2));
          index.setX(i + 2, second);
        }
      }
      exportScene.add(mesh);
    }
    object.children.forEach(collect);
  };

  try {
    collect(scene);
    if (!exportScene.children.length) throw new Error('No visible geometry to export.');
    exportScene.updateMatrixWorld(true);
    return new STLExporter().parse(exportScene);
  } finally {
    ownedGeometry.forEach((geometry) => geometry.dispose());
  }
}
