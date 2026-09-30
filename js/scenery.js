import * as THREE from './vendor/three.module.js';
import { grassTex } from './track.js';

// Theme set dressing: sky dome, ground, lights, instanced props placed safely off-track.
// Gradient sky with a soft sun disc + halo and horizon haze. Follows the camera so it never clips.
function skyDome(top, bottom, sunDir, sunColor, haze) {
  const geo = new THREE.SphereGeometry(1800, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) }, sunDir: { value: sunDir.clone().normalize() }, sunColor: { value: new THREE.Color(sunColor) }, haze: { value: new THREE.Color(haze) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, bottom, sunDir, sunColor, haze; varying vec3 vD;
      void main(){
        float h = clamp(vD.y * 1.5 + 0.12, 0., 1.);
        vec3 c = mix(bottom, top, pow(h, 0.8));
        c = mix(c, haze, pow(1. - abs(vD.y), 10.) * 0.6);
        float d = max(dot(vD, sunDir), 0.);
        c += sunColor * (pow(d, 900.) * 3.5 + pow(d, 40.) * 0.35 + pow(d, 6.) * 0.12);
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -10; m.frustumCulled = false; return m;
}

// Soft 3-band toon ramp shared by all toon materials in the world.
let ramp;
export function toonRamp() {
  if (ramp) return ramp;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true; return ramp;
}

function instanced(geo, material, list, scaleJitter = 0.3) {
  const m = new THREE.InstancedMesh(geo, material, list.length);
  const o = new THREE.Object3D();
  list.forEach((p, i) => { o.position.copy(p); o.rotation.set(0, Math.random() * 6.28, 0); o.scale.setScalar(p.s || (1 + (Math.random() - 0.5) * scaleJitter)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.castShadow = true; m.receiveShadow = true; return m;
}

// Spots around the track at a lateral offset band, rejected if too close to any road sample.
function scatter(track, count, minOff, maxOff, seedStep = 1) {
  const out = [], { samples, N, edge } = track;
  const clear2 = (edge + 4) ** 2;
  for (let k = 0; k < count * 3 && out.length < count; k++) {
    const i = Math.floor(Math.random() * N), s = samples[i];
    const lat = (Math.random() < 0.5 ? -1 : 1) * (edge + minOff + Math.random() * (maxOff - minOff));
    const p = new THREE.Vector3(s.p.x + s.r.x * lat, 0, s.p.z + s.r.z * lat);
    let ok = true;
    for (let j = 0; j < N; j += 3 * seedStep) { const q = samples[j].p, dx = q.x - p.x, dz = q.z - p.z; if (dx * dx + dz * dz < clear2) { ok = false; break; } }
    if (ok) out.push(p);
  }
  return out;
}

export function buildScenery(track, scene) {
  const def = track.def, g = new THREE.Group();
  scene.background = new THREE.Color(def.sky[1]);
  const snowy = def.theme === 'snow';
  scene.fog = new THREE.Fog(snowy ? '#cfdcf0' : def.fog, def.theme === 'rainbow' ? 200 : snowy ? 260 : 180, def.theme === 'lava' ? 520 : snowy ? 1300 : 900);
  const night = def.theme === 'rainbow' || def.theme === 'lava';
  const lava = def.theme === 'lava';
  const sunDir = new THREE.Vector3(0.45, night ? 0.12 : 0.32, 0.3);
  const sky = skyDome(def.sky[0], def.sky[1], sunDir, lava ? '#ff7a2a' : night ? '#ff9ae8' : '#fff1c9', lava ? '#ff5a1a' : night ? '#6a2aa8' : '#ffffff');
  g.add(sky); g.userData.sky = sky;
  const hemi = new THREE.HemisphereLight(lava ? '#ffd9c2' : night ? '#a99bff' : '#dff2ff', lava ? '#6a2410' : night ? '#3a1a40' : '#4a6b2a', lava ? 1.5 : night ? 1.2 : 1.25); g.add(hemi);
  const sun = new THREE.DirectionalLight(lava ? '#ffc79a' : night ? '#ffd6f0' : '#fff4df', lava ? 2.3 : night ? 1.8 : 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.near = 10; sc.far = 320; sun.shadow.bias = -0.0006;
  g.add(sun); g.add(sun.target);

  if (def.ground) {
    const tex = grassTex(def.ground, def.ground2); tex.repeat.set(160, 160);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.25; ground.receiveShadow = true; g.add(ground);
  }

  const theme = def.theme;
  if (theme === 'meadow') {
    const gm = toonRamp();
    // Pick the lake first so trees / flowers / bushes never spawn in the water.
    const lakeSpot = scatter(track, 1, 70, 110)[0];
    const dry = p => !lakeSpot || Math.hypot(p.x - lakeSpot.x, p.z - lakeSpot.z) > 64;
    const trunk = new THREE.MeshToonMaterial({ color: '#7a4a24', gradientMap: gm }), leaf = new THREE.MeshToonMaterial({ color: '#2f9e3a', gradientMap: gm }), leaf2 = new THREE.MeshToonMaterial({ color: '#5fd04f', gradientMap: gm });
    const pts = scatter(track, 200, 6, 90).filter(dry);
    // Round-canopy trees (two blob layers) and tall cone poplars for silhouette variety.
    const round = pts.filter((p, i) => i % 3), tall = pts.filter((p, i) => !(i % 3));
    g.add(instanced(new THREE.CylinderGeometry(0.55, 0.9, 5, 8).translate(0, 2.5, 0), trunk, pts));
    g.add(instanced(new THREE.IcosahedronGeometry(3.8, 1).translate(0, 7, 0), leaf, round));
    g.add(instanced(new THREE.IcosahedronGeometry(2.6, 1).translate(1.6, 9.2, 0.8), leaf2, round));
    g.add(instanced(new THREE.IcosahedronGeometry(2.2, 1).translate(-1.7, 8.4, -0.6), leaf2, round));
    g.add(instanced(new THREE.ConeGeometry(2.6, 10, 10).translate(0, 9, 0), leaf, tall));
    // Flower patches: tiny instanced petals in cheerful colors.
    const flowers = scatter(track, 500, 1, 40).filter(dry), fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 4).translate(0, 0.35, 0), new THREE.MeshToonMaterial({ gradientMap: gm }), flowers.length);
    const fo = new THREE.Object3D(), fc = new THREE.Color(), pal = ['#ff4f6d', '#ffd23f', '#ffffff', '#b06bff', '#ff8a2a'];
    flowers.forEach((p, i) => { fo.position.copy(p); fo.scale.setScalar(0.8 + Math.random() * 0.8); fo.updateMatrix(); fm.setMatrixAt(i, fo.matrix); fm.setColorAt(i, fc.set(pal[i % pal.length])); }); g.add(fm);
    // A sparkling lake off to the side of the course.
    if (lakeSpot) { const lake = new THREE.Mesh(new THREE.CircleGeometry(55, 48), flowMaterial('water')); lake.rotation.x = -Math.PI / 2; lake.position.copy(lakeSpot).setY(-0.05); g.add(lake); g.userData.water = lake;
      const shore = new THREE.Mesh(new THREE.RingGeometry(54, 60, 48), new THREE.MeshToonMaterial({ color: '#f1dc9a', gradientMap: gm })); shore.rotation.x = -Math.PI / 2; shore.position.copy(lakeSpot).setY(-0.1); g.add(shore); }
    const bushes = scatter(track, 120, 2, 20).filter(dry).map(p => (p.s = 0.8 + Math.random() * 0.8, p));
    g.add(instanced(new THREE.SphereGeometry(1.6, 10, 8).translate(0, 0.6, 0), leaf2, bushes));
    const pipeMat = new THREE.MeshStandardMaterial({ color: '#2bb44a', roughness: 0.35 });
    scatter(track, 10, 8, 30).forEach(p => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 20), pipeMat); pipe.position.copy(p).setY(2.5); pipe.castShadow = true; g.add(pipe);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 1.2, 20), pipeMat); lip.position.copy(p).setY(5.2); g.add(lip);
    });
    const hillMat = new THREE.MeshToonMaterial({ color: '#56b84a' });
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = 900 + Math.random() * 300; const h = new THREE.Mesh(new THREE.SphereGeometry(160 + Math.random() * 120, 20, 12), hillMat); h.position.set(Math.cos(a) * r, -60, Math.sin(a) * r); h.scale.y = 0.7; g.add(h); }
    addClouds(g, '#ffffff');
  } else if (theme === 'snow') {
    const pine = new THREE.MeshToonMaterial({ color: '#1f6b4a' }), snowCap = new THREE.MeshToonMaterial({ color: '#ffffff' });
    const pts = scatter(track, 220, 5, 100);
    g.add(instanced(new THREE.ConeGeometry(3.2, 9, 8).translate(0, 5, 0), pine, pts));
    g.add(instanced(new THREE.ConeGeometry(1.8, 3.2, 8).translate(0, 9, 0), snowCap, pts));
    const mtn = new THREE.MeshStandardMaterial({ color: '#a9b8d0', flatShading: true, roughness: 1 }), cap = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true });
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = 800 + Math.random() * 350, h = 260 + Math.random() * 220; const m = new THREE.Mesh(new THREE.ConeGeometry(180, h, 7), mtn); m.position.set(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r); g.add(m); const c = new THREE.Mesh(new THREE.ConeGeometry(70, h * 0.38, 7), cap); c.position.set(m.position.x, h - 20 - h * 0.19 + 2, m.position.z); g.add(c); }
    const snowmen = scatter(track, 8, 4, 16); const white = new THREE.MeshToonMaterial({ color: '#fff' });
    snowmen.forEach(p => { for (const [y, r] of [[1.2, 1.3], [3, 0.95], [4.4, 0.65]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), white); b.position.copy(p).setY(y); b.castShadow = true; g.add(b); } });
  } else if (theme === 'lava') {
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), flowMaterial('lava'));
    lava.rotation.x = -Math.PI / 2; lava.position.y = -1; g.add(lava); g.userData.lava = lava;
    const rock = new THREE.MeshStandardMaterial({ color: '#3a2521', flatShading: true, roughness: 1 });
    const pts = scatter(track, 90, 10, 120).map(p => (p.s = 1 + Math.random() * 3, p));
    g.add(instanced(new THREE.DodecahedronGeometry(3, 0).translate(0, 1.5, 0), rock, pts));
    const brick = new THREE.MeshStandardMaterial({ color: '#5c4f4b', roughness: 0.9 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = 700; const t = new THREE.Mesh(new THREE.CylinderGeometry(40, 50, 260, 8), brick); t.position.set(Math.cos(a) * r, 110, Math.sin(a) * r); g.add(t); const top = new THREE.Mesh(new THREE.ConeGeometry(55, 80, 8), new THREE.MeshStandardMaterial({ color: '#4a1010' })); top.position.set(t.position.x, 280, t.position.z); g.add(top); }
    const glow = new THREE.PointLight('#ff5a1a', 2, 600, 1.2); glow.position.set(0, 40, 0); g.add(glow);
  } else if (theme === 'rainbow') {
    const starGeo = new THREE.BufferGeometry(), pos = [];
    for (let k = 0; k < 3000; k++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 700); pos.push(v.x, Math.abs(v.y) * 0.9 - 200, v.z); }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.4, sizeAttenuation: false, fog: false })));
    const planet = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 24), new THREE.MeshStandardMaterial({ color: '#5a8bff', emissive: '#1a2a7a', roughness: 0.7 })); planet.position.set(-600, 150, -900); g.add(planet);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(260, 14, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffcf6a', fog: false })); ring.position.copy(planet.position); ring.rotation.x = 1.2; g.add(ring);
  }
  scene.add(g);
  return { group: g, sun, update(t, focus) {
    sun.position.set(focus.x + 60, focus.y + 120, focus.z + 40); sun.target.position.copy(focus);
    if (g.userData.sky) g.userData.sky.position.set(focus.x, 0, focus.z);
    if (g.userData.lava) g.userData.lava.material.uniforms.time.value = t;
    if (g.userData.water) g.userData.water.material.uniforms.time.value = t;
    if (g.userData.clouds) g.userData.clouds.rotation.y = t * 0.004;
  } };
}

function addClouds(g, color) {
  // Puffy cumulus: a flat-bottomed cluster of blobs, bright tops, slightly blue undersides.
  const mat = new THREE.MeshLambertMaterial({ color, emissive: '#e8efff', emissiveIntensity: 0.72, fog: false });
  const all = new THREE.Group(); g.add(all); g.userData.clouds = all;
  const blob = new THREE.IcosahedronGeometry(1, 2);
  for (let k = 0; k < 26; k++) {
    const c = new THREE.Group(), a = Math.random() * Math.PI * 2, r = 450 + Math.random() * 550;
    const n = 5 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) {
      const s = 16 + Math.random() * 22 * (1 - Math.abs(j - n / 2) / n);
      const puff = new THREE.Mesh(blob, mat); puff.scale.set(s, s * 0.8, s); puff.position.set((j - n / 2) * 20, Math.random() * 12 + s * 0.3, (Math.random() - 0.5) * 22); c.add(puff);
    }
    c.position.set(Math.cos(a) * r, 160 + Math.random() * 110, Math.sin(a) * r); c.lookAt(0, c.position.y, 0); all.add(c);
  }
}

// Animated liquid surfaces (lava flow with crust, sparkling water) as one small shader.
function flowMaterial(kind) {
  const lava = kind === 'lava';
  return new THREE.ShaderMaterial({
    fog: true, toneMapped: !lava,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, lava: { value: lava ? 1 : 0 } }]),
    vertexShader: ['varying vec2 vW;', '#include <fog_pars_vertex>', 'void main(){ vec4 wp = modelMatrix*vec4(position,1.); vW = wp.xz; vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;', '#include <fog_vertex>', '}'].join('\n'),
    fragmentShader: `uniform float time, lava; varying vec2 vW;
#include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a*n(p); p *= 2.03; a *= .5; } return v; }
      void main(){
        vec2 p = vW * 0.03;
        float f = fbm(p + vec2(time*0.05, time*0.03) + fbm(p*1.7 - time*0.04));
        vec3 c;
        if (lava > 0.5) {
          float crust = smoothstep(0.6, 0.7, f);
          vec3 hot = mix(vec3(1.0, 0.22, 0.0), vec3(1.25, 0.7, 0.08), smoothstep(0.3, 0.55, f));
          c = mix(hot * (0.92 + 0.12*sin(time*2.)), vec3(0.2, 0.07, 0.04), crust * 0.85);
        } else {
          c = mix(vec3(0.1, 0.45, 0.75), vec3(0.3, 0.75, 0.95), f);
          float sp = pow(n(vW*0.9 + time*1.3) * n(vW*1.1 - time*1.1), 6.) * 8.;
          c += vec3(sp);
        }
        gl_FragColor = vec4(c, 1.);
#include <fog_fragment>
      }`
  });
}
