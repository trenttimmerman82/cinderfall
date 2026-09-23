'use strict';
/* Cinderfall — "What's new" notes and the campaign leaderboard (furthest phase reached, then score). */
(function (CF) {
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ what's new
  const VERSION = '2.1';
  const NOTES = [
    ['Easy mode', 'A new difficulty for relaxed play. Drones and Stalker dogs go down in a few hits, and enemies hit softer.'],
    ['New weapons', 'Havoc RPG, Rotor-6 minigun (spins up before it fires), satchel charges (click to throw, right click or Q to detonate) and the Hex-9 SMG are now in the campaign. Keys 1–8 pick them.'],
    ['Attack drone', 'Get 5 kills without dying and press Z to launch a friendly drone that hunts enemies for 35 seconds.'],
    ['Nuketown', 'A sunny suburban multiplayer map: two houses, a street and a school bus in the middle.'],
    ['New loadouts', 'Heavy (minigun + armor) and Demolition (RPG + satchels) in multiplayer.'],
    ['Leaderboard', 'Set your callsign and see how far each run got. Beat your furthest phase, then your score.'],
    ['New keys', 'Q aims and scopes, F is melee, X switches to your last weapon. Change them any time in Settings.'],
    ['Better connections', 'Online matches now fall back to a relay server when a direct connection is blocked.']
  ];
  const News = CF.News = { VERSION, NOTES };
  News.render = function () {
    const el = $('newsList'); if (!el || el.childElementCount) return;
    for (const [title, text] of NOTES) {
      const li = document.createElement('li'), b = document.createElement('b'), s = document.createElement('span');
      b.textContent = title; s.textContent = text; li.append(b, s); el.appendChild(li);
    }
    $('newsVersion').textContent = 'Build ' + VERSION;
  };
  News.unseen = function () { try { return localStorage.getItem('cinderfall.seen') !== VERSION; } catch (e) { return false; } };
  News.markSeen = function () { try { localStorage.setItem('cinderfall.seen', VERSION); } catch (e) { /* storage unavailable */ } };

  // ------------------------------------------------------------ leaderboard
  const KEY = 'cinderfall.leaderboard.v1';
  const Board = CF.Board = {};
  Board.load = function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  Board.save = function (b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) { /* storage unavailable */ } };
  const better = (a, b) => a.prog !== b.prog ? a.prog > b.prog : a.score > b.score;

  /** Record the current campaign run. prog: phases cleared (0–5, 5 = mission complete). Keeps each callsign's best run. */
  Board.record = function (prog, done) {
    const G = CF.Game, M = CF.Mission;
    if (!G || G.mode === 'mp' || !G.stats) return;
    const name = (CF.MP && CF.MP.name) || 'Operative';
    const phase = M.phases[Math.min(prog, M.phases.length - 1)];
    const run = { name, prog, stage: done ? 'Mission complete' : phase.num + ' · ' + phase.title, score: G.score, diff: CF.diff().label, time: Math.round(G.stats.time), date: Date.now() };
    const b = this.load(), key = name.toLowerCase(), prev = b[key];
    const isBest = !prev || better(run, prev);
    if (isBest) { b[key] = run; this.save(b); }
    return isBest;
  };
  Board.rows = function () {
    const b = this.load();
    return Object.keys(b).map((k) => b[k]).sort((a, c) => (c.prog - a.prog) || (c.score - a.score)).slice(0, 25);
  };
  Board.render = function () {
    const nameEl = $('lbName'); if (nameEl && document.activeElement !== nameEl) nameEl.value = CF.MP.name;
    const el = $('lbTable'); el.textContent = '';
    const head = document.createElement('div'); head.className = 'lb-row lb-head';
    for (const t of ['#', 'Callsign', 'Furthest', 'Score', 'Difficulty']) { const s = document.createElement('span'); s.textContent = t; head.appendChild(s); }
    el.appendChild(head);
    const rows = this.rows(), me = CF.MP.name.toLowerCase();
    if (!rows.length) { const p = document.createElement('p'); p.className = 'lb-empty'; p.textContent = 'No runs yet. Deploy on the campaign and your best run will show up here.'; el.appendChild(p); return; }
    rows.forEach((r, i) => {
      const d = document.createElement('div'); d.className = 'lb-row' + (r.name.toLowerCase() === me ? ' me' : '') + (r.prog >= 5 ? ' done' : '');
      for (const t of [String(i + 1), r.name, r.stage, r.score.toLocaleString('en-US'), r.diff]) { const s = document.createElement('span'); s.textContent = t; d.appendChild(s); }
      el.appendChild(d);
    });
  };
})(window.CF);
