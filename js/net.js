'use strict';
/* Cinderfall — peer-to-peer networking (PeerJS). Star topology: the host relays between clients. */
(function (CF) {
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const PREFIX = 'cinderfall-v1-';
  // STUN finds each player's public address; TURN relays traffic when routers block a direct
  // link (mobile hotspots, school/office Wi-Fi, strict home NATs). Swap in your own TURN
  // credentials here if the public relay is overloaded.
  const ICE = { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ] };
  const OPTS = { debug: 0, config: ICE };
  const Net = CF.Net = { peer: null, conns: {}, host: null, role: null, code: '', myId: '', onMsg: null, onLeave: null, onDrop: null };

  Net.available = () => typeof window.Peer === 'function' && typeof window.RTCPeerConnection === 'function';
  Net.makeCode = () => { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; };
  Net.cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  Net.describe = function (err) {
    const t = err && err.type;
    if (t === 'browser-incompatible') return 'This browser does not support online play.';
    if (t === 'peer-unavailable') return 'No match found with that code. Check it and try again.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Could not reach the matchmaking server. Check your internet connection and try again.';
    if (t === 'unavailable-id') return 'That room code is already in use. Try hosting again.';
    return 'Connection problem (' + (t || (err && err.message) || 'unknown') + ').';
  };

  function wire(conn, fromId) {
    conn.on('data', (d) => { if (Net.onMsg && d && typeof d === 'object') Net.onMsg(fromId || conn.peer, d); });
  }

  /** Create a room. onReady(code) once the room is registered with the matchmaking server. */
  Net.hostGame = function (onReady, onError) {
    if (!Net.available()) { onError('Online play needs a browser with WebRTC (current Chrome, Edge, Firefox or Safari).'); return; }
    const attempt = (n) => {
      const code = Net.makeCode();
      let opened = false, peer;
      try { peer = new window.Peer(PREFIX + code, OPTS); } catch (e) { onError(Net.describe(e)); return; }
      peer.on('open', (id) => { opened = true; Net.peer = peer; Net.role = 'host'; Net.code = code; Net.myId = id; onReady(code); });
      peer.on('connection', (conn) => {
        conn.on('open', () => { Net.conns[conn.peer] = conn; });
        wire(conn);
        conn.on('close', () => { if (Net.conns[conn.peer]) { delete Net.conns[conn.peer]; if (Net.onLeave) Net.onLeave(conn.peer); } });
        conn.on('error', () => { /* close handler cleans up */ });
      });
      peer.on('error', (err) => {
        if (!opened) {
          try { peer.destroy(); } catch (e) { /* ignore */ }
          if (err.type === 'unavailable-id' && n < 4) attempt(n + 1); else onError(Net.describe(err));
        }
      });
      peer.on('disconnected', () => { if (Net.peer === peer) { try { peer.reconnect(); } catch (e) { /* data channels keep working */ } } });
    };
    attempt(0);
  };

  /** Join a room by code. onReady() once the data channel to the host is open. */
  Net.joinGame = function (code, onReady, onError) {
    if (!Net.available()) { onError('Online play needs a browser with WebRTC (current Chrome, Edge, Firefox or Safari).'); return; }
    code = Net.cleanCode(code);
    if (code.length !== 5) { onError('Room codes are 5 characters.'); return; }
    let peer, done = false;
    const fail = (msg) => { if (done) return; done = true; try { peer.destroy(); } catch (e) { /* ignore */ } onError(msg); };
    try { peer = new window.Peer(OPTS); } catch (e) { onError(Net.describe(e)); return; }
    peer.on('open', (id) => {
      Net.peer = peer; Net.myId = id; Net.role = 'client'; Net.code = code;
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const timer = setTimeout(() => fail('Found the match but could not connect to the host. Their network may be blocking it; try again, or have someone else host.'), 25000);
      conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); Net.host = conn; onReady(); });
      wire(conn, 'host');
      conn.on('close', () => { if (Net.host === conn && Net.onDrop) Net.onDrop(); });
    });
    peer.on('error', (err) => { if (!done) fail(Net.describe(err)); else if (err.type === 'network' && Net.onDrop) Net.onDrop(); });
  };

  Net.send = function (msg) { const c = Net.host; if (c && c.open) c.send(msg); };
  Net.sendTo = function (id, msg) { const c = Net.conns[id]; if (c && c.open) c.send(msg); };
  Net.broadcast = function (msg, except) { for (const id in Net.conns) { if (id === except) continue; const c = Net.conns[id]; if (c.open) c.send(msg); } };
  Net.close = function () {
    try { if (Net.peer) Net.peer.destroy(); } catch (e) { /* ignore */ }
    Net.peer = null; Net.conns = {}; Net.host = null; Net.role = null; Net.code = '';
  };
})(window.CF);
