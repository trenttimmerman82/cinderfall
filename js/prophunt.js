'use strict';
/* Cinderfall — Prop Hunt (multiplayer mode). Players split into Props and Hunters. Props get a head start while the
   Hunters are blindfolded, then walk up to a crate, barrel, chair… and press interact to become one: a chase camera
   behind the prop, slow movement, no weapons. Hunters keep their loadouts but deal reduced damage to Props for the
   first part of the hunt; a hit knocks a Prop out of its disguise. Found Props join the Hunters. Hunters win by
   finding every Prop before the clock runs out; Props win by lasting.
   Maps say what can be copied: PH.place() builds a small static prop and registers it as a hiding spot, PH.mark()
   registers one the map already built. The host runs the round (phases, teams) and sends it as 'ph' messages through
   the normal relay; each player's disguise rides along in their position updates. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const READY = 10;        // countdown once two players are in, so everyone can deploy
  const HIDE = 15;         // head start: Hunters are blind and frozen
  const EARLY = 45, EARLY_MUL = 0.35; // Hunters deal reduced damage to Props for the first seconds of the hunt
  const LOCK = 4;          // after a hit or a sprint a Prop can't disguise for this long
  const FAST = 3.4, FAST_T = 0.25; // moving faster than this (m/s) for this long breaks a disguise
  const REACH = 1.3;       // how close (to the object's edge) a Prop must be to copy it
  const PROP_SPEED = 0.55; // walking speed while disguised (sprinting goes over FAST)
  const HUNTER = 0, PROP = 1;
  const TEAMS = [{ name: 'Hunters', css: '#ff8a2a', c: [5.0, 1.9, 0.35] }, { name: 'Props', css: '#4dff9a', c: [0.6, 4.4, 1.9] }];
  const $ = (id) => document.getElementById(id);
  const MP = () => CF.MP;

  // ------------------------------------------------------------ what a Prop can become
  // parts: [shape, material, x, y, z, sx, sy, sz, rx, rz] in the prop's own frame (feet at y = 0, front facing -Z).
  // Boxes take full sizes, cylinders and cones (radius, height, radius), spheres their radii. col: collider [w, h, d].
  const legs = (m, x, z, h, t) => [[-x, -z], [x, -z], [-x, z], [x, z]].map(([a, b]) => ['box', m, a, h / 2, b, t, h, t]);
  const KINDS = {
    crate: { label: 'crate', col: [1.2, 1.2, 1.2], parts: [['box', 'crate', 0, 0.6, 0, 1.2, 1.2, 1.2]] },
    crateSmall: { label: 'small crate', col: [1, 1, 1], parts: [['box', 'crate', 0, 0.5, 0, 1, 1, 1]] },
    barrel: { label: 'barrel', col: [0.62, 0.96, 0.62], parts: [['cyl', 'paintBlue', 0, 0.475, 0, 0.3, 0.95, 0.3], ['cyl', 'steel', 0, 0.1, 0, 0.31, 0.04, 0.31], ['cyl', 'steel', 0, 0.85, 0, 0.31, 0.04, 0.31], ['cyl', 'paintDark', 0, 0.955, 0, 0.25, 0.01, 0.25]] },
    drum: { label: 'oil drum', col: [0.68, 1, 0.68], parts: [['cyl', 'paintRed', 0, 0.5, 0, 0.34, 1, 0.34], ['cyl', 'hazard', 0, 0.22, 0, 0.345, 0.07, 0.345], ['cyl', 'hazard', 0, 0.78, 0, 0.345, 0.07, 0.345]] },
    bin: { label: 'trash can', col: [0.64, 1.05, 0.64], parts: [['cyl', 'paintGrey', 0, 0.5, 0, 0.32, 1, 0.32], ['sphere', 'paintGrey', 0, 1, 0, 0.34, 0.1, 0.34]] },
    chair: { label: 'chair', surf: 'concrete', col: [0.46, 0.95, 0.46], parts: [['box', 'wood', 0, 0.445, 0, 0.44, 0.05, 0.44], ['box', 'wood', 0, 0.71, 0.195, 0.44, 0.48, 0.05]].concat(legs('wood', 0.18, 0.18, 0.42, 0.04)) },
    stool: { label: 'bar stool', col: [0.44, 0.84, 0.44], parts: [['cyl', 'steel', 0, 0.02, 0, 0.2, 0.04, 0.2], ['cyl', 'steel', 0, 0.4, 0, 0.035, 0.76, 0.035], ['cyl', 'paintDark', 0, 0.8, 0, 0.21, 0.08, 0.21], ['cyl', 'steel', 0, 0.3, 0, 0.16, 0.02, 0.16]] },
    box: { label: 'cardboard box', surf: 'concrete', col: [0.7, 0.6, 0.6], parts: [['box', 'cardboard', 0, 0.3, 0, 0.7, 0.6, 0.6]] },
    boxStack: { label: 'stack of boxes', surf: 'concrete', col: [0.9, 1.2, 0.8], parts: [['box', 'cardboard', 0, 0.35, 0, 0.9, 0.7, 0.8], ['box', 'cardboard', 0.08, 0.95, -0.05, 0.65, 0.5, 0.6]] },
    menuSign: { label: 'menu board', col: [0.72, 1.26, 0.44], parts: [['box', 'steel', -0.28, 0.03, 0, 0.06, 0.06, 0.44], ['box', 'steel', 0.28, 0.03, 0, 0.06, 0.06, 0.44], ['box', 'paintDark', 0, 0.66, 0, 0.72, 1.12, 0.1], ['box', 'windowWarm', 0, 0.7, 0, 0.56, 0.8, 0.12], ['box', 'neon_magenta', 0, 1.24, 0, 0.72, 0.04, 0.12]] },
    vending: { label: 'vending machine', col: [0.95, 1.9, 0.8], parts: [['box', 'paintDark', 0, 0.95, 0, 0.95, 1.9, 0.8], ['box', 'windowCool', -0.1, 1.2, -0.4, 0.6, 1.1, 0.03], ['box', 'steel', -0.1, 0.35, -0.4, 0.6, 0.18, 0.05], ['box', 'neon_cyan', 0.34, 0.95, -0.41, 0.04, 1.7, 0.02], ['box', 'paintDark', 0.34, 0.95, -0.4, 0.14, 0.3, 0.03]] },
    ac: { label: 'AC unit', col: [2.2, 1.3, 1.4], parts: [['box', 'paintGrey', 0, 0.625, 0, 2.2, 1.25, 1.4], ['cyl', 'steel', 0, 1.3, 0, 0.45, 0.08, 0.45]] },
    vent: { label: 'roof vent', col: [1, 1.2, 1], parts: [['cyl', 'steel', 0, 0.45, 0, 0.3, 0.9, 0.3], ['cone', 'paintDark', 0, 1.05, 0, 0.5, 0.3, 0.5], ['cyl', 'steel', 0, 0.02, 0, 0.42, 0.04, 0.42]] },
    generator: { label: 'generator', col: [1.5, 1.3, 0.9], parts: [['box', 'paintDark', 0, 0.05, 0, 1.5, 0.1, 0.9], ['box', 'paintYellow', 0, 0.55, 0, 1.4, 0.9, 0.8], ['box', 'paintDark', 0.35, 0.6, -0.41, 0.4, 0.35, 0.02], ['cyl', 'steel', -0.5, 1.15, 0.2, 0.06, 0.3, 0.06]] },
    tires: { label: 'tire stack', surf: 'concrete', col: [0.76, 0.69, 0.76], parts: [0, 1, 2].map((i) => ['cyl', 'rubber', 0, 0.12 + i * 0.23, 0, 0.38, 0.22, 0.38]) },
    hydrant: { label: 'fire hydrant', col: [0.4, 0.9, 0.4], parts: [['cyl', 'paintRed', 0, 0.4, 0, 0.16, 0.8, 0.16], ['sphere', 'paintRed', 0, 0.8, 0, 0.17, 0.14, 0.17], ['cyl', 'chrome', 0, 0.55, 0, 0.07, 0.5, 0.07, 0, Math.PI / 2]] },
    mailbox: { label: 'mailbox', surf: 'concrete', col: [0.4, 1.35, 0.5], parts: [['box', 'wood', 0, 0.525, 0, 0.1, 1.05, 0.1], ['cyl', 'paintGrey', 0, 1.18, 0, 0.16, 0.45, 0.16, Math.PI / 2], ['box', 'paintRed', 0.135, 1.325, -0.075, 0.03, 0.25, 0.05]] },
    grill: { label: 'barbecue grill', col: [0.66, 1.12, 0.66], parts: [['sphere', 'paintDark', 0, 0.82, 0, 0.33, 0.28, 0.33], ['sphere', 'chrome', 0, 1.1, 0, 0.04, 0.04, 0.04], ['box', 'chrome', -0.2, 0.35, 0.12, 0.04, 0.7, 0.04], ['box', 'chrome', 0.2, 0.35, 0.12, 0.04, 0.7, 0.04], ['box', 'chrome', 0, 0.35, -0.22, 0.04, 0.7, 0.04]] },
    cooler: { label: 'picnic cooler', col: [0.78, 0.6, 0.48], parts: [['box', 'paintRed', 0, 0.225, 0, 0.75, 0.45, 0.45], ['box', 'paintCream', 0, 0.49, 0, 0.78, 0.08, 0.48], ['box', 'chrome', 0, 0.56, 0, 0.4, 0.04, 0.04]] },
    planter: { label: 'potted shrub', surf: 'concrete', col: [0.76, 1.1, 0.76], parts: [['box', 'stone', 0, 0.275, 0, 0.7, 0.55, 0.7], ['sphere', 'leaves', 0, 0.8, 0, 0.38, 0.35, 0.38]] }
  };
  const KEYS = Object.keys(KINDS); // a disguise goes over the wire as its index here
  const PROP_LOADOUT = { label: 'Prop', weapons: { pistol: { mag: 0, reserve: 0 } }, current: 'pistol', grenades: 0, armor: 0, speed: 1 }; // never drawn: Props carry nothing

  const PH = CF.PH = {
    phase: 'wait', t: 0, round: 0, total: 0, huntT: 0, winner: '',
    kind: null, yaw: 0, lock: 0, fastT: 0, mesh: null, blind: false, prompted: false, camPos: new THREE.Vector3(),
    KINDS, KEYS, TEAMS, HUNTER, PROP, PROP_LOADOUT, HIDE
  };
  PH.on = () => MP().active && MP().mode === 'prophunt';
  PH.unarmed = () => PH.on() && MP().team === PROP;

  // ------------------------------------------------------------ models and map placement
  let matSrc = null, matCache = {};
  /** Standalone copies of the level's batch materials (the batches use vertex colours for their baked shading). */
  function mat(key) {
    const L = CF.Level;
    if (matSrc !== L.mats) { matSrc = L.mats; matCache = {}; }
    if (!matCache[key]) { const m = (L.mats[key] || L.mats.paintGrey).clone(); m.vertexColors = false; matCache[key] = m; }
    return matCache[key];
  }
  PH.model = function (kind) {
    const g = new THREE.Group();
    for (const p of KINDS[kind].parts) {
      const o = new THREE.Mesh(CF.Level.geo(p[0]), mat(p[1]));
      o.position.set(p[2], p[3], p[4]); o.scale.set(p[5], p[6], p[7]); o.rotation.set(p[8] || 0, 0, p[9] || 0);
      o.castShadow = true; o.receiveShadow = true; g.add(o);
    }
    return g;
  };
  /** Hit spheres along the prop's longest side, sized to its cross-section. */
  function hitsFor(kind, obj) {
    const dims = KINDS[kind].col, axis = dims.indexOf(Math.max(...dims)), long = dims[axis];
    const rr = Math.max(...dims.filter((v, i) => i !== axis)) / 2 * 0.95;
    const n = U.clamp(Math.ceil(long / (2 * rr) - 0.25), 1, 3), r = Math.max(rr, long / (2 * n)) * 0.95;
    const out = [];
    for (let i = 0; i < n; i++) {
      const off = new THREE.Vector3(0, dims[1] / 2, 0), a = -long / 2 + long * (i + 0.5) / n;
      if (axis === 0) off.x = a; else if (axis === 1) off.y = dims[1] / 2 + a; else off.z = a;
      out.push({ obj, off, r, mult: 1, tag: 'prop', w: new THREE.Vector3() });
    }
    return out;
  }
  /** Register something the map already built as a hiding spot. */
  PH.mark = function (kind, x, y, z, ry) { const L = CF.Level; if (L.hideSpots && KINDS[kind]) L.hideSpots.push({ kind, x, y: y || 0, z, ry: ry || 0 }); };
  /** Build a static prop into the level (baked geometry, collider, contact shadow) and register it as a hiding spot. */
  PH.place = function (kind, x, y, z, ry) {
    const L = CF.Level, k = KINDS[kind]; y = y || 0; ry = ry || 0;
    const base = L.mat4(x, y, z, 0, ry, 0, 1, 1, 1);
    for (const p of k.parts) L.addGeo(p[1], L.geo(p[0]), base.clone().multiply(L.mat4(p[2], p[3], p[4], p[8] || 0, 0, p[9] || 0, p[5], p[6], p[7])));
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = (k.col[0] * c + k.col[2] * s) / 2, hd = (k.col[0] * s + k.col[2] * c) / 2;
    W.add(x - hw, y, z - hd, x + hw, y + k.col[1], z + hd, { surf: k.surf || 'metal' });
    L.blob(x, z, hw * 2 + 0.5, hd * 2 + 0.5, y);
    PH.mark(kind, x, y, z, ry);
  };

  // ------------------------------------------------------------ round (host authoritative)
  PH.snap = () => ({ p: PH.phase, s: Math.ceil(PH.t), n: PH.round, total: PH.total, h: Math.round(PH.huntT) });
  /** The host's "Play again" (run by everyone): back to waiting, everyone a Hunter until the next round starts. */
  PH.reset = function () {
    const M = MP();
    PH.phase = 'wait'; PH.t = 0; PH.total = 0; PH.huntT = 0; PH.winner = '';
    for (const id in M.players) { M.players[id].team = HUNTER; M.players[id].found = false; }
    PH.teamsChanged();
  };
  /** Entering a match: local state only (a joiner learns the round from the host's welcome). */
  PH.setup = function () {
    PH.drop(); PH.lock = 0; PH.blind = false;
    PH.phase = 'wait'; PH.t = 0; PH.round = 0; PH.total = 0; PH.huntT = 0; PH.winner = '';
    PH.teamsChanged();
  };
  PH.clear = function () { PH.drop(); PH.blind = false; document.body.classList.remove('ph-prop'); };

  function send(msg) { msg.t = 'ph'; CF.Net.broadcast(msg); PH.apply(msg); }
  function setPhase(p, s) { send(Object.assign(PH.snap(), { p, s, h: 0 })); }
  function startRound() {
    const M = MP(), ids = Object.keys(M.players);
    // shuffle, then whoever hunted last round hides first
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    ids.sort((a, b) => (M.players[a].wasProp ? 1 : 0) - (M.players[b].wasProp ? 1 : 0));
    const props = ids.length - Math.max(1, Math.round(ids.length / 3)), teams = {};
    ids.forEach((id, i) => { teams[id] = i < props ? PROP : HUNTER; M.players[id].wasProp = i < props; });
    send({ p: 'hide', s: HIDE, n: PH.round + 1, total: props, h: 0, teams, time: M.modeDef().time });
  }
  /** Host: move the round along. Everyone counts the clocks down between messages (tick). */
  PH.hostUpdate = function () {
    const M = MP(); if (M.ended) return;
    const n = Object.keys(M.players).length;
    if (PH.phase === 'wait' && n >= 2) setPhase('ready', READY);
    else if (PH.phase === 'ready' && n < 2) setPhase('wait', 0);
    else if (PH.phase === 'ready' && PH.t <= 0) startRound();
    else if (PH.phase === 'hide' && PH.t <= 0) setPhase('hunt', 0);
  };
  PH.tick = function (dt) {
    if (PH.phase === 'ready' || PH.phase === 'hide') PH.t = Math.max(0, PH.t - dt);
    else if (PH.phase === 'hunt') PH.huntT += dt;
    if (MP().isHost()) PH.hostUpdate();
  };
  /** Round state from the host (also applied by the host itself). */
  PH.apply = function (msg) {
    const M = MP(), was = PH.phase, fresh = msg.n != null && msg.n !== PH.round && msg.p === 'hide', t = +msg.s || 0;
    if (was !== msg.p || Math.abs(t - PH.t) > 1.2) PH.t = t; // resyncs are rounded up; keep counting smoothly between them
    PH.phase = msg.p;
    if (msg.total != null) PH.total = msg.total;
    if (msg.h != null && Math.abs(msg.h - PH.huntT) > 1.5) PH.huntT = msg.h;
    if (msg.n != null) PH.round = msg.n;
    if (msg.time != null) M.timeLeft = msg.time;
    if (msg.teams) { for (const id in msg.teams) if (M.players[id]) { M.players[id].team = msg.teams[id]; M.players[id].found = false; M.players[id].kills = 0; } PH.teamsChanged(); }
    if (fresh) {
      CF.Game.mpRoundRespawn();
      if (M.team === PROP) { CF.HUD.popup('You are a Prop · hide!', 0, 'obj'); CF.HUD.killfeed('Round ' + PH.round + ' · ' + PH.total + ' Props hiding', 'Prop Hunt'); }
      else CF.HUD.popup('You are a Hunter · wait for the hunt', 0, 'obj');
      A.play('objective', null, { ui: true });
    }
    if (was !== 'hunt' && PH.phase === 'hunt') {
      CF.HUD.popup(M.team === PROP ? 'The Hunters are coming' : 'Hunt! Find every Prop', 0, 'obj');
      A.play('alert', null, { ui: true });
    }
  };
  PH.counts = function () {
    const M = MP(); let props = 0, hunters = 0;
    for (const id in M.players) { if (M.players[id].team === PROP) props++; else hunters++; }
    return { props, hunters };
  };
  /** Host: has the round been decided? Returns the banner text, or null. */
  PH.result = function () {
    if (PH.phase !== 'hide' && PH.phase !== 'hunt') return null;
    const c = PH.counts();
    if (c.props === 0) return 'Hunters win';
    if (c.hunters === 0) return 'Props win';
    if (PH.phase === 'hunt' && MP().timeLeft <= 0) return 'Props win';
    return null;
  };
  PH.onEnd = function (winner) { PH.winner = winner || ''; PH.phase = 'over'; PH.drop(); };
  /** A kill (every client runs this in the same order): a found Prop joins the Hunters. */
  PH.onKill = function (k, killer, victim, suicide) {
    if (!victim || victim.team !== PROP) return;
    victim.team = HUNTER; victim.found = true;
    if (killer && !suicide) killer.kills++;
    PH.teamsChanged();
    if (k.victim === MP().myId) CF.HUD.popup(suicide ? 'Out of the round · you hunt now' : 'Found! You hunt now', 0, '');
    const c = PH.counts();
    if (c.props > 0) CF.HUD.killfeed(c.props + ' Prop' + (c.props === 1 ? '' : 's') + ' left', '');
  };
  /** Team fields changed (round start, a Prop found, host resync): follow them locally and recolour players. */
  PH.teamsChanged = function () {
    const M = MP(), me = M.players[M.myId];
    if (me) M.team = me.team;
    for (const id in M.remotes) { const r = M.remotes[id], pl = M.players[id]; if (pl && r.team !== pl.team) { r.team = pl.team; PH.recolor(r); } }
    if (M.team !== PROP) PH.drop();
    document.body.classList.toggle('ph-prop', PH.on() && M.team === PROP);
  };
  PH.recolor = function (r) {
    const T = TEAMS[r.team] || TEAMS[0];
    r.m.glow.color.setRGB(T.c[0], T.c[1], T.c[2]); r.css = T.css;
    r.root.remove(r.tag); r.tag = MP().nameTag(r.name, r.css); r.root.add(r.tag);
  };

  // ------------------------------------------------------------ damage rules
  /** Shooter side: reduced damage against Props early in the hunt, so spraying every crate doesn't pay. */
  PH.damageMul = (r) => (PH.on() && r.team === PROP && PH.phase === 'hunt' && PH.huntT < EARLY ? EARLY_MUL : 1);
  /** Victim side: a hit knocks a Prop out of its disguise and keeps it out for a few seconds. */
  PH.onHurt = function () {
    if (!PH.on() || MP().team !== PROP) return;
    if (PH.kind) PH.reveal('Hit! Your disguise is blown');
    PH.lock = LOCK;
  };

  // ------------------------------------------------------------ the local Prop
  const _f = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3();
  function puff(x, y, z, big) {
    CF.FX.ring(new THREE.Vector3(x, y + 0.05, z), big ? 1.6 : 1.1, 0.4, [0.4, 1.6, 0.9]);
    CF.FX.glow(x, y + 0.7, z, big ? 1.8 : 1.2, 0.6, 2.2, 1.2, 0.2);
    CF.FX.debris(x, y + 0.5, z, 0, 1, 0, big ? 16 : 10, 3, 0.05, [0.5, 0.55, 0.5]);
  }
  /** The closest hiding spot in front of you, within reach of its edge. */
  PH.nearest = function () {
    const P = CF.Player, b = P.body.pos, f = P.forward(_f), spots = CF.Level.hideSpots || [];
    let best = null, bd = REACH;
    for (const s of spots) {
      const k = KINDS[s.kind], dx = s.x - b.x, dz = s.z - b.z, d = Math.hypot(dx, dz), edge = d - Math.max(k.col[0], k.col[2]) / 2;
      if (edge >= bd || Math.abs(s.y - b.y) > 1.8) continue;
      if (d > 0.4 && (dx * f.x + dz * f.z) / d < 0.3) continue;
      best = s; bd = edge;
    }
    return best;
  };
  PH.disguise = function (kind, ry) {
    const P = CF.Player, b = P.body.pos;
    PH.drop(true);
    PH.kind = kind; PH.yaw = ry || 0; PH.fastT = 0;
    PH.mesh = PH.model(kind); PH.mesh.position.copy(b); PH.mesh.rotation.y = PH.yaw; CF.Game.scene.add(PH.mesh);
    P.speedMul = PROP_SPEED; P.stopSprint(); P.crouching = false;
    PH.camPos.copy(CF.Game.camera.position);
    document.body.classList.add('ph-disguised');
    puff(b.x, b.y, b.z, false); A.play('pickup', null, { ui: true });
    CF.HUD.popup('Disguised as a ' + KINDS[kind].label, 0, '');
    MP().sendState();
  };
  /** Stop being a prop (quietly: death, team change, new round). */
  PH.drop = function (keepSpeed) {
    if (PH.mesh) { CF.Game.scene.remove(PH.mesh); PH.mesh = null; }
    if (!PH.kind) return;
    PH.kind = null;
    document.body.classList.remove('ph-disguised');
    if (!keepSpeed) CF.Player.speedMul = 1;
    const cam = CF.Game.camera;
    if (cam.fov !== CF.settings.fov) { cam.fov = CF.settings.fov; cam.updateProjectionMatrix(); }
    if (CF.Player.alive) CF.Player.updateCamera(0);
  };
  /** Forced out of the disguise: can't hide again for a few seconds. */
  PH.reveal = function (why) {
    if (!PH.kind) return;
    const b = CF.Player.body.pos;
    PH.drop(); PH.lock = LOCK;
    puff(b.x, b.y, b.z, true); A.play('shieldBreak', null, { ui: true });
    CF.HUD.popup(why || 'Revealed', 0, '');
    MP().sendState();
  };
  /** Chase camera behind the prop; the mouse orbits it and steers, the prop itself keeps the pose it copied. */
  PH.follow = function (dt) {
    const P = CF.Player, b = P.body.pos, cam = CF.Game.camera, k = KINDS[PH.kind];
    PH.mesh.position.copy(b); PH.mesh.rotation.y = PH.yaw;
    const size = Math.max(k.col[0], k.col[1], k.col[2]), dist = 2.4 + size * 1.3, pitch = U.clamp(P.pitch, -1.0, 0.45);
    _t.set(b.x, b.y + k.col[1] * 0.6 + 0.35, b.z);
    const cp = Math.cos(pitch);
    _f.set(Math.sin(P.yaw) * cp, -Math.sin(pitch), Math.cos(P.yaw) * cp);
    const hit = W.raycast(_t.x, _t.y, _t.z, _f.x, _f.y, _f.z, dist, null, true);
    _c.copy(_t).addScaledVector(_f, hit ? Math.max(0.3, hit.t - 0.25) : dist);
    PH.camPos.lerp(_c, 1 - Math.exp(-18 * dt));
    cam.position.copy(PH.camPos); cam.lookAt(_t);
    const fov = CF.settings.fov + 6;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  };
  function prompt(text) {
    if (text) { CF.HUD.interact(text, 0); PH.prompted = true; }
    else if (PH.prompted) { PH.prompted = false; CF.HUD.interact(null); }
  }
  /** Every frame, after the player moved. */
  PH.update = function (dt) {
    if (!PH.on()) return;
    const M = MP(), P = CF.Player, playing = CF.Game.state === 'playing' && P.alive, inp = CF.Input;
    // Hunters are blindfolded and frozen while the Props hide
    const blind = playing && M.team === HUNTER && PH.phase === 'hide';
    if (blind !== PH.blind) { PH.blind = blind; if (!blind) { P.frozen = false; CF.Post.setState({ fade: 1 }); } }
    if (blind) { P.frozen = true; CF.Post.setState({ fade: 0.04 }); CF.HUD.hint('Props are hiding · you hunt in ' + Math.ceil(PH.t)); }
    else if (playing && PH.phase === 'wait') CF.HUD.hint('Prop Hunt · waiting for a second player (room ' + CF.Net.code + ')');
    else if (playing && PH.phase === 'ready') CF.HUD.hint('Round starts in ' + Math.ceil(PH.t));
    else if (playing && M.team === HUNTER && PH.phase === 'hunt' && PH.huntT < EARLY) CF.HUD.hint('Props shrug off your first shots for ' + Math.ceil(EARLY - PH.huntT) + ' s');
    PH.lock = Math.max(0, PH.lock - dt);
    if (M.team !== PROP || !P.alive) { if (PH.kind) PH.drop(); prompt(null); return; }
    if (PH.kind) PH.follow(dt);
    if (!playing) { prompt(null); return; }
    // moving too fast (sprinting) blows the disguise
    if (PH.kind) {
      PH.fastT = Math.hypot(P.body.vel.x, P.body.vel.z) > FAST ? PH.fastT + dt : 0;
      if (PH.fastT > FAST_T) { PH.reveal('Too fast · your disguise slipped'); return; }
    }
    const spot = PH.nearest();
    if (PH.lock > 0) prompt(spot ? 'Revealed · hide again in ' + Math.ceil(PH.lock) + ' s' : null);
    else if (spot && (!PH.kind || spot.kind !== PH.kind)) {
      prompt('Become the ' + KINDS[spot.kind].label);
      if (inp.hit('KeyE')) PH.disguise(spot.kind, spot.ry);
    } else if (PH.kind) {
      prompt(null);
      if (inp.hit('KeyE')) { const b = P.body.pos; PH.drop(); puff(b.x, b.y, b.z, false); MP().sendState(); }
    } else prompt(null);
    if (PH.kind) CF.HUD.hint(PH.phase === 'hide' ? 'Hunters released in ' + Math.ceil(PH.t) + ' · hold still' : 'You are a ' + KINDS[PH.kind].label + ' · ' + CF.Keys.label('interact') + ' to drop it · sprinting blows your cover');
    else if (PH.phase === 'hide') CF.HUD.hint('Hide! Walk up to a crate, barrel or chair and press ' + CF.Keys.label('interact') + ' · ' + Math.ceil(PH.t) + ' s');
  };
  /** Our disguise, added to each position update. */
  PH.stateFields = function (msg) {
    if (PH.kind && CF.Player.alive) { msg.ph = KEYS.indexOf(PH.kind); msg.pr = +PH.yaw.toFixed(2); }
  };

  // ------------------------------------------------------------ other players' disguises
  /** From a position update: swap the operative for the prop (model and hit spheres) or back. */
  PH.applyRemote = function (r, s) {
    const kind = s.a && s.ph != null && KEYS[s.ph] ? KEYS[s.ph] : null;
    if (!r.opHit) r.opHit = r.m.hit;
    if (kind !== (r.prop || null)) {
      const was = r.prop;
      PH.dropRemote(r);
      if (kind) {
        r.prop = kind; r.propMesh = PH.model(kind); CF.Enemies.scene.add(r.propMesh);
        r.m.hit = hitsFor(kind, r.propMesh);
        puff(r.body.pos.x, r.body.pos.y, r.body.pos.z, false);
      } else if (was && !r.dead) { puff(r.body.pos.x, r.body.pos.y, r.body.pos.z, true); A.play('shieldBreak', r.body.pos, { ref: 6 }); }
    }
    r.propYaw = s.pr || 0;
    if (r.prop) r.root.visible = false; else if (!r.dead && !r.root.visible && r.alive) r.root.visible = true;
  };
  PH.updateRemote = function (r) {
    const m = r.propMesh; if (!m) return;
    m.position.copy(r.body.pos); m.rotation.y = r.propYaw || 0; m.updateMatrixWorld(true);
    r.root.visible = false;
  };
  PH.dropRemote = function (r) {
    if (r.propMesh) { CF.Enemies.scene.remove(r.propMesh); r.propMesh = null; }
    r.prop = null;
    if (r.opHit) r.m.hit = r.opHit;
  };

  // ------------------------------------------------------------ UI
  PH.teamNote = function () {
    const M = MP(), T = TEAMS[M.team] || TEAMS[0];
    if (PH.phase === 'wait' || PH.phase === 'ready' || PH.phase === 'over') return { text: 'Teams are picked when the round starts.', css: '' };
    return { text: M.team === PROP ? 'You are a Prop: hide, blend in, survive the clock.' : 'You are a Hunter: find every Prop before time runs out.', css: T.css };
  };
  PH.hudText = function () {
    const M = MP(), c = PH.counts(), left = c.props + ' of ' + PH.total + ' Props left';
    const role = PH.phase === 'hide' || PH.phase === 'hunt' ? ' · ' + (M.team === PROP ? 'Prop' : 'Hunter') : '';
    const time = PH.phase === 'hunt' ? U.fmtTime(M.timeLeft) : PH.phase === 'ready' || PH.phase === 'hide' ? U.fmtTime(Math.ceil(PH.t)) : '–:––';
    const score = PH.phase === 'wait' ? 'Waiting for players' : PH.phase === 'ready' ? 'Round starts soon' : PH.phase === 'hide' ? 'Props hiding · ' + left : PH.phase === 'over' ? PH.winner || 'Round over' : left;
    return { mode: 'Prop Hunt' + role, time, score };
  };
  /** Scoreboard: Props left and the clock up top; each player's role and how many Props they found. */
  PH.renderBoard = function (el) {
    const M = MP(), c = PH.counts();
    el.textContent = ''; el.classList.add('ph');
    const top = document.createElement('div'); top.className = 'sb-teams';
    const a = document.createElement('b'); a.style.color = TEAMS[PROP].css; a.textContent = 'Props left ' + (PH.phase === 'hide' || PH.phase === 'hunt' || PH.phase === 'over' ? c.props + ' / ' + PH.total : '–');
    const b = document.createElement('b'); b.style.color = TEAMS[HUNTER].css; b.textContent = PH.hudText().time;
    top.append(a, b); el.appendChild(top);
    const head = document.createElement('div'); head.className = 'sb-row sb-head';
    head.innerHTML = '<span>Operative</span><span>Role</span><span>Found</span>';
    el.appendChild(head);
    const rows = Object.keys(M.players).map((id) => Object.assign({ id }, M.players[id]));
    rows.sort((x, y) => (y.team - x.team) || (y.kills - x.kills));
    for (const r of rows) {
      const d = document.createElement('div'); d.className = 'sb-row' + (r.id === M.myId ? ' me' : '');
      const T = TEAMS[r.team] || TEAMS[0];
      const n = document.createElement('span'); n.textContent = r.name; n.style.borderLeftColor = T.css;
      const role = document.createElement('span'); role.textContent = r.team === PROP ? 'Prop' : r.found ? 'Found' : 'Hunter'; role.style.color = T.css;
      const f = document.createElement('span'); f.textContent = r.kills || 0;
      d.append(n, role, f); el.appendChild(d);
    }
  };
})(window.CF);
