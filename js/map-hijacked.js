'use strict';
/* Cinderfall — HIJACKED (multiplayer), after the Black Ops II map: the M/Y Solace, a 90 m superyacht under way on a calm
   blue sea, taken by the crew of the skiff she is towing. Stern (west): the swim platform with two jet skis, stairs up
   through the transom to the pool deck, the pool, the sun loungers, the engine-room hatch and the covered cockpit bar.
   Main deck: the salon (grand piano, bar, the big sofa), the lobby with stairs down and up, the dining room, the galley,
   the gym and the owner's study, with walkways down both sides under the upper deck. Lower deck: the engine room, a
   long corridor of guest cabins, the crew mess, the laundry, the wine store and the master suite under the bow, reached
   by the forward hatch. Upper deck: the aft deck with its dining table, the sky lounge (bar, poker table, slots), the
   captain's cabin, the radio room and the bridge, with side decks and a deck over the bow. Sun deck on top: the hot
   tub, loungers, a bar and the radar arch. Bow (east): the raised helipad, the anchor windlasses and the bow rail.
   Invisible walls stand over every rail that drops into the sea. Axes: +X toward the bow, +Z starboard. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MY = CF.MapHijacked = {};
  const PI = Math.PI;
  let K = null; // Nuketown's building kit (js/map-nuketown.js)

  const T = 0.2;                                          // bulkhead thickness
  const MD = 0, LD = -3.0, UD = 3.4, SD = 6.8;            // main deck, lower deck, upper deck, sun deck (walking surfaces)
  const MW = UD - 0.3, UW = SD - 0.3;                     // tops of the main-deck and upper-deck walls (slab undersides)
  const WL = -3.6, SP = -2.2;                             // the sea, the swim platform
  const STERN = -40, HB = 22, BOW = 46, BEAM = 8;         // transom, end of the parallel body, stem head, half beam
  const BW = BEAM - 0.12;                                 // inner face of the bulwark along the parallel body
  const MX0 = -24, MX1 = 16, SX = 6.2;                    // main-deck house: aft wall, front wall, side walls (|z|)
  const UX0 = -22, UX1 = 10, UZ = 5.2;                    // upper-deck house
  const UA = -31, UF = 16.2;                              // upper-deck slab: aft edge, forward edge
  const SA = -22.2, SF = 10.4, SZ = 5.6;                  // sun-deck slab
  const LX0 = -31.2, LZ = 5.4;                            // lower deck: engine-room aft bulkhead, outer walls (|z|)
  const PAD = 0.6, PX0 = 24, PX1 = 37;                    // helipad height and extent
  const TOPG = 10;                                        // top of the invisible walls over the sea
  const SPEED = 6;                                        // m/s the sea runs past the hull

  // ------------------------------------------------------------ hull form
  /** Half beam at deck level along the length: parallel body, then a fine bow. */
  const hwPlan = (x) => x <= HB ? BEAM : x >= BOW ? 0 : BEAM * Math.pow(Math.max(0, 1 - ((x - HB) / (BOW - HB)) ** 2), 0.7);
  /** Flare: the sections narrow below the deck. */
  const sec = (y) => y >= 0 ? 1 : 1 - 0.35 * Math.pow(Math.min(1, -y / 5), 1.8);
  /** The raked stem: the bow profile sweeps aft below the deck and a touch forward above it. */
  const rake = (y) => y >= 0 ? -y * 0.3 : -y * 1.1;
  const hw = (x, y) => hwPlan(x + rake(y)) * sec(y);
  const hwIn = (x) => Math.max(0, hw(x, 0) - 0.12);
  const slope = (x, y) => (hw(x + 0.05, y) - hw(x - 0.05, y)) / 0.1;

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
  const guard = (x0, y0, z0, x1, y1, z1) => W.add(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), { shoot: false, nav: false });
  const GEO = {};
  const ringGeo = () => GEO.ring || (GEO.ring = new THREE.TorusGeometry(1, 0.22, 8, 24));
  /** A layer split around openings [a0, a1, y0, y1]. */
  function cut(axis, a0, a1, c, t, y0, y1, holes, m, o) {
    K.holeSpans(a0, a1, y0, y1, holes, (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      if (axis === 'x') L.box(p0, q0, c - t / 2, p1, q1, c + t / 2, m, o); else L.box(c - t / 2, q0, p0, c + t / 2, q1, p1, m, o);
    });
  }
  /** Frame round an opening on both faces; a threshold plate under doors, a sill under windows. */
  function frame(axis, h, c, yb, yt, m) {
    const f = T / 2 + 0.02, box = (a0, a1, y0, y1, cc, d, mm) => axis === 'x' ? deco(a0, y0, cc - d, a1, y1, cc + d, mm) : deco(cc - d, y0, a0, cc + d, y1, a1, mm);
    const ft = Math.abs(h[3] + 0.06 - yt) < 0.005 ? yt + 0.01 : h[3] + 0.06;
    for (const sd of [-1, 1]) {
      const cc = c + sd * f;
      box(h[0] - 0.06, h[0], h[2], h[3], cc, 0.02, m); box(h[1], h[1] + 0.06, h[2], h[3], cc, 0.02, m);
      if (h[3] < yt - 0.01) box(h[0] - 0.06, h[1] + 0.06, h[3], ft, cc, 0.02, m);
    }
    if (h[2] - yb < 0.3) box(h[0], h[1], h[2], h[2] + 0.012, c, T / 2 + 0.04, 'chrome');
    else box(h[0] - 0.06, h[1] + 0.06, h[2] - 0.04, h[2] + 0.01, c, T / 2 + 0.05, m);
  }
  /** Frames (and tinted glass in the windows) for the openings centred on this run. */
  function openings(axis, a0, a1, c, y0, y1, holes, trim, pane) {
    for (const h of holes) {
      if (!(h[3] > y0 && h[2] < y1 && (h[0] + h[1]) / 2 >= a0 && (h[0] + h[1]) / 2 < a1)) continue;
      frame(axis, h, c, y0, y1, trim || 'chrome');
      if (h[2] - y0 >= 0.3 && pane !== false) cut(axis, h[0], h[1], c, 0.04, h[2], h[3], [], pane || 'yTint', { shoot: false, ao: false });
    }
  }
  /** Lining bands [y0, y1, m] as a T/2 layer on side `sd` (±1) of the line c. */
  function lining(axis, a0, a1, c, y0, y1, holes, bands, sd) {
    for (const b of bands) { const q0 = Math.max(y0, b[0]), q1 = Math.min(y1, b[1]); if (q1 > q0) cut(axis, a0, a1, c + sd * T / 4, T / 2, q0, q1, holes, b[2], {}); }
  }
  /** Outside wall: a white skin over the whole run (lapping the corners on walls along X), a lining per room inside. */
  function house(axis, a0, a1, c, y0, y1, holes, out, segs, trim) {
    const e = axis === 'x' ? T / 2 : 0;
    cut(axis, a0 - e, a1 + e, c + out * T / 4, T / 2, y0, y1, holes, 'yWhite', {});
    for (const [s0, s1, bands] of segs) lining(axis, s0, s1, c, y0, y1, holes, bands, -out);
    openings(axis, a0, a1, c, y0, y1, holes, trim);
  }
  /** Partition between two rooms: bands A on the - side, B on the + side; doorways framed in `trim`. */
  function part(axis, a0, a1, c, y0, y1, holes, A, B, trim) {
    lining(axis, a0, a1, c, y0, y1, holes, A, -1); lining(axis, a0, a1, c, y0, y1, holes, B, 1);
    openings(axis, a0, a1, c, y0, y1, holes, trim || 'yWalnut', false);
  }
  /** Floor finish over a rectangle, split round holes [x0, x1, z0, z1]. */
  function floor(x0, z0, x1, z1, y, m, holes) {
    K.holeSpans(x0, x1, z0, z1, holes || [], (a0, a1, b0, b1) => { if (a1 - a0 > 0.01 && b1 - b0 > 0.01) deco(a0, y, b0, a1, y + 0.006, b1, m); });
  }
  /** Solid staircase. axis 'x' climbs along X over a0..a1 (b = the Z span), 'z' along Z. up = +1 rises toward a1, -1 toward a0. */
  function steps(axis, a0, a1, b0, b1, yBase, yTop, up, m, topM, nose) {
    if (b0 > b1) { const t = b0; b0 = b1; b1 = t; }
    const n = Math.round((yTop - yBase) / 0.25), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, yBase, b0, s1, top, b1, m, { top: topM }); else L.box(b0, yBase, s0, b1, top, s1, m, { top: topM });
      if (!nose) continue;
      const e = up > 0 ? s0 : s1;
      if (axis === 'x') deco(e - 0.02, top, b0, e + 0.02, top + 0.006, b1, nose); else deco(b0, top, e - 0.02, b1, top + 0.006, e + 0.02, nose);
    }
  }
  /** Invisible, bullet-transparent handrail colliders along a stair edge (c = the edge line), with a chrome handrail unless bare. */
  function slopeGuard(axis, a0, a1, c, yBase, yTop, up, bare) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const s0 = a0 + (a1 - a0) * i / n, s1 = a0 + (a1 - a0) * (i + 1) / n, k = up > 0 ? (i + 1) / n : 1 - i / n, y = yBase + (yTop - yBase) * k;
      if (axis === 'x') W.add(s0, yBase, c - 0.04, s1, y + 1.05, c + 0.04, { shoot: false, nav: false }); else W.add(c - 0.04, yBase, s0, c + 0.04, y + 1.05, s1, { shoot: false, nav: false });
    }
    if (bare) return;
    const lo = up > 0 ? a0 : a1, hi = up > 0 ? a1 : a0, np = Math.max(2, Math.round(Math.abs(a1 - a0) / 1.2));
    const Pt = (a, y) => axis === 'x' ? [a, y, c] : [c, y, a];
    const A = Pt(lo, yBase + 1.0), B = Pt(hi, yTop + 1.0); L.pipe('chrome', A[0], A[1], A[2], B[0], B[1], B[2], 0.03);
    for (let i = 0; i <= np; i++) { const k = i / np, a = lo + (hi - lo) * k, y = yBase + (yTop - yBase) * k, q = Pt(a, y); L.pipe('chrome', q[0], y, q[2], q[0], y + 1.0, q[2], 0.018); }
  }
  /** Chrome pipe railing on posts, bullet-transparent. */
  function rail(axis, a0, a1, c, y) {
    if (a0 > a1) { const t = a0; a0 = a1; a1 = t; }
    const n = Math.max(1, Math.round((a1 - a0) / 1.4)), Pt = (a, yy) => axis === 'x' ? [a, yy, c] : [c, yy, a];
    for (const [yy, r] of [[1.0, 0.03], [0.5, 0.018]]) { const A = Pt(a0, y + yy), B = Pt(a1, y + yy); L.pipe('chrome', A[0], A[1], A[2], B[0], B[1], B[2], r); }
    for (let i = 0; i <= n; i++) { const A = Pt(a0 + (a1 - a0) * i / n, y); L.pipe('chrome', A[0], y, A[2], A[0], y + 1.0, A[2], 0.022); }
    if (axis === 'x') W.add(a0, y, c - 0.06, a1, y + 1.05, c + 0.06, { shoot: false, nav: false }); else W.add(c - 0.06, y, a0, c + 0.06, y + 1.05, a1, { shoot: false, nav: false });
  }
  /** Glass balustrade: a chrome shoe, glass panels on chrome posts, a chrome cap. sea: an invisible wall to TOPG over it. */
  function glassRail(axis, a0, a1, c, y, sea) {
    if (a0 > a1) { const t = a0; a0 = a1; a1 = t; }
    if (a1 - a0 < 0.05) return;
    const b = (p0, p1, q0, q1, t, m) => axis === 'x' ? L.box(p0, q0, c - t, p1, q1, c + t, m, { noCol: true, ao: false }) : L.box(c - t, q0, p0, c + t, q1, p1, m, { noCol: true, ao: false });
    b(a0, a1, y, y + 0.06, 0.03, 'chrome'); b(a0, a1, y + 0.06, y + 0.98, 0.01, 'glassClear'); b(a0, a1, y + 0.98, y + 1.04, 0.035, 'chrome');
    const n = Math.max(1, Math.round((a1 - a0) / 1.5));
    for (let i = 0; i <= n; i++) { const a = Math.min(a1 - 0.025, Math.max(a0 + 0.025, a0 + (a1 - a0) * i / n)); b(a - 0.025, a + 0.025, y + 0.06, y + 0.98, 0.025, 'chrome'); }
    if (axis === 'x') W.add(a0, y, c - 0.06, a1, y + 1.05, c + 0.06, { shoot: false, nav: false }); else W.add(c - 0.06, y, a0, c + 0.06, y + 1.05, a1, { shoot: false, nav: false });
    if (sea) { if (axis === 'x') guard(a0, y + 1.05, c - 0.06, a1, TOPG, c + 0.06); else guard(c - 0.06, y + 1.05, a0, c + 0.06, TOPG, a1); }
  }
  /** Recessed downlight in a ceiling at y (no real light). */
  function dl(x, y, z) { deco(x - 0.09, y - 0.012, z - 0.09, x + 0.09, y, z + 0.09, 'chrome'); deco(x - 0.065, y - 0.016, z - 0.065, x + 0.065, y - 0.012, z + 0.065, 'lampWarm'); }
  const lamp = (x, y, z, c, i, d) => L.lamp(x, y, z, { color: c || 0xffe2bc, intensity: i || 1.2, distance: d || 9, pool: false });
  /** Upholstered sofa; back on side `back` ('x-', 'x+', 'z-', 'z+'); a few scatter cushions. */
  function sofa(x0, z0, x1, z1, y, back, m) {
    m = m || 'yLeather';
    L.box(x0, y + 0.08, z0, x1, y + 0.44, z1, m, { noCol: true, ao: false }); deco(x0 + 0.05, y, z0 + 0.05, x1 - 0.05, y + 0.08, z1 - 0.05, 'paintDark');
    const t = 0.24;
    if (back === 'z-') deco(x0, y + 0.44, z0, x1, y + 0.88, z0 + t, m); if (back === 'z+') deco(x0, y + 0.44, z1 - t, x1, y + 0.88, z1, m);
    if (back === 'x-') deco(x0, y + 0.44, z0, x0 + t, y + 0.88, z1, m); if (back === 'x+') deco(x1 - t, y + 0.44, z0, x1, y + 0.88, z1, m);
    const alongX = back[0] === 'z', len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.floor(len / 1.1));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, cm = i % 2 ? 'yNavy' : 'yGold';
      if (alongX) { const x = x0 + len * k, z = back === 'z-' ? z0 + t + 0.08 : z1 - t - 0.08; K.put(cm === 'yGold' ? 'yCanvas' : cm, L.geo('box'), x, y + 0.62, z, 0.42, 0.36, 0.12, 0, back === 'z-' ? -0.25 : 0.25); }
      else { const z = z0 + len * k, x = back === 'x-' ? x0 + t + 0.08 : x1 - t - 0.08; K.put(cm === 'yGold' ? 'yCanvas' : cm, L.geo('box'), x, y + 0.62, z, 0.12, 0.36, 0.42, 0, 0, back === 'x-' ? 0.25 : -0.25); }
    }
    solid(x0, y, z0, x1, y + 0.88, z1);
  }
  function coffeeTable(x0, z0, x1, z1, y, m) { L.box(x0, y + 0.36, z0, x1, y + 0.42, z1, m || 'yWalnut', { noCol: true, ao: false }); deco(x0 + 0.12, y, z0 + 0.12, x1 - 0.12, y + 0.36, z1 - 0.12, 'chrome'); solid(x0, y, z0, x1, y + 0.42, z1); }
  /** Potted palm: a white pot and a leafy blob. */
  function pot(x, z, y, s) { s = s || 1; L.cyl('yWhite', x, y + 0.3 * s, z, 0.28 * s, 0.6 * s, 0, 0, false); K.put('leaves2', K.blobGeo((Math.abs(x * 7) | 0) % 3), x, y + 1.0 * s, z, 0.5 * s, 0.6 * s, 0.5 * s, x); solid(x - 0.3 * s, y, z - 0.3 * s, x + 0.3 * s, y + 0.62 * s, z + 0.3 * s); }
  /** Upholstered dining chair; the sitter faces `face` ('x+', 'x-', 'z+', 'z-'). */
  function dchair(x, z, y, face, m) {
    m = m || 'yLeather';
    deco(x - 0.23, y + 0.42, z - 0.23, x + 0.23, y + 0.5, z + 0.23, m);
    const bx = face === 'x+' ? -1 : face === 'x-' ? 1 : 0, bz = face === 'z+' ? -1 : face === 'z-' ? 1 : 0;
    if (bx) deco(x + bx * 0.2 - 0.03, y + 0.5, z - 0.22, x + bx * 0.2 + 0.03, y + 1.05, z + 0.22, m); else deco(x - 0.22, y + 0.5, z + bz * 0.2 - 0.03, x + 0.22, y + 1.05, z + bz * 0.2 + 0.03, m);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) deco(x + dx - 0.02, y, z + dz - 0.02, x + dx + 0.02, y + 0.42, z + dz + 0.02, 'yWalnut');
    solid(x - 0.24, y, z - 0.24, x + 0.24, y + 1.05, z + 0.24); CF.PH.mark('chair', x, y, z);
  }
  /** Sun lounger along X, head toward +X (dir 1) or -X (dir -1), a folded towel on it. */
  function lounger(x, z, y, dir, towel) {
    deco(x - 1, y + 0.12, z - 0.36, x + 1, y + 0.3, z + 0.36, 'yTeak');
    for (const dx of [-0.85, 0.85]) for (const dz of [-0.3, 0.3]) deco(x + dx - 0.04, y, z + dz - 0.04, x + dx + 0.04, y + 0.12, z + dz + 0.04, 'chrome');
    deco(x - 0.98, y + 0.3, z - 0.33, x + 0.98, y + 0.38, z + 0.33, 'yCanvas');
    K.put('yCanvas', L.geo('box'), x + dir * 0.72, y + 0.6, z, 0.62, 0.08, 0.66, 0, 0, dir * 0.75);
    if (towel) deco(x - dir * 0.6 - 0.25, y + 0.38, z - 0.28, x - dir * 0.6 + 0.25, y + 0.44, z + 0.28, towel);
    solid(x - 1, y, z - 0.37, x + 1, y + 0.45, z + 0.37);
  }
  /** A row of bottles on a shelf along X at depth z. */
  function bottles(x0, x1, y, z, rnd) {
    const ms = ['glassDay', 'paintGreen', 'yGold', 'paintRed', 'chrome', 'glassDay', 'paintYellow'];
    for (let x = x0 + 0.06; x < x1 - 0.05; x += 0.1 + rnd() * 0.05) { const h = 0.22 + rnd() * 0.14, m = ms[(rnd() * ms.length) | 0]; L.cyl(m, x, y + h / 2, z, 0.035, h, 0, 0, true); L.cyl(m, x, y + h + 0.04, z, 0.012, 0.08, 0, 0, true); }
  }
  /** Framed picture on a wall facing ry (0 = +Z). */
  function picture(tex, x, y, z, ry, w, h) {
    const ax = Math.abs(Math.sin(ry)) > 0.5;
    if (ax) deco(x - 0.025, y - h / 2 - 0.06, z - w / 2 - 0.06, x + 0.025, y + h / 2 + 0.06, z + w / 2 + 0.06, 'yGold');
    else deco(x - w / 2 - 0.06, y - h / 2 - 0.06, z - 0.025, x + w / 2 + 0.06, y + h / 2 + 0.06, z + 0.025, 'yGold');
    K.plane(tex, w, h, x + Math.sin(ry) * 0.03, y, z + Math.cos(ry) * 0.03, ry);
  }
  /** Flat panel screen facing ry, optionally tilted back by tilt (console screens). */
  function screen(tex, w, h, x, y, z, ry, tilt) {
    const m = K.plane(tex, w, h, x, y, z, ry, { rough: 0.3 });
    m.material.emissive = new THREE.Color(1, 1, 1); m.material.emissiveMap = tex; m.material.emissiveIntensity = 0.9;
    if (tilt) { m.rotation.order = 'YXZ'; m.rotation.x = -tilt; }
    return m;
  }
  /** Horizontal strip facing up between z = zlo(x) and zhi(x) over x0..x1 at height y (world-scaled UVs). */
  function strip(m, x0, x1, y, zlo, zhi, step) {
    step = step || 0.25;
    const xs = []; for (let x = x0; x < x1 - 1e-6; x += step) xs.push(x); xs.push(x1);
    const pos = [], uv = [], nrm = [], idx = [];
    for (const x of xs) { const a = zlo(x), b = Math.max(a, zhi(x)); pos.push(x, y, a, x, y, b); uv.push(x * 0.25, -a * 0.25, x * 0.25, -b * 0.25); nrm.push(0, 1, 0, 0, 1, 0); }
    for (let i = 0; i < xs.length - 1; i++) { const A = i * 2; idx.push(A, A + 3, A + 2, A, A + 1, A + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    L.addGeo(m, g, new THREE.Matrix4());
  }
  /** One band of the hull sides, both sides, between the heights ys (ascending), offset `off` from the hull line. */
  function loft(m, ys, off, inward, x0, x1) {
    x0 = x0 == null ? STERN : x0; x1 = x1 == null ? BOW + 0.6 : x1;
    const xs = []; for (let x = x0; x < x1 - 1e-6; x += 0.5) xs.push(x); xs.push(x1);
    const nx = xs.length, ny = ys.length;
    for (const s of [-1, 1]) {
      const pos = [], uv = [], idx = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = xs[i], y = ys[j]; pos.push(x, y, s * Math.max(0, hw(x, y) + off)); uv.push(x * 0.25, y * 0.25); }
      const fwd = (s > 0) !== !!inward;
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx + 1, d = a + nx;
        if (fwd) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      L.addGeo(m, g, new THREE.Matrix4());
    }
  }
  /** Subtract gaps [a, b] from the span [lo, hi]; returns the solid pieces. */
  function spans(lo, hi, gaps) {
    let out = [[lo, hi]];
    for (const [a, b] of gaps) out = out.flatMap(([p, q]) => (b <= p || a >= q) ? [[p, q]] : [[p, a], [b, q]].filter(([u, v]) => v - u > 0.01));
    return out;
  }

  // ------------------------------------------------------------ materials and canvas art
  const TEX = {};
  function materials() {
    if (!TEX.done) {
      TEX.done = true;
      const rnd = U.mulberry32(77), rep = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
      // teak decking: 32 planks across 4 m, staggered butt joints, black caulking
      TEX.teak = rep(K.canvasTex(512, 512, (x, w, h) => {
        const rows = 32, rh = h / rows;
        for (let r = 0; r < rows; r++) {
          let u = -rnd() * 220;
          while (u < w) {
            const len = 170 + rnd() * 240, l = 0.82 + rnd() * 0.28;
            x.fillStyle = 'rgb(' + Math.round(170 * l) + ',' + Math.round(120 * l) + ',' + Math.round(74 * l) + ')'; x.fillRect(u, r * rh, len, rh);
            for (let g = 0; g < 6; g++) { x.fillStyle = 'rgba(96,60,30,' + (0.06 + rnd() * 0.12).toFixed(2) + ')'; x.fillRect(u, r * rh + rnd() * rh, len, 1); }
            x.fillStyle = 'rgba(40,26,14,0.6)'; x.fillRect(u, r * rh, 2, rh);
            u += len;
          }
          x.fillStyle = '#1c140e'; x.fillRect(0, r * rh + rh - 2, w, 2);
        }
      }));
      TEX.marble = rep(K.canvasTex(512, 512, (x, w, h) => {
        x.fillStyle = '#ece8e2'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 22; i++) {
          x.strokeStyle = 'rgba(118,116,122,' + (0.08 + rnd() * 0.25).toFixed(2) + ')'; x.lineWidth = 0.6 + rnd() * 2.2; x.beginPath();
          let px = rnd() * w, py = rnd() * h; x.moveTo(px, py);
          for (let k = 0; k < 14; k++) { px += (rnd() - 0.3) * 60; py += (rnd() - 0.5) * 50; x.lineTo(px, py); }
          x.stroke();
        }
        x.strokeStyle = 'rgba(170,160,150,0.55)'; x.lineWidth = 1.5;
        for (let i = 0; i <= 512; i += 256) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
      }));
      TEX.walnut = rep(K.canvasTex(256, 256, (x, w, h) => {
        x.fillStyle = '#5c3b24'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 110; i++) { x.fillStyle = 'rgba(' + (30 + rnd() * 50 | 0) + ',' + (18 + rnd() * 24 | 0) + ',10,' + (0.12 + rnd() * 0.22).toFixed(2) + ')'; x.fillRect(0, rnd() * h, w, 1 + rnd() * 2); }
        x.fillStyle = 'rgba(20,12,6,0.6)'; for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 2, h);
      }));
      TEX.mosaic = rep(K.canvasTex(256, 256, (x, w, h) => {
        x.fillStyle = '#e4f2f4'; x.fillRect(0, 0, w, h);
        const n = 32, s = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const l = 0.78 + rnd() * 0.32; x.fillStyle = 'rgb(' + (36 * l | 0) + ',' + (150 * l | 0) + ',' + (192 * l | 0) + ')'; x.fillRect(i * s + 0.5, j * s + 0.5, s - 1.5, s - 1.5); }
      }));
      // the sea's normal map: a few crossing swells, tiling
      const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const cx = cv.getContext('2d'), img = cx.createImageData(S, S), a = 2 * PI / S;
      const H = (u, v) => Math.sin(u * a * 3 + Math.sin(v * a * 2) * 1.5) + 0.6 * Math.sin(v * a * 5 + u * a * 2) + 0.3 * Math.sin((u + v) * a * 9) + 0.35 * Math.sin((u * 2 - v * 3) * a * 4) + 0.12 * Math.sin((u * 7 + v * 5) * a * 3);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const nx = -(H(i + 1, j) - H(i - 1, j)) * 3.5, ny = -(H(i, j + 1) - H(i, j - 1)) * 3.5, l = Math.hypot(nx, ny, 1), o = (j * S + i) * 4;
        img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
      }
      cx.putImageData(img, 0, 0); TEX.waves = rep(new THREE.CanvasTexture(cv));
      TEX.foam = rep(K.canvasTex(256, 256, (x, w, h) => {
        x.clearRect(0, 0, w, h);
        for (let i = 0; i < 520; i++) { const px = rnd() * w, py = rnd() * h, r = 1 + rnd() * 5; x.fillStyle = 'rgba(255,255,255,' + (0.35 + rnd() * 0.6).toFixed(2) + ')'; x.beginPath(); x.ellipse(px, py, r * (2 + rnd() * 4), r, 0, 0, 2 * PI); x.fill(); }
      }));
      // alpha ramps: strong at the hull fading outward (v = 0 .. 1), and strong in the middle of the wake
      const ramp = (f) => { const t = K.canvasTex(4, 64, (x, w, h) => { for (let j = 0; j < h; j++) { const v = 1 - (j + 0.5) / h, k = Math.round(f(v) * 255); x.fillStyle = 'rgb(' + k + ',' + k + ',' + k + ')'; x.fillRect(0, j, w, 1); } }); t.encoding = THREE.LinearEncoding; t.wrapS = THREE.RepeatWrapping; return t; };
      TEX.fadeOut = ramp((v) => Math.pow(1 - v, 1.6));
      TEX.fadeMid = ramp((v) => Math.pow(Math.sin(v * PI), 1.4));
    }
    const M = L.mats, CT = CF.Tex.list;
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.8, roughness: 0.6, metalness: 0 }, o));
    const tri = (t, c, o) => std(Object.assign({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, color: c }, o || {}));
    M.yTeak = std({ map: TEX.teak, roughness: 0.78, envMapIntensity: 0.4 });
    M.yWhite = std({ color: 0xf3f2ee, roughness: 0.26, metalness: 0.05, envMapIntensity: 1.0 });
    M.yNavy = std({ color: 0x172a48, roughness: 0.25, metalness: 0.25, envMapIntensity: 1.1 });
    M.yRed = std({ color: 0x6e2a22, roughness: 0.7 });
    M.yGold = std({ color: 0xc9a25a, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.2 });
    M.yTint = new THREE.MeshStandardMaterial({ color: 0x1b2833, roughness: 0.04, metalness: 0.7, transparent: true, opacity: 0.6, depthWrite: false, envMapIntensity: 1.6 });
    M.yMarble = std({ map: TEX.marble, roughness: 0.14, envMapIntensity: 1.0 });
    M.yWalnut = std({ map: TEX.walnut, roughness: 0.35, envMapIntensity: 0.9 });
    M.yLeather = std({ color: 0xe6dccb, roughness: 0.55 });
    M.yCarpet = tri(CT.carpet, 0xcfc4ae);
    M.yPanel = std({ color: 0xe9e2d4, roughness: 0.85 });
    M.yTile = std({ map: TEX.mosaic, roughness: 0.25, envMapIntensity: 1.0 });
    M.yPoolWater = new THREE.MeshStandardMaterial({ color: 0x34c4dc, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, envMapIntensity: 1.2 });
    M.ySea = new THREE.MeshStandardMaterial({ color: 0x0c3350, roughness: 0.3, metalness: 0.22, normalMap: TEX.waves, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.1 });
    M.yPad = tri(CT.concrete, 0x50565e);
    M.yFelt = tri(CT.carpet, 0x2a6a3e);
    M.yBlack = std({ color: 0x0b0b0d, roughness: 0.12, metalness: 0.2, envMapIntensity: 1.4 });
    M.yCanvas = tri(CT.carpet, 0xf0ece2);
    M.yRope = tri(CT.carpet, 0xd8ccae);
    M.yTowel = tri(CT.carpet, 0x2f78b0);
    M.yTowel2 = tri(CT.carpet, 0xe8d24a);
    M.yPort = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.85, 1.1) });
    M.yScreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.55, 0.9) });
  }
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const ct = (w, h, draw) => K.canvasTex(w, h, draw);
    const serif = (px, bold) => (bold ? 'bold ' : '') + px + 'px Georgia, "Times New Roman", serif';
    const sans = (px, bold) => (bold ? 'bold ' : '') + px + 'px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ART.name = ct(1024, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#c9a25a'; x.textAlign = 'center'; x.font = serif(150, true); x.fillText('SOLACE', w / 2, 150); x.font = serif(46); x.fillText('G E O R G E   T O W N', w / 2, 225); });
    ART.bowName = ct(1024, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#b89250'; x.textAlign = 'center'; x.font = serif(180, true); x.fillText('SOLACE', w / 2, 190); });
    const plate = (a, b, bg, fg) => ct(512, 160, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.textAlign = 'center'; x.font = sans(58, true); x.fillText(a, w / 2, 76); if (b) { x.font = sans(28); x.fillText(b, w / 2, 124); } });
    ART.crew = plate('CREW ONLY', 'BEYOND THIS POINT', '#1b2a44', '#e8dcc0');
    ART.engine = plate('ENGINE ROOM', 'HEARING PROTECTION REQUIRED', '#f2c230', '#161616');
    ART.bridge = plate('BRIDGE', 'M/Y SOLACE', '#1b2a44', '#c9a25a');
    ART.master = plate('OWNER\'S SUITE', 'PRIVATE', '#1b2a44', '#c9a25a');
    ART.muster = ct(256, 256, (x, w, h) => { x.fillStyle = '#1a8a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = sans(34, true); x.fillText('MUSTER', w / 2, 70); x.fillText('STATION', w / 2, 110); x.font = sans(120, true); x.fillText('A', w / 2, 232); });
    ART.radar = ct(256, 256, (x, w, h) => {
      x.fillStyle = '#020806'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1f7a3a'; x.lineWidth = 2;
      for (const r of [40, 80, 118]) { x.beginPath(); x.arc(w / 2, h / 2, r, 0, 2 * PI); x.stroke(); }
      x.beginPath(); x.moveTo(w / 2, 8); x.lineTo(w / 2, h - 8); x.moveTo(8, h / 2); x.lineTo(w - 8, h / 2); x.stroke();
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 118); g.addColorStop(0, 'rgba(80,255,120,0.5)'); g.addColorStop(1, 'rgba(80,255,120,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(w / 2, h / 2); x.arc(w / 2, h / 2, 118, -0.9, -0.2); x.fill();
      x.fillStyle = '#7dff9a'; for (const [px, py] of [[170, 70], [60, 160], [190, 180], [92, 58]]) x.fillRect(px, py, 5, 3);
      x.font = sans(14, true); x.fillText('12 NM  HDG 084°', 10, 20);
    });
    ART.chart = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#bcd9ee'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8d8a4';
      x.beginPath(); x.moveTo(330, 0); x.quadraticCurveTo(300, 60, 360, 110); x.quadraticCurveTo(440, 150, 420, 256); x.lineTo(512, 256); x.lineTo(512, 0); x.fill();
      x.strokeStyle = '#8fb6d4'; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(320 - i * 16, 0); x.quadraticCurveTo(290 - i * 16, 60, 350 - i * 18, 116 + i * 6); x.quadraticCurveTo(420 - i * 16, 160, 400 - i * 16, 256); x.stroke(); }
      x.strokeStyle = '#c0282c'; x.lineWidth = 3; x.setLineDash([10, 6]); x.beginPath(); x.moveTo(20, 220); x.lineTo(180, 150); x.lineTo(300, 140); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#1b2a44'; x.beginPath(); x.moveTo(180, 150); x.lineTo(168, 140); x.lineTo(168, 160); x.fill();
      x.fillStyle = '#1b2a44'; x.font = sans(18, true); x.fillText('ECDIS  ·  COG 084°  SOG 11.8 kn', 12, 26);
    });
    ART.engines = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#0a1420'; x.fillRect(0, 0, w, h); x.fillStyle = '#9fd0ff'; x.font = sans(22, true); x.fillText('PROPULSION', 16, 32);
      for (let i = 0; i < 2; i++) {
        const cx = 130 + i * 250; x.strokeStyle = '#2b4c6c'; x.lineWidth = 14; x.beginPath(); x.arc(cx, 150, 70, PI * 0.8, PI * 2.2); x.stroke();
        x.strokeStyle = '#39d96b'; x.beginPath(); x.arc(cx, 150, 70, PI * 0.8, PI * (1.55 + i * 0.05)); x.stroke();
        x.fillStyle = '#e9e2cf'; x.textAlign = 'center'; x.font = sans(34, true); x.fillText(i ? '1 640' : '1 620', cx, 160); x.font = sans(16); x.fillText(i ? 'STBD RPM' : 'PORT RPM', cx, 190); x.textAlign = 'left';
      }
    });
    ART.plan = ct(1024, 256, (x, w, h) => {
      x.fillStyle = '#f4efe2'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1b2a44'; x.lineWidth = 4;
      x.beginPath(); x.moveTo(60, 60); x.lineTo(760, 60); x.quadraticCurveTo(930, 70, 990, 128); x.quadraticCurveTo(930, 186, 760, 196); x.lineTo(60, 196); x.closePath(); x.stroke();
      x.lineWidth = 2; for (const px of [200, 340, 460, 600, 700]) { x.beginPath(); x.moveTo(px, 80); x.lineTo(px, 176); x.stroke(); }
      x.fillStyle = '#1b2a44'; x.font = sans(20, true); x.textAlign = 'center';
      [['POOL', 130], ['SALON', 270], ['LOBBY', 400], ['DINING', 530], ['GYM', 650], ['HELIPAD', 850]].forEach(([t, px]) => x.fillText(t, px, 134));
      x.font = serif(26, true); x.fillStyle = '#8a6d32'; x.fillText('M/Y SOLACE  ·  MAIN DECK', w / 2, 36); x.fillStyle = '#c0282c'; x.beginPath(); x.arc(400, 170, 8, 0, 2 * PI); x.fill(); x.font = sans(16, true); x.fillText('YOU ARE HERE', 400, 226);
    });
    ART.seascape = ct(512, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2b870'); g.addColorStop(0.55, '#e8805a'); g.addColorStop(0.56, '#2d5d80'); g.addColorStop(1, '#16304a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffe2a0'; x.beginPath(); x.arc(330, 138, 30, PI, 0); x.fill(); x.fillStyle = 'rgba(255,230,160,0.5)'; for (let i = 0; i < 8; i++) x.fillRect(300 + (i % 3) * 8, 150 + i * 12, 60 - i * 6, 3);
      x.fillStyle = '#1a1a22'; x.beginPath(); x.moveTo(90, 150); x.lineTo(190, 150); x.lineTo(176, 162); x.lineTo(98, 162); x.fill(); x.fillRect(136, 96, 4, 54); x.beginPath(); x.moveTo(140, 98); x.lineTo(176, 146); x.lineTo(140, 146); x.fill();
    });
    ART.abstract = ct(256, 320, (x, w, h) => {
      x.fillStyle = '#f2ede4'; x.fillRect(0, 0, w, h); x.fillStyle = '#1b2a44'; x.fillRect(30, 40, 110, 160); x.fillStyle = '#c9a25a'; x.beginPath(); x.arc(170, 200, 60, 0, 2 * PI); x.fill();
      x.strokeStyle = '#b0282a'; x.lineWidth = 10; x.beginPath(); x.moveTo(20, 280); x.lineTo(230, 90); x.stroke();
    });
    ART.flag = ct(256, 128, (x, w, h) => {
      x.fillStyle = '#c0202a'; x.fillRect(0, 0, w, h); x.fillStyle = '#1b2a88'; x.fillRect(0, 0, 118, 64);
      x.strokeStyle = '#ffffff'; x.lineWidth = 12; x.beginPath(); x.moveTo(0, 0); x.lineTo(118, 64); x.moveTo(118, 0); x.lineTo(0, 64); x.stroke(); x.beginPath(); x.moveTo(59, 0); x.lineTo(59, 64); x.moveTo(0, 32); x.lineTo(118, 32); x.lineWidth = 18; x.stroke();
      x.strokeStyle = '#c0202a'; x.lineWidth = 8; x.beginPath(); x.moveTo(59, 0); x.lineTo(59, 64); x.moveTo(0, 32); x.lineTo(118, 32); x.stroke();
      x.fillStyle = '#e8e8e8'; x.beginPath(); x.arc(190, 64, 22, 0, 2 * PI); x.fill();
    });
    ART.tv = ct(512, 288, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a6aa8'); g.addColorStop(1, '#0e2a44'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff'; x.font = sans(40, true); x.textAlign = 'center'; x.fillText('WELCOME ABOARD', w / 2, 130); x.font = sans(24); x.fillText('M/Y SOLACE  ·  CAYMAN ISLANDS', w / 2, 180);
      x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(0, h - 30, w, 30); x.fillStyle = '#fff'; x.font = sans(16, true); x.fillText('SEA STATE 2  ·  AIR 29°C  ·  WATER 27°C  ·  WIND E 9 KT', w / 2, h - 10);
    });
    ART.slot = ct(256, 256, (x, w, h) => {
      x.fillStyle = '#2a0a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd24a'; x.font = sans(34, true); x.textAlign = 'center'; x.fillText('JACKPOT', w / 2, 44);
      for (let i = 0; i < 3; i++) { x.fillStyle = '#fff'; x.fillRect(22 + i * 74, 70, 64, 100); x.fillStyle = ['#c0202a', '#2a8a3a', '#c0202a'][i]; x.font = sans(60, true); x.fillText('7', 54 + i * 74, 145); }
      x.fillStyle = '#39d9ff'; x.font = sans(22, true); x.fillText('CREDITS 1 250', w / 2, 220);
    });
    return ART;
  }

  // ------------------------------------------------------------ the sea, the wake, the horizon
  function sea(rnd) {
    const M = L.mats;
    L.box(-900, WL - 1, -900, 900, WL, 900, 'ySea', { noCol: true, ao: false, uvScale: 1 / 23 });
    const foamMat = (alpha, op) => new THREE.MeshBasicMaterial({ map: TEX.foam, alphaMap: alpha, transparent: true, opacity: op, depthWrite: false, color: 0xf4f8fa });
    const mesh = (pos, uv, idx, mat) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      const m = new THREE.Mesh(g, mat); m.renderOrder = 3; L.scene.add(m); return m;
    };
    // the bow wave and the foam running down both sides, hugging the waterline
    const side = foamMat(TEX.fadeOut, 0.9);
    for (const s of [-1, 1]) {
      const pos = [], uv = [], idx = []; let n = 0;
      for (let x = STERN; x <= 42.2; x += 0.5) {
        const w = hw(x, WL), bw = 0.7 + 2.4 * Math.exp(-(((x - 38) / 3.2) ** 2)) + 0.9 * Math.max(0, (-28 - x) / 12);
        pos.push(x, WL + 0.03, s * (w + 0.02), x - bw * 0.6, WL + 0.03, s * (w + bw)); uv.push(x / 8, 0, x / 8, 1);
        if (n) { const a = (n - 1) * 2; if (s > 0) idx.push(a, a + 1, a + 3, a, a + 3, a + 2); else idx.push(a, a + 3, a + 1, a, a + 2, a + 3); }
        n++;
      }
      mesh(pos, uv, idx, side);
    }
    // the wake: a churned band straight astern that spreads and thins out, and the two arms of the V
    for (const [x0, x1, w0, w1, op] of [[STERN, -80, 8.5, 16, 0.85], [-80, -140, 16, 24, 0.55], [-140, -220, 24, 34, 0.3], [-220, -320, 34, 46, 0.14]]) {
      const pos = [], uv = [], idx = [], n = 12;
      for (let i = 0; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, w = w0 + (w1 - w0) * k; pos.push(x, WL + 0.04, -w / 2, x, WL + 0.04, w / 2); uv.push(x / 8, 0, x / 8, 1); if (i) { const a = (i - 1) * 2; idx.push(a, a + 3, a + 1, a, a + 2, a + 3); } }
      mesh(pos, uv, idx, foamMat(TEX.fadeMid, op));
    }
    const arm = foamMat(TEX.fadeMid, 0.5);
    for (const s of [-1, 1]) {
      const pos = [], uv = [], idx = [], n = 16;
      for (let i = 0; i <= n; i++) { const k = i / n, x = STERN - 2 - k * 260, z = s * (7 + k * 110), w = 2 + k * 8; pos.push(x, WL + 0.035, z - w / 2, x, WL + 0.035, z + w / 2); uv.push(x / 8, 0, x / 8, 1); if (i) { const a = (i - 1) * 2; idx.push(a, a + 3, a + 1, a, a + 2, a + 3); } }
      mesh(pos, uv, idx, arm);
    }
    L.animated.push((dt, t) => {
      TEX.foam.offset.x = (t * SPEED / 8) % 1;
      M.ySea.normalMap.offset.set((t * SPEED / 23) % 1, (t * 0.012) % 1);
    });
    // on the horizon: a green island with a lighthouse, a container ship, a sailing yacht
    for (let i = 0; i < 9; i++) { const x = 380 + i * 34 + rnd() * 20, z = -520 + Math.sin(i * 1.3) * 30, s = 40 + rnd() * 60; K.put(i % 3 ? 'forest' : 'rock', K.blobGeo(i % 3), x, WL - s * 0.25, z, s, s * (0.35 + rnd() * 0.35), s * 0.8, rnd() * 6); }
    L.cyl('yWhite', 520, WL + 34, -470, 3, 18, 0, 0, true); L.cyl('paintRed', 520, WL + 45, -470, 2.6, 4, 0, 0, true); L.cyl('glassDay', 520, WL + 48, -470, 2.2, 2.4, 0, 0, true);
    L.box(-260, WL, 420, -80, WL + 14, 452, 'paintRed', { noCol: true, ao: false, top: 'paintDark' });
    for (let x = -250; x < -110; x += 13) for (let l = 0; l < 3; l++) L.box(x, WL + 14 + l * 2.6, 424, x + 12, WL + 16.5 + l * 2.6, 448, ['cont_blue', 'cont_red', 'cont_green', 'cont_orange'][(x / 13 + l | 0) & 3] || 'paintBlue', { noCol: true, ao: false });
    L.box(-100, WL + 14, 422, -84, WL + 34, 450, 'yWhite', { noCol: true, ao: false });
    L.box(260, WL, 330, 272, WL + 2, 334, 'yWhite', { noCol: true, ao: false }); L.pipe('steel', 266, WL + 2, 332, 266, WL + 18, 332, 0.2);
    const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([266, WL + 3, 332.2, 266, WL + 17, 332.2, 274, WL + 3, 332.2], 3)); sail.computeVertexNormals();
    const sm = new THREE.Mesh(sail, new THREE.MeshStandardMaterial({ color: 0xf4f2ea, side: THREE.DoubleSide, roughness: 0.8 })); L.scene.add(sm);
  }

  // ------------------------------------------------------------ the hull
  function hull() {
    const A = art();
    loft('yRed', [-5, -4.4, -3.9], 0);
    loft('yNavy', [-3.9, -3.6, -3.3, -2.95], 0);
    loft('yWhite', [-2.95, -2.4, -1.8, -1.2, -0.6, 0, 0.5, 1.05], 0);
    loft('yGold', [-0.52, -0.42], 0.012);
    loft('yNavy', [0.64, 0.7], 0.012);
    loft('yWhite', [0, 1.05], -0.12, true);                       // the inside face of the bulwark
    for (const s of [-1, 1]) strip('yTeak', STERN, BOW + 0.5, 1.05, (x) => s > 0 ? Math.max(0, hw(x, 1.05) - 0.12) : -hw(x, 1.05), (x) => s > 0 ? hw(x, 1.05) : -Math.max(0, hw(x, 1.05) - 0.12));
    // the transom, in 15 cm courses, with the stair wells cut through it; the stern bulwark's inside face and cap
    const gaps = [[-5.15, -3.45], [3.45, 5.15]];
    for (let y = -3.9; y < 1.05 - 1e-6; y += 0.15) {
      const y1 = Math.min(1.05, y + 0.15), w = hw(STERN, (y + y1) / 2), m = y1 <= -2.95 + 1e-6 ? 'yNavy' : 'yWhite';
      for (const [z0, z1] of spans(-w, w, y1 > SP ? gaps : [])) L.box(STERN - 0.06, y, z0, STERN + 0.06, y1, z1, m, { noCol: true, ao: false });
    }
    for (const [z0, z1] of spans(-BW, BW, gaps)) { L.box(STERN + 0.06, 0, z0, STERN + 0.2, 1.05, z1, 'yWhite', { noCol: true }); deco(STERN - 0.06, 1.05, z0, STERN + 0.2, 1.08, z1, 'yTeak'); }
    for (const [z0, z1] of spans(-BEAM, BEAM, gaps)) { W.add(STERN - 0.1, -3.9, z0, STERN + 0.2, 1.05, z1, { surf: 'metal' }); guard(STERN - 0.1, 1.05, z0, STERN + 0.2, TOPG, z1); }
    K.plane(A.name, 4, 1, STERN - 0.07, -1.05, 0, -PI / 2, { alpha: true });
    for (const s of [-1, 1]) { K.sph('lampWarm', STERN - 0.07, -0.4, s * 6.6, 0.06); K.sph('lampWarm', STERN - 0.07, -1.9, s * 2.2, 0.05); }
    // bulwarks and the invisible walls over them: the parallel body, then 0.5 m slices round the bow
    for (const s of [-1, 1]) {
      const a = s > 0 ? BW : -BEAM - 0.1, b = s > 0 ? BEAM + 0.1 : -BW;
      W.add(STERN, -0.3, a, HB, 1.05, b, { surf: 'metal' }); guard(STERN, 1.05, a, HB, TOPG, b);
    }
    for (let x = HB; x < BOW + 0.5; x += 0.5) {
      const wi = hwIn(x + 0.5), wo = hw(x, 0) + 0.1;
      for (const s of [-1, 1]) { const a = s > 0 ? wi : -wo, b = s > 0 ? wo : -wi; W.add(x, -0.3, a, x + 0.5, 1.05, b, { surf: 'metal' }); guard(x, 1.05, a, x + 0.5, TOPG, b); }
    }
    W.add(BOW - 0.6, -0.3, -0.6, BOW + 0.8, 1.05, 0.6, { surf: 'metal' }); guard(BOW - 0.6, 1.05, -0.6, BOW + 0.8, TOPG, 0.6);
    // portholes along the lower deck, the name on the bow, fairleads and the anchors in their pockets
    for (let x = -28; x <= 30; x += 2.4) {
      if (x > -2 && x < 1) continue;
      for (const s of [-1, 1]) {
        const y = -1.6, w = hw(x, y), rz = s * Math.atan(slope(x, y));
        K.put('chrome', L.geo('cyl'), x, y, s * (w + 0.015), 0.21, 0.05, 0.21, 0, PI / 2, rz);
        K.put('glassDay', L.geo('cyl'), x, y, s * (w + 0.02), 0.16, 0.06, 0.16, 0, PI / 2, rz);
      }
    }
    for (const s of [-1, 1]) {
      const x = 33.5, y = -0.15, w = hw(x, y) + 0.05, sl = slope(x, y);
      K.plane(A.bowName, 3.6, 0.9, x, y, s * w, s > 0 ? Math.atan2(-sl, 1) : Math.atan2(-sl, -1), { alpha: true });
      const ax = 39.8, ay = -0.9, aw = hw(ax, ay);
      K.sph('paintDark', ax, ay, s * (aw - 0.05), 0.55, 0.45, 0.2);
      K.put('steel', L.geo('box'), ax - 0.05, ay - 0.35, s * (aw + 0.06), 0.14, 0.9, 0.1);
      K.put('steel', L.geo('box'), ax - 0.05, ay - 0.8, s * (aw + 0.02), 0.8, 0.14, 0.12, 0, 0, 0);
      for (const d of [-1, 1]) K.put('steel', L.geo('box'), ax - 0.05 + d * 0.32, ay - 0.66, s * (aw + 0.03), 0.18, 0.34, 0.12, 0, 0, d * 0.5);
    }
  }

  // ------------------------------------------------------------ the main deck: slab, bow deck and helipad, stern stairs, swim platform
  function mainDeck(rnd) {
    const holes = [[-38, -33, -2.4, 2.4], [STERN, -36.2, 3.45, 5.15], [STERN, -36.2, -5.15, -3.45], [-31, -26, 3.0, 4.4], [-9.6, -5.2, -3.6, -1.4], [18, 19.4, -3, 2]];
    K.holeSpans(STERN + 0.06, HB, -7.9, 7.9, holes, (x0, x1, z0, z1) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) L.box(x0, -0.3, z0, x1, 0, z1, 'ceiling', { top: 'yTeak', side: 'yWhite', bottom: true }); });
    // the bow: teak ahead of the pad, the pad itself, colliders in 0.5 m slices; a ceiling under it for the master suite
    strip('yTeak', HB, PX0, 0, (x) => -hwIn(x), (x) => hwIn(x));
    strip('yTeak', PX1, BOW + 0.4, 0, (x) => -hwIn(x), (x) => hwIn(x));
    strip('yPad', PX0, PX1, PAD, (x) => -hwIn(x), (x) => hwIn(x));
    for (let x = HB; x < BOW + 0.4; x += 0.5) { const w = hw(x, 0); W.add(x, -0.3, -w, x + 0.5, x >= PX0 - 1e-6 && x + 0.5 <= PX1 + 1e-6 ? PAD : 0, w, { surf: 'metal' }); }
    L.box(HB, -0.32, -5.1, 29.7, -0.3, 5.1, 'ceiling', { noCol: true, bottom: true, ao: false });
    // steps up onto the pad and down off it, full width between the bulwarks; white risers under the pad edges
    const stepX = (x0, x1, top) => { const w = hwIn(x0); L.box(x0, 0, -w, x1, top, w, 'yWhite', { top: 'yTeak' }); deco(x0 - 0.02, top, -w, x0 + 0.02, top + 0.006, w, 'chrome'); };
    stepX(PX0 - 0.8, PX0 - 0.4, 0.2); stepX(PX0 - 0.4, PX0, 0.4);
    { const w = hwIn(PX1); L.box(PX1 + 0.4, 0, -hwIn(PX1 + 0.4), PX1 + 0.8, 0.2, hwIn(PX1 + 0.4), 'yWhite', { top: 'yTeak' }); L.box(PX1, 0, -w, PX1 + 0.4, 0.4, w, 'yWhite', { top: 'yTeak' }); }
    deco(PX0 - 0.01, 0.4, -hwIn(PX0), PX0 + 0.01, PAD, hwIn(PX0), 'yWhite'); deco(PX1 - 0.01, 0.4, -hwIn(PX1), PX1 + 0.01, PAD, hwIn(PX1), 'yWhite');
    // stairs from the swim platform up through the transom, each in its own well
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? 3.6 : -5.0, z1 = s > 0 ? 5.0 : -3.6;
      steps('x', STERN, -36.2, z0, z1, SP, MD, 1, 'yWhite', 'yTeak', 'chrome');
      L.box(STERN + 0.06, SP, s > 0 ? 3.45 : -3.6, -36.2, 0, s > 0 ? 3.6 : -3.45, 'yWhite');
      L.box(STERN + 0.06, SP, s > 0 ? 5.0 : -5.15, -36.2, 0, s > 0 ? 5.15 : -5.0, 'yWhite');
      slopeGuard('x', STERN, -36.2, s * 3.6, SP, MD, 1); slopeGuard('x', STERN, -36.2, s * 5.0, SP, MD, 1);
    }
    // the swim platform: teak on a white slab, invisible walls round it, a boarding ladder into the sea
    L.box(-43, SP - 0.3, -6.2, STERN - 0.06, SP, 6.2, 'yWhite', { top: 'yTeak', bottom: true });
    guard(-43.3, SP, -6.5, -43, TOPG, 6.5); guard(-43, SP, 6.2, STERN, TOPG, 6.5); guard(-43, SP, -6.5, STERN, TOPG, -6.2);
    for (const z of [-0.35, 0.35]) { L.pipe('chrome', -42.9, SP, z, -43.3, SP + 0.9, z, 0.025); L.pipe('chrome', -42.95, SP, z, -42.95, WL - 0.6, z, 0.025); }
    for (let y = SP - 0.3; y > WL - 0.6; y -= 0.3) L.pipe('chrome', -42.95, y, -0.35, -42.95, y, 0.35, 0.02);
    for (let z = -5.5; z <= 5.5; z += 1.1) K.sph('lampCool', -42.98, SP - 0.15, z, 0.04);
  }

  // ------------------------------------------------------------ aft: the pool deck, the cockpit bar, the jet skis, the towed skiff
  function jetSki(x, z, y, paint) {
    const put = (m, g, dx, dy, dz, sx, sy, sz, ry) => K.put(m, g, x + dx, y + dy, z + dz, sx, sy, sz, ry || 0);
    put('yWhite', K.extrude('yJetHull', [[-1.2, 0.05], [0.9, 0.05], [1.3, 0.4], [0.9, 0.55], [0.1, 0.6], [-0.9, 0.62], [-1.2, 0.5]], 1.0, 0.06), 0, 0, 0, 1, 1, 1, PI);
    put(paint, K.extrude('yJetStripe', [[-1.25, 0.3], [1.1, 0.3], [1.22, 0.4], [-1.25, 0.4]], 1.08, 0), 0, 0, 0, 1, 1, 1, PI);
    deco(x - 0.3, y + 0.62, z - 0.22, x + 0.75, y + 0.78, z + 0.22, 'paintDark');
    L.pipe('paintDark', x - 0.55, y + 0.62, z, x - 0.35, y + 0.95, z, 0.04); L.pipe('chrome', x - 0.35, y + 0.95, z - 0.35, x - 0.35, y + 0.95, z + 0.35, 0.02);
    solid(x - 1.3, y, z - 0.5, x + 1.3, y + 0.9, z + 0.5, 'metal');
  }
  function aftDeck(rnd) {
    const A = art();
    // the pool: mosaic walls and floor, a marble coping, steps in at the forward end, lights under water
    const pw = (x0, z0, x1, z1) => L.box(x0, -1.3, z0, x1, 0, z1, 'yTile', { top: 'yMarble', uvScale: 1 });
    pw(-38, -2.4, -33, -2.25); pw(-38, 2.25, -33, 2.4); pw(-38, -2.25, -37.85, 2.25); pw(-33.15, -2.25, -33, 2.25);
    L.box(-37.85, -1.5, -2.25, -33.15, -1.3, 2.25, 'yTile', { uvScale: 1 });
    steps('x', -35.1, -33.15, -1.2, 1.2, -1.3, 0, 1, 'yTile', 'yMarble');
    deco(-37.85, -0.2, -2.25, -33.15, -0.18, 2.25, 'yPoolWater');
    for (const z of [-2.24, 2.24]) for (const x of [-36.8, -34.4]) K.sph('lampCool', x, -0.8, z, 0.09, 0.09, 0.03);
    lamp(-35.5, -0.7, 0, 0x60d8ff, 1.1, 6);
    // loungers along the pool, towels on some; a cooler, planters in the corners
    for (const s of [-1, 1]) { lounger(-33.6, s * 4.05, 0, 1, s > 0 ? 'yTowel' : 'yTowel2'); }
    P('cooler', -38.6, -2.9, 0.2);
    // the ensign on a raked staff at the stern, waving in the wind of the passage
    L.pipe('chrome', -39.5, 0, 0, -40.1, 3.4, 0, 0.04); K.sph('yGold', -40.12, 3.45, 0, 0.07);
    const fg = new THREE.PlaneGeometry(1.5, 1, 12, 6); fg.translate(-0.75, 0, 0);
    const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: A.flag, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(-40.05, 2.85, 0); flag.castShadow = true; L.scene.add(flag);
    const fp = fg.attributes.position, fx = Float32Array.from({ length: fp.count }, (_, i) => fp.getX(i));
    L.animated.push((dt, t) => { for (let i = 0; i < fp.count; i++) { const u = -fx[i]; fp.setZ(i, Math.sin(u * 4 - t * 9) * 0.12 * u); } fp.needsUpdate = true; fg.computeVertexNormals(); });
    // stairs up to the upper deck, one each side against the bulwark
    for (const s of [-1, 1]) {
      steps('x', -38.4, UA, s * 6.3, s * 7.7, MD, UD, 1, 'yWhite', 'yTeak', 'chrome');
      slopeGuard('x', -38.4, UA, s * 6.3, MD, UD, 1); slopeGuard('x', -38.4, UA, s * 7.7, MD, UD, 1, true);
    }
    // the engine-room hatch: a stair down under the cockpit roof, rails round the opening
    steps('x', -31, -26, 3.0, 4.4, LD, MD, -1, 'paintGrey', 'grate', 'paintYellow');
    rail('x', -31, -26, 2.95, MD); rail('x', -31, -26, 4.45, MD); rail('z', 3.0, 4.4, -25.95, MD);
    L.box(-31, LD, 2.85, -26, -0.3, 3.0, 'paintGrey'); L.box(-31, LD, 4.4, -26, -0.3, 4.55, 'paintGrey');
    K.plane(A.engine, 0.9, 0.28, -25.9, 0.75, 3.7, PI / 2);
    // the cockpit: the bar to port (bottles against the bulwark), sofas to starboard, downlights in the overhang
    L.box(-29.4, 0, -5.8, -25.6, 1.1, -5.1, 'yWalnut', { top: 'yMarble' }); deco(-29.4, 0.15, -5.08, -25.6, 0.2, -5.04, 'chrome');
    L.box(-29.4, 0, -7.85, -25.6, 0.95, -7.3, 'yWalnut', { top: 'yMarble' });
    for (const y of [1.35, 1.75]) { deco(-29.3, y - 0.03, -7.86, -25.7, y, -7.6, 'glassClear'); bottles(-29.3, -25.7, y, -7.72, rnd); }
    bottles(-29.3, -27.9, 0.95, -7.5, rnd);
    for (let i = 0; i < 4; i++) P('stool', -28.9 + i * 0.95, -4.55, 0, 0);
    for (const x of [-28.8, -27.2]) { L.cyl('glassDay', x, 1.16, -5.4, 0.04, 0.12, 0, 0, true); L.cyl('yGold', x, 1.14, -5.4, 0.035, 0.07, 0, 0, true); }
    sofa(-25.3, 4.7, -24.3, 7.5, 0, 'x+', 'yCanvas'); sofa(-28.8, 6.7, -25.3, 7.6, 0, 'z+', 'yCanvas'); coffeeTable(-27.8, 5.2, -26.2, 6.2, 0, 'yTeak');
    P('cooler', -30.4, 5.6, -0.3);
    for (const [x, z] of [[-30, -4], [-30, 0], [-27, -2], [-27, 2], [-30, 6.5], [-27, 6], [-25, -6.8], [-25, 0]]) dl(x, MW, z);
    lamp(-28, MW - 0.5, -3.5, 0xffe2bc, 1.1, 8);
    // life rings on the house front, the muster board
    K.plane(A.muster, 0.4, 0.4, MX0 - 0.12, 1.6, -3.33, -PI / 2);
    L.addPickup('ammo', -27, 0, -2); L.addPickup('ammo', -39, 0, -5.5);
    // the swim platform: two jet skis, a tow rope out to the hijackers' skiff
    jetSki(-41.6, -5.55, SP, 'paintRed'); jetSki(-41.6, 5.55, SP, 'panelBlue');
    for (const z of [2.6, -2.6]) { L.cyl('steel', -42.4, SP + 0.12, z, 0.06, 0.24, 0, 0, true); L.pipe('steel', -42.4, SP + 0.24, z - 0.18, -42.4, SP + 0.24, z + 0.18, 0.04); }
    skiff(-51, 4.6);
    L.pipe('yRope', -42.4, SP + 0.24, 2.6, -45.5, SP - 0.4, 3.8, 0.025); L.pipe('yRope', -45.5, SP - 0.4, 3.8, -47.6, WL + 0.9, 4.6, 0.025);
  }
  /** The hijackers' skiff, towed astern: a battered open boat with an outboard, a fuel can, a grapnel and rope. */
  function skiff(x, z) {
    const y = WL - 0.35;
    K.put('panelBlue', K.extrude('ySkiff', [[-3, 0], [2.6, 0], [3.6, 0.95], [3.4, 1.15], [-3, 1.15]], 1.9, 0.05), x, y, z, 1, 1, 1);
    K.put('yWhite', K.extrude('ySkiffIn', [[-2.9, 0.3], [2.6, 0.3], [3.3, 1.02], [-2.9, 1.02]], 1.6, 0), x, y + 0.14, z, 1, 1, 1);
    deco(x - 3.05, y + 1.1, z - 0.97, x + 3.4, y + 1.2, z - 0.9, 'yRed'); deco(x - 3.05, y + 1.1, z + 0.9, x + 3.4, y + 1.2, z + 0.97, 'yRed');
    for (const dx of [-1.4, 0.6]) deco(x + dx - 0.15, y + 0.75, z - 0.85, x + dx + 0.15, y + 0.82, z + 0.85, 'wood');
    L.box(x - 3.5, y + 0.6, z - 0.25, x - 3.0, y + 1.6, z + 0.25, 'paintDark', { noCol: true }); L.pipe('paintDark', x - 3.3, y + 0.6, z, x - 3.3, y - 0.5, z, 0.06);
    deco(x - 1.9, y + 0.44, z + 0.3, x - 1.5, y + 0.8, z + 0.6, 'paintRed'); K.sph('steel', x + 1.8, y + 0.5, z - 0.3, 0.14);
    for (const d of [-1, 0, 1]) L.pipe('steel', x + 1.8, y + 0.5, z - 0.3, x + 1.8 + d * 0.2, y + 0.3, z - 0.3 + Math.abs(d) * 0.15 - 0.1, 0.02);
    K.put('yRope', ringGeo(), x + 0.4, y + 0.42, z + 0.2, 0.3, 0.3, 0.6, 0, PI / 2);
    // foam round her and her own little wake
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 3.6), new THREE.MeshBasicMaterial({ map: TEX.foam, alphaMap: TEX.fadeMid, transparent: true, opacity: 0.6, depthWrite: false, color: 0xf4f8fa }));
    m.rotation.x = -PI / 2; m.position.set(x - 0.6, WL + 0.05, z); m.renderOrder = 3; L.scene.add(m);
  }

  // ------------------------------------------------------------ the main-deck house: salon, lobby, dining room, galley, gym, study
  function mainHouse(rnd) {
    const A = art();
    const SAL = [[0, 0.12, 'yWalnut'], [0.12, 2.86, 'yPanel'], [2.86, MW, 'yWalnut']], LOB = [[0, 0.12, 'yWalnut'], [0.12, MW, 'yMarble']];
    const DIN = [[0, 0.95, 'yWalnut'], [0.95, 1.0, 'yGold'], [1.0, MW, 'yPanel']], GAL = [[0, MW, 'panelWhite']], GYM = [[0, MW, 'wallClean']], STU = [[0, MW, 'yWalnut']];
    // outside walls
    const win = (a0, a1, lo, hi) => [a0, a1, lo || 0.9, hi || 2.5];
    house('x', MX0, MX1, -SX, 0, MW, [win(-23.2, -17.3), win(-16.7, -10.8), [-8, -6.8, 0, 2.3], win(-3.2, 0.8), win(1.4, 5.4), win(8.6, 12.6), [14, 15, 0, 2.3]], -1,
      [[MX0, -10, SAL], [-10, -4, LOB], [-4, 8, DIN], [8, MX1, GYM]]);
    house('x', MX0, MX1, SX, 0, MW, [win(-23.2, -17.3), [-8, -6.8, 0, 2.3], win(-3.2, 0.8, 1.3, 2.4), win(3.1, 4.4, 1.3, 2.4), [5.2, 6.2, 0, 2.3], win(8.6, 12.6), [14, 15, 0, 2.3]], 1,
      [[MX0, -10, SAL], [-10, -4, LOB], [-4, 6.8, GAL], [6.8, 8, DIN], [8, MX1, STU]]);
    house('z', -SX + T / 2, SX - T / 2, MX0, 0, MW, [[-3, 3, 0, 2.5], win(-5.6, -3.6), win(3.6, 5.6)], -1, [[-SX + T / 2, SX - T / 2, SAL]]);
    house('z', -SX + T / 2, SX - T / 2, MX1, 0, MW, [[-0.7, 0.7, 0, 2.3], win(-5.6, -2.2), win(2.2, 5.6)], 1, [[-SX + T / 2, -1.5, GYM], [-1.5, 1.5, LOB], [1.5, SX - T / 2, STU]]);
    // sliding glass doors parked open either side of the salon doorway
    for (const s of [-1, 1]) cut('z', Math.min(s * 3.05, s * 4.9), Math.max(s * 3.05, s * 4.9), MX0 + 0.16, 0.03, 0.02, 2.48, [], 'yTint', { noCol: true, ao: false });
    // partitions
    const inner = SX - T / 2;
    part('z', -inner, inner, -10, 0, MW, [[-1.4, 1.4, 0, 2.6]], SAL, LOB);
    part('z', -inner, 0, -4, 0, MW, [[-3.4, -1.6, 0, 2.4]], LOB, DIN); part('z', 0, inner, -4, 0, MW, [[3.8, 5.0, 0, 2.3]], LOB, GAL);
    part('x', -3.9, 6.8, 0, 0, MW, [], DIN, GAL);
    part('z', -inner, -1.5, 8, 0, MW, [], DIN, GYM); part('z', -1.5, 1.5, 8, 0, MW, [[-1.2, 1.2, 0, 2.4]], DIN, LOB); part('z', 1.5, inner, 8, 0, MW, [], DIN, STU);
    part('x', 8.1, MX1 - T / 2, -1.5, 0, MW, [[11.5, 12.7, 0, 2.3]], GYM, LOB); part('x', 8.1, MX1 - T / 2, 1.5, 0, MW, [[11.5, 12.7, 0, 2.3]], LOB, STU);
    // floors
    floor(MX0 + 0.1, -inner, -10.1, inner, 0, 'yCarpet'); floor(-9.9, -inner, -4.1, inner, 0, 'yMarble', [[-9.6, -5.2, -3.6, -1.4], [-8.8, -4.4, 1.4, 3.6]]);
    floor(-3.9, -inner, 6.8, -0.1, 0, 'floorWood'); floor(-3.9, 0.1, 6.8, inner, 0, 'checker'); floor(6.8, -inner, 7.9, inner, 0, 'yMarble');
    floor(8.1, -1.4, MX1 - 0.1, 1.4, 0, 'yMarble'); floor(8.1, -inner, MX1 - 0.1, -1.6, 0, 'rubber'); floor(8.1, 1.6, MX1 - 0.1, inner, 0, 'yCarpet');
    // walkways: toe lights along the house, bollards and life rings, a rope ladder the hijackers came up by
    for (let x = MX0 + 1; x < MX1; x += 3) for (const s of [-1, 1]) K.sph('lampWarm', x, 0.25, s * (SX + 0.13), 0.04, 0.04, 0.02);
    for (const x of [-18, 4]) for (const s of [-1, 1]) K.put('panelOrange', ringGeo(), x, 1.6, s * (SX + 0.14), 0.3, 0.3, 0.3);
    for (const x of [-30.5, -14, 2, 17.5]) for (const s of [-1, 1]) {
      const zz = s * (Math.min(BW, hwIn(x)) - 0.35);
      for (const dx of [-0.22, 0.22]) { L.cyl('steel', x + dx, 0.18, zz, 0.09, 0.36, 0, 0, true); L.cyl('steel', x + dx, 0.38, zz, 0.12, 0.04, 0, 0, true); }
      solid(x - 0.35, 0, zz - 0.14, x + 0.35, 0.4, zz + 0.14, 'metal');
    }
    { const x = 0.6, top = [x, 1.12, -BEAM + 0.05];
      L.pipe('steel', top[0], top[1], top[2], x, 1.2, -BW + 0.25, 0.035); for (const d of [-1, 1]) L.pipe('steel', x, 1.2, -BW + 0.25, x + d * 0.25, 0.95, -BW + 0.08, 0.025);
      for (const dx of [-0.25, 0.25]) { let p = [x + dx, 1.1, -BEAM - 0.04]; for (let y = 0.8; y >= WL - 0.2; y -= 0.35) { const q = [x + dx, y, -(hw(x, y) + 0.06)]; L.pipe('yRope', p[0], p[1], p[2], q[0], q[1], q[2], 0.02); p = q; } }
      for (let y = 0.6; y >= WL; y -= 0.35) L.pipe('woodDark', x - 0.25, y, -(hw(x, y) + 0.08), x + 0.25, y, -(hw(x, y) + 0.08), 0.03); }
    // --- the salon: the big leather sofa facing the screen, the grand piano, the bar, armchairs, art
    floor(-21.8, -4.6, -14.6, -0.3, 0.006, 'rug');
    sofa(-21.4, -1.2, -15.6, -0.4, 0, 'z+'); sofa(-22.2, -4.4, -21.4, -1.2, 0, 'x-'); sofa(-15.6, -4.4, -14.8, -1.2, 0, 'x+');
    coffeeTable(-19.7, -3.4, -17.3, -2.2, 0, 'yMarble');
    L.cyl('yGold', -18.5, 0.5, -2.8, 0.12, 0.16, 0, 0, true); K.sph('paintRed', -18.5, 0.62, -2.8, 0.1); deco(-19.3, 0.42, -3.2, -18.9, 0.46, -2.9, 'appliance');
    L.box(-20.6, 0, -6.08, -16.4, 0.5, -5.6, 'yWalnut', { top: 'yBlack' }); deco(-20.1, 0.95, -6.08, -16.9, 2.75, -6.03, 'yBlack'); screen(A.tv, 3.05, 1.7, -18.5, 1.85, -6.02, 0);
    for (const x of [-20.3, -16.7]) { L.cyl('yBlack', x, 0.9, -5.85, 0.12, 0.8, 0, 0, true); }
    // grand piano and its bench
    K.put('yBlack', K.extrude('yPiano', [[0, 0], [1.5, 0], [1.5, 0.2], [1.1, 0.5], [0.9, 1.1], [0.6, 1.5], [0, 1.5]], 0.34, 0.02), -21.2, 0.62, 4.2, 1, 1, 1, 0, PI / 2);
    K.put('yBlack', L.geo('box'), -20.5, 1.34, 4.9, 1.3, 0.03, 1.2, 0.35, 0, 0.5);
    for (const [dx, dz] of [[0.1, 0.1], [1.4, 0.1], [0.6, 1.4]]) deco(-21.2 + dx - 0.04, 0, 4.2 + dz - 0.04, -21.2 + dx + 0.04, 0.62, 4.2 + dz + 0.04, 'yBlack');
    deco(-21.2, 0.9, 4.2, -19.7, 0.94, 4.36, 'yWhite'); for (let x = -21.15; x < -19.7; x += 0.09) deco(x, 0.94, 4.2, x + 0.04, 0.955, 4.3, 'yBlack');
    solid(-21.25, 0, 4.15, -19.65, 1.3, 5.75); L.box(-21, 0, 3.4, -20, 0.5, 3.8, 'yBlack', { top: 'yLeather' });
    // the bar, bottles on glass shelves, stools
    L.box(-15.5, 0, 3.2, -11.2, 1.1, 3.8, 'yWalnut', { top: 'yMarble' }); deco(-15.5, 0.15, 3.18, -11.2, 0.2, 3.14, 'yGold');
    L.box(-15.5, 0, 5.55, -11.2, 0.95, 6.08, 'yWalnut', { top: 'yMarble' }); deco(-15.5, 1.1, 6.07, -11.2, 2.6, 6.08, 'chrome');
    for (const y of [1.35, 1.8, 2.25]) { deco(-15.4, y - 0.03, 5.7, -11.3, y, 6.06, 'glassClear'); bottles(-15.3, -11.4, y, 5.88, rnd); }
    for (let i = 0; i < 4; i++) P('stool', -14.9 + i * 1.0, 2.6, 0, 0);
    L.cyl('glassDay', -13.2, 1.18, 3.5, 0.04, 0.16, 0, 0, true); L.cyl('yGold', -12.4, 1.15, 3.45, 0.05, 0.1, 0, 0, true);
    // armchairs and a floor lamp by the forward wall, palms, pictures
    for (const z of [-5.2, -3.4]) sofa(-11.3, z - 0.45, -10.4, z + 0.45, 0, 'x+');
    L.cyl('yWalnut', -11.9, 0.28, -4.3, 0.3, 0.04, 0, 0, true); L.cyl('chrome', -11.9, 0.14, -4.3, 0.03, 0.28, 0, 0, true); solid(-12.2, 0, -4.6, -11.6, 0.3, -4.0);
    L.pipe('chrome', -10.5, 0, -2.3, -10.5, 1.7, -2.3, 0.02); L.cyl('yCanvas', -10.5, 1.75, -2.3, 0.2, 0.3, 0, 0, false);
    pot(-23.4, -5.6, 0, 1.2); pot(-23.4, 5.6, 0, 1.2);
    picture(A.seascape, -10.12, 1.7, -3.2, -PI / 2, 1.6, 0.8); picture(A.abstract, -10.12, 1.6, 3.6, -PI / 2, 0.8, 1.0);
    for (let x = -22; x < -10.5; x += 2.6) for (const z of [-4, 0, 4]) dl(x, MW, z);
    lamp(-19, MW - 0.4, -2.5); lamp(-13, MW - 0.4, 3.5, 0xffe2bc, 1.0, 8);
    L.addPickup('ammo', -12.5, 0, 0.8);
    // --- the lobby: the stairs, glass balustrades, a pendant of lights down the well, a deck plan, plinths
    steps('x', -9.6, -5.2, -3.6, -1.4, LD, MD, 1, 'yPanel', 'yWalnut', 'chrome');
    steps('x', -8.8, -4.4, 1.4, 3.6, MD, UD, 1, 'yPanel', 'yWalnut', 'chrome');
    slopeGuard('x', -9.6, -5.2, -3.6, LD, MD, 1); slopeGuard('x', -9.6, -5.2, -1.4, LD, MD, 1);
    slopeGuard('x', -8.8, -4.4, 1.4, MD, UD, 1); slopeGuard('x', -8.8, -4.4, 3.6, MD, UD, 1);
    glassRail('x', -9.6, -5.2, -3.65, MD); glassRail('x', -9.6, -5.2, -1.35, MD); glassRail('z', -3.6, -1.4, -9.65, MD);
    for (let i = 0; i < 14; i++) { const a = i * 0.9, px = -7.4 + Math.cos(a) * 0.5, pz = -2.5 + Math.sin(a) * 0.5, py = 1.9 - i * 0.24; K.sph('lampWarm', px, py, pz, 0.06); L.pipe('chrome', px, MW, pz, px, py + 0.06, pz, 0.004); }
    lamp(-7.4, 0.4, -2.5, 0xffd8a8, 1.0, 8);
    for (const s of [-1, 1]) { L.box(-9.6, 0, s * 5.2 - 0.3, -9.0, 1.0, s * 5.2 + 0.3, 'yMarble'); K.sph('yNavy', -9.3, 1.25, s * 5.2, 0.22, 0.28, 0.22); L.cyl('yNavy', -9.3, 1.5, s * 5.2, 0.08, 0.14, 0, 0, true); }
    K.plane(A.plan, 2.4, 0.6, -4.12, 1.7, -5.0, -PI / 2);
    for (const [x, z] of [[-7, -5], [-7, 5], [-5.2, 0], [-8.6, 0]]) dl(x, MW, z);
    lamp(-7, MW - 0.4, 0, 0xffe2bc, 0.9, 7);
    // --- the dining room: a long table for ten under a chandelier, a sideboard, pictures
    L.box(-1, 0.72, -3.95, 5, 0.78, -2.25, 'yWalnut', { noCol: true }); deco(-0.9, 0.78, -3.4, 4.9, 0.784, -2.8, 'yCanvas');
    for (const x of [0.2, 3.8]) { L.cyl('yWalnut', x, 0.36, -3.1, 0.12, 0.72, 0, 0, true); L.cyl('yWalnut', x, 0.03, -3.1, 0.4, 0.06, 0, 0, true); }
    solid(-1, 0, -3.95, 5, 0.78, -2.25);
    for (let i = 0; i < 4; i++) { const x = -0.2 + i * 1.4; dchair(x, -4.45, 0, 'z+'); dchair(x, -1.75, 0, 'z-'); K.put('yWhite', L.geo('cyl'), x, 0.79, -3.65, 0.13, 0.01, 0.13); K.put('yWhite', L.geo('cyl'), x, 0.79, -2.55, 0.13, 0.01, 0.13); }
    dchair(-1.5, -3.1, 0, 'x+'); dchair(5.5, -3.1, 0, 'x-');
    for (const x of [1, 3]) { L.cyl('chrome', x, 0.9, -3.1, 0.05, 0.22, 0, 0, true); K.sph('lampWarm', x, 1.04, -3.1, 0.025); }
    for (let i = 0; i < 10; i++) { const a = i / 10 * 2 * PI; K.sph('lampWarm', 2 + Math.cos(a) * 0.55, 2.35 + (i % 2) * 0.08, -3.1 + Math.sin(a) * 0.35, 0.05); }
    L.pipe('yGold', 2, MW, -3.1, 2, 2.45, -3.1, 0.015); K.put('yGold', ringGeo(), 2, 2.42, -3.1, 0.6, 0.4, 0.2, 0, PI / 2);
    lamp(2, 2.2, -3.1, 0xffd8a8, 1.2, 8);
    L.box(0, 0, -0.65, 4, 0.9, -0.1, 'yWalnut', { top: 'yMarble' }); for (const x of [0.6, 3.4]) { L.cyl('chrome', x, 1.0, -0.4, 0.08, 0.2, 0, 0, true); K.sph('paintGreen', x, 1.25, -0.4, 0.2); }
    picture(A.seascape, 2, 1.9, -0.12, PI, 2.0, 1.0); picture(A.abstract, -3.88, 1.7, -4.9, PI / 2, 0.7, 0.9);
    // --- the galley: steel counters under the windows, the range and hood, the island, fridges, a rail of pans
    L.box(-3.8, 0, 5.45, 4.6, 0.92, 6.1, 'appliance', { top: 'steel' }); for (let x = -3.6; x < 4.4; x += 0.6) deco(x, 0.1, 5.44, x + 0.55, 0.85, 5.43, 'steel');
    deco(-1.6, 0.9, 5.55, -0.8, 0.93, 6.0, 'paintDark'); L.pipe('chrome', -1.2, 0.93, 6.0, -1.2, 1.3, 5.75, 0.02);
    L.box(1.2, 0, 5.3, 2.8, 0.95, 6.1, 'steel', { top: 'paintDark' }); for (const [dx, dz] of [[0.4, 0.2], [1.2, 0.2], [0.4, 0.5], [1.2, 0.5]]) L.cyl('paintDark', 1.2 + dx, 0.97, 5.5 + dz, 0.14, 0.03, 0, 0, true);
    L.box(1.1, 1.9, 5.3, 2.9, 2.3, 6.1, 'steel', { noCol: true }); deco(1.5, 2.3, 5.8, 2.5, MW, 6.1, 'steel');
    L.cyl('steel', 1.6, 1.08, 5.7, 0.15, 0.22, 0, 0, true); L.cyl('chrome', 2.4, 1.02, 5.6, 0.14, 0.1, 0, 0, true);
    L.box(0, 0, 2.4, 3.6, 0.92, 3.6, 'yWalnut', { top: 'yMarble' }); for (let i = 0; i < 4; i++) K.put('yWalnut', L.geo('box'), 0.4 + i * 0.9, 0.93, 3.0, 0.45, 0.03, 0.3, i * 0.4);
    deco(0.2, 0.92, 2.5, 0.9, 1.0, 2.9, 'paintGreen'); for (let i = 0; i < 5; i++) K.sph(i % 2 ? 'paintRed' : 'paintYellow', 2.9 + (i % 3) * 0.12, 1.0, 2.8 + (i / 3 | 0) * 0.12, 0.06);
    L.pipe('chrome', 0.2, 2.2, 3.0, 3.4, 2.2, 3.0, 0.02); for (let x = 0.5; x < 3.3; x += 0.5) { L.pipe('chrome', x, 2.2, 3.0, x, 1.9, 3.0, 0.008); L.cyl('steel', x, 1.8, 3.0, 0.14, 0.18, 0, 0, true); }
    for (let i = 0; i < 2; i++) { L.box(-3.85, 0, 0.15 + i * 0.9, -2.95, 2.1, 1.0 + i * 0.9, 'steel', { top: 'paintDark' }); deco(-2.96, 1.0, 0.25 + i * 0.9, -2.93, 1.9, 0.3 + i * 0.9, 'chrome'); }
    P('boxStack', -3.3, 2.4, 0.2); P('box', 5.9, 0.6, -0.3); P('crateSmall', 6.1, 1.9, 0.1);
    for (const x of [-2.5, 0.5, 3.5]) for (const z of [1.5, 4.5]) dl(x, MW, z);
    lamp(1, MW - 0.4, 3.2, 0xf1f4ff, 1.2, 9);
    L.addPickup('ammo', -2.2, 0, 3.6);
    // --- vestibule and foyer: a console, the front door onto the foredeck
    L.box(7.0, 0, -5.9, 7.8, 0.9, -4.3, 'yWalnut', { top: 'yMarble' }); K.sph('yNavy', 7.4, 1.15, -5.1, 0.2, 0.26, 0.2);
    pot(7.4, 5.4, 0, 1); pot(15.4, -1.0, 0, 0.8); pot(15.4, 1.0, 0, 0.8);
    for (const x of [9.5, 12, 14.5]) dl(x, MW, 0); lamp(12, MW - 0.4, 0, 0xffe2bc, 0.8, 6);
    // --- the gym: a treadmill, a bike, a bench, dumbbells, mirrors along the wall
    deco(8.3, 0.2, -1.62, 11.3, 2.4, -1.61, 'chrome'); deco(12.9, 0.2, -1.62, 15.6, 2.4, -1.61, 'chrome');
    for (const x of [9.2, 11]) {
      L.box(x - 0.4, 0, -5.6, x + 0.4, 0.22, -3.8, 'paintDark', { top: 'rubber' });
      for (const dx of [-0.35, 0.35]) L.pipe('paintGrey', x + dx, 0.22, -5.4, x + dx, 1.25, -5.55, 0.03);
      L.box(x - 0.4, 1.2, -5.8, x + 0.4, 1.35, -5.5, 'paintDark', { noCol: true }); deco(x - 0.25, 1.35, -5.72, x + 0.25, 1.37, -5.55, 'yScreen'); solid(x - 0.45, 0, -5.9, x + 0.45, 1.3, -3.8, 'metal');
    }
    L.box(12.6, 0, -3.8, 13.0, 0.45, -2.2, 'paintDark', { top: 'yLeather' }); L.pipe('chrome', 12.2, 1.1, -3.6, 13.4, 1.1, -3.6, 0.02); for (const x of [12.25, 13.35]) L.cyl('paintDark', x, 1.1, -3.6, 0.2, 0.05, 0, PI / 2, true);
    for (const z of [-3.9, -2.1]) L.pipe('paintDark', 12.8, 0, z, 12.8, 1.2, z, 0.025);
    L.box(12.2, 0, -5.9, 13.6, 0.8, -5.4, 'paintDark', { noCol: true }); for (let i = 0; i < 6; i++) { const x = 12.35 + i * 0.22; L.pipe('chrome', x, 0.55, -5.75, x, 0.55, -5.5, 0.02); L.cyl('paintDark', x, 0.55, -5.78, 0.05, 0.05, PI / 2, 0, true); L.cyl('paintDark', x, 0.55, -5.47, 0.05, 0.05, PI / 2, 0, true); }
    solid(12.2, 0, -5.9, 13.6, 0.8, -5.4, 'metal');
    for (let i = 0; i < 3; i++) deco(9.4 + i * 0.8, 0.006, -2.9, 10.0 + i * 0.8, 0.015, -1.9, i % 2 ? 'yTowel' : 'paintGreen');
    L.box(15.4, 0, -3.4, 15.9, 1.0, -2.4, 'appliance', { top: 'paintDark' }); for (let i = 0; i < 6; i++) L.cyl('glassDay', 15.55 + (i % 2) * 0.2, 0.3 + (i / 2 | 0) * 0.28, -3.2 + (i % 3) * 0.2, 0.035, 0.2, 0, 0, true);
    for (const [x, z] of [[10, -4], [13.5, -4]]) dl(x, MW, z); lamp(12, MW - 0.4, -4, 0xf1f4ff, 0.9, 7);
    // --- the owner's study: a partners' desk, a wall of books, a globe, a safe, club chairs
    L.box(10.4, 0, 3.6, 12.6, 0.76, 4.6, 'yWalnut', { top: 'yLeather' }); deco(10.9, 0.76, 3.9, 11.3, 0.78, 4.2, 'appliance'); L.cyl('yGold', 12.1, 0.9, 4.3, 0.06, 0.28, 0, 0, true); K.sph('lampWarm', 12.1, 1.1, 4.3, 0.1);
    dchair(11.5, 5.1, 0, 'z-');
    for (let i = 0; i < 4; i++) { const x0 = 8.25, z0 = 1.8 + i * 1.05; L.box(x0, 0, z0, x0 + 0.4, 2.6, z0 + 1.0, 'yWalnut'); for (let y = 0.3; y < 2.5; y += 0.45) for (let k = 0; k < 7; k++) deco(x0 + 0.4, y, z0 + 0.06 + k * 0.13, x0 + 0.42, y + 0.28 + (k % 3) * 0.04, z0 + 0.16 + k * 0.13, ['paintRed', 'yNavy', 'paintGreen', 'yGold', 'woodDark'][(i + k) % 5]); }
    L.cyl('yWalnut', 9.4, 0.45, 2.3, 0.05, 0.9, 0, 0, true); K.sph('yTowel', 9.4, 1.15, 2.3, 0.32); K.put('yGold', ringGeo(), 9.4, 1.15, 2.3, 0.36, 0.36, 0.2, 0.4); solid(9.1, 0, 2.0, 9.7, 1.45, 2.6);
    L.box(15.3, 0, 2.2, 15.9, 0.9, 2.9, 'paintDark', { top: 'paintGrey' }); L.cyl('chrome', 15.28, 0.5, 2.55, 0.1, 0.03, 0, PI / 2, true);
    sofa(12.9, 2.1, 13.8, 3.0, 0, 'x+', 'leather'); sofa(10.1, 2.1, 11.0, 3.0, 0, 'x-', 'leather');
    picture(A.seascape, 9.8, 1.8, 1.62, 0, 1.4, 0.7);
    for (const [x, z] of [[10, 4], [13.5, 4]]) dl(x, MW, z); lamp(12, MW - 0.4, 4, 0xffe2bc, 0.9, 7);
    L.addPickup('ammo', 13.5, 0, 5.4);
  }

  // ------------------------------------------------------------ the upper deck: slab, rails, the aft deck, sky lounge, captain, radio room, bridge
  function upperDeck(rnd) {
    const A = art();
    K.holeSpans(UA, UF, -7.9, 7.9, [[-8.8, -4.4, 1.4, 3.6]], (x0, x1, z0, z1) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) L.box(x0, MW, z0, x1, UD, z1, 'ceiling', { top: 'yTeak', side: 'yWhite' }); });
    // a white fascia round the edge of the slab
    for (const s of [-1, 1]) deco(UA, MW - 0.25, s * 7.9 - 0.02, UF, UD, s * 7.9 + 0.02, 'yWhite');
    deco(UA - 0.02, MW - 0.25, -7.9, UA + 0.02, UD, 7.9, 'yWhite'); deco(UF - 0.02, MW - 0.25, -7.9, UF + 0.02, UD, 7.9, 'yWhite');
    // rails: sides over the sea (with walls to the sky), aft over the pool deck, forward over the bow
    for (const s of [-1, 1]) glassRail('x', UA, UF, s * 7.85, UD, true);
    glassRail('z', -7.9, -7.7, UA + 0.05, UD); glassRail('z', -6.3, 6.3, UA + 0.05, UD); glassRail('z', 7.7, 7.9, UA + 0.05, UD);
    glassRail('z', -7.9, 2.8, UF - 0.05, UD); glassRail('z', 4.2, 7.9, UF - 0.05, UD);
    glassRail('x', -8.8, -4.4, 1.35, UD); glassRail('x', -8.8, -4.4, 3.65, UD); glassRail('z', 1.4, 3.6, -8.85, UD);
    // the stair up from the bow
    steps('x', UF, 22.8, 2.8, 4.2, MD, UD, -1, 'yWhite', 'yTeak', 'chrome');
    slopeGuard('x', UF, 22.8, 2.8, MD, UD, -1); slopeGuard('x', UF, 22.8, 4.2, MD, UD, -1);
    // columns under the aft corners of the slab
    for (const s of [-1, 1]) { L.cyl('chrome', UA + 0.35, MW / 2, s * 6.05, 0.09, MW, 0, 0, true); W.addCyl(UA + 0.35, s * 6.05, 0.1, 0, MW, { surf: 'metal' }); }
    // --- the house
    const LOU = [[UD, UD + 0.12, 'yWalnut'], [UD + 0.12, UW - 0.2, 'yPanel'], [UW - 0.2, UW, 'yWalnut']], HALL = [[UD, UD + 0.12, 'yWalnut'], [UD + 0.12, UW, 'yMarble']];
    const CAP = [[UD, UD + 0.9, 'yWalnut'], [UD + 0.9, UW, 'wallpaper2']], RAD = [[UD, UW, 'panelWhite']], BRI = [[UD, UD + 1.0, 'paintDark'], [UD + 1.0, UW, 'yPanel']];
    const W1 = (a0, a1, lo, hi) => [a0, a1, UD + (lo || 0.9), UD + (hi || 2.6)];
    for (const s of [-1, 1]) {
      house('x', UX0, UX1, s * UZ, UD, UW, [W1(-21.2, -17.2), W1(-16.8, -13), [-12.4, -11.3, UD, UD + 2.3], W1(-9, -4), W1(-1.4, 2.2, 1.0, 2.4), [3.4, 4.4, UD, UD + 2.3], W1(4.8, 9.6, 0.9, 2.8)], s,
        [[UX0, -10, LOU], [-10, -2, HALL], [-2, 3, s < 0 ? CAP : RAD], [3, UX1, BRI]]);
      K.put('panelOrange', ringGeo(), -9.7, UD + 1.5, s * (UZ + 0.14), 0.3, 0.3, 0.3);
      for (let x = UX0 + 1; x < UX1; x += 3) K.sph('lampWarm', x, UD + 0.25, s * (UZ + 0.13), 0.04, 0.04, 0.02);
      // life-raft canisters in cradles on the side decks
      for (const x of [-19.6, -17.8]) { L.cyl('yWhite', x, UD + 0.45, s * 7.1, 0.34, 1.2, PI / 2, 0, false); for (const d of [-0.4, 0.4]) L.cyl('paintDark', x, UD + 0.45, s * 7.1 + d, 0.36, 0.06, PI / 2, 0, false); deco(x - 0.3, UD, s * 7.1 - 0.6, x + 0.3, UD + 0.12, s * 7.1 + 0.6, 'steel'); }
      solid(-20.1, UD, s * 7.1 - 0.62, -17.3, UD + 0.8, s * 7.1 + 0.62, 'metal');
      // navigation lights on the bridge wings: red to port, green to starboard
      deco(UX1 - 0.4, UD + 2.9, s * (UZ + 0.1) - 0.1, UX1 - 0.1, UD + 3.05, s * (UZ + 0.1) + 0.1, 'yWhite'); K.sph(s < 0 ? 'lampRed' : 'lampGreen', UX1 - 0.25, UD + 2.85, s * (UZ + 0.1), 0.08);
    }
    house('z', -UZ + T / 2, UZ - T / 2, UX0, UD, UW, [[-1, 1, UD, UD + 2.4], W1(-4.6, -1.6, 0.5), W1(1.6, 4.6, 0.5)], -1, [[-UZ + T / 2, UZ - T / 2, LOU]]);
    house('z', -UZ + T / 2, UZ - T / 2, UX1, UD, UW, [W1(-4.8, 4.8, 1.0, 2.9)], 1, [[-UZ + T / 2, UZ - T / 2, BRI]]);
    const inner = UZ - T / 2;
    part('z', -inner, -1, -2, UD, UW, [], HALL, CAP); part('z', -1, 1, -2, UD, UW, [[-1, 1, UD, UD + 2.4]], HALL, HALL); part('z', 1, inner, -2, UD, UW, [], HALL, RAD);
    part('x', -1.9, 2.9, -1, UD, UW, [[0, 0.9, UD, UD + 2.3]], CAP, HALL); part('x', -1.9, 2.9, 1, UD, UW, [[0, 0.9, UD, UD + 2.3]], HALL, RAD);
    part('z', -inner, -1, 3, UD, UW, [], CAP, BRI); part('z', -1, 1, 3, UD, UW, [[-0.7, 0.7, UD, UD + 2.3]], HALL, BRI); part('z', 1, inner, 3, UD, UW, [], RAD, BRI);
    floor(UX0 + 0.1, -inner, -10, inner, UD, 'yCarpet'); floor(-10, -inner, -2.1, inner, UD, 'yMarble', [[-8.8, -4.4, 1.4, 3.6]]);
    floor(-1.9, -inner, 2.9, -1.1, UD, 'yCarpet'); floor(-1.9, 1.1, 2.9, inner, UD, 'floorWood'); floor(-1.9, -0.9, 2.9, 0.9, UD, 'yMarble'); floor(3.1, -inner, UX1 - 0.1, inner, UD, 'carpetBlue');
    K.plane(A.bridge, 0.9, 0.28, 2.88, UD + 2.45, 0, -PI / 2);
    // --- the upper aft deck: an outdoor dining table for eight, the barbecue, coolers, planters
    L.box(-27.5, UD + 0.72, -1.1, -24.5, UD + 0.76, 1.1, 'glassClear', { noCol: true, ao: false }); for (const x of [-27, -25]) L.pipe('chrome', x, UD, 0, x, UD + 0.72, 0, 0.05);
    solid(-27.5, UD, -1.1, -24.5, UD + 0.76, 1.1);
    for (let i = 0; i < 3; i++) { const x = -27 + i; dchair(x, -1.6, UD, 'z+', 'yCanvas'); dchair(x, 1.6, UD, 'z-', 'yCanvas'); }
    dchair(-28, 0, UD, 'x+', 'yCanvas'); dchair(-24, 0, UD, 'x-', 'yCanvas');
    P('grill', -30, -4.3, 0.3, UD); P('cooler', -23.2, -2.6, -0.2, UD); P('cooler', -23.2, 2.6, 0.4, UD);
    pot(-30.4, -1.8, UD, 0.9); pot(-30.4, 1.8, UD, 0.9); pot(-22.5, -6.2, UD, 1); pot(-22.5, 6.2, UD, 1);
    for (const [x, z] of [[-29, -3], [-29, 3], [-25, -3], [-25, 3]]) dl(x, UW, z);
    L.addPickup('ammo', -29.5, UD, -6.5);
    // --- the sky lounge: the bar, the poker table, two slot machines, the sofa corner
    L.box(-16.6, UD, -4.1, -13, UD + 1.1, -3.5, 'yWalnut', { top: 'yMarble' }); deco(-16.6, UD + 0.15, -3.48, -13, UD + 0.2, -3.44, 'yGold');
    L.box(-16.8, UD, -5.08, -12.8, UD + 0.95, -4.6, 'yWalnut', { top: 'yMarble' });
    for (const y of [UD + 1.35, UD + 1.8]) { deco(-16.7, y - 0.03, -5.08, -12.9, y, -4.75, 'glassClear'); bottles(-16.6, -13, y, -4.9, rnd); }
    for (let i = 0; i < 3; i++) P('stool', -16 + i * 1.1, -2.95, 0, UD);
    L.cyl('yWalnut', -18, UD + 0.74, 2.4, 1.0, 0.06, 0, 0, false); L.cyl('yFelt', -18, UD + 0.775, 2.4, 0.86, 0.01, 0, 0, false); L.cyl('paintDark', -18, UD + 0.37, 2.4, 0.18, 0.74, 0, 0, true); L.cyl('paintDark', -18, UD + 0.03, 2.4, 0.5, 0.06, 0, 0, true);
    W.addCyl(-18, 2.4, 1.0, UD, UD + 0.78);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI, cx = -18 + Math.cos(a) * 1.35, cz = 2.4 + Math.sin(a) * 1.35; dchair(cx, cz, UD, Math.abs(Math.cos(a)) > 0.7 ? (Math.cos(a) > 0 ? 'x-' : 'x+') : (Math.sin(a) > 0 ? 'z-' : 'z+'));
      for (let k = 0; k < 3; k++) L.cyl(['paintRed', 'yWhite', 'yNavy'][k], -18 + Math.cos(a) * 0.62 + k * 0.07, UD + 0.79 + k * 0.012, 2.4 + Math.sin(a) * 0.62, 0.035, 0.03 + k * 0.02, 0, 0, true); }
    for (let i = 0; i < 5; i++) K.put('yWhite', L.geo('box'), -18.2 + i * 0.1, UD + 0.785, 2.3 + (i % 2) * 0.05, 0.09, 0.004, 0.13, i * 0.3);
    lamp(-18, UW - 0.5, 2.4, 0xffd8a8, 1.2, 7); L.pipe('chrome', -18, UW, 2.4, -18, UW - 0.6, 2.4, 0.01); K.put('yGold', L.geo('cone'), -18, UW - 0.7, 2.4, 0.35, 0.25, 0.35);
    for (let i = 0; i < 2; i++) {
      const x = -15.6 + i * 1.0; L.box(x - 0.4, UD, 4.5, x + 0.4, UD + 1.5, 5.08, 'paintDark', { top: 'yGold' }); screen(A.slot, 0.6, 0.6, x, UD + 1.15, 4.49, PI);
      L.pipe('chrome', x + 0.45, UD + 1.0, 4.8, x + 0.45, UD + 1.4, 4.8, 0.02); K.sph('paintRed', x + 0.45, UD + 1.42, 4.8, 0.05); K.sph('lampAmber', x, UD + 1.62, 4.8, 0.08);
    }
    sofa(-21.8, -4.95, -21.0, -1.8, UD, 'x-'); sofa(-21.0, -4.95, -18.6, -4.15, UD, 'z-'); coffeeTable(-20.6, -3.6, -19.2, -2.2, UD, 'yMarble');
    floor(-21.9, -5.0, -18, -1.6, UD + 0.006, 'rug');
    pot(-21.5, 4.6, UD, 1); pot(-10.6, -4.6, UD, 1);
    picture(A.abstract, -21.88, UD + 1.7, 2.6, PI / 2, 0.8, 1.0);
    for (let x = -20.5; x < -10.5; x += 3) for (const z of [-3, 0, 3]) dl(x, UW, z);
    lamp(-14, UW - 0.4, -1, 0xffe2bc, 1.0, 9);
    L.addPickup('armor', -12.2, UD, 3.8);
    // --- the stair hall: a sculpture, a bench
    L.box(-3.2, UD, -4.9, -2.3, UD + 0.45, -3.1, 'yWalnut', { top: 'yLeather' });
    L.box(-5.2, UD, -4.9, -4.6, UD + 0.9, -4.3, 'yMarble'); K.put('yGold', L.geo('torus'), -4.9, UD + 1.4, -4.6, 0.35, 0.35, 1.2, 0.5, 0.3); K.put('yGold', L.geo('torus'), -4.9, UD + 1.4, -4.6, 0.25, 0.25, 1.2, 1.4, 1.1);
    for (const [x, z] of [[-7, -3], [-7, 0], [-4, 0], [-4, 3]]) dl(x, UW, z); lamp(-6, UW - 0.4, -1.5, 0xffe2bc, 0.8, 7);
    // --- the captain's cabin: a berth, a desk, a wardrobe
    K.bed(0.1, -5.05, 2.9, -3.3, UD, 'x+'); L.box(-1.9, UD, -4.9, -1.2, UD + 0.76, -3.5, 'yWalnut'); dchair(-0.9, -4.2, UD, 'x-');
    L.box(-1.9, UD, -3.2, -1.3, UD + 2.1, -1.2, 'yWalnut'); K.plane(A.chart, 1.2, 0.6, 1.0, UD + 1.7, -1.12, 0);
    dl(0.5, UW, -3); lamp(0.5, UW - 0.4, -3, 0xffe2bc, 0.7, 5);
    // --- the radio room: sets on the desk, a chair, the safe; the hijackers' guns and ammo crates dumped here
    L.box(-1.6, UD, 4.5, 2.4, UD + 0.76, 5.08, 'paintGrey', { top: 'paintDark' });
    for (let i = 0; i < 4; i++) { const x = -1.2 + i * 0.95; L.box(x - 0.35, UD + 0.76, 4.65, x + 0.35, UD + 1.1, 5.05, 'plateOlive', { noCol: true }); for (let k = 0; k < 4; k++) K.sph(k % 2 ? 'lampAmber' : 'lampGreen', x - 0.24 + k * 0.16, UD + 1.02, 4.64, 0.02); deco(x - 0.25, UD + 0.82, 4.64, x + 0.05, UD + 0.95, 4.645, 'yScreen'); }
    L.pipe('paintDark', 0.2, UD + 1.1, 4.9, 0.2, UD + 1.5, 4.8, 0.01); K.sph('paintDark', 0.2, UD + 1.55, 4.8, 0.06);
    dchair(0.2, 3.9, UD, 'z+'); P('crate', 2.3, 2.1, 0.15, UD); P('crateSmall', 1.9, 3.3, -0.2, UD);
    L.box(-1.9, UD, 1.2, -1.2, UD + 1.0, 1.9, 'paintDark', { top: 'paintGrey' });
    dl(0.5, UW, 3); lamp(0.5, UW - 0.4, 3, 0xf1f4ff, 0.7, 5);
    // --- the bridge: the helm console with its screens, the wheel, two captain's chairs, the chart table, the overhead
    L.box(8.4, UD, -3.8, 9.7, UD + 1.0, 3.8, 'paintDark', { top: 'yBlack' });
    screen(A.radar, 0.8, 0.8, 8.75, UD + 1.25, -2.4, -PI / 2, 0.5); screen(A.chart, 1.4, 0.7, 8.75, UD + 1.25, -1.0, -PI / 2, 0.5);
    screen(A.engines, 1.4, 0.7, 8.75, UD + 1.25, 1.0, -PI / 2, 0.5); screen(A.radar, 0.8, 0.8, 8.75, UD + 1.25, 2.4, -PI / 2, 0.5);
    for (let i = 0; i < 12; i++) K.sph(i % 3 ? 'lampGreen' : 'lampAmber', 8.45, UD + 0.95, -3.4 + i * 0.6, 0.02);
    L.cyl('chrome', 8.2, UD + 0.9, 0, 0.06, 0.4, 0, PI / 2, true); K.put('yWalnut', L.geo('torus'), 8.0, UD + 0.95, 0, 0.35, 0.35, 0.8, PI / 2);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; L.pipe('yWalnut', 8.0, UD + 0.95, 0, 8.0, UD + 0.95 + Math.sin(a) * 0.42, Math.cos(a) * 0.42, 0.015); }
    for (const z of [0.5, 0.65]) { L.pipe('chrome', 8.5, UD + 1.0, z + 0.4, 8.35, UD + 1.15, z + 0.4, 0.015); K.sph('paintDark', 8.35, UD + 1.16, z + 0.4, 0.035); }
    for (const z of [-1.3, 1.3]) {
      L.cyl('chrome', 7.0, UD + 0.35, z, 0.08, 0.7, 0, 0, true); L.cyl('chrome', 7.0, UD + 0.03, z, 0.3, 0.06, 0, 0, true);
      L.box(6.7, UD + 0.7, z - 0.3, 7.3, UD + 0.85, z + 0.3, 'paintDark', { noCol: true }); deco(6.6, UD + 0.85, z - 0.3, 6.72, UD + 1.6, z + 0.3, 'paintDark');
      solid(6.6, UD, z - 0.32, 7.35, UD + 1.6, z + 0.32);
    }
    L.box(5.2, UD, -4.9, 6.9, UD + 0.95, -4.0, 'yWalnut', { top: 'yWalnut' }); K.plane(A.chart, 1.5, 0.8, 6.05, UD + 0.96, -4.45, 0, {}).rotation.x = -PI / 2;
    L.box(8.6, UW - 0.5, -4.6, 9.9, UW, 4.6, 'paintDark', { noCol: true }); for (let i = 0; i < 5; i++) screen(A.engines, 0.7, 0.35, 8.58, UW - 0.25, -3.6 + i * 1.8, -PI / 2);
    for (const [x, z] of [[5, -2.5], [5, 2.5], [7.5, 0]]) dl(x, UW, z); lamp(6, UW - 0.4, 0, 0xc8d8ff, 0.8, 8);
    L.addPickup('ammo', 5.5, UD, 3.8);
    // --- the deck over the bow, in front of the bridge: a pair of deck lockers, a searchlight
    for (const z of [-5.6, -2.2]) { L.box(12.4, UD, z - 0.9, 14.6, UD + 0.75, z + 0.9, 'yWhite', { top: 'yTeak' }); deco(12.38, UD + 0.3, z - 0.6, 12.4, UD + 0.34, z + 0.6, 'chrome'); }
    L.cyl('paintDark', 15.4, UD + 0.5, -6.6, 0.12, 1.0, 0, 0, true); K.put('yWhite', L.geo('cyl'), 15.4, UD + 1.2, -6.6, 0.28, 0.5, 0.28, 0, 0, PI / 2); deco(15.66, UD + 1.0, -6.85, 15.68, UD + 1.4, -6.35, 'lampWarm');
    W.addCyl(15.4, -6.6, 0.3, UD, UD + 1.45, { surf: 'metal' });
    L.addPickup('ammo', 13.5, UD, 3.5);
  }

  // ------------------------------------------------------------ the sun deck: hot tub, loungers, bar, radar arch
  function sunDeck(rnd) {
    L.box(SA, UW, -SZ, SF, SD, SZ, 'ceiling', { top: 'yTeak', side: 'yWhite' });
    for (const s of [-1, 1]) glassRail('x', SA, SF, s * (SZ - 0.05), SD);
    glassRail('z', -SZ, -4.9, SA + 0.05, SD); glassRail('z', -3.6, 3.6, SA + 0.05, SD); glassRail('z', 4.9, SZ, SA + 0.05, SD);
    glassRail('z', -SZ, SZ, SF - 0.05, SD);
    for (const s of [-1, 1]) {
      steps('x', -28, SA, s * 3.6, s * 4.9, UD, SD, 1, 'yWhite', 'yTeak', 'chrome');
      slopeGuard('x', -28, SA, s * 3.6, UD, SD, 1); slopeGuard('x', -28, SA, s * 4.9, UD, SD, 1);
    }
    // the hot tub: a raised white drum, bubbling blue water, a grab rail, towels
    const hx = -17, hz = 0;
    L.cyl('yWhite', hx, SD + 0.35, hz, 1.95, 0.7, 0, 0, false); K.put('yTeak', K.discGeo(1.75, 2.0, 0.25), hx, SD + 0.712, hz, 1, 1, 1);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.75, 40), new THREE.MeshStandardMaterial({ color: 0x3fd0e8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, normalMap: TEX.tubWaves || (TEX.tubWaves = TEX.waves.clone()), normalScale: new THREE.Vector2(1.2, 1.2) }));
    TEX.tubWaves.needsUpdate = true;
    water.rotation.x = -PI / 2; water.position.set(hx, SD + 0.706, hz); L.scene.add(water);
    const bub = []; for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(L.geo('sphere'), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.7 })); b.scale.setScalar(0.03 + (i % 3) * 0.015); L.scene.add(b); bub.push({ b, a: i * 2.4, r: 0.3 + (i % 5) * 0.3, s: 0.6 + (i % 4) * 0.3 }); }
    L.animated.push((dt, t) => { water.material.normalMap.offset.set(t * 0.08, t * 0.05); for (const q of bub) { const k = (t * q.s + q.a) % 1; q.b.position.set(hx + Math.cos(q.a + t * 0.3) * q.r, SD + 0.71 + k * 0.03, hz + Math.sin(q.a + t * 0.3) * q.r); q.b.material.opacity = 0.7 * (1 - k); } });
    W.addCyl(hx, hz, 1.95, SD, SD + 0.72, { surf: 'metal' });
    L.pipe('chrome', hx + 1.4, SD + 0.72, hz - 1.4, hx + 1.4, SD + 1.2, hz - 1.4, 0.02); L.pipe('chrome', hx + 1.4, SD + 1.2, hz - 1.4, hx + 1.9, SD + 1.2, hz - 1.4, 0.02);
    for (const [x, z, m] of [[hx - 2.4, -1.2, 'yTowel'], [hx - 2.4, -0.4, 'yTowel2']]) deco(x - 0.25, SD, z - 0.3, x + 0.25, SD + 0.12, z + 0.3, m);
    lamp(hx, SD + 1.2, hz, 0x60d8ff, 0.8, 5);
    // six loungers in two rows, a shade canopy over them
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) lounger(-10.5 + i * 2.6, s * 3.2, SD, s > 0 ? 1 : -1, i === 1 ? 'yTowel2' : (s > 0 ? 'yTowel' : null));
    for (const [x, z] of [[-11.8, -4.6], [-11.8, 4.6], [-4.4, -4.6], [-4.4, 4.6]]) { L.cyl('chrome', x, SD + 1.3, z, 0.04, 2.6, 0, 0, true); W.addCyl(x, z, 0.06, SD, SD + 2.6, { surf: 'metal' }); }
    L.box(-12, SD + 2.6, -4.8, -4.2, SD + 2.64, 4.8, 'yCanvas', { noCol: true, bottom: true, ao: false });
    // the wet bar forward to port: counter, stools, a fridge, the barbecue
    L.box(-1.5, SD, -4.9, 1.5, SD + 1.05, -4.2, 'yWhite', { top: 'yMarble' }); deco(-1.5, SD + 0.1, -4.18, 1.5, SD + 0.14, -4.15, 'chrome');
    for (let i = 0; i < 3; i++) P('stool', -1 + i, -3.6, 0, SD);
    L.box(-1.4, SD, -5.5, 1.4, SD + 0.9, -5.2, 'yWhite', { top: 'yMarble' }); bottles(-1.3, 0.2, SD + 0.9, -5.35, rnd);
    P('grill', 1.2, 3.8, -0.4, SD); P('cooler', -1.0, 4.6, 0.3, SD); pot(-21.4, -4.9, SD, 0.9); pot(-21.4, 4.9, SD, 0.9);
    // the radar arch: two raked legs and a crosshead, domes, a spinning open-array radar, antennas, the horn
    const AX = 4.2, AH = SD + 2.9;
    for (const s of [-1, 1]) {
      K.put('yWhite', K.extrude('yArchLeg', [[-0.9, 0], [0.5, 0], [0.9, 2.9], [-0.1, 2.9]], 0.5, 0.04), AX, SD, s * 4.7, 1, 1, 1);
      solid(AX - 0.9, SD, s * 4.7 - 0.25, AX + 0.9, AH, s * 4.7 + 0.25, 'metal');
    }
    L.box(AX - 0.1, AH, -4.95, AX + 0.9, AH + 0.35, 4.95, 'yWhite', { noCol: true, bottom: true });
    for (const z of [-2.6, 2.6]) { L.cyl('yWhite', AX + 0.4, AH + 0.55, z, 0.15, 0.4, 0, 0, true); K.sph('yWhite', AX + 0.4, AH + 1.15, z, 0.6); }
    L.cyl('paintDark', AX + 0.4, AH + 0.5, 0, 0.2, 0.3, 0, 0, true);
    const radar = new THREE.Group(); radar.position.set(AX + 0.4, AH + 0.75, 0); L.scene.add(radar);
    const rbar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 2.6), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.3 })); rbar.castShadow = true; radar.add(rbar);
    L.animated.push((dt, t) => { radar.rotation.y = t * 2.4; });
    for (const z of [-4.2, -1.2, 1.2, 4.2]) L.pipe(z > 0 ? 'yWhite' : 'steel', AX + 0.4, AH + 0.35, z, AX + 0.4, AH + 2.2 + Math.abs(z) * 0.2, z, 0.025);
    K.sph('lampWarm', AX + 0.4, AH + 3.1, 1.2, 0.06); K.sph('lampWarm', AX + 0.8, AH + 0.2, 0, 0.07);
    L.cyl('chrome', AX + 0.95, AH + 0.2, -1.6, 0.1, 0.5, 0, PI / 2, true);
    // on the bridge roof ahead of the arch: a stowed crane davit for the tenders, a spot of shade for the crew
    L.cyl('yWhite', 8.2, SD + 0.6, 3.6, 0.22, 1.2, 0, 0, true); L.pipe('yWhite', 8.2, SD + 1.2, 3.6, 6.2, SD + 1.5, 3.6, 0.12); L.pipe('steel', 6.2, SD + 1.5, 3.6, 6.2, SD + 0.9, 3.6, 0.015); K.sph('paintDark', 6.2, SD + 0.85, 3.6, 0.08);
    W.addCyl(8.2, 3.6, 0.25, SD, SD + 1.25, { surf: 'metal' });
    for (const [x, z] of [[-8, -2], [-6, 2], [2, 0]]) dl(x, SD + 2.6, z);
    L.addPickup('armor', -8, SD, 0); L.addPickup('ammo', 7, SD, -3.5);
  }

  // ------------------------------------------------------------ the bow: helipad markings, windlasses, rail, the forward hatch
  function foredeck(rnd) {
    const cx = (PX0 + PX1) / 2, y = PAD;
    K.put('lineWhite', K.discGeo(4.55, 4.95, 0.25), cx, y + 0.008, 0, 1, 1, 1);
    deco(cx - 1.6, y, -1.25, cx + 1.6, y + 0.006, -0.8, 'lineWhite'); deco(cx - 1.6, y, 0.8, cx + 1.6, y + 0.006, 1.25, 'lineWhite'); deco(cx - 0.22, y, -0.8, cx + 0.22, y + 0.006, 0.8, 'lineWhite');
    for (const s of [-1, 1]) {
      strip('paintYellow', PX0 + 0.2, PX1 - 0.2, y + 0.004, (x) => s > 0 ? hwIn(x) - 0.45 : -(hwIn(x) - 0.3), (x) => s > 0 ? hwIn(x) - 0.3 : -(hwIn(x) - 0.45), 0.5);
      for (let x = PX0 + 0.6; x < PX1; x += 1.6) K.sph('lampGreen', x, y + 0.02, s * (hwIn(x) - 0.62), 0.05, 0.03, 0.05);
    }
    deco(PX0 + 0.2, y, -hwIn(PX0) + 0.3, PX0 + 0.35, y + 0.004, hwIn(PX0) - 0.3, 'paintYellow'); deco(PX1 - 0.35, y, -hwIn(PX1) + 0.3, PX1 - 0.2, y + 0.004, hwIn(PX1) - 0.3, 'paintYellow');
    // stanchions and a double rail along the bow, meeting in the pulpit
    const side = (s) => { const pts = []; for (let x = HB; x <= BOW - 0.8; x += 1.5) pts.push([x, s * (hwIn(x) - 0.05)]); return pts; };
    for (const s of [-1, 1]) {
      const pts = side(s);
      for (const [x, z] of pts) L.pipe('chrome', x, 1.05, z, x, 1.95, z, 0.025);
      for (let i = 0; i < pts.length - 1; i++) for (const yy of [1.5, 1.95]) L.pipe('chrome', pts[i][0], yy, pts[i][1], pts[i + 1][0], yy, pts[i + 1][1], yy > 1.9 ? 0.03 : 0.02);
      const last = pts[pts.length - 1]; for (const yy of [1.5, 1.95]) L.pipe('chrome', last[0], yy, last[1], BOW - 0.2, yy, 0, yy > 1.9 ? 0.03 : 0.02);
    }
    L.pipe('chrome', BOW - 0.2, 1.05, 0, BOW - 0.2, 2.8, 0, 0.03); K.sph('yGold', BOW - 0.2, 2.85, 0, 0.06);
    // the windlasses, their chains to the hawse pipes and down into the locker, bollards
    for (const s of [-1, 1]) {
      const z = s * 1.6;
      L.box(39.3, 0, z - 0.5, 40.9, 0.3, z + 0.5, 'paintDark', { top: 'steel', noCol: true });
      L.cyl('paintGreen', 40.1, 0.62, z, 0.34, 0.6, PI / 2, 0, false); L.cyl('steel', 40.1, 0.62, z - s * 0.4, 0.4, 0.12, PI / 2, 0, false);
      L.cyl('paintDark', 40.1, 0.98, z, 0.18, 0.12, 0, 0, true); K.sph('steel', 40.1, 1.06, z, 0.12);
      solid(39.3, 0, z - 0.55, 40.9, 1.1, z + 0.55, 'metal');
      const hz = s * (hwIn(42.8) - 0.1), a = [40.3, 0.55, z - s * 0.4], b = [42.8, 0.3, hz], d = Math.hypot(b[0] - a[0], b[2] - a[2]), ry = Math.atan2(b[0] - a[0], b[2] - a[2]);
      for (let i = 0, n = Math.round(d / 0.11); i <= n; i++) { const k = i / n, p = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 0.02, a[2] + (b[2] - a[2]) * k]; if (i % 2) K.put('paintDark', ringGeo(), p[0], p[1], p[2], 0.08, 0.08, 0.08, ry - PI / 2); else K.put('paintDark', ringGeo(), p[0], p[1], p[2], 0.08, 0.08, 0.08, 0, PI / 2); }
      L.cyl('steel', 42.8, 0.18, hz, 0.22, 0.36, 0, 0, true); L.cyl('paintDark', 39.2, 0.04, z, 0.18, 0.08, 0, 0, true);
      for (const x of [37.9 + 0.4, 43.8]) { const zz = s * (hwIn(x) - 0.4); for (const dx of [-0.2, 0.2]) { L.cyl('steel', x + dx, 0.18, zz, 0.08, 0.36, 0, 0, true); L.cyl('steel', x + dx, 0.37, zz, 0.11, 0.04, 0, 0, true); } solid(x - 0.3, 0, zz - 0.12, x + 0.3, 0.4, zz + 0.12, 'metal'); }
      K.put('yRope', ringGeo(), 41.5, 0.06, s * 3.6, 0.35, 0.35, 0.35, 0, PI / 2); K.put('yRope', ringGeo(), 41.5, 0.12, s * 3.6, 0.3, 0.3, 0.35, 0, PI / 2);
    }
    L.box(38.5, 0, -0.35, 39.0, 0.12, 0.35, 'steel'); for (const z of [-0.2, 0.2]) L.cyl('paintDark', 38.75, 0.13, z, 0.1, 0.02, 0, 0, true);
    // the forward hatch down to the master suite: a stair, rails, the lid swung up
    steps('z', -3, 2, 18, 19.4, LD, MD, -1, 'yWhite', 'yTeak', 'chrome');
    rail('z', -3, 2, 17.95, MD); rail('z', -3, 2, 19.45, MD); rail('x', 18, 19.4, 2.05, MD);
    L.box(18, 0, 2.2, 19.4, 1.5, 2.3, 'yWhite', { noCol: true }); solid(18, 0, 2.15, 19.4, 1.5, 2.35, 'metal');
    for (const x of [18, 19.4]) L.box(x - 0.08, LD, -3, x + 0.08, -0.3, 2, 'yWhite', { noCol: true });
    // a sun pad to port, a deck locker to starboard, a fender basket
    L.box(19.6, 0, -6.2, 22.2, 0.38, -3.8, 'yWhite', { noCol: true }); deco(19.65, 0.38, -6.15, 22.15, 0.52, -3.85, 'yCanvas'); for (const z of [-5.6, -4.4]) deco(21.7, 0.52, z - 0.35, 22.05, 0.64, z + 0.35, 'yNavy');
    solid(19.6, 0, -6.2, 22.2, 0.52, -3.8);
    L.box(20.2, 0, 5.2, 22.2, 0.8, 6.6, 'yWhite', { top: 'yTeak' }); deco(20.18, 0.35, 5.5, 20.2, 0.39, 6.3, 'chrome');
    for (let i = 0; i < 3; i++) { L.cyl('yNavy', 25.0 - 0.6 + i * 0.3, PAD + 0.3, 6.1 - (i % 2) * 0.1, 0.12, 0.6, 0, 0, true); } solid(24.2, PAD, 5.9, 25.2, PAD + 0.6, 6.3, 'metal');
    L.addPickup('ammo', 41.5, 0, 0); L.addPickup('ammo', 21, 0, 1.2);
  }

  // ------------------------------------------------------------ the lower deck: engine room, cabins, crew, the master suite
  function lowerDeck(rnd) {
    const A = art();
    const CEIL = -0.3;
    const CAB = [[LD, LD + 0.1, 'yWalnut'], [LD + 0.1, CEIL, 'yPanel']], COR = [[LD, LD + 0.1, 'yWalnut'], [LD + 0.1, LD + 1.0, 'yWalnut'], [LD + 1.0, CEIL, 'yPanel']];
    const ENG = [[LD, CEIL, 'panelWhite']], CREW = [[LD, CEIL, 'wallClean']], MAS = [[LD, LD + 1.0, 'yWalnut'], [LD + 1.0, LD + 1.05, 'yGold'], [LD + 1.05, CEIL, 'wallpaper']], BATH = [[LD, CEIL, 'yMarble']];
    L.box(LX0, LD - 0.3, -LZ, 20, LD, LZ, 'ceiling', { top: 'yCarpet' });
    L.box(20, LD - 0.3, -5, 29.5, LD, 5, 'ceiling', { top: 'yCarpet' });
    // outer walls: both faces take the room's lining (the outer face is hidden against the hull)
    const outer = (a0, a1, c, bands, sd) => lining('x', a0, a1, c, LD, CEIL, [], bands, sd);
    for (const s of [-1, 1]) {
      const zc = s * LZ;
      outer(LX0, -18, zc, ENG, -s); outer(-18, -11, zc, CAB, -s); outer(-11, -3, zc, s < 0 ? COR : CAB, -s); outer(-3, 6, zc, s < 0 ? CAB : CREW, -s); outer(6, 14, zc, CREW, -s); outer(14, 20, zc, COR, -s);
      lining('x', LX0 - T / 2, 20, zc, LD, CEIL, [], [[LD, CEIL, 'paintGrey']], s);
      lining('x', 20, 29.5, s * 5, LD, CEIL, [], MAS, -s); lining('x', 20, 29.6, s * 5, LD, CEIL, [], [[LD, CEIL, 'paintGrey']], s);
      // porthole lights on the inside of the outer walls
      for (let x = -16; x <= 12; x += 2.4) { if (x > -11.5 && x < -2.5 && s < 0) continue; K.put('chrome', L.geo('cyl'), x, LD + 1.55, zc - s * 0.105, 0.2, 0.02, 0.2, 0, PI / 2); K.put('yPort', L.geo('cyl'), x, LD + 1.55, zc - s * 0.115, 0.16, 0.02, 0.16, 0, PI / 2); }
      for (const x of [22.5, 25]) { K.put('chrome', L.geo('cyl'), x, LD + 1.55, s * (5 - 0.105), 0.2, 0.02, 0.2, 0, PI / 2); K.put('yPort', L.geo('cyl'), x, LD + 1.55, s * (5 - 0.115), 0.16, 0.02, 0.16, 0, PI / 2); }
    }
    part('z', -LZ + T / 2, LZ - T / 2, LX0, LD, CEIL, [], [[LD, CEIL, 'paintGrey']], ENG);
    lining('z', -5 + T / 2, 5 - T / 2, 29.5, LD, CEIL, [], MAS, -1); lining('z', -5 + T / 2, 5 - T / 2, 29.5, LD, CEIL, [], [[LD, CEIL, 'paintGrey']], 1);
    // the engine room's forward bulkhead with a watertight door
    const inner = LZ - T / 2;
    part('z', -inner, -1, -18, LD, CEIL, [], ENG, CAB); part('z', -1, 1, -18, LD, CEIL, [[-0.6, 0.6, LD, LD + 2.0]], ENG, COR, 'paintDark'); part('z', 1, inner, -18, LD, CEIL, [], ENG, CAB);
    // the corridor: walls either side with the cabin doors; the lower lobby opens off it to port
    const D = (a) => [a, a + 0.9, LD, LD + 2.1];
    part('x', -17.9, -11, -1, LD, CEIL, [D(-13.5)], CAB, COR); part('x', -3, 13.9, -1, LD, CEIL, [D(0), D(8)], CAB, COR);
    part('x', -17.9, 13.9, 1, LD, CEIL, [D(-13.5), D(-7.5), D(0), D(8)], COR, CAB);
    for (const x of [-11, -3, 6, 14]) { part('z', -inner, -1.1, x, LD, CEIL, [], x === -11 ? CAB : x === -3 ? COR : x === 6 ? CAB : CREW, x === -11 ? COR : x === -3 ? CAB : x === 6 ? CREW : COR); part('z', 1.1, inner, x, LD, CEIL, [], x === 14 ? CREW : x === 6 ? CREW : CAB, x === 14 ? COR : x === 6 ? CREW : x === -3 ? CREW : CAB); }
    part('z', -inner, inner, 20, LD, CEIL, [[2.2, 3.2, LD, LD + 2.1]], COR, MAS);
    part('z', 1.6, 5 - T / 2, 26.5, LD, CEIL, [[2.5, 3.4, LD, LD + 2.1]], MAS, BATH); part('x', 26.6, 29.4, 1.5, LD, CEIL, [], MAS, BATH);
    // floors
    floor(LX0 + 0.1, -inner, -18.1, inner, LD, 'metalFloor', [[-31, -26, 3.0, 4.4]]); floor(-17.9, -0.9, 13.9, 0.9, LD, 'floorWood');
    floor(-10.9, -inner, -3.1, -1, LD, 'yMarble', [[-9.6, -5.2, -3.6, -1.4]]); floor(6.1, -inner, 13.9, -1.1, LD, 'checker'); floor(-2.9, 1.1, 5.9, inner, LD, 'tile'); floor(6.1, 1.1, 13.9, inner, LD, 'concreteDark');
    floor(14.1, -inner, 19.9, inner, LD, 'floorWood', [[18, 19.4, -3, 2]]); floor(26.6, 1.6, 29.4, 4.9, LD, 'yMarble'); floor(21.2, -3.8, 26, 0.8, LD + 0.006, 'rug');
    // --- the engine room: two diesels, generators, the control console, a workbench, pipes overhead
    for (const s of [-1, 1]) {
      const z0 = s * 1.3, z1 = s * 2.9, zm = s * 2.1;
      L.box(-25, LD, z0, -19.5, LD + 0.3, z1, 'paintDark', { top: 'steel' });
      L.box(-24.7, LD + 0.3, z0 + s * 0.1, -19.8, LD + 1.35, z1 - s * 0.1, 'paintGrey', { top: 'paintDark' });
      for (let x = -24.3; x < -20; x += 0.72) { L.box(x, LD + 1.35, zm - 0.35, x + 0.55, LD + 1.6, zm + 0.35, 'paintRed', { noCol: true }); L.cyl('chrome', x + 0.28, LD + 1.65, zm, 0.06, 0.1, 0, 0, true); }
      K.sph('steel', -19.6, LD + 1.1, zm, 0.4); L.pipe('steel', -19.6, LD + 1.4, zm, -19.6, CEIL, zm, 0.16); L.pipe('steel', -24.9, LD + 0.9, zm, -26.4, LD + 0.9, zm, 0.2);
      solid(-25, LD, Math.min(z0, z1), -19.5, LD + 1.65, Math.max(z0, z1), 'metal');
      L.pipe('paintGreen', LX0 + 0.3, CEIL - 0.25, s * 0.8, -18.3, CEIL - 0.25, s * 0.8, 0.07); L.pipe('paintRed', LX0 + 0.3, CEIL - 0.4, s * 3.8, -18.3, CEIL - 0.4, s * 3.8, 0.06);
    }
    K.plane(ART.mtu || (ART.mtu = K.canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#c0282c'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('MTU  16V 4000', w / 2, 46); })), 1.2, 0.3, -22.2, LD + 0.85, 1.38, PI);
    P('generator', -29.7, -3.8, 0, LD); P('generator', -29.7, -1.8, 0, LD);
    L.box(-19.2, LD, -5.2, -18.2, LD + 1.0, -2.6, 'paintGrey', { top: 'paintDark' }); screen(A.engines, 1.2, 0.6, -18.72, LD + 1.3, -3.9, -PI / 2, 0.4);
    for (let i = 0; i < 10; i++) K.sph(i % 3 ? 'lampGreen' : 'lampRed', -19.22, LD + 0.8, -5.0 + i * 0.24, 0.02);
    dchair(-19.9, -3.9, LD, 'x+');
    L.box(-24, LD, 4.7, -20, LD + 0.9, 5.3, 'paintGrey', { top: 'woodDark' }); deco(-24, LD + 1.2, 5.28, -20, LD + 2.2, 5.3, 'plywood');
    for (let i = 0; i < 9; i++) deco(-23.8 + i * 0.42, LD + 1.4 + (i % 3) * 0.2, 5.25, -23.72 + i * 0.42, LD + 1.9, 5.28, i % 2 ? 'paintRed' : 'steel');
    for (let i = 0; i < 3; i++) L.cyl('paintYellow', -27 + i * 0.6, LD + 0.5, -4.8, 0.2, 1.0, 0, 0, false); solid(-27.3, LD, -5.1, -25.5, LD + 1.0, -4.5, 'metal');
    PK_ext(LX0 + 0.12, LD + 1.1, 1.8, 1, 0); PK_ext(-18.2, LD + 1.1, 2.0, -1, 0);
    K.plane(A.engine, 0.8, 0.25, -17.88, LD + 2.3, 0, PI / 2);
    for (const [x, z] of [[-28, 0], [-23, 0], [-23, -4], [-23, 4]]) { deco(x - 0.6, CEIL - 0.08, z - 0.08, x + 0.6, CEIL, z + 0.08, 'steel'); deco(x - 0.55, CEIL - 0.1, z - 0.04, x + 0.55, CEIL - 0.08, z + 0.04, 'lampCool'); }
    lamp(-25, CEIL - 0.4, 0, 0xe8f0ff, 1.3, 11); lamp(-21, CEIL - 0.4, 3.5, 0xe8f0ff, 0.8, 6);
    L.addPickup('ammo', -21.5, LD, 0); L.addPickup('armor', -28.6, LD, 1.2);
    // --- the corridor: downlights, a runner, pictures between the doors
    floor(-17.8, -0.5, 13.8, 0.5, LD + 0.006, 'carpetBlue');
    for (let x = -16.5; x < 14; x += 3) dl(x, CEIL, 0);
    lamp(-14, CEIL - 0.3, 0, 0xffe2bc, 0.8, 7); lamp(3, CEIL - 0.3, 0, 0xffe2bc, 0.8, 7); lamp(-7, CEIL - 0.3, -2.5, 0xffe2bc, 0.8, 7);
    for (const x of [-15.5, -9.5, 3.5, 11.5]) picture(A.abstract, x, LD + 1.6, 0.88, PI, 0.5, 0.6);
    for (const x of [-15.5, 3.5, 11.5]) picture(A.seascape, x, LD + 1.6, -0.88, 0, 0.9, 0.45);
    L.addPickup('ammo', 10.5, LD, 0);
    // --- guest cabins
    const cabin = (x0, x1, s, twin) => {
      const zw = s * (LZ - 0.12), zb = s * (LZ - 2.2), xm = (x0 + x1) / 2;
      if (twin) { K.bed(xm - 1.7, Math.min(zw, zb), xm - 0.7, Math.max(zw, zb), LD, s > 0 ? 'z+' : 'z-'); K.bed(xm + 0.7, Math.min(zw, zb), xm + 1.7, Math.max(zw, zb), LD, s > 0 ? 'z+' : 'z-'); }
      else K.bed(xm - 1.1, Math.min(zw, zb), xm + 1.1, Math.max(zw, zb), LD, s > 0 ? 'z+' : 'z-');
      for (const dx of twin ? [0] : [-1.55, 1.55]) { L.box(xm + dx - 0.25, LD, zw - s * 0.45, xm + dx + 0.25, LD + 0.55, zw, 'yWalnut'); L.cyl('yGold', xm + dx, LD + 0.75, zw - s * 0.25, 0.04, 0.4, 0, 0, true); K.sph('lampWarm', xm + dx, LD + 1.0, zw - s * 0.25, 0.1); }
      L.box(x0 + 0.12, LD, s * 1.12, x0 + 0.72, LD + 2.2, s * 2.6, 'yWalnut'); deco(x0 + 0.72, LD + 1.0, s * 1.8, x0 + 0.74, LD + 1.1, s * 1.9, 'chrome');
      picture(A.seascape, xm, LD + 2.1, zw - s * 0.012, s > 0 ? PI : 0, 1.0, 0.5);
      dl(xm, CEIL, s * 3); lamp(xm, CEIL - 0.4, s * 3, 0xffe2bc, 0.6, 5);
    };
    cabin(-18, -11, -1); cabin(-18, -11, 1, true); cabin(-11, -3, 1); cabin(-3, 6, -1);
    sofa(-10.8, 2.8, -10.0, 4.8, LD, 'x-');
    // --- the lower lobby: the stair lands here; a console and a mirror
    L.box(-10.8, LD, -5.2, -10.2, LD + 0.85, -3.8, 'yWalnut', { top: 'yMarble' }); deco(-10.88, LD + 1.1, -5.1, -10.86, LD + 2.3, -3.9, 'chrome');
    pot(-3.6, -4.8, LD, 1); dl(-7, CEIL, -4.6); dl(-10, CEIL, -2);
    // --- the laundry: washers and dryers stacked against the hull, a folding table, baskets
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) { const x = -2.4 + i * 0.75, y = LD + k * 0.86; L.box(x - 0.35, y, 4.6, x + 0.35, y + 0.85, 5.28, 'appliance', { noCol: true }); L.cyl('paintDark', x, y + 0.42, 4.58, 0.24, 0.03, PI / 2, 0, true); L.cyl('glassDay', x, y + 0.42, 4.57, 0.18, 0.03, PI / 2, 0, true); }
    solid(-2.8, LD, 4.6, -0.3, LD + 1.72, 5.3);
    L.box(1.2, LD, 3.4, 3.6, LD + 0.9, 4.2, 'appliance', { top: 'counter' }); for (let i = 0; i < 4; i++) deco(1.4 + i * 0.5, LD + 0.9, 3.6, 1.8 + i * 0.5, LD + 0.9 + 0.05 + (i % 2) * 0.05, 4.0, i % 2 ? 'yTowel' : 'yCanvas');
    P('box', 4.6, 2.2, 0.3, LD); P('boxStack', 5.3, 4.6, -0.2, LD);
    for (const x of [-1, 3]) dl(x, CEIL, 3); lamp(1, CEIL - 0.4, 3, 0xf1f4ff, 0.7, 6);
    // --- the crew mess: a table and benches, a counter with a coffee machine and a microwave, a TV
    L.box(8, LD + 0.72, -4.6, 12, LD + 0.78, -3.2, 'counter', { noCol: true }); for (const x of [8.4, 11.6]) deco(x - 0.05, LD, -4.0, x + 0.05, LD + 0.72, -3.8, 'steel'); solid(8, LD, -4.6, 12, LD + 0.78, -3.2);
    for (const z of [-5.0, -2.7]) { L.box(8, LD, z - 0.22, 12, LD + 0.45, z + 0.22, 'paintBlue', { top: 'vinylRed' }); }
    L.box(6.2, LD, -2.9, 6.8, LD + 0.9, -1.2, 'appliance', { top: 'counter' }); deco(6.25, LD + 0.9, -2.7, 6.65, LD + 1.2, -2.2, 'paintDark'); deco(6.25, LD + 0.9, -1.9, 6.7, LD + 1.2, -1.4, 'appliance');
    deco(13.85, LD + 1.2, -4.5, 13.88, LD + 2.0, -3.1, 'paintDark'); screen(A.tv, 1.3, 0.7, 13.84, LD + 1.6, -3.8, -PI / 2);
    for (const x of [8, 12]) dl(x, CEIL, -3.4); lamp(10, CEIL - 0.4, -3.4, 0xf1f4ff, 0.8, 7);
    L.addPickup('ammo', 9.5, LD, -1.8);
    // --- the wine store: racks against the hull, crates and cases (the hijackers have been at it)
    for (let i = 0; i < 4; i++) { const x0 = 6.3 + i * 1.85; L.box(x0, LD, 4.7, x0 + 1.7, LD + 2.2, 5.28, 'yWalnut', { noCol: true }); for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) L.cyl(c % 3 ? 'glassDay' : 'paintGreen', x0 + 0.17 + c * 0.27, LD + 0.2 + r * 0.29, 4.68, 0.045, 0.04, PI / 2, 0, true); }
    solid(6.3, LD, 4.7, 13.7, LD + 2.2, 5.3);
    P('crate', 7.4, 2.2, 0.1, LD); P('crate', 7.5, 3.45, -0.1, LD); P('crateSmall', 7.4, 2.2, 0.3, LD + 1.2); P('crateSmall', 12.8, 2.1, 0.2, LD); P('box', 12.9, 3.3, -0.3, LD);
    for (let i = 0; i < 4; i++) { const a = i * 1.7; L.cyl('paintGreen', 10.4 + Math.cos(a) * 0.4, LD + 0.05, 2.8 + Math.sin(a) * 0.3, 0.045, 0.32, PI / 2, a, true); }
    dl(10, CEIL, 3); lamp(10, CEIL - 0.4, 3, 0xffd8a8, 0.6, 6);
    // --- the forward lobby
    pot(14.6, -4.8, LD, 1); pot(14.6, 4.8, LD, 1); K.plane(A.master, 0.8, 0.25, 19.88, LD + 2.4, 2.7, -PI / 2);
    slopeGuard('z', -3, 2, 18, LD, MD, -1, true); slopeGuard('z', -3, 2, 19.4, LD, MD, -1, true);
    dl(16, CEIL, -2); dl(16, CEIL, 3); lamp(16, CEIL - 0.4, 0, 0xffe2bc, 0.8, 7);
    // --- the master suite: the bed under the bow, a sofa, the dressing table, wardrobes, the bathroom
    K.bed(27.0, -2.9, 29.4, -0.3, LD, 'x+'); deco(29.38, LD + 0.6, -3.2, 29.4, LD + 1.9, 0.0, 'yLeather');
    for (const z of [-3.4, 0.2]) { L.box(28.9, LD, z - 0.25, 29.4, LD + 0.55, z + 0.25, 'yWalnut'); K.sph('lampWarm', 29.1, LD + 0.9, z, 0.12); }
    sofa(21.2, -4.9, 23.6, -4.1, LD, 'z-'); coffeeTable(21.7, -3.6, 23.1, -2.6, LD, 'yMarble');
    L.box(20.2, LD, 0.2, 20.7, LD + 0.78, 1.6, 'yWalnut', { top: 'yMarble' }); deco(20.12, LD + 1.1, 0.3, 20.14, LD + 2.1, 1.5, 'chrome'); dchair(21.1, 0.9, LD, 'x-');
    for (let i = 0; i < 3; i++) L.box(23 + i * 1.1, LD, 4.35, 24.05 + i * 1.1, LD + 2.3, 4.9, 'yWalnut');
    screen(A.tv, 1.6, 0.9, 20.13, LD + 1.6, -2.5, PI / 2);
    L.box(27.2, LD, 3.6, 29.4, LD + 0.6, 4.9, 'yMarble'); deco(27.35, LD + 0.45, 3.75, 29.25, LD + 0.58, 4.75, 'yPoolWater');
    L.box(26.7, LD, 1.7, 27.5, LD + 0.85, 2.5, 'yWalnut', { top: 'yMarble' }); deco(26.66, LD + 1.1, 1.8, 26.68, LD + 2.0, 2.4, 'chrome');
    for (const [x, z] of [[23, -1], [26, -2], [23, 3]]) dl(x, -0.32, z); lamp(24.5, -0.7, -1, 0xffe2bc, 1.1, 9); dl(28, -0.32, 3.2);
    L.addPickup('ammo', 24.8, LD, 2.8);
  }
  /** Red extinguisher on a bracket (wall normal nx, nz). */
  function PK_ext(x, y, z, nx, nz) { L.cyl('paintRed', x + nx * 0.12, y, z + nz * 0.12, 0.08, 0.5, 0, 0, true); K.sph('paintDark', x + nx * 0.12, y + 0.28, z + nz * 0.12, 0.05); deco(x - 0.05, y - 0.3, z - 0.05, x + 0.05, y - 0.26, z + 0.05, 'steel'); }

  // ------------------------------------------------------------ build
  MY.build = function () {
    K = CF.MapNuketown.kit;
    const rnd = U.mulberry32(1987);
    materials();
    art();
    sea(rnd);
    hull();
    mainDeck(rnd);
    aftDeck(rnd);
    mainHouse(rnd);
    upperDeck(rnd);
    sunDeck(rnd);
    foredeck(rnd);
    lowerDeck(rnd);
    L.killY = -8;

    // spawns: the stern (the pool deck and the upper aft deck) against the bow (the helipad); every point is on the
    // bots' navigation grid (the open decks, and the upper deck under the sun deck; never under another deck)
    L.spawns.t0 = [[-39, 0, 1.6], [-35.4, 0, -5.8], [-35.4, 0, 5.8], [-32, 0, 0], [-41.6, SP, -1.2], [-30, UD, -2.6], [-30, UD, 2.6]];
    L.spawns.t1 = [[30, PAD, 0], [26, PAD, -4], [26, PAD, 4], [34, PAD, -3], [34, PAD, 3], [39, 0, -3.4], [21.2, 0, 0.6]];
    const mid = [[-15, UD, 6.7], [-15, UD, -6.7], [5, UD, 6.7], [5, UD, -6.7], [-19.5, UD, -0.5], [6, UD, 3.8], [-6.5, UD, -2.5], [13.5, UD, 0.5], [-26, UD, 5.8], [19, 0, 5]];
    L.spawns.ffa = L.spawns.t0.concat(L.spawns.t1, mid);
    L.points.start = { x: -32, y: 0, z: 0, yaw: -Math.PI / 2 };
  };
})(window.CF);
