'use strict';
/* Cinderfall — enemy AI, projectiles, hit detection. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const TYPES = {
    sentry: { name: 'Sentry', hp: 100, walk: 1.7, run: 4.4, radius: 0.36, height: 1.95, eye: 1.72, range: [9, 24], sight: 44, fovCos: 0.5,
      dmg: 7, projSpeed: 56, burst: 3, burstGap: 0.12, cool: [1.2, 2.1], spread: 2.2, score: 100, stagger: 45, bolt: 'bolt' },
    stalker: { name: 'Stalker', hp: 70, walk: 2.4, run: 9.0, radius: 0.42, height: 1.0, eye: 0.85, range: [0, 0], sight: 38, fovCos: 0.3,
      dmg: 16, score: 120, stagger: 40 },
    hornet: { name: 'Hornet', hp: 45, walk: 5, run: 8, radius: 0.5, height: 0.5, eye: 0, range: [8, 20], sight: 50, fovCos: -1,
      dmg: 5, projSpeed: 68, burst: 2, burstGap: 0.12, cool: [0.9, 1.6], spread: 2.6, score: 80, flying: true, bolt: 'laser' },
    juggernaut: { name: 'Juggernaut', hp: 520, walk: 1.6, run: 2.4, radius: 0.62, height: 2.9, eye: 2.45, range: [10, 34], sight: 50, fovCos: 0.3,
      dmg: 12, projSpeed: 60, burst: 4, burstGap: 0.17, cool: [2.0, 3.0], spread: 2.6, score: 350, stagger: 160, bolt: 'slug' },
    // Whiteout: Rime-infected station crew and crystal growths. kind = the AI archetype each one borrows.
    thrall: { name: 'Thrall', kind: 'sentry', hp: 95, walk: 1.5, run: 4.1, radius: 0.36, height: 1.95, eye: 1.72, range: [8, 22], sight: 40, fovCos: 0.45,
      dmg: 8, projSpeed: 48, burst: 3, burstGap: 0.16, cool: [1.3, 2.2], spread: 2.4, score: 100, stagger: 40, bolt: 'shard', frost: true, sfx: 'shardShot', alert: 'thrallAlert' },
    skitter: { name: 'Skitter', kind: 'stalker', hp: 60, walk: 2.6, run: 9.6, radius: 0.42, height: 0.9, eye: 0.75, range: [0, 0], sight: 36, fovCos: 0.3,
      dmg: 15, score: 110, stagger: 36, frost: true, alert: 'skitterCry' },
    frostdrone: { name: 'Frost Drone', kind: 'hornet', hp: 50, walk: 5, run: 8.5, radius: 0.5, height: 0.5, eye: 0, range: [8, 20], sight: 50, fovCos: -1,
      dmg: 5, projSpeed: 60, burst: 3, burstGap: 0.1, cool: [1.0, 1.7], spread: 2.4, score: 80, flying: true, drone: true, bolt: 'shard', frost: true, sfx: 'droneShot' },
    colossus: { name: 'Colossus', kind: 'juggernaut', hp: 560, walk: 1.5, run: 2.3, radius: 0.66, height: 3.0, eye: 2.5, range: [9, 32], sight: 48, fovCos: 0.3,
      dmg: 13, projSpeed: 52, burst: 5, burstGap: 0.14, cool: [2.0, 3.0], spread: 2.4, score: 380, stagger: 170, bolt: 'shardHeavy', frost: true, lob: true, sfx: 'heavyShard' },
    bloom: { name: 'Crystal Bloom', kind: 'bloom', hp: 620, walk: 0, run: 0, radius: 1.3, height: 3.2, eye: 2, range: [0, 0], sight: 0, fovCos: 1, dmg: 0, score: 500, frost: true, static: true }
  };
  TYPES.hornet.drone = true;
  for (const k in TYPES) TYPES[k].kind = TYPES[k].kind || k;
  const E = CF.Enemies = { types: TYPES, list: [], proj: [], flowT: 0, combatCount: 0, scene: null };
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _pc = new THREE.Vector3(), _eye = new THREE.Vector3(), _dir = new THREE.Vector3(), _flow = { x: 0, z: 0 };

  E.init = function (scene) {
    this.scene = scene;
    // enemy bolt renderer (camera-facing streaks)
    const N = this.bN = 128;
    const g = new THREE.BufferGeometry();
    this.bPos = new Float32Array(N * 12); this.bCol = new Float32Array(N * 12);
    const uv = new Float32Array(N * 8), idx = [];
    for (let i = 0; i < N; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    this.bPosA = new THREE.BufferAttribute(this.bPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.bColA = new THREE.BufferAttribute(this.bCol, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.bPosA); g.setAttribute('color', this.bColA); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.bMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: CF.Tex.list.beam, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.bMesh.frustumCulled = false; this.bMesh.renderOrder = 23; scene.add(this.bMesh);
    this.lines = [];
    this.rocketGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.6, 8); this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.7, roughness: 0.4 });
  };

  // ------------------------------------------------------------ enemy
  class Enemy {
    constructor(type, x, y, z, o) {
      o = o || {};
      const T = this.T = TYPES[type]; this.type = type; this.kind = T.kind; this.name = T.name;
      this.m = CF.EnemyModels[type]();
      for (const mm of this.m.mats) if (mm.emissive) mm.userData.e0 = mm.emissive.clone();
      this.root = this.m.root; E.scene.add(this.root);
      this.body = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), radius: T.radius, height: Math.min(T.height, 1.9), stepHeight: 0.62, grounded: true, stepped: 0, noSnap: false };
      this.hp = this.maxHp = T.hp * CF.diff().hp * ((CF.diff().typeHp || {})[this.type] || 1) * (o.hpMul || 1);
      this.yaw = o.yaw != null ? o.yaw : Math.random() * 6.28; this.aimYaw = 0; this.aimPitch = 0;
      this.state = o.aware ? 'hunt' : (o.patrol ? 'patrol' : 'idle');
      this.patrol = o.patrol || null; this.pIdx = 1; this.pWait = 0;
      this.alive = true; this.canSee = false; this.seenT = -99; this.spotT = -99; this.losT = Math.random() * 0.3;
      this.lastKnown = new THREE.Vector3(x, y, z); this.alertT = 0; this.reactT = 0;
      this.fireCd = U.rand(0.6, 1.4); this.burstLeft = 0; this.burstT = 0; this.lastFired = -99;
      this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = U.rand(1, 2.5);
      this.flashT = 0; this.flinch = 0; this.staggerAcc = 0; this.staggerT = 0; this.phase = Math.random() * 6;
      this.stuckT = 0; this.lastPos = new THREE.Vector3(x, y, z); this.sideT = 0; this.coverT = 0; this.cover = null;
      this.spawnT = o.spawnFx ? 0 : 1; this.deadT = 0; this.recoil = 0;
      this.leapT = 0; this.leapState = ''; this.leapHit = false; this.biteT = 0;
      this.rocketT = U.rand(5, 8); this.tele = null;
      this.hover = U.rand(3.5, 6.5); this.orbitA = Math.random() * 6.28; this.orbitDir = Math.random() < 0.5 ? -1 : 1;
      this.noScore = !!o.noScore; this.onDeath = o.onDeath || null; this.tag = o.tag || null;
      if (T.flying) { this.body.pos.y = y + this.hover; this.body.noSnap = true; }
      if (o.spawnFx) { CF.FX.spawnBeam(new THREE.Vector3(x, y, z), T.height, T.frost); this.root.scale.set(0.001, 0.001, 0.001); }
      this.root.position.copy(this.body.pos); this.root.rotation.y = this.yaw;
      this.root.updateMatrixWorld(true); this.cacheHits();
    }
    center(out) { return out.set(this.body.pos.x, this.body.pos.y + (this.T.flying ? 0 : this.T.height * 0.55), this.body.pos.z); }
    eyePos(out) { return out.set(this.body.pos.x, this.body.pos.y + this.T.eye, this.body.pos.z); }
    cacheHits() { for (const h of this.m.hit) h.obj.localToWorld(h.w.copy(h.off)); }

    becomeAware(pos, instant) {
      if (!this.alive) return;
      if (pos) this.lastKnown.copy(pos);
      if (this.state === 'idle' || this.state === 'patrol' || this.state === 'alert') {
        this.state = 'hunt'; this.reactT = instant ? 0 : U.rand(0.35, 0.7) / CF.diff().aggro;
        this.spotT = CF.time;
        A.play(this.T.alert || (this.kind === 'stalker' ? 'screech' : 'alert'), this.body.pos, { ref: 6 });
        for (const o of E.list) if (o !== this && o.alive && (o.state === 'idle' || o.state === 'patrol') && o.body.pos.distanceTo(this.body.pos) < 22) { o.lastKnown.copy(this.lastKnown); o.state = 'hunt'; o.reactT = U.rand(0.5, 1.1); o.spotT = CF.time; }
      }
    }

    damage(amount, info) {
      if (!this.alive || this.spawnT < 1) return null;
      const part = info.part;
      let mult = part ? part.mult : 1, tag = part ? part.tag : 'body';
      if (tag === 'head' && info.weapon) mult = CF.Weapons.defs[info.weapon].head * (part.mult / 2);
      const unaware = this.state === 'idle' || this.state === 'patrol';
      if (unaware && info.source === 'player') mult *= 1.5;
      const dmg = amount * mult;
      this.hp -= dmg; this.flashT = 0.09; this.flinch = Math.min(1, this.flinch + dmg / 40);
      this.staggerAcc += dmg;
      if (info.dir && info.knock) { const k = info.knock * Math.min(1.5, dmg / 60) * (this.kind === 'juggernaut' ? 0.2 : this.T.static ? 0 : 1); this.body.vel.x += info.dir.x * k; this.body.vel.z += info.dir.z * k; }
      if (info.source === 'player') { const P = CF.Player; this.becomeAware(P.chestPos(_v2), true); this.lastKnown.copy(P.body.pos); this.seenT = CF.time; }
      if (info.point) CF.FX.botHit(info.point, info.normal || _v.set(0, 1, 0), tag === 'weak');
      if (info.point) A.play('impactBot', info.point, { ref: 4 });
      CF.Game.stats.damageDealt += Math.min(dmg, Math.max(0, this.hp + dmg));
      const killed = this.hp <= 0;
      if (info.source === 'player') {
        CF.HUD.hitmarker(killed ? 'kill' : tag === 'head' ? 'head' : tag === 'weak' ? 'head' : 'hit');
        if (info.point) CF.HUD.dmgNumber(info.point, dmg, tag === 'head' ? 'head' : tag === 'weak' ? 'weak' : '');
        A.play(tag === 'head' || tag === 'weak' ? 'headshot' : 'hit', null, { ui: true });
      }
      if (killed) { this.die(info, tag === 'head'); return { killed: true, head: tag === 'head', dealt: dmg }; }
      return { head: tag === 'head', dealt: dmg };
    }

    die(info, head) {
      this.alive = false; this.state = 'dead'; this.deadT = 0;
      const c = this.center(new THREE.Vector3());
      const big = this.kind === 'juggernaut' ? 1.6 : this.kind === 'bloom' ? 2 : this.kind === 'stalker' ? 0.8 : 1;
      if (this.T.frost) { CF.FX.shatter(c, big); A.play('shatter', c, { ref: 7, vol: big }); } else CF.FX.botExplode(c, big);
      if (this.kind === 'juggernaut') CF.Game.explode(c, { radius: 4, damage: 40, source: 'enemy', noFx: true, shake: 0.5 });
      const d = info && info.dir ? _v.copy(info.dir) : _v.set(0, 0, 0);
      for (const part of this.m.gibs) {
        const vel = new THREE.Vector3(d.x * U.rand(2, 5) + U.gauss() * 2.5, U.rand(3, 6.5), d.z * U.rand(2, 5) + U.gauss() * 2.5);
        CF.FX.gib(part, vel, 9);
      }
      if (this.T.frost) this.m.eyeMat.color.setRGB(0.02, 0.05, 0.08); else this.m.eyeMat.color.setRGB(0.06, 0.01, 0.01);
      if (this.m.ventMat) this.m.ventMat.color.setRGB(0.2, 0.05, 0.01);
      for (const mm of this.m.mats) if (mm.emissive) mm.emissive.setRGB(0, 0, 0);
      this.fallDir = Math.random() < 0.5 ? -1 : 1;
      if (this.tele) { this.tele = null; }
      if (this.onDeath) this.onDeath(this);
      CF.Game.onEnemyKilled(this, info || {}, head);
    }

    // perception: vision cone + line of sight, staggered
    perceive(dt, P) {
      this.losT -= dt;
      if (this.losT > 0) return;
      this.losT = U.rand(0.18, 0.3);
      if (!P.alive) { this.canSee = false; return; }
      this.eyePos(_eye); P.chestPos(_pc);
      const dx = _pc.x - _eye.x, dy = _pc.y - _eye.y, dz = _pc.z - _eye.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      let see = dist < this.T.sight;
      if (see && (this.state === 'idle' || this.state === 'patrol')) {
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        const cosA = (fx * dx + fz * dz) / (Math.hypot(dx, dz) || 1);
        const crouchK = P.crouching ? 0.75 : 1;
        see = cosA > this.T.fovCos && dist < this.T.sight * 0.8 * crouchK;
      }
      if (see) see = W.segmentClear(_eye.x, _eye.y, _eye.z, _pc.x, _pc.y, _pc.z) || W.segmentClear(_eye.x, _eye.y, _eye.z, _pc.x, P.body.pos.y + P.eye, _pc.z);
      this.canSee = see; this.dist = dist;
      const unaware = this.state === 'idle' || this.state === 'patrol';
      if (see && unaware) {
        // suspicion builds over time: fast up close, slow at range, slower if crouched, faster if sprinting
        const near = U.clamp(1 - dist / (this.T.sight * 0.8), 0, 1);
        const rate = (0.3 + near * 1.9) * (P.crouching ? 0.55 : 1) * (P.sprinting ? 1.5 : 1) * CF.diff().aggro;
        this.suspicion = Math.min(1, (this.suspicion || 0) + rate * 0.24);
        this.suspectPos = P.body.pos.clone();
        if (this.suspicion >= 1 || dist < 4) this.becomeAware(P.body.pos);
      } else if (see) {
        this.seenT = CF.time; this.lastKnown.copy(P.body.pos);
        if (this.state === 'alert') this.becomeAware(P.body.pos);
      } else if (this.suspicion > 0) this.suspicion = Math.max(0, this.suspicion - 0.06);
    }

    update(dt, P) {
      const b = this.body, T = this.T;
      if (!this.alive) { this.updateDead(dt); return; }
      if (this.spawnT < 1) {
        this.spawnT = Math.min(1, this.spawnT + dt / 0.7);
        const s = U.easeOutBack(this.spawnT); this.root.scale.set(Math.max(0.001, 1 + (s - 1) * 0.3), Math.max(0.001, s), Math.max(0.001, 1 + (s - 1) * 0.3));
        const sk = 1 - this.spawnT;
        for (const mm of this.m.mats) if (mm.emissive) { const e = mm.userData.e0; if (T.frost) mm.emissive.setRGB(e.r + 0.4 * sk, e.g + 1.4 * sk, e.b + 2 * sk); else mm.emissive.setRGB(e.r + 1.5 * sk, e.g + 0.3 * sk, e.b + 0.1 * sk); }
        this.pose(dt, 0); this.root.position.copy(b.pos); this.root.updateMatrixWorld(true); this.cacheHits();
        return;
      }
      this.perceive(dt, P);
      this.flashT -= dt; this.flinch = Math.max(0, this.flinch - dt * 4); this.recoil = Math.max(0, this.recoil - dt * 8);
      this.staggerAcc = Math.max(0, this.staggerAcc - dt * 80);
      if (T.stagger && this.staggerAcc > T.stagger && this.staggerT <= 0) { this.staggerT = this.kind === 'juggernaut' ? 1.0 : 0.45; this.staggerAcc = 0; this.burstLeft = 0; }
      this.staggerT -= dt;
      const k = Math.max(0, this.flashT / 0.09) * 0.7;
      for (const mm of this.m.mats) if (mm.emissive) { const e = mm.userData.e0; mm.emissive.setRGB(e.r + k, e.g + k * 0.9, e.b + k * 0.8); }
      if (this.reactT > 0) this.reactT -= dt;
      if (T.static) this.staticAI(dt, P); else if (T.flying) this.flyAI(dt, P); else if (this.kind === 'stalker') this.stalkerAI(dt, P); else this.soldierAI(dt, P);
      this.root.position.copy(b.pos); this.root.rotation.y = this.yaw;
      this.root.updateMatrixWorld(true); this.cacheHits();
    }

    // steer along the flow field toward the player
    chase(speed, dt) {
      const b = this.body;
      let dx, dz;
      if (W.flowDir(b.pos.x, b.pos.z, _flow)) { dx = _flow.x; dz = _flow.z; }
      else { dx = this.lastKnown.x - b.pos.x; dz = this.lastKnown.z - b.pos.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
      if (this.sideT > 0) { this.sideT -= dt; const t = dx; dx = -dz * this.strafe; dz = t * this.strafe; }
      this.moveDir(dx, dz, speed, dt, true);
    }
    moveDir(dx, dz, speed, dt, face) {
      const b = this.body;
      b.vel.x = U.damp(b.vel.x, dx * speed, 7, dt); b.vel.z = U.damp(b.vel.z, dz * speed, 7, dt);
      if (face && (dx || dz)) this.turnTo(Math.atan2(-dx, -dz), 6, dt);
    }
    turnTo(target, rate, dt) { const d = U.wrapAngle(target - this.yaw); this.yaw += U.clamp(d, -rate * dt, rate * dt); }
    physics(dt) {
      const b = this.body;
      b.vel.y -= 19.5 * dt;
      W.moveBody(b, dt);
      if (b.grounded && b.vel.y < 0) b.vel.y = 0;
      if (b.pos.y < -6) { this.hp = 0; this.die({}); }
      // stuck detection
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        const moved = this.lastPos.distanceTo(b.pos);
        if (moved < 0.35 && Math.hypot(b.vel.x, b.vel.z) > 0.5) { this.sideT = 0.7; this.strafe *= -1; }
        this.lastPos.copy(b.pos); this.stuckT = 0;
      }
    }
    faceTarget(P, dt, rate) {
      const b = this.body, px = P.body.pos.x - b.pos.x, pz = P.body.pos.z - b.pos.z;
      this.turnTo(Math.atan2(-px, -pz), rate || 5, dt);
      const dy = (P.body.pos.y + 1.2) - (b.pos.y + this.T.eye);
      this.aimPitch = U.damp(this.aimPitch, U.clamp(Math.atan2(dy, Math.hypot(px, pz)), -0.7, 0.9), 8, dt);
    }

    soldierAI(dt, P) {
      const b = this.body, T = this.T, stag = this.staggerT > 0;
      const ppos = P.body.pos, dist = Math.hypot(ppos.x - b.pos.x, ppos.z - b.pos.z);
      let speed = 0;
      if ((this.state === 'idle' || this.state === 'patrol') && this.suspicion > 0.3 && this.suspectPos) {
        this.moveDir(0, 0, 0, dt);
        this.turnTo(Math.atan2(-(this.suspectPos.x - b.pos.x), -(this.suspectPos.z - b.pos.z)), 2.5, dt);
      } else if (this.state === 'idle') { b.vel.x = U.damp(b.vel.x, 0, 8, dt); b.vel.z = U.damp(b.vel.z, 0, 8, dt); this.yaw += Math.sin(CF.time * 0.4 + this.phase) * 0.15 * dt; }
      else if (this.state === 'patrol') {
        const tgt = this.patrol[this.pIdx];
        const dx = tgt[0] - b.pos.x, dz = tgt[1] - b.pos.z, l = Math.hypot(dx, dz);
        if (this.pWait > 0) { this.pWait -= dt; this.moveDir(0, 0, 0, dt); }
        else if (l < 0.6) { this.pIdx = (this.pIdx + 1) % this.patrol.length; this.pWait = U.rand(1.5, 3); }
        else { this.moveDir(dx / l, dz / l, T.walk, dt, true); speed = T.walk; }
      } else if (this.state === 'hunt') {
        if (this.reactT > 0) { this.faceTarget(P, dt, 4); this.moveDir(0, 0, 0, dt); }
        else if (this.canSee && dist < T.range[1]) { this.state = 'combat'; }
        else { this.chase(T.run, dt); speed = T.run; if (CF.time - this.seenT > 18) { this.state = 'alert'; this.alertT = 8; } }
      } else if (this.state === 'alert') {
        this.alertT -= dt;
        const dx = this.lastKnown.x - b.pos.x, dz = this.lastKnown.z - b.pos.z, l = Math.hypot(dx, dz);
        if (l > 1.5) { this.chase(T.walk * 1.4, dt); speed = T.walk; } else { this.moveDir(0, 0, 0, dt); this.yaw += dt * 1.2; }
        if (this.alertT <= 0) this.state = this.patrol ? 'patrol' : 'idle';
      } else if (this.state === 'combat') {
        this.faceTarget(P, dt, 5);
        if (!this.canSee && CF.time - this.seenT > 1.4) { this.state = 'hunt'; }
        else if (dist > T.range[1] + 4) { this.chase(T.run, dt); speed = T.run; }
        else if (this.cover) {
          const dx = this.cover.x - b.pos.x, dz = this.cover.z - b.pos.z, l = Math.hypot(dx, dz);
          this.coverT -= dt;
          if (l > 0.8 && this.coverT > 0) { this.moveDir(dx / l, dz / l, T.run, dt, false); speed = T.run; }
          else { this.moveDir(0, 0, 0, dt); if (this.coverT < -1.6) this.cover = null; }
        } else {
          this.strafeT -= dt;
          if (this.strafeT <= 0 || b.hitWall) { this.strafe *= -1; this.strafeT = U.rand(1.0, 2.6); }
          let fx = (ppos.x - b.pos.x) / (dist || 1), fz = (ppos.z - b.pos.z) / (dist || 1);
          let mx = -fz * this.strafe, mz = fx * this.strafe, sp = T.walk * 1.3;
          if (dist < T.range[0]) { mx -= fx * 1.2; mz -= fz * 1.2; sp = T.run * 0.8; }
          else if (dist > T.range[1] * 0.8) { mx += fx * 0.8; mz += fz * 0.8; }
          if (this.kind === 'juggernaut') { mx = fx * 0.6 + mx * 0.3; mz = fz * 0.6 + mz * 0.3; sp = T.walk; }
          const l = Math.hypot(mx, mz) || 1;
          this.moveDir(mx / l, mz / l, stag ? 0 : sp, dt, false); speed = sp;
          if (this.hp < this.maxHp * 0.4 && this.kind === 'sentry' && Math.random() < dt * 0.5) this.findCover(P);
        }
        if (!stag && this.reactT <= 0) this.shootLogic(dt, P, dist);
      }
      if (this.kind === 'juggernaut' && this.state !== 'idle' && this.state !== 'patrol') this.rocketLogic(dt, P);
      this.physics(dt);
      this.pose(dt, Math.hypot(b.vel.x, b.vel.z));
    }

    findCover(P) {
      P.chestPos(_pc);
      for (let i = 0; i < 12; i++) {
        const c = W.randomWalkable(this.body.pos.x, this.body.pos.z, 3, 10, 4);
        if (c < 0) continue;
        const x = W.cellX(c), z = W.cellZ(c), y = W.nav.hgt[c] + 1.2;
        if (!W.segmentClear(_pc.x, _pc.y, _pc.z, x, y, z)) { this.cover = { x, z }; this.coverT = 3.5; return; }
      }
    }

    shootLogic(dt, P, dist) {
      const T = this.T;
      if (this.burstLeft > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) { this.burstLeft--; this.burstT = T.burstGap; this.fireAt(P, dist); }
        return;
      }
      this.fireCd -= dt * CF.diff().aggro;
      if (this.fireCd <= 0 && this.canSee && dist < T.range[1] + 6) {
        this.burstLeft = T.burst + (Math.random() < 0.3 ? 1 : 0); this.burstT = 0;
        this.fireCd = U.rand(T.cool[0], T.cool[1]);
      }
    }

    fireAt(P, dist) {
      const T = this.T;
      const muzzle = this.m.p.muzzle.getWorldPosition(new THREE.Vector3());
      P.chestPos(_pc);
      const lead = (dist / T.projSpeed) * 0.55 * Math.min(1.2, CF.diff().acc);
      _pc.addScaledVector(P.body.vel, lead);
      const warm = 1 + 1.6 * Math.max(0, 1 - (CF.time - this.spotT) / 2.2);
      const moveK = 1 + Math.min(1, Math.hypot(P.body.vel.x, P.body.vel.z) / 7) * 0.8;
      const spread = (T.spread / CF.diff().acc) * warm * moveK * (P.crouching ? 0.85 : 1) * Math.PI / 180;
      _dir.subVectors(_pc, muzzle).normalize();
      _dir.x += U.gauss() * spread; _dir.y += U.gauss() * spread * 0.7; _dir.z += U.gauss() * spread; _dir.normalize();
      E.shoot(T.bolt, muzzle, _dir, T.projSpeed, T.dmg, this);
      this.recoil = 1; this.lastFired = CF.time;
      if (T.frost) CF.FX.muzzle(muzzle, _dir, 1.2, 3.4, 5, this.kind === 'juggernaut' ? 1.1 : 0.6);
      else CF.FX.muzzle(muzzle, _dir, 5, 1.4, 0.5, this.kind === 'juggernaut' ? 1.1 : 0.6);
      A.play(T.sfx || (this.kind === 'hornet' ? 'droneShot' : this.kind === 'juggernaut' ? 'heavyShot' : 'enemyShot'), muzzle, { ref: 6 });
    }

    rocketLogic(dt, P) {
      if (this.staggerT > 0) { this.tele = null; return; }
      if (this.tele) {
        this.tele.t -= dt;
        const from = this.m.p.podMuzzle.getWorldPosition(_v);
        if (this.T.frost) E.line(from, this.tele.target, 0.6, 3, 5, 0.025); else E.line(from, this.tele.target, 6, 0.3, 0.2, 0.025);
        if (this.tele.t <= 0) {
          this.rq = [0, 0.28].map((t) => ({ t, target: this.tele.target.clone().add(new THREE.Vector3(U.gauss() * 0.8, 0, U.gauss() * 0.8)) }));
          this.tele = null; this.rocketT = U.rand(6, 9) / CF.diff().aggro;
        }
        return;
      }
      if (this.rq && this.rq.length) {
        for (let i = this.rq.length - 1; i >= 0; i--) {
          const r = this.rq[i]; r.t -= dt;
          if (r.t <= 0) {
            const from = this.m.p.podMuzzle.getWorldPosition(new THREE.Vector3());
            if (this.T.lob) { E.mortar(from, r.target, 1.25, this, 36, 'shardLob'); A.play('shardLob', from, { ref: 8 }); CF.FX.muzzle(from, _v.set(0, 1, 0), 1.2, 3.4, 5, 1.1); }
            else E.rocket(from, r.target, this);
            this.rq.splice(i, 1);
          }
        }
      }
      this.rocketT -= dt;
      if (this.rocketT <= 0 && this.canSee) {
        const tgt = P.body.pos.clone(); tgt.y += 0.6; tgt.addScaledVector(P.body.vel, 0.6);
        this.tele = { t: 1.1, target: tgt };
        A.play('laserCharge', this.body.pos, { ref: 8 });
      }
    }

    stalkerAI(dt, P) {
      const b = this.body, T = this.T;
      const ppos = P.body.pos, dx = ppos.x - b.pos.x, dz = ppos.z - b.pos.z, dist = Math.hypot(dx, dz);
      let speed = 0;
      if (this.leapState === 'wind') {
        this.leapT -= dt; this.faceTarget(P, dt, 8); this.moveDir(0, 0, 0, dt);
        if (this.leapT <= 0) {
          this.leapState = 'air'; this.leapHit = false;
          const l = dist || 1, sp = U.clamp(dist * 1.6, 9, 14);
          b.vel.set(dx / l * sp, 4.6 + Math.max(0, ppos.y - b.pos.y) * 1.2, dz / l * sp); b.grounded = false;
          A.play('pounce', b.pos, { ref: 5 });
        }
      } else if (this.leapState === 'air') {
        P.chestPos(_pc);
        if (!this.leapHit && this.center(_v).distanceTo(_pc) < 1.25) {
          this.leapHit = true; P.damage(T.dmg, b.pos, 'a ' + this.name); P.body.vel.x += b.vel.x * 0.35; P.body.vel.z += b.vel.z * 0.35;
        }
        if (b.grounded && b.vel.y <= 0) { this.leapState = 'recover'; this.leapT = 0.75; }
      } else if (this.leapState === 'recover') {
        this.leapT -= dt; this.moveDir(0, 0, 0, dt);
        if (this.leapT <= 0) this.leapState = '';
      } else if (this.state === 'idle' || this.state === 'patrol' || this.state === 'alert') {
        if (this.state === 'patrol') this.soldierPatrol(dt); else { b.vel.x = U.damp(b.vel.x, 0, 8, dt); b.vel.z = U.damp(b.vel.z, 0, 8, dt); }
      } else {
        if (this.reactT > 0) { this.faceTarget(P, dt, 6); this.moveDir(0, 0, 0, dt); }
        else if (this.biteT > 0) {
          this.biteT -= dt; this.faceTarget(P, dt, 8); this.moveDir(0, 0, 0, dt);
          if (this.biteT <= 0 && dist < 2.3 && Math.abs(ppos.y - b.pos.y) < 1.6) { P.damage(T.dmg * 0.8, b.pos, 'a ' + this.name); A.play('meleeHit', b.pos, { ref: 4 }); }
        } else if (dist < 1.9 && Math.abs(ppos.y - b.pos.y) < 1.4) { this.biteT = 0.42; A.play(this.T.alert || 'screech', b.pos, { ref: 5 }); }
        else if (this.canSee && dist < 7.5 && dist > 3 && this.staggerT <= 0 && Math.random() < dt * 2.2) { this.leapState = 'wind'; this.leapT = 0.38; A.play(this.T.alert || 'screech', b.pos, { ref: 6 }); }
        else if (this.staggerT <= 0) {
          const unreachable = !isFinite(W.flowDist(b.pos.x, b.pos.z)) || (dist < 4 && ppos.y - b.pos.y > 1.2);
          if (unreachable && this.canSee && dist < 7 && Math.random() < dt * 1.5) { this.leapState = 'wind'; this.leapT = 0.3; }
          else { this.chase(T.run * (dist < 12 ? 1 : 0.85), dt); speed = T.run; }
        }
      }
      this.physics(dt);
      this.pose(dt, Math.hypot(b.vel.x, b.vel.z));
    }
    staticAI(dt) {
      if (this.state === 'idle' || this.state === 'patrol') this.state = 'combat';
      this.body.vel.set(0, 0, 0);
      this.pose(dt, 0);
    }
    soldierPatrol(dt) {
      const b = this.body, tgt = this.patrol[this.pIdx];
      const dx = tgt[0] - b.pos.x, dz = tgt[1] - b.pos.z, l = Math.hypot(dx, dz);
      if (this.pWait > 0) { this.pWait -= dt; this.moveDir(0, 0, 0, dt); }
      else if (l < 0.6) { this.pIdx = (this.pIdx + 1) % this.patrol.length; this.pWait = U.rand(1.5, 3); }
      else this.moveDir(dx / l, dz / l, this.T.walk, dt, true);
    }

    flyAI(dt, P) {
      const b = this.body, T = this.T;
      const ppos = P.body.pos;
      if (this.state === 'idle' || this.state === 'patrol') { this.state = 'hunt'; this.spotT = CF.time; }
      this.orbitA += dt * 0.35 * this.orbitDir;
      if (Math.random() < dt * 0.15) this.orbitDir *= -1;
      const r = this.canSee ? 12 : 7;
      _v.set(ppos.x + Math.cos(this.orbitA) * r, ppos.y + this.hover, ppos.z + Math.sin(this.orbitA) * r);
      _v.y = Math.min(_v.y, ppos.y + 9);
      _dir.subVectors(_v, b.pos);
      const l = _dir.length();
      if (l > 0.01) _dir.divideScalar(l);
      const sp = Math.min(T.run, l * 1.6 + 1);
      b.vel.x = U.damp(b.vel.x, _dir.x * sp, 2.5, dt); b.vel.y = U.damp(b.vel.y, _dir.y * sp, 2.5, dt); b.vel.z = U.damp(b.vel.z, _dir.z * sp, 2.5, dt);
      // obstacle avoidance + move
      const vl = b.vel.length();
      if (vl > 0.01) {
        _v2.copy(b.vel).divideScalar(vl);
        const h = W.raycast(b.pos.x, b.pos.y, b.pos.z, _v2.x, _v2.y, _v2.z, vl * dt + 0.9);
        if (h) {
          const vn = b.vel.x * h.nx + b.vel.y * h.ny + b.vel.z * h.nz;
          b.vel.x -= vn * h.nx * 1.2; b.vel.y -= vn * h.ny * 1.2 - 1.5 * dt * 10; b.vel.z -= vn * h.nz * 1.2;
        }
      }
      b.pos.addScaledVector(b.vel, dt);
      const gy = W.groundHeight(b.pos.x, b.pos.y, b.pos.z);
      if (b.pos.y < gy + 1.2) { b.pos.y = gy + 1.2; b.vel.y = Math.abs(b.vel.y) * 0.3; }
      this.faceTarget(P, dt, 4);
      const dist = b.pos.distanceTo(ppos);
      if (this.reactT <= 0 && this.staggerT <= 0) this.shootLogic(dt, P, dist);
      this.pose(dt, vl);
    }

    pose(dt, speed) {
      const p = this.m.p, t = this.kind, T = this.T;
      const amp = U.clamp(speed / T.run, 0, 1.2);
      this.phase += dt * (t === 'stalker' ? 2.2 : t === 'juggernaut' ? 1.1 : 1.6) * Math.max(speed, 0.001) * (t === 'stalker' ? 1.1 : 1.4);
      const ph = this.phase, fl = this.flinch;
      if (t === 'sentry' || t === 'juggernaut') {
        const s = Math.sin(ph), stride = t === 'juggernaut' ? 0.45 : 0.55;
        p.legL.rotation.x = -s * stride * amp; p.legR.rotation.x = s * stride * amp;
        p.kneeL.rotation.x = (0.12 + 0.7 * Math.max(0, Math.cos(ph))) * amp; p.kneeR.rotation.x = (0.12 + 0.7 * Math.max(0, -Math.cos(ph))) * amp;
        p.hips.position.y = (t === 'juggernaut' ? 1.3 : 1.0) + Math.abs(s) * 0.045 * amp - (this.staggerT > 0 ? 0.12 : 0);
        const aimK = this.state === 'combat' || this.state === 'hunt' ? 1 : 0.2;
        p.torso.rotation.x = this.aimPitch * 0.6 * aimK - fl * 0.35 + (this.staggerT > 0 ? -0.25 : 0) + 0.04 * amp;
        p.torso.rotation.z = Math.sin(ph) * 0.04 * amp + (Math.random() - 0.5) * fl * 0.2;
        p.head.rotation.x = this.aimPitch * 0.4 * aimK;
        if (t === 'sentry') {
          p.armR.rotation.set(-1.15 * aimK - 0.2, 0, 0.1); p.elbowR.rotation.x = -0.55 * aimK;
          p.armL.rotation.set(-1.25 * aimK - 0.15, 0.3 * aimK, -0.45 * aimK); p.elbowL.rotation.x = -0.9 * aimK;
          p.gun.position.set(0.14, 0.3 - (1 - aimK) * 0.25, -0.3 + this.recoil * 0.06 + (1 - aimK) * 0.15);
          p.gun.rotation.x = -(1 - aimK) * 0.9;
        } else {
          p.cannon.position.z = -0.2 + this.recoil * 0.1;
          p.armR.rotation.x = -0.3 - this.aimPitch * 0.5; p.armL.rotation.x = Math.sin(ph) * 0.3 * amp;
          if (this.m.ventMat) { const pulse = 0.65 + 0.35 * Math.sin(CF.time * 4), vc = this.m.ventCol || [6, 2.2, 0.45]; this.m.ventMat.color.setRGB(vc[0] * pulse, vc[1] * pulse, vc[2] * pulse); }
          if (amp > 0.2 && Math.sin(ph) * Math.sin(ph - dt * 3) < 0) this.footfall();
        }
      } else if (t === 'stalker') {
        for (const L of p.legs) {
          const s = Math.sin(ph + L.phase);
          L.hip.rotation.x = (this.leapState === 'air' ? (L.front ? -0.9 : 0.9) : s * 0.75 * amp);
          L.knee.rotation.x = this.leapState === 'air' ? 0.2 : (L.front ? -1 : 1) * (0.2 + 0.6 * Math.max(0, Math.cos(ph + L.phase))) * amp;
        }
        const crouch = this.leapState === 'wind' ? 0.22 : this.biteT > 0 ? 0.1 : 0;
        p.body.position.y = 0.72 + Math.abs(Math.sin(ph)) * 0.06 * amp - crouch;
        p.body.rotation.x = Math.sin(ph * 2) * 0.05 * amp + (this.leapState === 'air' ? -0.25 : 0) + crouch * 0.6 - fl * 0.3;
        p.head.rotation.x = -this.aimPitch * 0.3 + (this.biteT > 0 ? Math.sin(this.biteT * 30) * 0.3 : 0);
        p.jaw.rotation.x = this.biteT > 0 || this.leapState ? 0.5 : 0.1;
        p.tail.rotation.y = Math.sin(CF.time * 3 + this.phase) * 0.4;
      } else if (t === 'bloom') {
        const pulse = 0.5 + 0.5 * Math.sin(CF.time * 2.2 + this.phase);
        p.core.scale.setScalar(0.62 + pulse * 0.12 + fl * 0.2);
        this.m.eyeMat.color.setRGB(0.5 + pulse * 0.8, 2.6 + pulse * 2, 4 + pulse * 2.5);
        p.crown.rotation.y += dt * 0.25;
      } else if (t === 'hornet') {
        for (const r of p.rotors) r.rotation.y += dt * 38;
        const fwd = -(this.body.vel.x * -Math.sin(this.yaw) + this.body.vel.z * -Math.cos(this.yaw));
        p.body.rotation.x = U.damp(p.body.rotation.x, U.clamp(fwd * 0.05, -0.4, 0.4) + this.aimPitch * 0.4, 5, dt);
        p.body.position.y = Math.sin(CF.time * 2.3 + this.phase) * 0.08;
        p.gun.rotation.x = this.aimPitch * 0.6;
        p.body.rotation.z = Math.sin(CF.time * 1.7 + this.phase) * 0.06 + (Math.random() - 0.5) * fl * 0.3;
      }
    }
    footfall() {
      const P = CF.Player, d = P.body.pos.distanceTo(this.body.pos);
      if (d < 14) P.shake(0.06 * (1 - d / 14));
      A.play('land', this.body.pos, { ref: 6, vol: 1.4 });
    }

    updateDead(dt) {
      this.deadT += dt;
      const b = this.body;
      if (this.T.flying) {
        if (!this.crashed) {
          b.vel.y -= 16 * dt; b.pos.addScaledVector(b.vel, dt);
          this.root.rotation.x += dt * 6; this.root.rotation.z += dt * 4;
          const gy = W.groundHeight(b.pos.x, b.pos.y + 0.5, b.pos.z);
          if (b.pos.y < gy + 0.3 || this.deadT > 4) { this.crashed = true; CF.FX.botExplode(b.pos, 0.7); b.pos.y = gy + 0.2; }
          this.root.position.copy(b.pos);
        } else if (this.deadT > 7) this.remove();
        return;
      }
      const k = Math.min(1, this.deadT / 0.55);
      this.root.rotation.x = this.fallDir * U.easeOutCubic(k) * 1.45 * (this.kind === 'stalker' ? 0.3 : this.kind === 'bloom' ? 0 : 1);
      this.root.rotation.z = this.kind === 'stalker' ? this.fallDir * U.easeOutCubic(k) * 1.4 : 0;
      if (this.deadT > 6) this.root.position.y -= dt * 0.5;
      if (this.deadT > 8) this.remove();
    }
    remove() {
      E.scene.remove(this.root);
      const i = E.list.indexOf(this); if (i >= 0) E.list.splice(i, 1);
    }
  }
  E.Enemy = Enemy;

  // ------------------------------------------------------------ public API
  E.spawn = function (type, x, z, o) {
    o = o || {};
    let y = o.y != null ? o.y : W.navHeight(x, z);
    if (isNaN(y)) y = W.groundHeight(x, 20, z);
    const e = new Enemy(type, x, y, z, o);
    this.list.push(e);
    return e;
  };
  E.alive = function (filter) { let n = 0; for (const e of this.list) if (e.alive && (!filter || filter(e))) n++; return n; };
  E.clear = function () {
    for (const e of this.list) { E.scene.remove(e.root); if (e.cleanup) e.cleanup(); }
    this.list.length = 0;
    for (const p of this.proj) if (p.mesh) E.scene.remove(p.mesh);
    this.proj.length = 0; this.lines.length = 0;
  };
  E.noise = function (pos, radius) {
    for (const e of this.list) {
      if (!e.alive || e.spawnT < 1) continue;
      if (e.body.pos.distanceTo(pos) < radius && (e.state === 'idle' || e.state === 'patrol' || e.state === 'alert')) {
        e.lastKnown.copy(pos);
        if (e.body.pos.distanceTo(pos) < radius * 0.6) e.becomeAware(pos);
        else { e.state = 'alert'; e.alertT = 8; }
      }
    }
  };
  E.alertAll = function () { for (const e of this.list) if (e.alive) e.becomeAware(CF.Player.body.pos, true); };

  E.raycast = function (o, d, maxT) {
    let best = null, bt = maxT;
    for (const e of this.list) {
      if (!e.alive || e.spawnT < 1) continue;
      if (e.raycastBoss) { const h = e.raycastBoss(o, d, bt); if (h) { best = h; bt = h.t; } continue; }
      e.center(_v);
      const R = e.T.height * 0.75 + 0.6;
      _v2.subVectors(o, _v); const bq = _v2.dot(d), cq = _v2.lengthSq() - R * R;
      if (cq > 0 && bq > 0) continue;
      if (bq * bq - cq < 0) continue;
      for (const h of e.m.hit) {
        _v2.subVectors(o, h.w); const b2 = _v2.dot(d), c2 = _v2.lengthSq() - h.r * h.r, disc = b2 * b2 - c2;
        if (disc < 0) continue;
        let t = -b2 - Math.sqrt(disc); if (t < 0) t = -b2 + Math.sqrt(disc);
        if (t > 0 && t < bt) { bt = t; best = { enemy: e, t, part: h, point: new THREE.Vector3().copy(o).addScaledVector(d, t), normal: null, center: h.w }; }
      }
    }
    if (best && !best.normal) best.normal = new THREE.Vector3().subVectors(best.point, best.center).normalize();
    return best;
  };
  E.raycastAll = function (o, d, maxT, max) {
    const out = [], save = this.list;
    for (const e of save) {
      if (!e.alive) continue;
      this.list = [e];
      const h = this.raycast(o, d, maxT);
      if (h) out.push(h);
    }
    this.list = save;
    out.sort((a, b) => a.t - b.t);
    return out.slice(0, max || 4);
  };
  E.melee = function (origin, dir, range, dmg) {
    let best = null, bd = Infinity;
    for (const e of this.list) {
      if (!e.alive || e.spawnT < 1) continue;
      e.center(_v);
      const dx = _v.x - origin.x, dy = _v.y - origin.y, dz = _v.z - origin.z, dist = Math.hypot(dx, dz);
      if (dist > range + e.T.radius || Math.abs(dy) > 2.2) continue;
      const cos = (dx * dir.x + dz * dir.z) / (dist * Math.hypot(dir.x, dir.z) || 1);
      if (cos < 0.55) continue;
      if (dist < bd) { bd = dist; best = e; }
    }
    if (best) {
      best.center(_v);
      const info = { dir: new THREE.Vector3(dir.x, 0, dir.z).normalize(), point: _v.clone(), normal: new THREE.Vector3(-dir.x, 0, -dir.z), part: null, weapon: null, source: 'player', knock: 9, melee: true };
      if (best.damageMelee) best.damageMelee(dmg, info); else best.damage(dmg * (best.kind === 'juggernaut' ? 0.5 : 1), info);
      CF.Game.stats.hits++;
    }
    return best;
  };

  // ------------------------------------------------------------ projectiles
  const BOLT = { bolt: { c: [6, 1.1, 0.35], len: 1.3, w: 0.075, r: 0.22 }, laser: { c: [5.5, 0.4, 2.2], len: 1.0, w: 0.05, r: 0.2 }, slug: { c: [6, 2.6, 0.6], len: 1.6, w: 0.11, r: 0.3 }, mortar: { c: [6, 2, 0.4], len: 0.8, w: 0.3, r: 0.4 },
    shard: { c: [0.9, 3.6, 5.5], len: 1.1, w: 0.07, r: 0.22 }, shardHeavy: { c: [1.2, 3.8, 6], len: 1.5, w: 0.11, r: 0.3 }, shardLob: { c: [1.5, 4, 6], len: 0.9, w: 0.28, r: 0.4 } };
  E.shoot = function (kind, pos, dir, speed, dmg, owner) {
    const s = BOLT[kind] || BOLT.bolt;
    this.proj.push({ kind, pos: pos.clone(), prev: pos.clone(), vel: dir.clone().multiplyScalar(speed), dmg, owner, life: 3, r: s.r, whiz: false, spec: s, src: owner ? 'a ' + owner.name : 'enemy fire' });
  };
  E.rocket = function (from, target, owner) {
    const dir = target.clone().sub(from).normalize();
    const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
    mesh.position.copy(from); mesh.lookAt(from.clone().add(dir)); this.scene.add(mesh);
    this.proj.push({ kind: 'rocket', pos: from.clone(), prev: from.clone(), vel: dir.multiplyScalar(24), dmg: 45, owner, life: 5, r: 0.35, whiz: false, mesh, target: target.clone(), spec: null, src: 'a Juggernaut rocket' });
    A.play('rocket', from, { ref: 8 });
  };
  E.mortar = function (from, target, flight, owner, dmg, look) {
    const t = flight || 1.6, g = 16;
    const vel = new THREE.Vector3((target.x - from.x) / t, (target.y - from.y + 0.5 * g * t * t) / t, (target.z - from.z) / t);
    const frost = look === 'shardLob';
    this.proj.push({ kind: 'mortar', pos: from.clone(), prev: from.clone(), vel, dmg: dmg || 35, owner, life: t + 1, r: 0.4, whiz: true, grav: g, spec: frost ? BOLT.shardLob : BOLT.mortar, frost,
      src: owner ? (owner.boss ? owner.name : 'a ' + owner.name) : 'enemy fire', target: target.clone() });
  };
  /** Draw a one-frame beam (telegraph lasers). */
  E.line = function (a, b, r, g, bl, w) { this.lines.push({ a: a.clone(), b: b.clone(), c: [r, g, bl], w: w || 0.03 }); };

  const _cp = new THREE.Vector3(), _cq = new THREE.Vector3();
  function segSegDist2(p1, q1, p2, q2) {
    const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z, d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z;
    const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
    const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
    let s, t;
    if (a <= 1e-8) { s = 0; t = U.clamp(f / e, 0, 1); }
    else {
      const c = d1x * rx + d1y * ry + d1z * rz;
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den !== 0 ? U.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = U.clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = U.clamp((b - c) / a, 0, 1); }
    }
    _cp.set(p1.x + d1x * s, p1.y + d1y * s, p1.z + d1z * s); _cq.set(p2.x + d2x * t, p2.y + d2y * t, p2.z + d2z * t);
    return _cp.distanceToSquared(_cq);
  }
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
  E.updateProjectiles = function (dt, P) {
    const cam = CF.Game.camera.position;
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const p = this.proj[i];
      p.life -= dt;
      p.prev.copy(p.pos);
      if (p.kind === 'rocket') {
        _v.subVectors(p.target, p.pos).normalize();
        p.vel.lerp(_v.multiplyScalar(26), Math.min(1, dt * 1.2));
        if (Math.random() < 0.8) CF.FX.smoke.spawn(p.pos.x, p.pos.y, p.pos.z, U.gauss() * 0.2, 0.3, U.gauss() * 0.2, 1.4, 0.2, 1.1, 0.2, 0.2, 0.2, 0.6, -0.2, 0.6, 1);
        CF.FX.glow(p.pos.x, p.pos.y, p.pos.z, 0.5, 4, 2, 0.6, 0.03);
      }
      if (p.grav) p.vel.y -= p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      let dead = p.life <= 0, hitPos = null;
      // world
      _dir.subVectors(p.pos, p.prev); const len = _dir.length();
      if (len > 1e-5) {
        _dir.divideScalar(len);
        const h = W.raycast(p.prev.x, p.prev.y, p.prev.z, _dir.x, _dir.y, _dir.z, len);
        if (h) {
          dead = true; hitPos = new THREE.Vector3(h.x + h.nx * 0.1, h.y + h.ny * 0.1, h.z + h.nz * 0.1);
          if (h.box && h.box.owner && h.box.owner.hp !== undefined) CF.Game.damageBarrel(h.box.owner, p.dmg);
          if (p.kind !== 'rocket' && p.kind !== 'mortar') { CF.FX.sparks(h.x, h.y, h.z, h.nx, h.ny, h.nz, 5, 4, true); CF.FX.glow(h.x, h.y, h.z, 0.5, p.spec.c[0] * 0.5, p.spec.c[1] * 0.5, p.spec.c[2] * 0.5, 0.08); CF.FX.decal(CF.FX.scorches, h.x, h.y, h.z, h.nx, h.ny, h.nz, 0.3); }
        }
      }
      // player
      if (P.alive && !dead) {
        _pa.set(P.body.pos.x, P.body.pos.y + 0.35, P.body.pos.z); _pb.set(P.body.pos.x, P.body.pos.y + P.body.height - 0.25, P.body.pos.z);
        const rr = 0.36 + p.r;
        if (segSegDist2(p.prev, p.pos, _pa, _pb) < rr * rr) {
          dead = true; hitPos = p.pos.clone();
          if (p.kind !== 'rocket' && p.kind !== 'mortar') P.damage(p.dmg, p.owner ? p.owner.body.pos : p.prev, p.src);
        } else if (!p.whiz) {
          const d2 = segSegDist2(p.prev, p.pos, cam, cam);
          if (d2 < 2.6 * 2.6) { p.whiz = true; A.play('whiz', _cp, { ref: 2 }); CF.HUD.suppress(0.35); }
        }
      }
      // mortar: detonate over target
      if (!dead && p.kind === 'mortar' && p.vel.y < 0 && p.pos.y <= p.target.y + 0.2) { dead = true; hitPos = p.pos.clone(); }
      if (dead) {
        if (p.kind === 'rocket' || p.kind === 'mortar') {
          const at = hitPos || p.pos;
          CF.Game.explode(at, { radius: p.kind === 'rocket' ? 4.5 : 3.6, damage: p.dmg, source: 'enemy', killer: p.src, scale: 0.8, frost: p.frost });
        }
        if (p.mesh) this.scene.remove(p.mesh);
        this.proj.splice(i, 1);
        continue;
      }
      if (p.mesh) { p.mesh.position.copy(p.pos); p.mesh.lookAt(_v.copy(p.pos).add(p.vel)); }
    }
    this.drawBolts();
  };
  E.drawBolts = function () {
    const cam = CF.Game.camera.position, P = this.bPos, C = this.bCol;
    let n = 0;
    const quad = (ax, ay, az, bx, by, bz, w, c, tail) => {
      if (n >= this.bN) return;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const mx = (ax + bx) / 2 - cam.x, my = (ay + by) / 2 - cam.y, mz = (az + bz) / 2 - cam.z;
      let sx = dy * mz - dz * my, sy = dz * mx - dx * mz, sz = dx * my - dy * mx;
      const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
      const o = n * 12;
      P[o] = ax - sx; P[o + 1] = ay - sy; P[o + 2] = az - sz; P[o + 3] = ax + sx; P[o + 4] = ay + sy; P[o + 5] = az + sz;
      P[o + 6] = bx + sx; P[o + 7] = by + sy; P[o + 8] = bz + sz; P[o + 9] = bx - sx; P[o + 10] = by - sy; P[o + 11] = bz - sz;
      for (let k = 0; k < 4; k++) { const f = k < 2 ? tail : 1; C[o + k * 3] = c[0] * f; C[o + k * 3 + 1] = c[1] * f; C[o + k * 3 + 2] = c[2] * f; }
      n++;
    };
    for (const p of this.proj) {
      if (!p.spec) continue;
      const s = p.spec, vl = p.vel.length() || 1;
      const L = p.kind === 'mortar' ? s.len : Math.min(s.len, p.pos.distanceTo(p.prev) + s.len * 0.5);
      quad(p.pos.x - p.vel.x / vl * L, p.pos.y - p.vel.y / vl * L, p.pos.z - p.vel.z / vl * L, p.pos.x, p.pos.y, p.pos.z, s.w, s.c, 0.08);
      if (p.kind === 'mortar') { if (p.frost) CF.FX.glow(p.pos.x, p.pos.y, p.pos.z, 0.9, 1, 3, 4.5, 0.03); else CF.FX.glow(p.pos.x, p.pos.y, p.pos.z, 0.9, 4, 1.4, 0.3, 0.03); }
    }
    for (const l of this.lines) quad(l.a.x, l.a.y, l.a.z, l.b.x, l.b.y, l.b.z, l.w, l.c, 1);
    this.lines.length = 0;
    for (let i = n * 12; i < this.bN * 12; i++) P[i] = 0;
    this.bPosA.needsUpdate = true; this.bColA.needsUpdate = true;
  };

  // ------------------------------------------------------------ per-frame
  E.update = function (dt, P) {
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.3;
      if (this.list.some((e) => e.alive && !e.T.flying && (e.state === 'hunt' || e.state === 'combat' || e.state === 'alert'))) W.computeFlow(P.body.pos.x, P.body.pos.z);
    }
    let combat = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e) continue;
      e.update(dt, P);
      if (e.alive && (e.state === 'combat' || e.state === 'hunt')) combat++;
    }
    // separation between ground units
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (!a.alive || a.T.flying || a.net) continue;
      const aFix = !!a.T.static;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (!b.alive || b.T.flying || b.net) continue;
        const dx = b.body.pos.x - a.body.pos.x, dz = b.body.pos.z - a.body.pos.z, r = a.T.radius + b.T.radius, d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-6 && Math.abs(a.body.pos.y - b.body.pos.y) < 1.5) {
          const d = Math.sqrt(d2), bFix = !!b.T.static, push = (r - d) * (aFix || bFix ? 1 : 0.5);
          if (!aFix) { a.body.pos.x -= dx / d * push; a.body.pos.z -= dz / d * push; }
          if (!bFix) { b.body.pos.x += dx / d * push; b.body.pos.z += dz / d * push; }
        }
      }
      // keep enemies out of the player
      const pp = P.body.pos, dx = pp.x - a.body.pos.x, dz = pp.z - a.body.pos.z, r = a.T.radius + P.body.radius, d2 = dx * dx + dz * dz;
      if (a.boss) continue;
      if (d2 < r * r && d2 > 1e-6 && Math.abs(pp.y - a.body.pos.y) < 1.6) {
        const d = Math.sqrt(d2), push = r - d;
        if (aFix) { pp.x += dx / d * push; pp.z += dz / d * push; } else { a.body.pos.x -= dx / d * push; a.body.pos.z -= dz / d * push; }
      }
    }
    this.combatCount = combat;
    this.updateProjectiles(dt, P);
  };
})(window.CF);
