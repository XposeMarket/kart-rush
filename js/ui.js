import * as THREE from './vendor/three.module.js';
import { CHARACTERS, KARTS, CLASSES, TRACKS, CUPS, ITEMS } from './data.js';
import { buildDriver, buildKart } from './models.js';
import { sfx, initAudio } from './audio.js';
import { TIER_COLORS } from './kart.js';

const $ = id => document.getElementById(id);
export const sel = { mode: 'gp', cc: 1, driver: 0, kart: 0 };
try { Object.assign(sel, JSON.parse(localStorage.getItem('kr-sel') || '{}')); } catch (e) { }
const save = () => localStorage.setItem('kr-sel', JSON.stringify(sel));

// Offscreen portrait renderer for driver / kart tiles.
let pr;
function portrait(obj, w = 160, h = 160, cam = [2.2, 2.2, 3.4], look = [0, 1, 0]) {
  if (!pr) { pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); pr.outputColorSpace = THREE.SRGBColorSpace; }
  pr.setSize(w, h, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#666688', 2.2));
  const d = new THREE.DirectionalLight('#ffffff', 2.4); d.position.set(3, 5, 4); scene.add(d);
  scene.add(obj);
  const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 50); camera.position.set(...cam); camera.lookAt(...look);
  pr.render(scene, camera);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(pr.domElement, 0, 0);
  return c;
}
const portraitCache = {};
function driverPortrait(ch) { return portraitCache['d' + ch.id] || (portraitCache['d' + ch.id] = (() => { const d = buildDriver(ch); d.rotation.y = 0.35; return portrait(d, 160, 160, [0.9, 1.75, 2.7], [0, 1.2, 0]); })()); }
function kartPortrait(k, ch) { const key = 'k' + k.id + ch.id; return portraitCache[key] || (portraitCache[key] = (() => { const m = buildKart(k, ch); m.rotation.y = -0.7; m.userData.blob.visible = false; return portrait(m, 180, 160, [3.6, 2.6, 4.6], [0, 0.8, 0]); })()); }

function bars(stats) { return Object.entries(stats).map(([k, v]) => `<div class="bar">${k.toUpperCase()}<div><i style="width:${Math.min(100, v * 10)}%"></i></div></div>`).join(''); }

export function createMenus(onStart) {
  const history = ['title'];
  const show = name => {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
    if (name === 'driver') renderDrivers(); if (name === 'kart') renderKarts(); if (name === 'course') renderCourses(); if (name === 'cc') renderCC();
  };
  const go = name => { history.push(name); show(name); };
  const back = () => { if (history.length > 1) history.pop(); sfx.back(); show(history[history.length - 1]); };
  $('menu').addEventListener('click', e => {
    initAudio();
    const g = e.target.closest('[data-go]'); if (g) { sel.mode = g.dataset.go; sfx.select(); save(); go(sel.mode === 'tt' ? 'driver' : 'cc'); return; }
    if (e.target.closest('[data-back]')) { back(); return; }
    if (e.target.closest('[data-next]')) { sfx.select(); const cur = history[history.length - 1]; go(cur === 'driver' ? 'kart' : 'course'); }
  });
  function renderCC() {
    $('cc-list').innerHTML = CLASSES.map((c, i) => `<button class="big ${i === 2 ? 'ghost' : i === 1 ? 'alt' : ''}" data-cc="${i}">${c.name}<br><small style="font-size:13px;font-family:system-ui">${['Chill', 'Standard', 'Fast & mean'][i]}</small></button>`).join('');
    $('cc-list').onclick = e => { const b = e.target.closest('[data-cc]'); if (!b) return; sel.cc = +b.dataset.cc; save(); sfx.select(); go('driver'); };
  }
  function renderDrivers() {
    const grid = $('driver-grid'); grid.innerHTML = '';
    CHARACTERS.forEach((ch, i) => { const b = document.createElement('button'); b.className = 'tile' + (i === sel.driver ? ' sel' : ''); b.appendChild(driverPortrait(ch)); b.insertAdjacentHTML('beforeend', `<span>${ch.name}</span>`); b.onclick = () => { sel.driver = i; save(); sfx.click(); renderDrivers(); }; grid.appendChild(b); });
    const ch = CHARACTERS[sel.driver];
    $('driver-stats').innerHTML = `<h3>${ch.name}<small>${ch.cls.toUpperCase()}</small></h3>` + bars({ speed: ch.speed * 2, accel: ch.accel * 2, handling: ch.handling * 2, weight: ch.weight * 2 });
  }
  function renderKarts() {
    const grid = $('kart-grid'), ch = CHARACTERS[sel.driver]; grid.innerHTML = '';
    KARTS.forEach((k, i) => { const b = document.createElement('button'); b.className = 'tile' + (i === sel.kart ? ' sel' : ''); b.appendChild(kartPortrait(k, ch)); b.insertAdjacentHTML('beforeend', `<span>${k.name}</span>`); b.onclick = () => { sel.kart = i; save(); sfx.click(); renderKarts(); }; grid.appendChild(b); });
    const k = KARTS[sel.kart], s = st => ch[st] + k[st];
    $('kart-stats').innerHTML = `<h3>${k.name}<small>${k.desc}</small></h3>` + bars({ speed: s('speed'), accel: s('accel'), handling: s('handling'), weight: s('weight'), 'off-road': k.offroad * 2 });
  }
  function renderCourses() {
    const grid = $('course-grid'), gp = sel.mode === 'gp';
    $('course-title').textContent = gp ? 'SELECT CUP' : 'SELECT COURSE';
    const trophies = JSON.parse(localStorage.getItem('kr-trophies') || '{}'), bests = JSON.parse(localStorage.getItem('kr-best') || '{}');
    const pics = { sunny: ['#5cc84a', '☀️'], frost: ['#bfe0ff', '🏔️'], lava: ['#6b1a0c', '🌋'], rainbow: ['#1b0b3a', '🌈'] };
    grid.innerHTML = gp
      ? CUPS.map(c => `<button class="course" data-cup="${c.id}"><div class="pic" style="background:linear-gradient(135deg,#ffd23f,#ff9a1f)">${c.icon}</div><div class="meta"><b>${c.name}</b><small>${c.tracks.map(id => TRACKS.find(t => t.id === id).name).join(' · ')}${trophies[c.id + sel.cc] ? ' · 🏆 ' + trophies[c.id + sel.cc] : ''}</small></div></button>`).join('')
      : TRACKS.map(t => `<button class="course" data-track="${t.id}"><div class="pic" style="background:${pics[t.id][0]}">${pics[t.id][1]}</div><div class="meta"><b>${t.name}</b><small>${t.cup} Cup${bests[t.id] ? ' · best ' + fmt(bests[t.id]) : ''}</small></div></button>`).join('');
    grid.onclick = e => {
      const c = e.target.closest('[data-cup]'), t = e.target.closest('[data-track]'); if (!c && !t) return;
      sfx.select(); save();
      const list = c ? CUPS.find(x => x.id === c.dataset.cup).tracks : [t.dataset.track];
      onStart({ mode: sel.mode, cup: c ? c.dataset.cup : null, tracks: list, cc: CLASSES[sel.cc], ch: CHARACTERS[sel.driver], kart: KARTS[sel.kart] });
    };
  }
  return { show: name => { history.length = 0; history.push(name); show(name); } };
}

export const fmt = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(3).padStart(6, '0')}`; };
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th');

// ---- HUD ----
let lastPlace = 0, lastItem = null, spinTimer = null, toastTimer = null, bannerTimer = null;
export const hud = {
  show(v) { $('hud').classList.toggle('hidden', !v); },
  update(k, lap, laps, time) {
    $('lap').innerHTML = `LAP <b>${Math.min(laps, Math.max(1, lap))}</b>/${laps}`;
    $('clock').textContent = fmt(time);
    $('coin-count').textContent = k.coins;
    if (k.place !== lastPlace) { const p = $('place'); p.innerHTML = `<b>${k.place}</b><sup>${ord(k.place).slice(String(k.place).length)}</sup>`; p.className = k.place <= 3 ? 'p' + k.place : 'pn'; void p.offsetWidth; p.classList.add('bump'); lastPlace = k.place; }
    const box = $('itembox');
    if (k.roulette > 0) { if (!box.classList.contains('spin')) { box.classList.add('spin'); spinTimer = setInterval(() => { const keys = Object.keys(ITEMS); $('item-icon').textContent = ITEMS[keys[Math.floor(Math.random() * keys.length)]].icon; sfx.roulette(); }, 80); } }
    else if (box.classList.contains('spin')) { box.classList.remove('spin'); clearInterval(spinTimer); }
    const itemKey = k.roulette > 0 ? '__spin' : (k.item || '') + k.charges;
    if (itemKey !== lastItem && k.roulette <= 0) { $('item-icon').textContent = k.item ? ITEMS[k.item].icon : ''; $('item-count').textContent = k.charges > 1 ? '×' + k.charges : ''; if (k.item) { box.classList.remove('got'); void box.offsetWidth; box.classList.add('got'); } }
    lastItem = itemKey;
    const dm = $('drift-meter'); dm.classList.toggle('on', k.drift !== 0 && k.grounded);
    if (k.drift) { const pct = Math.min(100, k.driftCharge / 3.3 * 100); dm.firstElementChild.style.width = pct + '%'; dm.firstElementChild.style.background = TIER_COLORS[Math.max(1, k.tier)]; }
  },
  reset() { lastPlace = 0; lastItem = null; clearInterval(spinTimer); $('itembox').classList.remove('spin'); $('item-icon').textContent = ''; $('item-count').textContent = ''; },
  toast(text, dur = 1.1) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), dur * 1000); },
  banner(text, dur = 1.4, cls = '') { const b = $('banner'); b.textContent = text; b.className = 'show ' + cls; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => (b.className = ''), dur * 1000); },
  flash(cls = 'pop') { const f = $('flash'); f.className = ''; void f.offsetWidth; f.className = cls; },
  lights(n) { const l = $('lights'); if (n < 0) { l.classList.add('hidden'); return; } l.classList.remove('hidden'); l.classList.toggle('go', n === 0); [...l.children].forEach((c, i) => c.classList.toggle('red', n > 0 && i < 4 - n)); }
};

// ---- Minimap ----
export function createMinimap(track) {
  const c = $('minimap'), g = c.getContext('2d'), W = c.width;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  track.samples.forEach(s => { minX = Math.min(minX, s.p.x); maxX = Math.max(maxX, s.p.x); minZ = Math.min(minZ, s.p.z); maxZ = Math.max(maxZ, s.p.z); });
  const sc = (W - 30) / Math.max(maxX - minX, maxZ - minZ), ox = (W - (maxX - minX) * sc) / 2, oz = (W - (maxZ - minZ) * sc) / 2;
  const P = p => [ox + (p.x - minX) * sc, oz + (p.z - minZ) * sc];
  const base = document.createElement('canvas'); base.width = base.height = W; const b = base.getContext('2d');
  b.lineJoin = b.lineCap = 'round';
  const path = () => { b.beginPath(); track.samples.forEach((s, i) => { const [x, y] = P(s.p); i ? b.lineTo(x, y) : b.moveTo(x, y); }); b.closePath(); };
  path(); b.strokeStyle = 'rgba(0,0,0,.6)'; b.lineWidth = 16; b.stroke();
  path(); b.strokeStyle = '#fff'; b.lineWidth = 10; b.stroke();
  path(); b.strokeStyle = '#7d8492'; b.lineWidth = 6; b.stroke();
  const [sx, sy] = P(track.samples[0].p); b.fillStyle = '#000'; b.fillRect(sx - 6, sy - 3, 12, 6);
  return {
    draw(karts, player, objects) {
      g.clearRect(0, 0, W, W); g.drawImage(base, 0, 0);
      for (const o of objects) { const [x, y] = P(o.pos); g.fillStyle = o.type === 'banana' ? '#ffd52e' : o.type === 'red' ? '#e5322d' : o.type === 'blue' ? '#2b6bff' : '#2fae3f'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
      for (const k of karts) { if (k === player) continue; const [x, y] = P(k.pos); g.fillStyle = k.ch.body; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke(); }
      const [x, y] = P(player.pos); g.save(); g.translate(x, y); g.rotate(-player.yaw + Math.PI);
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#000'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  };
}
