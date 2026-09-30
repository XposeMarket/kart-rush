import * as THREE from './vendor/three.module.js';

// One instanced particle system for sparks, flames, dust, smoke and hit stars.
const MAX = 900;
let glow;
function glowTex() {
  if (glow) return glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.85)'); gr.addColorStop(0.6, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glow = new THREE.CanvasTexture(c); return glow;
}
export function createFx(scene) {
  // Camera-facing soft glow quads (billboarded in the vertex shader) for sparks and flames.
  const geo = new THREE.PlaneGeometry(0.34, 0.34);
  const mat = new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  mat.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
      float sc = length(instanceMatrix[0].xyz);
      mvPosition.xy += position.xy * sc;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color()); mesh.frustumCulled = false;
  scene.add(mesh);
  const smokeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false });
  const smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), smokeMat, 300);
  smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage); smoke.setColorAt(0, new THREE.Color()); smoke.frustumCulled = false; scene.add(smoke);
  const parts = [], puffs = [], o = new THREE.Object3D(), c = new THREE.Color();

  function spawn(list, cap, pos, vel, color, life, size, grav = 0) {
    if (list.length >= cap) list.shift();
    list.push({ p: pos.clone(), v: vel, color: new THREE.Color(color), life, max: life, size, grav });
  }
  const rnd = s => (Math.random() - 0.5) * s;
  const api = {
    spark(pos, color, dir) { spawn(parts, MAX, pos, new THREE.Vector3(rnd(3) + dir.x * -2, 1.5 + Math.random() * 3, rnd(3) + dir.z * -2), color, 0.25 + Math.random() * 0.2, 0.7 + Math.random() * 0.6, -12); },
    flame(pos, dir, color = '#ff9a1f') { spawn(parts, MAX, pos, new THREE.Vector3(-dir.x * 8 + rnd(2), rnd(1.5) + 0.6, -dir.z * 8 + rnd(2)), Math.random() < 0.4 ? '#ffe066' : color, 0.18 + Math.random() * 0.12, 1.3, 0); },
    dust(pos, color) { spawn(puffs, 300, pos, new THREE.Vector3(rnd(2), 1 + Math.random() * 1.5, rnd(2)), color, 0.6, 0.9 + Math.random() * 0.8, 0); },
    burst(pos, colors, n = 24, speed = 9) { for (let k = 0; k < n; k++) spawn(parts, MAX, pos, new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.5 + Math.random())).add(new THREE.Vector3(0, 4, 0)), colors[k % colors.length], 0.5 + Math.random() * 0.4, 1.2, -18); },
    update(dt) {
      let k = 0;
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; } }
      for (const q of parts) {
        q.v.y += q.grav * dt; q.p.addScaledVector(q.v, dt);
        const f = q.life / q.max; o.position.copy(q.p); o.scale.setScalar(q.size * (0.35 + f * 0.65)); o.rotation.set(q.life * 9, q.life * 7, 0); o.updateMatrix();
        mesh.setMatrixAt(k, o.matrix); mesh.setColorAt(k, c.copy(q.color).multiplyScalar(0.9 + f * 1.4)); k++;
      }
      mesh.count = k; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      let j = 0;
      for (let i = puffs.length - 1; i >= 0; i--) { puffs[i].life -= dt; if (puffs[i].life <= 0) puffs.splice(i, 1); }
      for (const q of puffs) { q.p.addScaledVector(q.v, dt); const f = q.life / q.max; o.position.copy(q.p); o.scale.setScalar(q.size * (1.6 - f)); o.rotation.set(0, 0, 0); o.updateMatrix(); smoke.setMatrixAt(j, o.matrix); smoke.setColorAt(j, c.copy(q.color)); j++; }
      smoke.count = j; smoke.instanceMatrix.needsUpdate = true; if (smoke.instanceColor) smoke.instanceColor.needsUpdate = true;
    },
    clear() { parts.length = 0; puffs.length = 0; mesh.count = 0; smoke.count = 0; },
    dispose() { scene.remove(mesh); scene.remove(smoke); }
  };
  return api;
}
