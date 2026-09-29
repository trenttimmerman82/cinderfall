'use strict';
/* Cinderfall — OREGON (multiplayer). A fenced religious compound in the Pacific Northwest woods, after the Siege map:
   the main house (dining hall and kitchen downstairs, dorms, kids' dorm, armory and master bedroom upstairs, laundry
   and supply room in the basement), the double-height meeting hall west of it with a catwalk up to the three-storey
   Big Tower, and the garage east of it whose flat roof you can walk onto from the master bedroom or the outside stair.
   Around it: the school bus and trucks out front, a junkyard, a mobile home and a half-built frame house out back,
   a wooden watchtower, and pine forest past the chain-link fence. Axes: +X east, +Z south. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MO = CF.MapOregon = {};
  let K = null; // Nuketown's building kit (js/map-nuketown.js)

  const T = 0.25;                                  // wall thickness
  const G = 0.12, F1 = 3.0, F = 3.25, H2 = 6.0, RF = 6.2; // ground floor, ceiling, upper floor, upper ceiling, roof base
  const BF = -3.25;                                // basement floor
  const HH = 7.0;                                  // meeting hall ceiling
  const F3 = 6.5, TH = 9.5;                        // Big Tower top floor and ceiling

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  /** Floor slab whose top is at y (underside shows as a ceiling from below). */
  const slab = (x0, z0, x1, z1, y, top, m) => L.box(x0, y - 0.25, z0, x1, y, z1, m || 'ceiling', { top, side: 'trim', bottom: true });
  /** Solid staircase. axis 'x' climbs along X over a0..a1 (b = the Z span), 'z' climbs along Z. up = +1 rises toward a1, -1 toward a0. */
  function steps(axis, a0, a1, b0, b1, yBase, yTop, up, m, topM) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, yBase, b0, s1, top, b1, m, { top: topM }); else L.box(b0, yBase, s0, b1, top, s1, m, { top: topM });
    }
  }
  /** Open wooden stair: treads on two stringers (you can walk under the high end). */
  function openSteps(axis, a0, a1, b0, b1, yBase, yTop, up, m) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, top - 0.06, b0, s1, top, b1, m, { ao: false }); else L.box(b0, top - 0.06, s0, b1, top, s1, m, { ao: false });
    }
    const lo = up > 0 ? a0 : a1, hi = up > 0 ? a1 : a0;
    for (const b of [b0 + 0.05, b1 - 0.05]) {
      if (axis === 'x') L.pipe(m, lo, yBase, b, hi, yTop - rise, b, 0.07); else L.pipe(m, b, yBase, lo, b, yTop - rise, hi, 0.07);
    }
  }
  /** Sandbag courses along a line, sitting at height y. */
  function bags(x0, z0, x1, z1, rows, y) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.55)), ang = Math.atan2(x1 - x0, z1 - z0);
    for (let r = 0; r < rows; r++) for (let i = 0; i <= n; i++) {
      const k = (i + (r % 2) * 0.5) / (n + 0.5);
      K.put('sandbag', K.blobGeo((i + r) % 3), x0 + (x1 - x0) * k, y + 0.14 + r * 0.24, z0 + (z1 - z0) * k, 0.3, 0.13, 0.2, ang + Math.PI / 2);
    }
    solid(Math.min(x0, x1) - 0.3, y, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, y + rows * 0.25 + 0.05, Math.max(z0, z1) + 0.3);
  }
  /** Steel shelving unit with boxes and tins on it. */
  function shelf(x0, z0, x1, z1, y, h, rnd) {
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) deco(x - 0.03, y, z - 0.03, x + 0.03, y + h, z + 0.03, 'steel');
    const n = 4, alongX = x1 - x0 > z1 - z0;
    for (let i = 0; i < n; i++) {
      const sy = y + 0.12 + i * (h - 0.2) / (n - 1);
      deco(x0, sy, z0, x1, sy + 0.03, z1, 'steel');
      if (i === n - 1) break;
      const len = alongX ? x1 - x0 : z1 - z0;
      for (let t = 0.1; t < len - 0.3; t += 0.35 + rnd() * 0.3) {
        const w = 0.25 + rnd() * 0.25, hh = 0.2 + rnd() * 0.3, m = rnd() < 0.6 ? 'cardboard' : rnd() < 0.5 ? 'paintRed' : 'appliance';
        if (alongX) deco(x0 + t, sy + 0.03, z0 + 0.05, x0 + t + w, sy + 0.03 + hh, z1 - 0.05, m);
        else deco(x0 + 0.05, sy + 0.03, z0 + t, x1 - 0.05, sy + 0.03 + hh, z0 + t + w, m);
      }
    }
    solid(x0 - 0.04, y, z0 - 0.04, x1 + 0.04, y + h, z1 + 0.04, 'metal');
  }
  /** Bunk bed, long side along Z. */
  function bunk(x0, z0, x1, z1, y) {
    L.box(x0, y, z0, x1, y + 0.3, z1, 'woodDark', { ao: false }); deco(x0 + 0.04, y + 0.3, z0 + 0.04, x1 - 0.04, y + 0.46, z1 - 0.04, 'bedspread');
    deco(x0, y + 1.35, z0, x1, y + 1.48, z1, 'woodDark'); deco(x0 + 0.04, y + 1.48, z0 + 0.04, x1 - 0.04, y + 1.62, z1 - 0.04, 'bedspread');
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) L.box(x - 0.04, y, z - 0.04, x + 0.04, y + 1.95, z + 0.04, 'woodDark', { ao: false });
    deco(x0 - 0.02, y + 1.62, z0 - 0.02, x1 + 0.02, y + 1.72, z0 + 0.03, 'woodDark'); deco(x0 - 0.02, y + 1.62, z1 - 0.03, x1 + 0.02, y + 1.72, z1 + 0.02, 'woodDark');
    solid(x0, y, z0, x1, y + 0.48, z1); solid(x0, y + 1.35, z0, x1, y + 1.62, z1);
    W.add(x0, y + 1.62, z0, x1, y + 2.6, z1, { shoot: false, nav: false }); // the top bunk is not a stepping stone to the ceiling
  }
  /** Church pew facing -X (toward the stage). */
  function pew(x, z0, z1) {
    deco(x - 0.25, G + 0.4, z0, x + 0.25, G + 0.47, z1, 'wood');
    deco(x + 0.2, G + 0.47, z0, x + 0.27, G + 1.0, z1, 'wood');
    for (const z of [z0, z1 - 0.07]) deco(x - 0.27, G, z, x + 0.27, G + 0.95, z + 0.07, 'woodDark');
    solid(x - 0.27, G, z0, x + 0.27, G + 1.0, z1);
  }
  function hangLamp(x, y, z, drop) { L.pipe('paintDark', x, y, z, x, y - drop, z, 0.015); K.roomLight(x, y - drop, z); }
  function picnic(x, z) {
    L.box(x - 1, 0.72, z - 0.42, x + 1, 0.78, z + 0.42, 'wood', { noCol: true });
    for (const s of [-1, 1]) deco(x - 1, 0.42, z + s * 0.62 - 0.14, x + 1, 0.47, z + s * 0.62 + 0.14, 'wood');
    for (const dx of [-0.8, 0.8]) { L.pipe('woodDark', x + dx, 0, z - 0.75, x + dx, 0.75, z, 0.04); L.pipe('woodDark', x + dx, 0, z + 0.75, x + dx, 0.75, z, 0.04); }
    solid(x - 1, 0, z - 0.8, x + 1, 0.78, z + 0.8);
  }
  function flagpole(x, z) {
    L.cyl('chrome', x, 4.5, z, 0.06, 9, 0, 0, true); K.sph('paintYellow', x, 9.05, z, 0.12);
    K.plane(K.art().flag, 1.7, 1.05, x + 0.9, 8.2, z, 0, { double: true });
    L.box(x - 0.4, 0, z - 0.4, x + 0.4, 0.3, z + 0.4, 'concrete'); solid(x - 0.08, 0, z - 0.08, x + 0.08, 9, z + 0.08, 'metal');
  }
  /** Douglas fir: straight trunk, stacked dark cones. */
  function fir(x, z, h, col) {
    const r = h * 0.2;
    K.put('bark', K.geo('trunk'), x, h * 0.2, z, 0.3 * h / 14, h * 0.4, 0.3 * h / 14);
    for (let i = 0; i < 5; i++) { const k = i / 5, s = r * (1 - k * 0.78); K.put(i % 2 ? 'pine' : 'leaves2', K.geo('cone'), x, h * (0.3 + k * 0.6), z, s, h * 0.28, s, i * 1.3); }
    if (col) { solid(x - 0.35, 0, z - 0.35, x + 0.35, h, z + 0.35); W.add(x - r, h * 0.35, z - r, x + r, h + 4, z + r, { shoot: false, nav: false }); }
  }
  function propaneTank(x, z) {
    L.cyl('appliance', x, 1.0, z, 0.62, 2.4, 0, Math.PI / 2, false); K.sph('appliance', x - 1.2, 1.0, z, 0.62); K.sph('appliance', x + 1.2, 1.0, z, 0.62);
    for (const dx of [-0.8, 0.8]) deco(x + dx - 0.1, 0, z - 0.45, x + dx + 0.1, 0.5, z + 0.45, 'concrete');
    deco(x - 0.2, 1.6, z - 0.2, x + 0.2, 1.75, z + 0.2, 'steel');
    solid(x - 1.85, 0, z - 0.65, x + 1.85, 1.65, z + 0.65, 'metal');
  }

  // ------------------------------------------------------------ canvas art
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const ct = (w, h, draw) => K.canvasTex(w, h, draw);
    ART.banner = ct(256, 384, (x, w, h) => {
      x.fillStyle = '#e9e0c8'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#7a2a1e'; x.fillRect(0, 0, w, 24); x.fillRect(0, h - 24, w, 24);
      const cx = w / 2, cy = h * 0.52;
      x.strokeStyle = '#d98a2b'; x.lineWidth = 7;
      for (let i = 0; i < 11; i++) { const a = Math.PI + (i / 10) * Math.PI; x.beginPath(); x.moveTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62); x.lineTo(cx + Math.cos(a) * 104, cy + Math.sin(a) * 104); x.stroke(); }
      x.fillStyle = '#e39a2e'; x.beginPath(); x.arc(cx, cy, 52, Math.PI, 0); x.fill();
      x.fillStyle = '#3d4a3a'; x.fillRect(22, cy, w - 44, 6);
      x.fillStyle = '#5a1f16'; x.textAlign = 'center'; x.font = 'bold 44px Georgia, serif'; x.fillText('NEW', cx, 90); x.fillText('DAWN', cx, 136);
      x.font = 'italic 20px Georgia, serif'; x.fillText('one family', cx, cy + 50); x.fillText('one faith', cx, cy + 78); x.fillText('one flame', cx, cy + 106);
    });
    ART.gate = ct(1024, 160, (x, w, h) => {
      x.fillStyle = '#4a3222'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#523826' : '#46301f'; x.fillRect(0, i * h / 6, w, h / 6 - 3); }
      x.fillStyle = '#efe2c4'; x.textAlign = 'center'; x.font = 'bold 76px Georgia, serif'; x.fillText('NEW DAWN FELLOWSHIP', w / 2, 92);
      x.font = 'italic 30px Georgia, serif'; x.fillText('Members only  ·  Est. 1987', w / 2, 138);
    });
    ART.noTresp = ct(256, 160, (x, w, h) => {
      x.fillStyle = '#f1efe8'; x.fillRect(0, 0, w, h); x.fillStyle = '#b3261e'; x.fillRect(0, 0, w, 62);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold 30px Arial, sans-serif'; x.fillText('NO', w / 2, 28); x.fillText('TRESPASSING', w / 2, 56);
      x.fillStyle = '#1c1c1c'; x.font = 'bold 22px Arial, sans-serif'; x.fillText('PRIVATE PROPERTY', w / 2, 100); x.font = '16px Arial, sans-serif'; x.fillText('Violators will be prosecuted', w / 2, 134);
    });
    ART.topo = ct(256, 192, (x, w, h) => {
      x.fillStyle = '#e8e0c6'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#8a7a52'; x.lineWidth = 1.5;
      for (let r = 12; r < 200; r += 14) { x.beginPath(); for (let a = 0; a <= 6.3; a += 0.2) { const rr = r * (1 + 0.18 * Math.sin(a * 3 + r * 0.1)); x.lineTo(w * 0.4 + Math.cos(a) * rr, h * 0.45 + Math.sin(a) * rr * 0.7); } x.stroke(); }
      x.strokeStyle = '#3a6a9a'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, h * 0.8); x.bezierCurveTo(w * 0.3, h * 0.7, w * 0.6, h, w, h * 0.75); x.stroke();
      x.fillStyle = '#b3261e'; for (const [px, py] of [[0.62, 0.3], [0.7, 0.42], [0.55, 0.52]]) { x.beginPath(); x.arc(w * px, h * py, 5, 0, 6.3); x.fill(); }
      x.strokeStyle = '#4a3420'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    });
    ART.chores = ct(256, 192, (x, w, h) => {
      x.fillStyle = '#b08658'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) { x.fillStyle = 'rgba(60,40,20,0.25)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      const notes = [[18, 18, '#f4efe0'], [96, 12, '#f0e28a'], [172, 22, '#f4efe0'], [30, 104, '#cfe3f0'], [118, 98, '#f4efe0'], [188, 110, '#f0e28a']];
      for (const [nx, ny, c] of notes) { x.fillStyle = c; x.fillRect(nx, ny, 62, 70); x.fillStyle = '#555'; for (let l = 0; l < 5; l++) x.fillRect(nx + 6, ny + 14 + l * 10, 40 + (l * 7) % 12, 2); x.fillStyle = '#b3261e'; x.beginPath(); x.arc(nx + 31, ny + 5, 4, 0, 6.3); x.fill(); }
      x.strokeStyle = '#4a3420'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
    });
    ART.chain = ct(64, 64, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.strokeStyle = '#c7ccd0'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke();
    });
    ART.chain.wrapS = ART.chain.wrapT = THREE.RepeatWrapping;
    ART.chainMat = new THREE.MeshStandardMaterial({ map: ART.chain, alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.45 });
    return ART;
  }
  /** Chain-link fence on steel posts with barbed wire on top (the map boundary; W.bounds does the blocking). */
  function chainFence(x0, z0, x1, z1, h) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), g = new THREE.PlaneGeometry(len, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.7, uv.getY(i) * h / 0.7);
    const m = new THREE.Mesh(g, art().chainMat);
    m.position.set((x0 + x1) / 2, h / 2 + 0.05, (z0 + z1) / 2); m.rotation.y = Math.atan2(-dz, dx); m.receiveShadow = true; L.scene.add(m);
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) { const k = i / n, x = x0 + dx * k, z = z0 + dz * k; L.cyl('steel', x, (h + 0.45) / 2, z, 0.045, h + 0.45, 0, 0, true); }
    L.pipe('steel', x0, h, z0, x1, h, z1, 0.03);
    for (let j = 1; j <= 3; j++) L.pipe('steel', x0, h + j * 0.13, z0, x1, h + j * 0.13, z1, 0.008);
  }

  // ------------------------------------------------------------ the main house
  function mainHouse(rnd) {
    const x0 = -12, x1 = 12, z0 = -12, z1 = 10;
    const OUT = [[0, 0.6, 'stone'], [0.6, RF, 'sidingBeige']], HALLIN = [[0, HH, 'plankWall']], GIN = [[0, F, 'plywood']];
    const IN1 = [[0, 1.0, 'woodDark'], [1.0, F1, 'wallpaper']], IN2 = [[F, H2, 'wallpaper2']];
    const dress = { shutter: 'shutterBrown' };
    // ground floor: dining hall (south-west), kitchen (south-east); office, stair hall and pantry over the basement
    L.box(x0, 0, -2, 2, G, z1, 'floorWood'); L.box(2, 0, -2, x1, G, z1, 'checker');
    const rear = (a, b, c, d, top) => L.box(a, -0.25, b, c, G, d, 'ceiling', { top, side: 'trim', bottom: true });
    rear(x0, z0, -5, -2, 'carpetBeige'); rear(-5, z0, 1, -2, 'floorWood'); rear(1, z0, 3, -2, 'checker'); rear(9, z0, x1, -2, 'checker'); rear(3, -10.5, 9, -2, 'checker');
    // ground floor walls
    K.wall('x', x0, x1, z1, 0, F, [[-8.2, -6.6, G, 2.35], [-5.6, -3.6, 1.0, 2.3], [-2.6, -1.0, G, 2.35], [4, 6.5, 1.1, 2.3], [8.5, 11, 1.1, 2.3]], OUT, IN1, 1, dress);
    K.wall('x', x0, x1, z0, 0, F, [[-10.5, -8, 1.1, 2.3], [5, 7, 1.3, 2.3], [10, 11.5, G, 2.35]], OUT, IN1, -1, dress);
    const wHoles1 = [[-6, -4.5, G, 2.35], [2, 4, G, 2.6]];
    K.wall('z', z0, -10, x0, 0, F, wHoles1, OUT, IN1, -1, dress); K.wall('z', -10, 8, x0, 0, F, wHoles1, HALLIN, IN1, -1, {}); K.wall('z', 8, z1, x0, 0, F, wHoles1, OUT, IN1, -1, dress);
    const eHoles1 = [[-11, -9.2, 1.1, 2.3], [5, 6.6, G, 2.35]];
    K.wall('z', z0, -8, x1, 0, F, eHoles1, OUT, IN1, 1, dress); K.wall('z', -8, z1, x1, 0, F, eHoles1, GIN, IN1, 1, {});
    K.wall('x', x0 + T / 2, x1 - T / 2, -2, G, F1, [[-9, -7.6, G, 2.35], [-4.4, -2.4, G, 2.6], [6, 7.5, G, 2.35]], null, IN1, 0);
    K.wall('z', z0 + T / 2, -2 - T / 2, -5, G, F1, [[-4, -2.6, G, 2.35]], null, IN1, 0);
    K.wall('z', z0 + T / 2, -2 - T / 2, 1, G, F1, [[-5, -3.6, G, 2.35]], null, IN1, 0);
    K.wall('z', -2 + T / 2, z1 - T / 2, 2, G, F1, [[1, 4.4, G, 2.6], [6.2, 8.2, 1.05, 2.0]], null, IN1, 0);
    // main stair along the back wall of the stair hall, climbing east straight into the armory door
    steps('x', -4.75, 0.5, z0 + T / 2, -10.5, G, F, 1, 'woodDark', 'carpet');
    // the basement stair in the pantry (down toward the east), railed on the open sides
    steps('x', 3, 9, z0 + 0.25, -10.5, BF, G, -1, 'woodDark', 'woodDark');
    K.railingX(3, 9, -10.5, G); K.railingZ(z0 + T / 2, -10.5, 9, G);
    // upper floor: dorms, master bedroom, kids' dorm, landing, armory
    slab(x0, -2, 2, z1, F, 'floorWood'); slab(2, -2, x1, z1, F, 'carpetBeige'); slab(x0, z0, -5, -2, F, 'carpetBeige');
    slab(-5, -10.5, 1, -2, F, 'floorWood'); slab(0.5, z0, 1, -10.5, F, 'floorWood'); slab(1, z0, x1, -2, F, 'floorWood');
    K.railingX(-4.875, -0.1, -10.5, F);
    K.wall('x', x0, x1, z1, F, RF, [[-10, -7.5, 4, 5.4], [-5, -2.5, 4, 5.4], [-0.5, 1.5, 4, 5.4], [4, 6.5, 4, 5.4], [8.5, 11, 4, 5.4]], OUT, IN2, 1, dress);
    K.wall('x', x0, x1, z0, F, RF, [[-10, -7.5, 4, 5.4], [10, 11.6, 4.2, 5.4]], OUT, IN2, -1, dress);
    const wHoles2 = [[-9.9, -8.5, F, F + 2.25], [2, 5, 4, 5.4]];
    K.wall('z', z0, -10, x0, F, RF, wHoles2, OUT, IN2, -1, dress); K.wall('z', -10, 8, x0, F, RF, wHoles2, HALLIN, IN2, -1, {}); K.wall('z', 8, z1, x0, F, RF, wHoles2, OUT, IN2, -1, dress);
    K.wall('z', z0, z1, x1, F, RF, [[-10, -8.2, 4, 5.4], [3, 4.6, F, F + 2.3], [7, 9, 4, 5.4]], OUT, IN2, 1, dress);
    K.wall('x', x0 + T / 2, x1 - T / 2, -2, F, H2, [[-9, -7.6, F, F + 2.25], [-4, -2, F, F + 2.4], [6, 7.4, F, F + 2.25]], null, IN2, 0);
    K.wall('z', z0 + T / 2, -2 - T / 2, -5, F, H2, [[-4.2, -2.8, F, F + 2.25]], null, IN2, 0);
    K.wall('z', z0 + T / 2, -2 - T / 2, 1, F, H2, [[-11.85, -10.5, F, F + 2.3], [-5, -3.6, F, F + 2.25]], null, IN2, 0);
    K.wall('z', -2 + T / 2, z1 - T / 2, 2, F, H2, [[3, 4.4, F, F + 2.25]], null, IN2, 0);
    // ceiling, tin hip roof, brick chimney on the back wall
    L.box(x0, H2, z0, x1, RF, z1, 'ceiling', { side: 'trim', bottom: true });
    K.hipRoof(0, -1, 24, 22, RF, 2.6, 'roofTin');
    L.box(-3, 0, -12.9, -1.6, RF + 3.4, z0 - T / 2, 'brick'); deco(-3.15, RF + 3.4, -13.05, -1.45, RF + 3.6, -12.05, 'concrete');
    // front porch of the dining hall
    L.box(-11.5, 0, z1, 1.5, 0.22, 12.6, 'floorWood');
    L.box(-11.7, 2.85, z1 + T / 2, 1.7, 3.0, 12.8, 'roofTin', { bottom: true });
    for (const x of [-11.3, -5, 1.3]) L.box(x - 0.1, 0.22, 12.3, x + 0.1, 2.85, 12.5, 'woodDark');
    // --- dining hall: two long tables with benches, a buffet under the serving hatch, the chore board
    for (const z of [1.2, 5.8]) { K.table(-10.5, z, -4.5, z + 1, G); for (const bz of [z - 0.7, z + 1.3]) L.box(-10.3, G, bz, -4.7, G + 0.45, bz + 0.4, 'wood'); }
    L.box(1.1, G, 5.9, 2 - T / 2, 0.95, 8.5, 'cabinet', { top: 'counter' });
    K.plane(art().chores, 1.3, 0.98, -6.2, 1.75, -2 + T / 2 + 0.015, 0);
    K.painting(-0.4, 1.9, -2 + T / 2 + 0.03, 0, 1.1, 0.8);
    hangLamp(-7.5, F1, 3.5, 0.5); hangLamp(-2.5, F1, 3.5, 0.5);
    // --- kitchen: counters and stove on the east wall, island with stools, fridge, sink under the south window
    L.box(x1 - 0.7, G, -2 + T / 2, x1 - T / 2, 0.95, 1, 'cabinet', { top: 'counter' });
    L.box(x1 - 0.7, G, 1, x1 - T / 2, 0.97, 1.8, 'appliance'); deco(x1 - 0.6, 0.97, 1.1, x1 - 0.2, 0.99, 1.7, 'paintDark');
    L.box(x1 - 0.7, G, 1.8, x1 - T / 2, 0.95, 4.6, 'cabinet', { top: 'counter' });
    L.box(x1 - 0.4, 1.7, -1.8, x1 - T / 2, 2.5, 4.6, 'cabinet', { ao: false });
    L.box(8.4, G, z1 - 0.7, x1 - 0.7, 0.95, z1 - T / 2, 'cabinet', { top: 'counter' }); deco(9.2, 0.9, z1 - 0.6, 10.2, 0.96, z1 - 0.25, 'steel');
    L.box(5.5, G, 3, 8.5, 0.95, 4.2, 'cabinet', { top: 'counter' });
    L.box(2 + T / 2, G, z1 - 1.0, 3.0, 1.95, z1 - T / 2, 'appliance');
    const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
    P('stool', 6.2, 4.9, 0, G); P('stool', 7.6, 4.9, 0, G);
    K.roomLight(7, F1, 3);
    // --- office: desk, filing cabinets, bookshelf, the map of the valley
    K.table(-10, -8.2, -7.8, -7.2, G); K.chair(-8.9, -6.6, G);
    L.box(x0 + T / 2, G, z0 + T / 2, -11.2, 1.4, -10.6, 'paintGrey'); L.box(-11.2, G, z0 + T / 2, -10.5, 1.4, -11.3, 'paintGrey');
    L.box(-5.8, G, -11, -5 - T / 2, 2.2, -8, 'woodDark');
    for (let i = 0; i < 4; i++) for (let z = -10.9; z < -8.2; z += 0.12 + rnd() * 0.08) deco(-5.75, 0.25 + i * 0.5, z, -5.25, 0.55 + i * 0.5 - rnd() * 0.1, z + 0.08, rnd() < 0.3 ? 'paintRed' : rnd() < 0.5 ? 'shutterBlue' : 'cabinet');
    K.plane(art().topo, 1.4, 1.05, -7.2, 1.8, z0 + T / 2 + 0.015, 0);
    K.roomLight(-8.5, F1, -7);
    // --- stair hall and pantry
    L.box(0.3, G, -8.5, 1 - T / 2, 0.5, -6.5, 'wood');
    K.roomLight(-2, F1, -6);
    shelf(1.4, -2.7, 5.6, -2 - T / 2, G, 2.2, rnd); shelf(8, -2.7, 11.8, -2 - T / 2, G, 2.2, rnd);
    L.box(9.8, G, -7, x1 - T / 2, 1.0, -6, 'appliance');
    for (let i = 0; i < 5; i++) K.put('sandbag', K.blobGeo(i % 3), 5 + (i % 3) * 0.6, G + 0.2 + (i > 2 ? 0.35 : 0), -8 + (i % 2) * 0.1, 0.35, 0.2, 0.28, i);
    solid(4.6, G, -8.4, 6.6, G + 0.7, -7.6);
    K.roomLight(6, F1, -6.5);
    // --- dorms: bunk rows along both long walls, footlockers down the middle
    for (const x of [-11.6, -6.6, -1.2]) bunk(x, -1.8, x + 1, 0.2, F);
    for (const x of [-11.6, -9.2, -6.8, -4.4, -2, 0.4]) bunk(x, 7.8, x + 1, 9.8, F);
    for (const x of [-10.5, -6, -1.5]) L.box(x, F, 3.2, x + 1.1, F + 0.5, 3.8, 'woodDark', { top: 'wood' });
    deco(-9, F + 0.01, 4.4, -3, F + 0.02, 6.6, 'rug');
    K.roomLight(-7.5, H2, 4); K.roomLight(-2, H2, 4);
    // --- master bedroom
    K.bed(8.6, 6.8, 11.8, 9.6, F, 'z+'); L.box(2 + T / 2, F, 6, 2.8, F + 1.1, 8, 'woodDark'); L.box(9, F, -2 + T / 2, 11.6, F + 2.1, -1.2, 'woodDark');
    K.table(3, 0.5, 4.5, 1.4, F); K.chair(3.75, 1.9, F); deco(4.5, F + 0.01, 3, 8.5, F + 0.02, 6, 'rug');
    K.painting(7.5, F + 1.6, z1 - T / 2 - 0.03, Math.PI, 1.0, 0.8);
    K.roomLight(7, H2, 4);
    // --- kids' dorm
    K.bed(-7, -11.8, -5.2, -9.9, F, 'z-'); K.bed(-11.8, -6.8, -10, -4.8, F, 'x-');
    L.box(-8.4, F, -5.2, -7.4, F + 0.55, -4.6, 'paintCherry'); deco(-10, F + 0.01, -8, -7.5, F + 0.02, -6, 'rug');
    K.roomLight(-8.5, H2, -7);
    // --- landing: armchair and a side table
    K.chair(-3.5, -6, F); K.table(-2, -6.4, -1.2, -5.6, F);
    K.roomLight(-2, H2, -6);
    // --- armory: rifle racks on the back wall, ammo table, lockers
    L.box(2.8, F, z0 + T / 2, 9.6, F + 0.3, -11.4, 'woodDark'); deco(2.8, F + 0.3, z0 + T / 2, 9.6, F + 1.9, -11.82, 'plywood');
    for (let x = 3.1; x < 9.4; x += 0.38) { deco(x - 0.03, F + 0.38, -11.8, x + 0.03, F + 1.45, -11.7, 'paintDark'); deco(x - 0.05, F + 0.3, -11.8, x + 0.05, F + 0.62, -11.66, 'woodDark'); }
    for (const y of [F + 1.55, F + 1.72]) deco(2.9, y, -11.8, 9.5, y + 0.05, -11.62, 'woodDark');
    K.table(5, -7.5, 8, -6, F);
    for (let i = 0; i < 6; i++) deco(5.2 + i * 0.45, F + 0.78, -7.2, 5.5 + i * 0.45, F + 0.98, -6.4, i % 2 ? 'olive' : 'paintGreen');
    for (let z = -7.8; z < -4.6; z += 0.66) { L.box(x1 - 0.6, F, z, x1 - T / 2, F + 2, z + 0.62, 'paintGreen', { ao: false }); deco(x1 - 0.62, F + 1.5, z + 0.1, x1 - 0.6, F + 1.8, z + 0.5, 'paintDark'); }
    P('crate', 3, -4, 0.2, F); P('crateSmall', 10.4, -9.6, 0.3, F); P('crateSmall', 3.2, -5.3, -0.2, F);
    K.roomLight(6.5, H2, -7);
  }

  // ------------------------------------------------------------ the basement: laundry (west) and supply room (east)
  function basement(rnd) {
    const P = (kind, x, z, ry) => CF.PH.place(kind, x, BF, z, ry || 0);
    L.box(-12, BF - 0.2, -12, 12, BF, -2, 'concrete', { skip: [3] });
    const w = (x0, z0, x1, z1) => L.box(x0, BF, z0, x1, -0.25, z1, 'concreteDark');
    w(-12, -2.25, 12, -2); w(-12, -12, -11.5, -11.75); w(-8.5, -12, 12, -11.75); w(-12, -11.75, -11.75, -2.25); w(11.75, -11.75, 12, -2.25);
    K.wall('z', -11.75, -2.25, 0, BF, -0.25, [[-8, -6.5, BF, BF + 2.2]], null, [[BF, 0, 'plaster']], 0);
    // bulkhead: a concrete stair up to the back yard, cellar doors thrown open either side
    L.box(-11.5, BF, -17, -11.25, 0.3, -12, 'concreteDark'); L.box(-8.75, BF, -17, -8.5, 0.3, -12, 'concreteDark');
    steps('z', -17, -12, -11.25, -8.75, BF, 0.02, -1, 'concrete');
    deco(-12.9, 0.02, -16.6, -11.5, 0.1, -12.2, 'woodDark'); deco(-8.5, 0.02, -16.6, -7.1, 0.1, -12.2, 'woodDark');
    for (const x of [-12.2, -7.8]) deco(x - 0.05, 0.1, -14.6, x + 0.05, 0.12, -14.2, 'steel');
    // laundry: washers and dryers, water heater, folding table, clothes line
    for (let i = 0; i < 6; i++) {
      const x = -11.6 + i * 0.8;
      L.box(x, BF, -3.0, x + 0.72, BF + 0.95, -2.25, 'appliance');
      L.cyl('paintDark', x + 0.36, BF + 0.5, -3.01, 0.22, 0.02, Math.PI / 2, 0, true); deco(x + 0.05, BF + 0.8, -3.02, x + 0.67, BF + 0.9, -3.0, 'chrome');
    }
    L.cyl('appliance', -1, BF + 0.85, -10.8, 0.36, 1.7, 0, 0, true); solid(-1.4, BF, -11.2, -0.6, BF + 1.7, -10.4, 'metal');
    L.pipe('chrome', -1, BF + 1.7, -10.8, -1, -0.25, -10.8, 0.03);
    K.table(-7.2, -7.6, -4.6, -6.6, BF);
    for (const [x, z] of [[-6.8, -7.1], [-5.6, -7.2]]) deco(x - 0.25, BF + 0.78, z - 0.2, x + 0.25, BF + 0.98, z + 0.2, 'plywood');
    L.pipe('rubber', -11.6, -0.6, -5, -1.2, -0.6, -5, 0.01);
    const sheet = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.9, side: THREE.DoubleSide });
    for (const x of [-10.4, -8.2, -3]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), sheet); m.position.set(x, -1.1, -5); m.castShadow = true; L.scene.add(m); }
    P('bin', -3.4, -3.3); P('boxStack', -11.2, -5.8, 0.2);
    K.roomLight(-6, -0.25, -8.5); K.roomLight(-6, -0.25, -4);
    // supply room: steel shelving, crates, drums, generator, a cot
    shelf(11.2, -9.6, 11.75, -3.2, BF, 2.3, rnd); shelf(1, -2.85, 7, -2.25, BF, 2.3, rnd);
    P('generator', 9, -5.2, Math.PI / 2); P('crate', 3.4, -8.6, 0.15); P('crate', 3.4, -7.2, -0.1); P('crateSmall', 4.7, -8.3, 0.4);
    P('drum', 6.3, -6.8); P('drum', 7.0, -7.3); P('barrel', 5.6, -7.4);
    L.box(0.4, BF, -5.6, 2.2, BF + 0.45, -4.8, 'olive'); deco(0.45, BF + 0.45, -5.55, 2.15, BF + 0.55, -4.85, 'canvasOlive');
    K.roomLight(6, -0.25, -6);
  }

  // ------------------------------------------------------------ the meeting hall (west) with its catwalk
  function hall() {
    const x0 = -30, x1 = -12, z0 = -10, z1 = 8;
    const OUT = [[0, 0.7, 'stone'], [0.7, HH, 'boardBrown']], IN = [[0, 1.1, 'woodDark'], [1.1, HH, 'plankWall']];
    L.box(x0, 0, z0, x1, G, z1, 'floorWood');
    K.wall('x', x0, x1, z1, 0, HH, [[-28, -26, 1.2, 4.6], [-22, -19.6, G, 2.8], [-16, -14, 1.2, 4.6]], OUT, IN, 1, { shutter: 'shutterBrown' });
    K.wall('x', -22, x1, z0, 0, HH, [[-20.4, -18.4, 4.2, 5.8], [-17.4, -15.8, G, 2.35], [-15, -13, 4.2, 5.8]], OUT, IN, -1, {});
    K.wall('z', z0, z1, x0, 0, HH, [[-8.8, -7.2, G, 2.35], [-5.5, -3, 1.4, 4.6], [2.5, 5, 1.4, 4.6]], OUT, IN, -1, {});
    L.box(x1 - T / 2, RF, z0, x1 + T / 2, HH, z1, 'plankWall');
    // open ceiling with exposed beams; a tin gable roof above
    L.box(x0, HH, z0, x1, HH + 0.2, z1, 'plankWall', { side: 'trim', bottom: true });
    for (let x = x0 + 1.5; x < x1; x += 3) deco(x - 0.15, HH - 0.45, z0 + T / 2, x + 0.15, HH, z1 - T / 2, 'woodDark');
    deco(x0 + T / 2, HH - 0.3, -1.15, x1 - T / 2, HH, -0.85, 'woodDark');
    K.gableRoof((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, HH + 0.2, 3.2, 'boardBrown', 'roofTin', false, true);
    K.roofCap(x0 - 0.55, z0 + 0.1, x1 + 0.55, z1 + 0.55, HH + 0.2);
    L.box(-22.6, 0, z1, -19, 0.12, 9.5, 'concrete');
    // stage, podium, the New Dawn banner
    L.box(x0 + T / 2, 0, -6, -26, 0.75, 6, 'floorWood', { side: 'woodDark' });
    L.box(-26, 0, -2, -25.4, 0.4, 2, 'woodDark', { top: 'floorWood' });
    L.box(-27.8, 0.75, -0.5, -27.1, 1.9, 0.5, 'woodDark', { top: 'wood' });
    K.plane(art().banner, 3.2, 4.8, x0 + T / 2 + 0.015, 3.9, 0, Math.PI / 2);
    K.chair(-28.6, -3, 0.75); K.chair(-28.6, 3, 0.75);
    for (const z of [-4.6, 4.6]) { L.cyl('chrome', -26.6, 1.35, z, 0.03, 1.2, 0, 0, true); K.sph('lampWarm', -26.6, 2.0, z, 0.06); }
    // pews either side of the aisle
    for (let x = -24.2; x < -14; x += 1.4) { pew(x, -5.6, -1); pew(x, 1, 5.6); }
    // catwalk along the north wall: tower door to the kids' dorm, with a stair down into the hall
    L.box(-24, F - 0.2, z0 + T / 2, x1 - T / 2, F, -8.2, 'floorWood', { bottom: true, side: 'woodDark' });
    L.box(-21.5, F - 0.2, -8.2, -20, F, -6.55, 'floorWood', { bottom: true, side: 'woodDark' });
    for (const x of [-22.6, -17.5, -13]) L.box(x - 0.12, 0, -8.45, x + 0.12, F - 0.2, -8.2, 'woodDark');
    L.box(-21.5, 0, -6.8, -21.25, F - 0.2, -6.55, 'woodDark');
    K.railingX(-24, -21.5, -8.2, F); K.railingX(-20, x1 - T / 2, -8.2, F); K.railingX(-21.5, -20, -6.55, F); K.railingZ(-8.2, -6.55, -21.5, F);
    steps('x', -20, -14.5, -7.85, -6.55, G, F, -1, 'woodDark', 'woodDark');
    // lamps on chains, a long table of candles along the south wall
    hangLamp(-25, HH - 0.45, 0, 1.4); hangLamp(-19, HH - 0.45, 0, 1.4); hangLamp(-14, HH - 0.45, 0, 1.4);
    K.table(-25.5, 6.6, -23, 7.6, G);
    for (let i = 0; i < 5; i++) { const x = -25.2 + i * 0.5; L.cyl('trim', x, G + 0.9, 7.1, 0.03, 0.24, 0, 0, true); K.sph('lampWarm', x, G + 1.05, 7.1, 0.025); }
  }

  // ------------------------------------------------------------ the Big Tower (north of the stage)
  function tower() {
    const x0 = -30, x1 = -22, z0 = -18, z1 = -10;
    const OUT = [[0, 0.7, 'stone'], [0.7, TH + 0.2, 'sidingBeige']], IN = [[0, TH + 0.2, 'plankWall']], HSIDE = [[0, HH, 'plankWall'], [HH, TH + 0.2, 'sidingBeige']];
    const dress = { shutter: 'shutterBrown' };
    L.box(x0, 0, z0, x1, G, z1, 'floorWood');
    // ground floor
    K.wall('x', x0, x1, z1, 0, F, [[-27, -25.5, G, 2.35]], HSIDE, IN, 1, {});
    K.wall('x', x0, x1, z0, 0, F, [], OUT, IN, -1, dress);
    K.wall('z', z0, z1, x0, 0, F, [[-14.6, -13.2, G, 2.35]], OUT, IN, -1, dress);
    K.wall('z', z0, z1, x1, 0, F, [[-15.5, -13.5, 1.2, 2.3]], OUT, IN, 1, dress);
    // middle floor
    K.wall('x', x0, x1, z1, F, F3, [[-23.8, -22.4, F, F + 2.25]], HSIDE, IN, 1, {});
    K.wall('x', x0, x1, z0, F, F3, [[-27.5, -25, 4.4, 5.6]], OUT, IN, -1, dress);
    K.wall('z', z0, z1, x0, F, F3, [[-14, -12, 4.4, 5.6]], OUT, IN, -1, dress);
    K.wall('z', z0, z1, x1, F, F3, [[-16, -14, 4.4, 5.6]], OUT, IN, 1, dress);
    // lookout: wide windows all round
    K.wall('x', x0, x1, z1, F3, TH + 0.2, [[-29, -23, 7.4, 8.9]], HSIDE, IN, 1, {});
    K.wall('x', x0, x1, z0, F3, TH + 0.2, [[-29, -23, 7.4, 8.9]], OUT, IN, -1, {});
    K.wall('z', z0, z1, x0, F3, TH + 0.2, [[-17, -11, 7.4, 8.9]], OUT, IN, -1, {});
    K.wall('z', z0, z1, x1, F3, TH + 0.2, [[-17, -11, 7.4, 8.9]], OUT, IN, 1, {});
    // stairs: ground to middle along the north wall (east), middle to lookout beside it (west)
    steps('x', x0 + T / 2, -24, z0 + T / 2, -16.5, G, F, 1, 'woodDark', 'woodDark');
    slab(x0, -16.5, x1, z1, F, 'floorWood'); slab(-24, z0, x1, -16.5, F, 'floorWood');
    K.railingX(x0 + T / 2, -24.3, -16.45, F);
    steps('x', x0 + T / 2, -24.2, -16.3, -15, F, F3, -1, 'woodDark', 'woodDark');
    slab(x0, z0, x1, -16.4, F3, 'floorWood'); slab(x0, -14.9, x1, z1, F3, 'floorWood'); slab(-24.2, -16.4, x1, -14.9, F3, 'floorWood');
    K.railingX(x0 + T / 2, -24.2, -16.4, F3); K.railingX(-28.8, -24.2, -14.9, F3); K.railingZ(-16.4, -14.9, -24.2, F3);
    // ceiling and pyramid roof with a weather vane
    L.box(x0, TH, z0, x1, TH + 0.2, z1, 'ceiling', { side: 'trim', bottom: true });
    K.hipRoof(-26, -14, 8, 8, TH + 0.2, 2.8, 'roofTin');
    L.pipe('paintDark', -26, TH + 2.9, -14, -26, TH + 4, -14, 0.03); deco(-26.5, TH + 3.7, -14.02, -25.5, TH + 3.9, -13.98, 'paintDark');
    // ground floor: storage
    L.box(-23.2, G, -12, x1 - T / 2, 2.2, -10.2, 'woodDark');
    const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
    P('crate', -28.9, -11.2, 0.1, G); P('boxStack', -27.8, -15.3, 0.3, G); P('drum', -23.2, -15.4, 0, G);
    K.roomLight(-26, F1, -13);
    // middle floor: radio desk and the valley map
    K.table(x0 + T / 2 + 0.05, -13.8, -28.9, -11.2, F); K.chair(-28.3, -12.5, F);
    L.box(-29.75, F + 0.78, -13.3, -29.15, F + 1.2, -12.3, 'paintDark', { noCol: true }); for (let i = 0; i < 4; i++) K.sph(i % 2 ? 'lampGreen' : 'lampAmber', -29.13, F + 1.05, -13.1 + i * 0.22, 0.03);
    K.plane(art().topo, 1.5, 1.1, x1 - T / 2 - 0.015, F + 1.6, -12.3, -Math.PI / 2);
    K.roomLight(-26, F3 - 0.25, -12.5);
    // lookout: sandbagged sills, a cot, an ammo crate, a spotting scope
    bags(-29.6, -17.5, -24.8, -17.5, 2, F3); bags(-29.6, -10.5, -24.6, -10.5, 2, F3); bags(-22.5, -17.2, -22.5, -12.2, 2, F3);
    L.box(-29.7, F3, -13.6, -28.9, F3 + 0.4, -11.6, 'olive'); P('crateSmall', -23, -10.9, 0.2, F3);
    for (const [dx, dz] of [[0.3, 0], [-0.15, 0.26], [-0.15, -0.26]]) L.pipe('paintDark', -24 + dx, F3, -14 + dz, -24, F3 + 1.3, -14, 0.02);
    L.cyl('paintDark', -24, F3 + 1.38, -14, 0.06, 0.5, 0, Math.PI / 2, true);
    K.roomLight(-26, TH, -14);
  }

  // ------------------------------------------------------------ the garage (east), flat roof you can walk on
  function garage(rnd) {
    const x0 = 12, x1 = 26, z0 = -8, z1 = 10;
    const OUT = [[0, 0.5, 'concreteDark'], [0.5, F, 'metalSiding']], IN = [[0, F, 'plywood']];
    L.box(x0, 0, z0, x1, 0.1, z1, 'concrete');
    K.wall('x', x0 + T / 2, x1, z1, 0, F, [[13.8, 19.8, 0, 2.7], [21.5, 24.5, 1.2, 2.3]], OUT, IN, 1, { noLeaf: true });
    K.wall('x', x0 + T / 2, x1, z0, 0, F, [[15, 17.5, 1.2, 2.3], [22, 23.5, 0.1, 2.35]], OUT, IN, -1, {});
    K.wall('z', z0, z1, x1, 0, F, [[-5, -3.5, 0.1, 2.35], [0, 3, 1.2, 2.3]], OUT, IN, 1, {});
    deco(13.8, 2.4, z1 - 0.45, 19.8, 2.7, z1 - 0.2, 'garageDoor');
    L.box(x0, F1, z0, x1, F, z1, 'ceiling', { top: 'concreteDark', side: 'metalSiding', bottom: true });
    // parapet, with a gap where the outside stair arrives
    const par = (a, b, c, d) => L.box(a, F, b, c, F + 0.7, d, 'metalSiding', { top: 'trim' });
    par(x0 + T / 2, z1 - 0.2, x1 + 0.1, z1 + 0.1); par(x0 + T / 2, z0 - 0.1, x1 + 0.1, z0 + 0.2); par(x1 - 0.2, z0 + 0.2, x1 + 0.1, 2); par(x1 - 0.2, 3.5, x1 + 0.1, z1 - 0.2);
    const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
    P('ac', 20, 1.5, 0, F); P('vent', 15.5, -4.5, 0, F); P('vent', 23, 6.5, 0, F);
    // outside stair up to the roof
    openSteps('z', 3.5, 10, 26.2, 27.5, 0, F, -1, 'woodDark');
    L.box(x1 + 0.1, F - 0.2, 2, 27.6, F, 3.5, 'floorWood', { bottom: true, side: 'woodDark' });
    for (const z of [2.1, 3.4]) L.box(27.4, 0, z - 0.1, 27.6, F - 0.2, z + 0.1, 'woodDark');
    K.railingZ(2, 3.5, 27.55, F); K.railingX(x1 + 0.1, 27.6, 2.05, F);
    // inside: a sedan on blocks, workbench and pegboard, shelves, tyres and drums
    K.car(16.8, 3.6, false, 'paintMint');
    L.box(14, 0.1, z0 + T / 2, 19, 0.95, -7.2, 'woodDark', { top: 'wood' }); deco(14, 1.3, z0 + T / 2, 19, 2.4, z0 + T / 2 + 0.03, 'plywood');
    for (let i = 0; i < 9; i++) deco(14.3 + i * 0.52, 1.5 + (i % 3) * 0.28, z0 + T / 2 + 0.03, 14.4 + i * 0.52, 1.9 + (i % 3) * 0.28, z0 + T / 2 + 0.07, i % 2 ? 'paintRed' : 'steel');
    deco(15, 0.95, -7.7, 15.6, 1.15, -7.4, 'paintRed'); deco(17.2, 0.95, -7.75, 17.5, 1.3, -7.45, 'paintGrey');
    shelf(x1 - 0.7, 4.5, x1 - T / 2, 9.3, 0.1, 2.3, rnd);
    K.tires(24.6, -6.6, 4); P('drum', 23.4, -6.9, 0, 0.1); P('barrel', 22.6, -6.5, 0, 0.1);
    // engine hoist
    L.pipe('steel', 21.4, 0.1, 1.2, 21.4, 2.4, 1.2, 0.05); L.pipe('steel', 21.4, 2.4, 1.2, 19.4, 2.2, 1.2, 0.04); L.pipe('steel', 20.6, 0.12, 0.6, 22.2, 0.12, 0.6, 0.04);
    L.pipe('steel', 20.6, 0.12, 1.8, 22.2, 0.12, 1.8, 0.04); L.pipe('rubber', 19.4, 2.2, 1.2, 19.4, 1.4, 1.2, 0.01); solid(21.2, 0.1, 1.0, 21.6, 2.4, 1.4, 'metal');
    K.roomLight(18, F1, 0); K.roomLight(18, F1, 6);
  }

  // ------------------------------------------------------------ vehicles and outbuildings
  function pickup(x, z, paint) { // along X, nose at +X
    deco(x - 2.5, 0.45, z - 0.9, x + 2.6, 0.7, z + 0.9, 'paintDark');
    L.box(x + 1.0, 0.7, z - 0.95, x + 2.6, 1.35, z + 0.95, paint, { noCol: true });
    L.box(x - 0.3, 0.7, z - 0.95, x + 1.0, 1.45, z + 0.95, paint, { noCol: true }); L.box(x - 0.3, 1.45, z - 0.9, x + 0.9, 2.05, z + 0.9, paint, { noCol: true });
    deco(x + 0.9, 1.5, z - 0.8, x + 0.96, 2.0, z + 0.8, 'glassDay'); deco(x - 0.2, 1.5, z - 0.92, x + 0.8, 1.95, z + 0.92, 'glassDay'); deco(x - 0.33, 1.55, z - 0.7, x - 0.29, 1.95, z + 0.7, 'glassDay');
    deco(x - 2.5, 0.7, z - 0.95, x - 0.35, 0.8, z + 0.95, paint);
    for (const s of [-1, 1]) L.box(x - 2.5, 0.8, z + s * 0.9 - 0.05, x - 0.35, 1.35, z + s * 0.9 + 0.05, paint, { noCol: true });
    L.box(x - 2.55, 0.8, z - 0.85, x - 2.45, 1.35, z + 0.85, paint, { noCol: true });
    deco(x + 2.6, 0.45, z - 0.95, x + 2.75, 0.7, z + 0.95, 'chrome'); deco(x - 2.68, 0.45, z - 0.95, x - 2.52, 0.7, z + 0.95, 'chrome');
    deco(x + 2.6, 0.8, z - 0.6, x + 2.64, 1.25, z + 0.6, 'chrome'); for (const s of [-0.72, 0.72]) K.sph('chrome', x + 2.62, 1.05, z + s, 0.13);
    deco(x - 1.9, 0.8, z - 0.7, x - 0.9, 1.15, z + 0.2, 'paintRed');
    K.wheels(x - 1.7, x + 1.7, z - 0.95, z + 0.95, 0.42);
    solid(x - 2.7, 0, z - 1.0, x + 2.75, 1.35, z + 1.0, 'metal'); solid(x - 0.3, 1.35, z - 0.95, x + 1.0, 2.05, z + 0.95, 'metal');
  }
  function camper(x, z) { // travel trailer along X, hitch at -X
    L.box(x - 5, 0.6, z - 1.2, x + 5, 3.0, z + 1.2, 'trailerWhite', { noCol: true });
    deco(x - 5.02, 1.35, z - 1.22, x + 5.02, 1.6, z + 1.22, 'paintCherry'); deco(x - 5.02, 1.7, z - 1.22, x + 5.02, 1.78, z + 1.22, 'paintCherry');
    L.box(x - 5.1, 3.0, z - 1.25, x + 5.1, 3.12, z + 1.25, 'chrome', { noCol: true });
    for (const wx of [-3.6, -0.4, 2.8]) deco(x + wx, 1.95, z + 1.2, x + wx + 1.3, 2.6, z + 1.24, 'glassDay');
    deco(x + 1.1, 0.7, z + 1.2, x + 1.9, 2.6, z + 1.25, 'woodDark'); deco(x - 4.6, 1.95, z - 1.24, x - 2.4, 2.6, z - 1.2, 'glassDay');
    L.box(x - 1, 3.12, z - 0.6, x + 0.2, 3.6, z + 0.6, 'paintGrey', { noCol: true });
    L.pipe('paintDark', x - 5, 0.6, z, x - 6.6, 0.55, z, 0.06); L.cyl('paintDark', x - 6.3, 0.3, z, 0.05, 0.6, 0, 0, true);
    K.wheels(x - 0.9, x + 0.4, z - 1.05, z + 1.05, 0.36);
    L.box(x + 1.1, 0, z + 1.2, x + 1.9, 0.35, z + 1.7, 'wood');
    solid(x - 5.1, 0, z - 1.25, x + 5.1, 3.12, z + 1.25, 'metal');
  }
  function mobileHome(x0, z0, x1, z1) { // single-wide on cinder blocks, door on the south side
    L.box(x0, 0.7, z0, x1, 3.2, z1, 'sidingWhite', { noCol: true });
    deco(x0 - 0.03, 1.55, z0 - 0.03, x1 + 0.03, 1.8, z1 + 0.03, 'sidingTeal');
    deco(x0 + 0.15, 0, z0 + 0.15, x1 - 0.15, 0.7, z1 - 0.15, 'metalSiding');
    L.box(x0 - 0.15, 3.2, z0 - 0.15, x1 + 0.15, 3.35, z1 + 0.15, 'roofTin', { noCol: true, bottom: true });
    for (const wx of [x0 + 1.2, x0 + 4.2, x1 - 5, x1 - 2.2]) { deco(wx, 1.95, z1 - 0.02, wx + 1.4, 2.8, z1 + 0.04, 'glassDay'); deco(wx, 1.95, z0 - 0.04, wx + 1.4, 2.8, z0 + 0.02, 'glassDay'); }
    deco(x0 + 6.6, 0.7, z1 - 0.02, x0 + 7.5, 2.8, z1 + 0.05, 'shutterBlue');
    L.box(x0 + 6.1, 0, z1, x0 + 8, 0.6, z1 + 1.4, 'floorWood'); L.box(x0 + 6.1, 0, z1 + 1.4, x0 + 8, 0.3, z1 + 1.9, 'wood');
    solid(x0 - 0.15, 0, z0 - 0.15, x1 + 0.15, 3.35, z1 + 0.15, 'metal');
    // satellite dish and a propane bottle
    L.pipe('paintGrey', x1 - 1.5, 3.35, z0 + 1, x1 - 1.5, 4.1, z0 + 1, 0.04);
    K.put('appliance', K.geo('sphere'), x1 - 1.5, 4.3, z0 + 1.1, 0.45, 0.45, 0.12, 0.4, 0.5);
    L.cyl('appliance', x0 - 0.5, 0.65, z0 + 1.2, 0.2, 1.3, 0, 0, true); solid(x0 - 0.75, 0, z0 + 0.95, x0 - 0.25, 1.3, z0 + 1.45, 'metal');
  }
  function shack(x0, z0, x1, z1) { // plank hut, door facing east, window south
    const OUT = [[0, 2.6, 'boardBrown']], IN = [[0, 2.6, 'plankWall']];
    L.box(x0, 0, z0, x1, 0.1, z1, 'floorWood');
    K.wall('x', x0, x1, z0, 0, 2.6, [], OUT, IN, -1, {}); K.wall('x', x0, x1, z1, 0, 2.6, [[x0 + 2, x0 + 3.4, 1.1, 1.9]], OUT, IN, 1, {});
    K.wall('z', z0, z1, x0, 0, 2.6, [], OUT, IN, -1, {}); K.wall('z', z0, z1, x1, 0, 2.6, [[z0 + 2.4, z0 + 3.6, 0.1, 2.2]], OUT, IN, 1, {});
    L.box(x0 - 0.3, 2.6, z0 - 0.3, x1 + 0.3, 2.75, z1 + 0.3, 'roofTin', { bottom: true }); K.roofCap(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, 2.75);
    L.box(x0 + 0.2, 0.1, z0 + 0.2, x0 + 2.1, 0.55, z0 + 1.0, 'olive'); K.table(x1 - 1.6, z1 - 1.4, x1 - 0.4, z1 - 0.4, 0.1); K.chair(x1 - 1, z1 - 1.8, 0.1);
    CF.PH.place('crateSmall', x0 + 0.8, 0.1, z1 - 0.9, 0.2);
    K.roomLight((x0 + x1) / 2, 2.6, (z0 + z1) / 2);
  }
  function framing(x0, z0, x1, z1) { // the half-built frame house north-east: slab, stud walls, a decked upper floor
    const S = 0.3, sx = (x, z, y0, y1) => { deco(x - 0.045, y0, z - 0.07, x + 0.045, y1, z + 0.07, 'wood'); W.add(x - 0.05, y0, z - 0.07, x + 0.05, y1, z + 0.07, { shoot: false }); };
    const sz = (x, z, y0, y1) => { deco(x - 0.07, y0, z - 0.045, x + 0.07, y1, z + 0.045, 'wood'); W.add(x - 0.07, y0, z - 0.05, x + 0.07, y1, z + 0.05, { shoot: false }); };
    const run = (axis, a0, a1, c, y0, y1, gaps) => { // studs every 0.6 m, sole plates either side of each gap, a header over the top
      for (let a = a0; a <= a1 + 0.01; a += 0.6) { if (gaps.some((g) => a > g[0] - 0.05 && a < g[1] + 0.05)) continue; if (axis === 'x') sx(a, c, y0, y1); else sz(c, a, y0, y1); }
      const plate = (p0, p1, y) => { if (axis === 'x') deco(p0, y, c - 0.07, p1, y + 0.09, c + 0.07, 'wood'); else deco(c - 0.07, y, p0, c + 0.07, y + 0.09, p1, 'wood'); };
      plate(a0, a1, y1); let p = a0; for (const g of gaps) { plate(p, g[0], y0); p = g[1]; } plate(p, a1, y0);
    };
    L.box(x0, 0, z0, x1, S, z1, 'concrete', { side: 'concreteDark' });
    run('x', x0, x1, z0, S, F - 0.2, []); run('x', x0, x1, z1, S, F - 0.2, [[33, 35.3]]);
    run('z', z0, z1, x0, S, F - 0.2, [[-26.2, -23.8]]); run('z', z0, z1, x1, S, F - 0.2, [[-30.2, -27.8]]);
    run('z', z0, -29, 35, S, F - 0.2, [[-33.4, -31.4]]);
    // joists everywhere, a plywood deck over the north half, the stair up at the east end
    for (let x = x0 + 0.3; x < x1; x += 0.6) deco(x - 0.04, F - 0.4, z0, x + 0.04, F - 0.2, z1, 'wood');
    L.box(x0, F - 0.2, z0, x1, F, -29, 'plywood', { side: 'wood', bottom: true });
    openSteps('z', -29, -23.2, 39.6, 40.9, S, F, -1, 'wood');
    // upper floor studs on the deck (north and side walls), rafters over part of it
    run('x', x0, x1, z0, F, 5.8, [[31, 33]]); run('z', z0, -29.4, x0, F, 5.8, [[-33, -31.2]]); run('z', z0, -29.4, x1, F, 5.8, []);
    for (let x = x0; x <= 35; x += 1.2) { L.pipe('wood', x, 5.9, z0, x, 7.2, -32.5, 0.05); L.pipe('wood', x, 7.2, -32.5, x, 5.9, -29, 0.05); }
    // site clutter: lumber, plywood sheets, sawhorses, cement mixer, a portable toilet
    L.box(30, S, -27.4, 33, S + 0.6, -26.2, 'wood'); L.box(36.2, S, -34.8, 38.6, S + 0.9, -33.6, 'plywood');
    for (const x of [30.4, 32.6]) { L.pipe('wood', x - 0.3, S, -24.4, x, S + 0.8, -24.4, 0.03); L.pipe('wood', x + 0.3, S, -24.4, x, S + 0.8, -24.4, 0.03); }
    deco(30, S + 0.8, -24.46, 33, S + 0.88, -24.34, 'wood'); solid(30, S, -24.6, 33, S + 0.9, -24.2);
    L.cyl('paintCherry', 37.5, 1.2, -19.2, 0.55, 1.1, 0.5, 0, false); K.put('paintCherry', K.geo('cone'), 37.5, 1.95, -19.55, 0.45, 0.5, 0.45, 0, 0.5);
    L.pipe('paintDark', 37, 0, -18.8, 37.5, 0.9, -19.2, 0.05); L.pipe('paintDark', 38, 0, -18.8, 37.5, 0.9, -19.2, 0.05); solid(36.8, 0, -19.9, 38.2, 1.9, -18.6, 'metal');
    L.box(26.6, 0, -20.6, 27.8, 2.3, -19.4, 'paintBlue'); deco(26.5, 2.3, -20.7, 27.9, 2.4, -19.3, 'appliance'); deco(27.8, 0.1, -20.3, 27.84, 2.1, -19.7, 'paintDark');
    // scaffold along the west face
    for (const z of [-35, -30, -25]) for (const x of [26.8, 27.8]) L.pipe('steel', x, 0, z, x, 5, z, 0.035);
    for (const y of [1.5, 3.05]) { L.box(26.75, y - 0.06, -35.1, 27.85, y, -24.9, 'wood'); for (const x of [26.8, 27.8]) L.pipe('steel', x, y + 1, -35, x, y + 1, -25, 0.03); }
  }
  function watchtower(x0, z0) { // deck at 3.6 on posts, stair up the east side, tin roof
    const DT = 3.6, x1 = x0 + 4, z1 = z0 + 4, xs = x1 + 1.4, zs = z0 + 1.5;
    for (const [x, z] of [[x0, z0], [x1, z1], [x0, z1], [xs, z0], [xs, zs], [x1, zs]]) L.box(x - 0.14, 0, z - 0.14, x + 0.14, 6.2, z + 0.14, 'woodDark');
    for (const [a, b] of [[[x0, z0], [x0, z1]], [[x0, z0], [xs, z0]]]) { L.pipe('woodDark', a[0], 0.3, a[1], b[0], DT - 0.3, b[1], 0.05); L.pipe('woodDark', b[0], 0.3, b[1], a[0], DT - 0.3, a[1], 0.05); }
    L.box(x0, DT - 0.2, z0, xs, DT, zs, 'floorWood', { bottom: true, side: 'woodDark' }); L.box(x0, DT - 0.2, zs, x1, DT, z1, 'floorWood', { bottom: true, side: 'woodDark' });
    const wl = (a, b, c, d) => L.box(a, DT, b, c, DT + 1.1, d, 'plywood', { top: 'woodDark' });
    wl(x0, z0, xs, z0 + 0.1); wl(x0, z0 + 0.1, x0 + 0.1, z1); wl(x0 + 0.1, z1 - 0.1, x1, z1); wl(x1 - 0.1, zs, x1, z1 - 0.1); wl(xs - 0.1, z0 + 0.1, xs, zs);
    L.box(x0 - 0.3, 6.2, z0 - 0.3, xs + 0.3, 6.35, z1 + 0.3, 'roofTin', { bottom: true }); K.roofCap(x0 - 0.3, z0 - 0.3, xs + 0.3, z1 + 0.3, 6.35);
    openSteps('z', zs, zs + 6.5, x1 + 0.1, xs - 0.1, 0, DT, -1, 'woodDark');
    // searchlight on the north-west corner
    L.cyl('paintDark', x0 + 0.5, DT + 1.35, z0 + 0.5, 0.05, 0.5, 0, 0, true); L.cyl('paintGrey', x0 + 0.5, DT + 1.7, z0 + 0.5, 0.22, 0.4, Math.PI / 2, 0, true); K.sph('lampWarm', x0 + 0.5, DT + 1.7, z0 + 0.3, 0.14, 0.14, 0.03);
    bags(x0 - 0.8, z0 - 0.8, x0 - 0.8, z1 + 0.8, 2, 0);
  }

  // ------------------------------------------------------------ build
  MO.build = function () {
    K = CF.MapNuketown.kit;
    const rnd = U.mulberry32(1987);
    // ground: forest floor everywhere, cut open over the basement and the bulkhead stair
    const gnd = (x0, z0, x1, z1) => L.box(x0, -1, z0, x1, 0.02, z1, 'forest', { ao: false });
    gnd(-400, -400, 400, -17); gnd(-400, -2, 400, 400); gnd(-400, -17, -11.5, -12); gnd(-8.5, -17, 400, -12); gnd(-400, -12, -12, -2); gnd(12, -12, 400, -2);
    // gravel yard out front, dirt road past the gate, packed dirt out back
    deco(-34, 0.02, 10, 30, 0.045, 24, 'gravel');
    deco(-400, 0.02, 25.5, 400, 0.05, 31.5, 'dirt');
    deco(-40.5, 0.02, -44, -35, 0.048, 25.5, 'dirt');
    for (const r of [[-28, -40, 26, -18.2], [-28, -18.2, -11.7, -12.2], [-8.3, -18.2, 26, -12.2]]) deco(r[0], 0.02, r[1], r[2], 0.045, r[3], 'dirt');
    deco(13, 0.02, 10, 20.5, 0.048, 25.5, 'gravel');

    mainHouse(rnd);
    basement(rnd);
    hall();
    tower();
    garage(rnd);

    // front yard: the school bus, pickup, an old sedan, a camper, picnic tables, the flag
    K.schoolBus(-3, 20.6);
    pickup(14.5, 17.6, 'paintCherry');
    K.car(-27, 18.5, true, 'paintCream');
    camper(27, 21.5);
    picnic(-28, 13.2); picnic(-22.5, 14.2);
    flagpole(-15.5, 14.5);
    K.streetLamp(-12.6, 12.4); K.streetLamp(9, 12.8);
    K.trashCan(3.6, 11.6); K.trashCan(4.3, 12.1); K.mailbox(-33.5, 24.4);
    const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
    P('boxStack', 6.5, 14.4, 0.2); P('crate', -17.8, 11.4, 0.3); P('crateSmall', -18.9, 11.1, -0.2); P('drum', 11.6, 11.2); P('drum', 22.4, 11.2); P('barrel', 23.2, 11.6);
    P('grill', -24.8, 11.2); P('cooler', -26.4, 11.6, 0.2); P('chair', -25.4, 16.4, Math.PI); P('planter', -12.8, 9.2); P('planter', 1.9, 13.2);
    bags(-8, 16.2, -2, 16.2, 3, 0); bags(24, 14.8, 28, 14.8, 2, 0);
    // west side: the gate, guard booth, a plank shack and a woodshed along the road
    for (const z of [25, 32]) { L.box(-48.4, 0, z - 0.3, -47.8, 4.6, z + 0.3, 'woodDark'); }
    L.box(-48.3, 4.0, 24.7, -47.9, 5.1, 32.3, 'woodDark', { noCol: true }); K.plane(art().gate, 7.2, 1.1, -47.88, 4.55, 28.5, Math.PI / 2); K.plane(art().gate, 7.2, 1.1, -48.32, 4.55, 28.5, -Math.PI / 2);
    L.box(-45.4, 0, 33.2, -42.8, 2.6, 35.8, 'boardBrown', { noCol: true }); deco(-45.5, 1.2, 33.1, -42.7, 2.1, 35.9, 'glassDay'); L.box(-45.7, 2.6, 32.9, -42.5, 2.75, 36.1, 'roofTin');
    solid(-45.4, 0, 33.2, -42.8, 2.6, 35.8, 'metal');
    shack(-46, -6, -40, 0);
    L.box(-46, 0, 8, -41.5, 2.2, 13, 'boardBrown', { noCol: true }); L.box(-46.2, 2.2, 7.8, -41.3, 2.35, 13.2, 'roofTin', { noCol: true }); solid(-46.2, 0, 7.8, -41.3, 2.35, 13.2);
    K.woodpile(-41.3, 8.5, -40.1, 12.5, 1.3);
    // back yard: the mobile home, fire pit, clothes line, junkyard
    mobileHome(-24, -32.5, -10, -28.2);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; K.put('stone', K.blobGeo(i % 3), -3 + Math.cos(a) * 1.0, 0.12, -23 + Math.sin(a) * 1.0, 0.28, 0.2, 0.24, a); }
    solid(-4.2, 0, -24.2, -1.8, 0.35, -21.8); for (let i = 0; i < 3; i++) L.pipe('bark', -3.5 + i * 0.4, 0.15, -23.5, -2.6 + i * 0.2, 0.3, -22.6, 0.07);
    for (const [x, z] of [[-6, -26.2], [-6.5, -20], [0.5, -20.2]]) P('campChair', x, z, Math.atan2(-3 - x, -23 - z) + Math.PI);
    for (const x of [-20, -13]) { L.pipe('chrome', x, 0, -22, x, 2.3, -22, 0.04); solid(x - 0.08, 0, -22.08, x + 0.08, 2.3, -21.92, 'metal'); }
    L.pipe('rubber', -20, 2.2, -22, -13, 2.2, -22, 0.01);
    const sheet = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.9, side: THREE.DoubleSide });
    for (const x of [-18.4, -16.2, -14.4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.15), sheet); m.position.set(x, 1.62, -22); m.castShadow = true; L.scene.add(m); }
    K.car(6, -31, true, 'rust'); K.car(12.4, -25.6, false, 'rust', true); K.car(21, -30.5, true, 'rust', true);
    L.propBox('cont_green', 16, 0, -37.6, 6.1, 2.6, 2.44, 0); solid(12.95, 0, -38.82, 19.05, 2.6, -36.38, 'metal');
    for (const [x, z, s] of [[3, -37, 1.3], [8.4, -36.6, 1.0], [23, -36, 1.5], [17, -24, 0.9]]) { K.put('rust', K.blobGeo((x | 0) % 3), x, s * 0.35, z, s * 1.4, s * 0.75, s, x); solid(x - s * 1.2, 0, z - s * 0.9, x + s * 1.2, s * 0.9, z + s * 0.9, 'metal'); }
    K.tires(9.4, -28, 3); K.tires(10.2, -28.6, 2); K.tires(2.4, -27.4, 4); P('drum', 18.6, -27.8); P('drum', 19.3, -28.4); P('crate', 4.6, -24.6, 0.4);
    K.woodpile(-29.6, -21.6, -26, -20.4, 1.4);
    // east side: garden beds, propane tank, the frame house, the watchtower
    for (let i = 0; i < 4; i++) { const z = 3 + i * 3; L.box(33, 0, z, 44, 0.45, z + 1.4, 'wood', { top: 'dirt' }); for (let x = 33.6; x < 43.6; x += 0.8) K.put(i % 2 ? 'leaves' : 'leaves2', K.blobGeo((x * 3 | 0) % 3), x, 0.62, z + 0.7, 0.3, 0.22, 0.3, x); }
    propaneTank(31, -4);
    framing(28, -36, 42, -22);
    watchtower(40, -16);
    P('generator', 30.5, -8.5, 0.2); P('crate', 36, -11, 0.2); P('boxStack', 35.2, 18.2, 0.4);
    // trees inside the fence (cover), power line from the road
    for (const [x, z, h] of [[-42, -32, 15], [-44, -18, 17], [-22, -40, 14], [44, -38, 16], [44, 34, 15], [-44, 20, 13], [34, 34, 14], [-36, 37.5, 16], [45, 16, 13], [-14, -40, 12]]) fir(x, z, h, true);
    for (const [x, z, r] of [[-33, 9.5, 0.9], [-10.6, 13.6, 0.7], [5.6, 11.4, 0.8], [-31, -12.4, 0.8], [27.6, -9.6, 0.9], [-35, -30, 1.1]]) K.bush(x, z, r);
    const poles = [-44, -22, 0, 22, 44].map((x) => K.powerPole(x, 33.2, 9));
    for (let i = 0; i < poles.length - 1; i++) K.wire(poles[i], poles[i + 1], 0.9);
    K.wire(poles[2], [0, 6.3, 10.3], 0.7); K.wire(poles[3], [22, 3.6, 10.3], 0.7);

    // the fence: chain link and barbed wire all round, gaps at the road gates, warning signs
    chainFence(-48, -44, 48, -44, 2.4); chainFence(-48, 40, 48, 40, 2.4);
    chainFence(-48, -44, -48, 24.8, 2.4); chainFence(-48, 32.2, -48, 40, 2.4); chainFence(48, -44, 48, 25, 2.4); chainFence(48, 32, 48, 40, 2.4);
    for (const x of [-30, 0, 30]) { K.plane(art().noTresp, 0.9, 0.56, x, 1.4, -43.96, 0, { double: true }); K.plane(art().noTresp, 0.9, 0.56, x, 1.4, 39.96, Math.PI, { double: true }); }
    for (const z of [-20, 10]) { K.plane(art().noTresp, 0.9, 0.56, -47.96, 1.4, z, Math.PI / 2, { double: true }); K.plane(art().noTresp, 0.9, 0.56, 47.96, 1.4, z, -Math.PI / 2, { double: true }); }
    L.box(48.1, 0, 25, 48.3, 1.6, 32, 'paintGrey', { noCol: true }); for (let z = 25.3; z < 32; z += 0.5) L.pipe('steel', 48.2, 0.1, z, 48.2, 1.5, z, 0.02);

    // outside the fence: fir forest, a red barn, the water tower, the road on out
    const clear = (x, z) => (Math.abs(x) < 52 && z > -48 && z < 44) || (Math.abs(z - 28.5) < 6 && Math.abs(x) > 50);
    for (let i = 0; i < 520; i++) {
      const x = (rnd() - 0.5) * 320, z = (rnd() - 0.5) * 320;
      if (clear(x, z) || (x > 60 && x < 86 && z > -26 && z < 2) || Math.hypot(x + 70, z + 42) < 8) continue;
      fir(x, z, 12 + rnd() * 14, false);
    }
    for (let i = 0; i < 120; i++) { const a = rnd() * Math.PI * 2, r = 54 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r; if (clear(x, z)) continue; K.put(rnd() < 0.5 ? 'leaves2' : 'pine', K.blobGeo(i % 3), x, 0.35, z, 0.7 + rnd(), 0.5, 0.7 + rnd(), rnd() * 6); }
    L.box(64, 0, -22, 82, 6, -4, 'boardBrown', { noCol: true }); K.gableRoof(73, -13, 18, 18, 6, 4.2, 'boardBrown', 'roofTin');
    deco(63.95, 0, -16, 64, 4.6, -10, 'woodDark'); for (const [a, b] of [[-16, -10], [-10, -16]]) L.pipe('trim', 63.9, 0.1, a, 63.9, 4.5, b, 0.06);
    K.latticeTower(-70, -42, 15, 6, 4, 'woodDark');
    L.cyl('woodDark', -70, 17.5, -42, 3.2, 5, 0, 0, false); K.put('roofTin', K.geo('cone'), -70, 20.8, -42, 3.6, 1.6, 3.6);
    for (let y = 15.4; y < 20; y += 1.1) L.cyl('paintDark', -70, y, -42, 3.25, 0.1, 0, 0, false);
    L.killY = -12;

    // spawns: the attackers come up the road from the south, the defenders start behind the house
    const south = [[-30, 0.05, 35.5], [-16, 0.05, 36.5], [-2, 0.05, 36.5], [12, 0.05, 36], [26, 0.05, 35.5]];
    const north = [[-34, 0.02, -40], [-18, 0.02, -41.5], [-4, 0.02, -41.5], [24, 0.02, -41.5], [38, 0.02, -40.5]];
    L.spawns.t0 = south; L.spawns.t1 = north;
    L.spawns.ffa = south.concat(north, [[-44, 0.02, -12], [44, 0.02, 0], [-44, 0.02, 24], [30, 0.02, -14], [-6, G, 3.4], [-19, G, 0]]);
    L.addPickup('armor', -23, F3, -12); L.addPickup('armor', 4.5, BF, -5);
    L.addPickup('ammo', 6.5, F, -9.5); L.addPickup('ammo', 19, 0.1, -3); L.addPickup('ammo', -19, G, 0); L.addPickup('ammo', -4, 0.02, -19);
    L.addPickup('ammo', 8, 0.02, 16); L.addPickup('ammo', 34, F, -32);
    L.points.start = { x: -2, y: 0.05, z: 36.5, yaw: 0 };
  };
})(window.CF);
