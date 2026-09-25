'use strict';
/* Cinderfall — networking. Star topology: the host relays between clients.
   Players first try a direct peer-to-peer link (PeerJS / WebRTC). When a router or school/office Wi-Fi blocks
   that, they fall back to the Cinderfall server's WebSocket relay (server/worker.js), which works on any
   network that can open ordinary web pages. A room can mix direct and relayed players.
   Direct links carry two channels: PeerJS's reliable, ordered one for events (hits, kills, joins) and a "fast" one
   (unordered, never re-sent) for position updates, so one lost packet doesn't hold back the newer ones behind it.
   The relay is a WebSocket, which is always reliable, so fast messages there just take the normal path. */
(function (CF) {
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const PREFIX = 'cinderfall-v5-'; // bump when the wire format changes so old and new builds don't meet
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }] };
  const OPTS = { debug: 0, config: ICE };
  const DIRECT_WAIT = 8000; // how long a join tries peer-to-peer before switching to the relay
  const FAST_ID = 1000; // SCTP stream id of the fast channel; both ends open it with this id, so no extra handshake is needed
  const Net = CF.Net = { peer: null, conns: {}, host: null, role: null, code: '', myId: '', relay: null, onMsg: null, onLeave: null, onDrop: null };
  /** Traffic counters for the debug overlay. Bytes are only measured while it's open (on), since that means stringifying. */
  const stats = Net.stats = { on: false, inN: 0, outN: 0, inB: 0, outB: 0 };
  const countOut = (msg, str) => { stats.outN++; if (stats.on) stats.outB += (str || JSON.stringify(msg)).length; };
  const countIn = (msg, str) => { stats.inN++; if (stats.on) stats.inB += (str || JSON.stringify(msg)).length; };

  const server = () => String(CF.SERVER || '').replace(/\/+$/, '');
  Net.hasRelay = () => !!server() && typeof window.WebSocket === 'function';
  Net.available = () => (typeof window.Peer === 'function' && typeof window.RTCPeerConnection === 'function') || Net.hasRelay();
  Net.makeCode = () => { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; };
  Net.cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const randomId = () => 'r' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
  const relayUrl = (code, q) => server().replace(/^http/, 'ws') + '/room/' + code + '?' + q;
  Net.describe = function (err) {
    const t = err && err.type;
    if (t === 'browser-incompatible') return 'This browser does not support online play.';
    if (t === 'peer-unavailable') return 'No match found with that code. Check it and try again.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Could not reach the matchmaking server. Check your internet connection and try again.';
    if (t === 'unavailable-id') return 'That room code is already in use. Try hosting again.';
    return 'Connection problem (' + (t || (err && err.message) || 'unknown') + ').';
  };

  function wire(conn, fromId) {
    conn.on('data', (d) => { if (d && typeof d === 'object') { countIn(d); if (Net.onMsg) Net.onMsg(fromId || conn.peer, d); } });
  }
  function parse(e) { try { const m = JSON.parse(e.data); if (m && typeof m === 'object') { countIn(m, e.data); return m; } return null; } catch (err) { return null; } }
  /** Open the fast channel on a direct link (both ends call this once the link is open). */
  function openFast(conn, fromId) {
    const pc = conn.peerConnection;
    if (!pc || typeof pc.createDataChannel !== 'function') return;
    let ch;
    try { ch = pc.createDataChannel('cf-fast', { negotiated: true, id: FAST_ID, ordered: false, maxRetransmits: 0 }); } catch (e) { return; }
    ch.onmessage = (e) => { const m = parse(e); if (m && Net.onMsg) Net.onMsg(fromId || conn.peer, m); };
    conn.fast = ch;
  }
  /** Send on the fast channel when it's open, otherwise on the normal one. */
  function sendFast(c, msg) {
    const ch = c.fast;
    if (ch && ch.readyState === 'open') { const str = JSON.stringify(msg); try { ch.send(str); countOut(msg, str); return; } catch (e) { /* buffer full or closing: fall back */ } }
    if (c.open) { c.send(msg); countOut(msg); }
  }

  // ------------------------------------------------------------ host
  /** Host side of the relay: relayed players show up in Net.conns next to direct ones. */
  function openHostRelay(code, onOpen, onFail) {
    let ws, opened = false;
    try { ws = new WebSocket(relayUrl(code, 'role=host')); } catch (e) { if (onFail) onFail(); return; }
    Net.relay = ws;
    ws.onopen = () => { opened = true; if (onOpen) onOpen(); };
    ws.onmessage = (e) => {
      const m = parse(e); if (!m) return;
      if (m.j) {
        const old = Net.conns[m.j]; if (old && !old.relay) { delete Net.conns[m.j]; try { old.close(); } catch (err) { /* ignore */ } }
        Net.conns[m.j] = { peer: m.j, relay: true, open: true, send: (d) => { if (ws.readyState === 1) ws.send(JSON.stringify({ to: m.j, d })); } };
      } else if (m.l) {
        const c = Net.conns[m.l]; if (c && c.relay) { delete Net.conns[m.l]; if (Net.onLeave) Net.onLeave(m.l); }
      } else if (m.f && m.d && typeof m.d === 'object' && Net.onMsg) Net.onMsg(m.f, m.d);
    };
    ws.onclose = () => {
      if (Net.relay !== ws) return;
      Net.relay = null;
      for (const id in Net.conns) if (Net.conns[id].relay) { delete Net.conns[id]; if (Net.onLeave) Net.onLeave(id); }
      if (!opened) { if (onFail) onFail(); return; }
      setTimeout(() => { if (Net.role === 'host' && Net.code === code && !Net.relay) openHostRelay(code); }, 2000); // keep the room reachable
    };
  }

  /** Create a room. onReady(code) once players can join it. */
  Net.hostGame = function (onReady, onError) {
    if (!Net.available()) { onError('Online play needs a current browser (Chrome, Edge, Firefox or Safari).'); return; }
    const ready = (code, id, peer) => { Net.peer = peer; Net.role = 'host'; Net.code = code; Net.myId = id; onReady(code); };
    // Relay only: the matchmaking server is unreachable from this network, so host through the Cinderfall server alone.
    const relayOnly = (n, why) => {
      if (!Net.hasRelay()) { onError(why); return; }
      const code = Net.makeCode();
      openHostRelay(code, () => ready(code, 'host-' + code, null), () => { if (n < 3) relayOnly(n + 1, why); else onError(why); });
    };
    const attempt = (n) => {
      if (typeof window.Peer !== 'function') { relayOnly(0, 'Online play is unavailable in this browser.'); return; }
      const code = Net.makeCode();
      let opened = false, peer;
      try { peer = new window.Peer(PREFIX + code, OPTS); } catch (e) { relayOnly(0, Net.describe(e)); return; }
      peer.on('open', (id) => { opened = true; ready(code, id, peer); if (Net.hasRelay()) openHostRelay(code); });
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          if (Net.conns[conn.peer]) { conn.close(); return; } // already here through the relay
          Net.conns[conn.peer] = conn; openFast(conn);
        });
        wire(conn);
        conn.on('close', () => { if (Net.conns[conn.peer] === conn) { delete Net.conns[conn.peer]; if (Net.onLeave) Net.onLeave(conn.peer); } });
        conn.on('error', () => { /* close handler cleans up */ });
      });
      peer.on('error', (err) => {
        if (opened) return;
        try { peer.destroy(); } catch (e) { /* ignore */ }
        if (err.type === 'unavailable-id' && n < 4) attempt(n + 1); else relayOnly(0, Net.describe(err));
      });
      peer.on('disconnected', () => { if (Net.peer === peer) { try { peer.reconnect(); } catch (e) { /* data channels keep working */ } } });
    };
    attempt(0);
  };

  // ------------------------------------------------------------ client
  /** Join a room by code. onReady() once there is a link to the host (direct or relayed). */
  Net.joinGame = function (code, onReady, onError, onStatus) {
    if (!Net.available()) { onError('Online play needs a current browser (Chrome, Edge, Firefox or Safari).'); return; }
    code = Net.cleanCode(code);
    if (code.length !== 5) { onError('Room codes are 5 characters.'); return; }
    Net.myId = '';
    let peer = null, conn = null, done = false, relaying = false, timer = 0;
    const finish = () => { done = true; clearTimeout(timer); };
    const fail = (msg) => { if (done) return; finish(); try { if (peer) peer.destroy(); } catch (e) { /* ignore */ } onError(msg); };

    const viaRelay = (why) => {
      if (done || relaying) return;
      if (!Net.hasRelay()) { fail(why); return; }
      relaying = true; clearTimeout(timer);
      if (onStatus) onStatus('Direct link blocked. Connecting through the relay…');
      try { if (conn) conn.close(); } catch (e) { /* ignore */ }
      const id = Net.myId || randomId();
      let ws;
      try { ws = new WebSocket(relayUrl(code, 'role=client&id=' + encodeURIComponent(id))); } catch (e) { fail(why); return; }
      const link = { relay: true, get open() { return ws.readyState === 1; }, send: (d) => ws.send(JSON.stringify(d)), close: () => ws.close() };
      timer = setTimeout(() => { try { ws.close(); } catch (e) { /* ignore */ } fail(why); }, 12000);
      ws.onopen = () => {
        if (done) { ws.close(); return; }
        finish();
        try { if (peer) peer.destroy(); } catch (e) { /* not needed any more */ }
        Net.peer = null; Net.myId = id; Net.role = 'client'; Net.code = code; Net.host = link; Net.relay = ws;
        onReady();
      };
      ws.onmessage = (e) => { const m = parse(e); if (m && Net.onMsg) Net.onMsg('host', m); };
      ws.onclose = () => { if (!done) fail(why); else if (Net.host === link && Net.onDrop) Net.onDrop(); };
    };

    if (typeof window.Peer !== 'function') { viaRelay('Online play is unavailable in this browser.'); return; }
    try { peer = new window.Peer(OPTS); } catch (e) { viaRelay(Net.describe(e)); return; }
    const blocked = 'Found the match but could not connect to the host. Their network may be blocking it; try again, or have someone else host.';
    peer.on('open', (id) => {
      if (done || relaying) return;
      Net.myId = id;
      conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      timer = setTimeout(() => viaRelay(blocked), Net.hasRelay() ? DIRECT_WAIT : 25000);
      conn.on('open', () => {
        if (done || relaying) { conn.close(); return; }
        finish(); Net.peer = peer; Net.role = 'client'; Net.code = code; Net.host = conn; openFast(conn, 'host'); onReady();
      });
      wire(conn, 'host');
      conn.on('error', () => viaRelay(blocked));
      conn.on('close', () => { if (Net.host === conn && Net.onDrop) Net.onDrop(); });
    });
    peer.on('error', (err) => {
      if (!done) viaRelay(Net.describe(err)); // relay-only rooms don't exist on the matchmaking server, so always try it
      else if (err.type === 'network' && Net.host && !Net.host.relay && Net.onDrop) Net.onDrop();
    });
  };

  Net.send = function (msg) { const c = Net.host; if (c && c.open) { c.send(msg); countOut(msg); } };
  Net.sendTo = function (id, msg) { const c = Net.conns[id]; if (c && c.open) { c.send(msg); countOut(msg); } };
  Net.broadcast = function (msg, except) {
    let relayed = false;
    for (const id in Net.conns) { if (id === except) continue; const c = Net.conns[id]; if (c.relay) relayed = true; else if (c.open) { c.send(msg); countOut(msg); } }
    const ws = Net.relay;
    if (relayed && ws && ws.readyState === 1) { const str = JSON.stringify({ b: 1, x: except || null, d: msg }); ws.send(str); countOut(msg, str); }
  };
  /** Fast versions for messages where only the newest one matters (positions). A lost one is simply skipped. */
  Net.sendFast = function (msg) { const c = Net.host; if (c) sendFast(c, msg); };
  Net.sendToFast = function (id, msg) { const c = Net.conns[id]; if (c) sendFast(c, msg); };
  Net.broadcastFast = function (msg, except) {
    let relayed = false;
    for (const id in Net.conns) { if (id === except) continue; const c = Net.conns[id]; if (c.relay) relayed = true; else sendFast(c, msg); }
    const ws = Net.relay;
    if (relayed && ws && ws.readyState === 1) { const str = JSON.stringify({ b: 1, x: except || null, d: msg }); ws.send(str); countOut(msg, str); }
  };
  /** How this browser is linked: 'direct', 'direct+fast' (fast channel open), 'relay', or a mix on the host. */
  Net.linkInfo = function () {
    const kind = (c) => (c.relay ? 'relay' : c.fast && c.fast.readyState === 'open' ? 'direct+fast' : 'direct');
    if (Net.role === 'client') return Net.host ? kind(Net.host) : '—';
    const out = {}; for (const id in Net.conns) out[id] = kind(Net.conns[id]);
    return out;
  };
  Net.close = function () {
    const ws = Net.relay; Net.relay = null;
    try { if (ws) ws.close(); } catch (e) { /* ignore */ }
    try { if (Net.peer) Net.peer.destroy(); } catch (e) { /* ignore */ }
    Net.peer = null; Net.conns = {}; Net.host = null; Net.role = null; Net.code = ''; Net.myId = '';
  };
})(window.CF);
