'use strict';
/* Cinderfall — renderer + HDR post pipeline: MSAA scene target, dual-filter bloom, ACES grade. */
(function (CF) {
  const U = CF.U;
  const PP = CF.Post = { scale: 1, maxScale: 1, ft: 16, adaptT: 0 };

  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const BOX = 'vec3 box(sampler2D t, vec2 uv, vec2 px){ vec4 o = px.xyxy * vec4(-1.0,-1.0,1.0,1.0); return (texture2D(t,uv+o.xy).rgb + texture2D(t,uv+o.zy).rgb + texture2D(t,uv+o.xw).rgb + texture2D(t,uv+o.zw).rgb) * 0.25; }';
  const FS_BRIGHT = [
    'uniform sampler2D tSrc; uniform vec2 uPx; uniform float uThreshold; uniform float uKnee; varying vec2 vUv;', BOX,
    'vec3 safe(vec3 c){',
    '#if __VERSION__ >= 300',
    ' if (any(isnan(c)) || any(isinf(c))) return vec3(0.0);',
    '#endif',
    ' return clamp(c, vec3(0.0), vec3(40.0)); }',
    'void main(){ vec3 c = safe(box(tSrc, vUv, uPx)); float br = max(c.r, max(c.g, c.b));',
    ' float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);',
    ' float k = max(soft, br - uThreshold) / max(br, 1e-4); gl_FragColor = vec4(c * k, 1.0); }'
  ].join('\n');
  const FS_DOWN = ['uniform sampler2D tSrc; uniform vec2 uPx; varying vec2 vUv;', BOX, 'void main(){ gl_FragColor = vec4(box(tSrc, vUv, uPx), 1.0); }'].join('\n');
  const FS_UP = [
    'uniform sampler2D tSmall; uniform sampler2D tCur; uniform vec2 uPx; uniform float uRadius; varying vec2 vUv;',
    'void main(){ vec4 d = uPx.xyxy * vec4(1.0, 1.0, -1.0, 0.0) * uRadius;',
    ' vec3 s = texture2D(tSmall, vUv - d.xy).rgb + texture2D(tSmall, vUv - d.wy).rgb * 2.0 + texture2D(tSmall, vUv - d.zy).rgb;',
    ' s += texture2D(tSmall, vUv + d.zw).rgb * 2.0 + texture2D(tSmall, vUv).rgb * 4.0 + texture2D(tSmall, vUv + d.xw).rgb * 2.0;',
    ' s += texture2D(tSmall, vUv + d.zy).rgb + texture2D(tSmall, vUv + d.wy).rgb * 2.0 + texture2D(tSmall, vUv + d.xy).rgb;',
    ' gl_FragColor = vec4(s / 16.0 + texture2D(tCur, vUv).rgb, 1.0); }'
  ].join('\n');
  const FS_FINAL = [
    'uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uExposure; uniform float uTime;',
    'uniform float uHurt; uniform float uLow; uniform float uSuppress; uniform float uCA; uniform float uSat; uniform vec2 uRes; uniform float uFade; uniform vec3 uShadowT; uniform vec3 uHighT; uniform float uGrain;',
    'varying vec2 vUv;',
    'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }',
    'vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main(){',
    ' vec2 cc = vUv - 0.5; float r2 = dot(cc, cc);',
    ' float ca = uCA * (0.25 + r2 * 3.0);',
    ' vec3 col = vec3(texture2D(tScene, vUv - cc * ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv + cc * ca).b);',
    ' vec3 bl = texture2D(tBloom, vUv).rgb;',
    '#if __VERSION__ >= 300',
    ' if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);',
    ' if (any(isnan(bl)) || any(isinf(bl))) bl = vec3(0.0);',
    '#endif',
    ' col = max(col, vec3(0.0)) + max(bl, vec3(0.0)) * uBloom;',
    ' col *= uExposure;',
    ' float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    ' col = mix(vec3(l), col, uSat);',
    ' col = aces(col);',
    ' col = srgb(col);',
    ' float dl = dot(col, vec3(0.299, 0.587, 0.114));',
    ' col += uShadowT * (1.0 - smoothstep(0.0, 0.45, dl)) + uHighT * smoothstep(0.5, 1.0, dl);',
    ' col *= mix(0.62, 1.0, smoothstep(0.62, 0.1, r2));',
    ' float edge = smoothstep(0.06, 0.42, r2);',
    ' float pulse = uLow * (0.55 + 0.3 * sin(uTime * 6.2));',
    ' col = mix(col, vec3(0.5, 0.03, 0.01), clamp(edge * (uHurt * 0.8 + pulse), 0.0, 0.85));',
    ' col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), uLow * 0.55);',
    ' col *= 1.0 - edge * uSuppress * 0.45;',
    ' col += (hash(vUv * uRes + fract(uTime * 7.13) * 91.0) - 0.5) * 0.03 * uGrain;',
    ' col *= uFade;',
    ' gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  PP.init = function (canvas) {
    const q = CF.bootQuality;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    } catch (e) { return false; }
    this.renderer = renderer;
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 1);
    this.isGL2 = renderer.capabilities.isWebGL2;
    this.maxScale = q === 'high' ? 1.5 : q === 'medium' ? 1.0 : 0.8;
    this.scale = Math.min(this.maxScale, window.devicePixelRatio || 1);
    const ext = renderer.extensions;
    const canHalf = this.isGL2 ? (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))
      : (ext.has('OES_texture_half_float') && ext.has('EXT_color_buffer_half_float'));
    const ftype = canHalf ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.hdr = canHalf;
    const opts = { type: ftype, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(4, 4, Object.assign({}, opts, { depthBuffer: true, samples: this.isGL2 && q !== 'low' ? 4 : 0 }));
    this.mips = []; this.ups = [];
    this.levels = 5;
    for (let i = 0; i < this.levels; i++) { this.mips.push(new THREE.WebGLRenderTarget(4, 4, opts)); this.ups.push(new THREE.WebGLRenderTarget(4, 4, opts)); }
    const mat = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.mBright = mat(FS_BRIGHT, { tSrc: { value: null }, uPx: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 }, uKnee: { value: 0.6 } });
    this.mDown = mat(FS_DOWN, { tSrc: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.mUp = mat(FS_UP, { tSmall: { value: null }, tCur: { value: null }, uPx: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } });
    this.mFinal = mat(FS_FINAL, {
      tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.65 }, uExposure: { value: 1.35 }, uTime: { value: 0 },
      uHurt: { value: 0 }, uLow: { value: 0 }, uSuppress: { value: 0 }, uCA: { value: 0.0025 }, uSat: { value: 1.05 }, uRes: { value: new THREE.Vector2() }, uFade: { value: 1 }, uShadowT: { value: new THREE.Vector3(-0.012, 0.002, 0.018) }, uHighT: { value: new THREE.Vector3(0.02, 0.008, -0.012) }, uGrain: { value: 1 }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(g, this.mFinal); this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize();
    return true;
  };

  PP.resize = function () {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    let s = this.scale;
    const maxPx = CF.bootQuality === 'high' ? 3.7e6 : 2.2e6;
    if (w * h * s * s > maxPx) s = Math.sqrt(maxPx / (w * h));
    this.effScale = s;
    this.renderer.setPixelRatio(s);
    this.renderer.setSize(w, h, false);
    const W = Math.floor(w * s), H = Math.floor(h * s);
    this.W = W; this.H = H;
    this.rt.setSize(W, H);
    let mw = Math.max(1, W >> 1), mh = Math.max(1, H >> 1);
    for (let i = 0; i < this.levels; i++) { this.mips[i].setSize(mw, mh); this.ups[i].setSize(mw, mh); mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); }
    this.mFinal.uniforms.uRes.value.set(W, H);
    if (CF.FX && CF.FX.ready && CF.Game.camera) CF.FX.resize(H, CF.Game.camera.fov);
  };

  PP.pass = function (mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  };

  PP.render = function (scene, camera, vmScene, vmCam) {
    const r = this.renderer;
    r.setRenderTarget(this.rt); r.clear(true, true, false);
    r.render(scene, camera);
    if (vmScene) { r.clearDepth(); r.render(vmScene, vmCam); }
    // bloom
    this.mBright.uniforms.tSrc.value = this.rt.texture; this.mBright.uniforms.uPx.value.set(1 / this.W, 1 / this.H);
    this.pass(this.mBright, this.mips[0]);
    for (let i = 1; i < this.levels; i++) {
      const src = this.mips[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture; this.mDown.uniforms.uPx.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mDown, this.mips[i]);
    }
    for (let i = this.levels - 2; i >= 0; i--) {
      const small = i === this.levels - 2 ? this.mips[this.levels - 1] : this.ups[i + 1];
      this.mUp.uniforms.tSmall.value = small.texture; this.mUp.uniforms.tCur.value = this.mips[i].texture;
      this.mUp.uniforms.uPx.value.set(1 / small.width, 1 / small.height);
      this.pass(this.mUp, this.ups[i]);
    }
    const u = this.mFinal.uniforms;
    u.tScene.value = this.rt.texture; u.tBloom.value = this.ups[0].texture; u.uTime.value = CF.realTime;
    this.pass(this.mFinal, null);
  };

  /** Feed the grading uniforms from gameplay state. */
  PP.setState = function (s) {
    const u = this.mFinal.uniforms;
    if (s.hurt != null) u.uHurt.value = s.hurt;
    if (s.low != null) u.uLow.value = s.low;
    if (s.suppress != null) u.uSuppress.value = s.suppress;
    if (s.ca != null) u.uCA.value = s.ca;
    if (s.exposure != null) { this.baseExposure = s.exposure; this.applyPrefs(); }
    if (s.sat != null) u.uSat.value = s.sat;
    if (s.fade != null) u.uFade.value = s.fade;
    if (s.bloom != null) u.uBloom.value = s.bloom;
    if (s.shadow) u.uShadowT.value.set(s.shadow[0], s.shadow[1], s.shadow[2]);
    if (s.high) u.uHighT.value.set(s.high[0], s.high[1], s.high[2]);
    if (s.threshold != null) this.mBright.uniforms.uThreshold.value = s.threshold;
  };

  /** Player picture settings: brightness scales the map's exposure; grain can be switched off. */
  PP.applyPrefs = function () {
    if (!this.mFinal) return;
    const u = this.mFinal.uniforms, S = CF.settings;
    u.uExposure.value = (this.baseExposure != null ? this.baseExposure : 1.35) * (S.brightness || 1);
    u.uGrain.value = S.grain ? 1 : 0;
  };

  /** Dynamic resolution: nudge the internal scale to hold frame time. */
  PP.adapt = function (dt) {
    this.ft = U.lerp(this.ft, dt * 1000, 0.05);
    this.adaptT -= dt;
    if (this.adaptT > 0) return;
    this.adaptT = 1.5;
    const min = Math.min(0.6, this.maxScale);
    const top = Math.min(this.maxScale, window.devicePixelRatio || 1);
    if (this.ft > 25 && this.scale > min) { this.scale = Math.max(min, this.scale - 0.1); this.resize(); }
    else if (this.ft < 17.5 && this.scale < top) { this.scale = Math.min(top, this.scale + 0.05); this.resize(); }
  };
})(window.CF);
