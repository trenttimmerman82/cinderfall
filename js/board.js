'use strict';
/* Cinderfall — campaign leaderboard (furthest phase reached, then score).
   Every run is kept in this browser; when CF.SERVER is set, runs are also sent to the global board. */
(function (CF) {
  const $ = (id) => document.getElementById(id);
  const KEY = 'cinderfall.leaderboard.v1';
  const Board = CF.Board = { tab: 'world', world: null, loading: false, error: '' };
  const server = () => String(CF.SERVER || '').replace(/\/+$/, '');
  Board.load = function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  Board.save = function (b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) { /* storage unavailable */ } };
  const better = (a, b) => a.prog !== b.prog ? a.prog > b.prog : a.score > b.score;

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

  /** Record the current campaign run. prog: phases cleared (0–5, 5 = mission complete). Keeps each callsign's best run. */
  Board.record = function (prog, done) {
    const G = CF.Game, M = CF.Mission;
    if (!G || G.mode === 'mp' || !G.stats) return;
    const name = (CF.MP && CF.MP.name) || 'Operative';
    const phase = M.phases[Math.min(prog, M.phases.length - 1)];
    const run = { name, prog, stage: done ? 'Mission complete' : phase.num + ' · ' + phase.title, score: G.score, diff: CF.diffLabel(), time: Math.round(G.stats.time), date: Date.now() };
    const b = this.load(), key = name.toLowerCase(), prev = b[key];
    const isBest = !prev || better(run, prev);
    if (isBest) { b[key] = run; this.save(b); this.submit(run); }
    return isBest;
  };

  // ------------------------------------------------------------ global board
  function request(method, body) {
    const q = method === 'GET' ? '?player=' + Board.player() + '&name=' + encodeURIComponent(CF.MP.name) : '';
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), 10000);
    return fetch(server() + '/scores' + q, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(() => clearTimeout(timer));
  }
  const onScreen = () => CF.Game && CF.Game.screen === 'leaderboard';
  Board.submit = function (run) {
    if (!server()) return;
    request('POST', Object.assign({ player: this.player() }, run))
      .then((d) => { this.world = d; this.error = ''; if (onScreen()) this.render(); })
      .catch(() => { /* offline: the run is still on this computer, and the next best run sends again */ });
  };
  /** Push local bests the server may not have yet (played offline, or before the server existed), then refresh. */
  Board.sync = function () {
    const b = this.load(), me = CF.MP.name.toLowerCase();
    let sent = null;
    try { sent = JSON.parse(localStorage.getItem('cinderfall.synced') || '{}') || {}; } catch (e) { sent = {}; }
    const mine = b[me];
    if (mine && !(sent[me] >= mine.date)) {
      return request('POST', Object.assign({ player: this.player() }, mine)).then((d) => {
        sent[me] = mine.date; try { localStorage.setItem('cinderfall.synced', JSON.stringify(sent)); } catch (e) { /* ignore */ }
        return d;
      });
    }
    return request('GET');
  };
  Board.fetch = function () {
    if (!server() || this.loading) return;
    this.loading = true; this.error = '';
    this.sync()
      .then((d) => { this.world = d; })
      .catch(() => { this.error = 'Could not reach the leaderboard server. Showing runs from this computer.'; })
      .finally(() => { this.loading = false; if (onScreen()) this.render(); });
  };

  // ------------------------------------------------------------ screen
  Board.open = function () { if (server()) this.fetch(); this.render(); };
  Board.show = function (tab) { this.tab = tab; this.render(); };
  function row(el, cells, cls) {
    const d = document.createElement('div'); d.className = 'lb-row' + (cls || '');
    for (const t of cells) { const s = document.createElement('span'); s.textContent = t; d.appendChild(s); }
    el.appendChild(d);
  }
  const cells = (r, rank) => [String(rank), r.name, r.stage, r.score.toLocaleString('en-US'), r.diff];
  const cls = (r, me) => (me ? ' me' : '') + (r.prog >= 5 ? ' done' : '');

  Board.render = function () {
    const nameEl = $('lbName'); if (nameEl && document.activeElement !== nameEl) nameEl.value = CF.MP.name;
    const online = !!server(), world = online && this.tab === 'world' && !this.error;
    $('lbTabs').hidden = !online;
    for (const b of document.querySelectorAll('[data-lbtab]')) b.setAttribute('aria-selected', String(b.dataset.lbtab === (online ? this.tab : 'local')));
    const el = $('lbTable'), rank = $('lbRank'), note = $('lbNote');
    el.textContent = ''; rank.textContent = '';
    row(el, ['#', 'Callsign', 'Furthest', 'Score', 'Difficulty'], ' lb-head');

    if (world) {
      note.textContent = 'Everyone who plays Cinderfall, ranked by furthest phase and then score. Each callsign on each computer keeps its best run.';
      const d = this.world;
      if (!d) { const p = document.createElement('p'); p.className = 'lb-empty'; p.textContent = 'Loading the leaderboard…'; el.appendChild(p); return; }
      if (d.mine) rank.textContent = 'You are #' + d.mine.rank.toLocaleString('en-US') + ' of ' + d.total.toLocaleString('en-US') + ' player' + (d.total === 1 ? '' : 's');
      else rank.textContent = d.total ? d.total.toLocaleString('en-US') + ' player' + (d.total === 1 ? '' : 's') + ' ranked · finish a run to join them' : '';
      if (!d.rows.length) { const p = document.createElement('p'); p.className = 'lb-empty'; p.textContent = 'No runs yet. Be the first on the board.'; el.appendChild(p); return; }
      d.rows.forEach((r, i) => row(el, cells(r, i + 1), cls(r, r.me)));
      if (d.mine && !d.rows.some((r) => r.me)) { row(el, ['⋯', '', '', '', ''], ' gap'); row(el, cells(d.mine, d.mine.rank), cls(d.mine, true)); }
      return;
    }

    note.textContent = this.error || 'Runs are saved in this browser. Your best run per callsign is kept.';
    const b = this.load(), me = CF.MP.name.toLowerCase();
    const rows = Object.keys(b).map((k) => b[k]).sort((a, c) => (c.prog - a.prog) || (c.score - a.score)).slice(0, 25);
    if (!rows.length) { const p = document.createElement('p'); p.className = 'lb-empty'; p.textContent = 'No runs yet. Deploy on the campaign and your best run will show up here.'; el.appendChild(p); return; }
    rows.forEach((r, i) => row(el, cells(r, i + 1), cls(r, r.name.toLowerCase() === me)));
  };
})(window.CF);
