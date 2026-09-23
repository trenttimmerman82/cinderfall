'use strict';
/* Cinderfall — level builder: batched world geometry, materials, sky, lights, dynamic props. */
(function (CF) {
  const U = CF.U, W = CF.World;
  const L = CF.Level = {};

  // World-UV scale per material (1 texture repeat per 1/s metres)
  const UVS = { concrete: 0.25, concreteDark: 0.25, asphalt: 1 / 6, metalFloor: 0.5, wall: 0.25, wallRust: 0.25, hazard: 1, paintYellow: 0.33, paintGrey: 0.33, paintDark: 0.33, paintRed: 0.5, paintGreen: 0.33, steel: 0.5, rubber: 0.5, crate: 1 / 1.2 };
  const SURF = { metalFloor: 'metal', wall: 'metal', wallRust: 'metal', paintYellow: 'metal', paintGrey: 'metal', paintDark: 'metal', paintRed: 'metal', paintGreen: 'metal', steel: 'metal', hazard: 'metal', crate: 'metal' };
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
    this.relightT = 0; this.finished = false;
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
      const size = o.poolSize || lamp.distance * 0.75, k = o.poolStrength || 0.32, c = lamp.color;
      this.groundQuad(this.poolGeo, lamp.pos.x, gy + 0.02, lamp.pos.z, size, size, 0, [c.r * k, c.g * k, c.b * k]);
    }
    if (o.cone) this.addCone(lamp, o.cone);
  };
  L.addCone = function (lamp, radius) {
    const h = lamp.pos.y - (lamp.groundY || 0);
    const geo = new THREE.ConeGeometry(radius, h, 24, 1, true);
    geo.translate(0, -h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: lamp.color.clone().multiplyScalar(0.09) }, uOn: { value: 1 } },
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

  // ------------------------------------------------------------ sky + environment
  const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }';
  const SKY_FS = [
    'uniform vec3 uMoon; uniform float uTime; varying vec3 vDir;',
    'float h3(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }',
    'float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }',
    'void main(){',
    ' vec3 d = normalize(vDir); float h = d.y;',
    ' vec3 zen = vec3(0.003,0.005,0.012), hor = vec3(0.028,0.034,0.052);',
    ' vec3 col = mix(hor, zen, smoothstep(-0.02, 0.55, h));',
    ' vec2 hd = normalize(d.xz + 1e-5); float nb = max(0.0, -hd.y);',
    ' float glow = pow(nb, 3.0) * exp(-max(h,0.0)*7.0);',
    ' col += vec3(0.34,0.12,0.03) * glow * 0.55;',
    ' col += vec3(0.08,0.04,0.018) * exp(-abs(h)*16.0);',
    ' if (h > 0.0) {',
    '  vec3 sp = d*380.0; vec3 ip = floor(sp); float s = h3(ip);',
    '  float st = step(0.9975, s) * smoothstep(0.45, 0.0, length(fract(sp)-0.5));',
    '  col += vec3(0.75,0.8,1.0) * st * smoothstep(0.04, 0.35, h) * (0.55 + 0.45*sin(uTime*1.7 + s*80.0)) * 0.9;',
    '  vec2 uv = d.xz / (h + 0.12) * 0.55 + vec2(uTime*0.004, uTime*0.0017);',
    '  float c = fbm(uv*1.4); float cov = smoothstep(0.48, 0.82, c);',
    '  vec3 cc = mix(vec3(0.009,0.011,0.017), vec3(0.2,0.075,0.025), clamp(glow*2.2,0.0,1.0));',
    '  col = mix(col, cc, cov * smoothstep(0.0, 0.12, h) * 0.9);',
    ' }',
    ' float md = dot(d, uMoon);',
    ' col += vec3(0.85,0.9,1.0) * smoothstep(0.99935, 0.99962, md) * 2.2;',
    ' col += vec3(0.16,0.2,0.28) * pow(max(md,0.0), 400.0) + vec3(0.04,0.05,0.07) * pow(max(md,0.0), 18.0);',
    ' if (h < 0.0) col = mix(hor, vec3(0.012,0.013,0.02), smoothstep(0.0, -0.25, h));',
    ' gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');
  L.buildSky = function (moonDir) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMoon: { value: moonDir.clone().normalize() }, uTime: { value: 0 } },
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
    sky.renderOrder = -10; sky.frustumCulled = false;
    this.scene.add(sky); this.sky = sky;
  };

  L.buildEnv = function (renderer) {
    const env = new THREE.Scene();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ vec3 d = normalize(vD); float h = d.y; vec3 c = mix(vec3(0.05,0.035,0.03), vec3(0.012,0.016,0.03), smoothstep(-0.1,0.6,h)); c += vec3(0.25,0.1,0.03)*exp(-abs(h)*6.0)*0.6; if(h<0.0) c = mix(c, vec3(0.03,0.026,0.024), smoothstep(0.0,-0.3,h)); gl_FragColor = vec4(c,1.0); }'
    }));
    env.add(sphere);
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5, 2) });
    const coolMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 4, 5.5) });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, m = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 6), i % 3 === 0 ? coolMat : lampMat);
      m.position.set(Math.cos(a) * 40, 18 + (i % 2) * 8, Math.sin(a) * 40); m.lookAt(0, 0, 0); env.add(m);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.035);
    this.scene.environment = rt.texture;
    pm.dispose();
  };

  L.buildSkyline = function () {
    const rnd = U.mulberry32(77);
    const box = this.geo('box'), cyl = this.geo('cylLo');
    const sil = { pos: [], nrm: [], uv: [], col: [], idx: [] }, win = { pos: [], nrm: [], uv: [], col: [], idx: [] };
    const self = this, beacons = [];
    const push = (target, geo, m) => { const save = self.batches; self.batches = { t: target }; self.addGeo('t', geo, m); self.batches = save; };
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = 140 + rnd() * 160;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 110 && Math.abs(z) < 100) continue;
      const w = 10 + rnd() * 30, d = 10 + rnd() * 30, h = 12 + rnd() * rnd() * 70;
      const tower = rnd() < 0.3;
      if (tower) push(sil, cyl, this.mat4(x, h * 0.9, z, 0, 0, 0, 3 + rnd() * 4, h * 1.8, 3 + rnd() * 4));
      else push(sil, box, this.mat4(x, h / 2, z, 0, rnd() * Math.PI, 0, w, h, d));
      const top = tower ? h * 1.8 : h;
      if (rnd() < 0.55) beacons.push([x, top + 1, z]);
      const nw = tower ? 0 : Math.floor(rnd() * 14);
      for (let k = 0; k < nw; k++) push(win, box, this.mat4(x + (rnd() - 0.5) * w * 0.8, rnd() * h * 0.9 + 2, z + (rnd() - 0.5) * d * 0.8, 0, 0, 0, 0.8 + rnd() * 1.6, 0.5, 0.8 + rnd() * 1.6));
    }
    // flare stacks beyond the north wall
    const stacks = [[-34, -92], [14, -104], [52, -86], [-90, -40], [96, 20]];
    for (const s of stacks) { push(sil, cyl, this.mat4(s[0], 26, s[1], 0, 0, 0, 1.6, 52, 1.6)); beacons.push([s[0], 45, s[1]]); }
    this.flareStacks = stacks.map((s) => new THREE.Vector3(s[0], 53, s[1]));
    const mk = (t, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3)); g.setIndex(t.idx); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; this.scene.add(m); return m; };
    mk(sil, this.mats.skyline); mk(win, this.mats.skylineWin);
    const bg = { pos: [], nrm: [], uv: [], col: [], idx: [] };
    for (const b of beacons) push(bg, this.geo('sphere'), this.mat4(b[0], b[1], b[2], 0, 0, 0, 0.9, 0.9, 0.9));
    const bm = mk(bg, this.mats.skylineRed);
    this.animated.push((dt, t) => { const on = (t % 2.2) < 0.25; bm.visible = on; });
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
    this.updateDoors(dt);
    if (this.sky) { this.sky.position.copy(cam); this.sky.material.uniforms.uTime.value = t; }
    const mo = this.mats.molten.map;
    if (mo) { mo.offset.x = t * 0.018; mo.offset.y = Math.sin(t * 0.2) * 0.05; }
    for (let i = 0; i < this.animated.length; i++) this.animated[i](dt, t);
  };
})(window.CF);
