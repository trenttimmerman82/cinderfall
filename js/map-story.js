'use strict';
/* Cinderfall — Dar Masir, capital district of the Qaltan Republic (Story Campaign: Dust Off). X east, Z south, Y up.
   South-west: the outskirts and the landing zone. South: the souk and Clocktower Square. North-west: the Magistrate's
   villa. North-east: Qasr al-Hadid, the old fort used as a prison. Centre: Victory Avenue, the roundabout and the
   boulevard. East: the covered bazaar, the school compound (Last Block) and the stadium (Extraction).
   Everything that isn't a street or a set piece is packed with houses by a seeded lot generator. */
(function (CF) {
  const L = CF.Level, W = CF.World, U = CF.U;
  const PI = Math.PI;
  const MS = CF.MapStory = {};
  const K = () => CF.Map.kit;

  // ---------------------------------------------------------------- layout
  const B = { minX: -110, maxX: 110, minZ: -110, maxZ: 112 };
  // walkable streets and open ground: [x0, z0, x1, z1, surface]
  const STREETS = [
    [-100, 62, -22, 70, 'dirt'],        // R1: outskirts road into the souk
    [-30, 34, -22, 70, 'packed'],       // the souk
    [-30, 8, 12, 34, 'paving'],         // Clocktower Square
    [-4, -10, 4, 8, 'road'],            // square → roundabout
    [-10, -32, 20, -10, 'road'],        // the roundabout (crash site)
    [0, -36, 8, -32, 'road'],
    [-16, -36, -10, -10, 'road'],
    [-96, -45, 104, -36, 'road'],       // Victory Avenue
    [30, -36, 40, 70, 'road'],          // the boulevard
    [20, -24, 30, -16, 'road'],
    [40, -24, 58, -16, 'road'],
    [52, -16, 58, 32, 'packed'],        // bazaar lane (roofed in the middle)
    [12, 18, 30, 24, 'road'],           // square → boulevard
    [66, 50, 74, 64, 'road'],           // compound → stadium
    [40, 64, 44, 70, 'road'],
    [88, 30, 104, 44, 'road'],          // east street (technicals come in here)
    [-44, 20, -30, 26, 'packed']
  ];
  const REGIONS = {
    out: [-110, 44, -40, 112], wadi: [-110, -110, -96, 62], villa: [-96, -104, -44, -45], fort: [44, -104, 104, -46],
    court: [58, 22, 88, 50], stadium: [44, 64, 106, 110]
  };
  MS.STREETS = STREETS; MS.REGIONS = REGIONS;

  // ---------------------------------------------------------------- materials (built the first time the city loads)
  let TEX = null;
  function textures() {
    if (TEX) return TEX;
    const T = CF.Tex.util, S = Math.min(512, T.size()), n = S * S, rnd = U.mulberry32(7311), sstep = U.smoothstep;
    TEX = {};
    // lime plaster over mud brick: blotchy patches, hairline cracks, bricks showing where it fell away (white, tinted per house)
    {
      const n1 = T.tileNoise(S, 4, 4, 5, 7301, 0.55), n2 = T.tileNoise(S, 16, 16, 3, 7302), n3 = T.tileNoise(S, 5, 5, 4, 7303);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n), crack = new Float32Array(n);
      for (let k = 0; k < 40; k++) { let x = rnd() * S, y = rnd() * S; let a = rnd() * PI * 2; for (let s = 0; s < 40 + rnd() * 80; s++) { crack[((y | 0) % S + S) % S * S + ((x | 0) % S + S) % S] = 1; a += (rnd() - 0.5) * 0.6; x += Math.cos(a); y += Math.sin(a); } }
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, bare = sstep(0.8, 0.84, n3[i]) * 0.85;
        const bx = (x + ((y / 16 | 0) % 2) * 16) % 32, brick = bare * ((y % 16 < 2 || bx < 2) ? 0.55 : 0.85 + n2[i] * 0.15);
        const v = (0.84 + (n1[i] - 0.5) * 0.16 + (n2[i] - 0.5) * 0.05) * (1 - crack[i] * 0.35);
        const dirt = (n1[i] - 0.5) * 0.1 + sstep(0.55, 1, n2[i]) * 0.05; // streaks and grime so walls aren't flat
        rgb[i * 3] = U.lerp(v - dirt, brick * 0.72, bare); rgb[i * 3 + 1] = U.lerp((v - dirt) * 0.96, brick * 0.62, bare); rgb[i * 3 + 2] = U.lerp((v - dirt) * 0.9, brick * 0.52, bare);
        hgt[i] = n1[i] * 0.3 + n2[i] * 0.15 - crack[i] * 0.6 - bare * 0.4; rough[i] = 0.92;
      }
      TEX.adobe = T.pack(rgb, hgt, rough, 2.2, S);
    }
    // limestone blocks (fort, stadium, clock tower)
    {
      const n1 = T.tileNoise(S, 8, 8, 4, 7311), n2 = T.tileNoise(S, 64, 64, 2, 7312), R = S / 8, Wb = S / 4, tone = [];
      for (let k = 0; k < 8 * 5; k++) tone.push(0.82 + rnd() * 0.22);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, row = (y / R) | 0, xs = (x + (row % 2) * Wb / 2) % S, col = (xs / Wb) | 0;
        const joint = (y % R) < 3 || (xs % Wb) < 3, v = joint ? 0.55 + n2[i] * 0.1 : tone[row * 5 + col] * (0.86 + (n1[i] - 0.5) * 0.2 + (n2[i] - 0.5) * 0.12);
        rgb[i * 3] = v * 0.95; rgb[i * 3 + 1] = v * 0.86; rgb[i * 3 + 2] = v * 0.7;
        hgt[i] = joint ? 0 : 0.7 + n2[i] * 0.3; rough[i] = 0.9;
      }
      TEX.limestone = T.pack(rgb, hgt, rough, 2.6, S);
    }
    // wind-rippled sand
    {
      const n1 = T.tileNoise(S, 3, 3, 5, 7321, 0.55), n2 = T.tileNoise(S, 4, 4, 3, 7322), n3 = T.tileNoise(S, 128, 128, 1, 7323);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, rip = 0.5 + 0.5 * Math.sin((y / S) * PI * 2 * 22 + n2[i] * 9 + x / S * PI * 2);
        const v = 0.8 + (n1[i] - 0.5) * 0.14 + rip * 0.04 + (n3[i] - 0.5) * 0.06;
        rgb[i * 3] = v; rgb[i * 3 + 1] = v * 0.87; rgb[i * 3 + 2] = v * 0.66;
        hgt[i] = rip * 0.4 + n1[i] * 0.3 + n3[i] * 0.1; rough[i] = 0.96;
      }
      TEX.sand = T.pack(rgb, hgt, rough, 1.8, S);
    }
    // square stone paving
    {
      const n1 = T.tileNoise(S, 8, 8, 3, 7331), n2 = T.tileNoise(S, 64, 64, 2, 7332), P = S / 4, tone = [];
      for (let k = 0; k < 16; k++) tone.push(0.8 + rnd() * 0.2);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, joint = (x % P) < 4 || (y % P) < 4, t = tone[((y / P) | 0) * 4 + ((x / P) | 0)];
        const v = joint ? 0.45 + n2[i] * 0.1 : t * (0.85 + (n1[i] - 0.5) * 0.15 + (n2[i] - 0.5) * 0.08);
        rgb[i * 3] = v * 0.94; rgb[i * 3 + 1] = v * 0.88; rgb[i * 3 + 2] = v * 0.78;
        hgt[i] = joint ? 0 : 0.8 + n2[i] * 0.2; rough[i] = joint ? 1 : 0.82;
      }
      TEX.paving = T.pack(rgb, hgt, rough, 2.2, S);
    }
    return TEX;
  }
  function materials() {
    const T = textures(), M = L.mats, CT = CF.Tex.list;
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.5, roughness: 1, metalness: 0 }, o));
    const tri = (t, c) => ({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, color: c });
    const ADOBE = { adobe: 0xe6cfa8, adobeLight: 0xf1e4cb, adobeOchre: 0xd9a86a, adobePink: 0xe0b8a0, adobeGrey: 0xc9c0b0, adobeWhite: 0xf6f1e6, adobeSand: 0xd8bf92 };
    for (const k in ADOBE) M[k] = std(tri(T.adobe, ADOBE[k]));
    M.limestone = std(tri(T.limestone, 0xffffff)); M.limestoneDark = std(tri(T.limestone, 0xb8a888));
    M.sandGround = std(tri(T.sand, 0xffffff)); M.paving = std(tri(T.paving, 0xffffff));
    M.packed = std(Object.assign(tri(CT.dirt, 0xd8c4a0)));
    M.road = std(Object.assign(tri(CT.asphalt, 0xa89c8c), { envMapIntensity: 0.3 }));
    M.roofTop = std(tri(CT.concrete, 0xcdbfa6));
    M.winDark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.25, metalness: 0.6, envMapIntensity: 0.8 });
    M.winWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.05, 0.05) });
    M.doorWood = std(tri(CT.planks, 0x6a4a30)); M.shutterGreen = std(tri(CT.planks, 0x4f6f5a)); M.shutterBlue = std(tri(CT.planks, 0x3f6280));
    M.awningRed = std(tri(CT.carpet, 0xa8402c)); M.awningBlue = std(tri(CT.carpet, 0x2f5a88)); M.awningStripe = std(tri(CT.carpet, 0xd8c8a0)); M.awningGreen = std(tri(CT.carpet, 0x3f6a44));
    M.hedge = std(tri(CT.grass, 0x3f5a2c)); M.grassDry = std(tri(CT.grass, 0xa8a068));
    M.palmTrunk = std(tri(CT.planks, 0x7a6048)); M.palmLeaf = std({ color: 0x5a7a3a, side: THREE.DoubleSide, roughness: 0.8 });
    M.water = new THREE.MeshStandardMaterial({ color: 0x2a7090, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 });
    M.carBody = std({ color: 0xc8c0b0, roughness: 0.5, metalness: 0.4 }); M.carBurnt = std({ color: 0x2a2420, roughness: 1, metalness: 0.2 });
    M.tarp = std(tri(CT.carpet, 0x6a6a5a)); M.rugRed = std(tri(CT.carpet, 0x8a2a24)); M.rugBlue = std(tri(CT.carpet, 0x2a3a6a));
    M.fruit = std({ color: 0xd08a2a, roughness: 0.7 }); M.fruitRed = std({ color: 0xa82a20, roughness: 0.7 }); M.fruitGreen = std({ color: 0x6a8a2a, roughness: 0.7 });
    M.clockFace = new THREE.MeshStandardMaterial({ map: clockTex(), roughness: 0.6 });
    M.sign = new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.7 });
    return ADOBE;
  }
  function clockTex() {
    const c = CF.Tex.util.makeCanvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#efe6d2'; x.beginPath(); x.arc(128, 128, 124, 0, PI * 2); x.fill();
    x.strokeStyle = '#2a2016'; x.lineWidth = 8; x.stroke(); x.fillStyle = '#2a2016';
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; x.fillRect(128 + Math.sin(a) * 100 - 4, 128 - Math.cos(a) * 100 - 10, 8, 20); }
    x.lineWidth = 9; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + 50, 128 - 30); x.stroke();
    x.lineWidth = 6; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 - 10, 128 - 90); x.stroke();
    return CF.Tex.util.toTex(c, { repeat: false });
  }
  function signTex() {
    const c = CF.Tex.util.makeCanvas(512, 128), x = c.getContext('2d');
    x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#7a2a1a'; x.fillRect(0, 0, 512, 16); x.fillRect(0, 112, 512, 16);
    x.fillStyle = '#2a2016'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SOUK AL-MASIR', 256, 66);
    return CF.Tex.util.toTex(c, { repeat: false });
  }

  // ---------------------------------------------------------------- small builders
  const deco = (x0, y0, z0, x1, y1, z1, m, o) => L.box(x0, y0, z0, x1, y1, z1, m, Object.assign({ noCol: true, ao: false }, o || {}));
  const solid = (x0, y0, z0, x1, y1, z1, surf, o) => W.add(x0, y0, z0, x1, y1, z1, Object.assign({ surf: surf || 'concrete' }, o || {}));
  const noStand = (x0, y, z0, x1, z1) => W.add(x0, y, z0, x1, y + 30, z1, { shoot: false, nav: false });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _sc = new THREE.Vector3(), _ps = new THREE.Vector3();
  const mYXZ = (x, y, z, rx, ry, rz, sx, sy, sz) => { _eu.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_eu); _sc.set(sx, sy, sz); _ps.set(x, y, z); return _m.compose(_ps, _q, _sc).clone(); };
  let frondGeo = null;
  function palm(x, z, h, rnd) {
    h = h || 7; rnd = rnd || Math.random;
    const lean = (rnd() - 0.5) * 0.6, la = rnd() * PI * 2, n = 6;
    let px = x, pz = z, py = 0;
    for (let i = 0; i < n; i++) {
      const seg = h / n, k = i / n, r = 0.22 - k * 0.06;
      const dx = Math.cos(la) * lean * seg * k, dz = Math.sin(la) * lean * seg * k;
      L.addGeo('palmTrunk', L.geo('cylLo'), mYXZ(px + dx / 2, py + seg / 2, pz + dz / 2, 0, 0, 0, r, seg * 1.02, r));
      px += dx; pz += dz; py += seg;
    }
    if (!frondGeo) { frondGeo = new THREE.BoxGeometry(0.55, 0.03, 3.2); frondGeo.translate(0, 0, -1.6); }
    for (let i = 0; i < 11; i++) L.addGeo('palmLeaf', frondGeo, mYXZ(px, py, pz, -0.35 - rnd() * 0.5, i / 11 * PI * 2 + rnd() * 0.3, (rnd() - 0.5) * 0.3, 1, 1, 0.8 + rnd() * 0.4));
    L.addGeo('palmTrunk', L.geo('sphere'), mYXZ(px, py, pz, 0, 0, 0, 0.35, 0.3, 0.35));
    W.addCyl(x, z, 0.25, 0, h, { surf: 'wood' });
    L.blob(x, z, 2, 2);
  }
  MS.palm = palm;
  function sandbags(x0, z0, x1, z1, h) {
    h = h || 1.1;
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    deco(x0, 0, z0, x1, h, z1, 'sandbag', { ao: true });
    for (let y = 0.28; y < h; y += 0.28) deco(alongX ? x0 : x0 - 0.02, y - 0.02, alongX ? z0 - 0.02 : z0, alongX ? x1 : x1 + 0.02, y, alongX ? z1 + 0.02 : z1, 'sandbag');
    solid(Math.min(x0, x1), 0, Math.min(z0, z1), Math.max(x0, x1), h, Math.max(z0, z1), 'concrete');
  }
  MS.sandbags = sandbags;
  function car(x, z, ry, burnt) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const put = (m, lx, y, lz, sx, sy, sz) => { const p = P(lx, lz); L.addGeo(m, L.geo('box'), L.mat4(p[0], y, p[1], 0, ry, burnt ? 0.05 : 0, sx, sy, sz)); };
    const body = burnt ? 'carBurnt' : 'carBody';
    put(body, 0, 0.65, 0, 1.75, 0.6, 4.2); put(body, 0, 1.2, 0.2, 1.6, 0.55, 2.1); put(burnt ? 'carBurnt' : 'winDark', 0, 1.2, 0.2, 1.62, 0.4, 1.9);
    for (const [lx, lz] of [[-0.8, -1.3], [0.8, -1.3], [-0.8, 1.3], [0.8, 1.3]]) { const p = P(lx, lz); L.addGeo('rubber', L.geo('cylLo'), L.mat4(p[0], 0.33, p[1], 0, ry, PI / 2, 0.33, 0.25, 0.33)); }
    for (const lz of [-1.4, 0, 1.4]) { const p = P(0, lz); W.addCyl(p[0], p[1], 1.0, 0, 1.45, { surf: 'metal' }); }
    L.blob(x, z, 3, 5.4);
  }
  MS.car = car;
  function stall(x, z, alongX, mat) {
    const lx = alongX ? 2.6 : 1.4, lz = alongX ? 1.4 : 2.6;
    deco(x - lx / 2, 0.85, z - lz / 2, x + lx / 2, 0.95, z + lz / 2, 'wood');
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(x + dx * (lx / 2 - 0.06) - 0.04, 0, z + dz * (lz / 2 - 0.06) - 0.04, x + dx * (lx / 2 - 0.06) + 0.04, 2.3, z + dz * (lz / 2 - 0.06) + 0.04, 'wood');
    deco(x - lx / 2 - 0.2, 2.3, z - lz / 2 - 0.2, x + lx / 2 + 0.2, 2.36, z + lz / 2 + 0.2, mat || 'awningStripe');
    const f = ['fruit', 'fruitRed', 'fruitGreen'];
    for (let i = 0; i < 3; i++) deco(x - lx / 2 + 0.15 + i * (lx - 0.3) / 3, 0.95, z - lz / 2 + 0.15, x - lx / 2 + 0.15 + (i + 1) * (lx - 0.3) / 3 - 0.05, 1.15, z + lz / 2 - 0.15, f[i]);
    solid(x - lx / 2, 0, z - lz / 2, x + lx / 2, 1.15, z + lz / 2, 'wood');
    CF.PH.mark('crate', x, 0, z);
  }
  function lampPost(x, z, dx, dz, o) {
    o = o || {};
    deco(x - 0.1, 0, z - 0.1, x + 0.1, 6.2, z + 0.1, 'paintDark', { ao: true }); solid(x - 0.12, 0, z - 0.12, x + 0.12, 6.2, z + 0.12, 'metal', { shoot: false });
    const ax = x + dx * 1.1, az = z + dz * 1.1;
    deco(Math.min(x, ax) - 0.05, 6.1, Math.min(z, az) - 0.05, Math.max(x, ax) + 0.05, 6.2, Math.max(z, az) + 0.05, 'paintDark');
    deco(ax - 0.25, 5.95, az - 0.15, ax + 0.25, 6.1, az + 0.15, 'lampWarm');
    return nightLamp(ax, 5.8, az, Object.assign({ color: 0xffb060, intensity: 2.2, distance: 18 }, o));
  }
  const nightLamps = [];
  function nightLamp(x, y, z, o) { const lp = L.lamp(x, y, z, Object.assign({ pool: false, prio: 0.2 }, o)); lp.night = true; lp.on = false; nightLamps.push(lp); return lp; }
  MS.nightLamp = nightLamp;

  // ---------------------------------------------------------------- the lot generator
  const GX0 = B.minX, GZ0 = B.minZ, GW = B.maxX - B.minX, GH = B.maxZ - B.minZ;
  let occ = null, walk = null;
  const cell = (x, z) => (z - GZ0) * GW + (x - GX0);
  function markRect(arr, r, v) {
    for (let z = Math.max(GZ0, Math.floor(r[1])); z < Math.min(B.maxZ, Math.ceil(r[3])); z++) for (let x = Math.max(GX0, Math.floor(r[0])); x < Math.min(B.maxX, Math.ceil(r[2])); x++) arr[cell(x, z)] = v;
  }
  const isWalk = (x, z) => x >= B.minX && x < B.maxX && z >= B.minZ && z < B.maxZ && walk[cell(Math.floor(x), Math.floor(z))] === 1;
  let ADOBE_KEYS = [];
  /** A house: plaster block, parapet, windows and a door on the sides that face a street, roof clutter. */
  function house(x0, z0, x1, z1, fl, rnd, o) {
    o = o || {};
    const h = fl * 3.2 + 0.3, mat = o.mat || ADOBE_KEYS[Math.floor(rnd() * ADOBE_KEYS.length)];
    L.box(x0, 0, z0, x1, h, z1, mat, { top: 'roofTop' });
    noStand(x0, h, z0, x1, z1);
    if (rnd() < 0.85) for (const [a, b, c, d] of [[x0, z0, x1, z0 + 0.22], [x0, z1 - 0.22, x1, z1], [x0, z0, x0 + 0.22, z1], [x1 - 0.22, z0, x1, z1]]) deco(a, h, b, c, h + 0.6, d, mat);
    const sides = [
      { n: [0, -1], a: x0, b: x1, fixed: z0, along: 'x', test: (t) => isWalk(t, z0 - 1.2) },
      { n: [0, 1], a: x0, b: x1, fixed: z1, along: 'x', test: (t) => isWalk(t, z1 + 1.2) },
      { n: [-1, 0], a: z0, b: z1, fixed: x0, along: 'z', test: (t) => isWalk(x0 - 1.2, t) },
      { n: [1, 0], a: z0, b: z1, fixed: x1, along: 'z', test: (t) => isWalk(x1 + 1.2, t) }
    ];
    let doorDone = false;
    for (const sd of sides) {
      const len = sd.b - sd.a; if (len < 2.4) continue;
      if (!sd.test((sd.a + sd.b) / 2) && !sd.test(sd.a + 1) && !sd.test(sd.b - 1)) continue;
      const nw = Math.max(1, Math.floor((len - 0.6) / 3)), step = len / nw;
      const out = 0.06, F = sd.fixed + (sd.n[0] + sd.n[1]) * 0.0;
      const face = (t0, t1, y0, y1, m, depth) => {
        const d = depth || out;
        if (sd.along === 'x') { const zz = sd.fixed, zo = zz + sd.n[1] * d; deco(t0, y0, Math.min(zz, zo), t1, y1, Math.max(zz, zo), m, { skip: [sd.n[1] < 0 ? 4 : 5] }); }
        else { const xx = sd.fixed, xo = xx + sd.n[0] * d; deco(Math.min(xx, xo), y0, t0, Math.max(xx, xo), y1, t1, m, { skip: [sd.n[0] < 0 ? 0 : 1] }); }
      };
      // floor bands
      for (let f = 1; f < fl; f++) face(sd.a, sd.b, f * 3.2 - 0.12, f * 3.2 + 0.04, mat, 0.1);
      const doorAt = !doorDone && len > 3.4 ? Math.floor(rnd() * nw) : -1;
      for (let i = 0; i < nw; i++) {
        const c = sd.a + (i + 0.5) * step;
        for (let f = 0; f < fl; f++) {
          if (f === 0 && i === doorAt) {
            face(c - 0.6, c + 0.6, 0, 2.3, 'doorWood', 0.05); face(c - 0.75, c + 0.75, 2.3, 2.5, mat, 0.12);
            if (o.awning || (rnd() < 0.25 && fl > 1)) face(c - 1.3, c + 1.3, 2.7, 2.78, o.awning || 'awningStripe', 1.3);
            doorDone = true; continue;
          }
          if (rnd() < (f === 0 ? 0.45 : 0.72)) {
            const y0 = f * 3.2 + (f === 0 ? 1.1 : 0.9), lit = rnd() < 0.18;
            face(c - 0.45, c + 0.45, y0, y0 + 1.25, lit ? 'winWarm' : 'winDark', 0.03);
            face(c - 0.55, c + 0.55, y0 - 0.1, y0, mat, 0.12);
            if (rnd() < 0.35) { const sm = rnd() < 0.5 ? 'shutterGreen' : 'shutterBlue'; face(c - 0.95, c - 0.5, y0, y0 + 1.25, sm, 0.06); face(c + 0.5, c + 0.95, y0, y0 + 1.25, sm, 0.06); }
            if (f > 0 && rnd() < 0.12) { face(c - 0.8, c + 0.8, f * 3.2 - 0.05, f * 3.2 + 0.1, 'roofTop', 0.8); face(c - 0.8, c + 0.8, f * 3.2 + 0.1, f * 3.2 + 1.0, 'paintDark', 0.8); }
          }
        }
      }
    }
    // roof clutter
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (rnd() < 0.55) { const tx = x0 + 1 + rnd() * Math.max(0.1, x1 - x0 - 2), tz = z0 + 1 + rnd() * Math.max(0.1, z1 - z0 - 2); L.cyl('paintGrey', tx, h + 0.9, tz, 0.55, 1.0, 0, 0, true); deco(tx - 0.5, h, tz - 0.5, tx + 0.5, h + 0.4, tz + 0.5, 'paintDark'); }
    if (rnd() < 0.4) deco(cx - 0.4, h, cz - 0.3, cx + 0.4, h + 0.7, cz + 0.3, 'paintGrey');
    if (rnd() < 0.25) { L.addGeo('steel', L.geo('sphere'), L.mat4(cx + 1, h + 0.9, cz, 0.6, rnd() * 6, 0, 0.45, 0.12, 0.45)); deco(cx + 0.97, h, cz - 0.03, cx + 1.03, h + 0.9, cz + 0.03, 'steel'); }
    if (rnd() < 0.25 && x1 - x0 > 5) deco(x0 + 0.8, h + 1.4, cz - 0.01, x1 - 0.8, h + 1.42, cz + 0.01, 'rubber');
    return h;
  }
  MS.house = house;
  function fillCity() {
    const rnd = U.mulberry32(42017);
    occ = new Uint8Array(GW * GH); walk = new Uint8Array(GW * GH);
    for (const s of STREETS) { markRect(walk, s, 1); markRect(occ, s, 1); }
    for (const k in REGIONS) { markRect(walk, REGIONS[k], 1); markRect(occ, REGIONS[k], 1); }
    const free = (x, z) => occ[cell(x, z)] === 0;
    let n = 0;
    for (let z = GZ0; z < B.maxZ; z++) for (let x = GX0; x < B.maxX; x++) {
      if (!free(x, z)) continue;
      const market = x > -46 && x < -14 && z > 26 && z < 76, avenue = z > -58 && z < -24, eastSide = x > 40;
      const wt = 6 + Math.floor(rnd() * 8), dt = 6 + Math.floor(rnd() * 8);
      let w = 0; while (w < wt && x + w < B.maxX && free(x + w, z)) w++;
      let d = 0; outer: while (d < dt && z + d < B.maxZ) { for (let i = 0; i < w; i++) if (!free(x + i, z + d)) break outer; d++; }
      markRect(occ, [x, z, x + w, z + d], 2);
      if (w < 2 || d < 2) continue;
      let bw = w, bd = d;
      if (w > 9 && rnd() < 0.15) bw -= 2; // an alley
      const fl = market ? 2 + (rnd() < 0.4 ? 1 : 0) : avenue ? 2 + Math.floor(rnd() * 3) : eastSide ? 1 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2.6);
      house(x, z, x + bw, z + bd, Math.min(fl, bw < 4 || bd < 4 ? 1 : 4), rnd, { awning: market && rnd() < 0.6 ? ['awningRed', 'awningBlue', 'awningGreen', 'awningStripe'][Math.floor(rnd() * 4)] : null });
      n++;
    }
    MS.houseCount = n;
  }

  // ---------------------------------------------------------------- districts
  function outskirts(rnd) {
    // low mud-brick farmsteads with yard walls, date palms, the militia checkpoint on the road
    const spots = [[-96, 50], [-86, 48], [-60, 50], [-52, 80], [-60, 96], [-96, 104], [-72, 106], [-48, 104], [-50, 54], [-92, 78], [-100, 90]];
    for (const [x, z] of spots) {
      const w = 5 + rnd() * 3, d = 4 + rnd() * 3;
      house(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 1, rnd, { mat: rnd() < 0.5 ? 'adobeSand' : 'adobeOchre' });
      if (rnd() < 0.6) { // yard wall
        const yx = x + w / 2, yz = z - d / 2;
        L.box(yx, 0, yz, yx + 4, 1.8, yz + 0.3, 'adobeSand'); L.box(yx + 3.7, 0, yz, yx + 4, 1.8, yz + d - 1.2, 'adobeSand');
      }
      palm(x + (rnd() - 0.5) * 10, z + 4 + rnd() * 3, 6 + rnd() * 4, rnd);
    }
    for (let i = 0; i < 18; i++) { const x = -108 + rnd() * 66, z = 46 + rnd() * 64; if (Math.hypot(x + 78, z - 92) < 14 || (z > 60 && z < 72)) continue; palm(x, z, 5 + rnd() * 5, rnd); }
    // LZ marker: stones in a ring, smoke comes from the mission
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; L.addGeo('rock', new THREE.IcosahedronGeometry(1, 0), L.mat4(-78 + Math.cos(a) * 7, 0.15, 92 + Math.sin(a) * 7, 0, a, 0, 0.35, 0.25, 0.35)); }
    // checkpoint at the edge of town
    sandbags(-54, 60.5, -48, 61.2); sandbags(-54, 70.8, -48, 71.5);
    house(-60, 56, -55, 60.5, 1, rnd, { mat: 'adobeGrey' });
    deco(-49, 1.0, 63, -48.8, 1.1, 69, 'paintRed'); deco(-49.1, 0, 62.8, -48.7, 1.1, 63.2, 'paintDark', { ao: true });
    for (const [x, z] of [[-46, 61], [-46, 71]]) L.cyl('paintGrey', x, 0.45, z, 0.3, 0.9);
    solid(-46.3, 0, 60.7, -45.7, 0.9, 61.3); solid(-46.3, 0, 70.7, -45.7, 0.9, 71.3);
    L.emitters.push({ type: 'fire', x: -46, y: 0.9, z: 61, rate: 6, size: 0.4 });
    car(-58, 66, 0.2, true);
    // dunes and a mesa rim beyond the last houses (the world stops here)
    for (let i = 0; i < 12; i++) L.addGeo('sandGround', L.geo('sphere'), L.mat4(-110 + i * 6, -1, 112 + rnd() * 2, 0, rnd(), 0, 6, 2 + rnd() * 2, 4));
    for (let i = 0; i < 12; i++) L.addGeo('sandGround', L.geo('sphere'), L.mat4(-112 - rnd() * 2, -1, 44 + i * 6, 0, rnd(), 0, 4, 2 + rnd() * 2, 6));
  }
  function souk(rnd) {
    const mats = ['awningRed', 'awningBlue', 'awningStripe', 'awningGreen'];
    for (let z = 38; z < 68; z += 5.5) {
      if (rnd() < 0.8) stall(-28.6, z + rnd(), false, mats[Math.floor(rnd() * 4)]);
      if (rnd() < 0.6) stall(-23.4, z + 2 + rnd(), false, mats[Math.floor(rnd() * 4)]);
      if (rnd() < 0.4) deco(-30, 3.4 + rnd(), z, -22, 3.42 + rnd() * 0.02, z + 0.02, 'rubber'); // cables across
      if (rnd() < 0.3) deco(-29.95, 2.6, z + 1, -29.9, 4.4, z + 2.4, rnd() < 0.5 ? 'rugRed' : 'rugBlue');
    }
    K().crate(-24.2, 0, 49); K().crate(-24.2, 0, 50.2, 1.0); K().crate(-28.8, 0, 58);
    car(-25.5, 42, 0.1, false);
    // the arch where the outskirts road meets the souk
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), L.mats.sign); sign.position.set(-30.42, 5.3, 66); sign.rotation.y = -PI / 2; L.scene.add(sign);
    L.box(-30.4, 4.4, 62, -29.6, 6.2, 70, 'adobeOchre'); L.box(-30.4, 0, 62, -29.6, 4.4, 62.8, 'adobeOchre'); L.box(-30.4, 0, 69.2, -29.6, 4.4, 70, 'adobeOchre');
  }
  function square(rnd) {
    // clock tower
    L.box(-11, 0, 18, -7, 17, 22, 'limestone'); L.box(-11.4, 17, 17.6, -6.6, 17.6, 22.4, 'limestoneDark');
    L.box(-10.6, 17.6, 18.4, -7.4, 20, 21.6, 'limestone', { noCol: true }); L.cyl('limestoneDark', -9, 20.8, 20, 1.3, 1.6, 0, 0, false);
    noStand(-11.4, 17.6, 17.6, -6.6, 22.4);
    for (const [x, z, ry] of [[-9, 17.98, PI], [-9, 22.02, 0], [-11.02, 20, -PI / 2], [-6.98, 20, PI / 2]]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), L.mats.clockFace); f.position.set(x, 14.5, z); f.rotation.y = ry; L.scene.add(f); }
    // fountain
    L.cyl('limestone', 2, 0.35, 24, 3, 0.7); W.addCyl(2, 24, 3, 0, 0.7, { surf: 'concrete' });
    L.cyl('water', 2, 0.66, 24, 2.7, 0.04); L.cyl('limestone', 2, 1.3, 24, 0.5, 1.6);
    // cover: cars, stalls, planters, a burnt bus
    car(-20, 28, 1.4, false); car(6, 12, 0.3, true); car(-24, 14, -0.2, false);
    for (const [x, z] of [[-18, 16], [-2, 30], [8, 30]]) stall(x, z, true, 'awningRed');
    for (const [x, z] of [[-26, 10], [10, 16], [-14, 32], [10, 32]]) { deco(x - 0.7, 0, z - 0.7, x + 0.7, 0.7, z + 0.7, 'limestone', { ao: true }); solid(x - 0.7, 0, z - 0.7, x + 0.7, 0.7, z + 0.7); palm(x, z, 6 + rnd() * 2, rnd); }
    sandbags(-6, 11, -1, 11.7); sandbags(4, 9.2, 4.7, 13);
    K().crate(-15, 0, 12); K().crate(-15, 1.2, 12, 1.0); K().barrel(-13.4, 11.4);
    for (const [x, z] of [[-28, 9], [10, 9], [-28, 33], [10, 33]]) lampPost(x, z, x < 0 ? 1 : -1, 0);
  }
  function villa(rnd) {
    const [x0, z0, x1, z1] = REGIONS.villa, H = 3.6, t = 0.5;
    // perimeter wall with a culvert on the west side and the main gate on the south
    L.box(x0, 0, z0, x1, H, z0 + t, 'adobeWhite'); // north
    L.box(x0, 0, z1 - t, -72, H, z1, 'adobeWhite'); L.box(-66, 0, z1 - t, x1, H, z1, 'adobeWhite'); L.box(-72, 3.0, z1 - t, -66, H, z1, 'adobeWhite', { noCol: true });
    L.addDoor('villaGate', -72, 0, z1 - t, -66, 3.0, z1, 'paintDark');
    L.box(x1 - t, 0, z0 + t, x1, H, z1 - t, 'adobeWhite'); // east
    L.box(x0, 0, z0 + t, x0 + t, H, -72, 'adobeWhite'); L.box(x0, 0, -69.5, x0 + t, H, z1 - t, 'adobeWhite'); L.box(x0, 1.25, -72, x0 + t, H, -69.5, 'adobeWhite'); // the culvert (crouch)
    deco(x0 - 0.05, 1.05, -72.2, x0 + t + 0.05, 1.25, -69.3, 'steel');
    for (const [a, b] of [[x0, x1]]) noStand(a, H, z0, b, z0 + t);
    noStand(x0, H, z0, x0 + t, z1); noStand(x1 - t, H, z0, x1, z1); noStand(x0, H, z1 - t, x1, z1);
    for (let x = x0 + 2; x < x1; x += 4) deco(x - 0.2, H, z1 - t - 0.05, x + 0.2, H + 0.3, z1 + 0.05, 'limestone');
    // main house: foyer, hall, the study (north-east), guard room; doors are gaps
    const hx0 = -84, hz0 = -90, hx1 = -60, hz1 = -72, hh = 3.8, w = 0.35;
    L.box(hx0, 0, hz0, hx1, 0.3, hz1, 'paving', { surf: 'concrete' });
    const wall = (a, b, c, d, m) => L.box(a, 0.3, b, c, hh, d, m || 'adobeWhite');
    wall(hx0, hz0, hx1, hz0 + w);                                  // north
    wall(hx0, hz1 - w, -74, hz1); wall(-70, hz1 - w, hx1, hz1); L.box(-74, 2.9, hz1 - w, -70, hh, hz1, 'adobeWhite'); // south, front door
    wall(hx0, hz0 + w, hx0 + w, -79); wall(hx0, -77, hx0 + w, hz1 - w); L.box(hx0, 2.6, -79, hx0 + w, hh, -77, 'adobeWhite'); // west, side door
    wall(hx1 - w, hz0 + w, hx1, hz1 - w);                          // east
    wall(-72.2, hz0 + w, -71.8, -84); wall(-72.2, -82, -71.8, -76.5); L.box(-72.2, 2.6, -84, -71.8, hh, -82, 'adobeWhite'); // inner wall N-S with doorway
    wall(-71.8, -80.2, -66, -79.8); wall(-64, -80.2, hx1 - w, -79.8); L.box(-66, 2.6, -80.2, -64, hh, -79.8, 'adobeWhite'); // study wall
    L.box(hx0 - 0.3, hh, hz0 - 0.3, hx1 + 0.3, hh + 0.35, hz1 + 0.3, 'roofTop', { nav: false });
    noStand(hx0 - 0.3, hh + 0.35, hz0 - 0.3, hx1 + 0.3, hz1 + 0.3);
    deco(hx0 + w, hh - 0.1, hz0 + w, hx1 - w, hh, hz1 - w, 'ceiling');
    // windows (dark) on the facade and colonnade
    for (let x = hx0 + 2; x < hx1 - 1; x += 3.2) { if (x > -75 && x < -69) continue; deco(x, 1.2, hz1 + 0.01, x + 1.2, 2.8, hz1 + 0.06, 'winWarm'); }
    for (let x = hx0; x <= hx1; x += 4) { L.cyl('limestone', x, 1.9, hz1 + 1.6, 0.22, 3.8, 0, 0, true); solid(x - 0.22, 0, hz1 + 1.38, x + 0.22, 3.8, hz1 + 1.82, 'concrete'); }
    L.box(hx0 - 0.3, 3.8, hz1, hx1 + 0.3, 4.1, hz1 + 2.2, 'roofTop', { nav: false });
    // study: desk, laptop terminal (the ledger), bookcases; hall: rugs, sofas
    deco(-68, 0.3, -88, -64, 0.35, -83, 'rugRed');
    L.box(-67.5, 0.3, -86.2, -64.5, 1.1, -85.2, 'woodDark'); deco(-66.3, 1.1, -85.9, -65.5, 1.12, -85.5, 'paintDark');
    const scr = K().screenMesh(L.mats.screenIdle, -65.9, 1.3, -85.95, 'z+', 0.5, 0.32);
    L.addInteract({ id: 'ledger', type: 'task', pos: [-66, 0.3, -84.3], face: [0, -1], radius: 1.9, hold: 3.0, prompt: 'Copy the Magistrate\'s ledger', enabled: false, screen: scr });
    for (const z of [-89.4, -89.0]) L.box(-71.6, 0.3, z - 0.3, -67, 2.6, z, 'woodDark');
    deco(-82, 0.3, -88, -75, 0.33, -82, 'rugBlue');
    L.box(-82, 0.3, -89.5, -77, 1.0, -88.7, 'couch'); L.box(-83.6, 0.3, -86, -82.8, 1.0, -82, 'couch');
    L.box(-77, 0.3, -75.5, -75, 1.0, -73.5, 'woodDark');
    // lamps inside (always on at night — the Magistrate is home)
    nightLamp(-66, 3.4, -84, { color: 0xffc080, intensity: 1.5, distance: 9, prio: 1 });
    nightLamp(-78, 3.4, -84, { color: 0xffc080, intensity: 1.3, distance: 10, prio: 1 });
    nightLamp(-72, 3.4, -75, { color: 0xffc080, intensity: 1.2, distance: 9, prio: 1 });
    // garden: hedges, palms, pool, fountain, paths
    L.box(-76, 0, -66, -60, 0.5, -58, 'limestone'); deco(-75.6, 0.5, -65.6, -60.4, 0.52, -58.4, 'water');
    for (const [a, b, c, d] of [[-92, -66, -82, -65], [-92, -58, -84, -57], [-58, -66, -50, -65], [-56, -56, -48, -55], [-90, -96, -86, -92], [-52, -96, -48, -86]]) { L.box(a, 0, b, c, 1.3, d, 'hedge'); }
    for (const [x, z] of [[-90, -62], [-54, -62], [-80, -54], [-64, -52], [-88, -94], [-50, -92], [-60, -96]]) palm(x, z, 7 + rnd() * 3, rnd);
    L.cyl('limestone', -72, 0.3, -52, 2, 0.6); W.addCyl(-72, -52, 2, 0, 0.6, {}); L.cyl('water', -72, 0.61, -52, 1.8, 0.02);
    // garage with the Magistrate's car (his escape if the alarm goes up) and the guard house
    L.box(-94, 0, -62, -84, 3.2, -61.6, 'adobeWhite'); L.box(-94, 0, -62, -93.6, 3.2, -50, 'adobeWhite'); L.box(-94, 3.2, -62, -84, 3.5, -50, 'roofTop', { nav: false });
    car(-89, -56, 0, false);
    MS.villaCar = { x: -89, z: -56 };
    house(-56, -60, -48, -51, 1, rnd, { mat: 'adobeWhite' });
    // towers at two corners with floodlights
    for (const [x, z] of [[-48, -100], [-92, -49]]) {
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(x + dx * 1.2 - 0.12, 0, z + dz * 1.2 - 0.12, x + dx * 1.2 + 0.12, 4.5, z + dz * 1.2 + 0.12, 'woodDark');
      L.box(x - 1.6, 4.5, z - 1.6, x + 1.6, 4.7, z + 1.6, 'wood'); deco(x - 1.6, 4.7, z - 1.6, x + 1.6, 5.7, z - 1.5, 'wood'); deco(x - 1.6, 6.8, z - 1.6, x + 1.6, 6.9, z + 1.6, 'tarp');
      solid(x - 1.3, 0, z - 1.3, x + 1.3, 4.5, z + 1.3, 'wood', { nav: false });
      nightLamp(x + (x < -70 ? 2 : -2), 5.5, z + (z < -70 ? 2 : -2), { color: 0xfff0d0, intensity: 2.2, distance: 20, prio: 1 });
    }
    for (const [x, z] of [[-80, -68], [-62, -68], [-90, -80], [-52, -80], [-72, -48]]) nightLamp(x, 3, z, { color: 0xffd8a0, intensity: 1.4, distance: 13 });
    // wadi exfil marker: an old irrigation pump
    L.box(-106, 0, -74, -103, 1.4, -71, 'wallRust');
  }
  function fort(rnd) {
    const [x0, z0, x1, z1] = REGIONS.fort, H = 6, t = 1.6;
    L.box(x0, 0, z0, x1, H, z0 + t, 'limestone');
    L.box(x0, 0, z1 - t, 70, H, z1, 'limestone'); L.box(76, 0, z1 - t, x1, H, z1, 'limestone'); L.box(70, 4.2, z1 - t, 76, H, z1, 'limestone', { noCol: true });
    L.addDoor('fortGate', 70, 0, z1 - t + 0.4, 76, 4.2, z1 - 0.4, 'wallRust');
    L.box(x0, 0, z0 + t, x0 + t, H, z1 - t, 'limestone'); L.box(x1 - t, 0, z0 + t, x1, H, z1 - t, 'limestone');
    noStand(x0, H, z0, x1, z0 + t); noStand(x0, H, z1 - t, x1, z1); noStand(x0, H, z0, x0 + t, z1); noStand(x1 - t, H, z0, x1, z1);
    for (let x = x0; x < x1; x += 2) { deco(x, H, z1 - t, x + 1, H + 0.7, z1, 'limestone'); deco(x, H, z0, x + 1, H + 0.7, z0 + t, 'limestone'); }
    for (const [x, z] of [[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z1 - 2], [x1 - 2, z1 - 2]]) { L.box(x - 3, 0, z - 3, x + 3, 9, z + 3, 'limestone'); deco(x - 3.3, 9, z - 3.3, x + 3.3, 9.8, z + 3.3, 'limestoneDark'); noStand(x - 3.3, 9, z - 3.3, x + 3.3, z + 3.3); }
    // cell block along the north wall: corridor, four cells behind bars, a breach door
    const cz0 = z0 + t, cz1 = -86, cw = 0.4;
    L.box(52, 0, cz0, 96, 3.4, cz0 + 0.01, 'limestone', { noCol: true });
    L.box(52, 0, cz0, 52.4, 3.4, cz1, 'limestone'); L.box(95.6, 0, cz0, 96, 3.4, cz1, 'limestone');
    L.box(52, 0, cz1 - cw, 72, 3.4, cz1, 'limestone'); L.box(75, 0, cz1 - cw, 96, 3.4, cz1, 'limestone'); L.box(72, 2.4, cz1 - cw, 75, 3.4, cz1, 'limestone');
    L.addDoor('blockDoor', 72, 0, cz1 - cw + 0.05, 75, 2.4, cz1 - 0.05, 'wallRust', { light: [73.5, 2.7, cz1 + 0.2] });
    L.box(51.6, 3.4, cz0, 96.4, 3.8, cz1 + 0.2, 'limestoneDark', { nav: false }); noStand(51.6, 3.8, cz0, 96.4, cz1 + 0.2);
    deco(52.4, 3.3, cz0, 95.6, 3.4, cz1 - cw, 'ceiling');
    L.box(52.4, 0, cz0, 95.6, 0.05, cz1 - cw, 'concreteDark', { noCol: true });
    // corridor runs z -92..-86.4; cells north of it (z -102.4..-93), each 7 m wide with a barred door
    const cells = [];
    for (let i = 0; i < 4; i++) {
      const a = 56 + i * 9.5, b = a + 7;
      L.box(a - 1.5, 0, -93.2, a, 3.4, -92.8, 'limestone'); L.box(b, 0, -93.2, b + (i === 3 ? 0.5 : 2.5), 3.4, -92.8, 'limestone');
      L.box(a - 0.2, 0, cz0, a, 3.4, -93.2, 'limestone'); L.box(b, 0, cz0, b + 0.2, 3.4, -93.2, 'limestone');
      // the barred door: the door's own box is invisible, the bars ride on it when it lifts
      const bars = L.addDoor('cell' + (i + 1), a, 0, -93.1, b, 3.4, -92.9, 'steel');
      bars.mesh.material.visible = false; bars.lift = 3.2;
      const barMat = L.mats.steel.clone(); barMat.vertexColors = false;
      for (let x = a + 0.2; x < b; x += 0.35) { const r = new THREE.Mesh(L.geo('cylLo'), barMat); r.scale.set(0.025, 3.4, 0.025); r.position.set(x - (a + b) / 2, 0, 0); bars.mesh.add(r); }
      for (const y of [-1.1, 1.2]) { const r = new THREE.Mesh(L.geo('box'), barMat); r.scale.set(b - a, 0.06, 0.05); r.position.set(0, y, 0); bars.mesh.add(r); }
      L.box(a + 0.5, 0, cz0 + 0.3, a + 2.5, 0.5, cz0 + 1.2, 'wood'); // cot
      cells.push({ x: (a + b) / 2, z: cz0 + 3.8 });
      L.addInteract({ id: 'cell' + (i + 1), type: 'task', pos: [(a + b) / 2, 0, -91.8], face: [0, -1], radius: 1.8, hold: 1.6, prompt: 'Cut the lock', enabled: false });
      nightLamp((a + b) / 2, 3.1, -97, { color: 0xffe0b0, intensity: 1.0, distance: 8, prio: 1 });
    }
    MS.cells = cells;
    L.box(52.4, 0, -93.2, 54.5, 3.4, -92.8, 'limestone'); L.box(92, 0, -93.2, 95.6, 3.4, -92.8, 'limestone');
    for (let x = 58; x < 95; x += 9) nightLamp(x, 3.1, -89, { color: 0xffe0b0, intensity: 1.0, distance: 8, prio: 1 });
    // barracks, admin block, trucks, sandbags, the helipad
    house(48, -82, 62, -66, 1, rnd, { mat: 'limestoneDark' }); house(86, -82, 100, -64, 2, rnd, { mat: 'limestone' });
    car(66, -60, 0.4, false); car(84, -54, -0.2, true);
    sandbags(64, -76, 70, -75.3); sandbags(78, -64, 84, -63.3); sandbags(58, -58, 58.7, -52);
    K().crate(80, 0, -76); K().crate(81.2, 0, -76); K().crate(80.6, 1.2, -76, 1.0); K().barrel(66, -83); K().barrel(92, -60);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), L.mats.pad); pad.rotation.x = -PI / 2; pad.position.set(74, 0.03, -70); L.scene.add(pad);
    K().ammoCache('cacheFort', 62, 0, -84.5, 'z+');
    L.addInteract({ id: 'gateCharge', type: 'task', pos: [73, 0, -44.8], face: [0, -1], radius: 2.2, hold: 2.0, prompt: 'Plant the breaching charge', enabled: false });
    L.addInteract({ id: 'blockCharge', type: 'task', pos: [73.5, 0, -84.9], face: [0, -1], radius: 2.0, hold: 2.0, prompt: 'Plant the breaching charge', enabled: false });
    for (const [x, z] of [[56, -58], [92, -58], [56, -84], [92, -84], [73, -76]]) nightLamp(x, 4.5, z, { color: 0xfff0d0, intensity: 2.0, distance: 18, prio: 0.5 });
  }
  function roundabout(rnd) {
    L.cyl('limestone', 5, 0.3, -21, 5, 0.6); W.addCyl(5, -21, 5, 0, 0.6, { surf: 'concrete' });
    L.cyl('grassDry', 5, 0.61, -21, 4.8, 0.02); palm(3, -20, 7, rnd); palm(7, -23, 8, rnd);
    L.box(4.2, 0.6, -21.8, 5.8, 4.5, -20.2, 'limestone'); // monument plinth
    car(-6, -14, 0.9, true); car(16, -28, 2.4, false); car(-4, -29, -0.3, true);
    sandbags(12, -14, 17, -13.3);
    L.addInteract({ id: 'pilot', type: 'task', pos: [9.2, 0, -30.6], face: null, radius: 2.2, hold: 3.0, prompt: 'Pull the pilot out', enabled: false });
    for (const [x, z] of [[-10, -32], [20, -32], [-10, -10], [20, -10]]) lampPost(x, z, x < 0 ? 1 : -1, 0);
    for (let x = -90; x < 100; x += 18) { lampPost(x, -45, 0, 1); }
    for (let z = -30; z < 66; z += 16) { lampPost(30, z, 1, 0); }
  }
  function bazaar() {
    // the roofed stretch of the bazaar lane: dim, pillars, stalls both sides
    const x0 = 52, x1 = 58, za = -4, zb = 14;
    L.box(x0, 4.2, za, x1, 4.6, zb, 'roofTop', { nav: false }); noStand(x0, 4.6, za, x1, zb);
    for (let z = za; z <= zb; z += 3) for (const x of [x0 + 0.3, x1 - 0.3]) { deco(x - 0.2, 0, z - 0.2, x + 0.2, 4.2, z + 0.2, 'limestone', { ao: true }); solid(x - 0.2, 0, z - 0.2, x + 0.2, 4.2, z + 0.2); }
    for (let z = za + 1.5; z < zb; z += 6) { stall(x0 + 1.1, z, false, 'awningRed'); stall(x1 - 1.1, z + 3, false, 'awningBlue'); }
    for (let z = za + 2; z < zb; z += 5) nightLamp(55, 3.8, z, { color: 0xffb060, intensity: 1.2, distance: 8 });
    L.lamp(55, 3.8, 5, { color: 0xffb060, intensity: 0.8, distance: 8, pool: false }); // lit even by day: it's dark in there
  }
  function court(rnd) {
    const [x0, z0, x1, z1] = REGIONS.court, H = 2.8, t = 0.4;
    L.box(x0, 0, z0, x1, H, z0 + t, 'adobeLight');
    L.box(x0, 0, z0 + t, x0 + t, H, 24, 'adobeLight'); L.box(x0, 0, 30, x0 + t, H, z1 - t, 'adobeLight');                // west gate z 24..30
    L.box(x0, 0, z1 - t, 66, H, z1, 'adobeLight'); L.box(74, 0, z1 - t, x1, H, z1, 'adobeLight');                        // south gate x 66..74
    L.box(x1 - t, 0, z0 + t, x1, H, 34, 'adobeLight'); L.box(x1 - t, 0, 40, x1, H, z1 - t, 'adobeLight');              // east breach z 34..40
    for (let z = 34.3; z < 40; z += 1.4) L.addGeo('adobeLight', new THREE.IcosahedronGeometry(1, 0), L.mat4(x1 - 0.2 + (rnd() - 0.5), 0.3, z, rnd(), rnd(), 0, 0.6, 0.4, 0.7));
    for (const [a, b, c, d] of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0, x0 + t, z1], [x1 - t, z0, x1, z1]]) noStand(a, H, b, c, d);
    // the school: flat roof with a parapet you can fight from, stairs on its west side
    const sx0 = 64, sz0 = 26, sx1 = 80, sz1 = 36, sh = 4.2;
    L.box(sx0, 0, sz0, sx1, sh, sz1, 'adobeWhite', { top: 'roofTop' });
    for (let x = sx0 + 1.5; x < sx1 - 1; x += 3) deco(x, 1.3, sz1, x + 1.4, 3, sz1 + 0.05, 'winDark');
    for (const [a, b, c, d] of [[sx0, sz0, sx1, sz0 + 0.3], [sx0, sz1 - 0.3, sx1, sz1], [sx1 - 0.3, sz0, sx1, sz1]]) L.box(a, sh, b, c, sh + 1.1, d, 'adobeWhite');
    L.box(sx0, sh, sz0 + 0.3, sx0 + 0.3, sh + 1.1, sz0 + 4, 'adobeWhite');
    K().stairs(sx0 - 3, sz0 + 4.2, sx0, sz1 - 0.2, 0, sh, 'x+', 'adobeWhite');
    deco(sx0 + 3, 2.6, sz1 + 0.02, sx0 + 9, 3.6, sz1 + 0.06, 'paintGreen');
    // cover in the yard
    sandbags(62, 40, 67, 40.7); sandbags(78, 42, 83, 42.7); sandbags(70, 44, 70.7, 48); sandbags(84, 30, 84.7, 34);
    car(66, 44, 1.2, true); K().crate(82, 0, 26); K().crate(82, 0, 27.2, 1.0); K().barrel(62, 26);
    K().ammoCache('cacheCourt', 72, 0, 38.5, 'z+');
    for (const [x, z] of [[62, 24], [86, 24], [62, 48], [86, 48]]) nightLamp(x, 2.6, z, { color: 0xffc080, intensity: 1.5, distance: 14 });
    palm(60.5, 46, 6, rnd); palm(86, 45, 7, rnd);
    // a water tower across the street: sniper nest
    const tx = 96, tz = 18;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) deco(tx + dx - 0.15, 0, tz + dz - 0.15, tx + dx + 0.15, 9, tz + dz + 0.15, 'steel');
    L.box(tx - 2.2, 9, tz - 2.2, tx + 2.2, 9.3, tz + 2.2, 'steel'); L.cyl('paintGrey', tx, 11, tz, 1.9, 3.4); solid(tx - 1.7, 0, tz - 1.7, tx + 1.7, 9, tz + 1.7, 'metal', { nav: false });
  }
  function stadium(rnd) {
    const [x0, z0, x1, z1] = REGIONS.stadium, H = 5, t = 0.8;
    L.box(x0, 0, z0, 66, H, z0 + t, 'limestone'); L.box(74, 0, z0, x1, H, z0 + t, 'limestone');                       // north, gate x 66..74
    L.box(x0, 0, z1 - t, x1, H, z1, 'limestone');
    L.box(x0, 0, z0 + t, x0 + t, H, 64.8, 'limestone'); L.box(x0, 0, 70, x0 + t, H, z1 - t, 'limestone');              // west gate z 64.8..70
    L.box(x1 - t, 0, z0 + t, x1, H, z1 - t, 'limestone');
    for (const [a, b, c, d] of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0, x0 + t, z1], [x1 - t, z0, x1, z1]]) noStand(a, H, b, c, d);
    // pitch, stands on the long sides, a scoreboard
    L.box(56, 0, 74, 96, 0.03, 102, 'grassDry', { noCol: true, ao: false });
    for (const [a, b, c, d] of [[56, 74, 96, 74.1], [56, 101.9, 96, 102], [56, 74, 56.1, 102], [95.9, 74, 96, 102], [75.95, 74, 76.05, 102]]) deco(a, 0.031, b, c, 0.035, d, 'trim');
    for (const gx of [57, 94.6]) deco(gx, 0, 86, gx + 0.4, 2.4, 90, 'steel');
    // terraces: solid steps rising toward the walls; the north stand leaves an aisle from the gate to the pitch
    for (let i = 0; i < 5; i++) {
      const h = (i + 1) * 0.6, zs = 104 + i * 0.9, zn = 72.1 - i * 0.9;
      L.box(56, 0, zs, 96, h, zs + 0.9, 'limestoneDark');
      L.box(56, 0, zn - 0.9, 64, h, zn, 'limestoneDark'); L.box(76, 0, zn - 0.9, 96, h, zn, 'limestoneDark');
    }
    L.box(98, 0, 80, 104, 3.5, 96, 'limestoneDark'); // east stand block
    deco(64, 5, 108.6, 88, 9, 109, 'paintDark'); deco(66, 5.6, 108.55, 86, 8.4, 108.6, 'winWarm');
    for (const [x, z] of [[48, 68], [102, 68], [48, 106], [102, 106]]) { deco(x - 0.25, 0, z - 0.25, x + 0.25, 16, z + 0.25, 'steel'); deco(x - 1.5, 16, z - 0.5, x + 1.5, 18, z + 0.5, 'lampCool'); nightLamp(x + (x < 70 ? 4 : -4), 14, z + (z < 80 ? 4 : -4), { color: 0xdfe8ff, intensity: 3, distance: 40, prio: 1 }); }
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), L.mats.pad); pad.rotation.x = -PI / 2; pad.position.set(76, 0.05, 88); L.scene.add(pad);
    sandbags(68, 80, 73, 80.7); sandbags(80, 95, 85, 95.7); sandbags(62, 90, 62.7, 95); car(88, 82, 0.6, true);
    K().ammoCache('cacheStadium', 76, 0, 96.5, 'z-');
  }
  function edges() {
    // the city ends in the houses the generator packed to the edge; make the rim absolutely solid
    const T = 40;
    W.add(B.minX - 2, -2, B.minZ - 2, B.maxX + 2, T, B.minZ, { shoot: false }); W.add(B.minX - 2, -2, B.maxZ, B.maxX + 2, T, B.maxZ + 2, { shoot: false });
    W.add(B.minX - 2, -2, B.minZ, B.minX, T, B.maxZ, { shoot: false }); W.add(B.maxX, -2, B.minZ, B.maxX + 2, T, B.maxZ, { shoot: false });
  }

  // ---------------------------------------------------------------- build
  MS.build = function () {
    nightLamps.length = 0;
    const ad = materials(); ADOBE_KEYS = Object.keys(ad);
    const rnd = U.mulberry32(9127);
    L.killY = -12;
    L.box(B.minX - 60, -2, B.minZ - 60, B.maxX + 60, 0, B.maxZ + 60, 'sandGround', { ao: false, surf: 'concrete' });
    for (const s of STREETS) deco(s[0], 0, s[1], s[2], s[4] === 'road' ? 0.02 : 0.015, s[3], s[4], { ao: false });
    deco(REGIONS.fort[0], 0, REGIONS.fort[1], REGIONS.fort[2], 0.012, REGIONS.fort[3], 'packed', { ao: false });
    deco(REGIONS.court[0], 0, REGIONS.court[1], REGIONS.court[2], 0.012, REGIONS.court[3], 'packed', { ao: false });
    deco(REGIONS.villa[0], 0, REGIONS.villa[1], REGIONS.villa[2], 0.012, REGIONS.villa[3], 'grassDry', { ao: false });
    fillCity();
    outskirts(rnd); souk(rnd); square(rnd); villa(rnd); fort(rnd); roundabout(rnd); bazaar(); court(rnd); stadium(rnd); edges();

    // ------------------------------------------------------------ points
    const P = L.points;
    P.start = { x: -78, y: 0, z: 92, yaw: 0.6 };
    P.lz = { x: -78, y: 0, z: 92 };
    P.cp = {
      dropzone: P.start, checkpoint: { x: -56, y: 0, z: 66, yaw: -PI / 2 }, contact: { x: -44, y: 0, z: 66, yaw: -PI / 2 },
      soukTop: { x: -26, y: 0, z: 38, yaw: 0 }, square: { x: -12, y: 0, z: 30, yaw: 0 },
      ghost: { x: -104, y: 0, z: -40, yaw: 0 }, culvert: { x: -103, y: 0, z: -70.7, yaw: -PI / 2 }, villaIn: { x: -90, y: 0, z: -70.7, yaw: -PI / 2 },
      breach: { x: 73, y: 0, z: -30, yaw: 0 }, courtyard: { x: 73, y: 0, z: -58, yaw: 0 }, cellBlock: { x: 73.5, y: 0, z: -88.5, yaw: 0 },
      crash: { x: 2, y: 0, z: -16, yaw: -0.8 }, longwalk: { x: 12, y: 0, z: -20, yaw: -PI / 2 }, bazaar: { x: 55, y: 0, z: -10, yaw: PI },
      lastblock: { x: 70, y: 0, z: 40, yaw: 0 }, extraction: { x: 70, y: 0, z: 56, yaw: PI }, stadium: { x: 70, y: 0, z: 76, yaw: PI }
    };
    P.villa = { gate: { x: -69, z: -45 }, culvert: { x: -96, z: -70.7 }, study: { x: -66, y: 0.3, z: -84 }, exfil: { x: -104, y: 0, z: -72 }, car: MS.villaCar, garage: { x: -89, z: -58 } };
    P.fort = { gate: { x: 73, y: 0, z: -47 }, blockDoor: { x: 73.5, y: 0, z: -86 }, pad: { x: 74, y: 0, z: -70 } };
    P.crash = { x: 13, y: 0, z: -27 };
    P.court = { x: 72, y: 0, z: 36 };
    P.stadium = { x: 76, y: 0, z: 88 };
    P.checkpoint = { x: -51, y: 0, z: 66 }; P.square = { x: -9, y: 0, z: 22 };
    P.soukTop = { x: -26, y: 0, z: 36 };
    P.clockTower = { x: -9, y: 17.6, z: 20 };
    // spawn zones per mission (street points out of the player's usual sight lines)
    L.spawns.outskirts = [[-60, 50], [-50, 80], [-44, 64], [-66, 58], [-90, 60], [-70, 104]];
    L.spawns.souk = [[-26, 72], [-26, 36], [-37, 23], [-10, 32], [8, 28], [-2, 12], [0, -4], [20, 21], [-26, 60]];
    L.spawns.square = [[0, -4], [0, 2], [26, 21], [20, 21], [-37, 23], [-40, 22], [-26, 40], [8, 32], [-26, 12]];
    L.spawns.villa = [[-70, -40], [-50, -40], [-88, -40], [-60, -50], [-86, -52]];
    L.spawns.fort = [[56, -40], [90, -40], [36, -30], [100, -40], [20, -40], [60, -60], [88, -60]];
    L.spawns.fortIn = [[60, -60], [88, -60], [56, -74], [92, -76], [74, -80], [66, -64]];
    L.spawns.crash = [[-13, -34], [-13, -12], [4, -40], [-30, -40], [30, -40], [35, -20], [25, -20], [0, 2], [-40, -40], [4, -34]];
    L.spawns.walk = [[35, -30], [35, -8], [35, 10], [45, -20], [55, -24], [55, 26], [56, -18], [36, 30], [20, -20], [8, -34]];
    L.spawns.court = [[100, 36], [96, 42], [55, 28], [55, 14], [70, 60], [70, 56], [36, 30], [36, 44], [104, 32]];
    L.spawns.stadium = [[42, 67], [70, 60], [36, 50], [36, 64], [100, 36], [60, 68], [90, 68], [56, 100], [96, 100], [100, 84]];
    L.points.nightLamps = nightLamps.slice();
  };

  // ---------------------------------------------------------------- time of day
  const TIMES = {
    dawn: { fog: [0.62, 0.52, 0.46], fogDensity: 0.006, hemi: [0xe8c8b0, 0x5a4838, 0.55], sun: [0xffb070, 1.3], sunDir: [0.75, 0.25, 0.35],
      sky: { zen: [0.16, 0.24, 0.44], hor: [0.9, 0.62, 0.44], glow: [1.0, 0.5, 0.2], glowDir: [0.75, 0.35], glow2: [0.1, 0.08, 0.1], glow2Dir: [-1, 0], cloudDark: [0.45, 0.36, 0.36], cloudLit: [1.1, 0.72, 0.5], stars: 0.02, moon: 0 },
      post: { bloom: 0.25, exposure: 0.85, sat: 1.08, shadow: [0.0, 0.0, 0.01], high: [0.02, 0.006, -0.01], threshold: 1.3 }, env: { top: [0.4, 0.45, 0.6], bottom: [0.45, 0.36, 0.26], band: [0.8, 0.5, 0.3] }, night: false, dust: 0.6 },
    day: { fog: [0.8, 0.74, 0.62], fogDensity: 0.0045, hemi: [0xd8e2f0, 0x7a6448, 0.62], sun: [0xfff2dc, 1.9], sunDir: [0.4, 0.8, 0.3],
      sky: { zen: [0.22, 0.4, 0.7], hor: [0.86, 0.8, 0.68], glow: [0.5, 0.42, 0.28], glowDir: [0.4, 0.3], glow2: [0.12, 0.1, 0.06], glow2Dir: [-1, 0], cloudDark: [0.8, 0.78, 0.76], cloudLit: [1.1, 1.05, 0.98], stars: 0, moon: 2 },
      post: { bloom: 0.1, exposure: 0.74, sat: 1.06, shadow: [0, 0, 0.004], high: [0.012, 0.005, -0.008], threshold: 1.6 }, env: { top: [0.6, 0.7, 0.9], bottom: [0.5, 0.42, 0.3], band: [0.6, 0.55, 0.45] }, night: false, dust: 0.8 },
    afternoon: { fog: [0.84, 0.7, 0.52], fogDensity: 0.0055, hemi: [0xe8dcc8, 0x7a5a38, 0.58], sun: [0xffd8a0, 1.7], sunDir: [-0.6, 0.55, 0.45],
      sky: { zen: [0.24, 0.36, 0.6], hor: [0.95, 0.78, 0.55], glow: [0.8, 0.5, 0.22], glowDir: [-0.6, 0.45], glow2: [0.1, 0.08, 0.05], glow2Dir: [1, 0], cloudDark: [0.8, 0.7, 0.6], cloudLit: [1.2, 1.0, 0.8], stars: 0, moon: 2 },
      post: { bloom: 0.15, exposure: 0.76, sat: 1.1, shadow: [0.004, 0, -0.004], high: [0.02, 0.008, -0.012], threshold: 1.5 }, env: { top: [0.55, 0.6, 0.8], bottom: [0.55, 0.42, 0.28], band: [0.8, 0.6, 0.4] }, night: false, dust: 1 },
    dusk: { fog: [0.42, 0.3, 0.3], fogDensity: 0.007, hemi: [0x8a7aa0, 0x3a2a24, 0.45], sun: [0xff7a40, 1.1], sunDir: [-0.85, 0.12, 0.3],
      sky: { zen: [0.06, 0.08, 0.2], hor: [0.8, 0.4, 0.25], glow: [1.2, 0.45, 0.15], glowDir: [-0.85, 0.3], glow2: [0.15, 0.08, 0.2], glow2Dir: [1, 0], cloudDark: [0.25, 0.18, 0.24], cloudLit: [1.1, 0.5, 0.3], stars: 0.1, moon: 0.3 },
      post: { bloom: 0.35, exposure: 0.95, sat: 1.1, shadow: [0.0, -0.002, 0.012], high: [0.02, 0.004, -0.01], threshold: 1.2 }, env: { top: [0.2, 0.2, 0.35], bottom: [0.3, 0.2, 0.16], band: [0.8, 0.4, 0.2] }, night: true, dust: 0.5 },
    night: { fog: [0.015, 0.02, 0.035], fogDensity: 0.013, hemi: [0x34436a, 0x0c0b0a, 0.16], sun: [0x8fa6d8, 0.26], sunDir: [0.3, 0.7, -0.5],
      sky: { zen: [0.004, 0.007, 0.018], hor: [0.04, 0.045, 0.07], glow: [0.1, 0.07, 0.05], glowDir: [0, -1], glow2: [0.03, 0.04, 0.08], glow2Dir: [1, 0.3], cloudDark: [0.01, 0.012, 0.018], cloudLit: [0.08, 0.08, 0.1], stars: 0.9, moon: 1 },
      post: { bloom: 0.55, exposure: 1.0, sat: 0.85, shadow: [-0.003, 0.0, 0.012], high: [0.004, 0.004, 0.002], threshold: 1.1 }, env: { top: [0.01, 0.014, 0.025], bottom: [0.012, 0.01, 0.009], band: [0.025, 0.022, 0.02], panels: [[0.1, 0.1, 0.12], [0.08, 0.08, 0.1], [0.12, 0.1, 0.08], [0.08, 0.08, 0.08]] }, night: true, dust: 0.1 }
  };
  MS.TIMES = TIMES;
  const v3 = (a, v) => v.set(a[0], a[1], a[2]);
  /** Relight the city for a mission: sun, sky, fog, reflections, grading, street lamps, lit windows. */
  MS.setTime = function (name) {
    const t = TIMES[name] || TIMES.day, G = CF.Game, scene = G.scene;
    if (!scene || G.mapId !== 'story') return;
    MS.time = name;
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
    if (L.mountainMat) { const u = L.mountainMat.uniforms; u.uSun.value.copy(G.moonDir); u.uHaze.value.set(t.fog[0], t.fog[1], t.fog[2]); const k = Math.min(1, t.sun[1] / 1.9); u.uRock.value.set(0.34 * k + 0.02, 0.22 * k + 0.02, 0.14 * k + 0.02); u.uSnow.value.set(0.52 * k + 0.03, 0.4 * k + 0.03, 0.27 * k + 0.03); }
    if (L.envRT) { L.envRT.dispose(); L.envRT = null; }
    const k = t.sun[1] / 1.9, pn = [[1.4, 1.3, 1.1], [1.2, 1.2, 1.3], [1.3, 1.2, 1.0], [1.2, 1.2, 1.2]].map((c) => c.map((v) => v * Math.min(1, k + 0.15)));
    const th = Object.assign({}, G.mapDef.theme, { env: Object.assign({ panels: pn }, t.env) });
    L.buildEnv(CF.Post.renderer, th); G.vmScene.environment = scene.environment;
    CF.Post.setState(t.post);
    for (const lp of L.points.nightLamps || []) lp.on = t.night;
    L.mats.winWarm.color.setRGB(t.night ? 1.3 : 0.06, t.night ? 0.75 : 0.06, t.night ? 0.35 : 0.06);
    CF.FX.dustRate = t.dust; CF.FX.dustColor = t.night ? [0.25, 0.25, 0.3] : [0.95, 0.82, 0.62];
    MS.night = t.night;
  };
})(window.CF);
