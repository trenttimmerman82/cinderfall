'use strict';
/* Cinderfall — procedural Warden security units. Each builder returns { root, p (named parts), hit (spheres), mats, gibs }. */
(function (CF) {
  const EM = CF.EnemyModels = {};
  const G = {};
  const box = () => G.box || (G.box = new THREE.BoxGeometry(1, 1, 1));
  const cyl = () => G.cyl || (G.cyl = new THREE.CylinderGeometry(1, 1, 1, 12));
  const sph = () => G.sph || (G.sph = new THREE.SphereGeometry(1, 16, 12));
  const disc = () => G.disc || (G.disc = new THREE.CylinderGeometry(1, 1, 1, 20));
  let base = null;

  function mats() {
    if (!base) {
      const pm = CF.Tex.list.paintMetal;
      base = {
        armor: new THREE.MeshStandardMaterial({ color: 0xbdb6a8, metalness: 0.35, roughness: 0.5, roughnessMap: pm.roughnessMap, normalMap: pm.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) }),
        frame: new THREE.MeshStandardMaterial({ color: 0x23272d, metalness: 0.8, roughness: 0.42, roughnessMap: pm.roughnessMap }),
        joint: new THREE.MeshStandardMaterial({ color: 0x6b7078, metalness: 0.95, roughness: 0.3 }),
        stripe: new THREE.MeshStandardMaterial({ color: 0x8e1b12, metalness: 0.3, roughness: 0.5 }),
        gun: new THREE.MeshStandardMaterial({ color: 0x1a1d21, metalness: 0.7, roughness: 0.45 }),
        eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.7, 0.3) }),
        vent: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.2, 0.45) }),
        rotor: new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.22, depthWrite: false }),
        heavy: new THREE.MeshStandardMaterial({ color: 0x4d4f4a, metalness: 0.6, roughness: 0.5, roughnessMap: pm.roughnessMap, normalMap: pm.normalMap })
      };
    }
    // per-instance clones for hit flashes
    return {
      armor: base.armor.clone(), frame: base.frame.clone(), heavy: base.heavy.clone(),
      joint: base.joint, stripe: base.stripe, gun: base.gun, eye: base.eye.clone(), vent: base.vent.clone(), rotor: base.rotor
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

  EM.sentry = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.hips = grp(root, 0, 1.0, 0);
    B(p.hips, M.frame, 0, 0, 0, 0.36, 0.18, 0.22);
    B(p.hips, M.armor, 0, 0.02, -0.12, 0.3, 0.12, 0.04);
    p.torso = grp(p.hips, 0, 0.1, 0);
    B(p.torso, M.frame, 0, 0.13, 0, 0.26, 0.22, 0.18);
    B(p.torso, M.armor, 0, 0.4, 0, 0.48, 0.34, 0.3);
    B(p.torso, M.armor, 0, 0.3, -0.16, 0.36, 0.16, 0.04, 0.2, 0, 0);
    B(p.torso, M.stripe, 0, 0.48, -0.152, 0.22, 0.045, 0.02);
    p.pack = B(p.torso, M.frame, 0, 0.4, 0.2, 0.34, 0.3, 0.14);
    B(p.pack, M.eye, 0, 0.2, 0.52, 0.5, 0.08, 0.06);
    m(p.torso, cyl(), M.joint, 0.12, 0.72, 0.22, 0.008, 0.36, 0.008);
    p.head = grp(p.torso, 0, 0.62, -0.02);
    m(p.head, cyl(), M.joint, 0, 0.02, 0, 0.06, 0.08, 0.06);
    B(p.head, M.armor, 0, 0.12, 0, 0.22, 0.19, 0.25);
    B(p.head, M.frame, 0, 0.1, -0.1, 0.2, 0.09, 0.08);
    p.eye = B(p.head, M.eye, 0, 0.11, -0.142, 0.17, 0.035, 0.01);
    B(p.head, M.armor, 0, 0.215, 0.01, 0.16, 0.03, 0.2);
    for (const s of [-1, 1]) {
      const sh = grp(p.torso, s * 0.31, 0.47, 0);
      B(sh, M.armor, s * 0.02, 0.03, 0, 0.17, 0.13, 0.21);
      const up = grp(sh, s * 0.02, -0.04, 0);
      B(up, M.frame, 0, -0.14, 0, 0.09, 0.26, 0.09);
      const el = grp(up, 0, -0.28, 0);
      m(el, sph(), M.joint, 0, 0, 0, 0.055, 0.055, 0.055);
      B(el, M.frame, 0, -0.13, 0, 0.08, 0.24, 0.08);
      B(el, M.armor, 0, -0.12, -0.045, 0.085, 0.18, 0.03);
      p[s < 0 ? 'armL' : 'armR'] = up; p[s < 0 ? 'elbowL' : 'elbowR'] = el;
    }
    p.gun = grp(p.torso, 0.14, 0.3, -0.3);
    B(p.gun, M.gun, 0, 0, 0, 0.075, 0.11, 0.56);
    B(p.gun, M.gun, 0, -0.08, 0.06, 0.05, 0.12, 0.08);
    m(p.gun, cyl(), M.joint, 0, 0.015, -0.33, 0.022, 0.14, 0.022, Math.PI / 2, 0, 0);
    p.gunTip = B(p.gun, M.eye, 0, 0.015, -0.4, 0.03, 0.03, 0.01);
    p.muzzle = grp(p.gun, 0, 0.015, -0.42);
    for (const s of [-1, 1]) {
      const leg = grp(p.hips, s * 0.12, -0.06, 0);
      B(leg, M.frame, 0, -0.21, 0, 0.13, 0.42, 0.14);
      B(leg, M.armor, 0, -0.18, -0.08, 0.12, 0.3, 0.04);
      const knee = grp(leg, 0, -0.44, 0);
      m(knee, sph(), M.joint, 0, 0, 0, 0.07, 0.07, 0.07);
      B(knee, M.armor, 0, -0.21, 0, 0.12, 0.42, 0.13);
      B(knee, M.frame, 0, -0.46, -0.05, 0.14, 0.07, 0.27);
      p[s < 0 ? 'legL' : 'legR'] = leg; p[s < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    const hit = [
      hs(p.head, 0, 0.12, 0, 0.16, 2.0, 'head'),
      hs(p.torso, 0, 0.4, 0, 0.3, 1, 'body'), hs(p.torso, 0, 0.12, 0, 0.21, 1, 'body'), hs(p.hips, 0, 0, 0, 0.2, 0.9, 'body'),
      hs(p.legL, 0, -0.2, 0, 0.12, 0.75, 'limb'), hs(p.legR, 0, -0.2, 0, 0.12, 0.75, 'limb'),
      hs(p.kneeL, 0, -0.22, 0, 0.12, 0.75, 'limb'), hs(p.kneeR, 0, -0.22, 0, 0.12, 0.75, 'limb'),
      hs(p.armL, 0, -0.14, 0, 0.1, 0.75, 'limb'), hs(p.armR, 0, -0.14, 0, 0.1, 0.75, 'limb'), hs(p.gun, 0, 0, -0.1, 0.12, 0.6, 'limb')
    ];
    return { root, p, hit, mats: [M.armor, M.frame], eyeMat: M.eye, gibs: [p.head, p.armL, p.armR, p.gun, p.pack, p.legL, p.kneeR], height: 2.0, radius: 0.42 };
  };

  EM.stalker = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.body = grp(root, 0, 0.72, 0);
    B(p.body, M.frame, 0, 0, 0, 0.4, 0.28, 0.92);
    B(p.body, M.armor, 0, 0.16, 0.05, 0.38, 0.08, 0.72);
    B(p.body, M.armor, 0, 0.12, -0.35, 0.44, 0.12, 0.26, -0.2, 0, 0);
    B(p.body, M.stripe, 0, 0.205, 0.05, 0.08, 0.02, 0.6);
    for (let i = 0; i < 4; i++) B(p.body, M.frame, 0, 0.2, 0.3 - i * 0.14, 0.06, 0.08 - i * 0.012, 0.05);
    p.head = grp(p.body, 0, 0.08, -0.52);
    B(p.head, M.armor, 0, 0, -0.08, 0.26, 0.19, 0.34);
    p.jaw = B(p.head, M.frame, 0, -0.1, -0.12, 0.22, 0.06, 0.28);
    for (const e of [[-0.07, 0.03], [0.07, 0.03], [0, 0.07]]) m(p.head, sph(), M.eye, e[0], e[1], -0.25, 0.028, 0.028, 0.02);
    p.eye = p.head.children[p.head.children.length - 1];
    p.tail = grp(p.body, 0, 0.05, 0.46);
    m(p.tail, cyl(), M.joint, 0, 0.1, 0.18, 0.018, 0.45, 0.018, 1.0, 0, 0);
    p.legs = [];
    for (const lz of [-1, 1]) for (const lx of [-1, 1]) {
      const hip = grp(p.body, lx * 0.23, -0.04, lz * 0.33);
      m(hip, sph(), M.joint, 0, 0, 0, 0.07, 0.07, 0.07);
      B(hip, M.frame, 0, -0.18, 0, 0.08, 0.38, 0.09);
      B(hip, M.armor, lx * 0.02, -0.12, 0, 0.05, 0.22, 0.1);
      const knee = grp(hip, 0, -0.36, 0);
      B(knee, M.frame, 0, -0.17, 0, 0.06, 0.36, 0.06);
      B(knee, M.joint, 0, -0.35, -0.03, 0.08, 0.04, 0.12);
      p.legs.push({ hip, knee, phase: (lx * lz > 0 ? 0 : Math.PI) + (lz > 0 ? 0.35 : 0), front: lz < 0 });
    }
    const hit = [
      hs(p.head, 0, 0, -0.08, 0.19, 2.0, 'head'),
      hs(p.body, 0, 0, -0.2, 0.28, 1, 'body'), hs(p.body, 0, 0, 0.22, 0.28, 1, 'body'),
      hs(p.legs[0].hip, 0, -0.2, 0, 0.1, 0.7, 'limb'), hs(p.legs[1].hip, 0, -0.2, 0, 0.1, 0.7, 'limb'),
      hs(p.legs[2].hip, 0, -0.2, 0, 0.1, 0.7, 'limb'), hs(p.legs[3].hip, 0, -0.2, 0, 0.1, 0.7, 'limb')
    ];
    return { root, p, hit, mats: [M.armor, M.frame], eyeMat: M.eye, gibs: [p.head, p.legs[0].hip, p.legs[3].hip, p.tail], height: 1.0, radius: 0.5 };
  };

  EM.hornet = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.body = grp(root, 0, 0, 0);
    m(p.body, sph(), M.frame, 0, 0, 0, 0.3, 0.2, 0.32);
    m(p.body, sph(), M.armor, 0, 0.06, 0.02, 0.29, 0.14, 0.3);
    B(p.body, M.stripe, 0, 0.19, 0.05, 0.05, 0.02, 0.28);
    p.eye = m(p.body, sph(), M.eye, 0, 0, -0.27, 0.09, 0.09, 0.05);
    m(p.body, cyl(), M.frame, 0, 0, -0.26, 0.12, 0.04, 0.12, Math.PI / 2, 0, 0);
    p.gun = grp(p.body, 0, -0.17, -0.08);
    B(p.gun, M.gun, 0, 0, 0, 0.1, 0.08, 0.32);
    p.muzzle = grp(p.gun, 0, 0, -0.18);
    p.rotors = [];
    for (const rx of [-1, 1]) for (const rz of [-1, 1]) {
      const arm = B(p.body, M.frame, rx * 0.3, 0.02, rz * 0.3, 0.34, 0.035, 0.05, 0, rx * rz > 0 ? -Math.PI / 4 : Math.PI / 4, 0);
      arm.position.set(rx * 0.26, 0.03, rz * 0.26);
      const hub = grp(p.body, rx * 0.46, 0.07, rz * 0.46);
      m(hub, cyl(), M.joint, 0, 0, 0, 0.04, 0.08, 0.04);
      const r = m(hub, disc(), M.rotor, 0, 0.05, 0, 0.24, 0.006, 0.24);
      r.castShadow = false;
      m(hub, sph(), M.eye, 0, -0.04, 0, 0.018, 0.018, 0.018);
      p.rotors.push(hub);
    }
    const hit = [hs(p.body, 0, 0, 0, 0.36, 1, 'body'), hs(p.body, 0, 0, -0.26, 0.12, 2.0, 'head')];
    return { root, p, hit, mats: [M.armor, M.frame], eyeMat: M.eye, gibs: [p.gun, p.rotors[0], p.rotors[3]], height: 0.5, radius: 0.55 };
  };

  EM.juggernaut = function () {
    const M = mats(), root = new THREE.Group(), p = {};
    p.hips = grp(root, 0, 1.3, 0);
    B(p.hips, M.frame, 0, 0, 0, 0.62, 0.32, 0.44);
    p.torso = grp(p.hips, 0, 0.18, 0);
    B(p.torso, M.frame, 0, 0.18, 0, 0.5, 0.3, 0.4);
    p.chest = B(p.torso, M.heavy, 0, 0.62, 0, 1.0, 0.72, 0.64);
    B(p.torso, M.heavy, 0, 0.58, -0.36, 0.92, 0.62, 0.12, 0.08, 0, 0);
    B(p.torso, M.stripe, 0, 0.84, -0.43, 0.5, 0.07, 0.02);
    B(p.torso, M.armor, 0, 0.98, 0, 0.8, 0.12, 0.5);
    p.vent = B(p.torso, M.vent, 0, 0.6, 0.33, 0.5, 0.34, 0.06);
    for (let i = 0; i < 4; i++) B(p.torso, M.frame, 0, 0.47 + i * 0.09, 0.365, 0.52, 0.025, 0.02);
    p.head = grp(p.torso, 0, 1.05, -0.12);
    B(p.head, M.heavy, 0, 0.1, 0, 0.32, 0.22, 0.34);
    p.eye = B(p.head, M.eye, 0, 0.11, -0.175, 0.26, 0.04, 0.01);
    p.pod = grp(p.torso, -0.66, 0.95, 0.02);
    B(p.pod, M.heavy, 0, 0, 0, 0.46, 0.36, 0.62);
    for (let i = 0; i < 6; i++) m(p.pod, cyl(), M.eye, -0.12 + (i % 3) * 0.12, -0.07 + Math.floor(i / 3) * 0.14, -0.32, 0.035, 0.02, 0.035, Math.PI / 2, 0, 0);
    p.podMuzzle = grp(p.pod, 0, 0, -0.4);
    p.armR = grp(p.torso, 0.64, 0.8, 0);
    B(p.armR, M.heavy, 0.04, 0.02, 0, 0.3, 0.3, 0.34);
    B(p.armR, M.frame, 0.04, -0.28, 0, 0.18, 0.4, 0.18);
    p.cannon = grp(p.armR, 0.04, -0.48, -0.2);
    B(p.cannon, M.gun, 0, 0, 0, 0.26, 0.26, 0.9);
    m(p.cannon, cyl(), M.joint, 0, 0, -0.55, 0.07, 0.3, 0.07, Math.PI / 2, 0, 0);
    p.muzzle = grp(p.cannon, 0, 0, -0.72);
    p.armL = grp(p.torso, -0.6, 0.62, 0.05);
    B(p.armL, M.frame, 0, -0.25, 0, 0.18, 0.45, 0.18);
    B(p.armL, M.heavy, 0, -0.55, -0.05, 0.24, 0.22, 0.24);
    for (const s of [-1, 1]) {
      const leg = grp(p.hips, s * 0.26, -0.1, 0);
      B(leg, M.frame, 0, -0.3, 0, 0.26, 0.6, 0.28);
      B(leg, M.heavy, 0, -0.26, -0.15, 0.24, 0.42, 0.05);
      const knee = grp(leg, 0, -0.62, 0);
      m(knee, sph(), M.joint, 0, 0, 0, 0.12, 0.12, 0.12);
      B(knee, M.heavy, 0, -0.28, 0, 0.24, 0.56, 0.26);
      B(knee, M.frame, 0, -0.6, -0.08, 0.32, 0.1, 0.46);
      p[s < 0 ? 'legL' : 'legR'] = leg; p[s < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    const hit = [
      hs(p.head, 0, 0.1, 0, 0.21, 1.6, 'head'),
      hs(p.torso, 0, 0.62, -0.12, 0.52, 0.8, 'body'), hs(p.torso, 0, 0.25, 0, 0.32, 0.8, 'body'),
      hs(p.torso, 0, 0.6, 0.38, 0.24, 2.6, 'weak'),
      hs(p.pod, 0, 0, 0, 0.3, 1.1, 'body'), hs(p.cannon, 0, 0, -0.1, 0.2, 0.7, 'limb'),
      hs(p.legL, 0, -0.3, 0, 0.2, 0.7, 'limb'), hs(p.legR, 0, -0.3, 0, 0.2, 0.7, 'limb'),
      hs(p.kneeL, 0, -0.3, 0, 0.19, 0.7, 'limb'), hs(p.kneeR, 0, -0.3, 0, 0.19, 0.7, 'limb')
    ];
    return { root, p, hit, mats: [M.heavy, M.frame, M.armor], eyeMat: M.eye, ventMat: M.vent, gibs: [p.head, p.pod, p.armR, p.armL, p.legL], height: 2.9, radius: 0.75 };
  };
})(window.CF);
