import * as THREE from './vendor/three.module.js';

// Static-mesh batching: collapses many small meshes into one mesh per material.
// Every mesh is a draw call (and another one in the shadow pass), so this is the
// single biggest performance win for primitive-built models and scenery.
const _m = new THREE.Matrix4();

// Bakes the given meshes into one BufferGeometry expressed in `root`'s local space.
export function mergeGeometries(meshes, root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts = [];
  let n = 0, hasUv = true;
  for (const o of meshes) {
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    _m.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(_m);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (_m.determinant() < 0) flipWinding(g);
    if (!g.attributes.uv) hasUv = false;
    parts.push(g); n += g.attributes.position.count;
  }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = hasUv ? new Float32Array(n * 2) : null;
  let off = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), off * 3);
    nor.set(g.attributes.normal.array.subarray(0, c * 3), off * 3);
    if (uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), off * 2);
    off += c; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

function flipWinding(g) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], s = a.itemSize, arr = a.array;
    for (let t = 0; t + 2 < a.count; t += 3) for (let k = 0; k < s; k++) {
      const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
    }
  }
}

// Materials that look identical batch together even if they are separate instances.
function matKey(m) {
  if (m.userData.shared || m.isShaderMaterial || Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) return m.uuid;
  const hex = c => (c && c.getHexString ? c.getHexString() : '');
  return [m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity, m.map && m.map.uuid, m.emissiveMap && m.emissiveMap.uuid, m.gradientMap && m.gradientMap.uuid,
    m.side, m.transparent, m.opacity, m.roughness, m.metalness, m.flatShading, m.toneMapped, m.depthWrite, m.blending, m.fog].join('|');
}

export const under = (o, anc) => { for (let p = o; p; p = p.parent) if (p === anc) return true; return false; };

// Replaces `meshes` with one merged mesh per material, parented to `root`. Returns the new meshes.
// cell > 0 also splits batches into world-space grid cells so frustum culling still works.
const _p = new THREE.Vector3();
export function mergeMeshes(meshes, root, cell = 0) {
  const byMat = new Map();
  for (const o of meshes) {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.geometry.attributes.position || o.geometry.morphAttributes.position) continue;
    let key = matKey(o.material);
    if (cell > 0) { o.getWorldPosition(_p); key += '#' + Math.floor(_p.x / cell) + ',' + Math.floor(_p.z / cell); }
    const e = byMat.get(key) || { mat: o.material, list: [] }; e.list.push(o); byMat.set(key, e);
  }
  const out = [];
  for (const { mat, list } of byMat.values()) {
    if (list.length === 1 && list[0].parent === root && !list[0].children.length) { out.push(list[0]); continue; }
    const m = new THREE.Mesh(mergeGeometries(list, root), mat);
    m.castShadow = list.some(o => o.castShadow); m.receiveShadow = list.some(o => o.receiveShadow);
    m.renderOrder = list[0].renderOrder;
    if (list.every(o => o.userData.noInk)) m.userData.noInk = true;
    for (const o of list) { const kids = o.children.slice(); o.removeFromParent(); for (const c of kids) if (!list.includes(c)) root.attach(c); }
    root.add(m); out.push(m);
  }
  return out;
}

// Merges every mesh under `root` (optionally filtered) in place.
export function mergeAll(root, keep = () => true, cell = 0) {
  const skip = o => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.dyn) return true; return false; };
  const list = []; root.traverse(o => { if (o !== root && o.isMesh && !o.isInstancedMesh && keep(o) && !skip(o)) list.push(o); });
  return mergeMeshes(list, root, cell);
}
