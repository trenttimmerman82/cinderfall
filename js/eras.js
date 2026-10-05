'use strict';
/* Cinderfall — period kit. A campaign set in another war swaps the seven campaign weapon slots for guns of its time
   (CF.Weapons.setEra): new names and handling here, new first-person models built from the viewmodel kit.
   Ids stay the same (carbine, shotgun, rail, pistol, rocket, minigun, satchel), so saves and number keys don't change.
   Arms are the soldier's own: bare hands and a fatigue sleeve, not the multiplayer suit. */
(function (CF) {
  const ER = CF.Eras = {};
  let MT = null;
  /** Period materials: blued and parkerized steel, walnut, black furniture, olive drab, skin and sleeve. */
  function mats() {
    if (MT) return MT;
    const M = CF.VM.kit.mats();
    const std = (c, metal, rough, env) => new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: rough, envMapIntensity: env == null ? 0.45 : env });
    MT = {
      blued: std(0x16181c, 0.85, 0.38), park: std(0x24262a, 0.55, 0.62), black: std(0x121314, 0.1, 0.62, 0.35),
      walnut: std(0x5e341a, 0.05, 0.55, 0.5), walnutDark: std(0x3e2210, 0.05, 0.6, 0.45), od: std(0x4a5233, 0.15, 0.75, 0.35),
      rubber: std(0x141414, 0, 0.95, 0.2), brass: M.brass, steel: M.steel, glass: M.glass,
      skin: std(0x6e4a32, 0, 0.85, 0.08), nail: std(0xc89a7a, 0, 0.5, 0.1), sleeve: std(0x4c5434, 0, 0.95, 0.12), cuff: std(0x3e452a, 0, 0.95, 0.12),
      khaki: std(0x8a7a52, 0, 0.92, 0.3), wool: std(0x5a5236, 0, 0.98, 0.25)
    };
    return MT;
  }
  ER.mats = mats;
  const K = () => CF.VM.kit;

  // ---------------------------------------------------------------- hands
  /** A bare hand (period soldiers wore no gloves): palm, four fingers wrapped forward, thumb. */
  function bareHand(side) {
    const k = K(), m = mats(), g = new THREE.Group();
    k.B(g, m.skin, 0, 0, 0, 0.064, 0.034, 0.088);
    for (let i = 0; i < 4; i++) { const f = k.B(g, m.skin, side * (0.023 - i * 0.0155), -0.024, -0.03, 0.0145, 0.04, 0.02, 0.35, 0, 0); f.position.y -= Math.abs(i - 1.5) * 0.003; }
    k.B(g, m.skin, side * -0.035, -0.004, -0.03, 0.017, 0.019, 0.05, 0, side * 0.5, 0);
    return g;
  }
  /** Rolled fatigue sleeve from the wrist to the edge of the view. */
  function sleeve(parent, hx, hy, hz, ex, ey, ez, era) {
    const a = new THREE.Vector3(hx, hy, hz), b = new THREE.Vector3(ex, ey, ez), d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(K().caps(), era === 'ww1' ? mats().wool : mats().skin);
    m.scale.set(0.034, len * 0.5, 0.034); m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(m);
    // the rolled-up sleeve sits a hand's length back from the wrist (WW1 tunics run all the way down)
    const s = new THREE.Mesh(K().cyl(), era === 'ww1' ? mats().wool : mats().sleeve);
    const at = era === 'ww1' ? 0.02 : 0.42;
    s.scale.set(0.045, era === 'ww1' ? len * 0.96 : len * 0.6, 0.045); s.quaternion.copy(m.quaternion);
    s.position.copy(a).addScaledVector(d, len * (era === 'ww1' ? 0.5 : at + 0.3)); parent.add(s);
    const c = new THREE.Mesh(K().cyl(), era === 'ww1' ? mats().khaki : mats().cuff);
    c.scale.set(0.049, 0.035, 0.049); c.quaternion.copy(m.quaternion);
    c.position.copy(a).addScaledVector(d, era === 'ww1' ? 0.04 : len * at); parent.add(c);
    return m;
  }
  /** The usual rifle hold: right hand on the grip, left hand under the fore-end at fz. */
  function arms(gun, P, gy, gz, fy, fz, era, o) {
    o = o || {};
    P.handR = bareHand(1); P.handR.position.set(0.004, gy, gz); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
    sleeve(gun, 0.02, gy - 0.035, gz + 0.055, 0.16, -0.32, 0.5, era);
    P.handL = new THREE.Group(); (o.leftParent || gun).add(P.handL); P.handL.position.set(-0.01, fy, fz);
    const hl = bareHand(-1); hl.rotation.set(0.1, 0, 0.5); P.handL.add(hl);
    sleeve(P.handL, -0.02, -0.03, 0.02, -0.22, -0.3, 0.32, era);
    P.handLHome = P.handL.position.clone();
  }
  ER.arms = arms; ER.bareHand = bareHand; ER.sleeve = sleeve;
  /** Pistol hold: both hands on the grip. */
  function pistolArms(gun, P, gz, era) {
    P.handR = bareHand(1); P.handR.position.set(0.003, -0.035, gz); P.handR.rotation.set(0.2, 0, -0.1); gun.add(P.handR);
    sleeve(gun, 0.02, -0.07, gz + 0.06, 0.12, -0.3, 0.46, era);
    P.handL = new THREE.Group(); gun.add(P.handL); P.handL.position.set(-0.03, -0.05, gz - 0.01);
    const hl = bareHand(-1); hl.rotation.set(0.25, 0.2, 0.8); P.handL.add(hl);
    sleeve(P.handL, -0.02, -0.03, 0.03, -0.2, -0.3, 0.4, era);
    P.handLHome = P.handL.position.clone();
  }
  ER.pistolArms = pistolArms;

  // ---------------------------------------------------------------- Vietnam, 1968
  /** M16A1: carry handle, triangular handguard, birdcage flash hider, 20-round magazine. */
  function m16(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.park, 0, 0.022, -0.06, 0.05, 0.062, 0.22);                 // lower receiver
    k.B(gun, m.park, 0, 0.074, -0.08, 0.046, 0.048, 0.28);                // upper receiver
    k.B(gun, m.park, 0, 0.12, -0.05, 0.016, 0.03, 0.2);                   // carry handle web
    k.B(gun, m.park, 0, 0.142, -0.05, 0.026, 0.014, 0.21);                // carry handle top
    for (const sx of [-0.011, 0.011]) k.B(gun, m.park, sx, 0.164, 0.035, 0.005, 0.03, 0.012); // rear aperture: two ears…
    k.B(gun, m.park, 0, 0.152, 0.035, 0.027, 0.006, 0.012); k.B(gun, m.park, 0, 0.177, 0.035, 0.027, 0.005, 0.012); // …and the ring
    k.B(gun, m.black, 0.026, 0.07, -0.02, 0.006, 0.018, 0.02);            // forward assist
    k.CZ(gun, m.black, 0, 0.068, -0.33, 0.033, 0.25);                    // handguard
    for (let i = 0; i < 6; i++) k.CZ(gun, m.park, 0, 0.068, -0.23 - i * 0.04, 0.0345, 0.006);
    k.CZ(gun, m.park, 0, 0.068, -0.205, 0.038, 0.02);                    // delta ring
    k.CZ(gun, m.blued, 0, 0.068, -0.55, 0.009, 0.22);                    // barrel
    k.B(gun, m.park, 0, 0.09, -0.5, 0.018, 0.05, 0.028);                  // front sight base
    k.B(gun, m.park, 0, 0.14, -0.5, 0.005, 0.05, 0.005);                  // front sight post, up to the sight line
    for (const s of [-1, 1]) k.B(gun, m.park, s * 0.012, 0.13, -0.5, 0.004, 0.04, 0.012);
    k.CZ(gun, m.park, 0, 0.068, -0.685, 0.013, 0.05, true);              // birdcage
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.01, -0.11); gun.add(P.mag);
    k.B(P.mag, m.park, 0, -0.06, 0, 0.03, 0.12, 0.062, 0.06, 0, 0);
    k.B(gun, m.black, 0, -0.045, 0.02, 0.032, 0.09, 0.045, -0.3, 0, 0);   // pistol grip
    k.B(gun, m.black, 0, 0.045, 0.16, 0.044, 0.07, 0.2);                  // stock
    k.B(gun, m.black, 0, 0.012, 0.18, 0.042, 0.06, 0.16, -0.16, 0, 0);
    k.B(gun, m.black, 0, 0.026, 0.265, 0.048, 0.12, 0.022);               // butt plate
    k.B(gun, m.park, 0, -0.005, -0.03, 0.01, 0.03, 0.05);                 // trigger guard
    P.bolt = k.B(gun, m.park, 0, 0.106, 0.06, 0.018, 0.01, 0.024);        // charging handle
    P.muzzle = k.node(gun, 0, 0.068, -0.715);
    P.eject = k.node(gun, 0.03, 0.074, -0.06);
    if (hands) arms(gun, P, -0.04, 0.045, 0.02, -0.34, 'nam');
    return { root, gun, parts: P, sightY: 0.165, sightZ: 0.035 };
  }
  /** Ithaca 37: walnut stock and ribbed slide, blued receiver, bead front sight. */
  function ithaca(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.blued, 0, 0.034, -0.07, 0.052, 0.08, 0.25);               // receiver
    k.CZ(gun, m.blued, 0, 0.062, -0.47, 0.015, 0.52);                    // barrel
    k.CZ(gun, m.blued, 0, 0.026, -0.42, 0.013, 0.42);                    // magazine tube
    k.CZ(gun, m.blued, 0, 0.026, -0.635, 0.015, 0.02);
    k.part(gun, k.sph(), m.brass, 0, 0.081, -0.715, 0.004, 0.004, 0.004);  // bead
    P.pump = new THREE.Group(); P.pump.position.set(0, 0.024, -0.42); gun.add(P.pump);
    k.B(P.pump, m.walnut, 0, 0, 0, 0.056, 0.05, 0.17);
    for (let i = 0; i < 9; i++) k.B(P.pump, m.walnutDark, 0, -0.021, -0.075 + i * 0.019, 0.058, 0.009, 0.006);
    k.B(gun, m.walnut, 0, -0.045, 0.05, 0.036, 0.09, 0.05, -0.32, 0, 0);
    k.B(gun, m.walnut, 0, 0.02, 0.17, 0.046, 0.075, 0.2, -0.05, 0, 0);
    k.B(gun, m.rubber, 0, 0.012, 0.275, 0.05, 0.11, 0.02);
    k.B(gun, m.blued, 0, -0.012, -0.02, 0.008, 0.026, 0.05);
    for (let i = 0; i < 2; i++) k.CZ(gun, m.brass, -0.03, 0.02, -0.03 - i * 0.03, 0.008, 0.012);
    P.muzzle = k.node(gun, 0, 0.062, -0.74);
    P.eject = k.node(gun, 0.03, 0.03, -0.1);
    P.loadPort = k.node(gun, 0, -0.01, -0.12);
    if (hands) arms(gun, P, -0.04, 0.065, -0.03, 0, 'nam', { leftParent: P.pump });
    return { root, gun, parts: P, sightY: 0.083, sightZ: 0.02 };
  }
  /** M21: an accurized M14 in walnut with a long scope. */
  function m21(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.walnut, 0, 0.012, -0.17, 0.05, 0.06, 0.5);                // fore-end to receiver
    k.B(gun, m.walnut, 0, -0.03, 0.04, 0.04, 0.1, 0.06, -0.35, 0, 0);    // wrist
    k.B(gun, m.walnut, 0, 0.0, 0.17, 0.046, 0.1, 0.22, 0.06, 0, 0);       // butt
    k.B(gun, m.park, 0, 0.0, 0.285, 0.048, 0.13, 0.016);                  // butt plate
    k.B(gun, m.walnutDark, 0, 0.06, -0.38, 0.034, 0.03, 0.12);            // upper handguard
    k.B(gun, m.park, 0, 0.052, -0.07, 0.042, 0.04, 0.22);                 // receiver
    P.bolt = k.B(gun, m.steel, 0.024, 0.055, 0.06, 0.012, 0.012, 0.05);   // op rod handle
    k.CZ(gun, m.park, 0, 0.05, -0.62, 0.009, 0.3);                       // barrel
    k.CZ(gun, m.park, 0, 0.05, -0.79, 0.012, 0.05, true);                // flash suppressor
    k.B(gun, m.park, 0, 0.022, -0.5, 0.012, 0.02, 0.1);                   // gas cylinder
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.02, -0.12); gun.add(P.mag);
    k.B(P.mag, m.park, 0, -0.045, 0, 0.032, 0.09, 0.075, 0.08, 0, 0);
    // scope and mount
    k.B(gun, m.black, 0, 0.09, -0.07, 0.02, 0.03, 0.12);
    k.CZ(gun, m.black, 0, 0.122, -0.07, 0.017, 0.28);
    k.CZ(gun, m.black, 0, 0.122, -0.215, 0.025, 0.06);
    k.CZ(gun, m.black, 0, 0.122, 0.075, 0.021, 0.035);
    k.CZ(gun, m.black, 0, 0.142, -0.06, 0.008, 0.02);                    // turret
    k.part(gun, new THREE.CircleGeometry(0.024, 20), m.glass, 0, 0.122, -0.246);
    P.muzzle = k.node(gun, 0, 0.05, -0.82);
    P.eject = k.node(gun, 0.03, 0.06, -0.05);
    if (hands) arms(gun, P, -0.05, 0.06, -0.01, -0.32, 'nam');
    return { root, gun, parts: P, sightY: 0.122, sightZ: -0.07 };
  }
  /** M1911A1: Parkerized slide, brown grips, spur hammer. */
  function colt(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    P.slide = new THREE.Group(); gun.add(P.slide);
    k.B(P.slide, m.park, 0, 0.05, -0.065, 0.028, 0.03, 0.205);
    for (let i = 0; i < 6; i++) k.B(P.slide, m.blued, 0.0145, 0.05, 0.005 + i * 0.006, 0.002, 0.022, 0.002);
    k.B(P.slide, m.park, 0, 0.069, -0.16, 0.004, 0.009, 0.006);           // front sight
    for (const sx of [-0.006, 0.006]) k.B(P.slide, m.park, sx, 0.069, 0.02, 0.005, 0.008, 0.006); // rear notch
    k.B(gun, m.park, 0, 0.026, -0.05, 0.026, 0.022, 0.15);                // frame
    k.CZ(gun, m.blued, 0, 0.05, -0.17, 0.0075, 0.012);
    k.B(gun, m.walnutDark, 0, -0.035, 0.018, 0.031, 0.1, 0.048, -0.2, 0, 0);
    k.B(gun, m.park, 0, -0.035, 0.028, 0.026, 0.104, 0.05, -0.2, 0, 0);
    k.B(gun, m.park, 0, 0.06, 0.04, 0.008, 0.016, 0.014, -0.5, 0, 0);    // hammer
    k.B(gun, m.park, 0, 0.002, -0.025, 0.006, 0.02, 0.04);                // trigger guard
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.09, 0.03); gun.add(P.mag);
    k.B(P.mag, m.park, 0, -0.004, 0, 0.026, 0.01, 0.045, -0.2, 0, 0);
    P.muzzle = k.node(gun, 0, 0.05, -0.175);
    P.eject = k.node(gun, 0.02, 0.06, -0.03);
    if (hands) pistolArms(gun, P, 0.03, 'nam');
    return { root, gun, parts: P, sightY: 0.072, sightZ: 0.02 };
  }
  /** M79 "Thumper": break-open 40 mm launcher, wooden stock, flip-up leaf sight. */
  function m79(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.CZ(gun, m.park, 0, 0.05, -0.31, 0.028, 0.38);                      // barrel
    k.CZ(gun, m.black, 0, 0.05, -0.5, 0.02, 0.01);                       // bore (dark)
    k.CZ(gun, m.park, 0, 0.05, -0.49, 0.03, 0.02, true);
    k.B(gun, m.park, 0, 0.035, -0.06, 0.05, 0.07, 0.14);                  // receiver
    k.B(gun, m.walnut, 0, 0.012, -0.3, 0.046, 0.028, 0.2);               // fore-end
    k.B(gun, m.walnut, 0, -0.025, 0.05, 0.04, 0.09, 0.07, -0.3, 0, 0);
    k.B(gun, m.walnut, 0, 0.012, 0.16, 0.05, 0.1, 0.2);                   // stock
    k.B(gun, m.rubber, 0, 0.012, 0.265, 0.054, 0.12, 0.024);
    k.B(gun, m.park, 0, 0.088, -0.16, 0.034, 0.008, 0.03);               // leaf sight (up)
    for (const sx of [-0.013, 0.013]) k.B(gun, m.park, sx, 0.104, -0.165, 0.004, 0.034, 0.004); k.B(gun, m.park, 0, 0.12, -0.165, 0.03, 0.004, 0.004); // the leaf's frame
    k.B(gun, m.park, 0, 0.096, -0.47, 0.004, 0.02, 0.006);                // front blade
    P.mag = new THREE.Group(); P.mag.position.set(0, 0.05, -0.11); gun.add(P.mag); // the round in the breech
    k.CZ(P.mag, m.brass, 0, 0, 0.0, 0.021, 0.03);
    k.part(P.mag, k.sph(), m.od, 0, 0, -0.03, 0.02, 0.02, 0.03);
    P.muzzle = k.node(gun, 0, 0.05, -0.5);
    P.eject = k.node(gun, 0, 0.05, -0.08);
    if (hands) arms(gun, P, -0.045, 0.06, -0.01, -0.3, 'nam');
    return { root, gun, parts: P, sightY: 0.106, sightZ: -0.16 };
  }
  /** M60: the Pig. Belt hanging from the left side, carry handle on the barrel, folded bipod. */
  function m60(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.park, 0, 0.03, -0.09, 0.064, 0.082, 0.36);               // receiver
    k.B(gun, m.park, 0, 0.08, -0.13, 0.058, 0.022, 0.2);                 // feed cover
    for (const sx of [-0.009, 0.009]) k.B(gun, m.park, sx, 0.1, -0.01, 0.005, 0.024, 0.016); // rear notch
    k.CZ(gun, m.park, 0, 0.05, -0.58, 0.016, 0.62);                     // barrel
    k.CZ(gun, m.park, 0, 0.018, -0.48, 0.013, 0.32);                    // gas cylinder
    k.CZ(gun, m.park, 0, 0.05, -0.89, 0.02, 0.05, true);                // flash hider
    k.B(gun, m.park, 0, 0.095, -0.86, 0.004, 0.03, 0.006);               // front sight (top on the sight line)
    k.B(gun, m.park, 0, 0.1, -0.42, 0.012, 0.04, 0.012);                 // carry handle
    k.B(gun, m.park, 0, 0.122, -0.42, 0.016, 0.012, 0.13);
    for (const s of [-1, 1]) k.B(gun, m.park, s * 0.012, 0.01, -0.68, 0.006, 0.012, 0.2, 0.12, 0, s * 0.15); // folded bipod
    k.B(gun, m.black, 0, -0.06, 0.03, 0.034, 0.1, 0.048, -0.3, 0, 0);
    k.B(gun, m.black, 0, 0.026, 0.18, 0.05, 0.085, 0.2);                // stock
    k.B(gun, m.black, 0, 0.012, 0.29, 0.054, 0.12, 0.022);
    k.B(gun, m.od, 0, 0.015, -0.25, 0.07, 0.07, 0.07);                  // handguard
    P.mag = new THREE.Group(); P.mag.position.set(-0.045, 0.06, -0.12); gun.add(P.mag); // the belt
    for (let i = 0; i < 9; i++) { const a = i * 0.24; const c = k.CZ(P.mag, m.brass, -Math.sin(a) * 0.04 - i * 0.004, -i * 0.016 - (1 - Math.cos(a)) * 0.04, 0, 0.0055, 0.065); c.rotation.set(Math.PI / 2, 0, 0); k.B(P.mag, m.park, -Math.sin(a) * 0.04 - i * 0.004, -i * 0.016 - (1 - Math.cos(a)) * 0.04, 0.01, 0.012, 0.004, 0.016); }
    P.bolt = k.B(gun, m.steel, 0.036, 0.03, 0.06, 0.016, 0.012, 0.03);
    P.muzzle = k.node(gun, 0, 0.05, -0.92);
    P.eject = k.node(gun, 0.04, 0.03, -0.08);
    if (hands) arms(gun, P, -0.05, 0.055, -0.02, -0.25, 'nam');
    return { root, gun, parts: P, sightY: 0.11, sightZ: -0.01 };
  }
  /** C-4 block in the left hand, the clacker-style detonator in the right. */
  function c4(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.od, 0, 0, 0, 0.05, 0.035, 0.09);                          // M57 clacker
    k.B(gun, m.od, 0, 0.03, 0.02, 0.04, 0.02, 0.06, 0.3, 0, 0);
    k.CZ(gun, m.rubber, 0, -0.005, -0.06, 0.006, 0.05);
    P.charge = new THREE.Group(); P.charge.position.set(-0.16, 0.0, -0.08); gun.add(P.charge);
    k.B(P.charge, m.od, 0, 0, 0, 0.13, 0.06, 0.08);
    k.B(P.charge, m.khaki, 0, 0.032, 0, 0.13, 0.006, 0.05);
    k.B(P.charge, m.rubber, 0.05, 0.04, 0.0, 0.01, 0.02, 0.01);
    P.mag = P.charge;
    P.muzzle = k.node(gun, -0.16, 0.02, -0.15);
    P.eject = k.node(gun, 0, 0, 0);
    if (hands) {
      P.handR = bareHand(1); P.handR.position.set(0.004, -0.035, 0.0); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      sleeve(gun, 0.02, -0.07, 0.05, 0.16, -0.32, 0.46, 'nam');
      P.handL = new THREE.Group(); P.charge.add(P.handL); P.handL.position.set(0.0, -0.05, 0.02);
      const hl = bareHand(-1); hl.rotation.set(0.1, 0, 0.3); P.handL.add(hl);
      sleeve(P.handL, -0.02, -0.03, 0.02, -0.12, -0.3, 0.32, 'nam');
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.08, sightZ: 0 };
  }

  ER.nam = {
    label: 'Vietnam, 1968',
    weapons: {
      carbine: { name: 'M16A1', short: 'M16', rpm: 750, dmg: 26, mag: 20, reserve: 140, maxReserve: 240, reload: 2.0, reloadEmpty: 2.5, spreadAds: 0.2, adsFov: 0.8,
        recoil: [0.82, 0.28, 0.034, 0.05], hip: [0.13, -0.14, -0.3], adsZ: -0.2, sound: 'm16', noise: 46 },
      shotgun: { name: 'Ithaca 37', short: 'ITHACA', mag: 6, reserve: 30, maxReserve: 48, dmg: 14, sound: 'shotgun' },
      rail: { name: 'M21 sniper rifle', short: 'M21', coil: false, rpm: 150, dmg: 130, head: 2.6, pierce: 1, hitPad: 0.06, mag: 10, reserve: 30, maxReserve: 50,
        reload: 2.4, reloadEmpty: 2.8, zoom: [0.3, 0.16], adsFov: 0.3, recoil: [3.0, 0.5, 0.08, 0.16], sound: 'm14', tracerEvery: 99, noise: 60, knock: 4 },
      pistol: { name: 'M1911A1', short: '.45', mag: 7, dmg: 38, rpm: 360, recoil: [1.9, 0.5, 0.06, 0.14], sound: 'colt' },
      rocket: { name: 'M79 grenade launcher', short: 'M79', rocket: { speed: 36, radius: 5, damage: 170, impact: 40, drop: 8, size: 0.6 }, mag: 1, reserve: 10, maxReserve: 16,
        reload: 1.6, reloadEmpty: 1.6, recoil: [3.4, 0.6, 0.1, 0.26], adsFov: 0.86, ads: null, hip: [0.14, -0.15, -0.3], adsZ: -0.3, sound: 'thump', noise: 40 },
      minigun: { name: 'M60', short: 'M60', rpm: 560, dmg: 27, head: 1.7, spin: 0, mag: 100, reserve: 200, maxReserve: 400, reload: 4.0, reloadEmpty: 4.4, spreadHip: 2.8, spreadAds: 0.55, spreadMove: 2.2,
        bloom: 0.16, bloomMax: 2.2, recoil: [0.62, 0.34, 0.03, 0.04], adsFov: 0.78, ads: null, hip: [0.16, -0.17, -0.36], adsZ: -0.3, sound: 'm60', tracerEvery: 4, moveMul: 0.86, noise: 58 },
      satchel: { name: 'C-4 satchel', short: 'C-4' }
    },
    vm: { carbine: m16, shotgun: ithaca, rail: m21, pistol: colt, rocket: m79, minigun: m60, satchel: c4 }
  };

  // ---------------------------------------------------------------- the Western Front, 1918
  /** Lee-Enfield SMLE Mk III: wood to the muzzle, a snub nose cap, the bolt on the right. */
  function smleBody(gun, k, m, o) {
    o = o || {};
    k.B(gun, m.walnut, 0, -0.005, 0.17, 0.045, 0.11, 0.2, 0.06, 0, 0);         // butt
    k.B(gun, m.park, 0, -0.005, 0.272, 0.047, 0.115, 0.012);                    // butt plate
    k.B(gun, m.walnut, 0, -0.02, 0.05, 0.036, 0.09, 0.07, -0.35, 0, 0);        // wrist
    k.B(gun, m.walnut, 0, 0.02, -0.3, 0.05, 0.06, 0.56);                        // fore-end
    k.B(gun, m.walnutDark, 0, 0.058, -0.34, 0.04, 0.024, 0.42);                 // upper handguard
    k.B(gun, m.blued, 0, 0.042, -0.02, 0.04, 0.05, 0.16);                       // receiver
    k.B(gun, m.blued, 0, 0.03, -0.6, 0.05, 0.05, 0.07);                         // nose cap
    k.CZ(gun, m.blued, 0, 0.045, -0.645, 0.009, 0.05);
    for (const sx of [-0.009, 0.009]) k.B(gun, m.blued, sx, 0.07, -0.62, 0.004, 0.03, 0.02); // front sight ears
    if (!o.noSights) {
      k.B(gun, m.blued, 0, 0.071, -0.62, 0.004, 0.03, 0.004);                  // front blade (top on the sight line)
      for (const sx of [-0.007, 0.007]) k.B(gun, m.blued, sx, 0.077, -0.12, 0.005, 0.022, 0.012); // rear notch
      k.B(gun, m.blued, 0, 0.068, -0.12, 0.026, 0.006, 0.03);
    }
    k.B(gun, m.blued, 0, -0.005, -0.03, 0.008, 0.026, 0.05);                    // trigger guard
  }
  function smle(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    smleBody(gun, k, m);
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.02, -0.06); gun.add(P.mag);
    k.B(P.mag, m.blued, 0, -0.03, 0, 0.03, 0.06, 0.08);
    P.bolt = new THREE.Group(); P.bolt.position.set(0.03, 0.05, 0.06); gun.add(P.bolt);   // the bolt handle (weapons.js slides it back)
    k.B(P.bolt, m.steel, 0.012, 0, -0.04, 0.03, 0.01, 0.01, 0, 0, -0.5);
    k.part(P.bolt, k.sph(), m.steel, 0.028, -0.01, -0.04, 0.012, 0.012, 0.012);
    P.muzzle = k.node(gun, 0, 0.045, -0.67);
    P.eject = k.node(gun, 0.03, 0.05, -0.02);
    if (hands) arms(gun, P, -0.04, 0.05, -0.01, -0.36, 'ww1');
    return { root, gun, parts: P, sightY: 0.086, sightZ: -0.12 };
  }
  /** Winchester M1897 trench gun: a pump, an exposed hammer, a ventilated heat shield and a bayonet lug. */
  function trenchGun(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.blued, 0, 0.034, -0.07, 0.05, 0.08, 0.24);
    k.B(gun, m.blued, 0, 0.08, 0.035, 0.008, 0.02, 0.016, -0.5, 0, 0);          // hammer
    k.CZ(gun, m.blued, 0, 0.062, -0.47, 0.014, 0.52);
    k.CZ(gun, m.park, 0, 0.066, -0.43, 0.024, 0.4, true);                         // heat shield
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.B(gun, m.black, sx * 0.0235, 0.066, -0.28 - i * 0.055, 0.003, 0.012, 0.022);
    k.CZ(gun, m.blued, 0, 0.026, -0.42, 0.013, 0.42);
    k.B(gun, m.blued, 0, 0.03, -0.68, 0.03, 0.025, 0.04);                       // bayonet lug
    k.part(gun, k.sph(), m.brass, 0, 0.081, -0.715, 0.004, 0.004, 0.004);
    P.pump = new THREE.Group(); P.pump.position.set(0, 0.024, -0.42); gun.add(P.pump);
    k.B(P.pump, m.walnut, 0, 0, 0, 0.052, 0.05, 0.16);
    for (let i = 0; i < 7; i++) k.B(P.pump, m.walnutDark, 0, -0.021, -0.06 + i * 0.02, 0.054, 0.008, 0.006);
    k.B(gun, m.walnut, 0, -0.045, 0.05, 0.036, 0.09, 0.05, -0.32, 0, 0);
    k.B(gun, m.walnut, 0, 0.02, 0.17, 0.046, 0.075, 0.2, -0.05, 0, 0);
    k.B(gun, m.park, 0, 0.012, 0.275, 0.05, 0.11, 0.02);
    P.muzzle = k.node(gun, 0, 0.062, -0.74);
    P.eject = k.node(gun, 0.03, 0.03, -0.1);
    P.loadPort = k.node(gun, 0, -0.01, -0.12);
    if (hands) arms(gun, P, -0.04, 0.065, -0.03, 0, 'ww1', { leftParent: P.pump });
    return { root, gun, parts: P, sightY: 0.083, sightZ: 0.02 };
  }
  /** P14 with a long brass-and-black sniping scope. */
  function p14(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    smleBody(gun, k, m, { noSights: true });
    P.mag = new THREE.Group(); P.mag.position.set(0, -0.01, -0.06); gun.add(P.mag);
    k.B(P.mag, m.blued, 0, -0.025, 0, 0.034, 0.05, 0.08);
    P.bolt = new THREE.Group(); P.bolt.position.set(0.03, 0.05, 0.06); gun.add(P.bolt);
    k.B(P.bolt, m.steel, 0.012, 0, -0.04, 0.03, 0.01, 0.01, 0, 0, -0.5); k.part(P.bolt, k.sph(), m.steel, 0.028, -0.01, -0.04, 0.012, 0.012, 0.012);
    k.B(gun, m.blued, 0, 0.085, -0.05, 0.02, 0.03, 0.1);
    k.CZ(gun, m.black, 0, 0.112, -0.06, 0.015, 0.32);
    k.CZ(gun, m.brass, 0, 0.112, -0.225, 0.02, 0.04);
    k.CZ(gun, m.brass, 0, 0.112, 0.105, 0.018, 0.03);
    k.part(gun, new THREE.CircleGeometry(0.019, 20), m.glass, 0, 0.112, -0.246);
    P.muzzle = k.node(gun, 0, 0.045, -0.67);
    P.eject = k.node(gun, 0.03, 0.05, -0.02);
    if (hands) arms(gun, P, -0.04, 0.05, -0.01, -0.36, 'ww1');
    return { root, gun, parts: P, sightY: 0.112, sightZ: -0.06 };
  }
  /** Webley Mk VI: a long top-break revolver. */
  function webley(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.blued, 0, 0.042, -0.02, 0.03, 0.05, 0.1);                          // frame
    k.CZ(gun, m.blued, 0, 0.026, -0.03, 0.024, 0.055);                            // cylinder
    k.CZ(gun, m.blued, 0, 0.062, -0.17, 0.011, 0.22);                             // barrel
    k.B(gun, m.blued, 0, 0.072, -0.17, 0.012, 0.01, 0.22);                        // top rib
    k.B(gun, m.blued, 0, 0.083, -0.275, 0.004, 0.012, 0.01);                      // front blade
    for (const sx of [-0.006, 0.006]) k.B(gun, m.blued, sx, 0.083, 0.035, 0.005, 0.012, 0.008); // rear notch
    k.B(gun, m.blued, 0, 0.07, 0.04, 0.008, 0.02, 0.014, -0.5, 0, 0);            // hammer
    k.B(gun, m.walnutDark, 0, -0.035, 0.05, 0.032, 0.1, 0.045, -0.45, 0, 0);      // bird's-head grip
    k.B(gun, m.blued, 0, 0.004, -0.005, 0.005, 0.022, 0.03);
    P.mag = new THREE.Group(); gun.add(P.mag); P.mag.visible = false;
    P.muzzle = k.node(gun, 0, 0.062, -0.285);
    P.eject = k.node(gun, 0, 0.04, -0.03);
    if (hands) pistolArms(gun, P, 0.05, 'ww1');
    return { root, gun, parts: P, sightY: 0.086, sightZ: 0.03 };
  }
  /** SMLE with a discharger cup and a rodded Mills bomb sitting in it. */
  function rifleGrenade(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    smleBody(gun, k, m);
    k.B(gun, m.blued, 0, -0.04, -0.06, 0.03, 0.06, 0.08);
    k.CZ(gun, m.blued, 0, 0.045, -0.7, 0.03, 0.08, true);                         // the cup
    P.mag = new THREE.Group(); P.mag.position.set(0, 0.045, -0.74); gun.add(P.mag);
    k.part(P.mag, k.sph(), m.od, 0, 0, 0, 0.026, 0.026, 0.034);
    for (let i = 0; i < 4; i++) k.B(P.mag, m.od, 0, 0, 0, 0.056, 0.004, 0.06, 0, 0, i * Math.PI / 4);
    P.muzzle = k.node(gun, 0, 0.045, -0.78);
    P.eject = k.node(gun, 0.03, 0.05, -0.02);
    if (hands) arms(gun, P, -0.04, 0.05, -0.01, -0.36, 'ww1');
    return { root, gun, parts: P, sightY: 0.086, sightZ: -0.12 };
  }
  /** Lewis gun: the fat cooling shroud, the pan on top, sights raised over it. */
  function lewis(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.blued, 0, 0.03, -0.05, 0.06, 0.08, 0.3);                           // receiver
    k.CZ(gun, m.blued, 0, 0.045, -0.48, 0.04, 0.56);                               // cooling shroud
    for (let i = 0; i < 4; i++) k.CZ(gun, m.park, 0, 0.045, -0.24 - i * 0.14, 0.042, 0.01);
    k.CZ(gun, m.blued, 0, 0.045, -0.79, 0.028, 0.06, true);                        // muzzle cone
    k.CZ(gun, m.blued, 0, 0.045, -0.83, 0.012, 0.04);
    P.mag = new THREE.Group(); P.mag.position.set(0, 0.105, -0.08); gun.add(P.mag); // the pan
    const pan = k.part(P.mag, k.cyl(), m.park, 0, 0, 0, 0.1, 0.03, 0.1); pan.rotation.set(0, 0, 0);
    k.part(P.mag, k.cyl(), m.blued, 0, 0.018, 0, 0.03, 0.01, 0.03);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.B(P.mag, m.blued, Math.cos(a) * 0.07, 0.016, Math.sin(a) * 0.07, 0.03, 0.004, 0.006, 0, -a, 0); }
    k.B(gun, m.blued, 0, 0.11, 0.08, 0.012, 0.07, 0.012);                          // rear sight post…
    for (const sx of [-0.007, 0.007]) k.B(gun, m.blued, sx, 0.15, 0.08, 0.005, 0.02, 0.008); // …and notch, above the pan
    k.B(gun, m.blued, 0, 0.11, -0.72, 0.006, 0.08, 0.006);                         // front post on a stalk
    k.B(gun, m.walnut, 0, -0.06, 0.04, 0.036, 0.1, 0.048, -0.3, 0, 0);
    k.B(gun, m.walnut, 0, 0.02, 0.18, 0.046, 0.085, 0.2);
    k.B(gun, m.park, 0, 0.01, 0.285, 0.05, 0.11, 0.02);
    for (const sx of [-1, 1]) k.B(gun, m.blued, sx * 0.012, -0.01, -0.62, 0.006, 0.012, 0.2, 0.1, 0, sx * 0.15);
    P.bolt = k.B(gun, m.steel, 0.035, 0.03, 0.06, 0.016, 0.012, 0.03);
    P.muzzle = k.node(gun, 0, 0.045, -0.86);
    P.eject = k.node(gun, 0.04, 0.03, -0.06);
    if (hands) arms(gun, P, -0.05, 0.055, -0.02, -0.3, 'ww1');
    return { root, gun, parts: P, sightY: 0.152, sightZ: 0.08 };
  }
  /** A slab of gun-cotton in a canvas bag, and the exploder in the other hand. */
  function guncotton(hands) {
    const k = K(), m = mats(), root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const P = {};
    k.B(gun, m.walnutDark, 0, 0, 0, 0.05, 0.04, 0.08);
    k.B(gun, m.brass, 0, 0.03, 0, 0.016, 0.02, 0.016);
    P.charge = new THREE.Group(); P.charge.position.set(-0.16, 0.0, -0.08); gun.add(P.charge);
    k.B(P.charge, m.khaki, 0, 0, 0, 0.13, 0.07, 0.09);
    k.B(P.charge, m.walnutDark, 0, 0.038, 0, 0.13, 0.006, 0.02);
    k.CZ(P.charge, m.rubber, 0.05, 0.04, 0.02, 0.004, 0.06);
    P.mag = P.charge;
    P.muzzle = k.node(gun, -0.16, 0.02, -0.15);
    P.eject = k.node(gun, 0, 0, 0);
    if (hands) {
      P.handR = bareHand(1); P.handR.position.set(0.004, -0.035, 0.0); P.handR.rotation.set(0.25, 0, -0.15); gun.add(P.handR);
      sleeve(gun, 0.02, -0.07, 0.05, 0.16, -0.32, 0.46, 'ww1');
      P.handL = new THREE.Group(); P.charge.add(P.handL); P.handL.position.set(0.0, -0.05, 0.02);
      const hl = bareHand(-1); hl.rotation.set(0.1, 0, 0.3); P.handL.add(hl);
      sleeve(P.handL, -0.02, -0.03, 0.02, -0.12, -0.3, 0.32, 'ww1');
      P.handLHome = P.handL.position.clone();
    }
    return { root, gun, parts: P, sightY: 0.08, sightZ: 0 };
  }

  ER.ww1 = {
    label: 'The Western Front, 1918',
    weapons: {
      carbine: { name: 'Lee-Enfield SMLE', short: 'SMLE', auto: false, bolt: true, rpm: 50, dmg: 95, head: 2.2, mag: 10, reserve: 70, maxReserve: 120, reload: 2.6, reloadEmpty: 3.0,
        spreadHip: 2.2, spreadAds: 0.06, spreadMove: 1.8, bloom: 0, bloomMax: 0, falloff: [400, 500, 1], recoil: [3.2, 0.5, 0.08, 0.18], adsFov: 0.78, adsZ: -0.26,
        hip: [0.13, -0.13, -0.3], sound: 'enfield', tracerEvery: 99, shell: 1.1, noise: 55, knock: 3 },
      shotgun: { name: 'Winchester 1897 trench gun', short: 'M97', auto: true, rpm: 95, mag: 5, reserve: 30, maxReserve: 45, dmg: 15, pellets: 9, sound: 'shotgun', tracerEvery: 99 },
      rail: { name: 'P14 sniper rifle', short: 'P14', coil: false, bolt: true, rpm: 40, dmg: 140, head: 2.5, pierce: 1, hitPad: 0.05, mag: 5, reserve: 25, maxReserve: 40,
        reload: 2.8, reloadEmpty: 3.2, zoom: [0.34, 0.22], adsFov: 0.34, recoil: [3.4, 0.5, 0.09, 0.2], sound: 'enfield', tracerEvery: 99, noise: 60, knock: 4 },
      pistol: { name: 'Webley Mk VI', short: 'WEBLEY', mag: 6, dmg: 48, rpm: 150, reload: 2.2, reloadEmpty: 2.2, recoil: [2.6, 0.6, 0.08, 0.2], sound: 'revolver', shell: 0 },
      rocket: { name: 'Rifle grenade', short: 'R.GREN', rocket: { speed: 30, radius: 5.5, damage: 180, impact: 35, drop: 10, size: 0.6 }, mag: 1, reserve: 8, maxReserve: 12,
        reload: 2.0, reloadEmpty: 2.0, recoil: [3.6, 0.6, 0.1, 0.26], adsFov: 0.86, ads: null, hip: [0.13, -0.14, -0.3], adsZ: -0.3, sound: 'thump', noise: 45 },
      minigun: { name: 'Lewis gun', short: 'LEWIS', rpm: 550, dmg: 28, head: 1.7, spin: 0, mag: 47, reserve: 141, maxReserve: 282, reload: 3.4, reloadEmpty: 3.8, spreadHip: 3.0, spreadAds: 0.6, spreadMove: 2.2,
        bloom: 0.16, bloomMax: 2.2, recoil: [0.7, 0.36, 0.03, 0.045], adsFov: 0.8, ads: null, hip: [0.16, -0.17, -0.36], adsZ: -0.3, sound: 'lewis', tracerEvery: 5, moveMul: 0.85, noise: 58 },
      satchel: { name: 'Gun-cotton charge', short: 'CHARGE' }
    },
    vm: { carbine: smle, shotgun: trenchGun, rail: p14, pistol: webley, rocket: rifleGrenade, minigun: lewis, satchel: guncotton }
  };

  /** Build an era's first-person model (cast no shadows, never culled, like the stock ones). */
  ER.model = function (era, id) {
    mats();
    const r = ER[era].vm[id](true);
    r.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
    return r;
  };
})(window.CF);
