'use strict';
/* Cinderfall — HUD (DOM overlay). Writes are batched and diffed to avoid layout churn. */
(function (CF) {
  const U = CF.U;
  const $ = (id) => document.getElementById(id);
  const H = CF.HUD = { el: {}, hintT: 0, radioQ: [], radioT: 0, dmgArcs: [], nums: [], suppressV: 0, hurtV: 0, flashV: 0, objTarget: null, objLabel: '', last: {} };

  H.init = function () {
    const ids = ['hud', 'compassStrip', 'compassObj', 'compassHeading', 'objPanel', 'objPhase', 'objText', 'objMeter', 'objFill', 'objCount', 'scoreNum',
      'worldMarker', 'wmLabel', 'wmDist', 'crosshair', 'hitmarker', 'dmgRing', 'popups', 'dmgNumbers', 'killfeed', 'armorFill', 'armorNum', 'healthFill',
      'healthGhost', 'healthNum', 'ammoMag', 'ammoRes', 'weaponName', 'weaponSlots', 'grenades', 'interact', 'interactFill', 'interactText', 'hint', 'radio',
      'radioWho', 'radioLine', 'bossBar', 'bossFill', 'bossStage', 'scope', 'scopeRead', 'phaseCard', 'pcNum', 'pcTitle', 'pcSub', 'fps', 'flash'];
    for (const id of ids) this.el[id] = $(id);
    this.vitals = document.querySelector('.vitals');
    this.buildCompass();
    for (let i = 0; i < 6; i++) { const a = document.createElement('div'); a.className = 'dmg-arc'; this.el.dmgRing.appendChild(a); this.dmgArcs.push({ el: a, t: 0, ang: 0, from: null }); }
    this.threat = [];
    for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;top:0;left:50%;width:3px;height:9px;margin-left:-1.5px;background:#ff4a2a;box-shadow:0 0 6px #ff4a2a;opacity:0'; this.el.compassStrip.parentNode.appendChild(d); this.threat.push(d); }
  };
  H.show = function (v) { this.el.hud.hidden = !v; };
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ESC[c]);

  // ------------------------------------------------------------ compass (px per degree = 2.2)
  const PXD = 2.2;
  H.buildCompass = function () {
    const s = this.el.compassStrip, names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    let html = '';
    for (let d = -360; d <= 720; d += 15) {
      const x = (d + 360) * PXD, dd = ((d % 360) + 360) % 360;
      html += '<i class="ct' + (dd % 45 === 0 ? ' major' : '') + '" style="left:' + x + 'px"></i>';
      if (names[dd] !== undefined) html += '<span class="cl card' + (dd === 0 ? ' north' : '') + '" style="left:' + x + 'px">' + names[dd] + '</span>';
      else if (dd % 30 === 0) html += '<span class="cl" style="left:' + x + 'px">' + dd + '</span>';
    }
    s.innerHTML = html;
  };
  function heading(yaw) { let h = (-yaw * 180 / Math.PI) % 360; if (h < 0) h += 360; return h; }
  function bearing(dx, dz) { let b = Math.atan2(dx, -dz) * 180 / Math.PI; if (b < 0) b += 360; return b; }
  H.updateCompass = function (P) {
    const hd = heading(P.yaw + P.recoilY), w = this.el.compassStrip.parentNode.clientWidth;
    this.el.compassStrip.style.transform = 'translateX(' + (w / 2 - (hd + 360) * PXD) + 'px)';
    const hs = String(Math.round(hd) % 360).padStart(3, '0');
    if (this.last.hd !== hs) { this.el.compassHeading.textContent = hs; this.last.hd = hs; }
    const o = this.objTarget;
    if (o) {
      const rel = U.wrapAngle((bearing(o.x - P.body.pos.x, o.z - P.body.pos.z) - hd) * Math.PI / 180) * 180 / Math.PI;
      const x = U.clamp(rel * PXD, -w / 2 + 8, w / 2 - 8);
      this.el.compassObj.style.opacity = '1';
      this.el.compassObj.style.transform = 'translateX(' + x + 'px) rotate(45deg)';
    } else this.el.compassObj.style.opacity = '0';
    // enemies that fired recently show as red ticks
    let k = 0;
    for (const e of CF.Enemies.list) {
      if (k >= this.threat.length) break;
      if (!e.alive || CF.time - e.lastFired > 1.6) continue;
      const rel = U.wrapAngle((bearing(e.body.pos.x - P.body.pos.x, e.body.pos.z - P.body.pos.z) - hd) * Math.PI / 180) * 180 / Math.PI;
      if (Math.abs(rel * PXD) > w / 2) continue;
      const d = this.threat[k++]; d.style.opacity = String(1 - (CF.time - e.lastFired) / 1.6); d.style.transform = 'translateX(' + (rel * PXD) + 'px)';
    }
    for (; k < this.threat.length; k++) this.threat[k].style.opacity = '0';
  };

  // ------------------------------------------------------------ objective + world marker
  H.setObjective = function (phase, text, target, label) {
    this.el.objPhase.textContent = phase; this.el.objText.textContent = text;
    this.objTarget = target || null; this.objLabel = label || 'Objective';
    this.el.wmLabel.textContent = this.objLabel;
    this.el.objPanel.classList.remove('pulse'); void this.el.objPanel.offsetWidth; this.el.objPanel.classList.add('pulse');
  };
  H.setProgress = function (frac, count) {
    this.el.objMeter.hidden = frac == null;
    if (frac != null) this.el.objFill.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + '%';
    this.el.objCount.textContent = count || '';
  };
  const _p = new THREE.Vector3();
  H.updateMarker = function (cam, P) {
    const o = this.objTarget, m = this.el.worldMarker;
    if (!o || CF.Weapons.adsE > 0.9 && CF.Weapons.cur.def.scope) { m.hidden = true; return; }
    m.hidden = false;
    _p.set(o.x, (o.y || 0) + 1.6, o.z);
    const dist = Math.hypot(o.x - P.body.pos.x, o.z - P.body.pos.z);
    _p.project(cam);
    const W = window.innerWidth, Hh = window.innerHeight;
    let x = (_p.x * 0.5 + 0.5) * W, y = (-_p.y * 0.5 + 0.5) * Hh;
    const behind = _p.z > 1;
    let edge = false;
    if (behind) { x = W - x; y = Hh - 60; edge = true; }
    const pad = 60;
    if (x < pad || x > W - pad || y < pad || y > Hh - pad) edge = true;
    x = U.clamp(x, pad, W - pad); y = U.clamp(y, pad, Hh - pad);
    m.style.transform = 'translate(' + (x - 40) + 'px,' + (y - 12) + 'px)';
    m.style.width = '80px';
    m.classList.toggle('edge', edge);
    const dt = Math.round(dist) + ' m';
    if (this.last.wm !== dt) { this.el.wmDist.textContent = dt; this.last.wm = dt; }
    const near = dist < 6;
    m.style.opacity = near ? '0.35' : '1';
  };

  // ------------------------------------------------------------ combat feedback
  H.setSpread = function (px, hidden) {
    const s = Math.round(U.clamp(px, 4, 120)) + 'px';
    if (this.last.sp !== s) { this.el.crosshair.style.setProperty('--spread', s); this.last.sp = s; }
    if (this.last.chH !== hidden) { this.el.crosshair.classList.toggle('hidden', hidden); this.last.chH = hidden; }
  };
  H.hitmarker = function (kind) {
    const h = this.el.hitmarker;
    h.className = 'hitmarker'; void h.offsetWidth;
    h.className = 'hitmarker show ' + (kind === 'hit' ? '' : kind);
  };
  H.damageFrom = function (from, pos, yaw, amount) {
    let slot = this.dmgArcs.find((a) => a.t <= 0) || this.dmgArcs.reduce((a, b) => (a.t < b.t ? a : b));
    slot.t = 1.4; slot.from = from.clone ? from.clone() : new THREE.Vector3(from.x, from.y, from.z); slot.amt = amount;
  };
  H.updateArcs = function (dt, P) {
    const hd = heading(P.yaw);
    for (const a of this.dmgArcs) {
      if (a.t <= 0) { if (a.el.style.opacity !== '0') a.el.style.opacity = '0'; continue; }
      a.t -= dt;
      const rel = bearing(a.from.x - P.body.pos.x, a.from.z - P.body.pos.z) - hd;
      a.el.style.transform = 'rotate(' + rel.toFixed(1) + 'deg)';
      a.el.style.opacity = String(U.clamp(a.t, 0, 1) * (0.5 + 0.5 * a.amt));
    }
  };
  H.hurt = function (k, armor) { this.hurtV = Math.min(1, this.hurtV + k * (armor ? 0.5 : 1)); };
  H.suppress = function (k) { this.suppressV = Math.min(1, this.suppressV + k); };
  H.flash = function (k) { this.flashV = Math.max(this.flashV, k); };

  H.popup = function (text, pts, kind) {
    const d = document.createElement('div');
    d.className = 'popup ' + (kind || '');
    d.innerHTML = (pts ? '<b>+' + (+pts || 0) + '</b>' : '') + esc(text);
    this.el.popups.appendChild(d);
    while (this.el.popups.children.length > 4) this.el.popups.removeChild(this.el.popups.firstChild);
    setTimeout(() => d.remove(), 1450);
  };
  H.killfeed = function (text, extra) {
    const d = document.createElement('div'); d.className = 'kf-row';
    d.innerHTML = esc(text) + (extra ? '<em>' + esc(extra) + '</em>' : '');
    this.el.killfeed.appendChild(d);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.removeChild(this.el.killfeed.firstChild);
    setTimeout(() => d.classList.add('out'), 3500); setTimeout(() => d.remove(), 4100);
  };
  H.dmgNumber = function (point, value, kind) {
    if (!CF.settings.dmgNumbers) return;
    if (this.nums.length > 24) { const o = this.nums.shift(); o.el.remove(); }
    const el = document.createElement('div'); el.className = 'dn ' + (kind || '');
    el.textContent = kind === 'armor' ? 'ARMOR' : Math.round(value);
    this.el.dmgNumbers.appendChild(el);
    this.nums.push({ el, p: point.clone().add(new THREE.Vector3(U.gauss() * 0.2, 0.2, U.gauss() * 0.2)), t: 0, vy: 1.4 });
  };
  H.updateNumbers = function (dt, cam) {
    const W = window.innerWidth, Hh = window.innerHeight;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t += dt; n.p.y += n.vy * dt; n.vy *= 0.94;
      if (n.t > 0.9) { n.el.remove(); this.nums.splice(i, 1); continue; }
      _p.copy(n.p).project(cam);
      if (_p.z > 1) { n.el.style.opacity = '0'; continue; }
      n.el.style.transform = 'translate(' + ((_p.x * 0.5 + 0.5) * W).toFixed(0) + 'px,' + ((-_p.y * 0.5 + 0.5) * Hh).toFixed(0) + 'px) translate(-50%,-50%) scale(' + (n.t < 0.1 ? 1.3 - n.t * 3 : 1).toFixed(2) + ')';
      n.el.style.opacity = String(Math.min(1, (0.9 - n.t) * 3));
    }
  };

  // ------------------------------------------------------------ vitals + weapon
  H.setVitals = function (hp, armor) {
    const h = Math.ceil(hp), a = Math.ceil(armor);
    if (this.last.hp !== h) {
      this.el.healthFill.style.width = h + '%';
      this.el.healthGhost.style.width = h + '%';
      this.el.healthNum.textContent = h;
      this.vitals.classList.toggle('low', h < 30);
      this.last.hp = h;
    }
    if (this.last.ar !== a) { this.el.armorFill.style.width = a + '%'; this.el.armorNum.textContent = a; this.last.ar = a; }
  };
  H.setAmmo = function (mag, reserve, magSize) {
    const m = String(mag), r = reserve === Infinity ? '/ ∞' : '/ ' + reserve;
    if (this.last.mag !== m) { this.el.ammoMag.textContent = m; this.el.ammoMag.classList.toggle('low', mag <= Math.ceil(magSize * 0.25)); this.last.mag = m; }
    if (this.last.res !== r) { this.el.ammoRes.textContent = r; this.last.res = r; }
  };
  H.ammoBump = function () { const e = this.el.ammoMag; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); };
  H.setWeapon = function (def, inv, order, newId) {
    this.el.weaponName.textContent = def.name;
    let html = '';
    order.forEach((id, i) => {
      const d = CF.Weapons.defs[id];
      html += '<div class="slot' + (id === def.id ? ' active' : '') + (!inv[id] ? ' empty' : '') + (id === newId ? ' new' : '') + '"><kbd>' + CF.Keys.label('slot' + (i + 1)) + '</kbd>' + d.short + '</div>';
    });
    this.el.weaponSlots.innerHTML = html;
  };
  H.setGrenades = function (n, max) {
    let html = ''; for (let i = 0; i < max; i++) html += '<i class="gpip' + (i < n ? '' : ' off') + '"></i>';
    this.el.grenades.innerHTML = html;
  };
  H.setScore = function (s) { const t = s.toLocaleString('en-US'); if (this.last.sc !== t) { this.el.scoreNum.textContent = t; this.last.sc = t; } };

  // ------------------------------------------------------------ prompts, radio, cards
  H.hint = function (text, warn) {
    this.hintT = 0.25;
    if (this.last.hint !== text) { this.el.hint.textContent = text; this.last.hint = text; }
    this.el.hint.classList.toggle('warn', !!warn);
    this.el.hint.hidden = false;
  };
  H.interact = function (text, frac) {
    if (text == null) { if (!this.el.interact.hidden) this.el.interact.hidden = true; return; }
    this.el.interact.hidden = false;
    if (this.last.it !== text) { this.el.interactText.textContent = text; this.last.it = text; }
    this.el.interactFill.style.strokeDashoffset = String(113.1 * (1 - U.clamp(frac || 0, 0, 1)));
  };
  H.radio = function (who, line, hostile) {
    this.radioQ.push({ who, line, hostile });
    if (this.radioT <= 0 && this.radioQ.length === 1) this.nextRadio();
  };
  H.nextRadio = function () {
    const r = this.radioQ.shift();
    if (!r) { this.el.radio.hidden = true; return; }
    this.el.radio.hidden = false;
    this.el.radioWho.textContent = r.who; this.el.radioWho.classList.toggle('hostile', !!r.hostile);
    this.el.radioLine.textContent = '';
    this.radioFull = r.line; this.radioChars = 0; this.radioT = 2.2 + r.line.length * 0.045;
    CF.Audio.play('radio', null, { ui: true });
  };
  H.updateRadio = function (dt) {
    if (this.radioT <= 0) return;
    this.radioT -= dt;
    if (this.radioChars < this.radioFull.length) {
      this.radioChars = Math.min(this.radioFull.length, this.radioChars + dt * 55);
      this.el.radioLine.textContent = this.radioFull.slice(0, Math.floor(this.radioChars));
    }
    if (this.radioT <= 0) { CF.Audio.play('radioOut', null, { ui: true }); this.nextRadio(); }
  };
  H.clearRadio = function () { this.radioQ.length = 0; this.radioT = 0; this.el.radio.hidden = true; };
  H.phaseCard = function (num, title, sub) {
    const c = this.el.phaseCard;
    this.el.pcNum.textContent = num; this.el.pcTitle.textContent = title; this.el.pcSub.textContent = sub || '';
    c.hidden = true; void c.offsetWidth; c.hidden = false;
    clearTimeout(this.cardTo); this.cardTo = setTimeout(() => { c.hidden = true; }, 4300);
  };
  H.bossBar = function (show, frac, stage) {
    if (!show) { this.el.bossBar.hidden = true; return; }
    this.el.bossBar.hidden = false;
    const w = (U.clamp(frac, 0, 1) * 100).toFixed(1) + '%';
    if (this.last.boss !== w) { this.el.bossFill.style.width = w; this.last.boss = w; }
    if (stage && this.last.bs !== stage) { this.el.bossStage.textContent = stage; this.last.bs = stage; }
  };
  H.showScope = function (on, steady, breath) {
    if (this.last.scope !== on) { this.el.scope.hidden = !on; this.last.scope = on; }
    if (on) {
      const P = CF.Player, cam = CF.Game.camera, d = new THREE.Vector3();
      cam.getWorldDirection(d);
      const h = CF.World.raycast(cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z, 400);
      const txt = (steady ? 'STEADY · ' : breath < 4 ? 'HOLD ' + CF.Keys.label('sprint').toUpperCase() + ' TO STEADY · ' : '') + '3.5x · ' + (h ? Math.round(h.t) : '---') + ' m';
      if (this.last.sr !== txt) { this.el.scopeRead.textContent = txt; this.last.sr = txt; }
    }
  };
  H.fps = function (v) {
    const on = CF.settings.showFps;
    this.el.fps.hidden = !on;
    if (on) this.el.fps.textContent = v + ' fps';
  };

  H.reset = function () {
    this.el.popups.innerHTML = ''; this.el.killfeed.innerHTML = ''; this.el.dmgNumbers.innerHTML = ''; this.nums.length = 0;
    for (const a of this.dmgArcs) a.t = 0;
    this.hurtV = 0; this.suppressV = 0; this.flashV = 0; this.last = {};
    this.bossBar(false); this.interact(null); this.clearRadio(); this.el.scope.hidden = true; this.el.phaseCard.hidden = true;
  };

  H.update = function (dt, cam, P) {
    this.updateCompass(P);
    this.updateMarker(cam, P);
    this.updateArcs(dt, P);
    this.updateNumbers(dt, cam);
    this.updateRadio(dt);
    this.hintT -= dt;
    if (this.hintT <= 0 && !this.el.hint.hidden) this.el.hint.hidden = true;
    this.hurtV = Math.max(0, this.hurtV - dt * 1.4);
    this.suppressV = Math.max(0, this.suppressV - dt * 1.2);
    this.flashV = Math.max(0, this.flashV - dt * 1.5);
    const fo = this.flashV.toFixed(2);
    if (this.last.fl !== fo) { this.el.flash.style.opacity = fo; this.last.fl = fo; }
    const aim = CF.Enemies.aimed;
    if (this.last.en !== aim) { this.el.crosshair.classList.toggle('enemy', !!aim); this.last.en = aim; }
  };
})(window.CF);
