/* ============================================================
   TickBox visualisations — shared by presenter, editor preview
   and phone result views. Everything animates in place: DOM nodes
   are reused between updates so CSS transitions do the work.
   ============================================================ */
(function () {
  const COLORS = ['#5B3DF5', '#FF6B4A', '#12B886', '#FFB020', '#E8459A', '#2E9BFF', '#8C52FF', '#0FA3A3', '#F25C54', '#7AC74F'];
  const QUIZ_COLORS = ['#E5484D', '#2E6BFF', '#F0A000', '#12A46E', '#8C52FF', '#E8459A'];
  const PASTELS = ['#FFF1B8', '#D9F6E8', '#E7E2FF', '#FFE2D8', '#DCEEFF', '#FFE0F0'];
  const SHAPES = [
    '<polygon points="12,3 22,21 2,21" fill="#fff"/>',
    '<polygon points="12,2 22,12 12,22 2,12" fill="#fff"/>',
    '<circle cx="12" cy="12" r="10" fill="#fff"/>',
    '<rect x="3" y="3" width="18" height="18" rx="2" fill="#fff"/>',
    '<polygon points="12,2 15,9 22,9.5 16.5,14 18.5,21.5 12,17.5 5.5,21.5 7.5,14 2,9.5 9,9" fill="#fff"/>',
    '<polygon points="7,3 17,3 22,12 17,21 7,21 2,12" fill="#fff"/>',
  ];
  const TYPE_META = {
    mc: { icon: '📊', name: 'Multiple choice', desc: 'Vote on options, live bar chart' },
    wordcloud: { icon: '☁️', name: 'Word cloud', desc: 'Words grow as more people say them' },
    open: { icon: '💬', name: 'Open ended', desc: 'Free-text answers on a live wall' },
    scale: { icon: '🎚️', name: 'Scales', desc: 'Rate statements on a scale' },
    ranking: { icon: '🏅', name: 'Ranking', desc: 'Put items in order of preference' },
    quiz: { icon: '⚡', name: 'Quiz', desc: 'Timed question with points' },
    leaderboard: { icon: '🏆', name: 'Leaderboard', desc: 'Podium + top 10 quiz scores' },
    lobby: { icon: '🚪', name: 'Lobby', desc: 'Waiting room — joined names pop up' },
    qa: { icon: '🙋', name: 'Q&A', desc: 'Audience asks and upvotes questions' },
    content: { icon: '📝', name: 'Heading', desc: 'Title or info slide, no voting' },
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  function tween(el, to, fmt) {
    fmt = fmt || (x => Math.round(x).toLocaleString());
    const from = el._v == null ? 0 : el._v;
    if (from === to) { el.textContent = fmt(to); return; }
    el._v = to;
    cancelAnimationFrame(el._raf);
    const t0 = performance.now(), d = 700;
    const step = now => {
      const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  /* ---------------- main entry ---------------- */
  function render(stage, slide, data, opts) {
    opts = opts || {};
    const key = slide.id + '|' + slide.type + '|' + JSON.stringify([slide.question, slide.options, slide.statements, slide.max, slide.body, slide.minLabel, slide.maxLabel, slide.correct, slide.time]);
    let st = stage._tb;
    if (!st || st.key !== key || opts.rebuild) {
      if (st) cleanup(st);
      st = stage._tb = { key, slideId: slide.id };
      buildFrame(stage, slide, opts);
    }
    st.slide = slide; st.data = data; st.opts = opts;
    const viz = stage.querySelector('.viz');
    if (!viz) return;
    viz.classList.toggle('blurred', !!opts.hideResults && slide.type !== 'content');
    let note = viz.querySelector('.viz-hidden-note');
    if (opts.hideResults && !note && slide.type !== 'content') {
      note = document.createElement('div'); note.className = 'viz-hidden-note'; note.textContent = '🙈 Results hidden';
      viz.appendChild(note);
    } else if (!opts.hideResults && note) note.remove();
    const fn = R[slide.type];
    if (fn) fn(viz, slide, data, st, opts);
  }

  function cleanup(st) {
    if (st.raf) cancelAnimationFrame(st.raf);
    if (st.timers) st.timers.forEach(clearTimeout);
  }

  function buildFrame(stage, slide, opts) {
    const sub = subtitle(slide, opts);
    stage.innerHTML = slide.type === 'content'
      ? `<div class="slide content-slide ${opts.noAnim ? '' : 'slide-enter'}"><h2 class="slide-q">${esc(slide.question || 'Heading')}</h2>${slide.body ? `<div class="body">${esc(slide.body)}</div>` : ''}</div>`
      : `<div class="slide ${opts.noAnim ? '' : 'slide-enter'}"><h2 class="slide-q">${esc(slide.question || 'Your question here')}</h2>${sub ? `<div class="slide-sub">${sub}</div>` : ''}<div class="viz"></div></div>`;
  }

  function subtitle(slide, opts) {
    if (slide.type === 'quiz') return `⚡ Quiz · ${slide.time}s · fastest correct answers win more points`;
    if (slide.type === 'leaderboard') return '';
    if (slide.type === 'qa' && opts.joinUrl) return `Ask at <b>${esc(opts.joinUrl)}</b>`;
    return '';
  }

  function emptyHint(viz, show, html) {
    let h = viz.querySelector(':scope > .empty-hint');
    if (show && !h) { h = document.createElement('div'); h.className = 'empty-hint'; viz.appendChild(h); }
    if (show) h.innerHTML = html; else if (h) h.remove();
  }

  /* ---------------- renderers ---------------- */
  const R = {};

  R.mc = function (viz, slide, data, st) {
    const counts = data && data.counts ? data.counts : slide.options.map(() => 0);
    columns(viz, st, slide.options, counts, data ? data.total : 0, COLORS);
  };

  function columns(viz, st, labels, counts, total, palette, extra) {
    let first = false;
    if (!st.cols) {
      first = true;
      const wrap = document.createElement('div');
      wrap.className = 'cols';
      wrap.innerHTML = labels.map((o, i) => `<div class="col" style="--c:${palette[i % palette.length]}"><div class="col-val"><span class="num">0</span><span class="pct">0%</span></div><div class="bar-track"><div class="bar"></div></div><div class="col-label">${esc(o)}</div></div>`).join('');
      viz.appendChild(wrap);
      st.cols = [...wrap.children];
    }
    const apply = () => {
      const max = Math.max(1, ...counts);
      st.cols.forEach((c, i) => {
        const n = counts[i] || 0;
        c.querySelector('.bar').style.height = Math.max(0, n / max * 100) + '%';
        tween(c.querySelector('.num'), n);
        c.querySelector('.pct').textContent = (total ? Math.round(n / total * 100) : 0) + '%';
        if (extra) extra(c, i);
      });
    };
    if (first) requestAnimationFrame(() => requestAnimationFrame(apply)); else apply();
  }

  R.quiz = function (viz, slide, data, st, opts) {
    data = data || { counts: slide.options.map(() => 0), total: 0, started: false, revealed: false };
    const phase = data.board ? 'board' : data.revealed ? 'reveal' : !data.started ? 'wait' : data.readyIn > 0 ? 'ready' : 'run';
    if (st.phase !== phase) {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.phase = phase; st.cols = null; st.list = null; st.rows = null;
      viz.querySelectorAll(':scope > :not(.viz-hidden-note)').forEach(n => n.remove());
      if (phase === 'reveal' || phase === 'board') {
        // filled below
      } else if (phase === 'ready') {
        const r = document.createElement('div');
        r.className = 'quiz-ready';
        r.innerHTML = `<div class="ready-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#E3DED2" stroke-width="7"/><circle class="ring" cx="50" cy="50" r="44" fill="none" stroke="#5B3DF5" stroke-width="7" stroke-linecap="round" stroke-dasharray="276.5"/></svg><div class="num"></div></div><div class="ready-txt">Get ready to answer!</div>`;
        viz.appendChild(r);
        st.goAt = Date.now() + (data.readyIn || 0);
        const total = data.readyIn || 4000;
        const ring = r.querySelector('.ring'), num = r.querySelector('.num');
        const loop = () => {
          const left = Math.max(0, st.goAt - Date.now());
          num.textContent = left > 0 ? Math.ceil(left / 1000) : 'Go!';
          ring.style.strokeDashoffset = String(276.5 * (left / total));
          if (left > 0) st.raf = requestAnimationFrame(loop);
        };
        loop();
      } else {
        const grid = document.createElement('div');
        grid.className = 'quiz-grid' + (phase === 'run' ? ' running' : opts.host ? ' waiting' : '');
        grid.style.gridTemplateRows = `repeat(${Math.ceil(slide.options.length / 2)}, 1fr)`;
        grid.innerHTML = slide.options.map((o, i) => `<div class="quiz-opt" style="--c:${QUIZ_COLORS[i]};animation-delay:${i * 70}ms"><svg class="shape" viewBox="0 0 24 24">${SHAPES[i]}</svg><span>${esc(o)}</span></div>`).join('');
        viz.appendChild(grid);
        if (phase === 'run') {
          const t = document.createElement('div');
          t.className = 'quiz-timer';
          t.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="#E3DED2" stroke-width="8"/><circle class="ring" cx="50" cy="50" r="44" fill="none" stroke="#5B3DF5" stroke-width="8" stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><div class="num">0</div>`;
          viz.appendChild(t);
          const a = document.createElement('div'); a.className = 'quiz-answers'; viz.appendChild(a);
          st.endsAt = Date.now() + (data.remaining != null ? data.remaining : slide.time * 1000);
          const ring = t.querySelector('.ring'), num = t.querySelector('.num');
          const loop = () => {
            const left = Math.max(0, st.endsAt - Date.now());
            num.textContent = Math.ceil(left / 1000);
            ring.style.strokeDashoffset = String(276.5 * (1 - left / (slide.time * 1000)));
            ring.style.stroke = left < 5000 ? '#E5484D' : '#5B3DF5';
            if (left > 0) st.raf = requestAnimationFrame(loop);
          };
          loop();
        } else if (opts.host) {
          const w = document.createElement('div');
          w.className = 'quiz-hint';
          w.textContent = 'Press “⚡ Start quiz” when everyone is ready';
          viz.appendChild(w);
        }
      }
    }
    if (phase === 'run') {
      const a = viz.querySelector('.quiz-answers');
      if (a) a.innerHTML = `<b>${data.total}</b>answer${data.total === 1 ? '' : 's'}`;
      if (data.remaining != null && Math.abs((Date.now() + data.remaining) - st.endsAt) > 1200) st.endsAt = Date.now() + data.remaining;
    }
    if (phase === 'board') {
      if (!viz.querySelector('.board-title')) {
        const t = document.createElement('div'); t.className = 'board-title'; t.textContent = '🏆 Leaderboard';
        viz.appendChild(t);
        st.boardBox = document.createElement('div'); st.boardBox.className = 'board-box';
        viz.appendChild(st.boardBox);
      }
      boardList(st.boardBox, st, data.board || [], { gains: true });
    }
    if (phase === 'reveal') {
      columns(viz, st, slide.options, data.counts, data.total, QUIZ_COLORS, (c, i) => {
        c.classList.toggle('win', i === data.correct);
        c.classList.toggle('dim', i !== data.correct);
      });
    }
  };

  /* ---- word cloud ---- */
  let measureCtx;
  function measure(text, fs) {
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    measureCtx.font = `800 ${fs}px 'Bricolage Grotesque', 'Segoe UI', sans-serif`;
    return measureCtx.measureText(text).width;
  }

  function layoutWords(words, W, H) {
    if (!words.length || W < 40 || H < 40) return [];
    const maxC = words[0][1], minC = words[words.length - 1][1];
    const ex = Math.min(2.2, Math.max(1, W / H));
    let scale = 1;
    for (let attempt = 0; attempt < 7; attempt++) {
      const maxF = Math.min(H / 3, W / 6, 120) * scale;
      const minF = Math.max(11, maxF / 5);
      const placed = [];
      let ok = true;
      for (let wi = 0; wi < words.length; wi++) {
        const [text, c, key] = words[wi];
        const r = maxC === minC ? 0.55 : (c - minC) / (maxC - minC);
        const fs = Math.round(minF + (maxF - minF) * Math.sqrt(r));
        const w = measure(text, fs) + fs * 0.35, h = fs * 1.12;
        if (w > W) { if (wi < 12) { ok = false; break; } continue; }
        let found = null;
        for (let t = 0; t < 2200; t++) {
          const a = t * 0.29, rr = a * 1.9 * Math.max(0.6, scale);
          const x = W / 2 + rr * Math.cos(a) * ex - w / 2, y = H / 2 + rr * Math.sin(a) - h / 2;
          if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
          let hit = false;
          for (let j = 0; j < placed.length; j++) {
            const p = placed[j];
            if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) { hit = true; break; }
          }
          if (!hit) { found = { x, y, w, h }; break; }
        }
        if (!found) { if (wi < 25) { ok = false; break; } continue; }
        placed.push({ ...found, fs, text, key, c });
      }
      if (ok) return placed;
      scale *= 0.84;
    }
    return [];
  }

  R.wordcloud = function (viz, slide, data, st, opts) {
    const words = (data && data.words) || [];
    if (!st.cloud) {
      st.cloud = document.createElement('div'); st.cloud.className = 'cloud';
      viz.appendChild(st.cloud);
      st.els = new Map();
    }
    emptyHint(viz, !words.length, `<div><span class="wiggle">☁️</span><br>Waiting for words…</div>`);
    const W = viz.clientWidth, H = viz.clientHeight;
    const sig = W + 'x' + H + JSON.stringify(words);
    if (sig === st.sig && !opts.force) return;
    st.sig = sig;
    const placed = layoutWords(words, W, H);
    const seen = new Set();
    placed.forEach(p => {
      seen.add(p.key);
      let el = st.els.get(p.key);
      const isNew = !el;
      if (isNew) {
        el = document.createElement('div');
        el.className = 'w new' + (opts.host ? ' host-x' : '');
        el.textContent = p.text;
        el.style.color = COLORS[hash(p.key) % COLORS.length];
        if (opts.host && opts.onHide) { el.title = 'Click to hide this word'; el.onclick = () => opts.onHide(p.key); }
        st.cloud.appendChild(el);
        st.els.set(p.key, el);
      }
      el.classList.remove('gone');
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.fontSize = p.fs + 'px';
      el.title = opts.host ? `${p.text} — ${p.c} (click to hide)` : `${p.text} — ${p.c}`;
      if (isNew) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('new')));
    });
    for (const [k, el] of st.els) {
      if (!seen.has(k)) { el.classList.add('gone'); st.els.delete(k); setTimeout(() => el.remove(), 500); }
    }
  };

  /* ---- open ended wall ---- */
  R.open = function (viz, slide, data, st, opts) {
    const items = (data && data.items) || [];
    if (!st.wall) {
      st.wall = document.createElement('div'); st.wall.className = 'wall';
      viz.appendChild(st.wall);
      st.cards = new Map();
    }
    emptyHint(viz, !items.length, `<div><span class="wiggle">💬</span><br>Responses will appear here</div>`);
    const ids = new Set(items.map(i => i.id));
    for (const [id, el] of st.cards) if (!ids.has(id)) { el.remove(); st.cards.delete(id); }
    const fresh = items.filter(it => !st.cards.has(it.id));
    for (let i = fresh.length - 1; i >= 0; i--) {
      const it = fresh[i];
      const el = document.createElement('div');
      el.className = 'card';
      el.style.setProperty('--c', PASTELS[hash(it.id) % PASTELS.length]);
      el.innerHTML = `${esc(it.text)}${it.name ? `<small>— ${esc(it.name)}</small>` : ''}${opts.host ? '<button class="x" title="Hide">✕</button>' : ''}`;
      if (opts.host && opts.onHide) el.querySelector('.x').onclick = () => opts.onHide(it.id);
      st.wall.prepend(el);
      st.cards.set(it.id, el);
    }
  };

  /* ---- scales ---- */
  R.scale = function (viz, slide, data, st) {
    const stats = (data && data.stats) || slide.statements.map(() => ({ avg: null, dist: Array(slide.max).fill(0) }));
    if (!st.rows) {
      const wrap = document.createElement('div'); wrap.className = 'scales';
      wrap.innerHTML = slide.statements.map((s, i) => `<div class="scale-row" style="--c:${COLORS[i % COLORS.length]}"><div class="lbl">${esc(s)}</div><div class="scale-track"><div class="line"></div><div class="dist">${Array(slide.max).fill('<i></i>').join('')}</div><div class="avg" style="left:50%;opacity:0">–</div></div></div>`).join('')
        + `<div class="scale-ends"><span>1 · ${esc(slide.minLabel)}</span><span>${esc(slide.maxLabel)} · ${slide.max}</span></div>`;
      viz.appendChild(wrap);
      st.rows = [...wrap.querySelectorAll('.scale-row')];
    }
    st.rows.forEach((row, i) => {
      const s = stats[i] || { avg: null, dist: [] };
      const avg = row.querySelector('.avg');
      const maxD = Math.max(1, ...s.dist);
      row.querySelectorAll('.dist i').forEach((b, k) => { b.style.height = ((s.dist[k] || 0) / maxD * 100) + '%'; });
      if (s.avg == null) { avg.style.opacity = '0'; return; }
      avg.style.opacity = '1';
      avg.style.left = ((s.avg - 1) / (slide.max - 1) * 100) + '%';
      avg.textContent = s.avg.toFixed(1);
    });
  };

  /* ---- positioned list helper ---- */
  function rlist(viz, st, items, cfg) {
    if (!st.list) {
      st.list = document.createElement('div'); st.list.className = 'rlist';
      viz.appendChild(st.list);
      st.rows = new Map();
    }
    const H = viz.clientHeight, gap = Math.max(6, H * 0.02);
    const n = Math.max(1, cfg.slots || items.length);
    const rowH = Math.max(cfg.minH || 34, Math.min(cfg.maxH || H * 0.16, (H - gap * (n - 1)) / n));
    const keep = new Set();
    items.forEach((it, i) => {
      keep.add(it.key);
      let el = st.rows.get(it.key);
      if (!el) {
        el = document.createElement('div'); el.className = 'ritem';
        el.style.top = (H + 20) + 'px';
        cfg.build(el, it);
        st.list.appendChild(el);
        st.rows.set(it.key, el);
        el.getBoundingClientRect();
      }
      el.style.height = rowH + 'px';
      el.style.top = (i * (rowH + gap)) + 'px';
      el.style.opacity = '1';
      cfg.update(el, it, i);
    });
    for (const [k, el] of st.rows) if (!keep.has(k)) { el.style.opacity = '0'; st.rows.delete(k); setTimeout(() => el.remove(), 400); }
  }

  R.ranking = function (viz, slide, data, st) {
    const order = (data && data.order) || slide.options.map((_, i) => ({ i, p: 0 }));
    const top = Math.max(1, ...order.map(o => o.p));
    rlist(viz, st, order.map(o => ({ key: 'o' + o.i, ...o })), {
      slots: slide.options.length,
      build: (el, it) => {
        el.style.setProperty('--c', COLORS[it.i % COLORS.length]);
        el.innerHTML = `<div class="fill"></div><div class="rk"></div><div class="nm">${esc(slide.options[it.i])}</div>`;
      },
      update: (el, it, i) => {
        el.querySelector('.rk').textContent = i + 1;
        el.querySelector('.fill').style.width = (data && data.total ? it.p / top * 100 : 0) + '%';
      },
    });
  };

  function moveBadge(m) {
    if (m == null || m === 0) return '';
    return m > 0 ? `<span class="mv up">▲${m}</span>` : `<span class="mv down">▼${-m}</span>`;
  }

  function boardList(box, st, top, o) {
    o = o || {};
    const best = Math.max(1, ...top.map(t => t.score));
    rlist(box, st, top.map(t => ({ key: t.id, ...t })), {
      slots: o.slots || 10, maxH: o.maxH || 64,
      build: (el, it) => {
        el.style.setProperty('--c', '#5B3DF5');
        el.innerHTML = `<div class="fill"></div><div class="rk"></div><div class="nm"></div><div class="mvbox"></div>${o.gains ? '<div class="gain"></div>' : ''}<div class="sc">0</div>`;
      },
      update: (el, it, i) => {
        const r = i + (o.offset || 0);
        el.className = 'ritem' + (r === 0 ? ' gold' : r === 1 ? ' silver' : r === 2 ? ' bronze' : '');
        el.querySelector('.rk').textContent = ['🥇', '🥈', '🥉'][r] || r + 1;
        el.querySelector('.nm').textContent = it.name;
        el.querySelector('.mvbox').innerHTML = moveBadge(it.move);
        const g = el.querySelector('.gain'); if (g) g.textContent = it.gain ? '+' + it.gain : '';
        el.querySelector('.fill').style.width = (it.score / best * 100) + '%';
        tween(el.querySelector('.sc'), it.score);
      },
    });
  }

  R.leaderboard = function (viz, slide, data, st) {
    const top = (data && data.top) || [];
    emptyHint(viz, !top.length, `<div><span class="wiggle">🏆</span><br>No quiz scores yet — add Quiz slides before this one</div>`);
    if (!st.pod) {
      viz.insertAdjacentHTML('beforeend', `<div class="lb-wrap"><div class="podium"></div><div class="lb-rest"></div></div>`);
      st.pod = viz.querySelector('.podium'); st.rest = viz.querySelector('.lb-rest');
    }
    const three = top.slice(0, 3), rest = top.slice(3);
    viz.querySelector('.lb-wrap').classList.toggle('solo', !rest.length);
    const sig = JSON.stringify(three.map(t => [t.id, t.name, t.score]));
    if (sig !== st.podSig) {
      const first = !st.podSig;
      st.podSig = sig;
      const order = [1, 0, 2];
      st.pod.innerHTML = order.map(i => {
        const t = three[i];
        if (!t) return `<div class="pod p${i + 1} empty"></div>`;
        return `<div class="pod p${i + 1}" style="animation-delay:${first ? [0.9, 1.6, 0.3][i] : 0}s"><div class="pod-name">${esc(t.name)}</div><div class="pod-score">${t.score.toLocaleString()}</div><div class="pod-block"><span>${['🥇', '🥈', '🥉'][i]}</span><b>${i + 1}</b></div></div>`;
      }).join('');
    }
    boardList(st.rest, st, rest, { offset: 3, slots: 7, maxH: 60 });
  };

  R.lobby = function (viz, slide, data, st, opts) {
    const names = (data && data.names) || [];
    if (!st.lobby) {
      viz.insertAdjacentHTML('beforeend', `<div class="lobby">
        <div class="lobby-join">${opts.qrSrc ? `<img src="${opts.qrSrc}" alt="QR code">` : '<div class="qr-ph">QR</div>'}
          <div class="lj-url">Join at <b>${esc(opts.joinUrl || 'your-site/join')}</b></div>
          <div class="lj-code">${esc(opts.code || '123 456')}</div></div>
        <div class="lobby-side"><div class="lobby-count"><b class="lc">0</b> <span class="lcl">players joined</span></div><div class="chips"></div></div></div>`);
      st.lobby = viz.querySelector('.lobby'); st.chips = viz.querySelector('.chips'); st.chipEls = new Map();
    }
    tween(st.lobby.querySelector('.lc'), data ? data.total : 0);
    const ids = new Set(names.map(n => n.id));
    for (const [id, el] of st.chipEls) if (!ids.has(id)) { el.remove(); st.chipEls.delete(id); }
    for (let i = names.length - 1; i >= 0; i--) {
      const n = names[i];
      if (st.chipEls.has(n.id)) continue;
      const el = document.createElement('span');
      el.className = 'chip';
      el.style.setProperty('--c', PASTELS[hash(n.id) % PASTELS.length]);
      el.textContent = n.name;
      st.chips.prepend(el);
      st.chipEls.set(n.id, el);
    }
    emptyHint(st.lobby.querySelector('.lobby-side'), !names.length, '<div><span class="wiggle">👋</span><br>Waiting for players…</div>');
  };

  R.qa = function (viz, slide, data, st, opts) {
    const items = (data && data.items) || [];
    emptyHint(viz, !items.length, `<div><span class="wiggle">🙋</span><br>No questions yet${opts.joinUrl ? `<br><small>Ask at ${esc(opts.joinUrl)}</small>` : ''}</div>`);
    rlist(viz, st, items.map(q => ({ key: q.id, ...q })), {
      slots: 6, minH: 46,
      build: (el, it) => {
        el.innerHTML = `<div class="votes">▲ <span class="vc">0</span></div><div class="nm qa-text"></div>${opts.host ? '<button class="mark"></button>' : ''}`;
        if (opts.host) {
          el.querySelector('.mark').onclick = () => opts.onQaMark && opts.onQaMark(it.key, !el.classList.contains('answered'));
        }
      },
      update: (el, it) => {
        el.classList.toggle('answered', !!it.answered);
        el.querySelector('.qa-text').textContent = it.text + (it.name ? `  — ${it.name}` : '');
        tween(el.querySelector('.vc'), it.votes);
        const m = el.querySelector('.mark');
        if (m) m.textContent = it.answered ? '↺ Reopen' : '✓ Answered';
      },
    });
  };

  R.content = function () {};

  /* ---------------- demo data for the editor preview ---------------- */
  function demoData(slide) {
    const r = i => [42, 28, 61, 17, 35, 24, 50, 12, 30, 22][i % 10];
    switch (slide.type) {
      case 'mc': return { counts: slide.options.map((_, i) => r(i)), total: slide.options.reduce((a, _, i) => a + r(i), 0) };
      case 'quiz': return { counts: slide.options.map((_, i) => r(i)), total: 90, started: true, revealed: true, correct: slide.correct };
      case 'wordcloud': return { total: 40, words: ['ideas', 'energy', 'teamwork', 'fun', 'learning', 'growth', 'focus', 'creative', 'curious', 'bold', 'robots', 'coffee', 'future', 'code', 'friends'].map((w, i) => [w, Math.max(1, 14 - i), w]) };
      case 'open': return { total: 4, items: ['Love the live format!', 'Can we get the slides afterwards?', 'More hands-on demos please', 'Great session 🎉'].map((t, i) => ({ id: 'd' + i, text: t, t: i })) };
      case 'scale': return { total: 30, stats: slide.statements.map((_, i) => { const d = Array(slide.max).fill(0).map((_, k) => 2 + ((k * 7 + i * 3) % 9)); let s = 0, n = 0; d.forEach((c, k) => { s += c * (k + 1); n += c; }); return { avg: s / n, dist: d }; }) };
      case 'ranking': return { total: 20, order: slide.options.map((_, i) => ({ i, p: 100 - i * 13 })) };
      case 'leaderboard': return { total: 7, top: [['Asha', 4820, 1], ['Rohan', 4410, -1], ['Meera', 3970, 2], ['Karthik', 3550, 0], ['Divya', 2980, -2], ['Arjun', 2410, 1], ['Sneha', 1900, 0]].map(([n, s, m]) => ({ id: n, name: n, score: s, move: m })) };
      case 'lobby': return { total: 6, names: ['Asha', 'Rohan', 'Meera', 'Karthik', 'Divya', 'Arjun'].map((n, i) => ({ id: 'n' + i, name: n, t: i })) };
      case 'qa': return { total: 3, items: [{ id: 'q1', text: 'How will this scale to more users?', votes: 18 }, { id: 'q2', text: 'Is the recording available later?', votes: 11 }, { id: 'q3', text: 'What tools did you use?', votes: 6 }] };
      default: return null;
    }
  }

  window.TBViz = { render, demoData, COLORS, QUIZ_COLORS, SHAPES, TYPE_META, esc, tween };
})();
