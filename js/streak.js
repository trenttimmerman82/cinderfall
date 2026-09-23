'use strict';
/* Cinderfall — kill streak reward: five kills in a row earn a friendly attack drone that hunts nearby enemies. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const NEED = 5, LIFE = 35, RANGE = 42, DMG = 14, RATE = 0.13;
  const _c = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();

  const S = CF.Streak = { kills: 0, ready: false, drones: [], droneKill: false };

  S.reset = function () { this.kills = 0; this.ready = false; this.clear(); };
  S.clear = function () { for (const d of this.drones) if (d.root.parent) d.root.parent.remove(d.root); this.drones.length = 0; };

  /** A kill the player earned; drone kills do not feed the streak. */
  S.onKill = function () {
    if (this.droneKill) return;
    this.kills++;
    CF.HUD.setStreak(this.kills, NEED, this.ready);
    if (this.kills >= NEED && !this.ready) {
      this.ready = true; this.kills = 0;
      CF.HUD.setStreak(0, NEED, true);
      CF.HUD.popup('Attack drone ready · press ' + CF.Keys.label('streak'), 0, 'head');
      A.play('spawn', null, { ui: true, vol: 0.5 });
    }
  };
  S.onDeath = function () { this.kills = 0; this.clear(); CF.HUD.setStreak(0, NEED, this.ready); };

  S.deploy = function () {
    if (!this.ready) return;
    this.ready = false;
    CF.HUD.setStreak(this.kills, NEED, false);
    const m = CF.EnemyModels.hornet();
    // friendly colours: swap the red eye glow for cyan without touching the shared enemy materials
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.6, 3.6) });
    m.root.traverse((o) => { if (o.isMesh && o.material === m.eyeMat) o.material = eye; });
    const P = CF.Player.body.pos;
    m.root.position.set(P.x, P.y + 2, P.z);
    CF.Game.scene.add(m.root);
    this.drones.push({ root: m.root, m, pos: m.root.position.clone(), life: LIFE, fireCd: 0.6, target: null, seekT: 0, ang: Math.random() * 6.28, yaw: 0 });
    CF.HUD.popup('Attack drone deployed', 0, '');
    A.play('droneShot', m.root.position, { ref: 6, vol: 0.5 });
  };

  function hostile(e) {
    if (!e.alive || e.spawnT < 1) return false;
    if (e.net) return CF.MP.enemyOf(e.id);
    return true;
  }
  function pickTarget(d) {
    let best = null, bd = RANGE;
    for (const e of CF.Enemies.list) {
      if (!hostile(e)) continue;
      e.center(_c);
      const dist = _c.distanceTo(d.pos);
      if (dist >= bd) continue;
      if (!W.segmentClear(d.pos.x, d.pos.y, d.pos.z, _c.x, _c.y, _c.z)) continue;
      best = e; bd = dist;
    }
    return best;
  }

  S.update = function (dt, playing) {
    if (playing && this.ready && CF.Input.hit('KeyB')) this.deploy();
    if (playing && this.ready) CF.HUD.hint('Kill streak! Press ' + CF.Keys.label('streak') + ' to deploy your attack drone');
    const P = CF.Player;
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      d.life -= dt;
      if (d.life <= 0 || !P.alive) {
        CF.FX.sparks(d.pos.x, d.pos.y, d.pos.z, 0, 1, 0, 12, 4, true);
        if (d.root.parent) d.root.parent.remove(d.root);
        this.drones.splice(i, 1);
        continue;
      }
      // circle above the player
      d.ang += dt * 0.8;
      _t.set(P.body.pos.x + Math.cos(d.ang) * 3.5, P.body.pos.y + 3.4, P.body.pos.z + Math.sin(d.ang) * 3.5);
      if (!W.segmentClear(P.body.pos.x, P.body.pos.y + 1.6, P.body.pos.z, _t.x, _t.y, _t.z)) _t.set(P.body.pos.x, P.body.pos.y + 2.4, P.body.pos.z);
      d.pos.x = U.damp(d.pos.x, _t.x, 3, dt); d.pos.y = U.damp(d.pos.y, _t.y + Math.sin(d.life * 2) * 0.2, 3, dt); d.pos.z = U.damp(d.pos.z, _t.z, 3, dt);
      d.seekT -= dt;
      if (d.seekT <= 0 || (d.target && !hostile(d.target))) { d.seekT = 0.3; d.target = pickTarget(d); }
      let yawTo = P.yaw;
      if (d.target) {
        d.target.center(_c);
        yawTo = Math.atan2(-(_c.x - d.pos.x), -(_c.z - d.pos.z));
        d.fireCd -= dt;
        if (d.fireCd <= 0) { d.fireCd = RATE; this.shoot(d); }
      }
      d.yaw += U.wrapAngle(yawTo - d.yaw) * Math.min(1, dt * 8);
      d.root.position.copy(d.pos);
      d.root.rotation.set(0, d.yaw, 0);
      for (const r of d.m.p.rotors) r.rotation.y += dt * 40;
    }
  };

  S.shoot = function (d) {
    const e = d.target; e.center(_c);
    _d.subVectors(_c, d.pos).normalize();
    _d.x += U.gauss() * 0.02; _d.y += U.gauss() * 0.02; _d.z += U.gauss() * 0.02; _d.normalize();
    const wh = W.raycast(d.pos.x, d.pos.y, d.pos.z, _d.x, _d.y, _d.z, RANGE + 5);
    const h = CF.Enemies.raycast(d.pos, _d, wh ? wh.t : RANGE + 5);
    const end = h ? h.point.clone() : d.pos.clone().addScaledVector(_d, wh ? wh.t : RANGE);
    const muzzle = d.pos.clone(); muzzle.y -= 0.2;
    CF.FX.tracer(muzzle, end, { speed: 380, len: 4, w: 0.03, r: 0.6, g: 3, b: 4 });
    A.play('droneShot', muzzle, { ref: 6, vol: 0.6 });
    if (h && hostile(h.enemy)) {
      this.droneKill = true;
      h.enemy.damage(DMG * (CF.Game.mode === 'mp' ? 0.7 : 1), { dir: _d.clone(), point: h.point, normal: h.normal, part: h.part, weapon: null, wid: 'drone', source: 'player', knock: 1 });
      this.droneKill = false;
    } else if (wh) CF.FX.impact({ x: wh.x, y: wh.y, z: wh.z, nx: wh.nx, ny: wh.ny, nz: wh.nz, box: wh.box }, _d, wh.box ? wh.box.surf : null);
    if (CF.MP && CF.MP.active) CF.MP.onShot('smg', muzzle, [end]);
  };
})(window.CF);
