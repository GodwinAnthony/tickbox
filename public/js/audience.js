/* ============================================================
   TickBox audience (phone) app
   ============================================================ */
(function () {
  const { render, esc, QUIZ_COLORS, SHAPES, icon } = window.TBViz;
  const badge = (name, cls) => `<div class="badge-ic ${cls || ''}">${icon(name)}</div>`;
  const $ = s => document.querySelector(s);
  const main = $('#main');
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400); };
  const TICK = `<div class="tick"><svg width="46" height="46" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

  let code = (new URLSearchParams(location.search).get('code') || '').replace(/\D/g, '');
  let pid = LS.get('tickbox.pid', null);
  let name = LS.get('tickbox.name', '');
  let socket = null;
  let state = null;
  let answers = {};      // slideId -> my answer (server-confirmed)
  let qaVotes = {};      // slideId -> [question ids]
  let quizRes = {};      // slideId -> result payload
  let results = null;    // { slideId, data }
  let screenKey = '';
  let draft = {};        // in-progress choices for current slide
  let quizRaf;
  let myAv = 0;
  const AVS = window.TBViz.AVATARS;

  /* ---------------- entry screens ---------------- */
  function codeScreen(err) {
    $('#reactBar').classList.add('hidden');
    main.innerHTML = `
      <div style="margin-top:8vh">
        <h1 class="aud-q" style="font-size:32px">Join a presentation</h1>
        <p class="aud-hint">Enter the code shown on the screen</p>
        <form id="f" autocomplete="off">
          <input class="input code-input" id="c" inputmode="numeric" placeholder="123 456" maxlength="7" value="${code ? code.slice(0, 3) + (code.length > 3 ? ' ' + code.slice(3) : '') : ''}">
          <div class="err">${esc(err || '')}</div>
          <button class="btn primary block" style="margin-top:8px;padding:16px">Join →</button>
        </form>
      </div>`;
    const c = $('#c');
    c.oninput = () => { const d = c.value.replace(/\D/g, '').slice(0, 6); c.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d; };
    $('#f').onsubmit = e => {
      e.preventDefault();
      code = c.value.replace(/\D/g, '');
      if (code.length !== 6) { codeScreen('Codes have 6 digits'); return; }
      history.replaceState(null, '', '/join?code=' + code);
      start();
    };
    if (!code) c.focus();
  }

  async function start() {
    main.innerHTML = `<div class="waiting"><div><div class="dots"><span></span><span></span><span></span></div><h2>Connecting…</h2></div></div>`;
    let info;
    try {
      const r = await fetch('/api/room/' + code);
      if (!r.ok) return codeScreen('No live presentation with that code');
      info = await r.json();
    } catch (_) { return codeScreen('Could not reach the server'); }
    const askedKey = 'tickbox.asked.' + code;
    if (info.askNames && !LS.get(askedKey, false)) return nameScreen(info, askedKey);
    connect();
  }

  function nameScreen(info, askedKey) {
    main.innerHTML = `
      <div style="margin-top:6vh">
        <p class="aud-hint" style="margin:0">Joining</p>
        <h1 class="aud-q">${esc(info.title)}</h1>
        <form id="f" autocomplete="off" style="margin-top:20px">
          <div class="field"><label>Your name or nickname</label>
          <input class="input" id="n" maxlength="30" placeholder="e.g. Asha" value="${esc(name)}" style="font-size:18px;padding:16px"></div>
          <button class="btn primary block" style="padding:16px">Let's go →</button>
        </form>
      </div>`;
    $('#n').focus();
    $('#f').onsubmit = e => {
      e.preventDefault();
      name = $('#n').value.trim().slice(0, 30);
      LS.set('tickbox.name', name);
      LS.set(askedKey, true);
      connect();
    };
  }

  /* ---------------- socket ---------------- */
  function connect() {
    if (socket) return;
    socket = io({ transports: ['websocket', 'polling'] });
    socket.on('connect', join);
    socket.on('disconnect', () => toast('Reconnecting…'));
    socket.on('aud:state', s => { state = s; if (results && results.slideId !== s.slide.id) results = null; draw(); });
    socket.on('aud:results', r => { results = r; updateResults(); });
    socket.on('aud:quizResult', r => { quizRes[r.slideId] = r; draw(true); });
    socket.on('aud:reset', r => { delete answers[r.slideId]; delete quizRes[r.slideId]; qaVotes[r.slideId] = []; draft = {}; draw(true); });
  }

  function join() {
    socket.emit('aud:join', { code, pid, name }, r => {
      if (!r || !r.ok) { socket.disconnect(); socket = null; return codeScreen((r && r.error) || 'Could not join'); }
      pid = r.pid; LS.set('tickbox.pid', pid);
      answers = r.answers || {}; qaVotes = r.qaVotes || {};
      state = r.state; results = r.results;
      const who = $('#who');
      myAv = r.av || 0;
      who.innerHTML = `<span class="who-av">${AVS[myAv % AVS.length]}</span><span class="who-name">${esc(r.name)}</span>`; who.classList.remove('hidden');
      $('#reactBar').classList.remove('hidden');
      draw(true);
    });
  }

  function send(answer) {
    const slide = state.slide;
    const btn = document.querySelector('.submit-bar .btn, #sendBtn');
    if (btn) btn.disabled = true;
    socket.emit('aud:respond', { slideId: slide.id, answer }, r => {
      if (btn) btn.disabled = false;
      if (!r || !r.ok) { toast((r && r.error) || 'Something went wrong'); return; }
      answers[slide.id] = r.value;
      if (navigator.vibrate) navigator.vibrate(25);
      draft = {};
      draw(true);
    });
  }

  /* ---------------- drawing ---------------- */
  function keyFor() {
    if (!state) return '';
    const s = state.slide, q = state.quiz || {};
    return [s.id, state.open, JSON.stringify(answers[s.id] || null), q.started, q.readyIn > 0, q.revealed, !!quizRes[s.id], state.showOnPhones, state.ended].join('|');
  }

  function draw(force) {
    if (!state) return;
    const k = keyFor();
    if (!force && k === screenKey) { updateResults(); return; }
    if (k.split('|')[0] !== screenKey.split('|')[0]) draft = {};
    screenKey = k;
    cancelAnimationFrame(quizRaf);
    document.querySelectorAll('.submit-bar').forEach(n => n.remove());
    if (state.ended) {
      $('#reactBar').classList.add('hidden');
      main.innerHTML = `<div class="thanks" style="margin-top:8vh">${TICK}<h2>Thanks for taking part</h2><p>The presentation has ended.</p><a class="btn" href="/" style="margin-top:22px">Back to TickBox</a></div>`;
      return;
    }
    const s = state.slide;
    const fn = V[s.type] || V.content;
    fn(s);
    updateResults();
  }

  const header = (s, hint) => `<h1 class="aud-q">${esc(s.question)}</h1>${hint ? `<p class="aud-hint">${hint}</p>` : ''}`;
  const resultsBox = () => state.showOnPhones ? `<div class="phone-results"><div class="stage" id="phoneStage" style="position:absolute;inset:0"></div></div>` : '';
  const thanks = (title, sub) => `<div class="thanks">${TICK}<h2>${title}</h2><p>${sub || 'Look at the screen to see the results'}</p></div>`;
  const closed = s => header(s) + `<div class="thanks">${badge('lock')}<h2>Voting is closed</h2><p>Wait for the presenter to continue</p></div>` + resultsBox();

  function submitBar(label, enabled, onClick) {
    const bar = document.createElement('div');
    bar.className = 'submit-bar';
    bar.innerHTML = `<button class="btn primary" ${enabled ? '' : 'disabled'}>${label}</button>`;
    bar.firstChild.onclick = onClick;
    document.body.appendChild(bar);
    return bar.firstChild;
  }

  function updateResults() {
    if (!state || !results || results.slideId !== state.slide.id) return;
    const s = state.slide;
    if (s.type === 'qa') return drawQaList();
    const stg = $('#phoneStage');
    if (stg && state.showOnPhones) render(stg, s, results.data, { noAnim: true });
  }

  const V = {};

  V.content = s => {
    main.innerHTML = `<div class="waiting"><div>${badge('eye')}<h2>${esc(s.question || 'Look at the screen')}</h2><p>${s.body ? esc(s.body) : 'Get ready — the next question is coming up'}</p></div></div>`;
  };

  V.lobby = () => {
    main.innerHTML = `<div class="waiting"><div><div class="me-av">${AVS[myAv % AVS.length]}</div><h2>You're in!</h2>
      <div class="lobby-me">${esc(($('#who .who-name') || {}).textContent || '')}</div>
      <p>Look for your name on the big screen.<br>The quiz starts soon — answer fast to score more!</p></div></div>`;
  };

  V.leaderboard = s => {
    const mine = Object.values(quizRes).sort((a, b) => b.total - a.total)[0];
    const last = Object.values(quizRes).pop();
    main.innerHTML = `<div class="waiting"><div>${badge('leaderboard', 'amber')}<h2>${esc(s.question || 'Leaderboard')}</h2>
      ${last ? `<p style="font-size:18px;color:var(--ink)">You have <b>${last.total.toLocaleString()}</b> points${last.rank ? ` and you're <b>#${last.rank}</b> of ${last.of}` : ''}</p>` : '<p>Check the big screen!</p>'}</div></div>`;
    void mine;
  };

  V.mc = s => {
    const mine = answers[s.id];
    if (mine) { main.innerHTML = header(s) + thanks('Vote received!', 'You chose: <b>' + mine.map(i => esc(s.options[i])).join(', ') + '</b>') + resultsBox(); return; }
    if (!state.open) { main.innerHTML = closed(s); return; }
    draft.sel = draft.sel || [];
    main.innerHTML = header(s, s.multiple ? 'Choose one or more' : 'Choose one') +
      s.options.map((o, i) => `<button class="choice ${s.multiple ? '' : 'radio'} ${draft.sel.includes(i) ? 'sel' : ''}" data-i="${i}"><span class="box"></span>${esc(o)}</button>`).join('');
    const btn = submitBar('Submit', draft.sel.length > 0, () => send(draft.sel));
    main.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (s.multiple) draft.sel = draft.sel.includes(i) ? draft.sel.filter(x => x !== i) : draft.sel.concat(i);
      else draft.sel = [i];
      main.querySelectorAll('.choice').forEach(c => c.classList.toggle('sel', draft.sel.includes(+c.dataset.i)));
      btn.disabled = !draft.sel.length;
    });
  };

  V.wordcloud = s => {
    const mine = answers[s.id] || [];
    const chips = mine.length ? `<div class="word-chips">${mine.map(w => `<span>${esc(w)}</span>`).join('')}</div>` : '';
    if (mine.length >= s.maxWords) { main.innerHTML = header(s) + thanks('Words sent!', '') + chips + resultsBox(); return; }
    if (!state.open) { main.innerHTML = closed(s); return; }
    const left = s.maxWords - mine.length;
    main.innerHTML = header(s, `You can send ${left} more word${left === 1 ? '' : 's'}`) + chips +
      `<form id="wf" autocomplete="off"><input class="input" id="w" maxlength="25" placeholder="Type a word…" style="font-size:18px;padding:16px" enterkeyhint="send"></form>` + resultsBox();
    const w = $('#w');
    const btn = submitBar('Submit', false, () => { if (w.value.trim()) send(w.value.trim()); });
    w.oninput = () => { btn.disabled = !w.value.trim(); };
    $('#wf').onsubmit = e => { e.preventDefault(); if (w.value.trim()) send(w.value.trim()); };
  };

  V.open = s => {
    const mine = answers[s.id] || [];
    const list = mine.map(x => `<div class="qa-item"><div class="tx">${esc(x.text)}</div></div>`).join('');
    if (mine.length >= s.maxPerPerson) { main.innerHTML = header(s) + thanks('Answer sent!', '') + list + resultsBox(); return; }
    if (!state.open) { main.innerHTML = closed(s); return; }
    main.innerHTML = header(s, s.maxPerPerson > 1 ? `You can send ${s.maxPerPerson - mine.length} more` : 'Share your thoughts') + list +
      `<textarea class="input" id="t" maxlength="280" placeholder="Type your answer…" style="font-size:17px;min-height:130px"></textarea>
       <div class="aud-hint" style="text-align:right;margin-top:6px" id="cnt">0 / 280</div>` + resultsBox();
    const t = $('#t');
    const btn = submitBar('Submit', false, () => { if (t.value.trim()) send(t.value.trim()); });
    t.oninput = () => { btn.disabled = !t.value.trim(); $('#cnt').textContent = t.value.length + ' / 280'; };
  };

  V.scale = s => {
    const mine = answers[s.id];
    if (mine) { main.innerHTML = header(s) + thanks('Thanks for rating!') + resultsBox(); return; }
    if (!state.open) { main.innerHTML = closed(s); return; }
    const mid = Math.ceil(s.max / 2);
    draft.v = draft.v || s.statements.map(() => mid);
    main.innerHTML = header(s, 'Drag each slider') + s.statements.map((st, i) => `
      <div class="aud-scale"><div class="st"><span class="val" id="v${i}">${draft.v[i]}</span>${esc(st)}</div>
        <input type="range" min="1" max="${s.max}" step="1" value="${draft.v[i]}" data-i="${i}">
        <div class="ends"><span>${esc(s.minLabel)}</span><span>${esc(s.maxLabel)}</span></div></div>`).join('');
    main.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { const i = +r.dataset.i; draft.v[i] = +r.value; $('#v' + i).textContent = r.value; });
    submitBar('Submit', true, () => send(draft.v));
  };

  V.ranking = s => {
    const mine = answers[s.id];
    if (mine) { main.innerHTML = header(s) + thanks('Ranking sent!', mine.map((i, r) => `${r + 1}. ${esc(s.options[i])}`).join('<br>')) + resultsBox(); return; }
    if (!state.open) { main.innerHTML = closed(s); return; }
    draft.order = draft.order || [];
    const paint = () => {
      main.innerHTML = header(s, 'Tap items in order — first tap is your #1') +
        s.options.map((o, i) => { const r = draft.order.indexOf(i); return `<button class="choice ${r >= 0 ? 'sel' : ''}" data-i="${i}"><span class="rank-badge">${r >= 0 ? r + 1 : ''}</span>${esc(o)}</button>`; }).join('') +
        (draft.order.length ? `<button class="btn ghost sm" id="clr">↺ Start over</button>` : '');
      main.querySelectorAll('.choice').forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        draft.order = draft.order.includes(i) ? draft.order.filter(x => x !== i) : draft.order.concat(i);
        if (draft.order.length === s.options.length - 1) draft.order.push(s.options.findIndex((_, k) => !draft.order.includes(k)));
        paint(); btn.disabled = draft.order.length !== s.options.length;
      });
      const c = $('#clr'); if (c) c.onclick = () => { draft.order = []; paint(); btn.disabled = true; };
    };
    const btn = submitBar('Submit', draft.order.length === s.options.length, () => send(draft.order));
    paint();
  };

  V.quiz = s => {
    const q = state.quiz || {};
    const mine = answers[s.id];
    const res = quizRes[s.id];
    if (q.revealed) {
      if (res) {
        const cls = !res.answered ? 'none' : res.correct ? 'ok' : 'no';
        main.innerHTML = `<div class="result-card ${cls}">
          <div class="rc-ic">${icon(!res.answered ? 'clock' : res.correct ? 'check' : 'x')}</div>
          <h2>${!res.answered ? 'Too slow!' : res.correct ? 'Correct!' : 'Not quite'}</h2>
          <div class="pts">+${res.points}</div>
          <p>Total: ${res.total.toLocaleString()} points</p>
          ${res.rank ? `<p>You're #${res.rank} of ${res.of}</p>` : ''}
          ${res.move > 0 ? `<span class="move-pill">Up ${res.move} place${res.move > 1 ? 's' : ''}</span>` : res.move < 0 ? `<span class="move-pill">Down ${-res.move} place${res.move < -1 ? 's' : ''}</span>` : ''}</div>
          ${!res.correct ? `<p class="aud-hint" style="text-align:center;margin-top:16px">Correct answer: <b>${esc(s.options[s.correct])}</b></p>` : ''}`;
      } else {
        main.innerHTML = header(s) + `<p class="aud-hint">Correct answer: <b>${esc(s.options[s.correct])}</b></p>`;
      }
      return;
    }
    if (!q.started) {
      main.innerHTML = `<div class="waiting"><div>${badge('quiz', 'amber')}<h2>${esc(s.question)}</h2><p>${s.time} seconds · the faster you answer, the more points</p></div></div>`;
      return;
    }
    if (q.readyIn > 0) {
      const goAt = Date.now() + q.readyIn;
      main.innerHTML = `<div class="waiting"><div><div class="count-big" id="cd">${Math.ceil(q.readyIn / 1000)}</div><h2>${esc(s.question)}</h2><p>Answers appear in a moment — be quick!</p></div></div>`;
      const tick = () => {
        const left = goAt - Date.now();
        const el = $('#cd'); if (!el) return;
        if (left <= 0) {
          // show answers right away even if the server's "go" message is a little late
          state.quiz = { ...q, readyIn: 0, remaining: Math.max(0, (q.remaining || s.time * 1000) - q.readyIn) };
          draw(true); return;
        }
        el.textContent = Math.ceil(left / 1000);
        quizRaf = requestAnimationFrame(tick);
      };
      quizRaf = requestAnimationFrame(tick);
      return;
    }
    if (mine !== undefined) {
      main.innerHTML = `<div class="waiting"><div>${badge('lock')}<h2>Answer locked in</h2><p>You picked <b>${esc(s.options[mine])}</b>.<br>Waiting for the timer…</p></div></div>`;
      return;
    }
    const endsAt = Date.now() + (q.remaining || 0);
    main.innerHTML = `<div class="quiz-bar"><i id="qb"></i></div>` + header(s) +
      `<div class="quiz-tiles">${s.options.map((o, i) => `<button class="quiz-tile" style="--c:${QUIZ_COLORS[i]}" data-i="${i}"><svg viewBox="0 0 24 24">${SHAPES[i]}</svg>${esc(o)}</button>`).join('')}</div>`;
    main.querySelectorAll('.quiz-tile').forEach(b => b.onclick = () => {
      main.querySelectorAll('.quiz-tile').forEach(x => { x.disabled = true; x.classList.toggle('faded', x !== b); });
      send(+b.dataset.i);
    });
    const bar = $('#qb');
    const loop = () => {
      const left = Math.max(0, endsAt - Date.now());
      if (bar) { bar.style.width = (left / (s.time * 1000) * 100) + '%'; bar.style.background = left < 5000 ? 'var(--danger)' : 'var(--violet)'; }
      if (left > 0) quizRaf = requestAnimationFrame(loop);
    };
    loop();
  };

  V.qa = s => {
    main.innerHTML = header(s, 'Ask a question or upvote others') +
      (state.open ? `<form id="qf" autocomplete="off"><textarea class="input" id="qt" maxlength="240" placeholder="Type your question…" style="min-height:90px"></textarea>
        <button class="btn primary block" id="sendBtn" style="margin-top:10px">Send question</button></form>` : `<p class="aud-hint">🔒 Q&amp;A is closed</p>`) +
      `<div style="margin-top:22px" id="qaList"></div>`;
    const f = $('#qf');
    if (f) f.onsubmit = e => {
      e.preventDefault();
      const text = $('#qt').value.trim(); if (!text) return;
      $('#sendBtn').disabled = true;
      socket.emit('aud:qaAsk', { slideId: s.id, text }, r => {
        $('#sendBtn').disabled = false;
        if (!r || !r.ok) return toast((r && r.error) || 'Could not send');
        (qaVotes[s.id] = qaVotes[s.id] || []).push(r.id);
        $('#qt').value = ''; toast('Question sent ✓');
      });
    };
    drawQaList();
  };

  function drawQaList() {
    const box = $('#qaList');
    if (!box || !results || results.slideId !== state.slide.id) return;
    const sid = state.slide.id;
    const voted = new Set(qaVotes[sid] || []);
    const items = results.data.items || [];
    box.innerHTML = items.length ? items.map(q => `<div class="qa-item ${q.answered ? 'answered' : ''}">
        <div class="tx">${esc(q.text)}${q.name ? `<small>${esc(q.name)}</small>` : ''}${q.answered ? '<small>✓ Answered</small>' : ''}</div>
        <button class="upvote ${voted.has(q.id) ? 'on' : ''}" data-id="${q.id}">${icon('arrowup')}<span>${q.votes}</span></button></div>`).join('')
      : `<p class="aud-hint" style="text-align:center">No questions yet — be the first!</p>`;
    box.querySelectorAll('.upvote').forEach(b => b.onclick = () => {
      const id = b.dataset.id, on = !voted.has(id);
      socket.emit('aud:qaVote', { id, up: on });
      qaVotes[sid] = on ? [...voted, id] : [...voted].filter(x => x !== id);
      b.classList.toggle('on', on);
      const sp = b.querySelector('span'); sp.textContent = +sp.textContent + (on ? 1 : -1);
      voted[on ? 'add' : 'delete'](id);
    });
  }

  /* ---------------- reactions ---------------- */
  document.querySelectorAll('#reactBar button').forEach(b => b.onclick = () => {
    if (socket) socket.emit('aud:react', { e: b.dataset.e });
    if (navigator.vibrate) navigator.vibrate(10);
  });

  if (code.length === 6) start(); else codeScreen();
})();
