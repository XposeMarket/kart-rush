'use strict';
// Tiny procedural audio: engine hum, sfx, arpeggio music. No asset files.
const Sound = (() => {
  let ac = null, master = null, muted = false, eng = null, engG = null, musicT = null, musicOn = false, step = 0, map = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
      eng = ac.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 60;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      engG = ac.createGain(); engG.gain.value = 0;
      eng.connect(f); f.connect(engG); engG.connect(master); eng.start();
    } catch (e) { ac = null; }
  }
  function tone(freq, dur, type, vol, slide, when) {
    if (!ac || muted) return;
    const t = ac.currentTime + (when || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    if (!ac || muted) return;
    const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = b;
    const g = ac.createGain(); g.gain.value = vol || 0.2;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 500;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  const sfx = {
    beep: () => tone(440, 0.2, 'square', 0.2),
    go: () => tone(880, 0.5, 'square', 0.25),
    box: () => { tone(660, 0.1, 'triangle', 0.2); tone(990, 0.15, 'triangle', 0.2, 1, 0.08); },
    item: () => { for (let i = 0; i < 4; i++) tone(500 + i * 120, 0.06, 'square', 0.12, 1, i * 0.05); },
    boost: () => { tone(200, 0.5, 'sawtooth', 0.18, 4); noise(0.4, 0.15, 1200); },
    hit: () => { tone(300, 0.5, 'sawtooth', 0.22, 0.25); noise(0.3, 0.25, 300); },
    bump: () => { tone(120, 0.12, 'square', 0.2, 0.5); },
    throw: () => tone(700, 0.15, 'triangle', 0.15, 0.5),
    star: () => { for (let i = 0; i < 8; i++) tone(600 + (i % 4) * 200, 0.08, 'square', 0.1, 1, i * 0.07); },
    bolt: () => { tone(1200, 0.6, 'sawtooth', 0.2, 0.1); noise(0.5, 0.3, 2000); },
    lap: () => { tone(523, 0.12, 'square', 0.2); tone(659, 0.12, 'square', 0.2, 1, 0.1); tone(784, 0.25, 'square', 0.2, 1, 0.2); },
    win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.2, 1, i * 0.14)); },
    click: () => tone(600, 0.05, 'square', 0.1),
    drift: () => noise(0.08, 0.05, 2500)
  };
  function engine(speedRatio, on) {
    if (!ac || !engG) return;
    const t = ac.currentTime;
    eng.frequency.setTargetAtTime(55 + speedRatio * 140, t, 0.05);
    engG.gain.setTargetAtTime(on && !muted ? 0.06 + speedRatio * 0.06 : 0, t, 0.08);
  }
  function music(m) {
    stopMusic(); if (!ac || !m) return; map = m; musicOn = true; step = 0;
    const beat = 60 / map.tempo / 2;
    const base = 110;
    const seq = () => {
      if (!musicOn) return;
      const sc = map.music, i = step % 16;
      const note = sc[(i * 3 + (i >> 2)) % sc.length] + (i % 8 === 0 ? -12 : 0);
      tone(base * Math.pow(2, note / 12) * 2, beat * 0.9, 'triangle', 0.05);
      if (i % 4 === 0) tone(base * Math.pow(2, sc[0] / 12) / 2, beat * 1.6, 'sine', 0.09);
      if (i % 2 === 1) noise(0.03, 0.03, 6000);
      step++;
      musicT = setTimeout(seq, beat * 1000);
    };
    seq();
  }
  function stopMusic() { musicOn = false; clearTimeout(musicT); }
  function mute(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.5; if (v && engG) engG.gain.value = 0; }
  return { init, sfx, engine, music, stopMusic, mute, isMuted: () => muted };
})();
