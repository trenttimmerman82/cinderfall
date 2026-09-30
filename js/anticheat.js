'use strict';
/* Cinderfall — multiplayer anticheat (runs on the host).
   Each client owns its own movement and health and reports its own hits (js/mp.js), and everything passes through
   the host. So the host checks what each player sends against what the game allows: damage above a weapon's maximum,
   firing faster than the gun cycles, moving faster than a sprint, teleporting, hitting through walls or from somewhere
   they aren't, snapping onto heads, shrugging off lethal damage, handing out kill credit, flooding the link.
   Every failed check adds to a suspicion score with its reason. Nothing here removes anyone: the host is warned in
   the kill feed and decides from the Players panel in the match menu. The only automatic action is fixing data that
   can't be real: damage is capped at the weapon's maximum, and kill credit for someone who never hit the victim is dropped.
   The host's own game isn't checked (it runs the match), and neither are practice matches or the co-op campaign. */
(function (CF) {
  const U = CF.U, A = CF.Audio;
  const $ = (id) => document.getElementById(id);
  const AC = CF.AC = { players: {}, aim: {}, banned: {}, bannedPub: {}, armed: null, armedT: 0, sig: '' };
  const SUSPECT = 10, LIKELY = 30; // score at which the host is warned, and warned again
  // most damage one hit message can carry for things that aren't hitscan guns (explosions deal it once, falling off)
  const OTHER_MAX = { rocket: 158, satchel: 173, frag: 150, rc: 260, melee: 170, drone: 20 };
  const OTHER_RATE = { rocket: 4, satchel: 4, frag: 4, rc: 4, melee: 2, drone: 9.1 }; // hits per second, before slack
  const EXPLOSIVE = { rocket: 1, satchel: 1, frag: 1, rc: 1, drone: 1 }; // can land after the thrower died, and round corners
  const WINDOW = 3; // seconds of hits the fire-rate check looks at
  const now = () => performance.now() / 1000;
  const num3 = (p) => Array.isArray(p) && p.length === 3 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) && Number.isFinite(+p[2]);

  AC.on = () => { const MP = CF.MP; return MP.active && MP.isHost() && !MP.solo && MP.mode !== 'coop'; };
  function rec(id) {
    return AC.players[id] || (AC.players[id] = {
      score: 0, reasons: {}, alerted: 0, pos: null, posT: 0, alive: false, aliveAt: -99, deadAt: -99, prot: false, drive: false,
      win: null, yaws: [], shots: {}, hits: 0, heads: 0, walls: 0, snaps: 0, taken: [], hitBy: {}, msgs: 0, msgT: 0, deaths: []
    });
  }

  /** Record a failed check. Repeatable reasons add their weight every time; once-only ones (rates) only the first time. */
  function flag(id, key, weight, text, once) {
    const MP = CF.MP, pl = MP.players[id]; if (!pl || id === MP.myId) return;
    const s = rec(id), r = s.reasons[key];
    if (r && once) { r.text = text; AC.sig = ''; return; }
    if (r) { r.n++; r.text = text; } else s.reasons[key] = { n: 1, text };
    s.score += weight; AC.sig = '';
    const level = s.score >= LIKELY ? 2 : s.score >= SUSPECT ? 1 : 0;
    if (level > s.alerted) {
      s.alerted = level;
      CF.HUD.killfeed('⚠ ' + pl.name + (level === 2 ? ' is very likely cheating' : ' may be cheating'), text + ' · review in the menu');
      A.play('hit', null, { ui: true, vol: 0.6 });
    }
  }

  AC.reset = function () { AC.players = {}; AC.aim = {}; AC.banned = {}; AC.bannedPub = {}; AC.armed = null; AC.sig = ''; };
  AC.forget = function (id) { delete AC.players[id]; delete AC.aim[id]; AC.sig = ''; };

  /** The host's view of a player: [x, y, z] feet, alive, shielded. */
  function stateOf(id) {
    const MP = CF.MP;
    if (id === MP.myId) { const b = CF.Player.body.pos; return { pos: [b.x, b.y, b.z], alive: CF.Player.alive, shield: MP.protectedNow() || CF.RC.driving }; }
    const s = AC.players[id]; return s && s.pos ? { pos: s.pos, alive: s.alive, shield: s.prot || s.drive } : null;
  }
  function maxDamage(w) {
    const d = CF.Weapons.defs[w];
    if (CF.MP.mode === 'revolver' && w === 'revolver') return 999;
    if (d && d.dmg > 0) return d.dmg * Math.max(1, d.head) * (d.pvp || 1);
    return OTHER_MAX[w] || 175;
  }
  function perSecond(w) {
    const d = CF.Weapons.defs[w];
    if (d && d.dmg > 0) return d.rpm / 60 * d.pellets * Math.min(d.pierce || 1, 3);
    return OTHER_RATE[w] || 4;
  }
  /** Is there a straight line from the shooter's eye to any part of the victim? Tries standing and crouched eyes. */
  function sightline(from, to) {
    const W = CF.World;
    for (const ey of [1.65, 1.05]) for (const ty of [0.4, 1.1, 1.6]) if (W.segmentClear(from[0], from[1] + ey, from[2], to[0], to[1] + ty, to[2])) return true;
    return false;
  }

  /** Called for every message the host handles. Returns false to drop it (kicked players, malformed data). */
  AC.inspect = function (from, msg, local) {
    if (!AC.on()) return true;
    if (!local && AC.banned[from]) { CF.Net.sendTo(from, { t: 'kicked' }); CF.Net.drop(from); return false; }
    const MP = CF.MP, t = now();
    if (local) { if (msg.t === 'hit' || msg.t === 'rchit') rec(msg.to).hitBy[from] = t; return true; }
    const s = rec(from);
    // flooding: position updates come 20 times a second, a minigun adds 25 hits; far past that is a spammer
    if (t - s.msgT >= 1) { if (s.msgs > 200) flag(from, 'flood', 2, 'Sent ' + s.msgs + ' messages in one second (normal is under 80)'); s.msgs = 0; s.msgT = t; }
    s.msgs++;
    switch (msg.t) {
      case 'hello': {
        if (/^[a-z0-9]{12}$/.test(msg.pub || '') && AC.bannedPub[msg.pub]) { AC.banned[from] = 1; CF.Net.sendTo(from, { t: 'kicked' }); setTimeout(() => CF.Net.drop(from), 300); return false; }
        if (String(msg.name || '').trim().endsWith('!')) setTimeout(() => flag(from, 'callsign', LIKELY, 'Using the built-in aimbot callsign (name ends in "!")', true), 0);
        return true;
      }
      case 'st': return AC.movement(from, s, msg, t);
      case 'hit': return AC.hit(from, s, msg, t);
      case 'rchit': rec(msg.to).hitBy[from] = t; return true;
      case 'died': {
        s.deaths = s.deaths.filter((d) => t - d < 3); s.deaths.push(t);
        if (s.deaths.length > 3) flag(from, 'deaths', 3, 'Reported ' + s.deaths.length + ' deaths in 3 seconds');
        // the victim names their killer: only someone who actually hit them lately can get the credit
        if (msg.killer && msg.killer !== from && MP.mode !== 'zombies') {
          const hit = s.hitBy[msg.killer];
          if (!hit || t - hit > 10) {
            flag(from, 'credit', 5, 'Gave kill credit to ' + ((MP.players[msg.killer] || {}).name || 'a player') + ', who never hit them');
            msg.killer = null; msg.w = 'env'; msg.head = 0;
          }
        }
        s.taken.length = 0; s.alive = false; s.deadAt = t;
        return true;
      }
    }
    return true;
  };

  /** Position updates: speed over one-second stretches, jumps between consecutive updates, and aim history. */
  AC.movement = function (from, s, msg, t) {
    if (!num3(msg.p)) { flag(from, 'malformed', 2, 'Sent a broken position update'); return false; }
    const p = [+msg.p[0], +msg.p[1], +msg.p[2]], alive = !!msg.a, shield = !!msg.s || !!msg.d;
    if (alive && !s.alive) { s.aliveAt = t; s.win = null; s.pos = null; s.taken.length = 0; }
    if (alive && !shield && s.pos && s.alive && t - s.posT < 0.3 && t - s.aliveAt > 0.5) {
      const step = Math.hypot(p[0] - s.pos[0], p[2] - s.pos[2]);
      if (step > 15) flag(from, 'teleport', 4, 'Jumped ' + step.toFixed(0) + ' m between two position updates');
    }
    if (!alive || shield) s.win = null;
    else if (!s.win) s.win = { x: p[0], z: p[2], t };
    else if (t - s.win.t >= 1) {
      const v = Math.hypot(p[0] - s.win.x, p[2] - s.win.z) / (t - s.win.t);
      if (v > 13) flag(from, 'speed', 3, 'Moved at ' + v.toFixed(0) + ' m/s for a second (a sprint is 8, a slide 11)');
      s.win = { x: p[0], z: p[2], t };
    }
    if (Number.isFinite(+msg.y)) { s.yaws.push({ t, y: +msg.y }); if (s.yaws.length > 8) s.yaws.shift(); }
    s.pos = p; s.posT = t; s.alive = alive; s.prot = !!msg.s; s.drive = !!msg.d;
    return true;
  };

  /** A player says they hit someone: check the damage, the fire rate, where they were, and whether they could see them. */
  AC.hit = function (from, s, msg, t) {
    const MP = CF.MP, w = String(msg.w || ''), def = CF.Weapons.defs[w], gun = def && def.dmg > 0;
    const dmg = +msg.dmg;
    if (!Number.isFinite(dmg) || dmg < 0 || !MP.players[msg.to] || msg.to === from) { flag(from, 'malformed', 2, 'Sent a broken hit'); return false; }
    const cap = maxDamage(w) * 1.05 + 0.5;
    let ok = true; // passed the hard checks, so it can count against the victim below
    if (dmg > cap) { ok = false; flag(from, 'damage', 6, 'Claimed ' + Math.round(dmg) + ' damage from ' + (def ? def.short : w || 'nothing') + ' (most is ' + Math.round(cap) + ')'); msg.dmg = Math.floor(cap); }
    if (MP.mode === 'revolver' && gun && w !== 'revolver') flag(from, 'weapon', 8, 'Hit with the ' + def.short + ' in Revolver One-Shot');
    // fire rate, over a few seconds so a burst of delayed messages after lag doesn't count
    const list = s.shots[w] || (s.shots[w] = []);
    while (list.length && t - list[0] > WINDOW) list.shift();
    list.push(t);
    const allowed = perSecond(w) * WINDOW * 1.5 + 4;
    if (list.length > allowed) { ok = false; flag(from, 'rate', 5, list.length + ' ' + (def ? def.short : w) + ' hits in ' + WINDOW + ' s (the gun allows about ' + Math.round(perSecond(w) * WINDOW) + ')'); list.length = 0; }
    // shooting while dead (bullets only: grenades, rockets and drones can land after their owner falls)
    if (gun && !s.alive && s.deadAt > s.aliveAt && t - s.deadAt > 0.5) flag(from, 'dead', 3, 'Hit someone while dead');
    const me = stateOf(from), victim = stateOf(msg.to);
    const shot = num3(msg.from) ? [+msg.from[0], +msg.from[1], +msg.from[2]] : null;
    if (shot && me && s.pos && t - s.aliveAt > 0.5) {
      const off = Math.hypot(shot[0] - me.pos[0], shot[1] - me.pos[1], shot[2] - me.pos[2]);
      if (off > 6) flag(from, 'origin', 2, 'Hit from ' + off.toFixed(0) + ' m away from where they were');
    }
    if (shot && victim && !EXPLOSIVE[w]) {
      const range = Math.hypot(shot[0] - victim.pos[0], shot[1] - victim.pos[1], shot[2] - victim.pos[2]);
      if (w === 'melee' && range > 7) flag(from, 'melee', 5, 'Melee hit from ' + range.toFixed(0) + ' m away');
      else if (gun && range > 420) flag(from, 'range', 5, 'Hit from ' + range.toFixed(0) + ' m, past the end of any bullet');
    }
    if (gun && shot && victim) {
      s.hits++;
      if (msg.head) s.heads++;
      if (!sightline(shot, victim.pos)) s.walls++;
      // a flick of over 70° in one 50 ms update just before a headshot looks like an aimbot snapping on
      if (msg.head) { let big = 0; for (let i = 1; i < s.yaws.length; i++) if (t - s.yaws[i].t < 0.3) big = Math.max(big, Math.abs(U.wrapAngle(s.yaws[i].y - s.yaws[i - 1].y))); if (big > 1.2) s.snaps++; }
      if (s.hits >= 20 && s.walls / s.hits > 0.35) flag(from, 'walls', 12, Math.round(s.walls / s.hits * 100) + '% of hits went through walls', true);
      if (s.hits >= 40 && s.heads / s.hits > 0.75 && w !== 'rail') flag(from, 'heads', 10, Math.round(s.heads / s.hits * 100) + '% headshots over ' + s.hits + ' hits', true);
      if (s.hits >= 20 && s.snaps / s.hits > 0.25) flag(from, 'snap', 12, s.snaps + ' headshots right after an instant snap of the aim', true);
    }
    // the victim's side: a client that ignores hits never dies. Count damage that should have landed on them,
    // but only from shooters who look honest, so a cheater can't frame someone by spraying fake hits at them.
    const vs = msg.to !== MP.myId ? AC.players[msg.to] : null;
    if (ok && s.score < SUSPECT && vs && vs.alive && !vs.prot && !vs.drive && !MP.ended && t - vs.aliveAt > 0.5) {
      const a = MP.players[from], b = MP.players[msg.to], friendly = MP.teamMode() && a && b && a.team === b.team;
      if (!friendly) {
        vs.taken = vs.taken.filter((h) => t - h.t < 5); vs.taken.push({ t, d: Math.min(+msg.dmg, 250) });
        const sum = vs.taken.reduce((n, h) => n + h.d, 0);
        if (sum > 400 && t - vs.taken[0].t > 1.5 && MP.mode !== 'prophunt') { flag(msg.to, 'tank', 6, 'Took ' + Math.round(sum) + ' damage in 5 s without dying (150 is the most anyone has)'); vs.taken.length = 0; }
      }
    }
    rec(msg.to).hitBy[from] = t;
    return true;
  };

  // ------------------------------------------------------------ aim lock (every player runs this, not just the host)
  /* Aim help that pulls smoothly onto heads never snaps, so the flick check above misses it. Instead, every position
     update carries the sender's aim: compare it with where each enemy's head was over the last moment (they see others
     slightly in the past, so the whole recent path counts). An aimbot sits within a fraction of a degree of a moving
     head almost all the time it is tracking one; a person's crosshair wobbles around it. Every browser keeps its own
     tally, so a player who isn't hosting (or a cheating host) is still caught and shown in the Players panel. */
  const LAGS = 26, LAG_STEP = 0.024, LOCK = 0.003, NEAR = 0.17, AIM_MIN = 60; // delays tried (0-0.6 s), "on the head" (~0.17°), "tracking" (~10°), samples before judging
  AC.watching = () => { const MP = CF.MP; return MP.active && !MP.solo && MP.mode !== 'coop' && MP.mode !== 'zombies' && MP.mode !== 'prophunt'; };
  const aimOf = (id) => AC.aim[id] || (AC.aim[id] = { hist: [], off: null, n: new Array(LAGS).fill(0), lock: new Array(LAGS).fill(0), named: false });
  function aimErr(eye, yaw, pitch, q) {
    const dx = q[0] - eye[0], dy = q[1] - eye[1], dz = q[2] - eye[2], flat = Math.hypot(dx, dz);
    return Math.hypot(U.wrapAngle(Math.atan2(-dx, -dz) - yaw), Math.atan2(dy, flat) - pitch);
  }
  /** Where a player's head was at time t (our clock), between their updates; null if we have nothing that old. */
  function headAt(h, t) {
    if (!h.length || t < h[0].t || t > h[h.length - 1].t + 0.05) return null;
    let i = 1; while (i < h.length && h[i].t < t) i++;
    const b = h[Math.min(i, h.length - 1)], p = h[i - 1], f = b.t > p.t ? U.clamp((t - p.t) / (b.t - p.t), 0, 1) : 1;
    if (!p.a || !b.a) return null;
    return [p.x + (b.x - p.x) * f, p.y + (b.y - p.y) * f + 1.59 - (p.c + (b.c - p.c) * f) * 0.6, p.z + (b.z - p.z) * f]; // aim help points just under eye height (js/mp.js autoAim)
  }
  /** A position update from player id (anyone's, our own included, since we're someone's target too). */
  AC.observe = function (id, msg) {
    if (!AC.watching() || !num3(msg.p) || !(+msg.k >= 0)) return;
    const MP = CF.MP, a = aimOf(id), h = a.hist, k = +msg.k, arrive = performance.now();
    // the sender's clock on ours, like Remote.applyState: the smallest (arrival - sent) seen, so network jitter drops out
    const gap = arrive - k; a.off = a.off == null || Math.abs(gap - a.off) > 5000 ? gap : Math.min(gap, a.off + 0.5);
    const t = (k + a.off) / 1000;
    if (h.length && t <= h[h.length - 1].t) { if (h[h.length - 1].t - t > 5) h.length = 0; else return; } // late or out of order (a big jump back: page reloaded)
    h.push({ t, x: +msg.p[0], y: +msg.p[1], z: +msg.p[2], c: msg.c ? 1 : 0, a: !!msg.a });
    while (h.length > 2 && t - h[0].t > LAGS * LAG_STEP + 0.4) h.shift();
    if (id === MP.myId) return;
    const pl = MP.players[id];
    if (!a.named && pl) {
      a.named = true;
      const nm = String(pl.name || '').trim();
      if (nm.endsWith('!')) flag(id, 'callsign', LIKELY, 'Using the built-in aimbot callsign (name ends in "!")', true);
      else if (nm.toLowerCase() === 'scott') flag(id, 'assist', SUSPECT, 'Using the built-in aim-assist callsign "Scott"', true);
    }
    if (!msg.a || msg.s || msg.d || !Number.isFinite(+msg.y) || !Number.isFinite(+msg.x)) return;
    const me = h[h.length - 1], eye = [me.x, me.y + 1.65 - me.c * 0.6, me.z], yaw = +msg.y, pitch = +msg.x;
    // the enemy they're tracking: the one nearest the crosshair
    let tgt = null, tErr = 0.4;
    for (const oid in AC.aim) {
      if (oid === id) continue;
      const o = MP.players[oid]; if (!o || (MP.teamMode() && pl && o.team === pl.team)) continue;
      const th = AC.aim[oid].hist, q = headAt(th, t - 0.15); if (!q) continue;
      const e = aimErr(eye, yaw, pitch, q); if (e < tErr) { tErr = e; tgt = th; }
    }
    if (!tgt) return;
    // the delay between what they see and what we have differs per player but stays steady, so try every delay and keep a
    // tally for each: an aimbot is on the head at its delay nearly every time; a person's aim wobbles off it at all of them
    const errs = new Array(LAGS); let best = Infinity, head0 = null, head1 = null;
    for (let i = 0; i < LAGS; i++) {
      const q = headAt(tgt, t - i * LAG_STEP); errs[i] = q ? aimErr(eye, yaw, pitch, q) : Infinity;
      if (errs[i] < best) best = errs[i];
      if (q) { if (!head0) head0 = q; head1 = q; }
    }
    if (best > NEAR || !head0) return;
    // only a target sweeping across the view counts: anyone can hold still on a head that isn't moving
    const sweep = Math.abs(U.wrapAngle(Math.atan2(-(head0[0] - eye[0]), -(head0[2] - eye[2])) - Math.atan2(-(head1[0] - eye[0]), -(head1[2] - eye[2]))));
    if (sweep < 0.03 || !CF.World.segmentClear(eye[0], eye[1], eye[2], head0[0], head0[1], head0[2])) return;
    for (let i = 0; i < LAGS; i++) if (errs[i] < Infinity) { a.n[i]++; if (errs[i] < LOCK) a.lock[i]++; }
    let r = 0, n = 0;
    for (let i = 0; i < LAGS; i++) if (a.n[i] >= AIM_MIN && a.lock[i] / a.n[i] > r) { r = a.lock[i] / a.n[i]; n = a.n[i]; }
    if (!n) return;
    const text = 'Crosshair locked on moving heads ' + Math.round(r * 100) + '% of the time over ' + n + ' tracking samples';
    if (r > 0.55) flag(id, 'aimlock', SUSPECT, text, true);
    if (r > 0.7 && n >= AIM_MIN * 2) flag(id, 'aimlock2', LIKELY - SUSPECT, 'Aim lock held for ' + n + ' samples, far past what a person manages', true);
  };

  // ------------------------------------------------------------ kicking (host decides; nothing here kicks on its own)
  AC.kick = function (id) {
    const MP = CF.MP, pl = MP.players[id];
    if (!MP.isHost() || MP.solo || id === MP.myId || !pl) return;
    AC.banned[id] = 1; if (pl.pub) AC.bannedPub[pl.pub] = 1; // keeps them out of this room (a new tab gets a new id, but a signed-in profile is remembered)
    CF.Net.sendTo(id, { t: 'kicked' });
    setTimeout(() => CF.Net.drop(id), 300); // give the notice a moment to arrive before cutting the link
    MP.playerLeft(id, true);
    AC.armed = null;
  };

  // ------------------------------------------------------------ Players panel (match menu, host only)
  function status(id) {
    const s = AC.players[id];
    if (!s || !s.score) return { text: 'No problems seen', cls: '' };
    const rs = Object.values(s.reasons).sort((a, b) => b.n - a.n).map((r) => r.text + (r.n > 1 ? ' (×' + r.n + ')' : ''));
    return { text: rs.slice(0, 3).join(' · '), cls: s.score >= LIKELY ? 'likely' : s.score >= SUSPECT ? 'suspect' : 'minor', score: Math.round(s.score) };
  }
  AC.renderPanel = function () {
    const MP = CF.MP, box = $('mpAdmin'), el = $('mpAdminList'); if (!box || !el) return;
    const show = MP.active && !MP.solo, host = MP.isHost();
    box.hidden = !show; if (!show) return;
    const note = box.querySelector('small'); if (note) note.textContent = host ? 'anticheat flags them, only you can kick' : 'anticheat flags them, only the host can kick';
    if (AC.armed && performance.now() > AC.armedT) AC.armed = null;
    const ids = Object.keys(MP.players).filter((id) => id !== MP.myId);
    const rows = ids.map((id) => ({ id, name: MP.players[id].name, st: status(id) }));
    rows.sort((a, b) => (b.st.score || 0) - (a.st.score || 0));
    const sig = JSON.stringify([rows, AC.armed, MP.mode, host]);
    if (sig === AC.sig) return; // rebuilding the buttons under the mouse would eat clicks
    AC.sig = sig; el.textContent = '';
    if (!rows.length) { const d = document.createElement('div'); d.className = 'ac-row ac-empty'; d.textContent = 'Nobody else has joined yet.'; el.appendChild(d); return; }
    for (const r of rows) {
      const d = document.createElement('div'); d.className = 'ac-row ' + r.st.cls;
      const n = document.createElement('b'); n.textContent = r.name;
      const st = document.createElement('span'); st.textContent = (r.st.cls ? (r.st.cls === 'likely' ? '⚠ Very likely cheating · ' : r.st.cls === 'suspect' ? '⚠ Suspicious · ' : '') : '') + r.st.text;
      const k = document.createElement('button'); k.className = 'btn-ghost danger ac-kick'; k.dataset.kick = r.id;
      k.textContent = AC.armed === r.id ? 'Confirm kick' : 'Kick';
      d.append(n, st); if (host) d.append(k); el.appendChild(d);
    }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-kick]'); if (!b) return;
    const id = b.dataset.kick;
    if (AC.armed === id) AC.kick(id); else { AC.armed = id; AC.armedT = performance.now() + 4000; }
    AC.sig = ''; AC.renderPanel();
  });
})(window.CF);
