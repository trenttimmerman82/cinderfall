'use strict';
/* Cinderfall — procedural texture foundry. Everything is generated on canvas at load. */
(function (CF) {
  const U = CF.U;
  const T = CF.Tex = { list: {}, maxAniso: 4 };
  let S = 512;

  // ------------------------------------------------------------ noise
  function tileNoise(size, fx, fy, oct, seed, pers) {
    pers = pers || 0.5;
    const out = new Float32Array(size * size);
    const r = U.mulberry32(seed);
    let amp = 1;
    const x0a = new Int32Array(size), x1a = new Int32Array(size), txa = new Float32Array(size);
    for (let o = 0; o < oct; o++) {
      const gx = fx << o, gy = fy << o;
      const lat = new Float32Array(gx * gy);
      for (let i = 0; i < lat.length; i++) lat[i] = r();
      const sx = gx / size, sy = gy / size;
      for (let x = 0; x < size; x++) {
        const f = x * sx, x0 = f | 0, t = f - x0;
        x0a[x] = x0 % gx; x1a[x] = (x0 + 1) % gx; txa[x] = t * t * (3 - 2 * t);
      }
      for (let y = 0; y < size; y++) {
        const f = y * sy, y0 = f | 0; let t = f - y0; t = t * t * (3 - 2 * t);
        const r0 = (y0 % gy) * gx, r1 = ((y0 + 1) % gy) * gx, row = y * size;
        for (let x = 0; x < size; x++) {
          const a = lat[r0 + x0a[x]], b = lat[r0 + x1a[x]], c = lat[r1 + x0a[x]], d = lat[r1 + x1a[x]];
          const tx = txa[x], top = a + (b - a) * tx, bot = c + (d - c) * tx;
          out[row + x] += amp * (top + (bot - top) * t);
        }
      }
      amp *= pers;
    }
    // normalize to 0..1 for predictable thresholds
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < out.length; i++) { const v = out[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const k = 1 / (mx - mn || 1);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) * k;
    return out;
  }
  T.tileNoise = tileNoise;
  const sstep = U.smoothstep;

  function stamp(arr, size, cx, cy, r, val, mode) {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy); if (d > r) continue;
      const idx = (((cy + dy) % size + size) % size) * size + (((cx + dx) % size + size) % size);
      const v = val * (1 - d / r);
      if (mode === 'max') { if (v > arr[idx]) arr[idx] = v; } else arr[idx] += v;
    }
  }
  function scratch(arr, size, rnd, count, len, val) {
    for (let k = 0; k < count; k++) {
      let x = rnd() * size, y = rnd() * size; const a = rnd() * Math.PI * 2, l = len * (0.3 + rnd());
      const dx = Math.cos(a), dy = Math.sin(a);
      for (let s = 0; s < l; s++) {
        const idx = ((((y | 0) % size) + size) % size) * size + ((((x | 0) % size) + size) % size);
        arr[idx] = Math.max(arr[idx], val * (1 - s / l * 0.5));
        x += dx; y += dy;
      }
    }
  }

  // ------------------------------------------------------------ canvas helpers
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function toTex(c, o) {
    o = o || {};
    const t = new THREE.CanvasTexture(c);
    if (o.repeat !== false) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = o.aniso === false ? 1 : T.maxAniso;
    t.needsUpdate = true;
    return t;
  }
  // rgb: Float32Array(n*3) in 0..1 (sRGB-ish display values)
  function rgbTex(w, h, rgb, o) {
    const c = makeCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    for (let i = 0, n = w * h; i < n; i++) {
      d[i * 4] = rgb[i * 3] * 255; d[i * 4 + 1] = rgb[i * 3 + 1] * 255; d[i * 4 + 2] = rgb[i * 3 + 2] * 255; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (o && o.post) o.post(ctx, w, h);
    return toTex(c, o);
  }
  function grayTex(w, h, g, o) {
    const c = makeCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    for (let i = 0, n = w * h; i < n; i++) { const v = U.clamp(g[i], 0, 1) * 255; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return toTex(c, Object.assign({ srgb: false }, o));
  }
  function rgbaTex(w, h, fn, o) {
    const c = makeCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, px = fn(x / (w - 1), y / (h - 1), x, y);
      d[i] = px[0] * 255; d[i + 1] = px[1] * 255; d[i + 2] = px[2] * 255; d[i + 3] = px[3] * 255;
    }
    ctx.putImageData(img, 0, 0);
    if (o && o.post) o.post(ctx, w, h);
    return toTex(c, Object.assign({ repeat: false }, o));
  }
  function normalTex(w, h, hgt, strength) {
    const c = makeCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, yr = y * w;
      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w, xp = (x + 1) % w;
        const nx = (hgt[yr + xm] - hgt[yr + xp]) * strength;
        const ny = (hgt[yp + x] - hgt[ym + x]) * strength;
        const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1), i = (yr + x) * 4;
        d[i] = (nx * inv * 0.5 + 0.5) * 255; d[i + 1] = (ny * inv * 0.5 + 0.5) * 255; d[i + 2] = (inv * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTex(c, { srgb: false });
  }

  // ------------------------------------------------------------ surfaces
  function makeConcrete() {
    const n = S * S, rnd = U.mulberry32(104);
    const n1 = tileNoise(S, 4, 4, 6, 101, 0.55), n2 = tileNoise(S, 2, 2, 4, 102, 0.6), n3 = tileNoise(S, 32, 32, 2, 103);
    const pit = new Float32Array(n);
    for (let k = 0; k < n / 260; k++) stamp(pit, S, rnd() * S | 0, rnd() * S | 0, 1 + rnd() * 2.2, 1, 'max');
    for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 2; gy++) stamp(pit, S, ((gx + 0.5) * S / 4) | 0, ((gy + 0.25) * S / 2) | 0, S / 110, 1.4, 'max');
    const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = (i / S) | 0, seam = (y % (S / 2)) < 2 ? 1 : 0;
      let v = 0.56 + (n1[i] - 0.5) * 0.28 + (n3[i] - 0.5) * 0.1;
      const st = Math.max(0, n2[i] - 0.55) * 1.1;
      v *= 1 - st; v -= pit[i] * 0.22; v *= seam ? 0.6 : 1;
      rgb[i * 3] = v * 0.94; rgb[i * 3 + 1] = v * 0.96; rgb[i * 3 + 2] = v;
      hgt[i] = n1[i] * 0.35 + n3[i] * 0.3 - pit[i] * 0.9 - seam * 0.5;
      rough[i] = 0.8 + st * 0.25 - (n3[i] - 0.5) * 0.1;
    }
    T.list.concrete = { map: rgbTex(S, S, rgb), normalMap: normalTex(S, S, hgt, 2.2), roughnessMap: grayTex(S, S, rough) };
  }

  function makeAsphalt() {
    const n = S * S, rnd = U.mulberry32(204);
    const n1 = tileNoise(S, 8, 8, 5, 201), n2 = tileNoise(S, 3, 3, 4, 202, 0.55), n3 = tileNoise(S, 64, 64, 1, 203);
    const crack = new Float32Array(n);
    for (let k = 0; k < 10; k++) {
      let x = rnd() * S, y = rnd() * S, a = rnd() * 6.28;
      for (let s = 0; s < 160; s++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a); y += Math.sin(a); stamp(crack, S, x | 0, y | 0, 1.2, 1, 'max'); }
    }
    const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0.2 + (n1[i] - 0.5) * 0.1 + (n3[i] - 0.5) * 0.12;
      if (rnd() < 0.006) v += 0.2 * rnd();
      const wet = sstep(0.62, 0.72, n2[i]);
      v *= 1 - wet * 0.4; v *= 1 - crack[i] * 0.6;
      rgb[i * 3] = v * 0.97; rgb[i * 3 + 1] = v * 0.98; rgb[i * 3 + 2] = v * 1.02;
      hgt[i] = n3[i] * 0.5 + n1[i] * 0.3 - crack[i] - wet * 0.3;
      rough[i] = 0.93 - wet * 0.7;
    }
    T.list.asphalt = { map: rgbTex(S, S, rgb), normalMap: normalTex(S, S, hgt, 1.1), roughnessMap: grayTex(S, S, rough) };
  }

  function makeDiamond() {
    const n = S * S, cell = S / 16, rnd = U.mulberry32(304);
    const grime = tileNoise(S, 3, 3, 4, 301), fine = tileNoise(S, 32, 32, 2, 302);
    const scr = new Float32Array(n); scratch(scr, S, rnd, 120, 60, 1);
    const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
    const c = Math.SQRT1_2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, cx = (x / cell) | 0, cy = (y / cell) | 0;
      const u = (x % cell) / cell - 0.5, v = (y % cell) / cell - 0.5, s = ((cx + cy) & 1) ? c : -c;
      const ru = u * c - v * s, rv = u * s + v * c;
      const e = (ru / 0.36) * (ru / 0.36) + (rv / 0.09) * (rv / 0.09);
      const bump = e < 1 ? Math.sqrt(1 - e) : 0;
      const g = sstep(0.45, 0.8, grime[i]);
      let val = 0.46 + (fine[i] - 0.5) * 0.08 + bump * 0.08 + scr[i] * 0.12 - g * 0.22;
      rgb[i * 3] = val * 0.97; rgb[i * 3 + 1] = val; rgb[i * 3 + 2] = val * 1.04;
      hgt[i] = bump * 0.9 + fine[i] * 0.1 - scr[i] * 0.1;
      rough[i] = 0.42 + g * 0.35 - bump * 0.12 - scr[i] * 0.1;
    }
    T.list.metalFloor = { map: rgbTex(S, S, rgb), normalMap: normalTex(S, S, hgt, 3.2), roughnessMap: grayTex(S, S, rough) };
  }

  function makeCorrugated(name, paint, rustAmt, seed) {
    const n = S * S, ribs = 12, rnd = U.mulberry32(seed);
    const streak = tileNoise(S, 48, 2, 3, seed + 1), spots = tileNoise(S, 6, 6, 4, seed + 2), fine = tileNoise(S, 32, 32, 2, seed + 3);
    const chips = new Float32Array(n); scratch(chips, S, rnd, 60, 14, 1);
    const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, t = (x / (S / ribs)) % 1;
      const rib = sstep(0.08, 0.28, t) - sstep(0.58, 0.78, t);
      const r = sstep(0.58, 0.8, streak[i] * 0.65 + spots[i] * 0.45) * rustAmt;
      const shade = 0.86 + (fine[i] - 0.5) * 0.14 - chips[i] * 0.2;
      const rc = [0.36 + fine[i] * 0.1, 0.17, 0.08];
      for (let k = 0; k < 3; k++) rgb[i * 3 + k] = U.lerp(paint[k] * shade, rc[k], r);
      hgt[i] = rib + fine[i] * 0.06 - chips[i] * 0.05;
      rough[i] = 0.5 + r * 0.4 + chips[i] * 0.1;
    }
    T.list[name] = { map: rgbTex(S, S, rgb), normalMap: normalTex(S, S, hgt, 2.6), roughnessMap: grayTex(S, S, rough) };
  }

  function makeContainers() {
    const W = S, H = S / 2, n = W * H, rnd = U.mulberry32(404);
    const rust = tileNoise(W, 12, 12, 4, 401), streak = tileNoise(W, 64, 2, 3, 402), fine = tileNoise(W, 32, 32, 2, 403);
    const hgt = new Float32Array(n), mask = new Float32Array(n), shade = new Float32Array(n);
    const scr = new Float32Array(W * W); scratch(scr, W, rnd, 90, 30, 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = y * W + x; // noise arrays are W*W; use top half
      const rail = y < H * 0.05 || y > H * 0.95 ? 1 : 0, post = x < W * 0.025 || x > W * 0.975 ? 1 : 0;
      const t = (x / (W / 36)) % 1;
      const rib = (rail || post) ? 0.4 : sstep(0.1, 0.3, t) - sstep(0.6, 0.8, t);
      hgt[i] = rib + fine[j] * 0.05 - scr[j] * 0.05;
      mask[i] = sstep(0.62, 0.85, rust[j] * 0.6 + streak[j] * 0.5 + (rail ? 0.2 : 0));
      shade[i] = (0.88 + (fine[j] - 0.5) * 0.14 - scr[j] * 0.25) * (rail || post ? 0.75 : 1);
    }
    const colors = { red: [0.55, 0.13, 0.09], blue: [0.09, 0.23, 0.42], orange: [0.78, 0.39, 0.08], green: [0.15, 0.32, 0.19], white: [0.62, 0.64, 0.64] };
    const codes = { red: 'CFXU 704218', blue: 'MRSK 551930', orange: 'CFXU 220761', green: 'TGHU 880412', white: 'CSTN 004117' };
    T.list.containers = {};
    const nrm = normalTex(W, H, hgt, 2.8);
    for (const key in colors) {
      const col = colors[key], rgb = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = mask[i], s = shade[i];
        rgb[i * 3] = U.lerp(col[0] * s, 0.34, r); rgb[i * 3 + 1] = U.lerp(col[1] * s, 0.16, r); rgb[i * 3 + 2] = U.lerp(col[2] * s, 0.07, r);
      }
      const map = rgbTex(W, H, rgb, {
        post: (ctx) => {
          ctx.fillStyle = 'rgba(235,232,224,0.82)';
          ctx.font = 'bold ' + (H * 0.075 | 0) + 'px "Arial Narrow", Arial, sans-serif';
          ctx.fillText(codes[key], W * 0.05, H * 0.17);
          ctx.font = 'bold ' + (H * 0.05 | 0) + 'px Arial, sans-serif';
          ctx.fillText('MAX GROSS 30,480 KG', W * 0.05, H * 0.25);
          ctx.globalAlpha = 0.22; ctx.font = '900 ' + (H * 0.28 | 0) + 'px Impact, "Arial Black", sans-serif';
          ctx.fillText('CINDER', W * 0.34, H * 0.66); ctx.globalAlpha = 1;
        }
      });
      T.list.containers[key] = { map, normalMap: nrm };
    }
  }

  function makeCrate() {
    const C = S / 2, n = C * C, fine = tileNoise(C, 16, 16, 3, 501), grime = tileNoise(C, 4, 4, 3, 502);
    const rgb = new Float32Array(n * 3), hgt = new Float32Array(n);
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
      const i = y * C + x, u = x / C, v = y / C;
      const border = (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92) ? 1 : 0;
      const d1 = Math.abs(u - v), d2 = Math.abs(u + v - 1);
      const brace = !border && (d1 < 0.05 || d2 < 0.05) ? 1 : 0;
      const g = sstep(0.5, 0.9, grime[i]);
      const s = (0.9 + (fine[i] - 0.5) * 0.15) * (border ? 0.82 : 1) * (1 - g * 0.3);
      rgb[i * 3] = 0.27 * s; rgb[i * 3 + 1] = 0.31 * s; rgb[i * 3 + 2] = 0.21 * s;
      hgt[i] = border * 0.8 + brace * 0.6 + fine[i] * 0.05;
    }
    const map = rgbTex(C, C, rgb, {
      post: (ctx, w, h) => {
        ctx.fillStyle = 'rgba(230,226,210,0.8)'; ctx.font = '900 ' + (h * 0.14 | 0) + 'px Impact, "Arial Black", sans-serif';
        ctx.textAlign = 'center'; ctx.fillText('CF-7', w * 0.5, h * 0.36);
        ctx.fillStyle = 'rgba(255,170,40,0.85)'; ctx.fillRect(w * 0.3, h * 0.62, w * 0.4, h * 0.08);
        ctx.fillStyle = 'rgba(20,20,20,0.9)'; ctx.font = 'bold ' + (h * 0.055 | 0) + 'px Arial, sans-serif'; ctx.fillText('MUNITIONS', w * 0.5, h * 0.68);
      }
    });
    T.list.crate = { map, normalMap: normalTex(C, C, hgt, 3) };
  }

  function makeHazard() {
    const C = S / 2, n = C * C, wear = tileNoise(C, 8, 8, 4, 601), rnd = U.mulberry32(602);
    const scr = new Float32Array(n); scratch(scr, C, rnd, 40, 20, 1);
    const rgb = new Float32Array(n * 3), rough = new Float32Array(n);
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
      const i = y * C + x, stripe = ((x + y) / (C / 4)) % 1 < 0.5;
      const w = Math.max(sstep(0.72, 0.9, wear[i]), scr[i]);
      const base = stripe ? [0.86, 0.62, 0.08] : [0.06, 0.06, 0.06];
      for (let k = 0; k < 3; k++) rgb[i * 3 + k] = U.lerp(base[k] * (0.9 + wear[i] * 0.15), 0.4, w);
      rough[i] = 0.55 + w * 0.2;
    }
    T.list.hazard = { map: rgbTex(C, C, rgb), roughnessMap: grayTex(C, C, rough) };
  }

  function makePaintMetal() {
    const n = S * S, rnd = U.mulberry32(704);
    const grime = tileNoise(S, 4, 4, 5, 701), fine = tileNoise(S, 24, 24, 2, 702), drip = tileNoise(S, 40, 3, 3, 703);
    const scr = new Float32Array(n); scratch(scr, S, rnd, 160, 24, 1);
    const rgb = new Float32Array(n * 3), rough = new Float32Array(n), hgt = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const g = sstep(0.5, 0.85, grime[i] * 0.7 + drip[i] * 0.4);
      const v = (0.78 + (fine[i] - 0.5) * 0.1) * (1 - g * 0.45) + scr[i] * 0.15;
      rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v;
      rough[i] = 0.45 + g * 0.35 - scr[i] * 0.15;
      hgt[i] = fine[i] * 0.15 - scr[i] * 0.3;
    }
    T.list.paintMetal = { map: rgbTex(S, S, rgb), roughnessMap: grayTex(S, S, rough), normalMap: normalTex(S, S, hgt, 1.2) };
  }

  function makeMolten() {
    const n = S * S, a = tileNoise(S, 5, 5, 5, 801, 0.55), b = tileNoise(S, 12, 12, 3, 802);
    const rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const ridge = 1 - Math.abs(a[i] * 2 - 1);
      const hot = sstep(0.55, 0.95, ridge * 0.8 + b[i] * 0.35);
      const core = sstep(0.85, 1.0, ridge * 0.8 + b[i] * 0.3);
      rgb[i * 3] = U.lerp(0.16, 1.0, hot); rgb[i * 3 + 1] = U.lerp(0.035, 0.42, hot) + core * 0.4; rgb[i * 3 + 2] = U.lerp(0.01, 0.06, hot) + core * 0.25;
    }
    T.list.molten = { map: rgbTex(S, S, rgb) };
  }

  function makeScreen(lines, color, w, h) {
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#04080a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
    let y = h * 0.16;
    lines.forEach((ln, i) => {
      const big = i === 0;
      ctx.font = (big ? 'bold ' + (h * 0.13 | 0) : (h * 0.085 | 0)) + 'px "Courier New", monospace';
      ctx.fillText(ln, w * 0.06, y); y += big ? h * 0.18 : h * 0.12;
    });
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let yy = 0; yy < h; yy += 3) ctx.fillRect(0, yy, w, 1);
    ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.strokeRect(4, 4, w - 8, h - 8);
    return toTex(c, { repeat: false });
  }
  function makeScreens() {
    const w = 256, h = 160;
    T.list.screenIdle = makeScreen(['WARDEN OS 4.2', 'SECTOR 7: LOCKDOWN', 'NIGHT SHIFT: 0 / 41', 'UNITS ACTIVE: 212'], '#ffb347', w, h);
    T.list.screenOff = makeScreen(['BREAKER', 'STATUS: OFFLINE', 'MANUAL RESET REQ.', 'HOLD TO ENGAGE'], '#ff5a3c', w, h);
    T.list.screenOn = makeScreen(['BREAKER', 'STATUS: ONLINE', 'LOAD 98.2 MW', 'GRID SYNC OK'], '#7fe3ff', w, h);
    T.list.screenUplink = makeScreen(['UPLINK 7-A', 'AWAITING OVERRIDE', 'CARRIER 11.4 GHZ', 'AUTH: NONE'], '#ffb347', w, h);
    T.list.screenUplinkOn = makeScreen(['UPLINK 7-A', 'UPLOADING...', 'KILL SIGNAL ARMED', 'STAY IN RANGE'], '#7fe3ff', w, h);
    // big facade sign
    const c = makeCanvas(1024, 160), ctx = c.getContext('2d');
    ctx.fillStyle = '#0c0f13'; ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = '#ff9a3c'; ctx.fillRect(0, 138, 1024, 10);
    ctx.fillStyle = '#efe8dc'; ctx.font = '900 104px Impact, "Arial Black", sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText('CINDER FOUNDRY', 36, 72);
    ctx.fillStyle = '#ff9a3c'; ctx.font = 'bold 44px "Arial Narrow", Arial, sans-serif'; ctx.fillText('SECTOR 7', 800, 76);
    T.list.signFoundry = toTex(c, { repeat: false });
    const c2 = makeCanvas(512, 256), x2 = c2.getContext('2d');
    x2.fillStyle = '#d8d2c4'; x2.fillRect(0, 0, 512, 256); x2.fillStyle = '#b3261e'; x2.fillRect(0, 0, 512, 80);
    x2.fillStyle = '#fff'; x2.font = '900 64px Impact, "Arial Black", sans-serif'; x2.textAlign = 'center'; x2.fillText('DANGER', 256, 64);
    x2.fillStyle = '#111'; x2.font = 'bold 40px Arial, sans-serif'; x2.fillText('MOLTEN METAL', 256, 140); x2.fillText('KEEP CLEAR', 256, 196);
    T.list.signDanger = toTex(c2, { repeat: false });
  }

  function makeDecals() {
    const rnd = U.mulberry32(901);
    const cracks = []; for (let k = 0; k < 7; k++) cracks.push(rnd() * Math.PI * 2);
    T.list.bulletHole = rgbaTex(64, 64, (u, v) => {
      const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2, a = Math.atan2(dy, dx);
      let crack = 0; for (const c of cracks) { const d = Math.abs(U.wrapAngle(a - c)); if (d < 0.07 && r < 0.9) crack = Math.max(crack, 1 - r); }
      if (r < 0.18) return [0.01, 0.01, 0.01, 1];
      if (r < 0.42) return [0.08, 0.075, 0.07, 0.92 - (r - 0.18) * 1.2];
      const rim = Math.max(0, 1 - (r - 0.42) / 0.5);
      return [0.22, 0.21, 0.2, Math.max(rim * 0.45, crack * 0.8)];
    });
    const sn = tileNoise(128, 6, 6, 4, 902);
    T.list.scorch = rgbaTex(128, 128, (u, v, x, y) => {
      const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.pow(Math.max(0, 1 - r), 1.3) * (0.6 + sn[y * 128 + x] * 0.6);
      return [0.02, 0.018, 0.015, Math.min(1, a)];
    });
    const on = tileNoise(64, 4, 4, 3, 903);
    T.list.oil = rgbaTex(64, 64, (u, v, x, y) => {
      const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = sstep(0.62, 0.5, r + (on[y * 64 + x] - 0.5) * 0.6);
      return [0.015, 0.02, 0.02, a * 0.92];
    });
    T.list.blob = rgbaTex(64, 64, (u, v) => {
      const ax = Math.abs(u - 0.5) * 2, ay = Math.abs(v - 0.5) * 2;
      const a = (1 - sstep(0.55, 1.0, ax)) * (1 - sstep(0.55, 1.0, ay));
      return [0, 0, 0, a * 0.75];
    });
    T.list.pad = rgbaTex(256, 256, (u, v) => {
      const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
      let a = (r > 0.86 && r < 0.94) ? 0.9 : 0;
      const hx = Math.abs(dx), hy = Math.abs(dy);
      if ((hx > 0.13 && hx < 0.19 && hy < 0.22) || (hx < 0.19 && hy < 0.03)) a = 0.9;
      return [0.95, 0.85, 0.4, a];
    });
  }

  function makeParticles() {
    T.list.soft = rgbaTex(64, 64, (u, v) => { const r = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); const a = Math.pow(1 - r, 2); return [1, 1, 1, a]; });
    const sn = tileNoise(128, 5, 5, 4, 1001);
    T.list.smoke = rgbaTex(128, 128, (u, v, x, y) => {
      const r = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2);
      const a = Math.pow(1 - r, 1.4) * (0.35 + sn[y * 128 + x] * 0.8);
      return [1, 1, 1, U.clamp(a, 0, 1)];
    });
    T.list.flash = rgbaTex(128, 128, (u, v) => {
      const dx = u - 0.5, dy = v - 0.5, r = Math.min(1, Math.hypot(dx, dy) * 2), th = Math.atan2(dy, dx);
      const spike = Math.pow(Math.max(0, Math.cos(th * 3.5)), 10) * Math.pow(1 - r, 0.8);
      const core = Math.pow(Math.max(0, 1 - r * 2.2), 1.5);
      const a = Math.min(1, core + spike * 0.9 + Math.pow(1 - r, 4) * 0.4);
      return [1, 0.9 + core * 0.1, 0.75 + core * 0.25, a];
    });
    T.list.spark = rgbaTex(32, 32, (u, v) => { const r = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); return [1, 1, 1, Math.pow(1 - r, 3)]; });
    T.list.ring = rgbaTex(128, 128, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; const a = Math.max(0, 1 - Math.abs(r - 0.82) / 0.14); return [1, 1, 1, a * a]; });
    T.list.glow = rgbaTex(128, 128, (u, v) => { const r = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); return [1, 1, 1, Math.pow(1 - r, 2.6)]; });
    T.list.beam = rgbaTex(8, 64, (u, v) => { const a = Math.pow(Math.max(0, 1 - Math.abs(v * 2 - 1)), 2.2); return [1, 1, 1, a]; });
    T.list.marker = rgbaTex(128, 128, (u, v) => {
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const ring = Math.max(0, 1 - Math.abs(r - 0.9) / 0.06), fill = r < 0.9 ? 0.22 : 0;
      return [1, 1, 1, Math.min(1, ring + fill)];
    });
  }

  // ------------------------------------------------------------ daylight suburb (Nuketown)
  function makeSuburb() {
    const n = S * S, rnd = U.mulberry32(1955);
    const pack = (rgb, hgt, rough, ns) => ({ map: rgbTex(S, S, rgb), normalMap: normalTex(S, S, hgt, ns), roughnessMap: grayTex(S, S, rough) });
    // lawn: patchy greens with blade speckle and a few dry spots
    {
      const n1 = tileNoise(S, 4, 4, 5, 1501, 0.55), n2 = tileNoise(S, 64, 64, 2, 1502), n3 = tileNoise(S, 2, 2, 3, 1503);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const blade = n2[i] + (rnd() - 0.5) * 0.5, dry = sstep(0.62, 0.8, n3[i]) * 0.6;
        const v = 0.55 + (n1[i] - 0.5) * 0.35 + (blade - 0.5) * 0.35;
        rgb[i * 3] = v * (0.32 + dry * 0.35); rgb[i * 3 + 1] = v * (0.62 + dry * 0.05); rgb[i * 3 + 2] = v * (0.2 + dry * 0.05);
        hgt[i] = blade * 0.8 + n1[i] * 0.2; rough[i] = 0.92;
      }
      T.list.grass = pack(rgb, hgt, rough, 2.5);
    }
    // lap siding: 16 overlapping boards per tile, each shadowed under the one above (white, tinted by the material)
    {
      const n1 = tileNoise(S, 2, 32, 3, 1511), B = S / 16;
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const y = (i / S) | 0, t = (y % B) / B, lip = t < 0.08 ? 0.55 + t * 5 : 1;
        const v = (0.86 + (n1[i] - 0.5) * 0.12) * lip * (0.93 + t * 0.07);
        rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v * 0.98;
        hgt[i] = t; rough[i] = 0.7;
      }
      T.list.siding = pack(rgb, hgt, rough, 1.6);
    }
    // asphalt shingles: staggered tabs with per-tab tone and granule noise (grey, tinted by the material)
    {
      const n2 = tileNoise(S, 128, 128, 1, 1521), R = S / 16, Wt = S / 8;
      const tone = []; for (let k = 0; k < 16 * 9; k++) tone.push(0.75 + rnd() * 0.3);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, row = (y / R) | 0, t = (y % R) / R;
        const xs = (x + (row % 2) * Wt / 2) % S, col = (xs / Wt) | 0, gap = (xs % Wt) < 2 ? 0.5 : 1;
        const v = tone[row * 9 + col] * (0.55 + (n2[i] - 0.5) * 0.3) * gap * (t > 0.88 ? 0.6 : 1);
        rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v;
        hgt[i] = t * 0.6 + n2[i] * 0.3; rough[i] = 0.95;
      }
      T.list.shingles = pack(rgb, hgt, rough, 2.2);
    }
    // red brick with mortar joints
    {
      const n1 = tileNoise(S, 8, 8, 4, 1531), n2 = tileNoise(S, 128, 128, 1, 1532), R = S / 8, Wb = S / 4;
      const tone = []; for (let k = 0; k < 8 * 5; k++) tone.push(0.8 + rnd() * 0.35);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, row = (y / R) | 0, xs = (x + (row % 2) * Wb / 2) % S, col = (xs / Wb) | 0;
        const mortar = (y % R) < 5 || (xs % Wb) < 5;
        if (mortar) { const v = 0.7 + (n2[i] - 0.5) * 0.15; rgb[i * 3] = v; rgb[i * 3 + 1] = v * 0.97; rgb[i * 3 + 2] = v * 0.92; hgt[i] = 0; }
        else { const v = tone[row * 5 + col] * (0.85 + (n1[i] - 0.5) * 0.3 + (n2[i] - 0.5) * 0.15); rgb[i * 3] = v * 0.62; rgb[i * 3 + 1] = v * 0.27; rgb[i * 3 + 2] = v * 0.2; hgt[i] = 0.8 + n2[i] * 0.2; }
        rough[i] = 0.9;
      }
      T.list.brick = pack(rgb, hgt, rough, 2.5);
    }
    // wood planks with grain (warm grey, tinted by the material)
    {
      const g1 = tileNoise(S, 2, 48, 4, 1541, 0.6), n2 = tileNoise(S, 4, 4, 3, 1542), P = S / 8;
      const tone = []; for (let k = 0; k < 8; k++) tone.push(0.8 + rnd() * 0.3);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, col = (x / P) | 0, seam = (x % P) < 2 ? 0.45 : 1;
        const grain = 0.5 + 0.5 * Math.sin(g1[i] * 40 + x * 0.05);
        const v = tone[col] * (0.72 + grain * 0.18 + (n2[i] - 0.5) * 0.12) * seam;
        rgb[i * 3] = v; rgb[i * 3 + 1] = v * 0.93; rgb[i * 3 + 2] = v * 0.86;
        hgt[i] = grain * 0.3 + (seam < 1 ? -1 : 0); rough[i] = 0.75;
      }
      T.list.planks = pack(rgb, hgt, rough, 1.5);
    }
    // interiors: two 1950s wallpapers drawn with canvas shapes (small posies, climbing vines)
    const paper = (bg, draw) => {
      const c = makeCanvas(S, S), x = c.getContext('2d');
      x.fillStyle = bg; x.fillRect(0, 0, S, S);
      const n2 = tileNoise(S, 8, 8, 3, 1551), img = x.getImageData(0, 0, S, S), d = img.data;
      for (let i = 0; i < S * S; i++) { const k = 0.94 + n2[i] * 0.08; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
      x.putImageData(img, 0, 0);
      draw(x, S / 512);
      return { map: toTex(c), roughnessMap: null, normalMap: null };
    };
    const posy = (x, cx, cy, k) => {
      x.fillStyle = '#6f8f4a';
      for (const a of [0.6, 2.4, 4.2]) { x.beginPath(); x.ellipse(cx + Math.cos(a) * 9 * k, cy + Math.sin(a) * 9 * k, 7 * k, 3.5 * k, a, 0, 6.3); x.fill(); }
      x.fillStyle = '#b8483c';
      for (let i = 0; i < 5; i++) { const a = i * 1.2566; x.beginPath(); x.arc(cx + Math.cos(a) * 4 * k, cy + Math.sin(a) * 4 * k, 3.6 * k, 0, 6.3); x.fill(); }
      x.fillStyle = '#e8c86a'; x.beginPath(); x.arc(cx, cy, 2.4 * k, 0, 6.3); x.fill();
    };
    T.list.wallpaper = paper('#e9dcae', (x, k) => {
      for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) posy(x, (q * 64 + (r % 2) * 32 + 16) * k, (r * 64 + 20) * k, k);
    });
    T.list.wallpaper2 = paper('#e6dcc0', (x, k) => {
      x.strokeStyle = '#6d8a4c'; x.lineWidth = 2.5 * k;
      for (let q = 0; q < 4; q++) {
        const bx = (q * 128 + 64) * k; x.beginPath();
        for (let y = 0; y <= S; y += 4) { const xx = bx + Math.sin(y / S * Math.PI * 4) * 22 * k; if (y) x.lineTo(xx, y); else x.moveTo(xx, y); }
        x.stroke();
        for (let y = 16; y < S; y += 48) {
          const xx = bx + Math.sin(y / S * Math.PI * 4) * 22 * k, side = (y / 48 | 0) % 2 ? 1 : -1;
          x.fillStyle = '#7f9c58'; x.beginPath(); x.ellipse(xx + side * 12 * k, y, 10 * k, 4.5 * k, side * 0.6, 0, 6.3); x.fill();
          x.fillStyle = '#a8433a'; x.beginPath(); x.arc(xx - side * 10 * k, y + 14 * k, 5 * k, 0, 6.3); x.fill();
        }
      }
    });
    // blue and cream checkerboard kitchen tile with grout
    {
      const n2 = tileNoise(S, 16, 16, 2, 1561), C = S / 8;
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, grout = (x % C) < 2 || (y % C) < 2, blue = (((x / C) | 0) + ((y / C) | 0)) % 2;
        const v = 0.95 + (n2[i] - 0.5) * 0.08;
        if (grout) { rgb[i * 3] = 0.55; rgb[i * 3 + 1] = 0.55; rgb[i * 3 + 2] = 0.52; hgt[i] = 0; }
        else if (blue) { rgb[i * 3] = 0.2 * v; rgb[i * 3 + 1] = 0.3 * v; rgb[i * 3 + 2] = 0.55 * v; hgt[i] = 1; }
        else { rgb[i * 3] = 0.9 * v; rgb[i * 3 + 1] = 0.88 * v; rgb[i * 3 + 2] = 0.8 * v; hgt[i] = 1; }
        rough[i] = grout ? 0.9 : 0.35;
      }
      T.list.checker = pack(rgb, hgt, rough, 2);
    }
    // plush carpet (neutral, tinted by the material)
    {
      const n1 = tileNoise(S, 8, 8, 4, 1571), n2 = tileNoise(S, 128, 128, 1, 1572);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) { const v = 0.78 + (n1[i] - 0.5) * 0.12 + (n2[i] - 0.5) * 0.18; rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v; hgt[i] = n2[i]; rough[i] = 1; }
      T.list.carpet = pack(rgb, hgt, rough, 1.2);
    }
    // fieldstone: jittered cells with deep mortar joints and per-stone colour
    {
      const G = 6, cs = S / G, pts = [];
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([(i + 0.15 + rnd() * 0.7) * cs, (j + 0.15 + rnd() * 0.7) * cs, 0.55 + rnd() * 0.4, rnd()]);
      const n2 = tileNoise(S, 32, 32, 3, 1581);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, gx = (x / cs) | 0, gy = (y / cs) | 0;
        let d1 = 1e9, d2 = 1e9, best = null;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const cx = (gx + ox + G) % G, cy = (gy + oy + G) % G, p = pts[cy * G + cx];
          const px = p[0] + (gx + ox - cx) * cs, py = p[1] + (gy + oy - cy) * cs, dd = Math.hypot(x - px, (y - py) * 1.4);
          if (dd < d1) { d2 = d1; d1 = dd; best = p; } else if (dd < d2) d2 = dd;
        }
        const edge = sstep(3, 9, d2 - d1), v = best[2] * (0.8 + n2[i] * 0.35) * (0.45 + edge * 0.55), warm = best[3];
        rgb[i * 3] = v * (0.92 + warm * 0.12); rgb[i * 3 + 1] = v * (0.88 + warm * 0.04); rgb[i * 3 + 2] = v * 0.8;
        hgt[i] = edge * (0.7 + n2[i] * 0.3); rough[i] = 0.9;
      }
      T.list.stone = pack(rgb, hgt, rough, 3);
    }
    // desert dirt: tan with pebbles, dry patches and cracks
    {
      const n1 = tileNoise(S, 4, 4, 5, 1591, 0.55), n2 = tileNoise(S, 96, 96, 1, 1592), n3 = tileNoise(S, 16, 16, 3, 1593);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const peb = n2[i] > 0.82 ? (n2[i] - 0.82) * 4 : 0, crack = Math.abs(n3[i] - 0.5) < 0.012 ? 1 : 0;
        const v = (0.72 + (n1[i] - 0.5) * 0.3 + peb * 0.4) * (1 - crack * 0.3);
        rgb[i * 3] = v * 0.86; rgb[i * 3 + 1] = v * 0.72; rgb[i * 3 + 2] = v * 0.54;
        hgt[i] = n1[i] * 0.3 + peb - crack; rough[i] = 0.97;
      }
      T.list.dirt = pack(rgb, hgt, rough, 2);
    }
    // white porch lattice (alpha-tested diagonal slats)
    T.list.lattice = rgbaTex(256, 256, (u, v) => {
      const a = ((u + v) * 4) % 1, b = ((u - v + 2) * 4) % 1;
      const on = a < 0.22 || b < 0.22;
      return [0.93, 0.93, 0.9, on ? 1 : 0];
    }, { repeat: true });
  }

  // ------------------------------------------------------------ polar station (Whiteout campaign)
  function makeArctic() {
    const n = S * S, rnd = U.mulberry32(9001);
    const pack = (rgb, hgt, rough, ns) => ({ map: rgbTex(S, S, rgb), normalMap: normalTex(S, S, hgt, ns), roughnessMap: grayTex(S, S, rough) });
    // wind-packed snow: soft dunes, sastrugi ripples running one way, a faint blue in the hollows, sparkle
    {
      const n1 = tileNoise(S, 3, 3, 5, 9101, 0.55), n2 = tileNoise(S, 4, 24, 3, 9102, 0.5), n3 = tileNoise(S, 64, 64, 2, 9103);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const h = n1[i] * 0.6 + n2[i] * 0.4, hollow = sstep(0.55, 0.2, h);
        const glint = n3[i] > 0.93 && rnd() < 0.5 ? 1 : 0;
        const v = 0.86 + (h - 0.5) * 0.12 + glint * 0.1;
        rgb[i * 3] = v * (0.93 - hollow * 0.08); rgb[i * 3 + 1] = v * (0.96 - hollow * 0.04); rgb[i * 3 + 2] = v;
        hgt[i] = h + (n3[i] - 0.5) * 0.08; rough[i] = glint ? 0.35 : 0.82 + (n3[i] - 0.5) * 0.1;
      }
      T.list.snow = pack(rgb, hgt, rough, 1.6);
    }
    // blue glacial ice: deep colour variation, trapped bubbles, white fracture lines
    {
      const n1 = tileNoise(S, 3, 3, 5, 9201, 0.6), n2 = tileNoise(S, 12, 12, 3, 9202);
      const crack = new Float32Array(n); scratch(crack, S, rnd, 11, S * 0.3, 0.7);
      const bub = new Float32Array(n); for (let k = 0; k < n / 900; k++) stamp(bub, S, rnd() * S | 0, rnd() * S | 0, 1 + rnd() * 2.5, 1, 'max');
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const d = n1[i], c = crack[i], b = bub[i];
        const r = 0.3 + d * 0.2 + c * 0.16 + b * 0.12, g = 0.52 + d * 0.18 + c * 0.14 + b * 0.1, bl = 0.7 + d * 0.14 + c * 0.08;
        rgb[i * 3] = Math.min(1, r); rgb[i * 3 + 1] = Math.min(1, g); rgb[i * 3 + 2] = Math.min(1, bl);
        hgt[i] = d * 0.3 - c * 0.7 + n2[i] * 0.1; rough[i] = 0.12 + c * 0.45 + n2[i] * 0.12;
      }
      T.list.ice = pack(rgb, hgt, rough, 1.4);
    }
    // insulated sandwich panels (light grey, tinted per material): vertical seams, rivet rows, grime at the foot
    {
      const n1 = tileNoise(S, 4, 4, 4, 9301, 0.5), n2 = tileNoise(S, 1, 8, 3, 9302);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      const P = S / 4;
      for (let i = 0; i < n; i++) {
        const x = i % S, y = (i / S) | 0, px = x % P;
        const seam = px < 3 ? 1 : 0, lip = px > P - 4 ? 1 : 0;
        const rivet = ((px === (P * 0.5 | 0) || px === 8) && y % (S / 8) < 3) ? 1 : 0;
        const streak = Math.max(0, n2[i] - 0.6) * 0.8, foot = sstep(0.7, 1, y / S) * 0.2;
        const v = 0.8 + (n1[i] - 0.5) * 0.08 - streak * 0.25 - foot - seam * 0.3 + lip * 0.06 + rivet * 0.05;
        rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v * 1.01;
        hgt[i] = -seam * 0.8 + lip * 0.2 + rivet * 0.6 + n1[i] * 0.05; rough[i] = 0.5 + streak * 0.3 + foot;
      }
      T.list.panel = pack(rgb, hgt, rough, 2.4);
    }
    // basalt nunatak rock with snow caught in the cracks
    {
      const n1 = tileNoise(S, 5, 5, 6, 9401, 0.6), n2 = tileNoise(S, 16, 16, 3, 9402);
      const rgb = new Float32Array(n * 3), hgt = new Float32Array(n), rough = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const h = n1[i] * 0.7 + n2[i] * 0.3, snow = sstep(0.34, 0.24, h);
        const v = 0.16 + h * 0.2;
        rgb[i * 3] = v + snow * 0.7; rgb[i * 3 + 1] = v + snow * 0.72; rgb[i * 3 + 2] = v * 1.08 + snow * 0.75;
        hgt[i] = h; rough[i] = 0.9 - snow * 0.1;
      }
      T.list.basalt = pack(rgb, hgt, rough, 3.2);
    }
    // station signage and terminals
    const sign = (w, h, draw) => { const c = makeCanvas(w, h), x = c.getContext('2d'); draw(x, w, h); return toTex(c, { repeat: false }); };
    T.list.signHalden = sign(1024, 200, (x, w, h) => {
      x.fillStyle = '#f2efe8'; x.fillRect(0, 0, w, h); x.fillStyle = '#d4471c'; x.fillRect(0, 0, 150, h); x.fillRect(0, h - 22, w, 22);
      x.fillStyle = '#fff'; x.font = '900 120px Impact, "Arial Black", sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText('H', 75, 96);
      x.textAlign = 'left'; x.fillStyle = '#1b2430'; x.font = '900 92px Impact, "Arial Black", sans-serif'; x.fillText('HALDEN DEEP', 180, 78);
      x.fillStyle = '#d4471c'; x.font = 'bold 34px "Arial Narrow", Arial, sans-serif'; x.fillText('HALDEN-SATO POLAR RESOURCES · STATION 4', 184, 150);
    });
    T.list.signCold = sign(512, 256, (x, w, h) => {
      x.fillStyle = '#f0ece2'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f5fa8'; x.fillRect(0, 0, w, 84);
      x.fillStyle = '#fff'; x.font = '900 60px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.fillText('WARNING', w / 2, 64);
      x.fillStyle = '#111'; x.font = 'bold 36px Arial, sans-serif'; x.fillText('CREVASSE FIELD', w / 2, 140); x.fillText('ROPE UP · STAY ON FLAGS', w / 2, 196);
    });
    const w = 256, h = 160;
    T.list.scrLog = makeScreen(['STATION LOG 41', 'DR. I. VARGA', 'AUDIO ATTACHED', 'HOLD TO PLAY'], '#ffd08a', w, h);
    T.list.scrLogOn = makeScreen(['STATION LOG 41', 'PLAYING...', '03:12 / 03:12', 'END OF FILE'], '#8fe8ff', w, h);
    T.list.scrMast = makeScreen(['MAST CONTROL', 'FUSE CELLS 0 / 3', 'TRANSMIT: OFFLINE', 'INSERT CELLS'], '#ff8a5c', w, h);
    T.list.scrMastOn = makeScreen(['MAST CONTROL', 'FUSE CELLS 3 / 3', 'TRANSMIT: LIVE', 'CH 4 · SKUA'], '#8fe8ff', w, h);
    T.list.scrBeacon = makeScreen(['HEAT BEACON', 'PILOT: COLD', 'FUEL 64%', 'HOLD TO LIGHT'], '#ffb347', w, h);
    T.list.scrBeaconOn = makeScreen(['HEAT BEACON', 'BURNING', 'OUTPUT 11 KW', 'STAY CLOSE'], '#ffcf7a', w, h);
  }

  /** Canvas helpers for textures built later, on demand (the Story Campaign city and its people). */
  T.util = { tileNoise, rgbTex, grayTex, rgbaTex, normalTex, makeCanvas, toTex, size: () => S,
    pack: (rgb, hgt, rough, ns, n) => ({ map: rgbTex(n || S, n || S, rgb), normalMap: normalTex(n || S, n || S, hgt, ns), roughnessMap: grayTex(n || S, n || S, rough) }) };
  T.build = async function (renderer, progress) {
    S = CF.bootQuality === 'low' ? 256 : 512;
    T.maxAniso = Math.min(CF.bootQuality === 'high' ? 8 : 4, renderer.capabilities.getMaxAnisotropy());
    const steps = [
      ['Pouring concrete', makeConcrete],
      ['Laying asphalt', makeAsphalt],
      ['Pressing tread plate', makeDiamond],
      ['Painting wall panels', () => { makeCorrugated('wall', [0.3, 0.36, 0.43], 0.8, 1101); makeCorrugated('wallRust', [0.42, 0.33, 0.25], 1.0, 1201); }],
      ['Stacking containers', makeContainers],
      ['Stenciling crates', () => { makeCrate(); makeHazard(); }],
      ['Priming machinery', makePaintMetal],
      ['Mowing the lawns', makeSuburb],
      ['Heating the crucibles', makeMolten],
      ['Booting terminals', makeScreens],
      ['Packing the snow', makeArctic],
      ['Scattering debris', () => { makeDecals(); makeParticles(); }]
    ];
    for (let i = 0; i < steps.length; i++) {
      if (progress) progress(i / steps.length, steps[i][0]);
      await U.nextFrame();
      steps[i][1]();
    }
    if (progress) progress(1, 'Textures ready');
  };
})(window.CF);
