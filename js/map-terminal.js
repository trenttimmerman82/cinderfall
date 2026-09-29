'use strict';
/* Cinderfall — TERMINAL (multiplayer), after the Modern Warfare 2 map: an airport terminal on a sunny afternoon.
   Ground floor, west to east: the security checkpoint (queue, X-ray lanes, metal detectors), the double-height atrium
   with its escalators, food court, duty-free and restrooms, Burger Town, the bookstore, the concourse and the baggage room.
   Upstairs: the business lounge and bar, a catwalk along the glass over the atrium, the south mezzanine and the Gate 21
   lounge. Out on the apron an airliner stands at the jet bridge; walk in through the bridge or up the rear airstairs,
   down the aisle and out the other door. A retracted jet bridge, ground equipment and ULD stacks give cover outside,
   and the taxi rank out front is the other team's side. Axes: +X east, +Z south. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MT = CF.MapTerminal = {};
  let K = null; // Nuketown's building kit (js/map-nuketown.js)

  const T = 0.25;                                   // wall thickness
  const FL = 0.05, CE = 4.35, UP = 4.6, RT = 9.6;   // ground floor, ground ceiling, upper floor, roof underside
  const X0 = -46, X1 = 30, Z0 = -10, Z1 = 18;       // terminal footprint
  const PF = 3.6, ZC = -31, R = 2.4, CY = PF + 1.1; // airliner: cabin floor, fuselage axis z, radius, axis height
  const FD = [12.6, 13.8], RD = [-16.4, -15.2];     // front and rear doors (south side)

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
  const glassO = { shoot: false, ao: false };
  /** Floor slab whose top is at y; the underside is a ceiling. */
  const slab = (x0, z0, x1, z1, y, top, m) => L.box(x0, y - 0.25, z0, x1, y, z1, m || 'ceilTile', { top, side: 'paintDark', bottom: true });
  /** Solid staircase. axis 'x' climbs along X over a0..a1 (b = the Z span), 'z' climbs along Z. up = +1 rises toward a1, -1 toward a0. */
  function steps(axis, a0, a1, b0, b1, yBase, yTop, up, m, topM) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, yBase, b0, s1, top, b1, m, { top: topM }); else L.box(b0, yBase, s0, b1, top, s1, m, { top: topM });
    }
  }
  /** Open steel stair: treads on two stringers. */
  function openSteps(axis, a0, a1, b0, b1, yBase, yTop, up, m) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, top - 0.06, b0, s1, top, b1, 'grate', { ao: false }); else L.box(b0, top - 0.06, s0, b1, top, s1, 'grate', { ao: false });
    }
    const lo = up > 0 ? a0 : a1, hi = up > 0 ? a1 : a0;
    for (const b of [b0 + 0.05, b1 - 0.05]) {
      if (axis === 'x') { L.pipe(m, lo, yBase, b, hi, yTop - rise, b, 0.07); L.pipe('steel', lo, yBase + 1, b, hi, yTop + 0.95, b, 0.025); }
      else { L.pipe(m, b, yBase, lo, b, yTop - rise, hi, 0.07); L.pipe('steel', b, yBase + 1, lo, b, yTop + 0.95, hi, 0.025); }
    }
    slopeGuard(axis, a0, a1, b0 - 0.05, yBase, yTop, up); slopeGuard(axis, a0, a1, b1 + 0.05, yBase, yTop, up);
  }
  /** Invisible, bullet-transparent handrail colliders along a stair or escalator edge (c = the edge line). */
  function slopeGuard(axis, a0, a1, c, yBase, yTop, up) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const s0 = a0 + (a1 - a0) * i / n, s1 = a0 + (a1 - a0) * (i + 1) / n, k = up > 0 ? (i + 1) / n : 1 - i / n, y = yBase + (yTop - yBase) * k;
      if (axis === 'x') W.add(s0, yBase, c - 0.04, s1, y + 1.05, c + 0.04, { shoot: false }); else W.add(c - 0.04, yBase, s0, c + 0.04, y + 1.05, s1, { shoot: false });
    }
  }
  /** A layer split around openings [a0, a1, y0, y1] (the kit's wall skin, with collider options). */
  function cut(axis, a0, a1, c, t, y0, y1, holes, m, o) {
    const B = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      if (axis === 'x') L.box(p0, q0, c - t / 2, p1, q1, c + t / 2, m, o); else L.box(c - t / 2, q0, p0, c + t / 2, q1, p1, m, o);
    };
    K.holeSpans(a0, a1, y0, y1, holes, B);
  }
  /** Glass: players stop, bullets pass. */
  const glass = (axis, a0, a1, c, y0, y1, holes) => cut(axis, a0, a1, c, 0.04, y0, y1, holes || [], 'glassClear', glassO);
  /** Glass balustrade on a steel shoe with a cap rail. */
  function glassRail(axis, a0, a1, c, y) {
    const b = (p0, p1, q0, q1, t, m, o) => axis === 'x' ? L.box(p0, q0, c - t, p1, q1, c + t, m, o) : L.box(c - t, q0, p0, c + t, q1, p1, m, o);
    b(a0, a1, y, y + 0.1, 0.05, 'steel', { noCol: true, ao: false });
    b(a0, a1, y + 0.1, y + 1.0, 0.015, 'glassClear', glassO);
    b(a0, a1, y + 1.0, y + 1.06, 0.04, 'steel', { noCol: true, ao: false });
    W.add(axis === 'x' ? a0 : c - 0.06, y, axis === 'x' ? c - 0.06 : a0, axis === 'x' ? a1 : c + 0.06, y + 1.06, axis === 'x' ? c + 0.06 : a1, { shoot: false });
  }
  /** Two-sided flat quad (sloped glass, belts, skirts) baked into a batch. */
  function quad(m, a, b, c, d) {
    const g = new THREE.BufferGeometry(), p = [...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const uv = []; for (let i = 0; i < 12; i++) { const q = p.slice(i * 3, i * 3 + 3); uv.push((q[0] + q[2]) * 0.5, q[1] * 0.5); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); L.addGeo(m, g, new THREE.Matrix4());
  }
  /** Round structural column with a steel foot. */
  function column(x, z, y0, y1) {
    L.cyl('wallClean', x, (y0 + y1) / 2, z, 0.34, y1 - y0, 0, 0, false); L.cyl('steel', x, y0 + 0.08, z, 0.37, 0.16, 0, 0, false);
    W.addCyl(x, z, 0.34, y0, y1, { surf: 'concrete' });
  }
  /** Ceiling light: a glowing panel and a pooled real light. */
  function light(x, y, z, big) {
    const s = big ? 0.6 : 0.3;
    deco(x - s, y - 0.04, z - s, x + s, y, z + s, 'lampCool');
    L.lamp(x, y - 0.3, z, { color: 0xf1f4ff, intensity: big ? 1.8 : 1.3, distance: big ? 16 : 10, pool: false });
  }
  /** Pendant: a cable and a dome shade over a warm bulb. */
  function pendant(x, y, z, drop) {
    L.pipe('paintDark', x, y, z, x, y - drop, z, 0.012);
    K.put('paintDark', K.geo('sphere'), x, y - drop, z, 0.45, 0.2, 0.45); K.sph('lampWarm', x, y - drop - 0.08, z, 0.22, 0.06, 0.22);
    L.lamp(x, y - drop - 0.3, z, { color: 0xffe2b8, intensity: 1.4, distance: 12, pool: false });
  }
  /** Beam seating: n linked seats along axis 'x' or 'z', facing +1/-1 on the other axis. */
  function seats(axis, a0, n, c, face, y, m) {
    y = y || FL; m = m || 'seatBlue';
    const pitch = 0.62, a1 = a0 + n * pitch;
    const bx = (p0, p1, y0, y1, q0, q1, mm) => axis === 'x' ? deco(p0, y0, c + q0, p1, y1, c + q1, mm) : deco(c + q0, y0, p0, c + q1, y1, p1, mm);
    const sn = (q0, q1) => face > 0 ? [q0, q1] : [-q1, -q0];
    bx(a0, a1, y + 0.3, y + 0.36, ...sn(-0.12, 0.12), 'steel');
    for (let i = 0; i < n; i++) {
      const s0 = a0 + i * pitch + 0.03, s1 = s0 + pitch - 0.06;
      bx(s0, s1, y + 0.38, y + 0.46, ...sn(-0.26, 0.24), m);
      bx(s0, s1, y + 0.46, y + 0.92, ...sn(-0.3, -0.24), m);
    }
    for (let i = 0; i <= n; i++) { const a = a0 + i * pitch; bx(a - 0.025, a + 0.025, y + 0.46, y + 0.62, ...sn(-0.26, 0.18), 'steel'); }
    for (const a of [a0 + 0.2, a1 - 0.2]) bx(a - 0.04, a + 0.04, y, y + 0.32, ...sn(-0.05, 0.05), 'steel');
    if (axis === 'x') { solid(a0, y, c - 0.3, a1, y + 0.46, c + 0.3); solid(a0, y + 0.46, c + (face > 0 ? -0.3 : 0.24), a1, y + 0.92, c + (face > 0 ? -0.24 : 0.3)); }
    else { solid(c - 0.3, y, a0, c + 0.3, y + 0.46, a1); solid(c + (face > 0 ? -0.3 : 0.24), y + 0.46, a0, c + (face > 0 ? -0.24 : 0.3), y + 0.92, a1); }
  }
  const BAG = ['paintRed', 'paintBlue', 'paintDark', 'olive', 'paintGreen', 'paintMint', 'greyClean', 'paintCherry', 'leather', 'paintYellow'];
  /** Suitcase with a handle. */
  function suitcase(x, y, z, w, h, d, rnd, col) {
    const m = BAG[(rnd() * BAG.length) | 0];
    deco(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, m);
    deco(x - 0.08, y + h, z - 0.015, x + 0.08, y + h + 0.03, z + 0.015, 'rubber');
    if (col) solid(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2);
  }
  /** Chrome stanchions with a retractable belt between each pair. */
  function stanchions(pts) {
    for (const [x, z] of pts) { L.cyl('chrome', x, 0.5, z, 0.03, 1.0, 0, 0, true); L.cyl('paintDark', x, 0.03, z, 0.17, 0.05, 0, 0, true); K.sph('chrome', x, 1.0, z, 0.045); }
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      if (ax === bx) deco(ax - 0.012, 0.86, Math.min(az, bz), ax + 0.012, 0.93, Math.max(az, bz), 'seatBlue');
      else deco(Math.min(ax, bx), 0.86, az - 0.012, Math.max(ax, bx), 0.93, az + 0.012, 'seatBlue');
      W.add(Math.min(ax, bx) - 0.05, 0, Math.min(az, bz) - 0.05, Math.max(ax, bx) + 0.05, 1.0, Math.max(az, bz) + 0.05, { shoot: false });
    }
  }
  function cone(x, z) {
    K.put('panelOrange', K.geo('cone'), x, 0.36, z, 0.17, 0.66, 0.17); L.cyl('appliance', x, 0.42, z, 0.115, 0.1, 0, 0, true);
    deco(x - 0.22, 0, z - 0.22, x + 0.22, 0.04, z + 0.22, 'panelOrange');
  }
  function bollard(x, z, y) { y = y || 0; L.cyl('paintDark', x, y + 0.45, z, 0.12, 0.9, 0, 0, true); L.cyl('paintYellow', x, y + 0.78, z, 0.125, 0.08, 0, 0, true); W.addCyl(x, z, 0.12, y, y + 0.9, { surf: 'metal' }); }
  function trash(x, z, y) { y = y || FL; L.cyl('steel', x, y + 0.45, z, 0.28, 0.9, 0, 0, false); L.cyl('paintDark', x, y + 0.92, z, 0.3, 0.05, 0, 0, false); W.addCyl(x, z, 0.28, y, y + 0.95, { surf: 'metal' }); CF.PH.mark('bin', x, y, z); }
  function plant(x, z, y, s) {
    y = y || FL; s = s || 1;
    L.box(x - 0.4 * s, y, z - 0.4 * s, x + 0.4 * s, y + 0.7 * s, z + 0.4 * s, 'paintDark', { top: 'dirt' });
    for (let i = 0; i < 4; i++) K.put(i % 2 ? 'leaves' : 'leaves2', K.blobGeo(i % 3), x + Math.cos(i * 1.7) * 0.18 * s, y + (0.95 + i * 0.22) * s, z + Math.sin(i * 1.7) * 0.18 * s, 0.32 * s, 0.28 * s, 0.32 * s, i);
    L.pipe('bark', x, y + 0.6 * s, z, x, y + 1.3 * s, z, 0.03);
  }
  function jersey(x0, z0, x1, z1) { // concrete barrier along X or Z
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), l = alongX ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = K.extrude('jersey', [[-0.3, 0], [0.3, 0], [0.3, 0.08], [0.14, 0.3], [0.1, 0.82], [-0.1, 0.82], [-0.14, 0.3], [-0.3, 0.08]], 1, 0);
    K.put('concrete', g, cx, 0, cz, 1, 1, Math.abs(l), alongX ? Math.PI / 2 : 0);
    solid(alongX ? x0 : cx - 0.3, 0, alongX ? cz - 0.3 : z0, alongX ? x1 : cx + 0.3, 0.82, alongX ? cz + 0.3 : z1);
  }

  // ------------------------------------------------------------ canvas art
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const ct = (w, h, draw) => K.canvasTex(w, h, draw);
    const font = (px, bold) => (bold ? 'bold ' : '') + px + 'px Arial, Helvetica, sans-serif';
    ART.burger = ct(1024, 192, (x, w, h) => {
      x.fillStyle = '#b3161b'; x.fillRect(0, 0, w, h); x.fillStyle = '#f5c518'; x.fillRect(0, h - 18, w, 18); x.fillRect(0, 0, w, 10);
      x.fillStyle = '#f5c518'; x.beginPath(); x.arc(110, 96, 70, Math.PI, 0); x.fill(); x.fillStyle = '#6b3a1a'; x.fillRect(40, 100, 140, 22); x.fillStyle = '#5fae3a'; x.fillRect(46, 92, 128, 8);
      x.fillStyle = '#f5c518'; x.beginPath(); x.moveTo(40, 126); x.lineTo(180, 126); x.lineTo(172, 150); x.lineTo(48, 150); x.fill();
      x.font = font(104, true); x.textAlign = 'left'; x.lineWidth = 8; x.strokeStyle = '#fff'; x.strokeText('BURGER TOWN', 220, 134); x.fillStyle = '#f5c518'; x.fillText('BURGER TOWN', 220, 134);
    });
    ART.menu = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#1b1b1b'; x.fillRect(0, 0, w, h); x.fillStyle = '#b3161b'; x.fillRect(0, 0, w, 44);
      x.fillStyle = '#fff'; x.font = font(30, true); x.textAlign = 'center'; x.fillText('COMBO MEALS · КОМБО', w / 2, 32);
      const items = [['1  Town Burger', '349'], ['2  Double Stack', '429'], ['3  Chicken Tenders', '299'], ['4  Fish Burger', '319'], ['5  Kids Meal', '199']];
      x.textAlign = 'left'; x.font = font(24);
      items.forEach((it, i) => { x.fillStyle = i % 2 ? '#f5c518' : '#fff'; x.fillText(it[0], 24, 80 + i * 38); x.textAlign = 'right'; x.fillText(it[1] + ' ₽', w - 24, 80 + i * 38); x.textAlign = 'left'; });
    });
    ART.menu2 = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#1b1b1b'; x.fillRect(0, 0, w, h);
      const pic = (cx, cy, c1, c2) => { x.fillStyle = c1; x.beginPath(); x.arc(cx, cy, 44, Math.PI, 0); x.fill(); x.fillStyle = '#6b3a1a'; x.fillRect(cx - 50, cy, 100, 16); x.fillStyle = c2; x.fillRect(cx - 50, cy - 6, 100, 6); x.fillStyle = c1; x.fillRect(cx - 46, cy + 16, 92, 18); };
      pic(100, 90, '#e0a030', '#5fae3a'); pic(256, 90, '#e0a030', '#e04030'); x.fillStyle = '#d02020'; x.fillRect(372, 50, 60, 80); x.fillStyle = '#f5c518'; for (let i = 0; i < 8; i++) x.fillRect(376 + i * 7, 30 + (i % 3) * 6, 5, 40);
      x.fillStyle = '#fff'; x.font = font(26, true); x.textAlign = 'center'; x.fillText('TOWN BURGER', 100, 180); x.fillText('SPICY STACK', 256, 180); x.fillText('FRIES', 402, 180);
      x.fillStyle = '#f5c518'; x.font = font(24); x.fillText('249 ₽', 100, 216); x.fillText('289 ₽', 256, 216); x.fillText('99 ₽', 402, 216);
    });
    ART.books = ct(512, 160, (x, w, h) => {
      x.fillStyle = '#1f4d3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9e0c8'; x.font = font(64, true); x.textAlign = 'center'; x.fillText('BOOKS · NEWS', w / 2, 76);
      x.font = font(34); x.fillText('КНИГИ · ПРЕССА', w / 2, 128);
    });
    ART.duty = ct(512, 128, (x, w, h) => {
      x.fillStyle = '#10204a'; x.fillRect(0, 0, w, h); x.fillStyle = '#e2b34a'; x.font = font(62, true); x.textAlign = 'center'; x.fillText('DUTY FREE', w / 2, 64);
      x.font = font(24); x.fillText('БЕСПОШЛИННАЯ ТОРГОВЛЯ', w / 2, 104);
    });
    const way = (lines, bg, fg) => ct(512, 128, (x, w, h) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.textAlign = 'left';
      x.font = font(50, true); x.fillText(lines[0], 22, 58); x.font = font(32); x.fillText(lines[1], 22, 104);
    });
    ART.gates = way(['←  Gates 18–24', 'Выход на посадку'], '#1c1c1c', '#f5c518');
    ART.baggage = way(['Baggage  →', 'Выдача багажа'], '#1c1c1c', '#f5c518');
    ART.security = way(['Security Check', 'Досмотр'], '#1c1c1c', '#f5c518');
    ART.exit = way(['EXIT  →', 'Выход в город'], '#1d6e3a', '#ffffff');
    ART.wc = way(['WC   ♂ ♀', 'Туалеты'], '#1c1c1c', '#f5c518');
    ART.lounge = way(['Business Lounge', 'Бизнес-зал'], '#3a2a1e', '#e2b34a');
    ART.gate21 = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#123a7a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = font(150, true); x.textAlign = 'left'; x.fillText('21', 26, 170);
      x.font = font(44, true); x.fillText('GATE', 250, 92); x.font = font(34); x.fillText('Выход', 250, 138);
      x.fillStyle = '#f5c518'; x.fillRect(250, 162, 236, 4); x.fillStyle = '#fff'; x.font = font(28); x.fillText('SU 1470  Berlin', 250, 206); x.fillText('Boarding 15:40', 250, 240);
    });
    ART.gate20 = ct(512, 256, (x, w, h) => {
      x.fillStyle = '#123a7a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = font(150, true); x.textAlign = 'left'; x.fillText('20', 26, 170);
      x.font = font(44, true); x.fillText('GATE', 250, 92); x.font = font(34); x.fillText('Выход', 250, 138); x.fillStyle = '#ff6a4a'; x.font = font(32, true); x.fillText('CLOSED', 250, 210);
    });
    ART.depart = ct(1024, 512, (x, w, h) => {
      x.fillStyle = '#0b0d10'; x.fillRect(0, 0, w, h); x.fillStyle = '#123a7a'; x.fillRect(0, 0, w, 64);
      x.fillStyle = '#fff'; x.font = font(40, true); x.textAlign = 'left'; x.fillText('DEPARTURES   ВЫЛЕТ', 24, 46); x.textAlign = 'right'; x.fillText('15:12', w - 24, 46);
      const rows = [['15:25', 'SU 2074', 'LONDON', '18', 'BOARDING'], ['15:40', 'SU 1470', 'BERLIN', '21', 'BOARDING'], ['15:55', 'AF 1045', 'PARIS', '24', 'ON TIME'], ['16:10', 'SU 1134', 'NOVOSIBIRSK', '19', 'DELAYED'],
        ['16:20', 'LH 1447', 'FRANKFURT', '22', 'ON TIME'], ['16:45', 'SU 1402', 'ST PETERSBURG', '20', 'CANCELLED'], ['17:05', 'TK 414', 'ISTANBUL', '23', 'ON TIME'], ['17:30', 'SU 206', 'BEIJING', '18', 'GATE OPEN']];
      x.font = font(30, true);
      rows.forEach((r, i) => {
        const y = 110 + i * 50; x.fillStyle = i % 2 ? '#14171c' : '#0b0d10'; x.fillRect(0, y - 34, w, 50);
        x.textAlign = 'left'; x.fillStyle = '#f5c518'; x.fillText(r[0], 24, y); x.fillText(r[1], 150, y); x.fillText(r[2], 340, y); x.fillText(r[3], 690, y);
        x.fillStyle = r[4] === 'DELAYED' || r[4] === 'CANCELLED' ? '#ff5a3c' : r[4] === 'ON TIME' ? '#7fe38f' : '#7fd8ff'; x.fillText(r[4], 780, y);
      });
    });
    ART.name = ct(2048, 160, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = '#123a7a'; x.textAlign = 'center';
      x.font = font(96, true); x.fillText('ZAKHAEV INTERNATIONAL AIRPORT', w / 2, 92); x.font = font(44); x.fillText('МЕЖДУНАРОДНЫЙ АЭРОПОРТ ЗАХАЕВ', w / 2, 146);
    });
    ART.stand = ct(256, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#e8b52a'; x.font = font(180, true); x.textAlign = 'center'; x.fillText('21', w / 2, 190); });
    ART.tail = ct(512, 512, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = '#1c3d86'; x.beginPath(); x.moveTo(40, 470); x.bezierCurveTo(180, 300, 330, 180, 480, 40); x.lineTo(480, 170); x.bezierCurveTo(360, 280, 240, 380, 150, 470); x.fill();
      x.fillStyle = '#d3a13c'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 36 : 90; x.lineTo(300 + Math.cos(a) * r, 200 + Math.sin(a) * r); } x.fill();
    });
    ART.poster = ct(256, 384, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f0a040'); g.addColorStop(1, '#b3261e'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#2a1a3a'; for (const [cx, r] of [[70, 40], [130, 56], [196, 38]]) { x.fillRect(cx - r * 0.5, 190, r, 120); x.beginPath(); x.arc(cx, 190, r * 0.55, Math.PI, 0); x.fill(); x.beginPath(); x.moveTo(cx - 8, 150 - r * 0.2); x.lineTo(cx, 110 - r * 0.4); x.lineTo(cx + 8, 150 - r * 0.2); x.fill(); }
      x.fillRect(0, 300, w, 84); x.fillStyle = '#fff'; x.font = font(34, true); x.textAlign = 'center'; x.fillText('VISIT', w / 2, 44); x.fillText('MOSCOW', w / 2, 82); x.font = font(20); x.fillText('Посетите Москву', w / 2, 346);
    });
    ART.poster2 = ct(256, 384, (x, w, h) => {
      x.fillStyle = '#10141c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d3a13c'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, 170, 80, 0, 6.3); x.stroke();
      x.lineWidth = 5; x.beginPath(); x.moveTo(w / 2, 170); x.lineTo(w / 2, 110); x.moveTo(w / 2, 170); x.lineTo(w / 2 + 44, 190); x.stroke();
      x.fillStyle = '#e9e0c8'; x.font = font(30, true); x.textAlign = 'center'; x.fillText('TIME IS', w / 2, 300); x.fillText('EVERYTHING', w / 2, 338);
    });
    ART.title = (north) => ct(128, 2048, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.save(); x.translate(w / 2, h / 2); x.rotate(north ? -Math.PI / 2 : Math.PI / 2);
      x.fillStyle = '#1c3d86'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(100, true); x.fillText('AEROVOLGA', 0, 0); x.restore();
    });
    // repeating shelf faces: 2 m wide, 2 m tall, five shelves of books / four of bottles
    ART.booksTex = ct(512, 512, (x, w, h) => {
      const rnd = U.mulberry32(77), cols = ['#8a2a22', '#23466e', '#2e5a36', '#c8a040', '#e9e0c8', '#402a5a', '#1c1c1c', '#b85a24', '#5a7a8a', '#9a3a5a'];
      x.fillStyle = '#3a2a1e'; x.fillRect(0, 0, w, h);
      for (let r = 0; r < 5; r++) {
        const y1 = h - r * h / 5 - 10, y0 = y1 - h / 5 + 16;
        for (let bx = 4; bx < w - 6;) { const bw = 7 + rnd() * 12, bh = (y1 - y0) * (0.62 + rnd() * 0.36); x.fillStyle = cols[(rnd() * cols.length) | 0]; x.fillRect(bx, y1 - bh, bw - 1, bh); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(bx + 1, y1 - bh + 6, bw - 3, 3); bx += bw + (rnd() < 0.08 ? 14 : 0); }
        x.fillStyle = '#6b4a2e'; x.fillRect(0, y1, w, 10);
      }
    });
    ART.bottlesTex = ct(512, 512, (x, w, h) => {
      const rnd = U.mulberry32(78), cols = ['#5a3a12', '#2a5a2a', '#c8d8e0', '#8a1a1a', '#d8b050', '#1a2a4a'];
      x.fillStyle = '#e8e4dc'; x.fillRect(0, 0, w, h);
      for (let r = 0; r < 4; r++) {
        const y1 = h - r * h / 4 - 8;
        for (let bx = 10; bx < w - 20; bx += 22 + rnd() * 6) {
          const bh = 70 + rnd() * 40, c = cols[(rnd() * cols.length) | 0];
          x.fillStyle = c; x.fillRect(bx, y1 - bh + 26, 16, bh - 26); x.fillRect(bx + 5, y1 - bh, 6, 28);
          x.fillStyle = '#f4efe0'; x.fillRect(bx + 1, y1 - bh * 0.55, 14, 18); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(bx + 2, y1 - bh + 30, 3, bh - 40);
        }
        x.fillStyle = '#9aa1aa'; x.fillRect(0, y1, w, 8);
      }
    });
    ART.chain = ct(64, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#c7ccd0'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke(); });
    ART.chain.wrapS = ART.chain.wrapT = THREE.RepeatWrapping;
    ART.chainMat = new THREE.MeshStandardMaterial({ map: ART.chain, alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.45 });
    return ART;
  }
  /** Canvas textures as batch materials (repeating shelf faces, UVs from world position). */
  function shelfMats() {
    const A = art();
    for (const [k, t] of [['books', A.booksTex], ['bottles', A.bottlesTex]]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; L.mats[k] = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.8, metalness: 0 }); }
  }
  /** A sign on both faces of a hanging box. */
  function hangSign(tex, x, y, z, w, h, alongX, drop) {
    const t = 0.08;
    if (alongX) { deco(x - w / 2, y - h / 2, z - t, x + w / 2, y + h / 2, z + t, 'paintDark'); K.plane(tex, w - 0.06, h - 0.06, x, y, z + t + 0.005, 0); K.plane(tex, w - 0.06, h - 0.06, x, y, z - t - 0.005, Math.PI); }
    else { deco(x - t, y - h / 2, z - w / 2, x + t, y + h / 2, z + w / 2, 'paintDark'); K.plane(tex, w - 0.06, h - 0.06, x + t + 0.005, y, z, Math.PI / 2); K.plane(tex, w - 0.06, h - 0.06, x - t - 0.005, y, z, -Math.PI / 2); }
    if (drop) for (const s of [-1, 1]) { const px = alongX ? x + s * w * 0.4 : x, pz = alongX ? z : z + s * w * 0.4; L.pipe('steel', px, y + h / 2, pz, px, y + h / 2 + drop, pz, 0.012); }
  }
  /** A painted marking lying flat on the ground. */
  function flatSign(tex, w, h, x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.set(-Math.PI / 2, 0, ry || 0); m.position.set(x, y, z); m.receiveShadow = true; L.scene.add(m);
  }
  function chainFence(x0, z0, x1, z1, h) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), g = new THREE.PlaneGeometry(len, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.7, uv.getY(i) * h / 0.7);
    const m = new THREE.Mesh(g, art().chainMat);
    m.position.set((x0 + x1) / 2, h / 2 + 0.05, (z0 + z1) / 2); m.rotation.y = Math.atan2(-dz, dx); m.receiveShadow = true; L.scene.add(m);
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) { const k = i / n; L.cyl('steel', x0 + dx * k, (h + 0.45) / 2, z0 + dz * k, 0.045, h + 0.45, 0, 0, true); }
    L.pipe('steel', x0, h, z0, x1, h, z1, 0.03);
    for (let j = 1; j <= 3; j++) L.pipe('steel', x0, h + j * 0.13, z0, x1, h + j * 0.13, z1, 0.008);
  }

  // ------------------------------------------------------------ the building shell: floors, facades, roof, columns
  function shell() {
    // ground floor, with other floors laid over it room by room
    L.box(X0, -0.3, Z0, X1, FL, Z1, 'terrazzo', { side: 'concreteDark' });
    deco(20 + T / 2, FL, Z0 + 0.03, X1 - T / 2, FL + 0.006, Z1 - T / 2, 'concrete');
    deco(-6 + T / 2, FL, 12.4, 8 - T / 2, FL + 0.006, Z1 - T / 2, 'checker'); deco(-11 + T / 2, FL, 8 + T / 2, -6 - T / 2, FL + 0.006, Z1 - T / 2, 'checker');
    deco(8 + T / 2, FL, 4 + T / 2, 20 - T / 2, FL + 0.006, Z1 - T / 2, 'floorWood'); deco(-44, FL, 9, -30, FL + 0.006, 16.5, 'carpetBlue');
    // upper floor: west lounge, catwalk and mezzanine round the atrium void (-26..-6, -6..8), the gate lounge; stair holes NW and E
    slab(X0, Z0, -44, -8.6, UP, 'carpetBeige'); slab(X0, -1, -44, Z1, UP, 'carpetBeige'); slab(-44, Z0, -26, Z1, UP, 'carpetBeige');
    slab(-26, Z0, -6, -6, UP, 'terrazzo'); slab(-26, 8, -6, Z1, UP, 'terrazzo');
    slab(-6, Z0, 28, Z1, UP, 'carpetBlue'); slab(28, Z0, X1, 9, UP, 'carpetBlue'); slab(28, 16.5, X1, Z1, UP, 'carpetBlue');
    // north: the glass curtain wall over both floors (doors to the apron, the jet bridge doors, a steel baggage front)
    const gHoles = [[-31, -29, 0, 2.6], [1, 3.4, 0, 2.6]], uHoles = [[-35.9, -33.7, UP, UP + 2.45], [12.1, 14.3, UP, UP + 2.45]];
    glass('x', X0 + 0.1, 20, Z0, FL, CE, gHoles); glass('x', X0 + 0.1, X1 - 0.1, Z0, UP, RT, uHoles);
    K.wall('x', 20, X1, Z0, 0, CE, [[23, 27, 0, 3.4]], [[0, 0.8, 'concreteDark'], [0.8, CE, 'metalSiding']], [[0, 1.2, 'greyClean'], [1.2, CE, 'wallClean']], -1, { noLeaf: true });
    deco(X0, CE - 0.05, Z0 - 0.14, X1, UP + 0.12, Z0 + 0.03, 'paintDark');
    const openAt = (x, y) => gHoles.concat(uHoles, [[23, 27, 0, 3.4]]).some((h) => x > h[0] - 0.08 && x < h[1] + 0.08 && y >= h[2] && y < h[3]);
    for (let x = X0 + 3; x < X1 - 0.5; x += 3) {
      if (!openAt(x, 1) && x < 20) deco(x - 0.05, 0, Z0 - 0.12, x + 0.05, CE, Z0 + 0.05, 'paintDark');
      if (!openAt(x, UP + 1)) deco(x - 0.05, UP, Z0 - 0.12, x + 0.05, RT, Z0 + 0.05, 'paintDark');
    }
    deco(X0, 2.6, Z0 - 0.1, 20, 2.68, Z0 + 0.04, 'paintDark'); deco(X0, 7.05, Z0 - 0.1, X1, 7.13, Z0 + 0.04, 'paintDark'); deco(X0, RT - 0.3, Z0 - 0.16, X1, RT + 0.45, Z0 + 0.03, 'panelWhite');
    for (const [a, b] of [[-31, -29], [1, 3.4]]) { deco(a - 0.4, 2.75, Z0 - 1.4, b + 0.4, 2.9, Z0, 'paintDark'); deco(a - 0.9, FL, Z0 - 0.06, a - 0.1, 2.55, Z0 - 0.02, 'glassClear'); deco(b + 0.1, FL, Z0 - 0.06, b + 0.9, 2.55, Z0 - 0.02, 'glassClear'); }
    // south: the landside front with the entrances, a ribbon of clerestory glass upstairs
    const OUT = [[0, 0.8, 'concreteDark'], [0.8, RT, 'panelWhite']], IN = [[0, 0.15, 'paintDark'], [0.15, RT, 'wallClean']];
    const sWin = [[-31, -27, 1.0, 3.2], [-44, -28, 6.2, 8.8], [-24, -8, 6.2, 8.8], [-4, 18, 6.2, 8.8], [22, 28, 6.2, 8.8]];
    K.wall('x', X0, X1, Z1, 0, RT, [[-40, -35.5, 0, 2.8], [-16, -12, 0, 2.8]].concat(sWin), OUT, IN, 1, { noLeaf: true });
    for (const h of sWin) glass('x', h[0], h[1], Z1, h[2], h[3]);
    // west and east ends
    const wWin = [[0.5, 3.5, 1.0, 3.2], [-8, 0, 6.2, 8.8], [4, 16, 6.2, 8.8]];
    K.wall('z', Z0, Z1, X0, 0, RT, [[12, 14, 0, 2.6]].concat(wWin), OUT, IN, -1, { noLeaf: true });
    for (const h of wWin) glass('z', h[0], h[1], X0, h[2], h[3]);
    const eWin = [[-6, 6, 6.2, 8.8]];
    K.wall('z', Z0, Z1, X1, 0, RT, [[-4, -2, 0, 2.6]].concat(eWin), OUT, IN, 1, { noLeaf: true });
    for (const h of eWin) glass('z', h[0], h[1], X1, h[2], h[3]);
    // roof with a long skylight over the atrium, steel trusses under it, a parapet and plant on top
    const roof = (a, b, c, d) => L.box(a, RT, b, c, RT + 0.45, d, 'ceiling', { top: 'concreteDark', side: 'panelWhite', bottom: true });
    roof(X0, Z0, X1, -4); roof(X0, 6, X1, Z1); roof(X0, -4, -24, 6); roof(-8, -4, X1, 6);
    deco(-24, RT + 0.3, -4, -8, RT + 0.34, 6, 'glassClear'); for (let x = -22; x < -8; x += 2) deco(x - 0.04, RT + 0.2, -4, x + 0.04, RT + 0.4, 6, 'steel');
    K.roofCap(X0 - 1, Z0 - 1, X1 + 1, Z1 + 1, RT + 0.45);
    for (const [a, b, c, d] of [[X0, Z0, X1, Z0 + 0.3], [X0, Z1 - 0.3, X1, Z1], [X0, Z0, X0 + 0.3, Z1], [X1 - 0.3, Z0, X1, Z1]]) deco(a, RT + 0.45, b, c, RT + 1.2, d, 'panelWhite');
    for (const [x, z] of [[-38, 12], [-30, 12], [14, 12], [22, 0]]) { deco(x - 1.4, RT + 0.45, z - 1, x + 1.4, RT + 1.8, z + 1, 'greyClean'); L.cyl('steel', x, RT + 1.9, z, 0.5, 0.2, 0, 0, true); }
    for (let x = X0 + 4; x < X1; x += 6) {
      if (x > -24 && x < -8) continue;
      deco(x - 0.1, RT - 0.55, Z0 + 0.3, x + 0.1, RT, Z1 - 0.3, 'greyClean');
    }
    for (const z of [-4, 6]) deco(-24, RT - 0.7, z - 0.12, -8, RT, z + 0.12, 'greyClean');
    for (let x = -22; x < -8; x += 4) { deco(x - 0.08, RT - 0.4, -4, x + 0.08, RT, 6, 'greyClean'); for (let z = -3; z < 6; z += 2) L.pipe('greyClean', x, RT - 0.4, z, x, RT - 0.05, z + 1, 0.03); }
    // columns
    for (const [x, z] of [[-36, -6], [-16, -6], [-6, -6], [5, -6], [16.5, -6], [-36, 8], [-16, 8], [-6, 8], [5, 2]]) column(x, z, FL, RT);
    // atrium void edges: glass balustrades (the escalators land on the east edge at z 0.1..3.1)
    glassRail('x', -26, -6, -6, UP); glassRail('x', -26, -6, 8, UP); glassRail('z', -6, 8, -26, UP);
    glassRail('z', -6, 0.1, -6, UP); glassRail('z', 3.1, 8, -6, UP);
    // ceiling lights: ground floor panels and the upstairs pendants
    for (const [x, z] of [[-40, -6], [-32, -6], [-40, 1], [-32, 1], [-40, 11], [-32, 11], [-40, 16], [-32, 16], [-21, -8], [-11, -8], [-14, 13], [-2, -7], [10, -7], [-2, -1], [10, -1], [16, 0], [24, -6], [24, 3], [24, 12]]) light(x, CE, z);
    for (const [x, z] of [[-40, -4], [-32, -4], [-40, 6], [-32, 6], [-40, 14], [-16, -8], [-16, 13], [0, -6], [0, 4], [0, 13], [10, -6], [10, 4], [10, 13], [22, -6], [22, 4], [24, 9]]) pendant(x, RT - 0.05, z, 2.4);
    L.lamp(-16, RT - 1, 1, { color: 0xfff4e0, intensity: 2.2, distance: 20, pool: false });
  }

  // ------------------------------------------------------------ security checkpoint (west, ground floor)
  function security(rnd) {
    const A = art();
    // the screening line: a half-glass partition with three lanes, each an X-ray machine and a walk-through arch
    const lanes = [-42, -36.5, -31], holes = [];
    for (const lx of lanes) holes.push([lx - 0.6, lx + 0.6, 0, 2.6], [lx + 0.9, lx + 2.5, 0, 1.7]);
    cut('x', X0 + T / 2, -26, 4, 0.12, FL, 1.1, holes, 'panelWhite', {});
    glass('x', X0 + T / 2, -26, 4, 1.1, 2.6, holes); deco(X0 + T / 2, 2.6, 3.92, -26, 2.7, 4.08, 'steel');
    cut('z', 4, 8, -26, 0.12, FL, 1.1, [], 'panelWhite', {}); glass('z', 4, 8, -26, 1.1, 2.6); deco(-26.08, 2.6, 4, -25.92, 2.7, 8, 'steel');
    for (const lx of lanes) {
      // walk-through metal detector
      for (const s of [-1, 1]) L.box(lx + s * 0.53 - 0.07, FL, 3.75, lx + s * 0.53 + 0.07, 2.25, 4.25, 'greyClean', { ao: false });
      deco(lx - 0.6, 2.25, 3.72, lx + 0.6, 2.45, 4.28, 'greyClean'); K.sph('lampGreen', lx - 0.3, 2.47, 4, 0.05); K.sph('lampRed', lx + 0.3, 2.47, 4, 0.05);
      // X-ray machine: body, tunnel mouth with curtains, loading belt landside, roller table airside
      const x0 = lx + 0.9, x1 = lx + 2.5;
      L.box(x0, FL, 3.0, x1, 1.65, 5.0, 'greyClean', { top: 'appliance' });
      for (const z of [2.99, 5.01]) { deco(x0 + 0.15, 0.85, z - 0.012, x1 - 0.15, 1.45, z + 0.012, 'paintDark'); for (let x = x0 + 0.2; x < x1 - 0.2; x += 0.12) deco(x, 0.9, z - 0.02, x + 0.1, 1.42, z + 0.02, 'rubber'); }
      L.box(x0 + 0.1, FL, 5.0, x1 - 0.1, 0.85, 7.6, 'paintDark', { top: 'rubber' });
      L.box(x0 + 0.1, FL, 0.8, x1 - 0.1, 0.8, 3.0, 'steel', { top: 'steel' });
      for (let z = 0.95; z < 3; z += 0.18) L.cyl('chrome', (x0 + x1) / 2, 0.82, z, 0.035, x1 - x0 - 0.3, 0, Math.PI / 2, true);
      for (const [z, y] of [[6.2, 0.85], [1.6, 0.86], [2.4, 0.86]]) { deco(x0 + 0.3, y, z - 0.3, x1 - 0.3, y + 0.12, z + 0.3, 'greyClean'); if (rnd() < 0.7) suitcase((x0 + x1) / 2, y + 0.12, z, 0.45, 0.2, 0.3, rnd); }
      // operator's desk and screen
      L.box(x1 + 0.2, FL, 2.4, x1 + 1.1, 0.8, 3.4, 'panelWhite', { top: 'counter' });
      deco(x1 + 0.5, 0.8, 2.6, x1 + 0.56, 1.3, 3.2, 'paintDark'); deco(x1 + 0.565, 0.85, 2.65, x1 + 0.57, 1.25, 3.15, 'windowCool');
      P('stool', x1 + 0.7, 2.0, 0, FL);
      // tray stack on the landside
      for (let i = 0; i < 6; i++) deco(lx - 1.3, FL + i * 0.08, 6.6, lx - 0.7, FL + i * 0.08 + 0.07, 7.2, 'greyClean');
      solid(lx - 1.3, FL, 6.6, lx - 0.7, FL + 0.5, 7.2, 'metal');
    }
    hangSign(A.security, -36.5, 3.5, 5.2, 3.6, 0.9, true, CE - 3.95);
    // the queue: a serpentine of stanchions, the ID podium, the landside entrance
    const line = (a, b, z) => { const pts = [], n = Math.round((b - a) / 2.1); for (let i = 0; i <= n; i++) pts.push([a + (b - a) * i / n, z]); stanchions(pts); };
    line(-43.5, -31, 15.8); line(-41.5, -29, 13.8); line(-43.5, -31, 11.8); line(-41.5, -29, 9.8);
    L.box(-29, FL, 8.7, -27.6, 1.15, 9.4, 'panelBlue', { top: 'counter' }); deco(-28.8, 1.15, 8.8, -28.4, 1.2, 9.2, 'paintDark'); K.sph('lampWarm', -28.1, 1.5, 9.05, 0.08);
    L.cyl('paintDark', -28.1, 1.3, 9.05, 0.015, 0.3, 0, 0, true);
    for (const x of [-44.5, -27.2]) { L.box(x - 0.6, FL, 16.6, x + 0.6, 0.45, 17.6, 'steel'); for (let i = 0; i < 3; i++) deco(x - 0.55 + i * 0.4, 0.45, 16.7, x - 0.2 + i * 0.4, 0.9, 17.5, 'seatBlue'); }
    // luggage trolleys and a family's bags left in the queue
    for (const [x, z] of [[-33, 17], [-34.2, 17.2], [-38.5, 12.8]]) trolley(x, z, rnd);
    suitcase(-35.5, FL, 12.8, 0.45, 0.65, 0.3, rnd, true); suitcase(-36.1, FL, 12.8, 0.4, 0.55, 0.26, rnd, true);
    // airside: re-dressing benches and bins
    L.box(-44.5, FL, -0.8, -40.5, 0.45, 0.2, 'woodDark', { top: 'wood' }); L.box(-39, FL, -0.8, -35, 0.45, 0.2, 'woodDark', { top: 'wood' });
    trash(-33.5, -0.3); trash(-27.5, 1.5);
    K.plane(A.poster, 1.2, 1.8, -45.85, 2.2, 7, Math.PI / 2); K.plane(A.poster2, 1.2, 1.8, -45.85, 2.2, -4.5, Math.PI / 2);
    // the west stair up to the business lounge (bottom at z -1, top at z -8.6)
    steps('z', -8.6, -1, X0 + T / 2, -44.2, FL, UP, -1, 'paintDark', 'terrazzo');
    slopeGuard('z', -8.6, -1, -44.15, FL, UP, -1); L.pipe('steel', -44.15, FL + 1, -1, -44.15, UP + 1, -8.6, 0.03);
    for (let z = -8.2; z < -1; z += 1.2) { const y = FL + (UP - FL) * (-1 - z) / 7.6; L.pipe('steel', -44.15, y, z, -44.15, y + 1, z, 0.018); }
    K.railingZ(-8.6, -1, -44, UP); K.railingX(X0 + T / 2, -44, -1, UP);
  }
  function trolley(x, z, rnd) { // luggage trolley along X
    deco(x - 0.5, 0.2, z - 0.3, x + 0.5, 0.25, z + 0.3, 'steel');
    L.pipe('chrome', x - 0.5, 0.25, z - 0.28, x - 0.62, 1.05, z - 0.28, 0.02); L.pipe('chrome', x - 0.5, 0.25, z + 0.28, x - 0.62, 1.05, z + 0.28, 0.02); L.pipe('rubber', x - 0.62, 1.05, z - 0.3, x - 0.62, 1.05, z + 0.3, 0.03);
    for (const [dx, dz] of [[-0.4, -0.25], [-0.4, 0.25], [0.4, -0.25], [0.4, 0.25]]) L.cyl('rubber', x + dx, 0.1, z + dz, 0.1, 0.05, Math.PI / 2, 0, true);
    suitcase(x + 0.05, 0.25, z, 0.8, 0.28, 0.5, rnd); if (rnd() < 0.7) suitcase(x, 0.53, z, 0.6, 0.35, 0.4, rnd);
    solid(x - 0.62, 0, z - 0.32, x + 0.5, 0.9, z + 0.32, 'metal');
  }

  // ------------------------------------------------------------ the atrium: escalators, food court, info desk, corridor to the street
  function atrium(rnd) {
    const A = art();
    // escalators: up the east side of the void, two lanes, landing on the gate lounge
    const ex0 = -15, ex1 = -6;
    steps('x', ex0, ex1, 0.1, 3.1, FL, UP, 1, 'steel', 'grate');
    for (const z of [0.08, 3.12]) quad('greyClean', [ex0 - 0.6, 0, z], [ex1, 0, z], [ex1, UP, z], [ex0, FL + 0.02, z]);
    for (const z of [0.12, 1.6, 3.08]) {
      const t = z === 1.6 ? 0.1 : 0.03;
      quad('glassClear', [ex0 - 1, FL + 0.1, z], [ex0, FL + 0.1, z], [ex0, FL + 1.0, z], [ex0 - 1, FL + 1.0, z]);
      quad('glassClear', [ex0, FL + 0.1, z], [ex1, UP + 0.1, z], [ex1, UP + 1.0, z], [ex0, FL + 1.0, z]);
      L.pipe('rubber', ex0 - 1, FL + 1.02, z, ex0, FL + 1.02, z, 0.045); L.pipe('rubber', ex0, FL + 1.02, z, ex1, UP + 1.02, z, 0.045); L.pipe('rubber', ex1, UP + 1.02, z, ex1 + 0.6, UP + 1.02, z, 0.045);
      if (z === 1.6) { quad('greyClean', [ex0 - 1, FL + 0.1, z - t], [ex1, UP + 0.1, z - t], [ex1, UP + 0.1, z + t], [ex0 - 1, FL + 0.1, z + t]); }
      slopeGuard('x', ex0, ex1, z, FL, UP, 1); W.add(ex0 - 1, FL, z - 0.04, ex0, FL + 1.05, z + 0.04, { shoot: false });
    }
    for (const [x, y] of [[ex0 - 1, FL], [ex1, UP]]) { deco(x, y, 0.1, x + 1, y + 0.012, 3.1, 'steel'); for (let z = 0.2; z < 3.1; z += 0.1) deco(x + (x < ex0 ? 0.9 : 0), y + 0.012, z, x + (x < ex0 ? 1 : 0.1), y + 0.02, z + 0.05, 'paintYellow'); }
    const en = Math.round((UP - FL) / 0.27), ed = (ex1 - ex0) / (en - 1);
    for (let i = 1; i < en; i++) { const x = ex0 + (i - 1) * ed, y = FL + (UP - FL) * i / en; deco(x, y - 0.005, 0.12, x + 0.05, y + 0.004, 3.08, 'paintYellow'); }
    // food court: round tables with chairs west of the escalators
    for (const [x, z] of [[-23.5, -3.5], [-20, -3.5], [-23.5, 0.5], [-20, 0.5], [-23.5, 4.5], [-20, 4.5], [-17.2, 6]]) {
      L.cyl('steel', x, FL + 0.37, z, 0.05, 0.74, 0, 0, true); L.cyl('paintDark', x, FL + 0.02, z, 0.3, 0.04, 0, 0, true); L.cyl('counter', x, FL + 0.76, z, 0.55, 0.04, 0, 0, false);
      solid(x - 0.45, FL, z - 0.45, x + 0.45, FL + 0.78, z + 0.45);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4 + rnd() * 0.3; if (rnd() < 0.85) P('chair', x + Math.cos(a) * 0.9, z + Math.sin(a) * 0.9, -a + Math.PI / 2, FL); }
      if (rnd() < 0.6) { deco(x - 0.2, FL + 0.78, z - 0.15, x + 0.2, FL + 0.8, z + 0.15, 'paintCherry'); L.cyl('paintCherry', x + 0.1, FL + 0.88, z, 0.04, 0.16, 0, 0, true); }
    }
    plant(-25, -5, FL, 1.3); plant(-25, 7, FL, 1.3); plant(-7.3, 6.8, FL, 1.3); plant(-7.3, -4.8, FL, 1.3);
    trash(-17.5, -1.5); trash(-24.8, 2.4);
    // information desk under the catwalk
    L.box(-22, FL, -8.6, -18, 1.05, -7.6, 'panelBlue', { top: 'counter' }); L.box(-22.2, 1.05, -8.8, -17.8, 1.12, -7.4, 'counter', { noCol: true });
    deco(-21.5, 1.12, -8.5, -21, 1.5, -8.45, 'paintDark'); deco(-19, 1.12, -8.5, -18.5, 1.5, -8.45, 'paintDark');
    K.sph('lampCool', -20, 3.2, -8.1, 0.3, 0.3, 0.05); P('stool', -21, -9.2, 0, FL); P('stool', -19, -9.2, 0, FL);
    // the big departures board hung over the void, readable from both floors
    hangSign(A.depart, -16, 7.4, -5.2, 6, 3, true, RT - 8.9);
    hangSign(A.gates, -10.5, 3.3, -2, 2.4, 0.6, true, RT - 3.6);
    hangSign(A.baggage, -1, 3.4, -4, 2.4, 0.6, true, CE - 3.7);
    hangSign(A.exit, -14, 3.4, 8.8, 2.4, 0.6, true, CE - 3.7);
    // corridor out to the street: ads, a cash machine, vending, benches
    K.plane(A.poster, 1.2, 1.8, -16.86, 2, 12, Math.PI / 2); K.plane(A.poster2, 1.2, 1.8, -11.14, 2, 14, -Math.PI / 2);
    L.box(-11.13 - 0.55, FL, 16.2, -11.13, 1.7, 17.2, 'greyClean'); deco(-11.7, 1.1, 16.4, -11.68, 1.5, 17.0, 'windowCool'); deco(-11.72, 0.95, 16.5, -11.68, 1.02, 16.9, 'paintDark');
    P('vending', -16.3, 16.9, Math.PI / 2, FL);
    seats('z', 9.4, 4, -16.4, 1, FL);
  }

  // ------------------------------------------------------------ duty-free shop and restrooms (south side of the atrium)
  function dutyFree(rnd) {
    const A = art(), SHOP = [[0, 0.15, 'paintDark'], [0.15, CE, 'wallClean']];
    K.wall('z', 8, Z1, -26, 0, CE, [], null, SHOP, 0);
    cut('x', -26, -17, 8, 0.1, FL, 2.8, [[-22.5, -20.5, 0, 2.8]], 'glassClear', glassO);
    for (const x of [-26, -22.5, -20.5, -17]) deco(x - 0.04, FL, 7.92, x + 0.04, 2.8, 8.08, 'steel');
    L.box(-26, 2.8, 7.88, -17, CE, 8.12, 'paintDark', { ao: false });
    K.plane(A.duty, 3.6, 0.9, -21.5, 3.55, 7.86, Math.PI);
    K.wall('z', 8, Z1, -17, 0, CE, [[15, 16.4, 0, 2.3]], null, SHOP, 0);
    const bo = { top: 'steel', side: 'bottles', uvScale: 0.5 };
    L.box(-26 + T / 2, FL, 9, -25.4, 2.05, 17, 'steel', bo); L.box(-25.4, FL, Z1 - 0.7, -18, 2.05, Z1 - T / 2, 'steel', bo);
    for (const x of [-23.3, -20.3]) L.box(x - 0.45, FL, 11, x + 0.45, 1.55, 15.5, 'steel', bo);
    // perfume counters: glass cases with bottles inside, the till by the side door
    for (const [x0, z0] of [[-25.2, 9.2], [-19.4, 9.2]]) {
      L.box(x0, FL, z0, x0 + 1.8, 0.8, z0 + 0.7, 'panelDark');
      deco(x0 + 0.03, 0.8, z0 + 0.03, x0 + 1.77, 1.25, z0 + 0.67, 'glassClear'); solid(x0, 0.8, z0, x0 + 1.8, 1.25, z0 + 0.7);
      for (let i = 0; i < 7; i++) { const x = x0 + 0.2 + i * 0.22; L.cyl(BAG[(rnd() * BAG.length) | 0], x, 0.87, z0 + 0.35, 0.05, 0.14, 0, 0, true); K.sph('chrome', x, 0.97, z0 + 0.35, 0.03); }
    }
    L.box(-18.4, FL, 11.5, -17 - T / 2, 1.0, 14, 'panelDark', { top: 'counter' }); deco(-18.2, 1.0, 12, -17.8, 1.35, 12.6, 'paintDark');
    for (let i = 0; i < 8; i++) deco(-24.9 + (i % 4) * 0.27, FL, 16 + (i >> 2) * 0.45, -24.7 + (i % 4) * 0.27, FL + 0.3 + rnd() * 0.3, 16.4 + (i >> 2) * 0.45, i % 2 ? 'paintRed' : 'planeGold');
    solid(-25, FL, 16, -23.8, FL + 0.6, 16.9);
    light(-23, CE, 11); light(-20, CE, 14.5);
    // restroom: sinks and mirrors west, four stalls east
    K.wall('z', 8, Z1, -11, 0, CE, [[9.5, 10.8, 0, 2.3]], null, [[0, 2.1, 'appliance'], [2.1, CE, 'wallClean']], 0);
    K.wall('x', -11, -6, 8, 0, CE, [], null, [[0, 2.1, 'appliance'], [2.1, CE, 'wallClean']], 0);
    K.plane(A.wc, 1.6, 0.4, -8.5, 2.6, 7.86, Math.PI);
    L.box(-11 + T / 2, FL, 12, -10.4, 0.85, 17, 'counter'); for (let z = 12.6; z < 17; z += 1.1) { L.cyl('appliance', -10.65, 0.82, z, 0.18, 0.05, 0, 0, true); L.pipe('chrome', -10.8, 0.85, z, -10.7, 1.05, z, 0.015); }
    deco(-10.87, 1.15, 12.1, -10.85, 2.1, 16.9, 'chrome');
    for (let i = 0; i <= 4; i++) { const z = 10.2 + i * 1.95; L.box(-8.4, 0.15, z - 0.03, -6 - T / 2, 2.1, z + 0.03, 'greyClean', { ao: false }); }
    for (let i = 0; i < 4; i++) {
      const z = 10.2 + i * 1.95;
      L.box(-8.43, 0.15, z + 0.03, -8.37, 2.1, z + 0.3, 'greyClean', { ao: false }); L.box(-8.43, 0.15, z + 1.2, -8.37, 2.1, z + 1.92, 'greyClean', { ao: false });
      L.box(-8.37, 0.15, z + 0.35, -7.6, 2.0, z + 0.4, 'greyClean', { ao: false });
      L.box(-6.8, FL, z + 0.75, -6.25, 0.45, z + 1.2, 'appliance'); K.sph('appliance', -7.05, 0.42, z + 0.97, 0.3, 0.06, 0.22); deco(-6.4, 0.45, z + 0.7, -6.2, 0.9, z + 1.25, 'appliance');
    }
    deco(-8.6, 1.2, 8.14, -8.1, 1.5, 8.3, 'chrome');
    light(-9.4, CE, 13); light(-7.2, CE, 13);
  }

  // ------------------------------------------------------------ Burger Town
  function burgerTown(rnd) {
    const A = art(), IN = [[0, 1.1, 'vinylRed'], [1.1, CE, 'wallClean']];
    // storefronts to the atrium (west) and the concourse (north), a sign band over both
    cut('z', 4, 8, -6, 0.1, FL, 2.8, [[5.2, 6.6, 0, 2.8]], 'glassClear', glassO); L.box(-6.12, 2.8, 4, -5.88, CE, 8, 'vinylRed', { ao: false });
    cut('x', -6, 8, 4, 0.1, FL, 2.8, [[1, 2.6, 0, 2.8]], 'glassClear', glassO); L.box(-6, 2.8, 3.88, 8, CE, 4.12, 'vinylRed', { ao: false });
    for (const x of [-6, -3, 1, 2.6, 5, 8]) deco(x - 0.04, FL, 3.92, x + 0.04, 2.8, 4.08, 'steel');
    for (const z of [4, 5.2, 6.6, 8]) deco(-6.08, FL, z - 0.04, -5.92, 2.8, z + 0.04, 'steel');
    K.plane(A.burger, 5.4, 1.0, 1, 3.55, 3.86, Math.PI); K.plane(A.burger, 3.6, 0.68, -6.14, 3.55, 6, -Math.PI / 2);
    K.wall('z', 8, Z1, -6, 0, CE, [], null, [[0, 1.1, 'appliance'], [1.1, CE, 'wallClean']], 0);
    K.wall('z', 4, Z1, 8, 0, CE, [], null, [[0, 0.15, 'paintDark'], [0.15, CE, 'wallClean']], 0);
    // the counter, the pass to the kitchen, menu boards over it
    K.wall('x', -6, 8, 12.4, 0, CE, [[-3.2, 2.2, 1.15, 2.2], [5.6, 6.8, 0, 2.3]], null, IN, 0);
    L.box(-4.8, FL, 10.6, 4.2, 1.05, 11.4, 'vinylRed', { top: 'counter' }); L.box(4.2, FL, 10.6, 4.9, 1.05, 12.2, 'vinylRed', { top: 'counter' });
    for (const x of [-3.5, -1, 1.5]) { deco(x - 0.2, 1.05, 10.8, x + 0.2, 1.15, 11.2, 'paintDark'); deco(x - 0.15, 1.15, 10.95, x + 0.15, 1.4, 11.0, 'paintDark'); deco(x - 0.13, 1.18, 10.94, x + 0.13, 1.37, 10.945, 'windowCool'); }
    for (let i = 0; i < 8; i++) deco(3.2, 1.05 + i * 0.03, 10.75, 3.7, 1.075 + i * 0.03, 11.25, i % 2 ? 'vinylRed' : 'paintCherry');
    L.box(-5.8, FL, 10.6, -5.1, 1.5, 11.4, 'steel'); for (let i = 0; i < 4; i++) deco(-5.82, 1.1, 10.7 + i * 0.18, -5.78, 1.25, 10.8 + i * 0.18, 'paintDark');
    K.plane(A.menu, 2.2, 1.1, -2.4, 2.95, 12.26, Math.PI); K.plane(A.menu2, 2.2, 1.1, 0, 2.95, 12.26, Math.PI); K.plane(A.menu, 2.2, 1.1, 2.4, 2.95, 12.26, Math.PI);
    for (const x of [-1.8, 0, 1.8]) K.sph('lampAmber', x, 2.1, 12.6, 0.12, 0.05, 0.12);
    // dining room: booths along the bookstore wall, tables in the middle, a condiment stand and bins
    for (const z0 of [4.5, 6.6, 8.7]) {
      L.box(6.1, FL, z0, 7.87, 0.45, z0 + 0.5, 'vinylRed'); L.box(6.1, 0.45, z0, 7.87, 1.15, z0 + 0.15, 'vinylRed', { ao: false });
      L.box(6.1, FL, z0 + 1.45, 7.87, 0.45, z0 + 1.95, 'vinylRed'); L.box(6.1, 0.45, z0 + 1.8, 7.87, 1.15, z0 + 1.95, 'vinylRed', { ao: false });
      K.table(6.3, z0 + 0.62, 7.8, z0 + 1.33, FL);
    }
    for (const [x, z] of [[-3.8, 6.2], [-1, 6.2], [1.8, 6.6], [-3.8, 9], [-1, 9], [2.2, 9]]) {
      K.table(x - 0.4, z - 0.4, x + 0.4, z + 0.4, FL);
      P('chair', x, z - 0.8, 0, FL); if (rnd() < 0.7) P('chair', x, z + 0.8, Math.PI, FL);
      if (rnd() < 0.5) { deco(x - 0.25, FL + 0.78, z - 0.18, x + 0.25, FL + 0.8, z + 0.18, 'vinylRed'); deco(x - 0.1, FL + 0.8, z - 0.1, x + 0.1, FL + 0.9, z + 0.1, 'planeGold'); }
    }
    L.box(-5.8, FL, 4.3, -5, 1.1, 5.0, 'vinylRed', { top: 'counter' }); for (let i = 0; i < 3; i++) L.cyl(i ? 'paintRed' : 'paintYellow', -5.6 + i * 0.25, 1.2, 4.65, 0.05, 0.2, 0, 0, true);
    trash(4.8, 5); trash(-5.4, 9.4);
    // kitchen: griddles and fryers under a hood, prep table, walk-in, shelving
    L.box(-5.8, FL, Z1 - 0.9, -0.5, 0.95, Z1 - T / 2, 'steel', { top: 'paintDark' });
    for (let x = -5.4; x < -1; x += 0.9) { deco(x, 0.95, Z1 - 0.8, x + 0.7, 0.98, Z1 - 0.3, 'rubber'); for (let k = 0; k < 3; k++) L.cyl('leather', x + 0.18 + k * 0.18, 1.0, Z1 - 0.55, 0.07, 0.03, 0, 0, true); }
    L.box(-0.3, FL, Z1 - 0.9, 2.4, 0.95, Z1 - T / 2, 'steel'); for (const x of [0.1, 1.2]) { deco(x, 0.9, Z1 - 0.8, x + 0.9, 0.96, Z1 - 0.3, 'paintYellow'); deco(x + 0.1, 1.1, Z1 - 0.7, x + 0.8, 1.3, Z1 - 0.4, 'chrome'); }
    L.box(-6 + T / 2, 2.2, Z1 - 1.1, 2.6, 2.9, Z1 - T / 2, 'steel', { ao: false });
    L.box(-4, FL, 14.3, 1.8, 0.92, 15.1, 'steel', { top: 'steel' }); deco(-3.8, 0.3, 14.4, 1.6, 0.34, 15.0, 'steel');
    for (let i = 0; i < 5; i++) deco(-3.6 + i * 0.9, 0.92, 14.45, -3.1 + i * 0.9, 1.0 + (i % 2) * 0.12, 14.95, i % 2 ? 'cardboard' : 'appliance');
    L.box(4.2, FL, 14.4, 8 - T / 2, 2.6, Z1 - T / 2, 'steel'); deco(4.19, 0.3, 15.2, 4.2, 2.3, 16.6, 'chrome'); deco(4.14, 1.2, 15.4, 4.19, 1.5, 15.5, 'paintDark');
    for (let y = 0.4; y < 2.2; y += 0.55) deco(3.6, y, 12.6, 5.4, y + 0.04, 13.1, 'steel'); for (const x of [3.6, 5.4]) deco(x - 0.02, FL, 12.6, x + 0.02, 2.2, 13.1, 'steel');
    solid(3.6, FL, 12.6, 5.4, 2.2, 13.1, 'metal'); P('boxStack', 2.8, 16.6, 0.3, FL);
    light(-3, CE, 6); light(2, CE, 6); light(-3, CE, 9.5); light(2, CE, 9.5); light(-2, CE, 15); light(3, CE, 15);
  }

  // ------------------------------------------------------------ the bookstore
  function bookstore(rnd) {
    const A = art(), bo = { top: 'woodDark', side: 'books', uvScale: 0.5 };
    cut('x', 8, 20, 4, 0.1, FL, 2.8, [[13, 15, 0, 2.8]], 'glassClear', glassO); L.box(8, 2.8, 3.88, 20, CE, 4.12, 'woodDark', { ao: false });
    for (const x of [8, 10.5, 13, 15, 17.5, 20]) deco(x - 0.04, FL, 3.92, x + 0.04, 2.8, 4.08, 'woodDark');
    K.plane(A.books, 3.4, 1.06, 14, 3.55, 3.86, Math.PI);
    // wall shelves, three double-sided gondolas, a bestseller table, the magazine rack, the till
    L.box(8 + T / 2, FL, 5, 8.6, 2.05, Z1 - 0.7, 'woodDark', bo); L.box(8.6, FL, Z1 - 0.6, 19.4, 2.05, Z1 - T / 2, 'woodDark', bo); L.box(19.4, FL, 7, 20 - T / 2, 2.05, 14.4, 'woodDark', bo);
    for (const x of [10.9, 13.6, 16.3]) L.box(x - 0.35, FL, 8, x + 0.35, 1.6, 14.6, 'woodDark', bo);
    L.box(11.2, FL, 5.6, 13.2, 0.75, 6.8, 'woodDark', { top: 'wood' });
    for (let i = 0; i < 10; i++) { const x = 11.35 + (i % 5) * 0.37, z = 5.75 + (i / 5 | 0) * 0.55; deco(x, 0.75, z, x + 0.26, 0.75 + 0.05 + rnd() * 0.25, z + 0.36, BAG[i % BAG.length]); }
    L.box(8.8, FL, 4.3, 10.6, 1.4, 4.75, 'woodDark', { side: 'books', uvScale: 0.9 });
    L.box(17, FL, 5, 19.4, 1.05, 6.2, 'woodDark', { top: 'counter' }); deco(18.2, 1.05, 5.3, 18.6, 1.1, 5.7, 'paintDark'); deco(18.25, 1.1, 5.4, 18.3, 1.45, 5.9, 'paintDark');
    for (let i = 0; i < 4; i++) L.cyl('paintCherry', 17.4 + i * 0.2, 1.1, 5.9, 0.04, 0.12, 0, 0, true);
    P('box', 15.4, 16.6, 0.3, FL); P('boxStack', 9.4, 16.8, -0.2, FL);
    pendantShort(11, 8); pendantShort(15, 8); pendantShort(11, 14); pendantShort(15, 14);
  }
  function pendantShort(x, z) { L.pipe('paintDark', x, CE, z, x, CE - 0.7, z, 0.01); L.cyl('paintGreen', x, CE - 0.8, z, 0.25, 0.2, 0, 0, true); K.sph('lampWarm', x, CE - 0.92, z, 0.12, 0.05, 0.12); L.lamp(x, CE - 1.2, z, { color: 0xffddb0, intensity: 1.3, distance: 8, pool: false }); }

  // ------------------------------------------------------------ concourse (ground floor, below the gate lounge)
  function concourse(rnd) {
    const A = art();
    // rows of seats facing the apron, a bus-gate desk, vending, a glass smoking room
    for (const z of [-5.2, -2.6]) { seats('x', -3.5, 6, z, -1); seats('x', 6.2, 6, z, -1); }
    seats('x', -3.5, 6, 0.4, 1); seats('x', 6.2, 6, 0.4, 1);
    L.box(5.6, FL, -8.9, 8.6, 1.05, -8.0, 'panelBlue', { top: 'counter' }); deco(6.2, 1.05, -8.7, 6.6, 1.45, -8.65, 'paintDark'); deco(7.5, 1.05, -8.7, 7.9, 1.45, -8.65, 'paintDark');
    hangSign(A.gate21, 7.1, 3.1, -8.5, 1.8, 0.9, true, CE - 3.55);
    P('vending', -5.2, 3.3, Math.PI, FL); P('vending', -4.2, 3.3, Math.PI, FL); trash(-2.6, 3.4); trash(9.6, 3.4);
    const sx0 = 14.6, sx1 = 19.6, sz0 = -9.6, sz1 = -6.7;
    glass('x', sx0, sx1, sz1, FL, 2.7, [[15.6, 16.8, 0, 2.3]]); glass('z', sz0, sz1, sx0, FL, 2.7);
    for (const [x, z] of [[sx0, sz1], [sx1, sz1], [sx0, sz0]]) deco(x - 0.05, FL, z - 0.05, x + 0.05, 2.7, z + 0.05, 'steel');
    deco(sx0, 2.7, sz0, sx1, 2.78, sz1, 'steel');
    L.box(sx1 - 0.6, FL, sz0 + 0.3, sx1, 0.45, sz1 - 0.3, 'steel'); L.box(sx0 + 0.3, FL, sz0 + 0.1, sx1 - 1, 0.45, sz0 + 0.6, 'steel');
    L.cyl('steel', 17.4, 0.5, -8.2, 0.2, 1.0, 0, 0, true); L.cyl('paintDark', 17.4, 1.02, -8.2, 0.22, 0.04, 0, 0, true); solid(17.2, FL, -8.4, 17.6, 1.05, -8.0);
    deco(sx0 + 0.5, 2.6, -8.6, sx0 + 1.2, 2.7, -7.8, 'greyClean');
    K.plane(A.poster2, 1.2, 1.8, 19.86, 2.1, 0, -Math.PI / 2); K.plane(A.poster, 1.2, 1.8, 19.86, 2.1, 2.6, -Math.PI / 2);
    plant(12.5, -9.2, FL, 1.1); plant(-4.6, -9.2, FL, 1.1);
    for (const x of [-2, 10]) suitcase(x, FL, -3.9, 0.45, 0.6, 0.3, rnd, true);
  }

  // ------------------------------------------------------------ baggage room (east end, ground floor)
  function baggage(rnd) {
    const A = art();
    K.wall('z', Z0, Z1, 20, 0, CE, [[-5, -3.6, 0, 2.3], [15, 16.2, 0, 2.3]], null, [[0, 1.2, 'greyClean'], [1.2, CE, 'wallClean']], 0);
    // roll-up door to the apron, raised
    deco(23, 3.4, Z0 + 0.14, 27, 4.1, Z0 + 0.5, 'metalSiding'); for (const x of [22.9, 27.1]) deco(x - 0.06, FL, Z0 + 0.13, x + 0.06, 3.5, Z0 + 0.3, 'steel');
    for (let x = 23.1; x < 27; x += 0.7) deco(x, FL, Z0 - 0.02, x + 0.35, 0.02 + FL, Z0 + 0.4, 'hazard');
    // the belt from the door feeding a carousel
    L.box(24.3, FL, Z0 + 0.2, 25.7, 0.8, 4.6, 'greyClean', { top: 'rubber' }); for (const x of [24.25, 25.75]) deco(x - 0.04, 0.8, Z0 + 0.2, x + 0.04, 0.95, 4.6, 'steel');
    L.box(21.8, FL, 5, 26.6, 0.5, 12.8, 'steel', { top: 'rubber' }); L.box(22.8, 0.5, 6, 25.6, 1.1, 11.8, 'greyClean', { top: 'steel' });
    for (const [x, z] of [[21.8, 5], [26.6, 5], [21.8, 12.8], [26.6, 12.8]]) L.cyl('steel', x, 0.4, z, 0.1, 0.8, 0, 0, true);
    for (let i = 0; i < 9; i++) { const z = 5.4 + i * 0.85, x = i % 2 ? 22.3 : 26.1; suitcase(x, 0.5, z, 0.45, 0.25, 0.65, rnd); }
    for (let i = 0; i < 5; i++) suitcase(25, 0.8, -7 + i * 2.2, 0.5, 0.25, 0.7, rnd);
    // cage carts, luggage racks, drums
    for (const [x, z] of [[21.8, -7], [21.8, -3.2], [28.4, -6]]) cageCart(x, z, rnd);
    for (let y = 0.3; y < 2.4; y += 0.7) deco(28.9, y, -1.5, X1 - T / 2, y + 0.04, 7.2, 'steel'); for (const z of [-1.5, 2.8, 7.2]) deco(28.9, FL, z - 0.03, X1 - T / 2, 2.4, z + 0.03, 'steel');
    for (let i = 0; i < 10; i++) suitcase(29.4, 0.34 + (i % 3) * 0.7, -1 + (i / 3 | 0) * 1.8 + rnd() * 0.3, 0.6, 0.3 + rnd() * 0.2, 0.9, rnd);
    solid(28.9, FL, -1.5, X1 - T / 2, 2.4, 7.2, 'metal');
    P('drum', 21, 16.8); P('drum', 21.7, 17.1); P('crate', 23.2, 16.8, 0.1, FL);
    K.plane(A.baggage, 2.4, 0.6, 20.14, 3.2, -4.3, Math.PI / 2);
    // stair up to the gate lounge, along the east wall
    steps('z', 9, 16.5, 28.2, X1 - T / 2, FL, UP, -1, 'paintDark', 'grate');
    slopeGuard('z', 9, 16.5, 28.15, FL, UP, -1); L.pipe('steel', 28.15, FL + 1, 16.5, 28.15, UP + 1, 9, 0.03);
    K.railingZ(9, 16.5, 28, UP); K.railingX(28, X1 - T / 2, 16.5, UP);
    for (const [x, z] of [[23, -6], [23, 4], [24, 14]]) { deco(x - 0.8, CE - 0.1, z - 0.2, x + 0.8, CE, z + 0.2, 'paintDark'); deco(x - 0.75, CE - 0.14, z - 0.15, x + 0.75, CE - 0.1, z + 0.15, 'lampCool'); }
  }
  function cageCart(x, z, rnd) { // baggage cart along Z
    deco(x - 0.7, 0.35, z - 1.4, x + 0.7, 0.45, z + 1.4, 'greyClean');
    for (const [dx, dz] of [[-0.55, -1.1], [0.55, -1.1], [-0.55, 1.1], [0.55, 1.1]]) L.cyl('rubber', x + dx, 0.18, z + dz, 0.18, 0.1, 0, Math.PI / 2, true);
    for (const [dx, dz] of [[-0.68, -1.38], [0.68, -1.38], [-0.68, 1.38], [0.68, 1.38]]) L.pipe('steel', x + dx, 0.45, z + dz, x + dx, 2.0, z + dz, 0.025);
    deco(x - 0.72, 2.0, z - 1.42, x + 0.72, 2.05, z + 1.42, 'canvasOlive');
    for (const s of [-1, 1]) for (const y of [0.9, 1.5]) L.pipe('steel', x + s * 0.68, y, z - 1.38, x + s * 0.68, y, z + 1.38, 0.015);
    for (let i = 0; i < 5; i++) suitcase(x + (rnd() - 0.5) * 0.4, 0.45 + (i > 2 ? 0.45 : 0), z - 0.9 + (i % 3) * 0.9, 0.55, 0.4, 0.75, rnd);
    solid(x - 0.72, 0, z - 1.42, x + 0.72, 1.4, z + 1.42, 'metal');
  }

  // ------------------------------------------------------------ upstairs: business lounge, catwalk, mezzanine, gate lounge
  function upstairs(rnd) {
    const A = art();
    // business lounge (west): the bar, leather armchairs, a TV wall
    L.box(-44, UP, 12.2, -37.5, UP + 1.1, 13, 'woodDark', { top: 'counter' }); L.box(-37.5, UP, 12.2, -36.7, UP + 1.1, 15.5, 'woodDark', { top: 'counter' });
    deco(-44, UP + 1.02, 12.1, -37.5, UP + 1.1, 12.2, 'chrome');
    L.box(-45.4, UP, Z1 - 0.7, -38, UP + 2.2, Z1 - T / 2, 'woodDark', { side: 'bottles', uvScale: 0.5, top: 'woodDark' });
    deco(-45.4, UP + 2.3, Z1 - 0.4, -38, UP + 2.8, Z1 - T / 2, 'lampAmber');
    for (let x = -43.4; x < -37.8; x += 0.9) P('stool', x, 11.5, 0, UP);
    for (const [cx, cz] of [[-41, 3], [-34, 3], [-41, -4], [-33, -3.5], [-30, 6]]) {
      L.box(cx - 0.5, UP, cz - 0.4, cx + 0.5, UP + 0.42, cz + 0.4, 'woodDark', { top: 'counter' });
      for (const [dx, dz, ry] of [[-1.3, 0, 1], [1.3, 0, -1], [0, 1.2, 0]]) armchair(cx + dx, cz + dz, ry);
    }
    deco(-43, UP + 0.01, 1, -31, UP + 0.02, 5, 'rug');
    deco(-45.86, UP + 1.2, 0.9, -45.8, UP + 2.4, 3.1, 'paintDark'); deco(-45.8, UP + 1.26, 0.96, -45.79, UP + 2.34, 3.04, 'windowCool');
    plant(-27, 17, UP, 1.2); plant(-45, 9, UP, 1.2); plant(-27, -9, UP, 1.2);
    hangSign(A.lounge, -36, UP + 3, 9.5, 2.6, 0.65, true, 1.8);
    // gate 20: the retracted bridge's door, its podium
    L.box(-38.6, UP, -9.4, -37, UP + 1.05, -8.6, 'panelBlue', { top: 'counter' }); hangSign(A.gate20, -34.8, UP + 3.1, -9.2, 1.8, 0.9, true, 1.6);
    stanchions([[-35.9, -9.6], [-35.9, -7.4]]); stanchions([[-33.7, -9.6], [-33.7, -7.4]]);
    // catwalk and the south mezzanine: benches, a coffee cart, planters
    for (const x of [-23, -18, -12]) seats('x', x - 1.24, 4, -8.6, -1, UP);
    for (const x of [-22, -12]) seats('x', x - 1.55, 5, 10.2, -1, UP);
    L.box(-18, UP, 13.5, -15.8, UP + 1.0, 14.6, 'leather', { top: 'woodDark' }); L.cyl('paintDark', -17.9, UP + 1.6, 14.05, 0.03, 1.2, 0, 0, true); deco(-18.5, UP + 2.2, 13.3, -15.3, UP + 2.26, 14.8, 'paintCherry');
    deco(-17.2, UP + 1.0, 13.7, -16.7, UP + 1.45, 14.2, 'chrome'); P('stool', -17, 12.8, 0, UP); P('stool', -16, 12.8, 0, UP);
    plant(-25, 16.8, UP, 1.1); plant(-7, 16.8, UP, 1.1); trash(-9, 12);
    // gate 21 lounge (east): rows of seats, the podium by the jet bridge door, the airline office
    for (const z of [-4.2, -1.6]) { seats('x', -3.5, 6, z, -1, UP); seats('x', 16, 6, z, -1, UP); }
    for (const z of [1, 5.2]) { seats('x', -3.5, 6, z, 1, UP); seats('x', 16, 6, z, 1, UP); }
    seats('x', -3.5, 6, 7.8, -1, UP); seats('x', 16, 6, 7.8, -1, UP);
    L.box(9, UP, -8.8, 11.4, UP + 1.05, -7.9, 'panelBlue', { top: 'counter' }); for (const x of [9.5, 10.6]) { deco(x, UP + 1.05, -8.6, x + 0.45, UP + 1.5, -8.55, 'paintDark'); deco(x + 0.02, UP + 1.08, -8.54, x + 0.43, UP + 1.47, -8.53, 'windowCool'); }
    hangSign(A.gate21, 13.2, UP + 3.1, -9.2, 2, 1, true, 1.6);
    stanchions([[12.1, -9.6], [12.1, -6.5], [12.1, -4.6]]); stanchions([[14.3, -9.6], [14.3, -6.5]]);
    for (const [x, z] of [[1, 12], [5.5, 12]]) { L.box(x - 0.9, UP, z - 0.4, x + 0.9, UP + 1.0, z + 0.4, 'woodDark', { top: 'counter' }); for (let k = -1; k <= 1; k++) deco(x + k * 0.55 - 0.04, UP + 1.0, z - 0.04, x + k * 0.55 + 0.04, UP + 1.08, z + 0.04, 'paintDark'); P('stool', x - 0.5, z + 0.8, 0, UP); P('stool', x + 0.5, z + 0.8, 0, UP); }
    for (const [x, z] of [[-4, 13], [11, 14], [17, 3.4]]) { L.cyl('steel', x, UP + 1.1, z, 0.05, 2.2, 0, 0, true); deco(x - 0.6, UP + 2.2, z - 0.05, x + 0.6, UP + 2.9, z + 0.05, 'paintDark'); K.plane(A.depart, 1.1, 0.6, x, UP + 2.55, z + 0.055, 0); K.plane(A.depart, 1.1, 0.6, x, UP + 2.55, z - 0.055, Math.PI); solid(x - 0.1, UP, z - 0.1, x + 0.1, UP + 2.2, z + 0.1, 'metal'); }
    plant(-5, 17, UP, 1.2); plant(18.5, 11, UP, 1.2); plant(8.5, -9, UP, 1.1); trash(3, 3.6, UP); trash(18.5, -9, UP);
    for (const x of [-2.5, 21]) suitcase(x, UP, 2.4, 0.4, 0.55, 0.28, rnd, true);
    // airline office: glass front, desks with screens, filing cabinets
    const OFF = [[UP, UP + 0.15, 'paintDark'], [UP + 0.15, RT, 'wallClean']];
    K.wall('z', 12, Z1, 20, UP, UP + 3, [[13, 14.2, UP, UP + 2.3]], null, OFF, 0);
    K.wall('x', 20, 28, 12, UP, UP + 3, [[21.5, 27, UP + 1, UP + 2.6]], null, OFF, 0); glass('x', 21.5, 27, 12, UP + 1, UP + 2.6);
    K.wall('z', 12, Z1, 28, UP, UP + 3, [], null, OFF, 0);
    L.box(20, UP + 3, 12, 28, UP + 3.2, Z1, 'ceilTile', { top: 'concreteDark', side: 'paintDark', bottom: true }); K.roofCap(19.8, 11.8, 28.2, Z1, UP + 3.2);
    for (const [x0, z0] of [[21, 14.2], [24.5, 14.2]]) { K.table(x0, z0, x0 + 2, z0 + 0.9, UP); deco(x0 + 0.7, UP + 0.78, z0 + 0.5, x0 + 1.3, UP + 1.2, z0 + 0.55, 'paintDark'); deco(x0 + 0.72, UP + 0.8, z0 + 0.49, x0 + 1.28, UP + 1.18, z0 + 0.495, 'windowCool'); K.chair(x0 + 1, z0 - 0.5, UP); }
    for (let i = 0; i < 3; i++) L.box(21 + i * 0.6, UP, Z1 - 0.7, 21.55 + i * 0.6, UP + 1.3, Z1 - T / 2, 'greyClean');
    K.painting(25.5, UP + 1.8, Z1 - T / 2 - 0.03, Math.PI, 1.2, 0.8);
    light(24, UP + 3, 15);
  }
  function armchair(x, z, ry) { // back on the side away from the table (ry: 1 = back to -x, -1 = back to +x, 0 = back to +z)
    L.box(x - 0.45, UP, z - 0.45, x + 0.45, UP + 0.45, z + 0.45, 'leather');
    if (ry === 1) L.box(x - 0.45, UP + 0.45, z - 0.45, x - 0.25, UP + 1.0, z + 0.45, 'leather', { ao: false });
    else if (ry === -1) L.box(x + 0.25, UP + 0.45, z - 0.45, x + 0.45, UP + 1.0, z + 0.45, 'leather', { ao: false });
    else L.box(x - 0.45, UP + 0.45, z + 0.25, x + 0.45, UP + 1.0, z + 0.45, 'leather', { ao: false });
    if (ry) for (const s of [-1, 1]) deco(x - 0.45, UP + 0.45, z + s * 0.45 - 0.08, x + 0.45, UP + 0.7, z + s * 0.45 + 0.08, 'leather');
    else for (const s of [-1, 1]) deco(x + s * 0.45 - 0.08, UP + 0.45, z - 0.45, x + s * 0.45 + 0.08, UP + 0.7, z + 0.45, 'leather');
  }

  // ------------------------------------------------------------ jet bridges
  /** Bridge tunnel segment between z0 > z1 (going north), floor at y, across x0..x1 (outer). holes: side doors [side, zA, zB]. */
  function tube(x0, x1, z0, z1, y, holes) {
    const H = 2.45;
    L.box(x0, y - 0.3, z1, x1, y, z0, 'metalSiding', { top: 'carpetBlue', bottom: true });
    L.box(x0, y + H, z1, x1, y + H + 0.2, z0, 'metalSiding', { top: 'roofTin', bottom: true });
    deco(x0 + 0.25, y + H - 0.02, z1, x1 - 0.25, y + H, z0, 'ceilTile');
    for (const [side, c] of [[-1, x0 + 0.1], [1, x1 - 0.1]]) {
      const hs = (holes || []).filter((h) => h[0] === side).map((h) => [h[1], h[2], y, y + 2.25]);
      cut('z', z1, z0, c, 0.2, y, y + 1.0, hs, 'metalSiding', {});
      glass('z', z1, z0, c, y + 1.0, y + 1.8, hs);
      cut('z', z1, z0, c, 0.2, y + 1.8, y + H, hs, 'metalSiding', {});
    }
  }
  function mainBridge() {
    const x0 = 11.9, x1 = 14.5;
    // rotunda section on its column, the sloping tunnel down to the aircraft, the cab with its canopy
    tube(x0, x1, Z0, -15, UP, [[1, -13.9, -12.5]]);
    const n = 12;
    for (let i = 0; i < n; i++) { const za = -15 - i, y = UP - (i + 1) * (UP - PF) / n; tube(x0, x1, za, za - 1, y, []); }
    L.box(11.4, PF - 0.3, -29.0, 15.0, PF, -27, 'metalSiding', { top: 'grate', bottom: true });
    L.box(11.4, PF + 2.5, -29.0, 15.0, PF + 2.75, -27, 'metalSiding', { top: 'roofTin', bottom: true });
    for (const x of [11.5, 14.9]) L.box(x - 0.1, PF, -28.7, x + 0.1, PF + 2.5, -27, 'metalSiding');
    for (const x of [11.9, 14.5]) deco(x - 0.1, PF, -27.1, x + 0.1, PF + 2.5, -26.9, 'rubber');
    for (let z = -28.9; z < -27.8; z += 0.22) deco(11.4, PF + 2.3, z, 15.0, PF + 2.8, z + 0.12, 'rubber');
    deco(11.8, PF + 0.005, -28.9, 14.6, PF + 0.02, -28.5, 'hazard');
    L.lamp(13.2, PF + 2.2, -27.8, { color: 0xf1f4ff, intensity: 1.2, distance: 8, pool: false });
    L.lamp(13.2, UP + 2.2, -14, { color: 0xf1f4ff, intensity: 1.2, distance: 9, pool: false }); L.lamp(13.2, 4.3 + 2, -22, { color: 0xf1f4ff, intensity: 1.1, distance: 9, pool: false });
    for (let z = -11; z > -27; z -= 2.5) deco(12.8, (z > -15 ? UP : UP - (-15 - z) / 12) + 2.4, z - 0.3, 13.6, (z > -15 ? UP : UP - (-15 - z) / 12) + 2.44, z + 0.3, 'lampCool');
    // rotunda column and the drive column with its wheels
    L.cyl('greyClean', 13.2, (UP - 0.3) / 2, -12.6, 0.8, UP - 0.3, 0, 0, false); W.addCyl(13.2, -12.6, 0.8, 0, UP - 0.3, { surf: 'metal' });
    const yd = UP - 7 * (UP - PF) / 12 - 0.3;
    for (const x of [12.2, 14.2]) { L.box(x - 0.18, 0, -22.3, x + 0.18, yd, -21.7, 'greyClean'); }
    L.box(11.6, 0.4, -22.6, 14.8, 0.9, -21.4, 'paintDark'); K.wheels(11.9, 14.5, -22.3, -21.7, 0.42);
    deco(11.8, yd - 0.4, -22.4, 14.6, yd, -21.6, 'hazard');
    // the service stair from the rotunda door down to the apron
    L.box(x1, UP - 0.2, -14.6, 16.4, UP, -11.8, 'grate', { bottom: true, side: 'greyClean' });
    K.railingX(x1, 16.4, -11.8, UP); K.railingZ(-14.6, -11.8, 16.4, UP);
    for (const [x, z] of [[16.3, -11.9], [16.3, -14.5]]) L.box(x - 0.08, 0, z - 0.08, x + 0.08, UP - 0.2, z + 0.08, 'greyClean');
    openSteps('z', -19.8, -14.6, 14.7, 16.3, 0, UP, 1, 'greyClean');
  }
  function oldBridge() { // gate 20: bridge retracted against the terminal, no aircraft
    const x0 = -36.1, x1 = -33.5;
    tube(x0, x1, Z0, -19, UP, [[-1, -18.4, -16.4]]);
    L.box(x0, UP, -19.2, x1, UP + 2.45, -19, 'metalSiding'); deco(-35.3, UP + 1.0, -19.22, -34.3, UP + 1.8, -19.2, 'glassDay');
    for (let z = -19.4; z > -20.3; z -= 0.22) deco(x0 - 0.3, UP - 0.2, z, x1 + 0.3, UP + 2.7, z + 0.12, 'rubber');
    L.lamp(-34.8, UP + 2.2, -14, { color: 0xf1f4ff, intensity: 1.1, distance: 9, pool: false });
    L.cyl('greyClean', -34.8, (UP - 0.3) / 2, -12.6, 0.8, UP - 0.3, 0, 0, false); W.addCyl(-34.8, -12.6, 0.8, 0, UP - 0.3, { surf: 'metal' });
    for (const x of [-35.8, -33.8]) L.box(x - 0.18, 0, -17.8, x + 0.18, UP - 0.3, -17.2, 'greyClean');
    L.box(-36.4, 0.4, -18.1, -33.2, 0.9, -16.9, 'paintDark'); K.wheels(-36.1, -33.5, -17.8, -17.2, 0.42);
    L.box(-38.4, UP - 0.2, -18.6, x0, UP, -16, 'grate', { bottom: true, side: 'greyClean' });
    K.railingZ(-18.6, -16, -38.4, UP); K.railingX(-38.4, x0, -16, UP);
    for (const [x, z] of [[-38.3, -16.1], [-38.3, -18.5]]) L.box(x - 0.08, 0, z - 0.08, x + 0.08, UP - 0.2, z + 0.08, 'greyClean');
    openSteps('z', -23.8, -18.6, -38.2, -36.6, 0, UP, 1, 'greyClean');
  }

  // ------------------------------------------------------------ the airliner (nose east, doors on the terminal side)
  const PGEO = {};
  function fuse(len, t0, tl, r) {
    const k = [len, t0, tl, r].join(); if (PGEO[k]) return PGEO[k];
    return (PGEO[k] = new THREE.CylinderGeometry(r || R, r || R, len, 44, 1, true, t0, tl));
  }
  const TD0 = Math.asin((PF - CY) / R), TD1 = Math.asin((PF + 1.95 - CY) / R); // door opening, as angles round the axis
  function airliner(rnd, x0, zc, cabin) {
    // x0 shifts the whole aircraft; the scenery ones have no cabin
    const XT = x0 - 22, XN = x0 + 19.6, fd = [x0 + FD[0], x0 + FD[1]], rd = [x0 + RD[0], x0 + RD[1]];
    const put = (m, g, x, y, z, sx, sy, sz, ry, rx, rz) => K.put(m, g, x, y, z - ZC + zc, sx, sy, sz, ry, rx, rz);
    const run = (m, a, b, t0, tl, r) => put(m, fuse(b - a, t0, tl, r), (a + b) / 2, CY, ZC, 1, 1, 1, 0, 0, Math.PI / 2);
    const TAU = Math.PI * 2;
    if (cabin) {
      const door = TD1, span = TAU - (TD1 - TD0);
      run('planeWhite', XT, rd[0], 0, TAU); run('planeWhite', rd[0], rd[1], door, span); run('planeWhite', rd[1], fd[0], 0, TAU); run('planeWhite', fd[0], fd[1], door, span); run('planeWhite', fd[1], XN, 0, TAU);
    } else run('planeWhite', XT, XN, 0, TAU);
    run('planeBlue', XT, XN, Math.PI + 0.57, Math.PI - 1.14, R + 0.012);
    run('planeGold', XT, XN, TAU - 0.55, 0.05, R + 0.015); run('planeGold', XT, XN, Math.PI + 0.5, 0.05, R + 0.015);
    // nose, cockpit windows, radome seam; tail cone
    put('planeWhite', K.geo('sphere'), XN, CY, ZC, 3.6, R, R);
    // windscreen and side windows: panels lying on the nose's surface, with dark frames between them
    const onNose = (dy, dz) => { const k = 1 - (dy / R) ** 2 - (dz / R) ** 2, f = 1.012; return [XN + 3.6 * Math.sqrt(Math.max(0, k)) * f, CY + dy * f, zc + dz * f]; };
    for (const [z0, z1, y0, y1] of [[-0.62, -0.04, 0.95, 1.4], [0.04, 0.62, 0.95, 1.4], [-1.3, -0.7, 0.9, 1.32], [0.7, 1.3, 0.9, 1.32], [-1.85, -1.42, 0.8, 1.18], [1.42, 1.85, 0.8, 1.18]])
      quad('paintDark', onNose(y0, z0), onNose(y0, z1), onNose(y1, z1), onNose(y1, z0));
    put('planeWhite', K.geo('cone'), XT - 4, CY + 0.4, ZC, R, 8, R, 0, 0, Math.PI / 2 - 0.1);
    L.cyl('greyClean', XT - 7.9, CY + 1.2, zc, 0.18, 0.4, 0, Math.PI / 2 - 0.1, true);
    // fin with the logo, tailplanes, wings with winglets, engines, gear
    put('planeWhite', K.extrude('fin', [[1.5, 0], [-5.5, 7], [-8.5, 7], [-7.5, 0]], 0.4, 0.06), XT, CY + 1.0, ZC, 1, 1, 1);
    put('planeBlue', K.extrude('finTip', [[-5.3, 6.8], [-5.5, 7], [-8.5, 7], [-8.45, 6.8]], 0.44, 0.02), XT, CY + 1.0, ZC, 1, 1, 1);
    for (const s of [-1, 1]) K.plane(art().tail, 3.2, 3.2, XT - 5.3, CY + 4.0, zc + s * 0.27, s > 0 ? 0 : Math.PI, { alpha: true });
    put('planeWhite', K.extrude('stab', [[-2, 0], [-6.2, 6.3], [-7.8, 6.3], [-6.8, 0], [-7.8, -6.3], [-6.2, -6.3]], 0.25, 0.04), XT, CY + 0.5, ZC, 1, 1, 1, 0, Math.PI / 2);
    const WY = CY - 1.35;
    put('planeWhite', K.extrude('wing', [[3.5, 0], [-8, 16.5], [-10.3, 16.5], [-7, 0], [-10.3, -16.5], [-8, -16.5]], 0.4, 0.05), x0, WY, ZC, 1, 1, 1, 0, Math.PI / 2);
    for (const s of [-1, 1]) {
      put('planeBlue', K.extrude('winglet', [[0, 0], [-1.6, 2], [-2.3, 2], [-2.3, 0]], 0.12, 0.02), x0 - 8, WY + 0.2, ZC + s * 16.45, 1, 1, 1);
      for (const k of [0.25, 0.5, 0.75]) { const zo = 16.5 * k, xt = -7 - 3.3 * k; put('greyClean', K.geo('sphere'), x0 + xt + 0.3, WY - 0.2, ZC + s * zo, 0.9, 0.18, 0.14); }
      // engine: nacelle, lip, fan, spinner, exhaust, pylon
      const ez = ZC + s * 6.2, ey = 2.3;
      put('planeWhite', L.geo('cyl'), x0 - 1.5, ey, ez, 0.95, 4.6, 0.95, 0, 0, Math.PI / 2); put('planeBlue', L.geo('cyl'), x0 - 2.6, ey, ez, 0.965, 1.2, 0.965, 0, 0, Math.PI / 2);
      put('chrome', L.geo('cyl'), x0 + 0.82, ey, ez, 0.9, 0.1, 0.9, 0, 0, Math.PI / 2); put('paintDark', L.geo('cyl'), x0 + 0.7, ey, ez, 0.84, 0.03, 0.84, 0, 0, Math.PI / 2);
      put('chrome', K.geo('cone'), x0 + 0.55, ey, ez, 0.26, 0.45, 0.26, 0, 0, -Math.PI / 2);
      put('greyClean', K.geo('cone'), x0 - 4.3, ey, ez, 0.55, 1.3, 0.55, 0, 0, Math.PI / 2);
      put('planeWhite', L.geo('box'), x0 - 1.3, ey + 0.95, ez, 3.6, 0.5, 0.3);
      if (cabin) {
        solid(x0 - 3.8, ey - 0.95, ez - 0.95, x0 + 0.9, ey + 1.05, ez + 0.95, 'metal');
        for (let k = 0; k < 4; k++) { const za = 2 + k * 3.6, zb = za + 3.6, la = 3.5 - 11.5 * zb / 16.5, ta = -7 - 3.3 * za / 16.5; W.add(x0 + ta, WY - 0.2, s > 0 ? ZC + za : ZC - zb, x0 + la + 1.5, WY + 0.2, s > 0 ? ZC + zb : ZC - za, { surf: 'metal' }); }
      }
    }
    put('planeWhite', K.geo('sphere'), x0 - 2, CY - 1.75, ZC, 7.2, 0.9, 2.2);
    const gear = (x, z, top, n) => {
      put('steel', L.geo('cylLo'), x, (0.5 + top) / 2, z, 0.1, top - 0.5, 0.1);
      for (let i = 0; i < n; i++) put('rubber', L.geo('cyl'), x + (n > 2 ? (i < 2 ? -0.5 : 0.5) : 0), 0.52, z + (i % 2 ? 0.3 : -0.3), 0.52, 0.3, 0.52, 0, Math.PI / 2);
      if (cabin) solid(x - 0.9, 0, z - 0.6 + zc - ZC, x + 0.9, 1.05, z + 0.6 + zc - ZC, 'metal');
    };
    gear(XN - 1.6, ZC, CY - R + 0.2, 2); gear(x0 - 5.5, ZC - 2.8, WY, 4); gear(x0 - 5.5, ZC + 2.8, WY, 4);
    // exterior windows along both sides, the lettering, a door outline on the far side
    for (let x = x0 - 18.4; x < x0 + 15.6; x += 0.85) {
      for (const s of [-1, 1]) {
        if (s > 0 && ((x > fd[0] - 0.35 && x < fd[1] + 0.35) || (x > rd[0] - 0.35 && x < rd[1] + 0.35))) continue;
        put('glassDay', K.geo('sphere'), x, CY + 0.5, ZC + s * 2.35, 0.13, 0.19, 0.035);
      }
    }
    for (const s of [-1, 1]) {
      const mat = new THREE.MeshStandardMaterial({ map: art().title(s < 0), transparent: true, alphaTest: 0.3, roughness: 0.4 });
      const m = new THREE.Mesh(fuse(16, s > 0 ? 0.62 : Math.PI - 1.02, 0.4, R + 0.02), mat);
      m.position.set(x0 - 3, CY, zc); m.rotation.set(0, 0, Math.PI / 2); L.scene.add(m);
    }
    if (!cabin) return;
    // collision shell: floor and hold, side walls (with the doors cut), the crown, nose and tail
    L.box(-19, 3.3, ZC - 1.95, 16, PF, ZC + 1.95, 'wallClean', { top: 'carpetBlue', ao: false });
    W.add(XT, CY - R, ZC - 1.3, XN, 3.3, ZC + 1.3, { surf: 'metal' });
    const IW = (z, holes) => { cut('x', -19, 16, z, 0.15, PF, PF + 2.3, holes, 'wallClean', { ao: false }); };
    IW(ZC + 1.925, [[fd[0], fd[1], PF, PF + 1.95], [rd[0], rd[1], PF, PF + 1.95]]); IW(ZC - 1.925, []);
    for (const [a, b] of [[XT, rd[0]], [rd[1], fd[0]], [fd[1], XN]]) W.add(a, PF - 0.3, ZC + 2.0, b, PF + 2.4, ZC + 2.45, { surf: 'metal' });
    W.add(XT, PF - 0.3, ZC - 2.45, XN, PF + 2.4, ZC - 2.0, { surf: 'metal' });
    for (const d of [fd, rd]) { W.add(d[0], PF + 1.95, ZC + 1.85, d[1], PF + 2.4, ZC + 2.45, { surf: 'metal' }); deco(d[0] - 0.08, PF, ZC + 1.85, d[0], PF + 2.03, ZC + 2.3, 'greyClean'); deco(d[1], PF, ZC + 1.85, d[1] + 0.08, PF + 2.03, ZC + 2.3, 'greyClean'); deco(d[0], PF + 1.95, ZC + 1.85, d[1], PF + 2.03, ZC + 2.3, 'greyClean'); deco(d[0], PF - 0.02, ZC + 1.85, d[1], PF + 0.01, ZC + 2.3, 'steel'); }
    L.box(-19, PF + 2.3, ZC - 1.95, 16, PF + 2.45, ZC + 1.95, 'wallClean', { bottom: true, ao: false });
    W.add(XT, PF + 2.45, ZC - 2.0, XN, CY + R, ZC + 2.0, { surf: 'metal' }); K.roofCap(XT - 8, ZC - 2.6, XN + 3.6, ZC + 2.6, CY + R);
    L.box(-19.15, PF, ZC - 1.95, -19, PF + 2.3, ZC + 1.95, 'wallClean'); L.box(16, PF, ZC - 1.95, 16.15, PF + 2.3, ZC + 1.95, 'wallClean');
    solid(16, 2.6, ZC - 2.2, XN + 3.6, 6.9, ZC + 2.2, 'metal'); solid(XT - 8, 3.2, ZC - 1.8, -19.15, 7.0, ZC + 1.8, 'metal'); solid(XT - 7, CY + 1.0, ZC - 0.25, XT + 1.5, CY + 8, ZC + 0.25, 'metal');
    deco(15.99, PF, ZC - 0.4, 16, PF + 1.95, ZC + 0.4, 'greyClean'); deco(15.98, PF + 1.2, ZC - 0.3, 15.99, PF + 1.4, ZC - 0.1, 'paintDark');
    cabinInterior(rnd, fd, rd);
  }
  function cabinInterior(rnd, fd, rd) {
    const zn = ZC - 1.85, zs = ZC + 1.85;
    // economy: three-and-three either side of the aisle, an over-wing exit gap; business: two-and-two up front
    const eco = [];
    for (let x = 7.0; x > -14.2; x -= 0.84) if (x > -2.9 && x < -1.0) continue; else eco.push(x);
    const seat = (x, z0, z1, n, m) => {
      const w = (z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const a = z0 + i * w + 0.02, b = a + w - 0.04, c = (a + b) / 2;
        deco(x - 0.25, PF + 0.4, a, x + 0.22, PF + 0.52, b, m); deco(x - 0.34, PF + 0.45, a, x - 0.22, PF + 1.18, b, m);
        deco(x - 0.35, PF + 0.95, a + 0.04, x - 0.21, PF + 1.14, b - 0.04, 'appliance');
        deco(x - 0.352, PF + 0.72, c - 0.1, x - 0.345, PF + 0.88, c + 0.1, 'windowCool');
      }
      for (let i = 0; i <= n; i++) { const b = z0 + i * w; deco(x - 0.3, PF + 0.52, b - 0.025, x + 0.15, PF + 0.68, b + 0.025, 'greyClean'); }
      for (const b of [z0 + 0.12, z1 - 0.12]) deco(x - 0.2, PF, b - 0.03, x + 0.1, PF + 0.4, b + 0.03, 'steel');
    };
    for (const x of eco) { seat(x, ZC + 0.45, zs, 3, 'seatBlue'); seat(x, zn, ZC - 0.45, 3, 'seatBlue'); }
    for (const x of [8.4, 9.5, 10.6, 11.7]) { seat(x, ZC + 0.45, zs, 2, 'leather'); seat(x, zn, ZC - 0.45, 2, 'leather'); }
    const block = (x0, x1) => {
      for (const [a, b] of [[ZC + 0.45, zs + 0.1], [zn - 0.1, ZC - 0.45]]) { solid(x0, PF, a, x1, PF + 1.2, b); W.add(x0, PF + 1.2, a, x1, PF + 2.3, b, { shoot: false, nav: false }); }
    };
    block(-14.4, -2.84); block(-0.95, 7.25); block(8.05, 11.95);
    // overhead bins, ceiling light strips, windows and shades, exit signs
    for (const [a, b] of [[-14.4, -2.84], [-0.95, 12]]) for (const s of [-1, 1]) {
      const z0 = s > 0 ? ZC + 1.25 : zn, z1 = s > 0 ? zs : ZC - 1.25;
      deco(a, PF + 1.65, z0, b, PF + 2.3, z1, 'wallClean'); deco(a, PF + 1.63, s > 0 ? z0 : z1 - 0.06, b, PF + 1.66, s > 0 ? z0 + 0.06 : z1, 'greyClean');
      for (let x = a + 1.6; x < b; x += 1.6) deco(x - 0.01, PF + 1.66, z0, x + 0.01, PF + 2.3, z1, 'greyClean');
      deco(a, PF + 2.27, ZC + s * 1.2 - 0.05, b, PF + 2.3, ZC + s * 1.2 + 0.05, 'lampCool');
    }
    for (let x = -18.4; x < 15.6; x += 0.85) for (const s of [-1, 1]) {
      if (s > 0 && ((x > fd[0] - 0.35 && x < fd[1] + 0.35) || (x > rd[0] - 0.35 && x < rd[1] + 0.35))) continue;
      const z = ZC + s * 1.848;
      deco(x - 0.16, PF + 0.95, z - 0.004, x + 0.16, PF + 1.45, z + 0.004, 'appliance'); deco(x - 0.12, PF + 1.0, z - s * 0.006 - 0.003, x + 0.12, PF + 1.4, z - s * 0.006 + 0.003, 'windowCool');
    }
    for (const x of [-2.2]) for (const s of [-1, 1]) { const z = ZC + s * 1.846; deco(x - 0.45, PF + 0.3, z - 0.006, x + 0.45, PF + 1.5, z + 0.006, 'greyClean'); deco(x - 0.1, PF + 0.9, z - s * 0.01 - 0.005, x + 0.1, PF + 0.95, z - s * 0.01 + 0.005, 'paintRed'); }
    for (const x of [-14.8, -2.2, 12.2]) deco(x - 0.2, PF + 2.15, ZC - 0.08, x + 0.2, PF + 2.3, ZC + 0.08, 'lampGreen');
    deco(-14.5, PF + 0.005, ZC - 0.35, 12, PF + 0.012, ZC + 0.35, 'carpet');
    // galleys and lavatories fore and aft, carts, the cockpit door
    L.box(12.2, PF, zn, 14.6, PF + 1.0, ZC - 1.2, 'steel', { top: 'counter' }); deco(12.2, PF + 1.5, zn, 14.6, PF + 2.3, ZC - 1.45, 'steel');
    for (let x = 12.3; x < 14.4; x += 0.45) deco(x, PF + 0.05, ZC - 1.22, x + 0.4, PF + 0.95, ZC - 1.2, 'greyClean');
    L.box(14.6, PF, zn, 16, PF + 2.3, ZC - 0.45, 'wallClean', { ao: false }); deco(14.9, PF, ZC - 0.46, 15.7, PF + 1.95, ZC - 0.45, 'greyClean');
    L.box(-19, PF, zn, -17.6, PF + 2.3, ZC - 0.45, 'wallClean', { ao: false }); L.box(-19, PF, ZC + 0.45, -17.6, PF + 2.3, zs, 'wallClean', { ao: false });
    deco(-17.61, PF, ZC - 1.4, -17.6, PF + 1.95, ZC - 0.6, 'greyClean'); deco(-17.61, PF, ZC + 0.6, -17.6, PF + 1.95, ZC + 1.4, 'greyClean');
    L.box(-17.4, PF, zn, -15.2, PF + 1.0, ZC - 1.2, 'steel', { top: 'counter' });
    L.box(-15.1, PF, zn + 0.05, -14.7, PF + 1.0, ZC - 1.35, 'steel', { ao: false });
    for (const x of [-15, 5, 13.3]) L.lamp(x, PF + 2.1, ZC, { color: 0xf1f4ff, intensity: 1.1, distance: 9, pool: false });
  }
  function airstairs() { // stair truck at the rear door
    const x0 = RD[0] - 0.2, x1 = RD[1] + 0.2, zt = ZC + 3.2, zb = ZC + 9.6;
    L.box(x0, PF - 0.2, ZC + 2.0, x1, PF, zt, 'grate', { bottom: true, side: 'paintYellow' });
    steps('z', zt, zb, x0, x1, 0, PF, -1, 'paintYellow', 'grate');
    slopeGuard('z', zt, zb, x0 - 0.05, 0, PF, -1); slopeGuard('z', zt, zb, x1 + 0.05, 0, PF, -1);
    for (const x of [x0 - 0.05, x1 + 0.05]) { L.pipe('steel', x, 1.0, zb, x, PF + 1.0, zt, 0.03); for (let z = zt + 0.8; z < zb; z += 1.4) { const y = PF * (zb - z) / (zb - zt); L.pipe('steel', x, y, z, x, y + 1.0, z, 0.02); } }
    K.railingZ(ZC + 2.1, zt, x0, PF); K.railingZ(ZC + 2.1, zt, x1, PF);
    L.box(x0 - 1.4, 0.35, ZC + 6.8, x0, 2.2, ZC + 9.6, 'paintYellow', { top: 'paintYellow' }); deco(x0 - 1.42, 1.3, ZC + 8.9, x0 - 0.1, 2.0, ZC + 9.62, 'glassDay');
    K.wheels(x0 - 0.8, x1 + 0.2, ZC + 4.6, ZC + 8.8, 0.38, true);
    deco(x0, 0.3, zt, x1, 0.7, zb, 'hazard');
  }

  // ------------------------------------------------------------ the apron: ground equipment, ULDs, markings, lights
  function uld(x, z, ry) { // LD3 container on its dolly; ry in quarter turns
    ry = ry || 0;
    const c = Math.round(Math.cos(ry)), s = Math.round(Math.sin(ry)), rp = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const rb = (lx0, lz0, lx1, lz1) => { const a = rp(lx0, lz0), b = rp(lx1, lz1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
    K.put('panelWhite', K.extrude('uld', [[-0.78, 0], [0.78, 0], [0.78, 1.63], [-1.0, 1.63], [-1.0, 0.95], [-0.78, 0]], 1.53, 0.02), x, 0.42, z, 1, 1, 1, ry);
    let b = rb(-1.05, -0.85, 0.85, 0.85);
    L.box(b[0], 0.25, b[1], b[2], 0.42, b[3], 'paintDark', { noCol: true }); solid(b[0], 0, b[1], b[2], 2.05, b[3], 'metal');
    b = rb(-0.5, -0.785, 0.5, -0.765); deco(b[0], 0.5, b[1], b[2], 1.9, b[3], 'canvasOlive');
  }
  function tug(x, z) { // baggage tractor, along X, nose at +X
    L.box(x - 1.2, 0.3, z - 0.7, x + 1.2, 1.0, z + 0.7, 'paintYellow', { noCol: true });
    L.box(x - 1.2, 1.0, z - 0.7, x - 0.2, 1.1, z + 0.7, 'paintDark', { noCol: true });
    for (const [a, b] of [[-0.68, -0.68], [-0.68, 0.68]]) L.pipe('steel', x - 1.1, 1.0, z + b, x - 1.1, 2.0, z + b, 0.03);
    for (const b of [-0.68, 0.68]) L.pipe('steel', x - 0.25, 1.0, z + b, x - 0.25, 2.0, z + b, 0.03);
    deco(x - 1.2, 2.0, z - 0.72, x - 0.15, 2.06, z + 0.72, 'paintYellow'); deco(x - 0.9, 1.1, z - 0.3, x - 0.5, 1.5, z + 0.3, 'paintDark');
    K.wheels(x - 0.8, x + 0.8, z - 0.72, z + 0.72, 0.34, false, 'paintDark');
    solid(x - 1.25, 0, z - 0.75, x + 1.25, 1.1, z + 0.75, 'metal');
  }
  function bagCart(x, z, rnd) { // open baggage cart along X
    deco(x - 1.4, 0.45, z - 0.8, x + 1.4, 0.55, z + 0.8, 'greyClean');
    for (const [dx, dz] of [[-1.35, -0.75], [1.35, -0.75], [-1.35, 0.75], [1.35, 0.75]]) L.pipe('greyClean', x + dx, 0.55, z + dz, x + dx, 1.9, z + dz, 0.03);
    deco(x - 1.45, 1.9, z - 0.85, x + 1.45, 1.96, z + 0.85, 'canvasOlive'); deco(x - 1.42, 0.55, z - 0.82, x + 1.42, 1.3, z - 0.78, 'greyClean');
    K.wheels(x - 0.9, x + 0.9, z - 0.75, z + 0.75, 0.22, false, 'paintDark');
    L.pipe('paintDark', x + 1.4, 0.4, z, x + 2.1, 0.35, z, 0.04);
    for (let i = 0; i < 6; i++) suitcase(x - 1.0 + (i % 3) * 0.95, 0.55 + (i > 2 ? 0.34 : 0), z + (rnd() - 0.5) * 0.4, 0.8, 0.32, 0.55, rnd);
    solid(x - 1.45, 0, z - 0.85, x + 1.45, 1.4, z + 0.85, 'metal');
  }
  function beltLoader(x, zc) { // conveyor ramp from the apron up to the forward hold door
    const z0 = zc + 1.7, z1 = zc + 8.4, y0 = 2.85, y1 = 0.7;
    L.box(x - 0.9, 0.25, z0 + 1.2, x + 0.9, 0.95, z1 + 0.6, 'paintYellow'); K.wheels(x - 0.9, x + 0.9, z0 + 1.8, z1, 0.32, true, 'paintDark');
    quad('rubber', [x - 0.45, y0, z0], [x + 0.45, y0, z0], [x + 0.45, y1, z1], [x - 0.45, y1, z1]);
    for (const s of [-1, 1]) { L.pipe('paintYellow', x + s * 0.5, y0, z0, x + s * 0.5, y1, z1, 0.05); L.pipe('steel', x + s * 0.5, y0 + 0.5, z0, x + s * 0.5, y1 + 0.5, z1, 0.02); }
    L.pipe('paintYellow', x, 0.95, z0 + 2.8, x, y0 - 0.3 + (y1 - y0) * 0.45 + 0.4, z0 + 2.7, 0.08);
    L.box(x + 0.9, 0.95, z1 - 1.4, x + 1.8, 2.0, z1, 'paintYellow', { noCol: true }); deco(x + 0.92, 1.5, z1 - 1.3, x + 1.82, 1.95, z1 - 0.1, 'glassDay');
    for (let i = 0; i < 3; i++) { const k = 0.2 + i * 0.28; suitcase(x, y0 + (y1 - y0) * k + 0.02, z0 + (z1 - z0) * k, 0.5, 0.25, 0.6, U.mulberry32(i + 5)); }
    solid(x - 0.95, 0, z0 + 1.2, x + 1.85, 1.0, z1 + 0.6, 'metal');
  }
  function fuelTruck(x, z) { // along X, cab at +X
    L.box(x + 2.8, 0.5, z - 1.2, x + 5, 2.9, z + 1.2, 'paintRed', { noCol: true }); deco(x + 4.9, 1.7, z - 1.05, x + 5.02, 2.6, z + 1.05, 'glassDay');
    for (const s of [-1, 1]) deco(x + 3.1, 1.7, z + s * 1.2 - 0.02, x + 4.6, 2.6, z + s * 1.2 + 0.02, 'glassDay');
    deco(x - 4, 0.5, z - 0.9, x + 2.8, 0.8, z + 0.9, 'paintDark');
    L.cyl('appliance', x - 0.6, 1.9, z, 1.15, 6.4, 0, Math.PI / 2, false); K.sph('appliance', x - 3.8, 1.9, z, 0.3, 1.15, 1.15); K.sph('appliance', x + 2.6, 1.9, z, 0.3, 1.15, 1.15);
    for (const bx of [-2.6, -0.6, 1.4]) L.cyl('paintRed', x + bx, 1.9, z, 1.17, 0.12, 0, Math.PI / 2, false);
    deco(x - 3.2, 3.0, z - 0.25, x + 2, 3.1, z + 0.25, 'grate'); L.cyl('hazard', x - 4.05, 1.3, z, 0.25, 0.3, 0, Math.PI / 2, true);
    K.wheels(x - 3, x - 1.8, z - 1.05, z + 1.05, 0.5, false, 'paintDark'); K.wheels(x + 1.2, x + 4.2, z - 1.05, z + 1.05, 0.5, false, 'paintDark');
    solid(x - 4.1, 0, z - 1.25, x + 5.05, 3.1, z + 1.25, 'metal');
  }
  function cateringTruck(x, z) { // lifted box on scissors, cab at -Z
    L.box(x - 1.2, 0.5, z - 3.4, x + 1.2, 2.4, z - 1.8, 'appliance', { noCol: true }); deco(x - 1.05, 1.5, z - 3.42, x + 1.05, 2.3, z - 3.38, 'glassDay');
    deco(x - 1.1, 0.6, z - 1.8, x + 1.1, 0.9, z + 3.2, 'paintDark');
    for (const s of [-1, 1]) { L.pipe('steel', x + s * 0.9, 0.9, z - 1.4, x + s * 0.9, 3.6, z + 2.8, 0.06); L.pipe('steel', x + s * 0.9, 0.9, z + 2.8, x + s * 0.9, 3.6, z - 1.4, 0.06); }
    L.box(x - 1.25, 3.6, z - 1.6, x + 1.25, 6.0, z + 3.3, 'appliance', { noCol: true }); deco(x - 1.27, 4.4, z - 1.2, x + 1.27, 4.8, z + 3.0, 'planeBlue');
    K.wheels(x - 1.1, x + 1.1, z - 2.6, z + 2.4, 0.45, true, 'paintDark');
    solid(x - 1.25, 0, z - 3.4, x + 1.25, 2.4, z + 3.3, 'metal'); solid(x - 1.25, 3.6, z - 1.6, x + 1.25, 6.0, z + 3.3, 'metal');
  }
  function floodMast(x, z) {
    L.cyl('greyClean', x, 9, z, 0.22, 18, 0, 0, false); W.addCyl(x, z, 0.25, 0, 18, { surf: 'metal' });
    deco(x - 1.6, 17.6, z - 0.3, x + 1.6, 18.4, z + 0.3, 'paintDark');
    for (let i = 0; i < 4; i++) K.sph('lampCool', x - 1.2 + i * 0.8, 17.8, z + 0.25, 0.28, 0.24, 0.05);
    for (let y = 1; y < 17; y += 0.6) deco(x + 0.22, y, z - 0.18, x + 0.24, y + 0.04, z + 0.18, 'steel');
  }
  function apron(rnd) {
    const A = art();
    // concrete apron with slab joints, the service road along the building, the stand markings for gate 21
    L.box(-54, -1, -54, 40, 0.02, Z0, 'concrete', { ao: false });
    for (let x = -52.5; x < 40; x += 7.5) deco(x - 0.02, 0.02, -54, x + 0.02, 0.023, Z0, 'rubber');
    for (let z = -46.5; z < Z0; z += 7.5) deco(-54, 0.02, z - 0.02, 40, 0.023, z + 0.02, 'rubber');
    deco(-54, 0.02, -15.2, 40, 0.025, -12, 'asphalt');
    for (let x = -52; x < 40; x += 4) deco(x, 0.026, -13.66, x + 2, 0.03, -13.54, 'lineWhite');
    for (const z of [-15.2, -12]) deco(-54, 0.026, z - 0.06, 40, 0.03, z + 0.06, 'lineWhite');
    deco(-40, 0.026, ZC - 0.1, 26, 0.03, ZC + 0.1, 'line'); deco(23.4, 0.026, ZC - 3, 23.6, 0.03, ZC + 3, 'line');
    for (let x = -30; x < 24; x += 1.5) deco(x, 0.026, ZC - 3.6, x + 0.8, 0.03, ZC - 3.45, 'line');
    for (const [a, b, c, d] of [[-32, -52, -31.8, -16], [27.8, -52, 28, -16], [-32, -16.2, 28, -16], [-32, -52, 28, -51.8]]) deco(a, 0.026, b, c, 0.03, d, 'paintRed');
    flatSign(A.stand, 3, 3, 26, 0.032, ZC, Math.PI / 2);
    // the aircraft and everything round it
    airliner(rnd, 0, ZC, true);
    airstairs();
    tug(2, -18.2); bagCart(-2.2, -18.2, rnd); bagCart(-6.4, -18.2, rnd); bagCart(-10.6, -18.2, rnd);
    beltLoader(8.6, ZC);
    fuelTruck(4.5, ZC - 12);
    cateringTruck(16.5, ZC - 7.5);
    L.box(26.2, 0.2, ZC - 1.3, 30, 1.1, ZC + 1.3, 'paintYellow'); K.wheels(26.8, 29.4, ZC - 1.3, ZC + 1.3, 0.35, false, 'paintDark'); L.pipe('paintDark', 26.2, 0.6, ZC, 18.2, 0.5, ZC, 0.06);
    L.box(15.5, 0.25, ZC + 3.5, 17.5, 1.3, ZC + 4.6, 'paintYellow'); L.pipe('rubber', 16.2, 1.2, ZC + 3.5, 17.6, 2.8, ZC + 1.9, 0.05);
    for (const [x, z] of [[-26, -13.6], [-19, -14], [-17, -18.6], [5, -21], [19, -21], [21, ZC - 3], [-30, ZC + 2.4], [-30, ZC - 2.4], [-6, ZC + 18], [-6, ZC - 18], [24.5, ZC + 2.4]]) cone(x, z);
    for (const [x, z] of [[18, ZC], [-5, ZC - 2.1], [-5, ZC + 2.1]]) { deco(x - 0.8, 0, z - 0.12, x - 0.55, 0.22, z + 0.12, 'paintYellow'); deco(x + 0.55, 0, z - 0.12, x + 0.8, 0.22, z + 0.12, 'paintYellow'); }
    // ULD stacks by the baggage door, jersey barriers, a second cart train, the flood masts
    uld(22.5, -15.8); uld(24.5, -15.8, Math.PI); uld(28.2, -16.2); uld(32.5, -14.2, Math.PI / 2); uld(32.5, -18, Math.PI / 2);
    uld(-44, -22); uld(-42, -22, Math.PI); uld(-48.6, -30.6, Math.PI / 2);
    jersey(-48, -38, -42, -38); jersey(-26, -44, -20, -44); jersey(8, -44, 14, -44); jersey(30, -40, 36, -40); jersey(33, -26, 33, -20); jersey(-42, -14.4, -48, -14.4);
    tug(-27.5, -44.5); bagCart(-31.7, -44.5, rnd); bagCart(-35.9, -44.5, rnd);
    for (const [x, z] of [[20, -46], [-12, -47]]) { L.box(x - 1.5, 0, z - 1, x + 1.5, 1.5, z + 1, 'paintYellow', { top: 'paintDark' }); K.wheels(x - 1, x + 1, z - 1, z + 1, 0.3, false, 'paintDark'); }
    floodMast(-50, -50); floodMast(36, -50); floodMast(-50, -12.5);
    // gate 20's empty stand
    for (let x = -46; x < -24; x += 1.5) deco(x, 0.026, -30.1, x + 0.8, 0.03, -29.9, 'line');
  }

  // ------------------------------------------------------------ outside: the street, the service yards, the fence
  function shuttle(x, z) { // airport bus along X, door side +Z
    L.box(x - 5.5, 0.45, z - 1.25, x + 5.5, 3.1, z + 1.25, 'appliance', { noCol: true });
    for (const s of [-1, 1]) deco(x - 5.3, 1.5, z + s * 1.25 - 0.02, x + 5.3, 2.6, z + s * 1.25 + 0.02, 'glassDay');
    deco(x + 5.49, 1.2, z - 1.1, x + 5.52, 2.8, z + 1.1, 'glassDay'); deco(x - 5.52, 0.9, z - 1.26, x + 5.52, 1.3, z + 1.26, 'planeBlue');
    deco(x - 5.6, 3.1, z - 1.1, x + 5.6, 3.2, z + 1.1, 'greyClean'); deco(x - 1, 3.2, z - 0.8, x + 1.5, 3.55, z + 0.8, 'greyClean');
    for (const dx of [-3, 2.5]) deco(x + dx, 0.5, z + 1.26, x + dx + 1.2, 2.8, z + 1.28, 'glassDay');
    K.wheels(x - 3.6, x + 3.6, z - 1.15, z + 1.15, 0.5, false, 'paintDark');
    solid(x - 5.6, 0, z - 1.3, x + 5.6, 3.2, z + 1.3, 'metal');
  }
  function outside(rnd) {
    const A = art();
    // grass and taxiways beyond the fence, the street and pavement out front
    L.box(-400, -1, -400, 400, 0.0, 400, 'grass', { ao: false, noCol: true });
    W.add(-400, -1, -400, 400, 0.0, 400, { surf: 'concrete' });
    L.box(-54, -1, Z0, X0, 0.02, 22, 'asphalt', { ao: false }); L.box(X1, -1, Z0, 40, 0.02, 22, 'asphalt', { ao: false });
    L.box(-54, 0, Z1, 40, 0.18, 21.8, 'concrete', { side: 'concreteDark' }); deco(-54, 0.18, 21.62, 40, 0.185, 21.8, 'paintYellow');
    L.box(-54, -1, 21.8, 40, 0.02, 30, 'asphalt', { ao: false });
    for (let x = -52; x < 40; x += 5) deco(x, 0.021, 25.9, x + 2.5, 0.026, 26.05, 'lineWhite');
    deco(-54, 0.021, 29.3, 40, 0.026, 29.45, 'line');
    for (let x = -20; x < -8; x += 1.2) deco(x, 0.021, 22, x + 0.6, 0.026, 29.2, 'lineWhite');
    // the canopy over the kerb, entrance doors, the name over it all
    L.box(X0, 4.2, Z1, X1, 4.45, 21.6, 'panelDark', { bottom: true }); for (let x = X0 + 2; x < X1; x += 8) { L.cyl('steel', x, 2.2, 21.3, 0.12, 4.2, 0, 0, true); W.addCyl(x, 21.3, 0.12, 0, 4.2, { surf: 'metal' }); }
    for (let x = X0 + 4; x < X1; x += 6) { deco(x - 0.8, 4.16, 19.8, x + 0.8, 4.2, 20.2, 'lampCool'); L.lamp(x, 3.9, 20, { color: 0xf1f4ff, intensity: 0.9, distance: 8, pool: false }); }
    K.roofCap(X0, Z1, X1, 21.7, 4.45);
    for (const [a, b] of [[-40, -35.5], [-16, -12]]) { const m = (a + b) / 2; deco(a - 0.05, FL, Z1 + 0.13, m - 1, 2.8, Z1 + 0.16, 'glassClear'); deco(m + 1, FL, Z1 + 0.13, b + 0.05, 2.8, Z1 + 0.16, 'glassClear'); deco(a, 2.8, Z1 + 0.1, b, 3.1, Z1 + 0.25, 'paintDark'); }
    K.plane(A.name, 22, 1.7, -14, 5.35, Z1 + 0.16, 0, { alpha: true });
    K.plane(A.exit, 1.6, 0.4, -14, 3.3, Z1 - 0.14, Math.PI);
    // taxis, a shuttle bus, private cars; bollards, benches, a bus shelter
    for (const x of [-40, -33, -26]) K.car(x, 24, true, 'paintTaxi');
    K.car(14, 24, true, 'paintBlue'); K.car(22, 23.8, true, 'paintCream', true); K.car(-6, 27.8, true, 'paintMint', true);
    shuttle(2, 24.2);
    for (let x = X0 + 1; x < X1; x += 2.2) { if ((x > -41 && x < -34.5) || (x > -17 && x < -11)) continue; bollard(x, 21.2, 0.18); }
    for (const x of [-30, -22, 8, 26]) { L.box(x - 1, 0.18, 19.2, x + 1, 0.62, 19.7, 'steel', { top: 'wood' }); deco(x - 1, 0.62, 19.62, x + 1, 1.05, 19.7, 'wood'); }
    for (const x of [-44, -7, 18]) trash(x, 19.2, 0.18);
    L.box(32, 0.18, 19, 38, 0.3, 21.4, 'concrete'); for (const x of [32.2, 37.8]) L.box(x - 0.08, 0.3, 19.1, x + 0.08, 2.8, 19.3, 'steel'); deco(32, 2.8, 19, 38, 2.9, 21.4, 'glassClear'); deco(32.1, 0.3, 19.12, 37.9, 2.7, 19.16, 'glassClear');
    solid(32, 0.3, 19, 38, 2.9, 19.3, 'metal');
    trolley(-24.5, 19.6, rnd); trolley(-9, 20.2, rnd); trolley(4.8, 19.6, rnd);
    // west yard: dumpsters, a box truck at the loading door, pallets, a boom gate
    for (const z of [2, 5]) { L.box(-53.4, 0, z - 1, -51.6, 1.4, z + 1, 'paintGreen', { top: 'paintDark' }); }
    L.box(-52.8, 0.5, 9, -48.4, 3.4, 11.6, 'appliance'); L.box(-52.8, 0.5, 11.6, -48.4, 2.6, 13.6, 'paintBlue', { noCol: true }); deco(-52.6, 1.6, 13.6, -48.6, 2.4, 13.62, 'glassDay'); solid(-52.8, 0, 11.6, -48.4, 2.6, 13.6, 'metal');
    K.wheels(-52.6, -48.6, 9.6, 12.8, 0.45, true, 'paintDark');
    for (let i = 0; i < 3; i++) { L.box(-53.4, i * 0.15, -4 - i * 0.02, -52.2, i * 0.15 + 0.14, -2.8, 'wood'); } P('crate', -50.5, -6, 0.2); P('crateSmall', -51.2, -7.3, -0.3);
    L.box(-47, 0, -12.8, -46.2, 1.1, -12, 'paintYellow'); L.pipe('paintRed', -46.6, 1.0, -12.4, -47.6, 5.0, -12.4, 0.06);
    L.box(-53.6, 0, -9, -51.6, 2.6, -6.8, 'panelWhite'); deco(-53.62, 1.2, -8.6, -51.58, 2.0, -7.2, 'glassDay'); deco(-53.8, 2.6, -9.2, -51.4, 2.75, -6.6, 'paintDark');
    // east lane: a generator, fuel bowsers, stacked ULDs, a catering van
    P('generator', 33, -2, Math.PI / 2); P('generator', 33, 1.5, Math.PI / 2);
    uld(37.5, 6); uld(37.5, 9.5); uld(37.5, 13);
    L.box(33.5, 0.4, 9.5, 36.5, 2.6, 14, 'appliance'); L.box(33.6, 0.4, 14, 36.4, 2.1, 15.5, 'paintBlue', { noCol: true }); deco(33.7, 1.3, 15.5, 36.3, 2.0, 15.52, 'glassDay'); solid(33.5, 0, 14, 36.5, 2.1, 15.5, 'metal');
    K.wheels(33.6, 36.4, 10.1, 14.7, 0.4, true, 'paintDark');
    for (const z of [-7, -4.5]) { L.cyl('appliance', 37.2, 0.9, z, 0.8, 2.4, 0, Math.PI / 2, false); solid(36, 0, z - 0.8, 38.4, 1.7, z + 0.8, 'metal'); }
    // the airside fence and the boundary signs
    chainFence(-54, -54, 40, -54, 3); chainFence(-54, -54, -54, 22, 3); chainFence(40, -54, 40, 22, 3);
    for (const x of [-40, -10, 20]) deco(x - 0.4, 1.4, -53.97, x + 0.4, 1.9, -53.95, 'paintRed');
    // the parking garage across the road (scenery)
    for (let lv = 0; lv < 4; lv++) {
      const y = lv * 3.2;
      L.box(-70, y + 2.9, 31, 60, y + 3.2, 52, 'concrete', { noCol: true, bottom: true, side: 'concreteDark' });
      deco(-70, y + 3.2, 30.9, 60, y + 4.1, 31.2, 'concreteDark');
      for (let x = -66; x < 60; x += 8) deco(x - 0.3, y, 31.2, x + 0.3, y + 2.9, 31.8, 'concrete');
      if (lv === 0) for (let x = -64; x < 58; x += 5.5) if (rnd() < 0.45) K.car(x, 35 + (lv % 2) * 4, false, ['paintCream', 'paintBlue', 'paintMint', 'paintCherry', 'greyClean'][(rnd() * 5) | 0]);
    }
    K.plane(K.canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#123a7a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 200px Arial'; x.textAlign = 'center'; x.fillText('P', w / 2, 200); }), 2.4, 2.4, -14, 11.2, 30.85, Math.PI);
    L.box(-70, 12.8, 31, 60, 13.1, 52, 'concreteDark', { noCol: true });
    for (let x = -52; x < 40; x += 4) jersey(x, 29.8, x + 3.6, 29.8);
    // far field: taxiway, runway, a control tower, hangars, parked aircraft, a tree line
    L.box(-300, -0.99, -90, 300, 0.01, -72, 'asphalt', { noCol: true }); for (let x = -300; x < 300; x += 3) deco(x, 0.011, -81.1, x + 1.5, 0.015, -80.9, 'line');
    L.box(-300, -0.99, -135, 300, 0.01, -105, 'asphalt', { noCol: true });
    for (let x = -290; x < 300; x += 12) deco(x, 0.011, -120.3, x + 6, 0.015, -119.7, 'lineWhite');
    for (const z of [-106, -134]) deco(-300, 0.011, z - 0.2, 300, 0.015, z + 0.2, 'lineWhite');
    for (let i = 0; i < 10; i++) deco(-160, 0.011, -133 + i * 2.8, -130, 0.015, -131.8 + i * 2.8, 'lineWhite');
    L.box(-54, -0.99, -72, 40, 0.01, -54, 'concrete', { noCol: true });
    L.cyl('concrete', 80, 20, -150, 3.2, 40, 0, 0, false); L.cyl('glassDay', 80, 42, -150, 6.5, 4, 0, 0, false); L.cyl('panelWhite', 80, 44.3, -150, 7, 0.6, 0, 0, false); L.cyl('panelWhite', 80, 39.6, -150, 6.2, 1.2, 0, 0, false);
    L.pipe('steel', 80, 44.6, -150, 80, 52, -150, 0.12); K.sph('lampRed', 80, 52.2, -150, 0.3);
    for (const [x, w] of [[-120, 60], [-50, 44]]) { L.box(x - w / 2, 0, -190, x + w / 2, 18, -160, 'metalSiding', { noCol: true }); K.put('roofTin', K.gableRoofGeo(w + 1, 31, 5), x, 18, -175, 1, 1, 1); deco(x - w / 2 + 4, 0, -160.05, x + w / 2 - 4, 15, -159.95, 'panelDark'); }
    airliner(rnd, -40, -80, false); airliner(rnd, 70, -64, false);
    for (let i = 0; i < 180; i++) {
      const a = rnd() * Math.PI * 2, r = 170 + rnd() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z < -60 && Math.abs(x) < 200) continue;
      K.put(i % 3 ? 'pine' : 'leaves2', K.geo('cone'), x, 6 + rnd() * 3, z, 3 + rnd() * 2, 12 + rnd() * 8, 3 + rnd() * 2);
    }
  }

  // ------------------------------------------------------------ build
  MT.build = function () {
    K = CF.MapNuketown.kit;
    for (const k in PGEO) delete PGEO[k];
    const rnd = U.mulberry32(2009);
    shelfMats();
    shell();
    security(rnd);
    atrium(rnd);
    dutyFree(rnd);
    burgerTown(rnd);
    bookstore(rnd);
    concourse(rnd);
    baggage(rnd);
    upstairs(rnd);
    mainBridge();
    oldBridge();
    apron(rnd);
    outside(rnd);
    L.killY = -12;

    // spawns: one team on the apron behind the aircraft, the other at the taxi rank out front
    const north = [[-44, 0.02, -48.5], [-26, 0.02, -50], [-8, 0.02, -50.5], [10, 0.02, -50], [30, 0.02, -48.5]];
    const south = [[-42, 0.2, 20.2], [-28, 0.2, 20.2], [-14, 0.2, 20.4], [0, 0.2, 20.2], [14, 0.2, 20.2]];
    L.spawns.t0 = north; L.spawns.t1 = south;
    L.spawns.ffa = north.concat(south, [[-36, UP, 1], [-16, UP, -8], [4, UP, 10], [24, UP, 3], [-16, FL, -1], [-38, FL, 1], [0, FL, -7], [22.5, FL, 1], [15, FL, 10], [-50, 0.02, -2], [35, 0.02, 4], [-3, PF, ZC]]);
    L.addPickup('armor', 0, PF, ZC); L.addPickup('armor', -36, UP, 8);
    L.addPickup('ammo', -20, FL, -1); L.addPickup('ammo', 14, FL, 11); L.addPickup('ammo', 22.5, FL, 14); L.addPickup('ammo', 12, UP, 3);
    L.addPickup('ammo', -40, FL, 2); L.addPickup('ammo', -10, 0.02, -22); L.addPickup('ammo', 30, 0.02, -24); L.addPickup('ammo', -21, UP, 14);
    L.points.start = { x: -14, y: 0.2, z: 20.4, yaw: 0 };
  };
})(window.CF);
