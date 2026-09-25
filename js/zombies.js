'use strict';
/* Cinderfall — Zombies (co-op multiplayer mode). Everyone is on one team against waves of infected: Husks (Sentry
   frames that lost their guns and claw), Crawlers (Stalkers), Blight drones (Hornets) and Brutes (Juggernauts), all
   reskinned in sick green. Waves grow in size and toughness; a short break between them restocks the map's ammo and
   armor and brings the fallen back. Enemy count, health and damage scale with the number of players. A player who
   runs out of health goes down (js/coop.js) and bleeds out after 30 s unless revived; the game ends when nobody is
   left standing. The host runs the waves and the enemies and sends 'zw' updates through the normal relay. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const FIRST_BREAK = 12, BREAK = 18, SPAWN_MIN_DIST = 15;
  const MP = () => CF.MP;

  // ------------------------------------------------------------ the infected
  const E = CF.Enemies, T = E.types;
  T.husk = { name: 'Husk', kind: 'sentry', melee: true, hp: 90, walk: 1.6, run: 3.7, radius: 0.36, height: 1.95, eye: 1.72, range: [0, 0], sight: 80, fovCos: -1, dmg: 16, score: 100, stagger: 45, alert: 'screech' };
  T.crawler = { name: 'Crawler', kind: 'stalker', hp: 60, walk: 2.4, run: 8.2, radius: 0.42, height: 1.0, eye: 0.85, range: [0, 0], sight: 80, fovCos: -1, dmg: 13, score: 110, stagger: 36 };
  T.blight = { name: 'Blight drone', kind: 'hornet', hp: 40, walk: 5, run: 7.5, radius: 0.5, height: 0.5, eye: 0, range: [8, 20], sight: 80, fovCos: -1, dmg: 4, projSpeed: 60, burst: 2, burstGap: 0.14, cool: [1.1, 1.8], spread: 3, score: 90, flying: true, drone: true, bolt: 'laser' };
  T.brute = { name: 'Brute', kind: 'juggernaut', hp: 480, walk: 1.6, run: 2.6, radius: 0.62, height: 2.9, eye: 2.45, range: [8, 30], sight: 80, fovCos: -1, dmg: 11, projSpeed: 58, burst: 4, burstGap: 0.17, cool: [2.0, 3.0], spread: 2.8, score: 400, stagger: 160, bolt: 'slug' };
  const INFECTED = { husk: 'sentry', crawler: 'stalker', blight: 'hornet', brute: 'juggernaut' };
  const SICK = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 5.5, 0.9) });
  /** Same frames as the Warden's units, overgrown: moss-green plating, green eyes and seams, guns torn off the Husks. */
  function infect(m, type) {
    const [armor, frame, extra] = m.mats;
    armor.color.set(0x76825a); frame.color.set(0x262c1f); if (extra) extra.color.set(0x4a5438);
    m.eyeMat.color.setRGB(1.1, 7, 1.0);
    if (m.ventMat) { m.ventMat.color.setRGB(1.2, 5, 0.8); m.ventCol = [1.2, 5, 0.8]; }
    m.root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.material !== m.eyeMat && o.material !== m.ventMat && !o.material.transparent && o.material.color.r > 2) o.material = SICK; });
    if (type === 'husk' && m.p.gun) { m.p.gun.visible = false; m.gibs = m.gibs.filter((g) => g !== m.p.gun); }
    return m;
  }
  for (const k in INFECTED) CF.EnemyModels[k] = () => infect(CF.EnemyModels[INFECTED[k]](), k);

  // ------------------------------------------------------------ state
  const ZM = CF.ZM = { phase: 'wait', wave: 0, t: 0, left: 0, kills: 0, toSpawn: 0, spawnT: 0, sendT: 0, deaths: 0, best: 0 };
  ZM.on = () => MP().active && MP().mode === 'zombies';
  const playerCount = () => Math.max(1, Object.keys(MP().players).length);
  /** Wave size, enemy health and damage for this wave and team size (tune here). */
  ZM.scale = function (w, n) {
    return {
      count: Math.round((5 + 3 * w) * (0.6 + 0.4 * n)),
      hp: (1 + 0.1 * (w - 1)) * (0.7 + 0.3 * n),
      dmg: Math.min(2.2, (1 + 0.04 * (w - 1)) * (0.85 + 0.15 * n)),
      maxAlive: Math.min(24, 6 + 3 * n + Math.floor(w / 3))
    };
  };
  function pick(w) {
    const r = Math.random();
    if (w >= 3 && r < 0.14) return CF.noDrones() ? 'crawler' : 'blight';
    if (w >= 2 && r < 0.4) return 'crawler';
    if (w >= 7 && r < 0.43) return 'brute';
    return 'husk';
  }
  ZM.reset = function () {
    ZM.phase = 'wait'; ZM.wave = 0; ZM.t = 0; ZM.left = 0; ZM.kills = 0; ZM.toSpawn = 0; ZM.deaths = 0; ZM.brutes = 0;
    for (const e of CF.Enemies.list.slice()) if (!e.net) { e.alive = false; e.remove(); }
    CF.Enemies.proj.length = 0;
  };
  ZM.snap = () => ({ t: 'zw', p: ZM.phase, w: ZM.wave, s: Math.ceil(ZM.t), l: ZM.left, k: ZM.kills });
  function send(extra) { const msg = Object.assign(ZM.snap(), extra || {}); CF.Net.broadcast(msg); ZM.apply(msg); }

  // ------------------------------------------------------------ host: the director
  function spawnPoint() {
    const L = CF.Level, tg = CF.Coop.targets.length ? CF.Coop.targets : [CF.Player];
    const cands = (L.spawns.ffa || []).concat(L.spawns.t0 || [], L.spawns.t1 || []);
    let best = null, bs = -Infinity;
    for (let i = 0; i < 14; i++) {
      const c = U.choice(cands); if (!c) break;
      const x = c[0] + U.rand(-2, 2), z = c[2] + U.rand(-2, 2), y = W.nav ? W.navHeight(x, z) : c[1];
      if (isNaN(y) || (W.nav && !W.isMain(W.cellAt(x, z)))) continue;
      let md = Infinity, seen = 0;
      for (const t of tg) {
        md = Math.min(md, Math.hypot(t.body.pos.x - x, t.body.pos.z - z));
        if (W.segmentClear(t.body.pos.x, t.body.pos.y + 1.6, t.body.pos.z, x, y + 1.2, z)) seen++;
      }
      if (md < SPAWN_MIN_DIST) continue;
      const score = -Math.abs(md - 28) * 0.5 - seen * 20 + Math.random() * 8;
      if (score > bs) { bs = score; best = [x, y, z]; }
    }
    return best;
  }
  function spawnOne() {
    const p = spawnPoint(); if (!p) return false;
    const w = ZM.wave, sc = ZM.scale(w, playerCount());
    let type = pick(w);
    if (ZM.brutes > 0) { type = 'brute'; ZM.brutes--; }
    CF.Enemies.spawn(type, p[0], p[2], { y: p[1], aware: true, spawnFx: true, hpMul: sc.hp, dmgMul: sc.dmg, tag: 'wave' });
    ZM.toSpawn--;
    return true;
  }
  function startWave() {
    ZM.wave++;
    const sc = ZM.scale(ZM.wave, playerCount());
    ZM.toSpawn = sc.count; ZM.brutes = ZM.wave % 5 === 0 ? Math.floor(ZM.wave / 5) : 0; ZM.spawnT = 1.5;
    ZM.left = sc.count;
    send({ p: 'wave', s: 0, l: sc.count, go: 1 });
  }
  function startBreak(first) {
    ZM.restock();
    send({ p: 'break', s: first ? FIRST_BREAK : BREAK, rs: 1 });
  }
  /** Host, every frame. */
  ZM.hostUpdate = function (dt) {
    const M = MP(); if (M.ended) return;
    ZM.t = Math.max(0, ZM.t - dt);
    if (ZM.phase === 'wait') {
      const deployed = CF.Coop.team();
      if (Object.keys(M.players).length >= 2 && deployed.up + deployed.down > 0) startBreak(true);
    } else if (ZM.phase === 'break') {
      if (ZM.t <= 0) startWave();
    } else if (ZM.phase === 'wave') {
      const alive = CF.Enemies.alive((e) => e.tag === 'wave');
      ZM.left = alive + ZM.toSpawn;
      ZM.spawnT -= dt;
      if (ZM.toSpawn > 0 && ZM.spawnT <= 0 && alive < ZM.scale(ZM.wave, playerCount()).maxAlive) {
        ZM.spawnT = U.rand(0.6, 1.4);
        for (let i = Math.random() < 0.4 ? 2 : 1; i > 0 && ZM.toSpawn > 0; i--) if (!spawnOne()) break;
      }
      if (ZM.toSpawn <= 0 && alive === 0) {
        A.play('objective', null, { ui: true });
        CF.Net.broadcast({ t: 'zw', p: 'break', w: ZM.wave, s: BREAK, l: 0, k: ZM.kills, cleared: 1 });
        ZM.apply({ p: 'break', w: ZM.wave, s: BREAK, l: 0, k: ZM.kills, cleared: 1 });
        startBreak(false);
      }
    }
    ZM.sendT -= dt;
    if (ZM.sendT <= 0) { ZM.sendT = 1; CF.Net.broadcast(ZM.snap()); }
    M.checkEnd();
  };
  ZM.onKill = function () { ZM.kills++; };
  /** Host: is it over? Everyone down or dead during the run. */
  ZM.result = function () {
    if (ZM.phase !== 'wave' && ZM.phase !== 'break') return null;
    const c = CF.Coop.team();
    return c.up === 0 && (c.down > 0 || ZM.deaths > 0) ? 'Overrun on wave ' + ZM.wave : null;
  };
  ZM.onEnd = function (winner) { ZM.phase = 'over'; ZM.winner = winner; };
  /** Break: every pickup on the map is back. */
  ZM.restock = function () {
    for (const p of CF.Level.pickups) if (!p.dropped && p.mesh && !p.alive) { p.alive = true; p.mesh.visible = true; p.respawn = 0; CF.FX.glow(p.pos.x, p.pos.y + 0.6, p.pos.z, 1.2, 0.6, 2, 3, 0.25); }
  };

  // ------------------------------------------------------------ everyone
  ZM.apply = function (msg) {
    const was = ZM.phase, wasWave = ZM.wave;
    ZM.phase = msg.p; ZM.wave = msg.w; ZM.left = msg.l; ZM.kills = msg.k;
    if (was !== msg.p || msg.rs || msg.go || Math.abs(msg.s - ZM.t) > 1.2) ZM.t = msg.s;
    const G = CF.Game;
    if (msg.cleared) { CF.HUD.popup('Wave ' + msg.w + ' cleared', G.pts(250), 'obj'); G.addScore(G.pts(250)); CF.Music.sting('objective'); }
    if (msg.rs) { // the break: the fallen come back, the downed get up, pickups are restocked
      if (!MP().isHost()) ZM.restock();
      CF.Coop.revived(null);
      if (G.state === 'mpdead' && !G.mpLobby) G.mpSpawn();
      if (was !== 'break') CF.HUD.popup(wasWave ? 'Break · ammo and armor restocked' : 'Get ready · the first wave is coming', 0, '');
    }
    if (msg.go) { CF.HUD.phaseCard('Wave ' + msg.w, msg.w % 5 === 0 ? 'Brutes incoming' : 'The infected are coming', msg.l + ' infected'); A.play('alert', null, { ui: true }); CF.Music.setIntensity(0.8); }
    if (was === 'wave' && msg.p !== 'wave') CF.Music.setIntensity(0.2);
  };
  ZM.update = function (dt) {
    if (!ZM.on()) return;
    if (MP().isHost()) ZM.hostUpdate(dt);
    else ZM.t = Math.max(0, ZM.t - dt);
    const G = CF.Game;
    if (G.state === 'playing' && ZM.phase === 'wait') CF.HUD.hint('Zombies · waiting for a second player (room ' + CF.Net.code + ')');
    else if (G.state === 'playing' && ZM.phase === 'break' && !CF.Coop.downed) CF.HUD.hint((ZM.wave ? 'Break' : 'Get ready') + ' · wave ' + (ZM.wave + 1) + ' in ' + Math.ceil(ZM.t) + ' s');
  };
  /** Players who bled out come back at the next break, not on a timer. */
  ZM.canRespawn = () => ZM.phase !== 'wave';
  ZM.onDeath = function () { if (MP().isHost()) ZM.deaths++; };

  // ------------------------------------------------------------ UI
  ZM.hudText = function () {
    const t = ZM.phase === 'break' ? U.fmtTime(Math.ceil(ZM.t)) : ZM.phase === 'wave' ? 'W' + ZM.wave : '–:––';
    const score = ZM.phase === 'wait' ? 'Waiting for players' : ZM.phase === 'break' ? (ZM.wave ? 'Break · ' : 'Get ready · ') + ZM.kills + ' kills'
      : ZM.phase === 'wave' ? ZM.left + ' infected left · ' + ZM.kills + ' kills' : (ZM.winner || 'Game over') + ' · ' + ZM.kills + ' kills';
    return { mode: 'Zombies · wave ' + Math.max(1, ZM.wave + (ZM.phase === 'break' ? 1 : 0)), time: t, score };
  };
  /** Scoreboard: wave reached and total kills up top, then each player's kills and deaths. */
  ZM.renderBoard = function (el) {
    const M = MP();
    el.textContent = ''; el.classList.remove('ph');
    const top = document.createElement('div'); top.className = 'sb-teams';
    const a = document.createElement('b'); a.style.color = '#8dff6a'; a.textContent = 'Wave ' + Math.max(ZM.wave, 0);
    const b = document.createElement('b'); b.style.color = '#ffe14d'; b.textContent = ZM.kills + ' kills';
    top.append(a, b); el.appendChild(top);
    const head = document.createElement('div'); head.className = 'sb-row sb-head';
    head.innerHTML = '<span>Operative</span><span>Kills</span><span>Deaths</span>';
    el.appendChild(head);
    const rows = Object.keys(M.players).map((id) => Object.assign({ id }, M.players[id])).sort((x, y) => (y.kills || 0) - (x.kills || 0));
    for (const r of rows) {
      const d = document.createElement('div'); d.className = 'sb-row' + (r.id === M.myId ? ' me' : '');
      const n = document.createElement('span'); n.textContent = r.name; n.style.borderLeftColor = '#8dff6a';
      const k = document.createElement('span'); k.textContent = r.kills || 0;
      const de = document.createElement('span'); de.textContent = r.deaths || 0;
      d.append(n, k, de); el.appendChild(d);
    }
  };
})(window.CF);
