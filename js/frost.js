'use strict';
/* Cinderfall — polar weather for the Whiteout campaign: falling and blowing snow, the storm controller
   (fog, wind, light) and body warmth (hypothermia outside the heat of beacons and buildings). */
(function (CF) {
  const U = CF.U;
  const F = CF.Frost = { storm: 0, stormTarget: 0, warmth: 100, cold: false, snow: null, wind: null, gust: 0, gustT: 4, heat: [] };

  // ------------------------------------------------------------ snowfall (GPU-wrapped points around the camera)
  const SNOW_VS = [
    'attribute float aRnd; uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; uniform float uFall; uniform float uSize; uniform float uScale; uniform float uFogD;',
    'varying float vA; varying float vR;',
    'void main(){',
    ' vec3 p = position; float r = aRnd; float sp = 0.65 + r * 0.7;',
    ' vec3 off = vec3(uWind.x, -uFall, uWind.y) * uTime * sp;',
    ' off.x += sin(uTime * (0.9 + r * 1.3) + r * 40.0) * 0.6; off.z += cos(uTime * (0.7 + r) + r * 21.0) * 0.6;',
    ' vec3 box = vec3(48.0, 26.0, 48.0);',
    ' vec3 w = mod(p + off - uCam + box * 0.5, box) - box * 0.5 + uCam;',
    ' vec4 mv = modelViewMatrix * vec4(w, 1.0); float z = max(0.1, -mv.z);',
    ' gl_PointSize = min(9.0, uSize * (0.55 + r * 0.9) * uScale / z);',
    ' float fd = uFogD * z; vA = exp(-fd * fd) * smoothstep(0.9, 2.6, z); vR = r;',
    ' gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  const SNOW_FS = [
    'uniform float uAlpha; uniform vec3 uColor; varying float vA; varying float vR;',
    'void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0; float a = (1.0 - d) * vA * uAlpha * (0.55 + vR * 0.45);',
    ' if (a <= 0.004) discard; gl_FragColor = vec4(uColor, a); }'
  ].join('\n');
  F.Snow = function (scene, count, o) {
    o = o || {};
    const n = count || 5000, pos = new Float32Array(n * 3), rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = U.rand(-24, 24); pos[i * 3 + 1] = U.rand(-13, 13); pos[i * 3 + 2] = U.rand(-24, 24); rnd[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(1.2, 0.5) }, uFall: { value: o.fall || 1.4 },
        uSize: { value: 0.09 }, uScale: { value: 800 }, uFogD: { value: 0.03 }, uAlpha: { value: 0.8 }, uColor: { value: new THREE.Color(o.color || 0xeef4ff).multiplyScalar(o.bright || 1) }
      },
      vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false
    });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 24;
    scene.add(this.mesh);
    this.t = 0; this.puffT = 0;
  };
  F.Snow.prototype.update = function (dt, t, cam) {
    const u = this.mat.uniforms, s = F.storm;
    this.t += dt * (1 + s * 2.2);
    u.uTime.value = this.t; u.uCam.value.copy(cam);
    const gust = 1 + F.gust * 0.8;
    u.uWind.value.set((1.2 + s * 9) * gust, (0.5 + s * 3.5) * gust);
    u.uAlpha.value = 0.55 + s * 0.45; u.uSize.value = 0.075 + s * 0.05;
    u.uScale.value = CF.Post.H * 0.5 / Math.tan((CF.Game.camera.fov * Math.PI / 180) / 2);
    u.uFogD.value = 0.02 + s * 0.05;
    // blowing spindrift along the ground when the wind is up
    if (!CF.FX.ready) return;
    this.puffT += dt * (s * 24 + F.gust * 6) * (CF.bootQuality === 'low' ? 0.5 : 1);
    while (this.puffT > 1) {
      this.puffT -= 1;
      const a = Math.random() * 6.283, r = U.rand(3, 20), x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
      const gy = CF.World.groundHeight(x, cam.y + 2, z);
      const wx = u.uWind.value.x, wz = u.uWind.value.y;
      CF.FX.smoke.spawn(x, gy + U.rand(0.1, 0.8), z, wx * 0.8, U.rand(0, 0.3), wz * 0.8, U.rand(1.6, 3), U.rand(1, 2), U.rand(3, 5), 0.5, 0.55, 0.6, 0.16 + s * 0.12, -0.05, 0.2, 1);
    }
  };

  // ------------------------------------------------------------ storm controller
  /** Called once a map is built. th.frost holds the calm and storm looks. */
  F.setup = function (G, th) {
    this.th = th.frost || null;
    this.storm = this.stormTarget = 0; this.warmth = 100; this.cold = false; this.gust = 0;
    this.snow = null;
    if (!this.th) return;
    this.snow = new F.Snow(G.scene, CF.bootQuality === 'low' ? 2600 : 5200, { fall: 1.3 });
    this.fogBase = th.fogDensity; this.fogCol = new THREE.Color(th.fog[0], th.fog[1], th.fog[2]);
    this.stormCol = new THREE.Color(this.th.stormFog[0], this.th.stormFog[1], this.th.stormFog[2]);
    this.moonBase = th.moon.intensity; this.hemiBase = null;
    G.scene.traverse((o) => { if (o.isHemisphereLight) this.hemi = o; });
    if (this.hemi) this.hemiBase = this.hemi.intensity;
    this.apply(G);
  };
  F.setStorm = function (v, instant) { this.stormTarget = U.clamp(v, 0, 1); if (instant) this.storm = this.stormTarget; };
  F.apply = function (G) {
    if (!this.th) return;
    const s = this.storm, sc = G.scene;
    const d = U.lerp(this.fogBase, this.th.stormDensity, s * s);
    sc.fog.density = d; sc.fog.color.copy(this.fogCol).lerp(this.stormCol, s);
    CF.FX.setFog(d, sc.fog.color);
    if (G.moon) G.moon.intensity = this.moonBase * (1 - s * 0.55);
    if (this.hemi) this.hemi.intensity = this.hemiBase * (1 - s * 0.25);
    const mm = CF.Level.mountainMat;
    if (mm) { mm.uniforms.uHaze.value.set(sc.fog.color.r, sc.fog.color.g, sc.fog.color.b); mm.uniforms.uHazeD.value = mm.userData.hazeD + s * s * 0.03; }
    if (CF.Level.sky) { const u = CF.Level.sky.material.uniforms; u.uAurora.value = (this.th.aurora || 0) * (1 - s); u.uStorm.value = s; u.uStormCol.value.set(sc.fog.color.r, sc.fog.color.g, sc.fog.color.b); }
  };

  // ------------------------------------------------------------ warmth
  /** Heat source: beacons, heaters, braziers. r = radius of the warm zone. */
  F.addHeat = function (x, y, z, r, on) { const h = { x, y, z, r, on: on !== false }; this.heat.push(h); return h; };
  F.nearHeat = function (p) {
    for (const h of this.heat) if (h.on && Math.hypot(p.x - h.x, p.z - h.z) < h.r && Math.abs(p.y - h.y) < 4) return true;
    return false;
  };

  F.update = function (G, dt, raw) {
    if (!this.th) return;
    const P = CF.Player;
    // storm easing + gusts
    this.storm += (this.stormTarget - this.storm) * Math.min(1, dt * 0.35);
    this.gustT -= dt;
    if (this.gustT <= 0) { this.gustT = U.rand(3, 9) * (1 - this.storm * 0.5); this.gustTarget = Math.random() < 0.4 + this.storm * 0.4 ? U.rand(0.4, 1) : 0; }
    this.gust = U.damp(this.gust, this.gustTarget || 0, 1.2, dt);
    this.apply(G);
    if (this.snow) this.snow.update(dt, CF.time, G.camera.position);
    if (this.wind) this.wind.set((0.05 + this.storm * 0.28 + this.gust * 0.08) * (G.inside ? 0.35 : 1), 0.4);
    // warmth: drains in the open while the cold is on, returns near heat and indoors
    const playing = G.state === 'playing' && P.alive;
    if (!this.cold || !playing) {
      this.warmth = Math.min(100, this.warmth + dt * 30);
    } else {
      const warm = G.inside || this.nearHeat(P.body.pos);
      const drain = (100 / 70) * (0.55 + this.storm * 0.75) * (CF.diff().dmg >= 1.4 ? 1.2 : CF.diff().dmg <= 0.7 ? 0.8 : 1);
      this.warmth = U.clamp(this.warmth + (warm ? 28 : -drain) * dt, 0, 100);
      if (this.warmth <= 0) {
        this.chillDmgT = (this.chillDmgT || 0) - dt;
        if (this.chillDmgT <= 0) { this.chillDmgT = 0.5; P.damage(5 / CF.diff().dmg, null, 'Hypothermia'); CF.HUD.hint('Freezing · get to a heat beacon', true); }
      } else if (this.warmth < 30 && !warm) CF.HUD.hint('Body temperature falling · find heat', true);
      if (warm && this.warmth < 99 && (G.inside || this.nearHeat(P.body.pos))) CF.HUD.hint('Warming up', false);
    }
    CF.HUD.setWarmth(this.cold ? this.warmth : null);
    // frost creeping in at the edge of the screen
    const frostVis = this.cold ? U.clamp(1 - this.warmth / 45, 0, 1) : 0;
    CF.HUD.frost(frostVis);
  };
  F.reset = function () {
    this.warmth = 100; this.cold = false; this.chillDmgT = 0;
    for (const h of this.heat) if (h.beacon) h.on = false;
    CF.HUD.setWarmth(null); CF.HUD.frost(0);
  };
  F.clear = function () {
    this.th = null; this.snow = null; this.heat = []; this.cold = false; this.storm = this.stormTarget = 0;
    if (this.wind) { this.wind.stop(); this.wind = null; }
    if (CF.HUD.setWarmth) { CF.HUD.setWarmth(null); CF.HUD.frost(0); }
  };
})(window.CF);
