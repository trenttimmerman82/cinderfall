'use strict';
/* Cinderfall — cosmetics: the skin catalog (mirrors server/worker.js SKINS, CRATES, economy), materials for weapon
   finishes and operative suits, accessories, and the per-frame animation of the fancy ones. */
(function (CF) {
  const U = CF.U;
  const K = CF.Skins = {};

  // ------------------------------------------------------------ catalog (ids, slots and rarities must match the server)
  K.RARITY = {
    common: { label: 'Common', css: '#b8c2cc', rgb: [0.72, 0.76, 0.8], weight: 0 },
    rare: { label: 'Rare', css: '#3fa2ff', rgb: [0.25, 0.63, 1], weight: 1 },
    epic: { label: 'Epic', css: '#b35cff', rgb: [0.7, 0.36, 1], weight: 2 },
    legendary: { label: 'Legendary', css: '#ffb62e', rgb: [1, 0.71, 0.18], weight: 3 },
    champion: { label: 'Champion', css: '#ffe27a', rgb: [1, 0.89, 0.48], weight: 4 }
  };
  const W = (id, rarity, name, desc) => ({ id, slot: 'w', rarity, name, desc });
  const P = (id, rarity, name, desc) => ({ id, slot: 'p', rarity, name, desc });
  K.list = [
    W('w_desert', 'common', 'Desert Tan', 'Sand-and-khaki blotch camouflage.'),
    W('w_urban', 'common', 'Urban Digital', 'Grey pixel camo for concrete and steel.'),
    W('w_woodland', 'common', 'Woodland', 'Classic four-colour forest pattern.'),
    W('w_arctic', 'common', 'Arctic Splinter', 'White and ice-grey splinter shards.'),
    W('w_carbon', 'rare', 'Carbon Weave', 'Woven carbon fibre with a cold blue sheen.'),
    W('w_cobalt', 'rare', 'Anodized Cobalt', 'Deep blue anodized metal, polished edges.'),
    W('w_tiger', 'rare', 'Tiger Stripe', 'Hot orange with black brush stripes.'),
    W('w_redline', 'rare', 'Redline', 'Black polymer cut by red racing lines.'),
    W('w_circuit', 'epic', 'Neon Circuit', 'Live circuit traces that pulse with current.'),
    W('w_damascus', 'epic', 'Damascus', 'Folded steel, every layer visible.'),
    W('w_hologram', 'epic', 'Hologram', 'An iridescent film that shifts with every move.'),
    W('w_frostbite', 'epic', 'Frostbite', 'Glacier-blue crystal with a glow inside the ice.'),
    W('w_inferno', 'legendary', 'Inferno', 'Obsidian shell over molten cracks that breathe.'),
    W('w_void', 'legendary', 'Void', 'A drifting nebula held in black glass.'),
    W('w_dragon', 'legendary', 'Dragonscale', 'Jade and gold scales with a moving shimmer.'),
    W('w_champion', 'champion', 'Champion', 'Mirror gold with a travelling shine. Only for players who took #1 on a leaderboard.'),
    P('p_ranger', 'common', 'Ranger', 'Olive drab fatigues and a boonie hat.'),
    P('p_urban', 'common', 'Urban Ops', 'Charcoal gear, beanie and a patrol pack.'),
    P('p_sand', 'common', 'Sandstorm', 'Desert kit, shemagh and dust goggles.'),
    P('p_navy', 'common', 'Harbor Patrol', 'Navy and white with a peaked cap.'),
    P('p_hazmat', 'rare', 'Hazmat', 'Yellow containment suit, respirator and air tank.'),
    P('p_arctic', 'rare', 'Polar Recon', 'White parka with a fur-lined hood and goggles.'),
    P('p_crimson', 'rare', 'Crimson Guard', 'Red lacquered plates and heavy pauldrons.'),
    P('p_stealth', 'rare', 'Nightshade', 'Matte black, hooded, one green lens.'),
    P('p_oni', 'epic', 'Oni', 'Black lacquer armour under a horned red demon mask.'),
    P('p_chrome', 'epic', 'Chrome', 'Mirror-polished armour with a crest fin.'),
    P('p_samurai', 'epic', 'Ronin', 'Woven kasa hat and layered shoulder guards.'),
    P('p_cyber', 'epic', 'Synthwave', 'Neon stripes that cycle through the spectrum, and a mohawk to match.'),
    P('p_phantom', 'legendary', 'Phantom', 'A glowing ghost of an operative, trailing wisps.'),
    P('p_inferno', 'legendary', 'Hellfire', 'Armour cracked with living magma under a crown of flame.'),
    P('p_mech', 'legendary', 'Warframe', 'Heavy exo-armour with a humming reactor on the back.'),
    P('p_champion', 'champion', 'Champion', 'Gold armour, crown and cape. Only for players who took #1 on a leaderboard.')
  ];
  K.byId = {}; for (const s of K.list) K.byId[s.id] = s;
  K.get = (id) => K.byId[id] || null;
  K.CRATES = {
    field: { id: 'field', name: 'Field crate', price: 300, desc: 'A standard issue crate. Anything but Champion gear can drop.', odds: [['common', 0.62], ['rare', 0.27], ['epic', 0.09], ['legendary', 0.02]] },
    elite: { id: 'elite', name: 'Elite crate', price: 750, desc: 'No commons. Much better odds at Epic and Legendary.', odds: [['rare', 0.55], ['epic', 0.33], ['legendary', 0.12]] }
  };
  K.DUP_REFUND = { common: 60, rare: 125, epic: 275, legendary: 600 };
  K.ECON = { phase: 40, finish: { foundry: 250, halden: 300, story: 400 }, diff: { recruit: 0.75, veteran: 1, elite: 1.5 }, welcome: 300 };
  /** Coins for clearing a campaign part (the server computes the same numbers; this is for offline play and display). */
  K.phaseCoins = (campaign, diff, phase, total) => {
    const mul = K.ECON.diff[diff] || 1;
    let c = Math.round(K.ECON.phase * mul);
    if (phase + 1 >= total) c += Math.round((K.ECON.finish[campaign] || 250) * mul);
    return c;
  };
  /** Local crate roll (offline play only; online the server rolls). */
  K.roll = (crate) => {
    const c = K.CRATES[crate]; let r = Math.random(), rarity = c.odds[c.odds.length - 1][0];
    for (const [k, w] of c.odds) { if (r < w) { rarity = k; break; } r -= w; }
    const pool = K.list.filter((s) => s.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // ------------------------------------------------------------ pattern textures (drawn once, on first use)
  const TEX = {};
  function paint(key, n, draw) {
    if (TEX[key]) return TEX[key];
    const c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'); draw(x, n, U.mulberry32(key.length * 7919 + key.charCodeAt(2) * 31));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return (TEX[key] = t);
  }
  /** Seamless blobs: every shape is drawn at its 9 wrapped positions so the tile repeats without seams. */
  const wrapDraw = (n, fn) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) fn(ox, oy); };
  function blobs(x, n, rnd, cols, count, rmin, rmax) {
    for (const col of cols) {
      x.fillStyle = col;
      for (let i = 0; i < count; i++) {
        const cx = rnd() * n, cy = rnd() * n, r = rmin + rnd() * (rmax - rmin), k = 5 + Math.floor(rnd() * 4), rot = rnd() * 6.28, pts = [];
        for (let j = 0; j < k; j++) { const a = rot + j / k * 6.28, rr = r * (0.55 + rnd() * 0.6); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * (0.6 + rnd() * 0.5)]); }
        wrapDraw(n, (ox, oy) => { x.beginPath(); pts.forEach((p, j) => { const px = cx + ox + p[0], py = cy + oy + p[1]; if (j) x.lineTo(px, py); else x.moveTo(px, py); }); x.closePath(); x.fill(); });
      }
    }
  }
  const PAT = {
    desert: (x, n, r) => { x.fillStyle = '#b99a6b'; x.fillRect(0, 0, n, n); blobs(x, n, r, ['#d8c393', '#8f7148', '#6b5233'], 9, 18, 46); },
    woodland: (x, n, r) => { x.fillStyle = '#4f5d35'; x.fillRect(0, 0, n, n); blobs(x, n, r, ['#8d8558', '#6b4a2b', '#1f211b'], 10, 16, 40); },
    urban: (x, n, r) => {
      const cols = ['#5d6166', '#7e8288', '#3e4246', '#a2a6ab'], s = n / 32;
      x.fillStyle = cols[0]; x.fillRect(0, 0, n, n);
      for (let k = 1; k < 4; k++) for (let i = 0; i < 26; i++) { const cx = Math.floor(r() * 32), cy = Math.floor(r() * 32); x.fillStyle = cols[k]; for (let j = 0; j < 7; j++) x.fillRect(((cx + Math.floor(r() * 4)) % 32) * s, ((cy + Math.floor(r() * 3)) % 32) * s, s, s); }
    },
    arctic: (x, n, r) => {
      x.fillStyle = '#e9eef3'; x.fillRect(0, 0, n, n);
      for (const col of ['#c3ccd6', '#8795a3', '#b1bdc9']) for (let i = 0; i < 12; i++) {
        const cx = r() * n, cy = r() * n, a = r() * 6.28, l = 30 + r() * 70, w = 6 + r() * 14;
        x.fillStyle = col;
        wrapDraw(n, (ox, oy) => { x.beginPath(); x.moveTo(cx + ox, cy + oy); x.lineTo(cx + ox + Math.cos(a) * l, cy + oy + Math.sin(a) * l); x.lineTo(cx + ox + Math.cos(a + 0.35) * l * 0.6 + w, cy + oy + Math.sin(a + 0.35) * l * 0.6); x.closePath(); x.fill(); });
      }
    },
    carbon: (x, n) => {
      const s = n / 16;
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        const g = x.createLinearGradient(i * s, j * s, (i + ((i + j) % 2 ? 1 : 0)) * s, (j + ((i + j) % 2 ? 0 : 1)) * s);
        g.addColorStop(0, '#0d0f12'); g.addColorStop(0.5, (i + j) % 2 ? '#2a3138' : '#1c2127'); g.addColorStop(1, '#0d0f12');
        x.fillStyle = g; x.fillRect(i * s, j * s, s, s);
      }
    },
    brushed: (x, n, r) => { x.fillStyle = '#1b3f8f'; x.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,170,255,0.08)' : 'rgba(0,10,40,0.12)'; x.fillRect(0, r() * n, n, 1 + r() * 2); } },
    tiger: (x, n, r) => {
      x.fillStyle = '#e8741c'; x.fillRect(0, 0, n, n);
      x.fillStyle = '#16110c';
      for (let i = 0; i < 14; i++) {
        const y = r() * n, w = 8 + r() * 14, l = n * (0.25 + r() * 0.35), x0 = r() * n;
        wrapDraw(n, (ox, oy) => { x.beginPath(); x.moveTo(x0 + ox, y + oy); x.quadraticCurveTo(x0 + ox + l * 0.5, y + oy - w * 2, x0 + ox + l, y + oy + w * 0.3); x.quadraticCurveTo(x0 + ox + l * 0.5, y + oy + w * 0.4, x0 + ox, y + oy + w); x.fill(); });
      }
    },
    redline: (x, n) => { x.fillStyle = '#131416'; x.fillRect(0, 0, n, n); x.strokeStyle = '#e0202a'; for (let i = -n; i < n * 2; i += n / 4) { x.lineWidth = 5; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + n / 2, n); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.moveTo(i + 14, 0); x.lineTo(i + 14 + n / 2, n); x.stroke(); } },
    pcb: (x, n) => { x.fillStyle = '#07140f'; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(30,70,50,0.6)'; for (let i = 0; i < n; i += 8) x.fillRect(i, 0, 1, n); },
    traces: (x, n, r) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, n, n); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 3; x.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        let px = Math.round(r() * 16) * n / 16, py = Math.round(r() * 16) * n / 16; x.beginPath(); x.moveTo(px, py);
        for (let j = 0; j < 4; j++) { if (r() < 0.5) px += (r() < 0.5 ? -1 : 1) * n / 8; else py += (r() < 0.5 ? -1 : 1) * n / 8; x.lineTo(px, py); }
        x.stroke(); x.beginPath(); x.arc(px, py, 5, 0, 6.3); x.fill();
      }
    },
    damascus: (x, n) => {
      const img = x.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const u = i / n * 6.283, v = j / n * 6.283;
        const f = Math.sin(v * 3 + Math.sin(u * 2) * 1.6 + Math.sin(u * 5 + v) * 0.5) * 0.5 + 0.5, b = Math.pow(Math.abs(Math.sin(f * 9.5)), 0.6);
        const c = 70 + b * 120, k = (j * n + i) * 4; img.data[k] = c; img.data[k + 1] = c * 1.02; img.data[k + 2] = c * 1.06; img.data[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    },
    white: (x, n) => { x.fillStyle = '#e8ecf2'; x.fillRect(0, 0, n, n); for (let i = 0; i < n; i += 4) { x.fillStyle = i % 8 ? 'rgba(255,255,255,0.3)' : 'rgba(180,190,210,0.25)'; x.fillRect(0, i, n, 2); } },
    ice: (x, n, r) => { x.fillStyle = '#6fb6e0'; x.fillRect(0, 0, n, n); blobs(x, n, r, ['#9ad2f2', '#4b8fc2', '#c9ecff'], 8, 20, 50); },
    cracks: (x, n, r) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, n, n); x.strokeStyle = '#fff'; x.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        let px = r() * n, py = r() * n; x.lineWidth = 1 + r() * 3.5;
        for (let j = 0; j < 7; j++) { const nx = px + (r() - 0.5) * 70, ny = py + (r() - 0.5) * 70; wrapDraw(n, (ox, oy) => { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(nx + ox, ny + oy); x.stroke(); }); px = nx; py = ny; x.lineWidth *= 0.8; }
      }
    },
    obsidian: (x, n, r) => { x.fillStyle = '#0c0a0a'; x.fillRect(0, 0, n, n); blobs(x, n, r, ['#1a1414', '#050404'], 10, 20, 50); },
    nebula: (x, n, r) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 40; i++) { const cx = r() * n, cy = r() * n, rr = 20 + r() * 70, hue = 250 + r() * 70; wrapDraw(n, (ox, oy) => { const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr); g.addColorStop(0, `hsla(${hue},90%,55%,0.35)`); g.addColorStop(1, 'hsla(0,0%,0%,0)'); x.fillStyle = g; x.fillRect(cx + ox - rr, cy + oy - rr, rr * 2, rr * 2); }); }
      for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; const s = r() < 0.9 ? 1 : 2; x.fillRect(r() * n, r() * n, s, s); }
    },
    scales: (x, n) => {
      const s = n / 8; x.fillStyle = '#0e3a2c'; x.fillRect(0, 0, n, n);
      for (let j = -1; j <= 8; j++) for (let i = -1; i <= 8; i++) {
        const cx = i * s + (j % 2 ? s / 2 : 0), cy = j * s * 0.7;
        const g = x.createRadialGradient(cx, cy - s * 0.2, s * 0.1, cx, cy, s * 0.62); g.addColorStop(0, '#2f9d6e'); g.addColorStop(0.8, '#11523b'); g.addColorStop(1, '#d8a93a');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, s * 0.6, 0, Math.PI); x.fill();
      }
    },
    gold: (x, n, r) => { const g = x.createLinearGradient(0, 0, n, n); g.addColorStop(0, '#f7d56a'); g.addColorStop(0.5, '#caa33a'); g.addColorStop(1, '#f2c950'); x.fillStyle = g; x.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,245,200,0.12)' : 'rgba(120,80,10,0.1)'; x.fillRect(0, r() * n, n, 1); } },
    // operative cloth / armour
    olive: (x, n, r) => { x.fillStyle = '#4a5334'; x.fillRect(0, 0, n, n); for (let i = 0; i < 2500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,220,0.05)'; x.fillRect(r() * n, r() * n, 2, 2); } },
    weave: (x, n, r) => { x.fillStyle = '#c9a060'; x.fillRect(0, 0, n, n); for (let i = 0; i < n; i += 6) { x.fillStyle = 'rgba(90,60,20,0.35)'; x.fillRect(i, 0, 2, n); x.fillRect(0, i + 3, n, 1); } },
    hazard: (x, n) => { x.fillStyle = '#e5c21c'; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(40,30,0,0.18)'; for (let i = 0; i < n; i += 16) x.fillRect(0, i, n, 3); },
    lacquer: (x, n, r) => { x.fillStyle = '#9c1b1b'; x.fillRect(0, 0, n, n); for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(255,200,200,0.05)'; x.fillRect(0, r() * n, n, 2 + r() * 6); } },
    stripes: (x, n) => { x.fillStyle = '#000'; x.fillRect(0, 0, n, n); for (let i = 0; i < 8; i++) { x.fillStyle = '#fff'; x.fillRect(0, i * n / 8, n, n / 40); x.fillRect(i * n / 8 + n / 16, 0, n / 60, n); } }
  };
  const tex = (key) => paint(key, key === 'damascus' ? 256 : 256, PAT[key]);

  // ------------------------------------------------------------ animated materials (shared clock; one line of GLSL each)
  K.time = { value: 0 };
  const SHADE = {
    pulse: 'totalEmissiveRadiance *= 0.35 + 0.65 * pow(0.5 + 0.5 * sin(vUv.x * 18.0 + vUv.y * 7.0 - uCfTime * 4.0), 3.0) + 0.25 * sin(uCfTime * 2.0);',
    flow: 'totalEmissiveRadiance *= 0.55 + 0.45 * sin(uCfTime * 2.3 + vUv.x * 9.0 + sin(vUv.y * 13.0 + uCfTime) * 1.5);',
    drift: 'totalEmissiveRadiance = emissive * texture2D(emissiveMap, vUv + vec2(uCfTime * 0.012, uCfTime * 0.007)).rgb;',
    irid: '{ float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition))); vec3 h = clamp(abs(mod(fr * 2.2 + uCfTime * 0.15 + vUv.x * 0.6 + vec3(0.0, 0.33, 0.67), 1.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0); totalEmissiveRadiance += h * (0.25 + fr * 0.9); }',
    shine: '{ float b = fract(vUv.x * 0.35 + vUv.y * 0.2 - uCfTime * 0.35); totalEmissiveRadiance += vec3(1.0, 0.85, 0.45) * pow(smoothstep(0.0, 0.06, b) * smoothstep(0.14, 0.06, b), 2.0) * 1.6; }',
    shimmer: '{ float b = fract(vUv.x * 0.5 - vUv.y * 0.3 - uCfTime * 0.22); totalEmissiveRadiance += vec3(1.0, 0.8, 0.3) * smoothstep(0.08, 0.0, abs(b - 0.5)) * 0.9; }',
    hue: '{ vec3 h = clamp(abs(mod(uCfTime * 0.12 + vUv.y * 0.5 + vec3(0.0, 0.33, 0.67), 1.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0); totalEmissiveRadiance = h * texture2D(emissiveMap, vUv).rgb * 2.2; }',
    ghost: 'totalEmissiveRadiance *= 0.7 + 0.3 * sin(uCfTime * 5.0 + vUv.y * 20.0) + 0.2 * step(0.97, fract(sin(floor(uCfTime * 12.0) * 43.1) * 91.7));'
  };
  function animate(m, kind) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uCfTime = K.time;
      sh.fragmentShader = 'uniform float uCfTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + SHADE[kind]);
    };
    m.customProgramCacheKey = () => 'cf-' + kind;
    return m;
  }
  /** m(spec): spec = { map, color, metal, rough, emap, emissive:[r,g,b], anim, transparent, opacity } */
  function mat(o) {
    const m = new THREE.MeshStandardMaterial({
      color: o.color != null ? o.color : 0xffffff, metalness: o.metal != null ? o.metal : 0.4, roughness: o.rough != null ? o.rough : 0.55,
      map: o.map ? tex(o.map) : null, envMapIntensity: o.env != null ? o.env : 0.8
    });
    if (o.emap || o.emissive) { m.emissive = new THREE.Color(...(o.emissive || [1, 1, 1])); if (o.emap) m.emissiveMap = tex(o.emap); }
    if (o.transparent) { m.transparent = true; m.opacity = o.opacity != null ? o.opacity : 0.6; m.depthWrite = false; }
    if (o.anim) animate(m, o.anim);
    return m;
  }

  // ------------------------------------------------------------ weapon finishes: body (receiver, stock, launcher tube), trim (grips, furniture), accent glow
  const FIN = {
    w_desert: { body: { map: 'desert', metal: 0.2, rough: 0.7 }, trim: { color: 0x5b4a33, metal: 0.1, rough: 0.8 }, accent: [2.2, 1.6, 0.6] },
    w_urban: { body: { map: 'urban', metal: 0.25, rough: 0.65 }, trim: { color: 0x2a2d31, metal: 0.1, rough: 0.8 }, accent: [1.6, 1.8, 2] },
    w_woodland: { body: { map: 'woodland', metal: 0.15, rough: 0.75 }, trim: { color: 0x2c3320, metal: 0.1, rough: 0.8 }, accent: [0.8, 2.4, 0.9] },
    w_arctic: { body: { map: 'arctic', metal: 0.2, rough: 0.6 }, trim: { color: 0xd9dee6, metal: 0.1, rough: 0.7 }, accent: [0.8, 2, 3] },
    w_carbon: { body: { map: 'carbon', metal: 0.55, rough: 0.28, env: 1.2 }, trim: { color: 0x101215, metal: 0.2, rough: 0.5 }, accent: [0.3, 1.6, 3.6] },
    w_cobalt: { body: { map: 'brushed', metal: 0.95, rough: 0.22, env: 1.3 }, trim: { color: 0x0e1c3c, metal: 0.6, rough: 0.35 }, accent: [0.5, 1.4, 4.2] },
    w_tiger: { body: { map: 'tiger', metal: 0.2, rough: 0.55 }, trim: { color: 0x17120d, metal: 0.1, rough: 0.7 }, accent: [4, 1.6, 0.3] },
    w_redline: { body: { map: 'redline', metal: 0.4, rough: 0.4 }, trim: { color: 0x0e0f10, metal: 0.2, rough: 0.6 }, accent: [4.5, 0.4, 0.4] },
    w_circuit: { body: { map: 'pcb', metal: 0.4, rough: 0.35, emap: 'traces', emissive: [0.2, 2.6, 2.2], anim: 'pulse' }, trim: { color: 0x061410, metal: 0.3, rough: 0.5 }, accent: [0.3, 3.6, 3] },
    w_damascus: { body: { map: 'damascus', metal: 0.95, rough: 0.3, env: 1.2 }, trim: { color: 0x2b1d14, metal: 0.1, rough: 0.6 }, accent: [2.6, 2.2, 1.6] },
    w_hologram: { body: { map: 'white', color: 0x9aa4b8, metal: 1, rough: 0.12, env: 1.4, emissive: [0, 0, 0], anim: 'irid' }, trim: { color: 0x1a1d24, metal: 0.8, rough: 0.2 }, accent: [2, 2.6, 3.6] },
    w_frostbite: { body: { map: 'ice', metal: 0.2, rough: 0.15, env: 1.4, emap: 'cracks', emissive: [0.4, 1.6, 2.6], anim: 'flow' }, trim: { color: 0xcfe8f7, metal: 0.1, rough: 0.3 }, accent: [0.5, 2.6, 4] },
    w_inferno: { body: { map: 'obsidian', metal: 0.3, rough: 0.35, emap: 'cracks', emissive: [4.5, 1.2, 0.15], anim: 'flow' }, trim: { color: 0x120c0a, metal: 0.2, rough: 0.5 }, accent: [5, 1.4, 0.2] },
    w_void: { body: { color: 0x05040a, metal: 0.4, rough: 0.08, env: 1.5, emap: 'nebula', emissive: [1.6, 1.3, 2], anim: 'drift' }, trim: { color: 0x0b0a14, metal: 0.4, rough: 0.2 }, accent: [2.2, 0.8, 4.2] },
    w_dragon: { body: { map: 'scales', metal: 0.5, rough: 0.35, env: 1.1, emissive: [0, 0, 0], anim: 'shimmer' }, trim: { color: 0x3a2a08, metal: 0.8, rough: 0.3 }, accent: [3.4, 2.6, 0.6] },
    w_champion: { body: { map: 'gold', color: 0xffe08a, metal: 0.8, rough: 0.2, env: 1.8, emissive: [0.32, 0.21, 0.04], anim: 'shine' }, trim: { color: 0x1d1608, metal: 0.7, rough: 0.3 }, accent: [5, 3.8, 1.2] }
  };
  const finCache = {};
  /** Materials for a weapon finish: { body, trim, accent } (null for the stock finish). */
  K.finish = function (id) {
    const f = FIN[id]; if (!f) return null;
    if (finCache[id]) return finCache[id];
    return (finCache[id] = { body: mat(f.body), trim: mat(f.trim), accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(...f.accent) }) });
  };

  /**
   * Prepare a gun (viewmodel or world model): give each part geometry UVs scaled by its size so patterns keep one
   * density on every part, and remember which role (body/trim/accent) each part plays. Stock materials are kept.
   */
  K.prepareGun = function (root, roles) {
    root.traverse((o) => {
      if (!o.isMesh || o.userData.skinRole !== undefined) return;
      let p = o.parent, hand = false; while (p && p !== root) { if (p.userData.hand) hand = true; p = p.parent; }
      const role = hand ? null : roles.get(o.material);
      o.userData.skinRole = role || null;
      if (!role) return;
      o.userData.stock = o.material;
      if (role === 'accent') return;
      const g = o.geometry.clone(), uv = g.attributes.uv; if (!uv) return;
      const sc = o.scale, isBox = g.type === 'BoxGeometry', D = 1 / 0.16; // one pattern tile per 16 cm
      for (let i = 0; i < uv.count; i++) {
        if (isBox) {
          const face = Math.floor(i / 4); // +x -x +y -y +z -z
          const su = face < 2 ? sc.z : sc.x, sv = face === 2 || face === 3 ? sc.z : sc.y;
          uv.setXY(i, uv.getX(i) * su * D, uv.getY(i) * sv * D);
        } else uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(sc.x, sc.z) * D, uv.getY(i) * sc.y * D);
      }
      o.geometry = g;
    });
  };
  K.applyFinish = function (root, id) {
    const f = K.finish(id);
    root.traverse((o) => {
      const r = o.isMesh && o.userData.skinRole; if (!r) return;
      o.material = f ? f[r] : o.userData.stock;
    });
  };

  // ------------------------------------------------------------ operative suits: suit (cloth), plate (armour), arms in first person, accessories
  const SUIT = {
    p_ranger: { suit: { map: 'olive', rough: 0.9, metal: 0 }, plate: { color: 0x7a6a48, metal: 0.1, rough: 0.8 }, sleeve: 0x4a5334, glove: 0x3b3326, acc: ['boonie'] },
    p_urban: { suit: { color: 0x2b2d31, rough: 0.85, metal: 0 }, plate: { color: 0x44484f, metal: 0.4, rough: 0.5 }, sleeve: 0x2b2d31, glove: 0x151618, acc: ['beanie', 'pack'] },
    p_sand: { suit: { map: 'desert', rough: 0.9, metal: 0 }, plate: { color: 0xa88a5e, metal: 0.1, rough: 0.8 }, sleeve: 0xb99a6b, glove: 0x6e5433, acc: ['shemagh', 'goggles'] },
    p_navy: { suit: { color: 0x1c2a4a, rough: 0.8, metal: 0 }, plate: { color: 0xe8eaee, metal: 0.2, rough: 0.5 }, sleeve: 0x1c2a4a, glove: 0xe8eaee, acc: ['cap'] },
    p_hazmat: { suit: { map: 'hazard', rough: 0.55, metal: 0 }, plate: { color: 0x2b2b2b, metal: 0.3, rough: 0.6 }, sleeve: 0xe5c21c, glove: 0x1d1d1d, acc: ['respirator', 'tank'] },
    p_arctic: { suit: { map: 'white', rough: 0.9, metal: 0 }, plate: { color: 0x9aa7b5, metal: 0.3, rough: 0.5 }, sleeve: 0xe8ecf2, glove: 0x5a6674, acc: ['hood', 'goggles'] },
    p_crimson: { suit: { color: 0x2a0c10, rough: 0.8, metal: 0 }, plate: { map: 'lacquer', metal: 0.5, rough: 0.25, env: 1.2 }, sleeve: 0x3a0d12, glove: 0x151515, acc: ['pauldrons'] },
    p_stealth: { suit: { color: 0x0d0f10, rough: 0.95, metal: 0 }, plate: { color: 0x16191b, metal: 0.4, rough: 0.6, emap: 'stripes', emissive: [0.1, 0.9, 0.3] }, sleeve: 0x0d0f10, glove: 0x0a0b0c, acc: ['stealthHood'] },
    p_oni: { suit: { color: 0x0d0c0c, rough: 0.5, metal: 0.2 }, plate: { color: 0x141112, metal: 0.6, rough: 0.2, env: 1.3 }, sleeve: 0x1a1616, glove: 0x7a0f14, acc: ['oni'] },
    p_chrome: { suit: { color: 0x2e3238, rough: 0.6, metal: 0.4 }, plate: { color: 0xf2f4f8, metal: 1, rough: 0.05, env: 1.8 }, sleeve: 0x8d949c, glove: 0xd9dde2, acc: ['crest'] },
    p_samurai: { suit: { color: 0x2d2a3f, rough: 0.85, metal: 0 }, plate: { color: 0x5b1b1b, metal: 0.3, rough: 0.35, env: 1.1 }, sleeve: 0x2d2a3f, glove: 0x3a2618, acc: ['kasa', 'sode'] },
    p_cyber: { suit: { color: 0x0b0914, rough: 0.5, metal: 0.3, emap: 'stripes', emissive: [1, 1, 1], anim: 'hue' }, plate: { color: 0x1b1630, metal: 0.7, rough: 0.2, env: 1.3 }, sleeve: 0x19122b, glove: 0xff2bd6, acc: ['mohawk', 'visor'] },
    p_phantom: { suit: { map: 'white', color: 0x6fe3ff, rough: 0.3, metal: 0, emissive: [0.3, 1.8, 2.6], transparent: true, opacity: 0.42, anim: 'ghost' }, plate: { map: 'white', color: 0xbff4ff, rough: 0.2, metal: 0, emissive: [0.6, 2.2, 3], transparent: true, opacity: 0.55, anim: 'ghost' }, sleeve: 0x4fb8d8, glove: 0x9fe8ff, acc: ['phantomHood', 'wisps'] },
    p_inferno: { suit: { map: 'obsidian', rough: 0.5, metal: 0.2, emap: 'cracks', emissive: [4.5, 1.1, 0.1], anim: 'flow' }, plate: { color: 0x1a1210, metal: 0.4, rough: 0.35, emap: 'cracks', emissive: [3.2, 0.8, 0.05], anim: 'flow' }, sleeve: 0x1c1311, glove: 0x2a130b, acc: ['flames'] },
    p_mech: { suit: { color: 0x22262c, rough: 0.6, metal: 0.5 }, plate: { color: 0x5c6470, metal: 0.8, rough: 0.28, env: 1.3 }, sleeve: 0x3a4048, glove: 0x22262c, acc: ['mechShoulders', 'reactor', 'antenna'] },
    p_champion: { suit: { color: 0x1a1408, rough: 0.5, metal: 0.4 }, plate: { map: 'gold', color: 0xffe08a, metal: 0.8, rough: 0.2, env: 1.8, emissive: [0.32, 0.21, 0.04], anim: 'shine' }, sleeve: 0x2a1f0a, glove: 0xd9b24a, acc: ['crown', 'cape'] }
  };
  const suitCache = {};
  K.suit = function (id) {
    const s = SUIT[id]; if (!s) return null;
    if (suitCache[id]) return suitCache[id];
    return (suitCache[id] = { suit: mat(s.suit), plate: mat(s.plate), def: s });
  };
  const accMats = {};
  const am = (key, o) => accMats[key] || (accMats[key] = mat(o));
  const glowMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

  /** Accessory meshes for a suit, attached to the operative model's parts (p.head, p.torso). Returns anim hooks. */
  const G = {};
  const geo = (k, make) => G[k] || (G[k] = make());
  const box = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
  const cyl = () => geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 16));
  const cone = () => geo('cone', () => new THREE.ConeGeometry(1, 1, 12));
  const sph = () => geo('sph', () => new THREE.SphereGeometry(1, 14, 10));
  const tor = () => geo('tor', () => new THREE.TorusGeometry(1, 0.12, 8, 28));
  function add(par, g, m, x, y, z, sx, sy, sz, rx, ry, rz) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; par.add(o); return o; }
  const ACC = {
    boonie: (p) => { const m = am('boonie', { color: 0x5a6340, rough: 0.9, metal: 0 }); add(p.head, cyl(), m, 0, 0.21, 0, 0.13, 0.08, 0.13); add(p.head, cyl(), m, 0, 0.17, 0, 0.24, 0.015, 0.24); },
    beanie: (p) => { const m = am('beanie', { color: 0x1c1d20, rough: 0.95, metal: 0 }); add(p.head, sph(), m, 0, 0.17, 0.01, 0.125, 0.1, 0.13); },
    pack: (p) => { const m = am('pack', { color: 0x30343a, rough: 0.85, metal: 0 }); add(p.torso, box(), m, 0, 0.26, 0.2, 0.32, 0.36, 0.14); add(p.torso, box(), m, 0, 0.46, 0.2, 0.26, 0.1, 0.16); },
    shemagh: (p) => { const m = am('shemagh', { color: 0xcbb690, rough: 0.95, metal: 0 }); add(p.head, tor(), m, 0, -0.04, 0, 0.14, 0.14, 0.2, Math.PI / 2); add(p.head, box(), m, 0, 0.02, -0.11, 0.2, 0.08, 0.04); },
    goggles: (p) => { const m = am('goggle', { color: 0x1a2a33, metal: 0.9, rough: 0.05, env: 1.6 }); add(p.head, box(), m, 0, 0.14, -0.125, 0.2, 0.06, 0.03); add(p.head, box(), am('strap', { color: 0x222222, rough: 0.8 }), 0, 0.14, 0, 0.22, 0.03, 0.25); },
    cap: (p) => { const m = am('cap', { color: 0x1c2a4a, rough: 0.7, metal: 0 }); add(p.head, cyl(), m, 0, 0.21, 0, 0.12, 0.06, 0.13); add(p.head, box(), am('capBill', { color: 0x111111, rough: 0.5, metal: 0.2 }), 0, 0.19, -0.14, 0.2, 0.015, 0.09); add(p.head, box(), glowMat(3, 2.6, 1.2), 0, 0.225, -0.126, 0.05, 0.03, 0.01); },
    respirator: (p) => { const m = am('resp', { color: 0x1d1d1d, rough: 0.6, metal: 0.3 }); add(p.head, box(), m, 0, 0.03, -0.13, 0.14, 0.1, 0.06); for (const s of [-1, 1]) add(p.head, cyl(), m, s * 0.09, 0.0, -0.15, 0.04, 0.05, 0.04, Math.PI / 2, 0, s * 0.4); add(p.head, box(), am('respGlass', { color: 0x2a3a40, metal: 0.9, rough: 0.05, env: 1.6 }), 0, 0.13, -0.125, 0.18, 0.08, 0.02); },
    tank: (p) => { const m = am('tank', { color: 0xd8dcdf, metal: 0.8, rough: 0.25 }); add(p.torso, cyl(), m, 0, 0.3, 0.2, 0.09, 0.44, 0.09); add(p.torso, sph(), m, 0, 0.52, 0.2, 0.09, 0.05, 0.09); add(p.torso, box(), am('tankBand', { color: 0xe5c21c, rough: 0.6 }), 0, 0.3, 0.2, 0.19, 0.04, 0.19); },
    hood: (p) => { const m = am('fur', { color: 0xe7e2d8, rough: 1, metal: 0 }); add(p.head, sph(), am('parka', { color: 0xeef1f5, rough: 0.9 }), 0, 0.1, 0.02, 0.15, 0.17, 0.16); add(p.head, tor(), m, 0, 0.08, -0.08, 0.15, 0.17, 0.3, 0.2); },
    pauldrons: (p) => { const m = SUITPLATE(p); for (const s of [-1, 1]) add(p.torso, sph(), m, s * 0.28, 0.5, 0, 0.15, 0.09, 0.15, 0, 0, s * 0.3); },
    stealthHood: (p) => { add(p.head, sph(), am('shood', { color: 0x0a0b0c, rough: 1, metal: 0 }), 0, 0.12, 0.02, 0.15, 0.17, 0.16); add(p.head, sph(), glowMat(0.4, 4, 1), 0.05, 0.11, -0.13, 0.03, 0.03, 0.02); },
    oni: (p) => {
      const red = am('oniRed', { map: 'lacquer', metal: 0.4, rough: 0.2, env: 1.2 }), horn = am('horn', { color: 0xe8dcc0, rough: 0.4, metal: 0.1 });
      add(p.head, box(), red, 0, 0.07, -0.13, 0.2, 0.2, 0.04);
      for (const s of [-1, 1]) { add(p.head, cone(), horn, s * 0.08, 0.28, -0.02, 0.035, 0.18, 0.035, 0, 0, -s * 0.35); add(p.head, box(), glowMat(5, 0.6, 0.2), s * 0.045, 0.1, -0.152, 0.04, 0.015, 0.01); }
      add(p.head, box(), am('teeth', { color: 0xf0ead8, rough: 0.4 }), 0, 0.0, -0.152, 0.1, 0.02, 0.01);
    },
    crest: (p) => { add(p.head, box(), am('crest', { color: 0xf2f4f8, metal: 1, rough: 0.05, env: 1.8 }), 0, 0.24, 0.02, 0.02, 0.1, 0.28); },
    kasa: (p) => { add(p.head, cone(), am('kasa', { map: 'weave', rough: 0.9, metal: 0 }), 0, 0.28, 0, 0.36, 0.14, 0.36); },
    sode: (p) => { const m = SUITPLATE(p); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(p.torso, box(), m, s * (0.3 + i * 0.012), 0.5 - i * 0.07, 0, 0.1, 0.02, 0.2, 0, 0, s * (0.35 + i * 0.05)); },
    mohawk: (p, hooks) => { const m = glowMat(4, 0.5, 3.2); for (let i = 0; i < 5; i++) add(p.head, box(), m, 0, 0.22 + Math.sin(i / 4 * Math.PI) * 0.04, -0.09 + i * 0.045, 0.015, 0.08 + Math.sin(i / 4 * Math.PI) * 0.05, 0.035); hooks.push((t) => m.color.setHSL((t * 0.12) % 1, 1, 0.5).multiplyScalar(3)); },
    visor: (p, hooks) => { const m = glowMat(0.4, 3.5, 4); add(p.head, box(), m, 0, 0.11, -0.125, 0.2, 0.05, 0.015); hooks.push((t) => m.color.setHSL((t * 0.12 + 0.5) % 1, 1, 0.5).multiplyScalar(3.5)); },
    phantomHood: (p) => { add(p.head, sph(), am('phood', { map: 'white', color: 0x9feaff, emissive: [0.4, 2, 2.8], transparent: true, opacity: 0.45, anim: 'ghost' }), 0, 0.11, 0.02, 0.155, 0.18, 0.165); add(p.head, sph(), glowMat(1, 5, 6), 0, 0.1, -0.13, 0.08, 0.02, 0.02); },
    wisps: (p, hooks) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 3.2), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      const ws = []; for (let i = 0; i < 6; i++) ws.push(add(p.hips, sph(), m, 0, 0, 0, 0.05, 0.05, 0.05));
      hooks.push((t) => ws.forEach((w, i) => { const a = t * 1.6 + i * 1.05, h = ((t * 0.5 + i / 6) % 1); w.position.set(Math.cos(a) * 0.32, -0.6 + h * 1.9, Math.sin(a) * 0.32); w.scale.setScalar(0.06 * (1 - h) + 0.01); }));
    },
    flames: (p, hooks) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 1.8, 0.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const fs = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; fs.push(add(p.head, cone(), m, Math.cos(a) * 0.1, 0.26, Math.sin(a) * 0.1, 0.04, 0.16, 0.04)); }
      hooks.push((t) => fs.forEach((f, i) => { const k = 0.7 + 0.5 * Math.abs(Math.sin(t * 9 + i * 1.7)); f.scale.set(0.04, 0.16 * k, 0.04); f.position.y = 0.24 + 0.08 * k * 0.5; }));
    },
    mechShoulders: (p) => { const m = SUITPLATE(p); for (const s of [-1, 1]) { add(p.torso, box(), m, s * 0.3, 0.52, 0, 0.2, 0.16, 0.26, 0, 0, s * 0.15); add(p.torso, box(), glowMat(0.4, 2.5, 4), s * 0.38, 0.52, -0.1, 0.02, 0.06, 0.08); } },
    reactor: (p, hooks) => { add(p.torso, box(), SUITPLATE(p), 0, 0.3, 0.2, 0.3, 0.34, 0.12); const m = glowMat(0.5, 3, 4.5); const c = add(p.torso, cyl(), m, 0, 0.3, 0.27, 0.08, 0.02, 0.08, Math.PI / 2); hooks.push((t) => { c.scale.setScalar(0.08 + Math.sin(t * 6) * 0.01); c.scale.y = 0.02; }); },
    antenna: (p) => { add(p.torso, cyl(), am('ant', { color: 0x333333, metal: 0.8, rough: 0.3 }), 0.12, 0.8, 0.2, 0.008, 0.5, 0.008); add(p.torso, sph(), glowMat(5, 0.4, 0.3), 0.12, 1.06, 0.2, 0.02, 0.02, 0.02); },
    crown: (p) => {
      const g = am('crownGold', { map: 'gold', color: 0xffe08a, metal: 0.8, rough: 0.2, env: 1.8, emissive: [0.32, 0.21, 0.04], anim: 'shine' });
      add(p.head, cyl(), g, 0, 0.24, 0, 0.13, 0.05, 0.13);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(p.head, cone(), g, Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12, 0.03, 0.08, 0.03); add(p.head, sph(), glowMat(i % 2 ? 4 : 0.5, i % 2 ? 0.4 : 1.5, i % 2 ? 0.5 : 5), Math.cos(a) * 0.132, 0.245, Math.sin(a) * 0.132, 0.018, 0.018, 0.018); }
    },
    cape: (p, hooks) => {
      const m = am('cape', { color: 0x8a1420, rough: 0.7, metal: 0 }); m.side = THREE.DoubleSide;
      const c = new THREE.Group(); c.position.set(0, 0.52, 0.15); p.torso.add(c);
      const cl = add(c, box(), m, 0, -0.45, 0.02, 0.44, 0.9, 0.02);
      add(c, box(), am('capeTrim', { map: 'gold', color: 0xffe08a, metal: 1, rough: 0.2 }), 0, -0.9, 0.02, 0.45, 0.04, 0.025);
      hooks.push((t, sp) => { c.rotation.x = 0.12 + Math.min(0.6, (sp || 0) * 0.08) + Math.sin(t * 3) * 0.04; cl.scale.x = 0.44 + Math.sin(t * 2.3) * 0.01; });
    }
  };
  function SUITPLATE(p) { return p.__plate; }

  /**
   * Dress an operative model (built by mp.js) in a suit. model: { root, p, suitMeshes, plateMeshes, acc }.
   * Accessories are rebuilt, materials swapped; model.hooks animate the lively ones.
   */
  K.dress = function (model, id) {
    const s = K.suit(id), p = model.p;
    if (model.acc) { for (const o of model.acc) o.parent && o.parent.remove(o); }
    model.acc = []; model.hooks = [];
    for (const m of model.suitMeshes) m.material = s ? s.suit : model.stockSuit;
    for (const m of model.plateMeshes) m.material = s ? s.plate : model.stockPlate;
    if (!s) return;
    p.__plate = s.plate;
    const before = new Set(); for (const k in p) if (p[k] && p[k].isObject3D) p[k].children.forEach((c) => before.add(c));
    for (const a of s.def.acc) ACC[a](p, model.hooks);
    for (const k in p) if (p[k] && p[k].isObject3D) for (const c of p[k].children) if (!before.has(c)) model.acc.push(c);
    delete p.__plate;
  };

  /** Champion crown-holder extras: a halo and a light trail that follows the player (only while they hold #1). */
  K.championAura = function (model, on) {
    if (!!model.aura === !!on) return;
    if (!on) { model.aura.halo.parent.remove(model.aura.halo); for (const s of model.aura.trail) s.parent && s.parent.remove(s); model.aura = null; return; }
    const halo = new THREE.Mesh(tor(), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.8, 1.2) }));
    halo.scale.set(0.2, 0.2, 0.5); halo.rotation.x = Math.PI / 2; halo.position.y = 0.34; model.p.head.add(halo);
    const tm = new THREE.SpriteMaterial({ map: CF.Tex.list.glow || null, color: new THREE.Color(3, 2.2, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const trail = [];
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(tm.clone()); s.scale.setScalar(0.3); s.visible = false; trail.push(s); }
    model.aura = { halo, trail, pts: [], t: 0 };
  };
  /** Per-frame animation of one dressed model. pos: world position (for the trail), speed m/s. */
  K.animateModel = function (model, t, pos, speed, scene) {
    if (model.hooks) for (const h of model.hooks) h(t, speed);
    const a = model.aura; if (!a) return;
    a.halo.rotation.z = t * 1.5; a.halo.position.y = 0.34 + Math.sin(t * 2.4) * 0.02;
    a.t += 1 / 60;
    if (pos && a.t > 0.05) { a.t = 0; a.pts.unshift(pos.clone().setY(pos.y + 1.0)); if (a.pts.length > a.trail.length) a.pts.pop(); }
    a.trail.forEach((s, i) => {
      if (!s.parent && scene) scene.add(s);
      const q = a.pts[i]; s.visible = !!q && speed > 0.5; if (!q) return;
      s.position.copy(q); const k = 1 - i / a.trail.length; s.scale.setScalar(0.35 * k + 0.05); s.material.opacity = 0.55 * k;
    });
  };

  /**
   * Put a real weapon model (with a finish) in an operative's hands, replacing the placeholder gun.
   * model.p.gun is the hands' anchor (points -Z). Cached per weapon on the model.
   */
  const ARM = { carbine: [0.85, 0.12], shotgun: [0.85, 0.12], rail: [0.8, 0.14], pistol: [1.1, -0.02], rocket: [0.8, 0.16], minigun: [0.8, 0.2], satchel: [1.2, 0], revolver: [1.15, -0.02] };
  K.arm = function (model, weaponId, finishId) {
    const g = model.p.gun; if (!g || !CF.VM || !ARM[weaponId]) return;
    if (!model.guns) { model.guns = {}; model.placeholder = g.children.slice(); }
    for (const c of model.placeholder) c.visible = false;
    for (const id in model.guns) model.guns[id].root.visible = id === weaponId;
    let v = model.guns[weaponId];
    if (!v) {
      v = model.guns[weaponId] = CF.VM.build(weaponId, false);
      const a = ARM[weaponId]; v.root.scale.setScalar(a[0]); v.root.position.set(0, -0.02, a[1]);
      v.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = true; } });
      g.add(v.root);
    }
    if (v.finish !== finishId) { K.applyFinish(v.root, finishId); v.finish = finishId; }
    model.armed = weaponId;
  };

  // ------------------------------------------------------------ this player's cosmetics
  /** First-person arms wear the suit's colours; every viewmodel wears the weapon finish. Called when equips change. */
  K.applyLocal = function () {
    const P = CF.Profile; if (!P || !CF.VM || !CF.Weapons || !CF.Weapons.vm) return;
    const w = P.equipped('w'), p = P.equipped('p');
    if (K.lastW !== w) { K.lastW = w; for (const id in CF.Weapons.vm) K.applyFinish(CF.Weapons.vm[id].root, w); }
    if (K.lastP !== p) { K.lastP = p; CF.VM.setArms(p ? SUIT[p] : null); }
  };
  K.tick = function (t) { K.time.value = t; };
})(window.CF);
