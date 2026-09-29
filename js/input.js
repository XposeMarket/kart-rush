// Unified input: keyboard, gamepad, and touch (analog steer pad + buttons).
export const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
const keys = new Set();
const touch = { steer: 0, drift: false, item: false, brake: false, back: false, gas: true };
let itemQueued = false, backHeld = false, pauseQueued = false, lookBack = false;

const DRIFT = ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK'];
const ITEM = ['KeyE', 'KeyX', 'KeyL', 'ControlLeft', 'ControlRight', 'Enter'];
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!e.repeat && ITEM.includes(e.code)) itemQueued = true;
  if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) pauseQueued = true;
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

let padPrev = {};
function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && [...pads].find(Boolean); if (!p) return null;
  const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
  const axis = Math.abs(p.axes[0]) > 0.15 ? p.axes[0] : (b(15) ? 1 : b(14) ? -1 : 0);
  const now = { item: b(4) || b(2), pause: b(9) };
  if (now.item && !padPrev.item) itemQueued = true;
  if (now.pause && !padPrev.pause) pauseQueued = true;
  padPrev = now;
  return { steer: axis, gas: b(0) || b(7), brake: b(1) || b(6), drift: b(5) || b(3), back: p.axes[1] > 0.5 || b(13) };
}

export function bindTouch(root) {
  const pad = root.querySelector('[data-touch="steer"]'), knob = pad.querySelector('.knob');
  let id = null, cx = 0;
  const move = x => { const w = pad.clientWidth * 0.42; touch.steer = Math.max(-1, Math.min(1, (x - cx) / w)); knob.style.transform = `translateX(${touch.steer * w * 0.8}px)`; };
  pad.addEventListener('pointerdown', e => { id = e.pointerId; pad.setPointerCapture(id); const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; move(e.clientX); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e.clientX); });
  const end = e => { if (e.pointerId !== id) return; id = null; touch.steer = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  root.querySelectorAll('[data-touch-btn]').forEach(btn => {
    const k = btn.dataset.touchBtn;
    const on = e => { e.preventDefault(); btn.classList.add('on'); if (k === 'item') itemQueued = true; else touch[k] = true; };
    const off = () => { btn.classList.remove('on'); if (k !== 'item') touch[k] = false; };
    btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
  });
}

export function readInput(autoGas) {
  const has = c => keys.has(c);
  let steer = (has('ArrowRight') || has('KeyD') ? 1 : 0) - (has('ArrowLeft') || has('KeyA') ? 1 : 0);
  let gas = has('ArrowUp') || has('KeyW') || has('KeyJ');
  let brake = has('ArrowDown') || has('KeyS');
  let drift = DRIFT.some(has);
  backHeld = brake;
  lookBack = has('KeyC');
  const p = readPad();
  if (p) { if (Math.abs(p.steer) > Math.abs(steer)) steer = p.steer; gas = gas || p.gas; brake = brake || p.brake; drift = drift || p.drift; backHeld = backHeld || p.back; }
  if (isTouch) { if (Math.abs(touch.steer) > Math.abs(steer)) steer = touch.steer; drift = drift || touch.drift; brake = brake || touch.brake; gas = gas || (autoGas && !touch.brake); backHeld = backHeld || touch.back; }
  return { steer, gas, brake, drift, lookBack };
}
export function takeItem() { const v = itemQueued; itemQueued = false; return v ? { back: backHeld } : null; }
export function takePause() { const v = pauseQueued; pauseQueued = false; return v; }
export function resetInput() { keys.clear(); itemQueued = false; pauseQueued = false; touch.steer = 0; touch.drift = touch.brake = false; }
