'use strict';
/* Cinderfall — Halden Deep Station, Antarctica (Whiteout campaign). X east, Z south, Y up.
   South: landing zone and supply camp. Centre: the station and comms mast. East: the crevasse field.
   North-east: drill Rig 4. North-west: the Hollow, a collapse crater full of crystal, sunk 5.5 m. */
(function (CF) {
  const L = CF.Level, W = CF.World;
  const PI = Math.PI;
  const MH = CF.MapHalden = {};
  const PIT_Y = -5.5;
  const HOLES = [
    // crevasses (bridges are the gaps between the pieces)
    [45.2, 8, 60, 11], [63, 8, 78, 11],
    [45.2, -12, 71, -9], [75, -12, 78, -9],
    [45.2, -32, 50, -29], [53, -32, 78, -29],
    // the Hollow and its ramp
    [-58, -76, -20, -44], [-20, -63, -8, -57]
  ];

  // ---------------------------------------------------------------- helpers
  const K = () => CF.Map.kit;
  /** Walls that bound the play area get an invisible, bullet-transparent cap so their tops can't be walked on. */
  const noStand = (x0, y, z0, x1, z1) => W.add(x0, y, z0, x1, y + 40, z1, { shoot: false, nav: false });
  function snowCap(x0, y, z0, x1, z1, t) { L.box(x0 - 0.05, y, z0 - 0.05, x1 + 0.05, y + (t || 0.18), z1 + 0.05, 'snow', { ao: false, surf: 'snow', nav: false }); }
  function drift(x, z, sx, sz, h) {
    h = h || 0.5;
    L.addGeo('snow', L.geo('sphere'), L.mat4(x, 0, z, 0, 0, 0, sx, h, sz));
    if (sx < 0.5 || sz < 0.5) return;
    for (const [k, y] of [[0.86, 0.5], [0.6, 0.8]]) W.add(x - sx * k, 0, z - sz * k, x + sx * k, h * y, z + sz * k, { surf: 'snow', shoot: false });
  }
  function rock(x, z, s, h, ry) {
    L.addGeo('basalt', new THREE.IcosahedronGeometry(1, 0), L.mat4(x, h * 0.35, z, 0.2, ry || 0, 0.1, s, h, s * 0.8));
    L.addGeo('snow', new THREE.IcosahedronGeometry(1, 0), L.mat4(x, h * 0.35 + h * 0.55, z, 0.2, ry || 0, 0.1, s * 0.75, h * 0.3, s * 0.6));
    W.addCyl(x, z, s * 0.95, 0, h * 1.1, { surf: 'concrete' }); W.add(x - s, h * 1.1, z - s, x + s, h * 1.1 + 6, z + s, { shoot: false, nav: false });
    L.blob(x, z, s * 2.6, s * 2.2);
  }
  /** A pressure-ridge slab of blue ice tilted out of the floe. Collision is the upright bounding box. */
  function iceSlab(x, z, w, h, d, ry, tilt) {
    L.addGeo('ice', L.geo('box'), L.mat4(x, h * 0.42, z, tilt || 0.25, ry, 0, w, h, d));
    const ax = Math.cos(ry), az = -Math.sin(ry), n = Math.max(2, Math.ceil(w / 0.8)), lean = Math.sin(tilt || 0.25) * h * 0.42;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5, px = x + ax * t * w, pz = z + az * t * w;
      // the slab leans (rotation about its long axis): its top sits off to one side of its foot
      W.addCyl(px - az * lean * 0.5, pz + ax * lean * 0.5, d / 2 + lean * 0.5 + 0.1, 0, h * 0.84, { surf: 'ice' });
    }
    W.add(x - w / 2, h * 0.84, z - w / 2, x + w / 2, h * 0.84 + 6, z + w / 2, { shoot: false, nav: false });
    drift(x + 0.6, z + 0.6, w * 0.5, d + 1, 0.35);
  }
  function flag(x, z) {
    L.box(x - 0.03, 0, z - 0.03, x + 0.03, 1.7, z + 0.03, 'wood', { noCol: true, ao: false });
    L.box(x + 0.03, 1.35, z - 0.01, x + 0.4, 1.62, z + 0.01, 'panelOrange', { noCol: true, ao: false });
  }
  const floods = [];
  function floodlight(x, z, dx, dz, o) {
    o = o || {};
    L.box(x - 0.4, 0, z - 0.4, x + 0.4, 0.4, z + 0.4, 'panelDark');
    for (const s of [-1, 1]) L.pipe('steel', x + s * 0.25, 0.4, z, x, 7.4, z, 0.05);
    L.box(x - 0.12, 0.4, z - 0.12, x + 0.12, 7.6, z + 0.12, 'steel', { noMesh: true });
    const hx = x + dx * 0.4, hz = z + dz * 0.4;
    L.box(hx - 0.55, 7.2, hz - 0.3, hx + 0.55, 7.75, hz + 0.3, 'panelDark', { noCol: true });
    L.box(hx - 0.45, 7.25, hz - 0.31 * (dz || 1), hx + 0.45, 7.7, hz + 0.31 * (dz || 1), 'lampWarm', { noCol: true, ao: false });
    const lamp = L.lamp(hx + dx * 1.4, 7.0, hz + dz * 1.4, { color: o.color || 0xffb36a, intensity: o.intensity || 2.8, distance: o.distance || 26, poolStrength: 0.36, poolSize: 20, cone: 4.5, flicker: o.flicker, prio: 0.2 });
    floods.push(lamp);
    return lamp;
  }
  /** Weatherhaven shelter: a half-cylinder tent along X. */
  function tent(cx, cz, len, r, mat) {
    const g = new THREE.CylinderGeometry(r, r, len, 18, 1, true, 0, PI); g.rotateZ(PI / 2);
    L.addGeo(mat || 'panelOrange', g, L.mat4(cx, 0, cz, 0, 0, 0, 1, 1, 1));
    const cap = new THREE.CircleGeometry(r, 18, 0, PI); cap.rotateZ(0);
    for (const s of [-1, 1]) { const m = L.mat4(cx + s * len / 2, 0, cz, 0, s > 0 ? PI / 2 : -PI / 2, 0, 1, 1, 1); L.addGeo('panelWhite', cap, m); }
    L.box(cx + len / 2 - 0.02, 0, cz - 0.6, cx + len / 2 + 0.04, 1.9, cz + 0.6, 'panelDark', { noCol: true });
    // the shelter's round cross-section: a solid skirt, bullet-only tiers above it, and a cap so its roof isn't a perch
    W.add(cx - len / 2, 0, cz - r * 0.99, cx + len / 2, r * 0.45, cz + r * 0.99, { surf: 'concrete', nav: false });
    for (const [y0, y1, w] of [[0.45, 0.75, 0.9], [0.75, 1.0, 0.66]]) W.add(cx - len / 2, r * y0, cz - r * w, cx + len / 2, r * y1, cz + r * w, { surf: 'concrete', nav: false, solid: false });
    noStand(cx - len / 2, r * 0.45, cz - r * 0.99, cx + len / 2, cz + r * 0.99);
    snowCap(cx - len / 2, r - 0.1, cz - r * 0.35, cx + len / 2, cz + r * 0.35, 0.12);
    L.blob(cx, cz, len + 1.5, r * 2.6);
  }
  function drums(x, z, nx, nz, mat) {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) L.cyl(mat || 'paintRed', x + i * 0.62, 0.45, z + j * 0.62, 0.29, 0.9);
    W.add(x - 0.32, 0, z - 0.32, x + (nx - 1) * 0.62 + 0.32, 0.9, z + (nz - 1) * 0.62 + 0.32, { surf: 'metal' });
    snowCap(x - 0.3, 0.9, z - 0.3, x + (nx - 1) * 0.62 + 0.3, z + (nz - 1) * 0.62 + 0.3, 0.06);
    L.blob(x + (nx - 1) * 0.31, z + (nz - 1) * 0.31, nx * 0.62 + 1, nz * 0.62 + 1);
  }
  function sled(x, z, alongX, crates) {
    const lx = alongX ? 4.4 : 1.9, lz = alongX ? 1.9 : 4.4;
    L.box(x - lx / 2, 0.15, z - lz / 2, x + lx / 2, 0.45, z + lz / 2, 'wood');
    for (const s of [-1, 1]) L.box(alongX ? x - lx / 2 - 0.3 : x + s * 0.8 - 0.06, 0, alongX ? z + s * 0.8 - 0.06 : z - lz / 2 - 0.3, alongX ? x + lx / 2 : x + s * 0.8 + 0.06, 0.15, alongX ? z + s * 0.8 + 0.06 : z + lz / 2, 'steel', { noCol: true });
    for (let i = 0; i < (crates || 2); i++) {
      const o = (i - ((crates || 2) - 1) / 2) * 1.3;
      K().crate(alongX ? x + o : x, 0.45, alongX ? z : z + o, 1.15);
      snowCap(alongX ? x + o - 0.58 : x - 0.58, 1.6, alongX ? z - 0.58 : z + o - 0.58, alongX ? x + o + 0.58 : x + 0.58, alongX ? z + 0.58 : z + o + 0.58, 0.07);
    }
  }
  /** Crystal growth breaking through the snow, with its own cold light. */
  function crystals(x, y, z, s, o) {
    o = o || {};
    const rnd = CF.U.mulberry32(Math.round(x * 13 + z * 7) + 3);
    const n = o.n || 7;
    for (let i = 0; i < n; i++) {
      const a = rnd() * PI * 2, r = rnd() * s * 0.6, h = s * (0.6 + rnd() * 1.4), w = s * (0.12 + rnd() * 0.12);
      L.addGeo(i % 3 ? 'crystal' : 'iceDark', new THREE.OctahedronGeometry(1, 0), L.mat4(x + Math.cos(a) * r, y + h * 0.35, z + Math.sin(a) * r, Math.sin(a) * 0.5 * rnd(), a, Math.cos(a) * 0.5 * rnd(), w, h, w));
    }
    if (!o.noCol) { W.addCyl(x, z, s * 0.95, y, y + s * 1.2, { surf: 'ice' }); W.add(x - s * 0.8, y + s * 1.2, z - s * 0.8, x + s * 0.8, y + s * 2.6, z + s * 0.8, { shoot: false, nav: false }); }
    if (o.light !== false) L.lamp(x, y + s * 0.8, z, { color: 0x6fd6ff, intensity: o.intensity || 1.3, distance: o.distance || 9, poolStrength: 0.5, poolSize: s * 4, prio: 0.1, pulse: o.pulse || 0 });
    if (o.mist) L.emitters.push({ type: 'mist', x, y: y + 0.3, z, rate: 2 });
  }
  /** Station module on a snow-packed plinth. door: side 'e'|'w'|'n'|'s' with gap g0..g1 along that wall. */
  function module(x0, z0, x1, z1, fy, h, side, g0, g1, mat, o) {
    o = o || {};
    const t = 0.3, top = fy + h, dh = 2.3;
    // the packed-snow plinth stops under the floor plate: sharing the plate's top plane made the floor z-fight
    L.box(x0 + 0.5, 0, z0 + 0.5, x1 - 0.5, fy - 0.3, z1 - 0.5, 'snowDirty');
    L.box(x0, fy - 0.3, z0, x1, fy, z1, 'panelDark', { top: 'grate', surf: 'metal', skip: [3] });
    for (const sx of [x0 + 0.35, (x0 + x1) / 2, x1 - 0.35]) for (const sz of [z0 + 0.35, z1 - 0.35]) L.box(sx - 0.14, 0, sz - 0.14, sx + 0.14, fy - 0.3, sz + 0.14, 'steel', { noCol: true });
    const wall = (a0, a1, b0, b1) => L.box(a0, fy, b0, a1, top, b1, mat);
    const gapX = (zA, zB) => { wall(x0, g0, zA, zB); wall(g1, x1, zA, zB); L.box(g0, fy + dh, zA, g1, top, zB, mat); };
    const gapZ = (xA, xB) => { wall(xA, xB, z0 + t, g0); wall(xA, xB, g1, z1 - t); L.box(xA, fy + dh, g0, xB, top, g1, mat); };
    if (side === 'n') gapX(z0, z0 + t); else wall(x0, x1, z0, z0 + t);
    if (side === 's') gapX(z1 - t, z1); else wall(x0, x1, z1 - t, z1);
    if (side === 'w') gapZ(x0, x0 + t); else wall(x0, x0 + t, z0 + t, z1 - t);
    if (side === 'e') gapZ(x1 - t, x1); else wall(x1 - t, x1, z0 + t, z1 - t);
    L.box(x0 - 0.3, top, z0 - 0.3, x1 + 0.3, top + 0.35, z1 + 0.3, 'panelWhite', { nav: false });
    snowCap(x0 - 0.3, top + 0.35, z0 - 0.3, x1 + 0.3, z1 + 0.3, 0.25);
    L.box(x0 + 0.3, top - 0.12, z0 + 0.3, x1 - 0.3, top, z1 - 0.3, 'ceiling', { noCol: true });
    // window band (warm emergency lighting inside)
    const pane = { noCol: true, ao: false }, wy0 = fy + 1.2, wy1 = fy + 1.9;
    for (let x = x0 + 2; x < x1 - 1.5; x += 3.2) {
      if (side !== 'n') L.box(x, wy0, z0 - 0.04, x + 1.4, wy1, z0 + 0.01, 'windowWarm', pane);
      if (side !== 's') L.box(x, wy0, z1 - 0.01, x + 1.4, wy1, z1 + 0.04, 'windowWarm', pane);
    }
    if (o.lights !== false) {
      const n = Math.max(1, Math.round((x1 - x0) / 9));
      for (let i = 0; i < n; i++) {
        const lx = x0 + (i + 0.5) * (x1 - x0) / n, lz = (z0 + z1) / 2;
        L.box(lx - 0.7, top - 0.2, lz - 0.12, lx + 0.7, top - 0.12, lz + 0.12, 'lampWarm', { noCol: true, ao: false });
        L.lamp(lx, top - 0.35, lz, { color: 0xffc080, intensity: 1.3, distance: 9, poolSize: 7, poolStrength: 0.2, prio: 0.6, flicker: o.flicker && i === 0 ? 0.1 : 0 });
      }
    }
    L.blob((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 3, z1 - z0 + 3);
  }
  /** Ground-level hall (generator hall, vehicle bay). */
  function hall(x0, z0, x1, z1, h, side, g0, g1, mat, gapH) {
    const t = 0.4, dh = gapH || 3.4;
    const wall = (a0, a1, b0, b1) => L.box(a0, 0, b0, a1, h, b1, mat);
    const gapX = (zA, zB) => { wall(x0, g0, zA, zB); wall(g1, x1, zA, zB); L.box(g0, dh, zA, g1, h, zB, mat); };
    if (side === 's') gapX(z1 - t, z1); else wall(x0, x1, z1 - t, z1);
    wall(x0, x1, z0, z0 + t);
    wall(x0, x0 + t, z0 + t, z1 - t); wall(x1 - t, x1, z0 + t, z1 - t);
    L.box(x0 - 0.3, h, z0 - 0.3, x1 + 0.3, h + 0.4, z1 + 0.3, 'panelWhite', { nav: false });
    snowCap(x0 - 0.3, h + 0.4, z0 - 0.3, x1 + 0.3, z1 + 0.3, 0.3);
    L.box(x0 + t, 0, z0 + t, x1 - t, 0.06, z1 - t, 'grate', { ao: false, surf: 'metal' });
    L.blob((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 3, z1 - z0 + 3);
  }
  function tank(x, z, len, r, alongX, mat) {
    L.cyl(mat || 'panelWhite', x, r + 0.5, z, r, len, alongX ? 0 : PI / 2, alongX ? PI / 2 : 0);
    for (const o of [-len / 2 + 0.6, len / 2 - 0.6]) L.box(alongX ? x + o - 0.2 : x - r, 0, alongX ? z - r : z + o - 0.2, alongX ? x + o + 0.2 : x + r, r + 0.3, alongX ? z + r : z + o + 0.2, 'paintDark', { noCol: true });
    W.add(alongX ? x - len / 2 : x - r, 0, alongX ? z - r : z - len / 2, alongX ? x + len / 2 : x + r, r * 2 + 0.5, alongX ? z + r : z + len / 2, { surf: 'metal' });
    snowCap(alongX ? x - len / 2 : x - r * 0.5, r * 2 + 0.45, alongX ? z - r * 0.5 : z - len / 2, alongX ? x + len / 2 : x + r * 0.5, alongX ? z + r * 0.5 : z + len / 2, 0.1);
    L.blob(x, z, alongX ? len + 1.5 : r * 3, alongX ? r * 3 : len + 1.5);
  }
  /** Four-legged lattice tower (comms mast, derrick). */
  function lattice(cx, cz, y0, h, w0, w1, mat, braces) {
    const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of legs) L.pipe(mat, cx + sx * w0, y0, cz + sz * w0, cx + sx * w1, y0 + h, cz + sz * w1, 0.09);
    const n = braces || 8;
    for (let i = 0; i < n; i++) {
      const ya = y0 + h * i / n, yb = y0 + h * (i + 1) / n, wa = w0 + (w1 - w0) * i / n, wb = w0 + (w1 - w0) * (i + 1) / n;
      for (let k = 0; k < 4; k++) {
        const a = legs[k], b = legs[(k + 1) % 4];
        L.pipe(mat, cx + a[0] * wa, ya, cz + a[1] * wa, cx + b[0] * wb, yb, cz + b[1] * wb, 0.04);
        L.pipe(mat, cx + a[0] * wb, yb, cz + a[1] * wb, cx + b[0] * wb, yb, cz + b[1] * wb, 0.035);
      }
    }
    W.add(cx - w0, y0, cz - w0, cx + w0, y0 + Math.min(h, 6), cz + w0, { surf: 'metal', shoot: false });
  }
  function ammoBox(id, x, y, z, face) { return K().ammoCache ? K().ammoCache(id, x, y, z, face) : null; }

  // ---------------------------------------------------------------- Skua: the tilt-rotor that drops you off and comes back
  function buildSkua() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: 0.45, roughness: 0.4 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0xd4471c, metalness: 0.3, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23282f, metalness: 0.6, roughness: 0.45 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x12202c, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.5 });
    const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 2.6) });
    const nav = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.4, 0.3) });
    const blade = new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.25, depthWrite: false });
    const mk = (geo, m, x, y, z, sx, sy, sz, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; g.add(o); return o; };
    const bx = new THREE.BoxGeometry(1, 1, 1), cy = new THREE.CylinderGeometry(1, 1, 1, 16), sp = new THREE.SphereGeometry(1, 16, 12);
    mk(bx, hull, 0, 1.9, 0, 2.6, 2.2, 9); mk(sp, hull, 0, 1.9, -4.4, 1.3, 1.1, 1.6); mk(sp, glass, 0, 2.35, -4.9, 1.05, 0.62, 1.05);
    mk(bx, stripe, 0, 1.35, 0, 2.62, 0.3, 8.6); mk(bx, hull, 0, 2.6, 5.2, 1.2, 1.2, 3); mk(bx, stripe, 0, 3.9, 6.2, 0.2, 2.4, 1.6);
    mk(bx, hull, 0, 3.2, 6.4, 4.6, 0.18, 1.2); mk(bx, hull, 0, 3.15, -0.6, 13, 0.3, 1.8);
    g.userData.rotors = [];
    for (const s of [-1, 1]) {
      const nac = new THREE.Group(); nac.position.set(s * 6.6, 3.2, -0.6); g.add(nac);
      const n1 = new THREE.Mesh(cy, dark); n1.scale.set(0.55, 3.2, 0.55); nac.add(n1);
      const rotor = new THREE.Group(); rotor.position.y = 1.8; nac.add(rotor);
      const disc = new THREE.Mesh(cy, blade); disc.scale.set(4.3, 0.02, 4.3); rotor.add(disc);
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(bx, dark); b.scale.set(4.2, 0.05, 0.28); b.rotation.y = i * PI * 2 / 3; b.position.set(Math.cos(i * PI * 2 / 3) * 2.1, 0, -Math.sin(i * PI * 2 / 3) * 2.1); rotor.add(b); }
      const nl = new THREE.Mesh(sp, s < 0 ? nav : new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 5, 0.8) })); nl.scale.setScalar(0.14); nl.position.set(s * 0.6, 0, 0); nac.add(nl);
      g.userData.rotors.push(rotor);
    }
    for (const s of [-1, 1]) { mk(bx, dark, s * 1.3, 0.35, -2.6, 0.2, 0.7, 0.2); mk(bx, dark, s * 1.3, 0.35, 2.4, 0.2, 0.7, 0.2); mk(cy, dark, s * 1.3, 0.15, 0, 0.18, 7, 0.18, PI / 2, 0, 0); }
    g.userData.lamp = mk(bx, lamp, 0, 0.85, -4.6, 0.8, 0.12, 0.3);
    g.userData.beacon = mk(sp, nav, 0, 3.1, 1, 0.16, 0.16, 0.16);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    return g;
  }
  MH.skua = null;
  MH.dispose = function () { if (MH.skua && MH.skua.loop) MH.skua.loop.stop(); MH.skua = null; };
  /** Skua state machine: 'parked' → 'leave' → 'gone' … 'arrive' → 'landed'. */
  MH.skuaSet = function (state) {
    const s = MH.skua; if (!s) return;
    s.state = state; s.t = 0;
    s.root.visible = state !== 'gone';
    if (state === 'parked' || state === 'landed') { s.root.position.copy(s.home); s.root.rotation.set(0, s.yaw, 0); }
    if (state === 'arrive') { s.root.visible = true; s.root.position.set(s.home.x + 60, 42, s.home.z + 90); }
    if (s.loop) { s.loop.stop(); s.loop = null; }
    if (state !== 'gone' && CF.Audio.ready) { s.loop = CF.Audio.loop('rotor', s.root.position); if (s.loop) s.loop.set(state === 'parked' || state === 'landed' ? 0.12 : 0.3, 0.6); }
  };
  MH.updateSkua = function (dt) {
    const s = MH.skua; if (!s || !s.root.visible) return;
    const r = s.root, U = CF.U;
    s.t += dt;
    for (const ro of r.userData.rotors) ro.rotation.y += dt * (s.state === 'parked' || s.state === 'landed' ? 18 : 30);
    r.userData.beacon.visible = (CF.time % 1.2) < 0.2;
    if (s.state === 'leave') {
      const k = s.t;
      r.position.y = s.home.y + Math.min(1, k / 3) * 6 + Math.max(0, k - 3) * Math.max(0, k - 3) * 1.5;
      r.position.z = s.home.z - Math.max(0, k - 2.5) * Math.max(0, k - 2.5) * 3;
      r.rotation.x = -Math.min(0.25, Math.max(0, k - 2.5) * 0.1);
      if (k > 16) MH.skuaSet('gone');
    } else if (s.state === 'arrive') {
      const k = U.clamp(s.t / 9, 0, 1), e = U.easeInOut(k);
      r.position.set(U.lerp(s.home.x + 60, s.home.x, e), U.lerp(42, s.home.y, U.easeOutCubic(k)), U.lerp(s.home.z + 90, s.home.z, e));
      r.rotation.set(-0.15 * (1 - k), s.yaw + (1 - e) * 0.6, 0);
      if (k >= 1) MH.skuaSet('landed');
    }
    if (s.loop && s.loop.out) { /* positional loop follows the aircraft */ const p = s.loop.panner; if (p && p.positionX) { p.positionX.value = r.position.x; p.positionY.value = r.position.y; p.positionZ.value = r.position.z; } }
  };

  // ---------------------------------------------------------------- build
  MH.build = function () {
    const M = L.mats, kit = K();
    floods.length = 0;
    L.killY = -9;
    // ground: snow in the west and centre, sea ice east of the fence, with the crevasses and the Hollow cut out
    const B = { minX: -84, maxX: 84, minZ: -82, maxZ: 80 };
    const xs = [B.minX, B.maxX, 44], zs = [B.minZ, B.maxZ];
    for (const h of HOLES) { xs.push(h[0], h[2]); zs.push(h[1], h[3]); }
    const ux = [...new Set(xs)].sort((a, b) => a - b), uz = [...new Set(zs)].sort((a, b) => a - b);
    const inHole = (x, z) => HOLES.some((h) => x > h[0] && x < h[2] && z > h[1] && z < h[3]);
    for (let j = 0; j < uz.length - 1; j++) {
      let run = null;
      for (let i = 0; i < ux.length - 1; i++) {
        const cx = (ux[i] + ux[i + 1]) / 2, cz = (uz[j] + uz[j + 1]) / 2, mat = cx > 44 ? 'ice' : 'snow';
        const solid = !inHole(cx, cz);
        if (solid && run && run.mat === mat) { run.x1 = ux[i + 1]; continue; }
        if (run) L.box(run.x0, -2, uz[j], run.x1, 0, uz[j + 1], run.mat, { ao: false, surf: run.mat === 'ice' ? 'ice' : 'snow' });
        run = solid ? { x0: ux[i], x1: ux[i + 1], mat } : null;
      }
      if (run) L.box(run.x0, -2, uz[j], run.x1, 0, uz[j + 1], run.mat, { ao: false, surf: run.mat === 'ice' ? 'ice' : 'snow' });
    }
    // crevasse walls: blue ice falling away into the dark
    for (const h of HOLES.slice(0, 6)) {
      const [x0, z0, x1, z1] = h;
      L.box(x0, -16, z0, x1, 0, z0 + 0.2, 'iceDark', { noCol: true, ao: false });
      L.box(x0, -16, z1 - 0.2, x1, 0, z1, 'iceDark', { noCol: true, ao: false });
      L.box(x0, -16, z0, x0 + 0.2, 0, z1, 'iceDark', { noCol: true, ao: false });
      L.box(x1 - 0.2, -16, z0, x1, 0, z1, 'iceDark', { noCol: true, ao: false });
      L.box(x0, -16.5, z0, x1, -16, z1, 'iceDark', { noCol: true, ao: false });
      L.box(x0 - 0.3, 0, z0 - 0.35, x1 + 0.3, 0.05, z0, 'snow', { noCol: true, ao: false });
      L.box(x0 - 0.3, 0, z1, x1 + 0.3, 0.05, z1 + 0.35, 'snow', { noCol: true, ao: false });
      for (let x = x0 + 3; x < x1 - 1; x += 7) { flag(x, z0 - 0.8); flag(x + 3, z1 + 0.8); }
    }
    // rope bridges' rails across the crevasse gaps
    for (const b of [[60, 63, 8, 11], [71, 75, -12, -9], [50, 53, -32, -29]]) {
      for (const x of [b[0] + 0.1, b[1] - 0.1]) { L.box(x - 0.05, 0, b[2] - 0.6, x + 0.05, 1.1, b[2] - 0.4, 'wood', { noCol: true }); L.box(x - 0.05, 0, b[3] + 0.4, x + 0.05, 1.1, b[3] + 0.6, 'wood', { noCol: true }); L.box(x - 0.02, 0.95, b[2] - 0.5, x + 0.02, 1.0, b[3] + 0.5, 'panelOrange', { noCol: true, ao: false }); }
    }
    // perimeter: ice cliffs with snow on top, broken by nunatak rock
    const rnd = CF.U.mulberry32(4041);
    const cliff = (x0, z0, x1, z1) => { const h = 9 + rnd() * 7; L.box(x0, 0, z0, x1, h, z1, 'ice'); snowCap(x0, h, z0, x1, z1, 0.5); noStand(x0 - 0.05, h + 0.5, z0 - 0.05, x1 + 0.05, z1 + 0.05); };
    for (let x = -84; x < 84; x += 8) { cliff(x, -82, x + 8, -78 - rnd() * 2); cliff(x, 76 + rnd() * 2, x + 8, 80); }
    for (let z = -82; z < 80; z += 8) { cliff(-84, z, -80 + rnd() * 1.5, z + 8); cliff(78 + rnd() * 1.5, z, 84, z + 8); }
    for (const r of [[-74, 30, 3, 5], [-72, 10, 4, 7], [-75, -16, 3, 6], [-70, -30, 2.4, 4], [74, 40, 3, 5], [-60, 70, 3.5, 5], [50, 70, 3, 4.5], [-76, 52, 3, 7]]) rock(r[0], r[1], r[2], r[3], rnd() * 6);

    // ================================================================ SOUTH: landing zone + supply camp
    L.box(-7, 0, 53, 7, 0.25, 67, 'grate', { surf: 'metal' });
    L.box(-7.1, 0.25, 52.9, 7.1, 0.28, 53.05, 'hazard', { noCol: true, ao: false }); L.box(-7.1, 0.25, 66.95, 7.1, 0.28, 67.1, 'hazard', { noCol: true, ao: false });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), M.pad); pad.rotation.x = -PI / 2; pad.position.set(0, 0.27, 60); L.scene.add(pad);
    for (const c of [[-6.6, 53.4], [6.6, 53.4], [-6.6, 66.6], [6.6, 66.6]]) { L.box(c[0] - 0.12, 0.25, c[1] - 0.12, c[0] + 0.12, 0.5, c[1] + 0.12, 'lampAmber', { noCol: true }); }
    L.lamp(0, 3, 60, { color: 0xffd09a, intensity: 1.2, distance: 16, poolSize: 14, poolStrength: 0.2, prio: 0.4 });
    tent(-20, 60, 9, 2.6); tent(-20, 50, 8, 2.4, 'panelWhite'); tent(22, 58, 9, 2.6);
    drums(-31, 64, 4, 2); drums(-31, 67, 3, 1, 'paintYellow'); drums(27, 66, 3, 2, 'paintYellow'); drums(14, 47, 2, 2);
    sled(12, 44, true, 3); sled(-11, 43, false, 2); sled(30, 44, false, 2);
    kit.container(34, 52, false, 'blue'); snowCap(32.8, 2.6, 49, 35.2, 55, 0.15);
    kit.container(-34, 50, false, 'red', 2); snowCap(-35.2, 5.2, 47, -32.8, 53, 0.15);
    floodlight(-12, 52, 1, 0); floodlight(14, 64, -1, 0); floodlight(0, 40, 0, 1); floodlight(-26, 42, 1, -1); floodlight(28, 38, -1, 0, { flicker: 0.12 });
    const heaterCamp = L.lamp(-20, 1.2, 56, { color: 0xff8a3a, intensity: 1.6, distance: 8, poolStrength: 0.6, poolSize: 6, flicker: 0.05 });
    L.box(-20.5, 0, 55.4, -19.5, 0.9, 56.2, 'paintDark'); L.box(-20.4, 0.7, 55.5, -19.6, 0.9, 56.1, 'lampHeat', { noCol: true, ao: false });
    L.emitters.push({ type: 'flame', x: -20, y: 0.95, z: 55.8, rate: 9 });
    CF.Frost.addHeat(-20, 0, 55.8, 5);
    for (let z = 20; z <= 52; z += 6) { flag(-4.5, z); flag(4.5, z); }
    L.box(-3.2, 0, 18, 3.2, 0.03, 53, 'snowDirty', { noCol: true, ao: false });
    for (const d of [[-40, 60, 5, 3], [40, 64, 4, 3], [-8, 72, 6, 2.5], [18, 72, 5, 2], [-44, 38, 4, 2.5], [44, 34, 4, 3]]) drift(d[0], d[1], d[2], d[3], 0.6);
    kit.ammoCache('cacheCamp', 8, 0, 50, 'z-');
    L.points.start = { x: 11, y: 0, z: 63, yaw: 0.25 };

    // ================================================================ CENTRE: Halden Deep Station
    // main module (west) — duty office with Dr. Varga's log
    module(-34, 4, -14, 16, 1.2, 3.4, 'e', 9, 11.6, 'panelOrange', { flicker: true });
    kit.stairs(-14, 9, -11, 11.6, 0, 1.2, 'x-', 'panelDark');
    for (let x = -32; x <= -24; x += 2.6) { L.box(x, 1.2, 4.35, x + 1.9, 1.75, 5.3, 'panelBlue'); L.box(x, 2.4, 4.35, x + 1.9, 2.5, 5.3, 'panelBlue', { noCol: true }); }
    L.box(-24, 1.2, 12, -18, 1.95, 13.4, 'counter'); for (const cx of [-23, -19]) L.box(cx - 0.4, 1.2, 10.4, cx + 0.4, 1.7, 11.2, 'panelDark');
    L.box(-33.7, 1.2, 9, -32.6, 2.2, 11.6, 'panelDark');
    const logScr = kit.screenMesh(M.scrLog, -32.55, 2.45, 10.3, 'x+', 1.2, 0.72);
    L.addInteract({ id: 'log', type: 'task', pos: [-31.5, 1.2, 10.3], face: [1, 0], radius: 2.0, hold: 1.4, prompt: 'Play the station log', screen: logScr, enabled: false });
    CF.Neon.sign('DUTY OFFICE', 'white', -14.1, 3.9, 10.3, 'x+', 0.45, { light: false });
    // science module (east) — fuse cell 1
    module(14, 2, 32, 14, 1.2, 3.4, 'w', 7, 9.6, 'panelOrange');
    kit.stairs(11, 7, 14, 9.6, 0, 1.2, 'x+', 'panelDark');
    L.box(18, 1.2, 2.4, 30, 2.1, 3.6, 'counter'); L.box(18, 1.2, 12.4, 26, 2.1, 13.6, 'counter');
    L.cyl('glassDay', 28.5, 2.2, 12.4, 0.45, 2); L.addGeo('crystal', new THREE.OctahedronGeometry(1, 0), L.mat4(28.5, 2.2, 12.4, 0.2, 0.4, 0, 0.18, 0.65, 0.18));
    L.lamp(28.5, 2.4, 12.4, { color: 0x6fd6ff, intensity: 0.9, distance: 5, pool: false, pulse: 1.3 });
    W.add(28, 1.2, 11.9, 29, 3.2, 12.9, { surf: 'metal' });
    // comms mast + control hut
    L.box(-3, 0, 4, 3, 3, 8, 'panelRed'); L.box(-3.3, 3, 3.7, 3.3, 3.3, 8.3, 'panelWhite', { nav: false }); snowCap(-3.3, 3.3, 3.7, 3.3, 8.3, 0.2);
    lattice(0, -2, 0, 30, 2.2, 0.5, 'paintRed', 10);
    for (let y = 6; y < 30; y += 6) L.box(-0.2, y, -2.2, 0.2, y + 0.6, -1.8, 'panelWhite', { noCol: true });
    const mastBeacon = new THREE.Mesh(L.geo('sphere'), M.lampRed.clone()); mastBeacon.scale.setScalar(0.35); mastBeacon.position.set(0, 30.6, -2); L.scene.add(mastBeacon);
    MH.mastBeacon = mastBeacon; mastBeacon.visible = false;
    L.animated.push((dt, t) => { if (MH.mastLive) mastBeacon.visible = (t % 1.4) < 0.45; });
    L.box(-1, 2.9, 7.95, 1, 3.2, 8.05, 'hazard', { noCol: true });
    const mastScr = kit.screenMesh(M.scrMast, 0, 1.45, 8.03, 'z+', 1.2, 0.72);
    L.addInteract({ id: 'mast', type: 'task', pos: [0, 0, 9.1], face: [0, 1], radius: 2.0, hold: 2.2, prompt: 'Insert the fuse cells', screen: mastScr, enabled: false });
    for (const g of [[-3, -4], [3, -4], [-3, 0], [3, 0]]) L.pipe('steel', g[0], 0, g[1], 0, 14, -2, 0.02);
    const hs = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.0), M.signHalden); hs.position.set(0, 2.55, 8.03); L.scene.add(hs);
    // generator hall (north-west) — fuse cell 2
    hall(-44, -26, -24, -10, 6.5, 's', -36, -31, 'panelBlue');
    for (const gx of [-41, -34.5]) { L.box(gx, 0, -23.5, gx + 4.2, 2.4, -19.5, 'paintYellow'); L.box(gx + 0.4, 2.4, -23, gx + 3.8, 3.1, -20, 'paintDark'); L.pipe('steel', gx + 3.4, 3.1, -21.5, gx + 3.4, 6.5, -21.5, 0.2); }
    L.box(-28, 0, -25.5, -24.6, 1.1, -22, 'paintGreen'); L.box(-43.5, 0, -14, -40, 1.8, -10.6, 'panelDark');
    for (const lx of [-38, -30]) { L.box(lx - 1.2, 6.2, -18.1, lx + 1.2, 6.3, -17.9, 'lampCool', { noCol: true, ao: false }); L.lamp(lx, 6, -18, { color: 0xcfe0ff, intensity: 1.4, distance: 13, poolSize: 10, poolStrength: 0.15, prio: 0.5, flicker: lx < -35 ? 0.15 : 0 }); }
    L.emitters.push({ type: 'smoke', x: -37.4, y: 6.6, z: -21.5, rate: 1.5 });
    CF.Neon.sign('GENERATOR', 'yellow', -33.5, 4.8, -9.55, 'z+', 0.6, { distance: 7 });
    // vehicle bay (north-east) — fuse cell 3, the station snowcat
    hall(16, -28, 38, -12, 6, 's', 22, 30, 'panelOrange', 4.4);
    buildSnowcat(33, -20, PI / 2);
    L.box(16.4, 0, -27.6, 21, 1.05, -25.6, 'counter'); L.box(16.4, 1.05, -27.6, 21, 3, -27.3, 'panelDark');
    for (const lx of [22, 32]) { L.box(lx - 1.2, 5.7, -20.1, lx + 1.2, 5.8, -19.9, 'lampCool', { noCol: true, ao: false }); L.lamp(lx, 5.5, -20, { color: 0xcfe0ff, intensity: 1.4, distance: 13, poolSize: 10, poolStrength: 0.15, prio: 0.5 }); }
    CF.Neon.sign('VEHICLE BAY', 'white', 26, 5.1, -11.55, 'z+', 0.5, { light: false });
    // fuse cells (pick up with E)
    MH.cells = [];
    const cell = (id, x, y, z) => {
      const g = new THREE.Group(); g.position.set(x, y, z);
      const body = new THREE.Mesh(L.geo('box'), M.panelDark); body.scale.set(0.34, 0.5, 0.34); body.position.y = 0.25; g.add(body);
      const glow = new THREE.Mesh(L.geo('box'), M.lampAmber); glow.scale.set(0.36, 0.08, 0.36); glow.position.y = 0.32; g.add(glow);
      L.scene.add(g);
      const lamp = L.lamp(x, y + 0.6, z, { color: 0xffa040, intensity: 0.9, distance: 4, pool: false, pulse: 3 });
      const it = L.addInteract({ id, type: 'task', pos: [x, y, z], face: null, radius: 1.8, hold: 0, prompt: 'Take the fuse cell', enabled: false, mesh: g, lamp });
      L.animated.push((dt, t) => { if (g.visible) g.rotation.y = t * 0.8; });
      MH.cells.push(it); return it;
    };
    cell('cell1', 20, 2.1, 3.0); cell('cell2', -26.3, 1.1, -23.8); cell('cell3', 18.6, 1.05, -26.6);
    // fuel farm, antenna field, weather station
    tank(-52, 22, 10, 1.7, true); tank(-52, 27, 10, 1.7, true); tank(-52, 32, 10, 1.7, true, 'panelOrange');
    L.pipe('steel', -46.8, 1.2, 22, -38, 1.2, 12, 0.18); K().pipeCol(-46.8, 1.2, 22, -38, 1.2, 12, 0.2);
    for (const a of [[-58, -2], [-52, 4], [-58, 10], [-50, -6]]) { L.pipe('steel', a[0], 0, a[1], a[0], 12, a[1], 0.07); L.box(a[0] - 0.25, 11.8, a[1] - 0.25, a[0] + 0.25, 12.1, a[1] + 0.25, 'lampRed', { noCol: true }); W.add(a[0] - 0.12, 0, a[1] - 0.12, a[0] + 0.12, 12, a[1] + 0.12, { shoot: false }); }
    L.pipe('steel', -8, 0, 28, -8, 5, 28, 0.06); W.add(-8.1, 0, 27.9, -7.9, 5, 28.1, { shoot: false });
    const anemo = new THREE.Group(); anemo.position.set(-8, 5.1, 28); L.scene.add(anemo);
    for (let i = 0; i < 3; i++) { const cup = new THREE.Mesh(L.geo('sphere'), M.panelWhite); cup.scale.setScalar(0.12); cup.position.set(Math.cos(i * 2.09) * 0.4, 0, Math.sin(i * 2.09) * 0.4); anemo.add(cup); }
    L.animated.push((dt) => { anemo.rotation.y += dt * (3 + CF.Frost.storm * 14 + CF.Frost.gust * 5); });
    // station floodlights, flags, drifts, cover
    floodlight(-8, 20, 1, -1); floodlight(10, 20, -1, -1); floodlight(-14, -6, 1, 0); floodlight(12, -6, -1, 0, { flicker: 0.2 }); floodlight(-48, 12, 1, 0); floodlight(40, -4, -1, 0);
    kit.container(-10, -14, true, 'white'); snowCap(-13.05, 2.6, -15.2, -6.95, -12.8, 0.15);
    kit.container(8, 26, false, 'orange'); snowCap(6.8, 2.6, 23, 9.2, 29, 0.15);
    sled(-20, 24, true, 2); sled(24, 22, true, 2); drums(-6, -8, 2, 3); drums(20, -6, 3, 2, 'paintYellow');
    kit.crate(-38, 0, -4); kit.crate(-36.8, 0, -4); kit.crate(-37.4, 1.2, -4, 1.0); kit.crate(36, 0, 18); kit.crate(34.8, 0, 18.6, 1.0);
    for (const d of [[-40, 16, 4, 2], [40, 12, 4, 2.5], [-14, 30, 5, 2], [16, 30, 4, 2], [-50, -18, 4, 3], [46, -30, 0.1, 0.1]]) drift(d[0], d[1], d[2], d[3], 0.55);
    kit.ammoCache('cacheStation', -12, 0, 1.5, 'x+');
    CF.Frost.addHeat(-10.5, 0, 10.3, 3.5); CF.Frost.addHeat(10.5, 0, 8.3, 3.5);
    // station perimeter: east fence (gate to the crevasse field) and the north ridge
    for (let z = -40; z < 26; z += 3) {
      if (z >= 17 && z < 24) continue;
      L.box(44.3, 0, z, 44.5, 3, z + 0.1, 'steel', { noCol: true });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), M.lattice); p.position.set(44.4, 1.5, z + 1.5); p.rotation.y = PI / 2; L.scene.add(p);
    }
    W.add(44.2, 0, -40, 44.6, 3.2, 17, { surf: 'metal', shoot: false }); W.add(44.2, 0, 24, 44.6, 3.2, 26, { surf: 'metal', shoot: false });
    L.box(44, 0, 26, 78, 5, 27.2, 'ice'); snowCap(44, 5, 26, 78, 27.2, 0.3); noStand(43.95, 5.3, 25.95, 78.05, 27.25);
    for (const z of [17, 24]) { L.box(43.9, 0, z - 0.3, 44.9, 3.8, z + 0.3, 'panelOrange'); L.box(43.8, 3.8, z - 0.4, 45, 4.1, z + 0.4, 'lampAmber', { noCol: true }); }
    CF.Neon.sign('STYX FIELD', 'orange', 44.1, 4.6, 20.5, 'x-', 0.6, { distance: 8 });
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), M.signCold); warn.position.set(44.0, 2, 15.4); warn.rotation.y = -PI / 2; L.scene.add(warn);
    // north ridge with the ice gate that gives way after the Heart dies
    for (let x = -80; x < 44; x += 6) {
      if (x + 6 > -2 && x < 4) { continue; }
      const h = 5 + rnd() * 2.5; L.box(x, 0, -42, Math.min(44, x + 6), h, -40, 'ice'); snowCap(x, h, -42, Math.min(44, x + 6), -40, 0.4); noStand(x - 0.05, h + 0.4, -42.05, Math.min(44, x + 6) + 0.05, -39.95);
    }
    L.box(-8, 0, -42, -2, 5.6, -40, 'ice'); snowCap(-8, 5.6, -42, -2, -40, 0.4); L.box(4, 0, -42, 8, 5.9, -40, 'ice'); snowCap(4, 5.9, -42, 8, -40, 0.4);
    noStand(-8.05, 6, -42.05, -1.95, -39.95); noStand(3.95, 6.3, -42.05, 8.05, -39.95); noStand(-2, 5.4, -42.05, 4, -39.95);
    L.addDoor('northGate', -2, 0, -41.8, 4, 5.4, -40.2, 'ice', { lift: -6 });
    L.doors.northGate.mesh.material = L.mats.ice.clone(); L.doors.northGate.mesh.material.vertexColors = false;

    // ================================================================ EAST: Styx crevasse field
    for (const s of [[52, 2, 5, 3.4, 1.2, 0.4], [68, 16, 4, 3, 1, -0.6], [58, -4, 4.5, 2.6, 1, 0.9], [74, 2, 3, 3, 1, 0.2], [64, -18, 5, 3.2, 1.2, -0.3], [50, -20, 3.5, 2.8, 1, 1.2],
      [72, -24, 4, 3, 1, 0.5], [60, -36, 4, 2.6, 1, -0.9], [70, -38, 3, 3.4, 1, 0.3], [52, 22, 3, 2.4, 1, 0.8], [76, -16, 3, 2.6, 1, -0.2]]) iceSlab(s[0], s[1], s[2], s[3], s[4], s[5], 0.2 + (s[0] % 3) * 0.05);
    // the pipeline, raised on trestles all the way to the rig (walkable if you can get up on it)
    for (let z = 22; z >= -56; z -= 8) { L.box(47.2, 0, z - 0.15, 47.8, 2.4, z + 0.15, 'paintYellow', { shoot: false }); if (HOLES.slice(0, 6).some((h) => 47.5 > h[0] && 47.5 < h[2] && z > h[1] && z < h[3])) L.box(47.2, -16, z - 0.15, 47.8, 0, z + 0.15, 'paintYellow', { noCol: true }); }
    L.pipe('paintDark', 47.5, 2.85, 24, 47.5, 2.85, -58, 0.45);
    W.add(47.05, 2.4, -58, 47.95, 3.3, 24, { surf: 'metal', nav: false });
    // heat beacons
    MH.beacons = [];
    const beacon = (id, x, z, face) => {
      const f = kit.FACE_DIR[face];
      L.box(x - 0.5, 0, z - 0.5, x + 0.5, 0.25, z + 0.5, 'panelDark');
      for (const [a, b] of [[-1, -1], [1, -1], [0, 1]]) L.pipe('steel', x + a * 0.45, 0.25, z + b * 0.45, x, 2.4, z, 0.05);
      L.cyl('panelOrange', x, 2.6, z, 0.38, 0.5);
      const bowl = new THREE.Mesh(L.geo('sphere'), M.lampHeat.clone()); bowl.scale.set(0.34, 0.12, 0.34); bowl.position.set(x, 2.9, z); L.scene.add(bowl); bowl.visible = false;
      W.add(x - 0.45, 0, z - 0.45, x + 0.45, 2.9, z + 0.45, { surf: 'metal' });
      L.box(x + f[0] * 0.6 - 0.35, 0.25, z + f[1] * 0.6 - 0.35, x + f[0] * 0.6 + 0.35, 1.25, z + f[1] * 0.6 + 0.35, 'panelDark');
      const scr = kit.screenMesh(M.scrBeacon, x + f[0] * 0.96, 1.05, z + f[1] * 0.96, face, 0.6, 0.38);
      const lamp = L.lamp(x, 3.3, z, { color: 0xff8a3a, intensity: 3.2, distance: 16, poolStrength: 0.7, poolSize: 14, flicker: 0.04, on: false, prio: 2 });
      const heat = CF.Frost.addHeat(x, 0, z, 7, false); heat.beacon = true;
      const em = { type: 'flame', x, y: 3.0, z, rate: 14, on: false }; L.emitters.push(em);
      const it = L.addInteract({ id, type: 'task', pos: [x + f[0] * 1.5, 0, z + f[1] * 1.5], face: f, radius: 2.1, hold: 1.8, prompt: 'Light the heat beacon', screen: scr, lamp: null, enabled: false, beacon: { lamp, heat, em, bowl } });
      MH.beacons.push(it); return it;
    };
    beacon('beacon1', 54, 16, 'z+'); beacon('beacon2', 70, -3, 'x-'); beacon('beacon3', 58, -23, 'z+');

    // ================================================================ NORTH-EAST: drill Rig 4
    L.box(42, 0, -64, 54, 3, -52, 'panelDark', { top: 'grate', surf: 'metal' });
    L.box(41.9, 3, -64.1, 54.1, 3.05, -63.9, 'hazard', { noCol: true, ao: false });
    kit.stairs(45, -52, 49, -48, 0, 3, 'z-', 'panelDark');
    for (const x of [42.2, 53.8]) L.box(x - 0.06, 3, -64, x + 0.06, 4.1, -52, 'steel', { shoot: false });
    lattice(48, -58, 3, 34, 3.2, 0.8, 'panelOrange', 12);
    L.box(46.6, 3, -59.4, 49.4, 4.6, -56.6, 'paintDark'); L.cyl('steel', 48, 5.4, -58, 0.5, 1.6);
    crystals(48, 3, -58, 1.8, { n: 9, intensity: 2.2, distance: 14, pulse: 1.6, mist: true, noCol: true });
    for (let i = 0; i < 6; i++) L.box(47.6, 6 + i * 5, -58.6, 48.4, 6.3 + i * 5, -57.4, 'panelWhite', { noCol: true });
    const rigLamp = new THREE.Mesh(L.geo('sphere'), M.lampRed.clone()); rigLamp.scale.setScalar(0.3); rigLamp.position.set(48, 37.3, -58); L.scene.add(rigLamp);
    L.animated.push((dt, t) => { rigLamp.visible = (t % 2) < 0.4; });
    hall(60, -76, 76, -64, 5.2, 's', 64, 70, 'panelRed');
    L.box(61, 0, -75, 66, 2, -71, 'paintYellow'); L.box(69, 0, -75, 75, 1.4, -72, 'panelDark');
    L.lamp(68, 4.8, -70, { color: 0xffc080, intensity: 1.5, distance: 12, poolSize: 9, poolStrength: 0.2, prio: 0.6 });
    CF.Frost.addHeat(68, 0, -70, 6);
    CF.Neon.sign('RIG 4', 'orange', 67, 4.4, -63.55, 'z+', 0.8, { distance: 9 });
    tank(28, -70, 8, 1.6, true, 'panelOrange'); tank(28, -64, 8, 1.6, true); tank(72, -48, 8, 1.5, false);
    sled(34, -48, true, 3); drums(58, -46, 3, 2); drums(24, -56, 2, 2, 'paintYellow');
    floodlight(38, -44, 1, -1); floodlight(58, -44, -1, -1); floodlight(76, -60, -1, 0); floodlight(24, -76, 1, 1, { flicker: 0.15 });
    kit.ammoCache('cacheRig', 40, 0, -48, 'x+');
    for (const c of [[30, -52, 1.6], [66, -52, 1.4], [38, -72, 1.8], [56, -68, 1.2], [74, -40, 1.1]]) crystals(c[0], 0, c[1], c[2], { mist: true });
    // bloom sites (the mission grows the Blooms here)
    L.points.blooms = [{ x: 30, z: -46 }, { x: 64, z: -46 }, { x: 74, z: -68 }, { x: 34, z: -74 }];

    // ================================================================ NORTH-WEST: the flats and the Hollow
    buildSnowcat(-4, -58, 0.7, true);
    sled(10, -50, false, 2); drums(-12, -48, 2, 2);
    for (const c of [[-10, -66, 2.2], [6, -72, 1.6], [14, -60, 1.3], [-14, -52, 1.5], [0, -46, 1.1]]) crystals(c[0], 0, c[1], c[2], { mist: true });
    floodlight(-6, -46, 0, -1, { flicker: 0.3, intensity: 2 });
    // crater walls (ice cliffs rising above the rim) and floor
    L.box(-58, PIT_Y - 2, -76, -20, PIT_Y, -44, 'iceDark', { top: 'ice', surf: 'ice' });
    L.points.heartLamp = L.lamp(-39, PIT_Y + 6, -60, { color: 0x6fd6ff, intensity: 0, distance: 30, pool: false, on: false, pulse: 2.6, prio: 3 });
    const rim = (x0, z0, x1, z1) => { const h = 2.5 + rnd() * 2; L.box(x0, PIT_Y, z0, x1, h, z1, 'ice'); snowCap(x0, h, z0, x1, z1, 0.3); noStand(x0 - 0.05, h + 0.3, z0 - 0.05, x1 + 0.05, z1 + 0.05); };
    for (let x = -58; x < -20; x += 4) { rim(x, -44.8, x + 4, -43.8); rim(x, -76.2, x + 4, -75.2); }
    for (let z = -76; z < -44; z += 4) { rim(-58.8, z, -57.8, z + 4); if (z + 4 <= -63 || z >= -57) rim(-20.4, z, -19.4, z + 4); }
    rim(-20.4, -64, -19.4, -63); rim(-20.4, -57, -19.4, -56);
    // ramp down into the Hollow
    for (let i = 1; i <= 18; i++) { // packed-snow steps cut down into the crater
      const top = PIT_Y + (-PIT_Y) * i / 18, x0 = -20 + (i - 1) * 12 / 17;
      L.box(x0, PIT_Y, -63, Math.min(-8, x0 + 12 / 17), top, -57, 'ice', { top: 'snow', surf: 'snow' });
    }
    L.box(-20, PIT_Y, -63.8, -8, 0.8, -63, 'ice'); L.box(-20, PIT_Y, -57, -8, 0.8, -56.2, 'ice');
    snowCap(-20, 0.8, -63.8, -8, -63, 0.2); snowCap(-20, 0.8, -57, -8, -56.2, 0.2);
    L.addDoor('hollowGate', -20.4, PIT_Y, -63, -19.6, PIT_Y + 5.2, -57, 'ice', { lift: -6 });
    noStand(-20.45, PIT_Y + 5.2, -63.05, -19.55, -56.95); // the gate sits below the rim: nobody hops over it from the ramp walls
    L.doors.hollowGate.mesh.material = L.mats.ice.clone(); L.doors.hollowGate.mesh.material.vertexColors = false;
    // crystal forest inside the crater, cover pillars around the arena
    for (const c of [[-54, -48, 2.4], [-24, -48, 2], [-54, -72, 2.6], [-26, -72, 2.2], [-40, -47, 1.6], [-40, -73, 1.8], [-56, -60, 2], [-47, -50, 1.4], [-31, -70, 1.4]]) crystals(c[0], PIT_Y, c[1], c[2], { intensity: 1.5, distance: 11, mist: true });
    for (const p of [[-48, -54], [-30, -54], [-48, -66], [-30, -66]]) { L.box(p[0] - 1, PIT_Y, p[1] - 1, p[0] + 1, PIT_Y + 3.4, p[1] + 1, 'iceDark'); snowCap(p[0] - 1, PIT_Y + 3.4, p[1] - 1, p[0] + 1, p[1] + 1, 0.15); }
    kit.ammoCache('cacheHollow', -22.5, PIT_Y, -50, 'x-');
    L.points.hollowAlarms = [[-39, 2, -44.6], [-57.6, 1, -60], [-39, 2, -75.6]].map((p) => L.lamp(p[0], p[1], p[2], { color: 0x5fd0ff, intensity: 0, distance: 22, pool: false, on: false, pulse: 4 }));

    // ---------------------------------------------------------------- points and spawns
    L.points.heart = { x: -39, y: PIT_Y, z: -60 };
    L.points.pad = { x: 0, y: 0.25, z: 60 };
    L.points.depot = { x: 0, y: 0, z: 46 };
    L.points.log = { x: -31.5, y: 1.2, z: 10.3 };
    L.points.mast = { x: 0, y: 0, z: 9.1 };
    L.points.gateE = { x: 42, y: 0, z: 20.5 };
    L.points.rig = { x: 48, y: 0, z: -48 };
    L.points.hollowTop = { x: -6, y: 0, z: -60 };
    L.points.hollowIn = { x: -24, y: PIT_Y, z: -60 };
    L.points.cp = {
      start: L.points.start,
      depot: { x: 0, y: 0, z: 36, yaw: 0 },
      station: { x: -9, y: 0, z: 10.3, yaw: 0 },
      whiteout: { x: 40, y: 0, z: 20.5, yaw: -PI / 2 },
      beacon1: { x: 54, y: 0, z: 18, yaw: 0 }, beacon2: { x: 68, y: 0, z: -3, yaw: 0 }, beacon3: { x: 58, y: 0, z: -21, yaw: 0 },
      rig: { x: 56, y: 0, z: -40, yaw: 0 },
      hollow: { x: -4, y: 0, z: -60, yaw: PI / 2 },
      escape: { x: -26, y: PIT_Y, z: -60, yaw: -PI / 2 }
    };
    L.spawns.camp = [[-38, 70], [36, 72], [-42, 46], [42, 48], [-24, 34], [24, 32], [0, 30], [-36, 58]];
    L.spawns.station = [[-44, 28], [-60, 18], [-60, -12], [-50, -32], [-4, -34], [12, -34], [38, 6], [36, 30], [-20, 30], [-44, 0]];
    L.spawns.field = [[76, 22], [76, 0], [62, 2], [76, -22], [66, -26], [74, -36], [48, -38], [54, -4]];
    L.spawns.rig = [[24, -44], [76, -44], [76, -74], [24, -76], [52, -76], [36, -42], [60, -50], [44, -70]];
    L.spawns.flats = [[-14, -46], [12, -46], [-14, -72], [14, -74], [0, -76]];
    L.spawns.hollow = [[-55, -47], [-23, -47], [-55, -73], [-23, -73], [-39, -74], [-39, -46], [-56, -60]];
    L.spawns.escape = [[-14, -46], [12, -46], [-4, -30], [10, -26], [-14, -28], [-20, 0], [20, 0], [-24, 30], [24, 30], [-30, 44], [30, 44]];
    L.points.depotEnemies = [
      { type: 'thrall', x: -8, z: 44, yaw: 0, patrol: [[-8, 44], [-8, 32]] },
      { type: 'thrall', x: 12, z: 40, yaw: PI },
      { type: 'thrall', x: 20, z: 52, yaw: PI / 2, patrol: [[20, 52], [26, 42]] },
      { type: 'thrall', x: -22, z: 45, yaw: 0 },
      { type: 'thrall', x: 2, z: 30, yaw: PI, patrol: [[2, 30], [-10, 30]] },
      { type: 'skitter', x: -30, z: 40, yaw: 0.5 },
      { type: 'skitter', x: 32, z: 36, yaw: -0.4 },
      { type: 'thrall', x: -16, z: 26, yaw: PI }
    ];

    // ---------------------------------------------------------------- Skua on the pad
    const skua = buildSkua(); skua.position.set(0, 0.25, 60); L.scene.add(skua);
    MH.skua = { root: skua, home: new THREE.Vector3(0, 0.25, 60), yaw: 0, state: 'parked', t: 0, loop: null };
    L.animated.push((dt) => MH.updateSkua(dt));
    MH.mastLive = false;
  };

  /** Station snowcat: tracked cab, orange paint. */
  function buildSnowcat(x, z, ry, wreck) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const put = (m, lx, y, lz, sx, sy, sz, rx) => { const p = P(lx, lz); L.addGeo(m, L.geo('box'), L.mat4(p[0], y, p[1], rx || 0, ry, wreck ? 0.12 : 0, sx, sy, sz)); };
    for (const side of [-1, 1]) put('rubber', side * 1.3, 0.55, 0, 0.7, 1.1, 5.2);
    put('panelOrange', 0, 1.6, 0.4, 2.4, 1.2, 4.2); put('panelOrange', 0, 2.7, -0.6, 2.2, 1.2, 2.2);
    put('glassDay', 0, 2.9, -1.72, 2.0, 0.7, 0.05); put('panelWhite', 0, 3.35, -0.6, 2.3, 0.1, 2.3);
    put(wreck ? 'crystal' : 'lampWarm', 0, 1.7, -1.72, 1.8, 0.2, 0.05);
    for (const lz of [-1.7, 0, 1.7]) { const p = P(0, lz); W.addCyl(p[0], p[1], 1.85, 0, 3.4, { surf: 'metal' }); }
    noStand(x - 2.6, 3.4, z - 2.6, x + 2.6, z + 2.6);
    L.blob(x, z, 6.5, 6.5);
    if (wreck) crystals(x + 1, 0, z + 1.5, 1.3, { light: true });
  }
})(window.CF);
