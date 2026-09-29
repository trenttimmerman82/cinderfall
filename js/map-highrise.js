'use strict';
/* Cinderfall — HIGHRISE (multiplayer), after the Modern Warfare 2 map: the roof of a skyscraper eighty-one floors over the
   city on a clear, hazy afternoon, the top of the tower still half built. West: the helipad on its podium, with the
   heliport lounge underneath, a roof terrace and the elevator machine room. Middle north: the Meridian offices, two floors
   round the elevator core (open-plan desks, the lobby, the data center, the break room downstairs; the boardroom, the
   corner office and the trading floor upstairs), a balcony across the south front with stairs down at both ends. Middle
   south: the courtyard, with the sunken mechanical well (pumps, pipes, a catwalk over it), ducts, cooling towers and the
   atrium skylight. East: the construction floor, bare steel with a plank deck at the north end, the tower crane with its
   jib over the whole roof, and the site cabins. A glass balustrade (plywood hoarding on the building site) runs round
   the edge; nobody goes over it. Axes: +X east, +Z south. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MH = CF.MapHighrise = {};
  let K = null; // Nuketown's building kit (js/map-nuketown.js)

  const T = 0.3;                                             // wall thickness
  const UF = 4.4, RF = 8.8, CT = RF - 0.4;                   // offices: upper floor, roof top, top of the walls
  const HP = 3.0, SD = 4.2, WD = -3.2;                       // helipad, the construction deck, the mechanical well floor
  const EX = 50, EZ = 32, GUARD = 10;                        // the roof edge (|x|, |z|) and the height of its invisible guard
  const OW = 23.85, ON = -31.85, OS = -8.15;                 // offices wall centre lines: west/east (±), north, the south front
  const BOTTOM = -240;                                       // the street
  const CR = { x: 42, z: 0, top: 46 };                       // the tower crane: mast centre and the height of its jib

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
  const glassO = { shoot: false, ao: false };
  /** A layer split around openings [a0, a1, y0, y1]. */
  function cut(axis, a0, a1, c, t, y0, y1, holes, m, o) {
    const B = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      if (axis === 'x') L.box(p0, q0, c - t / 2, p1, q1, c + t / 2, m, o); else L.box(c - t / 2, q0, p0, c + t / 2, q1, p1, m, o);
    };
    K.holeSpans(a0, a1, y0, y1, holes, B);
  }
  /** Glass: players stop, bullets pass. */
  const glass = (axis, a0, a1, c, y0, y1, holes) => cut(axis, a0, a1, c, 0.04, y0, y1, holes || [], 'glassClear', glassO);
  /** Dark aluminium frame round an opening on both faces; a steel threshold under doors, a sill under windows. */
  function frame(axis, h, c, yb, yt, t) {
    t = t || T;
    const f = t / 2 + 0.03, box = (a0, a1, y0, y1, cc, d, m) => axis === 'x' ? deco(a0, y0, cc - d, a1, y1, cc + d, m) : deco(cc - d, y0, a0, cc + d, y1, a1, m);
    const ft = Math.abs(h[3] + 0.1 - yt) < 0.005 ? yt + 0.01 : h[3] + 0.1; // never flush with the wall top
    for (const sd of [-1, 1]) {
      const cc = c + sd * f;
      box(h[0] - 0.1, h[0], h[2], h[3], cc, 0.03, 'paintDark'); box(h[1], h[1] + 0.1, h[2], h[3], cc, 0.03, 'paintDark');
      box(h[0] - 0.1, h[1] + 0.1, h[3], ft, cc, 0.03, 'paintDark');
    }
    if (h[2] - yb < 0.3) box(h[0], h[1], h[2], h[2] + 0.012, c, t / 2 + 0.06, 'steel');
    else box(h[0] - 0.1, h[1] + 0.1, h[2] - 0.06, h[2] + 0.01, c, t / 2 + 0.07, 'greyClean');
  }
  /** Wall with openings: exterior bands on the `out` side (+1/-1 along the other axis), interior bands inside. Windows get glass. */
  function wall(axis, a0, a1, c, y0, y1, holes, out, OUTB, INB) {
    if (a0 > a1) { const t = a0; a0 = a1; a1 = t; }
    const band = (bands, cc, t, ext) => { for (const b of bands) { const q0 = Math.max(y0, b[0]), q1 = Math.min(y1, b[1]); if (q1 > q0) cut(axis, a0 - ext, a1 + ext, cc, t, q0, q1, holes, b[2], {}); } };
    band(OUTB, c + out * T / 4, T / 2, axis === 'x' ? T / 2 : 0); band(INB, c - out * T / 4, T / 2, 0);
    for (const h of holes) {
      if (!(h[3] > y0 && h[2] < y1 && (h[0] + h[1]) / 2 >= a0 && (h[0] + h[1]) / 2 < a1)) continue;
      frame(axis, h, c, y0, y1);
      if (h[2] - y0 >= 0.3 && !h[4]) glass(axis, h[0], h[1], c, h[2], h[3]);
      if (h[4] === 'louvre') louvre(axis, h, c);
    }
  }
  /** Steel louvres filling an opening (bullets pass, players don't). */
  function louvre(axis, h, c) {
    for (let y = h[2] + 0.08; y < h[3] - 0.05; y += 0.16) {
      if (axis === 'x') deco(h[0], y, c - 0.1, h[1], y + 0.03, c + 0.06, 'steel'); else deco(c - 0.1, y, h[0], c + 0.06, y + 0.03, h[1], 'steel');
    }
    if (axis === 'x') W.add(h[0], h[2], c - 0.1, h[1], h[3], c + 0.1, { shoot: false }); else W.add(c - 0.1, h[2], h[0], c + 0.1, h[3], h[1], { shoot: false });
  }
  /** Solid staircase. axis 'x' climbs along X over a0..a1 (b = the Z span), 'z' climbs along Z. up = +1 rises toward a1, -1 toward a0. */
  function steps(axis, a0, a1, b0, b1, yBase, yTop, up, m, topM, nose) {
    if (b0 > b1) { const t = b0; b0 = b1; b1 = t; }
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, yBase, b0, s1, top, b1, m, { top: topM }); else L.box(b0, yBase, s0, b1, top, s1, m, { top: topM });
      const e = up > 0 ? s0 : s1, nm = nose || 'paintYellow';
      if (axis === 'x') deco(e - 0.03, top, b0, e + 0.03, top + 0.006, b1, nm); else deco(b0, top, e - 0.03, b1, top + 0.006, e + 0.03, nm);
    }
  }
  /** Invisible, bullet-transparent handrail colliders along a stair edge (c = the edge line), with a steel handrail unless bare. */
  function slopeGuard(axis, a0, a1, c, yBase, yTop, up, bare) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const s0 = a0 + (a1 - a0) * i / n, s1 = a0 + (a1 - a0) * (i + 1) / n, k = up > 0 ? (i + 1) / n : 1 - i / n, y = yBase + (yTop - yBase) * k;
      if (axis === 'x') W.add(s0, yBase, c - 0.04, s1, y + 1.05, c + 0.04, { shoot: false, nav: false }); else W.add(c - 0.04, yBase, s0, c + 0.04, y + 1.05, s1, { shoot: false, nav: false });
    }
    if (bare) return;
    const lo = up > 0 ? a0 : a1, hi = up > 0 ? a1 : a0, len = Math.abs(a1 - a0), np = Math.max(2, Math.round(len / 1.5));
    const Pt = (a, y) => axis === 'x' ? [a, y, c] : [c, y, a];
    const A = Pt(lo, yBase + 1.0), B = Pt(hi, yTop + 1.0); L.pipe('steel', A[0], A[1], A[2], B[0], B[1], B[2], 0.03);
    const M1 = Pt(lo, yBase + 0.5), M2 = Pt(hi, yTop + 0.5); L.pipe('steel', M1[0], M1[1], M1[2], M2[0], M2[1], M2[2], 0.02);
    for (let i = 0; i <= np; i++) { const k = i / np, a = lo + (hi - lo) * k, y = yBase + (yTop - yBase) * k, q = Pt(a, y); L.pipe('steel', q[0], y, q[2], q[0], y + 1.0, q[2], 0.025); }
  }
  /** Steel pipe railing with posts, bullet-transparent (col: the paint on the rails). */
  function rail(axis, a0, a1, c, y, col) {
    if (a0 > a1) { const t = a0; a0 = a1; a1 = t; }
    const n = Math.max(1, Math.round((a1 - a0) / 1.6)), m = col || 'steel';
    const Pt = (a, yy) => axis === 'x' ? [a, yy, c] : [c, yy, a];
    for (const [yy, r] of [[1.0, 0.035], [0.5, 0.022]]) { const A = Pt(a0, y + yy), B = Pt(a1, y + yy); L.pipe(m, A[0], A[1], A[2], B[0], B[1], B[2], r); }
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, A = Pt(a, y); L.pipe(m, A[0], y, A[2], A[0], y + 1.0, A[2], 0.03); }
    if (axis === 'x') W.add(a0, y, c - 0.06, a1, y + 1.05, c + 0.06, { shoot: false, nav: false }); else W.add(c - 0.06, y, a0, c + 0.06, y + 1.05, a1, { shoot: false, nav: false });
  }
  /** Glass balustrade on a steel shoe with a cap rail. */
  function glassRail(axis, a0, a1, c, y) {
    const b = (p0, p1, q0, q1, t, m, o) => axis === 'x' ? L.box(p0, q0, c - t, p1, q1, c + t, m, o) : L.box(c - t, q0, p0, c + t, q1, p1, m, o);
    b(a0, a1, y, y + 0.1, 0.05, 'steel', { noCol: true, ao: false });
    b(a0, a1, y + 0.1, y + 1.0, 0.015, 'glassClear', { noCol: true, ao: false });
    b(a0, a1, y + 1.0, y + 1.06, 0.04, 'steel', { noCol: true, ao: false });
    W.add(axis === 'x' ? a0 : c - 0.06, y, axis === 'x' ? c - 0.06 : a0, axis === 'x' ? a1 : c + 0.06, y + 1.06, axis === 'x' ? c + 0.06 : a1, { shoot: false, nav: false });
  }
  /** Ceiling light panel under a ceiling at y, with a real light. */
  function light(x, y, z, big) {
    const a = big ? 0.6 : 0.3, b = big ? 0.6 : 0.6;
    deco(x - a, y - 0.03, z - b, x + a, y, z + b, 'lampCool');
    L.lamp(x, y - 0.3, z, { color: 0xf1f4ff, intensity: 1.2, distance: 10, pool: false });
  }
  /** Fluorescent batten on a wall or a low ceiling (no real light). */
  function batten(x, y, z, alongX, len) {
    const a = (len || 1.2) / 2;
    if (alongX) { deco(x - a, y - 0.06, z - 0.07, x + a, y, z + 0.07, 'steel'); deco(x - a + 0.05, y - 0.08, z - 0.04, x + a - 0.05, y - 0.06, z + 0.04, 'lampCool'); }
    else { deco(x - 0.07, y - 0.06, z - a, x + 0.07, y, z + a, 'steel'); deco(x - 0.04, y - 0.08, z - a + 0.05, x + 0.04, y - 0.06, z + a - 0.05, 'lampCool'); }
  }
  /** Office chair facing (sin ry, cos ry): star base, gas lift, seat, back. */
  function officeChair(x, z, y, ry) {
    for (let i = 0; i < 5; i++) { const a = i * 1.2566 + ry; L.pipe('paintDark', x, y + 0.1, z, x + Math.cos(a) * 0.3, y + 0.04, z + Math.sin(a) * 0.3, 0.02); }
    L.cyl('chrome', x, y + 0.3, z, 0.03, 0.4, 0, 0, true);
    K.put('paintDark', L.geo('box'), x, y + 0.52, z, 0.5, 0.08, 0.48, ry);
    K.put('paintDark', L.geo('box'), x - Math.sin(ry) * 0.24, y + 0.88, z - Math.cos(ry) * 0.24, 0.46, 0.62, 0.06, ry);
    solid(x - 0.28, y, z - 0.28, x + 0.28, y + 1.2, z + 0.28);
  }
  /** Monitor on a stand, screen toward +Z (face 1) or -Z (face -1). */
  function monitor(x, y, z, face, m) {
    deco(x - 0.1, y, z - 0.07, x + 0.1, y + 0.015, z + 0.07, 'paintDark');
    deco(x - 0.02, y + 0.015, z - 0.015, x + 0.02, y + 0.14, z + 0.015, 'paintDark');
    deco(x - 0.28, y + 0.14, z - 0.02, x + 0.28, y + 0.48, z + 0.02, 'paintDark');
    deco(x - 0.26, y + 0.16, z + face * 0.02 - 0.003, x + 0.26, y + 0.46, z + face * 0.02 + 0.003, m || 'windowCool');
  }
  /** Office desk over x0..x1, z0..z1; the person sits on the +Z side (face 1) or -Z side (face -1); monitors at the back. */
  function desk(x0, z0, x1, z1, y, face, screens, rnd) {
    L.box(x0, y + 0.72, z0, x1, y + 0.75, z1, 'counter', { noCol: true });
    for (const x of [x0 + 0.03, x1 - 0.06]) deco(x, y, z0 + 0.04, x + 0.03, y + 0.72, z1 - 0.04, 'greyClean');
    const zb = face > 0 ? z0 + 0.05 : z1 - 0.07; deco(x0 + 0.06, y + 0.3, zb, x1 - 0.06, y + 0.72, zb + 0.02, 'greyClean');
    solid(x0, y, z0, x1, y + 0.75, z1);
    const zm = face > 0 ? z0 + 0.2 : z1 - 0.2, zk = face > 0 ? z1 - 0.3 : z0 + 0.3, w = x1 - x0, n = screens == null ? Math.max(1, Math.floor(w / 0.8)) : screens;
    for (let i = 0; i < n; i++) {
      const x = x0 + w * (i + 0.5) / n;
      monitor(x, y + 0.75, zm, face, rnd && rnd() < 0.3 ? 'screenOn' : 'windowCool');
      deco(x - 0.22, y + 0.75, zk - 0.08, x + 0.22, y + 0.77, zk + 0.08, 'paintDark');
    }
    if (rnd && rnd() < 0.6) deco(x1 - 0.5, y + 0.75, zk - 0.15, x1 - 0.2, y + 0.76, zk + 0.06, 'appliance'); // papers
  }
  /** Leather sofa along X or Z; back on side `back` ('x-', 'x+', 'z-', 'z+'). */
  function sofa(x0, z0, x1, z1, y, back, m) {
    m = m || 'leather';
    L.box(x0, y, z0, x1, y + 0.42, z1, m, { ao: false });
    const t = 0.22;
    if (back === 'z-') deco(x0, y + 0.42, z0, x1, y + 0.85, z0 + t, m); if (back === 'z+') deco(x0, y + 0.42, z1 - t, x1, y + 0.85, z1, m);
    if (back === 'x-') deco(x0, y + 0.42, z0, x0 + t, y + 0.85, z1, m); if (back === 'x+') deco(x1 - t, y + 0.42, z0, x1, y + 0.85, z1, m);
    solid(x0, y + 0.42, z0, x1, y + 0.85, z1);
  }
  /** Low coffee table. */
  function coffeeTable(x0, z0, x1, z1, y) { L.box(x0, y + 0.38, z0, x1, y + 0.42, z1, 'woodDark', { noCol: true }); deco(x0 + 0.1, y, z0 + 0.1, x1 - 0.1, y + 0.38, z1 - 0.1, 'paintDark'); solid(x0, y, z0, x1, y + 0.42, z1); }
  /** Potted plant: a pot and a leafy blob (no hiding spot: those are for the roof). */
  function pot(x, z, y, s) { s = s || 1; L.cyl('paintDark', x, y + 0.3 * s, z, 0.28 * s, 0.6 * s, 0, 0, false); K.put('leaves2', K.blobGeo((x * 7 | 0) % 3), x, y + 0.95 * s, z, 0.45 * s, 0.55 * s, 0.45 * s, x); solid(x - 0.3 * s, y, z - 0.3 * s, x + 0.3 * s, y + 0.62 * s, z + 0.3 * s); }
  /** Red fire extinguisher on a wall bracket (wall normal nx, nz). */
  function extinguisher(x, y, z, nx, nz) { L.cyl('paintRed', x + nx * 0.12, y, z + nz * 0.12, 0.08, 0.5, 0, 0, true); K.sph('paintDark', x + nx * 0.12, y + 0.28, z + nz * 0.12, 0.05); deco(x - 0.05, y - 0.3, z - 0.05, x + 0.05, y - 0.26, z + 0.05, 'steel'); }
  /** Flat sign on a wall facing ry (0 = +Z). */
  const sign = (tex, w, h, x, y, z, ry, o) => K.plane(tex, w, h, x, y, z, ry, o);

  // ------------------------------------------------------------ materials and canvas art
  const TEX = {};
  function materials() {
    if (!TEX.done) {
      TEX.done = true;
      const curtain = (a, b, fr, sp) => {
        // one storey (3.6 m) by three 1.2 m panes: spandrel band, mullions, a glint across the glass
        const t = K.canvasTex(256, 256, (x, w, h) => {
          const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h);
          x.fillStyle = sp; x.fillRect(0, h * 0.74, w, h * 0.26);
          x.fillStyle = fr; for (let i = 0; i < 3; i++) x.fillRect(i * w / 3, 0, 5, h); x.fillRect(0, h * 0.74 - 3, w, 6); x.fillRect(0, h - 4, w, 4);
          x.globalAlpha = 0.14; x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(0, h * 0.55); x.lineTo(w * 0.55, 0); x.lineTo(w * 0.7, 0); x.lineTo(0, h * 0.7); x.fill(); x.globalAlpha = 1;
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      };
      TEX.blue = curtain('#6d8eab', '#2c4058', '#1b2129', '#3a4550');
      TEX.gold = curtain('#b09466', '#5a4a33', '#241f18', '#4a4032');
      TEX.teal = curtain('#6a9c9a', '#274848', '#182020', '#34403f');
      TEX.stone = K.canvasTex(256, 256, (x, w, h) => {
        x.fillStyle = '#c9c0ae'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 600; i++) { x.fillStyle = 'rgba(' + (120 + (i * 37) % 60) + ',' + (110 + (i * 53) % 50) + ',90,0.08)'; x.fillRect((i * 97) % w, (i * 61) % h, 3, 3); }
        x.fillStyle = '#1e242b'; for (let i = 0; i < 2; i++) x.fillRect(w * (0.2 + i * 0.5), h * 0.12, w * 0.3, h * 0.6);
        x.fillStyle = '#9a917f'; x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h); x.fillRect(w / 2, 0, 2, h);
      });
      TEX.stone.wrapS = TEX.stone.wrapT = THREE.RepeatWrapping;
    }
    const M = L.mats, std = (map, o) => new THREE.MeshStandardMaterial(Object.assign({ map, vertexColors: true, roughness: 0.22, metalness: 0.55, envMapIntensity: 1.2 }, o));
    M.hrBlue = std(TEX.blue); M.hrGold = std(TEX.gold); M.hrTeal = std(TEX.teal); M.hrStone = std(TEX.stone, { roughness: 0.8, metalness: 0.05, envMapIntensity: 0.5 });
  }
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const ct = (w, h, draw) => K.canvasTex(w, h, draw);
    const font = (px, bold) => (bold ? 'bold ' : '') + px + 'px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const mark = (x, cx, cy, r, col) => { // Meridian: a globe cut by a rising arc
      x.strokeStyle = col; x.lineWidth = r * 0.12; x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.stroke();
      x.lineWidth = r * 0.1; x.beginPath(); x.moveTo(cx - r * 0.95, cy + r * 0.3); x.quadraticCurveTo(cx, cy - r * 0.2, cx + r * 0.95, cy - r * 0.35); x.stroke();
      x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
    };
    ART.logo = ct(1024, 256, (x, w, h) => {
      x.clearRect(0, 0, w, h); mark(x, 120, 128, 80, '#d8c38a');
      x.fillStyle = '#e9e2cf'; x.font = font(118, true); x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText('MERIDIAN', 236, 150);
      x.fillStyle = '#d8c38a'; x.font = font(38); x.fillText('C A P I T A L   P A R T N E R S', 240, 212);
    });
    ART.logoDark = ct(1024, 256, (x, w, h) => {
      x.clearRect(0, 0, w, h); mark(x, 120, 128, 80, '#1f2a36');
      x.fillStyle = '#1f2a36'; x.font = font(118, true); x.textAlign = 'left'; x.fillText('MERIDIAN', 236, 150);
      x.fillStyle = '#8a6d32'; x.font = font(38); x.fillText('C A P I T A L   P A R T N E R S', 240, 212);
    });
    const plate = (a, b, bg, fg) => ct(512, 160, (x, w, h) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.textAlign = 'left'; x.font = font(56, true); x.fillText(a, 26, 70);
      if (b) { x.font = font(28); x.globalAlpha = 0.8; x.fillText(b, 28, 122); x.globalAlpha = 1; }
    });
    ART.floor = ct(256, 256, (x, w, h) => { x.fillStyle = '#20262d'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9e2cf'; x.font = font(150, true); x.textAlign = 'center'; x.fillText('81', w / 2, 170); x.font = font(26); x.fillText('ROOF LEVEL', w / 2, 220); });
    ART.stair = plate('STAIR B', 'ROOF · FLOOR 81 · 82', '#2b4f7a', '#ffffff');
    ART.server = plate('DATA CENTER', 'AUTHORIZED PERSONNEL ONLY', '#20262d', '#ffb347');
    ART.heli = plate('HELIPAD', 'NO ACCESS DURING FLIGHT OPS', '#9c2016', '#ffffff');
    ART.machine = plate('ELEVATOR MACHINE ROOM', 'HIGH VOLTAGE · KEEP CLEAR', '#20262d', '#f2c230');
    ART.board = plate('BOARDROOM', 'MERIDIAN CAPITAL PARTNERS', '#20262d', '#d8c38a');
    ART.safety = ct(1024, 256, (x, w, h) => {
      x.fillStyle = '#f2c230'; x.fillRect(0, 0, w, h); x.fillStyle = '#161616';
      for (let i = -h; i < w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 0); x.lineTo(i + 32 - 26, 26); x.lineTo(i - 26, 26); x.fill(); x.beginPath(); x.moveTo(i, h - 26); x.lineTo(i + 32, h - 26); x.lineTo(i + 6, h); x.lineTo(i - 26, h); x.fill(); }
      x.font = font(84, true); x.textAlign = 'center'; x.fillText('SAFETY FIRST', w / 2, 118); x.font = font(40, true); x.fillText('HARD HATS REQUIRED BEYOND THIS POINT', w / 2, 180);
    });
    ART.builder = ct(1024, 256, (x, w, h) => {
      x.fillStyle = '#1d3b5c'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2c230'; x.fillRect(0, h - 28, w, 28);
      x.fillStyle = '#ffffff'; x.font = font(96, true); x.textAlign = 'left'; x.fillText('HALVORSEN', 40, 130); x.font = font(40); x.fillText('BUILDING THE SKYLINE SINCE 1962', 44, 196);
    });
    ART.ticker = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#05090d'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(80,120,160,0.35)'; x.lineWidth = 1;
      for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, 30 + i * 28); x.lineTo(w, 30 + i * 28); x.stroke(); }
      const line = (col, seed, base) => { x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); let y = base; for (let i = 0; i <= 64; i++) { y += Math.sin(i * 1.7 + seed) * 6 + Math.cos(i * 0.6 + seed * 2) * 4 - 0.6; x.lineTo(i * 8, y); } x.stroke(); };
      line('#39d96b', 1, 200); line('#ff5a4a', 4, 120);
      x.fillStyle = '#e9e2cf'; x.font = font(22, true); x.fillText('MRDN  +2.41%', 12, 24); x.fillStyle = '#39d96b'; x.fillText('▲ 184.62', 200, 24); x.fillStyle = '#ff5a4a'; x.fillText('DJI ▼ 0.8%', 360, 24);
    });
    ART.wall = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#0b1117'; x.fillRect(0, 0, w, h);
      const rows = [['MRDN', '184.62', '+2.41'], ['HLVN', '62.08', '-0.35'], ['ATLS', '12.94', '+0.81'], ['ORCA', '340.11', '+5.20'], ['KSTR', '8.47', '-1.02'], ['VLTG', '221.36', '+0.07']];
      x.font = font(30, true); rows.forEach((r, i) => { const y = 42 + i * 38, up = r[2][0] === '+'; x.fillStyle = '#e9e2cf'; x.textAlign = 'left'; x.fillText(r[0], 18, y); x.textAlign = 'right'; x.fillText(r[1], 330, y); x.fillStyle = up ? '#39d96b' : '#ff5a4a'; x.fillText((up ? '▲ ' : '▼ ') + r[2], w - 18, y); });
    });
    ART.painting = ct(256, 256, (x, w, h) => {
      x.fillStyle = '#e8e2d4'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1f3a5c'; x.fillRect(30, 40, 120, 170); x.fillStyle = '#c0582a'; x.fillRect(110, 90, 110, 120); x.fillStyle = '#d8b24a'; x.beginPath(); x.arc(170, 70, 34, 0, 6.283); x.fill();
      x.strokeStyle = '#1b1b1b'; x.lineWidth = 6; x.beginPath(); x.moveTo(20, 230); x.lineTo(236, 150); x.stroke();
    });
    ART.whiteboard = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#f5f6f4'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2050a0'; x.lineWidth = 4; x.font = '32px "Comic Sans MS", cursive'; x.fillStyle = '#2050a0';
      x.fillText('Q3 TARGETS', 24, 46); x.beginPath(); x.moveTo(30, 220); x.lineTo(120, 170); x.lineTo(200, 190); x.lineTo(300, 90); x.lineTo(380, 110); x.stroke();
      x.fillStyle = '#c02828'; x.fillText('+18% !!', 330, 70); x.fillStyle = '#202020'; x.font = '24px "Comic Sans MS", cursive'; x.fillText('- close the Atlas deal', 24, 250 - 20);
    });
    ART.weather = ct(512, 288, (x, w, h) => {
      x.fillStyle = '#0a1a2c'; x.fillRect(0, 0, w, h); x.fillStyle = '#7fd0ff'; x.font = font(30, true); x.fillText('HELIPAD WX · 14:26', 18, 40);
      x.font = font(26); ['WIND   240° / 14 KT', 'GUSTS  22 KT', 'VIS    10 SM  HAZE', 'CEILING  CLR', 'ALTIM  29.92'].forEach((t, i) => x.fillText(t, 18, 90 + i * 38));
      x.strokeStyle = '#7fd0ff'; x.lineWidth = 3; x.beginPath(); x.arc(410, 170, 70, 0, 6.283); x.stroke(); x.beginPath(); x.moveTo(410, 170); x.lineTo(410 - 55, 170 + 40); x.stroke();
    });
    return ART;
  }

  // ------------------------------------------------------------ the roof deck, the tower below it, the edge
  function deck() {
    // a thick slab (the well is cut out of it), the crown of the tower round it and the curtain wall down to the street
    const S = (x0, z0, x1, z1) => L.box(x0, -3.6, z0, x1, 0, z1, 'concrete', { top: 'concrete' });
    S(-EX, -EZ, EX, 8); S(-EX, 20, EX, EZ); S(-EX, 8, -12, 20); S(12, 8, EX, 20);
    L.box(-EX - 0.12, -3.6, -EZ - 0.12, EX + 0.12, -0.06, EZ + 0.12, 'greyClean', { noCol: true, skip: [2, 3], ao: false });
    L.box(-EX - 0.12, BOTTOM, -EZ - 0.12, EX + 0.12, -3.6, EZ + 0.12, 'hrBlue', { noCol: true, skip: [2, 3], ao: false, uvScale: 1 / 3.6 });
    for (let y = -7.2; y > BOTTOM + 20; y -= 36) L.box(-EX - 0.2, y - 0.5, -EZ - 0.2, EX + 0.2, y, EZ + 0.2, 'greyClean', { noCol: true, skip: [2, 3], ao: false });
    // roof pavers: joints in a 2 m grid over the open deck, a drain here and there
    for (let x = -48; x < EX; x += 2) { if (x > -12 && x < 12) { deco(x - 0.015, 0, -EZ + 0.3, x + 0.015, 0.004, 8, 'concreteDark'); deco(x - 0.015, 0, 20, x + 0.015, 0.004, EZ - 0.3, 'concreteDark'); } else deco(x - 0.015, 0, -EZ + 0.3, x + 0.015, 0.004, EZ - 0.3, 'concreteDark'); }
    for (const [x, z] of [[-30, 0], [-20, 26], [20, 26], [30, -4], [-36, 14], [0, -2]]) { deco(x - 0.25, 0.004, z - 0.25, x + 0.25, 0.008, z + 0.25, 'grate'); L.blob(x, z, 2.2, 1.8); }
  }
  function edge() {
    const A = art();
    // glass balustrade on a parapet, or plywood hoarding on the building site; an invisible wall over both
    const run = (axis, a0, a1, c, n, kind) => {
      const B = (p0, p1, y0, y1, d0, d1, m, o) => axis === 'x' ? L.box(p0, y0, c + n * d0, p1, y1, c + n * d1, m, o) : L.box(c + n * d0, y0, p0, c + n * d1, y1, p1, m, o);
      if (axis === 'x') W.add(a0, 0, Math.min(c, c + n * 0.3), a1, GUARD, Math.max(c, c + n * 0.3), { shoot: false, nav: false });
      else W.add(Math.min(c, c + n * 0.3), 0, a0, Math.max(c, c + n * 0.3), GUARD, a1, { shoot: false, nav: false });
      if (kind === 'glass') {
        B(a0, a1, 0, 0.5, 0, 0.3, 'concrete', { top: 'greyClean', noCol: true });
        B(a0, a1, 0.5, 0.56, 0.1, 0.2, 'steel', { noCol: true, ao: false });
        B(a0, a1, 0.56, 1.3, 0.14, 0.16, 'glassClear', { noCol: true, ao: false });
        B(a0, a1, 1.3, 1.36, 0.1, 0.2, 'steel', { noCol: true, ao: false });
        for (let a = a0 + 1.5; a < a1 - 0.5; a += 3) B(a - 0.04, a + 0.04, 0.56, 1.3, 0.12, 0.18, 'steel', { noCol: true, ao: false });
      } else {
        B(a0, a1, 0, 2.4, 0, 0.04, 'plywood', { noCol: true, ao: false });
        for (let a = a0 + 1.2; a < a1; a += 2.4) B(a - 0.05, a + 0.05, 0, 2.5, 0.04, 0.14, 'woodDark', { noCol: true, ao: false });
        for (const y of [0.9, 2.1]) B(a0, a1, y, y + 0.1, 0.04, 0.1, 'woodDark', { noCol: true, ao: false });
      }
    };
    run('z', -31.7, 18, -EX, 1, 'glass');                   // west, as far as the machine room
    run('x', -EX, -24, -EZ, 1, 'glass');                    // north-west, as far as the offices
    run('x', 24, EX, -EZ, 1, 'hoard');                      // north-east: the building site
    run('z', -31.7, 8, EX, -1, 'hoard');                     // east, along the building site
    run('z', 8, 31.7, EX, -1, 'glass');                      // east, south of it
    run('x', -36, EX, EZ, -1, 'glass');                      // south, from the machine room
    for (const [x, z, ry] of [[36, -31.92, 0], [49.92, -18, -Math.PI / 2]]) sign(A.safety, 4, 1, x, 1.5, z, ry);
    sign(A.builder, 6, 1.5, 49.92, 1.5, -4, -Math.PI / 2);
  }

  // ------------------------------------------------------------ the offices: shell, floors, the core, stairs, balcony, roof
  function offices() {
    const A = art();
    const OUT = [[0, 0.45, 'greyClean'], [0.45, CT, 'hrStone']], IN = [[0, 0.12, 'paintDark'], [0.12, CT, 'wallClean']];
    // north: ribbon windows on both floors over the edge (the core stands behind the middle)
    const nWin = [[-22.6, -5.6, 0.9, 3.4], [5.6, 22.6, 0.9, 3.4], [-22.6, -5.6, UF + 0.8, UF + 3.3], [5.6, 22.6, UF + 0.8, UF + 3.3]];
    wall('x', -OW, OW, ON, 0, CT, nWin, -1, OUT, IN);
    for (const h of nWin) for (let x = h[0] + 1.4; x < h[1] - 0.3; x += 1.4) deco(x - 0.04, h[2] + 0.003, ON - 0.1, x + 0.04, h[3] - 0.003, ON + 0.1, 'paintDark');
    // west and east: a door each, windows (the data center gets a high strip)
    for (const s of [-1, 1]) {
      const holes = [[-11.2, -9.6, 0, 2.5], s < 0 ? [-29, -20.5, 1.0, 3.3] : [-30, -22, 2.2, 3.4], [-30.4, -24.4, UF + 0.9, UF + 3.2], [-19.4, -12.6, UF + 0.9, UF + 3.2]];
      wall('z', ON, -8.0, s * OW, 0, CT, holes, s, OUT, IN);
      sign(A.floor, 0.5, 0.5, s * (OW + T / 2 + 0.02), 1.9, -12, s * Math.PI / 2);
    }
    // south: the glass front, a steel kerb, a spandrel at the floor line; doors below, doors to the balcony above
    const gDoors = [[-18, -16.4, 0, 2.5], [-1.3, 1.3, 0, 2.6], [16.4, 18, 0, 2.5]], uDoors = [[-12.2, -10.6, UF, UF + 2.5], [10.6, 12.2, UF, UF + 2.5]];
    cut('x', -23.7, 23.7, OS, T, 0, 0.15, gDoors, 'greyClean', {});
    glass('x', -23.7, 23.7, OS, 0.15, 4.0, gDoors);
    cut('x', -23.7, 23.7, OS, T, 4.0, 4.6, uDoors, 'greyClean', {});
    glass('x', -23.7, 23.7, OS, 4.6, CT, uDoors);
    for (const h of gDoors) frame('x', h, OS, 0, 4.0);
    for (const h of uDoors) frame('x', h, OS, UF, CT);
    const inDoor = (x, ds) => ds.some((h) => x > h[0] - 0.25 && x < h[1] + 0.25);
    for (let x = -21.6; x < 23; x += 2.4) {
      if (!inDoor(x, gDoors)) deco(x - 0.05, 0.153, OS - 0.12, x + 0.05, 3.997, OS + 0.12, 'paintDark');
      if (!inDoor(x, uDoors)) deco(x - 0.05, 4.603, OS - 0.12, x + 0.05, CT - 0.003, OS + 0.12, 'paintDark');
    }
    // floor finishes: carpet west, terrazzo in the lobby, raised floor in the data center, the break room
    deco(-23.7, 0, -31.7, -8, 0.006, -8.3, 'carpetBlue'); deco(-8, 0, -31.7, 8, 0.006, -8.3, 'terrazzo');
    deco(12, 0, -31.7, 23.7, 0.006, -21, 'metalFloor'); deco(8, 0, -31.7, 12, 0.006, -21, 'terrazzo'); deco(8, 0, -21, 23.7, 0.006, -8.3, 'checker');
    // the upper floor slab round the core and the two stair holes
    const holes = [[-5, 5, -31.7, -26], [-23.7, -21.5, -20.5, -12], [21.5, 23.7, -20.5, -12]];
    K.holeSpans(-23.7, 23.7, -31.7, -8.3, holes, (x0, x1, z0, z1) => L.box(x0, UF - 0.3, z0, x1, UF, z1, 'ceilTile', { top: 'carpetBlue', side: 'wallClean' }));
    // the elevator core through both floors: three cars a floor, the logo over them
    L.box(-5, 0, -31.7, 5, CT, -26, 'wallClean', { side: 'greyClean' });
    for (const y of [0, UF]) {
      for (const x of [-3, 0, 3]) {
        deco(x - 0.7, y, -25.97, x - 0.55, y + 2.4, -25.92, 'chrome'); deco(x + 0.55, y, -25.97, x + 0.7, y + 2.4, -25.92, 'chrome'); deco(x - 0.7, y + 2.4, -25.97, x + 0.7, y + 2.55, -25.92, 'chrome');
        deco(x - 0.55, y, -25.99, x - 0.005, y + 2.4, -25.95, 'steel'); deco(x + 0.005, y, -25.99, x + 0.55, y + 2.4, -25.95, 'steel');
        deco(x - 0.2, y + 2.62, -25.99, x + 0.2, y + 2.78, -25.96, 'paintDark'); deco(x - 0.12, y + 2.66, -25.965, x + 0.12, y + 2.74, -25.955, 'lampAmber');
        deco(x + 0.8, y + 1.0, -25.99, x + 0.92, y + 1.25, -25.96, 'steel'); K.sph('lampWarm', x + 0.86, y + 1.15, -25.955, 0.025);
      }
      for (const [a, b] of [[-5, -3.7], [-2.3, -0.7], [0.7, 2.3], [3.7, 5]]) deco(a, y, -25.99, b, y + 0.1, -25.96, 'paintDark');
    }
    sign(A.logo, 6, 1.5, 0, 3.3, -25.96, 0, { alpha: true });
    sign(A.logoDark, 4.4, 1.1, 0, UF + 3.1, -25.96, 0, { alpha: true });
    // the stairs up inside, at both ends, under the holes in the slab
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -23.7 : 21.5, x1 = s < 0 ? -21.5 : 23.7, xo = s < 0 ? -21.5 : 21.5;
      steps('z', -20.5, -12, x0, x1, 0, UF, -1, 'wallClean', 'carpetBlue', 'steel');
      slopeGuard('z', -20.5, -12, xo + s * 0.05, 0, UF, -1);
      glassRail('z', -20.5, -12, xo, UF); glassRail('x', x0, x1, -11.94, UF);
      sign(A.stair, 1.1, 0.34, s * 23.68, 2.6, -13.2, -s * Math.PI / 2);
    }
    // the balcony across the south front, on columns, with stairs down at both ends
    L.box(-20, UF - 0.3, -8.0, 20, UF, -5, 'ceiling', { top: 'terrazzo', side: 'panelWhite' });
    glassRail('x', -20, 20, -5.08, UF);
    for (const x of [-15, -6, 6, 15]) { L.cyl('panelWhite', x, (UF - 0.3) / 2, -5.35, 0.2, UF - 0.3, 0, 0, false); W.addCyl(x, -5.35, 0.2, 0, UF - 0.3); }
    for (const x of [-12, 0, 12]) { deco(x - 0.5, UF - 0.33, -7, x + 0.5, UF - 0.3, -6, 'lampCool'); }
    for (const s of [-1, 1]) {
      const a0 = s < 0 ? -28.5 : 20, a1 = s < 0 ? -20 : 28.5, up = -s;
      steps('x', a0, a1, -8.0, -5, 0, UF, up, 'concreteDark', 'concrete');
      slopeGuard('x', a0, a1, -4.95, 0, UF, up);
      const e0 = s < 0 ? -28.5 : 24, e1 = s < 0 ? -24 : 28.5, eh = UF * 4.5 / 8.5; // past the corner of the building the back of the stair is open too
      slopeGuard('x', e0, e1, -8.05, 0, eh, up, true);
    }
    // the roof: slab, parapet, plant, the company name facing the courtyard; nobody gets up here
    L.box(-24, CT, -32, 24, RF, -8.0, 'ceilTile', { top: 'concreteDark', side: 'greyClean' });
    for (const [a, b, c, d] of [[-24, -32, 24, -31.75], [-24, -8.25, 24, -8.0], [-24, -31.75, -23.75, -8.25], [23.75, -31.75, 24, -8.25]]) deco(a, RF, b, c, RF + 0.6, d, 'greyClean');
    K.roofCap(-24.6, -32.6, 24.6, -7.4, RF);
    for (const [x, z] of [[-16, -20], [-8, -28], [10, -18], [17, -27]]) { deco(x - 1.2, RF, z - 0.8, x + 1.2, RF + 1.3, z + 0.8, 'paintGrey'); L.cyl('steel', x, RF + 1.35, z, 0.5, 0.1, 0, 0, true); }
    deco(-3, RF, -30, 3, RF + 2.4, -27, 'greyClean'); L.cyl('steel', 0, RF + 6, -28.5, 0.08, 7, 0, 0, true); K.sph('lampRed', 0, RF + 9.6, -28.5, 0.14);
    for (const x of [-5.5, 5.5]) L.pipe('steel', x, RF, -9.2, x, RF + 3.6, -9.2, 0.06);
    L.pipe('steel', -5.8, RF + 3.4, -9.2, 5.8, RF + 3.4, -9.2, 0.05); L.pipe('steel', -5.8, RF + 0.6, -9.2, 5.8, RF + 0.6, -9.2, 0.05);
    sign(A.logo, 11, 2.75, 0, RF + 2, -9.1, 0, { alpha: true });
  }

  // ------------------------------------------------------------ offices, ground floor
  /** Cubicle pod: four desks round a cross of 1.35 m partitions, each open to the aisle on its long side. */
  function pod(cx, cz, y, rnd) {
    const H = 1.35;
    L.box(cx - 1.6, y, cz - 0.03, cx + 1.6, y + H, cz + 0.03, 'fabric', { top: 'steel' });
    L.box(cx - 0.03, y, cz - 1.6, cx + 0.03, y + H - 0.01, cz + 1.6, 'fabric', { top: 'steel' });
    for (const sx of [-1, 1]) L.box(cx + sx * 1.6 - 0.03, y, cz - 1.6, cx + sx * 1.6 + 0.03, y + H + 0.01, cz + 1.6, 'fabric', { top: 'steel' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x0 = sx < 0 ? cx - 1.57 : cx + 0.03, x1 = sx < 0 ? cx - 0.03 : cx + 1.57, z0 = sz < 0 ? cz - 0.75 : cz + 0.03, z1 = sz < 0 ? cz - 0.03 : cz + 0.75;
      desk(x0, z0, x1, z1, y, -sz, 1, rnd);
      if (rnd() < 0.8) officeChair((x0 + x1) / 2 + (rnd() - 0.5) * 0.3, cz + sz * 1.15, y, sz > 0 ? Math.PI : 0);
      if (rnd() < 0.5) deco((x0 + x1) / 2 - 0.4, y + 0.75, (z0 + z1) / 2 - 0.08, (x0 + x1) / 2 - 0.32, y + 0.87, (z0 + z1) / 2, 'paintRed'); // a mug
    }
  }
  function officeGround(rnd) {
    const A = art();
    // lobby: reception desk, sofas, planters; glass partitions to the wings
    for (const s of [-1, 1]) {
      glass('z', -31.7, -8.3, s * 8, 0, UF - 0.3, [[-25, -22.6, 0, 2.6], [-15, -12.6, 0, 2.6]]);
      for (const z of [-28.6, -19.4, -10.5]) deco(s * 8 - 0.05, 0, z - 0.05, s * 8 + 0.05, UF - 0.3, z + 0.05, 'paintDark');
      for (const [a, b] of [[-25, -22.6], [-15, -12.6]]) { deco(s * 8 - 0.06, 2.6, a - 0.06, s * 8 + 0.06, 2.7, b + 0.06, 'paintDark'); deco(s * 8 - 0.06, 0, a - 0.06, s * 8 + 0.06, 2.6, a, 'paintDark'); deco(s * 8 - 0.06, 0, b, s * 8 + 0.06, 2.6, b + 0.06, 'paintDark'); }
    }
    L.box(-3, 0, -17.8, 3, 1.1, -16.8, 'panelWhite', { top: 'woodDark' }); deco(-3.05, 1.1, -17.85, 3.05, 1.14, -16.75, 'woodDark');
    deco(-2.6, 0.3, -16.79, 2.6, 0.32, -16.77, 'lampWarm'); sign(A.logoDark, 2.4, 0.6, 0, 0.72, -16.77, 0, { alpha: true });
    for (const x of [-1.6, 1.4]) monitor(x, 1.14, -17.5, -1);
    officeChair(-1.2, -18.6, 0, 0); officeChair(1.3, -18.7, 0, 0.2);
    sofa(-7.6, -14.4, -6.6, -11.6, 0, 'x-'); sofa(6.6, -14.4, 7.6, -11.6, 0, 'x+'); coffeeTable(-5.8, -13.6, -4.6, -12.4, 0); coffeeTable(4.6, -13.6, 5.8, -12.4, 0);
    for (const [x, z] of [[-7.3, -9], [7.3, -9], [-7.3, -20.5], [7.3, -20.5]]) pot(x, z, 0, 1.2);
    deco(-4, 0.006, -14, 4, 0.01, -9.5, 'rug');
    light(-4, UF - 0.3, -21); light(4, UF - 0.3, -21); light(0, UF - 0.3, -13, true);
    L.lamp(0, 3.4, -24, { color: 0xffe4c0, intensity: 1.2, distance: 9, pool: false });
    // west wing: four cubicle pods, a meeting table, the printer, the water cooler
    for (const cx of [-18.5, -12.5]) for (const cz of [-28, -22]) pod(cx, cz, 0, rnd);
    L.box(-14.2, 0.72, -13.4, -11.8, 0.76, -11.0, 'woodDark', { noCol: true }); deco(-13.1, 0, -12.3, -12.9, 0.72, -12.1, 'steel'); solid(-14.2, 0, -13.4, -11.8, 0.76, -11.0);
    for (const [x, z, ry] of [[-13, -14.1, 0], [-13, -10.3, Math.PI], [-14.9, -12.2, Math.PI / 2], [-11.1, -12.2, -Math.PI / 2]]) officeChair(x, z, 0, ry);
    L.box(-9.1, 0, -18.6, -8.2, 1.05, -17.4, 'appliance', { top: 'paintDark' }); deco(-9.0, 1.05, -18.4, -8.4, 1.12, -17.6, 'paintDark'); // copier
    L.cyl('appliance', -17, 0.55, -8.8, 0.18, 1.1, 0, 0, true); L.cyl('glassClear', -17, 1.3, -8.8, 0.15, 0.4, 0, 0, true); solid(-17.2, 0, -9.0, -16.8, 1.5, -8.6);
    pot(-9, -9, 0, 1); pot(-23.1, -30.9, 0, 1);
    sign(A.whiteboard, 2.4, 1.2, -8.06, 1.7, -28.4, -Math.PI / 2);
    for (const [x, z] of [[-18.5, -25], [-12.5, -25], [-18.5, -31], [-12.5, -31], [-16, -16], [-16, -10.5]]) light(x, UF - 0.3, z);
    extinguisher(-23.7, 1.0, -19.5, 1, 0);
    // east wing: the data center behind glass, the break room
    glass('z', -31.7, -21, 12, 0, UF - 0.3, [[-27, -25.4, 0, 2.4]]); glass('x', 12, 23.7, -21, 0, UF - 0.3, [[14, 15.6, 0, 2.4]]);
    deco(11.94, 0, -21.06, 12.06, UF - 0.3, -20.94, 'paintDark'); for (const z of [-29.5, -23.3]) deco(11.95, 0, z - 0.05, 12.05, UF - 0.3, z + 0.05, 'paintDark');
    for (const x of [18, 21]) deco(x - 0.05, 0, -21.05, x + 0.05, UF - 0.3, -20.95, 'paintDark');
    deco(11.94, 2.4, -27, 12.06, 2.5, -25.4, 'paintDark'); deco(14, 2.4, -21.06, 15.6, 2.5, -20.94, 'paintDark');
    sign(A.server, 1.4, 0.44, 16.9, 2.9, -20.96, 0);
    for (const z of [-28.8, -25]) {
      L.box(14.5, 0, z - 0.4, 21.5, 2.1, z + 0.4, 'paintDark', { top: 'greyClean' });
      for (const f of [-1, 1]) for (let x = 14.55; x < 21.4; x += 0.7) {
        const zf = z + f * 0.4;
        deco(x, 0.1, Math.min(zf, zf + f * 0.01), x + 0.6, 2.0, Math.max(zf, zf + f * 0.01), 'grate');
        for (let k = 0; k < 6; k++) if (rnd() < 0.7) { const y = 0.3 + k * 0.28, m = rnd() < 0.7 ? 'lampGreen' : rnd() < 0.5 ? 'lampAmber' : 'lampBlue'; deco(x + 0.05, y, Math.min(zf + f * 0.01, zf + f * 0.016), x + 0.09, y + 0.02, Math.max(zf + f * 0.01, zf + f * 0.016), m); }
      }
      deco(14.5, 2.7, z - 0.3, 21.5, 2.76, z + 0.3, 'steel'); for (let x = 15; x < 21.5; x += 1.5) L.pipe('steel', x, 2.76, z, x, UF - 0.3, z, 0.015);
    }
    for (const z of [-31, -22.2]) { L.box(22.9, 0, z - 0.7, 23.7, 2.0, z + 0.7, 'panelWhite', { top: 'paintGrey' }); deco(22.88, 0.3, z - 0.5, 22.9, 1.7, z + 0.5, 'grate'); }
    for (let z = -31.4; z < -21.2; z += 0.6) deco(12.1, 0.006, z - 0.005, 23.6, 0.009, z + 0.005, 'paintDark');
    for (const [x, z] of [[16, -30.5], [20, -30.5], [16, -27], [20, -27], [16, -23], [20, -23]]) { deco(x - 0.6, UF - 0.33, z - 0.15, x + 0.6, UF - 0.3, z + 0.15, 'lampCool'); }
    L.lamp(18, 3.2, -27, { color: 0xd8e8ff, intensity: 1.2, distance: 12, pool: false });
    extinguisher(23.7, 1.0, -21.6, -1, 0);
    // break room: kitchen island, vending machines, cafe tables
    L.box(13, 0, -17.2, 17.5, 0.95, -16.3, 'cabinet', { top: 'counter' }); deco(14.4, 0.95, -17.0, 15.0, 0.97, -16.6, 'steel'); L.pipe('chrome', 14.7, 0.95, -17.1, 14.7, 1.3, -16.85, 0.015);
    deco(16.3, 0.95, -17.1, 16.9, 1.3, -16.7, 'paintDark'); deco(16.35, 1.0, -16.7, 16.85, 1.25, -16.68, 'windowWarm');
    for (const x of [13.6, 14.8, 16, 17.2]) P('stool', x, -15.6, 0);
    P('vending', 9.0, -20.4, 0); P('vending', 10.1, -20.4, 0); L.box(11.0, 0, -20.9, 11.8, 1.8, -20.1, 'appliance');
    for (const [x, z] of [[11.5, -11.5], [16, -11.5], [11.5, -14.3]]) {
      L.cyl('counter', x, 0.74, z, 0.45, 0.04, 0, 0, false); L.cyl('steel', x, 0.37, z, 0.04, 0.74, 0, 0, true); solid(x - 0.45, 0, z - 0.45, x + 0.45, 0.76, z + 0.45);
      for (const a of [0.6, 2.2, 3.8, 5.4]) { const cx = x + Math.cos(a) * 0.75, cz = z + Math.sin(a) * 0.75; if (rnd() < 0.8) K.chair(cx, cz, 0); }
    }
    pot(9, -9, 0, 1); sign(A.painting, 1.2, 1.2, 8.06, 2.0, -16, Math.PI / 2);
    for (const [x, z] of [[11, -18.5], [16, -18.5], [11, -10.5], [16, -10.5], [19, -14]]) light(x, UF - 0.3, z);
    L.addPickup('ammo', 6.5, 0, -10);
  }

  // ------------------------------------------------------------ offices, upper floor
  function officeUpper(rnd) {
    const A = art(), y = UF;
    // boardroom (north-west) and the corner office (north-east) behind glass
    for (const s of [-1, 1]) {
      const xw = s * 10, xa = s < 0 ? -23.7 : 10, xb = s < 0 ? -10 : 23.7, door = s < 0 ? [-13.4, -11.8] : [11.8, 13.4];
      glass('x', xa, xb, -22, y, CT, [[door[0], door[1], y, y + 2.4]]); glass('z', -31.7, -22, xw, y, CT, [[-27, -25.4, y, y + 2.4]]);
      deco(xw - 0.06, y, -22.06, xw + 0.06, CT, -21.94, 'paintDark');
      deco(door[0], y + 2.4, -22.06, door[1], y + 2.5, -21.94, 'paintDark'); deco(xw - 0.06, y + 2.4, -27, xw + 0.06, y + 2.5, -25.4, 'paintDark');
      for (const x of [door[0] - 0.06, door[1]]) deco(x, y, -22.06, x + 0.06, y + 2.4, -21.94, 'paintDark');
      for (const z of [-27.06, -25.4]) deco(xw - 0.06, y, z, xw + 0.06, y + 2.4, z + 0.06, 'paintDark');
      deco(xa + (s < 0 ? 0 : 0.2), y, -31.7, xb - (s < 0 ? 0.2 : 0), y + 0.006, -22.2, 'carpetBeige');
    }
    // boardroom: long table, chairs, the screen on the west wall, a credenza
    L.box(-20, y + 0.72, -28.1, -13, y + 0.78, -25.7, 'woodDark', { noCol: true }); deco(-19.4, y, -27.4, -13.6, y + 0.72, -26.4, 'paintDark'); solid(-20, y, -28.1, -13, y + 0.78, -25.7);
    for (const x of [-19, -17.5, -16, -14.5]) { officeChair(x, -28.8, y, 0); officeChair(x + 0.3, -25, y, Math.PI); }
    officeChair(-20.7, -26.9, y, Math.PI / 2); officeChair(-12.3, -26.9, y, -Math.PI / 2);
    deco(-23.7, y + 1.0, -28.6, -23.62, y + 2.6, -25.2, 'paintDark'); sign(A.ticker, 3.2, 1.45, -23.6, y + 1.8, -26.9, Math.PI / 2);
    L.box(-23.7, y, -31.6, -21.4, y + 0.8, -31.0, 'woodDark', { top: 'counter' }); pot(-12, -31, y, 1.1); pot(-23, -22.8, y, 1.1);
    sign(A.board, 1.2, 0.38, -16.7, y + 2.7, -21.96, 0);
    sign(A.whiteboard, 2.4, 1.2, -10.06, y + 1.7, -29.2, -Math.PI / 2);
    for (const x of [-19, -15]) light(x, CT, -27);
    // the corner office: desk, the big chair, a sofa, bookshelves, a globe, a painting
    L.box(15.4, y + 0.72, -29.4, 19.2, y + 0.78, -28.2, 'woodDark', { noCol: true }); deco(15.8, y, -29.28, 18.8, y + 0.7, -29.12, 'woodDark'); for (const x of [15.6, 18.8]) deco(x, y, -29.3, x + 0.2, y + 0.72, -28.3, 'woodDark');
    solid(15.4, y, -29.4, 19.2, y + 0.78, -28.2); monitor(16.4, y + 0.78, -29.1, 1); monitor(17.2, y + 0.78, -29.1, 1, 'screenOn');
    officeChair(17.3, -30.2, y, 0); officeChair(16.4, -27.2, y, Math.PI); officeChair(18.2, -27.2, y, Math.PI);
    sofa(22.8, -27.8, 23.7, -24.2, y, 'x+'); coffeeTable(21.2, -26.8, 22.2, -25.2, y);
    for (const x of [10.4, 12.2]) { L.box(x, y, -31.7, x + 1.6, y + 2.2, -31.3, 'woodDark'); for (let k = 0; k < 4; k++) for (let b = x + 0.08; b < x + 1.5; b += 0.09 + rnd() * 0.05) if (rnd() < 0.8) deco(b, y + 0.2 + k * 0.5, -31.3, b + 0.06, y + 0.2 + k * 0.5 + 0.28 + rnd() * 0.08, -31.12, ['paintRed', 'paintBlue', 'paintGreen', 'counter', 'paintDark'][(rnd() * 5) | 0]); }
    L.cyl('woodDark', 21.8, y + 0.4, -30.6, 0.05, 0.8, 0, 0, true); K.sph('paintBlue', 21.8, y + 1.05, -30.6, 0.28); solid(21.5, y, -30.9, 22.1, y + 1.35, -30.3);
    sign(A.painting, 1.4, 1.4, 23.66, y + 1.9, -29.6, -Math.PI / 2); deco(19.6, y + 0.006, -28.4, 23, y + 0.01, -23.6, 'rug');
    for (const x of [15, 20]) light(x, CT, -27);
    // the trading floor: two rows of desks each side, the lounge in the middle, the market wall on the core
    for (const s of [-1, 1]) {
      const xa = s < 0 ? -20 : 11, xb = s < 0 ? -11 : 20;
      for (const z of [-19.2, -14.6]) { desk(xa, z, xb, z + 0.8, y, 1, null, rnd); for (let x = xa + 0.7; x < xb - 0.3; x += 1.6) if (rnd() < 0.75) officeChair(x + (rnd() - 0.5) * 0.3, z + 1.35, y, Math.PI); }
      pot(s * 9, -9, y, 1.1); pot(s * 22.8, -9, y, 1.1);
    }
    sofa(-3.2, -17.2, 3.2, -16.4, y, 'z-'); sofa(-3.2, -12.6, 3.2, -11.8, y, 'z+'); coffeeTable(-1.4, -15.3, 1.4, -13.7, y);
    deco(-4, y + 0.006, -18, 4, y + 0.01, -11, 'rug');
    for (const x of [-7.4, 7.4]) pot(x, -24.6, y, 1.2);
    sign(A.wall, 3, 1.5, -6.9, y + 2.2, -25.96, 0); sign(A.ticker, 3, 1.5, 6.9, y + 2.2, -25.96, 0);
    for (const x of [-9.3, -5.3]) deco(x - 1.6, y + 1.4, -25.99, x + 1.6, y + 3.0, -25.97, 'paintDark');
    for (const x of [5.3, 9.3]) deco(x - 1.6, y + 1.4, -25.99, x + 1.6, y + 3.0, -25.97, 'paintDark');
    for (const [x, z] of [[-16, -17], [-16, -11], [16, -17], [16, -11], [0, -20], [0, -12], [-7, -30], [7, -30]]) light(x, CT, z);
    L.addPickup('armor', 20.5, y, -24.2); L.addPickup('ammo', -11.4, y, -30.6); L.addPickup('ammo', 0, y, -9.6);
  }

  // ------------------------------------------------------------ the helipad on its podium, the heliport lounge under it
  /** Corporate helicopter along X, nose toward +X, standing on skids on the deck at y. */
  function helicopter(x, y, z) {
    const put = (m, g, dx, dy, dz, sx, sy, sz, ry, rx, rz) => K.put(m, g, x + dx, y + dy, z + dz, sx, sy, sz, ry, rx, rz);
    put('panelWhite', K.extrude('hrHeliBody', [[-2.2, 0.6], [1.9, 0.6], [2.7, 0.85], [3.05, 1.35], [2.8, 1.85], [2.0, 2.2], [0.6, 2.35], [-1.4, 2.35], [-2.2, 2.0]], 1.5, 0.12), 0, 0, 0, 1, 1, 1);
    put('glassDay', K.extrude('hrHeliGlass', [[1.95, 1.32], [2.98, 1.36], [2.78, 1.84], [2.0, 2.18], [1.6, 2.18]], 1.78, 0), 0, 0, 0, 1, 1, 1);
    put('paintBlue', K.extrude('hrHeliStripe', [[-2.25, 0.95], [2.62, 0.95], [2.8, 1.15], [-2.25, 1.15]], 1.76, 0), 0, 0, 0, 1, 1, 1);
    for (const sd of [-1, 1]) deco(x - 1.2, y + 1.3, z + sd * 0.87 - 0.005, x + 0.4, y + 2.0, z + sd * 0.87 + 0.005, 'glassDay');
    put('panelWhite', L.geo('box'), -0.4, 2.52, 0, 2.4, 0.36, 1.1); put('paintBlue', L.geo('box'), -0.4, 2.52, 0, 2.2, 0.08, 1.12);
    L.pipe('panelWhite', x - 2.1, y + 1.8, z, x - 7.2, y + 2.0, z, 0.22);
    put('paintBlue', K.extrude('hrHeliFin', [[-7.7, 1.7], [-7.0, 1.9], [-6.7, 3.2], [-7.3, 3.3]], 0.1, 0.02), 0, 0, 0, 1, 1, 1);
    deco(x - 7.0, y + 1.95, z - 1.0, x - 6.4, y + 2.0, z + 1.0, 'panelWhite');
    for (const a of [0.3, 0.3 + Math.PI / 2]) put('paintDark', L.geo('box'), -7.25, 2.6, 0.2, 0.1, 1.5, 0.03, 0, 0, a);
    L.cyl('paintDark', x - 0.2, y + 2.85, z, 0.16, 0.3, 0, 0, true); L.cyl('paintGrey', x - 0.2, y + 3.02, z, 0.3, 0.08, 0, 0, true);
    for (let i = 0; i < 4; i++) { const a = 0.45 + i * Math.PI / 2; put('paintDark', L.geo('box'), -0.2 + Math.cos(a) * 2.9, 3.06, Math.sin(a) * 2.9, 5.6, 0.04, 0.28, -a); }
    for (const sd of [-1, 1]) {
      L.pipe('paintDark', x - 1.7, y + 0.12, z + sd * 0.95, x + 2.2, y + 0.12, z + sd * 0.95, 0.05);
      L.pipe('paintDark', x + 2.2, y + 0.12, z + sd * 0.95, x + 2.55, y + 0.35, z + sd * 0.95, 0.05);
      for (const dx of [-1.0, 1.4]) L.pipe('paintDark', x + dx, y + 0.12, z + sd * 0.95, x + dx, y + 0.68, z + sd * 0.6, 0.04);
    }
    K.sph('lampRed', x - 7.6, y + 3.35, z, 0.07); K.sph('lampGreen', x + 0.2, y + 0.9, z + 0.9, 0.05); K.sph('lampRed', x + 0.2, y + 0.9, z - 0.9, 0.05);
    solid(x - 2.35, y, z - 1.0, x + 3.1, y + 2.5, z + 1.0, 'metal'); solid(x - 7.7, y + 1.5, z - 0.35, x - 2.35, y + 2.3, z + 0.35, 'metal');
    W.add(x - 7.8, y + 2.3, z - 1.1, x + 3.2, y + 9, z + 1.1, { shoot: false, nav: false }); // no perching on the cabin roof or the boom
    L.blob(x - 1, z, 9, 3, y);
  }
  function helipad(rnd) {
    const A = art();
    const OUT = [[0, 0.4, 'greyClean'], [0.4, 2.7, 'hrStone']], IN = [[0, 0.1, 'paintDark'], [0.1, 2.7, 'wallClean']];
    // the lounge walls, the pad over them
    wall('z', -23.85, -8.15, -46.85, 0, 2.7, [[-19, -13, 1.0, 2.1]], -1, OUT, IN);
    wall('z', -23.85, -8.15, -31.15, 0, 2.7, [[-14, -12.4, 0, 2.3], [-18.8, -16, 1.0, 2.1]], 1, OUT, IN);
    wall('x', -46.85, -31.15, -23.85, 0, 2.7, [[-44, -40, 1.0, 2.1], [-37, -33.5, 1.0, 2.1]], -1, OUT, IN);
    wall('x', -46.85, -31.15, -8.15, 0, 2.7, [[-44, -42.4, 0, 2.3], [-40.5, -37.5, 1.0, 2.1]], 1, OUT, IN);
    L.box(-47, 2.7, -24, -31, HP, -8, 'ceilTile', { top: 'concrete', side: 'greyClean' });
    // the pad: border, the circle, the H, edge lights, a hazard band round the rim
    const cx = -39, cz = -16;
    for (const z of [-23.6, -8.4]) deco(-46.6, HP, z - 0.15, -31.4, HP + 0.006, z + 0.15, 'lineWhite');
    for (const x of [-46.45, -31.55]) deco(x - 0.15, HP, -23.45, x + 0.15, HP + 0.006, -8.55, 'lineWhite');
    K.put('paintYellow', K.discGeo(5.2, 5.6, 0.25), cx, HP + 0.008, cz, 1, 1, 1);
    deco(cx - 1.7, HP, cz - 2.3, cx - 1.1, HP + 0.006, cz + 2.3, 'lineWhite'); deco(cx + 1.1, HP, cz - 2.3, cx + 1.7, HP + 0.006, cz + 2.3, 'lineWhite'); deco(cx - 1.1, HP, cz - 0.3, cx + 1.1, HP + 0.006, cz + 0.3, 'lineWhite');
    for (let a = -46; a <= -32; a += 2) for (const z of [-23.9, -8.1]) K.sph('lampGreen', a, HP + 0.03, z, 0.06, 0.04, 0.06);
    for (let a = -22; a <= -10; a += 2) for (const x of [-46.9, -31.1]) K.sph('lampGreen', x, HP + 0.03, a, 0.06, 0.04, 0.06);
    for (const [x0, z0, x1, z1] of [[-47.02, -24.02, -30.98, -23.98], [-47.02, -8.02, -30.98, -7.98], [-47.02, -23.98, -46.98, -8.02], [-31.02, -23.98, -30.98, -8.02]]) deco(x0, HP - 0.25, z0, x1, HP - 0.05, z1, 'hazard');
    helicopter(cx + 0.4, HP, cz);
    // windsock on the north-west corner, a floodlight on the north-east
    L.cyl('steel', -46.3, HP + 2.2, -23.3, 0.05, 4.4, 0, 0, true); L.pipe('steel', -46.3, HP + 4.3, -23.3, -45.8, HP + 4.3, -23.3, 0.02);
    for (let i = 0; i < 4; i++) { const r = 0.3 - i * 0.05; L.cyl(i % 2 ? 'appliance' : 'paintRed', -45.5 + i * 0.36, HP + 4.2 - i * 0.05, -23.3, r, 0.36, 0, Math.PI / 2 - 0.12, false); }
    W.addCyl(-46.3, -23.3, 0.08, HP, HP + 4.4, { surf: 'metal' });
    L.cyl('steel', -31.6, HP + 1.1, -23.4, 0.05, 2.2, 0, 0, true); deco(-31.9, HP + 2.1, -23.6, -31.3, HP + 2.5, -23.3, 'paintDark'); deco(-31.85, HP + 2.15, -23.29, -31.35, HP + 2.45, -23.27, 'lampWarm');
    W.addCyl(-31.6, -23.4, 0.07, HP, HP + 2.5, { surf: 'metal' });
    // stairs up: from the terrace (south) and from the alley by the offices (east)
    steps('z', -8, -2.5, -36, -33.6, 0, HP, -1, 'concreteDark', 'concrete');
    slopeGuard('z', -8, -2.5, -36.05, 0, HP, -1); slopeGuard('z', -8, -2.5, -33.55, 0, HP, -1);
    steps('x', -31, -25.5, -22, -20, 0, HP, -1, 'concreteDark', 'concrete');
    slopeGuard('x', -31, -25.5, -22.05, 0, HP, -1); slopeGuard('x', -31, -25.5, -19.95, 0, HP, -1);
    sign(A.heli, 1.2, 0.38, -37.5, 2.3, -7.98, 0);
    // the lounge: check-in desk, sofas, lockers, flight gear, the weather board, coffee
    deco(-46.7, 0, -23.7, -31.3, 0.006, -8.3, 'carpetBeige');
    L.box(-35.8, 0, -21.6, -32.4, 1.05, -20.8, 'panelWhite', { top: 'woodDark' }); monitor(-34.6, 1.05, -21.3, -1); monitor(-33.4, 1.05, -21.3, -1, 'screenOn');
    officeChair(-34, -22.6, 0, 0);
    sofa(-45.2, -12.6, -41.8, -11.8, 0, 'z+'); sofa(-45.2, -16.8, -41.8, -16.0, 0, 'z-'); coffeeTable(-44.2, -15.2, -42.8, -13.4, 0);
    sofa(-46.7, -15.6, -45.9, -12.8, 0, 'x-');
    for (let i = 0; i < 6; i++) { const x = -46.4 + i * 0.52; L.box(x, 0, -23.7, x + 0.5, 1.95, -23.2, 'paintGrey', { top: 'paintDark' }); deco(x + 0.38, 0.9, -23.21, x + 0.42, 1.1, -23.19, 'chrome'); }
    for (let i = 0; i < 3; i++) K.sph('appliance', -42.6 + i * 0.5, 1.72, -23.45, 0.16, 0.18, 0.16); deco(-42.9, 1.52, -23.7, -41.3, 1.55, -23.3, 'steel');
    deco(-46.7, 1.0, -21.6, -46.64, 2.1, -19.6, 'paintDark'); sign(A.weather, 1.9, 1.05, -46.62, 1.55, -20.6, Math.PI / 2);
    L.box(-31.7, 0, -11.4, -31.3, 0.95, -9.4, 'cabinet', { top: 'counter' }); deco(-31.65, 0.95, -10.8, -31.35, 1.35, -10.3, 'paintDark');
    P('stool', -32.2, -10, 0); pot(-31.8, -8.8, 0, 1); pot(-46.2, -8.8, 0, 1);
    for (const [x, z] of [[-39, -12], [-39, -20]]) { L.cyl('wallClean', x, 1.35, z, 0.25, 2.7, 0, 0, false); W.addCyl(x, z, 0.25, 0, 2.7); }
    for (const [x, z] of [[-43, -20], [-35, -17], [-43, -11], [-35, -11]]) { batten(x, 2.7, z, true, 1.4); }
    L.lamp(-39, 2.3, -16, { color: 0xf1f4ff, intensity: 1.4, distance: 12, pool: false }); L.lamp(-43, 2.3, -12, { color: 0xffe8c8, intensity: 1.0, distance: 8, pool: false });
    extinguisher(-31.3, 1.0, -22.8, -1, 0);
    L.addPickup('ammo', -45.4, 0, -9.6);
  }

  // ------------------------------------------------------------ west: the terrace and the elevator machine room
  function terrace(rnd) {
    const A = art();
    const OUT = [[0, 0.4, 'greyClean'], [0.4, 4.2, 'hrStone']], IN = [[0, 0.1, 'paintDark'], [0.1, 4.2, 'wallClean']];
    // the machine room in the south-west corner, on the edge of the roof
    wall('z', 18.15, 31.85, -49.85, 0, 4.2, [], -1, OUT, IN);
    wall('z', 18.15, 31.85, -36.15, 0, 4.2, [[22, 23.6, 0, 2.4], [26, 29, 1.2, 2.6, 'louvre']], 1, OUT, IN);
    wall('x', -49.85, -36.15, 18.15, 0, 4.2, [[-42, -40.4, 0, 2.4], [-47, -44, 1.2, 2.6, 'louvre']], -1, OUT, IN);
    wall('x', -49.85, -36.15, 31.85, 0, 4.2, [], 1, OUT, IN);
    L.box(-50, 4.2, 18, -36, 4.5, 32, 'ceiling', { top: 'concreteDark', side: 'greyClean' }); K.roofCap(-50.5, 17.5, -35.5, 32.5, 4.5);
    for (const [x, z] of [[-46, 22], [-40, 28]]) { deco(x - 1.1, 4.5, z - 0.7, x + 1.1, 5.7, z + 0.7, 'paintGrey'); L.cyl('steel', x, 5.75, z, 0.45, 0.1, 0, 0, true); }
    sign(A.machine, 1.4, 0.44, -41.2, 2.85, 17.98, Math.PI);
    deco(-49.7, 0, 18.3, -36.3, 0.006, 31.7, 'concreteDark');
    // three traction machines on plinths, controllers, the hoist beam, ropes down through the floor
    for (const z of [21.2, 24.8, 28.4]) {
      L.box(-47.6, 0, z - 0.7, -44.4, 0.3, z + 0.7, 'concrete', { top: 'paintGrey' });
      L.cyl('paintGreen', -46.8, 0.85, z, 0.42, 1.2, 0, Math.PI / 2, false); L.cyl('paintYellow', -45.9, 0.85, z, 0.46, 0.2, 0, Math.PI / 2, false);
      L.cyl('steel', -45.1, 0.95, z, 0.62, 0.34, 0, Math.PI / 2, false); for (let k = -0.12; k <= 0.12; k += 0.06) L.pipe('paintDark', -45.1 + k, 0.95, z - 0.62, -45.1 + k, 0.3, z - 0.62, 0.012);
      deco(-47.6, 0.3, z - 0.3, -47.3, 1.3, z + 0.3, 'paintDark');
      solid(-47.6, 0, z - 0.7, -44.4, 1.6, z + 0.7, 'metal');
      deco(-45.4, 0.006, z - 0.9, -44.8, 0.01, z - 0.7, 'paintDark');
    }
    for (let x = -46; x < -38; x += 1.3) { L.box(x, 0, 31.1, x + 1.2, 2.1, 31.7, 'paintGrey', { top: 'paintDark' }); deco(x + 0.1, 1.5, 31.08, x + 0.3, 1.9, 31.1, 'lampGreen'); deco(x + 1.0, 0.9, 31.08, x + 1.05, 1.2, 31.1, 'chrome'); }
    deco(-49.7, 3.8, 24.7, -36.3, 4.0, 24.9, 'paintYellow'); deco(-44.5, 3.4, 24.6, -44.1, 3.8, 25.0, 'paintDark'); L.pipe('steel', -44.3, 3.4, 24.8, -44.3, 2.2, 24.8, 0.01);
    deco(-49.7, 3.2, 18.3, -49.5, 3.4, 31.7, 'steel');
    for (const [x, z] of [[-45, 21], [-45, 28], [-39, 24]]) batten(x, 4.2, z, true, 1.4);
    L.lamp(-43, 3.6, 25, { color: 0xe8f0ff, intensity: 1.3, distance: 12, pool: false });
    extinguisher(-36.3, 1.0, 20.5, -1, 0);
    L.addPickup('ammo', -38.5, 0, 29.5);
    // the terrace: timber decking, planters, a pergola over a seating area, cafe tables, a smokers' bin
    deco(-49.7, 0, -3, -38, 0.012, 16.5, 'floorWood');
    const planter = (x0, z0, x1, z1) => { L.box(x0, 0, z0, x1, 0.85, z1, 'concreteDark', { top: 'dirt' }); for (let a = 0; a < 1; a += 0.34) K.bush(x0 + (x1 - x0) * (a + 0.17), z0 + (z1 - z0) * (a + 0.17), 0.45 + rnd() * 0.2, 0.85, true); };
    planter(-44, 4.2, -40, 5.2); planter(-34, 10, -30, 11); planter(-49.6, -3, -48.6, 4); planter(-31, -2, -27, -1); planter(-49.6, 9, -48.6, 16);
    for (const [x, z] of [[-46.5, 7.5], [-41.5, 7.5], [-46.5, 13.5], [-41.5, 13.5]]) { L.box(x - 0.1, 0, z - 0.1, x + 0.1, 2.62, z + 0.1, 'woodDark'); }
    for (let x = -46.8; x <= -41.2; x += 0.4) deco(x - 0.04, 2.7, 7.2, x + 0.04, 2.84, 13.8, 'woodDark');
    for (const z of [7.5, 13.5]) deco(-46.9, 2.56, z - 0.08, -41.1, 2.7, z + 0.08, 'woodDark');
    for (const [x, z] of [[-45, 10.5], [-42.6, 10.5]]) {
      L.cyl('paintDark', x, 0.72, z, 0.5, 0.04, 0, 0, false); L.cyl('steel', x, 0.36, z, 0.04, 0.72, 0, 0, true); solid(x - 0.5, 0, z - 0.5, x + 0.5, 0.74, z + 0.5);
      for (const a of [0.8, 2.4, 4.0, 5.6]) K.chair(x + Math.cos(a) * 0.85, z + Math.sin(a) * 0.85, 0);
    }
    for (const [x, z] of [[-33, 2], [-37, 14]]) {
      L.cyl('appliance', x, 0.72, z, 0.45, 0.04, 0, 0, false); L.cyl('steel', x, 1.3, z, 0.03, 2.6, 0, 0, true); solid(x - 0.45, 0, z - 0.45, x + 0.45, 0.74, z + 0.45);
      K.put('paintRed', L.geo('cone'), x, 2.45, z, 1.3, 0.45, 1.3); W.addCyl(x, z, 0.05, 0.74, 2.6, { surf: 'metal' });
    }
    P('bin', -29.8, 16.6); P('planter', -27.2, 3); P('planter', -27.2, 7);
    // the south-west corner: plant and satellite dishes
    P('ac', -33, 26, Math.PI / 2); P('ac', -29, 30.6, 0); P('generator', -33.2, 21, Math.PI / 2); P('vent', -28.5, 22.5);
    for (const [x, z] of [[-48.4, -6], [-48.4, -27]]) { L.cyl('paintGrey', x, 0.7, z, 0.08, 1.4, 0, 0, true); K.put('appliance', K.geo('sphere'), x + 0.2, 1.8, z, 0.12, 0.7, 0.7); W.addCyl(x, z, 0.3, 0, 2.4, { surf: 'metal' }); }
  }

  // ------------------------------------------------------------ the courtyard: the mechanical well, ducts, cooling towers, the skylight
  function courtyard(rnd) {
    // the well: floor, stairs in two corners, a catwalk across the middle, rails with gaps for dropping in
    L.box(-12, -3.8, 8, 12, WD, 20, 'concrete', { top: 'concreteDark' });
    steps('x', -12, -5.9, 8, 10.4, WD, 0, -1, 'concreteDark', 'concrete'); slopeGuard('x', -12, -5.9, 10.45, WD, 0, -1);
    steps('x', 5.9, 12, 17.6, 20, WD, 0, 1, 'concreteDark', 'concrete'); slopeGuard('x', 5.9, 12, 17.55, WD, 0, 1);
    L.box(-0.8, -0.14, 8, 0.8, 0, 20, 'grate', { side: 'steel' });
    for (const x of [-0.8, 0.8]) rail('z', 8, 20, x, 0);
    for (const z of [11, 17]) { deco(-0.8, WD, z - 0.12, -0.56, -0.14, z + 0.12, 'paintGrey'); deco(0.56, WD, z - 0.12, 0.8, -0.14, z + 0.12, 'paintGrey'); solid(-0.8, WD, z - 0.12, -0.56, -0.14, z + 0.12); solid(0.56, WD, z - 0.12, 0.8, -0.14, z + 0.12); }
    rail('x', -12, -6, 8, 0); rail('x', -3, -0.8, 8, 0); rail('x', 0.8, 12, 8, 0);
    rail('x', -12, -0.8, 20, 0); rail('x', 0.8, 3, 20, 0); rail('x', 6, 12, 20, 0);
    rail('z', 10.4, 20, -12, 0); rail('z', 8, 17.6, 12, 0);
    for (const [x0, z0, x1, z1] of [[-5.9, 8, -0.8, 8.03], [0.8, 8, 12, 8.03], [-12, 19.97, -0.8, 20], [0.8, 19.97, 5.9, 20], [-12, 10.4, -11.97, 19.97], [11.97, 8.03, 12, 17.6]]) deco(x0, -0.3, z0, x1, -0.1, z1, 'hazard');
    // pipes along the long walls, pumps in the middle, valves, a switchboard
    for (const [z, x0, x1, m] of [[8.5, -5.6, 12, 'paintGreen'], [19.5, -12, 5.6, 'greyClean']]) {
      L.pipe(m, x0, WD + 0.6, z, x1, WD + 0.6, z, 0.34); L.pipe('paintRed', x0, WD + 1.5, z, x1, WD + 1.5, z, 0.16);
      for (let x = x0 + 1; x < x1; x += 2.5) deco(x - 0.06, WD, z - 0.4, x + 0.06, WD + 1.7, z + 0.4, 'steel');
      solid(x0, WD, Math.min(z - 0.5, z + 0.5), x1, WD + 1.7, Math.max(z - 0.5, z + 0.5), 'metal');
    }
    for (const x of [-5, 5]) {
      L.box(x - 1.1, WD, 13.2, x + 1.1, WD + 0.3, 14.8, 'concrete', { top: 'paintGrey' });
      L.cyl('paintGreen', x - 0.3, WD + 0.85, 14, 0.5, 1.0, 0, Math.PI / 2, false); L.cyl('paintBlue', x + 0.65, WD + 0.85, 14, 0.36, 0.7, 0, Math.PI / 2, false);
      L.pipe('paintGreen', x - 0.3, WD + 1.3, 14, x - 0.3, WD + 2.2, 14, 0.18); L.pipe('paintGreen', x - 0.3, WD + 2.2, 14, x - 0.3, WD + 2.2, x < 0 ? 8.6 : 19.4, 0.18);
      solid(x - 1.1, WD, 13.2, x + 1.1, WD + 1.4, 14.8, 'metal'); solid(x - 0.5, WD + 1.4, x < 0 ? 8.5 : 13.8, x - 0.1, WD + 2.4, x < 0 ? 14.2 : 19.5, 'metal');
      L.cyl('paintRed', x - 0.3, WD + 2.2, x < 0 ? 11.4 : 16.6, 0.28, 0.05, Math.PI / 2, 0, false);
    }
    L.box(11.4, WD, 12, 12, WD + 2.2, 15, 'paintGrey', { top: 'paintDark' }); deco(11.38, WD + 1.6, 12.3, 11.4, WD + 2.0, 14.7, 'lampGreen');
    for (const x of [-8, 3]) { L.cyl('paintDark', x, WD + 0.05, 16.5, 0.35, 0.1, 0, 0, true); L.blob(x, 16.5, 2.4, 1.8, WD); }
    for (const [x, z, nx, nz] of [[-12, 14, 1, 0], [12, 18.5, -1, 0], [6, 8, 0, 1], [-6, 20, 0, -1]]) { deco(x - 0.12 + nx * 0.05, -1.0, z - 0.12 + nz * 0.05, x + 0.12 + nx * 0.05, -0.8, z + 0.12 + nz * 0.05, 'paintDark'); K.sph('lampWarm', x + nx * 0.2, -0.9, z + nz * 0.2, 0.08); }
    L.lamp(-4, -0.8, 14, { color: 0xffd9a8, intensity: 1.4, distance: 10, pool: false }); L.lamp(6, -0.8, 14, { color: 0xffd9a8, intensity: 1.2, distance: 10, pool: false });
    L.addPickup('armor', 0, WD, 16.2); L.addPickup('ammo', -9.5, WD, 12.5);
    // ducts across the yard, rising into the risers either side
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -24 : 14, x1 = s < 0 ? -14 : 24;
      L.box(x0, 0.2, 3, x1, 1.45, 4.4, 'greyClean', { top: 'steel' }); for (let x = x0 + 0.6; x < x1; x += 2) deco(x - 0.1, 0, 3.1, x + 0.1, 0.2, 4.3, 'paintDark');
      for (let x = x0 + 1.2; x < x1; x += 1.8) deco(x - 0.03, 0.19, 2.98, x + 0.03, 1.47, 4.42, 'steel');
      solid(x0, 0, 3, x1, 0.2, 4.4, 'metal');
      const rx = s * 15.8;
      L.box(rx - 0.8, 0, 2.9, rx + 0.8, 3.4, 4.5, 'greyClean', { top: 'paintDark' }); W.add(rx - 0.8, 3.4, 2.9, rx + 0.8, GUARD, 4.5, { shoot: false, nav: false });
      L.cyl('steel', rx, 3.8, 3.7, 0.5, 0.8, 0, 0, false); K.put('steel', L.geo('cone'), rx, 4.35, 3.7, 0.7, 0.3, 0.7);
    }
    // cooling towers on the south edge, the atrium skylight between them; nobody stands on either
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -25 : 17, x1 = s < 0 ? -17 : 25;
      L.box(x0, 0, 24, x1, 3.4, 31.7, 'panelWhite', { top: 'paintGrey' });
      for (let y = 0.4; y < 2.8; y += 0.22) deco(x0 + 0.3, y, 23.96, x1 - 0.3, y + 0.1, 24.0, 'grate');
      for (let z = 24.6; z < 31.4; z += 0.22) { const xf = s < 0 ? x1 : x0; if (z < 31) deco(Math.min(xf, xf + s * -0.04), 0.4, z, Math.max(xf, xf + s * -0.04), 2.8, z + 0.1, 'grate'); }
      for (const z of [26, 29.7]) { const cxx = (x0 + x1) / 2; L.cyl('paintGrey', cxx - 2, 3.75, z, 1.4, 0.7, 0, 0, false); L.cyl('paintGrey', cxx + 2, 3.75, z, 1.4, 0.7, 0, 0, false); deco(cxx - 3.3, 4.08, z - 0.02, cxx - 0.7, 4.12, z + 0.02, 'steel'); deco(cxx + 0.7, 4.08, z - 0.02, cxx + 3.3, 4.12, z + 0.02, 'steel'); }
      W.add(x0, 3.4, 24, x1, GUARD, 31.7, { shoot: false, nav: false });
      L.pipe('paintGreen', s < 0 ? -16.4 : 16.4, 0.6, 26, s < 0 ? -16.4 : 16.4, 0.6, 31.2, 0.2); solid(s < 0 ? -16.7 : 16.1, 0, 25.8, s < 0 ? -16.1 : 16.7, 0.85, 31.4, 'metal');
    }
    L.box(-5, 0, 24.5, 5, 0.6, 31.7, 'concrete', { top: 'greyClean' }); W.add(-5, 0.6, 24.5, 5, GUARD, 31.7, { shoot: false, nav: false });
    const tri = (a, b, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 0.5, 1, 1, 0], 2)); g.computeVertexNormals(); L.addGeo('glassDay', g, new THREE.Matrix4()); };
    const sk = [[-4.8, 0.6, 24.7], [4.8, 0.6, 24.7], [4.8, 0.6, 31.5], [-4.8, 0.6, 31.5]], apexA = [-1.6, 2.6, 28.1], apexB = [1.6, 2.6, 28.1];
    tri(sk[0], sk[1], apexB); tri(sk[0], apexB, apexA); tri(sk[2], sk[3], apexA); tri(sk[2], apexA, apexB); tri(sk[1], sk[2], apexB); tri(sk[3], sk[0], apexA);
    L.pipe('steel', apexA[0], apexA[1], apexA[2], apexB[0], apexB[1], apexB[2], 0.05);
    for (const p of sk) L.pipe('steel', p[0], p[1], p[2], p[0] < 0 ? apexA[0] : apexB[0], apexA[1], apexA[2], 0.04);
    for (let x = -3.6; x <= 3.6; x += 1.2) { const ax = U.clamp(x, -1.6, 1.6); L.pipe('steel', x, 0.6, 24.7, ax, 2.6, 28.1, 0.025); L.pipe('steel', x, 0.6, 31.5, ax, 2.6, 28.1, 0.025); }
    // cover out in the yard: planters in front of the offices, AC units, vents, a generator, pallets
    const planter = (x0, z0, x1, z1) => { L.box(x0, 0, z0, x1, 0.9, z1, 'hrStone', { top: 'dirt', uvScale: 1 / 3.6 }); for (let a = 0.15; a < 1; a += 0.35) K.bush(x0 + (x1 - x0) * a, (z0 + z1) / 2, 0.5, 0.9, true); };
    planter(-11.5, -1.5, -8.5, -0.5); planter(8.5, -1.5, 11.5, -0.5);
    P('ac', -20, 12, 0); P('ac', 20.5, 13.5, Math.PI / 2); P('ac', -14.5, 22.8, 0); P('vent', 15, 22.5); P('vent', -21.5, 18.5); P('vent', 24.5, 18);
    P('generator', 22.5, 9, 0); P('boxStack', -24, 8.5, 0.3); P('crate', 14.8, 7.2, 0.1); P('crateSmall', 15.3, 5.9, -0.2);
    P('barrel', -16, -2.5); P('drum', 18, -2.8); P('bin', 0.9, -4.4);
  }

  // ------------------------------------------------------------ east: the building site, the plank deck, the crane
  function column(x, z) {
    L.box(x - 0.18, 0, z - 0.03, x + 0.18, 9.4, z + 0.03, 'rust');
    for (const d of [-1, 1]) L.box(x - 0.18, 0, z + d * 0.18 - 0.02, x + 0.18, 9.4, z + d * 0.18 + 0.02, 'rust', { noCol: true });
    solid(x - 0.18, 0, z - 0.2, x + 0.18, 9.4, z + 0.2, 'metal');
    deco(x - 0.3, 0, z - 0.3, x + 0.3, 0.05, z + 0.3, 'steel');
  }
  function construction(rnd) {
    const A = art();
    // steel frame for the floor above: columns, beams across the top
    const cols = [];
    for (const x of [30, 38, 46]) for (const z of [-28, -20, -12, -4, 4]) cols.push([x, z]);
    for (const [x, z] of cols) column(x, z);
    for (const x of [30, 38, 46]) deco(x - 0.12, 9.0, -28, x + 0.12, 9.38, 4, 'rust');
    for (const z of [-28, -20, -12, -4, 4]) deco(30, 9.05, z - 0.11, 46, 9.35, z + 0.11, 'rust');
    deco(24.2, 0, -31.7, 49.7, 0.006, 8, 'concreteDark');
    // the plank deck at the north end, on beams, rails round the open sides, a gap to drop off
    L.box(34, SD - 0.3, -31.7, 49.7, SD, -14, 'steel', { top: 'plywood', side: 'rust' });
    for (let z = -30; z < -14; z += 2) deco(34, SD - 0.55, z - 0.1, 49.7, SD - 0.3, z + 0.1, 'rust');
    for (let x = 35; x < 49.7; x += 2.4) deco(x - 0.01, SD, -31.7, x + 0.01, SD + 0.004, -14, 'woodDark');
    rail('z', -29.7, -16.2, 34, SD, 'paintYellow'); rail('x', 34, 40, -14, SD, 'paintYellow'); rail('x', 44, 49.7, -14, SD, 'paintYellow');
    deco(40, SD - 0.3, -14.03, 44, SD, -13.97, 'hazard');
    steps('x', 25.5, 34, -31.7, -29.7, 0, SD, 1, 'steel', 'grate'); slopeGuard('x', 25.5, 34, -29.65, 0, SD, 1);
    steps('x', 25.5, 34, -16.2, -14.2, 0, SD, 1, 'steel', 'grate'); slopeGuard('x', 25.5, 34, -16.25, 0, SD, 1); slopeGuard('x', 25.5, 34, -14.15, 0, SD, 1);
    // on the deck: steel beams, rebar, gas bottles on a cart, a welder, sheets of ply
    for (let i = 0; i < 3; i++) { L.box(40, SD + i * 0.3, -27 + i * 0.05, 46, SD + i * 0.3 + 0.28, -26.4 + i * 0.05, 'rust', { noCol: true }); }
    solid(40, SD, -27, 46, SD + 0.9, -26.3, 'metal');
    for (let i = 0; i < 14; i++) L.pipe('rust', 36.2, SD + 0.06 + (i % 3) * 0.05, -21 + i * 0.05, 42.5, SD + 0.06 + (i % 3) * 0.05, -21 + i * 0.05, 0.02);
    for (const x of [37, 41.5]) deco(x - 0.15, SD, -21.2, x + 0.15, SD + 0.06, -20.2, 'woodDark');
    solid(36.2, SD, -21.2, 42.5, SD + 0.25, -20.2, 'metal');
    for (const [dz, m] of [[0, 'paintRed'], [0.35, 'paintGreen']]) L.cyl(m, 47.8, SD + 0.75, -24 + dz, 0.14, 1.5, 0, 0, true);
    deco(47.5, SD, -24.3, 48.1, SD + 0.1, -23.3, 'paintDark'); solid(47.5, SD, -24.3, 48.1, SD + 1.5, -23.3, 'metal');
    L.box(44.5, SD, -17.5, 45.5, SD + 0.8, -16.5, 'paintYellow', { top: 'paintDark' });
    for (let i = 0; i < 6; i++) deco(36, SD + i * 0.02, -30.8, 38.4, SD + i * 0.02 + 0.018, -29.6, 'plywood'); solid(36, SD, -30.8, 38.4, SD + 0.12, -29.6);
    for (const [x, z] of [[46, -30.6], [37, -15]]) { K.sph('paintYellow', x, SD + 0.1, z, 0.16, 0.12, 0.16); }
    L.addPickup('ammo', 47, SD, -30.4);
    // under the deck: cement on pallets, drywall, a light tower, a generator
    for (const [x, z] of [[36, -25], [36, -22.8]]) { deco(x - 0.6, 0, z - 0.5, x + 0.6, 0.12, z + 0.5, 'wood'); for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) K.put('sandbag', L.geo('box'), x - 0.28 + k * 0.56, 0.2 + r * 0.14, z, 0.52, 0.13, 0.9); solid(x - 0.6, 0, z - 0.5, x + 0.6, 0.7, z + 0.5); }
    for (let i = 0; i < 8; i++) deco(42, 0.1 + i * 0.016, -30.6, 44.4, 0.115 + i * 0.016, -29.4, 'wallClean'); deco(42.1, 0, -30.5, 44.3, 0.1, -29.5, 'wood'); solid(42, 0, -30.6, 44.4, 0.25, -29.4);
    P('generator', 47.6, -20, Math.PI / 2); P('crate', 47.9, -28.3, 0.2); P('drum', 39.2, -17.4); P('drum', 39.9, -16.9, 0.4);
    L.lamp(42, 3.4, -24, { color: 0xfff0d8, intensity: 1.2, distance: 12, pool: false }); batten(42, SD - 0.55, -24, true, 1.2); batten(42, SD - 0.55, -18, true, 1.2);
    // the open floor: formwork, rebar, a concrete bucket, cones and barriers, a scissor lift
    for (let i = 0; i < 4; i++) deco(26, i * 0.1, -26 + i * 0.02, 28.4, i * 0.1 + 0.09, -24.8 + i * 0.02, 'plywood'); solid(26, 0, -26, 28.4, 0.4, -24.7);
    for (let i = 0; i < 18; i++) L.pipe('rust', 32.4 + (i % 6) * 0.07, 0.08 + ((i / 6) | 0) * 0.07, -9.5, 32.4 + (i % 6) * 0.07, 0.08 + ((i / 6) | 0) * 0.07, -3.5, 0.025);
    for (const z of [-9, -4]) deco(32.2, 0, z - 0.15, 33.0, 0.06, z + 0.15, 'woodDark'); solid(32.2, 0, -9.5, 33.0, 0.3, -3.5, 'metal');
    L.cyl('paintGrey', 27.5, 1.1, -18, 0.7, 1.2, 0, 0, false); K.put('paintGrey', L.geo('cone'), 27.5, 0.3, -18, 0.7, 0.6, 0.7, 0, Math.PI); deco(26.7, 1.7, -18.05, 28.3, 1.8, -17.95, 'paintYellow'); solid(26.8, 0, -18.7, 28.2, 1.7, -17.3, 'metal');
    const barrier = (x, z, alongX) => { const a = alongX ? 1 : 0.2, b = alongX ? 0.2 : 1; deco(x - a, 0, z - b, x + a, 0.06, z + b, 'paintDark'); L.box(x - a * 0.9, 0.3, z - b * 0.9, x + a * 0.9, 0.95, z + b * 0.9, 'paintRed', { noCol: true, ao: false }); for (const y of [0.5, 0.75]) deco(x - a * 0.91, y, z - b * 0.91, x + a * 0.91, y + 0.1, z + b * 0.91, 'appliance'); for (const d of [-0.8, 0.8]) deco(x + (alongX ? d : 0) - 0.03, 0, z + (alongX ? 0 : d) - 0.03, x + (alongX ? d : 0) + 0.03, 0.3, z + (alongX ? 0 : d) + 0.03, 'steel'); solid(x - a, 0, z - b, x + a, 0.95, z + b); };
    barrier(26.2, -6, false); barrier(26.2, -2, false); barrier(35.5, 6, true);
    const cone = (x, z) => { K.put('paintRed', L.geo('cone'), x, 0.36, z, 0.17, 0.7, 0.17); deco(x - 0.2, 0, z - 0.2, x + 0.2, 0.04, z + 0.2, 'paintDark'); deco(x - 0.1, 0.4, z - 0.1, x + 0.1, 0.48, z + 0.1, 'appliance'); };
    for (const [x, z] of [[27, -10], [28, -12.5], [36, 2], [48.4, 6.5], [34, -12]]) cone(x, z);
    L.box(34.6, 0, -1, 36.6, 0.4, 2.6, 'paintYellow', { top: 'paintDark' }); for (const d of [-0.6, 0.6]) { L.pipe('paintDark', 34.9, 0.4, 0.8 + d, 36.3, 2.1, 0.8 - d, 0.04); L.pipe('paintDark', 34.9, 2.1, 0.8 + d, 36.3, 0.4, 0.8 - d, 0.04); }
    L.box(34.5, 2.1, -1.1, 36.7, 2.2, 2.7, 'grate', { noCol: true }); rail('x', 34.5, 36.7, -1.05, 2.2, 'paintYellow'); solid(34.6, 0, -1, 36.6, 2.2, 2.6, 'metal'); W.add(34.5, 2.2, -1.1, 36.7, GUARD, 2.7, { shoot: false, nav: false });
    sign(A.safety, 3, 0.75, 34, 1.1, -31.66, 0);
    L.lamp(38, 5, -6, { color: 0xfff0d8, intensity: 1.0, distance: 14, pool: false });
    // the south-east: site cabins on the edge, a skip, a mixer, bricks, a portable toilet
    for (const [x0, x1] of [[33, 39.1], [40.4, 46.5]]) {
      L.box(x0, 0, 29.26, x1, 2.7, 31.7, 'panelWhite', { top: 'paintGrey' }); W.add(x0, 2.7, 29.26, x1, GUARD, 31.7, { shoot: false, nav: false });
      for (let x = x0 + 0.8; x < x1 - 2.5; x += 1.8) { deco(x, 1.1, 29.22, x + 1.1, 2.0, 29.26, 'glassDay'); deco(x - 0.05, 1.05, 29.2, x + 1.15, 1.1, 29.26, 'paintDark'); }
      deco(x1 - 1.2, 0.05, 29.22, x1 - 0.3, 2.2, 29.26, 'paintBlue'); deco(x1 - 1.3, 2.2, 29.2, x1 - 0.2, 2.3, 29.26, 'paintDark');
      for (let x = x0 + 0.5; x < x1; x += 2) deco(x, 0, 29.3, x + 0.3, 0.15, 31.6, 'concreteDark');
    }
    sign(A.builder, 3.6, 0.9, 36, 2.35, 29.2, Math.PI);
    L.box(28, 0, 24, 31.6, 1.5, 26, 'paintYellow', { top: 'rust' }); deco(28.1, 1.5, 24.1, 31.5, 1.52, 25.9, 'concreteDark'); for (let i = 0; i < 5; i++) deco(28.3 + i * 0.6, 1.5, 24.3 + (i % 2) * 0.8, 28.8 + i * 0.6, 1.62, 24.9 + (i % 2) * 0.8, i % 2 ? 'plywood' : 'rust');
    L.cyl('paintRed', 33.5, 1.2, 18, 0.65, 1.3, 0, Math.PI / 2 - 0.4, false); deco(32.6, 0, 17.4, 34.4, 0.6, 18.6, 'paintDark'); L.cyl('rubber', 32.8, 0.3, 17.35, 0.3, 0.15, Math.PI / 2, 0, false); L.cyl('rubber', 32.8, 0.3, 18.65, 0.3, 0.15, Math.PI / 2, 0, false); solid(32.4, 0, 17.3, 34.6, 1.8, 18.7, 'metal');
    for (const [x, z] of [[44, 18], [45.4, 18]]) { deco(x - 0.6, 0, z - 0.5, x + 0.6, 0.12, z + 0.5, 'wood'); L.box(x - 0.55, 0.12, z - 0.45, x + 0.55, 0.95, z + 0.45, 'brick', { ao: false }); }
    solid(43.4, 0, 17.5, 46, 0.95, 18.5);
    L.box(48.3, 0, 21.4, 49.6, 2.4, 22.7, 'paintBlue', { top: 'appliance' }); deco(48.26, 0.1, 21.6, 48.3, 2.2, 22.5, 'paintBlue'); W.add(48.3, 2.4, 21.4, 49.6, GUARD, 22.7, { shoot: false, nav: false });
    P('crate', 30, 14, 0.2); P('crateSmall', 31.2, 14.4, -0.3); P('drum', 46.5, 12); P('drum', 47.2, 12.6, 0.5); P('boxStack', 27.5, 20.5, 0.2);
    for (const [x, z] of [[40, 24.5], [41.2, 22.4]]) { L.cyl('wood', x, 0.75, z, 0.75, 0.08, Math.PI / 2, 0, false); L.cyl('rubber', x, 0.75, z, 0.5, 0.7, Math.PI / 2, 0, false); solid(x - 0.75, 0, z - 0.4, x + 0.75, 1.5, z + 0.4); }
    // the crane
    crane();
  }
  function crane() {
    const A = art(), cx = CR.x, cz = CR.z, H = CR.top;
    L.box(cx - 2.5, 0, cz - 2.5, cx + 2.5, 0.8, cz + 2.5, 'concrete', { top: 'concreteDark' });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { deco(cx + dx - 0.25, 0.8, cz + dz - 0.25, cx + dx + 0.25, 0.9, cz + dz + 0.25, 'paintYellow'); }
    W.add(cx - 2.5, 0.8, cz - 2.5, cx + 2.5, 60, cz + 2.5, { shoot: false, nav: false }); // no climbing the crane
    deco(cx - 2.52, 0, cz - 2.52, cx + 2.52, 0.3, cz - 2.5, 'hazard'); deco(cx - 2.52, 0, cz + 2.5, cx + 2.52, 0.3, cz + 2.52, 'hazard');
    // the mast: four chords and zigzag bracing
    const m = 'paintYellow', c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [dx, dz] of c) L.pipe(m, cx + dx, 0.9, cz + dz, cx + dx, H, cz + dz, 0.09);
    for (let y = 0.9; y < H - 0.1; y += 2.5) for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4], y1 = Math.min(H, y + 2.5);
      L.pipe(m, cx + a[0], y, cz + a[1], cx + b[0], y1, cz + b[1], 0.045); L.pipe(m, cx + a[0], y, cz + a[1], cx + b[0], y, cz + b[1], 0.04);
    }
    for (let y = 3; y < H - 2; y += 6) { L.pipe('steel', cx - 0.8, y, cz - 1.0, cx - 0.8, y + 5.8, cz - 1.0, 0.02); }
    // the slewing unit, the cab, the tower head
    L.box(cx - 1.4, H, cz - 1.4, cx + 1.4, H + 1.0, cz + 1.4, 'paintYellow', { noCol: true });
    L.box(cx + 1.4, H + 0.1, cz + 1.1, cx + 3.2, H + 2.3, cz + 2.9, 'paintYellow', { noCol: true }); deco(cx + 3.2, H + 1.0, cz + 1.2, cx + 3.22, H + 2.1, cz + 2.8, 'glassDay'); deco(cx + 1.6, H + 1.0, cz + 2.9, cx + 3.1, H + 2.1, cz + 2.92, 'glassDay');
    for (const [dx, dz] of c) L.pipe(m, cx + dx * 0.9, H + 1.0, cz + dz * 0.9, cx, H + 8.5, cz, 0.08);
    K.sph('lampRed', cx, H + 8.7, cz, 0.2);
    // the jib to the west, triangular lattice
    const J0 = cx - 1, J1 = cx - 56, yb = H + 1.0, yt = H + 2.8;
    for (const d of [-0.8, 0.8]) L.pipe(m, J0, yb, cz + d, J1, yb, cz + d, 0.07);
    L.pipe(m, J0, yt, cz, J1 + 1, yt, cz, 0.07);
    for (let x = J0; x > J1 + 0.5; x -= 2.5) {
      const x1 = Math.max(J1, x - 2.5);
      for (const d of [-0.8, 0.8]) L.pipe(m, x, yb, cz + d, x1 + 1.25, yt, cz, 0.035), L.pipe(m, x1 + 1.25, yt, cz, x1, yb, cz + d, 0.035);
      L.pipe(m, x, yb, cz - 0.8, x, yb, cz + 0.8, 0.03);
    }
    for (let x = J0 - 1; x > J1 + 1; x -= 0.5) deco(x - 0.2, yb - 0.02, cz - 0.3, x, yb + 0.02, cz + 0.3, 'grate');
    K.sph('lampRed', J1, yt + 0.1, cz, 0.16);
    for (const sd of [-1, 1]) { deco(J0 - 9, yb + 0.2, cz + sd * 0.86 - 0.02, J0 - 3, yb + 1.6, cz + sd * 0.86 + 0.02, 'paintDark'); sign(A.builder, 5.8, 1.4, J0 - 6, yb + 0.9, cz + sd * 0.89, sd > 0 ? 0 : Math.PI); }
    // the counter-jib to the east with its concrete blocks, out over the street
    for (const d of [-0.9, 0.9]) L.pipe(m, cx + 1, yb, cz + d, cx + 16, yb, cz + d, 0.08);
    for (let x = cx + 1; x < cx + 16; x += 2.5) L.pipe(m, x, yb, cz - 0.9, x, yb, cz + 0.9, 0.04);
    for (let i = 0; i < 4; i++) L.box(cx + 11 + i * 1.2, yb - 1.6, cz - 1.0, cx + 12.1 + i * 1.2, yb + 0.6, cz + 1.0, 'concreteDark', { noCol: true });
    deco(cx + 3, yb + 0.05, cz - 0.9, cx + 7, yb + 1.3, cz + 0.9, 'paintGrey');
    // tie bars from the head to the jib and the counter-jib
    L.pipe('steel', cx, H + 8.5, cz, J0 - 22, yt, cz, 0.04); L.pipe('steel', cx, H + 8.5, cz, J0 - 44, yt, cz, 0.04);
    for (const d of [-0.9, 0.9]) L.pipe('steel', cx, H + 8.5, cz, cx + 15, yb + 0.3, cz + d, 0.04);
    // the trolley and a bundle of beams on the hook, swaying a little
    const tx = cx - 34;
    L.box(tx - 0.8, yb - 0.5, cz - 1.0, tx + 0.8, yb, cz + 1.0, 'paintYellow', { noCol: true });
    const g = new THREE.Group(), mats = L.mats, hookY = 20;
    const mk = (geo, mat, x, y, z, sx, sy, sz, rx, rz) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, 0, rz || 0); o.castShadow = true; g.add(o); };
    const drop = yb - 0.5 - hookY;
    for (const d of [-0.25, 0.25]) mk(new THREE.CylinderGeometry(1, 1, 1, 6), mats.steel, 0, -drop / 2, d, 0.02, drop, 0.02);
    mk(new THREE.BoxGeometry(1, 1, 1), mats.paintYellow, 0, -drop - 0.3, 0, 0.8, 0.6, 0.7);
    mk(new THREE.TorusGeometry(0.22, 0.06, 6, 12, 4.2), mats.paintDark, 0, -drop - 0.85, 0, 1, 1, 1, 0, 0);
    for (const d of [-1.6, 1.6]) mk(new THREE.CylinderGeometry(1, 1, 1, 6), mats.steel, d / 2, -drop - 2.1, 0, 0.015, 2.6, 0.015, 0, d > 0 ? 0.55 : -0.55);
    for (let i = 0; i < 3; i++) mk(new THREE.BoxGeometry(1, 1, 1), mats.rust, 0, -drop - 3.35 + (i === 2 ? 0.3 : 0), (i === 2 ? 0 : i ? 0.18 : -0.18), 7, 0.3, 0.3);
    g.position.set(tx, yb - 0.5, cz); L.scene.add(g);
    L.animated.push((dt, t) => { g.rotation.z = Math.sin(t * 0.31) * 0.012; g.rotation.x = Math.sin(t * 0.23 + 1) * 0.01; g.rotation.y = Math.sin(t * 0.07) * 0.25; });
  }

  // ------------------------------------------------------------ beyond the edge: the city
  function city(rnd) {
    L.box(-700, BOTTOM - 1, -700, 700, BOTTOM, 700, 'asphalt', { noCol: true, ao: false });
    const mats = ['hrBlue', 'hrGold', 'hrTeal', 'hrStone', 'hrBlue', 'hrTeal'];
    const tower = (x, z, w, d, top, m) => {
      L.box(x - w / 2, BOTTOM, z - d / 2, x + w / 2, top, z + d / 2, m, { noCol: true, ao: false, uvScale: 1 / 3.6, top: 'concreteDark' });
      if (rnd() < 0.7) { const pw = w * (0.3 + rnd() * 0.3), pd = d * (0.3 + rnd() * 0.3); L.box(x - pw / 2, top, z - pd / 2, x + pw / 2, top + 3 + rnd() * 4, z + pd / 2, 'greyClean', { noCol: true, ao: false }); }
      if (rnd() < 0.4) { const h = 8 + rnd() * 16; L.cyl('steel', x, top + h / 2, z, 0.25, h, 0, 0, true); K.sph('lampRed', x, top + h + 0.2, z, 0.5); }
      if (rnd() < 0.3) { const s = Math.min(w, d) * 0.8; L.box(x - s / 2, top, z - s / 2, x + s / 2, top + 0.2, z + s / 2, 'concrete', { noCol: true, ao: false }); }
    };
    // close neighbours: a taller tower over the building site, a lower one to the west, one looming north
    tower(92, -8, 26, 30, 28, 'hrGold'); tower(-96, 22, 30, 26, -14, 'hrStone'); tower(12, -92, 34, 24, 58, 'hrTeal'); tower(-60, -84, 22, 22, 14, 'hrBlue');
    tower(70, 80, 28, 28, -30, 'hrBlue'); tower(-20, 96, 24, 30, 6, 'hrGold');
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, r = 125 + rnd() * 300, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const near = r < 200, w = 18 + rnd() * 24, d = 18 + rnd() * 24, top = (near ? -70 + rnd() * 110 : -110 + rnd() * 190);
      tower(x, z, w, d, top, mats[i % mats.length]);
    }
  }

  // ------------------------------------------------------------ build
  MH.build = function () {
    K = CF.MapNuketown.kit;
    const rnd = U.mulberry32(8111);
    materials();
    deck();
    edge();
    offices();
    officeGround(rnd);
    officeUpper(rnd);
    helipad(rnd);
    terrace(rnd);
    courtyard(rnd);
    construction(rnd);
    city(rnd);
    L.killY = -20;

    // spawns: the helipad side (west) against the building site (east); each list's middle point is its flag stand
    // (every point is on the bots' navigation grid: nothing under the helipad, the plank deck or the offices' upper floor)
    L.spawns.t0 = [[-48.3, 0, -16], [-28, 0, -14], [-35, HP, -21.5], [-44, 0, 1], [-39, 0, 3], [-32, 0, 7.5], [-43, 0, 16.5]];
    L.spawns.t1 = [[40, SD, -18.5], [31, 0, -9], [46.5, 0, 8], [38, 0, 13], [40, 0, 20.5], [31, 0, 28], [28, 0, -22]];
    const mid = [[-16, UF, -23.5], [16, UF, -17], [0, UF, -21], [-6, UF, -12], [-18, 0, 19.5], [18, 0, 21],
      [0, WD, 11.5], [-9, 0, -3], [9, 0, -3], [-28, 0, -26], [31.5, 0, -24], [0, 0, 22], [-20, 0, 9], [20, 0, 1]];
    L.spawns.ffa = L.spawns.t0.concat(L.spawns.t1, mid);
    L.points.start = { x: -39, y: 0, z: 3, yaw: -Math.PI / 2 };
  };
})(window.CF);
