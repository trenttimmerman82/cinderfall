'use strict';
/* Cinderfall — the Saint-Aubin sector, France, November 1918 (Campaign: The Eleventh Hour). X east, Z south, Y up.
   South: the British support line and the front line (z ~70), sandbags, duckboards, ladders.
   Middle: no-man's-land, a moonscape of shell holes and wire. Then the German front line (z ~-6) with MG nests and
   dugouts, the communication trenches north to the second line (z ~-48), the fields behind it with the field gun, and
   the road to the ruined village of Saint-Aubin (north): the church with its tower, the chateau, the orchard (east).
   Trenches are cut into the heightfield as axis-aligned bays and traverses (floor -2.1, fire step -1.05). */
(function (CF) {
  const L = CF.Level, W = CF.World, U = CF.U;
  const PI = Math.PI;
  const MW = CF.MapWestern = {};
  const B = { minX: -140, maxX: 140, minZ: -140, maxZ: 140 };
  MW.B = B;
  const FLOOR = -2.1, STEP = -1.05;

  // ---------------------------------------------------------------- trenches as rectangles
  const floors = [], steps = [], dugouts = [];
  /** A crenellated fire trench along x at z (front = -1: faces north, +1: faces south). */
  function fireTrench(x0, x1, z, front) {
    for (let x = x0; x < x1; x += 10) {
      const bay = [x, z - 1.2, x + 7, z + 1.2];
      floors.push(bay);
      steps.push(front < 0 ? [x, z - 2.0, x + 7, z - 1.2] : [x, z + 1.2, x + 7, z + 2.0]);          // the fire step on the enemy side
      if (x + 10 < x1) floors.push(front < 0 ? [x + 5.8, z + 1.2, x + 11.2, z + 3.6] : [x + 5.8, z - 3.6, x + 11.2, z - 1.2]); // round the traverse
    }
  }
  const BRIT = 70, GER1 = -6, GER2 = -48;
  fireTrench(-120, 120, BRIT, -1);
  fireTrench(-110, 110, GER1, 1);
  fireTrench(-80, 100, GER2, 1);
  floors.push([-60, 99, 60, 101.4]);                       // British support line
  floors.push([-1.2, 71, 1.2, 99.5]);                      // British communication trench
  floors.push([-41.2, 71, -38.8, 99.5]); floors.push([38.8, 71, 41.2, 99.5]);
  floors.push([18.8, -46.8, 21.2, -7.2]);                  // German communication trenches
  floors.push([-31.2, -46.8, -28.8, -7.2]);
  floors.push([58.8, -46.8, 61.2, -7.2]);
  // dugouts: rooms dug under the rear wall (floor depth, roofed over at ground level)
  dugouts.push({ id: 'brHQ', r: [-6, 101.4, 6, 106] });
  dugouts.push({ id: 'phone', r: [-6, -12, 2, -8.6] });
  dugouts.push({ id: 'gerDug2', r: [24, -12, 30, -8.6] });
  dugouts.push({ id: 'gerDug3', r: [-46, -54, -38, -50.6] });
  for (const d of dugouts) floors.push(d.r);
  MW.floors = floors; MW.dugouts = dugouts;
  const inR = (r, x, z) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];

  // ---------------------------------------------------------------- craters
  const CRATERS = [];
  {
    const rnd = U.mulberry32(1918);
    for (let i = 0; i < 260; i++) {
      const x = U.lerp(-135, 135, rnd()), z = U.lerp(-60, 66, rnd());
      const nml = z > 4 && z < 64;
      if (!nml && rnd() < 0.55) continue;
      CRATERS.push({ x, z, r: (nml ? 2 + rnd() * 3.5 : 1.5 + rnd() * 2.2), d: nml ? 0.5 + rnd() * 1.0 : 0.3 + rnd() * 0.5 });
    }
    CRATERS.push({ x: 8, z: 30, r: 7, d: 2.2 }); // the big mine crater in the middle of no-man's-land
  }
  MW.CRATERS = CRATERS;

  /** Ground height (collision). */
  function height(x, z) {
    for (const r of floors) if (inR(r, x, z)) return FLOOR;
    for (const r of steps) if (inR(r, x, z)) return STEP;
    let h = 0;
    for (const c of CRATERS) {
      const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz; if (d2 > c.r * c.r * 1.44) continue;
      const d = Math.sqrt(d2) / c.r;
      h = Math.min(h, d < 1 ? -c.d * (1 - d * d) : 0) + (d > 0.85 && d < 1.2 ? 0.18 * c.d * (1 - Math.abs(d - 1) / 0.2) : 0); // bowl and lip
    }
    // the village sits a little higher on its ridge
    if (z < -86) h += U.smoothstep(-86, -100, z) * 1.2;
    return h;
  }
  MW.height = height;

  // ---------------------------------------------------------------- materials
  let TEX = null;
  function textures() {
    if (TEX) return TEX;
    const T = CF.Tex.util, S = Math.min(512, T.size()), n = S * S;
    TEX = {};
    // churned mud, with puddles and broken chalk
    {
      const n1 = T.tileNoise(S, 5, 5, 5, 9101, 0.55), n2 = T.tileNoise(S, 30, 30, 3, 9102), n3 = T.tileNoise(S, 3, 3, 3, 9103);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const wet = U.smoothstep(0.62, 0.7, n3[i]), chalk = U.smoothstep(0.82, 0.86, n2[i]) * 0.5;
        const v = 0.5 + (n1[i] - 0.5) * 0.35 + (n2[i] - 0.5) * 0.2 + chalk;
        rgb[i * 3] = v * (1 - wet * 0.4); rgb[i * 3 + 1] = v * 0.9 * (1 - wet * 0.35); rgb[i * 3 + 2] = v * 0.76 * (1 - wet * 0.25);
        hgt[i] = n1[i] * 0.5 + n2[i] * 0.4 - wet * 0.3; rough[i] = 1 - wet * 0.85;
      }
      TEX.mud = T.pack(rgb, hgt, rough, 2.0, S);
    }
    // duckboards and revetting planks
    {
      const n1 = T.tileNoise(S, 4, 64, 3, 9111), rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, gap = (x % (S / 8)) < 6; const v = gap ? 0.15 : 0.45 + n1[i] * 0.3;
        rgb[i * 3] = v * 0.9; rgb[i * 3 + 1] = v * 0.76; rgb[i * 3 + 2] = v * 0.56; hgt[i] = gap ? 0 : 0.7 + n1[i] * 0.3; rough[i] = 0.9;
      }
      TEX.boards = T.pack(rgb, hgt, rough, 3, S);
    }
    // wattle (woven hurdles revetting the trench walls)
    {
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n), n1 = T.tileNoise(S, 16, 16, 2, 9121);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, row = (y / (S / 24)) | 0, w = Math.sin((x / S) * PI * 24 + (row % 2) * PI) * 0.5 + 0.5, stake = (x % (S / 6)) < 8;
        const v = stake ? 0.35 : 0.3 + w * 0.3 + n1[i] * 0.1;
        rgb[i * 3] = v * 0.85; rgb[i * 3 + 1] = v * 0.72; rgb[i * 3 + 2] = v * 0.5; hgt[i] = stake ? 1 : w; rough[i] = 0.95;
      }
      TEX.wattle = T.pack(rgb, hgt, rough, 3, S);
    }
    // limestone rubble walls, plastered here and there
    {
      const n1 = T.tileNoise(S, 8, 8, 4, 9131), n2 = T.tileNoise(S, 48, 48, 2, 9132), rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, rowH = S / 10, row = (y / rowH) | 0, sx = (x + row * 37) % (S / 5), joint = (y % rowH) < 3 || sx < 3;
        const plaster = U.smoothstep(0.55, 0.6, n1[i]);
        const v = joint && !plaster ? 0.4 : 0.66 + (n2[i] - 0.5) * 0.25 + plaster * 0.18;
        rgb[i * 3] = v; rgb[i * 3 + 1] = v * 0.94; rgb[i * 3 + 2] = v * 0.84; hgt[i] = joint && !plaster ? 0 : 0.6 + n2[i] * 0.4; rough[i] = 0.95;
      }
      TEX.stone = T.pack(rgb, hgt, rough, 2.4, S);
    }
    TEX.grass = CF.MapJungle.leafTex('grass', 31); TEX.bush = CF.MapJungle.leafTex('bush', 32); TEX.canopy = CF.MapJungle.leafTex('canopy', 33);
    return TEX;
  }
  function materials() {
    const T = textures(), M = L.mats, CT = CF.Tex.list;
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.35, roughness: 1, metalness: 0 }, o));
    const tri = (t, c) => ({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, color: c });
    M.mudWall = std(tri(T.mud, 0x9a8a72)); M.boards = std(tri(T.boards, 0xffffff)); M.wattle = std(tri(T.wattle, 0xffffff));
    M.ruin = std(tri(T.stone, 0xffffff)); M.ruinDark = std(tri(T.stone, 0x9a948a)); M.tiles = std(tri(CT.planks, 0x8a4a34));
    M.timber = std(tri(CT.planks, 0x6a5440)); M.concreteGrey = std(tri(CT.concrete, 0x9a988e)); M.stump = std(tri(CT.planks, 0x3a3228));
    M.wire = new THREE.MeshStandardMaterial({ color: 0x5a4a3e, roughness: 0.6, metalness: 0.7, envMapIntensity: 0.5 });
    M.leafGrass = CF.MapJungle.foliageMat(T.grass, 0xc8c098, 0.2); M.leafGrass.userData.noShadow = true;
    M.leafBush = CF.MapJungle.foliageMat(T.bush, 0xa8b088, 0.08);
    M.leafCanopy = CF.MapJungle.foliageMat(T.canopy, 0xc0b880, 0.14);
    M.pool = new THREE.MeshStandardMaterial({ color: 0x2a2a22, roughness: 0.15, metalness: 0.1, envMapIntensity: 0.8, transparent: true, opacity: 0.85, depthWrite: false });
    if (!M.sandbag) M.sandbag = std(tri(CT.carpet, 0xa8966c));
    M.flagRed = std({ color: 0xa82020, roughness: 0.8 });
  }

  // ---------------------------------------------------------------- builders
  const deco = (x0, y0, z0, x1, y1, z1, m, o) => L.box(x0, y0, z0, x1, y1, z1, m, Object.assign({ noCol: true, ao: false }, o || {}));
  const solid = (x0, y0, z0, x1, y1, z1, surf, o) => W.add(x0, y0, z0, x1, y1, z1, Object.assign({ surf: surf || 'concrete' }, o || {}));
  const noStand = (x0, y, z0, x1, z1) => W.add(x0, y, z0, x1, y + 30, z1, { shoot: false, nav: false });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _sc = new THREE.Vector3(), _ps = new THREE.Vector3();
  const mYXZ = (x, y, z, rx, ry, rz, sx, sy, sz) => { _eu.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_eu); _sc.set(sx, sy, sz); _ps.set(x, y, z); return _m.compose(_ps, _q, _sc).clone(); };
  let cardBase = null, stumpGeo = null;
  const card = () => cardBase || (cardBase = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0));

  function sandbags(x0, z0, x1, z1, h, y) {
    h = h || 1.0; y = y || 0;
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    deco(x0, y, z0, x1, y + h, z1, 'sandbag', { ao: true });
    for (let k = y + 0.25; k < y + h; k += 0.25) deco(alongX ? x0 : x0 - 0.02, k - 0.02, alongX ? z0 - 0.02 : z0, alongX ? x1 : x1 + 0.02, k, alongX ? z1 + 0.02 : z1, 'sandbag');
    solid(Math.min(x0, x1), y - 0.3, Math.min(z0, z1), Math.max(x0, x1), y + h, Math.max(z0, z1), 'concrete');
  }
  MW.sandbags = sandbags;
  function wire(pts) {
    const geo = MW.wireGeo || (MW.wireGeo = new THREE.TorusGeometry(1, 0.05, 3, 10));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / 0.5), ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = U.lerp(a[0], b[0], t), z = U.lerp(a[1], b[1], t), y = height(x, z); L.addGeo('wire', geo, mYXZ(x, y + 0.42, z, 0, ry, (k % 2 ? 0.25 : -0.25), 0.45, 0.45, 0.45)); }
      for (let k = 0; k <= len; k += 3) { const t = k / len, x = U.lerp(a[0], b[0], t), z = U.lerp(a[1], b[1], t); L.addGeo('timber', L.geo('cylLo'), mYXZ(x, height(x, z) + 0.5, z, 0.15, 0, 0.1, 0.04, 1.1, 0.04)); }
      const steps = Math.ceil(len / 1.5);
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps, x0 = U.lerp(a[0], b[0], t0), z0 = U.lerp(a[1], b[1], t0), x1 = U.lerp(a[0], b[0], t1), z1 = U.lerp(a[1], b[1], t1), y = Math.min(height(x0, z0), height(x1, z1));
        W.add(Math.min(x0, x1) - 0.3, y, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, y + 0.85, Math.max(z0, z1) + 0.3, { surf: 'metal', shoot: false, nav: false, tag: 'wire' });
      }
    }
  }
  /** A belt of wire along z from x0 to x1 with gaps (lanes the attack goes through). */
  function wireBelt(x0, x1, z, gaps, rnd) {
    let run = [];
    for (let x = x0; x <= x1; x += 2) {
      if (gaps.some((g) => Math.abs(x - g) < 2.5)) { if (run.length > 1) wire(run); run = []; continue; }
      run.push([x, z + Math.sin(x * 0.7) * 0.8 + (rnd() - 0.5) * 0.6]);
    }
    if (run.length > 1) wire(run);
  }
  function deadTree(x, z, rnd) {
    stumpGeo = stumpGeo || new THREE.CylinderGeometry(0.7, 1, 1, 7, 1, true);
    const h = 2 + rnd() * 6, gy = height(x, z);
    L.addGeo('stump', stumpGeo, mYXZ(x, gy + h / 2, z, (rnd() - 0.5) * 0.15, rnd() * 3, (rnd() - 0.5) * 0.15, 0.22, h, 0.22));
    if (rnd() < 0.6) L.addGeo('stump', stumpGeo, mYXZ(x, gy + h * 0.7, z, 0.9 + rnd() * 0.5, rnd() * 6, 0, 0.08, h * 0.4, 0.08));
    W.addCyl(x, z, 0.25, gy - 0.5, gy + h, { surf: 'wood' });
  }

  // ---------------------------------------------------------------- terrain
  function terrain() {
    const SEG = 280, size = B.maxX - B.minX;
    const g = new THREE.PlaneGeometry(size, size, SEG, SEG); g.rotateX(-PI / 2);
    const P = g.attributes.position, col = new Float32Array(P.count * 3), rnd = U.mulberry32(77);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), h = height(x, z);
      P.setY(i, h + (h === 0 ? Math.sin(x * 0.41) * Math.cos(z * 0.37) * 0.07 : 0));
      // churned brown in no-man's-land, greener (but battered) fields behind the lines, chalky spoil by the trenches
      const nml = z > -62 && z < 66, back = z < -62 || z > 104;
      let r = 0.4, gg = 0.34, b = 0.26;
      if (back) { r = 0.42; gg = 0.44; b = 0.26; }
      if (!nml && !back) { r = 0.44; gg = 0.4; b = 0.3; }
      if (h < -0.4 && h > -1.9) { r = 0.32; gg = 0.28; b = 0.22; }
      if (h <= -1.0) { r = 0.36; gg = 0.31; b = 0.24; }
      const n = 0.88 + rnd() * 0.2;
      col[i * 3] = r * n; col[i * 3 + 1] = gg * n; col[i * 3 + 2] = b * n;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const T = textures(), m = new THREE.MeshStandardMaterial({ map: T.mud.map, normalMap: T.mud.normalMap, roughnessMap: T.mud.roughnessMap, vertexColors: true, roughness: 1, envMapIntensity: 0.5 });
    for (const t of [m.map, m.normalMap, m.roughnessMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size / 5, size / 5); }
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); L.scene.add(mesh);
    const outer = new THREE.Mesh(new THREE.RingGeometry(size * 0.5, 700, 4, 1, PI / 4).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3626, roughness: 1 }));
    outer.scale.set(Math.SQRT2, 1, Math.SQRT2); outer.position.y = -0.05; L.scene.add(outer);
    // standing water in the deep shell holes
    for (const c of CRATERS) if (c.d > 0.9) { const w = new THREE.Mesh(new THREE.CircleGeometry(c.r * 0.55, 14).rotateX(-PI / 2), L.mats.pool); w.position.set(c.x, -c.d * 0.7, c.z); w.renderOrder = 3; L.scene.add(w); }
    // ground collision: 1 m cells, merged along rows
    const VW = B.maxX - B.minX;
    for (let iz = 0; iz < VW; iz++) {
      let run = null;
      const flush = () => { if (run) { W.add(run.x0, -3, iz + B.minZ, run.x1, run.h, iz + B.minZ + 1, { surf: 'dirt' }); run = null; } };
      for (let ix = 0; ix < VW; ix++) {
        const x = ix + B.minX, z = iz + B.minZ, h = Math.round(height(x + 0.5, z + 0.5) * 20) / 20;
        if (run && run.h === h) run.x1 = x + 1; else { flush(); run = { x0: x, x1: x + 1, h }; }
      }
      flush();
    }
  }
  /** Trench furniture: revetted walls, duckboards, sandbag parapets, ladders over the top, dugout roofs. */
  function trenchDressing(rnd) {
    for (const r of floors) {
      const dug = dugouts.find((d) => d.r === r);
      deco(r[0] + 0.15, FLOOR, r[1] + 0.15, r[2] - 0.15, FLOOR + 0.08, r[3] - 0.15, 'boards');
      if (dug) {
        // the roof: timber and earth over the room, a doorway blanket at the trench side
        L.box(r[0] - 0.2, -0.45, r[1] - 0.2, r[2] + 0.2, 0.05, r[3] + 0.2, 'timber', { nav: false });
        for (let x = r[0] + 1; x < r[2]; x += 1.5) deco(x - 0.08, FLOOR, r[1] + 0.1, x + 0.08, -0.45, r[1] + 0.26, 'timber');
        continue;
      }
      // wattle revetting on the long walls
      const alongX = r[2] - r[0] > r[3] - r[1];
      if (alongX) { deco(r[0], FLOOR, r[1] - 0.04, r[2], -0.1, r[1], 'wattle'); deco(r[0], FLOOR, r[3], r[2], -0.1, r[3] + 0.04, 'wattle'); }
      else { deco(r[0] - 0.04, FLOOR, r[1], r[0], -0.1, r[3], 'wattle'); deco(r[2], FLOOR, r[1], r[2] + 0.04, -0.1, r[3], 'wattle'); }
    }
    for (const r of steps) deco(r[0] + 0.1, STEP, r[1] + 0.05, r[2] - 0.1, STEP + 0.06, r[3] - 0.05, 'boards');
    // parapets: a low sandbag ridge in front of each fire trench (stops nothing you can't climb, hides your head)
    for (const [z, front] of [[BRIT - 2.2, -1], [GER1 + 2.2, 1], [GER2 + 2.2, 1]]) {
      for (let x = -120; x < 120; x += 10) {
        if (z === BRIT - 2.2 ? x < -120 || x > 110 : z === GER1 + 2.2 ? x < -110 || x > 100 : x < -80 || x > 90) continue;
        const z0 = front < 0 ? z - 0.6 : z, z1 = front < 0 ? z : z + 0.6;
        deco(x, 0, z0, x + 7, 0.45, z1, 'sandbag', { ao: true });
      }
    }
    // ladders over the top from the British fire bays (the whistle is blown from these)
    MW.ladders = [];
    for (let x = -100; x < 100; x += 10) {
      const lx = x + 3.5;
      for (let i = 0; i < 5; i++) L.box(lx - 0.4, FLOOR + i * 0.42, BRIT - 1.2 + (4 - i) * 0.22, lx + 0.4, FLOOR + (i + 1) * 0.42, BRIT - 1.2 + (5 - i) * 0.22, 'timber', { surf: 'wood' });
      MW.ladders.push({ x: lx, z: BRIT - 1.6 });
    }
    // the German MG nests on the parapet: a ring of sandbags round a pit, and the concrete pillbox on the left
    MW.nests = [];
    for (const [x, z] of [[-24, GER1 + 3.4], [26, GER1 + 3.4], [70, GER1 + 3.4]]) {
      sandbags(x - 2, z + 1.2, x + 2, z + 1.8, 0.9); sandbags(x - 2.4, z - 1.2, x - 1.8, z + 1.8, 0.9); sandbags(x + 1.8, z - 1.2, x + 2.4, z + 1.8, 0.9);
      MW.nests.push({ x, z, y: height(x, z) });
    }
    L.box(-60, 0, GER1 + 2.4, -54, 1.4, GER1 + 5, 'concreteGrey'); deco(-59, 0.9, GER1 + 5, -55, 1.1, GER1 + 5.02, 'shrineDark' in L.mats ? 'shrineDark' : 'rubber');
    MW.pillbox = { x: -57, z: GER1 + 1.6 };
    // inside the dugouts: bunks, a table, the field telephone in the German one
    const ph = dugouts.find((d) => d.id === 'phone').r;
    L.box(ph[0] + 0.5, FLOOR, ph[1] + 0.4, ph[0] + 2.2, FLOOR + 0.8, ph[1] + 1.4, 'timber');
    deco(ph[0] + 1.0, FLOOR + 0.8, ph[1] + 0.6, ph[0] + 1.3, FLOOR + 1.0, ph[1] + 0.9, 'rubber');
    const hq = dugouts.find((d) => d.id === 'brHQ').r;
    L.box(hq[0] + 1, FLOOR, hq[3] - 1.6, hq[0] + 4, FLOOR + 0.8, hq[3] - 0.4, 'timber');
    for (let i = 0; i < 3; i++) L.box(hq[2] - 2.2, FLOOR, hq[1] + 0.5 + i * 1.5, hq[2] - 0.2, FLOOR + 0.45, hq[1] + 1.3 + i * 1.5, 'timber');
    MW.hq = { x: (hq[0] + hq[2]) / 2, z: (hq[1] + hq[3]) / 2 };
    MW.phone = { x: ph[0] + 1.3, z: ph[1] + 0.9 };
    // a few lamps in the dugouts
    MW.dugLamps = [L.lamp(MW.hq.x, FLOOR + 1.8, MW.hq.z, { color: 0xffb060, intensity: 1.2, distance: 8, flicker: 0.08, pool: false, prio: 2 }), L.lamp(MW.phone.x, FLOOR + 1.8, MW.phone.z, { color: 0xffb060, intensity: 1.0, distance: 7, flicker: 0.1, pool: false, prio: 2 })];
  }
  function noMansLand(rnd) {
    wireBelt(-120, 120, BRIT - 8, [-12, -4, 4, 12, -46, 40], rnd);
    wireBelt(-110, 110, GER1 + 9, [-12, -4, 4, 12, -36, 50], rnd);
    wireBelt(-80, 90, GER2 + 7, [10, 12, -20, 40], rnd);
    for (let i = 0; i < 70; i++) deadTree(U.lerp(-130, 130, rnd()), U.lerp(-60, 62, rnd()), rnd);
    // the derelict tank from the last big push, rusting in the mine crater's lip
    const t = CF.StoryModels.markIV(); t.position.set(-30, -0.6, 38); t.rotation.set(0.15, 2.2, 0.12); t.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.55); } }); L.scene.add(t);
    solid(-34, -1, 34, -26, 2.2, 42, 'metal');
    // bodies of grass on the shell-hole lips where nothing has churned it for a week
    for (let i = 0; i < 300; i++) { const x = U.lerp(-130, 130, rnd()), z = U.lerp(-60, 64, rnd()), h = height(x, z); if (h < -0.3) continue; for (let k = 0; k < 2; k++) L.addGeo('leafGrass', card(), mYXZ(x + rnd() - 0.5, h - 0.05, z + rnd() - 0.5, 0, rnd() * PI, 0, 0.9 + rnd() * 0.6, 0.7 + rnd() * 0.5, 1), 0.6 + rnd() * 0.3); }
  }
  /** Behind the German line: fields with hedges, a farm, the road, the field-gun pit, the meadow the Bristol uses. */
  function fields(rnd) {
    for (let i = 0; i < 1400; i++) {
      const x = U.lerp(-135, 135, rnd()), z = U.lerp(-138, -60, rnd()), h = height(x, z);
      if (Math.abs(z - roadZ(x)) < 3 || inVillage(x, z)) continue;
      L.addGeo('leafGrass', card(), mYXZ(x, h - 0.05, z, (rnd() - 0.5) * 0.2, rnd() * PI, 0, 1.2 + rnd(), 0.6 + rnd() * 0.5, 1), 0.7 + rnd() * 0.4);
    }
    // hedgerows
    for (const [x0, z0, x1, z1] of [[-130, -70, -40, -70], [-20, -70, 30, -72], [-130, -100, -60, -96], [80, -64, 130, -66], [100, -64, 100, -88]]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let t = 0; t < len; t += 1.6) { const x = U.lerp(x0, x1, t / len), z = U.lerp(z0, z1, t / len), h = height(x, z); for (let k = 0; k < 3; k++) L.addGeo('leafBush', card(), mYXZ(x + (rnd() - 0.5), h - 0.1, z + (rnd() - 0.5), 0, k / 3 * PI + rnd(), 0, 2.2, 1.6 + rnd() * 0.6, 1), 0.7 + rnd() * 0.3); }
    }
    // the road from the east to the village square, poplars along it
    for (let x = -10; x < 140; x += 2) { const z = roadZ(x); deco(x - 1, height(x, z) + 0.01, z - 2.5, x + 1.2, height(x, z) + 0.03, z + 2.5, 'mudWall'); }
    for (let x = -4; x < 136; x += 9) for (const sd of [-1, 1]) { const z = roadZ(x) + sd * 4; tree(x, z, rnd, { tall: true }); }
    // the field-gun pit
    const fg = MW.fieldGun = { x: 56, z: -74, yaw: 2.4 };
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; if (Math.abs(U.wrapAngle(a - 0.8)) < 0.4) continue; L.addGeo('sandbag', L.geo('box'), mYXZ(fg.x + Math.cos(a) * 3.2, height(fg.x, fg.z) + 0.35, fg.z + Math.sin(a) * 3.2, 0, -a, 0, 0.7, 0.7, 2.2)); }
    // the Bristol's meadow by the road
    MW.meadow = { x: 108, z: -58 };
  }
  const roadZ = (x) => -78 - Math.sin(x * 0.02) * 6 - (x < 40 ? (40 - x) * 0.35 : 0);
  MW.roadZ = roadZ;
  function tree(x, z, rnd, o) {
    o = o || {};
    const h = o.tall ? 11 + rnd() * 5 : 4 + rnd() * 2.5, gy = height(x, z);
    L.addGeo('stump', L.geo('cylLo'), mYXZ(x, gy + h * 0.35, z, 0, 0, 0, o.tall ? 0.2 : 0.16, h * 0.7, o.tall ? 0.2 : 0.16));
    const cw = o.tall ? 2.2 : 3.6;
    for (let k = 0; k < (o.tall ? 6 : 5); k++) { const y = gy + h * (o.tall ? 0.35 + k * 0.11 : 0.6 + k * 0.06); L.addGeo('leafCanopy', new THREE.PlaneGeometry(1, 1), mYXZ(x + (rnd() - 0.5) * 0.6, y, z + (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.5, rnd() * PI, 0, cw, o.tall ? 2.8 : cw, 1), 0.7 + rnd() * 0.3); }
    W.addCyl(x, z, 0.2, gy - 0.5, gy + h * 0.7, { surf: 'wood' });
  }

  // ---------------------------------------------------------------- Saint-Aubin
  const VIL = { x0: -10, z0: -140, x1: 104, z1: -90 };
  const inVillage = (x, z) => x > VIL.x0 && x < VIL.x1 && z > VIL.z0 && z < VIL.z1;
  MW.inVillage = inVillage;
  /** A shelled house: rubble walls standing to different heights, a door gap and window holes, rubble heaped inside. */
  function ruin(x0, z0, x1, z1, rnd, o) {
    o = o || {};
    const gy = height((x0 + x1) / 2, (z0 + z1) / 2), H = o.h || 4.5 + rnd() * 2.5, t = 0.45;
    const wallRun = (a0, a1, fixed, alongX, door) => {
      const len = a1 - a0, n = Math.max(2, Math.round(len / 1.5));
      for (let i = 0; i < n; i++) {
        const s0 = a0 + i * len / n, s1 = a0 + (i + 1) * len / n, mid = (s0 + s1) / 2;
        if (door != null && Math.abs(mid - door) < 0.8) { // a doorway with a lintel
          if (alongX) L.box(s0, gy + 2.3, fixed, s1, gy + 2.7, fixed + t, 'ruin'); else L.box(fixed, gy + 2.3, s0, fixed + t, gy + 2.7, s1, 'ruin');
          continue;
        }
        const broken = rnd() < 0.35, h = broken ? 0.8 + rnd() * 2 : H - rnd() * 1.2;
        if (alongX) L.box(s0, gy - 0.2, fixed, s1, gy + h, fixed + t, 'ruin'); else L.box(fixed, gy - 0.2, s0, fixed + t, gy + h, s1, 'ruin');
      }
    };
    wallRun(x0, x1, z0, true, o.doorN); wallRun(x0, x1, z1 - t, true, o.doorS != null ? o.doorS : (x0 + x1) / 2);
    wallRun(z0 + t, z1 - t, x0, false, o.doorW); wallRun(z0 + t, z1 - t, x1 - t, false, o.doorE);
    noStand(x0 - 0.3, gy + 0.85, z0 - 0.3, x0 + t + 0.3, z1 + 0.3); noStand(x1 - t - 0.3, gy + 0.85, z0 - 0.3, x1 + 0.3, z1 + 0.3);
    noStand(x0, gy + 0.85, z0 - 0.3, x1, z0 + t + 0.3); noStand(x0, gy + 0.85, z1 - t - 0.3, x1, z1 + 0.3);
    // a few charred rafters and a heap of rubble
    for (let i = 0; i < 3; i++) L.addGeo('stump', L.geo('box'), mYXZ(U.lerp(x0, x1, rnd()), gy + H * 0.6, U.lerp(z0, z1, rnd()), (rnd() - 0.5) * 0.8, rnd() * 3, (rnd() - 0.5) * 0.5, 0.18, 0.18, (x1 - x0) * 0.8));
    const cx = U.lerp(x0 + 1.5, x1 - 1.5, rnd()), cz = U.lerp(z0 + 1.5, z1 - 1.5, rnd());
    L.addGeo('ruin', new THREE.IcosahedronGeometry(1, 0), mYXZ(cx, gy, cz, rnd(), rnd() * 3, rnd(), 1.4, 0.7, 1.2)); solid(cx - 1, gy, cz - 0.9, cx + 1, gy + 0.6, cz + 0.9, 'concrete');
  }
  function village(rnd) {
    // houses round a square at (40, -112), streets east-west and north-south
    const lots = [[-4, -104, 6, -94], [8, -106, 18, -96], [-6, -122, 6, -110], [8, -124, 20, -114], [50, -104, 62, -94], [64, -106, 74, -96],
      [48, -136, 60, -126], [8, -138, 22, -128], [-6, -138, 6, -128], [78, -104, 90, -94], [92, -106, 102, -96], [78, -124, 88, -114]];
    for (const l of lots) ruin(l[0], l[1], l[2], l[3], rnd, { doorS: (l[0] + l[2]) / 2, doorN: rnd() < 0.5 ? (l[0] + l[2]) / 2 : null });
    // the church: nave, and the tower you can climb (stairs inside, the belfry at 12 m)
    const cx = 30, cz = -118, gy = height(cx, cz);
    ruin(22, -132, 38, -114, rnd, { h: 7, doorS: 30 });
    const tx0 = 26, tz0 = -114, tx1 = 34, tz1 = -106, TH = 12;
    for (const [a, b, c, d] of [[tx0, tz0, tx1, tz0 + 0.5], [tx0, tz1 - 0.5, 28.6, tz1], [31.4, tz1 - 0.5, tx1, tz1], [tx0, tz0, tx0 + 0.5, tz1], [tx1 - 0.5, tz0, tx1, tz1]]) L.box(a, gy - 0.2, b, c, gy + TH, d, 'ruin');
    L.box(28.6, gy + 2.6, tz1 - 0.5, 31.4, gy + TH, tz1, 'ruin');
    for (let k = 0; k < 6; k++) deco(27, gy + k * 2, tz1 - 1.2, 27.6, gy + k * 2 + 0.12, tz1 - 0.6, 'timber'); // the ladder's rungs inside
    // the belfry: a floor at 12 m, a waist-high parapet, corner piers and the spire above
    L.box(tx0, gy + TH, tz0, tx1, gy + TH + 0.2, tz1, 'timber', { surf: 'wood' });
    for (const [a, b, c, d] of [[tx0, tz0, tx1, tz0 + 0.4], [tx0, tz1 - 0.4, tx1, tz1], [tx0, tz0, tx0 + 0.4, tz1], [tx1 - 0.4, tz0, tx1, tz1]]) L.box(a, gy + TH + 0.2, b, c, gy + TH + 1.1, d, 'ruin');
    for (const [a, b] of [[tx0, tz0], [tx1 - 1, tz0], [tx0, tz1 - 1], [tx1 - 1, tz1 - 1]]) L.box(a, gy + TH + 1.1, b, a + 1, gy + TH + 3.6, b + 1, 'ruin');
    L.box(tx0 - 0.3, gy + TH + 3.6, tz0 - 0.3, tx1 + 0.3, gy + TH + 3.9, tz1 + 0.3, 'ruin', { nav: false });
    L.addGeo('tiles', L.geo('cone'), mYXZ(30, gy + TH + 5.5, -110, 0, PI / 4, 0, 6.2, 3.4, 6.2)); noStand(tx0 - 0.5, gy + TH + 3.6, tz0 - 0.5, tx1 + 0.5, tz1 + 0.5);
    L.addGeo('steel', L.geo('cone'), mYXZ(30, gy + TH + 3.1, -110, 0, 0, 0, 0.55, 0.8, 0.55)); // the bell, hung high in the arch
    MW.belfry = { x: 30, y: gy + TH + 0.2, z: -110 }; MW.tower = { x0: tx0, z0: tz0, x1: tx1, z1: tz1, door: { x: 30, z: tz1 - 1.2, y: gy } };
    // the chateau (Brigade HQ): a big house, half roofed, the cellar door on the yard side
    const hx0 = 56, hz0 = -132, hx1 = 80, hz1 = -114, hy = height(68, -123);
    ruin(hx0, hz0, hx1, hz1, rnd, { h: 8, doorS: 68, doorW: -123 });
    L.box(hx0 - 0.4, hy + 7.6, hz0 - 0.4, hx1 - 8, hy + 8.0, hz1 + 0.4, 'tiles', { nav: false });
    deco(64.5, hy, hz1 + 0.02, 67.5, hy + 0.1, hz1 + 2.5, 'ruinDark');
    L.box(66, hy, hz1, 70, hy + 0.9, hz1 + 0.5, 'ruinDark');
    MW.cellar = { x: 68, z: hz1 + 0.8, y: hy };
    deco(77, hy, hz1 + 1, 77.15, hy + 6, hz1 + 1.15, 'steel'); deco(77.15, hy + 4.6, hz1 + 1.05, 78.6, hy + 5.6, hz1 + 1.1, 'flagUnion' in L.mats ? 'flagUnion' : 'flagRed');
    // the orchard to the east: low trees in rows (the last German position)
    for (let x = 108; x < 136; x += 5) for (let z = -132; z < -96; z += 5) tree(x + (rnd() - 0.5), z + (rnd() - 0.5), rnd);
    // rubble, carts, a fallen telegraph pole
    for (let i = 0; i < 40; i++) { const x = U.lerp(VIL.x0, VIL.x1, rnd()), z = U.lerp(VIL.z0, VIL.z1, rnd()); const h = height(x, z); L.addGeo('ruin', new THREE.IcosahedronGeometry(1, 0), mYXZ(x, h, z, rnd(), rnd() * 3, rnd(), 0.4 + rnd() * 0.5, 0.25 + rnd() * 0.3, 0.4 + rnd() * 0.5)); }
    MW.square = { x: 40, z: -112 };
  }
  function edges() {
    const T = 40;
    W.add(B.minX - 2, -3, B.minZ - 2, B.maxX + 2, T, B.minZ, { shoot: false }); W.add(B.minX - 2, -3, B.maxZ, B.maxX + 2, T, B.maxZ + 2, { shoot: false });
    W.add(B.minX - 2, -3, B.minZ, B.minX, T, B.maxZ, { shoot: false }); W.add(B.maxX, -3, B.minZ, B.maxX + 2, T, B.maxZ, { shoot: false });
  }

  // ---------------------------------------------------------------- build
  MW.build = function () {
    materials();
    const rnd = U.mulberry32(1111);
    L.killY = -14;
    terrain(); trenchDressing(rnd); noMansLand(rnd); fields(rnd); village(rnd); edges();
    // sniper perches
    MW.perches = { belfry: { x: 31.5, y: MW.belfry.y, z: -111 }, ger2: { x: -12, y: 0, z: GER2 - 4 } };
    MW.flareLamps = [0, 1, 2, 3].map(() => { const lp = L.lamp(0, -50, 0, { color: 0xffd8c0, intensity: 5, distance: 55, pool: false, prio: 6 }); lp.on = false; return lp; });
    // objectives
    const task = (id, x, y, z, hold, prompt, r) => L.addInteract({ id, type: 'task', pos: [x, y, z], face: null, radius: r || 2.0, hold, prompt, enabled: false });
    task('phone', MW.phone.x, FLOOR, MW.phone.z, 2.0, 'Crank the field telephone', 2.2);
    task('gunCharge', MW.fieldGun.x, height(MW.fieldGun.x, MW.fieldGun.z), MW.fieldGun.z, 2.0, 'Set the charge on the gun breech', 2.6);
    task('bristol', MW.meadow.x + 1, height(MW.meadow.x, MW.meadow.z), MW.meadow.z + 1, 1.0, 'Climb into the observer\'s seat', 3.2);
    task('cellar', MW.cellar.x, MW.cellar.y, MW.cellar.z, 1.5, 'Go down to Brigade HQ', 2.2);
    task('flares', MW.belfry.x, MW.belfry.y, MW.belfry.z, 1.5, 'Fire the recall flares', 2.6);
    task('towerUp', MW.tower.door.x - 2.4, MW.tower.door.y, MW.tower.door.z, 1.2, 'Climb the tower ladder', 1.8);
    task('towerDown', MW.belfry.x - 2.6, MW.belfry.y, MW.belfry.z + 2.6, 1.0, 'Climb down', 1.5);
    CF.Map.kit.ammoCache('cacheBrit', 3, FLOOR, 103, 'z-');
    CF.Map.kit.ammoCache('cacheGer', 5, FLOOR, -11.2, 'z+');
    CF.Map.kit.ammoCache('cacheVillage', 44, height(44, -108), -108, 'x-');

    // ------------------------------------------------------------ points
    const P = L.points;
    P.start = { x: 3.5, y: FLOOR, z: BRIT, yaw: 0 };
    P.cp = {
      top: { x: 3.5, y: FLOOR, z: BRIT, yaw: 0 }, nml: { x: 4, y: 0, z: 30, yaw: 0 },
      gas: { x: 6, y: FLOOR, z: GER1, yaw: -PI / 2 }, comm: { x: 20, y: FLOOR, z: -24, yaw: 0 },
      tank: { x: 12, y: 0, z: 12, yaw: 0 }, gun: { x: 30, y: 0, z: -58, yaw: -0.6 },
      plane: { x: 104, y: height(104, -62), z: -62, yaw: -1.2 },
      village: { x: 2, y: height(2, -108), z: -108, yaw: -PI / 2 }, square: { x: 40, y: height(40, -108), z: -108, yaw: -PI / 2 },
      eleventh: { x: 66, y: height(66, -110), z: -110, yaw: -PI / 2 }
    };
    P.trenchMen = { brit: MW.ladders.slice(6, 14), ger1: [], ger2: [] };
    for (let x = -60; x < 60; x += 10) { P.trenchMen.ger1.push([x + 3.5, GER1 + 1.6]); }
    for (let x = -40; x < 60; x += 10) { P.trenchMen.ger2.push([x + 3.5, GER2 + 1.6]); }
    L.spawns.ger1 = [[-30, -24], [20, -30], [60, -24], [-50, -14], [70, -12], [-8, -30]];
    L.spawns.ger2 = [[-30, -60], [10, -64], [40, -60], [70, -56], [-60, -56]];
    L.spawns.fields = [[20, -88], [60, -92], [90, -84], [-20, -84], [80, -60], [120, -76]];
    L.spawns.village = [[0, -130], [20, -136], [90, -134], [100, -110], [60, -96], [-6, -96], [86, -126]];
    L.spawns.orchard = [[120, -100], [128, -118], [116, -132], [132, -128], [110, -92]];
    P.hill = { x: 40, y: 0, z: -112 };
  };

  // ---------------------------------------------------------------- time of day: the morning of 11 November 1918 was grey and misty
  const TIMES = {
    predawn: { fog: [0.16, 0.18, 0.22], fogDensity: 0.016, hemi: [0x6a7488, 0x1a1814, 0.32], sun: [0xb0b8d0, 0.5], sunDir: [0.6, 0.18, 0.5],
      sky: { zen: [0.04, 0.06, 0.12], hor: [0.32, 0.3, 0.32], glow: [0.5, 0.3, 0.2], glowDir: [0.6, 0.3], glow2: [0.05, 0.06, 0.1], glow2Dir: [-1, 0], cloudDark: [0.12, 0.13, 0.16], cloudLit: [0.5, 0.42, 0.4], stars: 0.15, moon: 0 },
      post: { bloom: 0.3, exposure: 0.95, sat: 0.72, shadow: [0.0, 0.004, 0.012], high: [0.01, 0.006, 0.0], threshold: 1.25 }, env: { top: [0.12, 0.14, 0.2], bottom: [0.08, 0.07, 0.06], band: [0.4, 0.3, 0.25] } },
    mist: { fog: [0.5, 0.52, 0.52], fogDensity: 0.02, hemi: [0xb8c0c4, 0x3a3428, 0.58], sun: [0xe8e0d0, 0.8], sunDir: [0.55, 0.35, 0.45],
      sky: { zen: [0.36, 0.4, 0.44], hor: [0.62, 0.62, 0.6], glow: [0.4, 0.34, 0.26], glowDir: [0.55, 0.4], glow2: [0.1, 0.1, 0.1], glow2Dir: [-1, 0], cloudDark: [0.5, 0.52, 0.54], cloudLit: [0.8, 0.78, 0.74], stars: 0, moon: 0 },
      post: { bloom: 0.15, exposure: 0.84, sat: 0.7, shadow: [0.0, 0.002, 0.006], high: [0.01, 0.006, -0.002], threshold: 1.5 }, env: { top: [0.42, 0.45, 0.5], bottom: [0.2, 0.18, 0.14], band: [0.5, 0.48, 0.44] } },
    gas: { fog: [0.48, 0.5, 0.32], fogDensity: 0.024, hemi: [0xc0c4a0, 0x3a3624, 0.55], sun: [0xe8e0b0, 0.8], sunDir: [0.4, 0.5, 0.4],
      sky: { zen: [0.38, 0.4, 0.34], hor: [0.6, 0.6, 0.44], glow: [0.4, 0.38, 0.2], glowDir: [0.4, 0.4], glow2: [0.1, 0.1, 0.06], glow2Dir: [-1, 0], cloudDark: [0.5, 0.5, 0.42], cloudLit: [0.78, 0.76, 0.6], stars: 0, moon: 0 },
      post: { bloom: 0.15, exposure: 0.84, sat: 0.66, shadow: [0.004, 0.004, 0.0], high: [0.012, 0.01, -0.004], threshold: 1.5 }, env: { top: [0.42, 0.44, 0.36], bottom: [0.2, 0.18, 0.12], band: [0.5, 0.48, 0.36] } },
    grey: { fog: [0.56, 0.58, 0.58], fogDensity: 0.011, hemi: [0xc8d0d4, 0x3c3828, 0.66], sun: [0xf0ece0, 1.2], sunDir: [0.4, 0.6, 0.35],
      sky: { zen: [0.4, 0.45, 0.5], hor: [0.68, 0.68, 0.66], glow: [0.35, 0.32, 0.26], glowDir: [0.4, 0.35], glow2: [0.1, 0.1, 0.1], glow2Dir: [-1, 0], cloudDark: [0.55, 0.57, 0.6], cloudLit: [0.9, 0.88, 0.84], stars: 0, moon: 1 },
      post: { bloom: 0.1, exposure: 0.8, sat: 0.74, shadow: [0.0, 0.002, 0.006], high: [0.01, 0.006, -0.004], threshold: 1.6 }, env: { top: [0.48, 0.52, 0.58], bottom: [0.22, 0.2, 0.16], band: [0.56, 0.54, 0.5] } },
    clearing: { fog: [0.62, 0.62, 0.58], fogDensity: 0.007, hemi: [0xd8dcd4, 0x40382a, 0.68], sun: [0xfff0d0, 1.5], sunDir: [0.3, 0.6, 0.45],
      sky: { zen: [0.3, 0.44, 0.62], hor: [0.76, 0.74, 0.68], glow: [0.6, 0.48, 0.3], glowDir: [0.3, 0.4], glow2: [0.1, 0.1, 0.1], glow2Dir: [-1, 0], cloudDark: [0.62, 0.62, 0.64], cloudLit: [1.05, 1.0, 0.92], stars: 0, moon: 1.5 },
      post: { bloom: 0.15, exposure: 0.8, sat: 0.85, shadow: [0.0, 0.002, 0.004], high: [0.016, 0.008, -0.006], threshold: 1.5 }, env: { top: [0.5, 0.58, 0.7], bottom: [0.24, 0.2, 0.15], band: [0.66, 0.6, 0.5] } }
  };
  MW.TIMES = TIMES;
  const v3 = (a, v) => v.set(a[0], a[1], a[2]);
  MW.setTime = function (name) {
    const t = TIMES[name] || TIMES.grey, G = CF.Game, scene = G.scene;
    if (!scene || G.mapId !== 'western') return;
    MW.time = name;
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
    if (L.mountainMat) { const u = L.mountainMat.uniforms; u.uSun.value.copy(G.moonDir); u.uHaze.value.set(t.fog[0], t.fog[1], t.fog[2]); }
    if (L.envRT) { L.envRT.dispose(); L.envRT = null; }
    const k = Math.min(1, t.sun[1] / 1.5 + 0.2), pn = [[1.2, 1.2, 1.2], [1.1, 1.15, 1.2], [1.2, 1.15, 1.1], [1.15, 1.15, 1.15]].map((c) => c.map((v) => v * k));
    L.buildEnv(CF.Post.renderer, Object.assign({}, G.mapDef.theme, { env: Object.assign({ panels: pn }, t.env) })); G.vmScene.environment = scene.environment;
    CF.Post.setState(t.post);
    CF.FX.dustRate = 0;
  };
  MW.tick = function (t) { if (CF.MapJungle) CF.MapJungle.swayTick(t); };
  MW.dispose = function () {};
})(window.CF);
