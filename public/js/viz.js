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
  const P = {
    mc: '<path d="M6 20V11M12 20V5M18 20v-6"/>',
    wordcloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.3-8.8A6 6 0 0 0 4.6 12.6 3.4 3.4 0 0 0 6.5 19z"/>',
    open: '<path d="M21 14.5a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    scale: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    ranking: '<path d="M11 6h10M11 12h10M11 18h10M4 5l2-1v6M4 14.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3"/>',
    quiz: '<path d="M13 2 4 14h8l-1 8 9-12h-8z"/>',
    leaderboard: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v1.5A3.5 3.5 0 0 1 17 10M7 5H4v1.5A3.5 3.5 0 0 0 7 10"/>',
    lobby: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20"/>',
    qa: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4M12 17.5h.01"/>',
    content: '<path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    lock: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    unlock: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.7-1.5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M10 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-2.4 3.2M6.5 6.6A16 16 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 5.3-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18h2"/>',
    reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>',
    download: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M5 20.5h14"/>',
    expand: '<path d="M8 3.5H5A1.5 1.5 0 0 0 3.5 5v3M20.5 8V5A1.5 1.5 0 0 0 19 3.5h-3M3.5 16v3A1.5 1.5 0 0 0 5 20.5h3M16 20.5h3a1.5 1.5 0 0 0 1.5-1.5v-3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    trash: '<path d="M4 6.5h16M9 6.5V4h6v2.5M18 6.5l-.8 13a1.5 1.5 0 0 1-1.5 1.5H8.3a1.5 1.5 0 0 1-1.5-1.5L6 6.5"/>',
    paste: '<rect x="8.5" y="2.5" width="7" height="4" rx="1"/><path d="M15.5 4.5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    skip: '<path d="M5 5v14l10-7z"/><path d="M19 5v14"/>',
    qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3M20.5 14v.01M14 20.5h6.5v-3"/>',
    arrowup: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
    pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    palette: '<path d="M12 21a9 9 0 1 1 9-9c0 2.5-2 3.5-4 3.5h-1.5a1.5 1.5 0 0 0-1 2.6c.6.6.5 2.9-2.5 2.9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8.5" r="1"/>',
    sheet: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17"/>',
    party: '<path d="M4 20l4.5-12L16 15.5z"/><path d="M14 4.5c0 2-1 3-3 3M19.5 10c-2 0-3 1-3 3M15 2.5v.01M21.5 7v.01M20 15.5v.01"/>',
  };
  const icon = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  const TYPE_META = {
    mc: { name: 'Multiple choice', desc: 'Vote on options, live bar chart' },
    quiz: { name: 'Quiz', desc: 'Timed question, faster = more points' },
    lobby: { name: 'Lobby', desc: 'Waiting room, names pop up' },
    leaderboard: { name: 'Leaderboard', desc: 'Final podium + places 4–10' },
    wordcloud: { name: 'Word cloud', desc: 'Words grow as more people say them' },
    open: { name: 'Open ended', desc: 'Free-text answers on a live wall' },
    scale: { name: 'Scales', desc: 'Rate statements on a scale' },
    ranking: { name: 'Ranking', desc: 'Order items by preference' },
    qa: { name: 'Q&A', desc: 'Audience asks and upvotes' },
    content: { name: 'Heading', desc: 'Title or info slide' },
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // flag emojis -> real flag images (Windows has no flag emoji font)
  const FLAG_RE = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/g;
  const flagImg = (f, cls) => { const cc = [...f].map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 97)).join(''); return `<img class="${cls}" src="https://flagcdn.com/${cc}.svg" alt="${f}" data-e="${f}" draggable="false" onerror="this.replaceWith(this.dataset.e)">`; };
  const rich = s => esc(s).replace(FLAG_RE, f => flagImg(f, 'flag-emo'));
  // question text: flags at the end are shown big under the text
  const richQ = s => {
    s = String(s == null ? '' : s);
    const m = s.match(/(?:\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]\s*)+$/);
    if (!m) return rich(s);
    const text = s.slice(0, m.index).trim(), flags = m[0].match(FLAG_RE);
    return `${text ? rich(text) : ''}<span class="q-flags ${text ? '' : 'solo'}">${flags.map(f => flagImg(f, 'flag-big')).join('')}</span>`;
  };
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
      note = document.createElement('div'); note.className = 'viz-hidden-note'; note.innerHTML = icon('eyeoff') + ' Results hidden';
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
      ? `<div class="slide content-slide ${opts.noAnim ? '' : 'slide-enter'}"><h2 class="slide-q">${richQ(slide.question || 'Heading')}</h2>${slide.body ? `<div class="body">${rich(slide.body)}</div>` : ''}</div>`
      : `<div class="slide s-${slide.type} ${opts.noAnim ? '' : 'slide-enter'}"><h2 class="slide-q">${richQ(slide.question || 'Your question here')}</h2>${sub ? `<div class="slide-sub">${sub}</div>` : ''}<div class="viz"></div></div>`;
  }

  function subtitle(slide, opts) {
    if (slide.type === 'quiz') return `${icon('clock')} ${slide.time} seconds · faster correct answers score more`;
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
      wrap.innerHTML = labels.map((o, i) => `<div class="col" style="--c:${palette[i % palette.length]}"><div class="col-val"><span class="num">0</span><span class="pct">0%</span></div><div class="bar-track"><div class="bar"></div></div><div class="col-label">${rich(o)}</div></div>`).join('');
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
    const readMs = data.readMs || 3000;
    const phase = data.board ? 'board' : data.revealed ? 'reveal' : !data.started ? 'wait'
      : data.readyIn > readMs + 150 ? 'banner' : data.readyIn > 0 ? 'ready' : 'run';
    if (st.phase !== phase) {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.phase = phase; st.cols = null; st.list = null; st.rows = null; st.boardSig = null;
      (st.timers || []).forEach(clearTimeout); st.timers = [];
      viz.querySelectorAll(':scope > :not(.viz-hidden-note)').forEach(n => n.remove());
      const slideEl = viz.closest('.slide');
      if (slideEl) {
        slideEl.classList.toggle('mode-board', phase === 'board');
        slideEl.classList.toggle('mode-intro', (phase === 'wait' && !!opts.host) || phase === 'banner');
      }
      if (phase === 'reveal' || phase === 'board') {
        // filled below
      } else if (phase === 'wait' && opts.host) {
        viz.insertAdjacentHTML('beforeend', `<div class="q-intro">
          <div class="qi-num">Question <b>${opts.quizNo || 1}</b> of ${opts.quizTotal || 1}</div>
          <div class="qi-players"><b class="qi-count">0</b> <span class="qi-lbl">players ready</span></div>
          <div class="qi-hint">${icon('clock')} Answer quickly to get more points</div></div>`);
      } else if (phase === 'banner') {
        viz.insertAdjacentHTML('beforeend', `<div class="q-banner"><div class="qb-ic">${icon('clock')}</div><div class="qb-txt">Answer quickly to get more points!</div></div>`);
      } else if (phase === 'ready') {
        const r = document.createElement('div');
        r.className = 'quiz-ready';
        r.innerHTML = `<div class="ready-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" style="stroke:var(--line)" stroke-width="7"/><circle class="ring" cx="50" cy="50" r="44" fill="none" stroke="#5B3DF5" stroke-width="7" stroke-linecap="round" stroke-dasharray="276.5"/></svg><div class="num"></div></div><div class="ready-txt">Look at your phone — answers coming up</div>`;
        viz.appendChild(r);
        st.goAt = Date.now() + (data.readyIn || 0);
        const total = readMs;
        const ring = r.querySelector('.ring'), num = r.querySelector('.num');
        const loop = () => {
          const left = Math.max(0, st.goAt - Date.now());
          num.textContent = left > 0 ? Math.ceil(left / 1000) : 'Go!';
          ring.style.strokeDashoffset = String(276.5 * (left / total));
          if (left > 0) st.raf = requestAnimationFrame(loop);
        };
        loop();
      } else if (phase === 'run') {
        const n = slide.options.length;
        viz.insertAdjacentHTML('beforeend', `<div class="qrun">
          <div class="qr-center"><div class="qr-time">0:00</div><div class="qr-count"><b>0</b></div><div class="qr-lbl">answers</div></div>
          <div class="qr-opts" style="grid-template-columns:repeat(${n},1fr)">${slide.options.map((o, i) => `<div class="qr-opt" style="--c:${QUIZ_COLORS[i]};animation-delay:${i * 80}ms"><svg class="shape" viewBox="0 0 24 24">${SHAPES[i]}</svg><span>${rich(o)}</span></div>`).join('')}</div></div>`);
        st.endsAt = Date.now() + (data.remaining != null ? data.remaining : slide.time * 1000);
        const tEl = viz.querySelector('.qr-time');
        const fmt = ms => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
        const loop = () => {
          const left = Math.max(0, st.endsAt - Date.now());
          tEl.textContent = fmt(left);
          tEl.classList.toggle('low', left <= 5000);
          if (left > 0) st.raf = requestAnimationFrame(loop);
        };
        loop();
      } else {
        const grid = document.createElement('div');
        grid.className = 'quiz-grid' + (phase === 'run' ? ' running' : opts.host ? ' qwait' : '');
        grid.style.gridTemplateRows = `repeat(${Math.ceil(slide.options.length / 2)}, 1fr)`;
        grid.innerHTML = slide.options.map((o, i) => `<div class="quiz-opt" style="--c:${QUIZ_COLORS[i]};animation-delay:${i * 70}ms"><svg class="shape" viewBox="0 0 24 24">${SHAPES[i]}</svg><span>${rich(o)}</span></div>`).join('');
        viz.appendChild(grid);
        if (phase === 'run') {
          const t = document.createElement('div');
          t.className = 'quiz-timer';
          t.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" style="stroke:var(--line)" stroke-width="8"/><circle class="ring" cx="50" cy="50" r="44" fill="none" stroke="#5B3DF5" stroke-width="8" stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><div class="num">0</div>`;
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
        }
      }
    }
    if (phase === 'wait' && opts.host) {
      const c = viz.querySelector('.qi-count');
      if (c) { tween(c, data.players || 0); viz.querySelector('.qi-lbl').textContent = (data.players === 1 ? 'player' : 'players') + ' ready'; }
    }
    if (phase === 'run') {
      const cb = viz.querySelector('.qr-count b');
      if (cb && +cb.textContent !== data.total) {
        cb.textContent = data.total;
        const c = cb.parentElement; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
        viz.querySelector('.qr-lbl').textContent = data.total === 1 ? 'answer' : 'answers';
      }
      if (data.remaining != null && Math.abs((Date.now() + data.remaining) - st.endsAt) > 1200) st.endsAt = Date.now() + data.remaining;
    }
    if (phase === 'board') {
      if (!viz.querySelector('.board-title')) {
        const t = document.createElement('h2'); t.className = 'board-title'; t.textContent = 'Quiz leaderboard';
        viz.appendChild(t);
        st.boardBox = document.createElement('div'); st.boardBox.className = 'board-box';
        viz.appendChild(st.boardBox);
      }
      animatedBoard(st.boardBox, st, (data.board || []).slice(0, 8), { slots: 8, maxH: 92, animate: !opts.noAnim });
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
    emptyHint(viz, !words.length, `<div>${icon('wordcloud', 'big')}<br>Waiting for words…</div>`);
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
    emptyHint(viz, !items.length, `<div>${icon('open', 'big')}<br>Responses will appear here</div>`);
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
    const H = viz.clientHeight - 6, gap = Math.max(6, H * 0.02);
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

  /* ---- animated leaderboard (old order -> points grow -> overtakes) ---- */
  const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐧', '🐨', '🐙', '🦄', '🐝', '🐢', '🐳', '🦉', '🐰', '🐻', '🐶', '🐱', '🦖', '🐞', '🦋', '🐬', '🦜', '🐹'];
  const PCOL = ['#3D7A55', '#78C08A', '#C44D55', '#3F3D4A', '#E2875F', '#5B3DF5', '#2E86D6', '#E3A033', '#8C52FF', '#179C92', '#D3568B', '#6E8B2F'];

  function animatedBoard(box, st, rows, o) {
    o = o || {};
    const sig = JSON.stringify(rows.map(r => [r.id, r.score, r.gain, r.name]));
    if (st.boardSig === sig && box.childElementCount) return;
    st.boardSig = sig;
    (st.timers || []).forEach(clearTimeout); st.timers = [];
    box.innerHTML = '';
    if (!rows.length) return;
    const slots = Math.max(rows.length, o.slots || rows.length);
    const H = box.clientHeight - 4;
    const gap = Math.max(4, H * 0.014);
    const rowH = Math.max(26, Math.min(o.maxH || 66, (H - gap * (slots - 1)) / slots));
    const maxScore = Math.max(1, ...rows.map(r => r.score));
    const MAXW = 56;                                    // % of the track the leader's bar fills
    const pct = v => Math.max(2.5, v / maxScore * MAXW);
    const anim = o.animate !== false && rows.some(r => r.gain > 0);
    const prevOrder = rows.map((r, i) => ({ r, i, prev: r.score - (r.gain || 0) })).sort((a, b) => b.prev - a.prev || a.i - b.i);
    const prevPos = new Map(prevOrder.map((x, k) => [x.r.id, k]));
    const T = (ms, fn) => st.timers.push(setTimeout(fn, ms));
    const els = rows.map((r, i) => {
      const prev = Math.max(0, r.score - (r.gain || 0));
      const el = document.createElement('div');
      el.className = 'lbrow';
      el.style.height = rowH + 'px';
      el.style.fontSize = Math.max(11, Math.min(36, rowH * 0.46)) + 'px';
      el.style.setProperty('--pc', PCOL[hash(r.id) % PCOL.length]);
      el.innerHTML = `<div class="lb-score"><span class="num"></span> p</div>
        <div class="lb-track"><div class="lb-fill"><div class="lb-solid"></div>${r.gain ? `<span class="lb-gain">+${r.gain.toLocaleString()}</span>` : ''}</div>
        <span class="lb-av"><span>${AVATARS[(r.av || 0) % AVATARS.length]}</span></span><span class="lb-name"></span><span class="lb-mv"></span></div>`;
      el.querySelector('.lb-name').textContent = r.name;
      const start = anim ? prev : r.score;
      const num = el.querySelector('.num');
      num._v = start; num.textContent = Math.round(start).toLocaleString();
      const fill = el.querySelector('.lb-fill');
      fill.style.width = pct(start) + '%';
      el.style.top = ((anim ? prevPos.get(r.id) : i) * (rowH + gap)) + 'px';
      if (o.animate !== false) el.classList.add('enter');
      box.appendChild(el);
      return { el, r, i, prev, fill, num };
    });
    const finalize = () => {
      els.forEach(x => {
        x.el.style.top = (x.i * (rowH + gap)) + 'px';
        x.el.classList.remove('enter');
        x.el.classList.toggle('first', x.i === 0);
        x.el.querySelector('.lb-mv').innerHTML = moveBadge(x.r.move);
      });
      if (o.onDone) T(1000, o.onDone);
    };
    if (o.animate === false) { finalize(); return; }
    els.forEach(x => T(80 + (anim ? prevPos.get(x.r.id) : x.i) * 90, () => x.el.classList.remove('enter')));
    if (!anim) { T(200 + rows.length * 90, finalize); return; }
    const base = 300 + rows.length * 90;
    // 1) the points won this round grow out of the tip of each bar
    T(base + 300, () => els.forEach(x => {
      if (!x.r.gain) return;
      x.el.classList.add('growing');
      x.el.querySelector('.lb-solid').style.width = (x.prev / x.r.score * 100) + '%';
      x.fill.style.width = pct(x.r.score) + '%';
    }));
    // 2) the gain is banked: score counts up, bar turns solid
    T(base + 1500, () => els.forEach(x => {
      if (!x.r.gain) return;
      x.el.classList.add('banked');
      tween(x.num, x.r.score);
      x.el.querySelector('.lb-solid').style.width = '100%';
    }));
    // 3) overtakes: rows slide to their new places
    T(base + 2500, finalize);
  }

  function confetti(container) {
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    for (let i = 0; i < 110; i++) {
      const p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = COLORS[i % COLORS.length];
      p.style.animationDelay = (Math.random() * 0.9) + 's';
      p.style.animationDuration = (2.4 + Math.random() * 1.8) + 's';
      p.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      if (i % 3 === 0) p.style.borderRadius = '50%';
      wrap.appendChild(p);
    }
    container.appendChild(wrap);
    setTimeout(() => wrap.remove(), 6000);
  }

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
        el.querySelector('.rk').innerHTML = `<span class="rk-badge">${r + 1}</span>`;
        el.querySelector('.nm').innerHTML = (o.avatars ? `<span class="row-av">${AVATARS[(it.av || 0) % AVATARS.length]}</span>` : '') + esc(it.name);
        el.querySelector('.mvbox').innerHTML = moveBadge(it.move);
        const g = el.querySelector('.gain'); if (g) g.textContent = it.gain ? '+' + it.gain : '';
        el.querySelector('.fill').style.width = (it.score / best * 100) + '%';
        tween(el.querySelector('.sc'), it.score);
      },
    });
  }

  /* final leaderboard: podium for the top 3, places 4-10 beside it */
  R.leaderboard = function (viz, slide, data, st, opts) {
    opts = opts || {};
    const top = ((data && data.top) || []).slice(0, 10);
    emptyHint(viz, !top.length, `<div>${icon('leaderboard', 'big')}<br>No quiz scores yet — add Quiz slides before this one</div>`);
    if (!st.pod) {
      viz.insertAdjacentHTML('beforeend', `<div class="lb-wrap"><div class="podium"></div><div class="lb-rest"></div></div>`);
      st.pod = viz.querySelector('.podium'); st.rest = viz.querySelector('.lb-rest');
      if (opts.noAnim) viz.querySelector('.lb-wrap').classList.add('still');
    }
    const three = top.slice(0, 3), rest = top.slice(3);
    viz.querySelector('.lb-wrap').classList.toggle('solo', !rest.length);
    const sig = JSON.stringify(three.map(t => [t.id, t.name, t.score]));
    if (sig !== st.podSig) {
      const first = !st.podSig;
      st.podSig = sig;
      const live = first && !opts.noAnim;
      const delay = [1.5, 0.8, 0.2];            // 3rd rises first, the winner last
      st.pod.innerHTML = [1, 0, 2].map(i => {
        const t = three[i];
        if (!t) return `<div class="pod p${i + 1} empty"></div>`;
        return `<div class="pod p${i + 1}" style="animation-delay:${live ? delay[i] : 0}s">
          <div class="pod-av">${AVATARS[(t.av || 0) % AVATARS.length]}</div>
          <div class="pod-name">${esc(t.name)}</div>
          <div class="pod-score"><span class="ps">${live ? 0 : t.score.toLocaleString()}</span> pts</div>
          <div class="pod-block"><b>${i + 1}</b></div></div>`;
      }).join('');
      // shrink long names until every word fits (max 2 lines)
      st.pod.querySelectorAll('.pod-name').forEach(el => {
        let f = parseFloat(getComputedStyle(el).fontSize), n = 0;
        while (n++ < 14 && f > 12 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) { f *= 0.92; el.style.fontSize = f + 'px'; }
      });
      if (live) {
        st.timers = st.timers || [];
        [1, 0, 2].forEach(i => {
          const t = three[i]; if (!t) return;
          const el = st.pod.querySelector(`.p${i + 1} .ps`);
          st.timers.push(setTimeout(() => tween(el, t.score), (delay[i] + 0.4) * 1000));
        });
        st.timers.push(setTimeout(() => {
          const w = st.pod.querySelector('.p1'); if (w) w.classList.add('winner');
          confetti(viz);
        }, 2600));
      } else if (three[0]) {
        const w = st.pod.querySelector('.p1'); if (w && !opts.noAnim) w.classList.add('winner');
      }
    }
    boardList(st.rest, st, rest, { offset: 3, slots: 7, maxH: 76, avatars: true });
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
      el.innerHTML = `<span class="chip-av">${AVATARS[(n.av || 0) % AVATARS.length]}</span>${esc(n.name)}`;
      st.chips.prepend(el);
      st.chipEls.set(n.id, el);
    }
    emptyHint(st.lobby.querySelector('.lobby-side'), !names.length, `<div>${icon('lobby', 'big')}<br>Waiting for players…</div>`);
  };

  R.qa = function (viz, slide, data, st, opts) {
    const items = (data && data.items) || [];
    emptyHint(viz, !items.length, `<div>${icon('qa', 'big')}<br>No questions yet${opts.joinUrl ? `<br><small>Ask at ${esc(opts.joinUrl)}</small>` : ''}</div>`);
    rlist(viz, st, items.map(q => ({ key: q.id, ...q })), {
      slots: 6, minH: 46,
      build: (el, it) => {
        el.innerHTML = `<div class="votes">${icon('arrowup')} <span class="vc">0</span></div><div class="nm qa-text"></div>${opts.host ? '<button class="mark"></button>' : ''}`;
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
      case 'quiz': return { counts: slide.options.map(() => 0), total: 0, started: false, revealed: false };
      case 'wordcloud': return { total: 40, words: ['ideas', 'energy', 'teamwork', 'fun', 'learning', 'growth', 'focus', 'creative', 'curious', 'bold', 'robots', 'coffee', 'future', 'code', 'friends'].map((w, i) => [w, Math.max(1, 14 - i), w]) };
      case 'open': return { total: 4, items: ['Love the live format!', 'Can we get the slides afterwards?', 'More hands-on demos please', 'Great session 🎉'].map((t, i) => ({ id: 'd' + i, text: t, t: i })) };
      case 'scale': return { total: 30, stats: slide.statements.map((_, i) => { const d = Array(slide.max).fill(0).map((_, k) => 2 + ((k * 7 + i * 3) % 9)); let s = 0, n = 0; d.forEach((c, k) => { s += c * (k + 1); n += c; }); return { avg: s / n, dist: d }; }) };
      case 'ranking': return { total: 20, order: slide.options.map((_, i) => ({ i, p: 100 - i * 13 })) };
      case 'leaderboard': return { total: 7, top: [['Asha', 4820, 1], ['Rohan', 4410, -1], ['Meera', 3970, 2], ['Karthik', 3550, 0], ['Divya', 2980, -2], ['Arjun', 2410, 1], ['Sneha', 1900, 0]].map(([n, s, m], i) => ({ id: n, name: n, score: s, move: m, av: i * 5 })) };
      case 'lobby': return { total: 6, names: ['Asha', 'Rohan', 'Meera', 'Karthik', 'Divya', 'Arjun'].map((n, i) => ({ id: 'n' + i, name: n, t: i, av: i * 3 })) };
      case 'qa': return { total: 3, items: [{ id: 'q1', text: 'How will this scale to more users?', votes: 18 }, { id: 'q2', text: 'Is the recording available later?', votes: 11 }, { id: 'q3', text: 'What tools did you use?', votes: 6 }] };
      default: return null;
    }
  }

  const hydrateIcons = root => (root || document).querySelectorAll('[data-ic]').forEach(el => {
    if (!el.querySelector(':scope > svg.ic')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.ic));
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrateIcons()); else hydrateIcons();

  window.TBViz = { AVATARS, hydrateIcons, render, demoData, COLORS, QUIZ_COLORS, SHAPES, TYPE_META, esc, rich, richQ, tween, icon };
})();
