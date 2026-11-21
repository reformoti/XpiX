import * as THREE from './gliboke-pole/vendor/three.module.js';
import { buildStarSculpture } from './gliboke-pole/star-geometry.js';

// Actual Three.js component on the XpiX homepage, sharing its model with Deep Field.
function initDeepFieldHero() {
  const canvas = document.getElementById('xpix-deepfield');
  const host = canvas?.closest('.hero-art');
  const panel = document.getElementById('hero-scene-panel');
  const colorInput = document.getElementById('hero-glow-color');
  const intensityInput = document.getElementById('hero-glow-intensity');
  const intensityOutput = document.getElementById('hero-glow-value');
  if (!canvas || !host || !panel || !colorInput || !intensityInput) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'high-performance'
    });
  } catch {
    // The original SVG artwork stays visible when WebGL is unavailable.
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 11);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-4, 6, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xed243d, 2.1);
  rim.position.set(5, -3, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xb6c4d9, 1.0);
  fill.position.set(0, -6, 4);
  scene.add(fill);

  const accent = new THREE.Color('#ed243d');
  const materials = {
    face: new THREE.MeshStandardMaterial({
      color: 0xe5e5e4, metalness: 0.66, roughness: 0.27,
    }),
    edge: new THREE.MeshStandardMaterial({
      color: 0x42444b, metalness: 0.78, roughness: 0.35,
    }),
    inlay: new THREE.MeshBasicMaterial({ color: accent }),
  };

  const sculpture = buildStarSculpture(materials, 2.15, 0.38, 0.48);
  const sculptureRig = new THREE.Group();
  sculpture.rotation.z = Math.PI / 4;
  sculptureRig.add(sculpture);
  sculptureRig.rotation.set(-0.2, -0.32, 0);
  scene.add(sculptureRig);

  // A simple emissive glow, drawn procedurally rather than loaded from a network.
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 128;
  const ctx = haloCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.68)');
  gradient.addColorStop(.18, 'rgba(255,255,255,.31)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.08)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  const haloMaterial = new THREE.SpriteMaterial({
    map: haloTexture, color: accent, opacity: .75,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: true, toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMaterial);
  halo.position.set(0, 0, -1.8);
  halo.scale.set(7.3, 7.3, 1);
  scene.add(halo);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xa0a0a5, transparent: true, opacity: .18,
    depthWrite: false, side: THREE.DoubleSide,
  });
  for (const [radius, rx, ry] of [[3.13, .3, .7], [3.5, 1.1, -.3]]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, .008, 4, 140),
      ringMaterial
    );
    ring.rotation.set(rx, ry, 0);
    scene.add(ring);
  }

  let seed = 1827;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions = [];
  for (let i = 0; i < 170; i++) {
    positions.push((random() - .5) * 17, (random() - .5) * 14, -4 - random() * 9);
  }
  const dots = new THREE.BufferGeometry();
  dots.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(dots, new THREE.PointsMaterial({
    color: 0xe2dbe4, size: .043, transparent: true, opacity: .65,
    sizeAttenuation: true, depthWrite: false,
  })));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let lastTime = 0;
  let visible = true;
  let drag = null;

  function render() {
    renderer.render(scene, camera);
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(bounds.width));
    const h = Math.max(1, Math.round(bounds.height));
    camera.aspect = w / h;
    camera.position.z = w < 430 ? 12.9 : 11;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    render();
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(now - (lastTime || now), 60);
    lastTime = now;
    if (!drag && !reduceMotion.matches) {
      sculptureRig.rotation.y += dt * .00027;
      sculptureRig.rotation.x = -0.16 + Math.sin(now * .0005) * .1;
    }
    render();
    if (!reduceMotion.matches) frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (document.hidden || !visible) return;
    if (reduceMotion.matches) render();
    else if (!frame) frame = requestAnimationFrame(tick);
  }
  function updateGlow() {
    const value = Math.min(150, Math.max(0, Number(intensityInput.value) || 0));
    const strength = value / 100;
    const color = new THREE.Color(colorInput.value);
    materials.inlay.color.copy(color);
    haloMaterial.color.copy(color);
    haloMaterial.opacity = Math.min(1, .72 * strength);
    halo.scale.setScalar(6.8 + strength * .65);
    rim.color.copy(color);
    rim.intensity = 1.1 + strength * 1.4;
    if (intensityOutput) intensityOutput.value = String(Math.round(value)) + '%';
    render();
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    sculptureRig.rotation.y += dx * .008;
    sculptureRig.rotation.x = THREE.MathUtils.clamp(sculptureRig.rotation.x + dy * .006, -1.2, 1.2);
    drag.x = event.clientX;
    drag.y = event.clientY;
    render();
  });
  const endDrag = event => {
    if (drag?.id === event.pointerId) drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', event => {
    const steps = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    sculptureRig.rotation.y += step[0];
    sculptureRig.rotation.x = THREE.MathUtils.clamp(sculptureRig.rotation.x + step[1], -1.2, 1.2);
    render();
  });
  colorInput.addEventListener('input', updateGlow);
  intensityInput.addEventListener('input', updateGlow);
  const visibility = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) stop();
    else { lastTime = 0; resume(); }
  }, { rootMargin: '120px' });
  visibility.observe(host);
  new ResizeObserver(resize).observe(host);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else { lastTime = 0; resume(); }
  });
  reduceMotion.addEventListener('change', () => {
    stop();
    resume();
  });
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    stop();
    host.classList.remove('is-3d');
    panel.hidden = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    host.classList.add('is-3d');
    panel.hidden = false;
    resize();
    resume();
  });
  host.classList.add('is-3d');
  panel.hidden = false;
  resize();
  updateGlow();
  resume();
}
initDeepFieldHero();
