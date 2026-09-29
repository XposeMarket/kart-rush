import * as THREE from './vendor/three.module.js';
import { grassTex } from './track.js';

// Theme set dressing: sky dome, ground, lights, instanced props placed safely off-track.
function skyDome(top, bottom) {
  const geo = new THREE.SphereGeometry(1800, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+.15,0.,1.); gl_FragColor = vec4(mix(bottom, top, h),1.); }'
  });
  return new THREE.Mesh(geo, mat);
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
  scene.fog = new THREE.Fog(def.fog, def.theme === 'rainbow' ? 200 : 180, def.theme === 'lava' ? 520 : 900);
  g.add(skyDome(def.sky[0], def.sky[1]));

  const night = def.theme === 'rainbow' || def.theme === 'lava';
  const lava = def.theme === 'lava';
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
    const trunk = new THREE.MeshToonMaterial({ color: '#7a4a24' }), leaf = new THREE.MeshToonMaterial({ color: '#2f9e3a' }), leaf2 = new THREE.MeshToonMaterial({ color: '#46c04b' });
    const pts = scatter(track, 180, 6, 90);
    g.add(instanced(new THREE.CylinderGeometry(0.6, 0.9, 5, 8).translate(0, 2.5, 0), trunk, pts));
    g.add(instanced(new THREE.SphereGeometry(3.6, 12, 10).translate(0, 7, 0), leaf, pts));
    g.add(instanced(new THREE.SphereGeometry(2.4, 10, 8).translate(1.5, 9, 0.8), leaf2, pts));
    const bushes = scatter(track, 120, 2, 20).map(p => (p.s = 0.8 + Math.random() * 0.8, p));
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
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#ff4a00', emissive: '#ff3300', emissiveIntensity: 1.1, roughness: 0.6 }));
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
  return { group: g, sun, update(t, focus) { sun.position.set(focus.x + 60, focus.y + 120, focus.z + 40); sun.target.position.copy(focus); if (g.userData.lava) g.userData.lava.material.emissiveIntensity = 1 + Math.sin(t * 2) * 0.2; } };
}

function addClouds(g, color) {
  const mat = new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.95 });
  for (let k = 0; k < 22; k++) {
    const c = new THREE.Group(), a = Math.random() * Math.PI * 2, r = 400 + Math.random() * 500;
    for (let j = 0; j < 4; j++) { const puff = new THREE.Mesh(new THREE.SphereGeometry(20 + Math.random() * 16, 10, 8), mat); puff.position.set(j * 26 - 40, Math.random() * 8, Math.random() * 10); c.add(puff); }
    c.position.set(Math.cos(a) * r, 150 + Math.random() * 90, Math.sin(a) * r); g.add(c);
  }
}
