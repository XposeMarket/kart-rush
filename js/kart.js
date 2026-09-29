import * as THREE from './vendor/three.module.js';
import { buildKart } from './models.js';

// Arcade kart physics: hop-drift with 3 mini-turbo tiers, slide/grip, ramps + tricks,
// dash pads, off-road, walls, falling + respawn, spin-outs, star, shrink, coins.
const GRAV = 34;
const TIER_AT = [0, 0.9, 2.0, 3.3];
const TIER_BOOST = [0, 0.7, 1.25, 1.9];
export const TIER_COLORS = ['#ffffff', '#4fb8ff', '#ff9a1f', '#d45bff'];
const wrapAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Kart {
  constructor({ ch, kart, cls, track, isPlayer = false, name }) {
    this.ch = ch; this.kartDef = kart; this.cls = cls; this.track = track; this.isPlayer = isPlayer; this.name = name || ch.name;
    this.mesh = buildKart(kart, ch);
    const st = k => ch[k] + kart[k];
    this.top = cls.top * 0.78 * (0.9 + st('speed') * 0.022);
    this.accel = 16 + st('accel') * 2.6;
    this.handling = 1.35 + st('handling') * 0.1;
    this.weight = st('weight');
    this.offMul = 0.45 + kart.offroad * 0.07;
    this.reset();
  }
  reset() {
    this.pos = new THREE.Vector3(); this.yaw = 0; this.moveYaw = 0; this.speed = 0; this.vy = 0; this.grounded = true;
    this.idx = 0; this.prevIdx = 0; this.crossings = 0; this.progress = 0; this.lat = 0; this.finished = false; this.finishTime = 0; this.place = 1;
    this.drift = 0; this.driftCharge = 0; this.tier = 0; this.hopT = 0; this.driftHeldPrev = false;
    this.boost = 0; this.boostPower = 1; this.stun = 0; this.spin = 0; this.star = 0; this.shrink = 0; this.invuln = 0; this.squash = 0;
    this.item = null; this.charges = 0; this.roulette = 0; this.coins = 0; this.trick = 0; this.trickReady = false; this.airT = 0;
    this.offroad = false; this.falling = 0; this.respawnIdx = 0; this.wallHit = 0; this.steerVis = 0; this.pitch = 0; this.bank = 0;
  }
  placeAt(i, lat) {
    const t = this.track, s = t.samples[((i % t.N) + t.N) % t.N];
    this.pos.copy(t.pointAt(i, lat)); this.yaw = this.moveYaw = s.heading; this.idx = this.prevIdx = ((i % t.N) + t.N) % t.N; this.lat = lat;
    this.syncMesh(0);
  }
  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get tierColor() { return TIER_COLORS[this.tier]; }
  get isDrifting() { return this.drift !== 0 && this.grounded; }

  applyBoost(t, power = 1) { this.boost = Math.max(this.boost, t); this.boostPower = Math.max(power, this.boost > 0 ? this.boostPower : 1); }
  hit(kind = 'spin') {
    if (this.star > 0 || this.invuln > 0 || this.falling) return false;
    const heavy = kind === 'blast';
    this.stun = heavy ? 1.8 : 1.15; this.spin = heavy ? 2 : 1; this.speed *= heavy ? 0.1 : 0.3; this.drift = 0; this.driftCharge = 0; this.tier = 0; this.boost = 0;
    if (heavy) { this.vy = 11; this.grounded = false; }
    this.invuln = this.stun + 0.9; this.coins = Math.max(0, this.coins - (heavy ? 3 : 2));
    return true;
  }
  shrinkHit() { if (this.star > 0) return; this.shrink = 6; this.hit('spin'); this.invuln = 0.4; }

  update(dt, input, events) {
    const t = this.track, N = t.N;
    this.invuln = Math.max(0, this.invuln - dt); this.star = Math.max(0, this.star - dt); this.shrink = Math.max(0, this.shrink - dt);
    this.squash = Math.max(0, this.squash - dt); this.wallHit = Math.max(0, this.wallHit - dt);
    if (this.falling > 0) {
      this.falling -= dt;
      if (this.falling <= 0) { const i = this.respawnIdx; this.placeAt(i, 0); this.speed = 6; this.vy = 0; this.grounded = true; this.invuln = 1.5; events.push({ type: 'respawn', kart: this }); }
      else if (this.falling < 0.9) { const target = t.pointAt(this.respawnIdx, 0, 4); this.pos.lerp(target, Math.min(1, dt * 6)); this.syncMesh(dt); return; }
      this.pos.y -= 18 * dt; this.syncMesh(dt); return;
    }
    const controllable = this.stun <= 0 && !this.finished;
    const inp = controllable ? input : { steer: 0, gas: this.finished, brake: false, drift: false };
    if (this.stun > 0) this.stun -= dt;

    // Longitudinal.
    const loc = t.locate(this.pos, this.idx);
    this.idx = loc.i; this.lat = loc.lat;
    const ice = t.isIce(this.idx);
    this.offroad = Math.abs(loc.lat) > t.edge && !this.star && this.boost <= 0;
    const coinBonus = 1 + this.coins * 0.006;
    let target = inp.gas ? this.top * coinBonus : 0;
    if (this.finished) target = this.top * 0.6;
    if (this.offroad && this.grounded) target *= this.offMul;
    if (this.shrink > 0) target *= 0.78;
    if (this.boost > 0) target = Math.max(target, this.top * (1.28 + 0.06 * this.boostPower));
    if (this.star > 0) target = Math.max(target, this.top * 1.22);
    if (this.aiBoost) target *= this.aiBoost;
    if (inp.brake && !this.drift) target = this.speed > 1 ? 0 : -this.top * 0.35;
    const rate = this.speed < target ? (this.boost > 0 ? 60 : this.accel * (1.2 - Math.max(0, this.speed) / (this.top * 1.6))) : (inp.brake ? 38 : this.offroad ? 30 : 12);
    this.speed += Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), rate * dt);
    this.boost = Math.max(0, this.boost - dt);

    // Hop / drift.
    const pressed = inp.drift && !this.driftHeldPrev;
    this.driftHeldPrev = inp.drift;
    if (pressed && this.grounded && this.speed > 4) { this.vy = 4.8; this.grounded = false; this.hopT = 0.2; events.push({ type: 'hop', kart: this }); }
    if (!this.grounded && inp.drift && this.drift === 0 && Math.abs(inp.steer) > 0.25 && this.speed > 9 && this.hopT > 0) this.pendingDrift = Math.sign(inp.steer);
    if (this.grounded && this.pendingDrift) { this.drift = this.pendingDrift; this.pendingDrift = 0; this.driftCharge = 0; this.tier = 0; }
    if (this.drift !== 0 && (!inp.drift || this.speed < 7 || this.offroad && !this.boost)) {
      if (this.tier > 0 && inp.drift === false) { this.applyBoost(TIER_BOOST[this.tier], this.tier); events.push({ type: 'miniturbo', kart: this, tier: this.tier }); }
      this.drift = 0; this.driftCharge = 0; this.tier = 0;
    }
    this.hopT = Math.max(0, this.hopT - dt);

    // Steering.
    const speedK = THREE.MathUtils.clamp(Math.abs(this.speed) / 9, 0, 1) * Math.sign(this.speed || 1) * (1 - Math.min(0.25, Math.abs(this.speed) / 140));
    let yawRate;
    if (this.drift !== 0 && this.grounded) {
      const inward = inp.steer * this.drift; // +1 tight, -1 wide
      yawRate = -this.drift * this.handling * (0.72 + inward * 0.42);
      this.driftCharge += dt * (1 + Math.max(0, inward) * 0.7);
      const tier = this.driftCharge >= TIER_AT[3] ? 3 : this.driftCharge >= TIER_AT[2] ? 2 : this.driftCharge >= TIER_AT[1] ? 1 : 0;
      if (tier !== this.tier) { this.tier = tier; events.push({ type: 'tier', kart: this, tier }); }
    } else {
      yawRate = -inp.steer * this.handling * (this.grounded ? 1 : 0.5) * speedK;
    }
    if (this.spin > 0) { yawRate = 0; this.spin -= dt; }
    this.yaw = wrapAngle(this.yaw + yawRate * dt);
    const grip = this.drift ? 3.4 : ice ? 1.6 : (this.grounded ? 9 : 1.2);
    this.moveYaw = wrapAngle(this.moveYaw + wrapAngle(this.yaw - this.moveYaw) * Math.min(1, grip * dt));
    this.steerVis = THREE.MathUtils.lerp(this.steerVis, inp.steer, Math.min(1, dt * 10));

    // Integrate.
    this.pos.x += Math.sin(this.moveYaw) * this.speed * dt;
    this.pos.z += Math.cos(this.moveYaw) * this.speed * dt;

    // Walls.
    const l2 = t.locate(this.pos, this.idx), side = l2.lat > 0 ? 1 : 0, wallAt = t.edge + 0.2 - 1.1;
    if (Math.abs(l2.lat) > wallAt && t.wallSide[side][l2.i] && this.pos.y < t.surfaceY(l2.s, l2.lat) + 3) {
      const push = Math.abs(l2.lat) - wallAt, sgn = Math.sign(l2.lat);
      this.pos.x -= l2.s.r.x * push * sgn; this.pos.z -= l2.s.r.z * push * sgn;
      const along = l2.s.heading, into = Math.abs(Math.sin(wrapAngle(this.moveYaw - along)));
      this.speed *= 1 - Math.min(0.55, into * 0.9); this.yaw = wrapAngle(this.yaw + wrapAngle(along - this.yaw) * 0.35); this.moveYaw = wrapAngle(this.moveYaw + wrapAngle(along - this.moveYaw) * 0.6);
      if (into > 0.2 && this.wallHit <= 0) { this.wallHit = 0.3; events.push({ type: 'wall', kart: this }); }
    }

    // Vertical: ground follow, ramps, air, falling.
    const l3 = t.locate(this.pos, this.idx); this.idx = l3.i; this.lat = l3.lat;
    const ground = t.groundAt(l3.i, l3.lat);
    for (const r of t.ramps) {
      const d = (l3.i - r.i + N) % N;
      if (d >= 1 && d < 3 && this.grounded && this.speed > 8 && Math.abs(l3.lat) < t.halfW) { this.vy = 8 + this.speed * 0.14; this.grounded = false; this.trickReady = true; this.airT = 0; events.push({ type: 'ramp', kart: this }); }
    }
    for (const p of t.pads) {
      const d = (l3.i - p.i + N) % N;
      if (d < 3 && Math.abs(l3.lat - p.lat) < 3 && this.grounded && this.boost < 0.9) { this.applyBoost(1.1, 2); events.push({ type: 'pad', kart: this }); }
    }
    if (this.grounded) {
      if (!isFinite(ground) || ground < this.pos.y - 1.2) { this.grounded = false; this.vy = 0; }
      else { this.pos.y = THREE.MathUtils.lerp(this.pos.y, ground, Math.min(1, dt * 20)); }
    }
    if (!this.grounded) {
      this.vy -= GRAV * dt; this.pos.y += this.vy * dt; this.airT += dt;
      if (this.trickReady && pressed && this.airT > 0.05) { this.trick = 0.45; this.trickReady = false; events.push({ type: 'trick', kart: this }); }
      if (isFinite(ground) && this.pos.y <= ground && this.vy <= 0) {
        this.pos.y = ground; this.vy = 0; this.grounded = true;
        if (this.trick > 0 || this.trickDone) { this.applyBoost(0.9, 2); events.push({ type: 'trickboost', kart: this }); }
        this.trickDone = false; this.trickReady = false;
        if (this.airT > 0.35) events.push({ type: 'land', kart: this });
      }
      if (this.pos.y < (isFinite(ground) ? ground : t.samples[l3.i].p.y) - 20 || (!isFinite(ground) && this.pos.y < t.samples[l3.i].p.y - 8)) this.fallOff(events);
    }
    if (this.trick > 0) { this.trick -= dt; if (this.trick <= 0) this.trickDone = !this.grounded; }
    if (t.def.lavaEdge && this.grounded && Math.abs(l3.lat) > t.edge + 5) this.fallOff(events);

    // Progress / laps.
    const d = this.idx - this.prevIdx;
    if (d < -N / 2) this.crossings++; else if (d > N / 2) this.crossings--;
    this.prevIdx = this.idx;
    this.progress = (this.crossings - 1) * N + this.idx + l3.along / 2;
    this.syncMesh(dt);
  }
  fallOff(events) {
    if (this.falling) return;
    this.falling = 1.8; this.speed = 0; this.drift = 0; this.tier = 0; this.boost = 0; this.coins = Math.max(0, this.coins - 1);
    this.respawnIdx = (this.idx - 4 + this.track.N) % this.track.N; events.push({ type: 'fall', kart: this });
  }

  syncMesh(dt) {
    const m = this.mesh, u = m.userData, t = this.track;
    m.position.copy(this.pos); m.rotation.y = this.yaw;
    const s = t.samples[this.idx];
    const bankTarget = this.grounded ? -s.bank : 0;
    this.bank = THREE.MathUtils.lerp(this.bank, bankTarget, Math.min(1, dt * 8));
    const slopeAhead = t.samples[(this.idx + 2) % t.N].p.y - t.samples[(this.idx - 2 + t.N) % t.N].p.y;
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.grounded ? -Math.atan2(slopeAhead, 8) : -this.vy * 0.015, Math.min(1, dt * 8));
    const driftYaw = this.drift ? this.drift * -0.42 : 0;
    u.tilt.rotation.order = 'YXZ';
    u.tilt.rotation.y = THREE.MathUtils.lerp(u.tilt.rotation.y, driftYaw + (this.spin > 0 ? this.spin * Math.PI * 4 : 0), this.spin > 0 ? 1 : Math.min(1, dt * 9));
    u.tilt.rotation.x = this.pitch;
    u.tilt.rotation.z = this.bank * Math.cos(this.yaw - s.heading) + (u.bike ? this.steerVis * 0.35 + this.drift * 0.25 : this.steerVis * 0.05) + (this.trick > 0 ? Math.sin(this.trick / 0.45 * Math.PI) * 0.8 : 0);
    u.tilt.position.y = this.hopT > 0 ? Math.sin(this.hopT / 0.2 * Math.PI) * 0.1 : 0;
    const scale = this.shrink > 0 ? 0.55 : 1; const sq = this.squash > 0 ? 0.35 : 1;
    m.scale.set(scale, scale * sq, scale);
    for (const w of u.wheels) w.children.forEach(c => { if (c.geometry && c.geometry.type !== 'CylinderGeometry') c.rotation.x += this.speed * dt * 1.6; });
    u.driver.rotation.y = -this.steerVis * 0.3; u.driver.rotation.z = this.steerVis * 0.08;
    const ground = t.groundAt(this.idx, this.lat);
    u.blob.position.y = (isFinite(ground) ? ground : -999) - this.pos.y + 0.05; u.blob.visible = isFinite(ground) && this.pos.y - ground < 12;
    m.visible = this.invuln > 0 && !this.falling && !this.star ? Math.floor(performance.now() / 70) % 2 === 0 || this.stun > 0 : true;
    if (this.star > 0) u.tilt.traverse(o => { if (o.isMesh && o.material.emissive && !o.material.userData.shared) { o.material.emissive.setHSL((performance.now() / 300) % 1, 1, 0.35); } });
    else if (this._wasStar) u.tilt.traverse(o => { if (o.isMesh && o.material.emissive && !o.material.userData.shared) o.material.emissive.setRGB(0, 0, 0); });
    this._wasStar = this.star > 0;
  }
}
