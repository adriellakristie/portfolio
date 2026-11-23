/*
 * logo-scene.js — the couch logo on the loading screen: a chrome "AK" hops
 * into the teal couch (models/couchlogo.glb). It crouches on the floor, jumps
 * in an arc, lands on the seat with a squash and settles, then gives the odd
 * little bounce while the room is still loading.
 *
 * Runs in a worker on an OffscreenCanvas (logo-worker.js), so the room loading
 * on the main thread can't make the jump stutter. loader-logo.js starts it.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js/+esm';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js/+esm';
import { mergeVertices } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js/+esm';

// ── Look ───────────────────────────────────────────────────────
const AK_NAME = 'typeMesh1';
const COUCH = [0x246377, 0x327a8d];   // teal from the Maya scene: body, seat cushion
// Camera: azimuth round the couch and elevation above it (degrees), and
// how tightly it frames the logo (smaller = bigger).
const VIEW = { az: -8, el: 13, margin: 0.62 };
// Where the jump starts (in AK widths: out in front of the couch, and to the
// right) and how high it goes (in AK heights above the seat).
const JUMP = { out: 1.0, side: 0.35, height: 1.1 };
// The second hop, along the sofa: it starts this many AK widths to the right
// (and toward the front) of where AK ends up (its place in the Maya scene),
// and how high it goes.
const HOP = { side: 0.6, out: 0.6, height: 0.75 };   // out: toward the front of the seat
// The jump, in seconds.
const T = { delay: 0.5 };   // standing on the floor before the first jump
const JUMPS = [   // seconds for each part of each jump
  { crouch: 0.22, air: 0.6, land: 0.13, settle: 0.35 },    // floor → sofa
  { crouch: 0.16, air: 0.46, land: 0.12, settle: 0.5 },    // sofa → sofa
];
// ───────────────────────────────────────────────────────────────

export function createLogo({ canvas, width, height, dpr, modelUrl, reduceMotion, freezeAt, view, onReady, onError, onLanded }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(dpr || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 1);   // opaque black (the loading screen): the first frame covers the still picture underneath
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8378, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  scene.add(key, key.target);

  const camera = new THREE.PerspectiveCamera(28, width / height, 0.001, 100);
  const [azDeg, elDeg] = view || [VIEW.az, VIEW.el];
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  const toCamera = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));     // screen right, along the floor
  const forward = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));    // toward the camera, along the floor

  let running = true;
  let size = [width, height];
  let fit = () => {};
  let tick = null;

  new GLTFLoader().load(modelUrl, (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    model.updateMatrixWorld(true);
    const ak = model.getObjectByName(AK_NAME);
    if (!ak) return;

    // Materials: chrome AK; glossy teal couch (the GLB only carries plain grey).
    ak.material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 2.2 });
    let piece = 0;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o === ak) return;
      o.receiveShadow = true;
      // The export is Maya's low-poly cage (smooth preview isn't exported):
      // weld it and smooth its shading so it isn't faceted.
      const g = o.geometry.clone();
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      o.geometry = mergeVertices(g, 1e-4);
      o.geometry.computeVertexNormals();
      o.material = new THREE.MeshPhysicalMaterial({
        color: COUCH[Math.min(piece++, COUCH.length - 1)],
        roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.18, envMapIntensity: 0.8,
      });
    });

    const couchBox = new THREE.Box3();
    model.traverse((o) => { if (o.isMesh && o !== ak) couchBox.expandByObject(o); });
    const couchCentre = couchBox.getCenter(new THREE.Vector3());
    const couchSize = couchBox.getSize(new THREE.Vector3());

    // AK pivots from the middle of its base, so squash and stretch keep its feet down.
    const akBox = new THREE.Box3().setFromObject(ak);
    const akSize = akBox.getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.set((akBox.min.x + akBox.max.x) / 2, akBox.min.y, (akBox.min.z + akBox.max.z) / 2);
    scene.add(pivot);
    pivot.attach(ak);
    const rest = pivot.position.clone();
    const akWide = Math.hypot(akSize.x, akSize.z);

    const floorY = couchBox.min.y;
    const from = rest.clone().addScaledVector(forward, akWide * JUMP.out).addScaledVector(right, akWide * JUMP.side);
    from.y = floorY;
    const peak = rest.y - floorY + akSize.y * JUMP.height;
    const onSofa = rest.clone().addScaledVector(right, akWide * HOP.side).addScaledVector(forward, akWide * HOP.out);   // where the first jump lands
    const legs = [
      { a: from, b: onSofa, h: peak, ...JUMPS[0] },
      { a: onSofa, b: rest, h: akSize.y * HOP.height, ...JUMPS[1] },
    ];
    legs.forEach((j) => { j.dur = j.crouch + j.air + j.land + j.settle; j.dir = Math.sign(j.b.clone().sub(j.a).dot(right)) || -1; });

    // Soft shadow on an invisible floor, under the couch.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(couchSize.x * 4, couchSize.z * 4), new THREE.ShadowMaterial({ opacity: 0.14 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(couchCentre.x, floorY, couchCentre.z);
    floor.receiveShadow = true;
    scene.add(floor);
    const reach = couchSize.length();
    key.target.position.copy(couchCentre);
    key.position.copy(couchCentre).addScaledVector(new THREE.Vector3(-0.5, 1, 0.45).normalize(), reach * 2);
    Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.001, far: reach * 5 });
    key.shadow.camera.updateProjectionMatrix();

    // Frame: centred on the couch, wide enough for the start of the jump and its arc.
    const target = couchCentre.clone();
    target.y = floorY + couchSize.y * 0.6;
    const points = [from, onSofa, onSofa.clone().setY(floorY + peak + akSize.y), rest.clone().setY(rest.y + akSize.y * (HOP.height + 1))];
    for (let i = 0; i < 8; i++) points.push(new THREE.Vector3(i & 1 ? couchBox.max.x : couchBox.min.x, i & 2 ? couchBox.max.y : couchBox.min.y, i & 4 ? couchBox.max.z : couchBox.min.z));
    const radius = Math.max(...points.map((p) => p.distanceTo(target)));
    fit = () => {
      const [w, h] = size;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const half = THREE.MathUtils.degToRad(camera.fov / 2);
      const d = radius / Math.sin(Math.min(half, Math.atan(Math.tan(half) * camera.aspect))) * VIEW.margin;
      camera.position.copy(target).addScaledVector(toCamera, d);
      camera.lookAt(target);
      camera.near = d / 100; camera.far = d * 10;
      camera.updateProjectionMatrix();
    };
    fit();

    // ── The jumps ──
    const tEnd = T.delay + legs.reduce((n, j) => n + j.dur, 0);
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const squash = (s) => { const side = 1 / Math.sqrt(s); pivot.scale.set(side, s, side); };
    const lean = (a) => { pivot.rotation.set(0, 0, 0); if (a) pivot.rotateOnWorldAxis(toCamera, a); };

    // One jump from j.a to j.b, t seconds into it: crouch, arc, landing squash, settle.
    function jumpPose(j, t) {
      if (t < j.crouch) {
        pivot.position.copy(j.a);
        squash(1 - 0.28 * Math.sin((t / j.crouch) * Math.PI * 0.5));
        lean(0);
      } else if (t < j.crouch + j.air) {
        const k = (t - j.crouch) / j.air;
        pivot.position.lerpVectors(j.a, j.b, k);
        pivot.position.y = THREE.MathUtils.lerp(j.a.y, j.b.y, k) + 4 * j.h * k * (1 - k) * (1 - 0.15 * k);
        squash(1 + 0.22 * Math.cos(k * Math.PI));
        lean(-j.dir * THREE.MathUtils.lerp(0.3, 0, easeOut(k)));   // lean the way it's going
      } else if (t < j.crouch + j.air + j.land) {
        pivot.position.copy(j.b);
        squash(1 - 0.3 * Math.sin(((t - j.crouch - j.air) / j.land) * Math.PI * 0.5));
        lean(0);
      } else {
        const k = Math.min(1, (t - j.crouch - j.air - j.land) / j.settle);
        pivot.position.copy(j.b);
        squash(1 - 0.3 * Math.cos(k * Math.PI * 2.2) * Math.pow(1 - k, 2));
      }
    }

    function pose(t) {
      if (reduceMotion) { pivot.position.copy(rest); squash(1); lean(0); return; }
      if (t < T.delay) { pivot.position.copy(from); squash(1); lean(0); return; }   // standing on the floor
      t -= T.delay;
      for (const j of legs) {
        if (t < j.dur) { jumpPose(j, t); return; }
        t -= j.dur;
      }
      pivot.position.copy(rest);   // in its place on the sofa (the room sets up meanwhile)
      squash(1);
      lean(0);
    }

    // First pose (AK on the floor), then compile before the clock starts, so
    // the first frames aren't a hitch.
    pose(freezeAt != null ? freezeAt : 0);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    // The clock moves at most MAX_STEP per frame: if frames stall, the jump
    // waits instead of skipping ahead.
    const MAX_STEP = 1 / 30;
    let last = null, clock = 0;
    let landed = false;
    tick = (now) => {
      if (last !== null) clock += Math.min((now - last) / 1000, MAX_STEP);
      last = now;
      const t = freezeAt != null ? freezeAt : clock;
      pose(t);
      if (!landed && (t >= tEnd || reduceMotion)) { landed = true; if (onLanded) onLanded(); }
      renderer.render(scene, camera);
    };
    if (onReady) onReady();
    loop();
  }, undefined, (err) => { if (onError) onError(err); });

  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(() => f(performance.now()), 16);
  function loop() {
    if (!running) return;
    raf((now) => { if (!running) return; tick(now); loop(); });
  }

  return {
    resize(w, h) { size = [w, h]; fit(); },
    stop() {
      running = false;
      renderer.dispose();
      pmrem.dispose();
    },
  };
}
