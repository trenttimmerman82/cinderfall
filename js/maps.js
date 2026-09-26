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
  CF.mpMaps = ['market', 'rooftops', 'nuketown', 'sniper'];
})(window.CF);
