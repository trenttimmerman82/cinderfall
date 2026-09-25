'use strict';
/* Cinderfall — NUKETOWN (multiplayer). A 1950s test-site cul-de-sac in the Nevada desert:
   the yellow house (north) and the green house (south) face each other across a turnaround with a
   school bus and a moving truck in it. The street runs east to a sandbagged roadblock; the red house,
   the "Welcome to Nuketown" sign and the clock tower close the west end. Axes: +X east, +Z south. */
(function (CF) {
  const L = CF.Level, U = CF.U, W = CF.World;
  const MN = CF.MapNuketown = {};
  const T = 0.25;          // wall thickness
  const F1 = 3.0, F = 3.25, H2 = 6.0, RF = 6.2; // ceiling, upper floor, upper ceiling, roof base

  // ------------------------------------------------------------ geometry kit (cached, baked into material batches)
  const GEO = {};
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
  /** Push a triangle wound so its face normal points along `out`. */
  function tri(pos, a, b, c, out) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _n.crossVectors(_a, _b);
    if (out && _n.x * out[0] + _n.y * out[1] + _n.z * out[2] < 0) { const t = b; b = c; c = t; }
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  function finish(pos, uvFn) {
    const g = new THREE.BufferGeometry(), uv = [];
    for (let i = 0; i < pos.length; i += 3) { const r = uvFn(pos[i], pos[i + 1], pos[i + 2], (i / 9) | 0); uv.push(r[0], r[1]); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }
  /** Gable roof slopes: base w × d at y = 0, ridge along X at height h. */
  function gableRoofGeo(w, d, h) {
    const k = 'gr' + [w, d, h]; if (GEO[k]) return GEO[k];
    const x = w / 2, z = d / 2, pos = [];
    const A = [-x, 0, -z], B = [x, 0, -z], C = [x, h, 0], D = [-x, h, 0], A2 = [-x, 0, z], B2 = [x, 0, z];
    tri(pos, A, B, C, [0, 1, -1]); tri(pos, A, C, D, [0, 1, -1]); tri(pos, A2, B2, C, [0, 1, 1]); tri(pos, A2, C, D, [0, 1, 1]);
    const slope = Math.hypot(z, h);
    return (GEO[k] = finish(pos, (px, py) => [px * 0.3, (py / h) * slope * 0.3]));
  }
  /** Hip roof: base w × d (w ≥ d) at y = 0, short ridge along X at height h. */
  function hipRoofGeo(w, d, h) {
    const k = 'hr' + [w, d, h]; if (GEO[k]) return GEO[k];
    const x = w / 2, z = d / 2, r = (w - d) / 2, pos = [];
    const A = [-x, 0, -z], B = [x, 0, -z], C = [x, 0, z], D = [-x, 0, z], R1 = [-r, h, 0], R2 = [r, h, 0];
    tri(pos, A, B, R2, [0, 1, -1]); tri(pos, A, R2, R1, [0, 1, -1]);
    tri(pos, D, C, R2, [0, 1, 1]); tri(pos, D, R2, R1, [0, 1, 1]);
    tri(pos, B, C, R2, [1, 1, 0]); tri(pos, A, D, R1, [-1, 1, 0]);
    const slope = Math.hypot(z, h);
    return (GEO[k] = finish(pos, (px, py, pz, t) => [(t < 4 ? px : pz) * 0.3, (py / h) * slope * 0.3]));
  }
  /** Gable end wall (pentagon) at x = ±w/2 filling from yb up under a gableRoofGeo placed at yEave with overhang o. */
  function gableEndGeo(w, d, h, o, yb) {
    const k = 'ge' + [w, d, h, o, yb]; if (GEO[k]) return GEO[k];
    const z = d / 2, run = z + o, yr = h * (o / run), pos = [];
    for (const s of [-1, 1]) {
      const x = s * w / 2, P = (zz, yy) => [x, yy, zz], out = [s, 0, 0];
      const A = P(-z, yb), B = P(z, yb), C = P(z, yr), D = P(0, h - 0.02), E = P(-z, yr);
      tri(pos, A, B, C, out); tri(pos, A, C, D, out); tri(pos, A, D, E, out);
    }
    return (GEO[k] = finish(pos, (px, py, pz) => [pz * 0.25, py * 0.25]));
  }
  /** Flat disc / ring on the ground (XZ plane, facing up) with world-scaled UVs. */
  function discGeo(r0, r1, rep, a0, a1) {
    const k = 'disc' + [r0, r1, rep, a0, a1]; if (GEO[k]) return GEO[k];
    const g = new THREE.RingGeometry(r0, r1, 64, 1, a0 || 0, a1 || Math.PI * 2);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, UV = g.attributes.uv;
    for (let i = 0; i < P.count; i++) UV.setXY(i, P.getX(i) * rep, -P.getZ(i) * rep);
    return (GEO[k] = g);
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
  /** Lumpy blob: an icosphere pushed in and out by a smooth function of position (no cracks). */
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
    if (kind === 'sphere') GEO.sphere = new THREE.SphereGeometry(1, 14, 10);
    return GEO[kind];
  }
  const put = (m, g, x, y, z, sx, sy, sz, ry, rx, rz) => L.addGeo(m, g, L.mat4(x, y, z, rx || 0, ry || 0, rz || 0, sx, sy, sz));
  const sph = (m, x, y, z, rx, ry, rz) => put(m, geo('sphere'), x, y, z, rx, ry || rx, rz || rx);
  const deco = (x0, y0, z0, x1, y1, z1, m) => L.box(x0, y0, z0, x1, y1, z1, m, { noCol: true, ao: false });
  const solid = (x0, y0, z0, x1, y1, z1, surf) => W.add(x0, y0, z0, x1, y1, z1, { surf: surf || 'concrete' });

  // ------------------------------------------------------------ canvas art (signs, clock, paintings)
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  function plane(tex, w, h, x, y, z, ry, o) {
    o = o || {};
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough != null ? o.rough : 0.75, metalness: 0, transparent: !!o.alpha, alphaTest: o.alpha ? 0.4 : 0, side: o.double ? THREE.DoubleSide : THREE.FrontSide });
    const m = new THREE.Mesh(o.circle ? new THREE.CircleGeometry(w / 2, 48) : new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry || 0; m.receiveShadow = true;
    L.scene.add(m); return m;
  }
  const ART = {};
  function art() {
    if (ART.done) return ART;
    ART.done = true;
    ART.welcome = canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#c8433a'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#f3e7d2'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
      x.fillStyle = '#f7ecd8'; x.textAlign = 'center';
      x.font = 'italic 42px Georgia, serif'; x.fillText('Welcome to', w / 2, 70);
      x.font = 'bold 86px Georgia, serif'; x.fillText('NUKETOWN', w / 2, 155);
      x.font = 'italic 30px Georgia, serif'; x.fillText('Population', w / 2 - 50, 208);
      x.fillStyle = '#222'; x.fillRect(w / 2 + 40, 182, 90, 36); x.fillStyle = '#eee'; x.font = 'bold 28px monospace'; x.fillText('0 0', w / 2 + 85, 210);
    });
    ART.bus = canvasTex(256, 48, (x, w, h) => { x.fillStyle = '#151515'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2c230'; x.font = 'bold 32px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('SCHOOL BUS', w / 2, 35); });
    ART.moving = canvasTex(1024, 256, (x, w, h) => {
      x.fillStyle = '#efe8da'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#a93a2e'; x.beginPath(); x.moveTo(0, h * 0.55); x.bezierCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 0.4, w, h * 0.42); x.lineTo(w, h); x.lineTo(0, h); x.fill();
      x.fillStyle = '#b23a2e'; x.textAlign = 'center'; x.font = 'bold italic 64px Georgia, serif'; x.fillText('WESTWARD', w * 0.42, 70);
      x.fillStyle = '#6a2a24'; x.font = 'bold 38px Georgia, serif'; x.fillText('MOVING & DELIVERY', w * 0.42, 118);
      x.fillStyle = '#f3ead8'; x.font = 'bold 22px Arial, sans-serif'; x.fillText('NORTHERN - NEVADA', w * 0.8, h - 26);
    });
    ART.roadblock = canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#e9e4d6'; x.fillRect(0, 0, w, h); x.fillStyle = '#2f6a3c'; for (let i = 0; i < w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 24, 0); x.lineTo(i + 8, h); x.lineTo(i - 16, h); x.fill(); } x.fillStyle = '#c23a2a'; x.font = 'bold 20px Arial'; x.textAlign = 'center'; x.fillText('ROAD BLOCK', w / 2, 23); });
    ART.clock = canvasTex(512, 512, (x, w) => {
      const c = w / 2;
      x.fillStyle = '#e8e4d8'; x.beginPath(); x.arc(c, c, c - 4, 0, 6.3); x.fill();
      x.strokeStyle = '#333'; x.lineWidth = 14; x.stroke();
      x.fillStyle = '#222'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; x.fillText(String(i), c + Math.cos(a) * (c - 64), c + Math.sin(a) * (c - 64)); }
      x.strokeStyle = '#1a1a1a'; x.lineCap = 'round';
      x.lineWidth = 16; x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos(-2.2) * 120, c + Math.sin(-2.2) * 120); x.stroke();
      x.lineWidth = 10; x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos(-1.35) * 180, c + Math.sin(-1.35) * 180); x.stroke();
      x.fillStyle = '#c23a2a'; x.beginPath(); x.arc(c, c, 16, 0, 6.3); x.fill();
    });
    ART.flag = canvasTex(160, 100, (x, w, h) => {
      for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#f2efe8' : '#b8322e'; x.fillRect(0, i * h / 13, w, h / 13 + 1); }
      x.fillStyle = '#2e3f73'; x.fillRect(0, 0, w * 0.42, h * 7 / 13);
      x.fillStyle = '#f2efe8'; for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) { x.beginPath(); x.arc(6 + q * 10.5 + (r % 2) * 5, 6 + r * 10, 2, 0, 6.3); x.fill(); }
    });
    ART.painting = canvasTex(256, 192, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fb7c9'); g.addColorStop(0.6, '#e8d8b0'); g.addColorStop(1, '#7a6a48');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#6e7a5a'; x.beginPath(); x.moveTo(0, h * 0.62); for (let i = 0; i <= 8; i++) x.lineTo(i * w / 8, h * (0.45 + 0.12 * Math.sin(i * 1.7))); x.lineTo(w, h); x.lineTo(0, h); x.fill();
      x.fillStyle = '#3f5238'; x.fillRect(w * 0.18, h * 0.5, 10, 50); x.beginPath(); x.arc(w * 0.18 + 5, h * 0.47, 26, 0, 6.3); x.fill();
      x.strokeStyle = '#4a3420'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    });
    return ART;
  }

  // ------------------------------------------------------------ walls
  /** One layer of a wall with openings. axis 'x': runs along X at depth c; 'z': runs along Z at x = c. holes [a0, a1, y0, y1]. */
  function skin(axis, a0, a1, c, t, y0, y1, holes, m) {
    const B = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      const o = { ao: q0 < 0.05 ? undefined : false };
      if (axis === 'x') L.box(p0, q0, c - t / 2, p1, q1, c + t / 2, m, o); else L.box(c - t / 2, q0, p0, c + t / 2, q1, p1, m, o);
    };
    const hs = holes.filter((h) => h[3] > y0 && h[2] < y1 && h[1] > a0 && h[0] < a1).sort((p, q) => p[0] - q[0]);
    let a = a0;
    for (const h of hs) {
      const h0 = Math.max(a0, h[0]), h1 = Math.min(a1, h[1]);
      B(a, h0, y0, y1); B(h0, h1, y0, Math.max(y0, h[2])); B(h0, h1, Math.min(y1, h[3]), y1); a = h1;
    }
    B(a, a1, y0, y1);
  }
  /**
   * House wall: coloured exterior bands outside, interior bands (wallpaper, wainscot) inside.
   * out: +1/-1 = side of c that faces outdoors; 0 = interior partition (inBands on both faces).
   */
  function wall(axis, a0, a1, c, y0, y1, holes, outBands, inBands, out, dress) {
    const bandSkin = (bands, cc, t, ext) => { for (const b of bands) { const by0 = Math.max(y0, b[0]), by1 = Math.min(y1, b[1]); if (by1 > by0) skin(axis, a0 - ext, a1 + ext, cc, t, by0, by1, holes, b[2]); } };
    if (!out) { bandSkin(inBands, c, T, 0); return; }
    bandSkin(outBands, c + out * T / 4, T / 2, axis === 'x' ? T / 2 : 0);
    bandSkin(inBands, c - out * T / 4, T / 2, 0);
    for (const h of holes) if (h[3] > y0 && h[2] < y1) dressHole(axis, h, c, out, h[2] - y0 < 0.3, dress || {});
  }
  /** Trim around an opening on both faces, plus shutters beside windows and a swung-open door leaf inside. */
  function dressHole(axis, h, c, out, door, dress) {
    const f = T / 2 + 0.03, box = (a0, a1, y0, y1, cc, t, m) => axis === 'x' ? deco(a0, y0, cc - t, a1, y1, cc + t, m) : deco(cc - t, y0, a0, cc + t, y1, a1, m);
    for (const s of [-1, 1]) {
      const cc = c + s * f;
      box(h[0] - 0.1, h[0], h[2], h[3] + 0.1, cc, 0.03, 'trim'); box(h[1], h[1] + 0.1, h[2], h[3] + 0.1, cc, 0.03, 'trim');
      box(h[0] - 0.1, h[1] + 0.1, h[3], h[3] + 0.12, cc, 0.03, 'trim');
      if (!door) box(h[0] - 0.12, h[1] + 0.12, h[2] - 0.08, h[2], cc, 0.06, 'trim');
    }
    if (door) { // open door leaf, hinged on the h[0] side, swung inward
      if (dress.noLeaf) return;
      const inn = c - out * (T / 2 + 0.47);
      if (axis === 'x') L.box(h[0] + 0.02, h[2], inn - 0.45, h[0] + 0.07, h[3] - 0.04, inn + 0.45, 'cabinet', { ao: false });
      else L.box(inn - 0.45, h[2], h[0] + 0.02, inn + 0.45, h[3] - 0.04, h[0] + 0.07, 'cabinet', { ao: false });
      return;
    }
    if (dress.shutter) { const cc = c + out * (T / 2 + 0.05); box(h[0] - 0.6, h[0] - 0.14, h[2], h[3], cc, 0.03, dress.shutter); box(h[1] + 0.14, h[1] + 0.6, h[2], h[3], cc, 0.03, dress.shutter); }
  }
  /** Solid wooden staircase rising toward +X or -X, carpet on the treads. */
  function stairs(x0, z0, x1, z1, yBase, yTop, dir) {
    const n = Math.round((yTop - yBase) / 0.27), rise = (yTop - yBase) / n, d = (x1 - x0) / (n - 1);
    for (let i = 1; i < n; i++) {
      const top = yBase + rise * i;
      if (dir === 'x+') L.box(x0 + (i - 1) * d, yBase, z0, x0 + i * d, top, z1, 'woodDark', { top: 'carpet' });
      else L.box(x1 - i * d, yBase, z0, x1 - (i - 1) * d, top, z1, 'woodDark', { top: 'carpet' });
    }
  }
  function railingX(x0, x1, z, y) { deco(x0, y + 0.95, z - 0.05, x1, y + 1.02, z + 0.05, 'woodDark'); for (let x = x0; x <= x1 + 0.01; x += 0.35) deco(x - 0.025, y, z - 0.025, x + 0.025, y + 0.95, z + 0.025, 'trim'); W.add(x0, y, z - 0.06, x1, y + 1.02, z + 0.06, { shoot: false }); }
  function railingZ(z0, z1, x, y) { deco(x - 0.05, y + 0.95, z0, x + 0.05, y + 1.02, z1, 'woodDark'); for (let z = z0; z <= z1 + 0.01; z += 0.35) deco(x - 0.025, y, z - 0.025, x + 0.025, y + 0.95, z + 0.025, 'trim'); W.add(x - 0.06, y, z0, x + 0.06, y + 1.02, z1, { shoot: false }); }

  // ------------------------------------------------------------ roofs
  /** Pitched roofs are scenery: an invisible, bullet-transparent cap keeps players off the slopes (and off the map edge behind them). */
  function roofCap(x0, z0, x1, z1, y) { W.add(x0, y, z0, x1, y + 8, z1, { shoot: false, nav: false }); }
  function gableRoof(cx, cz, w, d, y, h, endMat, roofMat, alongZ) {
    const o = 0.55, ry = alongZ ? Math.PI / 2 : 0, ww = alongZ ? d : w, dd = alongZ ? w : d;
    put(roofMat || 'roofGray', gableRoofGeo(ww + 2 * o, dd + 2 * o, h), cx, y - 0.1, cz, 1, 1, 1, ry);
    put(endMat, gableEndGeo(ww - 0.02, dd, h, o, -0.25), cx, y - 0.1, cz, 1, 1, 1, ry);
    for (let i = 0; i < 3; i++) { const k = (i + 1) / 4, e = (dd / 2) * (1 - k); if (alongZ) solid(cx - e, y, cz - ww / 2, cx + e, y + h * k, cz + ww / 2); else solid(cx - ww / 2, y, cz - e, cx + ww / 2, y + h * k, cz + e); }
    roofCap(cx - (alongZ ? dd : ww) / 2 - o, cz - (alongZ ? ww : dd) / 2 - o, cx + (alongZ ? dd : ww) / 2 + o, cz + (alongZ ? ww : dd) / 2 + o, y);
  }
  function hipRoof(cx, cz, w, d, y, h, roofMat) {
    const o = 0.7;
    put(roofMat || 'roofGray', hipRoofGeo(w + 2 * o, d + 2 * o, h), cx, y - 0.12, cz, 1, 1, 1);
    deco(cx - w / 2 - o, y - 0.34, cz - d / 2 - o, cx + w / 2 + o, y - 0.12, cz + d / 2 + o, 'trim');
    for (let i = 0; i < 3; i++) { const k = (i + 1) / 4, e = (d / 2) * (1 - k); solid(cx - w / 2 + (d / 2 - e), y, cz - e, cx + w / 2 - (d / 2 - e), y + h * k, cz + e); }
    roofCap(cx - w / 2 - o, cz - d / 2 - o, cx + w / 2 + o, cz + d / 2 + o, y);
  }

  // ------------------------------------------------------------ props
  function tree(x, z, h, r, seed) {
    const rnd = U.mulberry32(seed || Math.round(x * 131 + z * 17));
    put('bark', geo('trunk'), x, h / 2, z, 0.28, h, 0.28);
    for (let i = 0; i < 2; i++) { const a = rnd() * 6.28; L.pipe('bark', x, h * 0.7, z, x + Math.cos(a) * r * 0.6, h + r * 0.2, z + Math.sin(a) * r * 0.6, 0.09); }
    solid(x - 0.3, 0, z - 0.3, x + 0.3, h, z + 0.3);
    W.add(x - r * 1.1, h - r * 0.2, z - r * 1.1, x + r * 1.1, h + r * 1.6 + 4, z + r * 1.1, { shoot: false, nav: false });
    const n = 5 + (rnd() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = i ? r * (0.35 + rnd() * 0.45) : 0, s = r * (i ? 0.55 + rnd() * 0.3 : 0.85);
      put(rnd() < 0.35 ? 'leaves2' : 'leaves', blobGeo(i % 3), x + Math.cos(a) * d, h + r * 0.35 + (rnd() - 0.4) * r * 0.6, z + Math.sin(a) * d, s, s * 0.9, s, rnd() * 6);
    }
  }
  function cypress(x, z, h) {
    put('bark', geo('trunk'), x, 0.4, z, 0.15, 0.8, 0.15); for (let i = 0; i < 4; i++) put('pine', blobGeo(i % 3), x, 0.9 + h * (0.12 + i * 0.2), z, 0.75 - i * 0.12, h * 0.2, 0.75 - i * 0.12, i);
    solid(x - 0.75, 0, z - 0.75, x + 0.75, h, z + 0.75);
    W.add(x - 0.75, h, z - 0.75, x + 0.75, h + 6, z + 0.75, { shoot: false, nav: false }); // nobody stands on a treetop
  }
  function pine(x, z, h) { put('bark', geo('trunk'), x, h * 0.15, z, 0.22, h * 0.3, 0.22); for (let i = 0; i < 3; i++) put('pine', geo('cone'), x, h * (0.35 + i * 0.22), z, h * (0.3 - i * 0.07), h * 0.38, h * (0.3 - i * 0.07), i); }
  function bush(x, z, r, y, noCol) {
    y = y || 0;
    put('leaves', blobGeo(1), x, y + r * 0.55, z, r, r * 0.75, r, x);
    put('leaves2', blobGeo(2), x + r * 0.4, y + r * 0.4, z - r * 0.2, r * 0.6, r * 0.5, r * 0.6);
    if (!noCol) solid(x - r * 1.05, y, z - r * 1.05, x + r * 1.15, y + r * 1.1, z + r * 1.05);
  }
  function hedge(x0, z0, x1, z1, hgt) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.7)), hh = hgt || 1;
    for (let i = 0; i <= n; i++) { const k = i / n; put(i % 3 ? 'leaves' : 'leaves2', blobGeo(i % 3), x0 + (x1 - x0) * k, hh * 0.5, z0 + (z1 - z0) * k, 0.55, hh * 0.55, 0.55, i); }
    solid(Math.min(x0, x1) - 0.62, 0, Math.min(z0, z1) - 0.62, Math.max(x0, x1) + 0.62, hh, Math.max(z0, z1) + 0.62);
  }
  function yucca(x, z, s) {
    solid(x - 0.45 * s, 0, z - 0.45 * s, x + 0.45 * s, 0.95 * s, z + 0.45 * s);
    for (let i = 0; i < 14; i++) { const a = i * 2.4, t = 0.5 + (i % 3) * 0.25; put('joshua', geo('cone'), x + Math.cos(a) * 0.15 * s, 0.45 * s, z + Math.sin(a) * 0.15 * s, 0.06 * s, 1.1 * s, 0.06 * s, 0, Math.cos(a) * t, -Math.sin(a) * t); }
  }
  function joshua(x, z, rnd) {
    const h = 2.2 + rnd() * 1.5;
    L.pipe('bark', x, 0, z, x, h, z, 0.18);
    const tips = [[x, h + 0.3, z]];
    for (let i = 0; i < 3; i++) { const a = rnd() * 6.28, l = 0.8 + rnd() * 0.9, t = [x + Math.cos(a) * l, h + 0.4 + rnd() * 0.8, z + Math.sin(a) * l]; L.pipe('bark', x, h - 0.2, z, t[0], t[1], t[2], 0.12); tips.push(t); }
    for (const t of tips) for (let k = 0; k < 6; k++) { const a = k * 1.05; put('joshua', geo('cone'), t[0], t[1] + 0.15, t[2], 0.08, 0.6, 0.08, 0, Math.cos(a) * 0.9, Math.sin(a) * 0.9); }
  }
  function wheels(x0, x1, z0, z1, r, alongZ, hub) {
    for (const x of [x0, x1]) for (const z of [z0, z1]) {
      L.cyl('rubber', x, r, z, r, 0.3, alongZ ? 0 : Math.PI / 2, alongZ ? Math.PI / 2 : 0, true);
      const hx = alongZ ? (x > (x0 + x1) / 2 ? 0.16 : -0.16) : 0, hz = alongZ ? 0 : (z > (z0 + z1) / 2 ? 0.16 : -0.16);
      L.cyl(hub || 'chrome', x + hx, r, z + hz, r * 0.5, 0.02, alongZ ? 0 : Math.PI / 2, alongZ ? Math.PI / 2 : 0, true);
    }
  }
  /** Place a vehicle part authored along +X; a quarter turn when the vehicle runs along Z (face = sign of travel). */
  function vput(m, g, x, z, alongX, flip) { L.addGeo(m, g, L.mat4(x, 0, z, 0, (alongX ? 0 : -Math.PI / 2) + (flip ? Math.PI : 0), 0, 1, 1, 1)); }
  /** 1950s sedan: rounded body, glass cabin, chrome bumpers and hubcaps. */
  function car(x, z, alongX, paint, flip) {
    const lx = alongX ? 2.3 : 1.0, lz = alongX ? 1.0 : 2.3;
    vput(paint, extrude('carBody', [[-2.3, 0.42], [2.15, 0.42], [2.35, 0.42, 2.35, 0.62], [2.3, 0.86], [2.2, 1.0, 1.2, 1.0], [-1.6, 1.0], [-2.3, 1.0, -2.35, 0.8], [-2.3, 0.42]], 1.76, 0.07), x, z, alongX, flip);
    vput('glassDay', extrude('carCab', [[1.05, 0.98], [0.45, 1.52], [-0.85, 1.55], [-1.3, 1.5, -1.55, 0.98]], 1.56, 0.04), x, z, alongX, flip);
    vput(paint, extrude('carRoof', [[0.5, 1.5], [-0.9, 1.53], [-1.05, 1.62, -0.9, 1.62], [0.4, 1.6]], 1.62, 0.02), x, z, alongX, flip);
    vput('chrome', extrude('carBumper', [[2.28, 0.4], [2.46, 0.44], [2.46, 0.6], [2.28, 0.6]], 1.8, 0.03), x, z, alongX, flip);
    vput('chrome', extrude('carBumperR', [[-2.3, 0.4], [-2.46, 0.44], [-2.46, 0.6], [-2.3, 0.6]], 1.8, 0.03), x, z, alongX, flip);
    if (alongX) wheels(x - 1.5, x + 1.5, z - 0.95, z + 0.95, 0.38); else wheels(x - 0.95, x + 0.95, z - 1.5, z + 1.5, 0.38, true);
    solid(x - lx - (alongX ? 0.16 : 0.12), 0, z - lz - (alongX ? 0.12 : 0.16), x + lx + (alongX ? 0.16 : 0.12), 1.0, z + lz + (alongX ? 0.12 : 0.16), 'metal');
    const c0 = flip ? -1.0 : -1.5, c1 = flip ? 1.5 : 1.0;
    solid(alongX ? x + c0 : x - 0.8, 1.0, alongX ? z - 0.8 : z + c0, alongX ? x + c1 : x + 0.8, 1.6, alongX ? z + 0.8 : z + c1, 'metal');
  }
  function mannequin(x, y, z, pose) {
    const m = 'mannequin';
    sph(m, x, y + 1.63, z, 0.11, 0.13, 0.11); L.cyl(m, x, y + 1.48, z, 0.05, 0.1);
    put(m, geo('trunk'), x, y + 1.18, z, 0.2, 0.52, 0.13); sph(m, x, y + 0.9, z, 0.19, 0.12, 0.13);
    for (const s of [-1, 1]) {
      L.pipe(m, x + s * 0.09, y + 0.88, z, x + s * 0.11, y + 0.05, z + (pose ? s * 0.12 : 0), 0.065);
      L.pipe(m, x + s * 0.22, y + 1.4, z, x + s * (pose ? 0.4 : 0.27), y + (pose ? 1.05 : 0.82), z - (pose ? 0.25 : 0), 0.045);
    }
    const w = pose ? 0.45 : 0.28;
    solid(x - w, y, z - w, x + w, y + 1.75, z + w);
    W.add(x - w, y + 1.75, z - w, x + w, y + 3, z + w, { shoot: false, nav: false }); // not a step stool
  }
  function sandbags(x0, z0, x1, z1, rows) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.55)), ang = Math.atan2(x1 - x0, z1 - z0);
    for (let r = 0; r < rows; r++) for (let i = 0; i <= n; i++) {
      const k = (i + (r % 2) * 0.5) / (n + 0.5);
      put('sandbag', blobGeo((i + r) % 3), x0 + (x1 - x0) * k, 0.14 + r * 0.24, z0 + (z1 - z0) * k, 0.3, 0.13, 0.2, ang + Math.PI / 2);
    }
    solid(Math.min(x0, x1) - 0.3, 0, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, rows * 0.25 + 0.05, Math.max(z0, z1) + 0.3);
  }
  function roadBlock(x, z0, z1) {
    for (const z of [z0 + 0.2, z1 - 0.2]) { L.pipe('woodDark', x - 0.45, 0, z, x, 1.05, z, 0.04); L.pipe('woodDark', x + 0.45, 0, z, x, 1.05, z, 0.04); }
    for (const y of [0.95, 0.6]) { deco(x - 0.04, y, z0, x + 0.04, y + 0.22, z1, 'roadBlock'); plane(art().roadblock, z1 - z0, 0.22, x + 0.045, y + 0.11, (z0 + z1) / 2, Math.PI / 2); plane(art().roadblock, z1 - z0, 0.22, x - 0.045, y + 0.11, (z0 + z1) / 2, -Math.PI / 2); }
    solid(x - 0.5, 0, z0, x + 0.5, 1.2, z1);
  }
  function powerPole(x, z, h) {
    put('bark', geo('trunk'), x, h / 2, z, 0.14, h, 0.14);
    deco(x - 1.2, h - 0.8, z - 0.06, x + 1.2, h - 0.65, z + 0.06, 'bark');
    for (const dx of [-1, 0, 1]) L.cyl('appliance', x + dx * 1.05, h - 0.58, z, 0.05, 0.14, 0, 0, true);
    solid(x - 0.16, 0, z - 0.16, x + 0.16, h, z + 0.16, 'metal');
    return [x, h - 0.55, z];
  }
  /** Sagging wire between two points (a chain of thin pipes). */
  function wire(a, b, sag) {
    const n = 8; let px = a[0], py = a[1], pz = a[2];
    for (let i = 1; i <= n; i++) { const k = i / n, x = a[0] + (b[0] - a[0]) * k, z = a[2] + (b[2] - a[2]) * k, y = a[1] + (b[1] - a[1]) * k - Math.sin(k * Math.PI) * (sag || 0.6); L.pipe('rubber', px, py, pz, x, y, z, 0.022); px = x; py = y; pz = z; }
  }
  function streetLamp(x, z) { L.cyl('paintDark', x, 1.9, z, 0.07, 3.8, 0, 0, true); deco(x - 0.2, 3.8, z - 0.2, x + 0.2, 4.3, z + 0.2, 'glassDay'); put('paintDark', geo('cone'), x, 4.45, z, 0.32, 0.3, 0.32); sph('lampWarm', x, 4.0, z, 0.1); solid(x - 0.1, 0, z - 0.1, x + 0.1, 4.3, z + 0.1, 'metal'); }
  function hydrant(x, z) { L.cyl('paintRed', x, 0.4, z, 0.16, 0.8, 0, 0, true); sph('paintRed', x, 0.8, z, 0.17, 0.14, 0.17); L.cyl('chrome', x, 0.55, z, 0.07, 0.5, 0, Math.PI / 2, true); solid(x - 0.2, 0, z - 0.2, x + 0.2, 0.9, z + 0.2); }
  function trashCan(x, z) { L.cyl('paintGrey', x, 0.5, z, 0.32, 1.0, 0, 0, true); sph('paintGrey', x, 1.0, z, 0.34, 0.1, 0.34); solid(x - 0.32, 0, z - 0.32, x + 0.32, 1.05, z + 0.32, 'metal'); }
  function mailbox(x, z) { deco(x - 0.05, 0, z - 0.05, x + 0.05, 1.05, z + 0.05, 'wood'); L.cyl('paintGrey', x, 1.18, z, 0.16, 0.45, Math.PI / 2, 0, true); deco(x + 0.12, 1.2, z - 0.1, x + 0.15, 1.45, z - 0.05, 'paintRed'); solid(x - 0.2, 0, z - 0.25, x + 0.2, 1.35, z + 0.25); }
  function tires(x, z, n) { for (let i = 0; i < n; i++) L.cyl('rubber', x, 0.12 + i * 0.23, z, 0.38, 0.22, 0, 0, true); solid(x - 0.38, 0, z - 0.38, x + 0.38, n * 0.23, z + 0.38); }
  function woodpile(x0, z0, x1, z1, h) { for (let y = 0.1; y < h; y += 0.2) for (let x = x0 + 0.1; x < x1; x += 0.2) L.cyl('bark', x + (y * 7 % 0.1), y, (z0 + z1) / 2, 0.1, z1 - z0, Math.PI / 2, 0, true); solid(x0, 0, z0, x1, h, z1); }
  function picketX(x0, x1, z) {
    for (let x = x0; x <= x1; x += 0.17) { deco(x - 0.04, 0, z - 0.02, x + 0.04, 0.85, z + 0.02, 'fence'); put('fence', geo('cone'), x, 0.9, z, 0.057, 0.1, 0.03, Math.PI / 4); }
    for (const y of [0.25, 0.65]) deco(x0, y, z - 0.05, x1, y + 0.07, z - 0.02, 'fence');
    solid(x0, 0, z - 0.06, x1, 0.9, z + 0.06);
  }
  function picketZ(z0, z1, x) {
    for (let z = z0; z <= z1; z += 0.17) { deco(x - 0.02, 0, z - 0.04, x + 0.02, 0.85, z + 0.04, 'fence'); put('fence', geo('cone'), x, 0.9, z, 0.03, 0.1, 0.057, Math.PI / 4); }
    for (const y of [0.25, 0.65]) deco(x - 0.05, y, z0, x - 0.02, y + 0.07, z1, 'fence');
    solid(x - 0.06, 0, z0, x + 0.06, 0.9, z1);
  }
  /** Board fence along X/Z (collides at full height). */
  function woodFenceX(x0, x1, z, h) { L.box(x0, 0, z - 0.05, x1, h, z + 0.05, 'boardBrown'); for (let x = x0; x <= x1 + 0.01; x += 2.4) deco(x - 0.08, 0, z - 0.09, x + 0.08, h + 0.1, z + 0.09, 'woodDark'); }
  function woodFenceZ(z0, z1, x, h) { L.box(x - 0.05, 0, z0, x + 0.05, h, z1, 'boardBrown'); for (let z = z0; z <= z1 + 0.01; z += 2.4) deco(x - 0.09, 0, z - 0.08, x + 0.09, h + 0.1, z + 0.08, 'woodDark'); }
  function latticeTower(x, z, h, b0, b1, m) {
    const lvl = 6, P = (k, sx, sz) => { const b = b0 + (b1 - b0) * k; return [x + sx * b / 2, h * k, z + sz * b / 2]; };
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const c of C) { const a = P(0, c[0], c[1]), b = P(1, c[0], c[1]); L.pipe(m, a[0], a[1], a[2], b[0], b[1], b[2], 0.09); }
    for (let i = 0; i < lvl; i++) for (let j = 0; j < 4; j++) {
      const c0 = C[j], c1 = C[(j + 1) % 4], k0 = i / lvl, k1 = (i + 1) / lvl;
      const p0 = P(k0, c0[0], c0[1]), p1 = P(k1, c1[0], c1[1]), p2 = P(k0, c1[0], c1[1]), p3 = P(k1, c0[0], c0[1]);
      L.pipe(m, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.04); L.pipe(m, p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], 0.04);
    }
  }
  function painting(x, y, z, ry, w, h) {
    const ax = Math.abs(Math.sin(ry)) > 0.5;
    if (ax) deco(x - 0.03, y - h / 2 - 0.06, z - w / 2 - 0.06, x + 0.03, y + h / 2 + 0.06, z + w / 2 + 0.06, 'woodDark');
    else deco(x - w / 2 - 0.06, y - h / 2 - 0.06, z - 0.03, x + w / 2 + 0.06, y + h / 2 + 0.06, z + 0.03, 'woodDark');
    plane(art().painting, w, h, x + Math.sin(ry) * 0.035, y, z + Math.cos(ry) * 0.035, ry);
  }
  function roomLight(x, y, z) { sph('lampWarm', x, y - 0.12, z, 0.2, 0.1, 0.2); deco(x - 0.04, y - 0.1, z - 0.04, x + 0.04, y, z + 0.04, 'chrome'); L.lamp(x, y - 0.3, z, { color: 0xffd9a8, intensity: 1.4, distance: 9, pool: false }); }
  function couch(x0, z0, x1, z1, back) { // back: 'x-', 'x+', 'z-', 'z+' = side the backrest is on
    L.box(x0, 0.12, z0, x1, 0.55, z1, 'couch');
    const t = 0.25;
    const bk = (a, b, c, d) => L.box(a, 0.55, b, c, 1.0, d, 'couch', { ao: false });
    if (back === 'x-') bk(x0, z0, x0 + t, z1); if (back === 'x+') bk(x1 - t, z0, x1, z1);
    if (back === 'z-') bk(x0, z0, x1, z0 + t); if (back === 'z+') bk(x0, z1 - t, x1, z1);
  }
  function bed(x0, z0, x1, z1, y, head) {
    L.box(x0, y, z0, x1, y + 0.35, z1, 'woodDark'); deco(x0 + 0.03, y + 0.35, z0 + 0.03, x1 - 0.03, y + 0.55, z1 - 0.03, 'bedspread');
    const hb = (a, b, c, d) => L.box(a, y, b, c, y + 1.1, d, 'woodDark', { ao: false });
    if (head === 'x-') hb(x0 - 0.02, z0, x0 + 0.1, z1); else if (head === 'x+') hb(x1 - 0.1, z0, x1 + 0.02, z1);
    else if (head === 'z-') hb(x0, z0 - 0.02, x1, z0 + 0.1); else hb(x0, z1 - 0.1, x1, z1 + 0.02);
  }
  function table(x0, z0, x1, z1, y) { L.box(x0, y + 0.72, z0, x1, y + 0.78, z1, 'wood', { noCol: true }); for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.08, z0 + 0.08], [x0 + 0.08, z1 - 0.08], [x1 - 0.08, z1 - 0.08]]) deco(x - 0.04, y, z - 0.04, x + 0.04, y + 0.72, z + 0.04, 'wood'); solid(x0, y, z0, x1, y + 0.78, z1); }
  function chair(x, z, y) { deco(x - 0.22, y + 0.42, z - 0.22, x + 0.22, y + 0.47, z + 0.22, 'wood'); deco(x - 0.22, y + 0.47, z + 0.17, x + 0.22, y + 0.95, z + 0.22, 'wood'); for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) deco(x + dx - 0.02, y, z + dz - 0.02, x + dx + 0.02, y + 0.42, z + dz + 0.02, 'wood'); solid(x - 0.23, y, z - 0.23, x + 0.23, y + 0.95, z + 0.23); }

  // ------------------------------------------------------------ the yellow house (north side, faces the cul-de-sac to the south)
  function yellowHouse() {
    const x0 = -9, x1 = 7, z0 = -31, z1 = -19, xp = -1;
    const OUT = [[0, 0.55, 'stone'], [0.55, RF, 'boardYellow']], IN1 = [[0, 1.0, 'woodDark'], [1.0, F1, 'wallpaper']], IN2 = [[F, H2, 'wallpaper2']];
    const dress = { shutter: 'shutterBrown' };
    // floors: living room carpet, kitchen checkerboard
    L.box(x0, 0, z0, xp, 0.12, z1, 'carpetBeige'); L.box(xp, 0, z0, x1, 0.12, z1, 'checker');
    // ground floor walls
    wall('x', x0, x1, z1, 0, F, [[-3.5, -1.9, 0.12, 2.35], [-7.8, -5, 0.95, 2.3], [2, 5.5, 0.95, 2.3]], OUT, IN1, 1, dress);
    wall('x', x0, x1, z0, 0, F, [[3, 4.6, 0.12, 2.35], [0.5, 2.5, 1.2, 2.3]], OUT, IN1, -1, dress);
    wall('z', z0, z1, x0, 0, F, [[-29.4, -27.6, 0.95, 2.3], [-22.4, -20.9, 0.12, 2.35]], OUT, IN1, -1, dress);
    wall('z', z0, z1, x1, 0, F, [[-27.4, -25, 0.95, 2.3], [-23.8, -22.3, 0.12, 2.35]], OUT, IN1, 1, dress);
    wall('z', z0 + T, z1 - T, xp, 0.12, F1, [[-28.2, -26.6, 0.12, 2.35], [-23.5, -20.5, 0.12, 2.6]], null, IN1, 0);
    // upper floor walls
    wall('x', x0, x1, z1, F, RF, [[-7.5, -4.5, 4.0, 5.4], [1.5, 4.5, 4.0, 5.4]], OUT, IN2, 1, dress);
    wall('x', x0, x1, z0, F, RF, [[-6, -3, 4.0, 5.4], [2, 5, 4.0, 5.4]], OUT, IN2, -1, dress);
    wall('z', z0, z1, x0, F, RF, [[-22.8, -20.8, 4.0, 5.4]], OUT, IN2, -1, dress);
    wall('z', z0, z1, x1, F, RF, [[-26.5, -23.5, 4.0, 5.4]], OUT, IN2, 1, dress);
    wall('z', -28.3, z1 - T, 0, F, H2, [], null, IN2, 0);
    // stairs along the back wall of the living room, climbing east; stairwell open above
    const sz0 = z0 + T, sz1 = z0 + T + 1.3;
    stairs(x0 + T, sz0, -2, sz1, 0.12, F, 'x+');
    L.box(x0, F1, sz1, x1, F, z1, 'ceiling', { top: 'carpetBeige', side: 'trim', bottom: true });
    L.box(-2, F1, z0, x1, F, sz1, 'ceiling', { top: 'carpetBeige', side: 'trim', bottom: true });
    railingX(x0 + T, -2.9, sz1, F);
    // ceiling and hip roof, stone chimney on the west wall
    L.box(x0, H2, z0, x1, RF, z1, 'ceiling', { side: 'trim', bottom: true });
    hipRoof((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, RF, 1.9, 'roofGray');
    L.box(-10.3, 0, -26.2, x0 - T / 2, 9.4, -23.4, 'stone'); deco(-10.45, 9.4, -26.35, -8.95, 9.6, -23.25, 'concrete');
    // front porch: deck and a walkable shed roof on posts
    L.box(-8, 0, z1, 6, 0.22, z1 + 2.3, 'floorWood');
    L.box(-8.2, 2.85, z1 + T / 2, 6.2, 3.0, z1 + 2.45, 'roofing');
    for (const x of [-7.9, -3.2, 1.5, 5.9]) L.box(x - 0.1, 0.22, z1 + 2.1, x + 0.1, 2.85, z1 + 2.3, 'woodDark');
    // carport on the west side with the yellow cab
    L.box(-17.2, 2.7, -30.2, x0 - T / 2, 2.9, -19.8, 'roofing');
    for (const z of [-29.9, -25, -20.1]) L.box(-17.1, 0, z - 0.1, -16.9, 2.7, z + 0.1, 'woodDark');
    car(-13.4, -25.2, false, 'paintTaxi');
    // living room
    couch(x0 + T, -26.4, x0 + T + 0.9, -23.4, 'x-'); couch(-6.6, -21.2, -4.2, -20.3, 'z+');
    deco(-6.5, 0.12, -25.9, -3, 0.13, -22.6, 'rug');
    L.box(-2.4, 0.12, -26.2, xp - T / 2, 0.75, -24.8, 'woodDark'); L.box(-2.2, 0.75, -26, -1.4, 1.35, -25, 'paintDark', { ao: false }); // tv cabinet
    painting(x0 + T / 2 + 0.03, 1.9, -24.9, Math.PI / 2, 1.2, 0.9);
    roomLight(-5, F1, -25); roomLight(3, F1, -24.5);
    // kitchen: counters, fridge, stove, upper cabinets, dinette
    L.box(-0.8, 0.12, z0 + T / 2, 2.8, 0.95, z0 + 0.8, 'cabinet', { top: 'counter' }); L.box(4.8, 0.12, z0 + T / 2, x1 - T / 2, 0.95, z0 + 0.8, 'cabinet', { top: 'counter' });
    L.box(x1 - 0.75, 0.12, z0 + 0.8, x1 - T / 2, 0.95, -27.6, 'cabinet', { top: 'counter' });
    L.box(1.6, 0.12, z0 + 0.14, 2.4, 0.97, z0 + 0.82, 'appliance');
    L.box(x1 - 0.9, 0.12, -21.1, x1 - T / 2, 1.9, -19.95, 'appliance');
    L.box(-0.8, 2.35, z0 + T / 2, 2.8, 2.95, z0 + 0.5, 'cabinet', { ao: false }); L.box(4.8, 1.6, z0 + T / 2, x1 - T / 2, 2.4, z0 + 0.5, 'cabinet', { ao: false });
    table(2.2, -25.4, 3.8, -23.8, 0.12); chair(3, -26, 0.12); chair(3, -23.2, 0.12);
    mannequin(4.3, 0.12, -24.6, true);
    // upstairs: bed and dresser in the west room, bunk beds in the east room
    bed(x0 + T, -27.2, x0 + 2.4, -24.9, F, 'x-'); L.box(-1.9, F, -23.9, -0.25, F + 1.1, -23.3, 'woodDark');
    bed(x1 - 2.3, -28.1, x1 - T / 2, -26.2, F, 'x+'); deco(x1 - 2.3, F + 1.55, -28.1, x1 - T / 2, F + 1.75, -26.2, 'woodDark'); deco(x1 - 2.25, F + 1.75, -28.05, x1 - 0.2, F + 1.9, -26.25, 'bedspread');
    for (const [x, z] of [[x1 - 2.3, -28.1], [x1 - 2.3, -26.2]]) L.box(x - 0.04, F, z - 0.04, x + 0.04, F + 2, z + 0.04, 'woodDark', { ao: false });
    deco(-8.5, F + 0.01, -23.5, -5, F + 0.02, -21, 'rug');
    painting(-0.14, F + 1.7, -23.5, Math.PI / 2, 0.9, 0.7);
    mannequin(-6, F, -20.4, false);
    roomLight(-4.5, H2, -24); roomLight(3.5, H2, -24);
    // back deck with pergola, grill and patio set
    L.box(-1, 0, -37, x1, 0.45, z0 - T / 2, 'floorWood');
    L.box(x1, 0, -35, x1 + 1, 0.22, -33, 'floorWood');
    railingX(-1, x1, -37, 0.45); railingZ(-37, -35, x1, 0.45); railingZ(-33, z0 - T / 2, x1, 0.45); railingZ(-37, z0 - T / 2, -1, 0.45);
    for (const [x, z] of [[-0.8, -36.8], [6.8, -36.8], [-0.8, -31.4], [6.8, -31.4]]) L.box(x - 0.1, 0.45, z - 0.1, x + 0.1, 3.4, z + 0.1, 'woodDark');
    for (const z of [-36.8, -31.4]) deco(-1.1, 3.25, z - 0.08, 7.1, 3.45, z + 0.08, 'woodDark');
    for (let x = -0.8; x <= 6.9; x += 0.55) deco(x - 0.04, 3.45, -37.1, x + 0.04, 3.6, -31.1, 'wood');
    L.box(5.2, 0.45, -36.4, 5.9, 1.4, -35.8, 'paintDark'); table(1.5, -35.4, 3, -34, 0.45); chair(2.2, -36.1, 0.45); chair(2.2, -33.4, 0.45);
  }

  // ------------------------------------------------------------ the green house (south side, faces north) with its garage
  function greenHouse() {
    const x0 = -7, x1 = 7, z0 = 19, z1 = 31, xp = 0.5;
    const OUT = [[0, 0.8, 'stone'], [0.8, 1.9, 'sidingWhite'], [1.9, F, 'sidingTeal'], [F, 4.0, 'sidingWhite'], [4.0, 5.4, 'sidingTeal'], [5.4, RF, 'sidingWhite']];
    const IN1 = [[0, 1.0, 'woodDark'], [1.0, F1, 'wallpaper2']], IN2 = [[F, H2, 'wallpaper']];
    const dress = { shutter: 'shutterWhite' };
    L.box(x0, 0, z0, xp, 0.12, z1, 'carpetBeige'); L.box(xp, 0, z0, x1, 0.12, z1, 'checker');
    wall('x', x0, x1, z0, 0, F, [[-2.2, -0.6, 0.12, 2.35], [1.2, 4.8, 1.0, 2.3], [-6, -3.6, 1.0, 2.3]], OUT, IN1, -1, dress);
    wall('x', x0, x1, z1, 0, F, [[2, 3.6, 0.12, 2.35], [4.5, 6.5, 1.2, 2.3]], OUT, IN1, 1, dress);
    wall('z', z0, z1, x0, 0, F, [[21, 23.5, 1.0, 2.3], [26, 28, 1.0, 2.3]], OUT, IN1, -1, dress);
    wall('z', z0, z1, x1, 0, F, [[24.8, 26.4, 0.12, 2.35]], OUT, IN1, 1, dress);
    wall('z', z0 + T, z1 - T, xp, 0.12, F1, [[20.5, 23.5, 0.12, 2.6], [26.6, 28.2, 0.12, 2.35]], null, IN1, 0);
    wall('x', x0, x1, z0, F, RF, [[-6, -2.6, 4.0, 5.4], [0.8, 4.6, 4.0, 5.4]], OUT, IN2, -1, dress);
    wall('x', x0, x1, z1, F, RF, [[-5, -2, 4.0, 5.4], [2, 5, 4.0, 5.4]], OUT, IN2, 1, dress);
    wall('z', z0, z1, x0, F, RF, [[23, 26, 4.0, 5.4]], OUT, IN2, -1, dress);
    wall('z', z0, z1, x1, F, RF, [[28.8, 30.3, 4.0, 5.4]], OUT, IN2, 1, dress);
    wall('z', z0 + T, 28.3, 0, F, H2, [], null, IN2, 0);
    const sz1 = z1 - T, sz0 = sz1 - 1.3;
    stairs(x0 + T, sz0, 0, sz1, 0.12, F, 'x+');
    L.box(x0, F1, z0, x1, F, sz0, 'ceiling', { top: 'carpetBeige', side: 'trim', bottom: true });
    L.box(0, F1, sz0, x1, F, z1, 'ceiling', { top: 'carpetBeige', side: 'trim', bottom: true });
    railingX(x0 + T, -0.9, sz0, F);
    L.box(x0, H2, z0, x1, RF, z1, 'ceiling', { side: 'trim', bottom: true });
    gableRoof((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, RF, 2.1, 'sidingWhite', 'roofGray');
    // porch: little flat roof on a lattice column, stone planters with shrubs
    L.box(-3.4, 2.7, 17, 1.0, 2.85, z0 - T / 2, 'trim', { bottom: true });
    L.box(-3.4, 0, 17.1, -2.8, 2.7, 17.7, 'lattice', { shoot: false });
    L.box(-6.6, 0, 17.4, -3.6, 0.75, 18.8, 'stone', { top: 'dirt' }); L.box(1.2, 0, 17.4, 5.2, 0.75, 18.8, 'stone', { top: 'dirt' });
    for (const x of [-5.9, -4.4, 1.9, 3.3, 4.6]) bush(x, 18.1, 0.55, 0.75, true);
    solid(-6.6, 0.75, 17.4, -3.6, 1.4, 18.8); solid(1.2, 0.75, 17.4, 5.2, 1.4, 18.8);
    deco(-2.3, 0, 18.4, -0.5, 0.12, z0 - T / 2, 'concrete');
    // flag on the porch column
    L.pipe('chrome', -2.8, 2.2, 17.2, -2.4, 2.75, 16.7, 0.02); plane(art().flag, 1.0, 0.62, -1.9, 2.45, 16.7, 0, { double: true });
    // living room
    couch(x0 + T, 24, x0 + T + 0.9, 27, 'x-'); couch(-4.6, 19.2, -3.6, 20.4, 'z-');
    deco(-6, 0.12, 21.5, -2, 0.13, 27.5, 'rug');
    L.box(-1.2, 0.12, 24, xp - T / 2, 0.75, 25.4, 'woodDark'); L.box(-1.1, 0.75, 24.2, -0.45, 1.35, 25.2, 'paintDark', { ao: false });
    painting(x0 + T / 2 + 0.03, 1.9, 24.9, Math.PI / 2, 1.3, 0.95);
    mannequin(-4.8, 0.12, 25.2, true);
    roomLight(-3.5, F1, 24.5); roomLight(3.8, F1, 25);
    // kitchen
    L.box(x1 - 0.75, 0.12, 20, x1 - T / 2, 0.95, 24.4, 'cabinet', { top: 'counter' }); L.box(3.8, 0.12, z1 - 0.8, x1 - T / 2, 0.95, z1 - T / 2, 'cabinet', { top: 'counter' });
    L.box(0.8, 0.12, z1 - 0.95, 1.8, 1.9, z1 - T / 2, 'appliance'); L.box(5.2, 0.12, z1 - 0.82, 6, 0.97, z1 - 0.14, 'appliance');
    L.box(x1 - 0.5, 1.6, 20, x1 - T / 2, 2.4, 24.4, 'cabinet', { ao: false });
    table(2, 22.5, 4, 24.3, 0.12); chair(3, 21.9, 0.12); chair(3, 24.9, 0.12);
    // upstairs
    bed(x0 + T, 24.8, x0 + 2.4, 27.2, F, 'x-'); L.box(-2.2, F, 20.4, -0.25, F + 1.0, 21, 'woodDark');
    bed(x1 - 2.4, 24.6, x1 - T / 2, 27, F, 'x+'); table(2, 20, 3.6, 20.8, F); chair(2.8, 21.3, F);
    deco(-6, F + 0.01, 20.5, -2.5, F + 0.02, 23.5, 'rug');
    painting(-0.14, F + 1.7, 23.5, -Math.PI / 2, 0.9, 0.7);
    roomLight(-3.5, H2, 24); roomLight(3.5, H2, 24);
    // attached garage on the east side (the house wall is its west wall)
    const g0 = x1, g1 = 13.5, gz0 = 19.5, gz1 = 28.5, GH = 3.0, GOUT = [[0, 0.6, 'stone'], [0.6, GH, 'sidingWhite']], GIN = [[0, GH, 'sidingWhite']];
    L.box(g0, 0, gz0, g1, 0.1, gz1, 'concrete');
    wall('x', g0 + T / 2, g1, gz0, 0, GH, [[7.6, 13, 0, 2.5]], GOUT, GIN, -1, { noLeaf: true });
    wall('x', g0 + T / 2, g1, gz1, 0, GH, [[9.5, 11.5, 1.2, 2.2]], GOUT, GIN, 1, {});
    wall('z', gz0, gz1, g1, 0, GH, [[22.8, 24.3, 0.1, 2.3]], GOUT, GIN, 1, {});
    deco(7.7, 2.2, gz0 + 0.3, 12.9, 2.5, gz0 + 0.38, 'garageDoor');
    L.box(g0, GH, gz0, g1, GH + 0.12, gz1, 'ceiling', { side: 'trim', bottom: true });
    gableRoof((g0 + g1) / 2, (gz0 + gz1) / 2, g1 - g0, gz1 - gz0, GH + 0.12, 1.3, 'sidingWhite', 'roofGray');
    L.box(g1 - 0.8, 0.1, 24.6, g1 - T / 2, 1.0, 28.2, 'wood'); deco(g1 - 0.5, 1.4, 24.6, g1 - T / 2, 1.45, 28.2, 'wood'); deco(g1 - 0.5, 1.9, 24.6, g1 - T / 2, 1.95, 28.2, 'wood');
    L.box(7.6, 0.1, 27, 9, 0.9, 28.2, 'cardboard'); L.box(7.8, 0.9, 27.2, 8.8, 1.5, 28, 'cardboard'); tires(11.6, 21.2, 3);
    roomLight(10.3, GH, 24);
    // back patio
    deco(-6, 0.02, z1 + T / 2, 3, 0.07, 35, 'concrete');
    table(-3, 32.6, -1.8, 33.8, 0.07); chair(-3.6, 33.2, 0.07); chair(-1.2, 33.2, 0.07);
    L.cyl('chrome', -2.4, 1.5, 33.2, 0.03, 2.6, 0, 0, true); put('paintCherry', geo('cone'), -2.4, 2.75, 33.2, 1.3, 0.45, 1.3);
    solid(-2.45, 0, 33.15, -2.35, 2.6, 33.25, 'metal'); W.add(-3.7, 2.5, 31.9, -1.1, 2.98, 34.5, { surf: 'fabric' }); W.add(-3.7, 2.98, 31.9, -1.1, 8, 34.5, { shoot: false, nav: false });
  }

  // ------------------------------------------------------------ the red house at the west end (solid, not enterable)
  function redHouse() {
    const x0 = -36, x1 = -22, z0 = -9, z1 = 9;
    L.box(x0, 0, z0, x1, 3.3, z1, 'stucco', { side: 'stucco' });
    deco(x1, 0, z0, x1 + 0.08, 1.1, z1, 'brick');
    solid(x1, 0, z0, x1 + 0.12, 3.45, z1);
    W.add(x1 - 0.4, 3.3, z0 - 0.8, x1 + 0.9, 40, z1 + 0.8, { shoot: false, nav: false });
    deco(x1 + 0.02, 0.1, -7.6, x1 + 0.1, 2.6, -3.6, 'redDoor'); deco(x1 + 0.02, 0.1, -3.2, x1 + 0.1, 2.6, 0.8, 'redDoor');
    for (let z = -7.4; z < 0.8; z += 0.65) deco(x1 + 0.1, 0.1, z, x1 + 0.12, 2.6, z + 0.04, 'trim');
    deco(x1 + 0.02, 1.2, 2.2, x1 + 0.06, 2.6, 7.6, 'glassDay'); for (let z = 2.2; z <= 7.61; z += 1.35) deco(x1 + 0.06, 1.2, z - 0.05, x1 + 0.1, 2.6, z + 0.05, 'trim');
    for (const z of [-7.8, 7.8]) deco(x0 + 1, 1.2, z < 0 ? z0 - 0.06 : z1, x1 - 1, 2.6, z < 0 ? z0 : z1 + 0.06, 'glassDay');
    deco(x0 - 0.8, 3.3, z0 - 0.8, x1 + 0.9, 3.45, z1 + 0.8, 'trim');
    put('roofLight', hipRoofGeo(19.6, 15.6, 1.2), (x0 + x1) / 2, 3.45, 0, 1, 1, 1, Math.PI / 2);
    L.box(-27, 3.45, 3, -25.6, 5.4, 4.4, 'brick');
    deco(x1, 0.02, -8, -13, 0.07, 1.4, 'concrete');
  }

  // ------------------------------------------------------------ vehicles in the turnaround and the street
  function schoolBus(x, z) { // along +X, front at the east end
    put('busYellow', extrude('bus', [[-6.2, 0.62], [5.3, 0.62], [5.4, 0.62], [7.1, 0.62], [7.4, 0.62, 7.4, 0.9], [7.35, 1.75], [7.2, 1.98, 6.4, 1.98], [6.1, 2.0], [6.1, 2.8], [6.0, 3.12, 5.3, 3.14], [-5.4, 3.14], [-6.15, 3.12, -6.2, 2.7], [-6.2, 0.62]], 2.44, 0.05), x, 0, z, 1, 1, 1);
    put('busRoof', extrude('busRoof', [[-6.26, 2.9], [6.16, 2.9], [6.06, 3.18, 5.3, 3.2], [-5.4, 3.2], [-6.2, 3.18, -6.26, 2.8]], 2.36, 0.06), x, 0, z, 1, 1, 1);
    for (let i = 0; i < 9; i++) { const xa = x - 5.6 + i * 1.22; deco(xa, 1.8, z - 1.3, xa + 1.02, 2.6, z - 1.26, 'glassDay'); deco(xa, 1.8, z + 1.26, xa + 1.02, 2.6, z + 1.3, 'glassDay'); }
    deco(x + 6.12, 1.95, z - 1.05, x + 6.2, 2.75, z + 1.05, 'glassDay'); deco(x - 6.28, 1.8, z - 0.9, x - 6.22, 2.7, z + 0.9, 'glassDay');
    for (const y of [1.1, 1.5, 2.72]) { deco(x - 6.26, y, z - 1.31, x + 7.3, y + 0.07, z - 1.27, 'rubber'); deco(x - 6.26, y, z + 1.27, x + 7.3, y + 0.07, z + 1.31, 'rubber'); }
    deco(x + 7.38, 0.5, z - 1.25, x + 7.62, 0.72, z + 1.25, 'chrome'); deco(x - 6.5, 0.5, z - 1.25, x - 6.24, 0.72, z + 1.25, 'chrome');
    deco(x + 7.4, 0.95, z - 0.55, x + 7.44, 1.55, z + 0.55, 'chrome');
    for (const s of [-0.85, 0.85]) { sph('chrome', x + 7.38, 1.3, z + s, 0.15); sph('lampRed', x + 6.2, 3.0, z + s, 0.1); sph('lampRed', x - 6.24, 2.9, z + s, 0.12); }
    plane(art().bus, 1.8, 0.34, x + 6.24, 2.93, z, Math.PI / 2);
    deco(x + 5.2, 1.0, z - 1.55, x + 5.24, 1.5, z - 1.28, 'paintRed');
    wheels(x - 3.9, x + 4.7, z - 1.2, z + 1.2, 0.55);
    solid(x - 6.3, 0, z - 1.3, x + 7.5, 2.0, z + 1.3, 'metal'); solid(x - 6.3, 2.0, z - 1.3, x + 6.1, 3.2, z + 1.3, 'metal');
  }
  function movingTruck(x, z) { // cab at x..x+3.4 facing +X, trailer behind it
    const cab0 = x, cab1 = x + 3.4, t0 = x - 11.2, t1 = x - 0.2;
    // trailer: red skirt, white boards, rounded aluminium roof
    L.box(t0, 1.15, z - 1.3, t1, 2.05, z + 1.3, 'paintCherry');
    L.box(t0, 2.05, z - 1.3, t1, 3.95, z + 1.3, 'trailerWhite');
    put('chrome', extrude('trailerRoof', [[0, 0], [11, 0], [11, 0.25], [10.8, 0.36, 10.5, 0.36], [0.5, 0.36], [0.2, 0.36, 0, 0.25]], 2.56, 0.03), t0, 3.92, z, 1, 1, 1);
    plane(art().moving, 9.6, 2.4, (t0 + t1) / 2, 2.55, z + 1.32, 0); plane(art().moving, 9.6, 2.4, (t0 + t1) / 2, 2.55, z - 1.32, Math.PI);
    deco(t0 - 0.05, 1.2, z - 0.02, t0, 3.9, z + 0.02, 'chrome');
    deco(t0 + 0.4, 0.6, z - 1.1, t1 - 0.4, 1.15, z + 1.1, 'paintDark');
    wheels(t0 + 1.2, t0 + 2.4, z - 1.1, z + 1.1, 0.52);
    // cab-over tractor
    L.box(cab0, 0.95, z - 1.25, cab1, 3.55, z + 1.25, 'paintCherry');
    deco(cab1 - 0.02, 2.25, z - 1.1, cab1 + 0.03, 3.25, z + 1.1, 'glassDay');
    deco(cab0 + 1.8, 2.3, z - 1.27, cab1 - 0.2, 3.2, z + 1.27, 'glassDay');
    deco(cab1, 1.0, z - 0.9, cab1 + 0.12, 2.15, z + 0.9, 'chrome');
    for (let y = 1.1; y < 2.1; y += 0.14) deco(cab1 + 0.12, y, z - 0.85, cab1 + 0.15, y + 0.05, z + 0.85, 'paintDark');
    deco(cab1, 0.55, z - 1.3, cab1 + 0.3, 0.85, z + 1.3, 'chrome');
    for (const s of [-0.95, 0.95]) sph('chrome', cab1 + 0.08, 1.55, z + s, 0.16);
    for (let i = -2; i <= 2; i++) sph('lampAmber', cab1 - 0.1, 3.62, z + i * 0.4, 0.06);
    L.cyl('chrome', cab0 - 0.1, 3.2, z - 1.1, 0.08, 2.4, 0, 0, true);
    deco(x - 0.4, 0.8, z - 0.6, cab0 + 0.2, 1.15, z + 0.6, 'paintDark');
    wheels(cab0 + 0.6, cab1 - 0.6, z - 1.1, z + 1.1, 0.52);
    solid(t0, 0, z - 1.3, t1, 4.3, z + 1.3, 'metal'); solid(cab0 - 0.2, 0, z - 1.3, cab1 + 0.3, 3.6, z + 1.3, 'metal');
  }
  function jeep(x, z) { // along X, nose at +X
    put('olive', extrude('jeep', [[-1.75, 0.55], [1.85, 0.55], [1.9, 1.15], [1.1, 1.2], [0.55, 1.25], [-1.75, 1.3], [-1.8, 0.95]], 1.55, 0.05), x, 0, z, 1, 1, 1);
    L.pipe('olive', x + 0.5, 1.25, z - 0.72, x + 0.45, 1.95, z - 0.72, 0.04); L.pipe('olive', x + 0.5, 1.25, z + 0.72, x + 0.45, 1.95, z + 0.72, 0.04); L.pipe('olive', x + 0.45, 1.95, z - 0.72, x + 0.45, 1.95, z + 0.72, 0.04);
    L.pipe('olive', x - 1.1, 1.3, z - 0.72, x - 1.1, 2.0, z - 0.72, 0.04); L.pipe('olive', x - 1.1, 1.3, z + 0.72, x - 1.1, 2.0, z + 0.72, 0.04); L.pipe('olive', x - 1.1, 2.0, z - 0.72, x - 1.1, 2.0, z + 0.72, 0.04);
    L.cyl('rubber', x - 1.95, 1.05, z, 0.42, 0.25, 0, Math.PI / 2, true);
    for (let i = 0; i < 4; i++) put('sandbag', blobGeo(i % 3), x - 1.0 + (i % 2) * 0.6, 1.45, z - 0.35 + (i >> 1) * 0.7, 0.32, 0.14, 0.22, 0.3);
    wheels(x - 1.15, x + 1.2, z - 0.85, z + 0.85, 0.42, false, 'olive');
    solid(x - 2.1, 0, z - 0.9, x + 1.95, 1.4, z + 0.9, 'metal');
    solid(x + 0.4, 1.25, z - 0.78, x + 0.55, 2.0, z + 0.78, 'metal'); solid(x - 1.15, 1.3, z - 0.78, x - 1.05, 2.04, z + 0.78, 'metal');
  }
  function armyTruck(x, z) {
    L.box(x + 1.6, 0.7, z - 1.2, x + 3.9, 2.6, z + 1.2, 'olive', { noCol: true }); deco(x + 3.88, 1.8, z - 1.0, x + 3.92, 2.4, z + 1.0, 'glassDay');
    deco(x - 3.9, 0.9, z - 1.25, x + 1.5, 1.4, z + 1.25, 'olive');
    put('canvasOlive', extrude('canopy', [[0, 0], [5.4, 0], [5.4, 1.4], [5.2, 1.9, 2.7, 1.95], [0.2, 1.9, 0, 1.4]], 2.5, 0.03), x - 3.9, 1.4, z, 1, 1, 1);
    wheels(x - 2.8, x + 2.8, z - 1.1, z + 1.1, 0.55, false, 'olive');
  }

  // ------------------------------------------------------------ out-of-bounds neighbours along the street
  function ranchHouse(x0, z0, x1, z1, front, wallMat, roofMat, carPaint) {
    const zf = front > 0 ? z1 : z0, s = front;
    L.box(x0, 0, z0, x1, 3.2, z1, wallMat, { noCol: true });
    deco(x0 - 0.02, 0, zf - 0.04, x1 + 0.02, 0.7, zf + 0.04, 'stone');
    for (const wx of [x0 + 1.5, x0 + 4.5, x1 - 3]) { deco(wx, 1.1, zf - 0.05, wx + 1.8, 2.4, zf + 0.05, 'glassDay'); deco(wx - 0.5, 1.1, zf + s * 0.05, wx - 0.1, 2.4, zf + s * 0.09, 'shutterWhite'); deco(wx + 1.9, 1.1, zf + s * 0.05, wx + 2.3, 2.4, zf + s * 0.09, 'shutterWhite'); }
    deco(x0 + 7.4, 0, zf - 0.06, x0 + 8.4, 2.3, zf + 0.06, 'redDoor');
    gableRoof((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 3.2, 1.8, wallMat, roofMat);
    deco(x1 - 3.5, 0.02, front > 0 ? z1 : 5.5, x1 - 0.5, 0.07, front > 0 ? -5.5 : z0, 'concrete');
    if (carPaint) car(x1 - 2, front > 0 ? z1 + 3.2 : z0 - 3.2, false, carPaint);
    hedge(x0 + 0.5, zf + s * 1.2, x0 + 6, zf + s * 1.2, 0.9);
  }

  // ------------------------------------------------------------ build
  MN.build = function () {
    // ground: desert all around, lawns inside the neighbourhood
    // desert around the lawns (four slabs so nothing sits coplanar under the grass)
    for (const b of [[-400, -400, 400, -46], [-400, 46, 400, 400], [-400, -46, -42, 46], [74, -46, 400, 46]]) L.box(b[0], -1, b[1], b[2], 0.02, b[3], 'dirt', { ao: false });
    L.box(-42, -1, -46, 74, 0.02, 46, 'grass', { ao: false });
    // the turnaround: asphalt disc with a raised curb ring and sidewalk
    put('asphalt', discGeo(0, 12, 1 / 6), 0, 0.035, 0, 1, 1, 1);
    put('concrete', discGeo(12, 14.5, 0.25), 0, 0.07, 0, 1, 1, 1);
    const curb = new THREE.CylinderGeometry(12, 12, 0.07, 64, 1, true); put('concrete', curb, 0, 0.035, 0, 1, 1, 1);
    // street east to the roadblock and beyond
    deco(8, 0.02, -5.5, 74, 0.045, 5.5, 'asphalt');
    for (let x = 16; x < 74; x += 6) deco(x, 0.045, -0.08, x + 3, 0.05, 0.08, 'paintYellow');
    deco(12, 0.02, -7.6, 74, 0.08, -5.5, 'concrete'); deco(12, 0.02, 5.5, 74, 0.08, 7.6, 'concrete');
    // driveways and walks
    deco(-16.6, 0.02, -30.2, -10.2, 0.06, -8, 'concrete');
    deco(7.6, 0.02, 10, 13.2, 0.06, 19.5, 'concrete');
    deco(-3.5, 0.02, -16.7, -1.9, 0.06, -14.4, 'concrete'); deco(-2.2, 0.02, 14.2, -0.6, 0.06, 17, 'concrete');

    yellowHouse();
    greenHouse();
    redHouse();

    // the turnaround
    schoolBus(-0.8, 4.6);
    movingTruck(2.2, -4.7);
    car(10.3, 14.3, false, 'paintCream', true);
    // the roadblock at the mouth of the street
    jeep(14.4, 1.5);
    roadBlock(19.1, -5.4, -0.6); roadBlock(19.1, 0.6, 5.4);
    sandbags(18.3, -5.4, 18.3, -1.8, 3); sandbags(18.3, 2.6, 18.3, 5.4, 2); sandbags(12.2, -3.2, 13.6, -4.4, 2);
    armyTruck(33, 2.6);
    // street furniture
    streetLamp(9.6, -9.6); streetLamp(-9.8, 9.4); streetLamp(-10.2, -9.2); streetLamp(12.8, 6.6);
    hydrant(-11.3, 7.6); hydrant(13.2, -6.6);
    trashCan(13.9, 11.2); trashCan(14.5, 11.9); trashCan(-15.2, -9.2);
    mailbox(-3, 14.9); mailbox(0.2, -14.9);
    // "Welcome to Nuketown" sign between the red house and the green house lot
    for (const z of [7.4, 12.6]) { L.box(-17.3, 0, z - 0.32, -16.66, 2.6, z + 0.32, 'concrete'); sph('appliance', -16.98, 2.95, z, 0.36); solid(-17.34, 2.6, z - 0.36, -16.62, 3.32, z + 0.36); }
    L.box(-17.1, 0.35, 7.72, -16.86, 2.3, 12.28, 'paintCherry');
    plane(art().welcome, 4.5, 1.9, -16.84, 1.33, 10, Math.PI / 2); plane(art().welcome, 4.5, 1.9, -17.12, 1.33, 10, -Math.PI / 2);
    // clock tower behind the fence
    latticeTower(-31, 25, 17, 4, 1.8, 'paintGrey');
    deco(-32.4, 17, 23.6, -29.6, 17.3, 26.4, 'paintGrey');
    { const len = Math.hypot(31, 25), nx = 31 / len, nz = -25 / len; plane(art().clock, 4.4, 4.4, -31 + nx * 1.2, 19.6, 25 + nz * 1.2, Math.atan2(nx, nz), { circle: true, double: true }); }
    // power lines
    const p1 = powerPole(-18.2, -12.5, 9), p2 = powerPole(13.8, -9.2, 9), p3 = powerPole(-14, 13.8, 9), p4 = powerPole(28, -8.4, 9), p5 = powerPole(46, -8.4, 9), p6 = powerPole(64, -8.4, 9);
    wire(p1, p2, 0.8); wire(p2, p4); wire(p4, p5); wire(p5, p6); wire(p1, p3, 0.9); wire(p1, [-9, 6.4, -19], 0.4); wire(p3, [-7, 6.4, 19], 0.4); wire(p2, [7, 6.4, -19], 0.5);
    // front yards: picket fences, hedges, shrubs, the cypress trees and a yucca
    picketX(-18.6, -3.3, 15.3); picketX(0.4, 7.2, 15.3); picketZ(15.3, 18.6, -18.6);
    hedge(-8.6, -16.2, -4.5, -16.2, 0.9); hedge(0.6, -16.2, 6.4, -16.2, 0.9);
    cypress(8.6, -16.8, 5.5); cypress(8.6, -20.5, 5); cypress(-18.2, 17.2, 4.6);
    yucca(10.5, -12.5, 1.2); yucca(-18, -14, 1);
    bush(15.5, -13, 0.9); bush(-8.8, 16.8, 0.8); bush(15.8, 16.5, 1);
    L.box(10.4, 0, -25.6, 11.8, 1.5, -24.1, 'paintGreen'); deco(10.2, 0, -25.8, 12, 0.12, -23.9, 'concrete'); // transformer
    // side and back yards
    woodpile(13.8, 21, 15.8, 24, 1.3); tires(15.6, 28.5, 4);
    L.box(-18.2, 0, 38.4, -14.2, 2.3, 42.4, 'sidingTeal'); gableRoof(-16.2, 40.4, 4, 4, 2.3, 1.1, 'sidingTeal', 'roofGray');
    L.box(10.2, 0, -42.6, 14.4, 2.3, -38.6, 'boardYellow'); gableRoof(12.3, -40.6, 4.2, 4, 2.3, 1.1, 'boardYellow', 'roofGray');
    deco(-16.8, 0, 38.35, -15.6, 2, 38.4, 'woodDark'); deco(11.8, 0, -38.6, 13, 2, -38.55, 'woodDark');
    // clothesline with sheets in the green yard
    for (const x of [5, 13]) { L.pipe('chrome', x, 0, 38.5, x, 2.3, 38.5, 0.04); L.pipe('chrome', x, 2.2, 38.2, x, 2.2, 38.8, 0.03); solid(x - 0.08, 0, 38.42, x + 0.08, 2.3, 38.58, 'metal'); }
    for (const zz of [38.25, 38.75]) L.pipe('rubber', 5, 2.2, zz, 13, 2.2, zz, 0.01);
    const sheet = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9, side: THREE.DoubleSide });
    for (const [x, zz] of [[7, 38.25], [9.4, 38.75], [11.3, 38.25]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), sheet); m.position.set(x, 1.6, zz); m.castShadow = true; L.scene.add(m); }
    tree(-9, -38.5, 3.2, 2.1, 5); tree(6, 40.5, 3.4, 2.2, 9); bush(-17.6, -37.5, 1); bush(15, 32.6, 1.1);
    tires(-10, -41.5, 3); L.box(2, 0, -42.6, 4, 0.8, -41.4, 'wood'); // doghouse-sized crate
    mannequin(-5.2, 0, 16.4, false); mannequin(2.6, 0.05, 7.6, true); mannequin(-13, 0, -21.6, false); mannequin(9.2, 0.1, 22.4, true);

    // boundary: backyard board fences, hedges by the street, invisible walls just outside
    woodFenceX(-19.4, 17.4, -43.6, 1.9); woodFenceX(-19.4, 17.4, 43.6, 1.9);
    woodFenceZ(-43.6, -9.4, -19.4, 1.9); woodFenceZ(9.4, 43.6, -19.4, 1.9);
    woodFenceZ(-43.6, -16.5, 17.4, 1.9); woodFenceZ(16.5, 43.6, 17.4, 1.9);
    hedge(17.6, -16, 17.6, -8.2, 1.2); hedge(17.6, 8.2, 17.6, 16, 1.2);
    const inv = (x0, z0, x1, z1) => L.box(x0, 0, z0, x1, 30, z1, 'trim', { noMesh: true });
    inv(-20, -44.5, 18.5, -43.7); inv(-20, 43.7, 18.5, 44.5);
    inv(-20.4, -44.5, -19.5, -9.2); inv(-20.4, 9.2, -19.5, 44.5); inv(-22.2, -9.8, -19.5, -9.2); inv(-22.2, 9.2, -19.5, 9.8);
    inv(17.5, -44.5, 18.5, -5.6); inv(17.5, 5.6, 18.5, 44.5); inv(19.6, -6, 20.6, 6); inv(17.5, -6, 20.6, -5.6); inv(17.5, 5.6, 20.6, 6);

    // the rest of the street (out of bounds)
    ranchHouse(24, -24, 36, -12, 1, 'stucco', 'roofGray', 'paintMint');
    ranchHouse(42, -24, 54, -12, 1, 'sidingBlue', 'roofGray');
    ranchHouse(24, 12, 36, 24, -1, 'boardBrown', 'roofing', 'paintBlue');
    ranchHouse(42, 12, 54, 24, -1, 'sidingWhite', 'roofGray');
    picketX(21, 23.6, -8.2); picketX(37, 41, -8.2); picketX(21, 23.6, 8.2);
    woodFenceX(-42, 74, -46, 1.6); woodFenceX(-42, 74, 46, 1.6); woodFenceZ(-46, 46, -42, 1.6); woodFenceZ(-46, 46, 74, 1.6);
    tree(40, -30, 3.6, 2.4, 3); tree(58, 30, 3.4, 2.2, 4); tree(-38, -30, 3, 2, 6); tree(-38, 32, 3.2, 2, 8); pine(62, -32, 8); pine(-40, 0, 9);

    // desert: rocks, sagebrush, joshua trees, transmission towers, mountains, a rainbow
    const rnd = U.mulberry32(1955);
    for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, r = 55 + rnd() * 110, x = Math.cos(a) * r + 16, z = Math.sin(a) * r; const s = 0.4 + rnd() * rnd() * 2.5; put('rock', blobGeo(i % 3), x, s * 0.3, z, s * (1 + rnd()), s * 0.7, s, rnd() * 6); }
    for (let i = 0; i < 160; i++) { const a = rnd() * Math.PI * 2, r = 50 + rnd() * 120, s = 0.3 + rnd() * 0.5; put('dryBrush', blobGeo(i % 3), Math.cos(a) * r + 16, s * 0.4, Math.sin(a) * r, s, s * 0.6, s, rnd() * 6); }
    for (let i = 0; i < 24; i++) { const a = rnd() * Math.PI * 2, r = 55 + rnd() * 90; joshua(Math.cos(a) * r + 16, Math.sin(a) * r, rnd); }
    for (const [x, z] of [[-70, -80], [90, -110], [130, 60], [-100, 90]]) latticeTower(x, z, 28, 7, 2, 'steel');
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2 + rnd() * 0.25, r = 230 + rnd() * 80; put('mesa', blobGeo(i % 3), Math.cos(a) * r, -10, Math.sin(a) * r, 50 + rnd() * 45, 30 + rnd() * 45, 40 + rnd() * 30, rnd() * 3); }
    const rb = new THREE.Mesh(new THREE.RingGeometry(190, 222, 96, 1, 0, Math.PI), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vP; vec3 hue(float t){ return clamp(abs(mod(t * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); } void main(){ float t = (length(vP) - 190.0) / 32.0; float edge = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.85, t); float fade = smoothstep(0.0, 60.0, vP.y); gl_FragColor = vec4(hue(0.8 - t * 0.8) * 0.22 * edge * fade, 1.0); }'
    }));
    rb.position.set(-330, -40, -60); rb.rotation.y = Math.PI / 2; rb.renderOrder = -5; L.scene.add(rb);

    // spawns [x, y, z] and pickups
    const north = [[-15.5, 0.02, -40], [-6, 0.02, -41], [5, 0.02, -41.5], [15, 0.02, -34], [-16, 0.02, -34]];
    const south = [[-10, 0.02, 40.5], [-3, 0.02, 41], [3, 0.02, 41.5], [15, 0.02, 36], [-16, 0.02, 34]];
    L.spawns.t0 = north; L.spawns.t1 = south;
    L.spawns.ffa = north.concat(south, [[17, 0.05, -3], [-20.6, 0.05, 2], [14.2, 0.02, -14.8], [-17, 0.02, 20]]);
    L.addPickup('armor', -5.5, F, -24); L.addPickup('armor', -3.5, F, 22.5);
    L.addPickup('ammo', -11.2, 0.05, -21); L.addPickup('ammo', 11.2, 0.1, 25.5); L.addPickup('ammo', 1.2, 0.05, 8.6); L.addPickup('ammo', -19.5, 0.08, -5);
    L.points.start = { x: 0, y: 0.02, z: -40, yaw: Math.PI };
    // the RC-XD chest: the lane between the school bus and the moving truck, equally far from both teams' spawns
    L.points.rcChest = { x: -1.5, y: 0.02, z: 0, yaw: 0.25 };
    L.killY = -10;
  };
})(window.CF);
