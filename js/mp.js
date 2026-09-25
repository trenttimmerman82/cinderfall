'use strict';
/* Cinderfall — online multiplayer: remote players, hits, kills, scoring, respawns, loadouts.
   Each client owns its own movement and health; shooters detect hits and tell the victim.
   The host relays messages and keeps the scoreboard and match clock. Prop Hunt's round rules live in js/prophunt.js. */
(function (CF) {
  const U = CF.U, A = CF.Audio;
  const $ = (id) => document.getElementById(id);
  const TEAM = [{ name: 'Voltage', hex: 0x36e7ff, css: '#36e7ff', c: [0.35, 3.1, 4.2] }, { name: 'Ronin', hex: 0xff3cc8, css: '#ff3cc8', c: [4.4, 0.45, 3.3] }];
  const FFA_COLS = [[5.6, 0.4, 0.8], [4.6, 3.8, 0.45], [0.6, 4.4, 1.9], [5.0, 1.9, 0.35], [2.1, 0.8, 5.2], [5.0, 1.2, 2.6], [0.35, 3.1, 4.2], [3.3, 3.5, 4.0]];
  const FFA_CSS = ['#ff3355', '#ffe14d', '#4dff9a', '#ff8a2a', '#9d5cff', '#ff6fb8', '#36e7ff', '#dfe8ff'];
  const LOADOUTS = {
    assault: { label: 'Assault', desc: 'M7 Vanguard carbine and P-11 sidearm. Reliable at every range.', weapons: { carbine: { mag: 30, reserve: 150 }, pistol: { mag: 12, reserve: Infinity } }, current: 'carbine', grenades: 2, armor: 0, speed: 1 },
    breacher: { label: 'Breacher', desc: 'KS-12 shotgun and sidearm, plus 50 armor. Owns the alleys.', weapons: { shotgun: { mag: 7, reserve: 28 }, pistol: { mag: 12, reserve: Infinity } }, current: 'shotgun', grenades: 2, armor: 50, speed: 0.97 },
    marksman: { label: 'Marksman', desc: 'VX-3 rail rifle and sidearm. Headshots are lethal.', weapons: { rail: { mag: 4, reserve: 16 }, pistol: { mag: 12, reserve: Infinity } }, current: 'rail', grenades: 1, armor: 0, speed: 1 },
    heavy: { label: 'Heavy', desc: 'Rotor-6 minigun and sidearm, plus 50 armor. Spins up, then shreds.', weapons: { minigun: { mag: 150, reserve: 300 }, pistol: { mag: 12, reserve: Infinity } }, current: 'minigun', grenades: 1, armor: 50, speed: 0.9 },
    demo: { label: 'Demolition', desc: 'Havoc RPG, satchel charges and sidearm. Blow them away.', weapons: { rocket: { mag: 1, reserve: 3 }, satchel: { mag: 2, reserve: 2 }, pistol: { mag: 12, reserve: Infinity } }, current: 'rocket', grenades: 1, armor: 0, speed: 1 },
    runner: { label: 'Runner', desc: 'M7 Vanguard carbine and sidearm, one grenade. Moves 8% faster.', weapons: { carbine: { mag: 30, reserve: 120 }, pistol: { mag: 12, reserve: Infinity } }, current: 'carbine', grenades: 1, armor: 0, speed: 1.08 }
  };
  const LO_KEYS = ['assault', 'breacher', 'marksman', 'runner', 'heavy', 'demo'];
  // Sniper Valley: long-range kit only (the towers never meet, so shotguns, miniguns and grenades have nothing to do)
  const SNIPER = {
    deadeye: { label: 'Deadeye', desc: 'VX-3 rail rifle and the KF-44 revolver. The classic pairing.', weapons: { rail: { mag: 4, reserve: 24 }, revolver: { mag: 6, reserve: 36 } }, current: 'rail', grenades: 0, armor: 0, speed: 1 },
    spotter: { label: 'Spotter', desc: 'VX-3 rail rifle, P-11 sidearm and 50 armor. Outlasts a body shot.', weapons: { rail: { mag: 4, reserve: 20 }, pistol: { mag: 12, reserve: Infinity } }, current: 'rail', grenades: 0, armor: 50, speed: 0.97 },
    longshot: { label: 'Longshot', desc: 'VX-3 rail rifle with a deep ammo belt and P-11. Never runs dry.', weapons: { rail: { mag: 4, reserve: 40 }, pistol: { mag: 12, reserve: Infinity } }, current: 'rail', grenades: 0, armor: 0, speed: 1 }
  };
  const SNIPER_KEYS = ['deadeye', 'spotter', 'longshot'];
  // Revolver One-Shot: one gun for everyone, every hit kills. Slow fire and a long reload make each shot count;
  // spawn protection (until you fire) stops spawn kills; a lower kill target keeps rounds short.
  const REVOLVER = { label: 'Revolver', weapons: { revolver: { mag: 6, reserve: Infinity } }, current: 'revolver', grenades: 0, armor: 0, speed: 1 };
  const MODES = {
    ffa: { name: 'Free for all', limit: 20, time: 480, protect: 1.2 },
    tdm: { name: 'Team deathmatch', limit: 40, time: 600, protect: 1.2 },
    revolver: { name: 'Revolver One-Shot', limit: 15, time: 360, protect: 2.5 },
    prophunt: { name: 'Prop Hunt', limit: 0, time: 300, protect: 1.2 }, // time: the hunt, after the Props' head start
    sniper: { name: 'Sniper Valley', limit: 25, time: 600, protect: 2.0 }, // team deathmatch on the Sniper Valley map, rail rifles only
    zombies: { name: 'Zombies', limit: 0, time: 0, protect: 2.0, noClock: true }, // co-op waves (js/zombies.js); ends when everyone is down
    coop: { name: 'Co-op Campaign', limit: 0, time: 0, protect: 0, noClock: true } // two players through a campaign (js/coop.js, js/coop-campaign.js)
  };
  const W_IDX = CF.Weapons.order; // weapon id <-> index for compact state

  const MP = CF.MP = {
    active: false, role: null, myId: '', name: 'Operative', mode: 'ffa', map: 'market', players: {}, remotes: {}, team: 0,
    loadout: 'assault', nextLoadout: 'assault', timeLeft: 0, limit: 20, teamScores: [0, 0], ended: false,
    sendT: 0, tickT: 0, deadT: 0, lastHit: null, colorIdx: 0, LOADOUTS, LO_KEYS, TEAM, MODES, REVOLVER, SNIPER, SNIPER_KEYS
  };
  MP.modeDef = () => MODES[MP.mode] || MODES.ffa;
  MP.loadoutFor = (k) => (MP.mode === 'revolver' ? REVOLVER : MP.mode === 'prophunt' && MP.team === CF.PH.PROP ? CF.PH.PROP_LOADOUT
    : MP.mode === 'sniper' ? SNIPER[k] || SNIPER.deadeye : LOADOUTS[k] || LOADOUTS.assault);
  /** The loadouts offered in the current mode (the picker and the number keys while respawning). */
  MP.loKeys = () => (MP.active && MP.mode === 'sniper' ? SNIPER_KEYS : LO_KEYS);
  MP.loDefs = () => (MP.active && MP.mode === 'sniper' ? SNIPER : LOADOUTS);
  /** Spawn protection: a short window after spawning (longer in Revolver One-Shot) that ends the moment you fire. */
  MP.protectedNow = () => MP.active && CF.time - (MP.spawnT || -99) < MP.modeDef().protect;
  MP.myCosmetics = () => ({ skin: { p: CF.Profile.equipped('p'), w: CF.Profile.equipped('w') }, pub: CF.Profile.pub() });
  try { MP.name = localStorage.getItem('cinderfall.callsign') || 'Operative'; MP.loadout = MP.nextLoadout = localStorage.getItem('cinderfall.loadout') || 'assault'; } catch (e) { /* storage unavailable */ }
  if (!LOADOUTS[MP.loadout] && !SNIPER[MP.loadout]) MP.loadout = MP.nextLoadout = 'assault';
  MP.saveName = function (n) { MP.name = (String(n || '').replace(/[<>]/g, '').trim().slice(0, 16)) || 'Operative'; try { localStorage.setItem('cinderfall.callsign', MP.name); } catch (e) { /* ignore */ } };
  MP.setLoadout = function (k) { if (!LOADOUTS[k] && !SNIPER[k]) return; MP.nextLoadout = k; try { localStorage.setItem('cinderfall.loadout', k); } catch (e) { /* ignore */ } };
  MP.isHost = () => MP.role === 'host';
  // Callsign "Scott" gets aim assist that locks on while aiming (normal health and damage).
  MP.isScott = () => MP.active && MP.name.trim().toLowerCase() === 'scott';
  MP.maxHealth = () => 100;
  /** Team deathmatch rules: TDM itself, and Sniper Valley. */
  MP.tdm = () => MP.mode === 'tdm' || MP.mode === 'sniper';
  /** Modes with sides: the team deathmatches, and Prop Hunt's Hunters vs Props. */
  MP.teamMode = () => MP.tdm() || MP.mode === 'prophunt' || MP.mode === 'zombies' || MP.mode === 'coop'; // co-op: everyone on team 0
  MP.teams = () => (MP.mode === 'prophunt' ? CF.PH.TEAMS : TEAM);
  MP.enemyOf = (id) => !MP.teamMode() || !MP.players[id] || MP.players[id].team !== MP.team;

  // ------------------------------------------------------------ remote operative model
  function buildOperative(col) {
    const G = MP.geo || (MP.geo = { box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 12, 10) });
    const M = {
      suit: new THREE.MeshStandardMaterial({ color: 0x2c303c, metalness: 0.35, roughness: 0.55 }),
      plate: new THREE.MeshStandardMaterial({ color: 0x565d6c, metalness: 0.7, roughness: 0.32 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0], col[1], col[2]) }),
      gun: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.6, roughness: 0.45 })
    };
    const root = new THREE.Group(), p = {};
    const mk = (par, g, m, x, y, z, sx, sy, sz, rx) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); if (rx) o.rotation.x = rx; o.castShadow = true; par.add(o); return o; };
    const grp = (par, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };
    p.hips = grp(root, 0, 0.95, 0);
    mk(p.hips, G.box, M.suit, 0, 0, 0, 0.34, 0.2, 0.22);
    p.torso = grp(p.hips, 0, 0.1, 0);
    mk(p.torso, G.box, M.suit, 0, 0.25, 0, 0.42, 0.5, 0.25);
    mk(p.torso, G.box, M.plate, 0, 0.3, -0.13, 0.36, 0.34, 0.04);
    mk(p.torso, G.box, M.glow, 0, 0.18, -0.152, 0.3, 0.025, 0.01);
    mk(p.torso, G.box, M.plate, 0, 0.3, 0.16, 0.3, 0.36, 0.1);
    mk(p.torso, G.box, M.glow, 0, 0.36, 0.212, 0.2, 0.04, 0.01);
    mk(p.torso, G.box, M.glow, 0.215, 0.32, 0, 0.012, 0.3, 0.2);
    mk(p.torso, G.box, M.glow, -0.215, 0.32, 0, 0.012, 0.3, 0.2);
    p.head = grp(p.torso, 0, 0.58, 0);
    mk(p.head, G.box, M.plate, 0, 0.08, 0, 0.21, 0.24, 0.24);
    mk(p.head, G.box, M.glow, 0, 0.1, -0.122, 0.17, 0.05, 0.01);
    for (const s of [-1, 1]) {
      const arm = grp(p.torso, s * 0.26, 0.45, 0);
      mk(arm, G.box, M.suit, 0, -0.14, 0, 0.1, 0.28, 0.1);
      const fore = grp(arm, 0, -0.28, 0); mk(fore, G.box, M.suit, 0, -0.12, 0, 0.09, 0.24, 0.09);
      p[s < 0 ? 'armL' : 'armR'] = arm; p[s < 0 ? 'foreL' : 'foreR'] = fore;
      mk(arm, G.box, M.glow, s * 0.052, -0.1, 0, 0.008, 0.2, 0.06);
      mk(arm, G.box, M.plate, 0, 0.02, 0, 0.14, 0.1, 0.14);
      const leg = grp(p.hips, s * 0.1, -0.08, 0);
      mk(leg, G.box, M.suit, 0, -0.21, 0, 0.14, 0.42, 0.15);
      mk(leg, G.box, M.glow, s * 0.072, -0.22, 0, 0.008, 0.3, 0.05);
      const knee = grp(leg, 0, -0.42, 0); mk(knee, G.box, M.plate, 0, -0.2, 0, 0.13, 0.4, 0.14); mk(knee, G.box, M.suit, 0, -0.43, -0.05, 0.14, 0.07, 0.26);
      p[s < 0 ? 'legL' : 'legR'] = leg; p[s < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    p.gun = grp(p.torso, 0.12, 0.33, -0.3);
    mk(p.gun, G.box, M.gun, 0, 0, 0, 0.07, 0.1, 0.55); mk(p.gun, G.box, M.glow, 0.036, 0.02, -0.05, 0.004, 0.012, 0.3);
    mk(p.gun, G.box, M.gun, 0, -0.08, 0.12, 0.05, 0.12, 0.06, -0.3); mk(p.gun, G.box, M.gun, 0, 0.07, 0.02, 0.03, 0.04, 0.12);
    p.muzzle = grp(p.gun, 0, 0.01, -0.3);
    const hs = (obj, x, y, z, r, mult, tag) => ({ obj, off: new THREE.Vector3(x, y, z), r, mult, tag, w: new THREE.Vector3() });
    const hit = [hs(p.head, 0, 0.08, 0, 0.15, 2, 'head'), hs(p.torso, 0, 0.3, 0, 0.27, 1, 'body'), hs(p.torso, 0, 0.05, 0, 0.2, 1, 'body'), hs(p.hips, 0, 0, 0, 0.19, 0.9, 'body'),
      hs(p.legL, 0, -0.2, 0, 0.12, 0.75, 'limb'), hs(p.legR, 0, -0.2, 0, 0.12, 0.75, 'limb'), hs(p.kneeL, 0, -0.2, 0, 0.11, 0.75, 'limb'), hs(p.kneeR, 0, -0.2, 0, 0.11, 0.75, 'limb')];
    const suitMeshes = [], plateMeshes = [];
    root.traverse((o) => { if (o.material === M.suit) suitMeshes.push(o); else if (o.material === M.plate) plateMeshes.push(o); });
    if (CF.Skins.prepareGun) CF.Skins.prepareGun(p.gun, new Map([[M.gun, 'body']]));
    for (const o of suitMeshes.concat(plateMeshes)) { const g = o.geometry.clone(), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.scale.x * 3, uv.getY(i) * o.scale.y * 3); o.geometry = g; }
    return { root, p, hit, mats: [M.suit, M.plate], glow: M.glow, suitMeshes, plateMeshes, stockSuit: M.suit, stockPlate: M.plate };
  }
  function nameTag(text, css) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const x = c.getContext('2d'); x.font = 'bold 28px "Barlow Semi Condensed", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(0,0,0,0.55)'; const w = Math.min(250, x.measureText(text).width + 24); x.fillRect(128 - w / 2, 6, w, 36);
    x.fillStyle = css; x.fillText(text, 128, 25);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(1.3, 0.24, 1); s.position.y = 2.15; s.renderOrder = 30;
    return s;
  }

  class Remote {
    constructor(id, info) {
      this.id = id; this.net = true; this.state = 'net'; this.spawnT = 1; this.alive = false; this.dead = true;
      this.name = info.name; this.team = info.team || 0;
      const ci = info.color != null ? info.color : 0;
      const col = MP.teamMode() ? MP.teams()[this.team].c : FFA_COLS[ci % FFA_COLS.length];
      this.css = MP.teamMode() ? MP.teams()[this.team].css : FFA_CSS[ci % FFA_CSS.length];
      this.m = buildOperative(col); this.root = this.m.root; this.root.visible = false; this.root.rotation.order = 'YXZ'; // pitch (falling, crawling) after the heading
      this.T = { height: 1.85, radius: 0.4, flying: false, name: info.name, score: 100 };
      this.body = { pos: new THREE.Vector3(0, -50, 0), vel: new THREE.Vector3() };
      this.tp = new THREE.Vector3(); this.yaw = 0; this.tyaw = 0; this.pitch = 0; this.crouch = 0; this.tc = 0; this.w = 0;
      this.snaps = []; this.lastK = -1; this.off = null; // position buffer for smoothing (see sample())
      this.phase = 0; this.speed = 0; this.stepD = 0; this.deadT = 0; this.lastFired = -99;
      this.tag = nameTag(info.name, this.css); this.root.add(this.tag);
      this.shield = CF.RC.shieldModel(); this.shield.material = this.shield.material.clone(); this.shield.visible = false; this.root.add(this.shield);
      CF.Enemies.scene.add(this.root);
      this.root.updateMatrixWorld(true); this.cacheHits();
      this.verify(info);
    }
    /** Cosmetics as the server knows them (a client can't claim skins it doesn't own). Without a server there is nothing to check against. */
    verify(info) {
      if (CF.Profile.mode !== 'server') { this.setCosmetics((info && info.skin) || {}, false); return; }
      const pub = info && info.pub; if (!pub) return;
      CF.Profile.publicProfile(pub).then((pp) => { if (pp && !this.gone) this.setCosmetics(pp.equip || {}, !!(pp.champion && pp.champion.now)); });
    }
    setCosmetics(equip, champ) {
      CF.Skins.dress(this.m, CF.Skins.get(equip.p) ? equip.p : null);
      this.finish = CF.Skins.get(equip.w) ? equip.w : null; this.armedW = null;
      CF.Skins.championAura(this.m, champ);
    }
    center(out) { return out.set(this.body.pos.x, this.body.pos.y + 1.1 - this.crouch * 0.4, this.body.pos.z); }
    eyePos(out) { return out.set(this.body.pos.x, this.body.pos.y + 1.65 - this.crouch * 0.6, this.body.pos.z); }
    cacheHits() { for (const h of this.m.hit) h.obj.localToWorld(h.w.copy(h.off)); }
    becomeAware() {}
    applyState(s) {
      // updates can arrive out of order on the fast channel: keep only ones newer than the last
      const k = +s.k;
      if (k >= 0) {
        if (k <= this.lastK && this.lastK - k < 60000) return; // (a big jump back means the sender reloaded the page)
        this.lastK = k;
        // sender's clock → ours: the smallest (arrival - sent) seen, relaxing slowly so it follows route changes
        const now = performance.now(), gap = now - k;
        this.off = this.off == null || Math.abs(gap - this.off) > 5000 ? gap : Math.min(gap, this.off + 0.5);
      }
      this.tp.set(s.p[0], s.p[1], s.p[2]); this.tyaw = s.y; this.pitch = s.x; this.tc = s.c ? 1 : 0; this.w = s.w || 0;
      this.driving = !!s.d; this.protect = !!s.s; this.downed = !!s.dn;
      const wid = W_IDX[s.w || 0] || 'carbine';
      if (this.armedW !== wid) { this.armedW = wid; CF.Skins.arm(this.m, wid, this.finish || null); }
      this.shield.visible = (this.driving || this.protect) && !this.dead;
      if (s.a && this.dead) { this.dead = false; this.alive = true; this.body.pos.copy(this.tp); this.snaps.length = 0; this.yaw = s.y; this.root.visible = true; this.root.rotation.set(0, s.y, 0); this.deadT = 0; }
      else if (!s.a && !this.dead) this.die();
      if (MP.mode === 'prophunt') CF.PH.applyRemote(this, s);
      // buffer it last, so a respawn above (which clears the buffer) keeps this first update of the new life
      if (k >= 0) {
        const snaps = this.snaps, last = snaps[snaps.length - 1];
        if (last && (Math.abs(last.x - s.p[0]) + Math.abs(last.z - s.p[2]) > 6 || Math.abs(last.y - s.p[1]) > 6)) snaps.length = 0; // teleported (respawn)
        snaps.push({ t: k + this.off, x: s.p[0], y: s.p[1], z: s.p[2], yaw: s.y, pitch: s.x });
        if (snaps.length > 12) snaps.shift();
      } else this.snaps.length = 0; // no timestamp: fall back to easing toward the newest position
    }
    /** Place the player where they were CF.NET.interp ms ago, blending the two updates around that moment.
        If updates stop arriving, keep them moving on their last heading for a moment, then hold. */
    sample() {
      const s = this.snaps;
      if (!s.length) return false;
      const t = performance.now() - CF.NET.interp, b = this.body.pos;
      while (s.length > 2 && s[1].t <= t) s.shift(); // drop updates we've moved past, keeping two to extrapolate from
      const last = s[s.length - 1];
      if (t >= last.t) { // behind on updates: extrapolate from the last two, at most 150 ms, then hold
        const p = s.length >= 2 ? s[s.length - 2] : null, span = p ? last.t - p.t : 0;
        const k = p && span > 0 && span < 300 ? Math.min(t - last.t, 150) / span : 0;
        b.set(last.x + (p ? (last.x - p.x) * k : 0), last.y + (p ? (last.y - p.y) * k : 0), last.z + (p ? (last.z - p.z) * k : 0));
        this.yaw = last.yaw; this.pitch = last.pitch;
        return true;
      }
      const a = s[0];
      if (t <= a.t) { b.set(a.x, a.y, a.z); this.yaw = a.yaw; this.pitch = a.pitch; return true; } // buffer still filling
      const c = s[1], k = (t - a.t) / Math.max(1, c.t - a.t);
      b.set(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, a.z + (c.z - a.z) * k);
      this.yaw = a.yaw + U.wrapAngle(c.yaw - a.yaw) * k; this.pitch = a.pitch + (c.pitch - a.pitch) * k;
      return true;
    }
    die() {
      if (this.dead) return;
      this.dead = true; this.alive = false; this.deadT = 0;
      if (this.prop) CF.PH.dropRemote(this);
      const c = this.center(new THREE.Vector3());
      CF.FX.sparks(c.x, c.y, c.z, 0, 1, 0, 14, 5, true); CF.FX.glow(c.x, c.y, c.z, 1.2, 3, 2, 1.5, 0.12);
      A.play('botDeath', c, { ref: 5, vol: 0.6 });
    }
    damage(amount, info) {
      if (!this.alive || MP.ended) return null;
      if (MP.teamMode() && this.team === MP.team) return null;
      if (this.driving || this.protect) { // shielded: driving an RC car, or just spawned
        if (info.point) CF.FX.sparks(info.point.x, info.point.y, info.point.z, 0, 1, 0, 4, 2);
        CF.HUD.hitmarker('armor'); this.shieldPing = 0.25; return null;
      }
      const part = info.part; let mult = part ? part.mult : 1; const tag = part ? part.tag : 'body';
      const def = info.weapon ? CF.Weapons.defs[info.weapon] : null;
      if (tag === 'head' && def) mult = def.head * (part.mult / 2);
      let dmg = amount * mult * (def ? def.pvp || 1 : 1) * CF.PH.damageMul(this);
      if (MP.mode === 'revolver' && info.weapon === 'revolver') dmg = 999; // one shot, one kill
      MP.sendHit(this.id, dmg, tag === 'head', info.weapon || info.wid || (info.explosive ? 'frag' : 'melee'));
      if (info.point) CF.FX.botHit(info.point, info.normal || new THREE.Vector3(0, 1, 0), tag === 'head');
      CF.HUD.hitmarker(tag === 'head' ? 'head' : 'hit');
      if (info.point) CF.HUD.dmgNumber(info.point, dmg, tag === 'head' ? 'head' : '');
      A.play(tag === 'head' ? 'headshot' : 'hit', null, { ui: true });
      CF.Game.stats.damageDealt += dmg;
      return { head: tag === 'head', dealt: dmg };
    }
    update(dt) {
      const b = this.body, p = this.m.p;
      CF.Skins.animateModel(this.m, CF.time, this.dead ? null : b.pos, this.dead ? 0 : this.speed, CF.Enemies.scene);
      if (this.shield.visible) { this.shieldPing = Math.max(0, (this.shieldPing || 0) - dt); this.shield.material.opacity = 0.18 + 0.06 * Math.sin(CF.time * 6) + this.shieldPing * 1.6; this.shield.rotation.y += dt; }
      if (this.dead) {
        this.shield.visible = false;
        if (this.root.visible) {
          this.deadT += dt;
          const k = Math.min(1, this.deadT / 0.5);
          p.hips.position.y = 0.95 - 0.7 * U.easeOutCubic(k); this.root.rotation.x = -1.35 * U.easeOutCubic(k);
          if (this.deadT > 2.5) this.root.visible = false;
        }
        return;
      }
      const ox = b.pos.x, oz = b.pos.z;
      if (!this.sample()) {
        b.pos.x = U.damp(b.pos.x, this.tp.x, 16, dt); b.pos.y = U.damp(b.pos.y, this.tp.y, 16, dt); b.pos.z = U.damp(b.pos.z, this.tp.z, 16, dt);
        if (b.pos.distanceToSquared(this.tp) > 25) b.pos.copy(this.tp);
        this.yaw += U.wrapAngle(this.tyaw - this.yaw) * Math.min(1, dt * 16);
      }
      const d = Math.hypot(b.pos.x - ox, b.pos.z - oz);
      this.speed = U.damp(this.speed, d / Math.max(dt, 1e-3), 8, dt);
      this.crouch = U.damp(this.crouch, this.tc, 12, dt);
      const amp = U.clamp(this.speed / 5, 0, 1.4);
      this.phase += dt * this.speed * 1.5;
      const s = Math.sin(this.phase);
      p.legL.rotation.x = -s * 0.55 * amp; p.legR.rotation.x = s * 0.55 * amp;
      p.kneeL.rotation.x = (0.1 + 0.7 * Math.max(0, Math.cos(this.phase))) * amp + this.crouch * 1.1;
      p.kneeR.rotation.x = (0.1 + 0.7 * Math.max(0, -Math.cos(this.phase))) * amp + this.crouch * 1.1;
      p.legL.rotation.x -= this.crouch * 0.9; p.legR.rotation.x -= this.crouch * 0.9;
      p.hips.position.y = 0.95 - this.crouch * 0.42 + Math.abs(s) * 0.035 * amp;
      p.torso.rotation.x = this.pitch * 0.6 + this.crouch * 0.15;
      p.head.rotation.x = this.pitch * 0.4;
      p.armR.rotation.set(-1.2 - this.pitch * 0.3, 0, 0.1); p.foreR.rotation.x = -0.5;
      p.armL.rotation.set(-1.3 - this.pitch * 0.3, 0.35, -0.4); p.foreL.rotation.x = -0.9;
      this.root.position.copy(b.pos); this.root.rotation.set(0, this.yaw, 0);
      if (this.downed) { p.hips.position.y = 0.3; this.root.rotation.x = -1.3; p.armR.rotation.set(-2.6, 0, 0.2); p.armL.rotation.set(-2.6 + Math.sin(this.phase) * 0.4, 0, -0.2); } // crawling, waiting for a revive
      if (this.prop) CF.PH.updateRemote(this);
      this.root.updateMatrixWorld(true); this.cacheHits();
      this.stepD += d;
      if (this.stepD > 2.2 && CF.Player.body.pos.distanceToSquared(b.pos) < 900) { this.stepD = 0; A.play('step', b.pos, { ref: 3, vol: 0.9 }); }
      this.tag.visible = MP.teamMode() && this.team === MP.team;
    }
    remove() { this.gone = true; CF.PH.dropRemote(this); CF.Skins.championAura(this.m, false); CF.Enemies.scene.remove(this.root); const i = CF.Enemies.list.indexOf(this); if (i >= 0) CF.Enemies.list.splice(i, 1); }
  }
  MP.Remote = Remote;

  // ------------------------------------------------------------ lifecycle
  MP.reset = function () {
    for (const id in MP.remotes) MP.remotes[id].remove();
    MP.remotes = {}; MP.players = {}; MP.teamScores = [0, 0]; MP.ended = false; MP.lastHit = null; MP.colorIdx = 0;
    if (CF.Coop) CF.Coop.reset(); if (CF.ZM) CF.ZM.reset();
    MP.ping = 0; MP.pingT = 0;
  };
  MP.leave = function (reason) {
    const was = MP.active;
    MP.active = false; CF.Net.close(); MP.reset(); MP.role = null;
    if (was) CF.Game.leaveMultiplayer(reason);
  };

  /** Host a match: build the map, open a room, spawn. */
  MP.host = async function (mapId, mode) {
    MP.reset(); MP.mode = MODES[mode] ? mode : 'ffa'; MP.map = mapId; MP.limit = MP.modeDef().limit;
    MP.status('Opening a room…');
    CF.Net.onMsg = (from, msg) => MP.onHostMsg(from, msg);
    CF.Net.onLeave = (id) => MP.playerLeft(id);
    CF.Net.hostGame(async (code) => {
      if (CF.Game.screen !== 'mp') { CF.Net.close(); return; } // player backed out while the room opened
      MP.role = 'host'; MP.myId = CF.Net.myId; MP.team = 0; MP.active = true;
      MP.players[MP.myId] = Object.assign({ name: MP.name, team: 0, kills: 0, deaths: 0, color: MP.colorIdx++ }, MP.myCosmetics());
      MP.timeLeft = MP.modeDef().time;
      await CF.Game.loadMap(MP.mode === 'coop' ? CF.Campaigns[mapId].map : mapId);
      if (MP.mode === 'coop') CF.CoopCampaign.enter(); else CF.Game.enterMultiplayer();
    }, (err) => MP.status(err, true));
  };
  MP.join = function (code) {
    MP.reset();
    MP.status('Connecting…');
    CF.Net.onMsg = (from, msg) => MP.onClientMsg(msg);
    CF.Net.onDrop = () => { if (MP.active) MP.leave('The host ended the match or the connection dropped.'); };
    CF.Net.joinGame(code, () => { if (CF.Game.screen !== 'mp') { CF.Net.close(); return; } MP.role = 'client'; MP.myId = CF.Net.myId; CF.Net.send(Object.assign({ t: 'hello', name: MP.name }, MP.myCosmetics())); MP.status('Joining match…'); }, (err) => MP.status(err, true), (text) => MP.status(text));
  };
  MP.status = function (text, error) {
    const el = $('mpStatus'); if (el) { el.textContent = text; el.classList.toggle('err', !!error); }
    if (error && CF.Game.mpBusy) CF.Game.mpBusy(false);
  };
  MP.makeModel = () => buildOperative(TEAM[0].c).root;
  MP.buildOperative = buildOperative;
  MP.nameTag = nameTag;

  // ------------------------------------------------------------ outgoing
  MP.post = function (msg) {
    if (MP.role === 'host') MP.onHostMsg(MP.myId, msg, true); else CF.Net.send(msg);
  };
  /** For updates where only the newest matters (positions): may arrive out of order or not at all. */
  MP.postFast = function (msg) {
    if (MP.role === 'host') MP.onHostMsg(MP.myId, msg, true); else CF.Net.sendFast(msg);
  };
  MP.sendHit = function (to, dmg, head, w) {
    const P = CF.Player.body.pos;
    MP.post({ t: 'hit', to, dmg: Math.round(dmg * 10) / 10, head: head ? 1 : 0, w, from: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2)] });
  };
  const rv = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
  MP.onShot = function (w, muzzle, ends) { if (MP.active) { MP.spawnT = -99; MP.post({ t: 'fx', w, m: rv(muzzle), e: ends.slice(0, 10).map(rv) }); } };
  MP.onBoom = function (pos) { if (MP.active) MP.post({ t: 'boom', p: rv(pos) }); };
  MP.onNade = function (pos, vel) { if (MP.active) MP.post({ t: 'nade', p: rv(pos), v: rv(vel) }); };
  MP.sendState = function () {
    const P = CF.Player, b = P.body.pos;
    const msg = { t: 'st', k: Math.round(performance.now()), p: [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)], y: +P.yaw.toFixed(3), x: +P.pitch.toFixed(3), c: P.crouching ? 1 : 0, w: Math.max(0, W_IDX.indexOf(CF.Weapons.curId)), a: P.alive && CF.Game.state !== 'mpdead' ? 1 : 0, d: CF.RC.driving ? 1 : 0, s: MP.protectedNow() ? 1 : 0 };
    if (MP.mode === 'prophunt') CF.PH.stateFields(msg); // ph: disguise, pr: its facing
    if (CF.Coop.downed) msg.dn = 1;
    MP.postFast(msg);
  };

  // ------------------------------------------------------------ host side
  MP.onHostMsg = function (from, msg, local) {
    const pl = MP.players[from];
    switch (msg.t) {
      case 'hello': {
        if (MP.players[from]) return;
        const counts = [0, 0]; for (const id in MP.players) counts[MP.players[id].team]++;
        const team = MP.tdm() ? (counts[0] <= counts[1] ? 0 : 1) : 0;
        const sk = msg.skin && typeof msg.skin === 'object' ? { p: typeof msg.skin.p === 'string' ? msg.skin.p.slice(0, 20) : null, w: typeof msg.skin.w === 'string' ? msg.skin.w.slice(0, 20) : null } : {};
        MP.players[from] = { name: String(msg.name || 'Operative').slice(0, 16), team, kills: 0, deaths: 0, color: MP.colorIdx++, skin: sk, pub: /^[a-z0-9]{12}$/.test(msg.pub || '') ? msg.pub : null };
        CF.Net.sendTo(from, { t: 'welcome', id: from, map: MP.map, mode: MP.mode, limit: MP.limit, time: MP.timeLeft, team, players: MP.players, teams: MP.teamScores, ended: MP.ended, chest: CF.RC.chestInfo(), ph: MP.mode === 'prophunt' ? CF.PH.snap() : null, cc: MP.mode === 'coop' ? CF.CoopCampaign.info() : null });
        CF.Net.broadcast({ t: 'join', id: from, p: MP.players[from] }, from);
        MP.addRemote(from, MP.players[from]);
        CF.HUD.killfeed(MP.players[from].name + ' joined', '');
        return;
      }
      case 'st': if (!pl) return; if (!local) { const r = MP.remotes[from]; if (r) r.applyState(msg); } msg.id = from; CF.Net.broadcastFast(msg, from); return;
      case 'ping': if (pl) { pl.ping = +msg.r || 0; CF.Net.sendToFast(from, { t: 'pong', c: msg.c }); } return;
      case 'hit': if (MP.ended) return; msg.by = from; if (msg.to === MP.myId) MP.applyHit(msg); else CF.Net.sendTo(msg.to, msg); return;
      case 'died': { if (MP.ended) return; const k = { t: 'kill', killer: msg.killer, victim: from, w: msg.w, head: msg.head }; MP.recordKill(k); CF.Net.broadcast(k); return; }
      case 'fx': case 'boom': case 'nade': msg.id = from; CF.Net.broadcast(msg, from); if (!local) MP.showFx(msg); return;
      case 'chest': if (msg.op === 'take' && !MP.ended) CF.RC.hostTake(from); return;
      case 'rc': msg.id = from; CF.Net.broadcastFast(msg, from); if (!local) CF.RC.onRemoteState(from, msg); return;
      case 'rcend': msg.id = from; CF.Net.broadcast(msg, from); if (!local) CF.RC.onRemoteEnd(from, msg); CF.RC.hostEnded(from); return;
      case 'rchit': msg.by = from; if (msg.to === MP.myId) CF.RC.hit(+msg.dmg || 0); else CF.Net.sendTo(msg.to, msg); return;
      // co-op: hits on our enemies, revives, downs, objective use (campaign)
      case 'eh': if (!local) CF.Coop.onEnemyHit(from, msg); return;
      case 'rev': msg.by = from; if (msg.to === MP.myId) CF.Coop.onRevive(msg, from); else CF.Net.sendTo(msg.to, msg); return;
      case 'down': if (pl) pl.downs = (pl.downs || 0) + 1; if (!local && pl) CF.HUD.killfeed(pl.name + ' is down', msg.src || ''); msg.id = from; CF.Net.broadcast(msg, from); return;
      case 'use': if (!local && CF.CoopCampaign) CF.CoopCampaign.onUse(from, msg); return;
    }
  };
  MP.playerLeft = function (id) {
    const pl = MP.players[id]; if (!pl) return;
    delete MP.players[id];
    if (MP.remotes[id]) { MP.remotes[id].remove(); delete MP.remotes[id]; }
    CF.RC.dropRemote(id); CF.RC.hostEnded(id);
    CF.HUD.killfeed(pl.name + ' left', '');
    CF.Net.broadcast({ t: 'leave', id });
  };

  // ------------------------------------------------------------ client side
  MP.onClientMsg = async function (msg) {
    switch (msg.t) {
      case 'welcome': {
        MP.myId = msg.id; MP.mode = msg.mode; MP.map = msg.map; MP.limit = msg.limit; MP.timeLeft = msg.time; MP.team = msg.team;
        MP.teamScores = msg.teams; MP.players = msg.players; MP.ended = msg.ended; MP.active = true;
        await CF.Game.loadMap(msg.mode === 'coop' ? CF.Campaigns[msg.map].map : msg.map);
        for (const id in MP.players) if (id !== MP.myId) MP.addRemote(id, MP.players[id]);
        if (msg.mode === 'coop') { CF.CoopCampaign.enter(msg.cc); return; }
        CF.Game.enterMultiplayer();
        if (msg.chest) CF.RC.setChest(msg.chest.s, msg.chest.by, msg.chest.r);
        if (msg.ph) { CF.PH.apply(msg.ph); CF.PH.teamsChanged(); }
        return;
      }
      case 'join': MP.players[msg.id] = msg.p; MP.addRemote(msg.id, msg.p); CF.HUD.killfeed(msg.p.name + ' joined', ''); return;
      case 'leave': { const pl = MP.players[msg.id]; delete MP.players[msg.id]; if (MP.remotes[msg.id]) { MP.remotes[msg.id].remove(); delete MP.remotes[msg.id]; } CF.RC.dropRemote(msg.id); if (pl) CF.HUD.killfeed(pl.name + ' left', ''); return; }
      case 'st': { const r = MP.remotes[msg.id]; if (r) r.applyState(msg); return; }
      case 'pong': { const rtt = performance.now() - (+msg.c || 0); if (rtt >= 0 && rtt < 10000) MP.ping = MP.ping ? Math.round(MP.ping * 0.7 + rtt * 0.3) : Math.round(rtt); return; }
      case 'hit': MP.applyHit(msg); return;
      case 'kill': MP.recordKill(msg); return;
      case 'fx': case 'boom': case 'nade': MP.showFx(msg); return;
      case 'tick': {
        MP.timeLeft = msg.time; if (msg.teams) MP.teamScores = msg.teams;
        if (msg.board) for (const id in msg.board) { const pl = MP.players[id], r = msg.board[id]; if (pl) { pl.kills = r[0]; pl.deaths = r[1]; if (r[2] != null) pl.team = r[2]; } }
        if (msg.ph) { CF.PH.apply(msg.ph); CF.PH.teamsChanged(); }
        return;
      }
      case 'ph': CF.PH.apply(msg); return;
      case 'end': MP.endMatch(msg); return;
      case 'restart': MP.restartMatch(msg); return;
      case 'chest': CF.RC.setChest(msg.s, msg.by, msg.r); return;
      case 'rc': CF.RC.onRemoteState(msg.id, msg); return;
      case 'rcend': CF.RC.onRemoteEnd(msg.id, msg); return;
      case 'rchit': CF.RC.hit(+msg.dmg || 0); return;
      // co-op: the host's enemies, their hits on us, revives, waves, the shared campaign
      case 'en': CF.Coop.onSnapshot(msg); return;
      case 'ed': CF.Coop.onGhostDied(msg); return;
      case 'ef': CF.Coop.onGhostShot(msg); return;
      case 'el': CF.Coop.onGhostLob(msg); return;
      case 'ek': CF.Coop.onKillCredit(msg); return;
      case 'drop': CF.Coop.onDropMsg(msg); return;
      case 'ehit': MP.enemyHit(msg); return;
      case 'rev': CF.Coop.onRevive(msg); return;
      case 'down': { const pl = MP.players[msg.id]; if (pl) { pl.downs = (pl.downs || 0) + 1; CF.HUD.killfeed(pl.name + ' is down', msg.src || ''); } return; }
      case 'zw': CF.ZM.apply(msg); return;
      default: if (CF.CoopCampaign && CF.CoopCampaign.onClientMsg(msg)) return;
    }
  };
  /** Co-op: one of the host's enemies hit us. */
  MP.enemyHit = function (msg) {
    const P = CF.Player;
    if (!P.alive || MP.ended || (CF.Game.state !== 'playing' && CF.Game.state !== 'mpmenu' && CF.Game.state !== 'paused')) return;
    P.damage(+msg.dmg || 0, msg.from ? new THREE.Vector3(msg.from[0], msg.from[1], msg.from[2]) : null, msg.src || 'the infected');
  };
  MP.addRemote = function (id, info) {
    if (MP.remotes[id] || id === MP.myId) return;
    const r = new Remote(id, info); MP.remotes[id] = r; CF.Enemies.list.push(r);
  };

  // ------------------------------------------------------------ shared game logic
  MP.applyHit = function (msg) {
    const P = CF.Player;
    if (!P.alive || CF.Game.state === 'mpdead' || MP.ended) return;
    if (MP.protectedNow() || CF.RC.driving) return; // spawn protection, or standing shielded while driving the RC car
    const shooter = MP.players[msg.by];
    if (MP.teamMode() && shooter && shooter.team === MP.team) return;
    MP.lastHit = { by: msg.by, w: msg.w, head: msg.head, t: CF.time };
    if (MP.mode === 'prophunt') CF.PH.onHurt();
    const from = msg.from ? new THREE.Vector3(msg.from[0], msg.from[1], msg.from[2]) : null;
    P.damage(msg.dmg, from, shooter ? shooter.name : 'enemy fire');
  };
  MP.onLocalDeath = function (source) {
    const lh = MP.lastHit, recent = lh && CF.time - lh.t < 8;
    MP.post({ t: 'died', killer: recent ? lh.by : null, w: recent ? lh.w : 'env', head: recent ? lh.head : 0 });
    MP.lastHit = null; MP.deadT = 0;
    MP.sendState();
  };
  MP.recordKill = function (k) {
    const killer = MP.players[k.killer], victim = MP.players[k.victim];
    if (victim) victim.deaths++;
    const suicide = !k.killer || k.killer === k.victim;
    if (MP.mode === 'zombies' && victim) { CF.HUD.killfeed(victim.name + ' bled out', ''); CF.ZM.onDeath(); if (k.victim === MP.myId) CF.Game.mpKilledBy(null, ''); if (MP.remotes[k.victim]) MP.remotes[k.victim].die(); if (MP.isHost()) MP.checkEnd(); return; }
    if (MP.mode === 'prophunt') CF.PH.onKill(k, killer, victim, suicide); // a found Prop joins the Hunters
    else if (killer && !suicide) {
      if (MP.tdm()) { if (killer.team !== (victim ? victim.team : -1)) { MP.teamScores[killer.team]++; killer.kills++; } }
      else killer.kills++;
    }
    const wdef = CF.Weapons.defs[k.w];
    const how = wdef ? wdef.short : k.w === 'frag' ? 'FRAG' : k.w === 'melee' ? 'MELEE' : k.w === 'drone' ? 'DRONE' : k.w === 'rc' ? 'RC-XD' : '';
    if (victim) CF.HUD.killfeed(suicide ? victim.name + ' fell' : (killer ? killer.name : '?') + ' ▸ ' + victim.name, how + (k.head ? ' · HEAD' : ''));
    if (MP.remotes[k.victim]) MP.remotes[k.victim].die();
    if (k.killer === MP.myId && !suicide) {
      CF.Game.stats.kills++; if (k.head) CF.Game.stats.headshots++;
      if (k.w !== 'drone' && k.w !== 'rc' && MP.mode !== 'revolver' && MP.mode !== 'prophunt') CF.Streak.onKill();
      CF.Game.addScore(100 + (k.head ? 50 : 0));
      CF.HUD.hitmarker('kill'); A.play('kill', null, { ui: true });
      CF.HUD.popup('Eliminated ' + (victim ? victim.name : ''), 100 + (k.head ? 50 : 0), k.head ? 'head' : '');
    }
    if (k.victim === MP.myId) CF.Game.mpKilledBy(suicide ? null : killer ? killer.name : null, how);
    if (MP.isHost()) MP.checkEnd();
  };
  MP.showFx = function (msg) {
    if (msg.t === 'fx') {
      const def = CF.Weapons.defs[msg.w]; if (!def || !msg.m) return;
      const m = new THREE.Vector3(msg.m[0], msg.m[1], msg.m[2]);
      A.play(def.sound, m, { ref: 7 });
      CF.FX.muzzle(m, new THREE.Vector3(0, 0, 0), def.id === 'rail' ? 1.5 : 5, def.id === 'rail' ? 4 : 3.2, def.id === 'rail' ? 6 : 1.6, 0.5);
      for (const e of msg.e || []) {
        const end = new THREE.Vector3(e[0], e[1], e[2]);
        if (def.id === 'rail') CF.FX.tracer(m, end, { r: 0.8, g: 3.2, b: 5, w: 0.07, life: 0.5 });
        else CF.FX.tracer(m, end, { speed: def.pellets > 1 ? 260 : 380, len: 4, w: 0.026, r: 3.2, g: 2.1, b: 1.0 });
        CF.FX.sparks(end.x, end.y, end.z, 0, 1, 0, 3, 3);
      }
      const r = MP.remotes[msg.id]; if (r && MP.enemyOf(msg.id)) r.lastFired = CF.time;
    } else if (msg.t === 'boom') {
      const p = new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]);
      CF.FX.explosion(p, 1.2);
      const d = p.distanceTo(CF.Player.body.pos); CF.Player.shake(U.clamp(1 - d / 30, 0, 1) * 0.8);
    } else if (msg.t === 'nade') {
      CF.Weapons.spawnGhostGrenade(new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]), new THREE.Vector3(msg.v[0], msg.v[1], msg.v[2]));
    }
  };

  // ------------------------------------------------------------ match clock + end (host authoritative)
  MP.checkEnd = function () {
    if (MP.ended) return;
    let done = MP.timeLeft <= 0, winner = null;
    if (MP.mode === 'prophunt') { winner = CF.PH.result(); done = !!winner; }
    else if (MP.mode === 'zombies') { winner = CF.ZM.result(); done = !!winner; }
    else if (MP.mode === 'coop') return; // the campaign ends through its own mission (js/coop-campaign.js)
    else if (MP.tdm()) done = done || MP.teamScores[0] >= MP.limit || MP.teamScores[1] >= MP.limit;
    else for (const id in MP.players) if (MP.players[id].kills >= MP.limit) done = true;
    if (!done) return;
    const msg = { t: 'end', board: MP.players, teams: MP.teamScores, winner: winner || MP.winnerText(), zw: MP.mode === 'zombies' ? CF.ZM.snap() : undefined };
    CF.Net.broadcast(msg); MP.endMatch(msg);
  };
  MP.winnerText = function () {
    if (MP.mode === 'prophunt') return CF.PH.winner || 'Round over';
    if (MP.mode === 'zombies') return CF.ZM.winner || 'Overrun on wave ' + CF.ZM.wave;
    if (MP.tdm()) { const [a, b] = MP.teamScores; return a === b ? 'Draw' : (a > b ? TEAM[0].name : TEAM[1].name) + ' win'; }
    let best = null; for (const id in MP.players) if (!best || MP.players[id].kills > best.kills) best = MP.players[id];
    return best ? best.name + ' wins' : 'Match over';
  };
  MP.endMatch = function (msg) {
    MP.ended = true;
    if (msg.board) MP.players = msg.board;
    if (msg.teams) MP.teamScores = msg.teams;
    if (MP.mode === 'prophunt') CF.PH.onEnd(msg.winner);
    if (MP.mode === 'zombies') { CF.ZM.onEnd(msg.winner); if (msg.zw) { CF.ZM.wave = msg.zw.w; CF.ZM.kills = msg.zw.k; } }
    CF.Game.mpMatchEnd(msg.winner);
  };
  MP.restartMatch = function (msg) {
    MP.ended = false; MP.teamScores = [0, 0]; MP.timeLeft = msg.time;
    for (const id in MP.players) { MP.players[id].kills = 0; MP.players[id].deaths = 0; }
    if (MP.mode === 'prophunt') CF.PH.reset();
    if (MP.mode === 'zombies') { CF.Coop.reset(); CF.ZM.reset(); }
    CF.Game.mpRestart();
  };
  MP.hostRestart = function () {
    if (!MP.isHost()) return;
    const msg = { t: 'restart', time: MP.modeDef().time };
    CF.Net.broadcast(msg); MP.restartMatch(msg);
  };

  MP.update = function (dt) {
    if (!MP.active) return;
    MP.sendT -= dt;
    if (MP.sendT <= 0) { MP.sendT = 0.05; MP.sendState(); }
    // clients measure their round trip to the host every 2 s and report it, so the host's overlay can list everyone's ping
    if (MP.role === 'client') { MP.pingT = (MP.pingT || 0) - dt; if (MP.pingT <= 0) { MP.pingT = 2; CF.Net.sendFast({ t: 'ping', c: Math.round(performance.now()), r: MP.ping || 0 }); } }
    // Prop Hunt's clock only runs during the hunt; the head start has its own
    const ph = MP.mode === 'prophunt', clock = !MP.modeDef().noClock && (!ph || CF.PH.phase === 'hunt');
    if (ph && !MP.ended) CF.PH.tick(dt);
    if (MP.isHost() && !MP.ended) {
      if (clock) MP.timeLeft = Math.max(0, MP.timeLeft - dt);
      MP.tickT -= dt;
      if (MP.tickT <= 0) {
        MP.tickT = 1;
        const board = {}; for (const id in MP.players) board[id] = ph ? [MP.players[id].kills, MP.players[id].deaths, MP.players[id].team] : [MP.players[id].kills, MP.players[id].deaths];
        CF.Net.broadcast({ t: 'tick', time: Math.round(MP.timeLeft), teams: MP.teamScores, board, ph: ph ? CF.PH.snap() : undefined });
        MP.checkEnd();
      }
    } else if (!MP.ended && clock) MP.timeLeft = Math.max(0, MP.timeLeft - dt);
  };

  // ------------------------------------------------------------ aim assist (Scott)
  const _eye = new THREE.Vector3(), _hd = new THREE.Vector3();
  /** Turn toward the closest visible enemy head: a hard lock while aiming down sights, a gentler pull while hip firing. */
  MP.autoAim = function (dt) {
    if (!MP.isScott()) return;
    const P = CF.Player, WP = CF.Weapons, inp = CF.Input;
    const aiming = WP.adsT > 0.3, firing = inp.mdown[0];
    if (!aiming && !firing) return;
    const cone = aiming ? 0.6 : 0.26; // radians off the crosshair
    P.eyePos(_eye);
    let best = null, bestAng = cone, bestYaw = 0, bestPitch = 0;
    for (const id in MP.remotes) {
      const r = MP.remotes[id];
      if (!r.alive || !MP.enemyOf(id) || r.prop) continue; // no locking onto disguised Props
      r.eyePos(_hd); _hd.y -= 0.06;
      const dx = _hd.x - _eye.x, dy = _hd.y - _eye.y, dz = _hd.z - _eye.z, flat = Math.hypot(dx, dz);
      if (flat + Math.abs(dy) > 90) continue;
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, flat);
      const ang = Math.hypot(U.wrapAngle(yaw - P.yaw), pitch - P.pitch);
      if (ang >= bestAng) continue;
      if (!CF.World.segmentClear(_eye.x, _eye.y, _eye.z, _hd.x, _hd.y, _hd.z)) continue;
      best = r; bestAng = ang; bestYaw = yaw; bestPitch = pitch;
    }
    if (!best) return;
    const k = 1 - Math.exp(-(aiming ? 16 : 7) * dt);
    P.yaw += U.wrapAngle(bestYaw - P.yaw) * k;
    P.pitch += (bestPitch - P.pitch) * k;
  };

  // ------------------------------------------------------------ spawning
  MP.pickSpawn = function () {
    const L = CF.Level, list = (MP.teamMode() ? L.spawns['t' + MP.team] : L.spawns.ffa) || L.spawns.ffa;
    // Revolver One-Shot: stay far from everyone and, when possible, out of their sight
    const sight = MP.mode === 'revolver';
    let best = list[0], bs = -Infinity;
    for (const s of list) {
      let md = 60;
      let seen = 0;
      for (const id in MP.remotes) {
        const r = MP.remotes[id]; if (!r.alive || !MP.enemyOf(id)) continue;
        md = Math.min(md, Math.hypot(r.body.pos.x - s[0], r.body.pos.z - s[2]));
        if (sight && CF.World.segmentClear(r.body.pos.x, r.body.pos.y + 1.6, r.body.pos.z, s[0], s[1] + 1.6, s[2])) seen++;
      }
      const score = md + Math.random() * 6 - seen * 25;
      if (score > bs) { bs = score; best = s; }
    }
    const yaw = Math.atan2(best[0], best[2]); // face toward the map centre
    return { x: best[0], y: best[1], z: best[2], yaw };
  };

  // ------------------------------------------------------------ UI helpers
  MP.boardRows = function () {
    const rows = [];
    for (const id in MP.players) { const p = MP.players[id]; rows.push({ id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths, color: p.color, me: id === MP.myId }); }
    rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    return rows;
  };
  MP.renderBoard = function (el) {
    if (MP.mode === 'prophunt') { CF.PH.renderBoard(el); return; }
    if (MP.mode === 'zombies' || MP.mode === 'coop') { CF.ZM.renderBoard(el); return; }
    el.textContent = ''; el.classList.remove('ph');
    const rows = MP.boardRows();
    const head = document.createElement('div'); head.className = 'sb-row sb-head';
    head.innerHTML = '<span>Operative</span><span>Kills</span><span>Deaths</span>';
    el.appendChild(head);
    for (const r of rows) {
      const d = document.createElement('div'); d.className = 'sb-row' + (r.me ? ' me' : '');
      const col = MP.tdm() ? TEAM[r.team].css : FFA_CSS[(r.color || 0) % FFA_CSS.length];
      const n = document.createElement('span'); n.textContent = r.name; n.style.borderLeftColor = col;
      const k = document.createElement('span'); k.textContent = r.kills;
      const de = document.createElement('span'); de.textContent = r.deaths;
      d.append(n, k, de); el.appendChild(d);
    }
    if (MP.tdm()) {
      const t = document.createElement('div'); t.className = 'sb-teams';
      t.innerHTML = '<b style="color:' + TEAM[0].css + '">' + TEAM[0].name + ' ' + MP.teamScores[0] + '</b><b style="color:' + TEAM[1].css + '">' + MP.teamScores[1] + ' ' + TEAM[1].name + '</b>';
      el.prepend(t);
    }
  };
  MP.teamNote = function () {
    if (MP.mode === 'prophunt') return CF.PH.teamNote();
    if (MP.mode === 'zombies') return { text: 'Everyone is on one team. Revive downed teammates by holding ' + CF.Keys.label('interact') + ' next to them.', css: '#8dff6a' };
    return MP.tdm() ? { text: 'You are on team ' + TEAM[MP.team].name + '.', css: TEAM[MP.team].css } : { text: '', css: '' };
  };
  MP.hudText = function () {
    if (MP.mode === 'prophunt') return Object.assign(CF.PH.hudText(), { room: CF.Net.code });
    if (MP.mode === 'zombies') return Object.assign(CF.ZM.hudText(), { room: CF.Net.code });
    const me = MP.players[MP.myId] || { kills: 0 };
    let lead = 0; for (const id in MP.players) lead = Math.max(lead, MP.players[id].kills);
    const mode = MP.modeDef().name;
    const score = MP.tdm() ? TEAM[0].name + ' ' + MP.teamScores[0] + ' · ' + MP.teamScores[1] + ' ' + TEAM[1].name : 'You ' + me.kills + ' · Leader ' + lead;
    return { mode: mode + ' · first to ' + MP.limit, time: U.fmtTime(MP.timeLeft), score, room: CF.Net.code };
  };
})(window.CF);
