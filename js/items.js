import * as THREE from './vendor/three.module.js';
import { ITEMS, ODDS } from './data.js';

// Item boxes (respawning, rainbow-rotating), coins, and item behaviors.
function boxTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#fff'; g.font = '900 86px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#000'; g.shadowBlur = 8; g.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const shellGeo = () => {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#2fae3f' }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.14, 8, 18), new THREE.MeshToonMaterial({ color: '#ffffff' })); rim.rotation.x = Math.PI / 2;
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.66, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#f7e7b0' }));
  g.add(top, rim, bottom); g.userData.top = top; return g;
};

export function createItems(scene, track, fx, sound) {
  const group = new THREE.Group(); scene.add(group);
  const tex = boxTexture();
  const boxMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.85, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.3 });
  const boxes = [], coins = [], objects = [];
  const t = track;
  (t.def.boxes || []).forEach(u => {
    const i = t.idxOf(u);
    for (let k = -2; k <= 2; k++) {
      const lat = k * t.halfW * 0.35;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), boxMat.clone()); m.position.copy(t.pointAt(i, lat, 1.6)); m.castShadow = true;
      group.add(m); boxes.push({ m, i, lat, cool: 0 });
    }
  });
  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcf1a', metalness: 0.9, roughness: 0.2, emissive: '#8a5a00', emissiveIntensity: 0.4 });
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.16, 20).rotateX(Math.PI / 2);
  (t.def.coins || []).forEach(([u, l, n]) => {
    for (let k = 0; k < n; k++) { const i = (t.idxOf(u) + k * 3) % t.N, lat = l * t.halfW * 0.7; const m = new THREE.Mesh(coinGeo, coinMat); m.position.copy(t.pointAt(i, lat, 1.1)); m.castShadow = true; group.add(m); coins.push({ m, i, lat, cool: 0 }); }
  });

  function roll(kart, karts) {
    const n = karts.length, bucket = Math.min(3, Math.floor((kart.place - 1) / Math.max(1, n / 4)));
    const table = { ...ODDS[bucket] };
    if (kart.place === 1) { delete table.blue; delete table.star; delete table.bolt; }
    if (objects.some(o => o.type === 'blue')) delete table.blue;
    const entries = Object.entries(table), total = entries.reduce((s, e) => s + e[1], 0);
    let r = Math.random() * total; for (const [k, w] of entries) { r -= w; if (r <= 0) return k; } return entries[0][0];
  }

  function spawnObj(type, kart, forward) {
    const fwd = kart.forward;
    let mesh;
    if (type === 'banana') {
      mesh = new THREE.Group(); const peel = new THREE.MeshToonMaterial({ color: '#ffd52e' });
      for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.8, 4, 8), peel); p.rotation.z = (k - 1) * 0.9; p.position.y = 0.4; mesh.add(p); }
    } else if (type === 'blue') {
      mesh = shellGeo(); mesh.userData.top.material = new THREE.MeshToonMaterial({ color: '#2b6bff', emissive: '#1030aa' });
      for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), new THREE.MeshToonMaterial({ color: '#fff' })); const a = k / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.45, 0.45, Math.sin(a) * 0.45); mesh.add(sp); }
      const wings = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.5), new THREE.MeshToonMaterial({ color: '#ffffff' })); wings.position.y = 0.5; mesh.add(wings);
    } else {
      mesh = shellGeo(); if (type === 'red') mesh.userData.top.material = new THREE.MeshToonMaterial({ color: '#e5322d' });
    }
    mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const pos = kart.pos.clone().addScaledVector(fwd, forward ? 3 : -2.8); pos.y += 0.3;
    mesh.position.copy(pos); group.add(mesh);
    const o = { type, mesh, pos, owner: kart, idx: kart.idx, life: type === 'banana' ? 999 : type === 'green' ? 12 : 30, arm: 0.35, yaw: kart.yaw, speed: type === 'green' ? kart.top * 1.55 + Math.max(0, kart.speed) * 0.4 : type === 'red' ? kart.top * 1.4 : type === 'blue' ? kart.top * 1.9 : 0, target: null, lat: 0 };
    if (!forward && type !== 'banana') { o.yaw += Math.PI; o.speed *= 0.6; }
    if (type === 'banana' && forward) { o.vy = 9; o.fly = true; o.vx = Math.sin(kart.yaw) * (kart.speed + 16); o.vz = Math.cos(kart.yaw) * (kart.speed + 16); o.pos.y += 1; }
    objects.push(o); return o;
  }

  function use(kart, karts, ctx) {
    const it = kart.item; if (!it || kart.roulette > 0) return;
    const back = ctx.throwBack;
    const done = () => { kart.charges--; if (kart.charges <= 0) { kart.item = null; kart.charges = 0; } };
    if (it === 'mushroom' || it === 'triple') { kart.applyBoost(1.4, 3); sound(kart, 'boost'); ctx.emit({ type: 'shroom', kart }); done(); }
    else if (it === 'star') { kart.star = 7.5; kart.applyBoost(0.5, 2); sound(kart, 'star'); done(); }
    else if (it === 'coin') { kart.coins = Math.min(10, kart.coins + 2); sound(kart, 'coin'); done(); }
    else if (it === 'bolt') { karts.forEach(k => { if (k !== kart) k.shrinkHit(); }); sound(kart, 'bolt'); ctx.emit({ type: 'bolt', kart }); done(); }
    else if (it === 'banana') { spawnObj('banana', kart, !back ? false : true); sound(kart, 'drop'); done(); }
    else if (it === 'green') { spawnObj('green', kart, !back); sound(kart, 'shell'); done(); }
    else if (it === 'red') { const o = spawnObj('red', kart, !back); if (!back) o.target = karts.filter(k => k.place === kart.place - 1)[0] || null; sound(kart, 'shell'); done(); }
    else if (it === 'blue') { const o = spawnObj('blue', kart, true); o.target = karts.find(k => k.place === 1 && k !== kart) || null; sound(kart, 'blue'); done(); }
  }

  function update(dt, karts, events, time) {
    boxes.forEach(b => {
      b.cool = Math.max(0, b.cool - dt); b.m.visible = b.cool <= 0;
      if (b.cool <= 0 && b.cool + dt > 0) b.m.scale.setScalar(0.1);
      b.m.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 6)); b.m.rotation.set(time * 0.8, time * 1.1, 0.4);
      b.m.material.color.setHSL((time * 0.2 + b.lat * 0.03) % 1, 0.85, 0.65); b.m.material.emissive.setHSL((time * 0.2 + 0.5) % 1, 0.9, 0.25);
      if (b.cool > 0) return;
      for (const k of karts) if (!k.falling && k.pos.distanceToSquared(b.m.position) < 6.5) {
        b.cool = 3; fx.burst(b.m.position, ['#ffffff', '#7fdcff', '#ffe066', '#ff7fd1'], 18, 7);
        if (!k.item && k.roulette <= 0) { k.roulette = k.isPlayer ? 1.4 : 0.6; k.pendingItem = roll(k, karts); events.push({ type: 'box', kart: k }); }
        break;
      }
    });
    coins.forEach(c => {
      c.cool = Math.max(0, c.cool - dt); c.m.visible = c.cool <= 0; c.m.rotation.y = time * 3;
      if (c.cool > 0) return;
      for (const k of karts) if (!k.falling && k.pos.distanceToSquared(c.m.position) < 4.5) { c.cool = 12; if (k.coins < 10) k.coins++; events.push({ type: 'coin', kart: k }); break; }
    });
    for (const k of karts) if (k.roulette > 0) { k.roulette -= dt; if (k.roulette <= 0) { k.item = k.pendingItem; k.charges = k.item === 'triple' ? 3 : 1; events.push({ type: 'gotitem', kart: k }); } }

    for (let n = objects.length - 1; n >= 0; n--) {
      const o = objects[n]; o.life -= dt; o.arm -= dt;
      if (o.fly) {
        o.vy -= 34 * dt; o.pos.x += o.vx * dt; o.pos.z += o.vz * dt; o.pos.y += o.vy * dt;
        const l = t.locate(o.pos, o.idx); o.idx = l.i; const gy = t.groundAt(l.i, l.lat);
        if (isFinite(gy) && o.pos.y <= gy + 0.1) { o.pos.y = gy + 0.05; o.fly = false; }
        if (o.pos.y < -60) o.life = 0;
      } else if (o.type !== 'banana') {
        const l = t.locate(o.pos, o.idx); o.idx = l.i;
        let aim = null;
        if (o.target && !o.target.finished) aim = o.target.pos;
        if (aim && (o.type === 'blue' || o.pos.distanceTo(aim) < 45)) {
          const want = Math.atan2(aim.x - o.pos.x, aim.z - o.pos.z); let d = want - o.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283;
          o.yaw += d * Math.min(1, dt * (o.type === 'blue' ? 6 : 4));
        } else if (o.type !== 'green') {
          const ahead = t.pointAt(l.i + 6, l.lat * 0.9); o.yaw = Math.atan2(ahead.x - o.pos.x, ahead.z - o.pos.z);
        }
        o.pos.x += Math.sin(o.yaw) * o.speed * dt; o.pos.z += Math.cos(o.yaw) * o.speed * dt;
        const l2 = t.locate(o.pos, o.idx), gy = t.groundAt(l2.i, l2.lat);
        if (o.type === 'blue' && o.target) o.pos.y = Math.max(isFinite(gy) ? gy : o.pos.y, o.target.pos.y) + 3 * Math.min(1, o.pos.distanceTo(o.target.pos) / 20);
        else if (isFinite(gy)) o.pos.y = gy + 0.35; else o.life = 0;
        if (o.type === 'green' && Math.abs(l2.lat) > t.edge - 0.6 && t.wallSide[l2.lat > 0 ? 1 : 0][l2.i]) {
          const s = l2.s, nx = s.r.x * Math.sign(l2.lat), nz = s.r.z * Math.sign(l2.lat);
          let vx = Math.sin(o.yaw), vz = Math.cos(o.yaw); const dot = vx * nx + vz * nz; vx -= 2 * dot * nx; vz -= 2 * dot * nz; o.yaw = Math.atan2(vx, vz);
          o.pos.x -= nx * 0.6; o.pos.z -= nz * 0.6; o.bounces = (o.bounces || 0) + 1; if (o.bounces > 6) o.life = 0;
        }
        if (o.mesh.userData.top) o.mesh.rotation.y += dt * 14;
      }
      o.mesh.position.copy(o.pos);
      // Collisions with karts.
      for (const k of karts) {
        if (o.life <= 0) break;
        if ((k === o.owner && o.arm > 0) || k.falling) continue;
        if (o.type === 'blue' && k !== o.target) continue;
        const r = o.type === 'blue' ? 3.2 : 1.9;
        if (k.pos.distanceToSquared(o.pos) < r * r) {
          if (o.type === 'blue') { fx.burst(o.pos, ['#4f8bff', '#ffffff', '#ffd23f'], 50, 16); events.push({ type: 'blast', kart: k }); karts.forEach(kk => { if (kk.pos.distanceTo(o.pos) < 9) kk.hit('blast'); }); }
          else if (k.hit('spin')) { events.push({ type: 'hit', kart: k, by: o.owner }); fx.burst(o.pos, ['#ffe066', '#ffffff'], 14, 6); }
          else fx.burst(o.pos, ['#ffffff'], 8, 5);
          o.life = 0;
        }
      }
      // Shell vs banana / shell cancels.
      for (const p of objects) if (p !== o && o.life > 0 && p.life > 0 && p.pos.distanceToSquared(o.pos) < 3 && p.type !== 'blue' && o.type !== 'blue' && !(p.type === 'banana' && o.type === 'banana')) { o.life = 0; p.life = 0; fx.burst(o.pos, ['#ffffff', '#ffd23f'], 10, 5); }
      if (o.life <= 0) { group.remove(o.mesh); objects.splice(n, 1); }
    }
  }

  function clearObjects() { objects.forEach(o => group.remove(o.mesh)); objects.length = 0; }
  return { group, boxes, coins, objects, update, use, clearObjects, dispose() { scene.remove(group); } };
}
export { ITEMS };
