'use strict';
/* Cinderfall — campaign leaderboard (furthest part reached, then score), per campaign and per drone mode.
   Every run is kept in this browser; when CF.SERVER is set, runs are also sent to the global board. */
(function (CF) {
  const $ = (id) => document.getElementById(id);
  const KEY = 'cinderfall.leaderboard.v1';
  const MODE_LABEL = { drones: 'Drones', nodrones: 'No drones', coop: 'Co-op' };
  const TOP = 10; // rows shown per board; your own rank is always shown too
  const Board = CF.Board = { tab: 'world', campaign: null, mode: 'all', world: null, loading: false, error: '', req: 0, v2: null, coopOk: null };
  const server = () => String(CF.SERVER || '').replace(/\/+$/, '');
  Board.load = function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  Board.save = function (b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) { /* storage unavailable */ } };
  const better = (a, b) => a.prog !== b.prog ? a.prog > b.prog : a.score > b.score;
  /** Runs saved before campaigns and drone modes existed are Cinder Foundry runs; the difficulty label said if drones were off. */
  const norm = (r) => {
    if (!r.campaign) r.campaign = 'foundry';
    if (!r.mode) r.mode = / · No/.test(r.diff || '') ? 'nodrones' : 'drones';
    if (r.diff) r.diff = String(r.diff).split(' · ')[0];
    return r;
  };
  const localKey = (name, campaign, mode) => name.toLowerCase() + '|' + campaign + '|' + mode;
  Board.runs = function () {
    const b = this.load(), out = [];
    for (const k in b) out.push(Object.assign(norm(b[k]), { _k: k }));
    return out;
  };

  /** Random id for this browser, so two players who both call themselves "Ghost" keep separate rows. */
  Board.player = function () {
    let id = '';
    try { id = localStorage.getItem('cinderfall.player') || ''; } catch (e) { /* storage unavailable */ }
    if (!/^[a-z0-9]{16}$/.test(id)) {
      id = ''; for (let i = 0; i < 16; i++) id += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)];
      try { localStorage.setItem('cinderfall.player', id); } catch (e) { /* storage unavailable */ }
    }
    return id;
  };

  /** Record the current campaign run. prog: parts cleared (phases.length = mission complete). Keeps each callsign's best per campaign and mode. */
  Board.record = function (prog, done) {
    const G = CF.Game, M = CF.Mission, C = CF.campaign();
    if (!G || G.mode === 'mp' || !G.stats || !C) return;
    // co-op: one entry per team, recorded by the host, under both callsigns on the Co-op board
    const coop = CF.Coop && CF.Coop.campaign();
    if (coop && !CF.MP.isHost()) return;
    const name = coop ? Object.values(CF.MP.players).map((p) => p.name).sort().join(' + ').slice(0, 40) : (CF.MP && CF.MP.name) || 'Operative';
    const phase = M.phases[Math.min(prog, M.phases.length - 1)];
    const mode = coop ? 'coop' : CF.settings.noDrones ? 'nodrones' : 'drones';
    const run = { name, campaign: C.id, mode, prog, stage: done ? 'Mission complete' : phase.num + ' · ' + phase.title, score: G.score, diff: CF.diff().label, time: Math.round(G.stats.time), date: Date.now() };
    const b = this.load(), key = localKey(name, C.id, mode);
    // fold a pre-campaign entry for this callsign into its new slot
    const old = b[name.toLowerCase()];
    if (old) { norm(old); const k = localKey(name, old.campaign, old.mode); if (!b[k] || better(old, b[k])) b[k] = old; delete b[name.toLowerCase()]; }
    const prev = b[key];
    const isBest = !prev || better(run, prev);
    if (isBest) { b[key] = run; this.save(b); this.submit(run); } else this.save(b);
    return isBest;
  };
  /** Best local run for a campaign (campaign picker). */
  Board.bestLocal = function (campaign) {
    let best = null;
    for (const r of this.runs()) if (r.campaign === campaign && (!best || better(r, best))) best = r;
    return best;
  };

  // ------------------------------------------------------------ global board
  function request(method, body) {
    const q = method === 'GET' ? '?player=' + Board.player() + '&name=' + encodeURIComponent(CF.MP.name) + '&campaign=' + Board.campaign + '&mode=' + Board.mode + '&limit=' + TOP : '';
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), 10000);
    return fetch(server() + '/scores' + q, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((d) => adapt(d))
      .finally(() => clearTimeout(timer));
  }
  /** A server from before campaigns (not yet redeployed) answers without campaign/mode: treat it as the Cinder Foundry board. */
  function adapt(d) {
    if (!d || !Array.isArray(d.rows)) return d;
    if (d.campaign) { Board.v2 = true; Board.coopOk = Array.isArray(d.modes) && d.modes.includes('coop'); return d; }
    Board.v2 = false;
    const want = Board.campaign, mode = Board.mode;
    const rows = want === 'foundry' ? d.rows.map((r) => norm(Object.assign({}, r))).filter((r) => mode === 'all' || r.mode === mode) : [];
    return { campaign: want, mode, rows, total: rows.length, mine: want === 'foundry' && d.mine && (mode === 'all' || norm(Object.assign({}, d.mine)).mode === mode) ? norm(Object.assign({}, d.mine)) : null, legacy: true };
  }
  /** Old servers only understand Cinder Foundry runs, so other campaigns wait until the server is updated. */
  const canSend = (run) => (run.mode === 'coop' ? Board.coopOk === true : Board.v2 === true || run.campaign === 'foundry'); // co-op needs a server that knows the Co-op board
  const onScreen = () => CF.Game && CF.Game.screen === 'leaderboard';
  const viewMatches = (d) => d && d.campaign === Board.campaign && d.mode === Board.mode;
  Board.submit = function (run) {
    if (!server()) return;
    // learn which server version answers before sending a run it might misfile (old servers only know the foundry)
    if ((this.v2 === null && run.campaign !== 'foundry') || (run.mode === 'coop' && this.coopOk == null)) { request('GET').then(() => { if (canSend(run)) this.submit(run); }).catch(() => {}); return; }
    if (!canSend(run)) return;
    // the profile token and server-tracked run let the server check a #1 before it awards the Champion skins
    const G = CF.Game, auth = { token: CF.Profile.token() || undefined, run: (G && CF.Profile.runId(G.runKey)) || undefined, limit: TOP };
    request('POST', Object.assign({ player: this.player(), view: this.mode }, run, auth))
      .then((d) => {
        if (d.campaign === this.campaign && d.mode === this.mode) { this.world = d; this.error = ''; if (onScreen()) this.render(); }
        this.markSynced(run);
        if (d.champion) this.championUnlocked(d.champion);
      })
      .catch(() => { /* offline: the run is still on this computer, and the leaderboard sends it next time */ });
  };
  /** The server saw this run take #1: the Champion skins are yours (the first time), and you hold the crown for now. */
  Board.championUnlocked = function (c) {
    const [camp, mode] = String(c.board || '').split('|'), C = CF.Campaigns[camp];
    const where = (C ? C.name : 'the leaderboard') + (mode ? ' · ' + (MODE_LABEL[mode] || mode) : '');
    if (c.first) CF.Toast('You reached #1! Champion skin unlocked', 'champ', where + ' · equip it in the Locker');
    else CF.Toast('You hold #1 on ' + where, 'champ', 'Your Champion crown shows in multiplayer while you keep the top spot');
    if (CF.Audio.ready) CF.Audio.play('champion', null, { ui: true });
    CF.Profile.refresh();
  };
  Board.markSynced = function (run) {
    let sent = {};
    try { sent = JSON.parse(localStorage.getItem('cinderfall.synced') || '{}') || {}; } catch (e) { sent = {}; }
    sent[localKey(run.name, run.campaign, run.mode)] = run.date;
    try { localStorage.setItem('cinderfall.synced', JSON.stringify(sent)); } catch (e) { /* ignore */ }
  };
  /** Push this callsign's local bests the server may not have yet (offline play, runs from before the server), then refresh. */
  Board.sync = function () {
    let sent = {};
    try { sent = JSON.parse(localStorage.getItem('cinderfall.synced') || '{}') || {}; } catch (e) { sent = {}; }
    const me = CF.MP.name.toLowerCase();
    const pending = () => this.runs().filter((r) => r.name.toLowerCase() === me && canSend(r) && !(sent[localKey(r.name, r.campaign, r.mode)] >= r.date) && !(r._k === me && sent[me] >= r.date));
    const push = () => Promise.all(pending().map((r) => request('POST', Object.assign({ player: this.player() }, r)).then(() => this.markSynced(r)).catch(() => null)));
    // learn which server version answers before sending anything it might misfile
    return (this.v2 === null ? request('GET') : Promise.resolve()).then(push).then(() => request('GET'));
  };
  Board.fetch = function () {
    if (!server()) return;
    const id = ++this.req;
    this.loading = true; this.error = ''; this.world = null;
    this.sync()
      .then((d) => { if (id === this.req) this.world = d; })
      .catch(() => { if (id === this.req) this.error = 'Could not reach the leaderboard server. Showing runs from this computer.'; })
      .finally(() => { if (id === this.req) { this.loading = false; if (onScreen()) this.render(); } });
  };

  // ------------------------------------------------------------ screen
  Board.open = function () {
    if (!this.campaign) this.campaign = CF.settings.campaign || 'foundry';
    if (server()) this.fetch();
    this.render();
  };
  Board.show = function (tab) { this.tab = tab; this.render(); };
  Board.setCampaign = function (c) { if (this.campaign === c) return; this.campaign = c; if (server()) this.fetch(); this.render(); };
  Board.setMode = function (m) { if (this.mode === m) return; this.mode = m; if (server()) this.fetch(); this.render(); };
  function row(el, cells, cls, mode) {
    const d = document.createElement('div'); d.className = 'lb-row' + (cls || '');
    cells.forEach((t, i) => {
      const s = document.createElement('span');
      if (i === 0 && t === '1') { const c = document.createElement('i'); c.className = 'lb-crown'; c.title = 'Top of this board'; c.textContent = '♛'; s.append(c, '1'); }
      else s.textContent = t;
      if (i === 1 && / me/.test(cls || '')) { const y = document.createElement('em'); y.className = 'lb-you'; y.textContent = 'You'; s.appendChild(y); }
      d.appendChild(s);
    });
    const m = document.createElement('span');
    if (mode) { const pill = document.createElement('i'); pill.className = 'lb-mode ' + mode; pill.textContent = MODE_LABEL[mode] || mode; m.appendChild(pill); }
    else m.textContent = 'Mode';
    d.appendChild(m); el.appendChild(d);
  }
  const cells = (r, rank) => [String(rank), r.name, r.stage, r.score.toLocaleString('en-US'), r.diff];
  const cls = (r, me) => (me ? ' me' : '') + (r.stage === 'Mission complete' ? ' done' : '');
  const empty = (el, text) => { const p = document.createElement('p'); p.className = 'lb-empty'; p.textContent = text; el.appendChild(p); };

  Board.render = function () {
    const nameEl = $('lbName'); if (nameEl && document.activeElement !== nameEl) nameEl.value = CF.MP.name;
    if (!this.campaign) this.campaign = CF.settings.campaign || 'foundry';
    const online = !!server(), world = online && this.tab === 'world' && !this.error;
    $('lbTabs').hidden = !online;
    for (const b of document.querySelectorAll('[data-lbtab]')) b.setAttribute('aria-selected', String(b.dataset.lbtab === (online ? this.tab : 'local')));
    for (const b of document.querySelectorAll('[data-lbcampaign]')) b.setAttribute('aria-selected', String(b.dataset.lbcampaign === this.campaign));
    for (const b of document.querySelectorAll('[data-lbmode]')) b.setAttribute('aria-pressed', String(b.dataset.lbmode === this.mode));
    const C = CF.Campaigns && CF.Campaigns[this.campaign];
    $('lbEyebrow').textContent = (C ? C.name : 'Campaign') + ' · furthest part first, then score';
    const el = $('lbTable'), rank = $('lbRank'), note = $('lbNote');
    el.textContent = ''; rank.textContent = '';
    row(el, ['#', 'Callsign', 'Furthest', 'Score', 'Difficulty'], ' lb-head', null);

    if (world) {
      note.textContent = 'Everyone who plays Cinderfall. Each callsign keeps its best run per campaign and per drone mode.';
      const d = viewMatches(this.world) ? this.world : null;
      if (!d) { empty(el, 'Loading the leaderboard…'); return; }
      if (d.mine) rank.textContent = 'Your rank: #' + d.mine.rank.toLocaleString('en-US') + ' of ' + d.total.toLocaleString('en-US') + ' · ' + d.mine.score.toLocaleString('en-US') + ' pts';
      else rank.textContent = d.total ? d.total.toLocaleString('en-US') + ' run' + (d.total === 1 ? '' : 's') + ' ranked · finish a run to join them' : '';
      if (!d.rows.length) { empty(el, d.legacy && this.campaign !== 'foundry' ? 'This board opens once the game server is updated (server owner: run npx wrangler deploy in server/). Your runs are saved on this computer and are sent automatically after the update.' : 'No runs here yet. Be the first on the board.'); return; }
      d.rows.slice(0, TOP).forEach((r, i) => row(el, cells(r, i + 1), cls(r, r.me), r.mode));
      if (d.mine && !d.rows.slice(0, TOP).some((r) => r.me)) { row(el, ['⋯', '', '', '', ''], ' gap', null); row(el, cells(d.mine, d.mine.rank), cls(d.mine, true), d.mine.mode); }
      return;
    }

    note.textContent = this.error || 'Runs are saved in this browser. Your best run per callsign, campaign and drone mode is kept.';
    const me = CF.MP.name.toLowerCase();
    const all = this.runs().filter((r) => r.campaign === this.campaign && (this.mode === 'all' ? r.mode !== 'coop' : r.mode === this.mode))
      .sort((a, c) => (c.prog - a.prog) || (c.score - a.score));
    if (!all.length) { empty(el, 'No runs yet. Deploy on this campaign and your best run will show up here.'); return; }
    const mi = all.findIndex((r) => r.name.toLowerCase() === me);
    if (mi >= 0) rank.textContent = 'Your rank: #' + (mi + 1) + ' of ' + all.length + ' · ' + all[mi].score.toLocaleString('en-US') + ' pts';
    all.slice(0, TOP).forEach((r, i) => row(el, cells(r, i + 1), cls(r, r.name.toLowerCase() === me), r.mode));
    if (mi >= TOP) { row(el, ['⋯', '', '', '', ''], ' gap', null); row(el, cells(all[mi], mi + 1), cls(all[mi], true), all[mi].mode); }
  };
})(window.CF);
