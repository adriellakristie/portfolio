/*
 * reach-icons.js — the two 3D icons in "Reach me" (the phone): a chrome
 * envelope (Email) and a glossy LinkedIn tile with chrome "in" letters.
 * Each draws in the <canvas> inside its link, floats and sways gently,
 * turns toward the pointer and grows a little on hover. Created when the
 * panel opens and disposed when it closes.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const FONT_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/fonts/helvetiker_bold.typeface.json';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let fontPromise = null;
const loadFont = () => (fontPromise ||= new Promise((resolve, reject) => new FontLoader().load(FONT_URL, resolve, undefined, reject)));

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const chrome = () => new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.16, envMapIntensity: 1.6 });

// A rounded slab, centred, front face at z = +depth/2 (plus bevel).
function slab(w, h, r, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 14,
  });
  g.center();
  return g;
}

function envelope() {
  const group = new THREE.Group();
  const W = 1.7, H = 1.12, D = 0.16, B = 0.05;
  group.add(new THREE.Mesh(slab(W, H, 0.12, D, B), chrome()));
  const front = D / 2 + B;
  // The flap: a raised V from the top corners down to the middle.
  const inset = 0.1;
  const flap = new THREE.Shape();
  flap.moveTo(-W / 2 + inset, H / 2 - inset);
  flap.lineTo(W / 2 - inset, H / 2 - inset);
  flap.lineTo(0, -0.06);
  flap.closePath();
  const flapGeo = new THREE.ExtrudeGeometry(flap, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4 });
  const flapMesh = new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ color: 0xe9ecf2, metalness: 1, roughness: 0.1, envMapIntensity: 1.8 }));
  flapMesh.position.z = front - 0.01;
  group.add(flapMesh);
  // The two lower folds, as faint grooves from the bottom corners.
  for (const side of [-1, 1]) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.02), new THREE.MeshStandardMaterial({ color: 0x8b9099, metalness: 1, roughness: 0.3 }));
    groove.position.set(side * 0.43, -0.3, front + 0.005);
    groove.rotation.z = side * -0.62;
    group.add(groove);
  }
  return group;
}

function linkedin() {
  const group = new THREE.Group();
  const S = 1.36, D = 0.2, B = 0.06;
  // Silver tile, like the envelope; the "in" is darker gunmetal so it reads.
  group.add(new THREE.Mesh(slab(S, S, 0.28, D, B), chrome()));
  const front = D / 2 + B;
  loadFont().then((font) => {
    const g = new TextGeometry('in', { font, size: 0.7, depth: 0.1, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.014, bevelSegments: 3 });
    g.computeBoundingBox();
    const bb = g.boundingBox;
    g.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2 - 0.02, 0);
    const text = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a3e45, metalness: 1, roughness: 0.32, envMapIntensity: 0.9 }));
    text.position.z = front - 0.02;
    group.add(text);
  }).catch(() => {});
  return group;
}

function createIcon(link) {
  const canvas = link.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const key = new THREE.DirectionalLight(0xfff1e0, 1.4);
  key.position.set(-2, 3, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.15, 4.6);
  camera.lookAt(0, 0, 0);

  const icon = link.dataset.icon === 'linkedin' ? linkedin() : envelope();
  scene.add(icon);

  const size = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  size();

  // Hover: turn toward the pointer and grow a little.
  let hover = false, px = 0, py = 0;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  const onEnter = () => { hover = true; };
  const onLeave = () => { hover = false; px = py = 0; };
  link.addEventListener('pointermove', onMove);
  link.addEventListener('pointerenter', onEnter);
  link.addEventListener('pointerleave', onLeave);
  const onFocus = () => { if (link.matches(':focus-visible')) hover = true; };   // keyboard focus only
  link.addEventListener('focus', onFocus);
  link.addEventListener('blur', onLeave);

  const phase = link.dataset.icon === 'linkedin' ? 1.7 : 0;   // so the two don't move in step
  let running = true, rotY = 0, rotX = 0, scale = 1;
  const t0 = performance.now();
  (function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000 + phase;
    const idleY = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.4;
    const idleX = reduceMotion ? 0 : Math.sin(t * 0.7) * 0.06 - 0.08;
    const wantY = hover ? px * 0.6 : idleY;
    const wantX = hover ? py * 0.35 : idleX;
    rotY += (wantY - rotY) * 0.08;
    rotX += (wantX - rotX) * 0.08;
    scale += ((hover ? 1.1 : 1) - scale) * 0.12;
    icon.rotation.set(rotX, rotY, 0);
    icon.position.y = reduceMotion ? 0 : Math.sin(t * 1.4) * 0.06;
    icon.scale.setScalar(scale);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  })(t0);

  return {
    resize: size,
    dispose() {
      running = false;
      link.removeEventListener('pointermove', onMove);
      link.removeEventListener('pointerenter', onEnter);
      link.removeEventListener('pointerleave', onLeave);
      link.removeEventListener('focus', onFocus);
      link.removeEventListener('blur', onLeave);
      scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

export function createReachIcons(root) {
  const icons = [...root.querySelectorAll('.icon-link')].map(createIcon);
  const onResize = () => icons.forEach((i) => i.resize());
  window.addEventListener('resize', onResize);
  return {
    dispose() {
      window.removeEventListener('resize', onResize);
      icons.forEach((i) => i.dispose());
    },
  };
}
