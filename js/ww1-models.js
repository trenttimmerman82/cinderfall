'use strict';
/* Cinderfall — The Eleventh Hour people and machines: Tommies (Brodie helmets, khaki serge, puttees, 1908 webbing),
   German infantry (Stahlhelm, field grey, jackboots, stick grenades), MG08 crews, flamethrower and storm troops,
   the Mark IV tank "Fat Annie", a Bristol F2B two-seater, Fokker D.VIIs and a 77 mm field gun.
   People use the shared skeleton, hit spheres and animation (js/story-models.js); always built at standard detail. */
(function (CF) {
  const U = CF.U, H = CF.Human, SM = CF.StoryModels;
  const { m, B, grp, box, cyl, cylHi, sph, cone, caps } = H.helpers;
  const mat = H.mat;
  const PI = Math.PI;

  // ---------------------------------------------------------------- who wears what
  const SKIN = [0xe0b494, 0xd8a888, 0xc8987a, 0xb88866, 0xe8c0a0];
  const WW = {
    tommy: { brit: true, cloth: [0x7a6c48, 0x84744c, 0x726646], head: ['brodie'], gun: 'smle' },
    tommyLewis: { brit: true, cloth: [0x7a6c48], head: ['brodie'], gun: 'lewis' },
    officer: { brit: true, officer: true, cloth: [0x8a7a54], head: ['peak'], gun: 'webley' },
    runner: { brit: true, cloth: [0x7a6c48], head: ['brodie'], gun: null },
    airman: { brit: true, airman: true, cloth: [0x5a4a36], head: ['flying'], gun: null },
    german: { hun: true, cloth: [0x6a6e58, 0x666a54, 0x707460], head: ['stahl', 'stahl', 'stahl', 'feldmutze'], gun: 'gew98' },
    gmg: { hun: true, cloth: [0x666a54], head: ['stahl'], gun: 'mg08' },
    flamer: { hun: true, cloth: [0x5e6250], head: ['stahl'], gun: 'flamer', tank: true },
    storm: { hun: true, cloth: [0x62664e], head: ['stahl'], gun: 'gew98', storm: true },
    gsniper: { hun: true, cloth: [0x5a5e48], head: ['stahl'], gun: 'scoped', leaves: true },
    gofficer: { hun: true, officer: true, cloth: [0x6e7260], head: ['peak'], gun: 'luger' }
  };
  for (const k in WW) { WW[k].ww1 = true; H.LOOKS[k] = Object.assign({ shirt: [0x333333], pants: [0x333333], vest: null, wrap: [0x333333], beard: 0 }, WW[k]); }

  // ---------------------------------------------------------------- their guns
  function wwGun(kind, g) {
    const blk = mat(0x161616, 0.5, 0.6), wood = mat(0x5e3a1e, 0.6, 0.05), steel = mat(0x3a3c3e, 0.5, 0.6), brass = mat(0xb08a40, 0.4, 0.8);
    const s = { grip: new THREE.Vector3(0, -0.07, -0.2), fore: new THREE.Vector3(0, -0.04, -0.46), kind: 'rifle', sfx: 'enfield' };
    if (kind === 'smle' || kind === 'gew98' || kind === 'scoped') {
      B(g, wood, 0, -0.02, 0.06, 0.045, 0.1, 0.22, -0.08, 0, 0); B(g, wood, 0, 0.0, -0.4, 0.05, 0.06, 0.66); B(g, steel, 0, 0.04, -0.12, 0.04, 0.04, 0.14);
      m(g, cyl(), steel, 0, 0.02, kind === 'smle' ? -0.76 : -0.82, 0.01, kind === 'smle' ? 0.08 : 0.22, 0.01, PI / 2, 0, 0);
      B(g, steel, 0.03, 0.04, -0.06, 0.04, 0.01, 0.01);
      if (kind === 'scoped') m(g, cyl(), blk, 0, 0.09, -0.15, 0.016, 0.26, 0.016, PI / 2, 0, 0);
      s.muzzle = grp(g, 0, 0.02, kind === 'smle' ? -0.8 : -0.94); s.sfx = kind === 'smle' ? 'enfield' : 'mauser';
    } else if (kind === 'lewis') {
      B(g, wood, 0, -0.02, 0.06, 0.045, 0.1, 0.22); B(g, steel, 0, 0.0, -0.2, 0.06, 0.08, 0.3);
      m(g, cylHi(), steel, 0, 0.02, -0.62, 0.045, 0.6, 0.045, PI / 2, 0, 0); m(g, cylHi(), steel, 0, 0.1, -0.18, 0.1, 0.03, 0.1);
      s.muzzle = grp(g, 0, 0.02, -0.95); s.kind = 'pkm'; s.sfx = 'lewis'; s.fore.set(0, -0.05, -0.5);
    } else if (kind === 'mg08') {
      m(g, cylHi(), steel, 0, 0.02, -0.55, 0.06, 0.7, 0.06, PI / 2, 0, 0); // water jacket
      B(g, steel, 0, 0.02, -0.08, 0.12, 0.13, 0.3); for (let i = 0; i < 5; i++) B(g, brass, -0.08, -0.02 - i * 0.03, -0.1, 0.012, 0.02, 0.05);
      B(g, mat(0x4a5038, 0.7), 0.1, -0.1, -0.08, 0.12, 0.14, 0.18);
      s.muzzle = grp(g, 0, 0.02, -0.92); s.kind = 'pkm'; s.sfx = 'pkmShot'; s.fore.set(0.06, -0.02, -0.02); s.grip.set(-0.06, -0.02, 0.02);
    } else if (kind === 'flamer') {
      B(g, steel, 0, 0.0, -0.1, 0.05, 0.06, 0.24); m(g, cyl(), steel, 0, 0.0, -0.45, 0.02, 0.5, 0.02, PI / 2, 0, 0);
      s.muzzle = grp(g, 0, 0.0, -0.72); s.sfx = 'flamer';
    } else if (kind === 'webley' || kind === 'luger') {
      B(g, steel, 0, 0.03, -0.06, 0.03, 0.035, 0.16); B(g, wood, 0, -0.03, -0.01, 0.028, 0.09, 0.035, 0.35, 0, 0);
      s.muzzle = grp(g, 0, 0.03, -0.15); s.grip.set(0, -0.04, 0); s.fore.set(-0.02, -0.05, 0.01); s.kind = 'pistol'; s.sfx = kind === 'webley' ? 'revolver' : 'pistol';
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return s;
  }

  // ---------------------------------------------------------------- person
  function wwPerson(look, seed) {
    const Lk = H.LOOKS[look], rnd = U.mulberry32(seed != null ? seed : (Math.random() * 1e9) | 0), pick = (a) => a[Math.floor(rnd() * a.length)];
    const { root, p } = H.skeleton();
    const O = { look, L: Lk, rnd, skin: pick(SKIN), head: pick(Lk.head), bulk: 0.95 + rnd() * 0.1, gun: Lk.gun };
    const bk = O.bulk, skin = mat(O.skin, 0.7), cloth = mat(pick(Lk.cloth), 0.95), dark = mat(0x151515, 0.6);
    const web = mat(Lk.brit ? 0xb0a070 : 0x2a2018, 0.85), boot = mat(Lk.brit ? 0x3a2416 : 0x141210, 0.7), puttee = mat(0x6a5c3c, 0.95);
    for (const s of ['L', 'R']) {
      m(p['leg' + s], caps(), cloth, 0, -0.22, 0, 0.088 * bk, 0.17, 0.092 * bk);
      m(p['knee' + s], caps(), cloth, 0, -0.21, 0, 0.068 * bk, 0.17, 0.07 * bk);
      if (Lk.brit && !Lk.officer) m(p['knee' + s], cylHi(), puttee, 0, -0.27, 0, 0.066, 0.24, 0.07);      // puttees
      else m(p['knee' + s], cylHi(), boot, 0, -0.25, 0, 0.07, 0.3, 0.074);                                  // jackboots / riding boots
      B(p['foot' + s], boot, 0, -0.03, -0.05, 0.1, 0.09, 0.27);
    }
    B(p.hips, cloth, 0, 0, 0, 0.33 * bk, 0.19, 0.21);
    // tunic: four pockets for the Tommy, plain for the German; belt, pouches
    m(p.torso, caps(), cloth, 0, 0.26, 0, 0.19 * bk, 0.19, 0.13 * bk);
    B(p.torso, cloth, 0, 0.0, 0, 0.36 * bk, 0.14, 0.25 * bk);                                               // the skirt of the tunic
    m(p.torso, cylHi(), cloth, 0, 0.49, 0, 0.065, 0.07, 0.065);                                            // collar
    m(p.torso, cyl(), skin, 0, 0.53, 0, 0.05, 0.05, 0.05);
    B(p.torso, web, 0, 0.04, 0, 0.37 * bk, 0.05, 0.26 * bk);                                                // belt
    if (Lk.brit && !Lk.officer && !Lk.airman) {
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) B(p.torso, web, sd * (0.05 + i * 0.045) * bk, 0.2, -0.135 * bk, 0.04, 0.07, 0.04); // ammo pouches
      for (const x of [-0.11, 0.11]) B(p.torso, web, x * bk, 0.3, 0, 0.035, 0.4, 0.27 * bk);                // braces
      B(p.torso, mat(0x8a7a50, 0.9), 0, 0.33, -0.15 * bk, 0.13, 0.11, 0.05);                               // small box respirator
      B(p.torso, mat(0x6a5a3a, 0.9), 0.05, 0.26, 0.16 * bk, 0.24, 0.22, 0.1);                              // haversack
    }
    if (Lk.hun) {
      for (const x of [-0.12, -0.04, 0.04, 0.12]) B(p.torso, mat(0x2a2018, 0.7), x * bk, 0.06, -0.14 * bk, 0.05, 0.06, 0.04);
      m(p.hips, cylHi(), mat(0x5a6048, 0.5, 0.4), 0.17 * bk, -0.02, 0.06, 0.05, 0.14, 0.05);                // gas mask tin
      if (!Lk.officer) { const sg = grp(p.hips, -0.12, 0.08, -0.12); m(sg, cyl(), mat(0x6a4a2a, 0.7), 0, 0, 0, 0.015, 0.28, 0.015, 0.3, 0, 0); m(sg, cylHi(), mat(0x4a5040, 0.5, 0.4), 0, 0.15, -0.045, 0.035, 0.09, 0.035, 0.3, 0, 0); }
    }
    if (Lk.storm) for (const sd of [-1, 1]) B(p.torso, mat(0x7a6a48, 0.95), sd * 0.1, 0.28, -0.15, 0.12, 0.16, 0.06); // grenade sacks
    if (Lk.tank) { m(p.torso, cylHi(), mat(0x3a3a30, 0.5, 0.5), 0, 0.3, 0.2, 0.17, 0.5, 0.17); m(p.torso, cylHi(), mat(0x2a2a24, 0.5, 0.5), 0, 0.3, 0.2, 0.06, 0.52, 0.06, 0, 0, 0); }
    if (Lk.officer) { B(p.torso, mat(Lk.brit ? 0x5a3418 : 0x1a1410, 0.5), 0, 0.27, 0, 0.04, 0.48, 0.27, 0, 0, 0.75); B(p.torso, mat(0xe0d8c0, 0.8), 0, 0.46, -0.13, 0.04, 0.05, 0.01); }
    if (Lk.airman) { B(p.torso, mat(0x6a4a2a, 0.6), 0, 0.25, 0, 0.4 * bk, 0.4, 0.28 * bk); m(p.torso, cylHi(), mat(0xe8e0d0, 0.9), 0, 0.47, 0, 0.09, 0.06, 0.09); }
    // head
    const hd = p.head;
    m(hd, sph(), skin, 0, 0.12, -0.01, 0.092, 0.112, 0.102);
    m(hd, sph(), skin, 0, 0.1, -0.1, 0.02, 0.026, 0.022);
    for (const x of [-0.034, 0.034]) B(hd, dark, x, 0.14, -0.098, 0.022, 0.009, 0.01);
    if (rnd() < 0.3) B(hd, mat(0x3a2a1a, 0.95), 0, 0.075, -0.1, 0.06, 0.014, 0.01);
    if (O.head === 'brodie') { const c = mat(0x5a5a3e, 0.75, 0.2); m(hd, sph(), c, 0, 0.18, 0, 0.12, 0.08, 0.13); m(hd, cylHi(), c, 0, 0.17, 0, 0.2, 0.015, 0.21); }
    else if (O.head === 'stahl') { const c = mat(0x4e5444, 0.7, 0.25); m(hd, sph(), c, 0, 0.17, 0.0, 0.125, 0.11, 0.135); m(hd, cylHi(), c, 0, 0.1, 0.01, 0.14, 0.08, 0.15); m(hd, cylHi(), c, 0, 0.06, 0.03, 0.155, 0.03, 0.16); }
    else if (O.head === 'feldmutze') { m(hd, cylHi(), mat(0x6a6e58, 0.95), 0, 0.21, 0, 0.11, 0.06, 0.115); m(hd, cylHi(), mat(0xa82020, 0.9), 0, 0.19, 0, 0.112, 0.015, 0.117); }
    else if (O.head === 'peak') { const c = mat(Lk.brit ? 0x8a7a54 : 0x6e7260, 0.9); m(hd, cylHi(), c, 0, 0.22, 0, 0.12, 0.07, 0.125); B(hd, mat(0x2a2016, 0.5), 0, 0.19, -0.11, 0.17, 0.012, 0.08); }
    else if (O.head === 'flying') { m(hd, sph(), mat(0x4a3018, 0.6), 0, 0.15, 0.0, 0.112, 0.11, 0.12); B(hd, mat(0x88aacc, 0.1, 0.6), 0, 0.2, -0.09, 0.14, 0.04, 0.03); }
    if (Lk.leaves && CF.Level.mats && CF.Level.mats.leafBush) for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3), CF.Level.mats.leafBush); c.position.set((rnd() - 0.5) * 0.2, 0.26, (rnd() - 0.5) * 0.2); c.rotation.set(rnd(), rnd() * PI, rnd()); hd.add(c); }
    for (const s of ['L', 'R']) {
      m(p['arm' + s], caps(), cloth, 0, -0.13, 0, 0.057 * bk, 0.13, 0.057 * bk);
      m(p['elbow' + s], caps(), cloth, 0, -0.12, 0, 0.048, 0.12, 0.048);
      B(p['hand' + s], skin, 0, -0.03, 0, 0.058, 0.1, 0.034);
    }
    const g = O.gun ? wwGun(O.gun, p.gun) : null;
    if (!g) p.gun.visible = false;
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return H.finish(root, p, O, g, null, false);
  }
  H.wwPerson = wwPerson;
  const make0 = H.make;
  H.make = function (look, seed) { return H.LOOKS[look] && H.LOOKS[look].ww1 ? wwPerson(look, seed) : make0(look, seed); };

  // ---------------------------------------------------------------- the Mark IV tank, front toward -Z
  /** Rhomboid side plates with the track running round them, a box hull between, a sponson on each side. */
  SM.markIV = function () {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const hull = mat(0x5a5440, 0.85, 0.3), track = mat(0x2a2620, 0.95, 0.4), rivet = mat(0x3a3628, 0.6, 0.5), dark = mat(0x111111, 0.6);
    const shape = new THREE.Shape([[-4.1, 0.9], [-3.1, 2.5], [3.3, 2.5], [4.0, 1.5], [3.2, 0.0], [-2.6, 0.0]].map((q) => new THREE.Vector2(q[0], q[1])));
    const side = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false });
    const outer = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    for (const sd of [-1, 1]) {
      const sp = new THREE.Mesh(side, hull); sp.rotation.y = PI / 2; sp.position.set(sd > 0 ? 1.3 : -1.85, 0, 0); body.add(sp);
      // the track: a slightly bigger, darker outline on the outer face
      const tr = new THREE.Mesh(outer, track); tr.rotation.y = PI / 2; tr.scale.set(1.04, 1.06, 1); tr.position.set(sd > 0 ? 1.84 : -1.92, -0.06, 0); body.add(tr);
      for (let i = 0; i < 14; i++) B(body, track, sd * 1.6, 0.03, -2.4 + i * 0.42, 0.62, 0.06, 0.3);                 // track plates underneath
      for (let i = 0; i < 9; i++) B(body, track, sd * 1.6, 2.48, -2.9 + i * 0.75, 0.62, 0.06, 0.4);
      // sponson with a 6-pounder
      B(body, hull, sd * 2.15, 1.25, 0.4, 0.6, 1.0, 1.6);
      m(body, cylHi(), dark, sd * 2.6, 1.4, 0.2, 0.06, 1.2, 0.06, 0, 0, PI / 2);
      for (let i = 0; i < 4; i++) B(body, rivet, sd * 2.46, 1.7, -0.2 + i * 0.4, 0.02, 0.03, 0.03);
    }
    B(body, hull, 0, 1.3, 0.2, 2.6, 1.9, 6.2);                                                 // the hull between the horns
    B(body, hull, 0, 2.6, -2.2, 1.6, 0.6, 1.0);                                                // driver's cab
    B(body, dark, 0, 2.65, -2.72, 1.0, 0.12, 0.02);                                            // vision slits
    B(body, hull, 0, 2.4, 1.2, 0.8, 0.3, 1.2);                                                 // the roof box
    m(body, cylHi(), dark, 0.4, 2.8, 2.4, 0.1, 0.8, 0.1);                                      // exhaust
    m(body, cylHi(), mat(0x6a4a2a, 0.9), 0, 2.85, 0.2, 0.18, 3.6, 0.18, 0, 0, PI / 2);          // unditching beam (rails across the top)
    g.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    g.userData = { body };
    return g;
  };

  // ---------------------------------------------------------------- Bristol F2B (nose toward -Z): pilot in front, observer behind with a Lewis on a ring
  SM.bristol = function () {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const dope = mat(0x6a6448, 0.8), linen = mat(0xc8c0a0, 0.85), wood = mat(0x6a4426, 0.6), metal = mat(0x4a4a46, 0.5, 0.5), dark = mat(0x161616, 0.6);
    const roundel = (x, y, z, r, ry) => { for (const [rr, c] of [[1, 0x2a3a8a], [0.66, 0xe8e8e0], [0.33, 0xb02020]]) { const d = new THREE.Mesh(new THREE.CircleGeometry(r * rr, 20), mat(c, 0.8)); d.position.set(x, y + 0.002 * rr * 10, z); d.rotation.x = -PI / 2; if (ry) d.rotation.set(0, ry, 0); body.add(d); } };
    // fuselage (tapering box sections)
    B(body, dope, 0, 1.2, -1.6, 0.95, 1.0, 2.0); B(body, dope, 0, 1.25, 0.6, 0.85, 0.9, 2.4); B(body, dope, 0, 1.35, 2.9, 0.5, 0.6, 2.4); B(body, dope, 0, 1.45, 4.4, 0.25, 0.35, 1.0);
    B(body, metal, 0, 1.2, -2.75, 0.9, 0.9, 0.3);                                              // radiator nose
    B(body, dark, 0, 1.2, -2.91, 0.7, 0.7, 0.02);
    const prop = grp(body, 0, 1.2, -3.0); B(prop, wood, 0, 0, 0, 0.18, 2.7, 0.06);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); disc.position.set(0, 1.2, -3.02); body.add(disc);
    // wings: upper and lower, struts between
    B(body, linen, 0, 2.55, -0.9, 12, 0.08, 1.7); B(body, linen, 0, 0.75, -0.75, 11, 0.08, 1.6);
    for (const sd of [-1, 1]) for (const x of [1.6, 4.0]) { B(body, wood, sd * x, 1.65, -1.3, 0.06, 1.8, 0.06); B(body, wood, sd * x, 1.65, -0.35, 0.06, 1.8, 0.06); }
    for (const sd of [-1, 1]) B(body, metal, sd * 2.8, 1.65, -0.8, 2.2, 0.02, 0.02, 0, 0, sd * 0.6); // bracing wires
    roundel(-4.6, 2.6, -0.9, 0.7); roundel(4.6, 2.6, -0.9, 0.7);
    // tail
    B(body, linen, 0, 1.45, 4.6, 3.6, 0.06, 1.0); B(body, linen, 0, 1.95, 4.75, 0.06, 1.0, 0.9);
    B(body, mat(0xb02020, 0.8), 0, 2.0, 5.05, 0.07, 0.9, 0.2); B(body, mat(0xe8e8e0, 0.8), 0, 2.0, 4.85, 0.07, 0.9, 0.2); B(body, mat(0x2a3a8a, 0.8), 0, 2.0, 4.65, 0.07, 0.9, 0.2);
    // undercarriage
    for (const sd of [-1, 1]) { B(body, wood, sd * 0.6, 0.45, -1.4, 0.06, 0.9, 0.06, 0.3, 0, 0); m(body, cylHi(), dark, sd * 0.85, 0.35, -1.6, 0.36, 0.12, 0.36, 0, 0, PI / 2); }
    // cockpits: pilot, observer's ring and Lewis
    B(body, dark, 0, 1.72, -0.3, 0.6, 0.04, 0.6); B(body, dark, 0, 1.72, 0.95, 0.65, 0.04, 0.7);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 20), metal); ring.rotation.x = PI / 2; ring.position.set(0, 1.78, 0.95); body.add(ring);
    const pilot = wwPerson('airman', 81); pilot.root.position.set(0, 0.95, -0.3); pilot.p.hips.position.y = 0.55; pilot.p.legL.rotation.x = pilot.p.legR.rotation.x = 1.4; pilot.p.kneeL.rotation.x = pilot.p.kneeR.rotation.x = -1.3;
    H.reach(pilot.p.armL, pilot.p.elbowL, new THREE.Vector3(-0.08, 0.15, -0.35), -1); H.reach(pilot.p.armR, pilot.p.elbowR, new THREE.Vector3(0.08, 0.15, -0.35), 1); body.add(pilot.root);
    g.traverse((x) => { if (x.isMesh && x !== disc) x.castShadow = true; });
    g.userData = { body, prop, pilot };
    return g;
  };

  // ---------------------------------------------------------------- Fokker D.VII: the enemy fighter (an Enemy, flying)
  SM.fokker = function () {
    const root = new THREE.Group(), p = {};
    p.body = grp(root, 0, 0, 0);
    const lozA = mat(0x5a3a5a, 0.8), lozB = mat(0x3a4a2e, 0.8), nose = mat(0xb02020, 0.7), wood = mat(0x6a4426, 0.6), dark = mat(0x161616, 0.6), white = mat(0xe8e8e0, 0.8), black = mat(0x101010, 0.8);
    B(p.body, lozB, 0, 0, 0, 0.8, 0.85, 3.0); B(p.body, lozB, 0, 0.05, 2.4, 0.35, 0.45, 2.0);
    B(p.body, nose, 0, 0, -1.7, 0.8, 0.8, 0.5);
    p.prop = grp(p.body, 0, 0, -2.0); B(p.prop, wood, 0, 0, 0, 0.16, 2.4, 0.05);
    B(p.body, lozA, 0, 1.15, -0.6, 8.9, 0.1, 1.6); B(p.body, lozB, 0, -0.45, -0.4, 7.0, 0.1, 1.4);
    for (const sd of [-1, 1]) { B(p.body, wood, sd * 2.6, 0.35, -0.6, 0.06, 1.5, 0.06, 0, 0, sd * -0.1); B(p.body, black, sd * 3.5, 1.21, -0.6, 0.9, 0.02, 0.9, 0, PI / 4, 0); B(p.body, white, sd * 3.5, 1.205, -0.6, 1.1, 0.02, 1.1, 0, PI / 4, 0); }
    B(p.body, lozA, 0, 0.1, 3.4, 2.4, 0.06, 0.8); B(p.body, nose, 0, 0.55, 3.5, 0.06, 0.8, 0.7);
    for (const sd of [-1, 1]) m(p.body, cylHi(), dark, sd * 0.6, -0.85, -0.8, 0.32, 0.1, 0.32, 0, 0, PI / 2);
    p.pilot = grp(p.body, 0, 0.55, 0.3); m(p.pilot, sph(), mat(0x4a3018, 0.6), 0, 0, 0, 0.13, 0.14, 0.14);
    p.muzzle = grp(p.body, 0, 0.5, -1.6);
    const hs = (obj, x, y, z, r, mult, tag) => ({ obj, off: new THREE.Vector3(x, y, z), r, mult, tag, w: new THREE.Vector3() });
    const hit = [hs(p.body, 0, 0, -0.4, 0.9, 1, 'body'), hs(p.body, 0, 0, 1.4, 0.8, 1, 'body'), hs(p.body, -2.8, 0.4, -0.6, 1.1, 0.6, 'limb'), hs(p.body, 2.8, 0.4, -0.6, 1.1, 0.6, 'limb'),
      hs(p.body, 0, 0.1, 3.0, 0.6, 0.8, 'body'), hs(p.pilot, 0, 0, 0, 0.3, 2.5, 'head')];
    root.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    const M = { root, p, hit, mats: [], eyeMat: null, gibs: [], height: 2, radius: 3 };
    M.pose = (e, dt) => { p.prop.rotation.z += dt * 60; p.body.rotation.z = e.bank || 0; p.body.rotation.x = e.pitchV || 0; };
    M.death = (e, dt) => { e.body.vel.y -= 9 * dt; e.body.pos.addScaledVector(e.body.vel, dt); e.root.position.copy(e.body.pos); p.body.rotation.z += dt * 3; p.body.rotation.x = 0.5;
      if (Math.random() < 0.8) CF.FX.smoke.spawn(e.body.pos.x, e.body.pos.y, e.body.pos.z, 0, 1, 0, 2.5, 0.8, 3, 0.06, 0.05, 0.05, 0.8, -0.2, 0.3, 1);
      const gy = CF.World.groundHeight(e.body.pos.x, e.body.pos.y + 2, e.body.pos.z); if (e.body.pos.y < gy + 0.5 && !e.crashed) { e.crashed = true; CF.FX.explosion(e.body.pos, 1.4); CF.Audio.play('bigBoom', e.body.pos, { ref: 20 }); e.body.vel.set(0, 0, 0); }
      if (e.deadT > 9) e.remove(); };
    return M;
  };

  /** 77 mm field gun with its layer behind the shield. A static enemy; only explosives hurt the gun. */
  SM.fieldGun = function () {
    const root = new THREE.Group(), p = {};
    const grey = mat(0x5a5e4c, 0.7, 0.3), dark = mat(0x1a1a18, 0.6), wood = mat(0x5a3a1e, 0.7);
    p.body = grp(root, 0, 0, 0);
    for (const sd of [-1, 1]) { m(p.body, cylHi(), wood, sd * 0.8, 0.6, 0, 0.6, 0.08, 0.6, 0, 0, PI / 2); for (let i = 0; i < 6; i++) B(p.body, wood, sd * 0.8, 0.6, 0, 0.04, 1.1, 0.05, i * PI / 6, 0, 0); }
    B(p.body, grey, 0, 0.9, -0.15, 1.6, 1.0, 0.05);                                                         // shield
    p.gunPivot = grp(p.body, 0, 0.95, 0); m(p.gunPivot, cylHi(), grey, 0, 0, -1.0, 0.07, 2.2, 0.07, PI / 2, 0, 0); B(p.gunPivot, grey, 0, 0, 0.2, 0.25, 0.25, 0.8);
    B(p.body, grey, 0, 0.35, 1.3, 0.2, 0.15, 2.2, -0.15, 0, 0);                                             // trail
    p.muzzle = grp(p.gunPivot, 0, 0, -2.1);
    const gm = wwPerson('german'); gm.p.gun.visible = false; gm.root.position.set(0.5, 0, 0.7); p.body.add(gm.root); p.gunner = gm;
    const hs = (obj, x, y, z, r, mult, tag, extra) => Object.assign({ obj, off: new THREE.Vector3(x, y, z), r, mult, tag, w: new THREE.Vector3() }, extra || {});
    const hit = [hs(p.body, 0, 0.9, -0.15, 0.9, 1, 'body'), hs(gm.p.head, 0, 0.12, 0, 0.13, 1, 'head', { gunner: true }), hs(gm.p.torso, 0, 0.28, 0, 0.22, 1, 'body', { gunner: true })];
    root.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    const M = { root, p, hit, mats: [], eyeMat: null, gibs: [], height: 1.6, radius: 1.4 };
    M.pose = (e) => { p.gunPivot.rotation.x = e.aimPitch || 0; p.body.rotation.y = e.turretYaw || 0; p.gunPivot.position.z = (e.recoil || 0) * 0.3; };
    M.gunnerDown = () => { gm.p.torso.rotation.x = 1.2; gm.p.hips.position.y = 0.4; gm.root.rotation.z = 0.6; };
    M.wreck = () => { grey.color.setHex(0x1a1714); p.body.rotation.z = 0.3; gm.root.visible = false; };
    return M;
  };

  // ---------------------------------------------------------------- enemy types
  const ET = CF.Enemies.types;
  const hun = { kind: 'sentry', human: true, radius: 0.36, height: 1.85, eye: 1.7, fovCos: 0.45, stagger: 45, bolt: 'tracer', sfx: 'mauser', alert: 'shout' };
  Object.assign(ET, {
    german: Object.assign({}, hun, { name: 'German rifleman', hp: 95, walk: 1.5, run: 4.4, range: [6, 40], sight: 52, dmg: 14, projSpeed: 140, burst: 1, burstGap: 0.1, cool: [1.6, 2.8], spread: 1.6, score: 120 }),
    gmg: Object.assign({}, hun, { name: 'MG08 gunner', hp: 150, walk: 0, run: 0, range: [0, 70], sight: 75, fovCos: -0.2, dmg: 7, projSpeed: 120, burst: 9, burstGap: 0.085, cool: [1.4, 2.4], spread: 3.6, score: 250, sfx: 'pkmShot', stagger: 80 }),
    flamer: Object.assign({}, hun, { name: 'Flamethrower', hp: 130, walk: 1.4, run: 3.6, range: [0, 9], sight: 30, fovCos: -0.2, dmg: 0, burst: 0, cool: [99, 99], spread: 2, score: 300, sfx: 'flamer' }),
    storm: Object.assign({}, hun, { name: 'Stormtrooper', hp: 90, walk: 2.2, run: 6.0, range: [0, 16], sight: 44, fovCos: -1, dmg: 0, burst: 0, cool: [99, 99], spread: 2, score: 160 }),
    gsniper: Object.assign({}, hun, { name: 'Sniper', hp: 80, walk: 0, run: 0, range: [12, 140], sight: 130, fovCos: 0.2, dmg: 40, projSpeed: 240, burst: 1, burstGap: 0.1, cool: [3.0, 4.4], spread: 0.4, score: 300, sfx: 'sniperShot', aimTime: 1.4, glint: true }),
    gofficer: Object.assign({}, hun, { name: 'German officer', hp: 110, walk: 1.4, run: 4.6, range: [4, 22], sight: 40, dmg: 10, projSpeed: 90, burst: 2, burstGap: 0.25, cool: [1.0, 1.8], spread: 2.6, score: 250, sfx: 'pistol' }),
    fokker: { name: 'Fokker D.VII', kind: 'fokker', flying: true, hp: 260, walk: 0, run: 0, radius: 3, height: 4, eye: 0.5, range: [0, 140], sight: 400, fovCos: -1,
      dmg: 7, projSpeed: 180, burst: 8, burstGap: 0.07, cool: [0.5, 1.0], spread: 1.6, score: 800, bolt: 'tracer', sfx: 'pkmShot' },
    fieldgun: { name: 'Field gun', kind: 'technical', vehicle: true, static: true, hp: 380, armor: 0.12, radius: 1.4, height: 1.6, eye: 1.0, range: [0, 120], sight: 140, fovCos: -1,
      dmg: 0, burst: 0, cool: [99, 99], spread: 2, score: 600, gunnerHp: 80 }
  });
  const EM = CF.EnemyModels;
  for (const k of ['german', 'gmg', 'flamer', 'storm', 'gsniper', 'gofficer']) EM[k] = () => wwPerson(k);
  EM.fokker = () => SM.fokker();
  EM.fieldgun = () => SM.fieldGun();
})(window.CF);
