/* Cinderfall server (Cloudflare Worker).
   GET  /                → { ok, name, v } (v is the API version; the game uses it to tell an outdated server)
   GET  /scores          → campaign leaderboard (top 10, ?limit= up to 100). ?campaign=foundry|halden&mode=all|drones|nodrones&player=&name=
   POST /scores          → submit a run {player, name, campaign, mode, prog, score, stage, diff, time, token?, run?}; keeps each player's best per campaign and mode.
                           A run that takes #1 on a board with enough entries, backed by a server-tracked campaign run, unlocks the Champion skins.
   GET  /profile?pub=    → another player's verified cosmetics { pub, equip, champion } (multiplayer uses it so skins can't be faked)
   POST /profile         → {op, token, ...}: new | get | restore(code) | equip(slot, skin) | progress(save) | runStart(campaign, diff, mode) |
                           runPhase(run, phase) | open(crate). Coins, skins and crate rolls live here, never in the browser.
   POST /feedback        → {op, ...}: send(name, cat, text, rating?, pub?, ctx?) from any player (rate-limited per address);
                           list(key, filter?) | done(key, id, done) | remove(key, id) for the developer. key is the FEEDBACK_KEY secret
                           (set it with `npx wrangler secret put FEEDBACK_KEY`); without it nobody can read feedback.
   GET  /room/<CODE>     → WebSocket relay for a multiplayer room, used when a direct peer-to-peer link is blocked.
                           ?role=host (one per room) or ?role=client&id=<peer id>.
   Relay frames: host → server {to, d} | {b:1, x, d}; server → host {j:id} | {l:id} | {f:id, d}; client ↔ server: the bare message. */
import { DurableObject } from 'cloudflare:workers';

const API = 3;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/scores' || url.pathname === '/profile' || url.pathname === '/feedback') return env.BOARD.get(env.BOARD.idFromName('global')).fetch(req);
    const room = url.pathname.match(/^\/room\/([A-Z0-9]{5})$/);
    if (room) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket' }, 426);
      return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(req);
    }
    if (url.pathname === '/') return json({ ok: true, name: 'cinderfall', v: API });
    return json({ error: 'Not found' }, 404);
  }
};

// ------------------------------------------------------------ names
const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);
const cleanName = (s) => clean(s, 16) || 'Operative';

// ------------------------------------------------------------ economy (the game's js/skins.js mirrors the catalog for visuals)
const CAMPAIGNS = ['foundry', 'halden'], MODES = ['drones', 'nodrones'];
const PHASES = { foundry: 5, halden: 6 };
const DIFF_MUL = { recruit: 0.75, veteran: 1, elite: 1.5 };
const PHASE_COINS = 40, FINISH_COINS = { foundry: 250, halden: 300 }, WELCOME = 300, DAILY_CAP = 6000;
const MIN_PHASE_SECS = 35;           // a part can't be cleared faster than this (cumulative from the run's start)
const CHAMP_MIN_ENTRIES = 5;         // a board needs this many players before its #1 counts
const SKINS = {
  // weapon finishes
  w_desert: ['w', 'common'], w_urban: ['w', 'common'], w_woodland: ['w', 'common'], w_arctic: ['w', 'common'],
  w_carbon: ['w', 'rare'], w_cobalt: ['w', 'rare'], w_tiger: ['w', 'rare'], w_redline: ['w', 'rare'],
  w_circuit: ['w', 'epic'], w_damascus: ['w', 'epic'], w_hologram: ['w', 'epic'], w_frostbite: ['w', 'epic'],
  w_inferno: ['w', 'legendary'], w_void: ['w', 'legendary'], w_dragon: ['w', 'legendary'],
  w_champion: ['w', 'champion'],
  // operative suits
  p_ranger: ['p', 'common'], p_urban: ['p', 'common'], p_sand: ['p', 'common'], p_navy: ['p', 'common'],
  p_hazmat: ['p', 'rare'], p_arctic: ['p', 'rare'], p_crimson: ['p', 'rare'], p_stealth: ['p', 'rare'],
  p_oni: ['p', 'epic'], p_chrome: ['p', 'epic'], p_samurai: ['p', 'epic'], p_cyber: ['p', 'epic'],
  p_phantom: ['p', 'legendary'], p_inferno: ['p', 'legendary'], p_mech: ['p', 'legendary'],
  p_champion: ['p', 'champion']
};
const CRATES = {
  field: { price: 300, odds: [['common', 0.62], ['rare', 0.27], ['epic', 0.09], ['legendary', 0.02]] },
  elite: { price: 750, odds: [['rare', 0.55], ['epic', 0.33], ['legendary', 0.12]] }
};
const DUP_REFUND = { common: 60, rare: 125, epic: 275, legendary: 600 };
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rand = (n, a) => { const b = new Uint8Array(n); crypto.getRandomValues(b); let s = ''; for (const x of b) s += (a || 'abcdefghijklmnopqrstuvwxyz0123456789')[x % (a || 'abcdefghijklmnopqrstuvwxyz0123456789').length]; return s; };
const rnd01 = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] / 4294967296; };
const today = () => new Date().toISOString().slice(0, 10);
const parse = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } };

// feedback: what players can file it under, how long a message can be, how many one address can send per window, how many are kept
const FB_CATS = ['bug', 'gameplay', 'performance', 'idea', 'other'];
const FB_MAX = 2000, FB_WINDOW = 10 * 60e3, FB_PER_WINDOW = 5, FB_KEEP = 5000;
/** Compare secrets by their hashes, so the time taken doesn't reveal how much of a guess was right. */
async function sameSecret(a, b) {
  const h = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const x = await h(a), y = await h(b);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const COLS = 'name, campaign, mode, prog, score, stage, diff, time, date';

/** Leaderboard, player profiles (coins, skins, cloud saves) and campaign runs. One global instance. */
export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = this.sql = ctx.storage.sql;
    this.minPhase = env && env.MIN_PHASE_SECS != null && env.MIN_PHASE_SECS !== '' ? +env.MIN_PHASE_SECS : MIN_PHASE_SECS; // local testing can lower it
    sql.exec(`CREATE TABLE IF NOT EXISTS runs (key TEXT, campaign TEXT, mode TEXT, name TEXT, prog INTEGER, score INTEGER, stage TEXT, diff TEXT, time INTEGER, date INTEGER, PRIMARY KEY (key, campaign, mode))`);
    sql.exec(`CREATE INDEX IF NOT EXISTS runs_rank ON runs (campaign, prog DESC, score DESC)`);
    // v1 → v2: the old single table only ever held Cinder Foundry runs; its difficulty label said whether drones were off
    if (sql.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scores'`).toArray().length) {
      sql.exec(`INSERT OR IGNORE INTO runs (key, campaign, mode, name, prog, score, stage, diff, time, date)
        SELECT key, 'foundry', CASE WHEN diff LIKE '% · No%' THEN 'nodrones' ELSE 'drones' END, name, prog, score, stage,
          CASE WHEN instr(diff, ' · ') > 0 THEN substr(diff, 1, instr(diff, ' · ') - 1) ELSE diff END, time, date FROM scores`);
      sql.exec('DROP TABLE scores');
    }
    // v2 → v3: runs remember which profile set them (champion checks); profiles and server-tracked campaign runs
    const cols = sql.exec(`PRAGMA table_info(runs)`).toArray().map((c) => c.name);
    if (!cols.includes('prof')) sql.exec(`ALTER TABLE runs ADD COLUMN prof TEXT`);
    sql.exec(`CREATE TABLE IF NOT EXISTS profiles (token TEXT PRIMARY KEY, pub TEXT UNIQUE, code TEXT UNIQUE, coins INTEGER, skins TEXT, equip TEXT, progress TEXT, day TEXT, earned INTEGER, created INTEGER, updated INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, date INTEGER, name TEXT, cat TEXT, rating INTEGER, text TEXT, pub TEXT, ctx TEXT, src TEXT, done INTEGER DEFAULT 0)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS camps (id TEXT PRIMARY KEY, token TEXT, campaign TEXT, diff TEXT, mode TEXT, phases INTEGER, started INTEGER, last INTEGER)`);
  }

  // ---------------------------------------------------------- leaderboard
  where(campaign, mode) { const all = mode === 'all'; return { w: all ? 'campaign = ?' : 'campaign = ? AND mode = ?', a: all ? [campaign] : [campaign, mode] }; }
  /** Top rows for one campaign (mode 'all' mixes both modes), plus the caller's own best row and rank within that view. */
  board(key, campaign, mode, limit) {
    const { w, a } = this.where(campaign, mode);
    const rows = this.sql.exec(`SELECT key, ${COLS} FROM runs WHERE ${w} ORDER BY prog DESC, score DESC, date ASC LIMIT ?`, ...a, limit).toArray();
    const out = { campaign, mode, rows: rows.map((r) => { const o = Object.assign({}, r, { me: r.key === key, name: cleanName(r.name) }); delete o.key; return o; }) };
    out.total = this.sql.exec(`SELECT COUNT(*) AS n FROM runs WHERE ${w}`, ...a).one().n;
    out.champMin = CHAMP_MIN_ENTRIES;
    const mine = key && this.sql.exec(`SELECT ${COLS} FROM runs WHERE key = ? AND ${w} ORDER BY prog DESC, score DESC LIMIT 1`, key, ...a).toArray()[0];
    if (mine) { mine.rank = this.rankOf(mine, w, a); mine.me = true; mine.name = cleanName(mine.name); out.mine = mine; }
    return out;
  }
  rankOf(r, w, a) {
    return this.sql.exec(`SELECT COUNT(*) AS n FROM runs WHERE ${w} AND (prog > ? OR (prog = ? AND score > ?) OR (prog = ? AND score = ? AND date < ?))`,
      ...a, r.prog, r.prog, r.score, r.prog, r.score, r.date).one().n + 1;
  }
  /** Boards (campaign|mode) whose current #1 was set by this profile, counting only boards with enough entries. */
  heldBoards(pub) {
    if (!pub) return [];
    const out = [];
    for (const c of CAMPAIGNS) for (const m of MODES) {
      const n = this.sql.exec('SELECT COUNT(*) AS n FROM runs WHERE campaign = ? AND mode = ?', c, m).one().n;
      if (n < CHAMP_MIN_ENTRIES) continue;
      const top = this.sql.exec('SELECT prof FROM runs WHERE campaign = ? AND mode = ? ORDER BY prog DESC, score DESC, date ASC LIMIT 1', c, m).toArray()[0];
      if (top && top.prof === pub) out.push(c + '|' + m);
    }
    return out;
  }

  async scores(req, url) {
    const keyOf = (player, name) => /^[a-z0-9]{8,40}$/.test(player) ? player + ':' + (clean(name, 16) || 'Operative').toLowerCase() : '';
    const pick = (v, list, def) => (list.includes(v) ? v : def);
    if (req.method === 'GET') {
      const q = url.searchParams, limit = Math.max(1, Math.min(100, Math.floor(+q.get('limit')) || 10));
      return json(this.board(keyOf(q.get('player') || '', q.get('name')), pick(q.get('campaign'), CAMPAIGNS, 'foundry'), pick(q.get('mode'), MODES.concat('all'), 'all'), limit));
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const name = cleanName(b.name), key = keyOf(String(b.player || ''), clean(b.name, 16));
    const prog = Math.floor(+b.prog), score = Math.floor(+b.score), time = Math.floor(+b.time) || 0;
    const campaign = pick(b.campaign, CAMPAIGNS, 'foundry');
    // clients from before drone modes only sent a difficulty label
    const mode = pick(b.mode, MODES, / · No/.test(String(b.diff || '')) ? 'nodrones' : 'drones');
    const diff = clean(String(b.diff || '').split(' · ')[0], 16);
    if (!key || !(prog >= 0 && prog <= PHASES[campaign]) || !(score >= 0 && score <= 5e6)) return json({ error: 'Invalid run' }, 400);
    const prof = b.token ? this.profile(String(b.token)) : null;
    const prev = this.sql.exec('SELECT prog, score FROM runs WHERE key = ? AND campaign = ? AND mode = ?', key, campaign, mode).toArray()[0];
    const improved = !prev || prog > prev.prog || (prog === prev.prog && score > prev.score);
    const now = Date.now();
    if (improved) {
      this.sql.exec('INSERT OR REPLACE INTO runs (key, campaign, mode, name, prog, score, stage, diff, time, date, prof) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        key, campaign, mode, name, prog, score, clean(b.stage, 40), diff, time, now, prof ? prof.pub : null);
    }
    const out = Object.assign(this.board(key, campaign, pick(b.view, MODES.concat('all'), 'all'), Math.max(1, Math.min(100, Math.floor(+b.limit) || 10))), { improved });
    // Champion: #1 on a board with enough entries, with a server-tracked run that really reached this far, at a plausible pace
    if (improved && prof) {
      const { w, a } = this.where(campaign, mode);
      const rank = this.rankOf({ prog, score, date: now }, w, a);
      const total = this.sql.exec(`SELECT COUNT(*) AS n FROM runs WHERE ${w}`, ...a).one().n;
      const run = b.run ? this.sql.exec('SELECT * FROM camps WHERE id = ? AND token = ?', String(b.run), prof.token).toArray()[0] : null;
      const plausible = run && run.campaign === campaign && run.mode === mode && run.phases >= prog && prog >= 1 && score <= 12000 * (prog + 1) * 1.5;
      if (rank === 1 && total >= CHAMP_MIN_ENTRIES && plausible) {
        const skins = parse(prof.skins, []), first = !skins.includes('p_champion');
        for (const s of ['p_champion', 'w_champion']) if (!skins.includes(s)) skins.push(s);
        this.sql.exec('UPDATE profiles SET skins = ?, updated = ? WHERE token = ?', JSON.stringify(skins), now, prof.token);
        out.champion = { board: campaign + '|' + mode, first };
      }
    }
    return json(out);
  }

  // ---------------------------------------------------------- profiles
  profile(token) { return /^[a-z0-9]{32}$/.test(token) ? this.sql.exec('SELECT * FROM profiles WHERE token = ?', token).toArray()[0] || null : null; }
  view(p) {
    const held = this.heldBoards(p.pub);
    return { token: p.token, pub: p.pub, code: p.code.slice(0, 5) + '-' + p.code.slice(5), coins: p.coins, skins: parse(p.skins, []), equip: parse(p.equip, {}),
      progress: parse(p.progress, {}), champion: { now: held.length > 0, boards: held }, earnedToday: p.day === today() ? p.earned : 0, dailyCap: DAILY_CAP };
  }
  /** Coins earned from play, capped per day so a scripted client can't mint them. Returns the amount actually granted. */
  earn(p, amount) {
    const d = today(), used = p.day === d ? p.earned : 0, grant = Math.max(0, Math.min(amount, DAILY_CAP - used));
    this.sql.exec('UPDATE profiles SET coins = coins + ?, day = ?, earned = ?, updated = ? WHERE token = ?', grant, d, used + grant, Date.now(), p.token);
    p.coins += grant; p.day = d; p.earned = used + grant;
    return grant;
  }

  async prof(req, url) {
    if (req.method === 'GET') {
      const pub = String(url.searchParams.get('pub') || '');
      const p = /^[a-z0-9]{12}$/.test(pub) ? this.sql.exec('SELECT pub, equip FROM profiles WHERE pub = ?', pub).toArray()[0] : null;
      if (!p) return json({ error: 'Unknown player' }, 404);
      return json({ pub: p.pub, equip: parse(p.equip, {}), champion: { now: this.heldBoards(p.pub).length > 0 } });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const op = String(b.op || '');
    const now = Date.now();
    if (op === 'new') {
      let token, pub, code;
      for (let i = 0; i < 5; i++) {
        token = rand(32); pub = rand(12); code = rand(10, ALPHA);
        if (!this.sql.exec('SELECT 1 FROM profiles WHERE token = ? OR pub = ? OR code = ?', token, pub, code).toArray().length) break;
      }
      this.sql.exec('INSERT INTO profiles (token, pub, code, coins, skins, equip, progress, day, earned, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        token, pub, code, WELCOME, '[]', '{}', '{}', today(), 0, now, now);
      return json(Object.assign(this.view(this.profile(token)), { welcome: WELCOME }));
    }
    if (op === 'restore') {
      const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const p = code.length === 10 ? this.sql.exec('SELECT * FROM profiles WHERE code = ?', code).toArray()[0] : null;
      if (!p) return json({ error: 'No save matches that code.' }, 404);
      return json(this.view(p));
    }
    const p = this.profile(String(b.token || ''));
    if (!p) return json({ error: 'Unknown profile' }, 401);
    if (op === 'get') return json(this.view(p));
    if (op === 'equip') {
      const slot = b.slot === 'w' ? 'w' : 'p', skin = b.skin == null ? null : String(b.skin);
      const skins = parse(p.skins, []), equip = parse(p.equip, {});
      if (skin && (!SKINS[skin] || SKINS[skin][0] !== slot || !skins.includes(skin))) return json({ error: 'You do not own that skin.' }, 403);
      if (skin) equip[slot] = skin; else delete equip[slot];
      this.sql.exec('UPDATE profiles SET equip = ?, updated = ? WHERE token = ?', JSON.stringify(equip), now, p.token);
      p.equip = JSON.stringify(equip);
      return json(this.view(p));
    }
    if (op === 'progress') {
      const s = JSON.stringify(b.progress && typeof b.progress === 'object' ? b.progress : {});
      if (s.length > 24000) return json({ error: 'Save too large' }, 413);
      this.sql.exec('UPDATE profiles SET progress = ?, updated = ? WHERE token = ?', s, now, p.token);
      p.progress = s;
      return json(this.view(p));
    }
    if (op === 'runStart') {
      const campaign = CAMPAIGNS.includes(b.campaign) ? b.campaign : null;
      if (!campaign) return json({ error: 'Unknown campaign' }, 400);
      this.sql.exec('DELETE FROM camps WHERE last < ?', now - 30 * 864e5);
      const id = rand(20);
      this.sql.exec('INSERT INTO camps (id, token, campaign, diff, mode, phases, started, last) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
        id, p.token, campaign, DIFF_MUL[b.diff] ? b.diff : 'veteran', MODES.includes(b.mode) ? b.mode : 'drones', now, now);
      return json({ run: id });
    }
    if (op === 'runPhase') {
      const run = this.sql.exec('SELECT * FROM camps WHERE id = ? AND token = ?', String(b.run || ''), p.token).toArray()[0];
      if (!run) return json({ error: 'Unknown run' }, 404);
      const phase = Math.floor(+b.phase), total = PHASES[run.campaign];
      // parts are claimed in order, once each, and no faster than a person could play them
      if (phase !== run.phases) return json(Object.assign(this.view(p), { granted: 0, phases: run.phases, note: phase < run.phases ? 'already' : 'order' }));
      if (now - run.started < this.minPhase * 1000 * (phase + 1)) return json({ error: 'Too fast', retryAfter: Math.ceil((run.started + this.minPhase * 1000 * (phase + 1) - now) / 1000) }, 429);
      const mul = DIFF_MUL[run.diff] || 1;
      let coins = Math.round(PHASE_COINS * mul);
      const finished = phase + 1 >= total;
      if (finished) coins += Math.round(FINISH_COINS[run.campaign] * mul);
      this.sql.exec('UPDATE camps SET phases = ?, last = ? WHERE id = ?', phase + 1, now, run.id);
      const granted = this.earn(p, coins);
      return json(Object.assign(this.view(p), { granted, capped: granted < coins, finished, phases: phase + 1 }));
    }
    if (op === 'open') {
      const crate = CRATES[b.crate];
      if (!crate) return json({ error: 'Unknown crate' }, 400);
      if (p.coins < crate.price) return json({ error: 'Not enough coins' }, 402);
      let r = rnd01(), rarity = crate.odds[crate.odds.length - 1][0];
      for (const [k, w] of crate.odds) { if (r < w) { rarity = k; break; } r -= w; }
      const pool = Object.keys(SKINS).filter((k) => SKINS[k][1] === rarity);
      const skin = pool[Math.floor(rnd01() * pool.length)];
      const skins = parse(p.skins, []), dup = skins.includes(skin), refund = dup ? DUP_REFUND[rarity] : 0;
      if (!dup) skins.push(skin);
      p.coins = p.coins - crate.price + refund;
      this.sql.exec('UPDATE profiles SET coins = ?, skins = ?, updated = ? WHERE token = ?', p.coins, JSON.stringify(skins), now, p.token);
      p.skins = JSON.stringify(skins);
      return json(Object.assign(this.view(p), { skin, rarity, dup, refund }));
    }
    return json({ error: 'Unknown op' }, 400);
  }

  // ---------------------------------------------------------- feedback
  async feedback(req) {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const op = String(b.op || ''), now = Date.now();
    if (op === 'send') {
      const text = String(b.text || '').replace(/\u0000/g, '').trim().slice(0, FB_MAX);
      if (text.length < 3) return json({ error: 'Write a little more first.' }, 400);
      // a hashed address, only to stop one person flooding the inbox
      const ip = req.headers.get('CF-Connecting-IP') || '';
      const src = ip ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cf-fb|' + ip)))].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('') : '';
      if (src && this.sql.exec('SELECT COUNT(*) AS n FROM feedback WHERE src = ? AND date > ?', src, now - FB_WINDOW).one().n >= FB_PER_WINDOW) {
        return json({ error: 'Thanks! You have sent a lot of feedback in the last few minutes; try again a little later.' }, 429);
      }
      const rating = Math.floor(+b.rating), cat = FB_CATS.includes(b.cat) ? b.cat : 'other';
      const pub = /^[a-z0-9]{12}$/.test(b.pub || '') ? b.pub : null;
      const ctx = b.ctx && typeof b.ctx === 'object' ? JSON.stringify(b.ctx).slice(0, 600) : '{}';
      this.sql.exec('INSERT INTO feedback (date, name, cat, rating, text, pub, ctx, src) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        now, cleanName(b.name), cat, rating >= 1 && rating <= 5 ? rating : null, text, pub, ctx, src);
      this.sql.exec('DELETE FROM feedback WHERE id <= (SELECT id FROM feedback ORDER BY id DESC LIMIT 1 OFFSET ?)', FB_KEEP);
      return json({ ok: true });
    }
    // everything else is for the developer
    const key = this.env && this.env.FEEDBACK_KEY;
    if (!key) return json({ error: 'Reading feedback is not set up on the server yet (FEEDBACK_KEY secret).' }, 503);
    if (!(await sameSecret(String(b.key || ''), String(key)))) return json({ error: 'Wrong developer key.' }, 403);
    if (op === 'list') {
      const f = b.filter === 'open' ? 'WHERE done = 0' : b.filter === 'done' ? 'WHERE done = 1' : '';
      const rows = this.sql.exec(`SELECT id, date, name, cat, rating, text, ctx, done FROM feedback ${f} ORDER BY id DESC LIMIT 300`).toArray()
        .map((r) => Object.assign(r, { ctx: parse(r.ctx, {}), done: !!r.done }));
      const counts = this.sql.exec('SELECT cat, COUNT(*) AS n, SUM(done = 0) AS open, AVG(rating) AS avg FROM feedback GROUP BY cat').toArray();
      const all = this.sql.exec('SELECT COUNT(*) AS n, SUM(done = 0) AS open, AVG(rating) AS avg FROM feedback').one();
      return json({ rows, counts, total: all.n, open: all.open || 0, avg: all.avg });
    }
    if (op === 'done') { this.sql.exec('UPDATE feedback SET done = ? WHERE id = ?', b.done ? 1 : 0, Math.floor(+b.id)); return json({ ok: true }); }
    if (op === 'remove') { this.sql.exec('DELETE FROM feedback WHERE id = ?', Math.floor(+b.id)); return json({ ok: true }); }
    return json({ error: 'Unknown op' }, 400);
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/profile') return this.prof(req, url);
    if (url.pathname === '/feedback') return this.feedback(req);
    return this.scores(req, url);
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
