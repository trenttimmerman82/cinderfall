'use strict';
/* Cinderfall — core namespace, math helpers, settings, input. */
window.CF = window.CF || {};
(function (CF) {
  const U = CF.U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.smoothstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  U.wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  U.gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  U.fmtTime = (s) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
  U.mulberry32 = (seed) => function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Window-of-time pulse: 0..1..0 over [a,b] of t
  U.pulse = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
  U.seg = (t, a, b) => U.clamp((t - a) / (b - a), 0, 1);

  U.nextFrame = () => new Promise((r) => {
    let done = false; const fin = () => { if (!done) { done = true; r(); } };
    requestAnimationFrame(() => setTimeout(fin, 0)); setTimeout(fin, 60);
  });

  // Critically-damped-ish spring (semi-implicit Euler)
  class Spring {
    constructor(k = 120, d = 14) { this.x = 0; this.v = 0; this.k = k; this.d = d; this.target = 0; }
    update(dt) { const f = -this.k * (this.x - this.target) - this.d * this.v; this.v += f * dt; this.x += this.v * dt; return this.x; }
    kick(v) { this.v += v; }
    reset() { this.x = 0; this.v = 0; }
  }
  U.Spring = Spring;

  // Tiny event bus
  const handlers = {};
  CF.on = (evt, fn) => { (handlers[evt] || (handlers[evt] = [])).push(fn); };
  CF.emit = (evt, a, b, c) => { const h = handlers[evt]; if (h) for (let i = 0; i < h.length; i++) h[i](a, b, c); };

  // ---------------------------------------------------------------- settings
  const DEFAULTS = {
    sens: 1.0, adsSens: 0.8, invertY: false,
    fov: 90, quality: 'high', shake: 1.0, showFps: false, dmgNumbers: true,
    master: 0.8, music: 0.55, sfx: 0.9, difficulty: 'veteran', noDrones: false,
    toggleCrouch: false, toggleSprint: false, aimMode: 'hold', viewBob: 1.0, crosshair: 'white', brightness: 1.0, grain: true
  };
  const KEY = 'cinderfall.settings.v1';
  function loadSettings() {
    let s = {};
    try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw) || {}; } catch (e) { s = {}; }
    const out = Object.assign({}, DEFAULTS);
    for (const k in DEFAULTS) if (k in s && typeof s[k] === typeof DEFAULTS[k]) out[k] = s[k];
    if (!['low', 'medium', 'high'].includes(out.quality)) out.quality = 'high';
    if (!['hold', 'toggle'].includes(out.aimMode)) out.aimMode = 'hold';
    return out;
  }
  CF.DEFAULTS = DEFAULTS;
  CF.settings = loadSettings();
  CF.bootQuality = CF.settings.quality; // quality in effect for this page load
  CF.saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(CF.settings)); } catch (e) { /* storage unavailable */ } };

  CF.DIFF = {
    recruit: { label: 'Recruit', dmg: 0.6, acc: 0.65, regenDelay: 3.0, regenRate: 38, aggro: 0.75, hp: 0.85, score: 0.8 },
    veteran: { label: 'Veteran', dmg: 1.0, acc: 1.0, regenDelay: 4.5, regenRate: 26, aggro: 1.0, hp: 1.0, score: 1.0 },
    elite: { label: 'Elite', dmg: 1.5, acc: 1.3, regenDelay: 6.0, regenRate: 18, aggro: 1.3, hp: 1.15, score: 1.4 }
  };
  if (!CF.DIFF[CF.settings.difficulty]) CF.settings.difficulty = CF.settings.difficulty === 'easy' ? 'recruit' : 'veteran'; // Easy was retired
  CF.diff = () => CF.DIFF[CF.settings.difficulty] || CF.DIFF.veteran;
  /** No drones: no Hornet drones in the campaign and no kill-streak drones anywhere. Multiplayer uses the host's choice. */
  CF.noDrones = () => (CF.Game && CF.Game.mode === 'mp' ? !!(CF.MP && CF.MP.noDrones) : !!CF.settings.noDrones);
  CF.diffLabel = () => CF.diff().label + (CF.settings.noDrones ? ' · No drones' : '');

  // ---------------------------------------------------------------- key bindings
  // Game code reads each action through its canonical code (the original default key);
  // the bindings translate whichever physical keys the player chose into that code.
  const ACTIONS = [
    { id: 'forward', label: 'Move forward', canon: 'KeyW', def: ['KeyW', 'ArrowUp'] },
    { id: 'back', label: 'Move back', canon: 'KeyS', def: ['KeyS', 'ArrowDown'] },
    { id: 'left', label: 'Strafe left', canon: 'KeyA', def: ['KeyA', 'ArrowLeft'] },
    { id: 'right', label: 'Strafe right', canon: 'KeyD', def: ['KeyD', 'ArrowRight'] },
    { id: 'jump', label: 'Jump · mantle', canon: 'Space', def: ['Space', null] },
    { id: 'crouch', label: 'Crouch · slide', canon: 'KeyC', def: ['KeyC', 'ControlLeft'] },
    { id: 'sprint', label: 'Sprint · steady scope', canon: 'ShiftLeft', def: ['ShiftLeft', null] },
    { id: 'aim', label: 'Aim · scope toggle (keyboard)', canon: 'KeyF', def: ['KeyQ', 'Tab'] },
    { id: 'reload', label: 'Reload', canon: 'KeyR', def: ['KeyR', null] },
    { id: 'interact', label: 'Interact', canon: 'KeyE', def: ['KeyE', null] },
    { id: 'grenade', label: 'Throw grenade', canon: 'KeyG', def: ['KeyG', null] },
    { id: 'melee', label: 'Melee', canon: 'KeyV', def: ['KeyF', 'Mouse3'] },
    { id: 'last', label: 'Last weapon', canon: 'KeyQ', def: ['KeyX', null] },
    { id: 'streak', label: 'Deploy drone (kill streak)', canon: 'KeyB', def: ['KeyZ', null] },
    { id: 'slot1', label: 'Weapon 1 · loadout 1', canon: 'Digit1', def: ['Digit1', null] },
    { id: 'slot2', label: 'Weapon 2 · loadout 2', canon: 'Digit2', def: ['Digit2', null] },
    { id: 'slot3', label: 'Weapon 3 · loadout 3', canon: 'Digit3', def: ['Digit3', null] },
    { id: 'slot4', label: 'Weapon 4 · loadout 4', canon: 'Digit4', def: ['Digit4', null] },
    { id: 'slot5', label: 'Weapon 5 · loadout 5', canon: 'Digit5', def: ['Digit5', null] },
    { id: 'slot6', label: 'Weapon 6 · loadout 6', canon: 'Digit6', def: ['Digit6', null] },
    { id: 'slot7', label: 'Weapon 7', canon: 'Digit7', def: ['Digit7', null] }
  ];
  const RESERVED = new Set(['Escape', 'KeyP', 'Mouse0', 'Mouse2', 'MetaLeft', 'MetaRight']);
  const BIND_KEY = 'cinderfall.binds.v2'; // v2: Q aims, F melees, X last weapon
  const Keys = CF.Keys = { actions: ACTIONS, reserved: RESERVED, binds: {}, map: {} };
  Keys.load = function () {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(BIND_KEY) || '{}') || {}; } catch (e) { saved = {}; }
    for (const a of ACTIONS) {
      const b = Array.isArray(saved[a.id]) ? saved[a.id] : a.def;
      this.binds[a.id] = [0, 1].map((i) => (typeof b[i] === 'string' && !RESERVED.has(b[i]) ? b[i] : null));
    }
    this.rebuild();
  };
  Keys.save = function () { try { localStorage.setItem(BIND_KEY, JSON.stringify(this.binds)); } catch (e) { /* storage unavailable */ } this.rebuild(); };
  Keys.rebuild = function () {
    this.map = {};
    for (const a of ACTIONS) for (const c of this.binds[a.id]) if (c) this.map[c] = a.canon;
    if (CF.onBindsChanged) CF.onBindsChanged();
  };
  /** Bind code to slot 0/1 of an action; a key can only do one thing, so it is taken from wherever else it was. */
  Keys.set = function (id, slot, code) {
    let moved = null;
    if (code) for (const a of ACTIONS) for (let i = 0; i < 2; i++) if (this.binds[a.id][i] === code && !(a.id === id && i === slot)) { this.binds[a.id][i] = null; moved = a; }
    this.binds[id][slot] = code;
    this.save();
    return moved;
  };
  Keys.reset = function () { for (const a of ACTIONS) this.binds[a.id] = a.def.slice(); this.save(); };
  const NAMES = { Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt',
    Tab: 'Tab', CapsLock: 'Caps', Enter: 'Enter', Backspace: 'Bksp', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Mouse1: 'Middle mouse', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5' };
  Keys.name = function (code) {
    if (!code) return '—';
    if (NAMES[code]) return NAMES[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
    return code.replace(/(Left|Right)$/, '');
  };
  /** Display name of the key an action is bound to (first binding), for on-screen prompts. */
  Keys.label = function (id) { const b = this.binds[id]; return this.name((b && (b[0] || b[1])) || null); };
  Keys.load();

  // ---------------------------------------------------------------- input
  const GAME_KEYS = new Set(['Space', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Quote', 'Slash']);
  const Input = CF.Input = {
    keys: new Set(), pressed: new Set(),
    mdown: [false, false, false], mpressed: [false, false, false], mreleased: [false, false, false],
    dx: 0, dy: 0, wheel: 0, locked: false, active: false, canvas: null, freeLook: false,
    onLockChange: null, lastLockExit: 0,
    init(canvas) {
      this.canvas = canvas;
      window.addEventListener('keydown', (e) => {
        if (this.capture) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.capture(e.code); return; }
        const canon = Keys.map[e.code];
        if (this.active && (canon || GAME_KEYS.has(e.code))) e.preventDefault();
        if (e.repeat || !canon) return;
        this.pressed.add(canon); // count every fresh press, even if a keyup was lost
        this.keys.add(canon);
      }, true);
      window.addEventListener('keyup', (e) => { const canon = Keys.map[e.code]; if (canon) this.keys.delete(canon); });
      window.addEventListener('blur', () => this.clearAll());
      document.addEventListener('mousedown', (e) => {
        if (this.capture) {
          if (e.button === 1 || e.button > 2) { e.preventDefault(); this.capture('Mouse' + e.button); }
          else if (!e.target.closest || !e.target.closest('.bind-key')) this.capture(null);
          return;
        }
        if (!this.active) return;
        if (e.button < 3) { this.mdown[e.button] = true; this.mpressed[e.button] = true; }
        const canon = Keys.map['Mouse' + e.button];
        if (canon) { e.preventDefault(); this.pressed.add(canon); this.keys.add(canon); }
      });
      document.addEventListener('mouseup', (e) => {
        if (e.button < 3) { if (this.mdown[e.button]) this.mreleased[e.button] = true; this.mdown[e.button] = false; }
        const canon = Keys.map['Mouse' + e.button];
        if (canon) this.keys.delete(canon);
        if (e.button > 2 && (this.active || canon)) e.preventDefault(); // keep side buttons from navigating back
      });
      document.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
      document.addEventListener('mousemove', (e) => {
        if (!this.active || !(this.locked || this.freeLook)) return;
        let mx = e.movementX || 0, my = e.movementY || 0;
        // Guard against the occasional huge spike some browsers emit on lock/unlock
        if (Math.abs(mx) > 400 || Math.abs(my) > 400) return;
        this.dx += mx; this.dy += my;
      });
      window.addEventListener('wheel', (e) => { if (this.active) { this.wheel += Math.sign(e.deltaY); } }, { passive: true });
      document.addEventListener('pointerlockchange', () => {
        const was = this.locked;
        this.locked = document.pointerLockElement === this.canvas;
        if (!this.locked && was) this.lastLockExit = performance.now();
        if (this.locked) this.freeLook = false;
        if (this.onLockChange) this.onLockChange(this.locked, was);
      });
      document.addEventListener('pointerlockerror', () => {
        if (this.onLockError) this.onLockError();
      });
    },
    requestLock() {
      const c = this.canvas;
      if (!c || !c.requestPointerLock) { if (this.onLockError) this.onLockError(); return; }
      try {
        const p = c.requestPointerLock({ unadjustedMovement: true });
        if (p && p.catch) p.catch(() => {
          try { const p2 = c.requestPointerLock(); if (p2 && p2.catch) p2.catch(() => { if (this.onLockError) this.onLockError(); }); }
          catch (e) { if (this.onLockError) this.onLockError(); }
        });
      } catch (e) {
        try { c.requestPointerLock(); } catch (e2) { if (this.onLockError) this.onLockError(); }
      }
    },
    exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ } },
    down(code) { return this.keys.has(code); },
    hit(code) { return this.pressed.has(code); },
    clearAll() {
      this.keys.clear(); this.pressed.clear();
      this.mdown = [false, false, false]; this.mpressed = [false, false, false]; this.mreleased = [false, false, false];
      this.dx = 0; this.dy = 0; this.wheel = 0;
    },
    endFrame() {
      this.pressed.clear();
      this.mpressed[0] = this.mpressed[1] = this.mpressed[2] = false;
      this.mreleased[0] = this.mreleased[1] = this.mreleased[2] = false;
      this.dx = 0; this.dy = 0; this.wheel = 0;
    }
  };

  // ---------------------------------------------------------------- misc
  CF.isTouch = () => (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && !window.matchMedia('(pointer: fine)').matches;
  CF.time = 0;      // game time (pauses with game)
  CF.realTime = 0;  // wall time
})(window.CF);
