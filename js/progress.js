'use strict';
/* Cinderfall — campaign progress. Each campaign keeps its own save: the last checkpoint (after a cleared part or a
   mid-part objective), with loadout, score, stats and mission state, so a run survives closing the tab.
   Saves are checksummed and validated on load; anything damaged is dropped instead of breaking the game.
   With the Cinderfall server, a copy follows your profile (and your save code) to other devices. */
(function (CF) {
  const KEY = 'cinderfall.progress.v1';
  const Pg = CF.Progress = { data: { v: 1, saves: {}, cleared: {}, resetAt: 0 }, damaged: [] };

  // FNV-1a over the save's JSON: catches truncated or hand-edited saves
  const hash = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  const body = (s) => { const o = Object.assign({}, s); delete o.sum; return JSON.stringify(o); };
  const fin = (v) => typeof v === 'number' && isFinite(v);

  /** Loadouts hold Infinity (the sidearm's reserve), which JSON can't: store it as 'inf'. */
  const packLoadout = (lo) => {
    const w = {}; for (const id in lo.weapons) w[id] = { mag: lo.weapons[id].mag, reserve: lo.weapons[id].reserve === Infinity ? 'inf' : lo.weapons[id].reserve };
    return { weapons: w, current: lo.current, grenades: lo.grenades };
  };
  const unpackLoadout = (lo) => {
    const w = {}; for (const id in lo.weapons) w[id] = { mag: lo.weapons[id].mag, reserve: lo.weapons[id].reserve === 'inf' ? Infinity : lo.weapons[id].reserve };
    return { weapons: w, current: lo.current, grenades: lo.grenades };
  };

  function valid(s, id) {
    try {
      const C = CF.Campaigns[id];
      if (!C || !s || s.v !== 1 || s.campaign !== id || s.sum !== hash(body(s))) return false;
      const n = C.mission.phases.length;
      if (!Number.isInteger(s.phase) || s.phase < 0 || s.phase >= n || !CF.DIFF[s.diff] || typeof s.noDrones !== 'boolean' || !fin(s.date)) return false;
      const cp = s.cp;
      if (!cp || cp.phase !== s.phase || !cp.spawn || !['x', 'y', 'z', 'yaw'].every((k) => fin(cp.spawn[k])) || !fin(cp.armor) || cp.armor < 0 || cp.armor > 100 || !fin(cp.score) || cp.score < 0) return false;
      const lo = cp.loadout, WD = CF.Weapons.defs;
      if (!lo || !lo.weapons || !WD[lo.current] || !lo.weapons[lo.current] || !Number.isInteger(lo.grenades) || lo.grenades < 0 || lo.grenades > 4) return false;
      for (const w in lo.weapons) { const x = lo.weapons[w]; if (!WD[w] || !Number.isInteger(x.mag) || x.mag < 0 || x.mag > WD[w].mag || !(x.reserve === 'inf' || (Number.isInteger(x.reserve) && x.reserve >= 0))) return false; }
      const m = cp.mission;
      if (!m || typeof m !== 'object') return false;
      if (id === 'foundry' && !(Array.isArray(m.breakers) && m.breakers.every((b) => /^breaker[ABC]$/.test(b)))) return false;
      if (id === 'halden' && !(Array.isArray(m.cells) && m.cells.every((c) => /^cell[123]$/.test(c)) && typeof m.mastLive === 'boolean' && Number.isInteger(m.lit) && m.lit >= 0 && m.lit <= 3)) return false;
      if (!s.stats || !['shots', 'hits', 'kills', 'deaths', 'time'].every((k) => fin(s.stats[k]) && s.stats[k] >= 0)) return false;
      return true;
    } catch (e) { return false; }
  }

  Pg.load = function () {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; this.damaged.push('all'); }
    const d = { v: 1, saves: {}, cleared: {}, resetAt: 0 };
    if (raw && typeof raw === 'object') {
      d.resetAt = fin(raw.resetAt) ? raw.resetAt : 0;
      if (raw.cleared && typeof raw.cleared === 'object') for (const k in raw.cleared) if (fin(raw.cleared[k])) d.cleared[k] = raw.cleared[k];
      for (const id in (raw.saves || {})) {
        const s = raw.saves[id];
        if (valid(s, id)) d.saves[id] = s; else this.damaged.push(id);
      }
    }
    this.data = d;
    if (this.damaged.length) this.persist(false);
    return d;
  };
  Pg.persist = function (cloud) {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked: the run still plays */ }
    if (cloud !== false && CF.Profile) CF.Profile.pushProgress(this.data);
  };
  Pg.get = function (id) { return this.data.saves[id] || null; };
  /** Store a checkpoint for the running campaign. meta: { run, stats, claimed } */
  Pg.store = function (id, cp, meta) {
    const s = {
      v: 1, campaign: id, diff: CF.settings.difficulty, noDrones: !!CF.settings.noDrones, phase: cp.phase,
      cp: { phase: cp.phase, spawn: { x: +cp.spawn.x.toFixed(2), y: +cp.spawn.y.toFixed(2), z: +cp.spawn.z.toFixed(2), yaw: +(cp.spawn.yaw || 0).toFixed(3) }, armor: Math.round(cp.armor), loadout: packLoadout(cp.loadout), score: Math.round(cp.score), mission: JSON.parse(JSON.stringify(cp.mission)) },
      stats: Object.assign({}, meta.stats), run: meta.run || null, runId: meta.runId || null, claimed: meta.claimed || 0, date: Date.now()
    };
    s.sum = hash(body(s));
    this.data.saves[id] = s;
    this.persist();
  };
  /** The run ended (finished, or restarted from scratch): drop its save and remember when, so an older copy elsewhere doesn't come back. */
  Pg.clear = function (id) { delete this.data.saves[id]; this.data.cleared[id] = Date.now(); this.persist(); };
  Pg.resetAll = function () { this.data = { v: 1, saves: {}, cleared: {}, resetAt: Date.now() }; this.persist(); };
  /** A save as the game wants it back. */
  Pg.checkpoint = function (s) { return Object.assign({}, s.cp, { loadout: unpackLoadout(s.cp.loadout), mission: JSON.parse(JSON.stringify(s.cp.mission)) }); };

  /** Merge the server's copy: the newest valid save per campaign wins; resets and finished runs win over older saves. */
  Pg.mergeCloud = function (cloud, preferCloud) {
    if (!cloud || typeof cloud !== 'object') cloud = {};
    const d = this.data, before = JSON.stringify(d);
    d.resetAt = Math.max(d.resetAt || 0, fin(cloud.resetAt) ? cloud.resetAt : 0);
    const cc = cloud.cleared && typeof cloud.cleared === 'object' ? cloud.cleared : {};
    for (const k in cc) if (fin(cc[k])) d.cleared[k] = Math.max(d.cleared[k] || 0, cc[k]);
    for (const id in CF.Campaigns) {
      const mine = d.saves[id], theirs = cloud.saves && cloud.saves[id];
      const ok = theirs && valid(theirs, id);
      if (ok && (!mine || theirs.date > mine.date || (preferCloud && theirs.date !== mine.date))) d.saves[id] = theirs;
      const s = d.saves[id];
      if (s && (s.date < d.resetAt || s.date < (d.cleared[id] || 0))) delete d.saves[id];
    }
    const changed = JSON.stringify(d) !== before;
    if (changed || JSON.stringify(cloud) !== JSON.stringify(d)) this.persist(true);
    if (changed && CF.Game && CF.Game.screen === 'campaign') CF.Game.renderCampaigns();
  };

  /** "Part 03 · The Uplink" for a save. */
  Pg.label = function (s) { const ph = CF.Campaigns[s.campaign].mission.phases[s.phase]; return ph ? ph.num + ' · ' + ph.title : ''; };
})(window.CF);
