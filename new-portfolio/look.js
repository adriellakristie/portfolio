/*
 * look.js — materials from the original Maya settings (models/materials.json)
 * and lights at the positions of the original Maya lights.
 *
 * The model's geometry is used exactly as exported: nothing here moves,
 * reshapes or replaces a mesh.
 */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const TEXTURE_DIR = 'models/textures/';

// materials.json points at files in the Maya project; the copies live in
// models/textures, sometimes re-saved as JPEG to keep the page light.
const TEXTURE_FILES = {
  'wood-floor': 'wood-floor.jpg',
  'wall-texture-2': 'wall-texture-2.jpg',
  'wall-texture-3': 'wall-texture-3.jpg',
  'Gemini_Generated_Image_j6e0omj6e0omj6e0': 'Gemini_Generated_Image_j6e0omj6e0omj6e0.jpeg',
  'VTP469K-5_d3ae7f72-8c48-4a25-b77c-6aafe49d71e8_1600x 2': 'VTP469K-5_d3ae7f72-8c48-4a25-b77c-6aafe49d71e8_1600x 2.jpg',
  'Intricate Ivory Lace Doily Frame': 'Intricate Ivory Lace Doily Frame.png',
};

function textureUrl(path) {
  const file = path.split('/').pop();
  const stem = file.replace(/\.[^.]+$/, '');
  return TEXTURE_DIR + encodeURIComponent(TEXTURE_FILES[stem] || file);
}

// "floor" matches floor, floor.001, floor_1 — but "pSphere1" does not match "pSphere10".
// three.js strips dots from names on load, so compare against the original
// name GLTFLoader keeps in userData.
function nameMatches(object, target) {
  const name = object.userData.name ?? object.name;
  return name === target || name.startsWith(target + '.') || name.startsWith(target + '_');
}

// The export dropped UVs on some textured meshes. Give those (and only those)
// planar UVs fitted to the mesh, one projection per face direction, which is
// what Maya's default plane/cube UVs look like. Shapes are untouched.
function fitUVs(mesh) {
  const g = mesh.geometry;
  if (!g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const size = new THREE.Vector3().subVectors(max, min);
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const drop = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;
    const [a, b] = axes.filter((_, k) => k !== drop);
    const v = { x: p.getX(i), y: p.getY(i), z: p.getZ(i) };
    uv[i * 2] = size[a] ? (v[a] - min[a]) / size[a] : 0;
    uv[i * 2 + 1] = size[b] ? (v[b] - min[b]) / size[b] : 0;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ─────────────────────────────────────────
// Materials
// ─────────────────────────────────────────
export async function applyMaterials(model, url, renderer) {
  let json;
  try {
    json = await (await fetch(url)).json();
  } catch (err) {
    console.warn('[room] Could not load ' + url + '; keeping the GLB materials.', err);
    return;
  }

  const loader = new THREE.TextureLoader();
  const textures = new Map();
  const loadTexture = (path) => {
    if (!textures.has(path)) {
      const t = loader.load(textureUrl(path), undefined, undefined,
        () => console.warn('[room] Texture not found: ' + textureUrl(path)));
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false;                       // glTF UV convention
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.set(path, t);
    }
    return textures.get(path);
  };

  // Which JSON entries apply to each mesh.
  const nodes = [];
  model.traverse((o) => nodes.push(o));
  const candidates = new Map();             // mesh -> [entry key]
  for (const [key, entry] of Object.entries(json)) {
    for (const target of entry.objects || []) {
      const hits = nodes.filter((o) => nameMatches(o, target));
      if (!hits.length) { console.warn(`[room] materials.json: "${target}" (${key}) is not in the GLB.`); continue; }
      let meshes = 0;
      for (const hit of hits) {
        hit.traverse((m) => {
          if (!m.isMesh) return;
          meshes++;
          if (!candidates.has(m)) candidates.set(m, []);
          if (!candidates.get(m).includes(key)) candidates.get(m).push(key);
        });
      }
      if (!meshes) console.warn(`[room] materials.json: "${target}" (${key}) is in the GLB but has no geometry.`);
    }
  }

  // Report meshes that got nothing from materials.json.
  const unmatched = [];
  model.traverse((m) => {
    if (!m.isMesh || candidates.has(m) || !isShown(m)) return;
    unmatched.push(`${m.userData.name ?? m.name} (material: ${m.material ? m.material.name || 'unnamed' : 'none'}, parent: ${m.parent ? m.parent.userData.name ?? m.parent.name : '-'})`);
  });
  if (unmatched.length) console.warn(`[room] ${unmatched.length} mesh(es) have no match in materials.json:\n  ` + unmatched.join('\n  '));

  const cache = new Map();
  for (const [mesh, keys] of candidates) {
    // Objects with several Maya materials were split into one primitive per
    // material, and each primitive kept its Maya material name.
    const old = mesh.material;
    const key = keys.find((k) => old && old.name === k) || keys[0];
    const entry = json[key];
    const glbMap = old && old.map ? old.map : null;
    const glbNormal = old && old.normalMap ? old.normalMap : null;
    const jsonMap = !glbMap && entry.texture ? loadTexture(entry.texture) : null;

    const cacheKey = [key, glbMap && glbMap.uuid, glbNormal && glbNormal.uuid].join('|');
    if (!cache.has(cacheKey)) {
      const m = new THREE.MeshPhysicalMaterial({
        name: key,
        roughness: entry.roughness ?? 0.5,
        metalness: entry.metalness ?? 0,
        clearcoat: entry.clearcoat ?? 0,
        clearcoatRoughness: entry.clearcoatRoughness ?? 0,
        specularIntensity: entry.specular ?? 1,
        side: old ? old.side : THREE.FrontSide,
      });
      if (glbMap || jsonMap) m.map = glbMap || jsonMap;   // the texture carries the color
      else m.color.setRGB(...entry.color, THREE.LinearSRGBColorSpace);   // materials.json colours are linear
      if (m.map && m.map.colorSpace !== THREE.SRGBColorSpace) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true; }
      if (glbNormal) m.normalMap = glbNormal;
      cache.set(cacheKey, m);
    }
    if (jsonMap && !mesh.geometry.attributes.uv) fitUVs(mesh);
    mesh.material = cache.get(cacheKey);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
}

// ─────────────────────────────────────────
// Hand-tuned looks for pieces whose materials.json values read flat in the
// browser (grey/white without Arnold's lighting). Matched by Maya name; each
// keeps any texture map the GLB gave it.
// ─────────────────────────────────────────
const OVERRIDES = [
  // White lacquer with a glossy coat (the TV stand and the record player's table).
  { label: 'TV stand', objects: ['table', 'vinyl_table'], make: (map) => new THREE.MeshPhysicalMaterial({ map, color: map ? 0xffffff : 0xdedad5, metalness: 0.15, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 }) },
  // Yellow plastic, from materials.json (openPBRSurface45), with a lacquer
  // coat and a faint inner glow like the lit lamp in the render.
  { label: 'mushroom lamp', objects: ['pCylinder30', 'pCylinder32', 'pSphere27'], make: (map) => {
    const m = new THREE.MeshPhysicalMaterial({ map, metalness: 0, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.08, sheen: 0.3, sheenColor: 0xfff0c0 });
    m.color.setRGB(0.578, 0.4704, 0.215, THREE.LinearSRGBColorSpace);
    m.emissive.setRGB(0.578, 0.4704, 0.215, THREE.LinearSRGBColorSpace);
    m.emissiveIntensity = 0.12;
    return m;
  } },
  // Mirror-polished chrome lettering; its reflection is captured from its
  // own position in room.js (mirrorName).
  { label: 'name text', objects: ['typeMesh1'], make: (map) => new THREE.MeshPhysicalMaterial({ map, color: map ? 0xffffff : 0xf6f3f0, metalness: 1, roughness: 0.03, envMapIntensity: 2.2 }) },
  // Glossy orange leather, like the render (materials.json reads mustard).
  { label: 'sofa', objects: ['polySurface1', 'polySurface3', 'polySurface5', 'polySurface6'], make: (map) => {
    const m = new THREE.MeshPhysicalMaterial({ map, metalness: 0, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.12 });
    if (!map) m.color.setRGB(0.62, 0.17, 0.012, THREE.LinearSRGBColorSpace);
    return m;
  } },
  // Lacquered wood floor that mirrors the room's lights.
  { label: 'floor', objects: ['pasted__floor'], make: (map) => new THREE.MeshPhysicalMaterial({ map, color: map ? 0xffffff : 0x5a2412, metalness: 0, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 }) },
  // Frosted smoked acrylic: half see-through with a glossy outer coat, so
  // the lid reads as translucent rather than clear glass. (Plain opacity,
  // not transmission: transmission re-renders the whole room every frame.)
  { label: 'record player lid', objects: ['pCube9'], make: (map) => new THREE.MeshPhysicalMaterial({ map, color: 0xe6dccf, metalness: 0, roughness: 0.4, transparent: true, opacity: 0.5, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05 }) },
];

export function applyOverrides(model) {
  for (const { label, objects, make } of OVERRIDES) {
    let count = 0;
    const made = new Map();
    model.traverse((o) => {
      if (!o.isMesh) return;
      const base = (o.userData.name ?? o.name).replace(/\.\d+$/, '');
      const parentBase = o.parent ? (o.parent.userData.name ?? o.parent.name).replace(/\.\d+$/, '') : '';
      if (!objects.includes(base) && !objects.includes(parentBase)) return;
      const map = o.material && o.material.map ? o.material.map : null;
      // Keep the model's sidedness: the exports are double-sided, and some
      // faces (e.g. the TV stand's back and bottom) point inward.
      const side = o.material ? o.material.side : THREE.FrontSide;
      const key = (map ? map.uuid : 'none') + '|' + side;
      if (!made.has(key)) { const m = make(map); m.side = side; made.set(key, m); }
      o.material = made.get(key);
      count++;
    });
    if (!count) console.warn(`[room] Override for the ${label} found no objects named ${objects.join(', ')}.`);
  }
}

// ─────────────────────────────────────────
// Lights from models/lights.json, exported from Maya.
// Positions are in Maya units; they are mapped into the (scaled) room by
// matching the Maya ceiling bounding box to the GLB ceiling. Every light's
// three.js intensity is one global factor × its Maya effective_intensity, so
// the ratios between lights match Maya.
// ─────────────────────────────────────────
const LAMP_FADE = 0.6;              // seconds
const AREA_CONE = THREE.MathUtils.degToRad(60);
const MERGE_ABOVE = 10;             // merge nearby lights when there are more than this many
const DEFAULT_FACTOR = 0.06;   // tuned against the reference render; adjust live in ?debug

export async function loadLights(scene, model, url) {
  let json;
  try {
    json = await (await fetch(url)).json();
  } catch (err) {
    console.warn('[room] Could not load ' + url + '; the room will only have reflections.', err);
    return null;
  }

  // ── Maya → scene mapping from the ceiling's bounding box ──
  const ceilingObj = findByBaseName(model, 'ceiling');
  const ref = json.reference && json.reference.ceiling;
  if (!ceilingObj || !ref) {
    console.warn('[room] lights.json needs a "ceiling" reference box and the GLB a "ceiling" object to place lights.');
    return null;
  }
  const glb = new THREE.Box3().setFromObject(ceilingObj);
  const mMin = new THREE.Vector3(ref[0], ref[1], ref[2]);
  const mMax = new THREE.Vector3(ref[3], ref[4], ref[5]);
  const gSize = glb.getSize(new THREE.Vector3()), mSize = new THREE.Vector3().subVectors(mMax, mMin);
  const scale = (gSize.x / mSize.x + gSize.z / mSize.z) / 2;     // uniform; the ceiling is too thin to use y
  const offset = glb.getCenter(new THREE.Vector3()).sub(mMin.clone().add(mMax).multiplyScalar(0.5 * scale));
  const toScene = (p) => new THREE.Vector3(...p).multiplyScalar(scale).add(offset);

  // ── Entries → light descriptions ──
  const visible = json.lights.filter((l) => l.visible !== false);
  const areas = visible.filter((l) => /arealight/i.test(l.type));
  const useRect = areas.length > 0 && areas.length <= 4;
  let defs = visible.map((l) => ({
    names: [l.name],
    type: /arealight/i.test(l.type) ? (useRect ? 'rect' : 'spot') : l.type.replace(/Light$/, ''),
    position: toScene(l.position),
    direction: new THREE.Vector3(...(l.direction || [0, -1, 0])).normalize(),
    color: new THREE.Color().setRGB(...l.color, THREE.LinearSRGBColorSpace),
    effective: l.effective_intensity ?? l.intensity ?? 1,
    size: l.size ? l.size.map((v) => v * scale) : null,
    cone: l.cone_angle != null ? THREE.MathUtils.degToRad(l.cone_angle) : null,
    penumbra: l.penumbra_angle != null ? THREE.MathUtils.degToRad(l.penumbra_angle) : null,
  }));
  const skipped = json.lights.length - visible.length;
  if (skipped) console.info(`[room] ${skipped} light(s) in lights.json are hidden in Maya and were skipped.`);

  // ── The lamp: the light nearest the arc lamp's shade ──
  const shade = findByBaseName(model, 'lamp_shade') || findByBaseName(model, 'lamp');
  let lampDef = null;
  if (shade) {
    const c = new THREE.Box3().setFromObject(shade).getCenter(new THREE.Vector3());
    lampDef = defs.reduce((best, d) => (!best || d.position.distanceTo(c) < best.position.distanceTo(c) ? d : best), null);
  }

  // ── Merge lights that sit close together and point the same way ──
  if (defs.length > MERGE_ABOVE) {
    const roomSize = new THREE.Box3().setFromObject(ceilingObj).getSize(new THREE.Vector3()).length();
    const near = roomSize * 0.1;
    const merged = [];
    for (const d of defs) {
      const into = d === lampDef ? null : merged.find((m) => m !== lampDef && m.type === d.type
        && (d.type === 'directional' || m.position.distanceTo(d.position) < near)
        && m.direction.dot(d.direction) > 0.9);
      if (!into) { merged.push({ ...d, position: d.position.clone(), direction: d.direction.clone(), color: d.color.clone() }); continue; }
      const w = d.effective / (into.effective + d.effective);
      into.position.lerp(d.position, w);
      into.direction.lerp(d.direction, w).normalize();
      into.color.lerp(d.color, w);
      into.effective += d.effective;
      into.names.push(...d.names);
    }
    if (merged.length < defs.length) console.info(`[room] Merged ${defs.length} lights into ${merged.length}.`);
    lampDef = merged.find((m) => lampDef && m.names.includes(lampDef.names[0])) || null;
    defs = merged;
  }

  // ── Keep lights off surfaces: lights.json puts a few right against (or
  // inside) geometry, which shows up as hard hotspots. Push them out to
  // MIN_GAP, or drop them if that fails or they sit under the floor. The lamp
  // light is meant to sit inside its shade, so it is left alone. ──
  defs = clearLightsOfSurfaces(defs, model, lampDef);

  // ── Wall washes: the soft scalloped arcs on the upper walls in the render ──
  defs.push(...wallWashes(model));

  // ── Build them ──
  if (useRect) RectAreaLightUniformsLib.init();
  const lights = defs.map((d) => {
    let light;
    if (d.type === 'rect') {
      const [w, h] = d.size || [1, 1];
      light = new THREE.RectAreaLight(d.color, 0, w, h);
      light.position.copy(d.position);
      light.lookAt(d.position.clone().add(d.direction));
    } else if (d.type === 'spot') {
      const angle = d.cone ? Math.min(d.cone / 2, Math.PI / 2 - 0.01) : AREA_CONE;
      const penumbra = d.penumbraRatio ?? (d.cone && d.penumbra != null ? THREE.MathUtils.clamp(Math.abs(d.penumbra) / (d.cone / 2), 0, 1) : 0.8);
      light = new THREE.SpotLight(d.color, 0, 0, angle, penumbra, 2);
      light.position.copy(d.position);
      light.target.position.copy(d.position).add(d.direction);
      scene.add(light.target);
    } else if (d.type === 'point') {
      light = new THREE.PointLight(d.color, 0, 0, 2);
      light.position.copy(d.position);
    } else if (d.type === 'directional') {
      light = new THREE.DirectionalLight(d.color, 0);
      light.position.copy(d.position);
      light.target.position.copy(d.position).add(d.direction);
      scene.add(light.target);
    } else {
      console.warn(`[room] Unsupported light type "${d.type}" for ${d.names.join(', ')}.`);
      return null;
    }
    light.name = d.names.join(' + ');
    scene.add(light);
    return { def: d, light };
  }).filter(Boolean);

  // Shadows only from the arc lamp.
  const lamp = lampDef ? lights.find((l) => l.def === lampDef) : null;
  if (lamp && lamp.light.shadow) {
    lamp.light.castShadow = true;
    lamp.light.shadow.mapSize.set(1024, 1024);
    lamp.light.shadow.bias = -0.0005;
    lamp.light.shadow.normalBias = 0.02;
    lamp.light.shadow.camera.near = 0.05;
  }

  let factor = DEFAULT_FACTOR;
  let lampLevel = 1, lampTarget = 1;
  const apply = () => {
    for (const { def, light } of lights) {
      const level = def === lampDef ? lampLevel * lampLevel * (3 - 2 * lampLevel) : 1;
      light.intensity = factor * def.effective * level;
    }
  };
  apply();

  return {
    list: lights,
    lampName: lamp ? lamp.light.name : null,
    get factor() { return factor; },
    setFactor(f) { factor = f; apply(); },
    get lampOn() { return lampTarget > 0; },
    setLamp(on) { lampTarget = on ? 1 : 0; },
    // Fades the lamp toward its target; returns true while it is changing.
    update(dt) {
      if (lampLevel === lampTarget || !lamp) return false;
      const step = dt / LAMP_FADE;
      lampLevel = lampTarget > lampLevel ? Math.min(lampTarget, lampLevel + step) : Math.max(lampTarget, lampLevel - step);
      apply();
      return true;
    },
  };
}

const MIN_GAP = 0.3;   // closest a light may sit to a surface, in scene units

function clearLightsOfSurfaces(defs, model, keep) {
  const meshes = [];
  model.traverse((o) => { if (o.isMesh && isShown(o)) meshes.push(o); });
  const floor = findByBaseName(model, 'floor');
  const floorY = floor ? new THREE.Box3().setFromObject(floor).max.y : -Infinity;
  // Directions spread evenly over a sphere.
  const dirs = Array.from({ length: 64 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 64, r = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5));
    return new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
  });
  const ray = new THREE.Raycaster();
  ray.far = MIN_GAP;
  const nearestHit = (p) => {
    let best = null;
    for (const d of dirs) {
      ray.set(p, d);
      const h = ray.intersectObjects(meshes, false)[0];
      if (h && (!best || h.distance < best.distance)) best = h;
    }
    return best;
  };

  const out = [];
  for (const d of defs) {
    const label = d.names.join(' + ');
    if (d === keep) { out.push(d); continue; }
    if (d.type === 'directional') {
      // A sun outside the room is shadowed by the walls in Maya; here only the
      // lamp casts shadows, so it would shine straight through them.
      const centre = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
      const back = new THREE.Raycaster(centre, d.direction.clone().negate());
      if (back.intersectObjects(meshes, false).length) { console.warn(`[room] Directional light "${label}" comes from outside the walls; without its shadows it would light through them, so it was removed.`); continue; }
      out.push(d);
      continue;
    }
    if (d.position.y < floorY) { console.warn(`[room] Light "${label}" is below the floor; removed.`); continue; }
    const from = d.position.clone();
    let hit = nearestHit(d.position), tries = 0;
    while (hit && tries++ < 4) {
      const away = d.position.clone().sub(hit.point);
      if (away.lengthSq() < 1e-8 && hit.face) away.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      d.position.copy(hit.point).addScaledVector(away.normalize(), MIN_GAP + 0.05);
      hit = nearestHit(d.position);
    }
    if (hit) { console.warn(`[room] Light "${label}" is boxed in by geometry; removed.`); continue; }
    if (!from.equals(d.position)) console.info(`[room] Light "${label}" was ${MIN_GAP} or closer to a surface; moved ${from.distanceTo(d.position).toFixed(2)} away.`);
    out.push(d);
  }
  return out;
}

// Spotlights near the ceiling, MIN_GAP off the back and left walls, aimed
// down at a slight angle so each throws a scalloped arc onto the wall.
const WASH = { cone: THREE.MathUtils.degToRad(35), penumbra: 0.5, effective: 150, color: [1, 0.72, 0.45], drop: 1.1 };

function wallWashes(model) {
  const box = (name) => { const o = findByBaseName(model, name); return o ? new THREE.Box3().setFromObject(o) : null; };
  const back = box('wall2'), left = box('wall1'), ceiling = box('ceiling'), floor = box('floor');
  if (!back || !left || !ceiling || !floor) { console.warn('[room] Wall washes need wall2, wall1, ceiling and floor; skipped.'); return []; }
  const y = ceiling.min.y - 0.15;
  const spread = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 0.5)) / n);
  const make = (name, pos, aim) => ({
    names: [name], type: 'spot', position: pos, direction: aim.clone().sub(pos).normalize(),
    color: new THREE.Color().setRGB(...WASH.color, THREE.LinearSRGBColorSpace),
    effective: WASH.effective, cone: WASH.cone, penumbraRatio: WASH.penumbra, size: null,
  });
  const washes = [];
  const bx = back.max.x;   // back wall's face, looking into the room (+X)
  spread(floor.min.z + 0.4, floor.max.z - 0.4, 4).forEach((z, i) =>
    washes.push(make(`wallwash_back_${i + 1}`, new THREE.Vector3(bx + MIN_GAP, y, z), new THREE.Vector3(bx, y - WASH.drop, z))));
  const lz = left.min.z;   // left wall's face, looking into the room (−Z)
  spread(bx + 0.5, Math.min(left.max.x, floor.max.x) - 0.4, 3).forEach((x, i) =>
    washes.push(make(`wallwash_left_${i + 1}`, new THREE.Vector3(x, y, lz - MIN_GAP), new THREE.Vector3(x, y - WASH.drop, lz))));
  return washes;
}

function isShown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function findByBaseName(root, base) {
  let found = null;
  root.traverse((o) => {
    if (!found && (o.userData.name ?? o.name).replace(/^(pasted__)+/, '').replace(/\.\d+$/, '') === base) found = o;
  });
  return found;
}

// ─────────────────────────────────────────
// Lens finish: a warm grade, a soft vignette and barely-there grain.
// ─────────────────────────────────────────
export const FilmShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.012 }, vignette: { value: 0.55 },
    // A warm grade like the Arnold render's: pushes the sofa from mustard to
    // orange and the walls toward deep red-brown.
    tint: { value: new THREE.Vector3(1.0, 0.9, 0.78) }, saturation: { value: 1.08 },
    // A filmic S-curve: deeper shadows and brighter highlights, so the room
    // reads like the photographic render rather than flat and cartoony.
    contrast: { value: 0.35 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, grain, vignette, saturation, contrast;
    uniform vec3 tint;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 c = base.rgb * tint;
      c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, saturation);
      vec3 s = clamp(c, 0.0, 1.0);
      c = mix(c, s * s * (3.0 - 2.0 * s), contrast);
      c *= mix(1.0, smoothstep(0.95, 0.25, length(d * vec2(1.1, 1.0))), vignette);
      c += (rand(vUv * vec2(1931.0, 1171.0) + fract(time)) - 0.5) * grain;
      // Keep the see-through background see-through (the page's white shows behind the room).
      gl_FragColor = vec4(c * base.a, base.a);
    }`,
};
