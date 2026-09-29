// CPU racers: follow a personal racing line with look-ahead, drift real corners for
// mini-turbos, dodge hazards, use items tactically, and mild rubber-banding.
export function createAI(kart, skill, personality) {
  return {
    kart, skill, lineOffset: (Math.random() - 0.5) * 0.9, wobbleT: Math.random() * 10, itemDelay: 1 + Math.random() * 2,
    personality, holdDrift: false,
    think(dt, track, karts, player, objects, useItem) {
      const k = kart, t = track, N = t.N;
      this.wobbleT += dt;
      const look = Math.floor(6 + Math.max(0, k.speed) * 0.34);
      const ahead = t.samples[(k.idx + look) % N], far = t.samples[(k.idx + look * 2) % N];
      // Corner sharpness ahead.
      let turn = far.heading - t.samples[k.idx].heading; while (turn > Math.PI) turn -= Math.PI * 2; while (turn < -Math.PI) turn += Math.PI * 2;
      // Take the inside line on corners, personal line on straights.
      const inside = Math.max(-0.7, Math.min(0.7, -turn * 1.6));
      let desiredLat = (this.lineOffset * (1 - Math.min(1, Math.abs(turn) * 2)) + inside) * t.halfW * 0.8 + Math.sin(this.wobbleT * 0.7) * 1.2;
      // Dodge hazards directly ahead.
      for (const o of objects) {
        if (o.owner === k && o.arm > 0) continue;
        const d = (o.idx - k.idx + N) % N;
        if (d > 1 && d < 16) { const l = t.locate(o.pos, o.idx).lat; if (Math.abs(l - desiredLat) < 3.2 && this.skill > 0.55) desiredLat = l + (l > 0 ? -5 : 5); }
      }
      // Aim at a point on the racing line.
      const tx = ahead.p.x + ahead.r.x * desiredLat, tz = ahead.p.z + ahead.r.z * desiredLat;
      let want = Math.atan2(tx - k.pos.x, tz - k.pos.z) - k.yaw; while (want > Math.PI) want -= Math.PI * 2; while (want < -Math.PI) want += Math.PI * 2;
      let steer = Math.max(-1, Math.min(1, -want * 2.6));
      const sharp = Math.abs(turn) > 0.45 && k.speed > 16 && this.skill > 0.4;
      // Drift: start on sharp corners, release when the corner ends or charge is good.
      let drift = false;
      if (k.drift !== 0) {
        drift = Math.abs(turn) > 0.18 && !(k.tier >= (this.skill > 0.85 ? 3 : 2) && Math.abs(turn) < 0.35);
        steer = Math.max(-1, Math.min(1, steer * 1.2));
      } else if (sharp && Math.sign(-turn) === Math.sign(steer || -turn)) { drift = true; steer = -Math.sign(turn); }
      if (k.drift === 0 && this.holdDrift && !sharp) drift = false;
      this.holdDrift = drift;
      // Rubber band: trail -> small boost; lead -> ease off. Scaled by cc skill.
      const gap = (player.progress - k.progress) / N;
      k.aiBoost = Math.max(0.9, Math.min(1.1, 1 + gap * 0.3)) * (0.9 + this.skill * 0.12);
      // Items.
      if (k.item && k.roulette <= 0) {
        this.itemDelay -= dt;
        if (this.itemDelay <= 0) {
          const it = k.item, ahead1 = karts.find(o => o.place === k.place - 1), behind1 = karts.find(o => o.place === k.place + 1);
          let go = false, back = false;
          if (it === 'mushroom' || it === 'triple' || it === 'star') go = Math.abs(turn) < 0.25;
          else if (it === 'coin' || it === 'bolt' || it === 'blue') go = true;
          else if (it === 'red') go = !!ahead1 && ahead1.pos.distanceTo(k.pos) < 60;
          else if (it === 'green') { if (ahead1 && ahead1.pos.distanceTo(k.pos) < 22 && Math.abs(want) < 0.15) go = true; else if (behind1 && behind1.pos.distanceTo(k.pos) < 10) { go = true; back = true; } }
          else if (it === 'banana') go = !!behind1 && behind1.pos.distanceTo(k.pos) < 18 || Math.random() < 0.01;
          if (go) { useItem(k, back); this.itemDelay = 0.6 + Math.random() * 2.2; }
        }
      }
      return { steer, gas: true, brake: false, drift };
    }
  };
}
