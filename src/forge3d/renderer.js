import { useEffect, useRef } from "react";
import * as THREE from "three";

function useThreeRenderer(canvasRef, objects, viewSettings, resetViewSignal = 0) {
  const frameRef = useRef(null);
  const mouseRef = useRef({ down: false, button: -1, x: 0, y: 0, theta: 0.8, phi: 0.6, dist: 50 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1b26');

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    const m = mouseRef.current;
    if (resetViewSignal > 0) {
      Object.assign(m, { theta: 0.8, phi: 0.6, dist: 50, down: false, button: -1 });
    }
    const updateCam = () => {
      camera.position.set(
        m.dist * Math.sin(m.theta) * Math.cos(m.phi),
        m.dist * Math.sin(m.phi),
        m.dist * Math.cos(m.theta) * Math.cos(m.phi)
      );
      camera.lookAt(0, 0, 0);
    };
    updateCam();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
    d1.position.set(30, 50, 30); d1.castShadow = true; scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x88aaff, 0.3);
    d2.position.set(-20, 30, -20); scene.add(d2);

    if (viewSettings.grid) scene.add(new THREE.GridHelper(100, 20, 0x333355, 0x222244));
    if (viewSettings.axes) scene.add(new THREE.AxesHelper(15));

    for (const obj of objects) {
      let geometry;
      const matColor = new THREE.Color(obj.color);
      const material = new THREE.MeshPhysicalMaterial({
        color: matColor, metalness: 0.1, roughness: 0.4,
        clearcoat: 0.3, clearcoatRoughness: 0.25, transparent: true, opacity: 0.92,
      });

      switch (obj.type) {
        case 'cube': geometry = new THREE.BoxGeometry(obj.size[0], obj.size[2], obj.size[1]); break;
        case 'sphere': geometry = new THREE.SphereGeometry(obj.r, Math.min(obj.fn, 64), Math.min(obj.fn / 2, 32)); break;
        case 'cylinder': geometry = new THREE.CylinderGeometry(obj.r2, obj.r1, obj.h, Math.min(obj.fn, 64)); break;
        case 'text': geometry = new THREE.BoxGeometry(obj.textSize * String(obj.text).length * 0.6, obj.textSize, obj.textSize * 0.2); break;
        default: continue;
      }

      const mesh = new THREE.Mesh(geometry, material);
      if (obj.type === 'cube' && !obj.center) mesh.position.set(obj.size[0] / 2, obj.size[2] / 2, obj.size[1] / 2);
      if (obj.type === 'cylinder' && !obj.center) mesh.position.y = obj.h / 2;

      mesh.scale.set(obj.scale[0], obj.scale[2], obj.scale[1]);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(obj.rotate[0]),
        THREE.MathUtils.degToRad(obj.rotate[2]),
        THREE.MathUtils.degToRad(obj.rotate[1])
      );
      mesh.position.x += obj.translate[0];
      mesh.position.y += obj.translate[2];
      mesh.position.z += obj.translate[1];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      if (viewSettings.wireframe) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: matColor.clone().multiplyScalar(0.6), transparent: true, opacity: 0.4 })
        );
        edges.position.copy(mesh.position);
        edges.rotation.copy(mesh.rotation);
        edges.scale.copy(mesh.scale);
        scene.add(edges);
      }
    }

    function animate() { frameRef.current = requestAnimationFrame(animate); renderer.render(scene, camera); }
    animate();

    const onDown = (e) => { m.down = true; m.button = e.button; m.x = e.clientX; m.y = e.clientY; };
    const onUp = () => { m.down = false; };
    const onMove = (e) => {
      if (!m.down) return;
      const dx = e.clientX - m.x, dy = e.clientY - m.y;
      m.x = e.clientX; m.y = e.clientY;
      m.theta -= dx * 0.01;
      m.phi = Math.max(-1.5, Math.min(1.5, m.phi + dy * 0.01));
      updateCam();
    };
    const onWheel = (e) => {
      e.preventDefault();
      m.dist = Math.max(5, Math.min(200, m.dist + e.deltaY * 0.05));
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
      cancelAnimationFrame(frameRef.current); renderer.dispose();
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }, [objects, viewSettings, resetViewSignal]);
}

export { useThreeRenderer };
