'use strict';
/* Cinderfall — SNIPER VALLEY (multiplayer). Two skyscraper rooftops face each other across a 60 m gap over a lit
   valley. Nothing connects them: no bridge, cable or ledge. Each roof has a concrete bunker at its far end (spawn),
   a watchtower at one front corner and low cover along open sniping lanes. Anyone who goes over the edge falls to
   their death (L.killY). Team 0 (Voltage) holds the north tower, team 1 (Ronin) the south. */
(function (CF) {
  const L = CF.Level, N = CF.Neon, U = CF.U;
  const MS = CF.MapSniper = {};
  const BOTTOM = -120, GAP = 30, DEPTH = 22, HALF = 12; // roofs span |z| from GAP to GAP + DEPTH, x from -HALF to HALF

  MS.build = function () {
    const K = CF.Map.kit, rnd = U.mulberry32(4151);
    // valley floor far below: wet streets, neon lanes, low blocks (all well under the fall line)
    L.box(-220, BOTTOM - 2, -220, 220, BOTTOM, 220, 'asphalt', { surf: 'concrete', ao: false });
    for (let i = -4; i <= 4; i++) N.strip(i * 40 - 0.3, BOTTOM + 0.02, -220, i * 40 + 0.3, BOTTOM + 0.08, 220, i % 2 ? 'cyan' : 'violet');
    N.strip(-220, BOTTOM + 0.02, -0.4, 220, BOTTOM + 0.08, 0.4, 'magenta');
    const COLS = ['cyan', 'magenta', 'yellow', 'violet', 'pink', 'orange'];
    for (let i = 0; i < 18; i++) {
      const x = (rnd() - 0.5) * 150, z = (rnd() - 0.5) * 50, w = 6 + rnd() * 10, d = 6 + rnd() * 8, top = BOTTOM + 20 + rnd() * 55;
      if (Math.abs(x) < HALF + w && Math.abs(z) > GAP - d) continue; // keep the view between the towers open
      L.box(x - w / 2, BOTTOM, z - d / 2, x + w / 2, top, z + d / 2, 'facade', { top: 'concreteDark', noCol: true });
      if (rnd() < 0.7) N.strip(x - w / 2, top, z - d / 2, x + w / 2, top + 0.15, z - d / 2 + 0.1, COLS[i % COLS.length]);
    }

    for (const s of [-1, 1]) {
      const z = (v) => s * v;                 // distance from the valley centre → this tower's z
      const zN = z(GAP), zF = z(GAP + DEPTH);  // front (valley) edge, far edge
      const col = s < 0 ? 'cyan' : 'magenta';
      // the tower and its roof
      L.box(-HALF, BOTTOM, zN, HALF, 0, zF, 'facade', { top: 'concrete' });
      N.strip(-HALF - 0.05, -1.2, zN - s * 0.06, HALF + 0.05, -1.0, zN - s * 0.02, col);
      for (let y = -8; y > BOTTOM + 10; y -= 14) N.strip(-HALF - 0.05, y, zN - s * 0.06, HALF + 0.05, y + 0.12, zN - s * 0.02, col);
      // parapets: waist-high all round (cover to crouch behind at the front)
      L.box(-HALF, 0, zN, HALF, 1.1, z(GAP + 0.4), 'concreteDark');
      L.box(-HALF, 0, zF, HALF, 1.1, z(GAP + DEPTH - 0.4), 'concreteDark');
      for (const x of [-HALF, HALF - 0.4]) L.box(x, 0, zN, x + 0.4, 1.1, zF, 'concreteDark');
      N.strip(-HALF, 1.1, zN, HALF, 1.18, z(GAP + 0.1), col);

      // the bunker at the far end: thick walls, two doorways and firing slits facing the valley, a roof
      const b0 = GAP + 13, b1 = GAP + DEPTH - 0.4, H = 3.2, T = 0.45;
      const front = (x0, x1, y0, y1) => L.box(x0, y0, z(b0), x1, y1, z(b0 + T), 'concrete');
      front(-9, -6, 0, H); front(-4, -3, 0, H); front(3, 4, 0, H); front(6, 9, 0, H);   // doorways at |x| 4..6
      front(-3, 3, 0, 1.2); front(-3, 3, 1.5, H);                                      // slit between 1.2 and 1.5 m
      front(-6, -4, 2.4, H); front(4, 6, 2.4, H);                                      // door lintels
      for (const x of [-9, 9 - T]) L.box(x, 0, z(b0), x + T, H, z(b1), 'concrete');
      L.box(-9.4, H, z(b0 - 0.4), 9.4, H + 0.35, z(b1), 'concreteDark', { nav: false });
      L.box(-9.4, H + 0.35, z(b0 - 0.4), 9.4, H + 4, z(b1), 'trim', { noMesh: true, shoot: false, nav: false }); // nobody perches on the bunker roof
      N.strip(-9.4, H + 0.35, z(b0 - 0.45), 9.4, H + 0.45, z(b0 - 0.35), col);
      N.sign(s < 0 ? 'VOLTAGE' : 'RONIN', col, 0, H + 1.4, z(b0 - 0.5), s < 0 ? 'z+' : 'z-', 1.1, { intensity: 2.2, distance: 12 });
      L.lamp(0, H - 0.4, z(b0 + 4), { color: s < 0 ? 0x9fe8ff : 0xffb0e8, intensity: 1.6, distance: 10, pool: true, poolSize: 8, poolStrength: 0.4 });
      K.crate(-7.5, 0, z(b1 - 1.2)); K.crate(7.5, 0, z(b1 - 1.2), 1.0);

      // the watchtower at the west front corner: stairs up the side, a platform with a chest-high wall
      const pT = 4.2, p0 = GAP + 0.6, p1 = GAP + 4.6;
      L.box(-11.6, pT, z(p0), -7.8, pT + 0.3, z(p1), 'metalFloor', { surf: 'metal', nav: false });
      for (const [x, zz] of [[-11.5, p0 + 0.1], [-7.9, p0 + 0.1], [-11.5, p1 - 0.1], [-7.9, p1 - 0.1]]) L.box(x - 0.12, 0, z(zz) - 0.12, x + 0.12, pT, z(zz) + 0.12, 'steel');
      L.box(-11.6, pT + 0.3, z(p0), -7.8, pT + 1.3, z(p0 + 0.3), 'concreteDark');       // front wall
      L.box(-11.6, pT + 0.3, z(p0), -11.3, pT + 1.3, z(p1), 'concreteDark');             // outer wall
      L.box(-8.1, pT + 0.3, z(p0), -7.8, pT + 1.3, z(p0 + 2.2), 'concreteDark');         // inner wall, open at the back
      L.box(-11.8, pT + 3.0, z(p0 - 0.2), -7.6, pT + 3.2, z(p1 + 0.2), 'paintDark', { nav: false });
      for (const [x, zz] of [[-11.5, p0 + 0.1], [-7.9, p0 + 0.1], [-11.5, p1 - 0.1], [-7.9, p1 - 0.1]]) L.box(x - 0.08, pT + 1.3, z(zz) - 0.08, x + 0.08, pT + 3.0, z(zz) + 0.08, 'steel', { shoot: false });
      N.strip(-11.8, pT + 2.95, z(p0 - 0.2), -7.6, pT + 3.0, z(p0 - 0.1), col);
      K.stairs(-11.3, Math.min(z(p1), z(p1 + 5)), -9.7, Math.max(z(p1), z(p1 + 5)), 0, pT + 0.3, s > 0 ? 'z-' : 'z+', 'steel');

      // cover along the lanes: low walls, AC units, a water tank, crates
      const wall = (x, d, w) => L.box(x - w / 2, 0, z(d), x + w / 2, 1.15, z(d + 0.6), 'concrete');
      wall(-3.5, GAP + 3.2, 2.6); wall(4.5, GAP + 3.2, 2.6); wall(0.5, GAP + 7, 3.2); wall(-6, GAP + 9.5, 2.4); wall(8, GAP + 8.5, 2.4);
      const ac = (x, d) => { L.box(x - 0.7, 0, z(d) - 1.1, x + 0.7, 1.25, z(d) + 1.1, 'paintGrey'); L.cyl('steel', x, 1.3, z(d), 0.45, 0.08); };
      ac(10, GAP + 5.5); ac(-4, GAP + 11.5);
      L.cyl('paintDark', 6.5, 2.4, z(GAP + 11), 1.3, 2.4); CF.World.addCyl(6.5, z(GAP + 11), 1.3, 0, 3.6, { surf: 'metal' });
      for (const a of [0, 1.57, 3.14, 4.71]) L.box(6.5 + Math.cos(a) * 0.9 - 0.1, 0, z(GAP + 11) + Math.sin(a) * 0.9 - 0.1, 6.5 + Math.cos(a) * 0.9 + 0.1, 1.2, z(GAP + 11) + Math.sin(a) * 0.9 + 0.1, 'steel', { noCol: true });
      K.crate(1.5, 0, z(GAP + 10.2)); K.crate(2.7, 0, z(GAP + 10.4), 1.0);
      L.lamp(0, 5, z(GAP + 7), { color: 0xdfe8ff, intensity: 1.2, distance: 16, pool: true, poolSize: 12, poolStrength: 0.18 });
      // pickups: ammo in the bunker and behind the mid wall, armor up the watchtower
      L.addPickup('ammo', 0, 0, z(b0 + 3)); L.addPickup('ammo', 0.5, 0, z(GAP + 8.8)); L.addPickup('armor', -9.7, pT + 0.3, z(p0 + 2.8));
    }
    // a skybridge that was never finished: two stubs pointing at each other, 40 m apart (nothing to walk on)
    for (const s of [-1, 1]) { L.box(-2, -14, s * GAP, 2, -12.5, s * (GAP - 10), 'concreteDark', { noCol: true }); N.strip(-2, -12.5, s * (GAP - 10), 2, -12.4, s * (GAP - 10.2), 'yellow'); }

    // spawns [x, y, z] inside each bunker; FFA uses both (the mode is team-only, but keep the list complete)
    const t0 = [[-6.5, 0, -(GAP + 17)], [-2, 0, -(GAP + 19)], [2, 0, -(GAP + 17)], [6.5, 0, -(GAP + 19)], [0, 0, -(GAP + 15.5)]];
    const t1 = t0.map((p) => [p[0], p[1], -p[2]]);
    L.spawns.t0 = t0; L.spawns.t1 = t1; L.spawns.ffa = t0.concat(t1);
    L.points.start = { x: 0, y: 0, z: -(GAP + 16), yaw: Math.PI };
    L.killY = -15;
  };
})(window.CF);
