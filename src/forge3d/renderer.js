import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// ── Dimension Brackets Helper ───────────────────────────────────────────────
function createDimensionBracket(start, end, offset, label, color = 0x4fc3f7) {
  const group = new THREE.Group();

  // Main dimension line
  const points = [start.clone(), end.clone()];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  group.add(line);

  // End brackets (perpendicular ticks)
  const direction = end.clone().sub(start).normalize();
  const perpendicular = new THREE.Vector3();

  // Choose perpendicular based on which axis we're measuring
  if (Math.abs(direction.x) > 0.9) {
    perpendicular.set(0, 1, 0); // X-axis measurement, brackets in Y
  } else if (Math.abs(direction.y) > 0.9) {
    perpendicular.set(1, 0, 0); // Y-axis measurement, brackets in X
  } else {
    perpendicular.set(1, 0, 0); // Z-axis measurement, brackets in X
  }

  const bracketSize = 1.5;

  // Start bracket
  const startBracket = new THREE.BufferGeometry().setFromPoints([
    start.clone().add(perpendicular.clone().multiplyScalar(bracketSize)),
    start.clone().add(perpendicular.clone().multiplyScalar(-bracketSize))
  ]);
  group.add(new THREE.Line(startBracket, lineMaterial));

  // End bracket
  const endBracket = new THREE.BufferGeometry().setFromPoints([
    end.clone().add(perpendicular.clone().multiplyScalar(bracketSize)),
    end.clone().add(perpendicular.clone().multiplyScalar(-bracketSize))
  ]);
  group.add(new THREE.Line(endBracket, lineMaterial));

  // Text label using canvas texture
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(spriteMaterial);

  // Position label at midpoint with offset
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  sprite.position.copy(midpoint).add(offset);
  sprite.scale.set(8, 2, 1);
  group.add(sprite);

  return group;
}

function useThreeRenderer(canvasRef, objects, viewSettings, resetViewSignal = 0, theme = 'dark', stlGeometry = null) {
  const frameRef = useRef(null);
  const mouseRef = useRef({
    down: false, button: -1, x: 0, y: 0,
    theta: 0.8, phi: 0.6, dist: 50,
    panX: 0, panY: 0, panZ: 0,
  });
  const [scene, setScene] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newScene = new THREE.Scene();
    const bgColor = theme === 'dark' ? '#1a1b26' : '#e8eaed';
    newScene.background = new THREE.Color(bgColor);
    setScene(newScene);

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    const m = mouseRef.current;
    if (resetViewSignal > 0) {
      Object.assign(m, { theta: 0.8, phi: 0.6, dist: 50, down: false, button: -1, panX: 0, panY: 0, panZ: 0 });
    }

    const updateCam = () => {
      const cx = m.panX + m.dist * Math.sin(m.theta) * Math.cos(m.phi);
      const cy = m.panY + m.dist * Math.sin(m.phi);
      const cz = m.panZ + m.dist * Math.cos(m.theta) * Math.cos(m.phi);
      camera.position.set(cx, cy, cz);
      camera.lookAt(m.panX, m.panY, m.panZ);
    };
    updateCam();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // HDRI environment via RoomEnvironment (no external texture needed)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    newScene.environment = envTexture;
    pmremGenerator.dispose();

    // Key light with shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
    keyLight.position.set(30, 50, 30);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 300;
    keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -80;
    keyLight.shadow.camera.right = keyLight.shadow.camera.top = 80;
    newScene.add(keyLight);

    // Soft fill
    newScene.add(new THREE.AmbientLight(0xffffff, 0.3));

    if (viewSettings.grid) {
      const gridColor = theme === 'dark' ? 0x333355 : 0xccccdd;
      const gridColor2 = theme === 'dark' ? 0x222244 : 0xddddee;
      newScene.add(new THREE.GridHelper(100, 20, gridColor, gridColor2));
    }
    if (viewSettings.axes) newScene.add(new THREE.AxesHelper(15));

    // ── Compute scene bounding box ──
    let sceneBBox = null;
    const computeBoundingBox = () => {
      const box = new THREE.Box3();
      newScene.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
          const meshBox = new THREE.Box3().setFromObject(obj);
          box.union(meshBox);
        }
      });
      return box.isEmpty() ? null : box;
    };

    // ── STL geometry from openscad-wasm (Phase 1) ──
    if (stlGeometry) {
      const stlMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#4fc3f7'),
        metalness: 0.05,
        roughness: 0.3,
        clearcoat: 0.5,
        clearcoatRoughness: 0.15,
        transparent: true,
        opacity: 0.94,
        envMapIntensity: 1.2,
      });
      const stlMesh = new THREE.Mesh(stlGeometry, stlMaterial);
      // OpenSCAD Y↔Z swap: rotate -90° around X to convert Z-up to Y-up
      stlMesh.rotation.x = -Math.PI / 2;
      stlMesh.castShadow = true;
      stlMesh.receiveShadow = true;
      newScene.add(stlMesh);

      if (viewSettings.wireframe) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(stlGeometry),
          new THREE.LineBasicMaterial({ color: new THREE.Color('#4fc3f7').multiplyScalar(0.6), transparent: true, opacity: 0.4 }),
        );
        edges.rotation.copy(stlMesh.rotation);
        newScene.add(edges);
      }
    }

    for (const obj of objects) {
      let geometry;
      const matColor = new THREE.Color(obj.color);
      const material = new THREE.MeshPhysicalMaterial({
        color: matColor,
        metalness: 0.05,
        roughness: 0.3,
        clearcoat: 0.5,
        clearcoatRoughness: 0.15,
        transparent: true,
        opacity: 0.94,
        envMapIntensity: 1.2,
      });

      switch (obj.type) {
        case 'cube':
          geometry = new THREE.BoxGeometry(obj.size[0], obj.size[2], obj.size[1]);
          break;
        case 'sphere':
          geometry = new THREE.SphereGeometry(obj.r, Math.min(obj.fn, 64), Math.min(obj.fn / 2, 32));
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(obj.r2, obj.r1, obj.h, Math.min(obj.fn, 64));
          break;
        case 'text':
          geometry = new THREE.BoxGeometry(obj.textSize * String(obj.text).length * 0.6, obj.textSize, obj.textSize * 0.2);
          break;

        case 'polygon_extruded': {
          try {
            const pts = obj.points;
            if (!pts || pts.length < 3) continue;
            const shape = new THREE.Shape();
            // Negate Y so that after rotateX(-PI/2) the shape lies correctly in XZ plane
            shape.moveTo(pts[0][0], -pts[0][1]);
            for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
            shape.closePath();
            // Holes via paths[1..]
            if (obj.paths && obj.paths.length > 1) {
              for (let p = 1; p < obj.paths.length; p++) {
                const hole = new THREE.Path();
                const hi = obj.paths[p];
                hole.moveTo(pts[hi[0]][0], -pts[hi[0]][1]);
                for (let k = 1; k < hi.length; k++) hole.lineTo(pts[hi[k]][0], -pts[hi[k]][1]);
                shape.holes.push(hole);
              }
            }
            geometry = new THREE.ExtrudeGeometry(shape, {
              depth: obj.extrude?.height ?? 1,
              bevelEnabled: false,
            });
            geometry.rotateX(-Math.PI / 2);
          } catch (_) { continue; }
          break;
        }

        case 'circle_extruded': {
          const h = obj.extrude?.height ?? 1;
          geometry = new THREE.CylinderGeometry(obj.r, obj.r, h, Math.min(obj.fn, 64));
          break;
        }

        case 'square_extruded': {
          const sz = obj.size ?? [1, 1];
          const h = obj.extrude?.height ?? 1;
          geometry = new THREE.BoxGeometry(sz[0], h, sz[1]);
          break;
        }

        default: continue;
      }

      const mesh = new THREE.Mesh(geometry, material);

      // Position corrections for non-centered geometry
      if (obj.type === 'cube' && !obj.center) mesh.position.set(obj.size[0] / 2, obj.size[2] / 2, obj.size[1] / 2);
      if (obj.type === 'cylinder' && !obj.center) mesh.position.y = obj.h / 2;
      if (obj.type === 'circle_extruded' && !obj.center) mesh.position.y = (obj.extrude?.height ?? 1) / 2;
      if (obj.type === 'square_extruded' && !obj.center) mesh.position.y = (obj.extrude?.height ?? 1) / 2;

      // Apply transforms (OpenSCAD Y↔Z swap)
      mesh.scale.set(obj.scale[0], obj.scale[2], obj.scale[1]);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(obj.rotate[0]),
        THREE.MathUtils.degToRad(obj.rotate[2]),
        THREE.MathUtils.degToRad(obj.rotate[1]),
      );
      mesh.position.x += obj.translate[0];
      mesh.position.y += obj.translate[2];
      mesh.position.z += obj.translate[1];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      newScene.add(mesh);

      if (viewSettings.wireframe) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: matColor.clone().multiplyScalar(0.6), transparent: true, opacity: 0.4 }),
        );
        edges.position.copy(mesh.position);
        edges.rotation.copy(mesh.rotation);
        edges.scale.copy(mesh.scale);
        newScene.add(edges);
      }
    }

    // ── Add dimension brackets ──
    if (viewSettings.dimensions) {
      sceneBBox = computeBoundingBox();
      if (sceneBBox) {
        const min = sceneBBox.min;
        const max = sceneBBox.max;
        const size = new THREE.Vector3();
        sceneBBox.getSize(size);

        const dimColor = theme === 'dark' ? 0x4fc3f7 : 0x1565c0;
        const offsetDist = 3;

        // Width (X-axis) - bottom front
        if (size.x > 0.1) {
          const dimGroup = createDimensionBracket(
            new THREE.Vector3(min.x, min.y - offsetDist, max.z + offsetDist),
            new THREE.Vector3(max.x, min.y - offsetDist, max.z + offsetDist),
            new THREE.Vector3(0, 0, 2),
            `${size.x.toFixed(1)}mm`,
            dimColor
          );
          newScene.add(dimGroup);
        }

        // Depth (Z-axis) - right side
        if (size.z > 0.1) {
          const dimGroup = createDimensionBracket(
            new THREE.Vector3(max.x + offsetDist, min.y - offsetDist, min.z),
            new THREE.Vector3(max.x + offsetDist, min.y - offsetDist, max.z),
            new THREE.Vector3(2, 0, 0),
            `${size.z.toFixed(1)}mm`,
            dimColor
          );
          newScene.add(dimGroup);
        }

        // Height (Y-axis) - right back corner
        if (size.y > 0.1) {
          const dimGroup = createDimensionBracket(
            new THREE.Vector3(max.x + offsetDist, min.y, min.z - offsetDist),
            new THREE.Vector3(max.x + offsetDist, max.y, min.z - offsetDist),
            new THREE.Vector3(2, 0, 0),
            `${size.y.toFixed(1)}mm`,
            dimColor
          );
          newScene.add(dimGroup);
        }
      }
    }

    function animate() { frameRef.current = requestAnimationFrame(animate); renderer.render(newScene, camera); }
    animate();

    // ── Controls ──────────────────────────────────────────────────────
    const onDown = (e) => { m.down = true; m.button = e.button; m.x = e.clientX; m.y = e.clientY; };
    const onUp = () => { m.down = false; };
    const onMove = (e) => {
      if (!m.down) return;
      const dx = e.clientX - m.x, dy = e.clientY - m.y;
      m.x = e.clientX; m.y = e.clientY;
      if (m.button === 2) {
        // Right-click: pan (drag direction matches view movement)
        const panSpeed = m.dist * 0.001;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        const forward = new THREE.Vector3(
          Math.sin(m.theta) * Math.cos(m.phi),
          Math.sin(m.phi),
          Math.cos(m.theta) * Math.cos(m.phi),
        ).normalize();
        right.crossVectors(forward, up).normalize().multiplyScalar(-dx * panSpeed);
        const upVec = up.clone().multiplyScalar(-dy * panSpeed);
        m.panX -= right.x + upVec.x;
        m.panY -= right.y + upVec.y;
        m.panZ -= right.z + upVec.z;
      } else {
        // Left-click: orbit
        m.theta -= dx * 0.01;
        m.phi = Math.max(-1.5, Math.min(1.5, m.phi + dy * 0.01));
      }
      updateCam();
    };
    const onWheel = (e) => {
      e.preventDefault();
      m.dist = Math.max(3, Math.min(500, m.dist * (1 + e.deltaY * 0.001)));
      updateCam();
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    const onResize = () => {
      if (!canvas.parentElement) return;
      const w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 50);

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      envTexture.dispose();
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }, [objects, viewSettings, resetViewSignal, theme, stlGeometry]);

  return scene;
}

export { useThreeRenderer };
