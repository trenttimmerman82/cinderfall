'use strict';
/* Cinderfall — TILTED TOWERS (multiplayer, Battle Royale). A dense little city of towers in a green valley, after the
   Fortnite landmark. Four streets in a grid with traffic lights; in the middle the plaza, its fountain and the clock
   tower (eight storeys, clock faces on all four sides, a belfry with a bell and a copper spire). Round it: an
   eight-storey brick tower with Pizza Pit downstairs and a fire escape, the Vertex glass office block, the Maple Court
   apartments with balconies, Durr Burger with the giant burger on its roof, the pharmacy, Hotel Tilted and its pool,
   a loft block over a bookshop, the Grand Mercantile department store, a white tower with a café, and a half-built
   tower with scaffolding and a tower crane you can land on. Outside town: woods, fields, a pond, a gas station.
   Every tower has a scissor stair to every floor (flights alternate between two lanes, so each climbs under an open
   slab) and a hut out onto the roof. Axes: +X east, +Z south.
   The map lists where floor loot lies (L.points.loot) and where chests stand (L.points.chests) for js/br.js. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const TT = CF.MapTilted = {};
  let K = null, R = null; // Nuketown's building kit (js/map-nuketown.js), Retail Row's town kit (js/map-retail.js)

  const T = 0.25, G = 0.12, FH = 3.6; // wall thickness, ground-floor finish, floor to floor
  const EDGE = 120;                    // the invisible fence all round
  const ROAD = [-26, 26], RW = 4;      // street centre lines (both ways) and half their width
  const TOWN = 74;                     // the paved town square
  let LOOT = [], CHESTS = [], BLD = [];
  const loot = (x, y, z) => LOOT.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)]);
  const chest = (x, y, z, yaw) => CHESTS.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), yaw || 0]);
  const lv = (k) => (k ? k * FH : G); // top of the floor at storey k
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);

  // ------------------------------------------------------------ small helpers
  /** Floor slab whose top is at y (its underside shows as a ceiling from below). */
  function slab(x0, z0, x1, z1, y, top, m, side) {
    if (x1 - x0 > 0.02 && z1 - z0 > 0.02) L.box(x0, y - 0.25, z0, x1, y, z1, m || 'ceiling', { top, side: side || 'trim', bottom: true });
  }
  /** The same with a rectangular hole [hx0, hz0, hx1, hz1] in it (a stair coming up through). */
  function holeSlab(x0, z0, x1, z1, y, top, h, m, side) {
    if (!h) { slab(x0, z0, x1, z1, y, top, m, side); return; }
    slab(x0, z0, x1, h[1], y, top, m, side); slab(x0, h[3], x1, z1, y, top, m, side);
    slab(x0, h[1], h[0], h[3], y, top, m, side); slab(h[2], h[1], x1, h[3], y, top, m, side);
  }
  /** Square pyramid (a spire, a pinnacle): base half-width hw at y, apex h above. */
  function pyramid(m, x, y, z, hw, h) { L.addGeo(m, PYR(), L.mat4(x, y + h / 2, z, 0, Math.PI / 4, 0, hw * Math.SQRT2, h, hw * Math.SQRT2)); }
  let _pyr = null;
  const PYR = () => _pyr || (_pyr = new THREE.ConeGeometry(1, 1, 4, 1));
  /**
   * One side of a footprint: 'n' (z0), 's' (z1), 'w' (x0), 'e' (x1). a runs along the wall (world X or Z), b out from
   * its centre line, so boxes, rails and stairs on any face can be written once.
   */
  function face(x0, z0, x1, z1, s) {
    const ax = s === 'n' || s === 's', out = s === 'n' || s === 'w' ? -1 : 1, c = s === 'n' ? z0 : s === 's' ? z1 : s === 'w' ? x0 : x1;
    const span = (b0, b1) => { const p = c + out * b0, q = c + out * b1; return [Math.min(p, q), Math.max(p, q)]; };
    return {
      s, ax, out, c, a0: ax ? x0 : z0, a1: ax ? x1 : z1, axis: ax ? 'x' : 'z',
      ry: s === 'n' ? Math.PI : s === 's' ? 0 : s === 'w' ? -Math.PI / 2 : Math.PI / 2, // a sign on this face looks this way
      span,
      box(a0, a1, b0, b1, y0, y1, m, o) { const [p, q] = span(b0, b1); return ax ? L.box(a0, y0, p, a1, y1, q, m, o) : L.box(p, y0, a0, q, y1, a1, m, o); },
      deco(a0, a1, b0, b1, y0, y1, m) { this.box(a0, a1, b0, b1, y0, y1, m, { noCol: true, ao: false }); },
      pt(a, b) { return ax ? [a, c + out * b] : [c + out * b, a]; },
      railAlong(a0, a1, b, y, m) { R.rail(ax ? 'x' : 'z', a0, a1, c + out * b, y, m); },
      railAcross(b0, b1, a, y, m) { const [p, q] = span(b0, b1); R.rail(ax ? 'z' : 'x', p, q, a, y, m); },
      steps(a0, a1, b0, b1, y0, y1, up, m) { const [p, q] = span(b0, b1); R.openSteps(ax ? 'x' : 'z', a0, a1, p, q, y0, y1, up, m || 'paintDark'); }
    };
  }
  /** Striped canvas awning cloth; V: stripes the other way (for boxes turned side-on). */
  function stripes(a, b, v) {
    const t = K.canvasTex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; if (v) x.fillRect(0, i * h / 8, w, h / 8); else x.fillRect(i * w / 8, 0, w / 8, h); } });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ vertexColors: true, map: t, roughness: 0.85, metalness: 0 });
  }

  // ------------------------------------------------------------ signs (canvas art)
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const sign = (w, h, d) => K.canvasTex(w, h, d);
    const shop = (text, sub, bg, fg, font) => sign(1024, 160, (x, w, h) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 7; x.strokeRect(9, 9, w - 18, h - 18);
      x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = font; x.fillText(text, w / 2, sub ? 96 : 112);
      if (sub) { x.font = 'bold 30px Arial, sans-serif'; x.fillText(sub, w / 2, 140); }
    });
    const BLK = '"Arial Black", Arial, sans-serif';
    ART.pizza = shop('PIZZA PIT', 'SLICES · PIES · DELIVERY', '#b8261c', '#ffe08a', '900 92px ' + BLK);
    ART.burger = shop('DURR BURGER', 'HOME OF THE DURR', '#f2c12e', '#b3261e', '900 88px ' + BLK);
    ART.pharm = shop('Tilted Pharmacy', 'PRESCRIPTIONS · HEALTH · BEAUTY', '#1f7a5a', '#ffffff', 'bold 92px Georgia, serif');
    ART.hotel = shop('HOTEL TILTED', '★  ★  ★  ★', '#1d2a44', '#e8c76a', 'bold 96px Georgia, serif');
    ART.vertex = shop('VERTEX', 'OFFICES · FLOORS 1 – 5 TO LET', '#141c26', '#7fd0ff', '900 100px ' + BLK);
    ART.merc = shop('GRAND MERCANTILE', 'DEPARTMENT STORE · EST. 1921', '#5a1f2e', '#f2dfb0', 'bold 84px Georgia, serif');
    ART.books = shop('Brick & Page', 'BOOKS · RECORDS · COMICS', '#24452f', '#f3e6c4', 'italic bold 100px Georgia, serif');
    ART.cafe = shop('Tower Café', 'ESPRESSO · BAGELS · PASTRY', '#f4efe4', '#2a5c9c', 'italic bold 100px Georgia, serif');
    ART.maple = shop('MAPLE COURT', 'APARTMENTS', '#4a2a1a', '#f2d9a8', 'bold 90px Georgia, serif');
    ART.townHall = shop('TOWN HALL', 'TILTED · EST. 1887', '#e7dfcc', '#3a3226', 'bold 96px Georgia, serif');
    ART.site = sign(1024, 256, (x, w, h) => {
      x.fillStyle = '#1d2f4a'; x.fillRect(0, 0, w, h);
      for (let i = -2; i < 24; i++) { x.fillStyle = i % 2 ? '#f2b51e' : '#151515'; x.beginPath(); x.moveTo(i * 48, h); x.lineTo(i * 48 + 48, h); x.lineTo(i * 48 + 88, h - 40); x.lineTo(i * 48 + 40, h - 40); x.fill(); }
      x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = 'bold 34px Arial, sans-serif'; x.fillText('COMING SOON', w / 2, 52);
      x.font = '900 82px ' + BLK; x.fillStyle = '#f2b51e'; x.fillText('TILTED HEIGHTS', w / 2, 140);
      x.fillStyle = '#ffffff'; x.font = 'bold 28px Arial, sans-serif'; x.fillText('LUXURY LIVING · HARD HATS PAST THIS POINT', w / 2, 186);
    });
    ART.welcome = sign(1024, 384, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2f6fb7'); g.addColorStop(1, '#1b3f73'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.16)'; let px = 36; for (const bh of [120, 180, 90, 230, 150, 110, 200, 130, 170, 100]) { x.fillRect(px, h - 28 - bh, 70, bh); px += 96; }
      x.strokeStyle = '#f4d35e'; x.lineWidth = 14; x.strokeRect(14, 14, w - 28, h - 28);
      x.textAlign = 'center'; x.fillStyle = '#ffffff'; x.font = 'italic 50px Georgia, serif'; x.fillText('Welcome to', w / 2, 100);
      x.font = '900 96px ' + BLK; x.lineWidth = 10; x.strokeStyle = '#0d2244'; x.strokeText('TILTED TOWERS', w / 2, 230); x.fillStyle = '#f4d35e'; x.fillText('TILTED TOWERS', w / 2, 230);
      x.fillStyle = '#ffffff'; x.font = 'bold 36px Arial, sans-serif'; x.fillText('DRIVE SAFE · DROP HOT', w / 2, 306);
    });
    ART.cola = sign(1024, 384, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#8a1fd0'); g.addColorStop(1, '#3b0f78'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffd23a'; x.font = '900 120px ' + BLK; x.textAlign = 'left'; x.fillText('LLAMA', 330, 170); x.fillStyle = '#ffffff'; x.fillText('COLA', 330, 290);
      x.fillStyle = '#e8e2f0'; x.beginPath(); x.ellipse(170, 230, 90, 60, 0, 0, 6.3); x.fill(); x.fillRect(205, 80, 44, 130); x.beginPath(); x.ellipse(232, 78, 50, 34, 0, 0, 6.3); x.fill();
      for (const lx of [110, 150, 195, 235]) x.fillRect(lx, 270, 18, 80);
      x.fillStyle = '#ffd23a'; x.font = 'bold 30px Arial, sans-serif'; x.fillText('ICE COLD · ICE COLD · ICE COLD', 330, 345);
    });
    ART.fuel = sign(1024, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f8a4a'; x.fillRect(0, h * 0.72, w, h * 0.28); x.fillStyle = '#1f8a4a'; x.font = '900 82px ' + BLK; x.textAlign = 'center'; x.fillText('FUEL STOP', w / 2, 82); });
    ART.plaza = sign(1024, 192, (x, w, h) => { x.fillStyle = '#d9d0bd'; x.fillRect(0, 0, w, h); x.fillStyle = '#3a3226'; x.textAlign = 'center'; x.font = 'bold 104px Georgia, serif'; x.fillText('TILTED TOWERS', w / 2, 118); x.font = 'italic 34px Georgia, serif'; x.fillText('Founders Plaza', w / 2, 168); });
    ART.bus = sign(512, 768, (x, w, h) => { x.fillStyle = '#f2c12e'; x.fillRect(0, 0, w, h); x.fillStyle = '#b3261e'; x.font = '900 86px ' + BLK; x.textAlign = 'center'; x.fillText('DURR', w / 2, 140); x.fillText('BURGER', w / 2, 240); x.beginPath(); x.ellipse(w / 2, 460, 170, 70, 0, Math.PI, 0); x.fill(); x.fillStyle = '#5a3220'; x.fillRect(w / 2 - 170, 470, 340, 40); x.fillStyle = '#6cbf3a'; x.fillRect(w / 2 - 175, 510, 350, 18); x.fillStyle = '#d8913a'; x.fillRect(w / 2 - 165, 528, 330, 50); x.fillStyle = '#222'; x.font = 'bold 40px Arial'; x.fillText('GET DURRED.', w / 2, 690); });
    ART.clock = sign(512, 512, (x, w) => {
      const c = w / 2;
      x.fillStyle = '#f3ecd8'; x.beginPath(); x.arc(c, c, c - 6, 0, 6.3); x.fill();
      x.lineWidth = 12; x.strokeStyle = '#2b2b2b'; x.stroke();
      x.lineWidth = 3; x.beginPath(); x.arc(c, c, c - 66, 0, 6.3); x.stroke();
      for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = c - (i % 5 ? 30 : 46), r1 = c - 18; x.lineWidth = i % 5 ? 3 : 8; x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.stroke(); }
      const RN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      x.fillStyle = '#1e1e1e'; x.font = 'bold 42px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      RN.forEach((t, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2; x.save(); x.translate(c + Math.cos(a) * (c - 96), c + Math.sin(a) * (c - 96)); x.rotate(a + Math.PI / 2); x.fillText(t, 0, 0); x.restore(); });
      x.font = 'italic bold 24px Georgia, serif'; x.fillText('TILTED', c, c + 72);
      x.strokeStyle = '#151515'; x.lineCap = 'round';
      const hand = (a, len, wd) => { x.lineWidth = wd; x.beginPath(); x.moveTo(c - Math.cos(a) * 24, c - Math.sin(a) * 24); x.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len); x.stroke(); };
      hand((10 + 10 / 60) / 12 * Math.PI * 2 - Math.PI / 2, 118, 16); hand(10 / 60 * Math.PI * 2 - Math.PI / 2, 182, 9);
      x.fillStyle = '#b8902c'; x.beginPath(); x.arc(c, c, 16, 0, 6.3); x.fill();
    });
    ART.flag = sign(256, 160, (x, w, h) => { x.fillStyle = '#2a5c9c'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4d35e'; x.beginPath(); x.moveTo(w * 0.18, h * 0.85); x.lineTo(w * 0.5, h * 0.15); x.lineTo(w * 0.82, h * 0.85); x.fill(); x.fillStyle = '#2a5c9c'; x.fillRect(w * 0.47, h * 0.45, w * 0.06, h * 0.4); });
    ART.helipad = sign(512, 512, (x, w) => { const c = w / 2; x.fillStyle = '#3a3e44'; x.fillRect(0, 0, w, w); x.strokeStyle = '#f2b51e'; x.lineWidth = 22; x.beginPath(); x.arc(c, c, c - 30, 0, 6.3); x.stroke(); x.fillStyle = '#ffffff'; x.font = '900 300px ' + BLK; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', c, c + 14); });
    return ART;
  }

  // ------------------------------------------------------------ furniture (at any floor height)
  function sofa(x0, z0, x1, z1, y, back, m) {
    m = m || 'couch';
    L.box(x0, y, z0, x1, y + 0.45, z1, m);
    const t = 0.25, bk = (a, b, c, d) => L.box(a, y + 0.45, b, c, y + 0.9, d, m, { ao: false });
    if (back === 'x-') bk(x0, z0, x0 + t, z1); else if (back === 'x+') bk(x1 - t, z0, x1, z1); else if (back === 'z-') bk(x0, z0, x1, z0 + t); else bk(x0, z1 - t, x1, z1);
  }
  /** Desk with a monitor and a chair on its s side (s = +1: the chair at +z, or +x when alongZ). */
  function desk(x, z, y, s, alongZ) {
    if (!alongZ) {
      K.table(x - 0.75, z - 0.4, x + 0.75, z + 0.4, y);
      deco(x - 0.3, y + 0.78, z - s * 0.3, x + 0.3, y + 1.18, z - s * 0.24, 'paintDark'); deco(x - 0.27, y + 0.81, z - s * 0.24, x + 0.27, y + 1.15, z - s * 0.235, 'windowCool');
      K.chair(x, z + s * 0.8, y);
    } else {
      K.table(x - 0.4, z - 0.75, x + 0.4, z + 0.75, y);
      deco(x - s * 0.3, y + 0.78, z - 0.3, x - s * 0.24, y + 1.18, z + 0.3, 'paintDark'); deco(x - s * 0.24, y + 0.81, z - 0.27, x - s * 0.235, y + 1.15, z + 0.27, 'windowCool');
      K.chair(x + s * 0.8, z, y);
    }
  }
  function counterAt(x0, z0, x1, z1, y, m, top) { L.box(x0, y, z0, x1, y + 1.0, z1, m || 'cabinet', { top: top || 'counter' }); }
  /** Shelving run with stock on it, at any height (the long side is its axis). */
  function rack(x0, z0, x1, z1, y, h, rnd, stock, frame) {
    const alongX = x1 - x0 > z1 - z0, n = 4, len = alongX ? x1 - x0 : z1 - z0;
    L.box(x0, y, z0, x1, y + 0.12, z1, frame || 'paintDark', { noCol: true });
    for (let i = 0; i < n; i++) {
      const yy = y + 0.15 + i * (h - 0.2) / (n - 1);
      deco(x0, yy, z0, x1, yy + 0.04, z1, frame || 'paintGrey');
      if (i === n - 1) break;
      for (let a = 0.1; a < len - 0.3;) {
        const w = Math.min(0.25 + rnd() * 0.45, len - a - 0.08), hh = Math.min(0.2 + rnd() * 0.32, (h - 0.2) / (n - 1) - 0.06), m = stock[(rnd() * stock.length) | 0];
        if (alongX) deco(x0 + a, yy + 0.04, z0 + 0.08, x0 + a + w, yy + 0.04 + hh, z1 - 0.08, m); else deco(x0 + 0.08, yy + 0.04, z0 + a, x1 - 0.08, yy + 0.04 + hh, z0 + a + w, m);
        a += w + 0.04 + rnd() * 0.12;
      }
    }
    deco(alongX ? x0 : (x0 + x1) / 2 - 0.03, y, alongX ? (z0 + z1) / 2 - 0.03 : z0, alongX ? x1 : (x0 + x1) / 2 + 0.03, y + h, alongX ? (z0 + z1) / 2 + 0.03 : z1, frame || 'paintGrey');
    solid(x0, y, z0, x1, y + h, z1, 'metal');
  }
  const STOCK = ['paintRed', 'paintTaxi', 'paintMint', 'paintBlue', 'appliance', 'cardboard', 'paintCherry', 'planeWhite'];
  const BOOKS = ['paintCherry', 'paintBlue', 'paintGreen', 'paintTaxi', 'paintCream', 'leather', 'paintDark'];
  const CLOTH = ['paintCherry', 'paintBlue', 'paintCream', 'paintDark', 'paintMint', 'seatBlue', 'leather', 'planeWhite'];
  /** Clothes rail with garments hanging off it, along X or Z. */
  function clothes(x0, z0, x1, z1, y, rnd) {
    const ax = x1 - x0 > z1 - z0, len = ax ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (ax) { L.pipe('chrome', x0, y + 1.45, cz, x1, y + 1.45, cz, 0.025); for (const x of [x0, x1]) L.pipe('chrome', x, y, cz, x, y + 1.45, cz, 0.025); }
    else { L.pipe('chrome', cx, y + 1.45, z0, cx, y + 1.45, z1, 0.025); for (const z of [z0, z1]) L.pipe('chrome', cx, y, z, cx, y + 1.45, z, 0.025); }
    for (let a = 0.12; a < len - 0.1; a += 0.09 + rnd() * 0.05) {
      const m = CLOTH[(rnd() * CLOTH.length) | 0], lo = y + 0.55 + rnd() * 0.3;
      if (ax) deco(x0 + a, lo, cz - 0.24, x0 + a + 0.04, y + 1.4, cz + 0.24, m); else deco(cx - 0.24, lo, z0 + a, cx + 0.24, y + 1.4, z0 + a + 0.04, m);
    }
    solid(ax ? x0 : cx - 0.3, y, ax ? cz - 0.3 : z0, ax ? x1 : cx + 0.3, y + 1.5, ax ? cz + 0.3 : z1);
  }
  function stool(x, z, y) { L.cyl('chrome', x, y + 0.36, z, 0.04, 0.72, 0, 0, true); L.cyl('vinylRed', x, y + 0.74, z, 0.2, 0.08, 0, 0, true); solid(x - 0.2, y, z - 0.2, x + 0.2, y + 0.78, z + 0.2); }
  function plant(x, z, y) { P('planter', x, z, 0, y); }
  /** Big gear wheel standing on edge (the clock works). */
  function gear(x, y, z, r, alongX, m) {
    L.cyl(m || 'ttBronze', x, y, z, r, 0.12, alongX ? 0 : Math.PI / 2, alongX ? Math.PI / 2 : 0);
    const n = Math.max(8, Math.round(r * 14));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, dy = Math.sin(a) * (r + 0.05), dh = Math.cos(a) * (r + 0.05); if (alongX) deco(x - 0.06, y + dy - 0.05, z + dh - 0.05, x + 0.06, y + dy + 0.05, z + dh + 0.05, m || 'ttBronze'); else deco(x + dh - 0.05, y + dy - 0.05, z - 0.06, x + dh + 0.05, y + dy + 0.05, z + 0.06, m || 'ttBronze'); }
  }

  /**
   * Furniture round the edges of a room; its middle stays clear (loot and chests go there). Works in the room's own
   * frame: u along its long side, v across. clear: points (doors) to keep free.
   */
  function furnish(kind, r, y, rnd, clear) {
    const X0 = r.x0, X1 = r.x1, Z0 = r.z0, Z1 = r.z1;
    if (X1 - X0 < 2.8 || Z1 - Z0 < 2.8) return;
    const ax = X1 - X0 >= Z1 - Z0;
    const U0 = ax ? X0 : Z0, U1 = ax ? X1 : Z1, V0 = ax ? Z0 : X0, V1 = ax ? Z1 : X1, uc = (U0 + U1) / 2, vc = (V0 + V1) / 2, lv2 = V1 - V0;
    const xz = (u, v) => (ax ? [u, v] : [v, u]);
    const box = (u0, v0, u1, v1, y0, y1, m, o) => (ax ? L.box(u0, y0, v0, u1, y1, v1, m, o) : L.box(v0, y0, u0, v1, y1, u1, m, o));
    const dec = (u0, v0, u1, v1, y0, y1, m) => box(u0, v0, u1, v1, y0, y1, m, { noCol: true, ao: false });
    const ok = (u, v, d) => { const [x, z] = xz(u, v); return !clear.some((p) => Math.hypot(p[0] - x, p[1] - z) < (d || 2.1)); };
    const spots = (step, margin) => { const out = []; for (let u = U0 + margin; u <= U1 - margin + 0.01; u += step) if (Math.abs(u - uc) > 1.9) out.push(u); return out; };
    const wall = (s) => (s > 0 ? V0 : V1);
    const deskAt = (u, s) => { const v = wall(s) + s * 0.6; if (!ok(u, v)) return; const [x, z] = xz(u, v); desk(x, z, y, s, !ax); };
    const bedAt = (u, s) => {
      const v0 = s > 0 ? V0 + 0.1 : V1 - 2.2, v1 = s > 0 ? V0 + 2.2 : V1 - 0.1; if (!ok(u, (v0 + v1) / 2)) return;
      const head = ax ? (s > 0 ? 'z-' : 'z+') : (s > 0 ? 'x-' : 'x+');
      if (ax) K.bed(u - 0.8, v0, u + 0.8, v1, y, head); else K.bed(v0, u - 0.8, v1, u + 0.8, y, head);
      const nv = wall(s) + s * 0.3; if (ok(u + 1.2, nv)) box(u + 1.0, nv - 0.25, u + 1.5, nv + 0.25, y, y + 0.6, 'woodDark'); // nightstand
    };
    const sofaAt = (u, s, m) => { const v0 = s > 0 ? V0 + 0.1 : V1 - 1.0, v1 = v0 + 0.9; if (!ok(u, (v0 + v1) / 2)) return; const back = ax ? (s > 0 ? 'z-' : 'z+') : (s > 0 ? 'x-' : 'x+'); if (ax) sofa(u - 1.1, v0, u + 1.1, v1, y, back, m); else sofa(v0, u - 1.1, v1, u + 1.1, y, back, m); };
    const tvAt = (u, s) => { const v = wall(s) + s * 0.3; if (!ok(u, v)) return; box(u - 0.7, v - 0.22, u + 0.7, v + 0.22, y, y + 0.55, 'woodDark'); dec(u - 0.65, v - 0.04, u + 0.65, v + 0.04, y + 0.6, y + 1.35, 'paintDark'); dec(u - 0.6, v + s * 0.045 - 0.005, u + 0.6, v + s * 0.045 + 0.005, y + 0.64, y + 1.31, 'windowCool'); };
    const rugAt = (u0, v0, u1, v1, m) => dec(u0, v0, u1, v1, y, y + 0.02, m || 'rug');
    const crateAt = (u, v, k) => { if (!ok(u, v, 1.6)) return; const [x, z] = xz(u, v); P(k || (rnd() < 0.5 ? 'crate' : 'boxStack'), x, z, rnd() * 0.5, y); };
    const rackAt = (u0, u1, s, h, stock, frame) => { const v0 = s > 0 ? V0 + 0.12 : V1 - 0.72, v1 = v0 + 0.6; if (!ok((u0 + u1) / 2, (v0 + v1) / 2, 1.9)) return; const [a, b] = xz(u0, v0), [c, d] = xz(u1, v1); rack(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d), y, h, rnd, stock, frame); };
    const islandRack = (u0, u1, v, h, stock) => { const [a, b] = xz(u0, v - 0.45), [c, d] = xz(u1, v + 0.45); rack(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d), y, h, rnd, stock); };
    const tableSet = (u, v, round) => {
      if (!ok(u, v, 2.4)) return; const [x, z] = xz(u, v);
      if (round) { L.cyl('wood', x, y + 0.74, z, 0.5, 0.05, 0, 0, true); L.cyl('paintDark', x, y + 0.37, z, 0.05, 0.74, 0, 0, true); solid(x - 0.5, y, z - 0.5, x + 0.5, y + 0.76, z + 0.5); }
      else K.table(x - 0.55, z - 0.55, x + 0.55, z + 0.55, y);
      K.chair(x - 0.9, z, y); K.chair(x + 0.9, z, y);
    };
    const endCab = (end, w, h, m) => { const u = end < 0 ? U0 + 0.35 : U1 - 0.35; if (ok(u, vc, 1.6)) box(u - 0.3, vc - w / 2, u + 0.3, vc + w / 2, y, y + h, m || 'paintGrey'); };
    // big rooms get islands of furniture in each quarter (the very middle still stays clear)
    const isl = U1 - U0 > 9.5 && lv2 > 8.5 ? [[uc - 3.6, vc - 2.6], [uc + 3.6, vc - 2.6], [uc - 3.6, vc + 2.6], [uc + 3.6, vc + 2.6]].filter(([u, v]) => ok(u, v, 2.2)) : [];
    const island = {
      office: (u, v) => { const [x, z] = xz(u, v - 0.45), [x2, z2] = xz(u, v + 0.45); desk(x, z, y, -1, !ax); desk(x2, z2, y, 1, !ax); },
      apt: (u, v, i) => { if (i % 2) tableSet(u, v); else { rugAt(u - 1.3, v - 1, u + 1.3, v + 1); const [x, z] = xz(u, v); plant(x, z, y); } },
      hotel: (u, v, i) => { if (i % 2) { const [x, z] = xz(u, v); sofa(x - 0.45, z - 0.45, x + 0.45, z + 0.45, y, ax ? 'z-' : 'x-', 'leather'); } else tableSet(u, v, true); },
      loft: (u, v, i) => { if (i % 2) crateAt(u, v, 'crate'); else tableSet(u, v); },
      storage: (u, v) => { crateAt(u - 0.7, v, 'crate'); crateAt(u + 0.7, v, 'boxStack'); },
      lobby: (u, v) => { const [x, z] = xz(u, v); plant(x, z, y); },
      site: (u, v) => crateAt(u, v, 'crate')
    }[kind];
    if (island) isl.forEach(([u, v], i) => island(u, v, i));
    switch (kind) {
      case 'office':
        for (const u of spots(2.3, 2.8)) { deskAt(u, 1); if (lv2 > 4.4) deskAt(u, -1); }
        endCab(1, 1.8, 1.3); { const u = U0 + 0.4; if (ok(u, vc, 1.6)) { const [x, z] = xz(u, vc); L.cyl('planeWhite', x, y + 0.5, z, 0.18, 1.0, 0, 0, true); L.cyl('windowCool', x, y + 1.2, z, 0.16, 0.4, 0, 0, true); solid(x - 0.2, y, z - 0.2, x + 0.2, y + 1.4, z + 0.2); } }
        for (const [u, v] of [[U0 + 0.5, V0 + 0.5], [U1 - 0.5, V1 - 0.5]]) if (ok(u, v, 1.4)) { const [x, z] = xz(u, v); plant(x, z, y); }
        break;
      case 'apt': {
        bedAt(U1 - 1.4, 1); sofaAt(U0 + 3.6, -1); rugAt(U0 + 2.4, vc - 0.2, U0 + 4.8, V1 - 1.1); tvAt(U0 + 3.6, 1);
        if (ok(U0 + 0.4, vc, 1.8)) { box(U0 + 0.1, vc - 1.4, U0 + 0.75, vc + 0.6, y, y + 0.95, 'cabinet', { top: 'counter' }); box(U0 + 0.1, vc + 0.7, U0 + 0.8, vc + 1.5, y, y + 1.9, 'appliance'); }
        if (U1 - U0 > 8) tableSet(U1 - 1.6, V1 - 1.4);
        break;
      }
      case 'hotel': {
        const us = spots(3.2, 2.6);
        us.forEach((u, i) => bedAt(u, i % 2 ? -1 : 1));
        if (ok(U0 + 0.5, vc, 1.8)) { box(U0 + 0.1, vc - 0.8, U0 + 0.7, vc + 0.8, y, y + 0.76, 'woodDark'); }
        if (ok(U1 - 0.8, V1 - 0.8, 1.4)) { const [x, z] = xz(U1 - 0.8, V1 - 0.8); sofa(x - 0.45, z - 0.45, x + 0.45, z + 0.45, y, ax ? 'z+' : 'x+', 'leather'); }
        break;
      }
      case 'storage':
        for (const u of spots(1.8, 1.6)) { crateAt(u, V0 + 0.8); if (lv2 > 4) crateAt(u, V1 - 0.8); }
        rackAt(U1 - 3.2, U1 - 0.4, 1, 2.2, ['cardboard', 'cardboard', 'paintGrey', 'woodDark']);
        break;
      case 'loft': {
        sofaAt(U0 + 3.4, 1, 'leather'); rugAt(U0 + 2.2, V0 + 1.0, U0 + 4.6, vc + 0.4); tvAt(U0 + 3.4, -1);
        bedAt(U1 - 1.4, -1);
        const u = U1 - 3.6, v = V0 + 0.5; if (ok(u, v)) { box(u - 1.0, v - 0.4, u + 1.0, v + 0.4, y, y + 0.9, 'woodDark', { top: 'wood' }); const [x, z] = xz(u, v); P('box', x + 0.3, z, 0.3, y + 0.9); }
        for (const [uu, vv] of [[U0 + 0.6, V1 - 0.6], [U1 - 0.6, V0 + 0.6]]) crateAt(uu, vv, 'crate');
        break;
      }
      case 'lobby': {
        // reception desk across one end, sofas facing each other, plants
        const u = U0 + 1.4; if (ok(u, vc, 1.4)) { box(u - 0.35, vc - 1.6, u + 0.35, vc + 1.6, y, y + 1.05, 'woodDark', { top: 'counter' }); }
        sofaAt(uc - 3.4, 1, 'leather'); sofaAt(uc + 3.4, -1, 'leather');
        rugAt(uc - 1.6, vc - 1.4, uc + 1.6, vc + 1.4, 'carpetBlue');
        for (const [uu, vv] of [[U0 + 0.5, V0 + 0.5], [U0 + 0.5, V1 - 0.5], [U1 - 0.5, V0 + 0.5], [U1 - 0.5, V1 - 0.5]]) if (ok(uu, vv, 1.4)) { const [x, z] = xz(uu, vv); plant(x, z, y); }
        break;
      }
      case 'diner': case 'pizza': {
        // booths down one long wall, the counter and stools down the other
        for (const u of spots(2.5, 2.4)) {
          const v0 = V1 - 1.5; if (!ok(u, v0 + 0.7)) continue;
          box(u - 1.05, v0, u - 0.6, V1 - 0.1, y, y + 0.48, 'vinylRed'); box(u - 1.05, v0, u - 0.9, V1 - 0.1, y + 0.48, y + 1.1, 'vinylRed', { ao: false });
          box(u + 0.6, v0, u + 1.05, V1 - 0.1, y, y + 0.48, 'vinylRed'); box(u + 0.9, v0, u + 1.05, V1 - 0.1, y + 0.48, y + 1.1, 'vinylRed', { ao: false });
          dec(u - 0.45, v0 + 0.1, u + 0.45, V1 - 0.15, y + 0.72, y + 0.77, 'counter'); dec(u - 0.05, v0 + 0.6, u + 0.05, V1 - 0.6, y, y + 0.72, 'chrome');
          const [a, b] = xz(u - 0.5, v0 + 0.1), [c, d] = xz(u + 0.5, V1 - 0.15); solid(Math.min(a, c), y, Math.min(b, d), Math.max(a, c), y + 0.77, Math.max(b, d));
        }
        const c0 = U0 + 2.6, c1 = U1 - 2.6;
        if (c1 - c0 > 2 && ok((c0 + c1) / 2, V0 + 0.6, 1.0)) {
          box(c0, V0 + 0.15, c1, V0 + 0.85, y, y + 1.05, kind === 'pizza' ? 'brick' : 'paintCherry', { top: 'counter' });
          for (let u = c0 + 0.6; u < c1 - 0.3; u += 1.1) if (Math.abs(u - uc) > 1.3) { const [x, z] = xz(u, V0 + 1.35); stool(x, z, y); }
          dec(c0 + 0.4, V0 + 0.3, c0 + 1.2, V0 + 0.7, y + 1.05, y + 1.5, 'chrome');
        }
        if (kind === 'pizza' && ok(U1 - 1.0, V0 + 1.0, 1.6)) { const [x, z] = xz(U1 - 1.0, V0 + 1.0); L.box(x - 0.8, y, z - 0.8, x + 0.8, y + 0.9, z + 0.8, 'brick', { top: 'stone' }); K.sph('brick', x, y + 0.9, z, 0.75, 0.6, 0.75); K.sph('lampRed', x, y + 1.05, z + (ax ? 0.62 : 0), 0.18, 0.12, 0.05); solid(x - 0.8, y, z - 0.8, x + 0.8, y + 1.5, z + 0.8); }
        break;
      }
      case 'cafe': {
        const u = U0 + 1.2; if (ok(u, vc, 1.4)) { box(u - 0.4, vc - 1.8, u + 0.4, vc + 1.8, y, y + 1.0, 'woodDark', { top: 'counter' }); const [x, z] = xz(u, vc - 1.0); deco(x - 0.25, y + 1.0, z - 0.3, x + 0.25, y + 1.55, z + 0.3, 'chrome'); }
        for (const uu of spots(2.6, 3.2)) for (const vv of [V0 + 1.2, V1 - 1.2]) if (lv2 > 4.6 || vv < vc) tableSet(uu, vv, true);
        break;
      }
      case 'pharmacy': case 'store': {
        for (const u0 of spots(3.4, 2.6)) { rackAt(u0 - 1.4, u0 + 1.4, 1, 1.9, STOCK); if (lv2 > 4) rackAt(u0 - 1.4, u0 + 1.4, -1, 1.9, STOCK); }
        if (lv2 > 7) for (const u of spots(5, 4)) if (ok(u, vc - 1.9, 1.6)) islandRack(u - 1.6, u + 1.6, vc - 1.9, 1.5, STOCK);
        const u = U1 - 1.2; if (ok(u, vc + 1.8, 1.4)) box(u - 0.4, vc + 0.8, u + 0.4, vc + 2.8, y, y + 1.0, 'paintCream', { top: 'counter' });
        break;
      }
      case 'cosmetics': {
        // glass counters in islands, mannequins in the windows
        for (const u of spots(5, 3)) for (const v of [vc - 3.2, vc + 3.2]) if (v > V0 + 1.5 && v < V1 - 1.5 && ok(u, v, 1.8)) { box(u - 1.2, v - 0.4, u + 1.2, v + 0.4, y, y + 0.7, 'woodDark'); box(u - 1.2, v - 0.4, u + 1.2, v + 0.4, y + 0.7, y + 1.05, 'glassClear', { ao: false }); }
        for (const u of spots(4, 2.5)) if (ok(u, V0 + 1.2, 1.6)) { const [x, z] = xz(u, V0 + 1.2); K.mannequin(x, y, z, rnd() < 0.5); }
        break;
      }
      case 'clothes': {
        for (const u of spots(3.6, 2.6)) for (const v of [V0 + 1.0, vc - 2.6, vc + 2.6, V1 - 1.0]) if (v >= V0 + 1 && v <= V1 - 1 && ok(u, v, 1.7)) { const [a, b] = xz(u - 1.2, v), [c, d] = xz(u + 1.2, v); clothes(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d), y, rnd); }
        for (const [u, v] of [[uc - 2.6, vc], [uc + 2.6, vc]]) if (ok(u, v, 1.4)) { const [x, z] = xz(u, v); K.mannequin(x, y, z, u > uc); }
        break;
      }
      case 'furniture': {
        for (const u of spots(4.2, 2.8)) {
          if (ok(u, V0 + 0.6)) { sofaAt(u, 1, rnd() < 0.5 ? 'couch' : 'leather'); rugAt(u - 1.4, V0 + 1.1, u + 1.4, V0 + 2.6); }
          bedAt(u, -1);
        }
        break;
      }
      case 'books': {
        for (const u0 of spots(3, 2.4)) { rackAt(u0 - 1.3, u0 + 1.3, 1, 2.1, BOOKS, 'woodDark'); if (lv2 > 4.4) rackAt(u0 - 1.3, u0 + 1.3, -1, 2.1, BOOKS, 'woodDark'); }
        for (const [u, v] of [[uc - 3, vc], [uc + 3, vc]]) if (ok(u, v, 1.4)) { const [x, z] = xz(u, v); sofa(x - 0.45, z - 0.45, x + 0.45, z + 0.45, y, 'z-', 'leather'); }
        break;
      }
      case 'site': {
        // pallets of block, cement bags, a stack of rebar, work lights
        for (const u of spots(2.6, 1.8)) for (const v of [V0 + 0.9, V1 - 0.9]) if (ok(u, v, 1.6) && rnd() < 0.7) {
          const [x, z] = xz(u, v);
          deco(x - 0.6, y, z - 0.5, x + 0.6, y + 0.14, z + 0.5, 'wood');
          if (rnd() < 0.5) L.box(x - 0.5, y + 0.14, z - 0.42, x + 0.5, y + 0.9, z + 0.42, 'concreteDark'); else L.box(x - 0.5, y + 0.14, z - 0.42, x + 0.5, y + 0.62, z + 0.42, 'paintCream');
          solid(x - 0.6, y, z - 0.5, x + 0.6, y + 0.9, z + 0.5);
        }
        { const u = U1 - 1.2, v = vc; if (ok(u, v, 1.6)) { for (let i = 0; i < 10; i++) { const [a, b] = xz(u - 1.0, v - 0.4 + i * 0.09), [c, d] = xz(u + 1.0, v - 0.4 + i * 0.09); L.pipe('rust', a, y + 0.08 + (i % 3) * 0.05, b, c, y + 0.08 + (i % 3) * 0.05, d, 0.02); } } }
        break;
      }
      case 'clock': {
        // the works: a gear train behind every face, shafts to the hands
        const [x, z] = xz(uc, vc);
        L.box(x - 0.5, y, z - 0.5, x + 0.5, y + 1.3, z + 0.5, 'paintDark');
        gear(x, y + 1.6, z, 0.6, true); gear(x + 0.3, y + 1.0, z, 0.35, true);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.pipe('steel', x, y + 1.6, z, x + dx * 4, y + 1.8, z + dz * 4, 0.04);
        break;
      }
      case 'belfry': {
        // the bell hangs high enough to walk under; its headstock spans the room
        const [x, z] = xz(uc, vc);
        L.pipe('woodDark', ax ? X0 : x, y + 3.15, ax ? z : Z0, ax ? X1 : x, y + 3.15, ax ? z : Z1, 0.16);
        K.put('ttBronze', K.geo('cone'), x, y + 2.45, z, 0.95, 1.3, 0.95); K.sph('ttBronze', x, y + 3.0, z, 0.55, 0.35, 0.55);
        L.cyl('ttBronze', x, y + 1.85, z, 0.98, 0.1, 0, 0, false); K.sph('steel', x, y + 1.95, z, 0.16);
        solid(x - 0.95, y + 1.9, z - 0.95, x + 0.95, y + 3.3, z + 0.95, 'metal');
        break;
      }
    }
  }

  // ------------------------------------------------------------ building pieces outside
  /** Striped canvas awning sloping out from a wall over a shop window, with a valance. */
  function awning(f, p, q, y, m) {
    const d = 1.35, th = 0.3, len = q - p, b = T / 2 + d / 2 * Math.cos(th), yy = y - d / 2 * Math.sin(th), [x, z] = f.pt((p + q) / 2, b);
    if (f.ax) K.put(m, L.geo('box'), x, yy, z, len, 0.05, d, 0, f.out * th, 0); else K.put(m + 'V', L.geo('box'), x, yy, z, d, 0.05, len, 0, 0, -f.out * th);
    const vb = T / 2 + d * Math.cos(th), vy = y - d * Math.sin(th); f.deco(p, q, vb - 0.02, vb + 0.02, vy - 0.24, vy + 0.02, m);
    for (const a of [p + 0.05, q - 0.05]) { const p0 = f.pt(a, T / 2), p1 = f.pt(a, vb); L.pipe('paintDark', p0[0], y - 0.5, p0[1], p1[0], vy, p1[1], 0.02); }
  }
  function balcony(f, c, y) {
    f.box(c - 1.7, c + 1.7, T / 2, T / 2 + 1.5, y - 0.22, y, 'concrete', { top: 'terrazzo', bottom: true });
    f.railAlong(c - 1.7, c + 1.7, T / 2 + 1.45, y, 'paintDark');
    f.railAcross(T / 2 + 0.05, T / 2 + 1.5, c - 1.68, y, 'paintDark'); f.railAcross(T / 2 + 0.05, T / 2 + 1.5, c + 1.68, y, 'paintDark');
    f.deco(c - 1.65, c + 1.65, T / 2 + 1.43, T / 2 + 1.46, y + 0.05, y + 0.95, 'glassClear');
  }
  function waterTank(x, z, y) {
    for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) L.pipe('paintDark', x + dx, y, z + dz, x + dx * 0.85, y + 2.4, z + dz * 0.85, 0.08);
    L.box(x - 1.7, y + 2.3, z - 1.7, x + 1.7, y + 2.45, z + 1.7, 'paintDark', { bottom: true });
    L.cyl('wood', x, y + 3.85, z, 1.6, 2.8, 0, 0, false); W.addCyl(x, z, 1.6, y + 2.45, y + 5.25, { surf: 'wood' });
    for (const hy of [2.9, 3.8, 4.7]) L.cyl('steel', x, y + hy, z, 1.63, 0.06, 0, 0, true);
    K.put('woodDark', K.geo('cone'), x, y + 5.85, z, 1.75, 1.2, 1.75);
    solid(x - 1.4, y, z - 1.4, x + 1.4, y + 2.45, z + 1.4, 'metal');
    L.pipe('paintDark', x + 1.3, y, z, x + 1.3, y + 2.3, z, 0.05);
  }
  function antenna(x, z, y, h) {
    L.pipe('steel', x, y, z, x, y + h, z, 0.07); K.sph('lampRed', x, y + h + 0.1, z, 0.14);
    for (const [dx, dz] of [[1.6, 0], [-0.8, 1.4], [-0.8, -1.4]]) L.pipe('steel', x, y + h * 0.6, z, x + dx, y, z + dz, 0.015);
    for (let i = 1; i < 4; i++) L.pipe('steel', x - 0.5, y + h * (0.55 + i * 0.1), z, x + 0.5, y + h * (0.55 + i * 0.1), z, 0.025);
    solid(x - 0.1, y, z - 0.1, x + 0.1, y + h, z + 0.1, 'metal');
  }
  function dish(x, z, y, ry) {
    L.pipe('paintGrey', x, y, z, x, y + 0.9, z, 0.04);
    K.put('planeWhite', K.geo('sphere'), x + Math.sin(ry) * 0.12, y + 1.05, z + Math.cos(ry) * 0.12, 0.55, 0.55, 0.12, ry);
  }
  function billboard(x, z, y, ry, tex, w, h) {
    const nx = Math.sin(ry), nz = Math.cos(ry), ax = Math.abs(nz) > 0.5;
    for (const s of [-1, 1]) { const px = x + (ax ? s * w * 0.35 : 0), pz = z + (ax ? 0 : s * w * 0.35); L.pipe('paintDark', px, y, pz, px, y + h + 1.6, pz, 0.12); L.pipe('paintDark', px - nx * 1.2, y, pz - nz * 1.2, px, y + 1.6, pz, 0.06); }
    if (ax) L.box(x - w / 2 - 0.1, y + 1.5, z - 0.1, x + w / 2 + 0.1, y + h + 1.7, z + 0.1, 'paintDark', { noCol: true }); else L.box(x - 0.1, y + 1.5, z - w / 2 - 0.1, x + 0.1, y + h + 1.7, z + w / 2 + 0.1, 'paintDark', { noCol: true });
    K.plane(tex, w, h, x + nx * 0.11, y + 1.6 + h / 2, z + nz * 0.11, ry);
    L.box(x - (ax ? w / 2 : 0.6) + nx * 0.6, y + 1.2, z - (ax ? 0.6 : w / 2) + nz * 0.6, x + (ax ? w / 2 : 0.6) + nx * 0.6, y + 1.3, z + (ax ? 0.6 : w / 2) + nz * 0.6, 'grate', { bottom: true, noCol: true });
    if (ax) solid(x - w / 2, y, z - 0.15, x + w / 2, y + h + 1.7, z + 0.15, 'metal'); else solid(x - 0.15, y, z - w / 2, x + 0.15, y + h + 1.7, z + w / 2, 'metal');
  }

  /**
   * A town tower. o: { x0, z0, x1, z1, n: storeys, front: side of the street door and shopfront, coreWall 'n'|'s', coreEnd 'w'|'e',
   *   ext: facade, ground: ground-floor facade, base: plinth, bands: facade bands outright, trim: cornices, quoin: corner stones, inMat,
   *   inMat2: partition walls, floor: finish (or a list by storey), win: window width, pitch: window spacing, glassy: a curtain wall,
   *   balc: sides with balconies, fire: { side, p0 } an outside steel stair, shop: { sign, awning, signW } a shopfront, door: a plain
   *   front door, edit(side, k, holes, face): change a storey's openings, flights: storeys the stair climbs (all: out onto the roof
   *   through a hut), kinds: furniture by storey, chests: storeys with a chest, partition: false for open floors, wallsTo: walls only
   *   this many storeys up (a building site), roof(y): things on the roof }
   */
  function tower(o, rnd) {
    const n = o.n, H = n * FH, x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, flights = o.flights != null ? o.flights : n;
    const storeys = o.wallsTo != null ? o.wallsTo : n, wallTop = o.wallsTo != null ? o.wallsTo * FH : H;
    BLD.push([x0, z0, x1, z1, H]);
    // the scissor stair: lane A against the core wall, lane B beside it. Flight k climbs lane A (k even, toward a1) or lane B
    // (k odd, back toward a0); the slab above a flight is open over its lane, and the other lane carries the next flight
    const cw = o.coreWall || 'n', ce = o.coreEnd || 'w', sg = cw === 'n' ? 1 : -1, wz = cw === 'n' ? z0 + T / 2 : z1 - T / 2;
    const lane = (i) => { const p = wz + sg * 1.3 * i, q = wz + sg * 1.3 * (i + 1); return [Math.min(p, q), Math.max(p, q)]; };
    const LA = lane(0), LB = lane(1), laneOf = (k) => (k % 2 ? LB : LA), zMid = wz + sg * 1.3, zIn = wz + sg * 2.6;
    const a0 = ce === 'w' ? x0 + T / 2 + 1.4 : x1 - T / 2 - 6.2, a1 = a0 + 4.8;
    const core = [a0 - 1.4, Math.min(wz, zIn), a1 + 1.4, Math.max(wz, zIn)];
    const arrive = (k) => (k % 2 ? a0 : a1); // where flight k reaches the storey above
    const hut = flights === n && !o.noHut;
    const F = {}, holes = {}, busy = {}, SIDES = ['n', 's', 'w', 'e'];
    for (const s of SIDES) { F[s] = face(x0, z0, x1, z1, s); holes[s] = []; busy[s] = []; }
    busy[cw].push([core[0] - 0.3, core[2] + 0.3]);
    // the fire escape: the same scissor idea outside, lane B against the wall, lane A outboard; a door at every landing
    const fire = o.fire, fa0 = fire ? fire.p0 + 1.4 : 0, fa1 = fa0 + 4.8;
    if (fire) {
      busy[fire.side].push([fire.p0 - 0.3, fire.p0 + 7.9]);
      for (let j = 1; j < storeys; j++) { const d = (j - 1) % 2 ? [fa0 - 1.25, fa0 - 0.15] : [fa1 + 0.15, fa1 + 1.25]; holes[fire.side].push([d[0], d[1], j * FH, j * FH + 2.3, 'door']); }
    }
    // openings, storey by storey
    const pitch = o.pitch || 3.2, ww = o.glassy ? pitch - 0.5 : (o.win || 1.5);
    const free = (s, p, q) => !busy[s].some((b) => q > b[0] && p < b[1]);
    const back = { n: 's', s: 'n', w: 'e', e: 'w' }[o.front];
    for (const s of SIDES) {
      const f = F[s], len = f.a1 - f.a0, m = Math.max(1, Math.floor((len - 1.2) / pitch)), st = f.a0 + (len - m * pitch) / 2;
      for (let k = 0; k < storeys; k++) {
        const y = k * FH; let list = [];
        if (k === 0 && s === o.front && o.shop) {
          const nd = len > 24 ? 3 : 1, doors = [];
          for (let i = 0; i < nd; i++) { const c = f.a0 + len * (i + 0.5) / nd; doors.push([c - 1.1, c + 1.1]); }
          let p = f.a0 + 0.8;
          for (const d of doors) { if (d[0] - 0.3 - p > 1) list.push([p, d[0] - 0.3, 0.6, 2.7, 'shop']); list.push([d[0], d[1], G, 2.6, 'door']); p = d[1] + 0.3; }
          if (f.a1 - 0.8 - p > 1) list.push([p, f.a1 - 0.8, 0.6, 2.7, 'shop']);
        } else {
          for (let i = 0; i < m; i++) {
            const c = st + (i + 0.5) * pitch, p = c - ww / 2, q = c + ww / 2;
            if (!free(s, p - 0.2, q + 0.2)) continue;
            if (k > 0 && o.balc && o.balc.includes(s) && i % 2 === 0 && c - 1.8 > f.a0 && c + 1.8 < f.a1) list.push([c - 0.7, c + 0.7, y, y + 2.4, 'balc', c]);
            else if (o.glassy) list.push([p, q, y + 0.55, y + 3.1, 'glass', k === 0 || (i + k) % 3 ? 1 : 0]);
            else list.push([p, q, y + 0.95, y + 2.55]);
          }
          if (k === 0 && (s === back || (s === o.front && o.door))) { // a door where the middle window would be
            let bi = -1, bd = 1e9; list.forEach((h, i) => { const d = Math.abs((h[0] + h[1]) / 2 - (f.a0 + f.a1) / 2); if (d < bd) { bd = d; bi = i; } });
            const wd = s === back ? 0.6 : 1.0;
            if (bi >= 0) { const c = (list[bi][0] + list[bi][1]) / 2; list[bi] = [c - wd, c + wd, G, s === back ? 2.35 : 2.7, 'door']; }
          }
        }
        if (o.edit) list = o.edit(s, k, list, f) || list;
        holes[s].push(...list);
      }
    }
    // walls
    const OUT = o.bands || [[0, 0.7, o.base || 'stone'], [0.7, FH, o.ground || o.ext], [FH, H + 1.3, o.ext]], IN = [[0, H, o.inMat || 'wallClean']];
    for (const s of SIDES) { const f = F[s]; K.wall(f.axis, f.a0, f.a1, f.c, 0, wallTop, holes[s], OUT, IN, f.out, { noLeaf: true, shutter: o.shutter }); }
    // glass, balconies
    const doorPts = []; // per storey: door positions the furniture keeps clear of
    for (let k = 0; k < n; k++) doorPts.push([]);
    for (const s of SIDES) for (const h of holes[s]) {
      const f = F[s], k = Math.min(n - 1, Math.max(0, Math.floor((h[2] + 0.2) / FH)));
      if (h[4] === 'shop' || (h[4] === 'glass' && h[5])) {
        f.box(h[0], h[1], -0.03, 0.03, h[2], h[3], h[4] === 'shop' ? 'glassClear' : 'ttGlass', { shoot: false, ao: false });
        const mw = h[4] === 'shop' ? 1.9 : 1.0;
        for (let a = h[0] + mw; a < h[1] - 0.4; a += mw) f.deco(a - 0.04, a + 0.04, -0.07, 0.07, h[2], h[3], h[4] === 'shop' ? 'paintDark' : 'steel');
      }
      if (h[4] === 'balc') balcony(f, h[5], h[2]);
      if (h[4] === 'door' || h[4] === 'balc') doorPts[k].push(f.pt((h[0] + h[1]) / 2, 0));
    }
    // shopfront: awnings over the windows, the name over the door
    if (o.shop) {
      const f = F[o.front], mid = (f.a0 + f.a1) / 2, len = f.a1 - f.a0;
      if (o.shop.awning) for (const h of holes[o.front]) if (h[4] === 'shop' && h[2] < 1) awning(f, h[0] - 0.05, h[1] + 0.05, 2.82, o.shop.awning);
      if (o.shop.sign) { const p = f.pt(mid, T / 2 + 0.16), w = o.shop.signW || Math.min(len - 3, 7); R.wallSign(o.shop.sign, w, w * 0.156, p[0], 3.18 + (w * 0.156 - 0.62) / 2, p[1], f.ry); }
    }
    // floors and the stair
    const fl = (k) => (Array.isArray(o.floor) ? o.floor[k % o.floor.length] : o.floor || 'terrazzo');
    L.box(x0, 0, z0, x1, G, z1, fl(0), { ao: false });
    const sk = o.wallsTo != null;
    for (let j = 1; j <= n; j++) {
      const hole = j <= flights ? [a0, laneOf(j - 1)[0], a1, laneOf(j - 1)[1]] : null;
      holeSlab(x0, z0, x1, z1, j * FH, j === n ? (o.roofTop || 'concreteDark') : fl(j), hole, o.ceil || 'ceiling', sk ? 'concrete' : 'trim');
    }
    for (let k = 0; k < flights; k++) { const ln = laneOf(k); R.steps('x', a0, a1, ln[0] + 0.02, ln[1] - 0.02, lv(k), (k + 1) * FH, k % 2 ? -1 : 1, o.stair || 'concrete', o.stairTop || 'concreteDark'); }
    for (let j = 1; j <= flights; j++) {
      const y = j * FH, hl = laneOf(j - 1), dead = arrive(j - 1) === a1 ? a0 : a1;
      R.rail('x', a0, a1, zMid, y, 'paintDark');
      if (hl === LB && !(j === n && hut)) R.rail('x', a0, a1, zIn, y, 'paintDark');
      R.rail('z', hl[0], hl[1], dead, y, 'paintDark');
    }
    // the roof: a hut over the top flight, the parapet round the edge
    let hx0 = 0, hx1 = 0;
    const zc = cw === 'n' ? z0 : z1, zi = zIn + sg * T / 2, hz0 = Math.min(zc, zi), hz1 = Math.max(zc, zi);
    if (hut) {
      hx0 = ce === 'w' ? x0 : core[0] - T / 2; hx1 = ce === 'e' ? x1 : core[2] + T / 2;
      const y0 = H, y1 = H + 2.9, door = arrive(n - 1) === a1 ? [a1 + 0.15, a1 + 1.25] : [a0 - 1.25, a0 - 0.15];
      const HO = [[y0, y1 + 0.3, o.hutM || o.ext]], HI = [[y0, y1, 'concrete']];
      K.wall('x', hx0, hx1, zi, y0, y1, [[door[0], door[1], y0, y0 + 2.3]], HO, HI, sg, { noLeaf: true });
      K.wall('x', hx0, hx1, zc, y0, y1, [], HO, HI, -sg);
      K.wall('z', hz0, hz1, hx0, y0, y1, [], HO, HI, -1); K.wall('z', hz0, hz1, hx1, y0, y1, [], HO, HI, 1);
      L.box(hx0 - 0.25, y1, hz0 - 0.25, hx1 + 0.25, y1 + 0.25, hz1 + 0.25, 'concrete', { top: 'roofTin', bottom: true });
      K.roomLight((hx0 + hx1) / 2, y1, (hz0 + hz1) / 2);
    }
    if (!sk) {
      const par = (s, p, q) => { if (q - p > 0.05) F[s].box(p, q, -0.15, 0.15, H, H + (o.parH || 1.1), o.parM || o.ext, { top: 'concrete' }); };
      for (const s of SIDES) {
        const f = F[s], p = f.a0 + (f.ax ? -0.15 : 0.15), q = f.a1 + (f.ax ? 0.15 : -0.15);
        const cut = hut && (s === cw ? [hx0, hx1] : s === ce ? [hz0, hz1] : null);
        if (cut) { par(s, p, cut[0] - 0.1); par(s, cut[1] + 0.1, q); } else par(s, p, q);
      }
    }
    // facade dressing: cornices at the floor lines, a heavy one at the top, stone quoins at the corners, fins on glass
    const trim = o.trim || 'ttStone';
    const band = (y0, y1, d) => { for (const s of SIDES) { const f = F[s], e = f.ax ? T / 2 + d : T / 2; f.deco(f.a0 - e, f.a1 + e, T / 2 - 0.02, T / 2 + d, y0, y1, trim); } };
    if (o.cornice !== false) for (let k = 1; k < storeys; k++) band(k * FH - 0.1, k * FH + 0.12, 0.1);
    if (!sk) band(H - 0.42, H - 0.1, 0.26);
    if (o.quoin) for (const s of SIDES) { const f = F[s]; let i = 0; for (let y = 0.7; y < wallTop - 0.6; y += 0.5, i++) { const l = i % 2 ? 0.9 : 0.5; f.deco(f.a0 - T / 2, f.a0 - T / 2 + l, T / 2 - 0.02, T / 2 + 0.05, y, y + 0.44, o.quoin); f.deco(f.a1 + T / 2 - l, f.a1 + T / 2, T / 2 - 0.02, T / 2 + 0.05, y, y + 0.44, o.quoin); } }
    if (o.glassy) for (const s of SIDES) { const f = F[s], len = f.a1 - f.a0, m = Math.floor((len - 1.2) / pitch), st = f.a0 + (len - m * pitch) / 2; for (let i = 0; i <= m; i++) { const a = st + i * pitch; if (free(s, a - 0.1, a + 0.1)) f.deco(a - 0.06, a + 0.06, T / 2, T / 2 + 0.32, FH, H, 'steel'); } }
    // the fire escape: open steel flights, a grating landing and a door at every storey
    if (fire) {
      const f = F[fire.side], inL = [T / 2 + 0.05, T / 2 + 1.25], outL = [T / 2 + 1.25, T / 2 + 2.45];
      for (let k = 0; k < storeys - 1; k++) {
        const ln = k % 2 ? inL : outL, up = k % 2 ? -1 : 1, y0 = k * FH, y1 = (k + 1) * FH;
        f.steps(fa0, fa1, ln[0], ln[1], y0, y1, up);
        const lo = up > 0 ? fa0 : fa1, hi = up > 0 ? fa1 : fa0, rb = k % 2 ? T / 2 + 1.25 : T / 2 + 2.45, p0 = f.pt(lo, rb), p1 = f.pt(hi, rb);
        L.pipe('paintDark', p0[0], y0 + 1.0, p0[1], p1[0], y1 + 1.0, p1[1], 0.03);
        const e = up > 0 ? [fa1, fa1 + 1.4] : [fa0 - 1.4, fa0];
        f.box(e[0], e[1], T / 2, T / 2 + 2.45, y1 - 0.1, y1, 'grate', { bottom: true });
        f.railAlong(e[0], e[1], T / 2 + 2.45, y1, 'paintDark'); f.railAcross(T / 2, T / 2 + 2.45, up > 0 ? e[1] : e[0], y1, 'paintDark');
        f.railAlong(fa0, fa1, T / 2 + 2.45, y1, 'paintDark');
      }
      for (const a of [fire.p0, fire.p0 + 7.6]) { const p = f.pt(a, T / 2 + 2.45); L.pipe('paintDark', p[0], 0, p[1], p[0], (storeys - 1) * FH + 1.0, p[1], 0.05); }
    }
    // inside: a partition with two doors on the upper floors, furniture, lights, loot and chests
    const part = o.partition !== false && (ce === 'w' ? x1 - core[2] : core[0] - x0) > 9;
    const xm = ce === 'w' ? (core[2] + x1) / 2 : (x0 + core[0]) / 2;
    const zr = cw === 'n' ? [core[3] + 1.0, z1 - T / 2] : [z0 + T / 2, core[1] - 1.0]; // clear of the stair
    const chests = o.chests || [];
    for (let k = 0; k < n; k++) {
      const y = lv(k), yc = (k + 1) * FH - 0.25, kind = (o.kinds || [])[k] || o.kind || (sk ? 'site' : 'office'), rooms = [];
      const split = part && k > 0 && !(sk && k >= storeys);
      if (split) {
        K.wall('z', z0, z1, xm, k * FH, yc, [[z0 + 1.0, z0 + 2.2, k * FH, k * FH + 2.3], [z1 - 2.2, z1 - 1.0, k * FH, k * FH + 2.3]], null, [[k * FH, yc, o.inMat2 || 'wallpaper']], 0);
        const ra = ce === 'w' ? [x0 + T / 2, xm - T / 2] : [xm + T / 2, x1 - T / 2], rb = ce === 'w' ? [xm + T / 2, x1 - T / 2] : [x0 + T / 2, xm - T / 2];
        rooms.push({ x0: ra[0], z0: zr[0], x1: ra[1], z1: zr[1] }, { x0: rb[0], z0: z0 + T / 2, x1: rb[1], z1: z1 - T / 2 });
      } else rooms.push({ x0: x0 + T / 2, z0: zr[0], x1: x1 - T / 2, z1: zr[1] });
      const clear = doorPts[Math.min(k, n - 1)].slice();
      if (split) clear.push([xm, z0 + 1.6], [xm, z1 - 1.6]);
      const land = k === 0 ? a0 - 0.7 : arrive(k - 1) === a1 ? a1 + 0.7 : a0 - 0.7;
      clear.push([land, (wz + zIn) / 2], [land, zr[cw === 'n' ? 0 : 1]]);
      rooms.forEach((r) => furnish(kind, r, y, rnd, clear));
      rooms.forEach((r, i) => {
        const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, ax = r.x1 - r.x0 >= r.z1 - r.z0;
        K.roomLight(cx, yc, cz);
        loot(cx + (ax ? 1.1 : 0), y, cz + (ax ? 0 : 1.1));
        if (i === rooms.length - 1 && chests.includes(k)) chest(cx - (ax ? 0.9 : 0), y, cz - (ax ? 0 : 0.9), ax ? Math.PI / 2 : 0);
      });
      if (k % 2 === 1 && k <= flights) loot(land, y, (wz + zIn) / 2);
    }
    // the roof
    const ry0 = cw === 'n' ? Math.max(core[3] + 1.5, z0 + 3) : Math.min(core[1] - 1.5, z1 - 3);
    const spot = o.roofSpot !== undefined ? o.roofSpot : [(x0 + x1) / 2 + (ce === 'w' ? 2 : -2), (ry0 + (cw === 'n' ? z1 : z0)) / 2];
    if (!sk && spot) { loot(spot[0], H, spot[1]); if (chests.includes(n)) chest(spot[0] + (ce === 'w' ? -4 : 4), H, spot[1], 0); }
    if (o.roof) o.roof(H);
    return { core, xm, F, H };
  }

  // ------------------------------------------------------------ the clock tower and the plaza
  function clockTower(rnd) {
    const S = art(), x0 = -5, x1 = 5, z0 = -20, z1 = -10, cx = 0, cz = -15;
    const t = tower({
      x0, z0, x1, z1, n: 8, flights: 7, front: 's', coreWall: 'n', coreEnd: 'w', partition: false, roofSpot: null,
      bands: [[0, 0.9, 'ttStone'], [0.9, 6 * FH - 0.3, 'brick'], [6 * FH - 0.3, 8 * FH + 1.3, 'ttStone']], inMat: 'plaster', trim: 'ttStone', quoin: 'ttStone', parM: 'ttStone',
      win: 0.9, pitch: 3.0, floor: ['terrazzo', 'floorWood'], kinds: ['lobby', 'storage', 'office', 'storage', 'office', 'storage', 'clock', 'belfry'], chests: [3, 7],
      edit: (s, k, list, f) => {
        const m = (f.a0 + f.a1) / 2;
        if (k === 6) return [];
        if (k === 7) return [[m - 2.2, m + 2.2, 7 * FH + 1.0, 7 * FH + 3.1]];
        if (k === 0 && s === 's') return [[m - 1.1, m + 1.1, G, 3.0, 'door']];
        return list;
      }
    }, rnd);
    const H = t.H;
    // clock faces on all four sides, in stone surrounds with a bronze rim
    for (const s of ['n', 's', 'w', 'e']) {
      const f = t.F[s], m = (f.a0 + f.a1) / 2, y = 6 * FH + 1.8;
      f.deco(m - 2.15, m + 2.15, T / 2 - 0.02, T / 2 + 0.14, y - 2.0, y + 2.0, 'ttStone');
      const r = f.pt(m, T / 2 + 0.17); L.cyl('ttBronze', r[0], y, r[1], 1.92, 0.06, f.ax ? Math.PI / 2 : 0, f.ax ? 0 : Math.PI / 2);
      const p = f.pt(m, T / 2 + 0.21); K.plane(S.clock, 3.5, 3.5, p[0], y, p[1], f.ry, { circle: true });
      // the belfry arch gets a stone sill and keystone
      f.deco(m - 2.35, m + 2.35, T / 2 - 0.02, T / 2 + 0.2, 7 * FH + 0.85, 7 * FH + 1.02, 'ttStone');
      f.deco(m - 0.3, m + 0.3, T / 2 - 0.02, T / 2 + 0.12, 7 * FH + 2.9, 7 * FH + 3.45, 'ttStone');
    }
    // the spire, its finial and four pinnacles
    pyramid('ttCopper', cx, H + 0.25, cz, 4.4, 8.2);
    for (let i = 0; i < 4; i++) { const k = (i + 1) / 5, e = 4.4 * (1 - k); solid(cx - e, H, cz - e, cx + e, H + 0.25 + 8.2 * k, cz + e, 'metal'); }
    L.pipe('ttGold', cx, H + 8, cz, cx, H + 10.6, cz, 0.06); K.sph('ttGold', cx, H + 9.2, cz, 0.28); deco(cx - 0.9, H + 10.0, cz - 0.03, cx + 0.9, H + 10.08, cz + 0.03, 'ttGold');
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { L.box(px - 0.4, H + 1.1, pz - 0.4, px + 0.4, H + 1.6, pz + 0.4, 'ttStone'); pyramid('ttCopper', px, H + 1.6, pz, 0.4, 1.8); }
    // the entrance: a portico with two columns, the plaque, flagpoles
    for (const x of [-1.9, 1.9]) { L.cyl('ttStone', x, 1.75, z1 + 0.9, 0.26, 3.5, 0, 0, false); L.box(x - 0.35, 0, z1 + 0.55, x + 0.35, 0.3, z1 + 1.25, 'ttStone'); solid(x - 0.27, 0, z1 + 0.63, x + 0.27, 3.5, z1 + 1.17, 'concrete'); }
    L.box(-2.5, 3.5, z1, 2.5, 4.0, z1 + 1.4, 'ttStone', { bottom: true });
    R.wallSign(S.townHall, 2.6, 0.4, 0, 3.75, z1 + 1.42, 0);
    for (const x of [-7.5, 7.5]) { L.pipe('chrome', x, 0, z1 + 1.5, x, 9, z1 + 1.5, 0.06); K.sph('ttGold', x, 9.1, z1 + 1.5, 0.12); K.plane(S.flag, 1.6, 1.0, x + (x < 0 ? -0.82 : 0.82), 8.3, z1 + 1.5, 0, { double: true }); solid(x - 0.08, 0, z1 + 1.42, x + 0.08, 9, z1 + 1.58, 'metal'); }
  }
  function fountain(cx, cz) {
    L.cyl('ttStone', cx, 0.275, cz, 4.6, 0.55, 0, 0, false); W.addCyl(cx, cz, 4.6, 0, 0.55, { surf: 'concrete' });
    K.put('ttWater', K.discGeo(0, 4.25, 1 / 4), cx, 0.57, cz, 1, 1, 1);
    K.put('ttStone', K.discGeo(4.2, 4.75, 1 / 2), cx, 0.6, cz, 1, 1, 1);
    L.cyl('ttStone', cx, 1.2, cz, 0.55, 1.4, 0, 0, false);
    K.sph('ttStone', cx, 1.9, cz, 1.7, 0.32, 1.7); K.put('ttWater', K.discGeo(0, 1.5, 1 / 4), cx, 2.12, cz, 1, 1, 1);
    L.cyl('ttStone', cx, 2.6, cz, 0.3, 1.0, 0, 0, false); K.sph('ttStone', cx, 3.1, cz, 0.85, 0.18, 0.85); K.put('ttWater', K.discGeo(0, 0.72, 1 / 4), cx, 3.22, cz, 1, 1, 1);
    K.sph('ttGold', cx, 3.5, cz, 0.22, 0.3, 0.22);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; L.pipe('ttWater', cx + Math.cos(a) * 1.5, 2.0, cz + Math.sin(a) * 1.5, cx + Math.cos(a) * 2.6, 0.6, cz + Math.sin(a) * 2.6, 0.05); }
    W.addCyl(cx, cz, 0.7, 0.55, 3.2, { surf: 'concrete' });
  }
  function bench(x, z, alongX) {
    const hx = alongX ? 0.9 : 0.25, hz = alongX ? 0.25 : 0.9;
    for (let i = 0; i < 3; i++) { const o = -0.18 + i * 0.13; deco(x - hx + (alongX ? 0 : o), 0.42, z - hz + (alongX ? o : 0), x - hx + (alongX ? 2 * hx : o + 0.1), 0.47, z - hz + (alongX ? o + 0.1 : 2 * hz), 'wood'); }
    for (const s of [-1, 1]) deco(x + (alongX ? s * (hx - 0.1) : -0.22), 0, z + (alongX ? -0.22 : s * (hz - 0.1)), x + (alongX ? s * (hx - 0.1) + 0.06 : 0.22), 0.45, z + (alongX ? 0.22 : s * (hz - 0.1) + 0.06), 'paintDark');
    solid(x - hx, 0, z - hz, x + hx, 0.48, z + hz);
  }
  function plaza(rnd) {
    const S = art();
    deco(-20, 0.04, -9, 20, 0.10, 20, 'stone'); deco(-20, 0.04, -20, -6, 0.10, -9, 'stone'); deco(6, 0.04, -20, 20, 0.10, -9, 'stone');
    deco(-1.6, 0.1, -9.6, 1.6, 0.16, -1, 'terrazzo'); // the walk from the fountain to the tower door
    fountain(0, 6);
    // trees in grates, benches round the fountain, lamps
    for (const [x, z] of [[-15, -14], [15, -14], [-15, 0], [15, 0], [-15, 15], [15, 15], [-6, 17], [6, 17]]) { deco(x - 1, 0.1, z - 1, x + 1, 0.16, z + 1, 'grate'); R.oak(x, z, 3.4 + rnd() * 0.8, 1.9, rnd); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * 7.2, z = 6 + Math.sin(a) * 7.2; bench(x, z, Math.abs(Math.sin(a)) > 0.7); }
    for (const [x, z] of [[-9, -6], [9, -6], [-9, 18], [9, 18]]) R.lampPost(x, z, 5.5);
    // flower beds
    for (const [x0, z0, x1, z1] of [[-19, 3, -17, 12], [17, 3, 19, 12]]) {
      L.box(x0, 0, z0, x1, 0.45, z1, 'ttStone', { top: 'dirt' });
      for (let x = x0 + 0.4; x < x1; x += 0.6) for (let z = z0 + 0.4; z < z1; z += 0.6) K.sph(['paintCherry', 'paintTaxi', 'planeWhite', 'leaves', 'paintBlue'][(rnd() * 5) | 0], x + (rnd() - 0.5) * 0.2, 0.55, z + (rnd() - 0.5) * 0.2, 0.18 + rnd() * 0.08);
    }
    // the bronze llama on its plinth
    { const lx = 0, lz = 16.5;
      L.box(lx - 1.4, 0, lz - 1.4, lx + 1.4, 1.2, lz + 1.4, 'ttStone', { top: 'ttStone' });
      R.wallSign(S.plaza, 2.6, 0.5, lx, 0.62, lz + 1.42, 0);
      const y = 1.2;
      K.sph('ttBronze', lx, y + 1.25, lz, 0.55, 0.45, 0.85);
      for (const [dx, dz] of [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]]) L.cyl('ttBronze', lx + dx, y + 0.45, lz + dz, 0.1, 0.9, 0, 0, true);
      L.cyl('ttBronze', lx, y + 1.95, lz - 0.62, 0.16, 1.0, 0.3, 0, true); K.sph('ttBronze', lx, y + 2.5, lz - 0.85, 0.24, 0.22, 0.34);
      for (const s of [-1, 1]) L.cyl('ttBronze', lx + s * 0.1, y + 2.8, lz - 0.8, 0.04, 0.25, 0, s * 0.2, true);
      solid(lx - 0.6, y, lz - 1.0, lx + 0.6, y + 2.9, lz + 0.9, 'metal');
    }
    // kiosks: a newsstand and an ice-cream cart
    { const x = -12, z = 9; L.box(x - 1.2, 0, z - 0.9, x + 1.2, 2.4, z + 0.9, 'paintGreen', { top: 'roofTin' }); deco(x - 1.0, 0.9, z + 0.9, x + 1.0, 2.0, z + 0.93, 'glassDay'); deco(x - 1.4, 2.4, z - 1.1, x + 1.4, 2.55, z + 1.4, 'paintDark'); for (let i = 0; i < 6; i++) deco(x - 1.0 + i * 0.34, 0.6, z + 0.93, x - 0.72 + i * 0.34, 0.95, z + 1.05, CLOTH[i % CLOTH.length]); }
    { const x = 12, z = 9; L.box(x - 1.0, 0.35, z - 0.6, x + 1.0, 1.3, z + 0.6, 'planeWhite'); K.wheels(x - 0.6, x + 0.6, z - 0.62, z + 0.62, 0.3); L.pipe('chrome', x, 1.3, z, x, 2.6, z, 0.04); K.put('ttAwnRedV', K.geo('cone'), x, 2.75, z, 1.3, 0.5, 1.3); solid(x - 1.0, 0, z - 0.6, x + 1.0, 1.3, z + 0.6, 'metal'); }
    // a phone booth
    { const x = 18.5, z = -7; L.box(x - 0.55, 0, z - 0.55, x + 0.55, 2.4, z + 0.55, 'paintCherry', { top: 'paintCherry' }); deco(x - 0.45, 0.5, z + 0.55, x + 0.45, 2.1, z + 0.58, 'glassDay'); deco(x - 0.4, 2.15, z + 0.56, x + 0.4, 2.35, z + 0.59, 'planeWhite'); }
    loot(-6, 0.08, 2); loot(6, 0.08, 11); loot(-12, 0.08, -4); loot(12, 0.08, 16); loot(-17, 0.08, -18); chest(0, 0.08, 12.6, 0);
  }

  // ------------------------------------------------------------ the towers round the plaza
  function towers(rnd) {
    const S = art();
    // ---- Tower A: eight storeys of brick, Pizza Pit downstairs, the fire escape on the west side
    tower({
      x0: -18, z0: -52, x1: -2, z1: -34, n: 8, front: 's', coreWall: 'n', coreEnd: 'e', ext: 'brick', ground: 'ttStone', trim: 'ttStone', quoin: 'ttStone', inMat2: 'wallpaper',
      floor: ['checker', 'floorWood', 'carpetBlue', 'floorWood', 'carpetBeige'], fire: { side: 'w', p0: -46 }, shop: { sign: S.pizza, awning: 'ttAwnRed' },
      kinds: ['pizza', 'office', 'apt', 'office', 'apt', 'loft', 'office', 'storage'], chests: [2, 5, 8],
      roof: (y) => { waterTank(-14, -44, y); antenna(-6, -38, y, 9); P('ac', -10, -37.5, 0, y); P('vent', -15, -37, 0, y); }
    }, rnd);
    // ---- Vertex: a glass office block, six storeys, a helipad on the roof
    tower({
      x0: 2, z0: -54, x1: 18, z1: -34, n: 6, front: 's', coreWall: 'n', coreEnd: 'w', glassy: true, pitch: 2.4, ext: 'ttPanel', ground: 'ttPanel', base: 'ttGranite', trim: 'steel', parM: 'ttPanel', hutM: 'ttPanel',
      floor: ['terrazzo', 'carpetBlue', 'carpetBeige'], ceil: 'ceilTile', shop: { sign: S.vertex }, kinds: ['lobby', 'office', 'office', 'office', 'office', 'office'], chests: [3, 5],
      roof: (y) => { R.flat(S.helipad, 8, 8, 12, y + 0.02, -42); for (const [x, z] of [[6, -37], [16, -37]]) P('ac', x, z, 0, y); for (let i = 0; i < 6; i++) K.sph(i % 2 ? 'lampRed' : 'lampWarm', 8 + (i % 3) * 4, y + 0.1, i < 3 ? -46.2 : -37.8, 0.1); }
    }, rnd);
    // ---- Maple Court: five storeys of apartments with balconies round two sides
    const mc = tower({
      x0: -64, z0: -60, x1: -40, z1: -38, n: 5, front: 's', coreWall: 'n', coreEnd: 'w', ext: 'ttCream', ground: 'ttBrickDark', trim: 'trim', balc: ['s', 'e'], door: true,
      floor: ['terrazzo', 'floorWood', 'carpet'], inMat2: 'wallpaper2', kinds: ['lobby', 'apt', 'apt', 'apt', 'apt'], chests: [1, 3, 5],
      roof: (y) => { waterTank(-48, -44, y); dish(-44, -41, y, 2.4); dish(-46, -41, y, 2.4); P('ac', -54, -42, 0, y); }
    }, rnd);
    { const f = mc.F.s, p = f.pt(-52, T / 2 + 0.05); R.wallSign(S.maple, 2.8, 0.44, p[0], 3.2, p[1], 0); L.box(-54, 2.9, -38, -50, 3.1, -36.6, 'paintDark', { bottom: true }); }
    // ---- Durr Burger: three storeys, the diner downstairs, the burger on the roof
    tower({
      x0: -50, z0: -18, x1: -34, z1: -3, n: 3, front: 'e', coreWall: 'n', coreEnd: 'w', ext: 'ttOchre', ground: 'brick', trim: 'planeWhite',
      floor: ['checker', 'floorWood', 'concrete'], shop: { sign: S.burger, awning: 'ttAwnYellow' }, kinds: ['diner', 'apt', 'storage'], chests: [0, 2], roofSpot: [-46, -7],
      roof: (y) => burger(-40.5, -9, y)
    }, rnd);
    // ---- the pharmacy: four storeys, balconies on the street
    tower({
      x0: -50, z0: 3, x1: -34, z1: 18, n: 4, front: 'e', coreWall: 's', coreEnd: 'w', ext: 'ttTeal', ground: 'ttStone', trim: 'ttStone', balc: ['e'],
      floor: ['terrazzo', 'floorWood', 'carpetBeige'], shop: { sign: S.pharm, awning: 'ttAwnGreen' }, kinds: ['pharmacy', 'office', 'apt', 'apt'], chests: [1, 3],
      roof: (y) => { P('ac', -38, 6, 0, y); P('vent', -46, 6, 0, y); dish(-36, 12, y, Math.PI / 2); }
    }, rnd);
    // ---- Hotel Tilted: seven storeys facing East Street, a fire escape on the car park side
    tower({
      x0: 36, z0: -16, x1: 54, z1: 4, n: 7, front: 'w', coreWall: 'n', coreEnd: 'e', ext: 'ttSand', ground: 'ttGranite', trim: 'ttStone', quoin: 'ttStone', fire: { side: 's', p0: 38 },
      floor: ['terrazzo', 'carpetBlue', 'carpet'], inMat2: 'wallpaper2', shop: { sign: S.hotel }, kinds: ['lobby', 'hotel', 'hotel', 'hotel', 'hotel', 'hotel', 'hotel'], chests: [2, 4, 6, 7],
      roof: (y) => { hotelSign(45, -0.5, y); P('ac', 40, -8, 0, y); P('ac', 40, -3, 0, y); }
    }, rnd);
    // ---- Tower B: six storeys of dark brick lofts over a bookshop, the fire escape on the east side, a billboard
    tower({
      x0: -62, z0: 38, x1: -44, z1: 54, n: 6, front: 'n', coreWall: 's', coreEnd: 'w', ext: 'ttBrickDark', ground: 'ttGranite', trim: 'ttStone', win: 2.0, pitch: 3.4, fire: { side: 'e', p0: 40 },
      floor: ['floorWood', 'floorWood', 'concrete'], shop: { sign: S.books, awning: 'ttAwnGreen' }, kinds: ['books', 'loft', 'loft', 'office', 'loft', 'storage'], chests: [1, 3, 5, 6],
      roof: (y) => { billboard(-53, 42.5, y, Math.PI, S.cola, 9, 3.4); waterTank(-48, 47, y); }
    }, rnd);
    // ---- the Grand Mercantile: three wide storeys, open floors
    tower({
      x0: -18, z0: 34, x1: 18, z1: 54, n: 3, front: 'n', coreWall: 's', coreEnd: 'e', partition: false, ext: 'ttStone', ground: 'ttGranite', trim: 'trim', quoin: 'trim', pitch: 3.6, win: 2.2,
      floor: ['terrazzo', 'carpetBeige', 'floorWood'], ceil: 'ceilTile', shop: { sign: S.merc, awning: 'ttAwnRed', signW: 10 }, kinds: ['cosmetics', 'clothes', 'furniture'], chests: [0, 1, 2, 3],
      roof: (y) => { for (const x of [-13, -7, 8, 14]) { deco(x - 2, y, 40, x + 2, y + 0.45, 46, 'glassDay'); solid(x - 2, y, 40, x + 2, y + 0.45, 46, 'metal'); } P('ac', -15, 50, 0, y); P('ac', 0, 50, 0, y); P('vent', 6, 38, 0, y); }
    }, rnd);
    // ---- Tower C: six white storeys with balconies, a café downstairs
    tower({
      x0: 38, z0: 38, x1: 56, z1: 56, n: 6, front: 'n', coreWall: 's', coreEnd: 'e', ext: 'ttWhite', ground: 'ttBlue', trim: 'ttBlue', balc: ['w', 'e'],
      floor: ['terrazzo', 'floorWood', 'carpetBlue'], shop: { sign: S.cafe, awning: 'ttAwnBlue' }, kinds: ['cafe', 'apt', 'office', 'apt', 'apt', 'apt'], chests: [2, 4, 6],
      roof: (y) => { dish(40, 41, y, Math.PI); dish(42, 41, y, Math.PI); P('ac', 50, 41, 0, y); antenna(54, 40, y, 6); }
    }, rnd);
  }
  /** Durr Burger's giant burger (you can stand on the bun). */
  function burger(x, z, y) {
    L.box(x - 1.2, y, z - 1.2, x + 1.2, y + 0.8, z + 1.2, 'paintDark');
    const b = y + 0.8;
    L.cyl('ttBun', x, b + 0.35, z, 3.0, 0.7, 0, 0, false);
    L.cyl('ttPatty', x, b + 0.95, z, 3.15, 0.5, 0, 0, false);
    L.box(x - 2.4, b + 1.2, z - 2.4, x + 2.4, b + 1.28, z + 2.4, 'ttCheese', { noCol: true }); K.put('ttCheese', L.geo('box'), x, b + 1.24, z, 4.4, 0.08, 4.4, Math.PI / 4);
    L.cyl('ttLettuce', x, b + 1.36, z, 3.25, 0.14, 0, 0, false);
    L.cyl('ttTomato', x, b + 1.5, z, 2.9, 0.16, 0, 0, false);
    K.sph('ttBun', x, b + 1.6, z, 3.05, 1.6, 3.05);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 0.6 + (i % 5) * 0.45, yy = b + 1.6 + 1.6 * Math.sqrt(Math.max(0, 1 - (r / 3.05) ** 2)); K.sph('ttSesame', x + Math.cos(a) * r, yy, z + Math.sin(a) * r, 0.12, 0.06, 0.08); }
    W.addCyl(x, z, 3.0, b, b + 1.6, { surf: 'wood' }); W.addCyl(x, z, 2.4, b + 1.6, b + 2.6, { surf: 'wood' }); W.addCyl(x, z, 1.4, b + 2.6, b + 3.1, { surf: 'wood' });
    loot(x, b + 3.1, z);
  }
  function hotelSign(x, z, y) {
    for (const dx of [-3.5, 3.5]) { L.pipe('paintDark', x + dx, y, z, x + dx, y + 3.4, z, 0.1); L.pipe('paintDark', x + dx, y, z - 1.2, x + dx, y + 2, z, 0.05); }
    L.box(x - 4.4, y + 2.0, z - 0.1, x + 4.4, y + 3.5, z + 0.1, 'paintCherry', { noCol: true });
    K.plane(art().hotel, 8.6, 1.34, x, y + 2.75, z + 0.11, 0); K.plane(art().hotel, 8.6, 1.34, x, y + 2.75, z - 0.11, Math.PI);
    for (let i = 0; i < 9; i++) K.sph('lampWarm', x - 4.2 + i * 1.05, y + 3.6, z, 0.07);
    solid(x - 4.4, y, z - 0.15, x + 4.4, y + 3.5, z + 0.15, 'metal');
  }
  function hotelGrounds(rnd) {
    // the entrance canopy on East Street, a red carpet, potted trees
    L.box(32.6, 2.65, -8.6, 35.9, 2.85, -3.4, 'paintDark', { bottom: true }); deco(32.55, 2.65, -8.65, 32.65, 2.87, -3.35, 'ttGold');
    for (const z of [-8.3, -3.7]) { L.cyl('ttGold', 32.9, 1.33, z, 0.07, 2.65, 0, 0, true); solid(32.8, 0, z - 0.1, 33.0, 2.65, z + 0.1, 'metal'); }
    for (let i = 0; i < 5; i++) K.sph('lampWarm', 33.1 + i * 0.6, 2.63, -6, 0.08);
    deco(32.4, 0.04, -7, 36, 0.1, -5, 'vinylRed');
    for (const z of [-10, -2]) plant(34.5, z, 0);
    // the pool behind
    const d = (x0, z0, x1, z1) => L.box(x0, 0, z0, x1, 0.5, z1, 'terrazzo', { top: 'terrazzo' });
    d(56.5, -15.5, 69.5, -13.5); d(56.5, -2.5, 69.5, -0.5); d(56.5, -13.5, 58.5, -2.5); d(65.5, -13.5, 69.5, -2.5);
    deco(58.5, 0.04, -13.5, 65.5, 0.1, -2.5, 'ttPool');
    K.put('ttWater', L.geo('box'), 62, 0.4, -8, 7, 0.02, 11);
    for (let i = 0; i < 3; i++) { const z = -11 + i * 3; L.box(66.0, 0.5, z - 0.35, 68.5, 0.75, z + 0.35, 'planeWhite'); L.box(67.9, 0.75, z - 0.35, 68.5, 1.2, z + 0.35, 'planeWhite', { ao: false }); }
    for (const [x, z] of [[57.5, -14.5], [68.5, -1.5]]) { L.pipe('chrome', x, 0.5, z, x, 3.0, z, 0.04); K.put('ttAwnBlueV', K.geo('cone'), x, 3.1, z, 1.6, 0.6, 1.6); }
    // diving board and a ladder
    L.box(60.8, 0.5, -2.5, 63.2, 0.6, -0.8, 'planeWhite'); L.box(61.4, 0.6, -5.2, 62.6, 0.68, -2.5, 'planeWhite', { noCol: true });
    K.hedge(56, -20, 70, -19, 1.4); K.hedge(70, -20, 71, 4, 1.4);
    loot(62, 0.05, -8); chest(63, 0.05, -18, Math.PI);
    // the car park south of the hotel
    deco(34, 0.04, 8, 70, 0.10, 20, 'asphalt');
    for (let x = 36; x <= 68; x += 2.8) { deco(x - 0.06, 0.1, 8.4, x + 0.06, 0.16, 12.6, 'lineWhite'); deco(x - 0.06, 0.1, 15.4, x + 0.06, 0.16, 19.6, 'lineWhite'); }
    const paints = ['paintBlue', 'paintCherry', 'paintMint', 'paintCream', 'paintTaxi', 'planeWhite', 'paintGreen'];
    [37.4, 43, 48.6, 57, 62.6].forEach((x, i) => { if (rnd() < 0.85) K.car(x, 10.5, false, paints[i % paints.length], false); });
    [40.2, 51.4, 59.8, 65.4].forEach((x, i) => { if (rnd() < 0.85) K.car(x, 17.5, false, paints[(i + 3) % paints.length], true); });
    for (const x of [45, 60]) R.lampPost(x, 14, 7);
    loot(46, 0.07, 14); loot(66, 0.07, 14);
  }

  // ------------------------------------------------------------ the building site
  function site(rnd) {
    const S = art(), x0 = 38, z0 = -64, x1 = 58, z1 = -44, n = 7;
    deco(32, 0.04, -72, 72, 0.10, -32, 'gravel');
    const t = tower({
      x0, z0, x1, z1, n, wallsTo: 2, noHut: true, front: 's', coreWall: 'n', coreEnd: 'e', partition: false, ext: 'concrete', ground: 'concrete', base: 'concreteDark', trim: 'concrete', cornice: false,
      bands: [[0, 0.5, 'concreteDark'], [0.5, 2 * FH, 'ttBlock']], inMat: 'ttBlock', floor: ['concreteDark', 'concrete'], ceil: 'concrete', stair: 'concrete', chests: [3, 6],
      edit: (s, k, list, f) => (k === 0 && (s === 's' || s === 'w') ? [[f.a0 + 2, f.a1 - 2, G, 3.2]] : list)
    }, rnd);
    const H = t.H;
    loot(44, H, -50); loot(54, H, -48); chest(42, H, -58, Math.PI / 2);
    // columns on every storey, rebar sticking out of the top slab
    for (let k = 0; k < n; k++) {
      const y0 = k * FH, y1 = (k + 1) * FH - 0.25;
      for (let x = x0; x <= x1 + 0.01; x += 5) for (const z of [z0, z1]) if (k >= 2 || x === x0 || x === x1) { L.box(x - 0.2, y0, z - 0.2, x + 0.2, y1, z + 0.2, 'concrete'); }
      for (let z = z0 + 5; z < z1; z += 5) for (const x of [x0, x1]) if (k >= 2) L.box(x - 0.2, y0, z - 0.2, x + 0.2, y1, z + 0.2, 'concrete');
      if (k >= 2) for (const [x, z] of [[x0 + 10, z0 + 10]]) L.box(x - 0.25, y0, z - 0.25, x + 0.25, y1, z + 0.25, 'concrete');
    }
    for (let x = x0; x <= x1 + 0.01; x += 5) for (const z of [z0, z1]) for (const dx of [-0.1, 0.1]) L.pipe('rust', x + dx, H, z, x + dx, H + 1.2, z, 0.02);
    for (let z = z0 + 5; z < z1; z += 5) for (const x of [x0, x1]) for (const dz of [-0.1, 0.1]) L.pipe('rust', x, H, z + dz, x, H + 1.2, z + dz, 0.02);
    // orange safety rails round some edges of the open storeys (the others are open: glide straight in)
    for (let k = 2; k < n; k++) { const y = k * FH; R.rail('x', x0 + 0.3, x0 + 9.5, z1 - 0.1, y, 'ttOrange'); R.rail('z', z0 + 0.3, z0 + 9.5, x1 - 0.1, y, 'ttOrange'); }
    R.rail('x', x0 + 0.3, x1 - 0.3, z1 - 0.1, H, 'ttOrange');
    // scaffolding up the south face: tubes, plank decks, braces
    const sf = face(x0, z0, x1, z1, 's');
    for (let a = x0 + 1; a <= x1 - 1 + 0.01; a += 2.5) for (const b of [T / 2 + 0.3, T / 2 + 1.5]) { const p = sf.pt(a, b); L.pipe('steel', p[0], 0, p[1], p[0], (n - 1) * FH + 1.1, p[1], 0.04); }
    for (let k = 1; k < n; k++) {
      const y = k * FH;
      sf.box(x0 + 1, x1 - 1, T / 2 + 0.2, T / 2 + 1.6, y - 0.06, y, 'plywood', { bottom: true });
      for (const b of [T / 2 + 0.3, T / 2 + 1.5]) { const p0 = sf.pt(x0 + 1, b), p1 = sf.pt(x1 - 1, b); for (const dy of [0.5, 1.0]) L.pipe('steel', p0[0], y + dy, p0[1], p1[0], y + dy, p1[1], 0.03); }
      W.add(x0 + 1, y, z1 + T / 2 + 1.55, x1 - 1, y + 1.05, z1 + T / 2 + 1.6, { shoot: false });
      for (let a = x0 + 1; a < x1 - 2; a += 5) { const p0 = sf.pt(a, T / 2 + 1.55), p1 = sf.pt(a + 2.5, T / 2 + 1.55); L.pipe('steel', p0[0], y - FH + 0.1, p0[1], p1[0], y - 0.1, p1[1], 0.025); }
    }
    // a ladder up the scaffold (it's for show: take the stair inside)
    for (let y = 0.3; y < FH * 1.5; y += 0.3) deco(x1 - 2.2, y, z1 + T / 2 + 0.85, x1 - 1.6, y + 0.04, z1 + T / 2 + 0.95, 'steel');
    // the tower crane
    crane(64, -55, 44);
    // the fence and its gates, the hoarding
    const fence = (ax, a0, a1, c) => {
      if (ax) { deco(a0, 0, c - 0.02, a1, 2.2, c + 0.02, 'lattice'); W.add(a0, 0, c - 0.05, a1, 2.2, c + 0.05, { shoot: false }); for (let a = a0; a <= a1 + 0.01; a += 3) L.pipe('steel', a, 0, c, a, 2.3, c, 0.04); }
      else { deco(c - 0.02, 0, a0, c + 0.02, 2.2, a1, 'lattice'); W.add(c - 0.05, 0, a0, c + 0.05, 2.2, a1, { shoot: false }); for (let a = a0; a <= a1 + 0.01; a += 3) L.pipe('steel', c, 0, a, c, 2.3, a, 0.04); }
    };
    fence(true, 33.5, 44, -33.5); fence(true, 52, 71, -33.5); fence(false, -71, -52, 33.5); fence(false, -44, -33.5, 33.5); fence(true, 33.5, 71, -71); fence(false, -71, -33.5, 71);
    for (const x of [38.5, 61]) { deco(x - 4.6, 0.3, -33.48, x + 4.6, 2.1, -33.4, 'planeWhite'); K.plane(S.site, 9, 2.25, x, 1.2, -33.38, 0); }
    // site office (two containers, one on the other, an outside stair), porta-potties
    const cont = (x, z, ry, y, m) => { L.propBox(m, x, y || 0, z, 6.1, 2.6, 2.44, ry); const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = (6.1 * c + 2.44 * s) / 2, hd = (6.1 * s + 2.44 * c) / 2; solid(x - hw, y || 0, z - hd, x + hw, (y || 0) + 2.6, z + hd, 'metal'); };
    cont(63, -38, 0, 0, 'cont_blue'); cont(63, -38, 0, 2.6, 'cont_green');
    R.steps('x', 50.8, 59.85, -37.7, -36.5, 0, 5.2, 1, 'paintDark', 'grate');
    deco(61, 0.6, -36.77, 63.6, 2.0, -36.74, 'glassDay'); deco(61, 3.2, -36.77, 63.6, 4.6, -36.74, 'glassDay');
    loot(63, 5.2, -38); chest(65.5, 5.2, -38, Math.PI);
    for (let i = 0; i < 3; i++) { const x = 67.2 + i * 1.2; L.box(x - 0.55, 0, -45.5, x + 0.55, 2.3, -44.4, 'paintBlue', { top: 'planeWhite' }); deco(x - 0.4, 0.1, -44.38, x + 0.4, 2.0, -44.36, 'planeWhite'); }
    // materials: block pallets, concrete pipes, the rebar pile, a sand heap
    for (const [x, z] of [[36, -40], [37.6, -40], [36, -41.6], [52, -40], [53.6, -40]]) { deco(x - 0.7, 0, z - 0.6, x + 0.7, 0.14, z + 0.6, 'wood'); L.box(x - 0.6, 0.14, z - 0.5, x + 0.6, 1.0, z + 0.5, 'ttBlock'); solid(x - 0.7, 0, z - 0.6, x + 0.7, 1.0, z + 0.6); }
    for (let i = 0; i < 3; i++) { const z = -68 + i * 1.6; L.cyl('concrete', 45, 0.7, z, 0.72, 2.6, 0, Math.PI / 2, false); } solid(43.7, 0, -68.8, 46.3, 1.42, -64.4, 'concrete');
    for (let i = 0; i < 18; i++) L.pipe('rust', 34, 0.15 + (i % 3) * 0.06, -66 + i * 0.07, 42, 0.15 + (i % 3) * 0.06, -66 + i * 0.07, 0.022);
    for (const x of [35, 41]) deco(x - 0.1, 0, -66.2, x + 0.1, 0.14, -64.6, 'woodDark');
    K.put('sand', K.blobGeo(1), 52, 0, -68, 3.0, 1.4, 2.4); solid(50, 0, -69.6, 54, 1.1, -66.4, 'concrete');
    excavator(62, -66);
    mixer(46, -37.5);
    // work lights, barricades
    for (const [x, z] of [[36, -44], [60, -44]]) { L.pipe('paintDark', x, 0, z, x, 4, z, 0.05); for (const s of [-0.3, 0.3]) { deco(x + s - 0.2, 3.8, z - 0.1, x + s + 0.2, 4.2, z + 0.1, 'paintDark'); deco(x + s - 0.17, 3.83, z + 0.1, x + s + 0.17, 4.17, z + 0.12, 'lampWarm'); } }
    for (const x of [45, 47.5, 50]) { deco(x - 1, 0.7, -42.05, x + 1, 1.0, -41.95, 'hazard'); for (const s of [-0.9, 0.9]) deco(x + s - 0.04, 0, -42.3, x + s + 0.04, 1.0, -41.7, 'paintGrey'); solid(x - 1, 0, -42.1, x + 1, 1.0, -41.9); }
    loot(36, 0.07, -46); loot(55, 0.07, -41); loot(68, 0.07, -50); loot(40, 1.0, -40); loot(66, 0.07, -68);
  }
  function crane(x, z, h) {
    L.box(x - 2.5, 0, z - 2.5, x + 2.5, 0.6, z + 2.5, 'concrete');
    K.latticeTower(x, z, h, 2.0, 2.0, 'busYellow'); solid(x - 1.05, 0, z - 1.05, x + 1.05, h, z + 1.05, 'metal');
    // a ladder inside the mast (for show)
    for (let y = 1; y < h; y += 0.6) deco(x - 0.3, y, z + 0.9, x + 0.3, y + 0.04, z + 0.95, 'steel');
    L.cyl('paintDark', x, h + 0.3, z, 1.3, 0.6, 0, 0, false);
    // the cab and the machinery deck
    L.box(x + 1.0, h - 2.4, z - 1.7, x + 2.8, h + 0.2, z - 0.2, 'busYellow'); deco(x + 2.8, h - 2.0, z - 1.6, x + 2.84, h - 0.6, z - 0.3, 'glassDay'); deco(x + 1.1, h - 2.0, z - 1.74, x + 2.7, h - 0.6, z - 1.7, 'glassDay');
    const yb = h + 0.6, yt = h + 2.4, L0 = x - 34, L1 = x + 12;
    // the jib: a triangular truss out over the building, a walkway along its bottom chords you can stand on
    for (const dz of [-0.75, 0.75]) L.pipe('busYellow', L0, yb, z + dz, L1, yb, z + dz, 0.07);
    L.pipe('busYellow', L0 + 1, yt, z, x + 2, yt, z, 0.07);
    for (let a = L0 + 1; a < x; a += 2) for (const dz of [-0.75, 0.75]) { L.pipe('busYellow', a, yb, z + dz, a + 1, yt, z, 0.035); L.pipe('busYellow', a + 2, yb, z + dz, a + 1, yt, z, 0.035); }
    L.box(L0, yb - 0.06, z - 0.7, L1, yb, z + 0.7, 'grate', { bottom: true });
    W.add(L0, yb, z - 0.8, L1, yb + 1.0, z - 0.75, { shoot: false }); W.add(L0, yb, z + 0.75, L1, yb + 1.0, z + 0.8, { shoot: false });
    // the counter-jib with its weights, the A-frame and its pendants
    L.box(x + 7, yb, z - 1.0, x + 11.5, yb + 1.8, z + 1.0, 'concrete');
    const top = h + 8;
    for (const dz of [-0.75, 0.75]) L.pipe('busYellow', x, yb, z + dz, x, top, z, 0.08);
    L.pipe('steel', x, top, z, L0 + 4, yt, z, 0.025); L.pipe('steel', x, top, z, L1, yb, z, 0.025);
    K.sph('lampRed', x, top + 0.2, z, 0.18); K.sph('lampRed', L0, yb + 0.3, z, 0.15);
    // the trolley, the hook and a bundle of steel beams on the slings
    const tx = x - 22, hy = h - 14;
    L.box(tx - 0.8, yb - 0.5, z - 0.8, tx + 0.8, yb - 0.06, z + 0.8, 'paintDark', { noCol: true });
    for (const dx of [-0.3, 0.3]) L.pipe('steel', tx + dx, yb - 0.5, z, tx + dx, hy + 1.2, z, 0.02);
    L.box(tx - 0.45, hy + 0.5, z - 0.3, tx + 0.45, hy + 1.2, z + 0.3, 'busYellow', { noCol: true }); L.pipe('steel', tx, hy + 0.5, z, tx, hy + 0.15, z, 0.06);
    for (const [dx, dz] of [[-2.4, -0.6], [2.4, -0.6], [-2.4, 0.6], [2.4, 0.6]]) L.pipe('steel', tx, hy + 0.15, z, tx + dx, hy - 1.3, z + dz, 0.015);
    for (let i = 0; i < 3; i++) L.box(tx - 3, hy - 1.7 + (i === 2 ? 0.35 : 0), z - 0.65 + (i === 2 ? 0.45 : i * 0.9), tx + 3, hy - 1.35 + (i === 2 ? 0.35 : 0), z - 0.2 + (i === 2 ? 0.45 : i * 0.9), 'paintCherry');
    loot(tx, hy - 1.0, z); loot(L0 + 3, yb, z);
  }
  function excavator(x, z) {
    for (const s of [-1, 1]) L.box(x - 2.0, 0, z + s * 1.0 - 0.35, x + 2.0, 0.8, z + s * 1.0 + 0.35, 'paintDark');
    L.box(x - 1.6, 0.8, z - 1.2, x + 1.4, 2.0, z + 1.2, 'busYellow');
    L.box(x + 0.1, 2.0, z - 1.2, x + 1.4, 3.3, z - 0.1, 'busYellow'); deco(x + 1.4, 2.2, z - 1.1, x + 1.44, 3.1, z - 0.2, 'glassDay');
    L.box(x - 1.9, 0.9, z - 1.1, x - 1.6, 1.9, z + 1.1, 'paintDark');
    L.pipe('busYellow', x + 1.2, 2.0, z + 0.4, x + 3.6, 4.2, z + 0.4, 0.22); L.pipe('busYellow', x + 3.6, 4.2, z + 0.4, x + 5.0, 1.0, z + 0.4, 0.17);
    L.box(x + 4.6, 0.2, z - 0.2, x + 5.6, 1.0, z + 1.0, 'paintDark');
    solid(x + 3.2, 0, z - 0.2, x + 5.6, 4.4, z + 1.0, 'metal');
  }
  function mixer(x, z) {
    L.box(x - 3.6, 0.5, z - 1.2, x + 3.6, 1.1, z + 1.2, 'paintDark');
    L.box(x + 2.0, 1.1, z - 1.2, x + 3.6, 3.0, z + 1.2, 'planeWhite'); deco(x + 3.6, 2.0, z - 1.0, x + 3.64, 2.8, z + 1.0, 'glassDay');
    K.put('paintCherry', K.geo('sphere'), x - 0.8, 2.3, z, 2.4, 1.2, 1.2, 0, 0, -0.2);
    for (let i = 0; i < 4; i++) L.pipe('planeWhite', x - 2.6 + i * 1.2, 1.4, z - 1.15, x - 2.0 + i * 1.2, 3.2, z - 0.6, 0.06);
    K.wheels(x - 2.6, x + 2.8, z - 1.15, z + 1.15, 0.5);
    solid(x - 3.6, 0, z - 1.25, x + 3.6, 3.0, z + 1.25, 'metal');
  }

  // ------------------------------------------------------------ streets
  function signal(x, z, dx, dz, green) {
    L.cyl('paintDark', x, 2.9, z, 0.12, 5.8, 0, 0, true); solid(x - 0.15, 0, z - 0.15, x + 0.15, 5.8, z + 0.15, 'metal');
    L.pipe('paintDark', x, 5.5, z, x + dx * 4.6, 5.5, z + dz * 4.6, 0.07); L.pipe('paintDark', x, 4.8, z, x + dx * 1.6, 5.5, z + dz * 1.6, 0.03);
    // heads face along the street they control (the other way to the arm)
    const head = (hx, hy, hz, g) => {
      const al = Math.abs(dx) > 0.5; // the arm runs along X: the head faces ±Z
      deco(hx - 0.2, hy - 1.0, hz - 0.2, hx + 0.2, hy, hz + 0.2, 'paintDark');
      ['lampRed', 'ttLampY', 'ttLampG'].forEach((m, i) => { const lit = g ? i === 2 : i === 0, y = hy - 0.2 - i * 0.3; for (const s of [-1, 1]) K.sph(lit ? m : 'paintDark', hx + (al ? 0 : s * 0.2), y, hz + (al ? s * 0.2 : 0), 0.11); });
    };
    head(x + dx * 4.2, 5.45, z + dz * 4.2, green); head(x + dx * 2.2, 5.45, z + dz * 2.2, green); head(x - dz * 0.3, 3.2, z + dx * 0.3, !green);
  }
  function streets(rnd) {
    for (const c of ROAD) deco(-EDGE - 20, 0.04, c - RW, EDGE + 20, 0.1, c + RW, 'asphalt');
    for (const c of ROAD) for (const [z0, z1] of [[-EDGE - 20, -30], [-22, 22], [30, EDGE + 20]]) deco(c - RW, 0.04, z0, c + RW, 0.1, z1, 'asphalt');
    // centre lines, crosswalks, curbs
    const yl = (x0, z0, x1, z1) => deco(x0, 0.1, z0, x1, 0.16, z1, 'paintYellow');
    for (const c of ROAD) for (let a = -EDGE - 14; a < EDGE + 14; a += 6) if (!ROAD.some((d) => a + 3 > d - 7 && a < d + 7)) { yl(a, c - 0.1, a + 3, c + 0.1); yl(c - 0.1, a, c + 0.1, a + 3); }
    for (const cx of ROAD) for (const cz of ROAD) {
      for (let i = 0; i < 8; i++) {
        const o = -3.6 + i * 0.95;
        deco(cx + o, 0.1, cz - RW - 3.2, cx + o + 0.5, 0.16, cz - RW - 0.4, 'lineWhite'); deco(cx + o, 0.1, cz + RW + 0.4, cx + o + 0.5, 0.16, cz + RW + 3.2, 'lineWhite');
        deco(cx - RW - 3.2, 0.1, cz + o, cx - RW - 0.4, 0.16, cz + o + 0.5, 'lineWhite'); deco(cx + RW + 0.4, 0.1, cz + o, cx + RW + 3.2, 0.16, cz + o + 0.5, 'lineWhite');
      }
      signal(cx - RW - 0.8, cz - RW - 0.8, 1, 0, true); signal(cx + RW + 0.8, cz + RW + 0.8, -1, 0, true);
      signal(cx + RW + 0.8, cz - RW - 0.8, 0, 1, false); signal(cx - RW - 0.8, cz + RW + 0.8, 0, -1, false);
    }
    for (const c of ROAD) for (const [a0, a1] of [[-TOWN, -30], [-22, 22], [30, TOWN]]) for (const s of [-1, 1]) {
      const e = c + s * RW; deco(Math.min(e, e + s * 0.18), 0.04, a0, Math.max(e, e + s * 0.18), 0.2, a1, 'concreteDark'); deco(a0, 0.04, Math.min(e, e + s * 0.18), a1, 0.2, Math.max(e, e + s * 0.18), 'concreteDark');
    }
    // street lamps, hydrants, bins, benches
    for (const c of ROAD) for (const a of [-66, -48, -12, 12, 48, 66]) for (const s of [-1, 1]) { K.streetLamp(c + s * 5.4, a); K.streetLamp(a, c + s * 5.4); }
    for (const [x, z] of [[-31, -40], [31, 12], [-21, 40], [21, -12], [-40, 31], [12, -31], [40, -21], [-12, 21]]) K.hydrant(x, z);
    for (const [x, z] of [[-31.2, -14], [31.2, -60], [-21, -60], [21, 46], [-60, 31.2], [-8, -31.2], [60, -21], [8, 21]]) K.trashCan(x, z);
    // parked cars along the curbs
    const paints = ['paintBlue', 'paintCherry', 'paintMint', 'paintCream', 'paintTaxi', 'planeWhite', 'paintGreen', 'busYellow'];
    let n = 0;
    for (const c of ROAD) for (const a of [-62, -44, -14, 2, 14, 44, 62]) for (const s of [-1, 1]) {
      if (rnd() < 0.45) continue;
      K.car(a + (rnd() - 0.5) * 3, c + s * 2.9, true, paints[n++ % paints.length], s > 0);
      if (rnd() < 0.55) K.car(c + s * 2.9, a + (rnd() - 0.5) * 3, false, paints[n++ % paints.length], s < 0);
    }
    K.schoolBus(-100, 27.4);
    R.boxTruck(52, -27.6, true, 'paintBlue');
    // the bus stop on South Street
    { const x = 0, z = 31.6; for (const dx of [-1.8, 1.8]) deco(dx + x - 0.05, 0, z - 0.6, dx + x + 0.05, 2.5, z + 0.6, 'paintDark'); deco(x - 1.9, 0.4, z + 0.55, x + 1.9, 2.4, z + 0.6, 'glassClear'); L.box(x - 2.0, 2.5, z - 0.8, x + 2.0, 2.65, z + 0.7, 'paintDark', { bottom: true }); bench(x, z + 0.2, true); K.plane(art().bus, 1.0, 1.5, x + 1.86, 1.5, z, Math.PI / 2); }
    loot(0.5, 0.05, 31.4);
  }

  // ------------------------------------------------------------ the blocks between the towers
  function backLots(rnd) {
    // north alley behind Tower A and Vertex: a small car park and the bins
    deco(-20, 0.04, -72, 20, 0.10, -57, 'asphalt');
    R.dumpster(-14, -55.5, true); R.dumpster(-9, -55.5, true); R.dumpster(8, -57, true);
    R.boxTruck(-4, -65, true, 'paintCherry');
    K.car(10, -64, true, 'paintMint'); K.car(15, -68.5, true, 'planeWhite', true);
    P('crate', -18, -58, 0.2); P('crateSmall', -17, -58.6, 0.5); P('drum', 18, -58);
    loot(-12, 0.07, -62); loot(4, 0.07, -66); chest(-18.5, 0.07, -66, Math.PI / 2);
    // the Maple Court yard: a playground and benches
    deco(-70, 0.04, -72, -34, 0.10, -62, 'grass');
    for (const [x, z] of [[-60, -68], [-56, -68], [-60, -64.5], [-56, -64.5]]) { L.cyl('paintBlue', x, 1.4, z, 0.08, 2.8, 0, 0, true); solid(x - 0.09, 0, z - 0.09, x + 0.09, 2.8, z + 0.09, 'metal'); }
    L.box(-60, 1.85, -68, -56, 2.0, -64.5, 'wood', { bottom: true }); L.box(-60, 2.75, -68, -56, 2.85, -64.5, 'paintTaxi', { noCol: true });
    R.steps('x', -64, -60, -67, -65.6, 0, 2.0, 1, 'paintBlue');
    L.pipe('paintCherry', -56, 2.0, -66, -52, 0.3, -66, 0.35);
    for (const x of [-46, -42]) { L.pipe('paintBlue', x, 0, -69, x, 2.6, -68, 0.07); L.pipe('paintBlue', x, 0, -67, x, 2.6, -68, 0.07); }
    L.pipe('paintBlue', -46, 2.6, -68, -42, 2.6, -68, 0.07); for (const x of [-45, -43]) { L.pipe('chrome', x, 2.6, -68, x, 0.7, -68, 0.012); deco(x - 0.25, 0.65, -68.15, x + 0.25, 0.7, -67.85, 'rubber'); }
    for (const [x, z] of [[-67, -70], [-36, -66]]) R.oak(x, z, 3.6, 2.0, rnd);
    loot(-58, 2.0, -66); loot(-44, 0.07, -64);
    // behind the West Street shops: an alley, garages, a basketball hoop
    deco(-72, 0.04, -20, -52, 0.10, 20, 'asphalt');
    for (let i = 0; i < 3; i++) {
      const z0 = -16 + i * 6.5;
      L.box(-70, 0, z0, -64, 3.0, z0 + 6, 'ttBrickDark', { top: 'roofTin' }); deco(-63.97, 0.1, z0 + 0.6, -63.93, 2.6, z0 + 5.4, 'garageDoor');
    }
    R.dumpster(-55, -12, false); R.dumpster(-55, 12, false);
    { const x = -66, z = 10; L.cyl('paintGrey', x, 1.6, z, 0.08, 3.2, 0, 0, true); deco(x + 0.2, 3.0, z - 0.8, x + 0.26, 4.0, z + 0.8, 'planeWhite'); L.addGeo('paintCherry', L.geo('torus'), L.mat4(x + 0.6, 3.1, z, Math.PI / 2, 0, 0, 0.23, 0.23, 0.23)); solid(x - 0.1, 0, z - 0.1, x + 0.1, 3.2, z + 0.1, 'metal'); }
    loot(-60, 0.07, 0); loot(-67, 0.07, 16); chest(-62.5, 0.07, -18.5, Math.PI);
    // the south park behind the Mercantile: lawn, paths, a gazebo
    deco(-20, 0.04, 57, 20, 0.10, 72, 'grass'); deco(-1, 0.1, 57, 1, 0.16, 72, 'concrete'); deco(-20, 0.1, 63.5, 20, 0.16, 65.5, 'concrete');
    { const x = 10, z = 64.5, r = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; L.cyl('planeWhite', px, 1.4, pz, 0.12, 2.8, 0, 0, true); solid(px - 0.13, 0, pz - 0.13, px + 0.13, 2.8, pz + 0.13); }
      L.cyl('woodDark', x, 0.1, z, r + 0.4, 0.2, 0, 0, false); W.addCyl(x, z, r + 0.4, 0, 0.2, { surf: 'wood' });
      K.put('roofGray', K.geo('cone'), x, 3.6, z, r + 0.8, 1.6, r + 0.8); chest(x, 0.2, z, 0); }
    for (const [x, z] of [[-14, 60], [-6, 69], [16, 59], [16, 70], [-17, 69], [4, 60]]) R.oak(x, z, 3.6 + rnd(), 2.1, rnd);
    for (const x of [-10, -4]) bench(x, 62.8, true);
    loot(-10, 0.07, 67); loot(6, 0.07, 69);
    // the corner park by Tower C
    deco(58, 0.04, 34, 72, 0.10, 72, 'grass'); deco(32, 0.04, 58, 58, 0.10, 72, 'grass');
    for (const [x, z] of [[64, 40], [68, 50], [62, 60], [68, 68], [40, 66], [50, 62]]) R.oak(x, z, 3.4 + rnd(), 2.0, rnd);
    for (const [x, z] of [[44, 68], [56, 66]]) { K.table(x - 0.9, z - 0.4, x + 0.9, z + 0.4, 0); bench(x, z - 0.8, true); bench(x, z + 0.8, true); }
    loot(64, 0.07, 46); loot(46, 0.07, 64); chest(70, 0.07, 58, -Math.PI / 2);
    // and the empty corner by Tower B: a lawn and trees
    deco(-72, 0.04, 56, -32, 0.10, 72, 'grass');
    for (const [x, z] of [[-66, 62], [-52, 66], [-40, 60], [-36, 70]]) R.oak(x, z, 3.6 + rnd(), 2.0, rnd);
    loot(-46, 0.07, 64);
    // forecourts and planters in front of the towers
    for (const [x, z] of [[-16, -32.5], [-4, -32.5], [4, -32.5], [16, -32.5], [-33, -16], [-33, 16], [-44, 36], [-62, 36], [40, 36], [54, 36]]) plant(x, z, 0);
  }

  // ------------------------------------------------------------ outside town
  function gasStation(rnd) {
    const S = art();
    deco(80, 0.04, 32, 108, 0.10, 54, 'concrete');
    for (const [x, z] of [[85, 37], [95, 37], [85, 45], [95, 45]]) L.box(x - 0.3, 0, z - 0.3, x + 0.3, 5.0, z + 0.3, 'planeWhite');
    L.box(82, 5.0, 34, 98, 5.7, 48, 'planeWhite', { top: 'roofTin', bottom: true });
    deco(82, 5.0, 33.96, 98, 5.7, 34, 'paintGreen'); deco(82, 5.0, 48, 98, 5.7, 48.04, 'paintGreen');
    K.plane(S.fuel, 8, 0.7, 90, 5.35, 33.94, Math.PI); K.plane(S.fuel, 8, 0.7, 90, 5.35, 48.06, 0);
    for (const x of [87.5, 92.5]) { L.box(x - 0.7, 0, 37.5, x + 0.7, 0.2, 44.5, 'concrete'); for (const z of [39, 43]) { L.box(x - 0.45, 0.2, z - 0.35, x + 0.45, 1.85, z + 0.35, 'paintGreen'); deco(x - 0.46, 1.1, z - 0.2, x + 0.46, 1.5, z + 0.2, 'glassDay'); } }
    K.car(90, 41, false, 'paintTaxi', true);
    // the shop
    const x0 = 99, x1 = 107, z0 = 36, z1 = 48, Hh = 4.0;
    const OUT = [[0, 0.8, 'brick'], [0.8, Hh + 0.6, 'planeWhite']], IN = [[0, Hh, 'wallClean']];
    L.box(x0, 0, z0, x1, G, z1, 'checker', { ao: false });
    K.wall('z', z0, z1, x0, 0, Hh, [[37.5, 40.5, 0.8, 2.6], [41, 43, G, 2.5], [43.5, 46.5, 0.8, 2.6]], OUT, IN, -1, { noLeaf: true });
    R.glass(x0 - 0.05, 0.8, 37.5, x0 + 0.05, 2.6, 40.5); R.glass(x0 - 0.05, 0.8, 43.5, x0 + 0.05, 2.6, 46.5);
    K.wall('z', z0, z1, x1, 0, Hh, [[44, 45.2, G, 2.4]], OUT, IN, 1);
    K.wall('x', x0, x1, z0, 0, Hh, [], OUT, IN, -1); K.wall('x', x0, x1, z1, 0, Hh, [], OUT, IN, 1);
    slab(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, Hh + 0.25, 'roofTin', 'ceilTile');
    rack(102, 37, 106, 38, G, 1.6, rnd, STOCK); rack(102, 40.5, 106, 41.5, G, 1.6, rnd, STOCK);
    counterAt(100.5, 44.5, 101.4, 47.5, G, 'paintGreen');
    L.box(106.1, G, 44, 106.85, 2.2, 47.8, 'appliance'); deco(106.05, 0.5, 44.1, 106.1, 1.9, 47.7, 'windowCool');
    K.roomLight(103, Hh, 42); BLD.push([x0, z0, x1, z1, Hh]);
    loot(103, G, 43.5); loot(104, G, 39); chest(105.5, G, 37, Math.PI / 2); loot(90, 5.7, 41); loot(84, 0.07, 50);
    R.dumpster(108.5, 40, false); P('tires', 108.5, 46, 0);
  }
  function country(rnd) {
    const S = art();
    // welcome signs on the roads in from the west and the east
    for (const [x, z, ry] of [[-92, -35.5, -Math.PI / 2], [92, 35.5, Math.PI / 2]]) {
      for (const dz of [-2.4, 2.4]) { L.box(x - 0.15, 0, z + dz - 0.15, x + 0.15, 3.0, z + dz + 0.15, 'woodDark'); }
      L.box(x - 0.1, 1.2, z - 3.2, x + 0.1, 3.6, z + 3.2, 'woodDark', { noCol: true }); solid(x - 0.15, 0, z - 3.2, x + 0.15, 3.6, z + 3.2);
      K.plane(S.welcome, 6.2, 2.32, x + Math.sin(ry) * 0.11, 2.4, z, ry); K.plane(S.welcome, 6.2, 2.32, x - Math.sin(ry) * 0.11, 2.4, z, ry + Math.PI);
    }
    billboard(88, -36, 0, -Math.PI / 2, S.cola, 9, 3.4);
    billboard(-36, 88, 0, 0, S.cola, 9, 3.4);
    // a farm shed and hay bales in the north-west field, the fence along it
    { const x0 = -104, x1 = -94, z0 = -104, z1 = -96, Hh = 3.6;
      const OUT = [[0, Hh + 0.4, 'ttBarn']], IN = [[0, Hh, 'plankWall']];
      L.box(x0, 0, z0, x1, G, z1, 'dirt');
      K.wall('x', x0, x1, z1, 0, Hh, [[-101, -97, G, 3.2]], OUT, IN, 1, { noLeaf: true }); K.wall('x', x0, x1, z0, 0, Hh, [], OUT, IN, -1);
      K.wall('z', z0, z1, x0, 0, Hh, [[-101, -99, 1.0, 2.2]], OUT, IN, -1); K.wall('z', z0, z1, x1, 0, Hh, [], OUT, IN, 1);
      K.gableRoof((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, Hh, 2.6, 'ttBarn', 'ttBarnRoof', false, true);
      L.box(x0 + 0.5, 0, z0 + 0.5, x0 + 3.5, 1.2, z0 + 2.5, 'ttHay'); loot(-98, G, -100); chest(-103.2, G, -98, Math.PI / 2); BLD.push([x0, z0, x1, z1, Hh]); }
    for (let i = 0; i < 10; i++) { const x = -112 + rnd() * 30, z = -84 + rnd() * 20; L.cyl('ttHay', x, 0.6, z, 0.7, 1.2, Math.PI / 2, 0, true); solid(x - 0.7, 0, z - 0.6, x + 0.7, 1.2, z + 0.6); }
    for (let x = -116; x < -80; x += 3) deco(x - 0.08, 0, -60.08, x + 0.08, 1.2, -59.92, 'woodDark');
    deco(-116, 0.75, -60.04, -80, 0.85, -59.96, 'wood'); deco(-116, 0.35, -60.04, -80, 0.45, -59.96, 'wood'); solid(-116, 0, -60.06, -80, 1.1, -59.94);
    // the pond in the south-west
    K.put('ttPond', K.discGeo(0, 12, 1 / 6), -92, 0.08, 92, 1, 1, 1);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; K.put('rock', K.blobGeo(i % 3), -92 + Math.cos(a) * 12.4, 0.1, 92 + Math.sin(a) * 12.4, 0.7, 0.35, 0.6, a); }
    { const x = -84, z = 80; L.box(x - 1, 0.3, z, x + 1, 0.42, z + 7, 'wood', { bottom: true }); for (const zz of [z + 2, z + 4.5, z + 7]) for (const s of [-0.9, 0.9]) deco(x + s - 0.06, 0, zz - 0.06, x + s + 0.06, 0.42, zz + 0.06, 'woodDark'); loot(x, 0.42, z + 6); }
    // power line along the road north of town
    const poles = [-116, -96, -80, 80, 96, 116].map((x) => K.powerPole(x, -33.5, 9));
    for (let i = 0; i < poles.length - 1; i++) if (i !== 2) K.wire(poles[i], poles[i + 1], 0.9);
    // woods and rocks everywhere else
    const busy = (x, z) => (Math.abs(x) < 78 && Math.abs(z) < 78) || ROAD.some((c) => Math.abs(x - c) < 7 || Math.abs(z - c) < 7) ||
      (x > 76 && x < 112 && z > 28 && z < 58) || Math.hypot(x + 92, z - 92) < 15 || (x > -116 && x < -78 && z > -112 && z < -58) || (Math.abs(Math.abs(x) - 92) < 5 && Math.abs(Math.abs(z) - 36) < 6) ||
      Math.hypot(x + 36, z - 88) < 7 || [[-90, 0], [90, -10], [0, -95], [10, 95], [-100, 27], [-100, -30], [30, 100]].some(([px, pz]) => Math.hypot(x - px, z - pz) < 8);
    let n = 0;
    for (let i = 0; i < 1200 && n < 190; i++) {
      const x = (rnd() - 0.5) * 2 * (EDGE + 30), z = (rnd() - 0.5) * 2 * (EDGE + 30);
      if (busy(x, z)) continue;
      n++;
      if (rnd() < 0.55) R.fir(x, z, 9 + rnd() * 8); else R.oak(x, z, 3.5 + rnd() * 2, 2.2 + rnd(), rnd);
    }
    for (let i = 0; i < 46; i++) { const x = (rnd() - 0.5) * 230, z = (rnd() - 0.5) * 230; if (!busy(x, z)) R.rock(x, z, 0.6 + rnd() * 1.6, i); }
    for (const [x, z] of [[-100, 6], [100, -16], [0, -104], [10, 104], [-60, 100], [60, -100], [104, 100], [-104, 60], [100, 70], [-30, -96]]) loot(x, 0.05, z);
    chest(-110, 0.05, 20, Math.PI / 2); chest(100, 0.05, -100, 0); chest(30, 0.05, 108, Math.PI);
    K.car(-100, -30.5, true, 'paintCherry'); K.car(30.5, 100, false, 'paintMint', true); K.car(70, 23.5, true, 'planeWhite', true);
  }

  // ------------------------------------------------------------ build
  TT.build = function () {
    K = CF.MapNuketown.kit; R = CF.MapRetail.kit();
    LOOT = []; CHESTS = []; BLD = [];
    const rnd = U.mulberry32(2019), M = L.mats, Tx = CF.Tex.list;
    // colours of the town
    const tint = (t, c, o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.6, map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, color: c, metalness: 0 }, o || {}));
    const rep = (t, k) => { const o = {}; for (const key of ['map', 'normalMap', 'roughnessMap']) if (t[key]) { const c = t[key].clone(); c.repeat.set(k, k); c.needsUpdate = true; o[key] = c; } return o; };
    const paint = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, color: c, metalness: 0.35, roughness: 0.32, envMapIntensity: 0.9 }, o || {}));
    M.ttBrickDark = tint(rep(Tx.brick, 2), 0x8c6e66); M.ttBlock = tint(Tx.concrete, 0xa9a69e);
    M.ttCream = tint(Tx.concrete, 0xeadfc4); M.ttStone = tint(Tx.concrete, 0xd9d0bd); M.ttSand = tint(Tx.concrete, 0xd6b88c);
    M.ttTeal = tint(Tx.concrete, 0x6fa8a0); M.ttWhite = tint(Tx.concrete, 0xf1f0ea); M.ttBlue = tint(Tx.concrete, 0x4f78b0); M.ttOchre = tint(Tx.concrete, 0xe0a848); M.ttGranite = tint(Tx.concrete, 0x5a5d63);
    M.ttPanel = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x39414c, metalness: 0.55, roughness: 0.35, envMapIntensity: 0.9 });
    M.ttGlass = M.glassClear.clone(); M.ttGlass.color = new THREE.Color(0x4f86b8); M.ttGlass.opacity = 0.42;
    M.ttCopper = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x5e9f8a, metalness: 0.45, roughness: 0.5, envMapIntensity: 0.8 });
    M.ttBronze = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x8a6a32, metalness: 0.85, roughness: 0.35, envMapIntensity: 1.0 });
    M.ttGold = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xd8b04a, metalness: 1, roughness: 0.25, envMapIntensity: 1.2 });
    M.ttWater = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x3f8fb8, metalness: 0.3, roughness: 0.05, envMapIntensity: 1.4, transparent: true, opacity: 0.82 });
    M.ttPond = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x3a7fa6, metalness: 0.4, roughness: 0.08, envMapIntensity: 1.3 });
    M.ttPool = paint(0x7cc8e0, { metalness: 0.05, roughness: 0.4 });
    M.ttOrange = paint(0xf07a1e); M.ttBun = paint(0xd8913a, { metalness: 0.05, roughness: 0.6 }); M.ttPatty = paint(0x5a3220, { metalness: 0, roughness: 0.9 });
    M.ttCheese = paint(0xf5c518, { metalness: 0.05, roughness: 0.4 }); M.ttLettuce = paint(0x6cbf3a, { metalness: 0, roughness: 0.7 }); M.ttTomato = paint(0xd8382a, { metalness: 0.05, roughness: 0.4 }); M.ttSesame = paint(0xf6ecd0, { metalness: 0, roughness: 0.7 });
    M.ttLampG = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 4.0, 1.2) }); M.ttLampY = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.2, 0.3) });
    M.ttBarn = tint(Tx.planks, 0xa8352a); M.ttBarnRoof = M.roofTin.clone(); M.ttBarnRoof.side = THREE.DoubleSide; M.ttHay = tint(Tx.grass, 0xe0c46a);
    for (const [name, a, b] of [['ttAwnRed', '#c8302a', '#f4efe4'], ['ttAwnGreen', '#2f7a4a', '#f4efe4'], ['ttAwnBlue', '#2a5c9c', '#f4efe4'], ['ttAwnYellow', '#f2b51e', '#c8302a']]) { M[name] = stripes(a, b, false); M[name + 'V'] = stripes(a, b, true); }
    // ground: grass everywhere, the town paved on top
    // ground: grass out to well past the edge (it must never show from the Battle Bus) round the paved town square. The layers on
    // top sit 6 cm apart (paving 0.04, lots and roads 0.10, paint and paths 0.16) so they don't flicker seen from the bus
    for (const [x0, z0, x1, z1] of [[-1600, -1600, 1600, -TOWN], [-1600, TOWN, 1600, 1600], [-1600, -TOWN, -TOWN, TOWN], [TOWN, -TOWN, 1600, TOWN]]) L.box(x0, -1, z0, x1, 0.02, z1, 'grass', { ao: false });
    L.box(-TOWN, -1, -TOWN, TOWN, 0.04, TOWN, 'concrete', { ao: false });
    streets(rnd);
    plaza(rnd);
    clockTower(rnd);
    towers(rnd);
    hotelGrounds(rnd);
    site(rnd);
    backLots(rnd);
    gasStation(rnd);
    country(rnd);
    // the edge: a post-and-rail fence and an invisible wall just inside it
    for (let a = -EDGE; a <= EDGE; a += 4) { for (const [x, z] of [[a, -EDGE - 1], [a, EDGE + 1], [-EDGE - 1, a], [EDGE + 1, a]]) deco(x - 0.08, 0, z - 0.08, x + 0.08, 1.2, z + 0.08, 'woodDark'); }
    for (const s of [-1, 1]) { deco(-EDGE, 0.8, s * (EDGE + 1) - 0.04, EDGE, 0.9, s * (EDGE + 1) + 0.04, 'wood'); deco(s * (EDGE + 1) - 0.04, 0.8, -EDGE, s * (EDGE + 1) + 0.04, 0.9, EDGE, 'wood'); }
    const inv = (x0, z0, x1, z1) => L.box(x0, 0, z0, x1, 400, z1, 'trim', { noMesh: true, nav: false });
    inv(-EDGE - 2, -EDGE - 2, EDGE + 2, -EDGE); inv(-EDGE - 2, EDGE, EDGE + 2, EDGE + 2); inv(-EDGE - 2, -EDGE, -EDGE, EDGE); inv(EDGE, -EDGE, EDGE + 2, EDGE);
    L.killY = -10;
    W.navWalls = true; // bots: see the thin walls and shop windows (js/world.js)

    // spawns (warm-up and the other modes), loot and chests for Battle Royale
    L.spawns.ffa = [[-8, 0.08, 3], [8, 0.08, 9], [-26, 0.06, -12], [26, 0.06, 10], [-12, 0.06, -26], [12, 0.06, 26], [-26, 0.06, 44], [26, 0.06, -44],
      [-44, 0.06, -26], [44, 0.06, 26], [-60, 0.07, 0], [62, 0.07, 14], [2, 0.07, -60], [0, 0.07, 64], [-50, 0.07, -70], [64, 0.07, 64],
      [-90, 0.05, 0], [90, 0.05, -10], [0, 0.05, -95], [10, 0.05, 95]];
    L.spawns.t0 = L.spawns.ffa.filter((s) => s[2] < 4); L.spawns.t1 = L.spawns.ffa.filter((s) => s[2] >= 4);
    L.points.loot = LOOT; L.points.chests = CHESTS;
    L.points.start = { x: 0, y: 0.08, z: 12, yaw: 0 };
    L.points.br = { size: EDGE, center: [0, 0] };
  };
  /** Indoors (for the room sound): inside any tower below its roof. */
  TT.inside = (p) => BLD.some((b) => p.x > b[0] && p.x < b[2] && p.z > b[1] && p.z < b[3] && p.y < b[4] - 0.5);
})(window.CF);
