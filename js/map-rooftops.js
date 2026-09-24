'use strict';
/* Cinderfall — SKYLINE (multiplayer). Five rooftops over a 60 m drop, joined by stairs and catwalks. */
(function (CF) {
  const L = CF.Level, N = CF.Neon, U = CF.U, W = CF.World;
  const MR = CF.MapRooftops = {};
  const BOTTOM = -60;

  MR.build = function () {
    const K = CF.Map.kit, rnd = U.mulberry32(909);
    // street far below: dark wet asphalt with neon lane lines and traffic glow
    L.box(-200, BOTTOM - 2, -200, 200, BOTTOM, 200, 'asphalt', { surf: 'concrete', ao: false });
    for (let i = -4; i <= 4; i++) { N.strip(-200, BOTTOM + 0.02, i * 44 - 0.3, 200, BOTTOM + 0.08, i * 44 + 0.3, i % 2 ? 'cyan' : 'magenta'); N.strip(i * 44 - 0.3, BOTTOM + 0.02, -200, i * 44 + 0.3, BOTTOM + 0.08, 200, 'violet'); }

    const roof = (x0, z0, x1, z1, top, gaps, color) => {
      L.box(x0, BOTTOM, z0, x1, top, z1, 'facade', { top: 'concrete' });
      // parapet with gaps [[side, a0, a1], ...] side: n s e w
      const t = 0.3, h = 0.95, g = gaps || [];
      const edge = (side, a0, a1) => {
        const cut = g.filter((q) => q[0] === side).sort((a, b) => a[1] - b[1]);
        let a = a0;
        const seg = (s0, s1) => {
          if (s1 - s0 < 0.2) return;
          if (side === 'n') L.box(s0, top, z0, s1, top + h, z0 + t, 'concreteDark');
          if (side === 's') L.box(s0, top, z1 - t, s1, top + h, z1, 'concreteDark');
          if (side === 'w') L.box(x0, top, s0, x0 + t, top + h, s1, 'concreteDark');
          if (side === 'e') L.box(x1 - t, top, s0, x1, top + h, s1, 'concreteDark');
        };
        for (const q of cut) { seg(a, q[1]); a = q[2]; }
        seg(a, a1);
      };
      edge('n', x0, x1); edge('s', x0, x1); edge('w', z0 + 0.3, z1 - 0.3); edge('e', z0 + 0.3, z1 - 0.3);
      N.strip(x0 - 0.05, top + h, z0 - 0.05, x1 + 0.05, top + h + 0.08, z0 + 0.05, color);
      N.strip(x0 - 0.05, top + h, z1 - 0.05, x1 + 0.05, top + h + 0.08, z1 + 0.05, color);
      N.strip(x0 - 0.05, top - 1.2, z0 - 0.06, x1 + 0.05, top - 1.0, z0 - 0.02, color);
      N.strip(x0 - 0.05, top - 1.2, z1 + 0.02, x1 + 0.05, top - 1.0, z1 + 0.06, color);
    };
    const ac = (x, y, z, alongX) => { const lx = alongX ? 1.1 : 0.7, lz = alongX ? 0.7 : 1.1; L.box(x - lx, y, z - lz, x + lx, y + 1.25, z + lz, 'paintGrey'); L.cyl('steel', x, y + 1.3, z, 0.45, 0.08); };
    const tank = (x, y, z, r, h) => { L.cyl('paintDark', x, y + 0.8 + h / 2, z, r, h); for (const a of [0, 1.57, 3.14, 4.71]) L.box(x + Math.cos(a) * r * 0.7 - 0.1, y, z + Math.sin(a) * r * 0.7 - 0.1, x + Math.cos(a) * r * 0.7 + 0.1, y + 0.8, z + Math.sin(a) * r * 0.7 + 0.1, 'steel', { noCol: true }); W.addCyl(x, z, r, y, y + 0.8 + h, { surf: 'metal' }); };
    const hut = (x0, z0, x1, z1, y, h) => { L.box(x0, y, z0, x1, y + h, z1, 'wall'); L.box(x0 - 0.2, y + h, z0 - 0.2, x1 + 0.2, y + h + 0.2, z1 + 0.2, 'paintDark', { nav: false }); };
    const railing = (x0, z0, x1, z1, y) => L.box(x0, y, z0, x1, y + 1.05, z1, 'steel', { shoot: false });

    // A (centre, helipad) top 0
    roof(-12, -10, 12, 10, 0, [['n', -1, 2], ['s', -3, 0], ['e', -1, 2], ['w', 0, 3]], 'cyan');
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), L.mats.pad); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.02, 0); L.scene.add(pad);
    ac(-8, 0, -6, true); ac(8, 0, 6, true); ac(-8, 0, 6, false); hut(6, -8, 10, -4, 0, 3);
    L.lamp(0, 5, 0, { color: 0xdfe8ff, intensity: 1.6, distance: 16, pool: true, poolSize: 12, poolStrength: 0.18 });
    // B (north, billboard) top 3
    roof(-10, -34, 14, -16, 3, [['s', -1, 2], ['e', -20, -18]], 'magenta');
    L.box(-6, 3, -33, -5.6, 12.5, -32.6, 'steel'); L.box(10, 3, -33, 10.4, 12.5, -32.6, 'steel');
    L.box(-6.2, 12.5, -33.2, 10.6, 12.8, -32.4, 'steel', { noCol: true });
    N.holo(0, 2.2, 9.2, -32.5, 0, 15.5, 6.4);
    tank(8, 3, -22, 1.6, 2.4); ac(-6, 3, -21, true); ac(0, 3, -28, false);
    L.lamp(2, 7, -26, { color: N.HEX.magenta, intensity: 2, distance: 16, pool: true, poolSize: 12, poolStrength: 0.3 });
    // C (south, greenhouse + neon frame) top -2
    roof(-14, 16, 10, 34, -2, [['n', -3, 0], ['w', 18, 20]], 'yellow');
    L.box(-11, -2, 24, -3, 0.4, 31, 'glass'); L.box(-11.1, 0.4, 23.9, -2.9, 0.6, 31.1, 'steel', { noCol: true });
    N.sign('夜市', 'yellow', 4, 1.8, 33.7, 'z-', 2.2, { intensity: 2.4, distance: 14 });
    ac(4, -2, 22, true); ac(6, -2, 28, false);
    // D (east, antennas) top 1.5
    roof(18, -14, 34, 12, 1.5, [['w', -1, 2], ['n', 26, 28]], 'violet');
    for (const a of [[30, -10], [30, 8], [22, 6]]) { L.box(a[0] - 0.15, 1.5, a[1] - 0.15, a[0] + 0.15, 11, a[1] + 0.15, 'steel'); L.box(a[0] - 0.05, 11, a[1] - 0.05, a[0] + 0.05, 13, a[1] + 0.05, 'neon_red', { noCol: true }); }
    L.cyl('paintGrey', 26, 3.2, -4, 1.8, 0.3, 1.1, 0);
    L.box(25.4, 1.5, -4.6, 26.6, 2.6, -3.4, 'paintDark');
    W.add(24.2, 2.6, -4.95, 27.8, 4.9, -3.05, { surf: 'metal' }); W.add(24.2, 4.9, -4.95, 27.8, 12, -3.05, { shoot: false, nav: false }); // the dish, and no perching on it
    ac(22, 1.5, -10, false); ac(30, 1.5, 0, true); hut(20, 2, 24, 6, 1.5, 3);
    L.lamp(26, 6, -2, { color: N.HEX.violet, intensity: 2, distance: 16, pool: true, poolSize: 11, poolStrength: 0.3 });
    // E (west, rooftop bar) top -1
    roof(-34, -12, -18, 14, -1, [['e', 0, 3], ['s', -26, -24]], 'pink');
    L.box(-31, -1, -6, -29.8, 0.1, 6, 'paintDark'); L.box(-31.1, 0.1, -6.1, -29.7, 0.2, 6.1, 'steel', { noCol: true });
    N.strip(-29.8, -0.6, -6, -29.75, -0.5, 6, 'pink');
    N.sign('BAR 夜', 'pink', -33.7, 2.6, 0, 'x+', 1.3, { intensity: 2.6, distance: 14 });
    for (let z = -4; z <= 4; z += 2.6) { L.cyl('steel', -28.6, -0.55, z, 0.2, 0.9, 0, 0, true); W.addCyl(-28.6, z, 0.2, -1, -0.1, { surf: 'metal' }); }
    for (const tb of [[-24, -8], [-22, 8], [-26, 10]]) { L.cyl('paintDark', tb[0], -0.45, tb[1], 0.7, 0.08); L.cyl('steel', tb[0], -0.72, tb[1], 0.08, 0.55, 0, 0, true); W.add(tb[0] - 0.5, -1, tb[1] - 0.5, tb[0] + 0.5, -0.4, tb[1] + 0.5, { surf: 'metal' }); }
    for (let i = 0; i < 9; i++) { const x = -33 + i * 1.8; L.lamp(x, 2.4, -11, { color: i % 2 ? 0xffc47a : N.HEX.pink, intensity: 0.8, distance: 5, pool: false }); L.box(x - 0.08, 2.32, -11.08, x + 0.08, 2.48, -10.92, i % 2 ? 'lampWarm' : 'neon_pink', { noCol: true }); }
    tank(-21, -1, -8, 1.4, 2); ac(-32, -1, 10, false);

    // stairs and catwalks
    K.stairs(-1, -16, 2, -10, 0, 3, 'z-', 'steel'); railing(-1.1, -16, -1, -10, 0); railing(2, -16, 2.1, -10, 0);
    K.stairs(-3, 10, 0, 16, -2, 0, 'z-', 'steel'); railing(-3.1, 10, -3, 16, -2); railing(0, 10, 0.1, 16, -2);
    K.stairs(12, -1, 18, 2, 0, 1.5, 'x+', 'steel'); railing(12, -1.1, 18, -1, 0); railing(12, 2, 18, 2.1, 0);
    K.stairs(-18, 0, -12, 3, -1, 0, 'x+', 'steel'); railing(-18, -0.1, -12, 0, -1); railing(-18, 3, -12, 3.1, -1);
    L.box(14, 2.7, -20, 28, 3, -18, 'metalFloor', { surf: 'metal' }); railing(14, -20.1, 28, -20, 3); railing(14, -18, 26, -17.9, 3);
    K.stairs(26, -18, 28, -14, 1.5, 3, 'z-', 'steel');
    L.box(-26, -1.55, 14, -24, -1.25, 20, 'metalFloor', { surf: 'metal' });
    L.box(-24, -1.9, 18, -14, -1.6, 20, 'metalFloor', { surf: 'metal' }); railing(-26.1, 14, -26, 20, -1.25); railing(-24, 20, -14, 20.1, -1.6); railing(-24, 14, -23.9, 18, -1.25); railing(-24, 17.9, -14, 18, -1.6);
    for (const s of [[14, -20, 26, -18, 2.7, 'cyan'], [-24, 18, -14, 20, -1.9, 'yellow']]) N.strip(s[0], s[4] - 0.08, s[1] - 0.04, s[2], s[4], s[1] + 0.04, s[5]);

    // spawns [x, y, z] and pickups
    const ffa = [[-8, 0, -2], [8, 0, 2], [-4, 3, -30], [10, 3, -24], [-12.5, -2, 32.5], [6, -2, 19], [30, 1.5, -4], [22, 1.5, 9], [-30, -1, -9], [-22, -1, 11]];
    L.spawns.ffa = ffa;
    L.spawns.t0 = [[-4, 3, -30], [10, 3, -24], [30, 1.5, -4], [22, 1.5, 9], [-8, 0, -3]];
    L.spawns.t1 = [[-12.5, -2, 32.5], [6, -2, 19], [-30, -1, -9], [-22, -1, 11], [8, 0, 3]];
    L.addPickup('armor', 2, 3, -30); L.addPickup('armor', -2, -2, 30);
    L.addPickup('ammo', 30, 1.5, 4); L.addPickup('ammo', -24, -1, -2); L.addPickup('ammo', 0, 0, -6);
    L.points.start = { x: 0, y: 0, z: 6, yaw: 0 };
    L.killY = -12;
  };
})(window.CF);
