'use strict';
/* Cinderfall — collision world (axis-aligned boxes), raycasts, character movement, navigation. */
(function (CF) {
  const U = CF.U;
  const W = CF.World = {
    boxes: [], cell: 4, gx0: 0, gz0: 0, gw: 0, gh: 0, grid: null, stamp: 1, marks: new Uint32Array(8192),
    bounds: { minX: -66, maxX: 66, minZ: -58, maxZ: 58 },
    hit: { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, box: null },
    nav: null
  };
  const _q = [], _q2 = [], _q3 = [];

  W.reset = function (bounds) {
    this.boxes.length = 0; this.grid = null; this.nav = null;
    this.flowMax = 0; // > 0: stop the flow field this far (in metres of path) from the player (big maps)
    if (bounds) this.bounds = bounds;
  };

  W.add = function (x0, y0, z0, x1, y1, z1, o) {
    o = o || {};
    const b = {
      minX: Math.min(x0, x1), minY: Math.min(y0, y1), minZ: Math.min(z0, z1),
      maxX: Math.max(x0, x1), maxY: Math.max(y0, y1), maxZ: Math.max(z0, z1),
      surf: o.surf || 'concrete', nav: o.nav !== false, solid: o.solid !== false, shoot: o.shoot !== false,
      enabled: true, id: this.boxes.length, tag: o.tag || null, owner: o.owner || null
    };
    this.boxes.push(b);
    if (b.id >= this.marks.length) { const m = new Uint32Array(this.marks.length * 2); m.set(this.marks); this.marks = m; }
    if (this.grid) this.insert(b);
    return b;
  };

  /** Upright cylinder collider (tanks, crucibles, rocks, trunks): round for movement and bullets, boxed for the broad phase. */
  W.addCyl = function (x, z, r, y0, y1, o) {
    const b = this.add(x - r, y0, z - r, x + r, y1, z + r, o);
    b.cyl = r; b.cx = x; b.cz = z;
    return b;
  };

  W.build = function () {
    const B = this.bounds, cs = this.cell;
    this.gx0 = B.minX - 4; this.gz0 = B.minZ - 4;
    this.gw = Math.ceil((B.maxX - B.minX + 8) / cs); this.gh = Math.ceil((B.maxZ - B.minZ + 8) / cs);
    this.grid = new Array(this.gw * this.gh);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = [];
    for (const b of this.boxes) this.insert(b);
  };
  W.insert = function (b) {
    const cs = this.cell, gw = this.gw, gh = this.gh;
    const x0 = U.clamp(Math.floor((b.minX - this.gx0) / cs), 0, gw - 1), x1 = U.clamp(Math.floor((b.maxX - this.gx0) / cs), 0, gw - 1);
    const z0 = U.clamp(Math.floor((b.minZ - this.gz0) / cs), 0, gh - 1), z1 = U.clamp(Math.floor((b.maxZ - this.gz0) / cs), 0, gh - 1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.grid[z * gw + x].push(b);
  };

  W.query = function (minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const st = ++this.stamp, marks = this.marks, cs = this.cell, gw = this.gw, gh = this.gh;
    const x0 = U.clamp(Math.floor((minX - this.gx0) / cs), 0, gw - 1), x1 = U.clamp(Math.floor((maxX - this.gx0) / cs), 0, gw - 1);
    const z0 = U.clamp(Math.floor((minZ - this.gz0) / cs), 0, gh - 1), z1 = U.clamp(Math.floor((maxZ - this.gz0) / cs), 0, gh - 1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const list = this.grid[z * gw + x];
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (marks[b.id] === st) continue; marks[b.id] = st;
        if (!b.enabled) continue;
        if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
        out.push(b);
      }
    }
    return out;
  };

  /** Ray vs world. dir must be normalized. Returns shared hit object or null. solid: also stop at solids bullets pass through (fences, rails). */
  W.raycast = function (ox, oy, oz, dx, dy, dz, maxT, filter, solid) {
    const st = ++this.stamp, marks = this.marks, cs = this.cell, gw = this.gw, gh = this.gh;
    const idx = 1 / (Math.abs(dx) > 1e-9 ? dx : 1e-9), idy = 1 / (Math.abs(dy) > 1e-9 ? dy : 1e-9), idz = 1 / (Math.abs(dz) > 1e-9 ? dz : 1e-9);
    let best = maxT, bestB = null, bestAxis = -1;
    const fx = (ox - this.gx0) / cs, fz = (oz - this.gz0) / cs;
    let cx = Math.floor(fx), cz = Math.floor(fz);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const tdx = adx > 1e-9 ? cs / adx : Infinity, tdz = adz > 1e-9 ? cs / adz : Infinity;
    let tmx = adx > 1e-9 ? ((dx > 0 ? (cx + 1 - fx) : (fx - cx)) * cs) / adx : Infinity;
    let tmz = adz > 1e-9 ? ((dz > 0 ? (cz + 1 - fz) : (fz - cz)) * cs) / adz : Infinity;
    for (let guard = 0; guard < 400; guard++) {
      if (cx >= 0 && cx < gw && cz >= 0 && cz < gh) {
        const list = this.grid[cz * gw + cx];
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (marks[b.id] === st) continue; marks[b.id] = st;
          if (!b.enabled || !(b.shoot || (solid && b.solid))) continue;
          if (filter && !filter(b)) continue;
          let t0 = 0, t1 = best, axis = -1, a, c, tmp;
          a = (b.minX - ox) * idx; c = (b.maxX - ox) * idx; if (a > c) { tmp = a; a = c; c = tmp; }
          if (a > t0) { t0 = a; axis = 0; } if (c < t1) t1 = c; if (t0 > t1) continue;
          a = (b.minY - oy) * idy; c = (b.maxY - oy) * idy; if (a > c) { tmp = a; a = c; c = tmp; }
          if (a > t0) { t0 = a; axis = 1; } if (c < t1) t1 = c; if (t0 > t1) continue;
          a = (b.minZ - oz) * idz; c = (b.maxZ - oz) * idz; if (a > c) { tmp = a; a = c; c = tmp; }
          if (a > t0) { t0 = a; axis = 2; } if (c < t1) t1 = c; if (t0 > t1) continue;
          if (b.cyl) { // the box test passed: now the round side (vertical rays only need the y slab)
            const px = ox - b.cx, pz = oz - b.cz, qa = dx * dx + dz * dz, qb = 2 * (px * dx + pz * dz), qc = px * px + pz * pz - b.cyl * b.cyl;
            if (qa > 1e-12) {
              const disc = qb * qb - 4 * qa * qc; if (disc < 0) continue;
              const sq = Math.sqrt(disc), c0 = (-qb - sq) / (2 * qa), c1 = (-qb + sq) / (2 * qa);
              let y0 = (b.minY - oy) * idy, y1 = (b.maxY - oy) * idy; if (y0 > y1) { tmp = y0; y0 = y1; y1 = tmp; }
              const enter = Math.max(c0, y0, 0), exit = Math.min(c1, y1, best);
              if (enter > exit) continue;
              t0 = enter; axis = enter === c0 ? 3 : 1;
            } else if (qc > 0) continue;
          }
          if (t0 < best) { best = t0; bestB = b; bestAxis = axis; }
        }
      } else if ((cx < 0 && sx < 0) || (cx >= gw && sx > 0) || (cz < 0 && sz < 0) || (cz >= gh && sz > 0)) break;
      const tn = tmx < tmz ? tmx : tmz;
      if (tn > best) break;
      if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
    }
    if (!bestB) return null;
    const h = this.hit;
    h.t = best; h.x = ox + dx * best; h.y = oy + dy * best; h.z = oz + dz * best; h.nx = 0; h.ny = 0; h.nz = 0; h.box = bestB;
    if (bestAxis === 0) h.nx = dx > 0 ? -1 : 1;
    else if (bestAxis === 1) h.ny = dy > 0 ? -1 : 1;
    else if (bestAxis === 2) h.nz = dz > 0 ? -1 : 1;
    else if (bestAxis === 3) { const l = Math.hypot(h.x - bestB.cx, h.z - bestB.cz) || 1; h.nx = (h.x - bestB.cx) / l; h.nz = (h.z - bestB.cz) / l; }
    else { h.nx = -dx; h.ny = -dy; h.nz = -dz; }
    return h;
  };

  /** Move a flying point (drone, RC car camera) from p toward target, stopping pad metres short of any solid. */
  W.sweep = function (p, tx, ty, tz, pad) {
    const dx = tx - p.x, dy = ty - p.y, dz = tz - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-5) return p;
    const h = this.raycast(p.x, p.y, p.z, dx / d, dy / d, dz / d, d + pad, null, true);
    const k = h ? Math.max(0, h.t - pad) / d : 1;
    p.x += dx * Math.min(1, k); p.y += dy * Math.min(1, k); p.z += dz * Math.min(1, k);
    return p;
  };

  W.segmentClear = function (ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.05);
  };

  /** Ground height directly under x,z starting from y (inclusive). */
  W.groundHeight = function (x, y, z) {
    const h = this.raycast(x, y, z, 0, -1, 0, 60);
    return h ? h.y : 0;
  };

  // ------------------------------------------------------------ character movement
  function circleRect(x, z, r, b) {
    if (b.cyl) { const dx = x - b.cx, dz = z - b.cz, R = r + b.cyl; return dx * dx + dz * dz < R * R; }
    const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
    const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
    const dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < r * r;
  }
  W.headroom = function (x, z, r, y, height, ignore) {
    const list = this.query(x - r, z - r, x + r, z + r, _q2);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o.solid || o === ignore) continue;
      if (o.minY < y + height - 0.01 && o.maxY > y + 0.01 && circleRect(x, z, r, o)) return false;
    }
    return true;
  };
  W.groundBelow = function (x, z, r, fromY, maxDrop) {
    const list = this.query(x - r, z - r, x + r, z + r, _q2);
    let best = null;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o.solid) continue;
      if (o.maxY <= fromY && o.maxY >= fromY - maxDrop && circleRect(x, z, r, o)) { if (best === null || o.maxY > best) best = o.maxY; }
    }
    return best;
  };

  W.resolveXZ = function (b, canStep) {
    const r = b.radius;
    const list = this.query(b.pos.x - r - 0.1, b.pos.z - r - 0.1, b.pos.x + r + 0.1, b.pos.z + r + 0.1, _q);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (!o.solid) continue;
        const feet = b.pos.y, head = feet + b.height;
        if (o.maxY <= feet + 0.001 || o.minY >= head - 0.001) continue;
        let dx, dz, d2, rr = r;
        if (o.cyl) { dx = b.pos.x - o.cx; dz = b.pos.z - o.cz; d2 = dx * dx + dz * dz; rr = r + o.cyl; }
        else { const cx = U.clamp(b.pos.x, o.minX, o.maxX), cz = U.clamp(b.pos.z, o.minZ, o.maxZ); dx = b.pos.x - cx; dz = b.pos.z - cz; d2 = dx * dx + dz * dz; }
        if (d2 >= rr * rr) continue;
        const rise = o.maxY - feet;
        if (canStep && rise <= b.stepHeight && this.headroom(b.pos.x, b.pos.z, r * 0.9, o.maxY, b.height, o)) {
          b.pos.y = o.maxY; b.stepped += rise; b.grounded = true; if (b.vel.y < 0) b.vel.y = 0;
          continue;
        }
        b.hitWall = true;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = rr - d;
          b.pos.x += nx * push; b.pos.z += nz * push;
          const vn = b.vel.x * nx + b.vel.z * nz;
          if (vn < 0) { b.vel.x -= vn * nx; b.vel.z -= vn * nz; }
          b.wallNx = nx; b.wallNz = nz;
        } else {
          const l = b.pos.x - o.minX, rr = o.maxX - b.pos.x, bk = b.pos.z - o.minZ, f = o.maxZ - b.pos.z;
          const m = Math.min(l, rr, bk, f);
          if (m === l) { b.pos.x = o.minX - r; if (b.vel.x > 0) b.vel.x = 0; b.wallNx = -1; b.wallNz = 0; }
          else if (m === rr) { b.pos.x = o.maxX + r; if (b.vel.x < 0) b.vel.x = 0; b.wallNx = 1; b.wallNz = 0; }
          else if (m === bk) { b.pos.z = o.minZ - r; if (b.vel.z > 0) b.vel.z = 0; b.wallNx = 0; b.wallNz = -1; }
          else { b.pos.z = o.maxZ + r; if (b.vel.z < 0) b.vel.z = 0; b.wallNx = 0; b.wallNz = 1; }
        }
      }
    }
  };

  W.resolveY = function (b, prevY) {
    const r = b.radius * 0.9;
    const list = this.query(b.pos.x - r, b.pos.z - r, b.pos.x + r, b.pos.z + r, _q3);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o.solid || !circleRect(b.pos.x, b.pos.z, r, o)) continue;
      if (b.vel.y <= 0) {
        if (o.maxY <= prevY + 0.02 && o.maxY > b.pos.y) { b.pos.y = o.maxY; b.vel.y = 0; b.grounded = true; b.groundBox = o; }
        else if (Math.abs(o.maxY - b.pos.y) < 0.003) { b.grounded = true; b.groundBox = o; }
      } else {
        const head = b.pos.y + b.height, prevHead = prevY + b.height;
        if (o.minY >= prevHead - 0.02 && o.minY < head) { b.pos.y = o.minY - b.height; b.vel.y = 0; b.bonk = true; }
      }
    }
  };

  /**
   * Move a body { pos, vel, radius, height, stepHeight, grounded } through the world.
   * Sets grounded, hitWall, stepped (height gained by step-ups, for camera smoothing).
   */
  W.moveBody = function (b, dt) {
    const speed = Math.max(Math.abs(b.vel.x), Math.abs(b.vel.z), Math.abs(b.vel.y));
    const n = Math.min(10, Math.max(1, Math.ceil((speed * dt) / (b.radius * 0.75))));
    const h = dt / n, wasGrounded = b.grounded;
    b.grounded = false; b.hitWall = false; b.stepped = 0; b.bonk = false; b.groundBox = null;
    for (let s = 0; s < n; s++) {
      b.pos.x += b.vel.x * h; b.pos.z += b.vel.z * h;
      this.resolveXZ(b, wasGrounded || b.grounded);
      const py = b.pos.y;
      b.pos.y += b.vel.y * h;
      this.resolveY(b, py);
    }
    if (!b.grounded && wasGrounded && b.vel.y <= 0 && !b.noSnap) {
      const gy = this.groundBelow(b.pos.x, b.pos.z, b.radius * 0.9, b.pos.y + 0.05, b.stepHeight + 0.05);
      if (gy !== null) { b.stepped += gy - b.pos.y; b.pos.y = gy; b.vel.y = 0; b.grounded = true; }
    }
    // last line of defence at the map edge: nothing leaves the collision grid, whatever gap it found
    const B = this.bounds, r = b.radius;
    if (b.pos.x < B.minX + r) { b.pos.x = B.minX + r; if (b.vel.x < 0) b.vel.x = 0; b.hitWall = true; }
    else if (b.pos.x > B.maxX - r) { b.pos.x = B.maxX - r; if (b.vel.x > 0) b.vel.x = 0; b.hitWall = true; }
    if (b.pos.z < B.minZ + r) { b.pos.z = B.minZ + r; if (b.vel.z < 0) b.vel.z = 0; b.hitWall = true; }
    else if (b.pos.z > B.maxZ - r) { b.pos.z = B.maxZ - r; if (b.vel.z > 0) b.vel.z = 0; b.hitWall = true; }
  };

  // ------------------------------------------------------------ navigation (2.5D heightfield + flow field)
  const MAXH = 6.0, CLEAR = 1.9, CONNECT = 0.7;
  W.surfaceAt = function (x, z, maxH) {
    const list = this.query(x - 0.01, z - 0.01, x + 0.01, z + 0.01, _q3);
    let best = NaN;
    const inside = (b) => !b.cyl || (x - b.cx) * (x - b.cx) + (z - b.cz) * (z - b.cz) < b.cyl * b.cyl;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.nav || !c.solid || !inside(c)) continue;
      const s = c.maxY;
      if (s > maxH || (!isNaN(best) && s <= best)) continue;
      let ok = true;
      for (let j = 0; j < list.length; j++) {
        const o = list[j];
        if (o === c || !o.solid || !inside(o)) continue;
        if (o.minY < s + CLEAR && o.maxY > s + 0.05) { ok = false; break; }
      }
      if (ok) best = s;
    }
    return best;
  };

  W.buildNav = function () {
    const B = this.bounds, cs = 1;
    const nav = this.nav = { cs, x0: B.minX, z0: B.minZ, w: Math.ceil((B.maxX - B.minX) / cs), h: Math.ceil((B.maxZ - B.minZ) / cs) };
    const N = nav.w * nav.h;
    nav.hgt = new Float32Array(N); nav.walk = new Uint8Array(N); nav.edge = new Uint8Array(N);
    nav.dist = new Float32Array(N).fill(Infinity); nav.comp = new Int32Array(N);
    nav.heapI = new Int32Array(N * 8); nav.heapP = new Float32Array(N * 8);
    this.rebuildNavRect(B.minX, B.minZ, B.maxX, B.maxZ);
  };

  W.rebuildNavRect = function (minX, minZ, maxX, maxZ) {
    const nav = this.nav; if (!nav) return;
    const ix0 = U.clamp(Math.floor((minX - nav.x0) / nav.cs) - 1, 0, nav.w - 1), ix1 = U.clamp(Math.floor((maxX - nav.x0) / nav.cs) + 1, 0, nav.w - 1);
    const iz0 = U.clamp(Math.floor((minZ - nav.z0) / nav.cs) - 1, 0, nav.h - 1), iz1 = U.clamp(Math.floor((maxZ - nav.z0) / nav.cs) + 1, 0, nav.h - 1);
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const i = iz * nav.w + ix;
      const h = this.surfaceAt(nav.x0 + (ix + 0.5) * nav.cs, nav.z0 + (iz + 0.5) * nav.cs, MAXH);
      nav.hgt[i] = isNaN(h) ? -99 : h; nav.walk[i] = isNaN(h) ? 0 : 1;
    }
    // edge flags (near walls/drops) and connected components over the whole grid
    const w = nav.w, hh = nav.h;
    for (let iz = 0; iz < hh; iz++) for (let ix = 0; ix < w; ix++) {
      const i = iz * w + ix; nav.edge[i] = 0;
      if (!nav.walk[i]) continue;
      for (let dz = -1; dz <= 1 && !nav.edge[i]; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = ix + dx, z = iz + dz;
        if (x < 0 || z < 0 || x >= w || z >= hh) { nav.edge[i] = 1; break; }
        const j = z * w + x;
        if (!nav.walk[j] || Math.abs(nav.hgt[j] - nav.hgt[i]) > CONNECT) { nav.edge[i] = 1; break; }
      }
    }
    this.labelComponents();
  };

  W.labelComponents = function () {
    const nav = this.nav, w = nav.w, h = nav.h, N = w * h;
    nav.comp.fill(-1);
    const stack = new Int32Array(N); let label = 0, bestSize = 0, bestLabel = -1;
    for (let s = 0; s < N; s++) {
      if (!nav.walk[s] || nav.comp[s] !== -1) continue;
      let sp = 0, size = 0; stack[sp++] = s; nav.comp[s] = label;
      while (sp > 0) {
        const i = stack[--sp]; size++;
        const ix = i % w, iz = (i / w) | 0;
        for (let k = 0; k < 4; k++) {
          const x = ix + (k === 0 ? 1 : k === 1 ? -1 : 0), z = iz + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (x < 0 || z < 0 || x >= w || z >= h) continue;
          const j = z * w + x;
          if (nav.walk[j] && nav.comp[j] === -1 && Math.abs(nav.hgt[j] - nav.hgt[i]) <= CONNECT) { nav.comp[j] = label; stack[sp++] = j; }
        }
      }
      if (size > bestSize) { bestSize = size; bestLabel = label; }
      label++;
    }
    nav.mainComp = bestLabel;
  };

  W.cellAt = function (x, z) {
    const nav = this.nav;
    const ix = Math.floor((x - nav.x0) / nav.cs), iz = Math.floor((z - nav.z0) / nav.cs);
    if (ix < 0 || iz < 0 || ix >= nav.w || iz >= nav.h) return -1;
    return iz * nav.w + ix;
  };
  W.cellX = function (i) { return this.nav.x0 + ((i % this.nav.w) + 0.5) * this.nav.cs; };
  W.cellZ = function (i) { return this.nav.z0 + (((i / this.nav.w) | 0) + 0.5) * this.nav.cs; };
  W.navHeight = function (x, z) { const i = this.cellAt(x, z); return i >= 0 && this.nav.walk[i] ? this.nav.hgt[i] : NaN; };
  W.isMain = function (i) { return i >= 0 && this.nav.walk[i] && this.nav.comp[i] === this.nav.mainComp; };

  W.nearestMainCell = function (x, z, radius) {
    const nav = this.nav, c = this.cellAt(x, z);
    if (this.isMain(c)) return c;
    const ix = Math.floor((x - nav.x0) / nav.cs), iz = Math.floor((z - nav.z0) / nav.cs);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= radius; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const x2 = ix + dx, z2 = iz + dz;
        if (x2 < 0 || z2 < 0 || x2 >= nav.w || z2 >= nav.h) continue;
        const j = z2 * nav.w + x2;
        if (!this.isMain(j)) continue;
        const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = j; }
      }
      if (best >= 0) return best;
    }
    return -1;
  };

  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  function linked(nav, i, j) { return nav.walk[j] && Math.abs(nav.hgt[j] - nav.hgt[i]) <= CONNECT; }
  function canStepTo(nav, ix, iz, k) {
    const w = nav.w, dx = NB[k][0], dz = NB[k][1];
    const x = ix + dx, z = iz + dz;
    if (x < 0 || z < 0 || x >= w || z >= nav.h) return -1;
    const i = iz * w + ix, j = z * w + x;
    if (!linked(nav, i, j)) return -1;
    if (dx !== 0 && dz !== 0) {
      const a = iz * w + x, b = z * w + ix;
      if (!linked(nav, i, a) || !linked(nav, i, b) || nav.edge[a] || nav.edge[b]) return -1;
    }
    return j;
  }

  /** Dijkstra from target over the heightfield; dist[] then acts as a flow field. more: extra targets [[x, z], ...]
      (co-op: every standing player is a goal, so enemies head for whoever is nearest). */
  W.computeFlow = function (tx, tz, more) {
    const nav = this.nav; if (!nav) return false;
    const start = this.nearestMainCell(tx, tz, 10);
    nav.dist.fill(Infinity);
    const extra = [];
    if (more) for (const m of more) { const c = this.nearestMainCell(m[0], m[1], 10); if (c >= 0) extra.push(c); }
    if (start < 0 && !extra.length) return false;
    const HI = nav.heapI, HP = nav.heapP, w = nav.w;
    let n = 0;
    const push = (i, p) => {
      let k = n++;
      while (k > 0) { const par = (k - 1) >> 1; if (HP[par] <= p) break; HI[k] = HI[par]; HP[k] = HP[par]; k = par; }
      HI[k] = i; HP[k] = p;
    };
    const pop = () => {
      const top = HI[0]; n--;
      if (n > 0) {
        const li = HI[n], lp = HP[n]; let k = 0;
        for (;;) {
          let c = 2 * k + 1; if (c >= n) break;
          if (c + 1 < n && HP[c + 1] < HP[c]) c++;
          if (HP[c] >= lp) break;
          HI[k] = HI[c]; HP[k] = HP[c]; k = c;
        }
        HI[k] = li; HP[k] = lp;
      }
      return top;
    };
    if (start >= 0) { nav.dist[start] = 0; push(start, 0); }
    for (const c of extra) if (nav.dist[c] !== 0) { nav.dist[c] = 0; push(c, 0); }
    while (n > 0 && n < HI.length - 8) {
      const d0 = HP[0], i = pop();
      if (d0 > nav.dist[i]) continue;
      if (this.flowMax && d0 > this.flowMax) break;
      const ix = i % w, iz = (i / w) | 0;
      for (let k = 0; k < 8; k++) {
        const j = canStepTo(nav, ix, iz, k); if (j < 0) continue;
        const nd = d0 + NB[k][2] * (nav.edge[j] ? 2.4 : 1);
        if (nd < nav.dist[j]) { nav.dist[j] = nd; push(j, nd); }
      }
    }
    nav.flowStart = start;
    return true;
  };

  function bestStep(nav, i) {
    const w = nav.w, ix = i % w, iz = (i / w) | 0;
    let bd = nav.dist[i], bj = -1;
    for (let k = 0; k < 8; k++) {
      const j = canStepTo(nav, ix, iz, k); if (j < 0) continue;
      if (nav.dist[j] < bd) { bd = nav.dist[j]; bj = j; }
    }
    return bj;
  }
  /** Direction along the flow field from (x,z). Returns false at goal / unreachable. */
  W.flowDir = function (x, z, out) {
    const nav = this.nav; if (!nav) return false;
    let i = this.cellAt(x, z);
    if (i < 0) return false;
    if (!isFinite(nav.dist[i])) {
      // standing on a blocked/edge cell: step toward any finite neighbour
      const w = nav.w, ix = i % w, iz = (i / w) | 0; let bd = Infinity, bj = -1;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x2 = ix + dx, z2 = iz + dz; if (x2 < 0 || z2 < 0 || x2 >= w || z2 >= nav.h) continue;
        const j = z2 * w + x2; if (nav.dist[j] < bd) { bd = nav.dist[j]; bj = j; }
      }
      if (bj < 0) return false;
      out.x = this.cellX(bj) - x; out.z = this.cellZ(bj) - z;
    } else {
      const j = bestStep(nav, i);
      if (j < 0) return false;
      let tx = this.cellX(j), tz = this.cellZ(j);
      const k = bestStep(nav, j);
      if (k >= 0 && !nav.edge[j] && !nav.edge[k]) { tx = (tx + this.cellX(k)) * 0.5; tz = (tz + this.cellZ(k)) * 0.5; }
      out.x = tx - x; out.z = tz - z;
    }
    const l = Math.sqrt(out.x * out.x + out.z * out.z) || 1;
    out.x /= l; out.z /= l;
    return true;
  };
  W.flowDist = function (x, z) { const i = this.cellAt(x, z); return i >= 0 ? this.nav.dist[i] : Infinity; };

  /** Random main-component cell in an annulus around (x,z). */
  W.randomWalkable = function (x, z, rMin, rMax, tries) {
    for (let t = 0; t < (tries || 40); t++) {
      const a = Math.random() * Math.PI * 2, r = U.rand(rMin, rMax);
      const i = this.cellAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (this.isMain(i) && !this.nav.edge[i]) return i;
    }
    return -1;
  };
})(window.CF);
