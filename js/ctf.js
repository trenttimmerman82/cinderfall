'use strict';
/* Cinderfall — Capture the Flag. Voltage vs Ronin, each with a flag at its spawn.
   Touch the enemy flag to take it, bring it home while your own flag is at base to score.
   A carrier who dies drops the flag; a teammate touching a dropped flag sends it home, or it returns on its own.
   Clients report touches; the host decides and broadcasts the flag state. */
(function (CF) {
  const MP = () => CF.MP;
  const HOME = 0, CARRIED = 1, DROPPED = 2;
  const TOUCH = 1.8, RETURN_T = 25;
  const CTF = CF.CTF = { flags: [], meshes: [], bases: [], sendT: 0 };

  CTF.on = () => MP().active && MP().mode === 'ctf';

  function flagModel(team) {
    const T = MP().TEAM[team], g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.8, roughness: 0.3 }));
    pole.position.y = 1.1; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.03), new THREE.MeshStandardMaterial({ color: T.hex, emissive: T.hex, emissiveIntensity: 1.6 }));
    cloth.position.set(0.47, 1.85, 0); g.add(cloth);
    g.userData.cloth = cloth;
    return g;
  }
  function baseModel(team) {
    const T = MP().TEAM[team];
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 32), new THREE.MeshBasicMaterial({ color: T.hex, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    return ring;
  }
  /** Each team's flag stands on the spawn point closest to the middle of its spawn area. */
  function basePos(team) {
    const L = CF.Level, list = L.spawns['t' + team] || L.spawns.ffa || [[0, 0, 0]];
    let cx = 0, cz = 0; for (const s of list) { cx += s[0]; cz += s[2]; } cx /= list.length; cz /= list.length;
    let best = list[0], bd = Infinity;
    for (const s of list) { const d = Math.hypot(s[0] - cx, s[2] - cz); if (d < bd) { bd = d; best = s; } }
    return [best[0], best[1], best[2]];
  }

  CTF.clear = function () {
    for (const m of CTF.meshes.concat(CTF.bases)) if (m.parent) m.parent.remove(m);
    CTF.meshes = []; CTF.bases = []; CTF.flags = [];
  };
  CTF.setup = function () {
    CTF.clear();
    if (!CTF.on()) return;
    for (let t = 0; t < 2; t++) {
      const p = basePos(t);
      CTF.flags.push({ s: HOME, by: null, p: p.slice(), home: p, t: 0 });
      const m = flagModel(t); CF.Game.scene.add(m); CTF.meshes.push(m);
      const b = baseModel(t); b.position.set(p[0], p[1] + 0.03, p[2]); CF.Game.scene.add(b); CTF.bases.push(b);
    }
  };
  CTF.reset = function () { for (const f of CTF.flags) { f.s = HOME; f.by = null; f.p = f.home.slice(); } };

  CTF.snap = () => CTF.flags.map((f) => [f.s, f.by, f.p]);
  CTF.apply = function (msg) {
    if (msg.f) msg.f.forEach((a, i) => { const f = CTF.flags[i]; if (f) { f.s = a[0]; f.by = a[1]; f.p = a[2]; } });
    if (msg.ev) CTF.announce(msg.ev);
  };
  CTF.carrying = () => CTF.flags.findIndex((f) => f.s === CARRIED && f.by === MP().myId);

  CTF.announce = function (ev) {
    const M = MP(), pl = M.players[ev.by], name = pl ? pl.name : 'Someone', T = M.TEAM[ev.f];
    const text = ev.op === 'take' ? name + ' took the ' + T.name + ' flag'
      : ev.op === 'cap' ? name + ' captured the ' + T.name + ' flag'
      : ev.op === 'ret' ? (pl ? name + ' returned the ' : 'The ') + T.name + ' flag' + (pl ? '' : ' returned')
      : name + ' dropped the ' + T.name + ' flag';
    CF.HUD.killfeed(text, 'FLAG');
    if (ev.op === 'cap') {
      CF.Audio.play('kill', null, { ui: true });
      if (ev.by === M.myId) { CF.Game.addScore(500); CF.HUD.popup('Flag captured', 500, ''); }
    } else if (ev.op === 'take' && ev.by === M.myId) CF.HUD.popup('Flag taken', 0, '');
  };

  // ------------------------------------------------------------ host
  function publish(ev) {
    const msg = { t: 'ctf', f: CTF.snap(), ev };
    CF.Net.broadcast(msg); CTF.announce(ev);
  }
  CTF.onHost = function (from, msg) {
    const M = MP(), pl = M.players[from], f = CTF.flags[msg.f];
    if (!pl || !f || M.ended) return;
    const own = msg.f === pl.team;
    if (msg.op === 'take' && !own && f.s !== CARRIED) { f.s = CARRIED; f.by = from; publish({ op: 'take', f: msg.f, by: from }); }
    else if (msg.op === 'ret' && own && f.s === DROPPED) { f.s = HOME; f.by = null; f.p = f.home.slice(); publish({ op: 'ret', f: msg.f, by: from }); }
    else if (msg.op === 'cap' && !own && f.s === CARRIED && f.by === from && CTF.flags[pl.team].s === HOME) {
      f.s = HOME; f.by = null; f.p = f.home.slice();
      M.teamScores[pl.team]++;
      publish({ op: 'cap', f: msg.f, by: from });
      M.checkEnd();
    }
  };
  /** Host: whoever carried a flag and died or left drops it where they fell. */
  CTF.dropFrom = function (id) {
    if (!CTF.on() || !MP().isHost()) return;
    CTF.flags.forEach((f, i) => {
      if (f.s !== CARRIED || f.by !== id) return;
      const r = MP().remotes[id], pos = id === MP().myId ? CF.Player.body.pos : r ? r.body.pos : null;
      f.s = DROPPED; f.t = CF.time; f.by = null;
      if (pos) f.p = [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)];
      publish({ op: 'drop', f: i, by: id });
    });
  };

  // ------------------------------------------------------------ every frame
  const near = (a, b) => Math.hypot(a[0] - b.x, a[2] - b.z) < TOUCH && Math.abs(a[1] - b.y) < 2.2;
  CTF.update = function (dt) {
    if (!CTF.on() || !CTF.flags.length) return;
    const M = MP(), P = CF.Player, me = P.body.pos;
    // host: dropped flags go home after a while
    if (M.isHost() && !M.ended) CTF.flags.forEach((f, i) => { if (f.s === DROPPED && CF.time - f.t > RETURN_T) { f.s = HOME; f.p = f.home.slice(); publish({ op: 'ret', f: i, by: null }); } });
    // local touches, reported to the host
    CTF.sendT -= dt;
    const live = P.alive && CF.Game.state === 'playing' && !M.ended && !CF.RC.driving;
    if (live && CTF.sendT <= 0) {
      const mine = CTF.flags[M.team], theirs = CTF.flags[1 - M.team], carry = CTF.carrying();
      let op = null, fi = 0;
      if (theirs.s !== CARRIED && near(theirs.p, me)) { op = 'take'; fi = 1 - M.team; }
      else if (mine.s === DROPPED && near(mine.p, me)) { op = 'ret'; fi = M.team; }
      else if (carry >= 0 && mine.s === HOME && near(mine.home, me)) { op = 'cap'; fi = carry; }
      if (op) { CTF.sendT = 0.4; M.post({ t: 'ctf', op, f: fi }); }
    }
    if (live && CTF.carrying() >= 0) CF.HUD.hint(CTF.flags[M.team].s === HOME ? 'You have the flag · bring it to your base' : 'You have the flag · your own flag must be home to score');
    // place the models
    CTF.flags.forEach((f, i) => {
      const m = CTF.meshes[i]; if (!m) return;
      m.visible = true;
      if (f.s === CARRIED) {
        const r = M.remotes[f.by], pos = f.by === M.myId ? me : r && r.alive ? r.body.pos : null;
        if (f.by === M.myId) m.visible = false; // don't block our own view
        if (pos) m.position.set(pos.x, pos.y + 0.6, pos.z);
      } else m.position.set(f.p[0], f.p[1], f.p[2]);
      m.rotation.y += dt * (f.s === CARRIED ? 0 : 0.8);
    });
  };

  CTF.hudText = function () {
    const M = MP(), T = M.TEAM, st = (i) => ['home', 'taken', 'dropped'][CTF.flags[i] ? CTF.flags[i].s : 0];
    return {
      mode: 'Capture the Flag · first to ' + M.limit,
      score: T[0].name + ' ' + M.teamScores[0] + ' (' + st(0) + ') · (' + st(1) + ') ' + M.teamScores[1] + ' ' + T[1].name
    };
  };
})(window.CF);
