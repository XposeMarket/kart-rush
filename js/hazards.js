import * as THREE from './vendor/three.module.js';
import { mergeAll } from './merge.js';
import { modelOpts } from './models.js';

// Course hazards in the Mario Kart spirit: Goombas, Piranha Plants, Thwomps, fire bars,
// rolling snowballs, sliding penguins, pinball bumpers and a Chain Chomp.
// Each hazard exposes hit spheres every frame; karts touching them get knocked around.
const toon = c => new THREE.MeshToonMaterial({ color: c });
const M = {};
const mat = c => M[c] || (M[c] = toon(c));
const ball = (r, c, x = 0, y = 0, z = 0, seg = 16) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2 | 0)), mat(c)); m.position.set(x, y, z); m.castShadow = true; return m; };

function eyes(g, y, z, spread, size, angry) {
  for (const s of [-1, 1]) {
    const w = ball(size, '#ffffff', s * spread, y, z, 12); w.scale.set(0.75, 1, 0.5); g.add(w);
    g.add(ball(size * 0.45, '#111111', s * spread, y - size * 0.1, z + size * 0.35, 10));
    if (angry) { const b = new THREE.Mesh(new THREE.BoxGeometry(size * 1.6, size * 0.3, size * 0.3), mat('#111111')); b.position.set(s * spread, y + size * 0.9, z + size * 0.2); b.rotation.z = s * 0.45; g.add(b); }
  }
}

const builders = {
  goomba() {
    const g = new THREE.Group();
    const head = ball(1.3, '#8b4a1c', 0, 1.7, 0, 20); head.scale.set(1.15, 0.85, 1.05); g.add(head);
    const face = ball(0.95, '#f3d7a6', 0, 1.2, 0.35, 16); face.scale.set(1, 0.8, 0.8); g.add(face);
    eyes(g, 1.75, 1.05, 0.42, 0.32, true);
    for (const s of [-1, 1]) { const f = ball(0.55, '#3b2412', s * 0.55, 0.35, 0.1, 12); f.scale.set(1, 0.6, 1.4); g.add(f); }
    return { g, r: 1.8, cy: 1.4, stomp: true };
  },
  piranha() {
    const g = new THREE.Group(), pipe = mat('#2bb44a');
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 20), pipe); tube.position.y = 1.1; tube.castShadow = true; g.add(tube);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.7, 20), pipe); lip.position.y = 2.3; g.add(lip);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 3, 8), mat('#2f8f2a')); stem.position.y = 3.6; g.add(stem);
    const head = new THREE.Group(); head.position.y = 5;
    const top = ball(1.25, '#e5322d', 0, 0.35, 0, 18); top.scale.set(1, 0.7, 1); head.add(top);
    const jaw = ball(1.1, '#e5322d', 0, -0.35, 0, 18); jaw.scale.set(1, 0.5, 1); head.add(jaw);
    const lips = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.18, 8, 20), mat('#ffffff')); lips.rotation.x = Math.PI / 2; head.add(lips);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; head.add(ball(0.2, '#ffffff', Math.cos(a) * 0.9, 0.62, Math.sin(a) * 0.9, 8)); }
    for (const s of [-1, 1]) { const leaf = ball(0.8, '#3fbf3a', s * 0.9, 3, 0, 10); leaf.scale.set(1.2, 0.25, 0.6); g.add(leaf); }
    g.add(head);
    return { g, head, r: 1.6, cy: 5 };
  },
  snowball() { const g = new THREE.Group(), b = ball(2.2, '#ffffff', 0, 2.2, 0, 20); g.add(b); g.userData.b = b; return { g, r: 2.3, cy: 2.2 }; },
  penguin() {
    const g = new THREE.Group();
    const body = ball(0.9, '#1c2433', 0, 1, 0, 16); body.scale.set(1, 1.3, 0.9); g.add(body);
    const belly = ball(0.72, '#ffffff', 0, 0.95, 0.3, 14); belly.scale.set(1, 1.2, 0.8); g.add(belly);
    eyes(g, 1.75, 0.6, 0.25, 0.16);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), mat('#ffa21f')); beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.5, 0.85); g.add(beak);
    return { g, r: 1.3, cy: 1, stomp: true };
  },
  thwomp() {
    const g = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ color: '#8f97a3', roughness: 0.9, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 5.4, 2.4), stone); body.castShadow = true; g.add(body);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 6), stone); sp.position.set(Math.cos(a) * 2.9, Math.sin(a) * 3, 0); sp.rotation.z = a - Math.PI / 2; g.add(sp); }
    const face = new THREE.Group(); face.position.z = 1.25; eyes(face, 0.8, 0, 1, 0.55, true);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.2), mat('#222222')); mouth.position.y = -1.3; face.add(mouth);
    for (let k = 0; k < 5; k++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 4), mat('#ffffff')); tooth.position.set(-1 + k * 0.5, -1.2, 0.1); tooth.rotation.z = Math.PI; face.add(tooth); }
    g.add(face);
    return { g, r: 3, cy: 0 };
  },
  firebar() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.6), new THREE.MeshStandardMaterial({ color: '#5c4f4b', roughness: 0.9 })); post.position.y = 0.9; post.castShadow = true; g.add(post);
    const bar = new THREE.Group(); bar.position.y = 1.6; g.add(bar);
    const fire = new THREE.MeshBasicMaterial({ color: '#ffb020', toneMapped: false });
    for (let k = 1; k <= 7; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), fire); f.position.x = k * 1.15; bar.add(f); }
    if (modelOpts.pointLights) { const light = new THREE.PointLight('#ff7a1a', 2.5, 18, 1.5); light.position.y = 2; g.add(light); }
    return { g, bar, r: 0.9, cy: 1.6 };
  },
  bumper() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 1.6, 24), new THREE.MeshStandardMaterial({ color: '#ff4fd8', emissive: '#ff4fd8', emissiveIntensity: 0.6 })); base.position.y = 0.8; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.25, 8, 28), new THREE.MeshBasicMaterial({ color: '#4ff0ff', toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.65; g.add(ring);
    const cap = ball(1.2, '#ffffff', 0, 1.7, 0, 16); cap.scale.y = 0.5; g.add(cap);
    return { g, ring, r: 2, cy: 0.9, bump: true };
  },
  chomp() {
    const g = new THREE.Group(), body = new THREE.Group();
    body.add(ball(2.4, '#1c1c26', 0, 0, 0, 24)); eyes(body, 0.8, 1.8, 0.8, 0.5);
    // Glowing toon outline so it reads against Rainbow Road's black sky.
    body.add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 12), new THREE.MeshBasicMaterial({ color: '#ff4fd8', side: THREE.BackSide, toneMapped: false })));
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3), mat('#b3122a')); mouth.position.set(0, -0.3, 1.1); body.add(mouth);
    for (let k = 0; k < 8; k++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), mat('#ffffff')); tooth.position.set(-1.2 + k * 0.34, -0.15, 2.05); tooth.rotation.z = Math.PI; body.add(tooth); }
    g.add(body);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 10), mat('#8b5a2b')); post.castShadow = true; g.add(post);
    const links = []; for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 6, 10), mat('#6d6d78')); g.add(l); links.push(l); }
    return { g, body, post, links, r: 2.6, cy: 2.4 };
  }
};

export function createHazards(scene, track) {
  const t = track, group = new THREE.Group(); scene.add(group);
  const list = [];
  (t.def.hazards || []).forEach(([type, u, l = 0], n) => {
    const b = builders[type](); const i = t.idxOf(u), s = t.samples[i];
    // Batch each hazard's static pieces; animated parts stay separate.
    for (const k of ['head', 'bar', 'body', 'post', 'ring']) if (b[k]) b[k].userData.dyn = true;
    (b.links || []).forEach(l => l.userData.dyn = true); if (b.g.userData.b) b.g.userData.b.userData.dyn = true;
    mergeAll(b.g);
    for (const k of ['head', 'body']) if (b[k]) mergeAll(b[k]); // fire bar balls stay separate: each one is a hit sphere
    b.g.rotation.y = s.heading + Math.PI; group.add(b.g); // face oncoming racers
    list.push({ type, ...b, i, idx: i, s, lat0: l * t.halfW * 0.7, lat: 0, phase: n * 1.7, dead: 0, pos: new THREE.Vector3(), hits: [], cool: 0 });
  });
  const place = (h, lat, lift = 0) => { h.lat = lat; const p = t.pointAt(h.i, lat, lift); h.g.position.copy(p); h.pos.copy(p); return p; };
  const hw = t.halfW;

  function animate(h, time, dt) {
    const T = time + h.phase; h.hits.length = 0;
    if (h.dead > 0) { h.dead -= dt; h.g.scale.y = Math.max(0.12, h.g.scale.y - dt * 8); if (h.dead <= 0) h.g.scale.set(1, 1, 1); return; }
    switch (h.type) {
      case 'goomba': { const p = place(h, Math.sin(T * 0.6) * hw * 0.7); h.g.position.y += Math.abs(Math.sin(T * 6)) * 0.3; h.g.rotation.z = Math.sin(T * 6) * 0.12; h.hits.push([p.clone().setY(p.y + h.cy), h.r]); break; }
      case 'penguin': { const p = place(h, Math.sin(T * 0.9) * hw * 0.75); h.g.rotation.z = Math.cos(T * 0.9) * 0.9; h.hits.push([p.clone().setY(p.y + h.cy), h.r]); break; }
      case 'snowball': { const p = place(h, Math.sin(T * 0.5) * hw * 0.65); h.g.userData.b.rotation.z = -Math.sin(T * 0.5) * hw * 0.65 / 2.2; h.hits.push([p.clone().setY(p.y + h.cy), h.r]); break; }
      case 'piranha': {
        const side = h.lat0 >= 0 ? 1 : -1; place(h, side * (hw + 2));
        const cyc = (T % 4.2) / 4.2, lunge = cyc > 0.6 ? Math.sin((cyc - 0.6) / 0.4 * Math.PI) : 0;
        const off = -side * lunge * 7;
        const hp = t.pointAt(h.i, side * (hw + 2) + off, 5 - lunge * 2.6); h.head.position.copy(h.g.worldToLocal(hp.clone()));
        h.head.rotation.x = -0.5 + Math.sin(T * 10) * 0.25 * (lunge > 0 ? 1 : 0.3);
        h.hits.push([hp, h.r]); break;
      }
      case 'thwomp': {
        const cyc = (T % 5) / 5; let y;
        if (cyc < 0.4) y = 7.5; else if (cyc < 0.48) y = 7.5 + Math.sin(cyc * 200) * 0.15; else if (cyc < 0.52) y = 7.5 - (cyc - 0.48) / 0.04 * 4.8; else if (cyc < 0.7) y = 2.7; else y = 2.7 + (cyc - 0.7) / 0.3 * 4.8;
        const p = place(h, h.lat0, y); h.slam = cyc >= 0.5 && cyc < 0.53;
        if (y < 4.5) h.hits.push([p.clone().setY(p.y - 1), h.r]); break;
      }
      case 'firebar': { const p = place(h, h.lat0); h.bar.rotation.y = T * 1.6; h.hits.push([p.clone().setY(p.y + 1), 1.1]); const d = new THREE.Vector3(); h.bar.children.forEach(f => { f.getWorldPosition(d); h.hits.push([d.clone(), 0.75]); f.scale.setScalar(0.9 + Math.sin(T * 12 + f.position.x) * 0.15); }); break; }
      case 'bumper': { const p = place(h, h.lat0 + Math.sin(T * 0.7) * hw * 0.25); h.g.scale.setScalar(1 + Math.max(0, h.cool) * 0.5); h.ring.rotation.z = T * 3; h.hits.push([p.clone().setY(p.y + h.cy), h.r]); break; }
      case 'chomp': {
        const side = h.lat0 >= 0 ? 1 : -1; place(h, side * (hw + 3));
        const cyc = (T % 3.6) / 3.6, reach = cyc > 0.55 ? Math.sin((cyc - 0.55) / 0.45 * Math.PI) : 0;
        const bp = t.pointAt(h.i, side * (hw + 3) - side * (3 + reach * (hw + 1)), 2.4 + Math.abs(Math.sin(T * 5)) * (reach > 0 ? 0.3 : 1.2));
        h.body.position.copy(h.g.worldToLocal(bp.clone())); h.body.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        h.post.position.set(0, 1.5, 0);
        h.links.forEach((l, k) => { l.position.lerpVectors(new THREE.Vector3(0, 2, 0), h.body.position, (k + 1) / 7); l.rotation.set(k, k * 0.7, 0); });
        h.hits.push([bp, h.r]); break;
      }
    }
  }

  function update(dt, time, karts, events, player) {
    for (const k of karts) k.invulnHaz = Math.max(0, (k.invulnHaz || 0) - dt);
    for (const h of list) {
      animate(h, time, dt); h.cool = Math.max(0, h.cool - dt);
      if (h.type === 'thwomp' && h.slam && !h.slamSent) { h.slamSent = true; events.push({ type: 'thwomp', dist: player.pos.distanceTo(h.pos) }); } else if (!h.slam) h.slamSent = false;
      for (const k of karts) {
        if (k.falling || k.invulnHaz > 0) continue;
        for (const [p, r] of h.hits) {
          const rr = r + 1.1; if (k.pos.distanceToSquared(p) > rr * rr || Math.abs(k.pos.y + 0.8 - p.y) > r + 1.6) continue;
          if (h.bump) {
            const away = new THREE.Vector3(k.pos.x - p.x, 0, k.pos.z - p.z).normalize();
            k.pos.addScaledVector(away, rr - Math.hypot(k.pos.x - p.x, k.pos.z - p.z) + 0.3); k.speed *= 0.75; k.moveYaw = Math.atan2(away.x * 0.6 + Math.sin(k.moveYaw), away.z * 0.6 + Math.cos(k.moveYaw));
            h.cool = 0.3; events.push({ type: 'bump', kart: k }); k.invulnHaz = 0.3;
          } else if (k.star > 0 && h.stomp) { h.dead = 5; events.push({ type: 'stomp', kart: k, pos: p.clone() }); }
          else if (k.hit(h.type === 'thwomp' || h.type === 'chomp' ? 'blast' : 'spin')) { if (h.type === 'thwomp') k.squash = 2.2; events.push({ type: 'hit', kart: k }); }
          k.invulnHaz = Math.max(k.invulnHaz, 0.5); break;
        }
      }
    }
  }
  return { group, list, update };
}
