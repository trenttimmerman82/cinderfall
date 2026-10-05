'use strict';
/* Cinderfall — RETAIL ROW (multiplayer, Battle Royale). A small shopping town in open country, after the Fortnite
   landmark: the Noms supermarket on the west side of the parking lot, a two-storey row of shops with a balcony walk
   along its front and a roof you can reach from the west stair, the RETAIL ROW pylon by the crossroads, a water tower
   with a switchback stair up to its catwalk, the Gas-N-Go across Market Road, two streets of houses with garages, the
   park, a self-storage yard to the north and fields and woods out to the edge. Axes: +X east, +Z south.
   The map lists where floor loot lies (L.points.loot) and where chests stand (L.points.chests) for js/br.js. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const RR = CF.MapRetail = {};
  let K = null; // Nuketown's building kit (js/map-nuketown.js)

  const T = 0.25, G = 0.12;
  const EDGE = 120; // the invisible fence all round
  let LOOT = [], CHESTS = [];
  const loot = (x, y, z) => LOOT.push([x, y, z]);
  const chest = (x, y, z, yaw) => CHESTS.push([x, y, z, yaw || 0]);

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  /** Floor slab whose top is at y (its underside shows as a ceiling from below). */
  const slab = (x0, z0, x1, z1, y, top, m) => L.box(x0, y - 0.25, z0, x1, y, z1, m || 'ceiling', { top, side: 'trim', bottom: true });
  /** Solid staircase. axis 'x' climbs along X over a0..a1 (b = the Z span), 'z' along Z. up = +1 rises toward a1, -1 toward a0. */
  function steps(axis, a0, a1, b0, b1, yBase, yTop, up, m, topM) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, yBase, b0, s1, top, b1, m, { top: topM }); else L.box(b0, yBase, s0, b1, top, s1, m, { top: topM });
    }
  }
  /** Open steel stair: thin treads on two stringers (you can walk under the high end). */
  function openSteps(axis, a0, a1, b0, b1, yBase, yTop, up, m) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, top - 0.08, b0, s1, top, b1, m, { ao: false }); else L.box(b0, top - 0.08, s0, b1, top, s1, m, { ao: false });
    }
    const lo = up > 0 ? a0 : a1, hi = up > 0 ? a1 : a0;
    for (const b of [b0 + 0.04, b1 - 0.04]) {
      if (axis === 'x') L.pipe(m, lo, yBase, b, hi, yTop - rise, b, 0.06); else L.pipe(m, b, yBase, lo, b, yTop - rise, hi, 0.06);
    }
  }
  /** Steel handrail along X or Z at height y (stops people, not bullets). */
  function rail(axis, a0, a1, c, y, m) {
    m = m || 'steel';
    if (axis === 'x') { L.pipe(m, a0, y + 1.0, c, a1, y + 1.0, c, 0.035); L.pipe(m, a0, y + 0.5, c, a1, y + 0.5, c, 0.025); for (let a = a0; a <= a1 + 0.01; a += 1.5) L.pipe(m, a, y, c, a, y + 1.0, c, 0.03); W.add(a0, y, c - 0.06, a1, y + 1.05, c + 0.06, { shoot: false }); }
    else { L.pipe(m, c, y + 1.0, a0, c, y + 1.0, a1, 0.035); L.pipe(m, c, y + 0.5, a0, c, y + 0.5, a1, 0.025); for (let a = a0; a <= a1 + 0.01; a += 1.5) L.pipe(m, c, y, a, c, y + 1.0, a, 0.03); W.add(c - 0.06, y, a0, c + 0.06, y + 1.05, a1, { shoot: false }); }
  }
  /** Shop window: a pane you can't walk through but can shoot through. */
  const glass = (x0, y0, z0, x1, y1, z1) => L.box(x0, y0, z0, x1, y1, z1, 'glassClear', { shoot: false, ao: false });
  /** Shelving run with stock on it (axis: the long side). */
  function shelfRun(x0, z0, x1, z1, h, rnd, stock) {
    L.box(x0, 0, z0, x1, 0.12, z1, 'paintDark', { noCol: true });
    const alongX = x1 - x0 > z1 - z0, n = 4;
    for (let i = 0; i < n; i++) {
      const y = 0.15 + i * (h - 0.2) / (n - 1);
      deco(x0, y, z0, x1, y + 0.04, z1, 'paintGrey');
      if (i === n - 1) break;
      const len = alongX ? x1 - x0 : z1 - z0;
      for (let a = 0.1; a < len - 0.3;) {
        const w = Math.min(0.25 + rnd() * 0.45, len - a - 0.08), hh = Math.min(0.2 + rnd() * 0.32, (h - 0.2) / (n - 1) - 0.06), m = stock[(rnd() * stock.length) | 0];
        if (alongX) deco(x0 + a, y + 0.04, z0 + 0.08, x0 + a + w, y + 0.04 + hh, z1 - 0.08, m);
        else deco(x0 + 0.08, y + 0.04, z0 + a, x1 - 0.08, y + 0.04 + hh, z0 + a + w, m);
        a += w + 0.04 + rnd() * 0.12;
      }
    }
    deco(alongX ? x0 : (x0 + x1) / 2 - 0.03, 0, alongX ? (z0 + z1) / 2 - 0.03 : z0, alongX ? x1 : (x0 + x1) / 2 + 0.03, h, alongX ? (z0 + z1) / 2 + 0.03 : z1, 'paintGrey');
    solid(x0, 0, z0, x1, h, z1, 'metal');
  }
  function counter(x0, z0, x1, z1, m, top) { L.box(x0, 0, z0, x1, 1.0, z1, m || 'cabinet', { top: top || 'counter' }); }
  function lampPost(x, z, h) {
    L.cyl('paintGrey', x, h / 2, z, 0.1, h, 0, 0, true);
    for (const s of [-1, 1]) { deco(x + s * 0.2, h - 0.08, z - 0.06, x + s * 1.1, h, z + 0.06, 'paintGrey'); deco(x + s * 0.7, h - 0.22, z - 0.25, x + s * 1.25, h - 0.08, z + 0.25, 'paintGrey'); deco(x + s * 0.72, h - 0.25, z - 0.22, x + s * 1.22, h - 0.22, z + 0.22, 'lampWarm'); }
    solid(x - 0.14, 0, z - 0.14, x + 0.14, h, z + 0.14, 'metal');
  }
  /** Leafy tree with a solid trunk (no invisible cap over the crown: in Battle Royale people glide down onto the map). */
  function oak(x, z, h, r, rnd) {
    K.put('bark', K.geo('trunk'), x, h / 2, z, 0.28, h, 0.28);
    for (let i = 0; i < 2; i++) { const a = rnd() * 6.28; L.pipe('bark', x, h * 0.7, z, x + Math.cos(a) * r * 0.6, h + r * 0.15, z + Math.sin(a) * r * 0.6, 0.1); }
    solid(x - 0.3, 0, z - 0.3, x + 0.3, h + r * 0.4, z + 0.3);
    const n = 4 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = i ? r * (0.35 + rnd() * 0.45) : 0, s = r * (i ? 0.55 + rnd() * 0.3 : 0.85);
      K.put(rnd() < 0.4 ? 'leaves2' : 'leaves', K.blobGeo(i % 3), x + Math.cos(a) * d, h + r * 0.35 + (rnd() - 0.4) * r * 0.6, z + Math.sin(a) * d, s, s * 0.9, s, rnd() * 6);
    }
  }
  function fir(x, z, h) {
    K.put('bark', K.geo('trunk'), x, h * 0.15, z, 0.24, h * 0.3, 0.24);
    for (let i = 0; i < 3; i++) K.put('pine', K.geo('cone'), x, h * (0.36 + i * 0.21), z, h * (0.24 - i * 0.055), h * 0.36, h * (0.24 - i * 0.055), i);
    solid(x - 0.3, 0, z - 0.3, x + 0.3, h * 0.5, z + 0.3);
  }
  function rock(x, z, s, i) { K.put('rock', K.blobGeo(i % 3), x, s * 0.3, z, s * 1.3, s * 0.8, s, i); solid(x - s * 1.1, 0, z - s * 0.85, x + s * 1.1, s * 0.85, z + s * 0.85); }
  /** Box truck: cab and a cargo box you can stand on. */
  function boxTruck(x, z, alongX, paint) {
    const sx = alongX ? 1 : 0, sz = alongX ? 0 : 1, ex = (a, b) => [x + a * sx + b * sz, z + a * sz + b * sx];
    const box = (a0, a1, b0, b1, y0, y1, m, o) => { const p = ex(a0, b0), q = ex(a1, b1); L.box(p[0], y0, p[1], q[0], y1, q[1], m, o); };
    box(-3.6, 2.0, -1.25, 1.25, 1.0, 4.0, 'trailerWhite');
    box(2.1, 3.9, -1.15, 1.15, 0.6, 2.6, paint);
    box(3.0, 3.92, -1.0, 1.0, 1.7, 2.45, 'glassDay', { noCol: true });
    box(-3.6, 3.9, -1.0, 1.0, 0.45, 1.0, 'paintDark', { noCol: true });
    K.wheels(...(alongX ? [x - 2.4, x + 2.9, z - 1.15, z + 1.15] : [x - 1.15, x + 1.15, z - 2.4, z + 2.9]), 0.5, !alongX);
    const p = ex(-3.6, -1.25), q = ex(3.9, 1.25); solid(p[0], 0, p[1], q[0], 1.0, q[1], 'metal');
  }
  /** Shopping cart (a wire basket on wheels). */
  function cart(x, z, ry) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (a, b) => [x + a * c + b * s, z - a * s + b * c];
    for (const [a, b] of [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]]) { const p = P(a, b); L.cyl('rubber', p[0], 0.08, p[1], 0.07, 0.06, Math.PI / 2, 0, true); L.pipe('chrome', p[0], 0.1, p[1], p[0], 0.55, p[1], 0.02); }
    const q = P(0, 0); L.addGeo('chrome', L.geo('box'), L.mat4(q[0], 0.8, q[1], 0, ry, 0, 0.62, 0.45, 0.95));
    const h0 = P(-0.3, 0.55), h1 = P(0.3, 0.55); L.pipe('paintRed', h0[0], 1.05, h0[1], h1[0], 1.05, h1[1], 0.025);
    solid(x - 0.45, 0, z - 0.45, x + 0.45, 1.05, z + 0.45, 'metal');
  }
  function dumpster(x, z, alongX) {
    const hx = alongX ? 1.0 : 0.75, hz = alongX ? 0.75 : 1.0;
    L.box(x - hx, 0.15, z - hz, x + hx, 1.35, z + hz, 'paintGreen');
    deco(x - hx - 0.03, 1.35, z - hz - 0.03, x + hx + 0.03, 1.42, z + hz + 0.03, 'paintDark');
    CF.PH.mark('crate', x, 0, z);
  }

  // ------------------------------------------------------------ signs (canvas art)
  const ART = {};
  function sign(w, h, draw) { return K.canvasTex(w, h, draw); }
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    ART.noms = sign(1024, 256, (x, w, h) => {
      x.fillStyle = '#f6efe2'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#e8402a'; x.fillRect(10, 10, w - 20, h - 20);
      x.fillStyle = '#ffd23a'; x.font = '900 190px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 16; x.strokeStyle = '#7a1c12'; x.strokeText('NOMS', w / 2, h / 2 + 10); x.fillText('NOMS', w / 2, h / 2 + 10);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(w * 0.88, h * 0.3, 34, 0, 6.3); x.fill(); x.fillStyle = '#4fae3a'; x.fillRect(w * 0.88 - 4, h * 0.3 - 54, 8, 26);
    });
    ART.nomsSub = sign(1024, 96, (x, w, h) => { x.fillStyle = '#2d5a8c'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 56px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('FRESH · FAST · FRIENDLY', w / 2, 68); });
    const shop = (text, sub, bg, fg, font) => sign(1024, 160, (x, w, h) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
      x.fillStyle = fg; x.textAlign = 'center'; x.font = font || 'bold 92px Georgia, serif'; x.fillText(text, w / 2, sub ? 96 : 112);
      if (sub) { x.font = 'bold 32px Arial, sans-serif'; x.fillText(sub, w / 2, 140); }
    });
    ART.sports = shop('RUCKUS SPORTS', 'BIKES · BALLS · BOATS', '#1f5fa8', '#ffffff', '900 84px "Arial Black", Arial, sans-serif');
    ART.sofa = shop('Sofa Kingdom', 'COMFORT FIT FOR A KING', '#6b2a6e', '#ffd75a', 'italic bold 96px Georgia, serif');
    ART.toys = shop('TOY BARN', 'GAMES · LLAMAS · PLUSH', '#f2b81e', '#c8262e', '900 98px "Arial Black", Arial, sans-serif');
    ART.cafe = shop('Bean There', 'COFFEE & PASTRY', '#3b2a20', '#f3e2c4', 'italic bold 100px Georgia, serif');
    ART.hardware = shop('HAMMER & CO.', 'HARDWARE · PAINT · LUMBER', '#c2421f', '#ffffff', 'bold 88px Arial, sans-serif');
    ART.gas = sign(1024, 128, (x, w, h) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#d42a24'; x.fillRect(0, h * 0.72, w, h * 0.28);
      x.fillStyle = '#123f8a'; x.font = '900 86px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.fillText('GAS-N-GO', w / 2, 82);
    });
    ART.price = sign(256, 384, (x, w, h) => {
      x.fillStyle = '#123f8a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '900 46px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.fillText('GAS-N-GO', w / 2, 60);
      x.fillStyle = '#111'; for (let i = 0; i < 3; i++) x.fillRect(20, 90 + i * 96, w - 40, 78);
      x.fillStyle = '#ffcf3a'; x.font = 'bold 54px monospace'; ['3.19', '3.49', '3.79'].forEach((p, i) => x.fillText(p, w / 2 + 20, 148 + i * 96));
      x.fillStyle = '#9fb0c8'; x.font = 'bold 18px Arial'; x.textAlign = 'left'; ['REG', 'PLUS', 'PREM'].forEach((p, i) => x.fillText(p, 26, 108 + i * 96));
    });
    ART.pylon = sign(512, 640, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a6fd0'); g.addColorStop(1, '#173e86'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ffd23a'; x.lineWidth = 14; x.strokeRect(14, 14, w - 28, h - 28);
      x.fillStyle = '#ffd23a'; x.textAlign = 'center'; x.font = '900 88px "Arial Black", Arial, sans-serif'; x.fillText('RETAIL', w / 2, 140); x.fillText('ROW', w / 2, 256);
      const rows = [['NOMS', '#e8402a'], ['RUCKUS SPORTS', '#ffffff'], ['SOFA KINGDOM', '#e6b3ff'], ['TOY BARN', '#ffd23a'], ['BEAN THERE', '#f3e2c4'], ['HAMMER & CO.', '#ff9a6a']];
      x.font = 'bold 42px Arial, sans-serif'; rows.forEach(([t, c], i) => { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(40, 312 + i * 52, w - 80, 44); x.fillStyle = c; x.fillText(t, w / 2, 348 + i * 52); });
    });
    ART.tower = sign(2048, 150, (x, w, h) => { // wraps round the tank twice (its band is about 14 times as wide as it is tall)
      x.fillStyle = '#8fc6e8'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.font = '900 100px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 10; x.strokeStyle = '#2a5f8a'; for (const cx of [w * 0.25, w * 0.75]) { x.strokeText('RETAIL ROW', cx, h / 2 + 6); x.fillText('RETAIL ROW', cx, h / 2 + 6); }
    });
    ART.storage = sign(1024, 160, (x, w, h) => { x.fillStyle = '#f2a516'; x.fillRect(0, 0, w, h); x.fillStyle = '#222'; x.font = '900 86px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.fillText('STOR-IT  SELF STORAGE', w / 2, 112); });
    ART.court = sign(512, 512, (x, w, h) => {
      x.fillStyle = '#3f7d5c'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8603a'; x.fillRect(24, 24, w - 48, h - 48);
      x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(24, 24, w - 48, h - 48); x.beginPath(); x.moveTo(24, h / 2); x.lineTo(w - 24, h / 2); x.stroke();
      x.beginPath(); x.arc(w / 2, h / 2, 50, 0, 6.3); x.stroke();
      for (const y of [24, h - 24]) { x.beginPath(); x.arc(w / 2, y, 150, y < h / 2 ? 0 : Math.PI, y < h / 2 ? Math.PI : Math.PI * 2); x.stroke(); x.strokeRect(w / 2 - 60, y < h / 2 ? 24 : h - 24 - 140, 120, 140); }
    });
    return ART;
  }
  /** Paint lying flat on the ground (the basketball court). */
  function flat(tex, w, h, x, y, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; L.scene.add(m);
  }
  /** A flat sign on a wall. ry: which way it faces (0 = +Z/south, PI/2 = +X/east, -PI/2 = -X/west, PI = -Z/north). */
  function wallSign(tex, w, h, x, y, z, ry) {
    const nx = Math.sin(ry), nz = Math.cos(ry), ax = Math.abs(nx) > 0.5;
    if (ax) deco(x - 0.04 * Math.sign(nx), y - h / 2 - 0.08, z - w / 2 - 0.08, x + 0.02 * Math.sign(nx), y + h / 2 + 0.08, z + w / 2 + 0.08, 'paintDark');
    else deco(x - w / 2 - 0.08, y - h / 2 - 0.08, z - 0.04 * Math.sign(nz), x + w / 2 + 0.08, y + h / 2 + 0.08, z + 0.02 * Math.sign(nz), 'paintDark');
    K.plane(tex, w, h, x + nx * 0.035, y, z + nz * 0.035, ry);
  }

  // ------------------------------------------------------------ the row of shops (north side of the lot)
  const MX0 = -38, MX1 = 34, MZF = -20, MZB = -36; // footprint; the front faces south
  const MF1 = 3.6, MF = 3.9, MH2 = 7.0, MR = 7.3;   // shop ceiling, upper floor, upper ceiling, roof
  function shops(rnd) {
    const U5 = [MX0, -23.6, -9.2, 5.2, 19.6, MX1];
    const OUT = [[0, 0.7, 'brick'], [0.7, MF, 'rrFacade'], [MF, MR + 1.0, 'rrUpper']], IN = [[0, MF1, 'plaster'], [MF1, MR, 'wallClean']];
    // floors: each shop its own
    const floors = ['terrazzo', 'floorWood', 'checker', 'floorWood', 'concrete'];
    for (let i = 0; i < 5; i++) L.box(U5[i], 0, MZB, U5[i + 1], G, MZF, floors[i], { ao: false });
    // front: storefront glass and double doors downstairs, an office door and window per unit upstairs
    const front = [];
    for (let i = 0; i < 5; i++) {
      const a = U5[i];
      front.push([a + 1.0, a + 5.4, 0.7, 2.7], [a + 5.6, a + 7.8, G, 2.6], [a + 8.0, a + 13.4, 0.7, 2.7]);
      front.push([a + 2.0, a + 3.3, MF, MF + 2.3], [a + 5.0, a + 12.4, MF + 0.9, MF + 2.4]);
      glass(a + 1.0, 0.7, MZF - 0.05, a + 5.4, 2.7, MZF + 0.05); glass(a + 8.0, 0.7, MZF - 0.05, a + 13.4, 2.7, MZF + 0.05);
      glass(a + 5.0, MF + 0.9, MZF - 0.05, a + 12.4, MF + 2.4, MZF + 0.05);
      for (const x of [a + 3.2, a + 10.7]) deco(x - 0.05, 0.7, MZF - 0.08, x + 0.05, 2.7, MZF + 0.08, 'paintDark');
    }
    K.wall('x', MX0, MX1, MZF, 0, MR, front, OUT, IN, 1, { noLeaf: true });
    // back: a door per shop to the alley, small windows upstairs
    const back = [];
    for (let i = 0; i < 5; i++) { const a = U5[i]; back.push([a + 11.0, a + 12.3, G, 2.4], [a + 3, a + 5, MF + 1.0, MF + 2.2], [a + 9, a + 11, MF + 1.0, MF + 2.2]); }
    K.wall('x', MX0, MX1, MZB, 0, MR, back, [[0, 0.7, 'brick'], [0.7, MR + 1.0, 'rrBack']], IN, -1, { noLeaf: true });
    K.wall('z', MZB, MZF, MX0, 0, MR, [[MZB + 6, MZB + 9, MF + 1.0, MF + 2.3]], [[0, 0.7, 'brick'], [0.7, MR + 1.0, 'rrBack']], IN, -1);
    K.wall('z', MZB, MZF, MX1, 0, MR, [[MZB + 6, MZB + 9, MF + 1.0, MF + 2.3], [MZB + 3, MZB + 4.3, G, 2.4]], [[0, 0.7, 'brick'], [0.7, MR + 1.0, 'rrBack']], IN, 1, { noLeaf: true });
    // party walls: separate shops downstairs (the back corridor links 2-3 and 4-5), offices linked upstairs
    for (let i = 1; i < 5; i++) {
      const x = U5[i], holes = [[MZB + 2.0, MZB + 3.4, MF, MF + 2.3]];
      if (i === 2 || i === 4) holes.push([MZB + 1.6, MZB + 3.2, G, 2.4]);
      K.wall('z', MZB, MZF, x, 0, MR, holes, null, IN, 0);
    }
    // upper floor (the Toy Barn has the inside stair), roof
    const sx0 = -8.6, sx1 = -2.6, sz0 = MZB + 0.15, sz1 = MZB + 1.6;
    steps('x', sx0, sx1, sz0, sz1, G, MF, 1, 'woodDark', 'carpet');
    slab(MX0, sz1, MX1, MZF, MF, 'carpetBlue'); slab(MX0, MZB, sx0, sz1, MF, 'carpetBlue'); slab(sx1, MZB, MX1, sz1, MF, 'carpetBlue');
    rail('x', sx0, sx1 - 1.8, sz1 + 0.05, MF); rail('z', MZB + 0.15, sz1, sx0 - 0.05, MF);
    slab(MX0 - 0.15, MZB - 0.15, MX1 + 0.15, MZF + 0.15, MR, 'rrRoof', 'ceiling');
    // parapet, with a gap where the roof stair arrives at the west end
    const par = (x0, z0, x1, z1) => L.box(x0, MR, z0, x1, MR + 0.95, z1, 'rrUpper', { top: 'concrete' });
    par(MX0 - 0.15, MZF - 0.15, MX1 + 0.15, MZF + 0.15); par(MX0 - 0.15, MZB - 0.15, MX1 + 0.15, MZB + 0.15);
    par(MX1 - 0.15, MZB, MX1 + 0.15, MZF); par(MX0 - 0.15, MZB, MX0 + 0.15, -30.2); par(MX0 - 0.15, -27.8, MX0 + 0.15, MZF);
    // the balcony walk along the front, its posts and rail; open steel stairs up at both ends
    L.box(MX0 - 3, MF - 0.25, MZF, MX1 + 3, MF, MZF + 2.6, 'concrete', { bottom: true, side: 'trim' });
    for (let x = MX0; x <= MX1 + 0.01; x += 7.2) { L.cyl('paintDark', x, MF / 2, MZF + 2.4, 0.11, MF, 0, 0, true); solid(x - 0.12, 0, MZF + 2.28, x + 0.12, MF, MZF + 2.52, 'metal'); }
    rail('x', MX0, MX1, MZF + 2.55, MF, 'paintDark');
    rail('z', MZF + 0.2, MZF + 2.6, MX0 - 3, MF, 'paintDark'); rail('z', MZF + 0.2, MZF + 2.6, MX1 + 3, MF, 'paintDark');
    openSteps('z', MZF + 2.6, -11.2, MX0 - 2.8, MX0 - 0.6, 0, MF, -1, 'paintDark');
    openSteps('z', MZF + 2.6, -11.2, MX1 + 0.6, MX1 + 2.8, 0, MF, -1, 'paintDark');
    // roof stair: from the west end of the balcony, north along the end wall
    L.box(MX0 - 3, MF - 0.25, MZF - 0.6, MX0 - 0.15, MF, MZF, 'concrete', { bottom: true });
    openSteps('z', -27.8, MZF - 0.6, MX0 - 2.6, MX0 - 0.4, MF, MR, -1, 'paintDark');
    L.box(MX0 - 2.8, MR - 0.2, -30.2, MX0 - 0.15, MR, -27.8, 'grate', { bottom: true });
    rail('z', -30.2, -27.8, MX0 - 2.9, MR, 'paintDark');
    // roof: AC units, vents, a skylight per shop
    const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
    for (let i = 0; i < 5; i++) { const a = U5[i]; P('ac', a + 4, MZB + 4, 0, MR); P('vent', a + 11, MZB + 3, 0, MR); deco(a + 6, MR, MZB + 8, a + 9, MR + 0.35, MZB + 11, 'glassDay'); solid(a + 6, MR, MZB + 8, a + 9, MR + 0.35, MZB + 11, 'metal'); }
    loot(-30, MR, -26); loot(10, MR, -31); chest(26, MR, -26, Math.PI);
    // shop signs, under the balcony
    const S = art(), signs = [S.sports, S.sofa, S.toys, S.cafe, S.hardware];
    for (let i = 0; i < 5; i++) wallSign(signs[i], 5.4, 0.84, U5[i] + 6.7, 3.18, MZF + 0.16, 0);

    // ---- 1 · Ruckus Sports: racks of balls, bikes, a kayak, the gun counter
    {
      const a = U5[0], balls = ['paintRed', 'paintTaxi', 'paintBlue', 'appliance', 'rrOrange'];
      for (const z of [MZB + 4, MZB + 8]) shelfRun(a + 1.5, z, a + 8.5, z + 1, 1.8, rnd, ['rrOrange', 'paintBlue', 'paintRed', 'appliance', 'paintTaxi']);
      L.box(a + 0.3, 0, MZB + 0.4, a + 9, 2.2, MZB + 1.2, 'woodDark', { top: 'woodDark' });
      for (let i = 0; i < 9; i++) K.sph(balls[i % balls.length], a + 1.2 + i * 0.85, 2.45, MZB + 0.8, 0.22);
      counter(a + 10.5, MZB + 6, a + 11.5, MZB + 13);
      K.put('paintTaxi', L.geo('sphere'), a + 12.6, 0.45, MZF - 3, 0.35, 0.22, 2.0); // kayak on the floor
      for (const x of [a + 2, a + 4.5]) { L.cyl('rubber', x, 0.35, MZF - 2.2, 0.34, 0.05, Math.PI / 2, 0, true); L.cyl('rubber', x + 1.1, 0.35, MZF - 2.2, 0.34, 0.05, Math.PI / 2, 0, true); L.pipe('paintRed', x, 0.4, MZF - 2.2, x + 1.1, 0.8, MZF - 2.2, 0.035); }
      loot(a + 5, G, MZB + 6); loot(a + 12, G, MZB + 3); loot(a + 6, G, MZF - 2.5);
      loot(a + 4, MF, MZB + 4); loot(a + 10, MF, MZF - 3);
    }
    // ---- 2 · Sofa Kingdom: sofas and rugs everywhere
    {
      const a = U5[1];
      for (const [x, z, b] of [[a + 1, MZF - 5, 'z+'], [a + 6, MZF - 5, 'z+'], [a + 1, MZB + 5, 'z-'], [a + 6, MZB + 5, 'z-'], [a + 10.5, MZB + 9, 'x+']]) {
        if (b === 'x+') K.couch(x, z, x + 1, z + 2.4, b); else K.couch(x, z, x + 2.4, z + 1, b);
        deco(x - 0.4, G, z + (b === 'z-' ? 1.2 : -1.8), x + 2.8, G + 0.02, z + (b === 'z-' ? 3 : -0.2), 'rug');
      }
      counter(a + 11, MZB + 1, a + 13.8, MZB + 2);
      loot(a + 4, G, MZB + 8.5); loot(a + 9, G, MZF - 3); chest(a + 12.6, G, MZB + 3.2, Math.PI);
      loot(a + 7, MF, MZB + 5);
    }
    // ---- 3 · Toy Barn: aisles of boxed toys, a giant plush llama, the stair up
    {
      const a = U5[2];
      for (const z of [MZB + 4.5, MZB + 8.5]) shelfRun(a + 1.2, z, a + 9, z + 1, 1.9, rnd, ['rrPurple', 'paintTaxi', 'paintBlue', 'paintRed', 'paintMint']);
      const lx = a + 11.5, lz = MZF - 3; // the llama
      K.sph('rrPurple', lx, 1.2, lz, 0.7, 0.55, 0.95); for (const [dx, dz] of [[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]]) L.cyl('rrPurple', lx + dx, 0.4, lz + dz, 0.13, 0.8, 0, 0, true);
      L.cyl('rrPurple', lx, 1.9, lz - 0.75, 0.2, 1.1, 0.35, 0, true); K.sph('rrPurple', lx, 2.5, lz - 1.0, 0.28, 0.25, 0.38); K.sph('paintTaxi', lx, 1.75, lz, 0.72, 0.1, 0.8);
      solid(lx - 0.8, 0, lz - 1.3, lx + 0.8, 2.7, lz + 1, 'concrete'); CF.PH.place('boxStack', lx + 1.6, G, lz, 0.3);
      counter(a + 10.6, MZB + 2.5, a + 13.8, MZB + 3.5);
      loot(a + 5, G, MZB + 7.5); loot(a + 4, G, MZF - 2.5); loot(a + 12.5, G, MZB + 5);
      loot(a + 8, MF, MZB + 5); chest(a + 12.8, MF, MZF - 2, Math.PI);
    }
    // ---- 4 · Bean There: the counter, the espresso machine, tables
    {
      const a = U5[3];
      counter(a + 1, MZB + 3, a + 9, MZB + 4.1, 'woodDark', 'counter');
      L.box(a + 2, 1.0, MZB + 3.2, a + 3.2, 1.6, MZB + 3.9, 'chrome', { noCol: true }); L.box(a + 6, 1.0, MZB + 3.3, a + 7.6, 1.35, MZB + 3.9, 'glassDay', { noCol: true });
      deco(a + 1, 2.6, MZB + 0.2, a + 9, 3.3, MZB + 0.3, 'paintDark');
      for (const [x, z] of [[a + 3, MZF - 3], [a + 7, MZF - 3], [a + 11, MZF - 3], [a + 11, MZB + 8], [a + 7, MZB + 8]]) { K.table(x - 0.5, z - 0.5, x + 0.5, z + 0.5, G); K.chair(x - 0.9, z, G); K.chair(x + 0.9, z, G); }
      loot(a + 5, G, MZB + 6.5); loot(a + 12.5, G, MZB + 2.5);
      loot(a + 4, MF, MZB + 6); loot(a + 11, MF, MZB + 3);
    }
    // ---- 5 · Hammer & Co.: shelves, paint cans, a lumber rack
    {
      const a = U5[4];
      for (const z of [MZB + 4, MZB + 8]) shelfRun(a + 1.5, z, a + 9, z + 1, 2.0, rnd, ['paintRed', 'paintGrey', 'paintTaxi', 'paintGreen', 'cardboard']);
      for (let i = 0; i < 12; i++) L.cyl(['paintRed', 'paintBlue', 'appliance', 'paintMint'][i % 4], a + 10.5 + (i % 4) * 0.42, G + 0.18 + ((i / 4) | 0) * 0.37, MZF - 2.4, 0.17, 0.35, 0, 0, true);
      solid(a + 10.2, 0, MZF - 2.7, a + 12.2, 1.2, MZF - 2.1);
      for (let i = 0; i < 6; i++) deco(a + 10.3, 0.3 + i * 0.14, MZB + 0.4, a + 13.8, 0.42 + i * 0.14, MZB + 1.6, 'wood');
      solid(a + 10.3, 0, MZB + 0.4, a + 13.8, 1.2, MZB + 1.6);
      loot(a + 5, G, MZB + 6.5); loot(a + 5, G, MZF - 2.5); loot(a + 12, G, MZB + 6);
      loot(a + 6, MF, MZB + 6); chest(a + 2, MF, MZF - 2, 0);
    }
    // upstairs offices: desks, boxes, a cot
    for (let i = 0; i < 5; i++) {
      const a = U5[i];
      K.table(a + 9, MZB + 3, a + 11, MZB + 4, MF); K.chair(a + 10, MZB + 4.6, MF);
      CF.PH.place(i % 2 ? 'boxStack' : 'box', a + 12, MF, MZB + 1.4, 0.3);
      L.box(a + 8, MF, MZF - 2.4, a + 10, MF + 0.5, MZF - 0.6, 'bedspread');
      K.roomLight(a + 7, MH2, MZB + 8); K.roomLight(a + 7, MF1, MZB + 8);
    }
    // the alley behind: dumpsters, pallets, a box truck at the loading door
    dumpster(-30, MZB - 2.2, true); dumpster(-2, MZB - 2.2, true); dumpster(23, MZB - 2.2, true);
    boxTruck(8, -41, true, 'paintBlue');
    CF.PH.place('crate', -16, 0, MZB - 2, 0.2); CF.PH.place('crateSmall', -14.8, 0, MZB - 2.4, 0.5); CF.PH.place('drum', 31, 0, MZB - 2);
    loot(-22, 0.05, MZB - 3); loot(14, 0.05, MZB - 5);
  }

  // ------------------------------------------------------------ Noms (west side of the lot, faces east)
  const NX0 = -88, NX1 = -46, NZ0 = -42, NZ1 = 6, NH = 7.6;
  function noms(rnd) {
    const OUT = [[0, 0.9, 'brick'], [0.9, NH + 1.2, 'rrNoms']], IN = [[0, 1.0, 'paintGrey'], [1.0, NH, 'wallClean']];
    L.box(NX0, 0, NZ0, NX1, G, NZ1, 'terrazzo', { ao: false });
    K.wall('z', NZ0, NZ1, NX1, 0, NH, [[-38, -25.6, 0.8, 3.4], [-22, -16, G, 3.0], [-12.4, 2, 0.8, 3.4]], OUT, IN, 1, { noLeaf: true });
    glass(NX1 - 0.05, 0.8, -38, NX1 + 0.05, 3.4, -25.6); glass(NX1 - 0.05, 0.8, -12.4, NX1 + 0.05, 3.4, 2);
    deco(NX1 + 0.15, 3.0, -22.2, NX1 + 0.35, 3.25, -15.8, 'chrome');
    K.wall('z', NZ0, NZ1, NX0, 0, NH, [[-31, -26.5, G, 3.8], [-6, -4.8, G, 2.4]], OUT, IN, -1, { noLeaf: true });
    K.wall('x', NX0, NX1, NZ0, 0, NH, [[-60, -58.6, G, 2.4]], OUT, IN, -1);
    K.wall('x', NX0, NX1, NZ1, 0, NH, [[-70, -68.8, G, 2.4]], OUT, IN, 1);
    slab(NX0 - 0.15, NZ0 - 0.15, NX1 + 0.15, NZ1 + 0.15, NH + 0.25, 'rrRoof', 'ceilTile');
    const par = (x0, z0, x1, z1) => L.box(x0, NH + 0.25, z0, x1, NH + 1.2, z1, 'rrNoms', { top: 'concrete' });
    par(NX0 - 0.15, NZ1 - 0.15, NX1 + 0.15, NZ1 + 0.15); par(NX0 - 0.15, NZ0, NX0 + 0.15, NZ1); par(NX1 - 0.15, NZ0, NX1 + 0.15, NZ1);
    par(NX0 - 0.15, NZ0 - 0.15, -66, NZ0 + 0.15); par(-62, NZ0 - 0.15, NX1 + 0.15, NZ0 + 0.15);
    // the big sign over the doors, and its tower
    L.box(NX1 - 0.2, NH, -27, NX1 + 0.6, NH + 4.4, -11, 'rrNoms', { top: 'concrete' });
    wallSign(art().noms, 15, 3.6, NX1 + 0.62, NH + 2.2, -19, Math.PI / 2);
    wallSign(art().nomsSub, 12, 1.1, NX1 + 0.16, 4.2, -19, Math.PI / 2);
    // storeroom at the back
    K.wall('z', NZ0, NZ1, -78, 0, NH, [[-36, -33, G, 2.6], [-8, -5, G, 2.6]], null, IN, 0, { noLeaf: true });
    for (const [x, z] of [[-86, -40], [-86, -38.6], [-84.6, -40], [-86, 2], [-84.6, 3.6], [-81, -2]]) CF.PH.place('crate', x, 0, z, rnd() * 0.4);
    for (const [x, z] of [[-82, -20], [-82.5, -12]]) CF.PH.place('boxStack', x, 0, z, rnd());
    loot(-83, G, -30); loot(-83, G, -8); chest(-86.6, G, -18, Math.PI / 2);
    // freezer cases along the storeroom wall
    for (const [z0, z1] of [[-31.5, -9.5], [-3.5, 4.5]]) {
      L.box(-77.85, 0, z0, -76.6, 2.2, z1, 'appliance');
      deco(-76.62, 0.4, z0 + 0.1, -76.56, 1.9, z1 - 0.1, 'windowCool');
      for (let z = z0 + 1.4; z < z1; z += 1.4) deco(-76.6, 0.4, z - 0.03, -76.52, 1.9, z + 0.03, 'chrome');
    }
    for (const [z0, z1] of [[-41.8, -37.5]]) { L.box(-77.85, 0, z0, -76.6, 2.2, z1, 'appliance'); deco(-76.62, 0.4, z0 + 0.1, -76.56, 1.9, z1 - 0.1, 'windowCool'); }
    // aisles, north and south of the centre lane
    const stock = ['paintRed', 'paintTaxi', 'paintMint', 'paintBlue', 'appliance', 'cardboard', 'rrOrange', 'rrPurple'];
    for (const z of [-39.5, -35, -30.5, -9.5, -5, -0.5]) shelfRun(-72, z, -59, z + 1.1, 2.0, rnd, stock);
    // produce stands by the door and checkouts
    for (const [x, z] of [[-55, -10], [-55, -5], [-55, 0]]) {
      L.box(x - 1.4, 0, z - 0.8, x + 1.4, 0.85, z + 0.8, 'wood', { top: 'woodDark' });
      for (let i = 0; i < 10; i++) K.sph(['paintRed', 'paintTaxi', 'leaves', 'rrOrange'][(i + z) & 3], x - 1.1 + (i % 5) * 0.55, 0.95, z - 0.35 + ((i / 5) | 0) * 0.7, 0.2);
    }
    for (const z of [-37, -32, -27]) { counter(-54, z, -50.5, z + 0.9, 'paintGrey', 'chrome'); L.box(-52, 1.0, z + 0.2, -51.6, 1.45, z + 0.7, 'paintDark', { noCol: true }); }
    for (let i = 0; i < 6; i++) cart(-49, -40.5 + i * 0.75, 0);
    for (const [x, z] of [[-63, -24], [-66, -14]]) cart(x, z, rnd() * 3);
    for (let x = -84; x <= -50; x += 8) for (let z = -36; z <= 2; z += 9.5) K.roomLight(x, NH, z);
    loot(-66, G, -26); loot(-66, G, -14); loot(-60, G, -33); loot(-70, G, -3); loot(-52, G, -2); loot(-52, G, -40); loot(-74, G, -40);
    chest(-73.8, G, -19.5, Math.PI / 2);
    // loading dock and the roof stair on the north side
    L.box(-92, 0, -34, NX0, 1.2, -22, 'concrete', { top: 'concreteDark' });
    steps('z', -21.9, -19, -91, -89, 0, 1.2, -1, 'concrete');
    boxTruck(-96.5, -28, true, 'paintCherry');
    openSteps('x', -80, -66, NZ0 - 2.6, NZ0 - 0.4, 0, NH + 0.25, 1, 'paintDark');
    L.box(-66, NH + 0.05, NZ0 - 2.6, -62, NH + 0.25, NZ0, 'grate', { bottom: true });
    rail('x', -66, -62, NZ0 - 2.7, NH + 0.25, 'paintDark');
    const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
    P('ac', -80, -30, 0, NH + 0.25); P('ac', -72, -10, 0.2, NH + 0.25); P('ac', -56, -36, 0, NH + 0.25); P('vent', -66, 0, 0, NH + 0.25); P('vent', -84, -2, 0, NH + 0.25);
    for (const [x, z] of [[-70, -30], [-60, -6], [-80, -16]]) { deco(x - 1.5, NH + 0.25, z - 1.5, x + 1.5, NH + 0.6, z + 1.5, 'glassDay'); solid(x - 1.5, NH + 0.25, z - 1.5, x + 1.5, NH + 0.6, z + 1.5, 'metal'); }
    loot(-74, NH + 0.25, -24); chest(-52, NH + 0.25, -8, -Math.PI / 2);
    dumpster(-91, 0, false); dumpster(-91, -4, false);
  }

  // ------------------------------------------------------------ the parking lot, the pylon, the crossroads
  function lot(rnd) {
    deco(-42, 0.02, MZF, 37.6, 0.06, -14, 'concrete'); // sidewalk in front of the shops
    deco(-46, 0.02, NZ0, -42, 0.06, 12, 'concrete');     // and in front of Noms
    deco(-42, 0.02, -14, 37.6, 0.04, 13, 'asphalt');
    const line = (x0, z0, x1, z1) => deco(x0, 0.04, z0, x1, 0.05, z1, 'lineWhite');
    for (const [z0, z1] of [[-13.5, -8.5], [-3.5, 1.5], [7.5, 12.5]]) for (let x = -40; x <= 34; x += 2.8) line(x - 0.06, z0, x + 0.06, z1);
    // planter islands with trees, light poles
    for (const x of [-30, -6, 18]) { L.box(x - 3, 0, -3.5 - 3.5, x + 3, 0.25, -3.5 - 2.3, 'concrete', { top: 'grass' }); L.box(x - 3, 0, 1.5 + 0.3, x + 3, 0.25, 1.5 + 1.5, 'concrete', { top: 'grass' }); }
    for (const x of [-30, -6, 18]) { oak(x, -6.4, 3.2, 1.6, rnd); lampPost(x + 2.2, 2.4, 8); }
    // cars
    const paints = ['paintBlue', 'paintCherry', 'paintMint', 'paintCream', 'paintTaxi', 'busYellow', 'planeWhite', 'paintGreen'];
    const spots = [[-38.6, -11], [-27.4, -11], [-19, -11], [-2.2, -11], [11.8, -11], [25.8, -11], [-35.8, -1], [-13.4, -1], [3.4, -1], [20.2, -1], [-24.6, 10], [-7.8, 10], [14.6, 10], [23, 10]];
    spots.forEach(([x, z], i) => { if (rnd() < 0.82) K.car(x, z, false, paints[i % paints.length], z > 0); });
    // cart corral
    L.pipe('chrome', 2, 0.9, 4, 6, 0.9, 4, 0.04); L.pipe('chrome', 2, 0.9, 5.4, 6, 0.9, 5.4, 0.04);
    for (let i = 0; i < 4; i++) cart(2.8 + i * 0.9, 4.7, Math.PI / 2);
    loot(-24, 0.05, 4.6); loot(9, 0.05, -5.5); loot(28, 0.05, -5.8); loot(-38, 0.05, 5);
    // the pylon sign at the corner
    for (const x of [27.2, 30.8]) { L.box(x - 0.3, 0, 10.6, x + 0.3, 11, 11.4, 'rrUpper'); }
    L.box(26.8, 3.4, 10.7, 31.2, 10.6, 11.3, 'paintDark', { noCol: true });
    K.plane(art().pylon, 4.2, 7, 29, 7, 11.32, 0); K.plane(art().pylon, 4.2, 7, 29, 7, 10.68, Math.PI);
    L.box(26.6, 10.6, 10.5, 31.4, 11.1, 11.5, 'paintTaxi');
    solid(26.8, 3.4, 10.7, 31.2, 10.6, 11.3, 'metal');
  }
  function roads() {
    // Main Street (east-west) and Market Road (north-south); Maple Lane runs behind the first row of houses
    deco(-EDGE - 20, 0.02, 14, EDGE + 20, 0.04, 22, 'asphalt');
    for (const [z0, z1] of [[-EDGE - 20, 14], [22, EDGE + 20]]) deco(38, 0.02, z0, 46, 0.04, z1, 'asphalt');
    deco(-112, 0.02, 46, 38, 0.04, 52, 'asphalt'); deco(46, 0.02, 46, 112, 0.04, 52, 'asphalt');
    const y = (x0, z0, x1, z1) => deco(x0, 0.041, z0, x1, 0.05, z1, 'paintYellow');
    for (let x = -EDGE - 14; x < EDGE + 14; x += 6) if (x < 34 || x > 48) y(x, 17.9, x + 3, 18.1);
    for (let z = -EDGE - 14; z < EDGE + 14; z += 6) if (z < 10 || z > 24) y(41.9, z, 42.1, z + 3);
    // crosswalks
    for (let i = 0; i < 8; i++) { deco(34.2 + 0, 0.042, 14.4 + i * 0.95, 37.6, 0.05, 14.4 + i * 0.95 + 0.5, 'lineWhite'); deco(38.4 + i * 0.95, 0.042, 10.6, 38.4 + i * 0.95 + 0.5, 0.05, 13.6, 'lineWhite'); }
    // sidewalks
    deco(-EDGE - 20, 0.02, 22, 37.6, 0.07, 24, 'concrete'); deco(46.4, 0.02, 22, EDGE + 20, 0.07, 24, 'concrete'); deco(46.4, 0.02, 12, EDGE + 20, 0.07, 14, 'concrete');
    deco(-112, 0.02, 52, 37.6, 0.07, 54, 'concrete'); deco(46.4, 0.02, 52, 112, 0.07, 54, 'concrete');
    deco(46.4, 0.02, -EDGE - 20, 48.4, 0.07, 12, 'concrete');
    for (const [z0, z1] of [[24, 46], [54, EDGE + 20]]) { deco(46.4, 0.02, z0, 48.4, 0.07, z1, 'concrete'); deco(36, 0.02, z0, 37.6, 0.07, z1, 'concrete'); }
    for (const [x, z] of [[36.8, -13], [36.8, 26], [47.6, -12], [47.6, 26], [-20, 23.4], [60, 23.4], [-80, 23.4], [0, 53.4], [76, 53.4]]) K.streetLamp(x, z);
    K.hydrant(36.9, 7); K.hydrant(47.5, 30); K.hydrant(-40, 23.4);
  }

  // ------------------------------------------------------------ water tower (east of Market Road)
  function waterTower() {
    const cx = 64, cz = -34, deck = 16.2, R = 5;
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { L.pipe('rrTower', cx + dx * 1.15, 0, cz + dz * 1.15, cx + dx, deck, cz + dz, 0.28); solid(cx + dx * 1.07 - 0.3, 0, cz + dz * 1.07 - 0.3, cx + dx * 1.07 + 0.3, deck, cz + dz * 1.07 + 0.3, 'metal'); L.box(cx + dx * 1.15 - 0.6, 0, cz + dz * 1.15 - 0.6, cx + dx * 1.15 + 0.6, 0.4, cz + dz * 1.15 + 0.6, 'concrete'); }
    for (const y of [5, 10.5]) { // cross-bracing
      const k = y / deck, e = 4 * 1.15 - 0.6 * k;
      for (const [a, b] of [[[-e, -e], [e, -e]], [[e, -e], [e, e]], [[e, e], [-e, e]], [[-e, e], [-e, -e]]]) L.pipe('rrTower', cx + a[0], y, cz + a[1], cx + b[0], y, cz + b[1], 0.1);
    }
    L.cyl('rrTower', cx, deck / 2, cz, 0.6, deck, 0, 0, true); W.addCyl(cx, cz, 0.6, 0, deck, { surf: 'metal' });
    // the tank, its painted band and the roof (stepped so you can stand on it)
    L.cyl('rrTower', cx, deck + 3.2, cz, R, 6.4, 0, 0, false); W.addCyl(cx, cz, R, deck, deck + 6.4, { surf: 'metal' });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 2.2, 48, 1, true), new THREE.MeshStandardMaterial({ map: art().tower, roughness: 0.55, metalness: 0.2 }));
    band.position.set(cx, deck + 3.6, cz); band.receiveShadow = true; L.scene.add(band);
    K.put('rrTower', K.geo('cone'), cx, deck + 6.4 + 1.1, cz, R + 0.3, 2.2, R + 0.3);
    for (const [r, h] of [[R, 0.4], [3.4, 1.0], [1.8, 1.6]]) W.addCyl(cx, cz, r, deck + 6.4, deck + 6.4 + h, { surf: 'metal' });
    K.sph('lampRed', cx, deck + 8.8, cz, 0.18);
    // square catwalk round the tank, with a rail
    const c0 = cx - 7.4, c1 = cx + 7.4, d0 = cz - 7.4, d1 = cz + 7.4, w = 1.4;
    L.box(c0, deck - 0.15, d0, c1, deck, d0 + w, 'grate', { bottom: true }); L.box(c0, deck - 0.15, d1 - w, c1, deck, d1, 'grate', { bottom: true });
    L.box(c0, deck - 0.15, d0 + w, c0 + w, deck, d1 - w, 'grate', { bottom: true }); L.box(c1 - w, deck - 0.15, d0 + w, c1, deck, d1 - w, 'grate', { bottom: true });
    rail('x', c0, c1, d0, deck, 'rrTower'); rail('x', c0, c1, d1, deck, 'rrTower'); rail('z', d0, d1, c0, deck, 'rrTower');
    rail('z', d0, cz - 2.8, c1, deck, 'rrTower'); rail('z', cz - 1.2, d1, c1, deck, 'rrTower');
    // switchback stair on the east side: five flights, landings at each end
    const xa0 = c1 + 0.1, xa1 = xa0 + 1.4, xb1 = xa1 + 1.4, zN0 = cz - 2.9, zN1 = zN0 + 1.5, zS1 = zN1 + 4.6, zS2 = zS1 + 1.5, rise = deck / 5;
    for (let i = 0; i < 5; i++) {
      const y0 = rise * i, y1 = rise * (i + 1), north = i % 2 === 0;
      openSteps('z', zN1, zS1, north ? xa1 : xa0, north ? xb1 : xa1, y0, y1, north ? -1 : 1, 'paintDark');
      if (north) L.box(xa0, y1 - 0.12, zN0, xb1, y1, zN1, 'grate', { bottom: true });
      else L.box(xa0, y1 - 0.12, zS1, xb1, y1, zS2, 'grate', { bottom: true });
    }
    L.box(c1 - 0.05, deck - 0.12, zN0, xa0, deck, zN1, 'grate', { bottom: true });
    for (let i = 0; i < 5; i++) rail('z', zN0, zS2, xb1 + 0.05, rise * i);
    loot(cx, deck, cz - 6.6); chest(cx + 6.6, deck, cz + 3, -Math.PI / 2); loot(cx - 3, 0.05, cz + 7);
    CF.PH.place('generator', cx - 6, 0, cz + 6, 0.3);
  }

  // ------------------------------------------------------------ Gas-N-Go
  function gasStation(rnd) {
    deco(48.4, 0.02, -10, 86, 0.05, 12, 'concrete');
    // canopy over the pumps (its roof is flat and walkable)
    for (const [x, z] of [[54, -5], [64, -5], [54, 3], [64, 3]]) { L.box(x - 0.3, 0, z - 0.3, x + 0.3, 5.0, z + 0.3, 'planeWhite'); }
    L.box(51, 5.0, -8, 67, 5.7, 6, 'planeWhite', { top: 'rrRoof', bottom: true });
    deco(51, 5.0, -8.04, 67, 5.7, -8, 'paintCherry'); deco(51, 5.0, 6, 67, 5.7, 6.04, 'paintCherry');
    K.plane(art().gas, 8, 0.7, 59, 5.35, 6.06, 0); K.plane(art().gas, 8, 0.7, 59, 5.35, -8.06, Math.PI);
    for (let i = 0; i < 4; i++) L.lamp(53 + i * 4, 4.8, -1, { color: 0xfff2d8, intensity: 1.2, distance: 10, pool: false });
    for (const x of [56.5, 61.5]) {
      L.box(x - 0.7, 0, -5.5, x + 0.7, 0.2, 3.5, 'concrete');
      for (const z of [-3, 1]) { L.box(x - 0.45, 0.2, z - 0.35, x + 0.45, 1.85, z + 0.35, 'paintCherry'); deco(x - 0.46, 1.1, z - 0.2, x + 0.46, 1.5, z + 0.2, 'glassDay'); deco(x - 0.4, 1.86, z - 0.3, x + 0.4, 2.0, z + 0.3, 'planeWhite'); }
    }
    K.car(59, -1, false, 'paintMint', true);
    // price sign
    L.box(49.6, 0, 9.6, 50.0, 3.2, 10.0, 'paintGrey'); L.box(48.9, 3.2, 9.5, 50.7, 6.0, 10.1, 'paintDark'); K.plane(art().price, 1.8, 2.7, 49.8, 4.6, 10.12, 0); K.plane(art().price, 1.8, 2.7, 49.8, 4.6, 9.48, Math.PI);
    // the shop
    const x0 = 70, x1 = 84, z0 = -12, z1 = 2, H = 4.4;
    const OUT = [[0, 0.8, 'brick'], [0.8, H + 0.8, 'planeWhite']], IN = [[0, H, 'wallClean']];
    L.box(x0, 0, z0, x1, G, z1, 'checker', { ao: false });
    K.wall('z', z0, z1, x0, 0, H, [[-9.5, -6.5, 0.8, 2.6], [-5.6, -3.6, G, 2.5], [-2.6, 0.6, 0.8, 2.6]], OUT, IN, -1, { noLeaf: true });
    glass(x0 - 0.05, 0.8, -9.5, x0 + 0.05, 2.6, -6.5); glass(x0 - 0.05, 0.8, -2.6, x0 + 0.05, 2.6, 0.6);
    K.wall('z', z0, z1, x1, 0, H, [[-2, -0.8, G, 2.4]], OUT, IN, 1);
    K.wall('x', x0, x1, z0, 0, H, [[76, 79, 1.0, 2.3]], OUT, IN, -1);
    K.wall('x', x0, x1, z1, 0, H, [], OUT, IN, 1);
    slab(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, H + 0.25, 'rrRoof', 'ceilTile');
    for (const [a, b, c, d] of [[x0 - 0.15, z0 - 0.15, x1 + 0.15, z0 + 0.15], [x0 - 0.15, z1 - 0.15, x1 + 0.15, z1 + 0.15], [x0 - 0.15, z0, x0 + 0.15, z1], [x1 - 0.15, z0, x1 + 0.15, z1]]) L.box(a, H + 0.25, b, c, H + 0.85, d, 'paintCherry', { top: 'concrete' });
    wallSign(art().gas, 9, 1.1, x0 - 0.16, H - 0.3, -5, -Math.PI / 2);
    counter(72, -1.5, 76, -0.5, 'paintCherry', 'counter');
    for (const z of [-10.5, -7]) shelfRun(75, z, 82, z + 1, 1.6, rnd, ['paintRed', 'paintTaxi', 'paintBlue', 'cardboard', 'rrOrange']);
    L.box(82.8, 0, -11.8, 83.85, 2.2, -3, 'appliance'); deco(82.75, 0.4, -11.7, 82.8, 1.9, -3.1, 'windowCool');
    K.roomLight(77, H, -5);
    loot(78, G, -4); loot(73, G, -9); chest(81, G, 0.8, Math.PI);
    loot(59, 5.7, 3); loot(56.5, 0.25, 0.5);
    dumpster(86.5, -6, false); CF.PH.place('tires', 86.4, 0, -1.4, 0);
  }

  // ------------------------------------------------------------ houses (two storeys, garage on the east side; front faces north)
  const HF1 = 3.0, HF = 3.25, HH2 = 6.0, HRF = 6.2;
  function house(cx, z0, pal, side, rnd, chestUp) {
    const [ext, roof, shut, accent] = pal;
    const x0 = cx - 6, x1 = cx + 6, z1 = z0 + 10;
    const OUT = [[0, 0.55, 'stone'], [0.55, HRF, ext]], IN1 = [[0, 1.0, 'woodDark'], [1.0, HF1, 'wallpaper']], IN2 = [[HF, HH2, 'wallpaper2']], IN = IN1.concat(IN2), dress = { shutter: shut };
    L.box(x0, 0, z0, cx, G, z1, 'floorWood'); L.box(cx, 0, z0, x1, G, z1, 'checker');
    K.wall('x', x0, x1, z0, 0, HRF, [[cx - 3.4, cx - 2.2, G, 2.35], [cx - 5.4, cx - 4.0, 0.95, 2.3], [cx + 1.2, cx + 4.2, 0.95, 2.3], [cx - 5, cx - 3, HF + 0.9, HF + 2.3], [cx + 1.2, cx + 3.6, HF + 0.9, HF + 2.3]], OUT, IN, -1, dress);
    K.wall('x', x0, x1, z1, 0, HRF, [[cx + 2, cx + 3.2, G, 2.35], [cx - 4.5, cx - 2.5, 0.95, 2.3], [cx - 2, cx, HF + 0.9, HF + 2.3], [cx + 2.6, cx + 4.6, HF + 0.9, HF + 2.3]], OUT, IN, 1, dress);
    K.wall('z', z0, z1, x0, 0, HRF, [[z0 + 3, z0 + 5, 0.95, 2.3], [z0 + 3, z0 + 5, HF + 0.9, HF + 2.3]], OUT, IN, -1, dress);
    K.wall('z', z0, z1, x1, 0, HRF, [[z0 + 4.5, z0 + 5.7, G, 2.35], [z0 + 7.6, z0 + 9.2, 0.95, 2.3], [z0 + 3, z0 + 5, HF + 0.9, HF + 2.3]], OUT, IN, 1, dress);
    // ground floor: living room west, kitchen east; stair up the back wall
    K.wall('z', z0, z0 + 8.4, cx, 0, HF1, [[z0 + 5, z0 + 6.3, G, 2.35]], null, IN1, 0);
    steps('x', x0 + 0.25, cx - 0.5, z1 - 1.35, z1 - 0.13, G, HF, 1, 'woodDark', 'carpet');
    slab(x0, z0, x1, z1 - 1.4, HF, 'carpet'); slab(cx - 0.5, z1 - 1.4, x1, z1, HF, 'carpet');
    // upstairs: two bedrooms off a back landing
    K.wall('z', z0, z1 - 1.4, cx + 1.5, HF, HH2, [], null, IN2, 0);
    K.wall('x', x0, cx + 1.5, z1 - 1.4, HF, HH2, [[cx - 0.4, cx + 1.2, HF, HF + 2.3]], null, IN2, 0);
    L.box(x0, HH2, z0, x1, HRF, z1, 'ceiling', { bottom: true, noCol: true }); solid(x0, HH2, z0, x1, HRF, z1);
    K.gableRoof(cx, (z0 + z1) / 2, 12, 10, HRF, 2.6, ext, roof, false, true);
    // garage: walls, a flat roof, the door rolled up
    const gx0 = x1, gx1 = x1 + 6, gz1 = z0 + 7;
    L.box(gx0, 0, z0, gx1, G, gz1, 'concrete');
    K.wall('x', gx0, gx1, z0, 0, HF1, [[gx0 + 0.6, gx1 - 0.6, G, 2.6]], [[0, 0.55, 'stone'], [0.55, HF1 + 0.3, ext]], [[0, HF1, 'plaster']], -1, { noLeaf: true });
    K.wall('x', gx0, gx1, gz1, 0, HF1, [[gx0 + 3.4, gx0 + 4.6, G, 2.35]], [[0, 0.55, 'stone'], [0.55, HF1 + 0.3, ext]], [[0, HF1, 'plaster']], 1);
    K.wall('z', z0, gz1, gx1, 0, HF1, [], [[0, 0.55, 'stone'], [0.55, HF1 + 0.3, ext]], [[0, HF1, 'plaster']], 1);
    L.box(gx0 - 0.12, HF1, z0 - 0.2, gx1 + 0.2, HF1 + 0.25, gz1 + 0.2, 'trim', { top: 'roofGray', bottom: true });
    deco(gx0 + 0.6, 2.6, z0 + 0.15, gx1 - 0.6, 2.95, z0 + 0.6, 'garageDoor');
    // porch, path, driveway, mailbox
    deco(cx - 4.4, 0, z0 - 1.6, cx - 1.2, 0.14, z0, 'concrete'); K.sph('lampWarm', cx - 1.6, 2.5, z0 - 0.18, 0.1);
    deco(cx - 3.3, 0.02, side, cx - 2.3, 0.06, z0 - 1.6, 'concrete');
    deco(gx0 + 0.6, 0.02, side, gx1 - 0.6, 0.06, z0, 'concrete');
    K.mailbox(cx - 4.6, side + 0.8);
    // inside: sofa, rug and TV; kitchen counters and table; beds upstairs
    K.couch(x0 + 0.4, z0 + 1.2, x0 + 1.4, z0 + 3.8, 'x-'); deco(x0 + 1.8, G, z0 + 1.0, cx - 1.6, G + 0.02, z0 + 4.2, 'rug');
    L.box(cx - 0.8, G, z0 + 1.6, cx - 0.35, G + 1.1, z0 + 3.4, 'paintDark');
    counter(cx + 3.6, z1 - 1.0, x1 - 0.15, z1 - 0.15); counter(x1 - 1.0, z0 + 6.2, x1 - 0.15, z1 - 1.0);
    L.box(cx + 0.15, G, z0 + 7.0, cx + 0.95, G + 1.9, z0 + 8.0, 'appliance');
    K.table(cx + 1.5, z0 + 2.0, cx + 3.5, z0 + 3.4, G); K.chair(cx + 1.2, z0 + 2.7, G); K.chair(cx + 3.8, z0 + 2.7, G);
    K.bed(x0 + 0.3, z0 + 0.4, x0 + 2.4, z0 + 2.6, HF, 'x-'); K.bed(x1 - 2.4, z0 + 0.4, x1 - 0.3, z0 + 2.6, HF, 'x+');
    L.box(cx - 2.2, HF, z0 + 0.15, cx - 0.4, HF + 1.0, z0 + 0.65, accent || 'cabinet'); L.box(cx + 2.4, HF, z0 + 0.15, cx + 3.8, HF + 1.0, z0 + 0.65, 'cabinet');
    K.roomLight(cx - 3, HF1, z0 + 4); K.roomLight(cx + 3, HF1, z0 + 4); K.roomLight(cx - 3, HH2, z0 + 4); K.roomLight(cx + 3, HH2, z0 + 4);
    CF.PH.place('boxStack', gx1 - 1, 0, gz1 - 1, rnd()); L.box(gx0 + 0.3, 0, gz1 - 1.0, gx0 + 2.8, 0.95, gz1 - 0.2, 'woodDark', { top: 'wood' });
    loot(cx - 3, G, z0 + 5.5); loot(cx + 2.5, G, z0 + 5.5); loot(cx - 3, HF, z0 + 4.5); loot(cx + 3.2, HF, z0 + 4.5); loot(gx0 + 3, G, z0 + 3.5);
    if (chestUp) chest(cx + 3.4, HF, z1 - 2.2, Math.PI); else chest(gx1 - 0.9, G, z0 + 3.4, -Math.PI / 2);
    // yard: a tree out back, a fence line
    oak(cx - 3, z1 + 2.8, 3.2, 2, rnd); K.bush(x0 - 1.5, z0 + 1, 0.8); K.bush(cx + 1, z0 - 1.2, 0.6);
    if (rnd() < 0.5) CF.PH.place('grill', cx + 1, 0, z1 + 2.5, 0); else CF.PH.place('cooler', cx + 1, 0, z1 + 2.5, 0.3);
  }

  // ------------------------------------------------------------ park, storage yard, countryside
  function park(rnd) {
    deco(-34, 0.02, 24, 34, 0.035, 46, 'grass');
    // basketball court and hoops
    flat(art().court, 14, 22, -16, 0.045, 35);
    for (const z of [24.8, 45.2]) { const s = z < 35 ? 1 : -1; L.cyl('paintGrey', -16, 1.6, z, 0.08, 3.2, 0, 0, true); deco(-16.8, 3.0, z + s * 0.2, -15.2, 4.0, z + s * 0.26, 'planeWhite'); L.addGeo('paintCherry', L.geo('torus'), L.mat4(-16, 3.1, z + s * 0.6, Math.PI / 2, 0, 0, 0.23, 0.23, 0.23)); solid(-16.1, 0, z - 0.1, -15.9, 3.2, z + 0.1, 'metal'); }
    // playground: a climbing frame you can stand on, a slide, swings
    for (const [x, z] of [[6, 30], [10, 30], [6, 34], [10, 34]]) { L.cyl('paintBlue', x, 1.4, z, 0.08, 2.8, 0, 0, true); solid(x - 0.09, 0, z - 0.09, x + 0.09, 2.8, z + 0.09, 'metal'); }
    L.box(6, 1.85, 30, 10, 2.0, 34, 'wood', { bottom: true });
    for (const [a, b, c, d] of [[6, 30, 10, 30.06], [6, 33.94, 7, 34], [8.4, 33.94, 10, 34], [6, 30, 6.06, 34], [9.94, 30, 10, 34]]) deco(a, 2.5, b, c, 2.6, d, 'paintCherry');
    L.box(6, 2.75, 30, 10, 2.85, 34, 'paintTaxi', { noCol: true });
    steps('z', 34, 38, 7, 8.4, 0, 2.0, -1, 'paintBlue');
    L.pipe('paintCherry', 9.2, 2.0, 34, 9.2, 0.3, 38.4, 0.35);
    for (const x of [14, 18]) { L.pipe('paintBlue', x, 0, 29, x, 2.6, 30, 0.07); L.pipe('paintBlue', x, 0, 31, x, 2.6, 30, 0.07); }
    L.pipe('paintBlue', 14, 2.6, 30, 18, 2.6, 30, 0.07); for (const x of [15, 17]) { L.pipe('chrome', x, 2.6, 30, x, 0.7, 30, 0.012); deco(x - 0.25, 0.65, 29.85, x + 0.25, 0.7, 30.15, 'rubber'); }
    // picnic shelter with a chest
    for (const [x, z] of [[20, 38], [28, 38], [20, 44], [28, 44]]) L.box(x - 0.15, 0, z - 0.15, x + 0.15, 3.0, z + 0.15, 'woodDark');
    L.box(19.4, 3.0, 37.4, 28.6, 3.3, 44.6, 'woodDark', { top: 'roofGray', bottom: true });
    for (const x of [22, 26]) K.table(x - 0.6, 40, x + 0.6, 42, 0);
    chest(24, 0.05, 43.6, Math.PI); loot(10, 2.0, 32); loot(-16, 0.05, 35); loot(30, 0.05, 30);
    for (const [x, z] of [[-30, 28], [-2, 42], [2, 26], [32, 26], [-30, 44]]) oak(x, z, 3.4 + rnd(), 2.0, rnd);
    // the green south of Maple Lane
    for (const [x, z] of [[-20, 62], [-6, 70], [10, 60], [24, 68], [0, 80], [-24, 82]]) oak(x, z, 3.6 + rnd(), 2.2, rnd);
    CF.PH.place('planter', 4, 0, 64, 0); loot(4, 0.05, 66); loot(-14, 0.05, 74);
  }
  function storage(rnd) {
    const x0 = -30, x1 = 20, z0 = -94, z1 = -60;
    deco(x0, 0.02, z0, x1, 0.04, z1, 'gravel');
    deco(-6, 0.02, z1, 2, 0.04, -44, 'gravel');
    // two rows of storage units (closed boxes with roll-up doors), containers between them
    for (const [zz, face] of [[-92, 1], [-66, -1]]) {
      L.box(x0 + 2, 0, zz, x1 - 2, 3.2, zz + 4, 'metalSiding', { top: 'roofTin' });
      for (let x = x0 + 3; x < x1 - 3; x += 4) deco(x, 0.1, face > 0 ? zz + 4 : zz - 0.04, x + 3.2, 2.8, face > 0 ? zz + 4.04 : zz, 'rrOrangeDoor');
    }
    const C = ['cont_red', 'cont_blue', 'cont_green', 'cont_orange'];
    const cont = (x, z, ry, y, k) => { L.propBox(C[k % C.length], x, y || 0, z, 6.1, 2.6, 2.44, ry); const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = (6.1 * c + 2.44 * s) / 2, hd = (6.1 * s + 2.44 * c) / 2; solid(x - hw, y || 0, z - hd, x + hw, (y || 0) + 2.6, z + hd, 'metal'); };
    cont(-20, -79, 0, 0, 0); cont(-20, -76.4, 0, 0, 1); cont(-20, -77.7, 0, 2.6, 2);
    cont(-4, -80, Math.PI / 2, 0, 3); cont(10, -78, 0, 0, 1); cont(10, -78, 0.1, 2.6, 0);
    steps('x', 0.5, 6.9, -78.6, -77.4, 0, 2.6, 1, 'paintDark');
    wallSign(art().storage, 9, 1.4, -5, 4.2, -60.9, 0);
    L.box(-9.8, 0, -61.2, -9.4, 5, -60.8, 'paintGrey'); L.box(-0.6, 0, -61.2, -0.2, 5, -60.8, 'paintGrey'); deco(-10, 3.5, -61.05, 0, 4.9, -60.95, 'paintDark');
    loot(-20, 5.2, -77.7); loot(10, 5.2, -78); loot(-4, 0.05, -72); loot(14, 0.05, -86); chest(-26, 0.05, -78, Math.PI / 2); loot(16, 0.05, -70);
    CF.PH.place('crate', 3, 0, -86, 0.2); CF.PH.place('drum', -12, 0, -84); CF.PH.place('drum', -11.3, 0, -84.6);
  }
  function farm(rnd) {
    // a red barn and a silo in the north-east field
    const x0 = 66, x1 = 86, z0 = -92, z1 = -76, H = 5;
    const OUT = [[0, H + 0.4, 'rrBarn']], IN = [[0, H, 'plankWall']];
    L.box(x0, 0, z0, x1, G, z1, 'dirt');
    K.wall('x', x0, x1, z1, 0, H, [[73, 79, G, 4.2]], OUT, IN, 1, { noLeaf: true });
    K.wall('x', x0, x1, z0, 0, H, [[80, 82, G, 2.6]], OUT, IN, -1, { noLeaf: true });
    K.wall('z', z0, z1, x0, 0, H, [[-86, -83, 1.2, 2.6]], OUT, IN, -1); K.wall('z', z0, z1, x1, 0, H, [], OUT, IN, 1);
    // hay loft: a floor at the west end and a ladder-steep stair
    slab(x0, z0, x0 + 7, z1, 2.8, 'wood', 'wood'); steps('x', x0 + 7, x0 + 11.5, z0 + 0.3, z0 + 1.4, 0, 2.8, -1, 'wood');
    K.gableRoof((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, H, 3.4, 'rrBarn', 'rrBarnRoof', false, true);
    for (let i = 0; i < 4; i++) L.box(x0 + 0.5 + i * 1.5, 2.8, z0 + 1, x0 + 1.8 + i * 1.5, 3.8, z0 + 2.4, 'hay');
    L.box(x1 - 4, 0, z0 + 1, x1 - 1, 1.2, z0 + 3, 'hay');
    loot(x0 + 3, 2.8, z1 - 4); loot(x1 - 4, G, z1 - 4); chest(x0 + 1.4, 2.8, z0 + 6, Math.PI / 2);
    L.cyl('paintGrey', x1 + 5, 6, z0 + 6, 3, 12, 0, 0, false); K.put('paintGrey', L.geo('sphere'), x1 + 5, 12, z0 + 6, 3, 1.5, 3); W.addCyl(x1 + 5, z0 + 6, 3, 0, 12, { surf: 'metal' });
    for (let i = 0; i < 8; i++) { const x = 60 + rnd() * 30, z = -110 + rnd() * 14; L.cyl('hay', x, 0.6, z, 0.7, 1.2, Math.PI / 2, 0, true); solid(x - 0.7, 0, z - 0.6, x + 0.7, 1.2, z + 0.6); }
    // fence along the field
    for (let x = 54; x < 112; x += 3) { deco(x - 0.08, 0, -70.08, x + 0.08, 1.2, -69.92, 'woodDark'); }
    deco(54, 0.75, -70.04, 112, 0.85, -69.96, 'wood'); deco(54, 0.35, -70.04, 112, 0.45, -69.96, 'wood'); solid(54, 0, -70.06, 112, 1.1, -69.94);
  }

  // ------------------------------------------------------------ build
  RR.build = function () {
    K = CF.MapNuketown.kit;
    LOOT = []; CHESTS = [];
    const rnd = U.mulberry32(2018), M = L.mats, Tx = CF.Tex.list;
    // colours of the town
    const tint = (t, c, o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.6, map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, color: c, metalness: 0 }, o || {}));
    M.rrFacade = tint(Tx.concrete, 0xe9d6b4); M.rrUpper = tint(Tx.concrete, 0xc96f4a); M.rrBack = tint(Tx.concrete, 0xb9b0a2);
    M.rrNoms = tint(Tx.concrete, 0xeee6d6); M.rrRoof = tint(Tx.concrete, 0x9a9890);
    M.rrTower = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x8fc6e8, metalness: 0.3, roughness: 0.45, envMapIntensity: 0.8 });
    M.rrOrange = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xf08a24, metalness: 0.1, roughness: 0.5 });
    M.rrPurple = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xb07ad8, metalness: 0, roughness: 0.8 });
    // The barn has no ceiling: show the underside of its pitched roof indoors.
    M.rrBarnRoof = M.roofTin.clone(); M.rrBarnRoof.side = THREE.DoubleSide;
    M.rrOrangeDoor = tint(Tx.siding, 0xf09a2a, { metalness: 0.3 }); M.rrBarn = tint(Tx.planks, 0xa8352a); M.hay = tint(Tx.grass, 0xe0c46a);
    // ground: grass everywhere, roads and lots laid on top
    L.box(-1600, -1, -1600, 1600, 0.02, 1600, 'grass', { ao: false }); // wide enough that the edge never shows from the Battle Bus
    roads();
    shops(rnd);
    noms(rnd);
    lot(rnd);
    waterTower();
    gasStation(rnd);
    // houses: the first row faces Main Street, the second Maple Lane
    const PAL = [['sidingBlue', 'roofGray', 'shutterWhite'], ['sidingYellow', 'roofing', 'shutterBrown'], ['sidingWhite', 'roofGray', 'shutterBlue'], ['sidingGreen', 'roofLight', 'shutterWhite'],
      ['boardYellow', 'roofGray', 'shutterBrown'], ['sidingBeige', 'roofing', 'shutterBlue'], ['stucco', 'roofLight', 'shutterWhite'], ['sidingTeal', 'roofGray', 'shutterWhite'], ['sidingWhite', 'roofing', 'shutter'], ['sidingBlue', 'roofLight', 'shutterBrown']];
    [[-100, 30], [-76, 30], [-52, 30], [60, 30], [84, 30]].forEach(([x, z], i) => house(x, z, PAL[i], 24, rnd, i % 2 === 0));
    [[-96, 58], [-70, 58], [-44, 58], [62, 58], [88, 58]].forEach(([x, z], i) => house(x, z, PAL[i + 5], 54, rnd, i % 2 === 1));
    park(rnd);
    // Maple Lane's middle: a basketball court and the community pool deck
    storage(rnd);
    farm(rnd);
    // back fences behind the houses
    for (const [x0, x1, z] of [[-108, -36, 44], [52, 102, 44], [-104, -30, 72], [54, 106, 72]]) K.woodFenceX(x0, x1, z, 1.6);
    // countryside: woods and rocks, a pond
    const busy = (x, z) => (x > -112 && x < 104 && z > -48 && z < 76) || (x > -34 && x < 24 && z > -98 && z < -44) || (x > 50 && x < 100 && z > -98 && z < -66) || (Math.abs(x - 42) < 6) || (Math.abs(z - 18) < 6);
    let n = 0;
    for (let i = 0; i < 900 && n < 170; i++) {
      const x = (rnd() - 0.5) * 2 * (EDGE + 30), z = (rnd() - 0.5) * 2 * (EDGE + 30);
      if (busy(x, z) || Math.hypot(x + 70, z + 80) < 16) continue;
      n++;
      if (rnd() < 0.55) fir(x, z, 9 + rnd() * 8); else oak(x, z, 3.5 + rnd() * 2, 2.2 + rnd(), rnd);
    }
    for (let i = 0; i < 40; i++) { const x = (rnd() - 0.5) * 230, z = (rnd() - 0.5) * 230; if (!busy(x, z)) rock(x, z, 0.6 + rnd() * 1.4, i); }
    K.put('rrPond', K.discGeo(0, 13, 1 / 6), -70, 0.03, -80, 1, 1, 1);
    M.rrPond = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x3a7fa6, metalness: 0.4, roughness: 0.08, envMapIntensity: 1.3 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; K.put('rock', K.blobGeo(i % 3), -70 + Math.cos(a) * 13.4, 0.1, -80 + Math.sin(a) * 13.4, 0.7, 0.35, 0.6, a); }
    loot(-58, 0.05, -66); loot(-100, 0.05, -10); loot(100, 0.05, 40); loot(-20, 0.05, 92); loot(30, 0.05, 98); loot(-104, 0.05, 96); loot(96, 0.05, -40);
    chest(-90, 0.05, 90, 0); chest(104, 0.05, 104, 0);
    // a few cars on the streets, a truck at the barn
    K.car(-60, 19.5, true, 'paintCherry'); K.car(80, 16.5, true, 'planeWhite', true); K.car(41, -40, false, 'paintTaxi'); K.car(-20, 49, true, 'paintMint');
    boxTruck(74, -68, true, 'paintGreen');
    // power line along Main Street
    const poles = [-110, -80, -50, -20, 10, 52, 80, 108].map((x) => K.powerPole(x, 25.2, 9));
    for (let i = 0; i < poles.length - 1; i++) K.wire(poles[i], poles[i + 1], 0.9);
    // the edge: a post-and-rail fence and an invisible wall just inside it
    for (let a = -EDGE; a <= EDGE; a += 4) { for (const [x, z] of [[a, -EDGE - 1], [a, EDGE + 1], [-EDGE - 1, a], [EDGE + 1, a]]) deco(x - 0.08, 0, z - 0.08, x + 0.08, 1.2, z + 0.08, 'woodDark'); }
    for (const s of [-1, 1]) { deco(-EDGE, 0.8, s * (EDGE + 1) - 0.04, EDGE, 0.9, s * (EDGE + 1) + 0.04, 'wood'); deco(s * (EDGE + 1) - 0.04, 0.8, -EDGE, s * (EDGE + 1) + 0.04, 0.9, EDGE, 'wood'); }
    const inv = (x0, z0, x1, z1) => L.box(x0, 0, z0, x1, 400, z1, 'trim', { noMesh: true, nav: false });
    inv(-EDGE - 2, -EDGE - 2, EDGE + 2, -EDGE); inv(-EDGE - 2, EDGE, EDGE + 2, EDGE + 2); inv(-EDGE - 2, -EDGE, -EDGE, EDGE); inv(EDGE, -EDGE, EDGE + 2, EDGE);
    L.killY = -10;
    W.navWalls = true; // bots: see the thin walls and shop windows (js/world.js)

    // spawns (warm-up and the other modes), loot and chests for Battle Royale
    L.spawns.ffa = [[-20, 0.05, -5.5], [12, 0.05, 6], [-56, 0.15, -18], [-44, 0.05, 10], [30, 0.05, -15.5], [42, 0.05, -20], [60, 0.05, 2], [76, 0.05, -20],
      [-85, 0.05, 26], [-61, 0.05, 26], [75, 0.05, 26], [-30, 0.05, 36], [0, 0.05, 40], [28, 0.05, 30], [-56, 0.05, 50], [70, 0.05, 50],
      [-10, 0.05, -50], [-100, 0.05, -20], [100, 0.05, 0], [0, 0.05, 90]];
    L.spawns.t0 = L.spawns.ffa.filter((s) => s[2] < 10); L.spawns.t1 = L.spawns.ffa.filter((s) => s[2] >= 10);
    L.points.loot = LOOT; L.points.chests = CHESTS;
    L.points.start = { x: 12, y: 0.05, z: 6, yaw: Math.PI };
    L.points.br = { size: EDGE, center: [-4, -8] };
  };
})(window.CF);
