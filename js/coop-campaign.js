'use strict';
/* Cinderfall — co-op campaign: two players through Cinder Foundry or Whiteout, hosted and joined with a room code.
   The host plays the campaign exactly as solo: its mission script runs the phases, spawners, bosses and checkpoints,
   and its enemies hunt whichever player is nearest (js/coop.js). The partner runs no mission. Four times a second the
   host sends a world snapshot ('cc' 'w': phase and mission state, doors, objective terminals, objective HUD, weather,
   countdown, unlocked weapons, last checkpoint), and one-off events as they happen ('cc' 'ev': radio lines, phase
   cards, objective popups, the Skua, victory, a wipe). When the partner finishes an objective interaction it goes to
   the host ('use'), who carries it out. A player who runs out of health goes down and can be revived; both down at
   once sends the team back to the last checkpoint. Co-op runs are ranked on their own leaderboard ('coop' mode).
   Tuning: enemies get 1.4x health, their damage is unchanged (COOP_HP / COOP_DMG in js/coop.js). */
(function (CF) {
  const U = CF.U, L = CF.Level, A = CF.Audio;
  const SNAP = 0.25, FAIL_T = 3.5;
  const $ = (id) => document.getElementById(id);
  const MP = () => CF.MP;
  const CC = CF.CoopCampaign = { campaign: 'foundry', snapT: 0, last: {}, hud: { obj: null, prog: null, cd: null }, failT: 0, deployed: false };
  CC.on = () => CF.Coop.campaign();
  CC.host = () => CC.on() && MP().isHost();
  /** The partner: shows the host's mission instead of running one. */
  CC.mirror = () => CC.on() && !MP().isHost();
  CC.info = () => ({ c: CC.campaign, d: CF.settings.difficulty, nd: CF.settings.noDrones ? 1 : 0 });

  // ------------------------------------------------------------ players, for the mission scripts
  /** Standing players' positions (host and partner). */
  CC.players = function () {
    const out = [], P = CF.Player;
    if (P.alive && !CF.Coop.downed) out.push({ pos: P.body.pos, local: true });
    if (CC.on()) for (const id in MP().remotes) { const r = MP().remotes[id]; if (r.alive && !r.dead && !r.downed) out.push({ pos: r.body.pos, id }); }
    return out;
  };
  /** Is any standing player where fn(pos) says? Solo: just the player. */
  CC.any = function (fn) {
    if (!CC.on()) return CF.Player.alive && fn(CF.Player.body.pos);
    return CC.players().some((p) => fn(p.pos));
  };
  /** The standing player closest to a point (for "how close is the nearest player" checks). */
  CC.nearestDist = function (x, z) {
    let d = Infinity;
    for (const p of CC.on() ? CC.players() : [{ pos: CF.Player.body.pos }]) d = Math.min(d, Math.hypot(p.pos.x - x, p.pos.z - z));
    return d;
  };
  /** A one-way trigger fired (boss arena): bring anyone still outside to the player who set it off. */
  CC.gather = function (test) {
    if (!CC.host()) return;
    const ps = CC.players(), inside = ps.find((p) => test(p.pos)); if (!inside) return;
    const at = inside.pos, P = CF.Player;
    if (!test(P.body.pos) && P.alive) { P.body.pos.set(at.x + 1.2, at.y + 0.2, at.z); P.body.vel.set(0, 0, 0); }
    for (const p of ps) if (p.id && !test(p.pos)) CF.Net.sendTo(p.id, { t: 'cc', k: 'ev', f: 'tp', a: [+at.x.toFixed(2), +(at.y + 0.2).toFixed(2), +(at.z - 1.2).toFixed(2)] });
  };
  /** Something kills everyone (the ice shelf gives way). */
  CC.killAll = function (src) {
    const P = CF.Player;
    if (P.alive) P.damage(999, null, src);
    if (CC.host()) CF.Net.broadcast({ t: 'cc', k: 'ev', f: 'kill', a: [src] });
  };

  // ------------------------------------------------------------ lobby and start
  /** After the map loads (host or partner): the deploy screen. */
  CC.enter = function (info) {
    const G = CF.Game, M = MP();
    if (info) { CC.campaign = info.c; CF.settings.difficulty = info.d; CF.settings.noDrones = !!info.nd; }
    else CC.campaign = M.map;
    CF.settings.campaign = CC.campaign;
    const C = CF.Campaigns[CC.campaign];
    CF.Mission = C.mission;
    G.mode = 'campaign'; G.mpLobby = true;
    document.body.classList.add('coop');
    G.initAudio(); A.resume(); A.setPaused(false);
    CF.Music.setTheme(C.music);
    CF.Coop.reset(); CC.last = {}; CC.failT = 0; CC.deployed = false;
    if (CC.mirror()) G.resetLevel();
    CF.Player.alive = false;
    G.mpBusy(false);
    G.state = 'mpmenu';
    CC.renderMenu();
    CF.Input.active = false; CF.Input.exitLock();
    G.showScreen('mpmenu');
  };
  CC.renderMenu = function () {
    const M = MP(), C = CF.Campaigns[CC.campaign];
    $('mpRoomCode').textContent = CF.Net.code || '-----';
    $('mpRoom').textContent = (C ? C.name : '') + ' · Co-op' + (M.isHost() ? ' · you are hosting' : '');
    $('mpMenuTitle').textContent = CC.deployed ? 'Co-op campaign' : 'Ready to deploy';
    $('mpResumeBtn').textContent = CC.deployed ? 'Resume' : 'Deploy';
    $('mpTeamNote').textContent = CF.diff().label + (CF.settings.noDrones ? ' · no drones' : '') + ' · a teammate can revive you; if you both go down, you restart at the last checkpoint.';
    $('mpTeamNote').style.color = '';
    CC.renderBoard($('mpBoard'));
  };
  CC.renderBoard = function (el) {
    const M = MP(), ph = CF.Mission.phases && CF.Mission.phases[CF.Mission.idx || 0];
    el.textContent = ''; el.classList.remove('ph');
    const top = document.createElement('div'); top.className = 'sb-teams';
    const a = document.createElement('b'); a.style.color = '#37f3ff'; a.textContent = ph ? ph.num : 'Co-op';
    const b = document.createElement('b'); b.style.color = '#ffe14d'; b.textContent = ph ? ph.title : '';
    top.append(a, b); el.appendChild(top);
    const head = document.createElement('div'); head.className = 'sb-row sb-head';
    head.innerHTML = '<span>Operative</span><span>Kills</span><span>Downs</span>';
    el.appendChild(head);
    for (const id in M.players) {
      const p = M.players[id], d = document.createElement('div'); d.className = 'sb-row' + (id === M.myId ? ' me' : '');
      const n = document.createElement('span'); n.textContent = p.name; n.style.borderLeftColor = '#37f3ff';
      const k = document.createElement('span'); k.textContent = p.kills || 0;
      const de = document.createElement('span'); de.textContent = p.downs || 0;
      d.append(n, k, de); el.appendChild(d);
    }
  };
  /** Deploy (or resume) from the menu. The host starts the mission; the partner spawns beside the host's checkpoint. */
  CC.deploy = function () {
    const G = CF.Game;
    G.showScreen(null); CF.HUD.show(true);
    CF.Input.active = true; CF.Input.clearAll();
    if (!CF.Input.freeLook) CF.Input.requestLock();
    if (CC.deployed) { G.state = 'playing'; return; }
    CC.deployed = true; G.mpLobby = false;
    if (CC.host()) {
      if (G.audioOn) { CF.Music.boss = false; CF.Music.start('game'); CF.Music.setIntensity(0.14); }
      G.newGame(null, true);
    } else {
      G.stats = G.newStats(); G.score = 0; CF.HUD.setScore(0); CF.HUD.reset();
      CF.Weapons.reset(null); CF.Streak.reset();
      CC.spawnAt(CC.last.cp || L.points.start);
      if (G.audioOn) { CF.Music.boss = false; CF.Music.start('game'); CF.Music.setIntensity(0.14); }
    }
    MP().sendState();
  };
  CC.spawnAt = function (s) {
    const G = CF.Game, P = CF.Player;
    CF.Coop.standUp();
    P.spawn(s.x + (CC.host() ? 0 : 1.2), s.y + 0.1, s.z, s.yaw || 0, { health: 100, armor: P.armor || 0 });
    G.state = 'playing';
    CF.Post.setState({ fade: 1, low: 0, hurt: 0 });
  };
  CC.openMenu = function () {
    const G = CF.Game; if (!CC.on()) return false;
    G.state = 'mpmenu';
    CF.Input.active = false; CF.Input.clearAll(); CF.Input.exitLock();
    CC.renderMenu(); G.backTo = 'mpmenu'; G.showScreen('mpmenu');
    return true;
  };

  // ------------------------------------------------------------ host → partner: the world
  const matKey = (m) => { for (const k in L.mats) if (L.mats[k] === m) return k; return null; };
  function snapshot() {
    const MS = CF.Mission, G = CF.Game, H = CF.HUD, t = H.objTarget;
    const it = L.interactables.filter((i) => i.id && i.type !== 'ammo').map((i) => [i.id, i.enabled ? 1 : 0, i.done ? 1 : 0, i.screen ? matKey(i.screen.material) : null,
      i.lamp && i.lamp.color ? i.lamp.color.getHex() : null, i.lamp && i.lamp.on != null ? (i.lamp.on ? 1 : 0) : null, i.mesh ? (i.mesh.visible ? 1 : 0) : null]);
    const doors = Object.keys(L.doors).map((id) => [id, L.doors[id].open ? 1 : 0]);
    const cp = G.cp && G.cp.spawn;
    return {
      t: 'cc', k: 'w', i: MS.idx, st: MS.saveState ? MS.saveState() : null, it, d: doors,
      obj: CC.hud.obj, pr: CC.hud.prog, cd: CC.hud.cd, tg: t ? [+t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1)] : null, lbl: H.el.wmLabel ? H.el.wmLabel.textContent : '',
      storm: +CF.Frost.stormTarget.toFixed(2), cold: CF.Frost.cold ? 1 : 0, w: Object.keys(CF.Weapons.inv), cp: cp ? { x: cp.x, y: cp.y, z: cp.z, yaw: cp.yaw } : null,
      mu: [+(CF.Music.target || 0).toFixed(2), CF.Music.boss ? 1 : 0]
    };
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /** Partner: bring the world in line with the host's. */
  CC.applyWorld = function (w) {
    const MS = CF.Mission, G = CF.Game, H = CF.HUD, last = CC.last;
    if (w.i !== last.i || !same(w.st, last.st)) {
      MS.idx = w.i; MS.phase = MS.phases[w.i];
      if (MS.syncWorld && w.st) MS.syncWorld(w.i, Object.assign({ retry: true }, w.st, { cells: (w.st.cells || []).slice() }));
    }
    for (const e of w.it) {
      const it = L.interactables.find((i) => i.id === e[0]); if (!it) continue;
      it.enabled = !!e[1]; it.done = !!e[2];
      if (e[3] && it.screen && L.mats[e[3]]) it.screen.material = L.mats[e[3]];
      if (e[4] != null && it.lamp && it.lamp.color && it.lamp.color.getHex() !== e[4]) { it.lamp.color.setHex(e[4]); const n = e[4] === 0x40ff70 ? 'green' : e[4] === 0xffa020 ? 'amber' : e[4] === 0xff3020 ? 'red' : null; if (n) G.setLamp(it.lamp, n); }
      if (e[5] != null && it.lamp) it.lamp.on = !!e[5];
      if (e[6] != null && it.mesh) it.mesh.visible = !!e[6];
    }
    for (const [id, open] of w.d) { const d = L.doors[id]; if (!d) continue; if (open && !d.open) L.openDoor(id); else if (!open && d.open) L.closeDoor(id); }
    if (!same(w.obj, last.obj) && w.obj) CC.orig.setObjective.apply(H, [w.obj[0], w.obj[1], w.obj[2] ? new THREE.Vector3(w.obj[2][0], w.obj[2][1], w.obj[2][2]) : null, w.obj[3]]);
    if (!same(w.pr, last.pr) && w.pr) CC.orig.setProgress.apply(H, w.pr);
    if (!same(w.cd, last.cd)) CC.orig.countdown.apply(H, w.cd || [null, null]);
    H.objTarget = w.tg ? (H.objTarget && H.objTarget.isVector3 ? H.objTarget.set(w.tg[0], w.tg[1], w.tg[2]) : new THREE.Vector3(w.tg[0], w.tg[1], w.tg[2])) : null;
    if (w.lbl && H.el.wmLabel && H.el.wmLabel.textContent !== w.lbl) H.el.wmLabel.textContent = w.lbl;
    if (w.storm !== last.storm) CF.Frost.setStorm(w.storm);
    CF.Frost.cold = !!w.cold;
    const WP = CF.Weapons;
    for (const id of w.w) if (!WP.inv[id] && CF.Player.alive) { WP.give(id, true); A.play('weaponGet', null, { ui: true }); CF.HUD.popup('Unlocked · ' + WP.defs[id].name, 0, 'obj'); }
    if (w.mu) { CF.Music.setIntensity(w.mu[0]); CF.Music.boss = !!w.mu[1]; }
    CC.last = { i: w.i, st: w.st, obj: w.obj, pr: w.pr, cd: w.cd, storm: w.storm, cp: w.cp };
  };
  CC.orig = {};
  /** One-off events the host forwards: radio, phase cards, objective popups, the Skua, victory, wipe, teleport, kill. */
  function hook(obj, name, key, filter) {
    const fn = obj[name]; CC.orig[name] = fn;
    obj[name] = function (...a) {
      if (CC.host() && (!filter || filter(a))) CF.Net.broadcast({ t: 'cc', k: 'ev', f: key, a: a.map((v) => (v && v.isVector3 ? [v.x, v.y, v.z] : v)) });
      return fn.apply(this, a);
    };
  }
  /** HUD calls the snapshot covers (latest value wins): remember them. */
  function track(name, field, conv) {
    const fn = CF.HUD[name]; CC.orig[name] = fn;
    CF.HUD[name] = function (...a) { if (CC.host()) CC.hud[field] = conv(a); return fn.apply(this, a); };
  }
  CC.install = function () {
    const H = CF.HUD;
    hook(H, 'radio', 'radio'); hook(H, 'phaseCard', 'card');
    hook(H, 'popup', 'pop', (a) => a[2] === 'obj');
    track('setObjective', 'obj', (a) => [a[0], a[1], a[2] ? [+a[2].x.toFixed(1), +a[2].y.toFixed(1), +a[2].z.toFixed(1)] : null, a[3]]);
    track('setProgress', 'prog', (a) => [a[0], a[1]]);
    track('countdown', 'cd', (a) => (a[0] == null ? null : [a[0], Math.ceil(a[1])]));
    if (CF.MapHalden && CF.MapHalden.skuaSet) { const f = CF.MapHalden.skuaSet; CF.MapHalden.skuaSet = function (s) { if (CC.host()) CF.Net.broadcast({ t: 'cc', k: 'ev', f: 'skua', a: [s] }); return f.call(this, s); }; }
    installBosses();
  };
  function onEvent(f, a) {
    const H = CF.HUD, G = CF.Game;
    switch (f) {
      case 'radio': CC.orig.radio.apply(H, a); return;
      case 'card': CC.orig.phaseCard.apply(H, a); return;
      case 'pop': CC.orig.popup.apply(H, a); return;
      case 'skua': if (CF.MapHalden) CF.MapHalden.skuaSet(a[0]); return;
      case 'win': if (G.state === 'playing' || G.state === 'paused' || G.state === 'mpmenu') { G.state = 'playing'; G.victory(); } return;
      case 'fail': CC.startFail(); return;
      case 'restart': CC.restart(a[0]); return;
      case 'tp': { const P = CF.Player; if (P.alive) { P.body.pos.set(a[0], a[1], a[2]); P.body.vel.set(0, 0, 0); } return; }
      case 'kill': if (CF.Player.alive) CF.Player.damage(999, null, a[0]); return;
    }
  }
  CC.onClientMsg = function (msg) {
    if (msg.t !== 'cc') return false;
    if (msg.k === 'w') CC.applyWorld(msg); else if (msg.k === 'ev') onEvent(msg.f, msg.a || []);
    return true;
  };
  /** Host: the partner finished an objective interaction. */
  CC.onUse = function (from, msg) {
    const it = L.interactables.find((i) => i.id === msg.id);
    if (it && it.enabled && it.type !== 'ammo') CF.Game.useInteract(it, true);
  };
  /** Partner: objective interactions go to the host (ammo crates stay local). Returns true when forwarded. */
  CC.forward = function (it) {
    if (!CC.mirror() || it.type === 'ammo') return false;
    it.enabled = false; // until the host's snapshot says otherwise
    MP().post({ t: 'use', id: it.id });
    return true;
  };

  // ------------------------------------------------------------ both down: back to the checkpoint
  CC.startFail = function () {
    if (CC.failT > 0) return;
    CC.failT = FAIL_T;
    CF.HUD.phaseCard('Mission failed', 'Both operatives down', 'Back to the last checkpoint');
    CF.Music.sting('death'); CF.Post.setState({ fade: 0.5 });
  };
  CC.restart = function (cp) {
    const G = CF.Game;
    CC.failT = 0; CF.Coop.standUp();
    if (CC.host()) G.restoreCheckpoint(true);
    else CC.spawnAt(cp || CC.last.cp || L.points.start);
    CF.Post.setState({ fade: 1 });
  };

  // ------------------------------------------------------------ per frame
  CC.update = function (dt) {
    if (!CC.on() || CF.Game.mpLobby) return;
    if (CC.host()) {
      CC.snapT -= dt;
      if (CC.snapT <= 0) { CC.snapT = SNAP; CF.Net.broadcast(snapshot()); }
      const team = CF.Coop.team();
      if (CC.failT <= 0 && team.up === 0 && team.down > 0) { CF.Net.broadcast({ t: 'cc', k: 'ev', f: 'fail', a: [] }); CC.startFail(); }
    }
    if (CC.failT > 0) {
      CC.failT -= dt;
      if (CC.failT <= 0 && CC.host()) {
        CC.restart();
        const cp = CF.Game.cp && CF.Game.cp.spawn;
        CF.Net.broadcast({ t: 'cc', k: 'ev', f: 'restart', a: [cp ? { x: cp.x, y: cp.y, z: cp.z, yaw: cp.yaw } : null] });
      }
    }
  };

  // ------------------------------------------------------------ bosses as ghosts on the partner's screen
  const STATES = ['intro', 'fight', 'stagger', 'dying', 'dead'];
  function installBosses() {
    for (const K of [CF.Boss, CF.HeartBoss]) {
      if (!K || K.prototype.ghostCode) continue;
      const P = K.prototype, upd = P.update, dmg = P.damage, xdmg = P.explosionDamage;
      const warden = K === CF.Boss;
      P.ghostCode = function () {
        const parts = warden ? this.cores : this.pylons, open = warden ? this.doors : this.open;
        let c = Math.max(0, STATES.indexOf(this.state));
        parts.forEach((p, i) => { if (p.dead) c |= 8 << i; });
        return c | (Math.round((open || 0) * 15) << 6) | (this.enraged ? 1024 : 0);
      };
      P.update = function (dt, T) { if (this.ghost) { ghostStep(this, dt, warden); return; } return upd.call(this, dt, T); };
      P.damage = function (amount, info) {
        if (!this.ghost) {
          // a partner's hit arrives with just the part name
          if (info.remotePart) info = Object.assign({}, info, { part: this.hit.find((h) => h.key === info.remotePart) || null });
          return dmg.call(this, amount, info);
        }
        if (!this.alive || this.state === 'intro' || this.state === 'dying') return null;
        const part = info.part;
        if (part && part.weak) {
          const mult = info.weapon === 'rail' ? 1.6 : info.weapon === 'shotgun' ? 0.9 : 1.25;
          this.flash = 0.1;
          if (info.point) { CF.FX.botHit(info.point, info.normal || new THREE.Vector3(0, 1, 0), true); CF.HUD.dmgNumber(info.point, amount * mult, 'weak'); }
          CF.HUD.hitmarker('head'); A.play('headshot', null, { ui: true });
          MP().post({ t: 'eh', id: this.nid, d: Math.round(amount * 10) / 10, part: part.key, w: info.weapon || '' });
          return { head: true, dealt: amount * mult };
        }
        if (info.point) CF.FX.sparks(info.point.x, info.point.y, info.point.z, 0, 1, 0, 4, 5);
        CF.HUD.hitmarker('armor'); A.play('armorHit', null, { ui: true });
        return { head: false, dealt: 0, armored: true };
      };
      P.explosionDamage = function (pos, radius, d) {
        if (!this.ghost) return xdmg.call(this, pos, radius, d);
        if (!this.alive || this.state === 'intro' || this.state === 'dying') return;
        for (const h of this.hit) {
          if (!h.on || !h.weak) continue;
          const dist = h.w.distanceTo(pos);
          if (dist < radius + 0.8) { MP().post({ t: 'eh', id: this.nid, x: 1, d: Math.round(d * (1 - dist / (radius + 0.8)) * 1.2 * 10) / 10, part: h.key, raw: 1 }); this.flash = 0.1; CF.HUD.hitmarker('head'); }
        }
      };
      P.ghostDie = function () {
        const c = this.center(new THREE.Vector3());
        CF.FX.explosion(c, 2.2); A.play(warden ? 'roar' : 'heartRoar', c, { ref: 20 });
        CF.HUD.bossBar(false);
        this.alive = false; this.state = 'dead';
        if (this.remove) this.remove(); else { CF.Enemies.scene.remove(this.root); const i = CF.Enemies.list.indexOf(this); if (i >= 0) CF.Enemies.list.splice(i, 1); }
      };
    }
  }
  function ghostStep(g, dt, warden) {
    const b = g.body, t = g.gt, c = t.code, st = STATES[c & 7];
    b.pos.x = U.damp(b.pos.x, t.x, 6, dt); b.pos.z = U.damp(b.pos.z, t.z, 6, dt);
    const mv = Math.hypot(t.x - b.pos.x, t.z - b.pos.z);
    g.yaw += U.wrapAngle(t.yaw - g.yaw) * Math.min(1, dt * 6);
    g.flash = Math.max(0, (g.flash || 0) - dt); g.stateT += dt;
    g.enraged = !!(c & 1024);
    const parts = warden ? g.cores : g.pylons;
    parts.forEach((p, i) => { const dead = !!(c & (8 << i)); if (dead && !p.dead) { p.dead = true; if (warden) p.c.mesh.visible = false; else p.node.visible = false; CF.FX.explosion(warden ? p.c.group.getWorldPosition(new THREE.Vector3()) : p.pos, 1.2); } });
    if (warden) g.doors = ((c >> 6) & 15) / 15; else g.open = ((c >> 6) & 15) / 15;
    if (st === 'intro' || g.riseT < 1) {
      g.riseT = Math.min(1, (g.riseT || 0) + dt / (warden ? 4.5 : 5));
      const e = U.easeInOut(g.riseT);
      g.root.position.set(b.pos.x, g.floorY - (warden ? 9 : 11) * (1 - e), b.pos.z);
      if (!warden) for (let i = 0; i < 3; i++) { const pl = g.pylons[i], k = U.easeOutCubic(U.clamp(g.riseT * 1.4 - i * 0.15, 0, 1)); pl.g.position.y = g.floorY - 7 * (1 - k); }
      if (g.lamp) { g.lamp.on = true; g.lamp.intensity = 4 * e; }
    } else g.root.position.set(b.pos.x, g.floorY, b.pos.z);
    if (st !== 'intro') g.state = st === 'dead' ? 'dying' : st;
    if (warden) { g.root.rotation.y = g.yaw; g.m.M.hull.emissive.setRGB(g.flash > 0 ? 0.6 : 0, g.flash > 0 ? 0.48 : 0, g.flash > 0 ? 0.42 : 0); g.walk = U.damp(g.walk || 0, mv > 0.2 ? 1 : 0, 3, dt); g.pose(dt, g.walk); }
    else { g.m.p.body.rotation.y = g.yaw; g.pose(dt); }
    g.root.updateMatrixWorld(true); g.placeHits();
    if (g.riseT >= 1 && st !== 'dead') {
      const label = warden ? (g.phase === 1 && !parts.every((p) => p.dead) ? 'Destroy the shoulder cores' : 'Destroy the exposed core') : (!parts.every((p) => p.dead) ? 'Shatter the feeder pylons' : 'Destroy the exposed core');
      CF.HUD.bossBar(true, U.clamp(t.pitch, 0, 1), g.enraged ? 'Finish it' : label);
    }
  }
  /** Ghost bosses report their health as a fraction in the snapshot's pitch slot. */
  CF.Coop.bossCode = (e) => e.ghostCode();
  CC.install();
})(window.CF);
