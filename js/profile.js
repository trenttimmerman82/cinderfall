'use strict';
/* Cinderfall — player profile: coins, owned skins, equipped cosmetics, save code and cloud saves.
   With CF.SERVER set the server owns coins and skins: coins come from server-tracked campaign runs, crates are rolled
   on the server, equips are checked against what you own. This browser only keeps a copy to show while offline.
   Without a server everything lives in this browser. */
(function (CF) {
  const KEY = 'cinderfall.profile.v1', LOCAL = 'cinderfall.localprofile.v1', CLAIMS = 'cinderfall.claims.v1';
  const server = () => String(CF.SERVER || '').replace(/\/+$/, '');
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  const rid = (n) => { let s = ''; for (let i = 0; i < n; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]; return s; };

  const Pr = CF.Profile = { data: null, mode: server() ? 'server' : 'local', status: 'loading', listeners: [], pubCache: {}, claims: null };

  // ------------------------------------------------------------ transport
  function call(method, path, body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), 12000);
    return fetch(server() + path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then((r) => r.json().catch(() => ({})).then((d) => { if (!r.ok) { const e = new Error(d.error || ('HTTP ' + r.status)); e.status = r.status; e.data = d; throw e; } return d; }))
      .finally(() => clearTimeout(timer));
  }
  const api = (body) => call('POST', '/profile', body);

  // ------------------------------------------------------------ state
  /** Validate whatever came back from storage or the server, so a damaged copy can't break the game. */
  function sane(d) {
    if (!d || typeof d !== 'object') return null;
    const skins = Array.isArray(d.skins) ? d.skins.filter((s) => CF.Skins.get(s)) : [];
    const equip = {};
    for (const slot of ['p', 'w']) { const e = d.equip && d.equip[slot]; if (e && skins.includes(e) && CF.Skins.get(e).slot === slot) equip[slot] = e; }
    return Object.assign({}, d, { coins: Math.max(0, Math.floor(+d.coins) || 0), skins, equip, champion: d.champion && typeof d.champion === 'object' ? d.champion : { now: false, boards: [] } });
  }
  function set(d, cache) {
    const s = sane(d); if (!s) return;
    Pr.data = s;
    if (cache !== false) write(Pr.mode === 'local' ? LOCAL : KEY, s);
    Pr.emit();
  }
  Pr.emit = function () {
    for (const el of document.querySelectorAll('[data-coins]')) el.textContent = Pr.coins().toLocaleString('en-US');
    for (const fn of this.listeners) try { fn(Pr.data); } catch (e) { console.error(e); }
    if (CF.Skins.applyLocal) CF.Skins.applyLocal();
  };
  Pr.onChange = function (fn) { this.listeners.push(fn); };
  Pr.coins = () => (Pr.data ? Pr.data.coins : 0);
  Pr.owns = (id) => !!(Pr.data && Pr.data.skins.includes(id));
  Pr.equipped = (slot) => (Pr.data && Pr.data.equip[slot]) || null;
  Pr.token = () => (Pr.mode === 'server' && Pr.data && Pr.data.token) || null;
  Pr.pub = () => (Pr.mode === 'server' && Pr.data && Pr.data.pub) || null;
  Pr.ready = () => Pr.status === 'ready';
  /** Why the economy can't be used right now (null when it can). */
  Pr.blocked = function () {
    if (Pr.mode === 'local') return null;
    if (Pr.status === 'outdated') return 'The Cinderfall server needs updating before coins and crates work. (Server owner: run npx wrangler deploy in server/.)';
    if (Pr.status === 'offline') return 'Can\'t reach the Cinderfall server. Coins and crates are saved there; try again when you\'re online.';
    if (Pr.status === 'loading') return 'Connecting to the Cinderfall server…';
    return null;
  };

  Pr.init = function () {
    this.claims = read(CLAIMS, { q: [], runs: {} });
    if (!Array.isArray(this.claims.q) || typeof this.claims.runs !== 'object') this.claims = { q: [], runs: {} };
    if (this.mode === 'local') {
      const d = read(LOCAL, null);
      set(d || { coins: CF.Skins.ECON.welcome, skins: [], equip: {}, local: true });
      if (!d) setTimeout(() => CF.Toast('Welcome bonus', 'coin', '+' + CF.Skins.ECON.welcome + ' coins to spend in the shop'), 1500);
      this.status = 'ready'; this.emit();
      return Promise.resolve();
    }
    const cached = read(KEY, null);
    if (cached) set(cached, false);
    return this.connect();
  };
  /** Talk to the server: check its version, then load (or create) this browser's profile. */
  Pr.connect = function () {
    this.status = 'loading'; this.emit();
    return call('GET', '/')
      .then((info) => {
        if (!(info && info.v >= 3)) { this.status = 'outdated'; return null; }
        const tok = this.data && this.data.token;
        return (tok ? api({ op: 'get', token: tok }) : Promise.reject(Object.assign(new Error('new'), { status: 401 })))
          .catch((e) => { if (e.status === 401) return api({ op: 'new' }).then((d) => { if (d.welcome) setTimeout(() => CF.Toast('Welcome bonus', 'coin', '+' + d.welcome + ' coins to spend in the shop'), 1200); return d; }); throw e; })
          .then((d) => { set(d); this.status = 'ready'; if (CF.Progress) CF.Progress.mergeCloud(d.progress); this.processClaims(); });
      })
      .catch(() => { this.status = 'offline'; setTimeout(() => { if (this.status === 'offline') this.connect(); }, 60000); })
      .finally(() => this.emit());
  };
  Pr.refresh = function () { if (this.mode === 'server' && this.status === 'ready') api({ op: 'get', token: this.data.token }).then((d) => set(d)).catch(() => {}); };

  // ------------------------------------------------------------ cosmetics
  Pr.equip = function (slot, id) {
    if (id && !this.owns(id)) return Promise.reject(new Error('You do not own that skin yet.'));
    if (this.mode === 'local') { const d = Object.assign({}, this.data, { equip: Object.assign({}, this.data.equip) }); if (id) d.equip[slot] = id; else delete d.equip[slot]; set(d); return Promise.resolve(); }
    const why = this.blocked(); if (why) return Promise.reject(new Error(why));
    return api({ op: 'equip', token: this.data.token, slot, skin: id }).then((d) => set(d));
  };
  /** Buy and open a crate. Resolves { skin, rarity, dup, refund }. */
  Pr.openCrate = function (kind) {
    const c = CF.Skins.CRATES[kind]; if (!c) return Promise.reject(new Error('Unknown crate'));
    if (this.coins() < c.price) return Promise.reject(new Error('Not enough coins'));
    if (this.mode === 'local') {
      const s = CF.Skins.roll(kind), dup = this.owns(s.id), refund = dup ? CF.Skins.DUP_REFUND[s.rarity] : 0;
      const d = Object.assign({}, this.data, { coins: this.data.coins - c.price + refund, skins: dup ? this.data.skins : this.data.skins.concat(s.id) });
      set(d, true);
      return Promise.resolve({ skin: s.id, rarity: s.rarity, dup, refund, coins: d.coins });
    }
    const why = this.blocked(); if (why) return Promise.reject(new Error(why));
    return api({ op: 'open', token: this.data.token, crate: kind }).then((d) => { set(d, true); return d; });
  };
  /** Other players' cosmetics as the server knows them (so nobody can claim a skin they don't own). Cached for a minute. */
  Pr.publicProfile = function (pub) {
    if (this.mode !== 'server' || !/^[a-z0-9]{12}$/.test(pub || '')) return Promise.resolve(null);
    const c = this.pubCache[pub];
    if (c && performance.now() - c.t < 60000) return c.p;
    const p = call('GET', '/profile?pub=' + pub).catch(() => null);
    this.pubCache[pub] = { t: performance.now(), p };
    return p;
  };

  // ------------------------------------------------------------ save code (move a profile to another device)
  Pr.saveCode = () => (Pr.mode === 'server' && Pr.data && Pr.data.code) || null;
  Pr.restore = function (code) {
    if (this.mode !== 'server') return Promise.reject(new Error('Save codes need the Cinderfall server.'));
    return api({ op: 'restore', code: String(code || '') }).then((d) => { set(d); this.status = 'ready'; if (CF.Progress) CF.Progress.mergeCloud(d.progress, true); return d; });
  };
  let pushT = 0;
  /** Cloud copy of campaign progress (debounced). */
  Pr.pushProgress = function (progress) {
    if (this.mode !== 'server') return;
    clearTimeout(pushT);
    pushT = setTimeout(() => { if (this.status === 'ready') api({ op: 'progress', token: this.data.token, progress }).catch(() => { /* next save retries */ }); }, 1200);
  };

  // ------------------------------------------------------------ campaign runs and coin claims
  const saveClaims = () => write(CLAIMS, Pr.claims);
  /** Start a campaign run. Returns a local key right away; the server run id arrives when it can. */
  Pr.runStart = function (campaign, diff, mode) {
    const key = 'k' + rid(12);
    this.claims.runs[key] = { campaign, diff, mode, id: this.mode === 'local' ? 'local' : null, t: Date.now() };
    // forget runs from long ago
    for (const k in this.claims.runs) if (Date.now() - this.claims.runs[k].t > 30 * 864e5 && !this.claims.q.some((c) => c.key === k)) delete this.claims.runs[k];
    saveClaims();
    this.ensureRun(key);
    return key;
  };
  /** Continue a run saved on another device (or before storage was cleared). */
  Pr.adoptRun = function (key, info) {
    if (!key || this.claims.runs[key]) return;
    this.claims.runs[key] = { campaign: info.campaign, diff: info.diff, mode: info.mode, id: info.runId || (this.mode === 'local' ? 'local' : null), claimed: info.claimed || 0, t: Date.now() };
    saveClaims();
  };
  Pr.runId = function (key) { const r = key && this.claims.runs[key]; return r && r.id && r.id !== 'local' ? r.id : null; };
  Pr.ensureRun = function (key) {
    const r = this.claims.runs[key];
    if (!r || r.id || r.starting || this.mode !== 'server' || this.status !== 'ready') return Promise.resolve(r && r.id);
    r.starting = true;
    return api({ op: 'runStart', token: this.data.token, campaign: r.campaign, diff: r.diff, mode: r.mode })
      .then((d) => { r.id = d.run; saveClaims(); return r.id; })
      .catch((e) => { if (e.status === 400) { r.bad = true; saveClaims(); } return null; }).finally(() => { r.starting = false; }); // 400: a server that doesn't know this campaign yet
  };
  /** A campaign part was cleared: queue its coin claim (kept across reloads until the server answers). */
  Pr.claim = function (key, phase, total) {
    const r = this.claims.runs[key]; if (!r) return;
    if (this.claims.q.some((c) => c.key === key && c.phase === phase) || (r.claimed || 0) > phase) return;
    this.claims.q.push({ key, phase, total });
    saveClaims();
    this.processClaims();
  };
  let busy = false, retryT = 0;
  Pr.processClaims = function () {
    if (busy || !this.claims.q.length) return;
    if (this.mode === 'local') {
      for (const c of this.claims.q.splice(0)) {
        const r = this.claims.runs[c.key]; if (!r || (r.claimed || 0) > c.phase) continue;
        const coins = CF.Skins.phaseCoins(r.campaign, r.diff, c.phase, c.total);
        r.claimed = c.phase + 1;
        set(Object.assign({}, this.data, { coins: this.data.coins + coins }));
        this.coinToast(coins, c.phase + 1 >= c.total);
      }
      saveClaims(); return;
    }
    if (this.status !== 'ready') return;
    const c = this.claims.q[0], r = this.claims.runs[c.key];
    if (!r || r.bad) { this.claims.q.shift(); saveClaims(); this.processClaims(); return; }
    busy = true;
    this.ensureRun(c.key).then((id) => {
      if (!id) throw Object.assign(new Error('no run'), { retry: 20 });
      return api({ op: 'runPhase', token: this.data.token, run: id, phase: c.phase });
    }).then((d) => {
      if (d.note === 'order') { // earlier parts of this run were never claimed (another device, lost storage): claim them first
        const missing = []; for (let p = d.phases; p < c.phase; p++) if (!this.claims.q.some((x) => x.key === c.key && x.phase === p)) missing.push({ key: c.key, phase: p, total: c.total });
        this.claims.q.unshift(...missing); saveClaims(); return 'next';
      }
      this.claims.q.shift(); r.claimed = Math.max(r.claimed || 0, d.phases || 0); saveClaims();
      set(d);
      if (d.granted > 0) this.coinToast(d.granted, d.finished, d.capped);
      else if (d.capped) CF.Toast('Daily coin limit reached', 'info', 'Coins from campaigns reset at midnight UTC.');
      return 'next';
    }).catch((e) => {
      if (e.status === 404) { this.claims.q.shift(); saveClaims(); return 'next'; } // the run expired on the server
      // too early (the server paces parts) or offline: try again later
      const wait = e.status === 429 ? ((e.data && e.data.retryAfter) || 20) : e.retry || 30;
      clearTimeout(retryT); retryT = setTimeout(() => this.processClaims(), wait * 1000 + 250);
      return 'wait';
    }).then((res) => { busy = false; if (res === 'next' && this.claims.q.length) this.processClaims(); });
  };
  Pr.coinToast = function (n, finished, capped) {
    CF.Toast('+' + n.toLocaleString('en-US') + ' coins', 'coin', finished ? 'Campaign complete bonus included' + (capped ? ' · daily limit reached' : '') : capped ? 'Daily limit reached' : 'Campaign part cleared');
    if (CF.Audio && CF.Audio.ready) CF.Audio.play('coins', null, { ui: true });
    if (CF.Game) CF.Game.runCoins = (CF.Game.runCoins || 0) + n;
  };

  // ------------------------------------------------------------ toasts (menus and HUD)
  CF.Toast = function (title, kind, sub) {
    const box = document.getElementById('toasts'); if (!box) return;
    const d = document.createElement('div'); d.className = 'toast ' + (kind || 'info');
    const t = document.createElement('b'); t.textContent = title; d.appendChild(t);
    if (sub) { const s = document.createElement('span'); s.textContent = sub; d.appendChild(s); }
    box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), kind === 'champ' ? 7000 : 4200);
    setTimeout(() => d.remove(), kind === 'champ' ? 7600 : 4800);
  };
})(window.CF);
