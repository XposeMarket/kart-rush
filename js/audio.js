// Procedural audio: engine that follows speed, drift screech, sfx, per-course music loop.
let ac = null, master = null, sfxBus = null, musicBus = null, muted = localStorage.getItem('kr-muted') === '1';
let eng = null, eng2 = null, engGain = null, screech = null, screechGain = null, musicTimer = null, musicStep = 0, song = null;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    engGain = ac.createGain(); engGain.gain.value = 0; lp.connect(engGain); engGain.connect(sfxBus);
    eng = ac.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 55; eng.connect(lp); eng.start();
    eng2 = ac.createOscillator(); eng2.type = 'square'; eng2.frequency.value = 110; const g2 = ac.createGain(); g2.gain.value = 0.3; eng2.connect(g2); g2.connect(lp); eng2.start();
    const len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    screech = ac.createBufferSource(); screech.buffer = buf; screech.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 4;
    screechGain = ac.createGain(); screechGain.gain.value = 0; screech.connect(bp); bp.connect(screechGain); screechGain.connect(sfxBus); screech.start();
  } catch (e) { ac = null; }
}

function tone(freq, dur, type = 'square', vol = 0.15, slide = 1, when = 0, bus = sfxBus) {
  if (!ac || muted) return;
  const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, freq = 800, type = 'highpass') {
  if (!ac || muted) return;
  const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  s.buffer = b; g.gain.value = vol; f.type = type; f.frequency.value = freq;
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
}

export const sfx = {
  click: () => tone(880, 0.06, 'square', 0.1),
  select: () => { tone(660, 0.08, 'square', 0.12); tone(990, 0.1, 'square', 0.12, 1, 0.07); },
  back: () => tone(440, 0.1, 'triangle', 0.14, 0.6),
  beep: () => tone(440, 0.28, 'square', 0.2),
  go: () => tone(880, 0.6, 'square', 0.22),
  hop: () => tone(300, 0.1, 'triangle', 0.18, 1.8),
  mini: tier => { tone([0, 500, 650, 820][tier], 0.3, 'sawtooth', 0.16, 2.2); noise(0.35, 0.12, 1400); },
  boost: () => { tone(160, 0.6, 'sawtooth', 0.18, 3.5); noise(0.5, 0.14, 900); },
  box: () => { for (let i = 0; i < 6; i++) tone(700 + i * 90, 0.05, 'square', 0.07, 1, i * 0.05); },
  roulette: () => tone(1200 + Math.random() * 400, 0.03, 'square', 0.05),
  got: () => { tone(988, 0.08, 'square', 0.12); tone(1319, 0.14, 'square', 0.12, 1, 0.08); },
  coin: () => { tone(988, 0.06, 'square', 0.1); tone(1319, 0.18, 'square', 0.1, 1, 0.06); },
  hit: () => { tone(420, 0.6, 'sawtooth', 0.2, 0.2); noise(0.4, 0.25, 400, 'lowpass'); },
  bump: () => { tone(110, 0.12, 'square', 0.2, 0.5); noise(0.1, 0.15, 300, 'lowpass'); },
  shell: () => tone(620, 0.15, 'triangle', 0.16, 0.6),
  drop: () => tone(240, 0.12, 'triangle', 0.16, 0.7),
  star: () => { for (let i = 0; i < 10; i++) tone(700 + (i % 5) * 160, 0.07, 'square', 0.09, 1, i * 0.06); },
  bolt: () => { tone(1500, 0.7, 'sawtooth', 0.2, 0.08); noise(0.7, 0.3, 2000); },
  blue: () => { for (let i = 0; i < 6; i++) tone(1400 - i * 120, 0.12, 'sawtooth', 0.1, 1, i * 0.1); },
  boom: () => { noise(0.9, 0.4, 200, 'lowpass'); tone(90, 0.8, 'sine', 0.3, 0.4); },
  fall: () => tone(700, 0.9, 'triangle', 0.16, 0.2),
  lap: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.16, 1, i * 0.1)); },
  final: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.16, 1, i * 0.1)); },
  win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.16, 1, i * 0.15)); },
  lose: () => { [392, 370, 349, 330].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, 1, i * 0.25)); }
};

export function engine(ratio, on, drifting, boosting) {
  if (!ac) return;
  const t = ac.currentTime;
  eng.frequency.setTargetAtTime(48 + ratio * 150 + (boosting ? 40 : 0), t, 0.06);
  eng2.frequency.setTargetAtTime(96 + ratio * 290, t, 0.06);
  engGain.gain.setTargetAtTime(on && !muted ? 0.08 + ratio * 0.08 : 0, t, 0.1);
  screechGain.gain.setTargetAtTime(drifting && !muted ? 0.05 : 0, t, 0.05);
}

export function playMusic(m) {
  stopMusic(); if (!ac || !m) return; song = m; musicStep = 0;
  const beat = 60 / m.tempo / 2;
  const bass = [0, 0, 7, 0, 5, 5, 4, 2];
  const tick = () => {
    if (!song) return;
    const sc = song.scale, s = musicStep, root = song.root;
    const note = k => root * Math.pow(2, (sc[((k % sc.length) + sc.length) % sc.length] + 12 * Math.floor(k / sc.length)) / 12);
    if (s % 2 === 0) tone(root / 4 * Math.pow(2, bass[(s >> 2) % 8] / 12), beat * 1.8, 'triangle', 0.5, 1, 0, musicBus);
    const phrase = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 6, 5, 4, 3, 2];
    if (s % 2 === 0 || s % 7 === 3) tone(note(phrase[(s >> 1) % 16] + (s >= 64 ? 2 : 0)), beat * 0.9, 'square', 0.18, 1, 0, musicBus);
    if (s % 4 === 2) noise(0.05, 0.06, 6000);
    if (s % 8 === 0) tone(60, 0.12, 'sine', 0.4, 0.5, 0, musicBus);
    musicStep = (musicStep + 1) % 128;
    musicTimer = setTimeout(tick, beat * 1000);
  };
  tick();
}
export function stopMusic() { song = null; clearTimeout(musicTimer); }
export function setMuted(v) { muted = v; localStorage.setItem('kr-muted', v ? '1' : '0'); if (master) master.gain.value = v ? 0 : 0.6; }
export const isMuted = () => muted;
