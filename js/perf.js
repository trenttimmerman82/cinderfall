'use strict';
/* Cinderfall — performance overlay (F3). Frame time split into game logic and rendering, what the GPU was asked to
   draw, the internal render scale, and in multiplayer: link type, ping, messages and bandwidth each way.
   Use it to tell whether slowdowns come from the CPU (update), the GPU (render, draw calls) or the network. */
(function (CF) {
  const Perf = CF.Perf = { on: false, el: null, t0: 0, t1: 0, acc: null, showT: 0, last: null };
  const zero = () => ({ n: 0, frame: 0, worst: 0, upd: 0, rnd: 0 });
  Perf.acc = zero();

  Perf.toggle = function () {
    this.on = !this.on;
    CF.Net.stats.on = this.on;
    const r = CF.Post.renderer; if (r) r.info.autoReset = !this.on; // count every pass of a frame, not just the last one
    if (!this.el) { this.el = document.createElement('pre'); this.el.className = 'perf'; document.body.appendChild(this.el); }
    this.el.hidden = !this.on;
    this.acc = zero(); this.showT = 0; this.last = null;
    if (this.on) this.el.textContent = 'Measuring…';
  };
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F3' || e.repeat) return;
    e.preventDefault(); // F3 is "find in page" in some browsers
    Perf.toggle();
  });

  // G.loop calls these around its update and render, so the overlay costs nothing while it's closed
  Perf.begin = function () { if (!this.on) return; this.t0 = performance.now(); const r = CF.Post.renderer; if (r) r.info.reset(); };
  Perf.mid = function () { if (this.on) this.t1 = performance.now(); };
  Perf.end = function (raw) {
    if (!this.on) return;
    const t2 = performance.now(), a = this.acc;
    a.n++; a.frame += raw * 1000; a.worst = Math.max(a.worst, raw * 1000); a.upd += this.t1 - this.t0; a.rnd += t2 - this.t1;
    this.showT += raw;
    if (this.showT >= 0.5) { this.show(this.showT); this.showT = 0; this.acc = zero(); }
  };

  Perf.show = function (span) {
    const a = this.acc, n = Math.max(1, a.n), r = CF.Post.renderer, info = r ? r.info : null, P = CF.Post;
    const lines = [
      'FPS        ' + Math.round(a.n / span) + '   frame ' + (a.frame / n).toFixed(1) + ' ms (worst ' + a.worst.toFixed(1) + ')',
      'CPU update ' + (a.upd / n).toFixed(2) + ' ms   render submit ' + (a.rnd / n).toFixed(2) + ' ms',
      'GPU        ' + (info ? info.render.calls + ' draw calls · ' + Math.round(info.render.triangles / 1000) + 'k tris' : '—'),
      'Scene      ' + (info ? info.programs.length + ' shaders · ' + info.memory.geometries + ' geometries · ' + info.memory.textures + ' textures' : '—'),
      'Resolution ' + P.W + '×' + P.H + ' (scale ' + (P.effScale || P.scale).toFixed(2) + ', quality ' + CF.bootQuality + ')'
    ];
    const MP = CF.MP, Net = CF.Net;
    if (MP && MP.active) {
      const s = Net.stats, now = performance.now(), prev = this.last, dt = prev ? (now - prev.t) / 1000 : 0;
      const rate = (k) => (prev && dt > 0 ? (s[k] - prev[k]) / dt : 0);
      lines.push('',
        'Net        ' + MP.role + ' · room ' + Net.code + ' · smoothing ' + CF.NET.interp + ' ms',
        'Traffic    in ' + Math.round(rate('inN')) + ' msg/s ' + (rate('inB') / 1024).toFixed(1) + ' KB/s · out ' + Math.round(rate('outN')) + ' msg/s ' + (rate('outB') / 1024).toFixed(1) + ' KB/s');
      const link = Net.linkInfo();
      if (MP.role === 'client') lines.push('Host       ' + link + ' · ping ' + (MP.ping ? MP.ping + ' ms' : '…'));
      else for (const id in MP.players) {
        if (id === MP.myId) continue;
        const pl = MP.players[id];
        lines.push('  ' + String(pl.name).padEnd(16) + ' ' + (link[id] || '—').padEnd(12) + ' ping ' + (pl.ping ? pl.ping + ' ms' : '…'));
      }
      this.last = { t: now, inN: s.inN, outN: s.outN, inB: s.inB, outB: s.outB };
    }
    lines.push('', 'F3 to close');
    this.el.textContent = lines.join('\n');
  };
})(window.CF);
