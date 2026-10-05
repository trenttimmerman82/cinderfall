'use strict';
/* Cinderfall — The Eleventh Hour runtime: what's particular to the Western Front.
   · Gas: shells burst into a yellow-green cloud that drifts and thins. Inside it without your mask you choke (damage,
     coughing, blurred sight). The mask (T by default, the gadget key) takes a moment to pull on; through it you see two
     fogged eyepieces and hear yourself breathe.
   · Artillery: barrages that walk across an area, each round announced by its whistle.
   · Fat Annie: a Mark IV tank that grinds along its route at walking pace. It's cover (a moving collider), its sponson
     guns shoot at what they see, and the field gun ahead of it is what can stop it.
   · The Bristol: you ride in the observer's seat, the pilot flies a long loop, Fokkers hunt you (their own pursuit AI).
   · Flamethrowers close in and hose the trench; stormtroopers rush with stick grenades (the sapper brain).
   · The bells at eleven. Hiders, spotting, flares and mortars come from js/jungle.js. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio, L = CF.Level, E = CF.Enemies;
  const PI = Math.PI;
  const $ = (id) => document.getElementById(id);
  const F = CF.Front = { on: false, clouds: [], mask: 0, maskOn: false, maskT: 0, tank: null, plane: null, barrages: [], choke: 0 };
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3();

  // ---------------------------------------------------------------- gas
  /** A gas shell lands: the cloud grows for a few seconds, drifts with the wind (wx, wz), then thins out. */
  F.gas = function (x, z, o) {
    o = o || {};
    const y = W.groundHeight(x, 20, z);
    F.clouds.push({ x, z, y, r: 1, rMax: o.r || 9, t: 0, life: o.life || 45, wx: o.wx != null ? o.wx : 0.25, wz: o.wz != null ? o.wz : 0.35 });
    A.play('gasShell', { x, y, z }, { ref: 14 });
    if (!F.warned || CF.time - F.warned > 20) { F.warned = CF.time; CF.Game.later(0.6, () => A.play('gasRattle', null, { ui: true, vol: 0.7 })); }
  };
  /** How thick the gas is where you stand (0 none, 1 choking). */
  F.gasAt = function (p) {
    let k = 0;
    for (const c of F.clouds) {
      if (p.y > c.y + 4) continue;
      const d = Math.hypot(p.x - c.x, p.z - c.z); if (d > c.r) continue;
      const fade = U.clamp((c.life - c.t) / 8, 0, 1);
      k = Math.max(k, (1 - (d / c.r) * 0.6) * fade);
    }
    return k;
  };
  function gas(dt) {
    const P = CF.Player;
    for (let i = F.clouds.length - 1; i >= 0; i--) {
      const c = F.clouds[i]; c.t += dt;
      c.r = Math.min(c.rMax, c.r + dt * 3); c.x += c.wx * dt; c.z += c.wz * dt;
      const fade = U.clamp((c.life - c.t) / 8, 0, 1);
      // the cloud itself: low, rolling, sickly yellow-green; it pours down into the trenches
      const n = Math.round(dt * 26 * (0.4 + fade));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * PI * 2, r = Math.sqrt(Math.random()) * c.r, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        const gy = W.groundHeight(x, c.y + 3, z);
        CF.FX.smoke.spawn(x, gy + 0.3 + Math.random() * 0.8, z, c.wx + U.gauss() * 0.2, U.rand(0.02, 0.15), c.wz + U.gauss() * 0.2, U.rand(4, 7), 1.2, 3.4, 0.62, 0.62, 0.28, 0.55 * fade, -0.05, 0.25, 1);
      }
      if (c.t > c.life) F.clouds.splice(i, 1);
    }
    // the mask
    const inp = CF.Input, want = inp.hit && inp.hit('KeyT') && P.alive && CF.Game.state === 'playing';
    if (want && F.maskT <= 0) { F.maskOn = !F.maskOn; F.maskT = 0.9; A.play('rustle', null, { ui: true }); }
    F.maskT -= dt;
    F.mask = U.damp(F.mask, F.maskOn ? 1 : 0, F.maskT > 0 ? 4 : 10, dt);
    const el = $('gasMask'); if (el) { el.style.opacity = (F.mask * 0.95).toFixed(2); el.hidden = F.mask < 0.02; }
    if (F.maskOn && F.mask > 0.6 && !F.breath && CF.Game.audioOn) { F.breath = A.loop('breath'); if (F.breath) F.breath.set(0.12, 0.3); }
    if ((!F.maskOn || !P.alive) && F.breath) { F.breath.stop(); F.breath = null; }
    // choking
    const g = P.alive ? F.gasAt(P.body.pos) : 0, protectedK = F.mask > 0.85 ? 1 : 0;
    F.choke = U.damp(F.choke, g * (1 - protectedK), 3, dt);
    if (g > 0.05 && !protectedK) {
      F.dmgAcc = (F.dmgAcc || 0) + dt * g * 9;
      if (F.dmgAcc > 3) { P.damage(F.dmgAcc, null, 'gas'); F.dmgAcc = 0; A.play('hurt', null, { vol: 0.5 }); }
      if (!F.toldMask || CF.time - F.toldMask > 6) { F.toldMask = CF.time; CF.HUD.hint('GAS! Put your mask on · ' + CF.Keys.label('gadget'), true); }
    }
    if (F.choke > 0.05) CF.HUD.suppressV = Math.max(CF.HUD.suppressV, F.choke * 0.9); // choking blurs and darkens the edges
  }

  // ---------------------------------------------------------------- artillery
  /** Shells falling on a rectangle [x0, z0, x1, z1] every so often; none closer to you than `spare` metres. */
  F.barrage = function (rect, o) {
    o = o || {};
    const b = { rect, every: o.every || [1.5, 3], t: o.delay || 0, spare: o.spare != null ? o.spare : 7, damage: o.damage || 90, gas: o.gas || 0, until: o.until || Infinity, id: o.id };
    F.barrages.push(b); return b;
  };
  F.stopBarrage = function (id) { F.barrages = F.barrages.filter((b) => b.id !== id); };
  function barrages(dt) {
    const pp = CF.Player.body.pos;
    for (let i = F.barrages.length - 1; i >= 0; i--) {
      const b = F.barrages[i]; b.t -= dt; b.until -= dt;
      if (b.until <= 0) { F.barrages.splice(i, 1); continue; }
      if (b.t > 0) continue;
      b.t = U.rand(b.every[0], b.every[1]);
      let x, z, tries = 0;
      do { x = U.lerp(b.rect[0], b.rect[2], Math.random()); z = U.lerp(b.rect[1], b.rect[3], Math.random()); } while (Math.hypot(x - pp.x, z - pp.z) < b.spare && ++tries < 8);
      if (Math.hypot(x - pp.x, z - pp.z) < b.spare) continue;
      if (b.gas && Math.random() < b.gas) { const xx = x, zz = z; A.play('incoming', { x, y: 10, z }, { ref: 30 }); CF.Game.later(1.4, () => F.gas(xx, zz)); }
      else CF.Jungle.mortarRound(x, z, { damage: b.damage });
    }
  }

  // ---------------------------------------------------------------- Fat Annie
  class Tank {
    constructor(route) {
      this.root = CF.StoryModels.markIV(); CF.Game.scene.add(this.root);
      this.route = route.map((p) => new THREE.Vector3(p[0], 0, p[1])); this.i = 1;
      this.pos = this.route[0].clone(); this.yaw = Math.atan2(-(this.route[1].x - this.pos.x), -(this.route[1].z - this.pos.z));
      this.speed = 1.6; this.hp = 100; this.stopped = false; this.fireT = 2; this.target = null; this.sound = null; this.smoke = 0; this.done = false;
      // one collider for the hull: registered across the whole route so it can move without re-gridding
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of this.route) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
      this.col = W.add(x0 - 6, -1, z0 - 6, x1 + 6, 2.6, z1 + 6, { surf: 'metal', nav: false });
      this.fit();
    }
    fit() {
      const c = Math.abs(Math.cos(this.yaw)), s = Math.abs(Math.sin(this.yaw)), hx = 2.3 * c + 3.6 * s, hz = 2.3 * s + 3.6 * c, b = this.col;
      b.minX = this.pos.x - hx; b.maxX = this.pos.x + hx; b.minZ = this.pos.z - hz; b.maxZ = this.pos.z + hz; b.minY = this.pos.y - 0.5; b.maxY = this.pos.y + 2.6;
    }
    update(dt) {
      if (!this.stopped && !this.done) {
        const tg = this.route[this.i];
        if (!tg) { this.done = true; if (this.onArrive) this.onArrive(this); }
        else {
          const dx = tg.x - this.pos.x, dz = tg.z - this.pos.z, l = Math.hypot(dx, dz);
          if (l < 1.5) this.i++;
          else {
            this.yaw += U.clamp(U.wrapAngle(Math.atan2(-dx, -dz) - this.yaw), -0.25 * dt, 0.25 * dt);
            const sp = this.speed * (this.throttle == null ? 1 : this.throttle);
            this.pos.x += -Math.sin(this.yaw) * sp * dt; this.pos.z += -Math.cos(this.yaw) * sp * dt;
          }
        }
      }
      // ride over the ground (and over trenches: it bridges them)
      const gy = Math.max(CF.MapWestern.height(this.pos.x, this.pos.z), CF.MapWestern.height(this.pos.x + Math.sin(this.yaw) * 3, this.pos.z + Math.cos(this.yaw) * 3) * 0.5, -0.8);
      this.pos.y = U.damp(this.pos.y, gy, 3, dt);
      const moving = !this.stopped && !this.done;
      this.root.position.copy(this.pos); this.root.rotation.set(Math.sin(CF.time * 2.2) * 0.012 * (moving ? 1 : 0), this.yaw, Math.sin(CF.time * 1.7) * 0.01 * (moving ? 1 : 0), 'YXZ');
      this.fit();
      // push you out of the hull rather than letting you clip in
      const P = CF.Player, pp = P.body.pos, b = this.col;
      if (pp.x > b.minX - 0.3 && pp.x < b.maxX + 0.3 && pp.z > b.minZ - 0.3 && pp.z < b.maxZ + 0.3 && pp.y < b.maxY - 0.2) {
        const dl = pp.x - (b.minX - 0.3), dr = b.maxX + 0.3 - pp.x, df = pp.z - (b.minZ - 0.3), dk = b.maxZ + 0.3 - pp.z, m = Math.min(dl, dr, df, dk);
        if (m === dl) pp.x -= dl; else if (m === dr) pp.x += dr; else if (m === df) pp.z -= df; else pp.z += dk;
      }
      if (!this.sound && CF.Game.audioOn) { this.sound = A.loop('tank', this.pos); if (this.sound) this.sound.set(0.45, 0.4); }
      if (this.sound && this.sound.panner && this.sound.panner.positionX) { const p = this.sound.panner; p.positionX.value = this.pos.x; p.positionY.value = this.pos.y + 1.5; p.positionZ.value = this.pos.z; this.sound.pitch(moving ? 36 : 26, 0.5); }
      if (moving && Math.random() < 0.6) CF.FX.smoke.spawn(this.pos.x + Math.sin(this.yaw) * 2.4, this.pos.y + 3, this.pos.z + Math.cos(this.yaw) * 2.4, U.gauss() * 0.3, 1, U.gauss() * 0.3, 2, 0.5, 2.2, 0.12, 0.11, 0.1, 0.5, -0.1, 0.3, 1);
      if (this.smoke > 0) for (let i = 0; i < 2; i++) CF.FX.smoke.spawn(this.pos.x + U.gauss() * 0.6, this.pos.y + 2.6, this.pos.z + U.gauss() * 0.6, U.gauss() * 0.4, 1.4, U.gauss() * 0.4, 3, 0.8, 3.5, 0.05, 0.045, 0.04, 0.8, -0.2, 0.3, 1);
      this.guns(dt);
    }
    /** The sponson 6-pounders and Lewis guns: shoot at whatever they can see, both sides. */
    guns(dt) {
      this.fireT -= dt;
      if (this.fireT > 0) return;
      this.fireT = U.rand(0.9, 1.8);
      let best = null, bd = 60;
      const from = _v.set(this.pos.x, this.pos.y + 1.4, this.pos.z);
      for (const e of E.list) { if (!e.alive || e.net || e.T.flying) continue; const d = e.body.pos.distanceTo(from); if (d > bd) continue; e.center(_c); if (!W.segmentClear(from.x, from.y + 0.8, from.z, _c.x, _c.y, _c.z)) continue; bd = d; best = e; }
      if (!best) return;
      best.center(_c); const big = Math.random() < 0.25, muzzle = from.clone(), dir = _f.subVectors(_c, from).normalize();
      muzzle.addScaledVector(_w.set(dir.x, 0, dir.z).normalize(), 2.6);
      if (big) { // the 6-pounder
        CF.FX.muzzle(muzzle, dir, 5, 3, 1.2, 1.2); A.play('fieldGun', muzzle, { ref: 12, vol: 0.7 });
        CF.Game.later(0.15, () => CF.Game.explode(_c.clone().add(new THREE.Vector3(U.gauss(), 0, U.gauss())), { radius: 3.5, damage: 120, source: 'npc', scale: 0.7, noSelf: true }));
      } else {
        for (let k = 0; k < 5; k++) CF.Game.later(k * 0.1, () => { if (!best.alive) return; const aim = best.center(new THREE.Vector3()).add(new THREE.Vector3(U.gauss() * 0.8, U.gauss() * 0.5, U.gauss() * 0.8)); CF.FX.tracer(muzzle, aim, { speed: 380, len: 4, w: 0.025, r: 4, g: 2.6, b: 1.2 }); A.play('lewis', muzzle, { ref: 8, vol: 0.5 }); if (Math.random() < 0.3) best.damage(18, { dir: dir.clone(), point: aim, normal: null, part: null, weapon: null, source: 'npc', from: muzzle.clone(), knock: 1 }); });
      }
    }
    hit(dmg) {
      this.hp -= dmg; this.smoke = this.hp < 60 ? 1 : 0;
      CF.FX.explosion(_v.set(this.pos.x + U.gauss(), this.pos.y + 1.6, this.pos.z + U.gauss()), 0.9); A.play('bigBoom', this.pos, { ref: 14 });
      if (this.onHit) this.onHit(this);
    }
    remove() { if (this.sound) { this.sound.stop(); this.sound = null; } CF.Game.scene.remove(this.root); this.col.enabled = false; }
  }
  F.Tank = Tank;
  F.addTank = function (route) { if (F.tank) F.tank.remove(); F.tank = new Tank(route); return F.tank; };

  /** The field gun: lays on the tank and fires every few seconds (a flash, a crack, a hit or a near miss). */
  F.fieldGun = function (x, z, yaw) {
    const e = E.spawn('fieldgun', x, z, { yaw, tag: 'gun' });
    e.gunT = 5; e.brain = function (dt) {
      const t = F.tank;
      if (t && !this.gunnerDead) {
        const dx = t.pos.x - this.body.pos.x, dz = t.pos.z - this.body.pos.z;
        this.turretYaw = U.damp(this.turretYaw || 0, U.wrapAngle(Math.atan2(-dx, -dz) - this.yaw), 1.5, dt);
        this.gunT -= dt;
        if (this.gunT <= 0 && Math.hypot(dx, dz) < 90 && t.i >= 4) { // it opens up once Annie's through the second line
          this.gunT = U.rand(6, 9); this.recoil = 1;
          const muzzle = this.m.p.muzzle.getWorldPosition(new THREE.Vector3());
          CF.FX.muzzle(muzzle, _f.set(dx, 0, dz).normalize(), 6, 3, 1, 1.6); CF.FX.flashLight(muzzle, 0xffa050, 12, 20, 0.15); A.play('fieldGun', muzzle, { ref: 20 });
          const hitIt = Math.random() < 0.6, at = new THREE.Vector3(t.pos.x + (hitIt ? 0 : U.gauss() * 6), t.pos.y + 1, t.pos.z + (hitIt ? 0 : U.gauss() * 6));
          CF.Game.later(0.25, () => { if (hitIt) t.hit(22); else CF.Game.explode(at, { radius: 4, damage: 70, source: 'enemy', killer: 'a field gun', scale: 1 }); });
        }
      }
      this.recoil = Math.max(0, (this.recoil || 0) - dt * 2);
      this.state = 'combat'; this.pose(dt, 0);
    };
    return e;
  };

  // ---------------------------------------------------------------- the Bristol and the Fokkers
  class Plane {
    constructor(points, speed) {
      this.root = CF.StoryModels.bristol(); CF.Game.scene.add(this.root);
      this.curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.5);
      this.len = this.curve.getLength(); this.t = 0; this.speed = speed || 32; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.roll = 0; this.prevYaw = 0; this.sound = null;
      this.curve.getPointAt(0, this.pos); this.apply(0);
    }
    update(dt) {
      if (this.t < 1) {
        const prev = _w.copy(this.pos);
        this.t = Math.min(1, this.t + this.speed * (this.throttle == null ? 1 : this.throttle) * dt / this.len);
        this.curve.getPointAt(this.t, this.pos);
        this.vel.subVectors(this.pos, prev).divideScalar(Math.max(dt, 1e-3));
        const tan = this.curve.getTangentAt(Math.min(0.999, this.t + 0.002), _v);
        const want = Math.atan2(-tan.x, -tan.z), dy = U.wrapAngle(want - this.yaw);
        this.yaw += U.clamp(dy, -1.2 * dt, 1.2 * dt);
        this.pitch = U.damp(this.pitch, Math.asin(U.clamp(tan.y, -0.9, 0.9)), 3, dt);
        const yawRate = U.wrapAngle(this.yaw - this.prevYaw) / Math.max(dt, 1e-3);
        this.roll = U.damp(this.roll, U.clamp(yawRate * 1.1, -0.8, 0.8) + Math.sin(CF.time * 1.3) * 0.03, 2, dt);
        if (this.t >= 1 && this.onArrive) { const f = this.onArrive; this.onArrive = null; f(this); }
      }
      this.dyaw = U.wrapAngle(this.yaw - this.prevYaw); this.prevYaw = this.yaw;
      this.apply(dt);
      this.root.userData.prop.rotation.z += dt * 70 * (this.t < 1 ? 1 : 0.2);
      if (!this.sound && CF.Game.audioOn) { this.sound = A.loop('rotary'); if (this.sound) this.sound.set(0.22, 0.4); }
      if (this.rider && this.rider.ride) { this.rider.ride.dyaw = (this.rider.ride.dyaw || 0) + this.dyaw; this.rider.ride.roll = this.roll * 0.7; }
      if (this.smoke) CF.FX.smoke.spawn(this.pos.x, this.pos.y + 1.2, this.pos.z, U.gauss() * 0.3, 0.5, U.gauss() * 0.3, 2.4, 0.5, 2.8, 0.06, 0.05, 0.05, 0.75, -0.1, 0.3, 1);
    }
    apply() { const r = this.root; r.position.copy(this.pos); r.rotation.set(this.pitch, this.yaw, -this.roll, 'YXZ'); r.updateMatrixWorld(true); }
    seat(out) { return out.set(0, 1.25, 0.95).applyMatrix4(this.root.matrixWorld); }
    board(P) { const self = this; P.ride = { get(out) { self.seat(out); }, dyaw: 0, roll: 0 }; this.rider = P; }
    unboard() { if (this.rider) { this.rider.ride = null; this.rider = null; } }
    remove() { if (this.sound) { this.sound.stop(); this.sound = null; } this.unboard(); CF.Game.scene.remove(this.root); }
  }
  F.Plane = Plane;
  F.addPlane = function (points, speed) { if (F.plane) F.plane.remove(); F.plane = new Plane(points, speed); return F.plane; };
  /** A Fokker that hunts the Bristol: swings wide, turns in for a firing pass from behind or the beam, breaks away. */
  F.fokker = function (x, y, z) {
    const e = E.spawn('fokker', x, z, { y, yaw: 0, tag: 'air', aware: true });
    e.body.pos.y = y; e.body.noSnap = true; e.body.vel.set(0, 0, -30);
    e.pass = 'swing'; e.passT = U.rand(2, 5); e.side = Math.random() < 0.5 ? -1 : 1; e.fireCd = 1;
    e.brain = fokkerBrain;
    return e;
  };
  function fokkerBrain(dt, P) {
    const e = this, b = e.body, pl = F.plane; if (!pl) return;
    e.state = 'combat'; e.passT -= dt;
    // where to go: wide of the Bristol on a swing, onto its tail for a pass
    const fwd = _f.set(-Math.sin(pl.yaw), 0, -Math.cos(pl.yaw)), side = _w.set(fwd.z, 0, -fwd.x);
    const tgt = _v.copy(pl.pos);
    if (e.pass === 'swing') { tgt.addScaledVector(side, e.side * 70).addScaledVector(fwd, 20); tgt.y += 18; if (e.passT <= 0) { e.pass = 'attack'; e.passT = U.rand(6, 9); } }
    else { tgt.addScaledVector(fwd, -14).addScaledVector(side, e.side * 6); tgt.y += 3; if (e.passT <= 0 || b.pos.distanceTo(pl.pos) < 14) { e.pass = 'swing'; e.passT = U.rand(4, 7); e.side = -e.side; } }
    const want = _c.subVectors(tgt, b.pos), dist = want.length(); want.normalize();
    const sp = U.clamp(30 + dist * 0.15, 30, 46);
    b.vel.lerp(want.multiplyScalar(sp), Math.min(1, dt * 0.9));
    b.pos.addScaledVector(b.vel, dt);
    const gy = W.groundHeight(b.pos.x, b.pos.y, b.pos.z); if (b.pos.y < gy + 15) { b.pos.y = gy + 15; b.vel.y = Math.abs(b.vel.y); }
    const yaw = Math.atan2(-b.vel.x, -b.vel.z), dyaw = U.wrapAngle(yaw - e.yaw);
    e.yaw = yaw; e.bank = U.damp(e.bank || 0, U.clamp(-dyaw / Math.max(dt, 1e-3) * 0.4, -0.9, 0.9), 3, dt); e.pitchV = Math.asin(U.clamp(b.vel.y / (b.vel.length() || 1), -0.8, 0.8));
    // guns: when the nose bears on you
    e.fireCd -= dt;
    const to = _w.subVectors(P.body.pos, b.pos), d = to.length(); to.divideScalar(d || 1);
    const nose = _f.copy(b.vel).normalize();
    if (e.pass === 'attack' && d < 150 && nose.dot(to) > 0.95 && e.fireCd <= 0) {
      e.fireCd = U.rand(1.2, 2.2) / CF.diff().aggro;
      const muzzle = e.m.p.muzzle.getWorldPosition(new THREE.Vector3());
      for (let k = 0; k < 8; k++) CF.Game.later(k * 0.07, () => { if (!e.alive) return; const aim = P.chestPos(new THREE.Vector3()).addScaledVector(P.body.vel, 0.1); const dir = aim.sub(muzzle).normalize(); const sp2 = 1.6 / CF.diff().acc * PI / 180; dir.x += U.gauss() * sp2; dir.y += U.gauss() * sp2; dir.z += U.gauss() * sp2; dir.normalize(); E.shoot('tracer', muzzle, dir, 220, e.T.dmg, e); A.play('pkmShot', muzzle, { ref: 20, vol: 0.6 }); });
    }
    e.pose(dt, 0);
  }

  // ---------------------------------------------------------------- flamethrowers
  F.flamer = function (e) { e.brain = flamerBrain; return e; };
  function flamerBrain(dt, P) {
    const e = this, b = e.body, pp = P.body.pos, dist = Math.hypot(pp.x - b.pos.x, pp.z - b.pos.z);
    if (e.state === 'idle' || e.state === 'patrol' || e.state === 'alert') { e.moveDir(0, 0, 0, dt); e.physics(dt); e.pose(dt, 0); return; }
    e.state = 'combat';
    if (dist > 6.5) { e.lastKnown.copy(pp); e.chase(e.T.run * 0.8, dt); e.flaming = false; }
    else { e.moveDir(0, 0, 0, dt); e.faceTarget(P, dt, 4); e.flaming = e.canSee; }
    if (e.flaming) {
      const muzzle = e.m.p.muzzle.getWorldPosition(_v), to = P.chestPos(_w);
      CF.FX.flame(muzzle, to.clone().add(new THREE.Vector3(U.gauss() * 0.4, U.gauss() * 0.3, U.gauss() * 0.4)), 3);
      e.flameSnd = (e.flameSnd || 0) - dt; if (e.flameSnd <= 0) { e.flameSnd = 0.12; A.play('flamer', muzzle, { ref: 6 }); }
      if (dist < 8.5) { P.damage(26 * dt * 4 * (F.mask > 0.85 ? 0.85 : 1), b.pos, 'a flamethrower'); }
    }
    e.physics(dt); e.pose(dt, Math.hypot(b.vel.x, b.vel.z));
  }

  // ---------------------------------------------------------------- the end of it
  F.bells = function (x, y, z) {
    for (let i = 0; i < 11; i++) CF.Game.later(i * 2.2, () => A.play('bell', { x, y, z }, { ref: 60 }));
  };
  /** At eleven o'clock every German lowers his rifle. */
  F.ceasefire = function () {
    for (const e of E.list) if (e.alive && !e.net) { e.brain = ceaseBrain; e.burstLeft = 0; e.noScore = true; }
    A.frontQuiet = true;
  };
  function ceaseBrain(dt) { const e = this; e.state = 'idle'; e.aiming = false; e.moveDir(0, 0, 0, dt); if (e.T.flying) { e.body.pos.addScaledVector(e.body.vel, dt); } else e.physics(dt); e.crouch = U.damp(e.crouch || 0, 0, 2, dt); e.pose(dt, 0); }

  // ---------------------------------------------------------------- per frame
  F.start = function () { F.on = true; F.reset(); };
  F.stop = function () { F.reset(); F.on = false; A.frontQuiet = false; };
  F.reset = function () {
    F.clouds.length = 0; F.barrages.length = 0; F.maskOn = false; F.mask = 0; F.choke = 0; F.maskT = 0; F.dmgAcc = 0;
    if (F.breath) { F.breath.stop(); F.breath = null; }
    if (F.tank) { F.tank.remove(); F.tank = null; }
    if (F.plane) { F.plane.remove(); F.plane = null; }
    const el = $('gasMask'); if (el) el.hidden = true;
    A.frontQuiet = false;
  };
  F.preUpdate = function (dt) { if (F.plane) F.plane.update(dt); if (F.tank) F.tank.update(dt); };
  F.update = function (dt) {
    if (!F.on) return;
    gas(dt); barrages(dt);
    if (CF.MapWestern) CF.MapWestern.tick(CF.time);
  };
})(window.CF);
