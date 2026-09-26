'use strict';
/* Cinderfall — Story Campaign runtime: allies who follow you (and fight), helicopters you ride in, briefings between
   missions, letterbox cutscene bars, and the stealth read-out. The missions themselves are in js/mission-story.js. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const $ = (id) => document.getElementById(id);
  const ST = CF.Story = { allies: [], helis: [], trail: [], tags: [], marks: [] };
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3();

  // ---------------------------------------------------------------- breadcrumbs: the path you walked is a path they can walk
  ST.crumb = function (force) {
    const P = CF.Player; if (!P.alive || P.ride) return;
    const b = P.body, t = this.trail, last = t[t.length - 1];
    if (!b.grounded && !force) return;
    if (!last || force || Math.hypot(b.pos.x - last.x, b.pos.z - last.z) > 0.9 || Math.abs(b.pos.y - last.y) > 0.5) {
      t.push({ x: b.pos.x, y: b.pos.y, z: b.pos.z });
      if (t.length > 240) { t.shift(); for (const a of this.allies) a.ci = Math.max(0, a.ci - 1); }
    }
  };
  ST.resetTrail = function () { this.trail.length = 0; this.crumb(true); for (const a of this.allies) a.ci = 0; };

  // ---------------------------------------------------------------- allies
  class Ally {
    constructor(look, name, x, z, o) {
      o = o || {};
      this.look = look; this.name = name; this.seed = o.seed || 1;
      this.m = CF.Human.make(look, this.seed);
      this.root = this.m.root; CF.Game.scene.add(this.root);
      const y = isNaN(W.navHeight(x, z)) ? 0 : W.navHeight(x, z);
      this.body = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), radius: 0.32, height: 1.8, stepHeight: 0.6, grounded: true, stepped: 0 };
      this.T = { run: 4.8 }; this.yaw = o.yaw || 0; this.aimPitch = 0; this.phase = Math.random() * 6; this.seedPh = Math.random() * 6;
      this.state = 'idle'; this.alive = true; this.flinch = 0; this.staggerT = 0; this.recoil = 0;
      this.slot = o.slot || 0; this.shoots = !!o.shoots && !!this.m.gunSpec; this.fireCd = U.rand(0.5, 1.5); this.burst = 0; this.target = null;
      this.follow = o.follow !== false; this.hold = null; this.ci = 0; this.stuckT = 0; this.crouch = o.crouch || 0; this.handsUp = !!o.handsUp;
      this.dmg = o.dmg || 11; this.color = o.color || '#9dffb0';
      this.root.position.copy(this.body.pos); this.root.rotation.y = this.yaw;
    }
    /** Where this ally wants to be: a held spot, or their place along your trail. */
    goal() {
      this.direct = false;
      if (this.hold) {
        const b = this.body, h = this.hold;
        // walk straight to a held spot when nothing is in the way; otherwise come along your trail first
        if (!this.follow || W.segmentClear(b.pos.x, b.pos.y + 0.6, b.pos.z, h.x, (h.y || 0) + 0.6, h.z)) { this.direct = true; return h; }
      } else if (!this.follow) return null;
      const t = ST.trail, P = CF.Player.body.pos, want = 2.4 + this.slot * 1.7;
      if (!t.length) return null;
      let acc = Math.hypot(t[t.length - 1].x - P.x, t[t.length - 1].z - P.z), i = t.length - 1;
      while (i > 0 && acc < want) { acc += Math.hypot(t[i].x - t[i - 1].x, t[i].z - t[i - 1].z); i--; }
      this.gi = i;
      return t[i];
    }
    update(dt) {
      const b = this.body, P = CF.Player;
      this.recoil = Math.max(0, this.recoil - dt * 8); this.flinch = Math.max(0, this.flinch - dt * 3);
      let speed = 0, mx = 0, mz = 0;
      const g = this.goal();
      if (g) {
        let tx = g.x, tz = g.z;
        if (!this.direct) {
          // walk the crumbs from where we are up to our place in the line
          const t = ST.trail;
          if (this.ci >= t.length) this.ci = t.length - 1;
          const c = t[this.ci];
          const pc = t[this.ci - 1];
          if (c && Math.hypot(c.x - b.pos.x, c.z - b.pos.z) > 7 && !(pc && Math.hypot(pc.x - b.pos.x, pc.z - b.pos.z) < 2.5)) { // lost the thread: pick it up at the nearest crumb
            let best = this.ci, bd = Infinity; for (let i = 0; i < t.length; i++) { const d = Math.hypot(t[i].x - b.pos.x, t[i].z - b.pos.z); if (d < bd) { bd = d; best = i; } } this.ci = best;
          }
          while (this.ci < this.gi && t[this.ci] && Math.hypot(t[this.ci].x - b.pos.x, t[this.ci].z - b.pos.z) < 1.0) this.ci++;
          const cc = this.ci <= this.gi ? t[this.ci] : g;
          if (cc) { tx = cc.x; tz = cc.z; }
          // shortcut straight to the goal when nothing is in the way
          if (W.segmentClear(b.pos.x, b.pos.y + 0.5, b.pos.z, g.x, g.y + 0.5, g.z) && Math.abs(g.y - b.pos.y) < 0.4) { tx = g.x; tz = g.z; if (this.gi != null) this.ci = Math.max(this.ci, this.gi); }
        }
        const dx = tx - b.pos.x, dz = tz - b.pos.z, l = Math.hypot(dx, dz), far = g ? Math.hypot(g.x - b.pos.x, g.z - b.pos.z) : 0;
        const close = !this.direct && Math.hypot(P.body.pos.x - b.pos.x, P.body.pos.z - b.pos.z) < 1.6 + this.slot * 1.2; // close enough: don't crowd you
        if (!close && l > 0.35 && (far > 0.6 || this.ci < (this.gi || 0))) { mx = dx / l; mz = dz / l; speed = far > 5 ? this.T.run : far > 1.5 ? 2.6 : 1.5; }
      }
      // too far behind (or stuck behind a ledge you jumped): catch up out of sight
      const pd = Math.hypot(P.body.pos.x - b.pos.x, P.body.pos.z - b.pos.z);
      this.stuckT = speed > 0 && Math.hypot(b.vel.x, b.vel.z) < 0.3 ? this.stuckT + dt : 0;
      if (this.follow && !this.direct && (pd > 42 || (this.stuckT > 3 && pd > 8)) && ST.trail.length > 2) {
        const t = ST.trail, i = Math.max(0, (this.gi != null ? this.gi : t.length - 1) - 1), c = t[i];
        if (c && !this.visible(c)) { b.pos.set(c.x, c.y + 0.05, c.z); b.vel.set(0, 0, 0); this.ci = i; this.stuckT = 0; }
      }
      b.vel.x = U.damp(b.vel.x, mx * speed, 8, dt); b.vel.z = U.damp(b.vel.z, mz * speed, 8, dt);
      // keep out of your way, and out of each other's
      for (const o of ST.allies) { if (o === this) continue; const ox = b.pos.x - o.body.pos.x, oz = b.pos.z - o.body.pos.z, od = Math.hypot(ox, oz); if (od < 0.75 && od > 1e-4) { b.pos.x += ox / od * (0.75 - od) * 0.5; b.pos.z += oz / od * (0.75 - od) * 0.5; } }
      { const ox = b.pos.x - P.body.pos.x, oz = b.pos.z - P.body.pos.z, od = Math.hypot(ox, oz); if (od < 0.8 && od > 1e-4 && Math.abs(b.pos.y - P.body.pos.y) < 1.5) { b.pos.x += ox / od * (0.8 - od); b.pos.z += oz / od * (0.8 - od); } }
      b.vel.y -= 19.5 * dt;
      W.moveBody(b, dt);
      if (b.grounded && b.vel.y < 0) b.vel.y = 0;
      if (b.pos.y < -8) { const c = ST.trail[ST.trail.length - 1] || P.body.pos; b.pos.set(c.x, c.y + 0.1, c.z); }
      // fight: pick someone we can see and put rounds on them
      this.fight(dt);
      const face = this.target && this.target.alive ? Math.atan2(-(this.target.body.pos.x - b.pos.x), -(this.target.body.pos.z - b.pos.z))
        : speed > 0.2 ? Math.atan2(-mx, -mz) : this.faceYaw != null ? this.faceYaw : this.yaw;
      this.yaw += U.clamp(U.wrapAngle(face - this.yaw), -7 * dt, 7 * dt);
      this.state = this.target && this.target.alive ? 'combat' : 'idle';
      this.aiming = this.state === 'combat';
      const sp = Math.hypot(b.vel.x, b.vel.z);
      CF.Human.pose(this.m, this, dt, sp);
      this.root.position.copy(b.pos); this.root.rotation.y = this.yaw;
    }
    visible(c) {
      const cam = CF.Game.camera; _v.set(c.x, c.y + 1, c.z);
      if (_v.distanceTo(cam.position) > 60) return false;
      cam.getWorldDirection(_d); _w.subVectors(_v, cam.position).normalize();
      return _d.dot(_w) > 0.4 && W.segmentClear(cam.position.x, cam.position.y, cam.position.z, _v.x, _v.y, _v.z);
    }
    fight(dt) {
      if (!this.shoots || ST.holdFire) { this.target = null; return; }
      const b = this.body;
      this.scanT = (this.scanT || 0) - dt;
      if (this.scanT <= 0) {
        this.scanT = 0.4; this.target = null; let bd = 38;
        for (const e of CF.Enemies.list) {
          if (!e.alive || e.net || e.spawnT < 1) continue;
          const d = e.body.pos.distanceTo(b.pos); if (d > bd) continue;
          e.center(_c);
          if (!W.segmentClear(b.pos.x, b.pos.y + 1.6, b.pos.z, _c.x, _c.y, _c.z)) continue;
          bd = d; this.target = e;
        }
      }
      const e = this.target; if (!e || !e.alive) { this.target = null; return; }
      e.center(_c);
      this.aimPitch = U.damp(this.aimPitch, Math.atan2(_c.y - (b.pos.y + 1.5), Math.hypot(_c.x - b.pos.x, _c.z - b.pos.z)), 8, dt);
      this.fireCd -= dt;
      if (this.fireCd > 0) return;
      if (this.burst <= 0) { this.burst = 3; }
      this.burst--; this.fireCd = this.burst > 0 ? 0.12 : U.rand(0.9, 1.7);
      const muzzle = this.m.p.muzzle.getWorldPosition(new THREE.Vector3());
      const hit = Math.random() < 0.55;
      const aim = _c.clone(); if (!hit) aim.add(new THREE.Vector3(U.gauss() * 1.2, U.gauss() * 0.8, U.gauss() * 1.2));
      const dir = aim.clone().sub(muzzle).normalize();
      CF.FX.tracer(muzzle, aim, { speed: 380, len: 4, w: 0.025, r: 3.2, g: 2.1, b: 1.0 });
      CF.FX.muzzle(muzzle, dir, 5, 3.2, 1.2, 0.35);
      A.play('akShot', muzzle, { ref: 5, vol: 0.55 });
      this.recoil = 1;
      if (hit) e.damage(this.dmg, { dir, point: aim, normal: dir.clone().negate(), part: null, weapon: null, source: 'npc', from: b.pos.clone(), knock: 1 });
    }
    remove() { if (this.root.parent) this.root.parent.remove(this.root); }
  }
  ST.Ally = Ally;
  ST.addAlly = function (look, name, x, z, o) { const a = new Ally(look, name, x, z, o); this.allies.push(a); return a; };
  ST.clearAllies = function () { for (const a of this.allies) a.remove(); this.allies.length = 0; };
  ST.ally = function (name) { return this.allies.find((a) => a.name === name) || null; };
  /** Move every follower right behind you (after a cutscene or a checkpoint). */
  ST.gatherAllies = function (x, z, yaw) {
    let i = 0;
    for (const a of this.allies) {
      if (a.hold || !a.follow) continue;
      const bx = x + Math.sin(yaw) * (2 + i * 1.3) + (i % 2 ? 0.8 : -0.8), bz = z + Math.cos(yaw) * (2 + i * 1.3);
      const y = W.navHeight(bx, bz);
      a.body.pos.set(isNaN(y) ? x : bx, isNaN(y) ? CF.Player.body.pos.y : y, isNaN(y) ? z : bz); a.body.vel.set(0, 0, 0); a.ci = 0; a.yaw = yaw; i++;
    }
    this.resetTrail();
  };

  // ---------------------------------------------------------------- helicopters
  const LEFT_SEAT = new THREE.Vector3(-0.6, 0.92, -0.35);
  class Heli {
    constructor(x, y, z, yaw, name) {
      this.name = name || 'Dust';
      this.root = CF.StoryModels.heli(); CF.Game.scene.add(this.root);
      this.pos = new THREE.Vector3(x, y, z); this.yaw = yaw || 0; this.pitch = 0; this.roll = 0; this.spin = 1; this.spinYaw = 0;
      this.curve = null; this.t = 0; this.speed = 20; this.onArrive = null; this.prevYaw = this.yaw; this.vel = new THREE.Vector3();
      this.sound = null; this.smoke = 0; this.dead = false;
      this.apply(0);
    }
    /** Fly a smooth path through points [[x,y,z], ...] at speed (m/s). faceTo: keep the nose on a point instead. */
    fly(points, speed, onArrive, o) {
      o = o || {};
      const pts = [this.pos.clone()].concat(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3); this.len = this.curve.getLength(); this.t = 0;
      this.speed = speed || 20; this.onArrive = onArrive || null; this.faceTo = o.faceTo || null; this.ease = o.ease !== false;
    }
    hover() { this.curve = null; }
    update(dt) {
      const prev = _w.copy(this.pos);
      if (this.curve) {
        const k0 = this.t;
        const slow = this.ease ? U.clamp(Math.min(this.t * this.len / 18 + 0.25, (1 - this.t) * this.len / 22 + 0.12), 0.12, 1) : 1;
        this.t = Math.min(1, this.t + this.speed * slow * dt / this.len);
        this.curve.getPointAt(this.t, this.pos);
        const tan = this.curve.getTangentAt(Math.min(0.999, this.t + 0.01), _d);
        const want = this.faceTo ? Math.atan2(-(this.faceTo.x - this.pos.x), -(this.faceTo.z - this.pos.z)) : Math.hypot(tan.x, tan.z) > 0.2 ? Math.atan2(-tan.x, -tan.z) : this.yaw;
        this.yaw += U.clamp(U.wrapAngle(want - this.yaw), -0.9 * dt, 0.9 * dt);
        if (this.t >= 1 && k0 < 1) { const f = this.onArrive; this.curve = null; if (f) f(this); }
      }
      if (this.spinYaw) this.yaw += this.spinYaw * dt;
      this.vel.subVectors(this.pos, prev).divideScalar(Math.max(dt, 1e-3));
      const fwd = -(this.vel.x * -Math.sin(this.yaw) + this.vel.z * -Math.cos(this.yaw));
      const yawRate = U.wrapAngle(this.yaw - this.prevYaw) / Math.max(dt, 1e-3);
      this.pitch = U.damp(this.pitch, U.clamp(-fwd * 0.012, -0.22, 0.2), 2, dt);
      this.roll = U.damp(this.roll, U.clamp(-yawRate * 0.35, -0.4, 0.4) + (this.wobble ? Math.sin(CF.time * 7) * this.wobble : 0), 2, dt);
      this.dyaw = U.wrapAngle(this.yaw - this.prevYaw); this.prevYaw = this.yaw;
      this.apply(dt);
      // rotor wash kicks up dust near the ground
      const gy = W.groundHeight(this.pos.x, this.pos.y, this.pos.z), h = this.pos.y - (isNaN(gy) ? 0 : gy);
      if (h < 14 && this.spin > 0.5 && !this.dead) {
        const n = Math.round((1 - h / 14) * 6 * dt * 60 * 0.2 + Math.random());
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = U.rand(2, 9); CF.FX.smoke.spawn(this.pos.x + Math.cos(a) * r, (isNaN(gy) ? 0 : gy) + 0.3, this.pos.z + Math.sin(a) * r, Math.cos(a) * U.rand(3, 7), U.rand(0.2, 1.2), Math.sin(a) * U.rand(3, 7), U.rand(1.5, 2.5), 1, 5, 0.62, 0.54, 0.42, 0.45, -0.05, 1.2, 1); }
      }
      if (this.smoke > 0) { for (let i = 0; i < 2; i++) CF.FX.smoke.spawn(this.pos.x + U.gauss() * 0.5, this.pos.y + 3.4, this.pos.z + U.gauss() * 0.5, U.gauss() * 0.5, 1, U.gauss() * 0.5, U.rand(2, 4), 0.8, 4, 0.05, 0.045, 0.04, 0.8, -0.3, 0.3, 1); if (Math.random() < 0.5) CF.FX.add.spawn(this.pos.x, this.pos.y + 3.3, this.pos.z, U.gauss(), 1.5, U.gauss(), 0.4, 0.6, 1.2, 4, 1.6, 0.3, 1, -1, 1, 1); }
      if (this.sound && this.sound.panner && this.sound.panner.positionX) { const p = this.sound.panner; p.positionX.value = this.pos.x; p.positionY.value = this.pos.y + 3; p.positionZ.value = this.pos.z; }
      if (!this.sound && CF.Game.audioOn && !this.dead) { this.sound = A.loop('rotor', this.pos); if (this.sound) this.sound.set(0.5, 0.5); }
    }
    apply(dt) {
      const r = this.root, u = r.userData;
      r.position.copy(this.pos); r.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
      u.rotor.rotation.y += dt * 24 * this.spin; u.tail.rotation.x += dt * 60 * this.spin;
      u.beacon.visible = (CF.time % 1.1) < 0.15;
      r.updateMatrixWorld(true);
    }
    /** The spot you stand in the cabin, by the left door. */
    seat(out) { return out.copy(LEFT_SEAT).applyMatrix4(this.root.matrixWorld); }
    board(P) {
      const self = this;
      P.ride = { get(out) { self.seat(out); }, dyaw: 0, roll: 0 };
      this.rider = P;
    }
    unboard() { if (this.rider) { this.rider.ride = null; this.rider = null; } }
    step() { if (this.rider && this.rider.ride) { this.rider.ride.dyaw = (this.rider.ride.dyaw || 0) + this.dyaw; this.rider.ride.roll = this.roll * 0.6; } }
    remove() { if (this.sound) { this.sound.stop(); this.sound = null; } if (this.root.parent) this.root.parent.remove(this.root); this.unboard(); }
  }
  ST.Heli = Heli;
  ST.addHeli = function (x, y, z, yaw, name) { const h = new Heli(x, y, z, yaw, name); this.helis.push(h); return h; };
  ST.removeHeli = function (h) { h.remove(); const i = this.helis.indexOf(h); if (i >= 0) this.helis.splice(i, 1); };
  ST.clearHelis = function () { for (const h of this.helis) h.remove(); this.helis.length = 0; };

  // ---------------------------------------------------------------- cutscene bars, briefings, stealth read-out
  ST.letterbox = function (on) { const l = $('letterbox'); if (l) l.classList.toggle('on', !!on); };
  /** Between missions: the card (number, title, place and time), the story so far and the orders, line by line.
      Resolves when the player clicks Deploy (that click also re-captures the mouse). */
  ST.briefing = function (b) {
    const el = $('briefing'); if (!el) return Promise.resolve();
    $('brNum').textContent = b.num; $('brTitle').textContent = b.title; $('brWhere').textContent = b.where;
    $('brAct').textContent = b.act || '';
    const log = $('brLog'); log.textContent = '';
    const obj = $('brObj'); obj.textContent = '';
    for (const o of b.orders || []) { const li = document.createElement('li'); li.textContent = o; obj.appendChild(li); }
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    const btn = $('brGo'); btn.disabled = false;
    clearTimeout(ST.brTimer); // a briefing left behind (quit to the menu) must stop typing into this one
    let i = 0;
    const next = () => {
      if (i >= (b.lines || []).length) return;
      const [who, text] = b.lines[i++];
      const row = document.createElement('p'); row.className = 'br-line';
      const w = document.createElement('b'); w.textContent = who; const s = document.createElement('span'); s.textContent = text;
      row.append(w, s); log.appendChild(row);
      if (CF.Game.audioOn) A.play('radio', null, { ui: true, vol: 0.5 });
      ST.brTimer = setTimeout(next, 900 + text.length * 28);
    };
    ST.brTimer = setTimeout(next, 500);
    return new Promise((resolve) => {
      const go = () => {
        clearTimeout(ST.brTimer); ST.brCleanup();
        el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 350);
        if (!CF.Input.freeLook) CF.Input.requestLock();
        resolve();
      };
      const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); go(); } };
      if (ST.brCleanup) ST.brCleanup();
      ST.brCleanup = () => { btn.removeEventListener('click', go); window.removeEventListener('keydown', key, true); ST.brCleanup = null; };
      btn.addEventListener('click', go); window.addEventListener('keydown', key, true);
      setTimeout(() => btn.focus(), 50);
    });
  };
  ST.closeBriefing = () => { clearTimeout(ST.brTimer); if (ST.brCleanup) ST.brCleanup(); const el = $('briefing'); if (el) { el.hidden = true; el.classList.remove('show'); } };
  ST.briefingOpen = () => { const el = $('briefing'); return !!el && !el.hidden; };

  /** Stealth: how close anyone is to spotting you, and ?/! over the heads of those who noticed. */
  ST.stealthHud = function (on, level, label) {
    const el = $('stealth'); if (!el) return;
    el.hidden = !on; if (!on) { for (const m of this.marks) m.hidden = true; return; }
    const f = $('stealthFill'); f.style.width = Math.round(U.clamp(level, 0, 1) * 100) + '%';
    el.classList.toggle('sus', level > 0.05 && level < 1); el.classList.toggle('alert', level >= 1);
    $('stealthText').textContent = label;
  };
  const _p = new THREE.Vector3();
  function pool(arr, parentId, cls) {
    const parent = $(parentId); if (!parent) return null;
    const d = document.createElement('div'); d.className = cls; d.hidden = true; parent.appendChild(d); arr.push(d); return d;
  }
  function project(el, x, y, z, text) {
    _p.set(x, y, z).project(CF.Game.camera);
    if (_p.z > 1 || Math.abs(_p.x) > 1.1 || Math.abs(_p.y) > 1.1) { el.hidden = true; return; }
    el.hidden = false;
    if (el.dataset.t !== text) { el.textContent = text; el.dataset.t = text; }
    el.style.transform = 'translate(' + ((_p.x * 0.5 + 0.5) * window.innerWidth).toFixed(0) + 'px,' + ((-_p.y * 0.5 + 0.5) * window.innerHeight).toFixed(0) + 'px) translate(-50%,-100%)';
  }
  ST.updateMarks = function (on) {
    let k = 0;
    if (on) for (const e of CF.Enemies.list) {
      if (!e.alive || !e.T.human) continue;
      const s = e.state === 'hunt' || e.state === 'combat' ? '!' : (e.suspicion || 0) > 0.15 || e.state === 'alert' ? '?' : '';
      if (!s || e.body.pos.distanceTo(CF.Player.body.pos) > 45) continue;
      const el = this.marks[k] || pool(this.marks, 'stealthMarks', 'st-mark'); if (!el) break;
      el.classList.toggle('bang', s === '!'); project(el, e.body.pos.x, e.body.pos.y + 2.25, e.body.pos.z, s); k++;
    }
    for (; k < this.marks.length; k++) this.marks[k].hidden = true;
  };
  ST.updateTags = function () {
    let k = 0;
    const P = CF.Player.body.pos;
    for (const a of this.allies) {
      if (a.noTag || a.body.pos.distanceTo(P) > 28) continue;
      const el = this.tags[k] || pool(this.tags, 'allyTags', 'ally-tag'); if (!el) break;
      project(el, a.body.pos.x, a.body.pos.y + 2.15, a.body.pos.z, a.name); k++;
    }
    for (; k < this.tags.length; k++) this.tags[k].hidden = true;
  };

  // ---------------------------------------------------------------- per-frame (called by the mission)
  /** Helicopters move before the player so a rider's camera sits exactly in this frame's cabin. */
  ST.preUpdate = function (dt) { for (const h of this.helis) { h.update(dt); h.step(); } };
  ST.update = function (dt) {
    this.crumb(false);
    for (const a of this.allies) a.update(dt);
    this.updateTags();
  };
  ST.clear = function () {
    this.clearAllies(); this.clearHelis(); this.trail.length = 0; this.holdFire = false;
    for (const t of this.tags) t.hidden = true;
    this.stealthHud(false); this.letterbox(false);
  };
})(window.CF);
