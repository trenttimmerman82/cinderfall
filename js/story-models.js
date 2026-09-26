'use strict';
/* Cinderfall — Story Campaign (Dust Off) people and vehicles.
   People share one skeleton (hips → legs/knees/feet, torso → head, arms/elbows/hands, gun) and one animation
   (CF.Human.pose / CF.Human.death): the hands are placed on the weapon with two-bone IK, so rifles look held.
   'standard' models are built here from a few dozen primitives; the 'enhanced' builder (js/enemy-models-enhanced.js,
   loaded only when that setting is picked) returns the same parts with far more detail. */
(function (CF) {
  const U = CF.U;
  const H = CF.Human = { hd: null };
  const G = {};
  const box = () => G.box || (G.box = new THREE.BoxGeometry(1, 1, 1));
  const cyl = () => G.cyl || (G.cyl = new THREE.CylinderGeometry(1, 1, 1, 10));
  const cylHi = () => G.cylHi || (G.cylHi = new THREE.CylinderGeometry(1, 1, 1, 16));
  const sph = () => G.sph || (G.sph = new THREE.SphereGeometry(1, 12, 9));
  const cone = () => G.cone || (G.cone = new THREE.ConeGeometry(1, 1, 10));
  const caps = () => G.caps || (G.caps = new THREE.CapsuleGeometry(1, 1, 3, 8));
  const MATS = {};
  /** Shared material by colour (people are not flashed on hit, so instances can share). */
  const mat = (c, rough, metal, o) => {
    const k = c + '|' + (rough || 0.85) + '|' + (metal || 0) + (o ? JSON.stringify(o) : '');
    // colours are picked as sRGB swatches; the renderer lights in linear space, so convert (otherwise skin and cloth wash out)
    return MATS[k] || (MATS[k] = new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c).convertSRGBToLinear(), roughness: rough || 0.85, metalness: metal || 0, envMapIntensity: 0.35 }, o || {})));
  };
  H.mat = mat;
  function m(parent, geo, mt, x, y, z, sx, sy, sz, rx, ry, rz) {
    const o = new THREE.Mesh(geo, mt);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0);
    o.castShadow = true; parent.add(o); return o;
  }
  const B = (p, mt, x, y, z, sx, sy, sz, rx, ry, rz) => m(p, box(), mt, x, y, z, sx, sy, sz, rx, ry, rz);
  const grp = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  const hs = (obj, x, y, z, r, mult, tag, extra) => Object.assign({ obj, off: new THREE.Vector3(x, y, z), r, mult, tag, w: new THREE.Vector3() }, extra || {});
  H.helpers = { m, B, grp, hs, box, cyl, cylHi, sph, cone, caps };

  // ---------------------------------------------------------------- who wears what
  const SKIN = [0xc98f63, 0xa8744e, 0x8d5a3a, 0xdcae88, 0x6e4529, 0xb88660];
  const LOOKS = {
    militia: { shirt: [0x6b5a44, 0x3e4a3a, 0x5c4a3a, 0x7a6f5a, 0x34383c, 0x8a7c66], pants: [0x3b3a33, 0x4a4436, 0x2e3032, 0x5e5444], vest: [0x3a3a2e, 0x4a4030, 0x2e2e28],
      head: ['wrap', 'wrap', 'wrap', 'bare', 'cap'], wrap: [0xd8cfc0, 0x9a3a2a, 0x2c2c2c, 0x8a7a5a], beard: 0.6, gun: 'ak' },
    gunner: { shirt: [0x4a4436, 0x3e4a3a], pants: [0x3b3a33], vest: [0x2e2e28], head: ['wrap'], wrap: [0x2c2c2c, 0x9a3a2a], beard: 0.9, gun: 'pkm', bulk: 1.1, belt: true },
    rpg: { shirt: [0x5c4a3a, 0x7a6f5a, 0x6b5a44], pants: [0x3b3a33, 0x4a4436], vest: [0x4a4030], head: ['wrap', 'bare'], wrap: [0xd8cfc0, 0x2c2c2c], beard: 0.7, gun: 'rpg', rockets: true },
    guard: { shirt: [0x25282d], pants: [0x1f2226], vest: [0x2b2e31], head: ['beret'], wrap: [0x6a1c1c], beard: 0.4, gun: 'ak', torch: true },
    officer: { shirt: [0x505338], pants: [0x464832], vest: null, head: ['peak'], wrap: [0x464832], beard: 1, gun: 'pistol', belt: true, officer: true },
    sniper: { shirt: [0x7a6a50, 0x6b5a44], pants: [0x4a4436], vest: [0x5a5040], head: ['wrap'], wrap: [0xb8a888, 0x8a7a5a], beard: 0.7, gun: 'svd' },
    friendly: { shirt: [0x8a7a58, 0x7f7052], pants: [0x7c6c4e, 0x746448], vest: [0x5e5238, 0x544a34], head: ['helmet'], wrap: [0x6e6a52], beard: 0.15, gun: 'm4', friendly: true },
    pow: { shirt: [0x8c7a5c, 0x7e6e54], pants: [0x7e6e54], vest: null, head: ['bare'], wrap: [0x2a2420], beard: 0.8, gun: null, pow: true }
  };
  H.LOOKS = LOOKS;
  /** A random outfit for a look (seeded so allies keep their faces between checkpoints). */
  H.outfit = function (look, seed) {
    const L = LOOKS[look] || LOOKS.militia, rnd = U.mulberry32(seed != null ? seed : (Math.random() * 1e9) | 0), pick = (a) => a[Math.floor(rnd() * a.length)];
    return { look, L, rnd, skin: pick(SKIN), shirt: pick(L.shirt), pants: pick(L.pants), vest: L.vest ? pick(L.vest) : null, head: pick(L.head), wrap: pick(L.wrap), beard: rnd() < L.beard, hair: rnd() < 0.8 ? 0x1c1712 : 0x3a2c20, bulk: (L.bulk || 1) * (0.95 + rnd() * 0.1), gun: L.gun };
  };

  // ---------------------------------------------------------------- weapons (gun space: forward -Z, origin at the shoulder pocket / grip)
  function gunModel(kind, gunG, hd) {
    const metal = mat(0x1d1f22, 0.5, 0.7), wood = mat(0x6b3f22, 0.6, 0.05), olive = mat(0x4a5038, 0.6, 0.2), tan = mat(0x5a4e3e, 0.7, 0.1);
    const g = { grip: new THREE.Vector3(0, -0.07, -0.2), fore: new THREE.Vector3(0, -0.04, -0.46), kind };
    if (kind === 'ak' || kind === 'svd') {
      const long = kind === 'svd';
      B(gunG, wood, 0, -0.01, 0.02, 0.045, 0.1, 0.24, -0.12, 0, 0);          // stock
      B(gunG, metal, 0, 0.0, -0.24, 0.05, 0.075, 0.3);                        // receiver
      B(gunG, wood, 0, -0.07, -0.18, 0.035, 0.1, 0.045, 0.3, 0, 0);          // pistol grip
      B(gunG, wood, 0, -0.012, -0.47, 0.05, 0.055, long ? 0.22 : 0.18);      // handguard
      if (!long) { const mg = B(gunG, metal, 0, -0.1, -0.33, 0.04, 0.16, 0.06, -0.35, 0, 0); mg.material = metal; } // curved magazine (straight here)
      else { B(gunG, metal, 0, -0.07, -0.3, 0.04, 0.09, 0.06); m(gunG, cyl(), metal, 0, 0.07, -0.28, 0.025, 0.2, 0.025, Math.PI / 2, 0, 0); }
      m(gunG, cyl(), metal, 0, 0.012, long ? -0.78 : -0.66, 0.013, long ? 0.44 : 0.3, 0.013, Math.PI / 2, 0, 0);
      B(gunG, metal, 0, 0.04, long ? -0.95 : -0.74, 0.012, 0.04, 0.012);
      g.muzzle = grp(gunG, 0, 0.012, long ? -1.02 : -0.82);
      if (long) g.fore.set(0, -0.04, -0.52);
    } else if (kind === 'm4') {
      B(gunG, metal, 0, -0.005, 0.03, 0.045, 0.09, 0.2, -0.08, 0, 0);
      B(gunG, metal, 0, 0.0, -0.23, 0.045, 0.08, 0.3);
      B(gunG, tan, 0, -0.005, -0.47, 0.055, 0.06, 0.22);
      B(gunG, metal, 0, -0.1, -0.3, 0.035, 0.14, 0.055, -0.15, 0, 0);
      B(gunG, metal, 0, -0.07, -0.16, 0.032, 0.09, 0.04, 0.3, 0, 0);
      B(gunG, metal, 0, 0.065, -0.24, 0.035, 0.04, 0.08);                    // optic
      m(gunG, cyl(), metal, 0, 0.0, -0.66, 0.012, 0.2, 0.012, Math.PI / 2, 0, 0);
      g.muzzle = grp(gunG, 0, 0, -0.77);
    } else if (kind === 'pkm') {
      B(gunG, wood, 0, -0.02, 0.03, 0.045, 0.12, 0.26, -0.12, 0, 0);
      B(gunG, metal, 0, 0.0, -0.28, 0.07, 0.1, 0.38);
      B(gunG, olive, 0.06, -0.12, -0.3, 0.1, 0.12, 0.14);                     // ammo box
      m(gunG, cyl(), metal, 0, 0.02, -0.78, 0.018, 0.56, 0.018, Math.PI / 2, 0, 0);
      for (const s of [-1, 1]) B(gunG, metal, s * 0.08, -0.12, -0.9, 0.01, 0.2, 0.01, 0, 0, s * 0.4); // bipod
      g.muzzle = grp(gunG, 0, 0.02, -1.07); g.fore.set(0, -0.05, -0.5);
    } else if (kind === 'rpg') {
      m(gunG, cylHi(), olive, 0, 0, -0.1, 0.042, 1.1, 0.042, Math.PI / 2, 0, 0);
      m(gunG, cone(), olive, 0, 0, -0.78, 0.07, 0.3, 0.07, -Math.PI / 2, 0, 0);          // warhead
      m(gunG, cylHi(), olive, 0, 0, -0.6, 0.05, 0.14, 0.05, Math.PI / 2, 0, 0);
      m(gunG, cone(), metal, 0, 0, 0.5, 0.07, 0.14, 0.07, -Math.PI / 2, 0, 0);          // venturi
      B(gunG, wood, 0, -0.08, -0.18, 0.03, 0.1, 0.04, 0.2, 0, 0); B(gunG, wood, 0, -0.08, -0.36, 0.03, 0.1, 0.04, 0.2, 0, 0);
      g.muzzle = grp(gunG, 0, 0, -0.95); g.grip.set(0, -0.12, -0.18); g.fore.set(0, -0.12, -0.36);
    } else if (kind === 'pistol') {
      B(gunG, metal, 0, 0.03, -0.06, 0.03, 0.035, 0.16);
      B(gunG, metal, 0, -0.03, -0.01, 0.028, 0.09, 0.035, 0.25, 0, 0);
      g.muzzle = grp(gunG, 0, 0.03, -0.15); g.grip.set(0, -0.04, 0); g.fore.set(-0.02, -0.05, 0.01);
    }
    gunG.traverse((o) => { if (o.isMesh) o.castShadow = !hd || o.scale.z > 0.1; });
    return g;
  }
  H.gunModel = gunModel;

  // ---------------------------------------------------------------- standard person
  /** The same skeleton the enhanced models use; limbs here are simple boxes and capsules. */
  H.skeleton = function () {
    const root = new THREE.Group(), p = {};
    p.hips = grp(root, 0, 0.98, 0);
    for (const s of [-1, 1]) {
      const leg = grp(p.hips, s * 0.1, -0.03, 0), knee = grp(leg, 0, -0.44, 0), foot = grp(knee, 0, -0.43, 0);
      p[s < 0 ? 'legL' : 'legR'] = leg; p[s < 0 ? 'kneeL' : 'kneeR'] = knee; p[s < 0 ? 'footL' : 'footR'] = foot;
    }
    p.torso = grp(p.hips, 0, 0.06, 0);
    p.head = grp(p.torso, 0, 0.54, 0);
    for (const s of [-1, 1]) {
      const arm = grp(p.torso, s * 0.21, 0.44, 0), el = grp(arm, 0, -0.28, 0), hand = grp(el, 0, -0.26, 0);
      p[s < 0 ? 'armL' : 'armR'] = arm; p[s < 0 ? 'elbowL' : 'elbowR'] = el; p[s < 0 ? 'handL' : 'handR'] = hand;
    }
    p.gun = grp(p.torso, 0.13, 0.4, -0.06);
    return { root, p };
  };
  function standard(look, seed) {
    const O = H.outfit(look, seed), L = O.L, { root, p } = H.skeleton();
    const skin = mat(O.skin, 0.7), shirt = mat(O.shirt, 0.92), pants = mat(O.pants, 0.92), boot = mat(0x2a2420, 0.8), dark = mat(0x151515, 0.6);
    const vest = O.vest ? mat(O.vest, 0.9) : null, wrap = mat(O.wrap, 0.95), bk = O.bulk;
    // legs
    for (const s of ['L', 'R']) {
      m(p['leg' + s], caps(), pants, 0, -0.22, 0, 0.085 * bk, 0.17, 0.09 * bk);
      m(p['knee' + s], caps(), pants, 0, -0.21, 0, 0.068 * bk, 0.17, 0.07 * bk);
      B(p['foot' + s], boot, 0, -0.03, -0.05, 0.1, 0.09, 0.26);
    }
    B(p.hips, pants, 0, 0, 0, 0.34 * bk, 0.18, 0.2);
    // torso
    m(p.torso, caps(), shirt, 0, 0.26, 0, 0.19 * bk, 0.18, 0.13 * bk);
    if (vest) { B(p.torso, vest, 0, 0.28, 0, 0.36 * bk, 0.3, 0.26 * bk); for (const x of [-0.1, 0, 0.1]) B(p.torso, vest, x * bk, 0.2, -0.14 * bk, 0.08, 0.1, 0.06); }
    if (L.belt || O.look === 'gunner') B(p.torso, mat(0x9a7a2a, 0.5, 0.6), 0, 0.3, -0.005, 0.05, 0.42, 0.28 * bk, 0, 0, 0.8);
    if (L.officer) { B(p.torso, mat(0x2a2016, 0.6), 0, 0.02, 0, 0.36, 0.05, 0.24); for (const x of [-0.09, -0.05]) B(p.torso, mat(0xc0a040, 0.4, 0.8), x, 0.36, -0.135, 0.03, 0.015, 0.01); }
    if (L.rockets) for (const x of [-0.07, 0.07]) m(p.torso, cone(), mat(0x4a5038, 0.6, 0.2), x, 0.42, 0.16, 0.05, 0.28, 0.05, 0, 0, 0);
    m(p.torso, cyl(), skin, 0, 0.5, 0, 0.055, 0.08, 0.055);
    // head
    const hd = p.head;
    m(hd, sph(), skin, 0, 0.12, -0.01, 0.095, 0.115, 0.105);
    m(hd, sph(), skin, 0, 0.1, -0.1, 0.022, 0.03, 0.025);                                        // nose
    for (const x of [-0.035, 0.035]) B(hd, dark, x, 0.14, -0.1, 0.022, 0.01, 0.01);             // eyes
    if (O.beard) m(hd, sph(), mat(O.hair, 0.95), 0, 0.05, -0.04, 0.085, 0.07, 0.08);
    if (O.head === 'wrap') { m(hd, sph(), wrap, 0, 0.17, 0.0, 0.108, 0.1, 0.115); m(hd, cyl(), wrap, 0, 0.0, 0.01, 0.1, 0.09, 0.1); }
    else if (O.head === 'helmet') { m(hd, sph(), mat(0x6e6a52, 0.7, 0.1), 0, 0.17, 0.0, 0.125, 0.105, 0.135); B(hd, mat(0x111111, 0.3, 0.5), 0, 0.26, -0.09, 0.09, 0.03, 0.04); }
    else if (O.head === 'beret') { m(hd, sph(), mat(0x1a1a1a, 0.95), 0, 0.2, 0.0, 0.1, 0.06, 0.11); m(hd, sph(), wrap, 0.02, 0.23, 0.01, 0.11, 0.045, 0.1, 0, 0, -0.25); }
    else if (O.head === 'peak') { m(hd, cylHi(), wrap, 0, 0.23, 0, 0.11, 0.07, 0.115); B(hd, dark, 0, 0.2, -0.11, 0.18, 0.012, 0.08); B(hd, mat(0xc0a040, 0.4, 0.8), 0, 0.24, -0.113, 0.04, 0.03, 0.01); }
    else if (O.head === 'cap') { m(hd, sph(), wrap, 0, 0.19, 0, 0.1, 0.07, 0.11); B(hd, wrap, 0, 0.17, -0.12, 0.13, 0.012, 0.07); }
    else m(hd, sph(), mat(O.hair, 0.95), 0, 0.17, 0.01, 0.1, 0.075, 0.108);
    // arms
    for (const s of ['L', 'R']) {
      m(p['arm' + s], caps(), shirt, 0, -0.13, 0, 0.058 * bk, 0.13, 0.058 * bk);
      m(p['elbow' + s], caps(), L.pow || L.officer ? shirt : shirt, 0, -0.12, 0, 0.048, 0.12, 0.048);
      B(p['hand' + s], L.friendly ? mat(0x3a3428, 0.9) : skin, 0, -0.03, 0, 0.06, 0.1, 0.035);
    }
    const g = O.gun ? gunModel(O.gun, p.gun, false) : null;
    if (!g) p.gun.visible = false;
    let torch = null;
    if (L.torch && g) torch = H.torch(p.gun);
    return finish(root, p, O, g, torch, false);
  }
  /** Flashlight beam under the barrel (villa guards at night). Additive cone, no real light. */
  H.torch = function (gunG) {
    const geo = new THREE.ConeGeometry(1.6, 9, 16, 1, true); geo.translate(0, -4.5, 0); geo.rotateX(Math.PI / 2);
    const mt = G.torchMat || (G.torchMat = new THREE.ShaderMaterial({
      vertexShader: 'varying float vZ; varying float vF; void main(){ vZ = -position.z / 9.0; vec4 mv = modelViewMatrix*vec4(position,1.0); vec3 n = normalize(normalMatrix*normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying float vZ; varying float vF; void main(){ float a = pow(1.0 - clamp(vZ, 0.0, 1.0), 2.0) * pow(vF, 1.5) * 0.35; gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * a, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    const t = new THREE.Mesh(geo, mt); t.position.set(0, -0.03, -0.5); t.renderOrder = 6; t.frustumCulled = false;
    const bulb = new THREE.Mesh(sph(), G.bulbMat || (G.bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 3) }))); bulb.scale.setScalar(0.02); bulb.position.set(0, -0.03, -0.48);
    gunG.add(t); gunG.add(bulb); t.userData.bulb = bulb;
    return t;
  };
  function finish(root, p, O, g, torch, hd) {
    const hit = [
      hs(p.head, 0, 0.12, -0.01, 0.12, 2.0, 'head'),
      hs(p.torso, 0, 0.3, 0, 0.21, 1, 'body'), hs(p.torso, 0, 0.08, 0, 0.18, 1, 'body'), hs(p.hips, 0, 0, 0, 0.17, 0.9, 'body'),
      hs(p.legL, 0, -0.22, 0, 0.1, 0.75, 'limb'), hs(p.legR, 0, -0.22, 0, 0.1, 0.75, 'limb'),
      hs(p.kneeL, 0, -0.2, 0, 0.085, 0.7, 'limb'), hs(p.kneeR, 0, -0.2, 0, 0.085, 0.7, 'limb'),
      hs(p.armL, 0, -0.14, 0, 0.075, 0.7, 'limb'), hs(p.armR, 0, -0.14, 0, 0.075, 0.7, 'limb'),
      hs(p.elbowL, 0, -0.12, 0, 0.07, 0.7, 'limb'), hs(p.elbowR, 0, -0.12, 0, 0.07, 0.7, 'limb')
    ];
    if (g) { p.muzzle = g.muzzle; p.gunTip = g.muzzle; }
    else p.muzzle = grp(p.torso, 0, 0.4, -0.3);
    return {
      root, p, hit, mats: [], eyeMat: null, gibs: g ? [p.gun] : [], height: 1.85, radius: 0.36, human: true, hd, outfit: O, gunSpec: g, torch,
      pose: (e, dt, sp) => H.pose(e.m, e, dt, sp), death: (e, dt) => H.death(e.m, e, dt)
    };
  }
  H.finish = finish;

  /** A person for this look, in the detail the player picked (enhanced only if its script has loaded). */
  H.make = function (look, seed) {
    if (CF.settings.characters === 'enhanced' && H.hd) return H.hd(look, seed);
    return standard(look, seed);
  };
  H.standard = standard;

  // ---------------------------------------------------------------- animation
  const DOWN = new THREE.Vector3(0, -1, 0), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _e = new THREE.Vector3(), _d = new THREE.Vector3(), _b = new THREE.Vector3(), _pole = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
  const UA = 0.28, FA = 0.3; // upper arm, forearm + hand reach
  /** Two-bone IK: put arm (shoulder group) + elbow so the hand lands on target (torso space). */
  function reach(arm, elbow, target, side) {
    _s.copy(arm.position); _d.subVectors(target, _s);
    let d = _d.length(); d = U.clamp(d, Math.abs(UA - FA) + 0.02, UA + FA - 0.002); _d.normalize();
    const cosA = U.clamp((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    _pole.set(side * 0.7, -1, 0.35); _b.copy(_pole).addScaledVector(_d, -_pole.dot(_d)).normalize();
    _e.copy(_s).addScaledVector(_d, UA * cosA).addScaledVector(_b, UA * sinA);
    arm.quaternion.setFromUnitVectors(DOWN, _t.subVectors(_e, _s).normalize());
    _t.copy(_s).addScaledVector(_d, d).sub(_e).normalize();
    _qi.copy(arm.quaternion).invert(); _t.applyQuaternion(_qi);
    elbow.quaternion.setFromUnitVectors(DOWN, _t);
  }
  H.reach = reach;
  // gun holds: [position, euler] in torso space for aimed and relaxed carry
  const HOLD = {
    rifle: { aim: [0.13, 0.4, -0.06, 0, 0.04, 0], low: [0.16, 0.26, -0.16, -0.62, 0.55, 0.3] },
    pkm: { aim: [0.15, 0.24, -0.02, 0.05, 0.06, 0], low: [0.16, 0.2, -0.1, -0.45, 0.5, 0.2] },
    rpg: { aim: [0.13, 0.52, 0.05, 0, 0.02, 0], low: [0.2, 0.3, 0.02, -1.0, 0.3, 0.3] },
    pistol: { aim: [0.06, 0.36, -0.44, 0, 0.1, 0], low: [0.22, 0.02, -0.12, -1.2, 0, 0] }
  };
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler();
  /** Walk/run, aim or carry, breathe, flinch. Works for enemies and allies (ally objects expose the same fields). */
  H.pose = function (M, e, dt, speed) {
    const p = M.p, T = e.T || {}, g = M.gunSpec;
    const run = T.run || 4.4, amp = U.clamp(speed / Math.max(run, 0.1), 0, 1.3);
    e.phase = (e.phase || 0) + dt * (4.2 + speed * 1.15) * (speed > 0.15 ? 1 : 0);
    const ph = e.phase, fl = e.flinch || 0, stag = e.staggerT > 0;
    const armed = !!g, combat = e.state === 'combat' || e.state === 'hunt' || e.aiming;
    e.aimK = U.damp(e.aimK || 0, combat && armed ? 1 : 0, 6, dt);
    const aimK = e.aimK, crouch = e.crouch || 0;
    // legs
    const stride = 0.5 + Math.max(0, amp - 0.6) * 0.5;
    for (const [s, o] of [['L', 0], ['R', Math.PI]]) {
      const sn = Math.sin(ph + o), cs = Math.cos(ph + o);
      const th = sn * stride * amp + crouch * 0.9, kn = -(0.08 + 0.95 * Math.max(0, cs)) * amp - crouch * 1.5;
      p['leg' + s].rotation.x = th; p['knee' + s].rotation.x = kn; p['foot' + s].rotation.x = -(th + kn) * 0.7;
    }
    const breath = Math.sin(CF.time * 1.9 + (e.seedPh || 0)) * 0.012;
    p.hips.position.y = 0.98 - Math.abs(Math.cos(ph)) * 0.035 * amp + 0.02 * amp - crouch * 0.32 - (stag ? 0.08 : 0);
    // torso: lean into a run, tip back to aim high, flinch
    const lean = -Math.max(0, amp - 0.7) * 0.28;
    p.torso.rotation.x = U.damp(p.torso.rotation.x, (e.aimPitch || 0) * 0.75 * aimK + lean * (1 - aimK * 0.6) - fl * 0.35 + (stag ? -0.3 : 0) + breath + crouch * 0.25, 10, dt);
    p.torso.rotation.y = armed ? Math.sin(ph) * 0.05 * amp * (1 - aimK) : Math.sin(ph) * 0.1 * amp;
    p.torso.rotation.z = Math.sin(ph) * 0.03 * amp + (Math.random() - 0.5) * fl * 0.15;
    p.head.rotation.x = (e.aimPitch || 0) * 0.2 * aimK + (aimK > 0.5 ? 0.12 : 0) - lean * 0.5 + (e.lookDown || 0);
    p.head.rotation.y = U.damp(p.head.rotation.y, e.headYaw || (aimK > 0.5 ? -0.12 : Math.sin(CF.time * 0.37 + (e.seedPh || 0)) * 0.3 * (speed < 0.2 ? 1 : 0.2)), 4, dt);
    if (!armed) {
      if (e.handsUp) { reach(p.armL, p.elbowL, _pa.set(-0.14, 0.72, -0.05), -1); reach(p.armR, p.elbowR, _pb.set(0.14, 0.72, -0.05), 1); }
      else {
        const sw = Math.sin(ph) * 0.45 * amp;
        p.armL.quaternion.setFromEuler(_eu.set(sw, 0, -0.08)); p.armR.quaternion.setFromEuler(_eu.set(-sw, 0, 0.08));
        p.elbowL.quaternion.setFromEuler(_eu.set(-0.25 - Math.max(0, sw) * 0.5, 0, 0)); p.elbowR.quaternion.setFromEuler(_eu.set(-0.25 - Math.max(0, -sw) * 0.5, 0, 0));
      }
    } else {
      const hold = HOLD[g.kind === 'pkm' ? 'pkm' : g.kind === 'rpg' ? 'rpg' : g.kind === 'pistol' ? 'pistol' : 'rifle'];
      const A = hold.aim, Lw = hold.low, k = aimK;
      _pa.set(A[0], A[1], A[2]); _pb.set(Lw[0], Lw[1] + Math.abs(Math.sin(ph)) * 0.02 * amp, Lw[2]);
      p.gun.position.lerpVectors(_pb, _pa, k);
      p.gun.position.z += (e.recoil || 0) * 0.05;
      _qa.setFromEuler(_eu.set(A[3] + (e.recoil || 0) * 0.1, A[4], A[5])); _qb.setFromEuler(_eu.set(Lw[3], Lw[4], Lw[5]));
      p.gun.quaternion.slerpQuaternions(_qb, _qa, k);
      p.gun.updateMatrix();
      _pa.copy(g.grip).applyMatrix4(p.gun.matrix); reach(p.armR, p.elbowR, _pa, 1);
      _pb.copy(g.fore).applyMatrix4(p.gun.matrix); reach(p.armL, p.elbowL, _pb, -1);
    }
    if (M.torch) { const on = !!e.torchOn && e.alive !== false; M.torch.visible = on; M.torch.userData.bulb.visible = on; }
    if (M.extra) M.extra(e, dt, speed);
  };
  /** Knees give, the body folds and goes down forward or back. */
  H.death = function (M, e, dt) {
    const p = M.p, t = e.deadT, back = e.fallDir > 0;
    const k1 = U.easeOutCubic(U.clamp(t / 0.35, 0, 1)), k2 = U.easeInOut(U.clamp((t - 0.15) / 0.6, 0, 1));
    p.hips.position.y = U.lerp(0.98, 0.2, k2 * 0.8) - k1 * 0.12;
    for (const s of ['L', 'R']) { p['leg' + s].rotation.x = U.lerp(p['leg' + s].rotation.x, back ? 0.2 : 0.9, k1 * 0.3); p['knee' + s].rotation.x = U.lerp(p['knee' + s].rotation.x, back ? -0.4 : -1.2, k1 * 0.3); }
    p.torso.rotation.x = U.lerp(p.torso.rotation.x, back ? 0.3 : -0.35, k1 * 0.2);
    p.head.rotation.x = U.lerp(p.head.rotation.x, back ? 0.4 : -0.3, k2 * 0.1);
    for (const s of ['L', 'R']) { p['arm' + s].quaternion.slerp(_q.setFromEuler(_eu.set(back ? -0.6 : 0.4, 0, s === 'L' ? -0.5 : 0.5)), k1 * 0.12); p['elbow' + s].quaternion.slerp(_q.identity(), k1 * 0.1); }
    e.root.rotation.x = (back ? 1 : -1) * U.lerp(0, 1.42, k2);
    e.root.position.y = e.body.pos.y + Math.sin(k2 * Math.PI) * 0.1;
    if (t > 7 && !e.keepCorpse) e.root.position.y -= (t - 7) * 0.5;
  };

  // ---------------------------------------------------------------- vehicles
  const SM = CF.StoryModels = {};
  /** Utility helicopter ("Dust" callsigns). Nose toward -Z, floor at y = 0.9. */
  SM.heli = function (o) {
    o = o || {};
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const paint = mat(0x3c4232, 0.62, 0.25), dark = mat(0x22251f, 0.7, 0.3), glass = mat(0x2a3a44, 0.08, 0.9, { transparent: true, opacity: 0.55 }), inner = mat(0x2a2c28, 0.9), black = mat(0x111111, 0.6, 0.4);
    const Bb = (mt, x, y, z, sx, sy, sz, rx, ry, rz) => B(body, mt, x, y, z, sx, sy, sz, rx, ry, rz);
    Bb(paint, 0, 0.75, 0, 2.5, 0.3, 5.4);             // belly
    Bb(inner, 0, 0.92, 0, 2.3, 0.04, 5.0);            // cabin floor
    Bb(paint, 0, 3.0, 0.1, 2.5, 0.35, 5.6);           // roof
    Bb(paint, 0, 1.9, 2.55, 2.5, 2.1, 0.4);           // rear bulkhead
    Bb(paint, 0, 1.9, -1.9, 2.5, 2.1, 0.3);           // cockpit bulkhead (with a doorway)
    for (const s of [-1, 1]) {                        // pillars and the rear side panels (the doors stay open)
      Bb(paint, s * 1.2, 1.9, -1.55, 0.1, 2.1, 0.4); Bb(paint, s * 1.2, 1.9, 1.95, 0.1, 2.1, 1.1); Bb(paint, s * 1.2, 2.8, 0.2, 0.1, 0.35, 3.6);
      Bb(glass, s * 1.21, 2.25, 1.9, 0.02, 0.5, 0.7);
      Bb(inner, s * 0.95, 1.2, 1.3, 0.4, 0.5, 2.0);   // troop benches
    }
    // nose and cockpit
    m(body, sph(), paint, 0, 1.35, -3.5, 1.24, 0.9, 1.75);
    m(body, sph(), glass, 0, 2.0, -3.3, 1.12, 0.8, 1.4);
    Bb(dark, 0, 0.55, -3.4, 1.4, 0.4, 1.6);
    // engines and rotor mast
    Bb(paint, 0, 3.45, -0.2, 1.8, 0.6, 3.2); for (const s of [-1, 1]) m(body, cylHi(), dark, s * 0.75, 3.5, 1.3, 0.28, 0.9, 0.28, Math.PI / 2, 0, 0);
    m(body, cylHi(), dark, 0, 3.95, -0.3, 0.14, 0.5, 0.14);
    // tail boom, fins, tail rotor
    const boom = m(body, cylHi(), paint, 0, 2.45, 5.9, 0.55, 7.2, 0.4, Math.PI / 2, 0, 0); boom.scale.set(0.55, 7.2, 0.45);
    Bb(paint, 0, 3.4, 9.3, 0.18, 2.2, 1.1, -0.35, 0, 0); Bb(paint, 0, 2.5, 9.0, 3.0, 0.1, 0.7);
    const tail = grp(body, 0.25, 3.8, 9.5);
    for (let i = 0; i < 4; i++) B(tail, dark, 0, 0, 0, 0.05, 1.6, 0.12, 0, 0, i * Math.PI / 4 * 2);
    // gear
    for (const [x, z] of [[-1.3, -1.6], [1.3, -1.6], [0, 8.6]]) { m(body, cylHi(), black, x, 0.3, z, 0.3, 0.2, 0.3, 0, 0, Math.PI / 2); Bb(dark, x * 0.85, 0.55, z, 0.1, 0.5, 0.1); }
    // door guns
    for (const s of [-1, 1]) { const dg = grp(body, s * 1.25, 1.95, -1.05); B(dg, black, 0, 0, -0.3, 0.07, 0.1, 0.7); m(dg, cyl(), black, 0, 0, -0.8, 0.02, 0.5, 0.02, Math.PI / 2, 0, 0); }
    // main rotor
    const rotor = grp(body, 0, 4.2, -0.3);
    const blade = mat(0x1a1c1a, 0.6, 0.3);
    for (let i = 0; i < 4; i++) { const b = B(rotor, blade, 0, 0, 0, 0.5, 0.04, 16, 0, i * Math.PI / 4 * 2, 0); b.castShadow = true; }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshBasicMaterial({ color: 0x0c0d0c, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; rotor.add(disc);
    // nav lights
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) }), green = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 5, 0.6) });
    m(body, sph(), red, -1.3, 2.9, -1.6, 0.07, 0.07, 0.07); m(body, sph(), green, 1.3, 2.9, -1.6, 0.07, 0.07, 0.07);
    const beacon = m(body, sph(), red, 0, 3.2, 1.8, 0.09, 0.09, 0.09);
    // crew: two pilots behind the glass
    const crew = [];
    for (const s of [-1, 1]) { const pm = standard('friendly', 11 + s); pm.root.position.set(s * 0.5, 0.75, -3.2); pm.p.hips.position.y = 0.55; pm.p.legL.rotation.x = pm.p.legR.rotation.x = 1.5; pm.p.kneeL.rotation.x = pm.p.kneeR.rotation.x = -1.4; pm.p.gun.visible = false; reach(pm.p.armL, pm.p.elbowL, new THREE.Vector3(-0.12, 0.12, -0.35), -1); reach(pm.p.armR, pm.p.elbowR, new THREE.Vector3(0.12, 0.12, -0.35), 1); body.add(pm.root); crew.push(pm); }
    g.traverse((x) => { if (x.isMesh && x.material !== glass) x.castShadow = true; });
    disc.castShadow = false;
    g.userData = { body, rotor, tail, beacon, crew, spin: 0 };
    return g;
  };
  /** Pickup with a heavy machine gun on the bed and a gunner standing behind it. Nose toward -Z. */
  SM.technical = function () {
    const root = new THREE.Group(), p = {};
    const cols = [0xd9d4c4, 0x8a2a22, 0x2f4f6a, 0xb8a070, 0x4a5a3a];
    const paint = new THREE.MeshStandardMaterial({ color: cols[(Math.random() * cols.length) | 0], roughness: 0.55, metalness: 0.35, envMapIntensity: 0.45 });
    const dark = mat(0x1c1c1c, 0.7, 0.3), tire = mat(0x151515, 0.95), glass = mat(0x1c2630, 0.1, 0.8), chrome = mat(0xaaaaaa, 0.3, 0.9), rust = mat(0x5a3a22, 0.9, 0.2);
    p.body = grp(root, 0, 0, 0);
    const Bb = (mt, x, y, z, sx, sy, sz, rx) => B(p.body, mt, x, y, z, sx, sy, sz, rx);
    Bb(dark, 0, 0.55, 0, 1.8, 0.25, 4.9);
    Bb(paint, 0, 0.95, -1.75, 1.85, 0.55, 1.4);                 // hood
    Bb(paint, 0, 1.3, -0.45, 1.85, 1.2, 1.4);                   // cab
    Bb(glass, 0, 1.6, -1.16, 1.7, 0.5, 0.05, -0.35);            // windscreen
    for (const s of [-1, 1]) Bb(glass, s * 0.93, 1.6, -0.45, 0.02, 0.45, 1.1);
    Bb(paint, 0, 0.9, 1.5, 1.85, 0.45, 2.3);                     // bed floor + sides
    for (const s of [-1, 1]) Bb(paint, s * 0.9, 1.25, 1.5, 0.06, 0.35, 2.3);
    Bb(paint, 0, 1.25, 2.62, 1.85, 0.35, 0.06);
    Bb(chrome, 0, 0.7, -2.5, 1.9, 0.18, 0.12); Bb(dark, 0, 0.95, -2.46, 1.2, 0.3, 0.05);
    for (const s of [-0.65, 0.65]) Bb(mat(0xfff4d0, 0.3, 0, { emissive: 0x332a10 }), s, 0.98, -2.47, 0.28, 0.14, 0.03);
    Bb(rust, 0.4, 1.12, 0.7, 0.5, 0.2, 0.5);
    p.wheels = [];
    for (const [x, z] of [[-0.88, -1.6], [0.88, -1.6], [-0.88, 1.6], [0.88, 1.6]]) { const w = grp(p.body, x, 0.42, z); m(w, cylHi(), tire, 0, 0, 0, 0.42, 0.3, 0.42, 0, 0, Math.PI / 2); m(w, cylHi(), chrome, x > 0 ? 0.16 : -0.16, 0, 0, 0.18, 0.02, 0.18, 0, 0, Math.PI / 2); p.wheels.push(w); }
    // turret + gun
    p.turret = grp(p.body, 0, 1.1, 1.3);
    m(p.turret, cyl(), dark, 0, 0.3, 0, 0.06, 0.6, 0.06);
    p.gunPivot = grp(p.turret, 0, 0.62, 0);
    B(p.gunPivot, dark, 0, 0, -0.2, 0.14, 0.16, 0.7); m(p.gunPivot, cylHi(), dark, 0, 0.02, -0.95, 0.035, 0.9, 0.035, Math.PI / 2, 0, 0);
    B(p.gunPivot, dark, 0, 0.1, -0.1, 0.4, 0.3, 0.02); // shield
    B(p.gunPivot, mat(0x3a4a2a, 0.7), 0.14, -0.08, -0.15, 0.12, 0.14, 0.2);
    p.muzzle = grp(p.gunPivot, 0, 0.02, -1.42);
    // the gunner stands in the bed behind the gun
    const gm = H.make('militia'); gm.p.gun.visible = false;
    gm.root.position.set(0, -0.2, 0.75); p.turret.add(gm.root);
    p.gunner = gm;
    const hit = [
      hs(p.body, 0, 1.1, -1.4, 1.0, 1, 'body'), hs(p.body, 0, 1.1, 0.2, 1.0, 1, 'body'), hs(p.body, 0, 1.0, 1.7, 1.0, 1, 'body'),
      hs(gm.p.head, 0, 0.12, -0.01, 0.13, 1, 'head', { gunner: true }), hs(gm.p.torso, 0, 0.28, 0, 0.23, 1, 'body', { gunner: true })
    ];
    root.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    const M = { root, p, hit, mats: [], eyeMat: null, gibs: [], height: 3.0, radius: 1.3 };
    M.pose = (e, dt, speed) => {
      for (const w of p.wheels) w.rotation.x -= speed * dt / 0.42;
      p.turret.rotation.y = e.turretYaw || 0;
      p.gunPivot.rotation.x = e.aimPitch || 0;
      p.gunPivot.position.z = (e.recoil || 0) * 0.08;
      p.body.rotation.x = -Math.min(0.03, speed * 0.004); p.body.position.y = Math.sin(CF.time * 13) * 0.01 * Math.min(1, speed);
      if (!e.gunnerDead) {
        gm.p.torso.rotation.x = (e.aimPitch || 0) * 0.5; gm.p.head.rotation.x = 0.1;
        const q = new THREE.Vector3(-0.14, 0.4, -0.55), r = new THREE.Vector3(0.14, 0.4, -0.55);
        reach(gm.p.armL, gm.p.elbowL, q, -1); reach(gm.p.armR, gm.p.elbowR, r, 1);
      }
    };
    M.gunnerDown = () => { gm.p.torso.rotation.x = 0.9; gm.p.hips.position.y = 0.6; gm.root.rotation.z = 0.5; gm.p.head.rotation.x = 0.6; };
    M.wreck = () => {
      paint.color.setHex(0x1a1714); paint.roughness = 1; paint.metalness = 0.1;
      p.body.rotation.z = 0.06; p.gunner.root.visible = false; p.turret.rotation.x = 0.3;
    };
    return M;
  };

  // ---------------------------------------------------------------- enemy types
  const ET = CF.Enemies.types;
  const human = { kind: 'sentry', human: true, radius: 0.36, height: 1.85, eye: 1.7, fovCos: 0.45, stagger: 45, bolt: 'tracer', sfx: 'akShot', alert: 'shout' };
  Object.assign(ET, {
    militia: Object.assign({}, human, { name: 'Militiaman', hp: 90, walk: 1.6, run: 4.6, range: [8, 30], sight: 46, dmg: 7, projSpeed: 95, burst: 3, burstGap: 0.11, cool: [1.1, 2.0], spread: 2.3, score: 100 }),
    gunner: Object.assign({}, human, { name: 'Machine gunner', hp: 150, walk: 1.3, run: 3.4, range: [10, 34], sight: 48, dmg: 6, projSpeed: 100, burst: 7, burstGap: 0.08, cool: [1.6, 2.6], spread: 3.2, score: 180, sfx: 'pkmShot', stagger: 70 }),
    rpg: Object.assign({}, human, { name: 'RPG gunner', hp: 90, walk: 1.5, run: 4.2, range: [12, 55], sight: 60, dmg: 0, projSpeed: 90, burst: 0, burstGap: 0.1, cool: [99, 99], spread: 2, score: 160, rpg: true }),
    guard: Object.assign({}, human, { name: 'Guard', hp: 100, walk: 1.3, run: 4.4, range: [8, 28], sight: 40, fovCos: 0.55, dmg: 7, projSpeed: 95, burst: 3, burstGap: 0.12, cool: [1.2, 2.1], spread: 2.4, score: 120 }),
    officer: Object.assign({}, human, { name: 'The Magistrate', hp: 180, walk: 1.2, run: 4.8, range: [4, 18], sight: 36, dmg: 9, projSpeed: 80, burst: 2, burstGap: 0.25, cool: [1.0, 1.8], spread: 2.8, score: 1000, sfx: 'pistol' }),
    sniper: Object.assign({}, human, { name: 'Sniper', hp: 80, walk: 0, run: 0, range: [15, 120], sight: 110, fovCos: 0.2, dmg: 32, projSpeed: 220, burst: 1, burstGap: 0.1, cool: [2.8, 4.2], spread: 0.5, score: 250, sfx: 'sniperShot', aimTime: 1.3 }),
    technical: { name: 'Technical', kind: 'technical', vehicle: true, hp: 520, armor: 0.25, drive: 7, turn: 1.1, radius: 1.3, height: 3.0, eye: 2.3, range: [0, 60], sight: 70, fovCos: -1,
      dmg: 8, projSpeed: 110, burst: 6, burstGap: 0.1, cool: [1.3, 2.1], spread: 3.4, score: 500, bolt: 'tracer', sfx: 'pkmShot', gunnerHp: 90 }
  });
  const EM = CF.EnemyModels;
  for (const k of ['militia', 'gunner', 'rpg', 'guard', 'officer', 'sniper']) EM[k] = () => H.make(k);
  EM.technical = () => SM.technical();
})(window.CF);
