'use strict';
/* Cinderfall — where the game server lives (server/worker.js: leaderboard, profiles and saves, multiplayer relay).
   Leave empty to play without it: the leaderboard, coins and skins stay on this computer and multiplayer is peer-to-peer only.
   For testing, ?server=http://127.0.0.1:8787 in the page address points this tab at another server (?server= for none). */
window.CF = window.CF || {};
window.CF.SERVER = 'https://cinderfall.trenttimmerman.workers.dev';
try { const q = new URLSearchParams(location.search).get('server'); if (q !== null && (q === '' || /^https?:\/\/[^\s]+$/.test(q))) window.CF.SERVER = q; } catch (e) { /* old browser */ }
