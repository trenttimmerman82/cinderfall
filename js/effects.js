'use strict';
/* Cinderfall — visual effects: particles, tracers, decals, debris, casings, flash lights, gibs. */
(function (CF) {
  const U = CF.U, W = CF.World;
  const FX = CF.FX = { ready: false };

  const P_VS = [
    'attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aRot;',
    'uniform float uScale; uniform float uFogD;',
    'varying vec3 vColor; varying float vAlpha; varying float vRot; varying float vFog;',
    'void main(){',
    ' vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    ' float z = max(0.05, -mv.z);',
    ' gl_PointSize = aSize * uScale / z;',
    ' gl_Position = projectionMatrix * mv;',
    ' vColor = aColor; vAlpha = aAlpha; vRot = aRot;',
    ' float fd = uFogD * z; vFog = exp(-fd * fd);',
    '}'
  ].join('\n');
  const P_FS = [
    'uniform sampler2D uMap; uniform vec3 uFogC; uniform float uAdd;',
    'varying vec3 vColor; varying float vAlpha; varying float vRot; varying float vFog;',
    'void main(){',
    ' vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot);',
    ' vec2 uv = vec2(c*p.x - s*p.y, s*p.x + c*p.y) + 0.5;',
    ' vec4 t = texture2D(uMap, uv);',
    ' if (uAdd > 0.5) { gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha * vFog); }',
    ' else { gl_FragColor = vec4(mix(uFogC, vColor * t.rgb, vFog), t.a * vAlpha); }',
    '}'
  ].join('\n');

  class PSys {
    constructor(n, tex, additive) {
      this.n = n; this.next = 0;
      this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.alpha = new Float32Array(n);
      this.size = new Float32Array(n); this.rot = new Float32Array(n);
      this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
      this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n);
      this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.rv = new Float32Array(n); this.mode = new Uint8Array(n);
      const g = new THREE.BufferGeometry();
      const attr = (arr, k) => { const a = new THREE.BufferAttribute(arr, k); a.setUsage(THREE.DynamicDrawUsage); return a; };
      this.aPos = attr(this.pos, 3); this.aCol = attr(this.col, 3); this.aAlpha = attr(this.alpha, 1); this.aSize = attr(this.size, 1); this.aRot = attr(this.rot, 1);
      g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol); g.setAttribute('aAlpha', this.aAlpha); g.setAttribute('aSize', this.aSize); g.setAttribute('aRot', this.aRot);
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: tex }, uScale: { value: 800 }, uFogD: { value: 0.014 }, uFogC: { value: new THREE.Color(0.02, 0.026, 0.04) }, uAdd: { value: additive ? 1 : 0 } },
        vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
      this.points.renderOrder = additive ? 20 : 15;
    }
    spawn(x, y, z, vx, vy, vz, life, s0, s1, r, gc, b, a, grav, drag, mode, rv) {
      const i = this.next; this.next = (i + 1) % this.n;
      const i3 = i * 3;
      this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
      this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
      this.col[i3] = r; this.col[i3 + 1] = gc; this.col[i3 + 2] = b;
      this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
      this.grav[i] = grav || 0; this.drag[i] = drag || 0; this.mode[i] = mode || 0;
      this.rot[i] = Math.random() * 6.283; this.rv[i] = rv || 0; this.size[i] = s0; this.alpha[i] = a;
      return i;
    }
    update(dt) {
      const n = this.n, P = this.pos, V = this.vel;
      for (let i = 0; i < n; i++) {
        if (this.life[i] <= 0) { if (this.size[i] !== 0) { this.size[i] = 0; this.alpha[i] = 0; } continue; }
        this.life[i] -= dt;
        const t = 1 - Math.max(0, this.life[i]) / this.max[i], i3 = i * 3;
        V[i3 + 1] -= this.grav[i] * dt;
        const dr = 1 - this.drag[i] * dt;
        V[i3] *= dr; V[i3 + 1] *= dr; V[i3 + 2] *= dr;
        P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
        this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
        const m = this.mode[i];
        let a;
        if (m === 1) a = Math.min(1, t * 8) * Math.pow(1 - t, 1.4);
        else if (m === 2) a = Math.min(1, t * 5) * (1 - t) * (0.55 + 0.45 * Math.sin(this.rot[i] * 7 + this.life[i] * 11));
        else a = 1 - t;
        this.alpha[i] = this.a0[i] * a;
        this.rot[i] += this.rv[i] * dt;
      }
      this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aAlpha.needsUpdate = true; this.aSize.needsUpdate = true; this.aRot.needsUpdate = true;
    }
  }

  FX.init = function (scene, camera) {
    const T = CF.Tex.list;
    this.scene = scene; this.camera = camera;
    const q = CF.bootQuality;
    this.add = new PSys(q === 'low' ? 1400 : 2600, T.soft, true);
    this.smoke = new PSys(q === 'low' ? 500 : 900, T.smoke, false);
    this.flash = new PSys(160, T.flash, true);
    scene.add(this.smoke.points); scene.add(this.add.points); scene.add(this.flash.points);
    this.systems = [this.add, this.smoke, this.flash];
    this.initTracers(T.beam);
    this.holes = this.makeDecals(260, T.bulletHole, true);
    this.scorches = this.makeDecals(36, T.scorch, true);
    this.oils = this.makeDecals(48, T.oil, true);
    this.initDebris(); this.initShells();
    this.lights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffaa55, 0, 12, 2); scene.add(l); this.lights.push({ light: l, t: 0, dur: 1, i0: 0 }); }
    this.lightNext = 0;
    this.gibs = []; this.rings = []; this.markers = []; this.beams3d = [];
    this.emberT = 0; this.emitAcc = {};
    this.ready = true;
  };

  FX.resize = function (heightPx, fovDeg) {
    const s = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    for (const sys of this.systems) sys.mat.uniforms.uScale.value = s;
  };
  FX.setFog = function (density, color) {
    for (const sys of this.systems) { sys.mat.uniforms.uFogD.value = density; sys.mat.uniforms.uFogC.value.copy(color); }
  };

  // ------------------------------------------------------------ tracers / beams
  FX.initTracers = function (tex) {
    const N = this.trN = 96;
    this.tr = [];
    for (let i = 0; i < N; i++) this.tr.push({ life: 0, max: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), r: 1, g: 1, bl: 1, w: 0.04, speed: 0, len: 0 });
    const g = new THREE.BufferGeometry();
    this.trPos = new Float32Array(N * 4 * 3); this.trCol = new Float32Array(N * 4 * 3);
    const uv = new Float32Array(N * 4 * 2), idx = [];
    for (let i = 0; i < N; i++) {
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    this.trPosA = new THREE.BufferAttribute(this.trPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.trColA = new THREE.BufferAttribute(this.trCol, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.trPosA); g.setAttribute('color', this.trColA); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.trMesh = new THREE.Mesh(g, m); this.trMesh.frustumCulled = false; this.trMesh.renderOrder = 22;
    this.scene.add(this.trMesh); this.trNext = 0;
  };
  /** Moving tracer streak from a→b. speed 0 = static beam for its lifetime. */
  FX.tracer = function (a, b, o) {
    o = o || {};
    const t = this.tr[this.trNext]; this.trNext = (this.trNext + 1) % this.trN;
    t.a.copy(a); t.b.copy(b); t.speed = o.speed || 0; t.len = o.len || 5;
    t.max = t.life = o.life || (t.speed ? t.a.distanceTo(t.b) / t.speed + 0.02 : 0.08);
    t.r = o.r != null ? o.r : 3; t.g = o.g != null ? o.g : 2.2; t.bl = o.b != null ? o.b : 1.2; t.w = o.w || 0.035; t.t = 0;
    return t;
  };
  const _d = new THREE.Vector3(), _side = new THREE.Vector3(), _mid = new THREE.Vector3(), _h = new THREE.Vector3(), _tl = new THREE.Vector3();
  FX.updateTracers = function (dt) {
    const cam = this.camera.position, P = this.trPos, C = this.trCol;
    for (let i = 0; i < this.trN; i++) {
      const t = this.tr[i], o = i * 12;
      if (t.life <= 0) { for (let k = 0; k < 12; k++) P[o + k] = 0; continue; }
      _d.subVectors(t.b, t.a); const dist = _d.length(); _d.divideScalar(dist || 1);
      let fade = t.life / t.max;
      if (t.speed) {
        const head = Math.min(dist, t.speed * t.t);
        _h.copy(t.a).addScaledVector(_d, head); _tl.copy(t.a).addScaledVector(_d, Math.max(0, head - t.len));
        fade = head >= dist ? Math.max(0, 1 - (t.t - dist / t.speed) * 30) : 1;
      } else { _h.copy(t.b); _tl.copy(t.a); }
      _mid.addVectors(_h, _tl).multiplyScalar(0.5).sub(cam);
      _side.crossVectors(_d, _mid).normalize().multiplyScalar(t.w * (t.speed ? 1 : (0.6 + 0.4 * fade)));
      P[o] = _tl.x - _side.x; P[o + 1] = _tl.y - _side.y; P[o + 2] = _tl.z - _side.z;
      P[o + 3] = _tl.x + _side.x; P[o + 4] = _tl.y + _side.y; P[o + 5] = _tl.z + _side.z;
      P[o + 6] = _h.x + _side.x; P[o + 7] = _h.y + _side.y; P[o + 8] = _h.z + _side.z;
      P[o + 9] = _h.x - _side.x; P[o + 10] = _h.y - _side.y; P[o + 11] = _h.z - _side.z;
      const tail = t.speed ? 0.05 : 1;
      for (let k = 0; k < 4; k++) {
        const f = (k < 2 ? tail : 1) * fade;
        C[o + k * 3] = t.r * f; C[o + k * 3 + 1] = t.g * f; C[o + k * 3 + 2] = t.bl * f;
      }
      t.t += dt; t.life -= dt;
    }
    this.trPosA.needsUpdate = true; this.trColA.needsUpdate = true;
  };

  // ------------------------------------------------------------ decals
  FX.makeDecals = function (n, tex, lit) {
    const mat = lit ? new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
      : new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, zero);
    mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.receiveShadow = true;
    this.scene.add(mesh);
    return { mesh, n, next: 0 };
  };
  const _z = new THREE.Vector3(0, 0, 1), _qd = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _pd = new THREE.Vector3(), _sd = new THREE.Vector3(), _md = new THREE.Matrix4();
  FX.decal = function (set, x, y, z, nx, ny, nz, size) {
    _pd.set(nx, ny, nz);
    _qd.setFromUnitVectors(_z, _pd);
    _qr.setFromAxisAngle(_z, Math.random() * 6.283);
    _qd.multiply(_qr);
    _sd.set(size, size, size);
    _pd.set(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012);
    _md.compose(_pd, _qd, _sd);
    set.mesh.setMatrixAt(set.next, _md); set.next = (set.next + 1) % set.n;
    set.mesh.instanceMatrix.needsUpdate = true;
  };
  FX.clearDecals = function () {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const s of [this.holes, this.scorches, this.oils]) { for (let i = 0; i < s.n; i++) s.mesh.setMatrixAt(i, zero); s.mesh.instanceMatrix.needsUpdate = true; }
  };

  // ------------------------------------------------------------ debris chips + shell casings (instanced physics)
  FX.initDebris = function () {
    const n = 140;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x45474b, roughness: 0.9 }), n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = false;
    this.scene.add(mesh);
    this.deb = { mesh, n, next: 0, items: [] };
    for (let i = 0; i < n; i++) this.deb.items.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3(), s: 0.05, floor: 0 });
    const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, zero);
  };
  FX.initShells = function () {
    const n = 60;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 8); geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.95, roughness: 0.3 }), n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.sh = { mesh, n, next: 0, items: [] };
    for (let i = 0; i < n; i++) this.sh.items.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3(), s: new THREE.Vector3(), floor: 0, bounces: 0 });
    const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, zero);
  };
  FX.debris = function (x, y, z, nx, ny, nz, count, speed, size, color) {
    for (let k = 0; k < count; k++) {
      const d = this.deb.items[this.deb.next]; this.deb.next = (this.deb.next + 1) % this.deb.n;
      d.life = U.rand(1.5, 3); d.p.set(x, y, z);
      d.v.set(nx * speed + U.rand(-1, 1) * speed * 0.6, ny * speed + U.rand(0.3, 1.2) * speed * 0.7, nz * speed + U.rand(-1, 1) * speed * 0.6);
      d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); d.rv.set(U.rand(-15, 15), U.rand(-15, 15), U.rand(-15, 15));
      d.s = size * U.rand(0.6, 1.4); d.floor = W.groundHeight(x, y + 0.1, z);
    }
  };
  FX.shell = function (pos, vel, size) {
    const d = this.sh.items[this.sh.next]; this.sh.next = (this.sh.next + 1) % this.sh.n;
    d.life = 3; d.p.copy(pos); d.v.copy(vel); d.bounces = 0;
    d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); d.rv.set(U.rand(-25, 25), U.rand(-25, 25), U.rand(-25, 25));
    const s = size || 1; d.s.set(0.022 * s, 0.0065 * s, 0.0065 * s);
    d.floor = W.groundHeight(pos.x, pos.y, pos.z);
  };
  const _mm = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _ss = new THREE.Vector3();
  function stepBits(set, dt, isShell) {
    const zero = _mm.makeScale(0, 0, 0).clone();
    let any = false;
    for (let i = 0; i < set.n; i++) {
      const d = set.items[i];
      if (d.life <= 0) continue;
      any = true;
      d.life -= dt;
      if (d.life <= 0) { set.mesh.setMatrixAt(i, zero); continue; }
      d.v.y -= 14 * dt;
      d.p.addScaledVector(d.v, dt);
      d.r.x += d.rv.x * dt; d.r.y += d.rv.y * dt; d.r.z += d.rv.z * dt;
      const rest = isShell ? d.s.y : d.s * 0.5;
      if (d.p.y < d.floor + rest) {
        d.p.y = d.floor + rest;
        if (d.v.y < -1.2) {
          d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.rv.multiplyScalar(0.5);
          if (isShell && d.bounces++ < 2) CF.Audio.play('shell', d.p, { ref: 2 });
        } else { d.v.set(0, 0, 0); d.rv.multiplyScalar(0.8); }
      }
      _qq.setFromEuler(d.r);
      if (isShell) _ss.copy(d.s); else { const k = Math.min(1, d.life * 2) * d.s; _ss.set(k, k, k); }
      _mm.compose(d.p, _qq, _ss);
      set.mesh.setMatrixAt(i, _mm);
    }
    if (any) set.mesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ flash lights
  FX.flashLight = function (pos, color, intensity, distance, dur) {
    const s = this.lights[this.lightNext]; this.lightNext = (this.lightNext + 1) % this.lights.length;
    s.light.position.copy(pos); s.light.color.set(color); s.light.distance = distance; s.i0 = intensity; s.t = 0; s.dur = dur;
    s.light.intensity = intensity;
  };

  // ------------------------------------------------------------ composite effects
  FX.sparks = function (x, y, z, nx, ny, nz, count, speed, hot) {
    for (let k = 0; k < count; k++) {
      const s = speed * U.rand(0.35, 1.2);
      const vx = nx * s + U.gauss() * s * 0.7, vy = ny * s + U.gauss() * s * 0.7 + s * 0.2, vz = nz * s + U.gauss() * s * 0.7;
      const warm = hot ? 1 : U.rand(0.8, 1);
      this.add.spawn(x, y, z, vx, vy, vz, U.rand(0.18, 0.45), 0.06, 0.02, 4 * warm, 2.2 * warm, 0.7, 1, 11, 1.5, 0);
    }
  };
  FX.glow = function (x, y, z, size, r, g, b, life) { this.add.spawn(x, y, z, 0, 0, 0, life || 0.07, size, size * 1.3, r, g, b, 1, 0, 0, 0); };

  FX.impact = function (h, dir, surf) {
    const x = h.x, y = h.y, z = h.z, nx = h.nx, ny = h.ny, nz = h.nz;
    if (!h.box || !h.box.owner) this.decal(this.holes, x, y, z, nx, ny, nz, U.rand(0.1, 0.16));
    if (surf === 'metal') {
      this.sparks(x, y, z, nx, ny, nz, U.randInt(5, 9), 6);
      this.glow(x, y, z, 0.45, 3, 2, 1, 0.05);
      this.smoke.spawn(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, nx * 0.4, 0.3 + ny * 0.4, nz * 0.4, 0.6, 0.12, 0.5, 0.35, 0.34, 0.33, 0.5, -0.2, 1.2, 1);
      CF.Audio.play('impactMetal', h, { ref: 3 });
    } else {
      for (let k = 0; k < 3; k++) this.smoke.spawn(x + nx * 0.06, y + ny * 0.06, z + nz * 0.06, nx * U.rand(0.5, 1.6) + U.gauss() * 0.4, ny * U.rand(0.5, 1.6) + U.rand(0.1, 0.6), nz * U.rand(0.5, 1.6) + U.gauss() * 0.4,
        U.rand(0.7, 1.2), 0.18, U.rand(0.7, 1.1), 0.46, 0.43, 0.39, 0.55, -0.15, 2.2, 1);
      this.debris(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, nx, ny, nz, 3, 3.5, 0.04);
      this.sparks(x, y, z, nx, ny, nz, 2, 4);
      CF.Audio.play('impactConcrete', h, { ref: 3 });
    }
  };
  FX.botHit = function (pos, n, weak) {
    this.sparks(pos.x, pos.y, pos.z, n.x, n.y, n.z, weak ? 12 : 7, 5, true);
    this.glow(pos.x, pos.y, pos.z, weak ? 0.8 : 0.4, 3, 2.2, 1.4, 0.05);
    for (let k = 0; k < 2; k++) this.smoke.spawn(pos.x, pos.y, pos.z, n.x * 1.5 + U.gauss(), n.y * 1.5 + 1, n.z * 1.5 + U.gauss(), 0.6, 0.04, 0.12, 0.02, 0.02, 0.02, 0.9, 9, 0.5, 0);
    if (Math.random() < 0.3) this.add.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 0.06, 0.6, 0.3, 1.5, 2.6, 5, 1, 0, 0, 0);
  };
  FX.muzzle = function (pos, dir, r, g, b, size) {
    this.flash.spawn(pos.x + dir.x * 0.1, pos.y + dir.y * 0.1, pos.z + dir.z * 0.1, 0, 0, 0, 0.05, size || 0.7, (size || 0.7) * 0.8, r, g, b, 1, 0, 0, 0);
    this.glow(pos.x, pos.y, pos.z, (size || 0.7) * 1.6, r * 0.3, g * 0.3, b * 0.3, 0.06);
  };
  FX.explosion = function (pos, scale) {
    const s = scale || 1, x = pos.x, y = pos.y, z = pos.z;
    this.flashLight(pos, 0xff9a40, 14 * s, 22 * s, 0.45);
    this.flash.spawn(x, y, z, 0, 0, 0, 0.12, 3.2 * s, 5 * s, 4, 3, 2, 1, 0, 0, 0);
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * 6.283, e = U.rand(-0.2, 1), sp = U.rand(2, 7) * s;
      this.add.spawn(x, y + 0.2, z, Math.cos(a) * sp * Math.cos(e), Math.abs(Math.sin(e)) * sp + 1, Math.sin(a) * sp * Math.cos(e), U.rand(0.35, 0.7), 1.1 * s, U.rand(2.5, 4) * s, 4, U.rand(1.4, 2.2), 0.4, 1, -1.5, 3.5, 0);
    }
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * 6.283, sp = U.rand(0.8, 3.2) * s;
      this.smoke.spawn(x + U.gauss() * s, y + U.rand(0, 1.2) * s, z + U.gauss() * s, Math.cos(a) * sp, U.rand(0.8, 2.6), Math.sin(a) * sp, U.rand(2.0, 3.6), 1.4 * s, U.rand(4.5, 7) * s, 0.13, 0.115, 0.1, 0.85, -0.25, 0.9, 1);
    }
    this.sparks(x, y + 0.3, z, 0, 1, 0, 34, 13 * s);
    this.debris(x, y + 0.3, z, 0, 1, 0, 8, 5.5 * s, 0.08);
    const gy = W.groundHeight(x, y + 0.5, z);
    if (y - gy < 2.2) this.decal(this.scorches, x, gy, z, 0, 1, 0, U.rand(3.2, 4.4) * s);
    this.ring(new THREE.Vector3(x, gy + 0.08, z), 7 * s, 0.5, [2.2, 1.3, 0.6]);
    CF.Audio.play('explosion', pos, { ref: 9 });
  };
  FX.botExplode = function (pos, s) {
    s = s || 1;
    this.flashLight(pos, 0xffb070, 8 * s, 14 * s, 0.35);
    this.flash.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 0.1, 2.2 * s, 3.4 * s, 4, 2.8, 1.8, 1, 0, 0, 0);
    this.sparks(pos.x, pos.y, pos.z, 0, 1, 0, 26, 9 * s, true);
    for (let k = 0; k < 10; k++) this.smoke.spawn(pos.x + U.gauss() * 0.4, pos.y + U.rand(0, 0.8), pos.z + U.gauss() * 0.4, U.gauss() * 1.4, U.rand(0.6, 2), U.gauss() * 1.4, U.rand(1.4, 2.6), 0.8 * s, 3.2 * s, 0.06, 0.055, 0.05, 0.8, -0.2, 1, 1);
    for (let k = 0; k < 6; k++) this.add.spawn(pos.x, pos.y, pos.z, U.gauss() * 3, U.rand(1, 4), U.gauss() * 3, U.rand(0.3, 0.5), 0.6 * s, 1.8 * s, 4, 1.8, 0.4, 1, -1, 3, 0);
    const gy = W.groundHeight(pos.x, pos.y + 0.5, pos.z);
    this.decal(this.oils, pos.x + U.gauss() * 0.5, gy, pos.z + U.gauss() * 0.5, 0, 1, 0, U.rand(1.2, 2.0) * s);
    CF.Audio.play('botDeath', pos, { ref: 6 });
  };
  FX.ring = function (pos, radius, life, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: CF.Tex.list.ring, color: new THREE.Color(color[0], color[1], color[2]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.scale.setScalar(0.1); m.renderOrder = 21;
    this.scene.add(m);
    this.rings.push({ m, t: 0, life, radius });
  };
  FX.spawnBeam = function (pos, h) {
    h = h || 3;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    m.position.set(pos.x, pos.y + 15, pos.z); m.renderOrder = 21; this.scene.add(m);
    this.rings.push({ m, t: 0, life: 1.0, beam: true });
    this.ring(new THREE.Vector3(pos.x, pos.y + 0.06, pos.z), 3, 0.8, [2.5, 0.4, 0.2]);
    for (let k = 0; k < 24; k++) this.add.spawn(pos.x + U.gauss() * 0.6, pos.y + U.rand(0, h), pos.z + U.gauss() * 0.6, 0, U.rand(1, 4), 0, U.rand(0.4, 0.9), 0.12, 0.02, 4, 0.8, 0.4, 1, 0, 0, 0);
    this.flashLight(new THREE.Vector3(pos.x, pos.y + 1.5, pos.z), 0xff4020, 5, 10, 0.8);
    CF.Audio.play('spawn', pos, { ref: 6 });
  };
  /** Pulsing ground marker (telegraphs). Returns a handle; call FX.removeMarker(h). */
  FX.marker = function (pos, radius, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: CF.Tex.list.marker, color: new THREE.Color(color[0], color[1], color[2]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.06; m.scale.setScalar(radius); m.renderOrder = 21;
    this.scene.add(m); const h = { m, t: 0 }; this.markers.push(h); return h;
  };
  FX.removeMarker = function (h) { if (!h) return; this.scene.remove(h.m); h.m.geometry.dispose(); h.m.material.dispose(); const i = this.markers.indexOf(h); if (i >= 0) this.markers.splice(i, 1); };

  // ------------------------------------------------------------ gibs (detached robot parts)
  const _wp = new THREE.Vector3();
  FX.gib = function (obj, vel, spin) {
    this.scene.attach(obj);
    obj.getWorldPosition(_wp);
    const g = { o: obj, v: vel.clone(), w: new THREE.Vector3(U.gauss() * spin, U.gauss() * spin, U.gauss() * spin), life: U.rand(6, 9), floor: W.groundHeight(_wp.x, _wp.y + 0.3, _wp.z), fT: 0, smoke: Math.random() < 0.5 ? U.rand(1, 3) : 0 };
    this.gibs.push(g);
    if (this.gibs.length > 90) { const old = this.gibs.shift(); this.scene.remove(old.o); }
  };
  FX.clearGibs = function () { for (const g of this.gibs) this.scene.remove(g.o); this.gibs.length = 0; };

  // ------------------------------------------------------------ ambient + emitters
  FX.ambient = function (dt, cam) {
    const q = CF.bootQuality === 'low' ? 0.5 : 1;
    this.emberT += dt * 55 * q * (this.emberRate == null ? 1 : this.emberRate);
    while (this.emberT > 1) {
      this.emberT -= 1;
      const x = cam.x + U.rand(-24, 24), z = cam.z + U.rand(-24, 24), y = U.rand(0, 13);
      const hot = Math.random();
      this.add.spawn(x, y, z, U.rand(0.3, 1.2), U.rand(0.1, 0.8), U.rand(-0.4, 0.4), U.rand(3, 6), U.rand(0.05, 0.1), 0.02, 3.2, 1.2 + hot * 0.6, 0.25, 1, -0.05, 0.1, 2, U.rand(-1, 1));
    }
    const L = CF.Level;
    for (let i = 0; i < L.emitters.length; i++) {
      const e = L.emitters[i];
      const dx = e.x - cam.x, dz = e.z - cam.z;
      if (dx * dx + dz * dz > 70 * 70) continue;
      const k = 'e' + i; this.emitAcc[k] = (this.emitAcc[k] || 0) + dt * e.rate * q;
      while (this.emitAcc[k] > 1) {
        this.emitAcc[k] -= 1;
        if (e.type === 'pour') {
          this.add.spawn(e.x, e.y, e.z, U.gauss() * 2.5, U.rand(1.5, 5), U.gauss() * 2.5, U.rand(0.4, 0.9), 0.07, 0.02, 4, 1.8, 0.4, 1, 10, 0.5, 0);
          if (Math.random() < 0.3) this.smoke.spawn(e.x, e.y + 0.3, e.z, U.gauss() * 0.3, U.rand(1, 2), U.gauss() * 0.3, 2.5, 0.8, 3, 0.18, 0.1, 0.06, 0.35, -0.1, 0.4, 1);
        } else if (e.type === 'smoke') {
          this.smoke.spawn(e.x, e.y, e.z, U.rand(0.2, 0.6), U.rand(1.2, 2), U.gauss() * 0.2, U.rand(3, 5), 0.5, 3.2, 0.1, 0.1, 0.11, 0.5, -0.1, 0.3, 1);
        } else if (e.type === 'embers') {
          this.add.spawn(e.x + U.gauss(), e.y, e.z + U.gauss(), U.gauss() * 0.3, U.rand(1, 2.5), U.gauss() * 0.3, U.rand(1.5, 3), 0.08, 0.02, 4, 1.5, 0.3, 1, -0.2, 0.2, 2, 0);
        }
      }
    }
    // flare stack flames on the skyline
    if (L.flareStacks) {
      this.flareT = (this.flareT || 0) + dt * 14 * q;
      while (this.flareT > 1) {
        this.flareT -= 1;
        const s = L.flareStacks[Math.floor(Math.random() * L.flareStacks.length)];
        this.flash.spawn(s.x + U.gauss() * 0.4, s.y + U.rand(0, 1.5), s.z + U.gauss() * 0.4, U.gauss() * 0.4, U.rand(2, 4), U.gauss() * 0.4, U.rand(0.4, 0.8), 3.5, 1.5, 4, 1.8, 0.5, 1, 0, 0, 0);
      }
    }
  };

  // ------------------------------------------------------------ per-frame
  FX.update = function (dt, cam) {
    if (!this.ready) return;
    this.ambient(dt, cam);
    for (const s of this.systems) s.update(dt);
    this.updateTracers(dt);
    stepBits(this.deb, dt, false);
    stepBits(this.sh, dt, true);
    for (const s of this.lights) {
      if (s.t >= s.dur) { if (s.light.intensity !== 0) s.light.intensity = 0; continue; }
      s.t += dt; const k = 1 - Math.min(1, s.t / s.dur); s.light.intensity = s.i0 * k * k;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); continue; }
      if (r.beam) { r.m.scale.set(1 - k * 0.8, 1, 1 - k * 0.8); r.m.material.opacity = 0.8 * (1 - k); }
      else { r.m.scale.setScalar(0.1 + r.radius * U.easeOutCubic(k)); r.m.material.opacity = 1 - k; }
    }
    for (const mk of this.markers) { mk.t += dt; mk.m.material.opacity = 0.55 + 0.45 * Math.sin(mk.t * 14); }
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i], o = g.o;
      g.life -= dt;
      if (g.life <= 0) { this.scene.remove(o); this.gibs.splice(i, 1); continue; }
      if (g.life < 1) { o.position.y -= dt * 0.4; continue; }
      g.v.y -= 16 * dt;
      o.position.addScaledVector(g.v, dt);
      o.rotation.x += g.w.x * dt; o.rotation.y += g.w.y * dt; o.rotation.z += g.w.z * dt;
      if (o.position.y < g.floor + 0.12) {
        o.position.y = g.floor + 0.12;
        if (g.v.y < -1.5) { g.v.y *= -0.3; g.v.x *= 0.55; g.v.z *= 0.55; g.w.multiplyScalar(0.5); }
        else { g.v.set(0, 0, 0); g.w.multiplyScalar(0.9); }
      }
      if (g.smoke > 0) { g.smoke -= dt; if (Math.random() < dt * 14) this.smoke.spawn(o.position.x, o.position.y, o.position.z, 0, 0.8, 0, 1.2, 0.2, 0.9, 0.05, 0.05, 0.05, 0.6, -0.3, 0.5, 1); }
    }
  };

  FX.reset = function () {
    for (const s of this.systems) { s.life.fill(0); }
    for (const t of this.tr) t.life = 0;
    this.clearGibs();
    for (const r of this.rings) this.scene.remove(r.m); this.rings.length = 0;
    for (const m of this.markers.slice()) this.removeMarker(m);
    for (const d of this.deb.items) d.life = 0.0001;
    for (const d of this.sh.items) d.life = 0.0001;
  };
})(window.CF);
