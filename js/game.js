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
    fpsN: 0, fpsT: 0, lastFov: 0, holdLoop: null, inside: false, errOnce: false,
    mode: 'campaign', mapId: null, mapDef: null, rain: null, traffic: null, mpLobby: false, mpSel: { map: 'market', mode: 'ffa' }
  };
  const RESPAWN = 3.5;
  const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _c = new THREE.Vector3();

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
      this.buildSystems();
      await this.loadMap('foundry', (k, label) => progress(0.58 + k * 0.42, label));
      progress(1, 'Ready'); await U.nextFrame();
      this.bindUI();
      CF.Progress.load();
      CF.Profile.init();
      if (CF.Progress.damaged.length) setTimeout(() => CF.Toast('A damaged campaign save was reset', 'error', 'Your coins and skins are not affected.'), 1200);
      this.toMenu();
      this.last = performance.now();
      this.loopBound = this.loop.bind(this);
      requestAnimationFrame(this.loopBound);
    } catch (e) {
      console.error(e);
      fatal('Loading failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  /** Cameras, viewmodels, player and HUD persist across maps. */
  G.buildSystems = function () {
    this.camera = new THREE.PerspectiveCamera(CF.settings.fov, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.01, 10);
    CF.Weapons.init(this.vmScene, this.vmCam, null, this.camera);
    CF.Player.init(this.camera);
    CF.HUD.init();
    const cam = this.camera;
    A.occlusion = (pos) => !W.segmentClear(cam.position.x, cam.position.y, cam.position.z, pos.x, pos.y + 0.3, pos.z);
  };

  /** Build a map and its theme into a fresh scene, replacing whatever was loaded. */
  G.loadMap = async function (id, onProgress) {
    const def = CF.Maps[id];
    if (!def) throw new Error('Unknown map ' + id);
    if (this.mapId === id && this.scene) return;
    const booting = this.state === 'loading';
    const prev = this.state;
    const prog = onProgress || ((k, label) => progress(k, label));
    if (!booting) { this.state = 'loading'; progress(0, ''); this.showScreen('loading'); CF.HUD.show(false); }
    prog(0.05, 'Loading ' + def.name); await U.nextFrame(); await U.nextFrame();
    if (this.scene) {
      if (CF.MapHalden) CF.MapHalden.dispose();
      CF.Enemies.clear(); CF.FX.reset(); CF.FX.clearDecals();
      CF.Weapons.clearLive(); CF.Streak.clear();
      L.dispose();
    }
    CF.Neon.reset(); CF.Frost.clear();
    const th = def.theme, q = CF.bootQuality, r = CF.Post.renderer;
    const scene = this.scene = new THREE.Scene();
    const fog = new THREE.Color(th.fog[0], th.fog[1], th.fog[2]);
    scene.fog = new THREE.FogExp2(fog, th.fogDensity);
    scene.add(new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]));
    const moon = this.moon = new THREE.DirectionalLight(th.moon.color, th.moon.intensity);
    moon.castShadow = q !== 'low';
    const ms = q === 'high' ? 2048 : 1024;
    moon.shadow.mapSize.set(ms, ms);
    const sc = moon.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 190;
    moon.shadow.bias = th.shadowBias != null ? th.shadowBias : -0.0004; moon.shadow.normalBias = th.shadowNormalBias || 0.045;
    scene.add(moon); scene.add(moon.target);
    this.moonDir = new THREE.Vector3(th.moon.dir[0], th.moon.dir[1], th.moon.dir[2]).normalize();
    W.reset(def.bounds);
    L.init(scene, r);
    L.applyTheme(th);
    prog(0.2, 'Raising ' + def.name); await U.nextFrame();
    def.build();
    W.build();
    L.finish();
    if (def.nav) { prog(0.45, 'Mapping patrol routes'); await U.nextFrame(); W.buildNav(); }
    prog(0.6, 'Lighting the skyline'); await U.nextFrame();
    L.buildSky(this.moonDir, th);
    L.buildEnv(r, th);
    L.buildSkyline(th);
    this.vmScene.environment = scene.environment;
    CF.FX.init(scene, this.camera);
    CF.FX.setFog(th.fogDensity, fog);
    CF.FX.resize(CF.Post.H, this.camera.fov);
    CF.FX.emberRate = th.embers || 0;
    CF.Enemies.init(scene);
    CF.Weapons.scene = scene;
    const rc = th.rain && th.rain.count ? Math.round(th.rain.count * (q === 'low' ? 0.5 : 1)) : 0;
    this.rain = rc ? new CF.Neon.Rain(scene, rc, { roofs: th.rain.roofs, bright: th.rainBright, len: 0.6 }) : null;
    this.traffic = th.traffic && th.traffic.count ? new CF.Neon.Traffic(scene, th.traffic.count, th.traffic) : null;
    CF.Post.setState(th.post);
    CF.Frost.setup(this, th);
    for (const p of L.pickups) this.makePickupMesh(p);
    this.mapId = id; this.mapDef = def; this.inside = false;
    prog(0.85, 'Compiling shaders'); await U.nextFrame();
    this.warmup(def);
    this.mapAudio();
    prog(1, 'Ready');
    if (!booting) this.state = prev;
  };

  /** Compile every shader up front so the first fight does not hitch. */
  G.warmup = function (def) {
    const id = def.id;
    const r = CF.Post.renderer, cam = this.camera;
    const s = L.points.start || { x: 0, y: 0, z: 0 };
    cam.position.set(s.x, s.y + 3, s.z + 8); cam.lookAt(s.x, s.y + 1.5, s.z - 4); cam.updateMatrixWorld();
    const temps = [];
    const put = (o, dx, dz) => { o.position.set(s.x + dx, s.y + 0.6, s.z + dz); this.scene.add(o); temps.push(o); };
    if (def.campaign) {
      def.enemies.forEach((t, i) => CF.Enemies.spawn(t, s.x - 4 + i * 2.6, s.z - 6, { yaw: 0, y: s.y }));
      const BossClass = id === 'halden' ? CF.HeartBoss : CF.Boss;
      if (BossClass) { const boss = new BossClass(s.x, s.y, s.z - 14); boss.root.position.set(s.x, s.y, s.z - 16); temps.push(boss.root); if (boss.extra) temps.push(...boss.extra); }
      const rocket = new THREE.Mesh(CF.Enemies.rocketGeo, CF.Enemies.rocketMat); put(rocket, 1, -3);
    }
    if (CF.MP) put(CF.MP.makeModel(), -1, -3);
    put(CF.VM.grenadeWorld(), 0, -3);
    const mk = CF.FX.marker(new THREE.Vector3(s.x, s.y, s.z - 2), 1, [1, 0.2, 0.1]);
    CF.FX.ring(new THREE.Vector3(s.x, s.y + 0.1, s.z - 2), 2, 0.05, [1, 1, 1]);
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

  /** Positional ambience that belongs to the loaded map. */
  G.mapAudio = function () {
    if (!this.audioOn) return;
    if (this.lava) { this.lava.stop(); this.lava = null; }
    if (this.mapId === 'foundry') { this.lava = A.loop('lava', { x: 0, y: 0.5, z: -30 }); if (this.lava) this.lava.set(0.6, 1); }
    if (CF.Frost.th && !CF.Frost.wind) { CF.Frost.wind = A.loop('blizzard'); }
    A.setAmbience(this.mapDef && this.mapDef.theme.frost ? 'polar' : 'industrial');
    const wet = this.mapDef && this.mapDef.theme.rain && this.mapDef.theme.rain.count;
    if (wet && !this.rainSnd) { this.rainSnd = A.loop('rain'); if (this.rainSnd) this.rainSnd.set(0.16, 2); }
    else if (!wet && this.rainSnd) { this.rainSnd.stop(); this.rainSnd = null; }
  };

  // ------------------------------------------------------------ UI
  /** Styled confirm dialog. Resolves true/false. */
  CF.UI = {
    confirm(title, text, ok, danger) {
      return new Promise((resolve) => {
        const m = $('modal'), okBtn = $('modalOk');
        $('modalTitle').textContent = title; $('modalText').textContent = text; okBtn.textContent = ok || 'OK';
        okBtn.classList.toggle('danger', !!danger);
        m.hidden = false; okBtn.focus();
        const done = (v) => { m.hidden = true; m.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey, true); resolve(v); };
        const onClick = (e) => { const b = e.target.closest('[data-modal]'); if (b) done(b.dataset.modal === 'ok'); else if (e.target === m) done(false); };
        const onKey = (e) => { if (e.code === 'Escape') { e.stopPropagation(); done(false); } };
        m.addEventListener('click', onClick); window.addEventListener('keydown', onKey, true);
      });
    }
  };
  G.newStats = newStats;
  G.showScreen = function (id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== 'screen-' + id;
    this.screen = id;
  };
  G.bindUI = function () {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act], [data-diff], [data-campaign], [data-continue], [data-map], [data-mode], [data-loadout]');
      if (!b || b.disabled) return;
      this.initAudio();
      A.play('uiClick', null, { ui: true });
      if (b.dataset.diff) { CF.settings.difficulty = b.dataset.diff; CF.saveSettings(); this.startMission(); return; }
      if (b.dataset.campaign) { this.newOperation(b.dataset.campaign); return; }
      if (b.dataset.continue) { this.continueMission(b.dataset.continue); return; }
      if (b.dataset.map) { this.mpSel.map = b.dataset.map; this.renderMpPick(); return; }
      if (b.dataset.mode) { this.mpSel.mode = b.dataset.mode; this.renderMpPick(); return; }
      if (b.dataset.loadout) { CF.MP.setLoadout(b.dataset.loadout); this.renderLoadouts(); return; }
      this.act(b.dataset.act);
    });
    document.addEventListener('pointerdown', () => { if (!this.audioOn && this.state === 'menu') this.initAudio(); });
    document.addEventListener('mouseover', (e) => {
      const b = e.target.closest ? e.target.closest('button') : null;
      if (b && b !== this.hoverEl) { this.hoverEl = b; if (this.audioOn) A.play('uiHover', null, { ui: true }); }
    });
    this.bindSettings();
    $('relock').addEventListener('click', () => CF.Input.requestLock());
    CF.Input.onLockChange = (locked, was) => {
      if (locked) { this.lockEverWorked = true; $('relock').hidden = true; if (this.awaitLock) this.unpause(); CF.Input.clearAll(); }
      else if (was && this.mode === 'mp' && (this.state === 'playing' || this.state === 'mpdead')) this.mpOpenMenu();
      else if (was && this.state === 'playing') this.pause();
    };
    CF.Input.onLockError = () => {
      if (this.state === 'menu' || this.state === 'loading' || this.state === 'mpmenu' || this.state === 'mpend') return;
      if (this.lockEverWorked) { $('relock').hidden = false; }
      else {
        CF.Input.freeLook = true;
        if (this.mode !== 'mp' && (this.awaitLock || this.state === 'paused')) this.unpause();
        CF.HUD.popup('Mouse capture unavailable · aim with the cursor', 0, '');
      }
    };
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) { if (e.code === 'Escape') e.target.blur(); return; }
      if (this.mode === 'mp' && (this.state === 'playing' || this.state === 'mpdead') && (CF.Input.freeLook || e.code === 'KeyP')) this.mpOpenMenu();
      else if (this.state === 'playing' && (CF.Input.freeLook || e.code === 'KeyP')) { CF.Input.exitLock(); this.pause(); }
      else if (e.code === 'Escape' && !$('crateOpen').hidden) { if (!CF.Locker.spinning) CF.Locker.closeCrate(); }
      else if (e.code === 'Escape' && (this.screen === 'settings' || this.screen === 'manual' || this.screen === 'difficulty' || this.screen === 'campaign' || this.screen === 'mp' || this.screen === 'leaderboard' || this.screen === 'locker' || this.screen === 'feedback')) this.back();
    });
    $('mpName').addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') e.target.blur(); });
    $('mpName').addEventListener('change', (e) => { CF.MP.saveName(e.target.value); e.target.value = CF.MP.name; });
    for (const id of ['diffName', 'lbName']) {
      $(id).addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') e.target.blur(); });
      $(id).addEventListener('change', (e) => { CF.MP.saveName(e.target.value); e.target.value = CF.MP.name; $('mpName').value = CF.MP.name; if (this.screen === 'leaderboard') CF.Board.open(); });
    }
    $('diffNoDrones').addEventListener('change', (e) => { CF.settings.noDrones = e.target.checked; CF.saveSettings(); });
    $('mpCode').addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.initAudio(); this.act('mpjoin'); } });
    $('mpCode').addEventListener('input', (e) => { const v = CF.Net.cleanCode(e.target.value); if (v !== e.target.value) e.target.value = v; });
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      if (this.mode === 'mp') { if (this.state === 'playing' || this.state === 'mpdead') this.mpOpenMenu(); }
      else if (this.state === 'playing') { CF.Input.exitLock(); this.pause(); }
    });
    this.renderMpPick(); this.renderLoadouts();
    CF.Locker.bind();
    if (CF.isTouch()) $('touchNote').hidden = false;
  };
  G.act = function (a) {
    switch (a) {
      case 'deploy': this.backTo = 'campaign'; $('diffCampaign').textContent = CF.campaign().name; $('diffName').value = CF.MP.name; $('diffNoDrones').checked = CF.settings.noDrones; this.showScreen('difficulty'); break;
      case 'multiplayer': this.openMpScreen(); break;
      case 'mphost': this.mpStart(true); break;
      case 'mpjoin': this.mpStart(false); break;
      case 'mpresume': if (CF.Coop.campaign()) CF.CoopCampaign.deploy(); else this.mpResume(); break;
      case 'mpleave': CF.MP.leave(); break;
      case 'mpagain': CF.MP.hostRestart(); break;
      case 'settings': this.backTo = this.screen; this.syncSettingsUI(); this.settingsTab('controls'); this.showScreen('settings'); break;
      case 'manual': this.backTo = this.screen; this.showScreen('manual'); break;
      case 'feedback': this.backTo = 'main'; this.showScreen('feedback'); CF.Feedback.open(); break;
      case 'leaderboard': this.backTo = this.screen; CF.Board.open(); this.showScreen('leaderboard'); break;
      case 'locker': this.backTo = this.screen === 'locker' ? 'main' : this.screen; this.showScreen('locker'); CF.Locker.open(); break;
      case 'back': this.back(); break;
      case 'resume': this.resume(); break;
      case 'restart': this.restoreCheckpoint(); break;
      case 'quit': if (this.mode !== 'mp' && (this.state === 'paused' || this.state === 'dead')) CF.Board.record(CF.Mission.idx); this.toMenu(); break;
      case 'campaigns': this.backTo = 'main'; this.renderCampaigns(); this.showScreen('campaign'); break;
      case 'resetprogress': this.resetProgress(); break;
      case 'replay': this.startMission(); break;
    }
  };
  /** Campaign picker: one card per campaign with its best local run and, when there is one, the saved run to continue. */
  G.renderCampaigns = function () {
    const el = $('campaignCards'); if (!el) return;
    for (const card of el.querySelectorAll('[data-cc]')) {
      const id = card.dataset.cc, best = CF.Board.bestLocal(id), save = CF.Progress.get(id);
      card.classList.toggle('sel', id === CF.settings.campaign);
      card.querySelector('.cc-best').textContent = best ? 'Your best · ' + best.stage + ' · ' + best.score.toLocaleString('en-US') : save ? 'Run in progress' : 'Not played yet';
      const cont = card.querySelector('[data-continue]');
      cont.hidden = !save;
      if (save) {
        cont.querySelector('.cc-cont-where').textContent = CF.Progress.label(save);
        cont.querySelector('.cc-cont-meta').textContent = CF.DIFF[save.diff].label + (save.noDrones ? ' · No drones' : '') + ' · ' + save.cp.score.toLocaleString('en-US') + ' pts';
      }
      card.querySelector('[data-campaign]').textContent = save ? 'New operation' : 'Start operation';
    }
    $('resetProgress').disabled = !Object.keys(CF.Progress.data.saves).length;
  };
  /** New operation: a saved run for this campaign is replaced, so ask first. */
  G.newOperation = async function (id) {
    const save = CF.Progress.get(id);
    if (save && !(await CF.UI.confirm('Start a new operation?', 'Your saved ' + CF.Campaigns[id].name + ' run (' + CF.Progress.label(save) + ') will be replaced when you reach your first checkpoint.', 'Start new'))) return;
    CF.settings.campaign = id; CF.saveSettings(); CF.Music.setTheme(CF.campaign().music);
    this.act('deploy');
  };
  G.continueMission = function (id) {
    const save = CF.Progress.get(id); if (!save) { this.renderCampaigns(); return; }
    CF.settings.campaign = id; CF.settings.difficulty = save.diff; CF.settings.noDrones = save.noDrones; CF.saveSettings();
    this.startMission(false, save);
  };
  G.resetProgress = async function () {
    if (!(await CF.UI.confirm('Reset campaign progress?', 'Saved runs for both campaigns will be deleted' + (CF.Profile.mode === 'server' ? ', on this device and in the cloud' : '') + '. Coins, skins and leaderboard entries are kept.', 'Reset progress', true))) return;
    CF.Progress.resetAll();
    CF.Toast('Campaign progress reset', 'info');
    this.renderCampaigns();
  };
  G.back = function () {
    this.stopCapture();
    if (this.screen === 'locker') { if (CF.Locker.spinning) return; CF.Locker.close(); }
    this.showScreen(this.backTo || 'main');
    this.backTo = this.state === 'paused' ? 'pause' : this.state === 'mpmenu' ? 'mpmenu' : 'main';
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
    this.mapAudio();
    CF.Music.start(this.state === 'menu' ? 'menu' : 'game');
  };

  // ------------------------------------------------------------ settings page
  const pct = (v) => Math.round(v * 100) + '%';
  const RANGES = [['setSens', 'sens', (v) => v.toFixed(2) + '×'], ['setAds', 'adsSens', (v) => v.toFixed(2) + '×'], ['setFov', 'fov', (v) => Math.round(v) + '°'],
    ['setShake', 'shake', pct], ['setBob', 'viewBob', pct], ['setBright', 'brightness', pct], ['setMaster', 'master', pct], ['setMusic', 'music', pct], ['setSfx', 'sfx', pct]];
  const TOGGLES = [['setInvert', 'invertY'], ['setFps', 'showFps'], ['setDmgNum', 'dmgNumbers'], ['setToggleCrouch', 'toggleCrouch'], ['setToggleSprint', 'toggleSprint'], ['setGrain', 'grain']];
  const SELECTS = [['setAimMode', 'aimMode'], ['setCrosshair', 'crosshair'], ['setQuality', 'quality']];
  const CH_COLORS = { white: '#ffffff', green: '#5dff7a', cyan: '#37f3ff', yellow: '#fcee0a', magenta: '#ff4ae0' };
  G.bindSettings = function () {
    const S = CF.settings;
    const changed = () => { CF.saveSettings(); this.applyPrefs(); };
    for (const [id, key, fmt] of RANGES) {
      const el = $(id), out = $('out' + id.slice(3));
      el.addEventListener('input', () => { S[key] = parseFloat(el.value); out.textContent = fmt(S[key]); changed(); });
    }
    for (const [id, key] of TOGGLES) $(id).addEventListener('change', (e) => { S[key] = e.target.checked; changed(); });
    for (const [id, key] of SELECTS) $(id).addEventListener('change', (e) => { S[key] = e.target.value; changed(); });
    for (const b of document.querySelectorAll('[data-settab]')) b.addEventListener('click', () => this.settingsTab(b.dataset.settab));
    for (const b of document.querySelectorAll('[data-lbtab]')) b.addEventListener('click', () => CF.Board.show(b.dataset.lbtab));
    for (const b of document.querySelectorAll('[data-lbcampaign]')) b.addEventListener('click', () => CF.Board.setCampaign(b.dataset.lbcampaign));
    for (const b of document.querySelectorAll('[data-lbmode]')) b.addEventListener('click', () => CF.Board.setMode(b.dataset.lbmode));
    $('bindReset').addEventListener('click', () => { this.stopCapture(); CF.Keys.reset(); $('bindNote').textContent = 'Key bindings restored to defaults.'; });
    $('settingsReset').addEventListener('click', () => {
      this.stopCapture();
      const binds = CF.Keys.binds, diff = S.difficulty, camp = S.campaign, nd = S.noDrones;
      for (const k in CF.DEFAULTS) S[k] = CF.DEFAULTS[k];
      S.difficulty = diff; S.campaign = camp; S.noDrones = nd; CF.Keys.binds = binds;
      changed(); this.syncSettingsUI();
    });
    CF.onBindsChanged = () => { this.renderBinds(); this.applyKeyLabels(); };
    this.syncSettingsUI(); this.renderBinds(); this.applyPrefs(); this.applyKeyLabels();
  };
  G.syncSettingsUI = function () {
    const S = CF.settings;
    for (const [id, key, fmt] of RANGES) { $(id).value = S[key]; $('out' + id.slice(3)).textContent = fmt(+S[key]); }
    for (const [id, key] of TOGGLES) $(id).checked = !!S[key];
    for (const [id, key] of SELECTS) $(id).value = S[key];
  };
  G.settingsTab = function (tab) {
    this.stopCapture();
    for (const b of document.querySelectorAll('[data-settab]')) b.setAttribute('aria-selected', String(b.dataset.settab === tab));
    for (const f of document.querySelectorAll('[data-setpanel]')) f.hidden = f.dataset.setpanel !== tab;
  };
  /** Settings that take effect immediately. */
  G.applyPrefs = function () {
    const S = CF.settings;
    A.applyVolumes();
    CF.Post.applyPrefs();
    $('crosshair').style.setProperty('--ch-color', CH_COLORS[S.crosshair] || '#fff');
    $('qualityNote').hidden = S.quality === CF.bootQuality;
  };
  G.applyKeyLabels = function () {
    $('interactKey').textContent = CF.Keys.label('interact');
    const W = CF.Weapons;
    if (W.cur) CF.HUD.setWeapon(W.cur.def, W.inv, W.slots());
    if (this.renderLoadouts && CF.MP) this.renderLoadouts();
  };
  G.renderBinds = function () {
    const list = $('bindList'); if (!list) return;
    list.textContent = '';
    const fixed = [['Fire', 'Left mouse'], ['Aim (hold)', 'Right mouse'], ['Pause · menu', 'Esc · P']];
    for (const a of CF.Keys.actions) {
      const row = document.createElement('div'); row.className = 'bind-row';
      const l = document.createElement('span'); l.textContent = a.label; row.appendChild(l);
      for (let i = 0; i < 2; i++) {
        const code = CF.Keys.binds[a.id][i], b = document.createElement('button');
        b.className = 'bind-key' + (code ? '' : ' empty'); b.textContent = CF.Keys.name(code);
        b.setAttribute('aria-label', a.label + (i ? ' secondary' : ' primary') + ' key: ' + CF.Keys.name(code));
        b.addEventListener('click', () => this.startCapture(a, i, b));
        row.appendChild(b);
      }
      list.appendChild(row);
    }
    for (const [label, key] of fixed) {
      const row = document.createElement('div'); row.className = 'bind-row fixed';
      const l = document.createElement('span'); l.textContent = label;
      const k = document.createElement('span'); k.className = 'bind-key'; k.textContent = key; k.style.gridColumn = 'span 2'; k.style.lineHeight = '32px';
      row.append(l, k); list.appendChild(row);
    }
  };
  G.startCapture = function (action, slot, btn) {
    this.stopCapture();
    btn.classList.add('listening'); btn.textContent = 'Press a key…';
    $('bindNote').textContent = 'Binding “' + action.label + '”. Backspace clears, Esc cancels.';
    CF.Input.capture = (code) => {
      CF.Input.capture = null;
      if (code === null || code === 'Escape') { $('bindNote').textContent = ''; this.renderBinds(); return; }
      if (code === 'Backspace' || code === 'Delete') { CF.Keys.set(action.id, slot, null); $('bindNote').textContent = action.label + ' slot cleared.'; return; }
      if (CF.Keys.reserved.has(code)) { $('bindNote').textContent = CF.Keys.name(code) + ' is reserved.'; this.renderBinds(); return; }
      const moved = CF.Keys.set(action.id, slot, code);
      $('bindNote').textContent = action.label + ' → ' + CF.Keys.name(code) + (moved && moved.id !== action.id ? ' (removed from ' + moved.label + ')' : '');
    };
  };
  G.stopCapture = function () { if (CF.Input.capture) { CF.Input.capture = null; this.renderBinds(); } };

  // ------------------------------------------------------------ flow
  G.toMenu = function () {
    this.state = 'menu';
    CF.Input.active = false; CF.Input.exitLock(); CF.Input.freeLook = false; CF.Input.clearAll();
    CF.Enemies.clear(); CF.FX.reset(); CF.HUD.reset(); CF.HUD.show(false);
    this.stopHold(); this.pending.length = 0;
    CF.Frost.reset(); CF.Frost.setStorm(0.1); CF.Player.chillT = 0;
    if (CF.MapHalden && CF.MapHalden.skua && this.mapId === 'halden') CF.MapHalden.skuaSet('parked');
    if (CF.campaign()) CF.Music.setTheme(CF.campaign().music);
    $('relock').hidden = true;
    this.showScreen('main');
    A.setPaused(false);
    if (this.audioOn) { CF.Music.boss = false; CF.Music.start('menu'); }
    CF.Post.setState({ hurt: 0, low: 0, suppress: 0, fade: 1, ca: 0.0022 });
    this.slow = null; this.timeScale = 1;
    for (const id of CF.Weapons.order) CF.Weapons.vm[id].root.visible = false;
    CF.Player.alive = false; CF.Player.speedMul = 1;
    if (this.mapDef) CF.Post.setState(this.mapDef.theme.post);
  };
  G.startMission = async function (noLock, save) {
    this.initAudio(); A.resume();
    const C = CF.campaign();
    CF.Mission = C.mission;
    if (this.mapId !== C.map) {
      // grab the mouse while we still have the click, then build the campaign map
      if (!noLock && !CF.Input.freeLook) CF.Input.requestLock();
      await this.loadMap(C.map);
    }
    CF.Music.setTheme(C.music);
    if (this.audioOn) { CF.Music.boss = false; CF.Music.start('game'); CF.Music.setIntensity(0.14); }
    this.newGame(save);
    if (save) {
      // back to the saved checkpoint: same loadout, score, stats and mission state
      this.cp = CF.Progress.checkpoint(save);
      this.stats = Object.assign(newStats(), save.stats);
      this.restoreCheckpoint(true);
      CF.HUD.killfeed('Progress restored · ' + CF.Progress.label(save), '');
    }
    this.showScreen(null);
    CF.HUD.show(true);
    CF.Input.active = true; CF.Input.clearAll();
    this.awaitLock = false;
    if (noLock) CF.Input.freeLook = true;
    else if (!CF.Input.freeLook && !CF.Input.locked) CF.Input.requestLock();
  };
  G.newGame = function (save, coop) {
    const C = CF.campaign();
    // every run is tracked (coins per cleared part); a continued run keeps its original run. Co-op runs are not
    // (no coins, and they never touch the solo save).
    if (coop) this.runKey = null;
    else if (save && save.run) { CF.Profile.adoptRun(save.run, { campaign: C.id, diff: save.diff, mode: save.noDrones ? 'nodrones' : 'drones', runId: save.runId, claimed: save.claimed }); this.runKey = save.run; }
    else { this.runKey = CF.Profile.runStart(C.id, CF.settings.difficulty, CF.settings.noDrones ? 'nodrones' : 'drones'); if (CF.Progress.get(C.id)) CF.Progress.clear(C.id); }
    this.runCoins = 0; this.runClaimed = save ? save.claimed || 0 : 0;
    this.resetLevel();
    if (CF.Mission.resetWorld) CF.Mission.resetWorld();
    CF.Enemies.clear(); CF.FX.reset(); CF.FX.clearDecals(); CF.HUD.reset();
    this.stats = newStats(); this.score = 0; CF.HUD.setScore(0);
    this.pending.length = 0; this.lastKill = -99; this.multi = 0;
    this.godMode = this.debugGod; this.slow = null; this.timeScale = 1;
    CF.time = 0;
    CF.Weapons.reset(null); CF.Streak.reset();
    const s = L.points.start;
    CF.Player.spawn(s.x, s.y, s.z, s.yaw, { health: 100, armor: 0 });
    this.state = 'playing';
    CF.Mission.start();
    this.saveCheckpoint(s, true, true);
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
    for (const l of L.points.arenaAlarms || []) { l.on = false; l.intensity = 0; }
    if (L.points.evacLamp) L.points.evacLamp.on = false;
  };
  G.setLamp = function (lamp, c) {
    if (!lamp) return;
    const C = { green: [0x40ff70, 0.6, 5, 1.3], red: [0xff3020, 8, 0.5, 0.25], amber: [0xffa020, 6, 2.7, 0.35] }[c];
    lamp.color.set(C[0]); lamp.baseCol = new THREE.Color(C[1], C[2], C[3]);
  };

  G.saveCheckpoint = function (spawn, silent, noStore) {
    const P = CF.Player;
    this.cp = {
      phase: CF.Mission.idx, spawn: { x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw || 0 },
      armor: P.armor, loadout: CF.Weapons.snapshot(), score: this.score, mission: CF.Mission.saveState()
    };
    if (!silent) CF.HUD.killfeed('Checkpoint reached', '');
    // every checkpoint after the start of a run is saved, so closing the tab loses nothing
    if (!noStore && this.mode !== 'mp' && CF.campaign() && !CF.Coop.campaign()) {
      CF.Progress.store(CF.campaign().id, this.cp, { run: this.runKey, runId: CF.Profile.runId(this.runKey), stats: this.stats, claimed: this.runClaimed });
    }
  };
  /** A campaign part was cleared: claim its coins (the server decides how many). */
  G.phaseDone = function (idx) {
    if (this.mode === 'mp' || !this.runKey || idx < this.runClaimed) return;
    for (let i = this.runClaimed; i <= idx; i++) CF.Profile.claim(this.runKey, i, CF.Mission.phases.length);
    this.runClaimed = idx + 1;
  };
  G.restoreCheckpoint = function (fromSave) {
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
    if (!fromSave && !CF.Input.freeLook) CF.Input.requestLock();
  };

  G.pause = function () {
    if (this.state !== 'playing') return;
    if (CF.CoopCampaign.openMenu()) return; // co-op: the other player keeps playing, so the game doesn't stop
    this.state = 'paused';
    A.setPaused(true); CF.Input.clearAll(); CF.Input.active = false;
    const ph = CF.Mission.phase;
    $('pauseWhere').textContent = ph ? ph.num + ' · ' + ph.title : 'Paused';
    const nu = CF.Mission.nextUnlock();
    $('pauseNext').textContent = nu ? 'Next weapon: ' + CF.Weapons.defs[nu.id].name + ' · ' + nu.task.toLowerCase() : 'Every weapon unlocked';
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
    CF.Streak.onDeath();
    if (this.mode === 'mp') { this.mpOnDeath(source); return; }
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
    if (CF.Board.record(CF.Mission.idx)) CF.HUD.popup('New personal best on the leaderboard', 0, 'obj');
    const s = this.deathCause || 'Unknown';
    $('deadCause').textContent = /^(a |an |the |your )/.test(s) ? 'Killed by ' + s : s;
    CF.Input.active = false; CF.Input.exitLock(); CF.Input.clearAll();
    A.setPaused(true);
    this.showScreen('dead');
  };

  G.victory = function () {
    if (this.state !== 'playing') return;
    this.phaseDone(CF.Mission.phases.length - 1);
    if (!CF.Coop.campaign()) CF.Progress.clear(CF.campaign().id);
    if (CF.CoopCampaign.host()) CF.Net.broadcast({ t: 'cc', k: 'ev', f: 'win', a: [] });
    this.state = 'victory'; this.winT = 0; this.winShown = false;
    this.godMode = true; CF.Player.frozen = true;
    CF.Mission.spawner = null;
    CF.Music.sting('victory'); CF.Music.setIntensity(0.1);
    CF.HUD.flash(0.5); CF.HUD.interact(null); this.stopHold();
    CF.FX.flashLight(CF.Player.body.pos.clone().add(new THREE.Vector3(0, 9, 0)), 0xe8f0ff, 30, 40, 3);
    for (const e of CF.Enemies.list) if (e.alive && !e.boss && !e.net) { e.noScore = true; this.later(U.rand(0.1, 1.4), () => { if (e.alive) { e.hp = 0; e.die({}); } }); }
  };
  G.showWin = function () {
    this.winShown = true;
    CF.Input.active = false; CF.Input.exitLock();
    CF.HUD.show(false);
    const st = this.stats, acc = st.shots ? st.hits / st.shots : 0, hsr = st.kills ? st.headshots / st.kills : 0;
    const dKey = CF.settings.difficulty;
    let g = acc * 100 * 0.35 + hsr * 100 * 0.25 + Math.max(0, 30 - st.deaths * 8) + (st.time < 900 ? 20 : st.time < 1500 ? 12 : 5) + (dKey === 'elite' ? 10 : dKey === 'recruit' ? -6 : 0) - (CF.settings.noDrones ? 4 : 0);
    const rank = g >= 72 ? 'S' : g >= 58 ? 'A' : g >= 44 ? 'B' : g >= 30 ? 'C' : 'D';
    let best = 0;
    const C = CF.campaign(), bestKey = 'cinderfall.best.' + (C.id === 'foundry' ? '' : C.id + '.') + dKey;
    try { best = +localStorage.getItem(bestKey) || 0; if (this.score > best) { localStorage.setItem(bestKey, String(this.score)); } } catch (e) { /* storage unavailable */ }
    $('winWhere').textContent = C.secured;
    const newBest = this.score > best;
    const rows = [
      ['Score', this.score.toLocaleString('en-US') + (newBest ? ' · new best' : '')], ['Time', U.fmtTime(st.time)],
      ['Kills', st.kills], ['Headshot kills', st.headshots], ['Accuracy', Math.round(acc * 100) + '%'], ['Deaths', st.deaths],
      ['Damage dealt', Math.round(st.damageDealt).toLocaleString('en-US')], ['Damage taken', Math.round(st.damageTaken).toLocaleString('en-US')],
      ['Difficulty', CF.diffLabel()], ['Best score', Math.max(best, this.score).toLocaleString('en-US')],
      ['Coins earned', CF.Profile.mode === 'server' && CF.Profile.status !== 'ready' ? 'Saved until you are back online' : (this.runCoins || 0).toLocaleString('en-US') + (CF.Profile.claims && CF.Profile.claims.q.length ? ' · more on the way' : '')]
    ];
    const list = $('statsList'); list.textContent = '';
    for (const [k, v] of rows) {
      const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = k; dd.textContent = v; d.append(dt, dd); list.appendChild(d);
    }
    $('gradeVal').textContent = rank;
    CF.Board.record(CF.Mission.phases.length, true);
    this.showScreen('win');
  };

  G.slowMo = function (scale, dur) { this.slow = { scale, dur, t: 0 }; this.timeScale = scale; };
  G.addScore = function (n) { this.score += Math.round(n); CF.HUD.setScore(this.score); };
  /** Campaign points scaled by difficulty (Recruit 0.8×, Veteran 1×, Elite 1.4×), so harder runs rank higher on the leaderboard. */
  G.pts = function (n) { return Math.round(n * (this.mode === 'mp' ? 1 : CF.diff().score)); };
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
    if (CF.Coop.hostSim() && CF.Coop.creditKill(e, info, head)) { // a partner's kill: they get the points, loot still drops
      const r = Math.random(); if (r < 0.38) this.drop('ammo', e); else if (r < 0.5) this.drop('armor', e, { amount: 20 });
      if (this.mode !== 'mp') CF.Mission.onKill(e);
      return;
    }
    const st = this.stats; st.kills++; if (head) st.headshots++;
    const pts = this.pts((e.T.score || 100) + (head ? 50 : 0));
    this.addScore(pts);
    const how = head ? 'Headshot' : info && info.explosive ? 'Explosive' : info && info.melee ? 'Melee' : '';
    CF.HUD.popup(e.name + (how ? ' · ' + how.toLowerCase() : ''), pts, head ? 'head' : '');
    CF.HUD.killfeed(e.name + ' destroyed', how);
    CF.Streak.onKill();
    A.play('kill', null, { ui: true, delay: 0.04 });
    const now = CF.time;
    this.multi = now - this.lastKill < 2.4 ? this.multi + 1 : 1; this.lastKill = now;
    if (this.multi === 2) { CF.HUD.popup('Double kill', this.pts(100)); this.addScore(this.pts(100)); }
    else if (this.multi === 3) { CF.HUD.popup('Triple kill', this.pts(250)); this.addScore(this.pts(250)); }
    else if (this.multi >= 4) { CF.HUD.popup('Rampage', this.pts(400)); this.addScore(this.pts(400)); }
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
    if (!o.noFx) { if (o.frost) CF.FX.frostBurst(at, o.scale || R / 5.5); else CF.FX.explosion(at, o.scale || R / 5.5); }
    for (const e of CF.Enemies.list.slice()) {
      if (!e.alive || e.spawnT < 1) continue;
      if (e.boss) { e.explosionDamage(at, R, D); continue; }
      e.center(_c);
      const d = _c.distanceTo(at);
      if (d > R + e.T.radius) continue;
      if (!W.segmentClear(at.x, at.y + 0.2, at.z, _c.x, _c.y, _c.z)) continue;
      const k = U.clamp(1 - Math.max(0, d - e.T.radius) / R, 0, 1);
      const dir = _c.clone().sub(at); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
      e.damage(D * k * (src === 'enemy' ? 0.5 : 1), { dir, point: _c.clone(), normal: dir.clone().negate(), part: null, weapon: null, wid: o.weapon, source: src === 'enemy' ? 'enemy' : 'player', knock: 8 * k, explosive: true });
    }
    for (const b of L.barrels) if (b.alive && b.pos.distanceTo(at) < R * 0.85) this.later(U.rand(0.1, 0.22), () => this.damageBarrel(b, 999));
    const P = CF.Player;
    if (P.alive && !o.noSelf) {
      P.chestPos(_c);
      const d = _c.distanceTo(at);
      const clear = W.segmentClear(at.x, at.y + 0.2, at.z, _c.x, _c.y, _c.z) || W.segmentClear(at.x, at.y + 0.2, at.z, _c.x, P.body.pos.y + 0.3, _c.z);
      if (d < R + 0.5 && clear) {
        const k = U.clamp(1 - d / (R + 0.5), 0, 1), self = src === 'player';
        P.damage(D * k * (self ? 0.5 : 1) / (self && this.mode !== 'mp' ? CF.diff().dmg : 1), at, o.killer || (self ? 'your own explosive' : 'an explosion'), 'explosion');
        _v.subVectors(_c, at).setY(0); if (_v.lengthSq() > 1e-6) _v.normalize();
        P.body.vel.x += _v.x * 9 * k; P.body.vel.z += _v.z * 9 * k; P.body.vel.y += 3.5 * k; P.body.grounded = false;
      }
      P.shake(U.clamp(1 - d / (R * 4), 0, 1) * (o.shake || 0.8));
      if (d < R * 2) A.concuss(0.25 * (1 - d / (R * 2)));
    }
    if (src === 'enemy' && CF.Coop.hostSim()) CF.Coop.splash(at, R, D, o.killer);
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
    CF.Coop.onDrop(type, p.pos, data);
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
        else if (this.mode === 'mp' && CF.MP.mode !== 'revolver' && CF.MP.mode !== 'zombies') p.respawn = 20; // Zombies restocks at each break
      }
    }
    if (this.mode === 'mp') {
      for (const p of L.pickups) {
        if (p.alive || !(p.respawn > 0)) continue;
        p.respawn -= dt;
        if (p.respawn <= 0) { p.alive = true; p.mesh.visible = true; CF.FX.glow(p.pos.x, p.pos.y + 0.6, p.pos.z, 1.2, 0.6, 2, 3, 0.25); }
      }
    }
  };
  G.resetPickups = function () {
    const none = this.mode === 'mp' && CF.MP.mode === 'revolver'; // Revolver One-Shot: armor and ammo would only get in the way
    for (let i = L.pickups.length - 1; i >= 0; i--) {
      const p = L.pickups[i];
      if (p.dropped) { this.scene.remove(p.mesh); L.pickups.splice(i, 1); }
      else { p.alive = !none; p.respawn = 0; if (p.mesh) p.mesh.visible = !none; }
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
      const f = it.face || [0, 0];
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
    if (CF.CoopCampaign.forward(it)) return; // co-op partner: the host carries out objectives
    if (it.type === 'breaker') {
      it.done = true; it.enabled = false; it.screen.material = L.mats.screenOn; this.setLamp(it.lamp, 'green');
      A.play('breakerOn', it.pos, { ref: 6 }); CF.Player.shake(0.12);
      CF.Mission.onBreaker(it);
    } else if (it.type === 'uplink') {
      it.enabled = false; A.play('breakerOn', it.pos, { ref: 6 });
      CF.Mission.onUplinkStart(it);
    } else if (it.type === 'task') {
      CF.Mission.onTask(it);
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
    const md = this.moonDir;
    this.moon.position.set(tx + md.x * 90, md.y * 90, tz + md.z * 90);
    this.moon.target.updateMatrixWorld();
  };
  G.updateMenu = function (raw) {
    this.menuT += raw; CF.time += raw;
    this.menuCamera();
    const cam = this.camera;
    L.update(raw, CF.time, cam.position);
    CF.FX.update(raw, cam.position);
    this.updateAtmos(raw, cam);
    this.updateMoon(cam.position);
    A.update(raw, cam);
  };
  G.menuCamera = function () {
    const cam = this.camera, h = this.camHold;
    if (h) { cam.position.set(h[0], h[1], h[2]); cam.rotation.set(h[4] || 0, h[3] || 0, 0, 'YXZ'); }
    else this.mapDef.menuCam(this.menuT, cam);
    if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  };
  G.updateAtmos = function (dt, cam) {
    if (this.rain) this.rain.update(dt, CF.time, cam.position);
    if (this.traffic) this.traffic.update(dt);
    if (CF.Frost.th) CF.Frost.update(this, dt, dt);
  };
  G.updateGame = function (dt, raw) {
    const P = CF.Player, cam = this.camera, playing = this.state === 'playing', mp = this.mode === 'mp';
    CF.time += dt;
    if (playing) this.stats.time += dt;
    if ((mp || CF.Coop.campaign()) && this.mpLobby) { this.menuT += raw; this.menuCamera(); }
    else P.update(dt);
    if (mp) { CF.RC.update(dt, raw); CF.PH.update(dt); CF.ZM.update(dt); }
    if (CF.MP.active) CF.Coop.update(dt); // co-op: enemy sync, downed and revives
    const armed = !CF.RC.driving && !CF.PH.unarmed() && !CF.PH.blind && CF.Coop.armed(); // Prop Hunt: Props carry nothing, Hunters wait blindfolded; co-op: no shooting while down
    if (mp && playing && P.alive && armed) CF.MP.autoAim(dt);
    if (P.alive && playing && armed) CF.Weapons.update(dt, P);
    else if (P.alive) CF.Weapons.animate(dt, P);
    else { CF.Weapons.updateGrenades(dt); CF.Weapons.updateProjectiles(dt); }
    CF.Streak.update(dt, playing && P.alive);
    CF.Enemies.update(dt, P);
    const coopMenu = CF.Coop.campaign() && this.state === 'mpmenu' && !this.mpLobby; // co-op: the mission runs on while the host is in the menu
    if ((playing || coopMenu) && !mp && !CF.CoopCampaign.mirror()) CF.Mission.update(dt);
    if (mp) { CF.MP.update(dt); this.mpUpdate(dt, raw); }
    else if (CF.MP.active) { CF.MP.update(dt); CF.CoopCampaign.update(dt); } // co-op campaign
    this.updatePending(dt);
    if (playing && !mp && !CF.Coop.prompting) this.updateInteract(dt);
    this.updatePickups(dt);
    L.update(dt, CF.time, cam.position);
    CF.FX.update(dt, cam.position);
    this.updateAtmos(dt, cam);
    this.updateMoon(mp && this.mpLobby ? cam.position : P.body.pos);
    A.update(raw, cam);
    const p = P.body.pos;
    const inside = !!(this.mapDef.inside && this.mapDef.inside(p));
    if (inside !== this.inside) { this.inside = inside; A.setRoom(inside ? 0.65 : 0.25); if (this.rainSnd) this.rainSnd.set(inside ? 0.05 : 0.16, 0.5); }
    cam.getWorldDirection(_f);
    const wh = W.raycast(cam.position.x, cam.position.y, cam.position.z, _f.x, _f.y, _f.z, 150);
    const eh = CF.Enemies.raycast(cam.position, _f, wh ? wh.t : 150);
    const ae = eh && eh.enemy.alive && !eh.enemy.prop ? eh.enemy : null; // a disguised Prop must not light up the crosshair or show a name
    CF.Enemies.aimed = !!ae && (!ae.net || CF.MP.enemyOf(ae.id));
    if (mp) this.aimName(ae && ae.net && P.alive ? ae : null);
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
    CF.Skins.tick(CF.realTime);
    if (this.slow) {
      this.slow.t += raw;
      const k = Math.min(1, this.slow.t / this.slow.dur);
      this.timeScale = U.lerp(this.slow.scale, 1, k * k);
      if (k >= 1) { this.slow = null; this.timeScale = 1; }
    }
    const dt = Math.min(raw, 0.05) * this.timeScale, st = this.state;
    if (window.innerWidth !== this.vw || window.innerHeight !== this.vh) { this.vw = window.innerWidth; this.vh = window.innerHeight; this.onResize(); }
    CF.Perf.begin();
    try {
      const mpSt = st === 'mpdead' || st === 'mpmenu' || st === 'mpend';
      if (st === 'loading') { A.update(raw, this.camera); CF.Input.endFrame(); return; }
      if (st === 'menu') this.updateMenu(raw);
      else if (st === 'playing' || st === 'dying' || st === 'victory' || mpSt) this.updateGame(dt, raw);
      else A.update(raw, this.camera);
      CF.Perf.mid();
      const cam = this.camera;
      if (cam.fov !== this.lastFov) { this.lastFov = cam.fov; CF.FX.resize(CF.Post.H, cam.fov); }
      const showVM = (st === 'playing' || st === 'paused' || st === 'victory' || st === 'mpdead' || st === 'mpmenu') && CF.Player.alive && !(this.mode === 'mp' && this.mpLobby) && !CF.RC.driving && !CF.PH.unarmed() && CF.Coop.armed();
      if (st === 'menu' && this.screen === 'locker' && CF.Locker.active) CF.Locker.render(raw);
      else CF.Post.render(this.scene, cam, showVM ? this.vmScene : null, this.vmCam);
      if (st === 'playing' || st === 'menu' || mpSt) CF.Post.adapt(raw);
    } catch (e) {
      if (!this.errOnce) { this.errOnce = true; console.error(e); }
    }
    CF.Perf.end(raw);
    this.fpsN++; this.fpsT += raw;
    if (this.fpsT >= 0.5) { CF.HUD.fps(Math.round(this.fpsN / this.fpsT)); this.fpsN = 0; this.fpsT = 0; }
    CF.Input.endFrame();
  };

  // ------------------------------------------------------------ multiplayer flow
  const MPM = () => CF.MP;
  G.openMpScreen = function () {
    this.backTo = 'main';
    $('mpName').value = MPM().name;
    this.renderMpPick(); this.renderLoadouts();
    this.mpBusy(false);
    if (!CF.Net.available()) MPM().status('Online play needs WebRTC and the PeerJS library. Open the game from its web address in a current browser.', true);
    else if (location.protocol === 'file:') MPM().status('Tip: online play works best from the game’s web address (for example the GitHub Pages link).', false);
    else MPM().status('', false);
    this.showScreen('mp');
  };
  G.renderMpPick = function () {
    // Sniper Valley is its own mode (team deathmatch, rail rifles only), so the mode cards step aside for it
    // Co-op Campaign swaps the map cards for the two campaigns
    const coop = this.mpSel.mode === 'coop', camp = (m) => m === 'foundry' || m === 'halden';
    if (coop && !camp(this.mpSel.map)) this.mpSel.map = CF.settings.campaign || 'foundry';
    if (!coop && camp(this.mpSel.map)) this.mpSel.map = 'market';
    $('mpCampRow').hidden = !coop; $('mpMapRow').hidden = coop;
    const cn = $('mpCoopNote'); cn.hidden = !coop;
    if (coop) cn.textContent = 'Difficulty: ' + CF.diff().label + (CF.settings.noDrones ? ' · no drones' : '') + ' (from the campaign screen). Enemies get 1.4× health for the second gun. Co-op runs go on their own leaderboard; no coins, and your solo save is untouched.';
    const sniper = this.mpSel.map === 'sniper';
    for (const b of document.querySelectorAll('[data-map]')) b.classList.toggle('sel', b.dataset.map === this.mpSel.map);
    for (const b of document.querySelectorAll('[data-mode]')) { b.classList.toggle('sel', !sniper && b.dataset.mode === this.mpSel.mode); b.disabled = sniper; }
    const note = $('mpModeNote'); if (note) note.hidden = !sniper;
  };
  G.renderLoadouts = function () {
    const M = MPM();
    const keys = M.loKeys(), defs = M.loDefs();
    for (const grid of document.querySelectorAll('[data-lo-grid]')) {
      if (grid.dataset.set !== keys.join()) {
        grid.dataset.set = keys.join(); grid.textContent = '';
        keys.forEach((k, i) => {
          const lo = defs[k], b = document.createElement('button');
          b.className = 'lo-card'; b.dataset.loadout = k;
          const n = document.createElement('span'); n.className = 'lo-name'; n.textContent = lo.label;
          const kb = document.createElement('kbd'); kb.textContent = String(i + 1);
          const d = document.createElement('span'); d.className = 'lo-desc'; d.textContent = lo.desc;
          b.append(kb, n, d); grid.appendChild(b);
        });
      }
      for (const b of grid.children) b.classList.toggle('sel', b.dataset.loadout === M.nextLoadout);
    }
    const md = $('mdLo');
    if (md) {
      md.textContent = '';
      keys.forEach((k, i) => { const s = document.createElement('span'); s.className = k === M.nextLoadout ? 'sel' : ''; s.textContent = (i + 1) + ' ' + defs[k].label; md.appendChild(s); });
    }
  };
  G.mpBusy = function (on) { for (const b of document.querySelectorAll('[data-act="mphost"], [data-act="mpjoin"]')) b.disabled = on; };
  G.mpStart = function (host) {
    const M = MPM();
    M.saveName($('mpName').value); $('mpName').value = M.name;
    if (!CF.Net.available()) { M.status('Online play needs WebRTC and the PeerJS library. Open the game from its web address in a current browser.', true); return; }
    if (!host && CF.Net.cleanCode($('mpCode').value).length !== 5) { M.status('Enter the 5-character room code your friend sees on their screen.', true); $('mpCode').focus(); return; }
    this.mpBusy(true);
    if (host) M.host(this.mpSel.map, this.mpSel.map === 'sniper' ? 'sniper' : this.mpSel.mode); else M.join($('mpCode').value);
  };
  /** Called once the map is built: show the lobby so the Deploy click can capture the mouse. */
  G.enterMultiplayer = function () {
    const M = MPM();
    this.mode = 'mp';
    document.body.classList.add('mp');
    document.body.classList.toggle('mp-revolver', M.mode === 'revolver');
    document.body.classList.toggle('mp-prophunt', M.mode === 'prophunt');
    document.body.classList.toggle('mp-sniper', M.mode === 'sniper');
    document.body.classList.toggle('mp-zombies', M.mode === 'zombies');
    if (M.mode === 'zombies' && !W.nav) W.buildNav(); // the infected path-find; multiplayer maps don't build this by default
    CF.Coop.reset();
    if (!M.loDefs()[M.nextLoadout]) M.nextLoadout = M.loKeys()[0]; // e.g. Assault picked, but Sniper Valley only offers rail kits
    this.initAudio(); A.resume(); A.setPaused(false);
    if (this.audioOn) { CF.Music.boss = false; CF.Music.start('game'); CF.Music.setIntensity(0.14); }
    CF.FX.reset(); CF.FX.clearDecals(); CF.HUD.reset(); CF.HUD.objTarget = null; CF.HUD.bossBar(false);
    this.stats = newStats(); this.score = 0; CF.HUD.setScore(0); CF.Streak.reset();
    this.pending.length = 0; this.godMode = false; this.slow = null; this.timeScale = 1;
    this.resetPickups(); this.stopHold();
    CF.Player.alive = false; CF.Player.frozen = false;
    CF.RC.setup(); CF.PH.setup();
    this.mpLobby = true; this.deathT = 0; this.menuT = 0;
    $('mpBar').hidden = false; $('mpDead').hidden = true;
    CF.Post.setState({ fade: 1, low: 0, hurt: 0, suppress: 0 });
    this.mpBusy(false);
    this.state = 'mpmenu';
    this.mpOpenMenu();
    if (M.ended) this.mpMatchEnd('Match over');
  };
  G.mpOpenMenu = function () {
    if (this.mode !== 'mp') return;
    this.state = 'mpmenu';
    CF.Input.active = false; CF.Input.clearAll(); CF.Input.exitLock();
    $('relock').hidden = true; $('aimName').hidden = true;
    this.stopHold(); CF.HUD.showScope(false);
    this.renderMpMenu();
    CF.HUD.show(!this.mpLobby);
    this.backTo = 'mpmenu';
    this.showScreen('mpmenu');
  };
  G.renderMpMenu = function () {
    const M = MPM(), def = CF.Maps[M.map];
    $('mpRoomCode').textContent = CF.Net.code || '-----';
    $('mpRoom').textContent = (def ? def.name : '') + ' · ' + M.modeDef().name + (M.isHost() ? ' · you are hosting' : '');
    $('mpMenuTitle').textContent = this.mpLobby ? 'Ready to deploy' : 'Match in progress';
    const btn = $('mpResumeBtn');
    btn.textContent = this.mpLobby ? 'Deploy' : CF.Player.alive ? 'Resume' : 'Respawn';
    const tn = M.teamNote();
    $('mpTeamNote').textContent = tn.text; $('mpTeamNote').style.color = tn.css;
    M.renderBoard($('mpBoard'));
    this.renderLoadouts();
  };
  G.mpResume = function () {
    if (this.state !== 'mpmenu' || this.mode !== 'mp') return;
    const M = MPM();
    if (M.ended) { this.mpMatchEnd(M.winnerText()); return; }
    this.showScreen(null); CF.HUD.show(true);
    CF.Input.active = true; CF.Input.clearAll();
    if (this.mpLobby || (!CF.Player.alive && this.deathT >= RESPAWN && !(M.mode === 'zombies' && !CF.ZM.canRespawn()))) { this.mpLobby = false; this.mpSpawn(); }
    else this.state = CF.Player.alive ? 'playing' : 'mpdead';
    if (!CF.Input.freeLook) CF.Input.requestLock();
  };
  G.mpSpawn = function () {
    CF.PH.drop(); CF.Coop.standUp();
    const M = MPM(), P = CF.Player, lo = M.loadoutFor(M.nextLoadout);
    M.loadout = M.nextLoadout;
    const s = M.pickSpawn();
    CF.Weapons.reset(lo);
    P.speedMul = lo.speed || 1;
    P.spawn(s.x, s.y, s.z, s.yaw, { maxHealth: M.maxHealth(), armor: lo.armor || 0 });
    P.tilt = 0;
    M.spawnT = CF.time;
    this.state = 'playing'; this.deathT = 0;
    $('mpDead').hidden = true;
    CF.Post.setState({ fade: 1, low: 0, hurt: 0 });
    A.play('spawn', null, { ui: true, vol: 0.5 });
    M.sendState();
  };
  /** Prop Hunt: a new round moves everyone to their team's side with their team's kit. */
  G.mpRoundRespawn = function () {
    if (this.mode !== 'mp' || this.mpLobby) return;
    if (this.state === 'playing' || this.state === 'mpdead') this.mpSpawn();
    else if (this.state === 'mpmenu') { CF.Player.alive = false; this.deathT = RESPAWN; this.renderMpMenu(); MPM().sendState(); }
  };
  G.mpOnDeath = function (source) {
    if (this.state !== 'playing' && this.state !== 'mpmenu') return;
    CF.RC.onDeath(); CF.PH.drop();
    if (this.state === 'playing') this.state = 'mpdead';
    this.deathT = 0; this.stats.deaths++;
    MPM().onLocalDeath(source);
    CF.HUD.interact(null); this.stopHold();
    CF.HUD.setSpread(10, true); CF.HUD.showScope(false);
    $('mdBy').textContent = source && source !== 'The fall' ? 'By ' + source : source || '';
    this.renderLoadouts();
    $('mpDead').hidden = false;
  };
  G.mpKilledBy = function (name, how) {
    $('mdBy').textContent = name ? 'By ' + name + (how ? ' · ' + how : '') : 'Eliminated';
  };
  G.aimName = function (e) {
    const el = $('aimName');
    if (!e) { if (!el.hidden) el.hidden = true; return; }
    if (el.dataset.id !== e.id) { el.dataset.id = e.id; el.textContent = e.name; el.style.color = e.css; }
    el.hidden = false;
  };
  G.mpUpdate = function (dt, raw) {
    const M = MPM(), inp = CF.Input;
    if (this.state === 'mpdead') {
      this.deathT += raw;
      CF.Post.setState({ fade: Math.max(0.35, 1 - this.deathT * 0.25) });
      if (M.mode !== 'revolver' && !CF.PH.unarmed()) { const keys = M.loKeys(); for (let i = 0; i < keys.length; i++) if (inp.hit('Digit' + (i + 1))) { M.setLoadout(keys[i]); this.renderLoadouts(); } }
      const left = Math.max(0, RESPAWN - this.deathT), wait = M.mode === 'zombies' && !CF.ZM.canRespawn();
      const txt = M.ended ? 'Match over' : wait ? 'Back in at the next break' : left > 0 ? 'Respawning in ' + Math.ceil(left) : 'Respawning';
      if (this.ui.md !== txt) { $('mdTimer').textContent = txt; this.ui.md = txt; }
      if (left <= 0 && !M.ended && !wait) this.mpSpawn();
    } else if (this.state === 'mpmenu' && !CF.Player.alive) this.deathT += raw;
    if (this.state === 'playing' && M.protectedNow() && !CF.RC.driving && !CF.PH.blind) CF.HUD.hint('Spawn protection · ends when you fire');
    this.mpHudT = (this.mpHudT || 0) - raw;
    if (this.mpHudT <= 0) {
      this.mpHudT = 0.2;
      const h = M.hudText();
      if (this.ui.hm !== h.mode) { $('mpbMode').textContent = h.mode; this.ui.hm = h.mode; }
      if (this.ui.ht !== h.time) { $('mpbTime').textContent = h.time; this.ui.ht = h.time; }
      if (this.ui.hs !== h.score) { $('mpbScore').textContent = h.score; this.ui.hs = h.score; }
      if (this.state === 'mpmenu' && this.screen === 'mpmenu') M.renderBoard($('mpBoard'));
    }
  };
  G.ui = {};
  G.mpMatchEnd = function (winner) {
    if (this.mode !== 'mp') return;
    const M = MPM();
    this.state = 'mpend';
    CF.RC.end(false, true);
    CF.Input.active = false; CF.Input.exitLock(); CF.Input.clearAll();
    $('mpDead').hidden = true; $('aimName').hidden = true; $('relock').hidden = true;
    $('mpWinner').textContent = winner || 'Match over';
    M.renderBoard($('mpEndBoard'));
    $('mpAgainBtn').hidden = !M.isHost();
    $('mpEndNote').textContent = M.isHost() ? 'Start another round on this map, or leave to close the room.' : 'Waiting for the host to start another round.';
    CF.HUD.show(false);
    CF.HUD.showScope(false);
    if (this.audioOn) CF.Music.sting('victory');
    this.showScreen('mpend');
  };
  G.mpRestart = function () {
    if (this.mode !== 'mp') return;
    this.stats = newStats(); this.score = 0;
    CF.Player.alive = false; this.mpLobby = true; this.deathT = 0;
    this.resetPickups();
    CF.RC.setup(); CF.PH.drop();
    CF.HUD.reset();
    $('mpDead').hidden = true;
    MPM().sendState();
    this.mpOpenMenu();
  };
  G.leaveMultiplayer = function (reason) {
    this.mode = 'campaign'; this.mpLobby = false;
    CF.RC.clear(); CF.PH.clear();
    document.body.classList.remove('mp', 'mp-revolver', 'mp-prophunt', 'mp-sniper', 'mp-zombies', 'coop-downed', 'coop');
    CF.Coop.reset();
    $('mpBar').hidden = true; $('mpDead').hidden = true; $('aimName').hidden = true;
    CF.Player.speedMul = 1;
    this.toMenu();
    this.resetPickups();
    if (reason) { this.openMpScreen(); MPM().status(reason, true); }
  };

  // ------------------------------------------------------------ debug hooks (console)
  CF.debug = {
    start: (diff) => { CF.settings.difficulty = diff || CF.settings.difficulty; G.startMission(true); return G.state; },
    god: (v) => { G.debugGod = v !== undefined ? !!v : !G.debugGod; G.godMode = G.debugGod; return G.debugGod; },
    skip: (i) => { CF.Mission.skipTo(i); return CF.Mission.phase.id; },
    tp: (x, y, z, yaw) => { const b = CF.Player.body; b.pos.set(x, y, z); b.vel.set(0, 0, 0); if (yaw != null) CF.Player.yaw = yaw; },
    give: () => { for (const id of CF.Weapons.order) CF.Weapons.give(id, true); CF.Weapons.hudAmmo(); },
    kill: () => { for (const e of CF.Enemies.list) if (e.alive && !e.boss) { e.hp = 0; e.die({}); } },
    host: (map, mode) => { G.mpSel = { map: map || 'market', mode: mode || 'ffa' }; G.mpStart(true); },
    join: (code) => { $('mpCode').value = code; G.mpStart(false); },
    deploy: () => { CF.Input.freeLook = true; G.mpResume(); return G.state; },
    map: (id) => G.loadMap(id),
    view: async (id, x, y, z, yaw, pitch) => { await G.loadMap(id); G.showScreen(null); G.camHold = x == null ? null : [x, y, z, yaw || 0, pitch || 0]; return G.mapId; },
    info: () => ({ state: G.state, mode: G.mode, map: G.mapId, phase: CF.Mission.phase && CF.Mission.phase.id, pos: CF.Player.body.pos.toArray().map((v) => +v.toFixed(2)), hp: Math.round(CF.Player.health), armor: Math.round(CF.Player.armor), enemies: CF.Enemies.alive(), score: G.score, weapon: CF.Weapons.curId, scale: CF.Post.effScale })
  };

  G.boot();
})(window.CF);
