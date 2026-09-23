'use strict';
/* Cinderfall — boot, scene, main loop, menus, pickups, interactables, explosions, scoring, checkpoints. */
(function (CF) {
  const U = CF.U, W = CF.World, L = CF.Level, A = CF.Audio;
  const $ = (id) => document.getElementById(id);
  const newStats = () => ({ shots: 0, hits: 0, headHits: 0, headshots: 0, kills: 0, damageDealt: 0, damageTaken: 0, deaths: 0, time: 0 });
  const G = CF.Game = {
    state: 'loading', camera: null, scene: null, vmScene: null, vmCam: null, moon: null,
    stats: newStats(), score: 0, godMode: false, debugGod: false, timeScale: 1, slow: null, last: 0,
    screen: 'loading', backTo: 'main', menuT: 0, deathT: 0, winT: 0, winShown: false, cp: null,
    pending: [], lastKill: -99, multi: 0, lockEverWorked: false, awaitLock: false, audioOn: false,
    fpsN: 0, fpsT: 0, lastFov: 0, holdLoop: null, inside: false, errOnce: false
  };
  const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _c = new THREE.Vector3();
  const MOON = new THREE.Vector3(0.4, 0.55, -0.73).normalize();
  const FOG = new THREE.Color(0.02, 0.026, 0.04);

  function progress(k, label) {
    $('loadFill').style.width = (U.clamp(k, 0, 1) * 100).toFixed(1) + '%';
    if (label) $('loadStatus').textContent = label;
  }
  function fatal(msg) {
    const f = $('fatal'); f.hidden = false; f.textContent = '';
    const box = document.createElement('div'); box.style.maxWidth = '52ch';
    const h = document.createElement('h2'); h.textContent = 'Cinderfall can’t start';
    h.style.cssText = 'margin:0 0 12px;font:800 40px/1 var(--f-display);text-transform:uppercase;letter-spacing:.04em';
    const p = document.createElement('p'); p.textContent = msg; p.style.margin = '0';
    box.append(h, p); f.appendChild(box);
  }

  // ------------------------------------------------------------ boot
  G.boot = async function () {
    try {
      const canvas = $('view');
      CF.Input.init(canvas);
      if (!CF.Post.init(canvas)) { fatal('This browser could not create a WebGL context. Turn on hardware acceleration, or open the game in a current desktop version of Chrome, Edge, Firefox or Safari.'); return; }
      progress(0.03, 'Initializing renderer'); await U.nextFrame();
      await CF.Tex.build(CF.Post.renderer, (k, label) => progress(0.05 + k * 0.5, label));
      progress(0.58, 'Raising the foundry'); await U.nextFrame();
      this.buildScene();
      progress(0.8, 'Wiring the security grid'); await U.nextFrame();
      this.buildSystems();
      progress(0.9, 'Compiling shaders'); await U.nextFrame();
      this.warmup();
      progress(1, 'Ready'); await U.nextFrame();
      this.bindUI();
      this.toMenu();
      this.last = performance.now();
      this.loopBound = this.loop.bind(this);
      requestAnimationFrame(this.loopBound);
    } catch (e) {
      console.error(e);
      fatal('Loading failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  G.buildScene = function () {
    const q = CF.bootQuality, r = CF.Post.renderer;
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(FOG.clone(), 0.0155);
    const cam = this.camera = new THREE.PerspectiveCamera(CF.settings.fov, window.innerWidth / window.innerHeight, 0.05, 1200);
    scene.add(new THREE.HemisphereLight(0x46587a, 0x1d1712, 0.62));
    const moon = this.moon = new THREE.DirectionalLight(0xa4bbe6, 0.62);
    moon.castShadow = q !== 'low';
    const ms = q === 'high' ? 2048 : 1024;
    moon.shadow.mapSize.set(ms, ms);
    const sc = moon.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 190;
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.045;
    scene.add(moon); scene.add(moon.target);
    W.reset({ minX: -64, maxX: 64, minZ: -56, maxZ: 56 });
    L.init(scene, r);
    CF.Map.build();
    W.build();
    L.finish();
    W.buildNav();
    L.buildSky(MOON);
    L.buildEnv(r);
    L.buildSkyline();
    this.vmScene = new THREE.Scene();
    this.vmScene.environment = scene.environment;
    this.vmCam = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.01, 10);
  };

  G.buildSystems = function () {
    const cam = this.camera;
    CF.FX.init(this.scene, cam);
    CF.FX.setFog(0.0155, FOG);
    CF.FX.resize(CF.Post.H, cam.fov);
    CF.Weapons.init(this.vmScene, this.vmCam, this.scene, cam);
    CF.Enemies.init(this.scene);
    CF.Player.init(cam);
    CF.HUD.init();
    for (const p of L.pickups) this.makePickupMesh(p);
    A.occlusion = (pos) => !W.segmentClear(cam.position.x, cam.position.y, cam.position.z, pos.x, pos.y + 0.3, pos.z);
  };

  /** Compile every shader up front so the first fight does not hitch. */
  G.warmup = function () {
    const r = CF.Post.renderer, cam = this.camera;
    cam.position.set(0, 3, 32); cam.lookAt(0, 2, 20); cam.updateMatrixWorld();
    const temps = [];
    ['sentry', 'stalker', 'hornet', 'juggernaut'].forEach((t, i) => CF.Enemies.spawn(t, -4 + i * 2.6, 24, { yaw: 0 }));
    const boss = new CF.Boss(0, 0, 14); boss.root.position.set(0, 0, 12); temps.push(boss.root);
    const nade = CF.VM.grenadeWorld(); nade.position.set(0, 2, 27); this.scene.add(nade); temps.push(nade);
    const rocket = new THREE.Mesh(CF.Enemies.rocketGeo, CF.Enemies.rocketMat); rocket.position.set(1, 2, 27); this.scene.add(rocket); temps.push(rocket);
    const mk = CF.FX.marker(new THREE.Vector3(0, 0, 26), 1, [1, 0.2, 0.1]);
    CF.FX.ring(new THREE.Vector3(0, 0.1, 26), 2, 0.05, [1, 1, 1]);
    for (const id of CF.Weapons.order) CF.Weapons.vm[id].root.visible = true;
    CF.Weapons.gArm.visible = true; CF.Weapons.flash.visible = true;
    try { r.compile(this.scene, cam); r.compile(this.vmScene, this.vmCam); } catch (e) { /* compile is best-effort */ }
    CF.Post.render(this.scene, cam, this.vmScene, this.vmCam);
    CF.Enemies.clear();
    for (const o of temps) this.scene.remove(o);
    CF.FX.removeMarker(mk);
    for (const id of CF.Weapons.order) CF.Weapons.vm[id].root.visible = false;
    CF.Weapons.gArm.visible = false; CF.Weapons.flash.visible = false;
  };

  // ------------------------------------------------------------ UI
  G.showScreen = function (id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== 'screen-' + id;
    this.screen = id;
  };
  G.bindUI = function () {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act], [data-diff]');
      if (!b) return;
      this.initAudio();
      A.play('uiClick', null, { ui: true });
      if (b.dataset.diff) { CF.settings.difficulty = b.dataset.diff; CF.saveSettings(); this.startMission(); return; }
      this.act(b.dataset.act);
    });
    document.addEventListener('pointerdown', () => { if (!this.audioOn && this.state === 'menu') this.initAudio(); });
    document.addEventListener('mouseover', (e) => {
      const b = e.target.closest ? e.target.closest('button') : null;
      if (b && b !== this.hoverEl) { this.hoverEl = b; if (this.audioOn) A.play('uiHover', null, { ui: true }); }
    });
    const S = CF.settings, pct = (v) => Math.round(v * 100) + '%';
    const ranges = [['setSens', 'sens', (v) => v.toFixed(2) + '×'], ['setAds', 'adsSens', (v) => v.toFixed(2) + '×'], ['setFov', 'fov', (v) => Math.round(v) + '°'],
      ['setShake', 'shake', pct], ['setMaster', 'master', pct], ['setMusic', 'music', pct], ['setSfx', 'sfx', pct]];
    for (const [id, key, fmt] of ranges) {
      const el = $(id), out = $('out' + id.slice(3));
      el.value = S[key]; out.textContent = fmt(+S[key]);
      el.addEventListener('input', () => { S[key] = parseFloat(el.value); out.textContent = fmt(S[key]); CF.saveSettings(); A.applyVolumes(); });
    }
    for (const [id, key] of [['setInvert', 'invertY'], ['setFps', 'showFps'], ['setDmgNum', 'dmgNumbers']]) {
      const el = $(id); el.checked = !!S[key];
      el.addEventListener('change', () => { S[key] = el.checked; CF.saveSettings(); });
    }
    const q = $('setQuality'), note = () => { $('qualityNote').hidden = S.quality === CF.bootQuality; };
    q.value = S.quality; note();
    q.addEventListener('change', () => { S.quality = q.value; CF.saveSettings(); note(); });
    $('relock').addEventListener('click', () => CF.Input.requestLock());
    CF.Input.onLockChange = (locked, was) => {
      if (locked) { this.lockEverWorked = true; $('relock').hidden = true; if (this.awaitLock) this.unpause(); CF.Input.clearAll(); }
      else if (was && this.state === 'playing') this.pause();
    };
    CF.Input.onLockError = () => {
      if (this.state === 'menu' || this.state === 'loading') return;
      if (this.lockEverWorked) { $('relock').hidden = false; }
      else {
        CF.Input.freeLook = true;
        if (this.awaitLock || this.state === 'paused') this.unpause();
        CF.HUD.popup('Mouse capture unavailable · aim with the cursor', 0, '');
      }
    };
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (this.state === 'playing' && (CF.Input.freeLook || e.code === 'KeyP')) { CF.Input.exitLock(); this.pause(); }
      else if (e.code === 'Escape' && (this.screen === 'settings' || this.screen === 'manual' || this.screen === 'difficulty')) this.back();
    });
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') { CF.Input.exitLock(); this.pause(); } });
    if (CF.isTouch()) $('touchNote').hidden = false;
  };
  G.act = function (a) {
    switch (a) {
      case 'deploy': this.backTo = 'main'; this.showScreen('difficulty'); break;
      case 'settings': this.backTo = this.screen; this.showScreen('settings'); break;
      case 'manual': this.backTo = this.screen; this.showScreen('manual'); break;
      case 'back': this.back(); break;
      case 'resume': this.resume(); break;
      case 'restart': this.restoreCheckpoint(); break;
      case 'quit': this.toMenu(); break;
      case 'replay': this.startMission(); break;
    }
  };
  G.back = function () {
    this.showScreen(this.backTo || 'main');
    this.backTo = this.state === 'paused' ? 'pause' : 'main';
  };
  G.onResize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCam.aspect = w / h; this.vmCam.updateProjectionMatrix();
    CF.Post.resize();
    CF.FX.resize(CF.Post.H, this.camera.fov);
  };

  G.initAudio = function () {
    if (this.audioOn) { A.resume(); return; }
    A.init();
    if (!A.ready) return;
    this.audioOn = true;
    A.startAmbience();
    this.lava = A.loop('lava', { x: 0, y: 0.5, z: -30 });
    if (this.lava) this.lava.set(0.6, 1);
    CF.Music.start(this.state === 'menu' ? 'menu' : 'game');
  };

  // ------------------------------------------------------------ flow
  G.toMenu = function () {
    this.state = 'menu';
    CF.Input.active = false; CF.Input.exitLock(); CF.Input.freeLook = false; CF.Input.clearAll();
    CF.Enemies.clear(); CF.FX.reset(); CF.HUD.reset(); CF.HUD.show(false);
    this.stopHold(); this.pending.length = 0;
    $('relock').hidden = true;
    this.showScreen('main');
    A.setPaused(false);
    if (this.audioOn) { CF.Music.boss = false; CF.Music.start('menu'); }
    CF.Post.setState({ hurt: 0, low: 0, suppress: 0, fade: 1, ca: 0.0022 });
    this.slow = null; this.timeScale = 1;
    for (const id of CF.Weapons.order) CF.Weapons.vm[id].root.visible = false;
  };
  G.startMission = function (noLock) {
    this.initAudio(); A.resume();
    if (this.audioOn) { CF.Music.boss = false; CF.Music.start('game'); CF.Music.setIntensity(0.14); }
    this.newGame();
    this.showScreen(null);
    CF.HUD.show(true);
    CF.Input.active = true; CF.Input.clearAll();
    this.awaitLock = false;
    if (noLock) CF.Input.freeLook = true;
    else if (!CF.Input.freeLook) CF.Input.requestLock();
  };
  G.newGame = function () {
    this.resetLevel();
    CF.Enemies.clear(); CF.FX.reset(); CF.FX.clearDecals(); CF.HUD.reset();
    this.stats = newStats(); this.score = 0; CF.HUD.setScore(0);
    this.pending.length = 0; this.lastKill = -99; this.multi = 0;
    this.godMode = this.debugGod; this.slow = null; this.timeScale = 1;
    CF.time = 0;
    CF.Weapons.reset(null);
    const s = L.points.start;
    CF.Player.spawn(s.x, s.y, s.z, s.yaw, { health: 100, armor: 0 });
    this.state = 'playing';
    CF.Mission.start();
    this.saveCheckpoint(s, true);
    CF.Post.setState({ fade: 1, low: 0, hurt: 0 });
    A.setPaused(false);
  };
  G.resetLevel = function () {
    for (const id in L.doors) { const d = L.doors[id]; if (d.open || !d.col.enabled) L.closeDoor(id); }
    for (const b of L.barrels) {
      if (b.alive) continue;
      b.alive = true; b.hp = 25; b.mesh.visible = true; b.col.enabled = true;
      W.rebuildNavRect(b.pos.x - 1, b.pos.z - 1, b.pos.x + 1, b.pos.z + 1);
    }
    for (const it of L.interactables) {
      it.progress = 0; it.cooldown = 0;
      if (it.type === 'breaker') { it.done = false; it.enabled = false; it.screen.material = L.mats.screenOff; this.setLamp(it.lamp, 'red'); }
      else if (it.type === 'uplink') { it.enabled = false; it.screen.material = L.mats.screenUplink; this.setLamp(it.lamp, 'red'); }
      else if (it.type === 'ammo') { it.enabled = true; this.setLamp(it.lamp, 'green'); }
    }
    for (let i = L.pickups.length - 1; i >= 0; i--) {
      const p = L.pickups[i];
      if (p.dropped) { this.scene.remove(p.mesh); L.pickups.splice(i, 1); }
      else { p.alive = true; p.mesh.visible = true; }
    }
    for (const l of L.points.arenaAlarms) { l.on = false; l.intensity = 0; }
    if (L.points.evacLamp) L.points.evacLamp.on = false;
  };
  G.setLamp = function (lamp, c) {
    if (!lamp) return;
    const C = { green: [0x40ff70, 0.6, 5, 1.3], red: [0xff3020, 8, 0.5, 0.25], amber: [0xffa020, 6, 2.7, 0.35] }[c];
    lamp.color.set(C[0]); lamp.baseCol = new THREE.Color(C[1], C[2], C[3]);
  };

  G.saveCheckpoint = function (spawn, silent) {
    const P = CF.Player;
    this.cp = {
      phase: CF.Mission.idx, spawn: { x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw || 0 },
      armor: P.armor, loadout: CF.Weapons.snapshot(), score: this.score, mission: CF.Mission.saveState()
    };
    if (!silent) CF.HUD.killfeed('Checkpoint reached', '');
  };
  G.restoreCheckpoint = function () {
    const cp = this.cp;
    if (!cp) { this.startMission(); return; }
    this.initAudio();
    CF.Enemies.clear(); CF.FX.reset(); CF.HUD.reset(); this.stopHold();
    this.pending.length = 0;
    for (let i = L.pickups.length - 1; i >= 0; i--) { const p = L.pickups[i]; if (p.dropped) { this.scene.remove(p.mesh); L.pickups.splice(i, 1); } }
    this.score = cp.score; CF.HUD.setScore(this.score);
    this.godMode = this.debugGod; this.slow = null; this.timeScale = 1;
    CF.Weapons.reset(cp.loadout);
    CF.Player.spawn(cp.spawn.x, cp.spawn.y, cp.spawn.z, cp.spawn.yaw, { health: 100, armor: cp.armor });
    this.state = 'playing';
    CF.Mission.restore(cp.mission, cp.phase);
    CF.Post.setState({ fade: 1, low: 0, hurt: 0 });
    A.setPaused(false);
    if (this.audioOn) CF.Music.start('game');
    CF.HUD.show(true);
    this.showScreen(null);
    CF.Input.active = true; CF.Input.clearAll();
    if (!CF.Input.freeLook) CF.Input.requestLock();
  };

  G.pause = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    A.setPaused(true); CF.Input.clearAll(); CF.Input.active = false;
    const ph = CF.Mission.phase;
    $('pauseWhere').textContent = ph ? ph.num + ' · ' + ph.title : 'Paused';
    this.backTo = 'pause';
    this.showScreen('pause');
    this.stopHold();
  };
  G.resume = function () {
    if (this.state !== 'paused') return;
    this.showScreen(null);
    if (CF.Input.freeLook || CF.Input.locked) { this.unpause(); return; }
    this.awaitLock = true;
    CF.Input.requestLock();
  };
  G.unpause = function () {
    this.state = 'playing'; this.awaitLock = false;
    A.setPaused(false); CF.Input.active = true; CF.Input.clearAll();
    $('relock').hidden = true;
    this.showScreen(null);
  };

  G.onPlayerDeath = function (source) {
    if (this.state !== 'playing') return;
    this.state = 'dying'; this.deathT = 0; this.stats.deaths++;
    this.deathCause = source;
    CF.Music.sting('death'); CF.Music.setIntensity(0);
    this.slowMo(0.35, 1.8);
    CF.HUD.interact(null); this.stopHold();
    CF.HUD.setSpread(10, true); CF.HUD.showScope(false);
  };
  G.showDead = function () {
    this.state = 'dead';
    const s = this.deathCause || 'Unknown';
    $('deadCause').textContent = /^(a |an |the |your )/.test(s) ? 'Killed by ' + s : s;
    CF.Input.active = false; CF.Input.exitLock(); CF.Input.clearAll();
    A.setPaused(true);
    this.showScreen('dead');
  };

  G.victory = function () {
    if (this.state !== 'playing') return;
    this.state = 'victory'; this.winT = 0; this.winShown = false;
    this.godMode = true; CF.Player.frozen = true;
    CF.Mission.spawner = null;
    CF.Music.sting('victory'); CF.Music.setIntensity(0.1);
    CF.HUD.flash(0.5); CF.HUD.interact(null); this.stopHold();
    CF.FX.flashLight(CF.Player.body.pos.clone().add(new THREE.Vector3(0, 9, 0)), 0xe8f0ff, 30, 40, 3);
    for (const e of CF.Enemies.list) if (e.alive && !e.boss) { e.noScore = true; this.later(U.rand(0.1, 1.4), () => { if (e.alive) { e.hp = 0; e.die({}); } }); }
  };
  G.showWin = function () {
    this.winShown = true;
    CF.Input.active = false; CF.Input.exitLock();
    CF.HUD.show(false);
    const st = this.stats, acc = st.shots ? st.hits / st.shots : 0, hsr = st.kills ? st.headshots / st.kills : 0;
    const dKey = CF.settings.difficulty;
    let g = acc * 100 * 0.35 + hsr * 100 * 0.25 + Math.max(0, 30 - st.deaths * 8) + (st.time < 900 ? 20 : st.time < 1500 ? 12 : 5) + (dKey === 'elite' ? 10 : dKey === 'recruit' ? -6 : 0);
    const rank = g >= 72 ? 'S' : g >= 58 ? 'A' : g >= 44 ? 'B' : g >= 30 ? 'C' : 'D';
    let best = 0;
    try { best = +localStorage.getItem('cinderfall.best.' + dKey) || 0; if (this.score > best) { localStorage.setItem('cinderfall.best.' + dKey, String(this.score)); } } catch (e) { /* storage unavailable */ }
    const newBest = this.score > best;
    const rows = [
      ['Score', this.score.toLocaleString('en-US') + (newBest ? ' · new best' : '')], ['Time', U.fmtTime(st.time)],
      ['Kills', st.kills], ['Headshot kills', st.headshots], ['Accuracy', Math.round(acc * 100) + '%'], ['Deaths', st.deaths],
      ['Damage dealt', Math.round(st.damageDealt).toLocaleString('en-US')], ['Damage taken', Math.round(st.damageTaken).toLocaleString('en-US')],
      ['Difficulty', CF.diff().label], ['Best score', Math.max(best, this.score).toLocaleString('en-US')]
    ];
    const list = $('statsList'); list.textContent = '';
    for (const [k, v] of rows) {
      const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = k; dd.textContent = v; d.append(dt, dd); list.appendChild(d);
    }
    $('gradeVal').textContent = rank;
    this.showScreen('win');
  };

  G.slowMo = function (scale, dur) { this.slow = { scale, dur, t: 0 }; this.timeScale = scale; };
  G.addScore = function (n) { this.score += Math.round(n); CF.HUD.setScore(this.score); };
  G.later = function (t, fn) { this.pending.push({ t, fn }); };
  G.updatePending = function (dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]; p.t -= dt;
      if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); }
    }
  };

  // ------------------------------------------------------------ combat hooks
  G.onEnemyKilled = function (e, info, head) {
    if (e.noScore) return;
    const st = this.stats; st.kills++; if (head) st.headshots++;
    const pts = Math.round((e.T.score || 100) * CF.diff().score);
    this.addScore(pts + (head ? 50 : 0));
    const how = head ? 'Headshot' : info && info.explosive ? 'Explosive' : info && info.melee ? 'Melee' : '';
    CF.HUD.popup(e.name + (how ? ' · ' + how.toLowerCase() : ''), pts + (head ? 50 : 0), head ? 'head' : '');
    CF.HUD.killfeed(e.name + ' destroyed', how);
    A.play('kill', null, { ui: true, delay: 0.04 });
    const now = CF.time;
    this.multi = now - this.lastKill < 2.4 ? this.multi + 1 : 1; this.lastKill = now;
    if (this.multi === 2) { CF.HUD.popup('Double kill', 100); this.addScore(100); }
    else if (this.multi === 3) { CF.HUD.popup('Triple kill', 250); this.addScore(250); }
    else if (this.multi >= 4) { CF.HUD.popup('Rampage', 400); this.addScore(400); }
    const r = Math.random();
    if (r < 0.38) this.drop('ammo', e);
    else if (r < 0.5) this.drop('armor', e, { amount: 20 });
    CF.Mission.onKill(e);
  };
  G.onBossKilled = function (boss) { this.stats.kills++; CF.Mission.onBossKilled(boss); };

  G.explode = function (pos, o) {
    o = o || {};
    const R = o.radius || 5, D = o.damage || 100, src = o.source || 'player';
    const at = new THREE.Vector3(pos.x, pos.y, pos.z);
    if (!o.noFx) CF.FX.explosion(at, o.scale || R / 5.5);
    for (const e of CF.Enemies.list.slice()) {
      if (!e.alive || e.spawnT < 1) continue;
      if (e.boss) { e.explosionDamage(at, R, D); continue; }
      e.center(_c);
      const d = _c.distanceTo(at);
      if (d > R + e.T.radius) continue;
      if (!W.segmentClear(at.x, at.y + 0.2, at.z, _c.x, _c.y, _c.z)) continue;
      const k = U.clamp(1 - Math.max(0, d - e.T.radius) / R, 0, 1);
      const dir = _c.clone().sub(at); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
      e.damage(D * k * (src === 'enemy' ? 0.5 : 1), { dir, point: _c.clone(), normal: dir.clone().negate(), part: null, weapon: null, source: src === 'enemy' ? 'enemy' : 'player', knock: 8 * k, explosive: true });
    }
    for (const b of L.barrels) if (b.alive && b.pos.distanceTo(at) < R * 0.85) this.later(U.rand(0.1, 0.22), () => this.damageBarrel(b, 999));
    const P = CF.Player;
    if (P.alive) {
      P.chestPos(_c);
      const d = _c.distanceTo(at);
      const clear = W.segmentClear(at.x, at.y + 0.2, at.z, _c.x, _c.y, _c.z) || W.segmentClear(at.x, at.y + 0.2, at.z, _c.x, P.body.pos.y + 0.3, _c.z);
      if (d < R + 0.5 && clear) {
        const k = U.clamp(1 - d / (R + 0.5), 0, 1), self = src === 'player';
        P.damage(D * k * (self ? 0.5 : 1) / (self ? CF.diff().dmg : 1), at, o.killer || (self ? 'your own explosive' : 'an explosion'), 'explosion');
        _v.subVectors(_c, at).setY(0); if (_v.lengthSq() > 1e-6) _v.normalize();
        P.body.vel.x += _v.x * 9 * k; P.body.vel.z += _v.z * 9 * k; P.body.vel.y += 3.5 * k; P.body.grounded = false;
      }
      P.shake(U.clamp(1 - d / (R * 4), 0, 1) * (o.shake || 0.8));
      if (d < R * 2) A.concuss(0.25 * (1 - d / (R * 2)));
    }
    CF.Enemies.noise(at, 50);
  };
  G.damageBarrel = function (b, dmg) {
    if (!b.alive) return;
    b.hp -= dmg;
    if (b.hp > 0) { CF.FX.sparks(b.pos.x, b.pos.y + 0.3, b.pos.z, 0, 1, 0, 4, 3); return; }
    b.alive = false; b.mesh.visible = false; b.col.enabled = false;
    W.rebuildNavRect(b.pos.x - 1, b.pos.z - 1, b.pos.x + 1, b.pos.z + 1);
    this.explode(b.pos, { radius: 5.5, damage: 130, source: 'player', killer: 'an exploding barrel', scale: 1.1 });
  };

  // ------------------------------------------------------------ pickups
  G.makePickupMesh = function (p) {
    const T = CF.Tex.list;
    const M = this.pickMats || (this.pickMats = {
      plate: new THREE.MeshStandardMaterial({ color: 0x3a4a58, metalness: 0.6, roughness: 0.35 }),
      plateGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 4) }),
      ammo: new THREE.MeshStandardMaterial({ color: 0x3b5739, metalness: 0.4, roughness: 0.6 }),
      ammoGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 2.2, 0.4) }),
      ring: (r, g, b) => new THREE.MeshBasicMaterial({ map: T.ring, color: new THREE.Color(r, g, b), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    });
    if (!M.rings) M.rings = { weapon: M.ring(2.4, 1.2, 0.3), armor: M.ring(0.4, 1.4, 2.4), ammo: M.ring(0.5, 2, 0.6) };
    const box = L.geo('box');
    const g = new THREE.Group(), item = new THREE.Group(); g.add(item);
    if (p.type === 'weapon') { const v = CF.VM.build(p.data.weapon, false); v.root.scale.setScalar(1.3); v.root.position.z = 0.25; item.add(v.root); }
    else if (p.type === 'armor') {
      const s = (p.data.amount || 50) < 50 ? 0.7 : 1;
      const a = new THREE.Mesh(box, M.plate); a.scale.set(0.44 * s, 0.52 * s, 0.07 * s); item.add(a);
      const b = new THREE.Mesh(box, M.plateGlow); b.scale.set(0.3 * s, 0.05 * s, 0.075 * s); b.position.y = 0.1 * s; item.add(b);
      const c = new THREE.Mesh(box, M.plateGlow); c.scale.set(0.3 * s, 0.05 * s, 0.075 * s); c.position.y = -0.06 * s; item.add(c);
    } else {
      const a = new THREE.Mesh(box, M.ammo); a.scale.set(0.38, 0.22, 0.26); item.add(a);
      const b = new THREE.Mesh(box, M.ammoGlow); b.scale.set(0.39, 0.04, 0.265); item.add(b);
    }
    item.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    item.position.y = 0.6;
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), M.rings[p.type] || M.rings.ammo);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; ring.renderOrder = 4; g.add(ring);
    g.position.copy(p.pos); this.scene.add(g);
    p.mesh = g; p.item = item; p.ring = ring;
  };
  G.drop = function (type, e, data) {
    const c = e.body.pos;
    let y = W.navHeight(c.x, c.z);
    if (isNaN(y)) y = W.groundHeight(c.x, c.y + 1, c.z);
    const p = L.addPickup(type, c.x, y, c.z, data || {});
    p.dropped = true; p.expire = 30;
    this.makePickupMesh(p);
  };
  G.collect = function (p) {
    const P = CF.Player, WP = CF.Weapons;
    if (p.type === 'weapon') {
      const id = p.data.weapon, had = !!WP.inv[id], ok = WP.give(id);
      if (!had) {
        A.play('weaponGet', null, { ui: true });
        CF.HUD.popup('Picked up ' + WP.defs[id].name, 0, 'obj');
        CF.HUD.killfeed(WP.defs[id].name + ' acquired', 'Key ' + (WP.order.indexOf(id) + 1));
      } else if (ok) A.play('ammo', null, { ui: true });
      return !had || ok;
    }
    if (p.type === 'armor') {
      if (P.armor >= 100) return false;
      const amt = p.data.amount || 50;
      P.heal(0, amt); A.play('armor', null, { ui: true }); CF.HUD.popup('+' + amt + ' armor', 0, '');
      return true;
    }
    WP.addAmmoFraction(0.6);
    if (WP.grenades < WP.maxGrenades && Math.random() < 0.3) { WP.grenades++; CF.HUD.setGrenades(WP.grenades, WP.maxGrenades); }
    A.play('ammo', null, { ui: true }); CF.HUD.popup('Ammo', 0, '');
    return true;
  };
  G.updatePickups = function (dt) {
    const P = CF.Player;
    for (let i = L.pickups.length - 1; i >= 0; i--) {
      const p = L.pickups[i];
      if (!p.alive || !p.mesh) continue;
      p.t += dt;
      p.item.rotation.y += dt * 1.3;
      p.item.position.y = 0.6 + Math.sin(p.t * 2.2) * 0.07;
      if (p.expire != null) {
        p.expire -= dt;
        if (p.expire < 5) p.mesh.visible = Math.sin(p.t * 18) > -0.2;
        if (p.expire <= 0) { this.scene.remove(p.mesh); L.pickups.splice(i, 1); continue; }
      }
      if (this.state !== 'playing' || !P.alive) continue;
      const dx = P.body.pos.x - p.pos.x, dz = P.body.pos.z - p.pos.z, dy = P.body.pos.y - p.pos.y;
      if (dx * dx + dz * dz > 1.35 * 1.35 || Math.abs(dy) > 1.6) continue;
      if (this.collect(p)) {
        p.alive = false; p.mesh.visible = false;
        if (p.dropped) { this.scene.remove(p.mesh); L.pickups.splice(i, 1); }
      }
    }
  };

  // ------------------------------------------------------------ interactables
  G.startHold = function (it) {
    if (!this.holdLoop && this.audioOn) { this.holdLoop = A.loop('hum', it.pos); if (this.holdLoop) this.holdLoop.set(0.12); }
    if (this.holdLoop) this.holdLoop.pitch(60 + it.progress * 170);
  };
  G.stopHold = function () { if (this.holdLoop) { this.holdLoop.stop(); this.holdLoop = null; } };
  G.updateInteract = function (dt) {
    const P = CF.Player, inp = CF.Input;
    for (const it of L.interactables) {
      if (it.cooldown > 0) { it.cooldown -= dt; if (it.cooldown <= 0 && it.type === 'ammo') this.setLamp(it.lamp, 'green'); }
    }
    if (!P.alive) { CF.HUD.interact(null); this.stopHold(); return; }
    P.forward(_f);
    let best = null, bd = Infinity;
    for (const it of L.interactables) {
      if (!it.enabled) continue;
      const dx = it.pos.x - P.body.pos.x, dz = it.pos.z - P.body.pos.z, d = Math.hypot(dx, dz);
      if (d > it.radius || Math.abs(it.pos.y - P.body.pos.y) > 1.6) continue;
      const f = it.face || [0, 1];
      const tx = it.pos.x - f[0] * 1.2 - P.body.pos.x, tz = it.pos.z - f[1] * 1.2 - P.body.pos.z, tl = Math.hypot(tx, tz) || 1;
      if ((tx * _f.x + tz * _f.z) / tl < 0.3) continue;
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) { CF.HUD.interact(null); this.stopHold(); return; }
    if (best.type === 'ammo' && best.cooldown > 0) { CF.HUD.interact('Resupply in ' + Math.ceil(best.cooldown) + ' s', 0); this.stopHold(); return; }
    if (best.hold > 0) {
      if (inp.down('KeyE')) { best.progress += dt / best.hold; this.startHold(best); }
      else { best.progress = Math.max(0, best.progress - dt * 1.5); this.stopHold(); }
      CF.HUD.interact(best.prompt, best.progress);
      if (best.progress >= 1) { best.progress = 0; this.stopHold(); this.useInteract(best); }
    } else {
      CF.HUD.interact(best.prompt, 0);
      if (inp.hit('KeyE')) this.useInteract(best);
    }
  };
  G.useInteract = function (it) {
    if (it.type === 'breaker') {
      it.done = true; it.enabled = false; it.screen.material = L.mats.screenOn; this.setLamp(it.lamp, 'green');
      A.play('breakerOn', it.pos, { ref: 6 }); CF.Player.shake(0.12);
      CF.Mission.onBreaker(it);
    } else if (it.type === 'uplink') {
      it.enabled = false; A.play('breakerOn', it.pos, { ref: 6 });
      CF.Mission.onUplinkStart(it);
    } else if (it.type === 'ammo') {
      if (CF.Weapons.resupply()) { A.play('ammo', null, { ui: true }); CF.HUD.popup('Resupplied', 0, ''); it.cooldown = it.cooldownMax; this.setLamp(it.lamp, 'amber'); }
      else CF.HUD.hint('Ammunition already full');
    }
  };

  // ------------------------------------------------------------ frame
  G.updateMoon = function (c) {
    const snap = 84 / this.moon.shadow.mapSize.x;
    const tx = Math.round(c.x / snap) * snap, tz = Math.round(c.z / snap) * snap;
    this.moon.target.position.set(tx, 0, tz);
    this.moon.position.set(tx + MOON.x * 90, MOON.y * 90, tz + MOON.z * 90);
    this.moon.target.updateMatrixWorld();
  };
  G.updateMenu = function (raw) {
    this.menuT += raw; CF.time += raw;
    const cam = this.camera, t = this.menuT * 0.04 + 2.2;
    cam.position.set(Math.sin(t) * 30, 8 + Math.sin(t * 1.7) * 1.2, 15 + Math.cos(t) * 17);
    cam.lookAt(Math.sin(t + 0.6) * 6, 4.2, -8);
    if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    L.update(raw, CF.time, cam.position);
    CF.FX.update(raw, cam.position);
    this.updateMoon(cam.position);
    A.update(raw, cam);
  };
  G.updateGame = function (dt, raw) {
    const P = CF.Player, cam = this.camera, playing = this.state === 'playing';
    CF.time += dt;
    if (playing) this.stats.time += dt;
    P.update(dt);
    if (P.alive && playing) CF.Weapons.update(dt, P);
    else if (P.alive) CF.Weapons.animate(dt, P);
    CF.Enemies.update(dt, P);
    if (playing) CF.Mission.update(dt);
    this.updatePending(dt);
    if (playing) this.updateInteract(dt);
    this.updatePickups(dt);
    L.update(dt, CF.time, cam.position);
    CF.FX.update(dt, cam.position);
    this.updateMoon(P.body.pos);
    A.update(raw, cam);
    const p = P.body.pos;
    const inside = (p.x > -29.2 && p.x < 29.2 && p.z > -41.2 && p.z < -8.8) || (p.x > 42 && p.x < 54 && p.z > 8 && p.z < 20) || (p.x > -54 && p.x < -42 && p.z > 4 && p.z < 16);
    if (inside !== this.inside) { this.inside = inside; A.setRoom(inside ? 0.65 : 0.25); }
    cam.getWorldDirection(_f);
    const wh = W.raycast(cam.position.x, cam.position.y, cam.position.z, _f.x, _f.y, _f.z, 150);
    const eh = CF.Enemies.raycast(cam.position, _f, wh ? wh.t : 150);
    CF.Enemies.aimed = !!(eh && eh.enemy.alive);
    CF.HUD.update(raw, cam, P);
    const H = CF.HUD, low = P.alive ? U.clamp(1 - P.health / 35, 0, 1) : 1;
    CF.Post.setState({ hurt: H.hurtV, low, suppress: H.suppressV, ca: 0.0022 + A.concussion * 0.012 + H.hurtV * 0.006 });
    if (this.state === 'dying') {
      this.deathT += raw;
      CF.Post.setState({ fade: Math.max(0.3, 1 - this.deathT * 0.3) });
      if (this.deathT > 2.6) this.showDead();
    } else if (this.state === 'victory') {
      this.winT += raw;
      CF.Post.setState({ fade: Math.max(0, 1 - Math.max(0, this.winT - 1.8) / 2) });
      if (this.winT > 4 && !this.winShown) this.showWin();
    }
  };
  G.loop = function (now) {
    requestAnimationFrame(this.loopBound);
    let raw = (now - this.last) / 1000; this.last = now;
    if (!(raw > 0)) raw = 0;
    raw = Math.min(raw, 0.1);
    CF.realTime += raw;
    if (this.slow) {
      this.slow.t += raw;
      const k = Math.min(1, this.slow.t / this.slow.dur);
      this.timeScale = U.lerp(this.slow.scale, 1, k * k);
      if (k >= 1) { this.slow = null; this.timeScale = 1; }
    }
    const dt = Math.min(raw, 0.05) * this.timeScale, st = this.state;
    if (window.innerWidth !== this.vw || window.innerHeight !== this.vh) { this.vw = window.innerWidth; this.vh = window.innerHeight; this.onResize(); }
    try {
      if (st === 'menu') this.updateMenu(raw);
      else if (st === 'playing' || st === 'dying' || st === 'victory') this.updateGame(dt, raw);
      else A.update(raw, this.camera);
      const cam = this.camera;
      if (cam.fov !== this.lastFov) { this.lastFov = cam.fov; CF.FX.resize(CF.Post.H, cam.fov); }
      const showVM = (st === 'playing' || st === 'paused' || st === 'victory') && CF.Player.alive;
      CF.Post.render(this.scene, cam, showVM ? this.vmScene : null, this.vmCam);
      if (st === 'playing' || st === 'menu') CF.Post.adapt(raw);
    } catch (e) {
      if (!this.errOnce) { this.errOnce = true; console.error(e); }
    }
    this.fpsN++; this.fpsT += raw;
    if (this.fpsT >= 0.5) { CF.HUD.fps(Math.round(this.fpsN / this.fpsT)); this.fpsN = 0; this.fpsT = 0; }
    CF.Input.endFrame();
  };

  // ------------------------------------------------------------ debug hooks (console)
  CF.debug = {
    start: (diff) => { CF.settings.difficulty = diff || CF.settings.difficulty; G.startMission(true); return G.state; },
    god: (v) => { G.debugGod = v !== undefined ? !!v : !G.debugGod; G.godMode = G.debugGod; return G.debugGod; },
    skip: (i) => { CF.Mission.skipTo(i); return CF.Mission.phase.id; },
    tp: (x, y, z, yaw) => { const b = CF.Player.body; b.pos.set(x, y, z); b.vel.set(0, 0, 0); if (yaw != null) CF.Player.yaw = yaw; },
    give: () => { for (const id of CF.Weapons.order) CF.Weapons.give(id, true); CF.Weapons.hudAmmo(); },
    kill: () => { for (const e of CF.Enemies.list) if (e.alive && !e.boss) { e.hp = 0; e.die({}); } },
    info: () => ({ state: G.state, phase: CF.Mission.phase && CF.Mission.phase.id, pos: CF.Player.body.pos.toArray().map((v) => +v.toFixed(2)), hp: Math.round(CF.Player.health), armor: Math.round(CF.Player.armor), enemies: CF.Enemies.alive(), score: G.score, weapon: CF.Weapons.curId, scale: CF.Post.effScale })
  };

  G.boot();
})(window.CF);
