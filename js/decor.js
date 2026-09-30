import * as THREE from './vendor/three.module.js';
import { mergeAll } from './merge.js';

// Extra set dressing that makes each course feel alive: chevron turn signs on the outside
// of sharp corners, grandstands with a crowd, arches over the road, and animated
// theme props (balloons, ? blocks, flowers, snowfall, lamps, lava bubbles, star rings).
const toon = c => new THREE.MeshToonMaterial({ color: c });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function flatDir(s) { return new THREE.Vector3(s.flat.x, 0, s.flat.z); }

export function buildDecor(track, scene) {
  const t = track, { samples, N, halfW, edge, def } = t, g = new THREE.Group(); scene.add(g);
  const anim = [];
  const theme = def.theme, night = theme === 'lava' || theme === 'rainbow';
  const far = (p, clear) => { for (let j = 0; j < N; j += 2) { const q = samples[j].p; if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < clear * clear) return false; } return true; };

  // ---- Chevron signs on the outside of sharp corners.
  const chevTex = canvasTex(128, 64, (c, w, h) => {
    c.fillStyle = theme === 'rainbow' ? '#1b0b3a' : '#e5322d'; c.fillRect(0, 0, w, h);
    c.fillStyle = theme === 'rainbow' ? '#4ff0ff' : '#ffffff';
    for (let k = 0; k < 3; k++) { const x = 18 + k * 36; c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 22, 32); c.lineTo(x, 56); c.lineTo(x + 10, 56); c.lineTo(x + 32, 32); c.lineTo(x + 10, 8); c.fill(); }
  });
  const chevMat = new THREE.MeshStandardMaterial({ map: chevTex, emissive: '#ffffff', emissiveMap: chevTex, emissiveIntensity: night ? 0.9 : 0.25, side: THREE.DoubleSide });
  const postMat = toon(theme === 'lava' ? '#3a2521' : '#dfe3ea');
  let lastSign = -99;
  for (let i = 0; i < N; i += 3) {
    const a = flatDir(samples[(i - 8 + N) % N]), b = flatDir(samples[(i + 8) % N]);
    const turn = a.angleTo(b); if (turn < 0.5 || i - lastSign < 14) continue;
    lastSign = i;
    const s = samples[i], d = b.clone().sub(a), side = -Math.sign(d.x * s.r.x + d.z * s.r.z) || 1;
    for (let k = -1; k <= 1; k++) {
      const j = (i + k * 5 + N) % N, sj = samples[j], lat = side * (edge + 2.2);
      const y = def.fall ? t.surfaceY(sj, side * edge) : Math.max(0, t.surfaceY(sj, side * edge));
      const sign = new THREE.Group();
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), chevMat); board.position.y = 2.4; sign.add(board);
      if (side > 0) board.scale.x = -1; // chevrons point into the corner
      for (const x of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5), postMat); p.position.set(x, 0, 0); sign.add(p); }
      sign.position.set(sj.p.x + sj.r.x * lat, y, sj.p.z + sj.r.z * lat);
      sign.rotation.y = sj.heading + Math.PI; g.add(sign);
    }
  }

  // ---- Arches over the road (tire / ice / castle / neon ring).
  const archMat = theme === 'rainbow' ? new THREE.MeshBasicMaterial({ color: '#4ff0ff', toneMapped: false })
    : theme === 'snow' ? new THREE.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.8, roughness: 0.1, emissive: '#6fb8ff', emissiveIntensity: 0.3 })
    : theme === 'lava' ? new THREE.MeshStandardMaterial({ color: '#5c4f4b', roughness: 0.9, flatShading: true })
    : new THREE.MeshStandardMaterial({ color: '#e5322d', roughness: 0.5 });
  const archCount = theme === 'rainbow' ? 10 : 5;
  for (let k = 1; k <= archCount; k++) {
    const i = Math.floor(N * (k / (archCount + 1))), s = samples[i];
    const arch = new THREE.Mesh(new THREE.TorusGeometry(halfW + 3, theme === 'rainbow' ? 0.35 : 0.9, 10, 40, Math.PI), archMat);
    arch.position.set(s.p.x, s.p.y - 0.5, s.p.z); arch.rotation.y = s.heading; arch.castShadow = theme !== 'rainbow';
    g.add(arch);
    if (theme === 'rainbow') anim.push(tm => arch.material.color.setHSL((tm * 0.2 + k / archCount) % 1, 1, 0.6));
  }

  // ---- Grandstand with a crowd near the start line.
  if (!def.fall) {
    const crowdCols = ['#e5322d', '#2fae3f', '#3d6bff', '#ffd23f', '#ff7fb7', '#ffffff', '#ff9a1f'];
    for (const side of [-1, 1]) {
      const i = (N - 22 + (side > 0 ? 10 : 0)) % N, s = samples[i], lat = side * (edge + 9);
      const p = new THREE.Vector3(s.p.x + s.r.x * lat, 0, s.p.z + s.r.z * lat); if (!far(p, edge + 6)) continue;
      const stand = new THREE.Group(); stand.position.copy(p); stand.rotation.y = s.heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      const standMat = toon(theme === 'snow' ? '#8aa0bd' : theme === 'lava' ? '#4a3a36' : '#9aa3ad');
      const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshToonMaterial(), 5 * 26);
      let n = 0; const o = new THREE.Object3D(), c = new THREE.Color();
      for (let row = 0; row < 5; row++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(26, 1, 1.6), standMat); step.position.set(0, row * 1 + 0.5, -row * 1.6); step.castShadow = step.receiveShadow = true; stand.add(step);
        for (let x = 0; x < 26; x++) { o.position.set(-12.5 + x + Math.random() * 0.3, row + 1.4, -row * 1.6); o.updateMatrix(); heads.setMatrixAt(n, o.matrix); heads.setColorAt(n++, c.set(crowdCols[(x * 7 + row * 3) % crowdCols.length])); }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.4, 9), toon('#e5322d')); roof.position.set(0, 8, -3.5); stand.add(roof);
      stand.add(heads); g.add(stand);
      anim.push(tm => { heads.position.y = Math.abs(Math.sin(tm * 6)) * 0.15; });
    }
  }

  // ---- Theme props.
  const scatterOff = (count, minOff, maxOff) => {
    const out = [];
    for (let k = 0; k < count * 4 && out.length < count; k++) {
      const s = samples[Math.floor(Math.random() * N)], lat = (Math.random() < 0.5 ? -1 : 1) * (edge + minOff + Math.random() * (maxOff - minOff));
      const p = new THREE.Vector3(s.p.x + s.r.x * lat, 0, s.p.z + s.r.z * lat); if (far(p, edge + minOff - 1)) out.push(p);
    }
    return out;
  };
  const instColored = (geo, pts, colors, yOf = () => 0) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial(), pts.length), o = new THREE.Object3D(), c = new THREE.Color();
    pts.forEach((p, n) => { o.position.set(p.x, yOf(p), p.z); o.rotation.y = Math.random() * 6; o.scale.setScalar(0.7 + Math.random() * 0.6); o.updateMatrix(); m.setMatrixAt(n, o.matrix); m.setColorAt(n, c.set(colors[n % colors.length])); });
    m.receiveShadow = true; g.add(m); return m;
  };

  if (theme === 'meadow') {
    instColored(new THREE.SphereGeometry(0.35, 6, 5).translate(0, 0.3, 0), scatterOff(500, 1.5, 40), ['#ff4f6d', '#ffd23f', '#ffffff', '#b36bff', '#ff9a1f']);
    // Giant mushrooms.
    scatterOff(14, 6, 30).forEach((p, n) => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(3.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(n % 2 ? '#e5322d' : '#3d6bff'));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 4, 12), toon('#fff3d6'));
      stem.position.copy(p).setY(2); cap.position.copy(p).setY(3.8); cap.castShadow = stem.castShadow = true; g.add(stem, cap);
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28, spot = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), toon('#ffffff')); spot.position.set(p.x + Math.cos(a) * 2.3, 5.9, p.z + Math.sin(a) * 2.3); spot.scale.y = 0.4; g.add(spot); }
    });
    // Floating ? blocks and hot air balloons.
    const qTex = canvasTex(64, 64, (c) => { c.fillStyle = '#ffb31a'; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#8a4a00'; c.lineWidth = 5; c.strokeRect(3, 3, 58, 58); c.fillStyle = '#fff'; c.font = '900 44px sans-serif'; c.textAlign = 'center'; c.fillText('?', 32, 48); });
    const qMat = new THREE.MeshStandardMaterial({ map: qTex, roughness: 0.5 });
    scatterOff(10, 4, 26).forEach((p, n) => { const b = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), qMat); b.position.copy(p).setY(9); b.castShadow = true; b.userData.dyn = true; g.add(b); anim.push(tm => { b.rotation.y = tm + n; b.position.y = 9 + Math.sin(tm * 1.5 + n) * 0.8; }); });
    const balloonCols = ['#e5322d', '#ffd23f', '#3d6bff', '#2fae3f', '#ff7fb7'];
    for (let k = 0; k < 7; k++) {
      const bal = new THREE.Group(), a = k / 7 * 6.28, r = 180 + Math.random() * 160;
      const env = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), toon(balloonCols[k % 5])); env.scale.y = 1.2; bal.add(env);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), toon('#8b5a2b')); basket.position.y = -14; bal.add(basket);
      bal.position.set(Math.cos(a) * r + 150, 70 + Math.random() * 40, Math.sin(a) * r); bal.userData.dyn = true; g.add(bal);
      anim.push(tm => { bal.position.y += Math.sin(tm * 0.4 + k) * 0.02; bal.rotation.y = tm * 0.1; });
    }
  } else if (theme === 'snow') {
    // Log cabins with warm windows, lamp posts, falling snow.
    scatterOff(8, 10, 40).forEach(p => {
      const cabin = new THREE.Group(); cabin.position.copy(p); cabin.rotation.y = Math.random() * 6;
      const body = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), toon('#7a4a24')); body.position.y = 2.5; cabin.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.6, 3.4, 4), toon('#ffffff')); roof.position.y = 6.7; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8; cabin.add(roof);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false })); win.position.set(0, 2.8, 3.01); cabin.add(win);
      cabin.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(cabin);
    });
    const flakes = new THREE.BufferGeometry(), fp = new Float32Array(1500 * 3);
    for (let k = 0; k < fp.length; k += 3) { fp[k] = (Math.random() - 0.5) * 160; fp[k + 1] = Math.random() * 60; fp[k + 2] = (Math.random() - 0.5) * 160; }
    flakes.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    const snow = new THREE.Points(flakes, new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, transparent: true, opacity: 0.9 })); snow.frustumCulled = false; g.add(snow);
    anim.push((tm, dt, focus) => { snow.position.set(focus.x, focus.y - 10, focus.z); for (let k = 1; k < fp.length; k += 3) { fp[k] -= dt * 6; if (fp[k] < 0) fp[k] += 60; } flakes.attributes.position.needsUpdate = true; });
    instColored(new THREE.OctahedronGeometry(1.2, 0).translate(0, 1.4, 0), scatterOff(60, 2, 30), ['#a8e4ff', '#d8f3ff', '#7fd0ff']);
  } else if (theme === 'lava') {
    // Podoboo fireballs jumping out of the lava, torches, spurting geysers.
    const fireMat = new THREE.MeshBasicMaterial({ color: '#ffb020', toneMapped: false });
    scatterOff(16, 8, 34).forEach((p, n) => {
      const fb = new THREE.Group(); fb.add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), fireMat));
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), toon('#111')); e.position.set(s * 0.45, 0.3, 1.1); fb.add(e); }
      fb.position.copy(p); fb.userData.dyn = true; g.add(fb);
      anim.push(tm => { const c = ((tm + n * 0.37) % 3) / 3, y = c < 0.6 ? Math.sin(c / 0.6 * Math.PI) * 16 : -3; fb.position.y = y; fb.rotation.x = c < 0.3 ? 0 : Math.PI; });
    });
    for (let i = 0; i < N; i += 24) {
      const s = samples[i];
      for (const side of [-1, 1]) {
        const lat = side * (edge + 1.2), y = t.surfaceY(s, side * edge);
        const torch = new THREE.Group(); torch.position.set(s.p.x + s.r.x * lat, y + 2.3, s.p.z + s.r.z * lat);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 8), fireMat); flame.position.y = 0.6; flame.userData.dyn = true; torch.add(flame);
        torch.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.15, 0.8, 8), toon('#2a2020')));
        g.add(torch); anim.push(tm => { flame.scale.set(1, 0.8 + Math.sin(tm * 14 + i) * 0.25, 1); });
      }
    }
  } else if (theme === 'rainbow') {
    // Star rings, twinkling star shards and shooting stars.
    const starShape = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.9 : 2, a = k / 10 * Math.PI * 2 + Math.PI / 2; k ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.6, bevelEnabled: false });
    const starMat = new THREE.MeshBasicMaterial({ color: '#ffe066', toneMapped: false });
    for (let k = 0; k < 40; k++) {
      const s = samples[Math.floor(Math.random() * N)], lat = (Math.random() < 0.5 ? -1 : 1) * (edge + 8 + Math.random() * 40);
      const st = new THREE.Mesh(starGeo, starMat); st.position.set(s.p.x + s.r.x * lat, s.p.y - 10 + Math.random() * 30, s.p.z + s.r.z * lat); st.userData.dyn = true; g.add(st);
      anim.push(tm => { st.rotation.y = tm * 1.5 + k; });
    }
    const comets = []; for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 40, 8).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, toneMapped: false })); c.userData.dyn = true; g.add(c); comets.push(c); }
    anim.push(tm => comets.forEach((c, k) => { const u = ((tm * 0.12 + k * 0.25) % 1); c.position.set(-700 + u * 1400, 380 - u * 200 + k * 40, -500 + k * 250); c.rotation.z = -0.14; }));
  }

  // Batch all static set dressing (signs, posts, arches, stands, props) per material and per 120 m cell.
  mergeAll(g, () => true, 120);
  return { group: g, update(time, dt, focus) { for (const f of anim) f(time, dt, focus); } };
}
