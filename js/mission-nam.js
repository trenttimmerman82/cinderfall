'use strict';
/* Cinderfall — Campaign: GREEN HELL. The Song Lam valley, 1968. Seven missions, a briefing before each.
   I Insertion: Hot LZ → The Trail. II The Hollow Hill: Ap Lo → Tunnel Rat. III The Long Night: Ambush → River Run → Kestrel.
   A five-man long-range patrol, Copperhead, went quiet near the Song Lam. Its last words: "They're under the hill. The
   whole hill is hollow." You're Rook, the new guy in 1st Squad, and you go in after them.
   The enemy here mostly doesn't come to you. It waits in the grass (js/jungle.js has the hiders, spider holes,
   traps, spotting and the set pieces). Each mission is a campaign part; its stages save mid-mission checkpoints. */
(function (CF) {
  const U = CF.U, W = CF.World, L = CF.Level, A = CF.Audio;
  const ST = () => CF.Story, J = () => CF.Jungle, MAP = () => CF.MapJungle;
  const PI = Math.PI;
  const BD = 'Bulldog Six', WL = 'Warlord Two-Two', BN = 'SSgt. Boone', RY = 'Cpl. Reyes', HS = 'PFC Kowalski', SP = 'Spc. Lindqvist', HT = 'Sgt. Hart';
  const MSK = 'Mudskipper', KA = 'Kestrel Actual', SPK = 'Spooky One-Four', RR = 'Ramrod Two-One', GH = 'The Ghost';
  const find = (id) => L.interactables.find((i) => i.id === id);
  const MS = CF.Missions.nam = { id: 'nam', idx: 0, phase: null, t: 0, s: {}, st: {}, spawner: null, said: {}, timers: [] };
  const hp = () => CF.Player;

  function say(key, lines) {
    if (MS.said[key]) return;
    MS.said[key] = 1;
    for (const l of lines) CF.HUD.radio(l[0], l[1], l[0] === GH);
  }
  const pts = (n) => CF.Game.pts(n);
  function award(label, n) { CF.Game.addScore(pts(n)); CF.HUD.popup(label, pts(n), 'obj'); }
  const near = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

  // ---------------------------------------------------------------- kit
  const W0 = (ids) => { const w = {}; for (const id of ids) { const d = CF.Weapons.defs[id]; w[id] = { mag: d.mag, reserve: d.reserve }; } return w; };
  const KIT = [
    { weapons: ['carbine', 'pistol'], grenades: 2 },
    { weapons: ['carbine', 'shotgun', 'pistol'], grenades: 2 },
    { weapons: ['carbine', 'shotgun', 'pistol', 'rocket'], grenades: 3 },
    { weapons: ['pistol', 'shotgun'], grenades: 2, current: 'pistol' },
    { weapons: ['carbine', 'shotgun', 'pistol', 'rocket', 'minigun', 'satchel'], grenades: 3 },
    { weapons: ['carbine', 'shotgun', 'rail', 'pistol', 'rocket', 'minigun', 'satchel'], grenades: 3 },
    { weapons: ['carbine', 'shotgun', 'rail', 'pistol', 'rocket', 'minigun', 'satchel'], grenades: 4 }
  ];
  function giveKit(i) {
    const k = KIT[i];
    CF.Weapons.reset({ weapons: W0(k.weapons), current: k.current || 'carbine', grenades: k.grenades });
  }
  const UNLOCKS = [
    { id: 'shotgun', task: 'Secure the LZ (Hot LZ)' }, { id: 'rocket', task: 'Find Copperhead (The Trail)' },
    { id: 'minigun', task: 'Come out of the tunnels (Tunnel Rat)' }, { id: 'satchel', task: 'Come out of the tunnels (Tunnel Rat)' }, { id: 'rail', task: 'Spring the ambush (Ambush)' }
  ];
  MS.unlocks = UNLOCKS;
  MS.nextUnlock = function () { return UNLOCKS.find((u) => !CF.Weapons.inv[u.id]) || null; };

  // ---------------------------------------------------------------- briefings
  const BRIEF = [
    { act: 'Act I · Insertion', where: 'Song Lam valley · 1968 · 07:10',
      lines: [[BD, 'Two days ago a long-range patrol, Copperhead, five men, stopped answering the radio up the Song Lam.'],
        [BD, 'Last thing they sent: "They\'re under the hill. The whole hill is hollow." Then nothing.'],
        [BN, 'First Squad goes in on Warlord Two-Two. LZ Falcon, elephant grass. Rook, you\'re new, so stay on my hip and keep your eyes open.'],
        [RY, 'Charlie don\'t stand in the open, new guy. Look for the muzzle flash. Look for the birds.']],
      orders: ['Ride in on Warlord 2-2 · fire from the door', 'Secure LZ Falcon', 'Hold your aim on cover to spot hidden enemies'] },
    { act: 'Act I · Insertion', where: 'The trail north of Falcon · 10:30',
      lines: [[BN, 'Copperhead\'s last position is a bomb crater three klicks north. The trail goes right past it, past a stream ford.'],
        [RY, 'I\'m on point. Trails like this get wired. If I say freeze, you freeze.'],
        [BD, 'Sniper reports along the river this week. Somebody they call the Ghost. Keep your heads down.']],
      orders: ['Follow the trail north', 'Watch for tripwires and punji pits · hold E to disarm', 'Find Copperhead\'s last position'] },
    { act: 'Act II · The Hollow Hill', where: 'The hamlet of Ap Lo · 15:20',
      lines: [[BN, 'McCandless drew a map in his notebook. A hamlet called Ap Lo, and an arrow: "headman\'s house. Down."'],
        [SP, 'Bulldog wants every hootch searched. If the hill\'s hollow, the door\'s in that village.'],
        [RY, 'Cooking fires still warm and nobody home. I don\'t like it.']],
      orders: ['Search the hootches', 'Find the way down', 'Watch the paddies and the tree line'] },
    { act: 'Act II · The Hollow Hill', where: 'Under the hill · 16:45',
      lines: [[BN, 'It\'s a tunnel, all right. Too tight for Hoss and too tight for me. Rook, you\'re the smallest.'],
        [BN, 'Forty-five, a flashlight and the Ithaca. Go slow. Feel for wires. If it\'s dark and it\'s breathing, it isn\'t ours.'],
        [SP, 'We\'ll be up top. If you find Copperhead\'s people, bring them out.']],
      orders: ['Find the command room', 'Find Copperhead\'s missing men', 'Get out by the far shaft'] },
    { act: 'Act III · The Long Night', where: 'The infiltration trail, east of Ap Lo · 23:40',
      lines: [[BD, 'Those maps say a whole regiment hits Firebase Kestrel tomorrow night. Tonight its lead battalion crosses the river at the ford south of you.'],
        [BD, 'Kestrel needs the time. Hold them at the ford. Claymores on the trail, wait for it, then hit them hard.'],
        [HS, 'My arm\'s no good, new guy. Take the Pig. Just bring her back.']],
      orders: ['Plant three claymores along the trail', 'Wait for the column · fire the claymores', 'Hold until the boats come'] },
    { act: 'Act III · The Long Night', where: 'The Song Lam, at the ford · 05:50',
      lines: [[MSK, 'Mudskipper to First Squad, we\'re at the ford. Climb aboard, we\'ve got a river to run.'],
        [BD, 'Kestrel\'s three klicks up-river. They know you\'re coming. So does everybody on both banks.'],
        [BN, 'Boone here, on Mudskipper Two behind you. M21\'s in the case, Rook. That bend\'s where the Ghost likes to sit.']],
      orders: ['Ride the PBR up-river', 'Clear the banks and the sampans', 'Reach Firebase Kestrel'] },
    { act: 'Act III · The Long Night', where: 'Firebase Kestrel · 19:10',
      lines: [[KA, 'Kestrel Actual. Your maps were right. They\'re coming tonight, all of them, from three sides.'],
        [KA, 'Wire\'s up, guns are laid, and Spooky\'s on call from midnight. Until then it\'s us.'],
        [BN, 'Pick a bunker, Rook. Watch the wire. And for God\'s sake keep your head down when you hear the whistle.']],
      orders: ['Hold Kestrel through the night', 'Watch the wire for sappers', 'Stay alive until dawn'] }
  ];
  const TITLES = ['Hot LZ', 'The Trail', 'Ap Lo', 'Tunnel Rat', 'Ambush', 'River Run', 'Kestrel'];
  const TIME = ['day', 'day', 'afternoon', 'tunnel', 'night', 'dawn', 'dusk'];
  const num = (i) => 'Mission ' + String(i + 1).padStart(2, '0');
  const tag = () => num(MS.idx) + ' · ' + TITLES[MS.idx];
  function objective(text, target, label) { CF.HUD.setObjective(tag(), text, target || null, label || 'Objective'); CF.HUD.setProgress(null, ''); }

  // ---------------------------------------------------------------- world helpers
  function resetWorld() {
    CF.Enemies.clear();
    ST().clear(); J().reset();
    CF.HUD.countdown(null, null); CF.HUD.bossBar(false);
    for (let i = L.emitters.length - 1; i >= 0; i--) if (L.emitters[i].temp) L.emitters.splice(i, 1);
    for (const it of L.interactables) if (it.type === 'task') { it.enabled = false; it.progress = 0; }
    CF.Enemies.sightMul = 1;
    CF.Streak.off = false; CF.Streak.hud();
    CF.Player.ride = null;
    CF.Game.slow = null; CF.Game.timeScale = 1;
  }
  function spawn(type, x, z, o) { return CF.Enemies.spawn(type, x, z, o || {}); }
  const allDead = (arr) => arr.every((e) => !e.alive || (e.T.vehicle && e.gunnerDead));
  const aliveOf = (arr) => arr.filter((e) => e.alive && !(e.T.vehicle && e.gunnerDead)).length;
  function markNearest(arr, label) {
    const P = hp().body.pos; let best = null, bd = Infinity;
    for (const e of arr) if (e.alive && !(e.T.vehicle && e.gunnerDead)) { const d = e.body.pos.distanceTo(P); if (d < bd) { bd = d; best = e; } }
    if (best) { CF.HUD.objTarget = best.body.pos; if (CF.HUD.objLabel !== label) { CF.HUD.objLabel = label; CF.HUD.el.wmLabel.textContent = label; } }
  }
  /** Concealed riflemen at a list of spots, facing the way you'll come. type per spot: [x, z, type?] */
  function hiders(spots, o) {
    o = o || {};
    return spots.map((s, i) => {
      const t = s[2] || (o.types ? o.types[i % o.types.length] : 'vc');
      const yaw = o.face ? Math.atan2(-(o.face[0] - s[0]), -(o.face[1] - s[1])) : U.rand(0, PI * 2);
      const e = spawn(t, s[0], s[1], { yaw, tag: o.tag || 'hide' });
      e.seed2 = i;
      return J().hide(e, { ambushR: o.ambushR || 24, moves: o.moves, spots: spots.map((q) => [q[0] + U.gauss() * 2, q[1] + U.gauss() * 2]) });
    });
  }
  function progress(arr, word) {
    const n = aliveOf(arr);
    CF.HUD.setProgress(1 - n / arr.length, (arr.length - n) + ' / ' + arr.length + ' ' + (word || 'down'));
    if (n > 0 && n <= 2) markNearest(arr, 'Last contacts');
    return n;
  }
  /** The squad: Boone, Reyes on point, Kowalski with the Pig, Lindqvist with the radio. */
  function squad(x, z, yaw, o) {
    o = o || {};
    const S = ST(), mk = (look, name, seed, slot, dmg, dx, dz) => S.addAlly(look, name, x + dx, z + dz, { seed, slot, shoots: true, yaw, dmg, redTracer: true });
    mk('grunt', BN, 61, 1, 11, 1.5, 2);
    mk('grunt', RY, 64, 0, 11, -1.5, 2.5);
    if (!o.noHoss) mk('gunner60', HS, 63, 2, 9, 1.2, 4);
    mk('rto', SP, 62, 3, 9, -1.2, 4.5);
    J().pointMan = () => RY;
    J().caller = () => U.choice([BN, RY, o.noHoss ? SP : HS]);
  }
  function place(cp) { const P = hp(); P.body.pos.set(cp.x, cp.y || 0, cp.z); P.body.vel.set(0, 0, 0); P.yaw = cp.yaw || 0; P.pitch = 0; ST().resetTrail(); }
  function here() { const P = hp(); return { x: P.body.pos.x, y: P.body.pos.y, z: P.body.pos.z, yaw: P.yaw }; }
  function save(cp) { CF.Game.saveCheckpoint(cp || here()); }
  function unlock(id) {
    const WP = CF.Weapons; if (WP.inv[id]) return;
    WP.give(id, true); A.play('weaponGet', null, { ui: true });
    CF.HUD.popup('Unlocked · ' + WP.defs[id].name, 0, 'obj'); CF.HUD.killfeed(WP.defs[id].name + ' unlocked', 'Key ' + (WP.order.indexOf(id) + 1));
  }
  function smoke(x, z, color) { L.emitters.push({ type: 'colorSmoke', x, y: 0.3, z, rate: 7, color: color || [0.42, 0.18, 0.5], temp: true }); }
  /** The Ghost: a sniper the whole valley talks about. He takes a shot or two and is gone before you find him. */
  function ghost(stand, o) {
    o = o || {};
    if (MS.st.ghost) return null;
    const e = spawn('ghost', stand.x, stand.z, { y: stand.y, yaw: o.yaw || 0, tag: 'ghost' });
    e.becomeAware(hp().body.pos, false); e.concealed = true; e.ghostShots = 0; e.ghostLeave = o.leave;
    e.onDeath = () => { MS.st.ghost = true; award('The Ghost', 1500); say('ghostDead' + MS.idx, [[RY, 'He\'s down. The Ghost is down!'], [BN, 'About damn time.']]); };
    MS.s.ghostE = e;
    return e;
  }
  function ghostTick(dt) {
    const e = MS.s.ghostE; if (!e || !e.alive || !e.ghostLeave) return;
    if (e.lastFired && e.lastFired !== e.lastSeenShot) { e.lastSeenShot = e.lastFired; e.ghostShots++; }
    if (e.ghostShots >= e.ghostLeave || (e.spottedT > 0 && e.hp < e.maxHp) || (MS.s.ghostT = (MS.s.ghostT || 0) + dt) > 40) {
      // gone: back down the tree and away through the canopy
      A.play('rustle', e.body.pos, { ref: 6 }); J().flushBirds(e.body.pos.x, e.body.pos.z, 6);
      e.alive = false; e.remove(); MS.s.ghostE = null;
      say('ghostGone' + MS.idx, [[RY, 'He\'s gone. Down the tree and gone. That was him, the Ghost.']]);
    }
  }

  // ---------------------------------------------------------------- the missions
  const PH = [];
  // ======== 01 HOT LZ
  PH.push({
    id: 'hotlz', num: num(0), title: TITLES[0],
    cp: () => L.points.cp.hotlz,
    enter() {
      const st = MS.st.stage;
      if (st === 'start' || st === 'ride') return this.phase.ride.call(this);
      this.phase.ground.call(this, true);
    },
    ride() {
      const S = ST(), P = hp(), lz = L.points.lz;
      MS.st.stage = 'ride';
      const h = this.s.heli = S.addHeli(-215, 62, 215, -2.35, WL, 'huey');
      h.board(P);
      h.fly([[-175, 50, 182], [-145, 38, 152], [-122, 26, 128], [-108, 16, 110], [-99, 7, 99], [-95, 0.15, 95]], 17, () => this.phase.landed.call(this), { ease: true });
      P.yaw = h.yaw + PI / 2 - 0.25; P.pitch = -0.25;
      objective('Ride in · clear the tree line from the door', lz, 'LZ Falcon');
      smoke(lz.x + 3, lz.z - 2);
      this.s.group = hiders(L.points.hides.lz.slice(0, 6), { face: [lz.x, lz.z], ambushR: 40, tag: 'lz' });
      for (const e of this.s.group) e.becomeAware(P.body.pos, true);
      say('ride', [[WL, 'Warlord Two-Two, two minutes out. Popping smoke at Falcon, I see purple.'], [BN, 'Rook, you got the door. Anything in that tree line with a rifle is fair game.'], [WL, 'Taking fire! Ten o\'clock, in the grass!']]);
      CF.HUD.phaseCard(num(0), TITLES[0], 'LZ Falcon · Song Lam valley · morning');
      this.later(4, () => CF.HUD.hint('Fire from the door · look for muzzle flashes in the grass'));
    },
    landed() {
      const S = ST(), h = this.s.heli, P = hp();
      h.unboard();
      const out = h.seat(new THREE.Vector3()); out.x -= Math.cos(h.yaw) * 1.6; out.z += Math.sin(h.yaw) * 1.6;
      const y = W.navHeight(out.x, out.z);
      P.body.pos.set(out.x, isNaN(y) ? 0 : y, out.z); P.body.vel.set(0, 0, 0);
      say('landed', [[WL, 'Skids down! Go, go, go!'], [BN, 'Off the bird and into the grass! Spread out!']]);
      this.later(3.5, () => { h.fly([[-95, 18, 95], [-130, 45, 140], [-230, 70, 230]], 22, () => { ST().removeHeli(h); this.s.heli = null; }); });
      this.phase.ground.call(this, false);
      save();
    },
    ground(fromSave) {
      const P = hp(), lz = L.points.lz;
      MS.st.stage = 'lz';
      squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      const left = (this.s.group || []).filter((e) => e.alive);
      if (fromSave || !left.length) this.s.group = hiders(L.points.hides.lz.slice(0, 6), { face: [lz.x, lz.z], ambushR: 40, tag: 'lz' }); else this.s.group = left;
      this.s.group = this.s.group.concat(hiders([L.points.hides.lz[6], [-112, 74, 'vcmg']], { face: [lz.x, lz.z], ambushR: 30, tag: 'lz' }));
      for (const s of L.points.spiders.lz) this.s.group.push(J().spider(s[0], s[1], { tag: 'lz', range: 38 }));
      for (const e of this.s.group) if (!e.spider) e.becomeAware(P.body.pos, false);
      objective('Secure LZ Falcon', lz, 'LZ');
      this.later(2.5, () => CF.HUD.hint('Hold ' + CF.Keys.label('aim') + ' on a hidden shooter to spot him · spotted enemies get a red marker'));
      this.later(9, () => CF.HUD.hint('Spider holes: a lid in the ground lifts · shoot him while he\'s up'));
      this.later(16, () => CF.HUD.hint(CF.Keys.label('crouch') + ' in the grass and they lose sight of you'));
    },
    update(dt) {
      const s = this.s;
      if (MS.st.stage === 'lz' && s.group) {
        const n = progress(s.group);
        if (n === 0 && s.doneT == null) {
          s.doneT = 4.5; award('LZ Falcon secure', 300);
          say('lzOk', [[BN, 'LZ is cold! Nice shooting, new guy.'], [RY, 'Spider holes and a machine gun. They knew we were coming.'], [BD, 'Bulldog copies Falcon secure. Move north on the trail. Find Copperhead.']]);
        }
      }
    }
  });
  // ======== 02 THE TRAIL
  PH.push({
    id: 'trail', num: num(1), title: TITLES[1],
    cp: () => L.points.cp.trail,
    enter() {
      const st = MS.st, P = hp();
      squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') { st.stage = 'trail'; st.traps = []; }
      L.points.traps.trail.forEach((t, i) => { if (!st.traps.includes(i)) { const tr = J().trap(t); tr.idx = i; } });
      CF.HUD.phaseCard(num(1), TITLES[1], 'Point man up front · watch your feet');
      if (st.stage === 'trail') {
        objective('Follow the trail north to the stream', { x: -88, y: 0, z: 22 }, 'Ford');
        say('trail', [[RY, 'Single file. Step where I step.']]);
        this.later(5, () => CF.HUD.hint('Booby traps: your point man calls them · hold E to disarm a tripwire'));
      } else if (st.stage === 'ford') this.phase.ford.call(this, true);
      else this.phase.copper.call(this);
    },
    ford(fromSave) {
      MS.st.stage = 'ford';
      const f = L.points.hides.ford;
      this.s.group = hiders([f[0], f[1], [f[2][0], f[2][1], 'vcmg'], f[3], [f[4][0], f[4][1], 'vcrpg'], f[5]], { face: [-88, 24], ambushR: 30, tag: 'ford', moves: 2 });
      this.s.group.push(J().spider(L.points.spiders.ford[0][0], L.points.spiders.ford[0][1], { tag: 'ford' }));
      if (fromSave) for (const e of this.s.group) if (!e.spider) e.becomeAware(hp().body.pos, false);
      objective('Break the ambush at the ford', { x: -88, y: 0, z: 18 }, 'Ford');
    },
    spring() {
      if (this.s.sprung) return; this.s.sprung = true;
      for (const e of this.s.group) if (!e.spider) e.becomeAware(hp().body.pos, false);
      ghost(MAP().stands.stream, { leave: 2 });
      say('ambush', [[RY, 'AMBUSH! Get down, get down!'], [BN, 'Return fire! Machine gun across the stream, eleven o\'clock!']]);
      CF.Music.setIntensity(0.9);
    },
    copper() {
      MS.st.stage = 'copper';
      const c = MAP().copperhead;
      this.s.group = hiders(L.points.hides.copper, { face: [c.x, c.z + 12], ambushR: 20, tag: 'copper', moves: 1 });
      find('copperRadio').enabled = true;
      objective('Find Copperhead\'s last position', { x: c.x, y: 0, z: c.z }, 'Crater');
      say('copper', [[BN, 'Crater\'s up ahead. That\'s where they called in from.']]);
    },
    onTask(it) {
      if (it.id === 'copperRadio' && MS.st.stage === 'copper') {
        it.enabled = false; award('Copperhead found', 500);
        say('radio', [[BN, 'Radio\'s smashed. Rucksack\'s McCandless\'s. Here\'s his notebook.'], [BN, '"Hill is hollow. Entrance in Ap Lo, the headman\'s house. They took Hart and Ochoa alive."'],
          [SP, 'Bulldog, First Squad. Copperhead\'s gear but no Copperhead. Two taken prisoner. We\'re going to Ap Lo.'], [BD, 'Bulldog copies. Go get them.']]);
        this.s.doneT = 6;
      }
    },
    update(dt) {
      const s = this.s, st = MS.st, pp = hp().body.pos;
      ghostTick(dt);
      if (st.stage === 'trail') {
        if (pp.z < 42 && !s.birds) { s.birds = true; J().flushBirds(-84, 12, 12); this.later(1.2, () => say('birds', [[RY, 'Birds just went up. Hold up… something\'s there.']])); }
        if (pp.z < 34) { this.phase.ford.call(this); save({ x: pp.x, y: pp.y, z: pp.z, yaw: hp().yaw }); this.later(2.2, () => this.phase.spring.call(this)); }
      } else if (st.stage === 'ford' && s.group) {
        if (!s.sprung && pp.z < 30) this.phase.spring.call(this);
        const n = progress(s.group);
        if (n === 0 && !s.fordDone) { s.fordDone = true; award('Ambush broken', 400); say('fordOk', [[BN, 'Clear! Anybody hit?'], [HS, 'Just my pride. Who was that in the tree?'], [RY, 'Crater\'s north. Keep moving.']]); this.later(3, () => { this.phase.copper.call(this); save(L.points.cp.copper); }); }
      } else if (st.stage === 'copper' && s.group) progress(s.group);
    }
  });
  // ======== 03 AP LO
  PH.push({
    id: 'aplo', num: num(2), title: TITLES[2],
    cp: () => L.points.cp.village,
    enter() {
      const st = MS.st, P = hp();
      squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') { st.stage = 'search'; st.searched = []; }
      CF.HUD.phaseCard(num(2), TITLES[2], 'A quiet hamlet · too quiet');
      if (st.stage === 'search') this.phase.search.call(this);
      else if (st.stage === 'fight') this.phase.fight.call(this);
      else this.phase.hatch.call(this);
    },
    search() {
      MS.st.stage = 'search';
      for (let i = 1; i <= 3; i++) if (!MS.st.searched.includes(i)) find('search' + i).enabled = true;
      objective('Search the hootches (' + MS.st.searched.length + ' / 3)', null, 'Hootch');
      say('hamlet', [[RY, 'Nobody home. Rice still in the pot.'], [BN, 'Check every hootch. Lindqvist, watch the paddies.']]);
    },
    fight() {
      MS.st.stage = 'fight';
      for (let i = 1; i <= 3; i++) find('search' + i).enabled = false;
      const h = L.points.hides.village, V = L.points.village;
      this.s.group = hiders([h[0], h[1], [h[2][0], h[2][1], 'vcmg'], h[3], [h[4][0], h[4][1], 'vcrpg'], h[5], h[6]], { face: [V.x, V.z], ambushR: 60, tag: 'ap', moves: 2 });
      for (const s of L.points.spiders.village) this.s.group.push(J().spider(s[0], s[1], { tag: 'ap', range: 36 }));
      for (const e of this.s.group) if (!e.spider) e.becomeAware(hp().body.pos, false);
      this.spawner = { t: 14, interval: [7, 11], maxAlive: 10, zones: ['village'], pool: ['vc', 'vc', 'vc', 'vcrpg'], remaining: 6 };
      objective('Fight off the ambush', V, 'Ap Lo');
      J().flushBirds(36, -10, 10);
      say('apAmbush', [[RY, 'There they are! Paddies, three o\'clock, and in the ground!'], [BN, 'Get behind the hootches! Rook, the Thumper\'ll reach the dikes!']]);
    },
    hatch() {
      MS.st.stage = 'hatch';
      find('hatch').enabled = true;
      objective('Search the headman\'s house', { x: MAP().headman.x, y: 0, z: MAP().headman.z }, 'Headman');
    },
    onTask(it) {
      const st = MS.st;
      if (/^search\d$/.test(it.id) && st.stage === 'search') {
        const i = +it.id.slice(6); if (st.searched.includes(i)) return;
        it.enabled = false; st.searched.push(i);
        const found = [['Rice cache', 'Fifty kilos of rice under the floor. Feeding a lot more than a village.'], ['Weapons cache', 'AKs, B-40 rounds, grenades. Grab what ammo you can use.'], ['Medical supplies', 'Bandages, morphine. From a field hospital. Theirs.']][st.searched.length - 1];
        award(found[0], 200); say('found' + i, [[BN, found[1]]]);
        if (found[0] === 'Weapons cache') { CF.Weapons.resupply(); A.play('ammo', null, { ui: true }); }
        objective('Search the hootches (' + st.searched.length + ' / 3)', null, 'Hootch');
        if (st.searched.length >= 2) { save(); this.later(1.5, () => this.phase.fight.call(this)); }
      } else if (it.id === 'hatch' && st.stage === 'hatch') {
        it.enabled = false; award('Tunnel found', 500); A.play('door', it.pos, { ref: 6 });
        say('hatch', [[BN, 'Under the rice bin. A trapdoor, and a shaft going straight down.'], [RY, 'There\'s air coming up. Cool air. It\'s big down there.'], [BN, 'Then that\'s where Copperhead\'s people are.']]);
        this.s.doneT = 5;
      }
    },
    update() {
      const s = this.s, st = MS.st;
      if (st.stage === 'search') CF.HUD.objTarget = (() => { const P = hp().body.pos; let b = null, bd = Infinity; for (let i = 1; i <= 3; i++) { if (st.searched.includes(i)) continue; const it = find('search' + i), d = it.pos.distanceTo(P); if (d < bd) { bd = d; b = it.pos; } } return b; })();
      else if (st.stage === 'fight' && s.group) {
        const n = progress(s.group);
        if (n === 0 && (!this.spawner || this.spawner.remaining <= 0) && CF.Enemies.alive() === 0 && !s.apDone) {
          s.apDone = true; this.spawner = null; award('Ap Lo secure', 500);
          say('apOk', [[BN, 'That\'s the last of them.'], [RY, 'They weren\'t defending the rice. They were defending something in that big house.']]);
          this.later(2.5, () => { this.phase.hatch.call(this); save(); });
        }
      }
    }
  });
  // ======== 04 TUNNEL RAT
  PH.push({
    id: 'tunnel', num: num(3), title: TITLES[3],
    cp: () => L.points.cp.tunnel,
    enter() {
      const st = MS.st;
      J().setTorch(true); CF.Streak.off = true; CF.Streak.hud(); CF.Enemies.sightMul = 0.6; // it's dark: they see your light before they see you
      if (st.stage === 'start') { st.stage = 'tunnel'; st.traps = []; st.intel = false; st.hart = false; }
      if (st.stage !== 'strike') L.points.traps.tunnel.forEach((t, i) => { if (!st.traps.includes(i)) J().trap(t).idx = i; });
      if (st.stage === 'tunnel' || st.stage === 'maproom' || st.stage === 'cell') {
        const R = MAP().rooms;
        this.s.group = [];
        const g = (t, x, z, yaw, o) => { const e = spawn(t, x, z, Object.assign({ yaw, tag: 'tun' }, o || {})); this.s.group.push(e); return e; };
        J().hide(g('tunnel', R.store.x - 1.5, R.store.z + 2, PI / 2), { ambushR: 8, moves: 0 });
        J().hide(g('tunnel', R.barracks.x - 1, R.barracks.z - 2, -PI / 2), { ambushR: 9, moves: 1 });
        g('tunnel', R.junction.x, R.junction.z, 0, { patrol: [[R.junction.x, R.junction.z], [-106, -128], [R.hospital.x, R.hospital.z], [-106, -128]] });
        if (!st.intel) { J().hide(g('tunnel', R.maproom.x - 3, R.maproom.z - 2, -PI / 2), { ambushR: 10, moves: 1 }); J().hide(g('tunnel', R.maproom.x + 3, R.maproom.z + 2, PI / 2), { ambushR: 10, moves: 0 }); g('nva', R.maproom.x - 2, R.maproom.z + 2, PI / 2); }
        if (!st.hart) { J().hide(g('tunnel', R.cell.x + 2, R.cell.z, PI / 2), { ambushR: 9, moves: 0 }); g('tunnel', -120, -135, PI / 2, { patrol: [[-124, -135], [-112, -135]] }); }
        J().hide(g('tunnel', R.hospital.x + 2, R.hospital.z, PI / 2), { ambushR: 7, moves: 0 });
      }
      if (st.stage === 'tunnel') { objective('Find the command room', null, 'Command room'); CF.HUD.phaseCard(num(3), TITLES[3], 'Under the hill · pistol, shotgun, flashlight'); say('tunnel', [[BN, 'Rope\'s on the shaft if you need out. Go slow, Rook.']]); this.later(4, () => CF.HUD.hint('It\'s dark down here · they hear you before they see you · ' + CF.Keys.label('crouch') + ' to move quietly')); }
      else if (st.stage === 'maproom') this.phase.maproom.call(this);
      else if (st.stage === 'cell') this.phase.cell.call(this);
      else if (st.stage === 'exit') this.phase.shaft.call(this);
      else if (st.stage === 'strike') this.phase.strike.call(this);
    },
    maproom() {
      MS.st.stage = 'maproom'; find('mapTable').enabled = !MS.st.intel;
      objective('Take the maps from the command room', { x: -128, y: 0, z: -114 }, 'Maps');
    },
    cell() {
      MS.st.stage = 'cell'; find('hartCage').enabled = !MS.st.hart;
      objective('Find Copperhead\'s missing men', { x: -134, y: 0, z: -134.5 }, 'Prisoner');
      if (!MS.st.hart) { const h = this.s.hart = ST().addAlly('lrrp', HT, -134.5, -134.5, { seed: 71, follow: false, crouch: 0.9, yaw: -PI / 2 }); h.hold = { x: -134.5, y: 0, z: -134.5 }; }
    },
    shaft() {
      MS.st.stage = 'exit'; find('exitShaft').enabled = true;
      if (!this.s.hart) { const P = hp(); this.s.hart = ST().addAlly('lrrp', HT, P.body.pos.x, P.body.pos.z + 1, { seed: 71, slot: 0 }); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw); }
      objective('Get out through the far shaft', { x: -97, y: 0, z: -133 }, 'Shaft');
    },
    strike() {
      MS.st.stage = 'strike';
      J().setTorch(false); MAP().setTime('dusk');
      place({ x: -66, y: 0, z: -84, yaw: 0.6 });
      squad(-66, -84, 0.6); ST().gatherAllies(-66, -84, 0.6);
      ST().addAlly('lrrp', HT, -64, -82, { seed: 71, slot: 4 });
      objective('Get clear of the hill', { x: -48, y: 0, z: -64 }, 'Clear');
      say('out', [[BN, 'There he is! Rook came up out of a hole in the hill, and he brought Hart!'], [HT, 'Eli Hart, Copperhead. Ochoa didn\'t make it. Neither did the rest. Thank you for coming.'],
        [SP, 'Bulldog, First Squad: one Copperhead recovered, and their maps. Their whole plan.'], [BD, 'Outstanding. Ramrod\'s inbound with napalm for that hill. Get clear, now.']]);
      save({ x: -66, y: 0, z: -84, yaw: 0.6 });
    },
    onTask(it) {
      const st = MS.st;
      if (it.id === 'mapTable' && st.stage === 'maproom') {
        it.enabled = false; st.intel = true; award('Attack plans', 800);
        say('maps', [[SP, 'Rook, what have you got?'], ['Rook', 'Maps. Firebase Kestrel, drawn to the sandbag. Arrows from three sides. And a date. Tomorrow.'], [SP, 'Jesus. Get that out of there.']]);
        this.phase.cell.call(this); save();
      } else if (it.id === 'hartCage' && st.stage === 'cell') {
        it.enabled = false; st.hart = true; award('Prisoner freed', 600);
        const h = this.s.hart; if (h) { h.hold = null; h.follow = true; h.crouch = 0; }
        say('hart', [[HT, 'You\'re… you\'re American. God. I\'m Hart. Copperhead.'], [HT, 'They kept me for the questions. There\'s a way out east, a shaft by the hospital. I can walk.']]);
        this.phase.shaft.call(this); save();
      } else if (it.id === 'exitShaft' && st.stage === 'exit') {
        it.enabled = false;
        CF.Post.setState({ fade: 0.05 });
        this.later(0.8, () => { this.phase.strike.call(this); CF.Post.setState({ fade: 1 }); });
      }
    },
    update(dt) {
      const s = this.s, st = MS.st, pp = hp().body.pos;
      if (st.stage === 'tunnel') {
        const r = MAP().rooms.maproom.r;
        if (pp.x > r[0] - 1 && pp.x < r[2] + 1 && pp.z > r[1] - 1 && pp.z < r[3] + 1) { this.phase.maproom.call(this); save(); }
      } else if (st.stage === 'strike' && near(pp, -48, -64, 12) && !s.napalm) {
        s.napalm = true; award('Clear of the hill', 200);
        say('ramrod', [[RR, 'Ramrod Two-One, rolling in. Hope nobody you like is on that hill.']]);
        const line = []; for (let x = -134; x <= -86; x += 6) line.push([x, -118 + Math.sin(x) * 6]);
        this.later(1.5, () => J().napalm(line));
        this.later(5, () => { const l2 = []; for (let x = -130; x <= -90; x += 7) l2.push([x, -104]); J().napalm(l2); });
        this.later(10, () => { say('burn', [[BN, 'Look at it burn.'], [HT, 'They\'ll have moved most of it out already. The regiment\'s not in that hill. It\'s on its way to Kestrel.']]); s.doneT = 6; });
      }
    },
    exit() { J().setTorch(false); CF.Streak.off = false; }
  });
  // ======== 05 AMBUSH
  PH.push({
    id: 'ambush', num: num(4), title: TITLES[4],
    cp: () => L.points.cp.ambush,
    enter() {
      const st = MS.st, P = hp();
      squad(P.body.pos.x, P.body.pos.z, P.yaw, { noHoss: false }); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') { st.stage = 'plant'; st.planted = []; }
      for (const i of st.planted) J().claymore(MAP().claymoreSpots[i][0], MAP().claymoreSpots[i][1], -2.12);
      CF.HUD.phaseCard(num(4), TITLES[4], 'Night · claymores on the trail · wait for it');
      if (st.stage === 'plant') this.phase.plant.call(this);
      else if (st.stage === 'wait') this.phase.wait.call(this);
      else this.phase.hold.call(this);
    },
    plant() {
      MS.st.stage = 'plant';
      MAP().claymoreSpots.forEach((c, i) => { if (!MS.st.planted.includes(i)) find('claymore' + (i + 1)).enabled = true; });
      this.s.timer = 100;
      objective('Plant the claymores along the trail (' + MS.st.planted.length + ' / 3)', null, 'Claymore');
      say('plant', [[BN, 'Three claymores, this side of the trail, facing it. Front toward enemy, like it says on the box.'], [SP, 'Kestrel reports movement on the trail, south of us. Ten minutes, maybe less.']]);
    },
    wait() {
      MS.st.stage = 'wait'; ST().holdFire = true; CF.Enemies.sightMul = 0.28; // night, in the bushes, not moving
      for (let i = 1; i <= 3; i++) find('claymore' + i).enabled = false;
      find('clacker').enabled = true;
      const C = MAP().clacker;
      ST().allies.forEach((a, k) => { a.follow = false; a.hold = { x: C.x - 2 + (k % 2) * 3, y: 0, z: C.z + 2 + Math.floor(k / 2) * 2.5 }; a.crouch = 0.9; a.faceYaw = -2.12; });
      objective('Get to the clacker and wait for the column', { x: C.x, y: 0, z: C.z }, 'Clacker');
      say('wait', [[BN, 'Everybody down. Nobody fires until the claymores go. Rook, you\'ve got the clacker.']]);
      this.later(2, () => CF.HUD.hint(CF.Keys.label('crouch') + ' and stay still in the bushes · they\'ll walk right past'));
      this.later(6, () => this.phase.column.call(this));
    },
    column() {
      if (this.s.col) return;
      const route = MAP().TRAILS.ambush.map((p) => [p[0], p[1]]);
      this.s.col = [];
      for (let i = 0; i < 12; i++) {
        const t = i === 3 || i === 9 ? 'vcmg' : i === 6 ? 'vcrpg' : 'nva';
        const e = spawn(t, 31 + U.gauss() * 0.4, 133 + U.gauss() * 0.4, { yaw: PI * 0.9, tag: 'col' });
        J().march(e, route.slice(1), i * 2.1);
        this.s.col.push(e);
      }
      say('column', [[SP, 'Movement, south. Lots of it.'], [BN, 'Easy… easy. Let them walk into it.']]);
      CF.HUD.hint('Wait until the column is in front of the claymores, then fire (E at the clacker)');
    },
    spring(early) {
      if (this.s.sprung) return; this.s.sprung = true;
      find('clacker').enabled = false; ST().holdFire = false; CF.Enemies.sightMul = 1;
      for (const a of ST().allies) a.crouch = 0.5;
      if (!early && J().claymores.length) {
        J().onClaymores = (kills) => { award('Claymores · ' + kills + ' killed', 100 + kills * 120); };
        J().fireClaymores();
      }
      for (const e of this.s.col || []) if (e.alive) e.becomeAware(hp().body.pos, false);
      for (let i = 0; i < 3; i++) this.later(1 + i * 0.6, () => J().flare(50 + U.gauss() * 10, 82 + U.gauss() * 10));
      say('sprung', early ? [[BN, 'They\'ve made us! Open up!']] : [[BN, 'NOW! Light \'em up!'], [HS, 'Pop the flares!']]);
      MS.st.stage = 'fight'; save();
    },
    hold() {
      MS.st.stage = 'hold'; ST().holdFire = false;
      for (const a of ST().allies) { a.crouch = 0.5; if (!a.hold) { a.follow = false; a.hold = { x: a.body.pos.x, y: 0, z: a.body.pos.z }; } }
      this.s.hold = 70; this.s.flareT = 0;
      this.spawner = { t: 3, interval: [3, 5], maxAlive: 9, zones: ['ambush'], pool: ['nva', 'nva', 'vc', 'vcmg', 'vcrpg'], remaining: 999 };
      objective('Hold the ford until the boats come', { x: 50, y: 0, z: 84 }, 'Hold');
      say('counter', [[SP, 'More of them coming up the trail! Battalion strength!'], [BD, 'Mudskipper\'s on the way to the ford. Hold on, First Squad.']]);
    },
    onTask(it) {
      const st = MS.st;
      if (/^claymore\d$/.test(it.id) && st.stage === 'plant') {
        const i = +it.id.slice(8) - 1; if (st.planted.includes(i)) return;
        it.enabled = false; st.planted.push(i); A.play('charge', it.pos, { ref: 4 });
        J().claymore(MAP().claymoreSpots[i][0], MAP().claymoreSpots[i][1], -2.12);
        award('Claymore set', 100);
        objective('Plant the claymores along the trail (' + st.planted.length + ' / 3)', null, 'Claymore');
        if (st.planted.length === 3) { save(); this.phase.wait.call(this); }
      } else if (it.id === 'clacker' && st.stage === 'wait') {
        if (!this.s.col) { CF.HUD.hint('Nothing in the kill zone yet · wait for the column'); return; }
        this.phase.spring.call(this, false);
      }
    },
    update(dt) {
      const s = this.s, st = MS.st, pp = hp().body.pos;
      if (st.stage === 'plant') {
        s.timer -= dt; CF.HUD.countdown('Column', s.timer);
        let b = null, bd = Infinity; for (let i = 0; i < 3; i++) { if (st.planted.includes(i)) continue; const c = MAP().claymoreSpots[i], d = Math.hypot(c[0] - pp.x, c[1] - pp.z); if (d < bd) { bd = d; b = { x: c[0], y: 0, z: c[1] }; } }
        CF.HUD.objTarget = b;
        if (s.timer <= 0) { CF.HUD.countdown(null, null); save(); this.phase.wait.call(this); }
      } else if (st.stage === 'wait') {
        CF.HUD.countdown(null, null);
        const col = s.col || [];
        const inZone = col.filter((e) => e.alive && Math.hypot(e.body.pos.x - 51, e.body.pos.z - 82) < 11).length;
        if (col.length && inZone >= 5 && !s.toldNow) { s.toldNow = true; CF.HUD.hint('They\'re in the kill zone · FIRE THE CLAYMORES (E)', true); say('now', [[BN, 'Now, Rook. Now!']]); }
        if (col.some((e) => e.alive && (e.state === 'hunt' || e.state === 'combat'))) this.phase.spring.call(this, true);
        if (col.length && col.some((e) => e.alive && Math.hypot(e.body.pos.x - 86, e.body.pos.z - 51) < 4)) this.phase.spring.call(this, true);
        if (CF.Weapons.fireCd > 0 && CF.Weapons.state === 'idle' && col.length && !s.sprung) this.phase.spring.call(this, true); // you fired first
      } else if (st.stage === 'fight') {
        const n = aliveOf(s.col || []); CF.HUD.setProgress(s.col ? 1 - n / s.col.length : 1, s.col ? (s.col.length - n) + ' / ' + s.col.length + ' down' : '');
        if (n <= 2 && n > 0) markNearest(s.col, 'Last contacts');
        if (n === 0 && !s.colDone) { s.colDone = true; award('Column destroyed', 600); unlock('rail'); this.later(2, () => { this.phase.hold.call(this); save(); }); }
      } else if (st.stage === 'hold') {
        s.hold -= dt; CF.HUD.countdown('Mudskipper', s.hold);
        s.flareT -= dt; if (s.flareT <= 0) { s.flareT = U.rand(12, 18); J().flare(pp.x + U.gauss() * 25, pp.z + U.gauss() * 20); }
        if (s.hold <= 0 && s.doneT == null) {
          CF.HUD.countdown(null, null); this.spawner = null; s.doneT = 5;
          for (const e of CF.Enemies.list) if (e.alive) { e.noScore = true; e.state = 'alert'; }
          say('boats', [[MSK, 'Mudskipper, at the ford! Engines running, climb aboard!'], [BN, 'Pull back to the river! Go!']]);
        }
      }
    },
    exit() { CF.HUD.countdown(null, null); ST().holdFire = false; }
  });
  // ======== 06 RIVER RUN
  const RIVER_ROUTE = [[110, 30], [114, 10], [113, -10], [109, -30], [105, -48], [103, -60], [98, -69]];
  PH.push({
    id: 'river', num: num(5), title: TITLES[5],
    cp: () => L.points.cp.river,
    enter() {
      const st = MS.st, P = hp();
      if (st.stage === 'start') st.stage = 'run';
      const b = this.s.boat = J().addBoat(104, 52, 0.15);
      b.board(P); P.yaw = b.yaw + PI / 2; P.pitch = -0.05;
      const b2 = this.s.boat2 = J().addBoat(106, 72, 0.1);
      b.run(RIVER_ROUTE, 4.2, () => this.phase.landed.call(this));
      b2.run([[106, 44]].concat(RIVER_ROUTE.map((p, i) => [p[0] + (i < 6 ? 2 : 6), p[1] + 16])), 4.2);
      this.s.events = [0.1, 0.27, 0.48, 0.66];
      this.s.ev = 0;
      CF.HUD.phaseCard(num(5), TITLES[5], 'The Song Lam · up-river to Kestrel');
      objective('Ride the PBR up-river to Kestrel', MAP().landing, 'Kestrel');
      say('river', [[MSK, 'Hang on to something. Mudskipper\'s fast, but she\'s not armoured.'], [BN, 'Rook, take the rail aft. Shoot anything on the bank that shoots at us.']]);
      this.later(3, () => CF.HUD.hint('You can shoot from the boat · the crew works the bow guns'));
      if (MS.st.ghost) this.s.events[3] = 0.66;
    },
    event(i) {
      const s = this.s, b = s.boat;
      s.group = s.group || [];
      if (i === 0) {
        const bk = MAP().riverBunkers[2]; // east bank bunker
        s.group = s.group.concat(hiders([[bk.x, bk.z, 'vcmg'], [bk.x + 3, bk.z - 4], [bk.x + 2, bk.z + 5]], { face: [114, 32], ambushR: 70, tag: 'r1', moves: 1 }));
        for (const e of s.group) e.becomeAware(hp().body.pos, false);
        say('r1', [[MSK, 'Bunker on the east bank! Two o\'clock!']]);
      } else if (i === 1) {
        b.throttle = 0; s.boat2.throttle = 0;
        s.sampans = [];
        for (const [x, z, r] of [[115, -22, [[114, -5], [113, 6], [116, 18]]], [109, -30, [[110, -12], [110, 4], [111, 14]]]]) {
          const e = spawn('sampan', x, z, { yaw: PI, route: r, tag: 'r2' });
          if (CF.Game.audioOn) { e.engine = A.loop('engine', e.body.pos); if (e.engine) e.engine.set(0.25, 0.3); }
          e.cleanup = () => { if (e.engine) { e.engine.stop(); e.engine = null; } };
          e.onDeath = () => { if (e.engine) { e.engine.stop(); e.engine = null; } A.play('splash', e.body.pos, { ref: 10 }); };
          s.sampans.push(e); s.group.push(e);
        }
        say('r2', [[MSK, 'Sampans! All stop! All stop and engage!'], [BN, 'Kill the gunner in the bow, the boat\'s just wood!']]);
      } else if (i === 2) {
        const bk = MAP().riverBunkers[3]; // west bank
        s.group = s.group.concat(hiders([[bk.x, bk.z, 'vc'], [bk.x - 4, bk.z + 3, 'vcrpg'], [bk.x - 3, bk.z - 5, 'vcrpg'], [bk.x - 6, bk.z, 'vc']], { face: [113, 2], ambushR: 70, tag: 'r3', moves: 2 }));
        for (const e of s.group) if (e.alive) e.becomeAware(hp().body.pos, false);
        say('r3', [[MSK, 'B-40s, west bank! Hard over!'], [BN, 'RPG teams in the bushes, nine o\'clock!']]);
      } else if (i === 3) {
        b.throttle = 0; s.boat2.throttle = 0;
        const stand = MAP().stands.bend;
        const bk = MAP().riverBunkers[4], bw = MAP().riverBunkers[5];
        s.bend = hiders([[bk.x, bk.z, 'vcmg'], [bw.x, bw.z, 'vc'], [bw.x - 3, bw.z + 4, 'vc']], { face: [107, -40], ambushR: 70, tag: 'r4', moves: 1 });
        for (const e of s.bend) e.becomeAware(hp().body.pos, false);
        s.group = s.group.concat(s.bend);
        const g = ghost(stand, { leave: 0 });
        if (g) { s.bend.push(g); say('r4', [[MSK, 'Taking fire from the bend! Both banks!'], [BN, 'Sniper, high in the big tree, one o\'clock! That\'s him! That\'s the Ghost!'], [BN, 'Rook, the M21. Find the glint.']]); this.later(2, () => CF.HUD.hint('Snipers give themselves away: a glint of light from the scope')); }
        else say('r4', [[MSK, 'Taking fire from the bend! Both banks!']]);
      }
    },
    landed() {
      const s = this.s;
      s.boat.unboard();
      place({ x: 94, y: 0.35, z: -70, yaw: -PI / 2 });
      squad(94, -68, -PI / 2); ST().gatherAllies(94, -68, -PI / 2);
      say('landed', [[MSK, 'Kestrel landing. Everybody off. Good luck tonight.'], [KA, 'Kestrel Actual. Welcome to the hill, First Squad. Come on up, we need every rifle.']]);
      objective('Go up to the firebase', L.points.hill, 'Kestrel');
      MS.st.stage = 'landed'; s.doneT = 7;
    },
    update(dt) {
      const s = this.s, b = s.boat;
      if (!b || MS.st.stage !== 'run') return;
      ghostTick(dt);
      if (s.ev < s.events.length && b.t >= s.events[s.ev]) { this.phase.event.call(this, s.ev); s.ev++; }
      // stops: the boats wait while the sampans and the bend are still shooting
      if (b.throttle === 0) {
        const wait = s.ev === 2 ? s.sampans : s.ev === 4 ? s.bend : null;
        s.stopT = (s.stopT || 0) + dt;
        if (!wait || allDead(wait) || s.stopT > 75) {
          b.throttle = 1; s.boat2.throttle = 1; s.stopT = 0;
          if (s.ev === 4 && s.bend && s.bend.some((e) => e.alive && e.type === 'ghost')) { const g = s.bend.find((e) => e.alive && e.type === 'ghost'); g.alive = false; g.remove(); say('ghostGone5', [[RY, 'He\'s gone again. Down the tree and gone.']]); }
          say('go' + s.ev, [[MSK, 'All ahead full!']]);
        }
      }
      if (s.group) { const n = aliveOf(s.group); if (n > 0 && n <= 2) markNearest(s.group, 'Contacts'); }
      // the crew keeps your ammo topped up between fights
      s.resT = (s.resT || 0) + dt; if (s.resT > 25) { s.resT = 0; if (CF.Weapons.resupply()) CF.HUD.popup('Resupplied from the boat', 0, ''); }
    }
  });
  // ======== 07 KESTREL
  PH.push({
    id: 'kestrel', num: num(6), title: TITLES[6],
    cp: () => L.points.cp.firebase,
    enter() {
      const st = MS.st, S = ST(), H = L.points.hill;
      const at = (dx, dz, name, look, seed, dmg) => { const a = S.addAlly(look, name, H.x + dx, H.z + dz, { seed, shoots: true, dmg, redTracer: true }); a.hold = { x: H.x + dx, y: H.y, z: H.z + dz }; a.follow = false; a.crouch = 0.4; return a; };
      // on the berm, between the bunkers
      at(-12, 4.5, BN, 'grunt', 61, 12); at(4.5, 12, RY, 'grunt', 64, 12); at(12, -4.5, HS, 'gunner60', 63, 10); at(-4.5, -12, SP, 'rto', 62, 10);
      at(-9, -8.5, 'Pvt. Delgado', 'grunt', 65, 10); at(9, 8.5, 'Pvt. Okoro', 'grunt', 66, 10);
      J().caller = () => U.choice([BN, RY, HS, SP]);
      if (st.stage === 'start') st.stage = 'prep';
      this.s.total = 250; this.s.time = st.stage === 'prep' ? this.s.total : st.stage === 'wave2' ? 170 : st.stage === 'wave3' ? 90 : this.s.total;
      this.s.wave = st.stage === 'wave2' ? 2 : st.stage === 'wave3' ? 3 : 1;
      CF.HUD.phaseCard(num(6), TITLES[6], 'Firebase Kestrel · hold until dawn');
      if (st.stage === 'prep') {
        objective('Get ready · pick a bunker and watch the wire', H, 'Kestrel');
        this.s.prep = 25;
        say('prep', [[KA, 'All Kestrel stations, this is Actual. Stand to. Here they come.'], [BN, 'Ammo\'s by the TOC, Rook. Fill up while you can.']]);
      } else this.phase.startWave.call(this, this.s.wave);
    },
    startWave(w) {
      const s = this.s; s.wave = w; MS.st.stage = 'wave' + w;
      const zones = [['fbW', 'fbS'], ['fbN', 'fbE', 'fbW'], ['fbN', 'fbS', 'fbW', 'fbE']][w - 1];
      const pools = [['vc', 'vc', 'nva', 'sapper', 'vcrpg'], ['nva', 'nva', 'vcmg', 'sapper', 'vcrpg', 'vc'], ['nva', 'nva', 'sapper', 'sapper', 'vcmg', 'vcrpg']];
      this.spawner = { t: 3, interval: [3.2 - w * 0.5, 5 - w * 0.6], maxAlive: 8 + w * 3, zones, pool: pools[w - 1], remaining: 999 };
      objective('Hold Kestrel', L.points.hill, 'Kestrel');
      if (w === 1) say('w1', [[KA, 'West and south wire! Sappers in the grass!']]);
      if (w === 2) { MAP().setTime('night'); say('w2', [[KA, 'North slope, and the river side! Illumination, fire illumination!'], [BN, 'Mortars! When you hear the whistle, get down!']]); s.mortarT = 6; if (!MS.st.ghost) this.later(10, () => { const g = ghost(MAP().stands.hill, { leave: 0 }); if (g) say('ghostK', [[RY, 'Sniper! West tree line, up high! It\'s the Ghost!']]); }); }
      if (w === 3) say('w3', [[KA, 'Everything they\'ve got. All sides. Hold, Kestrel, hold!'], [SP, 'Spooky One-Four is airborne. Twenty minutes!']]);
      if (w > 1) save(L.points.cp.firebase);
    },
    update(dt) {
      const s = this.s, P = hp(), pp = P.body.pos;
      if (s.doneT != null) return;
      if (MS.st.stage === 'prep') {
        s.prep -= dt; CF.HUD.countdown('Stand to', s.prep);
        if (s.prep <= 0) { CF.HUD.countdown(null, null); this.phase.startWave.call(this, 1); }
        return;
      }
      s.time -= dt;
      CF.HUD.countdown('Dawn', s.time);
      const el = s.total - s.time;
      if (s.wave === 1 && el > 80) this.phase.startWave.call(this, 2);
      else if (s.wave === 2 && el > 160) this.phase.startWave.call(this, 3);
      // night: flares and mortars
      if (s.wave >= 2) {
        s.flareT = (s.flareT || 0) - dt;
        if (s.flareT <= 0) { s.flareT = U.rand(9, 14); const a = Math.random() * PI * 2; J().flare(L.points.hill.x + Math.cos(a) * 22, L.points.hill.z + Math.sin(a) * 22); }
        s.mortarT -= dt;
        if (s.mortarT <= 0 && !s.spooky) {
          s.mortarT = U.rand(10, 16) / CF.diff().aggro;
          const n = s.wave === 3 ? 3 : 2;
          for (let i = 0; i < n; i++) { const a = Math.random() * PI * 2, r = U.rand(CF.diff().label === 'Recruit' ? 7 : 4.5, 13); this.later(i * 0.7, () => J().mortarRound(pp.x + Math.cos(a) * r, pp.z + Math.sin(a) * r)); }
        }
      }
      if (s.wave === 3 && el > 205 && !s.spooky) {
        s.spooky = true;
        const H = L.points.hill;
        J().spooky(H.x, H.z, [[H.x - 26, H.z], [H.x + 26, H.z], [H.x, H.z - 26], [H.x, H.z + 26], [H.x - 20, H.z - 20], [H.x + 20, H.z + 20], [H.x - 20, H.z + 20], [H.x + 20, H.z - 20]], 45);
        say('spooky', [[SPK, 'Spooky One-Four on station. Kestrel, mark your perimeter.'], [KA, 'Spooky, Kestrel. Everything outside the wire is hostile. Hose it.'], [SPK, 'Copy. Stand by for rain.']]);
        this.spawner.maxAlive = 6;
      }
      if (s.time <= 0) {
        CF.HUD.countdown(null, null); this.spawner = null; s.doneT = 9;
        MAP().setTime('dawn');
        for (const e of CF.Enemies.list) if (e.alive) { e.noScore = true; this.later(U.rand(0.2, 3), () => { if (e.alive) { e.hp = 0; e.die({}); } }); }
        award('Kestrel holds', 2000);
        const h = ST().addHeli(-150, 60, -140, 0.9, WL, 'huey');
        h.fly([[0, 40, -110], [50, 18, -96], [68, 7.5, -92], [68, 5.2, -92]], 18, () => say('dustoff', [[WL, 'Warlord Two-Two on your pad, Kestrel. Who needs a lift?']]));
        say('dawn', [[KA, 'All stations, Actual. Check fire. Check fire. It\'s light. They\'re pulling back.'], [BN, 'Sun\'s up, Rook. You made it. We all made it.'], [BD, 'First Squad, Bulldog. You found Copperhead, you found their plans and you held the hill. Come home.']]);
      }
    },
    exit() { CF.HUD.countdown(null, null); }
  });
  MS.phases = PH;

  // ---------------------------------------------------------------- flow
  MS.start = function () {
    this.said = {}; this.st = { v: 1, stage: 'start', traps: [], searched: [], planted: [], intel: false, hart: false, ghost: false };
    this.begin(0, false, true);
  };
  MS.begin = function (i, retry, brief) {
    const G = CF.Game;
    this.idx = i; this.phase = PH[i]; this.busy = false;
    CF.Music.setTheme('swamp'); J().start(); J().flareLamps = null; CF.Weapons.setEra('nam');
    resetWorld(); this.spawner = null; this.timers = []; this.s = {};
    if (!brief) { this.enter(i, retry); return; }
    G.state = 'briefing'; CF.Input.active = false; CF.Input.clearAll(); CF.HUD.show(false); CF.HUD.clearRadio();
    CF.Input.exitLock();
    const b = Object.assign({ num: num(i), title: TITLES[i] }, BRIEF[i]);
    MAP().setTime(TIME[i]); place(PH[i].cp());
    CF.Post.setState({ fade: 0.35 });
    CF.Story.briefing(b).then(() => {
      if (G.state !== 'briefing' || this.idx !== i) return;
      G.state = 'playing'; CF.Input.active = true; CF.Input.clearAll(); CF.HUD.show(true); G.showScreen(null);
      CF.Post.setState({ fade: 1 });
      this.enter(i, retry);
    });
  };
  MS.enter = function (i, retry) {
    if (this.entered && this.phase && this.phase.exit) this.phase.exit.call(this);
    this.idx = i; this.phase = PH[i]; this.t = 0; this.s = {}; this.spawner = null; this.timers = []; this.entered = true;
    CF.Weapons.setEra('nam'); J().start();
    resetWorld();
    MAP().setTime(TIME[i]);
    CF.Music.setTheme('swamp'); CF.Music.setIntensity(0.2);
    if (this.st.stage === 'start') { giveKit(i); place(PH[i].cp()); }
    this.phase.enter.call(this, retry);
  };
  MS.later = function (t, fn) { this.timers.push({ t, fn }); };
  MS.complete = function () {
    const G = CF.Game;
    this.spawner = null;
    G.phaseDone(this.idx);
    A.play('objective', null, { ui: true }); CF.Music.sting('objective');
    CF.HUD.popup(TITLES[this.idx] + ' complete', pts(1000), 'obj'); G.addScore(pts(1000));
    const next = this.idx + 1;
    if (next >= PH.length) { G.victory(); return; }
    const reward = { 0: 'shotgun', 1: 'rocket', 3: 'minigun' }[this.idx];
    if (reward) CF.HUD.killfeed(CF.Weapons.defs[reward].name + ' unlocked', 'Next mission');
    this.busy = true;
    CF.Post.setState({ fade: 0.05 });
    G.later(1.4, () => {
      this.busy = false;
      if (G.state !== 'playing' || CF.Mission !== this) return;
      if (this.phase.exit) this.phase.exit.call(this);
      this.st.stage = 'start'; this.idx = next; this.phase = PH[next];
      CF.Player.ride = null;
      place(PH[next].cp());
      giveKit(next);
      G.saveCheckpoint(PH[next].cp(), true);
      this.entered = false;
      this.begin(next, false, true);
    });
  };
  MS.update = function (dt) {
    if (this.busy) return;
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); } }
    if (this.phase.update) this.phase.update.call(this, dt);
    if (CF.Game.state !== 'playing') return;
    if (this.s.doneT != null) { this.s.doneT -= dt; if (this.s.doneT <= 0) { this.s.doneT = null; this.complete(); return; } }
    this.updateSpawner(dt);
    CF.Story.update(dt); J().update(dt);
    let I = 0.18;
    const c = CF.Enemies.combatCount;
    if (c > 0) I = Math.min(0.95, 0.45 + c * 0.08);
    if (this.phase.id === 'tunnel' && c === 0) I = 0.1;
    if (this.s.hold != null || this.s.time != null) I = Math.max(I, 0.8);
    CF.Music.setIntensity(I);
  };
  MS.preUpdate = function (dt) { CF.Story.preUpdate(dt); J().preUpdate(dt); };
  MS.onKill = function () {};
  MS.onBossKilled = function () {};
  MS.onTask = function (it) {
    if (it.trap) {
      J().onTask(it);
      const key = this.phase.id === 'tunnel' ? 'tunnel' : 'trail';
      if (it.trap.idx != null && !this.st.traps.includes(it.trap.idx) && L.points.traps[key]) this.st.traps.push(it.trap.idx);
      return;
    }
    if (this.phase.onTask) this.phase.onTask.call(this, it);
  };

  // ---------------------------------------------------------------- spawning
  MS.spawnAt = function (type, zones, opts) {
    const P = CF.Player, eye = P.eyePos(new THREE.Vector3());
    let best = null, bs = -Infinity;
    const cands = [];
    for (const z of zones) for (const p of (L.spawns[z] || [])) cands.push(p);
    for (const c of cands) {
      const x = c[0] + U.gauss() * 2, z = c[1] + U.gauss() * 2;
      const y = W.navHeight(x, z); if (isNaN(y)) continue;
      const d = Math.hypot(x - P.body.pos.x, z - P.body.pos.z);
      if (d < 16) continue;
      const hidden = !W.segmentClear(eye.x, eye.y, eye.z, x, y + 1.2, z) || (MAP() && MAP().veil(eye.x, eye.y, eye.z, x, y + 1.2, z) > 1);
      const score = (hidden ? 30 : 0) - Math.abs(d - 34) * 0.5 + Math.random() * 14;
      if (score > bs) { bs = score; best = [x, z]; }
    }
    if (!best) return null;
    const e = CF.Enemies.spawn(type, best[0], best[1], Object.assign({ aware: true }, opts));
    if (type === 'sapper') J().sapper(e);
    return e;
  };
  MS.updateSpawner = function (dt) {
    const s = this.spawner; if (!s) return;
    s.t -= dt; if (s.t > 0) return;
    s.t = U.rand(s.interval[0], s.interval[1]);
    const alive = CF.Enemies.alive((e) => !e.T.vehicle);
    if (alive >= s.maxAlive || s.remaining <= 0) return;
    const n = Math.min(Math.random() < 0.5 ? 2 : 1, s.maxAlive - alive, s.remaining);
    for (let i = 0; i < n; i++) { const e = this.spawnAt(U.choice(s.pool), s.zones); if (e) s.remaining--; }
  };

  // ---------------------------------------------------------------- saves
  const ints = (a, max) => Array.isArray(a) && a.length <= max && a.every((x) => Number.isInteger(x) && x >= 0 && x < 16);
  MS.saveState = function () { const st = this.st; return { v: 1, stage: st.stage, traps: st.traps.slice(), searched: st.searched.slice(), planted: st.planted.slice(), intel: !!st.intel, hart: !!st.hart, ghost: !!st.ghost }; };
  MS.validState = (m) => m && m.v === 1 && typeof m.stage === 'string' && m.stage.length < 24 && ints(m.traps, 8) && ints(m.searched, 3) && ints(m.planted, 3) &&
    typeof m.intel === 'boolean' && typeof m.hart === 'boolean' && typeof m.ghost === 'boolean';
  MS.restore = function (state, idx, fromSave) {
    this.st = { v: 1, stage: state.stage, traps: state.traps.slice(), searched: state.searched.slice(), planted: state.planted.slice(), intel: state.intel, hart: state.hart, ghost: state.ghost };
    this.said = {};
    // moving checkpoints (in the air, on the river) replay the mission from its start
    if (['ride', 'run', 'landed', 'fight'].includes(this.st.stage) && (idx === 0 || idx === 5)) this.st.stage = 'start';
    if (idx === 4 && this.st.stage === 'fight') this.st.stage = 'hold';
    this.entered = false;
    this.begin(idx, true, fromSave && this.st.stage === 'start');
  };
  MS.skipTo = function (i) {
    CF.Enemies.clear();
    this.st = { v: 1, stage: 'start', traps: [], searched: [], planted: [], intel: false, hart: false, ghost: false };
    this.entered = false;
    this.begin(i, false, false);
    CF.Game.saveCheckpoint(PH[i].cp());
  };
  MS.resetWorld = function () { resetWorld(); };
  MS.teardown = function () { if (this.phase && this.phase.exit) this.phase.exit.call(this); resetWorld(); J().stop(); CF.Weapons.setEra(null); this.entered = false; };

  CF.Campaigns.nam = { id: 'nam', name: 'Green Hell', short: 'Green Hell', map: 'jungle', mission: MS, secured: 'Kestrel holds', music: 'swamp', story: true };
})(window.CF);
