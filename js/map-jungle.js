'use strict';
/* Cinderfall — the Song Lam valley, 1968 (Campaign: Green Hell). X east, Z south, Y up.
   South-west: LZ Falcon in the elephant grass. West: the trail north past the stream ford to Copperhead's last position.
   Centre: the hamlet of Ap Lo and its rice paddies. North-west: the hollow hill and the tunnels under it (walled off,
   reached through the trapdoor). East: the Song Lam river, from the south pier up to Firebase Kestrel on its hill
   (north-east). South-east: the infiltration trail to the river ford (the night ambush).
   The ground is a heightfield: one smooth mesh to look at, a grid of boxes (1 m, merged along rows) to stand on.
   Foliage is alpha-cut leaf cards in a few batches; it stops nothing, but a density grid (MJ.veil) lets it hide people. */
(function (CF) {
  const L = CF.Level, W = CF.World, U = CF.U;
  const PI = Math.PI;
  const MJ = CF.MapJungle = {};
  const B = { minX: -140, maxX: 140, minZ: -140, maxZ: 140 };
  MJ.B = B;

  // ---------------------------------------------------------------- layout
  const LZ = { x: -95, z: 95, r: 24 };
  const VILLAGE = { x: 5, z: -5, r: 34 };
  const HILL = { x: 58, z: -92, top: 5, r0: 17, r1: 34 };
  const TUN = { x0: -138, z0: -138, x1: -84, z1: -100 };   // the tunnel complex (roofed, walled off)
  const RIDGE = { x0: -140, z0: -140, x1: -78, z1: -94 };  // the hollow hill over it
  const RIVER = [[112, -150], [108, -100], [104, -60], [110, -20], [116, 20], [110, 60], [102, 100], [108, 150]];
  const RIVER_W = 10.5, RIVER_BED = -1.05, WATER_Y = -0.38;
  const STREAM = [[-150, 8], [-112, 15], [-88, 20], [-66, 17], [-46, 26], [-26, 36]];
  const TRAILS = {
    lz: [[-95, 78], [-98, 60], [-92, 40], [-88, 21], [-90, 6], [-82, -12], [-78, -25], [-62, -32], [-45, -28], [-30, -18], [-18, -10]],
    ambush: [[28, 145], [34, 112], [46, 92], [57, 74], [70, 59], [86, 51], [98, 48]],
    road: [[93, -70], [84, -76], [74, -84], [66, -89]],
    paddy: [[30, -2], [52, -2], [74, -2]]
  };
  // paddy blocks: [x0, z0, x1, z1]; dikes run round and through them
  const PADDIES = [[32, -34, 52, -8], [32, -4, 52, 26], [56, -34, 76, -8], [56, -4, 76, 26], [-18, 24, 6, 50], [10, 24, 30, 50]];
  MJ.LZ = LZ; MJ.VILLAGE = VILLAGE; MJ.HILL = HILL; MJ.TUN = TUN; MJ.RIVER = RIVER; MJ.WATER_Y = WATER_Y; MJ.TRAILS = TRAILS;

  /** Distance from (x, z) to a polyline, and how far along it (0..1 over the whole line). */
  function lineDist(pts, x, z) {
    let best = Infinity, at = 0, run = 0, total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], az = pts[i - 1][1], bx = pts[i][0], bz = pts[i][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, seg = Math.sqrt(l2);
      const t = U.clamp(((x - ax) * dx + (z - az) * dz) / (l2 || 1), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; at = (run + seg * t) / total; }
      run += seg;
    }
    return { d: best, t: at };
  }
  MJ.lineDist = lineDist;
  /** Centre of the river at a given z (it never doubles back). */
  MJ.riverX = function (z) {
    for (let i = 1; i < RIVER.length; i++) { const a = RIVER[i - 1], b = RIVER[i]; if (z >= a[1] && z <= b[1]) return U.lerp(a[0], b[0], (z - a[1]) / (b[1] - a[1])); }
    return RIVER[RIVER.length - 1][0];
  };
  const inPaddy = (x, z) => PADDIES.some((p) => x > p[0] && x < p[2] && z > p[1] && z < p[3]);
  const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

  /** Ground height (collision). Flat jungle floor at 0; the firebase hill, the river and stream beds, the paddies. */
  function height(x, z) {
    if (inRect(TUN, x, z)) return 0;
    let h = 0;
    const dh = Math.hypot(x - HILL.x, z - HILL.z);
    if (dh < HILL.r1) h = HILL.top * U.smoothstep(HILL.r1, HILL.r0, dh);
    const rx = MJ.riverX(z), rd = Math.abs(x - rx);
    if (rd < RIVER_W + 5) h = Math.min(h, RIVER_BED * U.smoothstep(RIVER_W + 5, RIVER_W - 1, rd));
    const sd = lineDist(STREAM, x, z).d;
    if (sd < 4) h = Math.min(h, -0.45 * U.smoothstep(4, 1.2, sd));
    if (inPaddy(x, z)) {
      const p = PADDIES.find((q) => x > q[0] && x < q[2] && z > q[1] && z < q[3]);
      const edge = Math.min(x - p[0], p[2] - x, z - p[1], p[3] - z);
      h = edge < 0.9 ? 0.3 : -0.18;
    }
    return h;
  }
  MJ.height = height;
  /** How much a spot is jungle (0 = open ground, 1 = deep forest): what the tree and bush scatter follows. */
  function jungle(x, z) {
    let k = 1;
    const clear = (cx, cz, r, soft) => { const d = Math.hypot(x - cx, z - cz); k = Math.min(k, U.smoothstep(r, r + (soft || 6), d)); };
    clear(LZ.x, LZ.z, LZ.r, 5); clear(VILLAGE.x, VILLAGE.z, VILLAGE.r - 6, 8); clear(HILL.x, HILL.z, HILL.r1 + 2, 4);
    clear(-78, -25, 8, 4); // Copperhead's clearing (a bomb crater)
    const rd = Math.abs(x - MJ.riverX(z)); k = Math.min(k, U.smoothstep(RIVER_W + 1, RIVER_W + 6, rd));
    k = Math.min(k, U.smoothstep(2.2, 5, lineDist(STREAM, x, z).d));
    for (const p of PADDIES) if (x > p[0] - 3 && x < p[2] + 3 && z > p[1] - 3 && z < p[3] + 3) k = 0;
    if (inRect(TUN, x, z)) k = 0;
    if (x > 88 && x < 100 && z > 118 && z < 132) k = 0; // the south pier
    return k;
  }
  MJ.jungle = jungle;
  function trailDist(x, z) { let d = Infinity; for (const k in TRAILS) d = Math.min(d, lineDist(TRAILS[k], x, z).d); return d; }

  // ---------------------------------------------------------------- materials
  let TEX = null;
  function canvas(w, h) { const c = CF.Tex.util.makeCanvas(w, h); return [c, c.getContext('2d')]; }
  function leafTex(kind, seed) {
    const rnd = U.mulberry32(seed), [c, x] = canvas(256, 256);
    const leaf = (cx, cy, len, wid, a, col) => {
      x.save(); x.translate(cx, cy); x.rotate(a);
      x.fillStyle = col; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(wid, -len * 0.45, 0, -len); x.quadraticCurveTo(-wid, -len * 0.45, 0, 0); x.fill();
      x.strokeStyle = 'rgba(30,45,15,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -len * 0.92); x.stroke();
      x.restore();
    };
    const green = (l) => { const h = 80 + rnd() * 40, s = 35 + rnd() * 30; return 'hsl(' + h + ',' + s + '%,' + (l + rnd() * 14) + '%)'; };
    if (kind === 'canopy' || kind === 'bush') {
      const big = kind === 'canopy';
      for (let i = 0; i < (big ? 120 : 150); i++) {
        const a = rnd() * PI * 2, r = Math.sqrt(rnd()) * (big ? 100 : 104), cx = 128 + Math.cos(a) * r, cy = 128 + Math.sin(a) * r * 0.85;
        leaf(cx, cy, big ? 30 + rnd() * 26 : 18 + rnd() * 16, big ? 10 + rnd() * 8 : 7 + rnd() * 5, rnd() * PI * 2, green(14 + (1 - r / 104) * 14));
      }
    } else if (kind === 'fern') {
      for (let f = 0; f < 7; f++) {
        const a = -PI / 2 + (f - 3) * 0.32, len = 180 + rnd() * 50;
        x.strokeStyle = 'hsl(95,40%,22%)'; x.lineWidth = 2;
        for (let s = 0; s < 26; s++) {
          const k = s / 26, bend = a + k * 0.35 * (f - 3) / 3, px = 128 + Math.cos(a) * len * k + Math.sin(k * 2) * 6 * (f - 3), py = 250 + Math.sin(bend) * len * k;
          const l = 22 * (1 - k * 0.7);
          leaf(px, py, l, 4, bend + PI / 2 + 0.9, green(20)); leaf(px, py, l, 4, bend - PI / 2 - 0.9 + PI, green(18));
        }
      }
    } else if (kind === 'grass') {
      for (let i = 0; i < 90; i++) {
        const bx = 8 + rnd() * 240, h = 150 + rnd() * 100, lean = (rnd() - 0.5) * 70, w = 3 + rnd() * 4;
        x.fillStyle = 'hsl(' + (60 + rnd() * 30) + ',' + (30 + rnd() * 25) + '%,' + (28 + rnd() * 22) + '%)';
        x.beginPath(); x.moveTo(bx - w, 256); x.quadraticCurveTo(bx + lean * 0.3, 256 - h * 0.6, bx + lean, 256 - h); x.quadraticCurveTo(bx + lean * 0.3 + 1, 256 - h * 0.6, bx + w, 256); x.fill();
      }
    } else if (kind === 'banana') {
      // one big torn leaf, stem at the bottom
      x.fillStyle = 'hsl(88,48%,30%)'; x.beginPath(); x.moveTo(128, 256); x.bezierCurveTo(250, 170, 210, 30, 128, 2); x.bezierCurveTo(46, 30, 6, 170, 128, 256); x.fill();
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9; i++) { const y = 40 + i * 22 + rnd() * 10, s = rnd() < 0.5 ? 1 : -1; x.beginPath(); x.moveTo(128 + s * 40, y); x.lineTo(128 + s * 140, y - 8); x.lineTo(128 + s * 140, y + 2); x.closePath(); x.fill(); }
      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = 'hsl(70,40%,52%)'; x.lineWidth = 4; x.beginPath(); x.moveTo(128, 256); x.lineTo(128, 6); x.stroke();
    } else if (kind === 'palm') {
      x.strokeStyle = 'hsl(70,30%,30%)'; x.lineWidth = 3; x.beginPath(); x.moveTo(128, 256); x.lineTo(128, 0); x.stroke();
      for (let s = 0; s < 40; s++) { const y = 250 - s * 6.2, l = 100 * Math.sin((s / 40) * PI) + 12; for (const d of [-1, 1]) { x.strokeStyle = green(22); x.lineWidth = 3; x.beginPath(); x.moveTo(128, y); x.lineTo(128 + d * l, y - 20); x.stroke(); } }
    }
    const t = CF.Tex.util.toTex(c, { repeat: false });
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  MJ.leafTex = leafTex; MJ.foliageMat = (tex, color, sway) => { swayTime = swayTime || { value: 0 }; return foliageMat(tex, color, sway); }; // shared with the Western Front
  MJ.swayTick = (t) => { if (swayTime) swayTime.value = t; };
  function textures() {
    if (TEX) return TEX;
    const T = CF.Tex.util, S = Math.min(512, T.size()), n = S * S, sstep = U.smoothstep;
    TEX = { canopy: leafTex('canopy', 11), bush: leafTex('bush', 12), fern: leafTex('fern', 13), grass: leafTex('grass', 14), banana: leafTex('banana', 15), palm: leafTex('palm', 16) };
    // forest floor: leaf litter and soil; tinted per vertex by the terrain (grass, mud, trail, laterite)
    {
      const n1 = T.tileNoise(S, 6, 6, 5, 8101, 0.55), n2 = T.tileNoise(S, 32, 32, 3, 8102), n3 = T.tileNoise(S, 96, 96, 1, 8103);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const v = 0.62 + (n1[i] - 0.5) * 0.35 + (n2[i] - 0.5) * 0.2 + (n3[i] - 0.5) * 0.12, leafy = sstep(0.55, 0.7, n2[i]);
        rgb[i * 3] = v * (1 - leafy * 0.1); rgb[i * 3 + 1] = v * (0.95 + leafy * 0.05); rgb[i * 3 + 2] = v * 0.82;
        hgt[i] = n1[i] * 0.4 + n2[i] * 0.4 + n3[i] * 0.2; rough[i] = 0.95;
      }
      TEX.soil = T.pack(rgb, hgt, rough, 1.6, S);
    }
    // split bamboo, woven
    {
      const n1 = T.tileNoise(S, 4, 32, 3, 8111), rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, col = (x / (S / 16)) | 0, cx = (x % (S / 16)) / (S / 16), node = ((y + col * 37) % (S / 3)) < 4;
        const v = (0.7 + n1[i] * 0.25) * (0.75 + 0.25 * Math.sin(cx * PI)) * (node ? 0.7 : 1);
        rgb[i * 3] = v * 0.86; rgb[i * 3 + 1] = v * 0.74; rgb[i * 3 + 2] = v * 0.48;
        hgt[i] = Math.sin(cx * PI) * 0.8 - (node ? 0.3 : 0); rough[i] = 0.8;
      }
      TEX.bamboo = T.pack(rgb, hgt, rough, 2.5, S);
    }
    // thatch: layered straw
    {
      const n1 = T.tileNoise(S, 64, 4, 3, 8121), n2 = T.tileNoise(S, 8, 8, 3, 8122), rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const y = (i / S) | 0, band = (y % (S / 8)) / (S / 8), v = (0.5 + n1[i] * 0.45) * (0.65 + band * 0.35) * (0.85 + n2[i] * 0.2);
        rgb[i * 3] = v * 0.78; rgb[i * 3 + 1] = v * 0.66; rgb[i * 3 + 2] = v * 0.42;
        hgt[i] = n1[i] * 0.6 + band * 0.4; rough[i] = 0.95;
      }
      TEX.thatch = T.pack(rgb, hgt, rough, 3, S);
    }
    // packed earth (tunnel walls, mud walls): clay with roots and pick marks
    {
      const n1 = T.tileNoise(S, 4, 4, 5, 8131, 0.55), n2 = T.tileNoise(S, 24, 24, 3, 8132), rnd = U.mulberry32(8133), roots = new Float32Array(n);
      for (let k = 0; k < 30; k++) { let x = rnd() * S, y = rnd() * S, a = rnd() * PI * 2; for (let s = 0; s < 60; s++) { roots[((y | 0) % S + S) % S * S + ((x | 0) % S + S) % S] = 1; a += (rnd() - 0.5) * 0.5; x += Math.cos(a); y += Math.sin(a); } }
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const v = 0.55 + (n1[i] - 0.5) * 0.3 + (n2[i] - 0.5) * 0.15 - roots[i] * 0.2;
        rgb[i * 3] = v; rgb[i * 3 + 1] = v * 0.78; rgb[i * 3 + 2] = v * 0.58;
        hgt[i] = n1[i] * 0.5 + n2[i] * 0.4 + roots[i] * 0.3; rough[i] = 0.97;
      }
      TEX.earth = T.pack(rgb, hgt, rough, 2.4, S);
    }
    // pierced steel planking (the firebase helipad)
    {
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n), n1 = T.tileNoise(S, 8, 8, 3, 8141);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, cx = (x % (S / 8)) / (S / 8), cy = (y % (S / 4)) / (S / 4);
        const hole = Math.hypot(cx - 0.5, (cy - 0.5) * 2) < 0.28, seam = cy < 0.04;
        const v = hole ? 0.12 : (0.5 + n1[i] * 0.25) * (seam ? 0.6 : 1);
        rgb[i * 3] = v * 0.9; rgb[i * 3 + 1] = v * 0.88; rgb[i * 3 + 2] = v * 0.8;
        hgt[i] = hole ? 0 : seam ? 0.4 : 0.8; rough[i] = hole ? 1 : 0.6;
      }
      TEX.psp = T.pack(rgb, hgt, rough, 2, S);
    }
    return TEX;
  }
  let swayTime = null;
  function foliageMat(tex, color, sway) {
    const m = new THREE.MeshStandardMaterial({ map: tex, color, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.25 });
    if (sway) {
      // a breath of wind: the tops of the cards (uv.y = 1) drift, the bases stay put
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uSway = swayTime;
        sh.vertexShader = 'uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n  float sw = uv.y * ' + sway.toFixed(3) + ';\n  transformed.x += sin(uSway * 1.3 + position.x * 0.35 + position.z * 0.2) * sw;\n  transformed.z += cos(uSway * 1.1 + position.z * 0.3) * sw * 0.7;');
      };
    }
    return m;
  }
  function materials() {
    const T = textures(), M = L.mats, CT = CF.Tex.list;
    swayTime = swayTime || { value: 0 };
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.4, roughness: 1, metalness: 0 }, o));
    const tri = (t, c) => ({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, color: c });
    M.leafCanopy = foliageMat(T.canopy, 0xd8e8c0, 0.18); M.leafBush = foliageMat(T.bush, 0xc8dcb0, 0.1); M.leafFern = foliageMat(T.fern, 0xd0e4b4, 0.12);
    M.leafFern.userData.noShadow = true; M.leafBush.userData.noShadow = true;
    M.leafGrass = foliageMat(T.grass, 0xe8f0c8, 0.22); M.leafGrass.userData.noShadow = true; M.leafBanana = foliageMat(T.banana, 0xd8ecc0, 0.14); M.leafPalm = foliageMat(T.palm, 0xd0e0b0, 0.25);
    M.bark = std(tri(CT.planks, 0x6a5a48)); M.barkPale = std(tri(CT.planks, 0x9a9078)); M.bambooStem = std(tri(T.bamboo, 0xb8c070));
    M.bamboo = std(tri(T.bamboo, 0xffffff)); M.thatch = std(tri(T.thatch, 0xffffff)); M.earth = std(tri(T.earth, 0xffffff)); M.earthDark = std(tri(T.earth, 0x8a7a6a));
    M.laterite = std(tri(T.earth, 0xd08a60)); M.mudWall = std(tri(T.earth, 0xc8b090)); M.psp = std(Object.assign(tri(T.psp, 0xffffff), { metalness: 0.4, envMapIntensity: 0.5 }));
    M.rockMoss = std(tri(CT.stone, 0x7a8468)); M.timber = std(tri(CT.planks, 0x7a6448)); M.ammoBox = std({ color: 0x4a5236, roughness: 0.7, metalness: 0.2 });
    M.canvasOD = std(tri(CT.carpet, 0x5c6440)); M.tinRoof = std(Object.assign(tri(CT.paintMetal, 0x8a8a80), { metalness: 0.5, roughness: 0.6 }));
    M.shrine = std(tri(CT.stone, 0xc8b8a0)); M.shrineRed = std({ color: 0x8a2a1c, roughness: 0.6 }); M.gunOD = std({ color: 0x3e4630, roughness: 0.55, metalness: 0.4 });
    M.wire = new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: 0.4, metalness: 0.9, envMapIntensity: 0.6 });
    M.flagRed = std({ color: 0xa82020, roughness: 0.8 });
    if (!M.sandbag) M.sandbag = std(tri(CT.carpet, 0xa8966c));
  }

  // ---------------------------------------------------------------- small builders
  const deco = (x0, y0, z0, x1, y1, z1, m, o) => L.box(x0, y0, z0, x1, y1, z1, m, Object.assign({ noCol: true, ao: false }, o || {}));
  const solid = (x0, y0, z0, x1, y1, z1, surf, o) => W.add(x0, y0, z0, x1, y1, z1, Object.assign({ surf: surf || 'concrete' }, o || {}));
  const noStand = (x0, y, z0, x1, z1) => W.add(x0, y, z0, x1, y + 30, z1, { shoot: false, nav: false });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _sc = new THREE.Vector3(), _ps = new THREE.Vector3();
  const mYXZ = (x, y, z, rx, ry, rz, sx, sy, sz) => { _eu.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_eu); _sc.set(sx, sy, sz); _ps.set(x, y, z); return _m.compose(_ps, _q, _sc).clone(); };
  let cardBase = null, cardMid = null, gable = null;
  /** Unit gable end: a triangle (-1,0) (1,0) (0,1), 6 cm thick. */
  const gableGeo = () => gable || (gable = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]), { depth: 0.06, bevelEnabled: false }).translate(0, 0, -0.03));
  const card = (base) => base ? (cardBase || (cardBase = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0))) : (cardMid || (cardMid = new THREE.PlaneGeometry(1, 1)));

  // concealment grid: how much foliage stands in each square metre (0..255), up to about head height
  let VEIL = null;
  const VW = B.maxX - B.minX, VH = B.maxZ - B.minZ;
  function dense(x, z, r, v) {
    const x0 = Math.max(0, Math.floor(x - r - B.minX)), x1 = Math.min(VW - 1, Math.ceil(x + r - B.minX)), z0 = Math.max(0, Math.floor(z - r - B.minZ)), z1 = Math.min(VH - 1, Math.ceil(z + r - B.minZ));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const d = Math.hypot(ix + B.minX + 0.5 - x, iz + B.minZ + 0.5 - z); if (d > r) continue;
      const i = iz * VW + ix; VEIL[i] = Math.min(255, VEIL[i] + v * (1 - d / r * 0.5));
    }
  }
  /** Foliage between two points (0 = clear, 1+ = you can't see through it). Skips the ends: you can see out of the bush you're in. */
  MJ.veil = function (ax, ay, az, bx, by, bz) {
    if (!VEIL) return 0;
    const len = Math.hypot(bx - ax, bz - az); if (len < 3) return 0;
    if (ay > 3.2 && by > 3.2) return 0;             // over the undergrowth (tree stands, the helicopter, the hill)
    const n = Math.ceil(len), high = (ay > 3.2 || by > 3.2) ? 0.5 : 1;
    let acc = 0;
    for (let i = 1; i < n; i++) {
      const t = i / n, s = t * len; if (s < 1.6 || len - s < 1.6) continue;
      const ix = Math.floor(ax + (bx - ax) * t - B.minX), iz = Math.floor(az + (bz - az) * t - B.minZ);
      if (ix < 0 || iz < 0 || ix >= VW || iz >= VH) continue;
      acc += VEIL[iz * VW + ix];
    }
    return acc / 255 * 0.6 * high;
  };
  MJ.veilAt = (x, z) => { if (!VEIL) return 0; const ix = Math.floor(x - B.minX), iz = Math.floor(z - B.minZ); return ix < 0 || iz < 0 || ix >= VW || iz >= VH ? 0 : VEIL[iz * VW + ix] / 255; };

  // ---------------------------------------------------------------- plants
  function canopyTree(x, z, rnd, o) {
    o = o || {};
    const h = o.h || 11 + rnd() * 9, r = 0.22 + rnd() * 0.18, lean = (rnd() - 0.5) * 0.12, la = rnd() * PI * 2, gy = height(x, z);
    const tx = x + Math.cos(la) * lean * h, tz = z + Math.sin(la) * lean * h;
    L.addGeo(rnd() < 0.35 ? 'barkPale' : 'bark', trunkGeo, mYXZ((x + tx) / 2, gy + h / 2, (z + tz) / 2, Math.sin(la) * lean, 0, -Math.cos(la) * lean, r, h, r));
    for (let i = 0; i < 3; i++) { const a = rnd() * PI * 2; L.addGeo('bark', trunkGeo, mYXZ(x + Math.cos(a) * r, gy + 0.4, z + Math.sin(a) * r, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, r * 0.45, 1.2, r * 0.45)); } // buttress roots
    W.addCyl(x, z, r + 0.05, gy - 0.5, gy + h * 0.7, { surf: 'wood' });
    // crown: crossed leaf cards in a few tiers
    const crown = o.crown || 4 + rnd() * 3.5, tiers = 3;
    for (let t = 0; t < tiers; t++) {
      const y = gy + h - crown * 0.35 + t * crown * 0.28, rr = crown * (1 - t * 0.22);
      for (let k = 0; k < 5; k++) {
        const a = rnd() * PI, s = rr * (1.4 + rnd() * 0.6), ox = (rnd() - 0.5) * rr * 0.8, oz = (rnd() - 0.5) * rr * 0.8;
        L.addGeo('leafCanopy', card(false), mYXZ(tx + ox, y, tz + oz, -PI / 2 + (rnd() - 0.5) * 0.5, a, 0, s, s, 1), 0.75 + rnd() * 0.35);
      }
      for (let k = 0; k < 3; k++) { const a = rnd() * PI; L.addGeo('leafCanopy', card(false), mYXZ(tx, y - 0.4, tz, 0, a, 0, rr * 1.6, rr * 0.9, 1), 0.7 + rnd() * 0.3); }
    }
    // a few hanging vines
    if (rnd() < 0.4) for (let k = 0; k < 2; k++) { const a = rnd() * PI * 2, vr = rnd() * crown * 0.6; L.addGeo('leafGrass', card(true), mYXZ(tx + Math.cos(a) * vr, gy + h - crown * 0.5 - 4, tz + Math.sin(a) * vr, PI, rnd() * PI, 0, 0.8, 4.5, 1), 0.6); }
    L.blob(x, z, 2.2, 2.2, gy);
    return { x, z, top: gy + h };
  }
  function bush(x, z, rnd, s, kind) {
    s = s || 1; kind = kind || (rnd() < 0.5 ? 'leafBush' : 'leafFern');
    const gy = height(x, z);
    const n = kind === 'leafFern' ? 4 : 5;
    for (let k = 0; k < n; k++) {
      const a = k / n * PI + rnd() * 0.4, w = (1.6 + rnd() * 1.2) * s, h = (kind === 'leafFern' ? 1.2 : 1.5 + rnd() * 0.8) * s;
      L.addGeo(kind, card(true), mYXZ(x + (rnd() - 0.5) * 0.6 * s, gy - 0.05, z + (rnd() - 0.5) * 0.6 * s, (rnd() - 0.5) * 0.25, a, 0, w, h, 1), 0.7 + rnd() * 0.35);
    }
    dense(x, z, 1.3 * s, kind === 'leafFern' ? 26 : 40);
  }
  function grassClump(x, z, rnd, s) {
    s = s || 1;
    const gy = height(x, z);
    for (let k = 0; k < 3; k++) L.addGeo('leafGrass', card(true), mYXZ(x + (rnd() - 0.5) * 0.8, gy - 0.05, z + (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.2, k / 3 * PI + rnd() * 0.5, 0, (1.4 + rnd() * 0.8) * s, (1.7 + rnd() * 0.6) * s, 1), 0.75 + rnd() * 0.35);
    dense(x, z, 1.1 * s, 34);
  }
  function banana(x, z, rnd) {
    const gy = height(x, z), h = 2.2 + rnd() * 1.2;
    L.addGeo('barkPale', trunkGeo, mYXZ(x, gy + h / 2, z, 0, 0, 0, 0.14, h, 0.14));
    for (let k = 0; k < 7; k++) { const a = k / 7 * PI * 2 + rnd() * 0.5; L.addGeo('leafBanana', card(true), mYXZ(x, gy + h - 0.2, z, -0.5 - rnd() * 0.6, a, 0, 0.9, 2.6, 1), 0.8 + rnd() * 0.3); }
    dense(x, z, 1.4, 30);
  }
  function palm(x, z, rnd, h) {
    h = h || 7 + rnd() * 5;
    const gy = height(x, z), lean = (rnd() - 0.5) * 0.4, la = rnd() * PI * 2;
    let px = x, pz = z, py = gy;
    for (let i = 0; i < 6; i++) { const seg = h / 6, k = i / 6, dx = Math.cos(la) * lean * seg * k, dz = Math.sin(la) * lean * seg * k; L.addGeo('barkPale', trunkGeo, mYXZ(px + dx / 2, py + seg / 2, pz + dz / 2, 0, 0, 0, 0.17 - k * 0.04, seg * 1.02, 0.17 - k * 0.04)); px += dx; pz += dz; py += seg; }
    for (let i = 0; i < 9; i++) L.addGeo('leafPalm', card(true), mYXZ(px, py, pz, -1.0 - rnd() * 0.5, i / 9 * PI * 2 + rnd() * 0.3, 0, 2.2, 3.6 + rnd(), 1), 0.8 + rnd() * 0.3);
    W.addCyl(x, z, 0.2, gy, gy + h, { surf: 'wood' });
  }
  function bamboo(x, z, rnd) {
    const gy = height(x, z);
    for (let i = 0; i < 9; i++) {
      const a = rnd() * PI * 2, r = rnd() * 0.9, h = 6 + rnd() * 5, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, tilt = 0.06 + rnd() * 0.12;
      L.addGeo('bambooStem', trunkGeo, mYXZ(bx + Math.cos(a) * h * tilt / 2, gy + h / 2, bz + Math.sin(a) * h * tilt / 2, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt, 0.05, h, 0.05));
      L.addGeo('leafGrass', card(false), mYXZ(bx + Math.cos(a) * h * tilt, gy + h - 0.6, bz + Math.sin(a) * h * tilt, 0.3, a, 0, 1.4, 1.6, 1), 0.8);
    }
    W.addCyl(x, z, 0.8, gy, gy + 6, { surf: 'wood' });
    dense(x, z, 1.6, 50);
  }
  MJ.bush = bush;

  // ---------------------------------------------------------------- terrain
  function terrainMesh() {
    const SEG = 200, size = B.maxX - B.minX;
    const g = new THREE.PlaneGeometry(size, size, SEG, SEG); g.rotateX(-PI / 2);
    const P = g.attributes.position, col = new Float32Array(P.count * 3), rnd = U.mulberry32(5150);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i);
      const h = height(x, z), jk = jungle(x, z), td = trailDist(x, z);
      // micro relief so the floor isn't billiard-flat (visual only, a few centimetres)
      const wob = inRect(TUN, x, z) ? -0.05 : (Math.sin(x * 0.37) * Math.cos(z * 0.29) + Math.sin(x * 0.11 + z * 0.17)) * 0.06 * (h === 0 ? 1 : 0.3);
      P.setY(i, h + wob);
      let r = 0.42, gg = 0.46, b = 0.24;                                              // jungle floor (green-brown)
      r = U.lerp(0.62, r, jk); gg = U.lerp(0.62, gg, jk); b = U.lerp(0.34, b, jk);   // open grass, paler
      if (Math.hypot(x - HILL.x, z - HILL.z) < HILL.r1 + 1) { r = 0.78; gg = 0.48; b = 0.3; } // laterite: the firebase's red dirt
      if (td < 1.8) { const k = U.smoothstep(1.8, 0.6, td); r = U.lerp(r, 0.66, k); gg = U.lerp(gg, 0.52, k); b = U.lerp(b, 0.36, k); }
      if (h < -0.1) { const k = U.clamp(-h / 0.6, 0, 1); r = U.lerp(r, 0.4, k); gg = U.lerp(gg, 0.36, k); b = U.lerp(b, 0.26, k); } // mud
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 14) { r = 0.7; gg = 0.58; b = 0.42; } // the packed yard
      const n = 0.9 + rnd() * 0.15;
      col[i * 3] = r * n; col[i * 3 + 1] = gg * n; col[i * 3 + 2] = b * n;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const T = textures();
    const m = new THREE.MeshStandardMaterial({ map: T.soil.map, normalMap: T.soil.normalMap, roughnessMap: T.soil.roughnessMap, vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.25 });
    for (const t of [m.map, m.normalMap, m.roughnessMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size / 5, size / 5); }
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    L.scene.add(mesh);
    // beyond the edge: the valley floor runs on under an unbroken canopy (seen from the helicopter)
    const outer = new THREE.Mesh(new THREE.RingGeometry(size * 0.5, 700, 4, 1, PI / 4).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c3a1c, roughness: 1 }));
    outer.scale.set(Math.SQRT2, 1, Math.SQRT2); outer.position.y = -0.05; L.scene.add(outer);
    const orng = U.mulberry32(77);
    for (let i = 0; i < 900; i++) {
      const a = orng() * PI * 2, r = 150 + Math.pow(orng(), 0.7) * 260, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 146 && Math.abs(z) < 146) continue;
      const s = 9 + orng() * 8, y = 9 + orng() * 8;
      L.addGeo('leafCanopy', card(false), mYXZ(x, y, z, -PI / 2 + (orng() - 0.5) * 0.4, orng() * PI, 0, s, s, 1), 0.55 + orng() * 0.3);
      L.addGeo('leafCanopy', card(false), mYXZ(x, y - 2, z, 0, orng() * PI, 0, s, s * 0.6, 1), 0.5 + orng() * 0.3);
    }
    // water: the river and the paddies (flat sheets; the river gets a slow-moving ripple)
    const wm = MJ.waterMat = new THREE.MeshStandardMaterial({ color: 0x1e2614, roughness: 0.22, metalness: 0.1, envMapIntensity: 0.45, transparent: true, opacity: 0.9, depthWrite: false });
    const rmesh = new THREE.Mesh(new THREE.BufferGeometry(), wm);
    // build the river sheet as a strip that follows the centreline
    const pos = [], idx = [];
    for (let z = B.minZ - 10, k = 0; z <= B.maxZ + 10; z += 5, k++) {
      const cx = MJ.riverX(z), w = RIVER_W + 3;
      pos.push(cx - w, WATER_Y, z, cx + w, WATER_Y, z);
      if (k) { const a = (k - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    rmesh.geometry = rg; rmesh.renderOrder = 3; L.scene.add(rmesh);
    for (const p of PADDIES) {
      const pw = new THREE.Mesh(new THREE.PlaneGeometry(p[2] - p[0] - 1.8, p[3] - p[1] - 1.8).rotateX(-PI / 2), wm);
      pw.position.set((p[0] + p[2]) / 2, -0.06, (p[1] + p[3]) / 2); pw.renderOrder = 3; L.scene.add(pw);
    }
    // the stream: a narrow sheet along its line
    const sp = [], si = [];
    for (let i = 0; i < STREAM.length; i++) {
      const a = STREAM[Math.max(0, i - 1)], b = STREAM[Math.min(STREAM.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 2.4, nz = dx / l * 2.4;
      sp.push(STREAM[i][0] + nx, -0.2, STREAM[i][1] + nz, STREAM[i][0] - nx, -0.2, STREAM[i][1] - nz);
      if (i) { const k = (i - 1) * 2; si.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
    const smesh = new THREE.Mesh(sg, wm); smesh.renderOrder = 3; L.scene.add(smesh);
  }
  /** Collision for the ground: 1 m cells, heights rounded to 5 cm, merged along each row into long boxes. */
  function terrainBoxes() {
    for (let iz = 0; iz < VH; iz++) {
      let run = null;
      const flush = () => { if (run) { W.add(run.x0, -3, iz + B.minZ, run.x1, run.h, iz + B.minZ + 1, { surf: run.h < -0.1 ? 'dirt' : 'dirt' }); run = null; } };
      for (let ix = 0; ix < VW; ix++) {
        const x = ix + B.minX, z = iz + B.minZ, h = Math.round(height(x + 0.5, z + 0.5) * 20) / 20;
        if (run && run.h === h) run.x1 = x + 1;
        else { flush(); run = { x0: x, x1: x + 1, h }; }
      }
      flush();
    }
  }

  // ---------------------------------------------------------------- set pieces
  /** A hootch: woven bamboo walls on a low earth plinth, a thatched gable roof, one door. Returns its door spot. */
  function hootch(cx, cz, w, d, ry, rnd, o) {
    o = o || {};
    // build axis-aligned in local space, then the few rotations we use are multiples of 90 degrees
    const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const box = (lx0, y0, lz0, lx1, y1, lz1, m, opt) => {
      const a = P(lx0, lz0), b = P(lx1, lz1);
      return L.box(Math.min(a[0], b[0]), y0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y1, Math.max(a[1], b[1]), m, opt);
    };
    const hw = w / 2, hd = d / 2, H = 2.1, t = 0.12;
    box(-hw - 0.2, 0, -hd - 0.2, hw + 0.2, 0.15, hd + 0.2, 'mudWall', { surf: 'dirt' });
    box(-hw, 0.15, -hd, hw, H, -hd + t, 'bamboo');                         // back
    box(-hw, 0.15, -hd + t, -hw + t, H, hd - t, 'bamboo');                   // sides
    box(hw - t, 0.15, -hd + t, hw, H, hd - t, 'bamboo');
    const dw = 0.55;                                                           // front, with the door
    box(-hw, 0.15, hd - t, -dw, H, hd, 'bamboo'); box(dw, 0.15, hd - t, hw, H, hd, 'bamboo'); box(-dw, 1.95, hd - t, dw, H, hd, 'bamboo');
    if (o.window !== false) { box(-hw + 0.01, 1.0, -0.4, -hw + t - 0.01, 1.5, 0.4, 'bamboo', { noCol: true, noMesh: true }); }
    // posts at the corners
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) { const p = P(lx, lz); L.addGeo('timber', L.geo('cylLo'), mYXZ(p[0], H / 2 + 0.3, p[1], 0, 0, 0, 0.09, H + 0.6, 0.09)); }
    // thatched roof: two slopes and gables, overhanging; no collision (you can't get up there)
    const ov = 0.6, rh = 1.5, slope = Math.atan2(rh, hw + ov), sl = Math.hypot(rh, hw + ov);
    for (const sd of [-1, 1]) {
      const p = P(sd * (hw + ov) / 2, 0);
      L.addGeo('thatch', L.geo('box'), mYXZ(p[0], H + rh / 2 - 0.05, p[1], 0, ry, -sd * slope, sl + 0.1, 0.18, d + ov * 2));
    }
    for (const sd of [-1, 1]) { const p = P(0, sd * (hd - 0.06)); L.addGeo('bamboo', gableGeo(), mYXZ(p[0], H, p[1], 0, ry, 0, hw, rh, 1)); }
    const top = P(0, 0); L.addGeo('timber', L.geo('cylLo'), mYXZ(top[0], H + rh, top[1], PI / 2, ry, 0, 0.07, d + ov * 2, 0.07));
    noStand(cx - Math.max(hw, hd) - 0.8, H, cz - Math.max(hw, hd) - 0.8, cx + Math.max(hw, hd) + 0.8, cz + Math.max(hw, hd) + 0.8);
    // inside: a sleeping platform and a jar
    if (o.inside !== false) {
      box(-hw + t, 0.15, -hd + t, -hw + 1.3, 0.55, -hd + 2.0, 'timber');
      const j = P(hw - 0.5, -hd + 0.5); L.cyl('mudWall', j[0], 0.45, j[1], 0.25, 0.6);
    }
    L.blob(cx, cz, w + 1.5, d + 1.5);
    const door = P(0, hd + 1.2);
    return { x: door[0], z: door[1], cx, cz };
  }
  function sandbags(x0, z0, x1, z1, h, y) {
    h = h || 1.1; y = y || 0;
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    deco(x0, y, z0, x1, y + h, z1, 'sandbag', { ao: true });
    for (let k = y + 0.28; k < y + h; k += 0.28) deco(alongX ? x0 : x0 - 0.02, k - 0.02, alongX ? z0 - 0.02 : z0, alongX ? x1 : x1 + 0.02, k, alongX ? z1 + 0.02 : z1, 'sandbag');
    solid(Math.min(x0, x1), y - 0.5, Math.min(z0, z1), Math.max(x0, x1), y + h, Math.max(z0, z1), 'concrete');
  }
  MJ.sandbags = sandbags;
  /** Firebase bunker: sandbag walls, a timber and sandbag roof you can stand on, a firing slit facing out, open at the back. */
  function bunker(x, z, face, y) {
    const fx = Math.round(Math.cos(face)), fz = Math.round(Math.sin(face)), H = 1.7, t = 0.6, hw = 2, hd = 1.5;
    // o runs outward, a runs across
    const rect = (o0, o1, a0, a1) => { const xa = x + fx * o0 - fz * a0, za = z + fz * o0 + fx * a0, xb = x + fx * o1 - fz * a1, zb = z + fz * o1 + fx * a1; return [Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]; };
    const wall = (r, slit) => {
      if (!slit) { sandbags(r[0], r[1], r[2], r[3], H, y); return; }
      sandbags(r[0], r[1], r[2], r[3], 1.05, y);
      deco(r[0], y + 1.4, r[1], r[2], y + H, r[3], 'sandbag'); solid(r[0], y + 1.4, r[1], r[2], y + H, r[3]);
    };
    wall(rect(hd - t, hd, -hw, hw), true);
    wall(rect(-hd, hd - t, -hw, -hw + t), false); wall(rect(-hd, hd - t, hw - t, hw), false);
    const r = rect(-hd - 0.3, hd + 0.3, -hw - 0.3, hw + 0.3);
    L.box(r[0], y + H, r[1], r[2], y + H + 0.22, r[3], 'timber');
    deco(r[0] + 0.1, y + H + 0.22, r[1] + 0.1, r[2] - 0.1, y + H + 0.6, r[3] - 0.1, 'sandbag', { ao: true }); solid(r[0] + 0.1, y + H + 0.22, r[1] + 0.1, r[2] - 0.1, y + H + 0.6, r[3] - 0.1);
  }
  /** A 105 mm howitzer on its trail legs. */
  function howitzer(x, z, ry, y) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const at = (lx, lz) => P(lx, lz);
    let p = at(0, 0); L.addGeo('gunOD', L.geo('box'), mYXZ(p[0], y + 0.9, p[1], 0, ry, 0, 0.9, 0.5, 1.3));
    p = at(0, -1.6); L.addGeo('gunOD', L.geo('cylLo'), mYXZ(p[0], y + 1.25, p[1], PI / 2 - 0.25, ry, 0, 0.09, 3.2, 0.09));
    p = at(0, -0.3); L.addGeo('gunOD', L.geo('cylLo'), mYXZ(p[0], y + 1.15, p[1], PI / 2 - 0.25, ry, 0, 0.16, 1.2, 0.16));
    for (const sd of [-1, 1]) { p = at(sd * 0.75, 0.1); L.addGeo('rubber', L.geo('cylLo'), mYXZ(p[0], y + 0.45, p[1], 0, ry, PI / 2, 0.45, 0.25, 0.45)); p = at(sd * 0.5, 1.6); L.addGeo('gunOD', L.geo('box'), mYXZ(p[0], y + 0.35, p[1], 0, ry + sd * 0.25, 0, 0.14, 0.14, 2.4)); }
    p = at(0, -0.1); L.addGeo('gunOD', L.geo('box'), mYXZ(p[0], y + 1.1, p[1], 0, ry, 0, 1.3, 0.8, 0.06)); // shield
    solid(x - 1.1, y, z - 1.1, x + 1.1, y + 1.4, z + 1.1, 'metal');
  }
  function crate(x, z, y, s, ry) { s = s || 0.9; L.addGeo('ammoBox', L.geo('box'), mYXZ(x, (y || 0) + s * 0.3, z, 0, ry || 0, 0, s * 1.2, s * 0.6, s * 0.7)); solid(x - s * 0.6, y || 0, z - s * 0.6, x + s * 0.6, (y || 0) + s * 0.6, z + s * 0.6, 'wood'); }
  /** Concertina: coils of razor wire. Walk-blocking (low collider), shoot-through. */
  function wire(pts, y0) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / 0.45), ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = U.lerp(a[0], b[0], t), z = U.lerp(a[1], b[1], t), y = (y0 != null ? y0 : height(x, z));
        L.addGeo('wire', wireGeo, mYXZ(x, y + 0.42, z, 0, ry, (k % 2 ? 0.2 : -0.2), 0.45, 0.45, 0.45));
      }
      const steps = Math.ceil(len / 1.5);
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps, x0 = U.lerp(a[0], b[0], t0), z0 = U.lerp(a[1], b[1], t0), x1 = U.lerp(a[0], b[0], t1), z1 = U.lerp(a[1], b[1], t1);
        const y = y0 != null ? y0 : Math.min(height(x0, z0), height(x1, z1));
        W.add(Math.min(x0, x1) - 0.3, y, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, y + 0.85, Math.max(z0, z1) + 0.3, { surf: 'metal', shoot: false, nav: false, tag: 'wire' });
      }
    }
  }

  // ---------------------------------------------------------------- districts
  function lzFalcon(rnd) {
    // elephant grass all round the clearing, thinning toward the middle where the slicks set down
    for (let i = 0; i < 1300; i++) {
      const a = rnd() * PI * 2, r = 6 + Math.sqrt(rnd()) * (LZ.r + 6), x = LZ.x + Math.cos(a) * r, z = LZ.z + Math.sin(a) * r;
      if (r < 10 && rnd() < 0.7) continue;
      if (lineDist(TRAILS.lz, x, z).d < 1.2) continue;
      grassClump(x, z, rnd, r < 12 ? 0.7 : 1);
    }
    // a burnt-out tree and a few termite mounds for cover
    for (const [x, z] of [[-86, 100], [-104, 88], [-98, 108]]) { L.addGeo('earth', L.geo('cone'), mYXZ(x, 0.7, z, 0, rnd() * 3, 0, 0.8, 1.4, 0.8)); W.addCyl(x, z, 0.6, 0, 1.3, { surf: 'dirt' }); }
    L.addGeo('bark', L.geo('cylLo'), mYXZ(-90, 0.4, 84, 0, 0, PI / 2 - 0.1, 0.35, 6, 0.35)); solid(-93, 0, 83.6, -87, 0.75, 84.4, 'wood');
  }
  function village(rnd) {
    const V = VILLAGE, huts = [];
    const spots = [[-14, -8, PI / 2, 4, 5], [-10, 9, PI / 2 + 0.0, 4, 4.5], [3, 15, PI, 4.5, 5], [18, 10, -PI / 2, 4, 5], [22, -7, -PI / 2, 4, 4.5], [-4, -25, 0, 4, 4.5], [-19, -21, PI / 2, 4, 4], [26, -21, 0, 4, 4.5]];
    for (const [dx, dz, ry, w, d] of spots) huts.push(hootch(V.x + dx, V.z + dz, w, d, ry, rnd));
    // the headman's house: bigger, with a back room (the trapdoor's under the rice bin)
    const hm = hootch(V.x + 10, V.z - 21, 6, 6, 0, rnd, { inside: false });
    L.box(V.x + 10 - 2.6, 0.15, V.z - 21 - 2.0, V.x + 10 - 1.4, 1.1, V.z - 21 - 0.8, 'timber'); // rice bin
    L.cyl('mudWall', V.x + 12.2, 0.45, V.z - 23.3, 0.28, 0.6); L.cyl('mudWall', V.x + 12.2, 0.45, V.z - 22.6, 0.22, 0.5);
    deco(V.x + 10 - 2.7, 0.16, V.z - 21 - 2.1, V.x + 10 - 1.3, 0.18, V.z - 21 - 0.7, 'timber'); // the hatch boards under the bin
    // an altar to the ancestors at the back wall
    L.box(V.x + 9, 0.15, V.z - 23.8, V.x + 11, 1.0, V.z - 23.3, 'timber'); deco(V.x + 9.6, 1.0, V.z - 23.7, V.x + 10.4, 1.3, V.z - 23.4, 'shrineRed');
    MJ.headman = { x: V.x + 10, z: V.z - 21, door: hm, hatch: { x: V.x + 8, z: V.z - 22.4 } };
    MJ.huts = huts;
    // the well, pens, haystacks, a cart
    L.cyl('shrine', V.x, 0.4, V.z, 0.9, 0.8); W.addCyl(V.x, V.z, 0.9, 0, 0.8, { surf: 'concrete' }); L.cyl('rubber', V.x, 0.81, V.z, 0.75, 0.02);
    for (const [a, b] of [[-1, 1], [1, 1]]) deco(V.x + a * 0.8 - 0.05, 0.8, V.z - 0.05, V.x + a * 0.8 + 0.05, 2.2, V.z + 0.05, 'timber');
    deco(V.x - 0.85, 2.1, V.z - 0.05, V.x + 0.85, 2.2, V.z + 0.05, 'timber');
    for (const [x, z] of [[V.x - 22, V.z + 6], [V.x + 14, V.z + 22], [V.x - 8, V.z + 24]]) { L.addGeo('thatch', L.geo('cone'), mYXZ(x, 1.0, z, 0, rnd() * 3, 0, 1.3, 2.0, 1.3)); W.addCyl(x, z, 1.1, 0, 1.6, { surf: 'dirt' }); dense(x, z, 1.6, 60); }
    const pen = (x0, z0, x1, z1) => { for (const [a, b, c, d] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) { deco(Math.min(a, c) - 0.04, 0.5, Math.min(b, d) - 0.04, Math.max(a, c) + 0.04, 0.58, Math.max(b, d) + 0.04, 'timber'); deco(Math.min(a, c) - 0.04, 0.9, Math.min(b, d) - 0.04, Math.max(a, c) + 0.04, 0.98, Math.max(b, d) + 0.04, 'timber'); solid(Math.min(a, c) - 0.05, 0, Math.min(b, d) - 0.05, Math.max(a, c) + 0.05, 1.0, Math.max(b, d) + 0.05, 'wood', { shoot: false }); } };
    pen(V.x - 26, V.z - 2, V.x - 20, V.z + 3);
    // the shrine: a little tiered pagoda north of the hamlet
    const sx = V.x + 2, sz = V.z - 34;
    L.box(sx - 2, 0, sz - 2, sx + 2, 0.4, sz + 2, 'shrine'); L.box(sx - 1.2, 0.4, sz - 1.2, sx + 1.2, 2.4, sz + 1.2, 'shrine');
    L.addGeo('shrineRed', L.geo('cone'), mYXZ(sx, 2.9, sz, 0, PI / 4, 0, 2.3, 1.0, 2.3)); L.box(sx - 0.8, 3.3, sz - 0.8, sx + 0.8, 4.0, sz + 0.8, 'shrine', { noCol: true });
    L.addGeo('shrineRed', L.geo('cone'), mYXZ(sx, 4.4, sz, 0, PI / 4, 0, 1.5, 0.8, 1.5)); noStand(sx - 2.4, 2.4, sz - 2.4, sx + 2.4, sz + 2.4);
    // palms, bananas and fruit trees through the hamlet
    for (let i = 0; i < 26; i++) { const a = rnd() * PI * 2, r = 8 + rnd() * 26, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r; if (huts.some((h) => Math.hypot(h.cx - x, h.cz - z) < 4.5) || Math.hypot(x - MJ.headman.x, z - MJ.headman.z) < 6 || inPaddy(x, z)) continue; if (rnd() < 0.5) palm(x, z, rnd); else banana(x, z, rnd); }
    // hedgerow of bamboo and brush round the edge
    for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2 + rnd() * 0.1, r = V.r - 2 + rnd() * 4, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r; if (inPaddy(x, z) || x > 28 || trailDist(x, z) < 2.5) continue; if (rnd() < 0.3) bamboo(x, z, rnd); else bush(x, z, rnd, 1.2); }
  }
  function paddies(rnd) {
    for (const p of PADDIES) {
      // dikes are in the heightfield; plant rice rows and a few grass tufts on the dikes
      for (let x = p[0] + 1.6; x < p[2] - 1.2; x += 1.1) for (let z = p[1] + 1.6; z < p[3] - 1.2; z += 1.1) {
        if (rnd() < 0.35) continue;
        L.addGeo('leafGrass', card(true), mYXZ(x + (rnd() - 0.5) * 0.3, -0.12, z + (rnd() - 0.5) * 0.3, 0, rnd() * PI, 0, 0.5, 0.6, 1), 0.9);
      }
      for (let i = 0; i < 8; i++) grassClump(U.lerp(p[0], p[2], rnd()), rnd() < 0.5 ? p[1] + 0.4 : p[3] - 0.4, rnd, 0.6);
    }
    // a tree line between the paddies and the river
    for (let z = -40; z < 34; z += 7) bush(82 + rnd() * 4, z + rnd() * 3, rnd, 1.3);
  }
  function copperhead(rnd) {
    // a bomb crater (old ordnance); Copperhead's radio and rucksack go in it
    const x = -78, z = -25;
    for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2; L.addGeo('earth', L.geo('sphere'), mYXZ(x + Math.cos(a) * 3.4, 0.05, z + Math.sin(a) * 3.4, 0, a, 0, 1.2, 0.4, 0.8)); }
    L.groundQuad(L.blobGeo, x, 0.02, z, 6, 6, 0);
    // splintered trees
    for (const [dx, dz] of [[5, 3], [-6, 2], [2, -6]]) { L.addGeo('barkPale', L.geo('cylLo'), mYXZ(x + dx, 1.4, z + dz, 0, 0, 0, 0.3, 2.8, 0.3)); W.addCyl(x + dx, z + dz, 0.32, 0, 2.8, { surf: 'wood' }); }
    MJ.copperhead = { x, z };
  }
  /** The hollow hill: a ridge of mossy rock with jungle on top, and the tunnels inside it. */
  function ridge(rnd) {
    const R = RIDGE;
    // outer rock skirt the surface can't climb (and that hides the tunnel roof)
    const rocks = [];
    for (let x = R.x0; x <= R.x1; x += 4) rocks.push([x, R.z1]);
    for (let z = R.z0; z <= R.z1; z += 4) rocks.push([R.x1, z]);
    for (const [x, z] of rocks) { const h = 6 + rnd() * 5; L.addGeo('rockMoss', new THREE.IcosahedronGeometry(1, 0), mYXZ(x, h * 0.35, z, rnd(), rnd() * 6, rnd(), 3.4, h * 0.6, 3.4)); }
    solid(R.x0, -1, R.z1 - 2, R.x1 + 2, 12, R.z1 + 2, 'concrete', { nav: false });
    solid(R.x1 - 2, -1, R.z0, R.x1 + 2, 12, R.z1 + 2, 'concrete', { nav: false });
    // the top of the hill: rock and trees standing on the tunnel roof
    L.box(TUN.x0 - 2, 2.4, TUN.z0 - 2, TUN.x1 + 2, 6, TUN.z1 + 2, 'rockMoss', { nav: false });
    noStand(R.x0, 6, R.z0, R.x1 + 2, R.z1 + 2);
    for (let i = 0; i < 40; i++) { const x = U.lerp(TUN.x0, TUN.x1, rnd()), z = U.lerp(TUN.z0, TUN.z1, rnd()); const h = 8 + rnd() * 8; L.addGeo('bark', trunkGeo, mYXZ(x, 6 + h / 2, z, 0, 0, 0, 0.3, h, 0.3)); for (let k = 0; k < 4; k++) L.addGeo('leafCanopy', card(false), mYXZ(x + (rnd() - 0.5) * 3, 6 + h - 1 + k * 0.8, z + (rnd() - 0.5) * 3, -PI / 2, rnd() * PI, 0, 7, 7, 1), 0.8); }
  }
  /** Tunnel rooms and passages (floor at 0, ceiling at 2.3), carved out of solid earth. */
  const TROOMS = [
    // [x0, z0, x1, z1, name]
    [-93, -112, -86, -104, 'entry'], [-104, -109.2, -93, -107.8, null], [-110, -112, -104, -105, 'store'],
    [-107.6, -122, -106.4, -112, null], [-110, -126, -103, -122, 'junction'], [-120, -124.6, -110, -123.4, null], [-126, -127, -120, -120, 'barracks'],
    [-123.6, -120, -122.4, -113, null], [-134, -118, -122, -110, 'maproom'], [-106.6, -133, -105.4, -126, null], [-110, -137, -101, -133, 'hospital'],
    [-131.6, -132, -130.4, -118, null], [-136, -137, -126, -132, 'cell'], [-126, -135.6, -110, -134.4, null], [-100, -136, -94, -130, 'exit'], [-101, -134.6, -100, -133.4, null]
  ];
  function tunnels(rnd) {
    const T = TUN, cs = 0.5, nx = Math.round((T.x1 - T.x0) / cs), nz = Math.round((T.z1 - T.z0) / cs);
    const open = new Uint8Array(nx * nz);
    for (const r of TROOMS) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = T.x0 + (ix + 0.5) * cs, z = T.z0 + (iz + 0.5) * cs;
      if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) open[iz * nx + ix] = 1;
    }
    // solid earth wherever nothing was dug (merged runs per row)
    for (let iz = 0; iz < nz; iz++) {
      let s = -1;
      for (let ix = 0; ix <= nx; ix++) {
        const o = ix === nx ? 1 : open[iz * nx + ix];
        if (!o && s < 0) s = ix;
        if (o && s >= 0) { L.box(T.x0 + s * cs, 0, T.z0 + iz * cs, T.x0 + ix * cs, 2.4, T.z0 + (iz + 1) * cs, 'earth', { nav: false, ao: false }); s = -1; }
      }
    }
    // ceiling (low and close)
    L.box(T.x0, 2.3, T.z0, T.x1, 2.4, T.z1, 'earthDark', { nav: false });
    deco(T.x0, 0.0, T.z0, T.x1, 0.01, T.z1, 'earthDark');
    // timber props in the rooms, sleeping mats, the map table, crates of rice and rounds
    const room = (n) => TROOMS.find((r) => r[4] === n);
    for (const r of TROOMS) {
      if (!r[4]) continue;
      for (const [x, z] of [[r[0] + 0.15, r[1] + 0.15], [r[2] - 0.15, r[1] + 0.15], [r[0] + 0.15, r[3] - 0.15], [r[2] - 0.15, r[3] - 0.15]]) deco(x - 0.1, 0, z - 0.1, x + 0.1, 2.3, z + 0.1, 'timber');
      deco(r[0], 2.15, (r[1] + r[3]) / 2 - 0.1, r[2], 2.3, (r[1] + r[3]) / 2 + 0.1, 'timber');
    }
    const st = room('store'); for (const z of [-111.3, -110.2, -106.6, -105.7]) crate(st[0] + 0.7, z, 0, 0.8, rnd() * 0.3);
    const ba = room('barracks'); for (let i = 0; i < 4; i++) L.box(ba[0] + 0.3, 0, ba[1] + 0.6 + i * 1.6, ba[0] + 2.2, 0.35, ba[1] + 1.4 + i * 1.6, 'canvasOD');
    const mr = room('maproom'); L.box(mr[0] + 4, 0, mr[1] + 3, mr[0] + 8, 0.8, mr[1] + 5, 'timber'); deco(mr[0] + 4.3, 0.8, mr[1] + 3.2, mr[0] + 7.7, 0.82, mr[1] + 4.8, 'canvasOD');
    deco(mr[0] + 0.05, 0.8, mr[1] + 2, mr[0] + 0.1, 1.9, mr[1] + 6, 'shrineRed'); // a flag on the wall
    const ho = room('hospital'); for (let i = 0; i < 3; i++) L.box(ho[0] + 0.6 + i * 2.8, 0, ho[1] + 0.4, ho[0] + 2.4 + i * 2.8, 0.5, ho[1] + 1.4, 'timber');
    const ce = room('cell'); for (let z = ce[1] + 0.2; z < ce[3] - 0.1; z += 0.26) deco(-132.04, 0, z - 0.03, -131.96, 2.3, z + 0.03, 'bamboo');
    // oil lamps: the only light down here
    const lamps = [];
    for (const r of TROOMS) if (r[4]) lamps.push(L.lamp((r[0] + r[2]) / 2 + 0.6, 1.8, (r[1] + r[3]) / 2, { color: 0xffa040, intensity: 1.4, distance: 7, flicker: 0.12, pool: false, prio: 3, zone: 'tunnel' }));
    MJ.tunnelLamps = lamps; for (const lp of lamps) lp.on = false;
    MJ.rooms = {}; for (const r of TROOMS) if (r[4]) MJ.rooms[r[4]] = { x: (r[0] + r[2]) / 2, z: (r[1] + r[3]) / 2, r };
  }
  function firebase(rnd) {
    const H = HILL, y = H.top;
    // plateau: sandbag berm with four bunkers, the guns, the TOC, a helipad, an observation tower
    const R = 15;
    for (let i = 0; i < 4; i++) bunker(H.x + Math.cos(i * PI / 2) * (R - 1), H.z + Math.sin(i * PI / 2) * (R - 1), i * PI / 2, y);
    for (let i = 0; i < 24; i++) {
      const a0 = i / 24 * PI * 2, a1 = (i + 1) / 24 * PI * 2;
      if (i % 6 === 0 || i % 6 === 5 || i === 1 || i === 13) continue; // gaps for the bunkers, the road gate (east) and the west gate
      const x0 = H.x + Math.cos(a0) * R, z0 = H.z + Math.sin(a0) * R, x1 = H.x + Math.cos(a1) * R, z1 = H.z + Math.sin(a1) * R;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
      L.addGeo('sandbag', L.geo('box'), mYXZ(cx, y + 0.5, cz, 0, Math.atan2(x1 - x0, z1 - z0), 0, 0.9, 1.0, len + 0.3));
      solid(Math.min(x0, x1) - 0.35, y - 0.5, Math.min(z0, z1) - 0.35, Math.max(x0, x1) + 0.35, y + 1.0, Math.max(z0, z1) + 0.35);
    }
    // gun pits
    for (const [dx, dz, ry] of [[-5, -4, 0.4], [-5, 5, 2.6], [4, -6, -0.6]]) {
      howitzer(H.x + dx, H.z + dz, ry, y);
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; if (i === 4) continue; L.addGeo('sandbag', L.geo('box'), mYXZ(H.x + dx + Math.cos(a) * 3, y + 0.35, H.z + dz + Math.sin(a) * 3, 0, -a, 0, 0.7, 0.7, 2.4)); }
      crate(H.x + dx + 1.8, H.z + dz + 1.8, y, 0.8, 0.3);
    }
    // TOC: a big bunker in the middle with antennas
    L.box(H.x - 2.5, y, H.z - 2, H.x + 2.5, y + 1.9, H.z + 2, 'sandbag');
    L.box(H.x - 2.8, y + 1.9, H.z - 2.3, H.x + 2.8, y + 2.3, H.z + 2.3, 'timber');
    for (const dx of [-1.5, 1.8]) deco(H.x + dx - 0.03, y + 2.3, H.z - 0.03, H.x + dx + 0.03, y + 8, H.z + 0.03, 'steel');
    // flagpole
    deco(H.x + 6 - 0.04, y, H.z + 3 - 0.04, H.x + 6 + 0.04, y + 7, H.z + 3 + 0.04, 'steel');
    // helipad on the east shoulder of the plateau
    deco(H.x + 7, y + 0.02, H.z - 4, H.x + 13, y + 0.05, H.z + 4, 'psp');
    // observation tower
    const tx = H.x - 9, tz = H.z + 8;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(tx + a - 0.08, y, tz + b - 0.08, tx + a + 0.08, y + 6, tz + b + 0.08, 'timber');
    L.box(tx - 1.3, y + 6, tz - 1.3, tx + 1.3, y + 6.15, tz + 1.3, 'timber'); sandbags(tx - 1.3, tz - 1.3, tx + 1.3, tz - 0.9, 0.8, y + 6.15);
    L.box(tx - 1.4, y + 8, tz - 1.4, tx + 1.4, y + 8.1, tz + 1.4, 'tinRoof', { noCol: true });
    solid(tx - 1.1, y, tz - 1.1, tx + 1.1, y + 6, tz + 1.1, 'wood', { nav: false });
    // ladder: steps up the south side
    for (let i = 1; i <= 19; i++) L.box(tx - 0.4, y + i * 0.3 - 0.3, tz + 1.3 + (19 - i) * 0.12, tx + 0.4, y + i * 0.3, tz + 1.42 + (19 - i) * 0.12 + 0.12, 'timber');
    MJ.tower = { x: tx, z: tz, y: y + 6.15 };
    // two rings of concertina down the slope, with cut lanes where the enemy will come through
    const ring = (r, gaps) => {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * PI * 2;
        if (gaps.some((g) => Math.abs(U.wrapAngle(a - g)) < 0.09)) { if (pts.length > 1) wire(pts); pts.length = 0; continue; }
        pts.push([H.x + Math.cos(a) * r, H.z + Math.sin(a) * r]);
      }
      if (pts.length > 1) wire(pts);
    };
    ring(21, [0.25, PI * 0.75, PI * 1.25, PI * 1.6, -0.6]);
    ring(27, [0.0, PI * 0.9, PI * 1.4, -0.9, PI * 0.5]);
    // the landing on the river and the road up
    L.box(91, -0.1, -73, 97, 0.35, -67, 'timber', { surf: 'wood' });
    for (let i = 0; i < 6; i++) deco(93 + (i % 3) * 2 - 0.12, -1.2, -73 + Math.floor(i / 3) * 6 - 0.12, 93 + (i % 3) * 2 + 0.12, 0.35, -73 + Math.floor(i / 3) * 6 + 0.12, 'timber');
    MJ.landing = { x: 94, z: -70 };
  }
  function pier() {
    // the south pier where the PBR waits (east edge of the boat's run)
    L.box(88, -0.1, 122, 98.5, 0.4, 128, 'timber', { surf: 'wood' });
    for (let i = 0; i < 8; i++) deco(88.5 + (i % 4) * 3 - 0.14, -1.2, 122.4 + Math.floor(i / 4) * 5 - 0.14, 88.5 + (i % 4) * 3 + 0.14, 0.4, 122.4 + Math.floor(i / 4) * 5 + 0.14, 'timber');
    crate(90, 124, 0.4); crate(90.4, 126.4, 0.4, 0.8, 0.3);
    L.box(80, 0, 120, 86, 2.4, 122, 'canvasOD', { noCol: false });
    MJ.pier = { x: 96, z: 125 };
  }
  function riverBanks(rnd) {
    // dense brush along both banks; enemy bunkers dug in among it (log and earth, low)
    for (let z = B.minZ + 4; z < B.maxZ - 4; z += 3.4) {
      const cx = MJ.riverX(z);
      for (const sd of [-1, 1]) { const x = cx + sd * (RIVER_W + 3 + rnd() * 3); if (sd < 0 && z > -78 && z < -62) continue; if (sd < 0 && z > 118 && z < 132) continue; if (rnd() < 0.75) bush(x, z, rnd, 1.2 + rnd() * 0.5); if (rnd() < 0.2) palm(x + sd * 3, z, rnd); }
    }
    const bunkers = [[121, 90, PI], [94, 58, 0], [130, 32, PI], [97, 2, 0], [124, -32, PI], [91, -40, 0]];
    MJ.riverBunkers = [];
    for (const [x, z, face] of bunkers) {
      const dir = face === 0 ? 1 : -1, gy = height(x, z); // dir: toward the water
      L.box(x + dir * 1.2 - 0.35, gy - 0.3, z - 1.8, x + dir * 1.2 + 0.35, gy + 1.0, z + 1.8, 'earth');             // front berm
      L.addGeo('bark', L.geo('cylLo'), mYXZ(x + dir * 1.2, gy + 1.1, z, PI / 2, 0, 0, 0.16, 3.8, 0.16));
      L.box(x - 1.4, gy - 0.3, z - 1.9, x + 1.4, gy + 1.0, z - 1.4, 'earth'); L.box(x - 1.4, gy - 0.3, z + 1.4, x + 1.4, gy + 1.0, z + 1.9, 'earth');
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(x + a * 1.2 - 0.07, gy, z + b * 1.5 - 0.07, x + a * 1.2 + 0.07, gy + 2.0, z + b * 1.5 + 0.07, 'timber');
      L.box(x - 1.6, gy + 2.0, z - 2.0, x + 1.6, gy + 2.4, z + 2.0, 'earth', { nav: false }); noStand(x - 1.6, gy + 2.4, z - 2, x + 1.6, z + 2);
      bush(x - dir * 1.8, z + 2.4, rnd, 1.4); bush(x - dir * 1.8, z - 2.4, rnd, 1.4); bush(x + dir * 2.2, z, rnd, 0.9, 'leafFern');
      MJ.riverBunkers.push({ x: x - dir * 0.2, z, y: gy, face });
    }
  }
  /** Trees, bushes and ferns everywhere the map is jungle; the trails stay walkable. */
  function scatter(rnd) {
    const trees = [];
    for (let z = B.minZ + 2; z < B.maxZ - 2; z += 7) for (let x = B.minX + 2; x < B.maxX - 2; x += 7) {
      const px = x + rnd() * 6, pz = z + rnd() * 6, j = jungle(px, pz);
      if (j < 0.5 || rnd() > j * 0.85 || inRect(RIDGE, px, pz)) continue;
      if (trailDist(px, pz) < 3) continue;
      if (Math.hypot(px - HILL.x, pz - HILL.z) < HILL.r1 + 3) continue;
      trees.push(canopyTree(px, pz, rnd));
    }
    for (let i = 0; i < 6800; i++) {
      const x = U.lerp(B.minX + 1, B.maxX - 1, rnd()), z = U.lerp(B.minZ + 1, B.maxZ - 1, rnd()), j = jungle(x, z);
      if (j < 0.25 || rnd() > j || inRect(RIDGE, x, z)) continue;
      const td = trailDist(x, z); if (td < 1.6) continue;
      const k = rnd();
      if (k < 0.5) bush(x, z, rnd, 0.8 + rnd() * 0.6, td < 4 ? 'leafFern' : null);
      else if (k < 0.62) banana(x, z, rnd);
      else if (k < 0.7 && td > 4) bamboo(x, z, rnd);
      else if (k < 0.78) palm(x, z, rnd);
      else grassClump(x, z, rnd, 0.8);
      if (i % 4 === 0 && td > 2) dense(x, z, 2.5, 18); // the general murk of the understory
    }
    MJ.trees = trees;
  }
  /** Tree stands for snipers: a platform of lashed poles high in a big tree. */
  function treeStand(x, z, h, rnd) {
    const t = canopyTree(x, z, rnd, { h: h + 7, crown: 5 });
    const gy = height(x, z);
    L.box(x - 1.1, gy + h, z - 1.1, x + 1.1, gy + h + 0.12, z + 1.1, 'timber', { nav: false });
    return { x: x + 0.75, z, y: height(x, z) + h + 0.12, tx: x, tz: z };
  }
  function edges() {
    const T = 40;
    W.add(B.minX - 2, -3, B.minZ - 2, B.maxX + 2, T, B.minZ, { shoot: false }); W.add(B.minX - 2, -3, B.maxZ, B.maxX + 2, T, B.maxZ + 2, { shoot: false });
    W.add(B.minX - 2, -3, B.minZ, B.minX, T, B.maxZ, { shoot: false }); W.add(B.maxX, -3, B.minZ, B.maxX + 2, T, B.maxZ, { shoot: false });
  }

  // ---------------------------------------------------------------- build
  // foliage and trunks go into 40 m chunks (one mesh per material per chunk) so the camera and the shadow map can skip
  // what they can't see; one map-wide batch would be drawn twice a frame in full
  const CHUNKED = new Set(['leafCanopy', 'leafBush', 'leafFern', 'leafGrass', 'leafBanana', 'leafPalm', 'bark', 'barkPale', 'bambooStem', 'wire']);
  function chunked(add0) {
    return function (m, geo, matrix, tint) {
      if (CHUNKED.has(m)) {
        const x = matrix.elements[12], z = matrix.elements[14], far = Math.abs(x) > 150 || Math.abs(z) > 150;
        const k = m + '@' + (far ? 'far' : Math.floor((x + 160) / 40) + ',' + Math.floor((z + 160) / 40));
        if (!L.mats[k]) L.mats[k] = L.mats[m];
        m = k;
      }
      return add0.call(this, m, geo, matrix, tint);
    };
  }
  let trunkGeo = null, wireGeo = null;
  MJ.build = function () {
    const add0 = L.addGeo; L.addGeo = chunked(add0);
    try { build(); } finally { L.addGeo = add0; }
  };
  function build() {
    materials();
    trunkGeo = trunkGeo || new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
    wireGeo = wireGeo || new THREE.TorusGeometry(1, 0.06, 3, 10);
    VEIL = new Uint8Array(VW * VH);
    const rnd = U.mulberry32(1968);
    L.killY = -14;
    terrainMesh(); terrainBoxes();
    lzFalcon(rnd); village(rnd); paddies(rnd); copperhead(rnd); ridge(rnd); tunnels(rnd); firebase(rnd); pier(); riverBanks(rnd);
    const stands = { stream: treeStand(-70, 4, 9, rnd), river: treeStand(132, 8, 8, rnd), bend: treeStand(124, -52, 9, rnd), hill: treeStand(30, -110, 9, rnd) };
    scatter(rnd); edges();
    MJ.stands = stands;
    // night lamps (firebase only: the hamlet is dark), flares are made at runtime
    const nl = MJ.nightLamps = [];
    for (const [dx, dz] of [[0, 0], [-6, 0], [5, 4]]) nl.push(L.lamp(HILL.x + dx, HILL.top + 2.2, HILL.z + dz, { color: 0xffc070, intensity: 1.2, distance: 9, pool: false, prio: 1 }));
    // flares: a few lamps the mission drops and moves (off until used)
    MJ.flareLamps = [0, 1, 2, 3].map(() => { const lp = L.lamp(0, -50, 0, { color: 0xfff0c8, intensity: 5, distance: 55, pool: false, prio: 6 }); lp.on = false; return lp; });

    // ------------------------------------------------------------ objectives (the missions switch them on)
    const task = (id, x, y, z, hold, prompt, r) => L.addInteract({ id, type: 'task', pos: [x, y, z], face: null, radius: r || 2.0, hold, prompt, enabled: false });
    // Copperhead's gear in the crater: a PRC-25 with its whip snapped, a rucksack, a notebook
    deco(-78.6, 0.02, -24.6, -78.0, 0.42, -24.2, 'ammoBox'); deco(-78.1, 0.42, -24.5, -78.08, 1.3, -24.48, 'steel');
    deco(-77.4, 0.02, -25.8, -76.8, 0.5, -25.2, 'canvasOD');
    task('copperRadio', -78, 0, -25, 2.5, 'Check Copperhead\'s radio and gear', 2.4);
    [0, 2, 4].forEach((h, i) => { const hu = MJ.huts[h]; task('search' + (i + 1), hu.cx, 0.15, hu.cz, 1.6, 'Search the hootch', 2.2); crate(hu.cx + 0.8, hu.cz + 0.6, 0.15, 0.7, 0.4); });
    task('hatch', MJ.headman.hatch.x, 0.15, MJ.headman.hatch.z, 2.0, 'Move the rice bin', 2.2);
    task('mapTable', -128, 0, -114, 3.0, 'Take the maps and orders', 2.4);
    task('hartCage', -131.4, 0, -134.5, 2.0, 'Cut the cage open', 1.8);
    for (const dz of [-0.6, 0.6]) deco(-97 - 0.06, 0, -133 + dz - 0.06, -97 + 0.06, 2.3, -133 + dz + 0.06, 'timber');
    for (let k = 0; k < 6; k++) deco(-97 - 0.04, 0.3 + k * 0.36, -133.6, -97 + 0.04, 0.34 + k * 0.36, -132.4, 'timber'); // a ladder up the shaft
    task('exitShaft', -97, 0, -133, 1.2, 'Climb out', 1.8);
    MJ.claymoreSpots = [[44.5, 84.9], [47.25, 80.4], [50, 75.9]];
    MJ.claymoreSpots.forEach((c, i) => task('claymore' + (i + 1), c[0], height(c[0], c[1]), c[1], 1.8, 'Plant a claymore', 1.8));
    task('clacker', 38.5, 0, 80.5, 0, 'Fire the claymores', 2.2);
    MJ.clacker = { x: 38.5, z: 80.5 };
    deco(37.8, 0.02, 80, 38.4, 0.5, 80.6, 'canvasOD'); // the squad's packs at the ambush site
    CF.Map.kit.ammoCache('cacheAmbush', 36.5, 0, 84, 'x+');
    CF.Map.kit.ammoCache('cacheKestrel', HILL.x + 3.4, HILL.top, HILL.z - 2.6, 'z-');

    // ------------------------------------------------------------ points
    const P = L.points;
    P.start = { x: LZ.x, y: 0, z: LZ.z, yaw: 0.4 };
    P.cp = {
      hotlz: P.start, trail: { x: -96, y: 0, z: 66, yaw: 0.1 }, ford: { x: -89, y: 0, z: 30, yaw: 0.1 }, copper: { x: -84, y: 0, z: -10, yaw: 0.3 },
      village: { x: -26, y: 0, z: -14, yaw: -PI / 2 + 0.2 }, hamlet: { x: -6, y: 0, z: -6, yaw: -PI / 2 },
      tunnel: { x: -89.5, y: 0, z: -106, yaw: PI / 2 }, tunnelMap: { x: -121, y: 0, z: -116, yaw: PI / 2 },
      ambush: { x: 50, y: 0, z: 100, yaw: -PI / 2 }, river: { x: 96.5, y: 0.4, z: 125, yaw: 0 }, firebase: { x: HILL.x + 2, y: HILL.top, z: HILL.z + 2, yaw: PI }
    };
    P.lz = { x: LZ.x, y: 0, z: LZ.z };
    P.hides = {
      lz: [[-78, 76], [-71, 93], [-77, 113], [-101, 119], [-119, 101], [-113, 75], [-84, 120]],
      ford: [[-79, 13], [-97, 11], [-73, 27], [-101, 28], [-84, 5], [-92, -2]],
      copper: [[-68, -33], [-88, -35], [-70, -16]],
      village: [[36, -14], [37, 10], [-24, 2], [30, -28], [-12, 22], [24, 26], [-28, -14]],
      ambush: [[62, 46], [80, 66], [40, 76], [72, 84]],
      firebase: []
    };
    P.spiders = { lz: [[-87, 79], [-104, 108], [-80, 98]], village: [[-2, -14], [16, 2], [8, -36]], ford: [[-88, 10]] };
    P.traps = { trail: [{ kind: 'wire', x: -96.5, z: 52, ry: 0.15 }, { kind: 'punji', x: -91, z: 40 }, { kind: 'wire', x: -88.7, z: 28, ry: -0.2 }, { kind: 'punji', x: -89.5, z: -1 }, { kind: 'wire', x: -84, z: -8, ry: 0.4 }],
      tunnel: [{ kind: 'wire', x: -106.9, z: -116, ry: PI / 2 }, { kind: 'punji', x: -123, z: -116.5 }, { kind: 'wire', x: -116, z: -124, ry: 0 }] };
    // spawn zones (jungle edges out of the usual sight lines)
    L.spawns.lz = [[-70, 80], [-70, 108], [-96, 124], [-122, 96], [-118, 70], [-82, 66]];
    L.spawns.ford = [[-72, 10], [-108, 6], [-66, 30], [-110, 30], [-80, -6]];
    L.spawns.copper = [[-62, -38], [-94, -36], [-60, -16], [-70, -44]];
    L.spawns.village = [[-30, -30], [-32, 14], [12, -42], [30, -40], [28, 30], [-24, 34], [40, -30], [40, 20]];
    L.spawns.ambush = [[30, 136], [36, 118], [72, 100], [90, 80], [24, 92], [60, 120]];
    L.spawns.tunnel = [[-123, -123], [-128, -114], [-106, -135], [-131, -134]];
    L.spawns.fbN = [[50, -132], [64, -132], [40, -128], [76, -128]];
    L.spawns.fbW = [[16, -100], [18, -84], [20, -112], [22, -70]];
    L.spawns.fbS = [[44, -50], [62, -48], [30, -56], [76, -54]];
    L.spawns.fbE = [[90, -104], [92, -86], [88, -118]];
    P.hill = { x: HILL.x, y: HILL.top, z: HILL.z };
    P.village = { x: VILLAGE.x, y: 0, z: VILLAGE.z };
  }

  // ---------------------------------------------------------------- time of day
  const TIMES = {
    dawn: { fog: [0.52, 0.56, 0.52], fogDensity: 0.016, hemi: [0xc8d0c0, 0x2e3420, 0.6], sun: [0xffc898, 1.2], sunDir: [0.7, 0.3, 0.35],
      sky: { zen: [0.2, 0.3, 0.42], hor: [0.78, 0.7, 0.58], glow: [0.9, 0.5, 0.25], glowDir: [0.7, 0.35], glow2: [0.08, 0.1, 0.08], glow2Dir: [-1, 0], cloudDark: [0.5, 0.5, 0.5], cloudLit: [1.1, 0.85, 0.65], stars: 0, moon: 0 },
      post: { bloom: 0.22, exposure: 0.84, sat: 1.04, shadow: [0.0, 0.004, 0.006], high: [0.016, 0.008, -0.008], threshold: 1.35 }, env: { top: [0.42, 0.5, 0.56], bottom: [0.2, 0.24, 0.14], band: [0.7, 0.6, 0.45] }, night: false },
    day: { fog: [0.62, 0.68, 0.62], fogDensity: 0.0085, hemi: [0xd8e4d8, 0x3c4426, 0.66], sun: [0xfff2dc, 1.75], sunDir: [0.35, 0.82, 0.3],
      sky: { zen: [0.24, 0.42, 0.66], hor: [0.78, 0.82, 0.78], glow: [0.4, 0.38, 0.28], glowDir: [0.35, 0.3], glow2: [0.1, 0.12, 0.08], glow2Dir: [-1, 0], cloudDark: [0.72, 0.74, 0.74], cloudLit: [1.08, 1.06, 1.0], stars: 0, moon: 2 },
      post: { bloom: 0.1, exposure: 0.76, sat: 1.1, shadow: [0, 0.003, 0.004], high: [0.01, 0.006, -0.006], threshold: 1.6 }, env: { top: [0.55, 0.66, 0.78], bottom: [0.22, 0.26, 0.14], band: [0.6, 0.62, 0.5] }, night: false },
    afternoon: { fog: [0.7, 0.66, 0.54], fogDensity: 0.0095, hemi: [0xe4dcc4, 0x3e3a22, 0.6], sun: [0xffd8a0, 1.6], sunDir: [-0.6, 0.5, 0.45],
      sky: { zen: [0.26, 0.38, 0.58], hor: [0.9, 0.78, 0.58], glow: [0.75, 0.48, 0.22], glowDir: [-0.6, 0.45], glow2: [0.1, 0.08, 0.05], glow2Dir: [1, 0], cloudDark: [0.78, 0.7, 0.6], cloudLit: [1.18, 1.0, 0.8], stars: 0, moon: 2 },
      post: { bloom: 0.15, exposure: 0.78, sat: 1.12, shadow: [0.004, 0.002, -0.002], high: [0.018, 0.008, -0.01], threshold: 1.5 }, env: { top: [0.5, 0.56, 0.7], bottom: [0.26, 0.24, 0.14], band: [0.78, 0.62, 0.4] }, night: false },
    dusk: { fog: [0.36, 0.3, 0.32], fogDensity: 0.012, hemi: [0x8a80a0, 0x22201a, 0.45], sun: [0xff8a50, 1.0], sunDir: [-0.85, 0.14, 0.3],
      sky: { zen: [0.07, 0.09, 0.2], hor: [0.78, 0.42, 0.28], glow: [1.15, 0.45, 0.16], glowDir: [-0.85, 0.3], glow2: [0.14, 0.08, 0.18], glow2Dir: [1, 0], cloudDark: [0.24, 0.18, 0.24], cloudLit: [1.05, 0.5, 0.32], stars: 0.1, moon: 0.3 },
      post: { bloom: 0.32, exposure: 0.92, sat: 1.08, shadow: [0.0, -0.002, 0.012], high: [0.02, 0.004, -0.01], threshold: 1.2 }, env: { top: [0.2, 0.2, 0.34], bottom: [0.14, 0.12, 0.1], band: [0.78, 0.4, 0.22] }, night: true },
    night: { fog: [0.02, 0.03, 0.04], fogDensity: 0.02, hemi: [0x3a4a66, 0x0a0c08, 0.2], sun: [0x90a8d8, 0.3], sunDir: [0.3, 0.72, -0.5],
      sky: { zen: [0.004, 0.007, 0.016], hor: [0.035, 0.045, 0.06], glow: [0.06, 0.06, 0.05], glowDir: [0, -1], glow2: [0.03, 0.04, 0.07], glow2Dir: [1, 0.3], cloudDark: [0.01, 0.012, 0.016], cloudLit: [0.07, 0.08, 0.1], stars: 1, moon: 1 },
      post: { bloom: 0.5, exposure: 1.02, sat: 0.82, shadow: [-0.003, 0.0, 0.012], high: [0.004, 0.004, 0.002], threshold: 1.1 }, env: { top: [0.01, 0.014, 0.024], bottom: [0.01, 0.01, 0.008], band: [0.022, 0.024, 0.02], panels: [[0.1, 0.1, 0.12], [0.08, 0.08, 0.1], [0.1, 0.1, 0.08], [0.08, 0.08, 0.08]] }, night: true },
    tunnel: { fog: [0.012, 0.009, 0.006], fogDensity: 0.09, hemi: [0x2a2018, 0x0c0806, 0.05], sun: [0x302820, 0.02], sunDir: [0.3, 0.9, 0.2],
      sky: { zen: [0.004, 0.004, 0.004], hor: [0.01, 0.008, 0.006], glow: [0, 0, 0], glowDir: [0, -1], glow2: [0, 0, 0], glow2Dir: [1, 0], cloudDark: [0.01, 0.01, 0.01], cloudLit: [0.02, 0.02, 0.02], stars: 0, moon: 0 },
      post: { bloom: 0.4, exposure: 0.98, sat: 0.9, shadow: [0.002, 0.0, -0.002], high: [0.01, 0.004, -0.004], threshold: 1.0 }, env: { top: [0.01, 0.008, 0.006], bottom: [0.01, 0.008, 0.006], band: [0.02, 0.014, 0.01], panels: [[0.06, 0.05, 0.04], [0.05, 0.04, 0.03], [0.06, 0.05, 0.04], [0.05, 0.04, 0.03]] }, night: true, tunnel: true }
  };
  MJ.TIMES = TIMES;
  const v3 = (a, v) => v.set(a[0], a[1], a[2]);
  /** Relight the valley for a mission: sun, sky, fog, reflections, grading, the water, the jungle's sounds. */
  MJ.setTime = function (name) {
    const t = TIMES[name] || TIMES.day, G = CF.Game, scene = G.scene;
    if (!scene || G.mapId !== 'jungle') return;
    MJ.time = name;
    scene.fog.color.setRGB(t.fog[0], t.fog[1], t.fog[2]); scene.fog.density = t.fogDensity;
    CF.FX.setFog(t.fogDensity, scene.fog.color);
    scene.traverse((o) => { if (o.isHemisphereLight) { o.color.setHex(t.hemi[0]); o.groundColor.setHex(t.hemi[1]); o.intensity = t.hemi[2]; } });
    G.moon.color.setHex(t.sun[0]); G.moon.intensity = t.sun[1];
    G.moonDir.set(t.sunDir[0], t.sunDir[1], t.sunDir[2]).normalize();
    const su = L.sky && L.sky.material.uniforms;
    if (su) {
      const k = t.sky;
      v3(k.zen, su.uZen.value); v3(k.hor, su.uHor.value); v3(k.glow, su.uGlow.value); v3(k.glow2, su.uGlow2.value);
      su.uGlowDir.value.set(k.glowDir[0], k.glowDir[1]).normalize(); su.uGlow2Dir.value.set(k.glow2Dir[0], k.glow2Dir[1]).normalize();
      v3(k.cloudDark, su.uCloudDark.value); v3(k.cloudLit, su.uCloudLit.value); su.uStars.value = k.stars; su.uMoonAmt.value = k.moon;
      su.uMoon.value.copy(G.moonDir);
    }
    if (L.mountainMat) { const u = L.mountainMat.uniforms, k = Math.min(1, t.sun[1] / 1.75); u.uSun.value.copy(G.moonDir); u.uHaze.value.set(t.fog[0], t.fog[1], t.fog[2]); u.uRock.value.set(0.1 * k + 0.01, 0.14 * k + 0.01, 0.08 * k + 0.01); u.uSnow.value.set(0.16 * k + 0.01, 0.22 * k + 0.01, 0.12 * k + 0.01); }
    if (L.envRT) { L.envRT.dispose(); L.envRT = null; }
    const k = t.sun[1] / 1.75, pn = t.env.panels || [[1.3, 1.4, 1.2], [1.2, 1.3, 1.3], [1.3, 1.3, 1.1], [1.2, 1.25, 1.2]].map((c) => c.map((v) => v * Math.min(1, k + 0.15)));
    const th = Object.assign({}, G.mapDef.theme, { env: Object.assign({}, t.env, { panels: pn }) });
    L.buildEnv(CF.Post.renderer, th); G.vmScene.environment = scene.environment;
    CF.Post.setState(t.post);
    for (const lp of MJ.nightLamps || []) lp.on = !!t.night && !t.tunnel;
    for (const lp of MJ.tunnelLamps || []) lp.on = !!t.tunnel;
    if (MJ.waterMat) MJ.waterMat.color.setRGB(t.night ? 0.02 : 0.07, t.night ? 0.025 : 0.085, t.night ? 0.02 : 0.05); // brown-green, muddy
    CF.FX.dustRate = 0;
    MJ.night = t.night;
    CF.Audio.setJungleNight(!!t.night);
  };
  /** Per frame: wind in the leaves, and the far chunks switched off (the fog has them long before then). */
  let chunks = null;
  MJ.tick = function (t) {
    if (swayTime) swayTime.value = t;
    const G = CF.Game, M = L.mats;
    if (!chunks) {
      const near = new Set([M.leafGrass, M.leafFern, M.leafBush, M.leafBanana]), far = new Set([M.leafCanopy, M.leafPalm, M.bark, M.barkPale, M.bambooStem, M.wire]);
      chunks = [];
      for (const o of G.scene.children) {
        if (!o.isMesh || !o.geometry.boundingSphere || !(near.has(o.material) || far.has(o.material))) continue;
        const b = o.geometry.boundingSphere; if (b.radius > 120) continue; // the ring outside the map stays on
        chunks.push({ o, c: b.center, r: b.radius, max: near.has(o.material) ? 70 : 160 });
      }
    }
    const cam = G.camera.position;
    for (const k of chunks) k.o.visible = cam.distanceTo(k.c) - k.r < k.max;
  };
  MJ.dispose = function () { chunks = null; VEIL = null; }; // no foliage veil on other maps
})(window.CF);
