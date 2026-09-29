import * as THREE from './vendor/three.module.js';
import { CHARACTERS, KARTS, TRACKS, POINTS } from './data.js';
import { buildTrack } from './track.js';
import { buildScenery } from './scenery.js';
import { Kart, TIER_COLORS } from './kart.js';
import { createAI } from './ai.js';
import { createItems } from './items.js';
import { createFx } from './fx.js';
import { sfx, engine, playMusic, stopMusic, setMuted, isMuted, initAudio } from './audio.js';
import { readInput, takeItem, takePause, resetInput, bindTouch, isTouch } from './input.js';
import { createMenus, hud, createMinimap, fmt } from './ui.js';

const $ = id => document.getElementById(id);
if (isTouch) document.body.classList.add('touch');
$('controls-hint').innerHTML = isTouch
  ? 'Auto-gas · steer pad · hold <b>DRIFT</b> while turning to hop-drift, release for a mini-turbo (blue → orange → purple) · tap DRIFT mid-air off ramps for a trick boost'
  : '<b>↑/W</b> gas · <b>←→/AD</b> steer · <b>↓/S</b> brake · hold <b>SPACE/SHIFT</b> while turning to drift, release for mini-turbo · <b>E/X</b> item (hold ↓ to throw back) · <b>C</b> look back · <b>P</b> pause · gamepad works';
bindTouch($('touch'));

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('race'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.6 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 2400);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 82 : 68; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let scene, track, scenery, fx, items, minimap, karts = [], player, ais = [];
let state = 'menu', raceTime = 0, countdown = 0, lastBeep = 0, finishTimer = 0, cup = null;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let shake = 0, fovKick = 0;

const menus = createMenus(startCup);
$('pause-btn').onclick = () => pause();

// ---------- Setup ----------
function startCup(cfg) {
  cup = { ...cfg, index: 0, points: {}, results: [] };
  $('menu').classList.add('hidden');
  loadRace();
}

function loadRace() {
  $('loading').classList.remove('hidden');
  setTimeout(() => {
    buildRace(TRACKS.find(t => t.id === cup.tracks[cup.index]));
    $('loading').classList.add('hidden');
  }, 30);
}

function buildRace(def) {
  if (scene) { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  scene = new THREE.Scene();
  track = buildTrack(def); scene.add(track.group);
  scenery = buildScenery(track, scene);
  fx = createFx(scene);
  items = createItems(scene, track, fx, (k, name) => { if (k === player) sfx[name] && sfx[name](); });
  minimap = createMinimap(track);
  karts = []; ais = [];
  const tt = cup.mode === 'tt';
  player = new Kart({ ch: cup.ch, kart: cup.kart, cls: cup.cc, track, isPlayer: true });
  const rivals = tt ? [] : CHARACTERS.filter(c => c !== cup.ch).slice(0, 7);
  const grid = [...rivals.map((c, i) => new Kart({ ch: c, kart: KARTS[(i * 3 + 1) % KARTS.length], cls: cup.cc, track })), player];
  // Grid: player starts at the back in race 1, then by standings.
  if (cup.index > 0) grid.sort((a, b) => (cup.points[a.ch.id] || 0) - (cup.points[b.ch.id] || 0));
  grid.forEach((k, n) => {
    const row = n, back = 6 + row * 5, lat = (row % 2 ? 1 : -1) * track.halfW * 0.42;
    k.placeAt(track.N - Math.round(back / 2), lat);
    k.crossings = 0; k.prevIdx = k.idx;
    scene.add(k.mesh); karts.push(k);
    if (!k.isPlayer) ais.push(createAI(k, cup.cc.ai * (0.82 + Math.random() * 0.2), n));
  });
  if (tt) { player.item = 'triple'; player.charges = 3; }
  const f = player.forward; camPos.copy(player.pos).addScaledVector(f, -40).add(new THREE.Vector3(0, 18, 0)); camLook.copy(player.pos);
  raceTime = 0; countdown = 4.2; lastBeep = 5; finishTimer = 0; state = 'intro';
  hud.reset(); hud.show(true); $('touch').classList.toggle('hidden', !isTouch); $('overlay').classList.add('hidden');
  hud.banner(def.name, 2.2); resetInput(); initAudio(); stopMusic();
}

// ---------- Race loop ----------
const tmp = new THREE.Vector3();
function step(dt) {
  if (takePause() && (state === 'race' || state === 'intro')) { pause(); return; }
  const events = [];
  if (state === 'intro') {
    countdown -= dt;
    const n = Math.ceil(countdown);
    if (countdown < 3.2 && n !== lastBeep && n >= 0) { lastBeep = n; hud.lights(n); n > 0 ? sfx.beep() : sfx.go(); }
    const inp = readInput(true);
    if (countdown <= 0) {
      state = 'race'; hud.lights(0); setTimeout(() => hud.lights(-1), 900); playMusic(track.def.music);
      if (inp.gas && countdown > -0.3 && player.startCharge > 0.4 && player.startCharge < 1.1) { player.applyBoost(1.6, 3); hud.toast('ROCKET START!'); sfx.boost(); }
    } else { player.startCharge = inp.gas && countdown < 1.6 ? (player.startCharge || 0) + dt : 0; }
    karts.forEach(k => k.syncMesh(dt));
  } else if (state === 'race' || state === 'finish') {
    raceTime += dt;
    const inp = state === 'race' ? readInput(true) : { steer: 0, gas: true, brake: false, drift: false };
    const use = state === 'race' ? takeItem() : null;
    if (use) items.use(player, karts, { throwBack: use.back, emit: e => events.push(e) });
    player.update(dt, inp, events);
    for (const ai of ais) {
      const out = ai.kart.finished ? { steer: 0, gas: true, drift: false } : ai.think(dt, track, karts, player, items.objects, (k, back) => items.use(k, karts, { throwBack: back, emit: e => events.push(e) }));
      ai.kart.update(dt, out, events);
    }
    collideKarts(events);
    items.update(dt, karts, events, raceTime);
    rankAndLaps(events);
    player.lookBack = inp.lookBack;
    if (state === 'finish') { finishTimer += dt; if (finishTimer > 4 || karts.every(k => k.finished)) endRace(); }
  }
  handleEvents(events);
  emitFx(dt);
  fx.update(dt);
  updateCamera(dt);
  scenery.update(raceTime, player.pos);
  hud.update(player, lapOf(player), track.def.laps, player.finished ? player.finishTime : raceTime);
  minimap.draw(karts, player, items.objects);
  const ratio = Math.max(0, player.speed) / (player.top * 1.3);
  engine(ratio, state === 'race' || state === 'intro', player.isDrifting, player.boost > 0);
}

const lapOf = k => k.crossings;
function rankAndLaps(events) {
  const laps = track.def.laps;
  for (const k of karts) {
    const lap = lapOf(k);
    if (lap > (k.lapShown || 0)) {
      k.lapShown = lap;
      if (lap > laps && !k.finished) { k.finished = true; k.finishTime = raceTime; events.push({ type: 'finish', kart: k }); }
      else if (k === player && lap > 1) events.push({ type: lap === laps ? 'final' : 'lap', kart: k });
    }
  }
  const order = [...karts].sort((a, b) => (a.finished && b.finished) ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress);
  order.forEach((k, i) => (k.place = i + 1));
}

function collideKarts(events) {
  for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
    const a = karts[i], b = karts[j]; if (a.falling || b.falling) continue;
    tmp.subVectors(b.pos, a.pos); tmp.y = 0; const d = tmp.length(), R = 2.3 * ((a.shrink ? 0.6 : 1) + (b.shrink ? 0.6 : 1)) / 2;
    if (d > 0.001 && d < R && Math.abs(a.pos.y - b.pos.y) < 2) {
      tmp.divideScalar(d);
      if (a.star && !b.star) { b.hit('spin') && events.push({ type: 'hit', kart: b, by: a }); continue; }
      if (b.star && !a.star) { a.hit('spin') && events.push({ type: 'hit', kart: a, by: b }); continue; }
      if (a.shrink && !b.shrink) { a.squash = 1; a.hit('spin'); continue; } if (b.shrink && !a.shrink) { b.squash = 1; b.hit('spin'); continue; }
      const wa = a.weight, wb = b.weight, push = (R - d);
      a.pos.addScaledVector(tmp, -push * wb / (wa + wb)); b.pos.addScaledVector(tmp, push * wa / (wa + wb));
      if ((a.isPlayer || b.isPlayer) && push > 0.3) events.push({ type: 'bump', kart: a.isPlayer ? a : b });
    }
  }
}

function handleEvents(events) {
  for (const e of events) {
    const me = e.kart === player;
    switch (e.type) {
      case 'hop': if (me) sfx.hop(); break;
      case 'tier': if (me && e.tier > 0) { sfx.mini(e.tier); } break;
      case 'miniturbo': if (me) { sfx.boost(); fovKick = 6 + e.tier * 3; hud.toast(['', 'MINI-TURBO', 'SUPER MINI-TURBO!', 'ULTRA MINI-TURBO!!'][e.tier], 0.8); } break;
      case 'pad': case 'shroom': if (me) { sfx.boost(); fovKick = 10; } break;
      case 'trick': if (me) { sfx.hop(); hud.toast('TRICK!', 0.6); } break;
      case 'trickboost': if (me) { sfx.boost(); fovKick = 7; } break;
      case 'ramp': if (me) fovKick = 4; break;
      case 'land': if (me) shake = 0.25; fx.dust(e.kart.pos, '#d8d0c0'); break;
      case 'wall': if (me) { sfx.bump(); shake = 0.3; } break;
      case 'bump': sfx.bump(); shake = 0.2; break;
      case 'box': if (me) sfx.box(); break;
      case 'gotitem': if (me) sfx.got(); break;
      case 'coin': if (me) sfx.coin(); break;
      case 'hit': if (me) { sfx.hit(); shake = 0.5; hud.flash(); } else if (e.by === player) hud.toast('HIT ' + e.kart.name.toUpperCase() + '!', 0.9); fx.burst(e.kart.pos.clone().setY(e.kart.pos.y + 1), ['#ffe066', '#ffffff', '#ff9a1f'], 16, 7); break;
      case 'blast': sfx.boom(); if (me) { shake = 1; hud.flash(); } else shake = 0.3; break;
      case 'bolt': sfx.bolt(); hud.flash('bolt'); break;
      case 'fall': if (me) { sfx.fall(); hud.toast('OOPS!'); } break;
      case 'lap': sfx.lap(); hud.banner('LAP ' + lapOf(player), 1.2); break;
      case 'final': sfx.final(); hud.banner('FINAL LAP!', 1.6, 'final'); break;
      case 'finish': if (me) { state = 'finish'; stopMusic(); player.place <= 3 ? sfx.win() : sfx.lose(); hud.banner(player.place === 1 ? 'YOU WIN!' : 'FINISH!', 3, player.place === 1 ? 'final' : ''); saveBest(); } break;
    }
  }
}

let fxAcc = 0;
function emitFx(dt) {
  fxAcc += dt; if (fxAcc < 1 / 45) return; fxAcc = 0;
  for (const k of karts) {
    if (k.falling || k.pos.distanceToSquared(camera.position) > 120 * 120) continue;
    const f = k.forward, r = new THREE.Vector3(f.z, 0, -f.x);
    if (k.isDrifting) for (const s of [-1, 1]) { const p = k.pos.clone().addScaledVector(f, -1.2).addScaledVector(r, s * 1.1); p.y += 0.3; fx.spark(p, k.tier ? TIER_COLORS[k.tier] : '#ffffff', f); }
    if (k.boost > 0) for (const s of [-1, 1]) { const p = k.pos.clone().addScaledVector(f, -1.9).addScaledVector(r, s * 0.5); p.y += 0.6; fx.flame(p, f, k.boostPower >= 3 ? '#d45bff' : k.boostPower >= 2 ? '#ff7b1a' : '#4fb8ff'); }
    if (k.offroad && k.grounded && Math.abs(k.speed) > 5) fx.dust(k.pos.clone().addScaledVector(f, -1.5), track.def.theme === 'snow' ? '#ffffff' : '#b8a27a');
    if (k.star > 0 && Math.random() < 0.6) fx.spark(k.pos.clone().setY(k.pos.y + 1.2), `hsl(${Math.random() * 360},100%,60%)`, f);
  }
}

function updateCamera(dt) {
  const k = player, f = k.forward;
  const back = k.lookBack ? -1 : 1;
  const intro = state === 'intro' ? Math.max(0, (countdown - 1.2) / 3) : 0;
  const speedK = Math.max(0, k.speed) / k.top;
  const dist = (7.2 + speedK * 1.6) * back + intro * 26, height = 3.1 + intro * 10;
  const yawOff = k.drift ? k.drift * 0.22 : 0;
  const cy = Math.cos(yawOff), sy = Math.sin(yawOff);
  const dir = new THREE.Vector3(f.x * cy - f.z * sy, 0, f.x * sy + f.z * cy);
  const want = k.pos.clone().addScaledVector(dir, -dist); want.y = k.pos.y + height;
  if (k.falling) want.copy(camPos);
  camPos.lerp(want, 1 - Math.exp(-dt * (state === 'intro' ? 3 : 9)));
  const look = k.pos.clone().addScaledVector(f, 4 * back); look.y += 1.4;
  camLook.lerp(look, 1 - Math.exp(-dt * 14));
  camera.position.copy(camPos);
  if (shake > 0) { shake = Math.max(0, shake - dt); camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.lookAt(camLook);
  fovKick = Math.max(0, fovKick - dt * 12);
  const baseFov = (innerWidth < innerHeight ? 82 : 68) + speedK * 6 + fovKick;
  camera.fov += (baseFov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
}

// ---------- Flow ----------
function pause() {
  if (state !== 'race' && state !== 'intro') return;
  const prev = state; state = 'paused'; stopMusic(); engine(0, false);
  overlay('PAUSED', track.def.name, '', [['RESUME', () => { state = prev; $('overlay').classList.add('hidden'); if (prev === 'race') playMusic(track.def.music); }, true], ['RESTART', () => buildRace(track.def)], [isMuted() ? 'SOUND ON' : 'SOUND OFF', () => { setMuted(!isMuted()); pause2(prev); }], ['QUIT', quit]]);
}
function pause2(prev) { state = prev; pause(); }

function endRace() {
  state = 'results'; engine(0, false);
  const order = [...karts].sort((a, b) => a.place - b.place);
  order.forEach(k => { if (!k.finished) k.finishTime = raceTime + (k.place - player.place) * 0.8 + 2; });
  const rows = order.map((k, i) => { cup.points[k.ch.id] = (cup.points[k.ch.id] || 0) + (cup.mode === 'gp' ? POINTS[i] : 0); return `<tr class="${k === player ? 'me' : ''}"><td>${i + 1}</td><td>${k.name}</td><td>${fmt(k.finishTime)}</td><td>${cup.mode === 'gp' ? '+' + POINTS[i] : ''}</td></tr>`; }).join('');
  const last = cup.index >= cup.tracks.length - 1;
  const actions = cup.mode === 'gp' && !last ? [['NEXT RACE', () => { cup.index++; loadRace(); }, true], ['QUIT', quit]] : cup.mode === 'gp' ? [['STANDINGS', standings, true]] : [['RACE AGAIN', () => buildRace(track.def), true], ['MENU', quit]];
  overlay(player.place === 1 ? 'WINNER!' : ordinal(player.place) + ' PLACE', `${track.def.name} · ${fmt(player.finishTime)}`, `<table>${rows}</table>`, actions);
}
function standings() {
  const list = karts.map(k => ({ k, p: cup.points[k.ch.id] || 0 })).sort((a, b) => b.p - a.p);
  const pos = list.findIndex(x => x.k === player) + 1, trophy = ['🏆 GOLD', '🥈 SILVER', '🥉 BRONZE'][pos - 1];
  if (trophy) { const t = JSON.parse(localStorage.getItem('kr-trophies') || '{}'); const key = cup.cup + cup.cc.id.replace(/\D/g, '').length; t[cup.cup + ['50', '100', '150'].indexOf(cup.cc.id)] = trophy.split(' ')[0]; localStorage.setItem('kr-trophies', JSON.stringify(t)); }
  pos <= 3 ? sfx.win() : sfx.lose();
  overlay(trophy ? trophy + ' CUP!' : ordinal(pos) + ' OVERALL', `${cup.cup} Cup · ${cup.cc.name}`, `<table>${list.map((x, i) => `<tr class="${x.k === player ? 'me' : ''}"><td>${i + 1}</td><td>${x.k.name}</td><td></td><td>${x.p} pts</td></tr>`).join('')}</table>`, [['PLAY AGAIN', () => startCup({ ...cup }), true], ['MENU', quit]]);
}
function quit() { state = 'menu'; stopMusic(); engine(0, false); hud.show(false); $('touch').classList.add('hidden'); $('overlay').classList.add('hidden'); $('menu').classList.remove('hidden'); menus.show('title'); }
function overlay(title, sub, html, actions) {
  $('ov-title').textContent = title; $('ov-sub').textContent = sub; $('ov-table').innerHTML = html;
  const box = $('ov-actions'); box.innerHTML = '';
  actions.forEach(([label, fn, primary]) => { const b = document.createElement('button'); b.className = 'ov-btn' + (primary ? ' primary' : ''); b.textContent = label; b.onclick = () => { sfx.select(); fn(); }; box.appendChild(b); });
  $('overlay').classList.remove('hidden');
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][n] || 'th').toUpperCase();
function saveBest() { const b = JSON.parse(localStorage.getItem('kr-best') || '{}'); if (!b[track.def.id] || player.finishTime < b[track.def.id]) { b[track.def.id] = player.finishTime; localStorage.setItem('kr-best', JSON.stringify(b)); hud.toast('NEW BEST TIME!', 2); } }

// ---------- Main loop ----------
let last = performance.now(), timeScale = 1;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!scene) return;
  if (state !== 'paused' && state !== 'results' && state !== 'menu') {
    const sub = Math.ceil(dt * timeScale / 0.025);
    for (let i = 0; i < sub; i++) step(dt * timeScale / sub);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
window.__kr = { set timeScale(v) { timeScale = v; }, get state() { return state; }, get player() { return player; }, get karts() { return karts; }, get track() { return track; }, startCup };
