'use strict';
/* Cinderfall — THE PIT (multiplayer), after the Halo 3 map: a UNSC special-warfare training facility in the Kenyan savanna.
   Two mirrored bases face each other across the yard, Blue Base (west) and Red Base (east): an armory on the ground
   floor with the flag stand, a sniper nest upstairs with a balcony, and a bridge to the team's sniper tower. From each
   tower a catwalk runs along the north wall to the Sword Room, raised over the yard with a ramp down on each side and the
   ordnance store underneath. In the middle is the Pit, a sunken live-fire range: a container, low walls, sandbags,
   targets, a tire run and climbing walls, with a ramp, a stair and drop-ins on every side. Along the south wall the Long
   Hall runs between the two base yards, with the briefing room in the middle, a stair up through the roof and a
   walkable roof behind a crenellated parapet. Axes: +X east, +Z south. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MPIT = CF.MapPit = {};
  let K = null; // Nuketown's building kit (js/map-nuketown.js)

  const T = 0.3;                                          // wall thickness
  const UF = 4.5, RF = 8.6, TP = 8.4, SR = 8.5;           // upper floors (bases, catwalks, Sword Room), base roof, tower top, Sword Room roof
  const HR = 4.3, PD = -2.2;                              // Long Hall roof, Pit floor
  const PX0 = -52, PX1 = 52, PZ0 = -30, PZ1 = 25, WH = 9.5; // perimeter wall inner faces, wall height
  const TEAM = {
    '-1': { name: 'BLUE', paint: 'paintBlue', lamp: 'lampBlue', css: '#2f6fd0', dark: '#173a70', cont: 'blue', light: 0x6aa8ff },
    '1': { name: 'RED', paint: 'paintCherry', lamp: 'lampRed', css: '#c0282a', dark: '#6a1416', cont: 'red', light: 0xff6a5a }
  };

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
  /** A layer split around openings [a0, a1, y0, y1]. */
  function cut(axis, a0, a1, c, t, y0, y1, holes, m, o) {
    const B = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      if (axis === 'x') L.box(p0, q0, c - t / 2, p1, q1, c + t / 2, m, o); else L.box(c - t / 2, q0, p0, c + t / 2, q1, p1, m, o);
    };
    K.holeSpans(a0, a1, y0, y1, holes, B);
  }
  /** Steel frame round an opening on both faces; a hazard-striped threshold under doors, a concrete sill under windows. */
  function frame(axis, h, c, yb, yt) {
    const f = T / 2 + 0.03, box = (a0, a1, y0, y1, cc, t, m) => axis === 'x' ? deco(a0, y0, cc - t, a1, y1, cc + t, m) : deco(cc - t, y0, a0, cc + t, y1, a1, m);
    const ft = Math.abs(h[3] + 0.12 - yt) < 0.005 ? yt + 0.01 : h[3] + 0.12; // never flush with the wall top
    for (const sd of [-1, 1]) {
      const cc = c + sd * f;
      box(h[0] - 0.12, h[0], h[2], ft, cc, 0.03, 'plateOlive'); box(h[1], h[1] + 0.12, h[2], ft, cc, 0.03, 'plateOlive');
      box(h[0] - 0.12, h[1] + 0.12, h[3], ft, cc, 0.03, 'plateOlive');
    }
    if (h[2] - yb < 0.3) box(h[0], h[1], h[2], h[2] + 0.012, c, T / 2 + 0.1, 'hazard');
    else box(h[0] - 0.1, h[1] + 0.1, h[2] - 0.07, h[2] + 0.01, c, T / 2 + 0.08, 'bunkerDark'); // sill proud of the wall top, not flush
  }
  /** Bunker wall: exterior bands on the `out` side (+1/-1 along the other axis), interior bands inside; 0 = partition. */
  function wall(axis, a0, a1, c, y0, y1, holes, out, OUTB, INB) {
    if (a0 > a1) { const t = a0; a0 = a1; a1 = t; }
    holes = holes.map((h) => h[0] > h[1] ? [h[1], h[0], h[2], h[3]] : h);
    const band = (bands, cc, t, ext) => { for (const b of bands) { const q0 = Math.max(y0, b[0]), q1 = Math.min(y1, b[1]); if (q1 > q0) cut(axis, a0 - ext, a1 + ext, cc, t, q0, q1, holes, b[2], {}); } };
    if (!out) band(INB, c, T, 0);
    else { band(OUTB, c + out * T / 4, T / 2, axis === 'x' ? T / 2 : 0); band(INB, c - out * T / 4, T / 2, 0); }
    for (const h of holes) if (h[3] > y0 && h[2] < y1 && (h[0] + h[1]) / 2 >= a0 && (h[0] + h[1]) / 2 < a1) frame(axis, h, c, y0, y1);
  }
  /** Solid staircase. axis 'x' climbs along X over a0..a1 (b = the Z span), 'z' climbs along Z. up = +1 rises toward a1, -1 toward a0. */
  function steps(axis, a0, a1, b0, b1, yBase, yTop, up, m, topM) {
    if (b0 > b1) { const t = b0; b0 = b1; b1 = t; }
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, yBase, b0, s1, top, b1, m, { top: topM }); else L.box(b0, yBase, s0, b1, top, s1, m, { top: topM });
      { const e = up > 0 ? s0 : s1; if (axis === 'x') deco(e - 0.04, top, b0, e + 0.04, top + 0.006, b1, 'paintYellow'); else deco(b0, top, e - 0.04, b1, top + 0.006, e + 0.04, 'paintYellow'); }
    }
  }
  /** Invisible, bullet-transparent handrail colliders along a stair or ramp edge (c = the edge line), with a steel handrail. */
  function slopeGuard(axis, a0, a1, c, yBase, yTop, up, bare) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const s0 = a0 + (a1 - a0) * i / n, s1 = a0 + (a1 - a0) * (i + 1) / n, k = up > 0 ? (i + 1) / n : 1 - i / n, y = yBase + (yTop - yBase) * k;
      if (axis === 'x') W.add(s0, yBase, c - 0.04, s1, y + 1.05, c + 0.04, { shoot: false }); else W.add(c - 0.04, yBase, s0, c + 0.04, y + 1.05, s1, { shoot: false });
    }
    if (bare) return;
    const lo = up > 0 ? a0 : a1, hi = up > 0 ? a1 : a0, len = Math.abs(a1 - a0), np = Math.max(2, Math.round(len / 1.6));
    const Pt = (a, y) => axis === 'x' ? [a, y, c] : [c, y, a];
    const A = Pt(lo, yBase + 1.0), B = Pt(hi, yTop + 1.0); L.pipe('steel', A[0], A[1], A[2], B[0], B[1], B[2], 0.03);
    const M1 = Pt(lo, yBase + 0.5), M2 = Pt(hi, yTop + 0.5); L.pipe('steel', M1[0], M1[1], M1[2], M2[0], M2[1], M2[2], 0.02);
    for (let i = 0; i <= np; i++) { const k = i / np, a = lo + (hi - lo) * k, y = yBase + (yTop - yBase) * k, q = Pt(a, y); L.pipe('steel', q[0], y, q[2], q[0], y + 1.0, q[2], 0.025); }
  }
  /** Four-point face baked into a batch (both sides), with explicit UVs. */
  function poly(m, pts, uvs) {
    const p = [], uv = [];
    for (const i of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { p.push(...pts[i]); uv.push(...uvs[i]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); L.addGeo(m, g, new THREE.Matrix4());
  }
  /** Smooth concrete ramp with side skirts, walked on through fine invisible steps. up as in steps(). */
  function ramp(axis, a0, a1, b0, b1, yLo, yHi, up, m, side, sc) {
    sc = sc || 0.25;
    const lo = up > 0 ? a0 : a1, hi = up > 0 ? a1 : a0, len = Math.hypot(a1 - a0, yHi - yLo);
    const Pt = (a, y, b) => axis === 'x' ? [a, y, b] : [b, y, a];
    poly(m, [Pt(lo, yLo, b0), Pt(hi, yHi, b0), Pt(hi, yHi, b1), Pt(lo, yLo, b1)], [[b0 * sc, 0], [b0 * sc, len * sc], [b1 * sc, len * sc], [b1 * sc, 0]]);
    for (const b of [b0, b1]) poly(side, [Pt(lo, yLo, b), Pt(hi, yHi, b), Pt(hi, yLo, b), Pt(hi, yLo, b)], [[lo * sc, yLo * sc], [hi * sc, yHi * sc], [hi * sc, yLo * sc], [hi * sc, yLo * sc]]);
    poly(side, [Pt(hi, yLo, b0), Pt(hi, yHi, b0), Pt(hi, yHi, b1), Pt(hi, yLo, b1)], [[b0 * sc, yLo * sc], [b0 * sc, yHi * sc], [b1 * sc, yHi * sc], [b1 * sc, yLo * sc]]);
    const n = Math.ceil((yHi - yLo) / 0.1);
    for (let i = 0; i < n; i++) {
      const s0 = lo + (hi - lo) * i / n, s1 = lo + (hi - lo) * (i + 1) / n, y = yLo + (yHi - yLo) * (i + 0.5) / n;
      if (axis === 'x') W.add(s0, yLo, b0, s1, y, b1, { surf: 'concrete' }); else W.add(b0, yLo, s0, b1, y, s1, { surf: 'concrete' });
    }
    // anti-slip ribs across the ramp
    for (let k = 0.08; k < 1; k += 0.08) { const a = lo + (hi - lo) * k, y = yLo + (yHi - yLo) * k + 0.01; if (axis === 'x') deco(a - 0.05, y, b0 + 0.15, a + 0.05, y + 0.02, b1 - 0.15, 'bunkerDark'); else deco(b0 + 0.15, y, a - 0.05, b1 - 0.15, y + 0.02, a + 0.05, 'bunkerDark'); }
  }
  /** Steel pipe railing with posts, bullet-transparent. */
  function rail(axis, a0, a1, c, y) {
    if (a0 > a1) { const t = a0; a0 = a1; a1 = t; }
    const n = Math.max(1, Math.round((a1 - a0) / 1.6));
    if (axis === 'x') {
      L.pipe('steel', a0, y + 1.0, c, a1, y + 1.0, c, 0.035); L.pipe('steel', a0, y + 0.5, c, a1, y + 0.5, c, 0.022);
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; L.pipe('steel', a, y, c, a, y + 1.0, c, 0.03); }
      deco(a0, y, c - 0.04, a1, y + 0.1, c + 0.04, 'paintYellow');
      W.add(a0, y, c - 0.06, a1, y + 1.05, c + 0.06, { shoot: false });
    } else {
      L.pipe('steel', c, y + 1.0, a0, c, y + 1.0, a1, 0.035); L.pipe('steel', c, y + 0.5, a0, c, y + 0.5, a1, 0.022);
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; L.pipe('steel', c, y, a, c, y + 1.0, a, 0.03); }
      deco(c - 0.04, y, a0, c + 0.04, y + 0.1, a1, 'paintYellow');
      W.add(c - 0.06, y, a0, c + 0.06, y + 1.05, a1, { shoot: false });
    }
  }
  /** A row of sandbags from (x0, z0) to (x1, z1) at height y. */
  function bags(x0, z0, x1, z1, rows, y) {
    y = y || 0;
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.55)), ang = Math.atan2(x1 - x0, z1 - z0);
    for (let r = 0; r < rows; r++) for (let i = 0; i <= n; i++) {
      const k = (i + (r % 2) * 0.5) / (n + 0.5);
      K.put('sandbag', K.blobGeo((i + r) % 3), x0 + (x1 - x0) * k, y + 0.14 + r * 0.24, z0 + (z1 - z0) * k, 0.3, 0.13, 0.2, ang + Math.PI / 2);
    }
    solid(Math.min(x0, x1) - 0.3, y, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, y + rows * 0.25 + 0.05, Math.max(z0, z1) + 0.3);
  }
  /** Fluorescent fitting under a ceiling at y, with a pooled light. */
  function tube(x, y, z, alongX, len) {
    const a = (len || 1.4) / 2;
    if (alongX) { deco(x - a, y - 0.08, z - 0.13, x + a, y, z + 0.13, 'steel'); deco(x - a + 0.05, y - 0.11, z - 0.06, x + a - 0.05, y - 0.08, z + 0.06, 'lampCool'); }
    else { deco(x - 0.13, y - 0.08, z - a, x + 0.13, y, z + a, 'steel'); deco(x - 0.06, y - 0.11, z - a + 0.05, x + 0.06, y - 0.08, z + a - 0.05, 'lampCool'); }
    L.lamp(x, y - 0.4, z, { color: 0xe8f0ff, intensity: 1.3, distance: 10, pool: false });
  }
  /** Caged bulkhead lamp on a wall (n = outward normal along the wall's axis), no real light. */
  function bulkhead(x, y, z, nx, nz, m) {
    deco(x - 0.12 - Math.abs(nz) * 0.02, y - 0.1, z - 0.12 - Math.abs(nx) * 0.02, x + 0.12 + Math.abs(nz) * 0.02, y + 0.1, z + 0.12 + Math.abs(nx) * 0.02, 'paintDark');
    K.sph(m || 'lampWarm', x + nx * 0.12, y, z + nz * 0.12, 0.09, 0.07, 0.09);
  }
  /** Shipping container on the ground (or on y0), optionally stacked. */
  function container(cx, cz, alongX, color, stack, y0) {
    stack = stack || 1; y0 = y0 || 0;
    const lx = alongX ? 6.1 : 2.44, lz = alongX ? 2.44 : 6.1;
    for (let s = 0; s < stack; s++) {
      const yb = y0 + s * 2.6;
      W.add(cx - lx / 2, yb, cz - lz / 2, cx + lx / 2, yb + 2.6, cz + lz / 2, { surf: 'metal' });
      L.propBox('cont_' + (s === 1 ? (color === 'green' ? 'white' : 'green') : color), cx, yb, cz, 6.1, 2.6, 2.44, alongX ? 0 : Math.PI / 2);
    }
    L.blob(cx, cz, lx + 1.4, lz + 1.4, y0);
  }
  /** Concrete jersey barrier along X or Z. */
  function jersey(x0, z0, x1, z1) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), l = alongX ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = K.extrude('jersey', [[-0.3, 0], [0.3, 0], [0.3, 0.08], [0.14, 0.3], [0.1, 0.82], [-0.1, 0.82], [-0.14, 0.3], [-0.3, 0.08]], 1, 0);
    K.put('bunker', g, cx, 0, cz, 1, 1, Math.abs(l), alongX ? Math.PI / 2 : 0);
    for (let k = 0.25; k < 1; k += 0.5) { const px = x0 + (x1 - x0) * k, pz = z0 + (z1 - z0) * k; if (alongX) deco(px - 0.3, 0.6, cz - 0.115, px + 0.3, 0.72, cz + 0.115, 'hazard'); else deco(cx - 0.115, 0.6, pz - 0.3, cx + 0.115, 0.72, pz + 0.3, 'hazard'); }
    solid(alongX ? Math.min(x0, x1) : cx - 0.3, 0, alongX ? cz - 0.3 : Math.min(z0, z1), alongX ? Math.max(x0, x1) : cx + 0.3, 0.82, alongX ? cz + 0.3 : Math.max(z0, z1));
    L.blob(cx, cz, alongX ? Math.abs(l) + 0.6 : 1.1, alongX ? 1.1 : Math.abs(l) + 0.6);
  }
  /** Olive ammunition box with latches. */
  function ammoBox(x, y, z, alongX, col) {
    const a = alongX ? 0.45 : 0.22, b = alongX ? 0.22 : 0.45;
    deco(x - a, y, z - b, x + a, y + 0.32, z + b, 'plateOlive'); deco(x - a - 0.01, y + 0.3, z - b - 0.01, x + a + 0.01, y + 0.34, z + b + 0.01, 'paintDark');
    if (alongX) deco(x - 0.08, y + 0.34, z - 0.03, x + 0.08, y + 0.37, z + 0.03, 'steel'); else deco(x - 0.03, y + 0.34, z - 0.08, x + 0.03, y + 0.37, z + 0.08, 'steel');
    if (col) solid(x - a, y, z - b, x + a, y + 0.34, z + b, 'metal');
  }
  /** Long rocket crate with a yellow band. */
  function rocketCrate(x, y, z, alongX) {
    const a = alongX ? 0.85 : 0.28, b = alongX ? 0.28 : 0.85;
    deco(x - a, y, z - b, x + a, y + 0.42, z + b, 'plateOlive');
    if (alongX) { deco(x - 0.52, y - 0.005, z - b - 0.005, x - 0.42, y + 0.425, z + b + 0.005, 'paintYellow'); deco(x + 0.42, y - 0.005, z - b - 0.005, x + 0.52, y + 0.425, z + b + 0.005, 'paintYellow'); }
    else { deco(x - a - 0.005, y - 0.005, z - 0.52, x + a + 0.005, y + 0.425, z - 0.42, 'paintYellow'); deco(x - a - 0.005, y - 0.005, z + 0.42, x + a + 0.005, y + 0.425, z + 0.52, 'paintYellow'); }
  }
  /** Steel shelving unit (x0..x1 along X or Z) with boxes on it. */
  function shelf(x0, z0, x1, z1, y, levels, rnd) {
    const alongX = x1 - x0 > z1 - z0;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) deco(px - 0.03, y, pz - 0.03, px + 0.03, y + levels * 0.6 + 0.1, pz + 0.03, 'steel');
    for (let l = 0; l < levels; l++) {
      const yy = y + 0.25 + l * 0.6;
      deco(x0, yy, z0, x1, yy + 0.04, z1, 'steel');
      for (let a = (alongX ? x0 : z0) + 0.1; a < (alongX ? x1 : z1) - 0.4; a += 0.45 + rnd() * 0.25) {
        if (rnd() < 0.2) continue;
        const w = 0.3 + rnd() * 0.12, h = 0.2 + rnd() * 0.25, m = rnd() < 0.5 ? 'plateOlive' : 'cardboard';
        if (alongX) deco(a, yy + 0.04, z0 + 0.05, a + w, yy + 0.04 + h, z1 - 0.05, m); else deco(x0 + 0.05, yy + 0.04, a, x1 - 0.05, yy + 0.04 + h, a + w, m);
      }
    }
    solid(x0, y, z0, x1, y + levels * 0.6 + 0.1, z1, 'metal');
  }
  /** Row of lockers against a wall. axis 'x': along X at the wall z = c, doors facing `face` (±1 along Z); 'z' likewise. */
  function lockers(axis, a0, n, c, face, y) {
    const w = 0.52, a1 = a0 + n * w, d = 0.5, q0 = face > 0 ? c : c - d, q1 = face > 0 ? c + d : c, fz = face > 0 ? q1 : q0;
    if (axis === 'x') L.box(a0, y, q0, a1, y + 1.95, q1, 'plateOlive', { top: 'paintDark' }); else L.box(q0, y, a0, q1, y + 1.95, a1, 'plateOlive', { top: 'paintDark' });
    for (let i = 0; i < n; i++) {
      const a = a0 + i * w;
      const B = (p0, p1, y0, y1, m) => axis === 'x' ? deco(p0, y0, fz - 0.01, p1, y1, fz + 0.01, m) : deco(fz - 0.01, y0, p0, fz + 0.01, y1, p1, m);
      B(a, a + 0.012, y + 0.05, y + 1.9, 'paintDark');
      for (let k = 0; k < 3; k++) B(a + 0.14, a + 0.38, y + 1.55 + k * 0.08, y + 1.58 + k * 0.08, 'paintDark');
      B(a + 0.4, a + 0.44, y + 0.9, y + 1.1, 'chrome');
    }
  }
  /** Wooden bench on steel legs along X or Z. */
  function bench(x0, z0, x1, z1, y) {
    y = y || 0;
    L.box(x0, y + 0.4, z0, x1, y + 0.46, z1, 'wood', { noCol: true });
    const alongX = x1 - x0 > z1 - z0;
    for (const k of [0.1, 0.9]) { const a = alongX ? x0 + (x1 - x0) * k : (x0 + x1) / 2, b = alongX ? (z0 + z1) / 2 : z0 + (z1 - z0) * k; deco(a - 0.03, y, b - 0.15, a + 0.03, y + 0.4, b + 0.15, 'steel'); }
    solid(x0, y, z0, x1, y + 0.46, z1);
  }
  /** Rifle rack on a wall: backboard and a row of rifles standing in it. axis/face as lockers(). */
  function gunRack(axis, a0, a1, c, face, y) {
    const q = (o) => c + face * o;
    const B = (p0, p1, y0, y1, o0, o1, m) => axis === 'x' ? deco(p0, y0, Math.min(q(o0), q(o1)), p1, y1, Math.max(q(o0), q(o1)), m) : deco(Math.min(q(o0), q(o1)), y0, p0, Math.max(q(o0), q(o1)), y1, p1, m);
    B(a0, a1, y + 0.2, y + 1.9, 0, 0.04, 'woodDark'); B(a0, a1, y + 0.2, y + 0.35, 0.04, 0.3, 'woodDark'); B(a0, a1, y + 1.3, y + 1.38, 0.04, 0.2, 'steel');
    for (let a = a0 + 0.2; a < a1 - 0.1; a += 0.28) {
      B(a - 0.03, a + 0.03, y + 0.35, y + 1.45, 0.08, 0.16, 'paintDark');     // receiver and stock
      B(a - 0.015, a + 0.015, y + 1.45, y + 1.75, 0.11, 0.13, 'steel');      // barrel
      B(a - 0.025, a + 0.025, y + 0.75, y + 0.95, 0.16, 0.24, 'paintDark');  // magazine
    }
  }
  /** Double bunk bed along X. */
  function bunk(x0, z0, x1, z1, y) {
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) deco(px - 0.03, y, pz - 0.03, px + 0.03, y + 1.75, pz + 0.03, 'steel');
    for (const h of [0.35, 1.3]) { deco(x0, y + h, z0, x1, y + h + 0.06, z1, 'steel'); deco(x0 + 0.04, y + h + 0.06, z0 + 0.04, x1 - 0.04, y + h + 0.2, z1 - 0.04, 'canvasOlive'); deco(x1 - 0.5, y + h + 0.2, z0 + 0.1, x1 - 0.08, y + h + 0.3, z1 - 0.1, 'bedspread'); }
    solid(x0, y, z0, x1, y + 1.75, z1);
  }
  /** Desk with monitors and a radio (screens face -Z unless face > 0). */
  function desk(x0, x1, z, face, y) {
    const zb = face > 0 ? z : z - 0.8, zf = face > 0 ? z + 0.8 : z;
    L.box(x0, y + 0.72, zb, x1, y + 0.78, zf, 'counter', { noCol: true }); for (const px of [x0 + 0.05, x1 - 0.1]) deco(px, y, zb + 0.05, px + 0.05, y + 0.72, zf - 0.05, 'steel');
    solid(x0, y, zb, x1, y + 0.78, zf);
    const zs = face > 0 ? zb + 0.2 : zf - 0.2;
    for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.75) { deco(x - 0.28, y + 0.85, zs - 0.03, x + 0.28, y + 1.25, zs + 0.03, 'paintDark'); deco(x - 0.25, y + 0.88, zs + face * 0.035 - 0.004, x + 0.25, y + 1.22, zs + face * 0.035 + 0.004, 'windowCool'); deco(x - 0.04, y + 0.78, zs - 0.04, x + 0.04, y + 0.85, zs + 0.04, 'steel'); }
    deco(x1 - 0.55, y + 0.78, (zb + zf) / 2 - 0.2, x1 - 0.1, y + 1.0, (zb + zf) / 2 + 0.2, 'plateOlive'); K.sph('lampGreen', x1 - 0.2, y + 0.94, (zb + zf) / 2 + 0.21 * face, 0.02);
    L.pipe('steel', x1 - 0.2, y + 1.0, (zb + zf) / 2, x1 - 0.2, y + 1.6, (zb + zf) / 2, 0.006);
  }
  /** Floodlight mast: a pole, a crossbar with lamp heads. */
  function flood(x, z, h, ry) {
    L.cyl('greyClean', x, h / 2, z, 0.1, h, 0, 0, true); L.cyl('paintDark', x, 0.15, z, 0.25, 0.3, 0, 0, true); W.addCyl(x, z, 0.14, 0, h, { surf: 'metal' });
    const c = Math.cos(ry || 0), s = Math.sin(ry || 0);
    L.pipe('steel', x - c * 0.9, h, z + s * 0.9, x + c * 0.9, h, z - s * 0.9, 0.05);
    for (const k of [-0.6, 0, 0.6]) { const px = x + c * k, pz = z - s * k; K.put('paintDark', L.geo('box'), px, h + 0.22, pz, 0.36, 0.3, 0.2, ry || 0); K.put('lampWarm', L.geo('box'), px + s * 0.105, h + 0.22, pz + c * 0.105, 0.3, 0.24, 0.02, ry || 0); }
    for (let y = 1.5; y < h - 0.5; y += 0.45) deco(x - 0.2, y, z - 0.02, x - 0.1, y + 0.03, z + 0.02, 'steel');
  }
  /** Paper silhouette target on a wooden frame, facing +Z (ry 0) or -Z (ry PI). */
  function target(x, z, ry, y) {
    const f = Math.cos(ry);
    for (const d of [-0.45, 0.45]) deco(x + d - 0.04, y, z - 0.04, x + d + 0.04, y + 1.9, z + 0.04, 'wood');
    for (const h of [0.55, 1.82]) deco(x - 0.49, y + h, z - 0.03, x + 0.49, y + h + 0.06, z + 0.03, 'wood');
    K.plane(art().target, 0.82, 1.24, x, y + 1.2, z + f * 0.035, ry, { alpha: true });
    solid(x - 0.5, y, z - 0.05, x + 0.5, y + 1.9, z + 0.05, 'concrete');
  }
  /** Tripod machine gun behind cover, pointing along ry (0 = +X). */
  function tripodGun(x, z, y, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let i = 0; i < 3; i++) { const a = ry + Math.PI + (i - 1) * 0.9; L.pipe('paintDark', x, y + 0.75, z, x + Math.cos(a) * 0.55, y, z - Math.sin(a) * 0.55, 0.02); }
    K.put('paintDark', L.geo('box'), x, y + 0.85, z, 0.7, 0.16, 0.12, ry); K.put('plateOlive', L.geo('box'), x + c * 0.05, y + 0.95, z - s * 0.05, 0.22, 0.12, 0.16, ry);
    L.pipe('steel', x + c * 0.3, y + 0.86, z - s * 0.3, x + c * 1.2, y + 0.86, z - s * 1.2, 0.025);
    L.pipe('paintDark', x + c * 0.4, y + 0.86, z - s * 0.4, x + c * 0.8, y + 0.86, z - s * 0.8, 0.045);
    K.put('plateOlive', L.geo('box'), x + c * 0.1, y + 0.72, z - s * 0.1 + 0.14 * c, 0.2, 0.16, 0.1, ry);
  }
  /** Big cable drum lying on its side along Z. */
  function spool(x, z, r) {
    for (const d of [-0.45, 0.45]) L.cyl('wood', x, r, z + d, r, 0.08, Math.PI / 2, 0, false);
    L.cyl('rubber', x, r, z, r * 0.62, 0.82, Math.PI / 2, 0, false); L.cyl('woodDark', x, r, z, r * 0.3, 1.0, Math.PI / 2, 0, true);
    solid(x - r, 0, z - 0.5, x + r, r * 2, z + 0.5);
  }
  function pallets(x, z, n, y) { y = y || 0; for (let i = 0; i < n; i++) { const yy = y + i * 0.15; deco(x - 0.6, yy, z - 0.5, x + 0.6, yy + 0.03, z + 0.5, 'wood'); for (const d of [-0.42, 0, 0.42]) deco(x - 0.6, yy + 0.03, z + d - 0.05, x + 0.6, yy + 0.12, z + d + 0.05, 'woodDark'); deco(x - 0.6, yy + 0.12, z - 0.5, x + 0.6, yy + 0.15, z + 0.5, 'wood'); } solid(x - 0.6, y, z - 0.5, x + 0.6, y + n * 0.15, z + 0.5); }
  /** Red fire extinguisher on a wall bracket (wall normal nx, nz). */
  function extinguisher(x, y, z, nx, nz) { L.cyl('paintRed', x + nx * 0.12, y, z + nz * 0.12, 0.08, 0.5, 0, 0, true); K.sph('paintDark', x + nx * 0.12, y + 0.28, z + nz * 0.12, 0.05); deco(x - 0.05, y - 0.3, z - 0.05, x + 0.05, y - 0.26, z + 0.05, 'steel'); }
  /** Basic (unlit, additive) flat image: holograms and screens. */
  function glowPlane(tex, w, h, x, y, z, rx, ry, col) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: col || 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.set(rx || 0, ry || 0, 0); m.position.set(x, y, z); m.renderOrder = 4; L.scene.add(m); return m;
  }

  // ------------------------------------------------------------ canvas art
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const ct = (w, h, draw) => K.canvasTex(w, h, draw);
    const font = (px, bold) => (bold ? 'bold ' : '') + px + 'px "Arial Narrow", Arial, Helvetica, sans-serif';
    const stripes = (x, y0, w, h) => { x.save(); x.beginPath(); x.rect(0, y0, w, h); x.clip(); x.fillStyle = '#f2c230'; x.fillRect(0, y0, w, h); x.fillStyle = '#161616'; for (let i = -h; i < w; i += h * 1.4) { x.beginPath(); x.moveTo(i, y0 + h); x.lineTo(i + h * 0.7, y0 + h); x.lineTo(i + h * 1.4, y0); x.lineTo(i + h * 0.7, y0); x.fill(); } x.restore(); };
    const emblem = (x, cx, cy, r, fg, bg) => {
      if (bg) { x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill(); }
      x.strokeStyle = fg; x.fillStyle = fg; x.lineWidth = r * 0.045;
      x.beginPath(); x.arc(cx, cy, r * 0.92, 0, 6.283); x.stroke();
      x.beginPath(); x.arc(cx, cy - r * 0.1, r * 0.3, 0, 6.283); x.stroke();
      x.beginPath(); x.ellipse(cx, cy - r * 0.1, r * 0.13, r * 0.3, 0, 0, 6.283); x.stroke();
      x.beginPath(); x.moveTo(cx - r * 0.3, cy - r * 0.1); x.lineTo(cx + r * 0.3, cy - r * 0.1); x.stroke();
      for (const sd of [-1, 1]) {
        x.beginPath(); x.moveTo(cx + sd * r * 0.26, cy - r * 0.02);
        for (let i = 0; i < 5; i++) { x.lineTo(cx + sd * r * (0.78 - i * 0.07), cy - r * 0.34 + i * r * 0.1); x.lineTo(cx + sd * r * (0.36 + i * 0.02), cy - r * 0.16 + i * r * 0.09); }
        x.lineTo(cx + sd * r * 0.24, cy + r * 0.24); x.fill();
      }
      x.font = font(r * 0.34, true); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText('UNSC', cx, cy + r * 0.66);
    };
    ART.unsc = ct(512, 512, (x, w, h) => { x.clearRect(0, 0, w, h); emblem(x, w / 2, h / 2, 240, '#dcd6bf', 'rgba(34,40,30,0.92)'); });
    ART.facility = ct(1024, 256, (x, w, h) => {
      x.fillStyle = '#3c4232'; x.fillRect(0, 0, w, h); stripes(x, 0, w, 22); stripes(x, h - 22, w, 22);
      emblem(x, 120, 128, 88, '#dcd6bf');
      x.fillStyle = '#e8e2cc'; x.textAlign = 'left'; x.font = font(64, true); x.fillText('UNSC SPECIAL WARFARE CENTER', 236, 110);
      x.fillStyle = '#f2c230'; x.font = font(40, true); x.fillText('TRAINING FACILITY 03  ·  LIVE FIRE AREA', 238, 170);
      x.fillStyle = '#b8b29c'; x.font = font(26); x.fillText('SOUTH RIFT VALLEY  ·  KENYA', 238, 208);
    });
    const memo = (f) => { const c = {}; return (tm) => c[tm.name] || (c[tm.name] = f(tm)); };
    ART.base = memo((tm) => ct(1024, 160, (x, w, h) => {
      x.fillStyle = '#2a2e24'; x.fillRect(0, 0, w, h); x.fillStyle = tm.css; x.fillRect(0, 0, 150, h); x.fillRect(0, h - 14, w, 14);
      emblem(x, 75, 72, 58, '#f2eee0');
      x.fillStyle = '#f2eee0'; x.textAlign = 'left'; x.font = font(96, true); x.fillText(tm.name + ' BASE', 186, 104);
      x.fillStyle = tm.css; x.font = font(30, true); x.textAlign = 'right'; x.fillText(tm.name === 'BLUE' ? 'SECTOR W · ALPHA' : 'SECTOR E · BRAVO', w - 30, 58);
      x.fillStyle = '#b8b29c'; x.font = font(24); x.fillText('AUTHORIZED PERSONNEL ONLY', w - 30, 100);
    }));
    ART.banner = memo((tm) => ct(256, 512, (x, w, h) => {
      x.fillStyle = tm.css; x.fillRect(0, 0, w, h); x.fillStyle = tm.dark; x.fillRect(0, 0, w, 30); x.fillRect(0, h - 70, w, 70);
      x.fillStyle = tm.dark; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(40, 330 + i * 34); x.lineTo(128, 290 + i * 34); x.lineTo(216, 330 + i * 34); x.lineTo(216, 350 + i * 34); x.lineTo(128, 310 + i * 34); x.lineTo(40, 350 + i * 34); x.fill(); }
      emblem(x, w / 2, 160, 100, '#f5f1e4');
      x.fillStyle = '#f5f1e4'; x.font = font(46, true); x.textAlign = 'center'; x.fillText(tm.name + ' TEAM', w / 2, h - 22);
    }));
    ART.flag = memo((tm) => ct(256, 160, (x, w, h) => { x.fillStyle = tm.css; x.fillRect(0, 0, w, h); x.fillStyle = tm.dark; x.fillRect(0, h - 26, w, 26); emblem(x, w / 2, 70, 58, '#f5f1e4'); }));
    ART.target = ct(256, 384, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = '#d8c8a0'; x.fillRect(8, 8, w - 16, h - 16);
      x.fillStyle = '#20241c'; x.beginPath(); x.arc(w / 2, 92, 46, 0, 6.283); x.fill();
      x.beginPath(); x.moveTo(w / 2 - 34, 140); x.lineTo(w / 2 + 34, 140); x.lineTo(w / 2 + 104, 200); x.lineTo(w / 2 + 104, h - 8); x.lineTo(w / 2 - 104, h - 8); x.lineTo(w / 2 - 104, 200); x.fill();
      x.strokeStyle = '#d8c8a0'; x.lineWidth = 3; for (const r of [26, 52, 80]) { x.beginPath(); x.arc(w / 2, 240, r, 0, 6.283); x.stroke(); }
      x.beginPath(); x.arc(w / 2, 92, 20, 0, 6.283); x.stroke();
      x.fillStyle = '#d8c8a0'; x.font = font(22, true); x.textAlign = 'center'; x.fillText('10', w / 2, 248); x.fillText('8', w / 2, 204); x.fillText('6', w / 2, 176);
      x.fillStyle = '#6a1a14'; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(w / 2 + Math.sin(i * 2.3) * 44, 240 + Math.cos(i * 1.7) * 40, 4, 0, 6.283); x.fill(); }
    });
    ART.live = ct(512, 128, (x, w, h) => { stripes(x, 0, w, h); x.fillStyle = '#161616'; x.fillRect(22, 18, w - 44, h - 36); x.fillStyle = '#f2c230'; x.font = font(40, true); x.textAlign = 'center'; x.fillText('WARNING · LIVE FIRE AREA', w / 2, 66); x.font = font(22, true); x.fillStyle = '#e8e2cc'; x.fillText('EYE AND EAR PROTECTION REQUIRED', w / 2, 94); });
    ART.range = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#0c0f0b'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d2a18'; x.fillRect(0, 0, w, 44);
      x.fillStyle = '#9dff7a'; x.font = font(30, true); x.textAlign = 'left'; x.fillText('RANGE 03 · QUALIFICATION', 16, 32); x.textAlign = 'right'; x.fillText('14:26', w - 16, 32);
      const rows = [['LANE 1', 'S-117', '50/50', 'EXPERT'], ['LANE 2', 'S-058', '49/50', 'EXPERT'], ['LANE 3', 'S-104', '44/50', 'SHARPSHOOTER'], ['LANE 4', 'S-087', '47/50', 'EXPERT'], ['LANE 5', 'ODST 2', '38/50', 'MARKSMAN']];
      x.font = font(24, true);
      rows.forEach((r, i) => { const y = 82 + i * 36; x.textAlign = 'left'; x.fillStyle = '#9dff7a'; x.fillText(r[0], 16, y); x.fillText(r[1], 120, y); x.textAlign = 'right'; x.fillText(r[2], 330, y); x.fillStyle = r[3] === 'EXPERT' ? '#f2c230' : '#e8e2cc'; x.fillText(r[3], w - 16, y); });
    });
    ART.holo = ct(512, 512, (x, w, h) => {
      // the facility itself, drawn as a tactical map: bases, towers, the Sword Room, the Pit and the Long Hall
      x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(120,220,255,0.95)'; x.lineWidth = 3;
      const S = w / 110, R = (x0, z0, x1, z1) => x.strokeRect(w / 2 + x0 * S, h / 2 + (z0 + 2.5) * S * 1.6, (x1 - x0) * S, (z1 - z0) * S * 1.6);
      R(PX0, PZ0, PX1, PZ1);
      for (const s of [-1, 1]) { R(s > 0 ? 34 : -48, -12, s > 0 ? 48 : -34, 8); R(s > 0 ? 37.5 : -44.5, -29.5, s > 0 ? 44.5 : -37.5, -22.5); }
      R(-8, -30, 8, -17); R(-14, -11, 14, 5); R(-30, 19, 30, 25); R(-6, 13, 6, 19);
      x.fillStyle = 'rgba(120,220,255,0.35)'; x.fillRect(w / 2 - 3 * S, h / 2 + (-4.2 + 2.5) * S * 1.6, 6 * S, 2.4 * S * 1.6);
      x.fillStyle = 'rgba(120,220,255,0.9)'; x.font = font(18, true); x.textAlign = 'center';
      x.fillText('BLUE', w / 2 - 41 * S, h / 2 + 2 * S * 1.6); x.fillText('RED', w / 2 + 41 * S, h / 2 + 2 * S * 1.6); x.fillText('PIT', w / 2, h / 2 + 5 * S * 1.6); x.fillText('SWORD', w / 2, h / 2 + (-21 + 2.5) * S * 1.6); x.fillText('LONG HALL', w / 2 + 16 * S, h / 2 + (24 + 2.5) * S * 1.6);
      for (let i = 0; i < 24; i++) { x.globalAlpha = 0.2; x.fillRect(0, i * 22, w, 1); } x.globalAlpha = 1;
    });
    ART.poster1 = ct(256, 384, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2c3a52'); g.addColorStop(1, '#101722'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#556070'; x.beginPath(); x.arc(w / 2, 150, 58, Math.PI, 0); x.lineTo(w / 2 + 58, 190); x.lineTo(w / 2 - 58, 190); x.fill();
      x.fillStyle = '#e2b34a'; x.fillRect(w / 2 - 44, 140, 88, 22);
      x.fillStyle = '#556070'; x.beginPath(); x.moveTo(w / 2 - 110, 300); x.lineTo(w / 2 - 70, 200); x.lineTo(w / 2 + 70, 200); x.lineTo(w / 2 + 110, 300); x.fill();
      x.fillStyle = '#f2eee0'; x.font = font(34, true); x.textAlign = 'center'; x.fillText('SERVE WITH', w / 2, 44); x.fillText('HONOR', w / 2, 80);
      x.fillStyle = '#e2b34a'; x.font = font(26, true); x.fillText('ENLIST TODAY', w / 2, 336); x.fillStyle = '#9aa4b4'; x.font = font(16); x.fillText('UNITED NATIONS SPACE COMMAND', w / 2, 362);
    });
    ART.poster2 = ct(256, 384, (x, w, h) => {
      x.fillStyle = '#2a2016'; x.fillRect(0, 0, w, h); x.fillStyle = '#c05a2a'; x.fillRect(0, 0, w, 70);
      x.fillStyle = '#f2eee0'; x.font = font(30, true); x.textAlign = 'center'; x.fillText('KNOW YOUR', w / 2, 32); x.fillText('ENEMY', w / 2, 62);
      x.fillStyle = '#6a5a44';
      const alien = (cx, s) => { x.beginPath(); x.ellipse(cx, 150 * s + 40, 18 * s, 22 * s, 0, 0, 6.283); x.fill(); x.beginPath(); x.moveTo(cx - 30 * s, 180 * s + 40); x.lineTo(cx + 30 * s, 180 * s + 40); x.lineTo(cx + 22 * s, 300 * s + 40); x.lineTo(cx - 22 * s, 300 * s + 40); x.fill(); };
      alien(70, 1); alien(180, 0.8); x.fillStyle = '#8a3a1a'; x.beginPath(); x.ellipse(128, 300, 30, 18, 0, 0, 6.283); x.fill();
      x.fillStyle = '#e2b34a'; x.font = font(18, true); x.fillText('IDENTIFY · ENGAGE · REPORT', w / 2, h - 22);
    });
    ART.poster3 = ct(256, 384, (x, w, h) => {
      x.fillStyle = '#e8e2cc'; x.fillRect(0, 0, w, h); stripes(x, 0, w, 26); stripes(x, h - 26, w, 26);
      x.fillStyle = '#1c1c1c'; x.font = font(34, true); x.textAlign = 'center'; x.fillText('RANGE', w / 2, 80); x.fillText('SAFETY', w / 2, 116);
      x.font = font(20, true); ['1. TREAT EVERY WEAPON', '   AS LOADED', '2. MUZZLE DOWNRANGE', '3. FINGER OFF TRIGGER', '4. KNOW YOUR TARGET', '5. CALL CEASE FIRE'].forEach((t, i) => { x.textAlign = 'left'; x.fillText(t, 22, 170 + i * 30); });
    });
    const stencilCache = {};
    ART.stencil = (text, col) => stencilCache[text + col] || (stencilCache[text + col] = ct(512, 160, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = col || 'rgba(34,34,30,0.85)'; x.font = '900 118px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.fillText(text, w / 2, 124);
      x.globalCompositeOperation = 'destination-out'; x.fillRect(0, 70, w, 7); for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 5, h); x.globalCompositeOperation = 'source-over';
    }));
    ART.sign = (a, b, bg, fg) => ct(512, 128, (x, w, h) => { x.fillStyle = bg || '#1e231a'; x.fillRect(0, 0, w, h); x.fillStyle = fg || '#f2c230'; x.textAlign = 'left'; x.font = font(54, true); x.fillText(a, 24, 62); x.font = font(28); x.fillStyle = '#d8d2bc'; x.fillText(b, 26, 104); });
    ART.screen = ct(512, 288, (x, w, h) => {
      x.fillStyle = '#081014'; x.fillRect(0, 0, w, h); emblem(x, 110, 140, 80, 'rgba(120,220,255,0.9)');
      x.fillStyle = 'rgba(120,220,255,0.95)'; x.font = font(30, true); x.textAlign = 'left'; x.fillText('OPERATION: KILLING FIELD', 212, 80);
      x.font = font(22); ['OBJ 1  SECURE SWORD ROOM', 'OBJ 2  HOLD THE LONG HALL', 'OBJ 3  CAPTURE ENEMY FLAG', 'ROE    TRAINING ROUNDS ONLY'].forEach((t, i) => x.fillText(t, 212, 124 + i * 34));
    });
    return ART;
  }

  // ------------------------------------------------------------ ground and perimeter
  function ground() {
    // concrete-lined ground slab with the Pit cut out of the middle
    const G = (x0, z0, x1, z1) => L.box(x0, -2.6, z0, x1, 0, z1, 'bunker', { top: 'dirt' });
    G(PX0 - 2, PZ0 - 2, PX1 + 2, -11); G(PX0 - 2, 5, PX1 + 2, PZ1 + 2); G(PX0 - 2, -11, -14, 5); G(14, -11, PX1 + 2, 5);
    // concrete aprons: in front of each base, round the Pit, the Sword Room forecourt, the path along the Long Hall
    for (const s of [-1, 1]) {
      const X = (u) => s * u;
      deco(X(25), 0, -13, X(34), 0.006, 8, 'concrete'); deco(X(30), 0, 8, X(52), 0.006, 25, 'concrete'); deco(X(34), 0, -22.4, X(52), 0.006, -12, 'concrete');
      for (let z = -12; z < 8; z += 3) deco(X(25), 0.006, z - 0.02, X(34), 0.009, z + 0.02, 'rubber');
      deco(X(33.5), 0.006, -4.2, X(29.5), 0.012, -3.9, 'lineWhite'); deco(X(33.5), 0.006, 3.9, X(29.5), 0.012, 4.2, 'lineWhite');
    }
    deco(-16, 0, -13, 16, 0.006, -11, 'concrete'); deco(-16, 0, 5, 16, 0.006, 7, 'concrete'); deco(-16, 0, -11, -14, 0.006, 5, 'concrete'); deco(14, 0, -11, 16, 0.006, 5, 'concrete');
    deco(-8.5, 0, -17, 8.5, 0.006, -13, 'concrete'); deco(-30, 0, 17, -6.15, 0.006, 19, 'concrete'); deco(6.15, 0, 17, 30, 0.006, 19, 'concrete');
    // oil stains
    for (const [x, z, sx] of [[-38, 16, 2.2], [38, 16, 2.2], [-21, 10, 1.4], [23, -15, 1.6], [-9, -21, 1.2], [44, -18, 1.5], [-44, -16, 1.3]]) L.blob(x, z, sx, sx * 0.8);
  }
  function perimeter() {
    const coil = new THREE.TorusGeometry(0.34, 0.012, 3, 10);
    const PW = (x0, z0, x1, z1) => { L.box(x0, 0, z0, x1, WH, z1, 'bunker', { top: 'concreteDark' }); W.add(x0, WH, z0, x1, 60, z1, { shoot: false, nav: false }); };
    PW(PX0 - 1.5, PZ0 - 1.5, PX1 + 1.5, PZ0); PW(PX0 - 1.5, PZ1, PX1 + 1.5, PZ1 + 1.5); PW(PX0 - 1.5, PZ0, PX0, PZ1); PW(PX1, PZ0, PX1 + 1.5, PZ1);
    // inside face: a dark plinth, pilasters, a painted band; coping, posts and razor wire along the top
    const runs = [['x', PX0, PX1, PZ0, 1], ['x', PX0, PX1, PZ1, -1], ['z', PZ0, PZ1, PX0, 1], ['z', PZ0, PZ1, PX1, -1]];
    for (const [ax, a0, a1, c, n] of runs) {
      const B = (p0, p1, y0, y1, d, m) => ax === 'x' ? deco(p0, y0, n > 0 ? c : c - d, p1, y1, n > 0 ? c + d : c, m) : deco(n > 0 ? c : c - d, y0, p0, n > 0 ? c + d : c, y1, p1, m);
      B(a0, a1, 0, 0.8, 0.05, 'bunkerDark'); B(a0, a1, 5.9, 6.2, 0.03, 'plateOlive');
      for (let a = a0 + 3; a < a1 - 1; a += 6) B(a - 0.3, a + 0.3, 0, WH, 0.12, 'bunker');
      const o = ax === 'x' ? [0, -n] : [-n, 0];
      for (let a = a0; a <= a1; a += 3) { const px = ax === 'x' ? a : c + o[0] * 0.75, pz = ax === 'x' ? c + o[1] * 0.75 : a; L.pipe('steel', px, WH, pz, px, WH + 1.1, pz, 0.03); }
      for (const y of [WH + 0.5, WH + 1.05]) { if (ax === 'x') L.pipe('steel', a0, y, c + o[1] * 0.75, a1, y, c + o[1] * 0.75, 0.01); else L.pipe('steel', c + o[0] * 0.75, y, a0, c + o[0] * 0.75, y, a1, 0.01); }
      for (let a = a0; a < a1; a += 0.55) { if (ax === 'x') K.put('steel', coil, a, WH + 0.38, c + o[1] * 0.75, 1, 1, 1, Math.PI / 2); else K.put('steel', coil, c + o[0] * 0.75, WH + 0.38, a, 1, 1, 1, 0); }
    }
    deco(PX0 - 1.6, WH, PZ0 - 1.6, PX1 + 1.6, WH + 0.12, PZ0 + 0.08, 'concreteDark'); deco(PX0 - 1.6, WH, PZ1 - 0.08, PX1 + 1.6, WH + 0.12, PZ1 + 1.6, 'concreteDark');
    deco(PX0 - 1.6, WH, PZ0, PX0 + 0.08, WH + 0.12, PZ1, 'concreteDark'); deco(PX1 - 0.08, WH, PZ0, PX1 + 1.6, WH + 0.12, PZ1, 'concreteDark');
    // security cameras and wall lamps along the top, sector stencils
    for (const [x, z, ry] of [[-26, PZ0, 0], [26, PZ0, 0], [-20, PZ1, Math.PI], [20, PZ1, Math.PI], [PX0, -2, Math.PI / 2], [PX1, -2, -Math.PI / 2]]) {
      const nx = Math.sin(ry), nz = Math.cos(ry);
      deco(x - 0.08 + nx * 0.05, WH - 0.6, z - 0.08 + nz * 0.05, x + 0.08 + nx * 0.3, WH - 0.4, z + 0.08 + nz * 0.3, 'steel');
      K.put('appliance', L.geo('box'), x + nx * 0.5, WH - 0.62, z + nz * 0.5, 0.18, 0.18, 0.42, ry); K.sph('lampRed', x + nx * 0.72, WH - 0.62, z + nz * 0.72, 0.03);
    }
    const A = art();
    K.plane(A.stencil('SECTOR 03'), 6, 1.9, 0, 7.4, PZ1 - 0.02, Math.PI, { alpha: true });
    K.plane(A.facility, 12, 3, -20, 7.2, PZ1 - 0.02, Math.PI); K.plane(A.facility, 12, 3, 20, 7.2, PZ1 - 0.02, Math.PI);
    K.plane(A.stencil('W-1'), 4, 1.25, PX0 + 0.02, 6.8, 13, Math.PI / 2, { alpha: true }); K.plane(A.stencil('E-1'), 4, 1.25, PX1 - 0.02, 6.8, 13, -Math.PI / 2, { alpha: true });
  }

  // ------------------------------------------------------------ the bases (s = -1 Blue, west; s = +1 Red, east)
  function base(s, rnd) {
    const tm = TEAM[s], A = art(), X = (u) => s * u, hx = (a, b, y0, y1) => [Math.min(X(a), X(b)), Math.max(X(a), X(b)), y0, y1];
    const dx = (u0, y0, z0, u1, y1, z1, m) => deco(X(u0), y0, z0, X(u1), y1, z1, m);
    const OUT = [[0, 0.7, 'bunkerDark'], [0.7, UF - 0.35, 'bunker'], [UF - 0.35, UF + 0.05, tm.paint], [UF + 0.05, RF, 'bunker']];
    const IN1 = [[0, 1.2, 'plateOlive'], [1.2, UF, 'bunker']], IN2 = [[UF, UF + 1.2, 'plateOlive'], [UF + 1.2, RF, 'bunker']];
    // shell: front (garage and a door, sniper windows and the balcony door upstairs), back, north (tower bridge), south (yard)
    wall('z', -12, 8, X(34), 0, UF, [[-4, 4, 0, 3.4], [-10.6, -9, 0, 2.4]], -s, OUT, IN1);
    wall('z', -12, 8, X(34), UF, RF, [[-9.4, -5, UF + 1.0, UF + 2.4], [-3, 1.6, UF + 1.0, UF + 2.4], [3.4, 5, UF, UF + 2.4]], -s, OUT, IN2);
    wall('z', -12, 8, X(48), 0, UF, [[-8, -6.5, 0, 2.4]], s, OUT, IN1);
    wall('z', -12, 8, X(48), UF, RF, [[-8.5, -5.5, UF + 1.3, UF + 2.2], [1, 4, UF + 1.3, UF + 2.2]], s, OUT, IN2);
    wall('x', X(34), X(48), -12, 0, UF, [hx(36, 37.6, 0, 2.4)], -1, OUT, IN1);
    wall('x', X(34), X(48), -12, UF, RF, [hx(40.1, 41.5, UF, UF + 2.4), hx(35.5, 38.5, UF + 1.3, UF + 2.2)], -1, OUT, IN2);
    wall('x', X(34), X(48), 8, 0, UF, [hx(40, 42, 0, 2.4)], 1, OUT, IN1);
    wall('x', X(34), X(48), 8, UF, RF, [hx(36.5, 39.5, UF + 1.3, UF + 2.2), hx(42.5, 44.5, UF + 1.3, UF + 2.2)], 1, OUT, IN2);
    // floor finish, upper slab round the stairwell, roof with a parapet
    dx(34.15, 0, -11.85, 47.85, 0.006, 7.85, 'concreteDark');
    const sl = (a, b, c, d) => L.box(X(a), UF - 0.3, b, X(c), UF, d, 'ceiling', { top: 'concrete', side: 'bunkerDark' });
    sl(34.15, -11.85, 45.4, 7.85); sl(45.4, -11.85, 47.85, -2.5); sl(45.4, 6.5, 47.85, 7.85);
    L.box(X(33.7), RF, -12.3, X(48.3), RF + 0.4, 8.3, 'ceiling', { top: 'concreteDark', side: 'bunkerDark' });
    for (const [a, b, c, d] of [[33.7, -12.3, 48.3, -12], [33.7, 8, 48.3, 8.3], [33.7, -12, 34, 8], [48, -12, 48.3, 8]]) dx(a, RF + 0.4, b, c, RF + 0.95, d, 'bunker');
    K.roofCap(Math.min(X(33.5), X(48.5)), -12.5, Math.max(X(33.5), X(48.5)), 8.5, RF + 0.4);
    P('ac', X(44), -6, Math.PI / 2, RF + 0.4); P('vent', X(38), 4, 0, RF + 0.4); P('vent', X(38), -8, 0, RF + 0.4);
    L.cyl('steel', X(46.5), RF + 3.4, 5.5, 0.05, 6, 0, 0, true); K.sph(tm.lamp, X(46.5), RF + 6.45, 5.5, 0.12);
    for (let k = 0; k < 3; k++) L.pipe('steel', X(46.5), RF + 2 + k * 1.3, 5.5, X(46.5 - 0.6), RF + 2.4 + k * 1.3, 5.5, 0.012);
    // team signs and the stripe round the garage
    K.plane(A.base(tm), 6, 0.94, X(34) - s * (T / 2 + 0.02), 3.78, 0, -s * Math.PI / 2);
    K.plane(A.banner(tm), 1.6, 3.2, X(34) - s * (T / 2 + 0.02), UF + 2.2, 6.6, -s * Math.PI / 2);
    for (const sg of [-1, 1]) dx(33.8, 0, sg * 4.14, 33.84, 3.52, sg * 4.44, 'hazard');
    bulkhead(X(34) - s * 0.2, 3.1, -5, -s, 0, 'lampAmber'); bulkhead(X(34) - s * 0.2, 3.1, 5, -s, 0, 'lampAmber');
    K.plane(A.stencil(s < 0 ? 'B-01' : 'R-01', '#f2eee0'), 2.6, 0.8, X(48) + s * (T / 2 + 0.02), 2.2, 0, s * Math.PI / 2, { alpha: true });
    K.plane(A.stencil('ARMORY', '#f2eee0'), 3, 0.94, X(41), 2.9, 8 + T / 2 + 0.02, 0, { alpha: true });
    // roll-up door drum inside over the garage, its chain
    L.cyl('plateOlive', X(34.5), 3.75, 0, 0.35, 8.4, Math.PI / 2, 0, false); dx(34.2, 3.4, -4.2, 34.9, 3.45, 4.2, 'paintDark');
    L.pipe('steel', X(34.4), 3.4, 4.3, X(34.4), 1.2, 4.3, 0.01);

    // ground floor: the armory with the flag stand
    K.put(tm.paint, K.discGeo(1.35, 1.65, 0.25), X(41), 0.012, -2, 1, 1, 1); K.put('hazard', K.discGeo(1.65, 1.8, 0.5), X(41), 0.011, -2, 1, 1, 1);
    for (const z of [-11.2, 7.2]) dx(34.6, 0.008, z - 0.08, 44.8, 0.012, z + 0.08, tm.paint);
    steps('z', -2.5, 6.5, X(45.45), X(47.85), 0, UF, -1, 'plateOlive', 'grate');
    slopeGuard('z', -2.5, 6.5, X(45.4), 0, UF, -1);
    lockers('x', Math.min(X(38.5), X(44.74)), 12, -11.85, 1, 0);
    gunRack('z', -8.6, -5.2, X(34.15), s, 0);
    P('crate', X(35.8), 6.8, 0.1); P('crateSmall', X(35.9), 6.8, -0.2, 1.2); P('crateSmall', X(37.3), 7.1, 0.3);
    for (let i = 0; i < 4; i++) ammoBox(X(38.6 + i * 0.95), 0, 7.4, true, true); ammoBox(X(39.1), 0.34, 7.4, true); ammoBox(X(40.9), 0.34, 7.4, true);
    P('drum', X(47.2), -11.2); P('drum', X(46.5), -11.3, 0.4); P('barrel', X(47.2), -10.4);
    // briefing table with the hologram of the facility
    L.box(X(41.8), 0, -8.4, X(44.6), 0.92, -6.4, 'plateOlive', { top: 'paintDark' }); dx(41.9, 0.92, -8.3, 44.5, 0.94, -6.5, 'lampBlue');
    glowPlane(A.holo, 2.4, 1.7, X(43.2), 1.2, -7.4, -Math.PI / 2 + 0.25, 0, 0x88ccff);
    for (const [u, z] of [[41.4, -7.4], [45, -7.4], [43.2, -9]]) P('stool', X(u), z, 0);
    // workbench on the back wall: toolboard, a disassembled rifle, a grinder
    L.box(X(47.1), 0, -6.2, X(47.85), 0.9, -3.8, 'steel', { top: 'woodDark' }); dx(47.8, 1.2, -6.2, 47.84, 2.3, -3.8, 'woodDark');
    for (let z = -6; z < -4; z += 0.3) dx(47.74, 1.5 + (Math.abs(z) * 7 % 0.5), z, 47.8, 1.9, z + 0.05, 'steel');
    dx(47.3, 0.9, -5.6, 47.5, 0.96, -4.7, 'paintDark'); dx(47.25, 0.9, -4.5, 47.55, 1.1, -4.2, 'paintGrey');
    K.plane(A.banner(tm), 1.4, 2.8, X(36.6), 2.2, 7.85 - 0.02, Math.PI);
    K.plane(A.poster3, 0.8, 1.2, X(47.85) - s * 0.02, 1.8, -10, -s * Math.PI / 2);
    extinguisher(X(34.15), 1.0, -11.4, -s, 0);
    for (const [u, z] of [[38, -7], [38, 3], [43, -3.5], [43, 3.5]]) tube(X(u), UF - 0.3, z, false, 1.6);
    dx(34.2, 2.6, -11.8, 34.26, 2.65, -4.4, tm.lamp); dx(34.2, 2.6, 4.4, 34.26, 2.65, 7.8, tm.lamp);
    L.lamp(X(41), 2.8, -2, { color: tm.light, intensity: 1.2, distance: 8, pool: false });
    L.addPickup('ammo', X(36.8), 0, 4.8);

    // upstairs: the sniper nest behind the front windows, comms desk, bunks
    rail('z', -2.5, 6.5, X(45.4), UF); rail('x', X(45.4), X(47.85), 6.5, UF);
    for (const [z0, z1] of [[-9.2, -5.2], [-2.8, 1.4]]) bags(X(34.6), z0, X(34.6), z1, 2, UF);
    desk(Math.min(X(35.6), X(39.8)), Math.max(X(35.6), X(39.8)), -11.85, 1, UF); P('stool', X(36.6), -10.2, 0, UF); P('stool', X(38.8), -10.2, 0, UF);
    bunk(Math.min(X(35.2), X(37.3)), 6.9, Math.max(X(35.2), X(37.3)), 7.85, UF); bunk(Math.min(X(38.2), X(40.3)), 6.9, Math.max(X(38.2), X(40.3)), 7.85, UF);
    for (let i = 0; i < 3; i++) { const u = 41.5 + i * 0.7; L.box(X(u), UF, 7.3, X(u + 0.6), UF + 1.8, 7.85, 'plateOlive', { top: 'paintDark' }); dx(u + 0.29, UF + 0.1, 7.28, u + 0.31, UF + 1.7, 7.3, 'paintDark'); }
    ammoBox(X(44), UF, -11.3, true, true); ammoBox(X(44.1), UF + 0.34, -11.3, true); rocketCrate(X(46.5), UF, -11.2, true);
    K.plane(A.poster1, 0.8, 1.2, X(47.85) - s * 0.02, UF + 1.7, -8.3, -s * Math.PI / 2); K.plane(A.poster2, 0.8, 1.2, X(47.85) - s * 0.02, UF + 1.7, -1, -s * Math.PI / 2);
    for (const [u, z] of [[38, -7], [38, 3], [42.5, -7], [42.5, 1]]) tube(X(u), RF, z, false, 1.6);
    L.addPickup('ammo', X(43), UF, -8);
    // balcony over the yard
    L.box(X(31), UF - 0.25, -2, X(33.85), UF, 7, 'grate', { side: 'plateOlive' });
    rail('z', -2, 7, X(31), UF); rail('x', X(31), X(33.85), -2, UF); rail('x', X(31), X(33.85), 7, UF);
    for (const z of [-1.7, 6.7]) { L.pipe('greyClean', X(31.25), 0, z, X(31.25), UF - 0.25, z, 0.09); W.addCyl(X(31.25), z, 0.1, 0, UF - 0.25, { surf: 'metal' }); L.pipe('greyClean', X(31.3), UF - 0.3, z, X(33.8), UF - 1.8, z, 0.05); }
    // bridge to the sniper tower, on a pier
    L.box(X(39.6), UF - 0.3, -22.35, X(42), UF, -12.15, 'grate', { side: 'plateOlive' });
    rail('z', -22.35, -12.15, X(39.6), UF); rail('z', -22.35, -12.15, X(42), UF);
    L.box(X(39.9), 0, -17.8, X(41.7), UF - 0.3, -16.8, 'bunker', { top: 'bunker' }); dx(39.85, 0, -17.85, 41.75, 0.7, -16.75, 'bunkerDark');
    for (const z of [-21.5, -13]) { L.pipe('greyClean', X(39.75), 0, z, X(39.75), UF - 0.3, z, 0.08); L.pipe('greyClean', X(41.85), 0, z, X(41.85), UF - 0.3, z, 0.08); W.addCyl(X(39.75), z, 0.09, 0, UF - 0.3, { surf: 'metal' }); W.addCyl(X(41.85), z, 0.09, 0, UF - 0.3, { surf: 'metal' }); }
    tower(s, tm, A, X, dx);
  }
  function tower(s, tm, A, X, dx) {
    const OUT = [[UF, UF + 0.2, 'bunkerDark'], [UF + 0.2, TP - 0.4, 'bunker'], [TP - 0.4, TP, tm.paint]], IN = [[UF, UF + 1.2, 'plateOlive'], [UF + 1.2, TP, 'bunker']];
    // the concrete shaft up to the nest, buttressed; a sealed blast door facing the bridge
    L.box(X(37.35), 0, -29.65, X(44.65), UF, -22.35, 'bunker', { top: 'concrete' });
    for (const [a, b, c, d] of [[37.1, -29.65, 37.35, -28.9], [37.1, -23.1, 37.35, -22.35], [44.65, -29.65, 44.9, -28.9], [44.65, -23.1, 44.9, -22.35], [37.35, -22.35, 38.1, -22.1], [43.9, -22.35, 44.65, -22.1]])
      L.box(X(a), 0, b, X(c), UF, d, 'bunkerDark');
    dx(39.6, 0, -22.35, 42.4, 2.6, -22.31, 'plateOlive'); dx(39.5, 2.6, -22.35, 42.5, 2.75, -22.3, 'hazard'); for (let k = 0; k < 5; k++) dx(39.7, 0.3 + k * 0.45, -22.31, 42.3, 0.34 + k * 0.45, -22.28, 'paintDark');
    K.plane(A.stencil(s < 0 ? 'TOWER W' : 'TOWER E', '#f2eee0'), 3.2, 1, X(41), 3.4, -22.27, 0, { alpha: true });
    // the nest: walls, door to the bridge, door to the catwalk, slit windows
    wall('z', -29.5, -22.5, X(37.5), UF, TP, [[-29.2, -27.3, UF, UF + 2.3]], -s, OUT, IN);
    wall('z', -29.5, -22.5, X(44.5), UF, TP, [[-28, -24, UF + 1.5, UF + 1.9]], s, OUT, IN);
    wall('x', X(37.5), X(44.5), -29.5, UF, TP, [[Math.min(X(38.5), X(41.5)), Math.max(X(38.5), X(41.5)), UF + 1.5, UF + 1.9]], -1, OUT, IN);
    wall('x', X(37.5), X(44.5), -22.5, UF, TP, [[Math.min(X(40.1), X(41.5)), Math.max(X(40.1), X(41.5)), UF, UF + 2.3], [Math.min(X(38), X(39.4)), Math.max(X(38), X(39.4)), UF + 1.2, UF + 2]], 1, OUT, IN);
    dx(37.65, UF, -29.35, 44.35, UF + 0.006, -22.65, 'metalFloor');
    steps('z', -29.2, -24, X(42.25), X(44.35), UF, TP, -1, 'plateOlive', 'grate');
    slopeGuard('z', -27.9, -24, X(42.2), UF, UF + (TP - UF) * 3.9 / 5.2, -1); // open at the top: step off west onto the roof
    const sl = (a, b, c, d) => L.box(X(a), TP - 0.3, b, X(c), TP, d, 'ceiling', { top: 'concrete', side: 'bunkerDark' });
    sl(37.65, -29.35, 42.2, -22.65); sl(42.2, -24.6, 44.35, -22.65);
    gunRack('x', Math.min(X(38), X(41)), Math.max(X(38), X(41)), -29.35, 1, UF);
    P('crateSmall', X(38.3), -23.3, 0.2, UF); ammoBox(X(39.4), UF, -23.1, true, true);
    tube(X(40), TP - 0.3, -26, true, 1.6); bulkhead(X(37.65) + s * 0.1, UF + 2.2, -24, s, 0);
    // the top: parapet, sandbags, a canopy on four posts, spotlight and beacon
    for (const [a, b, c, d] of [[37.35, -29.65, 44.65, -29.35], [37.35, -22.65, 44.65, -22.35], [37.35, -29.35, 37.65, -22.65], [44.35, -29.35, 44.65, -22.65]])
      L.box(X(a), TP, b, X(c), TP + 1.1, d, 'bunker', { top: 'concreteDark' });
    rail('x', X(42.2), X(44.35), -24.6, TP); rail('z', -24.6, -27.9, X(42.2), TP);
    bags(X(38.1), -23.1, X(41.2), -23.1, 2, TP); bags(X(38.1), -28.9, X(38.1), -26.6, 2, TP);
    for (const [u, z] of [[37.8, -29.1], [44.2, -29.1], [37.8, -22.9], [44.2, -22.9]]) L.pipe('greyClean', X(u), TP + 1.1, z, X(u), TP + 2.9, z, 0.06);
    L.box(X(37.1), TP + 2.9, -29.9, X(44.9), TP + 3.1, -22.1, 'plateOlive', { top: 'roofTin', noCol: true }); K.roofCap(Math.min(X(37), X(45)), -30, Math.max(X(37), X(45)), -22, TP + 2.9);
    K.sph(tm.lamp, X(41), TP + 3.3, -26, 0.16); L.lamp(X(41), TP + 2.4, -26, { color: tm.light, intensity: 0.9, distance: 7, pool: false });
    tripodGun(X(39.4), -23.9, TP, -Math.PI / 2);
    K.put('paintDark', L.geo('cyl'), X(38.2), TP + 1.3, -22.6, 0.22, 0.35, 0.22, 0, Math.PI / 2 - 0.3); K.sph('lampWarm', X(38.2), TP + 1.36, -22.42, 0.17, 0.17, 0.04);
    L.pipe('steel', X(44.2), TP + 3.1, -29.2, X(44.2), TP + 6.5, -29.2, 0.03); K.sph('lampRed', X(44.2), TP + 6.55, -29.2, 0.06);
    L.addPickup('ammo', X(40), TP, -26.8);
  }

  // ------------------------------------------------------------ north catwalks, ramps and the Sword Room
  function catwalks(s) {
    const X = (u) => s * u;
    // catwalk from the tower along the north wall, the landing outside the Sword Room, the ramp down to the yard
    L.box(X(18), UF - 0.25, -29.85, X(37.35), UF, -27, 'grate', { side: 'plateOlive' });
    L.box(X(8.15), UF - 0.3, -29.85, X(18), UF, -24.5, 'bunker', { top: 'concrete', side: 'bunkerDark' });
    rail('x', X(30), X(37.35), -27, UF); rail('x', X(8.3), X(18), -24.5, UF);
    for (let u = 20; u < 37; u += 4.2) { deco(Math.min(X(u - 0.06), X(u + 0.06)), UF - 0.9, -29.9, Math.max(X(u - 0.06), X(u + 0.06)), UF - 0.25, -27.3, 'plateOlive'); L.pipe('plateOlive', X(u), UF - 1.2, -29.9, X(u), UF - 0.3, -27.4, 0.04); }
    for (const u of [32, 36]) { L.pipe('greyClean', X(u), 0, -27.3, X(u), UF - 0.25, -27.3, 0.1); W.addCyl(X(u), -27.3, 0.11, 0, UF - 0.25, { surf: 'metal' }); }
    for (const u of [12, 17.5]) { L.box(X(u) - 0.25, 0, -25.05, X(u) + 0.25, UF - 0.3, -24.55, 'bunker'); }
    ramp('x', Math.min(X(18), X(30)), Math.max(X(18), X(30)), -27, -24.5, 0, UF, -s, 'concrete', 'bunker');
    slopeGuard('x', Math.min(X(18), X(30)), Math.max(X(18), X(30)), -24.45, 0, UF, -s);
    deco(Math.min(X(18), X(30)), 0, -24.5, Math.max(X(18), X(30)), 0.5, -24.44, 'hazard');
    const A = art();
    K.plane(A.stencil(s < 0 ? 'C-W' : 'C-E', 'rgba(34,34,30,0.8)'), 2, 0.62, X(13), 2.2, -24.53, 0, { alpha: true });
    bulkhead(X(10), 3.4, -24.55, 0, 1); bulkhead(X(16), 3.4, -24.55, 0, 1);
    // under the landing: a store of spare sandbags and drums
    P('drum', X(9), -29); P('drum', X(9.7), -28.4, 0.5); spool(X(14.5), -28.4, 0.75); pallets(X(11.5), -28.8, 3);
  }
  function swordRoom(rnd) {
    const A = art();
    const OUT = [[0, 0.7, 'bunkerDark'], [0.7, UF - 0.35, 'bunker'], [UF - 0.35, UF + 0.05, 'plateOlive'], [UF + 0.05, SR, 'bunker']];
    const IN1 = [[0, 1.2, 'plateOlive'], [1.2, UF, 'bunker']], IN2 = [[UF, UF + 1.0, 'panelDark'], [UF + 1.0, SR, 'bunker']];
    // ordnance store on the ground, the Sword Room over it; its north wall is the perimeter
    for (const s of [-1, 1]) {
      wall('z', PZ0 + 0.15, -17, s * 8, 0, UF - 0.3, [[-22.6, -20.6, 0, 2.4], [-28, -25.5, 1.4, 1.9]], s, OUT, IN1);
      wall('z', PZ0 + 0.15, -17, s * 8, UF, SR, [[-27.8, -25.8, UF, UF + 2.4], [-22.5, -19, UF + 1.1, UF + 2.1]], s, OUT, IN2);
    }
    wall('x', -8, 8, -17, 0, UF - 0.3, [[-6, -4.4, 0, 2.4], [4.4, 6, 0, 2.4], [-2.5, 2.5, 1.2, 2.2]], 1, OUT, IN1);
    wall('x', -8, 8, -17, UF, SR, [[-2.5, 2.5, UF, UF + 2.8], [-7, -4.2, UF + 1.0, UF + 2.2], [4.2, 7, UF + 1.0, UF + 2.2]], 1, OUT, IN2);
    for (let x = -2.3; x < 2.4; x += 0.35) deco(x - 0.02, 1.2, -17.03, x + 0.02, 2.2, -16.97, 'steel');
    L.box(-8.15, UF - 0.3, -29.85, 8.15, UF, -14, 'ceiling', { top: 'metalFloor', side: 'bunkerDark' });
    L.box(-8.5, SR, -30, 8.5, SR + 0.4, -16.6, 'ceiling', { top: 'concreteDark', side: 'bunkerDark' }); K.roofCap(-8.6, -30, 8.6, -16.5, SR + 0.4);
    P('ac', -4, -24, 0, SR + 0.4); P('vent', 4, -21, 0, SR + 0.4);
    // terrace over the Pit, on two columns
    rail('x', -8.15, 8.15, -14, UF); rail('z', -17, -14, -8.15, UF); rail('z', -17, -14, 8.15, UF);
    for (const x of [-7.6, 7.6]) { L.cyl('bunker', x, (UF - 0.3) / 2, -14.4, 0.28, UF - 0.3, 0, 0, false); W.addCyl(x, -14.4, 0.28, 0, UF - 0.3); }
    deco(-8.15, UF - 0.6, -14.2, 8.15, UF - 0.3, -14, 'plateOlive');
    // the Sword Room: pedestal, floating energy sword, display racks, the emblem on the back wall
    K.put('plateOlive', L.geo('cylLo'), 0, UF + 0.45, -24, 0.75, 0.9, 0.75); K.put('paintDark', L.geo('cylLo'), 0, UF + 0.04, -24, 1.0, 0.08, 1.0);
    K.put('lampBlue', L.geo('cylLo'), 0, UF + 0.91, -24, 0.58, 0.02, 0.58); K.put('lampBlue', K.discGeo(1.1, 1.25, 0.5), 0, UF + 0.02, -24, 1, 1, 1);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; deco(Math.cos(a) * 0.76 - 0.03, UF + 0.1, -24 + Math.sin(a) * 0.76 - 0.03, Math.cos(a) * 0.76 + 0.03, UF + 0.85, -24 + Math.sin(a) * 0.76 + 0.03, 'lampBlue'); }
    W.addCyl(0, -24, 0.75, UF, UF + 0.92, { surf: 'metal' });
    sword(0, UF + 1.45, -24);
    L.lamp(0, UF + 1.6, -24, { color: 0x7ac8ff, intensity: 1.8, distance: 9, pool: false });
    K.plane(A.unsc, 4.2, 4.2, 0, UF + 2.2, PZ0 + 0.15, 0, { alpha: true });
    for (const s of [-1, 1]) {
      gunRack('z', -25.4, -22.9, s * 7.85, -s, UF);
      L.box(s * 7.85, UF, -29.7, s * 6.3, UF + 1.0, -28.7, 'plateOlive', { top: 'paintDark' }); rocketCrate(s * 7.0, UF + 1.0, -29.2, true);
      deco(s * 7.8, UF + 3.2, -29.8, s * 7.84, UF + 3.26, -17.2, 'lampBlue');
      tube(s * 4, SR, -23.5, false, 2);
    }
    for (const [x, z] of [[-6.8, -18.3], [6.8, -18.3]]) { P('crateSmall', x, z, 0.3, UF); }
    L.addPickup('armor', 0, UF, -20.4);
    // the ordnance store below: rocket crates, shelving, a pallet truck, lights
    deco(-7.85, 0.006, -29.85, 7.85, 0.012, -17.15, 'concreteDark');
    shelf(-7.8, -29.8, -3.2, -29, 0, 3, rnd); shelf(3.2, -29.8, 7.8, -29, 0, 3, rnd);
    for (let i = 0; i < 3; i++) { rocketCrate(-5.5, i * 0.43, -26.6, true); rocketCrate(-5.5, i * 0.43, -25.9, true); } solid(-6.4, 0, -27, -4.6, 1.3, -25.5, 'metal');
    for (let i = 0; i < 2; i++) { rocketCrate(5.5, i * 0.43, -26.6, true); rocketCrate(5.5, i * 0.43, -25.9, true); } solid(4.6, 0, -27, 6.4, 0.9, -25.5, 'metal');
    pallets(0, -28.9, 2); for (let i = 0; i < 3; i++) ammoBox(-0.4 + i * 0.4, 0.3, -28.9, false);
    L.box(-1.2, 0, -24.4, 1.2, 0.9, -23.2, 'steel', { top: 'woodDark' }); deco(-0.9, 0.9, -24.2, 0.3, 0.96, -23.4, 'paintDark');
    L.pipe('paintYellow', 2.6, 0.2, -21, 2.6, 1.1, -21.8, 0.03); deco(2.2, 0.08, -21, 3.0, 0.2, -19.2, 'paintYellow'); solid(2.2, 0, -21.8, 3, 1.1, -19.2, 'metal');
    P('crate', -7.1, -19.2, 0.2); P('crateSmall', 6.8, -19.8, -0.2); P('generator', -7.2, -28.2, Math.PI / 2);
    K.plane(A.stencil('ORDNANCE', '#f2eee0'), 3.6, 1.1, 0, 3.1, -16.83, 0, { alpha: true });
    K.plane(A.live, 1.6, 0.4, -7.83, 1.8, -24, Math.PI / 2);
    tube(-3, UF - 0.3, -23.5, true, 1.6); tube(3, UF - 0.3, -23.5, true, 1.6); tube(0, UF - 0.3, -19, true, 1.6);
    L.addPickup('ammo', 0, 0, -21.2);
  }
  /** The energy sword: two curved plasma blades on a hilt, turning slowly over the pedestal. */
  function sword(x, y, z) {
    const g = new THREE.Group(), sh = new THREE.Shape();
    sh.moveTo(0.03, 0); sh.quadraticCurveTo(0.22, 0.32, 0.05, 1.0); sh.quadraticCurveTo(0.11, 0.36, 0.0, 0.07); sh.lineTo(0.03, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: 12 });
    geo.translate(0, 0, -0.01);
    const plasma = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.3, 4.4), transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    for (const sd of [-1, 1]) { const b = new THREE.Mesh(geo, plasma); b.scale.x = sd; b.position.x = sd * 0.06; g.add(b); }
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.8, roughness: 0.35 });
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.36, 10), metal); hilt.position.y = -0.18; g.add(hilt);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.09), metal); g.add(guard);
    g.position.set(x, y, z); L.scene.add(g);
    L.animated.push((dt, t) => { g.rotation.y = t * 0.9; g.position.y = y + Math.sin(t * 1.7) * 0.05; });
  }

  // ------------------------------------------------------------ the Pit: a sunken live-fire range
  function pit(rnd) {
    const A = art();
    L.box(-14, -2.6, -11, 14, PD, 5, 'concrete', { top: 'concreteDark' });
    // ramps, stairs and the drop-in rails
    ramp('x', -14, -6, -11, -8, PD, 0, -1, 'concrete', 'bunker'); slopeGuard('x', -14, -6, -7.95, PD, 0, -1);
    ramp('x', 6, 14, 2, 5, PD, 0, 1, 'concrete', 'bunker'); slopeGuard('x', 6, 14, 1.95, PD, 0, 1);
    steps('z', -11, -8, -2, 2, PD, 0, -1, 'bunker', 'concreteDark'); steps('z', 2, 5, -2, 2, PD, 0, 1, 'bunker', 'concreteDark');
    rail('x', 3, 13.8, -11, 0); rail('x', -13.8, -3, 5, 0); rail('z', -6, 4, -14, 0); rail('z', -10, 1, 14, 0);
    // coping, hazard band just under the lip, pilasters and drains on the walls
    deco(-14.3, 0, -11.3, 14.3, 0.1, -11, 'bunkerDark'); deco(-14.3, 0, 5, 14.3, 0.1, 5.3, 'bunkerDark'); deco(-14.3, 0, -11, -14, 0.1, 5, 'bunkerDark'); deco(14, 0, -11, 14.3, 0.1, 5, 'bunkerDark');
    deco(2, -0.35, -11, 14, -0.15, -10.97, 'hazard'); deco(-14, -0.35, 4.97, -2, -0.15, 5, 'hazard'); deco(-14, -0.35, -8, -13.97, -0.15, 5, 'hazard'); deco(13.97, -0.35, -11, 14, -0.15, 2, 'hazard');
    for (let x = -10; x <= 10; x += 5) { if (x > -3 && x < 3) continue; deco(x - 0.3, PD, -11, x + 0.3, 0, -10.88, 'bunkerDark'); deco(x - 0.3, PD, 4.88, x + 0.3, 0, 5, 'bunkerDark'); }
    for (const [x, z, nz] of [[-11.5, 4.9, -1], [11.5, -10.9, 1]]) { L.cyl('rust', x, -1.2, z + nz * 0.05, 0.22, 0.3, Math.PI / 2, 0, true); L.blob(x, z + nz * 0.8, 1.4, 1.2, PD); }
    for (const [x, z] of [[-9, -5], [9, -1], [0, 1.2], [-1, -7.2]]) deco(x - 0.35, PD, z - 0.35, x + 0.35, PD + 0.006, z + 0.35, 'grate');
    K.plane(A.live, 4, 1, 8, -1.1, -10.96, 0); K.plane(A.live, 4, 1, -8, -1.1, 4.96, Math.PI);
    K.plane(A.stencil('PIT 03', 'rgba(34,34,30,0.75)'), 4, 1.25, -13.97, -1.0, -1.5, Math.PI / 2, { alpha: true }); K.plane(A.stencil('PIT 03', 'rgba(34,34,30,0.75)'), 4, 1.25, 13.97, -1.0, -4.5, -Math.PI / 2, { alpha: true });
    // floor paint: firing lines, lane numbers, the container's box
    for (const z of [-7, 1.5]) deco(-13.8, PD + 0.004, z - 0.06, 13.8, PD + 0.008, z + 0.06, 'lineWhite');
    for (let x = -12; x <= 12; x += 6) deco(x - 0.04, PD + 0.004, -7, x + 0.04, PD + 0.008, 1.5, 'line');
    deco(-3.4, PD + 0.004, -4.6, 3.4, PD + 0.008, -4.45, 'line'); deco(-3.4, PD + 0.004, -1.55, 3.4, PD + 0.008, -1.4, 'line');
    // the green box in the middle, low walls, sandbags
    container(0, -3, true, 'green', 1, PD);
    const lw = (x0, z0, x1, z1) => { L.box(x0, PD, z0, x1, PD + 1.1, z1, 'bunker', { top: 'concreteDark' }); const ax = x1 - x0 > z1 - z0; if (ax) deco(x0, PD + 0.9, z0 - 0.01, x1, PD + 1.0, z1 + 0.01, 'hazard'); else deco(x0 - 0.01, PD + 0.9, z0, x1 + 0.01, PD + 1.0, z1, 'hazard'); L.blob((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.8, z1 - z0 + 0.8, PD); };
    lw(-10.2, -5, -9.8, -1); lw(9.8, -6, 10.2, -2); lw(-8, 1.3, -4.5, 1.7); lw(4.5, -7.7, 8, -7.3);
    bags(-7.5, -6.5, -4.5, -6.5, 3, PD); bags(-7.5, -6.5, -7.5, -5, 2, PD); bags(4.5, 0, 7.5, 0, 3, PD); bags(7.5, 0, 7.5, -1.5, 2, PD);
    // targets along the far walls
    for (const x of [3.5, 6, 8.5, 11]) target(x, -10.4, 0, PD);
    for (const x of [-3.5, -6, -8.5, -11]) target(x, 4.4, Math.PI, PD);
    // tire runs and climbing walls
    const tires = (x0, z0, nx, nz) => { for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = x0 + i * 0.85, z = z0 + j * 0.85 + (i % 2) * 0.2; L.cyl('rubber', x, PD + 0.11, z, 0.36, 0.22, 0, 0, true); L.cyl('paintDark', x, PD + 0.115, z, 0.2, 0.225, 0, 0, true); solid(x - 0.36, PD, z - 0.36, x + 0.36, PD + 0.22, z + 0.36); } };
    tires(10.7, -5.8, 4, 5); tires(-13.4, -0.9, 3, 5);
    const climb = (x0, x1, z) => {
      L.box(x0, PD, z - 0.1, x1, PD + 2.0, z + 0.1, 'plywood', { top: 'woodDark' });
      for (const x of [x0, x1]) L.box(x - 0.08, PD, z - 0.14, x + 0.08, PD + 2.1, z + 0.14, 'woodDark', { ao: false });
      for (const sd of [-1, 1]) L.box(x0 + 0.3, PD, z + sd * 0.1, x1 - 0.3, PD + 0.8, z + sd * 0.7, 'plywood', { top: 'woodDark' });
      for (let k = 0; k < 3; k++) L.pipe('bark', x0 + 0.5 + k * 0.5, PD + 2.0, z - 0.12, x0 + 0.5 + k * 0.5, PD + 0.9, z - 0.8, 0.02);
    };
    climb(-5, -3, -9.1); climb(2.6, 5, 3.4);
    // loose kit: drums, crates, a rack of practice rounds
    P('crate', 12.9, -9.6, 0.1, PD); P('crate', -12.9, 3.9, -0.2, PD);
    P('drum', -13, -7, 0, PD); P('drum', -12.3, -7.4, 0.6, PD); P('drum', 12.8, 1.2, 0, PD);
    for (let i = 0; i < 3; i++) ammoBox(4.1, PD, -4 + i * 0.95, false, true);
    // the range board, floodlights on the corners, loudspeakers
    for (const x of [8, 11]) { L.pipe('steel', x, 0, -12.4, x, 3.4, -12.4, 0.06); W.addCyl(x, -12.4, 0.07, 0, 3.4, { surf: 'metal' }); }
    deco(7.7, 2.0, -12.55, 11.3, 3.6, -12.35, 'paintDark'); glowPlane(A.range, 3.4, 1.5, 9.5, 2.8, -12.34, 0, 0, 0x88aa88);
    for (const [x, z, ry] of [[-15.4, -12.4, -Math.PI / 4], [15.4, -12.4, Math.PI / 4], [-15.4, 6.4, Math.PI / 4], [15.4, 6.4, -Math.PI / 4]]) flood(x, z, 6.5, ry);
    for (const [x, z] of [[-15.2, -2], [15.2, -2]]) { L.pipe('steel', x, 0, z, x, 4.6, z, 0.05); W.addCyl(x, z, 0.06, 0, 4.6, { surf: 'metal' }); K.put('greyClean', K.geo('cone'), x - Math.sign(x) * 0.3, 4.4, z, 0.2, 0.45, 0.2, 0, 0, Math.sign(x) * Math.PI / 2); }
    L.addPickup('armor', 0, PD, 0.3); L.addPickup('ammo', -12, PD, -5);
  }

  // ------------------------------------------------------------ the Long Hall (south) and the briefing room
  function longHall(rnd) {
    const A = art();
    const OUT = [[0, 0.7, 'bunkerDark'], [0.7, 3.6, 'bunker'], [3.6, HR, 'plateOlive']], IN = [[0, 1.2, 'plateOlive'], [1.2, HR, 'bunker']];
    const H = HR - 0.3, slits = (xs) => xs.map((x) => [x, x + 1.4, 1.5, 1.95]);
    wall('x', -30, -6.15, 19, 0, H, [[-19, -16.6, 0, 2.4]].concat(slits([-28, -24, -14, -10])), -1, OUT, IN);
    wall('x', 6.15, 30, 19, 0, H, [[16.6, 19, 0, 2.4]].concat(slits([8.6, 12.6, 22.6, 26.6])), -1, OUT, IN);
    wall('x', -6, 6, 13, 0, H, [[-1.6, 1.6, 0, 2.6], [-5, -3, 1.2, 2.2], [3, 5, 1.2, 2.2]], -1, OUT, IN);
    wall('z', 13, 19, -6, 0, H, [[15, 16.8, 0, 2.4]], -1, OUT, IN); wall('z', 13, 19, 6, 0, H, [[15, 16.8, 0, 2.4]], 1, OUT, IN);
    wall('z', 19, PZ1, -30, 0, H, [[19.4, 21.6, 0, 2.8]], -1, OUT, IN); wall('z', 19, PZ1, 30, 0, H, [[19.4, 21.6, 0, 2.8]], 1, OUT, IN);
    for (const [a, b] of [[-5, -3], [3, 5]]) for (let x = a + 0.2; x < b; x += 0.3) deco(x - 0.015, 1.2, 12.97, x + 0.015, 2.2, 13.03, 'steel');
    // floors, the roof slab with the stairwell, the parapet with its crenels
    deco(-29.85, 0, 19.15, 29.85, 0.006, PZ1, 'concreteDark'); deco(-5.85, 0, 13.15, 5.85, 0.006, 19.15, 'concreteDark');
    for (const z of [19.5, PZ1 - 0.35]) deco(-29.85, 0.006, z - 0.05, 29.85, 0.01, z + 0.05, 'paintYellow');
    const sl = (a, b, c, d) => L.box(a, H, b, c, HR, d, 'ceiling', { top: 'concrete', side: 'bunkerDark' });
    sl(-30.15, 18.85, -1.6, PZ1); sl(-1.6, 18.85, 4.6, 22.9); sl(4.6, 18.85, 30.15, PZ1); sl(-6.15, 12.85, 6.15, 18.85);
    const par = (x0, z0, x1, z1) => L.box(x0, HR, z0, x1, HR + 1.0, z1, 'bunker', { top: 'concreteDark' });
    for (const s of [-1, 1]) {
      for (const [a, b] of [[6.15, 9.3], [10.7, 15.3], [16.7, 21.3], [22.7, 27.3], [28.7, 30.15]]) par(Math.min(s * a, s * b), 18.85, Math.max(s * a, s * b), 19.15);
      par(s > 0 ? 5.85 : -6.15, 12.85, s > 0 ? 6.15 : -5.85, 18.85); par(s > 0 ? 29.85 : -30.15, 19.15, s > 0 ? 30.15 : -29.85, 21.8);
    }
    for (const [a, b] of [[-6.15, -1.2], [1.2, 6.15]]) par(a, 12.85, b, 13.15);
    // stair up through the roof, inside against the south wall
    steps('x', -4.5, 4.5, 23, PZ1 - 0.15, 0, HR, 1, 'plateOlive', 'grate'); slopeGuard('x', -4.5, 4.5, 22.95, 0, HR, 1);
    rail('x', -1.6, 4.6, 22.9, HR); rail('z', 22.9, PZ1 - 0.15, -1.6, HR);
    // exterior stairs from each yard up to the roof
    for (const s of [-1, 1]) {
      steps('x', Math.min(s * 30.15, s * 42), Math.max(s * 30.15, s * 42), 21.9, PZ1 - 0.02, 0, HR, -s, 'plateOlive', 'grate');
      slopeGuard('x', Math.min(s * 30.15, s * 42), Math.max(s * 30.15, s * 42), 21.85, 0, HR, -s);
    }
    // the roof: vents, AC units, a mast, cable trays
    for (const x of [-24, -12, 12, 24]) P('vent', x, 23.6, 0, HR);
    P('ac', -18, 23.6, 0, HR); P('ac', 18, 23.6, 0, HR); P('ac', 0, 15, 0, HR);
    L.cyl('steel', 8.5, HR + 3, 24.2, 0.06, 6, 0, 0, true); for (const d of [-1, 1]) L.pipe('steel', 8.5, HR + 5.5, 24.2, 8.5 + d * 1.2, HR, 24.2 - 0.1, 0.008);
    for (const x of [-26, 26]) deco(x - 3, HR, PZ1 - 0.5, x + 3, HR + 0.12, PZ1 - 0.2, 'steel');
    // inside: fluorescent tubes, pipes and cable trays along the ceiling, lockers, benches, posters
    for (let x = -27; x <= 27; x += 6) tube(x, H, 21, true, 1.6);
    tube(-3, H, 15.5, true, 1.6); tube(3, H, 15.5, true, 1.6);
    for (const [y, r, m] of [[3.55, 0.09, 'plateOlive'], [3.3, 0.06, 'paintRed'], [3.72, 0.05, 'steel']]) for (const [a, b] of [[-29.85, -2.4], [4.7, 29.85]]) L.pipe(m, a, y, PZ1 - 0.3, b, y, PZ1 - 0.3, r);
    deco(-29.85, 3.8, 19.4, 29.85, 3.84, 19.8, 'steel'); for (let x = -29; x < 29.9; x += 1.2) deco(x, 3.72, 19.4, x + 0.04, 3.84, 19.8, 'steel');
    lockers('x', -27.5, 10, PZ1, -1, 0); lockers('x', 20.2, 10, PZ1, -1, 0);
    bench(-27, 22.6, -22.5, 23, 0); bench(20.7, 22.6, 25.2, 23, 0);
    P('vending', 9, PZ1 - 0.45, 0); P('vending', 10.1, PZ1 - 0.45, 0);
    for (const [x, k] of [[-15, A.poster1], [-10, A.poster2], [13.5, A.poster3]]) K.plane(k, 0.8, 1.2, x, 1.8, PZ1 - 0.02, Math.PI);
    for (const x of [-20, 17]) extinguisher(x, 1.0, PZ1, 0, -1);
    for (const x of [-29, -6.5, 6.5, 29]) bulkhead(x, 3.2, 19.15, 0, 1, 'lampGreen');
    K.plane(A.stencil('HALL B', 'rgba(34,34,30,0.8)'), 3, 0.94, -12, 2.9, 19.17, 0, { alpha: true }); K.plane(A.stencil('HALL B', 'rgba(34,34,30,0.8)'), 3, 0.94, 12, 2.9, 19.17, 0, { alpha: true });
    K.plane(A.sign('← BLUE BASE', 'Sector W · Alpha', '#1e231a', '#6aa8ff'), 1.6, 0.4, -22, 3.0, 19.18, 0); K.plane(A.sign('RED BASE →', 'Sector E · Bravo', '#1e231a', '#ff6a5a'), 1.6, 0.4, 22, 3.0, 19.18, 0);
    P('crate', -8.3, 20, 0.2); P('crateSmall', -8.2, 20, -0.1, 1.2); P('crate', 27.8, 23.9, -0.1); spool(-28.4, 23.5, 0.6);
    // briefing room: holo table, chairs, the screen over the door, a map board
    L.box(-1.5, 0, 15, 1.5, 0.92, 16.6, 'plateOlive', { top: 'paintDark' }); deco(-1.4, 0.92, 15.1, 1.4, 0.94, 16.5, 'lampBlue');
    glowPlane(art().holo, 2.6, 1.5, 0, 1.25, 15.8, -Math.PI / 2 + 0.2, 0, 0x88ccff);
    for (const [x, z] of [[-2.2, 15.3], [-2.2, 16.3], [2.2, 15.3], [2.2, 16.3], [0, 17.2]]) K.chair(x, z, 0);
    deco(-1.6, 2.75, 13.15, 1.6, 3.85, 13.2, 'paintDark'); glowPlane(A.screen, 3, 1.02, 0, 3.3, 13.22, 0, 0, 0xcfe8ff);
    K.plane(A.unsc, 1.4, 1.4, -5.83, 2.7, 17.9, Math.PI / 2, { alpha: true }); K.plane(A.unsc, 1.4, 1.4, 5.83, 2.7, 17.9, -Math.PI / 2, { alpha: true });
    L.addPickup('ammo', -20, 0, 21.3); L.addPickup('ammo', 20, 0, 21.3); L.addPickup('ammo', 3.8, 0, 14.4);
  }

  // ------------------------------------------------------------ the yard: cover between the bases, the base yards, the back alleys
  /** The M12 "Warthog": an armoured jeep with a triple-barrel gun on the back, along X, nose toward f (±1). */
  function warthog(x, z, f) {
    const ry = f > 0 ? 0 : Math.PI, Q = (d) => x + f * d;
    K.put('plateOlive', K.extrude('hogBody', [[-2.5, 0.62], [2.1, 0.62], [2.6, 0.78], [2.72, 1.06], [1.55, 1.2], [0.7, 1.26], [0.5, 1.04], [-0.95, 1.04], [-1.05, 1.22], [-2.5, 1.22]], 1.86, 0.06), x, 0, z, 1, 1, 1, ry);
    K.put('paintDark', K.extrude('hogBelly', [[-2.3, 0.35], [2.2, 0.35], [2.4, 0.62], [-2.5, 0.62]], 1.2, 0.02), x, 0, z, 1, 1, 1, ry);
    for (const d of [-1.72, 1.72]) for (const sd of [-1, 1]) {
      deco(Math.min(Q(d - 0.72), Q(d + 0.72)), 1.1, z + sd * 0.93, Math.max(Q(d - 0.72), Q(d + 0.72)), 1.2, z + sd * 1.3, 'plateOlive');
      L.cyl('rubber', Q(d), 0.56, z + sd * 1.08, 0.56, 0.42, Math.PI / 2, 0, false); L.cyl('paintDark', Q(d), 0.56, z + sd * 1.3, 0.3, 0.02, Math.PI / 2, 0, true);
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; L.pipe('rubber', Q(d) + Math.cos(a) * 0.5, 0.56 + Math.sin(a) * 0.5, z + sd * 0.88, Q(d) + Math.cos(a) * 0.5, 0.56 + Math.sin(a) * 0.5, z + sd * 1.28, 0.07); }
    }
    for (const sd of [-1, 1]) { deco(Math.min(Q(-0.45), Q(0.15)), 1.04, z + sd * 0.2, Math.max(Q(-0.45), Q(0.15)), 1.14, z + sd * 0.72, 'leather'); deco(Math.min(Q(-0.62), Q(-0.45)), 1.04, z + sd * 0.2, Math.max(Q(-0.62), Q(-0.45)), 1.7, z + sd * 0.72, 'leather'); }
    L.pipe('paintDark', Q(0.45), 1.3, z - 0.45, Q(0.25), 1.5, z - 0.45, 0.02); K.put('rubber', L.geo('torus'), Q(0.22), 1.52, z - 0.45, 0.16, 0.16, 0.16, Math.PI / 2, 0, 0.5);
    for (const sd of [-1, 1]) { L.pipe('steel', Q(0.55), 1.2, z + sd * 0.86, Q(0.5), 1.72, z + sd * 0.86, 0.025); L.pipe('steel', Q(-1.0), 1.22, z + sd * 0.86, Q(-1.0), 2.0, z + sd * 0.86, 0.04); L.pipe('steel', Q(-1.0), 2.0, z + sd * 0.86, Q(0.5), 1.72, z + sd * 0.86, 0.03); }
    L.pipe('steel', Q(0.5), 1.72, z - 0.86, Q(0.5), 1.72, z + 0.86, 0.025); L.pipe('steel', Q(-1.0), 2.0, z - 0.86, Q(-1.0), 2.0, z + 0.86, 0.04);
    deco(Math.min(Q(2.55), Q(2.85)), 0.5, z - 0.95, Math.max(Q(2.55), Q(2.85)), 0.82, z + 0.95, 'paintDark');
    for (const sd of [-1, 1]) { K.sph('lampWarm', Q(2.7), 1.0, z + sd * 0.66, 0.07); L.pipe('paintDark', Q(2.6), 0.62, z + sd * 0.4, Q(2.95), 0.95, z + sd * 0.4, 0.03); }
    // the gun: ring mount, column, receiver, three barrels, shield
    L.cyl('paintDark', Q(-1.8), 1.28, z, 0.38, 0.12, 0, 0, false); L.cyl('steel', Q(-1.8), 1.6, z, 0.08, 0.6, 0, 0, true);
    K.put('plateOlive', L.geo('box'), Q(-1.75), 1.98, z, 0.8, 0.3, 0.36, ry);
    for (const [dy, dz] of [[0.06, -0.06], [0.06, 0.06], [-0.05, 0]]) L.pipe('paintDark', Q(-1.35), 1.98 + dy, z + dz, Q(-0.3), 1.98 + dy, z + dz, 0.03);
    L.cyl('paintDark', Q(-0.4), 1.99, z, 0.11, 0.2, 0, Math.PI / 2, true);
    for (const sd of [-1, 1]) K.put('plateOlive', L.geo('box'), Q(-1.3), 2.1, z + sd * 0.34, 0.05, 0.5, 0.36, ry);
    deco(Math.min(Q(-2.2), Q(-2.0)), 1.5, z - 0.12, Math.max(Q(-2.2), Q(-2.0)), 1.9, z + 0.12, 'paintDark');
    solid(Math.min(Q(-2.55), Q(2.9)), 0, z - 1.35, Math.max(Q(-2.55), Q(2.9)), 1.25, z + 1.35, 'metal');
    solid(Math.min(Q(-2.25), Q(-0.3)), 1.25, z - 0.45, Math.max(Q(-2.25), Q(-0.3)), 2.3, z + 0.45, 'metal');
    L.blob(x, z, 6.2, 3.2);
  }
  function fuelTank(x0, x1, z, r) {
    const cx = (x0 + x1) / 2, y = r + 0.45;
    L.cyl('appliance', cx, y, z, r, x1 - x0, 0, Math.PI / 2, false); K.sph('appliance', x0, y, z, 0.35, r, r); K.sph('appliance', x1, y, z, 0.35, r, r);
    for (const k of [0.2, 0.8]) { const x = x0 + (x1 - x0) * k; L.box(x - 0.25, 0, z - r * 0.8, x + 0.25, y - r * 0.6, z + r * 0.8, 'plateOlive'); L.cyl('paintYellow', x, y, z, r + 0.01, 0.12, 0, Math.PI / 2, false); }
    deco(x0 + 0.5, y + r - 0.02, z - 0.35, x1 - 0.5, y + r + 0.04, z + 0.35, 'grate');
    L.pipe('steel', x1 - 0.3, 0, z + r + 0.2, x1 - 0.3, y + r + 1, z + r + 0.2, 0.025); L.pipe('steel', x1 - 0.8, 0, z + r + 0.2, x1 - 0.8, y + r + 1, z + r + 0.2, 0.025);
    for (let h = 0.3; h < y + r; h += 0.35) L.pipe('steel', x1 - 0.8, h, z + r + 0.2, x1 - 0.3, h, z + r + 0.2, 0.015);
    K.plane(art().sign('JP-8 FUEL', 'FLAMMABLE · NO SMOKING', '#9c2016', '#ffffff'), 1.6, 0.4, cx, y, z - r - 0.02, Math.PI);
    solid(x0 - 0.35, 0, z - r, x1 + 0.35, y + r, z + r, 'metal'); L.blob(cx, z, x1 - x0 + 1.5, r * 2 + 1);
  }
  function yard(s, rnd) {
    const X = (u) => s * u, tm = TEAM[s], A = art();
    // the courtyard between the base and the middle
    container(X(19.5), -6, false, s < 0 ? 'blue' : 'orange', 1);
    container(X(25), 14.5, true, 'green', 2);
    jersey(X(24), -9, X(24), -5); jersey(X(16), 9.5, X(20), 9.5); jersey(X(27.5), -18, X(27.5), -14.5);
    bags(X(29), -3.2, X(29), 3.2, 3); bags(X(29), -3.2, X(30.5), -4.2, 3); bags(X(29), 3.2, X(30.5), 4.2, 3);
    tripodGun(X(29.8), 0, 0, s > 0 ? Math.PI : 0);
    P('crate', X(27), 7.4, 0.1); P('crateSmall', X(27.05), 7.4, -0.2, 1.2); P('crateSmall', X(28.4), 7.7, 0.35);
    P('drum', X(31.5), -14); P('drum', X(32.2), -14.8, 0.3); P('barrel', X(31.4), -15.1);
    L.box(X(21), 0, -17, X(23), 1.4, -15, 'bunker', { top: 'concreteDark' }); deco(X(21), 1.2, -17.01, X(23), 1.3, -14.99, 'hazard');
    L.box(X(15.5), 0, -21, X(17), 1.4, -19.5, 'bunker', { top: 'concreteDark' });
    P('crate', X(11.5), -19.5, 0.2); P('drum', X(10.3), -20.4); P('crateSmall', X(11.6), -18.3, -0.3);
    pallets(X(9), 11, 4); P('box', X(9.1), 11, 0.2, 0.6); P('tires', X(31), 11.2);
    flood(X(31), -19.5, 8, s > 0 ? -Math.PI / 4 : Math.PI / 4); flood(X(14.8), 11.5, 7, 0);
    for (const z of [-7, 5]) { L.pipe('steel', X(33.8), 0, z, X(33.8), 3, z, 0.04); deco(Math.min(X(33.7), X(33.9)), 2.2, z - 0.35, Math.max(X(33.7), X(33.9)), 2.9, z + 0.35, tm.paint); }
    // flagpole with the team flag by the balcony
    L.cyl('steel', X(30.4), 4.5, 9.4, 0.06, 9, 0, 0, true); W.addCyl(X(30.4), 9.4, 0.08, 0, 9, { surf: 'metal' }); K.sph('chrome', X(30.4), 9.05, 9.4, 0.1);
    K.plane(A.flag(tm), 1.8, 1.12, X(30.4) + s * 0.95, 8.3, 9.4, 0, { double: true });
    // the base yard: the Warthog, the fuel tank, containers, a cargo net
    warthog(X(40), 17.5, -s);
    fuelTank(Math.min(X(44), X(50)), Math.max(X(44), X(50)), 22.6, 1.05);
    container(X(50.2), 13, false, 'white', 1);
    P('crate', X(45.2), 10.2, 0.2); P('crateSmall', X(46.4), 10.1, -0.2); P('generator', X(47), 12.2, 0);
    spool(X(35.5), 19.8, 0.7); P('tires', X(46.5), 19.5); P('drum', X(43.2), 24.3); P('drum', X(43.2), 23.5, 0.5);
    bulkhead(X(41), 3.1, 8 + T / 2 + 0.02, 0, 1); bulkhead(X(30.2) + s * 0.1, 3.1, 20.5, s, 0);
    // the back alley behind the base: AC units, generator, cable runs
    P('ac', X(49.4), -10.4, Math.PI / 2); P('ac', X(49.4), 2, Math.PI / 2); P('generator', X(50.5), -3.2, Math.PI / 2);
    for (const [y, r] of [[3.2, 0.1], [3.45, 0.06]]) L.pipe('plateOlive', X(48.3), y, -12, X(48.3), y, 8, r);
    for (let z = -11; z < 8; z += 2.5) deco(X(48.15), 3.0, z - 0.03, X(48.35), 3.6, z + 0.03, 'steel');
    P('drum', X(50.8), -20); P('drum', X(51.2), -19.2, 0.4); P('crate', X(50.8), -26.5, 0.1); P('crateSmall', X(46.2), -28.8, -0.2);
    ammoBox(X(50.6), 0, -24.8, false, true);
  }

  // ------------------------------------------------------------ beyond the walls: the escarpment, the savanna, the rest of the base
  function acacia(x, z, h, r, rnd) {
    const n = 2 + (rnd() * 2 | 0);
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, tx = x + Math.cos(a) * r * 0.45, tz = z + Math.sin(a) * r * 0.45; L.pipe('bark', x, 0, z, tx, h * (0.8 + rnd() * 0.15), tz, 0.12 + rnd() * 0.08); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + rnd(), px = x + Math.cos(a) * r * 0.35, pz = z + Math.sin(a) * r * 0.35; K.put(i % 2 ? 'joshua' : 'leaves2', K.blobGeo(i % 3), px, h + rnd() * 0.4, pz, r * (0.6 + rnd() * 0.25), r * 0.16, r * (0.6 + rnd() * 0.25), rnd() * 6); }
  }
  function outside(rnd) {
    for (const b of [[-400, -400, 400, PZ0 - 2], [-400, PZ1 + 2, 400, 400], [-400, PZ0 - 2, PX0 - 2, PZ1 + 2], [PX1 + 2, PZ0 - 2, 400, PZ1 + 2]]) L.box(b[0], -1, b[1], b[2], 0, b[3], 'sand', { ao: false, noCol: true });
    // the escarpment behind the north wall, rock outcrops round the rest
    for (let i = 0; i < 26; i++) { const x = -120 + i * 9.6 + rnd() * 4, z = -48 - rnd() * 18, h = 6 + rnd() * 9; K.put(i % 2 ? 'rock' : 'mesa', K.blobGeo(i % 3), x, h * 0.2, z, 8 + rnd() * 6, h, 7 + rnd() * 4, rnd() * 6); }
    for (let i = 0; i < 14; i++) { const x = -110 + i * 17 + rnd() * 6, z = -80 - rnd() * 20, h = 12 + rnd() * 14; K.put('mesa', K.blobGeo(i % 3), x, h * 0.25, z, 12 + rnd() * 6, h, 10, rnd() * 6); }
    for (const [x, z, sx, sy] of [[-68, 8, 6, 5], [-74, 30, 8, 7], [70, 14, 7, 6], [66, 40, 5, 4], [-30, 52, 6, 3], [34, 60, 8, 5]]) K.put('rock', K.blobGeo(Math.abs(x) % 3), x, sy * 0.3, z, sx, sy, sx * 0.8, x);
    // savanna: acacias, dry brush
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = 70 + rnd() * 140, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9 + 10;
      if (z < -40) continue;
      acacia(x, z, 4 + rnd() * 3, 3 + rnd() * 2.5, rnd);
    }
    for (let i = 0; i < 90; i++) { const x = (rnd() - 0.5) * 300, z = 32 + rnd() * 120; if (Math.abs(x) < 60 && z < 40) continue; K.bush(x, z, 0.5 + rnd() * 0.6, 0, true); }
    // the rest of the facility: a comms tower, the water tower, radar dome, hangars and barracks
    K.latticeTower(72, -30, 42, 4.5, 1.2, 'steel'); K.sph('lampRed', 72, 42.4, -30, 0.35);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.pipe('steel', -70 + dx * 2.2, 0, 44 + dz * 2.2, -70 + dx * 1.2, 16, 44 + dz * 1.2, 0.18);
    L.cyl('appliance', -70, 18.5, 44, 4.2, 5, 0, 0, false); K.put('appliance', K.geo('cone'), -70, 21.8, 44, 4.4, 1.6, 4.4); deco(-72, 18, 39.75, -68, 19, 39.8, 'plateOlive');
    K.sph('appliance', 64, 0, -8, 9, 9, 9); L.cyl('bunker', 64, 1.2, -8, 9.2, 2.4, 0, 0, false);
    for (const [x, z, w] of [[-60, 70, 30], [0, 78, 40]]) { L.box(x - w / 2, 0, z - 12, x + w / 2, 11, z + 12, 'metalSiding', { noCol: true }); K.put('roofTin', K.gableRoofGeo(w + 1, 25, 4), x, 11, z, 1, 1, 1); deco(x - w / 2 + 3, 0, z - 12.05, x + w / 2 - 3, 9, z - 11.95, 'plateOlive'); }
    for (let i = 0; i < 4; i++) { const x = 40 + i * 16, z = 58; L.box(x - 6, 0, z - 3.5, x + 6, 3.5, z + 3.5, 'bunker', { noCol: true }); K.put('roofTin', K.gableRoofGeo(13, 8, 1.6), x, 3.5, z, 1, 1, 1); }
  }

  /** Stairs, guards, ramps, rails and yard clutter, shared with Rust (js/map-rust.js). */
  MPIT.kit = function () {
    K = CF.MapNuketown.kit;
    return { steps, slopeGuard, ramp, poly, rail, bags, container, jersey, spool, pallets, flood, bulkhead, extinguisher, ammoBox, glowPlane };
  };

  // ------------------------------------------------------------ build
  MPIT.build = function () {
    K = CF.MapNuketown.kit;
    const rnd = U.mulberry32(117);
    ground();
    perimeter();
    for (const s of [-1, 1]) { base(s, rnd); catwalks(s); yard(s, rnd); }
    swordRoom(rnd);
    pit(rnd);
    longHall(rnd);
    outside(rnd);
    L.killY = -12;

    // spawns: Blue in and round the west base, Red in the east. Each list's middle point is its flag stand (Capture the Flag).
    const team = (s) => [[41, 0, -2], [45.5, 0, -9], [38.5, 0, 3], [38, UF, -9], [43, UF, 4], [40, 0, 12.5], [44, 0, -18]].map((p) => [s * p[0], p[1], p[2]]);
    L.spawns.t0 = team(-1); L.spawns.t1 = team(1);
    const mid = [[-5, UF, -26], [5, UF, -21], [0, 0, -25.5], [-8, PD, -3], [8, PD, 1], [-22, 0, 22], [22, 0, 22], [4, 0, 17.5], [-12, HR, 21], [12, HR, 21],
      [-41, TP, -24], [41, TP, -24], [-24, 0, -14], [24, 0, -14], [-12, 0, 10], [12, 0, 10], [-26, UF, -28.5], [26, UF, -28.5]];
    L.spawns.ffa = L.spawns.t0.concat(L.spawns.t1, mid);
    L.points.start = { x: -41, y: 0, z: -2, yaw: -Math.PI / 2 };
  };
})(window.CF);
