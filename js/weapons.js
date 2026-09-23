'use strict';
/* Cinderfall — weapons: definitions, firing, recoil, ADS, reload/equip/melee/throw animation, grenades. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio, D2R = Math.PI / 180;

  const DEFS = {
    carbine: { id: 'carbine', name: 'M7 Vanguard', short: 'M7', auto: true, rpm: 720, dmg: 24, head: 2.0, pellets: 1,
      spreadHip: 1.5, spreadAds: 0.15, spreadMove: 1.6, spreadAir: 3.5, bloom: 0.32, bloomMax: 2.4, mag: 30, reserve: 150, maxReserve: 270,
      reload: 1.8, reloadEmpty: 2.3, magInAt: 0.62, falloff: [30, 70, 0.65], recoil: [0.72, 0.24, 0.032, 0.045], adsFov: 0.72, adsTime: 0.18,
      hip: [0.13, -0.135, -0.3], adsZ: -0.24, equip: 0.42, sound: 'carbine', tracerEvery: 2, shell: 1, moveMul: 0.96, noise: 42 },
    shotgun: { id: 'shotgun', name: 'KS-12 Breacher', short: 'KS-12', auto: false, rpm: 70, dmg: 13, head: 1.5, pellets: 10,
      spreadHip: 5.0, spreadAds: 3.4, spreadMove: 0.8, spreadAir: 2.0, bloom: 0, bloomMax: 0, mag: 7, reserve: 28, maxReserve: 49,
      shellReload: true, reloadStart: 0.32, reloadShell: 0.46, reloadEnd: 0.38, falloff: [8, 26, 0.22], recoil: [4.0, 1.0, 0.085, 0.2],
      adsFov: 0.86, adsTime: 0.2, hip: [0.13, -0.13, -0.27], adsZ: -0.34, equip: 0.5, sound: 'shotgun', tracerEvery: 1, shell: 1.9, pump: true, moveMul: 0.95, noise: 50, knock: 5 },
    rail: { id: 'rail', name: 'VX-3 Lance', short: 'VX-3', auto: false, rpm: 48, dmg: 160, head: 2.5, pellets: 1, pierce: 4,
      spreadHip: 2.4, spreadAds: 0, spreadMove: 2.0, spreadAir: 5, bloom: 0, bloomMax: 0, mag: 4, reserve: 12, maxReserve: 24,
      reload: 2.5, reloadEmpty: 2.5, magInAt: 0.6, falloff: [400, 500, 1], recoil: [4.5, 0.6, 0.11, 0.24], adsFov: 0.28, adsTime: 0.26, scope: true,
      hip: [0.13, -0.14, -0.27], adsZ: -0.3, equip: 0.55, sound: 'rail', tracerEvery: 1, shell: 0, moveMul: 0.9, noise: 55, knock: 7 },
    pistol: { id: 'pistol', name: 'P-11 Hollow', short: 'P-11', auto: false, rpm: 400, dmg: 32, head: 2.0, pellets: 1,
      spreadHip: 1.1, spreadAds: 0.22, spreadMove: 1.0, spreadAir: 2.5, bloom: 0.5, bloomMax: 2.0, mag: 12, reserve: Infinity, maxReserve: Infinity,
      reload: 1.3, reloadEmpty: 1.55, magInAt: 0.6, falloff: [20, 45, 0.6], recoil: [1.5, 0.4, 0.05, 0.12], adsFov: 0.86, adsTime: 0.14,
      hip: [0.11, -0.12, -0.3], adsZ: -0.3, equip: 0.3, sound: 'pistol', tracerEvery: 1, shell: 0.8, moveMul: 1.0, noise: 34 },
    smg: { id: 'smg', name: 'Hex-9 Kite', short: 'HEX-9', auto: true, rpm: 900, dmg: 17, head: 1.8, pellets: 1,
      spreadHip: 2.0, spreadAds: 0.45, spreadMove: 1.3, spreadAir: 3, bloom: 0.26, bloomMax: 2.6, mag: 36, reserve: 180, maxReserve: 288,
      reload: 1.55, reloadEmpty: 1.95, magInAt: 0.6, falloff: [12, 34, 0.55], recoil: [0.5, 0.3, 0.025, 0.035], adsFov: 0.8, adsTime: 0.15,
      hip: [0.12, -0.13, -0.28], adsZ: -0.24, equip: 0.35, sound: 'smg', tracerEvery: 2, shell: 0.8, moveMul: 1.04, noise: 38 },
    rocket: { id: 'rocket', name: 'Havoc RPG', short: 'RPG', auto: false, rpm: 50, dmg: 0, head: 1, pellets: 1, rocket: { speed: 40, radius: 6.5, damage: 210 },
      spreadHip: 1.2, spreadAds: 0.2, spreadMove: 1.0, spreadAir: 3, bloom: 0, bloomMax: 0, mag: 1, reserve: 4, maxReserve: 8,
      reload: 2.1, reloadEmpty: 2.1, magInAt: 0.6, falloff: [400, 500, 1], recoil: [5, 0.8, 0.12, 0.3], adsFov: 0.7, adsTime: 0.24,
      hip: [0.16, -0.16, -0.28], ads: [0.11, -0.15, -0.34], adsZ: -0.3, equip: 0.6, sound: 'rocket', tracerEvery: 99, shell: 0, moveMul: 0.9, noise: 60 },
    minigun: { id: 'minigun', name: 'Rotor-6 Minigun', short: 'MINIGUN', auto: true, rpm: 1500, dmg: 15, head: 1.6, pellets: 1, spin: 0.55,
      spreadHip: 2.4, spreadAds: 1.2, spreadMove: 1.2, spreadAir: 3, bloom: 0.04, bloomMax: 1.2, mag: 150, reserve: 300, maxReserve: 600,
      reload: 3.2, reloadEmpty: 3.4, magInAt: 0.6, falloff: [25, 60, 0.6], recoil: [0.22, 0.28, 0.02, 0.02], adsFov: 0.86, adsTime: 0.3,
      hip: [0.2, -0.22, -0.42], ads: [0.15, -0.21, -0.44], adsZ: -0.4, equip: 0.8, sound: 'carbine', tracerEvery: 2, shell: 0.9, moveMul: 0.82, noise: 55 },
    satchel: { id: 'satchel', name: 'Satchel charge', short: 'C4', auto: false, rpm: 90, dmg: 0, head: 1, pellets: 1, satchel: { radius: 7, damage: 230 }, noAds: true,
      spreadHip: 0, spreadAds: 0, spreadMove: 0, spreadAir: 0, bloom: 0, bloomMax: 0, mag: 2, reserve: 2, maxReserve: 4,
      reload: 1.0, reloadEmpty: 1.0, magInAt: 0.6, falloff: [400, 500, 1], recoil: [1, 0.2, 0.02, 0.1], adsFov: 1, adsTime: 0.2,
      hip: [0.16, -0.16, -0.3], adsZ: -0.3, equip: 0.4, sound: 'throw', tracerEvery: 99, shell: 0, moveMul: 1.0, noise: 8 }
  };
  // Player-vs-player damage scaling (multiplayer only)
  DEFS.carbine.pvp = 1; DEFS.shotgun.pvp = 0.85; DEFS.rail.pvp = 0.62; DEFS.pistol.pvp = 1; DEFS.smg.pvp = 1; DEFS.minigun.pvp = 0.7; DEFS.rocket.pvp = 1; DEFS.satchel.pvp = 1;
  const ORDER = ['carbine', 'shotgun', 'rail', 'pistol', 'smg', 'rocket', 'minigun', 'satchel']; // append only: index is sent over the network

  const S = U.Spring;
  const WP = CF.Weapons = {
    defs: DEFS, order: ORDER, inv: {}, cur: null, curId: null, lastId: null, pendingId: null,
    grenades: 2, maxGrenades: 4, state: 'idle', stateT: 0, fireCd: 0, fireBuffer: 0, bloom: 0, adsT: 0, adsE: 0,
    cycleT: 1, shotCount: 0, reloadAdded: false, shellPhase: '', shellT: 0, interrupt: false, chamberEmpty: false,
    vm: {}, grenadesLive: [], projLive: [], spin: 0, breath: 4, flashT: 0, t: 0,
    sp: { kz: new S(170, 17), rx: new S(150, 15), ry: new S(110, 13), rz: new S(110, 12), sx: new S(70, 11), sy: new S(70, 11), land: new S(95, 10) }
  };

  WP.init = function (vmScene, vmCam, scene, camera) {
    this.vmScene = vmScene; this.vmCam = vmCam; this.scene = scene; this.camera = camera;
    for (const id of ORDER) { const v = CF.VM.build(id, true); v.root.visible = false; vmScene.add(v.root); this.vm[id] = v; }
    this.gArm = CF.VM.grenadeArm(); this.gArm.visible = false; vmScene.add(this.gArm);
    const T = CF.Tex.list;
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flash, color: new THREE.Color(5, 3.6, 2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.visible = false; vmScene.add(this.flash);
    vmScene.add(new THREE.HemisphereLight(0x3e4a62, 0x17130f, 0.38));
    const key = new THREE.DirectionalLight(0x9fb0cc, 0.24); key.position.set(-0.4, 1, 0.3); vmScene.add(key);
    this.envL = [new THREE.DirectionalLight(0xff9a45, 0), new THREE.DirectionalLight(0xff9a45, 0)];
    for (const l of this.envL) { vmScene.add(l); vmScene.add(l.target); }
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 2.2, 2); vmScene.add(this.muzzleLight);
  };

  WP.reset = function (loadout) {
    this.inv = {}; this.cur = null; this.curId = null; this.lastId = null;
    for (const id of ORDER) this.vm[id].root.visible = false;
    this.clearLive();
    const lo = loadout || { weapons: { carbine: { mag: 30, reserve: 120 }, pistol: { mag: 12, reserve: Infinity } }, current: 'carbine', grenades: 2 };
    for (const id in lo.weapons) this.inv[id] = { def: DEFS[id], mag: lo.weapons[id].mag, reserve: lo.weapons[id].reserve };
    this.grenades = lo.grenades;
    this.adsT = 0; this.adsToggle = false; this.bloom = 0; this.cycleT = 1; this.fireCd = 0;
    this.equip(lo.current || 'carbine', true);
    CF.HUD.setGrenades(this.grenades, this.maxGrenades);
  };
  /** Remove every grenade, rocket and satchel in the world (map change, respawn, reset). */
  WP.clearLive = function () {
    for (const g of this.grenadesLive) this.scene.remove(g.mesh);
    for (const p of this.projLive) this.scene.remove(p.mesh);
    this.grenadesLive.length = 0; this.projLive.length = 0;
  };
  WP.snapshot = function () {
    const w = {};
    for (const id in this.inv) w[id] = { mag: this.inv[id].mag, reserve: this.inv[id].reserve };
    return { weapons: w, current: this.curId, grenades: this.grenades };
  };

  WP.equip = function (id, instant) {
    if (this.cur) this.vm[this.curId].root.visible = false;
    if (this.curId && this.curId !== id) this.lastId = this.curId;
    this.curId = id; this.cur = this.inv[id];
    const v = this.vm[id]; v.root.visible = true;
    this.state = instant ? 'idle' : 'raise'; this.stateT = 0; this.cycleT = 1; this.spin = 0;
    this.chamberEmpty = this.cur.mag === 0;
    if (!instant) A.play('switch');
    CF.HUD.setWeapon(this.cur.def, this.inv, this.slots());
    this.hudAmmo();
  };
  /** Weapons bound to number keys: fixed campaign slots, or the owned loadout in multiplayer. */
  WP.slots = function () {
    if (CF.Game && CF.Game.mode === 'mp') return ORDER.filter((id) => this.inv[id]).sort((a, b) => (a === 'pistol') - (b === 'pistol'));
    return ORDER;
  };
  WP.select = function (id) {
    if (!this.inv[id] || id === this.curId || this.state === 'melee' || this.state === 'throw') return;
    if (this.state === 'lower') { this.pendingId = id; return; }
    this.pendingId = id; this.state = 'lower'; this.stateT = 0;
  };
  WP.cycle = function (dir) {
    const owned = this.slots().filter((id) => this.inv[id]);
    if (owned.length < 2) return;
    const i = owned.indexOf(this.pendingId && this.state === 'lower' ? this.pendingId : this.curId);
    this.select(owned[(i + (dir > 0 ? 1 : -1) + owned.length) % owned.length]);
  };
  WP.give = function (id, silent) {
    const d = DEFS[id];
    if (this.inv[id]) {
      const w = this.inv[id];
      if (w.reserve === Infinity) return false;
      const before = w.reserve; w.reserve = Math.min(d.maxReserve, w.reserve + d.mag * 2);
      this.hudAmmo(); return w.reserve > before;
    }
    this.inv[id] = { def: d, mag: d.mag, reserve: d.reserve };
    CF.HUD.setWeapon(this.cur.def, this.inv, this.slots(), id);
    if (!silent) this.select(id);
    return true;
  };
  /** Refill all weapons + grenades. Returns true if anything was added. */
  WP.resupply = function () {
    let any = false;
    for (const id in this.inv) {
      const w = this.inv[id], d = w.def;
      if (w.reserve === Infinity) continue;
      const target = Math.max(d.reserve, Math.min(d.maxReserve, d.reserve + d.mag));
      if (w.reserve < target) { w.reserve = target; any = true; }
    }
    if (this.grenades < this.maxGrenades) { this.grenades = this.maxGrenades; any = true; CF.HUD.setGrenades(this.grenades, this.maxGrenades); }
    this.hudAmmo();
    return any;
  };
  WP.addAmmoFraction = function (frac) {
    const w = this.cur; if (!w || w.reserve === Infinity) { const c = this.inv.carbine; if (c) c.reserve = Math.min(c.def.maxReserve, c.reserve + 15); this.hudAmmo(); return; }
    w.reserve = Math.min(w.def.maxReserve, w.reserve + Math.ceil(w.def.mag * frac));
    this.hudAmmo();
  };
  WP.hudAmmo = function () { if (this.cur) CF.HUD.setAmmo(this.cur.mag, this.cur.reserve, this.cur.def.mag); };

  WP.busy = function () { return this.state !== 'idle'; };
  WP.reload = function () {
    const w = this.cur, d = w.def;
    if (this.state !== 'idle' || w.mag >= d.mag || w.reserve <= 0) return;
    this.state = 'reload'; this.stateT = 0; this.reloadAdded = false; this.interrupt = false;
    this.chamberEmpty = w.mag === 0;
    if (d.shellReload) { this.shellPhase = 'start'; this.shellT = 0; }
    this.reloadDur = d.shellReload ? 0 : (w.mag === 0 ? d.reloadEmpty : d.reload);
    this.reloadSounds = {};
  };
  WP.melee = function () {
    if (this.state === 'melee' || this.state === 'throw' || this.state === 'lower') return;
    this.state = 'melee'; this.stateT = 0; this.meleeDone = false; A.play('melee');
  };
  WP.throwGrenade = function () {
    if (this.grenades <= 0 || this.state === 'throw' || this.state === 'melee' || this.state === 'lower') return;
    this.state = 'throw'; this.stateT = 0; this.throwDone = false; A.play('throw');
  };

  // ------------------------------------------------------------ firing
  const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3();
  const _m = new THREE.Vector3(), _hp = new THREE.Vector3(), _v = new THREE.Vector3();
  WP.currentSpread = function (P) {
    const d = this.cur.def;
    const ads = this.adsE;
    let s = U.lerp(d.spreadHip, d.spreadAds, ads);
    s += d.spreadMove * P.moveFrac * (1 - ads * 0.65);
    if (!P.body.grounded) s += d.spreadAir;
    if (P.crouchT > 0.5 && P.body.grounded) s *= 0.8;
    s += this.bloom * (1 - ads * 0.5);
    return s;
  };
  WP.muzzleWorld = function (out, dist) {
    const v = this.vm[this.curId];
    v.parts.muzzle.getWorldPosition(_m);
    _m.project(this.vmCam);
    out.set(_m.x, _m.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize().multiplyScalar(dist || 0.9).add(this.camera.position);
    return out;
  };
  WP.fire = function (P) {
    const w = this.cur, d = w.def, cam = this.camera;
    w.mag--; this.fireCd = 60 / d.rpm; this.shotCount++;
    if (d.pump) this.cycleT = 0;
    if (d.id === 'rail') this.cycleT = 0;
    const st = CF.Game.stats; st.shots++;
    cam.getWorldDirection(_f); _o.copy(cam.position);
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion); _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const spread = this.currentSpread(P) * D2R;
    const muzzle = this.muzzleWorld(new THREE.Vector3(), 0.9);
    let anyHit = false, headHit = false;
    const ends = CF.MP && CF.MP.active ? [] : null;
    for (let p = 0; p < d.pellets; p++) {
      const a = Math.random() * Math.PI * 2, rr = spread * Math.sqrt(Math.random());
      const tx = Math.tan(rr) * Math.cos(a), ty = Math.tan(rr) * Math.sin(a);
      _d.copy(_f).addScaledVector(_r, tx).addScaledVector(_u, ty).normalize();
      if (d.scope && this.adsE > 0.9) _d.copy(this.scopeDir(_d));
      const wh = W.raycast(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, 400);
      let tWorld = wh ? wh.t : 400;
      const wbox = wh ? wh.box : null, wsurf = wbox ? wbox.surf : null;
      const wx = wh ? wh.x : 0, wy = wh ? wh.y : 0, wz = wh ? wh.z : 0, wnx = wh ? wh.nx : 0, wny = wh ? wh.ny : 0, wnz = wh ? wh.nz : 0;
      let endT = tWorld;
      const hits = d.pierce ? CF.Enemies.raycastAll(_o, _d, tWorld, d.pierce) : (() => { const h = CF.Enemies.raycast(_o, _d, tWorld); return h ? [h] : []; })();
      for (const h of hits) {
        const dist = h.t;
        const fall = dist <= d.falloff[0] ? 1 : dist >= d.falloff[1] ? d.falloff[2] : U.lerp(1, d.falloff[2], (dist - d.falloff[0]) / (d.falloff[1] - d.falloff[0]));
        const res = h.enemy.damage(d.dmg * fall, { dir: _d, point: h.point, normal: h.normal, part: h.part, weapon: d.id, source: 'player', knock: d.knock || 1.5 });
        anyHit = true; if (res && res.head) headHit = true;
        if (!d.pierce) endT = dist;
      }
      if (!hits.length || d.pierce) {
        if (wh) {
          const fake = { x: wx, y: wy, z: wz, nx: wnx, ny: wny, nz: wnz, box: wbox };
          CF.FX.impact(fake, _d, wsurf);
          if (wbox && wbox.owner && wbox.owner.hp !== undefined) CF.Game.damageBarrel(wbox.owner, d.dmg);
        }
      }
      _hp.copy(_o).addScaledVector(_d, Math.min(endT, 400));
      if (ends) ends.push(_hp.clone());
      if (d.id === 'rail') {
        CF.FX.tracer(muzzle, _hp, { r: 0.8, g: 3.2, b: 5, w: 0.07, life: 0.55 });
        CF.FX.tracer(muzzle, _hp, { r: 2, g: 2.4, b: 3, w: 0.02, life: 0.3 });
        const len = muzzle.distanceTo(_hp), n = Math.min(80, Math.floor(len * 1.5));
        for (let i = 0; i < n; i++) {
          const k = i / n; _v.lerpVectors(muzzle, _hp, k);
          const ang = k * len * 2.2;
          _v.addScaledVector(_r, Math.cos(ang) * 0.09).addScaledVector(_u, Math.sin(ang) * 0.09);
          CF.FX.add.spawn(_v.x, _v.y, _v.z, U.gauss() * 0.2, U.gauss() * 0.2 + 0.2, U.gauss() * 0.2, U.rand(0.3, 0.7), 0.05, 0.01, 0.6, 2.4, 4, 1, 0, 1.5, 0);
        }
      } else if (this.shotCount % d.tracerEvery === 0 || d.pellets > 1) {
        const pellet = d.pellets > 1;
        CF.FX.tracer(muzzle, _hp, { speed: pellet ? 260 : 380, len: pellet ? 2.5 : 5, w: pellet ? 0.018 : 0.028, r: 3.2, g: 2.1, b: 1.0 });
      }
    }
    if (anyHit) { st.hits++; if (headHit) st.headHits++; }
    if (ends) CF.MP.onShot(d.id, muzzle, ends);
    // feedback
    const rc = d.recoil, adsK = 1 - this.adsE * 0.4;
    P.addRecoil(rc[0] * adsK * U.rand(0.85, 1.15), (Math.random() - 0.35) * rc[1] * 2 * adsK);
    this.sp.kz.kick(rc[2] * 18 * adsK); this.sp.rx.kick(rc[3] * 22 * adsK); this.sp.rz.kick((Math.random() - 0.5) * rc[3] * 12);
    this.bloom = Math.min(d.bloomMax, this.bloom + d.bloom);
    P.shake(d.id === 'shotgun' ? 0.22 : d.id === 'rail' ? 0.3 : 0.07);
    A.play(d.sound, null, { send: 0.3 + A.room * 0.8 });
    this.flashT = d.id === 'rail' ? 0.06 : 0.035;
    this.flash.material.rotation = Math.random() * Math.PI * 2;
    const fs = d.id === 'shotgun' ? 0.36 : d.id === 'pistol' ? 0.16 : d.id === 'rail' ? 0.3 : 0.22;
    this.flash.scale.setScalar(fs * U.rand(0.8, 1.2));
    this.flash.material.color.setRGB(d.id === 'rail' ? 1.5 : 5, d.id === 'rail' ? 4 : 3.6, d.id === 'rail' ? 6 : 2.2);
    CF.FX.flashLight(muzzle, d.id === 'rail' ? 0x60c8ff : 0xffa850, d.id === 'shotgun' ? 5 : 3, 9, 0.07);
    if (d.shell && !d.pump) this.eject(P, d.shell);
    CF.Enemies.noise(cam.position, d.noise);
    if (d.id === 'rail') A.play('railCharge', null, { delay: 0.25 });
    if (d.pump) { A.play('pumpBack', null, { delay: 0.3 }); A.play('pumpFwd', null, { delay: 0.48 }); }
    this.hudAmmo(); CF.HUD.ammoBump();
    if (w.mag === 0) this.chamberEmpty = true;
  };
  /** Rockets and satchel charges: physical projectiles that explode instead of hitscan bullets. */
  WP.fireSpecial = function (P) {
    const w = this.cur, d = w.def, cam = this.camera;
    w.mag--; this.fireCd = 60 / d.rpm; CF.Game.stats.shots++;
    cam.getWorldDirection(_f); _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    if (d.rocket) {
      const muzzle = this.muzzleWorld(new THREE.Vector3(), 0.9);
      const spread = this.currentSpread(P) * D2R;
      _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
      _d.copy(_f).addScaledVector(_r, (Math.random() - 0.5) * spread).addScaledVector(_u, (Math.random() - 0.5) * spread).normalize();
      const mesh = CF.VM.rocketWorld(); this.scene.add(mesh);
      const pos = cam.position.clone().addScaledVector(_d, 0.6);
      this.projLive.push({ kind: 'rocket', mesh, pos, vel: _d.clone().multiplyScalar(d.rocket.speed), life: 5, def: d });
      CF.FX.flashLight(muzzle, 0xffa850, 5, 10, 0.1);
      for (let i = 0; i < 10; i++) CF.FX.smoke.spawn(cam.position.x - _f.x * 0.6, cam.position.y - 0.2, cam.position.z - _f.z * 0.6, U.gauss() * 0.8 - _f.x * 3, U.gauss() * 0.4, U.gauss() * 0.8 - _f.z * 3, 1.2, 0.3, 1.4, 0.35, 0.35, 0.35, 0.6, -0.2, 0.6, 1);
      if (CF.MP && CF.MP.active) CF.MP.onShot(d.id, muzzle, []);
      P.shake(0.35);
    } else {
      const mesh = CF.VM.satchelWorld(); this.scene.add(mesh);
      const pos = cam.position.clone().addScaledVector(_f, 0.45).addScaledVector(_r, -0.15); pos.y -= 0.1;
      const vel = _f.clone().multiplyScalar(11).add(new THREE.Vector3(0, 3, 0)).addScaledVector(P.body.vel, 0.8);
      this.projLive.push({ kind: 'satchel', mesh, pos, vel, rest: false, def: d, t: 0 });
      if (w.mag === 0 && w.reserve > 0) CF.HUD.hint('Right click or ' + CF.Keys.label('aim') + ' to detonate', false);
    }
    const rc = d.recoil;
    P.addRecoil(rc[0] * U.rand(0.85, 1.15), (Math.random() - 0.35) * rc[1] * 2);
    this.sp.kz.kick(rc[2] * 18); this.sp.rx.kick(rc[3] * 22);
    A.play(d.sound, null, { send: 0.3 + A.room * 0.8 });
    CF.Enemies.noise(cam.position, d.noise);
    this.hudAmmo(); CF.HUD.ammoBump();
    if (w.mag === 0) this.chamberEmpty = true;
  };
  WP.detonate = function () {
    let n = 0;
    for (let i = this.projLive.length - 1; i >= 0; i--) {
      const p = this.projLive[i];
      if (p.kind !== 'satchel') continue;
      this.projLive.splice(i, 1); this.scene.remove(p.mesh);
      const pos = p.pos.clone();
      CF.Game.later(n * 0.08, () => this.boom(pos, p.def.satchel, 'satchel'));
      n++;
    }
    if (n) A.play('switch');
    return n;
  };
  WP.boom = function (pos, spec, wid) {
    CF.Game.explode(pos, { radius: spec.radius, damage: CF.Game.mode === 'mp' ? spec.damage * 0.75 : spec.damage, source: 'player', shake: 1, weapon: wid, scale: spec.radius / 5 });
    if (CF.MP && CF.MP.active) CF.MP.onBoom(pos);
  };
  WP.updateProjectiles = function (dt) {
    for (let i = this.projLive.length - 1; i >= 0; i--) {
      const p = this.projLive[i];
      if (p.kind === 'rocket') {
        p.life -= dt;
        const sp = p.vel.length(), dist = sp * dt;
        _d.copy(p.vel).divideScalar(sp);
        const wh = W.raycast(p.pos.x, p.pos.y, p.pos.z, _d.x, _d.y, _d.z, dist + 0.1);
        const eh = CF.Enemies.raycast(p.pos, _d, wh ? wh.t : dist + 0.1);
        if (eh || wh || p.life <= 0) {
          const at = eh ? eh.point : wh ? new THREE.Vector3(wh.x + wh.nx * 0.2, wh.y + wh.ny * 0.2, wh.z + wh.nz * 0.2) : p.pos;
          if (eh) eh.enemy.damage(60, { dir: _d.clone(), point: eh.point, normal: eh.normal, part: eh.part, weapon: 'rocket', source: 'player', knock: 6 });
          this.scene.remove(p.mesh); this.projLive.splice(i, 1);
          this.boom(at, p.def.rocket, 'rocket');
          continue;
        }
        p.pos.addScaledVector(p.vel, dt);
        p.mesh.position.copy(p.pos); p.mesh.lookAt(_v.copy(p.pos).sub(p.vel));
        CF.FX.smoke.spawn(p.pos.x, p.pos.y, p.pos.z, U.gauss() * 0.2, 0.3, U.gauss() * 0.2, 1.4, 0.2, 1.1, 0.25, 0.25, 0.25, 0.6, -0.2, 0.6, 1);
        CF.FX.glow(p.pos.x, p.pos.y, p.pos.z, 0.6, 4, 2, 0.6, 0.03);
      } else {
        p.t += dt;
        if (!p.rest) {
          p.vel.y -= 18 * dt;
          const sp = p.vel.length(), dist = sp * dt;
          if (dist > 1e-5) {
            _d.copy(p.vel).divideScalar(sp);
            const h = W.raycast(p.pos.x, p.pos.y, p.pos.z, _d.x, _d.y, _d.z, dist + 0.08);
            if (h) { // satchels stick to whatever they hit
              p.pos.set(h.x + h.nx * 0.06, h.y + h.ny * 0.06, h.z + h.nz * 0.06);
              p.rest = true; p.vel.set(0, 0, 0); A.play('bounce', p.pos, { ref: 4 });
              p.mesh.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _u.set(h.nx, h.ny, h.nz));
            } else { p.pos.addScaledVector(p.vel, dt); p.mesh.rotation.x += dt * 6; }
          }
        }
        p.mesh.position.copy(p.pos);
        p.mesh.userData.led.visible = (p.t % 0.8) < 0.15;
      }
    }
  };
  WP.eject = function (P, size) {
    const v = this.vm[this.curId];
    v.parts.eject.getWorldPosition(_m);
    _m.project(this.vmCam);
    const pos = new THREE.Vector3(_m.x, _m.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize().multiplyScalar(0.55).add(this.camera.position);
    const vel = new THREE.Vector3().addScaledVector(_r, U.rand(1.6, 2.6)).addScaledVector(_u, U.rand(1.4, 2.4)).addScaledVector(_f, U.rand(-0.4, 0.3)).add(P.body.vel);
    CF.FX.shell(pos, vel, size);
  };
  // scoped sway: breathing drifts the aim unless steadied
  WP.scopeDir = function (d) {
    const t = this.t, steady = this.steady ? 0.15 : 1;
    const sx = (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3) * 0.25) * 0.0022 * steady;
    const sy = (Math.cos(t * 1.1) * 0.5 + Math.sin(t * 1.7) * 0.3) * 0.0022 * steady;
    return _v.copy(d).addScaledVector(_r, sx).addScaledVector(_u, sy).normalize();
  };

  // ------------------------------------------------------------ grenades
  WP.spawnGrenade = function (P) {
    const cam = this.camera;
    cam.getWorldDirection(_f); _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const mesh = CF.VM.grenadeWorld(); this.scene.add(mesh);
    const pos = cam.position.clone().addScaledVector(_f, 0.45).addScaledVector(_r, -0.18); pos.y -= 0.1;
    const vel = _f.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.6, 0)).addScaledVector(P.body.vel, 0.8);
    this.grenadesLive.push({ mesh, pos, vel, fuse: 2.1, spin: new THREE.Vector3(U.gauss() * 10, U.gauss() * 10, U.gauss() * 10), rest: false });
    this.grenades--; CF.HUD.setGrenades(this.grenades, this.maxGrenades);
    if (CF.MP && CF.MP.active) CF.MP.onNade(pos, vel);
  };
  /** Another player's grenade: same flight, visual-only blast (the thrower applies the damage). */
  WP.spawnGhostGrenade = function (pos, vel) {
    const mesh = CF.VM.grenadeWorld(); this.scene.add(mesh);
    this.grenadesLive.push({ mesh, pos, vel, fuse: 2.1, spin: new THREE.Vector3(U.gauss() * 10, U.gauss() * 10, U.gauss() * 10), rest: false, ghost: true });
  };
  WP.updateGrenades = function (dt) {
    for (let i = this.grenadesLive.length - 1; i >= 0; i--) {
      const g = this.grenadesLive[i];
      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh); this.grenadesLive.splice(i, 1);
        if (g.ghost) { CF.FX.explosion(g.pos, 7.5 / 5.5); const dd = g.pos.distanceTo(CF.Player.body.pos); CF.Player.shake(U.clamp(1 - dd / 30, 0, 1)); if (dd < 15) A.concuss(0.25 * (1 - dd / 15)); }
        else CF.Game.explode(g.pos, { radius: 7.5, damage: CF.Game.mode === 'mp' ? 150 : 180, source: 'player', shake: 1 });
        continue;
      }
      if (!g.rest) {
        g.vel.y -= 18 * dt;
        const sp = g.vel.length(), dist = sp * dt;
        if (dist > 1e-5) {
          _d.copy(g.vel).divideScalar(sp);
          const h = W.raycast(g.pos.x, g.pos.y, g.pos.z, _d.x, _d.y, _d.z, dist + 0.06);
          if (h) {
            g.pos.set(h.x + h.nx * 0.07, h.y + h.ny * 0.07, h.z + h.nz * 0.07);
            _v.set(h.nx, h.ny, h.nz);
            const vn = g.vel.dot(_v);
            g.vel.addScaledVector(_v, -1.42 * vn).multiplyScalar(0.62);
            if (sp > 2.5) A.play('bounce', g.pos, { ref: 4 });
            if (h.ny > 0.7 && g.vel.length() < 1.2) { g.rest = true; g.vel.set(0, 0, 0); }
            g.spin.multiplyScalar(0.6);
          } else g.pos.addScaledVector(g.vel, dt);
        }
      }
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt; g.mesh.rotation.z += g.spin.z * dt;
    }
  };

  // ------------------------------------------------------------ per-frame
  WP.update = function (dt, P) {
    this.t += dt;
    const inp = CF.Input, w = this.cur, d = w.def;
    const live = P.alive && !P.frozen && CF.Game.state === 'playing';
    if (live) {
      const sl = this.slots();
      for (let i = 0; i < sl.length; i++) if (inp.hit('Digit' + (i + 1))) this.select(sl[i]);
      if (inp.hit('KeyQ') && this.lastId && this.inv[this.lastId]) this.select(this.lastId);
      if (inp.wheel) this.cycle(inp.wheel);
      if (inp.hit('KeyR')) this.reload();
      if (inp.hit('KeyV')) this.melee();
      if (inp.hit('KeyG')) this.throwGrenade();
      if (d.satchel && (inp.hit('KeyF') || inp.mpressed[2])) this.detonate();
    }
    // ADS
    // Tab toggles aiming (trackpad-friendly); right mouse still aims while held
    const toggleAim = CF.settings.aimMode === 'toggle';
    if (live && (inp.hit('KeyF') || (toggleAim && inp.mpressed[2]))) this.adsToggle = !this.adsToggle;
    if (!live || P.sprinting || this.state === 'lower' || this.state === 'melee' || this.state === 'throw') this.adsToggle = false;
    if (d.noAds) this.adsToggle = false;
    const canAds = live && !d.noAds && ((inp.mdown[2] && !toggleAim) || this.adsToggle) && (this.state === 'idle' || this.state === 'reload') && !P.sprinting && !P.mantling;
    this.adsT = U.clamp(this.adsT + (canAds ? 1 : -1) * dt / d.adsTime, 0, 1);
    this.adsE = U.easeInOut(this.adsT);
    this.steady = d.scope && this.adsE > 0.9 && inp.down('ShiftLeft') && this.breath > 0;
    this.breath = this.steady ? Math.max(0, this.breath - dt) : Math.min(4, this.breath + dt * 0.7);
    // firing
    this.fireCd -= dt;
    this.cycleT = Math.min(1, this.cycleT + dt / (60 / d.rpm));
    this.bloom = Math.max(0, this.bloom - dt * (d.auto ? 5.5 : 4));
    if (inp.mpressed[0]) this.fireBuffer = 0.14; else this.fireBuffer -= dt;
    if (d.spin) { // minigun barrels have to spin up before it fires
      const spinning = live && inp.mdown[0] && (this.state === 'idle' || this.state === 'raise') && !P.sprinting;
      this.spin = U.clamp(this.spin + (spinning ? 1 : -0.7) * dt / d.spin, 0, 1);
    }
    if (live) {
      const want = d.auto ? inp.mdown[0] : this.fireBuffer > 0;
      if (want) {
        if (P.sprinting) P.stopSprint();
        if (this.state === 'reload' && d.shellReload && w.mag > 0) this.interrupt = true;
        if (this.state === 'idle' && this.fireCd <= 0 && P.sprintOut <= 0 && this.cycleT >= 1 && (!d.spin || this.spin >= 1)) {
          if (w.mag > 0) { if (d.rocket || d.satchel) this.fireSpecial(P); else this.fire(P); this.fireBuffer = 0; }
          else if (d.satchel && inp.mpressed[0] && this.detonate()) this.fireBuffer = 0;
          else if (inp.mpressed[0]) { A.play('dry'); this.fireBuffer = 0; if (w.reserve > 0) this.reload(); else CF.HUD.hint('Out of ammo · switch weapon', true); }
        }
      }
      if (w.mag === 0 && w.reserve > 0 && this.state === 'idle' && this.fireCd <= -0.25 && !inp.mdown[0]) CF.HUD.hint('Press ' + CF.Keys.label('reload') + ' to reload');
      else if (w.mag > 0 && w.mag <= Math.ceil(d.mag * 0.25) && this.state === 'idle' && w.reserve > 0) CF.HUD.hint('Reload [' + CF.Keys.label('reload') + ']');
    }
    this.updateState(dt, P);
    this.updateGrenades(dt);
    this.updateProjectiles(dt);
    // crosshair spread
    const spread = this.currentSpread(P) * D2R;
    const px = Math.tan(spread) * (window.innerHeight / 2) / Math.tan((this.camera.fov * D2R) / 2);
    CF.HUD.setSpread(px + 5, (this.adsE > 0.55 && !d.ads) || this.state === 'lower' || P.sprinting);
    CF.HUD.showScope(d.scope && this.adsE > 0.92, this.steady, this.breath);
    this.animate(dt, P);
  };

  WP.updateState = function (dt, P) {
    const w = this.cur, d = w.def;
    this.stateT += dt;
    const t = this.stateT;
    if (this.state === 'raise' && t >= d.equip) { this.state = 'idle'; }
    else if (this.state === 'lower' && t >= 0.18) { const id = this.pendingId; this.pendingId = null; this.equip(id); }
    else if (this.state === 'reload') {
      if (d.shellReload) {
        this.shellT += dt;
        if (this.shellPhase === 'start' && this.shellT >= d.reloadStart) { this.shellPhase = 'shell'; this.shellT = 0; }
        else if (this.shellPhase === 'shell' && this.shellT >= d.reloadShell) {
          w.mag++; w.reserve--; A.play('shellIn'); this.hudAmmo(); this.shellT = 0;
          if (w.mag >= d.mag || w.reserve <= 0 || this.interrupt) { this.shellPhase = 'end'; this.shellT = 0; if (this.chamberEmpty) { A.play('pumpBack'); A.play('pumpFwd', null, { delay: 0.16 }); } }
        } else if (this.shellPhase === 'end' && this.shellT >= (this.chamberEmpty ? d.reloadEnd : 0.18)) { this.state = 'idle'; this.chamberEmpty = false; this.interrupt = false; }
      } else {
        const k = t / this.reloadDur, snd = this.reloadSounds;
        if (k > 0.2 && !snd.a) { snd.a = 1; A.play('magOut'); }
        if (k > d.magInAt - 0.04 && !snd.b) { snd.b = 1; A.play('magIn'); }
        if (k >= d.magInAt && !this.reloadAdded) {
          this.reloadAdded = true;
          const need = d.mag - w.mag, take = Math.min(need, w.reserve);
          w.mag += take; if (w.reserve !== Infinity) w.reserve -= take;
          this.hudAmmo();
        }
        if (this.chamberEmpty && k > 0.8 && !snd.c) { snd.c = 1; A.play(this.curId === 'pistol' ? 'slide2' : this.curId === 'rail' ? 'railCharge' : 'bolt'); }
        if (k >= 1) { this.state = 'idle'; this.chamberEmpty = false; }
      }
    } else if (this.state === 'melee') {
      if (t >= 0.12 && !this.meleeDone) {
        this.meleeDone = true; CF.Game.stats.shots++;
        this.camera.getWorldDirection(_f);
        const hit = CF.Enemies.melee(this.camera.position, _f, 2.5, 85);
        if (hit) { A.play('meleeHit'); P.shake(0.25); } else {
          const h = W.raycast(this.camera.position.x, this.camera.position.y, this.camera.position.z, _f.x, _f.y, _f.z, 1.8);
          if (h) { CF.FX.impact({ x: h.x, y: h.y, z: h.z, nx: h.nx, ny: h.ny, nz: h.nz, box: h.box }, _f, h.box.surf); P.shake(0.12); }
        }
      }
      if (t >= 0.55) this.state = 'idle';
    } else if (this.state === 'throw') {
      if (t >= 0.3 && !this.throwDone) { this.throwDone = true; this.spawnGrenade(P); }
      if (t >= 0.72) this.state = 'idle';
    }
  };

  // ------------------------------------------------------------ viewmodel animation
  const _e = new THREE.Euler();
  WP.animate = function (dt, P) {
    const v = this.vm[this.curId], d = this.cur.def, sp = this.sp, root = v.root, parts = v.parts;
    const ads = this.adsE, noAds = 1 - ads;
    // base pose
    // bulky launchers aim from the shoulder: they stay low and to the side so the view stays clear
    const at = d.ads || [0, -v.sightY, d.adsZ];
    let px = U.lerp(d.hip[0], at[0], ads), py = U.lerp(d.hip[1], at[1], ads), pz = U.lerp(d.hip[2], at[2], ads);
    let rx = 0, ry = 0, rz = 0;
    // sprint / crouch
    const spr = P.sprintT * noAds;
    px -= 0.05 * spr; py -= 0.045 * spr; pz += 0.03 * spr; ry += 0.75 * spr; rx -= 0.22 * spr; rz += 0.12 * spr;
    rz += 0.06 * P.crouchT * noAds; px -= 0.01 * P.crouchT * noAds;
    // bob + idle breathing
    const amp = P.bobAmp * (0.25 + 0.75 * noAds) * (1 + spr * 0.6);
    px += Math.sin(P.bobPhase) * 0.011 * amp; py += -Math.abs(Math.cos(P.bobPhase)) * 0.014 * amp;
    rz += Math.sin(P.bobPhase) * 0.02 * amp; rx += Math.abs(Math.cos(P.bobPhase)) * 0.01 * amp;
    py += Math.sin(this.t * 1.7) * 0.0022 * noAds; rx += Math.sin(this.t * 1.3) * 0.004 * noAds;
    // sway from mouse
    sp.sx.target = U.clamp(-CF.Input.dx * 0.0006, -0.08, 0.08); sp.sy.target = U.clamp(CF.Input.dy * 0.0006, -0.06, 0.06);
    const swx = sp.sx.update(dt), swy = sp.sy.update(dt);
    ry += swx * (1 - ads * 0.75); rx += swy * (1 - ads * 0.75); px += swx * 0.05 * noAds;
    // landing dip
    py -= sp.land.update(dt) * (1 - ads * 0.6);
    // slide tilt
    rz += 0.25 * P.slideT * noAds; px -= 0.03 * P.slideT;
    // recoil springs
    pz += sp.kz.update(dt) * 0.01; rx += sp.rx.update(dt) * 0.02; rz += sp.rz.update(dt) * 0.02; ry += sp.ry.update(dt) * 0.02;
    // state overlays
    const t = this.stateT;
    let hideGun = 0;
    if (this.state === 'raise') { const e = U.easeOutCubic(U.clamp(t / d.equip, 0, 1)); py -= 0.25 * (1 - e); rx -= 0.9 * (1 - e); rz += 0.3 * (1 - e); }
    else if (this.state === 'lower') { const e = U.clamp(t / 0.18, 0, 1); py -= 0.25 * e * e; rx -= 0.8 * e * e; }
    else if (this.state === 'melee') {
      const k = t / 0.55;
      const out = k < 0.22 ? U.easeOutCubic(k / 0.22) : 1 - U.easeInOut(U.clamp((k - 0.22) / 0.78, 0, 1));
      pz -= 0.16 * out; px -= 0.06 * out; py += 0.03 * out; ry += 0.55 * out; rz -= 0.9 * out; rx += 0.2 * out;
    } else if (this.state === 'throw') {
      const k = t / 0.72;
      const down = k < 0.18 ? k / 0.18 : k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
      py -= 0.22 * U.easeInOut(U.clamp(down, 0, 1)); rx -= 0.5 * U.easeInOut(U.clamp(down, 0, 1));
    }
    const rp = this.animateReload(v, d, dt);
    px += rp.px; py += rp.py; rx += rp.rx; rz += rp.rz;
    // mechanical parts
    if (parts.bolt) parts.bolt.position.z = 0.06 + (this.flashT > 0 ? 0.03 : 0) + (this.reloadBolt || 0);
    if (parts.slide) parts.slide.position.z = (this.flashT > 0 ? 0.028 : 0) + ((this.cur.mag === 0 && this.state !== 'reload') || this.slideBack ? 0.028 : 0);
    if (parts.pump) {
      let pk = 0;
      if (d.pump && this.cycleT < 1) pk = U.pulse(this.cycleT, 0.3, 0.72);
      if (this.pumpReload) pk = Math.max(pk, this.pumpReload);
      parts.pump.position.z = -0.42 + 0.075 * pk;
    }
    if (parts.barrels) parts.barrels.rotation.z += this.spin * dt * 45;
    if (parts.charge && this.state !== 'reload') parts.charge.visible = this.cur.mag > 0;
    if (d.rocket && parts.mag && this.state !== 'reload') parts.mag.visible = this.cur.mag > 0;
    if (parts.coils) {
      const charge = d.id === 'rail' ? U.smoothstep(0.35, 1, this.cycleT) : 1;
      const lvl = this.cur.mag === 0 ? 0.08 : 0.15 + 0.85 * charge;
      const pulse = 0.85 + 0.15 * Math.sin(this.t * 9);
      parts.coils.forEach((c) => { c.material.color.setRGB(0.4 * lvl * pulse, 2.6 * lvl * pulse, 4.2 * lvl * pulse); });
    }
    // muzzle flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      parts.muzzle.getWorldPosition(this.flash.position);
      this.flash.visible = true;
      this.muzzleLight.position.copy(this.flash.position); this.muzzleLight.intensity = d.id === 'shotgun' ? 5 : 3;
      this.muzzleLight.color.set(d.id === 'rail' ? 0x60c8ff : 0xffb060);
    } else { this.flash.visible = false; this.muzzleLight.intensity = 0; }
    root.position.set(px, py, pz);
    root.rotation.set(rx, ry, rz);
    root.visible = !(d.scope && ads > 0.92) && hideGun < 1;
    // grenade arm
    const ga = this.gArm;
    if (this.state === 'throw') {
      const k = t / 0.72;
      ga.visible = k > 0.08 && k < 0.62;
      const up = U.easeOutCubic(U.clamp((k - 0.08) / 0.2, 0, 1)), fling = U.clamp((k - 0.36) / 0.2, 0, 1);
      ga.position.set(-0.14 + fling * 0.08, -0.34 + up * 0.22 - fling * 0.1, -0.3 - fling * 0.25);
      ga.rotation.set(-0.2 + up * 0.5 - fling * 1.4, 0.2, 0.2);
      ga.userData.nade.visible = k < 0.42;
    } else ga.visible = false;
    this.updateEnvLights(P);
  };

  WP.animateReload = function (v, d, dt) {
    const P = v.parts, out = this._rp || (this._rp = { px: 0, py: 0, rx: 0, rz: 0 });
    out.px = 0; out.py = 0; out.rx = 0; out.rz = 0;
    this.reloadBolt = 0; this.slideBack = false; this.pumpReload = 0;
    const magBase = this.magBase || (this.magBase = {});
    if (P.mag && !magBase[this.curId]) magBase[this.curId] = P.mag.position.clone();
    if (P.mag) P.mag.position.copy(magBase[this.curId]);
    if (P.handL && P.handLHome) P.handL.position.copy(P.handLHome);
    if (this.state !== 'reload') return out;
    let tilt = 0, dip = 0;
    if (d.shellReload) {
      const ph = this.shellPhase, k = this.shellT;
      tilt = ph === 'start' ? U.easeInOut(U.clamp(k / d.reloadStart, 0, 1)) : ph === 'end' ? 1 - U.easeInOut(U.clamp(k / 0.3, 0, 1)) : 1;
      if (ph === 'shell' && P.handL) {
        const c = k / d.reloadShell, push = U.pulse(c, 0.35, 0.9);
        P.handL.position.set(P.handLHome.x - 0.01, P.handLHome.y - 0.07 + push * 0.05, 0.28 + push * 0.02);
      } else if (P.handL) { P.handL.position.lerp(new THREE.Vector3(P.handLHome.x - 0.01, P.handLHome.y - 0.07, 0.28), tilt); }
      if (ph === 'end' && this.chamberEmpty) this.pumpReload = U.pulse(k / d.reloadEnd, 0.05, 0.7);
      out.rz = 0.55 * tilt; out.rx = 0.15 * tilt; out.py = -0.02 * tilt;
      return out;
    }
    const k = this.stateT / this.reloadDur;
    tilt = k < 0.14 ? U.easeInOut(k / 0.14) : k > 0.84 ? 1 - U.easeInOut((k - 0.84) / 0.16) : 1;
    const magOut = U.easeInOut(U.seg(k, 0.16, 0.3)), magIn = U.easeInOut(U.seg(k, 0.4, d.magInAt));
    const dropY = -0.28;
    if (P.mag) {
      const base = magBase[this.curId];
      if (k < 0.34) P.mag.position.set(base.x, base.y + dropY * magOut, base.z + 0.02 * magOut);
      else P.mag.position.set(base.x, base.y + dropY * (1 - magIn), base.z);
      P.mag.visible = !(k > 0.3 && k < 0.36);
    }
    if (P.handL) {
      const grab = U.easeInOut(U.seg(k, 0.26, 0.4)), back = U.easeInOut(U.seg(k, d.magInAt + 0.04, 0.8));
      const base = magBase[this.curId] || P.handLHome;
      const hx = base.x - 0.02, hy = base.y - 0.1 + dropY * (1 - magIn), hz = base.z + 0.02;
      const w = grab * (1 - back);
      P.handL.position.set(U.lerp(P.handLHome.x, hx, w), U.lerp(P.handLHome.y, hy, w), U.lerp(P.handLHome.z, hz, w));
    }
    dip = U.pulse(k, d.magInAt - 0.02, d.magInAt + 0.08) * 0.012;
    if (this.chamberEmpty) {
      const b = U.pulse(k, 0.8, 0.94);
      this.reloadBolt = b * 0.06;
      if (this.curId === 'pistol') this.slideBack = k < 0.82;
    }
    const roll = this.curId === 'pistol' ? 0.35 : 0.5;
    out.rz = roll * tilt; out.rx = 0.18 * tilt - dip * 4; out.py = -0.03 * tilt + dip; out.px = -0.02 * tilt;
    return out;
  };

  // light the viewmodel with the nearest world lamps, in camera space
  const _lp = new THREE.Vector3(), _cq = new THREE.Quaternion();
  WP.updateEnvLights = function (P) {
    const lamps = CF.Level.lamps, cam = this.camera.position;
    let a = null, b = null, sa = 0, sb = 0;
    for (const lp of lamps) {
      if (!lp.on || lp.intensity <= 0) continue;
      const dd = lp.pos.distanceTo(cam); if (dd > lp.distance) continue;
      const s = lp.intensity * Math.pow(1 - dd / lp.distance, 2) * (lp.fl || 1);
      if (s > sa) { b = a; sb = sa; a = lp; sa = s; } else if (s > sb) { b = lp; sb = s; }
    }
    _cq.copy(this.camera.quaternion).invert();
    [[a, sa], [b, sb]].forEach((pair, i) => {
      const l = this.envL[i], lp = pair[0];
      if (!lp) { l.intensity = 0; return; }
      _lp.copy(lp.pos).sub(cam).normalize().applyQuaternion(_cq);
      l.position.copy(_lp); l.target.position.set(0, 0, 0);
      l.color.copy(lp.color); l.intensity = Math.min(0.9, pair[1] * 0.32);
    });
  };

  WP.onLand = function (impact) { this.sp.land.kick(Math.min(0.5, impact * 0.05)); };
})(window.CF);
