'use strict';
/* Cinderfall — Story Campaign: DUST OFF. Eight missions in Dar Masir, one after another, with a briefing between each.
   I Insertion: Drop Zone → Contact. II The Rescue: Ghost Protocol (stealth) → Breach.
   III Black Hawk Down: Shot Down → The Long Walk → Last Block → Extraction.
   Each mission is a campaign "part" (leaderboard progress, coins, checkpoints); its stages save mid-mission checkpoints. */
(function (CF) {
  const U = CF.U, W = CF.World, L = CF.Level, A = CF.Audio;
  const ST = () => CF.Story, MAP = () => CF.MapStory;
  const PI = Math.PI;
  const AN = 'Anvil', OK = 'Okafor', D61 = 'Dust 6-1', D62 = 'Dust 6-2', D63 = 'Dust 6-3', SR = 'Capt. Serrano', MG = 'The Magistrate', KD = 'CW2 Kade';
  const find = (id) => L.interactables.find((i) => i.id === id);
  const MS = CF.Missions.story = { id: 'story', idx: 0, phase: null, t: 0, s: {}, st: {}, spawner: null, said: {}, timers: [], props: [] };
  const hp = () => CF.Player;

  function say(key, lines) {
    if (MS.said[key]) return;
    MS.said[key] = 1;
    for (const l of lines) CF.HUD.radio(l[0], l[1], l[0] === MG);
  }
  MS.say = say;
  const pts = (n) => CF.Game.pts(n);
  function award(label, n) { CF.Game.addScore(pts(n)); CF.HUD.popup(label, pts(n), 'obj'); }
  const near = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

  // ---------------------------------------------------------------- kit: every mission starts with its own loadout
  const W0 = (ids) => { const w = {}; for (const id of ids) { const d = CF.Weapons.defs[id]; w[id] = { mag: d.mag, reserve: d.reserve }; } return w; };
  const KIT = [
    { weapons: ['carbine', 'pistol'], grenades: 2 },
    { weapons: ['carbine', 'shotgun', 'pistol'], grenades: 2 },
    { weapons: ['carbine', 'pistol'], grenades: 1, quiet: true },
    { weapons: ['carbine', 'shotgun', 'pistol', 'satchel'], grenades: 3 },
    { weapons: ['carbine', 'shotgun', 'pistol', 'satchel'], grenades: 2 },
    { weapons: ['carbine', 'shotgun', 'pistol', 'satchel', 'minigun'], grenades: 3 },
    { weapons: ['carbine', 'shotgun', 'rail', 'pistol', 'satchel', 'minigun', 'rocket'], grenades: 3 },
    { weapons: ['carbine', 'shotgun', 'rail', 'pistol', 'satchel', 'minigun', 'rocket'], grenades: 4 }
  ];
  function giveKit(i) {
    const k = KIT[i];
    CF.Weapons.reset({ weapons: W0(k.weapons), current: 'carbine', grenades: k.grenades });
    CF.Weapons.setSuppressed(!!k.quiet);
  }
  const UNLOCKS = [
    { id: 'shotgun', task: 'Finish Drop Zone' }, { id: 'satchel', task: 'Reach the fort (Breach)' }, { id: 'minigun', task: 'Take the door gun from the wreck (Shot Down)' },
    { id: 'rocket', task: 'Hold the school (Last Block)' }, { id: 'rail', task: 'Hold the school (Last Block)' }
  ];
  MS.unlocks = UNLOCKS;
  MS.nextUnlock = function () { return UNLOCKS.find((u) => !CF.Weapons.inv[u.id]) || null; };

  // ---------------------------------------------------------------- briefings
  const BRIEF = [
    { act: 'Act I · Insertion', where: 'Dar Masir outskirts · Qaltan · 05:40',
      lines: [[AN, 'Nine days ago a recon team, callsign Lantern, was taken on the road outside Dar Masir. Four of ours. Alive as of yesterday.'],
        [AN, 'The city belongs to the Red Sand militia and the man who runs it: Colonel Idris Kaal. The locals call him the Magistrate.'],
        [AN, 'Task Force Sabre goes in at first light. Nomad, you ride Dust Six-One with Okafor\'s team. Land at LZ Iron, take the checkpoint, open the road.']],
      orders: ['Ride in on Dust 6-1 · fire from the door', 'Secure LZ Iron', 'Clear the militia checkpoint'] },
    { act: 'Act I · Insertion', where: 'Souk al-Masir · 08:15',
      lines: [[OK, 'Road\'s open. The souk runs two hundred metres north to Clocktower Square. Stalls, balconies, rooftops. Watch all of them.'],
        [AN, 'Drones tracked Lantern\'s guards through the square this morning. Take it and we find out where they went.']],
      orders: ['Push through the souk', 'Take Clocktower Square', 'Stop the technical'] },
    { act: 'Act II · The Rescue', where: 'The Magistrate\'s villa · 01:30',
      lines: [[AN, 'The guards from the square went home to the villa. Kaal sleeps there. His ledger lists where every prisoner in this city is held.'],
        [AN, 'One operator. Suppressed weapons. If anyone raises the alarm, Kaal runs for his car and Lantern gets moved, or buried.'],
        [OK, 'I\'ll be on the ridge with a scope. Stay out of the light, keep low, and don\'t let them find the bodies.']],
      orders: ['Enter through the drainage culvert in the west wall', 'Eliminate Colonel Kaal', 'Copy the ledger in his study', 'Exfil through the culvert', 'Bonus: never raise the alarm'] },
    { act: 'Act II · The Rescue', where: 'Qasr al-Hadid prison · 05:10',
      lines: [[AN, 'The ledger puts Lantern in the old fort, Qasr al-Hadid. Cell block against the north wall.'],
        [OK, 'Gate first, then the block door. We blow both and go in fast.'],
        [AN, 'Dust Six-Two will pick you and the prisoners up from the courtyard pad. Bring everyone home.']],
      orders: ['Breach the fort gate', 'Clear the courtyard', 'Breach the cell block', 'Free the four prisoners', 'Get them to Dust 6-2'] },
    { act: 'Act III · Black Hawk Down', where: 'Over central Dar Masir · 07:02',
      lines: [[D62, 'Six-Two, wheels up with nine souls, turning south for home.'], [SR, 'Nine days in that hole. Tell me somebody brought coffee.'],
        [AN, 'Six-Two, Anvil. Be advised, militia massing along Victory Avenue. Stay high.']],
      orders: ['Survive', 'Pull the pilot out of the wreck', 'Hold the crash site'] },
    { act: 'Act III · Black Hawk Down', where: 'Victory Avenue to the school · 14:20',
      lines: [[AN, 'Every bird we send over that district takes fire. Nobody is landing near you.'], [AN, 'There\'s a walled school east of the boulevard. Get there and we can hold it.'],
        [OK, 'Prisoners stay between us. Nobody gets left behind.']],
      orders: ['Cross the boulevard', 'Move through the covered bazaar', 'Reach the school compound with everyone'] },
    { act: 'Act III · Black Hawk Down', where: 'The school compound · 18:40',
      lines: [[AN, 'The relief column is fighting through the south side. They need time. You need to hold.'],
        [OK, 'They\'ll come through both gates and the hole in the east wall. The roof has the angles. Take my rifle, I\'ve got the rest.']],
      orders: ['Hold the compound until the relief column breaks through', 'Watch the east wall and the water tower'] },
    { act: 'Act III · Black Hawk Down', where: 'Dar Masir stadium · 21:15',
      lines: [[AN, 'The stadium is the only field big enough for Dust Six-Three. It\'s straight south of you.'],
        [D63, 'Six-Three inbound. I can give you sixty seconds on the ground and not one more.'], [SR, 'Then let\'s not waste them.']],
      orders: ['Get to the stadium', 'Hold the landing zone', 'Get everyone aboard'] }
  ];
  const TITLES = ['Drop Zone', 'Contact', 'Ghost Protocol', 'Breach', 'Shot Down', 'The Long Walk', 'Last Block', 'Extraction'];
  const TIME = ['dawn', 'day', 'night', 'dawn', 'day', 'afternoon', 'dusk', 'night'];
  const num = (i) => 'Mission ' + String(i + 1).padStart(2, '0');
  const tag = () => num(MS.idx) + ' · ' + TITLES[MS.idx];
  function objective(text, target, label) { CF.HUD.setObjective(tag(), text, target || null, label || 'Objective'); CF.HUD.setProgress(null, ''); }

  // ---------------------------------------------------------------- world helpers
  function resetWorld() {
    CF.Enemies.clear();
    ST().clear();
    CF.HUD.countdown(null, null); CF.HUD.bossBar(false);
    for (const p of MS.props) { if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh); if (p.cols) for (const c of p.cols) c.enabled = false; }
    MS.props.length = 0;
    for (let i = L.emitters.length - 1; i >= 0; i--) if (L.emitters[i].temp) L.emitters.splice(i, 1);
    for (const id of ['villaGate', 'fortGate', 'blockDoor', 'cell1', 'cell2', 'cell3', 'cell4']) { const d = L.doors[id]; if (!d) continue; d.mesh.visible = id.startsWith('cell') ? true : true; if (d.open || !d.col.enabled) L.closeDoor(id); }
    for (const it of L.interactables) if (it.type === 'task') { it.enabled = false; it.progress = 0; }
    if (MS.siren) { MS.siren.stop(); MS.siren = null; }
    CF.Enemies.sightMul = 1; CF.Enemies.onRpg = onRpg;
    CF.Streak.off = false; CF.Streak.hud();
    CF.Player.ride = null;
    CF.Game.slow = null; CF.Game.timeScale = 1;
  }
  /** A breached door: blown off its frame for good. */
  function blowDoor(id, at) {
    const d = L.doors[id]; if (!d) return;
    d.mesh.visible = false; d.col.enabled = false; d.open = true; d.t = 1;
    W.rebuildNavRect(d.rect[0], d.rect[1], d.rect[2], d.rect[3]);
    if (at) {
      CF.Game.explode(at, { radius: 5, damage: 150, source: 'player', scale: 1.1, noSelf: false });
      for (let i = 0; i < 14; i++) CF.FX.debris(at.x, at.y + 1, at.z, 0, 0.4, 1, 3, 9, 0.12);
      CF.Game.slowMo(0.3, 1.4); A.play('bigBoom', at, { ref: 12 });
    }
  }
  function openCell(i, instant) { const id = 'cell' + (i + 1); L.openDoor(id, instant); if (!instant) A.play('cellDoor', L.doors[id].mesh.position, { ref: 6 }); }
  /** The burning helicopter in the roundabout (Shot Down onwards). */
  function wreck() {
    if (MS.props.some((p) => p.wreck)) return;
    const g = CF.StoryModels.heli(), c = L.points.crash;
    g.position.set(c.x, -0.3, c.z); g.rotation.set(0.12, 0.9, 0.42, 'YXZ');
    const u = g.userData; u.rotor.rotation.set(0.2, 0.7, 0.3); u.rotor.children.forEach((b, i) => { if (b.scale.z > 5) b.scale.z = i % 2 ? 6 : 11; }); u.beacon.visible = false;
    g.traverse((o) => { if (o.isMesh && o.material && o.material.color && !o.material.userData.burnt) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.28); o.material.userData.burnt = true; } });
    for (const pm of u.crew) pm.root.visible = false;
    CF.Game.scene.add(g);
    const cols = [W.add(c.x - 3.2, 0, c.z - 3.2, c.x + 3.2, 3, c.z + 3.2, { surf: 'metal' }), W.add(c.x + 1, 0, c.z - 8, c.x + 4, 2.5, c.z - 3, { surf: 'metal' })];
    W.rebuildNavRect(c.x - 9, c.z - 9, c.x + 9, c.z + 9);
    MS.props.push({ mesh: g, cols, wreck: true });
    L.emitters.push({ type: 'fire', x: c.x + 0.8, y: 2.2, z: c.z - 0.5, rate: 18, size: 1.2, temp: true }, { type: 'fire', x: c.x + 2.5, y: 0.6, z: c.z - 5, rate: 8, size: 0.7, temp: true });
    MS.fireLamp = MS.fireLamp || L.lamp(c.x, 3, c.z, { color: 0xff8030, intensity: 2.2, distance: 16, pool: false, flicker: 0.3, prio: 2 });
    MS.fireLamp.on = true;
  }
  function spawn(type, x, z, o) { return CF.Enemies.spawn(type, x, z, o || {}); }
  function spawnGroup(list, tagName) { return list.map((d) => spawn(d[0], d[1], d[2], Object.assign({ yaw: d[3] || 0, tag: tagName, patrol: d[4] || null, y: d[5] }, d[6] || {}))); }
  const allDead = (arr) => arr.every((e) => !e.alive || (e.T.vehicle && e.gunnerDead));
  const aliveOf = (arr) => arr.filter((e) => e.alive && !(e.T.vehicle && e.gunnerDead)).length;
  function markNearest(arr, label) {
    const P = hp().body.pos; let best = null, bd = Infinity;
    for (const e of arr) if (e.alive && !(e.T.vehicle && e.gunnerDead)) { const d = e.body.pos.distanceTo(P); if (d < bd) { bd = d; best = e; } }
    if (best) { CF.HUD.objTarget = best.body.pos; if (CF.HUD.objLabel !== label) { CF.HUD.objLabel = label; CF.HUD.el.wmLabel.textContent = label; } }
  }
  function technical(route, tagName) {
    const r = route[0], e = spawn('technical', r[0], r[1], { yaw: Math.atan2(-(route[1][0] - r[0]), -(route[1][1] - r[1])), route: route.slice(1), tag: tagName });
    if (CF.Game.audioOn) { e.engine = A.loop('engine', e.body.pos); if (e.engine) e.engine.set(0.35, 0.3); }
    e.cleanup = () => { if (e.engine) { e.engine.stop(); e.engine = null; } };
    e.onDeath = () => { if (e.engine) { e.engine.stop(); e.engine = null; } L.emitters.push({ type: 'fire', x: e.body.pos.x, y: e.body.pos.y + 1, z: e.body.pos.z, rate: 10, size: 0.9, temp: true }); };
    return e;
  }
  let rpgSaid = 0;
  function onRpg() { if (CF.time - rpgSaid > 20 && ST().allies.length) { rpgSaid = CF.time; CF.HUD.radio(OK, U.choice(['RPG!', 'RPG, get down!', 'Rocket! Move!'])); } }
  function pow(i, x, z, o) {
    const names = ['Capt. Serrano', 'Sgt. Hale', 'Spc. Nakamura', 'Lt. Brandt'];
    return ST().addAlly('pow', names[i], x, z, Object.assign({ seed: 101 + i, slot: 2 + i, follow: true }, o || {}));
  }
  function squad(x, z, yaw) {
    const S = ST();
    S.addAlly('friendly', 'SSgt. Okafor', x + 1.5, z + 2, { seed: 7, slot: 0, shoots: true, yaw, dmg: 12 });
    S.addAlly('friendly', 'Cpl. Duarte', x - 1.5, z + 2.5, { seed: 8, slot: 1, shoots: true, yaw, dmg: 10 });
  }
  /** The pilot walks with you but lost his weapon in the crash. */
  function unarmed(a) { a.m.p.gun.visible = false; a.m.gunSpec = null; a.shoots = false; return a; }
  function place(cp) { const P = hp(); P.body.pos.set(cp.x, cp.y || 0, cp.z); P.body.vel.set(0, 0, 0); P.yaw = cp.yaw || 0; P.pitch = 0; ST().resetTrail(); }

  // ---------------------------------------------------------------- the missions
  const PH = [];
  // ======== 01 DROP ZONE
  PH.push({
    id: 'dropzone', num: num(0), title: TITLES[0],
    cp: () => L.points.cp.dropzone,
    enter(retry) {
      const st = MS.st.stage;
      if (st === 'start' || st === 'ride') return this.phase.ride.call(this);
      this.phase.ground.call(this, st);
    },
    ride() {
      const S = ST(), P = hp();
      MS.st.stage = 'ride';
      const h = this.s.heli = S.addHeli(-190, 55, 170, -2.4, D61);
      h.board(P);
      h.fly([[-150, 44, 145], [-112, 30, 124], [-78, 26, 116], [-50, 24, 100], [-42, 20, 82], [-58, 14, 80], [-76, 6, 90], [-78, 0.2, 92]], 17, () => this.phase.landed.call(this), { ease: true });
      P.yaw = h.yaw + PI / 2 - 0.2; P.pitch = -0.2;
      objective('Ride in · clear the rooftops from the door', L.points.lz, 'LZ Iron');
      this.s.riders = spawnGroup([['militia', -62, 98, 0.5], ['militia', -55, 106, 0.2], ['militia', -46, 82, -1], ['rpg', -52, 90, -0.6], ['militia', -60, 50, 2], ['militia', -96, 104, 1]], 'ride');
      for (const e of this.s.riders) e.becomeAware(P.body.pos, true);
      say('ride', [[D61, 'Dust Six-One, feet wet… well, feet dry. Two minutes to LZ Iron.'], [OK, 'Nomad, you\'re on the door. Anything on a rooftop with a rifle is fair game.'], [D61, 'Taking fire, ten o\'clock low!']]);
      CF.HUD.phaseCard(num(0), TITLES[0], 'LZ Iron · outskirts of Dar Masir · first light');
      this.later(3, () => CF.HUD.hint('You can shoot from the helicopter · look and fire as normal'));
    },
    landed() {
      const S = ST(), h = this.s.heli, P = hp();
      h.unboard();
      const out = h.seat(new THREE.Vector3()); out.x -= Math.cos(h.yaw) * 1.6; out.z += Math.sin(h.yaw) * 1.6;
      const y = W.navHeight(out.x, out.z);
      P.body.pos.set(out.x, isNaN(y) ? 0 : y, out.z); P.body.vel.set(0, 0, 0);
      squad(out.x, out.z, h.yaw);
      S.gatherAllies(out.x, out.z, P.yaw);
      say('landed', [[D61, 'Wheels down. Out, out, out!'], [OK, 'Spread out. Push to the road.']]);
      this.later(4, () => { h.fly([[-78, 20, 92], [-120, 45, 130], [-220, 70, 200]], 22, () => { ST().removeHeli(h); this.s.heli = null; }); });
      this.phase.ground.call(this, 'lz', true);
      CF.Game.saveCheckpoint({ x: P.body.pos.x, y: P.body.pos.y, z: P.body.pos.z, yaw: P.yaw });
    },
    ground(stage, fromRide) {
      const S = ST();
      if (!fromRide) { squad(hp().body.pos.x, hp().body.pos.z, hp().yaw); S.gatherAllies(hp().body.pos.x, hp().body.pos.z, hp().yaw); }
      MS.st.stage = stage === 'checkpoint' ? 'checkpoint' : 'lz';
      if (MS.st.stage === 'lz') {
        const left = (this.s.riders || []).filter((e) => e.alive);
        this.s.group = left.concat(spawnGroup([['militia', -60, 84, 2.4], ['militia', -52, 100, 2], ['militia', -66, 74, 0.8]], 'lz'));
        for (const e of this.s.group) e.becomeAware(hp().body.pos, false);
        objective('Secure LZ Iron', L.points.lz, 'LZ');
        this.later(2, () => CF.HUD.hint('Hold ' + CF.Keys.label('sprint') + ' to sprint · ' + CF.Keys.label('crouch') + ' to crouch'));
        this.later(8, () => CF.HUD.hint(CF.Keys.label('lean') + ' + A / D to lean out of cover'));
      } else this.phase.checkpoint.call(this);
    },
    checkpoint() {
      MS.st.stage = 'checkpoint';
      this.s.group = spawnGroup([['militia', -52, 64, PI / 2], ['militia', -50, 68.5, PI / 2], ['gunner', -47, 66, PI / 2], ['militia', -57, 62, 1.2, [[-57, 62], [-57, 70]]], ['militia', -45, 58, 2], ['rpg', -58, 58, 1.8]], 'cp');
      objective('Clear the militia checkpoint', L.points.checkpoint, 'Checkpoint');
      say('cp', [[OK, 'Checkpoint on the road, sandbags and a machine gun. Flank it through the farmsteads if you can.']]);
    },
    update() {
      const s = this.s, stage = MS.st.stage;
      if (stage === 'lz' && s.group) {
        const n = aliveOf(s.group);
        CF.HUD.setProgress(1 - n / s.group.length, (s.group.length - n) + ' / ' + s.group.length + ' down');
        if (n <= 2) markNearest(s.group, 'Hostile');
        if (n === 0 && !s.lzDone) { s.lzDone = true; award('LZ secure', 250); say('lzOk', [[OK, 'LZ is ours. Checkpoint next, on the road east.']]); this.later(1.5, () => { this.phase.checkpoint.call(this); const P = hp().body.pos; CF.Game.saveCheckpoint({ x: P.x, y: P.y, z: P.z, yaw: hp().yaw }); }); }
      } else if (stage === 'checkpoint' && s.group) {
        const n = aliveOf(s.group);
        CF.HUD.setProgress(1 - n / s.group.length, (s.group.length - n) + ' / ' + s.group.length + ' down');
        if (n <= 2) markNearest(s.group, 'Hostile');
        if (n === 0 && s.doneT == null) { s.doneT = 3; say('cpOk', [[OK, 'Checkpoint clear. Road into the city is open.'], [AN, 'Good work, Sabre. Push into the souk.']]); }
      }
    }
  });
  // ======== 02 CONTACT
  PH.push({
    id: 'contact', num: num(1), title: TITLES[1],
    cp: () => L.points.cp.contact,
    enter() {
      const st = MS.st.stage, P = hp();
      squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st === 'square') return this.phase.square.call(this);
      MS.st.stage = 'souk';
      CF.HUD.phaseCard(num(1), TITLES[1], 'Souk al-Masir · push north to Clocktower Square');
      this.s.group = spawnGroup([['militia', -26, 58, 0], ['militia', -28.5, 52, 0.3], ['militia', -23, 47, -0.2], ['gunner', -26, 40, 0], ['militia', -24, 44, 0.1], ['rpg', -28, 36, 0.2]], 'souk');
      this.spawner = { t: 12, interval: [6, 9], maxAlive: 7, zones: ['souk'], pool: ['militia', 'militia', 'militia', 'rpg'], remaining: 8 };
      objective('Push through the souk to the square', L.points.soukTop, 'Square');
      say('souk', [[OK, 'Stalls, balconies, rooftops. Check your corners.']]);
    },
    square() {
      MS.st.stage = 'square';
      const s = this.s;
      s.group = spawnGroup([['militia', -16, 20, 0], ['militia', -4, 16, 0.4], ['militia', 4, 28, 0.2], ['gunner', -2, 12, 0], ['militia', 6, 18, -0.3], ['rpg', -20, 12, 0.5], ['militia', 8, 10, 0]], 'sq');
      s.sniper = spawn('sniper', -9, 20, { y: 17.6, yaw: 0, tag: 'sq' }); s.group.push(s.sniper);
      for (const e of s.group) e.becomeAware(hp().body.pos, false);
      s.techT = 8;
      this.spawner = { t: 14, interval: [7, 10], maxAlive: 8, zones: ['square'], pool: ['militia', 'militia', 'rpg'], remaining: 6 };
      objective('Take Clocktower Square', L.points.square, 'Square');
      say('sq', [[OK, 'Square\'s full of them. Sniper in the clock tower! Watch for the glint.']]);
      const pk = L.addPickup('weapon', -25, 0, 30, { weapon: 'rocket' }); pk.dropped = true; CF.Game.makePickupMesh(pk);
    },
    update(dt) {
      const s = this.s, P = hp().body.pos;
      if (MS.st.stage === 'souk') {
        const n = aliveOf(s.group);
        CF.HUD.setProgress(null, '');
        if (P.z < 36 && P.x > -32) { award('Souk cleared', 250); this.spawner = null; this.phase.square.call(this); CF.Game.saveCheckpoint(L.points.cp.soukTop); }
        else if (n <= 1 && P.z < 44) CF.HUD.objTarget = L.points.soukTop;
      } else if (MS.st.stage === 'square') {
        if (s.techT != null) { s.techT -= dt; if (s.techT <= 0) { s.techT = null; s.tech = technical([[0, -40], [0, -8], [0, 6], [-6, 16], [-14, 24]], 'sq'); s.group.push(s.tech); say('tech', [[OK, 'Technical coming up from the south road!'], [OK, 'There\'s an RPG by the souk entrance. Or put the gunner down.']]); } }
        const n = aliveOf(s.group);
        CF.HUD.setProgress(1 - n / s.group.length, (s.group.length - n) + ' / ' + s.group.length + ' down');
        if (n <= 3) markNearest(s.group, s.tech && s.tech.alive && !s.tech.gunnerDead ? 'Technical' : 'Hostile');
        if (n === 0 && s.techT == null && s.doneT == null) {
          s.doneT = 5; this.spawner = null;
          say('sqOk', [[OK, 'Square is clear.'], [AN, 'Sabre, drones followed the guards from the square to a walled villa on the north side. It\'s Kaal\'s.'], [AN, 'Pull back to the LZ. Tonight we go for the ledger.']]);
        }
      }
    }
  });
  // ======== 03 GHOST PROTOCOL (stealth)
  const GUARDS = [ // type, x, z, yaw, patrol, y
    ['guard', -70, -48, 0, [[-70, -48], [-54, -48], [-54, -56]]],
    ['guard', -82, -70, -PI / 2, [[-82, -69], [-92, -69], [-92, -78], [-86, -80]]],
    ['guard', -62, -70, PI / 2, [[-58, -70], [-50, -70], [-50, -84], [-58, -92]]],
    ['guard', -78, -96, 0, [[-90, -97], [-58, -97]]],
    ['guard', -86, -52, 0, [[-86, -52], [-78, -52], [-78, -58]]],
    ['guard', -48, -100, PI * 0.75, null, 4.7],
    ['guard', -92, -49, PI * 0.25, null, 4.7],
    ['guard', -76, -86, 0, [[-77, -86], [-77, -76], [-74, -76]]],
    ['guard', -66, -76, PI, null],
    ['guard', -52, -62, -PI / 2, [[-52, -62], [-52, -74]]]
  ];
  PH.push({
    id: 'ghost', num: num(2), title: TITLES[2],
    cp: () => L.points.cp.ghost,
    enter() {
      const st = MS.st;
      CF.Streak.off = true; CF.Streak.hud(); ST().holdFire = true;
      if (st.stage === 'start') { st.stage = 'approach'; st.ghost = true; st.silent = 0; st.dead = []; st.kaal = false; }
      this.s.guards = GUARDS.map((g, i) => {
        if (st.dead.includes(i)) return null;
        const e = spawn(g[0], g[1], g[2], { yaw: g[3], patrol: g[4] ? g[4].map((p) => p.slice()) : null, y: g[5], keepCorpse: true, tag: 'guard' });
        e.gi = i; e.torchOn = true;
        return e;
      }).filter(Boolean);
      if (!st.kaal) { this.s.kaal = spawn('officer', -66, -87.2, { yaw: 0, keepCorpse: true, tag: 'kaal', y: 0.3 }); this.s.kaal.hvt = true; }
      if (st.stage === 'approach') { objective('Get into the villa through the culvert', L.points.villa.culvert, 'Culvert'); CF.HUD.phaseCard(num(2), TITLES[2], 'Stay unseen · suppressed weapons · takedowns from behind'); say('ghost', [[OK, 'I have eyes on the villa. Ten guards, torches, two towers. Culvert\'s on the west wall, crouch to get through.']]); this.later(4, () => CF.HUD.hint('Crouch to stay quiet · ' + CF.Keys.label('melee') + ' from behind is a silent takedown')); }
      else if (st.stage === 'grounds') this.phase.grounds.call(this);
      else if (st.stage === 'ledger') this.phase.ledger.call(this);
      else if (st.stage === 'exfil') this.phase.exfil.call(this);
      this.s.alarmT = null; this.s.scanT = 0;
      ST().stealthHud(true, 0, 'Hidden');
    },
    grounds() { MS.st.stage = 'grounds'; objective('Find Colonel Kaal in the main house', L.points.villa.study, 'Kaal'); },
    ledger() { MS.st.stage = 'ledger'; find('ledger').enabled = true; objective('Copy the ledger on Kaal\'s desk', L.points.villa.study, 'Ledger'); },
    exfil() { MS.st.stage = 'exfil'; objective('Exfil through the culvert', L.points.villa.exfil, 'Exfil'); },
    raiseAlarm() {
      const st = MS.st;
      if (this.s.alarm) return;
      this.s.alarm = true; st.ghost = false; this.s.alarmT = null;
      CF.HUD.hint('ALARM RAISED', true); A.play('warning', null, { ui: true });
      if (CF.Game.audioOn) { MS.siren = A.loop('siren', { x: -72, y: 6, z: -80 }); if (MS.siren) MS.siren.set(0.35, 0.3); }
      for (const e of CF.Enemies.list) if (e.alive && e.tag === 'guard') e.becomeAware(hp().body.pos, false);
      this.spawner = { t: 5, interval: [6, 9], maxAlive: 9, zones: ['villa'], pool: ['guard', 'guard', 'militia'], remaining: 8 };
      say('alarm', [[OK, 'That\'s the alarm. Forget quiet, Nomad.'], [MG, 'An assassin in my house? Guards! Bring the car around!']]);
      const k = this.s.kaal;
      if (k && k.alive) {
        const route = [[-63.6, -86.8], [-63.6, -82.5], [-65, -81], [-65, -78.5], [-70, -75], [-72.8, -73.6], [-73.4, -71.6], [-74, -69], [-80.5, -69], [-80.5, -64], [-86.4, -59.2]]; // ends at the driver's door
        let ri = 0;
        k.brain = (dt) => { // run for the car
          const b = k.body, tg = route[ri];
          if (!tg) { k.moveDir(0, 0, 0, dt); k.physics(dt); k.pose(dt, 0); return; }
          const dx = tg[0] - b.pos.x, dz = tg[1] - b.pos.z, l = Math.hypot(dx, dz);
          if (l < 0.7) ri++;
          k.moveDir(dx / (l || 1), dz / (l || 1), 4.2, dt, true); k.physics(dt); k.pose(dt, 4.2);
        };
        k.route = route; k.fleeIdx = () => ri;
        objective('Kaal is running for his car · stop him', k.body.pos, 'Kaal');
      }
    },
    update(dt) {
      const s = this.s, st = MS.st, P = hp(), pp = P.body.pos;
      // how visible you are: dark by default, lit near the lamps that are burning
      let lit = 0;
      for (const lp of L.points.nightLamps) if (lp.on) { const d = lp.pos.distanceTo(pp); if (d < lp.distance * 0.5) lit = Math.max(lit, 1 - d / (lp.distance * 0.5)); }
      CF.Enemies.sightMul = 0.5 + lit * 0.55;
      s.scanT -= dt;
      const scan = s.scanT <= 0; if (scan) s.scanT = 0.3;
      let level = 0, aware = null;
      for (const e of CF.Enemies.list) {
        if (!e.alive || !e.T.human || e.hvt && e.brain) continue;
        if (e.state === 'hunt' || e.state === 'combat') { level = 1; aware = e; }
        else level = Math.max(level, e.suspicion || 0);
        // torch beam on you: they see you far quicker
        if (e.torchOn && (e.state === 'idle' || e.state === 'patrol') && e.tag === 'guard') {
          const dx = pp.x - e.body.pos.x, dz = pp.z - e.body.pos.z, d = Math.hypot(dx, dz);
          if (d < 13 && ((-Math.sin(e.yaw)) * dx + (-Math.cos(e.yaw)) * dz) / (d || 1) > 0.94 && W.segmentClear(e.body.pos.x, e.body.pos.y + 1.5, e.body.pos.z, pp.x, pp.y + 1.2, pp.z)) {
            e.suspicion = Math.min(1, (e.suspicion || 0) + dt * 1.6); e.suspectPos = pp.clone(); if (e.suspicion >= 1) e.becomeAware(pp);
          }
        }
        // bodies: a guard who sees a fallen comrade comes looking
        if (scan && (e.state === 'idle' || e.state === 'patrol')) {
          for (const c of CF.Enemies.list) {
            if (c.alive || !c.T.human || c.found) continue;
            const dx = c.body.pos.x - e.body.pos.x, dz = c.body.pos.z - e.body.pos.z, d = Math.hypot(dx, dz);
            if (d > 11 || ((-Math.sin(e.yaw)) * dx + (-Math.cos(e.yaw)) * dz) / (d || 1) < 0.3) continue;
            if (!W.segmentClear(e.body.pos.x, e.body.pos.y + 1.5, e.body.pos.z, c.body.pos.x, c.body.pos.y + 0.4, c.body.pos.z)) continue;
            c.found = true; e.becomeAware(c.body.pos); A.play('shout', e.body.pos, { ref: 8 });
            CF.HUD.hint('A guard found a body', true);
          }
        }
      }
      // spotted: a few seconds to silence them before the alarm
      if (!s.alarm) {
        if (aware) {
          if (s.alarmT == null) { s.alarmT = 4.5 / CF.diff().aggro; A.play('warning', null, { ui: true, vol: 0.5 }); }
          s.alarmT -= dt;
          CF.HUD.hint('Spotted · silence them before they raise the alarm · ' + Math.max(0, s.alarmT).toFixed(1), true);
          if (s.alarmT <= 0) this.phase.raiseAlarm.call(this);
        } else if (s.alarmT != null) { s.alarmT = null; CF.HUD.hint('Lost you'); }
      }
      ST().stealthHud(true, s.alarm ? 1 : level, s.alarm ? 'Alarm' : aware ? 'Spotted' : level > 0.05 ? 'Suspicious' : lit > 0.2 ? 'Hidden · lit' : 'Hidden');
      ST().updateMarks(true);
      // Kaal escaping
      const k = s.kaal;
      if (k && k.alive && k.brain && k.fleeIdx() >= k.route.length) { CF.Game.fail('Colonel Kaal escaped'); return; }
      if (k && k.alive && k.brain) CF.HUD.objTarget = k.body.pos;
      // stages
      if (st.stage === 'approach' && pp.x > -95.5 && pp.z < -45 && pp.z > -104) { this.phase.grounds.call(this); award('Inside the walls', 150); CF.Game.saveCheckpoint(L.points.cp.villaIn); }
      if (st.stage === 'grounds' && pp.x > -84 && pp.x < -60 && pp.z > -90 && pp.z < -72 && !s.inHouse) { s.inHouse = true; objective('Eliminate Colonel Kaal', k && k.alive ? k.body.pos : L.points.villa.study, 'Kaal'); }
      if ((st.stage === 'grounds') && k && !k.alive && !st.kaal) {
        st.kaal = true;
        say('kaalDead', [[OK, s.alarm ? 'Kaal is down. Get that ledger, they\'re coming.' : 'Kaal is down. Nobody heard a thing. Ledger\'s on his desk.']]);
        award('Colonel Kaal eliminated', 1000);
        this.phase.ledger.call(this);
        CF.Game.saveCheckpoint({ x: pp.x, y: pp.y, z: pp.z, yaw: P.yaw });
      }
      if (st.stage === 'exfil' && near(pp, L.points.villa.exfil.x, L.points.villa.exfil.z, 4) && s.doneT == null) {
        s.doneT = 2.5;
        if (st.ghost) { award('Ghost · never detected', 2500); say('ghostOk', [[OK, 'In and out and nobody knew. That\'s a ghost, Nomad.']]); }
        if (st.silent) award('Silent takedowns · ' + st.silent, 100 * st.silent);
        say('exfilOk', [[AN, 'Ledger received. Lantern is in Qasr al-Hadid. We hit it at dawn.']]);
      }
    },
    exit() { CF.Enemies.sightMul = 1; ST().stealthHud(false); ST().updateMarks(false); CF.Streak.off = false; ST().holdFire = false; if (MS.siren) { MS.siren.stop(); MS.siren = null; } }
  });
  // ======== 04 BREACH
  PH.push({
    id: 'breach', num: num(3), title: TITLES[3],
    cp: () => L.points.cp.breach,
    enter() {
      const st = MS.st, P = hp();
      squad(P.body.pos.x, P.body.pos.z, P.yaw); ST().gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') { st.stage = 'gate'; st.freed = []; }
      const stg = st.stage;
      if (stg !== 'gate') blowDoor('fortGate');
      if (stg === 'cells' || stg === 'pad') blowDoor('blockDoor');
      for (const i of st.freed) openCell(i, true);
      if (stg === 'gate') {
        find('gateCharge').enabled = true;
        objective('Plant a breaching charge on the fort gate', L.points.fort.gate, 'Gate');
        this.s.group = spawnGroup([['militia', 66, -52, 0], ['militia', 80, -53, 0.3], ['rpg', 60, -56, 0.4], ['militia', 42, -40, -0.5, [[42, -40], [42, -30]]]], 'wall');
        CF.HUD.phaseCard(num(3), TITLES[3], 'Qasr al-Hadid · breach and clear · bring them home');
        say('breach', [[OK, 'Charge on the gate, then stack up. Watch the wall walk.']]);
      } else if (stg === 'courtyard') this.phase.courtyard.call(this);
      else if (stg === 'block') this.phase.block.call(this);
      else if (stg === 'cells') this.phase.cells.call(this);
      else if (stg === 'pad') this.phase.pad.call(this);
    },
    courtyard() {
      MS.st.stage = 'courtyard';
      this.s.group = spawnGroup([['militia', 66, -62, 0], ['militia', 80, -64, 0.2], ['gunner', 70, -76, 0], ['militia', 84, -56, 0.4], ['militia', 60, -54, -0.5], ['rpg', 90, -70, 0.6], ['militia', 76, -80, 0], ['militia', 58, -84, 0.2], ['gunner', 88, -80, 0.5]], 'yard');
      for (const e of this.s.group) e.becomeAware(hp().body.pos, false);
      this.spawner = { t: 10, interval: [5, 8], maxAlive: 9, zones: ['fortIn', 'fort'], pool: ['militia', 'militia', 'rpg'], remaining: 6 };
      objective('Clear the courtyard', L.points.fort.pad, 'Courtyard');
    },
    block() {
      MS.st.stage = 'block';
      find('blockCharge').enabled = true;
      objective('Breach the cell block', L.points.fort.blockDoor, 'Cell block');
      say('block', [[OK, 'Cell block door, north side. Same again.']]);
    },
    cells() {
      MS.st.stage = 'cells';
      const S = ST();
      this.s.inside = spawnGroup([['militia', 60, -90, -PI / 2], ['militia', 88, -89, PI / 2], ['guard', 80, -90, PI / 2]], 'block');
      this.s.pows = [];
      MAP().cells.forEach((c, i) => {
        const freed = MS.st.freed.includes(i);
        const a = pow(i, c.x, c.z, { follow: freed, crouch: freed ? 0 : 0.8, yaw: PI });
        if (!freed) { a.hold = { x: c.x, y: 0, z: c.z }; find('cell' + (i + 1)).enabled = true; }
        this.s.pows.push(a);
      });
      objective('Free the prisoners', MAP().cells[0], 'Cells');
    },
    pad() {
      MS.st.stage = 'pad';
      const S = ST();
      if (!this.s.pows) { this.s.pows = MAP().cells.map((c, i) => pow(i, c.x, c.z, { follow: true })); S.gatherAllies(hp().body.pos.x, hp().body.pos.z, hp().yaw); }
      const pad = L.points.fort.pad;
      this.s.heli = S.addHeli(74, 60, 40, PI, D62);
      this.s.heli.fly([[74, 45, -10], [74, 18, -55], [74, 6, -68], [74, 0.05, -70]], 16, () => {
        this.s.landed = true; say('d62down', [[D62, 'Six-Two on the pad. Load them up!']]);
        ST().allies.forEach((a, k) => { a.hold = { x: 71.5 - (k % 2) * 1.2, y: 0, z: -71 + Math.floor(k / 2) * 1.1 }; });
      });
      this.spawner = { t: 4, interval: [4, 6.5], maxAlive: 7, zones: ['fort'], pool: ['militia', 'militia', 'rpg'], remaining: 999 };
      objective('Get the prisoners to the helipad', pad, 'Dust 6-2');
      say('pad', [[D62, 'Dust Six-Two, two minutes out from the fort.'], [OK, 'Prisoners on me. Move to the pad!']]);
    },
    update(dt) {
      const s = this.s, st = MS.st, pp = hp().body.pos;
      if (st.stage === 'courtyard') {
        const n = aliveOf(s.group); CF.HUD.setProgress(1 - n / s.group.length, (s.group.length - n) + ' / ' + s.group.length + ' down');
        if (n <= 2) markNearest(s.group, 'Hostile');
        if (n === 0 && !s.yardDone) { s.yardDone = true; this.spawner = null; award('Courtyard clear', 400); this.phase.block.call(this); CF.Game.saveCheckpoint(L.points.cp.courtyard); }
      } else if (st.stage === 'cells') {
        const c = MAP().cells.find((x, i) => !st.freed.includes(i)); if (c) CF.HUD.objTarget = { x: c.x, y: 0, z: -92 };
        CF.HUD.setProgress(st.freed.length / 4, st.freed.length + ' / 4 freed');
      } else if (st.stage === 'pad' && s.heli) {
        const pad = L.points.fort.pad, pows = s.pows || [];
        const all = pows.every((a) => near(a.body.pos, pad.x, pad.z, s.landed ? 5 : 12)), me = near(pp, pad.x, pad.z, 6);
        CF.HUD.setProgress(null, s.landed ? (all ? 'Board the helicopter' : 'Waiting for the prisoners') : 'Dust 6-2 inbound');
        if (s.landed && me && all && s.doneT == null) {
          s.doneT = 1.2; this.spawner = null;
          for (const e of CF.Enemies.list) if (e.alive) { e.noScore = true; e.hp = 0; e.die({}); }
          say('boarded', [[D62, 'Everyone\'s aboard! Lifting!'], [SR, 'Captain Serrano, Lantern actual. Whoever you are, thank you.']]);
        }
      }
    }
  });
  // ======== 05 SHOT DOWN
  PH.push({
    id: 'shotdown', num: num(4), title: TITLES[4],
    cp: () => L.points.cp.crash,
    enter() {
      const st = MS.st;
      if (st.stage === 'start' || st.stage === 'flight') return this.phase.flight.call(this);
      wreck(); this.phase.ground.call(this, st.stage);
    },
    flight() {
      const S = ST(), P = hp();
      MS.st.stage = 'flight';
      ST().letterbox(true);
      const h = this.s.heli = S.addHeli(74, 0.05, -70, PI, D62);
      h.board(P); P.yaw = h.yaw + PI / 2; P.pitch = -0.1;
      h.fly([[74, 14, -62], [66, 30, -46], [44, 30, -34], [28, 28, -30]], 8.5, null, { ease: false });
      CF.HUD.phaseCard(num(4), TITLES[4], 'Over central Dar Masir');
      spawnGroup([['militia', 20, -40, 0], ['militia', 30, -44, 0], ['rpg', 10, -38, 0.3], ['militia', -4, -40, 0]], 'av').forEach((e) => e.becomeAware(P.body.pos, true));
      this.later(9.5, () => {
        // the hit: a rocket streaks up from the avenue and takes the tail
        const from = new THREE.Vector3(6, 2, -36), to = h.pos.clone().add(new THREE.Vector3(0, 3, 6));
        CF.FX.tracer(from, to, { speed: 90, len: 6, w: 0.08, r: 4, g: 2, b: 0.6 });
        for (let i = 0; i < 20; i++) { const k = i / 20; CF.FX.smoke.spawn(U.lerp(from.x, to.x, k), U.lerp(from.y, to.y, k), U.lerp(from.z, to.z, k), 0, 0.3, 0, 2.5, 0.4, 1.5, 0.5, 0.48, 0.45, 0.6, -0.1, 0.5, 1); }
        A.play('rocket', from, { ref: 10 });
      });
      this.later(10.4, () => {
        A.play('heliHit', null, { ui: false, vol: 1 }); CF.FX.explosion(h.pos.clone().add(new THREE.Vector3(0, 3, 5)), 1.2); hp().shake(0.9); A.concuss(0.5);
        h.smoke = 1; h.wobble = 0.12; h.spinYaw = 1.6; CF.HUD.flash(0.4);
        say('hit', [[D62, 'RPG! RPG! We\'re hit, lost the tail rotor!'], [D62, 'Six-Two going down, going down in the city!'], [SR, 'Hold on to something!']]);
        h.fly([[24, 22, -30], [18, 12, -27], [14, 3, -27], [13, -0.3, -27]], 12, () => this.phase.crashed.call(this), { ease: false });
        CF.Game.slowMo(0.5, 2);
      });
    },
    crashed() {
      const S = ST(), h = this.s.heli, P = hp();
      A.play('crash', null, { vol: 1.2 }); CF.FX.explosion(h.pos.clone().add(new THREE.Vector3(0, 1, 0)), 1.6); P.shake(1); A.concuss(1);
      CF.Post.setState({ fade: 0 });
      h.unboard(); S.removeHeli(h); this.s.heli = null;
      wreck();
      place(L.points.cp.crash); P.eye = 0.4; P.pitch = 0.5;
      this.later(0.3, () => CF.Post.setState({ fade: 0.2 }));
      this.later(2.2, () => { CF.Post.setState({ fade: 1 }); ST().letterbox(false); });
      this.later(2.4, () => { this.phase.ground.call(this, 'pilot'); CF.Game.saveCheckpoint(L.points.cp.crash); });
      MS.st.stage = 'down';
    },
    ground(stage) {
      const S = ST(), P = hp(), c = L.points.crash;
      S.addAlly('friendly', 'SSgt. Okafor', -3, -20, { seed: 7, slot: 0, shoots: true, dmg: 12, follow: false }).hold = { x: -3, y: 0, z: -20 };
      S.addAlly('friendly', 'Cpl. Duarte', 1, -29, { seed: 8, slot: 1, shoots: true, dmg: 10, follow: false }).hold = { x: 1, y: 0, z: -29 };
      this.s.pows = [0, 1, 2, 3].map((i) => { const a = pow(i, -2 + i * 1.3, -26.5, { follow: false, crouch: 0.8, yaw: PI / 2 }); a.hold = { x: -2 + i * 1.3, y: 0, z: -26.5 }; return a; });
      if (stage === 'pilot' || stage === 'down') {
        MS.st.stage = 'pilot'; find('pilot').enabled = true;
        objective('Pull the pilot out of the wreck', find('pilot').pos, 'Pilot');
        say('down', [[OK, 'Nomad! You with me? Sound off!'], [SR, 'Lantern\'s all here. Banged up, but here.'], [OK, 'Pilot\'s trapped in the cockpit. Get him out, we\'ll cover you!']]);
        this.spawner = { t: 5, interval: [4, 6.5], maxAlive: 7, zones: ['crash'], pool: ['militia', 'militia', 'militia', 'rpg'], remaining: 999 };
      } else this.phase.hold.call(this);
      const pk = L.addPickup('weapon', c.x - 4.2, 0, c.z + 2, { weapon: 'minigun' }); pk.dropped = true; CF.Game.makePickupMesh(pk);
      this.later(6, () => { if (!CF.Weapons.inv.minigun) CF.HUD.hint('The door gun survived the crash · grab it from the wreck'); });
    },
    hold() {
      MS.st.stage = 'hold';
      const S = ST(), c = L.points.crash;
      if (!S.ally(KD)) { const k = unarmed(S.addAlly('friendly', KD, 3, -27.5, { seed: 12, slot: 6, follow: false })); k.hold = { x: 3.2, y: 0, z: -27.5 }; k.crouch = 0.8; }
      this.s.hold = 90; this.s.total = 90;
      this.spawner = { t: 2, interval: [3, 5], maxAlive: 9, zones: ['crash'], pool: ['militia', 'militia', 'gunner', 'rpg'], remaining: 999 };
      this.s.techAt = [60, 25];
      objective('Hold the crash site', c, 'Wreck');
      say('hold', [[AN, 'Sabre, Anvil. We can\'t get a bird to you under that fire. Hold on while we find you a way out.'], [OK, 'Everyone into the wreck\'s shadow. Nomad, you\'re our eyes.']]);
    },
    onTask(it) {
      if (it.id === 'pilot' && MS.st.stage === 'pilot') {
        it.enabled = false; award('Pilot recovered', 300);
        say('pilot', [[KD, 'Chief Warrant Officer Kade. My legs work… mostly. Thanks for the lift.']]);
        this.phase.hold.call(this);
        CF.Game.saveCheckpoint(L.points.cp.crash);
      }
    },
    update(dt) {
      const s = this.s;
      if (MS.st.stage === 'hold') {
        s.hold -= dt;
        CF.HUD.countdown('Hold the crash site', s.hold);
        if (s.techAt.length && s.hold < s.techAt[0]) { s.techAt.shift(); technical(s.techAt.length ? [[4, -60], [4, -40], [4, -34]] : [[-40, -40], [-14, -40], [-13, -28]], 'crash'); say('tech' + s.techAt.length, [[OK, 'Technical on the avenue!']]); }
        if (s.hold <= 0 && s.doneT == null) {
          CF.HUD.countdown(null, null); this.spawner = null; s.doneT = 4;
          say('holdOk', [[AN, 'Sabre, listen. Nobody can land in that district. You have to walk out.'], [AN, 'There\'s a walled school east of the boulevard. Get there with everyone.'], [OK, 'You heard him. Nobody gets left.']]);
        }
      }
    },
    exit() { CF.HUD.countdown(null, null); }
  });
  // ======== 06 THE LONG WALK
  PH.push({
    id: 'longwalk', num: num(5), title: TITLES[5],
    cp: () => L.points.cp.longwalk,
    enter() {
      const S = ST(), P = hp(), st = MS.st;
      wreck();
      squad(P.body.pos.x, P.body.pos.z, P.yaw);
      unarmed(S.addAlly('friendly', KD, P.body.pos.x + 1, P.body.pos.z + 3, { seed: 12, slot: 6 }));
      this.s.pows = [0, 1, 2, 3].map((i) => pow(i, P.body.pos.x - 1 + i, P.body.pos.z + 4));
      S.gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') st.stage = 'cross';
      CF.HUD.phaseCard(num(5), TITLES[5], 'Fighting withdrawal · keep the prisoners with you');
      this.phase[st.stage].call(this);
    },
    cross() {
      MS.st.stage = 'cross';
      this.s.group = spawnGroup([['gunner', 34, -8, -PI / 2], ['militia', 37, -12, -PI / 2], ['militia', 33, -32, 0], ['rpg', 44, -22, PI / 2]], 'blvd');
      this.s.tech = technical([[35, 60], [35, 20], [35, 0], [35, -12]], 'blvd'); this.s.group.push(this.s.tech);
      this.spawner = { t: 8, interval: [5, 8], maxAlive: 7, zones: ['walk'], pool: ['militia', 'militia', 'rpg'], remaining: 10 };
      objective('Cross the boulevard', { x: 45, y: 0, z: -20 }, 'Boulevard');
      say('cross', [[OK, 'Boulevard\'s a kill zone. Put that machine gun down, then we all cross together.']]);
    },
    bazaar() {
      MS.st.stage = 'bazaar';
      this.s.group = spawnGroup([['militia', 55, 6, PI], ['militia', 56.5, 12, PI], ['militia', 53.5, 18, PI], ['gunner', 55, 26, PI]], 'baz');
      this.spawner = { t: 12, interval: [7, 10], maxAlive: 5, zones: ['walk'], pool: ['militia', 'militia'], remaining: 6 };
      objective('Move through the covered bazaar', { x: 55, y: 0, z: 24 }, 'Bazaar');
      say('bazaar', [[OK, 'Covered market heading south. Tight in there. Shotgun range.']]);
    },
    court() {
      MS.st.stage = 'court';
      this.spawner = { t: 4, interval: [5, 8], maxAlive: 6, zones: ['court'], pool: ['militia', 'militia', 'rpg'], remaining: 6 };
      objective('Get everyone into the school compound', L.points.court, 'School');
      say('courtGo', [[AN, 'School\'s at the end of the lane, west gate. Go.']]);
    },
    update() {
      const s = this.s, st = MS.st, pp = hp().body.pos, pows = s.pows || [];
      const straggle = pows.some((a) => a.body.pos.distanceTo(pp) > 26);
      if (straggle) CF.HUD.hint('The prisoners are falling behind · wait for them', true);
      if (st.stage === 'cross') {
        if (s.group) { const n = aliveOf(s.group); if (n <= 2) markNearest(s.group, 'Hostile'); }
        if (pp.x > 42 && pp.z < -14 && !straggle) { award('Across the boulevard', 300); this.phase.bazaar.call(this); CF.Game.saveCheckpoint(L.points.cp.bazaar); }
      } else if (st.stage === 'bazaar') {
        if (pp.z > 22 && pp.x > 51 && !straggle) { award('Through the bazaar', 300); this.phase.court.call(this); CF.Game.saveCheckpoint({ x: 55, y: 0, z: 22, yaw: PI }); }
      } else if (st.stage === 'court') {
        const inCourt = (p) => p.x > 58.5 && p.x < 87.5 && p.z > 22.5 && p.z < 49.5;
        const n = pows.filter((a) => inCourt(a.body.pos)).length;
        CF.HUD.setProgress(n / 4, n + ' / 4 prisoners inside');
        if (inCourt(pp) && n === 4 && s.doneT == null) { s.doneT = 2; this.spawner = null; say('inCourt', [[OK, 'Everyone\'s in. Close it up.'], [AN, 'Good. Now you hold.']]); }
      }
    }
  });
  // ======== 07 LAST BLOCK
  PH.push({
    id: 'lastblock', num: num(6), title: TITLES[6],
    cp: () => L.points.cp.lastblock,
    enter() {
      const S = ST(), st = MS.st;
      S.addAlly('friendly', 'SSgt. Okafor', 60, 27, { seed: 7, shoots: true, dmg: 13 }).hold = { x: 60, y: 0, z: 27 };
      S.addAlly('friendly', 'Cpl. Duarte', 70, 48, { seed: 8, shoots: true, dmg: 11 }).hold = { x: 70, y: 0, z: 47.5 };
      const k = unarmed(S.addAlly('friendly', KD, 74, 38, { seed: 12 })); k.hold = { x: 75, y: 0, z: 37.4 }; k.crouch = 0.8;
      for (let i = 0; i < 4; i++) { const a = pow(i, 66 + i * 1.6, 37.4); a.hold = { x: 66 + i * 1.6, y: 0, z: 37.4 }; a.crouch = 0.8; }
      if (st.stage === 'start') st.stage = 'wave1';
      this.s.wave = +st.stage.slice(4) || 1;
      this.s.t = 0; this.s.total = 170; this.s.time = this.s.total - (this.s.wave - 1) * 55;
      this.phase.startWave.call(this, this.s.wave);
      objective('Hold the compound', L.points.court, 'School');
      CF.HUD.phaseCard(num(6), TITLES[6], 'Hold until the relief column breaks through');
      if (!CF.Weapons.inv.rail) CF.Weapons.give('rail', true);
    },
    startWave(w) {
      const s = this.s; s.wave = w; MS.st.stage = 'wave' + w;
      const pools = [['militia', 'militia', 'militia', 'rpg'], ['militia', 'militia', 'gunner', 'rpg', 'rpg'], ['militia', 'gunner', 'gunner', 'rpg', 'militia']];
      this.spawner = { t: 3, interval: [2.6 - w * 0.3, 4.4 - w * 0.5], maxAlive: 7 + w * 2, zones: ['court'], pool: pools[w - 1], remaining: 999 };
      if (w === 2) { technical([[104, 37], [96, 37], [92, 37]], 'wave'); say('w2', [[OK, 'Technical at the east wall! RPG it or kill the gunner!']]); }
      if (w === 3) {
        technical([[55, -20], [55, 12], [55, 20]], 'wave'); technical([[70, 72], [70, 58], [70, 54]], 'wave');
        spawn('sniper', 96, 18, { y: 9.3, yaw: 0.8, tag: 'wave' });
        say('w3', [[OK, 'Two more trucks, west lane and the south gate!'], [SR, 'Sniper on the water tower!']]);
      }
      if (w > 1) CF.Game.saveCheckpoint(L.points.cp.lastblock);
    },
    update(dt) {
      const s = this.s;
      if (s.doneT != null) return;
      s.time -= dt;
      CF.HUD.countdown('Relief column', s.time);
      const el = s.total - s.time;
      if (s.wave === 1 && el > 55) { this.phase.startWave.call(this, 2); say('w2b', [[AN, 'Relief column is two kilometres out. Keep it up.']]); }
      else if (s.wave === 2 && el > 110) { this.phase.startWave.call(this, 3); say('w3b', [[AN, 'They\'re throwing everything at you. One more push.']]); }
      if (s.time <= 0) {
        CF.HUD.countdown(null, null); this.spawner = null; s.doneT = 5;
        for (const e of CF.Enemies.list) if (e.alive && !e.T.vehicle) { e.noScore = true; e.state = 'alert'; }
        say('lbOk', [[AN, 'Relief column has the south end open. The stadium\'s the only LZ big enough for a heavy lift.'], [OK, 'Stadium it is. One more run.']]);
      }
    },
    exit() { CF.HUD.countdown(null, null); }
  });
  // ======== 08 EXTRACTION
  PH.push({
    id: 'extraction', num: num(7), title: TITLES[7],
    cp: () => L.points.cp.extraction,
    enter() {
      const S = ST(), P = hp(), st = MS.st;
      squad(P.body.pos.x, P.body.pos.z, P.yaw);
      unarmed(S.addAlly('friendly', KD, P.body.pos.x, P.body.pos.z - 3, { seed: 12, slot: 6 }));
      this.s.pows = [0, 1, 2, 3].map((i) => pow(i, P.body.pos.x - 1 + i, P.body.pos.z - 4));
      S.gatherAllies(P.body.pos.x, P.body.pos.z, P.yaw);
      if (st.stage === 'start') st.stage = 'run';
      if (st.stage === 'run') {
        this.s.group = spawnGroup([['militia', 70, 62, PI], ['militia', 68, 66, PI], ['gunner', 72, 70, PI], ['rpg', 60, 68, 2.5], ['militia', 76, 74, PI]], 'run');
        this.spawner = { t: 6, interval: [4, 6], maxAlive: 8, zones: ['stadium'], pool: ['militia', 'militia', 'rpg'], remaining: 8 };
        objective('Get to the stadium', L.points.stadium, 'Stadium');
        CF.HUD.phaseCard(num(7), TITLES[7], 'Dar Masir stadium · last bird out');
      } else this.phase.hold.call(this);
    },
    hold() {
      MS.st.stage = 'hold';
      const S = ST(), lz = L.points.stadium;
      for (const a of S.allies) { a.follow = false; a.hold = { x: lz.x + U.rand(-6, 6), y: 0, z: lz.z + U.rand(-3, 6) }; if (a.look === 'pow') a.crouch = 0.8; }
      this.s.hold = 60;
      this.spawner = { t: 2, interval: [2.2, 3.6], maxAlive: 11, zones: ['stadium'], pool: ['militia', 'militia', 'gunner', 'rpg', 'rpg'], remaining: 999 };
      this.s.techs = [45, 25];
      objective('Hold the landing zone', lz, 'LZ');
      say('lzHold', [[D63, 'Six-Three, sixty seconds. Pop smoke when you see me.'], [OK, 'Circle up round the pad! Nothing gets through!']]);
      CF.Game.saveCheckpoint({ x: lz.x, y: 0, z: lz.z - 6, yaw: PI });
    },
    update(dt) {
      const s = this.s, st = MS.st, pp = hp().body.pos, lz = L.points.stadium;
      if (st.stage === 'run') {
        if (s.group) { const n = aliveOf(s.group); if (n <= 2) markNearest(s.group, 'Hostile'); }
        if (pp.z > 72 && pp.x > 45 && pp.x < 105) this.phase.hold.call(this);
      } else if (st.stage === 'hold') {
        s.hold -= dt;
        CF.HUD.countdown('Dust 6-3', s.hold);
        if (s.techs.length && s.hold < s.techs[0]) { s.techs.shift(); technical(s.techs.length ? [[36, 67], [48, 67], [58, 76]] : [[70, 56], [70, 68], [70, 76]], 'lz'); say('lzt' + s.techs.length, [[OK, 'Truck at the gate!']]); }
        if (s.hold < 22 && !s.heli) {
          s.heli = ST().addHeli(160, 70, 180, -2.2, D63);
          s.heli.fly([[110, 40, 120], [86, 18, 96], [77, 5, 89], [76, 0.05, 88]], 22, () => { s.landed = true; say('d63', [[D63, 'Six-Three on the deck! Get aboard, get aboard!']]); for (const a of ST().allies) { a.hold = { x: 76 + U.rand(-1, 1), y: 0, z: 88 + U.rand(-1, 1) }; a.crouch = 0; } });
        }
        if (s.hold <= 0) CF.HUD.countdown(null, null);
        if (s.landed) {
          for (const a of ST().allies) if (a.root.visible && near(a.body.pos, 76, 88, 3.2)) a.root.visible = false;
          const aboard = ST().allies.every((a) => !a.root.visible);
          CF.HUD.setProgress(null, aboard ? 'Everyone else is aboard · get on' : 'Loading…');
          objective(aboard ? 'Board Dust 6-3' : 'Cover the loading', { x: 76, y: 0, z: 88 }, 'Dust 6-3');
          if (aboard && near(pp, 76, 88, 4.5) && !s.leaving) this.phase.leave.call(this);
        }
      }
    },
    leave() {
      const s = this.s, h = s.heli, P = hp();
      s.leaving = true; this.spawner = null; CF.HUD.countdown(null, null);
      h.board(P); ST().letterbox(true);
      CF.Game.godMode = true;
      say('out', [[D63, 'All souls aboard. Six-Three lifting.'], [SR, 'Nine days. I stopped believing anyone was coming.'], [OK, 'We always come, Captain.'], [AN, 'Sabre, Anvil. Lantern is coming home. Outstanding work, all of you.']]);
      h.fly([[76, 20, 88], [60, 50, 60], [0, 80, -20], [-120, 110, -120]], 14, null, { ease: false });
      this.later(12, () => { CF.Game.godMode = false; this.complete(); });
    }
  });
  MS.phases = PH;

  // ---------------------------------------------------------------- flow
  MS.start = function () {
    this.said = {}; this.st = { v: 1, stage: 'start', ghost: true, silent: 0, dead: [], freed: [], kaal: false };
    this.begin(0, false, true);
  };
  /** Show the briefing (new mission or a save that sits at a mission start), then play it. */
  MS.begin = function (i, retry, brief) {
    const G = CF.Game;
    this.idx = i; this.phase = PH[i]; this.busy = false;
    resetWorld(); this.spawner = null; this.timers = []; this.s = {};
    if (!brief) { this.enter(i, retry); return; }
    G.state = 'briefing'; CF.Input.active = false; CF.Input.clearAll(); CF.HUD.show(false); CF.HUD.clearRadio();
    CF.Input.exitLock();
    const b = Object.assign({ num: num(i), title: TITLES[i] }, BRIEF[i]);
    MAP().setTime(TIME[i]); place(PH[i].cp());
    CF.Post.setState({ fade: 0.35 });
    CF.Story.briefing(b).then(() => {
      if (G.state !== 'briefing' || this.idx !== i) return; // quit to the menu meanwhile
      G.state = 'playing'; CF.Input.active = true; CF.Input.clearAll(); CF.HUD.show(true); G.showScreen(null);
      CF.Post.setState({ fade: 1 });
      this.enter(i, retry);
    });
  };
  MS.enter = function (i, retry) {
    if (this.entered && this.phase && this.phase.exit) this.phase.exit.call(this);
    this.idx = i; this.phase = PH[i]; this.t = 0; this.s = {}; this.spawner = null; this.timers = []; this.entered = true;
    resetWorld();
    MAP().setTime(TIME[i]);
    CF.Music.setIntensity(0.2);
    if (this.st.stage === 'start') { giveKit(i); place(PH[i].cp()); }
    else CF.Weapons.setSuppressed(!!KIT[i].quiet);
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
    // fade, save the start of the next mission, brief it
    const reward = { 0: 'shotgun' }[this.idx];
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
    CF.Story.update(dt);
    let I = this.phase.id === 'ghost' ? (this.s.alarm ? 0.8 : 0.15) : 0.2;
    const c = CF.Enemies.combatCount;
    if (c > 0 && this.phase.id !== 'ghost') I = Math.min(0.95, 0.45 + c * 0.08);
    if (this.s.hold != null || this.s.time != null) I = Math.max(I, 0.85);
    CF.Music.setIntensity(I);
  };
  MS.preUpdate = function (dt) { CF.Story.preUpdate(dt); };
  MS.onKill = function (e, info) {
    if (this.phase.id === 'ghost' && e.gi != null && !this.st.dead.includes(e.gi)) {
      this.st.dead.push(e.gi);
      const quiet = info && (info.melee || (CF.Weapons.suppressed && (info.weapon === 'carbine' || info.weapon === 'pistol')));
      if (quiet && !this.s.alarm && (e.state === 'idle' || e.state === 'patrol' || e.state === 'alert' || e.state === 'dead')) { this.st.silent++; CF.HUD.popup('Silent kill', 0, 'head'); }
    }
  };
  MS.onBossKilled = function () {};
  MS.onTask = function (it) {
    const st = this.st, P = hp();
    if (this.phase.onTask) { this.phase.onTask.call(this, it); return; }
    if (it.id === 'ledger' && st.stage === 'ledger') {
      it.enabled = false; it.screen.material = L.mats.screenOn; A.play('breakerOn', it.pos, { ref: 6 });
      award('Ledger copied', 500);
      say('ledger', [[AN, 'Getting it… that\'s the ledger. Prisoner lists, payments, locations. Get out of there.']]);
      this.phase.exfil.call(this);
      CF.Game.saveCheckpoint({ x: P.body.pos.x, y: P.body.pos.y, z: P.body.pos.z, yaw: P.yaw });
    } else if ((it.id === 'gateCharge' && st.stage === 'gate') || (it.id === 'blockCharge' && st.stage === 'block')) {
      it.enabled = false; A.play('charge', it.pos, { ref: 6 });
      const gate = it.id === 'gateCharge', at = gate ? new THREE.Vector3(73, 1.5, -46.8) : new THREE.Vector3(73.5, 1.2, -86.2);
      CF.HUD.hint('Charge set · get clear', true);
      say(it.id, [[OK, 'Breaching! Three… two… one…']]);
      this.later(3, () => {
        blowDoor(gate ? 'fortGate' : 'blockDoor', at);
        if (gate) { award('Gate breached', 250); this.phase.courtyard.call(this); }
        else { award('Block breached', 250); this.phase.cells.call(this); CF.Game.saveCheckpoint(L.points.cp.cellBlock); }
      });
    } else if (/^cell\d$/.test(it.id) && st.stage === 'cells') {
      const i = +it.id.slice(4) - 1; if (st.freed.includes(i)) return;
      it.enabled = false; st.freed.push(i); openCell(i);
      const a = this.s.pows && this.s.pows[i]; if (a) { a.hold = null; a.follow = true; a.crouch = 0; }
      award('Prisoner freed', 300);
      const lines = [[SR, 'You\'re American? God. Serrano, Lantern actual. Get my people.'], ['Sgt. Hale', 'About time. I was starting to like the food.'], ['Spc. Nakamura', 'I can walk. I can walk, let\'s go.'], ['Lt. Brandt', 'They moved the colonel\'s men out an hour ago. We have to go now.']];
      say('cell' + i, [lines[i]]);
      if (st.freed.length === 4) { this.phase.pad.call(this); CF.Game.saveCheckpoint(L.points.cp.cellBlock); }
      else CF.Game.saveCheckpoint({ x: P.body.pos.x, y: P.body.pos.y, z: P.body.pos.z, yaw: P.yaw }, true);
    }
  };

  // ---------------------------------------------------------------- spawning
  MS.spawnAt = function (type, zones, opts) {
    const P = CF.Player, eye = P.eyePos(new THREE.Vector3());
    let best = null, bs = -Infinity;
    const cands = [];
    for (const z of zones) for (const p of (L.spawns[z] || [])) cands.push(p);
    for (const c of cands) {
      const y = W.navHeight(c[0], c[1]); if (isNaN(y)) continue;
      const d = Math.hypot(c[0] - P.body.pos.x, c[1] - P.body.pos.z);
      if (d < 14) continue;
      const hidden = !W.segmentClear(eye.x, eye.y, eye.z, c[0], y + 1.2, c[1]);
      const score = (hidden ? 30 : 0) - Math.abs(d - 30) * 0.6 + Math.random() * 14;
      if (score > bs) { bs = score; best = c; }
    }
    if (!best) return null;
    return CF.Enemies.spawn(type, best[0], best[1], Object.assign({ aware: true }, opts));
  };
  MS.updateSpawner = function (dt) {
    const s = this.spawner; if (!s) return;
    s.t -= dt; if (s.t > 0) return;
    s.t = U.rand(s.interval[0], s.interval[1]);
    const alive = CF.Enemies.alive((e) => !e.T.vehicle);
    if (alive >= s.maxAlive || s.remaining <= 0) return;
    const n = Math.min(Math.random() < 0.45 ? 2 : 1, s.maxAlive - alive, s.remaining);
    for (let i = 0; i < n; i++) { const e = this.spawnAt(U.choice(s.pool), s.zones); if (e) { s.remaining--; if (this.phase.id === 'ghost') e.torchOn = true; } }
  };

  // ---------------------------------------------------------------- saves
  MS.saveState = function () { const st = this.st; return { v: 1, stage: st.stage, ghost: !!st.ghost, silent: st.silent | 0, dead: st.dead.slice(), freed: st.freed.slice(), kaal: !!st.kaal }; };
  MS.validState = (m) => m && m.v === 1 && typeof m.stage === 'string' && m.stage.length < 24 && typeof m.ghost === 'boolean' && typeof m.kaal === 'boolean' && Number.isInteger(m.silent) && m.silent >= 0 &&
    Array.isArray(m.dead) && m.dead.every((x) => Number.isInteger(x) && x >= 0 && x < GUARDS.length) && Array.isArray(m.freed) && m.freed.every((x) => Number.isInteger(x) && x >= 0 && x < 4);
  MS.restore = function (state, idx, fromSave) {
    this.st = { v: 1, stage: state.stage, ghost: state.ghost, silent: state.silent, dead: state.dead.slice(), freed: state.freed.slice(), kaal: state.kaal };
    this.said = {};
    // an in-flight checkpoint can't be resumed mid-air: replay the mission from its start
    if (this.st.stage === 'ride' || this.st.stage === 'flight' || this.st.stage === 'down') this.st.stage = 'start';
    this.entered = false;
    this.begin(idx, true, fromSave && this.st.stage === 'start');
  };
  MS.skipTo = function (i) {
    CF.Enemies.clear();
    this.st = { v: 1, stage: 'start', ghost: true, silent: 0, dead: [], freed: [], kaal: false };
    this.entered = false;
    this.begin(i, false, false);
    CF.Game.saveCheckpoint(PH[i].cp());
  };
  MS.resetWorld = function () { resetWorld(); };
  MS.teardown = function () { if (this.phase && this.phase.exit) this.phase.exit.call(this); resetWorld(); this.entered = false; };

  CF.Campaigns.story = { id: 'story', name: 'Dust Off', short: 'Dust Off', map: 'story', mission: MS, secured: 'Lantern is coming home', music: 'desert', story: true };
})(window.CF);
