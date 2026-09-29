'use strict';
/* Cinderfall — DUST II (multiplayer), after the Counter-Strike map: a sandstone town under a hard afternoon sun.
   T spawn is in the south, CT spawn in the north. Three lanes join them:
     east — T ramp, Outside Long, the Long doors, Long A, the pit, and the ramp up to bombsite A;
     centre — top mid, the long mid corridor with the xbox and the mid doors, the catwalk and Short A up the side;
     west — outside tunnels, the dark upper and lower tunnels, the B tunnel exit onto bombsite B (back plat, the car,
     the B doors to CT and the B window).
   The town is laid out on a half-metre grid: every cell that is not a walkable area becomes a block of building,
   merged into boxes of equal height; the faces those blocks show to the streets are dressed as facades.
   Axes: +X east, +Z south. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MD = CF.MapDust2 = {};
  const PI = Math.PI;
  let K = null, MS = null; // Nuketown's building kit, the Dar Masir builders (materials, palms)

  const G = 0.5;                                   // grid cell (m)
  const BX0 = -58, BX1 = 58, BZ0 = -62, BZ1 = 60;  // grid bounds
  const NX = (BX1 - BX0) / G, NZ = (BZ1 - BZ0) / G;
  const DEEP = -3;

  /* Walkable areas. y = floor height; ramp = [axis, y at the low coordinate, y at the high coordinate]; roof = ceiling. */
  const AREAS = [
    { id: 'bsite', r: [-54, -58, -24, -28], y: 0, floor: 'sandGround' },
    { id: 'bdoors', r: [-24, -46, -12, -38], y: 0, floor: 'paving' },
    { id: 'bwin', r: [-24, -38, -16, -32], y: 0, roof: 3.2, floor: 'tunnelFloor' },
    { id: 'ct', r: [-12, -58, 8, -38], y: 0, floor: 'paving' },
    { id: 'asite', r: [8, -58, 42, -36], y: 1.8, floor: 'paving' },
    { id: 'aramp', r: [32, -36, 42, -24], ramp: ['z', 1.8, 0], floor: 'sandGround' },
    { id: 'pit', r: [42, -56, 54, -28], y: -1, floor: 'sandGround' },
    { id: 'pitramp', r: [42, -28, 46, -24], ramp: ['z', -1, 0], floor: 'sandGround' },
    { id: 'long', r: [32, -24, 46, 20], y: 0, floor: 'sandGround' },
    { id: 'longdoor', r: [37, 20, 40, 22], y: 0, floor: 'paving' },
    { id: 'olong', r: [22, 22, 46, 40], y: 0, floor: 'sandGround' },
    { id: 'tramp', r: [14, 40, 28, 50], ramp: ['x', 1.2, 0], floor: 'sandGround' },
    { id: 'ts', r: [-14, 40, 14, 56], y: 1.2, floor: 'sandGround' },
    { id: 'topmidramp', r: [-8, 32, 10, 40], ramp: ['z', 0, 1.2], floor: 'sandGround' },
    { id: 'topmid', r: [-8, 20, 10, 32], y: 0, floor: 'sandGround' },
    { id: 'mid', r: [-6, -38, 2, 20], y: 0, floor: 'sandGround' },
    { id: 'cat', r: [2, -8, 8, 0], y: 1.8, floor: 'paving' },
    { id: 'catstairs', r: [2, 0, 8, 6], y: 0, floor: 'paving' },
    { id: 'short', r: [8, -36, 16, 6], y: 1.8, floor: 'paving' },
    { id: 'ltun', r: [-26, 2, -6, 8], y: -1.2, roof: 2.6, floor: 'tunnelFloor' },
    { id: 'utun', r: [-34, -6, -26, 26], y: 0, roof: 3.4, floor: 'tunnelFloor' },
    { id: 'otunramp', r: [-36, 26, -14, 34], ramp: ['z', 0, 1.2], floor: 'sandGround' },
    { id: 'otun', r: [-36, 34, -14, 46], y: 1.2, floor: 'sandGround' },
    { id: 'btun', r: [-40, -28, -30, -6], y: 0, roof: 3.4, floor: 'tunnelFloor' }
  ];
  const A = {}; AREAS.forEach((a, i) => { a.i = i; A[a.id] = a; });
  /** Blocks forced solid inside areas: [x0, z0, x1, z1, height]. */
  const SOLIDS = [[-30, 12, -26, 20, 3.6], [-35, -36, -33, -34, 5.2]];
  const MASS_MATS = ['adobe', 'adobeSand', 'limestone', 'adobeLight', 'adobe', 'adobeOchre', 'adobeSand', 'limestone'];

  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  const clamp01 = (t) => t < 0 ? 0 : t > 1 ? 1 : t;
  function floorAt(a, x, z) {
    if (!a.ramp) return a.y;
    const [ax, y0, y1] = a.ramp, r = a.r;
    const t = ax === 'x' ? (x - r[0]) / (r[2] - r[0]) : (z - r[1]) / (r[3] - r[1]);
    return y0 + (y1 - y0) * clamp01(t);
  }
  const yMin = (a) => a.ramp ? Math.min(a.ramp[1], a.ramp[2]) : a.y;
  const yMax = (a) => a.ramp ? Math.max(a.ramp[1], a.ramp[2]) : a.y;

  // ------------------------------------------------------------ small helpers
  const deco = (...a) => K.deco(...a);
  const solid = (...a) => K.solid(...a);
  const P = (kind, x, z, ry, y) => CF.PH.place(kind, x, y || 0, z, ry || 0);
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  /** Rotated box (yaw, then pitch/roll in the yawed frame), mesh only. */
  function rbox(m, x, y, z, sx, sy, sz, ry, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z);
    L.addGeo(m, L.geo('box'), new THREE.Matrix4().compose(_p, _q, _s));
  }
  function rgeo(m, g, x, y, z, sx, sy, sz, ry, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z);
    L.addGeo(m, g, new THREE.Matrix4().compose(_p, _q, _s));
  }
  /** A layer split around openings [a0, a1, y0, y1] (colliders included). */
  function cut(axis, a0, a1, c, t, y0, y1, holes, m, o) {
    const B = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      if (axis === 'x') L.box(p0, q0, c - t / 2, p1, q1, c + t / 2, m, o); else L.box(c - t / 2, q0, p0, c + t / 2, q1, p1, m, o);
    };
    K.holeSpans(a0, a1, y0, y1, holes, B);
  }
  /** Solid staircase. axis 'x' climbs along X over a0..a1 (b = the Z span); up = +1 rises toward a1, -1 toward a0. */
  function steps(axis, a0, a1, b0, b1, yBase, yTop, up, m, topM) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (a1 - a0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i, s0 = up > 0 ? a0 + (i - 1) * d : a1 - i * d, s1 = s0 + d;
      if (axis === 'x') L.box(s0, yBase, b0, s1, top, b1, m, { top: topM }); else L.box(b0, yBase, s0, b1, top, s1, m, { top: topM });
      if (axis === 'x') deco(s0 + (up > 0 ? d - 0.06 : 0), top - 0.05, b0, s0 + (up > 0 ? d : 0.06), top + 0.005, b1, 'limestoneDark');
      else deco(b0, top - 0.05, s0 + (up > 0 ? d - 0.06 : 0), b1, top + 0.005, s0 + (up > 0 ? d : 0.06), 'limestoneDark');
    }
  }
  /** Triangles with world-scaled UVs (u from the horizontal, v from height or depth) baked into a batch. */
  function tris(m, pts, uvFn) {
    const g = new THREE.BufferGeometry(), uv = [];
    for (let i = 0; i < pts.length; i += 3) uv.push(...uvFn(pts[i], pts[i + 1], pts[i + 2])); // per vertex
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); L.addGeo(m, g, new THREE.Matrix4());
  }

  // ------------------------------------------------------------ canvas art and the crate material
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    const ct = (w, h, draw) => K.canvasTex(w, h, draw);
    // stenciled wooden crate: planks in a dark frame with a diagonal brace
    ART.crate = ct(256, 256, (x, w, h) => {
      const rnd = U.mulberry32(51);
      for (let i = 0; i < 6; i++) { const c = 150 + (rnd() * 30 | 0); x.fillStyle = `rgb(${c},${c * 0.74 | 0},${c * 0.45 | 0})`; x.fillRect(0, i * h / 6, w, h / 6); x.fillStyle = 'rgba(60,35,15,0.55)'; x.fillRect(0, i * h / 6, w, 2); }
      for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(90,55,25,${rnd() * 0.18})`; x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 30, 1); }
      x.fillStyle = '#7a5230'; x.fillRect(0, 0, w, 24); x.fillRect(0, h - 24, w, 24); x.fillRect(0, 0, 24, h); x.fillRect(w - 24, 0, 24, h);
      x.strokeStyle = '#7a5230'; x.lineWidth = 22; x.beginPath(); x.moveTo(24, h - 24); x.lineTo(w - 24, 24); x.stroke();
      x.fillStyle = 'rgba(40,25,12,0.6)'; for (const [a, b] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) { x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(30,22,14,0.55)'; x.font = 'bold 30px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('FRAGILE', w / 2 - 30, h / 2 + 50);
    });
    // spray-painted site letters and lane arrows
    // arrow: +1 points to the viewer's right, -1 to the left
    const spray = (text, arrow, col) => ct(256, 256, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = col; x.strokeStyle = col; x.textAlign = 'center';
      x.shadowColor = col; x.shadowBlur = 8;
      x.font = 'bold ' + (arrow ? 130 : 210) + 'px Arial Black, Arial, sans-serif'; x.fillText(text, arrow > 0 ? 80 : arrow < 0 ? 176 : w / 2, arrow ? 175 : 205);
      if (arrow) {
        const f = (v) => arrow > 0 ? v : w - v;
        x.lineWidth = 16; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(f(150), 128); x.lineTo(f(236), 128); x.moveTo(f(206), 96); x.lineTo(f(238), 128); x.lineTo(f(206), 160); x.stroke();
      }
      const rnd = U.mulberry32(text.charCodeAt(0)); x.shadowBlur = 0;
      for (let i = 0; i < 30; i++) { x.globalAlpha = 0.5; x.fillRect(40 + rnd() * 180, 60 + rnd() * 170, 2, 4 + rnd() * 18); }
      x.globalAlpha = 1;
    });
    ART.A = spray('A', false, '#c8321e'); ART.B = spray('B', false, '#c8321e');
    ART.toA = spray('A', 1, '#d8d0c0'); ART.toB = spray('B', -1, '#d8d0c0');
    return ART;
  }
  function materials() {
    MS.materials();
    const tex = art().crate;
    L.mats.dustCrate = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 });
    L.mats.ironDark = new THREE.MeshStandardMaterial({ color: 0x2a2724, vertexColors: true, roughness: 0.6, metalness: 0.6 });
    // the tunnels are dim: darker plaster, timber and packed earth under the roofs
    const dim = (src, c) => { const m = L.mats[src].clone(); m.color.set(c); m.envMapIntensity = 0.15; return m; };
    L.mats.tunnelPlaster = dim('adobe', 0x6a5a48); L.mats.tunnelWood = dim('woodDark', 0x3a2a1c); L.mats.tunnelFloor = dim('packed', 0x75644c);
    L.mats.scorched = new THREE.MeshStandardMaterial({ color: 0x070605, vertexColors: true, roughness: 1, metalness: 0.2, envMapIntensity: 0.2 });
  }
  /** A painted sign flat on a wall, facing out along (dx, dz). */
  function wallSign(tex, w, h, x, y, z, dx, dz) { K.plane(tex, w, h, x + dx * 0.075, y, z + dz * 0.075, Math.atan2(dx, dz), { alpha: true }); } // clear of the stone facing

  // ------------------------------------------------------------ the grid: areas, building mass
  let AREA = null, HM = null, MM = null;
  const cx = (ix) => BX0 + (ix + 0.5) * G, cz = (iz) => BZ0 + (iz + 0.5) * G;
  const inGrid = (ix, iz) => ix >= 0 && iz >= 0 && ix < NX && iz < NZ;
  const isMass = (ix, iz) => AREA[iz * NX + ix] < 0;
  function massHeight(x, z) {
    const bx = Math.floor((x + 200) / 9), bz = Math.floor((z + 200) / 8), h = hash(bx, bz);
    const edge = x < -55 || x > 55 || z < -59 || z > 57;
    return { h: (edge ? [8.4, 9.2, 10, 11] : [6.4, 7.2, 8, 9])[h & 3], m: (h >>> 4) % MASS_MATS.length };
  }
  function grid() {
    AREA = new Int16Array(NX * NZ).fill(-1); HM = new Float32Array(NX * NZ); MM = new Uint8Array(NX * NZ);
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const x = cx(ix), z = cz(iz), c = iz * NX + ix;
      for (const a of AREAS) if (x > a.r[0] && x < a.r[2] && z > a.r[1] && z < a.r[3]) { AREA[c] = a.i; break; }
      for (const s of SOLIDS) if (x > s[0] && x < s[2] && z > s[1] && z < s[3]) { AREA[c] = -1; HM[c] = s[4]; MM[c] = 2; }
      if (AREA[c] < 0 && !HM[c]) { const q = massHeight(x, z); HM[c] = q.h; MM[c] = q.m; }
    }
  }
  /** Greedy merge of equal building cells into boxes. */
  function mass() {
    const used = new Uint8Array(NX * NZ), same = (c, d) => AREA[d] < 0 && !used[d] && HM[d] === HM[c] && MM[d] === MM[c];
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const c = iz * NX + ix;
      if (AREA[c] >= 0 || used[c]) continue;
      let w = 1; while (ix + w < NX && same(c, iz * NX + ix + w)) w++;
      let d = 1;
      grow: while (iz + d < NZ) { for (let k = 0; k < w; k++) if (!same(c, (iz + d) * NX + ix + k)) break grow; d++; }
      for (let j = 0; j < d; j++) for (let k = 0; k < w; k++) used[(iz + j) * NX + ix + k] = 1;
      const x0 = BX0 + ix * G, z0 = BZ0 + iz * G, h = HM[c];
      L.box(x0, DEEP, z0, x0 + w * G, h, z0 + d * G, MASS_MATS[MM[c]], { top: 'roofTop', ao: false });
      // roof clutter: a water tank, a vent, a satellite dish or a line of washing on some roofs
      const bw = w * G, bd = d * G, r = hash(ix * 3 + 1, iz * 7 + 2);
      if (bw > 3 && bd > 3 && h < 10) roofClutter(x0 + bw / 2, h, z0 + bd / 2, bw, bd, r);
    }
  }
  function roofClutter(x, y, z, w, d, r) {
    const k = r % 7;
    if (k === 0) { L.cyl('paintGrey', x, y + 1.2, z, 0.55, 1.1, 0, 0, true); for (const [a, b] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) deco(x + a - 0.04, y, z + b - 0.04, x + a + 0.04, y + 0.7, z + b + 0.04, 'steel'); }
    else if (k === 1) { deco(x - 0.6, y, z - 0.5, x + 0.6, y + 0.8, z + 0.5, 'paintGrey'); L.cyl('steel', x, y + 0.85, z, 0.35, 0.08, 0, 0, true); }
    else if (k === 2) { L.pipe('steel', x, y, z, x, y + 1.1, z, 0.03); rgeo('appliance', K.geo('sphere'), x + 0.15, y + 1.2, z, 0.45, 0.45, 0.12, (r >>> 8) % 6, 0.5); }
    else if (k === 3 && w > 4) { for (const s of [-1, 1]) L.pipe('woodDark', x + s * w * 0.35, y, z, x + s * w * 0.35, y + 1.6, z, 0.03); L.pipe('rubber', x - w * 0.35, y + 1.55, z, x + w * 0.35, y + 1.55, z, 0.008);
      const cl = ['awningStripe', 'rugRed', 'awningBlue', 'fabric', 'appliance']; for (let i = 0; i < 4; i++) deco(x - w * 0.28 + i * w * 0.16, y + 0.9, z - 0.01, x - w * 0.28 + i * w * 0.16 + 0.5, y + 1.55, z + 0.01, cl[(r >>> (i + 3)) % 5]); }
    else if (k === 4) deco(x - 0.9, y, z - 0.9, x + 0.9, y + 0.5, z + 0.9, 'adobeLight');
  }

  // ------------------------------------------------------------ floors, ramps, roofs
  function floors() {
    for (const a of AREAS) {
      const [x0, z0, x1, z1] = a.r;
      if (!a.ramp) { L.box(x0, DEEP, z0, x1, a.y, z1, a.floor, { side: 'limestone', ao: false }); continue; }
      ramp(a);
    }
  }
  function ramp(a) {
    const [x0, z0, x1, z1] = a.r, [ax, ya, yb] = a.ramp, lo = Math.min(ya, yb);
    L.box(x0, DEEP, z0, x1, lo, z1, a.floor, { skip: [2], side: 'limestone', ao: false });
    const y = (x, z) => floorAt(a, x, z);
    const c = [[x0, y(x0, z0), z0], [x1, y(x1, z0), z0], [x1, y(x1, z1), z1], [x0, y(x0, z1), z1]];
    tris(a.floor, [...c[0], ...c[2], ...c[1], ...c[0], ...c[3], ...c[2]], (x, yy, z) => [x * 0.25, -z * 0.25]);
    // skirts along both sides of the slope (hidden where a wall stands against them)
    const sk = (p, q) => { const b0 = [p[0], lo, p[2]], b1 = [q[0], lo, q[2]]; tris('limestone', [...b0, ...p, ...q, ...b0, ...q, ...b1, ...b0, ...q, ...p, ...b0, ...b1, ...q], (x, yy, z) => [(ax === 'x' ? x : z) * 0.25, yy * 0.25]); };
    if (ax === 'z') { sk(c[0], c[3]); sk(c[1], c[2]); } else { sk(c[0], c[1]); sk(c[3], c[2]); }
    // colliders: thin slices, each topped at its high end
    const len = ax === 'x' ? x1 - x0 : z1 - z0, n = Math.max(2, Math.ceil(Math.abs(yb - ya) / 0.08));
    for (let i = 0; i < n; i++) {
      const s0 = (ax === 'x' ? x0 : z0) + len * i / n, s1 = s0 + len / n, top = Math.max(ya + (yb - ya) * i / n, ya + (yb - ya) * (i + 1) / n);
      if (ax === 'x') W.add(s0, lo - 0.5, z0, s1, top, z1, { surf: 'concrete' }); else W.add(x0, lo - 0.5, s0, x1, top, s1, { surf: 'concrete' });
    }
  }
  function roofs() {
    for (const a of AREAS) {
      if (!a.roof) continue;
      const [x0, z0, x1, z1] = a.r, alongX = x1 - x0 > z1 - z0;
      L.box(x0, a.roof, z0, x1, a.roof + 0.2, z1, 'tunnelWood', { bottom: true, ao: false, nav: false }); // nav reads the floor below
      L.box(x0, a.roof + 0.2, z0, x1, 6.0, z1, 'adobe', { top: 'roofTop', ao: false, nav: false });
      // lintel beams round the edge (hidden where the ceiling meets a wall), joists under the boards
      deco(x0 - 0.15, a.roof - 0.25, z0 - 0.15, x1 + 0.15, a.roof + 0.2, z0 + 0.1, 'woodDark'); deco(x0 - 0.15, a.roof - 0.25, z1 - 0.1, x1 + 0.15, a.roof + 0.2, z1 + 0.15, 'woodDark');
      deco(x0 - 0.15, a.roof - 0.25, z0, x0 + 0.1, a.roof + 0.2, z1, 'woodDark'); deco(x1 - 0.1, a.roof - 0.25, z0, x1 + 0.15, a.roof + 0.2, z1, 'woodDark');
      if (alongX) for (let x = x0 + 0.8; x < x1; x += 1.6) deco(x - 0.1, a.roof - 0.22, z0, x + 0.1, a.roof, z1, 'tunnelWood');
      else for (let z = z0 + 0.8; z < z1; z += 1.6) deco(x0, a.roof - 0.22, z - 0.1, x1, a.roof, z + 0.1, 'tunnelWood');
    }
  }
  /** Stone arch over a passage cut through a building (the Long doors). passZ: the passage runs along Z. */
  function arch(x0, z0, x1, z1, passZ, y, spring, top, fill) {
    const w = passZ ? x1 - x0 : z1 - z0, dep = passZ ? z1 - z0 : x1 - x0, r = w / 2, h = top - y, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const s = new THREE.Shape(); s.moveTo(-r, spring); s.absarc(0, spring, r, PI, 0, true); s.lineTo(r, h); s.lineTo(-r, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: false, curveSegments: 16 }), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
    if (passZ) rgeo('limestone', g, mx, y, z0, 1, 1, 1, 0); else rgeo('limestone', g, x0, y, mz, 1, 1, 1, PI / 2);
    L.box(x0, y + spring + r * 0.7, z0, x1, top, z1, 'limestone', { noMesh: true, nav: false });
    L.box(x0, top, z0, x1, fill, z1, 'adobe', { top: 'roofTop', ao: false, nav: false });
    // voussoir joints on both faces
    for (const f of passZ ? [z0 - 0.01, z1 + 0.01] : [x0 - 0.01, x1 + 0.01]) for (let i = 1; i < 9; i++) {
      const t = PI - i * PI / 9, px = Math.cos(t) * (r + 0.3), py = y + spring + Math.sin(t) * (r + 0.3);
      if (passZ) rbox('limestoneDark', mx + px, py, f, 0.05, 0.6, 0.03, 0, 0, t - PI / 2); else rbox('limestoneDark', f, py, mz - px, 0.03, 0.6, 0.05, 0, t - PI / 2, 0);
    }
  }

  // ------------------------------------------------------------ facades
  /** Every face a building shows to a street, as runs of equal area and height. */
  function facades() {
    const runs = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const alongZ = dx !== 0, nO = alongZ ? NX : NZ, nI = alongZ ? NZ : NX;
      for (let o = 0; o < nO; o++) {
        let run = null;
        for (let q = 0; q <= nI; q++) {
          let key = null, ai = -1, h = 0;
          if (q < nI) {
            const ix = alongZ ? o : q, iz = alongZ ? q : o, jx = ix + dx, jz = iz + dz;
            if (isMass(ix, iz) && inGrid(jx, jz) && !isMass(jx, jz)) { ai = AREA[jz * NX + jx]; h = HM[iz * NX + ix]; key = ai * 100 + h; }
          }
          if (run && key === run.key) { run.q1 = q + 1; continue; }
          if (run) runs.push(run);
          run = key === null ? null : { key, o, q0: q, q1: q + 1, dx, dz, a: AREAS[ai], h };
        }
      }
    }
    for (const r of runs) {
      const alongZ = r.dx !== 0, out = alongZ ? r.dx : r.dz;
      const c = alongZ ? BX0 + (r.o + (r.dx > 0 ? 1 : 0)) * G : BZ0 + (r.o + (r.dz > 0 ? 1 : 0)) * G;
      const a0 = (alongZ ? BZ0 : BX0) + r.q0 * G, a1 = (alongZ ? BZ0 : BX0) + r.q1 * G;
      facade(alongZ ? 'z' : 'x', a0, a1, c, out, r.a, r.h);
    }
  }
  function facade(axis, a0, a1, c, out, area, top) {
    const rnd = U.mulberry32(hash(Math.round(c * 4) + (axis === 'x' ? 7777 : 0), Math.round(a0 * 4) + out * 3));
    const len = a1 - a0, dx = axis === 'z' ? out : 0, dz = axis === 'x' ? out : 0;
    /** Box in facade space: along p0..p1, height q0..q1, standing out d0..d1 from the wall. */
    const B = (p0, p1, q0, q1, d0, d1, m) => {
      const e0 = c + out * d0, e1 = c + out * d1;
      if (axis === 'x') deco(p0, q0, Math.min(e0, e1), p1, q1, Math.max(e0, e1), m); else deco(Math.min(e0, e1), q0, p0, Math.max(e0, e1), q1, p1, m);
    };
    const wpt = (p, d) => axis === 'x' ? [p, c + out * d] : [c + out * d, p];
    const fAt = (p) => { const [x, z] = wpt(p, 0.3); return floorAt(area, x, z); };
    const yf = yMax(area), yl = yMin(area);
    // plinth, following a ramp in steps
    if (area.ramp) for (let p = a0; p < a1 - 0.01; p += 1) B(p, Math.min(a1, p + 1), fAt(p + 0.5) - 0.3, fAt(p + 0.5) + 0.4, 0, 0.06, 'limestoneDark');
    else B(a0, a1, yl - 0.2, yl + 0.42, 0, 0.06, 'limestoneDark');
    if (area.roof) { tunnelWall(B, a0, a1, area, rnd, wpt, out, axis); return; }
    const style = (rnd() * 4) | 0, H = top - yf;
    if (style === 0 && H > 3) B(a0, a1, yl + 0.42, yf + 2.6, 0, 0.035, 'limestone');
    if (style === 1 && H > 3) { B(a0, a1, yl + 0.42, yf + 1.1, 0, 0.04, 'adobeGrey'); B(a0, a1, yf + 1.1, yf + 1.18, 0, 0.07, 'limestone'); }
    if (len < 1.2) return;
    // cornice and a parapet that breaks the skyline
    B(a0 - 0.02, a1 + 0.02, top - 0.28, top - 0.04, 0, 0.13, 'limestone');
    B(a0, a1, top, top + 0.4, -0.3, 0.02, style === 2 ? 'limestone' : 'adobeLight');
    if (rnd() < 0.35) for (let p = a0 + 0.3; p < a1 - 0.6; p += 1.3) B(p, p + 0.6, top + 0.4, top + 0.72, -0.3, 0.02, 'adobeLight');
    // roof beam ends (vigas)
    if (rnd() < 0.45 && H > 3.5) for (let p = a0 + 0.55; p < a1 - 0.3; p += 1.15) B(p - 0.09, p + 0.09, top - 1.05, top - 0.86, 0, 0.42, 'woodDark');
    // plaster patches and exposed brick
    for (let i = 0; i < len / 6; i++) {
      const p = a0 + rnd() * Math.max(0.1, len - 1.6), w = 0.8 + rnd() * 1.6, y = yf + 0.6 + rnd() * Math.max(0.2, H - 2.2), h = 0.4 + rnd() * 0.9;
      if (y + h < top - 0.4) B(p, Math.min(a1, p + w), y, y + h, 0, 0.012, rnd() < 0.5 ? 'adobeWhite' : 'adobePink');
    }
    // windows, doors and wall furniture along the run
    let p = a0 + 1.2 + rnd() * 2;
    while (p < a1 - 1.2) {
      const k = rnd(), fy = fAt(p);
      if (k < 0.34 && H > 4.2) window_(B, p, Math.min(yf + 3.0, top - 1.6), 0.7 + rnd() * 0.5, rnd);
      else if (k < 0.46 && !area.ramp && H > 3.2) door_(B, p, fy, rnd, wpt, out, axis);
      else if (k < 0.54) { B(p - 0.6, p + 0.6, fy + 0.9, fy + 1.9, 0, 0.012, 'winDark'); for (let q = p - 0.5; q < p + 0.55; q += 0.2) B(q - 0.015, q + 0.015, fy + 0.9, fy + 1.9, 0, 0.06, 'ironDark'); B(p - 0.72, p + 0.72, fy + 0.8, fy + 0.9, 0, 0.12, 'limestone'); }
      else if (k < 0.62) { const [x, z] = wpt(p, 0.07); L.pipe('paintDark', x, top - 0.3, z, x, fy + 0.2, z, 0.05); B(p - 0.08, p + 0.08, fy, fy + 0.25, 0, 0.18, 'paintDark'); }
      else if (k < 0.7) { B(p - 0.25, p + 0.25, fy + 1.4, fy + 2.0, 0, 0.18, 'paintGrey'); const [x, z] = wpt(p, 0.1); L.pipe('paintDark', x, fy + 2.0, z, x, top - 0.2, z, 0.025); }
      else if (k < 0.76 && H > 4) { const [wx, wz] = wpt(p, 0.02), [x, z] = wpt(p, 0.35); L.pipe('ironDark', wx, fy + 3.1, wz, x, fy + 3.1, z, 0.02); K.sph('lampWarm', x, fy + 2.95, z, 0.09); L.cyl('ironDark', x, fy + 3.12, z, 0.14, 0.05, 0, 0, true); }
      else if (k < 0.84 && H > 4) B(p - 0.7, p + 0.7, top - 2.2, top - 0.2, 0.02, 0.05, rnd() < 0.5 ? 'rugRed' : 'rugBlue');
      p += 2.4 + rnd() * 3.2;
    }
    // sand drifted against the foot of the wall
    if (!area.ramp && rnd() < 0.5) { const q = a0 + rnd() * len, [x, z] = wpt(q, 0.1); K.sph('sandGround', x, yl, z, 0.9 + rnd() * 0.8, 0.22, 0.9); }
  }
  function window_(B, p, y, w, rnd) {
    B(p - w / 2, p + w / 2, y, y + 1.2, 0, 0.012, 'winDark');
    B(p - w / 2 - 0.1, p - w / 2, y - 0.05, y + 1.3, 0, 0.07, 'woodDark'); B(p + w / 2, p + w / 2 + 0.1, y - 0.05, y + 1.3, 0, 0.07, 'woodDark');
    B(p - w / 2 - 0.1, p + w / 2 + 0.1, y + 1.2, y + 1.32, 0, 0.09, 'woodDark'); B(p - w / 2 - 0.16, p + w / 2 + 0.16, y - 0.12, y, 0, 0.14, 'limestone');
    const k = rnd();
    if (k < 0.4) { const m = rnd() < 0.5 ? 'shutterGreen' : 'shutterBlue'; B(p - w - 0.1, p - w / 2 - 0.1, y, y + 1.2, 0.02, 0.06, m); B(p + w / 2 + 0.1, p + w + 0.1, y, y + 1.2, 0.02, 0.06, m); }
    else if (k < 0.7) for (let q = p - w / 2 + 0.12; q < p + w / 2; q += 0.16) B(q - 0.012, q + 0.012, y, y + 1.2, 0, 0.05, 'ironDark');
    else if (k < 0.85) { B(p - w / 2 - 0.3, p + w / 2 + 0.3, y - 0.2, y - 0.12, 0, 0.7, 'woodDark'); for (let q = p - w / 2 - 0.25; q < p + w / 2 + 0.3; q += 0.18) B(q - 0.012, q + 0.012, y - 0.12, y + 0.4, 0.66, 0.69, 'ironDark'); B(p - w / 2 - 0.3, p + w / 2 + 0.3, y + 0.38, y + 0.42, 0.64, 0.7, 'ironDark'); }
  }
  function door_(B, p, fy, rnd, wpt, out, axis) {
    const w = 1.1 + rnd() * 0.3;
    B(p - w / 2 - 0.22, p - w / 2, fy, fy + 2.5, 0, 0.1, 'limestone'); B(p + w / 2, p + w / 2 + 0.22, fy, fy + 2.5, 0, 0.1, 'limestone');
    B(p - w / 2 - 0.22, p + w / 2 + 0.22, fy + 2.3, fy + 2.62, 0, 0.12, 'limestone');
    B(p - w / 2, p + w / 2, fy, fy + 2.3, 0, 0.03, rnd() < 0.7 ? 'doorWood' : 'shutterBlue');
    for (const y of [fy + 0.5, fy + 1.8]) B(p - w / 2, p + w / 2, y, y + 0.07, 0.02, 0.045, 'ironDark');
    const [x, z] = wpt(p + w * 0.32, 0.07); K.sph('ironDark', x, fy + 1.1, z, 0.04);
    B(p - w / 2 - 0.3, p + w / 2 + 0.3, fy, fy + 0.1, 0, 0.35, 'limestoneDark');
    if (rnd() < 0.45) { // cloth awning on two poles
      const m = ['awningRed', 'awningStripe', 'awningBlue', 'awningGreen'][(rnd() * 4) | 0], [ax, az] = wpt(p, 0.65);
      rbox(m, ax, fy + 2.75, az, axis === 'x' ? w + 0.8 : 1.3, 0.03, axis === 'x' ? 1.3 : w + 0.8, 0, axis === 'x' ? out * 0.35 : 0, axis === 'z' ? -out * 0.35 : 0);
    }
  }
  /** Tunnel walls: timber props every few metres, a cable along the top, lamps. */
  function tunnelWall(B, a0, a1, area, rnd, wpt, out, axis) {
    const roof = area.roof;
    B(a0, a1, yMin(area) + 0.42, roof, 0, 0.02, 'tunnelPlaster');
    for (let p = a0 + 1.4; p < a1 - 0.5; p += 3.2) {
      const fy = floorAt(area, ...wpt(p, 0.3));
      B(p - 0.13, p + 0.13, fy, roof, 0, 0.24, 'tunnelWood');
      if (rnd() < 0.3) { const [x, z] = wpt(p + 1.6, 0.25); K.put('adobeOchre', K.geo('sphere'), x, fy + 0.35, z, 0.26, 0.36, 0.26); }
    }
    B(a0, a1, roof - 0.35, roof - 0.3, 0.05, 0.09, 'rubber');
    for (let p = a0 + 3; p < a1 - 1; p += 8) {
      const [x, z] = wpt(p, 0.3), fy = floorAt(area, x, z);
      B(p - 0.03, p + 0.03, roof - 0.62, roof - 0.56, 0, 0.3, 'ironDark'); L.pipe('ironDark', x, roof - 0.59, z, x, roof - 0.72, z, 0.01);
      L.cyl('ironDark', x, roof - 0.74, z, 0.1, 0.04, 0, 0, true); K.sph('lampWarm', x, roof - 0.86, z, 0.075, 0.1, 0.075); L.cyl('ironDark', x, roof - 0.97, z, 0.08, 0.03, 0, 0, true);
      L.lamp(x, roof - 1.0, z, { color: 0xffc27a, intensity: 1.3, distance: 9, pool: true, poolSize: 5, groundY: fy });
    }
  }

  // ------------------------------------------------------------ props
  function crate(x, y, z, s, ry) { // s: 1.2 or 0.9 (the Prop Hunt kinds); anything else is a plain box
    if (s === 1.2) P('dustCrate', x, z, ry || 0, y); else if (s === 0.9) P('dustCrateSmall', x, z, ry || 0, y);
    else { L.propBox('dustCrate', x, y, z, s, s, s, ry || 0); solid(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2); L.blob(x, z, s + 0.5, s + 0.5, y); }
  }
  /** Big crate stack: 2 x 2 on the ground and n on top (the default boxes). */
  function stack(x, y, z, top, ry) {
    for (const [a, b] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) crate(x + a, y, z + b, 1.2, ry);
    for (let i = 0; i < top; i++) crate(x + (i ? 0.66 : -0.56), y + 1.2, z + (i ? 0.3 : -0.3), 1.2, (ry || 0) + (i ? 0.08 : -0.05));
  }
  function barrel(x, y, z, red) { P(red ? 'drum' : 'barrel', x, z, 0, y); }
  function amphora(x, y, z, s) {
    s = s || 1;
    K.sph('adobeOchre', x, y + 0.36 * s, z, 0.26 * s, 0.36 * s, 0.26 * s); L.cyl('adobeOchre', x, y + 0.72 * s, z, 0.09 * s, 0.14 * s, 0, 0, true);
    L.cyl('adobeOchre', x, y + 0.8 * s, z, 0.13 * s, 0.04 * s, 0, 0, true); W.addCyl(x, z, 0.25 * s, y, y + 0.8 * s, { surf: 'concrete' });
  }
  function palm(x, z, h, rnd) { MS.palm(x, z, h, rnd); }
  /** Old sedan, local +X forward. */
  function oldCar(x, y, z, ry, paint) {
    const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const part = (m, lx, ly, lz, sx, sy, sz, rz) => { const [px, pz] = at(lx, lz); rbox(m, px, y + ly, pz, sx, sy, sz, ry, 0, rz || 0); };
    const burnt = paint === 'scorched';
    part(paint, 0, 0.62, 0, 4.2, 0.5, 1.72); part(paint, 1.55, 0.92, 0, 1.1, 0.14, 1.66, -0.08); part(paint, -1.6, 0.94, 0, 1.0, 0.14, 1.66, 0.05);
    part(burnt ? 'scorched' : 'winDark', -0.15, 1.18, 0, 2.0, 0.5, 1.56); part(paint, -0.2, 1.46, 0, 1.6, 0.08, 1.6);
    part(burnt ? 'scorched' : 'chrome', 2.12, 0.5, 0, 0.12, 0.16, 1.76); part(burnt ? 'scorched' : 'chrome', -2.12, 0.5, 0, 0.12, 0.16, 1.76);
    if (!burnt) { part('lampWarm', 2.1, 0.72, -0.62, 0.06, 0.14, 0.26); part('lampWarm', 2.1, 0.72, 0.62, 0.06, 0.14, 0.26); part('lampRed', -2.1, 0.74, -0.66, 0.06, 0.1, 0.22); part('lampRed', -2.1, 0.74, 0.66, 0.06, 0.1, 0.22); }
    for (const [lx, lz] of [[-1.35, -0.82], [1.35, -0.82], [-1.35, 0.82], [1.35, 0.82]]) { const [px, pz] = at(lx, lz); rgeo('rubber', L.geo('cylLo'), px, y + 0.33, pz, 0.33, 0.24, 0.33, ry, PI / 2); }
    for (const lx of [-1.4, 0, 1.4]) { const [px, pz] = at(lx, 0); W.addCyl(px, pz, 0.95, y, y + 1.5, { surf: 'metal' }); }
    L.blob(x, z, 3.2, 3.2, y);
  }
  /** Two-wheeled hand cart, shafts toward local +X. */
  function cart(x, y, z, ry, load) {
    const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const part = (m, lx, ly, lz, sx, sy, sz, rz) => { const [px, pz] = at(lx, lz); rbox(m, px, y + ly, pz, sx, sy, sz, ry, 0, rz || 0); };
    part('wood', 0, 0.72, 0, 2.0, 0.08, 1.2); part('woodDark', 0, 0.95, -0.58, 2.0, 0.4, 0.05); part('woodDark', 0, 0.95, 0.58, 2.0, 0.4, 0.05); part('woodDark', -0.98, 0.95, 0, 0.05, 0.4, 1.2);
    for (const lz of [-0.35, 0.35]) part('woodDark', 1.6, 0.6, lz, 1.4, 0.07, 0.07, -0.15);
    for (const lz of [-0.72, 0.72]) { const [px, pz] = at(0, lz); rgeo('woodDark', L.geo('cylLo'), px, y + 0.5, pz, 0.5, 0.08, 0.5, ry, PI / 2); rgeo('ironDark', L.geo('torus'), px, y + 0.5, pz, 0.5, 0.5, 0.5, ry); }
    if (load) { part('tarp', -0.1, 1.0, 0, 1.6, 0.5, 1.0); part('sandbag', 0.5, 1.3, 0.1, 0.7, 0.25, 0.5); }
    const [px, pz] = at(0, 0), hw = Math.abs(c) * 1.1 + Math.abs(s) * 0.7, hd = Math.abs(s) * 1.1 + Math.abs(c) * 0.7;
    solid(px - hw, y, pz - hd, px + hw, y + 1.2, pz + hd);
    L.blob(x, z, 2.6, 2.6, y);
  }
  /** Wooden door leaf hinged at (x, z), lying along local +X from the hinge (ry turns it). */
  function leaf(x, y, z, w, h, ry, m) {
    const c = Math.cos(ry), s = Math.sin(ry), at = (l) => [x + c * l, z - s * l];
    const [mx, mz] = at(w / 2);
    rbox(m || 'doorWood', mx, y + h / 2, mz, w, h, 0.09, ry);
    for (const yy of [0.35, h / 2, h - 0.35]) rbox('ironDark', mx, y + yy, mz, w * 0.94, 0.08, 0.12, ry);
    for (let l = 0.2; l < w; l += 0.28) { const [px, pz] = at(l); rbox('woodDark', px, y + h / 2, pz, 0.02, h - 0.1, 0.1, ry); }
    const n = Math.ceil(w / 0.3);
    for (let i = 0; i < n; i++) { const [px, pz] = at((i + 0.5) * w / n); solid(px - 0.12, y, pz - 0.12, px + 0.12, y + h, pz + 0.12); }
  }
  /** A stone wall across a street with a doorway (the mid doors, the B doors). axis: the wall's run. */
  function gateWall(axis, a0, a1, c, y, o0, o1, top) {
    cut(axis, a0, a1, c, 0.6, y, top, [[o0, o1, y, y + 3.0]], 'limestone', {});
    const bx = (p0, p1, q0, q1, t, m) => axis === 'x' ? deco(p0, q0, c - t, p1, q1, c + t, m) : deco(c - t, q0, p0, c + t, q1, p1, m);
    bx(o0 - 0.3, o1 + 0.3, y + 3.0, y + 3.3, 0.36, 'woodDark');
    bx(a0, a1, top - 0.2, top, 0.4, 'limestoneDark');
    for (const o of [o0, o1]) bx(o - 0.12, o + 0.12, y, y + 3.0, 0.34, 'limestoneDark');
  }
  function lowWall(x0, z0, x1, z1, y, h, m) { L.box(x0, y, z0, x1, y + h, z1, m || 'limestone', { top: 'limestoneDark' }); }
  /** Sagging cable between two points. */
  function wire(a, b, sag) {
    const n = 10; let px = a[0], py = a[1], pz = a[2];
    for (let i = 1; i <= n; i++) { const k = i / n, x = a[0] + (b[0] - a[0]) * k, z = a[2] + (b[2] - a[2]) * k, y = a[1] + (b[1] - a[1]) * k - Math.sin(k * PI) * sag; L.pipe('rubber', px, py, pz, x, y, z, 0.015); px = x; py = y; pz = z; }
  }
  /** A string of cloth pennants or washing across a street. */
  function bunting(a, b, sag, rnd) {
    wire(a, b, sag);
    const cl = ['awningRed', 'awningStripe', 'awningBlue', 'awningGreen', 'rugRed'], n = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.9), ry = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
    for (let i = 1; i < n; i++) { const k = i / n, y = a[1] + (b[1] - a[1]) * k - Math.sin(k * PI) * sag; rbox(cl[(rnd() * cl.length) | 0], a[0] + (b[0] - a[0]) * k, y - 0.25, a[2] + (b[2] - a[2]) * k, 0.4, 0.45, 0.01, ry); }
  }
  function sandbags(x0, z0, x1, z1, y, h) {
    h = h || 0.9; const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    L.box(x0, y, z0, x1, y + h, z1, 'sandbag', { ao: false });
    for (let yy = y + 0.3; yy < y + h; yy += 0.3) deco(alongX ? x0 : x0 - 0.03, yy - 0.03, alongX ? z0 - 0.03 : z0, alongX ? x1 : x1 + 0.03, yy, alongX ? z1 + 0.03 : z1, 'sandbag');
  }
  function well(x, y, z) {
    L.cyl('limestone', x, y + 0.45, z, 1.0, 0.9, 0, 0, false); L.cyl('limestoneDark', x, y + 0.92, z, 1.06, 0.08, 0, 0, false); L.cyl('rubber', x, y + 0.9, z, 0.8, 0.02, 0, 0, false);
    for (const s of [-1, 1]) L.pipe('woodDark', x + s * 0.9, y + 0.9, z, x + s * 0.9, y + 2.5, z, 0.07);
    L.pipe('woodDark', x - 1.0, y + 2.4, z, x + 1.0, y + 2.4, z, 0.06); L.pipe('rubber', x, y + 2.4, z, x, y + 1.6, z, 0.01);
    L.cyl('woodDark', x, y + 1.5, z, 0.14, 0.22, 0, 0, true);
    W.addCyl(x, z, 1.05, y, y + 0.95, { surf: 'concrete' });
  }
  function tarpPile(x, y, z, w, d) { deco(x - w / 2, y, z - d / 2, x + w / 2, y + 0.9, z + d / 2, 'tarp'); K.sph('tarp', x, y + 0.9, z, w * 0.45, 0.25, d * 0.45); solid(x - w / 2, y, z - d / 2, x + w / 2, y + 1.1, z + d / 2); }
  function dumpster(x, y, z, alongZ) { // the Long "blue"
    const hx = alongZ ? 0.85 : 1.35, hz = alongZ ? 1.35 : 0.85;
    L.box(x - hx, y + 0.12, z - hz, x + hx, y + 1.45, z + hz, 'paintBlue', { top: 'paintDark' });
    rbox('paintBlue', x, y + 1.62, z + (alongZ ? 0 : -hz * 0.5), hx * 2 + 0.04, 0.06, hz * 1.1, 0, alongZ ? 0 : -0.35, alongZ ? 0.35 : 0);
    for (const s of [-1, 1]) deco(x - (alongZ ? hx + 0.05 : 0.08) + (alongZ ? 0 : s * hx * 0.6), y + 0.9, z - (alongZ ? 0.08 : hz + 0.05) + (alongZ ? s * hz * 0.6 : 0), x + (alongZ ? hx + 0.05 : 0.08) + (alongZ ? 0 : s * hx * 0.6), y + 1.0, z + (alongZ ? 0.08 : hz + 0.05) + (alongZ ? s * hz * 0.6 : 0), 'steel');
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.cyl('rubber', x + a * (hx - 0.2), y + 0.08, z + b * (hz - 0.2), 0.08, 0.1, PI / 2, 0, true);
  }

  // ------------------------------------------------------------ areas
  function tSpawn(rnd) {
    const y = A.ts.y;
    palm(-11, 53.5, 8, rnd); palm(10.5, 53, 7.2, rnd); palm(-1, 54.5, 9, rnd); palm(-12, 42.5, 6.5, rnd);
    well(3.5, y, 49);
    cart(-6, y, 51.5, 0.3, true);
    crate(-10.5, y, 47.5, 1.2); crate(-10.3, y, 46.2, 0.9, 0.2); crate(-10.4, y + 1.2, 47.5, 0.9, -0.2);
    for (let i = 0; i < 4; i++) amphora(11.5 + (i % 2) * 0.6, y, 45 + i * 0.7, 0.9 + (i % 3) * 0.1);
    tarpPile(8.5, y, 42.4, 2.2, 1.4);
    lowWall(-4, 44.5, 0, 45.1, y, 0.9, 'adobeSand');
    // painted arrows toward the lanes (a wall facing +Z reads left to right from west to east)
    wallSign(art().toA, 1.4, 1.4, 12, y + 2.3, 40, 0, 1); wallSign(art().toB, 1.4, 1.4, -11, y + 2.3, 40, 0, 1);
    bunting([-12, y + 5.4, 55.9], [12, y + 5.0, 55.9], 0.4, rnd);
    bunting([-8, 6.2, 40.1], [10, 6.6, 40.1], 0.7, rnd);
    L.addPickup('ammo', 0, y, 48);
  }
  function outsideLong(rnd) {
    // T ramp: low walls along the uphill edge, pots, a stall
    for (let i = 0; i < 3; i++) amphora(15 + i * 0.7, floorAt(A.tramp, 15 + i * 0.7, 49.2), 49.2);
    stack(30, 0, 25.5, 1);
    crate(25, 0, 38.4, 1.2); crate(26.3, 0, 38.6, 0.9, 0.3);
    barrel(44.9, 0, 38.9, true); barrel(44.1, 0, 39.2); barrel(44.8, 0, 38.1);
    cart(34, 0, 36.5, PI * 0.9, false);
    tarpPile(23.5, 0, 23.3, 2.4, 1.8);
    for (let i = 0; i < 5; i++) amphora(45.3, 0, 26 + i * 0.65, 0.8 + (i % 2) * 0.2);
    bunting([22.2, 6.0, 30], [45.8, 6.3, 30], 0.9, rnd);
    wire([22.1, 6.8, 24], [45.9, 6.2, 35], 1.2);
    wallSign(art().toA, 1.4, 1.4, 34.5, 2.2, 22, 0, 1);
    // the Long doors: a stone arch through the building, one leaf shut, one swung back
    arch(37, 20, 40, 22, true, 0, 2.7, 4.8, 6.4);
    leaf(37.05, 0, 21, 1.35, 2.95, 0); leaf(39.9, 0, 21.0, 1.4, 2.95, PI / 2);
    L.addPickup('ammo', 30, 0, 32);
  }
  function longA(rnd) {
    dumpster(44.3, 0, 15.5, true); // blue
    crate(33.2, 0, 17.8, 1.2, 0.1); crate(33.3, 0, 16.5, 0.9);
    stack(34.6, 0, -6, 1, 0.05); // long corner boxes
    oldCar(43.4, 0, -13, PI / 2 + 0.08, 'paintCream');
    barrel(45.3, 0, 4, true); barrel(45.4, 0, 3.2);
    for (let i = 0; i < 4; i++) amphora(32.5, 0, 8 + i * 0.7);
    wire([32.1, 6.4, 12], [45.9, 6.8, 2], 1.0); wire([32.1, 6.6, -12], [45.9, 6.1, -16], 0.8);
    bunting([32.1, 5.8, -2], [45.9, 5.6, -2], 0.8, rnd);
    // the wall between the A ramp and the pit
    for (const [z0, z1, t] of [[-36, -32, 2.8], [-32, -28, 2.2], [-28, -24, 1.4]]) lowWall(41.7, z0, 42.2, z1, -1, t + 1, 'limestone');
    crate(33, floorAt(A.aramp, 33, -30), -30, 0.9, 0.2);
    L.addPickup('ammo', 38, 0, 0);
  }
  function pit(rnd) {
    const y = A.pit.y;
    stack(51.5, y, -52.5, 2);
    crate(52.6, y, -30, 1.2); crate(52.8, y, -31.3, 0.9, 0.3); barrel(48, y, -55.2); barrel(47.2, y, -55.3, true);
    steps('x', 42, 46, -52, -48, y, A.asite.y, -1, 'limestone', 'paving');
    tarpPile(47, y, -30.2, 2.0, 1.2);
    L.addPickup('ammo', 50, y, -40);
  }
  function aSite(rnd) {
    const y = A.asite.y;
    // parapets: over CT (the stairs come up through a gap) and over the pit
    lowWall(8, -58, 8.5, -50, y, 1.0); lowWall(8, -42, 8.5, -36, y, 1.0);
    lowWall(41.7, -58, 42.2, -52, y, 1.0); lowWall(41.7, -48, 42.2, -36, y, 1.0);
    // the default boxes, the goose corner, crates by short, barrels
    stack(24, y, -47, 1);
    lowWall(35.5, -52.5, 41.7, -52, y, 1.2, 'adobeSand'); crate(38.5, y, -55.8, 1.2); crate(39.9, y, -55.9, 1.2, 0.1); crate(39.2, y + 1.2, -55.8, 0.9, -0.2);
    crate(10.2, y, -38.1, 1.2); crate(11.5, y, -38.2, 0.9, 0.25);
    barrel(16, y, -57); barrel(16.8, y, -57.1, true); barrel(16.3, y, -56.3);
    oldCar(30, y, -39.6, 0.05, 'paintBlue');
    sandbags(18, -42.4, 21, -41.6, y, 0.9);
    for (let i = 0; i < 3; i++) amphora(41, y, -44 + i * 0.7);
    palm(12, -55, 7.5, rnd); palm(35, -57, 8.5, rnd);
    wallSign(art().A, 3.2, 3.2, 26, y + 3.4, -58, 0, 1);
    bunting([8.2, 7.4, -52], [41.8, 7.9, -52], 1.4, rnd);
    L.addPickup('armor', 24, y, -52);
  }
  function shortA(rnd) {
    const y = A.short.y;
    crate(14.8, y, -18, 1.2); crate(14.9, y, -16.7, 0.9, 0.2); crate(9.2, y, -28, 0.9);
    barrel(15.3, y, 4.8); barrel(15.2, y, 4.0, true);
    // the catwalk over mid: an iron rail on its edge, boxes at the end
    const r = (z0, z1) => { deco(1.95, A.cat.y + 0.95, z0, 2.08, A.cat.y + 1.02, z1, 'ironDark'); for (let z = z0; z <= z1 + 0.01; z += 0.4) deco(1.99, A.cat.y, z - 0.02, 2.04, A.cat.y + 0.95, z + 0.02, 'ironDark'); W.add(1.94, A.cat.y, z0, 2.1, A.cat.y + 1.02, z1, { shoot: false }); };
    r(-8, 0);
    crate(6.8, A.cat.y, -7.2, 1.2); crate(5.6, A.cat.y, -7.3, 0.9, 0.2);
    steps('x', 2, 8, 0, 6, 0, A.short.y, 1, 'limestone', 'paving');
    wallSign(art().A, 1.2, 1.2, 12, A.short.y + 2.4, 6, 0, -1);
    L.addPickup('ammo', 12, y, -8);
  }
  function midLane(rnd) {
    crate(-0.6, 0, 4.4, 1.2, 0.05); // the xbox
    gateWall('x', -6, 2, -22, 0, -4, -1, 4.8);
    leaf(-3.9, 0, -22.35, 1.45, 2.9, PI / 2); leaf(-1.02, 0, -21.95, 1.25, 2.9, PI);
    crate(-5.2, 0, -30, 1.2); crate(-5.3, 0, -31.3, 0.9, 0.2); barrel(1.3, 0, -35);
    crate(1.2, 0, 17, 0.9, 0.3);
    sandbags(-5.8, 12, -3.8, 12.7, 0, 0.9);
    wire([-5.9, 6.5, 14], [1.9, 6.9, 8], 0.8); wire([-5.9, 6.2, -12], [1.9, 6.4, -16], 0.6); bunting([-5.9, 5.8, -4], [1.9, 5.8, -4.5], 0.5, rnd);
    L.addPickup('ammo', -2, 0, -12);
  }
  function topMid(rnd) {
    stack(7.3, 0, 22.8, 1); barrel(-7.2, 0, 21); barrel(-7.3, 0, 21.8, true);
    cart(-5, 0, 29, -0.5, true);
    for (let i = 0; i < 3; i++) amphora(9.3, 0, 28 + i * 0.7);
    bunting([-7.9, 6.4, 26], [9.9, 6.6, 26], 0.8, rnd);
  }
  function tunnels(rnd) {
    // outside tunnels: palms, crates, a cart
    palm(-34, 44, 8, rnd); palm(-16, 44.5, 7, rnd);
    stack(-31, 1.2, 38.5, 1); cart(-20, floorAt(A.otunramp, -20, 30), 30, 0.2, true);
    barrel(-35.2, 1.2, 35); barrel(-35.3, 1.2, 35.8, true);
    wallSign(art().toB, 1.4, 1.4, -21, 2.6, 26, 0, 1);
    bunting([-35.9, 7.0, 40], [-14.1, 6.6, 40], 1, rnd);
    // upper tunnels
    crate(-33.2, 0, 24.5, 1.2); crate(-33.3, 0, 23.2, 0.9, 0.2); crate(-26.8, 0, 9.4, 1.2); barrel(-33.4, 0, -4.8); barrel(-32.7, 0, -5.2, true);
    tarpPile(-26.9, 0, 23.8, 1.6, 2.6);
    for (let i = 0; i < 3; i++) amphora(-33.5, 0, 12 + i * 0.6);
    // lower tunnels, with steps down from mid and up into the upper tunnels
    steps('x', -10, -6, 2, 8, A.ltun.y, 0, 1, 'limestone', 'packed');
    steps('x', -26, -22, 2, 8, A.ltun.y, 0, -1, 'limestone', 'packed');
    crate(-16, A.ltun.y, 7.3, 0.9, 0.2); barrel(-19, A.ltun.y, 2.6);
    // B tunnel
    stack(-38.6, 0, -24.5, 0); crate(-31, 0, -8.5, 1.2); barrel(-30.7, 0, -26.8, true);
    L.addPickup('ammo', -30, 0, 4); L.addPickup('ammo', -35, 0, -15);
  }
  function bSite(rnd) {
    // back plat with two steps, crates on it
    L.box(-54, 0, -58, -44, 1.0, -50, 'limestone', { top: 'paving' });
    L.box(-52, 0, -50, -46, 0.5, -49.2, 'limestone', { top: 'paving' });
    deco(-54, 1.0, -50.1, -44, 1.06, -49.95, 'limestoneDark');
    stack(-51, 1.0, -55.5, 1); crate(-45.2, 1.0, -57.1, 1.2); crate(-46.5, 1.0, -57.2, 0.9, 0.3);
    // the burnt car, the big box by the doors, crates at the tunnel exit, barrels
    oldCar(-44, 0, -38.5, 0.35, 'scorched');
    stack(-29.4, 0, -44, 1); crate(-35.8, 0, -29.8, 1.2); crate(-37.1, 0, -29.7, 0.9, 0.2);
    barrel(-25, 0, -57); barrel(-25.8, 0, -57.2, true); barrel(-25.2, 0, -56.2);
    sandbags(-53.5, -34, -50, -33.2, 0, 0.9);
    for (let i = 0; i < 4; i++) amphora(-53.4, 0, -46 + i * 0.7);
    palm(-50, -30.5, 8, rnd); palm(-27, -30, 7, rnd);
    wallSign(art().B, 3.2, 3.2, -39, 3.8, -58, 0, 1);
    wallSign(art().B, 1.6, 1.6, -54, 2.6, -40, 1, 0);
    bunting([-53.9, 7.2, -44], [-24.1, 6.8, -48], 1.5, rnd);
    // the B window, looking in from the little room off the B doors passage
    cut('z', -38, -32, -24, 0.5, 0, 6.0, [[-36, -34, 1.1, 2.3]], 'adobeSand', {});
    deco(-24.36, 1.0, -36.15, -23.64, 1.1, -33.85, 'limestone'); deco(-24.32, 2.3, -36.1, -23.68, 2.42, -33.9, 'woodDark');
    for (const z of [-36.1, -34.0]) deco(-24.3, 1.1, z, -23.7, 2.3, z + 0.1, 'woodDark');
    crate(-17, 0, -37.2, 0.9); crate(-22.6, 0, -32.8, 1.2);
    // the B doors between the site and the passage to CT
    gateWall('z', -46, -38, -24, 0, -43.5, -40.5, 4.6);
    leaf(-23.6, 0, -40.55, 1.45, 2.9, 0); leaf(-24.35, 0, -43.45, 1.4, 2.9, -PI / 2 - 0.55);
    crate(-13, 0, -45.2, 1.2); crate(-14.3, 0, -45.3, 0.9, 0.2);
    L.addPickup('armor', -40, 0, -48); L.addPickup('ammo', -18, 0, -42);
  }
  function ctSpawn(rnd) {
    steps('x', 2, 8, -50, -42, 0, A.asite.y, 1, 'limestone', 'paving');
    palm(-9.5, -55, 8.5, rnd); palm(-3, -57, 7, rnd); palm(5.5, -56, 8, rnd);
    oldCar(-8, 0, -43, PI / 2 - 0.05, 'paintMint');
    crate(-1.5, 0, -48, 1.2); crate(-0.2, 0, -48.1, 0.9, 0.25);
    sandbags(-11.8, -53, -11, -49, 0, 0.9);
    well(-2, 0, -53.5);
    barrel(7.2, 0, -57.2); barrel(7.3, 0, -56.4, true);
    wallSign(art().toA, 1.2, 1.2, -1, 2.4, -58, 0, 1);
    bunting([-11.9, 6.9, -50], [7.9, 7.1, -46], 1.2, rnd);
    L.addPickup('ammo', -4, 0, -40);
  }
  /** Beyond the walls: more roofs, a tower and domes against the hills, sand to the horizon. */
  function backdrop(rnd) {
    for (const b of [[-400, -400, 400, BZ0], [-400, BZ1, 400, 400], [-400, BZ0, BX0, BZ1], [BX1, BZ0, 400, BZ1]]) L.box(b[0], -2, b[1], b[2], 0, b[3], 'sandGround', { ao: false, noCol: true });
    const mats = ['adobe', 'adobeSand', 'adobeLight', 'limestone', 'adobeOchre'];
    for (let i = 0; i < 90; i++) {
      const a = rnd() * PI * 2, r = 72 + rnd() * 70, x = Math.cos(a) * r * 1.05, z = Math.sin(a) * r;
      const w = 6 + rnd() * 10, d = 6 + rnd() * 10, h = 8 + rnd() * 10 + (r > 110 ? 4 : 0);
      L.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, mats[(rnd() * mats.length) | 0], { top: 'roofTop', noCol: true, ao: false });
      if (rnd() < 0.25) K.sph('limestone', x, h, z, Math.min(w, d) * 0.35, Math.min(w, d) * 0.3, Math.min(w, d) * 0.35);
      if (rnd() < 0.2) palm(x + w / 2 + 1.5, z, 9 + rnd() * 3, rnd);
    }
    // a slim stone tower to the north-west and a water tower to the east
    L.box(-84, 0, -92, -78, 20, -86, 'limestone', { noCol: true }); L.box(-83, 20, -91, -79, 26, -87, 'adobeLight', { noCol: true }); K.sph('limestone', -81, 26, -89, 2.4, 2.8, 2.4);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.pipe('steel', 92 + a * 2, 0, -30 + b * 2, 92 + a * 1.4, 16, -30 + b * 1.4, 0.18);
    L.cyl('paintGrey', 92, 18.5, -30, 3.2, 5, 0, 0, false); K.put('paintGrey', K.geo('cone'), 92, 21.6, -30, 3.3, 1.2, 3.3);
  }

  // ------------------------------------------------------------ build
  MD.build = function () {
    K = CF.MapNuketown.kit; MS = CF.MapStory;
    materials();
    const rnd = U.mulberry32(1999);
    grid(); mass(); floors(); roofs(); facades();
    tSpawn(rnd); outsideLong(rnd); longA(rnd); pit(rnd); aSite(rnd); shortA(rnd); midLane(rnd); topMid(rnd); tunnels(rnd); bSite(rnd); ctSpawn(rnd);
    backdrop(rnd);
    L.killY = -12;

    // spawns: Terrorists in the south, Counter-Terrorists in the north
    const ty = A.ts.y;
    const tSp = [[-9, ty, 50], [-4, ty, 53], [2, ty, 53.5], [7, ty, 50], [-6, ty, 47], [8, ty, 46.5]];
    const ctSp = [[-8, 0, -55], [-4.5, 0, -50], [1, 0, -55.5], [5, 0, -52], [-5, 0, -40.5], [0, 0, -44]];
    L.spawns.t0 = tSp; L.spawns.t1 = ctSp;
    L.spawns.ffa = tSp.concat(ctSp, [[-40, 0, -46], [-47, 1.0, -53], [40, 0, 2], [38, 0, -18], [22, A.asite.y, -54], [33, A.asite.y, -44], [-2, 0, -8], [-2, 0, 14],
      [-30, 0, 2], [-36, 0, -18], [34, 0, 30], [48, -1, -44], [12, A.short.y, -22], [-20, 1.2, 40], [2, 0, 26], [-18, 0, -42]]);
    L.points.start = { x: 0, y: ty, z: 52, yaw: 0 };
  };
})(window.CF);
