'use strict';
/* Cinderfall — the Rime (Whiteout campaign). Crystal growths that took the Halden Deep crew and their machines.
   Each builder returns the same named parts as the Warden unit it borrows its AI from (see enemy-models.js). */
(function (CF) {
  const EM = CF.EnemyModels;
  const G = {};
  const box = () => G.box || (G.box = new THREE.BoxGeometry(1, 1, 1));
  const cyl = () => G.cyl || (G.cyl = new THREE.CylinderGeometry(1, 1, 1, 10));
  const sph = () => G.sph || (G.sph = new THREE.SphereGeometry(1, 14, 10));
  const oct = () => G.oct || (G.oct = new THREE.OctahedronGeometry(1, 0));
  const ico = () => G.ico || (G.ico = new THREE.IcosahedronGeometry(1, 0));
  const disc = () => G.disc || (G.disc = new THREE.CylinderGeometry(1, 1, 1, 20));
  let base = null;

  function mats() {
    if (!base) {
      const pm = CF.Tex.list.paintMetal, cp = CF.Tex.list.carpet;
      base = {
        suit: new THREE.MeshStandardMaterial({ color: 0xc8512a, metalness: 0, roughness: 0.85, normalMap: cp.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) }),
        pants: new THREE.MeshStandardMaterial({ color: 0x23282f, metalness: 0, roughness: 0.9, normalMap: cp.normalMap }),
        frost: new THREE.MeshStandardMaterial({ color: 0xe6f2fa, metalness: 0, roughness: 0.55 }),
        crystal: new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: new THREE.Color(0.05, 0.3, 0.55), metalness: 0.2, roughness: 0.08, envMapIntensity: 1.8 }),
        deep: new THREE.MeshStandardMaterial({ color: 0x3f7fb6, emissive: new THREE.Color(0.02, 0.12, 0.3), metalness: 0.3, roughness: 0.12, envMapIntensity: 1.4 }),
        shell: new THREE.MeshStandardMaterial({ color: 0xdfeaf2, metalness: 0.4, roughness: 0.4, roughnessMap: pm.roughnessMap, normalMap: pm.normalMap }),
        dark: new THREE.MeshStandardMaterial({ color: 0x1c232c, metalness: 0.7, roughness: 0.45 }),
        orange: new THREE.MeshStandardMaterial({ color: 0xe0582a, metalness: 0.2, roughness: 0.5 }),
        eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 4.6, 7) }),
        vent: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 4.4, 6.5) }),
        rotor: new THREE.MeshBasicMaterial({ color: 0xc8d8e4, transparent: true, opacity: 0.22, depthWrite: false })
      };
    }
    return {
      suit: base.suit.clone(), pants: base.pants, frost: base.frost, crystal: base.crystal.clone(), deep: base.deep.clone(), shell: base.shell.clone(),
      dark: base.dark, orange: base.orange.clone(), eye: base.eye.clone(), vent: base.vent.clone(), rotor: base.rotor
    };
  }
  function m(parent, geo, mat, x, y, z, sx, sy, sz, rx, ry, rz) {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0);
    o.castShadow = true; parent.add(o); return o;
  }
  const B = (p, mat, x, y, z, sx, sy, sz, rx, ry, rz) => m(p, box(), mat, x, y, z, sx, sy, sz, rx, ry, rz);
  const grp = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  const hs = (obj, x, y, z, r, mult, tag) => ({ obj, off: new THREE.Vector3(x, y, z), r, mult, tag, w: new THREE.Vector3() });
  /** A crystal shard: elongated octahedron leaning out along (rx, rz). */
  const shard = (p, mat, x, y, z, w, h, rx, rz, ry) => m(p, oct(), mat, x, y, z, w, h, w, rx || 0, ry || 0, rz || 0);

  // ---------------------------------------------------------------- Thrall: a crewman in an orange parka, crystal through the face
  EM.thrall = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.hips = grp(root, 0, 1.0, 0);
    B(p.hips, M.pants, 0, 0, 0, 0.36, 0.2, 0.24);
    p.torso = grp(p.hips, 0, 0.1, 0);
    B(p.torso, M.suit, 0, 0.3, 0, 0.5, 0.5, 0.32);
    B(p.torso, M.suit, 0, 0.1, 0, 0.44, 0.2, 0.3);
    B(p.torso, M.frost, 0, 0.56, 0.02, 0.52, 0.06, 0.34);
    B(p.torso, M.dark, 0, 0.3, -0.165, 0.06, 0.4, 0.01);
    p.pack = B(p.torso, M.dark, 0, 0.36, 0.2, 0.34, 0.36, 0.12);
    B(p.pack, M.orange, 0, 0.35, 0.3, 0.9, 0.2, 0.9);
    // crystals erupting from the back and shoulders
    shard(p.torso, M.crystal, 0.14, 0.62, 0.16, 0.07, 0.28, -0.6, 0.4);
    shard(p.torso, M.crystal, -0.1, 0.7, 0.12, 0.06, 0.34, -0.3, -0.5);
    shard(p.torso, M.deep, 0.24, 0.52, 0.02, 0.05, 0.2, 0, 0.9);
    p.head = grp(p.torso, 0, 0.62, -0.02);
    m(p.head, sph(), M.suit, 0, 0.13, 0.02, 0.17, 0.18, 0.18);
    m(p.head, sph(), M.frost, 0, 0.13, -0.08, 0.14, 0.12, 0.1);
    B(p.head, M.dark, 0, 0.12, -0.14, 0.2, 0.1, 0.04);
    p.eye = shard(p.head, M.eye, 0.02, 0.15, -0.17, 0.035, 0.09, 0.3, 0.2);
    shard(p.head, M.crystal, 0.06, 0.3, -0.06, 0.05, 0.2, -0.5, -0.3);
    shard(p.head, M.crystal, -0.07, 0.28, -0.02, 0.04, 0.16, -0.2, 0.5);
    for (const s of [-1, 1]) {
      const sh = grp(p.torso, s * 0.31, 0.47, 0);
      m(sh, sph(), M.suit, s * 0.02, 0.02, 0, 0.13, 0.12, 0.15);
      const up = grp(sh, s * 0.02, -0.04, 0);
      B(up, M.suit, 0, -0.14, 0, 0.12, 0.28, 0.12);
      const el = grp(up, 0, -0.28, 0);
      m(el, sph(), M.suit, 0, 0, 0, 0.065, 0.065, 0.065);
      B(el, M.suit, 0, -0.12, 0, 0.1, 0.24, 0.1);
      B(el, M.dark, 0, -0.27, -0.01, 0.1, 0.07, 0.1);
      p[s < 0 ? 'armL' : 'armR'] = up; p[s < 0 ? 'elbowL' : 'elbowR'] = el;
    }
    // the "gun": a crystal lance grown along the right forearm
    p.gun = grp(p.torso, 0.14, 0.3, -0.3);
    shard(p.gun, M.crystal, 0, 0, -0.08, 0.07, 0.34, Math.PI / 2, 0);
    shard(p.gun, M.deep, 0.04, 0.03, 0.08, 0.05, 0.18, Math.PI / 2 - 0.4, 0.4);
    shard(p.gun, M.crystal, -0.04, -0.03, 0.12, 0.04, 0.14, Math.PI / 2 + 0.5, -0.3);
    p.gunTip = shard(p.gun, M.eye, 0, 0, -0.38, 0.03, 0.06, Math.PI / 2, 0);
    p.muzzle = grp(p.gun, 0, 0, -0.44);
    for (const s of [-1, 1]) {
      const leg = grp(p.hips, s * 0.12, -0.06, 0);
      B(leg, M.pants, 0, -0.21, 0, 0.15, 0.42, 0.16);
      const knee = grp(leg, 0, -0.44, 0);
      m(knee, sph(), M.pants, 0, 0, 0, 0.075, 0.075, 0.075);
      B(knee, M.pants, 0, -0.2, 0, 0.13, 0.4, 0.14);
      B(knee, M.dark, 0, -0.44, -0.04, 0.16, 0.1, 0.3);
      B(knee, M.frost, 0, -0.38, -0.04, 0.17, 0.03, 0.31);
      p[s < 0 ? 'legL' : 'legR'] = leg; p[s < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    const hit = [
      hs(p.head, 0, 0.14, 0, 0.17, 2.0, 'head'),
      hs(p.torso, 0, 0.36, 0, 0.3, 1, 'body'), hs(p.torso, 0, 0.1, 0, 0.22, 1, 'body'), hs(p.hips, 0, 0, 0, 0.2, 0.9, 'body'),
      hs(p.legL, 0, -0.2, 0, 0.12, 0.75, 'limb'), hs(p.legR, 0, -0.2, 0, 0.12, 0.75, 'limb'),
      hs(p.kneeL, 0, -0.22, 0, 0.12, 0.75, 'limb'), hs(p.kneeR, 0, -0.22, 0, 0.12, 0.75, 'limb'),
      hs(p.armL, 0, -0.14, 0, 0.1, 0.75, 'limb'), hs(p.armR, 0, -0.14, 0, 0.1, 0.75, 'limb'), hs(p.gun, 0, 0, -0.1, 0.12, 0.6, 'limb')
    ];
    return { root, p, hit, mats: [M.suit, M.crystal], eyeMat: M.eye, gibs: [p.head, p.armL, p.armR, p.gun, p.pack, p.legL, p.kneeR], height: 2.0, radius: 0.42, frost: true };
  };

  // ---------------------------------------------------------------- Skitter: six-legged crystal crawler
  EM.skitter = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.body = grp(root, 0, 0.72, 0);
    shard(p.body, M.deep, 0, 0, 0.08, 0.32, 0.55, Math.PI / 2, 0);
    shard(p.body, M.crystal, 0, 0.1, 0.05, 0.22, 0.46, Math.PI / 2 + 0.15, 0);
    for (let i = 0; i < 5; i++) shard(p.body, M.crystal, (i % 2 ? 0.08 : -0.08), 0.2 + (i % 3) * 0.03, 0.34 - i * 0.14, 0.05, 0.18 + (i % 2) * 0.08, -0.5 + i * 0.1, (i % 2 ? 0.4 : -0.4));
    p.head = grp(p.body, 0, 0.04, -0.46);
    shard(p.head, M.crystal, 0, 0, -0.1, 0.16, 0.26, Math.PI / 2, 0);
    p.jaw = grp(p.head, 0, -0.06, -0.12);
    for (const s of [-1, 1]) shard(p.jaw, M.deep, s * 0.08, 0, -0.14, 0.04, 0.16, Math.PI / 2 + 0.4, s * 0.5);
    for (const e of [[-0.06, 0.06], [0.06, 0.06], [0, 0.1]]) m(p.head, sph(), M.eye, e[0], e[1], -0.26, 0.03, 0.03, 0.02);
    p.eye = p.head.children[p.head.children.length - 1];
    p.tail = grp(p.body, 0, 0.05, 0.46);
    shard(p.tail, M.crystal, 0, 0.12, 0.2, 0.06, 0.34, 1.0, 0);
    p.legs = [];
    const LZ = [-0.3, 0, 0.3];
    for (let li = 0; li < 3; li++) for (const lx of [-1, 1]) {
      const lz = LZ[li];
      const hip = grp(p.body, lx * 0.2, -0.02, lz);
      hip.rotation.z = lx * 0.5;
      m(hip, sph(), M.deep, 0, 0, 0, 0.06, 0.06, 0.06);
      shard(hip, M.crystal, 0, -0.18, 0, 0.05, 0.22, 0, 0);
      const knee = grp(hip, 0, -0.36, 0);
      knee.rotation.z = -lx * 0.9;
      shard(knee, M.deep, 0, -0.2, 0, 0.04, 0.24, 0, 0);
      p.legs.push({ hip, knee, phase: (li % 2 === (lx > 0 ? 1 : 0) ? 0 : Math.PI) + li * 0.4, front: li === 0 });
    }
    const hit = [
      hs(p.head, 0, 0, -0.08, 0.19, 2.0, 'head'),
      hs(p.body, 0, 0, -0.2, 0.28, 1, 'body'), hs(p.body, 0, 0, 0.22, 0.28, 1, 'body'),
      hs(p.legs[0].hip, 0, -0.2, 0, 0.1, 0.7, 'limb'), hs(p.legs[1].hip, 0, -0.2, 0, 0.1, 0.7, 'limb'),
      hs(p.legs[4].hip, 0, -0.2, 0, 0.1, 0.7, 'limb'), hs(p.legs[5].hip, 0, -0.2, 0, 0.1, 0.7, 'limb')
    ];
    return { root, p, hit, mats: [M.crystal, M.deep], eyeMat: M.eye, gibs: [p.head, p.legs[0].hip, p.legs[5].hip, p.tail], height: 0.9, radius: 0.5, frost: true };
  };

  // ---------------------------------------------------------------- Frost drone: a Halden survey quadcopter, crusted over
  EM.frostdrone = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.body = grp(root, 0, 0, 0);
    B(p.body, M.shell, 0, 0, 0, 0.5, 0.18, 0.56);
    B(p.body, M.orange, 0, 0.1, 0.02, 0.4, 0.05, 0.44);
    B(p.body, M.dark, 0, -0.1, 0, 0.3, 0.06, 0.36);
    shard(p.body, M.crystal, 0.1, 0.16, 0.12, 0.06, 0.2, -0.4, 0.3);
    shard(p.body, M.crystal, -0.12, 0.14, -0.05, 0.05, 0.16, 0.3, -0.5);
    shard(p.body, M.deep, 0.02, 0.18, -0.18, 0.05, 0.14, 0.6, 0);
    p.eye = m(p.body, sph(), M.eye, 0, 0, -0.29, 0.08, 0.08, 0.04);
    m(p.body, cyl(), M.dark, 0, 0, -0.28, 0.11, 0.04, 0.11, Math.PI / 2, 0, 0);
    p.gun = grp(p.body, 0, -0.15, -0.08);
    shard(p.gun, M.crystal, 0, 0, -0.06, 0.05, 0.2, Math.PI / 2, 0);
    p.muzzle = grp(p.gun, 0, 0, -0.26);
    p.rotors = [];
    for (const rx of [-1, 1]) for (const rz of [-1, 1]) {
      const arm = B(p.body, M.dark, 0, 0.02, 0, 0.36, 0.035, 0.05, 0, rx * rz > 0 ? -Math.PI / 4 : Math.PI / 4, 0);
      arm.position.set(rx * 0.28, 0.03, rz * 0.28);
      const hub = grp(p.body, rx * 0.48, 0.07, rz * 0.48);
      m(hub, cyl(), M.shell, 0, 0, 0, 0.05, 0.08, 0.05);
      const r = m(hub, disc(), M.rotor, 0, 0.05, 0, 0.24, 0.006, 0.24); r.castShadow = false;
      m(hub, sph(), rx * rz > 0 ? M.eye : M.vent, 0, -0.04, 0, 0.018, 0.018, 0.018);
      p.rotors.push(hub);
    }
    const hit = [hs(p.body, 0, 0, 0, 0.38, 1, 'body'), hs(p.body, 0, 0, -0.27, 0.12, 2.0, 'head')];
    return { root, p, hit, mats: [M.shell, M.crystal], eyeMat: M.eye, gibs: [p.gun, p.rotors[0], p.rotors[3]], height: 0.5, radius: 0.55, frost: true };
  };

  // ---------------------------------------------------------------- Colossus: ice golem around a glowing heart-shard (weak point on its back)
  EM.colossus = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.hips = grp(root, 0, 1.3, 0);
    shard(p.hips, M.deep, 0, 0, 0, 0.5, 0.36, 0, 0, 0.5);
    p.torso = grp(p.hips, 0, 0.18, 0);
    shard(p.torso, M.deep, 0, 0.3, 0, 0.42, 0.4, 0, 0);
    p.chest = m(p.torso, ico(), M.shell, 0, 0.66, 0, 0.62, 0.5, 0.44);
    m(p.torso, ico(), M.frost, 0, 0.9, -0.1, 0.5, 0.26, 0.38);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      shard(p.torso, i % 2 ? M.crystal : M.deep, Math.cos(a) * 0.36, 0.95 + (i % 3) * 0.06, 0.1 + Math.sin(a) * 0.2, 0.09, 0.42 + (i % 3) * 0.14, Math.sin(a) * 0.5 - 0.2, -Math.cos(a) * 0.6);
    }
    // heart-shard on the back: the weak point
    p.vent = shard(p.torso, M.vent, 0, 0.62, 0.38, 0.2, 0.3, 0.3, 0);
    shard(p.torso, M.crystal, 0.16, 0.62, 0.4, 0.06, 0.22, 0.5, 0.6);
    shard(p.torso, M.crystal, -0.16, 0.62, 0.4, 0.06, 0.22, 0.5, -0.6);
    p.head = grp(p.torso, 0, 1.05, -0.12);
    m(p.head, ico(), M.frost, 0, 0.1, 0, 0.24, 0.2, 0.24);
    p.eye = B(p.head, M.eye, 0, 0.1, -0.2, 0.26, 0.05, 0.02);
    shard(p.head, M.crystal, 0, 0.36, 0, 0.08, 0.3, 0, 0);
    // shoulder growth that lobs shard clusters
    p.pod = grp(p.torso, -0.66, 0.95, 0.02);
    m(p.pod, ico(), M.deep, 0, 0, 0, 0.3, 0.28, 0.34);
    for (let i = 0; i < 4; i++) shard(p.pod, M.crystal, (i % 2 - 0.5) * 0.18, 0.14, (Math.floor(i / 2) - 0.5) * 0.18, 0.06, 0.3, (Math.floor(i / 2) - 0.5) * 0.6, (i % 2 - 0.5) * 0.6);
    p.podMuzzle = grp(p.pod, 0, 0.45, 0);
    p.armR = grp(p.torso, 0.64, 0.8, 0);
    m(p.armR, ico(), M.shell, 0.04, 0.02, 0, 0.26, 0.24, 0.28);
    shard(p.armR, M.deep, 0.04, -0.28, 0, 0.14, 0.3, 0, 0);
    p.cannon = grp(p.armR, 0.04, -0.5, -0.2);
    shard(p.cannon, M.crystal, 0, 0, -0.2, 0.16, 0.62, Math.PI / 2, 0);
    shard(p.cannon, M.deep, 0, 0.08, 0.1, 0.12, 0.3, Math.PI / 2 - 0.3, 0);
    p.muzzle = grp(p.cannon, 0, 0, -0.82);
    p.armL = grp(p.torso, -0.6, 0.62, 0.05);
    shard(p.armL, M.deep, 0, -0.25, 0, 0.13, 0.32, 0, 0);
    m(p.armL, ico(), M.shell, 0, -0.58, -0.05, 0.22, 0.2, 0.22);
    for (const s of [-1, 1]) {
      const leg = grp(p.hips, s * 0.28, -0.1, 0);
      shard(leg, M.deep, 0, -0.3, 0, 0.2, 0.38, 0, 0);
      m(leg, ico(), M.shell, 0, -0.26, -0.12, 0.2, 0.26, 0.12);
      const knee = grp(leg, 0, -0.62, 0);
      m(knee, ico(), M.frost, 0, 0, 0, 0.14, 0.14, 0.14);
      shard(knee, M.deep, 0, -0.3, 0, 0.18, 0.36, 0, 0);
      m(knee, ico(), M.shell, 0, -0.6, -0.08, 0.28, 0.1, 0.36);
      p[s < 0 ? 'legL' : 'legR'] = leg; p[s < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    const hit = [
      hs(p.head, 0, 0.1, 0, 0.23, 1.6, 'head'),
      hs(p.torso, 0, 0.62, -0.12, 0.52, 0.8, 'body'), hs(p.torso, 0, 0.25, 0, 0.32, 0.8, 'body'),
      hs(p.torso, 0, 0.62, 0.4, 0.24, 2.6, 'weak'),
      hs(p.pod, 0, 0, 0, 0.3, 1.1, 'body'), hs(p.cannon, 0, 0, -0.2, 0.2, 0.7, 'limb'),
      hs(p.legL, 0, -0.3, 0, 0.2, 0.7, 'limb'), hs(p.legR, 0, -0.3, 0, 0.2, 0.7, 'limb'),
      hs(p.kneeL, 0, -0.3, 0, 0.19, 0.7, 'limb'), hs(p.kneeR, 0, -0.3, 0, 0.19, 0.7, 'limb')
    ];
    return { root, p, hit, mats: [M.shell, M.deep, M.crystal], eyeMat: M.eye, ventMat: M.vent, ventCol: [1.4, 4.4, 6.5], gibs: [p.head, p.pod, p.armR, p.armL, p.legL], height: 3.0, radius: 0.75, frost: true };
  };

  // ---------------------------------------------------------------- Bloom: a nest of crystal that seeds Skitters
  EM.bloom = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.base = grp(root, 0, 0, 0);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + (i % 2) * 0.2, r = 0.7 + (i % 3) * 0.25;
      shard(p.base, i % 3 ? M.deep : M.crystal, Math.cos(a) * r, 0.5 + (i % 3) * 0.2, Math.sin(a) * r, 0.22 + (i % 2) * 0.1, 0.9 + (i % 4) * 0.35, Math.sin(a) * 0.55, -Math.cos(a) * 0.55);
    }
    m(p.base, ico(), M.frost, 0, 0.2, 0, 1.3, 0.4, 1.3);
    p.core = m(p.base, ico(), M.eye, 0, 1.4, 0, 0.62, 0.62, 0.62);
    p.crown = grp(p.base, 0, 1.4, 0);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      shard(p.crown, M.crystal, Math.cos(a) * 0.75, 0.55, Math.sin(a) * 0.75, 0.13, 0.9, Math.sin(a) * 0.4, -Math.cos(a) * 0.4);
    }
    shard(p.crown, M.crystal, 0, 1.3, 0, 0.18, 0.9, 0, 0);
    const hit = [hs(p.core, 0, 0, 0, 0.6, 2.0, 'weak'), hs(p.base, 0, 0.8, 0, 1.2, 1, 'body'), hs(p.crown, 0, 0.8, 0, 0.8, 1, 'body')];
    return { root, p, hit, mats: [M.crystal, M.deep], eyeMat: M.eye, gibs: [p.crown], height: 3.2, radius: 1.3, frost: true };
  };
})(window.CF);
