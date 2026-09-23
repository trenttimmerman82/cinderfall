'use strict';
/* Cinderfall — procedural first-person weapon models (gun forward = -Z, up = +Y). */
(function (CF) {
  const VM = CF.VM = {};
  let M = null;
  const GEO = {};
  function box() { return GEO.box || (GEO.box = new THREE.BoxGeometry(1, 1, 1)); }
  function cyl() { return GEO.cyl || (GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 18)); }
  function tube() { return GEO.tube || (GEO.tube = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true)); }
  function sph() { return GEO.sph || (GEO.sph = new THREE.SphereGeometry(1, 12, 8)); }
  function caps() { return GEO.caps || (GEO.caps = new THREE.CapsuleGeometry(1, 1, 4, 10)); }

  VM.materials = function () {
    if (M) return M;
    const pm = CF.Tex.list.paintMetal;
    M = {
      metal: new THREE.MeshStandardMaterial({ color: 0x1c2025, metalness: 0.85, roughness: 0.42, envMapIntensity: 0.45, roughnessMap: pm.roughnessMap, normalMap: pm.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) }),
      polymer: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.1, roughness: 0.66, envMapIntensity: 0.4 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x7d848c, metalness: 1, roughness: 0.3, envMapIntensity: 0.55 }),
      accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 1.25, 1.65) }),
      tan: new THREE.MeshStandardMaterial({ color: 0x5a4e3e, metalness: 0.05, roughness: 0.78, envMapIntensity: 0.4 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x1e1d1b, metalness: 0, roughness: 0.92, envMapIntensity: 0.35 }),
      knuckle: new THREE.MeshStandardMaterial({ color: 0x2c2b28, metalness: 0.1, roughness: 0.7, envMapIntensity: 0.4 }),
      sleeve: new THREE.MeshStandardMaterial({ color: 0x262c33, metalness: 0, roughness: 0.95, envMapIntensity: 0.35 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x4a7a90, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }),
      dot: new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.5, 0.25) }),
      coil: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 4.2) }),
      shell: new THREE.MeshStandardMaterial({ color: 0xa82a18, metalness: 0.3, roughness: 0.5 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.95, roughness: 0.3 }),
      grenade: new THREE.MeshStandardMaterial({ color: 0x3d4a36, metalness: 0.4, roughness: 0.55 })
    };
    return M;
  };

  function part(parent, geo, mat, x, y, z, sx, sy, sz, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m); return m;
  }
  const B = (p, mat, x, y, z, sx, sy, sz, rx, ry, rz) => part(p, box(), mat, x, y, z, sx, sy, sz, rx, ry, rz);
  // cylinder along Z
  const CZ = (p, mat, x, y, z, r, len, open) => part(p, open ? tube() : cyl(), mat, x, y, z, r, len, r, Math.PI / 2, 0, 0);
  const node = (p, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); p.add(o); return o; };

  function hand(mat, side) {
    const g = new THREE.Group();
    B(g, mat, 0, 0, 0, 0.066, 0.036, 0.09);
    for (let i = 0; i < 4; i++) {
      const f = B(g, M.glove, side * (0.024 - i * 0.016), -0.025, -0.028, 0.015, 0.042, 0.022, 0.35, 0, 0);
      f.position.y -= Math.abs(i - 1.5) * 0.003;
    }
    B(g, M.knuckle, 0, 0.02, -0.02, 0.06, 0.012, 0.035);
    B(g, M.glove, side * -0.036, -0.004, -0.03, 0.018, 0.02, 0.05, 0, side * 0.5, 0);
    return g;
  }
  function forearm(parent, hx, hy, hz, ex, ey, ez) {
    const a = new THREE.Vector3(hx, hy, hz), b = new THREE.Vector3(ex, ey, ez), d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(caps(), M.sleeve);
    m.scale.set(0.038, len * 0.5, 0.038);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    parent.add(m);
    const cuff = new THREE.Mesh(cyl(), M.glove);
    cuff.scale.set(0.042, 0.04, 0.042); cuff.position.copy(a).addScaledVector(d, 0.035); cuff.quaternion.copy(m.quaternion);
    parent.add(cuff);
    return m;
  }
  function redDot(g, y, z) {
    B(g, M.metal, 0, y - 0.022, z, 0.036, 0.016, 0.06);
    CZ(g, M.metal, 0, y, z, 0.024, 0.055, true);
    CZ(g, M.metal, 0, y, z, 0.0265, 0.012, true).position.z = z - 0.024;
    part(g, new THREE.CircleGeometry(0.023, 20), M.glass, 0, y, z - 0.02);
    part(g, sph(), M.dot, 0, y, z - 0.02, 0.0016, 0.0016, 0.0016);
  }

  function carbine(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    B(gun, M.metal, 0, 0.03, -0.1, 0.068, 0.085, 0.36);
    B(gun, M.metal, 0, 0.078, -0.1, 0.05, 0.014, 0.36);
    B(gun, M.polymer, 0, 0.035, -0.42, 0.066, 0.074, 0.28);
    for (let i = 0; i < 4; i++) B(gun, M.metal, 0.034, 0.04, -0.34 - i * 0.055, 0.004, 0.022, 0.03);
    for (let i = 0; i < 4; i++) B(gun, M.metal, -0.034, 0.04, -0.34 - i * 0.055, 0.004, 0.022, 0.03);
    CZ(gun, M.steel, 0, 0.045, -0.63, 0.012, 0.2);
    CZ(gun, M.metal, 0, 0.045, -0.745, 0.021, 0.07);
    B(gun, M.accent, 0.0345, 0.02, -0.02, 0.003, 0.012, 0.09);
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.012, -0.15); gun.add(P.mag);
    B(P.mag, M.polymer, 0, -0.06, -0.006, 0.034, 0.12, 0.066, 0.18, 0, 0);
    B(P.mag, M.polymer, 0, -0.13, -0.022, 0.034, 0.04, 0.066, 0.34, 0, 0);
    B(P.mag, M.accent, 0, -0.152, -0.03, 0.036, 0.012, 0.07, 0.34, 0, 0);
    B(gun, M.polymer, 0, -0.055, 0.03, 0.034, 0.1, 0.048, -0.3, 0, 0);
    B(gun, M.polymer, 0, 0.025, 0.16, 0.046, 0.075, 0.16);
    B(gun, M.polymer, 0, 0.012, 0.25, 0.05, 0.11, 0.025);
    B(gun, M.metal, 0, -0.02, -0.035, 0.012, 0.03, 0.06);
    P.bolt = B(gun, M.steel, 0.02, 0.087, 0.06, 0.02, 0.012, 0.03);
    redDot(gun, 0.125, -0.12);
    P.muzzle = node(gun, 0, 0.045, -0.79);
    P.eject = node(gun, 0.04, 0.05, -0.07);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.004, -0.045, 0.045); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      forearm(gun, 0.02, -0.08, 0.1, 0.16, -0.32, 0.5);
      P.handL = new THREE.Group(); gun.add(P.handL); P.handL.position.set(-0.01, -0.012, -0.42);
      const hl = hand(M.glove, -1); hl.rotation.set(0.1, 0, 0.5); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.02, -0.22, -0.3, 0.32);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.125, sightZ: -0.12 };
  }

  function shotgun(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    B(gun, M.metal, 0, 0.035, -0.08, 0.07, 0.085, 0.3);
    CZ(gun, M.steel, 0, 0.062, -0.47, 0.017, 0.52);
    CZ(gun, M.metal, 0, 0.022, -0.43, 0.016, 0.42);
    CZ(gun, M.metal, 0, 0.062, -0.735, 0.021, 0.03);
    P.pump = new THREE.Group(); P.pump.position.set(0, 0.022, -0.42); gun.add(P.pump);
    B(P.pump, M.tan, 0, 0, 0, 0.062, 0.056, 0.17);
    for (let i = 0; i < 5; i++) B(P.pump, M.polymer, 0, -0.029, -0.07 + i * 0.035, 0.064, 0.006, 0.012);
    B(gun, M.polymer, 0, -0.05, 0.05, 0.036, 0.1, 0.05, -0.3, 0, 0);
    B(gun, M.tan, 0, 0.03, 0.16, 0.05, 0.08, 0.16);
    B(gun, M.polymer, 0, 0.015, 0.25, 0.054, 0.11, 0.025);
    for (let i = 0; i < 4; i++) { const s = CZ(gun, M.shell, 0.041, 0.028, -0.02 - i * 0.03, 0.009, 0.05); s.rotation.set(0, 0, 0); s.scale.set(0.009, 0.05, 0.009); }
    B(gun, M.accent, 0.036, 0.055, -0.08, 0.002, 0.01, 0.2);
    B(gun, M.metal, 0, 0.09, -0.7, 0.006, 0.018, 0.008);
    B(gun, M.metal, -0.012, 0.09, 0.02, 0.006, 0.022, 0.01); B(gun, M.metal, 0.012, 0.09, 0.02, 0.006, 0.022, 0.01);
    P.muzzle = node(gun, 0, 0.062, -0.76);
    P.eject = node(gun, 0.04, 0.05, -0.1);
    P.loadPort = node(gun, 0, -0.01, -0.12);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.004, -0.04, 0.065); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      forearm(gun, 0.02, -0.07, 0.12, 0.16, -0.32, 0.52);
      P.handL = new THREE.Group(); P.pump.add(P.handL); P.handL.position.set(-0.008, -0.03, 0);
      const hl = hand(M.glove, -1); hl.rotation.set(0.1, 0, 0.5); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.02, -0.22, -0.3, 0.34);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.092, sightZ: 0.02 };
  }

  function pistol(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    P.slide = new THREE.Group(); gun.add(P.slide);
    B(P.slide, M.metal, 0, 0.05, -0.065, 0.032, 0.034, 0.19);
    for (let i = 0; i < 5; i++) B(P.slide, M.polymer, 0.0165, 0.05, 0.0 + i * 0.008, 0.002, 0.026, 0.003);
    B(P.slide, M.metal, 0, 0.071, -0.15, 0.005, 0.009, 0.006);
    B(P.slide, M.metal, -0.009, 0.071, 0.02, 0.006, 0.01, 0.008); B(P.slide, M.metal, 0.009, 0.071, 0.02, 0.006, 0.01, 0.008);
    part(P.slide, sph(), M.dot, 0, 0.0765, -0.15, 0.0022, 0.0022, 0.0022);
    B(gun, M.polymer, 0, 0.022, -0.055, 0.03, 0.026, 0.16);
    CZ(gun, M.steel, 0, 0.05, -0.162, 0.007, 0.012);
    B(gun, M.polymer, 0, -0.04, 0.015, 0.031, 0.11, 0.05, -0.22, 0, 0);
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.09, 0.03); gun.add(P.mag);
    B(P.mag, M.accent, 0, -0.005, 0, 0.033, 0.01, 0.05, -0.22, 0, 0);
    B(gun, M.polymer, 0, 0.0, -0.02, 0.008, 0.02, 0.04);
    P.muzzle = node(gun, 0, 0.05, -0.17);
    P.eject = node(gun, 0.02, 0.06, -0.03);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.003, -0.035, 0.03); P.handR.rotation.set(0.2, 0, -0.1); gun.add(P.handR);
      forearm(gun, 0.02, -0.07, 0.09, 0.12, -0.3, 0.46);
      P.handL = new THREE.Group(); gun.add(P.handL); P.handL.position.set(-0.03, -0.05, 0.02);
      const hl = hand(M.glove, -1); hl.rotation.set(0.25, 0.2, 0.8); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.03, -0.2, -0.3, 0.4);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.074, sightZ: 0.02 };
  }

  function rail(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = { coils: [] };
    B(gun, M.metal, 0, 0.03, -0.14, 0.08, 0.1, 0.5);
    B(gun, M.polymer, 0, -0.012, -0.14, 0.084, 0.03, 0.46);
    for (const sx of [-1, 1]) B(gun, M.steel, sx * 0.024, 0.055, -0.6, 0.012, 0.03, 0.46);
    B(gun, M.metal, 0, 0.03, -0.6, 0.02, 0.012, 0.46);
    for (let i = 0; i < 6; i++) {
      const c = part(gun, GEO.coil || (GEO.coil = new THREE.TorusGeometry(1, 0.22, 6, 16)), M.coil, 0, 0.052, -0.42 - i * 0.07, 0.03, 0.03, 0.03);
      P.coils.push(c);
    }
    B(gun, M.accent, 0.0405, 0.05, -0.1, 0.002, 0.014, 0.26);
    CZ(gun, M.metal, 0, 0.128, -0.1, 0.027, 0.24);
    CZ(gun, M.metal, 0, 0.128, -0.23, 0.033, 0.04);
    CZ(gun, M.metal, 0, 0.128, 0.03, 0.03, 0.03);
    part(gun, new THREE.CircleGeometry(0.03, 20), M.glass, 0, 0.128, -0.251);
    B(gun, M.metal, 0, 0.098, -0.1, 0.02, 0.02, 0.08);
    B(gun, M.polymer, 0, -0.055, 0.05, 0.036, 0.1, 0.05, -0.3, 0, 0);
    B(gun, M.polymer, 0, 0.02, 0.18, 0.05, 0.09, 0.16);
    B(gun, M.polymer, 0, 0.075, 0.16, 0.04, 0.03, 0.1);
    B(gun, M.polymer, 0, 0.01, 0.27, 0.056, 0.12, 0.025);
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.03, -0.08); gun.add(P.mag);
    B(P.mag, M.metal, 0, -0.04, 0, 0.05, 0.07, 0.09);
    P.cell = B(P.mag, M.coil, 0.026, -0.04, 0, 0.002, 0.04, 0.06);
    P.muzzle = node(gun, 0, 0.052, -0.84);
    P.eject = node(gun, 0.045, 0.04, -0.05);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.004, -0.045, 0.065); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      forearm(gun, 0.02, -0.08, 0.12, 0.16, -0.32, 0.52);
      P.handL = new THREE.Group(); gun.add(P.handL); P.handL.position.set(-0.012, -0.02, -0.34);
      const hl = hand(M.glove, -1); hl.rotation.set(0.1, 0, 0.5); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.02, -0.22, -0.3, 0.3);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.128, sightZ: -0.1 };
  }

  function smg(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    B(gun, M.metal, 0, 0.03, -0.08, 0.06, 0.08, 0.28);
    B(gun, M.metal, 0, 0.074, -0.08, 0.045, 0.012, 0.26);
    B(gun, M.polymer, 0, 0.03, -0.29, 0.058, 0.066, 0.15);
    CZ(gun, M.steel, 0, 0.042, -0.42, 0.011, 0.12);
    CZ(gun, M.metal, 0, 0.042, -0.49, 0.018, 0.05);
    B(gun, M.accent, 0.031, 0.05, -0.12, 0.002, 0.006, 0.14); B(gun, M.accent, -0.031, 0.05, -0.12, 0.002, 0.006, 0.14);
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.01, -0.1); gun.add(P.mag);
    B(P.mag, M.polymer, 0, -0.08, 0, 0.03, 0.16, 0.05, 0.08, 0, 0);
    B(P.mag, M.accent, 0, -0.162, 0.006, 0.032, 0.01, 0.052, 0.08, 0, 0);
    B(gun, M.polymer, 0, -0.05, 0.025, 0.032, 0.09, 0.045, -0.25, 0, 0);
    B(gun, M.polymer, 0, -0.045, -0.3, 0.03, 0.08, 0.035, 0.1, 0, 0);
    B(gun, M.metal, 0, 0.02, 0.13, 0.02, 0.05, 0.13);
    B(gun, M.polymer, 0, 0.0, 0.2, 0.04, 0.09, 0.02);
    P.bolt = B(gun, M.steel, 0.02, 0.078, 0.0, 0.018, 0.012, 0.03);
    redDot(gun, 0.108, -0.1);
    P.muzzle = node(gun, 0, 0.042, -0.53);
    P.eject = node(gun, 0.035, 0.05, -0.05);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.004, -0.04, 0.035); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      forearm(gun, 0.02, -0.08, 0.09, 0.16, -0.32, 0.48);
      P.handL = new THREE.Group(); gun.add(P.handL); P.handL.position.set(-0.012, -0.07, -0.3);
      const hl = hand(M.glove, -1); hl.rotation.set(-0.2, 0, 0.9); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.03, -0.22, -0.3, 0.3);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.108, sightZ: -0.1 };
  }

  function rocket(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    CZ(gun, M.grenade, 0, 0.06, -0.18, 0.055, 0.9);
    CZ(gun, M.metal, 0, 0.06, 0.28, 0.062, 0.1, true);
    CZ(gun, M.metal, 0, 0.06, -0.62, 0.064, 0.06, true);
    B(gun, M.polymer, 0, -0.03, -0.05, 0.034, 0.1, 0.05, -0.25, 0, 0);
    B(gun, M.polymer, 0, -0.03, -0.3, 0.03, 0.09, 0.04, 0.1, 0, 0);
    B(gun, M.metal, -0.07, 0.1, -0.2, 0.02, 0.06, 0.08);
    part(gun, new THREE.CircleGeometry(0.02, 12), M.glass, -0.07, 0.11, -0.241);
    B(gun, M.accent, 0.057, 0.06, -0.1, 0.002, 0.012, 0.3);
    P.mag = new THREE.Group(); P.mag.position.set(0, 0.06, -0.68); gun.add(P.mag);
    CZ(P.mag, M.grenade, 0, 0, -0.02, 0.05, 0.08);
    part(P.mag, sph(), M.shell, 0, 0, -0.1, 0.045, 0.045, 0.1);
    P.muzzle = node(gun, 0, 0.06, -0.66);
    P.eject = node(gun, 0, 0.06, 0.34);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.004, -0.06, -0.02); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      forearm(gun, 0.02, -0.09, 0.03, 0.16, -0.32, 0.45);
      P.handL = new THREE.Group(); gun.add(P.handL); P.handL.position.set(-0.01, -0.06, -0.3);
      const hl = hand(M.glove, -1); hl.rotation.set(0.1, 0, 0.5); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.02, -0.22, -0.3, 0.32);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.11, sightZ: -0.2 };
  }

  function minigun(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    B(gun, M.metal, 0, 0.02, -0.02, 0.12, 0.12, 0.26);
    B(gun, M.polymer, 0, 0.1, 0.0, 0.03, 0.05, 0.2);
    P.barrels = new THREE.Group(); P.barrels.position.set(0, 0.03, -0.15); gun.add(P.barrels);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; CZ(P.barrels, M.steel, Math.cos(a) * 0.032, Math.sin(a) * 0.032, -0.3, 0.011, 0.6); }
    CZ(P.barrels, M.metal, 0, 0, -0.08, 0.05, 0.03); CZ(P.barrels, M.metal, 0, 0, -0.45, 0.05, 0.025); CZ(P.barrels, M.metal, 0, 0, -0.59, 0.048, 0.02, true);
    B(gun, M.accent, 0.061, 0.03, -0.02, 0.002, 0.014, 0.2);
    P.mag = new THREE.Group(); P.mag.position.set(0.02, -0.08, 0.02); gun.add(P.mag);
    B(P.mag, M.grenade, 0, -0.04, 0, 0.12, 0.1, 0.16);
    B(P.mag, M.accent, 0.061, -0.04, 0, 0.002, 0.03, 0.1);
    B(gun, M.polymer, 0, -0.06, 0.14, 0.034, 0.1, 0.05, -0.3, 0, 0);
    B(gun, M.polymer, 0, 0.14, -0.1, 0.025, 0.02, 0.18);
    P.muzzle = node(gun, 0, 0.03, -0.77);
    P.eject = node(gun, 0.07, 0.0, -0.02);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.004, -0.05, 0.14); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      forearm(gun, 0.02, -0.08, 0.2, 0.16, -0.32, 0.55);
      P.handL = new THREE.Group(); gun.add(P.handL); P.handL.position.set(-0.02, 0.15, -0.1);
      const hl = hand(M.glove, -1); hl.rotation.set(-0.3, 0, 0.2); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.02, -0.22, -0.4, 0.32);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.16, sightZ: -0.1 };
  }

  function satchel(hands) {
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    // detonator in the right hand, charge in the left
    B(gun, M.polymer, 0, 0.0, 0.0, 0.04, 0.09, 0.03);
    B(gun, M.dot, 0, 0.05, 0.0, 0.016, 0.01, 0.016);
    B(gun, M.steel, 0.012, 0.075, 0.0, 0.004, 0.05, 0.004);
    P.charge = new THREE.Group(); P.charge.position.set(-0.16, 0.0, -0.08); gun.add(P.charge);
    satchelBlock(P.charge, 1);
    P.mag = P.charge;
    P.muzzle = node(gun, -0.16, 0.02, -0.15);
    P.eject = node(gun, 0, 0, 0);
    if (hands) {
      P.handR = hand(M.glove, 1); P.handR.position.set(0.004, -0.04, 0.0); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      forearm(gun, 0.02, -0.07, 0.05, 0.16, -0.32, 0.46);
      P.handL = new THREE.Group(); P.charge.add(P.handL); P.handL.position.set(0.0, -0.05, 0.02);
      const hl = hand(M.glove, -1); hl.rotation.set(0.1, 0, 0.3); P.handL.add(hl);
      forearm(P.handL, -0.02, -0.03, 0.02, -0.12, -0.3, 0.32);
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.08, sightZ: 0 };
  }
  function satchelBlock(g, s) {
    B(g, M.tan, 0, 0, 0, 0.12 * s, 0.07 * s, 0.09 * s);
    B(g, M.polymer, 0, 0, 0, 0.125 * s, 0.03 * s, 0.095 * s);
    B(g, M.polymer, 0, 0.04 * s, 0, 0.04 * s, 0.015 * s, 0.03 * s);
    const led = B(g, M.dot, 0.03 * s, 0.037 * s, 0.02 * s, 0.012 * s, 0.006 * s, 0.012 * s);
    return led;
  }
  VM.satchelWorld = function () {
    VM.materials();
    const g = new THREE.Group();
    g.userData.led = satchelBlock(g, 1.6);
    g.traverse((o) => { o.castShadow = true; });
    return g;
  };
  VM.rocketWorld = function () {
    VM.materials();
    const g = new THREE.Group();
    CZ(g, M.grenade, 0, 0, 0.1, 0.05, 0.3);
    part(g, sph(), M.shell, 0, 0, -0.08, 0.05, 0.05, 0.12);
    for (let i = 0; i < 4; i++) B(g, M.metal, 0, 0, 0.26, 0.004, 0.14, 0.06, 0, 0, i * Math.PI / 4);
    return g;
  };

  VM.grenadeArm = function () {
    VM.materials();
    const g = new THREE.Group();
    const h = hand(M.glove, -1); h.rotation.set(-0.3, 0, 0.3); g.add(h);
    forearm(g, -0.01, -0.02, 0.04, -0.12, -0.35, 0.35);
    const nade = new THREE.Group(); nade.position.set(0, 0.03, -0.045); g.add(nade);
    part(nade, sph(), M.grenade, 0, 0, 0, 0.032, 0.04, 0.032);
    part(nade, cyl(), M.steel, 0, 0.042, 0, 0.012, 0.014, 0.012);
    B(nade, M.accent, 0.012, 0.035, 0, 0.004, 0.03, 0.01);
    g.userData.nade = nade;
    return g;
  };
  VM.grenadeWorld = function () {
    VM.materials();
    const g = new THREE.Group();
    part(g, sph(), M.grenade, 0, 0, 0, 0.045, 0.055, 0.045);
    part(g, cyl(), M.steel, 0, 0.058, 0, 0.016, 0.02, 0.016);
    B(g, M.accent, 0.017, 0.05, 0, 0.006, 0.04, 0.014);
    g.traverse((o) => { o.castShadow = true; });
    return g;
  };

  const BUILDERS = { carbine, shotgun, pistol, rail, smg, rocket, minigun, satchel };
  VM.build = function (id, hands) {
    VM.materials();
    const r = BUILDERS[id](hands);
    r.root.traverse((o) => { if (o.isMesh) { o.castShadow = !hands; o.receiveShadow = false; o.frustumCulled = false; } });
    return r;
  };
})(window.CF);
