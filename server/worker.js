/* Cinderfall server (Cloudflare Worker).
   GET  /scores          → global campaign leaderboard (top 100)
   POST /scores          → submit a run; keeps each player's best; returns the board and your rank
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

export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS scores (key TEXT PRIMARY KEY, name TEXT, prog INTEGER, score INTEGER, stage TEXT, diff TEXT, time INTEGER, date INTEGER)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS by_rank ON scores (prog DESC, score DESC)`);
  }
  /** Top 100 plus the caller's own row and rank. Row keys stay private (they are how a player's best is stored). */
  board(key) {
    const rows = this.sql.exec('SELECT key, name, prog, score, stage, diff, time, date FROM scores ORDER BY prog DESC, score DESC, date ASC LIMIT 100').toArray();
    const out = { rows: rows.map((r) => ({ name: r.name, prog: r.prog, score: r.score, stage: r.stage, diff: r.diff, time: r.time, date: r.date, me: r.key === key })) };
    out.total = this.sql.exec('SELECT COUNT(*) AS n FROM scores').one().n;
    const mine = key && this.sql.exec('SELECT name, prog, score, stage, diff, time, date FROM scores WHERE key = ?', key).toArray()[0];
    if (mine) {
      mine.rank = this.sql.exec('SELECT COUNT(*) AS n FROM scores WHERE prog > ? OR (prog = ? AND score > ?) OR (prog = ? AND score = ? AND date < ?)',
        mine.prog, mine.prog, mine.score, mine.prog, mine.score, mine.date).one().n + 1;
      mine.me = true; out.mine = mine;
    }
    return out;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const keyOf = (player, name) => /^[a-z0-9]{8,40}$/.test(player) ? player + ':' + (clean(name, 16) || 'Operative').toLowerCase() : '';
    if (req.method === 'GET') return json(this.board(keyOf(url.searchParams.get('player') || '', url.searchParams.get('name'))));
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const name = clean(b.name, 16) || 'Operative', key = keyOf(String(b.player || ''), name);
    const prog = Math.floor(+b.prog), score = Math.floor(+b.score), time = Math.floor(+b.time) || 0;
    if (!key || !(prog >= 0 && prog <= 5) || !(score >= 0 && score <= 5e6)) return json({ error: 'Invalid run' }, 400);
    const prev = this.sql.exec('SELECT prog, score FROM scores WHERE key = ?', key).toArray()[0];
    const improved = !prev || prog > prev.prog || (prog === prev.prog && score > prev.score);
    if (improved) {
      this.sql.exec('INSERT OR REPLACE INTO scores (key, name, prog, score, stage, diff, time, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        key, name, prog, score, clean(b.stage, 40), clean(b.diff, 16), time, Date.now());
    }
    return json(Object.assign(this.board(key), { improved }));
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
