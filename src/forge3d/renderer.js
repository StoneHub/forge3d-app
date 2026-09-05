import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getAssemblyPartWorldBox, applyAssemblyTransform, scadToViewportMatrix } from './assembly-transform.js';
import { getMaterialSwatch, getViewportBackgroundStops, normalizeRenderAppearance } from './render-appearance.js';
import { getThemeColors } from './theme.js';

const DEFAULT_CAMERA = { theta: 0.8, phi: 0.6, dist: 50, panX: 0, panY: 0, panZ: 0 };

function createViewportBackgroundTexture(theme, appearance) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  const colors = getThemeColors(theme);
  const [top, middle, bottom] = getViewportBackgroundStops(colors, appearance.background);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.56, middle);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createInfiniteGrid(theme) {
  const group = new THREE.Group();
  const fine = new THREE.GridHelper(800, 80, theme === 'dark' ? 0x243242 : 0xd7e0ea, theme === 'dark' ? 0x243242 : 0xd7e0ea);
  const major = new THREE.GridHelper(800, 16, theme === 'dark' ? 0x49627c : 0xa8bacd, theme === 'dark' ? 0x49627c : 0xa8bacd);
  [fine, major].forEach((grid, index) => {
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = index === 0 ? (theme === 'dark' ? 0.2 : 0.32) : (theme === 'dark' ? 0.42 : 0.5);
      material.depthWrite = false;
    });
    grid.position.y = index === 0 ? -0.02 : -0.01;
    grid.userData.forgeExcludeFromExport = true;
    group.add(grid);
  });
  group.userData = { fine, major, fineStep: 10, majorStep: 50, forgeExcludeFromExport: true };
  return group;
}

function applyViewportAppearance(resources, theme, appearance) {
  if (!resources) return;
  resources.renderer.toneMappingExposure = appearance.exposure;
  resources.hemi.intensity = (theme === 'dark' ? 0.72 : 0.58) * (1.08 - appearance.contrast * 0.08);
  resources.key.intensity = (theme === 'dark' ? 0.42 : 0.36) * appearance.contrast;
  resources.fill.intensity = (theme === 'dark' ? 0.18 : 0.14) * Math.max(0.72, 1.3 - appearance.contrast * 0.35);
  resources.ambient.intensity = (theme === 'dark' ? 0.08 : 0.06) * Math.max(0.72, 1.25 - appearance.contrast * 0.25);
  if (resources.backgroundAppearance !== `${theme}:${appearance.background}`) {
    resources.background?.dispose?.();
    resources.background = createViewportBackgroundTexture(theme, appearance);
    resources.scene.background = resources.background;
    resources.backgroundAppearance = `${theme}:${appearance.background}`;
  }
}

function createPartMaterial({ appearance, selected = false, locked = false, theme }) {
  const color = new THREE.Color(getMaterialSwatch(appearance.material).color);
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0,
    roughness: 0.82,
    envMapIntensity: 0.12 + appearance.contrast * 0.08,
    emissive: selected ? new THREE.Color(theme === 'dark' ? '#18455c' : '#2b6cb0') : new THREE.Color(0x000000),
    emissiveIntensity: selected ? 0.45 : 0,
    transparent: locked,
    opacity: locked ? 0.75 : 1,
  });
}

function updateInfiniteGridPosition(group, targetX, targetZ) {
  if (!group?.userData) return;
  const { fine, major, fineStep, majorStep } = group.userData;
  fine.position.x = Math.round(targetX / fineStep) * fineStep;
  fine.position.z = Math.round(targetZ / fineStep) * fineStep;
  major.position.x = Math.round(targetX / majorStep) * majorStep;
  major.position.z = Math.round(targetZ / majorStep) * majorStep;
}

function createDimensionBracket(start, end, offset, label, color) {
  const group = new THREE.Group();
  group.userData.forgeExcludeFromExport = true;
  const material = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material);
  line.userData.forgeExcludeFromExport = true;
  group.add(line);
  const direction = end.clone().sub(start).normalize();
  const perpendicular = Math.abs(direction.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  [start, end].forEach((point) => {
    const tick = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        point.clone().add(perpendicular.clone().multiplyScalar(1.5)),
        point.clone().add(perpendicular.clone().multiplyScalar(-1.5)),
      ]),
      material,
    );
    tick.userData.forgeExcludeFromExport = true;
    group.add(tick);
  });
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false, depthWrite: false }));
  sprite.position.copy(start.clone().add(end).multiplyScalar(0.5).add(offset));
  sprite.scale.set(8, 2, 1);
  sprite.userData.forgeExcludeFromExport = true;
  group.add(sprite);
  return group;
}

function updateCamera(camera, state) {
  const x = state.panX + state.dist * Math.sin(state.theta) * Math.cos(state.phi);
  const y = state.panY + state.dist * Math.sin(state.phi);
  const z = state.panZ + state.dist * Math.cos(state.theta) * Math.cos(state.phi);
  camera.position.set(x, y, z);
  camera.lookAt(state.panX, state.panY, state.panZ);
}

function frameBoundingBox(camera, state, box) {
  if (!box || box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 1);
  const distance = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15;
  Object.assign(state, DEFAULT_CAMERA, { dist: distance, panX: center.x, panY: center.y, panZ: center.z });
  updateCamera(camera, state);
}

function getPointerNdc(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
}

function snapValue(value, step) {
  return step ? Math.round(value / step) * step : value;
}

function buildBox(meshes) {
  const box = new THREE.Box3();
  let hasMesh = false;
  meshes.forEach((mesh) => {
    if (!mesh.visible) return;
    box.union(new THREE.Box3().setFromObject(mesh));
    hasMesh = true;
  });
  return hasMesh ? box : null;
}

function getAssemblyHandleColor(theme) {
  return theme === 'dark' ? 0xffd166 : 0xd99100;
}

function getMeasurementColor(theme) {
  return theme === 'dark' ? 0xffd166 : 0xd99100;
}

function syncMeasurement(resources, measurement, theme) {
  resources.measureRoot.clear();
  if (!measurement?.enabled || !measurement.points?.length) return;
  const markerGeometry = new THREE.SphereGeometry(0.6, 16, 16);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: getMeasurementColor(theme), depthTest: false });
  measurement.points.forEach((point) => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(point.position[0], point.position[1], point.position[2]);
    marker.userData.forgeExcludeFromExport = true;
    resources.measureRoot.add(marker);
  });
  if (measurement.points.length === 2) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...measurement.points[0].position),
        new THREE.Vector3(...measurement.points[1].position),
      ]),
      new THREE.LineBasicMaterial({ color: getMeasurementColor(theme), depthTest: false }),
    );
    line.userData.forgeExcludeFromExport = true;
    resources.measureRoot.add(line);
  }
}

function syncSelection(resources, assemblyScene, selectedPartId, theme) {
  resources.selectionRoot.clear();
  resources.gizmoRoot.clear();
  const selectedPart = assemblyScene?.parts?.find((part) => part.id === selectedPartId);
  const selectedMesh = resources.assemblyMeshes.get(selectedPartId);
  if (!selectedPart || !selectedMesh) return;
  selectedMesh.updateMatrixWorld(true);
  const helper = new THREE.BoxHelper(selectedMesh, theme === 'dark' ? 0x4fc3f7 : 0x1565c0);
  helper.userData.forgeExcludeFromExport = true;
  resources.selectionRoot.add(helper);
  if (selectedPart.locked) return;
  const box = getAssemblyPartWorldBox(selectedPart);
  if (!box || box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const handleColor = getAssemblyHandleColor(theme);
  const moveRadius = Math.max(Math.min(size.length() * 0.075, 3.4), 1.5);
  const moveHandle = new THREE.Mesh(
    new THREE.SphereGeometry(moveRadius, 18, 18),
    new THREE.MeshBasicMaterial({ color: handleColor, depthTest: false }),
  );
  moveHandle.position.set(center.x, box.max.y + 1.4, center.z);
  moveHandle.renderOrder = 10;
  moveHandle.userData = { forgeExcludeFromExport: true, gizmoType: 'move', partId: selectedPartId };
  resources.gizmoRoot.add(moveHandle);
  const rotateRadius = Math.max(Math.max(size.x, size.z) * 0.55, 6);
  const rotateHandle = new THREE.Mesh(
    new THREE.TorusGeometry(rotateRadius, 0.32, 16, 72),
    new THREE.MeshBasicMaterial({ color: handleColor, depthTest: false }),
  );
  rotateHandle.rotation.x = Math.PI / 2;
  rotateHandle.position.set(center.x, box.min.y + 0.2, center.z);
  rotateHandle.renderOrder = 9;
  rotateHandle.userData = { forgeExcludeFromExport: true, gizmoType: 'rotate', partId: selectedPartId };
  resources.gizmoRoot.add(rotateHandle);
  const rotateHitArea = new THREE.Mesh(
    new THREE.TorusGeometry(rotateRadius, 0.95, 12, 48),
    new THREE.MeshBasicMaterial({ color: handleColor, depthTest: false, transparent: true, opacity: 0.001 }),
  );
  rotateHitArea.rotation.copy(rotateHandle.rotation);
  rotateHitArea.position.copy(rotateHandle.position);
  rotateHitArea.renderOrder = 8;
  rotateHitArea.userData = { forgeExcludeFromExport: true, gizmoType: 'rotate', partId: selectedPartId };
  resources.gizmoRoot.add(rotateHitArea);
}

export function useThreeRenderer({
  canvasRef,
  mode = 'design',
  viewSettings,
  resetViewSignal = 0,
  fitViewSignal = 0,
  theme = 'dark',
  stlGeometry = null,
  assemblyScene = null,
  selectedPartId = null,
  measurement = null,
  onSelectAssemblyPart,
  onAssemblyMeasurementPick,
  onUpdateAssemblyPartTransform,
}) {
  const [scene, setScene] = useState(null);
  const resourcesRef = useRef(null);
  const cameraStateRef = useRef({ ...DEFAULT_CAMERA, down: false, button: -1, x: 0, y: 0 });
  const raycasterRef = useRef(new THREE.Raycaster());
  const interactionRef = useRef(null);
  const latestRef = useRef({});
  const signalsRef = useRef({ reset: resetViewSignal, fit: fitViewSignal });

  latestRef.current = { mode, assemblyScene, selectedPartId, measurement, onAssemblyMeasurementPick, onSelectAssemblyPart, onUpdateAssemblyPartTransform };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const appearance = normalizeRenderAppearance(viewSettings?.appearance);
    const resizeTarget = canvas.parentElement || canvas;
    const nextScene = new THREE.Scene();
    const background = createViewportBackgroundTexture(theme, appearance);
    nextScene.background = background;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    Object.assign(cameraStateRef.current, DEFAULT_CAMERA, { down: false, button: -1, x: 0, y: 0 });
    updateCamera(camera, cameraStateRef.current);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = appearance.exposure;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmremGenerator.dispose();
    nextScene.environment = envTexture;
    const hemi = new THREE.HemisphereLight(theme === 'dark' ? 0xcfe6ff : 0xfafcff, theme === 'dark' ? 0x243242 : 0xc6d2de, theme === 'dark' ? 0.78 : 0.62);
    hemi.userData.forgeExcludeFromExport = true;
    const key = new THREE.DirectionalLight(0xffffff, theme === 'dark' ? 0.42 : 0.36);
    key.position.set(30, 50, 30);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.userData.forgeExcludeFromExport = true;
    const fill = new THREE.DirectionalLight(theme === 'dark' ? 0x9fc5ff : 0xffffff, theme === 'dark' ? 0.18 : 0.14);
    fill.position.set(-35, 18, -24);
    fill.userData.forgeExcludeFromExport = true;
    const ambient = new THREE.AmbientLight(0xffffff, theme === 'dark' ? 0.08 : 0.06);
    ambient.userData.forgeExcludeFromExport = true;
    nextScene.add(hemi, key, fill, ambient);
    const resources = {
      scene: nextScene,
      camera,
      renderer,
      background,
      backgroundAppearance: `${theme}:${appearance.background}`,
      hemi,
      key,
      fill,
      ambient,
      grid: createInfiniteGrid(theme),
      axes: new THREE.AxesHelper(15),
      designRoot: new THREE.Group(),
      assemblyRoot: new THREE.Group(),
      selectionRoot: new THREE.Group(),
      gizmoRoot: new THREE.Group(),
      measureRoot: new THREE.Group(),
      dimRoot: new THREE.Group(),
      displayMeshes: [],
      assemblyMeshes: new Map(),
      frameId: null,
    };
    applyViewportAppearance(resources, theme, appearance);
    [resources.grid, resources.axes, resources.selectionRoot, resources.gizmoRoot, resources.measureRoot, resources.dimRoot].forEach((item) => {
      item.userData.forgeExcludeFromExport = true;
    });
    [resources.grid, resources.axes, resources.designRoot, resources.assemblyRoot, resources.selectionRoot, resources.gizmoRoot, resources.measureRoot, resources.dimRoot].forEach((item) => {
      nextScene.add(item);
    });
    resourcesRef.current = resources;
    setScene(nextScene);

    const getIntersections = (targets, event) => {
      const ndc = getPointerNdc(event, canvas);
      raycasterRef.current.setFromCamera(ndc, camera);
      return raycasterRef.current.intersectObjects(targets, false);
    };
    const getPlanePoint = (plane, event) => {
      const ndc = getPointerNdc(event, canvas);
      raycasterRef.current.setFromCamera(ndc, camera);
      const point = new THREE.Vector3();
      return raycasterRef.current.ray.intersectPlane(plane, point) ? point : null;
    };
    const onMouseDown = (event) => {
      const current = latestRef.current;
      if (current.mode === 'assembly') {
        const selected = current.assemblyScene?.parts?.find((part) => part.id === current.selectedPartId);
        const gizmoHit = getIntersections(resources.gizmoRoot.children, event)[0];
        if (gizmoHit && selected && !selected.locked) {
          const box = getAssemblyPartWorldBox(selected);
          const center = box?.getCenter(new THREE.Vector3()) || new THREE.Vector3(...selected.transform.position);
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y);
          const point = getPlanePoint(plane, event);
          if (point) {
            interactionRef.current = gizmoHit.object.userData.gizmoType === 'move'
              ? { type: 'move', partId: selected.id, plane, point, start: { ...selected.transform, position: [...selected.transform.position], rotation: [...selected.transform.rotation], scale: [...selected.transform.scale] } }
              : { type: 'rotate', partId: selected.id, plane, center, angle: Math.atan2(point.z - center.z, point.x - center.x), start: { ...selected.transform, position: [...selected.transform.position], rotation: [...selected.transform.rotation], scale: [...selected.transform.scale] } };
            return;
          }
        }
        if (current.measurement?.enabled) {
          const hit = getIntersections(Array.from(resources.assemblyMeshes.values()), event)[0];
          if (hit) {
            current.onAssemblyMeasurementPick?.({
              point: [hit.point.x, hit.point.y, hit.point.z],
              partId: hit.object?.userData?.partId || null,
            });
            return;
          }
        }
        const partHit = getIntersections(Array.from(resources.assemblyMeshes.values()), event)[0];
        if (partHit?.object?.userData?.partId) {
          current.onSelectAssemblyPart?.(partHit.object.userData.partId);
          return;
        }
      }
      cameraStateRef.current.down = true;
      cameraStateRef.current.button = event.button;
      cameraStateRef.current.x = event.clientX;
      cameraStateRef.current.y = event.clientY;
    };
    const onMouseMove = (event) => {
      const interaction = interactionRef.current;
      if (interaction) {
        const current = latestRef.current;
        const part = current.assemblyScene?.parts?.find((candidate) => candidate.id === interaction.partId);
        const mesh = resources.assemblyMeshes.get(interaction.partId);
        if (!part || !mesh) return;
        if (interaction.type === 'move') {
          const point = getPlanePoint(interaction.plane, event);
          if (!point) return;
          const delta = point.clone().sub(interaction.point);
          const step = current.assemblyScene?.snap?.enabled === false ? 0 : current.assemblyScene?.snap?.translateStepMm || 1;
          interaction.next = { ...interaction.start, position: [snapValue(interaction.start.position[0] + delta.x, step), interaction.start.position[1], snapValue(interaction.start.position[2] + delta.z, step)] };
        } else {
          const point = getPlanePoint(interaction.plane, event);
          if (!point) return;
          const step = current.assemblyScene?.snap?.enabled === false ? 0 : current.assemblyScene?.snap?.rotateStepDeg || 15;
          const delta = THREE.MathUtils.radToDeg(Math.atan2(point.z - interaction.center.z, point.x - interaction.center.x) - interaction.angle);
          interaction.next = { ...interaction.start, rotation: [interaction.start.rotation[0], snapValue(interaction.start.rotation[1] + delta, step), interaction.start.rotation[2]] };
        }
        applyTransform(mesh, interaction.next);
        syncSelection(resources, { parts: current.assemblyScene.parts.map((candidate) => candidate.id === part.id ? { ...candidate, transform: interaction.next } : candidate) }, part.id, theme);
        return;
      }
      if (!cameraStateRef.current.down) return;
      const dx = event.clientX - cameraStateRef.current.x;
      const dy = event.clientY - cameraStateRef.current.y;
      cameraStateRef.current.x = event.clientX;
      cameraStateRef.current.y = event.clientY;
      if (cameraStateRef.current.button === 2) {
        const panSpeed = cameraStateRef.current.dist * 0.001;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        const forward = new THREE.Vector3(Math.sin(cameraStateRef.current.theta) * Math.cos(cameraStateRef.current.phi), Math.sin(cameraStateRef.current.phi), Math.cos(cameraStateRef.current.theta) * Math.cos(cameraStateRef.current.phi)).normalize();
        right.crossVectors(forward, up).normalize().multiplyScalar(-dx * panSpeed);
        const upVec = up.clone().multiplyScalar(-dy * panSpeed);
        cameraStateRef.current.panX -= right.x + upVec.x;
        cameraStateRef.current.panY -= right.y + upVec.y;
        cameraStateRef.current.panZ -= right.z + upVec.z;
      } else {
        cameraStateRef.current.theta -= dx * 0.01;
        cameraStateRef.current.phi = Math.max(-1.5, Math.min(1.5, cameraStateRef.current.phi + dy * 0.01));
      }
      updateCamera(camera, cameraStateRef.current);
    };
    const onMouseUp = () => {
      if (interactionRef.current?.next) latestRef.current.onUpdateAssemblyPartTransform?.(interactionRef.current.partId, interactionRef.current.next);
      interactionRef.current = null;
      cameraStateRef.current.down = false;
      cameraStateRef.current.button = -1;
    };
    const onWheel = (event) => {
      event.preventDefault();
      cameraStateRef.current.dist = Math.max(3, Math.min(500, cameraStateRef.current.dist * (1 + event.deltaY * 0.001)));
      updateCamera(camera, cameraStateRef.current);
    };
    const onContextMenu = (event) => {
      event.preventDefault();
    };
    const onResize = () => {
      const width = Math.max(resizeTarget.clientWidth || canvas.clientWidth || 1, 1);
      const height = Math.max(resizeTarget.clientHeight || canvas.clientHeight || 1, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(resizeTarget);
    const animate = () => { resources.frameId = requestAnimationFrame(animate); updateInfiniteGridPosition(resources.grid, cameraStateRef.current.panX, cameraStateRef.current.panZ); renderer.render(nextScene, camera); };
    animate();
    const resizeTimeoutId = window.setTimeout(onResize, 50);
    return () => {
      window.clearTimeout(resizeTimeoutId);
      cancelAnimationFrame(resources.frameId);
      resizeObserver?.disconnect();
      renderer.dispose();
      envTexture.dispose();
      resources.background?.dispose?.();
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      resourcesRef.current = null;
    };
  }, [canvasRef, theme]);

  useEffect(() => {
    const resources = resourcesRef.current;
    if (!resources) return;
    const appearance = normalizeRenderAppearance(viewSettings?.appearance);
    applyViewportAppearance(resources, theme, appearance);
    resources.grid.visible = viewSettings.grid;
    resources.axes.visible = viewSettings.axes;
    resources.dimRoot.clear();
    if (mode === 'design') {
      resources.designRoot.clear();
      resources.displayMeshes = [];
      resources.assemblyRoot.clear();
      resources.assemblyMeshes = new Map();
      resources.selectionRoot.clear();
      resources.gizmoRoot.clear();
      resources.measureRoot.clear();
      if (stlGeometry) {
        const mesh = new THREE.Mesh(stlGeometry, createPartMaterial({ appearance, theme }));
        mesh.applyMatrix4(scadToViewportMatrix());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        resources.designRoot.add(mesh);
        resources.displayMeshes.push(mesh);
        if (viewSettings.wireframe) {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(stlGeometry), new THREE.LineBasicMaterial({ color: new THREE.Color('#4fc3f7').multiplyScalar(0.6), transparent: true, opacity: appearance.edgeStrength }));
          edges.rotation.copy(mesh.rotation);
          edges.userData.forgeExcludeFromExport = true;
          resources.designRoot.add(edges);
        }
      }
    } else {
      resources.designRoot.clear();
      resources.displayMeshes = [];
      resources.assemblyRoot.clear();
      resources.assemblyMeshes = new Map();
      (assemblyScene?.parts || []).forEach((part) => {
        if (part.visible === false) return;
        const mesh = new THREE.Mesh(part.geometry, createPartMaterial({ appearance, selected: part.id === selectedPartId, locked: part.locked, theme }));
        applyAssemblyTransform(mesh, part.transform);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.partId = part.id;
        resources.assemblyRoot.add(mesh);
        resources.displayMeshes.push(mesh);
        resources.assemblyMeshes.set(part.id, mesh);
        if (viewSettings.wireframe) {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(part.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(part.id === selectedPartId ? '#4fc3f7' : '#6d88a5'), transparent: true, opacity: appearance.edgeStrength }));
          edges.position.copy(mesh.position);
          edges.rotation.copy(mesh.rotation);
          edges.scale.copy(mesh.scale);
          edges.userData.forgeExcludeFromExport = true;
          resources.assemblyRoot.add(edges);
        }
      });
      syncMeasurement(resources, measurement, theme);
      syncSelection(resources, assemblyScene, selectedPartId, theme);
    }
    const box = buildBox(resources.displayMeshes);
    if (viewSettings.dimensions && box) {
      const size = box.getSize(new THREE.Vector3());
      const min = box.min;
      const max = box.max;
      const color = theme === 'dark' ? 0x4fc3f7 : 0x1565c0;
      if (size.x > 0.1) resources.dimRoot.add(createDimensionBracket(new THREE.Vector3(min.x, min.y - 3, max.z + 3), new THREE.Vector3(max.x, min.y - 3, max.z + 3), new THREE.Vector3(0, 0, 2), `${size.x.toFixed(1)}mm`, color));
      if (size.z > 0.1) resources.dimRoot.add(createDimensionBracket(new THREE.Vector3(max.x + 3, min.y - 3, min.z), new THREE.Vector3(max.x + 3, min.y - 3, max.z), new THREE.Vector3(2, 0, 0), `${size.z.toFixed(1)}mm`, color));
      if (size.y > 0.1) resources.dimRoot.add(createDimensionBracket(new THREE.Vector3(max.x + 3, min.y, min.z - 3), new THREE.Vector3(max.x + 3, max.y, min.z - 3), new THREE.Vector3(2, 0, 0), `${size.y.toFixed(1)}mm`, color));
    }
    const shouldReset = signalsRef.current.reset !== resetViewSignal;
    const shouldFit = signalsRef.current.fit !== fitViewSignal;
    signalsRef.current = { reset: resetViewSignal, fit: fitViewSignal };
    if (shouldReset) Object.assign(cameraStateRef.current, DEFAULT_CAMERA);
    if (shouldReset) updateCamera(resources.camera, cameraStateRef.current);
    if ((shouldReset || shouldFit) && box) frameBoundingBox(resources.camera, cameraStateRef.current, box);
  }, [mode, viewSettings, stlGeometry, assemblyScene, selectedPartId, measurement, resetViewSignal, fitViewSignal, theme]);

  return scene;
}
