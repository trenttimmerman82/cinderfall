'use strict';
/* Cinderfall — procedural audio engine (WebAudio). Every sound is synthesized; no files. */
(function (CF) {
  const U = CF.U;
  const A = CF.Audio = {
    ctx: null, ready: false, paused: false,
    master: null, sfx: null, ui: null, music: null, amb: null, muffle: null, revSend: null, reverb: null,
    noiseBuf: null, occlusion: null, room: 0.25,
    concussion: 0, tinnitus: null, loops: [], ambient: null, lastPlay: {}, clankTimer: 6,
    lx: 0, ly: 0, lz: 0
  };

  A.init = function () {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try { ctx = this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.2;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    this.master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);

    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.7;
    this.muffle.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.connect(this.muffle);
    this.ui = ctx.createGain(); this.ui.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.amb = ctx.createGain(); this.amb.connect(this.sfx);

    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.makeIR(2.6, 3.0);
    this.revSend = ctx.createGain(); this.revSend.gain.value = this.room;
    const revOut = ctx.createGain(); revOut.gain.value = 0.9;
    this.revSend.connect(this.reverb); this.reverb.connect(revOut); revOut.connect(this.muffle);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.applyVolumes();
    this.ready = true;
    if (CF.Music) CF.Music.init(this);
  };

  A.resume = function () { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); };

  A.applyVolumes = function () {
    if (!this.ctx) return;
    const s = CF.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.paused ? 0 : s.sfx, t, 0.05);
    this.ui.gain.setTargetAtTime(s.sfx * 0.85, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.75, t, 0.05);
  };
  A.setPaused = function (p) { this.paused = p; this.applyVolumes(); if (CF.Music) CF.Music.setMuffled(p); };
  A.setRoom = function (v) { this.room = v; if (this.revSend) this.revSend.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4); };

  A.makeIR = function (dur, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.25 + 0.7 * t; // tail darkens over time
        lp += (Math.random() * 2 - 1 - lp) * (1 - k);
        d[i] = lp * Math.pow(1 - t, decay) * (i < rate * 0.004 ? i / (rate * 0.004) : 1);
      }
      // a few discrete early reflections
      for (let r = 0; r < 6; r++) { const idx = Math.floor(rate * (0.011 + r * 0.013 + Math.random() * 0.01)); if (idx < len) d[idx] += (Math.random() < 0.5 ? -1 : 1) * 0.5 * (1 - r / 7); }
    }
    return buf;
  };

  // ------------------------------------------------------------- primitives
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  A.noise = function (dest, t, o) {
    const ctx = this.ctx, dur = o.dur || 0.1, att = o.attack || 0.002;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + att + dur);
    f.Q.value = o.Q || 1;
    const g = ctx.createGain(); env(g, t, att, o.gain || 0.3, dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.6, att + dur + 0.05);
  };
  A.tone = function (dest, t, o) {
    const ctx = this.ctx, dur = o.dur || 0.2, att = o.attack || 0.003;
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0 || 440, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + att + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain(); env(g, t, att, o.gain || 0.2, dur);
    osc.connect(g);
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); f.connect(dest); }
    else g.connect(dest);
    osc.start(t); osc.stop(t + att + dur + 0.05);
  };
  A.filter = function (dest, type, freq, Q) {
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q || 1; f.connect(dest); return f;
  };

  // ------------------------------------------------------------- routing
  const _f = new THREE.Vector3();
  A.dest2D = function (bus, send) {
    const g = this.ctx.createGain(); g.connect(bus || this.sfx);
    if (send) { const s = this.ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.revSend); }
    return g;
  };
  A.dest3D = function (pos, ref, vol) {
    const ctx = this.ctx;
    const dx = pos.x - this.lx, dy = pos.y - this.ly, dz = pos.z - this.lz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 110) return null;
    const p = ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = ref || 4; p.rolloffFactor = 1.15; p.maxDistance = 300;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    const g = ctx.createGain(); g.gain.value = vol == null ? 1 : vol;
    g.connect(p); p.connect(this.sfx);
    const s = ctx.createGain(); s.gain.value = U.clamp(0.15 + dist / 55, 0.15, 0.8); p.connect(s); s.connect(this.revSend);
    if (dist > 3 && this.occlusion && this.occlusion(pos)) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 850; f.Q.value = 0.5;
      f.connect(g); return f;
    }
    return g;
  };

  // ------------------------------------------------------------- recipes
  const R = {};
  R.carbine = (d, t) => {
    A.noise(d, t, { type: 'highpass', f0: 2600, dur: 0.035, gain: 0.7 });
    A.noise(d, t, { type: 'lowpass', f0: 6500, f1: 650, dur: 0.16, gain: 1.0, Q: 0.8 });
    A.tone(d, t, { f0: 150, f1: 45, dur: 0.14, gain: 0.95 });
    A.noise(d, t + 0.015, { type: 'bandpass', f0: 520, f1: 210, dur: 0.5, gain: 0.14, Q: 0.6 });
    A.tone(d, t, { type: 'square', f0: 2300, f1: 1600, dur: 0.02, gain: 0.05 });
  };
  R.pistol = (d, t) => {
    A.noise(d, t, { type: 'highpass', f0: 3000, dur: 0.03, gain: 0.6 });
    A.noise(d, t, { type: 'lowpass', f0: 8000, f1: 1200, dur: 0.11, gain: 0.8, Q: 0.9 });
    A.tone(d, t, { f0: 200, f1: 60, dur: 0.1, gain: 0.7 });
    A.noise(d, t + 0.01, { type: 'bandpass', f0: 700, f1: 300, dur: 0.35, gain: 0.1, Q: 0.6 });
  };
  R.shotgun = (d, t) => {
    A.noise(d, t, { type: 'highpass', f0: 2000, dur: 0.05, gain: 0.8 });
    A.noise(d, t, { type: 'lowpass', f0: 5000, f1: 240, dur: 0.4, gain: 1.15, Q: 0.7 });
    A.tone(d, t, { f0: 100, f1: 30, dur: 0.3, gain: 1.25 });
    A.noise(d, t + 0.02, { type: 'bandpass', f0: 400, f1: 150, dur: 0.85, gain: 0.2, Q: 0.5 });
  };
  R.rail = (d, t) => {
    const bp = A.filter(d, 'bandpass', 1600, 1.4);
    A.tone(bp, t, { type: 'sawtooth', f0: 2600, f1: 90, dur: 0.4, gain: 0.8 });
    A.noise(d, t, { type: 'highpass', f0: 3000, dur: 0.25, gain: 0.45 });
    A.tone(d, t, { f0: 95, f1: 32, dur: 0.45, gain: 1.1 });
    A.tone(d, t, { f0: 3150, f1: 2900, dur: 0.7, gain: 0.05 });
    A.noise(d, t + 0.02, { type: 'bandpass', f0: 900, f1: 250, dur: 0.9, gain: 0.16, Q: 0.5 });
  };
  R.railCharge = (d, t) => {
    A.tone(d, t, { f0: 300, f1: 1600, dur: 0.85, gain: 0.05, attack: 0.08 });
    A.tone(d, t, { type: 'sawtooth', f0: 140, f1: 700, dur: 0.85, gain: 0.02, attack: 0.08, lp: 1800 });
  };
  R.dry = (d, t) => { A.tone(d, t, { type: 'square', f0: 3200, f1: 2800, dur: 0.012, gain: 0.12 }); A.noise(d, t, { type: 'highpass', f0: 4000, dur: 0.012, gain: 0.15 }); };
  R.enemyShot = (d, t) => {
    A.tone(d, t, { type: 'square', f0: 950, f1: 230, dur: 0.12, gain: 0.2 });
    A.tone(d, t, { type: 'sawtooth', f0: 1900, f1: 480, dur: 0.08, gain: 0.1 });
    A.noise(d, t, { type: 'bandpass', f0: 2200, dur: 0.06, gain: 0.25 });
  };
  R.droneShot = (d, t) => { A.tone(d, t, { type: 'sawtooth', f0: 1700, f1: 800, dur: 0.07, gain: 0.16 }); A.noise(d, t, { type: 'highpass', f0: 3000, dur: 0.03, gain: 0.12 }); };
  R.heavyShot = (d, t) => { A.noise(d, t, { type: 'lowpass', f0: 2200, f1: 200, dur: 0.3, gain: 0.8 }); A.tone(d, t, { f0: 85, f1: 38, dur: 0.25, gain: 0.8 }); };
  R.rocket = (d, t) => { A.noise(d, t, { type: 'lowpass', f0: 1600, f1: 380, dur: 0.9, gain: 0.55 }); A.tone(d, t, { type: 'sawtooth', f0: 230, f1: 120, dur: 0.9, gain: 0.05, lp: 900 }); };
  R.explosion = (d, t) => {
    A.noise(d, t, { type: 'lowpass', f0: 4200, f1: 110, dur: 1.7, gain: 1.4, Q: 0.5 });
    A.tone(d, t, { f0: 78, f1: 22, dur: 1.1, gain: 1.35 });
    A.noise(d, t + 0.02, { type: 'bandpass', f0: 1300, f1: 500, dur: 1.0, gain: 0.35, Q: 0.7 });
    for (let i = 0; i < 6; i++) A.noise(d, t + 0.12 + Math.random() * 0.7, { type: 'highpass', f0: 2500 + Math.random() * 2500, dur: 0.03, gain: 0.08 + Math.random() * 0.1 });
  };
  R.impactConcrete = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1500 + Math.random() * 600, dur: 0.05, gain: 0.25, Q: 1.2 }); A.noise(d, t, { type: 'lowpass', f0: 600, dur: 0.08, gain: 0.14 }); };
  R.impactMetal = (d, t) => {
    A.noise(d, t, { type: 'highpass', f0: 2500, dur: 0.03, gain: 0.2 });
    A.tone(d, t, { f0: U.rand(2600, 4200), dur: 0.2, gain: 0.05 });
    A.tone(d, t, { f0: U.rand(5000, 6800), dur: 0.1, gain: 0.03 });
  };
  R.impactBot = (d, t) => { A.tone(d, t, { type: 'square', f0: 540, f1: 260, dur: 0.05, gain: 0.08 }); A.noise(d, t, { type: 'highpass', f0: 3500, dur: 0.04, gain: 0.2 }); A.tone(d, t, { f0: U.rand(1700, 2100), dur: 0.07, gain: 0.04 }); };
  R.hit = (d, t) => { A.tone(d, t, { f0: 1850, dur: 0.05, gain: 0.14 }); A.noise(d, t, { type: 'highpass', f0: 5000, dur: 0.015, gain: 0.08 }); };
  R.headshot = (d, t) => { A.tone(d, t, { f0: 2650, dur: 0.09, gain: 0.13 }); A.tone(d, t, { type: 'triangle', f0: 1320, dur: 0.14, gain: 0.1 }); };
  R.kill = (d, t) => { A.tone(d, t, { type: 'triangle', f0: 200, f1: 90, dur: 0.18, gain: 0.3 }); A.tone(d, t + 0.02, { f0: 1500, f1: 1250, dur: 0.16, gain: 0.09 }); };
  R.armorHit = (d, t) => { A.tone(d, t, { type: 'square', f0: 900, f1: 650, dur: 0.035, gain: 0.05 }); };
  R.step = (d, t, o) => {
    A.noise(d, t, { type: 'lowpass', f0: U.rand(650, 950), f1: 240, dur: 0.08, gain: 0.15 * (o.vol || 1), rate: U.rand(0.8, 1.2) });
    if (o.metal) A.noise(d, t + 0.005, { type: 'bandpass', f0: U.rand(2300, 3000), dur: 0.06, gain: 0.05 * (o.vol || 1), Q: 4 });
  };
  R.land = (d, t, o) => { A.noise(d, t, { type: 'lowpass', f0: 520, f1: 110, dur: 0.16, gain: 0.35 * (o.vol || 1) }); A.tone(d, t, { f0: 95, f1: 45, dur: 0.12, gain: 0.25 * (o.vol || 1) }); };
  R.jump = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1200, dur: 0.1, gain: 0.05 }); };
  R.slide = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1000, f1: 450, dur: 0.65, gain: 0.14, Q: 0.6, attack: 0.03 }); };
  R.mantle = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 800, dur: 0.18, gain: 0.12 }); A.noise(d, t + 0.18, { type: 'lowpass', f0: 500, dur: 0.1, gain: 0.2 }); };
  R.magOut = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1400, dur: 0.045, gain: 0.25, Q: 2 }); A.tone(d, t, { type: 'square', f0: 620, f1: 480, dur: 0.03, gain: 0.05 }); };
  R.magIn = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 2000, dur: 0.03, gain: 0.3, Q: 2 }); A.tone(d, t, { type: 'square', f0: 900, f1: 700, dur: 0.025, gain: 0.07 }); A.noise(d, t + 0.05, { type: 'highpass', f0: 3000, dur: 0.02, gain: 0.2 }); };
  R.bolt = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 2600, f1: 1800, dur: 0.07, gain: 0.3, Q: 2 }); A.tone(d, t + 0.08, { type: 'square', f0: 1200, f1: 800, dur: 0.03, gain: 0.07 }); A.noise(d, t + 0.08, { type: 'bandpass', f0: 3000, dur: 0.03, gain: 0.25, Q: 2 }); };
  R.pumpBack = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1100, dur: 0.07, gain: 0.35, Q: 1.5 }); };
  R.pumpFwd = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1500, dur: 0.06, gain: 0.35, Q: 1.5 }); A.tone(d, t, { type: 'square', f0: 700, dur: 0.02, gain: 0.06 }); };
  R.shellIn = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1800, dur: 0.04, gain: 0.25, Q: 2 }); A.tone(d, t, { type: 'square', f0: 500, f1: 400, dur: 0.02, gain: 0.05 }); };
  R.slide2 = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 2400, f1: 1600, dur: 0.05, gain: 0.25, Q: 2 }); };
  R.switch = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 900, dur: 0.12, gain: 0.08 }); A.tone(d, t + 0.08, { type: 'square', f0: 1400, dur: 0.02, gain: 0.05 }); };
  R.melee = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 400, f1: 1300, dur: 0.16, gain: 0.25, Q: 1.2 }); };
  R.meleeHit = (d, t) => { A.noise(d, t, { type: 'lowpass', f0: 900, dur: 0.1, gain: 0.5 }); A.tone(d, t, { f0: 130, f1: 60, dur: 0.12, gain: 0.5 }); R.impactBot(d, t); };
  R.throw = (d, t) => { A.tone(d, t, { type: 'square', f0: 2400, dur: 0.02, gain: 0.07 }); A.noise(d, t + 0.1, { type: 'bandpass', f0: 500, f1: 1400, dur: 0.18, gain: 0.2, Q: 1 }); };
  R.bounce = (d, t) => { A.tone(d, t, { f0: U.rand(800, 1000), dur: 0.06, gain: 0.08 }); A.noise(d, t, { type: 'bandpass', f0: 1500, dur: 0.04, gain: 0.12 }); };
  R.shell = (d, t) => { A.tone(d, t, { f0: U.rand(4200, 6200), dur: 0.07, gain: 0.03 }); A.tone(d, t + 0.05, { f0: U.rand(6500, 8000), dur: 0.04, gain: 0.015 }); };
  R.pickup = (d, t) => { [660, 880, 1320].forEach((f, i) => A.tone(d, t + i * 0.06, { type: 'triangle', f0: f, dur: 0.12, gain: 0.09 })); };
  R.ammo = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1500, dur: 0.05, gain: 0.2, Q: 2 }); A.noise(d, t + 0.09, { type: 'bandpass', f0: 1900, dur: 0.05, gain: 0.2, Q: 2 }); A.tone(d, t + 0.1, { type: 'triangle', f0: 520, f1: 780, dur: 0.15, gain: 0.07 }); };
  R.armor = (d, t) => { A.tone(d, t, { type: 'triangle', f0: 440, f1: 880, dur: 0.25, gain: 0.12 }); A.tone(d, t + 0.1, { f0: 1320, dur: 0.3, gain: 0.05 }); };
  R.weaponGet = (d, t) => { R.bolt(d, t); [392, 523, 784].forEach((f, i) => A.tone(d, t + 0.1 + i * 0.07, { type: 'triangle', f0: f, dur: 0.25, gain: 0.08 })); };
  R.objective = (d, t) => { [523.25, 659.25, 783.99].forEach((f) => A.tone(d, t, { f0: f, dur: 1.0, gain: 0.07, attack: 0.02 })); A.tone(d, t + 0.12, { f0: 1046.5, dur: 0.7, gain: 0.04 }); };
  R.fail = (d, t) => { [220, 207.65].forEach((f, i) => A.tone(d, t + i * 0.18, { type: 'triangle', f0: f, dur: 0.6, gain: 0.1 })); };
  R.radio = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 2200, dur: 0.09, gain: 0.12, Q: 2 }); A.tone(d, t, { f0: 1300, dur: 0.05, gain: 0.05 }); };
  R.radioOut = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 1800, dur: 0.07, gain: 0.1, Q: 2 }); };
  R.alert = (d, t) => { A.tone(d, t, { type: 'square', f0: 700, f1: 1400, dur: 0.07, gain: 0.12 }); A.tone(d, t + 0.08, { type: 'square', f0: 1400, f1: 800, dur: 0.09, gain: 0.1 }); };
  R.botDeath = (d, t) => {
    A.noise(d, t, { type: 'bandpass', f0: 3000, dur: 0.35, gain: 0.3, Q: 0.8 });
    A.tone(d, t, { type: 'sawtooth', f0: 520, f1: 40, dur: 0.7, gain: 0.2, lp: 2500 });
    A.noise(d, t + 0.05, { type: 'lowpass', f0: 2200, f1: 200, dur: 0.5, gain: 0.55 });
    A.tone(d, t + 0.05, { f0: 95, f1: 35, dur: 0.35, gain: 0.55 });
  };
  R.screech = (d, t) => { A.tone(d, t, { type: 'sawtooth', f0: 900, f1: 2300, dur: 0.35, gain: 0.1, lp: 3500 }); A.tone(d, t, { type: 'square', f0: 1150, f1: 2600, dur: 0.3, gain: 0.05, lp: 3500 }); };
  R.pounce = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 800, f1: 1700, dur: 0.2, gain: 0.2 }); };
  R.spawn = (d, t) => { A.tone(d, t, { f0: 200, f1: 1200, dur: 0.6, gain: 0.12, attack: 0.05 }); A.noise(d, t, { type: 'highpass', f0: 4000, dur: 0.6, gain: 0.07, attack: 0.1 }); A.tone(d, t + 0.55, { type: 'square', f0: 90, f1: 60, dur: 0.15, gain: 0.12 }); };
  R.hurt = (d, t) => { A.tone(d, t, { f0: 135, f1: 55, dur: 0.18, gain: 0.45 }); A.noise(d, t, { type: 'lowpass', f0: 650, dur: 0.12, gain: 0.35 }); };
  R.heartbeat = (d, t) => { A.tone(d, t, { f0: 64, f1: 40, dur: 0.12, gain: 0.5 }); A.tone(d, t + 0.19, { f0: 58, f1: 38, dur: 0.12, gain: 0.35 }); };
  R.whiz = (d, t) => { A.noise(d, t, { type: 'bandpass', f0: 3600, f1: 900, dur: 0.16, gain: 0.35, Q: 3 }); };
  R.door = (d, t) => { A.noise(d, t, { type: 'lowpass', f0: 420, dur: 1.9, gain: 0.3, attack: 0.1 }); A.tone(d, t, { type: 'sawtooth', f0: 52, f1: 46, dur: 1.9, gain: 0.06, lp: 400 }); A.noise(d, t + 1.95, { type: 'lowpass', f0: 800, dur: 0.2, gain: 0.5 }); A.tone(d, t + 1.95, { f0: 90, f1: 40, dur: 0.2, gain: 0.5 }); };
  R.breakerOn = (d, t) => { A.noise(d, t, { type: 'lowpass', f0: 900, dur: 0.15, gain: 0.55 }); A.tone(d, t, { f0: 95, f1: 40, dur: 0.22, gain: 0.5 }); A.tone(d, t + 0.1, { type: 'sawtooth', f0: 60, f1: 240, dur: 0.9, gain: 0.07, lp: 1200 }); };
  R.uiHover = (d, t) => { A.tone(d, t, { f0: 1800, dur: 0.03, gain: 0.03 }); };
  R.uiClick = (d, t) => { A.tone(d, t, { type: 'square', f0: 900, dur: 0.03, gain: 0.05 }); A.noise(d, t, { type: 'highpass', f0: 3000, dur: 0.02, gain: 0.05 }); };
  R.stomp = (d, t) => { A.tone(d, t, { f0: 58, f1: 20, dur: 1.0, gain: 1.4 }); A.noise(d, t, { type: 'lowpass', f0: 900, f1: 80, dur: 1.2, gain: 1.1 }); };
  R.roar = (d, t) => { A.tone(d, t, { type: 'sawtooth', f0: 92, f1: 55, dur: 1.8, gain: 0.3, lp: 700, attack: 0.1 }); A.tone(d, t, { type: 'sawtooth', f0: 95, f1: 57, dur: 1.8, gain: 0.25, lp: 700, attack: 0.1 }); A.noise(d, t, { type: 'lowpass', f0: 500, dur: 1.8, gain: 0.3, attack: 0.1 }); };
  R.laserCharge = (d, t) => { A.tone(d, t, { type: 'sawtooth', f0: 200, f1: 1200, dur: 1.0, gain: 0.1, lp: 3000, attack: 0.05 }); A.tone(d, t, { f0: 400, f1: 2400, dur: 1.0, gain: 0.05, attack: 0.05 }); };
  R.mortar = (d, t) => { A.noise(d, t, { type: 'lowpass', f0: 1300, f1: 300, dur: 0.4, gain: 0.6 }); A.tone(d, t, { f0: 125, f1: 60, dur: 0.3, gain: 0.6 }); };
  R.whistle = (d, t) => { A.tone(d, t, { f0: 2300, f1: 600, dur: 1.2, gain: 0.05, attack: 0.1 }); };
  R.spinUp = (d, t) => { A.tone(d, t, { type: 'sawtooth', f0: 60, f1: 420, dur: 0.8, gain: 0.07, lp: 2000, attack: 0.05 }); };
  R.shieldBreak = (d, t) => { R.explosion(d, t); A.tone(d, t, { type: 'square', f0: 1800, f1: 200, dur: 0.5, gain: 0.08, lp: 4000 }); };
  R.clank = (d, t) => { A.tone(d, t, { f0: U.rand(150, 220), f1: 140, dur: 1.6, gain: 0.05 }); A.noise(d, t, { type: 'bandpass', f0: U.rand(500, 900), dur: 0.08, gain: 0.08, Q: 3 }); };

  // Throttle: max plays of a given sound within a short window
  const LIMIT = { impactConcrete: 3, impactMetal: 3, impactBot: 3, shell: 2, step: 2, hit: 1, whiz: 2, enemyShot: 4, droneShot: 3, bounce: 2 };

  /**
   * play(name, pos?, opts?) — pos is a world position ({x,y,z}) for spatial sounds, omitted for first-person/UI.
   * opts: { vol, ui, send, ref, delay }
   */
  A.play = function (name, pos, opts) {
    if (!this.ready || !this.ctx) return;
    const fn = R[name]; if (!fn) return;
    opts = opts || {};
    const now = this.ctx.currentTime;
    const lim = LIMIT[name];
    if (lim) {
      const rec = this.lastPlay[name] || (this.lastPlay[name] = { t: 0, n: 0 });
      if (now - rec.t > 0.045) { rec.t = now; rec.n = 0; }
      if (rec.n >= lim) return;
      rec.n++;
    }
    let dest;
    if (pos) { dest = this.dest3D(pos, opts.ref, opts.vol); if (!dest) return; }
    else {
      dest = this.dest2D(opts.ui ? this.ui : this.sfx, opts.ui ? 0 : (opts.send != null ? opts.send : 0.35));
      if (opts.vol != null) dest.gain.value = opts.vol;
    }
    fn(dest, now + (opts.delay || 0) + 0.005, opts);
  };

  // ------------------------------------------------------------- loops
  A.loop = function (kind, pos) {
    if (!this.ready) return null;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = 0;
    const nodes = [];
    let freq = null;
    let target = this.sfx;
    if (pos) {
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 5; p.rolloffFactor = 1;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      p.connect(this.sfx); target = p;
    }
    out.connect(target);
    const noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(t, Math.random()); nodes.push(s); return s; };
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); nodes.push(o); return o; };
    if (kind === 'hum') {
      const o = osc('sawtooth', 70); const f = A.filter(out, 'lowpass', 600, 2); o.connect(f); freq = o.frequency;
      const o2 = osc('sine', 140); const g2 = ctx.createGain(); g2.gain.value = 0.5; o2.connect(g2); g2.connect(out);
    } else if (kind === 'beam') {
      const o = osc('sawtooth', 110); const f = A.filter(out, 'lowpass', 1400, 3); o.connect(f); freq = o.frequency;
      const n = noiseSrc(); const nf = A.filter(out, 'bandpass', 2400, 1.5); const ng = ctx.createGain(); ng.gain.value = 0.6; n.connect(ng); ng.connect(nf);
    } else if (kind === 'drone') {
      const a = osc('sawtooth', 180), b = osc('sawtooth', 184.5); const f = A.filter(out, 'bandpass', 420, 2.5); a.connect(f); b.connect(f); freq = a.frequency;
    } else if (kind === 'lava') {
      const n = noiseSrc(); const f = A.filter(out, 'lowpass', 260, 1); n.connect(f);
      const lfo = osc('sine', 0.35); const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency);
    } else if (kind === 'wind') {
      const n = noiseSrc(); const f = A.filter(out, 'bandpass', 420, 0.6); n.connect(f);
      const lfo = osc('sine', 0.06); const lg = ctx.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(f.frequency);
    } else if (kind === 'plant') {
      const a = osc('sine', 55), b = osc('sine', 110.6); const g = ctx.createGain(); g.gain.value = 0.6; a.connect(out); b.connect(g); g.connect(out);
    } else if (kind === 'rain') {
      const n = noiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
      const lp = A.filter(out, 'lowpass', 7500, 0.5); n.connect(hp); hp.connect(lp);
      const n2 = noiseSrc(); const bp = A.filter(out, 'bandpass', 380, 0.7); const g2 = ctx.createGain(); g2.gain.value = 0.7; n2.connect(g2); g2.connect(bp);
    } else if (kind === 'tinnitus') {
      const a = osc('sine', 3950); a.connect(out);
    }
    const ctl = {
      out, freq, dead: false,
      set(g, tc) { if (!this.dead) out.gain.setTargetAtTime(g, ctx.currentTime, tc || 0.08); },
      pitch(f, tc) { if (freq && !this.dead) freq.setTargetAtTime(f, ctx.currentTime, tc || 0.08); },
      stop() {
        if (this.dead) return; this.dead = true;
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
        setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); try { out.disconnect(); } catch (e) { /* ok */ } }, 500);
      }
    };
    return ctl;
  };

  A.startAmbience = function () {
    if (!this.ready || this.ambient) return;
    const wind = this.loop('wind'); wind.set(0.07, 1.5);
    const plant = this.loop('plant'); plant.set(0.025, 2);
    this.ambient = { wind, plant };
  };
  A.stopAmbience = function () {
    if (!this.ambient) return;
    this.ambient.wind.stop(); this.ambient.plant.stop(); this.ambient = null;
  };

  A.concuss = function (amount) {
    if (!this.ready) return;
    this.concussion = Math.min(1, this.concussion + amount);
    if (!this.tinnitus) this.tinnitus = this.loop('tinnitus');
  };

  // ------------------------------------------------------------- per-frame
  const _up = new THREE.Vector3();
  A.update = function (dt, camera) {
    if (!this.ready) return;
    const L = this.ctx.listener;
    if (camera) {
      camera.getWorldDirection(_f);
      _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const p = camera.position;
      this.lx = p.x; this.ly = p.y; this.lz = p.z;
      if (L.positionX) {
        L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
        L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z;
        L.upX.value = _up.x; L.upY.value = _up.y; L.upZ.value = _up.z;
      } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(_f.x, _f.y, _f.z, _up.x, _up.y, _up.z); }
    }
    // concussion: muffle + ringing that recovers
    if (this.concussion > 0.001) {
      this.concussion = Math.max(0, this.concussion - dt * 0.4);
      const c = this.concussion;
      this.muffle.frequency.setTargetAtTime(20000 * Math.pow(0.03, c), this.ctx.currentTime, 0.05);
      if (this.tinnitus) this.tinnitus.set(0.035 * c * c, 0.05);
    } else if (this.tinnitus) {
      this.muffle.frequency.setTargetAtTime(20000, this.ctx.currentTime, 0.2);
      this.tinnitus.stop(); this.tinnitus = null;
    }
    // distant industrial clanks
    if (this.ambient) {
      this.clankTimer -= dt;
      if (this.clankTimer <= 0) {
        this.clankTimer = U.rand(5, 14);
        const a = Math.random() * Math.PI * 2;
        this.play('clank', { x: this.lx + Math.cos(a) * 45, y: this.ly + 8, z: this.lz + Math.sin(a) * 45 }, { ref: 30 });
      }
    }
  };
})(window.CF);
