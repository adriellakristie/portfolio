/*
 * room.js — the immersive landing room: loads the model, places the camera,
 * drives the TV, the interactive objects and the look-around. The model's
 * geometry is used as exported; objects only move as whole pieces.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyMaterials, applyOverrides, loadLights, FilmShader } from './look.js?v=19';
import { createWorkTV } from './work.js?v=32';
import { createReachIcons } from './reach-icons.js?v=2';

// ─────────────────────────────────────────
// Featured — the spotlight slideshow on the TV in the room. Tapping the TV
// opens whichever project is on screen.
// ─────────────────────────────────────────
const FEATURED = [
  // Add titled: true for a picture that already has the name and description
  // on it: the TV then fits it whole and doesn't add its own.
  { name: 'OnTheWay',  line: 'Proximity doesn’t necessarily mean convenience.', img: 'images/otw-tv-cover.jpg',      href: 'projects/ontheway.html' },
  { name: 'EcoBite',   line: 'Sustainability shouldn’t be a research project.',  img: 'media/ecobite-img1.png',   href: 'projects/ecobite.html' },
  { name: 'Merangkai', line: 'Heritage you can explore, not just read about.',   img: 'media/merangkai-hero.png', href: 'projects/merangkai.html' },
];

const MODEL_URL = 'models/room.glb';
const MATERIALS_URL = 'models/materials.json';
const CAMERA_NAME = 'defaultpov';   // the render camera, exported in room.glb
const LIGHTS_URL = 'models/lights.json';
const ROOM_HEIGHT = 2.7;   // floor to ceiling, in scene units (metres)
// How far the view can be moved from the default perspective.
const ORBIT_AZIMUTH = THREE.MathUtils.degToRad(28);   // left / right around the room
const ORBIT_UP = THREE.MathUtils.degToRad(12);        // looking down from higher up
const ORBIT_DOWN = THREE.MathUtils.degToRad(8);       // dropping lower
const ORBIT_ZOOM_IN = 0.35;                           // closest, as a share of the default distance
const LEAN_MAX = THREE.MathUtils.degToRad(2.5);   // hover lean toward an object
const SWAY_PERIOD = 8;                             // seconds

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
// index.html#work opens straight onto the Work screen in the TV (used by the case study
// pages); index.html#playground opens it on the Playground tab.
const openWorkHash = () => location.hash === '#work' || location.hash === '#playground';
const openWorkOnLoad = openWorkHash();
// Seen the loading screen already this session (set in index.html's <head>).
const returning = document.documentElement.classList.contains('returning');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

// ── Renderer / scene ──
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });   // (phones: the post-processing passes below skip antialiasing anyway)   // see-through: the page's white shows behind the room
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1 : 1.25));   // phones draw fewer pixels: far smoother
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;   // keeps the orange sofa saturated (ACES greys it)
renderer.toneMappingExposure = 0.44;   // low, so the warm Maya lights carry the room over the reflections
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // the room is still; shadows are redrawn on demand

const scene = new THREE.Scene();
// No background: it's left see-through so the page's white shows. The old dark
// backdrop is still used when the room captures its own reflections.
const ROOM_DARK = new THREE.Color('#1a0a06');
scene.background = null;
renderer.setClearColor(0x000000, 0);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.001, 50);

// Studio reflections for the glossy materials.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

// The picture is drawn into an off-screen target (for the passes below), so the canvas's own
// antialiasing never applies; give that target multisampling instead to smooth the edges.
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
const renderPass = new RenderPass(scene, camera);
// Clear see-through on every frame: building reflections (PMREM) resets the
// renderer's clear colour to opaque, which would put black behind the room.
renderPass.clearColor = new THREE.Color(0x000000);
renderPass.clearAlpha = 0;
composer.addPass(renderPass);
// Contact shadows where objects meet.
let ao = null;
if (!lowPower) {
  ao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  composer.addPass(ao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.5, 0.95);
// Bloom adds its glow with additive blending, which would also add to the
// alpha and turn the see-through background solid black: add light only.
Object.assign(bloom.blendMaterial, {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
});
bloom.blendMaterial.needsUpdate = true;
if (!lowPower) composer.addPass(bloom);   // no glow or film grain on phones: two full-screen passes saved
composer.addPass(new OutputPass());
const film = new ShaderPass(FilmShader);
if (!lowPower) composer.addPass(film);

let stats = null;
const debugUI = debug && !params.has('clean');   // ?debug&clean: debug camera, no overlays
if (debugUI) {
  import('three/addons/libs/stats.module.js').then(({ default: Stats }) => {
    stats = new Stats();
    stats.dom.style.cssText = 'position:fixed;top:72px;left:16px;z-index:70;';
    document.body.appendChild(stats.dom);
  });
}

// ── Loader UI ──
const loaderEl = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
// The bar fills steadily over the first 4 seconds (CSS), whatever the download does.
function setProgress() {}

// The room downloads straight away, but on a first visit it's only unpacked
// and set up (heavy work on this thread) once the loading-screen logo has
// landed: the logo's frames reach the screen through this thread, so doing it
// earlier would make the jump stutter.
const WAIT_FOR_LOGO_MAX = 4200;   // ms from page load, at the most
function logoLanded() {
  if (document.documentElement.classList.contains('returning') || openWorkOnLoad || params.has('debug')) return Promise.resolve();
  return Promise.race([
    new Promise((r) => { if (window.__logoLanded) r(); else window.addEventListener('logo:landed', r, { once: true }); }),
    new Promise((r) => setTimeout(r, Math.max(0, WAIT_FOR_LOGO_MAX - performance.now()))),
  ]);
}
const modelFile = new THREE.FileLoader().setResponseType('arraybuffer');
modelFile.load(
  MODEL_URL,
  (buffer) => logoLanded().then(() => new GLTFLoader().parse(buffer, MODEL_URL.replace(/[^/]*$/, ''), (gltf) => setup(gltf).catch(showError), showError)),
  (e) => { if (e.total) setProgress(e.loaded / e.total * 0.9); },
  (err) => showError(err)
);

function showError(err) {
  console.error(err);
  const el = document.getElementById('error');
  if (typeof err === 'string') { el.textContent = err; el.classList.add('show'); hideIntro(); return; }
  el.innerHTML = location.protocol === 'file:'
    ? 'The 3D room needs a local server to load.<br>Run <code>python3 -m http.server</code> in the site folder and open<br><code>http://localhost:8000/new-portfolio/</code>'
    : 'The 3D room could not load. Try refreshing the page.';
  el.classList.add('show');
  hideIntro();
}

// ─────────────────────────────────────────
// Scene setup
// ─────────────────────────────────────────
let start = null;          // { position, quaternion, fov }
let tvView = null;         // straight-on view of the screen
let nameBox = null;        // the "ADRIELLA KRISTIE" letters, in world space
let phoneBox = null;       // the red phone (opens "Reach me")
let reaching = false;      // the "Reach me" view is open
let leaving = false;       // on the way out to About Me
let screenInfo = null;     // screen center, normal and size in world space
let screen = null;         // TV screen canvas painter
let lights = null;
let record = null;
let curtains = null;
let span = 1;
let entered = false;
const interactive = [];    // { kind, meshes, center }
const pickMeshes = [];

async function setup(gltf) {
  const model = gltf.scene;
  scene.add(model);
  model.updateMatrixWorld(true);

  // The model is tiny (ceiling at ~0.126). Scale it so floor to ceiling is
  // 2.7 units, so lights, shadows and the camera behave at real-world scale.
  // Everything below is measured after this.
  scaleToRoomHeight(model);

  // The room's extent comes from its floor and walls, wherever they sit in
  // the hierarchy and however Maya prefixed them (e.g. "pasted__floor").
  // Walls exported at the wrong scale are left out of the measurement.
  const baseName = (o) => (o.userData.name ?? o.name).replace(/^(pasted__)+/, '').replace(/\.\d+$/, '');
  const floorBox = new THREE.Box3();
  const wallBoxes = [];
  model.traverse((o) => {
    if (baseName(o) === 'floor') floorBox.expandByObject(o);
    else if (/^wall\d+$/.test(baseName(o))) wallBoxes.push([baseName(o), new THREE.Box3().setFromObject(o)]);
  });
  const roomBox = floorBox.clone();
  if (!floorBox.isEmpty()) {
    const limit = floorBox.getSize(new THREE.Vector3()).length() * 1.5;
    for (const [name, box] of wallBoxes) {
      if (box.getSize(new THREE.Vector3()).length() > limit) console.warn(`[room] "${name}" is far larger than the floor (wrong scale in the export); ignored when framing the room.`);
      else roomBox.union(box);
    }
  } else {
    wallBoxes.forEach(([, box]) => roomBox.union(box));
  }
  if (roomBox.isEmpty()) {
    console.warn('[room] No "floor" or "wallN" objects found; framing the whole model instead.');
    roomBox.setFromObject(model);
  }
  span = Math.max(roomBox.max.x - roomBox.min.x, roomBox.max.z - roomBox.min.z) || 1;
  roomExtent = { box: roomBox.clone(), floorY: floorBox.isEmpty() ? roomBox.min.y : floorBox.max.y };   // for framing tall screens

  // A few pieces came out of the export at the wrong scale and enclose the
  // whole room, so the camera would only see their inside. They are hidden
  // (not changed) until the export is fixed.
  const bounds = roomBox.clone().expandByScalar(span * 0.15);
  const oversized = [];
  model.traverse((o) => {
    if (o.isMesh && !bounds.containsBox(new THREE.Box3().setFromObject(o))) {
      o.visible = false;
      oversized.push(o.parent && o.parent !== model ? `${o.parent.name}/${o.name}` : o.name);
    }
  });
  if (oversized.length) console.warn('[room] Hidden because they are far larger than the room: ' + oversized.join(', '));

  await applyMaterials(model, MATERIALS_URL, renderer);
  applyOverrides(model);
  brightenMetals(model);

  // ── TV screen ──
  const screenMesh = model.getObjectByName('tv_screen');
  if (screenMesh && screenMesh.isMesh) {
    screenInfo = mapScreen(screenMesh);
    screen = createScreen(screenInfo.aspect);
    screenMesh.material = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false });
    tvView = screenView(screenInfo);
  } else {
    console.warn('[room] No mesh named "tv_screen" in ' + MODEL_URL + '; the TV will not show anything.');
  }

  // ── Lights at the original Maya light positions ──
  lights = await loadLights(scene, model, LIGHTS_URL);
  if (debug && lights) {
    if (params.get('factor')) lights.setFactor(Number(params.get('factor')));
    if (params.get('exposure')) renderer.toneMappingExposure = Number(params.get('exposure'));
    // ?off=name1,name2 switches lights off by name, to find hotspots.
    const off = (params.get('off') || '').split(',').filter(Boolean);
    lights.list.forEach(({ light }) => { if (off.some((n) => light.name.split(' + ').includes(n))) light.visible = false; });
    if (debugUI) buildLightPanel(lights);
  }
  if (ao) ao.updateGtaoMaterial({ radius: span * 0.03, distanceExponent: 1.5, thickness: span * 0.01, scale: 1.2, samples: 8 });

  // ── Reflections of the room itself, so chrome and lacquer mirror the
  // orange sofa and warm walls (like the render) instead of a white studio.
  const roomCentre = roomBox.getCenter(new THREE.Vector3());
  roomCentre.y = (floorBox.isEmpty() ? roomBox.min.y : floorBox.max.y) + 1.0;
  reflectRoom(model, roomCentre);

  // ── Interactive objects ──
  register('tv', model.getObjectByName('tv') || screenMesh);
  register('lamp', model.getObjectByName('lamp'));
  const recordRoot = findShown(model, 'record_player');
  register('record', recordRoot);
  register('curtains', model.getObjectByName('pillars'));
  const nameMesh = model.getObjectByName('typeMesh1');
  register('name', nameMesh);   // "ADRIELLA KRISTIE" → About Me
  if (nameMesh) nameBox = new THREE.Box3().setFromObject(nameMesh);
  const phoneRoot = model.getObjectByName('group14');   // the red rotary phone (unnamed in Maya)
  register('phone', phoneRoot);
  if (phoneRoot) phoneBox = new THREE.Box3().setFromObject(phoneRoot);
  record = recordRoot ? setupRecordPlayer(recordRoot) : null;
  curtains = setupCurtains(model.getObjectByName('pillars'));

  // ── Starting camera: the render camera from the GLB, nothing else ──
  const povCam = findCamera(gltf, [CAMERA_NAME]);
  if (povCam) {
    povCam.updateMatrixWorld(true);
    start = {
      position: povCam.getWorldPosition(new THREE.Vector3()),
      quaternion: povCam.getWorldQuaternion(new THREE.Quaternion()),
      fov: povCam.isPerspectiveCamera ? povCam.fov : 42,
    };
  }
  if (debug && params.get('cam')) {
    // Testing only: an explicit camera from the URL.
    const [x, y, z, fov] = params.get('cam').split(',').map(Number);
    const aim = params.get('target');
    const look = aim ? new THREE.Vector3(...aim.split(',').map(Number))
      : screenInfo ? screenInfo.center : roomBox.getCenter(new THREE.Vector3());
    start = viewFrom(new THREE.Vector3(x, y, z), look, fov || 42);
    console.info('[room] Camera: ?cam override (debug).');
  }
  if (start) { start.baseFov = start.fov; start.baseQuat = start.quaternion.clone(); fitStartToScreen(); makeHome(); mirrorName(model, start.position); }
  if (!start) {
    const msg = `Camera "${CAMERA_NAME}" is not in ${MODEL_URL}. Export it from Maya/Blender with cameras included (glTF export → Include → Cameras).`;
    console.error('[room] ' + msg);
    showError(msg);
    return;
  }
  const p = start.position;
  console.info(`[room] Camera: ${povCam && !(debug && params.get('cam')) ? `"${CAMERA_NAME}"` : 'debug override'} at (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}), fov ${start.fov.toFixed(1)}°`);

  if (debug) {
    const pre = document.createElement('pre');
    pre.id = 'debugInfo';
    pre.hidden = true;
    pre.textContent = JSON.stringify({ scale: model.scale.x, roomBox, span, screenInfo, start }, (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v));
    document.body.appendChild(pre);
  }

  camera.near = span * 0.002;
  camera.far = span * 20;
  renderer.shadowMap.needsUpdate = true;

  // Compile every shader and draw the landing view once behind the intro, so
  // nothing has to be compiled mid-flight (which shows as a stutter).
  applyView(home);
  // Capped at 2 s: some browsers never report parallel compiles as finished.
  await Promise.race([
    renderer.compileAsync(scene, camera).catch(() => renderer.compile(scene, camera)),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
  composer.render();
  applyView(outsideView(start));
  composer.render();

  // Warm up the GPU behind the intro; go in once the intro text has been up
  // for at least INTRO_MIN ms, so it can be read.
  renderer.setAnimationLoop(tick);
  setProgress(1);
  loaderEl.classList.add('ready');
  if (debug || openWorkOnLoad) { enter(true); if (openWorkOnLoad && workTV.isOpen) tuneIn(true); return; }
  if (returning) { enter(true); return; }   // no loading screen or fly-in this time: the room just fades in
  await new Promise((r) => setTimeout(r, Math.max(0, INTRO_MIN - performance.now())));
  // ...and until the logo's "AK" has landed in the couch (but no later than INTRO_MAX).
  await Promise.race([
    new Promise((r) => { if (window.__logoLanded) r(); else window.addEventListener('logo:landed', r, { once: true }); })
      .then(() => new Promise((r) => setTimeout(r, LOGO_HOLD))),
    new Promise((r) => setTimeout(r, Math.max(0, INTRO_MAX - performance.now()))),
  ]);
  enter(false);
}

const INTRO_MIN = 5000;   // ms from page load the intro stays up, at the least
const INTRO_MAX = 8000;   // ...and at the most, waiting for the logo
const LOGO_HOLD = 500;    // ms the logo rests after landing before the room comes in

function hideIntro() {
  loaderEl.classList.add('done');
}

// scene.environmentIntensity (kept low so the room stays moody) also caps
// what metals reflect, which leaves them near black. Giving metals the same
// environment as their own envMap lets them reflect it at full strength,
// like the bright chrome and silver in the render.
const METAL_REFLECTION = 1.0;
function brightenMetals(model) {
  const done = new Set();
  model.traverse((o) => {
    if (!o.isMesh || !o.material || done.has(o.material)) return;
    const m = o.material;
    done.add(m);
    if (m.isMeshStandardMaterial && m.metalness >= 0.5 && !m.envMap) {
      m.envMap = scene.environment;
      m.envMapIntensity = Math.max(m.envMapIntensity, METAL_REFLECTION);
      m.needsUpdate = true;
    }
  });
}

// Renders the lit room once into a cube map from `centre` and gives it to
// every metal (and every clearcoated surface) as its reflection. The room is
// still, so this is done once at load.
const ROOM_REFLECTION = 1.4;
function captureEnv(centre, hide = null, size = 256, backdrop = null) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(span * 0.005, span * 4, rt);
  cube.position.copy(centre);
  scene.add(cube);
  if (hide) hide.visible = false;   // an object must not reflect its own inside
  const bg = scene.background, bgI = scene.backgroundIntensity;
  if (backdrop) { scene.background = backdrop.texture; scene.backgroundIntensity = backdrop.intensity; }
  else scene.background = ROOM_DARK;
  renderer.shadowMap.needsUpdate = true;
  cube.update(renderer, scene);
  scene.background = bg; scene.backgroundIntensity = bgI;
  if (hide) hide.visible = true;
  scene.remove(cube);
  const env = pmrem.fromCubemap(rt.texture).texture;
  rt.dispose();
  return env;
}

// The name is a full chrome mirror with its own reflection, captured from
// just above where it stands. The walls, curtains, ceiling and anything on
// the viewer's side are left out of that capture and soft studio light fills
// the gap, so the letters show a chrome "horizon" (floor below, light above)
// while their sides mirror the sofa, lamp and spheres behind them.
function mirrorName(model, viewer) {
  const name = model.getObjectByName('typeMesh1');
  if (!name || !name.isMesh) return;
  const at = new THREE.Box3().setFromObject(name).getCenter(new THREE.Vector3());
  const toViewer = viewer.clone().sub(at).setY(0).normalize();
  const hidden = [];
  model.traverse((o) => {
    if (!o.isMesh || !o.visible || o === name || /floor/.test(o.userData.name ?? o.name)) return;
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3()).sub(at);
    // Keep the floor and what stands behind the letters; drop the walls,
    // curtains and ceiling, whose dark faces would turn the letters black.
    const big = box.getSize(new THREE.Vector3()).length() > span * 0.5;
    if (big || c.dot(toViewer) > -span * 0.02) { o.visible = false; hidden.push(o); }
  });
  name.material.envMap = captureEnv(at.clone().add(new THREE.Vector3(0, span * 0.06, 0)), name, 512, { texture: scene.environment, intensity: 1.0 });
  name.material.needsUpdate = true;
  hidden.forEach((o) => { o.visible = true; });
}

function reflectRoom(model, centre) {
  const env = captureEnv(centre);

  const name = model.getObjectByName('typeMesh1');
  const done = new Set(name ? [name.material] : []);
  model.traverse((o) => {
    if (!o.isMesh || !o.material || done.has(o.material)) return;
    const m = o.material;
    done.add(m);
    if (!m.isMeshStandardMaterial) return;
    if (m.metalness >= 0.5) {
      m.envMap = env;
      m.envMapIntensity = Math.max(m.envMapIntensity, ROOM_REFLECTION);
      m.needsUpdate = true;
    } else if (m.clearcoat > 0) {
      m.envMap = env;
      m.envMapIntensity = 0.9;
      m.needsUpdate = true;
    }
  });
}

function scaleToRoomHeight(model) {
  const base = (o) => (o.userData.name ?? o.name).replace(/^(pasted__)+/, '').replace(/\.\d+$/, '');
  let floor = null, ceiling = null;
  model.traverse((o) => {
    if (!floor && base(o) === 'floor') floor = o;
    if (!ceiling && base(o) === 'ceiling') ceiling = o;
  });
  if (!floor || !ceiling) { console.warn('[room] Need "floor" and "ceiling" objects to scale the room; leaving it as exported.'); return; }
  const height = new THREE.Box3().setFromObject(ceiling).min.y - new THREE.Box3().setFromObject(floor).max.y;
  if (!(height > 0)) return;
  model.scale.multiplyScalar(ROOM_HEIGHT / height);
  model.updateMatrixWorld(true);
}

// ?debug: every light's colour and intensity, and the one global factor.
function buildLightPanel(lights) {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:70;max-height:60vh;overflow:auto;'
    + 'background:rgba(10,6,4,0.85);color:#f3efe4;font:11px/1.5 "IBM Plex Mono",monospace;padding:10px 12px;border-radius:8px;width:340px;';
  const rows = lights.list.map(({ light, def }) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';
    const sw = document.createElement('span');
    sw.style.cssText = `flex:none;width:10px;height:10px;border-radius:2px;background:#${light.color.getHexString()};`;
    const label = document.createElement('span');
    label.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    label.textContent = `${def.type} · ${light.name}${light.name === lights.lampName ? ' (lamp)' : ''}`;
    label.title = light.name;
    const val = document.createElement('span');
    row.append(sw, label, val);
    panel.appendChild(row);
    return () => { val.textContent = light.intensity.toFixed(3); };
  });
  const ctl = document.createElement('label');
  ctl.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
  const range = document.createElement('input');
  range.type = 'range'; range.min = '-4'; range.max = '0'; range.step = '0.01';
  range.value = String(Math.log10(lights.factor));
  const num = document.createElement('span');
  ctl.append('global ×', range, num);
  panel.prepend(ctl);
  const refresh = () => { num.textContent = lights.factor.toPrecision(3); rows.forEach((r) => r()); };
  range.addEventListener('input', () => { lights.setFactor(10 ** Number(range.value)); refresh(); });
  setInterval(refresh, 250);   // also follows the lamp fade
  refresh();
  document.body.appendChild(panel);

  // A small sphere and a name tag at every light, to spot misplaced ones.
  const geo = new THREE.SphereGeometry(0.04, 12, 8);
  for (const { light } of lights.list) {
    if (light.isDirectionalLight) continue;
    const dot = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: light.color, depthTest: false, toneMapped: false }));
    dot.renderOrder = 999;
    dot.position.copy(light.position);
    scene.add(dot);
    const tag = document.createElement('div');
    tag.textContent = light.name;
    tag.style.cssText = 'position:fixed;z-index:65;pointer-events:none;font:10px "IBM Plex Mono",monospace;color:#fff;'
      + 'background:rgba(0,0,0,0.6);padding:1px 4px;border-radius:3px;white-space:nowrap;transform:translate(8px,-50%);';
    document.body.appendChild(tag);
    lightTags.push({ tag, at: light.position });
  }
}

const lightTags = [];
const tagPos = new THREE.Vector3();
function placeLightTags() {
  for (const { tag, at } of lightTags) {
    tagPos.copy(at).project(camera);
    const visible = tagPos.z < 1 && Math.abs(tagPos.x) < 1.1 && Math.abs(tagPos.y) < 1.1;
    tag.style.display = visible ? '' : 'none';
    if (visible) {
      tag.style.left = ((tagPos.x + 1) / 2) * window.innerWidth + 'px';
      tag.style.top = ((1 - tagPos.y) / 2) * window.innerHeight + 'px';
    }
  }
}

function register(kind, root) {
  if (!root) return;
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
  const center = new THREE.Box3();
  meshes.forEach((m) => center.union(new THREE.Box3().setFromObject(m)));
  const entry = { kind, meshes, center: center.getCenter(new THREE.Vector3()) };
  meshes.forEach((m) => { m.userData.interactive = entry; pickMeshes.push(m); });
  interactive.push(entry);
}

function findCamera(gltf, names) {
  for (const name of names) {
    const node = gltf.scene.getObjectByName(name);
    if (!node) continue;
    if (node.isCamera) return node;
    let cam = null;
    node.traverse((o) => { if (!cam && o.isCamera) cam = o; });
    if (cam) return cam;
  }
  return gltf.cameras.find((cam) => names.includes(cam.name)) || null;
}

// ─────────────────────────────────────────
// Entering: the camera glides in from just outside the open front.
// ─────────────────────────────────────────
function outsideView(v) {
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(v.quaternion).setY(0).normalize();
  return {
    position: v.position.clone().addScaledVector(back, span * 0.45).add(new THREE.Vector3(0, span * 0.04, 0)),
    quaternion: v.quaternion.clone(),
    fov: v.fov,
  };
}

function enter(instant) {
  if (entered || !start) return;
  entered = true;
  try { sessionStorage.setItem('ak-room-entered', '1'); } catch (e) {}
  hideIntro();
  document.body.classList.add('entered');
  if (instant || reduceMotion) { applyView(home); seat(); }
  else flyTo(home, 3000, seat);
  if (screen) screen.boot();
  resumeMusic();
  if (debug && params.get('orbit')) {
    const [az, polar, dist] = params.get('orbit').split(',').map(Number);
    setOrbit(THREE.MathUtils.degToRad(az || 0), THREE.MathUtils.degToRad(polar || 0), dist || 1);
  }
  if (debug && params.has('tune')) tuneIn(true);
  if (debug && params.has('record')) toggleRecord();
}

// ─────────────────────────────────────────
// Screen geometry: the exported UVs point at a small corner of a texture
// atlas, so the front of the glass is re-mapped to cover the whole canvas.
// ─────────────────────────────────────────
function mapScreen(mesh) {
  mesh.geometry = mesh.geometry.clone();
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  mesh.updateMatrixWorld(true);
  const m = mesh.matrixWorld;
  const nm = new THREE.Matrix3().getNormalMatrix(m);

  // Facing direction = the strongest averaged normal, in world space.
  const avg = new THREE.Vector3();
  for (let i = 0; i < nrm.count; i++) avg.add(new THREE.Vector3().fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize());
  const axis = ['x', 'y', 'z'].reduce((a, b) => (Math.abs(avg[b]) > Math.abs(avg[a]) ? b : a));
  const normal = new THREE.Vector3(); normal[axis] = Math.sign(avg[axis]) || 1;

  const world = [];
  for (let i = 0; i < pos.count; i++) world.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m));
  const front = Math.max(...world.map((p) => p.dot(normal)));
  // The glass may be curved, so the front is every vertex that faces the viewer.
  const onFront = world.map((_, i) => new THREE.Vector3().fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize().dot(normal) > 0.5);

  // Viewer's right / up when looking at the screen.
  const up = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  up.crossVectors(normal, right).normalize();

  let minR = Infinity, maxR = -Infinity, minU = Infinity, maxU = -Infinity;
  world.forEach((p, i) => {
    if (!onFront[i]) return;
    const r = p.dot(right), u = p.dot(up);
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
  });
  // Project every vertex onto the front; the bezel sides clamp to the edge pixels.
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const uv = new Float32Array(pos.count * 2);
  world.forEach((p, i) => {
    uv[i * 2] = clamp01((p.dot(right) - minR) / (maxR - minR));
    uv[i * 2 + 1] = clamp01((maxU - p.dot(up)) / (maxU - minU));   // flipY is off, so v = 0 is the top row
  });
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  const width = maxR - minR, height = maxU - minU;
  const center = right.clone().multiplyScalar((minR + maxR) / 2)
    .add(up.clone().multiplyScalar((minU + maxU) / 2))
    .add(normal.clone().multiplyScalar(front));
  return { center, normal, width, height, aspect: width / height };
}

function viewFrom(position, target, fov) {
  const o = new THREE.PerspectiveCamera();   // cameras look down -Z, unlike Object3D
  o.position.copy(position);
  o.lookAt(target);
  return { position: position.clone(), quaternion: o.quaternion.clone(), fov };
}

function screenView(info) {
  const fov = 30;
  const vh = 2 * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const fit = 0.8;   // the screen fills about 80% of the frame
  const d = Math.max(info.height / (vh * fit), info.width / (vh * camera.aspect * fit));
  return viewFrom(info.center.clone().addScaledVector(info.normal, d), info.center, fov);
}

// ─────────────────────────────────────────
// Record player: the lid swings on its hinge, the vinyl spins.
// ─────────────────────────────────────────
// Returns an object whose rotation.y turns `children` about the axis through
// `point` along `orientation`'s Y. The frame sits in an outer holder so that
// rotation.y is a pure turn about that axis.
function pivotAt(point, orientation, children) {
  const frame = new THREE.Object3D();
  frame.position.copy(point);
  frame.quaternion.copy(orientation);
  const pivot = new THREE.Object3D();
  frame.add(pivot);
  scene.add(frame);
  frame.updateMatrixWorld(true);
  children.forEach((c) => pivot.attach(c));   // keeps each piece exactly where it is
  return pivot;
}

// First visible object whose Maya name is `base` or a numbered copy of it
// (base.001, …), searched under `root`.
function findShown(root, base) {
  let found = null;
  root.traverse((o) => {
    if (found || !isShown(o)) return;
    if ((o.userData.name ?? o.name).replace(/\.\d+$/, '') === base) found = o;
  });
  return found;
}

function setupRecordPlayer(root) {
  // The lid stays as modelled (open, like the render); clicking plays or
  // stops the record.
  const vinyl = findShown(root, 'polySurface8');
  if (!vinyl) { console.warn('[room] Record player vinyl (polySurface8) not found.'); return null; }

  // The vinyl, its label and spindle turn together about the record's centre.
  const discs = ['polySurface8', 'pCylinder26', 'pCylinder27'].map((n) => findShown(root, n)).filter(Boolean);
  const centre = new THREE.Box3().setFromObject(vinyl).getCenter(new THREE.Vector3());
  const spinPivot = pivotAt(centre, new THREE.Quaternion(), discs);

  const state = { playing: false, spin: 0 };
  return {
    get playing() { return state.playing; },
    toggle() { state.playing = !state.playing; },
    update(dt) {
      // 33⅓ rpm, spun up and down gently. A spinning disc's shadow does not
      // change, so shadows are never redrawn for it.
      const target = state.playing ? (33.3 / 60) * Math.PI * 2 : 0;
      state.spin += (target - state.spin) * Math.min(1, dt * 2.5);
      if (state.spin > 1e-3) spinPivot.rotation.y -= state.spin * dt;
      return false;
    },
  };
}

// ─────────────────────────────────────────
// Music: tapping the record player (or play on the TV's Work screen) plays
// the song and spins the record; tapping again pauses both.
// Put the file at new-portfolio/audio/ and set its name and title here.
// ─────────────────────────────────────────
const SONG = { src: 'audio/' + 'citra.m4a', title: 'Citra — Rafika Duri' };
const music = new Audio();
music.src = SONG.src;
music.loop = true;
music.preload = 'none';   // nothing is downloaded until someone presses play
music.addEventListener('error', () => console.warn(`[room] Could not load the song at ${SONG.src}; the record will spin without sound.`));
let musicOn = false;

function setMusic(on) {
  musicOn = on;
  if (on) music.play().catch((err) => console.warn('[room] The song could not start:', err.message));
  else music.pause();
  if (record && record.playing !== on) record.toggle();
  workTV.setPlaying(on);
  window.dispatchEvent(new CustomEvent('site-music:state', { detail: { on } }));   // the nav's pause button (site-music.js)
}
window.addEventListener('site-music:toggle', () => setMusic(!musicOn));

function toggleRecord() {
  setMusic(!musicOn);
}

// ─────────────────────────────────────────
// Curtains slide apart along their row, then the TV shows the contact channel.
// ─────────────────────────────────────────
function setupCurtains(root) {
  if (!root) return null;
  const folds = [];
  root.traverse((o) => { if (o.isMesh) folds.push(o); });
  if (folds.length < 2) return null;
  const worldPos = (o) => o.getWorldPosition(new THREE.Vector3());
  const first = worldPos(folds[0]);
  const row = worldPos(folds[folds.length - 1]).sub(first).normalize();
  folds.sort((a, b) => worldPos(a).dot(row) - worldPos(b).dot(row));
  const mid = (folds.length - 1) / 2;
  const reach = span * 0.07;
  const moves = folds.map((o, i) => {
    const from = o.position.clone();
    const target = o.parent.worldToLocal(worldPos(o).addScaledVector(row, ((i - mid) / mid) * reach));
    return { o, from, to: target };
  });
  const state = { open: false, t: 0 };
  let onOpened = null;
  return {
    get open() { return state.open; },
    openThen(cb) {
      if (state.open && state.t === 1) { cb(); return; }
      state.open = true;
      onOpened = cb;
    },
    close() { state.open = false; onOpened = null; },
    update(dt) {
      const goal = state.open ? 1 : 0;
      if (state.t === goal) return false;
      state.t = goal > state.t ? Math.min(1, state.t + dt / 0.9) : Math.max(0, state.t - dt / 0.9);
      const e = state.t < 0.5 ? 2 * state.t * state.t : 1 - Math.pow(-2 * state.t + 2, 2) / 2;
      moves.forEach((m) => m.o.position.lerpVectors(m.from, m.to, e));
      if (state.t === 1 && onOpened) { const cb = onOpened; onOpened = null; cb(); }
      return true;
    },
  };
}

// ─────────────────────────────────────────
// Camera: opens on the default perspective, then the visitor can orbit
// around the room (drag) and move closer (scroll / pinch) within limits that
// keep the camera in front of the room. A slow sway and a lean toward
// whatever is under the pointer sit on top.
// ─────────────────────────────────────────
let base = null;                       // last view applied directly
let leanYaw = 0, leanPitch = 0;        // toward the hovered object
let yaw = 0, pitch = 0;                // smoothed lean
let tween = null;
let tuned = false;

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.45;
controls.zoomSpeed = 0.6;
let orbitHome = null;                  // { target, distance, azimuth, polar }
let home = null;                       // the view the room rests at (start, or closer in on a phone)

function applyView(v) {
  base = v;
  camera.position.copy(v.position);
  camera.quaternion.copy(v.quaternion);
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
}

function flyTo(v, ms = 1200, done = null, ease = easeInOut, onStep = null) {
  if (reduceMotion) ms = 1;
  controls.enabled = false;
  removeSway();
  tween = { fromP: camera.position.clone(), fromQ: camera.quaternion.clone(), fromF: camera.fov, to: v, elapsed: 0, ms, done, ease, onStep };
  yaw = pitch = leanYaw = leanPitch = 0;
  swayGain = 0;
}

// Hand the default view to the orbit controls: orbit around the point the
// default camera looks at (the TV), with limits measured from that view.
function orbitFrame() {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(start.quaternion);
  const toScreen = screenInfo ? screenInfo.center.clone().sub(start.position).dot(fwd) : span * 0.5;
  const target = start.position.clone().addScaledVector(fwd, Math.max(toScreen, span * 0.1));
  return { target, sph: new THREE.Spherical().setFromVector3(start.position.clone().sub(target)) };
}
function seat() {
  const { target, sph } = orbitFrame();
  const h = new THREE.Spherical().setFromVector3(home.position.clone().sub(target));
  orbitHome = { target, distance: h.radius, azimuth: h.theta, polar: h.phi };

  controls.target.copy(target);
  controls.minAzimuthAngle = sph.theta - ORBIT_AZIMUTH;
  controls.maxAzimuthAngle = sph.theta + ORBIT_AZIMUTH;
  controls.minPolarAngle = Math.min(Math.max(0.05, sph.phi - ORBIT_UP), orbitHome.polar);
  controls.maxPolarAngle = Math.min(Math.PI / 2 + 0.05, sph.phi + ORBIT_DOWN);
  controls.maxDistance = sph.radius;   // never further out than the whole-room view
  controls.minDistance = sph.radius * ORBIT_ZOOM_IN;
  applyView(home);
  controls.update();
  controls.enabled = !tuned;
}

// Phones held upright rest closer in, looking down across the room from the
// record player's side, so the room fills the screen. Pinching out goes back
// to the whole-room view (start), widening the lens on the way.
const PHONE_VIEW = { azimuth: -28, polar: -10, distance: 0.8, fov: 82 };   // degrees, share of the whole-room distance
function makeHome() {
  home = start;
  if (!start || !isTall()) return;
  let { azimuth, polar, distance, fov } = PHONE_VIEW;
  if (debug && params.get('phone')) [azimuth, polar, distance, fov] = params.get('phone').split(',').map(Number);
  const { target, sph } = orbitFrame();
  const deg = THREE.MathUtils.degToRad;
  const at = new THREE.Spherical(
    sph.radius * distance,
    THREE.MathUtils.clamp(sph.phi + deg(polar), 0.05, sph.phi + ORBIT_DOWN),   // may look down further than orbiting reaches
    THREE.MathUtils.clamp(sph.theta + deg(azimuth), sph.theta - ORBIT_AZIMUTH, sph.theta + ORBIT_AZIMUTH));
  const position = new THREE.Vector3().setFromSpherical(at).add(target);
  const m = new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0));
  home = { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(m), fov: Math.min(fov, start.fov) };
}
const isTall = () => window.innerWidth / window.innerHeight < FRAMED_ASPECT;

function setOrbit(dAzimuth, dPolar, distanceScale) {
  if (!orbitHome) return;
  const sph = new THREE.Spherical(
    THREE.MathUtils.clamp(orbitHome.distance * distanceScale, controls.minDistance, controls.maxDistance),
    THREE.MathUtils.clamp(orbitHome.polar + dPolar, controls.minPolarAngle, controls.maxPolarAngle),
    THREE.MathUtils.clamp(orbitHome.azimuth + dAzimuth, controls.minAzimuthAngle, controls.maxAzimuthAngle)
  );
  camera.position.setFromSpherical(sph).add(controls.target);
  controls.update();
}

function resetView() {
  if (!orbitHome || tuned || tween) return;
  flyTo(home, 1100, seat);
}

// Is the view noticeably away from the default? (Shows "Reset view".)
function awayFromHome() {
  if (!orbitHome || tuned || tween) return false;
  return Math.abs(controls.getAzimuthalAngle() - orbitHome.azimuth) > 0.02
    || Math.abs(controls.getPolarAngle() - orbitHome.polar) > 0.02
    || Math.abs(controls.getDistance() - orbitHome.distance) > orbitHome.distance * 0.03;
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lookQ = new THREE.Quaternion();
const lookE = new THREE.Euler(0, 0, 0, 'YXZ');
const sway = new THREE.Vector3();
const right = new THREE.Vector3();
const upV = new THREE.Vector3();

// The sway is added after the controls place the camera and taken off again
// before the next update, so it never accumulates into the orbit.
function removeSway() {
  camera.position.sub(sway);
  sway.set(0, 0, 0);
}

// The tween advances by frame time capped at 1/30 s, so a slow frame slows
// the move for a moment instead of making it jump ahead.
let swayGain = 1;   // eases the idle sway in after a move, so it doesn't pop
const SWAY_FADE = 2.5;   // seconds
function updateCamera(t, dt) {
  if (tween) {
    tween.elapsed += Math.min(dt, 1 / 30) * 1000;
    const k = tween.ms <= 1 ? 1 : Math.min(1, tween.elapsed / tween.ms);   // instant moves finish at once
    const e = (tween.ease || easeInOut)(k);
    camera.position.lerpVectors(tween.fromP, tween.to.position, e);
    camera.quaternion.slerpQuaternions(tween.fromQ, tween.to.quaternion, e);
    camera.fov = THREE.MathUtils.lerp(tween.fromF, tween.to.fov, e);
    camera.updateProjectionMatrix();
    if (tween.onStep) tween.onStep(k);
    if (k === 1) {
      const { to, done } = tween;
      tween = null;
      applyView(to);
      if (done) done();
    }
    return;
  }
  if (!base || !entered || tuned) return;

  removeSway();
  controls.update();
  if (home !== start && orbitHome) {
    // Zooming out on a phone widens the lens toward the whole-room view.
    const k = THREE.MathUtils.clamp((controls.getDistance() - orbitHome.distance) / (controls.maxDistance - orbitHome.distance || 1), 0, 1);
    const fov = THREE.MathUtils.lerp(home.fov, start.fov, k);
    if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  // A few centimetres of drift on an ~8 second cycle (the room is ~6 m across).
  swayGain = Math.min(1, swayGain + dt / SWAY_FADE);
  const amp = reduceMotion ? 0 : span * 0.004 * swayGain * swayGain * (3 - 2 * swayGain);
  const w = (Math.PI * 2) / SWAY_PERIOD;
  right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  upV.set(0, 1, 0).applyQuaternion(camera.quaternion);
  sway.copy(right).multiplyScalar(Math.sin(t * w) * amp).addScaledVector(upV, Math.sin(t * w * 2) * amp * 0.4);
  camera.position.add(sway);

  yaw += (leanYaw - yaw) * 0.05;
  pitch += (leanPitch - pitch) * 0.05;
  lookE.set(pitch, yaw, 0);
  camera.quaternion.multiply(lookQ.setFromEuler(lookE));

  document.body.classList.toggle('moved', awayFromHome());
}

const toLocal = new THREE.Vector3();
function leanToward(entry) {
  if (!entry || !base) { leanYaw = leanPitch = 0; return; }
  toLocal.copy(entry.center).sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
  const yawTo = Math.atan2(-toLocal.x, -toLocal.z);
  const pitchTo = Math.atan2(toLocal.y, Math.hypot(toLocal.x, toLocal.z));
  leanYaw = THREE.MathUtils.clamp(yawTo * 0.15, -LEAN_MAX, LEAN_MAX);
  leanPitch = THREE.MathUtils.clamp(pitchTo * 0.15, -LEAN_MAX, LEAN_MAX);
}

// "Work": fly up to the TV, let the screen go black, then switch the Work
// screen on inside it. Back / Esc switches it off and flies back out.
const workTV = createWorkTV({
  onBack: () => tuneOut(),
  onPlayToggle: (playing) => setMusic(playing),
  songTitle: SONG.title,
});
// From a case study's "All work": the Work screen is up at once, while the
// room loads behind it (the camera is put at the TV once it's ready).
if (openWorkOnLoad) workTV.open(true);

function tuneIn(instant = false) {
  if (!tvView || !screen || tuned || !entered || tween) return;
  tuned = true;
  document.body.classList.add('tuned');
  document.body.classList.remove('moved');
  canvas.classList.remove('pointing');
  screen.showOff();
  removeSway();
  flyTo(tvView, instant ? 1 : 1500, () => setTimeout(() => workTV.open(), instant ? 0 : 250));
}

function tuneOut() {
  // Back pressed before the room had loaded behind the Work screen.
  if (!tuned && workTV.isOpen) {
    if (openWorkHash()) history.replaceState(null, '', location.pathname + location.search);
    workTV.close();
    return;
  }
  if (!tuned || tween) return;
  if (openWorkHash()) history.replaceState(null, '', location.pathname + location.search);
  workTV.close(() => {
    tuned = false;
    document.body.classList.remove('tuned');
    screen.showSlides();
    // Always back to the default view, with the orbit reset to it.
    flyTo(home, 1400, seat);
  });
}
document.getElementById('navWork').addEventListener('click', () => (reaching ? closeReach(() => tuneIn()) : tuneIn()));

// ─────────────────────────────────────────
// About Me: the camera dives into the name, then the About page (which
// starts on black) plays its intro.
//   'visit' — "About Me" in the nav: one move over and into the name as the room goes dark.
//   'zoom'  — the name itself (in the room or the nav): dive straight in, no darkening.
// ─────────────────────────────────────────
const ABOUT_URL = 'about/';
const blackout = document.getElementById('blackout');
let aboutQueued = false;
let roomExposure = null;   // the room's brightness before the dive, to restore on Back

// Straight-on view of the name from the side the default view looks from;
// `fit` is how much of the frame the name's width fills (over 1 = past the edges).
function nameView(fit) { return viewOf(nameBox, fit); }

// Straight-on view of `box` from the side the default view looks from.
// lift: how much of the default view's height above it to keep (0 = level).
// shiftX / shiftY: slide the frame so the object sits off-centre (share of the frame).
function viewOf(box, fit, { lift = 0.35, shiftX = 0, shiftY = 0 } = {}) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dir = start.position.clone().sub(c);
  dir.y = Math.max(dir.y, 0) * lift;
  dir.normalize();
  const fov = 30;
  const vh = 2 * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const width = Math.hypot(size.x, size.z);
  const d = Math.max(size.y / (vh * fit), width / (vh * camera.aspect * fit));
  const right = new THREE.Vector3().crossVectors(dir.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir.clone().negate()).normalize();
  const shift = right.multiplyScalar(shiftX * vh * camera.aspect * d).add(up.multiplyScalar(shiftY * vh * d));
  const target = c.clone().add(shift);
  return viewFrom(target.clone().addScaledVector(dir, d), target, fov);
}

function fadeToBlack(after) {
  blackout.classList.add('on');
  setTimeout(after, reduceMotion ? 0 : 650);
}

function goToAbout(mode) {
  if (leaving) return;
  // No room to move through yet (still loading, or no name in the model): just fade out.
  if (!entered || !start || !nameBox) { leaving = true; fadeToBlack(() => { location.href = ABOUT_URL; }); return; }
  // Mid-move (e.g. still flying in): go as soon as the camera settles.
  if (tween) {
    if (!aboutQueued) { aboutQueued = true; const wait = () => (tween ? setTimeout(wait, 60) : (aboutQueued = false, goToAbout(mode))); wait(); }
    return;
  }
  // The Work screen is open: switch it off first.
  if (tuned) {
    workTV.close(() => {
      tuned = false;
      document.body.classList.remove('tuned');
      screen.showSlides();
      goToAbout(mode);
    });
    return;
  }
  leaving = true;
  document.body.classList.add('leaving');
  canvas.classList.remove('pointing');
  if (musicOn) fadeMusic(0, mode === 'zoom' ? 1700 : 2300);   // fades out through the move; About fades it back in, quietly
  roomExposure = renderer.toneMappingExposure;
  // Speed up into the letters. From "About Me" the room also dims to nothing
  // on the way in; from the name it doesn't, and the page cuts straight over.
  const dive = (dim, ms, ease) => flyTo(nameView(10), ms, () => {
    if (dim) blackout.classList.add('on', 'instant');   // already black; this just holds it
    location.href = ABOUT_URL;
  }, ease, dim ? (k) => {
    const dark = THREE.MathUtils.clamp((k - 0.3) / 0.7, 0, 1);
    renderer.toneMappingExposure = roomExposure * (1 - dark) * (1 - dark);
  } : null);
  // One continuous move either way: from the name it's already close, so it
  // accelerates hard; from "About Me" it travels further, so it's longer and speeds up more gently.
  // On a phone the name is further from where the view rests, so the slow start of a
  // cubic ease reads as a pause on the TV: it eases in gently but is moving from the first moment.
  // (phones also dim to black as they go in, so no frame of the room is left showing when the page changes)
  if (mode === 'zoom') { if (isTall()) dive(true, 2000, (t) => 0.3 * t + 0.7 * t * t * t); else dive(false, 1800, (t) => t * t * t); }
  else dive(true, 2400, (t) => t * t);
}

function onAboutLink(mode) {
  return (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // new tab: open normally
    e.preventDefault();
    goToAbout(mode);
  };
}
document.getElementById('navAbout').addEventListener('click', onAboutLink('visit'));
// "Room lived by AK" (top left) and "Room" in the navigation: back to the room
// from anywhere in it — off the Work screen, away from the phone, or back to
// the default view.
function goRoom() {
  if (leaving) return;
  if (reaching) closeReach();
  else if (tuned || workTV.isOpen) tuneOut();   // (open before the room had loaded, too)
  else resetView();
}
document.getElementById('navName').addEventListener('click', (e) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // new tab: open normally
  e.preventDefault();
  goRoom();
});
document.getElementById('navRoom').addEventListener('click', goRoom);

// Coming back with the browser's Back button: lift the black and sit back in the room.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted || !leaving) return;
  leaving = false;
  tween = null;
  document.body.classList.remove('leaving');
  blackout.classList.remove('on', 'instant');
  if (roomExposure !== null) renderer.toneMappingExposure = roomExposure;
  if (start) seat();
  if (musicOn) { music.volume = 1; music.play().catch(() => {}); }
});

// ─────────────────────────────────────────
// The song between pages: it's saved (playing or not, and where it's up to)
// whenever this page is left. About Me carries on from there quietly; coming
// back here, it picks up again at full volume (where the browser allows it).
// ─────────────────────────────────────────
const MUSIC_KEY = 'ak-music';
const MUSIC_LOW = 0.18;   // the quiet level it fades to on the way to About Me (and plays at there)
function saveMusic() {
  try { sessionStorage.setItem(MUSIC_KEY, JSON.stringify({ on: musicOn && !music.paused, t: music.currentTime || 0, at: Date.now() })); } catch (e) {}
}
window.addEventListener('pagehide', saveMusic);

let musicFade = 0;
function fadeMusic(to, ms) {
  const from = music.volume, t0 = performance.now(), id = ++musicFade;
  (function step(now) {
    if (id !== musicFade) return;
    const k = Math.min(1, (now - t0) / ms);
    music.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

function resumeMusic() {
  let st = null;
  try { st = JSON.parse(sessionStorage.getItem(MUSIC_KEY)); } catch (e) {}
  if (!st || !st.on || musicOn) return;
  const go = () => {
    if (music.duration) music.currentTime = (st.t + (Date.now() - st.at) / 1000) % music.duration;
    music.volume = MUSIC_LOW;
    music.play().then(() => { setMusic(true); fadeMusic(1, 1500); }).catch(() => {});   // blocked: stays off
  };
  music.preload = 'auto';
  if (music.readyState >= 1) go(); else { music.addEventListener('loadedmetadata', go, { once: true }); music.load(); }
}

// ─────────────────────────────────────────
// "Reach me": the phone. The camera goes over to it and two chrome buttons
// (Email, LinkedIn) come up beside it. "Room" in the navigation or Esc returns to the room.
// ─────────────────────────────────────────
const reachEl = document.getElementById('reach');
let reachIcons = null;
function openReach() {
  if (!phoneBox || !entered || tween || tuned || leaving || reaching) return;
  reaching = tuned = true;
  document.body.classList.add('tuned', 'reaching');
  document.body.classList.remove('moved');
  canvas.classList.remove('pointing');
  removeSway();
  const portrait = camera.aspect < 1;
  // The phone sits left of the buttons (or above them on a phone screen).
  const view = viewOf(phoneBox, portrait ? 0.5 : 0.3, portrait ? { lift: 0.7, shiftY: -0.2 } : { lift: 0.7, shiftX: 0.2 });
  flyTo(view, 1400, () => {
    reachEl.hidden = false;
    reachIcons = createReachIcons(reachEl);
    requestAnimationFrame(() => reachEl.classList.add('on'));
    reachEl.querySelector('.icon-link')?.focus({ preventScroll: true });
  });
}
function closeReach(after) {
  if (!reaching || tween) return;
  reachEl.classList.remove('on');
  setTimeout(() => { reachEl.hidden = true; if (reachIcons) { reachIcons.dispose(); reachIcons = null; } }, 300);
  flyTo(home, 1300, () => {
    reaching = tuned = false;
    document.body.classList.remove('tuned', 'reaching');
    seat();
    if (after) after();
  });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && reaching) closeReach(); });

// ─────────────────────────────────────────
// Pointer: drag to orbit (OrbitControls); hover and click are resolved with one raycast
// per frame against the interactive objects only.
// ─────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointerState = { inside: false, dirty: false, click: false, touch: false };
let hovered = null;
let drag = null;

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pointerState.inside = true;
  pointerState.dirty = true;
}

function isShown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function resolvePointer() {
  if (!pointerState.dirty && !pointerState.click) return;
  pointerState.dirty = false;
  let hit = null;
  if (pointerState.inside && entered && !tween) {
    raycaster.setFromCamera(pointer, camera);
    const h = raycaster.intersectObjects(pickMeshes, false).find((i) => isShown(i.object));
    hit = h ? h.object.userData.interactive : null;
  }
  if (pointerState.click) {
    pointerState.click = false;
    if (hit && !tuned && !leaving) activate(hit.kind);
    // A finger has gone once it lifts: don't leave the room leaning toward what was tapped.
    if (pointerState.touch) { pointerState.touch = false; pointerState.inside = false; pointerState.dirty = true; hit = null; }
  }
  if (tuned) hit = null;
  if (hit !== hovered) {
    hovered = hit;
    canvas.classList.toggle('pointing', !!hit);
    leanToward(hit);
  }
}

function activate(kind) {
  if (kind === 'tv') { if (screen) screen.openCurrent(); }
  else if (kind === 'lamp') toggleLamp();
  else if (kind === 'record') toggleRecord();
  else if (kind === 'name') goToAbout('zoom');
  else if (kind === 'phone') openReach();
  else if (kind === 'curtains' && curtains) { if (curtains.open) curtains.close(); else curtains.openThen(() => {}); }
}

function toggleLamp() {
  if (!lights) return;
  lights.setLamp(!lights.lampOn);
  renderer.shadowMap.needsUpdate = true;
}

// The orbit controls do the dragging; this only tells a click from a drag.
canvas.addEventListener('pointerdown', (e) => {
  if (tuned || tween || !base || !entered) return;
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
});
canvas.addEventListener('pointermove', (e) => {
  if (drag) {
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
    canvas.classList.toggle('dragging', drag.moved > 4);
    return;
  }
  if (e.pointerType !== 'touch') setPointer(e);
});
canvas.addEventListener('dblclick', resetView);
document.getElementById('btnReset').addEventListener('click', resetView);
// (A finger "leaves" the moment it lifts, before the tap is looked at; that's handled above.)
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'touch') return; pointerState.inside = false; pointerState.dirty = true; });
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const wasClick = drag.moved < 6;
  drag = null;
  canvas.classList.remove('dragging');
  if (!wasClick) return;
  setPointer(e);
  pointerState.click = true;
  pointerState.touch = e.pointerType !== 'mouse';
});
canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });

// ─────────────────────────────────────────
// TV screen painter: a spotlight slideshow of FEATURED projects, with a burst
// of static between slides. The canvas is redrawn and uploaded only when what
// it shows has changed, and at most 30 times a second.
// ─────────────────────────────────────────
function createScreen(aspect) {
  const W = 1024, H = Math.round(W / (aspect || 4 / 3));
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');
  const texture = new THREE.CanvasTexture(cvs);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 4;

  // Static is drawn small and scaled up for chunky grain.
  const noise = document.createElement('canvas');
  noise.width = 192; noise.height = Math.round(192 * H / W);
  const nctx = noise.getContext('2d');
  const nimg = nctx.createImageData(noise.width, noise.height);

  // Scanlines and vignette never change, so draw them once.
  const crt = document.createElement('canvas');
  crt.width = W; crt.height = H;
  const cctx = crt.getContext('2d');
  cctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < H; y += 4) cctx.fillRect(0, y, W, 2);
  const vg = cctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.75)');
  cctx.fillStyle = vg;
  cctx.fillRect(0, 0, W, H);

  const images = FEATURED.map((f) => { const img = new Image(); img.src = f.img; return img; });

  const BOOT_SECS = 0.9;     // static when the TV first comes on
  const SLIDE_SECS = 4.5;    // each project stays up this long
  const SWITCH_SECS = 0.35;  // static between projects
  const PERIOD = SLIDE_SECS + SWITCH_SECS;
  const FRAME_MS = 1000 / 30;
  const S = H / 600;   // type scale
  const state = { mode: 'off', t0: 0, held: false };
  let lastDraw = -Infinity, lastSig = '';

  function fontsReady() {
    return Promise.all([
      document.fonts.load(`${Math.round(110 * S)}px "Bebas Neue"`),
      document.fonts.load(`${Math.round(24 * S)}px "IBM Plex Mono"`),
    ]).catch(() => {});
  }

  function drawStatic(alpha = 1) {
    const d = nimg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    nctx.putImageData(nimg, 0, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noise, 0, 0, W, H);
    ctx.restore();
  }

  const blink = (t, rate = 2) => Math.floor(t * rate) % 2 === 0;

  // Where the slideshow is at time t (seconds since it started).
  function at(t) {
    if (t < BOOT_SECS) return { boot: true, index: 0 };
    const k = (t - BOOT_SECS) / PERIOD;
    const index = Math.floor(k) % FEATURED.length;
    const local = (k % 1) * PERIOD;
    return { index, local, switching: local > SLIDE_SECS };
  }

  function cover(img, x, y, w, h) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    return true;
  }

  // The whole picture, never cropped or stretched. The screen is a touch
  // taller than 16:9, so the thin gaps left above and below are filled by
  // stretching the picture's own top and bottom rows of pixels.
  function fit(img) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const r = Math.min(W / nw, H / nh);
    const iw = nw * r, ih = nh * r, x = (W - iw) / 2, y = (H - ih) / 2;
    if (y > 0) {
      ctx.drawImage(img, 0, 0, nw, 1, 0, 0, W, Math.ceil(y));
      ctx.drawImage(img, 0, nh - 1, nw, 1, 0, Math.floor(y + ih), W, Math.ceil(y));
    }
    if (x > 0) {
      ctx.drawImage(img, 0, 0, 1, nh, 0, 0, Math.ceil(x), H);
      ctx.drawImage(img, nw - 1, 0, 1, nh, Math.floor(x + iw), 0, Math.ceil(x), H);
    }
    ctx.drawImage(img, x, y, iw, ih);
    return true;
  }

  function drawSlide(i, t) {
    const f = FEATURED[i];
    ctx.fillStyle = '#1f2a1c';
    ctx.fillRect(0, 0, W, H);
    if (f.titled) fit(images[i]); else cover(images[i], 0, 0, W, H);
    // Darken the top and bottom so the labels read.
    if (!f.titled) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.22, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    }

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7dff8a';
    ctx.font = `${Math.round(24 * S)}px "IBM Plex Mono", monospace`;
    ctx.fillText('★ SPOTLIGHT', 44 * S, 34 * S);
    // Slide dots, top right.
    FEATURED.forEach((_, k) => {
      ctx.fillStyle = k === i ? '#7dff8a' : 'rgba(125,255,138,0.35)';
      ctx.beginPath();
      ctx.arc(W - 44 * S - (FEATURED.length - 1 - k) * 22 * S, 46 * S, 6 * S, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.textBaseline = 'alphabetic';
    if (!f.titled) {
      ctx.fillStyle = '#f3efe4';
      ctx.font = `${Math.round(110 * S)}px "Bebas Neue", sans-serif`;
      ctx.fillText(f.name, 44 * S, H - 120 * S);
      ctx.font = `${Math.round(24 * S)}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = 'rgba(243,239,228,0.9)';
      ctx.fillText(f.line, 46 * S, H - 78 * S);
    }
    if (blink(t, 1.6)) {
      ctx.fillStyle = '#7dff8a';
      ctx.font = `${Math.round(20 * S)}px "IBM Plex Mono", monospace`;
      ctx.fillText('▶ TAP TO OPEN', 46 * S, H - 36 * S);
    }
  }

  function drawCRT(now) {
    ctx.drawImage(crt, 0, 0);
    // A soft rolling band and a touch of flicker, stepped at 10 fps.
    const t = Math.floor(now / 100) / 10;
    const band = (((t * 0.25) % 1.3) - 0.15) * H;
    const bg = ctx.createLinearGradient(0, band - 60 * S, 0, band + 60 * S);
    bg.addColorStop(0, 'rgba(255,255,255,0)');
    bg.addColorStop(0.5, 'rgba(255,255,255,0.045)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, band - 60 * S, W, 120 * S);
    if (!reduceMotion) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Everything that changes what is on screen, so unchanged frames are skipped.
  function signature(now, t) {
    if (state.mode !== 'slides') return state.mode;
    const frame = Math.floor(now / FRAME_MS);
    const crtStep = reduceMotion ? 0 : Math.floor(now / 100);
    const p = at(t);
    if (p.boot || p.switching) return 'static' + frame;
    if (p.local < 0.12) return 'fade' + frame;
    return ['slide', p.index, blink(t, 1.6), images[p.index].complete, crtStep].join();
  }

  function draw(now) {
    if (now - lastDraw < FRAME_MS) return;
    const t = (now - state.t0) / 1000;
    const sig = signature(now, t);
    if (sig === lastSig) return;
    lastSig = sig;
    lastDraw = now;
    if (state.mode === 'off') {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, W, H);
    } else {
      const p = at(t);
      if (p.boot || p.switching) drawStatic();
      else {
        drawSlide(p.index, t);
        if (p.local < 0.12) drawStatic(1 - p.local / 0.12);
      }
    }
    drawCRT(now);
    texture.needsUpdate = true;
  }

  function setMode(mode) { state.mode = mode; state.t0 = performance.now(); }

  return {
    texture,
    get mode() { return state.mode; },
    draw,
    // Starts the slideshow once the fonts are in, unless the screen was
    // switched off (for Work) in the meantime.
    boot() { fontsReady().then(() => { if (state.mode === 'off' && !state.held) setMode('slides'); }); },
    showSlides() { state.held = false; setMode('slides'); },
    showOff() { state.held = true; setMode('off'); },
    // Opens the project on screen (during the static between slides, the next one).
    openCurrent() {
      if (state.mode !== 'slides') return;
      const p = at((performance.now() - state.t0) / 1000);
      const i = p.switching ? (p.index + 1) % FEATURED.length : p.index;
      location.href = FEATURED[i].href;
    },
  };
}

// ─────────────────────────────────────────
// Adaptive quality: if frames run slow for a couple of seconds, step down
// one level (resolution, then contact shadows, then glow). Never steps back
// up, so the picture doesn't flicker between levels.
// ─────────────────────────────────────────
const QUALITY_STEPS = [
  () => setPixelRatio(1),
  () => { if (ao) ao.enabled = false; },
  () => setPixelRatio(0.8),
  () => { bloom.enabled = false; },
];
const quality = { level: 0, frames: 0, time: 0, grace: 1 };   // judged behind the intro, before the fly-in
function setPixelRatio(r) {
  if (lowPower) r = Math.min(r, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, r));
  composer.setPixelRatio(Math.min(window.devicePixelRatio, r));
  composer.setSize(window.innerWidth, window.innerHeight);
}
function watchQuality(dt) {
  if (quality.grace > 0) { quality.grace -= dt; return; }   // skip loading hitches
  quality.frames++;
  quality.time += dt;
  if (quality.time < 2) return;
  const fps = quality.frames / quality.time;
  quality.frames = 0;
  quality.time = 0;
  if (fps < 45 && quality.level < QUALITY_STEPS.length) {
    QUALITY_STEPS[quality.level++]();
    quality.grace = 1;
    if (debug) console.info(`[room] ${fps.toFixed(0)} fps; quality lowered to level ${quality.level}.`);
  }
}

// ── Loop ──
const clock = new THREE.Clock();
let elapsed = 0;
function tick(now) {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed += dt;
  if (!document.hidden && !tween) watchQuality(dt);   // never change quality mid-move
  resolvePointer();
  updateCamera(elapsed, dt);
  if (screen) screen.draw(now);
  if (lights) lights.update(dt);
  // Moving pieces need their shadows redrawn while they move.
  if ((record && record.update(dt)) | (curtains && curtains.update(dt))) renderer.shadowMap.needsUpdate = true;
  film.uniforms.time.value = elapsed;
  if (lightTags.length) placeLightTags();
  composer.render();
  if (stats) stats.update();
}

// Nothing to draw while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (!base) return;
  if (document.hidden) {
    renderer.setAnimationLoop(null);
  } else {
    clock.getDelta();   // don't count the hidden time
    renderer.setAnimationLoop(tick);
  }
});

// The default view was framed for a landscape screen. On a tall, narrow one
// (a phone held upright) widen it, still centred on the room, until every
// object you can tap (TV, lamp, record player, phone, name) fits across.
const FRAMED_ASPECT = 1.3;   // screens at least this wide see the view as framed
const MAX_FOV = 100;         // the widest it goes, however narrow the screen
const KEEP_IN_VIEW = ['tv', 'lamp', 'record', 'phone', 'name'];
let roomExtent = null;       // { box, floorY }: the room's walls and floor (set when it loads)
let keepHalfAngle = null;    // degrees either side of the default view's centre those objects reach
function keepInViewAngle() {
  if (keepHalfAngle !== null) return keepHalfAngle;
  const inv = start.baseQuat.clone().invert();
  const box = new THREE.Box3(), c = new THREE.Vector3();
  let most = 0;
  for (const it of interactive) {
    if (!KEEP_IN_VIEW.includes(it.kind)) continue;
    box.makeEmpty();
    it.meshes.forEach((m) => box.union(new THREE.Box3().setFromObject(m)));
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .sub(start.position).applyQuaternion(inv);   // into the camera's own frame
      if (c.z < -0.01) most = Math.max(most, Math.abs(Math.atan(c.x / -c.z)));
    }
  }
  keepHalfAngle = most ? THREE.MathUtils.radToDeg(most) + 2 : 0;   // with a little margin
  return keepHalfAngle;
}
function fitStartToScreen() {
  if (!start || !start.baseFov) return;
  const a = window.innerWidth / window.innerHeight;
  start.quaternion.copy(start.baseQuat);
  if (a >= FRAMED_ASPECT) { start.fov = start.baseFov; return; }
  const deg = THREE.MathUtils.degToRad, rad = THREE.MathUtils.radToDeg;
  // As wide across as a landscape screen sees, or wider if that's what fits everything.
  const across = Math.max(Math.atan(Math.tan(deg(start.baseFov / 2)) * FRAMED_ASPECT), deg(keepInViewAngle()));
  start.fov = Math.min(MAX_FOV, rad(2 * Math.atan(Math.tan(across) / a)));
  // Then look up or down so the room sits in the middle, with equal space above and below.
  const tilt = roomMiddleAngle();
  if (tilt) start.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg(tilt)));
}
// Degrees above (+) or below (-) the default view's centre that the middle of
// the room's open front sits: halfway between the floor's front edge and the
// ceiling's.
let roomMiddleDeg = null;
function roomMiddleAngle() {
  if (roomMiddleDeg !== null) return roomMiddleDeg;
  roomMiddleDeg = 0;
  if (!roomExtent || !start) return 0;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(start.baseQuat);
  const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
  const p = start.position;
  const foot = roomExtent.box.clone();   // stretched to the camera's height, so a level ray finds the front
  foot.min.y = Math.min(foot.min.y, p.y - 1); foot.max.y = Math.max(foot.max.y, p.y + 1);
  if (foot.containsPoint(p)) return 0;   // standing inside the room: nothing to centre
  const hit = new THREE.Ray(p.clone(), flat).intersectBox(foot, new THREE.Vector3());
  if (!hit) return 0;
  const up = (y) => Math.asin(THREE.MathUtils.clamp(new THREE.Vector3(hit.x, y, hit.z).sub(p).normalize().y, -1, 1));
  const middle = (up(roomExtent.box.max.y) + up(roomExtent.floorY)) / 2 - Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
  roomMiddleDeg = THREE.MathUtils.radToDeg(middle);
  return roomMiddleDeg;
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // Re-fit the default view; if sitting in it, take the new framing straight away.
  const atHome = home && !tuned && !tween && !document.body.classList.contains('moved');
  fitStartToScreen();
  makeHome();
  if (atHome && orbitHome) { applyView(home); seat(); }
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);   // also resizes the AO and bloom passes
  // The close-up distance depends on the screen shape.
  if (screenInfo) {
    tvView = screenView(screenInfo);
    if (tuned && !tween) applyView(tvView);
  }
});
