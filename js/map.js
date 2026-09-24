'use strict';
/* Cinderfall — Cinder Station layout. X east, Z south, Y up. Player starts on the south dock facing north. */
(function (CF) {
  const L = CF.Level, W = CF.World;
  const Map = CF.Map = {};
  const PI = Math.PI;
  const FACE_ROT = { 'z+': 0, 'z-': PI, 'x+': PI / 2, 'x-': -PI / 2 };
  const FACE_DIR = { 'z+': [0, 1], 'z-': [0, -1], 'x+': [1, 0], 'x-': [-1, 0] };

  function container(cx, cz, alongX, color, stack, y0) {
    stack = stack || 1; y0 = y0 || 0;
    const lx = alongX ? 6.1 : 2.44, lz = alongX ? 2.44 : 6.1;
    for (let s = 0; s < stack; s++) {
      const yb = y0 + s * 2.6;
      W.add(cx - lx / 2, yb, cz - lz / 2, cx + lx / 2, yb + 2.6, cz + lz / 2, { surf: 'metal' });
      L.propBox('cont_' + (s === 1 && stack > 1 ? (color === 'red' ? 'white' : 'red') : color), cx, yb, cz, 6.1, 2.6, 2.44, alongX ? 0 : PI / 2);
    }
    L.blob(cx, cz, lx + 1.4, lz + 1.4, y0);
  }
  function crate(x, y, z, s) {
    s = s || 1.2;
    W.add(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, { surf: 'metal' });
    L.propBox('crate', x, y, z, s, s, s, 0);
    if (y < 0.05) L.blob(x, z, s + 0.7, s + 0.7);
  }
  function barrier(x, z, alongX) {
    const lx = alongX ? 2 : 0.6, lz = alongX ? 0.6 : 2, ix = alongX ? 0 : 0.16, iz = alongX ? 0.16 : 0;
    W.add(x - lx / 2, 0, z - lz / 2, x + lx / 2, 0.9, z + lz / 2);
    L.box(x - lx / 2, 0, z - lz / 2, x + lx / 2, 0.32, z + lz / 2, 'concrete', { noCol: true });
    L.box(x - lx / 2 + ix, 0.32, z - lz / 2 + iz, x + lx / 2 - ix, 0.9, z + lz / 2 - iz, 'concrete', { noCol: true, ao: false });
    L.blob(x, z, lx + 0.8, lz + 0.8);
  }
  let flickerN = 0, lampN = 0;
  const LAMP_PAL = ['cyan', 'magenta', 'violet', 'cyan', 'yellow', 'magenta'];  // neon collar on the pole
  const HEAD_PAL = ['sodium', 'led', 'sodium', 'sodium', 'led'];              // the lamp itself: real street lighting
  function lampPost(x, z, dx, dz, o) {
    o = o || {};
    L.box(x - 0.35, 0, z - 0.35, x + 0.35, 0.5, z + 0.35, 'concrete');
    L.box(x - 0.13, 0.5, z - 0.13, x + 0.13, 7.6, z + 0.13, 'paintGrey');
    const ax = x + dx * 1.4, az = z + dz * 1.4;
    L.box(Math.min(x, ax) - 0.07, 7.35, Math.min(z, az) - 0.07, Math.max(x, ax) + 0.07, 7.5, Math.max(z, az) + 0.07, 'paintGrey', { noCol: true });
    L.box(ax - 0.36, 7.1, az - 0.22, ax + 0.36, 7.38, az + 0.22, 'paintDark', { noCol: true });
    const cn = o.color || LAMP_PAL[lampN % LAMP_PAL.length], hn = o.head || HEAD_PAL[lampN % HEAD_PAL.length];
    lampN++;
    let key = 'neon_' + hn, mat = null;
    if (o.flicker) { key = 'lampFlicker' + (flickerN++); mat = L.mats[key] = L.mats['neon_' + hn].clone(); }
    L.box(ax - 0.29, 7.05, az - 0.16, ax + 0.29, 7.1, az + 0.16, key, { noCol: true, ao: false });
    L.box(x - 0.14, 2.2, z - 0.14, x + 0.14, 2.35, z + 0.14, 'neon_' + cn, { noCol: true, ao: false });
    return L.lamp(ax, 6.9, az, { color: CF.Neon.HEX[hn], intensity: 2.6, distance: 21, cone: 3.8, flicker: o.flicker, mat, poolStrength: 0.42 });
  }
  function barrel(x, z, y) { L.addBarrel(x, y || 0, z); L.blob(x, z, 1.1, 1.1, y || 0); }
  function stairs(x0, z0, x1, z1, yBase, yTop, dir, m) {
    const n = Math.round((yTop - yBase) / 0.3), rise = (yTop - yBase) / n, k = n - 1;
    const len = dir[0] === 'x' ? x1 - x0 : z1 - z0, d = len / k;
    const o = { top: 'metalFloor', surf: 'metal' };
    for (let i = 1; i <= k; i++) {
      const top = yBase + rise * i;
      if (dir === 'x+') L.box(x0 + (i - 1) * d, yBase, z0, x0 + i * d, top, z1, m, o);
      else if (dir === 'x-') L.box(x1 - i * d, yBase, z0, x1 - (i - 1) * d, top, z1, m, o);
      else if (dir === 'z+') L.box(x0, yBase, z0 + (i - 1) * d, x1, top, z0 + i * d, m, o);
      else L.box(x0, yBase, z1 - i * d, x1, top, z1 - (i - 1) * d, m, o);
    }
  }
  /** Rectangular building with one door gap. side: 'n'|'s'|'e'|'w'; gap along that wall [g0,g1]. */
  function shed(x0, z0, x1, z1, h, side, g0, g1, m) {
    const t = 0.4, dh = 3.0;
    const wall = (a0, a1, b0, b1) => L.box(a0, 0, b0, a1, h, b1, m);
    const gapX = (zA, zB) => { wall(x0, g0, zA, zB); wall(g1, x1, zA, zB); L.box(g0, dh, zA, g1, h, zB, m); };
    const gapZ = (xA, xB) => { wall(xA, xB, z0 + t, g0); wall(xA, xB, g1, z1 - t); L.box(xA, dh, g0, xB, h, g1, m); };
    if (side === 'n') gapX(z0, z0 + t); else wall(x0, x1, z0, z0 + t);
    if (side === 's') gapX(z1 - t, z1); else wall(x0, x1, z1 - t, z1);
    if (side === 'w') gapZ(x0, x0 + t); else wall(x0, x0 + t, z0 + t, z1 - t);
    if (side === 'e') gapZ(x1 - t, x1); else wall(x1 - t, x1, z0 + t, z1 - t);
    L.box(x0 - 0.25, h, z0 - 0.25, x1 + 0.25, h + 0.3, z1 + 0.25, 'wall', { nav: false });
  }
  function screenMesh(mat, x, y, z, face, w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w || 0.9, h || 0.56), mat);
    m.position.set(x, y, z); m.rotation.y = FACE_ROT[face];
    L.scene.add(m); return m;
  }
  function statusLight(x, y, z, red) {
    const mat = (red ? L.mats.lampRed : L.mats.lampGreen).clone();
    const bulb = new THREE.Mesh(L.geo('box'), mat); bulb.scale.set(0.16, 0.16, 0.16); bulb.position.set(x, y, z); L.scene.add(bulb);
    const lamp = L.lamp(x, y, z, { color: red ? 0xff3020 : 0x40ff70, intensity: 0.9, distance: 5, pool: false, mat });
    return lamp;
  }
  /** Wall-mounted breaker. (x,z) is the wall surface point, face = direction the panel faces. */
  function breaker(id, x, y, z, face, label) {
    const f = FACE_DIR[face], px = x + f[0] * 0.15, pz = z + f[1] * 0.15;
    const hw = 0.8, hd = 0.15;
    const sx = f[0] !== 0 ? hd : hw, sz = f[0] !== 0 ? hw : hd;
    L.box(px - sx, y + 0.9, pz - sz, px + sx, y + 2.2, pz + sz, 'paintGrey', { surf: 'metal' });
    L.box(px - sx * 1.2, y + 2.2, pz - sz * 1.2, px + sx * 1.2, y + 2.35, pz + sz * 1.2, 'hazard', { noCol: true });
    const scr = screenMesh(L.mats.screenOff, px + f[0] * 0.16, y + 1.7, pz + f[1] * 0.16, face, 0.9, 0.56);
    const lamp = statusLight(px + f[0] * 0.2 + (f[1] !== 0 ? 0.6 : 0), y + 1.2, pz + f[1] * 0.2 + (f[0] !== 0 ? 0.6 : 0), true);
    return L.addInteract({ id, type: 'breaker', label, pos: [px + f[0] * 0.95, y + 0.9, pz + f[1] * 0.95], face: f, radius: 1.9, hold: 3.2, prompt: 'Hold to restore power', screen: scr, lamp, done: false, enabled: false });
  }
  function ammoCache(id, x, y, z, face) {
    const f = FACE_DIR[face], along = f[0] === 0;
    const hx = along ? 0.7 : 0.4, hz = along ? 0.4 : 0.7;
    L.box(x - hx, y, z - hz, x + hx, y + 0.85, z + hz, 'paintGreen', { surf: 'metal' });
    L.box(x - hx - 0.04, y + 0.85, z - hz - 0.04, x + hx + 0.04, y + 0.97, z + hz + 0.04, 'paintDark', { noCol: true });
    L.box(x - hx * 0.6 + f[0] * 0.02, y + 0.3, z - hz * 0.6 + f[1] * 0.02, x + hx * 0.6 + f[0] * 0.02, y + 0.42, z + hz * 0.6 + f[1] * 0.02, 'hazard', { noCol: true });
    L.blob(x, z, hx * 2 + 0.8, hz * 2 + 0.8, y);
    const lamp = statusLight(x + f[0] * (hx + 0.03), y + 0.7, z + f[1] * (hz + 0.03), false);
    return L.addInteract({ id, type: 'ammo', pos: [x + f[0] * 1.0, y, z + f[1] * 1.0], face: f, radius: 1.8, hold: 0, prompt: 'Resupply ammunition', lamp, cooldownMax: 40 });
  }

  Map.build = function () {
    const M = L.mats;
    // ---------------------------------------------------------------- ground + perimeter
    L.box(-72, -2, -64, 72, 0, 64, 'asphalt', { surf: 'concrete', ao: false });
    L.box(-66, 0, -58, 66, 8, -56, 'concreteDark');
    L.box(-66, 0, 56, 66, 8, 58, 'concreteDark');
    L.box(-66, 0, -56, -64, 8, 56, 'concreteDark');
    L.box(64, 0, -56, 66, 8, 56, 'concreteDark');
    for (let x = -60; x <= 60; x += 12) {
      L.box(x - 0.6, 0, -56, x + 0.6, 8.6, -55.4, 'concreteDark');
      L.box(x - 0.6, 0, 55.4, x + 0.6, 8.6, 56, 'concreteDark');
    }
    for (let z = -48; z <= 48; z += 12) {
      L.box(-64, 0, z - 0.6, -63.4, 8.6, z + 0.6, 'concreteDark');
      L.box(63.4, 0, z - 0.6, 64, 8.6, z + 0.6, 'concreteDark');
    }
    // wire on the wall tops (visual)
    L.box(-66, 8.3, -57.1, 66, 8.36, -57.0, 'steel', { noCol: true }); L.box(-66, 8.3, 57.0, 66, 8.36, 57.1, 'steel', { noCol: true });
    L.box(-65.1, 8.3, -56, -65.0, 8.36, 56, 'steel', { noCol: true }); L.box(65.0, 8.3, -56, 65.1, 8.36, 56, 'steel', { noCol: true });

    // ---------------------------------------------------------------- south dock (start)
    L.box(-18, 0, 44, 18, 1.2, 56, 'concrete', { top: 'metalFloor' });
    L.box(-18, 1.2, 43.95, 18, 1.28, 44.1, 'hazard', { noCol: true, ao: false });
    for (const bx of [-15, -9, 9, 15]) L.box(bx - 0.4, 0.3, 43.7, bx + 0.4, 1.0, 44, 'rubber', { noCol: true });
    stairs(-3, 42.2, 3, 44, 0, 1.2, 'z+', 'concrete');
    stairs(-12, 42.2, -9, 44, 0, 1.2, 'z+', 'concrete');
    stairs(9, 42.2, 12, 44, 0, 1.2, 'z+', 'concrete');
    L.box(-18, 6.4, 45, 18, 6.8, 56, 'wall', { nav: false });
    for (const cx of [-17.5, -6, 6, 17.5]) L.box(cx - 0.22, 1.2, 45.28, cx + 0.22, 6.4, 45.72, 'paintYellow');
    for (const lx of [-10, 0, 10]) {
      L.box(lx - 1.1, 6.28, 49.8, lx + 1.1, 6.4, 50.2, 'lampCool', { noCol: true, ao: false });
      L.lamp(lx, 6.1, 50, { color: 0xcfe0ff, intensity: 1.5, distance: 14, prio: 0.3, poolSize: 9, poolStrength: 0.2 });
    }
    // trailers
    L.propBox('cont_white', -15, 1.2, 50.75, 3.0, 3.2, 9.5, 0);
    W.add(-16.5, 1.2, 46, -13.5, 4.4, 55.5, { surf: 'metal' });
    L.propBox('cont_blue', 15, 1.2, 50.25, 3.0, 3.2, 9.5, 0);
    W.add(13.5, 1.2, 45.5, 16.5, 4.4, 55, { surf: 'metal' });
    // roll-up doors on the south wall
    for (const dx of [-8, 8]) L.box(dx - 2.6, 1.2, 55.8, dx + 2.6, 5.2, 56, 'wall', { noCol: true, ao: false });
    crate(-6, 1.2, 48.4); crate(-4.8, 1.2, 48.4); crate(-5.4, 2.4, 48.4, 1.0);
    crate(4, 1.2, 53.5); crate(10.5, 1.2, 47);
    ammoCache('cacheDock', 6.2, 1.2, 47.2, 'z-');
    L.points.start = { x: 0, y: 1.2, z: 52, yaw: 0 };

    // ---------------------------------------------------------------- the yard
    container(-10, 30, true, 'red');
    container(8, 30, true, 'blue', 2);
    container(24, 34, false, 'green');
    container(-26, 22, false, 'orange', 2);
    container(-4, 17, true, 'white');
    container(14, 16, true, 'red');
    container(18.3, 11, false, 'blue');
    container(-36, 34, true, 'blue');
    container(34, 22, false, 'orange', 2);
    container(-18, 5, false, 'green');
    container(28, 3, true, 'white');
    container(-46, 26, true, 'red');
    container(46, 36, true, 'green');
    crate(-14.2, 0, 29.4); crate(-14.2, 0, 30.6); crate(-15.4, 0, 30.0, 1.0);
    crate(-8.2, 0, 19.6); crate(-5.5, 0, 20.2); crate(10.2, 0, 13.4);
    crate(21, 0, 36.2); crate(26.4, 0, 31.4, 1.0); crate(-28.4, 0, 26.2); crate(36.2, 0, 26.2);
    crate(-47.5, 0, 28.4); crate(-44.7, 0, 28.4, 1.0); crate(44.6, 0, 33.6);
    for (const b of [[0, 36, 1], [-6, 38.5, 1], [6, 38.5, 1], [-14, 22, 1], [2, 23, 1], [20, 24, 0], [-30, 12, 0], [30, 12, 1], [-8, 8, 1], [8, 6, 0], [-40, 4, 1], [40, 26, 0], [0, 11, 1]]) barrier(b[0], b[1], !!b[2]);
    lampPost(-22, 37, 1, 0); lampPost(18, 38, -1, 0); lampPost(-2, 26, 0, -1, { flicker: 0.12 });
    lampPost(-32, 14, 1, 0); lampPost(26, 10, 0, 1); lampPost(2, 0, 0, 1);
    lampPost(46, 28, -1, 0); lampPost(-50, 2, 0, 1); lampPost(-24, -4, 0, 1, { flicker: 0.2 }); lampPost(24, -4, 0, 1);
    lampPost(-48, 40, 1, 0);
    for (const b of [[-11.5, 27.6], [6.2, 27.2], [-24, 17.5], [15, 13.5], [30.5, 6], [-16.5, 9.5], [43, 7], [-41, 17], [3, 13], [-33, 30]]) barrel(b[0], b[1]);
    // painted walkway lines
    L.box(-4.1, 0, -7, -3.9, 0.012, 42, 'line', { noCol: true, ao: false });
    L.box(3.9, 0, -7, 4.1, 0.012, 42, 'line', { noCol: true, ao: false });
    L.box(-6, 0, -6.6, 6, 0.012, -6.3, 'line', { noCol: true, ao: false });
    for (let z = 34; z >= 6; z -= 7) L.box(-40.1, 0, z - 2.5, -39.9, 0.012, z + 2.5, 'line', { noCol: true, ao: false });

    // generator shed (east) — breaker 1
    shed(42, 8, 54, 20, 4.5, 'w', 12.5, 15.5, 'wall');
    L.box(47, 0, 10.5, 52.5, 2.2, 14, 'paintYellow');
    L.box(47.6, 2.2, 11, 49.4, 2.8, 13.5, 'paintDark');
    L.pipe('steel', 51, 2.2, 12.2, 51, 6.3, 12.2, 0.22);
    L.box(44, 4.1, 15.8, 50, 4.2, 16.2, 'lampCool', { noCol: true, ao: false });
    L.lamp(47, 3.9, 16, { color: 0xbfd8ff, intensity: 1.4, distance: 12, prio: 0.6, poolSize: 8, poolStrength: 0.18 });
    breaker('breakerA', 45.6, 0, 8.4, 'z+', 'Generator shed');
    L.emitters.push({ type: 'smoke', x: 51, y: 6.4, z: 12.2, rate: 3 });
    // pump house (west) — breaker 2
    shed(-54, 4, -42, 16, 4.5, 'e', 8.5, 11.5, 'wall');
    L.box(-51, 0, 5.8, -48.6, 1.7, 8.2, 'paintGreen'); L.box(-51, 0, 11.8, -48.6, 1.7, 14.2, 'paintGreen');
    L.cyl('steel', -49.8, 2.0, 7, 0.55, 0.6); L.cyl('steel', -49.8, 2.0, 13, 0.55, 0.6);
    L.pipe('steel', -52.8, 3.4, 4.6, -52.8, 3.4, 15.4, 0.2); L.pipe('steel', -49.8, 2.3, 7, -49.8, 3.4, 7, 0.14); L.pipe('steel', -49.8, 2.3, 13, -49.8, 3.4, 13, 0.14);
    L.box(-50, 4.1, 9.8, -46, 4.2, 10.2, 'lampCool', { noCol: true, ao: false });
    L.lamp(-48, 3.9, 10, { color: 0xbfd8ff, intensity: 1.4, distance: 12, prio: 0.6, poolSize: 8, poolStrength: 0.18, flicker: 0.08 });
    breaker('breakerB', -53.6, 0, 10, 'x+', 'Pump house');
    // fuel tanks (south-west)
    for (const t of [[-52, 44, 4, 7], [-40, 48, 3, 6]]) {
      L.cyl('paintGrey', t[0], t[3] / 2, t[1], t[2], t[3]);
      L.cyl('paintDark', t[0], t[3] + 0.15, t[1], t[2] * 0.96, 0.3);
      for (const ry of [0.25, 0.75]) L.cyl('paintDark', t[0], t[3] * ry, t[1], t[2] + 0.04, 0.18);
      const s = t[2] * 0.8; W.add(t[0] - s, 0, t[1] - s, t[0] + s, t[3], t[1] + s, { surf: 'metal' });
      L.blob(t[0], t[1], t[2] * 2.6, t[2] * 2.6);
    }
    L.pipe('steel', -48, 1.2, 44, -46, 1.2, 16.4, 0.25);
    // pipe rack (east)
    for (let z = -2; z <= 38; z += 8) {
      L.box(58.3, 0, z - 0.15, 58.6, 5, z + 0.15, 'paintYellow', { shoot: false });
      L.box(59.4, 0, z - 0.15, 59.7, 5, z + 0.15, 'paintYellow', { shoot: false });
      L.box(58.2, 4.6, z - 0.2, 59.8, 4.8, z + 0.2, 'paintYellow', { noCol: true });
    }
    L.pipe('steel', 58.7, 5.1, -3, 58.7, 5.1, 39, 0.26); L.pipe('rubber', 59.35, 5.05, -3, 59.35, 5.05, 39, 0.2);
    L.pipe('steel', 59.0, 5.55, -3, 59.0, 5.55, 39, 0.14);

    // ---------------------------------------------------------------- foundry hall
    const R = 'wallRust';
    L.box(-30, 0, -8.8, -5, 12, -8, R); L.box(5, 0, -8.8, 30, 12, -8, R); L.box(-5, 7, -8.8, 5, 12, -8, R);
    L.box(-30, 0, -42, 30, 12, -41.2, R);
    L.box(-30, 0, -41.2, -29.2, 12, -22, R); L.box(-30, 0, -18, -29.2, 12, -8.8, R); L.box(-30, 5.8, -22, -29.2, 12, -18, R);
    L.box(29.2, 0, -41.2, 30, 12, -22, R); L.box(29.2, 0, -18, 30, 12, -8.8, R); L.box(29.2, 5.8, -22, 30, 12, -18, R);
    L.box(-30.5, 12, -42.5, 30.5, 12.6, -7.5, 'wallRust', { nav: false });
    for (let z = -14; z >= -38; z -= 6) L.box(-29.2, 10.6, z - 0.25, 29.2, 11.2, z + 0.25, 'paintDark', { nav: false });
    for (const x of [-20, -10, 10, 20]) L.box(x - 0.4, 0.8, -9.6, x + 0.4, 12, -8.8, 'paintYellow');
    for (const x of [-20, -10, 0, 10]) L.box(x - 0.4, 0.8, -41.2, x + 0.4, 12, -40.4, 'paintYellow');
    // floor slabs + molten channel + bridges
    L.box(-29.2, 0, -28.5, 29.2, 0.8, -8.8, 'concrete', { top: 'metalFloor' });
    L.box(-29.2, 0, -41.2, 29.2, 0.8, -31.5, 'concrete', { top: 'metalFloor' });
    L.box(-5, 0, -8.8, 5, 0.8, -8, 'concrete', { top: 'metalFloor' });
    L.box(-6, 0, -8, 6, 0.4, -7.2, 'concrete', { top: 'metalFloor' });
    L.box(-5.4, 0.4, -8.0, -5.0, 7, -7.8, 'hazard'); L.box(5.0, 0.4, -8.0, 5.4, 7, -7.8, 'hazard'); L.box(-5.4, 7, -8.0, 5.4, 7.4, -7.8, 'hazard');
    L.box(-30, 0, -22, -29.2, 0.8, -18, 'concrete', { top: 'metalFloor' }); L.box(-31.2, 0, -22.5, -30, 0.4, -17.5, 'concrete', { top: 'metalFloor' });
    L.box(29.2, 0, -22, 30, 0.8, -18, 'concrete', { top: 'metalFloor' }); L.box(30, 0, -22.5, 31.2, 0.4, -17.5, 'concrete', { top: 'metalFloor' });
    for (const bx of [-14, 0, 14]) {
      L.box(bx - 1.25, 0.5, -31.5, bx + 1.25, 0.8, -28.5, 'metalFloor', { surf: 'metal' });
      L.box(bx - 1.25, 0.8, -31.5, bx - 1.15, 1.85, -28.5, 'steel', { shoot: false });
      L.box(bx + 1.15, 0.8, -31.5, bx + 1.25, 1.85, -28.5, 'steel', { shoot: false });
    }
    const mtex = CF.Tex.list.molten.map.clone(); mtex.needsUpdate = true; mtex.repeat.set(19.5, 1);
    M.molten.map = mtex;
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(58.4, 3), M.molten);
    lava.rotation.x = -PI / 2; lava.position.set(0, 0.3, -30); L.scene.add(lava);
    for (const zz of [-31.5, -28.5]) L.box(-29.2, 0.78, zz - 0.06, 29.2, 0.86, zz + 0.06, 'hazard', { noCol: true, ao: false });
    L.hazards.push({ minX: -29.2, maxX: 29.2, minZ: -31.5, maxZ: -28.5, maxY: 0.62, dps: 40, type: 'molten' });
    for (const lx of [-18, 0, 18]) L.lamp(lx, 1.6, -30, { color: 0xff5a14, intensity: 3.4, distance: 15, prio: 1.6, pool: false });
    // crane + ladle pouring into the channel
    L.box(-29.2, 9.4, -30.7, 29.2, 10.2, -29.3, 'paintYellow', { nav: false });
    L.box(4.5, 8.6, -30.9, 7.5, 9.4, -29.1, 'paintDark', { nav: false });
    L.pipe('steel', 6, 8.6, -30, 6, 6.6, -30, 0.05);
    L.cyl('paintDark', 6, 5.8, -30, 1.1, 1.6); L.cyl('moltenTop', 6, 6.62, -30, 0.95, 0.05);
    L.pipe('molten', 6.9, 5.4, -30, 6.9, 0.3, -30, 0.16);
    L.emitters.push({ type: 'pour', x: 6.9, y: 0.4, z: -30, rate: 26 });
    // casting machines and cover
    L.box(-24, 0.8, -18, -18, 3.8, -13, 'paintYellow'); L.box(-23, 3.8, -17, -19, 4.6, -14, 'paintDark');
    L.box(18, 0.8, -18, 24, 3.8, -13, 'paintYellow'); L.box(19, 3.8, -17, 23, 4.6, -14, 'paintDark');
    L.box(-12, 0.8, -24, -8, 2.3, -21.5, 'paintGrey'); L.box(8, 0.8, -24, 12, 2.3, -21.5, 'paintGrey');
    L.box(-6, 0.8, -15, 6, 1.9, -13.6, 'paintDark');
    for (let x = -5; x <= 5; x += 2.5) L.box(x - 0.5, 1.9, -14.7, x + 0.5, 2.3, -13.9, 'steel', { noCol: true });
    crate(-27.6, 0.8, -24); crate(-27.6, 0.8, -25.2); crate(27.4, 0.8, -26); crate(-16, 0.8, -26.8, 1.0); crate(15.5, 0.8, -10.8);
    ammoCache('cacheHall', -26.5, 0.8, -11, 'x+');
    // north half: crucibles + control platform
    for (const cx of [-18, -2]) {
      L.cyl('paintDark', cx, 0.8 + 1.8, -36.5, 2.6, 3.6); L.cyl('steel', cx, 0.8 + 3.55, -36.5, 2.75, 0.2);
      L.cyl('moltenTop', cx, 0.8 + 3.62, -36.5, 2.3, 0.04);
      W.add(cx - 2.1, 0.8, -38.6, cx + 2.1, 4.4, -34.4, { surf: 'metal' });
      L.lamp(cx, 5.8, -36.5, { color: 0xff7a2a, intensity: 2.2, distance: 12, prio: 0.8, pool: false });
      L.emitters.push({ type: 'embers', x: cx, y: 4.5, z: -36.5, rate: 5 });
    }
    L.box(20, 0.8, -41.2, 29.2, 3.8, -33, 'concrete', { top: 'metalFloor' });
    stairs(14.6, -36, 20, -33, 0.8, 3.8, 'x+', 'concrete');
    L.box(20, 3.8, -41.2, 20.12, 4.9, -36, 'steel', { shoot: false });
    L.box(20, 3.8, -33.12, 29.2, 4.9, -33, 'steel', { shoot: false });
    L.box(22, 3.8, -40.8, 24.2, 4.8, -40.0, 'paintDark');
    screenMesh(M.screenIdle, 23.1, 5.25, -39.98, 'z+', 1.2, 0.72);
    breaker('breakerC', 26.4, 3.8, -41.2, 'z+', 'Foundry control');
    L.box(22, 7.4, -37.3, 27, 7.5, -36.7, 'lampCool', { noCol: true, ao: false });
    L.lamp(24.5, 7.2, -37, { color: 0xc8dcff, intensity: 1.6, distance: 14, prio: 0.8, poolSize: 8, poolStrength: 0.15 });
    for (const lx of [-15, 15]) {
      L.box(lx - 2, 10.3, -18.2, lx + 2, 10.4, -17.8, 'lampCool', { noCol: true, ao: false });
      L.lamp(lx, 10.1, -18, { color: 0xbcd4ff, intensity: 1.7, distance: 20, prio: 0.6, poolSize: 12, poolStrength: 0.12 });
    }
    // facade: sign + warm clerestory windows
    CF.Neon.sign('CINDER FOUNDRY', 'magenta', 0, 9.4, -7.9, 'z+', 2.2, { intensity: 2.4, distance: 16 });
    CF.Neon.sign('鋳造', 'cyan', -12, 9.6, -7.9, 'z+', 1.6, { light: false });
    CF.Neon.sign('SECTOR 7', 'yellow', 12, 9.6, -7.9, 'z+', 1.1, { light: false, flicker: 0.1 });
    CF.Neon.strip(-30, 11.8, -7.96, -6, 11.95, -7.9, 'cyan'); CF.Neon.strip(6, 11.8, -7.96, 30, 11.95, -7.9, 'cyan');
    CF.Neon.strip(-30.06, 11.8, -42, -30.0, 11.95, -8, 'magenta'); CF.Neon.strip(30.0, 11.8, -42, 30.06, 11.95, -8, 'magenta');
    const pane = { noCol: true, ao: false };
    for (const wx of [-25, -17, 17, 25]) for (const o of [-1.6, 0, 1.6]) L.box(wx + o - 0.7, 9, -7.99, wx + o + 0.7, 10.6, -7.94, 'windowWarm', pane);
    for (const wz of [-36, -28, -14]) for (const o of [-1.6, 0, 1.6]) { L.box(-30.06, 9, wz + o - 0.7, -30.0, 10.6, wz + o + 0.7, 'windowWarm', pane); L.box(30.0, 9, wz + o - 0.7, 30.06, 10.6, wz + o + 0.7, 'windowWarm', pane); }
    for (const sx of [-8, 8]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), M.signDanger); s.position.set(sx, 1.5, -28.42); L.scene.add(s); L.box(sx - 0.05, 0.8, -28.6, sx + 0.05, 1.2, -28.5, 'steel', { noCol: true }); }
    // side doors (sealed until power is restored)
    L.addDoor('hallW', -29.9, 0.8, -22, -29.3, 5.8, -18, 'paintDark', { light: [-31, 6.3, -20] });
    L.addDoor('hallE', 29.3, 0.8, -22, 29.9, 5.8, -18, 'paintDark', { light: [31, 6.3, -20] });
    for (const b of [[-22, -11.5, 0.8], [22, -11.5, 0.8], [-10, -26.8, 0.8], [26, -24, 0.8]]) barrel(b[0], b[1], b[2]);

    // ---------------------------------------------------------------- east path + uplink terrace
    container(35, -20, false, 'white'); container(34, -47, false, 'red');
    crate(38, 0, -12); crate(39.2, 0, -12); crate(38.6, 1.2, -12, 1.0); crate(32.5, 0, -30); crate(33.7, 0, -30.6, 1.0);
    lampPost(35, -9.5, 0, -1); lampPost(46, -30, -1, 0);
    L.box(40, 0, -56, 64, 1.5, -34, 'concrete', { top: 'concrete' });
    L.box(40, 1.5, -34.1, 64, 1.56, -33.95, 'hazard', { noCol: true, ao: false });
    stairs(48, -34, 54, -31.6, 0, 1.5, 'z-', 'concrete');
    stairs(37.6, -47, 40, -43, 0, 1.5, 'x+', 'concrete');
    L.box(50, 1.5, -46.6, 52.4, 2.6, -45.6, 'paintDark');
    const upScreen = screenMesh(M.screenUplink, 51.2, 2.2, -45.57, 'z+', 1.3, 0.8);
    L.box(56, 1.5, -52, 58.5, 2.1, -49.5, 'concrete');
    for (const lx of [56.3, 58.2]) for (const lz of [-51.7, -49.8]) L.pipe('steel', lx, 2.1, lz, 57.25 + (lx - 57.25) * 0.25, 26, -50.75 + (lz + 50.75) * 0.25, 0.09);
    for (let y = 5; y < 25; y += 4) L.box(56.4 + y * 0.03, y, -51.6 + y * 0.03, 58.1 - y * 0.03, y + 0.12, -49.9 - y * 0.03, 'steel', { noCol: true, nav: false });
    L.cyl('paintGrey', 57.25, 20, -50.75, 1.6, 0.3, 1.1, 0);
    const beaconMat = M.lampRed.clone();
    const beacon = new THREE.Mesh(L.geo('sphere'), beaconMat); beacon.scale.setScalar(0.3); beacon.position.set(57.25, 26.3, -50.75); L.scene.add(beacon);
    L.animated.push((dt, t) => { beacon.visible = (t % 1.6) < 0.5; });
    const upLamp = statusLight(52.6, 2.4, -45.5, true);
    L.addInteract({ id: 'uplink', type: 'uplink', pos: [51.2, 1.5, -44.6], face: [0, 1], radius: 2.0, hold: 1.2, prompt: 'Start the override upload', screen: upScreen, lamp: upLamp, enabled: false });
    for (const c of [[44.7, -45.2, 45.3, -42.8], [49.8, -39.3, 52.2, -38.7], [56.7, -43.2, 57.3, -40.8], [44.8, -50.3, 47.2, -49.7], [53.8, -50.3, 55.4, -49.7]]) L.box(c[0], 1.5, c[1], c[2], 2.6, c[3], 'concrete');
    ammoCache('cacheUplink', 43.6, 1.5, -36.6, 'z+');
    L.lamp(58, 6.5, -40, { color: 0xcfe0ff, intensity: 1.8, distance: 18, prio: 0.4, poolSize: 12, poolStrength: 0.18 });
    L.box(57.6, 1.5, -40.3, 58.4, 6.6, -39.7, 'paintGrey'); L.box(57.4, 6.5, -40.4, 58.6, 6.8, -39.6, 'lampCool', { noCol: true, ao: false });
    barrel(37, -28); barrel(60.5, -37, 1.5); barrel(41.5, -52.5, 1.5);

    // ---------------------------------------------------------------- west path + arena
    const CD = 'concreteDark';
    L.box(-64, 0, -24.6, -52, 7, -24, CD); L.box(-46, 0, -24.6, -34.8, 7, -24, CD); L.box(-52, 6, -24.6, -46, 7, -24, CD);
    L.box(-34.8, 0, -56, -34, 7, -24, CD);
    L.box(-64, 7, -24.7, -34, 7.25, -23.9, 'hazard', { noCol: true, ao: false });
    L.box(-34.9, 7, -56, -33.9, 7.25, -24, 'hazard', { noCol: true, ao: false });
    L.addDoor('arenaGate', -52, 0, -24.5, -46, 6, -24.1, 'paintDark', { light: [-49, 6.6, -23.6], lift: 6.2 });
    container(-40, -16, true, 'blue'); crate(-44, 0, -12); crate(-44, 0, -10.8, 1.0); crate(-56.5, 0, -16);
    lampPost(-46, -12, 0, -1); lampPost(-58, -20, 1, 0);
    ammoCache('cacheWest', -61, 0, -12, 'x+');
    barrel(-56, -12); barrel(-33, -20);
    L.box(-54, 0, -45, -44, 0.5, -35, 'metalFloor', { surf: 'metal' });
    L.box(-54, 0.5, -45, -44, 0.53, -44.85, 'hazard', { noCol: true, ao: false }); L.box(-54, 0.5, -35.15, -44, 0.53, -35, 'hazard', { noCol: true, ao: false });
    for (const p of [[-60, -32], [-40, -32], [-60, -52], [-40, -52]]) { L.box(p[0] - 1, 0, p[1] - 1, p[0] + 1, 6, p[1] + 1, CD); L.box(p[0] - 1.05, 5.4, p[1] - 1.05, p[0] + 1.05, 5.6, p[1] + 1.05, 'hazard', { noCol: true }); }
    L.box(-50, 0, -30.3, -47, 1.1, -29.7, 'concrete'); L.box(-50, 0, -52.3, -47, 1.1, -51.7, 'concrete');
    L.box(-37.3, 0, -42, -36.7, 1.1, -38, 'concrete');
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), M.pad); pad.rotation.x = -PI / 2; pad.position.set(-59, 0.02, -40); L.scene.add(pad);
    for (const f of [[-62, -26.6], [-36.6, -26.6], [-62, -53.4], [-36.6, -53.4]]) {
      L.box(f[0] - 0.2, 0, f[1] - 0.2, f[0] + 0.2, 9.4, f[1] + 0.2, 'paintGrey');
      L.box(f[0] - 0.6, 9.1, f[1] - 0.6, f[0] + 0.6, 9.5, f[1] + 0.6, 'lampCool', { noCol: true });
      L.lamp(f[0], 8.8, f[1], { color: 0xd4e2ff, intensity: 1.9, distance: 22, prio: 0.3, poolSize: 12, poolStrength: 0.14, zone: 'arena' });
    }
    ammoCache('cacheArena', -36.2, 0, -47, 'x-');
    L.points.arenaAlarms = [[-49, 6.4, -24.9], [-63.4, 6, -40], [-35.4, 6, -40], [-49, 6, -55.4]].map((p) => L.lamp(p[0], p[1], p[2], { color: 0xff2a14, intensity: 0, distance: 18, pool: false, zone: 'arena', on: false, pulse: 5 }));

    // ---------------------------------------------------------------- points, spawns, placements
    // neon dressing: signs, holo adverts, vending machines, edge strips
    CF.Neon.strip(-18, 6.37, 44.92, 18, 6.43, 45.0, 'led');
    CF.Neon.sign('POWER', 'yellow', 41.9, 3.7, 17.5, 'x-', 0.8, { distance: 9 });
    CF.Neon.sign('PUMP 02', 'cyan', -41.9, 3.7, 6.2, 'x+', 0.8, { distance: 9 });
    CF.Neon.sign('UPLINK', 'green', 50, 3.6, -33.8, 'z+', 0.9, { distance: 10 });
    CF.Neon.sign('NO EXIT', 'red', -49, 7.6, -23.9, 'z+', 0.8, { light: false, flicker: 0.25 });
    CF.Neon.holo(0, 8, 8.6, 31.3, 0, 6, 3);
    CF.Neon.holo(4, 32.6, 8.2, 22, -Math.PI / 2, 6, 3);
    CF.Neon.holo(1, -27.3, 8.4, 22, -Math.PI / 2, 5.6, 2.8);
    for (const v of [[-22.6, 0, 33.2, 'z+', 'cyan'], [12.6, 0, 20.8, 'z+', 'magenta'], [-37.4, 0, -9.8, 'x+', 'yellow']]) {
      const [vx, vy, vz, face, col] = v, sx = face[0] === 'x' ? 0.45 : 0.6, sz = face[0] === 'x' ? 0.6 : 0.45;
      L.box(vx - sx, vy, vz - sz, vx + sx, vy + 1.9, vz + sz, 'paintDark');
      const f = FACE_DIR[face];
      L.box(vx - sx * 0.8 + f[0] * sx, vy + 0.5, vz - sz * 0.8 + f[1] * sz, vx + sx * 0.8 + f[0] * (sx + 0.02), vy + 1.75, vz + sz * 0.8 + f[1] * (sz + 0.02), 'neon_' + col, { noCol: true, ao: false });
      L.lamp(vx + f[0] * 1.1, vy + 1.3, vz + f[1] * 1.1, { color: CF.Neon.HEX[col], intensity: 1.3, distance: 7, pool: true, poolSize: 4, poolStrength: 0.5 });
    }
    CF.Neon.strip(-64, 6.9, -24.75, -52, 7.0, -24.62, 'red'); CF.Neon.strip(-46, 6.9, -24.75, -34.8, 7.0, -24.62, 'red');
    L.points.yardCenter = { x: 0, y: 0, z: 22 };
    L.points.yardCP = { x: 0, y: 0, z: 24, yaw: 0 };
    L.points.uplink = { x: 51.2, y: 1.5, z: -44.6 };
    L.points.uplinkCP = { x: 32.5, y: 0, z: -14, yaw: Math.atan2(-1, 1) };
    L.points.arenaGate = { x: -49, y: 0, z: -22.5 };
    L.points.arenaCP = { x: -49, y: 0, z: -19, yaw: 0 };
    L.points.boss = { x: -49, y: 0.5, z: -40 };
    L.points.evac = { x: -59, y: 0, z: -40 };
    L.points.hallDoorE = { x: 31, y: 0, z: -20 };
    L.spawns.yard = [[-58, 34], [-30, 44], [58, 44], [60, 20], [40, -2], [-40, -4], [-60, 10], [20, -4], [-20, -4], [50, 50], [-58, 52]];
    L.spawns.hall = [[-26, -38.5], [-10, -39.5], [10, -39.5], [-26, -12], [26, -12], [12, -38.5]];
    L.spawns.east = [[34, -54], [62, -28], [36, -36], [46, -26], [60, -12], [32, -44], [62, -54], [42, -54]];
    L.spawns.west = [[-60, -10], [-36, -12], [-50, -18], [-62, -22]];
    L.spawns.arena = [[-62, -26.5], [-36.5, -26.5], [-62, -54], [-36.5, -54], [-49, -54], [-56, -27]];
    const S = PI; // face south
    L.points.yardEnemies = [
      { type: 'sentry', x: -11, z: 25.5, yaw: S, patrol: [[-18, 25.5], [-4, 25.5]] },
      { type: 'sentry', x: 8, z: 25, yaw: 0 },
      { type: 'sentry', x: 22, z: 27, yaw: S, patrol: [[22, 27], [28, 14]] },
      { type: 'sentry', x: -26, z: 12, yaw: S, patrol: [[-26, 12], [-10, 12]] },
      { type: 'sentry', x: 32, z: 16, yaw: -Math.PI / 2 },
      { type: 'sentry', x: 0, z: 3, yaw: S, patrol: [[0, 3], [0, -5]] },
      { type: 'stalker', x: -36, z: 26, yaw: 0.6 },
      { type: 'stalker', x: 42, z: 30, yaw: -0.4 }
    ];
    // no weapon pickups: weapons are unlocked by objectives (CF.Mission.unlocks)
    for (const a of [[-24, 0, 30], [26, 0, 20], [-47, 0, 10], [48, 0, 17.5], [6, 0.8, -39], [61, 1.5, -54], [-62, 0, -27], [-36.8, 0, -53], [12, 0.8, -26]]) L.addPickup('armor', a[0], a[1], a[2]);
  };
  Map.kit = { container, crate, barrier, lampPost, barrel, stairs, shed, screenMesh, statusLight, FACE_DIR, FACE_ROT };
})(window.CF);
