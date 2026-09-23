'use strict';
/* Cinderfall — neon city kit: neon signs, holographic ads, lit facades, rain, air traffic. */
(function (CF) {
  const U = CF.U;
  const N = CF.Neon = { cache: {} };
  // HDR colours for unlit (MeshBasic) neon, and matching light colours
  N.C = {
    cyan: [0.35, 3.1, 4.2], magenta: [4.4, 0.45, 3.3], violet: [2.1, 0.8, 5.2], yellow: [4.6, 3.8, 0.45],
    red: [5.6, 0.4, 0.8], green: [0.6, 4.4, 1.9], white: [3.3, 3.5, 4.0], orange: [5.0, 1.9, 0.35], pink: [5.0, 1.2, 2.6],
    sodium: [4.8, 2.7, 1.1], led: [3.4, 3.6, 3.9]
  };
  N.HEX = { cyan: 0x36e7ff, magenta: 0xff3cc8, violet: 0x9d5cff, yellow: 0xffe14d, red: 0xff3355, green: 0x4dff9a, white: 0xdfe8ff, orange: 0xff8a2a, pink: 0xff6fb8, sodium: 0xffac5c, led: 0xe4ecff };
  N.names = Object.keys(N.C);

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /** Neon tube text on transparent ground, drawn white so one texture can be tinted any colour. */
  N.signTex = function (text, font) {
    const key = 'sign:' + text + ':' + (font || '');
    if (N.cache[key]) return N.cache[key];
    const f = font || '900 120px "Arial Black", Impact, "Hiragino Sans", sans-serif';
    const m = canvas(8, 8).getContext('2d'); m.font = f;
    const tw = Math.ceil(m.measureText(text).width) + 90;
    const c = canvas(Math.min(2048, tw), 190), x = c.getContext('2d');
    x.font = f; x.textAlign = 'center'; x.textBaseline = 'middle';
    const cx = c.width / 2, cy = c.height / 2 + 6;
    x.shadowColor = '#fff'; x.shadowBlur = 38; x.lineJoin = 'round';
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 14; x.strokeText(text, cx, cy);
    x.shadowBlur = 12; x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeText(text, cx, cy);
    x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillText(text, cx, cy);
    const t = tex(c); t.userData = { aspect: c.width / c.height };
    return (N.cache[key] = t);
  };

  /** Holographic advert artwork (colours baked in). */
  const ADS = [
    { a: 'KAIJU COLA', b: 'TASTE THE MONSTER', c1: '#ff2d55', c2: '#ffe14d', icon: 'circle' },
    { a: 'NEUROLINK+', b: 'THINK FASTER · BUY NOW', c1: '#36e7ff', c2: '#9d5cff', icon: 'tri' },
    { a: 'SYNTH NOODLE', b: '24H · 麺 · DELIVERED HOT', c1: '#ffe14d', c2: '#ff8a2a', icon: 'bowl' },
    { a: 'ORBITAL BANK', b: 'YOUR CREDIT, IN ORBIT', c1: '#9d5cff', c2: '#36e7ff', icon: 'ring' },
    { a: 'DREAMDECK', b: 'SLEEP IS OPTIONAL', c1: '#ff3cc8', c2: '#36e7ff', icon: 'eye' },
    { a: 'ZER0 LOCK', b: 'PRIVACY IS A LUXURY', c1: '#4dff9a', c2: '#dfe8ff', icon: 'lock' },
    { a: 'ラーメン', b: 'RAMEN · OPEN LATE', c1: '#ff6fb8', c2: '#ffe14d', icon: 'bowl' },
    { a: 'HOTEL 夢', b: 'ROOMS BY THE HOUR', c1: '#36e7ff', c2: '#ff3cc8', icon: 'circle' }
  ];
  N.adCount = ADS.length;
  N.adTex = function (i) {
    const key = 'ad:' + i;
    if (N.cache[key]) return N.cache[key];
    const ad = ADS[i % ADS.length], W = 512, H = 256, c = canvas(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(10,6,24,0.55)'); g.addColorStop(1, 'rgba(20,8,30,0.35)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = ad.c1; x.lineWidth = 4; x.shadowColor = ad.c1; x.shadowBlur = 16; x.strokeRect(10, 10, W - 20, H - 20);
    // icon
    x.lineWidth = 7; x.strokeStyle = ad.c2; x.shadowColor = ad.c2;
    const ix = 86, iy = 128;
    x.beginPath();
    if (ad.icon === 'circle') x.arc(ix, iy, 46, 0, Math.PI * 2);
    else if (ad.icon === 'tri') { x.moveTo(ix, iy - 50); x.lineTo(ix + 48, iy + 36); x.lineTo(ix - 48, iy + 36); x.closePath(); }
    else if (ad.icon === 'ring') { x.arc(ix, iy, 46, 0, Math.PI * 2); x.moveTo(ix + 24, iy); x.arc(ix, iy, 24, 0, Math.PI * 2); }
    else if (ad.icon === 'eye') { x.ellipse(ix, iy, 50, 26, 0, 0, Math.PI * 2); x.moveTo(ix + 14, iy); x.arc(ix, iy, 14, 0, Math.PI * 2); }
    else if (ad.icon === 'lock') { x.rect(ix - 34, iy - 6, 68, 50); x.moveTo(ix - 22, iy - 6); x.arc(ix, iy - 6, 22, Math.PI, 0); }
    else { x.arc(ix, iy - 4, 44, 0, Math.PI); x.moveTo(ix - 52, iy - 4); x.lineTo(ix + 52, iy - 4); }
    x.stroke();
    x.shadowBlur = 20; x.fillStyle = '#fff'; x.shadowColor = ad.c1;
    x.font = '900 58px "Arial Black", Impact, "Hiragino Sans", sans-serif'; x.textBaseline = 'middle';
    let fs = 58; while (x.measureText(ad.a).width > W - 190 && fs > 26) { fs -= 4; x.font = '900 ' + fs + 'px "Arial Black", Impact, "Hiragino Sans", sans-serif'; }
    x.fillText(ad.a, 160, 108);
    x.shadowBlur = 8; x.fillStyle = ad.c2; x.font = 'bold 22px "Arial Narrow", Arial, "Hiragino Sans", sans-serif';
    x.fillText(ad.b, 162, 166);
    return (N.cache[key] = tex(c));
  };

  /** Skyscraper facade: dark glass with lit windows. Returns { map, emissiveMap }. */
  N.facade = function () {
    if (N.cache.facade) return N.cache.facade;
    const S = 512, a = canvas(S, S), e = canvas(S, S), x = a.getContext('2d'), y = e.getContext('2d');
    const rnd = U.mulberry32(4242);
    x.fillStyle = '#15161d'; x.fillRect(0, 0, S, S);
    y.fillStyle = '#000'; y.fillRect(0, 0, S, S);
    const cols = 8, rows = 4, cw = S / cols, rh = S / rows;
    const lit = ['#ffc98a', '#ffd9a0', '#ffe2bd', '#ffb870', '#e4ecff', '#cfdcf5', '#ffd9a0', '#36e7ff'];
    for (let r = 0; r < rows; r++) {
      x.fillStyle = '#0c0d12'; x.fillRect(0, r * rh, S, 7);
      for (let c = 0; c < cols; c++) {
        const wx = c * cw + 7, wy = r * rh + 34, ww = cw - 14, wh = rh - 58;
        x.fillStyle = '#1d2230'; x.fillRect(wx, wy, ww, wh);
        if (rnd() < 0.3) {
          const col = lit[Math.floor(rnd() * lit.length)], k = 0.25 + rnd() * 0.55;
          y.globalAlpha = k; y.fillStyle = col; y.fillRect(wx, wy, ww, wh);
          if (rnd() < 0.3) { y.globalAlpha = k * 0.6; y.fillStyle = '#000'; y.fillRect(wx, wy + wh * (0.3 + rnd() * 0.4), ww, 3); }
          if (rnd() < 0.35) { y.globalAlpha = 0.55; y.fillStyle = '#000'; for (let b = wy + 3; b < wy + wh; b += 6) y.fillRect(wx, b, ww, 2); } // blinds
          if (rnd() < 0.3) { y.globalAlpha = 0.7; y.fillStyle = '#000'; y.fillRect(wx + ww * (0.25 + rnd() * 0.5), wy, ww, wh); } // curtain
          y.globalAlpha = 1;
          x.fillStyle = col; x.globalAlpha = 0.25; x.fillRect(wx, wy, ww, wh); x.globalAlpha = 1;
        }
      }
    }
    for (let c = 1; c < cols; c++) { x.fillStyle = '#0a0b0f'; x.fillRect(c * cw - 3, 0, 6, S); }
    return (N.cache.facade = { map: tex(a, true), emissiveMap: tex(e, true) });
  };

  // ------------------------------------------------------------ placement helpers (use after L.init)
  const FACE_ROT = { 'z+': 0, 'z-': Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 };
  N.faceRot = FACE_ROT;
  /** Neon sign facing a direction. height in metres. Adds a coloured light unless o.light === false. */
  N.sign = function (text, color, x, y, z, face, height, o) {
    o = o || {};
    const L = CF.Level, t = N.signTex(text, o.font), h = height || 1.2, w = h * t.userData.aspect;
    const col = N.C[color] || N.C.cyan;
    const mat = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(col[0] * 0.55, col[1] * 0.55, col[2] * 0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = typeof face === 'number' ? face : FACE_ROT[face] || 0; m.renderOrder = 6;
    L.scene.add(m);
    if (o.backing !== false) {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.02, h * 1.05), N.backMat || (N.backMat = new THREE.MeshStandardMaterial({ color: 0x07070b, roughness: 0.6, metalness: 0.4 })));
      back.position.copy(m.position); back.rotation.y = m.rotation.y; back.translateZ(-0.03); L.scene.add(back);
    }
    const base = mat.color.clone();
    if (o.flicker) {
      let fl = 1, tgt = 1, tt = 0;
      L.animated.push((dt) => { tt -= dt; if (tt <= 0) { tgt = Math.random() < o.flicker ? U.rand(0, 0.3) : 1; tt = tgt < 1 ? U.rand(0.04, 0.15) : U.rand(0.3, 3); } fl = U.damp(fl, tgt, 40, dt); mat.color.copy(base).multiplyScalar(fl); });
    }
    if (o.light !== false) {
      const off = o.lightOff || 1.2, fr = FACE_ROT[face] || 0;
      L.lamp(x + Math.sin(fr) * off, y, z + Math.cos(fr) * off, { color: N.HEX[color] || N.HEX.cyan, intensity: o.intensity || 1.6, distance: o.distance || Math.max(8, w * 1.6), pool: o.pool === true, prio: 0.2 });
    }
    return m;
  };

  const HOLO_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  const HOLO_FS = [
    'uniform sampler2D uMap; uniform vec3 uColor; uniform float uTime; uniform float uSeed; varying vec2 vUv;',
    'float h(float n){ return fract(sin(n)*43758.5453); }',
    'void main(){',
    ' vec2 uv = vUv; float slot = floor(uTime*9.0 + uSeed*13.0);',
    ' float g = step(0.965, h(slot)) * 0.04 * sin(uv.y*60.0 + uTime*40.0);',
    ' uv.x += g;',
    ' vec4 t = texture2D(uMap, uv);',
    ' float scan = 0.72 + 0.28*sin(uv.y*380.0 - uTime*6.0);',
    ' float fl = 0.86 + 0.14*sin(uTime*21.0 + uSeed*9.0) * step(0.2, h(slot+3.0));',
    ' float edge = smoothstep(0.0,0.02,vUv.x)*smoothstep(1.0,0.98,vUv.x)*smoothstep(0.0,0.03,vUv.y)*smoothstep(1.0,0.97,vUv.y);',
    ' vec3 c = uColor * t.rgb * (0.4 + t.a) * scan * fl;',
    ' gl_FragColor = vec4(c * edge, 1.0);',
    '}'
  ].join('\n');
  N.holoMats = [];
  /** Animated holographic advert panel. */
  N.holo = function (adIndex, x, y, z, rotY, w, h, parent) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: N.adTex(adIndex) }, uColor: { value: new THREE.Color(1.9, 1.9, 1.9) }, uTime: { value: 0 }, uSeed: { value: Math.random() * 10 } },
      vertexShader: HOLO_VS, fragmentShader: HOLO_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = rotY || 0; m.renderOrder = 7; m.frustumCulled = true;
    (parent || CF.Level.scene).add(m);
    N.holoMats.push(mat);
    return m;
  };
  N.tick = function (t) { for (const m of N.holoMats) m.uniforms.uTime.value = t; };
  N.reset = function () { N.holoMats = []; };

  /** Glowing strip (neon tube) as batched geometry. */
  N.strip = function (x0, y0, z0, x1, y1, z1, color) {
    CF.Level.box(x0, y0, z0, x1, y1, z1, 'neon_' + (N.C[color] ? color : 'cyan'), { noCol: true, ao: false });
  };

  // ------------------------------------------------------------ rain
  const RAIN_VS = [
    'attribute float aEnd; attribute float aRnd;',
    'uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; uniform float uSpeed; uniform float uLen; uniform float uFogD;',
    'uniform vec4 uRoofs[8]; uniform float uRoofY[8]; uniform float uRoofN;',
    'varying float vA;',
    'void main(){',
    ' vec3 p = position;',
    ' float y = mod(p.y - uTime * uSpeed * (0.85 + aRnd * 0.3), 28.0);',
    ' vec3 w = vec3(uCam.x + mod(p.x - uCam.x + 22.0, 44.0) - 22.0, uCam.y - 10.0 + y, uCam.z + mod(p.z - uCam.z + 22.0, 44.0) - 22.0);',
    ' w.xz += uWind * (y - 14.0) * 0.03;',
    ' float hide = 0.0;',
    ' for (int i = 0; i < 8; i++) { if (float(i) >= uRoofN) break; vec4 r = uRoofs[i];',
    '   if (w.x > r.x && w.x < r.z && w.z > r.y && w.z < r.w && w.y < uRoofY[i]) hide = 1.0; }',
    ' vec3 dir = normalize(vec3(uWind.x * 0.03, -1.0, uWind.y * 0.03));',
    ' w -= dir * uLen * aEnd;',
    ' vec4 mv = modelViewMatrix * vec4(w, 1.0);',
    ' float fd = uFogD * -mv.z; vA = exp(-fd * fd) * (1.0 - aEnd * 0.85) * (1.0 - hide);',
    ' gl_Position = projectionMatrix * mv;',
    ' if (hide > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);',
    '}'
  ].join('\n');
  const RAIN_FS = 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA, 1.0); }';
  N.Rain = function (scene, count, o) {
    o = o || {};
    const n = count || 2600, pos = new Float32Array(n * 6), end = new Float32Array(n * 2), rnd = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = U.rand(-22, 22), y = U.rand(0, 28), z = U.rand(-22, 22), r = Math.random();
      pos.set([x, y, z, x, y, z], i * 6); end.set([0, 1], i * 2); rnd.set([r, r], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1)); g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    const roofs = [], roofY = [];
    for (let i = 0; i < 8; i++) { roofs.push(new THREE.Vector4(0, 0, 0, 0)); roofY.push(-999); }
    (o.roofs || []).slice(0, 8).forEach((r, i) => { roofs[i].set(r[0], r[1], r[2], r[3]); roofY[i] = r[4]; });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(o.windX || 3, o.windZ || 1.5) },
        uSpeed: { value: o.speed || 19 }, uLen: { value: o.len || 0.75 }, uFogD: { value: o.fog || 0.03 },
        uColor: { value: new THREE.Color(o.color || 0x8ea8d8).multiplyScalar(o.bright || 0.5) },
        uRoofs: { value: roofs }, uRoofY: { value: roofY }, uRoofN: { value: Math.min(8, (o.roofs || []).length) }
      },
      vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.mesh = new THREE.LineSegments(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 24;
    scene.add(this.mesh);
    this.splashT = 0; this.roofs = o.roofs || [];
  };
  N.Rain.prototype.update = function (dt, t, cam) {
    this.mat.uniforms.uTime.value = t; this.mat.uniforms.uCam.value.copy(cam);
    if (!CF.FX.ready) return;
    this.splashT += dt * (CF.bootQuality === 'low' ? 30 : 70);
    const W = CF.World;
    while (this.splashT > 1) {
      this.splashT -= 1;
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 16, x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
      const h = W.raycast(x, cam.y + 12, z, 0, -1, 0, 40);
      if (!h || h.ny < 0.5) continue;
      CF.FX.add.spawn(x, h.y + 0.02, z, U.gauss() * 0.4, U.rand(0.6, 1.4), U.gauss() * 0.4, 0.22, 0.04, 0.1, 0.5, 0.65, 0.9, 0.9, 7, 0, 0);
    }
  };

  // ------------------------------------------------------------ air traffic
  N.Traffic = function (scene, count, o) {
    o = o || {};
    const n = count || 36;
    this.cars = [];
    const pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      const alt = U.rand(o.minAlt || 28, o.maxAlt || 95), r = U.rand(90, 260), a = Math.random() * 6.283, dir = Math.random() * 6.283;
      this.cars.push({ x: Math.cos(a) * r, y: alt, z: Math.sin(a) * r, dx: Math.cos(dir), dz: Math.sin(dir), sp: U.rand(10, 26), R: r });
      const warm = Math.random() < 0.5;
      col.set(warm ? [3, 2.6, 2] : [2.4, 2.8, 3.4], i * 6); col.set([3.2, 0.3, 0.5], i * 6 + 3);
    }
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 2.2, map: CF.Tex.list.soft, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 8;
    scene.add(this.points);
  };
  N.Traffic.prototype.update = function (dt) {
    const P = this.aPos.array;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      c.x += c.dx * c.sp * dt; c.z += c.dz * c.sp * dt;
      const d = Math.hypot(c.x, c.z);
      if (d > 300 || d < 70) { const a = Math.random() * 6.283; c.x = Math.cos(a) * 280; c.z = Math.sin(a) * 280; const t = Math.atan2(-c.z, -c.x) + U.rand(-0.6, 0.6); c.dx = Math.cos(t); c.dz = Math.sin(t); }
      P[i * 6] = c.x; P[i * 6 + 1] = c.y; P[i * 6 + 2] = c.z;
      P[i * 6 + 3] = c.x - c.dx * 3; P[i * 6 + 4] = c.y; P[i * 6 + 5] = c.z - c.dz * 3;
    }
    this.aPos.needsUpdate = true;
  };
})(window.CF);
