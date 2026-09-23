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
      menuCam: (t, cam) => { const a = t * 0.04 + 2.2; cam.position.set(Math.sin(a) * 30, 8 + Math.sin(a * 1.7) * 1.2, 15 + Math.cos(a) * 17); cam.lookAt(Math.sin(a + 0.6) * 6, 4.2, -8); }
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
      id: 'nuketown', name: 'Nuketown', mp: true, nav: false, blurb: 'Two houses, one street and a school bus. Sunny, small and frantic.',
      bounds: { minX: -40, maxX: 40, minZ: -34, maxZ: 34 },
      // plain daylight: blue sky, warm sun, no neon, no rain
      theme: base({
        fog: [0.55, 0.66, 0.8], fogDensity: 0.0022,
        hemi: [0xbcd4ff, 0x4a4a30, 0.55], moon: { color: 0xfff0d8, intensity: 1.5, dir: [0.45, 0.8, 0.35] },
        sky: { zen: [0.16, 0.34, 0.72], hor: [0.66, 0.76, 0.88], glow: [0.5, 0.42, 0.28], glowDir: [0.45, 0.35], glow2: [0, 0, 0], glow2Dir: [-1, 0],
          cloudDark: [0.72, 0.75, 0.8], cloudLit: [1.05, 1.02, 0.97], stars: 0, moon: 3 },
        env: { top: [0.55, 0.7, 0.95], bottom: [0.35, 0.33, 0.26], band: [0.45, 0.45, 0.4], panels: [[1.6, 1.55, 1.45], [1.3, 1.4, 1.6], [1.5, 1.4, 1.2], [1.4, 1.4, 1.4]] },
        poolMul: 0, rainBright: 0, embers: 0,
        skyline: Object.assign(base().skyline, { count: 1, clearX: 1e9, clearZ: 1e9, holo: 0, neon: false, flares: false }),
        rain: { count: 0, roofs: [] }, traffic: { count: 0 },
        post: { bloom: 0.08, exposure: 0.75, sat: 1.2, shadow: [0, 0, 0], high: [0, 0, 0], threshold: 1.6 },
        wet: false, shadowBias: -0.0012, shadowNormalBias: 0.12
      }),
      build: () => CF.MapNuketown.build(),
      menuCam: (t, cam) => { const a = t * 0.04; cam.position.set(Math.sin(a) * 30, 12 + Math.sin(a * 1.3) * 2, Math.cos(a) * 30); cam.lookAt(0, 2, 0); }
    }
  };
  CF.mpMaps = ['market', 'rooftops', 'nuketown'];
})(window.CF);
