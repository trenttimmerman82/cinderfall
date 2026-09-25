'use strict';
/* Cinderfall — Nuketown's RC-XD: a supply chest in the middle of the cul-de-sac holds a remote-control car with a bomb
   strapped to it. Take it (hold interact), deploy it (gadget key), drive it on a chase camera while your body stands
   shielded where you left it, and detonate it (click or the gadget key). It also blows when its fuse runs out, when a
   hard crash snaps it, or when enemies shoot it apart. The host owns the chest (one car at a time, 75 s restock);
   the driver owns the car and sends its position; everyone sees it, can shoot it, and sees the blast. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const FUSE = 20, HP = 45, RADIUS = 7, DAMAGE = 260, RESTOCK = 75, TAKE_HOLD = 0.7;
  const MAXF = 13, MAXR = 5, ACCEL = 16, BRAKE = 26, CRASH = 8.5;
  const $ = (id) => document.getElementById(id);
  const RC = CF.RC = { chest: null, have: false, driving: null, remotes: {}, sendT: 0, holdT: 0 };
  const MP = () => CF.MP;
  const _v = new THREE.Vector3(), _c = new THREE.Vector3();

  // ------------------------------------------------------------ models
  let MAT = null;
  function mats() {
    if (MAT) return MAT;
    const std = (c, m, r, e) => { const x = new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r }); if (e) x.emissive = new THREE.Color(...e); return x; };
    MAT = {
      olive: std(0x3f4a2c, 0.3, 0.7), steel: std(0x9aa1aa, 0.9, 0.3), dark: std(0x1b1d20, 0.4, 0.6), rubber: std(0x151515, 0, 0.95),
      paint: std(0xf2b21a, 0.35, 0.35), stripe: std(0x111111, 0.3, 0.5), bomb: std(0xa3261c, 0.2, 0.55), tape: std(0x2b2b2b, 0.1, 0.8),
      glass: std(0x1a2a36, 0.9, 0.1), led: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.5, 0.3) }),
      glowY: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 0.6) }),
      beam: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.9, 0.2), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      holo: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.2, 3), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
      shield: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 3), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    };
    return MAT;
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 18), SPH = new THREE.SphereGeometry(1, 16, 12);
  const add = (p, g, m, x, y, z, sx, sy, sz, rx, ry, rz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; p.add(o); return o; };
  /** The car: low chassis in hazard yellow, fat tyres, antenna with a blinking tip, a taped bundle of charges on the deck. Faces -Z. */
  RC.carModel = function (accent) {
    const M = mats(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    add(body, BOX, M.dark, 0, 0.16, 0, 0.42, 0.08, 0.72);
    add(body, BOX, M.paint, 0, 0.23, -0.02, 0.38, 0.1, 0.62);
    for (let i = -2; i <= 2; i++) add(body, BOX, M.stripe, i * 0.075, 0.281, -0.3, 0.035, 0.005, 0.08);
    add(body, BOX, M.steel, 0, 0.17, -0.38, 0.44, 0.05, 0.05);
    add(body, BOX, M.glass, 0, 0.29, -0.2, 0.2, 0.06, 0.12, -0.3);
    const bomb = new THREE.Group(); bomb.position.set(0, 0.3, 0.1); body.add(bomb);
    for (let i = 0; i < 3; i++) add(bomb, CYL, M.bomb, (i - 1) * 0.085, 0.05, 0, 0.042, 0.26, 0.042, Math.PI / 2);
    for (const z of [-0.08, 0.08]) add(bomb, BOX, M.tape, 0, 0.05, z, 0.28, 0.095, 0.025);
    add(bomb, BOX, M.dark, 0, 0.12, 0, 0.12, 0.05, 0.08);
    const timer = add(bomb, BOX, M.led, 0, 0.146, -0.02, 0.07, 0.004, 0.03);
    add(body, CYL, M.steel, 0.14, 0.45, 0.25, 0.006, 0.36, 0.006);
    const tip = add(body, SPH, M.led, 0.14, 0.63, 0.25, 0.018, 0.018, 0.018);
    if (accent) add(body, BOX, new THREE.MeshBasicMaterial({ color: new THREE.Color(...accent) }), 0, 0.2, 0.34, 0.36, 0.025, 0.01);
    const wheels = [];
    for (const x of [-0.24, 0.24]) for (const z of [-0.24, 0.24]) {
      const w = new THREE.Group(); w.position.set(x, 0.1, z); g.add(w);
      add(w, CYL, M.rubber, 0, 0, 0, 0.1, 0.09, 0.1, 0, 0, Math.PI / 2); add(w, CYL, M.steel, x > 0 ? 0.047 : -0.047, 0, 0, 0.05, 0.005, 0.05, 0, 0, Math.PI / 2);
      wheels.push(w);
    }
    g.userData = { body, wheels, tip, timer };
    return g;
  };
  /** The chest: a steel-banded footlocker with a stencilled RC-XD lid, a pulsing lamp, a light beam and a spinning hologram of the prize. */
  function chestModel() {
    const M = mats(), g = new THREE.Group();
    add(g, BOX, M.olive, 0, 0.26, 0, 1.1, 0.5, 0.62);
    for (const x of [-0.42, 0.42]) add(g, BOX, M.steel, x, 0.26, 0, 0.06, 0.52, 0.64);
    for (const x of [-0.58, 0.58]) add(g, BOX, M.dark, x, 0.3, 0, 0.06, 0.08, 0.26);
    const lid = new THREE.Group(); lid.position.set(0, 0.51, 0.31); g.add(lid);
    add(lid, BOX, M.olive, 0, 0.06, -0.31, 1.12, 0.12, 0.64);
    for (const x of [-0.42, 0.42]) add(lid, BOX, M.steel, x, 0.06, -0.31, 0.065, 0.13, 0.66);
    const plate = add(lid, BOX, M.glowY, 0, 0.125, -0.31, 0.5, 0.005, 0.2);
    add(g, BOX, M.steel, 0, 0.44, -0.315, 0.12, 0.1, 0.02);
    const beam = add(g, CYL, M.beam, 0, 3.5, 0, 0.35, 6, 0.35); beam.castShadow = false;
    const holo = RC.carModel(null); holo.scale.setScalar(1.3); holo.position.y = 1.15;
    holo.traverse((o) => { if (o.isMesh) { o.material = M.holo; o.castShadow = false; } });
    g.add(holo);
    g.userData = { lid, holo, beam, plate };
    return g;
  }
  function shieldModel() { const m = new THREE.Mesh(SPH, mats().shield); m.scale.set(0.75, 1.1, 0.75); m.position.y = 1.0; m.renderOrder = 6; return m; }
  RC.shieldModel = shieldModel;

  // ------------------------------------------------------------ lifecycle
  /** Called when a multiplayer map is ready. Only Nuketown has the chest, and not in Revolver One-Shot. */
  RC.setup = function () {
    RC.clear();
    const L = CF.Level, p = L.points.rcChest;
    if (!p || MP().mode === 'revolver') return;
    const mesh = chestModel(); mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = p.yaw || 0; CF.Game.scene.add(mesh);
    const col = W.add(p.x - 0.62, p.y, p.z - 0.62, p.x + 0.62, p.y + 0.62, p.z + 0.62, { surf: 'metal' });
    const lamp = L.lamp(p.x, p.y + 1.4, p.z, { color: 0xffc040, intensity: 2, distance: 9, pool: false, pulse: 3, prio: 2 });
    RC.chest = { pos: new THREE.Vector3(p.x, p.y, p.z), mesh, col, lamp, state: 'ready', by: null, respawn: 0, open: 0 };
  };
  RC.clear = function () {
    if (RC.driving) RC.end(false, true);
    for (const id in RC.remotes) RC.dropRemote(id);
    if (RC.chest) { CF.Game.scene.remove(RC.chest.mesh); RC.chest.col.enabled = false; RC.chest.lamp.on = false; }
    RC.chest = null; RC.have = false; RC.holdT = 0;
    RC.hud(null);
  };
  /** Chest state from the host: 'ready' | 'taken' | 'cooldown'. */
  RC.setChest = function (s, by, respawn) {
    const c = RC.chest; if (!c) return;
    const was = c.state;
    c.state = s; c.by = by || null; c.respawn = respawn || 0;
    c.mesh.userData.holo.visible = s === 'ready'; c.mesh.userData.beam.visible = s === 'ready'; c.lamp.on = s === 'ready';
    if (s === 'taken' && was === 'ready') { A.play('chest', c.pos, { ref: 6 }); CF.FX.glow(c.pos.x, c.pos.y + 0.8, c.pos.z, 1.6, 4, 3, 0.6, 0.3); }
    if (s === 'ready' && was !== 'ready') { CF.FX.ring(new THREE.Vector3(c.pos.x, c.pos.y + 0.05, c.pos.z), 2.4, 0.5, [1, 0.8, 0.2]); CF.HUD.killfeed('RC-XD chest restocked', 'Cul-de-sac'); }
    if (s === 'taken' && by === MP().myId) {
      RC.have = true;
      CF.HUD.popup('RC-XD acquired · press ' + CF.Keys.label('gadget'), 0, 'obj');
      A.play('weaponGet', null, { ui: true });
    } else if (s === 'taken' && by && MP().players[by]) CF.HUD.killfeed(MP().players[by].name + ' took the RC-XD', '');
  };

  // ------------------------------------------------------------ host: the chest
  RC.hostTake = function (from) {
    const c = RC.chest; if (!c || c.state !== 'ready') return;
    RC.broadcastChest('taken', from, 0);
  };
  RC.hostEnded = function (from) {
    const c = RC.chest; if (!c || c.state !== 'taken' || c.by !== from) return;
    RC.broadcastChest('cooldown', null, RESTOCK);
  };
  RC.broadcastChest = function (s, by, respawn) {
    const msg = { t: 'chest', s, by, r: respawn };
    CF.Net.broadcast(msg); RC.setChest(s, by, respawn);
  };
  RC.chestInfo = () => (RC.chest ? { s: RC.chest.state, by: RC.chest.by, r: Math.ceil(RC.chest.respawn) } : null);

  // ------------------------------------------------------------ the local player
  RC.update = function (dt, raw) {
    const c = RC.chest, M = MP(), P = CF.Player, G = CF.Game;
    if (c) {
      const u = c.mesh.userData;
      u.holo.rotation.y += dt * 1.4; u.holo.position.y = 1.15 + Math.sin(CF.time * 2) * 0.06;
      c.open = U.damp(c.open, c.state === 'ready' ? 0 : 1, 6, dt); u.lid.rotation.x = -c.open * 1.9;
      u.plate.material.color.setRGB(4 * (0.6 + 0.4 * Math.sin(CF.time * 4)), 3 * (0.6 + 0.4 * Math.sin(CF.time * 4)), 0.6);
      if (c.state === 'cooldown') { c.respawn -= dt; if (M.isHost() && c.respawn <= 0) RC.broadcastChest('ready', null, 0); }
      // take it: hold interact next to the chest
      const near = G.state === 'playing' && P.alive && !RC.driving && c.state === 'ready' && !RC.have && Math.hypot(P.body.pos.x - c.pos.x, P.body.pos.z - c.pos.z) < 1.9 && Math.abs(P.body.pos.y - c.pos.y) < 1.5;
      if (near) {
        if (CF.Input.down('KeyE')) RC.holdT += dt; else RC.holdT = Math.max(0, RC.holdT - dt * 2);
        CF.HUD.interact('Hold to take the RC-XD', RC.holdT / TAKE_HOLD);
        if (RC.holdT >= TAKE_HOLD) { RC.holdT = 0; if (M.isHost()) RC.hostTake(M.myId); else CF.Net.send({ t: 'chest', op: 'take' }); }
        RC.prompted = true;
      } else if (RC.prompted) { RC.prompted = false; RC.holdT = 0; CF.HUD.interact(null); }
    }
    for (const id in RC.remotes) RC.updateRemote(RC.remotes[id], dt);
    if (RC.have && !RC.driving && G.state === 'playing' && P.alive) {
      CF.HUD.hint('RC-XD ready · press ' + CF.Keys.label('gadget') + ' to drive it');
      if (CF.Input.hit('KeyT')) RC.deploy();
    }
    if (RC.driving) RC.drive(dt, raw);
  };

  RC.deploy = function () {
    const P = CF.Player, f = P.forward(_v);
    // put it down a step in front of you, on whatever is there
    let x = P.body.pos.x + f.x * 1.1, z = P.body.pos.z + f.z * 1.1;
    if (!W.segmentClear(P.body.pos.x, P.body.pos.y + 0.4, P.body.pos.z, x, P.body.pos.y + 0.4, z)) { x = P.body.pos.x; z = P.body.pos.z; }
    const gy = W.groundBelow(x, z, 0.2, P.body.pos.y + 0.6, 3);
    const body = { pos: new THREE.Vector3(x, gy === null ? P.body.pos.y : gy, z), vel: new THREE.Vector3(), radius: 0.3, height: 0.42, stepHeight: 0.22, grounded: true, stepped: 0 };
    const mesh = RC.carModel(MP().mode === 'tdm' ? MP().TEAM[MP().team].c : null); mesh.position.copy(body.pos); CF.Game.scene.add(mesh);
    RC.have = false;
    RC.driving = { body, mesh, yaw: P.yaw, speed: 0, hp: HP, fuse: FUSE, orbit: 0, camPos: new THREE.Vector3().copy(CF.Game.camera.position), beep: 0, engine: A.ready ? A.loop('rc') : null, t: 0 };
    if (RC.driving.engine) RC.driving.engine.set(0.12);
    P.frozen = true; P.stopSprint(); P.crouching = false;
    CF.Weapons.adsToggle = false;
    CF.HUD.showScope(false);
    document.body.classList.add('rc-driving');
    A.play('rcBeep', null, { ui: true });
    MP().sendState();
  };

  RC.drive = function (dt) {
    const d = RC.driving, b = d.body, inp = CF.Input, cam = CF.Game.camera, P = CF.Player, G = CF.Game;
    d.t += dt; d.fuse -= dt;
    const live = G.state === 'playing' && P.alive;
    if (!P.alive) { RC.end(false); return; }
    // controls
    const thr = live ? (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0) : 0;
    const steer = live ? (inp.down('KeyA') ? 1 : 0) - (inp.down('KeyD') ? 1 : 0) : 0;
    if (thr > 0) d.speed += (d.speed < 0 ? BRAKE : ACCEL) * dt;
    else if (thr < 0) d.speed -= (d.speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
    else d.speed = U.damp(d.speed, 0, 1.6, dt);
    d.speed = U.clamp(d.speed, -MAXR, MAXF);
    const grip = b.grounded ? 1 : 0.2;
    d.yaw += steer * dt * 2.6 * U.clamp(Math.abs(d.speed) / 4, 0, 1) * Math.sign(d.speed || 1) * grip;
    d.orbit = U.damp(d.orbit - inp.dx * 0.003, 0, 2.5, dt); d.orbit = U.clamp(d.orbit, -1.2, 1.2);
    // move
    const before = Math.abs(d.speed);
    b.vel.x = -Math.sin(d.yaw) * d.speed; b.vel.z = -Math.cos(d.yaw) * d.speed;
    b.vel.y -= 19.5 * dt; if (b.vel.y < -30) b.vel.y = -30;
    W.moveBody(b, dt);
    if (b.hitWall) {
      if (before > CRASH) { A.play('rcCrash', b.pos, { ref: 5 }); CF.HUD.popup('Crashed', 0, ''); RC.end(true); return; }
      if (before > 2) { A.play('rcCrash', b.pos, { ref: 4, vol: 0.5 }); CF.Player.shake(0.12); }
      d.speed *= -0.25;
    }
    if (b.pos.y < (CF.Level.killY != null ? CF.Level.killY : -8)) { RC.end(false); return; }
    // detonate on demand, or when the fuse runs out, or when it's shot to pieces
    if (live && d.t > 0.25 && (inp.mpressed[0] || inp.hit('KeyT'))) { RC.end(true); return; }
    if (d.fuse <= 0 || d.hp <= 0) { if (d.hp <= 0) CF.HUD.popup('RC-XD destroyed', 0, ''); RC.end(true); return; }
    // model
    const m = d.mesh; m.position.copy(b.pos); m.rotation.set(0, d.yaw, 0);
    m.userData.body.rotation.x = U.damp(m.userData.body.rotation.x, thr * 0.05 * Math.sign(d.speed || 1), 8, dt);
    m.userData.body.rotation.z = U.damp(m.userData.body.rotation.z, -steer * Math.min(1, Math.abs(d.speed) / 6) * 0.08, 8, dt);
    for (const w of m.userData.wheels) w.rotation.x -= d.speed * dt / 0.1;
    m.userData.tip.visible = (d.t % 0.5) < 0.25; m.userData.timer.visible = (d.t % (d.fuse < 5 ? 0.25 : 1)) < (d.fuse < 5 ? 0.12 : 0.5);
    if (d.engine) { d.engine.pitch(160 + Math.abs(d.speed) * 38); d.engine.set(0.07 + Math.abs(d.speed) / MAXF * 0.12); }
    d.beep -= dt; if (d.fuse < 5 && d.beep <= 0) { d.beep = d.fuse < 2 ? 0.25 : 0.5; A.play('rcBeep', null, { ui: true, vol: 0.6 }); }
    // chase camera: low behind the car, never through a wall
    const ya = d.yaw + d.orbit, back = 2.4, up = 1.05;
    _c.set(b.pos.x + Math.sin(ya) * back, b.pos.y + up, b.pos.z + Math.cos(ya) * back);
    _v.set(b.pos.x, b.pos.y + 0.45, b.pos.z);
    const dir = _c.clone().sub(_v), len = dir.length(); dir.normalize();
    const hit = W.raycast(_v.x, _v.y, _v.z, dir.x, dir.y, dir.z, len, null, true);
    if (hit) _c.copy(_v).addScaledVector(dir, Math.max(0.25, hit.t - 0.2));
    d.camPos.lerp(_c, 1 - Math.exp(-14 * dt));
    cam.position.copy(d.camPos);
    cam.lookAt(b.pos.x - Math.sin(ya) * 2, b.pos.y + 0.35, b.pos.z - Math.cos(ya) * 2);
    const fov = CF.settings.fov + 8 + Math.abs(d.speed) * 0.8;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    RC.hud(d);
    // everyone else sees it
    RC.sendT -= dt;
    if (RC.sendT <= 0) { RC.sendT = 0.05; MP().post({ t: 'rc', p: [+b.pos.x.toFixed(2), +b.pos.y.toFixed(2), +b.pos.z.toFixed(2)], y: +d.yaw.toFixed(3), f: Math.ceil(d.fuse) }); }
  };

  /** The car is done. boom: it explodes (on demand, fuse, crash, shot to pieces); otherwise it just fizzles (fell, owner died). */
  RC.end = function (boom, silent) {
    const d = RC.driving; if (!d) return;
    RC.driving = null;
    const pos = d.body.pos.clone().add(new THREE.Vector3(0, 0.3, 0));
    CF.Game.scene.remove(d.mesh);
    if (d.engine) d.engine.stop();
    CF.Player.frozen = false;
    document.body.classList.remove('rc-driving');
    RC.hud(null);
    if (!silent) {
      if (boom) RC.blast(pos, true);
      else { CF.FX.sparks(pos.x, pos.y, pos.z, 0, 1, 0, 14, 4, true); A.play('rcCrash', pos, { ref: 5 }); }
      MP().post({ t: 'rcend', p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)], boom: boom ? 1 : 0 });
    }
    CF.Game.camera.fov = CF.settings.fov; CF.Game.camera.updateProjectionMatrix();
    CF.Player.updateCamera(0);
    MP().sendState();
  };
  /** Explosion: the owner applies damage (like every other weapon); everyone shows the effect. */
  RC.blast = function (pos, mine) {
    CF.FX.explosion(pos, 1.5); CF.FX.ring(new THREE.Vector3(pos.x, pos.y - 0.25, pos.z), RADIUS, 0.45, [1, 0.6, 0.2]);
    CF.FX.debris(pos.x, pos.y, pos.z, 0, 1, 0, 26, 9, 0.12, [0.2, 0.2, 0.2]);
    CF.FX.flashLight(pos, 0xffa040, 12, 22, 0.25);
    A.play('bigBoom', pos, { ref: 14 });
    const d = pos.distanceTo(CF.Player.body.pos);
    CF.Player.shake(U.clamp(1 - d / 35, 0, 1));
    if (mine) CF.Game.explode(pos, { radius: RADIUS, damage: DAMAGE, source: 'player', weapon: 'rc', noFx: true, noSelf: true, killer: 'an RC-XD' });
  };
  /** An enemy's bullets hit our car. */
  RC.hit = function (dmg) {
    const d = RC.driving; if (!d) return;
    d.hp -= dmg; CF.FX.sparks(d.body.pos.x, d.body.pos.y + 0.3, d.body.pos.z, 0, 1, 0, 5, 3); A.play('impactMetal', d.body.pos, { ref: 4 });
  };
  /** Lost without being used (you died holding it): the host restocks the chest. */
  RC.onDeath = function () {
    if (RC.driving) RC.end(false);
    else if (RC.have) { RC.have = false; MP().post({ t: 'rcend', p: null, boom: 0 }); }
  };

  // ------------------------------------------------------------ other players' cars
  class RemoteCar {
    constructor(owner) {
      this.id = owner; this.owner = owner; this.net = true; this.rc = true; this.alive = true; this.spawnT = 1;
      const M = MP(), pl = M.players[owner];
      this.name = (pl ? pl.name : 'Enemy') + '’s RC-XD';
      this.css = '#ffc040';
      this.mesh = RC.carModel(M.mode === 'tdm' && pl ? M.TEAM[pl.team].c : null); CF.Game.scene.add(this.mesh);
      this.T = { height: 0.5, radius: 0.45, name: 'RC-XD', score: 0 };
      this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3() }; this.tp = new THREE.Vector3(); this.yaw = 0; this.tyaw = 0; this.t = 0;
      this.m = { hit: [{ w: new THREE.Vector3(), r: 0.42, mult: 1, tag: 'body', off: null }] };
      this.engine = A.ready ? A.loop('rc', this.body.pos) : null; if (this.engine) this.engine.set(0.2);
      this.first = true;
    }
    center(out) { return out.set(this.body.pos.x, this.body.pos.y + 0.25, this.body.pos.z); }
    eyePos(out) { return this.center(out); }
    becomeAware() {}
    damage(amount, info) {
      if (!this.alive || !MP().enemyOf(this.owner)) return null;
      MP().post({ t: 'rchit', to: this.owner, dmg: Math.round(amount * 10) / 10 });
      if (info.point) CF.FX.sparks(info.point.x, info.point.y, info.point.z, 0, 1, 0, 5, 3);
      CF.HUD.hitmarker('hit'); A.play('hit', null, { ui: true });
      return { head: false, dealt: amount };
    }
    update(dt) {
      const b = this.body;
      if (this.first) { b.pos.copy(this.tp); this.yaw = this.tyaw; this.first = false; }
      b.pos.x = U.damp(b.pos.x, this.tp.x, 14, dt); b.pos.y = U.damp(b.pos.y, this.tp.y, 14, dt); b.pos.z = U.damp(b.pos.z, this.tp.z, 14, dt);
      const sp = Math.hypot(this.tp.x - b.pos.x, this.tp.z - b.pos.z) / Math.max(dt, 1e-3);
      this.yaw += U.wrapAngle(this.tyaw - this.yaw) * Math.min(1, dt * 14);
      this.t += dt;
      this.mesh.position.copy(b.pos); this.mesh.rotation.y = this.yaw;
      for (const w of this.mesh.userData.wheels) w.rotation.x -= sp * dt * 3;
      this.mesh.userData.tip.visible = (this.t % 0.5) < 0.25; this.mesh.userData.timer.visible = (this.t % 1) < 0.5;
      this.center(this.m.hit[0].w);
      if (this.engine && this.engine.panner && this.engine.panner.positionX) { const p = this.engine.panner; p.positionX.value = b.pos.x; p.positionY.value = b.pos.y; p.positionZ.value = b.pos.z; }
      if (this.engine) this.engine.pitch(160 + Math.min(MAXF, sp) * 38);
    }
    remove() { this.alive = false; CF.Game.scene.remove(this.mesh); if (this.engine) this.engine.stop(); const i = CF.Enemies.list.indexOf(this); if (i >= 0) CF.Enemies.list.splice(i, 1); }
  }
  RC.onRemoteState = function (id, msg) {
    let r = RC.remotes[id];
    if (!r) { r = RC.remotes[id] = new RemoteCar(id); CF.Enemies.list.push(r); }
    r.tp.set(msg.p[0], msg.p[1], msg.p[2]); r.tyaw = msg.y;
  };
  RC.onRemoteEnd = function (id, msg) {
    RC.dropRemote(id);
    if (msg.p) {
      const p = new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]);
      if (msg.boom) RC.blast(p, false); else CF.FX.sparks(p.x, p.y, p.z, 0, 1, 0, 14, 4, true);
    }
  };
  RC.dropRemote = function (id) { const r = RC.remotes[id]; if (r) { r.remove(); delete RC.remotes[id]; } };
  RC.updateRemote = function () { /* remote cars update through CF.Enemies.update */ };

  // ------------------------------------------------------------ HUD
  RC.hud = function (d) {
    const el = $('rcHud'); if (!el) return;
    if (!d) { if (!el.hidden) el.hidden = true; return; }
    if (el.hidden) { el.hidden = false; $('rcKeys').textContent = RC.keysText(); }
    const t = Math.max(0, d.fuse).toFixed(1);
    if (RC.lastT !== t) { $('rcFuse').textContent = t + 's'; RC.lastT = t; }
    $('rcFuseFill').style.width = (Math.max(0, d.fuse) / FUSE * 100).toFixed(1) + '%';
    $('rcHpFill').style.width = (Math.max(0, d.hp) / HP * 100).toFixed(1) + '%';
    $('rcSpeed').textContent = Math.round(Math.abs(d.speed) * 3.6) + ' km/h';
    el.classList.toggle('warn', d.fuse < 5);
  };
  RC.keysText = () => CF.Keys.label('forward') + ' / ' + CF.Keys.label('back') + ' drive · ' + CF.Keys.label('left') + ' / ' + CF.Keys.label('right') + ' steer · Click or ' + CF.Keys.label('gadget') + ' detonate';
})(window.CF);
