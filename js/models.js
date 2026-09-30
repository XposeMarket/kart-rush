import * as THREE from './vendor/three.module.js';

// Chunky toon-style karts and drivers built from primitives with rounded shapes.
let gradient;
function toonGradient() {
  if (gradient) return gradient;
  const d = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true; return gradient;
}
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
// Inverted-hull ink outline: back faces pushed out along normals, drawn in dark ink.
const inkMat = new THREE.MeshBasicMaterial({ color: '#15121c', side: THREE.BackSide });
inkMat.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * 0.035;'); };
export function addOutlines(root) {
  const list = []; root.traverse(o => { if (o.isMesh && !o.userData.noInk && !o.material.transparent && o.geometry.attributes.normal) list.push(o); });
  for (const o of list) { const hull = new THREE.Mesh(o.geometry, inkMat); hull.userData.noInk = true; hull.raycast = () => { }; o.add(hull); }
}
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, ...extra });
const cache = {};
const mat = (key, make) => cache[key] || (cache[key] = Object.assign(make(), { userData: { shared: true } }));

function rounded(w, h, d, r = 0.2) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r); shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d); shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: r * 0.6, bevelSize: r * 0.6, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0);
  return g;
}

function emblemTex(letter, color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = color; g.font = '900 44px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildDriver(ch) {
  const d = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.35, 6, 12), toon(ch.body)); body.position.y = 0.55; d.add(body);
  const overall = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.35, 14), toon(ch.pants)); overall.position.y = 0.3; d.add(overall);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.4, 4, 8), toon(ch.body));
    arm.position.set(s * 0.42, 0.62, 0.3); arm.rotation.x = -1.1; d.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), toon('#ffffff')); glove.position.set(s * 0.32, 0.5, 0.62); d.add(glove);
  }
  const head = new THREE.Group(); head.position.y = 1.25; d.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), toon(ch.skin)); head.add(skull);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon('#ffffff')); eye.scale.set(0.8, 1.3, 0.6); eye.position.set(s * 0.14, 0.06, 0.4); head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon('#1a2a6c')); pupil.position.set(s * 0.14, 0.05, 0.47); head.add(pupil);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), toon(ch.id === 'dino' ? '#5bbd2e' : '#f2a07b')); nose.position.set(0, -0.06, 0.46); head.add(nose);
  if (ch.hat === 'cap') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.49, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(ch.hatColor)); cap.position.y = 0.05; head.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16, 1, false, -Math.PI / 2, Math.PI), toon(ch.hatColor)); brim.position.set(0, 0.07, 0.3); head.add(brim);
    if (ch.emblem) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), new THREE.MeshBasicMaterial({ map: emblemTex(ch.emblem, ch.hatColor) })); e.position.set(0, 0.3, 0.38); e.rotation.x = -0.55; head.add(e); }
    const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), toon('#2b1a10')); stache.rotation.z = Math.PI / 2; stache.position.set(0, -0.16, 0.44); head.add(stache);
  } else if (ch.hat === 'crown') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), toon(ch.hair)); hair.scale.set(1.05, 1, 1); hair.position.set(0, 0.03, -0.08); head.add(hair);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 5, 1, true), std(ch.hatColor, { metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide })); crown.position.y = 0.5; head.add(crown);
  } else if (ch.hat === 'shroom') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(ch.hatColor)); cap.scale.y = 0.8; cap.position.y = 0.1; head.add(cap);
    for (const [x, z] of [[0, 0.5], [0.45, 0.05], [-0.45, 0.05], [0, -0.5]]) { const sp = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), toon(ch.spots)); sp.position.set(x, 0.42, z); sp.lookAt(x * 3, 1.6, z * 3); head.add(sp); }
  } else if (ch.hat === 'dino') {
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), toon(ch.skin)); snout.scale.set(1, 0.85, 1.2); snout.position.set(0, -0.05, 0.38); head.add(snout);
    for (let k = 0; k < 3; k++) { const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), toon(ch.hatColor)); spike.position.set(0, 0.42 - k * 0.12, -0.2 - k * 0.18); spike.rotation.x = -0.6 - k * 0.3; head.add(spike); }
  } else if (ch.hat === 'horns') {
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 8), toon(ch.hair)); hair.position.set(0, 0.35, -0.2); hair.rotation.x = -0.8; head.add(hair);
    for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), toon(ch.hatColor)); horn.position.set(s * 0.32, 0.38, 0); horn.rotation.z = -s * 0.5; head.add(horn); }
    head.scale.setScalar(1.15);
  } else if (ch.hat === 'tie') {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), toon('#e2b27f')); muzzle.scale.set(1.1, 0.8, 0.8); muzzle.position.set(0, -0.12, 0.3); head.add(muzzle);
    skull.material = toon(ch.body);
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.36, 4), toon(ch.hatColor)); tie.rotation.x = Math.PI; tie.position.set(0, 0.6, 0.42); d.add(tie);
    head.scale.setScalar(1.12);
  }
  d.userData.head = head;
  return d;
}

function wheel(radius, width) {
  const w = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 20), mat('tire', () => std('#1b1b1f', { roughness: 0.9, metalness: 0 })));
  tire.rotation.z = Math.PI / 2; w.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12), mat('hub', () => std('#d8dde6', { metalness: 0.8, roughness: 0.25 })));
  hub.rotation.z = Math.PI / 2; w.add(hub);
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, radius * 0.9, radius * 0.18), mat('spoke', () => std('#8f97a3', { metalness: 0.6 })));
  w.add(spoke);
  return w;
}

export function buildKart(kartDef, ch) {
  const root = new THREE.Group();       // position + yaw (set by physics)
  const tilt = new THREE.Group();       // banking/pitch/hop/spin visual
  root.add(tilt);
  const color = ch.body;
  // Candy clear-coat paint: glossy highlight layer reflecting the environment map.
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  const dark = mat('darkTrim', () => std('#26282e', { roughness: 0.6 }));
  const wheels = [];
  if (kartDef.bike) {
    const frame = new THREE.Mesh(rounded(0.7, 0.55, 2.4, 0.25), paint); frame.position.y = 0.75; tilt.add(frame);
    const fairing = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), paint); fairing.scale.set(0.8, 0.8, 1.2); fairing.position.set(0, 0.95, 1.05); tilt.add(fairing);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), std('#9fe3ff', { transparent: true, opacity: 0.55 })); shield.position.set(0, 1.25, 1.1); shield.rotation.x = 0.7; tilt.add(shield);
    for (const z of [1.25, -1.1]) { const w = wheel(kartDef.wheel, 0.32); w.position.set(0, kartDef.wheel, z); tilt.add(w); wheels.push(w); }
  } else {
    const W = kartDef.id === 'monster' ? 2.3 : 2.05, L = kartDef.id === 'zoomer' ? 3.3 : 2.9;
    const chassis = new THREE.Mesh(rounded(W, 0.42, L, 0.35), paint); chassis.position.y = kartDef.wheel * 0.95; tilt.add(chassis);
    const nose = new THREE.Mesh(rounded(W * 0.62, 0.34, L * 0.38, 0.25), paint); nose.position.set(0, kartDef.wheel * 0.95 + 0.25, L * 0.3); tilt.add(nose);
    const bumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, W * 0.85, 4, 8), dark); bumper.rotation.z = Math.PI / 2; bumper.position.set(0, kartDef.wheel * 0.7, L / 2 + 0.1); tilt.add(bumper);
    const seat = new THREE.Mesh(rounded(0.9, 0.26, 0.28, 0.1), paint); seat.position.set(0, kartDef.wheel + 0.32, -1.0); seat.rotation.x = -0.25; tilt.add(seat);
    const wheelSteer = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 16), dark); wheelSteer.position.set(0, kartDef.wheel + 0.95, 0.55); wheelSteer.rotation.x = -0.9; tilt.add(wheelSteer);
    for (const s of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.7, 10), mat('chrome', () => std('#cfd5de', { metalness: 0.9, roughness: 0.2 })));
      pipe.rotation.x = Math.PI / 2 - 0.25; pipe.position.set(s * 0.45, kartDef.wheel + 0.25, -L / 2 - 0.1); tilt.add(pipe);
    }
    if (kartDef.id === 'zoomer') { const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 0.95, 0.08, 0.5), paint); wing.position.set(0, kartDef.wheel + 1.05, -L / 2 + 0.15); tilt.add(wing); for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.2), dark); st.position.set(s * 0.5, kartDef.wheel + 0.8, -L / 2 + 0.15); tilt.add(st); } }
    const rw = kartDef.wheel * (kartDef.id === 'monster' ? 1 : 1.12);
    for (const [x, z, r] of [[-W / 2 - 0.12, L * 0.33, kartDef.wheel], [W / 2 + 0.12, L * 0.33, kartDef.wheel], [-W / 2 - 0.15, -L * 0.34, rw], [W / 2 + 0.15, -L * 0.34, rw]]) {
      const w = wheel(r, kartDef.id === 'monster' ? 0.7 : 0.5); w.position.set(x, r, z); tilt.add(w); wheels.push(w);
    }
  }
  const driver = buildDriver(ch);
  driver.position.set(0, kartDef.bike ? 0.85 : kartDef.wheel + 0.3, kartDef.bike ? -0.2 : -0.4);
  driver.scale.setScalar(ch.weight >= 4 ? 1.2 : ch.weight <= 1 ? 1.02 : 1.1);
  tilt.add(driver);
  // Exhaust anchor points for sparks/flames.
  const exhaust = [new THREE.Vector3(-0.5, 0.55, -1.7), new THREE.Vector3(0.5, 0.55, -1.7)];
  // Blob shadow keeps the kart grounded even when shadows are off.
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), mat('blob', () => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false })));
  blob.rotation.x = -Math.PI / 2; blob.scale.set(0.95, 1.35, 1); blob.position.y = 0.04; root.add(blob);
  // Headlights: small emissive discs that catch the bloom pass.
  if (!kartDef.bike) {
    const W = kartDef.id === 'monster' ? 2.3 : 2.05, L = kartDef.id === 'zoomer' ? 3.3 : 2.9;
    const lamp = mat('lamp', () => new THREE.MeshBasicMaterial({ color: '#fff6c8', toneMapped: false }));
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), lamp); l.position.set(s * W * 0.3, kartDef.wheel * 0.95 + 0.12, L / 2 + 0.23); l.userData.noInk = true; tilt.add(l); }
  }
  addOutlines(tilt);
  tilt.traverse(o => { if (o.isMesh && !o.userData.noInk) o.castShadow = true; });
  root.userData = { tilt, wheels, driver, exhaust, blob, bike: !!kartDef.bike };
  return root;
}
