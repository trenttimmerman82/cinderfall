'use strict';
/* Cinderfall — where the game server lives (server/worker.js: leaderboard, profiles and saves, multiplayer relay).
   Leave empty to play without it: the leaderboard, coins and skins stay on this computer and multiplayer is peer-to-peer only.
   For testing, ?server=http://127.0.0.1:8787 in the page address points this tab at another server (?server= for none). */
window.CF = window.CF || {};
window.CF.SERVER = 'https://cinderfall.trenttimmerman.workers.dev';
try { const q = new URLSearchParams(location.search).get('server'); if (q !== null && (q === '' || /^https?:\/\/[^\s]+$/.test(q))) window.CF.SERVER = q; } catch (e) { /* old browser */ }

/* Multiplayer smoothing. Other players are drawn this many milliseconds in the past, so there are always two position
   updates to blend between (updates arrive every 50 ms). Higher is smoother on bad connections; lower means a player who
   just ducked behind cover can be hit for less time. ?interp=80 in the page address overrides it for testing (0–250). */
window.CF.NET = { interp: 100 };
try { const q = new URLSearchParams(location.search).get('interp'); if (q !== null && q !== '' && +q >= 0 && +q <= 250) window.CF.NET.interp = +q; } catch (e) { /* old browser */ }
