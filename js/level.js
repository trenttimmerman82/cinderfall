'use strict';
/* Cinderfall — level builder: batched world geometry, materials, sky, lights, dynamic props. */
(function (CF) {
  const U = CF.U, W = CF.World;
  const L = CF.Level = {};

  // World-UV scale per material (1 texture repeat per 1/s metres)
  const UVS = { facade: 1 / 12, concrete: 0.25, concreteDark: 0.25, asphalt: 1 / 6, metalFloor: 0.5, wall: 0.25, wallRust: 0.25, hazard: 1, paintYellow: 0.33, paintGrey: 0.33, paintDark: 0.33, paintRed: 0.5, paintGreen: 0.33, steel: 0.5, rubber: 0.5, crate: 1 / 1.2,
    grass: 1 / 5, sand: 1 / 6, dirt: 1 / 6, wallpaper: 0.5, wallpaper2: 0.5, checker: 0.5, carpetBeige: 0.5, stone: 0.5, sidingWhite: 0.25, sidingTeal: 0.25, boardYellow: 0.4, lattice: 1, stucco: 0.25, sidingBlue: 0.25, boardBrown: 0.4, woodDark: 0.5, trailerWhite: 0.4, sidingGreen: 0.25, sidingYellow: 0.25, roofing: 0.3, brick: 0.5, floorWood: 0.4, wood: 0.5, fence: 0.5, carpet: 0.5,
    snow: 1 / 7, snowDirty: 1 / 7, ice: 1 / 6, iceDark: 1 / 6, basalt: 1 / 4, panelOrange: 1 / 3, panelWhite: 1 / 3, panelRed: 1 / 3, panelBlue: 1 / 3, panelDark: 1 / 3, grate: 0.5 };
  const SURF = { snow: 'snow', snowDirty: 'snow', ice: 'ice', iceDark: 'ice', grate: 'metal', panelOrange: 'metal', panelWhite: 'metal', panelRed: 'metal', panelBlue: 'metal', panelDark: 'metal', metalFloor: 'metal', wall: 'metal', wallRust: 'metal', paintYellow: 'metal', paintGrey: 'metal', paintDark: 'metal', paintRed: 'metal', paintGreen: 'metal', steel: 'metal', hazard: 'metal', crate: 'metal' };
  const FACES = [
    { c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], n: [1, 0, 0], u: (x, y, z) => -z, v: (x, y) => y },
    { c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], n: [-1, 0, 0], u: (x, y, z) => z, v: (x, y) => y },
    { c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], n: [0, 1, 0], u: (x) => x, v: (x, y, z) => -z },
    { c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], n: [0, -1, 0], u: (x) => x, v: (x, y, z) => z },
    { c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], n: [0, 0, 1], u: (x) => x, v: (x, y) => y },
    { c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], n: [0, 0, -1], u: (x) => -x, v: (x, y) => y }
  ];

  L.init = function (scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.batches = {}; this.lamps = []; this.pool = []; this.animated = []; this.interactables = []; this.doors = {};
    this.barrels = []; this.pickups = []; this.spawns = {}; this.points = {}; this.hazards = []; this.emitters = []; this.cones = [];
    this.poolGeo = { pos: [], uv: [], col: [], idx: [] };
    this.blobGeo = { pos: [], uv: [], idx: [] };
    this.relightT = 0; this.finished = false; this.killY = null;
    this.makeMaterials();
  };

  // ------------------------------------------------------------ materials
  L.makeMaterials = function () {
    const T = CF.Tex.list, M = this.mats = {};
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.6 }, o));
    const tri = (t) => ({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1 });
    M.concrete = std(Object.assign(tri(T.concrete), { color: 0xbfc3c9, metalness: 0 }));
    M.concreteDark = std(Object.assign(tri(T.concrete), { color: 0x8e939b, metalness: 0 }));
    M.asphalt = std(Object.assign(tri(T.asphalt), { color: 0xffffff, metalness: 0, envMapIntensity: 0.35 }));
    M.metalFloor = std(Object.assign(tri(T.metalFloor), { color: 0xc4c8ce, metalness: 0.8 }));
    M.wall = std(Object.assign(tri(T.wall), { metalness: 0.35 }));
    M.wallRust = std(Object.assign(tri(T.wallRust), { metalness: 0.3 }));
    M.hazard = std({ map: T.hazard.map, roughnessMap: T.hazard.roughnessMap, roughness: 1, metalness: 0.3 });
    const pm = tri(T.paintMetal);
    M.paintYellow = std(Object.assign({}, pm, { color: 0xc08a1e, metalness: 0.35 }));
    M.paintGrey = std(Object.assign({}, pm, { color: 0x6a737e, metalness: 0.5 }));
    M.paintDark = std(Object.assign({}, pm, { color: 0x2b323a, metalness: 0.6 }));
    M.paintRed = std(Object.assign({}, pm, { color: 0x9c2016, metalness: 0.3 }));
    M.paintGreen = std(Object.assign({}, pm, { color: 0x3b5739, metalness: 0.35 }));
    M.steel = std({ map: T.paintMetal.map, color: 0x9aa1aa, metalness: 0.9, roughness: 0.3 });
    M.rubber = std({ color: 0x1b1b1b, roughness: 0.95, metalness: 0 });
    M.crate = std({ map: T.crate.map, normalMap: T.crate.normalMap, roughness: 0.7, metalness: 0.3 });
    for (const k in T.containers) M['cont_' + k] = std({ map: T.containers[k].map, normalMap: T.containers[k].normalMap, roughness: 0.62, metalness: 0.45 });
    const basic = (r, g, b, o) => new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(r, g, b) }, o));
    M.lampWarm = basic(6, 3.5, 1.4); M.lampCool = basic(3.2, 3.9, 4.8); M.lampRed = basic(8, 0.5, 0.25);
    M.lampGreen = basic(0.6, 5, 1.3); M.lampAmber = basic(6, 2.7, 0.35);
    M.molten = basic(3.4, 2.0, 1.4, { map: T.molten.map });
    M.moltenTop = basic(3.0, 1.8, 1.2, { map: T.molten.map });
    M.windowWarm = basic(0.85, 0.37, 0.12);
    M.windowCool = basic(0.35, 0.5, 0.65);
    M.sign = basic(1.4, 1.35, 1.3, { map: T.signFoundry });
    M.signDanger = new THREE.MeshStandardMaterial({ map: T.signDanger, roughness: 0.6, metalness: 0.1 });
    M.line = new THREE.MeshStandardMaterial({ color: 0xa88a30, roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.skyline = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.006, 0.008, 0.012), fog: false });
    M.skylineWin = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 0.3), fog: false });
    M.skylineRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.4, 0.2), fog: false });
    const scr = (t) => basic(1.7, 1.7, 1.7, { map: t });
    M.screenIdle = scr(T.screenIdle); M.screenOff = scr(T.screenOff); M.screenOn = scr(T.screenOn);
    M.screenUplink = scr(T.screenUplink); M.screenUplinkOn = scr(T.screenUplinkOn);
    M.pools = new THREE.MeshBasicMaterial({ map: T.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    M.blob = new THREE.MeshBasicMaterial({ map: T.blob, color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.pad = new THREE.MeshStandardMaterial({ map: T.pad, transparent: true, depthWrite: false, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    // neon city
    for (const n in CF.Neon.C) { const c = CF.Neon.C[n]; M['neon_' + n] = basic(c[0], c[1], c[2]); }
    const fa = CF.Neon.facade();
    M.facade = std({ map: fa.map, emissiveMap: fa.emissiveMap, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.2, roughness: 0.62, metalness: 0.3, envMapIntensity: 0.45 });
    M.glass = std({ color: 0x0b1220, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.4 });
    M.tile = std(Object.assign(tri(T.metalFloor), { color: 0x6c6f7a, metalness: 0.4 }));
    // daylight suburb (Nuketown)
    const tint = (t, color, o) => std(Object.assign(tri(t), { color, metalness: 0 }, o || {}));
    M.grass = std(Object.assign(tri(T.grass), { color: 0xc4d0a8, metalness: 0 })); M.sand = tint(T.concrete, 0xc9a877); M.mesa = tint(T.concrete, 0xa9724a);
    M.sidingGreen = tint(T.siding, 0x7fbf8e); M.sidingYellow = tint(T.siding, 0xf2cf62);
    M.trim = tint(T.concrete, 0xf2efe6); M.plaster = tint(T.concrete, 0xe6dccb); M.roofing = tint(T.shingles, 0x8a5040);
    M.brick = std(Object.assign(tri(T.brick), { color: 0xffffff, metalness: 0 })); M.floorWood = tint(T.planks, 0xc0905c); M.wood = tint(T.planks, 0x9a6a40);
    M.fence = tint(T.planks, 0xf4f0e6); M.carpet = tint(T.carpet, 0x7a2a2a); M.fabric = tint(T.concrete, 0x3f6f8f);
    M.counter = tint(T.concrete, 0xd9d4c8); M.cardboard = tint(T.concrete, 0xb58d5a); M.bark = tint(T.concrete, 0x4d3a2a);
    M.trailer = tint(T.paintMetal, 0xd8d8d0, { metalness: 0.4 });
    // clean glossy car paint (no grime map)
    const paint = (c) => std({ color: c, metalness: 0.35, roughness: 0.32, envMapIntensity: 0.9 });
    M.busYellow = paint(0xf2b21a); M.paintBlue = paint(0x3d6fb0); M.paintMint = paint(0x7cc8b0); M.paintCherry = paint(0xb8242a);
    M.paintCream = paint(0xd9cfae); M.paintTaxi = paint(0xe8b52a); M.busRoof = paint(0xefece2); M.roadBlock = paint(0x3f7d4c); M.redDoor = paint(0xa8322a);
    M.olive = std({ color: 0x343d24, metalness: 0.2, roughness: 0.75 }); M.canvasOlive = tint(T.carpet, 0x6a7248);
    const plain = (t, c) => std(Object.assign(tri(t), { color: c, metalness: 0 }));
    M.dirt = plain(T.dirt, 0xffffff); M.stone = plain(T.stone, 0xffffff); M.checker = plain(T.checker, 0xffffff);
    M.wallpaper = std({ map: T.wallpaper.map, roughness: 0.85, metalness: 0 }); M.wallpaper2 = std({ map: T.wallpaper2.map, roughness: 0.85, metalness: 0 });
    M.carpetBeige = tint(T.carpet, 0xb3a58c); M.rug = tint(T.carpet, 0x6b4630); M.couch = tint(T.carpet, 0x7d7a4c); M.bedspread = tint(T.carpet, 0xcdbb90);
    M.sidingWhite = tint(T.siding, 0xf2f0ea); M.sidingTeal = tint(T.siding, 0x39b39a); M.sidingBlue = tint(T.siding, 0x8db5d6);
    M.boardYellow = tint(T.planks, 0xf0c040); M.boardBrown = tint(T.planks, 0x8a6446); M.trailerWhite = tint(T.planks, 0xefe8da); M.woodDark = tint(T.planks, 0x5c3a22);
    M.cabinet = tint(T.planks, 0x8a5530); M.stucco = tint(T.concrete, 0xdc9a90); M.roofGray = tint(T.shingles, 0x70757c); M.roofLight = tint(T.shingles, 0xb8b4aa);
    M.shutterBlue = tint(T.planks, 0x3d6d99); M.shutterBrown = tint(T.planks, 0x7a4b2a); M.shutterWhite = tint(T.planks, 0xf0eee6);
    M.ceiling = std({ color: 0xf1ede4, metalness: 0, roughness: 0.95 }); M.appliance = std({ color: 0xf2f0ea, metalness: 0.1, roughness: 0.25 }); M.mannequin = std({ color: 0xe8d6c2, metalness: 0, roughness: 0.45 });
    M.sandbag = tint(T.carpet, 0xa8966c); M.rock = tint(T.stone, 0xc2ab8c); M.dryBrush = tint(T.grass, 0xb8ad78); M.joshua = tint(T.grass, 0x8a9a62);
    M.lattice = std({ map: T.lattice, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, metalness: 0 });
    M.chrome = std({ color: 0xdfe3e8, metalness: 1, roughness: 0.18, envMapIntensity: 1.2 }); M.shutter = tint(T.planks, 0x2f4a3a); M.garageDoor = tint(T.siding, 0xf0ece0);
    M.leaves2 = tint(T.grass, 0x9fc07a); M.pine = tint(T.grass, 0x5f8a6a); M.leaves = tint(T.grass, 0xb8d890);
    M.glassDay = std({ color: 0x223040, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.2 });
    // polar station (Whiteout)
    M.snow = std(Object.assign(tri(T.snow), { color: 0xf4f7ff, metalness: 0, envMapIntensity: 0.5 }));
    M.snowDirty = std(Object.assign(tri(T.snow), { color: 0xb9bcc0, metalness: 0, envMapIntensity: 0.4 }));
    M.ice = std(Object.assign(tri(T.ice), { color: 0xc4dcee, metalness: 0.05, envMapIntensity: 0.9 }));
    M.iceDark = std(Object.assign(tri(T.ice), { color: 0x6f9fc4, metalness: 0.05, envMapIntensity: 0.9 }));
    M.basalt = std(Object.assign(tri(T.basalt), { color: 0xffffff, metalness: 0 }));
    const panel = (c) => std(Object.assign(tri(T.panel), { color: c, metalness: 0.15 }));
    M.panelOrange = panel(0xe0562a); M.panelWhite = panel(0xe9e7e1); M.panelRed = panel(0xb3301f); M.panelBlue = panel(0x2f6aa6); M.panelDark = panel(0x3b414a);
    M.grate = std(Object.assign(tri(T.metalFloor), { color: 0x8d949c, metalness: 0.75 }));
    M.crystal = std({ color: 0x8fd8ff, emissive: new THREE.Color(0.08, 0.45, 0.75), roughness: 0.08, metalness: 0.3, envMapIntensity: 1.6 });
    M.crystalGlow = basic(0.5, 3.2, 4.6);
    M.lampHeat = basic(6.5, 2.6, 0.5); M.flame = basic(8, 3.2, 0.6);
    M.signHalden = new THREE.MeshStandardMaterial({ map: T.signHalden, roughness: 0.6, metalness: 0.1 });
    M.signCold = new THREE.MeshStandardMaterial({ map: T.signCold, roughness: 0.6, metalness: 0.1 });
    for (const k of ['scrLog', 'scrLogOn', 'scrMast', 'scrMastOn', 'scrBeacon', 'scrBeaconOn']) M[k] = scr(T[k]);
  };
  /** Wet-night tuning: glossier ground and stronger reflections. */
  L.applyTheme = function (th) {
    const M = this.mats;
    this.poolMul = th.poolMul != null ? th.poolMul : 1;
    if (th.wet) {
      // the roughness map carries the puddles; only they read as mirror-wet
      M.asphalt.roughness = 1; M.asphalt.envMapIntensity = 0.7; M.asphalt.color.setRGB(0.74, 0.74, 0.76); M.asphalt.normalScale.set(0.55, 0.55);
      M.concrete.roughness = 0.9; M.concrete.envMapIntensity = 0.5;
      M.metalFloor.roughness = 0.85; M.metalFloor.envMapIntensity = 0.65;
      for (const k of ['wall', 'wallRust', 'paintGrey', 'paintDark', 'steel']) M[k].envMapIntensity = 0.6;
      M.facade.envMapIntensity = 0.45; M.glass.envMapIntensity = 0.85;
    }
  };

  // ------------------------------------------------------------ batching
  L.batch = function (m) {
    return this.batches[m] || (this.batches[m] = { pos: [], nrm: [], uv: [], col: [], idx: [] });
  };
  function pushQuad(b, P, n, UV, C) {
    const base = b.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      b.pos.push(P[k][0], P[k][1], P[k][2]); b.nrm.push(n[0], n[1], n[2]);
      b.uv.push(UV[k][0], UV[k][1]); b.col.push(C[k], C[k], C[k]);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  L.addFace = function (m, f, X, Y, Z, o) {
    const F = FACES[f], b = this.batch(m), s = o.uvScale || UVS[m] || 0.25, tint = o.tint || 1;
    const corner = (c, y) => [X[c[0]], y === undefined ? Y[c[1]] : y, Z[c[2]]];
    const uvOf = (p) => [F.u(p[0], p[1], p[2]) * s + (o.uo || 0), F.v(p[0], p[1], p[2]) * s + (o.vo || 0)];
    const vertical = f !== 2 && f !== 3, h = Y[1] - Y[0];
    if (vertical && o.ao !== false && h > 0.45 && (Y[0] < 1.3 || o.ao === true)) {
      const ys = Y[0] + Math.min(0.85, h * 0.4), lo = 0.42 * tint;
      const p0 = corner(F.c[0]), p1 = corner(F.c[1]), p2 = corner(F.c[2], ys), p3 = corner(F.c[3], ys);
      pushQuad(b, [p0, p1, p2, p3], F.n, [uvOf(p0), uvOf(p1), uvOf(p2), uvOf(p3)], [lo, lo, tint, tint]);
      const q0 = corner(F.c[0], ys), q1 = corner(F.c[1], ys), q2 = corner(F.c[2]), q3 = corner(F.c[3]);
      pushQuad(b, [q0, q1, q2, q3], F.n, [uvOf(q0), uvOf(q1), uvOf(q2), uvOf(q3)], [tint, tint, tint, tint]);
    } else {
      const P = F.c.map((c) => corner(c));
      pushQuad(b, P, F.n, P.map(uvOf), [tint, tint, tint, tint]);
    }
  };

  /** Solid box: collider + world-UV geometry. o: {top, side, surf, nav, solid, shoot, noCol, noMesh, skip:[faces], tint, ao, tag} */
  L.box = function (x0, y0, z0, x1, y1, z1, m, o) {
    o = o || {};
    const X = [Math.min(x0, x1), Math.max(x0, x1)], Y = [Math.min(y0, y1), Math.max(y0, y1)], Z = [Math.min(z0, z1), Math.max(z0, z1)];
    let col = null;
    if (!o.noCol) col = W.add(X[0], Y[0], Z[0], X[1], Y[1], Z[1], { surf: o.surf || SURF[m] || 'concrete', nav: o.nav, solid: o.solid, shoot: o.shoot, tag: o.tag });
    if (!o.noMesh) {
      for (let f = 0; f < 6; f++) {
        if (f === 3 && Y[0] <= 0.001 && !o.bottom) continue;
        if (o.skip && o.skip.indexOf(f) >= 0) continue;
        const mm = (f === 2 && o.top) ? o.top : (f !== 2 && f !== 3 && o.side) ? o.side : m;
        this.addFace(mm, f, X, Y, Z, o);
      }
    }
    return col;
  };

  /** Bake an arbitrary geometry (transformed) into a material batch. */
  const _nm = new THREE.Matrix3(), _v = new THREE.Vector3();
  L.addGeo = function (m, geo, matrix, tint) {
    const b = this.batch(m), g = geo.index ? geo : geo;
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    _nm.getNormalMatrix(matrix);
    const base = b.pos.length / 3, t = tint || 1;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(matrix); b.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize(); b.nrm.push(_v.x, _v.y, _v.z);
      if (UV) b.uv.push(UV.getX(i), UV.getY(i)); else b.uv.push(0, 0);
      b.col.push(t, t, t);
    }
    if (g.index) { const I = g.index; for (let i = 0; i < I.count; i++) b.idx.push(base + I.getX(i)); }
    else for (let i = 0; i < P.count; i++) b.idx.push(base + i);
  };
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  L.mat4 = function (x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    _s.set(sx || 1, sy || sx || 1, sz || sx || 1); _p.set(x, y, z);
    return _m4.compose(_p, _q, _s).clone();
  };
  // shared primitive geometries
  const GEO = {};
  L.geo = function (kind) {
    if (GEO[kind]) return GEO[kind];
    let g;
    if (kind === 'cyl') g = new THREE.CylinderGeometry(1, 1, 1, 20, 1);
    else if (kind === 'cylLo') g = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
    else if (kind === 'box') g = new THREE.BoxGeometry(1, 1, 1);
    else if (kind === 'sphere') g = new THREE.SphereGeometry(1, 16, 10);
    else if (kind === 'torus') g = new THREE.TorusGeometry(1, 0.08, 6, 24);
    GEO[kind] = g; return g;
  };
  L.cyl = function (m, x, y, z, r, h, rx, rz, lo) { this.addGeo(m, this.geo(lo ? 'cylLo' : 'cyl'), this.mat4(x, y, z, rx, 0, rz, r, h, r)); };
  L.pipe = function (m, x0, y0, z0, x1, y1, z1, r) {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), d = b.clone().sub(a), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const mm = new THREE.Matrix4().compose(a.add(b).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
    this.addGeo(m, this.geo('cylLo'), mm);
  };
  /** Per-face-UV box mesh baked into a batch (containers, crates). */
  L.propBox = function (m, cx, y0, cz, sx, sy, sz, ry) {
    this.addGeo(m, this.geo('box'), this.mat4(cx, y0 + sy / 2, cz, 0, ry || 0, 0, sx, sy, sz));
  };

  // ------------------------------------------------------------ ground decals
  L.groundQuad = function (target, x, y, z, sx, sz, rot, color) {
    const base = target.pos.length / 3, c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const p of pts) {
      const lx = p[0] * sx / 2, lz = p[1] * sz / 2;
      target.pos.push(x + lx * c - lz * s, y, z + lx * s + lz * c);
      target.uv.push((p[0] + 1) / 2, (p[1] + 1) / 2);
      if (target.col) target.col.push(color[0], color[1], color[2]);
    }
    target.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  L.blob = function (x, z, sx, sz, y) { this.groundQuad(this.blobGeo, x, (y || 0) + 0.012, z, sx, sz, 0); };

  // ------------------------------------------------------------ lamps (pooled real lights + fake pools + cones)
  L.lamp = function (x, y, z, o) {
    o = o || {};
    const lamp = {
      pos: new THREE.Vector3(x, y, z), color: new THREE.Color(o.color || 0xff9a45), intensity: o.intensity || 2.2,
      distance: o.distance || 20, prio: o.prio || 0, flicker: o.flicker || 0, pulse: o.pulse || 0, on: o.on !== false,
      zone: o.zone || null, fl: 1, flT: 0, mat: o.mat || null, baseCol: o.mat ? o.mat.color.clone() : null
    };
    this.lamps.push(lamp);
    lamp.opts = o;
    // Pools and cones need ground raycasts, so they are created in finish() once the grid exists.
    if (this.finished) this.lampDecor(lamp);
    return lamp;
  };
  L.lampDecor = function (lamp) {
    const o = lamp.opts;
    const gy = o.groundY != null ? o.groundY : W.groundHeight(lamp.pos.x, lamp.pos.y - 0.3, lamp.pos.z);
    lamp.groundY = gy;
    if (o.pool !== false) {
      const size = o.poolSize || lamp.distance * 0.75, k = (o.poolStrength || 0.32) * (this.poolMul || 1), c = lamp.color;
      this.groundQuad(this.poolGeo, lamp.pos.x, gy + 0.02, lamp.pos.z, size, size, 0, [c.r * k, c.g * k, c.b * k]);
    }
    if (o.cone) this.addCone(lamp, o.cone);
  };
  L.addCone = function (lamp, radius) {
    const h = lamp.pos.y - (lamp.groundY || 0);
    const geo = new THREE.ConeGeometry(radius, h, 24, 1, true);
    geo.translate(0, -h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: lamp.color.clone().multiplyScalar(0.07) }, uOn: { value: 1 } },
      vertexShader: 'varying float vY; varying float vF; uniform float uH; void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vec3 n = normalize(normalMatrix*normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOn; varying float vY; varying float vF; void main(){ float a = pow(clamp(vY, 0.0, 1.0), 1.6) * pow(clamp(vF, 0.0, 1.0), 1.8) * uOn; gl_FragColor = vec4(uColor * a, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(lamp.pos); mesh.renderOrder = 5;
    this.scene.add(mesh); lamp.cone = mesh; this.cones.push(mesh);
  };
  L.makeLightPool = function () {
    const n = CF.bootQuality === 'low' ? 5 : CF.bootQuality === 'medium' ? 8 : 11;
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.position.set(0, -100, 0);
      this.scene.add(l);
      this.pool.push({ light: l, lamp: null, w: 0, wanted: false });
    }
  };
  L.updateLights = function (cam, dt, t) {
    this.relightT -= dt;
    const lamps = this.lamps;
    if (this.relightT <= 0) {
      this.relightT = 0.2;
      for (const lp of lamps) {
        const d2 = lp.pos.distanceToSquared(cam);
        lp.score = lp.on && d2 < (lp.distance + 30) * (lp.distance + 30) ? d2 / (1 + lp.prio) : Infinity;
        lp.want = false;
      }
      const sorted = lamps.filter((l) => l.score < Infinity).sort((a, b) => a.score - b.score);
      for (let i = 0; i < Math.min(this.pool.length, sorted.length); i++) sorted[i].want = true;
      for (const p of this.pool) p.wanted = !!(p.lamp && p.lamp.want);
      for (const lp of sorted) {
        if (!lp.want || this.pool.some((p) => p.lamp === lp)) continue;
        const free = this.pool.find((p) => !p.lamp) || this.pool.find((p) => !p.wanted && p.w < 0.05);
        if (free) { free.lamp = lp; free.wanted = true; free.w = 0; }
      }
    }
    for (const lp of lamps) {
      if (lp.flicker) {
        lp.flT -= dt;
        if (lp.flT <= 0) { lp.flTarget = Math.random() < lp.flicker ? U.rand(0, 0.25) : 1; lp.flT = lp.flTarget < 1 ? U.rand(0.03, 0.12) : U.rand(0.2, 2.5); }
        lp.fl = U.damp(lp.fl, lp.flTarget, 30, dt);
      } else if (lp.pulse) lp.fl = 0.55 + 0.45 * Math.sin(t * lp.pulse);
      else lp.fl = 1;
      if (lp.mat && lp.baseCol) lp.mat.color.copy(lp.baseCol).multiplyScalar(lp.on ? lp.fl : 0.02);
      if (lp.cone) lp.cone.material.uniforms.uOn.value = lp.on ? lp.fl : 0;
    }
    for (const p of this.pool) {
      p.w = U.damp(p.w, p.wanted ? 1 : 0, 7, dt);
      const l = p.light;
      if (!p.lamp) { l.intensity = 0; continue; }
      if (!p.wanted && p.w < 0.02) { p.lamp = null; l.intensity = 0; continue; }
      const lp = p.lamp;
      l.position.copy(lp.pos); l.color.copy(lp.color); l.distance = lp.distance;
      l.intensity = lp.on ? lp.intensity * p.w * lp.fl : 0;
    }
  };

  // ------------------------------------------------------------ sky + environment (theme driven)
  const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }';
  const SKY_FS = [
    'uniform vec3 uMoon; uniform float uTime; varying vec3 vDir;',
    'uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGlow; uniform vec3 uGlow2; uniform vec2 uGlowDir; uniform vec2 uGlow2Dir;',
    'uniform vec3 uCloudDark; uniform vec3 uCloudLit; uniform float uStars; uniform float uMoonAmt; uniform float uAurora; uniform vec3 uAur1; uniform vec3 uAur2; uniform float uStorm; uniform vec3 uStormCol;',
    'float h3(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }',
    'float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }',
    'void main(){',
    ' vec3 d = normalize(vDir); float h = d.y;',
    ' vec3 col = mix(uHor, uZen, smoothstep(-0.02, 0.55, h));',
    ' vec2 hd = normalize(d.xz + 1e-5);',
    ' float g1 = pow(max(0.0, dot(hd, uGlowDir)), 3.0) * exp(-max(h,0.0)*7.0);',
    ' float g2 = pow(max(0.0, dot(hd, uGlow2Dir)), 3.0) * exp(-max(h,0.0)*9.0);',
    ' col += uGlow * g1 + uGlow2 * g2 + (uGlow + uGlow2) * 0.18 * exp(-abs(h)*16.0);',
    ' if (h > 0.0) {',
    '  vec3 sp = d*380.0; vec3 ip = floor(sp); float s = h3(ip);',
    '  float st = step(0.9975, s) * smoothstep(0.45, 0.0, length(fract(sp)-0.5));',
    '  col += vec3(0.75,0.8,1.0) * st * smoothstep(0.04, 0.35, h) * (0.55 + 0.45*sin(uTime*1.7 + s*80.0)) * 0.9 * uStars;',
    '  vec2 uv = d.xz / (h + 0.12) * 0.55 + vec2(uTime*0.004, uTime*0.0017);',
    '  float c = fbm(uv*1.4); float cov = smoothstep(0.46, 0.82, c);',
    '  vec3 cc = mix(uCloudDark, uCloudLit, clamp((g1 + g2) * 2.2 + exp(-h*5.0) * 0.35, 0.0, 1.0));',
    '  col = mix(col, cc, cov * smoothstep(0.0, 0.12, h) * 0.9);',
    '  if (uAurora > 0.0) {',
    '   vec2 ap = d.xz / (h + 0.3);',
    '   float wob = fbm(vec2(ap.x * 0.35 + uTime * 0.012, ap.y * 0.2)) * 2.6;',
    '   float y1 = ap.y * 0.8 + sin(ap.x * 0.9 + wob + uTime * 0.04) * 0.45;',
    '   float y2 = ap.y * 0.8 + sin(ap.x * 0.7 - wob * 0.8 + 2.1 + uTime * 0.03) * 0.5 + 0.9;',
    '   float c1 = exp(-pow(y1 + 0.35, 2.0) * 9.0), c2 = exp(-pow(y2 - 0.2, 2.0) * 7.0) * 0.6;',
    '   float rays = 0.45 + 0.55 * n2(vec2(ap.x * 7.0 + uTime * 0.1 + wob, 3.0));',
    '   float vert = smoothstep(0.03, 0.2, h) * smoothstep(0.95, 0.3, h) * (1.0 - cov * 0.7);',
    '   vec3 ac = mix(uAur1, uAur2, smoothstep(0.12, 0.5, h));',
    '   col += ac * (c1 + c2) * rays * vert * uAurora;',
    '  }',
    ' }',
    ' float md = dot(d, uMoon);',
    ' col += (vec3(0.85,0.9,1.0) * smoothstep(0.99935, 0.99962, md) * 2.2 + vec3(0.16,0.2,0.28) * pow(max(md,0.0), 400.0) + vec3(0.04,0.05,0.07) * pow(max(md,0.0), 18.0)) * uMoonAmt;',
    ' if (h < 0.0) col = mix(uHor, uHor * 0.3, smoothstep(0.0, -0.25, h));',
    ' col = mix(col, uStormCol * (1.0 + max(h, 0.0) * 0.4), uStorm * 0.92);',
    ' gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  // Distant towers: window grid computed per pixel (no geometry), with atmospheric haze.
  const TOWER_VS = 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }';
  const TOWER_FS = [
    'uniform vec3 uSil; uniform vec3 uHaze; uniform float uBase; uniform float uLit; uniform float uHazeD;',
    'varying vec3 vW; varying vec3 vN;',
    'float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'void main(){',
    ' vec3 col = uSil; vec3 n = abs(normalize(vN));',
    ' if (n.y < 0.5) {',
    '  float u = n.x > n.z ? vW.z : vW.x;',
    '  vec2 c = vec2(u / 2.6, (vW.y - uBase) / 3.3); vec2 id = floor(c); vec2 f = fract(c);',
    '  float frame = step(0.16, f.x) * step(f.x, 0.84) * step(0.24, f.y) * step(f.y, 0.78);',
    '  float blk = h21(floor(vW.xz / 34.0) + 7.0);',
    '  float h = h21(id + blk * 97.0);',
    '  float lit = step(1.0 - uLit * (0.35 + blk * 1.2), h) * step(2.0, id.y);',
    '  float t = fract(h * 17.31);',
    '  vec3 wc = t < 0.55 ? vec3(1.0, 0.7, 0.4) : t < 0.92 ? vec3(0.6, 0.76, 1.0) : vec3(0.3, 1.0, 1.1);',
    '  col += frame * lit * wc * (0.3 + 0.7 * fract(h * 7.7)) * 0.85;',
    '  col += frame * (1.0 - lit) * vec3(0.004, 0.005, 0.007);',
    '  col *= 0.75 + 0.25 * step(0.08, fract(c.y));',
    ' }',
    ' float d = length(vW - cameraPosition);',
    ' col = mix(col, uHaze, 1.0 - exp(-d * uHazeD));',
    ' gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');
  L.buildSky = function (moonDir, th) {
    const k = th.sky;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMoon: { value: moonDir.clone().normalize() }, uTime: { value: 0 },
        uZen: { value: v3(k.zen) }, uHor: { value: v3(k.hor) }, uGlow: { value: v3(k.glow) }, uGlow2: { value: v3(k.glow2) },
        uGlowDir: { value: new THREE.Vector2(k.glowDir[0], k.glowDir[1]).normalize() }, uGlow2Dir: { value: new THREE.Vector2(k.glow2Dir[0], k.glow2Dir[1]).normalize() },
        uCloudDark: { value: v3(k.cloudDark) }, uCloudLit: { value: v3(k.cloudLit) }, uStars: { value: k.stars }, uMoonAmt: { value: k.moon },
        uAurora: { value: k.aurora || 0 }, uStorm: { value: 0 }, uStormCol: { value: new THREE.Vector3() }, uAur1: { value: v3(k.aur1 || [0.1, 0.9, 0.5]) }, uAur2: { value: v3(k.aur2 || [0.5, 0.2, 0.9]) }
      },
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
    sky.renderOrder = -10; sky.frustumCulled = false;
    this.scene.add(sky); this.sky = sky;
  };

  L.buildEnv = function (renderer, th) {
    const e = th.env, env = new THREE.Scene();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { uTop: { value: v3(e.top) }, uBot: { value: v3(e.bottom) }, uBand: { value: v3(e.band) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uBand; varying vec3 vD; void main(){ vec3 d = normalize(vD); float h = d.y; vec3 c = mix(uBot, uTop, smoothstep(-0.1,0.6,h)); c += uBand*exp(-abs(h)*6.0)*0.6; if(h<0.0) c = mix(c, uBot*0.8, smoothstep(0.0,-0.3,h)); gl_FragColor = vec4(c,1.0); }'
    }));
    env.add(sphere);
    const panels = e.panels.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, m = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 3 : 7, i % 2 ? 9 : 1.2, 6), panels[i % panels.length]);
      m.position.set(Math.cos(a) * 40, 10 + (i % 3) * 8, Math.sin(a) * 40); m.lookAt(0, 0, 0); env.add(m);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.035);
    this.envRT = rt;
    this.scene.environment = rt.texture;
    pm.dispose();
    env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  };

  /** Distant snow-capped ranges (polar maps): craggy cones shaded by slope and height, fading into the haze. */
  L.buildMountains = function (th) {
    const k = th.mountains, rnd = U.mulberry32(k.seed || 5);
    const pos = [], nrm = [], idx = [];
    const peak = (x, z, r, h) => {
      const seg = 13, rings = 6, base = pos.length / 3, stretch = 1.2 + rnd() * 0.9, rot = rnd() * Math.PI;
      r = Math.min(r, (Math.hypot(x, z) - 130) / (stretch * 1.3)); if (r < 12) return;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let j = 0; j <= rings; j++) {
        const f = j / rings, rr = r * Math.pow(1 - f, 1.15), y = -8 + (h + 8) * f;
        for (let i = 0; i < seg; i++) {
          const a = i / seg * Math.PI * 2 + f * 0.6, jit = j === rings ? 0 : 0.55 + rnd() * 0.75;
          const lx = Math.cos(a) * rr * jit * stretch, lz = Math.sin(a) * rr * jit;
          pos.push(x + lx * cr - lz * sr, y + (j && j < rings ? (rnd() - 0.45) * h * 0.22 : 0), z + lx * sr + lz * cr);
        }
      }
      for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
        const a = base + j * seg + i, b = base + j * seg + (i + 1) % seg, c = a + seg, d = b + seg;
        idx.push(a, c, b, b, c, d);
      }
    };
    for (let i = 0; i < (k.count || 40); i++) {
      const a = rnd() * Math.PI * 2, r = k.r0 + rnd() * (k.r1 - k.r0);
      const h = k.hMin + rnd() * rnd() * (k.hMax - k.hMin);
      peak(Math.cos(a) * r, Math.sin(a) * r, h * (1.0 + rnd() * 0.7), h);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const haze = th.fog;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(th.moon.dir[0], th.moon.dir[1], th.moon.dir[2]).normalize() }, uHaze: { value: new THREE.Vector3(haze[0], haze[1], haze[2]) },
        uRock: { value: v3(k.rock) }, uSnow: { value: v3(k.snow) }, uHazeD: { value: k.haze || 0.004 } },
      vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: [
        'uniform vec3 uSun; uniform vec3 uHaze; uniform vec3 uRock; uniform vec3 uSnow; uniform float uHazeD; varying vec3 vW; varying vec3 vN;',
        'float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
        'void main(){ vec3 n = normalize(vN); float slope = n.y;',
        ' float nz = h21(floor(vW.xz * 0.35 + vW.y * 0.2)) - 0.5;',
        ' float snow = smoothstep(0.62, 0.82, slope * 0.9 + vW.y * 0.006 + nz * 0.35);',
        ' float band = 0.75 + 0.25 * h21(floor(vec2(vW.y * 0.4, vW.x * 0.02)));',
        ' vec3 base = mix(uRock * band, uSnow, snow);',
        ' float lit = 0.3 + 0.7 * max(0.0, dot(n, uSun));',
        ' vec3 col = base * lit;',
        ' float d = length(vW - cameraPosition);',
        ' col = mix(col, uHaze, clamp(1.0 - exp(-d * uHazeD), 0.0, 0.92));',
        ' gl_FragColor = vec4(col, 1.0); }'
      ].join('\n'), fog: false
    });
    this.mountainMat = mat; mat.userData.hazeD = k.haze || 0.004;
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = -5;
    this.scene.add(mesh);
    this.flareStacks = null;
  };

  L.buildSkyline = function (th) {
    this.mountainMat = null;
    if (th.mountains) { this.buildMountains(th); return; }
    const k = th.skyline, rnd = U.mulberry32(k.seed || 77);
    const box = this.geo('box'), cyl = this.geo('cylLo');
    const B = () => ({ pos: [], nrm: [], uv: [], col: [], idx: [] });
    const sil = B(), wins = k.win.map(B);
    const self = this, beacons = [], base = k.base || 0;
    const push = (target, geo, m) => { const save = self.batches; self.batches = { t: target }; self.addGeo('t', geo, m); self.batches = save; };
    const holos = [];
    for (let i = 0; i < (k.count || 70); i++) {
      const a = rnd() * Math.PI * 2, r = k.r0 + rnd() * (k.r1 - k.r0);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < k.clearX && Math.abs(z) < k.clearZ) continue;
      const w = 10 + rnd() * 26, d = 10 + rnd() * 26, h = k.hMin + rnd() * rnd() * k.hMax;
      const tower = rnd() < 0.25;
      if (tower) push(sil, cyl, this.mat4(x, base + h * 0.9, z, 0, 0, 0, 3 + rnd() * 5, h * 1.8, 3 + rnd() * 5));
      else push(sil, box, this.mat4(x, base + h / 2, z, 0, 0, 0, w, h, d));
      const top = base + (tower ? h * 1.8 : h);
      if (rnd() < 0.55) beacons.push([x, top + 1, z]);
      if (!tower) {
        const nw = Math.floor(rnd() * (k.windows != null ? k.windows : 14));
        for (let n = 0; n < nw; n++) {
          const side = Math.floor(rnd() * 4), wy = base + 2 + rnd() * h * 0.92;
          const wx = side < 2 ? x + (rnd() - 0.5) * w * 0.85 : x + (side === 2 ? -1 : 1) * (w / 2 + 0.05);
          const wz = side >= 2 ? z + (rnd() - 0.5) * d * 0.85 : z + (side === 0 ? -1 : 1) * (d / 2 + 0.05);
          push(wins[Math.floor(rnd() * wins.length)], box, this.mat4(wx, wy, wz, 0, 0, 0, side < 2 ? 0.8 + rnd() * 2 : 0.12, 0.5 + rnd() * 0.6, side >= 2 ? 0.8 + rnd() * 2 : 0.12));
        }
        if (k.neon && rnd() < 0.35) { // neon rooftop outline
          const ci = Math.floor(rnd() * wins.length);
          push(wins[ci], box, this.mat4(x, top + 0.2, z - d / 2, 0, 0, 0, w, 0.35, 0.35)); push(wins[ci], box, this.mat4(x, top + 0.2, z + d / 2, 0, 0, 0, w, 0.35, 0.35));
        }
        if (k.holo && holos.length < k.holo && rnd() < 0.4 && h > 30) holos.push([x, z, w, d, base + h * U.rand(0.45, 0.8), Math.floor(rnd() * 8)]);
      }
    }
    if (k.flares) {
      const stacks = [[-34, -92], [14, -104], [52, -86], [-90, -40], [96, 20]];
      for (const s of stacks) { push(sil, cyl, this.mat4(s[0], 26, s[1], 0, 0, 0, 1.6, 52, 1.6)); beacons.push([s[0], 45, s[1]]); }
      this.flareStacks = stacks.map((s) => new THREE.Vector3(s[0], 53, s[1]));
    } else this.flareStacks = null;
    const mk = (t, mat, nrm) => { if (!t.idx.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3)); if (nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(t.nrm, 3)); g.setIndex(t.idx); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; this.scene.add(m); return m; };
    const haze = th.fog || [0.02, 0.02, 0.025];
    mk(sil, new THREE.ShaderMaterial({
      uniforms: { uSil: { value: v3(k.sil) }, uHaze: { value: new THREE.Vector3(haze[0] * 1.3, haze[1] * 1.3, haze[2] * 1.3) }, uBase: { value: base }, uLit: { value: k.lit != null ? k.lit : 0.3 }, uHazeD: { value: k.haze != null ? k.haze : 0.0032 } },
      vertexShader: TOWER_VS, fragmentShader: TOWER_FS, fog: false
    }), true);
    wins.forEach((t, i) => { const c = k.win[i]; mk(t, new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), fog: false })); });
    const bg = B();
    for (const b of beacons) push(bg, this.geo('sphere'), this.mat4(b[0], b[1], b[2], 0, 0, 0, 0.9, 0.9, 0.9));
    const bm = mk(bg, this.mats.skylineRed);
    if (bm) this.animated.push((dt, t) => { bm.visible = (t % 2.2) < 0.25; });
    // giant holographic adverts on tower faces, turned toward the play area
    for (const hInfo of holos) {
      const [x, z, w, d, y, ad] = hInfo;
      const face = Math.abs(x) > Math.abs(z) ? (x > 0 ? -1 : 1) : 0;
      const ww = Math.min(w, d) * 1.1, hh = ww * 0.5;
      if (face !== 0) CF.Neon.holo(ad, x + face * (w / 2 + 0.3), y, z, face > 0 ? Math.PI / 2 : -Math.PI / 2, ww, hh).material.fog = false;
      else CF.Neon.holo(ad, x, y, z + (z > 0 ? -1 : 1) * (d / 2 + 0.3), z > 0 ? Math.PI : 0, ww, hh);
    }
  };

  /** Free GPU resources of the current level (textures from CF.Tex/CF.Neon are shared and kept). */
  L.dispose = function () {
    if (!this.scene) return;
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
  };

  // ------------------------------------------------------------ dynamic props
  L.addDoor = function (id, x0, y0, z0, x1, y1, z1, m, o) {
    o = o || {};
    const col = W.add(x0, y0, z0, x1, y1, z1, { surf: 'metal', tag: 'door', nav: false });
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    const mesh = new THREE.Mesh(g, this.mats[m] || this.mats.paintDark);
    mesh.material = mesh.material.clone(); mesh.material.vertexColors = false;
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    const light = o.light ? this.lamp(o.light[0], o.light[1], o.light[2], { color: 0xff3020, intensity: 1.2, distance: 8, pool: false, mat: this.mats.lampRed.clone() }) : null;
    let bulb = null;
    if (light) {
      bulb = new THREE.Mesh(this.geo('box'), light.mat); bulb.scale.set(0.4, 0.25, 0.4); bulb.position.copy(light.pos); this.scene.add(bulb);
      light.baseCol = light.mat.color.clone();
    }
    const door = { id, col, mesh, open: false, t: 0, lift: o.lift || (Math.abs(y1 - y0) + 0.2), y0: mesh.position.y, light, bulb, rect: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)] };
    this.doors[id] = door;
    return door;
  };
  L.openDoor = function (id, instant) {
    const d = this.doors[id]; if (!d || d.open) return;
    d.open = true; d.t = instant ? 1 : 0;
    if (d.light) { d.light.color.setRGB(0.3, 1, 0.4); d.light.baseCol = new THREE.Color(0.6, 5, 1.3); }
    if (!instant) CF.Audio.play('door', d.mesh.position, { ref: 10 });
  };
  L.closeDoor = function (id) {
    const d = this.doors[id]; if (!d) return;
    d.open = false; d.t = 0; d.mesh.position.y = d.y0; d.col.enabled = true;
    if (d.light) { d.light.color.set(0xff3020); d.light.baseCol = new THREE.Color(8, 0.5, 0.25); }
    W.rebuildNavRect(d.rect[0], d.rect[1], d.rect[2], d.rect[3]);
  };
  L.updateDoors = function (dt) {
    for (const id in this.doors) {
      const d = this.doors[id];
      if (!d.open || d.t >= 1 && !d.col.enabled) continue;
      d.t = Math.min(1, d.t + dt / 2.0);
      d.mesh.position.y = d.y0 + U.easeInOut(d.t) * d.lift;
      if (d.t >= 1 && d.col.enabled) { d.col.enabled = false; W.rebuildNavRect(d.rect[0], d.rect[1], d.rect[2], d.rect[3]); }
    }
  };

  L.addBarrel = function (x, y, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geo('cyl'), this.barrelMat || (this.barrelMat = this.mats.paintRed.clone()));
    body.material.vertexColors = false;
    body.scale.set(0.34, 1.0, 0.34); body.position.y = 0.5; g.add(body);
    const bandMat = this.hazardBand || (this.hazardBand = (() => { const m = this.mats.hazard.clone(); m.vertexColors = false; return m; })());
    for (const by of [0.22, 0.78]) { const band = new THREE.Mesh(this.geo('cyl'), bandMat); band.scale.set(0.345, 0.07, 0.345); band.position.y = by; g.add(band); }
    g.position.set(x, y, z); g.rotation.y = Math.random() * 6.28;
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    this.scene.add(g);
    const col = W.add(x - 0.33, y, z - 0.33, x + 0.33, y + 1.0, z + 0.33, { surf: 'metal', tag: 'barrel' });
    const barrel = { pos: new THREE.Vector3(x, y + 0.5, z), mesh: g, col, hp: 25, alive: true, burn: 0 };
    col.owner = barrel;
    this.barrels.push(barrel);
    return barrel;
  };

  L.addInteract = function (o) {
    const it = Object.assign({ radius: 1.8, hold: 0, enabled: true, progress: 0, cooldown: 0, facing: null }, o);
    it.pos = new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]);
    this.interactables.push(it);
    return it;
  };

  L.addPickup = function (type, x, y, z, data) {
    const p = { type, pos: new THREE.Vector3(x, y, z), data: data || {}, alive: true, t: Math.random() * 6, respawn: 0, mesh: null };
    this.pickups.push(p);
    return p;
  };

  // ------------------------------------------------------------ finalize
  L.finish = function () {
    const M = this.mats;
    for (const lp of this.lamps) this.lampDecor(lp);
    this.finished = true;
    for (const key in this.batches) {
      const b = this.batches[key];
      if (!b.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere();
      const mat = M[key] || M.concrete;
      const mesh = new THREE.Mesh(g, mat);
      const lit = mat.isMeshStandardMaterial;
      mesh.castShadow = lit; mesh.receiveShadow = lit;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      this.scene.add(mesh);
    }
    const quads = (t, mat, withCol) => {
      if (!t.idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2));
      if (withCol) g.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
      const n = []; for (let i = 0; i < t.pos.length / 3; i++) n.push(0, 1, 0);
      g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
      g.setIndex(t.idx);
      const m = new THREE.Mesh(g, mat); m.renderOrder = 2; m.matrixAutoUpdate = false; m.updateMatrix();
      this.scene.add(m); return m;
    };
    quads(this.blobGeo, M.blob, false);
    quads(this.poolGeo, M.pools, true);
    this.makeLightPool();
    this.batches = {};
  };

  L.update = function (dt, t, cam) {
    this.updateLights(cam, dt, t);
    CF.Neon.tick(t);
    this.updateDoors(dt);
    if (this.sky) { this.sky.position.copy(cam); this.sky.material.uniforms.uTime.value = t; }
    const mo = this.mats.molten.map;
    if (mo) { mo.offset.x = t * 0.018; mo.offset.y = Math.sin(t * 0.2) * 0.05; }
    for (let i = 0; i < this.animated.length; i++) this.animated[i](dt, t);
  };
})(window.CF);
