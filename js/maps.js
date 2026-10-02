'use strict';
/* Cinderfall — map registry and visual themes (neon night city). */
(function (CF) {
  const base = (over) => {
    const t = {
      // realistic wet night: neutral blue-grey air, sodium-lit low clouds, neon only where the signs are
      fog: [0.021, 0.023, 0.028], fogDensity: 0.017,
      hemi: [0x3b4350, 0x17140f, 0.5], moon: { color: 0xaab8d6, intensity: 0.34, dir: [0.4, 0.55, -0.73] },
      sky: {
        zen: [0.003, 0.004, 0.007], hor: [0.034, 0.032, 0.036], glow: [0.15, 0.075, 0.04], glowDir: [0, -1],
        glow2: [0.05, 0.035, 0.07], glow2Dir: [1, 0.3], cloudDark: [0.009, 0.01, 0.013], cloudLit: [0.13, 0.085, 0.06], stars: 0.04, moon: 0.3
      },
      env: { top: [0.011, 0.012, 0.016], bottom: [0.028, 0.026, 0.026], band: [0.11, 0.07, 0.05], panels: [[0.3, 1.5, 2.1], [2.0, 0.35, 1.5], [2.3, 1.7, 0.8], [1.5, 1.5, 1.7]] },
      poolMul: 0.5, rainBright: 0.3,
      skyline: {
        r0: 140, r1: 300, clearX: 110, clearZ: 100, hMin: 16, hMax: 120, count: 95, windows: 0, lit: 0.3, haze: 0.0032, base: 0,
        win: [[1.5, 1.12, 0.66], [0.85, 1.05, 1.35], [1.25, 0.95, 0.55], [0.35, 1.7, 2.3]], sil: [0.006, 0.006, 0.008], neon: true, holo: 7, flares: false, seed: 77
      },
      rain: { count: 2600, roofs: [] }, traffic: { count: 40, minAlt: 28, maxAlt: 95 },
      post: { bloom: 0.6, exposure: 1.42, sat: 0.97, shadow: [-0.004, 0.001, 0.007], high: [0.012, 0.004, -0.006], threshold: 1.12 },
      wet: true
    };
    return Object.assign(t, over || {});
  };

  CF.Maps = {
    foundry: {
      id: 'foundry', name: 'Cinder Foundry', campaign: true, nav: true,
      bounds: { minX: -64, maxX: 64, minZ: -56, maxZ: 56 },
      theme: base({
        embers: 0.55,
        skyline: Object.assign(base().skyline, { flares: true }),
        rain: { count: 2600, roofs: [[-30.5, -42.5, 30.5, -7.5, 12.6], [41.8, 7.8, 54.2, 20.2, 4.8], [-54.2, 3.8, -41.8, 16.2, 4.8], [-18, 45, 18, 56, 6.8]] }
      }),
      build: () => CF.Map.build(),
      enemies: ['sentry', 'stalker', 'hornet', 'juggernaut'],
      inside: (p) => (p.x > -29.2 && p.x < 29.2 && p.z > -41.2 && p.z < -8.8) || (p.x > 42 && p.x < 54 && p.z > 8 && p.z < 20) || (p.x > -54 && p.x < -42 && p.z > 4 && p.z < 16),
      menuCam: (t, cam) => { const a = t * 0.04 + 2.2; cam.position.set(Math.sin(a) * 30, 8 + Math.sin(a * 1.7) * 1.2, 15 + Math.cos(a) * 17); cam.lookAt(Math.sin(a + 0.6) * 6, 4.2, -8); }
    },
    halden: {
      id: 'halden', name: 'Halden Deep', campaign: true, nav: true,
      bounds: { minX: -84, maxX: 84, minZ: -82, maxZ: 80 },
      // polar twilight: the sun just under the horizon, pink light on the snow, blue in the shadows, aurora overhead
      theme: base({
        fog: [0.1, 0.12, 0.17], fogDensity: 0.0095,
        hemi: [0x8ea6d0, 0x6a7384, 0.62], moon: { color: 0xffc7a2, intensity: 0.78, dir: [-0.55, 0.28, 0.78] },
        sky: { zen: [0.008, 0.024, 0.07], hor: [0.3, 0.26, 0.28], glow: [0.7, 0.34, 0.14], glowDir: [-0.55, 0.78], glow2: [0.04, 0.08, 0.16], glow2Dir: [0.5, -0.8],
          cloudDark: [0.06, 0.07, 0.1], cloudLit: [0.46, 0.32, 0.3], stars: 0.35, moon: 0, aurora: 0.55, aur1: [0.06, 0.85, 0.45], aur2: [0.12, 0.3, 0.55] },
        env: { top: [0.06, 0.09, 0.16], bottom: [0.3, 0.32, 0.36], band: [0.42, 0.26, 0.2], panels: [[1.2, 1.3, 1.5], [1.5, 1.0, 0.8], [0.8, 1.2, 1.6], [1.3, 1.3, 1.4]] },
        poolMul: 0.9, rainBright: 0, embers: 0,
        skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
        mountains: { r0: 200, r1: 380, count: 60, hMin: 22, hMax: 88, rock: [0.07, 0.075, 0.09], snow: [0.6, 0.64, 0.76], haze: 0.004, seed: 12 },
        rain: { count: 0, roofs: [] }, traffic: { count: 0 },
        post: { bloom: 0.4, exposure: 0.92, sat: 1.04, shadow: [-0.004, 0.002, 0.012], high: [0.012, 0.004, -0.004], threshold: 1.25 },
        wet: false, shadowBias: -0.0008, shadowNormalBias: 0.08,
        frost: { stormFog: [0.3, 0.34, 0.4], stormDensity: 0.055, aurora: 0.6 }
      }),
      build: () => CF.MapHalden.build(),
      enemies: ['thrall', 'skitter', 'frostdrone', 'colossus', 'bloom'],
      inside: (p) => (p.y > 0.9 && ((p.x > -34 && p.x < -14 && p.z > 4 && p.z < 16) || (p.x > 14 && p.x < 32 && p.z > 2 && p.z < 14))) ||
        (p.x > -44 && p.x < -24 && p.z > -26 && p.z < -10) || (p.x > 16 && p.x < 38 && p.z > -28 && p.z < -12) || (p.x > 60 && p.x < 76 && p.z > -76 && p.z < -64),
      menuCam: (t, cam) => { const a = t * 0.03 + 0.6; cam.position.set(Math.sin(a) * 44, 12 + Math.sin(a * 1.4) * 2, 30 + Math.cos(a) * 26); cam.lookAt(0, 6, -4); }
    },
    market: {
      id: 'market', name: 'Neon Market', mp: true, nav: false, blurb: 'Tight streets, alleys and balconies around a holographic plaza.',
      bounds: { minX: -48, maxX: 48, minZ: -48, maxZ: 48 },
      theme: base({
        fogDensity: 0.021,
        skyline: Object.assign(base().skyline, { r0: 62, r1: 260, clearX: 50, clearZ: 50, hMin: 30, hMax: 120, count: 110, holo: 12, seed: 91 }),
        rain: { count: 3000, roofs: [[-8, -38, -5.5, -10, 4.5], [5.5, 10, 8, 38, 4.5]] }
      }),
      build: () => CF.MapMarket.build(),
      menuCam: (t, cam) => { const a = t * 0.05; cam.position.set(Math.sin(a) * 2.5, 5.8 + Math.sin(a * 0.7) * 0.6, 30 - ((t * 1.2) % 50)); cam.lookAt(Math.sin(a * 0.8) * 3, 4.5, cam.position.z - 12); }
    },
    rooftops: {
      id: 'rooftops', name: 'Skyline', mp: true, nav: false, blurb: 'Five rooftops, stairways and catwalks, 60 metres above the street.',
      bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
      theme: base({
        fogDensity: 0.011,
        skyline: Object.assign(base().skyline, { r0: 55, r1: 290, clearX: 44, clearZ: 44, hMin: 40, hMax: 160, count: 120, base: -60, holo: 14, seed: 133 }),
        traffic: { count: 55, minAlt: -10, maxAlt: 60 },
        rain: { count: 2600, roofs: [] }
      }),
      build: () => CF.MapRooftops.build(),
      menuCam: (t, cam) => { const a = t * 0.035; cam.position.set(Math.sin(a) * 38, 9 + Math.sin(a * 1.3) * 2, Math.cos(a) * 38); cam.lookAt(0, 0, 0); }
    },
    nuketown: {
      id: 'nuketown', name: 'Nuketown', mp: true, nav: false, blurb: 'Two houses, a school bus and a moving truck in a 1950s desert cul-de-sac.',
      bounds: { minX: -44, maxX: 44, minZ: -48, maxZ: 48 },
      // hazy Nevada daylight: warm dusty air, blue sky overhead, no neon, no rain
      theme: base({
        fog: [0.78, 0.73, 0.64], fogDensity: 0.003,
        hemi: [0xcfdcec, 0x6a5a40, 0.6], moon: { color: 0xfff0d4, intensity: 1.6, dir: [0.55, 0.72, 0.42] },
        sky: { zen: [0.2, 0.38, 0.68], hor: [0.82, 0.77, 0.68], glow: [0.5, 0.42, 0.28], glowDir: [0.55, 0.42], glow2: [0.12, 0.1, 0.06], glow2Dir: [-1, 0],
          cloudDark: [0.74, 0.74, 0.76], cloudLit: [1.05, 1.02, 0.96], stars: 0, moon: 3 },
        env: { top: [0.55, 0.68, 0.9], bottom: [0.42, 0.36, 0.26], band: [0.55, 0.5, 0.42], panels: [[1.6, 1.55, 1.45], [1.3, 1.4, 1.6], [1.5, 1.4, 1.2], [1.4, 1.4, 1.4]] },
        poolMul: 0, rainBright: 0, embers: 0,
        skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
        rain: { count: 0, roofs: [] }, traffic: { count: 0 },
        post: { bloom: 0.08, exposure: 0.78, sat: 1.12, shadow: [0, 0, 0], high: [0.01, 0.004, -0.008], threshold: 1.6 },
        wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
      }),
      build: () => CF.MapNuketown.build(),
      menuCam: (t, cam) => { const a = t * 0.04; cam.position.set(Math.sin(a) * 34, 14 + Math.sin(a * 1.3) * 2, Math.cos(a) * 34); cam.lookAt(0, 2, 0); }
    }
  };
  CF.Maps.sniper = {
    id: 'sniper', name: 'Sniper Valley', mp: true, nav: false, blurb: 'Two rooftops face each other across a 60 m drop. Rail rifles only.',
    bounds: { minX: -40, maxX: 40, minZ: -60, maxZ: 60 },
    theme: base({
      fogDensity: 0.0075,
      skyline: Object.assign(base().skyline, { r0: 70, r1: 300, clearX: 50, clearZ: 64, hMin: 40, hMax: 170, count: 130, base: -120, holo: 16, seed: 311 }),
      traffic: { count: 60, minAlt: -60, maxAlt: 40 },
      rain: { count: 2200, roofs: [] }
    }),
    build: () => CF.MapSniper.build(),
    menuCam: (t, cam) => { const a = t * 0.03; cam.position.set(Math.sin(a) * 30, 6 + Math.sin(a * 1.2) * 2, Math.cos(a) * 12); cam.lookAt(0, 0, Math.cos(a) * -30); }
  };
  // Story Campaign (Dust Off): Dar Masir. The mission relights it (dawn, day, afternoon, dusk, night; js/map-story.js).
  CF.Maps.story = {
    id: 'story', name: 'Dar Masir', campaign: true, nav: true, boss: false,
    bounds: { minX: -110, maxX: 110, minZ: -110, maxZ: 112 },
    theme: base({
      fog: [0.8, 0.74, 0.62], fogDensity: 0.0045,
      hemi: [0xd8e2f0, 0x7a6448, 0.62], moon: { color: 0xfff2dc, intensity: 1.9, dir: [0.4, 0.8, 0.3] },
      sky: { zen: [0.22, 0.4, 0.7], hor: [0.86, 0.8, 0.68], glow: [0.5, 0.42, 0.28], glowDir: [0.4, 0.3], glow2: [0.12, 0.1, 0.06], glow2Dir: [-1, 0],
        cloudDark: [0.8, 0.78, 0.76], cloudLit: [1.1, 1.05, 0.98], stars: 0, moon: 2 },
      env: { top: [0.6, 0.7, 0.9], bottom: [0.5, 0.42, 0.3], band: [0.6, 0.55, 0.45], panels: [[1.4, 1.3, 1.1], [1.2, 1.2, 1.3], [1.3, 1.2, 1.0], [1.2, 1.2, 1.2]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      mountains: { r0: 190, r1: 360, count: 46, hMin: 12, hMax: 46, rock: [0.36, 0.25, 0.16], snow: [0.62, 0.48, 0.32], haze: 0.0042, seed: 21 },
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.1, exposure: 0.74, sat: 1.06, shadow: [0, 0, 0.004], high: [0.012, 0.005, -0.008], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.1
    }),
    build: () => { CF.MapStory.build(); CF.World.flowMax = 120; },
    enemies: ['militia', 'gunner', 'rpg', 'guard', 'officer', 'sniper', 'technical'],
    inside: (p) => (p.x > -84 && p.x < -60 && p.z > -90 && p.z < -72) || (p.x > 52 && p.x < 96 && p.z > -102.4 && p.z < -86) || (p.x > 52 && p.x < 58 && p.z > -4 && p.z < 14),
    menuCam: (t, cam) => { const a = t * 0.025 + 1.2; cam.position.set(-9 + Math.sin(a) * 42, 24 + Math.sin(a * 1.3) * 3, 20 + Math.cos(a) * 42); cam.lookAt(-9, 10, 20); }
  };
  // Oregon: overcast Pacific Northwest morning; grey-green light, mist in the firs, snow on the far peaks
  CF.Maps.oregon = {
    id: 'oregon', name: 'Oregon', mp: true, nav: false, blurb: 'A fenced compound in the Oregon woods: dorms, a basement, a meeting hall, the Big Tower and a garage roof.',
    bounds: { minX: -48, maxX: 48, minZ: -44, maxZ: 40 },
    theme: base({
      fog: [0.55, 0.6, 0.6], fogDensity: 0.0085,
      hemi: [0xb4c2cc, 0x3c4630, 0.72], moon: { color: 0xfff0dc, intensity: 1.25, dir: [-0.45, 0.62, 0.55] },
      sky: { zen: [0.3, 0.38, 0.48], hor: [0.66, 0.7, 0.7], glow: [0.36, 0.33, 0.27], glowDir: [-0.45, 0.55], glow2: [0.08, 0.09, 0.08], glow2Dir: [1, 0],
        cloudDark: [0.46, 0.5, 0.53], cloudLit: [0.92, 0.92, 0.9], stars: 0, moon: 1.4 },
      env: { top: [0.5, 0.58, 0.66], bottom: [0.25, 0.28, 0.2], band: [0.5, 0.52, 0.5], panels: [[1.4, 1.45, 1.45], [1.2, 1.3, 1.4], [1.3, 1.3, 1.2], [1.3, 1.3, 1.3]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      mountains: { r0: 200, r1: 370, count: 44, hMin: 24, hMax: 80, rock: [0.1, 0.13, 0.11], snow: [0.7, 0.74, 0.8], haze: 0.0055, seed: 44 },
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.08, exposure: 0.82, sat: 1.0, shadow: [0, 0.002, 0.004], high: [0.006, 0.004, -0.004], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapOregon.build(),
    inside: (p) => (p.x > -12 && p.x < 12 && p.z > -12 && p.z < 10) || (p.x > -30 && p.x < -12 && p.z > -10 && p.z < 8) || (p.x > -30 && p.x < -22 && p.z > -18 && p.z < -10) ||
      (p.x > 12 && p.x < 26 && p.z > -8 && p.z < 10 && p.y < 3) || (p.x > -46 && p.x < -40 && p.z > -6 && p.z < 0),
    menuCam: (t, cam) => { const a = t * 0.035 + 0.8; cam.position.set(-4 + Math.sin(a) * 46, 15 + Math.sin(a * 1.3) * 2, -2 + Math.cos(a) * 42); cam.lookAt(-6, 3, -3); }
  };
  // Terminal: clear Moscow afternoon; bright blue sky, a low sun through the glass, haze over the runways
  CF.Maps.terminal = {
    id: 'terminal', name: 'Terminal', mp: true, nav: false, blurb: 'An airport terminal and an airliner you can walk through: security, Burger Town, the bookstore, the gate lounge and the apron.',
    bounds: { minX: -54, maxX: 40, minZ: -54, maxZ: 30 },
    theme: base({
      fog: [0.74, 0.8, 0.87], fogDensity: 0.0022,
      hemi: [0xc8d8ec, 0x5c5a52, 0.64], moon: { color: 0xfff1d8, intensity: 1.75, dir: [0.5, 0.62, 0.55] },
      sky: { zen: [0.18, 0.34, 0.64], hor: [0.76, 0.8, 0.84], glow: [0.52, 0.44, 0.3], glowDir: [0.5, 0.55], glow2: [0.1, 0.1, 0.1], glow2Dir: [-1, 0],
        cloudDark: [0.72, 0.74, 0.78], cloudLit: [1.06, 1.04, 1.0], stars: 0, moon: 2.6 },
      env: { top: [0.55, 0.66, 0.86], bottom: [0.42, 0.42, 0.4], band: [0.62, 0.62, 0.6], panels: [[1.5, 1.5, 1.5], [1.3, 1.4, 1.6], [1.45, 1.4, 1.3], [1.4, 1.4, 1.4]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      mountains: { r0: 230, r1: 380, count: 40, hMin: 5, hMax: 14, rock: [0.14, 0.18, 0.13], snow: [0.14, 0.18, 0.13], haze: 0.0048, seed: 64 },
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.1, exposure: 0.8, sat: 1.05, shadow: [0, 0, 0.004], high: [0.01, 0.004, -0.006], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapTerminal.build(),
    inside: (p) => (p.x > -46 && p.x < 30 && p.z > -10 && p.z < 18) || (p.y > 3 && p.x > -19.2 && p.x < 16.2 && p.z > -33 && p.z < -29) ||
      (p.y > 3 && ((p.x > 11.4 && p.x < 15 && p.z > -29 && p.z < -10) || (p.x > -36.1 && p.x < -33.5 && p.z > -19 && p.z < -10))),
    menuCam: (t, cam) => { const a = t * 0.03 + 2.4; cam.position.set(-2 + Math.sin(a) * 48, 14 + Math.sin(a * 1.3) * 2.5, -16 + Math.cos(a) * 40); cam.lookAt(-2, 4, -18); }
  };
  // Dust II: hard desert afternoon; a high sun, pale haze, warm bounce off the sandstone
  CF.Maps.dust2 = {
    id: 'dust2', name: 'Dust II', mp: true, nav: false, blurb: 'A sandstone town: Long A, the catwalk, mid doors, the tunnels to B. Terrorists south, Counter-Terrorists north.',
    bounds: { minX: -58, maxX: 58, minZ: -62, maxZ: 60 },
    theme: base({
      fog: [0.84, 0.77, 0.64], fogDensity: 0.0036,
      hemi: [0xd6e0ee, 0x8a6a48, 0.66], moon: { color: 0xfff0d6, intensity: 2.0, dir: [0.45, 0.78, 0.36] },
      sky: { zen: [0.2, 0.38, 0.68], hor: [0.88, 0.8, 0.66], glow: [0.52, 0.42, 0.26], glowDir: [0.45, 0.36], glow2: [0.12, 0.1, 0.06], glow2Dir: [-1, 0],
        cloudDark: [0.82, 0.8, 0.78], cloudLit: [1.1, 1.05, 0.98], stars: 0, moon: 2.2 },
      env: { top: [0.6, 0.7, 0.9], bottom: [0.55, 0.44, 0.3], band: [0.64, 0.56, 0.44], panels: [[1.45, 1.35, 1.15], [1.2, 1.25, 1.35], [1.35, 1.25, 1.05], [1.25, 1.2, 1.15]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      mountains: { r0: 210, r1: 380, count: 44, hMin: 14, hMax: 50, rock: [0.4, 0.29, 0.19], snow: [0.66, 0.52, 0.36], haze: 0.0042, seed: 2 },
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.1, exposure: 0.74, sat: 1.08, shadow: [0.004, 0.002, 0.006], high: [0.014, 0.006, -0.01], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapDust2.build(),
    // the tunnels and the B window room are roofed
    inside: (p) => (p.x > -34 && p.x < -26 && p.z > -6 && p.z < 26) || (p.x > -40 && p.x < -30 && p.z > -28 && p.z < -6) ||
      (p.x > -26 && p.x < -6 && p.z > 2 && p.z < 8 && p.y < 1.4) || (p.x > -24 && p.x < -16 && p.z > -38 && p.z < -32),
    menuCam: (t, cam) => { const a = t * 0.03 + 0.5; cam.position.set(Math.sin(a) * 52, 26 + Math.sin(a * 1.3) * 3, Math.cos(a) * 54); cam.lookAt(0, 1, -4); }
  };
  // The Pit: a clear afternoon over the Kenyan savanna; warm dusty light, ochre haze, the escarpment behind the north wall
  CF.Maps.pit = {
    id: 'pit', name: 'The Pit', mp: true, nav: false, blurb: 'A UNSC training facility: two bases with sniper towers, the Sword Room, the sunken live-fire Pit and the Long Hall.',
    bounds: { minX: -56, maxX: 56, minZ: -34, maxZ: 30 },
    theme: base({
      fog: [0.8, 0.72, 0.58], fogDensity: 0.0032,
      hemi: [0xd6dce8, 0x6e5a3e, 0.62], moon: { color: 0xffe8c4, intensity: 1.8, dir: [-0.5, 0.66, 0.4] },
      sky: { zen: [0.2, 0.36, 0.64], hor: [0.84, 0.76, 0.62], glow: [0.56, 0.42, 0.24], glowDir: [-0.5, 0.4], glow2: [0.12, 0.1, 0.06], glow2Dir: [1, 0],
        cloudDark: [0.76, 0.72, 0.68], cloudLit: [1.08, 1.02, 0.92], stars: 0, moon: 2.8 },
      env: { top: [0.56, 0.66, 0.86], bottom: [0.44, 0.36, 0.26], band: [0.6, 0.52, 0.42], panels: [[1.6, 1.5, 1.4], [1.3, 1.4, 1.6], [1.5, 1.4, 1.2], [1.4, 1.4, 1.4]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      mountains: { r0: 170, r1: 360, count: 42, hMin: 16, hMax: 56, rock: [0.3, 0.23, 0.16], snow: [0.3, 0.23, 0.16], haze: 0.005, seed: 117 },
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.1, exposure: 0.8, sat: 1.08, shadow: [0, 0, 0.003], high: [0.012, 0.005, -0.008], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapPit.build(),
    inside: (p) => { const u = Math.abs(p.x); return (u > 34 && u < 48 && p.z > -12 && p.z < 8) || (u < 30 && p.z > 19 && p.z < 25 && p.y < 4) || (u < 6 && p.z > 13 && p.z < 19 && p.y < 4) ||
      (u < 8 && p.z > -30 && p.z < -17 && p.y < 8.5) || (u > 37.5 && u < 44.5 && p.z > -29.5 && p.z < -22.5 && p.y > 4 && p.y < 8.2); },
    menuCam: (t, cam) => { const a = t * 0.03 + 1.1; cam.position.set(Math.sin(a) * 50, 19 + Math.sin(a * 1.3) * 2.5, -3 + Math.cos(a) * 36); cam.lookAt(0, 1, -4); }
  };
  // Rust: a hazy desert afternoon; a low orange sun through blowing dust, the sky bleached almost white at the horizon
  CF.Maps.rust = {
    id: 'rust', name: 'Rust', mp: true, nav: false, blurb: 'A small oil yard in the desert: the drilling tower, the pipelines, the office, the tank farm and the pump house.',
    bounds: { minX: -38, maxX: 38, minZ: -38, maxZ: 38 },
    theme: base({
      fog: [0.78, 0.64, 0.46], fogDensity: 0.0062,
      hemi: [0xd8cdb8, 0x7a5c3a, 0.62], moon: { color: 0xffddb0, intensity: 1.85, dir: [-0.55, 0.55, -0.5] },
      sky: { zen: [0.32, 0.4, 0.54], hor: [0.92, 0.74, 0.5], glow: [0.7, 0.44, 0.2], glowDir: [-0.55, -0.5], glow2: [0.14, 0.1, 0.06], glow2Dir: [1, 0],
        cloudDark: [0.74, 0.64, 0.54], cloudLit: [1.1, 0.96, 0.78], stars: 0, moon: 2.4 },
      env: { top: [0.58, 0.62, 0.74], bottom: [0.56, 0.42, 0.28], band: [0.68, 0.54, 0.38], panels: [[1.5, 1.3, 1.05], [1.2, 1.2, 1.3], [1.4, 1.2, 0.95], [1.25, 1.15, 1.05]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      mountains: { r0: 180, r1: 360, count: 40, hMin: 14, hMax: 52, rock: [0.42, 0.3, 0.2], snow: [0.56, 0.42, 0.28], haze: 0.0055, seed: 9 },
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.12, exposure: 0.76, sat: 1.04, shadow: [0.004, 0.002, 0.004], high: [0.016, 0.006, -0.012], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapRust.build(),
    // the office, the pump house and the doghouse on the rig floor are roofed
    inside: (p) => (p.x > -30 && p.x < -20 && p.z > -30 && p.z < -23 && p.y < 6) || (p.x > 18 && p.x < 28 && p.z > 20 && p.z < 28 && p.y < 3.4) ||
      (p.x > 0.9 && p.x < 2.6 && p.z > 0.8 && p.z < 2.5 && p.y > 2.9 && p.y < 5.75),
    menuCam: (t, cam) => { const a = t * 0.035 + 2.1; cam.position.set(Math.sin(a) * 40, 17 + Math.sin(a * 1.3) * 2.5, Math.cos(a) * 40); cam.lookAt(0, 5, 0); }
  };
  // Highrise: a clear, hazy afternoon eighty-one floors up; hard sun off the glass, the city lost in the haze below
  CF.Maps.highrise = {
    id: 'highrise', name: 'Highrise', mp: true, nav: false, blurb: 'A skyscraper roof: the helipad, two floors of offices, the mechanical well, the building site and the tower crane.',
    bounds: { minX: -56, maxX: 56, minZ: -38, maxZ: 38 },
    theme: base({
      fog: [0.72, 0.78, 0.86], fogDensity: 0.0024,
      hemi: [0xcad8ec, 0x6a6660, 0.66], moon: { color: 0xfff0d8, intensity: 1.8, dir: [0.55, 0.6, 0.45] },
      sky: { zen: [0.17, 0.33, 0.64], hor: [0.78, 0.82, 0.86], glow: [0.54, 0.46, 0.32], glowDir: [0.55, 0.45], glow2: [0.1, 0.1, 0.1], glow2Dir: [-1, 0],
        cloudDark: [0.74, 0.76, 0.8], cloudLit: [1.06, 1.04, 1.0], stars: 0, moon: 2.6 },
      env: { top: [0.55, 0.66, 0.88], bottom: [0.4, 0.42, 0.44], band: [0.66, 0.66, 0.64], panels: [[1.5, 1.5, 1.5], [1.3, 1.4, 1.6], [1.45, 1.4, 1.3], [1.4, 1.4, 1.4]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.1, exposure: 0.8, sat: 1.05, shadow: [0, 0, 0.004], high: [0.01, 0.004, -0.006], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapHighrise.build(),
    // the offices, the heliport lounge and the machine room are roofed
    inside: (p) => (p.x > -24 && p.x < 24 && p.z > -32 && p.z < -8 && p.y < 8.4) || (p.x > -47 && p.x < -31 && p.z > -24 && p.z < -8 && p.y < 2.7) ||
      (p.x > -50 && p.x < -36 && p.z > 18 && p.z < 32 && p.y < 4.2),
    menuCam: (t, cam) => { const a = t * 0.03 + 0.9; cam.position.set(Math.sin(a) * 62, 30 + Math.sin(a * 1.3) * 3, Math.cos(a) * 50); cam.lookAt(0, 3, -4); }
  };
  // Hijacked: a hot, clear afternoon on open sea; a deep blue sky, the sun high in the south-east, glitter on the water
  CF.Maps.hijacked = {
    id: 'hijacked', name: 'Hijacked', mp: true, nav: false, blurb: 'A superyacht under way: the pool deck, the salon and galley, the cabins below, the bridge, the sun deck and the helipad on the bow.',
    bounds: { minX: -54, maxX: 54, minZ: -16, maxZ: 16 },
    theme: base({
      fog: [0.6, 0.74, 0.88], fogDensity: 0.0015,
      hemi: [0xcfe0f2, 0x2c5a72, 0.66], moon: { color: 0xfff1da, intensity: 1.9, dir: [0.45, 0.72, 0.5] },
      sky: { zen: [0.12, 0.3, 0.66], hor: [0.72, 0.82, 0.92], glow: [0.55, 0.46, 0.3], glowDir: [0.45, 0.5], glow2: [0.08, 0.1, 0.12], glow2Dir: [-1, 0],
        cloudDark: [0.76, 0.8, 0.86], cloudLit: [1.08, 1.06, 1.02], stars: 0, moon: 2.6 },
      env: { top: [0.52, 0.66, 0.9], bottom: [0.1, 0.26, 0.36], band: [0.66, 0.74, 0.8], panels: [[1.5, 1.5, 1.5], [1.3, 1.45, 1.65], [1.45, 1.4, 1.3], [1.4, 1.45, 1.5]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.1, exposure: 0.8, sat: 1.08, shadow: [0, 0.002, 0.006], high: [0.01, 0.004, -0.006], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapHijacked.build(),
    // the main-deck house, everything below decks and the upper-deck house are roofed
    inside: (p) => (p.x > -24 && p.x < 16 && Math.abs(p.z) < 6.2 && p.y < 3.1) || (p.y < -0.3 && p.x > -31.2 && p.x < 29.5) ||
      (p.x > -22 && p.x < 10 && Math.abs(p.z) < 5.2 && p.y > 3.1 && p.y < 6.5),
    menuCam: (t, cam) => { const a = t * 0.03 + 2.3; cam.position.set(Math.sin(a) * 72, 16 + Math.sin(a * 1.3) * 3, Math.cos(a) * 42); cam.lookAt(0, 2, 0); }
  };
  // Retail Row: a bright, clear afternoon in open country; a saturated blue sky, green fields, hills on the horizon
  CF.Maps.retail = {
    id: 'retail', name: 'Retail Row', mp: true, nav: false, br: true, blurb: 'A shopping town in open country: Noms, the row of shops, the water tower, the Gas-N-Go and two streets of houses. Battle Royale.',
    bounds: { minX: -124, maxX: 124, minZ: -124, maxZ: 124 },
    theme: base({
      fog: [0.68, 0.8, 0.92], fogDensity: 0.0017,
      hemi: [0xcfe0f4, 0x58703c, 0.68], moon: { color: 0xfff2dc, intensity: 1.85, dir: [0.42, 0.74, 0.52] },
      sky: { zen: [0.1, 0.3, 0.72], hor: [0.7, 0.82, 0.94], glow: [0.55, 0.46, 0.3], glowDir: [0.42, 0.52], glow2: [0.08, 0.1, 0.12], glow2Dir: [-1, 0],
        cloudDark: [0.78, 0.82, 0.88], cloudLit: [1.1, 1.08, 1.04], stars: 0, moon: 2.6 },
      env: { top: [0.5, 0.66, 0.92], bottom: [0.3, 0.38, 0.22], band: [0.64, 0.72, 0.78], panels: [[1.5, 1.5, 1.5], [1.3, 1.45, 1.65], [1.45, 1.4, 1.3], [1.4, 1.45, 1.4]] },
      poolMul: 0, rainBright: 0, embers: 0,
      skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
      mountains: { r0: 220, r1: 390, count: 48, hMin: 14, hMax: 60, rock: [0.2, 0.3, 0.16], snow: [0.36, 0.46, 0.28], haze: 0.0045, seed: 81 },
      rain: { count: 0, roofs: [] }, traffic: { count: 0 },
      post: { bloom: 0.1, exposure: 0.82, sat: 1.14, shadow: [0, 0.002, 0.006], high: [0.01, 0.004, -0.006], threshold: 1.6 },
      wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
    }),
    build: () => CF.MapRetail.build(),
    // Noms, the shops (both floors), the Gas-N-Go, the houses and the storage units are roofed
    inside: (p) => (p.x > -88 && p.x < -46 && p.z > -42 && p.z < 6 && p.y < 7) || (p.x > -38 && p.x < 34 && p.z > -36 && p.z < -20 && p.y < 7) ||
      (p.x > 70 && p.x < 84 && p.z > -12 && p.z < 2 && p.y < 4.2) || (p.y < 5.9 && ((p.z > 30 && p.z < 40) || (p.z > 58 && p.z < 68)) && [-100, -76, -52, 60, 84, -96, -70, -44, 62, 88].some((c) => p.x > c - 6 && p.x < c + 12 && (p.x < c + 6 || p.z < (p.z > 50 ? 65 : 37)))),
    menuCam: (t, cam) => { const a = t * 0.03 + 0.4; cam.position.set(-10 + Math.sin(a) * 70, 30 + Math.sin(a * 1.3) * 4, -10 + Math.cos(a) * 60); cam.lookAt(-10, 3, -14); }
  };
  CF.mpMaps = ['market', 'rooftops', 'nuketown', 'oregon', 'terminal', 'dust2', 'pit', 'rust', 'highrise', 'hijacked', 'retail', 'sniper'];
})(window.CF);
