'use strict';
/* Cinderfall — Green Hell people and machines: the platoon (M1 helmets, rolled sleeves, web gear), the Viet Cong
   (black pajamas, conical hats and boonies, leaves tucked in for camouflage), the NVA (pith helmets, chest rigs),
   and the Huey, the PBR and a sampan. People use the shared skeleton, hit spheres and animation (js/story-models.js);
   they are always built here, whatever the Enhanced characters setting says. */
(function (CF) {
  const U = CF.U, H = CF.Human, SM = CF.StoryModels;
  const { m, B, grp, box, cyl, cylHi, sph, cone, caps } = H.helpers;
  const mat = H.mat;
  const PI = Math.PI;

  // ---------------------------------------------------------------- who wears what
  const SKIN_US = [0xd8a888, 0xc48e6a, 0x8d5a3a, 0x6e4529, 0xe0b498, 0xb07a52];
  const SKIN_VN = [0xc89a70, 0xb88658, 0xd4a47c, 0xa87850];
  const NAM = {
    grunt: { us: true, shirt: [0x56603e, 0x4e5838, 0x5c6442], pants: [0x4e5838, 0x525c3c], head: ['m1', 'm1', 'm1', 'boonie'], gun: 'm16', flak: 0.4, ruck: 0.6 },
    gunner60: { us: true, shirt: [0x4e5838], pants: [0x4e5838], head: ['m1'], gun: 'm60', flak: 0, ruck: 0, belts: true },
    rto: { us: true, shirt: [0x56603e], pants: [0x4e5838], head: ['m1'], gun: 'm16', radio: true },
    medic: { us: true, shirt: [0x5c6442], pants: [0x525c3c], head: ['m1'], gun: 'm16', medic: true },
    lrrp: { us: true, shirt: [0x3e4a2e], pants: [0x3e4a2e], head: ['boonie'], gun: null, tiger: true, paint: true },
    crew: { us: true, shirt: [0x4a5236], pants: [0x4a5236], head: ['flight'], gun: null },
    vc: { vn: true, shirt: [0x16171a, 0x1c1c20, 0x22201c], pants: [0x16171a, 0x1c1c20], head: ['conical', 'boonieVC', 'scarf', 'conical'], gun: 'ak', rig: true, leaves: 0.8, sandals: true },
    vcmg: { vn: true, shirt: [0x16171a], pants: [0x1c1c20], head: ['boonieVC', 'scarf'], gun: 'rpd', rig: true, leaves: 0.6, sandals: true },
    vcrpg: { vn: true, shirt: [0x1c1c20, 0x2a2a24], pants: [0x16171a], head: ['conical', 'scarf'], gun: 'b40', rockets: true, leaves: 0.6, sandals: true },
    vcsniper: { vn: true, shirt: [0x3a4028], pants: [0x2a2e1e], head: ['boonieVC'], gun: 'mosin', leaves: 1, sandals: true },
    ghost: { vn: true, shirt: [0x2e3420], pants: [0x262a1a], head: ['boonieVC'], gun: 'mosin', leaves: 1.2, sandals: true, ghost: true },
    nva: { vn: true, shirt: [0x6a6a46, 0x5e623e, 0x707050], pants: [0x5e623e, 0x666848], head: ['pith', 'pith', 'cap'], gun: 'ak', rig: true, leaves: 0.3 },
    sapper: { vn: true, shirt: [0x1a1a18], pants: [0x1a1a18], head: ['bare'], gun: null, sapper: true, sandals: true, shorts: true },
    tunnel: { vn: true, shirt: [0x16171a], pants: [0x16171a], head: ['bare', 'scarf'], gun: 'ak', rig: true }
  };
  for (const k in NAM) { NAM[k].nam = true; H.LOOKS[k] = Object.assign({ shirt: [0x333333], pants: [0x333333], vest: null, wrap: [0x333333], beard: 0 }, NAM[k]); }

  // ---------------------------------------------------------------- their guns (gun space: forward -Z)
  /** hold: which arm pose (rifle, pkm, rpg, pistol); sfx: the ally's shot sound. */
  function namGun(kind, g) {
    const blk = mat(0x141516, 0.6, 0.5), park = mat(0x2a2c2e, 0.6, 0.6), wood = mat(0x5a3418, 0.6, 0.05), lwood = mat(0x7a4a26, 0.6, 0.05), od = mat(0x4a5233, 0.75, 0.1), brass = mat(0xb08a40, 0.4, 0.8);
    const s = { grip: new THREE.Vector3(0, -0.07, -0.2), fore: new THREE.Vector3(0, -0.04, -0.46), kind: 'rifle', sfx: 'akShot' };
    if (kind === 'm16') {
      B(g, blk, 0, -0.0, 0.05, 0.04, 0.08, 0.24); B(g, park, 0, 0.0, -0.22, 0.045, 0.08, 0.3); B(g, park, 0, 0.07, -0.2, 0.02, 0.04, 0.18);
      m(g, cyl(), blk, 0, 0.0, -0.46, 0.032, 0.22, 0.032, PI / 2, 0, 0); m(g, cyl(), park, 0, 0.0, -0.66, 0.01, 0.2, 0.01, PI / 2, 0, 0);
      B(g, park, 0, 0.05, -0.56, 0.012, 0.06, 0.02); B(g, park, 0, -0.1, -0.24, 0.03, 0.12, 0.06, -0.05, 0, 0); B(g, blk, 0, -0.08, -0.12, 0.03, 0.09, 0.04, 0.3, 0, 0);
      s.muzzle = grp(g, 0, 0, -0.78); s.sfx = 'm16';
    } else if (kind === 'm60' || kind === 'rpd') {
      const m60 = kind === 'm60';
      B(g, m60 ? blk : wood, 0, -0.02, 0.05, 0.045, 0.11, 0.24, -0.1, 0, 0); B(g, park, 0, 0.0, -0.26, 0.07, 0.1, 0.36);
      m(g, cyl(), park, 0, 0.02, -0.76, 0.018, 0.52, 0.018, PI / 2, 0, 0);
      if (m60) { B(g, od, 0, 0.0, -0.5, 0.075, 0.07, 0.12); B(g, park, 0, 0.09, -0.6, 0.015, 0.04, 0.012); for (let i = 0; i < 6; i++) B(g, brass, -0.06, -0.04 - i * 0.03, -0.24, 0.012, 0.02, 0.05); }
      else { m(g, cylHi(), park, 0, -0.1, -0.28, 0.09, 0.05, 0.09, 0, 0, PI / 2); B(g, wood, 0, -0.03, -0.5, 0.05, 0.05, 0.16); } // drum
      for (const sd of [-1, 1]) B(g, park, sd * 0.07, -0.12, -0.9, 0.01, 0.2, 0.01, 0, 0, sd * 0.4);
      s.muzzle = grp(g, 0, 0.02, -1.03); s.fore.set(0, -0.05, -0.5); s.kind = 'pkm'; s.sfx = m60 ? 'm60' : 'pkmShot';
    } else if (kind === 'ak' || kind === 'sks') {
      B(g, wood, 0, -0.01, 0.02, 0.045, 0.1, 0.24, -0.12, 0, 0); B(g, park, 0, 0.0, -0.24, 0.05, 0.075, 0.3); B(g, wood, 0, -0.07, -0.18, 0.035, 0.1, 0.045, 0.3, 0, 0);
      B(g, wood, 0, -0.012, -0.47, 0.05, 0.055, 0.18); m(g, cyl(), park, 0, 0.012, -0.66, 0.013, 0.3, 0.013, PI / 2, 0, 0);
      B(g, park, 0, -0.1, -0.33, 0.04, 0.16, 0.06, -0.35, 0, 0); B(g, park, 0, 0.04, -0.74, 0.012, 0.04, 0.012);
      s.muzzle = grp(g, 0, 0.012, -0.82);
    } else if (kind === 'mosin') {
      B(g, lwood, 0, -0.02, -0.1, 0.045, 0.07, 0.75); B(g, lwood, 0, -0.04, 0.2, 0.04, 0.12, 0.18, -0.1, 0, 0);
      m(g, cyl(), park, 0, 0.02, -0.7, 0.011, 0.5, 0.011, PI / 2, 0, 0); m(g, cyl(), blk, 0.0, 0.08, -0.12, 0.016, 0.24, 0.016, PI / 2, 0, 0);
      B(g, park, 0.03, 0.03, -0.02, 0.05, 0.01, 0.01); // bolt handle
      s.muzzle = grp(g, 0, 0.02, -0.96); s.fore.set(0, -0.04, -0.5); s.sfx = 'sniperShot';
    } else if (kind === 'b40') {
      m(g, cylHi(), wood, 0, 0, -0.1, 0.035, 0.9, 0.035, PI / 2, 0, 0); m(g, cone(), od, 0, 0, -0.66, 0.075, 0.26, 0.075, -PI / 2, 0, 0);
      m(g, cylHi(), od, 0, 0, -0.5, 0.045, 0.12, 0.045, PI / 2, 0, 0); B(g, park, 0, -0.08, -0.12, 0.03, 0.1, 0.04, 0.2, 0, 0);
      s.muzzle = grp(g, 0, 0, -0.8); s.grip.set(0, -0.12, -0.12); s.fore.set(0, -0.06, -0.3); s.kind = 'rpg';
    } else if (kind === 'pistol') {
      B(g, park, 0, 0.03, -0.06, 0.03, 0.035, 0.16); B(g, wood, 0, -0.03, -0.01, 0.028, 0.09, 0.035, 0.25, 0, 0);
      s.muzzle = grp(g, 0, 0.03, -0.15); s.grip.set(0, -0.04, 0); s.fore.set(-0.02, -0.05, 0.01); s.kind = 'pistol'; s.sfx = 'colt';
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return s;
  }
  H.namGun = namGun;

  // ---------------------------------------------------------------- person
  function namPerson(look, seed) {
    const Lk = H.LOOKS[look], rnd = U.mulberry32(seed != null ? seed : (Math.random() * 1e9) | 0), pick = (a) => a[Math.floor(rnd() * a.length)];
    const { root, p } = H.skeleton();
    const O = { look, L: Lk, rnd, skin: pick(Lk.vn ? SKIN_VN : SKIN_US), shirt: pick(Lk.shirt), pants: pick(Lk.pants), head: pick(Lk.head), bulk: (Lk.vn ? 0.9 : 1) * (0.95 + rnd() * 0.1), gun: Lk.gun };
    const bk = O.bulk, skin = mat(O.skin, 0.7), shirt = mat(O.shirt, 0.92), pants = mat(O.pants, 0.92), dark = mat(0x151515, 0.6);
    const web = mat(Lk.vn ? 0x6a6448 : 0x5a5a3a, 0.85), boot = mat(0x1c1a18, 0.7), canvas = mat(0x4a5236, 0.9);
    const tiger = Lk.tiger ? mat(0x4a5230, 0.92) : null;
    // legs: trousers, boots (jungle boots) or rubber sandals on bare feet; sappers in shorts
    for (const s of ['L', 'R']) {
      m(p['leg' + s], caps(), Lk.shorts ? skin : pants, 0, -0.22, 0, 0.082 * bk, 0.17, 0.088 * bk);
      if (Lk.shorts) m(p['leg' + s], caps(), pants, 0, -0.1, 0, 0.088 * bk, 0.06, 0.094 * bk);
      m(p['knee' + s], caps(), Lk.shorts ? skin : pants, 0, -0.21, 0, 0.066 * bk, 0.17, 0.068 * bk);
      if (Lk.sandals) { B(p['foot' + s], skin, 0, -0.03, -0.05, 0.08, 0.06, 0.22); B(p['foot' + s], dark, 0, -0.068, -0.05, 0.09, 0.012, 0.25); }
      else { B(p['foot' + s], boot, 0, -0.03, -0.05, 0.1, 0.09, 0.26); m(p['knee' + s], cyl(), canvas, 0, -0.36, 0, 0.068, 0.12, 0.072); }
    }
    B(p.hips, pants, 0, 0, 0, 0.32 * bk, 0.18, 0.2);
    // torso: shirt; the Americans' sleeves are rolled to the elbow
    m(p.torso, caps(), Lk.tiger ? tiger : shirt, 0, 0.26, 0, 0.185 * bk, 0.18, 0.125 * bk);
    for (const x of [-0.08, 0.08]) B(p.torso, Lk.tiger ? tiger : shirt, x * bk, 0.32, -0.125 * bk, 0.08, 0.07, 0.02); // breast pockets
    m(p.torso, cyl(), skin, 0, 0.5, 0, 0.052, 0.08, 0.052);
    if (Lk.us && !Lk.tiger && !Lk.radio && rnd() < (Lk.flak || 0)) { // M69 flak vest
      B(p.torso, mat(0x4e5634, 0.85), 0, 0.27, 0, 0.38 * bk, 0.36, 0.27 * bk);
      m(p.torso, cylHi(), mat(0x4e5634, 0.85), 0, 0.47, 0.01, 0.11, 0.06, 0.1);
    }
    if (Lk.us) { // web gear: pistol belt with canteens and ammo pouches, suspenders, maybe a towel round the neck
      B(p.hips, web, 0, 0.06, 0, 0.35 * bk, 0.05, 0.22);
      for (const x of [-0.12, 0.12]) B(p.hips, web, x * bk, 0.08, -0.12, 0.08, 0.08, 0.05);
      for (const x of [-0.17, 0.17]) m(p.hips, cylHi(), mat(0x3a4228, 0.7), x * bk, 0.02, 0.1, 0.045, 0.12, 0.045);
      for (const x of [-0.1, 0.1]) { B(p.torso, web, x * bk, 0.26, -0.13 * bk, 0.04, 0.4, 0.015); B(p.torso, web, x * bk, 0.26, 0.13 * bk, 0.04, 0.4, 0.015); }
      if (rnd() < 0.35) m(p.torso, cylHi(), mat(0x5a6442, 0.95), 0, 0.47, 0, 0.1, 0.05, 0.09);
    }
    if (Lk.rig) { // Chicom chest rig: three magazine pouches across the front
      B(p.torso, web, 0, 0.2, -0.13 * bk, 0.28 * bk, 0.14, 0.05);
      for (const x of [-0.08, 0, 0.08]) B(p.torso, web, x * bk, 0.2, -0.16 * bk, 0.07, 0.13, 0.03);
      B(p.torso, web, 0.08, 0.38, 0, 0.03, 0.3, 0.27 * bk, 0, 0, 0.6);
    }
    if (Lk.belts) for (const sd of [-1, 1]) B(p.torso, mat(0xb08a40, 0.4, 0.8), 0, 0.28, -0.005, 0.045, 0.44, 0.27 * bk, 0, 0, sd * 0.75); // crossed belts of 7.62
    if (Lk.ruck && rnd() < Lk.ruck) { B(p.torso, canvas, 0, 0.26, 0.2 * bk, 0.3, 0.3, 0.16); B(p.torso, canvas, 0, 0.44, 0.2 * bk, 0.24, 0.08, 0.14); }
    if (Lk.radio) { B(p.torso, canvas, 0, 0.26, 0.19 * bk, 0.28, 0.34, 0.16); B(p.torso, mat(0x2a2e22, 0.6, 0.3), 0, 0.3, 0.27 * bk, 0.22, 0.26, 0.04); m(p.torso, cyl(), dark, 0.1, 0.95, 0.24, 0.006, 1.1, 0.006, -0.1, 0, 0); }
    if (Lk.medic) for (const x of [-0.15, 0.15]) B(p.hips, mat(0x4a5236, 0.9), x * bk, -0.04, 0.1, 0.1, 0.14, 0.12);
    if (Lk.sapper) { for (const x of [-0.1, 0.1]) B(p.torso, mat(0x6a5a3a, 0.9), x, 0.24, -0.14, 0.12, 0.12, 0.08); B(p.torso, mat(0x6a5a3a, 0.9), 0, 0.3, 0.14, 0.26, 0.18, 0.1); }
    if (Lk.rockets) for (const x of [-0.07, 0.07]) m(p.torso, cone(), mat(0x4a5038, 0.6, 0.2), x, 0.42, 0.16, 0.05, 0.28, 0.05);
    // head
    const hd = p.head;
    m(hd, sph(), skin, 0, 0.12, -0.01, 0.092, 0.112, 0.102);
    m(hd, sph(), skin, 0, 0.1, -0.1, 0.02, 0.026, 0.022);
    for (const x of [-0.034, 0.034]) B(hd, dark, x, 0.14, -0.098, 0.022, 0.009, 0.01);
    if (Lk.paint) for (const [x, y] of [[-0.05, 0.12], [0.04, 0.08], [0, 0.17]]) B(hd, mat(0x2e3a1e, 0.9), x, y, -0.095, 0.05, 0.02, 0.01, 0, 0, 0.5);
    if (Lk.us && rnd() < 0.25) B(hd, mat(0x3a2a1a, 0.95), 0, 0.075, -0.1, 0.06, 0.012, 0.01); // mustache
    const hat = (c) => mat(c, 0.92);
    if (O.head === 'm1') {
      const cover = hat(0x5a6040);
      m(hd, sph(), cover, 0, 0.165, 0.005, 0.13, 0.11, 0.14); m(hd, cylHi(), cover, 0, 0.12, 0.005, 0.135, 0.02, 0.145);
      m(hd, cylHi(), mat(0x2a2a22, 0.9), 0, 0.16, 0.005, 0.132, 0.025, 0.142);                   // the band
      if (rnd() < 0.5) B(hd, mat(0xe0d8c0, 0.8), 0.06, 0.18, -0.06, 0.03, 0.05, 0.01, 0, 0.3, 0); // a card in the band
    } else if (O.head === 'boonie' || O.head === 'boonieVC') {
      const c = O.head === 'boonie' ? hat(Lk.tiger ? 0x4a5230 : 0x56603e) : hat(0x3e4630);
      m(hd, sph(), c, 0, 0.18, 0.0, 0.1, 0.07, 0.11); m(hd, cylHi(), c, 0, 0.16, 0.0, 0.16, 0.01, 0.17);
    } else if (O.head === 'conical') {
      m(hd, cone(), hat(0xc8b888), 0, 0.27, 0.0, 0.27, 0.15, 0.27); m(hd, cylHi(), hat(0x9a8a60), 0, 0.2, 0, 0.27, 0.006, 0.27);
    } else if (O.head === 'pith') {
      const c = hat(0x6a6a44);
      m(hd, sph(), c, 0, 0.18, 0.0, 0.13, 0.11, 0.14); m(hd, cylHi(), c, 0, 0.13, 0.0, 0.17, 0.012, 0.18);
      m(hd, cylHi(), mat(0xc8a030, 0.4, 0.7), 0, 0.2, -0.13, 0.02, 0.005, 0.02, PI / 2, 0, 0);   // the star badge
    } else if (O.head === 'cap') { const c = hat(0x6a6a44); m(hd, cylHi(), c, 0, 0.21, 0, 0.1, 0.06, 0.11); B(hd, c, 0, 0.19, -0.11, 0.12, 0.012, 0.06); }
    else if (O.head === 'scarf') { m(hd, sph(), mat(0x1a1a18, 0.95), 0, 0.17, 0.01, 0.1, 0.078, 0.108); m(hd, cylHi(), mat(0x6a5a3a, 0.95), 0, 0.02, 0.0, 0.1, 0.05, 0.1); }
    else if (O.head === 'flight') { m(hd, sph(), mat(0x3a4230, 0.5, 0.2), 0, 0.17, 0.0, 0.13, 0.12, 0.14); B(hd, mat(0x111111, 0.2, 0.6), 0, 0.15, -0.12, 0.17, 0.05, 0.03); }
    else m(hd, sph(), mat(0x141210, 0.95), 0, 0.17, 0.01, 0.098, 0.075, 0.106);
    // camouflage: leaves tucked into the hat and the harness (VC who wait in the bushes wear the bush)
    const leaves = Lk.leaves && CF.Level.mats && CF.Level.mats.leafBush;
    if (leaves && rnd() < Lk.leaves + 0.1) {
      const lm = CF.Level.mats.leafBush, card = new THREE.PlaneGeometry(1, 1);
      const n = Lk.ghost ? 9 : 5;
      for (let i = 0; i < n; i++) { const c = new THREE.Mesh(card, lm); c.scale.set(0.34, 0.3, 1); c.position.set((rnd() - 0.5) * 0.2, 0.24 + rnd() * 0.08, (rnd() - 0.5) * 0.2); c.rotation.set(rnd() * 0.6, rnd() * PI, rnd() * 0.6); c.castShadow = true; hd.add(c); }
      for (let i = 0; i < n; i++) { const c = new THREE.Mesh(card, lm); c.scale.set(0.4, 0.46, 1); c.position.set((rnd() - 0.5) * 0.3, 0.2 + rnd() * 0.3, 0.12 + rnd() * 0.06); c.rotation.set(rnd() * 0.4, rnd() * PI, rnd() * 0.5); c.castShadow = true; p.torso.add(c); }
    }
    // arms: rolled sleeves (bare forearms) for the platoon; long sleeves for everyone else
    for (const s of ['L', 'R']) {
      m(p['arm' + s], caps(), Lk.tiger ? tiger : shirt, 0, -0.13, 0, 0.056 * bk, 0.13, 0.056 * bk);
      m(p['elbow' + s], caps(), Lk.us && !Lk.tiger ? skin : Lk.tiger ? tiger : shirt, 0, -0.12, 0, 0.046, 0.12, 0.046);
      if (Lk.us && !Lk.tiger) m(p['elbow' + s], cylHi(), shirt, 0, -0.005, 0, 0.056, 0.05, 0.056);
      B(p['hand' + s], skin, 0, -0.03, 0, 0.058, 0.1, 0.034);
    }
    const g = O.gun ? namGun(O.gun, p.gun) : null;
    if (!g) p.gun.visible = false;
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return H.finish(root, p, O, g, null, false);
  }
  H.namPerson = namPerson;
  const make0 = H.make;
  H.make = function (look, seed) { return H.LOOKS[look] && H.LOOKS[look].nam ? namPerson(look, seed) : make0(look, seed); };

  // ---------------------------------------------------------------- the Huey (UH-1D "slick"), nose toward -Z, cabin floor at y = 0.9
  SM.huey = function () {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const od = mat(0x3c4430, 0.65, 0.2), dark = mat(0x1e2018, 0.7, 0.3), glass = mat(0x2a3a40, 0.08, 0.9, { transparent: true, opacity: 0.5 }), inner = mat(0x2a2c26, 0.9), black = mat(0x111111, 0.6, 0.4);
    const tube = mat(0x2a2e24, 0.5, 0.5), yellow = mat(0xc8a030, 0.6), white = mat(0xd8d8d0, 0.7);
    const Bb = (mt, x, y, z, sx, sy, sz, rx, ry, rz) => B(body, mt, x, y, z, sx, sy, sz, rx, ry, rz);
    Bb(od, 0, 0.7, -0.2, 2.4, 0.3, 4.4);                 // belly
    Bb(inner, 0, 0.88, -0.2, 2.2, 0.04, 4.0);            // cabin floor
    Bb(od, 0, 2.75, -0.1, 2.3, 0.3, 4.6);                // cabin roof
    Bb(od, 0, 1.8, 1.65, 2.4, 1.9, 0.3);                 // rear wall of the cabin
    for (const s of [-1, 1]) {
      Bb(od, s * 1.18, 1.8, -1.75, 0.1, 1.9, 0.35);       // door pillar
      Bb(od, s * 1.18, 1.8, 1.35, 0.1, 1.9, 0.6);         // rear side panel (gunner's well)
      Bb(inner, s * 0.2, 1.15, 1.25, 1.6, 0.45, 0.6);     // troop seat
      // door gun on its pintle, a gunner behind it
      const dg = grp(body, s * 1.28, 1.6, 1.15); m(dg, cyl(), dark, 0, -0.4, 0, 0.02, 0.8, 0.02);
      B(dg, black, 0, 0, -0.3, 0.07, 0.1, 0.62); m(dg, cyl(), black, 0, 0.01, -0.85, 0.018, 0.5, 0.018, PI / 2, 0, 0);
      B(dg, mat(0xb08a40, 0.4, 0.8), -s * 0.06, -0.12, -0.25, 0.02, 0.2, 0.04);
    }
    // nose: the cockpit bubble with chin windows
    m(body, sph(), od, 0, 1.25, -2.95, 1.2, 1.05, 1.5);
    m(body, sph(), glass, 0, 1.75, -3.05, 1.12, 0.78, 1.32);
    m(body, sph(), glass, 0, 0.75, -3.6, 0.8, 0.3, 0.6);
    Bb(od, 0, 1.8, -2.1, 2.3, 1.9, 0.12);                // cockpit bulkhead (doorway)
    Bb(inner, 0, 1.2, -2.6, 2.0, 0.08, 1.0);
    // engine housing, exhaust, mast
    Bb(od, 0, 3.15, 0.4, 1.4, 0.55, 2.6); m(body, cylHi(), dark, 0, 3.15, 1.9, 0.32, 0.6, 0.32, PI / 2, 0, 0);
    m(body, cylHi(), dark, 0, 3.6, -0.2, 0.12, 0.6, 0.12);
    // tail boom with the stabiliser, fin and tail rotor
    const boom = m(body, cylHi(), od, 0, 2.2, 5.0, 0.45, 6.6, 0.45, PI / 2, 0, 0); boom.scale.set(0.45, 6.6, 0.38);
    m(body, cylHi(), od, 0, 2.3, 2.2, 0.75, 1.2, 0.7, PI / 2 - 0.35, 0, 0);
    Bb(od, 0, 2.2, 6.0, 2.6, 0.06, 0.55);                                // synchronized elevator
    Bb(od, 0, 3.0, 8.0, 0.14, 1.9, 0.9, -0.5, 0, 0);                     // vertical fin
    Bb(yellow, 0, 2.2, 7.2, 0.46, 0.4, 0.4);                             // a band on the boom
    Bb(white, 0.46, 2.25, 4.0, 0.01, 0.2, 1.4); Bb(white, -0.46, 2.25, 4.0, 0.01, 0.2, 1.4); // ARMY
    const tail = grp(body, -0.15, 3.5, 8.3);
    for (let i = 0; i < 2; i++) B(tail, dark, 0, 0, 0, 0.04, 2.2, 0.16, i * PI / 2, 0, 0);
    // skids
    for (const s of [-1, 1]) {
      m(body, cylHi(), tube, s * 1.25, 0.05, -0.4, 0.05, 4.2, 0.05, PI / 2, 0, 0);
      m(body, cylHi(), tube, s * 1.25, 0.1, -2.5, 0.05, 0.3, 0.05, PI / 2 - 0.6, 0, 0);
      for (const z of [-1.3, 0.8]) m(body, cylHi(), tube, s * 0.95, 0.35, z, 0.045, 0.75, 0.045, 0, 0, s * 0.7);
    }
    // main rotor: two long blades
    const rotor = grp(body, 0, 3.95, -0.2);
    const blade = mat(0x1a1c18, 0.6, 0.3);
    B(rotor, blade, 0, 0, 0, 0.53, 0.05, 14.6).castShadow = true; // one bar is both blades
    B(rotor, dark, 0, 0.12, 0, 0.1, 0.1, 2.4, 0, PI / 2, 0); // stabilizer bar
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7.3, 32), new THREE.MeshBasicMaterial({ color: 0x0c0d0c, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -PI / 2; rotor.add(disc);
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) });
    const beacon = m(body, sph(), red, 0, 3.0, 2.6, 0.08, 0.08, 0.08);
    // crew: two pilots, two door gunners
    const crew = [];
    const seat = (look, seedN, x, y, z, ry, armsTo) => {
      const pm = namPerson(look, seedN); pm.root.position.set(x, y, z); pm.root.rotation.y = ry || 0;
      pm.p.hips.position.y = 0.55; pm.p.legL.rotation.x = pm.p.legR.rotation.x = 1.5; pm.p.kneeL.rotation.x = pm.p.kneeR.rotation.x = -1.4; pm.p.gun.visible = false;
      H.reach(pm.p.armL, pm.p.elbowL, armsTo[0], -1); H.reach(pm.p.armR, pm.p.elbowR, armsTo[1], 1);
      body.add(pm.root); crew.push(pm); return pm;
    };
    for (const s of [-1, 1]) seat('crew', 31 + s, s * 0.5, 0.75, -2.7, 0, [new THREE.Vector3(-0.12, 0.12, -0.35), new THREE.Vector3(0.12, 0.12, -0.35)]);
    for (const s of [-1, 1]) seat('crew', 41 + s, s * 0.85, 0.62, 1.55, -s * PI / 2, [new THREE.Vector3(-0.1, 0.35, -0.45), new THREE.Vector3(0.1, 0.35, -0.4)]);
    g.traverse((x) => { if (x.isMesh && x.material !== glass) x.castShadow = true; });
    disc.castShadow = false;
    g.userData = { body, rotor, tail, beacon, crew, spin: 0, twoBlade: true };
    return g;
  };

  // ---------------------------------------------------------------- PBR Mk II, bow toward -Z; deck at y ~ 0.75 above the waterline
  SM.pbr = function () {
    const g = new THREE.Group(), hull = new THREE.Group(); g.add(hull);
    const green = mat(0x46503a, 0.7, 0.1), dark = mat(0x22261c, 0.8, 0.2), black = mat(0x111111, 0.6, 0.4), canvas = mat(0x5a6244, 0.9), steel = mat(0x5a5e58, 0.5, 0.6);
    const Hb = (mt, x, y, z, sx, sy, sz, rx, ry, rz) => B(hull, mt, x, y, z, sx, sy, sz, rx, ry, rz);
    Hb(green, 0, 0.25, 0.4, 3.1, 0.9, 7.6);                      // hull
    m(hull, cylHi(), green, 0, 0.25, -3.5, 1.55, 0.9, 1.2, 0, 0, 0).scale.set(1.55, 0.9, 1.6); // round the bow
    Hb(dark, 0, -0.12, 0.4, 2.9, 0.2, 7.4);                      // waterline band
    Hb(mat(0x5a6046, 0.8), 0, 0.72, 0.4, 2.9, 0.06, 7.4);        // deck
    for (const s of [-1, 1]) Hb(green, s * 1.52, 0.95, 0.4, 0.08, 0.4, 7.6); // gunwales
    // coxswain flat: armoured shield and a canopy on poles
    Hb(steel, 0, 1.25, -0.4, 2.0, 0.9, 0.08); Hb(dark, 0, 1.55, -0.38, 1.4, 0.2, 0.05); // windscreen slot
    for (const [x, z] of [[-1.0, -0.5], [1.0, -0.5], [-1.0, 1.4], [1.0, 1.4]]) m(hull, cyl(), steel, x, 1.7, z, 0.03, 1.9, 0.03);
    Hb(canvas, 0, 2.65, 0.45, 2.3, 0.05, 2.2);
    Hb(dark, 0, 0.9, 0.9, 0.8, 0.4, 0.6);                        // engine hatch / console
    // twin .50 in the bow tub
    m(hull, cylHi(), steel, 0, 1.0, -2.6, 0.55, 0.55, 0.55);
    const twin = grp(hull, 0, 1.45, -2.6);
    for (const s of [-1, 1]) { B(twin, black, s * 0.12, 0, -0.2, 0.1, 0.14, 0.6); m(twin, cyl(), black, s * 0.12, 0.02, -0.85, 0.022, 0.8, 0.022, PI / 2, 0, 0); }
    B(twin, steel, 0, 0.1, -0.05, 0.5, 0.3, 0.03);
    // aft: an M60 on a stanchion
    const aft = grp(hull, 0.9, 1.4, 3.6); m(aft, cyl(), steel, 0, -0.35, 0, 0.03, 0.7, 0.03); B(aft, black, 0, 0, -0.3, 0.07, 0.1, 0.6);
    // jet-pump wash at the stern (animated by the boat)
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5), new THREE.MeshBasicMaterial({ color: 0xd8e0d8, transparent: true, opacity: 0.35, depthWrite: false }));
    wake.rotation.x = -PI / 2; wake.position.set(0, -0.1, 6.4); g.add(wake);
    // crew: coxswain, bow gunner
    const crew = [];
    const stand = (look, seedN, x, y, z, ry) => { const pm = namPerson(look, seedN); pm.root.position.set(x, y, z); pm.root.rotation.y = ry || 0; pm.p.gun.visible = false; hull.add(pm.root); crew.push(pm); return pm; };
    const cox = stand('crew', 51, 0.3, 0.75, 0.0, 0); H.reach(cox.p.armL, cox.p.elbowL, new THREE.Vector3(-0.1, 0.35, -0.42), -1); H.reach(cox.p.armR, cox.p.elbowR, new THREE.Vector3(0.12, 0.35, -0.42), 1);
    const bow = stand('crew', 52, 0, 0.5, -2.3, 0); H.reach(bow.p.armL, bow.p.elbowL, new THREE.Vector3(-0.14, 0.42, -0.5), -1); H.reach(bow.p.armR, bow.p.elbowR, new THREE.Vector3(0.14, 0.42, -0.5), 1);
    g.traverse((x) => { if (x.isMesh && x !== wake) x.castShadow = true; });
    g.userData = { hull, twin, aft, wake, crew };
    return g;
  };

  /** A sampan with a gunner in the bow: floats, follows its route, armoured to nothing much. */
  SM.sampan = function () {
    const root = new THREE.Group(), p = {};
    const wood = mat(0x5a4028, 0.85), dark = mat(0x2e2016, 0.9);
    p.body = grp(root, 0, 0, 0);
    B(p.body, wood, 0, 0.1, 0, 1.3, 0.5, 5.6); for (const s of [-1, 1]) B(p.body, wood, 0, 0.3, s * 2.9, 0.9, 0.4, 0.6, s * 0.4, 0, 0);
    B(p.body, dark, 0, 0.32, 0, 1.1, 0.06, 5.2);
    const roof = grp(p.body, 0, 0.9, 0.8); m(roof, cylHi(), mat(0x8a7a50, 0.95), 0, 0, 0, 0.75, 1.8, 0.75, PI / 2, 0, 0).scale.set(0.75, 1.8, 0.45);
    p.turret = grp(p.body, 0, 0.32, -1.6);
    p.gunPivot = grp(p.turret, 0, 1.1, 0);
    const gm = namPerson('vcmg'); gm.root.position.set(0, -1.1, 0.4); p.turret.add(gm.root);
    p.gunner = gm; p.muzzle = gm.p.muzzle;
    const rower = namPerson('vc'); rower.root.position.set(0, 0.32, 2.2); rower.p.gun.visible = false; p.body.add(rower.root);
    const hs = (obj, x, y, z, r, mult, tag, extra) => Object.assign({ obj, off: new THREE.Vector3(x, y, z), r, mult, tag, w: new THREE.Vector3() }, extra || {});
    const hit = [hs(p.body, 0, 0.2, -1.4, 0.8, 1, 'body'), hs(p.body, 0, 0.2, 1.2, 0.8, 1, 'body'),
      hs(gm.p.head, 0, 0.12, -0.01, 0.13, 1, 'head', { gunner: true }), hs(gm.p.torso, 0, 0.28, 0, 0.22, 1, 'body', { gunner: true })];
    root.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    const M = { root, p, hit, mats: [], eyeMat: null, gibs: [], height: 1.4, radius: 1.2 };
    M.pose = (e, dt, speed) => {
      p.body.rotation.z = Math.sin(CF.time * 1.3 + e.phase) * 0.04; p.body.rotation.x = Math.sin(CF.time * 0.9) * 0.02;
      p.turret.rotation.y = e.turretYaw || 0;
      if (!e.gunnerDead) {
        gm.aimK = 1; gm.p.torso.rotation.x = (e.aimPitch || 0) * 0.5;
        e.gunnerPose = e.gunnerPose || { state: 'combat', aiming: true, phase: 0, recoil: 0, T: {}, aimPitch: 0 };
        e.gunnerPose.aimPitch = e.aimPitch; e.gunnerPose.recoil = e.recoil;
        H.pose(gm, e.gunnerPose, dt, 0); gm.p.hips.position.y = 0.72; gm.p.kneeL.rotation.x = gm.p.kneeR.rotation.x = -1.1;
      }
      rower.p.armL.rotation.x = rower.p.armR.rotation.x = -0.6 + Math.sin(CF.time * 2.4) * 0.5;
    };
    M.gunnerDown = () => { gm.p.torso.rotation.x = 1.2; gm.p.hips.position.y = 0.4; gm.root.rotation.z = 0.6; };
    M.wreck = () => { p.body.rotation.z = 0.5; p.body.position.y = -0.35; gm.root.visible = false; rower.root.visible = false; };
    return M;
  };

  // ---------------------------------------------------------------- enemy types
  const ET = CF.Enemies.types;
  const vn = { kind: 'sentry', human: true, radius: 0.34, height: 1.8, eye: 1.62, fovCos: 0.45, stagger: 45, bolt: 'tracerGreen', sfx: 'akShot', alert: 'shout' };
  Object.assign(ET, {
    vc: Object.assign({}, vn, { name: 'Viet Cong', hp: 85, walk: 1.6, run: 4.8, range: [6, 34], sight: 44, dmg: 7, projSpeed: 95, burst: 3, burstGap: 0.11, cool: [1.2, 2.2], spread: 2.4, score: 110 }),
    spider: Object.assign({}, vn, { name: 'Viet Cong', hp: 80, walk: 0, run: 0, range: [0, 40], sight: 46, fovCos: -1, dmg: 7, projSpeed: 95, burst: 4, burstGap: 0.1, cool: [0.8, 1.4], spread: 2.6, score: 140 }),
    nva: Object.assign({}, vn, { name: 'NVA regular', hp: 105, walk: 1.6, run: 4.6, range: [8, 36], sight: 48, dmg: 8, projSpeed: 100, burst: 4, burstGap: 0.1, cool: [1.0, 1.9], spread: 2.2, score: 130 }),
    vcmg: Object.assign({}, vn, { name: 'RPD gunner', hp: 140, walk: 1.3, run: 3.4, range: [10, 40], sight: 50, dmg: 6, projSpeed: 100, burst: 7, burstGap: 0.08, cool: [1.6, 2.6], spread: 3.0, score: 180, sfx: 'pkmShot', stagger: 70 }),
    vcrpg: Object.assign({}, vn, { name: 'B-40 gunner', hp: 90, walk: 1.5, run: 4.2, range: [12, 55], sight: 60, dmg: 0, projSpeed: 90, burst: 0, burstGap: 0.1, cool: [99, 99], spread: 2, score: 160, rpg: true }),
    vcsniper: Object.assign({}, vn, { name: 'Sniper', hp: 80, walk: 0, run: 0, range: [12, 130], sight: 120, fovCos: 0.2, dmg: 34, projSpeed: 230, burst: 1, burstGap: 0.1, cool: [3.0, 4.6], spread: 0.45, score: 260, sfx: 'sniperShot', aimTime: 1.5, glint: true }),
    ghost: Object.assign({}, vn, { name: 'The Ghost', hp: 170, walk: 0, run: 0, range: [10, 140], sight: 130, fovCos: 0.1, dmg: 38, projSpeed: 240, burst: 1, burstGap: 0.1, cool: [2.6, 3.8], spread: 0.35, score: 1500, sfx: 'sniperShot', aimTime: 1.25, glint: true }),
    sapper: Object.assign({}, vn, { name: 'Sapper', hp: 70, walk: 2.2, run: 6.2, range: [0, 14], sight: 40, fovCos: -1, dmg: 0, projSpeed: 90, burst: 0, burstGap: 0.1, cool: [99, 99], spread: 2, score: 150 }),
    tunnel: Object.assign({}, vn, { name: 'Tunnel guard', hp: 80, walk: 1.4, run: 3.8, range: [1, 16], sight: 24, fovCos: 0.3, dmg: 9, projSpeed: 90, burst: 3, burstGap: 0.12, cool: [1.0, 1.7], spread: 2.6, score: 130 }),
    sampan: { name: 'Sampan', kind: 'technical', vehicle: true, hp: 260, armor: 0.7, drive: 3.6, turn: 0.7, radius: 1.3, height: 1.4, eye: 1.6, range: [0, 70], sight: 80, fovCos: -1,
      dmg: 6, projSpeed: 100, burst: 6, burstGap: 0.09, cool: [1.4, 2.3], spread: 3.2, score: 400, bolt: 'tracerGreen', sfx: 'pkmShot', gunnerHp: 80, floatY: -0.42 }
  });
  const EM = CF.EnemyModels;
  for (const k of ['vc', 'nva', 'vcmg', 'vcrpg', 'vcsniper', 'ghost', 'sapper', 'tunnel']) EM[k] = () => namPerson(k);
  EM.spider = () => namPerson('vc');
  EM.sampan = () => SM.sampan();
})(window.CF);
