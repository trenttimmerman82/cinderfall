'use strict';
/* Cinderfall — adaptive procedural score. Layers enter as combat intensity rises (0..1). */
(function (CF) {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // D minor: Dm – Bb – Gm – A (two bars each)
  const CHORDS = [
    { root: 38, tones: [50, 53, 57, 62] },   // Dm
    { root: 34, tones: [46, 50, 53, 58] },   // Bb
    { root: 43, tones: [43 + 12, 46 + 12, 50 + 12, 55 + 12] }, // Gm
    { root: 45, tones: [45 + 12, 49 + 12, 52 + 12, 57 + 12] }  // A
  ];
  const BASS_PAT = [0, 0, 12, 0, 0, 7, 0, 12];   // per eighth, semitone offsets
  const ARP_PAT = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2];

  const M = CF.Music = {
    ctx: null, A: null, bus: null, lp: null, playing: false, timer: null,
    intensity: 0, target: 0, step: 0, nextTime: 0, bpm: 104, mode: 'menu', boss: false
  };

  M.init = function (A) {
    this.A = A; const ctx = this.ctx = A.ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 0;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000;
    this.bus.connect(this.lp); this.lp.connect(A.music);
    // echo for arps and stabs
    this.echoIn = ctx.createGain();
    const dl = ctx.createDelay(1.0); dl.delayTime.value = (60 / this.bpm) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2200;
    this.echoIn.connect(dl); dl.connect(df); df.connect(fb); fb.connect(dl); df.connect(this.bus);
    this.echoIn.connect(this.bus);
    // light reverb send
    this.rev = ctx.createGain(); this.rev.gain.value = 0.35; this.rev.connect(A.revSend);
  };

  M.start = function (mode) {
    if (!this.ctx) return;
    this.mode = mode || 'game';
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(1, t, 0.8);
    if (!this.playing) {
      this.playing = true; this.step = 0; this.nextTime = t + 0.12;
      this.timer = setInterval(() => this.schedule(), 40);
    }
  };
  M.stop = function (fade) {
    if (!this.ctx || !this.playing) return;
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(0, t, fade || 0.6);
    clearTimeout(this._stopT);
    this._stopT = setTimeout(() => { if (this.bus.gain.value < 0.05) { clearInterval(this.timer); this.playing = false; } }, (fade || 0.6) * 5000);
  };
  M.setIntensity = function (v) { this.target = Math.max(0, Math.min(1, v)); };
  M.setMuffled = function (m) { if (this.lp) this.lp.frequency.setTargetAtTime(m ? 650 : 20000, this.ctx.currentTime, 0.2); };

  M.schedule = function () {
    const ctx = this.ctx; if (!ctx) return;
    const k = this.target > this.intensity ? 0.035 : 0.012; // rise faster than fall
    this.intensity += (this.target - this.intensity) * k;
    const six = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.2) {
      if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05; // recover after tab stall
      this.playStep(this.step, this.nextTime, six);
      this.nextTime += six;
      this.step = (this.step + 1) % 128;
    }
  };

  M.playStep = function (s, t, six) {
    const I = this.mode === 'menu' ? 0.18 : this.intensity;
    const bar = Math.floor(s / 16), inBar = s % 16;
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    if (s % 32 === 0) this.pad(chord, t, six * 32, I);
    if (I > 0.28 && inBar % 2 === 0) {
      const e = (inBar / 2) | 0;
      if (I > 0.5 || e % 2 === 0) this.bass(chord.root + BASS_PAT[e], t, six * 1.8, I);
    }
    if (I > 0.45) {
      const accent = inBar % 4 === 2;
      if (I > 0.62 || inBar % 2 === 0) this.hat(t, accent ? 0.05 : 0.026, inBar === 14 && I > 0.7);
    }
    if (I > 0.5 && (inBar === 0 || inBar === 8 || (I > 0.8 && (inBar === 11 || inBar === 6 && bar % 2 === 1)))) this.kick(t);
    if (I > 0.6 && (inBar === 4 || inBar === 12)) this.snare(t);
    if (I > 0.74 || this.mode === 'menu' && inBar % 4 === 0 && bar % 2 === 0) {
      const note = chord.tones[ARP_PAT[inBar]] + (this.mode === 'menu' ? 0 : 12);
      this.arp(note, t, this.mode === 'menu' ? 0.018 : 0.022);
    }
    if (this.boss && I > 0.9 && inBar === 0) this.stab(chord, t);
    if (I > 0.35 && s % 64 === 60) this.riser(t, six * 4);
  };

  M.osc = function (type, f, t, dur, gain, dest, att, rel, detune) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + att);
    g.gain.setValueAtTime(gain, t + Math.max(att, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  };

  M.pad = function (chord, t, dur, I) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(420 + I * 1300, t);
    f.frequency.linearRampToValueAtTime(700 + I * 1800, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(420 + I * 1300, t + dur);
    f.connect(this.bus); f.connect(this.rev);
    const total = dur + 1.6;
    for (let i = 0; i < 3; i++) {
      const fr = mtof(chord.tones[i] - 12);
      this.osc('sawtooth', fr, t, total, 0.022, f, 1.4, 1.6, -7);
      this.osc('sawtooth', fr, t, total, 0.022, f, 1.4, 1.6, 7);
    }
    this.osc('sine', mtof(chord.root - 12 + 12), t, total, 0.075, this.bus, 1.0, 1.6);
  };

  M.bass = function (note, t, dur, I) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(900 + I * 700, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.14);
    f.connect(this.bus);
    this.osc('sawtooth', mtof(note), t, dur, 0.085, f, 0.005, dur * 0.7);
    this.osc('square', mtof(note - 12), t, dur, 0.04, f, 0.005, dur * 0.7);
  };

  M.kick = function (t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.35);
    this.A.noise(this.bus, t, { type: 'highpass', f0: 3000, dur: 0.008, gain: 0.08 });
  };
  M.snare = function (t) {
    this.A.noise(this.bus, t, { type: 'bandpass', f0: 1800, dur: 0.17, gain: 0.16, Q: 0.7 });
    this.A.noise(this.rev, t, { type: 'bandpass', f0: 1800, dur: 0.17, gain: 0.12, Q: 0.7 });
    this.A.tone(this.bus, t, { f0: 200, f1: 150, dur: 0.1, gain: 0.09 });
  };
  M.hat = function (t, gain, open) {
    this.A.noise(this.bus, t, { type: 'highpass', f0: 7200, dur: open ? 0.18 : 0.03, gain: gain });
  };
  M.arp = function (note, t, gain) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; f.connect(this.echoIn);
    this.osc('square', mtof(note), t, 0.13, gain, f, 0.004, 0.1);
  };
  M.stab = function (chord, t) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.4);
    f.connect(this.echoIn);
    for (let i = 0; i < 3; i++) this.osc('sawtooth', mtof(chord.tones[i]), t, 0.45, 0.03, f, 0.01, 0.3, (i - 1) * 6);
  };
  M.riser = function (t, dur) {
    this.A.noise(this.bus, t, { type: 'bandpass', f0: 400, f1: 5000, dur: dur, gain: 0.04 * this.intensity, Q: 2, attack: dur * 0.8 });
  };

  // One-shot musical cues
  M.sting = function (kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    if (kind === 'objective') {
      [62, 66, 69, 74].forEach((n, i) => this.osc('triangle', mtof(n), t + i * 0.05, 1.4, 0.04, this.echoIn, 0.02, 1.0));
    } else if (kind === 'death') {
      this.osc('sawtooth', mtof(26), t, 3, 0.1, this.bus, 0.05, 2.5, -10);
      this.osc('sawtooth', mtof(33), t, 3, 0.06, this.bus, 0.05, 2.5, 10);
      this.A.noise(this.bus, t, { type: 'lowpass', f0: 1200, f1: 80, dur: 2.5, gain: 0.3 });
    } else if (kind === 'victory') {
      [50, 54, 57, 62, 66, 69].forEach((n, i) => {
        this.osc('sawtooth', mtof(n), t + i * 0.08, 5, 0.025, this.bus, 1.2, 3, -6);
        this.osc('sawtooth', mtof(n), t + i * 0.08, 5, 0.025, this.bus, 1.2, 3, 6);
      });
    } else if (kind === 'boss') {
      this.osc('sawtooth', mtof(26), t, 4, 0.12, this.bus, 0.4, 2, -8);
      this.osc('sawtooth', mtof(27), t, 4, 0.08, this.bus, 0.4, 2, 8);
      this.A.noise(this.bus, t, { type: 'bandpass', f0: 200, f1: 3000, dur: 3.5, gain: 0.08, attack: 3 });
    }
  };
})(window.CF);
