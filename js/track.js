import * as THREE from './vendor/three.module.js';

// Builds a course from a closed spline: banked road ribbon, rumble strips, walls,
// embankments, ramps, dash panels, start grid. Exposes fast lateral queries for physics.
const SPACING = 2;
const RUMBLE = 1.6;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

function asphalt(base) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = Math.random() * 40 - 20; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 260})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h);
  });
}

export function grassTex(a, b) {
  return canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * 32, w, 32); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,40,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
  });
}

function dashTex() {
  return canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#ff9d00'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffe14d';
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(8, y + 44); g.lineTo(32, y + 12); g.lineTo(56, y + 44); g.lineTo(56, y + 60); g.lineTo(32, y + 28); g.lineTo(8, y + 60); g.fill(); }
  });
}

function inRanges(ranges, t) {
  if (!ranges) return false;
  return ranges.some(r => (r[0] <= r[1] ? t >= r[0] && t <= r[1] : t >= r[0] || t <= r[1]));
}

export function buildTrack(def) {
  const group = new THREE.Group();
  const S = 1.5;
  const curve = new THREE.CatmullRomCurve3(def.pts.map(p => new THREE.Vector3(p[0] * S, p[1] * 1.15, p[2] * S)), true, 'centripetal');
  const length = curve.getLength();
  const N = Math.floor(length / SPACING);
  const halfW = def.width / 2;
  const samples = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const flat = new THREE.Vector3(t.x, 0, t.z).normalize();
    const r = new THREE.Vector3().crossVectors(flat, up).normalize();
    samples.push({ p, t, flat, r, bank: 0, u, heading: Math.atan2(flat.x, flat.z) });
  }
  // Banking from signed curvature, smoothed.
  const raw = samples.map((s, i) => {
    const a = samples[(i - 4 + N) % N].heading, b = samples[(i + 4) % N].heading;
    let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    return THREE.MathUtils.clamp(d * 1.1, -0.22, 0.22);
  });
  for (let i = 0; i < N; i++) { let sum = 0; for (let k = -8; k <= 8; k++) sum += raw[(i + k + N) % N]; samples[i].bank = sum / 17; }

  const surfaceY = (s, lat) => s.p.y + lat * Math.tan(s.bank);
  const edgeWall = [], wallSide = [[], []];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const none = inRanges(def.noWalls, u);
    for (let side = 0; side < 2; side++) {
      const sgn = side ? 1 : -1;
      const open = !none && def.open && def.open.some(o => o[2] === sgn && inRanges([o], u)) && samples[i].p.y < 2;
      wallSide[side][i] = !(none || open);
    }
    edgeWall[i] = wallSide[0][i] && wallSide[1][i];
  }

  // Ribbon helper: columns given as lateral offsets with y offsets.
  function ribbon(cols, material, opts = {}) {
    const pos = [], uv = [], col = [], idx = [];
    const every = opts.step || 1;
    const rows = Math.ceil(N / every) + 1;
    for (let j = 0; j < rows; j++) {
      const i = (j * every) % N, s = samples[i];
      cols.forEach((c, k) => {
        const lat = typeof c.lat === 'function' ? c.lat(i) : c.lat;
        const y = (c.abs !== undefined ? c.abs : surfaceY(s, Math.min(Math.max(lat, -halfW - RUMBLE), halfW + RUMBLE)) + (c.dy || 0));
        pos.push(s.p.x + s.r.x * lat, y, s.p.z + s.r.z * lat);
        uv.push(k / (cols.length - 1), (j * every * SPACING) / (opts.vlen || 16));
        if (opts.color) { const cc = opts.color(i, k); col.push(cc.r, cc.g, cc.b); }
      });
    }
    const w = cols.length;
    for (let j = 0; j < rows - 1; j++) for (let k = 0; k < w - 1; k++) {
      const a = j * w + k, b = a + 1, c = a + w, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (opts.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.receiveShadow = true; m.castShadow = !!opts.cast;
    group.add(m); return m;
  }

  // Road surface.
  let roadMat;
  if (def.road === 'rainbow') {
    roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.18, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
    const c = new THREE.Color();
    ribbon([{ lat: -halfW }, { lat: -halfW / 3 }, { lat: halfW / 3 }, { lat: halfW }], roadMat, { color: (i, k) => c.setHSL(((i / 14) + k * 0.02) % 1, 0.95, 0.58) });
  } else {
    const tex = asphalt(def.road);
    roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    ribbon([{ lat: -halfW }, { lat: halfW }], roadMat, { vlen: 18 });
  }
  // Rumble strips with alternating colors.
  const ca = new THREE.Color(def.rumble[0]), cb = new THREE.Color(def.rumble[1]);
  const rumbleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: def.theme === 'rainbow' ? '#ffffff' : '#000000', emissiveIntensity: 0.2 });
  const rumbleColor = i => ((Math.floor(i / 3) % 2) ? ca : cb);
  for (const sgn of [-1, 1]) {
    ribbon([{ lat: sgn * halfW, dy: 0.02 }, { lat: sgn * (halfW + RUMBLE), dy: 0.12 }].sort((a, b) => a.lat - b.lat), rumbleMat, { color: rumbleColor });
  }
  // Embankment down to ground where the road is raised (not on floating tracks).
  if (!def.fall) {
    const bankMat = new THREE.MeshStandardMaterial({ color: def.theme === 'snow' ? '#c9d6e6' : def.theme === 'lava' ? '#4a2a22' : '#8b6a45', roughness: 1, flatShading: true });
    for (const sgn of [-1, 1]) {
      const cols = [{ lat: sgn * (halfW + RUMBLE) }, { lat: i => sgn * (halfW + RUMBLE + Math.max(1, samples[i].p.y * 1.3)), abs: -0.2 }];
      ribbon(sgn < 0 ? cols.reverse() : cols, bankMat, { step: 2 });
    }
  }
  // Walls: tire stacks / snow / castle / neon rails, only where enabled.
  const wallColors = { tires: ['#1d1d1f', '#e5322d'], snow: ['#ffffff', '#a8d4ff'], castle: ['#6e6461', '#5a504d'], neon: ['#ff4fd8', '#4ff0ff'] }[def.wall];
  const wa = new THREE.Color(wallColors[0]), wb = new THREE.Color(wallColors[1]);
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: def.wall === 'neon' ? '#ffffff' : '#000', emissiveIntensity: def.wall === 'neon' ? 0.5 : 0, side: THREE.DoubleSide });
  const wallH = def.wall === 'neon' ? 0.7 : def.wall === 'castle' ? 2.2 : 1.3;
  for (let side = 0; side < 2; side++) {
    const sgn = side ? 1 : -1;
    let start = -1;
    for (let i = 0; i <= N; i++) {
      const on = i < N && wallSide[side][i];
      if (on && start < 0) start = i;
      if ((!on || i === N) && start >= 0) {
        // Per-segment quads (unshared vertices) so the stripes stay crisp, plus a
        // thick top cap and an inner face so the barrier reads as a solid block.
        const pos = [], col = [], idx = [], T = 0.7;
        const pt = (j, off) => { const s = samples[j], lat = sgn * (halfW + RUMBLE + 0.4 + off), y = surfaceY(s, sgn * (halfW + RUMBLE)); return [s.p.x + s.r.x * lat, y, s.p.z + s.r.z * lat]; };
        const quad = (a, b, c, d, color) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); for (let q = 0; q < 4; q++) col.push(color.r, color.g, color.b); idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); };
        const end = Math.min(i, N - 1);
        for (let j = start; j < end; j++) {
          const c = (Math.floor(j / 2) % 2) ? wa : wb, top = c.clone().multiplyScalar(1.15);
          const [ax, ay, az] = pt(j, 0), [bx, by, bz] = pt(j + 1, 0), [cx, cy, cz] = pt(j, T), [dx, dy, dz] = pt(j + 1, T);
          quad([ax, ay - 0.3, az], [ax, ay + wallH, az], [bx, by - 0.3, bz], [bx, by + wallH, bz], c);
          quad([ax, ay + wallH, az], [cx, cy + wallH, cz], [bx, by + wallH, bz], [dx, dy + wallH, dz], top);
          quad([cx, cy - 0.3, cz], [cx, cy + wallH, cz], [dx, dy - 0.3, dz], [dx, dy + wallH, dz], c);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx); g.computeVertexNormals();
        const m = new THREE.Mesh(g, wallMat); m.castShadow = true; group.add(m); start = -1;
      }
    }
  }

  // Start / finish checker line + gantry.
  const s0 = samples[0];
  const check = canvasTex(128, 16, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); } });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(def.width + RUMBLE * 2, 2.4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: check, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  line.rotation.y = s0.heading; line.position.copy(s0.p).setY(s0.p.y + 0.05);
  group.add(line);
  const gantry = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 0.4, roughness: 0.4 });
  for (const sgn of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 9), postMat); post.position.set(sgn * (halfW + 2.5), 4.5, 0); post.castShadow = true; gantry.add(post); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(def.width + 6, 2.2, 0.4), new THREE.MeshStandardMaterial({ map: canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#e5322d'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'italic 900 44px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('KART RUSH GRAND PRIX', w / 2, 48); }) }));
  banner.position.y = 8.6; banner.castShadow = true; gantry.add(banner);
  gantry.position.copy(s0.p); gantry.rotation.y = s0.heading; group.add(gantry);

  // Ramps and dash panels.
  const idxOf = u => Math.floor(((u % 1) + 1) % 1 * N);
  // Ramps are built on the real road samples so they follow the curve and banking
  // (a flat wedge floated off banked turns). Entries: u or [u, 'boost'].
  const dash = dashTex();
  const RL = 4, RH = 1.9;
  const rampMat = new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, g => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#1a8cff' : '#ffd23f'; g.fillRect(0, k * 8, 64, 8); } }), roughness: 0.5, side: THREE.DoubleSide });
  const boostRampMat = new THREE.MeshStandardMaterial({ map: dash, emissive: '#ff8a00', emissiveMap: dash, emissiveIntensity: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  const ramps = (def.ramps || []).map(e => {
    const [u, kind] = Array.isArray(e) ? e : [e, 'jump'];
    const i = idxOf(u), boost = kind === 'boost', L = halfW + 0.3, pos = [], uv = [];
    const v = (j, lat, lift) => { const s = samples[(i - RL + j + N) % N]; return [s.p.x + s.r.x * lat, surfaceY(s, lat) + lift, s.p.z + s.r.z * lat]; };
    const P = (a, b, c, d, q) => { pos.push(...a, ...b, ...c, ...b, ...d, ...c); uv.push(...q[0], ...q[1], ...q[2], ...q[1], ...q[3], ...q[2]); };
    for (let j = 0; j < RL; j++) {
      const h0 = RH * j / RL + 0.04, h1 = RH * (j + 1) / RL + 0.04, v0 = j / RL, v1 = (j + 1) / RL;
      P(v(j, -L, h0), v(j, L, h0), v(j + 1, -L, h1), v(j + 1, L, h1), [[0, v0], [1, v0], [0, v1], [1, v1]]);
      for (const sl of [-L, L]) P(v(j, sl, 0), v(j, sl, h0), v(j + 1, sl, 0), v(j + 1, sl, h1), [[0, 0], [0, 0.2], [1, 0], [1, 0.2]]);
    }
    P(v(RL, -L, 0), v(RL, L, 0), v(RL, -L, RH + 0.04), v(RL, L, RH + 0.04), [[0, 0], [1, 0], [0, 0.25], [1, 0.25]]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, boost ? boostRampMat : rampMat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    return { i, len: RL, h: RH, boost };
  });
  const pads = (def.pads || []).map(([u, l]) => {
    const i = idxOf(u), s = samples[i], lat = l * halfW * 0.7;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 6).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshStandardMaterial({ map: dash, emissive: '#ff8a00', emissiveIntensity: 0.55, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.y = s.heading;
    m.position.set(s.p.x + s.r.x * lat, surfaceY(s, lat) + 0.06, s.p.z + s.r.z * lat); group.add(m);
    return { i, lat };
  });

  // Nearest-sample lookup constrained around a hint index.
  function locate(pos, hint) {
    let best = -1, bd = Infinity;
    const scan = hint == null ? N : 40;
    for (let k = -scan; k <= scan; k++) {
      const i = hint == null ? (k + N) % N : (hint + k + N * 2) % N;
      const s = samples[i], dx = pos.x - s.p.x, dz = pos.z - s.p.z, dy = (pos.y - s.p.y) * 0.5;
      const d = dx * dx + dz * dz + dy * dy;
      if (d < bd) { bd = d; best = i; }
      if (hint == null && k >= N / 2) break;
    }
    const s = samples[best];
    const lat = (pos.x - s.p.x) * s.r.x + (pos.z - s.p.z) * s.r.z;
    const along = (pos.x - s.p.x) * s.flat.x + (pos.z - s.p.z) * s.flat.z;
    return { i: best, lat, along, s };
  }
  function rampLift(i, lat) {
    if (Math.abs(lat) > halfW) return 0;
    for (const r of ramps) { const d = (r.i - i + N) % N; if (d <= r.len) return r.h * (1 - d / r.len); }
    return 0;
  }
  function groundAt(i, lat) {
    const s = samples[i], edge = halfW + RUMBLE;
    if (Math.abs(lat) <= edge) return surfaceY(s, lat) + rampLift(i, lat);
    if (def.fall) return -Infinity;
    const eY = surfaceY(s, Math.sign(lat) * edge);
    return Math.max(def.lavaEdge ? -0.4 : 0, eY - (Math.abs(lat) - edge) * 0.8);
  }
  function pointAt(i, lat, lift = 0) {
    const s = samples[((i % N) + N) % N];
    return new THREE.Vector3(s.p.x + s.r.x * lat, surfaceY(s, lat) + lift, s.p.z + s.r.z * lat);
  }
  const iceSet = new Set();
  (def.ice || []).forEach(([a, b]) => { for (let i = idxOf(a); i !== idxOf(b); i = (i + 1) % N) iceSet.add(i); });

  return { def, group, curve, samples, N, length, halfW, edge: halfW + RUMBLE, wallSide, ramps, pads, dash, locate, groundAt, pointAt, surfaceY, idxOf, isIce: i => iceSet.has(i) };
}
