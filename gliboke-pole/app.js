import * as THREE from './vendor/three.module.js';
window.__deepFieldModuleLoaded = true;

const dom = {
  stage: document.getElementById('stage'),
  back: document.getElementById('glBack'),
  front: document.getElementById('glFront'),
  giant: document.querySelector('.giant'),
  loader: document.getElementById('loader'),
  loaderFill: document.getElementById('loaderFill'),
  loaderStep: document.getElementById('loaderStep'),
  loaderPct: document.getElementById('loaderPct'),
  fatal: document.getElementById('fatal'),
  fatalText: document.getElementById('fatalText'),
  fatalRetry: document.getElementById('fatalRetry'),
  viewBtns: Array.from(document.querySelectorAll('.view')),
  freeBtn: document.getElementById('freeBtn'),
  freeBtnText: document.getElementById('freeBtnText'),
  lensBtns: Array.from(document.querySelectorAll('.lensbtn')),
  formBtns: Array.from(document.querySelectorAll('.formbtn')),
  modeLabel: document.getElementById('modeLabel'),
  hintText: document.getElementById('hintText'),
  hintMark: document.getElementById('hintMark'),
  caption: document.getElementById('caption'),
  tAz: document.getElementById('tAz'),
  tEl: document.getElementById('tEl'),
  tDist: document.getElementById('tDist'),
  tFocal: document.getElementById('tFocal'),
  tSignal: document.getElementById('tSignal'),
  tCraft: document.getElementById('tCraft'),
  rail: document.getElementById('rail'),
  railNote: document.getElementById('railNote'),
  railSub: document.getElementById('railSub'),
  toast: document.getElementById('toast'),
  soundBtn: document.getElementById('soundBtn'),
  soundLabel: document.getElementById('soundLabel'),
  sliders: {
    az: document.getElementById('cAz'),
    pol: document.getElementById('cPol'),
    dist: document.getElementById('cDist'),
    exp: document.getElementById('cExp'),
    fog: document.getElementById('cFog'),
    track: document.getElementById('cTrack'),
    stars: document.getElementById('cStars'),
  },
  values: {
    az: document.getElementById('vAz'),
    pol: document.getElementById('vPol'),
    dist: document.getElementById('vDist'),
    exp: document.getElementById('vExp'),
    fog: document.getElementById('vFog'),
    track: document.getElementById('vTrack'),
    stars: document.getElementById('vStars'),
  },
  toggles: {
    track: document.getElementById('tgTrack'),
    beam: document.getElementById('tgBeam'),
    grid: document.getElementById('tgGrid'),
    wire: document.getElementById('tgWire'),
  },
  qualityBtns: Array.from(document.querySelectorAll('.chip--q')),
  railReset: document.getElementById('railReset'),
  railRandom: document.getElementById('railRandom'),
  railExport: document.getElementById('railExport'),
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 16));

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionQuery.matches;
motionQuery.addEventListener('change', (e) => { reducedMotion = e.matches; });

/* ── Тема з CSS-змінних ──────────────────────────────────────── */

const COLORISH = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i;

function readColorVar(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (COLORISH.test(raw)) return new THREE.Color().setStyle(raw);
  return new THREE.Color(fallback);
}

function readTheme() {
  const bg = readColorVar('--site-bg', '#07080c');
  const fg = readColorVar('--site-fg', '#f4f0eb');
  const accent = readColorVar('--site-accent', '#ed243d');
  const surface = readColorVar('--site-surface', '#1c1d24');
  const muted = readColorVar('--site-muted', '#b4aeb7');
  const mix = (a, b, t) => a.clone().lerp(b, t);

  return {
    zenith: bg.clone(),
    mid: mix(bg, surface, 0.35),
    horizon: mix(bg, accent, 0.14),
    sun: accent.clone(),
    cloud: mix(bg, accent, 0.35),
    fog: bg.clone(),
    crust: bg.clone(),
    metal: mix(surface, muted, 0.2),
    dish: mix(fg, muted, 0.18),
    apple: mix(bg, surface, 0.12),
    ink: fg,
    accent,
  };
}

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith, uMid, uHorizon, uSun, uCloud;
uniform vec3 uSunDir;
uniform float uTime, uStars;

float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { s += a * n2(p); p *= 2.13; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  vec2 uv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
  float cloud = fbm(uv * vec2(3.0, 5.0) + vec2(uTime * 0.003, 0.0));
  float ribbon = exp(-pow((d.y + d.x * 0.32 - 0.1) * 3.8, 2.0));
  vec3 col = mix(uZenith, uMid, cloud * 0.65);
  col = mix(col, uCloud, ribbon * smoothstep(0.45, 0.8, cloud) * 0.42);
  float glow = max(dot(d, normalize(uSunDir)), 0.0);
  col += uHorizon * pow(glow, 8.0) * 0.55;
  col += uSun * pow(glow, 32.0) * 0.035;

  vec2 cell = floor(uv * 280.0);
  vec2 local = fract(uv * 280.0) - 0.5;
  float point = step(0.998, h21(cell)) * exp(-dot(local, local) * 90.0);
  col += vec3(point) * uStars * 0.6;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function makeSkyMaterial(theme) {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: theme.zenith.clone() },
      uMid: { value: theme.mid.clone() },
      uHorizon: { value: theme.horizon.clone() },
      uSun: { value: theme.sun.clone() },
      uCloud: { value: theme.cloud.clone() },
      uSunDir: { value: new THREE.Vector3(0.25, 0.12, -1).normalize() },
      uTime: { value: 0 },
      uStars: { value: 0.45 },
    },
  });
}

/* ── Напрямкування та монумент ───────────────────────────────── */

function pointingVector(az, el) {
  const tilt = Math.PI / 2 - el;
  return new THREE.Vector3(
    Math.sin(az) * Math.sin(tilt),
    Math.cos(tilt),
    Math.cos(az) * Math.sin(tilt)
  ).normalize();
}

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;

function alignSegment(mesh, from, to) {
  const len = from.distanceTo(to);
  const dir = to.clone().sub(from).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  mesh.scale.set(1, len, 1);
  mesh.position.copy(from).addScaledVector(dir, len * 0.5);
}

function starOutline(L, t) {
  const pts = [
    [0, L], [-t, t], [-L, 0], [-t, -t],
    [0, -L], [t, -t], [L, 0], [t, t],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  return shape;
}

function buildStarSculpture(m, L, t, depth) {
  const g = new THREE.Group();

  const bodyGeo = new THREE.ExtrudeGeometry(starOutline(L, t), {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.14,
    bevelSize: t * 0.18,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 1,
  });
  bodyGeo.translate(0, 0, -depth / 2);
  g.add(new THREE.Mesh(bodyGeo, [m.face, m.edge]));

  const inlayGeo = new THREE.ExtrudeGeometry(starOutline(L * 0.3, t * 0.3), {
    depth: depth * 0.14,
    bevelEnabled: true,
    bevelThickness: depth * 0.05,
    bevelSize: t * 0.06,
    bevelSegments: 1,
    curveSegments: 1,
  });
  for (const s of [1, -1]) {
    const inlay = new THREE.Mesh(inlayGeo, m.inlay);
    inlay.position.z = s * (depth / 2 + depth * 0.13);
    if (s < 0) inlay.rotation.y = Math.PI;
    g.add(inlay);
  }

  return g;
}

function applePoint(u, v, out) {
  const sv = Math.sin(v), cv = Math.cos(v);
  const r = Math.pow(Math.max(sv, 0), 0.78) * (1 + 0.2 * sv * sv) * (1 - 0.16 * cv);
  const y = 1.12 * cv - 0.42 * (1 - smoothstep(0, 0.62, v));
  return out.set(r * Math.cos(u), y, r * Math.sin(u));
}

function buildApple(m, S) {
  const RV = 25, RU = 34;
  const cols = RU + 1;
  const pos = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= RV; i++) {
    const v = (i / RV) * Math.PI;
    for (let j = 0; j <= RU; j++) {
      applePoint((j / RU) * TAU, v, p);
      pos.push(p.x * S, p.y * S, p.z * S);
    }
  }

  const tris = [];
  for (let i = 0; i < RV; i++) {
    for (let j = 0; j < RU; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      tris.push(a, c, b, b, c, d);
    }
  }
  const surf = new THREE.BufferGeometry();
  surf.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  surf.setIndex(tris);
  surf.computeVertexNormals();

  const edges = [];
  for (let i = 1; i < RV; i++) for (let j = 0; j < RU; j++) edges.push(i * cols + j, i * cols + j + 1);
  for (let j = 0; j < RU; j++) for (let i = 0; i < RV; i++) edges.push(i * cols + j, (i + 1) * cols + j);
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wireGeo.setIndex(edges);

  const g = new THREE.Group();
  g.add(new THREE.Mesh(surf, m.appleFill));
  g.add(new THREE.LineSegments(wireGeo, m.wire));

  const stem = [];
  const top = 0.7 * S;
  for (let i = 0; i < 10; i++) {
    const t0 = i / 10, t1 = (i + 1) / 10;
    const at = (t) => [Math.sin(t * 1.5) * S * 0.16, top + t * S * 0.62, Math.sin(t * 2.2) * S * 0.07];
    stem.push(...at(t0), ...at(t1));
  }
  const leaf = [];
  const lx = S * 0.34, ly = top + S * 0.44, lz = S * 0.1;
  for (let i = 0; i < 26; i++) {
    const a0 = (i / 26) * TAU, a1 = ((i + 1) / 26) * TAU;
    const at = (a) => [lx + Math.cos(a) * S * 0.42, ly + Math.sin(a) * S * 0.17, lz + Math.cos(a) * S * 0.16];
    leaf.push(...at(a0), ...at(a1));
  }
  const detailGeo = new THREE.BufferGeometry();
  detailGeo.setAttribute('position', new THREE.Float32BufferAttribute([...stem, ...leaf], 3));
  g.add(new THREE.LineSegments(detailGeo, m.wire));

  return g;
}

function buildMonument(m, radius) {
  const root = new THREE.Group();
  const yaw = new THREE.Group();
  root.add(yaw);

  const head = new THREE.Group();
  const headY = 24;
  head.position.y = headY;
  yaw.add(head);

  const star = buildStarSculpture(m, radius * 0.78, radius * 0.15, radius * 0.22);
  head.add(star);

  const apple = buildApple(m, radius * 0.57);
  apple.visible = false;
  head.add(apple);

  const emitter = new THREE.Object3D();
  head.add(emitter);
  return { root, yaw, head, headY, star, apple, emitter };
}

/* ── Ключові кадри маршруту ──────────────────────────────────── */

const VIEWS = [
  {
    pos: new THREE.Vector3(-9, 14, 68),
    look: new THREE.Vector3(0, 24, 0),
    fov: 40,
    caption: 'Об’ємна чотирипроменева зірка. Вільна форма у відкритому просторі.',
    captionApple: 'Червоний каркас і чорна поверхня. Яблуко у відкритому просторі.',
  },
  {
    pos: new THREE.Vector3(24, 17, 30),
    look: new THREE.Vector3(0, 25, 0),
    fov: 34,
    caption: 'Метал, гострі промені та червоний акцент. Деталі зблизька.',
    captionApple: '34 меридіани та 25 кілець: червоні лінії повторюють форму яблука.',
  },
  {
    pos: new THREE.Vector3(20, 10, 40),
    look: new THREE.Vector3(-20, 110, 66),
    fov: 50,
    caption: 'Прямий канал до КА «Орій-7»: 4,2 години світла в обидва боки.',
    captionApple: 'Сигнал крізь каркас: канал до КА «Орій-7» лишається відкритим.',
  },
];

const CRAFT_AZ = -0.3;
const CRAFT_EL = 0.92;

const state = {
  progress: 0,
  targetProgress: 0,
  freeLook: false,
  lens: 1,
  baseFov: VIEWS[0].fov,
  orbit: { az: 0, pol: 1.2, dist: 68, target: VIEWS[0].look.clone() },
  drag: null,
  pinch: null,
  titleOpacity: 1,
  activeView: 0,
};

const DEFAULTS = { exposure: 1.02, fog: 1, trackSpeed: 1, stars: 0.8, quality: 1, form: 'star' };

const settings = {
  ...DEFAULTS,
  tracking: true,
  beamOn: true,
  grid: false,
  wireframe: false,
};

let rendererBack, rendererFront, scene, camera, skyMat, monument, satellite, beam, beamGlow, stars, gridHelper;
let craftAnchor, craftDir;
const mats = {};
let clockTime = 0, last = performance.now(), visible = true;
let theme = readTheme();

/* ── Звук станції: вітер, гул приводів, відгук керування ─────── */

const audio = {
  enabled: true,
  ctx: null,
  master: null,
  wind: null,
  servo: null,
  ready: false,
};

function noiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.0990460;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
  }
  return buf;
}

function startAudio() {
  if (audio.ready || !audio.enabled) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) { audio.enabled = false; syncSoundButton(); return; }

  const ctx = new Ctx();
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  audio.master.gain.value = 0;
  audio.master.connect(ctx.destination);

  const windSrc = ctx.createBufferSource();
  windSrc.buffer = noiseBuffer(ctx, 6);
  windSrc.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 460;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.5;
  windSrc.connect(windFilter).connect(windGain).connect(audio.master);
  windSrc.start();
  audio.wind = windGain;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.28;
  lfo.connect(lfoGain).connect(windGain.gain);
  lfo.start();

  const hum = ctx.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 62;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.05;
  hum.connect(humGain).connect(audio.master);
  hum.start();

  const servoSrc = ctx.createBufferSource();
  servoSrc.buffer = noiseBuffer(ctx, 4);
  servoSrc.loop = true;
  const servoFilter = ctx.createBiquadFilter();
  servoFilter.type = 'bandpass';
  servoFilter.frequency.value = 780;
  servoFilter.Q.value = 5;
  const servoGain = ctx.createGain();
  servoGain.gain.value = 0;
  servoSrc.connect(servoFilter).connect(servoGain).connect(audio.master);
  servoSrc.start();
  audio.servo = servoGain;

  audio.ready = true;
  ctx.resume();
  audio.master.gain.linearRampToValueAtTime(0.075, ctx.currentTime + 1.6);
}

function blip(freq, dur) {
  if (!audio.ready || !audio.enabled) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(gain).connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function syncSoundButton() {
  dom.soundBtn.classList.toggle('is-on', audio.enabled);
  dom.soundBtn.setAttribute('aria-pressed', String(audio.enabled));
  dom.soundLabel.textContent = audio.enabled ? 'ЗВУК СТАНЦІЇ' : 'ЗВУК ВИМКНЕНО';
}

function toggleSound() {
  audio.enabled = !audio.enabled;
  syncSoundButton();
  if (audio.enabled) {
    startAudio();
    if (audio.ready) audio.master.gain.linearRampToValueAtTime(0.075, audio.ctx.currentTime + 0.5);
  } else if (audio.ready) {
    audio.master.gain.linearRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.3);
  }
}

let toastTimer = null;
function toast(message) {
  dom.toast.textContent = message;
  dom.toast.removeAttribute('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.setAttribute('hidden', ''), 2600);
}

function fatal(message) {
  dom.loader.setAttribute('hidden', '');
  dom.fatalText.textContent = message;
  dom.fatal.removeAttribute('hidden');
}

function setLoad(pct, step) {
  dom.loaderFill.style.width = `${Math.round(pct)}%`;
  dom.loaderPct.textContent = `${Math.round(pct)} %`;
  if (step) dom.loaderStep.textContent = step;
}

async function init() {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
    fatal('Браузер не надав контекст WebGL. Увімкніть апаратне прискорення або відкрийте сторінку в іншому браузері.');
    return;
  }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  setLoad(8, 'ІНІЦІАЛІЗАЦІЯ КОНТЕКСТУ');
  rendererBack = new THREE.WebGLRenderer({ canvas: dom.back, antialias: true, powerPreference: 'high-performance' });
  rendererFront = new THREE.WebGLRenderer({ canvas: dom.front, antialias: true, alpha: true, powerPreference: 'high-performance' });
  for (const r of [rendererBack, rendererFront]) {
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.02;
    r.outputColorSpace = THREE.SRGBColorSpace;
  }
  rendererFront.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(theme.fog.clone(), 0.0016);
  camera = new THREE.PerspectiveCamera(VIEWS[0].fov, 1, 0.5, 6000);
  camera.position.copy(VIEWS[0].pos);
  camera.lookAt(VIEWS[0].look);

  await nextFrame();
  setLoad(22, 'ПОБУДОВА НЕБЕСНОЇ СФЕРИ');

  skyMat = makeSkyMaterial(theme);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 40, 24), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  await nextFrame();
  setLoad(36, 'КАЛІБРУВАННЯ СВІТЛА');

  const pmrem = new THREE.PMREMGenerator(rendererBack);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 20), skyMat);
  envSky.frustumCulled = false;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0.02, 1, 2000).texture;
  pmrem.dispose();
  envSky.geometry.dispose();

  theme = readTheme();
  mats.edge = new THREE.MeshStandardMaterial({ color: theme.metal, roughness: 0.25, metalness: 0.78, envMapIntensity: 1.1 });
  mats.face = new THREE.MeshStandardMaterial({
    color: theme.dish, roughness: 0.24, metalness: 0.7, envMapIntensity: 1.25,
  });
  mats.inlay = new THREE.MeshStandardMaterial({
    color: theme.accent, roughness: 0.3, metalness: 0.35,
    emissive: theme.accent.clone().multiplyScalar(0.4),
  });
  mats.wire = new THREE.LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.95 });
  mats.appleFill = new THREE.MeshStandardMaterial({
    color: theme.apple, roughness: 0.3, metalness: 0.5,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });

  const key = new THREE.DirectionalLight(theme.ink, 3.2);
  key.position.set(-90, 120, 150);
  const fill = new THREE.DirectionalLight(theme.accent, 2.4);
  fill.position.set(110, 20, -90);
  const rim = new THREE.DirectionalLight(theme.ink, 1.4);
  rim.position.set(160, 140, 40);
  const hemi = new THREE.HemisphereLight(theme.ink, theme.zenith, 0.5);
  for (const l of [key, fill, rim, hemi]) { l.layers.enableAll(); scene.add(l); }

  await nextFrame();
  setLoad(80, 'ФОРМУВАННЯ ЗІРКИ');

  craftDir = pointingVector(CRAFT_AZ, CRAFT_EL);
  monument = buildMonument(mats, 17);
  monument.yaw.rotation.y = CRAFT_AZ;
  scene.add(monument.root);
  monument.root.traverse((o) => { o.layers.set(1); });

  await nextFrame();
  setLoad(90, 'НАВЕДЕННЯ НА КА «ОРІЙ-7»');

  const emitterWorld = new THREE.Vector3();
  monument.emitter.getWorldPosition(emitterWorld);
  craftAnchor = emitterWorld.clone();

  satellite = new THREE.Group();
  satellite.add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 2.2),
    new THREE.MeshStandardMaterial({ color: theme.dish, roughness: 0.4, metalness: 0.82 })));
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 3),
      new THREE.MeshStandardMaterial({ color: theme.zenith, roughness: 0.3, metalness: 0.6 }));
    panel.position.x = s * 6.6;
    panel.rotation.y = s * 0.2;
    satellite.add(panel);
  }
  const horn = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12),
    new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.35, metalness: 0.5 }));
  horn.position.y = -1.6;
  satellite.add(horn);
  satellite.position.copy(craftAnchor).addScaledVector(craftDir, 330);
  satellite.scale.setScalar(1.7);
  scene.add(satellite);

  beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 1, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: theme.accent, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  beam.layers.enableAll();
  scene.add(beam);

  beamGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 1, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: theme.accent, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  beamGlow.layers.enableAll();
  scene.add(beamGlow);

  await nextFrame();
  setLoad(96, 'ЗБИРАННЯ КАДРУ');

  stars = buildStars();
  scene.add(stars);

  gridHelper = new THREE.GridHelper(420, 42, theme.accent.clone(), theme.zenith.clone());
  gridHelper.position.y = 0.12;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.28;
  gridHelper.visible = false;
  scene.add(gridHelper);

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(dom.stage);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);
  bindControls();
  applyRenderSettings();
  updateCamera(0.016);
  setInterval(syncTheme, 1200);

  setLoad(100, 'ГОТОВО');
  await nextFrame();
  await nextFrame();
  dom.loader.classList.add('is-hidden');
  setTimeout(() => dom.loader.setAttribute('hidden', ''), 900);

  document.addEventListener('visibilitychange', () => { visible = !document.hidden; last = performance.now(); });
  rendererBack.setAnimationLoop(tick);

  window.__deepField = {
    state, settings, audio, camera, scene, monument, mats, satellite, beam,
    render: rendererBack.info.render,
    renderFront: rendererFront.info.render,
    pixelRatio: () => rendererBack.getPixelRatio(),
    step: (dt = 0.016) => { const was = visible; visible = true; last = performance.now() - dt * 1000; tick(performance.now()); visible = was; },
  };
}

function buildStars() {
  const count = 1200;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const y = Math.random() * 2 - 1;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    arr[i * 3] = Math.cos(a) * r * 2400;
    arr[i * 3 + 1] = y * 2400;
    arr[i * 3 + 2] = Math.sin(a) * r * 2400;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    color: theme.ink, size: 6, sizeAttenuation: true, transparent: true,
    opacity: 0.38, depthWrite: false, fog: false,
  }));
}

/* ── Керування ───────────────────────────────────────────────── */

const scrollMax = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

function bindControls() {
  dom.viewBtns.forEach((btn) => btn.addEventListener('click', () => {
    const i = Number(btn.dataset.view);
    if (state.freeLook) setFreeLook(false);
    blip(500 + i * 90, 0.14);
    window.scrollTo({ top: (i / (VIEWS.length - 1)) * scrollMax(), behavior: reducedMotion ? 'auto' : 'smooth' });
  }));

  dom.soundBtn.addEventListener('click', toggleSound);
  const wake = () => { startAudio(); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
  syncSoundButton();
  bindRail();
  syncRail();

  dom.freeBtn.addEventListener('click', () => setFreeLook(!state.freeLook));
  dom.lensBtns.forEach((btn) => btn.addEventListener('click', () => applyLens(Number(btn.dataset.lens))));
  dom.formBtns.forEach((btn) => btn.addEventListener('click', () => applyForm(btn.dataset.form)));
  dom.fatalRetry.addEventListener('click', () => window.location.reload());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.freeLook) setFreeLook(false); });

  const stage = dom.stage;
  const overPanel = (target) => target instanceof Element && !!target.closest('.rail, .hud button, .hud input');
  stage.addEventListener('pointerdown', (e) => {
    if (!state.freeLook || e.button > 0 || overPanel(e.target)) return;
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* захоплення недоступне — тягнемо без нього */ }
    state.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!state.drag || e.pointerId !== state.drag.id) return;
    const dx = e.clientX - state.drag.x, dy = e.clientY - state.drag.y;
    state.drag.x = e.clientX; state.drag.y = e.clientY;
    state.orbit.az -= dx * 0.005;
    state.orbit.pol = clamp(state.orbit.pol - dy * 0.004, 0.12, 1.92);
  });
  const endDrag = (e) => { if (state.drag && e.pointerId === state.drag.id) state.drag = null; };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', (e) => {
    if (!state.freeLook || overPanel(e.target)) return;
    e.preventDefault();
    state.orbit.dist = clamp(state.orbit.dist * Math.exp(e.deltaY * 0.0012), 14, 320);
  }, { passive: false });

  stage.addEventListener('touchmove', (e) => {
    if (!state.freeLook || e.touches.length !== 2 || overPanel(e.target)) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (state.pinch) state.orbit.dist = clamp(state.orbit.dist * (state.pinch / d), 14, 320);
    state.pinch = d;
  }, { passive: false });
  stage.addEventListener('touchend', () => { state.pinch = null; });
}

function setFreeLook(on) {
  state.freeLook = on;
  dom.stage.classList.toggle('is-free', on);
  dom.freeBtn.classList.toggle('is-on', on);
  dom.freeBtn.setAttribute('aria-pressed', String(on));
  dom.freeBtnText.textContent = on ? 'ДО МАРШРУТУ' : 'ВІЛЬНИЙ ОГЛЯД';
  dom.modeLabel.textContent = on ? 'ВІЛЬНИЙ ОГЛЯД' : 'КЕРОВАНИЙ ОГЛЯД';
  dom.hintText.textContent = on ? 'Тягніть для орбіти, колесо — масштаб' : 'Гортайте, щоб дослідити';
  dom.hintMark.textContent = on ? '✥' : '↓';
  dom.railSub.textContent = on ? 'ТЯГНІТЬ — ОРБІТА · КОЛЕСО — МАСШТАБ' : 'ЗМІНИ ЗАСТОСОВУЮТЬСЯ НАЖИВО';
  blip(on ? 660 : 440, 0.16);

  if (on) {
    const n = camera.position.clone().sub(state.orbit.target);
    state.orbit.dist = clamp(n.length(), 14, 320);
    n.normalize();
    state.orbit.pol = clamp(Math.acos(clamp(n.y, -1, 1)), 0.12, 1.92);
    state.orbit.az = Math.atan2(n.x, n.z);
    dom.rail.removeAttribute('hidden');
    syncRail();
  } else {
    dom.rail.setAttribute('hidden', '');
  }
}

function applyLens(value) {
  state.lens = value;
  dom.lensBtns.forEach((b) => {
    const active = Number(b.dataset.lens) === value;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  blip(520 + value * 120, 0.1);
}

function currentCaption() {
  const v = VIEWS[state.activeView];
  return settings.form === 'apple' ? v.captionApple : v.caption;
}

function applyForm(name, silent) {
  settings.form = name;
  monument.star.visible = name === 'star';
  monument.apple.visible = name === 'apple';
  dom.formBtns.forEach((b) => {
    const on = b.dataset.form === name;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  swapCaption(currentCaption());
  if (!silent) {
    blip(name === 'star' ? 480 : 680, 0.1);
    toast(name === 'star' ? 'ПАРЯЩА ЗІРКА' : 'ЧЕРВОНО-ЧОРНЕ ЯБЛУКО');
  }
}

/* ── Пульт: живі параметри сцени ─────────────────────────────── */

const DEG = 180 / Math.PI;

function syncRail() {
  const s = dom.sliders, v = dom.values;
  const azDeg = ((state.orbit.az * DEG) % 360 + 360) % 360;
  const polDeg = 90 - state.orbit.pol * DEG;
  s.az.value = String(Math.round(azDeg));
  s.pol.value = String(Math.round(clamp(polDeg, -20, 86)));
  s.dist.value = String(Math.round(state.orbit.dist));
  s.exp.value = String(Math.round(settings.exposure * 100));
  s.fog.value = String(Math.round(settings.fog * 100));
  s.track.value = String(Math.round(settings.trackSpeed * 100));
  s.stars.value = String(Math.round(settings.stars * 100));

  v.az.textContent = `${Math.round(azDeg)}°`;
  v.pol.textContent = `${fmt(polDeg, 0)}°`;
  v.dist.textContent = `${fmt(state.orbit.dist, 0)} м`;
  v.exp.textContent = fmt(settings.exposure, 2);
  v.fog.textContent = fmt(settings.fog, 2);
  v.track.textContent = `${fmt(settings.trackSpeed, 1)}×`;
  v.stars.textContent = fmt(settings.stars, 2);

  for (const [key, btn] of Object.entries(dom.toggles)) {
    const on = key === 'track' ? settings.tracking : key === 'beam' ? settings.beamOn : settings[key];
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  dom.qualityBtns.forEach((b) => {
    const on = Number(b.dataset.q) === settings.quality;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function applyRenderSettings() {
  rendererBack.toneMappingExposure = settings.exposure;
  rendererFront.toneMappingExposure = settings.exposure;
  scene.fog.density = 0.0016 * settings.fog;
  skyMat.uniforms.uStars.value = settings.stars;
  stars.material.opacity = 0.2 + settings.stars * 0.5;

  for (const m of [mats.edge, mats.face, mats.inlay, mats.appleFill]) m.wireframe = settings.wireframe;
  if (gridHelper) gridHelper.visible = settings.grid;

  const ratio = Math.min(window.devicePixelRatio || 1, 2) * settings.quality;
  const capped = clamp(ratio, 0.6, 2.4);
  if (rendererBack.getPixelRatio() !== capped) {
    rendererBack.setPixelRatio(capped);
    rendererFront.setPixelRatio(capped);
    resize();
  }
}

function bindRail() {
  const s = dom.sliders;
  s.az.addEventListener('input', () => { state.orbit.az = Number(s.az.value) / DEG; syncRail(); });
  s.pol.addEventListener('input', () => {
    state.orbit.pol = clamp((90 - Number(s.pol.value)) / DEG, 0.12, 1.92);
    syncRail();
  });
  s.dist.addEventListener('input', () => { state.orbit.dist = Number(s.dist.value); syncRail(); });
  s.exp.addEventListener('input', () => { settings.exposure = Number(s.exp.value) / 100; applyRenderSettings(); syncRail(); });
  s.fog.addEventListener('input', () => { settings.fog = Number(s.fog.value) / 100; applyRenderSettings(); syncRail(); });
  s.track.addEventListener('input', () => { settings.trackSpeed = Number(s.track.value) / 100; syncRail(); });
  s.stars.addEventListener('input', () => { settings.stars = Number(s.stars.value) / 100; applyRenderSettings(); syncRail(); });

  dom.toggles.track.addEventListener('click', () => { settings.tracking = !settings.tracking; blip(400, 0.09); syncRail(); });
  dom.toggles.beam.addEventListener('click', () => { settings.beamOn = !settings.beamOn; blip(700, 0.09); syncRail(); });
  dom.toggles.grid.addEventListener('click', () => { settings.grid = !settings.grid; applyRenderSettings(); blip(340, 0.09); syncRail(); });
  dom.toggles.wire.addEventListener('click', () => { settings.wireframe = !settings.wireframe; applyRenderSettings(); blip(300, 0.09); syncRail(); });

  dom.qualityBtns.forEach((b) => b.addEventListener('click', () => {
    settings.quality = Number(b.dataset.q);
    applyRenderSettings();
    syncRail();
    toast(`ЯКІСТЬ РЕНДЕРА: ${b.textContent}`);
  }));

  dom.railReset.addEventListener('click', () => {
    Object.assign(settings, DEFAULTS);
    settings.tracking = true; settings.beamOn = true; settings.grid = false; settings.wireframe = false;
    const n = VIEWS[0].pos.clone().sub(VIEWS[0].look);
    state.orbit.dist = clamp(n.length(), 14, 320);
    n.normalize();
    state.orbit.pol = clamp(Math.acos(clamp(n.y, -1, 1)), 0.12, 1.92);
    state.orbit.az = Math.atan2(n.x, n.z);
    state.orbit.target.copy(VIEWS[0].look);
    applyLens(1);
    applyForm(DEFAULTS.form, true);
    applyRenderSettings();
    syncRail();
    toast('ПУЛЬТ СКИНУТО ДО ПОЧАТКОВИХ ЗНАЧЕНЬ');
  });

  dom.railRandom.addEventListener('click', () => {
    state.orbit.az = Math.random() * Math.PI * 2;
    state.orbit.pol = 0.35 + Math.random() * 1.05;
    state.orbit.dist = 26 + Math.random() * 180;
    settings.exposure = 0.78 + Math.random() * 0.6;
    settings.fog = 0.35 + Math.random() * 1.5;
    settings.stars = Math.random();
    applyForm(Math.random() < 0.5 ? 'star' : 'apple', true);
    applyRenderSettings();
    syncRail();
    blip(880, 0.12);
    toast('НОВИЙ РАКУРС ЗГЕНЕРОВАНО');
  });

  dom.railExport.addEventListener('click', exportFrame);
}

function exportFrame() {
  const w = rendererBack.domElement.width, h = rendererBack.domElement.height;
  camera.layers.set(0);
  rendererBack.render(scene, camera);
  camera.layers.set(1);
  rendererFront.render(scene, camera);

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(rendererBack.domElement, 0, 0);
  ctx.drawImage(rendererFront.domElement, 0, 0);

  const pad = Math.round(w * 0.03);
  const line = Math.round(w * 0.02);
  ctx.fillStyle = 'rgba(245, 242, 247, 0.9)';
  ctx.font = `600 ${Math.round(w * 0.014)}px "JetBrains Mono", monospace`;
  ctx.fillText(`${document.querySelector('.brand').textContent} · ${settings.form === 'apple' ? 'ЯБЛУКО' : 'ЗІРКА'}`, pad, h - pad - line);
  ctx.font = `400 ${Math.round(w * 0.011)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = 'rgba(245, 242, 247, 0.65)';
  ctx.fillText(
    `АЗ ${dom.tAz.textContent} · КУТ ${dom.tEl.textContent} · ${dom.tFocal.textContent} · ${dom.tSignal.textContent}`,
    pad, h - pad
  );

  out.toBlob((blob) => {
    if (!blob) { toast('НЕ ВДАЛОСЯ ЗБЕРЕГТИ КАДР'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deep-field-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('КАДР ЗБЕРЕЖЕНО У PNG');
  }, 'image/png');
}

/* ── Камера ──────────────────────────────────────────────────── */

const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

function updateCamera(dt) {
  if (!state.freeLook) state.targetProgress = clamp(window.scrollY / scrollMax(), 0, 1);
  const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6);
  state.progress += (state.targetProgress - state.progress) * k;

  const seg = clamp(state.progress, 0, 1) * (VIEWS.length - 1);
  const i = Math.min(VIEWS.length - 2, Math.floor(seg));
  const t = smoothstep(0, 1, seg - i);
  const a = VIEWS[i], b = VIEWS[i + 1];
  desiredPos.copy(a.pos).lerp(b.pos, t);
  desiredLook.copy(a.look).lerp(b.look, t);
  state.baseFov = a.fov + (b.fov - a.fov) * t;

  const idle = reducedMotion ? 0 : 1;  if (state.freeLook) {
    const drift = reducedMotion ? 0 : Math.sin(clockTime * 0.1) * 0.015;
    const sp = Math.sin(state.orbit.pol);
    desiredPos.set(
      state.orbit.target.x + sp * Math.sin(state.orbit.az + drift) * state.orbit.dist,
      state.orbit.target.y + Math.cos(state.orbit.pol) * state.orbit.dist,
      state.orbit.target.z + sp * Math.cos(state.orbit.az + drift) * state.orbit.dist
    );
    camera.position.lerp(desiredPos, reducedMotion ? 1 : 1 - Math.exp(-dt * 9));
    camera.lookAt(state.orbit.target);
  } else {
    desiredPos.x += Math.sin(clockTime * 0.08) * 0.9 * idle;
    desiredPos.y += Math.cos(clockTime * 0.06) * 0.45 * idle;
    camera.position.lerp(desiredPos, reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4));
    state.orbit.target.lerp(desiredLook, reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4));
    camera.lookAt(state.orbit.target);
  }
  camera.fov = state.baseFov / state.lens;
  camera.updateProjectionMatrix();

  const nearest = Math.round(clamp(state.progress, 0, 1) * (VIEWS.length - 1));
  if (nearest !== state.activeView) {
    state.activeView = nearest;
    dom.viewBtns.forEach((btn, bi) => btn.classList.toggle('is-active', bi === nearest));
    swapCaption(currentCaption());
  }

  const titleOpacity = clamp(1 - state.progress * 2.6, 0, 1) * (state.freeLook ? 0.1 : 1);
  if (Math.abs(titleOpacity - state.titleOpacity) > 0.004) {
    state.titleOpacity = titleOpacity;
    dom.giant.style.setProperty('--title-opacity', titleOpacity.toFixed(3));
  }
}

let captionTimer = null;
function swapCaption(text) {
  if (dom.caption.textContent === text) return;
  dom.caption.classList.add('is-swapping');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => {
    dom.caption.textContent = text;
    dom.caption.classList.remove('is-swapping');
  }, reducedMotion ? 0 : 220);
}

/* ── Супровід та телеметрія ──────────────────────────────────── */

const fmt = (v, digits) => v.toFixed(digits).replace('.', ',');
const tmpVec = new THREE.Vector3();
let teleAcc = 0;

function updateTracking(dt) {
  if (!reducedMotion) {
    const t = clockTime * 0.05 * settings.trackSpeed;
    satellite.position.copy(craftAnchor).addScaledVector(craftDir, 330);
    satellite.position.x += Math.sin(t) * 22;
    satellite.position.y += Math.cos(t * 0.8) * 12;
    satellite.rotation.y += dt * 0.3 * settings.trackSpeed;
  }

  monument.emitter.getWorldPosition(tmpVec);
  const toCraft = satellite.position.clone().sub(tmpVec).normalize();
  const wantAz = Math.atan2(toCraft.x, toCraft.z);
  let moved = 0;
  if (settings.tracking) {
    const track = reducedMotion ? 1 : 1 - Math.exp(-dt * 0.5 * Math.max(settings.trackSpeed, 0.05));
    const dAz = wrapPi(wantAz - monument.yaw.rotation.y) * track;
    monument.yaw.rotation.y += dAz;
    moved = Math.abs(dAz);
  }

  const ph = reducedMotion ? 0 : Math.cos((clockTime % 9) * (TAU / 9));
  monument.head.position.y = monument.headY + 0.075 - 0.425 * ph;
  monument.head.rotation.z = (-0.5 - 1.5 * ph) / DEG;
  monument.head.rotation.x = reducedMotion ? 0 : Math.sin(clockTime * 0.23) * 0.03;
  if (settings.form === 'apple' && !reducedMotion) monument.apple.rotation.y += dt * 0.25 * settings.trackSpeed;

  if (audio.ready && audio.servo) {
    const target = audio.enabled ? clamp(moved * 260, 0, 0.5) : 0;
    audio.servo.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.25);
  }

  const sepDeg = Math.abs(wrapPi(wantAz - monument.yaw.rotation.y)) * DEG;

  monument.emitter.getWorldPosition(tmpVec);
  alignSegment(beam, tmpVec, satellite.position);
  beam.visible = settings.beamOn;
  beam.material.opacity = (0.08 + smoothstep(0.4, 1, state.progress) * 0.5) * clamp(1 - sepDeg / 5, 0.2, 1);
  alignSegment(beamGlow, tmpVec, satellite.position);
  beamGlow.visible = settings.beamOn;
  beamGlow.material.opacity = beam.material.opacity * 0.22;

  teleAcc += dt;
  if (teleAcc < 0.14) return;
  teleAcc = 0;

  const offset = camera.position.clone().sub(state.orbit.target);
  const dist = offset.length();
  const az = ((Math.atan2(offset.x, -offset.z) * 180) / Math.PI + 360) % 360;
  const el = (Math.asin(clamp(offset.y / Math.max(dist, 0.001), -1, 1)) * 180) / Math.PI;

  dom.tAz.textContent = `${fmt(az, 1)}°`;
  dom.tEl.textContent = `${fmt(el, 1)}°`;
  dom.tDist.textContent = dist > 200 ? `${fmt(dist / 1000, 2)} км` : `${fmt(dist, 0)} м`;
  dom.tFocal.textContent = `${fmt(12 / Math.tan((camera.fov * Math.PI) / 360), 0)} мм`;
  dom.tSignal.textContent = `${fmt(-62 - Math.pow(sepDeg, 1.4) * 0.9, 1)} дБ`;
  dom.tCraft.textContent = sepDeg < 0.35 ? 'СУПРОВОД' : sepDeg < 3 ? 'УТРИМАННЯ' : 'ПОШУК';

  if (state.freeLook) syncOrbitSliders();
}

function syncOrbitSliders() {
  const s = dom.sliders, v = dom.values;
  const azDeg = ((state.orbit.az * DEG) % 360 + 360) % 360;
  const polDeg = 90 - state.orbit.pol * DEG;
  if (document.activeElement !== s.az) { s.az.value = String(Math.round(azDeg)); v.az.textContent = `${Math.round(azDeg)}°`; }
  if (document.activeElement !== s.pol) { s.pol.value = String(Math.round(clamp(polDeg, -20, 86))); v.pol.textContent = `${fmt(polDeg, 0)}°`; }
  if (document.activeElement !== s.dist) { s.dist.value = String(Math.round(state.orbit.dist)); v.dist.textContent = `${fmt(state.orbit.dist, 0)} м`; }
}

/* ── Тема, розмір, цикл ──────────────────────────────────────── */

function syncTheme() {
  fitTitle();
  const next = readTheme();
  if (next.horizon.getHex() === theme.horizon.getHex()
    && next.crust.getHex() === theme.crust.getHex()
    && next.accent.getHex() === theme.accent.getHex()
    && next.dish.getHex() === theme.dish.getHex()) return;
  theme = next;
  const u = skyMat.uniforms;
  u.uZenith.value.copy(theme.zenith);
  u.uMid.value.copy(theme.mid);
  u.uHorizon.value.copy(theme.horizon);
  u.uSun.value.copy(theme.sun);
  u.uCloud.value.copy(theme.cloud);
  scene.fog.color.copy(theme.fog);
  mats.edge.color.copy(theme.metal);
  mats.face.color.copy(theme.dish);
  mats.inlay.color.copy(theme.accent);
  mats.inlay.emissive.copy(theme.accent).multiplyScalar(0.4);
  mats.wire.color.copy(theme.accent);
  mats.appleFill.color.copy(theme.apple);
  stars.material.color.copy(theme.ink);
  beam.material.color.copy(theme.accent);
  beamGlow.material.color.copy(theme.accent);
}

function fitTitle() {
  const natural = dom.giant.scrollWidth;
  if (!natural) return;
  const w = window.innerWidth;
  const fit = Math.min(1, (w * (w <= 900 ? 0.92 : 0.94)) / natural);
  dom.giant.style.setProperty('--title-fit', fit.toFixed(4));
}

let sizedW = 0, sizedH = 0, sizedRatio = 0;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  fitTitle();
  const ratio = rendererBack.getPixelRatio();
  if (w === sizedW && h === sizedH && ratio === sizedRatio) return;
  sizedW = w; sizedH = h; sizedRatio = ratio;
  rendererBack.setSize(w, h, false);
  rendererFront.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (!visible) return;

  clockTime += reducedMotion ? 0 : dt;
  skyMat.uniforms.uTime.value = clockTime;
  updateCamera(dt);
  updateTracking(dt);

  camera.layers.set(0);
  rendererBack.render(scene, camera);
  camera.layers.set(1);
  rendererFront.render(scene, camera);
}

init().catch((err) => {
  console.error(err);
  fatal(`Не вдалося зібрати сцену: ${err && err.message ? err.message : 'помилка ініціалізації'}.`);
});