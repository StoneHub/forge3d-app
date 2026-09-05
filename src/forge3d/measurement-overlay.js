import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

// Fixed contrast over both light models and dark/light viewport backgrounds.
const INK = '#101827';
const ACCENT = '#4de1ff';

function sprite(canvas, position, pixels, order) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const item = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false }));
  item.position.copy(position);
  item.renderOrder = order;
  item.userData.measurePixelSize = pixels;
  return item;
}

export function createMeasurementOverlay(measurement) {
  const group = new THREE.Group();
  group.userData.forgeExcludeFromExport = true;
  const points = measurement.points.map((point) => new THREE.Vector3(...point.position));
  if (points.length === 2) {
    for (const [color, linewidth, order] of [[INK, 8, 1000], [ACCENT, 4, 1001]]) {
      const line = new Line2(new LineGeometry().setPositions(points.flatMap((point) => point.toArray())), new LineMaterial({ color, linewidth, depthTest: false, depthWrite: false, toneMapped: false }));
      line.renderOrder = order;
      group.add(line);
    }
    const canvas = document.createElement('canvas');
    const text = `${measurement.distance.toFixed(2)} mm`;
    canvas.width = Math.max(512, text.length * 40 + 96);
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = INK;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(3, 3, canvas.width - 6, 122, 24);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 64px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, 66);
    const label = sprite(canvas, points[0].clone().add(points[1]).multiplyScalar(0.5), [canvas.width / 4, 32], 1003);
    label.center.set(0.5, -0.35);
    group.add(label);
  }
  for (const point of points) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 96;
    const ctx = canvas.getContext('2d');
    for (const [radius, color] of [[44, INK], [34, '#ffffff'], [23, ACCENT]]) {
      ctx.beginPath(); ctx.arc(48, 48, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    }
    group.add(sprite(canvas, point, [22, 22], 1002));
  }
  return group;
}

export function updateMeasurementOverlay(root, camera, width, height) {
  const viewPosition = new THREE.Vector3();
  root.traverse((item) => {
    if (item.isLine2) item.material.resolution.set(width, height);
    const pixels = item.userData.measurePixelSize;
    if (!pixels) return;
    viewPosition.copy(item.position).applyMatrix4(camera.matrixWorldInverse);
    item.visible = viewPosition.z < -camera.near;
    const worldPerPixel = 2 * Math.abs(viewPosition.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(height, 1);
    item.scale.set(pixels[0] * worldPerPixel, pixels[1] * worldPerPixel, 1);
  });
}
