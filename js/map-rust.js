'use strict';
/* Cinderfall — RUST (multiplayer), after the Modern Warfare 2 map: a small oil yard in the desert, fenced in with
   rusted sheet metal. In the middle stands the drilling tower: an open ground floor round the wellhead, the rig floor
   with the drawworks and the doghouse, a second deck, and the little top platform under the derrick, each reached by
   a steep steel stair. Round it: the big pipeline to the north (it arches over a gap you can walk under), the raised
   pipe rack to the west, the low pipe and the mud tanks to the east, the pipe yard to the south; the site office
   (two floors) in the north-west, the tank farm in the north-east, the pump house (roof reached by an outside stair)
   in the south-east, the shed and the nodding pumpjack in the south-west, and a sand ridge along the north fence.
   Axes: +X east, +Z south. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MR = CF.MapRust = {};
  const PI = Math.PI;
  let K = null, PK = null; // Nuketown's building kit, The Pit's stairs / rails / ramps (js/map-pit.js)

  const T = 0.25;                                   // wall thickness
  const E = 34;                                     // the fence line (inner face) on all four sides
  const PAD = 0.15, L1 = 3.0, L2 = 6.0, TOP = 9.0; // tower: concrete pad, rig floor, second deck, top platform
  const OF = 3.2, OH = 6.0;                         // office: upper floor, eaves
  const PHH = 3.4, PHR = 3.65;                      // pump house: walls, roof walking surface
  const RIDGE = 1.5;                                // the sand ridge along the north fence

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
  const UP = new THREE.Vector3(0, 1, 0);

  /** One wall piece: mOut on the face toward `out` (±1 across the wall), mIn on the other face only. */
  function piece(axis, p0, p1, q0, q1, c, out, mOut, mIn) {
    const b = axis === 'x' ? [p0, q0, c - T / 2, p1, q1, c + T / 2] : [c - T / 2, q0, p0, c + T / 2, q1, p1];
    const ao = q0 < 0.05 ? undefined : false;
    if (!out || mOut === mIn) { L.box(...b, mOut, { ao }); return; }
    const inF = axis === 'x' ? (out > 0 ? 5 : 4) : (out > 0 ? 1 : 0);
    L.box(...b, mOut, { ao, skip: [inF] });
    L.box(...b, mIn, { ao, noCol: true, skip: [0, 1, 2, 3, 4, 5].filter((f) => f !== inF) });
  }
  /** Steel frame round an opening on both faces; a sill proud of the wall under windows, a threshold plate under doors. */
  function frame(axis, h, c, y0, m) {
    const f = T / 2, B = (a0, a1, q0, q1, t0, t1, mm) => axis === 'x' ? deco(a0, q0, c + t0, a1, q1, c + t1, mm || m) : deco(c + t0, q0, a0, c + t1, q1, a1, mm || m);
    for (const sd of [-1, 1]) {
      const t0 = sd > 0 ? f : -f - 0.04, t1 = sd > 0 ? f + 0.04 : -f;
      B(h[0] - 0.1, h[0], h[2], h[3], t0, t1); B(h[1], h[1] + 0.1, h[2], h[3], t0, t1); B(h[0] - 0.1, h[1] + 0.1, h[3], h[3] + 0.1, t0, t1);
    }
    if (h[2] - y0 > 0.3) B(h[0] - 0.12, h[1] + 0.12, h[2] - 0.06, h[2] + 0.012, -f - 0.07, f + 0.07);
    else B(h[0], h[1], h[2], h[2] + 0.012, -f, f, 'steel');
  }
  /**
   * Wall with openings [a0, a1, y0, y1]. axis 'x' runs along X at z = c, 'z' along Z at x = c. out: the side facing
   * outdoors (±1), 0 = partition. Walls along X span the corners (a0 - T/2 .. a1 + T/2), walls along Z fit between.
   */
  function wall(axis, a0, a1, c, y0, y1, holes, out, mOut, mIn, trim) {
    K.holeSpans(a0, a1, y0, y1, holes, (p0, p1, q0, q1) => { if (p1 - p0 > 0.01 && q1 - q0 > 0.01) piece(axis, p0, p1, q0, q1, c, out, mOut, mIn); });
    for (const h of holes) if (h[3] > y0 && h[2] < y1 && (h[0] + h[1]) / 2 >= a0 && (h[0] + h[1]) / 2 < a1) frame(axis, h, c, y0, trim);
  }
  /** Smooth cylinder between two points (20 sides; big pipes), with flanges every `fl` metres. */
  function tube(m, x0, y0, z0, x1, y1, z1, r, fl) {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), d = b.clone().sub(a), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    L.addGeo(m, L.geo('cyl'), new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r)));
    if (fl) for (let s = fl; s < len - 0.4; s += fl) L.addGeo('steel', L.geo('cyl'), new THREE.Matrix4().compose(a.clone().lerp(b, s / len), q, new THREE.Vector3(r * 1.16, 0.1, r * 1.16)));
  }
  /** Pipe elbow: a ball a touch fatter than the pipe, and a flange ring each side. */
  function elbow(m, x, y, z, r) { K.sph(m, x, y, z, r * 1.04); }
  /** Handwheel of a gate valve, facing along X (alongX) or Z. */
  function handwheel(x, y, z, alongX, r) {
    r = r || 0.3;
    K.put('paintRed', L.geo('torus'), x, y, z, r, r, r * 1.6, alongX ? PI / 2 : 0);
    if (alongX) { L.pipe('paintRed', x, y - r, z, x, y + r, z, 0.02); L.pipe('paintRed', x, y, z - r, x, y, z + r, 0.02); }
    else { L.pipe('paintRed', x - r, y, z, x + r, y, z, 0.02); L.pipe('paintRed', x, y - r, z, x, y + r, z, 0.02); }
  }
  /** Oil stain on the sand (a dark blob). */
  const stain = (x, z, s, y) => L.blob(x, z, s, s * 0.8, y);
  /** Rust-streaked oil drum lying on its side along X or Z (a collider of its own). */
  function drumLying(x, z, alongX, y) {
    y = y || 0;
    L.cyl('rust', x, y + 0.3, z, 0.3, 0.88, alongX ? 0 : PI / 2, alongX ? PI / 2 : 0, false);
    for (const d of [-0.3, 0.3]) L.cyl('paintDark', x + (alongX ? d : 0), y + 0.3, z + (alongX ? 0 : d), 0.31, 0.04, alongX ? 0 : PI / 2, alongX ? PI / 2 : 0, true);
    solid(x - (alongX ? 0.44 : 0.3), y, z - (alongX ? 0.3 : 0.44), x + (alongX ? 0.44 : 0.3), y + 0.6, z + (alongX ? 0.3 : 0.44), 'metal');
  }
  /** A heap of scrap: bent sheets, a drum, pipe offcuts. */
  function scrap(x, z, rnd) {
    for (let i = 0; i < 7; i++) {
      const a = rnd() * PI, px = x + (rnd() - 0.5) * 2.2, pz = z + (rnd() - 0.5) * 1.6;
      K.put(i % 2 ? 'rust' : 'metalSiding', L.geo('box'), px, 0.2 + rnd() * 0.5, pz, 1.2 + rnd(), 0.05, 0.8 + rnd() * 0.6, a, (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 0.6);
    }
    for (let i = 0; i < 3; i++) L.pipe('rust', x - 1.2 + i * 0.5, 0.15 + i * 0.12, z - 0.8, x - 0.4 + i * 0.7, 0.15, z + 0.9, 0.08);
    drumLying(x + 0.9, z + 0.6, true);
    solid(x - 1.4, 0, z - 1.0, x + 1.4, 1.0, z + 1.0, 'metal'); L.blob(x, z, 3.6, 2.8);
  }

  // ------------------------------------------------------------ canvas art
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const ct = (w, h, draw) => K.canvasTex(w, h, draw);
    const font = (px, bold) => (bold ? 'bold ' : '') + px + 'px "Arial Narrow", Arial, Helvetica, sans-serif';
    const derrick = (x, cx, by, s, col) => {
      x.strokeStyle = col; x.lineWidth = s * 0.06;
      x.beginPath(); x.moveTo(cx - s * 0.45, by); x.lineTo(cx - s * 0.08, by - s); x.lineTo(cx + s * 0.08, by - s); x.lineTo(cx + s * 0.45, by); x.stroke();
      for (let i = 1; i < 5; i++) { const k = i / 5, w = s * (0.45 - 0.37 * k); x.beginPath(); x.moveTo(cx - w, by - s * k); x.lineTo(cx + w, by - s * k); x.stroke(); }
      x.beginPath(); x.moveTo(cx - s * 0.45, by); x.lineTo(cx + s * 0.37, by - s * 0.2); x.moveTo(cx + s * 0.45, by); x.lineTo(cx - s * 0.37, by - s * 0.2); x.stroke();
    };
    ART.company = ct(1024, 256, (x, w, h) => {
      x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, w, h); x.fillStyle = '#9a2a18'; x.fillRect(0, 0, w, 26); x.fillRect(0, h - 26, w, 26);
      x.fillStyle = '#9a2a18'; x.beginPath(); x.arc(128, 128, 88, 0, 6.283); x.fill(); derrick(x, 128, 184, 110, '#e8dcc0');
      x.fillStyle = '#2a1e14'; x.textAlign = 'left'; x.font = font(84, true); x.fillText('ZARKHAN PETROLEUM', 246, 122);
      x.fillStyle = '#9a2a18'; x.font = font(40, true); x.fillText('FIELD 7  ·  WELL SITE K-12', 250, 180);
    });
    ART.h2s = ct(256, 256, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(w / 2, 6); x.lineTo(w - 6, h / 2); x.lineTo(w / 2, h - 6); x.lineTo(6, h / 2); x.fill();
      x.strokeStyle = '#161616'; x.lineWidth = 8; x.beginPath(); x.moveTo(w / 2, 20); x.lineTo(w - 20, h / 2); x.lineTo(w / 2, h - 20); x.lineTo(20, h / 2); x.closePath(); x.stroke();
      x.fillStyle = '#161616'; x.textAlign = 'center'; x.font = font(40, true); x.fillText('DANGER', w / 2, 104); x.font = font(64, true); x.fillText('H₂S', w / 2, 162); x.font = font(22, true); x.fillText('POISON GAS', w / 2, 192);
    });
    ART.noSmoke = ct(256, 320, (x, w, h) => {
      x.fillStyle = '#f2eee0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c0281c'; x.lineWidth = 22; x.beginPath(); x.arc(w / 2, 118, 86, 0, 6.283); x.stroke();
      x.fillStyle = '#161616'; x.fillRect(58, 108, 120, 22); x.fillStyle = '#c0281c'; x.fillRect(178, 108, 20, 22);
      x.strokeStyle = '#c0281c'; x.beginPath(); x.moveTo(w / 2 - 61, 57); x.lineTo(w / 2 + 61, 179); x.stroke();
      x.fillStyle = '#161616'; x.textAlign = 'center'; x.font = font(40, true); x.fillText('NO SMOKING', w / 2, 262); x.font = font(20, true); x.fillText('NO NAKED FLAMES', w / 2, 294);
    });
    ART.well = ct(512, 160, (x, w, h) => {
      x.fillStyle = '#1e2a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e8e2cc'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      x.fillStyle = '#e8e2cc'; x.textAlign = 'center'; x.font = font(58, true); x.fillText('WELL No. K-12', w / 2, 72);
      x.font = font(26); x.fillText('SPUD 14.03  ·  TD 3 240 m  ·  RIG 7', w / 2, 118);
    });
    ART.sign = (a, b, bg, fg) => ct(512, 128, (x, w, h) => { x.fillStyle = bg || '#e8dcc0'; x.fillRect(0, 0, w, h); x.fillStyle = fg || '#2a1e14'; x.textAlign = 'center'; x.font = font(56, true); x.fillText(a, w / 2, 64); if (b) { x.font = font(26, true); x.fillText(b, w / 2, 104); } });
    ART.office = ART.sign('SITE OFFICE', 'ZARKHAN PETROLEUM · FIELD 7');
    ART.pump = ART.sign('PUMP STATION 2', 'AUTHORISED PERSONNEL ONLY', '#2a3a2a', '#e8e2cc');
    ART.tank = (n, what) => ct(512, 256, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(30,26,22,0.88)'; x.textAlign = 'center';
      x.font = '900 120px Impact, "Arial Black", sans-serif'; x.fillText('T-' + n, w / 2, 130);
      x.font = font(38, true); x.fillText(what, w / 2, 190);
      x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < w; i += 70) x.fillRect(i, 0, 6, h); x.globalCompositeOperation = 'source-over';
    });
    const stencilCache = {};
    ART.stencil = (text, col) => stencilCache[text + col] || (stencilCache[text + col] = ct(512, 160, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = col || 'rgba(34,30,26,0.85)'; x.font = '900 118px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.fillText(text, w / 2, 124);
      x.globalCompositeOperation = 'destination-out'; x.fillRect(0, 70, w, 7); for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 5, h); x.globalCompositeOperation = 'source-over';
    }));
    ART.log = ct(512, 384, (x, w, h) => {
      // the drilling log on the office whiteboard
      x.fillStyle = '#f4f4ee'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a8a86'; x.lineWidth = 10; x.strokeRect(0, 0, w, h);
      x.fillStyle = '#1a2a6a'; x.font = font(34, true); x.textAlign = 'left'; x.fillText('K-12  DAILY DRILLING REPORT', 24, 50);
      x.font = font(24); const rows = [['DEPTH', '3 240 m'], ['MUD WT', '1.32 SG'], ['ROP', '6.5 m/h'], ['BIT', '#9  PDC 8½"'], ['CREW', 'B SHIFT'], ['H₂S', '0 ppm ✓']];
      rows.forEach((r, i) => { x.fillStyle = '#1a2a6a'; x.fillText(r[0], 30, 100 + i * 40); x.fillStyle = '#b01c1c'; x.fillText(r[1], 200, 100 + i * 40); });
      x.strokeStyle = '#b01c1c'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 9; i++) { const px = 340 + i * 18, py = 320 - i * 22 - (i % 3) * 8; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke();
      x.strokeStyle = '#1a2a6a'; x.lineWidth = 2; x.beginPath(); x.moveTo(330, 110); x.lineTo(330, 330); x.lineTo(500, 330); x.stroke();
    });
    ART.site = ct(512, 384, (x, w, h) => {
      // plan of the yard for the upstairs map board
      x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3a2a1a'; x.lineWidth = 3;
      const S = 6.2, R = (x0, z0, x1, z1) => x.strokeRect(w / 2 + x0 * S, h / 2 + z0 * S * 0.72, (x1 - x0) * S, (z1 - z0) * S * 0.72);
      R(-E, -E, E, E); R(-4, -4, 4, 4); R(-30, -30, -20, -23); R(18, 20, 28, 28); R(-31, 26, -21, 32); R(-12, -34, 12, -22);
      x.beginPath(); x.arc(w / 2 + 20 * S, h / 2 - 25 * S * 0.72, 4.2 * S, 0, 6.283); x.stroke(); x.beginPath(); x.arc(w / 2 + 29 * S, h / 2 - 22 * S * 0.72, 3 * S, 0, 6.283); x.stroke();
      x.strokeStyle = '#9a2a18'; x.lineWidth = 5; x.beginPath(); x.moveTo(w / 2 - 22 * S, h / 2 - 12 * S * 0.72); x.lineTo(w / 2 + 22 * S, h / 2 - 12 * S * 0.72); x.lineTo(w / 2 + 22 * S, h / 2 - 21 * S * 0.72); x.stroke();
      x.fillStyle = '#3a2a1a'; x.font = font(18, true); x.textAlign = 'center';
      x.fillText('RIG 7', w / 2, h / 2 + 4); x.fillText('OFFICE', w / 2 - 25 * S, h / 2 - 26 * S * 0.72); x.fillText('PUMPS', w / 2 + 23 * S, h / 2 + 24 * S * 0.72); x.fillText('TANKS', w / 2 + 24 * S, h / 2 - 14 * S * 0.72);
      x.fillStyle = '#9a2a18'; x.font = font(26, true); x.fillText('SITE K-12', w / 2, 30);
    });
    return ART;
  }

  // ------------------------------------------------------------ ground, fence
  function ground(rnd) {
    L.box(-E - 2, -1, -E - 2, E + 2, 0, E + 2, 'sandGround', { ao: false });
    // packed earth where the trucks turn, gravel round the tower and the pump house (decals at distinct heights)
    deco(-18, 0, -10, -6, 0.004, 8, 'packed'); deco(8, 0, 10, 26, 0.004, 18.5, 'packed'); deco(-20, 0, 13, 0, 0.004, 24, 'packed');
    deco(-8, 0, -9, 8, 0.006, -5.3, 'gravel'); deco(6.1, 0, -5.3, 11.5, 0.006, 8, 'gravel');
    deco(-26, 0, -22.5, -16, 0.006, -19, 'gravel'); deco(16, 0, 16, 30, 0.008, 19.6, 'gravel');
    // tyre tracks and oil stains
    for (let i = 0; i < 14; i++) { const k = i / 13; deco(-16 + k * 34 - 0.2, 0.004, 11.6 + Math.sin(k * 3) * 1.2, -16 + k * 34 + 2.2, 0.007, 11.9 + Math.sin(k * 3) * 1.2, 'dirt'); }
    for (let i = 0; i < 26; i++) stain((rnd() - 0.5) * 60, (rnd() - 0.5) * 60, 0.6 + rnd() * 1.6);
    for (const [x, z, s] of [[1.5, 6.6, 2.2], [-3, -6, 1.6], [26, -12, 1.8], [-24, 29, 2.4], [23, 18, 1.5], [-12, 20, 2.6]]) stain(x, z, s);
  }
  function fence(rnd) {
    const H = 3.4;
    const run = (axis, a0, a1, c, n) => {
      // corrugated sheets 3 m wide, alternately galvanised and rusted, on steel posts; a collider up to the sky
      const t0 = n > 0 ? c : c - 0.08, t1 = n > 0 ? c + 0.08 : c;
      for (let a = a0, i = 0; a < a1 - 0.01; a += 3, i++) {
        const b = Math.min(a1, a + 3), m = (i * 7 + (rnd() * 3 | 0)) % 3 ? 'rust' : 'metalSiding', hh = H - (rnd() < 0.3 ? rnd() * 0.5 : 0);
        if (axis === 'x') deco(a, 0, t0, b, hh, t1, m); else deco(t0, 0, a, t1, hh, b, m);
        const pc = n > 0 ? c + 0.15 : c - 0.15;
        if (axis === 'x') deco(a - 0.06, 0, pc - 0.06, a + 0.06, H + 0.2, pc + 0.06, 'paintDark'); else deco(pc - 0.06, 0, a - 0.06, pc + 0.06, H + 0.2, a + 0.06, 'paintDark');
      }
      const s0 = n > 0 ? c - 0.1 : c - 1.1, s1 = n > 0 ? c + 1.1 : c + 0.1;
      if (axis === 'x') { W.add(a0, 0, t0, a1, H, t1, { surf: 'metal' }); W.add(a0 - 2, H, s0, a1 + 2, 60, s1, { shoot: false, nav: false }); }
      else { W.add(t0, 0, a0, t1, H, a1, { surf: 'metal' }); W.add(s0, H, a0 - 2, s1, 60, a1 + 2, { shoot: false, nav: false }); }
    };
    // the fence faces inward at ±E; sheets on the outside of that line (n = outward normal)
    run('x', -E - 0.08, E + 0.08, -E, -1); run('x', -E - 0.08, E + 0.08, E, 1);
    run('z', -E, E, -E, -1); run('z', -E, E, E, 1);
    const A = art();
    K.plane(A.company, 6, 1.5, -8, 2.2, E - 0.1, PI); K.plane(A.company, 6, 1.5, 20, 2.2, -E + 0.1, 0);
    K.plane(A.h2s, 1, 1, E - 0.1, 1.8, -4, -PI / 2, { alpha: true }); K.plane(A.h2s, 1, 1, -E + 0.1, 1.8, 14, PI / 2, { alpha: true });
    K.plane(A.noSmoke, 0.8, 1, -E + 0.1, 1.7, -10, PI / 2); K.plane(A.noSmoke, 0.8, 1, E - 0.1, 1.7, 12, -PI / 2);
  }

  // ------------------------------------------------------------ the drilling tower
  function tower(rnd) {
    const A = art();
    L.box(-5.2, 0, -5.2, 6.0, PAD, 5.8, 'concrete', { top: 'concreteDark' });
    for (const [x, z] of [[-1.5, 3.2], [2.5, -3], [-3.4, -2]]) stain(x, z, 1.4, PAD);
    deco(-5.2, PAD, 5.4, 6.0, PAD + 0.006, 5.55, 'paintYellow');
    // ground floor: four columns, knee braces under the rig floor, the wellhead and the blowout preventer
    const col = (x, z, y0, y1) => L.box(x - 0.15, y0, z - 0.15, x + 0.15, y1, z + 0.15, 'rust');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      col(sx * 3.85, sz * 3.85, PAD, L1 - 0.25);
      L.pipe('rust', sx * 3.85, 2.0, sz * 3.85, sx * 2.9, L1 - 0.3, sz * 3.85, 0.05); L.pipe('rust', sx * 3.85, 2.0, sz * 3.85, sx * 3.85, L1 - 0.3, sz * 2.9, 0.05);
    }
    col(5.25, -3.85, PAD, L1 - 0.25); col(5.25, -0.65, PAD, L1 - 0.25);
    // BOP stack: red rams, the annular on top, a spool up into the rotary table
    L.cyl('paintDark', 0, PAD + 0.15, 0, 0.9, 0.3, 0, 0, false);
    L.cyl('paintRed', 0, PAD + 0.75, 0, 0.62, 0.9, 0, 0, false);
    for (const y of [0.5, 1.0]) deco(-0.95, PAD + y - 0.14, -0.3, 0.95, PAD + y + 0.14, 0.3, 'paintRed');
    L.cyl('steel', 0, PAD + 1.26, 0, 0.7, 0.12, 0, 0, false); K.sph('paintRed', 0, PAD + 1.62, 0, 0.66, 0.42, 0.66);
    L.cyl('steel', 0, PAD + 2.25, 0, 0.26, 0.9, 0, 0, false);
    W.addCyl(0, 0, 0.9, PAD, L1 - 0.25, { surf: 'metal' });
    // choke line east to a manifold of valves, kill line west
    tube('steel', 0.6, PAD + 0.75, 0, 3.2, PAD + 0.75, 0, 0.1); tube('steel', 3.2, PAD + 0.75, -1.2, 3.2, PAD + 0.75, 1.2, 0.12);
    for (const z of [-0.8, 0, 0.8]) { L.cyl('paintDark', 3.2, PAD + 0.75, z, 0.18, 0.3, 0, 0, false); L.pipe('steel', 3.2, PAD + 0.9, z, 3.2, PAD + 1.3, z, 0.025); handwheel(3.2, PAD + 1.32, z, false, 0.16); }
    solid(3.0, PAD, -1.35, 3.4, PAD + 1.5, 1.35, 'metal'); solid(0.9, PAD, -0.12, 3.0, PAD + 0.87, 0.12, 'metal');
    tube('steel', -0.6, PAD + 0.75, 0, -2.2, PAD + 0.75, 0, 0.08); L.cyl('paintDark', -2.3, PAD + 0.75, 0, 0.16, 0.3, 0, PI / 2, false); handwheel(-2.3, PAD + 1.15, 0, true, 0.18);
    L.pipe('steel', -2.3, PAD + 0.9, 0, -2.3, PAD + 1.1, 0, 0.025); solid(-2.5, PAD, -0.2, -0.9, PAD + 1.35, 0.2, 'metal');
    // mud pump skid in the south-west corner, drums round the columns
    L.box(-3.5, PAD, 1.5, -1.3, PAD + 0.25, 3.4, 'paintDark', { top: 'steel' });
    L.cyl('paintYellow', -2.4, PAD + 0.75, 2.45, 0.42, 1.8, PI / 2, 0, false); deco(-3.3, PAD + 0.25, 1.7, -2.9, PAD + 1.2, 3.2, 'paintYellow');
    solid(-3.5, PAD, 1.5, -1.3, PAD + 1.2, 3.4, 'metal');
    P('drum', 3.2, 3.2, 0.3, PAD); P('drum', 2.5, 3.5, 0, PAD); P('barrel', -3.2, -3.2, 0, PAD);
    // under-floor lights
    for (const [x, z] of [[-2, -2], [2, 2]]) { deco(x - 0.12, L1 - 0.35, z - 0.12, x + 0.12, L1 - 0.25, z + 0.12, 'paintDark'); K.sph('lampWarm', x, L1 - 0.38, z, 0.09, 0.05, 0.09); }
    L.lamp(0, L1 - 0.6, 0, { color: 0xffd9a8, intensity: 1.1, distance: 9, pool: false });

    // --- the rig floor (L1) and its landing, reached by the east stair
    L.box(-4, L1 - 0.25, -4, 4, L1, 4, 'rust', { top: 'grate' });
    L.box(4, L1 - 0.25, -4, 5.4, L1, -0.5, 'rust', { top: 'grate' });
    PK.steps('z', -0.5, 5.0, 4.1, 5.3, PAD, L1, -1, 'rust', 'grate'); PK.slopeGuard('z', -0.5, 5.0, 5.35, PAD, L1, -1);
    PK.rail('x', -4, 4, -3.94, L1); PK.rail('x', 4, 5.4, -3.94, L1); PK.rail('z', -4, -0.5, 5.34, L1); PK.rail('z', -0.5, 4, 3.94, L1);
    PK.rail('x', -4, 4, 3.94, L1); PK.rail('z', -4, -1, -3.94, L1); PK.rail('z', 3.2, 4, -3.94, L1);
    // rotary table and the kelly
    L.cyl('paintDark', 0, L1 + 0.1, 0, 0.9, 0.2, 0, 0, false); L.cyl('steel', 0, L1 + 0.21, 0, 0.5, 0.02, 0, 0, true); W.addCyl(0, 0, 0.9, L1, L1 + 0.2, { surf: 'metal' });
    K.put('steel', L.geo('cylLo'), 0, (L1 + 0.2 + L2 - 0.25) / 2, 0, 0.1, L2 - 0.25 - L1 - 0.2, 0.1); W.addCyl(0, 0, 0.12, L1 + 0.2, L2 - 0.25, { surf: 'metal' });
    // drawworks: the big winch drum on a skid, its motor and guards
    L.box(-1.9, L1, -3.75, 1.9, L1 + 0.3, -2.45, 'paintDark', { top: 'steel' });
    L.cyl('rust', 0, L1 + 0.95, -3.1, 0.5, 2.9, 0, PI / 2, false);
    for (let k = -1.2; k <= 1.2; k += 0.12) L.cyl('steel', k, L1 + 0.95, -3.1, 0.52, 0.05, 0, PI / 2, true);
    for (const sx of [-1, 1]) deco(sx * 1.5 - 0.2, L1 + 0.3, -3.75, sx * 1.5 + 0.2, L1 + 1.5, -2.45, 'paintYellow');
    deco(-1.3, L1 + 1.45, -3.7, 1.3, L1 + 1.5, -2.5, 'paintYellow');
    solid(-1.9, L1, -3.75, 1.9, L1 + 1.5, -2.45, 'metal');
    // the doghouse: the driller's cabin, a door facing west, a window over the rig floor
    { const x0 = 0.9, x1 = 2.6, z0 = 0.8, z1 = 2.5, hh = T / 2, y1 = L2 - 0.25;
      wall('x', x0 - hh, x1 + hh, z0, L1, y1, [[1.3, 2.3, L1 + 1.1, L1 + 1.9]], -1, 'metalSiding', 'panelWhite', 'paintDark');
      wall('x', x0 - hh, x1 + hh, z1, L1, y1, [], 1, 'metalSiding', 'panelWhite', 'paintDark');
      wall('z', z0 + hh, z1 - hh, x0, L1, y1, [[1.05, 1.9, L1, L1 + 2.1]], -1, 'metalSiding', 'panelWhite', 'paintDark');
      wall('z', z0 + hh, z1 - hh, x1, L1, y1, [[1.2, 2.0, L1 + 1.1, L1 + 1.9]], 1, 'metalSiding', 'panelWhite', 'paintDark');
      deco(x0 + hh, L1, z0 + hh, x1 - hh, L1 + 0.006, z1 - hh, 'metalFloor');
      L.box(1.3, L1, 2.05, 2.45, L1 + 0.8, 2.375, 'paintGrey', { top: 'paintDark' });
      for (let i = 0; i < 4; i++) K.sph(i % 2 ? 'lampGreen' : 'lampAmber', 1.45 + i * 0.25, L1 + 0.86, 2.08, 0.025);
      deco(1.4, L1 + 0.95, 2.34, 2.35, L1 + 1.6, 2.375, 'paintDark'); deco(1.45, L1 + 1.0, 2.335, 2.3, L1 + 1.55, 2.34, 'windowCool');
      P('stool', 1.75, 1.55, 0, L1);
      K.plane(A.h2s, 0.5, 0.5, x0 - hh - 0.02, L1 + 2.35, 1.5, -PI / 2, { alpha: true });
      deco(1.45, y1 - 0.08, 1.4, 2.05, y1, 1.9, 'steel'); deco(1.5, y1 - 0.11, 1.5, 2.0, y1 - 0.08, 1.8, 'lampCool');
      L.lamp(1.75, y1 - 0.4, 1.65, { color: 0xe8f0ff, intensity: 0.9, distance: 5, pool: false }); }
    P('drum', -1.8, 3.3, 0.2, L1); P('crateSmall', 3.3, 1.2, 0.3, L1);
    K.plane(A.well, 2.1, 0.66, 0.8, L1 + 0.55, 3.99, 0);
    K.plane(A.noSmoke, 0.5, 0.62, 5.4 + 0.02, L1 + 1.3, -3.2, PI / 2);

    // --- the second deck (L2) and its west landing, reached by the west stair from the rig floor
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) col(sx * 2.85, sz * 2.85, L1, L2 - 0.25);
    PK.steps('z', -1, 3.2, -4, -3, L1, L2, -1, 'rust', 'grate'); PK.slopeGuard('z', -1, 3.2, -3.95, L1, L2, -1);
    L.box(-3, L2 - 0.25, -3, 3, L2, 3, 'rust', { top: 'grate' });
    L.box(-4, L2 - 0.25, -3, -3, L2, -1, 'rust', { top: 'grate' });
    L.pipe('rust', -2.95, L2 - 0.8, -2.0, -3.9, L2 - 0.3, -2.0, 0.05);
    PK.rail('x', -4, 3, -2.94, L2); PK.rail('z', -3, -1, -3.94, L2); PK.rail('z', -1, 3, -2.94, L2);
    PK.rail('x', -3, 3, 2.94, L2); PK.rail('z', -3, -1, 2.94, L2); PK.rail('z', 2.3, 3, 2.94, L2);
    // drill pipe laid down along the south rail, a drum, the armour
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4 - r; i++) L.cyl('steel', -0.6, L2 + 0.12 + r * 0.21, 2.2 + i * 0.2 + r * 0.1, 0.1, 4.0, 0, PI / 2, true);
    for (const x of [-2.2, 1.0]) deco(x - 0.08, L2, 2.1, x + 0.08, L2 + 0.06, 2.9, 'woodDark');
    solid(-2.6, L2, 2.1, 1.4, L2 + 0.45, 2.88, 'metal');
    P('drum', 2.3, -2.4, 0, L2);
    L.addPickup('armor', -0.6, L2, 0.6);

    // --- the top platform under the derrick, reached by the east stair from L2
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) col(sx * 1.85, sz * 1.85, L2, TOP - 0.25);
    PK.steps('z', -1, 2.3, 2, 3, L2, TOP, -1, 'rust', 'grate'); PK.slopeGuard('z', -1, 2.3, 2.95, L2, TOP, -1);
    L.box(-2, TOP - 0.25, -2, 2, TOP, 2, 'rust', { top: 'grate' });
    L.box(2, TOP - 0.25, -2, 3, TOP, -1, 'rust', { top: 'grate' });
    L.pipe('rust', 1.95, TOP - 0.8, -1.5, 2.9, TOP - 0.3, -1.5, 0.05);
    PK.rail('x', -2, 3, -1.94, TOP); PK.rail('z', -2, -1, 2.94, TOP); PK.rail('z', -1, 2, 1.94, TOP); PK.rail('x', -2, 2, 1.94, TOP); PK.rail('z', -2, 2, -1.94, TOP);
    // corrugated sheets wired to the north and west rails: the only cover up here
    L.box(-2, TOP, -2.07, 2, TOP + 0.95, -2.01, 'rust'); L.box(-2.07, TOP, -2, -2.01, TOP + 0.95, 2, 'rust');
    K.plane(A.stencil('K-12', 'rgba(236,228,210,0.85)'), 1.8, 0.56, 0, TOP + 0.5, -2.08, PI, { alpha: true });
    L.addPickup('ammo', -1, TOP, 1);
    // spotlight on the south-east corner
    L.pipe('steel', 1.8, TOP, 1.8, 1.8, TOP + 1.3, 1.8, 0.03);
    K.put('paintDark', L.geo('cyl'), 1.8, TOP + 1.4, 1.95, 0.2, 0.34, 0.2, 0, PI / 2 - 0.35); K.sph('lampWarm', 1.8, TOP + 1.45, 2.12, 0.16, 0.16, 0.03);

    // --- the derrick: four legs tapering to the crown, girts and braces, the travelling block
    const lg = (k, sx, sz) => { const b = 1.9 - 1.4 * k; return [sx * b, TOP + 13 * k, sz * b]; };
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const c of C) { const a = lg(0, c[0], c[1]), b = lg(1, c[0], c[1]); L.pipe('rust', a[0], a[1], a[2], b[0], b[1], b[2], 0.1); W.addCyl(c[0] * 1.85, c[1] * 1.85, 0.12, TOP, TOP + 2.2, { surf: 'metal' }); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const c0 = C[j], c1 = C[(j + 1) % 4], k0 = 3 / 13 + i * (10 / 13) / 4, k1 = 3 / 13 + (i + 1) * (10 / 13) / 4;
      const p0 = lg(k0, c0[0], c0[1]), p1 = lg(k0, c1[0], c1[1]), p2 = lg(k1, c1[0], c1[1]), p3 = lg(k1, c0[0], c0[1]);
      L.pipe('rust', p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.05);
      L.pipe('rust', p0[0], p0[1], p0[2], p2[0], p2[1], p2[2], 0.035); L.pipe('rust', p1[0], p1[1], p1[2], p3[0], p3[1], p3[2], 0.035);
    }
    L.box(-0.8, TOP + 13, -0.8, 0.8, TOP + 13.6, 0.8, 'paintYellow', { noCol: true });
    for (const z of [-0.3, 0, 0.3]) L.cyl('steel', 0, TOP + 13.8, z, 0.35, 0.1, PI / 2, 0, true);
    L.pipe('steel', 0.7, TOP + 13.6, 0.7, 0.7, TOP + 16, 0.7, 0.03); K.sph('lampRed', 0.7, TOP + 16.05, 0.7, 0.09);
    const beacon = L.lamp(0.7, TOP + 16, 0.7, { color: 0xff3020, intensity: 0.8, distance: 6, pool: false });
    L.animated.push((dt, t) => { beacon.intensity = (t % 1.6) < 0.5 ? 0.8 : 0.05; });
    for (const dx of [-0.2, 0.2]) L.pipe('steel', dx, TOP + 13, 0, dx, TOP + 7.2, 0, 0.015);
    L.box(-0.3, TOP + 6.2, -0.25, 0.3, TOP + 7.3, 0.25, 'paintYellow', { noCol: true });
    K.put('steel', L.geo('torus'), 0, TOP + 5.9, 0, 0.22, 0.22, 0.6, PI / 2);
    L.pipe('steel', 0, TOP + 6.2, 0, 0, TOP + 5.95, 0, 0.05);
  }

  // ------------------------------------------------------------ pipelines
  function pipelines(rnd) {
    const A = art();
    // the big pipe along the north: on concrete saddles, it arches over a 6 m gap north of the tower,
    // turns north at the east end into tank 1 and dives into a valve pit at the west end
    const Z = -12, Y = 0.8, R = 0.5;
    tube('rust', -22, Y, Z, -3.5, Y, Z, R, 6); tube('rust', 3.5, Y, Z, 22, Y, Z, R, 6); tube('rust', 22, Y, Z, 22, Y, -21.6, R, 4);
    tube('rust', -3.5, Y, Z, -3.5, 3.6, Z, R); tube('rust', -3.5, 3.6, Z, 3.5, 3.6, Z, R, 3.5); tube('rust', 3.5, 3.6, Z, 3.5, Y, Z, R);
    for (const [x, y, z] of [[-3.5, Y, Z], [-3.5, 3.6, Z], [3.5, 3.6, Z], [3.5, Y, Z], [22, Y, Z]]) elbow('rust', x, y, z, R);
    tube('rust', -22, Y, Z, -22, -0.2, Z, R); elbow('rust', -22, Y, Z, R);
    W.add(-22.5, 0, Z - R, -4, Y + R, Z + R, { surf: 'metal' }); W.add(4, 0, Z - R, 22.5, Y + R, Z + R, { surf: 'metal' }); W.add(21.5, 0, -21.3, 22.5, Y + R, Z - R, { surf: 'metal' });
    W.add(-4, 0, Z - R, -3, 4.1, Z + R, { surf: 'metal' }); W.add(3, 0, Z - R, 4, 4.1, Z + R, { surf: 'metal' }); W.add(-3, 3.1, Z - R, 3, 4.1, Z + R, { surf: 'metal' });
    const saddle = (x, z, alongX) => { const a = alongX ? 0.25 : 0.6, b = alongX ? 0.6 : 0.25; deco(x - a, 0, z - b, x + a, 0.34, z + b, 'concrete'); if (alongX) deco(x - 0.05, 0.3, z - 0.56, x + 0.05, 0.9, z + 0.56, 'steel'); else deco(x - 0.56, 0.3, z - 0.05, x + 0.56, 0.9, z + 0.05, 'steel'); };
    for (let x = -19; x < -5; x += 3.5) saddle(x, Z, true);
    for (let x = 6; x < 21; x += 3.5) saddle(x, Z, true);
    for (let z = -15; z > -20; z -= 3.5) saddle(22, z, false);
    handwheel(-3.5, 2.0, Z - 0.75, false, 0.3); L.cyl('paintDark', -3.5, 2.0, Z - 0.55, 0.12, 0.35, PI / 2, 0, true);
    K.plane(A.stencil('LINE 3', 'rgba(236,228,210,0.8)'), 1.1, 0.34, 12, Y, Z + R + 0.02, 0, { alpha: true });
    // valve pit at the west end: a concrete box with the gate valve standing out of it
    L.box(-23.3, 0, -13.3, -20.7, 0.45, -10.7, 'concrete', { top: 'concreteDark' });
    deco(-22.9, 0.45, -12.9, -21.1, 0.456, -11.1, 'grate');
    L.pipe('steel', -21.4, 0.45, -11.4, -21.4, 1.6, -11.4, 0.05); handwheel(-21.4, 1.62, -11.4, false, 0.32);

    // the raised pipe rack to the west: two lines on T posts, over head height, diving into the ground at each end
    const RX = -14, RZ0 = -7, RZ1 = 12.5, RY = 3.1;
    for (let z = -6.6; z <= RZ1 - 0.2; z += 4.8) {
      L.box(RX - 0.12, 0, z - 0.12, RX + 0.12, RY + 0.3, z + 0.12, 'rust');
      deco(RX - 0.95, RY - 0.42, z - 0.1, RX + 0.95, RY - 0.28, z + 0.1, 'rust');
      L.pipe('rust', RX, RY - 1.2, z, RX - 0.8, RY - 0.42, z, 0.04); L.pipe('rust', RX, RY - 1.2, z, RX + 0.8, RY - 0.42, z, 0.04);
      L.box(RX - 0.35, 0, z - 0.35, RX + 0.35, 0.2, z + 0.35, 'concrete');
    }
    for (const [x, r] of [[RX - 0.5, 0.28], [RX + 0.5, 0.2]]) {
      tube('rust', x, RY - 0.28 + r, RZ0, x, RY - 0.28 + r, RZ1, r, 6);
      for (const z of [RZ0, RZ1]) { tube('rust', x, RY - 0.28 + r, z, x, -0.2, z, r); elbow('rust', x, RY - 0.28 + r, z, r); L.box(x - 0.5, 0, z - 0.5, x + 0.5, 0.25, z + 0.5, 'concrete'); }
    }
    W.add(RX - 0.95, RY - 0.42, RZ0 - 0.3, RX + 0.95, RY + 0.35, RZ1 + 0.3, { surf: 'metal' });
    for (const z of [RZ0, RZ1]) W.add(RX - 0.8, 0, z - 0.3, RX + 0.8, RY + 0.35, z + 0.3, { surf: 'metal' });
    K.plane(A.stencil('GAS', 'rgba(242,194,48,0.9)'), 0.8, 0.25, RX - 0.8, RY - 0.28 + 0.28, 2, -PI / 2, { alpha: true });

    // the low pipe east of the tower, on sleepers, between two thrust blocks
    const PX = 13;
    tube('rust', PX, 0.5, -7, PX, 0.5, 9, 0.4, 5.3);
    for (let z = -5; z < 8; z += 3.2) L.box(PX - 0.6, 0, z - 0.15, PX + 0.6, 0.12, z + 0.15, 'woodDark');
    L.box(PX - 0.6, 0, -7.8, PX + 0.6, 1.1, -7, 'concrete', { top: 'concreteDark' }); L.box(PX - 0.6, 0, 9, PX + 0.6, 1.1, 9.8, 'concrete', { top: 'concreteDark' });
    W.add(PX - 0.42, 0, -7, PX + 0.42, 0.92, 9, { surf: 'metal' });
    L.cyl('paintDark', PX, 0.5, 1, 0.5, 0.5, PI / 2, 0, false); L.pipe('steel', PX, 1.0, 1, PX, 1.5, 1, 0.03); handwheel(PX, 1.52, 1, false, 0.28);
    solid(PX - 0.5, 0.9, 0.7, PX + 0.5, 1.8, 1.3, 'metal');

    // the pipe yard south of the tower: casing stacked on timber, a smaller pile by the jersey barriers
    for (const x of [2.6, 8.4]) deco(x - 0.12, 0, 14, x + 0.12, 0.08, 16.2, 'woodDark');
    for (let i = 0; i < 3; i++) tube('rust', 2, 0.43, 14.45 + i * 0.66, 9, 0.43, 14.45 + i * 0.66, 0.33);
    for (let i = 0; i < 2; i++) tube('steel', 2.2, 0.99, 14.78 + i * 0.66, 8.8, 0.99, 14.78 + i * 0.66, 0.33);
    solid(1.9, 0, 14.05, 9.1, 1.32, 16.15, 'metal');
    for (const z of [18.6, 19.3]) tube('rust', -6, 0.36, z, -1, 0.36, z, 0.33);
    solid(-6.05, 0, 18.25, -0.95, 0.7, 19.65, 'metal');
  }

  // ------------------------------------------------------------ the site office (north-west), two floors
  function office(rnd) {
    const A = art(), x0 = -30, x1 = -20, z0 = -30, z1 = -23, h = T / 2, O = 'metalSiding', I = 'plywood', TR = 'rust';
    wall('x', x0 - h, x1 + h, z0, 0, OH, [[-27.2, -25.8, 4.2, 5.2]], -1, O, I, TR);
    wall('x', x0 - h, x1 + h, z1, 0, OH, [[-24.9, -23.5, 0, 2.3], [-28.6, -26.8, 1.0, 2.1], [-22.3, -20.9, 1.0, 2.1], [-28.9, -26.9, 4.2, 5.3], [-25.8, -23.8, 4.2, 5.3], [-22.6, -20.9, 4.2, 5.3]], 1, O, I, TR);
    wall('z', z0 + h, z1 - h, x1, 0, OH, [[-27.2, -25.8, 0, 2.3], [-29.2, -27.6, 4.2, 5.3], [-26, -24, 4.2, 5.3]], 1, O, I, TR);
    wall('z', z0 + h, z1 - h, x0, 0, OH, [[-26.4, -24.8, 1.0, 2.1], [-27.6, -24.6, 4.2, 5.3]], -1, O, I, TR);
    const ix0 = x0 + h, ix1 = x1 - h, iz0 = z0 + h, iz1 = z1 - h;
    deco(ix0, 0, iz0, ix1, 0.006, iz1, 'concreteDark');
    // the upper floor round the stairwell; the stair climbs west along the north wall
    const sl = (a, b, c, d) => L.box(a, OF - 0.25, b, c, OF, d, 'ceiling', { top: 'floorWood', side: 'woodDark' });
    sl(ix0, iz0, -27, iz1); sl(-27, -28.65, ix1, iz1); sl(-21.3, iz0, ix1, -28.65);
    PK.steps('x', -27, -21.3, iz0, -28.7, 0, OF, -1, 'woodDark', 'metalFloor'); PK.slopeGuard('x', -27, -21.3, -28.66, 0, OF, -1);
    PK.rail('x', -27, -21.3, -28.6, OF); PK.rail('z', iz0, -28.65, -21.24, OF);
    // roof
    L.box(x0 - 0.35, OH, z0 - 0.35, x1 + 0.35, OH + 0.2, z1 + 0.35, 'ceiling', { top: 'roofTin', side: 'rust' }); K.roofCap(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, OH + 0.2);
    P('ac', -27, -27.5, 0, OH + 0.2); P('vent', -22.5, -25, 0, OH + 0.2);
    L.pipe('steel', -21, OH + 0.2, -29, -21, OH + 4.5, -29, 0.03); for (const y of [OH + 2.5, OH + 3.5]) L.pipe('steel', -21.5, y, -29, -20.5, y, -29, 0.015);
    K.put('paintGrey', K.discGeo(0, 0.55, 1), -24.5, OH + 1.0, -29.2, 1, 1, 1, 0, -0.8); L.pipe('paintGrey', -24.5, OH + 0.2, -29.2, -24.5, OH + 0.95, -29.2, 0.04);
    // the porch roof over the south door (you can stand on it: out of the window upstairs and back)
    L.box(-25.7, 2.55, z1 + h, -22.7, 2.68, z1 + 1.35, 'rust', { top: 'roofTin' });
    for (const x of [-25.55, -22.85]) { L.pipe('steel', x, 2.55, z1 + 1.25, x, 1.7, z1 + h, 0.03); }
    K.plane(A.office, 2.4, 0.6, -24.2, 3.0, z1 + h + 0.03, 0);
    K.plane(A.company, 3.2, 0.8, x1 + h + 0.03, 3.4, -24.8, PI / 2);
    K.plane(A.noSmoke, 0.5, 0.62, -26.2, 1.6, z1 + h + 0.03, 0);
    // outside: an AC unit on the east wall, conduit, a generator, the porta-cabin toilet, fuel drums
    deco(x1 + h, 2.0, -29.2, x1 + h + 0.7, 2.9, -28.2, 'appliance'); for (let y = 2.1; y < 2.85; y += 0.08) deco(x1 + h + 0.7, y, -29.1, x1 + h + 0.72, y + 0.03, -28.3, 'paintDark');
    L.pipe('steel', x1 + h + 0.3, 2.0, -28.7, x1 + h + 0.3, 0, -28.7, 0.05); solid(x1 + h, 1.9, -29.2, x1 + h + 0.72, 2.95, -28.2, 'metal');
    L.pipe('paintDark', x1 + h + 0.05, 0.2, -23.6, x1 + h + 0.05, OH, -23.6, 0.035);
    P('generator', -18.5, -29, PI / 2); P('drum', -18.2, -26.8); P('drum', -18.9, -26.3, 0.6); P('barrel', -18.2, -25.6);
    L.box(-32.8, 0, -29.6, -31.6, 2.3, -28.4, 'paintBlue', { top: 'paintGrey' }); deco(-31.6, 0.05, -29.3, -31.58, 2.0, -28.7, 'paintGrey'); K.sph('paintGrey', -32.2, 2.3, -29, 0.55, 0.12, 0.55);
    // ground floor: the foreman's desk, a table, cabinets, lockers, the drilling log on the wall
    L.box(-29.8, 0, -28.2, -28.4, 0.76, -26.6, 'woodDark', { top: 'counter' });
    deco(-29.7, 0.76, -27.8, -29.62, 1.2, -27.0, 'paintDark'); deco(-29.62, 0.8, -27.75, -29.61, 1.16, -27.05, 'windowCool');
    deco(-28.9, 0.76, -26.95, -28.5, 0.96, -26.7, 'plateOlive'); K.sph('lampGreen', -28.7, 0.9, -26.69, 0.015);
    K.chair(-28.0, -27.4, 0);
    K.table(-26.6, -26.6, -24.8, -25.2, 0); K.chair(-27, -25.9, 0); K.chair(-24.4, -25.9, 0); K.chair(-25.7, -24.7, 0);
    deco(-26.2, 0.78, -26.3, -25.5, 0.8, -25.6, 'cardboard'); L.cyl('paintRed', -25.1, 0.84, -25.9, 0.05, 0.12, 0, 0, true);
    for (let i = 0; i < 2; i++) L.box(-23.2 + i * 0.45, 0, iz1 - 0.6, -22.8 + i * 0.45, 1.3, iz1, 'paintGrey', { top: 'paintDark' });
    for (let i = 0; i < 3; i++) { L.box(ix0, 0, -24.6 + i * 0.46, ix0 + 0.5, 1.9, -24.16 + i * 0.46, 'paintGreen', { top: 'paintDark' }); deco(ix0 + 0.5, 1.2, -24.4 + i * 0.46, ix0 + 0.52, 1.3, -24.35 + i * 0.46, 'chrome'); }
    K.plane(A.log, 1.6, 1.2, ix1 - 0.02, 1.7, -24.3, -PI / 2);
    L.cyl('appliance', -21.2, 0.55, -24.2, 0.2, 1.1, 0, 0, true); L.cyl('glassDay', -21.2, 1.3, -24.2, 0.15, 0.4, 0, 0, true); solid(-21.4, 0, -24.4, -21.0, 1.5, -24.0);
    K.roomLight(-25, OF - 0.25, -26);
    // upstairs: the radio desk at the south windows, a cot, crates, the site map
    L.box(-28.6, OF, iz1 - 0.7, -26.8, OF + 0.76, iz1, 'woodDark', { top: 'counter' });
    deco(-28.4, OF + 0.76, iz1 - 0.55, -27.6, OF + 1.05, iz1 - 0.2, 'plateOlive'); for (let i = 0; i < 3; i++) K.sph(i ? 'lampAmber' : 'lampGreen', -28.3 + i * 0.15, OF + 1.0, iz1 - 0.56, 0.015);
    L.pipe('steel', -27.8, OF + 1.05, iz1 - 0.3, -27.8, OF + 1.7, iz1 - 0.3, 0.008); K.chair(-27.7, iz1 - 1.1, OF);
    L.box(ix0, OF, -26.5, ix0 + 0.8, OF + 0.45, -24.3, 'canvasOlive', { top: 'bedspread' });
    P('crate', -21, -24, 0.1, OF); P('crateSmall', -21.2, -25.3, -0.2, OF);
    K.plane(A.site, 1.6, 1.2, -28.4, OF + 1.6, iz0 + 0.02, 0);
    K.roomLight(-24.5, OH, -26); L.addPickup('ammo', -22.5, OF, -26.8);
  }

  // ------------------------------------------------------------ the pump house (south-east), roof up an outside stair
  function pumpHouse(rnd) {
    const A = art(), x0 = 18, x1 = 28, z0 = 20, z1 = 28, h = T / 2, O = 'bunker', I = 'concrete', TR = 'rust';
    wall('x', x0 - h, x1 + h, z0, 0, PHH, [[21, 22.5, 0, 2.3], [24, 26.2, 1.2, 2.2]], -1, O, I, TR);
    wall('x', x0 - h, x1 + h, z1, 0, PHH, [[19.6, 21.2, 1.2, 2.2], [24.4, 26, 1.2, 2.2]], 1, O, I, TR);
    wall('z', z0 + h, z1 - h, x0, 0, PHH, [[20.9, 22.4, 1.2, 2.2], [23.6, 25.1, 0, 2.3], [26, 27.2, 1.2, 2.2]], -1, O, I, TR);
    wall('z', z0 + h, z1 - h, x1, 0, PHH, [], 1, O, I, TR);
    const ix0 = x0 + h, ix1 = x1 - h, iz0 = z0 + h, iz1 = z1 - h;
    deco(ix0, 0, iz0, ix1, 0.006, iz1, 'concreteDark');
    // the roof: a slab with a parapet, a gap on the east for the stair landing
    L.box(x0 - h, PHH, z0 - h, x1 + h, PHR, z1 + h, 'ceiling', { top: 'concreteDark', side: 'bunker' });
    const par = (a, b, c, d) => L.box(a, PHR, b, c, PHR + 0.9, d, 'bunker', { top: 'concreteDark' });
    par(x0 - h, z0 - h, x1 + h, z0 + h); par(x0 - h, z1 - h, x1 + h, z1 + h); par(x0 - h, z0 + h, x0 + h, z1 - h);
    par(x1 - h, z0 + h, x1 + h, 20.6); par(x1 - h, 22, x1 + h, z1 - h);
    // the stair and its landing
    PK.steps('z', 22, 28.8, 28.3, 29.5, 0, PHR, -1, 'rust', 'grate'); PK.slopeGuard('z', 22, 28.8, 29.55, 0, PHR, -1);
    L.box(x1 + h, PHR - 0.2, 20.6, 29.6, PHR, 22, 'rust', { top: 'grate' });
    L.box(29.35, 0, 20.6, 29.6, PHR - 0.2, 20.85, 'rust');
    PK.rail('z', 20.6, 22, 29.55, PHR); PK.rail('x', x1 + h, 29.6, 20.64, PHR);
    // on the roof: sandbags along the west parapet, the AC plant, a vent, a header tank on a stand
    PK.bags(19, 21.2, 19, 23.4, 2, PHR);
    P('ac', 25.6, 26.6, 0, PHR); P('vent', 21.5, 26.8, 0, PHR);
    for (const [x, z] of [[22.9, 21.0], [24.1, 21.0], [22.9, 22.2], [24.1, 22.2]]) L.pipe('steel', x, PHR, z, x, PHR + 1.1, z, 0.04);
    L.cyl('rust', 23.5, PHR + 1.65, 21.6, 0.85, 1.1, 0, 0, false); K.sph('rust', 23.5, PHR + 2.2, 21.6, 0.85, 0.2, 0.85);
    solid(22.65, PHR, 20.75, 24.35, PHR + 2.3, 22.45, 'metal');
    // inside: two pumps on skids with their motors, pipes up and out through the wall, the control panel, a bench
    for (const z of [23.3, 26.3]) {
      L.box(23.4, 0, z - 0.7, 27.4, 0.28, z + 0.7, 'paintDark', { top: 'steel' });
      L.cyl('paintGreen', 26.3, 0.85, z, 0.55, 1.6, 0, PI / 2, false); K.sph('paintGreen', 25.5, 0.85, z, 0.25, 0.55, 0.55);
      L.cyl('paintGreen', 24.3, 0.8, z, 0.5, 0.7, PI / 2, 0, false); L.cyl('paintDark', 24.3, 0.8, z, 0.26, 1.1, PI / 2, 0, false);
      deco(24.9, 0.5, z - 0.3, 25.3, 1.05, z + 0.3, 'paintYellow');
      L.pipe('steel', 24.3, 1.3, z, 24.3, 2.9, z, 0.14); tube('steel', 24.3, 2.9, z, ix1, 2.9, z, 0.14); elbow('steel', 24.3, 2.9, z, 0.14);
      solid(23.4, 0, z - 0.7, 27.4, 1.45, z + 0.7, 'metal'); W.addCyl(24.3, z, 0.16, 1.45, 3.05, { surf: 'metal' });
      handwheel(24.3, 2.0, z - 0.2, false, 0.2);
    }
    L.box(26.4, 0, iz0, 27.8, 2.0, iz0 + 0.45, 'paintGrey', { top: 'paintDark' });
    for (let i = 0; i < 6; i++) { const gx = 26.6 + (i % 3) * 0.45, gy = 1.25 + (i / 3 | 0) * 0.4; L.cyl('appliance', gx, gy, iz0 + 0.46, 0.12, 0.03, PI / 2, 0, true); K.sph(i % 2 ? 'lampGreen' : 'lampRed', gx, gy - 0.18, iz0 + 0.46, 0.02); }
    L.box(21.8, 0, iz1 - 0.6, 24.2, 0.9, iz1, 'steel', { top: 'woodDark' }); deco(22.2, 0.9, iz1 - 0.45, 22.9, 1.1, iz1 - 0.2, 'paintRed'); deco(23.3, 0.9, iz1 - 0.5, 23.5, 1.3, iz1 - 0.35, 'paintGrey');
    P('crate', 19.2, 26.9, 0.1); P('crateSmall', 19.25, 26.9, -0.2, 1.2); P('drum', 20.4, 27.2);
    K.plane(A.pump, 2.4, 0.6, 22.8, 2.85, z0 - h - 0.03, PI);
    K.plane(A.h2s, 0.6, 0.6, x0 - h - 0.03, 2.8, 24.35, -PI / 2, { alpha: true });
    PK.extinguisher(ix0, 1.0, 22.8, 1, 0);
    K.roomLight(22, PHH, 22.4); K.roomLight(22, PHH, 26.2);
    L.addPickup('ammo', 21.2, 0, 24.3);
    // outside: a transformer on a plinth, cable drums, sandbags by the north door
    L.box(30.0, 0, 24.2, 32.2, 0.3, 26.4, 'concrete');
    L.box(30.3, 0.3, 24.5, 31.9, 2.0, 26.1, 'paintGreen', { top: 'paintDark' });
    for (let k = 0; k < 5; k++) deco(30.25, 0.5 + k * 0.28, 24.5, 30.3, 0.6 + k * 0.28, 26.1, 'paintDark');
    for (const z of [24.9, 25.3, 25.7]) { L.cyl('appliance', 31.1, 2.25, z, 0.08, 0.5, 0, 0, true); }
    solid(30.0, 0, 24.2, 32.2, 2.5, 26.4, 'metal');
    K.plane(A.stencil('DANGER 11kV', 'rgba(192,40,28,0.9)'), 1.4, 0.44, 31.1, 1.3, 24.49, PI, { alpha: true });
    PK.spool(31.5, 29.5, 0.7);
    PK.bags(19.5, 18.2, 22.8, 18.2, 3);
  }

  // ------------------------------------------------------------ the shed (south-west): a lean-to over a wrecked car
  function shed(rnd) {
    const x0 = -31, x1 = -21, zb = 32, zf = 26.3, yb = 3.4, yf = 2.8;
    L.box(x0 - 0.1, 0, zb - 0.12, x1 + 0.1, yb, zb + 0.12, 'metalSiding');
    for (const x of [x0, x1]) {
      L.box(x - 0.1, 0, zf + 0.1, x + 0.1, yf, zb - 0.12, 'metalSiding');
      PK.poly('metalSiding', [[x, yf, zf + 0.1], [x, yf, zb - 0.12], [x, yb, zb - 0.12], [x, yf + (yb - yf) * 0.02, zf + 0.1]], [[zf * 0.25, yf * 0.25], [zb * 0.25, yf * 0.25], [zb * 0.25, yb * 0.25], [zf * 0.25, yf * 0.25]]);
    }
    for (const x of [x0 + 0.1, (x0 + x1) / 2, x1 - 0.1]) L.box(x - 0.1, 0, zf - 0.1, x + 0.1, yf, zf + 0.1, 'rust');
    deco(x0 - 0.1, yf - 0.25, zf - 0.12, x1 + 0.1, yf, zf + 0.12, 'rust');
    // the tin roof, sloping down to the front; stepped colliders stop bullets, a cap stops anyone standing on it
    const r0 = [x0 - 0.4, yf + 0.02, zf - 0.5], r1 = [x1 + 0.4, yb + 0.12, zb + 0.3];
    PK.poly('roofTin', [[r0[0], r0[1], r0[2]], [r1[0], r0[1], r0[2]], [r1[0], r1[1], r1[2]], [r0[0], r1[1], r1[2]]], [[r0[0] * 0.33, 0], [r1[0] * 0.33, 0], [r1[0] * 0.33, 2.2], [r0[0] * 0.33, 2.2]]);
    for (let i = 0; i < 6; i++) { const za = r0[2] + (r1[2] - r0[2]) * i / 6, zc = r0[2] + (r1[2] - r0[2]) * (i + 1) / 6, y = r0[1] + (r1[1] - r0[1]) * (i + 0.5) / 6; W.add(r0[0], y - 0.08, za, r1[0], y + 0.08, zc, { surf: 'metal', nav: false }); }
    K.roofCap(r0[0], r0[2], r1[0], r1[2], yf + 0.1);
    deco(x0, 0, zf + 0.2, x1, 0.006, zb - 0.15, 'concreteDark');
    // the wreck, the workbench, welding bottles, tyres, drums
    K.car(-25.8, 29.2, true, 'carBurnt', true);
    for (const [x, z] of [[-27.3, 28.3], [-24.2, 30.1]]) L.blob(x, z, 1.4, 1.2, 0.006);
    L.box(x0 + 0.1, 0, zb - 0.8, x0 + 2.4, 0.9, zb - 0.12, 'steel', { top: 'woodDark' });
    deco(x0 + 0.3, 0.9, zb - 0.6, x0 + 0.8, 1.2, zb - 0.3, 'paintRed'); deco(x0 + 1.2, 0.9, zb - 0.55, x0 + 1.8, 1.0, zb - 0.35, 'paintDark');
    deco(x0 + 0.1, 1.3, zb - 0.14, x0 + 2.4, 2.4, zb - 0.12, 'woodDark');
    for (let x = x0 + 0.3; x < x0 + 2.3; x += 0.28) deco(x, 1.6 + (x * 7 % 0.4), zb - 0.2, x + 0.05, 2.1, zb - 0.14, 'steel');
    for (const [x, m] of [[x1 - 0.5, 'paintGreen'], [x1 - 0.9, 'paintRed']]) { L.cyl(m, x, 0.7, zb - 0.45, 0.16, 1.4, 0, 0, true); K.sph(m, x, 1.4, zb - 0.45, 0.16, 0.1, 0.16); }
    solid(x1 - 1.1, 0, zb - 0.65, x1 - 0.3, 1.5, zb - 0.25, 'metal');
    K.tires(-22.4, 27.4, 3); K.tires(-23.2, 27.1, 2);
    P('drum', -30.2, 27.2); P('drum', -29.5, 26.9, 0.4); P('barrel', -30.3, 28.1);
    deco(-26.5, yf - 0.3, 29, -26.3, yf - 0.1, 29.2, 'paintDark'); K.sph('lampWarm', -26.4, yf - 0.34, 29.1, 0.08);
    L.lamp(-26.4, yf - 0.6, 29.1, { color: 0xffc98a, intensity: 1.0, distance: 8, pool: false });
    L.addPickup('ammo', -29.8, 0, 30.4);
  }

  // ------------------------------------------------------------ the pumpjack (south-west): nodding all match long
  function pumpjack(x, z) {
    const Y = 4.8, mk = (c, mt, r) => new THREE.MeshStandardMaterial({ color: c, metalness: mt, roughness: r });
    const yel = mk(0xc89a28, 0.35, 0.55), dark = mk(0x2a2826, 0.6, 0.5), rst = mk(0x7a4428, 0.4, 0.7);
    // fixed parts: foundation, skid, samson post, gearbox and motor, the wellhead
    L.box(x - 4.8, 0, z - 1.2, x + 5.2, 0.2, z + 1.2, 'concrete', { top: 'concreteDark' });
    L.box(x - 4.4, 0.2, z - 0.9, x + 1.2, 0.45, z + 0.9, 'paintDark', { top: 'steel' });
    for (const sz of [-1, 1]) {
      L.pipe('paintYellow', x - 0.9, 0.45, z + sz * 0.75, x, Y - 0.15, z + sz * 0.22, 0.08); L.pipe('paintYellow', x + 0.9, 0.45, z + sz * 0.75, x, Y - 0.15, z + sz * 0.22, 0.08);
      L.pipe('paintYellow', x - 0.6, 1.8, z + sz * 0.6, x + 0.6, 1.8, z + sz * 0.6, 0.04);
    }
    deco(x - 0.25, Y - 0.35, z - 0.35, x + 0.25, Y - 0.1, z + 0.35, 'paintDark');
    L.box(x - 3.4, 0.45, z - 0.45, x - 2.2, 1.65, z + 0.45, 'paintYellow', { top: 'paintDark' });
    L.cyl('paintGrey', x - 3.95, 0.85, z, 0.36, 0.8, 0, PI / 2, false); L.pipe('rubber', x - 3.6, 0.85, z + 0.3, x - 2.8, 1.35, z + 0.3, 0.04);
    L.box(x + 3.8, 0.2, z - 0.35, x + 4.6, 0.6, z + 0.35, 'paintDark');
    L.cyl('steel', x + 4.2, 0.9, z, 0.14, 0.6, 0, 0, false); for (const d of [-1, 1]) { L.pipe('steel', x + 4.2, 0.9, z, x + 4.2, 0.9, z + d * 0.55, 0.06); handwheel(x + 4.2, 1.15, z + d * 0.4, true, 0.12); }
    solid(x - 4.8, 0, z - 1.2, x + 5.2, 0.45, z + 1.2, 'metal');
    solid(x - 0.9, 0.45, z - 0.85, x + 0.9, Y - 0.1, z + 0.85, 'metal');
    solid(x - 4.4, 0.45, z - 1.05, x - 1.7, 2.5, z + 1.05, 'metal');
    solid(x + 3.8, 0.2, z - 0.4, x + 4.6, 1.3, z + 0.4, 'metal');
    L.blob(x, z, 11, 3.2);
    // moving parts (their own meshes): the walking beam with the horsehead, the cranks, the pitman arms, the rod
    const add = (g, m, parent) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; (parent || L.scene).add(o); return o; };
    const beam = new THREE.Group(); beam.position.set(x, Y, z); L.scene.add(beam);
    add(new THREE.BoxGeometry(7.4, 0.42, 0.32), yel, beam).position.set(0.4, 0.12, 0);
    const hs = new THREE.Shape(); hs.moveTo(0, 0.45); hs.lineTo(0.35, 0.45); hs.quadraticCurveTo(0.95, -0.35, 0.35, -1.25); hs.lineTo(0, -1.25); hs.lineTo(0, 0.45);
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.5, bevelEnabled: false, curveSegments: 10 }); hg.translate(0, 0, -0.25);
    add(hg, yel, beam).position.set(3.9, 0, 0);
    add(new THREE.BoxGeometry(0.2, 0.2, 1.4), dark, beam).position.set(-3.1, -0.15, 0);
    add(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 12), dark, beam).rotation.x = PI / 2;
    const CX = x - 2.8, CY = 1.45, CR = 0.95;
    const crank = new THREE.Group(); crank.position.set(CX, CY, z); L.scene.add(crank);
    for (const sz of [-1, 1]) {
      add(new THREE.BoxGeometry(0.22, 1.3, 0.12), rst, crank).position.set(0, 0.3, sz * 0.62);
      add(new THREE.BoxGeometry(1.1, 0.7, 0.16), dark, crank).position.set(0, -0.55, sz * 0.62);
    }
    add(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 10), dark, crank).rotation.x = PI / 2;
    const arms = [-1, 1].map(() => add(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), dark));
    const rod = add(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), mk(0xc8ccd0, 0.9, 0.25));
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
    L.animated.push((dt, t) => {
      const ph = t * 1.25, th = -0.26 * Math.sin(ph);
      beam.rotation.z = th; crank.rotation.z = ph - PI / 2;
      const pinX = CX + Math.cos(ph) * CR * 0.95, pinY = CY + Math.sin(ph) * CR * 0.95;
      const tx = x + (-3.1) * Math.cos(th) - (-0.15) * Math.sin(th), ty = Y + (-3.1) * Math.sin(th) + (-0.15) * Math.cos(th);
      arms.forEach((m, i) => {
        const sz = i ? 0.62 : -0.62; _a.set(pinX, pinY, z + sz); _b.set(tx, ty, z + sz); _d.subVectors(_b, _a);
        m.position.addVectors(_a, _b).multiplyScalar(0.5); m.scale.set(1, _d.length(), 1); m.quaternion.setFromUnitVectors(UP, _d.normalize());
      });
      const hy = Y + 4.3 * Math.sin(th) + (-1.2) * Math.cos(th), top = Math.max(1.3, hy);
      rod.position.set(x + 4.2, (top + 1.2) / 2, z); rod.scale.set(1, Math.max(0.05, top - 1.2), 1);
    });
  }

  // ------------------------------------------------------------ the tank farm (north-east), the wreck on the east road
  function tanks(rnd) {
    const A = art();
    // the bund: a low concrete wall with a gap for the path and one for the pipeline
    const bw = (x0, z0, x1, z1) => L.box(x0, 0, z0, x1, 0.9, z1, 'concrete', { top: 'concreteDark' });
    bw(12.85, -E, 13.15, -27); bw(12.85, -25, 13.15, -15.85);
    bw(13.15, -16.15, 17, -15.85); bw(19, -16.15, 21.5, -15.85); bw(22.5, -16.15, E, -15.85);
    deco(13.15, 0, -E, E, 0.006, -16.15, 'concreteDark');
    const tank = (x, z, r, h) => {
      L.cyl('greyClean', x, h / 2, z, r, h, 0, 0, false);
      for (let y = 1.6; y < h; y += 1.6) L.cyl('steel', x, y, z, r + 0.03, 0.06, 0, 0, false);
      L.cyl('rust', x, 0.25, z, r + 0.02, 0.5, 0, 0, false);
      K.put('greyClean', K.geo('cone'), x, h + 0.3, z, r * 1.02, 0.6, r * 1.02);
      for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * PI * 2, px = x + Math.cos(a) * r * 0.99, pz = z + Math.sin(a) * r * 0.99; L.pipe('steel', px, h, pz, px, h + 1.05, pz, 0.025); }
      for (let i = 0; i < 16; i++) { const a0 = i / 16 * PI * 2, a1 = (i + 1) / 16 * PI * 2; L.pipe('steel', x + Math.cos(a0) * r, h + 1.05, z + Math.sin(a0) * r, x + Math.cos(a1) * r, h + 1.05, z + Math.sin(a1) * r, 0.03); }
      // rust streaks running down from the roof
      for (let i = 0; i < 10; i++) { const a = rnd() * PI * 2, len = 1 + rnd() * 3; K.put('rust', L.geo('box'), x + Math.cos(a) * (r + 0.005), h - len / 2, z + Math.sin(a) * (r + 0.005), 0.12 + rnd() * 0.2, len, 0.01, -a + PI / 2); }
      W.addCyl(x, z, r, 0, h + 1.1, { surf: 'metal' });
      L.blob(x, z, r * 2 + 1.2, r * 2 + 1.2, 0.006);
      // a label wrapped round the shell, centred on angle a (x = cos a, z = sin a), arc width w
      return (a, y, w, hh, tex) => {
        const th = w / (r + 0.03), g = new THREE.CylinderGeometry(r + 0.03, r + 0.03, hh, 24, 1, true, PI / 2 - a - th / 2, th);
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.8 }));
        m.position.set(x, y, z); m.receiveShadow = true; L.scene.add(m);
      };
    };
    const t1 = tank(20, -25, 4.2, 7.5); t1(PI / 2 + 0.3, 4.6, 3.6, 1.8, A.tank(1, 'CRUDE OIL'));
    const t2 = tank(29, -22, 3, 6); t2(PI / 2 + 0.6, 3.8, 2.8, 1.4, A.tank(2, 'CONDENSATE'));
    // caged ladders (dressing only: nobody climbs these)
    for (const [x, z, r, h, a] of [[20, -25, 4.2, 7.5, PI * 0.8], [29, -22, 3, 6, PI * 0.95]]) {
      const cx = x + Math.cos(a) * (r + 0.25), cz = z + Math.sin(a) * (r + 0.25), tx = -Math.sin(a) * 0.22, tz = Math.cos(a) * 0.22;
      L.pipe('steel', cx - tx, 2.2, cz - tz, cx - tx, h + 1.05, cz - tz, 0.025); L.pipe('steel', cx + tx, 2.2, cz + tz, cx + tx, h + 1.05, cz + tz, 0.025);
      for (let y = 2.4; y < h + 1; y += 0.3) L.pipe('steel', cx - tx, y, cz - tz, cx + tx, y, cz + tz, 0.012);
      for (let y = 3.2; y < h + 1; y += 0.9) K.put('steel', L.geo('torus'), cx + Math.cos(a) * 0.3, y, cz + Math.sin(a) * 0.3, 0.42, 0.42, 0.3, 0, PI / 2);
    }
    // valves and a manifold between the tanks, drums and a pallet stack in the bund
    tube('steel', 24.2, 0.6, -24, 26.2, 0.6, -23, 0.15);
    L.cyl('paintDark', 25.3, 0.6, -23.5, 0.25, 0.35, 0, PI / 2, false); L.pipe('steel', 25.3, 0.85, -23.5, 25.3, 1.25, -23.5, 0.025); handwheel(25.3, 1.27, -23.5, false, 0.2);
    solid(24.2, 0, -24.3, 26.2, 1.3, -22.7, 'metal');
    P('drum', 15, -18); P('drum', 15.7, -17.4, 0.4); P('barrel', 14.6, -17.2); PK.pallets(31.5, -17.8, 3); P('crateSmall', 31.4, -17.8, 0.2, 0.45);
    P('crate', 26, -31.6, 0.1); P('crate', 27.3, -31.5, -0.1); P('crateSmall', 26.6, -31.6, 0.3, 1.2);
    L.pipe('steel', 16.6, 0, -15.6, 16.6, 1.9, -15.6, 0.03); K.plane(A.h2s, 0.8, 0.8, 16.6, 1.55, -15.56, 0, { alpha: true });
    K.plane(A.noSmoke, 0.6, 0.75, 13.15 + 0.02, 0.5, -20.5, PI / 2);
    L.addPickup('ammo', 16, 0, -30);

    // the wreck: a flatbed truck with a load of pipe, parked for good
    const tx0 = 21.6, tz = -8.5;
    L.box(tx0, 0.6, tz - 0.8, tx0 + 7.2, 0.9, tz + 0.8, 'paintDark', { noCol: true });
    L.box(tx0, 0.9, tz - 1.2, tx0 + 4.2, 1.05, tz + 1.2, 'woodDark', { side: 'rust', noCol: true });
    for (const sz of [-1, 1]) deco(tx0, 1.05, tz + sz * 1.2 - 0.05, tx0 + 4.2, 1.35, tz + sz * 1.2 + 0.05, 'rust');
    L.box(tx0 + 4.4, 0.9, tz - 1.1, tx0 + 6.4, 2.9, tz + 1.1, 'rust', { top: 'paintDark', noCol: true });
    for (const sz of [-1, 1]) deco(tx0 + 4.9, 1.9, tz + sz * 1.1 - 0.01, tx0 + 6.1, 2.6, tz + sz * 1.1 + 0.01, 'glassDay');
    deco(tx0 + 6.4, 1.8, tz - 0.95, tx0 + 6.42, 2.65, tz + 0.95, 'glassDay');
    L.box(tx0 + 6.4, 0.9, tz - 0.95, tx0 + 7.6, 2.0, tz + 0.95, 'rust', { noCol: true });
    deco(tx0 + 7.6, 1.0, tz - 0.8, tx0 + 7.66, 1.8, tz + 0.8, 'paintDark'); for (const sz of [-1, 1]) K.sph('glassDay', tx0 + 7.62, 1.6, tz + sz * 0.62, 0.1);
    K.wheels(tx0 + 1.0, tx0 + 3.0, tz - 1.05, tz + 1.05, 0.5, false, 'paintDark'); K.wheels(tx0 + 6.6, tx0 + 6.6, tz - 1.05, tz + 1.05, 0.5, false, 'paintDark');
    for (let i = 0; i < 3; i++) tube('rust', tx0 + 0.1, 1.35 + (i === 1 ? 0.5 : 0), tz - 0.6 + i * 0.6 - (i === 1 ? 0.6 : 0) + (i === 2 ? -0.3 : 0), tx0 + 4.0, 1.35 + (i === 1 ? 0.5 : 0), tz - 0.6 + i * 0.6 - (i === 1 ? 0.6 : 0) + (i === 2 ? -0.3 : 0), 0.3);
    solid(tx0, 0, tz - 1.25, tx0 + 7.7, 1.05, tz + 1.25, 'metal');
    solid(tx0 + 4.4, 1.05, tz - 1.1, tx0 + 6.4, 2.9, tz + 1.1, 'metal'); solid(tx0 + 6.4, 1.05, tz - 0.95, tx0 + 7.6, 2.0, tz + 0.95, 'metal');
    solid(tx0, 1.05, tz - 1.0, tx0 + 4.1, 1.85, tz + 0.8, 'metal');
    L.blob(tx0 + 3.8, tz, 8.6, 3.2);
  }

  // ------------------------------------------------------------ the ridge along the north fence, cover in the yard
  function ridge(rnd) {
    L.box(-12, 0, -E, 12, RIDGE, -27, 'sandGround', { side: 'rock', skip: [4] });
    PK.ramp('z', -27, -22, -12, 12, 0, RIDGE, -1, 'sandGround', 'rock');
    for (const [x, z, s] of [[-12.4, -30, 1.3], [-12.6, -25.5, 0.9]]) { K.put('rock', K.blobGeo(Math.round(z) & 1), x, s * 0.4, z, s * 1.6, s, s * 1.8, x); solid(x - s * 1.2, 0, z - s * 1.3, x + s * 1.2, s * 1.2, z + s * 1.3); }
    // on top: a sandbag nest facing the tower, rocks, a dead generator, drums
    PK.bags(-3, -27.8, 3, -27.8, 2, RIDGE); PK.bags(-3, -27.8, -3, -29.4, 2, RIDGE);
    for (const [x, z, s] of [[-9, -29, 1.1], [8.5, -30.5, 1.3], [5, -28.2, 0.7]]) { K.put('rock', K.blobGeo(Math.abs(x) % 3), x, RIDGE + s * 0.35, z, s * 1.5, s * 0.8, s * 1.2, x); solid(x - s * 1.1, RIDGE, z - s * 0.9, x + s * 1.1, RIDGE + s * 0.9, z + s * 0.9, 'concrete'); }
    P('generator', -6.5, -31.5, 0.3, RIDGE); P('drum', 10.4, -32.6, 0, RIDGE); P('drum', 9.8, -33.2, 0.5, RIDGE);
    L.addPickup('ammo', 0, RIDGE, -31);
  }
  function yard(rnd) {
    const C = (x, z, alongX, color, stack) => PK.container(x, z, alongX, color, stack);
    C(-6, 26, true, 'blue', 1); C(-31, -4, false, 'orange', 2); C(27, 8, false, 'green', 1); C(-20, -17, true, 'red', 1);
    // round the tower: sandbags, jerseys, the light plant, the mud tanks
    PK.bags(-9, -5, -9, 1, 3); PK.bags(-9, -5, -7.6, -5.8, 3);
    PK.jersey(-8, 8, -4, 8); PK.jersey(7, -8.4, 10.6, -8.4);
    PK.flood(-7, -7.5, 6, PI / 4); P('generator', -7.6, -9.2, 0);
    for (let i = 0; i < 2; i++) {
      const z0 = 5 + i * 2.7;
      L.box(7, 0, z0, 11.6, 2.0, z0 + 2.3, 'rust', { top: 'grate' });
      for (let x = 7.4; x < 11.4; x += 0.9) deco(x, 0.05, z0 - 0.03, x + 0.08, 1.95, z0, 'rust');
      deco(7.3, 0.4, z0 + 2.3, 8.4, 1.3, z0 + 2.33, 'paintDark');
    }
    // scrap, spools, crates, tyres, drums dotted round the yard
    scrap(18.5, -2, rnd); scrap(-24, 4, rnd);
    PK.spool(-6.5, 12, 0.8); PK.spool(-9, 12.8, 0.6); PK.spool(18, 12.5, 0.75);
    P('crate', -19, 6); P('crate', -19, 7.25, 0.1); P('crateSmall', -19.05, 6.05, 0.3, 1.2); P('crateSmall', -18.9, 8.4, -0.2);
    P('crate', 7, 21.5, 0.2); P('crateSmall', 8.3, 21.8, -0.3); P('box', 7.1, 21.5, 0.2, 1.2);
    K.tires(-24.5, 11, 3); K.tires(-23.7, 11.6, 2); K.tires(16.5, 5, 3);
    P('drum', 16, 13.5); P('drum', 16.7, 14.1, 0.5); P('barrel', 15.6, 14.4); drumLying(17.2, 15.4, true);
    P('drum', 4.2, -17); P('drum', 4.8, -16.4, 0.3); drumLying(-4.4, -16.6, false);
    PK.pallets(-10.5, 17, 4); PK.pallets(26, -3.5, 2); P('crateSmall', 26, -3.5, 0.2, 0.3);
    PK.bags(-17, -3, -17, 1, 2); PK.bags(24, 1.5, 27.5, 1.5, 3);
    P('drum', -30.6, 10.5); P('drum', -30, 11.2, 0.5); P('crate', -31.8, 20, 0.15);
    P('crate', 31.8, -5.5, 0.1); P('crateSmall', 31.6, -4.2, -0.2); P('drum', 32, -13, 0);
    PK.flood(31.5, 31.5, 7, -PI / 4 - PI / 2); PK.flood(-31.5, -31.5, 7, PI / 4 + PI / 2 + PI);
    // power poles along the west fence
    const poles = [[-32.6, -20], [-32.6, -10.5], [-32.6, 1.5], [-32.6, 13.5]].map(([x, z]) => K.powerPole(x, z, 7.5));
    for (let i = 0; i < poles.length - 1; i++) for (const dx of [-1.05, 0, 1.05]) K.wire([poles[i][0] + dx, poles[i][1], poles[i][2]], [poles[i + 1][0] + dx, poles[i + 1][1], poles[i + 1][2]], 0.5);
    L.addPickup('ammo', -9.5, 0, 14.6); L.addPickup('ammo', 20.5, 0, -2);
  }

  // ------------------------------------------------------------ beyond the fence: dunes, other rigs, a gas flare
  function outside(rnd) {
    for (const b of [[-400, -400, 400, -E - 2], [-400, E + 2, 400, 400], [-400, -E - 2, -E - 2, E + 2], [E + 2, -E - 2, 400, E + 2]]) L.box(b[0], -1, b[1], b[2], 0, b[3], 'sandGround', { ao: false, noCol: true });
    for (let i = 0; i < 70; i++) {
      const a = rnd() * PI * 2, sx = 10 + rnd() * 18, r = 52 + sx * 1.3 + rnd() * 100, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const sy = 2 + rnd() * (r > 80 ? 9 : 4);
      K.put('sandGround', K.blobGeo(i % 3), x, -sy * 0.35, z, sx, sy, sx * (0.6 + rnd() * 0.5), rnd() * 6);
    }
    // the dunes piled against the north fence, behind the ridge
    for (let i = 0; i < 8; i++) K.put('sandGround', K.blobGeo(i % 3), -30 + i * 8.6, 0, -E - 6.2 - rnd() * 2, 7 + rnd() * 3, 3.2 + rnd() * 1.5, 4, rnd());
    for (const [x, z, h] of [[-95, -70, 34], [120, 40, 30], [70, -130, 36], [-140, 90, 28]]) {
      K.latticeTower(x, z, h, 7, 1.6, 'rust'); L.box(x - 4, 0, z - 4, x + 4, 3, z + 4, 'rust', { noCol: true });
    }
    for (const [x, z] of [[82, -64], [-60, 88], [96, 92]]) { L.cyl('greyClean', x, 4, z, 6, 8, 0, 0, false); K.put('greyClean', K.geo('cone'), x, 8.4, z, 6.1, 0.8, 6.1); }
    tube('rust', 40, 0.7, 12, 160, 0.7, 12, 0.5, 8); tube('rust', -22, 0.7, 40, -22, 0.7, 170, 0.5, 8);
    // the flare stack to the north-west, its flame licking in the wind
    const fx = -120, fz = -110, fh = 34;
    L.cyl('rust', fx, fh / 2, fz, 0.8, fh, 0, 0, false);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.pipe('steel', fx, fh * 0.6, fz, fx + dx * 9, 0, fz + dz * 9, 0.06);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.6, 0.5), transparent: true, opacity: 0.9, depthWrite: false }));
    flame.position.set(fx, fh + 2.5, fz); L.scene.add(flame);
    L.animated.push((dt, t) => { const f = 1 + Math.sin(t * 7.3) * 0.12 + Math.sin(t * 13.1) * 0.08; flame.scale.set(1.6 * f, 3.6 * (2 - f), 1.6 * f); flame.position.x = fx + Math.sin(t * 1.7) * 0.4; });
  }

  // ------------------------------------------------------------ build
  MR.build = function () {
    K = CF.MapNuketown.kit; PK = CF.MapPit.kit();
    CF.MapStory.materials();
    const rnd = U.mulberry32(2009);
    ground(rnd);
    fence(rnd);
    tower(rnd);
    pipelines(rnd);
    office(rnd);
    pumpHouse(rnd);
    shed(rnd);
    pumpjack(-14.2, 20.2);
    tanks(rnd);
    ridge(rnd);
    yard(rnd);
    outside(rnd);
    L.killY = -10;

    // spawns: one team round the office in the north-west, the other round the pump house in the south-east
    const t0 = [[-23, 0, -27.5], [-22, 0, -20.5], [-28, 0, -19.8], [-17, 0, -24], [-25.5, OF, -24.2], [-31.5, 0, -14]];
    const t1 = [[21.5, 0, 22.2], [21.5, 0, 17], [27, 0, 16.5], [31.5, 0, 22], [15.5, 0, 30], [25, PHR, 24]];
    L.spawns.t0 = t0; L.spawns.t1 = t1;
    L.spawns.ffa = t0.concat(t1, [[-7, 0, 3], [7.5, 0, -3], [0, RIDGE, -30.5], [-29.8, 0, 29.6], [16, 0, -20], [-11, 0, 23.5], [9, 0, 24.5], [30.5, 0, 1],
      [-28, 0, 3.5], [-1.5, L1, 1.5], [-4, 0, -18.5], [30, 0, -10], [-14, 0, -10.5], [0.5, L2, -1.5]]);
    L.points.start = { x: -22, y: 0, z: -20.5, yaw: -Math.PI * 0.75 };
  };
})(window.CF);
