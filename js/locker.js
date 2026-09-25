'use strict';
/* Cinderfall — Locker & Shop: browse and equip operative suits and weapon finishes on a live 3D showroom, buy crates
   with coins and open them on a spinning reel, and manage the save code that carries a profile to another device. */
(function (CF) {
  const U = CF.U, K = CF.Skins, A = CF.Audio;
  const $ = (id) => document.getElementById(id);
  const LK = CF.Locker = { tab: 'p', sel: null, active: false, thumbs: {}, spinning: false };

  // ------------------------------------------------------------ showroom (rendered by the main loop while the locker is open)
  let ENV = null;
  /** A dim studio environment for reflections: dark walls, a few soft coloured light panels. */
  function studioEnv() {
    if (ENV) return ENV;
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.03, 0.045), side: THREE.BackSide })));
    const panel = (c, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    panel([1.6, 1.5, 1.4], -6, 8, 8, 8, 4); panel([0.3, 1.4, 1.8], 9, 3, -6, 3, 8); panel([1.6, 0.3, 1.3], -9, 2, -6, 3, 8); panel([0.5, 0.5, 0.6], 0, -6, 0, 20, 20);
    const pm = new THREE.PMREMGenerator(CF.Post.renderer);
    ENV = pm.fromScene(env, 0.04).texture; pm.dispose();
    return ENV;
  }
  function buildShowroom() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0.012, 0.012, 0.02);
    scene.fog = new THREE.FogExp2(new THREE.Color(0.012, 0.012, 0.02), 0.06);
    scene.add(new THREE.HemisphereLight(0x8898c8, 0x201818, 0.32));
    const key = new THREE.DirectionalLight(0xfff0e0, 0.5); key.position.set(-2, 4, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 }); key.shadow.bias = -0.0005;
    scene.add(key); scene.add(key.target);
    const rimA = new THREE.PointLight(0x37f3ff, 1.0, 8, 2); rimA.position.set(2.2, 2.2, -1.6); scene.add(rimA);
    const rimB = new THREE.PointLight(0xff2bd6, 0.8, 8, 2); rimB.position.set(-2.4, 1.6, -1.8); scene.add(rimB);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x14151c, metalness: 0.6, roughness: 0.35 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.16, 48), floorMat); plat.position.y = -0.08; plat.receiveShadow = true; scene.add(plat);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2, 2.6) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.018, 8, 96), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.005; scene.add(ring);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x07070b, metalness: 0.3, roughness: 0.8 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.16; ground.receiveShadow = true; scene.add(ground);
    const model = CF.MP.buildOperative([0.35, 3.1, 4.2]);
    model.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const p = model.p;
    p.armR.rotation.set(-1.25, 0, 0.1); p.foreR.rotation.x = -0.5; p.armL.rotation.set(-1.35, 0.35, -0.4); p.foreL.rotation.x = -0.9;
    scene.add(model.root);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    scene.environment = studioEnv();
    return { scene, cam, model, ring, ringMat, key, yaw: Math.PI - 0.55, spin: 0, drag: null, zoom: 0 };
  }
  let S = null;
  LK.showroom = () => S || (S = buildShowroom());

  /** Show a suit and a finish in the showroom. */
  function preview(p, w) {
    const s = LK.showroom();
    if (s.p !== p) { K.dress(s.model, p); K.championAura(s.model, p === 'p_champion'); s.p = p; s.model.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
    if (s.w !== w || !s.model.armed) {
      K.arm(s.model, 'carbine', w); s.w = w;
      if (!s.big) { s.big = CF.VM.build('carbine', false); s.big.root.scale.setScalar(1.55); s.big.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); s.bigPivot = new THREE.Group(); s.bigPivot.position.set(0, 1.2, 0.2); s.bigPivot.add(s.big.root); s.big.root.position.set(0, -0.05, 0.42); s.scene.add(s.bigPivot); }
      K.applyFinish(s.big.root, w);
    }
    const sel = LK.sel && K.get(LK.sel), rar = K.RARITY[sel ? sel.rarity : 'common'].rgb;
    s.ringMat.color.setRGB(rar[0] * 3, rar[1] * 3, rar[2] * 3);
  }
  LK.render = function (dt) {
    const s = LK.showroom(), G = CF.Game;
    if (!s.drag) s.yaw += dt * 0.25;
    s.model.root.rotation.y = s.yaw;
    // weapon finishes: a big rifle turning on the stand instead of the operative
    const wt = LK.tab === 'w';
    s.model.root.visible = !wt;
    if (s.bigPivot) { s.bigPivot.visible = wt; s.bigPivot.rotation.set(0.12, s.yaw + Math.PI / 2, 0); s.bigPivot.position.y = 1.2 + Math.sin(CF.realTime * 1.2) * 0.04; }
    K.animateModel(s.model, CF.realTime, null, 0, s.scene);
    // frame the model in the part of the screen the panel leaves open; weapon finishes get a closer look
    const w = window.innerWidth, h = window.innerHeight, wide = w > 900;
    s.zoom = U.damp(s.zoom, LK.tab === 'w' ? 1 : 0, 5, dt);
    s.cam.aspect = w / h;
    const back = wide ? 0 : 2.2 + Math.max(0, 1 - w / h) * 3; // narrow screens: the panel takes the lower half
    s.cam.position.set(0, U.lerp(1.15, 1.5, s.zoom), U.lerp(5.6, 4.2, s.zoom) + back);
    s.cam.lookAt(0, U.lerp(0.98, 1.15, s.zoom), 0);
    if (wide) s.cam.setViewOffset(w, h, -w * 0.2, 0, w, h); else s.cam.setViewOffset(w, h, 0, h * 0.3, w, h);
    s.cam.updateProjectionMatrix();
    CF.Post.render(s.scene, s.cam, null, null);
  };

  // ------------------------------------------------------------ thumbnails (offscreen render → tone map → image)
  let TH = null;
  function thumbRig() {
    if (TH) return TH;
    const r = CF.Post.renderer, N = 192;
    const hdr = new THREE.WebGLRenderTarget(N, N, { type: CF.Post.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: CF.Post.isGL2 ? 4 : 0 });
    const ldr = new THREE.WebGLRenderTarget(N, N, { type: THREE.UnsignedByteType });
    const tone = new THREE.ShaderMaterial({
      uniforms: { t: { value: hdr.texture } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); } void main(){ vec3 c = aces(texture2D(t, vUv).rgb * 1.1); c = pow(c, vec3(1.0/2.2)); gl_FragColor = vec4(c, 1.0); }'
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const q = new THREE.Scene(), quad = new THREE.Mesh(g, tone); quad.frustumCulled = false; q.add(quad);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0.02, 0.02, 0.035);
    scene.add(new THREE.HemisphereLight(0x9aa8d8, 0x201818, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(-1, 2, 3); scene.add(key);
    const rim = new THREE.PointLight(0x37f3ff, 1, 6, 2); rim.position.set(1.5, 1.8, -1.2); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 30);
    const model = CF.MP.buildOperative([0.35, 3.1, 4.2]);
    model.p.armR.rotation.set(-1.2, 0, 0.1); model.p.foreR.rotation.x = -0.5; model.p.armL.rotation.set(-1.3, 0.35, -0.4); model.p.foreL.rotation.x = -0.9;
    const gun = CF.VM.build('carbine', false);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = N;
    return (TH = { r, N, hdr, ldr, q, scene, cam, model, gun, canvas, px: new Uint8Array(N * N * 4) });
  }
  /** A small picture of a skin (data URL), rendered once and cached. */
  LK.thumb = function (id) {
    if (LK.thumbs[id]) return LK.thumbs[id];
    const s = K.get(id); if (!s) return '';
    const T = thumbRig(), r = T.r, N = T.N;
    T.scene.environment = studioEnv();
    T.scene.remove(T.model.root); T.scene.remove(T.gun.root);
    if (s.slot === 'w') {
      K.applyFinish(T.gun.root, id); T.scene.add(T.gun.root);
      T.gun.root.position.set(0, 0, 0); T.gun.root.rotation.set(0.15, Math.PI / 2 + 0.55, 0); T.gun.root.scale.setScalar(1);
      T.cam.position.set(0.02, 0.14, 1.05); T.cam.lookAt(0, 0.04, -0.3 * 0);
      T.gun.root.position.set(-0.12, 0, -0.15);
    } else {
      K.dress(T.model, id); K.championAura(T.model, false); K.arm(T.model, 'carbine', null); T.scene.add(T.model.root);
      T.model.root.rotation.set(0, Math.PI - 0.5, 0);
      K.animateModel(T.model, 0.4, null, 0, T.scene);
      T.cam.position.set(0, 1.45, 2.2); T.cam.lookAt(0, 1.18, 0);
    }
    T.cam.updateMatrixWorld();
    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(T.hdr); r.clear(true, true, false); r.render(T.scene, T.cam);
    r.setRenderTarget(T.ldr); r.render(T.q, CF.Post.qCam);
    r.readRenderTargetPixels(T.ldr, 0, 0, N, N, T.px);
    r.setRenderTarget(prevTarget);
    const ctx = T.canvas.getContext('2d'), img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) img.data.set(T.px.subarray((N - 1 - y) * N * 4, (N - y) * N * 4), y * N * 4); // flip rows
    ctx.putImageData(img, 0, 0);
    return (LK.thumbs[id] = T.canvas.toDataURL('image/png'));
  };

  // ------------------------------------------------------------ screen
  LK.open = function () {
    LK.active = true;
    if (!LK.sel) LK.sel = CF.Profile.equipped(LK.tab === 'w' ? 'w' : 'p');
    LK.prevPost = true;
    CF.Post.setState({ exposure: 1.25, bloom: 0.5, threshold: 1.1, sat: 1.05, shadow: [0, 0, 0], high: [0, 0, 0], fade: 1, hurt: 0, low: 0, suppress: 0 });
    LK.render_();
  };
  LK.close = function () {
    LK.active = false;
    const G = CF.Game; if (G.mapDef) CF.Post.setState(G.mapDef.theme.post);
    if (S) S.cam.clearViewOffset();
  };
  LK.setTab = function (t) { LK.tab = t; if (t !== 'shop') LK.sel = CF.Profile.equipped(t) || (K.list.find((s) => s.slot === t && CF.Profile.owns(s.id)) || {}).id || null; LK.render_(); };
  LK.select = function (id) { LK.sel = id; LK.render_(); };
  const rarityOrder = (s) => K.RARITY[s.rarity].weight;

  LK.render_ = function () {
    const Pr = CF.Profile;
    for (const b of document.querySelectorAll('[data-ltab]')) b.setAttribute('aria-selected', String(b.dataset.ltab === LK.tab));
    const list = $('lockerList'); list.textContent = '';
    const shop = LK.tab === 'shop';
    $('lockerInfo').hidden = shop; $('shopInfo').hidden = !shop;
    const why = Pr.blocked();
    $('lockerStatus').textContent = why || (Pr.mode === 'local' ? 'Offline mode: coins and skins are saved in this browser.' : '');
    if (shop) { LK.renderShop(list); preview(Pr.equipped('p'), Pr.equipped('w')); return; }
    const items = K.list.filter((s) => s.slot === LK.tab).sort((a, b) => (Pr.owns(b.id) - Pr.owns(a.id)) || (rarityOrder(b) - rarityOrder(a)));
    // stock option first
    const stock = { id: null, slot: LK.tab, rarity: 'common', name: LK.tab === 'p' ? 'Standard issue' : 'Factory finish', desc: LK.tab === 'p' ? 'The operative kit everyone deploys in.' : 'Parkerized steel and black polymer.' };
    for (const s of [stock].concat(items)) {
      const owned = s.id === null || Pr.owns(s.id), eq = Pr.equipped(LK.tab) === s.id, R = K.RARITY[s.rarity];
      const b = document.createElement('button'); b.className = 'lk-tile rar-' + s.rarity + (owned ? '' : ' locked') + (eq ? ' equipped' : '') + (LK.sel === s.id ? ' sel' : '');
      b.style.setProperty('--rar', R.css);
      const img = document.createElement('span'); img.className = 'lk-img';
      if (s.id) { const src = LK.thumb(s.id); if (src) img.style.backgroundImage = 'url(' + src + ')'; } else img.classList.add('stock');
      const nm = document.createElement('b'); nm.textContent = s.name;
      const rr = document.createElement('i'); rr.textContent = eq ? 'Equipped' : owned ? R.label : (s.rarity === 'champion' ? 'Reach #1' : 'In crates');
      b.append(img, nm, rr);
      b.addEventListener('click', () => { A.play('uiClick', null, { ui: true }); LK.select(s.id); });
      list.appendChild(b);
    }
    const s = K.get(LK.sel) || stock, owned = LK.sel === null || Pr.owns(LK.sel), eq = Pr.equipped(LK.tab) === LK.sel;
    const R = K.RARITY[s.rarity];
    $('lpRarity').textContent = s.id ? R.label + (s.slot === 'w' ? ' weapon finish' : ' operative suit') : 'Stock';
    $('lpRarity').style.color = R.css;
    $('lpName').textContent = s.name; $('lpDesc').textContent = s.desc;
    const btn = $('lpEquip');
    btn.disabled = !owned || eq || !!why && Pr.mode === 'server';
    btn.textContent = eq ? 'Equipped' : owned ? 'Equip' : s.rarity === 'champion' ? 'Reach #1 on a leaderboard' : 'Find it in a crate';
    $('lpNote').textContent = s.rarity === 'champion' && !owned ? 'Awarded by the server when one of your campaign runs takes #1 on a board with 5 or more players. While you hold #1, a crown halo and light trail show on you in multiplayer.' : '';
    preview(LK.tab === 'p' ? LK.sel : Pr.equipped('p'), LK.tab === 'w' ? LK.sel : Pr.equipped('w'));
    LK.renderCode();
  };
  LK.equip = function () {
    const slot = LK.tab, id = LK.sel;
    $('lpEquip').disabled = true;
    CF.Profile.equip(slot, id).then(() => { A.play('weaponGet', null, { ui: true }); LK.render_(); })
      .catch((e) => { $('lockerStatus').textContent = e.message; LK.render_(); });
  };

  // ------------------------------------------------------------ save code
  LK.renderCode = function () {
    const Pr = CF.Profile, box = $('saveCode');
    box.hidden = Pr.mode !== 'server';
    if (Pr.mode !== 'server') return;
    $('saveCodeValue').textContent = Pr.saveCode() || '—';
  };
  LK.copyCode = function () {
    const c = CF.Profile.saveCode(); if (!c) return;
    const done = () => CF.Toast('Save code copied', 'info', c);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c).then(done, done); else done();
  };
  LK.useCode = async function () {
    const code = $('saveCodeInput').value.trim(); if (!code) { $('saveCodeInput').focus(); return; }
    if (code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === (CF.Profile.saveCode() || '').replace('-', '')) { CF.Toast('That is this device\'s code already', 'info'); return; }
    if (!(await CF.UI.confirm('Load this save?', 'This device will switch to the profile with code ' + code.toUpperCase() + ': its coins, skins and campaign progress. Write down this device\'s current code (' + (CF.Profile.saveCode() || '—') + ') if you want to come back to it.', 'Load save'))) return;
    try { await CF.Profile.restore(code); $('saveCodeInput').value = ''; CF.Toast('Save loaded', 'info', CF.Profile.coins().toLocaleString('en-US') + ' coins · ' + CF.Profile.data.skins.length + ' skins'); LK.sel = CF.Profile.equipped(LK.tab === 'w' ? 'w' : 'p'); LK.render_(); }
    catch (e) { CF.Toast('Could not load that save', 'error', e.message); }
  };

  // ------------------------------------------------------------ shop and crates
  LK.renderShop = function (list) {
    const Pr = CF.Profile;
    for (const k of ['field', 'elite']) {
      const c = K.CRATES[k], can = Pr.coins() >= c.price && !Pr.blocked();
      const card = document.createElement('div'); card.className = 'crate-card crate-' + k;
      const art = document.createElement('div'); art.className = 'crate-art'; art.innerHTML = '<i class="cr-lid"></i><i class="cr-box"></i><i class="cr-band"></i><i class="cr-glow"></i>';
      const nm = document.createElement('b'); nm.textContent = c.name;
      const ds = document.createElement('span'); ds.className = 'crate-desc'; ds.textContent = c.desc;
      const odds = document.createElement('div'); odds.className = 'crate-odds';
      for (const [r, w] of c.odds) { const o = document.createElement('span'); o.style.color = K.RARITY[r].css; o.textContent = K.RARITY[r].label + ' ' + Math.round(w * 100) + '%'; odds.appendChild(o); }
      const btn = document.createElement('button'); btn.className = 'btn'; btn.disabled = !can || LK.spinning;
      btn.innerHTML = 'Open · <span class="coin-inline"></span>' + c.price.toLocaleString('en-US');
      btn.addEventListener('click', () => LK.openCrate(k));
      card.append(art, nm, ds, odds, btn);
      list.appendChild(card);
    }
    const note = document.createElement('p'); note.className = 'shop-note';
    note.textContent = 'Duplicates refund coins: Common ' + K.DUP_REFUND.common + ', Rare ' + K.DUP_REFUND.rare + ', Epic ' + K.DUP_REFUND.epic + ', Legendary ' + K.DUP_REFUND.legendary + '. Earn coins by clearing campaign parts (' + K.ECON.phase + ' each on Veteran) and finishing campaigns (' + K.ECON.finish.foundry + '–' + K.ECON.finish.halden + ' bonus); Recruit pays 75%, Elite 150%.';
    list.appendChild(note);
    const owned = K.list.filter((s) => s.rarity !== 'champion' && Pr.owns(s.id)).length, total = K.list.filter((s) => s.rarity !== 'champion').length;
    $('shopCollection').textContent = owned + ' / ' + total + ' crate skins collected';
  };

  /** Buy and open a crate: the server rolls it; the reel just shows the result with some drama. */
  LK.openCrate = async function (kind) {
    if (LK.spinning) return;
    LK.spinning = true; LK.render_();
    const ov = $('crateOpen'); ov.hidden = false; ov.className = 'crate-open shaking';
    $('coResult').hidden = true; $('coReel').textContent = ''; $('coReel').style.transition = 'none'; $('coReel').style.transform = 'translateX(0)';
    $('coTitle').textContent = K.CRATES[kind].name;
    if (A.ready) A.play('crateOpen', null, { ui: true });
    let res;
    try { [res] = await Promise.all([CF.Profile.openCrate(kind), new Promise((r) => setTimeout(r, 700))]); }
    catch (e) { ov.hidden = true; LK.spinning = false; CF.Toast('Could not open the crate', 'error', e.message); LK.render_(); return; }
    ov.className = 'crate-open spinning';
    const win = K.get(res.skin);
    // a reel of plausible drops with the real one near the end
    const pool = (r) => K.list.filter((s) => s.rarity === r);
    const odds = K.CRATES[kind].odds, pick = () => { let x = Math.random(); for (const [r, w] of odds) { if (x < w) return U.choice(pool(r)); x -= w; } return U.choice(pool(odds[0][0])); };
    const N = 46, WIN = 40, reel = $('coReel');
    const cards = [];
    for (let i = 0; i < N; i++) {
      const s = i === WIN ? win : pick();
      const c = document.createElement('div'); c.className = 'co-card rar-' + s.rarity; c.style.setProperty('--rar', K.RARITY[s.rarity].css);
      const img = document.createElement('span'); img.className = 'lk-img'; img.style.backgroundImage = 'url(' + LK.thumb(s.id) + ')';
      const nm = document.createElement('b'); nm.textContent = s.name;
      c.append(img, nm); reel.appendChild(c); cards.push(c);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const cw = cards[1].offsetLeft - cards[0].offsetLeft, view = $('coWindow').clientWidth;
    const target = WIN * cw + cw / 2 - view / 2 + (Math.random() - 0.5) * cw * 0.7;
    const DUR = 5.6;
    reel.style.transition = 'transform ' + DUR + 's cubic-bezier(0.06, 0.72, 0.14, 1)';
    reel.style.transform = 'translateX(' + (-target) + 'px)';
    // tick as each card passes the marker
    const t0 = performance.now(); let lastIdx = -1;
    await new Promise((resolve) => {
      const step = () => {
        const m = new DOMMatrixReadOnly(getComputedStyle(reel).transform), x = -m.m41 + view / 2, idx = Math.floor(x / cw);
        if (idx !== lastIdx) { lastIdx = idx; if (A.ready) A.play('crateTick', null, { ui: true, vol: 0.8 }); }
        if (performance.now() - t0 < DUR * 1000 + 80) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
    // reveal
    const R = K.RARITY[win.rarity];
    cards[WIN].classList.add('won');
    ov.className = 'crate-open revealed rar-' + win.rarity;
    ov.style.setProperty('--rar', R.css);
    $('coResult').hidden = false;
    $('coRarity').textContent = R.label + (win.slot === 'w' ? ' weapon finish' : ' operative suit');
    $('coName').textContent = win.name;
    $('coImg').style.backgroundImage = 'url(' + LK.thumb(win.id) + ')';
    $('coNew').textContent = res.dup ? 'Duplicate · +' + res.refund + ' coins refunded' : 'New!';
    $('coNew').className = res.dup ? 'co-dup' : 'co-new';
    $('coEquip').hidden = res.dup && CF.Profile.equipped(win.slot) === win.id;
    $('coEquip').dataset.skin = win.id;
    $('coAgain').disabled = CF.Profile.coins() < K.CRATES[kind].price;
    $('coAgain').dataset.crate = kind;
    burst(R, win.rarity);
    if (A.ready) A.play('reveal', null, { ui: true, rarity: R.weight });
    LK.spinning = false;
    LK.sel = win.id; LK.lastSlot = win.slot;
  };
  function burst(R, rarity) {
    const box = $('coBurst'); box.textContent = '';
    const n = { common: 20, rare: 34, epic: 50, legendary: 80 }[rarity] || 20;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 120 + Math.random() * (rarity === 'legendary' ? 420 : 260);
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px'); p.style.setProperty('--dy', (Math.sin(a) * d - 40).toFixed(0) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg'); p.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
      p.style.background = Math.random() < 0.7 ? R.css : '#fff';
      box.appendChild(p);
    }
  }
  LK.closeCrate = function () { $('crateOpen').hidden = true; LK.render_(); };
  LK.equipWon = function () {
    const id = $('coEquip').dataset.skin, s = K.get(id); if (!s) return;
    CF.Profile.equip(s.slot, id).then(() => { A.play('weaponGet', null, { ui: true }); $('coEquip').hidden = true; LK.tab = s.slot; LK.sel = id; })
      .catch((e) => CF.Toast('Could not equip', 'error', e.message));
  };

  LK.bind = function () {
    for (const b of document.querySelectorAll('[data-ltab]')) b.addEventListener('click', () => { A.play('uiClick', null, { ui: true }); LK.setTab(b.dataset.ltab); });
    $('lpEquip').addEventListener('click', () => LK.equip());
    $('saveCodeCopy').addEventListener('click', () => LK.copyCode());
    $('saveCodeUse').addEventListener('click', () => LK.useCode());
    $('saveCodeInput').addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') LK.useCode(); });
    $('coClose').addEventListener('click', () => LK.closeCrate());
    $('coEquip').addEventListener('click', () => LK.equipWon());
    $('coAgain').addEventListener('click', () => { const k = $('coAgain').dataset.crate; LK.closeCrate(); LK.openCrate(k); });
    // drag to turn the model
    const el = $('screen-locker');
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button, input, .lk-panel')) return; const s = LK.showroom(); s.drag = { x: e.clientX, yaw: s.yaw }; });
    window.addEventListener('pointermove', (e) => { const s = S; if (s && s.drag) s.yaw = s.drag.yaw + (e.clientX - s.drag.x) * 0.01; });
    window.addEventListener('pointerup', () => { if (S) S.drag = null; });
    CF.Profile.onChange(() => { if (LK.active && !LK.spinning && CF.Game.screen === 'locker') LK.render_(); });
  };
})(window.CF);
