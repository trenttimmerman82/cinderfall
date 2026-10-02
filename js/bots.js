'use strict';
/* Cinderfall — practice bots: computer players for offline matches (Multiplayer → Practice vs bots).
   A bot is a multiplayer Remote (js/mp.js) that moves and shoots by itself instead of following network updates.
   It talks to the match through the same host messages a player's client would send (hits, deaths, flag touches),
   so kills, scores, Capture the Flag and the match clock all run on the normal multiplayer rules.
   Bots walk the navigation grid (js/world.js, W.findPath), spot enemies in their field of view or by the noise
   of their shots, and fire hitscan shots whose spread grows with range, movement and a lower skill. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const MP = () => CF.MP;
  const RESPAWN = 3.5, GRAVITY = 19.5, RUN = 5.1;
  const NAMES = ['Viper', 'Kestrel', 'Onyx', 'Havoc', 'Rook', 'Juno', 'Talon', 'Mako', 'Nyx', 'Brick', 'Echo', 'Sable', 'Wraith', 'Cobalt'];
  // moveErr/settle (easy only): shots are moveErr× wilder against a moving target and only tighten to normal once it has stood still for `settle` seconds
  // react: seconds before the first shot at a new target; err: aim wobble (radians); turn: how fast they swing onto you;
  // head: chance a shot goes for the head; sight: how far they spot you; fov: how wide they look (radians)
  const SKILL = {
    easy: { label: 'Easy', react: 1.1, err: 0.09, turn: 2.5, head: 0.02, sight: 40, fov: 1.6, burst: [1, 3], pause: [0.8, 1.5], semi: [0.5, 0.9], moveErr: 5, settle: 1.6 },
    normal: { label: 'Normal', react: 0.45, err: 0.042, turn: 6, head: 0.16, sight: 65, fov: 2.1, burst: [3, 7], pause: [0.3, 0.6], semi: [0.12, 0.3] },
    hard: { label: 'Hard', react: 0.24, err: 0.024, turn: 9, head: 0.3, sight: 100, fov: 2.5, burst: [5, 10], pause: [0.15, 0.35], semi: [0.04, 0.14] }
  };
  // how far each gun likes to fight from, and the furthest it bothers shooting
  const RANGE = { carbine: [14, 70], minigun: [12, 50], shotgun: [5, 22], pistol: [10, 45], rail: [30, 200], lmg: [14, 65], revolver: [18, 80], flamer: [4, 10],
    wasp: [6, 30], magnum: [12, 60], tempo: [10, 50], sawnoff: [3, 14], arc: [3, 15] };
  // the sidearms a bot may carry (not the Pip-40: lobbed grenades need aiming bots can't do)
  const BOT_SIDEARMS = ['pistol', 'pistol', 'wasp', 'magnum', 'tempo', 'sawnoff', 'arc', 'revolver'];
  const Bots = CF.Bots = { list: [], skill: 'normal', SKILL, killY: -30 };
  const _eye = new THREE.Vector3(), _aim = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _e = new THREE.Vector3(), _m = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const rv = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /** Everyone a bot might shoot at or run to: the local player and the bots, with what the AI needs to know. */
  function actors() {
    const M = MP(), P = CF.Player, out = [];
    out.push({ id: M.myId, team: M.team, pos: P.body.pos, alive: P.alive && CF.Game.state === 'playing' && !CF.Game.mpLobby && !CF.RC.driving && CF.BR.fl !== 3,
      crouch: P.crouching ? 0.66 : 1, speed: Math.hypot(P.body.vel.x, P.body.vel.z), shotT: M.shotT == null ? -99 : M.shotT });
    for (const b of Bots.list) out.push({ id: b.id, team: b.team, pos: b.body.pos, alive: b.alive && b.fl !== 3, crouch: 1, speed: Math.hypot(b.body.vel.x, b.body.vel.z), shotT: b.shotT, bot: b });
    return out;
  }
  const hostile = (a, b) => a.id !== b.id && (!MP().teamMode() || a.team !== b.team);
  function actor(id) { for (const a of actors()) if (a.id === id) return a; return null; }

  function loadoutFor() {
    const M = MP();
    if (M.mode === 'revolver') return M.REVOLVER;
    if (M.mode === 'br') return CF.BR.kit(); // Battle Royale: a pistol, then whatever they find
    if (M.mode === 'sniper') return M.SNIPER[pick(M.SNIPER_KEYS)];
    const k = pick(['assault', 'assault', 'breacher', 'marksman', 'gunner', 'heavy', 'gunslinger', 'pyro']), d = M.DEFAULT_KITS[k]; // no Demolition: rockets and satchels need aiming bots can't do
    let side = pick(BOT_SIDEARMS); if (side === d.primary) side = 'pistol';
    return M.buildLoadout(Object.assign({}, d, { secondary: side }), d.label, d.desc);
  }

  class Bot extends CF.MP.Remote {
    constructor(id, info, skill) {
      super(id, info);
      this.bot = true; this.sk = SKILL[skill] || SKILL.normal;
      Object.assign(this.body, { radius: 0.38, height: 1.8, stepHeight: 0.62, grounded: false, stepped: 0 });
      this.wish = new THREE.Vector3(); this.lastPos = new THREE.Vector3(); this.known = new THREE.Vector3();
      this.hp = 100; this.armor = 0; this.respawnT = U.rand(0.3, 1.6); this.shotT = -99;
      this.target = null; this.path = null; this.pi = 0; this.goal = null; this.planT = 0; this.scanT = 0; this.idleT = 0;
      this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 0; this.stuckT = 0; this.stuckN = 0; this.touchT = 0;
    }

    // ---------------------------------------------------------- life and death
    spawn() {
      const M = MP(), s = Bots.pickSpawn(this), lo = this.lo = loadoutFor();
      this.ammo = {}; for (const w in lo.weapons) this.ammo[w] = { mag: lo.weapons[w].mag, reserve: lo.weapons[w].reserve };
      this.rdefs = {}; this.equip(lo.current);
      const b = this.body;
      b.pos.set(s[0], s[1], s[2]); b.vel.set(0, 0, 0); this.tp.copy(b.pos); this.lastPos.copy(b.pos);
      this.yaw = this.tyaw = Math.atan2(s[0], s[2]); this.pitch = 0; // face the middle of the map
      this.dead = false; this.alive = true; this.deadT = 0; this.downed = false;
      this.root.visible = true; this.root.rotation.set(0, this.yaw, 0); this.m.p.hips.position.y = 0.95;
      this.hp = 100; this.armor = lo.armor || 0; this.speedMul = lo.speed || 1; this.fl = 0;
      this.protect = true; this.protectT = CF.time + M.modeDef().protect; this.shield.visible = true;
      this.target = null; this.path = null; this.goal = null; this.planT = 0; this.idleT = 0; this.hurt = null; this.lastHit = null;
      this.cd = U.rand(0.2, 0.5); this.reloadT = 0; this.burst = 0; this.stuckT = 0; this.stuckN = 0;
    }
    equip(wid) {
      this.wid = wid; this.def = (this.rdefs && this.rdefs[wid]) || CF.Weapons.defs[wid]; // Battle Royale: the rarity it was found at
      if (this.armedW !== wid) { this.armedW = wid; CF.Skins.arm(this.m, wid, this.finish || null); }
    }
    die() {
      if (this.dead) return;
      super.die();
      this.respawnT = RESPAWN; this.path = null; this.target = null; this.wish.set(0, 0, 0);
    }
    /** Put the bot out of play without the death effects (a new round). */
    bench(t) {
      this.dead = true; this.alive = false; this.root.visible = false; this.shield.visible = false;
      this.respawnT = t; this.path = null; this.target = null;
    }
    /** A hit routed here by the host (MP.onHostMsg), from the player or another bot. */
    applyHit(msg) {
      const M = MP();
      if (!this.alive || M.ended || this.protect) return;
      const by = M.players[msg.by];
      if (M.teamMode() && by && by.team === this.team && msg.by !== this.id) return;
      let dmg = +msg.dmg || 0;
      if (this.armor > 0) { const ab = Math.min(this.armor, dmg * 0.66); this.armor -= ab; dmg -= ab; }
      this.hp -= dmg;
      this.lastHit = { by: msg.by, w: msg.w, head: msg.head, t: CF.time };
      this.hurt = { by: msg.by, t: CF.time };
      if (this.hp <= 0) { this.hp = 0; M.onHostMsg(this.id, { t: 'died', killer: msg.by, w: msg.w, head: msg.head ? 1 : 0 }); }
    }
    fell() {
      const lh = this.lastHit, recent = lh && CF.time - lh.t < 8;
      MP().onHostMsg(this.id, { t: 'died', killer: recent ? lh.by : null, w: recent ? lh.w : 'env', head: 0 });
    }

    update(dt) {
      const M = MP();
      if (this.dead) {
        if (!CF.Game.mpLobby && !M.ended && CF.BR.canRespawn()) { this.respawnT -= dt; if (this.respawnT <= 0) this.spawn(); }
      } else if (M.ended || CF.Game.mpLobby) this.wish.set(0, 0, 0);
      else this.think(dt);
      super.update(dt);
    }

    // ---------------------------------------------------------- senses
    scan() {
      const sk = this.sk, me = { id: this.id, team: this.team }, sight = this.def && this.def.scope ? Math.max(sk.sight, 150) : sk.sight; // a scope sees across Sniper Valley
      this.eyePos(_eye);
      let best = null, bs = Infinity;
      for (const t of actors()) {
        if (!t.alive || !hostile(me, t)) continue;
        const dx = t.pos.x - _eye.x, dz = t.pos.z - _eye.z, d = Math.hypot(dx, dz, t.pos.y + 1.3 - _eye.y);
        const known = this.target && this.target.id === t.id;
        if (d > sight * (known ? 1.3 : 1)) continue;
        const ang = Math.abs(U.wrapAngle(Math.atan2(-dx, -dz) - this.yaw));
        const heard = (CF.time - t.shotT < 1.2 && d < 45) || d < 5 || (this.hurt && this.hurt.by === t.id && CF.time - this.hurt.t < 2);
        if (!known && !heard && ang > sk.fov / 2) continue;
        const cy = t.pos.y + 1.2 * t.crouch;
        if (!W.segmentClear(_eye.x, _eye.y, _eye.z, t.pos.x, cy + 0.4, t.pos.z) && !W.segmentClear(_eye.x, _eye.y, _eye.z, t.pos.x, cy, t.pos.z)) continue;
        const score = d * (known ? 0.6 : 1) + ang * 4;
        if (score < bs) { bs = score; best = t; }
      }
      if (best) {
        if (!this.target || this.target.id !== best.id) this.reactT = this.sk.react * U.rand(0.8, 1.3);
        this.target = { id: best.id }; this.seenT = CF.time; this.known.copy(best.pos); this.chase = true;
      } else if (this.target && CF.time - this.seenT > 0.5) {
        this.target = null; this.planT = 0; // lost sight: go to where they were last seen
      }
    }

    // ---------------------------------------------------------- brain
    think(dt) {
      const M = MP(), b = this.body, sk = this.sk;
      if (this.protect && CF.time > this.protectT) this.protect = false;
      this.shield.visible = this.protect;
      this.cd -= dt; this.repathT = (this.repathT || 0) - dt;
      if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.reloaded(); }
      this.scanT -= dt;
      if (this.scanT <= 0) { this.scanT = U.rand(0.12, 0.24); this.scan(); }
      if (M.mode === 'br' && CF.BR.botThink(this, dt)) { this.checkStuck(dt); return; } // the drop, the storm and looting
      if (M.mode === 'ctf') this.ctfTouch(dt);
      const t = this.target ? actor(this.target.id) : null;
      if (t && !t.alive) this.target = null;
      const speed = RUN * this.speedMul;
      if (this.target && t) {
        // aim at them and shoot, while strafing (or, carrying a flag, while running home)
        this.eyePos(_eye);
        const aimY = t.pos.y + 1.2 * t.crouch;
        const dx = t.pos.x - _eye.x, dz = t.pos.z - _eye.z, dy = aimY - _eye.y, flat = Math.hypot(dx, dz), d = Math.hypot(flat, dy);
        const wantYaw = Math.atan2(-dx, -dz), wantPitch = Math.atan2(dy, flat);
        const k = Math.min(1, dt * sk.turn);
        this.yaw += U.wrapAngle(wantYaw - this.yaw) * k; this.pitch += (wantPitch - this.pitch) * k;
        this.reactT -= dt;
        this.stillT = t.speed < 1 ? (this.stillT || 0) + dt : 0; // how long the target has been standing still
        const off = Math.abs(U.wrapAngle(wantYaw - this.yaw)) + Math.abs(wantPitch - this.pitch);
        const range = RANGE[this.wid] || RANGE.carbine;
        const still = this.def.scope || this.wid === 'revolver'; // rifles and revolvers stop to aim
        if (this.reactT <= 0 && off < 0.12 && this.cd <= 0 && this.reloadT <= 0 && d < range[1]) this.fire(t, d);
        if (this.carrying() || (M.mode === 'ctf' && this.role !== 'defend' && d > 14 && CF.CTF.flags.length)) {
          // the flag comes first: keep running the objective and shoot on the move
          this.objT = (this.objT || 0) - dt;
          if (this.objT <= 0 || !this.path) { this.objT = 1; this.setGoal(this.ctfGoal()); }
          this.walkPath(speed);
        }
        else if (d > range[0] + 12 && !still) { this.goal = { x: t.pos.x, z: t.pos.z, id: t.id }; this.walkPath(speed, 1.2); }
        else this.skirmish(dt, t, d, range[0], still && this.reactT < 0.35 && this.cd < 0.3 ? 0 : speed * 0.7);
      } else {
        if (this.planT <= 0 || (!this.path && this.idleT <= 0)) this.plan();
        this.planT -= dt;
        if (this.path) this.walkPath(speed, this.goal && this.goal.id ? 1.5 : 0);
        else { this.idleT -= dt; this.wish.set(0, 0, 0); this.lookAround(dt); }
        if (this.path) { const w = this.wish; if (w.x || w.z) this.turnTo(Math.atan2(-w.x, -w.z), dt); this.pitch *= 1 - Math.min(1, dt * 4); }
        if (this.reloadT <= 0 && this.ammo[this.wid].mag < this.lo.weapons[this.wid].mag * 0.5) this.reload(); // top up between fights
      }
      this.checkStuck(dt);
    }
    turnTo(yaw, dt) { this.yaw += U.wrapAngle(yaw - this.yaw) * Math.min(1, dt * this.sk.turn * 0.8); }
    lookAround(dt) {
      this.lookT = (this.lookT || 0) - dt;
      if (this.lookT <= 0) { this.lookT = U.rand(1, 2.5); this.lookYaw = this.yaw + U.rand(-1.4, 1.4); }
      const M = MP();
      if (M.mode === 'sniper') { const c = Bots.centre(1 - this.team); this.lookYaw = Math.atan2(-(c[0] - this.body.pos.x), -(c[2] - this.body.pos.z)) + Math.sin(CF.time * 0.4 + this.phase) * 0.5; }
      this.yaw += U.wrapAngle(this.lookYaw - this.yaw) * Math.min(1, dt * 1.5);
    }

    /** Where to go when nobody is in sight. */
    plan() {
      const M = MP(), b = this.body, L = CF.Level;
      this.planT = 10; this.idleT = 0;
      let g = null;
      if (this.chase && this.known) { g = { x: this.known.x, z: this.known.z }; this.chase = false; this.planT = 8; } // last seen here
      else if (M.mode === 'ctf' && CF.CTF.flags.length) { g = this.ctfGoal(); this.planT = 1; }
      else if (CF.BR.match()) { g = CF.BR.botGoal(this); this.planT = 4; }
      else if (M.mode === 'sniper') {
        const c = Bots.centre(this.team), i = W.randomReachable(c[0], c[2], 14);
        if (i >= 0) g = { x: W.cellX(i), z: W.cellZ(i) };
        this.idleT = U.rand(4, 9); // then hold the spot and watch the other roof
      } else {
        const en = actors().filter((a) => a.alive && hostile({ id: this.id, team: this.team }, a));
        if (en.length && Math.random() < 0.6) { const t = pick(en); g = { x: t.pos.x, z: t.pos.z, id: t.id }; this.planT = 2.5; } // hunt someone
        else { const s = pick(L.spawns.ffa || [[0, 0, 0]]); g = { x: s[0], z: s[2] }; this.idleT = U.rand(0.5, 2); }
      }
      if (!g) { this.path = null; this.idleT = U.rand(1, 3); return; }
      this.setGoal(g);
    }
    setGoal(g) {
      const b = this.body;
      if (g.id) { const a = actor(g.id); if (a) { g.x = a.pos.x; g.z = a.pos.z; } }
      this.goal = g;
      this.path = W.findPath(b.pos.x, b.pos.z, g.x, g.z) || [g.x, g.z]; // unreachable on the grid: head straight for it
      this.pi = this.path.length > 2 ? 2 : 0;
    }
    /** Follow the path; repath every `every` s toward a goal that moves (a player). */
    walkPath(speed, every) {
      const b = this.body;
      if (!this.path || (every && this.repathT <= 0)) { this.repathT = every || 0; if (this.goal) this.setGoal(this.goal); else { this.wish.set(0, 0, 0); return; } }
      const p = this.path;
      while (this.pi < p.length && (p[this.pi] - b.pos.x) ** 2 + (p[this.pi + 1] - b.pos.z) ** 2 < 0.6) this.pi += 2;
      if (this.pi >= p.length) { this.path = null; this.wish.set(0, 0, 0); return; }
      const j = Math.min(this.pi + 2, p.length - 2); // look a cell ahead so diagonals don't zigzag
      let dx = p[j] - b.pos.x, dz = p[j + 1] - b.pos.z;
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      this.wish.set(dx * speed, 0, dz * speed);
    }
    /** Close fight: sidestep, keeping near the gun's favourite range, without walking off a roof. */
    skirmish(dt, t, d, pref, speed) {
      const b = this.body;
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = U.rand(0.5, 1.4); if (Math.random() < 0.6) this.strafe *= -1; }
      let fx = t.pos.x - b.pos.x, fz = t.pos.z - b.pos.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
      const toward = U.clamp((d - pref) / 8, -1, 1);
      let mx = -fz * this.strafe + fx * toward, mz = fx * this.strafe + fz * toward;
      const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      if (!Bots.safe(b.pos, mx, mz)) { this.strafe *= -1; mx = fx * toward; mz = fz * toward; if (!Bots.safe(b.pos, mx, mz)) mx = mz = 0; }
      this.wish.set(mx * speed, 0, mz * speed);
    }
    checkStuck(dt) {
      const b = this.body;
      this.stuckT += dt;
      if (this.stuckT < 0.8) return;
      const moved = Math.hypot(b.pos.x - this.lastPos.x, b.pos.z - this.lastPos.z), wanted = Math.hypot(this.wish.x, this.wish.z) * this.stuckT;
      this.stuckT = 0; this.lastPos.copy(b.pos);
      if (wanted > 1.5 && moved < wanted * 0.25) {
        this.stuckN++;
        if (b.grounded) b.vel.y = 6.2; // hop over whatever is in the way
        if (this.stuckN >= 3) { this.stuckN = 0; this.path = null; this.goal = null; this.planT = 0; this.strafe *= -1; }
        else if (this.goal) this.setGoal(this.goal);
      } else this.stuckN = 0;
    }

    // ---------------------------------------------------------- Capture the Flag
    carrying() { const F = CF.CTF.flags; return MP().mode === 'ctf' && F.length === 2 && F[1 - this.team].s === 1 && F[1 - this.team].by === this.id; }
    ctfGoal() {
      const F = CF.CTF.flags, mine = F[this.team], theirs = F[1 - this.team], at = (p) => ({ x: p[0], z: p[2] });
      if (this.carrying()) return at(mine.home);
      if (mine.s === 2) return at(mine.p); // our flag is lying out there: return it
      if (mine.s === 1) return { x: 0, z: 0, id: mine.by }; // chase whoever has it
      if (this.role === 'defend') { const i = W.randomReachable(mine.home[0], mine.home[2], 8); return i >= 0 ? { x: W.cellX(i), z: W.cellZ(i) } : at(mine.home); }
      if (theirs.s === 1) return { x: 0, z: 0, id: theirs.by }; // a teammate has it: escort them
      return at(theirs.p);
    }
    ctfTouch(dt) {
      this.touchT -= dt;
      if (this.touchT > 0) return;
      const C = CF.CTF, F = C.flags; if (F.length < 2) return;
      const p = this.body.pos, near = (a) => Math.hypot(a[0] - p.x, a[2] - p.z) < 1.8 && Math.abs(a[1] - p.y) < 2.2;
      const mine = F[this.team], theirs = F[1 - this.team];
      let op = null, f = 0;
      if (theirs.s !== 1 && near(theirs.p)) { op = 'take'; f = 1 - this.team; }
      else if (mine.s === 2 && near(mine.p)) { op = 'ret'; f = this.team; }
      else if (this.carrying() && mine.s === 0 && near(mine.home)) { op = 'cap'; f = 1 - this.team; }
      if (op) { this.touchT = 0.4; C.onHost(this.id, { op, f }); this.planT = 0; this.path = null; }
    }

    // ---------------------------------------------------------- guns
    reload() {
      const a = this.ammo[this.wid], max = this.lo.weapons[this.wid].mag;
      if (a.mag >= max) return;
      if (a.reserve <= 0) { // dry: pull the other gun
        const other = Object.keys(this.ammo).find((w) => w !== this.wid && (this.ammo[w].mag > 0 || this.ammo[w].reserve > 0));
        if (other) { this.equip(other); this.cd = 0.5; }
        return;
      }
      this.reloadT = this.def.reload || 2;
    }
    reloaded() {
      const a = this.ammo[this.wid], take = Math.min(this.lo.weapons[this.wid].mag - a.mag, a.reserve);
      a.mag += take; a.reserve -= take;
    }
    fire(t, d) {
      const M = MP(), def = this.def, sk = this.sk, a = this.ammo[this.wid];
      if (a.mag <= 0) { this.reload(); return; }
      a.mag--;
      this.protect = false; this.shotT = CF.time;
      // cadence: automatic guns fire in bursts, the rest at a human pace
      const iv = 60 / def.rpm;
      if (def.auto) { if (--this.burst > 0) this.cd = iv; else { this.burst = Math.round(U.rand(sk.burst[0], sk.burst[1])); this.cd = iv + U.rand(sk.pause[0], sk.pause[1]); } }
      else this.cd = iv + U.rand(sk.semi[0], sk.semi[1]);
      // aim: at the chest, sometimes the head; the shot wanders more at range, on the move and against a moving target
      this.eyePos(_eye);
      const cs = t.crouch, headShot = Math.random() < sk.head, aimY = (headShot ? 1.62 : 1.2) * cs;
      _aim.set(t.pos.x, t.pos.y + aimY, t.pos.z);
      _f.subVectors(_aim, _eye).normalize(); _r.crossVectors(_f, UP).normalize(); _u.crossVectors(_r, _f);
      const moving = Math.hypot(this.body.vel.x, this.body.vel.z) > 1;
      const spread = (moving ? def.spreadHip : def.scope || this.wid === 'revolver' ? def.spreadAds : def.spreadHip * 0.6) * Math.PI / 180 * 0.5;
      const steady = !moving && def.scope ? 0.3 : 1; // a scoped rifle held still barely wavers
      const settle = sk.moveErr ? U.lerp(sk.moveErr, 1, Math.min(1, (this.stillT || 0) / sk.settle)) : 1; // easy bots only land shots on a target that has stopped
      const sigma = sk.err * steady * settle * (1 + (moving ? 0.5 : 0) + Math.min(1, t.speed / 6) * 0.6) + spread;
      const fall = d <= def.falloff[0] ? 1 : d >= def.falloff[1] ? def.falloff[2] : U.lerp(1, def.falloff[2], (d - def.falloff[0]) / (def.falloff[1] - def.falloff[0]));
      let dmg = 0, head = false, whiz = false;
      const ends = [];
      for (let i = 0; i < (def.pellets || 1); i++) {
        const mx = U.gauss() * sigma * d * 1.4, my = U.gauss() * sigma * d * 1.4, hy = aimY + my;
        const hitHead = Math.abs(mx) < 0.14 && hy > 1.46 * cs && hy < 1.8 * cs, hitBody = Math.abs(mx) < 0.3 && hy > 0.1 && hy <= 1.46 * cs;
        _e.copy(_aim).addScaledVector(_r, mx).addScaledVector(_u, my);
        if (hitHead || hitBody) {
          dmg += (M.mode === 'revolver' && this.wid === 'revolver') ? 999 : def.dmg * fall * (hitHead ? def.head : 1) * (def.pvp || 1);
          head = head || hitHead;
        } else {
          // a miss flies on until it hits the map
          _m.subVectors(_e, _eye).normalize();
          const far = def.range || 150, h = W.raycast(_eye.x, _eye.y, _eye.z, _m.x, _m.y, _m.z, far);
          _e.copy(_eye).addScaledVector(_m, h ? h.t : far);
          if (t.id === M.myId && Math.hypot(mx, my) < 2.5) whiz = true;
        }
        if (ends.length < 4) ends.push(rv(_e));
      }
      this.m.p.muzzle.getWorldPosition(_m);
      M.showFx({ t: 'fx', id: this.id, w: this.wid, m: rv(_m), e: ends });
      if (whiz) A.play('whiz', null, { ui: true, vol: 0.6 });
      if (dmg > 0) M.onHostMsg(this.id, { t: 'hit', to: t.id, dmg: Math.round(dmg * 10) / 10, head: head ? 1 : 0, w: this.wid, from: rv(this.body.pos) });
      if (a.mag <= 0) this.reload();
    }

    // ---------------------------------------------------------- body (called by Remote.update in place of network smoothing)
    sim(dt) {
      const b = this.body;
      if (this.fl) { CF.BR.botFly(this, dt); this.tp.copy(b.pos); return; } // Battle Royale: on the bus or in the air
      b.vel.x = U.damp(b.vel.x, this.wish.x, 10, dt); b.vel.z = U.damp(b.vel.z, this.wish.z, 10, dt);
      b.vel.y -= GRAVITY * dt;
      W.moveBody(b, dt);
      if (b.grounded && b.vel.y < 0) b.vel.y = 0;
      // don't stand inside each other
      for (const o of Bots.list) {
        if (o === this || !o.alive) continue;
        const dx = b.pos.x - o.body.pos.x, dz = b.pos.z - o.body.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.64 && d2 > 1e-6 && Math.abs(b.pos.y - o.body.pos.y) < 1.5) { const d = Math.sqrt(d2), push = (0.8 - d) * 0.5; b.pos.x += dx / d * push; b.pos.z += dz / d * push; }
      }
      this.tp.copy(b.pos);
      if (b.pos.y < Bots.killY && this.alive) this.fell();
    }
  }

  // ------------------------------------------------------------ the roster
  Bots.setup = function (n, skill) {
    const M = MP(), L = CF.Level;
    Bots.list = []; Bots.skill = SKILL[skill] ? skill : 'normal'; Bots.count = n;
    if (!n) return;
    if (!W.nav) W.buildNav();
    let low = Infinity; for (const k in L.spawns) for (const s of L.spawns[k]) if (s.length > 2) low = Math.min(low, s[1]);
    Bots.killY = (isFinite(low) ? low : 0) - 12; // fell off the map
    const names = NAMES.slice().sort(() => Math.random() - 0.5);
    const perTeam = [0, 0];
    for (let i = 0; i < n; i++) {
      const id = 'bot' + i, team = M.tdm() ? (i % 2 === 0 ? 1 : 0) : 0; // you're on Voltage: the odd bot out joins Ronin
      M.players[id] = { name: names[i % names.length], team, kills: 0, deaths: 0, color: M.colorIdx++, skin: {}, pub: null, bot: true };
      const b = new Bot(id, M.players[id], Bots.skill);
      b.role = M.mode === 'ctf' && perTeam[team]++ % 3 === 1 ? 'defend' : 'attack'; // in CTF one in three stays home
      M.remotes[id] = b; CF.Enemies.list.push(b); Bots.list.push(b);
    }
  };
  Bots.clear = function () { Bots.list = []; };
  Bots.restart = function () { for (const b of Bots.list) b.bench(U.rand(0.2, 1.5)); };
  /** Host routing: a hit addressed to a bot. */
  Bots.hit = function (msg) { const b = Bots.list.find((x) => x.id === msg.to); if (!b) return false; b.applyHit(msg); return true; };
  Bots.describe = function () {
    const n = Bots.list.length;
    return n ? n + ' ' + SKILL[Bots.skill].label.toLowerCase() + ' bot' + (n === 1 ? '' : 's') : 'practice';
  };
  /** Middle of a team's spawn area (Sniper Valley: where to watch). */
  Bots.centre = function (team) {
    const L = CF.Level, list = L.spawns['t' + team] || L.spawns.ffa || [[0, 0, 0]];
    let x = 0, y = 0, z = 0; for (const s of list) { x += s[0]; y += s[1]; z += s[2]; }
    return [x / list.length, y / list.length, z / list.length];
  };
  /** Can a bot step this way without walking into a wall or off a ledge? */
  Bots.safe = function (pos, dx, dz) {
    if (!W.nav) return true;
    const i = W.cellAt(pos.x + dx * 1.2, pos.z + dz * 1.2);
    return i >= 0 && W.nav.walk[i] && !W.nav.edge[i] && Math.abs(W.nav.hgt[i] - pos.y) < 0.8;
  };
  Bots.pickSpawn = function (bot) {
    const M = MP(), L = CF.Level, list = (M.teamMode() ? L.spawns['t' + bot.team] : L.spawns.ffa) || L.spawns.ffa;
    const en = actors().filter((a) => a.alive && hostile({ id: bot.id, team: bot.team }, a));
    let best = list[0], bs = -Infinity;
    for (const s of list) {
      let md = 60, seen = 0;
      for (const a of en) {
        md = Math.min(md, Math.hypot(a.pos.x - s[0], a.pos.z - s[2]));
        if (M.mode === 'revolver' && W.segmentClear(a.pos.x, a.pos.y + 1.6, a.pos.z, s[0], s[1] + 1.6, s[2])) seen++;
      }
      const score = md + Math.random() * 6 - seen * 25;
      if (score > bs) { bs = score; best = s; }
    }
    return best;
  };
})(window.CF);
