'use strict';
/* Cinderfall — THE RIME HEART (Whiteout finale boss). Rooted in the Hollow.
   Phase 1: three feeder pylons shield it — break them. Phase 2: the shell opens — burn the core. Below half: it rages. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _d = new THREE.Vector3();
  const PYLON_R = 11;

  function buildModel() {
    const M = {
      crystal: new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: new THREE.Color(0.05, 0.3, 0.55), metalness: 0.25, roughness: 0.07, envMapIntensity: 1.8 }),
      deep: new THREE.MeshStandardMaterial({ color: 0x2f6fae, emissive: new THREE.Color(0.02, 0.12, 0.3), metalness: 0.3, roughness: 0.12, envMapIntensity: 1.4 }),
      frost: new THREE.MeshStandardMaterial({ color: 0xe8f4ff, metalness: 0, roughness: 0.5 }),
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 5, 7) }),
      node: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 4.4, 6.5) })
    };
    const oct = new THREE.OctahedronGeometry(1, 0), ico = new THREE.IcosahedronGeometry(1, 1), ico0 = new THREE.IcosahedronGeometry(1, 0);
    const mk = (p, g, m, x, y, z, sx, sy, sz, rx, ry, rz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; p.add(o); return o; };
    const grp = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    const root = new THREE.Group(), p = {};
    // roots spreading over the crater floor
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; mk(root, oct, i % 2 ? M.deep : M.crystal, Math.cos(a) * 3.6, 0.4, Math.sin(a) * 3.6, 0.5, 2.6, 0.5, Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25); }
    mk(root, ico0, M.frost, 0, 0.3, 0, 4, 1, 4);
    p.body = grp(root, 0, 0, 0);
    // the core, held inside a shell of big shards that open like petals
    p.core = mk(p.body, ico, M.core, 0, 4.2, 0, 1.25, 1.25, 1.25);
    p.petals = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, g = grp(p.body, Math.cos(a) * 0.4, 1.4, Math.sin(a) * 0.4);
      g.rotation.y = -a;
      const s = mk(g, oct, i % 2 ? M.crystal : M.deep, 0.9, 3, 0, 0.9, 3.6, 0.9);
      g.userData.a = a; p.petals.push({ g, s });
    }
    // crown spires
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; mk(p.body, oct, M.crystal, Math.cos(a) * 1.3, 7.2 + (i % 2), Math.sin(a) * 1.3, 0.35, 2 + (i % 3) * 0.6, 0.35, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
    p.crown = mk(p.body, oct, M.crystal, 0, 9.2, 0, 0.6, 2.6, 0.6);
    // orbiting shards
    p.halo = grp(root, 0, 5, 0);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mk(p.halo, oct, i % 3 ? M.crystal : M.deep, Math.cos(a) * 5.5, Math.sin(i * 1.7) * 0.8, Math.sin(a) * 5.5, 0.18, 0.7, 0.18, 0.4, a, 0.3); }
    p.emitter = grp(p.body, 0, 4.2, -1.2);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { root, p, M, oct, ico0 };
  }
  function buildPylon(M, oct, ico0) {
    const g = new THREE.Group(), mk = (geo, m, x, y, z, sx, sy, sz, rx, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, 0, rz || 0); o.castShadow = true; g.add(o); return o; };
    mk(oct, M.deep, 0, 2.4, 0, 0.8, 3.4, 0.8);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; mk(oct, M.crystal, Math.cos(a) * 0.7, 1.4, Math.sin(a) * 0.7, 0.35, 1.8, 0.35, Math.sin(a) * 0.4, -Math.cos(a) * 0.4); }
    const node = mk(ico0, M.node.clone(), 0, 5.4, 0, 0.62, 0.62, 0.62);
    mk(ico0, M.frost, 0, 0.3, 0, 1.6, 0.5, 1.6);
    return { g, node };
  }

  class HeartBoss {
    constructor(x, y, z) {
      const m = buildModel();
      this.m = m; this.root = m.root; this.boss = true; this.name = 'the Rime Heart';
      CF.HUD.setBossName('The Rime Heart');
      this.T = { height: 9, radius: 3.4, flying: false, name: 'Rime Heart', score: 3000, eye: 4.2 };
      this.body = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), radius: 3.4, height: 9 };
      this.floorY = y;
      const hp = CF.diff().hp;
      this.pylons = [0, 1, 2].map((i) => {
        const a = i / 3 * Math.PI * 2 + Math.PI / 2, pl = buildPylon(m.M, m.oct, m.ico0);
        pl.g.position.set(x + Math.cos(a) * PYLON_R, y - 7, z + Math.sin(a) * PYLON_R);
        CF.Enemies.scene.add(pl.g);
        return { hp: 700 * hp, max: 700 * hp, dead: false, g: pl.g, node: pl.node, pos: new THREE.Vector3(x + Math.cos(a) * PYLON_R, y + 5.4, z + Math.sin(a) * PYLON_R), light: null };
      });
      this.extra = this.pylons.map((pl) => pl.g);
      this.coreHp = this.coreMax = 3000 * hp;
      this.alive = true; this.spawnT = 1; this.state = 'intro'; this.phase = 1; this.stateT = 0;
      this.yaw = 0; this.attack = null; this.attackT = 0; this.cooldown = 3; this.lastAttack = '';
      this.riseT = 0; this.flash = 0; this.open = 0; this.enraged = false;
      this.markers = []; this.spikes = []; this.spikeMeshes = [];
      this.hit = [
        { key: 'core', r: 1.75, weak: true }, { key: 'p0', r: 0.8, weak: true }, { key: 'p1', r: 0.8, weak: true }, { key: 'p2', r: 0.8, weak: true },
        { key: 'shell', r: 3.4 }, { key: 'crown', r: 1.5 }, { key: 'base', r: 3.1 }, { key: 'pb0', r: 0.9 }, { key: 'pb1', r: 0.9 }, { key: 'pb2', r: 0.9 }
      ].map((h) => Object.assign(h, { w: new THREE.Vector3() }));
      this.root.position.set(x, y - 11, z); this.root.scale.setScalar(1.3);
      CF.Enemies.scene.add(this.root);
      this.lamp = CF.Level.points.heartLamp || null;
      this.root.updateMatrixWorld(true);
    }
    get totalHp() { return this.pylons.reduce((s, c) => s + Math.max(0, c.hp), 0) + Math.max(0, this.coreHp); }
    get totalMax() { return this.pylons.reduce((s, c) => s + c.max, 0) + this.coreMax; }
    center(out) { return out.set(this.body.pos.x, this.body.pos.y + 5.4, this.body.pos.z); }
    becomeAware() {}
    cleanup() {
      if (this.lamp) { this.lamp.on = false; this.lamp.intensity = 0; }
      for (const pl of this.pylons) CF.Enemies.scene.remove(pl.g);
      this.cancelAttack();
      for (const s of this.spikeMeshes) CF.Enemies.scene.remove(s);
      this.spikeMeshes.length = 0;
    }
    remove() {
      CF.Enemies.scene.remove(this.root);
      this.cleanup();
      const i = CF.Enemies.list.indexOf(this); if (i >= 0) CF.Enemies.list.splice(i, 1);
    }

    placeHits() {
      const b = this.body.pos, y = this.root.position.y;
      for (const h of this.hit) {
        switch (h.key) {
          case 'core': h.w.set(b.x, y + 5.46, b.z); h.on = this.open > 0.6; break;
          case 'shell': h.w.set(b.x, y + 5.2, b.z); h.on = true; break;
          case 'crown': h.w.set(b.x, y + 10.9, b.z); h.on = true; break;
          case 'base': h.w.set(b.x, y + 1.6, b.z); h.on = true; break;
          default: {
            const i = +h.key.slice(-1), pl = this.pylons[i];
            if (h.key[1] === 'b') { h.w.set(pl.g.position.x, pl.g.position.y + 2.4, pl.g.position.z); h.on = !pl.dead; }
            else { h.w.set(pl.g.position.x, pl.g.position.y + 5.4, pl.g.position.z); h.on = !pl.dead; }
          }
        }
      }
    }
    raycastBoss(o, d, maxT) {
      if (this.state === 'intro' && this.riseT < 1) return null;
      let best = null, bt = maxT;
      for (const h of this.hit) {
        if (!h.on) continue;
        _v.subVectors(o, h.w); const b = _v.dot(d), c = _v.lengthSq() - h.r * h.r, disc = b * b - c;
        if (disc < 0) continue;
        let t = -b - Math.sqrt(disc); if (t < 0) t = -b + Math.sqrt(disc);
        const tt = h.weak ? t - 0.5 : t;
        if (t > 0 && tt < bt) { bt = tt; best = { enemy: this, t, part: h, point: o.clone().addScaledVector(d, t), center: h.w }; }
      }
      if (best) best.normal = best.point.clone().sub(best.center).normalize();
      return best;
    }
    applyWeak(key, dmg) {
      if (key === 'core') {
        this.coreHp -= dmg;
        if (this.coreHp <= 0) this.die();
        else if (!this.enraged && this.coreHp < this.coreMax * 0.5) this.enrage();
      } else {
        const pl = this.pylons[+key.slice(-1)];
        if (pl.dead) return;
        pl.hp -= dmg;
        if (pl.hp <= 0) this.pylonDestroyed(pl);
      }
    }
    damage(amount, info) {
      if (!this.alive || this.state === 'intro' || this.state === 'dying') return null;
      const part = info.part;
      if (part && part.weak) {
        const mult = info.weapon === 'rail' ? 1.6 : info.weapon === 'shotgun' ? 0.9 : 1.25;
        const dmg = amount * mult;
        this.applyWeak(part.key, dmg); this.flash = 0.1;
        if (info.point) { CF.FX.botHit(info.point, info.normal || _v.set(0, 1, 0), true); CF.HUD.dmgNumber(info.point, dmg, 'weak'); }
        CF.HUD.hitmarker(this.alive ? 'head' : 'kill'); A.play('headshot', null, { ui: true });
        CF.Game.stats.damageDealt += dmg;
        return { head: true, dealt: dmg };
      }
      if (info.point) { CF.FX.iceBits(info.point.x, info.point.y, info.point.z, 2, 3, 0.05); CF.HUD.dmgNumber(info.point, 0, 'armor'); }
      CF.HUD.hitmarker('armor'); A.play('armorHit', null, { ui: true });
      if (info.point) A.play('iceCrack', info.point, { ref: 3, vol: 0.4 });
      return { head: false, dealt: 0, armored: true };
    }
    damageMelee(dmg, info) { return this.damage(dmg, info); }
    explosionDamage(pos, radius, dmg) {
      if (!this.alive || this.state === 'intro' || this.state === 'dying') return;
      for (const h of this.hit) {
        if (!h.on || !h.weak) continue;
        const d = h.w.distanceTo(pos);
        if (d < radius + 1) { this.applyWeak(h.key, dmg * (1 - d / (radius + 1)) * 1.2); this.flash = 0.1; CF.HUD.hitmarker('head'); }
      }
    }

    pylonDestroyed(pl) {
      pl.dead = true; pl.hp = 0; pl.node.visible = false;
      CF.FX.shatter(pl.pos, 2.2); CF.FX.frostBurst(pl.pos, 0.8); A.play('shieldBreak', pl.pos, { ref: 14 });
      pl.g.children.forEach((c, i) => { if (i < 5 && c !== pl.node) CF.FX.gib(c, new THREE.Vector3(U.gauss() * 4, U.rand(4, 8), U.gauss() * 4), 3); });
      CF.HUD.popup('Feeder pylon shattered', CF.Game.pts(500), 'obj'); CF.Game.addScore(CF.Game.pts(500));
      const left = this.pylons.filter((p) => !p.dead).length;
      if (left === 0) {
        this.state = 'stagger'; this.stateT = 0; this.cancelAttack();
        A.play('heartRoar', this.body.pos, { ref: 24 });
        CF.HUD.radio('Dr. Varga', 'That was the last feeder. The shell is failing. It is opening. The core, shoot the core!');
      } else CF.HUD.radio('Dr. Varga', left === 2 ? 'One down! It is drawing through the other two now.' : 'One feeder left. Keep going!');
    }
    enrage() {
      this.enraged = true; this.phase = 3;
      A.play('heartRoar', this.body.pos, { ref: 24 });
      CF.HUD.radio('The Rime', 'WE WERE HERE BEFORE THE ICE. WE WILL BE HERE AFTER YOU.', true);
      this.summon(3);
      for (const l of CF.Level.points.hollowAlarms || []) { l.on = true; l.intensity = 3.2; l.pulse = 7; }
    }
    die() {
      this.coreHp = 0; this.state = 'dying'; this.stateT = 0; this.cancelAttack();
      CF.HUD.bossBar(false);
      A.play('heartRoar', this.body.pos, { ref: 24 });
      CF.Game.slowMo(0.3, 1.6);
    }
    cancelAttack() {
      this.attack = null; this.attackT = 0;
      for (const mk of this.markers) CF.FX.removeMarker(mk.h);
      this.markers.length = 0;
      if (this.beamLoop) { this.beamLoop.stop(); this.beamLoop = null; }
      this.line = null;
    }
    summon(n) {
      const S = CF.Level.spawns.hollow;
      for (let i = 0; i < n; i++) {
        const s = S[Math.floor(Math.random() * S.length)];
        const type = i === 2 ? (CF.noDrones() ? 'thrall' : 'frostdrone') : i === 1 ? 'thrall' : 'skitter';
        CF.Enemies.spawn(type, s[0], s[1], { aware: true, spawnFx: true, y: this.floorY });
      }
    }

    update(dt, P) {
      const b = this.body, p = this.m.p;
      this.stateT += dt; this.flash = Math.max(0, this.flash - dt);
      const fk = this.flash > 0 ? 0.8 : 0;
      this.m.M.crystal.emissive.setRGB(0.05 + fk, 0.3 + fk, 0.55 + fk);
      // keep the player out of the trunk and the pylons
      const pp = P.body.pos;
      const push = (cx, cz, r) => { const dx = pp.x - cx, dz = pp.z - cz, d = Math.hypot(dx, dz); if (d < r && d > 0.01 && pp.y < this.floorY + 8) { pp.x = cx + dx / d * r; pp.z = cz + dz / d * r; } };
      if (this.state !== 'dead') { push(b.pos.x, b.pos.z, 4.4); for (const pl of this.pylons) if (!pl.dead) push(pl.g.position.x, pl.g.position.z, 1.4); }
      this.updateSpikes(dt, P);
      if (this.state === 'intro') {
        this.riseT = Math.min(1, this.riseT + dt / 5);
        const e = U.easeInOut(this.riseT);
        this.root.position.set(b.pos.x, this.floorY - 11 * (1 - e), b.pos.z);
        for (let i = 0; i < 3; i++) { const pl = this.pylons[i], k = U.easeOutCubic(U.clamp(this.riseT * 1.4 - i * 0.15, 0, 1)); pl.g.position.y = this.floorY - 7 * (1 - k); }
        if (Math.random() < 0.7) CF.FX.iceBits(b.pos.x + U.gauss() * 4, this.floorY + 0.3, b.pos.z + U.gauss() * 4, 1, 5, 0.12);
        if (Math.random() < 0.3) CF.FX.smoke.spawn(b.pos.x + U.gauss() * 5, this.floorY + 0.5, b.pos.z + U.gauss() * 5, 0, 1.2, 0, 3, 2, 6, 0.6, 0.7, 0.8, 0.5, -0.1, 0.5, 1);
        P.shake(dt * 0.9);
        if (this.lamp) { this.lamp.on = true; this.lamp.intensity = 4 * e; }
        if (this.riseT >= 1) { this.state = 'fight'; this.stateT = 0; this.cooldown = 1.8; A.play('heartRoar', b.pos, { ref: 24 }); P.shake(0.5); CF.HUD.bossBar(true, 1, 'Shatter the feeder pylons'); }
        this.pose(dt); this.root.updateMatrixWorld(true); this.placeHits(); return;
      }
      if (this.state === 'dying') { this.updateDying(dt); return; }
      if (this.state === 'dead') return;
      // feeder beams from live pylons into the heart
      for (const pl of this.pylons) if (!pl.dead) { _v.set(b.pos.x, this.floorY + 5.4, b.pos.z); const k = 0.5 + 0.5 * Math.sin(CF.time * 6 + pl.pos.x); CF.Enemies.line(pl.pos, _v, 0.6 * k, 2.4 * k, 3.6 * k, 0.05 + k * 0.04); }
      if (this.state === 'stagger') {
        this.open = U.clamp((this.stateT - 0.8) / 1.6, 0, 1);
        if (Math.random() < dt * 5) { const c = this.center(_v).add(_v2.set(U.gauss() * 1.5, U.gauss() * 1.5, U.gauss() * 1.5)); CF.FX.iceBits(c.x, c.y, c.z, 3, 5, 0.1); }
        if (this.stateT > 3) { this.state = 'fight'; this.phase = 2; this.stateT = 0; this.cooldown = 1.0; this.summon(2); }
      } else this.updateAttack(dt, P);
      this.faceTo(P, dt);
      this.pose(dt);
      this.root.updateMatrixWorld(true); this.placeHits();
      CF.HUD.bossBar(true, this.totalHp / this.totalMax, this.phase === 1 ? 'Shatter the feeder pylons' : this.enraged ? 'It is breaking · finish it' : 'Destroy the exposed core');
    }
    faceTo(P, dt) {
      const dx = P.body.pos.x - this.body.pos.x, dz = P.body.pos.z - this.body.pos.z;
      const t = Math.atan2(-dx, -dz); this.yaw += U.clamp(U.wrapAngle(t - this.yaw), -0.8 * dt, 0.8 * dt);
      this.m.p.body.rotation.y = this.yaw;
    }
    pose(dt) {
      const p = this.m.p, t = CF.time;
      const beat = Math.pow(Math.max(0, Math.sin(t * (this.enraged ? 4.2 : 2.6))), 8);
      p.core.scale.setScalar(1.25 + beat * 0.18);
      p.core.material.color.setRGB(1.6 + beat * 2, 5 + beat * 2, 7 + beat * 2);
      if (beat > 0.95 && !this.beatOn) { this.beatOn = true; if (this.state !== 'intro') A.play('heartPulse', this.body.pos, { ref: 14, vol: 0.6 }); } else if (beat < 0.5) this.beatOn = false;
      for (const pt of p.petals) pt.g.rotation.z = -this.open * 0.95 - Math.sin(t * 1.3 + pt.g.userData.a) * 0.03;
      p.halo.rotation.y += dt * (this.enraged ? 0.9 : 0.45); p.halo.position.y = 5 + Math.sin(t * 0.8) * 0.3;
      for (const pl of this.pylons) if (!pl.dead) pl.node.scale.setScalar(0.62 * (0.92 + 0.08 * Math.sin(t * 7 + pl.pos.z)));
    }

    // ---------------------------------------------------------- attacks
    updateAttack(dt, P) {
      const pace = this.enraged ? 1.5 : this.phase === 2 ? 1.2 : 1;
      if (!this.attack) {
        this.cooldown -= dt * pace * CF.diff().aggro;
        if (this.cooldown <= 0) {
          const opts = ['volley', 'spikes'];
          if (this.phase >= 2) opts.push('beam', 'beam');
          if (Math.random() < 0.18 && CF.Enemies.alive((e) => !e.boss) < 5) opts.push('summon');
          let pick = U.choice(opts);
          if (pick === this.lastAttack && Math.random() < 0.6) pick = U.choice(opts);
          this.attack = pick; this.lastAttack = pick; this.attackT = 0;
          if (pick === 'volley') { this.volleyN = 0; A.play('shardLob', this.body.pos, { ref: 16 }); }
          if (pick === 'beam') { this.beamH = Math.random() < 0.5 ? 0.55 : 1.5; this.beamDir = Math.random() < 0.5 ? 1 : -1; A.play('laserCharge', this.body.pos, { ref: 16 }); }
          if (pick === 'spikes') this.startSpikes(P);
          if (pick === 'summon') { this.summon(2); A.play('heartRoar', this.body.pos, { ref: 20, vol: 0.6 }); this.endAttack(2); }
        }
        return;
      }
      this.attackT += dt;
      const t = this.attackT;
      if (this.attack === 'volley') {
        const n = this.enraged ? 8 : 6;
        if (t > 0.4 && this.volleyN < n && t > 0.4 + this.volleyN * 0.16) {
          const i = this.volleyN++;
          const tgt = P.body.pos.clone();
          if (i > 0) { const a = Math.random() * 6.28, r = U.rand(1.5, 5.5); tgt.x += Math.cos(a) * r; tgt.z += Math.sin(a) * r; } else tgt.addScaledVector(P.body.vel, 1.3);
          let gy = W.navHeight(tgt.x, tgt.z); if (isNaN(gy)) gy = W.groundHeight(tgt.x, tgt.y + 2, tgt.z);
          tgt.y = gy;
          const from = _v.set(this.body.pos.x, this.floorY + 11.5, this.body.pos.z).clone();
          CF.Enemies.mortar(from, tgt, 1.6, this, 30, 'shardLob');
          this.markers.push({ h: CF.FX.marker(tgt, 3.2, [0.5, 1.8, 2.8]), t: 1.65 });
          A.play('whistle', tgt, { ref: 6, delay: 0.4 });
        }
        if (this.volleyN >= n && t > 0.4 + n * 0.16 + 0.4) this.endAttack(1.8);
      } else if (this.attack === 'spikes') {
        if (!this.line || this.line.done) this.endAttack(1.4);
      } else if (this.attack === 'beam') {
        const charge = 1.25, sweep = this.enraged ? 1.8 : 2.3;
        const eye = this.m.p.emitter.getWorldPosition(new THREE.Vector3());
        const ang = t < charge ? -1.25 * this.beamDir : -1.25 * this.beamDir + (2.5 * this.beamDir) * U.clamp((t - charge) / sweep, 0, 1);
        const a = this.yaw + ang;
        const dir = _d.set(-Math.sin(a), 0, -Math.cos(a));
        const H = this.floorY + this.beamH;
        const start = new THREE.Vector3(this.body.pos.x + dir.x * 4.2, H, this.body.pos.z + dir.z * 4.2);
        const hit = W.raycast(start.x, start.y, start.z, dir.x, 0, dir.z, 60);
        const end = start.clone().addScaledVector(dir, hit ? hit.t : 60);
        if (t < charge) {
          CF.Enemies.line(eye, start, 0.6, 2.4, 4, 0.02);
          CF.Enemies.line(start, end, 0.5, 1.6 * (0.4 + 0.6 * Math.abs(Math.sin(t * 20))), 3, 0.015);
        } else if (t < charge + sweep) {
          if (!this.beamLoop) { this.beamLoop = A.loop('frostBeam', this.body.pos); if (this.beamLoop) this.beamLoop.set(0.2); this.beamHit = false; }
          CF.Enemies.line(eye, start, 1, 4, 7, 0.1);
          CF.Enemies.line(start, end, 1.2, 4.4, 8, 0.13);
          CF.Enemies.line(start, end, 3, 4, 4, 0.03);
          if (hit) { CF.FX.iceBits(end.x, end.y, end.z, 1, 3, 0.06); if (Math.random() < 0.3) CF.FX.decal(CF.FX.scorches, end.x, end.y, end.z, hit.nx, hit.ny, hit.nz, 0.5); }
          const px = P.body.pos.x - this.body.pos.x, pz = P.body.pos.z - this.body.pos.z, pd = Math.hypot(px, pz);
          const pa = Math.atan2(-px, -pz), diff = Math.abs(U.wrapAngle(pa - a)), tol = Math.atan2(0.5, Math.max(1, pd));
          const feet = P.body.pos.y, head = feet + P.body.height;
          if (!this.beamHit && diff < tol && H > feet + 0.05 && H < head && pd < (hit ? hit.t + 4.2 : 62)) {
            this.beamHit = true; P.damage(26, this.body.pos, 'the Rime Heart\'s frost beam'); P.chillT = 2.2; CF.HUD.hint('Frozen · you are slowed', true);
          }
        } else this.endAttack(1.4);
        if (t < charge && Math.floor(t * 4) !== Math.floor((t - dt) * 4)) CF.HUD.hint(this.beamH < 1 ? 'Low sweep · jump' : 'High sweep · crouch or slide', true);
      }
      for (let i = this.markers.length - 1; i >= 0; i--) { const mk = this.markers[i]; mk.t -= dt; if (mk.t <= 0) { CF.FX.removeMarker(mk.h); this.markers.splice(i, 1); } }
    }
    endAttack(cool) {
      this.attack = null; this.cooldown = cool;
      if (this.beamLoop) { this.beamLoop.stop(); this.beamLoop = null; }
    }

    // A line of ice spikes that races across the floor toward where the player stands. Sidestep it.
    startSpikes(P) {
      const b = this.body.pos, dx = P.body.pos.x - b.x, dz = P.body.pos.z - b.z, l = Math.hypot(dx, dz) || 1;
      const lines = this.enraged ? 3 : 1;
      this.line = { t: 0, done: false, rays: [] };
      for (let k = 0; k < lines; k++) {
        const off = (k - (lines - 1) / 2) * 0.45, ca = Math.cos(off), sa = Math.sin(off);
        this.line.rays.push({ dx: (dx * ca - dz * sa) / l, dz: (dx * sa + dz * ca) / l, r: 4.5, next: 4.5, hit: false });
      }
      A.play('iceCrack', b, { ref: 14 });
    }
    updateSpikes(dt, P) {
      const L = this.line;
      if (L && !L.done) {
        L.t += dt;
        const tele = 0.8, b = this.body.pos;
        let alive = false;
        for (const ray of L.rays) {
          if (L.t < tele) { // glowing crack ahead of the eruption
            const a = _v.set(b.x + ray.dx * 4.5, this.floorY + 0.06, b.z + ray.dz * 4.5), e = _v2.set(b.x + ray.dx * 34, this.floorY + 0.06, b.z + ray.dz * 34);
            CF.Enemies.line(a, e, 0.4, 1.8 * (0.5 + 0.5 * Math.sin(L.t * 30)), 3, 0.05);
            alive = true; continue;
          }
          if (ray.r > 34) continue;
          alive = true;
          ray.r += dt * 20;
          while (ray.next < ray.r) {
            const x = b.x + ray.dx * ray.next, z = b.z + ray.dz * ray.next;
            const gy = W.navHeight(x, z);
            if (!isNaN(gy) && Math.abs(gy - this.floorY) < 1) this.spike(x, gy, z);
            else { ray.r = 99; break; }
            ray.next += 1.3;
          }
          // hit test near the front
          const fx = b.x + ray.dx * ray.r, fz = b.z + ray.dz * ray.r;
          const px = P.body.pos.x - fx, pz = P.body.pos.z - fz;
          const along = px * ray.dx + pz * ray.dz, side = Math.abs(px * -ray.dz + pz * ray.dx);
          if (!ray.hit && P.alive && along < 0.5 && along > -1.8 && side < 1.1 && P.body.pos.y - this.floorY < 1.2) {
            ray.hit = true; P.damage(28, this.body.pos, 'the Rime Heart\'s ice spikes');
            P.body.vel.y = 6; P.body.grounded = false; P.body.vel.x += ray.dx * 4; P.body.vel.z += ray.dz * 4; P.shake(0.4);
          }
        }
        if (!alive) L.done = true;
      }
      // spikes rise fast, hold, then sink back into the floor
      for (const s of this.spikeMeshes) {
        const u = s.userData; if (!u.on) continue;
        u.t += dt;
        const k = u.t < 0.12 ? u.t / 0.12 : u.t < 1.2 ? 1 : Math.max(0, 1 - (u.t - 1.2) / 0.6);
        s.scale.set(u.w, u.h * k, u.w); s.position.y = u.y + u.h * k * 0.42;
        if (k <= 0 && u.t > 1.2) { u.on = false; s.visible = false; }
      }
    }
    spike(x, y, z) {
      let s = this.spikeMeshes.find((m) => !m.userData.on);
      if (!s) { if (this.spikeMeshes.length > 60) return; s = new THREE.Mesh(this.m.oct, this.m.M.crystal); s.castShadow = true; CF.Enemies.scene.add(s); this.spikeMeshes.push(s); }
      const u = s.userData; u.on = true; u.t = 0; u.w = U.rand(0.3, 0.5); u.h = U.rand(1.6, 2.6); u.y = y;
      s.position.set(x + U.gauss() * 0.2, y, z + U.gauss() * 0.2); s.rotation.set(U.gauss() * 0.25, Math.random() * 6, U.gauss() * 0.25); s.visible = true;
      CF.FX.iceBits(x, y + 0.2, z, 2, 4, 0.07);
      A.play('spikes', { x, y, z }, { ref: 6 });
    }

    updateDying(dt) {
      const t = this.stateT, b = this.body;
      if (Math.random() < dt * 8) { const c = this.center(_v).add(_v2.set(U.gauss() * 2.5, U.gauss() * 2.5, U.gauss() * 2.5)); CF.FX.frostBurst(c.clone(), 0.5); }
      this.m.p.core.scale.setScalar(1.25 + Math.sin(t * 30) * 0.15 + t * 0.2);
      this.root.position.y = this.floorY - Math.min(2, t * 0.5);
      this.root.updateMatrixWorld(true);
      if (t > 3.4) {
        this.state = 'dead'; this.alive = false;
        const c = this.center(new THREE.Vector3());
        CF.FX.frostBurst(c, 2.6); CF.FX.shatter(c, 3); CF.FX.frostBurst(c.clone().add(new THREE.Vector3(0, 3, 0)), 1.8);
        CF.FX.flashLight(c, 0xbfeaff, 40, 60, 1.2);
        CF.Player.shake(1); A.concuss(0.5); CF.HUD.flash(0.9);
        const p = this.m.p;
        for (const pt of p.petals) CF.FX.gib(pt.g, new THREE.Vector3(U.gauss() * 6, U.rand(6, 12), U.gauss() * 6), 4);
        CF.FX.gib(p.crown, new THREE.Vector3(0, 12, 0), 3);
        p.core.visible = false; p.halo.visible = false;
        if (this.lamp) { this.lamp.on = false; this.lamp.intensity = 0; }
        for (const l of CF.Level.points.hollowAlarms || []) { l.on = false; l.intensity = 0; }
        CF.Game.onBossKilled(this);
      }
    }
  }
  CF.HeartBoss = HeartBoss;
})(window.CF);
