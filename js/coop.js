'use strict';
/* Cinderfall — co-op core, shared by Zombies and the co-op campaign.
   The host runs every enemy. Each one hunts the nearest standing player: the host itself, or a stand-in for a remote
   player that turns melee, bolts and blasts into 'ehit' messages to that player. The host streams a compact snapshot
   of the enemies ('en', ten times a second) plus their deaths ('ed') and shots ('ef', 'el') to everyone else, who draw
   "ghost" copies. Shooting a ghost shows the hit locally and sends the damage to the host ('eh'); the kill is credited
   back ('ek'). Players who run out of health go down instead of dying: they crawl and can't shoot, and a teammate
   who holds interact next to them brings them back ('rev'). Everyone down at once ends the round (Zombies) or the
   attempt (campaign). All of it rides the existing host relay; the server only passes messages along. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const SNAP = 0.1, REVIVE_T = 3, REVIVE_R = 2.2, REVIVE_HP = 50, CRAWL = 0.28, BLEED_ZOMBIES = 30;
  // Co-op campaign tuning (see the README): enemies get 1.4x health to absorb the second gun, their damage to a player
  // stays as solo, and a fallen player can be revived. Net effect: a little easier than solo at the same difficulty.
  const COOP_HP = 1.4, COOP_DMG = 1.0, COOP_AGGRO = 1.05;
  const $ = (id) => document.getElementById(id);
  const MP = () => CF.MP;
  const C = CF.Coop = { targets: [], stands: {}, ghosts: {}, nid: 0, snapT: 0, downed: false, bleed: 0, reviveT: 0, reviveId: null, prompting: false, fallen: {}, COOP_HP, COOP_DMG };

  C.on = () => !!(MP() && MP().active && (MP().mode === 'zombies' || MP().mode === 'coop'));
  C.campaign = () => C.on() && MP().mode === 'coop';
  /** This browser runs the enemies (the host, or anyone playing alone). */
  C.hostSim = () => C.on() && MP().isHost();
  C.client = () => C.on() && !MP().isHost();
  C.coopDiff = function () {
    const b = CF.DIFF[CF.settings.difficulty] || CF.DIFF.veteran;
    if (C.diffBase !== b) { C.diffBase = b; C.diffCache = Object.assign({}, b, { hp: b.hp * COOP_HP, dmg: b.dmg * COOP_DMG, aggro: b.aggro * COOP_AGGRO }); }
    return C.diffCache;
  };

  // ------------------------------------------------------------ host: who the enemies hunt
  /** A remote player as the enemies see them. */
  class Stand {
    constructor(id) { this.id = id; this.net = true; this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), height: 1.8 }; this.eye = 1.64; this.crouching = false; this.sprinting = false; this.alive = false; this.chillT = 0; this.last = null; }
    sync(r, dt) {
      const b = this.body;
      if (this.last && dt > 0) { const k = Math.min(1, dt * 8); b.vel.x += ((r.body.pos.x - this.last.x) / dt - b.vel.x) * k; b.vel.z += ((r.body.pos.z - this.last.z) / dt - b.vel.z) * k; b.vel.y = 0; }
      this.last = (this.last || new THREE.Vector3()).copy(r.body.pos);
      b.pos.copy(r.body.pos); this.crouching = r.crouch > 0.5;
      this.alive = r.alive && !r.dead && !r.downed;
    }
    chestPos(out) { return out.set(this.body.pos.x, this.body.pos.y + (this.crouching ? 0.72 : 1.12), this.body.pos.z); }
    eyePos(out) { return out.set(this.body.pos.x, this.body.pos.y + (this.crouching ? 1.0 : this.eye), this.body.pos.z); }
    damage(amount, from, source) {
      if (!this.alive) return;
      const f = from ? [+from.x.toFixed(2), +from.y.toFixed(2), +from.z.toFixed(2)] : null;
      CF.Net.sendTo(this.id, { t: 'ehit', dmg: Math.round(amount * 10) / 10, from: f, src: source || 'the infected' });
    }
    shake() {}
    forward(out) { return out.set(0, 0, -1); }
  }
  const NOBODY = { alive: false, net: true, body: { pos: new THREE.Vector3(0, -999, 0), vel: new THREE.Vector3(), height: 1.8 }, eye: 1.6, chestPos: (o) => o.set(0, -998, 0), eyePos: (o) => o.set(0, -998, 0), damage() {}, shake() {} };
  /** Local player as a target: standing, not down, in the game. */
  const localUp = () => CF.Player.alive && !C.downed && !(CF.Game.mode === 'mp' && CF.Game.mpLobby);
  function refreshTargets(dt) {
    const M = MP(), list = C.targets; list.length = 0;
    if (localUp()) list.push(CF.Player);
    for (const id in M.remotes) {
      const r = M.remotes[id], st = C.stands[id] || (C.stands[id] = new Stand(id));
      st.sync(r, dt); if (st.alive) list.push(st);
    }
    for (const id in C.stands) if (!M.remotes[id]) delete C.stands[id];
  }
  /** The target an enemy hunts: its nearest standing player, re-picked every so often so it doesn't flip-flop. */
  C.targetFor = function (e) {
    e.tgtT = (e.tgtT || 0) - 1 / 60;
    if (e.tgt && e.tgt.alive && e.tgtT > 0 && C.targets.includes(e.tgt)) return e.tgt;
    let best = NOBODY, bd = Infinity;
    for (const t of C.targets) { const d = t.body.pos.distanceToSquared(e.body.pos); if (d < bd) { bd = d; best = t; } }
    if (best !== e.tgt && best.alive && e.lastKnown) e.lastKnown.copy(best.body.pos);
    e.tgt = best;
    e.tgtT = 0.8;
    return best;
  };
  C.computeFlow = function () {
    const t = C.targets;
    if (!t.length) return false;
    return W.computeFlow(t[0].body.pos.x, t[0].body.pos.z, t.slice(1).map((s) => [s.body.pos.x, s.body.pos.z]));
  };
  /** Enemy explosions also reach remote players (G.explode only knows the local one). */
  C.splash = function (at, R, D, killer) {
    const _c = new THREE.Vector3();
    for (const t of C.targets) {
      if (!t.net) continue;
      t.chestPos(_c); const d = _c.distanceTo(at);
      if (d < R + 0.5 && W.segmentClear(at.x, at.y + 0.2, at.z, _c.x, _c.y, _c.z)) t.damage(D * U.clamp(1 - d / (R + 0.5), 0, 1), at, killer || 'an explosion');
    }
  };
  /** A partner shot an enemy: it turns on them. */
  C.allyAggro = function (e, by) { const r = MP().remotes[by]; if (r) { e.becomeAware(r.body.pos, true); e.lastKnown.copy(r.body.pos); e.seenT = CF.time; } };

  // ------------------------------------------------------------ host: streaming the enemies
  const TYPE_KEYS = () => C.typeKeys || (C.typeKeys = Object.keys(CF.Enemies.types));
  const code = (e) => {
    const s = e.state === 'combat' ? 2 : e.state === 'hunt' ? 1 : e.state === 'alert' ? 3 : 0;
    return s | (e.staggerT > 0 ? 4 : 0) | (e.leapState === 'air' ? 8 : 0) | (e.biteT > 0 || e.windT > 0 ? 16 : 0) | (e.spawnT < 1 ? 32 : 0);
  };
  function snapshot() {
    const out = [];
    for (const e of CF.Enemies.list) {
      if (e.net || !e.alive) continue;
      if (!e.nid) e.nid = ++C.nid;
      const ti = e.boss ? (e instanceof CF.Boss ? -1 : -2) : TYPE_KEYS().indexOf(e.type);
      const b = e.body.pos;
      out.push(e.nid, ti, +b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +(e.yaw || 0).toFixed(2), e.boss ? +(e.totalHp / e.totalMax).toFixed(3) : +(e.aimPitch || 0).toFixed(2), e.boss ? C.bossCode(e) : code(e)); // bosses: health fraction instead of aim
    }
    return out;
  }
  C.enemyDied = function (e, info, head) {
    if (!C.hostSim() || !e.nid) return;
    const d = info && info.dir;
    CF.Net.broadcast({ t: 'ed', id: e.nid, h: head ? 1 : 0, d: d ? [+d.x.toFixed(2), +d.z.toFixed(2)] : null });
  };
  C.enemyShot = function (e, muzzle, dir) {
    if (!C.hostSim() || !e.nid) return;
    CF.Net.broadcastFast({ t: 'ef', id: e.nid, m: [+muzzle.x.toFixed(2), +muzzle.y.toFixed(2), +muzzle.z.toFixed(2)], d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)] });
  };
  C.enemyLob = function (e, from, target) {
    if (!C.hostSim() || !e.nid) return;
    CF.Net.broadcast({ t: 'el', id: e.nid, f: [+from.x.toFixed(2), +from.y.toFixed(2), +from.z.toFixed(2)], g: [+target.x.toFixed(2), +target.y.toFixed(2), +target.z.toFixed(2)], lob: e.T.lob ? 1 : 0 });
  };
  C.byNid = (id) => CF.Enemies.list.find((e) => e.nid === id && !e.net) || null;
  /** Host: a partner's hit on one of our enemies. */
  C.onEnemyHit = function (from, msg) {
    const e = C.byNid(msg.id); if (!e || !e.alive) return;
    const dir = msg.dir ? new THREE.Vector3(msg.dir[0], 0, msg.dir[1]) : null;
    if (e.boss) { // a weak point by name: direct hits go through the boss's own rules, blasts straight to the part
      if (msg.raw && msg.part && e.applyWeak) { if (e.state !== 'intro' && e.state !== 'dying') { e.applyWeak(msg.part, msg.d); e.flash = 0.1; } }
      else e.damage(msg.d, { remotePart: msg.part, weapon: msg.w || null, source: 'ally', by: from });
      return;
    }
    e.damage(msg.d, { raw: true, head: !!msg.h, source: 'ally', by: from, dir, knock: msg.x ? 6 : 1.5, explosive: !!msg.x });
  };
  /** Host: someone (us or a partner) finished an enemy. Returns true if the kill belongs to a partner. */
  C.creditKill = function (e, info, head) {
    const M = MP(), by = info && info.by, id = by || M.myId, pl = M.players[id];
    if (pl) pl.kills = (pl.kills || 0) + 1;
    if (C.zombies()) CF.ZM.onKill(e);
    if (!by || by === M.myId) return false;
    CF.Net.sendTo(by, { t: 'ek', n: e.name, s: (e.T && e.T.score) || 100, h: head ? 1 : 0, x: info.explosive ? 1 : 0 });
    return true;
  };
  C.zombies = () => MP() && MP().active && MP().mode === 'zombies';
  /** Host: loot dropped by a kill shows up for everyone (each player can pick up their own copy). */
  C.onDrop = function (type, p, data) {
    if (!C.hostSim()) return;
    CF.Net.broadcast({ t: 'drop', k: type, p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], a: data && data.amount });
  };

  // ------------------------------------------------------------ clients: ghosts
  C.onSnapshot = function (msg) {
    const l = msg.l || [], now = CF.time, E = CF.Enemies, keys = TYPE_KEYS();
    for (let i = 0; i + 7 < l.length; i += 8) {
      const id = l[i], ti = l[i + 1];
      let g = C.ghosts[id];
      if (!g || g.gone) {
        if (ti < 0) { g = C.makeBossGhost(ti, l[i + 2], l[i + 3], l[i + 4]); if (!g) continue; }
        else {
          const type = keys[ti]; if (!type) continue;
          g = new E.Enemy(type, l[i + 2], l[i + 3], l[i + 4], { ghost: true, nid: id, noScore: true, yaw: l[i + 5], spawnFx: !!(l[i + 7] & 32) });
          E.list.push(g);
        }
        g.nid = id; C.ghosts[id] = g;
      }
      g.seen = now;
      if (g.gt) { g.gt.x = l[i + 2]; g.gt.y = l[i + 3]; g.gt.z = l[i + 4]; g.gt.yaw = l[i + 5]; g.gt.pitch = l[i + 6]; g.gt.code = l[i + 7]; }
    }
  };
  function sweepGhosts() {
    const now = CF.time;
    for (const id in C.ghosts) {
      const g = C.ghosts[id];
      if (!g.alive) { if (!CF.Enemies.list.includes(g)) delete C.ghosts[id]; continue; }
      if (now - g.seen > 1.5) { g.gone = true; g.alive = false; g.remove(); delete C.ghosts[id]; } // despawned on the host without dying
    }
  }
  C.onGhostDied = function (msg) {
    const g = C.ghosts[msg.id]; if (!g || !g.alive) return;
    if (g.boss) { if (g.ghostDie) g.ghostDie(); return; }
    g.die({ dir: msg.d ? new THREE.Vector3(msg.d[0], 0, msg.d[1]) : null }, !!msg.h);
  };
  C.onGhostShot = function (msg) {
    const g = C.ghosts[msg.id]; if (!g || !g.alive || !g.T) return;
    const T = g.T, m = new THREE.Vector3(msg.m[0], msg.m[1], msg.m[2]), d = new THREE.Vector3(msg.d[0], msg.d[1], msg.d[2]);
    CF.Enemies.shoot(T.bolt, m, d, T.projSpeed, 0, g);
    CF.Enemies.proj[CF.Enemies.proj.length - 1].ghost = true;
    if (T.frost) CF.FX.muzzle(m, d, 1.2, 3.4, 5, g.kind === 'juggernaut' ? 1.1 : 0.6); else CF.FX.muzzle(m, d, 5, 1.4, 0.5, g.kind === 'juggernaut' ? 1.1 : 0.6);
    A.play(T.sfx || (g.kind === 'hornet' ? 'droneShot' : g.kind === 'juggernaut' ? 'heavyShot' : 'enemyShot'), m, { ref: 6 });
    g.recoil = 1;
  };
  C.onGhostLob = function (msg) {
    const g = C.ghosts[msg.id], E = CF.Enemies;
    const from = new THREE.Vector3(msg.f[0], msg.f[1], msg.f[2]), to = new THREE.Vector3(msg.g[0], msg.g[1], msg.g[2]);
    if (msg.lob) E.mortar(from, to, 1.25, g || null, 0, 'shardLob'); else E.rocket(from, to, g || null);
    E.proj[E.proj.length - 1].ghost = true;
  };
  /** Client: we shot a ghost. Show the hit, let the host decide what it did. */
  C.ghostHit = function (g, dmg, tag, info) {
    if (!g.alive || g.spawnT < 1) return null;
    g.flashT = 0.09; g.flinch = Math.min(1, g.flinch + dmg / 40);
    if (info.point) CF.FX.botHit(info.point, info.normal || new THREE.Vector3(0, 1, 0), tag === 'weak');
    if (info.point) A.play('impactBot', info.point, { ref: 4 });
    if (info.source === 'player') {
      CF.HUD.hitmarker(tag === 'head' || tag === 'weak' ? 'head' : 'hit');
      if (info.point) CF.HUD.dmgNumber(info.point, dmg, tag === 'head' ? 'head' : tag === 'weak' ? 'weak' : '');
      A.play(tag === 'head' || tag === 'weak' ? 'headshot' : 'hit', null, { ui: true });
      CF.Game.stats.damageDealt += dmg;
    }
    const d = info.dir;
    MP().post({ t: 'eh', id: g.nid, d: Math.round(dmg * 10) / 10, h: tag === 'head' ? 1 : 0, x: info.explosive ? 1 : 0, dir: d ? [+d.x.toFixed(2), +d.z.toFixed(2)] : null, part: info.part && info.part.key ? info.part.key : undefined });
    return { head: tag === 'head', dealt: dmg };
  };
  /** Client: the host says we got the kill. */
  C.onKillCredit = function (msg) {
    const G = CF.Game, st = G.stats; st.kills++; if (msg.h) st.headshots++;
    const pts = G.pts((msg.s || 100) + (msg.h ? 50 : 0));
    G.addScore(pts);
    CF.HUD.popup(msg.n + (msg.h ? ' · headshot' : msg.x ? ' · explosive' : ''), pts, msg.h ? 'head' : '');
    CF.HUD.killfeed(msg.n + ' destroyed', msg.h ? 'Headshot' : '');
    CF.HUD.hitmarker('kill');
    if (CF.Game.mode === 'mp') CF.Streak.onKill();
    A.play('kill', null, { ui: true, delay: 0.04 });
  };
  C.onDropMsg = function (msg) {
    const L = CF.Level, p = L.addPickup(msg.k, msg.p[0], msg.p[1], msg.p[2], msg.a ? { amount: msg.a } : {});
    p.dropped = true; p.expire = 30; CF.Game.makePickupMesh(p);
  };
  /** Bosses (campaign) are drawn by their own classes; they register a ghost maker here. */
  C.bossCode = (e) => (e.ghostCode ? e.ghostCode() : 0);
  C.makeBossGhost = function (ti, x, y, z) {
    const K = ti === -1 ? CF.Boss : CF.HeartBoss; if (!K) return null;
    const g = new K(x, y, z); g.ghost = true; g.gt = { x, y, z, yaw: 0, pitch: 1, code: 0 };
    CF.Enemies.list.push(g);
    return g;
  };

  // ------------------------------------------------------------ downed and revived
  /** P.die calls this first: in co-op you go down instead. Returns true when the death was turned into a down. */
  C.intercept = function (source) {
    if (!C.on() || C.dying || C.downed) return false;
    const P = CF.Player;
    C.downed = true; C.downBy = source; C.bleed = C.zombies() ? BLEED_ZOMBIES : Infinity;
    C.speed = P.speedMul || 1;
    P.health = 1; P.sprinting = false; P.sliding = false; P.crouching = true; P.body.height = 1.15;
    CF.Weapons.adsToggle = false; CF.HUD.showScope(false);
    document.body.classList.add('coop-downed');
    CF.HUD.setVitals(1, P.armor);
    A.play('hurt'); CF.HUD.popup('Downed · hold on for a teammate', 0, '');
    CF.HUD.killfeed(MP().name + ' is down', source || '');
    MP().post({ t: 'down', src: source || '' });
    MP().sendState();
    return true;
  };
  C.revived = function (byName) {
    if (!C.downed) return;
    const P = CF.Player;
    C.downed = false; P.health = REVIVE_HP; P.speedMul = C.speed || 1;
    document.body.classList.remove('coop-downed');
    CF.HUD.setVitals(P.health, P.armor);
    CF.HUD.popup('Revived' + (byName ? ' by ' + byName : ''), 0, 'obj'); A.play('spawn', null, { ui: true, vol: 0.6 });
    MP().sendState();
  };
  /** Clear the downed state without effects (respawn, new wave, checkpoint, leaving). */
  C.standUp = function () {
    if (!C.downed) return;
    C.downed = false; CF.Player.speedMul = C.speed || CF.Player.speedMul || 1;
    document.body.classList.remove('coop-downed');
  };
  C.bleedOut = function () {
    C.standUp(); C.dying = true;
    try { CF.Player.die('Bled out'); } finally { C.dying = false; }
  };
  function nameOf(id) { const p = MP().players[id]; return p ? p.name : 'Operative'; }
  /** A 'rev' reached us: someone brought us back. */
  C.onRevive = function (msg, from) { C.revived(nameOf(msg.by || from)); };
  const _f = new THREE.Vector3();
  function reviveTags() {
    const M = MP();
    for (const id in M.remotes) {
      const r = M.remotes[id];
      if (r.downed && !r.dead && !r.reviveTag) { r.reviveTag = M.nameTag('✚ REVIVE ' + r.name, '#ff5c7a'); r.reviveTag.position.y = 1.0; r.reviveTag.material.depthTest = false; CF.Enemies.scene.add(r.reviveTag); }
      if (r.reviveTag) {
        const on = r.downed && !r.dead;
        r.reviveTag.visible = on;
        if (on) r.reviveTag.position.set(r.body.pos.x, r.body.pos.y + 1.0, r.body.pos.z);
        else { CF.Enemies.scene.remove(r.reviveTag); r.reviveTag = null; }
      }
    }
  }
  function reviveLogic(dt) {
    const P = CF.Player, M = MP(), inp = CF.Input, playing = CF.Game.state === 'playing' && P.alive && !C.downed;
    let best = null, bd = REVIVE_R;
    if (playing) for (const id in M.remotes) {
      const r = M.remotes[id]; if (!r.downed || r.dead) continue;
      const d = Math.hypot(r.body.pos.x - P.body.pos.x, r.body.pos.z - P.body.pos.z);
      if (d < bd && Math.abs(r.body.pos.y - P.body.pos.y) < 1.6) { bd = d; best = id; }
    }
    if (!best) { if (C.prompting) { C.prompting = false; C.reviveT = 0; CF.HUD.interact(null); } return; }
    if (C.reviveId !== best) { C.reviveId = best; C.reviveT = 0; }
    C.prompting = true;
    if (inp.down('KeyE')) C.reviveT += dt; else C.reviveT = Math.max(0, C.reviveT - dt * 2);
    CF.HUD.interact('Hold to revive ' + nameOf(best), C.reviveT / REVIVE_T);
    if (C.reviveT >= REVIVE_T) {
      C.reviveT = 0;
      MP().post({ t: 'rev', to: best, by: M.myId });
      M.remotes[best].downed = false;
      CF.Game.addScore(CF.Game.pts(100)); CF.HUD.popup('Revived ' + nameOf(best), CF.Game.pts(100), 'obj');
      A.play('objective', null, { ui: true, vol: 0.6 });
    }
  }

  // ------------------------------------------------------------ everyone down?
  /** Host: count the team. up: standing players; inGame: standing or down (not bled out, not in the menu). */
  C.team = function () {
    const M = MP(), P = CF.Player; let up = 0, down = 0;
    if (P.alive && !(CF.Game.mode === 'mp' && CF.Game.mpLobby)) { if (C.downed) down++; else up++; }
    for (const id in M.remotes) { const r = M.remotes[id]; if (r.alive && !r.dead) { if (r.downed) down++; else up++; } }
    return { up, down };
  };

  // ------------------------------------------------------------ per frame
  C.reset = function () {
    C.standUp(); C.targets.length = 0; C.stands = {}; C.fallen = {};
    for (const id in C.ghosts) { const g = C.ghosts[id]; if (g.alive) { g.alive = false; g.remove(); } }
    C.ghosts = {}; C.snapT = 0; C.prompting = false; C.reviveT = 0;
  };
  C.update = function (dt) {
    if (!C.on()) { if (C.downed) C.standUp(); return; }
    const P = CF.Player;
    if (C.hostSim()) {
      refreshTargets(dt);
      C.snapT -= dt;
      if (C.snapT <= 0) { C.snapT = SNAP; CF.Net.broadcastFast({ t: 'en', l: snapshot() }); }
    } else sweepGhosts();
    reviveTags();
    if (C.downed) {
      if (!P.alive) { C.standUp(); return; }
      P.health = 1; P.sprinting = false; P.crouching = true; P.body.height = 1.15; P.speedMul = CRAWL;
      CF.HUD.setVitals(1, P.armor);
      C.bleed -= dt;
      const t = isFinite(C.bleed) ? ' · bleeding out in ' + Math.max(0, Math.ceil(C.bleed)) + ' s' : '';
      CF.HUD.hint('Downed · a teammate can revive you (hold ' + CF.Keys.label('interact') + ')' + t, true);
      if (C.bleed <= 0) C.bleedOut();
    }
    reviveLogic(dt);
  };
  C.armed = () => !C.downed;
})(window.CF);
