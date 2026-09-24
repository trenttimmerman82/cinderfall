'use strict';
/* Cinderfall — mission script: The Yard → Restore Power → The Uplink → The Warden → Exfil. */
(function (CF) {
  const U = CF.U, W = CF.World, L = CF.Level, A = CF.Audio;
  const OW = 'Overwatch', WD = 'Warden';
  const find = (id) => L.interactables.find((i) => i.id === id);
  const MS = CF.Mission = { idx: 0, phase: null, t: 0, s: {}, spawner: null, breakersDone: [], said: {} };

  // Weapons are earned: you start with the M7 and P-11, and each objective releases another one.
  const UNLOCKS = [
    { id: 'shotgun', task: 'Clear the yard', line: 'Yard secured. The quartermaster is releasing a KS-12 Breacher to you. It owns the tight spaces ahead.' },
    { id: 'satchel', task: 'Bring the first breaker online', line: 'First breaker is up. Satchel charges are yours: throw them, then detonate when the machines bunch up.' },
    { id: 'rail', task: 'Restore power', line: 'Grid restored. You have earned the VX-3 Lance. Scope in and hold Shift to steady it.' },
    { id: 'minigun', task: 'Reach 50% on the uplink', line: 'Halfway there. The Rotor-6 is in your kit now. Give it a second to spin up.' },
    { id: 'rocket', task: 'Finish the upload', line: 'Upload complete. The Havoc RPG is unlocked. Save a few rockets for the Warden.' }
  ];
  MS.unlocks = UNLOCKS;
  MS.unlock = function (id) {
    const WP = CF.Weapons, u = UNLOCKS.find((x) => x.id === id);
    if (!u || WP.inv[id]) return;
    WP.give(id, true);
    A.play('weaponGet', null, { ui: true });
    CF.HUD.popup('Unlocked · ' + WP.defs[id].name, 0, 'obj');
    CF.HUD.killfeed(WP.defs[id].name + ' unlocked', 'Key ' + (WP.order.indexOf(id) + 1));
    say('unlock-' + id, [[OW, u.line]]);
  };
  /** The next weapon still locked, for the pause screen. */
  MS.nextUnlock = function () { return UNLOCKS.find((u) => !CF.Weapons.inv[u.id]) || null; };

  function setDoors(hall, arena, instant) {
    for (const id of ['hallW', 'hallE']) {
      if (hall) L.openDoor(id, instant);
      else if (L.doors[id].open) L.closeDoor(id);
    }
    if (arena) L.openDoor('arenaGate', instant);
    else if (L.doors.arenaGate.open) L.closeDoor('arenaGate');
  }
  function say(key, lines) {
    if (MS.said[key]) return;
    MS.said[key] = 1;
    for (const l of lines) CF.HUD.radio(l[0], l[1], l[0] === WD);
  }
  function setBreaker(it, on) {
    it.done = on; it.enabled = !on; it.progress = 0;
    it.screen.material = on ? L.mats.screenOn : L.mats.screenOff;
    CF.Game.setLamp(it.lamp, on ? 'green' : 'red');
  }
  function nearestBreaker() {
    const P = CF.Player.body.pos;
    let best = null, bd = Infinity;
    for (const id of ['breakerA', 'breakerB', 'breakerC']) {
      const it = find(id); if (it.done) continue;
      const d = it.pos.distanceTo(P); if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  function alarms(on) {
    for (const l of L.points.arenaAlarms) { l.on = on; l.intensity = on ? 2.2 : 0; l.pulse = 5; }
  }

  const PH = [
    {
      id: 'yard', num: 'Phase 01', title: 'The Yard',
      cp: () => L.points.start,
      enter(retry) {
        setDoors(false, false, true);
        this.s.group = L.points.yardEnemies.map((d) => CF.Enemies.spawn(d.type, d.x, d.z, { yaw: d.yaw, patrol: d.patrol, tag: 'yard' }));
        this.s.total = this.s.group.length;
        CF.HUD.setObjective('Phase 01 · The Yard', 'Destroy the security units in the container yard', L.points.yardCenter, 'Yard');
        CF.HUD.setProgress(0, '0 / ' + this.s.total + ' destroyed');
        CF.HUD.phaseCard('Phase 01', 'The Yard', 'Clear the container yard. Units that have not spotted you take extra damage.');
        say('intro', [
          [OW, 'Cinder Station, oh-three-ten. The Warden AI has sealed the foundry and turned every security unit loose.'],
          [OW, 'Clear the container yard first. Pick your first shot. Units that have not seen you take extra damage.'],
          [OW, 'You go in with the M7 and your sidearm. Every objective you complete releases heavier kit.']
        ]);
      },
      update(dt) {
        const g = this.s.group, dead = g.filter((e) => !e.alive).length, left = this.s.total - dead;
        CF.HUD.setProgress(dead / this.s.total, dead + ' / ' + this.s.total + ' destroyed');
        if (left > 0 && left <= 2) {
          const P = CF.Player.body.pos; let best = null, bd = Infinity;
          for (const e of g) if (e.alive) { const d = e.body.pos.distanceTo(P); if (d < bd) { bd = d; best = e; } }
          if (best) { CF.HUD.objTarget = best.body.pos; CF.HUD.el.wmLabel.textContent = 'Hostile'; }
        }
        if (left === 0 && this.s.doneT == null) this.s.doneT = 1.4;
      }
    },
    {
      id: 'power', num: 'Phase 02', title: 'Restore Power',
      cp: () => L.points.yardCP,
      enter(retry) {
        setDoors(false, false, true);
        for (const id of ['breakerA', 'breakerB', 'breakerC']) setBreaker(find(id), this.breakersDone.includes(id));
        const n = this.breakersDone.length;
        this.spawner = { t: retry ? 7 : 12, interval: [5.5, 8.5], maxAlive: 4 + n, zones: ['yard', 'hall'], pool: n > 0 ? ['sentry', 'sentry', 'stalker', 'hornet'] : ['sentry', 'sentry', 'stalker'], remaining: 999 };
        this.updatePowerObjective();
        CF.HUD.phaseCard('Phase 02', 'Restore Power', 'Three breakers: the generator shed, the pump house, and the foundry control deck.');
        say('power', [[OW, 'Yard is clear. The Warden cut the foundry grid. Three breakers: the generator shed to the east, the pump house to the west, and the control deck inside the hall.']]);
      },
      update() {
        const b = nearestBreaker();
        if (b) { CF.HUD.objTarget = b.pos; if (CF.HUD.objLabel !== b.label) { CF.HUD.objLabel = b.label; CF.HUD.el.wmLabel.textContent = b.label; } }
      }
    },
    {
      id: 'uplink', num: 'Phase 03', title: 'The Uplink',
      cp: () => L.points.uplinkCP,
      enter(retry) {
        setDoors(true, false, retry);
        const it = find('uplink');
        it.enabled = true; it.progress = 0; it.screen.material = L.mats.screenUplink; CF.Game.setLamp(it.lamp, 'red');
        this.s.active = false; this.s.progress = 0; this.s.juggs = [0.25, 0.62]; this.s.half = false;
        this.spawner = { t: 8, interval: [9, 13], maxAlive: 3, zones: ['east'], pool: ['sentry', 'hornet', 'stalker'], remaining: 999 };
        CF.HUD.setObjective('Phase 03 · The Uplink', 'Start the override upload at the uplink terminal', L.points.uplink, 'Uplink');
        CF.HUD.setProgress(null, '');
        CF.HUD.phaseCard('Phase 03', 'The Uplink', 'Start the upload, then stay near the terminal until it finishes.');
        say('uplink', [[OW, 'Grid is live and the side doors are open. Get to the uplink terrace, north-east. Start the upload and stay in range.']]);
      },
      update(dt) {
        const s = this.s;
        if (!s.active) return;
        const P = CF.Player.body.pos, U2 = L.points.uplink;
        const inRange = Math.hypot(P.x - U2.x, P.z - U2.z) < 9 && Math.abs(P.y - U2.y) < 3;
        if (inRange && CF.Player.alive) s.progress = Math.min(1, s.progress + dt / s.dur);
        else CF.HUD.hint('Get back to the uplink · upload paused', true);
        CF.HUD.setProgress(s.progress, (inRange ? 'Uploading · ' : 'Paused · ') + Math.floor(s.progress * 100) + '%');
        if (s.hum) { s.hum.set(inRange ? 0.16 : 0.04); s.hum.pitch(70 + s.progress * 90); }
        if (s.juggs.length && s.progress >= s.juggs[0]) {
          s.juggs.shift();
          this.spawnAt('juggernaut', ['east']);
          say('jugg' + s.juggs.length, [[OW, s.juggs.length ? 'Heavy unit inbound. Get behind it and hit the glowing vent on its back.' : 'Another heavy is coming. Grenades will stagger it.']]);
        }
        if (!s.half && s.progress >= 0.5) { s.half = true; say('half', [[OW, 'Halfway. Keep them off that terminal.']]); this.unlock('minigun'); }
        if (s.progress >= 1) {
          s.active = false; this.spawner = null;
          if (s.hum) { s.hum.stop(); s.hum = null; }
          find('uplink').screen.material = L.mats.screenOn; CF.Game.setLamp(find('uplink').lamp, 'green');
          say('upDone', [[OW, 'Kill signal delivered. The Warden\'s core is exposed in the west arena and the gate is open. End this.']]);
          this.s.doneT = 1.5;
        }
      },
      exit() { if (this.s.hum) { this.s.hum.stop(); this.s.hum = null; } }
    },
    {
      id: 'boss', num: 'Phase 04', title: 'The Warden',
      cp: () => L.points.arenaCP,
      enter(retry) {
        setDoors(true, true, retry);
        alarms(false);
        this.s.stage = 'approach';
        this.spawner = { t: 10, interval: [10, 14], maxAlive: 2, zones: ['west'], pool: ['sentry', 'stalker'], remaining: 4 };
        CF.HUD.setObjective('Phase 04 · The Warden', 'Enter the Warden\'s arena', L.points.arenaGate, 'Arena');
        CF.HUD.setProgress(null, '');
        CF.HUD.phaseCard('Phase 04', 'The Warden', 'Its shoulder cores feed the shielding. Break them, then burn out the core.');
      },
      update() {
        const s = this.s, P = CF.Player.body.pos;
        if (s.stage === 'approach' && P.z < -26.2 && P.x < -35.5 && P.x > -63) {
          s.stage = 'fight'; this.spawner = null;
          L.closeDoor('arenaGate'); A.play('door', L.doors.arenaGate.mesh.position, { ref: 12 }); CF.Player.shake(0.3);
          for (const e of CF.Enemies.list.slice()) if (e.alive && !e.boss) e.remove();
          const bp = L.points.boss;
          s.boss = new CF.Boss(bp.x, bp.y, bp.z);
          CF.Enemies.list.push(s.boss);
          alarms(true);
          CF.Music.boss = true; CF.Music.sting('boss');
          CF.HUD.setObjective('Phase 04 · The Warden', 'Destroy the Warden', s.boss.body.pos, 'Warden');
          say('boss', [[WD, 'Sector 7 will be purged.'], [OW, 'Shoulder cores first. Break both and its chest armour has to open.']]);
        }
        if (s.stage === 'fight' && s.boss) CF.HUD.objTarget = s.boss.body.pos;
      },
      exit() { CF.Music.boss = false; }
    },
    {
      id: 'exfil', num: 'Phase 05', title: 'Exfil',
      cp: () => ({ x: -49, y: 0, z: -28, yaw: 0.69 }),
      enter(retry) {
        setDoors(true, true, true);
        alarms(false);
        this.s.stage = 'reach'; this.s.hold = 20;
        if (!L.points.evacLamp) L.points.evacLamp = L.lamp(-59, 3.2, -40, { color: 0x40ff70, intensity: 2.4, distance: 14, prio: 2, pulse: 4, pool: false });
        L.points.evacLamp.on = true;
        CF.HUD.setObjective('Phase 05 · Exfil', 'Reach the landing pad', L.points.evac, 'Evac');
        CF.HUD.setProgress(null, '');
        CF.HUD.phaseCard('Phase 05', 'Exfil', 'The station is going dark. Hold the landing pad until the evac arrives.');
        say('exfil', [[OW, 'The Warden is offline. Evac is inbound. Get to the landing pad.']]);
      },
      update(dt) {
        const s = this.s, P = CF.Player.body.pos, E = L.points.evac;
        const onPad = Math.hypot(P.x - E.x, P.z - E.z) < 4.5;
        if (s.stage === 'reach' && onPad) {
          s.stage = 'hold';
          this.spawner = { t: 1.5, interval: [2.5, 4.5], maxAlive: 5, zones: ['arena'], pool: ['hornet', 'hornet', 'stalker', 'sentry'], remaining: 14 };
          CF.HUD.setObjective('Phase 05 · Exfil', 'Hold the landing pad', L.points.evac, 'Evac');
          say('hold', [[OW, 'Stragglers are converging on you. Twenty seconds. Hold the pad.']]);
        }
        if (s.stage === 'hold') {
          if (onPad && CF.Player.alive) s.hold -= dt; else CF.HUD.hint('Get back on the landing pad', true);
          CF.HUD.setProgress(1 - s.hold / 20, 'Evac in ' + Math.max(0, Math.ceil(s.hold)) + ' s');
          if (s.hold <= 0) {
            s.stage = 'done'; this.spawner = null;
            say('win', [[OW, 'Wheels up. Good work, operative.']]);
            CF.Game.victory();
          }
        }
      }
    }
  ];
  MS.phases = PH;

  MS.start = function () {
    this.breakersDone = []; this.said = {};
    this.enter(0, false);
  };
  MS.enter = function (i, retry) {
    if (this.phase && this.phase.exit) this.phase.exit.call(this);
    this.idx = i; this.phase = PH[i]; this.t = 0; this.s = {}; this.spawner = null;
    this.phase.enter.call(this, retry);
  };
  MS.complete = function () {
    this.spawner = null;
    A.play('objective', null, { ui: true }); CF.Music.sting('objective');
    CF.HUD.popup('Objective complete', 1000, 'obj'); CF.Game.addScore(1000);
    const reward = { yard: 'shotgun', power: 'rail', uplink: 'rocket' }[this.phase.id];
    if (reward) this.unlock(reward);
    const next = this.idx + 1;
    if (next >= PH.length) { CF.Game.victory(); return; }
    this.enter(next, false);
    CF.Game.saveCheckpoint(PH[next].cp());
  };
  MS.update = function (dt) {
    this.t += dt;
    if (this.phase.update) this.phase.update.call(this, dt);
    if (this.s.doneT != null) { this.s.doneT -= dt; if (this.s.doneT <= 0) { this.s.doneT = null; this.complete(); return; } }
    this.updateSpawner(dt);
    // adaptive score
    let I = 0.14;
    const c = CF.Enemies.combatCount;
    if (c > 0) I = Math.min(0.95, 0.42 + c * 0.11);
    if (this.phase.id === 'uplink' && this.s.active) I = Math.max(I, 0.78);
    if (this.phase.id === 'boss' && this.s.stage === 'fight') I = 1;
    if (this.phase.id === 'exfil' && this.s.stage === 'hold') I = Math.max(I, 0.85);
    CF.Music.setIntensity(I);
  };
  MS.onKill = function () {};
  MS.onBreaker = function (it) {
    if (this.phase.id !== 'power') return;
    this.breakersDone.push(it.id);
    const n = this.breakersDone.length;
    CF.HUD.popup('Breaker online', 250, 'obj'); CF.Game.addScore(250);
    CF.Music.sting('objective');
    if (n === 1) { say('b1', [[OW, 'One breaker online. The Warden knows what you are doing. Expect company.']]); this.unlock('satchel'); }
    if (n === 2) say('b2', [[OW, 'Two down. One left.']]);
    if (this.spawner) { this.spawner.maxAlive = 4 + n; this.spawner.pool = ['sentry', 'sentry', 'stalker', 'hornet', 'hornet']; this.spawner.t = 1.5; }
    this.updatePowerObjective();
    if (n >= 3) {
      this.spawner = null;
      L.openDoor('hallW'); L.openDoor('hallE');
      say('b3', [[OW, 'Grid is live. The hall\'s side doors are opening.']]);
      this.s.doneT = 2.0;
    } else {
      const f = it.face;
      CF.Game.saveCheckpoint({ x: it.pos.x + f[0] * 0.4, y: it.pos.y - 0.9, z: it.pos.z + f[1] * 0.4, yaw: Math.atan2(-f[0], -f[1]) });
    }
  };
  MS.updatePowerObjective = function () {
    const n = this.breakersDone.length, b = nearestBreaker();
    CF.HUD.setObjective('Phase 02 · Restore Power', n >= 3 ? 'Power restored' : 'Restore power at the breakers', b ? b.pos : null, b ? b.label : '');
    CF.HUD.setProgress(n / 3, n + ' / 3 breakers online');
  };
  MS.onUplinkStart = function (it) {
    const s = this.s;
    s.active = true; s.progress = 0; s.dur = 75;
    it.screen.material = L.mats.screenUplinkOn; CF.Game.setLamp(it.lamp, 'amber');
    this.spawner = { t: 2.5, interval: [3.2, 5.5], maxAlive: 6, zones: ['east'], pool: ['sentry', 'sentry', 'stalker', 'hornet', 'hornet'], remaining: 999 };
    s.hum = A.loop('hum', it.pos);
    CF.HUD.setObjective('Phase 03 · The Uplink', 'Defend the uplink while the override uploads', L.points.uplink, 'Uplink');
    say('upStart', [[WD, 'Unauthorized transmission. Deploying countermeasures.'], [OW, 'Here they come. Stay close to the terminal.']]);
  };
  MS.onBossKilled = function () {
    if (this.phase.id !== 'boss') return;
    CF.Game.addScore(Math.round(3000 * CF.diff().score));
    CF.HUD.popup('The Warden destroyed', Math.round(3000 * CF.diff().score), 'obj');
    CF.HUD.killfeed('The Warden destroyed', 'Boss');
    alarms(false);
    this.s.doneT = 3.5;
  };

  MS.spawnAt = function (type, zones, opts) {
    const P = CF.Player, eye = P.eyePos(new THREE.Vector3());
    let best = null, bs = -Infinity;
    const cands = [];
    for (const z of zones) for (const p of (L.spawns[z] || [])) cands.push(p);
    for (const c of cands) {
      const y = W.navHeight(c[0], c[1]); if (isNaN(y)) continue;
      const d = Math.hypot(c[0] - P.body.pos.x, c[1] - P.body.pos.z);
      if (d < 13) continue;
      const hidden = !W.segmentClear(eye.x, eye.y, eye.z, c[0], y + 1.2, c[1]);
      const score = (hidden ? 30 : 0) - Math.abs(d - 30) * 0.6 + Math.random() * 14;
      if (score > bs) { bs = score; best = c; }
    }
    if (!best) best = U.choice(cands);
    if (!best) return null;
    return CF.Enemies.spawn(type, best[0], best[1], Object.assign({ aware: true, spawnFx: true }, opts));
  };
  MS.updateSpawner = function (dt) {
    const s = this.spawner; if (!s) return;
    s.t -= dt;
    if (s.t > 0) return;
    s.t = U.rand(s.interval[0], s.interval[1]);
    const alive = CF.Enemies.alive((e) => !e.boss);
    if (alive >= s.maxAlive || s.remaining <= 0) return;
    const n = Math.min(Math.random() < 0.45 ? 2 : 1, s.maxAlive - alive, s.remaining);
    const pool = CF.noDrones() ? s.pool.filter((t) => t !== 'hornet') : s.pool;
    for (let i = 0; i < n; i++) { this.spawnAt(U.choice(pool), s.zones); s.remaining--; }
  };

  MS.saveState = function () { return { breakers: this.breakersDone.slice() }; };
  MS.restore = function (state, idx) {
    this.breakersDone = state.breakers.slice();
    this.enter(idx, true);
  };
  /** Debug: jump straight to a phase with the world in the right state. */
  MS.skipTo = function (i) {
    CF.Enemies.clear();
    if (i >= 2) this.breakersDone = ['breakerA', 'breakerB', 'breakerC'];
    for (const u of UNLOCKS.slice(0, [0, 1, 3, 5, 5][i] || 0)) CF.Weapons.give(u.id, true);
    for (const id of ['breakerA', 'breakerB', 'breakerC']) setBreaker(find(id), this.breakersDone.includes(id));
    this.enter(i, false);
    const cp = PH[i].cp();
    CF.Player.spawn(cp.x, cp.y, cp.z, cp.yaw, { health: 100, armor: CF.Player.armor });
    CF.Game.saveCheckpoint(cp);
  };
})(window.CF);
