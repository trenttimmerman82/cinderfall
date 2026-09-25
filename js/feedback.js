'use strict';
/* Cinderfall — player feedback. Anyone can send a message from the main menu; it goes to the game server
   (server/worker.js, POST /feedback). The "Developer inbox" tab reads them back with the FEEDBACK_KEY secret. */
(function (CF) {
  const $ = (id) => document.getElementById(id);
  const KEY_STORE = 'cinderfall.feedbackKey';
  const CAT_LABEL = { bug: 'Bug', gameplay: 'Gameplay', performance: 'Lag / FPS', idea: 'Idea', other: 'Other' };
  const FB = CF.Feedback = { cat: 'bug', rating: 0, filter: 'open', busy: false, bound: false };
  const server = () => String(CF.SERVER || '').replace(/\/+$/, '');
  const call = (body) => fetch(server() + '/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json().catch(() => ({})).then((d) => { if (!r.ok) throw new Error(d.error || (r.status === 404 ? 'The game server needs updating before it can take feedback.' : 'Server error ' + r.status)); return d; }));
  const press = (sel, attr, v) => { for (const b of document.querySelectorAll(sel)) b.setAttribute('aria-pressed', String(b.dataset[attr] === String(v))); };
  const status = (id, text, err) => { const el = $(id); el.textContent = text; el.classList.toggle('err', !!err); };

  FB.open = function () {
    this.bind();
    $('fbName').value = CF.MP.name === 'Operative' ? '' : CF.MP.name;
    this.tab('send');
    if (!server()) status('fbStatus', 'Feedback needs the game server, and this copy of the game has none set up.', true);
  };
  FB.tab = function (t) {
    for (const b of document.querySelectorAll('[data-fbtab]')) b.setAttribute('aria-selected', String(b.dataset.fbtab === t));
    $('fbSend').hidden = t !== 'send'; $('fbRead').hidden = t !== 'read';
    if (t === 'read') { try { $('fbKey').value = localStorage.getItem(KEY_STORE) || ''; } catch (e) { /* storage unavailable */ } if ($('fbKey').value) this.load(); }
  };

  FB.bind = function () {
    if (this.bound) return; this.bound = true;
    for (const b of document.querySelectorAll('[data-fbtab]')) b.addEventListener('click', () => this.tab(b.dataset.fbtab));
    for (const b of document.querySelectorAll('[data-fbcat]')) b.addEventListener('click', () => { this.cat = b.dataset.fbcat; press('[data-fbcat]', 'fbcat', this.cat); });
    for (const b of document.querySelectorAll('[data-fbrate]')) b.addEventListener('click', () => { const v = +b.dataset.fbrate; this.rating = this.rating === v ? 0 : v; press('[data-fbrate]', 'fbrate', this.rating); });
    for (const b of document.querySelectorAll('[data-fbfilter]')) b.addEventListener('click', () => { this.filter = b.dataset.fbfilter; press('[data-fbfilter]', 'fbfilter', this.filter); this.load(); });
    $('fbText').addEventListener('input', (e) => { $('fbCount').textContent = e.target.value.length + ' / 2000'; });
    $('fbSubmit').addEventListener('click', () => this.send());
    $('fbLoad').addEventListener('click', () => this.load());
    $('fbKey').addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') this.load(); });
  };

  /** A little context so bug reports are useful: build, browser, screen and graphics quality. */
  function context() {
    const hud = $('fps'), fps = hud && !hud.hidden ? parseInt(hud.textContent, 10) : null;
    return {
      build: (document.querySelector('.main-foot span:last-child') || {}).textContent || '',
      ua: navigator.userAgent.slice(0, 160), screen: window.innerWidth + 'x' + window.innerHeight + '@' + (window.devicePixelRatio || 1),
      quality: CF.bootQuality || '', fps: fps || undefined
    };
  }

  FB.send = function () {
    if (this.busy) return;
    const text = $('fbText').value.trim();
    if (!server()) { status('fbStatus', 'Feedback needs the game server, and this copy of the game has none set up.', true); return; }
    if (text.length < 3) { status('fbStatus', 'Write a little more first.', true); return; }
    this.busy = true; $('fbSubmit').disabled = true; status('fbStatus', 'Sending…');
    call({ op: 'send', cat: this.cat, rating: this.rating || null, text, name: $('fbName').value.trim(), pub: CF.Profile.pub(), ctx: context() })
      .then(() => { $('fbText').value = ''; $('fbCount').textContent = '0 / 2000'; this.rating = 0; press('[data-fbrate]', 'fbrate', 0); status('fbStatus', 'Thanks! Your feedback was sent.'); })
      .catch((e) => status('fbStatus', e.message === 'Failed to fetch' ? 'Could not reach the server. Check your connection and try again.' : e.message, true))
      .finally(() => { this.busy = false; $('fbSubmit').disabled = false; });
  };

  // ------------------------------------------------------------ developer inbox
  FB.key = () => $('fbKey').value.trim();
  FB.load = function () {
    const key = this.key();
    if (!key) { status('fbReadStatus', 'Enter the developer key first.', true); return; }
    status('fbReadStatus', 'Loading…');
    call({ op: 'list', key, filter: this.filter }).then((d) => {
      try { localStorage.setItem(KEY_STORE, key); } catch (e) { /* storage unavailable */ }
      status('fbReadStatus', '');
      this.render(d);
    }).catch((e) => { status('fbReadStatus', e.message, true); $('fbList').textContent = ''; $('fbSummary').textContent = ''; });
  };
  FB.render = function (d) {
    const sum = $('fbSummary'); sum.textContent = '';
    const chip = (label, n, extra) => { const c = document.createElement('span'); c.className = 'fb-chip'; c.textContent = label + ' ' + n + (extra || ''); sum.appendChild(c); };
    chip('Total', d.total, ' · ' + d.open + ' open' + (d.avg ? ' · avg rating ' + (+d.avg).toFixed(1) + '/5' : ''));
    for (const c of d.counts) chip(CAT_LABEL[c.cat] || c.cat, c.n, ' (' + (c.open || 0) + ' open)');
    const list = $('fbList'); list.textContent = '';
    if (!d.rows.length) { const p = document.createElement('p'); p.className = 'lb-empty'; p.textContent = 'Nothing here.'; list.appendChild(p); return; }
    for (const r of d.rows) {
      const card = document.createElement('article'); card.className = 'fb-card' + (r.done ? ' done' : '');
      const head = document.createElement('header');
      const cat = document.createElement('b'); cat.className = 'fb-cat ' + r.cat; cat.textContent = CAT_LABEL[r.cat] || r.cat;
      const who = document.createElement('span'); who.textContent = r.name + ' · ' + new Date(r.date).toLocaleString() + (r.rating ? ' · rated ' + r.rating + '/5' : '');
      head.append(cat, who);
      const body = document.createElement('p'); body.textContent = r.text;
      const ctx = document.createElement('small'); const c = r.ctx || {};
      ctx.textContent = [c.build, c.quality && 'quality ' + c.quality, c.screen, c.fps && c.fps + ' fps', c.ua].filter(Boolean).join(' · ');
      const acts = document.createElement('div'); acts.className = 'fb-acts';
      const done = document.createElement('button'); done.className = 'btn-ghost'; done.textContent = r.done ? 'Reopen' : 'Mark done';
      done.addEventListener('click', () => call({ op: 'done', key: this.key(), id: r.id, done: !r.done }).then(() => this.load()).catch((e) => status('fbReadStatus', e.message, true)));
      const del = document.createElement('button'); del.className = 'btn-ghost danger'; del.textContent = 'Delete';
      del.addEventListener('click', () => { if (confirm('Delete this feedback for good?')) call({ op: 'remove', key: this.key(), id: r.id }).then(() => this.load()).catch((e) => status('fbReadStatus', e.message, true)); });
      acts.append(done, del);
      card.append(head, body, ctx, acts); list.appendChild(card);
    }
  };
})(window.CF);
