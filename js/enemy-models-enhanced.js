'use strict';
/* Cinderfall — Enhanced characters for the Story Campaign (Settings → Video → Story Campaign characters).
   This script is loaded only when "Enhanced" is picked (CF.lazy), and its textures are painted the first time a
   person is built, so players who keep "Standard" never pay for any of it.
   Same skeleton and animation as the standard people (js/story-models.js); what changes:
   - bodies turned on a lathe (tapered limbs, chest, pelvis) instead of boxes, sculpted heads with eyes, brows, ears
     and a painted face, hands with fingers closed on the weapon
   - kit: plate carriers with pouches and radios, chest rigs, shemaghs, helmets with NVG mounts, berets, caps, boots
   - generated fabric weave, desert camo, webbing, leather, skin, parkerized steel and walnut textures with normal maps
   - weapons cut from side profiles (AK, M4, PKM, SVD, RPG-7, pistol)
   - per-person variety: skin tone, build, beards, clothing colours
   Pieces are merged per bone and per material and tinted with vertex colours, so a soldier is about 30 draw calls
   against about 40 for the standard model's loose primitives, but with roughly 20× the triangles. */
(function (CF) {
  const H = CF.Human, U = CF.U, PI = Math.PI;
  const hp = H.helpers;
  let MAT = null;

  // ---------------------------------------------------------------- textures (once)
  function textures() {
    const T = CF.Tex.util, S = CF.bootQuality === 'low' ? 256 : 512, n = S * S, rnd = U.mulberry32(5150), sstep = U.smoothstep;
    const out = {};
    // cotton/poly weave: fine over-under threads, soft wrinkles, a little wear (near white: tinted per garment)
    {
      const w = T.tileNoise(S, 3, 3, 4, 5101, 0.55), f = T.tileNoise(S, 64, 64, 1, 5102);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, a = Math.sin(x * PI * 0.5) * Math.sin(y * PI * 0.5), weave = (x + y) % 4 < 2 ? a : -a;
        const wr = Math.sin((w[i] * 8 + y / S * 3) * PI) * 0.5 + 0.5;
        const v = 0.86 + weave * 0.03 + (wr - 0.5) * 0.1 + (f[i] - 0.5) * 0.04;
        rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v;
        hgt[i] = weave * 0.25 + wr * 0.6; rough[i] = 0.92;
      }
      out.fabric = T.pack(rgb, hgt, rough, 2.0, S);
    }
    // three-colour desert camo (friendly uniforms)
    {
      const a = T.tileNoise(S, 5, 5, 4, 5111, 0.6), b = T.tileNoise(S, 7, 7, 4, 5112, 0.6), f = T.tileNoise(S, 64, 64, 1, 5113);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, weave = ((x + y) % 4 < 2 ? 1 : -1) * Math.sin(x * PI * 0.5) * Math.sin(y * PI * 0.5);
        let c = [0.72, 0.64, 0.5];
        if (a[i] > 0.6) c = [0.55, 0.46, 0.33];
        if (b[i] > 0.66) c = [0.4, 0.36, 0.28];
        const k = 1 + (f[i] - 0.5) * 0.08 + weave * 0.03;
        rgb[i * 3] = c[0] * k; rgb[i * 3 + 1] = c[1] * k; rgb[i * 3 + 2] = c[2] * k;
        hgt[i] = weave * 0.3 + a[i] * 0.2; rough[i] = 0.93;
      }
      out.camo = T.pack(rgb, hgt, rough, 2.0, S);
    }
    // nylon webbing with MOLLE rows (gear, straps, pouches)
    {
      const f = T.tileNoise(S, 32, 4, 2, 5121);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, row = (y % (S / 8)) / (S / 8), strap = row > 0.55 && row < 0.85 ? 1 : 0, stitch = strap && (x % (S / 16)) < 2 ? 1 : 0;
        const v = 0.8 + (f[i] - 0.5) * 0.08 - strap * 0.06 - stitch * 0.1 + Math.sin(y * 1.9) * 0.015;
        rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v;
        hgt[i] = strap * 0.6 + Math.sin(y * 1.9) * 0.1 - stitch * 0.3; rough[i] = 0.8;
      }
      out.gear = T.pack(rgb, hgt, rough, 2.2, S);
    }
    // skin: pores and blotches (near white, tinted by skin tone), lips and cheek flush painted where the sphere's face is
    {
      const p1 = T.tileNoise(S, 48, 48, 2, 5131), p2 = T.tileNoise(S, 6, 6, 3, 5132);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const u = (i % S) / S, v = ((i / S) | 0) / S; // sphere: u around (face at 0.75), v from top
        const du = u - 0.75, lips = Math.exp(-((du * 14) ** 2) - (((v - 0.7) * 30) ** 2)), cheek = Math.exp(-(((Math.abs(du) - 0.07) * 14) ** 2) - (((v - 0.58) * 12) ** 2));
        const sock = Math.exp(-(((Math.abs(du) - 0.045) * 26) ** 2) - (((v - 0.47) * 28) ** 2));
        const k = 0.92 + (p2[i] - 0.5) * 0.06 - p1[i] * 0.03;
        rgb[i * 3] = k * (1 - lips * 0.12 - sock * 0.1) + cheek * 0.03; rgb[i * 3 + 1] = k * (1 - lips * 0.3 - sock * 0.16); rgb[i * 3 + 2] = k * (1 - lips * 0.25 - sock * 0.12);
        hgt[i] = p1[i] * 0.3; rough[i] = 0.55 + p1[i] * 0.1 - lips * 0.15;
      }
      out.skin = T.pack(rgb, hgt, rough, 1.2, S);
    }
    // parkerized steel and walnut
    {
      const f = T.tileNoise(S, 32, 32, 3, 5141), g = T.tileNoise(S, 2, 40, 4, 5142, 0.6);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) { const v = 0.78 + (f[i] - 0.5) * 0.12; rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v; hgt[i] = f[i]; rough[i] = 0.5 + f[i] * 0.2; }
      out.metal = T.pack(rgb, hgt, rough, 1.0, S);
      const r2 = new Float32Array(n * 3), h2 = new Float32Array(n), o2 = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i % S, gr = 0.5 + 0.5 * Math.sin(g[i] * 34 + x * 0.04); const v = 0.7 + gr * 0.22; r2[i * 3] = v; r2[i * 3 + 1] = v * 0.86; r2[i * 3 + 2] = v * 0.74; h2[i] = gr * 0.3; o2[i] = 0.45 + gr * 0.1; }
      out.wood = T.pack(r2, h2, o2, 1.2, S);
    }
    for (const k in out) for (const t of ['map', 'normalMap', 'roughnessMap']) out[k][t].wrapS = out[k][t].wrapT = THREE.RepeatWrapping;
    return out;
  }
  function materials() {
    if (MAT) return MAT;
    const T = textures();
    const std = (t, o) => new THREE.MeshStandardMaterial(Object.assign({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, vertexColors: true, envMapIntensity: 0.3 }, o || {}));
    MAT = {
      fabric: std(T.fabric, { normalScale: new THREE.Vector2(0.7, 0.7) }), camo: std(T.camo, { normalScale: new THREE.Vector2(0.7, 0.7) }), gear: std(T.gear),
      skin: std(T.skin, { normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9 }),
      metal: std(T.metal, { metalness: 0.65, envMapIntensity: 0.5 }), wood: std(T.wood, { envMapIntensity: 0.45 }),
      plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, envMapIntensity: 0.3 }),
      eye: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, envMapIntensity: 0.4 })
    };
    MAT.textures = T;
    return MAT;
  }

  // ---------------------------------------------------------------- geometry helpers
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  /** Put a geometry in place (bone space), tinted with a vertex colour; returns a non-indexed copy. */
  function put(geo, color, x, y, z, rx, ry, rz, sx, sy, sz, shade) {
    if (geo.index) { if (!geo.userData.flat) geo.userData.flat = geo.toNonIndexed(); geo = geo.userData.flat; }
    const g = geo.clone();
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz); _p.set(x || 0, y || 0, z || 0);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    const n = g.attributes.position.count, col = new Float32Array(n * 3), base = g.attributes.color; _c.set(color).convertSRGBToLinear(); // sRGB swatch → linear, like the standard models
    for (let i = 0; i < n; i++) {
      const k = shade ? shade(g.attributes.position, i) : 1;
      const br = base ? base.getX(i) : 1, bg = base ? base.getY(i) : 1, bb = base ? base.getZ(i) : 1;
      col[i * 3] = _c.r * k * br; col[i * 3 + 1] = _c.g * k * bg; col[i * 3 + 2] = _c.b * k * bb;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    return g;
  }
  function merge(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); col.set(g.attributes.color.array, o * 3);
      o += c; g.dispose();
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.computeBoundingSphere();
    return m;
  }
  /** Collects pieces per bone and material, then bakes one mesh per pair. */
  class Kit {
    constructor() { this.parts = new Map(); }
    add(bone, mat, geo) { const k = bone.uuid + '|' + mat; if (!this.parts.has(k)) this.parts.set(k, { bone, mat, list: [] }); this.parts.get(k).list.push(geo); }
    bake(M, shadowBones) {
      for (const { bone, mat, list } of this.parts.values()) {
        const mesh = new THREE.Mesh(merge(list), M[mat]);
        mesh.castShadow = shadowBones.has(bone); mesh.receiveShadow = false;
        bone.add(mesh);
      }
    }
  }
  const G = {};
  /** Every source shape is built once and reused (put() clones it): building a soldier is then mostly copying. */
  const memo = (name, fn) => (...a) => { const k = name + JSON.stringify(a); return G[k] || (G[k] = fn(...a)); };
  const lathe = memo('lathe', (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 14));
  const sph = memo('sph', (ws, hs, ps, pl, ts, tl) => new THREE.SphereGeometry(1, ws || 16, hs || 12, ps, pl, ts, tl));
  const box = memo('box', (sx, sy, sz, seg) => new THREE.BoxGeometry(sx, sy, sz, seg || 1, seg || 1, seg || 1));
  const cyl = memo('cyl', (rt, rb, h, seg, open) => new THREE.CylinderGeometry(rt, rb, h, seg || 12, 1, !!open));
  const caps = memo('caps', (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8));
  /** Rounded slab: a rounded rectangle extruded with a soft bevel (plates, pouches, holsters). */
  function slab(w, h, d, r) {
    const k = [w, h, d, r].join(); if (G['slab' + k]) return G['slab' + k];
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const b = Math.min(d * 0.35, r * 0.8);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - b * 2), bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -(d - b * 2) / 2);
    const sc = 1 / Math.max(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sc * 2, uv.getY(i) * sc * 2);
    return (G['slab' + k] = g);
  }
  /** Side silhouette (forward = +x in the drawing) extruded to a width: gun parts, boots. Forward ends up along -Z. */
  const profile = memo('profile', profileRaw);
  function profileRaw(pts, width, bevel) {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    const b = bevel == null ? width * 0.15 : bevel;
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, width - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 3 });
    g.translate(0, 0, -(width - b * 2) / 2); g.rotateY(PI / 2); // drawing x → -z
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
    return g;
  }

  // ---------------------------------------------------------------- head
  /** A sculpted head: sphere pushed into brow, cheekbones, nose, lips, jaw and chin. Face toward -Z. */
  const headGeo = (o) => { const j = Math.round(o.jaw * 4) / 4; return G['head' + j] || (G['head' + j] = headRaw(j)); };
  function headRaw(jaw) {
    const g = new THREE.SphereGeometry(1, 30, 22), P = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const front = Math.max(0, -v.z), side = v.x, up = v.y;
      const G2 = (a, b, sa, sb) => Math.exp(-((a / sa) ** 2) - ((b / sb) ** 2));
      let dz = 0, dx = 0, dy = 0;
      dz -= G2(side, up + 0.1, 0.1, 0.2) * 0.34 * front; dz -= G2(side, up + 0.24, 0.16, 0.07) * 0.08 * front; // nose, nostril wings
      dz -= G2(side, up - 0.27, 0.42, 0.09) * 0.1 * front;                                  // brow ridge
      dz += G2(Math.abs(side) - 0.34, up - 0.12, 0.16, 0.13) * 0.07 * front;                // eye sockets
      dx += Math.sign(side) * G2(Math.abs(side) - 0.62, up + 0.02, 0.2, 0.2) * 0.05;        // cheekbones
      dz -= G2(side, up + 0.42, 0.22, 0.08) * 0.05 * front;                                 // lips
      dz -= G2(side, up + 0.72, 0.22, 0.14) * 0.06 * front;                                 // chin
      if (up < -0.1) { const k = (-up - 0.1) / 0.9; dx -= v.x * k * 0.18 * (2 - jaw); dz += Math.max(0, v.z) * k * 0.25; } // narrow jaw, flat nape
      if (up > 0.4) dz += Math.max(0, v.z) * 0.08;                                          // skull back
      P.setXYZ(i, v.x + dx, v.y + dy, v.z + dz);
    }
    g.computeVertexNormals();
    return g;
  }
  /** Ear: a flattened disc, turned outward. */
  const earGeo = () => G.ear || (G.ear = (() => { const g = sph(10, 8); g.scale(0.018, 0.032, 0.012); return g; })());
  function eyeGeo() {
    if (G.eye) return G.eye;
    const g = sph(10, 8).toNonIndexed(); g.scale(0.0125, 0.0125, 0.0125);
    const P = g.attributes.position, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const f = -P.getZ(i) / 0.0125; const iris = f > 0.6 ? (f > 0.88 ? 0.03 : 0.2) : 0.85; col[i * 3] = iris; col[i * 3 + 1] = iris * (iris < 0.5 ? 0.75 : 1); col[i * 3 + 2] = iris * (iris < 0.5 ? 0.5 : 0.97); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return (G.eye = g);
  }

  // ---------------------------------------------------------------- weapons
  function gun(kind, K, bone) {
    const M = 'metal', blk = 0x2a2b2d, park = 0x3a3c3a, walnut = 0x8a5a38, tan = 0x9a8a6a, olive = 0x5a6040;
    const g = { grip: new THREE.Vector3(0, -0.07, -0.2), fore: new THREE.Vector3(0, -0.04, -0.46), kind };
    const add = (mat, geo) => K.add(bone, mat, geo);
    if (kind === 'ak' || kind === 'svd') {
      const L = kind === 'svd';
      // wooden stock: butt at the shoulder pocket, rising to the receiver (drawing: forward +x, up +y)
      add('wood', put(profile(L ? [[-0.06, -0.09], [0.02, -0.1], [0.2, -0.03], [0.2, 0.03], [0.13, 0.02], [0.04, -0.04], [0.0, 0.03], [-0.06, 0.04]] : [[-0.06, -0.08], [0.0, -0.09], [0.16, -0.035], [0.18, 0.025], [0.02, 0.035], [-0.06, 0.04]], 0.042), walnut));
      add(M, put(profile([[0.16, -0.04], [0.47, -0.04], [0.47, 0.035], [0.42, 0.045], [0.16, 0.04]], 0.05, 0.005), park));             // receiver
      add(M, put(box(0.044, 0.012, 0.3), blk, 0, 0.052, -0.3));                                                                             // dust cover
      add('wood', put(profile([[0.18, -0.04], [0.26, -0.04], [0.23, -0.15], [0.19, -0.15]], 0.032, 0.006), walnut));                   // pistol grip
      add('wood', put(profile([[0.47, -0.035], [0.7, -0.03], [0.7, 0.02], [0.47, 0.03]], 0.056, 0.012), walnut));                     // handguard
      add(M, put(cyl(0.014, 0.014, 0.2, 10), park, 0, 0.055, -0.6, PI / 2));                                                              // gas tube
      if (!L) add(M, put(profile([[0.3, -0.04], [0.36, -0.04], [0.4, -0.12], [0.38, -0.22], [0.32, -0.22], [0.33, -0.12], [0.3, -0.04]], 0.034, 0.004), blk)); // curved mag
      else { add(M, put(box(0.034, 0.1, 0.07), blk, 0, -0.08, -0.33)); add(M, put(cyl(0.024, 0.024, 0.24, 14), blk, 0, 0.1, -0.3, PI / 2)); add(M, put(cyl(0.03, 0.03, 0.04, 14), blk, 0, 0.1, -0.16, PI / 2)); }
      add(M, put(cyl(0.012, 0.012, L ? 0.44 : 0.28, 10), park, 0, 0.012, L ? -0.93 : -0.84, PI / 2));
      add(M, put(cyl(0.017, 0.017, 0.05, 10), blk, 0, 0.012, L ? -1.14 : -0.98, PI / 2));                                                  // muzzle device
      add(M, put(box(0.012, 0.045, 0.02), blk, 0, 0.045, L ? -1.08 : -0.94));                                                              // front sight
      add(M, put(box(0.03, 0.02, 0.05), blk, 0, 0.055, -0.5));                                                                              // rear sight block
      g.muzzle = hp.grp(bone, 0, 0.012, L ? -1.18 : -1.01);
      if (L) g.fore.set(0, -0.04, -0.55);
    } else if (kind === 'm4') {
      add(M, put(profile([[-0.06, -0.075], [0.0, -0.08], [0.12, -0.02], [0.14, 0.03], [0.0, 0.03], [-0.06, 0.035]], 0.05), blk));      // stock
      add(M, put(cyl(0.014, 0.014, 0.16, 10), blk, 0, 0.0, 0.02 - 0.1, PI / 2));                                                           // buffer tube
      add(M, put(profile([[0.14, -0.045], [0.42, -0.045], [0.42, 0.04], [0.14, 0.04]], 0.05, 0.005), blk));                                // receivers
      add(M, put(profile([[0.42, -0.04], [0.72, -0.04], [0.72, 0.04], [0.42, 0.04]], 0.062, 0.01), tan));                                   // rail handguard
      for (let z = 0.44; z < 0.71; z += 0.035) add(M, put(box(0.064, 0.008, 0.014), blk, 0, 0.042, -z));
      add(M, put(profile([[0.2, -0.045], [0.26, -0.045], [0.22, -0.14], [0.17, -0.13]], 0.03, 0.006), blk));                               // grip
      add(M, put(profile([[0.28, -0.04], [0.35, -0.04], [0.36, -0.19], [0.3, -0.19]], 0.03, 0.004), blk));                                // mag
      add(M, put(box(0.04, 0.05, 0.1), blk, 0, 0.075, -0.26)); add('eye', put(box(0.03, 0.03, 0.005), 0x223344, 0, 0.078, -0.312));      // optic
      add(M, put(cyl(0.011, 0.011, 0.14, 10), blk, 0, 0.0, -0.79, PI / 2)); add(M, put(cyl(0.014, 0.014, 0.05, 8), blk, 0, 0, -0.87, PI / 2));
      g.muzzle = hp.grp(bone, 0, 0, -0.9);
    } else if (kind === 'pkm') {
      add('wood', put(profile([[-0.06, -0.1], [0.0, -0.1], [0.18, -0.04], [0.2, 0.03], [0.02, 0.03], [-0.06, 0.04]], 0.045), walnut));
      add(M, put(profile([[0.18, -0.05], [0.56, -0.05], [0.56, 0.05], [0.18, 0.05]], 0.065, 0.006), park));
      add('wood', put(profile([[0.22, -0.05], [0.28, -0.05], [0.25, -0.16], [0.2, -0.16]], 0.034, 0.006), walnut));
      add('gear', put(slab(0.1, 0.12, 0.14, 0.012), olive, 0.07, -0.12, -0.32));
      add(M, put(cyl(0.017, 0.017, 0.56, 10), park, 0, 0.02, -0.84, PI / 2)); add(M, put(cyl(0.024, 0.02, 0.07, 10), blk, 0, 0.02, -1.12, PI / 2));
      for (const s of [-1, 1]) add(M, put(cyl(0.007, 0.007, 0.26, 6), blk, s * 0.05, -0.1, -0.92, 0, 0, s * 0.35));
      g.muzzle = hp.grp(bone, 0, 0.02, -1.16); g.fore.set(0, -0.05, -0.52);
    } else if (kind === 'rpg') {
      add('fabric', put(lathe([[0.042, -0.5], [0.042, 0.5]], 16), olive, 0, 0, -0.1, PI / 2));
      add('wood', put(lathe([[0.05, -0.1], [0.052, 0.1]], 16), walnut, 0, 0, -0.35, PI / 2));
      add(M, put(lathe([[0.02, 0], [0.07, 0.1], [0.075, 0.2], [0.05, 0.3], [0.0, 0.46]], 16), olive, 0, 0, -0.62, -PI / 2));             // warhead
      add(M, put(lathe([[0.045, 0], [0.08, 0.14]], 16), blk, 0, 0, 0.42, PI / 2));                                                       // venturi
      add('wood', put(profile([[0.16, -0.04], [0.22, -0.04], [0.2, -0.15], [0.15, -0.15]], 0.03, 0.005), walnut));
      add('wood', put(profile([[0.34, -0.04], [0.4, -0.04], [0.38, -0.15], [0.33, -0.15]], 0.03, 0.005), walnut));
      add(M, put(box(0.02, 0.06, 0.05), blk, -0.04, 0.05, -0.2));
      g.muzzle = hp.grp(bone, 0, 0, -1.08); g.grip.set(0, -0.12, -0.18); g.fore.set(0, -0.12, -0.36);
    } else if (kind === 'pistol') {
      add(M, put(profile([[-0.02, 0.0], [0.17, 0.0], [0.17, 0.035], [-0.02, 0.035]], 0.028, 0.004), blk, 0, 0.012, 0.0));
      add(M, put(profile([[-0.01, 0.0], [0.05, 0.0], [0.03, -0.1], [-0.025, -0.1]], 0.026, 0.004), 0x3a3028, 0, 0.012, 0.0));
      g.muzzle = hp.grp(bone, 0, 0.03, -0.18); g.grip.set(0, -0.04, 0); g.fore.set(-0.02, -0.05, 0.01);
    }
    return g;
  }

  // ---------------------------------------------------------------- the person
  const shadeDown = (k) => (P, i) => 1 - Math.max(0, -P.getY(i)) * k; // a little darker lower down (sweat, dust)
  function build(look, seed) {
    const M = materials(), O = H.outfit(look, seed), L = O.L, rnd = O.rnd, { root, p } = H.skeleton(), K = new Kit();
    const bk = O.bulk, friendly = !!L.friendly, cloth = friendly ? 'camo' : 'fabric';
    const shirt = friendly ? 0xffffff : O.shirt, pants = friendly ? 0xf2f0ea : O.pants, skin = O.skin, hair = O.hair;
    const vest = O.vest, wrap = O.wrap, boot = friendly ? 0x7a6448 : rnd() < 0.5 ? 0x2a2420 : 0x4a3a2a, glove = friendly ? 0x5a4c38 : null;
    // ----- legs and boots
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? -1 : 1;
      K.add(p['leg' + s], cloth, put(lathe([[0.001, 0.03], [0.08, 0.02], [0.088, -0.06], [0.08, -0.24], [0.065, -0.4], [0.06, -0.47]], 14), pants, 0, 0, 0, 0, 0, 0, bk, 1, bk * 1.05, shadeDown(0.3)));
      K.add(p['knee' + s], cloth, put(lathe([[0.06, 0.03], [0.063, -0.06], [0.066, -0.13], [0.052, -0.3], [0.045, -0.4], [0.001, -0.41]], 14), pants, 0, 0, 0, 0, 0, 0, bk, 1, bk * 1.05, shadeDown(0.5)));
      if (friendly) K.add(p['knee' + s], 'gear', put(slab(0.1, 0.12, 0.04, 0.03), 0x5a4c38, 0, -0.03, -0.06));
      if (L.pow) K.add(p['knee' + s], cloth, put(cyl(0.05, 0.05, 0.02, 12), pants * 1, 0, -0.36, 0));
      const b = profile([[-0.07, -0.08], [0.13, -0.08], [0.17, -0.05], [0.16, -0.01], [0.06, 0.02], [0.03, 0.1], [-0.06, 0.1], [-0.08, 0.0]], 0.105, 0.02);
      K.add(p['foot' + s], 'gear', put(b, boot, 0, 0.02, 0.01));
      K.add(p['foot' + s], 'plain', put(box(0.108, 0.02, 0.26), 0x1c1a18, 0, -0.065, -0.035));
    }
    // ----- pelvis, belt
    K.add(p.hips, cloth, put(lathe([[0.001, 0.12], [0.12, 0.1], [0.155, 0.04], [0.16, -0.03], [0.135, -0.09], [0.001, -0.1]], 16), pants, 0, 0, 0, 0, 0, 0, bk, 1, 0.72 * bk));
    K.add(p.hips, 'gear', put(lathe([[0.158, 0.05], [0.162, 0.1]], 18), friendly ? 0x5a4c38 : 0x3a2c20, 0, 0, 0, 0, 0, 0, bk, 1, 0.74 * bk));
    K.add(p.hips, 'metal', put(box(0.05, 0.035, 0.012), 0x9a9480, 0, 0.075, -0.118 * bk));
    if (friendly || L.officer) K.add(p.hips, 'gear', put(slab(0.07, 0.16, 0.05, 0.015), friendly ? 0x5a4c38 : 0x2a2016, 0.17 * bk, -0.05, 0.0, 0, 0, 0.1)); // holster / dump pouch
    // ----- torso
    K.add(p.torso, cloth, put(lathe([[0.001, -0.02], [0.14, -0.01], [0.15, 0.08], [0.17, 0.2], [0.19, 0.31], [0.2, 0.4], [0.19, 0.45], [0.13, 0.49], [0.06, 0.505], [0.001, 0.51]], 18), shirt, 0, 0, 0, 0, 0, 0, bk, 1, 0.66 * bk, shadeDown(0)));
    K.add(p.torso, 'skin', put(lathe([[0.052, 0.47], [0.05, 0.52], [0.055, 0.57]], 12), skin));
    if (!friendly && !L.officer && rnd() < 0.5) K.add(p.torso, cloth, put(lathe([[0.058, 0.47], [0.075, 0.5], [0.06, 0.53]], 14), wrap)); // scarf
    if (friendly) {
      // plate carrier: front and back plates, cummerbund, shoulder straps, mag pouches, admin pouch, radio
      const pc = vest;
      K.add(p.torso, 'gear', put(slab(0.3 * bk, 0.34, 0.055, 0.04), pc, 0, 0.28, -0.13 * bk, -0.06));
      K.add(p.torso, 'gear', put(slab(0.3 * bk, 0.36, 0.05, 0.04), pc, 0, 0.3, 0.12 * bk, 0.05));
      K.add(p.torso, 'gear', put(lathe([[0.2, 0.13], [0.205, 0.27]], 20, true), pc, 0, 0, 0, 0, 0, 0, bk, 1, 0.68 * bk));
      for (const s of [-1, 1]) K.add(p.torso, 'gear', put(box(0.06, 0.03, 0.26), pc, s * 0.1 * bk, 0.46, 0, 0.1));
      for (let i = 0; i < 3; i++) K.add(p.torso, 'gear', put(slab(0.075, 0.11, 0.05, 0.012), pc * 1, (i - 1) * 0.085 * bk, 0.17, -0.17 * bk));
      K.add(p.torso, 'gear', put(slab(0.12, 0.08, 0.035, 0.012), pc, 0, 0.36, -0.165 * bk));
      K.add(p.torso, 'gear', put(slab(0.07, 0.12, 0.05, 0.012), 0x3a3a34, -0.19 * bk, 0.3, 0.04)); K.add(p.torso, 'metal', put(cyl(0.004, 0.004, 0.32, 5), 0x1a1a1a, -0.2 * bk, 0.52, 0.06, 0, 0, 0.12));
      K.add(p.torso, 'gear', put(slab(0.18, 0.2, 0.08, 0.03), 0x6a5a40, 0, 0.3, 0.19 * bk)); // assault pack
    } else if (vest) {
      // chest rig: a band of AK mag pouches, straps over the shoulders crossing at the back
      K.add(p.torso, 'gear', put(slab(0.32 * bk, 0.14, 0.05, 0.03), vest, 0, 0.18, -0.13 * bk));
      for (let i = 0; i < 4; i++) K.add(p.torso, 'gear', put(slab(0.065, 0.13, 0.045, 0.012), vest, (i - 1.5) * 0.07 * bk, 0.2, -0.16 * bk, -0.05));
      for (const s of [-1, 1]) { K.add(p.torso, 'gear', put(box(0.04, 0.02, 0.5), vest, s * 0.09, 0.35, 0.02, 0.9, s * 0.35, 0)); }
    }
    if (L.officer) {
      for (let i = 0; i < 5; i++) K.add(p.torso, 'metal', put(box(0.013, 0.013, 0.01), 0xd8b040, -0.02 - i * 0.022, 0.37, -0.128)); // ribbons and a star
      for (const s of [-1, 1]) K.add(p.torso, cloth, put(slab(0.1, 0.04, 0.015, 0.008), O.shirt, s * 0.14, 0.47, 0, 0, 0, s * 0.3)); // epaulettes
      K.add(p.torso, 'plain', put(box(0.34, 0.05, 0.25), 0x2a1c12, 0, 0.02, 0));
    }
    if (L.rockets) for (const s of [-1, 1]) K.add(p.torso, 'metal', put(lathe([[0.03, 0], [0.05, 0.12], [0.045, 0.22], [0.001, 0.32]], 10), 0x4a5038, s * 0.07, 0.3, 0.17));
    if (L.belt) for (let i = 0; i < 12; i++) K.add(p.torso, 'metal', put(box(0.016, 0.04, 0.016), 0xb08a30, -0.14 + i * 0.026, 0.1 + i * 0.03, -0.14 * bk, 0, 0, 0.9));
    // ----- arms and hands
    const sleeve = friendly || L.officer || rnd() < 0.5;
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? -1 : 1;
      K.add(p['arm' + s], cloth, put(sph(12, 8, 0, PI * 2, 0, PI * 0.5), shirt, 0, -0.02, 0, 0, 0, 0, 0.062 * bk, 0.05, 0.062 * bk)); // deltoid cap
      K.add(p['arm' + s], cloth, put(lathe([[0.06, 0.0], [0.058, -0.06], [0.052, -0.16], [0.046, -0.27], [0.044, -0.29]], 12), shirt, 0, 0, 0, 0, 0, 0, bk, 1, bk));
      if (friendly) K.add(p['arm' + s], 'gear', put(slab(0.05, 0.06, 0.012, 0.01), 0x6a6a5a, sx * 0.058, -0.08, 0, 0, sx * PI / 2)); // flag patch
      K.add(p['elbow' + s], sleeve ? cloth : 'skin', put(lathe([[0.046, 0.02], [0.05, -0.05], [0.043, -0.16], [0.034, -0.25]], 12), sleeve ? shirt : skin, 0, 0, 0, 0, 0, 0, bk, 1, bk));
      if (sleeve && !friendly && !L.officer) K.add(p['elbow' + s], cloth, put(lathe([[0.05, 0.0], [0.056, -0.03], [0.05, -0.06]], 12), shirt));  // rolled cuff
      if (sleeve && (friendly || L.officer)) K.add(p['elbow' + s], 'skin', put(lathe([[0.035, -0.22], [0.033, -0.27]], 10), skin));
      const hm = glove ? 'gear' : 'skin', hc = glove || skin, hand = p['hand' + s];
      K.add(hand, hm, put(slab(0.075, 0.085, 0.032, 0.014), hc, 0, -0.045, 0.0));
      for (let f = 0; f < 4; f++) K.add(hand, hm, put(caps(0.0105, 0.055), hc, -0.028 + f * 0.019, -0.09, -0.02, -1.1, 0, 0));
      K.add(hand, hm, put(caps(0.012, 0.04), hc, sx * -0.04, -0.035, -0.022, -0.5, 0, sx * 0.6));
    }
    // ----- head
    const hd = p.head, jaw = 0.9 + rnd() * 0.3;
    // beard and stubble are painted into the head's own vertex colours (a shell over the jaw read as a mask)
    const beardK = O.beard ? 0.3 : 0.82, hairC = new THREE.Color(hair).convertSRGBToLinear(), skinC = new THREE.Color(skin).convertSRGBToLinear();
    K.add(hd, 'skin', put(headGeo({ jaw }), skin, 0, 0.12, -0.005, 0, 0, 0, 0.094, 0.116, 0.104, (P, i) => {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), jawLine = y < 0.082 && z < 0.03, lip = y > 0.082 && y < 0.094 && Math.abs(x) < 0.04 && z < -0.08;
      if (!(jawLine || (O.beard && lip))) return 1;
      const n = 0.85 + ((Math.sin(x * 900) * Math.sin(y * 700) * 0.5 + 0.5) * 0.3);
      return O.beard ? (hairC.r / Math.max(0.01, skinC.r)) * 1.4 * n : beardK * n;
    }));
    for (const s of [-1, 1]) {
      K.add(hd, 'eye', put(eyeGeo(), 0xffffff, s * 0.032, 0.142, -0.088, 0, 0, 0, 1.15, 1.15, 1.15));
      K.add(hd, 'skin', put(sph(10, 6, 0, PI * 2, 0, PI * 0.45), skin, s * 0.032, 0.143, -0.088, -0.25, 0, 0, 0.0155, 0.0155, 0.0155)); // upper lid
      K.add(hd, 'plain', put(box(0.036, 0.009, 0.012), hair, s * 0.034, 0.165, -0.097, 0.2, 0, s * -0.14));
      K.add(hd, 'skin', put(earGeo(), skin, s * 0.094, 0.13, 0.005, 0, s * 0.3, 0));
    }
    const headwear = O.head;
    if (headwear === 'wrap') {
      K.add(hd, 'fabric', put(sph(18, 12, 0, PI * 2, 0, PI * 0.36), wrap, 0, 0.13, 0, 0, 0, 0, 0.108, 0.13, 0.118));
      K.add(hd, 'fabric', put(sph(18, 10, -PI * 0.3, PI * 1.6, PI * 0.36, PI * 0.36), wrap, 0, 0.13, 0, 0, 0, 0, 0.11, 0.13, 0.118));
      K.add(hd, 'fabric', put(lathe([[0.075, -0.05], [0.09, 0.0], [0.1, 0.06], [0.09, 0.09]], 16), wrap, 0, 0.0, 0.005, 0, 0, 0, 1, 1, 1.05));
      K.add(hd, 'fabric', put(slab(0.1, 0.22, 0.015, 0.02), wrap, 0.02, 0.02, 0.1, 0.25, 0, 0.1));
    } else if (headwear === 'helmet') {
      K.add(hd, 'camo', put(sph(20, 12, 0, PI * 2, 0, PI * 0.52), 0xffffff, 0, 0.14, 0.005, 0, 0, 0, 0.128, 0.13, 0.14));
      K.add(hd, 'gear', put(lathe([[0.128, 0.0], [0.134, 0.01], [0.13, 0.02]], 22), 0x5a5040, 0, 0.14, 0.005, 0, 0, 0, 1, 1, 1.09));
      K.add(hd, 'metal', put(box(0.05, 0.035, 0.02), 0x1c1c1c, 0, 0.225, -0.13));
      for (const s of [-1, 1]) K.add(hd, 'gear', put(box(0.01, 0.13, 0.015), 0x3a3428, s * 0.098, 0.1, 0.01));
      K.add(hd, 'eye', put(slab(0.15, 0.04, 0.03, 0.012), 0x2a2a28, 0, 0.23, -0.105, -0.3)); // goggles up on the helmet
    } else if (headwear === 'beret') {
      K.add(hd, 'fabric', put(sph(18, 10), wrap, 0.02, 0.215, 0.01, 0, 0, -0.22, 0.118, 0.042, 0.112));
      K.add(hd, 'fabric', put(lathe([[0.1, 0.0], [0.103, 0.018]], 18), 0x1a1a1a, 0, 0.18, 0.005, 0, 0, 0, 1, 1, 1.08));
      K.add(hd, 'metal', put(box(0.02, 0.025, 0.006), 0xc8a040, -0.045, 0.21, -0.1));
    } else if (headwear === 'peak') {
      K.add(hd, 'fabric', put(lathe([[0.098, 0.0], [0.1, 0.03], [0.12, 0.07], [0.118, 0.085], [0.001, 0.09]], 20), wrap, 0, 0.19, 0.0, 0, 0, 0, 1, 1, 1.06));
      K.add(hd, 'plain', put(sph(16, 6, PI, PI, PI * 0.45, PI * 0.1), 0x151515, 0, 0.2, -0.01, 0, 0, 0, 0.13, 0.2, 0.15));
      K.add(hd, 'metal', put(box(0.035, 0.03, 0.006), 0xd8b040, 0, 0.235, -0.112));
      K.add(hd, 'plain', put(box(0.11, 0.022, 0.012), 0x101010, 0, 0.145, -0.096)); // aviators
    } else if (headwear === 'cap') {
      K.add(hd, 'fabric', put(sph(16, 10, 0, PI * 2, 0, PI * 0.45), wrap, 0, 0.15, 0.005, 0, 0, 0, 0.106, 0.1, 0.116));
      K.add(hd, 'fabric', put(sph(16, 6, PI, PI, PI * 0.47, PI * 0.08), wrap, 0, 0.15, -0.01, 0, 0, 0, 0.14, 0.2, 0.17));
    } else K.add(hd, 'plain', put(sph(18, 12, 0, PI * 2, 0, PI * 0.5), hair, 0, 0.13, 0.006, 0, 0, 0, 0.1, 0.1, 0.11, () => 0.8 + Math.random() * 0.2)); // hair
    // ----- weapon
    const g = O.gun ? gun(O.gun, K, p.gun) : null;
    if (!g) p.gun.visible = false;
    K.bake(M, new Set([p.torso, p.hips, p.legL, p.legR, p.kneeL, p.kneeR, p.gun]));
    let torch = null;
    if (L.torch && g) torch = H.torch(p.gun);
    const m = H.finish(root, p, O, g, torch, true);
    // extra life: breathing, weight shift when standing, a glance around
    m.extra = (e, dt, speed) => {
      const t = CF.time + (e.seedPh || 0), still = speed < 0.3 ? 1 : 0;
      const br = Math.sin(t * 1.8) * 0.012;
      p.torso.scale.set(1 + br * 0.4, 1 + br * 0.5, 1 + br);
      p.hips.rotation.z = Math.sin(t * 0.35) * 0.035 * still;
      p.hips.position.x = Math.sin(t * 0.35) * 0.02 * still;
      if (e.alive !== false && still && !(e.aimK > 0.5)) p.head.rotation.z = Math.sin(t * 0.23) * 0.06;
    };
    return m;
  }
  H.hd = build;
  H.hdMaterials = materials;
})(window.CF);
