'use strict';
/* Cinderfall — THE WARDEN. Three-phase boss: shoulder cores → exposed core → enraged. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _d = new THREE.Vector3();

  function buildModel() {
    const pm = CF.Tex.list.paintMetal;
    const M = {
      hull: new THREE.MeshStandardMaterial({ color: 0x3f423f, metalness: 0.65, roughness: 0.48, roughnessMap: pm.roughnessMap, normalMap: pm.normalMap }),
      plate: new THREE.MeshStandardMaterial({ color: 0xb3ab9b, metalness: 0.35, roughness: 0.5, roughnessMap: pm.roughnessMap, normalMap: pm.normalMap }),
      frame: new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.85, roughness: 0.4 }),
      stripe: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 0.3, 1.6) }),
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 2.2, 0.5) }),
      eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.6, 0.25) }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.4, 0.3) })
    };
    const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 16), sph = new THREE.SphereGeometry(1, 20, 14);
    const mk = (p, g, m, x, y, z, sx, sy, sz, rx, ry, rz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; p.add(o); return o; };
    const grp = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    const root = new THREE.Group(), p = {};
    p.hips = grp(root, 0, 3.5, 0);
    mk(p.hips, box, M.frame, 0, 0, 0, 2.0, 0.8, 1.4);
    for (const s of [-1, 1]) {
      const leg = grp(p.hips, s * 1.15, -0.2, 0);
      mk(leg, sph, M.frame, 0, 0, 0, 0.5, 0.5, 0.5);
      mk(leg, box, M.hull, 0, -0.95, -0.15, 0.8, 1.9, 0.9, 0.18, 0, 0);
      mk(leg, box, M.plate, s * 0.1, -0.8, -0.62, 0.7, 1.3, 0.12, 0.18, 0, 0);
      const knee = grp(leg, 0, -1.85, -0.35);
      mk(knee, sph, M.frame, 0, 0, 0, 0.42, 0.42, 0.42);
      mk(knee, box, M.hull, 0, -0.8, 0.25, 0.7, 1.7, 0.8, -0.3, 0, 0);
      mk(knee, box, M.frame, 0, -1.55, 0.2, 1.2, 0.35, 1.9);
      mk(knee, box, M.stripe, 0, -1.36, -0.72, 1.0, 0.08, 0.1);
      p[s < 0 ? 'legL' : 'legR'] = leg; p[s < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    p.torso = grp(p.hips, 0, 0.5, 0);
    mk(p.torso, box, M.hull, 0, 1.2, 0.1, 3.2, 2.2, 2.4);
    mk(p.torso, box, M.plate, 0, 2.3, 0.1, 3.0, 0.3, 2.2);
    mk(p.torso, box, M.stripe, 0, 1.8, -1.12, 2.4, 0.12, 0.06);
    p.core = mk(p.torso, sph, M.core, 0, 1.15, -0.85, 0.55, 0.55, 0.4);
    p.coreRing = mk(p.torso, new THREE.TorusGeometry(1, 0.12, 8, 24), M.frame, 0, 1.15, -1.0, 0.7, 0.7, 0.7);
    p.doorL = grp(p.torso, -0.05, 1.15, -1.22); mk(p.doorL, box, M.plate, -0.55, 0, 0, 1.1, 1.3, 0.16);
    p.doorR = grp(p.torso, 0.05, 1.15, -1.22); mk(p.doorR, box, M.plate, 0.55, 0, 0, 1.1, 1.3, 0.16);
    p.cores = [];
    for (const s of [-1, 1]) {
      const sh = grp(p.torso, s * 1.95, 2.35, 0.1);
      mk(sh, box, M.hull, 0, -0.4, 0, 1.0, 1.0, 1.4);
      const c = mk(sh, sph, M.core, 0, 0.35, 0, 0.45, 0.45, 0.45);
      mk(sh, new THREE.TorusGeometry(1, 0.1, 6, 20), M.frame, 0, 0.35, 0, 0.55, 0.55, 0.55, Math.PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) mk(sh, box, M.frame, Math.cos(i * 1.57) * 0.48, 0.35, Math.sin(i * 1.57) * 0.48, 0.08, 0.7, 0.08);
      p.cores.push({ group: sh, mesh: c, side: s });
    }
    p.head = grp(p.torso, 0, 2.55, -0.55);
    mk(p.head, box, M.hull, 0, 0.3, 0, 1.3, 0.6, 1.1);
    p.eye = mk(p.head, box, M.eye, 0, 0.3, -0.56, 1.05, 0.1, 0.04);
    p.emitter = grp(p.head, 0, 0.3, -0.6);
    // minigun arm (left)
    p.armL = grp(p.torso, -2.0, 1.4, 0.1);
    mk(p.armL, box, M.hull, -0.2, -0.7, 0, 0.7, 1.6, 0.8);
    p.minigun = grp(p.armL, -0.2, -1.6, -0.7);
    mk(p.minigun, box, M.frame, 0, 0, 0.3, 0.7, 0.7, 1.0);
    p.barrels = grp(p.minigun, 0, 0, -0.5);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mk(p.barrels, cyl, M.frame, Math.cos(a) * 0.17, Math.sin(a) * 0.17, -0.4, 0.06, 1.2, 0.06, Math.PI / 2, 0, 0); }
    p.mgGlow = mk(p.barrels, cyl, M.glow, 0, 0, -0.98, 0.25, 0.04, 0.25, Math.PI / 2, 0, 0);
    p.mgMuzzle = grp(p.barrels, 0, 0, -1.05);
    // mortar arm (right)
    p.armR = grp(p.torso, 2.0, 1.4, 0.1);
    mk(p.armR, box, M.hull, 0.2, -0.6, 0, 0.7, 1.4, 0.8);
    p.mortar = grp(p.armR, 0.25, -0.2, 0);
    mk(p.mortar, box, M.frame, 0, 0.4, 0, 0.9, 0.9, 1.1);
    for (let i = 0; i < 4; i++) mk(p.mortar, cyl, M.hull, (i % 2 - 0.5) * 0.4, 1.0, (Math.floor(i / 2) - 0.5) * 0.45, 0.16, 0.6, 0.16);
    p.mortarMuzzle = grp(p.mortar, 0, 1.35, 0);
    // back stacks
    for (const s of [-1, 1]) { mk(p.torso, cyl, M.frame, s * 0.9, 2.6, 1.1, 0.22, 1.4, 0.22); mk(p.torso, cyl, M.glow, s * 0.9, 3.32, 1.1, 0.16, 0.04, 0.16); }
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { root, p, M };
  }

  class Boss {
    constructor(x, y, z) {
      const m = buildModel();
      this.m = m; this.root = m.root; this.boss = true; this.name = 'the Warden';
      this.T = { height: 7, radius: 2.4, flying: false, name: 'Warden', score: 3000, eye: 6.2 };
      this.body = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), radius: 2.4, height: 7 };
      this.home = new THREE.Vector3(x, y, z);
      this.floorY = y;
      const hp = CF.diff().hp;
      this.cores = m.p.cores.map((c) => ({ hp: 900 * hp, max: 900 * hp, c, dead: false }));
      this.coreHp = this.coreMax = 2600 * hp;
      this.alive = true; this.spawnT = 1; this.state = 'intro'; this.phase = 1; this.stateT = 0;
      this.yaw = 0; this.attack = null; this.attackT = 0; this.cooldown = 3; this.lastAttack = '';
      this.riseT = 0; this.walk = 0; this.flash = 0; this.doors = 0; this.enraged = false; this.deathT = 0;
      this.spin = 0; this.markers = [];
      this.hit = [
        { key: 'coreL', r: 0.62, weak: true }, { key: 'coreR', r: 0.62, weak: true }, { key: 'core', r: 0.72, weak: true },
        { key: 'torso', r: 1.9 }, { key: 'head', r: 0.8 }, { key: 'hips', r: 1.1 }, { key: 'legL', r: 0.75 }, { key: 'legR', r: 0.75 },
        { key: 'kneeL', r: 0.75 }, { key: 'kneeR', r: 0.75 }, { key: 'armL', r: 0.8 }, { key: 'armR', r: 0.8 }
      ].map((h) => Object.assign(h, { w: new THREE.Vector3() }));
      this.root.position.set(x, y - 9, z);
      CF.Enemies.scene.add(this.root);
      this.root.updateMatrixWorld(true);
    }
    get totalHp() { return this.cores.reduce((s, c) => s + Math.max(0, c.hp), 0) + Math.max(0, this.coreHp); }
    get totalMax() { return this.cores.reduce((s, c) => s + c.max, 0) + this.coreMax; }
    center(out) { return out.set(this.body.pos.x, this.body.pos.y + 4.5, this.body.pos.z); }
    becomeAware() {}

    placeHits() {
      const p = this.m.p;
      const get = (obj, x, y, z, out) => obj.localToWorld(out.set(x, y, z));
      for (const h of this.hit) {
        switch (h.key) {
          case 'coreL': get(this.cores[0].c.group, 0, 0.35, 0, h.w); h.on = !this.cores[0].dead; break;
          case 'coreR': get(this.cores[1].c.group, 0, 0.35, 0, h.w); h.on = !this.cores[1].dead; break;
          case 'core': get(p.torso, 0, 1.15, -0.95, h.w); h.on = this.doors > 0.6; break;
          case 'torso': get(p.torso, 0, 1.2, 0.1, h.w); h.on = true; break;
          case 'head': get(p.head, 0, 0.3, 0, h.w); h.on = true; break;
          case 'hips': get(p.hips, 0, 0, 0, h.w); h.on = true; break;
          case 'legL': get(p.legL, 0, -0.9, -0.15, h.w); h.on = true; break;
          case 'legR': get(p.legR, 0, -0.9, -0.15, h.w); h.on = true; break;
          case 'kneeL': get(p.kneeL, 0, -0.8, 0.2, h.w); h.on = true; break;
          case 'kneeR': get(p.kneeR, 0, -0.8, 0.2, h.w); h.on = true; break;
          case 'armL': get(p.armL, -0.2, -0.9, -0.2, h.w); h.on = true; break;
          case 'armR': get(p.armR, 0.2, -0.3, 0, h.w); h.on = true; break;
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
        // weak points get priority when nearly tied with the armour shell around them
        const tt = h.weak ? t - 0.35 : t;
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
        const c = this.cores[key === 'coreL' ? 0 : 1];
        if (c.dead) return;
        c.hp -= dmg;
        if (c.hp <= 0) this.coreDestroyed(c);
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
      if (info.point) { CF.FX.sparks(info.point.x, info.point.y, info.point.z, info.normal ? info.normal.x : 0, info.normal ? info.normal.y : 1, info.normal ? info.normal.z : 0, 4, 5); CF.HUD.dmgNumber(info.point, 0, 'armor'); }
      CF.HUD.hitmarker('armor'); A.play('armorHit', null, { ui: true });
      if (info.point) A.play('impactMetal', info.point, { ref: 4 });
      return { head: false, dealt: 0, armored: true };
    }
    damageMelee(dmg, info) { return this.damage(dmg, info); }
    explosionDamage(pos, radius, dmg) {
      if (!this.alive || this.state === 'intro' || this.state === 'dying') return;
      for (const h of this.hit) {
        if (!h.on || !h.weak) continue;
        const d = h.w.distanceTo(pos);
        if (d < radius + 0.8) { this.applyWeak(h.key, dmg * (1 - d / (radius + 0.8)) * 1.2); this.flash = 0.1; CF.HUD.hitmarker('head'); }
      }
    }

    coreDestroyed(c) {
      c.dead = true; c.hp = 0;
      c.c.mesh.visible = false;
      const pos = c.c.group.localToWorld(new THREE.Vector3(0, 0.35, 0));
      CF.FX.explosion(pos, 1.3); A.play('shieldBreak', pos, { ref: 12 });
      CF.HUD.popup('Shoulder core destroyed', 500, 'obj');
      CF.Game.addScore(500);
      if (this.cores.every((k) => k.dead)) { this.state = 'stagger'; this.stateT = 0; this.cancelAttack(); A.play('roar', this.body.pos, { ref: 20 }); CF.HUD.radio('Overwatch', 'Both shoulder cores are down. Its chest armour is opening. Hit the core!'); }
    }
    enrage() {
      this.enraged = true; this.phase = 3;
      A.play('roar', this.body.pos, { ref: 20 });
      CF.HUD.radio('Overwatch', 'It is overheating. Everything it has left is coming at you. Finish it!');
      this.summon(3);
      for (const l of CF.Level.points.arenaAlarms) { l.intensity = 3; l.pulse = 9; }
    }
    die() {
      this.coreHp = 0; this.state = 'dying'; this.stateT = 0; this.cancelAttack();
      CF.HUD.bossBar(false);
      A.play('roar', this.body.pos, { ref: 20 });
      CF.Game.slowMo(0.3, 1.6);
    }
    cancelAttack() {
      this.attack = null; this.attackT = 0;
      for (const mk of this.markers) CF.FX.removeMarker(mk.h);
      this.markers.length = 0;
      if (this.beamLoop) { this.beamLoop.stop(); this.beamLoop = null; }
    }
    summon(n) {
      const S = CF.Level.spawns.arena;
      for (let i = 0; i < n; i++) {
        const s = S[Math.floor(Math.random() * S.length)];
        CF.Enemies.spawn(i === 2 ? 'stalker' : 'hornet', s[0], s[1], { aware: true, spawnFx: true, noScore: false });
      }
    }

    update(dt, P) {
      const b = this.body, p = this.m.p;
      this.stateT += dt; this.flash = Math.max(0, this.flash - dt);
      const fk = this.flash > 0 ? 0.6 : 0;
      this.m.M.hull.emissive.setRGB(fk, fk * 0.8, fk * 0.7);
      // player collision with the boss body
      const pp = P.body.pos, dx = pp.x - b.pos.x, dz = pp.z - b.pos.z, dd = Math.hypot(dx, dz);
      if (this.state !== 'dead' && dd < 2.3 && dd > 0.01 && pp.y < b.pos.y + 6) { P.body.pos.x = b.pos.x + dx / dd * 2.3; P.body.pos.z = b.pos.z + dz / dd * 2.3; }
      if (this.state === 'intro') {
        this.riseT = Math.min(1, this.riseT + dt / 4.5);
        const e = U.easeInOut(this.riseT);
        this.root.position.set(b.pos.x, this.floorY - 9 * (1 - e), b.pos.z);
        if (Math.random() < 0.6) CF.FX.sparks(b.pos.x + U.gauss() * 4, this.floorY + 0.3, b.pos.z + U.gauss() * 4, 0, 1, 0, 3, 6);
        if (Math.random() < 0.3) CF.FX.smoke.spawn(b.pos.x + U.gauss() * 4, this.floorY + 0.5, b.pos.z + U.gauss() * 4, 0, 1.5, 0, 3, 2, 6, 0.08, 0.07, 0.06, 0.7, -0.2, 0.5, 1);
        P.shake(dt * 0.9);
        this.faceTo(P, dt, 0.5);
        if (this.riseT >= 1) { this.state = 'fight'; this.stateT = 0; this.cooldown = 1.5; A.play('roar', b.pos, { ref: 20 }); A.play('stomp', b.pos, { ref: 20 }); P.shake(0.6); CF.HUD.bossBar(true, 1, 'Destroy the shoulder cores'); }
        this.pose(dt, 0); this.root.updateMatrixWorld(true); this.placeHits(); return;
      }
      if (this.state === 'dying') { this.updateDying(dt); return; }
      if (this.state === 'dead') return;
      if (this.state === 'stagger') {
        const k = this.stateT;
        this.doors = U.clamp((k - 1.2) / 1.2, 0, 1);
        if (Math.random() < dt * 5) { const c = this.center(_v).add(_v2.set(U.gauss() * 1.5, U.gauss() * 1.2, U.gauss() * 1.5)); CF.FX.sparks(c.x, c.y, c.z, 0, 1, 0, 10, 7); }
        if (k > 3.2) { this.state = 'fight'; this.phase = 2; this.stateT = 0; this.cooldown = 1.0; this.summon(2); CF.HUD.bossBar(true, this.totalHp / this.totalMax, 'Destroy the exposed core'); }
      } else {
        this.faceTo(P, dt, this.attack === 'minigun' ? 0.9 : 0.7);
        // slow repositioning toward the player, clamped to the arena centre
        const tx = U.lerp(this.home.x, pp.x, 0.35), tz = U.lerp(this.home.z, pp.z, 0.35);
        const mx = tx - b.pos.x, mz = tz - b.pos.z, ml = Math.hypot(mx, mz);
        const moving = ml > 1.5 && !this.attack;
        if (moving) { b.pos.x += mx / ml * 1.3 * dt; b.pos.z += mz / ml * 1.3 * dt; }
        this.walk = U.damp(this.walk, moving ? 1 : 0, 3, dt);
        this.updateAttack(dt, P, dd);
      }
      this.root.position.set(b.pos.x, this.floorY + (this.state === 'stagger' ? -0.9 * Math.min(1, this.stateT * 2) * (this.stateT < 2.8 ? 1 : Math.max(0, 1 - (this.stateT - 2.8) * 2.5)) : 0), b.pos.z);
      this.pose(dt, this.walk);
      this.root.updateMatrixWorld(true); this.placeHits();
      CF.HUD.bossBar(true, this.totalHp / this.totalMax, this.phase === 1 ? 'Destroy the shoulder cores' : this.enraged ? 'Overheating · finish it' : 'Destroy the exposed core');
    }
    faceTo(P, dt, rate) {
      const dx = P.body.pos.x - this.body.pos.x, dz = P.body.pos.z - this.body.pos.z;
      const t = Math.atan2(-dx, -dz); const d = U.wrapAngle(t - this.yaw);
      this.yaw += U.clamp(d, -rate * dt, rate * dt);
      this.root.rotation.y = this.yaw;
    }
    pose(dt, walk) {
      const p = this.m.p, t = CF.time;
      this.gait = (this.gait || 0) + dt * 2.2 * walk;
      const s = Math.sin(this.gait);
      p.legL.rotation.x = -s * 0.3 * walk; p.legR.rotation.x = s * 0.3 * walk;
      p.kneeL.rotation.x = Math.max(0, Math.cos(this.gait)) * 0.4 * walk; p.kneeR.rotation.x = Math.max(0, -Math.cos(this.gait)) * 0.4 * walk;
      p.hips.position.y = 3.5 + Math.abs(s) * 0.12 * walk + Math.sin(t * 1.2) * 0.04;
      p.torso.rotation.z = Math.sin(this.gait) * 0.03 * walk;
      p.doorL.position.x = -0.05 - this.doors * 0.95; p.doorR.position.x = 0.05 + this.doors * 0.95;
      const cp = 0.8 + 0.2 * Math.sin(t * 6);
      p.core.material.color.setRGB(7 * cp, 2.2 * cp, 0.5 * cp);
      for (const c of this.cores) if (!c.dead) c.c.mesh.scale.setScalar(0.45 * (0.95 + 0.05 * Math.sin(t * 8 + c.c.side)));
      p.barrels.rotation.z += dt * this.spin;
      if (this.stomp) { const k = this.stomp.t; p.legR.rotation.x = -Math.sin(Math.min(1, k / 0.7) * Math.PI * 0.5) * 0.7 * (k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) * 6)); }
    }

    // ---------------------------------------------------------- attacks
    updateAttack(dt, P, dist) {
      const p = this.m.p, pace = this.enraged ? 1.5 : this.phase === 2 ? 1.2 : 1;
      if (!this.attack) {
        this.cooldown -= dt * pace * CF.diff().aggro;
        this.spin = U.damp(this.spin, 0, 2, dt);
        if (this.cooldown <= 0) {
          const opts = ['minigun', 'mortar'];
          if (this.phase >= 2) opts.push('laser', 'laser');
          if (dist < 9) opts.push('stomp', 'stomp');
          let pick = U.choice(opts);
          if (pick === this.lastAttack && Math.random() < 0.6) pick = U.choice(opts);
          this.attack = pick; this.lastAttack = pick; this.attackT = 0;
          if (pick === 'minigun') A.play('spinUp', this.body.pos, { ref: 14 });
          if (pick === 'laser') { this.laserH = Math.random() < 0.5 ? 0.55 : 1.5; this.laserDir = Math.random() < 0.5 ? 1 : -1; A.play('laserCharge', this.body.pos, { ref: 16 }); }
          if (pick === 'mortar') this.mortarN = 0;
          if (pick === 'stomp') this.stomp = { t: 0, done: false };
        }
        return;
      }
      this.attackT += dt;
      const t = this.attackT;
      if (this.attack === 'minigun') {
        this.spin = U.damp(this.spin, 30, 3, dt);
        p.mgGlow.material.color.setRGB(5 * Math.min(1, t), 1.4 * Math.min(1, t), 0.3);
        if (t > 0.8 && t < 3.2) {
          this.mgT = (this.mgT || 0) - dt;
          if (this.mgT <= 0) {
            this.mgT = this.enraged ? 0.055 : 0.07;
            const muzzle = p.mgMuzzle.getWorldPosition(new THREE.Vector3());
            P.chestPos(_v); _v.addScaledVector(P.body.vel, 0.25);
            _d.subVectors(_v, muzzle).normalize();
            const sp = 0.035 / CF.diff().acc;
            _d.x += U.gauss() * sp; _d.y += U.gauss() * sp * 0.6; _d.z += U.gauss() * sp; _d.normalize();
            CF.Enemies.shoot('bolt', muzzle, _d, 62, 5, this);
            CF.FX.muzzle(muzzle, _d, 5, 1.6, 0.5, 0.9);
            A.play('enemyShot', muzzle, { ref: 10 });
          }
        }
        if (t > 3.4) this.endAttack(1.6);
      } else if (this.attack === 'mortar') {
        const n = this.enraged ? 7 : 5;
        if (t > 0.5 && this.mortarN < n && t > 0.5 + this.mortarN * 0.2) {
          const i = this.mortarN++;
          const tgt = P.body.pos.clone();
          if (i > 0) { const a = Math.random() * 6.28, r = U.rand(1.5, 5.5); tgt.x += Math.cos(a) * r; tgt.z += Math.sin(a) * r; }
          else tgt.addScaledVector(P.body.vel, 1.4);
          let gy = W.navHeight(tgt.x, tgt.z); if (isNaN(gy)) gy = W.groundHeight(tgt.x, tgt.y + 2, tgt.z);
          tgt.y = gy;
          const from = p.mortarMuzzle.getWorldPosition(new THREE.Vector3());
          CF.Enemies.mortar(from, tgt, 1.7, this, 32);
          this.markers.push({ h: CF.FX.marker(tgt, 3.3, [3, 0.4, 0.2]), t: 1.75 });
          A.play('mortar', from, { ref: 14 }); A.play('whistle', tgt, { ref: 6, delay: 0.4 });
          CF.FX.muzzle(from, _v.set(0, 1, 0), 5, 2, 0.6, 1.4);
        }
        if (this.mortarN >= n && t > 0.5 + n * 0.2 + 0.4) this.endAttack(1.8);
      } else if (this.attack === 'laser') {
        const charge = 1.25, sweep = this.enraged ? 1.8 : 2.3;
        const eye = p.emitter.getWorldPosition(new THREE.Vector3());
        const base = this.yaw;
        const ang = t < charge ? -1.25 * this.laserDir : -1.25 * this.laserDir + (2.5 * this.laserDir) * U.clamp((t - charge) / sweep, 0, 1);
        const a = base + ang;
        const dir = _d.set(-Math.sin(a), 0, -Math.cos(a));
        const H = this.floorY + this.laserH;
        const start = new THREE.Vector3(this.body.pos.x + dir.x * 2.2, H, this.body.pos.z + dir.z * 2.2);
        const hit = W.raycast(start.x, start.y, start.z, dir.x, 0, dir.z, 60);
        const end = start.clone().addScaledVector(dir, hit ? hit.t : 60);
        p.eye.material.color.setRGB(9 + 6 * Math.min(1, t), 0.6, 0.25);
        if (t < charge) {
          CF.Enemies.line(eye, start, 4, 0.3, 0.2, 0.02);
          CF.Enemies.line(start, end, 3 * (0.4 + 0.6 * Math.abs(Math.sin(t * 20))), 0.2, 0.1, 0.015);
        } else if (t < charge + sweep) {
          if (!this.beamLoop) { this.beamLoop = A.loop('beam', this.body.pos); if (this.beamLoop) this.beamLoop.set(0.25); this.beamHit = false; }
          CF.Enemies.line(eye, start, 8, 0.6, 0.3, 0.09);
          CF.Enemies.line(start, end, 9, 0.8, 0.35, 0.12);
          CF.Enemies.line(start, end, 4, 3, 2, 0.03);
          if (hit) { CF.FX.sparks(end.x, end.y, end.z, -dir.x, 0.3, -dir.z, 3, 5, true); if (Math.random() < 0.3) CF.FX.decal(CF.FX.scorches, end.x, end.y, end.z, hit.nx, hit.ny, hit.nz, 0.6); }
          // player hit test: horizontal beam at height H
          const px = P.body.pos.x - this.body.pos.x, pz = P.body.pos.z - this.body.pos.z, pd = Math.hypot(px, pz);
          const pa = Math.atan2(-px, -pz), diff = Math.abs(U.wrapAngle(pa - a));
          const tol = Math.atan2(0.5, Math.max(1, pd));
          const feet = P.body.pos.y, head = feet + P.body.height;
          if (!this.beamHit && diff < tol && H > feet + 0.05 && H < head && pd < (hit ? hit.t + 2.2 : 62)) {
            this.beamHit = true; P.damage(34, this.body.pos, 'the Warden\'s laser');
          }
        } else this.endAttack(1.4);
        if (t < charge && Math.floor(t * 4) !== Math.floor((t - dt) * 4)) CF.HUD.hint(this.laserH < 1 ? 'Low sweep · jump' : 'High sweep · crouch or slide', true);
      } else if (this.attack === 'stomp') {
        const s = this.stomp; s.t += dt;
        if (s.t > 0.7 && !s.done) {
          s.done = true;
          A.play('stomp', this.body.pos, { ref: 20 }); P.shake(0.7);
          const foot = this.m.p.kneeR.localToWorld(new THREE.Vector3(0, -1.6, 0.2)); foot.y = this.floorY + 0.1;
          CF.FX.ring(foot, 16, 1.0, [2.5, 1.0, 0.4]);
          CF.FX.debris(foot.x, foot.y, foot.z, 0, 1, 0, 12, 6, 0.15);
          this.wave = { r: 0, pos: foot, hit: false };
        }
        if (this.wave) {
          const wv = this.wave; wv.r += dt * 16;
          const d = Math.hypot(P.body.pos.x - wv.pos.x, P.body.pos.z - wv.pos.z);
          if (!wv.hit && Math.abs(d - wv.r) < 0.9 && P.body.pos.y - this.floorY < 0.6 && P.body.grounded) {
            wv.hit = true; P.damage(22, wv.pos, 'the Warden\'s stomp');
            const k = 9 / Math.max(1, d); P.body.vel.x += (P.body.pos.x - wv.pos.x) * k * 0.5; P.body.vel.z += (P.body.pos.z - wv.pos.z) * k * 0.5; P.body.vel.y = 4;
          }
          if (wv.r > 16) this.wave = null;
        }
        if (s.t > 1.6) { this.stomp = null; this.endAttack(1.2); }
      }
      for (let i = this.markers.length - 1; i >= 0; i--) { const mk = this.markers[i]; mk.t -= dt; if (mk.t <= 0) { CF.FX.removeMarker(mk.h); this.markers.splice(i, 1); } }
    }
    endAttack(cool) {
      this.attack = null; this.cooldown = cool; this.mgT = 0;
      this.m.p.mgGlow.material.color.setRGB(0.4, 0.1, 0.02);
      this.m.p.eye.material.color.setRGB(9, 0.6, 0.25);
      if (this.beamLoop) { this.beamLoop.stop(); this.beamLoop = null; }
    }

    updateDying(dt) {
      const t = this.stateT, b = this.body;
      this.deathT += dt;
      if (Math.random() < dt * 7) { const c = this.center(_v).add(_v2.set(U.gauss() * 2, U.gauss() * 2, U.gauss() * 2)); CF.FX.explosion(c.clone(), 0.55); }
      this.root.rotation.z = Math.sin(t * 17) * 0.02 * t;
      this.m.p.hips.position.y = 3.5 - Math.min(1.6, t * 0.6);
      this.root.updateMatrixWorld(true);
      if (t > 3.2) {
        this.state = 'dead'; this.alive = false;
        const c = this.center(new THREE.Vector3());
        CF.FX.explosion(c, 2.4); CF.FX.explosion(c.clone().add(new THREE.Vector3(0, 2, 0)), 1.8);
        CF.FX.flashLight(c, 0xffc080, 40, 60, 1.2);
        CF.Player.shake(1); A.concuss(0.6); CF.HUD.flash(0.8);
        const p = this.m.p;
        for (const part of [p.head, p.armL, p.armR, p.cores[0].group, p.cores[1].group, p.doorL, p.doorR]) CF.FX.gib(part, new THREE.Vector3(U.gauss() * 6, U.rand(6, 12), U.gauss() * 6), 4);
        this.root.visible = true;
        this.m.p.core.visible = false;
        CF.Game.onBossKilled(this);
      }
    }
  }
  CF.Boss = Boss;
})(window.CF);
