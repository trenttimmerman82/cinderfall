'use strict';
/* Cinderfall — Battle Royale (multiplayer mode, Retail Row). Everyone rides the Battle Bus over the map, jumps out,
   skydives and glides down, loots guns (Common to Legendary), ammo, armor, med kits and frags off the floor and out
   of chests, and fights to be the last one standing while the storm closes in. No respawns once the bus leaves:
   eliminated players drop everything they carried and spectate.
   Before the bus there is a warm-up: free play with a pistol and respawns until enough players are in (two online;
   practice starts a few seconds after you deploy against the bots).
   The host runs the match: the countdown, the bus line, the storm circles, the loot seed and who took what, sent as
   'br' messages through the normal relay. Every client builds the same loot from the seed, flies its own skydive,
   takes its own storm damage and asks the host before it picks anything up. Placements follow the kill messages,
   which every client applies in the same order. Bots get their bus drop, looting and storm sense from here too. */
(function (CF) {
  const U = CF.U, W = CF.World, A = CF.Audio;
  const MP = () => CF.MP;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ tuning
  const READY = 20, READY_SOLO = 5;   // countdown before the bus: online (2+ players), practice (after you deploy)
  const BUS_Y = 105, BUS_SPEED = 17, BUS_HALF = 165, OPEN = 112; // bus height, speed, half its route, doors open while inside this square
  const FALL = 28, DIVE = 44, FALL_H = 13, DIVE_H = 18, GLIDE_V = 6, GLIDE_H = 11, DEPLOY = 30, KEEP_IN = 116;
  const SLOTS = 4;                    // guns you can carry
  const STORM = [                     // wait (s; the first counts from the bus), shrink (s), radius it shrinks to, damage per second outside
    { wait: 75, shrink: 45, r: 78, dps: 1 },
    { wait: 45, shrink: 35, r: 44, dps: 2 },
    { wait: 35, shrink: 30, r: 22, dps: 4 },
    { wait: 30, shrink: 25, r: 9, dps: 7 },
    { wait: 20, shrink: 25, r: 0, dps: 10 }
  ];
  const RAR = [
    { name: 'Common', css: '#c4cad2', c: [1.1, 1.15, 1.2], mul: 1 },
    { name: 'Uncommon', css: '#62d75c', c: [0.4, 2.2, 0.4], mul: 1.05 },
    { name: 'Rare', css: '#3fa0ff', c: [0.35, 1.2, 3.2], mul: 1.1 },
    { name: 'Epic', css: '#bb66ff', c: [1.9, 0.5, 3.4], mul: 1.16 },
    { name: 'Legendary', css: '#ffb12a', c: [3.4, 1.6, 0.2], mul: 1.22 }
  ];
  const MAXMUL = RAR[RAR.length - 1].mul;
  // what turns up: weapon, weight, lowest and highest rarity
  const POOL = [['carbine', 14, 0, 4], ['shotgun', 11, 1, 4], ['wasp', 9, 0, 2], ['tempo', 7, 0, 2], ['revolver', 5, 1, 3], ['magnum', 4, 2, 3], ['sawnoff', 5, 0, 1],
    ['rail', 4, 2, 4], ['lmg', 3, 2, 3], ['minigun', 2, 3, 4], ['rocket', 2, 3, 4], ['flamer', 2, 2, 3], ['arc', 2, 1, 2], ['pip', 2, 2, 3]];
  const ROLL = { floor: [46, 30, 16, 6, 2], chest: [8, 34, 34, 17, 7] };
  const KIT = () => ({ label: 'Battle Royale', weapons: { pistol: { mag: 12, reserve: 24 } }, current: 'pistol', grenades: 0, armor: 0, speed: 1 });
  const ITEM = { ammo: 'Ammo box', armor: 'Armor plate', med: 'Med kit', frag: 'Frag grenades' };
  const BOT_RANK = { carbine: 6, lmg: 6, minigun: 5, shotgun: 5, rail: 4, tempo: 4, wasp: 4, magnum: 4, revolver: 3, flamer: 3, arc: 3, sawnoff: 2, pistol: 1 }; // bots skip rockets and grenade pistols

  const BR = CF.BR = {
    phase: 'wait', t: 0, clock: 0, seed: 0, bus: null, circles: null, roster: [], alive: new Set(), place: {}, items: new Map(), chests: [], nextId: 50000,
    fl: 0, vel: new THREE.Vector3(), flyT: 0, gy: 0, gT: 0, hold: 0, want: {}, spec: null, specT: 0, tick: 0, out: false, mapOpen: false, endT: 0,
    RAR, STORM, MAXMUL, SLOTS
  };
  BR.on = () => MP().active && MP().mode === 'br';
  /** The match proper: the bus has left the lobby. */
  BR.match = () => BR.on() && (BR.phase === 'bus' || BR.phase === 'storm');
  BR.canRespawn = () => !BR.on() || BR.phase === 'wait' || BR.phase === 'ready';
  /** On the bus or in the air: no weapons. */
  BR.busy = () => BR.on() && BR.fl > 0;
  BR.noRegen = () => BR.match();
  BR.kit = KIT;
  /** Movement the anticheat should let through: riding the bus and dropping from it. */
  BR.airOK = () => BR.match() && BR.clock < BR.busDur + 60;

  // ------------------------------------------------------------ deterministic loot
  function rollWeapon(rnd, table) {
    let tot = 0; for (const p of POOL) tot += p[1];
    let k = rnd() * tot, w = POOL[0];
    for (const p of POOL) { k -= p[1]; if (k <= 0) { w = p; break; } }
    const rt = ROLL[table]; let s = 0; for (const v of rt) s += v;
    let q = rnd() * s, r = 0;
    for (let i = 0; i < rt.length; i++) { q -= rt[i]; if (q <= 0) { r = i; break; } }
    return { w: w[0], r: U.clamp(r, w[2], w[3]) };
  }
  const D = () => CF.Weapons.defs;
  /** Spare rounds that come with a gun off the floor. */
  function spare(w) { const d = D()[w]; return d.rocket || d.pip ? 2 : Math.min(d.maxReserve, Math.round(d.mag * (d.mag > 40 ? 1 : 2))); }
  /** Rounds an ammo box adds to a gun. */
  function boxAmmo(d) { return d.rocket ? 2 : d.mag > 60 ? Math.round(d.mag * 0.6) : Math.max(8, d.mag); }
  function mk(i, k, o, x, y, z) { return Object.assign({ i, k, w: null, r: 0, mag: 0, res: 0, n: 0, p: new THREE.Vector3(x, y, z), gone: false, mesh: null, t: (i * 0.37) % 6, req: -9 }, o); }
  function weaponItem(i, rnd, table, x, y, z) {
    const g = rollWeapon(rnd, table), d = D()[g.w];
    return mk(i, 'w', { w: g.w, r: g.r, mag: d.mag, res: spare(g.w) }, x, y, z);
  }
  function smallItem(i, rnd, x, y, z, bias) {
    const q = rnd() + (bias || 0);
    if (q < 0.4) return mk(i, 'ammo', { n: 1 }, x, y, z);
    if (q < 0.66) return mk(i, 'armor', { n: rnd() < 0.65 ? 25 : 50 }, x, y, z);
    if (q < 0.88) return mk(i, 'med', { n: rnd() < 0.6 ? 25 : 50 }, x, y, z);
    return mk(i, 'frag', { n: 2 }, x, y, z);
  }
  /** Every client builds the same floor loot from the seed. Ids: 2 per spot (a gun and the ammo beside it). */
  function genFloor(seed) {
    const L = CF.Level, rnd = U.mulberry32(seed), out = [];
    (L.points.loot || []).forEach((s, n) => {
      const roll = rnd(), ox = (rnd() - 0.5) * 0.6, oz = (rnd() - 0.5) * 0.6;
      if (roll > 0.82) return; // empty spot
      if (roll < 0.5) {
        out.push(weaponItem(n * 2, rnd, 'floor', s[0] + ox, s[1], s[2] + oz));
        out.push(mk(n * 2 + 1, 'ammo', { n: 1 }, s[0] + ox + 0.8, s[1], s[2] + oz + 0.3));
      } else out.push(smallItem(n * 2, rnd, s[0] + ox, s[1], s[2] + oz));
    });
    return out;
  }
  /** A chest's contents (also from the seed): a better gun, plus one or two other things. Ids 10000 + 8 per chest. */
  function chestItems(c) {
    const ch = BR.chests[c], rnd = U.mulberry32((BR.seed ^ (c * 7919 + 17)) >>> 0), base = 10000 + c * 8, out = [];
    const fx = -Math.sin(ch.yaw), fz = -Math.cos(ch.yaw), rx = Math.cos(ch.yaw), rz = -Math.sin(ch.yaw); // in front of the chest
    const at = (k, s) => [ch.x + fx * (1.1 + k * 0.1) + rx * s, ch.y, ch.z + fz * (1.1 + k * 0.1) + rz * s];
    let p = at(0, 0); out.push(weaponItem(base, rnd, 'chest', p[0], p[1], p[2]));
    p = at(1, -0.9); out.push(smallItem(base + 1, rnd, p[0], p[1], p[2]));
    p = at(1, 0.9); if (rnd() < 0.55) out.push(mk(base + 2, 'ammo', { n: 1 }, p[0], p[1], p[2])); else out.push(smallItem(base + 2, rnd, p[0], p[1], p[2], 0.25));
    return out;
  }
  /** A gun as its rarity: more damage (shown on its name and colour). */
  const RDEF = {};
  BR.rdef = function (w, r) {
    const base = D()[w];
    if (!r) return base;
    const key = w + r; if (RDEF[key]) return RDEF[key];
    const R = RAR[r], d = Object.assign({}, base, { rar: r, rarCss: R.css, name: R.name + ' ' + base.name, dmg: base.dmg * R.mul });
    if (base.rocket) d.rocket = Object.assign({}, base.rocket, { damage: base.rocket.damage * R.mul });
    return (RDEF[key] = d);
  };

  // ------------------------------------------------------------ models: loot, chests, the bus, the storm, gliders
  const M = {};
  function mats() {
    if (M.ok) return M;
    M.ok = true;
    const T = CF.Tex.list;
    M.ammo = new THREE.MeshStandardMaterial({ color: 0x4a6a3a, metalness: 0.4, roughness: 0.55 });
    M.ammoBand = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 3.0, 0.5) });
    M.plate = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, metalness: 0.6, roughness: 0.35 });
    M.plateGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 4.2) });
    M.med = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, metalness: 0.1, roughness: 0.4 });
    M.cross = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 0.3, 0.3) });
    M.rings = RAR.map((R) => new THREE.MeshBasicMaterial({ map: T.ring, color: new THREE.Color(R.c[0], R.c[1], R.c[2]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    M.beams = RAR.map((R) => new THREE.MeshBasicMaterial({ map: T.beam, color: new THREE.Color(R.c[0] * 0.4, R.c[1] * 0.4, R.c[2] * 0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    M.wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.7, metalness: 0 });
    M.gold = new THREE.MeshStandardMaterial({ color: 0xf2c040, metalness: 0.9, roughness: 0.25, emissive: 0x4a3008 });
    M.chestGlow = new THREE.SpriteMaterial({ map: T.glow, color: new THREE.Color(2.4, 1.7, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    M.box = new THREE.BoxGeometry(1, 1, 1); M.plane = new THREE.PlaneGeometry(1.4, 1.4); M.beamGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true);
    return M;
  }
  /** Bake a model's parts into one mesh per material (a gun model is dozens of parts; loot shows a lot of guns). */
  function merged(root) {
    root.updateMatrixWorld(true);
    const groups = new Map(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh || !o.visible || o.matrixWorld.elements.some((e) => !isFinite(e))) return; // (a few viewmodel helpers have no real transform)
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
      let e = groups.get(o.material); if (!e) groups.set(o.material, e = { pos: [], nrm: [], uv: [] });
      nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); e.pos.push(v.x, v.y, v.z);
        if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); e.nrm.push(v.x, v.y, v.z); } else e.nrm.push(0, 1, 0);
        if (UV) e.uv.push(UV.getX(i), UV.getY(i)); else e.uv.push(0, 0);
      }
    });
    const out = new THREE.Group();
    for (const [mat, e] of groups) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(e.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(e.nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(e.uv, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.castShadow = true; out.add(m);
    }
    return out;
  }
  const TPL = {};
  function gunModel(w) {
    if (!TPL[w]) TPL[w] = merged(CF.VM.build(w, false).root);
    return TPL[w].clone(true);
  }
  function itemMesh(it) {
    const m = mats(), g = new THREE.Group(), item = new THREE.Group(); g.add(item);
    const box = (mat, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(m.box, mat); o.scale.set(sx, sy, sz); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; item.add(o); return o; };
    if (it.k === 'w') { const v = gunModel(it.w); v.scale.setScalar(1.25); v.position.z = 0.25; item.add(v); }
    else if (it.k === 'ammo') { box(m.ammo, 0.42, 0.26, 0.3); box(m.ammoBand, 0.43, 0.05, 0.305); }
    else if (it.k === 'armor') { const s = it.n >= 50 ? 1 : 0.75; box(m.plate, 0.44 * s, 0.52 * s, 0.07 * s); box(m.plateGlow, 0.3 * s, 0.05 * s, 0.075 * s, 0, 0.1 * s); box(m.plateGlow, 0.3 * s, 0.05 * s, 0.075 * s, 0, -0.06 * s); }
    else if (it.k === 'med') { const s = it.n >= 50 ? 1 : 0.72; box(m.med, 0.42 * s, 0.3 * s, 0.22 * s); box(m.cross, 0.24 * s, 0.07 * s, 0.225 * s); box(m.cross, 0.07 * s, 0.2 * s, 0.225 * s); }
    else { if (!TPL.frag) TPL.frag = merged(CF.VM.grenadeWorld()); const a = TPL.frag.clone(true); a.scale.setScalar(1.6); item.add(a); const b = TPL.frag.clone(true); b.scale.setScalar(1.6); b.position.set(0.16, -0.02, 0.05); item.add(b); }
    item.position.y = 0.55;
    const rar = it.k === 'w' ? it.r : 0;
    const ring = new THREE.Mesh(m.plane, m.rings[rar]); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.renderOrder = 4; g.add(ring);
    if (it.k === 'w') { const beam = new THREE.Mesh(m.beamGeo, m.beams[rar]); beam.scale.set(1, 2.6, 1); beam.position.y = 1.3; beam.renderOrder = 5; g.add(beam); }
    g.position.copy(it.p); CF.Game.scene.add(g);
    it.mesh = g; it.item = item;
  }
  function chestMesh(ch) {
    const m = mats();
    if (!TPL.chest) {
      const base = new THREE.Group(), top = new THREE.Group(), add = (par, mat, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(m.box, mat); o.scale.set(sx, sy, sz); o.position.set(x, y, z); par.add(o); };
      add(base, m.wood, 0.95, 0.5, 0.6, 0, 0.25, 0); for (const x of [-0.38, 0.38]) add(base, m.gold, 0.07, 0.52, 0.62, x, 0.26, 0); add(base, m.gold, 0.16, 0.16, 0.04, 0, 0.42, -0.31);
      add(top, m.wood, 0.95, 0.2, 0.6, 0, 0.1, -0.3); for (const x of [-0.38, 0.38]) add(top, m.gold, 0.07, 0.22, 0.62, x, 0.1, -0.3);
      TPL.chest = merged(base); TPL.lid = merged(top);
    }
    const g = TPL.chest.clone(true), lid = new THREE.Group(); lid.position.set(0, 0.5, 0.3); lid.add(TPL.lid.clone(true)); g.add(lid);
    const glow = new THREE.Sprite(m.chestGlow); glow.scale.set(2.2, 1.6, 1); glow.position.y = 0.6; g.add(glow);
    g.position.set(ch.x, ch.y, ch.z); g.rotation.y = ch.yaw;
    CF.Game.scene.add(g);
    ch.mesh = g; ch.lid = lid; ch.glow = glow;
  }
  function busModel() {
    const g = new THREE.Group(), box = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(1, 24, 16);
    const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.3, roughness: 0.45 }, o || {}));
    const blue = std(0x2a7ad8), white = std(0xf2f2ee), dark = std(0x1a2230, { metalness: 0.8, roughness: 0.2 }), yellow = std(0xffc21a), rub = std(0x181818, { roughness: 0.9 });
    const add = (mat, geo, sx, sy, sz, x, y, z, par) => { const o = new THREE.Mesh(geo, mat); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; (par || g).add(o); return o; };
    // the bus (long axis along -Z, the way it flies)
    add(blue, box, 2.6, 2.4, 9, 0, 0, 0); add(white, box, 2.62, 0.5, 9.02, 0, 1.25, 0); add(dark, box, 2.64, 0.8, 7.4, 0, 0.45, 0.6);
    add(dark, box, 2.3, 0.9, 0.1, 0, 0.55, -4.52); add(yellow, box, 2.66, 0.12, 9.04, 0, -0.35, 0); add(dark, box, 2.4, 0.5, 0.2, 0, -0.9, -4.55);
    for (const z of [-3, 3]) for (const x of [-1.25, 1.25]) { const w = add(rub, new THREE.CylinderGeometry(0.55, 0.55, 0.35, 16), 1, 1, 1, x, -1.25, z); w.rotation.z = Math.PI / 2; }
    // the balloon, its stripes, the ropes, the burner and the propeller
    add(blue, sph, 5.5, 6.2, 5.5, 0, 10.5, 0); add(yellow, sph, 5.56, 1.0, 5.56, 0, 10.5, 0); add(white, sph, 5.6, 0.5, 5.6, 0, 8.4, 0);
    for (const [x, z] of [[-1.2, -4], [1.2, -4], [-1.2, 4], [1.2, 4]]) { const p = new THREE.Vector3(x, 1.4, z), q = new THREE.Vector3(x * 2.4, 6.4, z * 0.8), len = p.distanceTo(q); const r = add(dark, new THREE.CylinderGeometry(0.04, 0.04, 1, 6), 1, len, 1, (p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2); r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize()); }
    const flame = add(new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.6, 0.5) }), new THREE.ConeGeometry(0.4, 1.3, 10), 1, 1, 1, 0, 4.8, 0); flame.rotation.x = Math.PI;
    const prop = new THREE.Group(); prop.position.set(0, 0.3, 4.75); g.add(prop);
    for (let i = 0; i < 3; i++) { const b = add(dark, box, 0.3, 2.4, 0.06, 0, 0, 0, prop); b.rotation.z = i * Math.PI / 3 * 2; b.position.set(Math.sin(i * 2.094) * 0.6, Math.cos(i * 2.094) * 0.6, 0); }
    g.userData = { prop, flame }; g.visible = false;
    return g;
  }
  function stormMesh() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; varying vec3 vW; ' +
        'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } ' +
        'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); } ' +
        'void main(){ vec2 p = vec2(vUv.x * 60.0, vW.y * 0.05); float s = n(p + vec2(uTime * 0.25, -uTime * 0.6)) * 0.6 + n(p * 2.3 + vec2(-uTime * 0.4, -uTime * 0.9)) * 0.4; ' +
        'float a = 0.2 + s * 0.26; a *= smoothstep(-40.0, 5.0, vW.y) * (1.0 - smoothstep(140.0, 260.0, vW.y)); ' +
        'vec3 c = mix(vec3(0.32, 0.1, 0.62), vec3(0.85, 0.45, 1.25), s); gl_FragColor = vec4(c, a); }'
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 320, 96, 1, true), mat);
    m.position.y = 110; m.renderOrder = 6; m.frustumCulled = false; m.visible = false;
    return m;
  }
  /** Glider canopy: hangs over a skydiver once it opens. */
  function gliderMesh(css) {
    const g = new THREE.Group(), col = new THREE.Color(css || '#ffb12a');
    const wing = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), wing);
    canopy.scale.set(1.5, 0.32, 0.62); canopy.position.y = 2.75; canopy.castShadow = true; g.add(canopy);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 32), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }));
    trim.rotation.x = Math.PI / 2; trim.scale.set(1.5, 0.62, 1); trim.position.y = 2.75; g.add(trim);
    const line = new THREE.MeshBasicMaterial({ color: 0x222222 }), up = new THREE.Vector3(0, 1, 0);
    for (const [x, z] of [[-1.3, -0.3], [1.3, -0.3], [-1.3, 0.3], [1.3, 0.3]]) {
      const a = new THREE.Vector3(x * 0.25, 1.75, 0), b = new THREE.Vector3(x, 2.75, z), l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, a.distanceTo(b), 4), line);
      l.position.copy(a).add(b).multiplyScalar(0.5); l.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); g.add(l);
    }
    return g;
  }
  /** Pose an operative for the drop: belly-down in free fall, hanging under the glider once it is open. */
  BR.pose = function (m, root, fl, t) {
    const p = m.p;
    if (fl === 1) {
      root.rotation.x = -1.25; p.hips.position.y = 0.95;
      p.armL.rotation.set(-0.3, 0, -1.3 + Math.sin(t * 9) * 0.06); p.armR.rotation.set(-0.3, 0, 1.3 - Math.sin(t * 9 + 1) * 0.06); p.foreL.rotation.x = -0.3; p.foreR.rotation.x = -0.3;
      p.legL.rotation.x = 0.35; p.legR.rotation.x = 0.35; p.kneeL.rotation.x = 0.6; p.kneeR.rotation.x = 0.6; p.torso.rotation.x = 0; p.head.rotation.x = -0.6;
    } else if (fl === 2) {
      root.rotation.x = 0; p.hips.position.y = 0.95;
      p.armL.rotation.set(2.9, 0, -0.35); p.armR.rotation.set(2.9, 0, 0.35); p.foreL.rotation.x = 0; p.foreR.rotation.x = 0;
      p.legL.rotation.x = 0.15 + Math.sin(t * 3) * 0.1; p.legR.rotation.x = 0.15 - Math.sin(t * 3) * 0.1; p.kneeL.rotation.x = 0.2; p.kneeR.rotation.x = 0.2;
    }
  };
  /** Remote players' drop state rides in their position updates (fl: 1 falling, 2 gliding, 3 on the bus). */
  BR.applyRemote = function (r, s) { r.fl = BR.on() ? +s.fl || 0 : 0; };
  BR.updateRemote = function (r) {
    if (!r.fl) { if (r.glider) r.glider.visible = false; return; }
    if (r.fl === 3) { r.root.visible = false; return; }
    if (!r.dead) r.root.visible = true;
    BR.pose(r.m, r.root, r.fl, CF.time + (r.phase || 0));
    if (!r.glider) { r.glider = gliderMesh(r.css); r.root.add(r.glider); }
    r.glider.visible = r.fl === 2;
    r.tag.visible = false;
    r.root.updateMatrixWorld(true); r.cacheHits();
  };

  // ------------------------------------------------------------ setup / teardown
  BR.setup = function () {
    BR.clear();
    const L = CF.Level, s = CF.Game.scene;
    BR.openSpots = null;
    BR.chests = (L.points.chests || []).map((c, i) => ({ i, x: c[0], y: c[1], z: c[2], yaw: c[3], open: false, openT: 0 }));
    BR.busMesh = busModel(); s.add(BR.busMesh);
    BR.storm = stormMesh(); s.add(BR.storm);
    BR.self = MP().buildOperative([5, 3.4, 0.6]); BR.self.root.visible = false; BR.self.root.rotation.order = 'YXZ'; s.add(BR.self.root);
    CF.Skins.dress(BR.self, CF.Skins.get(CF.Profile.equipped('p')) ? CF.Profile.equipped('p') : null);
    BR.self.glider = gliderMesh('#ffb12a'); BR.self.root.add(BR.self.glider);
    BR.reset(true);
    $('brHud').hidden = false;
    BR.renderMapImage();
  };
  BR.clear = function () {
    const s = CF.Game.scene;
    for (const it of BR.items.values()) if (it.mesh && s) s.remove(it.mesh);
    for (const ch of BR.chests) if (ch.mesh && s) s.remove(ch.mesh);
    if (BR.busMesh && s) s.remove(BR.busMesh);
    if (BR.storm && s) s.remove(BR.storm);
    if (BR.self && s) s.remove(BR.self.root);
    BR.items = new Map(); BR.chests = []; BR.busMesh = null; BR.storm = null; BR.self = null;
    BR.stopLoops(); BR.setFl(0); BR.setOut(false); BR.closeMap();
    const ids = ['brHud', 'brBanner', 'brBig']; for (const id of ids) { const e = $(id); if (e) e.hidden = true; }
    document.body.classList.remove('br-spec', 'br-air');
  };
  /** Back to the warm-up (a fresh match or the host's Play again). */
  BR.reset = function (quiet) {
    const s = CF.Game.scene;
    for (const it of BR.items.values()) if (it.mesh && s) s.remove(it.mesh);
    BR.items = new Map(); BR.want = {}; BR.nextId = 50000;
    for (const ch of BR.chests) { ch.open = false; ch.openT = 0; if (!ch.mesh) chestMesh(ch); ch.mesh.visible = false; ch.lid.rotation.x = 0; ch.glow.visible = true; }
    BR.phase = 'wait'; BR.t = 0; BR.clock = 0; BR.seed = 0; BR.bus = null; BR.circles = null; BR.roster = []; BR.alive = new Set(); BR.place = {};
    BR.spec = null; BR.endT = 0; BR.out = false; BR.hold = 0;
    if (BR.busMesh) BR.busMesh.visible = false;
    if (BR.storm) BR.storm.visible = false;
    if (CF.Player.ride) CF.Player.ride = null;
    BR.setFl(0); BR.setOut(false);
    document.body.classList.remove('br-spec');
    $('brBanner').hidden = true;
    if (!quiet) CF.HUD.interact(null);
  };

  // ------------------------------------------------------------ host: running the match
  function send(msg) { msg.t = 'br'; CF.Net.broadcast(msg); BR.apply(msg); }
  BR.snap = (full) => {
    const o = { op: 'sync', p: BR.phase, s: Math.ceil(BR.t), c: +BR.clock.toFixed(2), al: [...BR.alive] };
    if (full && BR.match()) {
      Object.assign(o, { seed: BR.seed, bus: BR.bus, circles: BR.circles, roster: BR.roster, place: BR.place, opened: BR.chests.filter((c) => c.open).map((c) => c.i) });
      o.gone = []; o.extra = [];
      for (const it of BR.items.values()) { if (it.gone) o.gone.push(it.i); else if (it.i >= 50000) o.extra.push(wire(it)); }
    }
    return o;
  };
  function setPhase(p, s) { send({ op: 'phase', p, s }); }
  function hostUpdate(dt) {
    const M = MP(); if (M.ended) return;
    const n = Object.keys(M.players).length;
    if (BR.phase === 'wait') {
      if (M.solo) { if (!CF.Game.mpLobby && n >= 2) setPhase('ready', READY_SOLO); }
      else if (n >= 2) setPhase('ready', READY);
    } else if (BR.phase === 'ready') {
      if (n < 2) setPhase('wait', 0);
      else if (BR.t <= 0) start();
    } else if (BR.phase === 'bus' && BR.clock >= BR.busDur) setPhase('storm', 0);
    // the storm on the bots (people take it on their own machines)
    if (BR.match()) {
      BR.tick -= dt;
      if (BR.tick <= 0) {
        BR.tick = 1;
        const st = BR.stormNow();
        for (const b of CF.Bots.list) {
          if (!b.alive || b.fl === 3 || BR.inside(b.body.pos, st)) continue;
          b.hp -= st.dps;
          if (b.hp <= 0) { b.hp = 0; const lh = b.lastHit, recent = lh && CF.time - lh.t < 8; M.onHostMsg(b.id, { t: 'died', killer: recent ? lh.by : null, w: recent ? lh.w : 'storm', head: 0 }); }
        }
      }
    }
  }
  function start() {
    const M = MP(), L = CF.Level, br = L.points.br || { size: 110, center: [0, 0] };
    const seed = (Math.random() * 0x7fffffff) | 0, rnd = U.mulberry32(seed);
    // the bus crosses the map on a random heading, a little off the middle
    const a = rnd() * Math.PI * 2, off = (rnd() - 0.5) * 60, dx = Math.cos(a), dz = Math.sin(a), cx = br.center[0] - dz * off, cz = br.center[1] + dx * off;
    const bus = [+(cx - dx * BUS_HALF).toFixed(1), +(cz - dz * BUS_HALF).toFixed(1), +(cx + dx * BUS_HALF).toFixed(1), +(cz + dz * BUS_HALF).toFixed(1)];
    // the storm circles: each inside the one before, the late ones near the middle of town
    let x = br.center[0], z = br.center[1], r = 185;
    const circles = [[x, z, r]];
    for (const s of STORM) {
      const room = Math.max(0, r - s.r) * 0.85;
      let nx = x, nz = z;
      for (let tries = 0; tries < 40; tries++) {
        const ang = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * room;
        nx = x + Math.cos(ang) * d; nz = z + Math.sin(ang) * d;
        if (Math.abs(nx) + s.r < br.size - 6 && Math.abs(nz) + s.r < br.size - 6 && (s.r > 50 || Math.hypot(nx - br.center[0], nz - br.center[1]) < 75)) break;
        nx = x; nz = z;
      }
      x = nx; z = nz; r = s.r; circles.push([+x.toFixed(1), +z.toFixed(1), r]);
    }
    send({ op: 'start', seed, bus, circles, roster: Object.keys(M.players) });
  }
  /** Host: a message from a player (or from this machine). */
  BR.onHost = function (from, msg) {
    if (!BR.on()) return;
    if (msg.op === 'take') {
      const it = BR.items.get(+msg.i);
      if (!it || it.gone || !BR.alive.has(from)) return;
      send({ op: 'gone', i: it.i, by: from });
    } else if (msg.op === 'open') {
      const ch = BR.chests[+msg.c];
      if (!ch || ch.open || !BR.match()) return;
      send({ op: 'open', c: ch.i, by: from });
    } else if (msg.op === 'drop') {
      if (!Array.isArray(msg.items) || !Array.isArray(msg.p) || msg.items.length > 10) return;
      BR.hostDrop(msg.items, msg.p);
    }
  };
  /** Host: put things on the floor around p (dropped guns, an eliminated player's loot). */
  BR.hostDrop = function (list, p) {
    const out = [];
    list.forEach((o, n) => {
      if (!o || !ITEM[o.k] && o.k !== 'w') return;
      if (o.k === 'w' && !D()[o.w]) return;
      const a = n * 2.4 + Math.random() * 0.6, d = n ? 0.9 + n * 0.12 : 0.3, x = +p[0] + Math.cos(a) * d, z = +p[2] + Math.sin(a) * d;
      const h = W.raycast(x, +p[1] + 1.2, z, 0, -1, 0, 40), y = h ? h.y : +p[1];
      out.push({ i: BR.nextId++, k: o.k, w: o.w || null, r: U.clamp(o.r | 0, 0, 4), mag: Math.max(0, o.mag | 0), res: Math.max(0, o.res | 0), n: Math.max(0, o.n | 0), p: [+x.toFixed(2), +(y + 0.02).toFixed(2), +z.toFixed(2)] });
    });
    if (out.length) send({ op: 'add', items: out });
  };
  const wire = (it) => ({ i: it.i, k: it.k, w: it.w, r: it.r, mag: it.mag, res: it.res, n: it.n, p: [+it.p.x.toFixed(2), +it.p.y.toFixed(2), +it.p.z.toFixed(2)] });

  // ------------------------------------------------------------ everyone: applying the host's word
  BR.apply = function (msg) {
    switch (msg.op) {
      case 'phase': {
        const was = BR.phase;
        BR.phase = msg.p; BR.t = +msg.s || 0;
        if (msg.p === 'ready' && was !== 'ready') { CF.HUD.popup('The Battle Bus leaves in ' + BR.t + ' s', 0, 'obj'); A.play('objective', null, { ui: true }); }
        if (msg.p === 'storm' && was === 'bus') { if (BR.fl === 3) BR.jump(true); if (BR.busLoop) BR.busLoop.set(0, 1.5); }
        return;
      }
      case 'start': return BR.begin(msg);
      case 'sync': {
        if (msg.seed != null && !BR.match()) BR.begin(msg, true);
        if (msg.p !== BR.phase && !(msg.p === 'storm' && BR.phase === 'bus')) BR.phase = msg.p;
        if (msg.p === 'ready' || msg.p === 'wait') { if (Math.abs(BR.t - msg.s) > 1.2) BR.t = msg.s; }
        if (msg.c != null && Math.abs(BR.clock - msg.c) > 0.6) BR.clock = msg.c;
        if (Array.isArray(msg.al) && BR.match()) BR.alive = new Set(msg.al);
        if (msg.place) BR.place = msg.place;
        if (msg.gone) for (const i of msg.gone) BR.removeItem(i);
        if (msg.opened) for (const c of msg.opened) BR.openChest(c, null, true);
        if (msg.extra) for (const o of msg.extra) BR.addItem(o);
        return;
      }
      case 'gone': return BR.onGone(+msg.i, msg.by);
      case 'open': return BR.openChest(+msg.c, msg.by);
      case 'add': for (const o of msg.items || []) BR.addItem(o); return;
    }
  };
  /** The bus leaves: loot appears, the storm is set, everyone on the roster boards. */
  BR.begin = function (msg, joining) {
    const M = MP(), G = CF.Game;
    BR.reset(true);
    BR.phase = 'bus'; BR.clock = 0; BR.seed = msg.seed; BR.bus = msg.bus; BR.circles = msg.circles; BR.roster = msg.roster || [];
    BR.alive = new Set(BR.roster.filter((id) => M.players[id]));
    const b = BR.bus; BR.busLen = Math.hypot(b[2] - b[0], b[3] - b[1]); BR.busDur = BR.busLen / BUS_SPEED;
    BR.busDir = new THREE.Vector3((b[2] - b[0]) / BR.busLen, 0, (b[3] - b[1]) / BR.busLen);
    for (const it of genFloor(BR.seed)) BR.items.set(it.i, it);
    for (const ch of BR.chests) ch.mesh.visible = true;
    BR.busMesh.visible = true; BR.storm.visible = true;
    for (const id in M.players) { M.players[id].kills = 0; M.players[id].deaths = 0; }
    if (joining) return; // a late joiner spectates
    G.stats = G.newStats();
    CF.Streak.reset();
    for (const bot of CF.Bots.list) BR.botBoard(bot);
    if (BR.alive.has(M.myId) && !G.mpLobby) BR.board();
    CF.HUD.killfeed('The Battle Bus is off · ' + BR.alive.size + ' players', 'Battle Royale');
    A.play('alert', null, { ui: true });
    if (G.audioOn) { CF.Music.setIntensity(0.3); BR.busLoop = A.loop('rotor'); if (BR.busLoop) BR.busLoop.set(0.18, 0.5); }
  };
  /** Put the local player on the bus with the drop kit. */
  BR.board = function () {
    const G = CF.Game, P = CF.Player, M = MP();
    CF.PH.drop(); CF.Coop.standUp();
    CF.Weapons.reset(KIT()); P.speedMul = 1;
    const p = BR.busPos(BR.clock, new THREE.Vector3());
    P.spawn(p.x, p.y - 1.2, p.z, Math.atan2(-BR.busDir.x, -BR.busDir.z), { maxHealth: 100, armor: 0 });
    P.ride = BR.busRide; BR.setFl(3); P.pitch = -0.42; // look down at the map
    M.spawnT = -99;
    if (G.state === 'mpdead') { G.state = 'playing'; $('mpDead').hidden = true; CF.Post.setState({ fade: 1 }); }
    G.deathT = 0;
    CF.HUD.popup('All aboard the Battle Bus', 0, 'obj');
    M.sendState();
  };
  BR.busPos = function (t, out) {
    const b = BR.bus, k = U.clamp(t / BR.busDur, 0, 1);
    return out.set(b[0] + (b[2] - b[0]) * k, BUS_Y, b[1] + (b[3] - b[1]) * k);
  };
  const _bp = new THREE.Vector3();
  BR.doorsOpen = function () { BR.busPos(BR.clock, _bp); return BR.clock > 1.5 && Math.abs(_bp.x) < OPEN && Math.abs(_bp.z) < OPEN; };
  BR.busRide = { get(pos) { BR.busPos(BR.clock, pos); pos.y -= 1.2; } };
  BR.skyRide = { get(pos) { BR.flyStep(pos); } };

  // ------------------------------------------------------------ items: appear, vanish, open chests
  BR.addItem = function (o) {
    if (BR.items.has(o.i)) return;
    const it = mk(o.i, o.k, { w: o.w, r: o.r | 0, mag: o.mag | 0, res: o.res | 0, n: o.n | 0 }, o.p[0], o.p[1], o.p[2]);
    BR.items.set(it.i, it);
  };
  BR.removeItem = function (i) {
    const it = BR.items.get(i); if (!it || it.gone) return null;
    it.gone = true; if (it.mesh) { CF.Game.scene.remove(it.mesh); it.mesh = null; }
    return it;
  };
  BR.onGone = function (i, by) {
    const it = BR.removeItem(i); if (!it) return;
    const M = MP();
    if (by === M.myId) BR.grant(it, BR.want[i]);
    else if (M.isHost()) { const bot = CF.Bots.list.find((b) => b.id === by); if (bot) BR.grantBot(bot, it); }
    delete BR.want[i];
  };
  BR.openChest = function (c, by, quiet) {
    const ch = BR.chests[c]; if (!ch || ch.open) return;
    ch.open = true; ch.openT = 0; ch.glow.visible = false;
    for (const it of chestItems(c)) if (!BR.items.has(it.i)) BR.items.set(it.i, it);
    if (!quiet) { A.play('reveal', new THREE.Vector3(ch.x, ch.y + 0.5, ch.z), { ref: 6 }); CF.FX.glow(ch.x, ch.y + 0.7, ch.z, 2, 0.6, 2.4, 1.6, 0.3); }
    if (by === MP().myId) A.play('weaponGet', null, { ui: true, vol: 0.6 });
  };

  // ------------------------------------------------------------ the local player: grabbing things
  const gunCount = () => Object.keys(CF.Weapons.inv).length;
  function invItem(id) { const w = CF.Weapons.inv[id]; return { k: 'w', w: id, r: w.rar || 0, mag: w.mag, res: w.reserve === Infinity ? 24 : w.reserve }; }
  /** Would this help right now? Returns how to take it ('add', 'ammo', 'auto'), 'swap' (needs the key) or null. */
  function useOf(it) {
    const P = CF.Player, WP = CF.Weapons;
    if (it.k === 'w') {
      const own = WP.inv[it.w];
      if (own) { if ((own.rar || 0) < it.r) return 'swap'; return own.reserve !== Infinity && own.reserve < own.def.maxReserve * 1.5 ? 'ammo' : null; }
      return gunCount() < SLOTS ? 'add' : 'swap';
    }
    if (it.k === 'ammo') { for (const id in WP.inv) { const w = WP.inv[id]; if (w.reserve !== Infinity && w.reserve < w.def.maxReserve) return 'auto'; } return null; }
    if (it.k === 'armor') return P.armor < 100 ? 'auto' : null;
    if (it.k === 'med') return P.health < P.maxHealth ? 'auto' : null;
    if (it.k === 'frag') return WP.grenades < WP.maxGrenades ? 'auto' : null;
    return null;
  }
  function request(it, how) {
    if (CF.time - it.req < 1.2) return;
    it.req = CF.time; BR.want[it.i] = how;
    MP().post({ t: 'br', op: 'take', i: it.i });
  }
  /** Host said it's ours: put it in the pack. */
  BR.grant = function (it, how) {
    const P = CF.Player, WP = CF.Weapons, H = CF.HUD;
    if (!P.alive) return;
    if (it.k === 'w') {
      const own = WP.inv[it.w], R = RAR[it.r];
      if (own && (how === 'ammo' || (own.rar || 0) >= it.r)) {
        if (own.reserve !== Infinity) own.reserve = Math.min(Math.round(own.def.maxReserve * 1.5), own.reserve + it.mag + it.res);
        WP.hudAmmo(); A.play('ammo', null, { ui: true }); H.popup('+' + (it.mag + it.res) + ' ' + own.def.short + ' rounds', 0, '');
        return;
      }
      if (own || gunCount() >= SLOTS) { // swap: drop what's in your hands (or the same gun you already carry)
        const out = own ? it.w : WP.inv[WP.curId] ? WP.curId : Object.keys(WP.inv)[0];
        BR.drop([invItem(out)]);
        delete WP.inv[out];
      }
      WP.inv[it.w] = { def: BR.rdef(it.w, it.r), mag: it.mag, reserve: it.res, rar: it.r };
      if (!WP.inv[WP.curId]) WP.equip(it.w); else WP.select(it.w);
      H.setWeapon(WP.cur.def, WP.inv, WP.slots(), it.w);
      A.play('weaponGet', null, { ui: true });
      H.popup(R.name + ' ' + D()[it.w].name, 0, 'obj br-r' + it.r);
      return;
    }
    if (it.k === 'ammo') {
      for (const id in WP.inv) { const w = WP.inv[id]; if (w.reserve !== Infinity) w.reserve = Math.min(w.def.maxReserve, w.reserve + boxAmmo(w.def)); }
      WP.hudAmmo(); A.play('ammo', null, { ui: true }); H.popup('Ammo', 0, '');
    } else if (it.k === 'armor') { P.heal(0, it.n); A.play('armor', null, { ui: true }); H.popup('+' + it.n + ' armor', 0, ''); }
    else if (it.k === 'med') { P.heal(it.n, 0); A.play('armor', null, { ui: true, vol: 0.6 }); H.popup('+' + it.n + ' health', 0, ''); }
    else if (it.k === 'frag') { WP.grenades = Math.min(WP.maxGrenades, WP.grenades + it.n); H.setGrenades(WP.grenades, WP.maxGrenades); A.play('ammo', null, { ui: true }); H.popup('+' + it.n + ' frags', 0, ''); }
  };
  /** Ask the host to put these on the floor at your feet. */
  BR.drop = function (list) {
    const b = CF.Player.body.pos;
    MP().post({ t: 'br', op: 'drop', items: list, p: [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)] });
  };
  function label(it) {
    if (it.k === 'w') return RAR[it.r].name + ' ' + D()[it.w].name;
    if (it.k === 'armor') return (it.n >= 50 ? 'Heavy ' : '') + 'Armor plate (+' + it.n + ')';
    if (it.k === 'med') return (it.n >= 50 ? 'Med kit' : 'Bandages') + ' (+' + it.n + ')';
    if (it.k === 'frag') return 'Frag grenades ×' + it.n;
    return ITEM[it.k];
  }
  const _f = new THREE.Vector3();
  function updateLoot(dt) {
    const P = CF.Player, G = CF.Game, inp = CF.Input, b = P.body.pos;
    if (G.state !== 'playing' || !P.alive || BR.fl || !BR.match()) { if (BR.prompted) { BR.prompted = false; CF.HUD.interact(null); } BR.hold = 0; return; }
    P.forward(_f);
    let best = null, bs = Infinity;
    for (const it of BR.items.values()) {
      if (it.gone) continue;
      const dx = it.p.x - b.x, dz = it.p.z - b.z, d = Math.hypot(dx, dz);
      if (d > 2.0 || Math.abs(it.p.y - b.y) > 1.6) continue;
      const how = useOf(it);
      if (how && how !== 'swap' && d < 1.4) { request(it, how); continue; } // walk over it: take it
      if (how !== 'swap') continue;
      const s = d - (d > 0.3 ? (dx * _f.x + dz * _f.z) / d : 1) * 0.8; // prefer what you face
      if (s < bs) { bs = s; best = it; }
    }
    let chest = null, cd = 2.2;
    for (const ch of BR.chests) {
      if (ch.open) continue;
      const dx = ch.x - b.x, dz = ch.z - b.z, d = Math.hypot(dx, dz);
      if (d < cd && Math.abs(ch.y - b.y) < 1.5) { cd = d; chest = ch; }
    }
    let text = null, frac = 0;
    if (chest && (!best || cd < 1.3)) {
      if (inp.down('KeyE')) { BR.hold += dt; if (BR.hold >= 0.55) { BR.hold = 0; if (CF.time - (chest.req || -9) > 1.2) { chest.req = CF.time; MP().post({ t: 'br', op: 'open', c: chest.i }); } } }
      else BR.hold = Math.max(0, BR.hold - dt * 2);
      text = 'Open chest'; frac = BR.hold / 0.55;
    } else if (best) {
      BR.hold = 0;
      const own = CF.Weapons.inv[best.w], cur = CF.Weapons.cur;
      text = own ? 'Swap your ' + own.def.name + ' for the ' + label(best) : 'Swap ' + (cur ? cur.def.name : 'your gun') + ' for ' + label(best);
      if (inp.hit('KeyE')) request(best, 'swap');
    } else BR.hold = 0;
    if (text) { CF.HUD.interact(text, frac); BR.prompted = true; } else if (BR.prompted) { BR.prompted = false; CF.HUD.interact(null); }
  }
  /** Everything we carried goes on the floor where we fell. */
  BR.spill = function () {
    const WP = CF.Weapons, list = [];
    for (const id in WP.inv) { const w = WP.inv[id]; if (id === 'pistol' && !w.rar && w.mag + (w.reserve === Infinity ? 0 : w.reserve) < 6) continue; list.push(invItem(id)); }
    if (WP.grenades > 0) list.push({ k: 'frag', n: WP.grenades });
    list.push({ k: 'ammo', n: 1 });
    if (CF.Player.armor >= 20) list.push({ k: 'armor', n: Math.round(CF.Player.armor / 25) * 25 >= 50 ? 50 : 25 });
    BR.drop(list.slice(0, 8));
  };

  // ------------------------------------------------------------ the drop
  BR.setFl = function (v) {
    if (BR.fl === v) return;
    BR.fl = v;
    document.body.classList.toggle('br-air', v > 0);
    if (BR.self) BR.self.root.visible = v === 1 || v === 2;
    if (v === 0 && BR.windLoop) BR.windLoop.set(0, 0.6);
  };
  /** Leave the bus (Space, or thrown out at the end of the route). */
  BR.jump = function (forced) {
    const P = CF.Player, b = P.body;
    if (BR.fl !== 3) return;
    BR.busPos(BR.clock, b.pos); b.pos.y -= 3;
    if (forced) { b.pos.x = U.clamp(b.pos.x, -OPEN + 4, OPEN - 4); b.pos.z = U.clamp(b.pos.z, -OPEN + 4, OPEN - 4); }
    BR.vel.set(BR.busDir.x * 9, -4, BR.busDir.z * 9);
    P.ride = BR.skyRide; BR.flyT = P.time; BR.gT = 0; BR.setFl(1);
    A.play('jump'); A.play('whiz', null, { ui: true, vol: 0.5 });
    if (CF.Game.audioOn && !BR.windLoop) BR.windLoop = A.loop('wind');
    MP().sendState();
  };
  /** One step of free fall or gliding: called as the player's ride, so the normal walking code sits it out. */
  BR.flyStep = function () {
    const P = CF.Player, b = P.body, inp = CF.Input, G = CF.Game;
    const dt = Math.min(0.05, Math.max(0, P.time - BR.flyT)); BR.flyT = P.time;
    if (!dt) return;
    const live = G.state === 'playing';
    const fwd = live ? (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0) : 0, side = live ? (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0) : 0;
    BR.gT -= dt;
    if (BR.gT <= 0) { BR.gT = 0.1; const h = W.raycast(b.pos.x, b.pos.y, b.pos.z, 0, -1, 0, 400); BR.gy = h ? h.y : 0; }
    const above = b.pos.y - BR.gy;
    if (BR.fl === 1 && (above < DEPLOY || (live && inp.hit('Space') && above < 90))) { BR.setFl(2); A.play('reveal', null, { ui: true, vol: 0.5 }); BR.vel.y = Math.max(BR.vel.y, -10); MP().sendState(); }
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), v = BR.vel;
    let tx, tz, ty;
    if (BR.fl === 1) {
      const dive = fwd > 0 && P.pitch < -0.3, hs = dive ? DIVE_H : FALL_H;
      tx = -sy * fwd + cy * side; tz = -cy * fwd - sy * side;
      const l = Math.hypot(tx, tz); if (l > 0) { tx = tx / l * hs; tz = tz / l * hs; }
      ty = dive ? -DIVE : -FALL;
    } else {
      const f = fwd > 0 ? 1.35 : fwd < 0 ? 0.3 : 0.8;
      tx = (-sy * f + cy * side * 0.75) * GLIDE_H; tz = (-cy * f - sy * side * 0.75) * GLIDE_H;
      ty = fwd > 0 ? -8.5 : fwd < 0 ? -4.2 : -GLIDE_V;
    }
    v.x = U.damp(v.x, tx, 2.2, dt); v.z = U.damp(v.z, tz, 2.2, dt); v.y = U.damp(v.y, ty, BR.fl === 1 ? 1.4 : 3, dt);
    b.vel.copy(v); b.grounded = false; b.noSnap = true;
    W.moveBody(b, dt);
    b.noSnap = false;
    v.x = b.vel.x; v.z = b.vel.z;
    b.pos.x = U.clamp(b.pos.x, -KEEP_IN, KEEP_IN); b.pos.z = U.clamp(b.pos.z, -KEEP_IN, KEEP_IN);
    if (b.grounded) BR.land();
    if (BR.windLoop) BR.windLoop.set(BR.fl === 1 ? 0.5 + Math.min(0.4, -v.y / 100) : 0.22, 0.2);
  };
  BR.land = function () {
    const P = CF.Player, b = P.body;
    P.ride = null; BR.setFl(0);
    b.vel.set(0, 0, 0); b.grounded = true; P.airPeak = b.pos.y;
    A.play('land', null, { vol: 0.8 }); P.shake(0.12); CF.Weapons.onLand(5);
    MP().sendState();
  };
  /** Third-person camera on the bus and in the air; you steer with the mouse. */
  const _c = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  BR.setNear = function (cam, n) { if (Math.abs(cam.near - n) > 0.005) { cam.near = n; cam.updateProjectionMatrix(); } };
  function airCamera(dt) {
    const P = CF.Player, cam = CF.Game.camera, b = P.body.pos, onBus = BR.fl === 3;
    if (onBus) BR.busPos(BR.clock, _t).y += 1.5; else _t.set(b.x, b.y + 1.2, b.z);
    const dist = onBus ? 24 : BR.fl === 2 ? 6.5 : 5.2, pitch = U.clamp(P.pitch, -1.35, 0.6);
    const cp = Math.cos(pitch);
    _d.set(-Math.sin(P.yaw) * cp, Math.sin(pitch), -Math.cos(P.yaw) * cp);
    let d = dist;
    if (!onBus) { const h = W.raycast(_t.x, _t.y, _t.z, -_d.x, -_d.y, -_d.z, dist, null, true); if (h) d = Math.max(0.6, h.t - 0.3); }
    _c.copy(_t).addScaledVector(_d, -d);
    cam.position.copy(_c);
    _e.set(pitch, P.yaw, 0); cam.quaternion.setFromEuler(_e);
    const fov = CF.settings.fov + (BR.fl === 1 ? 10 : 4);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = U.damp(cam.fov, fov, 6, dt); cam.updateProjectionMatrix(); }
    // high up, push the near plane out with the height so the depth buffer can still tell the ground layers (grass, roads,
    // paint a few cm apart) from each other at a few hundred metres; otherwise they flicker into each other
    BR.setNear(cam, U.clamp(_c.y * 0.008, 0.05, onBus ? 1.2 : Math.min(1.2, d * 0.15)));
    cam.updateMatrixWorld();
    if (BR.self && !onBus) {
      const r = BR.self.root; r.position.set(b.x, b.y, b.z); r.rotation.set(0, P.yaw, 0);
      BR.pose(BR.self, r, BR.fl, CF.time); BR.self.glider.visible = BR.fl === 2;
      CF.Skins.animateModel(BR.self, CF.time, null, 0, CF.Game.scene);
    }
  }

  // ------------------------------------------------------------ the storm
  /** The storm right now: centre, radius, the next circle, what's happening and for how long, damage. */
  BR.stormNow = function () {
    const C = BR.circles;
    if (!C) return { x: 0, z: 0, r: 999, nx: 0, nz: 0, nr: 999, stage: 'none', left: 0, dps: 0, k: 0 };
    let tt = BR.clock;
    for (let k = 0; k < STORM.length; k++) {
      const s = STORM[k], a = C[k], b = C[k + 1];
      if (tt < s.wait) return { x: a[0], z: a[1], r: a[2], nx: b[0], nz: b[1], nr: b[2], stage: 'wait', left: s.wait - tt, dps: k ? STORM[k - 1].dps : s.dps, k };
      tt -= s.wait;
      if (tt < s.shrink) { const f = tt / s.shrink; return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, r: a[2] + (b[2] - a[2]) * f, nx: b[0], nz: b[1], nr: b[2], stage: 'shrink', left: s.shrink - tt, dps: s.dps, k }; }
      tt -= s.shrink;
    }
    const L = C[C.length - 1];
    return { x: L[0], z: L[1], r: 0, nx: L[0], nz: L[1], nr: 0, stage: 'closed', left: 0, dps: STORM[STORM.length - 1].dps, k: STORM.length };
  };
  BR.inside = (p, st) => Math.hypot(p.x - st.x, p.z - st.z) <= st.r;
  BR.setOut = function (v) {
    if (BR.out === v) return;
    BR.out = v;
    const el = $('brTint'); if (el) el.hidden = !v;
    if (v) { CF.HUD.popup('You are in the storm', 0, 'obj'); A.play('warning', null, { ui: true }); if (CF.Game.audioOn && !BR.stormLoop) BR.stormLoop = A.loop('blizzard'); if (BR.stormLoop) BR.stormLoop.set(0.32, 0.6); }
    else if (BR.stormLoop) BR.stormLoop.set(0, 0.8);
  };
  function updateStorm(dt) {
    const st = BR.stormNow(), P = CF.Player, s = BR.storm, G = CF.Game;
    if (s) { s.visible = BR.match(); s.position.x = st.x; s.position.z = st.z; s.scale.set(Math.max(0.5, st.r), 1, Math.max(0.5, st.r)); s.material.uniforms.uTime.value = CF.time; }
    const out = BR.match() && P.alive && BR.fl !== 3 && !BR.inside(P.body.pos, st);
    BR.setOut(out);
    // fog turns purple inside the storm
    const fog = G.scene.fog, th = G.mapDef.theme;
    if (fog) {
      const k = BR.stormK = U.damp(BR.stormK || 0, out ? 1 : 0, 3, dt);
      fog.color.setRGB(U.lerp(th.fog[0], 0.34, k), U.lerp(th.fog[1], 0.14, k), U.lerp(th.fog[2], 0.56, k)); fog.density = U.lerp(th.fogDensity, 0.03, k);
    }
    if (!out) { BR.burnT = 0; return; }
    BR.burnT = (BR.burnT || 0) + dt;
    if (BR.burnT >= 1 && !MP().ended && !CF.Game.godMode) {
      BR.burnT -= 1;
      // the storm ignores armor
      P.health -= st.dps; P.lastHurt = P.time; CF.Game.stats.damageTaken += st.dps;
      CF.HUD.hurt(0.35, false); A.play('hurt', null, { vol: 0.5 }); CF.HUD.setVitals(P.health, P.armor);
      if (P.health <= 0) { P.health = 0; P.die('The storm'); }
    }
  }

  // ------------------------------------------------------------ placements, eliminations, the end
  /** A kill (every client runs this in the same order): who's still in, and where the victim placed. */
  BR.onKill = function (k, killer, victim) {
    if (!BR.match()) return null;
    const M = MP(), id = k.victim;
    if (!BR.alive.has(id)) return null;
    const place = BR.alive.size;
    BR.alive.delete(id); BR.place[id] = place;
    if (M.isHost()) { const bot = CF.Bots.list.find((b) => b.id === id); if (bot) botSpill(bot); }
    if (id === M.myId) BR.eliminated(place, killer && k.killer !== id ? killer.name : null, k.w);
    else if (BR.alive.size > 1) CF.HUD.killfeed(BR.alive.size + ' left', '');
    if (k.killer === M.myId && id !== M.myId && BR.alive.size > 1) CF.HUD.popup(BR.alive.size + ' players left', 0, '');
    return place;
  };
  /** A player left mid-match: out, at the place they'd reached. */
  BR.onLeave = function (id) {
    if (!BR.match() || !BR.alive.has(id)) return;
    BR.place[id] = BR.alive.size; BR.alive.delete(id);
    if (MP().isHost()) MP().checkEnd();
  };
  BR.eliminated = function (place, by, w) {
    const n = BR.roster.length;
    $('mdTitle').textContent = 'Eliminated';
    $('mdBy').textContent = '#' + place + ' of ' + n + (by ? ' · by ' + by : w === 'storm' ? ' · lost in the storm' : '');
    BR.specT = 0; BR.spec = null;
  };
  /** Host: decided? Banner text, or null. */
  BR.result = function () {
    if (!BR.match()) return null;
    if (BR.alive.size > 1) return null;
    const M = MP(), id = [...BR.alive][0];
    if (id) BR.place[id] = 1;
    return id && M.players[id] ? M.players[id].name + ' · Victory Royale' : 'No one survived the storm';
  };
  BR.winnerId = () => { for (const id in BR.place) if (BR.place[id] === 1) return id; return null; };
  BR.onEnd = function (msg) {
    const M = MP();
    if (msg.place) BR.place = msg.place;
    BR.phase = 'over';
    const won = BR.place[M.myId] === 1, mine = BR.place[M.myId];
    const ban = $('brBanner');
    $('brBannerT').textContent = won ? '#1' : mine ? '#' + mine : '';
    $('brBannerS').textContent = won ? 'Victory Royale' : BR.winnerLine(msg.winner);
    ban.classList.toggle('win', won); ban.hidden = false;
    if (won) { CF.HUD.flash(0.4); CF.Game.godMode = true; }
    if (CF.Game.audioOn) CF.Music.sting('victory');
    BR.setOut(false); BR.stopLoops();
  };
  /** "Viper won" (or the host's line when nobody did). */
  BR.winnerLine = function (winner) { const id = BR.winnerId(), pl = id && MP().players[id]; return pl ? pl.name + ' won' : winner || 'Match over'; };
  BR.endTitle = function (winner) {
    const M = MP(), pl = BR.place[M.myId];
    if (pl === 1) return 'Victory Royale';
    return (pl ? '#' + pl + ' · ' : '') + BR.winnerLine(winner);
  };
  BR.stopLoops = function () {
    for (const k of ['busLoop', 'windLoop', 'stormLoop']) if (BR[k]) { BR[k].stop(); BR[k] = null; }
  };

  // ------------------------------------------------------------ spectating
  function specTargets() { const M = MP(), out = []; for (const id in M.remotes) { const r = M.remotes[id]; if (r.alive && BR.alive.has(id)) out.push(r); } return out; }
  function spectate(dt) {
    const M = MP(), G = CF.Game, cam = G.camera, inp = CF.Input;
    BR.specT += dt;
    if (BR.specT < 2.2) return false;
    const list = specTargets();
    if (!list.length) return false;
    let r = BR.spec && M.remotes[BR.spec];
    if (!r || !r.alive) { const k = M.lastKiller && M.remotes[M.lastKiller]; r = k && k.alive ? k : list[0]; BR.spec = r.id; BR.specPos = null; }
    if (G.state === 'mpdead' && (inp.hit('Space') || inp.mpressed[0])) { const i = list.indexOf(r); r = list[(i + 1) % list.length]; BR.spec = r.id; }
    const p = r.body.pos, yaw = r.yaw;
    _t.set(p.x, p.y + 1.6, p.z);
    _c.set(p.x + Math.sin(yaw) * 4.2 + Math.cos(yaw) * 0.9, p.y + 2.5, p.z + Math.cos(yaw) * 4.2 - Math.sin(yaw) * 0.9);
    const h = W.raycast(_t.x, _t.y, _t.z, _c.x - _t.x, _c.y - _t.y, _c.z - _t.z, 1, null, true);
    if (h) _c.lerpVectors(_t, _c, Math.max(0.15, h.t - 0.1));
    if (!BR.specPos) BR.specPos = _c.clone(); else BR.specPos.lerp(_c, 1 - Math.exp(-10 * dt));
    cam.position.copy(BR.specPos); cam.lookAt(_t);
    if (Math.abs(cam.fov - CF.settings.fov) > 0.05) { cam.fov = CF.settings.fov; cam.updateProjectionMatrix(); }
    BR.setNear(cam, 0.05);
    cam.updateMatrixWorld();
    const txt = 'Spectating ' + r.name + ' · ' + (list.length > 1 ? 'Space for the next player' : 'the last one standing');
    if (G.ui.md !== txt) { $('mdTimer').textContent = txt; G.ui.md = txt; }
    return true;
  }
  BR.spectating = () => BR.on() && !CF.Player.alive && (BR.phase === 'storm' || BR.phase === 'bus' || BR.phase === 'over') && BR.specT >= 2.2;
  /** Can this player be put into the match right now? (A late joiner or an eliminated player watches instead.) */
  BR.blockSpawn = () => BR.match() && !BR.alive.has(MP().myId);
  /** Deploying from the lobby after the bus left: straight onto the bus, or dropped from the sky. */
  BR.onSpawn = function () {
    if (!BR.match()) return;
    if (BR.phase === 'bus' && BR.clock < BR.busDur - 2) { BR.board(); return; }
    BR.board(); BR.fl = 3; BR.jump(true);
  };

  // ------------------------------------------------------------ minimap and full map
  BR.renderMapImage = function () {
    const G = CF.Game, L = CF.Level, br = L.points.br || { size: 110 }, S = br.size + 4, r = CF.Post.renderer;
    const src = r.domElement, aspect = src.width / src.height;
    const cam = new THREE.OrthographicCamera(-S * aspect, S * aspect, S, -S, 1, 400);
    cam.position.set(0, 300, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const fog = G.scene.fog; G.scene.fog = null;
    const sky = L.sky; if (sky) sky.visible = false;
    G.updateMoon(new THREE.Vector3(0, 0, 0));
    const sc = G.moon.shadow.camera, sv = [sc.left, sc.right, sc.top, sc.bottom]; sc.left = sc.bottom = -S - 10; sc.right = sc.top = S + 10; sc.updateProjectionMatrix();
    CF.Post.render(G.scene, cam, null, G.vmCam);
    const c = document.createElement('canvas'); c.width = c.height = 768;
    const sz = src.height; c.getContext('2d').drawImage(src, (src.width - sz) / 2, 0, sz, sz, 0, 0, 768, 768);
    [sc.left, sc.right, sc.top, sc.bottom] = sv; sc.updateProjectionMatrix();
    G.scene.fog = fog; if (sky) sky.visible = true;
    BR.mapImg = c; BR.mapS = S;
  };
  /** World x/z → canvas pixels, for a view of `span` metres around (cx, cz) drawn `size` px wide. */
  function drawMap(ctx, size, cx, cz, span, big) {
    const S = BR.mapS || 124, k = size / span, P = CF.Player, st = BR.stormNow(), px = (x) => (x - cx) * k + size / 2, pz = (z) => (z - cz) * k + size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save(); ctx.beginPath(); if (!big) ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); else ctx.rect(0, 0, size, size); ctx.clip();
    ctx.fillStyle = '#3f5a33'; ctx.fillRect(0, 0, size, size);
    if (BR.mapImg) ctx.drawImage(BR.mapImg, px(-S), pz(-S), 2 * S * k, 2 * S * k);
    if (BR.match() && BR.circles) {
      // the storm: everything outside the circle tinted purple
      ctx.save(); ctx.fillStyle = 'rgba(120, 40, 190, 0.45)'; ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.arc(px(st.x), pz(st.z), Math.max(0, st.r * k), 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.restore();
      ctx.strokeStyle = 'rgba(200, 120, 255, 0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(st.x), pz(st.z), Math.max(0, st.r * k), 0, Math.PI * 2); ctx.stroke();
      if (st.stage !== 'closed') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(px(st.nx), pz(st.nz), Math.max(1, st.nr * k), 0, Math.PI * 2); ctx.stroke(); }
      // the bus route
      if (BR.phase === 'bus' && BR.bus) {
        const b = BR.bus; ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px(b[0]), pz(b[1])); ctx.lineTo(px(b[2]), pz(b[3])); ctx.stroke(); ctx.setLineDash([]);
        BR.busPos(BR.clock, _bp); ctx.fillStyle = '#2a7ad8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(_bp.x), pz(_bp.z), big ? 9 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    // where you are (or who you're watching), and which way you face
    const M = MP(), spec = !P.alive && BR.spec && M.remotes[BR.spec];
    const me = spec ? spec.body.pos : P.body.pos, yaw = spec ? spec.yaw : P.yaw;
    ctx.save(); ctx.translate(px(me.x), pz(me.z)); ctx.rotate(-yaw);
    ctx.fillStyle = spec ? '#ff9a3a' : '#ffe14d'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.restore();
    if (!big) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Barlow Semi Condensed", Arial'; ctx.textAlign = 'center'; ctx.fillText('N', size / 2, 14); }
  }
  BR.closeMap = function () { BR.mapOpen = false; const e = $('brBig'); if (e) e.hidden = true; };
  function updateMapUI(raw) {
    BR.mapT = (BR.mapT || 0) - raw;
    if (BR.mapT > 0) return;
    BR.mapT = 0.066;
    const P = CF.Player, M = MP(), spec = !P.alive && BR.spec && M.remotes[BR.spec], me = spec ? spec.body.pos : P.body.pos;
    const mini = $('brMini'); if (mini) drawMap(mini.getContext('2d'), mini.width, me.x, me.z, BR.fl === 3 ? 260 : 120, false);
    if (BR.mapOpen) { const c = $('brBigCanvas'); drawMap(c.getContext('2d'), c.width, -2, -6, (BR.mapS || 124) * 2 + 6, true); }
  }
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function updateHudText() {
    const st = BR.stormNow(), M = MP();
    let storm = '';
    if (BR.phase === 'wait') storm = M.solo ? 'Deploy to start' : 'Waiting for players';
    else if (BR.phase === 'ready') storm = 'Battle Bus in ' + fmt(BR.t);
    else if (BR.phase === 'over') storm = 'Match over';
    else if (st.stage === 'wait') storm = (st.k === 0 ? 'Storm forming · ' : 'Storm shrinks in ') + fmt(st.left);
    else if (st.stage === 'shrink') storm = 'Storm shrinking · ' + fmt(st.left);
    else storm = 'The storm has closed';
    const el = $('brStorm'); if (el.textContent !== storm) el.textContent = storm;
    el.classList.toggle('shrink', st.stage === 'shrink' && BR.match());
    const al = BR.match() || BR.phase === 'over' ? BR.alive.size + ' alive' : Object.keys(M.players).length + ' in lobby';
    if ($('brAlive').textContent !== al) $('brAlive').textContent = al;
    const me = M.players[M.myId], kl = (me ? me.kills : 0) + ' kills';
    if ($('brKills').textContent !== kl) $('brKills').textContent = kl;
  }

  // ------------------------------------------------------------ every frame
  BR.update = function (dt, raw) {
    if (!BR.on()) return;
    const M = MP(), G = CF.Game, P = CF.Player, inp = CF.Input;
    if (BR.phase === 'ready' || BR.phase === 'wait') BR.t = Math.max(0, BR.t - dt);
    if (BR.match()) BR.clock += dt;
    if (M.isHost()) hostUpdate(dt);
    // the bus
    if (BR.busMesh) {
      const on = BR.phase === 'bus' && BR.bus && BR.clock < BR.busDur + 4;
      BR.busMesh.visible = !!on;
      if (on) {
        BR.busPos(BR.clock, BR.busMesh.position); BR.busMesh.position.y += Math.sin(CF.time * 1.3) * 0.4;
        BR.busMesh.rotation.y = Math.atan2(-BR.busDir.x, -BR.busDir.z); BR.busMesh.rotation.z = Math.sin(CF.time * 0.9) * 0.03;
        BR.busMesh.userData.prop.rotation.z += raw * 18; BR.busMesh.userData.flame.scale.y = 0.8 + Math.random() * 0.5;
      }
    }
    if (BR.fl === 3) {
      if (G.state === 'playing') {
        if (BR.doorsOpen()) { CF.HUD.hint('Press ' + CF.Keys.label('jump') + ' to jump out of the Battle Bus'); if (inp.hit('Space')) BR.jump(); }
        else CF.HUD.hint(BR.clock < 2 ? 'The doors open in a moment' : 'Over the edge of the map · wait for the doors');
      }
      if (BR.clock >= BR.busDur - 0.5 || (BR.clock > BR.busDur * 0.5 && !BR.doorsOpen())) BR.jump(true); // end of the route: everyone out
    }
    if (BR.fl === 1 && G.state === 'playing') CF.HUD.hint('Skydiving · W and look down to dive · ' + CF.Keys.label('jump') + ' opens the glider');
    else if (BR.fl === 2 && G.state === 'playing') CF.HUD.hint('Gliding · steer with the mouse and W A S D');
    if (BR.fl && P.alive && (G.state === 'playing' || G.state === 'mpmenu')) airCamera(raw);
    // the storm, loot and chests
    updateStorm(dt);
    updateLoot(dt);
    updateItems(raw);
    // spectate once you're out
    const specOn = !P.alive && BR.match() && G.state === 'mpdead' && spectate(raw);
    document.body.classList.toggle('br-spec', !!specOn);
    // the map key
    if (inp.hit('BRMap') && (G.state === 'playing' || G.state === 'mpdead')) { BR.mapOpen = !BR.mapOpen; $('brBig').hidden = !BR.mapOpen; }
    if (G.state !== 'playing' && G.state !== 'mpdead' && BR.mapOpen) BR.closeMap();
    updateMapUI(raw);
    BR.hudT = (BR.hudT || 0) - raw;
    if (BR.hudT <= 0) { BR.hudT = 0.2; updateHudText(); }
    // warm-up hints
    if (G.state === 'playing' && !BR.fl) {
      if (BR.phase === 'wait') CF.HUD.hint(M.solo ? 'Warm-up' : 'Warm-up · waiting for another player (room ' + CF.Net.code + ')');
      else if (BR.phase === 'ready') CF.HUD.hint('Warm-up · the Battle Bus leaves in ' + Math.ceil(BR.t));
    }
    if (BR.phase === 'over' && BR.endT >= 0) { BR.endT += raw; }
  };
  function updateItems(raw) {
    const cam = CF.Game.camera.position, R2 = 45 * 45;
    for (const it of BR.items.values()) {
      if (it.gone) continue;
      const dx = it.p.x - cam.x, dz = it.p.z - cam.z, near = dx * dx + dz * dz < R2 && Math.abs(it.p.y - cam.y) < 40;
      if (!near) { if (it.mesh) it.mesh.visible = false; continue; }
      if (!it.mesh) itemMesh(it);
      it.mesh.visible = true; it.t += raw;
      it.item.rotation.y += raw * 1.2; it.item.position.y = 0.55 + Math.sin(it.t * 2.2) * 0.06;
    }
    for (const ch of BR.chests) {
      if (!ch.mesh) continue;
      ch.mesh.visible = BR.match() && (ch.mesh.position.x - cam.x) ** 2 + (ch.mesh.position.z - cam.z) ** 2 < 110 * 110;
      if (!ch.mesh.visible) continue;
      if (ch.open) { ch.openT += raw; ch.lid.rotation.x = -1.9 * U.easeOutCubic(Math.min(1, ch.openT / 0.35)); }
      else ch.glow.material.opacity = 0.55 + Math.sin(CF.time * 3 + ch.i) * 0.25;
    }
  }

  // ------------------------------------------------------------ UI: board, notes, bar
  BR.teamNote = function () {
    if (BR.phase === 'wait' || BR.phase === 'ready') return { text: 'Warm-up: respawns are on. When the Battle Bus leaves, it\'s one life each.', css: '#ffb12a' };
    if (BR.blockSpawn()) return { text: 'You are out of this match. Watch from the menu or wait for the next one.', css: '#ff8a5a' };
    return { text: 'Last one standing wins. Stay ahead of the storm.', css: '#ffb12a' };
  };
  BR.hudText = function () {
    const st = BR.stormNow();
    const time = BR.phase === 'ready' || BR.phase === 'wait' ? fmt(BR.t) : BR.match() ? fmt(st.left) : '–:––';
    const mode = 'Battle Royale' + (BR.match() ? ' · storm ' + Math.min(STORM.length, st.k + 1) + ' / ' + STORM.length : '');
    const M = MP(), me = M.players[M.myId] || { kills: 0 };
    const score = BR.match() ? BR.alive.size + ' alive · ' + me.kills + ' kills' : BR.phase === 'over' ? 'Match over' : 'Warm-up';
    return { mode, time, score };
  };
  BR.renderBoard = function (el) {
    const M = MP();
    el.textContent = ''; el.classList.remove('ph');
    const top = document.createElement('div'); top.className = 'sb-teams';
    const a = document.createElement('b'); a.style.color = '#ffb12a'; a.textContent = BR.match() || BR.phase === 'over' ? BR.alive.size + ' alive' : 'Warm-up';
    const b = document.createElement('b'); b.style.color = '#c08cff'; b.textContent = BR.hudText().time;
    top.append(a, b); el.appendChild(top);
    const head = document.createElement('div'); head.className = 'sb-row sb-head';
    head.innerHTML = '<span>Operative</span><span>Place</span><span>Kills</span>';
    el.appendChild(head);
    const rows = Object.keys(M.players).map((id) => ({ id, p: M.players[id], pl: BR.place[id], in: BR.alive.has(id) }));
    rows.sort((x, y) => (y.in - x.in) || ((x.pl || 99) - (y.pl || 99)) || (y.p.kills - x.p.kills));
    for (const r of rows) {
      const d = document.createElement('div'); d.className = 'sb-row' + (r.id === M.myId ? ' me' : '');
      const n = document.createElement('span'); n.textContent = r.p.name; n.style.borderLeftColor = r.pl === 1 ? '#ffb12a' : r.in ? '#62d75c' : '#666';
      const pl = document.createElement('span'); pl.textContent = r.pl ? '#' + r.pl : BR.match() ? (r.in ? 'Alive' : '—') : '—'; if (r.pl === 1) pl.style.color = '#ffb12a'; else if (r.in) pl.style.color = '#62d75c';
      const k = document.createElement('span'); k.textContent = r.p.kills || 0;
      d.append(n, pl, k); el.appendChild(d);
    }
  };

  // ------------------------------------------------------------ bots
  /** Host: a bot boards the bus and picks where to land (a loot spot, usually in town). */
  BR.botBoard = function (bot) {
    if (!BR.alive.has(bot.id)) return;
    bot.spawn();
    bot.lo = KIT(); bot.ammo = { pistol: { mag: 12, reserve: 24 } }; bot.rdefs = {}; bot.equip('pistol'); bot.armor = 0; bot.hp = 100;
    bot.protect = false; bot.shield.visible = false;
    // somewhere open to the sky (a spot inside a building would put it on the roof), usually in town
    const spots = BR.openSpots || (BR.openSpots = (CF.Level.points.loot || []).filter((p) => { const h = W.raycast(p[0], 150, p[2], 0, -1, 0, 160); return h && Math.abs(h.y - p[1]) < 0.6 && reach({}, p[1], p[0], p[2]); }));
    if (!spots.length) spots.push([0, 0, 0]);
    let s = spots[(Math.random() * spots.length) | 0];
    for (let i = 0; i < 3 && Math.hypot(s[0], s[2]) > 90; i++) s = spots[(Math.random() * spots.length) | 0];
    bot.landAt = { x: s[0] + U.rand(-3, 3), z: s[2] + U.rand(-3, 3) };
    const b = BR.bus, along = ((bot.landAt.x - b[0]) * BR.busDir.x + (bot.landAt.z - b[1]) * BR.busDir.z) / BR.busLen;
    bot.jumpAt = U.clamp(along * BR.busDur + U.rand(-2.5, 1.5), 2, BR.busDur - 1);
    bot.fl = 3; bot.root.visible = false; bot.target = null; bot.path = null; bot.goal = null; bot.skip = null;
  };
  /** Host: the bot's body while it rides, falls and glides (in place of walking physics). */
  BR.botFly = function (bot, dt) {
    const b = bot.body;
    if (bot.fl === 3) {
      BR.busPos(BR.clock, b.pos); b.pos.y -= 1.2;
      const open = BR.doorsOpen();
      if ((open && BR.clock >= bot.jumpAt) || BR.clock >= BR.busDur - 0.5 || BR.phase === 'storm') {
        b.pos.y -= 2; b.pos.x = U.clamp(b.pos.x, -OPEN + 4, OPEN - 4); b.pos.z = U.clamp(b.pos.z, -OPEN + 4, OPEN - 4);
        b.vel.set(BR.busDir.x * 9, -4, BR.busDir.z * 9); bot.fl = 1; bot.root.visible = true; bot.gy = null;
      }
      return;
    }
    bot.gT = (bot.gT || 0) - dt;
    if (bot.gy == null || bot.gT <= 0) { bot.gT = 0.15; const h = W.raycast(b.pos.x, b.pos.y, b.pos.z, 0, -1, 0, 400); bot.gy = h ? h.y : 0; }
    const above = b.pos.y - bot.gy;
    if (bot.fl === 1 && above < DEPLOY) bot.fl = 2;
    const tx = bot.landAt.x - b.pos.x, tz = bot.landAt.z - b.pos.z, d = Math.hypot(tx, tz) || 1;
    const hs = Math.min(bot.fl === 1 ? FALL_H : GLIDE_H, d * 0.8);
    b.vel.x = U.damp(b.vel.x, tx / d * hs, 2, dt); b.vel.z = U.damp(b.vel.z, tz / d * hs, 2, dt);
    b.vel.y = U.damp(b.vel.y, bot.fl === 1 ? (d > 40 && above > 60 ? -FALL * 0.8 : -FALL) : -GLIDE_V, 2, dt);
    b.grounded = false; b.noSnap = true; W.moveBody(b, dt); b.noSnap = false;
    if (d > 2) bot.yaw += U.wrapAngle(Math.atan2(-tx, -tz) - bot.yaw) * Math.min(1, dt * 3);
    if (b.grounded) { bot.fl = 0; b.vel.set(0, 0, 0); bot.planT = 0; bot.lootT = 0; }
  };
  const botUse = (bot, it) => {
    if (it.k === 'w') { if (!BOT_RANK[it.w]) return false; const own = bot.ammo[it.w]; if (own) return (bot.rdefs[it.w] ? bot.rdefs[it.w].rar || 0 : 0) < it.r || own.reserve < D()[it.w].mag * 2; return true; }
    if (it.k === 'ammo') return Object.keys(bot.ammo).some((w) => bot.ammo[w].reserve < D()[w].mag * 3);
    if (it.k === 'armor') return bot.armor < 100;
    if (it.k === 'med') return bot.hp < 100;
    return false;
  };
  /** Can a bot walk to this spot? (The grid maps one floor per spot: a house's ground floor reads as its upstairs.) */
  function reach(o, y, x, z) {
    if (o.reach != null) return o.reach;
    const nav = W.nav, i = nav ? W.cellAt(x, z) : -1;
    return (o.reach = i >= 0 && !!nav.walk[i] && Math.abs(nav.hgt[i] - y) < 0.7 && nav.comp[i] === nav.mainComp);
  }
  const botScore = (bot, w) => (BOT_RANK[w] || 0) + (bot.rdefs[w] ? (bot.rdefs[w].rar || 0) * 0.6 : 0);
  /** Host: hand a bot what it picked up, and pull out its best gun. */
  BR.grantBot = function (bot, it) {
    if (!bot.alive) return;
    if (it.k === 'w') {
      const d = D()[it.w];
      if (bot.ammo[it.w] && (bot.rdefs[it.w] ? bot.rdefs[it.w].rar || 0 : 0) >= it.r) { bot.ammo[it.w].reserve += it.mag + it.res; return; }
      const guns = Object.keys(bot.ammo);
      if (!bot.ammo[it.w] && guns.length >= 3) { // full: throw out the worst
        const worst = guns.sort((a, b) => botScore(bot, a) - botScore(bot, b))[0];
        BR.hostDrop([{ k: 'w', w: worst, r: bot.rdefs[worst] ? bot.rdefs[worst].rar || 0 : 0, mag: bot.ammo[worst].mag, res: bot.ammo[worst].reserve }], [bot.body.pos.x, bot.body.pos.y, bot.body.pos.z]);
        delete bot.ammo[worst]; delete bot.lo.weapons[worst]; delete bot.rdefs[worst];
      }
      bot.ammo[it.w] = { mag: it.mag, reserve: it.res }; bot.lo.weapons[it.w] = { mag: d.mag, reserve: it.res };
      bot.rdefs[it.w] = BR.rdef(it.w, it.r);
      const best = Object.keys(bot.ammo).sort((a, b) => botScore(bot, b) - botScore(bot, a))[0];
      if (best !== bot.wid) { bot.equip(best); bot.cd = 0.4; }
    } else if (it.k === 'ammo') { for (const w in bot.ammo) bot.ammo[w].reserve += boxAmmo(D()[w]); }
    else if (it.k === 'armor') bot.armor = Math.min(100, bot.armor + it.n);
    else if (it.k === 'med') bot.hp = Math.min(100, bot.hp + it.n);
  };
  function botSpill(bot) {
    const list = [];
    for (const w in bot.ammo) { if (w === 'pistol' && !(bot.rdefs[w] && bot.rdefs[w].rar)) continue; list.push({ k: 'w', w, r: bot.rdefs[w] ? bot.rdefs[w].rar || 0 : 0, mag: bot.ammo[w].mag, res: bot.ammo[w].reserve }); }
    list.push({ k: 'ammo', n: 1 }); if (Math.random() < 0.5) list.push({ k: 'med', n: 25 });
    BR.hostDrop(list, [bot.body.pos.x, bot.body.pos.y, bot.body.pos.z]);
  }
  /** The circle a bot should be in: the next one once the storm is about to move. */
  BR.safeFor = function () { const st = BR.stormNow(); return st.stage === 'shrink' || st.left < 25 ? { x: st.nx, z: st.nz, r: st.nr } : { x: st.x, z: st.z, r: st.r }; };
  /** Host: the Battle Royale part of a bot's brain. True when it took over this frame. */
  BR.botThink = function (bot, dt) {
    if (!BR.match()) return false;
    if (bot.fl) { bot.wish.set(0, 0, 0); return true; }
    const b = bot.body.pos, speed = 5.1 * (bot.speedMul || 1);
    // pick up whatever it's standing on
    bot.lootT = (bot.lootT || 0) - dt;
    if (bot.lootT <= 0) {
      bot.lootT = 0.25;
      for (const it of BR.items.values()) if (!it.gone && Math.abs(it.p.x - b.x) < 1.5 && Math.abs(it.p.z - b.z) < 1.5 && Math.abs(it.p.y - b.y) < 1.6 && botUse(bot, it)) { send({ op: 'gone', i: it.i, by: bot.id }); break; }
      for (const ch of BR.chests) if (!ch.open && Math.hypot(ch.x - b.x, ch.z - b.z) < 1.6 && Math.abs(ch.y - b.y) < 1.5) { bot.chestT = (bot.chestT || 0) + 0.25; if (bot.chestT > 0.6) { bot.chestT = 0; send({ op: 'open', c: ch.i, by: bot.id }); } }
    }
    // stranded somewhere the grid doesn't know (a roof): head off in some direction and hop the parapet
    const nav = W.nav, ci = nav ? W.cellAt(b.x, b.z) : -1;
    if (nav && bot.body.grounded && (ci < 0 || !nav.walk[ci] || b.y - nav.hgt[ci] > 1.5)) {
      if (!bot.esc || CF.time - bot.esc.t > 5) { const a = Math.random() * Math.PI * 2; bot.esc = { x: Math.cos(a), z: Math.sin(a), t: CF.time }; }
      bot.path = null; bot.goal = null; bot.wish.set(bot.esc.x * speed, 0, bot.esc.z * speed);
      if (!bot.target) bot.turnTo(Math.atan2(-bot.esc.x, -bot.esc.z), dt);
      return !bot.target;
    }
    // the storm comes first
    const safe = BR.safeFor(), d = Math.hypot(b.x - safe.x, b.z - safe.z), near = !!bot.target;
    if (d > Math.max(2, safe.r - 4) && (!near || d > safe.r + 12)) {
      if (!bot.goal || !bot.goal.storm || !bot.path) {
        const k = safe.r * 0.45 / Math.max(1, d), gx = safe.x + (b.x - safe.x) * k, gz = safe.z + (b.z - safe.z) * k;
        const i = W.randomReachable(gx, gz, Math.max(3, safe.r * 0.3));
        bot.setGoal({ x: i >= 0 ? W.cellX(i) : gx, z: i >= 0 ? W.cellZ(i) : gz, storm: true });
      }
      bot.walkPath(speed * 1.05, 2.5);
      const w = bot.wish; if (!bot.target && (w.x || w.z)) bot.turnTo(Math.atan2(-w.x, -w.z), dt);
      return !bot.target;
    }
    if (bot.goal && bot.goal.storm) { bot.goal = null; bot.path = null; }
    // poorly armed and nobody in sight: go shopping
    if (!bot.target) {
      const weak = Object.keys(bot.ammo).length < 2 || bot.armor < 50 || bot.hp < 70;
      bot.shopT = (bot.shopT || 0) - dt;
      if (weak && (bot.shopT <= 0 || !bot.goal || !bot.goal.loot)) {
        bot.shopT = 2;
        // gave up on it: it hasn't got any closer for a while (behind glass, up on a floor the grid doesn't know)
        const g = bot.goal;
        if (g && g.loot) { const dd = Math.hypot(g.x - b.x, g.z - b.z); if (dd < (g.best || 1e9) - 1) { g.best = dd; g.t = CF.time; } else if (CF.time - g.t > 7) { (bot.skip || (bot.skip = new Set())).add(g.key); bot.goal = null; bot.path = null; } }
        let best = null, bs = 45;
        for (const it of BR.items.values()) {
          if (it.gone || !botUse(bot, it) || (bot.skip && bot.skip.has('i' + it.i)) || !reach(it, it.p.y, it.p.x, it.p.z)) continue;
          const dd = Math.hypot(it.p.x - b.x, it.p.z - b.z) - (it.k === 'w' ? 12 : 0) + Math.abs(it.p.y - b.y) * 2;
          if (dd < bs && Math.hypot(it.p.x - safe.x, it.p.z - safe.z) < safe.r) { bs = dd; best = { x: it.p.x, z: it.p.z, key: 'i' + it.i }; }
        }
        for (const ch of BR.chests) { if (ch.open || (bot.skip && bot.skip.has('c' + ch.i)) || !reach(ch, ch.y, ch.x, ch.z)) continue; const dd = Math.hypot(ch.x - b.x, ch.z - b.z) - 15 + Math.abs(ch.y - b.y) * 2; if (dd < bs) { bs = dd; best = { x: ch.x, z: ch.z, key: 'c' + ch.i }; } }
        if (best && (!g || !g.loot || g.key !== best.key)) { best.loot = true; best.t = CF.time; bot.setGoal(best); }
      }
      if (bot.goal && bot.goal.loot) {
        if (bot.path) { bot.walkPath(speed); const w = bot.wish; if (w.x || w.z) bot.turnTo(Math.atan2(-w.x, -w.z), dt); return true; }
        bot.goal = null;
      }
    }
    return false;
  };
  /** Host: where a bot wanders when nobody is in sight (inside the safe circle; sometimes after someone). */
  BR.botGoal = function (bot) {
    const safe = BR.safeFor(), b = bot.body.pos;
    if (Math.random() < 0.5) {
      let best = null, bd = Infinity;
      for (const id of BR.alive) {
        if (id === bot.id) continue;
        const r = id === MP().myId ? { body: CF.Player.body } : MP().remotes[id]; if (!r) continue;
        const dd = Math.hypot(r.body.pos.x - b.x, r.body.pos.z - b.z); if (dd < bd) { bd = dd; best = { x: r.body.pos.x, z: r.body.pos.z, id }; }
      }
      if (best && bd < 90) return best;
    }
    const i = W.randomReachable(safe.x, safe.z, Math.max(4, safe.r * 0.7));
    return i >= 0 ? { x: W.cellX(i), z: W.cellZ(i) } : { x: safe.x, z: safe.z };
  };
})(window.CF);
