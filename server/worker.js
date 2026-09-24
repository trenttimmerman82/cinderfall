/* Cinderfall server (Cloudflare Worker).
   GET  /scores          → campaign leaderboard (top 100). ?campaign=foundry|halden&mode=all|drones|nodrones&player=&name=
   POST /scores          → submit a run {player, name, campaign, mode, prog, score, stage, diff, time}; keeps each player's best per campaign and mode
   GET  /room/<CODE>     → WebSocket relay for a multiplayer room, used when a direct peer-to-peer link is blocked.
                           ?role=host (one per room) or ?role=client&id=<peer id>.
   Relay frames: host → server {to, d} | {b:1, x, d}; server → host {j:id} | {l:id} | {f:id, d}; client ↔ server: the bare message. */
import { DurableObject } from 'cloudflare:workers';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/scores') return env.BOARD.get(env.BOARD.idFromName('global')).fetch(req);
    const room = url.pathname.match(/^\/room\/([A-Z0-9]{5})$/);
    if (room) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket' }, 426);
      return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(req);
    }
    if (url.pathname === '/') return json({ ok: true, name: 'cinderfall' });
    return json({ error: 'Not found' }, 404);
  }
};

// ------------------------------------------------------------ leaderboard
const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);

const CAMPAIGNS = ['foundry', 'halden'], MODES = ['drones', 'nodrones'];
const COLS = 'name, campaign, mode, prog, score, stage, diff, time, date';

/** Campaign leaderboard. One row per player (browser id + callsign), campaign and drone mode; each keeps its best run. */
export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = this.sql = ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS runs (key TEXT, campaign TEXT, mode TEXT, name TEXT, prog INTEGER, score INTEGER, stage TEXT, diff TEXT, time INTEGER, date INTEGER, PRIMARY KEY (key, campaign, mode))`);
    sql.exec(`CREATE INDEX IF NOT EXISTS runs_rank ON runs (campaign, prog DESC, score DESC)`);
    // v1 → v2: the old single table only ever held Cinder Foundry runs; its difficulty label said whether drones were off
    if (sql.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scores'`).toArray().length) {
      sql.exec(`INSERT OR IGNORE INTO runs (key, campaign, mode, name, prog, score, stage, diff, time, date)
        SELECT key, 'foundry', CASE WHEN diff LIKE '% · No%' THEN 'nodrones' ELSE 'drones' END, name, prog, score, stage,
          CASE WHEN instr(diff, ' · ') > 0 THEN substr(diff, 1, instr(diff, ' · ') - 1) ELSE diff END, time, date FROM scores`);
      sql.exec('DROP TABLE scores');
    }
  }
  /** Top 100 for one campaign (mode 'all' mixes both modes), plus the caller's own best row and rank within that view. */
  board(key, campaign, mode) {
    const all = mode === 'all', where = all ? 'campaign = ?' : 'campaign = ? AND mode = ?', args = all ? [campaign] : [campaign, mode];
    const rows = this.sql.exec(`SELECT key, ${COLS} FROM runs WHERE ${where} ORDER BY prog DESC, score DESC, date ASC LIMIT 100`, ...args).toArray();
    const out = { campaign, mode, rows: rows.map((r) => { const o = Object.assign({}, r, { me: r.key === key }); delete o.key; return o; }) };
    out.total = this.sql.exec(`SELECT COUNT(*) AS n FROM runs WHERE ${where}`, ...args).one().n;
    const mine = key && this.sql.exec(`SELECT ${COLS} FROM runs WHERE key = ? AND ${where} ORDER BY prog DESC, score DESC LIMIT 1`, key, ...args).toArray()[0];
    if (mine) {
      mine.rank = this.sql.exec(`SELECT COUNT(*) AS n FROM runs WHERE ${where} AND (prog > ? OR (prog = ? AND score > ?) OR (prog = ? AND score = ? AND date < ?))`,
        ...args, mine.prog, mine.prog, mine.score, mine.prog, mine.score, mine.date).one().n + 1;
      mine.me = true; out.mine = mine;
    }
    return out;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const keyOf = (player, name) => /^[a-z0-9]{8,40}$/.test(player) ? player + ':' + (clean(name, 16) || 'Operative').toLowerCase() : '';
    const pick = (v, list, def) => (list.includes(v) ? v : def);
    if (req.method === 'GET') {
      const q = url.searchParams;
      return json(this.board(keyOf(q.get('player') || '', q.get('name')), pick(q.get('campaign'), CAMPAIGNS, 'foundry'), pick(q.get('mode'), MODES.concat('all'), 'all')));
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const name = clean(b.name, 16) || 'Operative', key = keyOf(String(b.player || ''), name);
    const prog = Math.floor(+b.prog), score = Math.floor(+b.score), time = Math.floor(+b.time) || 0;
    const campaign = pick(b.campaign, CAMPAIGNS, 'foundry');
    // clients from before drone modes only sent a difficulty label
    const mode = pick(b.mode, MODES, / · No/.test(String(b.diff || '')) ? 'nodrones' : 'drones');
    const diff = clean(String(b.diff || '').split(' · ')[0], 16);
    if (!key || !(prog >= 0 && prog <= 10) || !(score >= 0 && score <= 5e6)) return json({ error: 'Invalid run' }, 400);
    const prev = this.sql.exec('SELECT prog, score FROM runs WHERE key = ? AND campaign = ? AND mode = ?', key, campaign, mode).toArray()[0];
    const improved = !prev || prog > prev.prog || (prog === prev.prog && score > prev.score);
    if (improved) {
      this.sql.exec('INSERT OR REPLACE INTO runs (key, campaign, mode, name, prog, score, stage, diff, time, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        key, campaign, mode, name, prog, score, clean(b.stage, 40), diff, time, Date.now());
    }
    return json(Object.assign(this.board(key, campaign, pick(b.view, MODES.concat('all'), 'all')), { improved }));
  }
}

// ------------------------------------------------------------ multiplayer relay
export class Room extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url), role = url.searchParams.get('role');
    const id = role === 'host' ? 'host' : clean(url.searchParams.get('id'), 64);
    if (role !== 'host' && (!id || id === 'host')) return json({ error: 'Missing id' }, 400);
    const host = this.ctx.getWebSockets('host')[0];
    if (role === 'host' && host) return json({ error: 'Room in use' }, 409);
    if (role !== 'host' && !host) return json({ error: 'No host' }, 404);
    if (role !== 'host' && this.ctx.getWebSockets().length >= 16) return json({ error: 'Room full' }, 429);
    for (const old of this.ctx.getWebSockets(id)) old.close(4000, 'Replaced');
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [id]);
    if (role !== 'host') host.send(JSON.stringify({ j: id }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string') return;
    const tag = this.ctx.getTags(ws)[0];
    if (tag === 'host') {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      const d = JSON.stringify(m.d);
      if (m.b) { for (const c of this.ctx.getWebSockets()) { const t = this.ctx.getTags(c)[0]; if (t !== 'host' && t !== m.x) this.trySend(c, d); } }
      else for (const c of this.ctx.getWebSockets(String(m.to))) this.trySend(c, d);
      return;
    }
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    const host = this.ctx.getWebSockets('host')[0];
    if (host) this.trySend(host, JSON.stringify({ f: tag, d }));
  }
  webSocketClose(ws) { this.gone(ws); }
  webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    const tag = this.ctx.getTags(ws)[0];
    try { ws.close(1000, 'Bye'); } catch (e) { /* already closed */ }
    if (tag === 'host') { for (const c of this.ctx.getWebSockets()) if (c !== ws) try { c.close(4001, 'Host left'); } catch (e) { /* ignore */ } return; }
    const host = this.ctx.getWebSockets('host')[0];
    if (host) this.trySend(host, JSON.stringify({ l: tag }));
  }
  trySend(ws, s) { try { ws.send(s); } catch (e) { /* socket closing */ } }
}
