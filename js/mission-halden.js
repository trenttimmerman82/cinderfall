'use strict';
/* Cinderfall — Whiteout: Halden Deep Station. Landfall → Dead Air → Whiteout → Bloom → The Rime Heart → Breakup. */
(function (CF) {
  const U = CF.U, W = CF.World, L = CF.Level, A = CF.Audio, F = CF.Frost;
  const SK = 'Skua', VG = 'Dr. Varga', RM = 'The Rime';
  const MH = () => CF.MapHalden;
  const find = (id) => L.interactables.find((i) => i.id === id);
  CF.Missions = CF.Missions || {};
  const MS = CF.Missions.halden = { id: 'halden', idx: 0, phase: null, t: 0, s: {}, spawner: null, said: {}, st: {} };

  function say(key, lines) {
    if (MS.said[key]) return;
    MS.said[key] = 1;
    for (const l of lines) CF.HUD.radio(l[0], l[1], l[0] === RM);
  }
  const hp = () => CF.Player;

  // Weapons are earned the same way as in the foundry, with Halden's own progression.
  const UNLOCKS = [
    { id: 'shotgun', task: 'Play the station log', who: SK, line: 'Kestrel, there is a KS-12 in the depot lockbox. It is yours now.' },
    { id: 'rail', task: 'Hold the comms mast', who: VG, line: 'The science stores have a VX-3 Lance. You will want the reach out on the field.' },
    { id: 'minigun', task: 'Cross the Styx Field', who: VG, line: 'The rig crew kept a Rotor-6 in the drill shed. It is in your kit now.' },
    { id: 'satchel', task: 'Destroy two blooms', who: VG, line: 'Satchel charges. The blooms shatter under explosives.' },
    { id: 'rocket', task: 'Destroy every bloom', who: VG, line: 'There is a Havoc launcher at the rig. Take it into the Hollow.' }
  ];
  MS.unlocks = UNLOCKS;
  MS.unlock = function (id) {
    const WP = CF.Weapons, u = UNLOCKS.find((x) => x.id === id);
    if (!u || WP.inv[id]) return;
    WP.give(id, true);
    A.play('weaponGet', null, { ui: true });
    CF.HUD.popup('Unlocked · ' + WP.defs[id].name, 0, 'obj');
    CF.HUD.killfeed(WP.defs[id].name + ' unlocked', 'Key ' + (WP.order.indexOf(id) + 1));
    say('unlock-' + id, [[u.who, u.line]]);
  };
  MS.nextUnlock = function () { return UNLOCKS.find((u) => !CF.Weapons.inv[u.id]) || null; };

  // ------------------------------------------------------------ world state helpers
  function setScreen(it, mat) { if (it && it.screen) it.screen.material = L.mats[mat]; }
  function beaconOn(it, on) {
    const b = it.beacon;
    b.lamp.on = on; b.heat.on = on; b.em.on = on; b.bowl.visible = on;
    setScreen(it, on ? 'scrBeaconOn' : 'scrBeacon');
    it.enabled = false; it.done = on;
  }
  /** Put the station into the state that belongs to phase idx (fresh start, retry or debug skip). */
  MS.syncWorld = function (idx, st) {
    const M = MH();
    // log terminal
    const log = find('log'); log.enabled = false; log.progress = 0; setScreen(log, idx >= 1 ? 'scrLogOn' : 'scrLog');
    // fuse cells
    for (const it of M.cells) { const taken = idx >= 2 || (idx === 1 && st.cells.includes(it.id)); it.mesh.visible = !taken; it.lamp.on = !taken; it.enabled = false; }
    const mast = find('mast'); mast.enabled = false; mast.progress = 0; setScreen(mast, idx >= 2 || (idx === 1 && st.mastLive) ? 'scrMastOn' : 'scrMast');
    M.mastLive = idx >= 2 || (idx === 1 && !!st.mastLive); M.mastBeacon.visible = M.mastLive;
    // beacons
    M.beacons.forEach((it, i) => { beaconOn(it, idx >= 3 || (idx === 2 && i < st.lit)); it.progress = 0; });
    // gates
    const ng = L.doors.northGate, hg = L.doors.hollowGate;
    if (idx >= 5) { L.openDoor('northGate', true); } else if (ng.open) L.closeDoor('northGate');
    if (idx === 4 || idx === 5) { if (!hg.open) L.openDoor('hollowGate', true); } else if (hg.open) L.closeDoor('hollowGate');
    for (const l of L.points.hollowAlarms) { l.on = false; l.intensity = 0; }
    // weather
    F.setStorm(idx === 2 ? 1 : idx === 3 ? 0.35 : idx === 5 ? 0.45 : idx === 4 ? 0.15 : 0.05, true);
    F.cold = idx === 2; F.warmth = 100;
    // Skua
    M.skuaSet(idx === 0 && !st.retry ? 'parked' : 'gone');
    CF.HUD.countdown(null, null);
  };

  // ------------------------------------------------------------ phases
  const PH = [
    {
      id: 'landfall', num: 'Part 01', title: 'Landfall',
      cp: () => L.points.cp.start,
      enter(retry) {
        CF.HUD.phaseCard('Part 01', 'Landfall', 'Halden Deep went silent nine days ago. Find out why.');
        if (MS.st.depot) { this.phase.logStage.call(this); return; }
        this.s.group = L.points.depotEnemies.map((d) => CF.Enemies.spawn(d.type, d.x, d.z, { yaw: d.yaw, patrol: d.patrol, tag: 'depot' }));
        this.s.total = this.s.group.length; this.s.stage = 'clear';
        CF.HUD.setObjective('Part 01 · Landfall', 'Secure the supply depot', L.points.depot, 'Depot');
        CF.HUD.setProgress(0, '0 / ' + this.s.total + ' cleared');
        if (!retry) this.later(3.5, () => MH().skuaSet('leave'));
        say('intro', [
          [SK, 'Kestrel, you are on the ice. Halden Deep went quiet nine days ago. No calls, no beacon, nothing.'],
          [SK, 'I cannot sit on this pad in this weather. I am going up. Clear the depot and find out what happened.']
        ]);
      },
      update() {
        const s = this.s;
        if (s.stage === 'clear') {
          const dead = s.group.filter((e) => !e.alive).length, left = s.total - dead;
          CF.HUD.setProgress(dead / s.total, dead + ' / ' + s.total + ' cleared');
          if (dead === 1) say('first', [[SK, 'That was one of the station crew. What is growing out of him?']]);
          if (left > 0 && left <= 2) {
            const P = hp().body.pos; let best = null, bd = Infinity;
            for (const e of s.group) if (e.alive) { const d = e.body.pos.distanceTo(P); if (d < bd) { bd = d; best = e; } }
            if (best) { CF.HUD.objTarget = best.body.pos; CF.HUD.el.wmLabel.textContent = 'Hostile'; }
          }
          if (left === 0) {
            MS.st.depot = true;
            this.phase.logStage.call(this);
            A.play('objective', null, { ui: true }); CF.Game.addScore(250); CF.HUD.popup('Depot secured', 250, 'obj');
            say('depot', [[SK, 'Depot is clear. The duty office is in the orange module on the west side. Start there.']]);
            CF.Game.saveCheckpoint(L.points.cp.depot);
          }
        }
      },
      logStage() {
        this.s.stage = 'log'; find('log').enabled = true;
        CF.HUD.setObjective('Part 01 · Landfall', 'Search the duty office in the west module', L.points.log, 'Duty office');
        CF.HUD.setProgress(null, '');
      }
    },
    {
      id: 'deadair', num: 'Part 02', title: 'Dead Air',
      cp: () => L.points.cp.station,
      enter(retry) {
        const st = MS.st;
        if (st.mastLive) { PH[1].startHold.call(this, true); return; }
        for (const it of MH().cells) if (!st.cells.includes(it.id)) it.enabled = true;
        this.spawner = { t: retry ? 8 : 14, interval: [6, 9], maxAlive: 4, zones: ['station'], pool: ['thrall', 'thrall', 'skitter', 'frostdrone'], remaining: 999 };
        this.cellObjective();
        CF.HUD.phaseCard('Part 02', 'Dead Air', 'Three fuse cells will put the comms mast back on the air.');
        say('deadair', [[SK, 'Three fuse cells. The science module, the generator hall and the vehicle bay should all carry spares.']]);
      },
      update() {
        const s = this.s;
        if (s.stage === 'cells') {
          const P = hp().body.pos; let best = null, bd = Infinity;
          for (const it of MH().cells) if (it.enabled) { const d = it.pos.distanceTo(P); if (d < bd) { bd = d; best = it; } }
          if (best) { CF.HUD.objTarget = best.pos; if (CF.HUD.objLabel !== 'Fuse cell') { CF.HUD.objLabel = 'Fuse cell'; CF.HUD.el.wmLabel.textContent = 'Fuse cell'; } }
        } else if (s.stage === 'hold') {
          const left = s.waveLeft + CF.Enemies.alive((e) => e.tag === 'wave');
          CF.HUD.setProgress(1 - left / s.waveTotal, (s.waveTotal - left) + ' / ' + s.waveTotal + ' repelled');
          if (!s.jugg && s.waveTotal - left >= 6) { s.jugg = true; this.spawnAt('colossus', ['station'], { tag: 'wave' }); say('colossus', [[VG, 'Something big is coming out of the vehicle bay. Hit the glowing shard on its back!']]); }
          if (left <= 0 && s.doneT == null) {
            this.spawner = null; s.doneT = 2.5;
            say('holdDone', [[VG, 'You held it. Listen: a storm is coming off the plateau. The pipeline to Rig 4 runs through the Styx Field.'], [VG, 'Light the heat beacons along the way, or the cold will kill you before they do.']]);
          }
        }
      },
      startHold(retry) {
        const s = this.s; s.stage = 'hold'; s.waveTotal = 12; s.waveLeft = 12; s.jugg = false;
        this.spawner = { t: retry ? 3 : 5, interval: [2.4, 4], maxAlive: 5, zones: ['station'], pool: ['thrall', 'thrall', 'skitter', 'skitter', 'frostdrone'], remaining: 12, tag: 'wave', count: true };
        CF.HUD.setObjective('Part 02 · Dead Air', 'Hold the comms mast', L.points.mast, 'Mast');
        CF.HUD.setProgress(0, '0 / 12 repelled');
      }
    },
    {
      id: 'whiteout', num: 'Part 03', title: 'Whiteout',
      cp: () => L.points.cp.whiteout,
      enter(retry) {
        F.setStorm(1, retry); F.cold = true; F.warmth = 100;
        this.phase.nextBeacon.call(this);
        this.spawner = { t: retry ? 6 : 10, interval: [6, 9.5], maxAlive: 4, zones: ['field'], pool: ['skitter', 'skitter', 'thrall', 'frostdrone'], remaining: 999 };
        CF.HUD.phaseCard('Part 03', 'Whiteout', 'Cross the Styx Field in the storm. Light the heat beacons to stay alive.');
        say('whiteout', [[SK, 'Whiteout on the field. I have lost visual. Follow the pipeline north and keep warm.'], [VG, 'Mind the crevasses. Cross only on the rope bridges.']]);
      },
      nextBeacon() {
        const lit = MS.st.lit, B = MH().beacons;
        if (lit < 3) {
          B[lit].enabled = true;
          CF.HUD.setObjective('Part 03 · Whiteout', 'Light the heat beacons', B[lit].pos, 'Beacon');
          CF.HUD.setProgress(lit / 3, lit + ' / 3 beacons burning');
        } else {
          this.s.stage = 'rig';
          CF.HUD.setObjective('Part 03 · Whiteout', 'Reach Rig 4', L.points.rig, 'Rig 4');
          CF.HUD.setProgress(null, '');
        }
      },
      update() {
        if (this.s.stage === 'rig' && this.s.doneT == null) {
          const P = hp().body.pos;
          if (P.z < -41 && P.x > 20) { this.s.doneT = 1; this.spawner = null; say('rigReached', [[VG, 'You made it. Do not come to drill control, they are right outside the door. Listen to me instead.']]); }
        }
      }
    },
    {
      id: 'bloom', num: 'Part 04', title: 'Bloom',
      cp: () => L.points.cp.rig,
      enter() {
        F.setStorm(0.35); F.cold = false;
        this.s.blooms = L.points.blooms.map((b, i) => {
          const e = CF.Enemies.spawn('bloom', b.x, b.z, { tag: 'bloom', yaw: i });
          e.seedT = U.rand(4, 8);
          return e;
        });
        this.spawner = { t: 12, interval: [8, 12], maxAlive: 3, zones: ['rig'], pool: ['thrall', 'thrall', 'frostdrone'], remaining: 999 };
        CF.HUD.setObjective('Part 04 · Bloom', 'Destroy the crystal blooms', null, 'Bloom');
        CF.HUD.setProgress(0, '0 / 4 destroyed');
        CF.HUD.phaseCard('Part 04', 'Bloom', 'Four blooms feed the heart and breed the crawlers. Shatter them.');
        say('bloom', [[VG, 'Those growths around the rig are blooms. They feed the heart below us and they breed the crawlers. Destroy all four.'], [VG, 'Aim for the glowing core. Explosives work best.']]);
      },
      update(dt) {
        const s = this.s, P = hp().body.pos;
        const alive = s.blooms.filter((b) => b.alive), dead = 4 - alive.length;
        CF.HUD.setProgress(dead / 4, dead + ' / 4 destroyed');
        let best = null, bd = Infinity;
        for (const b of alive) {
          const d = b.body.pos.distanceTo(P); if (d < bd) { bd = d; best = b; }
          b.seedT -= dt;
          if (b.seedT <= 0) {
            b.seedT = U.rand(9, 13) / CF.diff().aggro;
            if (CF.Enemies.alive((e) => !e.T.static) < 7) {
              const a = Math.random() * 6.28, x = b.body.pos.x + Math.cos(a) * 3, z = b.body.pos.z + Math.sin(a) * 3;
              if (!isNaN(W.navHeight(x, z))) CF.Enemies.spawn('skitter', x, z, { aware: true, spawnFx: true });
            }
          }
        }
        if (best) { CF.HUD.objTarget = best.body.pos; }
        if (dead >= 2) this.unlock('satchel');
        if (dead === 2) say('bloom2', [[VG, 'Two down. The rest of it is screaming. Can you hear that?']]);
        if (dead === 3 && !s.jugg) { s.jugg = true; this.spawnAt('colossus', ['rig']); say('bloom3', [[RM, 'YOU ARE WARM. WE WILL BE WARM.']]); }
        if (dead === 4 && s.doneT == null) {
          s.doneT = 2.5; this.spawner = null;
          say('bloomDone', [[VG, 'That is all of them. The heart is exposed in the Hollow, the crater west of the rig.'], [VG, 'If it lives, it climbs the next drill string anyone sinks. Finish it.']]);
        }
      }
    },
    {
      id: 'heart', num: 'Part 05', title: 'The Rime Heart',
      cp: () => L.points.cp.hollow,
      enter(retry) {
        F.setStorm(0.15);
        if (!L.doors.hollowGate.open) L.openDoor('hollowGate', true);
        this.s.stage = 'approach';
        this.spawner = { t: 6, interval: [8, 12], maxAlive: 3, zones: ['flats'], pool: ['thrall', 'skitter'], remaining: 4 };
        CF.HUD.setObjective('Part 05 · The Rime Heart', 'Descend into the Hollow', L.points.hollowIn, 'Hollow');
        CF.HUD.setProgress(null, '');
        CF.HUD.phaseCard('Part 05', 'The Rime Heart', 'Its pylons feed it heat. Break them, then burn out the core.');
        say('heart', [[VG, 'The Hollow is past the flats. Take the ramp down. Once you are in, there is no easy way back out.']]);
      },
      update() {
        const s = this.s, P = hp().body.pos;
        if (s.stage === 'approach' && P.x < -21.5 && P.y < -3) {
          s.stage = 'fight'; this.spawner = null;
          L.closeDoor('hollowGate'); A.play('iceWall', L.doors.hollowGate.mesh.position, { ref: 14 }); hp().shake(0.35);
          CF.FX.iceBits(-20, -4, -60, 14, 6, 0.12);
          for (const e of CF.Enemies.list.slice()) if (e.alive && !e.boss) e.remove();
          const hpnt = L.points.heart;
          s.boss = new CF.HeartBoss(hpnt.x, hpnt.y, hpnt.z);
          CF.Enemies.list.push(s.boss);
          for (const l of L.points.hollowAlarms) { l.on = true; l.intensity = 2; l.pulse = 4; }
          CF.Music.boss = true; CF.Music.sting('boss');
          CF.HUD.setObjective('Part 05 · The Rime Heart', 'Destroy the Rime Heart', s.boss.body.pos, 'Heart');
          say('bossIn', [[RM, 'YOU CAME DOWN TO US.'], [VG, 'The pylons around it are feeding it. Break them first!']]);
        }
        if (s.stage === 'fight' && s.boss) CF.HUD.objTarget = s.boss.body.pos;
      },
      exit() { CF.Music.boss = false; }
    },
    {
      id: 'breakup', num: 'Part 06', title: 'Breakup',
      cp: () => L.points.cp.escape,
      enter(retry) {
        F.setStorm(0.45); F.cold = false;
        if (!L.doors.hollowGate.open) L.openDoor('hollowGate', retry);
        if (!L.doors.northGate.open) L.openDoor('northGate', retry);
        const d = CF.settings.difficulty;
        this.s.time = this.s.total = d === 'recruit' ? 170 : d === 'elite' ? 130 : 150;
        this.s.quakeT = 3; this.s.skua = false;
        MH().skuaSet('gone');
        this.spawner = { t: 4, interval: [3.5, 6], maxAlive: 5, zones: ['escape'], pool: ['skitter', 'skitter', 'thrall', 'frostdrone'], remaining: 999 };
        CF.HUD.setObjective('Part 06 · Breakup', 'Get to the landing zone', L.points.pad, 'Skua');
        CF.HUD.setProgress(null, '');
        CF.HUD.phaseCard('Part 06', 'Breakup', 'The shelf is coming apart. Get back to the landing zone.');
        A.play('quake', null, { vol: 0.8 }); hp().shake(0.6);
        say('breakup', [[VG, 'The shelf is breaking up! The heart was holding the ice together. Run!'], [SK, 'Kestrel, get to the landing zone. The north gate has cracked open. Go through the station.']]);
      },
      update(dt) {
        const s = this.s, P = hp();
        if (s.won) return;
        s.time -= dt;
        CF.HUD.countdown('Ice shelf collapse', s.time);
        // the ice keeps shifting under you
        s.quakeT -= dt;
        if (s.quakeT <= 0) {
          s.quakeT = U.rand(6, 11) * (s.time < 40 ? 0.6 : 1);
          A.play('quake', null, { vol: 0.7 }); P.shake(0.45 + (1 - s.time / s.total) * 0.3);
          for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = U.rand(3, 14); CF.FX.iceBits(P.body.pos.x + Math.cos(a) * r, P.body.pos.y + U.rand(6, 12), P.body.pos.z + Math.sin(a) * r, 3, 2, 0.14); }
          CF.HUD.hint('The ice is breaking up · keep moving', true);
        }
        if (!s.skua && (s.time < 50 || P.body.pos.z > 24)) {
          s.skua = true; MH().skuaSet('arrive');
          say('skuaIn', [[SK, 'I have the doctor aboard. Skua inbound to the landing zone, forty seconds!']]);
        }
        const pad = L.points.pad, onPad = Math.hypot(P.body.pos.x - pad.x, P.body.pos.z - pad.z) < 6.5 && P.body.pos.y < 2;
        const landed = MH().skua.state === 'landed';
        if (onPad && !landed) CF.HUD.hint(s.skua ? 'Hold the pad · Skua is landing' : 'Hold the pad', false);
        if (onPad && landed && P.alive) {
          s.won = true; this.spawner = null; CF.HUD.countdown(null, null);
          say('win', [[SK, 'Got you. Wheels up.'], [VG, 'Thank you. Nothing is coming back up out of that hole.']]);
          CF.Game.victory();
          return;
        }
        if (s.time <= 0 && P.alive) { CF.HUD.countdown(null, null); P.damage(999, null, 'The ice shelf gave way'); }
      },
      exit() { CF.HUD.countdown(null, null); }
    }
  ];
  MS.phases = PH;

  // ------------------------------------------------------------ flow
  MS.start = function () {
    this.said = {}; this.st = { cells: [], mastLive: false, lit: 0, depot: false, retry: false };
    this.syncWorld(0, this.st);
    this.enter(0, false);
  };
  MS.enter = function (i, retry) {
    if (this.phase && this.phase.exit) this.phase.exit.call(this);
    this.idx = i; this.phase = PH[i]; this.t = 0; this.s = {}; this.spawner = null; this.timers = [];
    this.phase.enter.call(this, retry);
  };
  MS.later = function (t, fn) { this.timers.push({ t, fn }); };
  MS.complete = function () {
    this.spawner = null;
    CF.Game.phaseDone(this.idx);
    A.play('objective', null, { ui: true }); CF.Music.sting('objective');
    CF.HUD.popup('Objective complete', 1000, 'obj'); CF.Game.addScore(1000);
    const reward = { landfall: 'shotgun', deadair: 'rail', whiteout: 'minigun', bloom: 'rocket' }[this.phase.id];
    if (reward) this.unlock(reward);
    const next = this.idx + 1;
    if (next >= PH.length) { CF.Game.victory(); return; }
    if (next === 2) this.st.lit = 0;
    this.enter(next, false);
    CF.Game.saveCheckpoint(PH[next].cp());
  };
  MS.update = function (dt) {
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); } }
    if (this.phase.update) this.phase.update.call(this, dt);
    if (this.s.doneT != null) { this.s.doneT -= dt; if (this.s.doneT <= 0) { this.s.doneT = null; this.complete(); return; } }
    this.updateSpawner(dt);
    let I = 0.14;
    const c = CF.Enemies.combatCount;
    if (c > 0) I = Math.min(0.95, 0.42 + c * 0.11);
    if (this.phase.id === 'deadair' && this.s.stage === 'hold') I = Math.max(I, 0.8);
    if (this.phase.id === 'whiteout') I = Math.max(I, 0.3);
    if (this.phase.id === 'heart' && this.s.stage === 'fight') I = 1;
    if (this.phase.id === 'breakup') I = Math.max(I, 0.88);
    CF.Music.setIntensity(I);
  };
  MS.onKill = function () {};
  /** Hold-E / press-E objectives on the map (type 'task'). */
  MS.onTask = function (it) {
    const s = this.s, st = this.st;
    if (it.id === 'log' && this.phase.id === 'landfall') {
      it.enabled = false; setScreen(it, 'scrLogOn'); A.play('breakerOn', it.pos, { ref: 6 });
      CF.HUD.setObjective('Part 01 · Landfall', 'Listen to the log', L.points.log, 'Duty office');
      say('log', [
        [VG, 'Station log forty-one. Ilse Varga. We hit a cavity at three point two kilometres. The core came up… singing. I have no other word for it.'],
        [VG, 'It grows in heat and it grows in sound. Everyone who handled the samples, it is in them now. They still walk. They are not them.'],
        [VG, 'I have sealed myself in drill control at Rig 4. If anyone hears this: the comms mast needs its fuse cells. Please. Get it back on the air.'],
        [SK, 'Varga could still be alive. Get that mast running, Kestrel.']
      ]);
      s.doneT = 15;
    } else if (it.id.startsWith('cell') && this.phase.id === 'deadair') {
      it.enabled = false; it.mesh.visible = false; it.lamp.on = false;
      st.cells.push(it.id);
      A.play('fuseTake', null, { ui: true }); CF.HUD.popup('Fuse cell ' + st.cells.length + ' / 3', 150, 'obj'); CF.Game.addScore(150);
      const n = st.cells.length;
      if (n === 1) say('cell1', [[SK, 'That is one.']]);
      if (n === 2) say('cell2', [[SK, 'Two. One more and that mast lives.']]);
      this.cellObjective();
      if (n < 3) { const P = hp().body.pos; CF.Game.saveCheckpoint({ x: P.x, y: P.y, z: P.z, yaw: hp().yaw }, true); }
    } else if (it.id === 'mast' && this.phase.id === 'deadair') {
      it.enabled = false; setScreen(it, 'scrMastOn'); A.play('breakerOn', it.pos, { ref: 8 });
      MH().mastLive = true; st.mastLive = true;
      CF.Game.saveCheckpoint(L.points.cp.station, true);
      say('mast', [
        [VG, 'Is someone there? This is Ilse Varga, Rig 4. Please tell me that is a real voice.'],
        [SK, 'Doctor, this is Skua. We have someone on the ground.'],
        [RM, 'WE HEAR YOU.'],
        [VG, 'Oh no. The carrier. It hears the broadcast. They are all coming to the mast!']
      ]);
      this.phase.startHold.call(this, false);
    } else if (it.beacon && this.phase.id === 'whiteout') {
      beaconOn(it, true); st.lit++;
      A.play('beaconLight', it.pos, { ref: 8 }); CF.HUD.popup('Heat beacon lit', 250, 'obj'); CF.Game.addScore(250);
      CF.Game.saveCheckpoint(L.points.cp['beacon' + st.lit]);
      if (st.lit === 1) say('b1', [[VG, 'Good, that is the first beacon. Move between them. Do not stop in the open.']]);
      if (st.lit === 2) say('b2', [[SK, 'Second beacon is burning. You are halfway.']]);
      if (st.lit === 3) say('b3', [[VG, 'That is the last one. The rig is due north. I can see your light from here.']]);
      this.phase.nextBeacon.call(this);
    }
  };
  MS.cellObjective = function () {
    const n = this.st.cells.length;
    if (n < 3) {
      this.s.stage = 'cells';
      CF.HUD.setObjective('Part 02 · Dead Air', 'Recover the fuse cells', null, 'Fuse cell');
      CF.HUD.setProgress(n / 3, n + ' / 3 fuse cells');
    } else {
      this.s.stage = 'insert'; find('mast').enabled = true;
      CF.HUD.setObjective('Part 02 · Dead Air', 'Insert the fuse cells at the comms mast', L.points.mast, 'Mast');
      CF.HUD.setProgress(1, '3 / 3 fuse cells');
      say('cell3', [[SK, 'That is all three. Get them into the mast.']]);
    }
  };
  MS.onBossKilled = function () {
    if (this.phase.id !== 'heart') return;
    CF.Game.addScore(Math.round(3000 * CF.diff().score));
    CF.HUD.popup('The Rime Heart destroyed', Math.round(3000 * CF.diff().score), 'obj');
    CF.HUD.killfeed('The Rime Heart destroyed', 'Boss');
    say('heartDead', [[VG, 'It is… quiet. It stopped singing.']]);
    this.s.doneT = 4;
  };

  // ------------------------------------------------------------ spawning (same rules as the foundry)
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
      const score = (hidden ? 30 : 0) - Math.abs(d - 28) * 0.6 + Math.random() * 14;
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
    const alive = CF.Enemies.alive((e) => !e.boss && !e.T.static);
    if (alive >= s.maxAlive || s.remaining <= 0) return;
    const n = Math.min(Math.random() < 0.45 ? 2 : 1, s.maxAlive - alive, s.remaining);
    // No drones: drones are swapped for Thralls so the fight stays the same size
    const pick = () => { const t = U.choice(s.pool); return CF.noDrones() && CF.Enemies.types[t].drone ? 'thrall' : t; };
    for (let i = 0; i < n; i++) {
      this.spawnAt(pick(), s.zones, s.tag ? { tag: s.tag } : null); s.remaining--;
      if (s.count) this.s.waveLeft = s.remaining;
    }
  };

  MS.saveState = function () { return { cells: this.st.cells.slice(), mastLive: this.st.mastLive, lit: this.st.lit, depot: !!this.st.depot }; };
  MS.restore = function (state, idx) {
    this.st = { cells: state.cells.slice(), mastLive: state.mastLive, lit: state.lit, depot: state.depot, retry: true };
    this.syncWorld(idx, this.st);
    this.enter(idx, true);
  };
  /** Debug: jump straight to a phase with the world in the right state. */
  MS.skipTo = function (i) {
    CF.Enemies.clear();
    this.st = { cells: i >= 2 ? ['cell1', 'cell2', 'cell3'] : [], mastLive: i >= 2, lit: i >= 3 ? 3 : 0, depot: i >= 1, retry: true };
    for (const u of UNLOCKS.slice(0, [0, 1, 2, 3, 5, 5][i] || 0)) CF.Weapons.give(u.id, true);
    this.syncWorld(i, this.st);
    this.enter(i, true);
    const cp = PH[i].cp();
    CF.Player.spawn(cp.x, cp.y, cp.z, cp.yaw, { health: 100, armor: CF.Player.armor });
    CF.Game.saveCheckpoint(cp);
  };
  /** Called by the game when a run starts or the level is reset. */
  MS.resetWorld = function () { F.reset(); };

  // ------------------------------------------------------------ campaign registry
  CF.Campaigns = {
    foundry: { id: 'foundry', name: 'Cinder Foundry', short: 'Foundry', map: 'foundry', mission: CF.Missions.foundry, secured: 'Cinder Station secured', music: 'neon' },
    halden: { id: 'halden', name: 'Whiteout', short: 'Whiteout', map: 'halden', mission: MS, secured: 'Halden Deep evacuated', music: 'frost' }
  };
})(window.CF);
