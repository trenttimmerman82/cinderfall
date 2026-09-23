'use strict';
/* Cinderfall — NUKETOWN (multiplayer). A sunny 1950s cul-de-sac: two houses face each other across a street
   with a school bus in the middle, fenced backyards behind them, and desert test range beyond the fence. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MN = CF.MapNuketown = {};
  const T = 0.25; // wall thickness

  // ------------------------------------------------------------ geometry kit (cached, baked into material batches)
  const GEO = {};
  function tri(pos, a, b, c) { pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
  function finish(pos, uvFn) {
    const g = new THREE.BufferGeometry(), uv = [];
    for (let i = 0; i < pos.length; i += 3) { const r = uvFn(pos[i], pos[i + 1], pos[i + 2], i / 9 | 0); uv.push(r[0], r[1]); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }
  /** Gable roof slopes: base w × d at y = 0, ridge along X at height h. */
  function roofGeo(w, d, h) {
    const k = 'roof' + w + '_' + d + '_' + h; if (GEO[k]) return GEO[k];
    const x = w / 2, z = d / 2, pos = [];
    const A = [-x, 0, -z], B = [x, 0, -z], C = [x, h, 0], D = [-x, h, 0], A2 = [-x, 0, z], B2 = [x, 0, z];
    tri(pos, A, C, B); tri(pos, A, D, C); tri(pos, A2, B2, C); tri(pos, A2, C, D);
    const slope = Math.hypot(z, h);
    return (GEO[k] = finish(pos, (px, py) => [px * 0.3, (py / h) * slope * 0.3]));
  }
  /** The two triangular gable ends of roofGeo (siding). */
  function gableGeo(w, d, h) {
    const k = 'gable' + w + '_' + d + '_' + h; if (GEO[k]) return GEO[k];
    const x = w / 2, z = d / 2, pos = [];
    tri(pos, [x, 0, -z], [x, h, 0], [x, 0, z]); tri(pos, [-x, 0, -z], [-x, 0, z], [-x, h, 0]);
    return (GEO[k] = finish(pos, (px, py, pz) => [pz * 0.25, py * 0.25]));
  }
  /** Side-profile shape extruded across the vehicle width (rounded edges). */
  function extrude(key, pts, depth, bevel) {
    if (GEO[key]) return GEO[key];
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) sh.quadraticCurveTo(p[0], p[1], p[2], p[3]); else sh.lineTo(p[0], p[1]); }
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    return (GEO[key] = g);
  }
  /** Lumpy leaf blob: an icosphere pushed in and out by a smooth function of position (no cracks). */
  function blobGeo(v) {
    const k = 'blob' + v; if (GEO[k]) return GEO[k];
    const g = new THREE.IcosahedronGeometry(1, 2), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const f = 1 + 0.16 * Math.sin(x * 3.1 + y * 1.7 + v) * Math.cos(z * 2.9 - v * 0.7) + 0.08 * Math.sin((x + z) * 7 + y * 5 + v * 2);
      P.setXYZ(i, x * f, y * f * 0.9, z * f);
    }
    g.computeVertexNormals();
    return (GEO[k] = g);
  }
  function geo(kind) {
    if (GEO[kind]) return GEO[kind];
    if (kind === 'cone') GEO.cone = new THREE.ConeGeometry(1, 1, 10);
    if (kind === 'trunk') GEO.trunk = new THREE.CylinderGeometry(0.7, 1, 1, 8);
    return GEO[kind];
  }
  const put = (m, g, x, y, z, sx, sy, sz, ry, rx, rz) => L.addGeo(m, g, L.mat4(x, y, z, rx || 0, ry || 0, rz || 0, sx, sy, sz));

  /** Window/door dressing: trim frame, sill, mullions and a pair of shutters on the outside face. */
  function dressX(h, z, o, door) {
    const t = T / 2 + 0.05, y0 = h[2], y1 = h[3];
    for (const s of [-1, 1]) {
      L.box(h[0] - 0.1, y0, z + s * t - 0.03, h[0], y1 + 0.1, z + s * t + 0.03, 'trim', { noCol: true });
      L.box(h[1], y0, z + s * t - 0.03, h[1] + 0.1, y1 + 0.1, z + s * t + 0.03, 'trim', { noCol: true });
      L.box(h[0] - 0.1, y1, z + s * t - 0.03, h[1] + 0.1, y1 + 0.12, z + s * t + 0.03, 'trim', { noCol: true });
    }
    if (door) return;
    const xm = (h[0] + h[1]) / 2, ym = (y0 + y1) / 2;
    L.box(xm - 0.03, y0, z - 0.03, xm + 0.03, y1, z + 0.03, 'trim', { noCol: true });
    L.box(h[0], ym - 0.03, z - 0.03, h[1], ym + 0.03, z + 0.03, 'trim', { noCol: true });
    if (o) { const zo = z + o * (T / 2 + 0.04); L.box(h[0] - 0.62, y0, zo - 0.03, h[0] - 0.14, y1, zo + 0.03, 'shutter', { noCol: true }); L.box(h[1] + 0.14, y0, zo - 0.03, h[1] + 0.62, y1, zo + 0.03, 'shutter', { noCol: true }); }
  }
  function dressZ(h, x, o, door) {
    const t = T / 2 + 0.05, y0 = h[2], y1 = h[3];
    for (const s of [-1, 1]) {
      L.box(x + s * t - 0.03, y0, h[0] - 0.1, x + s * t + 0.03, y1 + 0.1, h[0], 'trim', { noCol: true });
      L.box(x + s * t - 0.03, y0, h[1], x + s * t + 0.03, y1 + 0.1, h[1] + 0.1, 'trim', { noCol: true });
      L.box(x + s * t - 0.03, y1, h[0] - 0.1, x + s * t + 0.03, y1 + 0.12, h[1] + 0.1, 'trim', { noCol: true });
    }
    if (door) return;
    const zm = (h[0] + h[1]) / 2, ym = (y0 + y1) / 2;
    L.box(x - 0.03, y0, zm - 0.03, x + 0.03, y1, zm + 0.03, 'trim', { noCol: true });
    L.box(x - 0.03, ym - 0.03, h[0], x + 0.03, ym + 0.03, h[1], 'trim', { noCol: true });
    if (o) { const xo = x + o * (T / 2 + 0.04); L.box(xo - 0.03, y0, h[0] - 0.62, xo + 0.03, y1, h[0] - 0.14, 'shutter', { noCol: true }); L.box(xo - 0.03, y0, h[1] + 0.14, xo + 0.03, y1, h[1] + 0.62, 'shutter', { noCol: true }); }
  }

  /** Wall along X at z (centre), with rectangular holes [x0, x1, y0, y1]. o: outside direction (±1) for shutters, 0 for none. */
  function wallX(x0, x1, z, y0, y1, holes, m, o) {
    const hs = (holes || []).slice().sort((a, b) => a[0] - b[0]);
    let x = x0;
    for (const h of hs) {
      if (h[0] > x) L.box(x, y0, z - T / 2, h[0], y1, z + T / 2, m);
      if (h[2] > y0) L.box(h[0], y0, z - T / 2, h[1], h[2], z + T / 2, m);
      if (h[3] < y1) L.box(h[0], h[3], z - T / 2, h[1], y1, z + T / 2, m);
      if (h[2] > y0) L.box(h[0] - 0.08, h[2] - 0.06, z - T / 2 - 0.08, h[1] + 0.08, h[2], z + T / 2 + 0.08, 'trim', { noCol: true });
      dressX(h, z, o, h[2] - y0 < 0.3);
      x = h[1];
    }
    if (x < x1) L.box(x, y0, z - T / 2, x1, y1, z + T / 2, m);
  }
  /** Wall along Z at x (centre), holes [z0, z1, y0, y1]. */
  function wallZ(z0, z1, x, y0, y1, holes, m, o) {
    const hs = (holes || []).slice().sort((a, b) => a[0] - b[0]);
    let z = z0;
    for (const h of hs) {
      if (h[0] > z) L.box(x - T / 2, y0, z, x + T / 2, y1, h[0], m);
      if (h[2] > y0) L.box(x - T / 2, y0, h[0], x + T / 2, h[2], h[1], m);
      if (h[3] < y1) L.box(x - T / 2, h[3], h[0], x + T / 2, y1, h[1], m);
      if (h[2] > y0) L.box(x - T / 2 - 0.08, h[2] - 0.06, h[0] - 0.08, x + T / 2 + 0.08, h[2], h[1] + 0.08, 'trim', { noCol: true });
      dressZ(h, x, o, h[2] - y0 < 0.3);
      z = h[1];
    }
    if (z < z1) L.box(x - T / 2, y0, z, x + T / 2, y1, z1, m);
  }
  /** Solid wooden staircase rising toward dir ('x+' | 'x-'). */
  function stairs(x0, z0, x1, z1, yBase, yTop, dir) {
    const n = Math.round((yTop - yBase) / 0.28), rise = (yTop - yBase) / n, d = (x1 - x0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i;
      if (dir === 'x+') L.box(x0 + (i - 1) * d, yBase, z0, x0 + i * d, top, z1, 'wood', { top: 'carpet' });
      else L.box(x1 - i * d, yBase, z0, x1 - (i - 1) * d, top, z1, 'wood', { top: 'carpet' });
    }
  }
  /** Broadleaf tree: tapered trunk, a couple of branches and a cluster of lumpy leaf blobs in two shades. */
  function tree(x, z, h, r, seed) {
    const rnd = U.mulberry32(seed || Math.round(x * 131 + z * 17));
    put('bark', geo('trunk'), x, h / 2, z, 0.3, h, 0.3);
    for (let i = 0; i < 2; i++) { const a = rnd() * 6.28; L.pipe('bark', x, h * 0.7, z, x + Math.cos(a) * r * 0.6, h + r * 0.2, z + Math.sin(a) * r * 0.6, 0.1); }
    const n = 5 + (rnd() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = i ? r * (0.35 + rnd() * 0.45) : 0, s = r * (i ? 0.55 + rnd() * 0.3 : 0.85);
      put(rnd() < 0.35 ? 'leaves2' : 'leaves', blobGeo(i % 3), x + Math.cos(a) * d, h + r * 0.35 + (rnd() - 0.4) * r * 0.6, z + Math.sin(a) * d, s, s * 0.9, s, rnd() * 6);
    }
  }
  function pine(x, z, h) {
    put('bark', geo('trunk'), x, h * 0.15, z, 0.22, h * 0.3, 0.22);
    for (let i = 0; i < 3; i++) put('pine', geo('cone'), x, h * (0.35 + i * 0.22), z, h * (0.3 - i * 0.07), h * 0.38, h * (0.3 - i * 0.07), i);
  }
  function bush(x, z, r, noCol) {
    put('leaves', blobGeo(1), x, r * 0.55, z, r, r * 0.75, r, x);
    put('leaves2', blobGeo(2), x + r * 0.4, r * 0.4, z - r * 0.2, r * 0.6, r * 0.5, r * 0.6);
    if (!noCol) W.add(x - r * 0.8, 0, z - r * 0.8, x + r * 0.8, r * 1.1, z + r * 0.8, { surf: 'concrete' });
  }
  function hedge(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.8));
    for (let i = 0; i <= n; i++) { const k = i / n; put(i % 3 ? 'leaves' : 'leaves2', blobGeo(i % 3), x0 + (x1 - x0) * k, 0.45, z0 + (z1 - z0) * k, 0.55, 0.5, 0.55, i); }
  }
  function wheels(x0, x1, z0, z1, r, alongZ) {
    for (const x of [x0, x1]) for (const z of [z0, z1]) {
      L.cyl('rubber', x, r, z, r, 0.3, alongZ ? 0 : Math.PI / 2, alongZ ? Math.PI / 2 : 0, true);
      const hx = alongZ ? (x > (x0 + x1) / 2 ? 0.16 : -0.16) : 0, hz = alongZ ? 0 : (z > (z0 + z1) / 2 ? 0.16 : -0.16);
      L.cyl('chrome', x + hx, r, z + hz, r * 0.5, 0.02, alongZ ? 0 : Math.PI / 2, alongZ ? Math.PI / 2 : 0, true);
    }
  }
  /** Place a vehicle part authored along +X; rotated a quarter turn when the vehicle runs along Z. */
  function vput(m, g, x, z, alongX) { L.addGeo(m, g, L.mat4(x, 0, z, 0, alongX ? 0 : Math.PI / 2, 0, 1, 1, 1)); }
  /** 1950s sedan: rounded body, glass cabin, chrome bumpers and hubcaps. */
  function car(x, z, alongX, paint) {
    const lx = alongX ? 2.3 : 1.0, lz = alongX ? 1.0 : 2.3;
    vput(paint, extrude('carBody', [[-2.3, 0.42], [2.15, 0.42], [2.35, 0.42, 2.35, 0.62], [2.3, 0.86], [2.2, 1.0, 1.2, 1.0], [-1.6, 1.0], [-2.3, 1.0, -2.35, 0.8], [-2.3, 0.42]], 1.76, 0.07), x, z, alongX);
    vput('glassDay', extrude('carCab', [[1.05, 0.98], [0.45, 1.52], [-0.85, 1.55], [-1.3, 1.5, -1.55, 0.98]], 1.56, 0.04), x, z, alongX);
    vput(paint, extrude('carRoof', [[0.5, 1.5], [-0.9, 1.53], [-1.05, 1.62, -0.9, 1.62], [0.4, 1.6]], 1.62, 0.02), x, z, alongX);
    vput('chrome', extrude('carBumper', [[2.28, 0.4], [2.46, 0.44], [2.46, 0.6], [2.28, 0.6]], 1.8, 0.03), x, z, alongX);
    vput('chrome', extrude('carBumperR', [[-2.3, 0.4], [-2.46, 0.44], [-2.46, 0.6], [-2.3, 0.6]], 1.8, 0.03), x, z, alongX);
    if (alongX) wheels(x - 1.5, x + 1.5, z - 0.95, z + 0.95, 0.38); else wheels(x - 0.95, x + 0.95, z - 1.5, z + 1.5, 0.38, true);
    W.add(x - lx, 0, z - lz, x + lx, 1.0, z + lz, { surf: 'metal' });
    W.add(alongX ? x - 1.5 : x - 0.8, 1.0, alongX ? z - 0.8 : z - 1.5, alongX ? x + 1.0 : x + 0.8, 1.6, alongX ? z + 0.8 : z + 1.0, { surf: 'metal' });
  }
  /** Low white picket fence along X (collides to knee height). */
  function picketX(x0, x1, z) {
    for (let x = x0; x <= x1; x += 0.17) { L.box(x - 0.04, 0, z - 0.02, x + 0.04, 0.85, z + 0.02, 'fence', { noCol: true }); put('fence', geo('cone'), x, 0.9, z, 0.057, 0.1, 0.03, Math.PI / 4); }
    for (const y of [0.25, 0.65]) L.box(x0, y, z - 0.05, x1, y + 0.07, z - 0.02, 'fence', { noCol: true });
    W.add(x0, 0, z - 0.06, x1, 0.9, z + 0.06, { surf: 'concrete' });
  }
  function streetLamp(x, z, face) {
    L.cyl('paintDark', x, 2.6, z, 0.07, 5.2, 0, 0, true);
    L.pipe('paintDark', x, 5.1, z, x, 5.3, z + face * 1.2, 0.05);
    put('chrome', L.geo('sphere'), x, 5.2, z + face * 1.3, 0.22, 0.12, 0.3);
    W.add(x - 0.1, 0, z - 0.1, x + 0.1, 5.2, z + 0.1, { surf: 'metal' });
  }
  function mailbox(x, z, face) {
    L.box(x - 0.05, 0, z - 0.05, x + 0.05, 1.05, z + 0.05, 'wood');
    L.cyl('paintGrey', x, 1.18, z, 0.16, 0.45, Math.PI / 2, 0, true);
    L.box(x + 0.12, 1.2, z - 0.1, x + 0.15, 1.45, z - 0.05, 'paintRed', { noCol: true });
    W.add(x - 0.2, 0, z - 0.25, x + 0.2, 1.35, z + 0.25);
  }
  function hydrant(x, z) {
    L.cyl('paintRed', x, 0.4, z, 0.16, 0.8, 0, 0, true);
    put('paintRed', L.geo('sphere'), x, 0.8, z, 0.17, 0.14, 0.17);
    L.cyl('chrome', x, 0.55, z, 0.07, 0.5, 0, Math.PI / 2, true);
    W.add(x - 0.2, 0, z - 0.2, x + 0.2, 0.9, z + 0.2);
  }
  function trashCan(x, z) {
    L.cyl('paintGrey', x, 0.5, z, 0.32, 1.0, 0, 0, true);
    put('paintGrey', L.geo('sphere'), x, 1.0, z, 0.34, 0.1, 0.34);
    W.add(x - 0.32, 0, z - 0.32, x + 0.32, 1.05, z + 0.32, { surf: 'metal' });
  }
  /** Pickup: rounded nose and cab at +X, open bed at -X. */
  function truck(x, z, alongX, paint) {
    const lx = alongX ? 2.9 : 1.15, lz = alongX ? 1.15 : 2.9;
    vput(paint, extrude('truckBody', [[-2.9, 0.5], [2.75, 0.5], [2.95, 0.5, 2.95, 0.75], [2.9, 1.08], [2.7, 1.22, 1.9, 1.22], [0.6, 1.22], [0.6, 0.98], [-2.9, 0.98], [-2.9, 0.5]], 2.1, 0.07), x, z, alongX);
    vput('glassDay', extrude('truckCab', [[1.35, 1.2], [0.95, 1.95], [-0.15, 1.98], [-0.2, 1.2]], 1.9, 0.04), x, z, alongX);
    vput(paint, extrude('truckCabBack', [[-0.35, 0.98], [0.6, 0.98], [0.6, 1.2], [-0.15, 1.2], [-0.15, 2.0], [-0.35, 2.0]], 2.1, 0.03), x, z, alongX);
    vput(paint, extrude('truckRoof', [[-0.35, 1.95], [0.97, 1.93], [1.02, 2.06], [-0.35, 2.08]], 2.0, 0.03), x, z, alongX);
    vput('chrome', extrude('truckBumper', [[2.88, 0.45], [3.08, 0.5], [3.08, 0.68], [2.88, 0.68]], 2.2, 0.03), x, z, alongX);
    // bed walls (collide) and tailgate
    if (alongX) { L.box(x - 2.9, 0.98, z - 1.12, x - 0.3, 1.5, z - 0.98, paint); L.box(x - 2.9, 0.98, z + 0.98, x - 0.3, 1.5, z + 1.12, paint); L.box(x - 2.95, 0.98, z - 1.12, x - 2.82, 1.45, z + 1.12, paint); W.add(x - 0.3, 1.2, z - 1.05, x + 1.35, 2.1, z + 1.05, { surf: 'metal' }); W.add(x + 0.6, 0.5, z - 1.05, x + 2.95, 1.22, z + 1.05, { surf: 'metal' }); }
    else { L.box(x - 1.12, 0.98, z - 2.9, x - 0.98, 1.5, z - 0.3, paint); L.box(x + 0.98, 0.98, z - 2.9, x + 1.12, 1.5, z - 0.3, paint); L.box(x - 1.12, 0.98, z - 2.95, x + 1.12, 1.45, z - 2.82, paint); W.add(x - 1.05, 1.2, z - 0.3, x + 1.05, 2.1, z + 1.35, { surf: 'metal' }); W.add(x - 1.05, 0.5, z + 0.6, x + 1.05, 1.22, z + 2.95, { surf: 'metal' }); }
    if (alongX) wheels(x - 1.9, x + 1.9, z - 1.05, z + 1.05, 0.45); else wheels(x - 1.05, x + 1.05, z - 1.9, z + 1.9, 0.45, true);
    W.add(x - lx, 0, z - lz, x + lx, 0.98, z + lz, { surf: 'metal' });
  }
  function fenceX(x0, x1, z, h) {
    L.box(x0, 0, z - 0.06, x1, h, z + 0.06, 'fence');
    for (let x = x0; x <= x1 + 0.01; x += 2.4) L.box(x - 0.1, 0, z - 0.1, x + 0.1, h + 0.15, z + 0.1, 'trim', { noCol: true });
  }
  function fenceZ(z0, z1, x, h) {
    L.box(x - 0.06, 0, z0, x + 0.06, h, z1, 'fence');
    for (let z = z0; z <= z1 + 0.01; z += 2.4) L.box(x - 0.1, 0, z - 0.1, x + 0.1, h + 0.15, z + 0.1, 'trim', { noCol: true });
  }

  /** Pitched roof (ridge along X) over a w × d footprint whose top is at y, eaves overhanging by 0.5 m. */
  function gableRoof(cx, cz, w, d, y, h, endMat) {
    put('roofing', roofGeo(w + 1, d + 1, h), cx, y - 0.1, cz, 1, 1, 1);
    put(endMat, gableGeo(w - 0.02, d, h * d / (d + 1)), cx, y - 0.1 + 0.001, cz, 1, 1, 1);
    L.box(cx - w / 2 - 0.5, y - 0.3, cz - d / 2 - 0.5, cx + w / 2 + 0.5, y - 0.1, cz - d / 2 - 0.35, 'trim', { noCol: true }); // fascia boards
    L.box(cx - w / 2 - 0.5, y - 0.3, cz + d / 2 + 0.35, cx + w / 2 + 0.5, y - 0.1, cz + d / 2 + 0.5, 'trim', { noCol: true });
    for (let i = 0; i < 3; i++) { const k = (i + 1) / 4; W.add(cx - w / 2, y, cz - d / 2 * (1 - k), cx + w / 2, y + h * k, cz + d / 2 * (1 - k), { surf: 'concrete' }); }
  }

  /**
   * Two-storey house. front: 1 if the front wall is at z1 (faces +z), -1 if at z0 (faces -z).
   * Ground floor 0–3 m, upper floor 3.25–6 m, stairs along the back wall.
   */
  function house(x0, z0, x1, z1, front, siding) {
    const zf = front > 0 ? z1 : z0, zb = front > 0 ? z0 : z1, H1 = 3, F = 3.25, H2 = 6;
    const bIn = zb + front * T / 2; // inner face of the back wall
    // floor
    L.box(x0, 0, z0, x1, 0.12, z1, 'floorWood');
    // front: door + big window below, two windows above
    wallX(x0, x1, zf, 0, F, [[x0 + 3, x0 + 4.6, 0.12, 2.35], [x0 + 7, x0 + 10.5, 0.95, 2.3]], siding, front);
    wallX(x0, x1, zf, F, H2, [[x0 + 1.8, x0 + 4.8, 4.1, 5.4], [x0 + 8, x0 + 11, 4.1, 5.4]], siding, front);
    // back: door below, window above
    wallX(x0, x1, zb, 0, F, [[x0 + 3, x0 + 4.6, 0.12, 2.35]], siding, -front);
    wallX(x0, x1, zb, F, H2, [[x0 + 2, x0 + 5, 4.1, 5.4]], siding, -front);
    // sides
    const zm = (z0 + z1) / 2;
    wallZ(z0, z1, x0, 0, F, [[zm - 1.4, zm + 1.4, 0.95, 2.3]], siding, -1);
    wallZ(z0, z1, x0, F, H2, [[zm - 1.2, zm + 1.2, 4.1, 5.4]], siding, -1);
    wallZ(z0, z1, x1, 0, F, [[zm - 0.8, zm + 0.8, 0.12, 2.35]], siding, 1);
    wallZ(z0, z1, x1, F, H2, [[zm - 1.4, zm + 1.4, 4.1, 5.4]], siding, 1);
    // brick skirt along the base of the front wall
    L.box(x0 - 0.02, 0, zf - T / 2 - 0.03, x0 + 3, 0.6, zf + T / 2 + 0.03, 'brick', { noCol: true });
    L.box(x0 + 4.6, 0, zf - T / 2 - 0.03, x1 + 0.02, 0.6, zf + T / 2 + 0.03, 'brick', { noCol: true });
    // interior partition with a doorway (ground floor only)
    const xp = x0 + 6.2;
    wallZ(Math.min(z0, z1) + T, Math.max(z0, z1) - T, xp, 0.12, H1, [[zm - 0.8, zm + 0.8, 0.12, 2.35]], 'plaster');
    // stairs along the back wall, climbing west; the stairwell is open above
    const sz0 = Math.min(bIn, bIn + front * 1.3), sz1 = Math.max(bIn, bIn + front * 1.3);
    const sx0 = x1 - 7.2, sx1 = x1 - T / 2;
    stairs(sx0, sz0, sx1, sz1, 0.12, F, 'x-');
    // upper floor slab with the stairwell cut out
    const zlo = Math.min(z0, z1), zhi = Math.max(z0, z1);
    L.box(x0, H1, zlo, x1, F, sz0, 'floorWood', { bottom: true, side: 'trim' });
    L.box(x0, H1, sz1, x1, F, zhi, 'floorWood', { bottom: true, side: 'trim' });
    L.box(x0, H1, sz0, sx0, F, sz1, 'floorWood', { bottom: true, side: 'trim' });
    // railing along the stairwell
    const rz = front > 0 ? sz1 : sz0;
    L.box(sx0 + 0.9, F, rz - 0.04, sx1, F + 1.0, rz + 0.04, 'trim', { shoot: false });
    // ceiling slab, then a real pitched roof with overhanging eaves and siding gable ends
    L.box(x0, H2, zlo, x1, H2 + 0.2, zhi, 'trim', { bottom: true });
    gableRoof((x0 + x1) / 2, (zlo + zhi) / 2, x1 - x0, zhi - zlo, H2 + 0.2, 2.6, siding);
    L.box(x0 + 1.5, H2, zm - 0.35 + 1.2, x0 + 2.3, H2 + 3.6, zm + 0.35 + 1.2, 'brick'); // chimney
    L.box(x0 + 1.42, H2 + 3.6, zm - 0.43 + 1.2, x0 + 2.38, H2 + 3.75, zm + 0.43 + 1.2, 'concrete', { noCol: true });
    // front porch: deck, step and a little roof on posts
    const pz0 = front > 0 ? zf : zf - 2.2, pz1 = front > 0 ? zf + 2.2 : zf;
    L.box(x0 + 2, 0, pz0, x0 + 5.6, 0.3, pz1, 'floorWood');
    L.box(x0 + 1.9, 2.7, pz0 - 0.1, x0 + 5.7, 2.8, pz1 + 0.1, 'trim', { bottom: true });
    put('roofing', roofGeo(3.8, 2.4, 0.6), x0 + 3.8, 2.8, (pz0 + pz1) / 2, 1, 1, 1);
    put('trim', gableGeo(3.8, 2.4, 0.6), x0 + 3.8, 2.8, (pz0 + pz1) / 2, 1, 1, 1);
    const px = front > 0 ? pz1 - 0.12 : pz0 + 0.12;
    for (const x of [x0 + 2.12, x0 + 5.48]) L.box(x - 0.1, 0.3, px - 0.1, x + 0.1, 2.7, px + 0.1, 'trim');
    // furniture as cover
    const fz = (a) => zf - front * a; // distance in from the front wall
    L.box(x0 + 0.4, 0.12, fz(1.2), x0 + 2.6, 0.95, fz(0.4), 'fabric'); // couch under the side window
    L.box(x0 + 0.4, 0.95, fz(0.55), x0 + 2.6, 1.4, fz(0.4), 'fabric', { noCol: true });
    L.box(xp + 1.5, 0.12, zm - 0.7, xp + 3.5, 0.9, zm + 0.7, 'wood'); // dining table
    L.box(x1 - 3.5, 0.12, fz(0.9), x1 - 0.2, 1.05, fz(0.15), 'counter'); // kitchen counter
    L.box(x0 + 1, F, fz(3.4), x0 + 3.2, F + 0.6, fz(1.2), 'fabric'); // bed upstairs
    L.box(x1 - 2.6, F, fz(0.9), x1 - 0.8, F + 1.9, fz(0.2), 'wood'); // wardrobe
  }

  function garage(x0, z0, x1, z1, front, siding, doorEast) {
    const zf = front > 0 ? z1 : z0, zb = front > 0 ? z0 : z1, H = 3.1;
    L.box(x0, 0, z0, x1, 0.1, z1, 'concrete');
    wallX(x0, x1, zb, 0, H, [[x0 + 2, x0 + 4, 1.1, 2.2]], siding, -front);
    const door = [[(z0 + z1) / 2 - 0.7, (z0 + z1) / 2 + 0.7, 0.1, 2.3]];
    wallZ(Math.min(z0, z1), Math.max(z0, z1), x0, 0, H, doorEast ? [] : door, siding);
    wallZ(Math.min(z0, z1), Math.max(z0, z1), x1, 0, H, doorEast ? door : [], siding);
    // open front with the roll-up door raised
    L.box(x0, 2.5, zf - T / 2, x1, H, zf + T / 2, siding);
    L.box(x0 + 0.3, 2.3, zf - front * 0.3 - 0.05, x1 - 0.3, 2.5, zf - front * 0.3 + 0.05, 'trim', { noCol: true });
    L.box(x0, H, Math.min(z0, z1), x1, H + 0.15, Math.max(z0, z1), 'trim', { bottom: true });
    // ridge runs toward the street on the garage
    put('roofing', roofGeo(Math.abs(z1 - z0) + 1, x1 - x0 + 1, 1.4), (x0 + x1) / 2, H + 0.05, (z0 + z1) / 2, 1, 1, 1, Math.PI / 2);
    put(siding, gableGeo(Math.abs(z1 - z0), x1 - x0, 1.4 * (x1 - x0) / (x1 - x0 + 1)), (x0 + x1) / 2, H + 0.06, (z0 + z1) / 2, 1, 1, 1, Math.PI / 2);
    // raised roll-up door
    L.box(x0 + 0.3, 2.2, zf - front * 0.35 - 0.04, x1 - 0.3, 2.5, zf - front * 0.35 + 0.04, 'garageDoor', { noCol: true });
    // workbench and boxes
    L.box(x0 + 0.3, 0.1, zb + front * 0.3, x1 - 0.3, 1.0, zb + front * 1.0, 'wood');
    L.box(x1 - 1.6, 0.1, (z0 + z1) / 2 - 0.6, x1 - 0.4, 1.1, (z0 + z1) / 2 + 0.6, 'cardboard');
    L.box(x1 - 1.4, 1.1, (z0 + z1) / 2 - 0.4, x1 - 0.6, 1.7, (z0 + z1) / 2 + 0.4, 'cardboard');
  }

  MN.build = function () {
    // ground: desert test range outside the fence, lawns inside
    L.box(-320, -1, -320, 320, 0, 320, 'sand', { ao: false });
    L.box(-36, 0, -30, 36, 0.02, 30, 'grass', { ao: false });
    // street and sidewalks
    L.box(-36, 0.02, -5, 36, 0.04, 5, 'asphalt', { noCol: true, ao: false });
    for (let x = -33; x < 34; x += 6) L.box(x, 0.04, -0.1, x + 3, 0.045, 0.1, 'trim', { noCol: true, ao: false });
    L.box(-36, 0, -7, 36, 0.14, -5, 'concrete', { ao: false });
    L.box(-36, 0, 5, 36, 0.14, 7, 'concrete', { ao: false });
    // driveways
    L.box(-3.6, 0.02, -13, 2.4, 0.06, -7, 'concrete', { noCol: true, ao: false });
    L.box(-2.4, 0.02, 7, 3.6, 0.06, 13, 'concrete', { noCol: true, ao: false });
    // walkways to the front doors
    L.box(-15, 0.02, -8.8, -13.4, 0.06, -7, 'concrete', { noCol: true, ao: false });
    L.box(7, 0.02, 7, 8.6, 0.06, 8.8, 'concrete', { noCol: true, ao: false });

    // the two houses and their garages
    house(-18, -21, -4, -11, 1, 'sidingGreen');
    garage(-3.6, -21, 2.4, -13, 1, 'sidingGreen', true);
    house(4, 11, 18, 21, -1, 'sidingYellow');
    garage(-2.4, 13, 3.6, 21, -1, 'sidingYellow', false);

    // school bus in the middle of the street: rounded body, window band, black rub rails, chrome bumpers
    put('busYellow', extrude('bus', [[-6, 0.6], [7.2, 0.6], [7.45, 0.6, 7.45, 0.85], [7.4, 1.75], [7.25, 1.95, 6.5, 1.95], [6.15, 2.0], [6.15, 2.75], [6.05, 3.15, 5.4, 3.15], [-5.3, 3.15], [-6.05, 3.15, -6.1, 2.7], [-6, 0.6]], 2.44, 0.05), 0, 0, 0, 1, 1, 1);
    for (let x = -5.4; x < 5.6; x += 1.15) { L.box(x, 1.75, -1.32, x + 0.95, 2.55, -1.28, 'glassDay', { noCol: true }); L.box(x, 1.75, 1.28, x + 0.95, 2.55, 1.32, 'glassDay', { noCol: true }); }
    L.box(6.12, 1.9, -1.1, 6.2, 2.7, 1.1, 'glassDay', { noCol: true }); // windshield
    for (const y of [1.05, 1.45]) { L.box(-6.08, y, -1.3, 7.3, y + 0.08, -1.27, 'rubber', { noCol: true }); L.box(-6.08, y, 1.27, 7.3, y + 0.08, 1.3, 'rubber', { noCol: true }); }
    L.box(7.35, 0.5, -1.25, 7.6, 0.72, 1.25, 'chrome', { noCol: true }); L.box(-6.3, 0.5, -1.25, -6.05, 0.72, 1.25, 'chrome', { noCol: true });
    L.box(-6.12, 2.7, -0.5, -6.08, 3.0, 0.5, 'paintRed', { noCol: true });
    wheels(-4, 4.5, -1.2, 1.2, 0.55);
    W.add(-6.1, 0, -1.3, 7.45, 1.95, 1.3, { surf: 'metal' }); W.add(-6.1, 1.95, -1.3, 6.15, 3.15, 1.3, { surf: 'metal' });

    // vehicles and street cover
    truck(-24, -2.4, true, 'paintBlue');
    car(22, 2.2, true, 'paintCherry');
    car(-29, 10.5, false, 'paintMint');
    truck(28, -11, false, 'paintMint');
    trashCan(-10, 3.6); trashCan(-9.2, 3.9); trashCan(13, -3.6); trashCan(20, -3.5);
    hydrant(-11, 6.4); hydrant(12, -6.4);
    mailbox(-16.5, -7.6, 1); mailbox(9.0, 7.6, -1);
    for (const x of [-28, -12, 12, 28]) { streetLamp(x, -6.6, 1); streetLamp(x + 6, 6.6, -1); }
    // white picket fences along the front lawns, hedges under the front windows
    picketX(-34, -21, -7.35); picketX(-12.6, -4.2, -7.35);
    picketX(9.4, 19, 7.35); picketX(21, 34, 7.35);
    hedge(-10.6, -10.5, -7.6, -10.5); hedge(-17.6, -10.5, -16.4, -10.5);
    hedge(11.2, 10.5, 14.3, 10.5); hedge(15.3, 10.5, 17.6, 10.5);
    // front-yard planters and low garden walls
    L.box(-20, 0, -9.2, -18.6, 0.8, -7.5, 'brick'); L.box(-7, 0, -9.2, -5.6, 0.8, -7.5, 'brick');
    L.box(5.6, 0, 7.5, 7, 0.8, 9.2, 'brick'); L.box(18.6, 0, 7.5, 20, 0.8, 9.2, 'brick');
    bush(-23, -9, 1.1); bush(24, 9, 1.1); bush(-9, 9.5, 0.9); bush(9, -9.5, 0.9);

    // backyards: fences between the yards and sheds
    fenceX(-36, -20, -24, 1.4); fenceX(4, 20, -24, 1.4);
    fenceX(-20, -4, 24, 1.4); fenceX(20, 36, 24, 1.4);
    L.box(-30, 0, -29.5, -24, 2.4, -26, 'sidingGreen'); gableRoof(-27, -27.75, 6, 3.5, 2.4, 1.1, 'sidingGreen');
    L.box(24, 0, 26, 30, 2.4, 29.5, 'sidingYellow'); gableRoof(27, 27.75, 6, 3.5, 2.4, 1.1, 'sidingYellow');
    L.box(-27.6, 0, -26.02, -26.4, 2.0, -25.96, 'shutter', { noCol: true }); L.box(26.4, 0, 25.96, 27.6, 2.0, 26.02, 'shutter', { noCol: true });
    L.box(-2, 0, -28.5, 2, 0.8, -26, 'wood'); L.box(-2, 0, 26, 2, 0.8, 28.5, 'wood'); // picnic tables
    tree(8, -27, 3.6, 2.2); tree(-10, 27, 3.6, 2.2); tree(-33, 18, 3.2, 2); tree(33, -18, 3.2, 2);
    W.add(7.7, 0, -27.3, 8.3, 3.6, -26.7); W.add(-10.3, 0, 26.7, -9.7, 3.6, 27.3); W.add(-33.3, 0, 17.7, -32.7, 3.2, 18.3); W.add(32.7, 0, -18.3, 33.3, 3.2, -17.7);
    // ends of the street: a trailer on each side for cover
    L.box(31, 0.4, -2.5, 35, 2.8, 1.5, 'trailer'); wheels(32, 34, -2.5, 1.5, 0.4); W.add(31, 0, -2.5, 35, 0.4, 1.5);
    L.box(-35, 0.4, -1.5, -31, 2.8, 2.5, 'trailer'); wheels(-34, -32, -1.5, 2.5, 0.4); W.add(-35, 0, -1.5, -31, 0.4, 2.5);

    // perimeter fence, and an invisible wall just outside it
    fenceX(-36, 36, -30, 2.2); fenceX(-36, 36, 30, 2.2); fenceZ(-30, 30, -36, 2.2); fenceZ(-30, 30, 36, 2.2);
    for (const b of [[-37, -31, 37, -30], [-37, 30, 37, 31], [-37, -31, -36, 31], [36, -31, 37, 31]]) L.box(b[0], 0, b[1], b[2], 30, b[3], 'trim', { noMesh: true });
    // scenery beyond: scrub trees, power poles and distant mesas
    const rnd = U.mulberry32(1955);
    for (let i = 0; i < 34; i++) { const a = rnd() * Math.PI * 2, r = 46 + rnd() * 55, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9; if (rnd() < 0.45) pine(x, z, 5 + rnd() * 5); else tree(x, z, 2.5 + rnd() * 2, 1.6 + rnd() * 1.2, i + 7); }
    for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, r = 40 + rnd() * 70; bush(Math.cos(a) * r, Math.sin(a) * r, 0.5 + rnd() * 0.6, true); }
    for (let x = -120; x <= 120; x += 30) { L.box(x - 0.15, 0, -44.15, x + 0.15, 9, -43.85, 'bark', { noCol: true }); L.box(x - 1.2, 8.2, -44.1, x + 1.2, 8.4, -43.9, 'bark', { noCol: true }); }
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + rnd() * 0.3, r = 190 + rnd() * 60; put('mesa', blobGeo(i % 3), Math.cos(a) * r, -8, Math.sin(a) * r, 40 + rnd() * 40, 18 + rnd() * 26, 30 + rnd() * 30, rnd() * 3); }

    // spawns [x, y, z] and pickups
    L.spawns.ffa = [[-33, 0.02, -22], [-20, 0.02, -27], [12, 0.02, -27], [28, 0.02, -20], [33, 0.02, 27], [20, 0.02, 27], [-14, 0.02, 27], [-28, 0.02, 20], [-32, 0.14, 6], [32, 0.14, -6]];
    L.spawns.t0 = [[-33, 0.02, -22], [-20, 0.02, -27], [0, 0.02, -24], [-26, 0.02, -18], [12, 0.02, -27]];
    L.spawns.t1 = [[33, 0.02, 27], [20, 0.02, 27], [0, 0.02, 24], [26, 0.02, 18], [-12, 0.02, 27]];
    L.addPickup('armor', -8, 3.25, -18); L.addPickup('armor', 8, 3.25, 18);
    L.addPickup('ammo', -0.6, 0.1, -17); L.addPickup('ammo', 0.6, 0.1, 17); L.addPickup('ammo', 0, 0.14, 6);
    L.points.start = { x: 0, y: 0.02, z: -24, yaw: Math.PI };
    L.killY = -10;
  };
})(window.CF);
