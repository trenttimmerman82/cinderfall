'use strict';
/* Cinderfall — Campaign: THE ELEVENTH HOUR. The Saint-Aubin sector, France, 11 November 1918. Six missions.
   At five this morning the armistice was signed: the guns stop at eleven. Nobody told General Hollis-Pryce, cut off in
   Saint-Aubin beyond the German lines, and he has ordered one last attack for half past ten. The telephone lines are cut.
   You're Private Tom Avery, and you're carrying the order that calls it off.
   I The Last Morning: Over the Top → Gas!   II The Long Way Round: Iron Horse → Wings   III Eleven O'Clock: Saint-Aubin → The Eleventh Hour.
   Hiders (Germans popping up over the parapet), spotting and flares come from js/jungle.js; gas, the tank, the
   Bristol and the Fokkers, flamethrowers and the bells from js/ww1.js. */
(function (CF) {
  const U = CF.U, W = CF.World, L = CF.Level, A = CF.Audio;
  const ST = () => CF.Story, J = () => CF.Jungle, F = () => CF.Front, MAP = () => CF.MapWestern;
  const PI = Math.PI;
  const PK = 'Sgt. Pike', CL = 'Pte. Clarke', DY = 'Pte. Doyle', WC = 'Capt. Whitcombe', HR = 'L/Cpl. Harrow', FN = 'Lt. Fanshawe', KT = 'Lt. Kittering', HP = 'Brig. Gen. Hollis-Pryce', AV = 'Avery', GE = 'German voice';
  const find = (id) => L.interactables.find((i) => i.id === id);
  const MS = CF.Missions.ww1 = { id: 'ww1', idx: 0, phase: null, t: 0, s: {}, st: {}, spawner: null, said: {}, timers: [] };
  const hp = () => CF.Player;

  function say(key, lines) { if (MS.said[key]) return; MS.said[key] = 1; for (const l of lines) CF.HUD.radio(l[0], l[1], l[0] === GE); }
  const pts = (n) => CF.Game.pts(n);
  function award(label, n) { CF.Game.addScore(pts(n)); CF.HUD.popup(label, pts(n), 'obj'); }
  const near = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

  // ---------------------------------------------------------------- kit
  const W0 = (ids) => { const w = {}; for (const id of ids) { const d = CF.Weapons.defs[id]; w[id] = { mag: d.mag, reserve: d.reserve }; } return w; };
  const KIT = [
    { weapons: ['carbine', 'pistol'], grenades: 2 },
    { weapons: ['carbine', 'shotgun', 'pistol'], grenades: 3, current: 'shotgun' },
    { weapons: ['carbine', 'shotgun', 'pistol', 'satchel'], grenades: 3 },
    { weapons: ['carbine', 'shotgun', 'pistol', 'satchel'], grenades: 2 },
    { weapons: ['carbine', 'shotgun', 'pistol', 'rocket', 'minigun', 'satchel'], grenades: 3 },
    { weapons: ['carbine', 'shotgun', 'rail', 'pistol', 'rocket', 'minigun', 'satchel'], grenades: 4 }
  ];
  function giveKit(i) { const k = KIT[i]; CF.Weapons.reset({ weapons: W0(k.weapons), current: k.current || 'carbine', grenades: k.grenades }); }
  const UNLOCKS = [
    { id: 'shotgun', task: 'Take the German trench (Over the Top)' }, { id: 'satchel', task: 'Hold the trench (Gas!)' },
    { id: 'minigun', task: 'Reach the Bristol (Iron Horse)' }, { id: 'rocket', task: 'Survive the flight (Wings)' }, { id: 'rail', task: 'Reach Brigade HQ (Saint-Aubin)' }
  ];
  MS.unlocks = UNLOCKS;
  MS.nextUnlock = function () { return UNLOCKS.find((u) => !CF.Weapons.inv[u.id]) || null; };

  // ---------------------------------------------------------------- briefings
  const BRIEF = [
    { act: 'Act I · The Last Morning', where: 'British front line, Saint-Aubin sector · 11 November 1918 · 05:38',
      lines: [[WC, 'Zero hour is five-forty. The barrage lifts, the whistles go, and we take the German front line opposite. Same as always.'],
        [PK, 'Fix bayonets. Avery, you\'re on my left. Keep low, keep moving, and go for the gaps in their wire.'],
        [CL, 'Rumour says they\'re signing a peace somewhere. Rumour says a lot of things, Nobby says.'], [PK, 'Rumour can go over the top first, then.']],
      orders: ['Wait for the whistle', 'Cross no-man\'s-land through the gaps in the wire', 'Take the German front trench'] },
    { act: 'Act I · The Last Morning', where: 'The German front line · 06:50',
      lines: [[WC, 'We\'re in. Now we hold it. Clear their trench east as far as the telephone dugout and see if the line still works.'],
        [PK, 'Trench gun, Avery. Round every traverse, one bay at a time. And keep your mask where you can reach it.']],
      orders: ['Clear the trench to the dugout', 'Try the field telephone', 'Masks on when the rattles sound (' + 'T' + ')'] },
    { act: 'Act II · The Long Way Round', where: 'Behind the German line · 08:10',
      lines: [[HR, 'Signed at five, sir. The guns stop at eleven. But Brigade at Saint-Aubin don\'t know, and the General\'s going at half past ten.'],
        [WC, 'Then somebody has to tell him. Avery, you\'re a runner now. Fat Annie\'s going up the road to Saint-Aubin. Go with her.'],
        [FN, 'Fanshawe, commanding the Annie. Stay close, keep your head down, and if you see a field gun, for God\'s sake tell me.']],
      orders: ['Stay with Fat Annie', 'Clear the second German line', 'Deal with the field gun'] },
    { act: 'Act II · The Long Way Round', where: 'A meadow off the Saint-Aubin road · 09:20',
      lines: [[KT, 'Kittering, RAF. Engine trouble put me down here, and the Hun shot my observer this morning. You\'ve got a message for Saint-Aubin?'],
        [KT, 'Then climb in the back. The Lewis is on the ring. The road\'s full of Germans, so we\'re going the long way: up.'],
        [AV, 'I\'ve never been in an aeroplane.'], [KT, 'Nor had my last observer, at first. Hold on.']],
      orders: ['Climb into the Bristol', 'Man the Lewis gun', 'Keep the Fokkers off us'] },
    { act: 'Act III · Eleven O\'Clock', where: 'The outskirts of Saint-Aubin · 10:05',
      lines: [[KT, 'Well, that was a landing. Chateau\'s the far side of the square, that\'s Brigade. Half the village is still German.'],
        [KT, 'I\'ve a pistol and no bullets. You lead.']],
      orders: ['Fight through the village', 'Reach the chateau', 'Deliver the order'] },
    { act: 'Act III · Eleven O\'Clock', where: 'Saint-Aubin · 10:31',
      lines: [[HP, 'Cease? At eleven? Then we\'ve half an hour to do it properly.'], [WC, '...'], [HP, 'Oh, very well. Very well! Recall them. But the whistles went at half past. They\'re already in the orchard.'],
        [KT, 'The church tower. Red flares mean come back. Run, Avery.']],
      orders: ['Climb the church tower', 'Fire the recall flares', 'Hold until eleven o\'clock'] }
  ];
  const TITLES = ['Over the Top', 'Gas!', 'Iron Horse', 'Wings', 'Saint-Aubin', 'The Eleventh Hour'];
  const TIME = ['predawn', 'gas', 'grey', 'clearing', 'grey', 'clearing'];
  const num = (i) => 'Mission ' + String(i + 1).padStart(2, '0');
  const tag = () => num(MS.idx) + ' · ' + TITLES[MS.idx];
  function objective(text, target, label) { CF.HUD.setObjective(tag(), text, target || null, label || 'Objective'); CF.HUD.setProgress(null, ''); }

  // ---------------------------------------------------------------- helpers
  function resetWorld() {
    CF.Enemies.clear(); ST().clear(); J().reset(); F().reset();
    CF.HUD.countdown(null, null); CF.HUD.bossBar(false);
    for (let i = L.emitters.length - 1; i >= 0; i--) if (L.emitters[i].temp) L.emitters.splice(i, 1);
    for (const it of L.interactables) if (it.type === 'task') { it.enabled = false; it.progress = 0; }
    CF.Enemies.sightMul = 1; CF.Streak.off = false; CF.Streak.hud();
    CF.Player.ride = null; CF.Game.slow = null; CF.Game.timeScale = 1;
  }
  function spawn(type, x, z, o) { return CF.Enemies.spawn(type, x, z, o || {}); }
  const aliveOf = (arr) => arr.filter((e) => e.alive && !(e.T.vehicle && e.gunnerDead)).length;
  function markNearest(arr, label) {
    const P = hp().body.pos; let best = null, bd = Infinity;
    for (const e of arr) if (e.alive && !(e.T.vehicle && e.gunnerDead)) { const d = e.body.pos.distanceTo(P); if (d < bd) { bd = d; best = e; } }
    if (best) { CF.HUD.objTarget = best.body.pos; if (CF.HUD.objLabel !== label) { CF.HUD.objLabel = label; CF.HUD.el.wmLabel.textContent = label; } }
  }
  function progress(arr, word) { const n = aliveOf(arr); CF.HUD.setProgress(1 - n / arr.length, (arr.length - n) + ' / ' + arr.length + ' ' + (word || 'down')); if (n > 0 && n <= 2) markNearest(arr, 'Last of them'); return n; }
  /** Germans at their fire step: they pop up over the parapet, fire, and duck. */
  function riflemen(spots, o) {
    o = o || {};
    return spots.map((s, i) => {
      const t = s[2] || 'german', e = spawn(t, s[0], s[1], { yaw: o.yaw != null ? o.yaw : 0, tag: o.tag || 'ger' });
      e.seed2 = i;
      if (t === 'gmg' || t === 'gsniper') return e;
      return J().hide(e, { ambushR: o.ambushR || 40, moves: o.moves != null ? o.moves : 1 });
    });
  }
  const ally = (look, name, x, z, o) => ST().addAlly(look, name, x, z, Object.assign({ shoots: true, dmg: 16, noTracer: look !== 'tommyLewis' }, o || {}));
  function squad(x, z, yaw) {
    ally('tommy', PK, x + 1.2, z + 1.5, { seed: 91, slot: 0, yaw });
    ally('tommy', CL, x - 1.2, z + 2.0, { seed: 92, slot: 1, yaw });
    ally('tommyLewis', DY, x + 0.8, z + 3.5, { seed: 93, slot: 2, yaw, dmg: 9 });
    J().pointMan = () => PK; J().caller = () => U.choice([PK, CL, DY]);
  }
  function place(cp) { const P = hp(); P.body.pos.set(cp.x, cp.y || 0, cp.z); P.body.vel.set(0, 0, 0); P.yaw = cp.yaw || 0; P.pitch = 0; ST().resetTrail(); }
  function here() { const P = hp(); return { x: P.body.pos.x, y: P.body.pos.y, z: P.body.pos.z, yaw: P.yaw }; }
  function save(cp) { CF.Game.saveCheckpoint(cp || here()); }
  function unlock(id) {
    const WP = CF.Weapons; if (WP.inv[id]) return;
    WP.give(id, true); A.play('weaponGet', null, { ui: true });
    CF.HUD.popup('Unlocked · ' + WP.defs[id].name, 0, 'obj'); CF.HUD.killfeed(WP.defs[id].name + ' unlocked', 'Key ' + (WP.order.indexOf(id) + 1));
  }
  /** Red signal flares going up from the belfry: three balls of fire climbing, hanging, falling. */
  function signal(x, y, z) {
    for (let k = 0; k < 3; k++) CF.Game.later(k * 0.6, () => {
      const v = new THREE.Vector3(U.gauss() * 2, 22, -6 + U.gauss() * 2), p = new THREE.Vector3(x, y + 1.5, z); A.play('flarePop', p, { ref: 30 });
      let t = 0; const tick = () => { t += 0.03; v.y -= 9.8 * 0.03 * 0.55; p.addScaledVector(v, 0.03); CF.FX.glow(p.x, p.y, p.z, 1.6, 9, 0.8, 0.5, 0.05); if (Math.random() < 0.5) CF.FX.smoke.spawn(p.x, p.y, p.z, 0, 0.2, 0, 2, 0.3, 1.6, 0.8, 0.6, 0.55, 0.4, -0.05, 0.3, 1); if (t < 6) CF.Game.later(0.03, tick); };
      tick();
    });
  }

  // ---------------------------------------------------------------- the missions
  const PH = [];
  const BRIT = 70, GER1 = -6;
  // ======== 01 OVER THE TOP
  PH.push({
    id: 'top', num: num(0), title: TITLES[0],
    cp: () => L.points.cp.top,
    enter() {
      const st = MS.st, P = hp();
      if (st.stage === 'start') st.stage = 'wait';
      const men = L.points.trenchMen.ger1.filter((p) => Math.abs(p[0]) < 46);
      this.s.group = riflemen(men.map((p) => [p[0], p[1]]), { yaw: PI, ambushR: 70 }).concat(MAP().nests.map((n) => spawn('gmg', n.x, n.z, { yaw: PI, tag: 'ger', y: n.y })));
      for (const e of this.s.group) e.becomeAware(P.body.pos, true);
      if (st.stage === 'wait') {
        squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
        this.s.zero = 16;
        objective('Wait for the whistle', null, '');
        CF.HUD.phaseCard(num(0), TITLES[0], 'Zero hour 05:40 · cross no-man\'s-land · take their trench');
        say('wait', [[PK, 'Steady, lads. When the whistle goes, up the ladder and keep walking. Don\'t stop for anyone.'], [CL, 'Smoke, Sarge?'], [PK, 'After.']]);
        F().barrage([-50, -4, 50, 8], { every: [0.6, 1.2], spare: 30, damage: 30, id: 'creep' });            // our own barrage on their wire
        for (const e of this.s.group) e.hide && (e.hide.mode = 'duck');
        CF.Enemies.sightMul = 0.2;
      } else this.phase.go.call(this, true);
    },
    go(fromSave) {
      const P = hp();
      MS.st.stage = 'go'; CF.Enemies.sightMul = 1;
      F().stopBarrage('creep');
      F().barrage([-45, 18, 45, 60], { every: [1.4, 2.6], spare: 9, damage: 85, id: 'nml' });             // theirs, on no-man's-land
      if (!fromSave) { A.play('trenchWhistle', null, { ui: true }); for (let i = 1; i < 4; i++) CF.Game.later(i * 0.4, () => A.play('trenchWhistle', { x: P.body.pos.x + (i - 2) * 20, y: 0, z: BRIT }, { ref: 20 })); }
      // the line goes up the ladders together: the squad, and the company either side of you
      const lanes = [-12, -4, 4, 12, -11, -5, 5, 11]; // through the gaps in both belts of wire
      ST().clearAllies();
      const names = [PK, CL, DY];
      lanes.forEach((x, i) => {
        const named = i < 3, a = ally(i === 2 ? 'tommyLewis' : 'tommy', named ? names[i] : 'Tommy', x, fromSave ? P.body.pos.z + 3 : BRIT - 3.5, { seed: 91 + i, follow: false, dmg: named ? 14 : 8, yaw: 0 });
        if (!named) a.noTag = true;
        a.lane = x; a.hold = { x, y: 0, z: BRIT - 6 };
      });
      J().pointMan = () => PK; J().caller = () => U.choice([PK, CL, DY]);
      objective('Cross no-man\'s-land · go through the gaps in their wire', { x: 4, y: 0, z: GER1 + 4 }, 'Their trench');
      say('go', [[PK, 'OVER THE TOP! Come on, lads! With me!'], [CL, 'Here we go, here we go…']]);
      this.later(2, () => CF.HUD.hint('Walk into a ladder to climb out · ' + CF.Keys.label('jump') + ' to mantle · get down in the shell holes when the machine guns sweep'));
      this.later(9, () => CF.HUD.hint('Hold ' + CF.Keys.label('aim') + ' on a German to spot him · their machine guns sit in sandbag nests on the parapet'));
      if (!fromSave) save({ x: P.body.pos.x, y: P.body.pos.y, z: P.body.pos.z, yaw: 0 });
    },
    update(dt) {
      const s = this.s, st = MS.st, P = hp(), pp = P.body.pos;
      if (st.stage === 'wait') {
        s.zero -= dt; CF.HUD.countdown('Zero hour', s.zero);
        if (s.zero <= 0) { CF.HUD.countdown(null, null); this.phase.go.call(this); }
        return;
      }
      // the line advances in bounds: each man moves up to a little ahead of you, never past their wire until you are
      for (const a of ST().allies) {
        if (a.lane == null) continue;
        const front = Math.max(GER1 + (pp.z < GER1 + 12 ? 1 : 12), pp.z - 6);
        if (a.body.pos.z - a.hold.z < 2) a.hold = { x: a.lane + U.gauss() * 0.5, y: 0, z: Math.max(front, a.hold.z - 7) };
        a.crouch = a.body.pos.z < BRIT - 3 ? 0.35 : 0;
      }
      const n = progress(s.group, 'down');
      if (st.stage === 'go' && pp.z < GER1 + 10 && !s.inTrench) { s.inTrench = true; F().stopBarrage('nml'); say('wire', [[PK, 'Through the wire! Into their trench! Bomb them out!']]); objective('Take the German trench', { x: 4, y: 0, z: GER1 }, 'Trench'); }
      if (n === 0 && st.stage === 'go' && s.doneT == null) {
        s.doneT = 5; F().stopBarrage('nml'); award('German front line taken', 600);
        say('taken', [[PK, 'It\'s ours! Get on their fire step, face the other way!'], [WC, 'Well done, B Company. Well done. Now hold it.']]);
      }
    }
  });
  // ======== 02 GAS!
  PH.push({
    id: 'gas', num: num(1), title: TITLES[1],
    cp: () => L.points.cp.gas,
    enter() {
      const st = MS.st, P = hp();
      squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') st.stage = 'clear';
      CF.HUD.phaseCard(num(1), TITLES[1], 'Their trench · bay by bay · masks ready');
      if (st.stage === 'clear') this.phase.clear.call(this);
      else if (st.stage === 'phone') this.phase.phone.call(this);
      else this.phase.counter.call(this);
    },
    clear() {
      MS.st.stage = 'clear';
      // Germans further along their trench, down in the bays, and in the communication trench
      const spots = [[13.5, GER1], [23.5, GER1], [33.5, GER1], [43.5, GER1], [20, -18], [20, -30], [-6.5, GER1], [-16.5, GER1]]; // down in the bays and the communication trench
      this.s.group = riflemen(spots.map((p) => [p[0], p[1]]), { yaw: -PI / 2, ambushR: 14, moves: 1 });
      this.s.group.push(F().flamer(spawn('flamer', 20, -36, { yaw: 0, tag: 'ger', patrol: [[20, -36], [20, -16]] })));
      objective('Clear the trench to the telephone dugout', { x: MAP().phone.x, y: -2.1, z: MAP().phone.z }, 'Dugout');
      say('clear', [[PK, 'Bomb the next bay before you go round. They\'ll be waiting.']]);
      this.later(10, () => { F().barrage([-20, -20, 50, 4], { every: [2.5, 4], spare: 5, gas: 0.85, damage: 50, until: 40, id: 'gasRain' }); say('gasCall', [[DY, 'GAS! GAS! Masks on!']]); CF.HUD.hint('Put your gas mask on · ' + CF.Keys.label('gadget'), true); });
    },
    phone() {
      MS.st.stage = 'phone'; find('phone').enabled = true;
      objective('Try the field telephone', { x: MAP().phone.x, y: -2.1, z: MAP().phone.z }, 'Telephone');
    },
    counter() {
      MS.st.stage = 'counter';
      this.s.counter = [];
      this.spawner = { t: 2, interval: [3, 5], maxAlive: 8, zones: ['ger1'], pool: ['storm', 'storm', 'german', 'german', 'flamer'], remaining: 12 };
      objective('Hold the trench · counter-attack', null, '');
      say('counter', [[PK, 'Here they come, down the communication trench! Bombers!'], [GE, 'Vorwärts! Vorwärts!']]);
      F().barrage([-20, -20, 50, 4], { every: [3, 5], spare: 6, gas: 0.5, damage: 60, until: 50, id: 'gasRain2' });
    },
    onTask(it) {
      if (it.id === 'phone' && MS.st.stage === 'phone') {
        it.enabled = false; award('Telephone', 200); A.play('clacker', null, { ui: true });
        say('phone', [[AV, 'Hello? Hello, Brigade? …It\'s dead, Sarge. Every line\'s cut.'], [PK, 'Course it is.']]);
        this.later(2, () => { this.phase.counter.call(this); save(); });
      }
    },
    update(dt) {
      const s = this.s, st = MS.st;
      if (st.stage === 'clear') {
        const n = progress(s.group);
        if (n === 0 && !s.cleared) { s.cleared = true; award('Trench cleared', 400); this.later(1.5, () => { this.phase.phone.call(this); save(); }); }
      } else if (st.stage === 'counter') {
        if (this.spawner && this.spawner.remaining <= 0 && CF.Enemies.alive() === 0 && s.doneT == null) {
          this.spawner = null; s.doneT = 14; award('Counter-attack broken', 600); unlock('satchel');
          say('harrow', [[PK, 'That\'s them seen off. Who\'s this coming up?'], [HR, 'Harrow, Brigade runner. Message for the Captain. It\'s over, sir. Signed at five. The guns stop at eleven.'],
            [WC, 'Over. My God.'], [HR, 'But Brigade at Saint-Aubin don\'t know, sir. Lines are cut, and General Hollis-Pryce has an attack going in at half past ten. I\'ve been hit in the leg, I can\'t make it.'],
            [WC, 'Avery. You\'re the quickest man I have. Take this to the General. Go with the tank.']]);
        }
      }
    },
    exit() { F().stopBarrage('gasRain'); F().stopBarrage('gasRain2'); }
  });
  // ======== 03 IRON HORSE
  const TANK_ROUTE = [[12, 16], [12, -2], [11, -22], [13, -44], [20, -56], [36, -64], [52, -66], [74, -78], [96, -76]];
  PH.push({
    id: 'tank', num: num(2), title: TITLES[2],
    cp: () => L.points.cp.tank,
    enter() {
      const st = MS.st, P = hp();
      squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') st.stage = 'escort';
      const route = st.stage === 'escort' ? TANK_ROUTE : TANK_ROUTE.slice(5);
      const t = this.s.tank = F().addTank(route);
      t.onHit = () => { if (t.hp < 55 && !t.stopped && !this.s.gunDead) { t.stopped = true; this.phase.gun.call(this); } };
      t.onArrive = () => this.phase.arrive.call(this);
      CF.HUD.phaseCard(num(2), TITLES[2], 'Fat Annie · walking pace · stay in her lee');
      this.s.gunE = MS.st.gun ? null : F().fieldGun(MAP().fieldGun.x, MAP().fieldGun.z, MAP().fieldGun.yaw);
      if (st.stage === 'escort') {
        this.s.group = riflemen(L.points.trenchMen.ger2.map((p) => [p[0], p[1]]), { yaw: 0, ambushR: 45 }).concat([spawn('gmg', 30, -45.5, { yaw: 0, tag: 'ger' })]);
        this.spawner = { t: 12, interval: [7, 11], maxAlive: 8, zones: ['ger2', 'fields'], pool: ['german', 'german', 'storm'], remaining: 8 };
        objective('Stay with Fat Annie', t.pos, 'Fat Annie');
        say('tank', [[FN, 'Annie\'s moving. Stay on her right and walk where she\'s been. She\'s cover; use her.'], [PK, 'And we\'re going to Saint-Aubin on that? I could walk faster.'], [FN, 'You will be walking, Sergeant.']]);
        this.later(4, () => CF.HUD.hint('The tank is cover · stay in its lee and let its guns work'));
      } else if (st.stage === 'gun') { t.stopped = true; this.phase.gun.call(this); }
      else this.phase.road.call(this);
    },
    gun() {
      MS.st.stage = 'gun';
      find('gunCharge').enabled = !!(this.s.gunE && this.s.gunE.alive);
      objective('Knock out the field gun · set a charge on the breech', { x: MAP().fieldGun.x, y: 0, z: MAP().fieldGun.z }, 'Field gun');
      say('gun', [[FN, 'We\'re hit! Field gun, eleven o\'clock, by the trees! She can\'t take another!'], [PK, 'Avery, gun-cotton! Get round its flank and blow the breech!']]);
      save();
    },
    road() {
      MS.st.stage = 'road'; const t = this.s.tank; t.stopped = false;
      objective('Stay with Fat Annie up the road', t.pos, 'Fat Annie');
      this.spawner = { t: 6, interval: [7, 11], maxAlive: 6, zones: ['fields'], pool: ['german', 'storm'], remaining: 6 };
    },
    arrive() {
      const s = this.s; if (s.doneT != null) return;
      this.spawner = null; s.doneT = 10; award('Fat Annie got through', 600); unlock('minigun');
      say('arrive', [[FN, 'And that\'s a thrown track. Annie\'s done. Sorry, Private. You\'re on foot.'], [CL, 'There\'s an aeroplane in that meadow! One of ours!'], [PK, 'Go on, Avery. Ask him nicely.']]);
    },
    onTask(it) {
      if (it.id === 'gunCharge' && MS.st.stage === 'gun') {
        it.enabled = false; A.play('charge', it.pos, { ref: 6 }); CF.HUD.hint('Charge set · get clear', true);
        this.later(3, () => {
          const g = this.s.gunE; const at = new THREE.Vector3(MAP().fieldGun.x, MAP().height(MAP().fieldGun.x, MAP().fieldGun.z) + 1, MAP().fieldGun.z);
          CF.Game.explode(at, { radius: 5, damage: 200, source: 'player', scale: 1.2 }); A.play('bigBoom', at, { ref: 12 });
          if (g && g.alive) { g.hp = 0; g.die({ explosive: true }); }
          MS.st.gun = true; this.s.gunDead = true; award('Field gun destroyed', 500);
          say('gunDead', [[FN, 'Ha! That\'s the stuff! Annie\'s still running. Onward.']]);
          this.phase.road.call(this); save();
        });
      }
    },
    update() {
      const s = this.s, st = MS.st, t = s.tank, pp = hp().body.pos;
      if (!t) return;
      if (st.stage === 'escort' || st.stage === 'road') {
        CF.HUD.objTarget = t.pos;
        // she waits for her infantry
        const d = Math.hypot(pp.x - t.pos.x, pp.z - t.pos.z);
        t.throttle = d > 26 ? 0 : 1;
        if (d > 26 && !s.toldClose) { s.toldClose = true; say('close', [[FN, 'Infantry! I\'m not going on without you!']]); }
        if (d < 20) s.toldClose = false;
        if (s.group) { const n = aliveOf(s.group); CF.HUD.setProgress(null, n ? n + ' in the second line' : ''); }
      }
      if (st.stage === 'gun' && s.gunE && (!s.gunE.alive || s.gunE.gunnerDead) && !MS.st.gun) { MS.st.gun = true; s.gunDead = true; award('Field gun destroyed', 500); this.phase.road.call(this); save(); }
    }
  });
  // ======== 04 WINGS
  PH.push({
    id: 'wings', num: num(3), title: TITLES[3],
    cp: () => L.points.cp.plane,
    enter() {
      const st = MS.st;
      st.stage = 'board';
      const M = MAP().meadow, gy = MAP().height(M.x, M.z);
      // the flight: along the meadow, up over the British lines, a long loop round the sector, and down near Saint-Aubin
      const path = [[M.x, gy, M.z], [M.x + 1, gy + 0.2, M.z + 30], [M.x + 4, gy + 8, M.z + 70], [110, 40, 60], [60, 60, 130], [-50, 70, 150], [-150, 75, 60],
        [-170, 75, -60], [-100, 70, -170], [20, 65, -210], [140, 60, -170], [190, 60, -40], [150, 65, 80], [40, 70, 120], [-80, 60, 60], [-110, 50, -30], [-70, 30, -90], [-30, 12, -98], [-8, 3, -101], [2, gy + 1.5, -101], [5, gy + 1.2, -101.5]];
      this.s.plane = F().addPlane(path, 24); this.s.plane.throttle = 0;
      this.s.ally = ST().addAlly('airman', KT, M.x - 2, M.z - 3, { seed: 81, follow: false }); this.s.ally.hold = { x: M.x - 2, y: 0, z: M.z - 3 };
      find('bristol').enabled = true;
      objective('Climb into the Bristol\'s back seat', { x: M.x, y: gy, z: M.z }, 'Bristol');
      CF.HUD.phaseCard(num(3), TITLES[3], 'A Bristol Fighter · the observer\'s Lewis gun');
    },
    onTask(it) {
      if (it.id === 'bristol' && MS.st.stage === 'board') {
        it.enabled = false; MS.st.stage = 'fly';
        const pl = this.s.plane, P = hp();
        ST().clearAllies(); pl.board(P); pl.throttle = 1;
        P.yaw = pl.yaw + PI; P.pitch = 0.05;
        const WP = CF.Weapons; if (!WP.inv.minigun) WP.give('minigun', true); WP.inv.minigun.reserve = 900; WP.select('minigun');
        say('takeoff', [[KT, 'Contact! Hold on to your hat.'], [KT, 'You face backwards, Avery. Anything with black crosses on it, shoot it. Lead them a little.']]);
        this.s.events = [[0.16, 2], [0.38, 2], [0.58, 3], [0.8, 'hit']]; this.s.air = [];
        this.later(5, () => CF.HUD.hint('The Lewis gun is on the ring · Fokkers swing wide, then turn in on your tail · fire as they come in'));
      }
    },
    update(dt) {
      const s = this.s, st = MS.st, pl = s.plane;
      if (st.stage !== 'fly' || !pl) return;
      CF.Weapons.inv.minigun && (CF.Weapons.inv.minigun.reserve = Math.max(CF.Weapons.inv.minigun.reserve, 200));
      while (s.events.length && pl.t >= s.events[0][0]) {
        const ev = s.events.shift()[1];
        if (ev === 'hit') {
          pl.smoke = true; A.play('heliHit', null, { vol: 0.8 }); hp().shake(0.6);
          say('hit', [[KT, 'Oh, hell. Engine\'s hit. I\'m putting her down. Brace!']]);
        } else {
          for (let i = 0; i < ev; i++) { const a = Math.random() * PI * 2; s.air.push(F().fokker(pl.pos.x + Math.cos(a) * 160, pl.pos.y + U.rand(10, 30), pl.pos.z + Math.sin(a) * 160)); }
          say('fok' + s.air.length, [[KT, U.choice(['Fokkers! ' + ev + ' of them, coming round!', 'More of them! Watch the sun!', 'Here\'s the circus. Good shooting, Avery.'])]]);
        }
      }
      const n = aliveOf(s.air); CF.HUD.setProgress(s.air.length ? 1 - n / s.air.length : null, s.air.length ? (s.air.length - n) + ' / ' + s.air.length + ' Fokkers down' : '');
      if (n) markNearest(s.air, 'Fokker');
      if (pl.t >= 1 && s.doneT == null) {
        // down hard in the field west of the village
        A.play('crash', null, { vol: 1 }); CF.FX.explosion(pl.pos.clone(), 1); hp().shake(1); A.concuss(0.8);
        pl.unboard(); for (const e of s.air) if (e.alive) { e.alive = false; e.remove(); }
        place({ x: 6, y: MAP().height(6, -104), z: -104, yaw: -PI / 2 }); hp().eye = 0.5;
        award('Survived the flight', 400); s.doneT = 4;
        CF.Post.setState({ fade: 0.1 }); this.later(1, () => CF.Post.setState({ fade: 1 }));
        say('down', [[KT, 'Everybody alive? Good landing, then. Any landing you walk away from.']]);
      }
    },
    exit() { const WP = CF.Weapons; if (WP.inv.minigun) WP.inv.minigun.reserve = Math.min(WP.inv.minigun.reserve, WP.defs.minigun.maxReserve); }
  });
  // ======== 05 SAINT-AUBIN
  PH.push({
    id: 'aubin', num: num(4), title: TITLES[4],
    cp: () => L.points.cp.village,
    enter() {
      const st = MS.st, P = hp();
      if (st.stage === 'start') st.stage = 'streets';
      ST().addAlly('airman', KT, P.body.pos.x + 1, P.body.pos.z + 2, { seed: 81, slot: 0 });
      ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      const hides = [[10, -99], [14, -110], [0, -116], [12, -120], [24, -100], [44, -100], [56, -99], [68, -101], [52, -130], [84, -110], [86, -100]];
      this.s.group = riflemen(hides.map((p) => [p[0], p[1]]), { yaw: PI / 2, ambushR: 35, moves: 2 });
      if (!st.sniper) { const b = MAP().perches.belfry; const sn = spawn('gsniper', b.x, b.z, { y: b.y, yaw: PI / 2, tag: 'ger' }); sn.onDeath = () => { MS.st.sniper = true; award('Belfry sniper', 300); }; this.s.group.push(sn); }
      this.s.group.push(spawn('gofficer', 64, -108, { yaw: PI / 2, tag: 'ger' }));
      this.spawner = { t: 10, interval: [8, 12], maxAlive: 9, zones: ['village'], pool: ['german', 'storm', 'german'], remaining: 8 };
      find('cellar').enabled = true;
      objective('Get to the chateau across the square', { x: MAP().cellar.x, y: 0, z: MAP().cellar.z }, 'Chateau');
      CF.HUD.phaseCard(num(4), TITLES[4], 'A ruined village · the chateau is Brigade HQ');
      say('aubin', [[KT, 'Sniper in the church tower, I\'d bet my wings on it. Keep to the walls.']]);
    },
    onTask(it) {
      if (it.id === 'cellar') {
        it.enabled = false; this.spawner = null;
        for (const e of CF.Enemies.list) if (e.alive) { e.noScore = true; e.alive = false; e.remove(); }
        award('Brigade HQ', 800); unlock('rail');
        say('hq', [[AV, 'Message for Brigadier-General Hollis-Pryce. From Captain Whitcombe. The armistice was signed at five. All attacks to stop.'],
          [HP, 'Signed? Well, they would wait until I\'d got my attack laid on, wouldn\'t they.']]);
        this.s.doneT = 6;
      }
    },
    update() { const s = this.s; if (s.group) { const n = aliveOf(s.group); CF.HUD.setProgress(null, n ? n + ' Germans in the streets' : ''); } }
  });
  // ======== 06 THE ELEVENTH HOUR
  PH.push({
    id: 'eleventh', num: num(5), title: TITLES[5],
    cp: () => L.points.cp.eleventh,
    enter() {
      const st = MS.st, P = hp();
      if (st.stage === 'start') st.stage = 'tower';
      ST().addAlly('airman', KT, P.body.pos.x + 1, P.body.pos.z + 2, { seed: 81, slot: 0 }); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      this.s.clock = st.stage === 'hold' ? 150 : 240; // 10:31 → 11:00, a minute a game-eight-seconds
      // the attack already out in the orchard: men walking east
      this.s.attack = [];
      for (let i = 0; i < 8; i++) { const a = ally('tommy', 'Tommy', 96 + (i % 4) * 3, -124 + Math.floor(i / 4) * 12, { seed: 120 + i, follow: false, dmg: 6 }); a.noTag = true; a.hold = { x: 128, y: 0, z: a.body.pos.z }; this.s.attack.push(a); }
      this.s.group = riflemen([[122, -100, 'gmg'], [126, -118], [118, -130], [130, -108], [116, -112]], { yaw: -PI / 2, ambushR: 60 });
      for (const e of this.s.group) e.becomeAware(this.s.attack[0].body.pos, true);
      find('towerUp').enabled = true; find('towerDown').enabled = true;
      if (st.stage === 'tower') { objective('Climb the church tower and fire the recall flares', { x: 30, y: 0, z: -105 }, 'Church'); find('flares').enabled = true; }
      else this.phase.hold.call(this);
      CF.HUD.phaseCard(num(5), TITLES[5], 'Saint-Aubin · 10:31 · twenty-nine minutes of war left');
      say('race', [[KT, 'Go, Avery! The tower!']]);
    },
    hold() {
      MS.st.stage = 'hold';
      for (const a of this.s.attack || []) a.hold = { x: 82 + Math.random() * 6, y: 0, z: a.body.pos.z };
      this.spawner = { t: 4, interval: [3, 5.5], maxAlive: 10, zones: ['orchard', 'village'], pool: ['german', 'german', 'storm', 'gmg'], remaining: 999 };
      objective('Hold until eleven o\'clock', null, '');
    },
    onTask(it) {
      const P = hp(), M = MAP();
      if (it.id === 'towerUp') { place({ x: M.belfry.x - 2.4, y: M.belfry.y, z: M.belfry.z + 2.4, yaw: -PI / 2 }); A.play('mantle', null, { ui: true }); }
      else if (it.id === 'towerDown') { place({ x: M.tower.door.x, y: M.tower.door.y, z: M.tower.door.z + 2.6, yaw: 0 }); A.play('mantle', null, { ui: true }); }
      else if (it.id === 'flares' && MS.st.stage === 'tower') {
        it.enabled = false; signal(M.belfry.x, M.belfry.y, M.belfry.z); award('Recall flares', 800);
        say('flares', [[KT, 'There they go! Red, red, red!'], [PK, '…That\'s the recall! Back, lads! Back to the village!'], [GE, 'Die Engländer gehen zurück! Nach! Nach!']]);
        this.phase.hold.call(this); save({ x: P.body.pos.x, y: P.body.pos.y, z: P.body.pos.z, yaw: P.yaw });
      }
    },
    update(dt) {
      const s = this.s, st = MS.st;
      if (s.over) return;
      s.clock -= dt;
      const left = Math.max(0, s.clock), mins = 29 * left / 240, h = 10, m = 60 - Math.ceil(mins);
      CF.HUD.countdown('Armistice · ' + h + ':' + String(Math.min(59, m)).padStart(2, '0'), left);
      if (st.stage === 'tower' && s.clock < 150) { // too late on the flares: the attack is cut to pieces in the orchard
        CF.Game.fail('The attack went in. Fire the flares sooner.'); return;
      }
      if (st.stage === 'hold' && s.clock <= 0) {
        s.over = true; this.spawner = null; CF.HUD.countdown(null, null);
        F().ceasefire(); CF.Music.setIntensity(0.05);
        const M = MAP(); F().bells(M.belfry.x, M.belfry.y + 2, M.belfry.z);
        award('Eleven o\'clock', 2000);
        say('eleven', [[KT, '…Listen.'], [AV, 'It\'s stopped. It\'s all stopped.'], [GE, 'Tommy! Es ist vorbei! It is finished!'], [PK, 'Eleven o\'clock. Well, I\'ll be damned.'], [KT, 'Not today, Sergeant. Nobody is, today.']]);
        s.doneT = 16;
      }
    },
    exit() { CF.HUD.countdown(null, null); }
  });
  MS.phases = PH;

  // ---------------------------------------------------------------- flow
  MS.start = function () {
    this.said = {}; this.st = { v: 1, stage: 'start', gun: false, sniper: false };
    this.begin(0, false, true);
  };
  function setup() { CF.Music.setTheme('trench'); J().start(); J().flareLamps = MAP().flareLamps; F().start(); CF.Weapons.setEra('ww1'); }
  MS.begin = function (i, retry, brief) {
    const G = CF.Game;
    this.idx = i; this.phase = PH[i]; this.busy = false;
    setup();
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
    setup(); resetWorld();
    MAP().setTime(TIME[i]);
    CF.Music.setIntensity(0.2);
    if (this.st.stage === 'start') { giveKit(i); place(PH[i].cp()); }
    this.phase.enter.call(this, retry);
  };
  MS.later = function (t, fn) { this.timers.push({ t, fn }); };
  MS.complete = function () {
    const G = CF.Game;
    this.spawner = null; G.phaseDone(this.idx);
    A.play('objective', null, { ui: true }); CF.Music.sting('objective');
    CF.HUD.popup(TITLES[this.idx] + ' complete', pts(1000), 'obj'); G.addScore(pts(1000));
    const next = this.idx + 1;
    if (next >= PH.length) { G.victory(); return; }
    const reward = { 0: 'shotgun', 1: 'satchel', 2: 'minigun', 3: 'rocket', 4: 'rail' }[this.idx];
    if (reward) CF.HUD.killfeed(CF.Weapons.defs[reward].name + ' unlocked', 'Next mission');
    this.busy = true; CF.Post.setState({ fade: 0.05 });
    G.later(1.4, () => {
      this.busy = false;
      if (G.state !== 'playing' || CF.Mission !== this) return;
      if (this.phase.exit) this.phase.exit.call(this);
      this.st.stage = 'start'; this.idx = next; this.phase = PH[next];
      CF.Player.ride = null;
      place(PH[next].cp()); giveKit(next);
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
    CF.Story.update(dt); J().update(dt); F().update(dt);
    let I = 0.2; const c = CF.Enemies.combatCount;
    if (c > 0) I = Math.min(0.95, 0.45 + c * 0.07);
    if (this.phase.id === 'top' && MS.st.stage === 'go') I = Math.max(I, 0.9);
    if (this.s.over) I = 0.05;
    CF.Music.setIntensity(I);
  };
  MS.preUpdate = function (dt) { CF.Story.preUpdate(dt); J().preUpdate(dt); F().preUpdate(dt); };
  MS.onKill = function () {};
  MS.onBossKilled = function () {};
  MS.onTask = function (it) { if (it.trap) { J().onTask(it); return; } if (this.phase.onTask) this.phase.onTask.call(this, it); };

  // ---------------------------------------------------------------- spawning
  MS.spawnAt = function (type, zones, opts) {
    const P = CF.Player, eye = P.eyePos(new THREE.Vector3());
    let best = null, bs = -Infinity;
    for (const z of zones) for (const c of (L.spawns[z] || [])) {
      const x = c[0] + U.gauss() * 2, zz = c[1] + U.gauss() * 2, y = W.navHeight(x, zz); if (isNaN(y)) continue;
      const d = Math.hypot(x - P.body.pos.x, zz - P.body.pos.z); if (d < 16) continue;
      const hidden = !W.segmentClear(eye.x, eye.y, eye.z, x, y + 1.2, zz);
      const score = (hidden ? 30 : 0) - Math.abs(d - 34) * 0.5 + Math.random() * 14;
      if (score > bs) { bs = score; best = [x, zz]; }
    }
    if (!best) return null;
    const e = CF.Enemies.spawn(type, best[0], best[1], Object.assign({ aware: true }, opts));
    if (type === 'storm') J().sapper(e);
    if (type === 'flamer') F().flamer(e);
    return e;
  };
  MS.updateSpawner = function (dt) {
    const s = this.spawner; if (!s) return;
    s.t -= dt; if (s.t > 0) return;
    s.t = U.rand(s.interval[0], s.interval[1]);
    const alive = CF.Enemies.alive((e) => !e.T.vehicle && !e.T.flying);
    if (alive >= s.maxAlive || s.remaining <= 0) return;
    const n = Math.min(Math.random() < 0.5 ? 2 : 1, s.maxAlive - alive, s.remaining);
    for (let i = 0; i < n; i++) { const e = this.spawnAt(U.choice(s.pool), s.zones); if (e) s.remaining--; }
  };

  // ---------------------------------------------------------------- saves
  MS.saveState = function () { const st = this.st; return { v: 1, stage: st.stage, gun: !!st.gun, sniper: !!st.sniper }; };
  MS.validState = (m) => m && m.v === 1 && typeof m.stage === 'string' && m.stage.length < 24 && typeof m.gun === 'boolean' && typeof m.sniper === 'boolean';
  MS.restore = function (state, idx, fromSave) {
    this.st = { v: 1, stage: state.stage, gun: state.gun, sniper: state.sniper };
    this.said = {};
    if (idx === 3 || (idx === 0 && this.st.stage === 'wait') || (idx === 2 && this.st.stage === 'road' && !this.st.gun)) this.st.stage = 'start'; // flights and zero hour replay from the start
    this.entered = false;
    this.begin(idx, true, fromSave && this.st.stage === 'start');
  };
  MS.skipTo = function (i) {
    CF.Enemies.clear();
    this.st = { v: 1, stage: 'start', gun: false, sniper: false };
    this.entered = false;
    this.begin(i, false, false);
    CF.Game.saveCheckpoint(PH[i].cp());
  };
  MS.resetWorld = function () { resetWorld(); };
  MS.teardown = function () { if (this.phase && this.phase.exit) this.phase.exit.call(this); resetWorld(); J().stop(); F().stop(); J().flareLamps = null; CF.Weapons.setEra(null); this.entered = false; };

  CF.Campaigns.ww1 = { id: 'ww1', name: 'The Eleventh Hour', short: 'Eleventh Hour', map: 'western', mission: MS, secured: 'The guns fell silent', music: 'trench', story: true };
})(window.CF);
