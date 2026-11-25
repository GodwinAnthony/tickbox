/* ============================================================
   TickBox presenter: slide editor + live presentation mode
   ============================================================ */
(function () {
  const { render, demoData, COLORS, TYPE_META, esc, rich, icon } = window.TBViz;
  const $ = s => document.querySelector(s);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const LS_DECKS = 'tickbox.decks', LS_CUR = 'tickbox.current', LS_LIVE = 'tickbox.live';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------------- slide templates ---------------- */
  function newSlide(type, question) {
    const base = { id: uid(), type, question: question || '' };
    switch (type) {
      case 'mc': return { ...base, question: question || 'Which option do you prefer?', options: ['Option A', 'Option B', 'Option C'], multiple: false };
      case 'wordcloud': return { ...base, question: question || 'Describe this in one word', maxWords: 3 };
      case 'open': return { ...base, question: question || 'What would you like to share?', maxPerPerson: 1 };
      case 'scale': return { ...base, question: question || 'How much do you agree?', statements: ['The content was useful', 'The pace was right'], max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' };
      case 'ranking': return { ...base, question: question || 'Rank these in order of priority', options: ['First item', 'Second item', 'Third item'] };
      case 'quiz': return { ...base, question: question || 'Quiz question?', options: ['Right answer', 'Wrong answer', 'Another wrong one', 'Nope'], correct: 0, time: 20 };
      case 'leaderboard': return { ...base, question: question || 'Final leaderboard' };
      case 'lobby': return { ...base, question: question || 'Join the quiz' };
      case 'qa': return { ...base, question: question || 'Ask me anything' };
      case 'content': return { ...base, question: question || 'Heading', body: '' };
    }
  }

  function quizDeck() {
    const q = (question, options, correct, time) => ({ ...newSlide('quiz'), question, options, correct, time: time || 20 });
    return {
      id: uid(), title: 'Quiz competition', settings: { askNames: true }, updated: Date.now(),
      slides: [
        newSlide('lobby'),
        q('What does CPU stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Power Utility', 'Core Program Unit'], 0),
        q('Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 1),
        q('How many bits are in a byte?', ['4', '16', '8', '32'], 2, 15),
        q('Which gas do plants absorb from the air?', ['Oxygen', 'Nitrogen', 'Hydrogen', 'Carbon dioxide'], 3),
        newSlide('leaderboard'),
      ],
    };
  }

  function sampleDeck() {
    return {
      id: uid(), title: 'My first TickBox', settings: { askNames: false }, updated: Date.now(),
      slides: [
        { ...newSlide('content'), question: 'Welcome to TickBox 👋', body: 'Grab your phone, scan the QR code and get ready to vote.' },
        { ...newSlide('wordcloud'), question: 'In one word, how are you feeling today?' },
        { ...newSlide('mc'), question: 'Which topic should we explore next?', options: ['Robotics', 'Embedded systems', 'AI & ML', 'Web development'] },
        { ...newSlide('scale'), question: 'How was today\'s session?', statements: ['Content was useful', 'Pace was right', 'I would recommend it'] },
        { ...newSlide('quiz'), question: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Power Utility', 'Core Program Unit'], correct: 0, time: 20 },
        newSlide('leaderboard'),
        { ...newSlide('ranking'), question: 'Rank these by importance', options: ['Clear goals', 'Good teamwork', 'Enough time', 'Right tools'] },
        { ...newSlide('open'), question: 'What should we do better next time?' },
        { ...newSlide('qa'), question: 'Any questions?' },
      ],
    };
  }

  function pollDeck() {
    return {
      id: uid(), title: 'Live poll', settings: { askNames: false, theme: 'light' }, updated: Date.now(),
      slides: [
        { ...newSlide('content'), question: 'Welcome!', body: 'Scan the QR code to join and vote from your phone.' },
        { ...newSlide('wordcloud'), question: 'In one word, how are you feeling today?' },
        { ...newSlide('mc'), question: 'Which topic should we cover first?', options: ['Topic A', 'Topic B', 'Topic C', 'Topic D'] },
        { ...newSlide('scale'), question: 'How confident are you about…', statements: ['The basics', 'Using it on your own', 'Explaining it to someone'], minLabel: 'Not at all', maxLabel: 'Very' },
        { ...newSlide('open'), question: 'What do you want to learn today?' },
      ],
    };
  }

  function feedbackDeck() {
    return {
      id: uid(), title: 'Session feedback', settings: { askNames: false, theme: 'white' }, updated: Date.now(),
      slides: [
        { ...newSlide('scale'), question: "How was today's session?", statements: ['Content was useful', 'Pace was right', 'I would recommend it'] },
        { ...newSlide('ranking'), question: 'What should we do more of?', options: ['Hands-on activities', 'Live demos', 'Group discussion', 'Quizzes'] },
        { ...newSlide('open'), question: 'One thing we could improve?', maxPerPerson: 2 },
        { ...newSlide('qa'), question: 'Questions for the speaker?' },
      ],
    };
  }

  const blankDeck = () => ({ id: uid(), title: 'Untitled presentation', settings: { askNames: false, theme: 'light' }, updated: Date.now(), slides: [{ ...newSlide('mc'), question: '' }] });

  const TEMPLATES = [
    { name: 'Quiz competition', desc: 'Lobby, 4 speed questions with leaderboards, and a final winner', make: quizDeck, show: 1 },
    { name: 'Live poll & word cloud', desc: 'Icebreaker word cloud, a poll, a rating and an open question', make: pollDeck, show: 1 },
    { name: 'Feedback & Q&A', desc: 'Rate the session, rank ideas, collect suggestions, take questions', make: feedbackDeck, show: 0 },
  ];

  /* ---------------- state ---------------- */
  let decks = store.get(LS_DECKS, {});
  const hashId = (location.hash.match(/^#d=([\w-]+)/) || [])[1];
  let deck = hashId && decks[hashId] ? decks[hashId] : null;
  let sel = 0;
  let saveT;
  function save() {
    if (!deck) return;
    clearTimeout(saveT);
    const d = deck;
    saveT = setTimeout(() => { d.updated = Date.now(); decks[d.id] = d; store.set(LS_DECKS, decks); store.set(LS_CUR, d.id); }, 250);
  }
  function flushSave() { if (deck) { deck.updated = Date.now(); decks[deck.id] = deck; } store.set(LS_DECKS, decks); }

  /* ---------------- home: create / templates / your presentations ---------------- */
  const ago = ts => {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : new Date(ts).toLocaleDateString();
  };
  const miniThumb = (d, i) => {
    const s = d.slides[i] || d.slides[0];
    return `<div class="thumb-frame theme-${themeOf(d)}" data-deck-thumb><div class="stage"></div></div>`;
  };
  function paintThumbs(root, items) {
    root.querySelectorAll('[data-deck-thumb]').forEach((fr, k) => {
      const { d, i } = items[k];
      const s = d.slides[i] || d.slides[0];
      if (!s) return;
      fr.style.setProperty('--s', (fr.clientWidth || 240) / 960);
      const st = fr.querySelector('.stage');
      render(st, s, demoData(s), { noAnim: true, joinUrl: location.host + '/join', qrSrc: qrUrl(), code: '123 456' });
    });
  }

  const LS_RESULTS = 'tickbox.results';
  let homeView = 'home';
  const results0 = () => store.get(LS_RESULTS, {});

  function deckCard(d) {
    const res = results0()[d.id];
    return `<div class="deck-card" data-id="${d.id}" tabindex="0">
        ${miniThumb(d, 0)}
        <div class="dc-meta"><b>${esc(d.title || 'Untitled')}</b><small>${res ? '<span class="res-dot"></span>Results available · ' : ''}${d.slides.length} slide${d.slides.length === 1 ? '' : 's'} · ${ago(d.updated)}</small></div>
        <div class="dc-actions">
          <button class="ibtn" data-act="dup" title="Duplicate">${icon('copy')}</button>
          <button class="ibtn" data-act="export" title="Download .json">${icon('download')}</button>
          <button class="ibtn danger" data-act="del" title="Delete">${icon('trash')}</button>
        </div>
      </div>`;
  }

  function bindDeckCards(root) {
    root.querySelectorAll('.deck-card').forEach(card => {
      const d = decks[card.dataset.id];
      card.onclick = e => {
        const act = e.target.closest('[data-act]');
        if (!act) return openDeck(d);
        e.stopPropagation();
        if (act.dataset.act === 'dup') {
          const c = JSON.parse(JSON.stringify(d)); c.id = uid(); c.title = (d.title || 'Untitled') + ' (copy)'; c.updated = Date.now();
          c.slides.forEach(sl => { sl.id = uid(); }); delete c.fresh;
          decks[c.id] = c; flushSave(); showHome(); toast('Duplicated');
        } else if (act.dataset.act === 'export') exportDeck(d);
        else if (act.dataset.act === 'del') {
          if (!confirm('Delete "' + (d.title || 'Untitled') + '"? This cannot be undone.')) return;
          delete decks[d.id]; const r = results0(); delete r[d.id]; store.set(LS_RESULTS, r); flushSave(); showHome();
        }
      };
      card.onkeydown = e => { if (e.key === 'Enter') openDeck(d); };
    });
  }

  function tplCards() {
    return TEMPLATES.map((t, k) => `
      <button class="tpl-card" data-tpl="${k}">
        <div class="thumb-frame" data-tpl-thumb="${k}"><div class="stage"></div></div>
        <span class="tpl-meta"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span>
      </button>`).join('');
  }

  function showHome(view) {
    flushSave();
    deck = null;
    if (view) homeView = view;
    history.replaceState(null, '', location.pathname);
    $('#editor').classList.add('hidden');
    $('#home').classList.remove('hidden');
    document.title = 'TickBox — Presentations';
    document.querySelectorAll('.side-nav .sn').forEach(b => b.classList.toggle('on', b.dataset.view === homeView));
    const list = Object.values(decks).filter(d => d.slides && d.slides.length).sort((a, b) => b.updated - a.updated);
    const res = results0();
    const latest = Object.entries(res).filter(([id]) => decks[id]).sort((a, b) => b[1].at - a[1].at)[0];
    const main = $('#homeMain');
    const tplItems = TEMPLATES.map(t => ({ d: t.make(), i: t.show }));

    if (homeView === 'home') {
      main.innerHTML = `
        <h1 class="home-h1">${list.length ? 'Welcome back' : 'Welcome to TickBox'}</h1>
        <div class="ask-wrap">
          <h2 class="ask-title">What would you like to create?</h2>
          <div class="ask-box">
            <textarea id="hAsk" rows="3" placeholder="Type or paste your questions…  e.g.&#10;Which planet is the Red Planet?&#10;Venus&#10;*Mars&#10;Jupiter"></textarea>
            <button class="ask-go" id="hAskGo" title="Create presentation" disabled>${icon('arrowup')}</button>
          </div>
          <div class="st-hint" id="hAskHint">Each question becomes a slide · answers marked with * become quiz questions</div>
          <div class="quick-chips">
            <span>Or start with</span>
            ${TEMPLATES.map((t, k) => `<button class="qchip" data-tpl="${k}">${icon(['quiz', 'wordcloud', 'qa'][k])}${esc(t.name)}</button>`).join('')}
            <button class="qchip" id="hBlank2">${icon('plus')}Blank</button>
            <button class="qchip csv" data-new="csv">${icon('sheet')}Import CSV</button>
          </div>
        </div>
        ${latest ? (() => {
          const [id, r] = latest;
          return `<div class="home-sec"><h2>Recent results</h2></div>
          <div class="res-card" data-open="${id}">
            <div class="rc-head"><span class="t-ic t-leaderboard">${icon('leaderboard')}</span><div><b>${esc(decks[id].title || r.title)}</b><small>Last session ${ago(r.at)}</small></div>
              <button class="btn sm" data-open="${id}">Open</button></div>
            <div class="rc-stats">
              <div><small>Participants</small><b>${r.participants}</b></div>
              <div><small>Engagement</small><b>${r.engagement}%</b></div>
              <div><small>Quiz</small><b>${r.quiz == null ? '—' : r.quiz + '%'}</b><small>${r.quiz == null ? 'no quiz' : 'correct answers'}</small></div>
              <div><small>Q&amp;A</small><b>${r.questions || 0}</b><small>${r.questions === 1 ? 'question' : 'questions'}</small></div>
              ${r.winners && r.winners.length ? `<div class="rc-win"><small>Winners</small><span>${r.winners.map((w, i) => `<i title="${esc(w.name)} · ${w.score} pts">${(window.TBViz.AVATARS || [])[(w.av || 0) % 24] || ''}<em>${i + 1}</em></i>`).join('')}</span><small>${esc(r.winners[0].name)} won</small></div>` : ''}
            </div>
          </div>`;
        })() : ''}
        <div class="home-sec"><h2>Recently viewed</h2>${list.length > 4 ? '<button class="link-btn" data-goto="mine">See all</button>' : ''}</div>
        <div class="deck-grid four">${list.length ? list.slice(0, 4).map(deckCard).join('') : `<div class="deck-empty">${icon('folder', 'big')}<br>No presentations yet — type some questions above or pick a template.</div>`}</div>`;
    } else if (homeView === 'mine') {
      main.innerHTML = `
        <h1 class="home-h1">My presentations</h1>
        <div class="deck-grid">${list.length ? list.map(deckCard).join('') : `<div class="deck-empty">${icon('folder', 'big')}<br>No presentations yet.</div>`}</div>`;
    } else {
      main.innerHTML = `
        <h1 class="home-h1">Templates</h1>
        <div class="tpl-grid">${tplCards()}</div>
        <div class="home-sec"><h2>Other ways to start</h2></div>
        <div class="create-row">
          <button class="create-card primary-card" data-new="blank"><span class="cc-ic">${icon('plus')}</span><span><b>Start from scratch</b><small>A blank presentation.</small></span></button>
          <button class="create-card" data-new="paste"><span class="cc-ic amber">${icon('paste')}</span><span><b>Paste quiz questions</b><small>Turn a list into a ready quiz.</small></span></button>
          <button class="create-card" data-new="csv"><span class="cc-ic green">${icon('sheet')}</span><span><b>Import from spreadsheet</b><small>Questions, answers and times from a .csv file.</small></span></button>
          <button class="create-card" data-new="import"><span class="cc-ic sky">${icon('download')}</span><span><b>Import a file</b><small>Open a TickBox .json file.</small></span></button>
        </div>`;
      main.querySelectorAll('[data-tpl-thumb]').forEach(fr => {
        const k = +fr.dataset.tplThumb; fr.classList.add('theme-' + themeOf(tplItems[k].d));
      });
    }
    paintThumbs(main, [...main.querySelectorAll('[data-deck-thumb]')].map(fr => {
      const id = fr.closest('.deck-card').dataset.id; return { d: decks[id], i: 0 };
    }));
    main.querySelectorAll('[data-tpl-thumb]').forEach(fr => {
      const { d, i } = tplItems[+fr.dataset.tplThumb]; const sl = d.slides[i];
      fr.style.setProperty('--s', (fr.clientWidth || 300) / 960);
      render(fr.querySelector('.stage'), sl, demoData(sl), { noAnim: true, joinUrl: location.host + '/join', qrSrc: qrUrl(), code: '123 456' });
    });
    bindDeckCards(main);
    main.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => openDeck(TEMPLATES[+b.dataset.tpl].make()));
    main.querySelectorAll('[data-open]').forEach(b => b.onclick = e => { e.stopPropagation(); openDeck(decks[b.dataset.open]); });
    main.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => showHome(b.dataset.goto));
    main.querySelectorAll('[data-new]').forEach(b => b.onclick = () => newFrom(b.dataset.new));
    const blank2 = $('#hBlank2'); if (blank2) blank2.onclick = () => newFrom('blank');
    const ask = $('#hAsk');
    if (ask) {
      const go = $('#hAskGo'), hint = $('#hAskHint');
      ask.oninput = () => {
        const r = smartParse(ask.value);
        go.disabled = !r.slides.length;
        hint.textContent = r.slides.length ? describeParse(r) : 'Each question becomes a slide · answers marked with * become quiz questions';
      };
      ask.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go.click(); };
      go.onclick = () => {
        const r = smartParse(ask.value); if (!r.slides.length) return;
        const d = { ...blankDeck(), title: r.title, settings: { askNames: r.quiz > 0, theme: 'light' }, slides: wrapQuiz(r) };
        openDeck(d); toast(`Created ${r.slides.length} slide${r.slides.length > 1 ? 's' : ''}`);
      };
    }
  }

  /* text -> slides, no AI needed: blocks separated by blank lines.
     First line = question; following lines = answers. "*" marks the right answer (quiz). */
  function smartParse(text) {
    const clean = l => l.replace(/^\s*(q(uestion)?\s*)?\d+\s*[.):-]\s*/i, '').replace(/^\s*([-•]|[a-fA-F][.)])\s+/, '').trim();
    let blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length);
    // a single block made only of questions ("…?") = one slide per line
    blocks = blocks.flatMap(b => (b.length > 1 && b.every(l => /\?\s*$/.test(l))) ? b.map(l => [l]) : [b]);
    const slides = []; let quiz = 0;
    blocks.forEach(b => {
      const q = clean(b[0]);
      if (!q) return;
      let correct = -1;
      const opts = b.slice(1, 9).map((l, i) => {
        let t = l.trim();
        if (/^\*/.test(t) || /\*$/.test(t) || /\(correct\)$/i.test(t)) { correct = i; t = t.replace(/^\*+|\*+$/g, '').replace(/\(correct\)$/i, ''); }
        return clean(t);
      }).filter(Boolean);
      if (opts.length >= 2 && correct >= 0 && correct < opts.length) { slides.push({ ...newSlide('quiz'), question: q, options: opts.slice(0, 6), correct: Math.min(correct, 5), time: 20 }); quiz++; }
      else if (opts.length >= 2) slides.push({ ...newSlide('mc'), question: q, options: opts });
      else if (/\b(one|single|a)\s+word\b|\bwords?\b/i.test(q)) slides.push({ ...newSlide('wordcloud'), question: q });
      else slides.push({ ...newSlide('open'), question: q });
    });
    const title = quiz ? 'My quiz' : slides.length ? (slides[0].question.length > 40 ? slides[0].question.slice(0, 40) + '…' : slides[0].question) : 'Untitled presentation';
    return { slides, quiz, title };
  }
  function describeParse(r) {
    const c = {}; r.slides.forEach(s => { c[s.type] = (c[s.type] || 0) + 1; });
    const names = { quiz: 'quiz question', mc: 'poll', wordcloud: 'word cloud', open: 'open question' };
    return 'Will create ' + Object.entries(c).map(([t, n]) => `${n} ${names[t]}${n > 1 ? 's' : ''}`).join(', ') + (r.quiz ? ' + lobby and leaderboard' : '') + ' · Ctrl+Enter';
  }
  function wrapQuiz(r) {
    if (!r.quiz) return r.slides;
    return [newSlide('lobby'), ...r.slides, newSlide('leaderboard')];
  }

  function newFrom(kind) {
    $('#hNewMenu').classList.add('hidden');
    if (kind === 'blank') openDeck({ ...blankDeck(), fresh: true });
    else if (kind === 'quiz') openDeck(quizDeck());
    else if (kind === 'paste') openDeck({ id: uid(), title: 'My quiz', settings: { askNames: true, theme: 'light' }, updated: Date.now(), slides: [newSlide('lobby')] }, () => openBulk());
    else if (kind === 'import') $('#hImportFile').click();
    else if (kind === 'csv') openCsv('new');
  }

  function openDeck(d, after) {
    deck = d; sel = 0; panelTab = 'edit';
    decks[d.id] = d; flushSave(); store.set(LS_CUR, d.id);
    history.replaceState(null, '', location.pathname + '#d=' + d.id);
    $('#home').classList.add('hidden');
    $('#editor').classList.remove('hidden');
    document.title = 'TickBox — ' + (d.title || 'Presentation');
    renderAll();
    if (after) after();
  }

  function exportDeck(d) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    a.download = (d.title || 'tickbox').replace(/[^\w-]+/g, '_') + '.json'; a.click();
  }

  function importFile(f) {
    f.text().then(t => {
      try {
        const d = JSON.parse(t);
        if (!Array.isArray(d.slides)) throw new Error();
        d.id = uid(); d.updated = Date.now(); d.settings = d.settings || { askNames: false };
        d.slides = d.slides.filter(s => TYPE_META[s.type]).map(s => ({ ...newSlide(s.type), ...s, id: uid() }));
        if (!d.slides.length) throw new Error();
        openDeck(d); toast('Imported ✓');
      } catch (_) { toast('That file is not a TickBox presentation'); }
    });
  }

  /* ---------------- editor rendering ---------------- */
  const THEMES = { light: 'Light', white: 'White', dark: 'Dark', midnight: 'Midnight' };
  const themeOf = d => (d && d.settings && THEMES[d.settings.theme]) ? d.settings.theme : 'light';
  const setTheme = (el, t) => { el.className = el.className.replace(/\btheme-\w+/g, '').trim() + ' theme-' + t; };
  const qrUrl = () => '/api/qr?text=' + encodeURIComponent(location.origin + '/join');
  let panelTab = 'edit';

  function renderAll() {
    $('#deckTitle').value = deck.title;
    document.title = 'TickBox — ' + (deck.title || 'Presentation');
    setTheme($('#canvas'), themeOf(deck));
    $('#stripHost').textContent = location.host + '/join';
    renderList(); renderPanel(); renderPreview();
    updateStarter();
  }

  function renderPanel() {
    document.querySelectorAll('.ptab').forEach(b => b.classList.toggle('on', b.dataset.tab === panelTab));
    $('#panelTitle').textContent = panelTab === 'edit' ? 'Edit' : 'Design & settings';
    if (panelTab === 'edit') renderProps(); else renderDesign();
  }

  function renderDesign() {
    const t = themeOf(deck);
    $('#props').innerHTML = `
      <div class="field"><label>Slide theme</label>
        <div class="themes">${Object.entries(THEMES).map(([k, n]) => `<button class="theme-sw ${k === t ? 'on' : ''}" data-theme="${k}"><span class="sw theme-${k}"><b>Aa</b><i></i><i></i><i></i></span><span class="sw-name">${n}</span></button>`).join('')}</div></div>
      <div class="field"><label>Participants</label>
        <label class="switch"><input type="checkbox" id="sNames" ${deck.settings.askNames ? 'checked' : ''}><span class="track"></span>Ask for a name</label>
        <p class="hint">Quizzes always ask for a nickname so the leaderboard can show it.</p></div>
      <div class="field"><label>Presentation</label>
        <button class="link-btn" id="dDecks">${icon('folder')} My presentations</button><br>
        <button class="link-btn" id="dBulk">${icon('paste')} Paste many quiz questions</button></div>`;
    $('#props').querySelectorAll('[data-theme]').forEach(b => b.onclick = () => {
      deck.settings.theme = b.dataset.theme; save(); renderAll();
    });
    $('#sNames').onchange = e => { deck.settings.askNames = e.target.checked; save(); };
    $('#dDecks').onclick = () => $('#btnDecks').click();
    $('#dBulk').onclick = openBulk;
  }

  function renderThumb(i) {
    const st = document.querySelector(`.thumb[data-i="${i}"] .stage`);
    if (!st || !deck.slides[i]) return;
    const fr = st.parentElement;
    fr.style.setProperty('--s', (fr.clientWidth || 180) / 960);
    st._tb = null;
    render(st, deck.slides[i], demoData(deck.slides[i]), { noAnim: true, joinUrl: location.host + '/join', qrSrc: qrUrl(), code: '123 456' });
  }

  function renderList() {
    const list = $('#slideList');
    const th = themeOf(deck);
    list.innerHTML = deck.slides.map((s, i) => `
      <div class="thumb ${i === sel ? 'active' : ''}" data-i="${i}" draggable="true" title="${esc(TYPE_META[s.type].name)}">
        <span class="n">${i + 1}<span class="t-ic t-${s.type}">${icon(s.type)}</span></span>
        <div class="thumb-frame theme-${th}"><div class="stage"></div></div>
      </div>`).join('');
    deck.slides.forEach((_, i) => renderThumb(i));
    const act = list.querySelector('.thumb.active');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
    list.querySelectorAll('.thumb').forEach(el => {
      const i = +el.dataset.i;
      el.onclick = () => { sel = i; renderAll(); };
      el.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; };
      el.ondragover = e => { e.preventDefault(); el.classList.add('drag-over'); };
      el.ondragleave = () => el.classList.remove('drag-over');
      el.ondrop = e => {
        e.preventDefault(); el.classList.remove('drag-over');
        const from = +e.dataTransfer.getData('text/plain');
        if (from === i || isNaN(from)) return;
        const [m] = deck.slides.splice(from, 1);
        deck.slides.splice(i, 0, m);
        sel = i; save(); renderAll();
      };
    });
  }
  $('#addSlide').onclick = () => openTypePicker();

  function renderPreview() {
    const s = deck && deck.slides[sel];
    if (!s) return;
    render($('#previewStage'), s, demoData(s), { noAnim: true, host: false, joinUrl: location.host + '/join', qrSrc: qrUrl(), code: '123 456' });
    $('#canvas').querySelector('.join-strip').classList.toggle('hidden', s.type === 'lobby');
  }
  let thumbT;

  function updateSlide(patch, opts) {
    Object.assign(deck.slides[sel], patch);
    save();
    renderPreview();
    clearTimeout(thumbT); const i = sel; thumbT = setTimeout(() => renderThumb(i), 250);
    if (opts && opts.props) renderProps();
  }

  function listEditor(label, key, s, opts) {
    opts = opts || {};
    const arr = s[key];
    const rows = arr.map((o, i) => `
      <div class="opt-row">
        <span class="dot" style="background:${(opts.colors || COLORS)[i % (opts.colors || COLORS).length]}"></span>
        <input class="input" data-k="${key}" data-i="${i}" value="${esc(o)}" maxlength="120">
        ${opts.correct ? `<button class="correct ${s.correct === i ? 'on' : ''}" data-correct="${i}" title="${s.correct === i ? 'Correct answer' : 'Mark as correct'}">${icon('check')}</button>` : ''}
        <button class="rm" data-rm="${key}" data-i="${i}" title="Remove" ${arr.length <= (opts.min || 1) ? 'disabled' : ''}>${icon('x')}</button>
      </div>`).join('');
    return `<div class="field"><label>${label}</label>${rows}
      ${arr.length < (opts.max || 10) ? `<button class="link-btn" data-add="${key}">${icon('plus')} Add ${opts.noun || 'option'}</button>` : ''}</div>`;
  }

  function renderProps() {
    const s = deck.slides[sel];
    const p = $('#props');
    if (!s) { p.innerHTML = ''; return; }
    let h = `<div class="props-head"><span class="props-title">Slide ${sel + 1}</span>
        <div class="icon-row">
          <button class="ibtn" id="aUp" title="Move up" ${sel === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button class="ibtn" id="aDown" title="Move down" ${sel === deck.slides.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button class="ibtn" id="aDup" title="Duplicate">${icon('copy')}</button>
          <button class="ibtn danger" id="aDel" title="Delete" ${deck.slides.length <= 1 ? 'disabled' : ''}>${icon('trash')}</button>
        </div></div>
      <div class="field"><label>Type</label>
        <div class="dd"><button class="dd-btn" id="pType"><span class="t-ic t-${s.type}">${icon(s.type)}</span><span class="dd-name">${TYPE_META[s.type].name}</span>${icon('down', 'chev')}</button>
        <div class="dd-menu hidden" id="pTypeMenu">${Object.entries(TYPE_META).map(([t, m]) => `<button class="dd-item ${t === s.type ? 'on' : ''}" data-type="${t}"><span class="t-ic t-${t}">${icon(t)}</span><span><b>${m.name}</b><small>${m.desc}</small></span></button>`).join('')}</div></div></div>
      <div class="field"><label>${s.type === 'content' ? 'Heading' : s.type === 'leaderboard' ? 'Title' : 'Question'}</label>
        <textarea class="input" id="pQ" rows="2" maxlength="300" style="min-height:64px">${esc(s.question)}</textarea></div>`;
    switch (s.type) {
      case 'mc':
        h += listEditor('Options', 'options', s, { min: 2 });
        h += `<label class="switch"><input type="checkbox" id="pMulti" ${s.multiple ? 'checked' : ''}><span class="track"></span>Allow multiple choices</label>`;
        break;
      case 'quiz':
        h += listEditor('Answers', 'options', s, { min: 2, max: 6, correct: true, colors: window.TBViz.QUIZ_COLORS, noun: 'answer' });
        h += `<div class="field"><label>Time limit</label><select class="input" id="pTime">${[...new Set([5, 10, 15, 20, 30, 45, 60, 90, 120, s.time])].sort((a, b) => a - b).map(t => `<option value="${t}" ${s.time === t ? 'selected' : ''}>${t} seconds</option>`).join('')}</select></div>
          <p class="hint">Tick the correct answer. Correct answers score 500–1000 points: the faster, the more.</p>
          <button class="link-btn" id="pBulk">${icon('paste')} Paste many questions at once</button>`;
        break;
      case 'ranking':
        h += listEditor('Items to rank', 'options', s, { min: 2, noun: 'item' });
        break;
      case 'scale':
        h += listEditor('Statements', 'statements', s, { min: 1, max: 8, noun: 'statement' });
        h += `<div class="field"><label>Scale</label><select class="input" id="pMax">${[3, 4, 5, 6, 7, 10].map(n => `<option value="${n}" ${s.max === n ? 'selected' : ''}>1 to ${n}</option>`).join('')}</select></div>
          <div class="row"><div class="field" style="flex:1"><label>Low label</label><input class="input" id="pMinL" value="${esc(s.minLabel)}" maxlength="40"></div>
          <div class="field" style="flex:1"><label>High label</label><input class="input" id="pMaxL" value="${esc(s.maxLabel)}" maxlength="40"></div></div>`;
        break;
      case 'wordcloud':
        h += `<div class="field"><label>Words per participant</label><select class="input" id="pMaxW">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${s.maxWords === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
        break;
      case 'open':
        h += `<div class="field"><label>Answers per participant</label><select class="input" id="pMaxP">${[1, 2, 3, 5, 10].map(n => `<option value="${n}" ${s.maxPerPerson === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
        break;
      case 'content':
        h += `<div class="field"><label>Body text</label><textarea class="input" id="pBody" maxlength="800">${esc(s.body || '')}</textarea></div>`;
        break;
      case 'leaderboard':
        h += `<p class="hint">Podium for the top 3 (3rd, then 2nd, then the winner rises) with places 4–10 beside it, then a crown and confetti. Each quiz question also shows its own animated leaderboard after the answer.</p>`;
        break;
      case 'lobby':
        h += `<p class="hint">Shows the QR code and join code while players' names pop in. Put it first.</p>`;
        break;
      case 'qa':
        h += `<p class="hint">The audience asks and upvotes questions. Top-voted rise to the top.</p>`;
        break;
    }
    p.innerHTML = h;
    const menu = $('#pTypeMenu');
    $('#pType').onclick = e => { e.stopPropagation(); menu.classList.toggle('hidden'); };

    p.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
      menu.classList.add('hidden');
      if (b.dataset.type === s.type) return;
      const ns = newSlide(b.dataset.type, s.question);
      ns.id = s.id;
      if (s.options && ns.options && b.dataset.type !== 'quiz') ns.options = s.options.slice();
      deck.slides[sel] = ns; save(); renderAll();
    });
    $('#pQ').oninput = e => updateSlide({ question: e.target.value });
    p.querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => {
      const arr = s[inp.dataset.k].slice(); arr[+inp.dataset.i] = inp.value; updateSlide({ [inp.dataset.k]: arr });
    });
    p.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const k = b.dataset.add, arr = s[k].slice();
      arr.push(k === 'statements' ? 'New statement' : `Option ${arr.length + 1}`);
      updateSlide({ [k]: arr }, { props: true });
      const inputs = p.querySelectorAll(`input[data-k="${k}"]`); const last = inputs[inputs.length - 1];
      if (last) { last.focus(); last.select(); }
    });
    p.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
      const k = b.dataset.rm, i = +b.dataset.i, arr = s[k].slice(); arr.splice(i, 1);
      const patch = { [k]: arr };
      if (s.type === 'quiz') patch.correct = s.correct === i ? 0 : s.correct > i ? s.correct - 1 : s.correct;
      updateSlide(patch, { props: true });
    });
    p.querySelectorAll('[data-correct]').forEach(b => b.onclick = () => updateSlide({ correct: +b.dataset.correct }, { props: true }));
    const on = (id, ev, fn) => { const el = $(id); if (el) el[ev] = fn; };
    on('#pMulti', 'onchange', e => updateSlide({ multiple: e.target.checked }));
    on('#pTime', 'onchange', e => updateSlide({ time: +e.target.value }));
    on('#pMax', 'onchange', e => updateSlide({ max: +e.target.value }));
    on('#pMinL', 'oninput', e => updateSlide({ minLabel: e.target.value }));
    on('#pMaxL', 'oninput', e => updateSlide({ maxLabel: e.target.value }));
    on('#pMaxW', 'onchange', e => updateSlide({ maxWords: +e.target.value }));
    on('#pMaxP', 'onchange', e => updateSlide({ maxPerPerson: +e.target.value }));
    on('#pBody', 'oninput', e => updateSlide({ body: e.target.value }));
    on('#pBulk', 'onclick', openBulk);
    on('#aUp', 'onclick', () => move(-1));
    on('#aDown', 'onclick', () => move(1));
    on('#aDup', 'onclick', () => { const c = JSON.parse(JSON.stringify(deck.slides[sel])); c.id = uid(); deck.slides.splice(sel + 1, 0, c); sel++; save(); renderAll(); });
    on('#aDel', 'onclick', () => { if (deck.slides.length <= 1) return; deck.slides.splice(sel, 1); sel = Math.min(sel, deck.slides.length - 1); save(); renderAll(); });
  }

  function move(d) {
    const j = sel + d; if (j < 0 || j >= deck.slides.length) return;
    const [m] = deck.slides.splice(sel, 1); deck.slides.splice(j, 0, m); sel = j; save(); renderAll();
  }

  /* ---------------- modals ---------------- */
  function modal(html) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal">${html}</div>`;
    back.onclick = e => { if (e.target === back) back.remove(); };
    document.body.appendChild(back);
    return back;
  }

  function parseQuiz(text) {
    const out = [], bad = [];
    text.replace(/\r/g, '').split(/\n\s*\n/).forEach((block, bi) => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const question = lines[0].replace(/^(q(uestion)?\s*)?\d+\s*[.):-]\s*/i, '').trim();
      let correct = -1;
      const options = lines.slice(1, 7).map((l, i) => {
        let t = l.replace(/^([-•]|[a-fA-F1-6][.)])\s*/, '').trim();
        if (/^\*/.test(t) || /\*$/.test(t) || /\(correct\)$/i.test(t)) { correct = i; t = t.replace(/^\*+|\*+$/g, '').replace(/\(correct\)$/i, '').trim(); }
        return t;
      });
      if (options.length < 2 || correct < 0) { bad.push(bi + 1); return; }
      out.push({ question, options, correct });
    });
    return { out, bad };
  }

  function openBulk() {
    const m = modal(`<h3>Paste quiz questions</h3>
      <p class="preview-note" style="margin:-6px 0 12px">One question per block, blank line between questions. Put a <b>*</b> in front of the correct answer (2–6 answers each).</p>
      <textarea class="input" id="bText" style="min-height:220px;font-family:ui-monospace,monospace;font-size:13px" placeholder="What does CPU stand for?
*Central Processing Unit
Computer Personal Unit
Central Power Utility

Which planet is the Red Planet?
Venus
*Mars
Jupiter"></textarea>
      <div class="row" style="margin-top:12px;flex-wrap:wrap;gap:14px">
        <label class="row" style="gap:8px;font-weight:600;font-size:14px">Time per question
          <select class="input" id="bTime" style="width:auto;padding:8px 10px">${[10, 15, 20, 30, 45, 60].map(t => `<option ${t === 20 ? 'selected' : ''} value="${t}">${t}s</option>`).join('')}</select></label>
        <label class="switch"><input type="checkbox" id="bWrap" checked><span class="track"></span>Add Lobby + final Leaderboard if missing</label>
      </div>
      <div class="err" id="bErr"></div>
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:12px"><button class="link-btn" id="bCsv">${icon('sheet')} Have a spreadsheet? Import CSV</button><button class="btn primary" id="bAdd" disabled>Add questions</button></div>`);
    m.querySelector('#bCsv').onclick = () => { m.remove(); openCsv('add'); };
    const ta = m.querySelector('#bText'), add = m.querySelector('#bAdd'), err = m.querySelector('#bErr');
    const check = () => {
      const { out, bad } = parseQuiz(ta.value);
      add.disabled = !out.length;
      add.textContent = out.length ? `Add ${out.length} question${out.length > 1 ? 's' : ''}` : 'Add questions';
      err.textContent = bad.length ? `Question ${bad.join(', ')}: needs 2+ answers and one marked with *` : '';
    };
    ta.oninput = check;
    add.onclick = () => {
      const { out } = parseQuiz(ta.value);
      const time = +m.querySelector('#bTime').value;
      const slides = out.map(q => ({ ...newSlide('quiz'), ...q, time }));
      deck.slides.splice(sel + 1, 0, ...slides);
      if (m.querySelector('#bWrap').checked) {
        if (!deck.slides.some(s => s.type === 'lobby')) deck.slides.unshift(newSlide('lobby'));
        const last = deck.slides[deck.slides.length - 1];
        if (!last || last.type !== 'leaderboard') deck.slides.push(newSlide('leaderboard'));
      }
      sel = deck.slides.indexOf(slides[0]);
      save(); renderAll(); m.remove(); toast(`Added ${slides.length} quiz questions ✓`);
    };
    ta.focus();
  }


  /* ---------------- CSV / spreadsheet import ---------------- */
  const CSV_TEMPLATE = [
    ['Type', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F', 'Correct', 'Time'],
    ['quiz', 'What does CPU stand for?', 'Central Processing Unit', 'Computer Personal Unit', 'Central Power Utility', 'Core Program Unit', '', '', 'A', '20'],
    ['quiz', 'Which planet is known as the Red Planet?', 'Venus', 'Mars', 'Jupiter', 'Saturn', '', '', 'B', '15'],
    ['quiz', 'What is 7 x 8?', '54', '56', '64', '', '', '', '56', '10'],
    ['quiz', 'Water boils at 100 degrees C at sea level, true or false?', 'True', 'False', '', '', '', '', 'A', '10'],
    ['poll', 'Which topic should we cover next?', 'Robotics', 'Embedded systems', 'Machine design', '', '', '', '', ''],
    ['wordcloud', 'Describe today in one word', '', '', '', '', '', '', '', ''],
  ];
  function downloadCsvTemplate() {
    const csv = CSV_TEMPLATE.map(r => r.map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'tickbox-quiz-template.csv'; a.click();
  }
  function exportCsv(d) {
    const rows = [CSV_TEMPLATE[0]];
    const TN = { quiz: 'quiz', mc: 'poll', wordcloud: 'wordcloud', open: 'open', scale: 'scale', ranking: 'ranking', qa: 'qa', content: 'heading' };
    d.slides.forEach(s => {
      if (!TN[s.type]) return;
      const opts = (s.options || s.statements || (s.type === 'content' && s.body ? [s.body] : [])).slice(0, 6);
      rows.push([TN[s.type], s.question || '', ...opts, ...Array(6 - opts.length).fill(''), s.type === 'quiz' ? 'ABCDEF'[s.correct] : '', s.type === 'quiz' ? String(s.time) : '']);
    });
    const csv = rows.map(r => r.map(c => /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = (d.title || 'tickbox').replace(/[^\w-]+/g, '_') + '.csv'; a.click();
  }

  function readTextFile(f) {
    return f.arrayBuffer().then(buf => {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (_) { return new TextDecoder('windows-1252').decode(buf); } // Excel "CSV (Comma delimited)" on Windows
    });
  }

  function csvRows(text) {
    text = text.replace(/^﻿/, '');
    // pick the delimiter used in the first line: comma, semicolon (European Excel) or tab
    const head = text.slice(0, text.search(/\r?\n|$/));
    const count = ch => head.replace(/"[^"]*"/g, '').split(ch).length - 1;
    const delim = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"' && cell.trim() === '') { q = true; cell = ''; }
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
  }

  const CSV_TYPES = {
    quiz: 'quiz', question: 'quiz', 'quiz question': 'quiz',
    poll: 'mc', mc: 'mc', 'multiple choice': 'mc', 'multiple-choice': 'mc', vote: 'mc',
    wordcloud: 'wordcloud', 'word cloud': 'wordcloud', word: 'wordcloud', words: 'wordcloud',
    open: 'open', 'open ended': 'open', 'open-ended': 'open', text: 'open', 'free text': 'open',
    scale: 'scale', scales: 'scale', rating: 'scale', ranking: 'ranking', rank: 'ranking',
    qa: 'qa', 'q&a': 'qa', 'q and a': 'qa', heading: 'content', content: 'content', title: 'content', info: 'content', slide: 'content',
    lobby: 'lobby', leaderboard: 'leaderboard',
  };

  function parseTime(v) {
    if (!v) return null;
    const m = String(v).trim().match(/^(\d+):(\d{1,2})$/);
    const n = m ? (+m[1]) * 60 + (+m[2]) : parseFloat(String(v).replace(',', '.'));
    if (!isFinite(n) || n <= 0) return NaN;
    return Math.max(5, Math.min(120, Math.round(n)));
  }

  // rows -> { items: [{row, slide, warn}], errors: [{row, msg}] }
  function csvToSlides(rows, defTime) {
    const items = [], errors = [];
    if (!rows.length) return { items, errors: [{ row: 0, msg: 'The file is empty' }] };
    const norm = h => h.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').replace(/[:*]/g, '').trim();
    const hdr = rows[0].map(norm);
    const col = { opts: [] };
    const isHeader = hdr.some(h => /^(question|questions|question text|q|prompt)$/.test(h));
    if (isHeader) {
      hdr.forEach((h, i) => {
        let m;
        if ((m = h.match(/^(?:option|answer|choice|ans|opt)\s*\(?([1-6a-f])\)?$/))) col.opts[/\d/.test(m[1]) ? +m[1] - 1 : 'abcdef'.indexOf(m[1])] = i;
        else if (/^(question|questions|question text|q|prompt)$/.test(h)) col.q = i;
        else if (/^(type|slide type|question type|kind)$/.test(h)) col.type = i;
        else if (/correct|right answer|^answer$|^key$|^solution$/.test(h)) col.correct = i;
        else if (/time|sec|timer|duration|limit/.test(h)) col.time = i;
      });
      col.opts = col.opts.filter(x => x != null);
    }
    rows.slice(isHeader ? 1 : 0).forEach((r, ri) => {
      const rowNo = ri + (isHeader ? 2 : 1);
      let question, opts, correctRaw = '', timeRaw = '', typeRaw = '';
      if (isHeader) {
        question = r[col.q] || '';
        opts = col.opts.map(i => r[i] || '');
        if (col.correct != null) correctRaw = r[col.correct] || '';
        if (col.time != null) timeRaw = r[col.time] || '';
        if (col.type != null) typeRaw = r[col.type] || '';
      } else {
        // no header: [type?], question, answers…, [correct], [time]
        const cells = r.slice();
        while (cells.length && !cells[cells.length - 1]) cells.pop();
        if (CSV_TYPES[norm(cells[0] || '')] && cells.length > 1) typeRaw = cells.shift();
        question = cells.shift() || '';
        if (cells.length >= 3 && /^\d+(\s*s(ec)?)?$/i.test(cells[cells.length - 1]) && +parseFloat(cells[cells.length - 1]) >= 5) timeRaw = cells.pop();
        if (cells.length >= 3 && /^([a-f]|[1-6])$/i.test(cells[cells.length - 1])) correctRaw = cells.pop();
        opts = cells;
      }
      question = question.replace(/^\s*(q(uestion)?\s*)?\d+\s*[.):-]\s+/i, '').trim();
      if (!question && !opts.some(Boolean)) return;
      if (!question) { errors.push({ row: rowNo, msg: 'No question text' }); return; }
      // a "*" in front of / behind an answer marks it correct
      let starred = -1;
      opts = opts.map((o, i) => { if (/^\*|\*$/.test(o)) { starred = i; return o.replace(/^\*+|\*+$/g, '').trim(); } return o; });
      const kept = []; const map = [];
      opts.forEach((o, i) => { if (o) { map[i] = kept.length; kept.push(o.slice(0, 120)); } });
      let type = CSV_TYPES[norm(typeRaw)] || null;
      if (typeRaw && !type) { errors.push({ row: rowNo, msg: `Unknown type "${typeRaw}"` }); return; }
      let correct = -1;
      if (correctRaw) {
        const c = correctRaw.split(/[,;|/]/)[0].trim().replace(/^(option|answer|choice)\s*/i, '').replace(/[.)]$/, '');
        const byText = kept.findIndex(o => o.toLowerCase() === correctRaw.trim().toLowerCase() || o.toLowerCase() === c.toLowerCase());
        if (byText >= 0) correct = byText;
        else if (/^[a-f]$/i.test(c)) correct = map['abcdef'.indexOf(c.toLowerCase())] ?? -1;
        else if (/^[1-6]$/.test(c)) correct = map[+c - 1] ?? -1;
        if (correct < 0) { errors.push({ row: rowNo, msg: `Correct answer "${correctRaw}" doesn't match any option` }); return; }
      } else if (starred >= 0) correct = map[starred];
      if (!type) type = correct >= 0 ? 'quiz' : kept.length >= 2 ? 'mc' : /\b(one|single|a)\s+word\b|\bwords?\b/i.test(question) ? 'wordcloud' : 'open';
      let warn = '';
      const t = parseTime(timeRaw);
      if (Number.isNaN(t)) warn = `Time "${timeRaw}" not understood, using ${defTime}s`;
      const s = { ...newSlide(type), question: question.slice(0, 300) };
      if (type === 'quiz') {
        if (kept.length < 2) { errors.push({ row: rowNo, msg: 'A quiz question needs at least 2 answers' }); return; }
        if (correct < 0) { errors.push({ row: rowNo, msg: 'No correct answer given' }); return; }
        if (kept.length > 6) { errors.push({ row: rowNo, msg: 'Max 6 answers per quiz question' }); return; }
        s.options = kept; s.correct = correct; s.time = t || defTime;
      } else if (type === 'mc' || type === 'ranking') {
        if (kept.length < 2) { errors.push({ row: rowNo, msg: 'Needs at least 2 options' }); return; }
        s.options = kept.slice(0, 10);
      } else if (type === 'scale') { if (kept.length) s.statements = kept.slice(0, 8); }
      else if (type === 'content') { s.body = kept.join('\n').slice(0, 800); }
      items.push({ row: rowNo, slide: s, warn });
    });
    return { items, errors };
  }

  function openCsv(mode) {
    // mode: 'new' (create a presentation) | 'add' (insert into the open one)
    const tplHead = CSV_TEMPLATE[0], tplRow = CSV_TEMPLATE[1];
    const m = modal(`<div class="csv-modal">
      <h3>Import questions from a spreadsheet</h3>
      <p class="preview-note" style="margin:-6px 0 14px">One row per question. Works with Excel, Google Sheets or Numbers. Save or download the sheet as <b>.csv</b>.</p>
      <label class="csv-drop" id="cDrop">
        <span class="csv-ic">${icon('sheet')}</span>
        <span><b id="cName">Choose a CSV file</b><small id="cSub">or drag and drop it here</small></span>
        <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" id="cFile" hidden>
      </label>
      <div id="cBody">
        <div class="csv-help">
          <div class="csv-help-top"><b>Columns</b><button class="link-btn" id="cTpl">${icon('download')} Download template</button></div>
          <div class="csv-tbl-wrap"><table class="csv-tbl ex"><tr>${tplHead.map(h => `<th>${h}</th>`).join('')}</tr><tr>${tplRow.map(c => `<td>${esc(c)}</td>`).join('')}</tr></table></div>
          <ul class="csv-notes">
            <li><b>Question</b> is the only column you must have.</li>
            <li><b>Correct</b> can be a letter (A–F), a number (1–6) or the answer text. You can also put a <b>*</b> in front of the right answer instead.</li>
            <li><b>Time</b> is in seconds (5–120). Leave it empty to use the default.</li>
            <li><b>Type</b> is optional: quiz, poll, wordcloud, open, scale, ranking, qa or heading. Rows with a correct answer become quiz questions.</li>
          </ul>
        </div>
      </div>
      <div class="row csv-opts">
        <label class="row" style="gap:8px;font-weight:600;font-size:14px">Default time
          <select class="input" id="cTime" style="width:auto;padding:8px 10px">${[10, 15, 20, 30, 45, 60].map(t => `<option ${t === 20 ? 'selected' : ''} value="${t}">${t}s</option>`).join('')}</select></label>
        <label class="switch"><input type="checkbox" id="cWrap" checked><span class="track"></span>Add Lobby + final Leaderboard</label>
      </div>
      <div class="csv-foot"><button class="btn" id="cCancel">Cancel</button><button class="btn primary" id="cGo" disabled>${mode === 'add' ? 'Add questions' : 'Create quiz'}</button></div>
    </div>`);
    m.querySelector('.modal').classList.add('wide');
    let rows = null, fileName = '', parsed = null;
    const body = m.querySelector('#cBody'), go = m.querySelector('#cGo');
    m.querySelector('#cTpl').onclick = downloadCsvTemplate;
    m.querySelector('#cCancel').onclick = () => m.remove();
    const refresh = () => {
      if (!rows) return;
      parsed = csvToSlides(rows, +m.querySelector('#cTime').value);
      const { items, errors } = parsed;
      const nq = items.filter(x => x.slide.type === 'quiz').length;
      const TN = { quiz: 'Quiz', mc: 'Poll', wordcloud: 'Word cloud', open: 'Open', scale: 'Scale', ranking: 'Ranking', qa: 'Q&A', content: 'Heading', lobby: 'Lobby', leaderboard: 'Leaderboard' };
      body.innerHTML = `
        <div class="csv-sum ${items.length ? 'ok' : 'bad'}">${items.length
          ? `${icon('check')} <b>${items.length} question${items.length > 1 ? 's' : ''} ready</b>${nq && nq < items.length ? ` <span>(${nq} quiz)</span>` : ''}`
          : `${icon('x')} <b>No questions found</b>`}${errors.length ? ` <em>· ${errors.length} row${errors.length > 1 ? 's' : ''} skipped</em>` : ''}</div>
        ${errors.length ? `<div class="csv-errs">${errors.slice(0, 8).map(e => `<div>${e.row ? `Row ${e.row}: ` : ''}${esc(e.msg)}</div>`).join('')}${errors.length > 8 ? `<div>…and ${errors.length - 8} more</div>` : ''}</div>` : ''}
        ${items.length ? `<div class="csv-list">${items.map((x, k) => {
          const s = x.slide;
          return `<div class="csv-item"><span class="ci-n">${k + 1}</span><div class="ci-main">
            <div class="ci-q"><span class="ci-type t-${s.type}">${TN[s.type]}</span>${rich(s.question)}</div>
            ${s.options ? `<div class="ci-opts">${s.options.map((o, i) => `<span class="${s.type === 'quiz' && i === s.correct ? 'right' : ''}">${s.type === 'quiz' && i === s.correct ? icon('check') : ''}${rich(o)}</span>`).join('')}</div>` : ''}
            ${x.warn ? `<div class="ci-warn">${esc(x.warn)}</div>` : ''}
          </div>${s.type === 'quiz' ? `<span class="ci-time">${icon('clock')}${s.time}s</span>` : ''}</div>`;
        }).join('')}</div>` : `<p class="preview-note">Check the file has a <b>Question</b> column, or <button class="link-btn" id="cTpl2">download the template</button> to see the format.</p>`}`;
      const t2 = body.querySelector('#cTpl2'); if (t2) t2.onclick = downloadCsvTemplate;
      go.disabled = !items.length;
      go.textContent = items.length ? (mode === 'add' ? `Add ${items.length} question${items.length > 1 ? 's' : ''}` : `Create quiz with ${items.length} question${items.length > 1 ? 's' : ''}`) : (mode === 'add' ? 'Add questions' : 'Create quiz');
    };
    const load = f => {
      if (!f) return;
      if (/\.(xlsx|xls|ods|numbers)$/i.test(f.name)) { toast('Save the sheet as .csv first (File → Save as / Download → CSV)'); return; }
      fileName = f.name;
      readTextFile(f).then(t => {
        rows = csvRows(t);
        m.querySelector('#cName').textContent = f.name;
        m.querySelector('#cSub').textContent = `${rows.length} row${rows.length === 1 ? '' : 's'} · choose another file`;
        m.querySelector('#cDrop').classList.add('loaded');
        refresh();
      });
    };
    m.querySelector('#cFile').onchange = e => { load(e.target.files[0]); e.target.value = ''; };
    const drop = m.querySelector('#cDrop');
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); };
    m.querySelector('#cTime').onchange = refresh;
    go.onclick = () => {
      if (!parsed || !parsed.items.length) return;
      const slides = parsed.items.map(x => x.slide);
      const hasQuiz = slides.some(s => s.type === 'quiz');
      const wrap = m.querySelector('#cWrap').checked && hasQuiz;
      const title = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'My quiz';
      if (mode === 'add' && deck && !deck.fresh) {
        deck.slides.splice(sel + 1, 0, ...slides);
        if (wrap) {
          if (!deck.slides.some(s => s.type === 'lobby')) deck.slides.unshift(newSlide('lobby'));
          const last = deck.slides[deck.slides.length - 1];
          if (!last || last.type !== 'leaderboard') deck.slides.push(newSlide('leaderboard'));
        }
        if (hasQuiz) deck.settings.askNames = true;
        sel = deck.slides.indexOf(slides[0]);
        save(); renderAll();
      } else if (mode === 'add' && deck) {
        deck.slides = wrap ? [newSlide('lobby'), ...slides, newSlide('leaderboard')] : slides;
        deck.fresh = false; sel = 0;
        if (hasQuiz) deck.settings.askNames = true;
        if (!deck.title || deck.title === 'Untitled presentation') deck.title = title;
        save(); renderAll();
      } else {
        openDeck({ id: uid(), title, settings: { askNames: hasQuiz, theme: 'light' }, updated: Date.now(),
          slides: wrap ? [newSlide('lobby'), ...slides, newSlide('leaderboard')] : slides });
      }
      m.remove(); toast(`Imported ${slides.length} question${slides.length > 1 ? 's' : ''} ✓`);
    };
  }

  function openTypePicker() {
    const m = modal(`<h3>Add a slide</h3><div class="type-grid">${Object.entries(TYPE_META).map(([t, x]) => `<button class="type-card" data-t="${t}"><span class="t-ic t-${t}">${icon(t)}</span><b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div>
      <div class="row" style="margin-top:16px;gap:22px;flex-wrap:wrap"><button class="link-btn" id="tBulk">${icon('paste')} Paste many quiz questions at once</button><button class="link-btn" id="tCsv">${icon('sheet')} Import questions from CSV</button></div>`);
    m.querySelector('#tBulk').onclick = () => { m.remove(); openBulk(); };
    m.querySelector('#tCsv').onclick = () => { m.remove(); openCsv('add'); };
    m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      if (deck.fresh) { deck.fresh = false; deck.slides = [newSlide(b.dataset.t)]; sel = 0; }
      else { deck.slides.splice(sel + 1, 0, newSlide(b.dataset.t)); sel++; }
      save(); renderAll(); m.remove();
      setTimeout(() => { const q = $('#pQ'); if (q) { q.focus(); q.select(); } }, 50);
    });
  }

  $('#btnDecks').onclick = () => showHome();
  $('#btnHome').onclick = () => showHome();
  $('#hNew').onclick = e => { e.stopPropagation(); $('#hNewMenu').classList.toggle('hidden'); };
  $('#hNewMenu').querySelectorAll('[data-new]').forEach(b => b.onclick = () => newFrom(b.dataset.new));
  document.addEventListener('click', e => { if (!e.target.closest('.new-wrap')) $('#hNewMenu').classList.add('hidden'); });
  document.querySelectorAll('.side-nav [data-view]').forEach(b => b.onclick = () => showHome(b.dataset.view));

  /* blank presentation starter ("What would you like to create?") */
  function updateStarter() {
    const on = !!(deck && deck.fresh);
    $('#starter').classList.toggle('hidden', !on);
    $('#canvas').classList.toggle('hidden', on);
    $('#quickAdd').classList.toggle('hidden', on);
    if (on) { $('#stText').value = ''; $('#stGo').disabled = true; setTimeout(() => $('#stText').focus(), 50); }
  }
  $('#stText').oninput = () => {
    const r = smartParse($('#stText').value);
    $('#stGo').disabled = !r.slides.length;
    $('#stHint').textContent = r.slides.length ? describeParse(r) : 'Each question becomes a slide · answers marked with * become quiz questions';
  };
  $('#stText').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#stGo').click(); };
  $('#stGo').onclick = () => {
    const r = smartParse($('#stText').value); if (!r.slides.length) return;
    deck.slides = wrapQuiz(r); deck.fresh = false; sel = 0;
    if (r.quiz) deck.settings.askNames = true;
    if (!deck.title || deck.title === 'Untitled presentation') deck.title = r.title;
    save(); renderAll(); toast(`Created ${r.slides.length} slide${r.slides.length > 1 ? 's' : ''}`);
  };
  $('#stScratch').onclick = () => { deck.fresh = false; save(); renderAll(); panelTab = 'edit'; setTimeout(() => { const q = $('#pQ'); if (q) q.focus(); }, 60); };
  $('#stCsv').onclick = () => openCsv('add');
  $('#stImport').onchange = e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; };

  $('#hImportFile').onchange = e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; };
  const oldDecksModal = () => {
    const list = Object.values(decks).sort((a, b) => b.updated - a.updated);
    const m = modal(`<h3>My presentations</h3>
      <div class="deck-list">${list.map(d => `<div class="deck-item" data-id="${d.id}"><div class="meta"><b>${esc(d.title)}</b><small>${d.slides.length} slides · edited ${new Date(d.updated).toLocaleString()}</small></div>${d.id === deck.id ? '<span class="progress-mini">Open</span>' : ''}<button class="ibtn danger" data-del="${d.id}" title="Delete">${icon('trash')}</button></div>`).join('')}</div>
      <div class="row" style="margin-top:16px;flex-wrap:wrap">
        <button class="btn primary" id="mQuiz">${icon('quiz')} New quiz</button>
        <button class="btn" id="mNew">${icon('plus')} New blank</button>
        <button class="btn" id="mExport">${icon('download')} Export .json</button>
        <button class="btn" id="mExportCsv">${icon('sheet')} Export .csv</button>
        <button class="btn" id="mCsv">${icon('sheet')} Import .csv</button>
        <label class="btn" style="cursor:pointer">${icon('paste')} Import .json<input type="file" accept=".json,application/json" id="mImport" hidden></label>
      </div>
      <p class="preview-note" style="margin-top:14px">Presentations are saved in this browser. Download a .json copy to move them to another computer.</p>`);
    m.querySelectorAll('.deck-item').forEach(el => el.onclick = e => {
      if (e.target.closest('[data-del]')) return;
      deck = decks[el.dataset.id]; sel = 0; save(); renderAll(); m.remove();
    });
    m.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const id = b.dataset.del;
      if (!confirm('Delete "' + decks[id].title + '"? This cannot be undone.')) return;
      delete decks[id];
      if (id === deck.id) { deck = Object.values(decks)[0] || sampleDeck(); sel = 0; }
      decks[deck.id] = deck; store.set(LS_DECKS, decks); save(); renderAll(); m.remove();
    });
    m.querySelector('#mQuiz').onclick = () => { deck = quizDeck(); sel = 0; save(); renderAll(); m.remove(); };
    m.querySelector('#mNew').onclick = () => {
      deck = { id: uid(), title: 'Untitled presentation', settings: { askNames: false }, updated: Date.now(), slides: [newSlide('mc')] };
      sel = 0; save(); renderAll(); m.remove();
    };
    m.querySelector('#mExport').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' }));
      a.download = (deck.title || 'tickbox').replace(/[^\w-]+/g, '_') + '.json'; a.click();
    };
    m.querySelector('#mExportCsv').onclick = () => exportCsv(deck);
    m.querySelector('#mCsv').onclick = () => { m.remove(); openCsv('add'); };
    m.querySelector('#mImport').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        try {
          const d = JSON.parse(t);
          if (!Array.isArray(d.slides)) throw new Error();
          d.id = uid(); d.updated = Date.now(); d.settings = d.settings || { askNames: false };
          d.slides = d.slides.filter(s => TYPE_META[s.type]).map(s => ({ ...newSlide(s.type), ...s, id: uid() }));
          if (!d.slides.length) throw new Error();
          deck = d; sel = 0; save(); renderAll(); m.remove(); toast('Imported ✓');
        } catch (_) { toast('That file is not a TickBox presentation'); }
      });
    };
  };

  document.querySelectorAll('.ptab').forEach(b => b.onclick = () => { panelTab = b.dataset.tab; renderPanel(); });
  document.querySelectorAll('#quickAdd [data-q]').forEach(b => b.onclick = () => {
    if (b.dataset.q === 'more') return openTypePicker();
    if (deck.fresh) { deck.fresh = false; deck.slides = [newSlide(b.dataset.q)]; sel = 0; }
    else { deck.slides.splice(sel + 1, 0, newSlide(b.dataset.q)); sel++; }
    panelTab = 'edit'; save(); renderAll();
    setTimeout(() => { const q = $('#pQ'); if (q) { q.focus(); q.select(); } }, 50);
  });
  $('#qaPaste').onclick = () => openBulk();

  /* ---------------- preview (no audience) ---------------- */
  let pvIndex = -1;
  function drawPv() {
    const s = deck.slides[pvIndex];
    const stg = $('#pvStage'); stg._tb = null;
    render(stg, s, demoData(s), { joinUrl: location.host + '/join', qrSrc: qrUrl(), code: '123 456' });
    $('#pvPos').textContent = `${pvIndex + 1} / ${deck.slides.length}`;
    $('#pvPrev').disabled = pvIndex === 0; $('#pvNext').disabled = pvIndex === deck.slides.length - 1;
  }
  function closePv() { pvIndex = -1; $('#pv').classList.add('hidden'); document.body.style.overflow = ''; }
  $('#btnPreview').onclick = () => {
    pvIndex = sel; setTheme($('#pv'), themeOf(deck));
    $('#pv').classList.remove('hidden'); document.body.style.overflow = 'hidden'; drawPv();
  };
  $('#pvPrev').onclick = () => { if (pvIndex > 0) { pvIndex--; drawPv(); } };
  $('#pvNext').onclick = () => { if (pvIndex < deck.slides.length - 1) { pvIndex++; drawPv(); } };
  $('#pvClose').onclick = closePv;
  document.addEventListener('keydown', e => {
    if (pvIndex < 0) return;
    if (e.key === 'Escape') closePv();
    else if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); $('#pvNext').click(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); $('#pvPrev').click(); }
  });

  $('#deckTitle').oninput = e => { deck.title = e.target.value; save(); };

  /* ============================================================
     LIVE PRESENTATION
     ============================================================ */
  const socket = io({ transports: ['websocket', 'polling'] });
  let live = null;          // { code, hostToken, deckId }
  let snap = null;          // last host snapshot
  let results = null;       // latest results for current slide
  let idleT;

  socket.on('connect', () => {
    const saved = live || store.get(LS_LIVE, null);
    if (saved) {
      socket.emit('host:resume', saved, r => {
        if (r && r.ok) { live = saved; openPresent(r.snapshot); }
        else if (live) { toast('Session expired'); closePresent(); }
        else store.del(LS_LIVE);
      });
    }
  });

  $('#btnPresent').onclick = () => {
    if (!socket.connected) { toast('Connecting to server… try again in a moment'); return; }
    $('#btnPresent').disabled = true;
    socket.emit('host:create', { deck }, r => {
      $('#btnPresent').disabled = false;
      if (!r || !r.ok) { toast('Could not start the session'); return; }
      live = { code: r.code, hostToken: r.hostToken, deckId: deck.id };
      store.set(LS_LIVE, live);
      openPresent(r.snapshot);
      if (sel > 0) socket.emit('host:goto', { index: sel });
    });
  };

  function prettyCode(c) { return c.slice(0, 3) + ' ' + c.slice(3); }

  function openPresent(snapshot) {
    $('#present').classList.remove('hidden');
    setTheme($('#present'), themeOf(snapshot.deck));
    document.body.style.overflow = 'hidden';
    $('#joinHost').textContent = location.host + '/join';
    $('#joinCode').textContent = prettyCode(live.code);
    $('#qrSmall').src = '/api/qr?text=' + encodeURIComponent(location.origin + '/join?code=' + live.code);
    applySnapshot(snapshot);
    poke();
  }

  function closePresent() {
    live = null; snap = null; store.del(LS_LIVE);
    $('#present').classList.add('hidden');
    document.body.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    $('#presentStage').innerHTML = ''; $('#presentStage')._tb = null;
  }

  function applySnapshot(s) {
    const changed = !snap || snap.index !== s.index;
    snap = s; results = s.results;
    if (changed) { $('#presentStage')._tb = null; }
    $('#pCount').textContent = s.participants;
    setResponders(s.responders);
    drawStage();
    updateControls();
  }

  function setResponders(n) {
    const slide = snap && snap.deck.slides[snap.index];
    const lbl = slide && slide.type === 'qa' ? 'questions' : 'responses';
    $('#rCount').textContent = n; $('#rLabel').textContent = n === 1 ? lbl.slice(0, -1) : lbl;
    $('#rPill').classList.toggle('hidden', !slide || ['content', 'leaderboard', 'lobby'].includes(slide.type));
  }

  function drawStage() {
    if (!snap) return;
    const slide = snap.deck.slides[snap.index];
    $('#joinbar').classList.toggle('hidden', slide.type === 'lobby');
    const quizzes = snap.deck.slides.filter(s => s.type === 'quiz');
    render($('#presentStage'), slide, results, {
      host: true,
      quizNo: quizzes.findIndex(s => s.id === slide.id) + 1,
      quizTotal: quizzes.length,
      code: prettyCode(live.code),
      qrSrc: $('#qrSmall').src,
      hideResults: snap.hideResults,
      joinUrl: location.host + '/join',
      onHide: id => socket.emit('host:hide', { id }),
      onQaMark: (id, answered) => socket.emit('host:qaAnswered', { id, answered }),
    });
  }

  function updateControls() {
    const slide = snap.deck.slides[snap.index];
    const st = snap.slideState[slide.id] || {};
    $('#cPos').textContent = `${snap.index + 1} / ${snap.deck.slides.length}`;
    $('#cPrev').disabled = snap.index === 0;
    const qs = slide.type === 'quiz' ? (!st.startedAt ? 'start' : !st.revealed ? 'run' : !st.showBoard ? 'reveal' : 'board') : null;
    const last = snap.index >= snap.deck.slides.length - 1;
    $('#cNext').innerHTML = (qs === 'start' ? 'Start quiz' : qs === 'run' ? 'Reveal' : qs === 'reveal' ? 'Leaderboard' : 'Next') + icon('right');
    $('#cNext').disabled = last && (!qs || qs === 'board');
    const votable = !['content', 'leaderboard', 'lobby'].includes(slide.type);
    const q = $('#cQuiz');
    q.classList.toggle('hidden', slide.type !== 'quiz');
    if (slide.type === 'quiz') {
      q.classList.toggle('hidden', !st.revealed);
    }
    $('#cOpen').classList.toggle('hidden', !votable || slide.type === 'quiz');
    $('#cOpen').innerHTML = icon(st.open ? 'unlock' : 'lock');
    $('#cOpen').title = st.open ? 'Voting is open — click to close' : 'Voting is closed — click to open';
    $('#cOpen').classList.toggle('on', !st.open);
    $('#cHide').innerHTML = icon(snap.hideResults ? 'eyeoff' : 'eye');
    $('#cHide').title = snap.hideResults ? 'Show results (H)' : 'Hide results (H)';
    $('#cHide').classList.toggle('hidden', !votable);
    $('#cHide').classList.toggle('on', !!snap.hideResults);
    $('#cPhones').classList.toggle('on', !!snap.showOnPhones);
    $('#cReset').classList.toggle('hidden', !votable || slide.type === 'quiz');
  }

  socket.on('host:state', s => { if (live && s.code === live.code) applySnapshot(s); });
  socket.on('host:results', r => {
    if (!snap) return;
    const slide = snap.deck.slides[snap.index];
    if (r.slideId !== slide.id) return;
    results = r.data;
    $('#pCount').textContent = r.participants;
    setResponders(r.responders);
    drawStage();
  });

  const EMO = { heart: '❤️', like: '👍', laugh: '😂', wow: '😮', clap: '👏' };
  socket.on('host:reactions', list => {
    const layer = $('#reactions');
    if (!Array.isArray(list)) return;
    if (layer.childElementCount > 40) return;          // keep the screen readable during a reaction storm
    list.slice(0, 12).forEach((r, i) => {
      const e = document.createElement('div');
      e.className = 'reaction';
      e.innerHTML = `<span class="r-emo">${EMO[r.e] || '✨'}</span><span class="r-name">${esc(r.n || 'Guest')}</span>`;
      e.style.left = (66 + Math.random() * 26) + '%';
      e.style.setProperty('--dx', (Math.random() * 110 - 55) + 'px');
      e.style.setProperty('--rot', (Math.random() * 16 - 8) + 'deg');
      e.style.animationDelay = (i * 0.12 + Math.random() * 0.2) + 's';
      layer.appendChild(e);
      setTimeout(() => e.remove(), 4600);
    });
  });

  let revealArmed = 0;
  function quizStep() {
    const s = snap.deck.slides[snap.index];
    if (s.type !== 'quiz') return false;
    const st = snap.slideState[s.id] || {};
    if (!st.startedAt) { socket.emit('host:quizStart'); return true; }
    if (!st.revealed) {
      if (Date.now() - revealArmed < 2500) { socket.emit('host:quizReveal'); revealArmed = 0; }
      else { revealArmed = Date.now(); toast('Quiz is running — press Next again to reveal early'); }
      return true;
    }
    if (!st.showBoard) { socket.emit('host:quizBoard', { show: true }); return true; }
    return false;
  }
  const go = d => {
    if (!snap) return;
    if (d > 0 && quizStep()) return;
    const i = snap.index + d;
    if (i >= 0 && i < snap.deck.slides.length) socket.emit('host:goto', { index: i });
  };
  $('#cPrev').onclick = () => go(-1);
  $('#cNext').onclick = () => go(1);
  $('#cOpen').onclick = () => { const s = snap.deck.slides[snap.index]; socket.emit('host:setOpen', { open: !snap.slideState[s.id].open }); };
  $('#cHide').onclick = () => socket.emit('host:hideResults', { hide: !snap.hideResults });
  $('#cPhones').onclick = () => { socket.emit('host:phones', { show: !snap.showOnPhones }); toast(!snap.showOnPhones ? 'Results now visible on phones' : 'Results hidden on phones'); };
  $('#cQuiz').onclick = () => {
    const s = snap.deck.slides[snap.index], st = snap.slideState[s.id] || {};
    if (st.revealed && !confirm('Run this question again? Its points will be cleared.')) return;
    socket.emit('host:quizStart');
  };
  $('#cReset').onclick = () => { if (confirm('Clear all responses on this slide?')) socket.emit('host:reset'); };
  $('#cExport').onclick = () => window.open(`/api/export/${live.code}?token=${live.hostToken}`, '_blank');
  $('#cFull').onclick = toggleFull;
  $('#cEnd').onclick = () => {
    if (!confirm('End this live session? Participants will be disconnected. Export results first if you need them.')) return;
    const deckId = live.deckId;
    socket.emit('host:end', {}, r => {
      if (!r || !r.summary || !deckId) return;
      const all = store.get('tickbox.results', {}); all[deckId] = r.summary; store.set('tickbox.results', all);
    });
    closePresent();
    toast('Session ended');
  };

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  function showBigQR() {
    if (!live) return;
    const el = document.createElement('div');
    el.className = 'qr-big';
    el.innerHTML = `<div class="inner"><img src="${$('#qrSmall').src}" alt="QR code"><div class="url">Go to <b>${esc(location.host)}/join</b> and enter</div><div class="code">${prettyCode(live.code)}</div></div>`;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }
  $('#joinbar').onclick = showBigQR;
  $('#cQR').onclick = showBigQR;
  document.addEventListener('click', e => { const m = $('#pTypeMenu'); if (m && !e.target.closest('.dd')) m.classList.add('hidden'); });

  function poke() {
    const p = $('#present'); p.classList.remove('idle');
    clearTimeout(idleT); idleT = setTimeout(() => p.classList.add('idle'), 3500);
  }
  document.addEventListener('mousemove', () => { if (live) poke(); });
  $('#controls').addEventListener('mouseenter', () => clearTimeout(idleT));
  window.TBViz.hydrateIcons();

  document.addEventListener('keydown', e => {
    if (!live || e.target.matches('input, textarea, select')) return;
    const big = document.querySelector('.qr-big');
    if (e.key === 'Escape' && big) { big.remove(); return; }
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1); }
    else if (e.key.toLowerCase() === 'h') $('#cHide').click();
    else if (e.key.toLowerCase() === 'q') { if (big) big.remove(); else showBigQR(); }
    else if (e.key.toLowerCase() === 'f') toggleFull();
  });

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      ['#presentStage', '#previewStage'].forEach(id => { const el = $(id); if (el._tb) el._tb.sig = null; });
      if (deck) deck.slides.forEach((_, i) => renderThumb(i));
      if (pvIndex >= 0) drawPv();
      if (snap) { $('#presentStage')._tb = null; drawStage(); }
      $('#previewStage')._tb = null; renderPreview();
    }, 200);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { $('#previewStage')._tb = null; renderPreview(); if (snap) { $('#presentStage')._tb = null; drawStage(); } });

  void oldDecksModal;
  if (deck) openDeck(deck); else showHome();
})();
