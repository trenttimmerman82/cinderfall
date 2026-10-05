'use strict';
/* Cinderfall — Green Hell runtime: what makes the jungle war play differently.
   · Hiders: riflemen dug in under the leaves. They don't come to you. They wait, pop up for a burst, duck, and sometimes
     crawl to the next bush. Their tells: muzzle flash, leaves rustling, birds bursting out of the canopy.
   · Spider holes: a lid in the ground that lifts, a burst, and gone again. Shoot him while he's up.
   · Spotting: hold your sights on a hidden man for a moment and he's marked; your squad calls out contacts by the clock.
   · Booby traps: tripwires and punji pits. Your point man calls them when he sees them; hold E to disarm.
   · Set pieces: parachute flares, the tunnel flashlight, the PBR, claymores, sappers, Spooky, a napalm strike.
   Missions (js/mission-nam.js) drive all of it; reset() clears it at every checkpoint. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio, L = CF.Level, E = CF.Enemies;
  const PI = Math.PI;
  const $ = (id) => document.getElementById(id);
  const J = CF.Jungle = { on: false, traps: [], spiders: [], flares: [], flocks: [], marks: [], fx: [], callT: 0, boat: null, torch: null, claymores: [], strikes: [] };
  const MJ = () => CF.MapJungle;
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _e = new THREE.Vector3();

  // ---------------------------------------------------------------- foliage and sight
  /** Enemies: does foliage hide the player from this one? Close in, or once they've opened up on you, it matters less. */
  function veilEnemy(e, eye, pc, P) {
    if (!J.on || !MJ()) return false;
    const v = MJ().veil(eye.x, eye.y, eye.z, pc.x, pc.y, pc.z) * (P.crouching ? 1.35 : 1) * (e.state === 'combat' ? 0.55 : 1);
    return v > 1;
  }
  /** Allies: they can't shoot at what they can't see either (unless it just fired). */
  function veilAlly(a, e, c) {
    if (!J.on || !MJ() || (e.revealT || 0) > 0) return false;
    const b = a.body.pos;
    return MJ().veil(b.x, b.y + 1.6, b.z, c.x, c.y, c.z) > 0.8;
  }
  /** Sniper scope: a pin of light that swells as he settles; bigger far away so it can be found. */
  function glint(e, k) {
    const from = e.m.p.muzzle.getWorldPosition(_v); from.y += 0.06;
    const d = from.distanceTo(CF.Game.camera.position), s = (0.12 + d * 0.012) * (0.6 + k * 0.8) * (0.85 + Math.random() * 0.3);
    CF.FX.glow(from.x, from.y, from.z, s, 6, 5.4, 4, 0.03);
    e.revealT = Math.max(e.revealT || 0, 0.3);
  }

  // ---------------------------------------------------------------- hiders
  const _hs = [];
  /** Turn a spawned rifleman into a hider. o: { ambushR, moves, spots: [[x,z],...], stand } */
  J.hide = function (e, o) {
    o = o || {};
    e.hide = { home: e.body.pos.clone(), mode: 'wait', t: 0, bursts: 0, upT: 0, moves: o.moves != null ? o.moves : 2, spots: o.spots || null, ambushR: o.ambushR || 22, lastHp: e.hp, rustleT: U.rand(6, 16) };
    e.crouch = 1; e.brain = hiderBrain; e.concealed = true;
    return e;
  };
  function hiderBrain(dt, P) {
    const e = this, h = e.hide, b = e.body, T = e.T;
    const pp = P.body.pos, dist = Math.hypot(pp.x - b.pos.x, pp.z - b.pos.z);
    const hurt = e.hp < h.lastHp - 1; h.lastHp = e.hp;
    let speed = 0, want = 1;
    if (e.state === 'idle' || e.state === 'patrol' || e.state === 'alert') {
      // waiting under the leaves: still, low, facing where trouble will come from
      e.moveDir(0, 0, 0, dt);
      if (e.suspicion > 0.3 && e.suspectPos) e.turnTo(Math.atan2(-(e.suspectPos.x - b.pos.x), -(e.suspectPos.z - b.pos.z)), 2, dt);
      if (P.alive && dist < h.ambushR && e.canSee) e.becomeAware(pp, false);
      // the jungle gives them away to anyone listening
      h.rustleT -= dt;
      if (h.rustleT <= 0) { h.rustleT = U.rand(10, 22); if (dist < 30) A.play('rustle', b.pos, { ref: 3, vol: 0.6 }); }
      want = 1.05;
    } else {
      if (e.state !== 'dead') e.state = 'combat';
      h.t -= dt;
      const close = dist < 6;
      if (h.mode === 'wait') { h.mode = 'up'; h.t = U.rand(2.2, 4); h.bursts = 0; }
      if (h.mode === 'up') {
        want = close ? 0.15 : 0.4;
        e.faceTarget(P, dt, 5); e.moveDir(0, 0, 0, dt);
        const before = e.burstLeft;
        if (e.reactT <= 0 && e.staggerT <= 0) e.shootLogic(dt, P, dist);
        if (before > 0 && e.burstLeft === 0) h.bursts++;
        if (!close && (h.t <= 0 || h.bursts >= 1 + (e.seed2 || 0) % 2 || (hurt && Math.random() < 0.6))) { h.mode = 'duck'; h.t = U.rand(1.3, 2.8); e.burstLeft = 0; }
      } else if (h.mode === 'duck') {
        want = 1.15; e.moveDir(0, 0, 0, dt); e.faceTarget(P, dt, 2);
        if (h.t <= 0) {
          if (h.moves > 0 && Math.random() < (hurt ? 0.7 : 0.4) && J.pickSpot(e, P)) { h.mode = 'crawl'; h.moves--; A.play('rustle', b.pos, { ref: 5 }); J.leafPuff(b.pos); if (Math.random() < 0.5) J.flushBirds(b.pos.x, b.pos.z); }
          else { h.mode = 'up'; h.t = U.rand(2, 3.6); h.bursts = 0; }
        }
      } else if (h.mode === 'crawl') {
        want = 1.1;
        const dx = h.to.x - b.pos.x, dz = h.to.z - b.pos.z, l = Math.hypot(dx, dz);
        if (l < 0.5 || h.t < -6) { h.mode = 'duck'; h.t = U.rand(0.6, 1.4); e.moveDir(0, 0, 0, dt); }
        else { speed = 1.3; e.moveDir(dx / l, dz / l, speed, dt, true); }
      }
      if (e.T.rpg && h.mode === 'up') e.rpgLogic(dt, P, dist);
    }
    e.crouch = U.damp(e.crouch || 0, want, 6, dt);
    e.physics(dt);
    e.pose(dt, Math.hypot(b.vel.x, b.vel.z));
  }
  /** A new bush to crawl to: a few metres off, sideways to the player rather than toward him. */
  J.pickSpot = function (e, P) {
    const b = e.body.pos, h = e.hide;
    if (h.spots && h.spots.length) {
      let best = null, bs = -Infinity;
      for (const s of h.spots) { const d = Math.hypot(s[0] - b.x, s[1] - b.z); if (d < 3 || d > 16) continue; const sc = -Math.abs(d - 8) + Math.random() * 4; if (sc > bs && !E.list.some((o) => o !== e && o.alive && Math.hypot(o.body.pos.x - s[0], o.body.pos.z - s[1]) < 1.5)) { bs = sc; best = s; } }
      if (best) { h.to = { x: best[0], z: best[1] }; h.t = 0; return true; }
    }
    const px = P.body.pos.x - b.x, pz = P.body.pos.z - b.z, l = Math.hypot(px, pz) || 1, side = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < 6; i++) {
      const r = U.rand(4, 9), a = Math.atan2(pz, px) + side * U.rand(1.1, 1.9) + (i % 2 ? 0.3 : -0.3);
      const x = b.x + Math.cos(a) * r - px / l * 2, z = b.z + Math.sin(a) * r - pz / l * 2;
      const y = W.navHeight(x, z); if (isNaN(y) || Math.abs(y - b.y) > 0.7) continue;
      if (!W.segmentClear(b.x, b.y + 0.5, b.z, x, y + 0.5, z)) continue;
      h.to = { x, z }; h.t = 0; return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- spider holes
  let lidGeo = null;
  /** A VC in a covered hole at (x, z). He comes up when you're in range and in sight, fires, and drops. */
  J.spider = function (x, z, o) {
    o = o || {};
    const gy = W.navHeight(x, z), y = isNaN(gy) ? 0 : gy;
    const e = E.spawn('spider', x, z, { y: y - 1.75, yaw: o.yaw || 0, tag: o.tag || 'spider' });
    e.body.noSnap = true;
    lidGeo = lidGeo || new THREE.CylinderGeometry(0.55, 0.6, 0.08, 12);
    const lid = new THREE.Mesh(lidGeo, L.mats.leafBush ? L.mats.thatch : L.mats.wood); lid.position.set(x, y + 0.04, z); lid.castShadow = true;
    if (L.mats.leafBush) for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), L.mats.leafBush); c.rotation.set(-PI / 2 + (Math.random() - 0.5) * 0.5, 0, Math.random() * PI); c.position.set((Math.random() - 0.5) * 0.3, 0.06, (Math.random() - 0.5) * 0.3); lid.add(c); }
    CF.Game.scene.add(lid);
    // the hole: a dark ring and a little earth spoil
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshBasicMaterial({ color: 0x050403 })); hole.rotation.x = -PI / 2; hole.position.set(x, y + 0.02, z); CF.Game.scene.add(hole);
    e.spider = { x, z, y, lid, hole, mode: 'down', t: U.rand(0.5, 2), lift: 0, range: o.range || 40 };
    e.brain = spiderBrain; e.concealed = true;
    e.cleanup = () => { CF.Game.scene.remove(lid); CF.Game.scene.remove(hole); };
    J.spiders.push(e);
    return e;
  };
  function spiderBrain(dt, P) {
    const e = this, s = e.spider, b = e.body, pp = P.body.pos;
    s.t -= dt;
    const dist = Math.hypot(pp.x - s.x, pp.z - s.z);
    const sees = P.alive && dist < s.range && W.segmentClear(s.x, s.y + 1.2, s.z, pp.x, pp.y + 1.2, pp.z);
    if (s.mode === 'down') {
      s.lift = Math.max(0, s.lift - dt * 3);
      if (s.t <= 0 && sees) { s.mode = 'rise'; s.t = 0.45; A.play('rustle', { x: s.x, y: s.y, z: s.z }, { ref: 5 }); }
      e.state = sees && dist < s.range ? 'hunt' : 'idle';
    } else if (s.mode === 'rise') {
      s.lift = Math.min(1, s.lift + dt / 0.45);
      if (s.t <= 0) { s.mode = 'up'; s.t = U.rand(2.2, 3.4); e.fireCd = U.rand(0.15, 0.4) / CF.diff().aggro; e.reactT = 0; }
    } else if (s.mode === 'up') {
      e.state = 'combat'; e.faceTarget(P, dt, 7);
      if (e.staggerT <= 0) e.shootLogic(dt, P, dist);
      if (s.t <= 0 || !sees || e.flinch > 0.5) { s.mode = 'drop'; s.t = 0.35; e.burstLeft = 0; }
    } else if (s.mode === 'drop') {
      s.lift = Math.max(0, s.lift - dt / 0.35);
      if (s.t <= 0) { s.mode = 'down'; s.t = U.rand(2.4, 5); e.state = 'hunt'; }
    }
    const k = U.easeInOut(s.lift);
    b.pos.set(s.x, s.y - 1.75 + k * 1.05, s.z); b.vel.set(0, 0, 0);
    s.lid.position.set(s.x + k * 0.55, s.y + 0.04 + k * 0.5, s.z); s.lid.rotation.z = k * 1.2;
    e.root.visible = s.lift > 0.02;
    e.crouch = 0; e.aiming = true;
    e.pose(dt, 0);
  }

  // ---------------------------------------------------------------- spotting
  /** Hold your sights on a hidden man for half a second: marked for eight. Firing gives him away for a moment. */
  function spot(dt) {
    const P = CF.Player, WP = CF.Weapons, cam = CF.Game.camera;
    if (!P.alive) return;
    cam.getWorldDirection(_f);
    const aiming = WP.adsE > 0.7, scoped = WP.cur && WP.cur.def.scope;
    for (const e of E.list) {
      if (!e.alive || !e.T.human || e.net) continue;
      if (e.lastFired && CF.time - e.lastFired < 0.1) e.revealT = Math.max(e.revealT || 0, 2.2);
      if (e.revealT > 0) e.revealT -= dt;
      if (e.spottedT > 0) e.spottedT -= dt;
      if (!aiming || (e.root && !e.root.visible)) { e.spotK = Math.max(0, (e.spotK || 0) - dt); continue; }
      e.center(_c);
      _w.subVectors(_c, cam.position); const d = _w.length(); if (d > 110) continue;
      _w.divideScalar(d);
      const cosT = scoped ? 0.9993 : 0.9978 - Math.min(0.002, d * 0.00002);
      if (_w.dot(_f) < cosT) { e.spotK = Math.max(0, (e.spotK || 0) - dt * 2); continue; }
      if (!W.segmentClear(cam.position.x, cam.position.y, cam.position.z, _c.x, _c.y, _c.z)) continue;
      e.spotK = (e.spotK || 0) + dt * (scoped ? 3.5 : 2.2);
      if (e.spotK >= 1 && !(e.spottedT > 0)) {
        e.spottedT = 8;
        if (e.concealed && !e.spotNoted) { e.spotNoted = true; CF.HUD.popup('Spotted', 0, ''); A.play('uiHover', null, { ui: true }); }
      }
    }
  }
  function pool(parentId) {
    const parent = $(parentId); if (!parent) return null;
    const d = document.createElement('div'); d.className = 'spot-mark'; d.hidden = true; parent.appendChild(d); J.marks.push(d); return d;
  }
  /** Markers: a red diamond over anyone spotted, a brief flare over a muzzle flash in the leaves. */
  function marks() {
    let k = 0;
    const cam = CF.Game.camera, P = CF.Player.body.pos;
    for (const e of E.list) {
      if (!e.alive || !e.T.human || e.net || !(e.spottedT > 0 || (e.concealed && e.revealT > 0.2))) continue;
      if (e.root && !e.root.visible) continue;
      if (e.body.pos.distanceTo(P) > 110) continue;
      _v.set(e.body.pos.x, e.body.pos.y + (e.crouch > 0.7 ? 1.5 : 2.1), e.body.pos.z).project(cam);
      if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue;
      const el = J.marks[k] || pool('spotMarks'); if (!el) break;
      el.hidden = false; el.classList.toggle('flash', !(e.spottedT > 0));
      el.style.transform = 'translate(' + ((_v.x * 0.5 + 0.5) * window.innerWidth).toFixed(0) + 'px,' + ((-_v.y * 0.5 + 0.5) * window.innerHeight).toFixed(0) + 'px) translate(-50%,-100%)';
      k++;
    }
    for (; k < J.marks.length; k++) J.marks[k].hidden = true;
  }
  const CLOCK = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  /** "Contact, two o'clock!" from where you're facing. */
  J.clock = function (x, z) {
    const P = CF.Player, a = Math.atan2(-(x - P.body.pos.x), -(z - P.body.pos.z)), rel = U.wrapAngle(P.yaw - a);
    let h = Math.round(rel / (PI / 6)); h = ((h % 12) + 12) % 12;
    return CLOCK[h] + ' o\'clock';
  };
  /** Squadmates call contacts from hidden shooters (one call every few seconds, never the same man twice). */
  function callouts(dt) {
    J.callT -= dt;
    if (J.callT > 0 || !J.caller) return;
    for (const e of E.list) {
      if (!e.alive || !e.concealed || e.called || !(e.revealT > 1.5)) continue;
      const d = e.body.pos.distanceTo(CF.Player.body.pos); if (d > 70) continue;
      e.called = true; J.callT = 6;
      const where = J.clock(e.body.pos.x, e.body.pos.z), what = e.spider ? 'Spider hole' : e.T.glint ? 'Sniper' : e.T.rpg ? 'B-40' : e.type === 'vcmg' ? 'Machine gun' : 'Contact';
      const tail = e.spider ? ', in the ground!' : d > 40 ? ', way out!' : ', in the trees!';
      CF.HUD.radio(J.caller(), what + ', ' + where + tail);
      e.spottedT = Math.max(e.spottedT || 0, CF.diff().label === 'Elite' ? 2.5 : 5);
      return;
    }
  }

  // ---------------------------------------------------------------- birds and leaves
  let birdGeo = null, birdMat = null;
  /** A flock bursts out of the canopy: the jungle's alarm. */
  J.flushBirds = function (x, z, n) {
    n = n || 9;
    birdGeo = birdGeo || (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, -0.3, 0, -0.05, 0, 0.03, -0.1, 0, 0, 0.12, 0.3, 0, -0.05, 0, 0.03, -0.1], 3)); g.computeVertexNormals(); return g; })();
    birdMat = birdMat || new THREE.MeshBasicMaterial({ color: 0x141410, side: THREE.DoubleSide });
    const gy = W.groundHeight(x, 40, z), y0 = Math.max(gy + 8, gy + 3);
    const birds = [];
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(birdGeo, birdMat); mesh.position.set(x + U.gauss() * 3, y0 + Math.random() * 4, z + U.gauss() * 3); CF.Game.scene.add(mesh);
      const a = Math.random() * PI * 2;
      birds.push({ mesh, vel: new THREE.Vector3(Math.cos(a) * U.rand(4, 7), U.rand(3, 5), Math.sin(a) * U.rand(4, 7)), ph: Math.random() * 6 });
    }
    J.flocks.push({ birds, t: 0 });
    A.play('birds', { x, y: y0, z }, { ref: 18 });
  };
  function birds(dt) {
    for (let i = J.flocks.length - 1; i >= 0; i--) {
      const f = J.flocks[i]; f.t += dt;
      for (const b of f.birds) {
        b.vel.y -= dt * 0.6; b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.y = Math.atan2(b.vel.x, b.vel.z); b.mesh.scale.set(1, 1 + Math.sin(CF.time * 22 + b.ph) * 0.9, 1);
      }
      if (f.t > 5) { for (const b of f.birds) CF.Game.scene.remove(b.mesh); J.flocks.splice(i, 1); }
    }
  }
  J.leafPuff = function (p) { for (let i = 0; i < 8; i++) CF.FX.debris(p.x + U.gauss() * 0.4, p.y + 0.6 + Math.random() * 0.8, p.z + U.gauss() * 0.4, 0, 0.4, 0, 1, 2, 0.08); };

  // ---------------------------------------------------------------- booby traps
  let n = 0;
  /** Tripwire (kind 'wire', across the path at angle ry) or punji pit ('punji'). Returns the trap. */
  J.trap = function (t, o) {
    o = o || {};
    const gy = W.navHeight(t.x, t.z), y = isNaN(gy) ? 0 : gy, g = new THREE.Group(), M = L.mats;
    const trap = { kind: t.kind, x: t.x, z: t.z, y, ry: t.ry || 0, group: g, live: true, called: false, half: 1.4, id: 'trap' + (n++) };
    if (t.kind === 'wire') {
      const c = Math.cos(trap.ry), s = Math.sin(trap.ry), ax = t.x - c * trap.half, az = t.z + s * trap.half, bx = t.x + c * trap.half, bz = t.z - s * trap.half;
      trap.a = { x: ax, z: az }; trap.b = { x: bx, z: bz };
      for (const [x, z] of [[ax, az], [bx, bz]]) { const st = new THREE.Mesh(L.geo('cylLo'), M.timber); st.scale.set(0.025, 0.4, 0.025); st.position.set(x, y + 0.2, z); g.add(st); }
      const len = Math.hypot(bx - ax, bz - az);
      trap.wire = new THREE.Mesh(L.geo('cylLo'), new THREE.MeshBasicMaterial({ color: 0x9a9a90, transparent: true, opacity: 0.0, depthWrite: false }));
      trap.wire.scale.set(0.004, len, 0.004); trap.wire.rotation.set(PI / 2, 0, 0); trap.wire.rotation.y = Math.atan2(bx - ax, bz - az);
      trap.wire.rotation.order = 'YXZ'; trap.wire.position.set((ax + bx) / 2, y + 0.18, (az + bz) / 2); g.add(trap.wire);
      const nade = new THREE.Mesh(L.geo('sphere'), M.gunOD || M.olive); nade.scale.set(0.05, 0.065, 0.05); nade.position.set(ax + 0.08, y + 0.3, az); g.add(nade);
      trap.nade = nade;
    } else {
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), M.leafBush || M.wood); cover.rotation.x = -PI / 2; cover.position.set(t.x, y + 0.03, t.z); g.add(cover);
      const cover2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), M.leafFern || M.wood); cover2.rotation.set(-PI / 2, 0, 0.7); cover2.position.set(t.x, y + 0.035, t.z); g.add(cover2);
      trap.cover = [cover, cover2];
      const stakes = new THREE.Group(); stakes.visible = false; g.add(stakes);
      const pit = new THREE.Mesh(new THREE.CircleGeometry(0.62, 12), new THREE.MeshBasicMaterial({ color: 0x080604 })); pit.rotation.x = -PI / 2; pit.position.set(t.x, y + 0.02, t.z); stakes.add(pit);
      for (let i = 0; i < 9; i++) { const sk = new THREE.Mesh(L.geo('cone'), M.bamboo || M.wood); sk.scale.set(0.025, 0.4, 0.025); sk.position.set(t.x + ((i % 3) - 1) * 0.32, y - 0.05, t.z + (Math.floor(i / 3) - 1) * 0.32); stakes.add(sk); }
      trap.stakes = stakes;
    }
    g.traverse((x) => { if (x.isMesh) x.castShadow = x !== trap.wire; });
    CF.Game.scene.add(g);
    trap.it = L.addInteract({ id: trap.id, type: 'task', pos: [t.x, y, t.z], face: null, radius: 1.9, hold: t.kind === 'wire' ? 2.0 : 1.0, prompt: t.kind === 'wire' ? 'Disarm the tripwire' : 'Mark the punji pit', enabled: false, trap });
    J.traps.push(trap);
    return trap;
  };
  function segDist(px, pz, a, b) { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, t = U.clamp(((px - a.x) * dx + (pz - a.z) * dz) / (l2 || 1), 0, 1); return Math.hypot(px - a.x - dx * t, pz - a.z - dz * t); }
  function traps(dt) {
    const P = CF.Player, pp = P.body.pos;
    for (const t of J.traps) {
      if (!t.live) continue;
      const d = Math.hypot(pp.x - t.x, pp.z - t.z);
      t.it.enabled = d < 2.6;
      if (t.kind === 'wire') {
        // the wire catches the light as you get close
        t.wire.material.opacity = U.clamp(1 - (d - 2) / 7, 0, 0.9) * (0.6 + 0.4 * Math.sin(CF.time * 3 + t.x));
        if (P.alive && Math.abs(pp.y - t.y) < 0.6 && segDist(pp.x, pp.z, t.a, t.b) < 0.32 && !t.fuse) {
          t.fuse = 1.3; A.play('tripClick', { x: t.x, y: t.y + 0.3, z: t.z }, { ref: 3 }); CF.HUD.hint('TRIPWIRE · get clear!', true);
        }
        if (t.fuse) { t.fuse -= dt; if (t.fuse <= 0) { t.live = false; t.it.enabled = false; const at = t.nade.getWorldPosition(new THREE.Vector3()); CF.Game.explode(at, { radius: 6, damage: 95, source: 'enemy', killer: 'a booby trap', scale: 0.9 }); CF.Game.scene.remove(t.group); } }
      } else if (P.alive && d < 0.6 && Math.abs(pp.y - t.y) < 0.5) {
        t.live = false; t.it.enabled = false; for (const c of t.cover) c.visible = false; t.stakes.visible = true;
        A.play('punji', pp, { ref: 3 }); P.damage(38, null, 'a punji pit'); P.shake(0.5); CF.HUD.hint('Punji pit!', true);
        J.slowT = 4;
      }
      // the point man calls what he sees
      if (!t.called && t.live && d < (t.kind === 'wire' ? 9 : 7) && J.pointMan) {
        t.called = true;
        CF.HUD.radio(J.pointMan(), t.kind === 'wire' ? U.choice(['Hold up. Wire, right in front of us. Step over it or cut it.', 'Tripwire! Freeze. Ankle high, see it?', 'Wire across the trail. Easy.']) : U.choice(['Careful, ground\'s wrong there. Pit.', 'Punji pit ahead. Go round.', 'See the leaves? Too neat. Pit.']));
        t.revealT = 6;
      }
      if (t.revealT > 0) { t.revealT -= dt; CF.FX.glow(t.x, t.y + 0.25, t.z, 0.18, 4, 1.2, 0.4, 0.03); }
    }
    if (J.slowT > 0) { J.slowT -= dt; P.speedMul = J.slowT > 0 ? 0.6 : 1; }
  }
  /** Interactables come here first; true if it was a trap. */
  J.onTask = function (it) {
    const t = it.trap; if (!t) return false;
    if (!t.live) return true;
    t.live = false; it.enabled = false;
    if (t.kind === 'wire') { CF.Game.scene.remove(t.group); A.play('magOut', null, { ui: true }); CF.HUD.popup('Tripwire disarmed', CF.Game.pts(100), ''); }
    else { for (const c of t.cover) c.visible = false; t.stakes.visible = true; A.play('rustle', null, { ui: true }); CF.HUD.popup('Pit marked', CF.Game.pts(60), ''); }
    CF.Game.addScore(CF.Game.pts(t.kind === 'wire' ? 100 : 60));
    return true;
  };

  // ---------------------------------------------------------------- flares
  /** A parachute flare: pops high, drifts down for half a minute, lights the hill like noon. */
  J.flare = function (x, z, o) {
    o = o || {};
    const lp = (J.flareLamps || (MJ() && MJ().flareLamps) || []).find((l) => !l.on && !J.flares.some((f) => f.lamp === l)); // the map's spare lamps
    if (!lp) return null;
    const gy = W.groundHeight(x, 60, z);
    const f = { lamp: lp, x, z, y: gy + (o.h || 55), t: 0, life: o.life || 24, sway: Math.random() * 6 };
    lp.on = true; lp.pos.set(x, f.y, z);
    J.flares.push(f);
    A.play('flarePop', { x, y: f.y, z }, { ref: 40, vol: 0.8 });
    return f;
  };
  function flares(dt) {
    for (let i = J.flares.length - 1; i >= 0; i--) {
      const f = J.flares[i]; f.t += dt; f.y -= dt * 1.6;
      const sx = f.x + Math.sin(f.t * 0.7 + f.sway) * 2, sz = f.z + Math.cos(f.t * 0.5 + f.sway) * 1.5;
      const fade = U.clamp((f.life - f.t) / 3, 0, 1) * U.clamp(f.t / 0.5, 0, 1);
      f.lamp.pos.set(sx, f.y, sz); f.lamp.intensity = 5 * fade * (0.85 + Math.random() * 0.15);
      CF.FX.glow(sx, f.y, sz, 2.4 * fade + 0.4, 8, 7, 5, 0.03);
      if (Math.random() < 0.6) CF.FX.smoke.spawn(sx, f.y + 0.3, sz, U.gauss() * 0.2, 0.3, U.gauss() * 0.2, 2.5, 0.3, 3, 0.7, 0.7, 0.68, 0.35, -0.05, 0.4, 1);
      if (f.t > f.life) { f.lamp.on = false; J.flares.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- flashlight
  /** The tunnel rat's flashlight: a real spot light on the camera. */
  J.setTorch = function (on) {
    const G = CF.Game;
    if (on && !J.torch) {
      const t = J.torch = new THREE.SpotLight(0xfff0d8, 3.2, 28, 0.46, 0.55, 1.6);
      t.castShadow = false; G.scene.add(t); G.scene.add(t.target);
    }
    if (J.torch) J.torch.visible = !!on;
  };
  function torch() {
    const t = J.torch; if (!t || !t.visible) return;
    const cam = CF.Game.camera; cam.getWorldDirection(_f);
    t.position.copy(cam.position).addScaledVector(_f, 0.1); t.position.y -= 0.15; t.position.x += Math.cos(CF.Player.yaw) * 0.15; t.position.z -= Math.sin(CF.Player.yaw) * 0.15;
    t.target.position.copy(cam.position).addScaledVector(_f, 10);
    t.target.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- the PBR
  class Boat {
    constructor(x, z, yaw) {
      this.root = CF.StoryModels.pbr(); CF.Game.scene.add(this.root);
      this.pos = new THREE.Vector3(x, MJ().WATER_Y - 0.1, z); this.yaw = yaw || 0; this.curve = null; this.t = 0; this.speed = 0; this.roll = 0; this.pitch = 0; this.prevYaw = this.yaw;
      this.fireT = 0; this.target = null; this.burst = 0; this.sound = null; this.hp = 100;
      this.apply(0);
    }
    /** Steer through points [[x, z], ...] at speed (m/s). */
    run(points, speed, onArrive) {
      const pts = [this.pos.clone()].concat(points.map((p) => new THREE.Vector3(p[0], this.pos.y, p[1])));
      this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4); this.len = this.curve.getLength(); this.t = 0; this.speed = speed; this.onArrive = onArrive || null;
    }
    update(dt) {
      if (this.curve) {
        const slow = U.clamp(Math.min(this.t * this.len / 12 + 0.3, (1 - this.t) * this.len / 18 + 0.15), 0.15, 1);
        this.t = Math.min(1, this.t + this.speed * slow * (this.throttle == null ? 1 : this.throttle) * dt / this.len);
        this.curve.getPointAt(this.t, this.pos);
        const tan = this.curve.getTangentAt(Math.min(0.999, this.t + 0.01), _v);
        this.yaw += U.clamp(U.wrapAngle(Math.atan2(-tan.x, -tan.z) - this.yaw), -0.8 * dt, 0.8 * dt);
        if (this.t >= 1) { const f = this.onArrive; this.curve = null; if (f) f(this); }
      }
      this.pos.y = MJ().WATER_Y - 0.12 + Math.sin(CF.time * 1.4) * 0.04;
      const yawRate = U.wrapAngle(this.yaw - this.prevYaw) / Math.max(dt, 1e-3); this.dyaw = U.wrapAngle(this.yaw - this.prevYaw); this.prevYaw = this.yaw;
      const moving = this.curve ? 1 : 0;
      this.roll = U.damp(this.roll, U.clamp(yawRate * 0.5, -0.12, 0.12) + Math.sin(CF.time * 1.1) * 0.015, 3, dt);
      this.pitch = U.damp(this.pitch, -0.035 * moving + Math.sin(CF.time * 0.8) * 0.01, 2, dt);
      this.apply(dt);
      // wake
      const u = this.root.userData; u.wake.material.opacity = 0.3 * moving + 0.05;
      if (moving && Math.random() < 0.7) { _v.set(U.gauss() * 0.8, 0, 5).applyAxisAngle(_e.set(0, 1, 0), this.yaw).add(this.pos); CF.FX.smoke.spawn(_v.x, MJ().WATER_Y + 0.1, _v.z, U.gauss() * 0.4, 0.3, U.gauss() * 0.4, 1.6, 0.6, 2.5, 0.85, 0.88, 0.85, 0.35, -0.1, 0.6, 1); }
      if (!this.sound && CF.Game.audioOn) { this.sound = A.loop('boat', this.pos); if (this.sound) this.sound.set(0.35, 0.3); }
      if (this.sound && this.sound.panner && this.sound.panner.positionX) { const p = this.sound.panner; p.positionX.value = this.pos.x; p.positionY.value = this.pos.y + 1; p.positionZ.value = this.pos.z; this.sound.pitch(48 + moving * 18, 0.4); }
      this.guns(dt);
      if (this.rider && this.rider.ride) { this.rider.ride.dyaw = (this.rider.ride.dyaw || 0) + this.dyaw; this.rider.ride.roll = this.roll * 0.8; }
    }
    apply() {
      const r = this.root; r.position.copy(this.pos); r.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ'); r.updateMatrixWorld(true);
    }
    /** The twin .50 in the bow: the crew picks targets and hammers them (red tracers). */
    guns(dt) {
      this.fireT -= dt;
      const u = this.root.userData, muzzle = u.twin.getWorldPosition(_w);
      if (!this.target || !this.target.alive || this.fireT < -3) {
        this.target = null; let bd = 75;
        for (const e of E.list) { if (!e.alive || e.net) continue; const d = e.body.pos.distanceTo(muzzle); if (d > bd) continue; e.center(_c); if (!W.segmentClear(muzzle.x, muzzle.y, muzzle.z, _c.x, _c.y, _c.z)) continue; if (MJ().veil(muzzle.x, muzzle.y, muzzle.z, _c.x, _c.y, _c.z) > 1.2 && !(e.revealT > 0)) continue; bd = d; this.target = e; }
        if (this.target) this.fireT = 0.6;
      }
      const e = this.target;
      if (e) { const rel = U.wrapAngle(Math.atan2(-(e.body.pos.x - muzzle.x), -(e.body.pos.z - muzzle.z)) - this.yaw); u.twin.rotation.y = U.damp(u.twin.rotation.y, U.clamp(rel, -2.2, 2.2), 5, dt); }
      if (!e || this.fireT > 0) return;
      this.fireT = this.burst > 0 ? 0.11 : U.rand(0.8, 1.6); if (this.burst <= 0) this.burst = 6; this.burst--;
      e.center(_c); const aim = _c.clone(), hit = Math.random() < 0.38; if (!hit) aim.add(_v.set(U.gauss() * 1.6, U.gauss() * 0.9, U.gauss() * 1.6));
      const from = muzzle.clone(); from.y += 0.1;
      CF.FX.tracer(from, aim, { speed: 400, len: 5, w: 0.04, r: 5, g: 0.9, b: 0.6 });
      CF.FX.muzzle(from, _f.subVectors(aim, from).normalize(), 5, 3.2, 1.2, 0.5);
      A.play('m60', from, { ref: 8, vol: 0.7 });
      if (hit) e.damage(16, { dir: _f.clone(), point: aim, normal: _f.clone().negate(), part: null, weapon: null, source: 'npc', from: from.clone(), knock: 1 });
    }
    /** Where you stand: the aft deck, port side. */
    seat(out) { return out.set(-0.7, 0.78, 2.6).applyMatrix4(this.root.matrixWorld); }
    board(P) { const self = this; P.ride = { get(out) { self.seat(out); }, dyaw: 0, roll: 0 }; this.rider = P; }
    unboard() { if (this.rider) { this.rider.ride = null; this.rider = null; } }
    remove() { if (this.sound) { this.sound.stop(); this.sound = null; } this.unboard(); CF.Game.scene.remove(this.root); }
  }
  J.Boat = Boat;
  J.boats = [];
  /** The first boat is the one you ride (J.boat); more can follow. */
  J.addBoat = function (x, z, yaw) { const b = new Boat(x, z, yaw); J.boats.push(b); if (!J.boat) J.boat = b; return b; };

  // ---------------------------------------------------------------- claymores
  /** A claymore at (x, z) facing yaw: a fan of steel balls 50 m out the front. */
  J.claymore = function (x, z, yaw) {
    const gy = W.navHeight(x, z), y = isNaN(gy) ? 0 : gy;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
    const body = new THREE.Mesh(L.geo('box'), L.mats.gunOD || L.mats.olive); body.scale.set(0.22, 0.09, 0.04); body.position.y = 0.2; body.rotation.x = 0.15; g.add(body);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(L.geo('cylLo'), L.mats.steel); leg.scale.set(0.006, 0.2, 0.006); leg.position.set(s * 0.08, 0.08, 0.02); g.add(leg); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    CF.Game.scene.add(g);
    const c = { x, y, z, yaw, g }; J.claymores.push(c); return c;
  };
  J.fireClaymores = function () {
    let kills = 0;
    A.play('clacker', null, { ui: true });
    J.claymores.forEach((c, i) => CF.Game.later(0.25 + i * 0.12, () => {
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), at = new THREE.Vector3(c.x + fx * 1.5, c.y + 0.6, c.z + fz * 1.5);
      CF.FX.explosion(at, 1.1); A.play('bigBoom', at, { ref: 12 });
      for (let k = 0; k < 30; k++) { const a = Math.atan2(fx, fz) + U.rand(-0.5, 0.5), r = U.rand(5, 40); CF.FX.tracer(at, _v.set(c.x + Math.sin(a) * r, c.y + U.rand(0.2, 1.5), c.z + Math.cos(a) * r), { speed: 220, len: 1.2, w: 0.012, r: 3, g: 2.6, b: 2 }); }
      for (const e of E.list) {
        if (!e.alive || e.net) continue;
        const dx = e.body.pos.x - c.x, dz = e.body.pos.z - c.z, d = Math.hypot(dx, dz); if (d > 45) continue;
        const cos = (dx * fx + dz * fz) / (d || 1); if (cos < 0.72 && d > 4) continue;
        const dmg = d < 4 ? 400 : U.lerp(260, 60, U.clamp((d - 5) / 40, 0, 1));
        const r = e.damage(dmg, { dir: _v.set(fx, 0, fz).clone(), point: e.center(new THREE.Vector3()), normal: null, part: null, weapon: null, source: 'player', explosive: true, knock: 6 });
        if (r && r.killed) kills++;
      }
      CF.Game.scene.remove(c.g);
      if (i === J.claymores.length - 1) { J.claymores.length = 0; if (J.onClaymores) J.onClaymores(kills); }
    }));
  };

  // ---------------------------------------------------------------- sappers
  /** Sappers run in low and fast with satchel charges, throw, and keep coming. */
  J.sapper = function (e) { e.brain = sapperBrain; e.throwT = U.rand(1, 2); return e; };
  function sapperBrain(dt, P) {
    const e = this, b = e.body, pp = P.body.pos, dist = Math.hypot(pp.x - b.pos.x, pp.z - b.pos.z);
    if (e.state === 'idle' || e.state === 'patrol' || e.state === 'alert') e.state = 'hunt';
    e.throwT -= dt; e.crouch = U.damp(e.crouch || 0, 0.45, 5, dt);
    if (e.windT > 0) {
      e.windT -= dt; e.faceTarget(P, dt, 8); e.moveDir(0, 0, 0, dt);
      if (e.windT <= 0) { const from = e.m.p.handR.getWorldPosition(new THREE.Vector3()); const tgt = pp.clone(); tgt.x += U.gauss() * 1.4 / CF.diff().acc; tgt.z += U.gauss() * 1.4 / CF.diff().acc; E.mortar(from, tgt, 1.0, e, 55, 'satchel'); A.play('throw', from, { ref: 6 }); e.recoil = 1; }
    } else if (dist < 15 && e.throwT <= 0 && e.canSee) { e.windT = 0.5; e.throwT = U.rand(4, 6); e.state = 'combat'; A.play('shout', b.pos, { ref: 8 }); }
    else if (dist > 2.5) { e.lastKnown.copy(pp); e.chase(e.T.run * (dist < 10 ? 0.6 : 1), dt); }
    else e.moveDir(0, 0, 0, dt);
    e.physics(dt); e.pose(dt, Math.hypot(b.vel.x, b.vel.z));
  }

  // ---------------------------------------------------------------- column on the march (the night ambush)
  /** Walk a route at a steady pace, spaced out; anything that spooks them and they fight like anyone else. */
  J.march = function (e, route, delay) { e.marchRoute = route; e.marchI = 0; e.marchDelay = delay || 0; e.brain = marchBrain; e.crouch = 0; return e; };
  function marchBrain(dt, P) {
    const e = this, b = e.body;
    if (e.state === 'hunt' || e.state === 'combat') { e.brain = null; return e.soldierAI(dt, P); }
    e.marchDelay -= dt;
    const tg = e.marchRoute[e.marchI];
    if (e.marchDelay > 0 || !tg) { e.moveDir(0, 0, 0, dt); }
    else {
      const dx = tg[0] - b.pos.x, dz = tg[1] - b.pos.z, l = Math.hypot(dx, dz);
      if (l < 1.2) e.marchI++; else e.moveDir(dx / l, dz / l, e.T.walk * 0.95, dt, true);
    }
    e.physics(dt); e.pose(dt, Math.hypot(b.vel.x, b.vel.z));
  }

  // ---------------------------------------------------------------- air support
  let planeGeo = null;
  function plane(scale, color) {
    planeGeo = planeGeo || (() => {
      const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: color || 0x3a4030, roughness: 0.6, metalness: 0.3 });
      const add = (sx, sy, sz, x, y, z, rz) => { const b = new THREE.Mesh(L.geo('box'), m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); if (rz) b.rotation.z = rz; g.add(b); };
      add(1.4, 1.4, 14, 0, 0, 0); add(14, 0.2, 3, 0, 0, 0.5); add(5, 0.15, 1.8, 0, 0.3, 6); add(0.15, 2.4, 2, 0, 1.2, 6.2);
      return g;
    })();
    const p = planeGeo.clone(); p.scale.setScalar(scale || 1); p.traverse((o) => { if (o.isMesh) o.castShadow = true; }); CF.Game.scene.add(p); return p;
  }
  /** Two jets lay napalm along a line: a wall of fire and black smoke, then nothing on that hill moves. */
  J.napalm = function (pts, o) {
    o = o || {};
    const a = pts[0], b = pts[pts.length - 1], dir = new THREE.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize();
    const jet = plane(0.9, 0x5a6050), start = new THREE.Vector3(a[0], 40, a[1]).addScaledVector(dir, -260);
    J.strikes.push({ kind: 'jet', mesh: jet, pos: start, vel: dir.clone().multiplyScalar(160), t: 0, life: 4.5 });
    jet.lookAt(start.clone().add(dir)); jet.rotateY(PI);
    A.play('jet', null, { vol: 0.9 });
    pts.forEach((p, i) => CF.Game.later(1.55 + i * 0.12, () => {
      const at = new THREE.Vector3(p[0], W.groundHeight(p[0], 30, p[1]) + 1, p[1]);
      CF.FX.explosion(at, 1.8); CF.FX.flashLight(at, 0xff8030, 18, 40, 1.2); if (i % 2 === 0) A.play('napalm', at, { ref: 30 });
      L.emitters.push({ type: 'fire', x: at.x, y: at.y, z: at.z, rate: 14, size: 1.6, temp: true });
      for (let k = 0; k < 10; k++) CF.FX.smoke.spawn(at.x + U.gauss() * 3, at.y + 2, at.z + U.gauss() * 3, U.gauss(), U.rand(2, 4), U.gauss(), U.rand(5, 8), 1, 9, 0.05, 0.045, 0.04, 0.85, -0.25, 0.25, 1);
      if (o.damage !== false) CF.Game.explode(at, { radius: 9, damage: 400, source: 'player', noFx: true, shake: 0.6, killer: 'napalm' });
    }));
  };
  /** Spooky: an AC-47 circling high, three miniguns pouring red rain along the treeline. */
  J.spooky = function (cx, cz, zones, dur) {
    const p = plane(1.6, 0x2a2e26);
    J.strikes.push({ kind: 'spooky', mesh: p, cx, cz, zones, t: 0, life: dur || 40, a: 0, fireT: 0, soundT: 0 });
  };
  function strikes(dt) {
    for (let i = J.strikes.length - 1; i >= 0; i--) {
      const s = J.strikes[i]; s.t += dt;
      if (s.kind === 'jet') { s.pos.addScaledVector(s.vel, dt); s.mesh.position.copy(s.pos); }
      else {
        s.a += dt * 0.12;
        const px = s.cx + Math.cos(s.a) * 160, pz = s.cz + Math.sin(s.a) * 160, py = 140;
        s.mesh.position.set(px, py, pz); s.mesh.rotation.set(0, -s.a, 0.35);
        s.fireT -= dt; s.soundT -= dt;
        if (s.t > 2 && s.t < s.life - 2 && s.fireT <= 0) {
          s.fireT = 0.05;
          const z = U.choice(s.zones), tx = z[0] + U.gauss() * 6, tz = z[1] + U.gauss() * 6, ty = W.groundHeight(tx, 30, tz);
          const from = _v.set(px, py - 2, pz), to = _w.set(tx, ty, tz);
          CF.FX.tracer(from, to, { speed: 700, len: 18, w: 0.12, r: 6, g: 0.8, b: 0.4 });
          if (Math.random() < 0.4) { CF.FX.smoke.spawn(tx, ty + 0.3, tz, U.gauss(), U.rand(1, 3), U.gauss(), 1.5, 0.2, 2, 0.5, 0.42, 0.32, 0.6, -0.1, 0.5, 1); CF.FX.glow(tx, ty + 0.2, tz, 0.6, 5, 2, 0.6, 0.06); }
          for (const e of E.list) if (e.alive && !e.net && Math.hypot(e.body.pos.x - tx, e.body.pos.z - tz) < 3.2) e.damage(60, { dir: _f.set(0, -1, 0).clone(), point: e.center(new THREE.Vector3()), normal: null, part: null, weapon: null, source: 'npc', explosive: true, knock: 2 });
        }
        if (s.soundT <= 0 && s.t > 2 && s.t < s.life - 2) { s.soundT = 2.2; A.play('spooky', null, { vol: 0.5 }); }
      }
      if (s.t > s.life) { CF.Game.scene.remove(s.mesh); J.strikes.splice(i, 1); }
    }
  }
  /** Mortar rounds on the firebase: the whistle first (that's your warning), then the blast. */
  J.mortarRound = function (x, z, o) {
    o = o || {};
    const y = W.groundHeight(x, 30, z);
    A.play('incoming', { x, y: y + 10, z }, { ref: 25 });
    const ring = CF.FX.ring ? CF.FX.ring(new THREE.Vector3(x, y + 0.08, z), 3.2, 1.4, [1, 0.35, 0.15]) : null;
    CF.Game.later(1.45, () => CF.Game.explode(new THREE.Vector3(x, y + 0.3, z), { radius: 5, damage: o.damage || 70, source: 'enemy', killer: 'a mortar round', scale: 1 }));
    return ring;
  };

  // ---------------------------------------------------------------- per frame
  J.start = function () {
    J.on = true; J.reset();
    E.veil = veilEnemy; E.veilAlly = veilAlly; E.onGlint = glint;
  };
  J.stop = function () {
    J.reset(); J.on = false;
    E.veil = null; E.veilAlly = null; E.onGlint = null;
  };
  J.reset = function () {
    for (const t of J.traps) { CF.Game.scene.remove(t.group); const i = L.interactables.indexOf(t.it); if (i >= 0) L.interactables.splice(i, 1); }
    J.traps.length = 0; J.spiders.length = 0;
    for (const f of J.flares) f.lamp.on = false; J.flares.length = 0;
    for (const f of J.flocks) for (const b of f.birds) CF.Game.scene.remove(b.mesh); J.flocks.length = 0;
    for (const c of J.claymores) CF.Game.scene.remove(c.g); J.claymores.length = 0;
    for (const s of J.strikes) CF.Game.scene.remove(s.mesh); J.strikes.length = 0;
    for (const b of J.boats) b.remove(); J.boats.length = 0; J.boat = null;
    J.setTorch(false); J.slowT = 0; if (CF.Player) CF.Player.speedMul = 1;
    for (const m of J.marks) m.hidden = true;
    J.pointMan = null; J.caller = null; J.onClaymores = null; J.callT = 2;
  };
  J.preUpdate = function (dt) { for (const b of J.boats) b.update(dt); };
  J.update = function (dt) {
    if (!J.on) return;
    if (MJ() && CF.Game.mapId === 'jungle') MJ().tick(CF.time);
    spot(dt); marks(); callouts(dt); birds(dt); traps(dt); flares(dt); torch(); strikes(dt);
  };
})(window.CF);
