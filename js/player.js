'use strict';
/* Cinderfall — first-person player controller. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const STAND = 1.8, CROUCH = 1.15, EYE_STAND = 1.64, EYE_CROUCH = 1.0, EYE_SLIDE = 0.82;

  const P = CF.Player = {
    body: { pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.38, height: STAND, stepHeight: 0.55, grounded: false, stepped: 0 },
    yaw: 0, pitch: 0, recoilP: 0, recoilY: 0,
    health: 100, maxHealth: 100, armor: 0, alive: true, frozen: false, lastHurt: -99, deathT: 0, killer: '',
    sprinting: false, sprintT: 0, sprintOut: 0, crouching: false, crouchT: 0, sliding: false, slideT: 0, slideTime: 0,
    mantling: false, mantleT: 0, mantleFrom: new THREE.Vector3(), mantleTo: new THREE.Vector3(),
    bobPhase: 0, bobAmp: 0, moveFrac: 0, stepDist: 0, eyeOff: 0, eye: EYE_STAND,
    trauma: 0, shakeT: 0, fovKick: 0, tilt: 0, coyote: 0, jumpBuf: 0, airPeak: 0, hazardT: 0, hurtSndT: 0, heartT: 0,
    flinch: 0, camera: null, time: 0
  };

  P.init = function (camera) { this.camera = camera; };

  P.spawn = function (x, y, z, yaw, state) {
    const b = this.body;
    b.pos.set(x, y, z); b.vel.set(0, 0, 0); b.grounded = true; b.height = STAND;
    this.yaw = yaw || 0; this.pitch = 0; this.recoilP = 0; this.recoilY = 0;
    this.alive = true; this.frozen = false; this.deathT = 0; this.chillT = 0;
    this.maxHealth = state && state.maxHealth ? state.maxHealth : 100;
    this.health = state && state.health != null ? state.health : this.maxHealth;
    this.armor = state && state.armor != null ? state.armor : 0;
    this.sprinting = false; this.sprintT = 0; this.crouching = false; this.crouchT = 0; this.sliding = false; this.slideT = 0;
    this.mantling = false; this.trauma = 0; this.eyeOff = 0; this.eye = EYE_STAND; this.lastHurt = -99; this.flinch = 0;
    this.updateCamera(0);
    CF.HUD.setVitals(this.health, this.armor, this.maxHealth);
  };

  P.forward = function (out) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); };
  P.eyePos = function (out) { return out.set(this.body.pos.x, this.body.pos.y + this.eye, this.body.pos.z); };
  P.chestPos = function (out) { return out.set(this.body.pos.x, this.body.pos.y + this.body.height * 0.62, this.body.pos.z); };
  P.stopSprint = function () { if (this.sprinting) { this.sprinting = false; this.sprintOut = 0.12; } };
  P.addRecoil = function (pitchDeg, yawDeg) {
    const p = pitchDeg * Math.PI / 180, y = yawDeg * Math.PI / 180;
    this.pitch = Math.min(1.5, this.pitch + p * 0.3); this.recoilP += p * 0.7;
    this.yaw += y * 0.35; this.recoilY += y * 0.65;
  };
  P.shake = function (amount) { this.trauma = Math.min(1, this.trauma + amount * CF.settings.shake); };

  P.damage = function (amount, from, source, kind) {
    if (!this.alive || CF.Game.godMode) return;
    if (CF.Game.mode !== 'mp') amount *= CF.diff().dmg;
    let absorbed = 0;
    if (this.armor > 0) { absorbed = Math.min(this.armor, amount * 0.66); this.armor -= absorbed; }
    const hp = amount - absorbed;
    this.health -= hp; this.lastHurt = this.time;
    CF.Game.stats.damageTaken += amount;
    if (from) CF.HUD.damageFrom(from, this.body.pos, this.yaw, Math.min(1, amount / 25));
    CF.HUD.hurt(Math.min(1, amount / 30), absorbed > hp);
    this.shake(Math.min(0.35, amount / 60)); this.flinch = Math.min(1, this.flinch + amount / 40);
    if (this.hurtSndT <= 0) { A.play('hurt', null, { vol: absorbed > hp ? 0.6 : 1 }); if (absorbed > 0) A.play('armorHit'); this.hurtSndT = 0.12; }
    if (kind === 'explosion') A.concuss(Math.min(1, amount / 50));
    if (this.health <= 0) { this.health = 0; this.die(source || 'Unknown'); }
    CF.HUD.setVitals(this.health, this.armor);
  };
  P.heal = function (hp, armor) {
    if (hp) this.health = Math.min(this.maxHealth, this.health + hp);
    if (armor) this.armor = Math.min(100, this.armor + armor);
    CF.HUD.setVitals(this.health, this.armor);
  };
  P.die = function (source) {
    this.alive = false; this.deathT = 0; this.killer = source;
    this.sprinting = false; this.sliding = false;
    CF.Game.onPlayerDeath(source);
  };

  // ------------------------------------------------------------ mantle
  const _f = new THREE.Vector3();
  P.tryMantle = function () {
    const b = this.body;
    this.forward(_f);
    const px = b.pos.x + _f.x * 0.7, pz = b.pos.z + _f.z * 0.7;
    const top = W.groundBelow(px, pz, 0.18, b.pos.y + 1.65, 1.2);
    if (top === null || top - b.pos.y < 0.5) return false;
    // there must be an obstacle between us and the ledge (not a slope of stairs)
    const wallTop = W.groundBelow(b.pos.x + _f.x * 0.45, b.pos.z + _f.z * 0.45, 0.1, b.pos.y + 1.65, 1.2);
    if (wallTop === null) return false;
    const tx = b.pos.x + _f.x * 0.85, tz = b.pos.z + _f.z * 0.85;
    if (!W.headroom(tx, tz, b.radius * 0.9, top, CROUCH)) return false;
    if (!W.headroom(b.pos.x, b.pos.z, b.radius * 0.9, b.pos.y, top - b.pos.y + CROUCH)) return false;
    this.mantling = true; this.mantleT = 0;
    this.mantleFrom.copy(b.pos); this.mantleTo.set(tx, top, tz);
    this.mantleStand = W.headroom(tx, tz, b.radius * 0.9, top, STAND);
    b.vel.set(0, 0, 0); this.sprinting = false; this.sliding = false;
    A.play('mantle');
    return true;
  };

  // ------------------------------------------------------------ update
  const _wish = new THREE.Vector3();
  P.update = function (dt) {
    this.time += dt;
    const b = this.body, inp = CF.Input, st = CF.settings;
    const live = this.alive && !this.frozen && CF.Game.state === 'playing';
    const WPN = CF.Weapons;
    this.hurtSndT -= dt;
    if (!this.alive) { this.updateDeath(dt); return; }
    // look
    if (live) {
      const fov = this.camera.fov, baseFov = st.fov;
      const adsK = U.lerp(1, st.adsSens * (fov / baseFov), WPN.adsE);
      const sens = 0.0022 * st.sens * adsK;
      this.yaw -= inp.dx * sens;
      this.pitch -= inp.dy * sens * (st.invertY ? -1 : 1);
      this.pitch = U.clamp(this.pitch, -1.52, 1.52);
    }
    this.recoilP = U.damp(this.recoilP, 0, 8, dt);
    this.recoilY = U.damp(this.recoilY, 0, 8, dt);
    // mantle in progress
    if (this.mantling) {
      this.mantleT += dt / 0.4;
      const k = Math.min(1, this.mantleT);
      const up = U.easeOutCubic(Math.min(1, k / 0.6)), fwd = U.easeInOut(U.clamp((k - 0.35) / 0.65, 0, 1));
      b.pos.x = U.lerp(this.mantleFrom.x, this.mantleTo.x, fwd);
      b.pos.z = U.lerp(this.mantleFrom.z, this.mantleTo.z, fwd);
      b.pos.y = U.lerp(this.mantleFrom.y, this.mantleTo.y + 0.02, up);
      if (k >= 1) {
        this.mantling = false; b.grounded = true; b.vel.set(0, 0, 0);
        if (!this.mantleStand) { this.crouching = true; b.height = CROUCH; }
        WPN.onLand(3);
      }
      this.updateCamera(dt); return;
    }
    // input
    let fwd = 0, side = 0;
    if (live) {
      fwd = (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0) - (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0);
      side = (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0) - (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0);
    }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    _wish.set(-sy * fwd + cy * side, 0, -cy * fwd - sy * side);
    const wl = _wish.length(); if (wl > 0) _wish.divideScalar(wl);
    // crouch / slide
    const hspeed = Math.hypot(b.vel.x, b.vel.z);
    const slideGo = live && inp.hit('KeyC') && b.grounded && (this.sprinting || hspeed > 6.2) && !this.sliding;
    if (st.toggleCrouch) { if (live && inp.hit('KeyC') && !slideGo) this.crouchLatch = !this.crouchLatch; if (slideGo || !live) this.crouchLatch = false; }
    const crouchHeld = live && (st.toggleCrouch ? !!this.crouchLatch : inp.down('KeyC'));
    if (slideGo) {
      this.sliding = true; this.slideTime = 0.85; this.sprinting = false; this.crouching = true; b.height = CROUCH;
      const dx = hspeed > 0.1 ? b.vel.x / hspeed : _wish.x, dz = hspeed > 0.1 ? b.vel.z / hspeed : _wish.z;
      const sp = Math.max(hspeed, 10.8); b.vel.x = dx * sp; b.vel.z = dz * sp;
      A.play('slide'); this.shake(0.08);
    }
    if (!this.sliding) {
      if (crouchHeld) { if (!this.crouching) { this.crouching = true; b.height = CROUCH; } }
      else if (this.crouching && W.headroom(b.pos.x, b.pos.z, b.radius * 0.9, b.pos.y, STAND)) { this.crouching = false; b.height = STAND; }
    }
    // sprint
    if (st.toggleSprint) { if (live && inp.hit('ShiftLeft')) this.sprintLatch = !this.sprintLatch; if (fwd <= 0 || !live || WPN.adsT > 0.3) this.sprintLatch = false; }
    const wantSprint = live && (st.toggleSprint ? !!this.sprintLatch : inp.down('ShiftLeft')) && fwd > 0 && WPN.adsT < 0.3 && !this.sliding && !(WPN.cur && WPN.cur.def.scope && WPN.adsT > 0);
    if (wantSprint && !this.crouching && b.grounded && (WPN.state === 'idle' || WPN.state === 'reload' || WPN.state === 'raise')) this.sprinting = true;
    if (!wantSprint || this.crouching) { if (this.sprinting) this.sprintOut = 0.14; this.sprinting = false; }
    if (inp.mdown[0] && this.sprinting && live) this.stopSprint();
    this.sprintOut = Math.max(0, this.sprintOut - dt);
    // speeds
    this.chillT = Math.max(0, (this.chillT || 0) - dt);
    const wmul = (WPN.cur ? WPN.cur.def.moveMul : 1) * (this.speedMul || 1) * (this.chillT > 0 ? 0.6 : 1);
    let speed = this.sprinting ? 7.9 : this.crouching ? 2.5 : 5.1;
    speed *= U.lerp(1, 0.58, WPN.adsE) * wmul;
    // horizontal velocity
    if (this.sliding) {
      this.slideTime -= dt;
      const f = b.grounded ? 1.5 : 0.3;
      b.vel.x *= 1 - f * dt; b.vel.z *= 1 - f * dt;
      b.vel.x += _wish.x * 3 * dt; b.vel.z += _wish.z * 3 * dt;
      if (this.slideTime <= 0 || Math.hypot(b.vel.x, b.vel.z) < 3.4) { this.sliding = false; }
    } else if (b.grounded) {
      const k = wl > 0 ? 13 : 10;
      b.vel.x = U.damp(b.vel.x, _wish.x * speed, k, dt);
      b.vel.z = U.damp(b.vel.z, _wish.z * speed, k, dt);
    } else if (wl > 0) {
      const tx = _wish.x * Math.max(speed, hspeed), tz = _wish.z * Math.max(speed, hspeed);
      b.vel.x = U.damp(b.vel.x, tx, 2.4, dt); b.vel.z = U.damp(b.vel.z, tz, 2.4, dt);
    }
    // jump / coyote / buffer
    if (b.grounded) this.coyote = 0.11; else this.coyote -= dt;
    if (live && inp.hit('Space')) this.jumpBuf = 0.13; else this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && live) {
      if (fwd > 0 && (b.grounded || this.coyote > 0) && this.tryMantle()) { this.jumpBuf = 0; this.updateCamera(dt); return; }
      if (b.grounded || this.coyote > 0) {
        const canStand = !this.crouching || W.headroom(b.pos.x, b.pos.z, b.radius * 0.9, b.pos.y, STAND);
        if (canStand) {
          if (this.crouching) { this.crouching = false; b.height = STAND; }
          this.crouchLatch = false;
          b.vel.y = 6.3; b.grounded = false; this.coyote = 0; this.jumpBuf = 0;
          if (this.sliding) { this.sliding = false; b.vel.x *= 1.05; b.vel.z *= 1.05; }
          A.play('jump');
        }
      }
    }
    if (!b.grounded && live && inp.down('Space') && b.vel.y < 2.5 && fwd > 0 && this.tryMantle()) { this.updateCamera(dt); return; }
    // gravity + move
    b.vel.y -= 19.5 * dt;
    if (b.vel.y < -40) b.vel.y = -40;
    const wasGrounded = b.grounded, vyBefore = b.vel.y;
    if (!b.grounded) this.airPeak = Math.max(this.airPeak, b.pos.y); else this.airPeak = b.pos.y;
    W.moveBody(b, dt);
    this.eyeOff -= b.stepped;
    if (!wasGrounded && b.grounded) {
      const impact = -vyBefore;
      if (impact > 3) { WPN.onLand(impact); A.play('land', null, { vol: U.clamp(impact / 10, 0.3, 1.2) }); this.shake(Math.min(0.3, impact / 50)); }
      if (impact > 13.5) this.damage((impact - 13.5) * 7, null, 'Fall damage');
    }
    if (b.bonk) b.vel.y = Math.min(b.vel.y, 0);
    if (b.pos.y < (CF.Level.killY != null ? CF.Level.killY : -8)) { this.damage(999, null, 'The fall'); }
    // hazards
    this.hazardT -= dt;
    for (const h of CF.Level.hazards) {
      if (b.pos.x > h.minX && b.pos.x < h.maxX && b.pos.z > h.minZ && b.pos.z < h.maxZ && b.pos.y < h.maxY) {
        this.damage(h.dps * dt / CF.diff().dmg, null, h.name || 'Molten metal');
        if (this.hazardT <= 0) { this.hazardT = 0.5; CF.HUD.hint(h.hint || 'Molten metal · climb out', true); CF.FX.sparks(b.pos.x, b.pos.y + 0.2, b.pos.z, 0, 1, 0, 6, 3); }
      }
    }
    // derived motion state
    const hs = Math.hypot(b.vel.x, b.vel.z);
    this.moveFrac = U.clamp(hs / 5.1, 0, 1.6);
    this.sprintT = U.damp(this.sprintT, this.sprinting ? 1 : 0, 10, dt);
    this.crouchT = U.damp(this.crouchT, this.crouching && !this.sliding ? 1 : 0, 12, dt);
    this.slideT = U.damp(this.slideT, this.sliding ? 1 : 0, 10, dt);
    // footsteps + bob
    if (b.grounded && !this.sliding) {
      const interval = this.sprinting ? 2.5 : this.crouching ? 1.5 : 2.05;
      this.stepDist += hs * dt;
      this.bobPhase += (hs / interval) * Math.PI * dt;
      if (this.stepDist > interval) {
        this.stepDist = 0;
        const surf = b.groundBox && b.groundBox.surf;
        A.play('step', null, { vol: this.crouching ? 0.35 : this.sprinting ? 1.0 : 0.7, metal: surf === 'metal', snow: surf === 'snow', ice: surf === 'ice', send: 0.1 });
        if (this.sprinting) CF.Enemies.noise(b.pos, 9);
      }
    }
    this.bobAmp = U.damp(this.bobAmp, b.grounded && !this.sliding ? U.clamp(hs / 5.1, 0, 1.5) : 0, 8, dt);
    // regen
    const diff = CF.Game.mode === 'mp' ? { regenDelay: 5, regenRate: 25 } : CF.diff();
    if (this.time - this.lastHurt > diff.regenDelay && this.health < this.maxHealth) { this.health = Math.min(this.maxHealth, this.health + diff.regenRate * dt); CF.HUD.setVitals(this.health, this.armor); }
    // low health heartbeat
    if (this.health < 30 * this.maxHealth / 100) { this.heartT -= dt; if (this.heartT <= 0) { this.heartT = 0.85; A.play('heartbeat', null, { ui: true, vol: 0.9 }); } }
    this.updateCamera(dt);
  };

  P.updateDeath = function (dt) {
    this.deathT += dt;
    const b = this.body;
    b.vel.y -= 19.5 * dt; b.vel.x *= 0.9; b.vel.z *= 0.9;
    W.moveBody(b, dt);
    const k = U.easeOutCubic(Math.min(1, this.deathT / 1.1));
    this.eye = U.lerp(this.eye, 0.35, k * 0.2);
    this.tilt = U.lerp(this.tilt, 1.1, k * 0.08);
    this.pitch = U.lerp(this.pitch, 0.25, k * 0.05);
    this.updateCamera(dt, true);
  };

  const _e = new THREE.Euler(0, 0, 0, 'YXZ');
  P.updateCamera = function (dt, dead) {
    const cam = this.camera, b = this.body, st = CF.settings, WPN = CF.Weapons;
    if (!dead) {
      const target = this.sliding ? EYE_SLIDE : this.crouching ? EYE_CROUCH : EYE_STAND;
      this.eye = U.damp(this.eye, target, 12, dt);
      this.eyeOff = U.damp(this.eyeOff, 0, 16, dt);
      // strafe roll + slide roll
      const right = Math.cos(this.yaw) * b.vel.x - Math.sin(this.yaw) * b.vel.z;
      this.tilt = U.damp(this.tilt, -right * 0.0045 + this.slideT * 0.06, 8, dt);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.flinch = Math.max(0, this.flinch - dt * 3);
    this.shakeT += dt;
    const sh = this.trauma * this.trauma, t = this.shakeT;
    const nx = (Math.sin(t * 37) + Math.sin(t * 59.3) * 0.5) * sh, ny = (Math.cos(t * 41) + Math.sin(t * 67.7) * 0.5) * sh, nr = Math.sin(t * 29.1) * sh;
    const bobK = st.viewBob != null ? st.viewBob : 1;
    const bobY = Math.abs(Math.cos(this.bobPhase)) * 0.028 * this.bobAmp * (1 - WPN.adsE * 0.8) * bobK;
    const bobX = Math.sin(this.bobPhase) * 0.018 * this.bobAmp * (1 - WPN.adsE * 0.8) * bobK;
    cam.position.set(b.pos.x, b.pos.y + this.eye + this.eyeOff - bobY, b.pos.z);
    cam.position.x += Math.cos(this.yaw) * bobX; cam.position.z -= Math.sin(this.yaw) * bobX;
    if (this.mantling) { cam.position.y -= Math.sin(Math.min(1, this.mantleT) * Math.PI) * 0.12; }
    _e.set(this.pitch + this.recoilP + ny * 0.035 + this.flinch * 0.02, this.yaw + this.recoilY + nx * 0.035, this.tilt + nr * 0.04 + (this.mantling ? Math.sin(Math.min(1, this.mantleT) * Math.PI) * 0.06 : 0));
    cam.quaternion.setFromEuler(_e);
    const base = st.fov + this.sprintT * 6 + this.slideT * 8;
    const adsMul = WPN.cur ? U.lerp(1, WPN.cur.def.adsFov, WPN.adsE) : 1;
    const fov = base * adsMul;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  };
})(window.CF);
