'use strict';
/* Cinderfall — NEON MARKET (multiplayer). Plus-shaped streets around a holo plaza, crossing alleys, two balconies. */
(function (CF) {
  const L = CF.Level, N = CF.Neon, U = CF.U;
  const MM = CF.MapMarket = {};
  const WORDS = ['RAMEN', 'ラーメン', 'CYBERWARE', 'BAR', 'HOTEL', 'PAWN', 'CLINIC', 'ARCADE', '寿司', 'KARAOKE', 'DATA', 'IMPLANTS', 'OPEN 24H', 'SOBA', 'TATTOO', '電気', 'CAFE', 'NEURO', 'LIQUOR', 'NOODLES'];
  const COLS = ['cyan', 'magenta', 'yellow', 'violet', 'pink', 'green', 'red', 'orange'];

  MM.build = function () {
    const K = CF.Map.kit, FD = K.FACE_DIR, rnd = U.mulberry32(2077);
    let si = 0;
    const bldg = (x0, z0, x1, z1, h) => {
      L.box(x0, 0, z0, x1, h, z1, 'facade', { top: 'concreteDark' });
      L.box(Math.min(x0, x1) - 0.2, h, Math.min(z0, z1) - 0.2, Math.max(x0, x1) + 0.2, h + 0.5, Math.max(z0, z1) + 0.2, 'concreteDark', { nav: false });
      if (rnd() < 0.6) { const c = COLS[Math.floor(rnd() * COLS.length)]; N.strip(Math.min(x0, x1), h + 0.5, Math.min(z0, z1), Math.max(x0, x1), h + 0.62, Math.min(z0, z1) + 0.1, c); }
    };
    const shopfront = (x, z, face, width) => {
      const f = FD[face], i = si++, alongX = face[0] === 'z';
      const hx = alongX ? width / 2 : 0.03, hz = alongX ? 0.03 : width / 2;
      const px = x + f[0] * 0.05, pz = z + f[1] * 0.05;
      L.box(px - hx, 0.35, pz - hz, px + hx, 2.5, pz + hz, i % 3 === 0 ? 'windowCool' : 'windowWarm', { noCol: true, ao: false });
      L.box(px - hx - (alongX ? 0.08 : 0) + f[0] * 0.02, 2.5, pz - hz - (alongX ? 0 : 0.08) + f[1] * 0.02, px + hx + (alongX ? 0.08 : 0) + f[0] * 0.02, 2.62, pz + hz + (alongX ? 0 : 0.08) + f[1] * 0.02, 'neon_' + COLS[i % COLS.length], { noCol: true, ao: false });
      N.sign(WORDS[(i * 7) % WORDS.length], COLS[(i + 3) % COLS.length], x + f[0] * 0.08, 3.1 + (i % 2) * 0.25, z + f[1] * 0.08, face, 0.75, { flicker: i % 5 === 0 ? 0.15 : 0, intensity: 1.5, distance: 9, lightOff: 1.4 });
    };
    const stall = (cx, cz, alongX, toward) => {
      // toward: +1/-1 — direction (on the non-along axis) from the stall's back to the street centre
      const lx = alongX ? 1.2 : 0.6, lz = alongX ? 0.6 : 1.2;
      L.box(cx - lx, 0, cz - lz, cx + lx, 1.05, cz + lz, 'paintDark');
      L.box(cx - lx - 0.02, 1.05, cz - lz - 0.02, cx + lx + 0.02, 1.12, cz + lz + 0.02, 'steel', { noCol: true });
      const bx = alongX ? 0 : -toward * 0.75, bz = alongX ? -toward * 0.75 : 0;
      L.box(cx + bx - (alongX ? lx : 0.12), 0, cz + bz - (alongX ? 0.12 : lz), cx + bx + (alongX ? lx : 0.12), 2.6, cz + bz + (alongX ? 0.12 : lz), 'paintGrey');
      const ax0 = alongX ? cx - lx - 0.2 : cx + bx, ax1 = alongX ? cx + lx + 0.2 : cx + bx + toward * 1.9;
      const az0 = alongX ? cz + bz : cz - lz - 0.2, az1 = alongX ? cz + bz + toward * 1.9 : cz + lz + 0.2;
      L.box(ax0, 2.55, az0, ax1, 2.62, az1, 'paintRed', { noCol: true });
      const col = COLS[Math.floor(rnd() * COLS.length)];
      if (alongX) N.strip(cx - lx - 0.2, 2.5, cz + bz + toward * 1.9 - 0.04, cx + lx + 0.2, 2.56, cz + bz + toward * 1.9 + 0.04, col);
      else N.strip(cx + bx + toward * 1.9 - 0.04, 2.5, cz - lz - 0.2, cx + bx + toward * 1.9 + 0.04, 2.56, cz + lz + 0.2, col);
      L.lamp(cx + (alongX ? 0 : toward * 0.6), 2.3, cz + (alongX ? toward * 0.6 : 0), { color: rnd() < 0.5 ? 0xffc47a : N.HEX[col], intensity: 1.2, distance: 6, pool: true, poolSize: 4.5, poolStrength: 0.5 });
      for (let k = 0; k < 3; k++) L.box(cx - lx * 0.8 + k * lx * 0.8, 1.12, cz - lz * 0.7, cx - lx * 0.8 + k * lx * 0.8 + 0.35, 1.3 + rnd() * 0.2, cz - lz * 0.7 + 0.35, rnd() < 0.5 ? 'crate' : 'paintGreen', { noCol: true });
    };

    // ground, curbs, perimeter
    L.box(-70, -2, -70, 70, 0, 70, 'asphalt', { surf: 'concrete', ao: false });
    for (const s of [-1, 1]) {
      bldg(s * 40, -48, s * 48, 48, 34);
      bldg(-40, s * 40, 40, s * 48, 30);
    }
    // quadrant blocks: [8,22] and [25,40] in each axis, 3 m alleys between
    const R = [[8, 22], [25, 40]];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const rx of R) for (const rz of R) {
      const h = 12 + Math.floor(rnd() * 16);
      bldg(sx * rx[0], sz * rz[0], sx * rx[1], sz * rz[1], h);
      // shopfronts on street faces, signs on alley faces
      if (rx[0] === 8) { const len = rz[1] - rz[0]; for (const t of [0.3, 0.74]) shopfront(sx * 8, sz * (rz[0] + len * t), sx > 0 ? 'x-' : 'x+', 4); }
      if (rz[0] === 8) { const len = rx[1] - rx[0]; for (const t of [0.3, 0.74]) shopfront(sx * (rx[0] + len * t), sz * 8, sz > 0 ? 'z-' : 'z+', 4); }
      if (rx[0] === 25 && rnd() < 0.7) N.sign(WORDS[si++ % WORDS.length], COLS[si % COLS.length], sx * 25.05, 4 + rnd() * 3, sz * (rz[0] + 4), sx > 0 ? 'x-' : 'x+', 0.8, { intensity: 1.8, distance: 8, lightOff: 1.2 });
      if (rz[0] === 25 && rnd() < 0.7) N.sign(WORDS[si++ % WORDS.length], COLS[si % COLS.length], sx * (rx[0] + 4), 4 + rnd() * 3, sz * 25.05, sz > 0 ? 'z-' : 'z+', 0.8, { intensity: 1.8, distance: 8, lightOff: 1.2 });
    }
    // curbs along the streets (step-up sidewalks)
    for (const s of [-1, 1]) {
      L.box(s * 8, 0, -40, s * 6.6, 0.15, -8, 'concrete', { ao: false }); L.box(s * 8, 0, 8, s * 6.6, 0.15, 40, 'concrete', { ao: false });
      L.box(-40, 0, s * 8, -8, 0.15, s * 6.6, 'concrete', { ao: false }); L.box(8, 0, s * 8, 40, 0.15, s * 6.6, 'concrete', { ao: false });
    }

    // plaza: holo kiosk on a pedestal, planters for cover
    L.box(-1.6, 0, -1.6, 1.6, 1.0, 1.6, 'concreteDark');
    N.strip(-1.62, 0.95, -1.62, 1.62, 1.02, -1.55, 'cyan'); N.strip(-1.62, 0.95, 1.55, 1.62, 1.02, 1.62, 'cyan');
    const h1 = N.holo(1, 0, 3.4, 0, 0, 4.4, 2.2), h2 = N.holo(4, 0, 3.4, 0, Math.PI / 2, 4.4, 2.2);
    L.animated.push((dt) => { h1.rotation.y += dt * 0.3; h2.rotation.y += dt * 0.3; });
    L.lamp(0, 3.2, 0, { color: N.HEX.cyan, intensity: 2.2, distance: 14, pool: true, poolSize: 10, poolStrength: 0.35, prio: 0.5 });
    for (const p of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { L.box(p[0] - 1, 0, p[1] - 1, p[0] + 1, 0.9, p[1] + 1, 'concrete'); L.box(p[0] - 0.85, 0.9, p[1] - 0.85, p[0] + 0.85, 1.05, p[1] + 0.85, 'paintGreen', { noCol: true }); }

    // balconies with stairs (north-west and south-east)
    for (const s of [-1, 1]) {
      const x0 = s * 8, x1 = s * 5.5, zA = s * 38, zB = s * 10;
      L.box(x0, 4.2, zA, x1, 4.5, zB, 'metalFloor', { surf: 'metal', nav: false });
      for (let z = 12; z <= 36; z += 6) L.box(s * 5.9 - 0.2, 0, s * z - 0.2, s * 5.9 + 0.2, 4.2, s * z + 0.2, 'paintDark');
      L.box(s * 5.6, 4.5, zA, s * 5.5, 5.5, zB, 'steel', { shoot: false });
      N.strip(s * 5.52, 4.18, zA, s * 5.48, 4.24, zB, s < 0 ? 'magenta' : 'cyan');
      K.stairs(Math.min(s * 8, s * 6), Math.min(s * 10, s * 4), Math.max(s * 8, s * 6), Math.max(s * 10, s * 4), 0, 4.5, s < 0 ? 'z-' : 'z+', 'concrete');
    }

    // stalls: north street east side, south street west side, both sides of east/west streets
    for (const z of [14, 20.5, 31, 37]) { stall(6.2, -z, false, -1); stall(-6.2, z, false, 1); }
    for (const x of [13, 33]) { stall(x, -6.2, true, 1); stall(x, 6.2, true, -1); }
    for (const x of [-13, -33]) stall(x, -6.2, true, 1);
    stall(-13, 6.2, true, -1);

    // hover van (east street), noodle kiosk (west street), crates and dumpsters
    L.box(21.5, 0, -5.2, 26.5, 2.4, -3, 'paintGrey');
    L.box(22, 2.4, -5.0, 26, 2.9, -3.2, 'glass', { noCol: true });
    N.strip(21.4, 0.25, -5.25, 26.6, 0.35, -2.95, 'magenta');
    L.lamp(24, 0.4, -4.1, { color: N.HEX.magenta, intensity: 1.5, distance: 6, pool: true, poolSize: 7, poolStrength: 0.6 });
    L.box(-27, 0, 2.6, -21, 2.8, 6.2, 'paintRed');
    L.box(-27.2, 2.8, 2.4, -20.8, 3.0, 6.4, 'paintDark', { noCol: true });
    N.sign('ラーメン', 'yellow', -24, 3.5, 2.5, 'z-', 0.9, { intensity: 2, distance: 9 });
    K.crate(3, 0, -26); K.crate(4.2, 0, -26); K.crate(3.6, 1.2, -26, 1.0); K.crate(-3.4, 0, 25.5);
    // dumpsters and crates sit against alley walls so a 1.8 m passage stays open
    for (const d of [[-23.5, -14], [23.5, 14], [-14, 23.5], [14, -23.5]]) {
      if (Math.abs(d[0]) === 23.5) { const x0 = d[0] + Math.sign(d[0]) * 0.4; L.box(x0, 0, d[1] - 1.4, x0 + Math.sign(d[0]) * 1.1, 1.4, d[1] + 1.4, 'paintGreen'); }
      else { const z0 = d[1] + Math.sign(d[1]) * 0.4; L.box(d[0] - 1.4, 0, z0, d[0] + 1.4, 1.4, z0 + Math.sign(d[1]) * 1.1, 'paintGreen'); }
    }
    for (const d of [[-23.5, 30], [23.5, -30], [30, 23.5], [-30, -23.5]]) {
      const ax = Math.abs(d[0]) === 23.5, cx = ax ? d[0] + Math.sign(d[0]) * 0.85 : d[0], cz = ax ? d[1] : d[1] + Math.sign(d[1]) * 0.85;
      K.crate(cx, 0, cz); L.emitters.push({ type: 'smoke', x: ax ? d[0] - Math.sign(d[0]) * 0.6 : d[0] + 2, y: 0.1, z: ax ? d[1] + 2 : d[1] - Math.sign(d[1]) * 0.6, rate: 4 });
    }
    // giant holo adverts at the street ends
    N.holo(2, 0, 9, -39.8, 0, 10, 5); N.holo(3, 0, 9, 39.8, Math.PI, 10, 5);
    N.holo(5, -39.8, 9, 0, Math.PI / 2, 10, 5); N.holo(7, 39.8, 9, 0, -Math.PI / 2, 10, 5);

    // street lamps and alley lights
    for (const p of [[7.2, -7.2, -1, 0, 'cyan'], [-7.2, 7.2, 1, 0, 'magenta'], [7.2, -24, -1, 0, 'violet'], [-7.2, 24, 1, 0, 'violet'], [24, 7.2, 0, -1, 'cyan'], [-24, -7.2, 0, 1, 'magenta']]) K.lampPost(p[0], p[1], p[2], p[3], { color: p[4] });
    for (const a of [[-23.5, -30], [23.5, 30], [-30, 23.5], [30, -23.5], [-23.5, 16], [23.5, -16], [16, 23.5], [-16, -23.5]]) L.lamp(a[0], 4.5, a[1], { color: N.HEX[COLS[Math.floor(rnd() * 5)]], intensity: 1.6, distance: 10, pool: true, poolSize: 6, poolStrength: 0.45 });

    // spawns [x, y, z]
    const ffa = [[0, 0, -36], [0, 0, 36], [-36, 0, 0], [36, 0, 0], [-23.5, 0, -34], [23.5, 0, -34], [-23.5, 0, 34], [23.5, 0, 34], [-34, 0, -23.5], [34, 0, -23.5], [-34, 0, 23.5], [34, 0, 23.5], [-6.8, 4.5, -34], [6.8, 4.5, 34]];
    L.spawns.ffa = ffa;
    L.spawns.t0 = ffa.filter((p) => p[2] < -20);
    L.spawns.t1 = ffa.filter((p) => p[2] > 20);
    L.addPickup('armor', -6.8, 4.5, -26); L.addPickup('armor', 6.8, 4.5, 26);
    L.addPickup('armor', -23.5, 0, 0); L.addPickup('armor', 23.5, 0, 0);
    L.addPickup('ammo', 0, 0, -20); L.addPickup('ammo', 0, 0, 20); L.addPickup('ammo', -20, 0, 0); L.addPickup('ammo', 20, 0, 0);
    L.points.start = { x: 0, y: 0, z: 36, yaw: 0 };
  };
})(window.CF);
