/* ============================================================
   TickBox presenter: slide editor + live presentation mode
   ============================================================ */
(function () {
  const { render, demoData, COLORS, TYPE_META, esc, icon } = window.TBViz;
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

  function showHome() {
    flushSave();
    deck = null;
    history.replaceState(null, '', location.pathname);
    $('#editor').classList.add('hidden');
    $('#home').classList.remove('hidden');
    document.title = 'TickBox — Presentations';
    const tpls = TEMPLATES.map(t => ({ t, d: t.make() }));
    $('#tplGrid').innerHTML = tpls.map(({ t, d }, k) => `
      <button class="tpl-card" data-tpl="${k}">
        ${miniThumb(d, t.show)}
        <span class="tpl-meta"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small><span class="tpl-count">${d.slides.length} slides</span></span>
      </button>`).join('');
    paintThumbs($('#tplGrid'), tpls.map(({ t, d }) => ({ d, i: t.show })));
    $('#tplGrid').querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => openDeck(TEMPLATES[+b.dataset.tpl].make()));

    const list = Object.values(decks).sort((a, b) => b.updated - a.updated);
    $('#deckGrid').innerHTML = list.length ? list.map(d => `
      <div class="deck-card" data-id="${d.id}" tabindex="0">
        ${miniThumb(d, 0)}
        <div class="dc-meta"><b>${esc(d.title || 'Untitled')}</b><small>${d.slides.length} slide${d.slides.length === 1 ? '' : 's'} · edited ${ago(d.updated)}</small></div>
        <div class="dc-actions">
          <button class="ibtn" data-act="dup" title="Duplicate">${icon('copy')}</button>
          <button class="ibtn" data-act="export" title="Download .json">${icon('download')}</button>
          <button class="ibtn danger" data-act="del" title="Delete">${icon('trash')}</button>
        </div>
      </div>`).join('') : `<div class="deck-empty">${icon('folder', 'big')}<br>No presentations yet — start from scratch or pick a template above.</div>`;
    paintThumbs($('#deckGrid'), list.map(d => ({ d, i: 0 })));
    $('#deckGrid').querySelectorAll('.deck-card').forEach(card => {
      const d = decks[card.dataset.id];
      card.onclick = e => {
        const act = e.target.closest('[data-act]');
        if (!act) return openDeck(d);
        e.stopPropagation();
        if (act.dataset.act === 'dup') {
          const c = JSON.parse(JSON.stringify(d)); c.id = uid(); c.title = d.title + ' (copy)'; c.updated = Date.now();
          c.slides.forEach(s => { s.id = uid(); });
          decks[c.id] = c; flushSave(); showHome(); toast('Duplicated');
        } else if (act.dataset.act === 'export') exportDeck(d);
        else if (act.dataset.act === 'del') {
          if (!confirm('Delete "' + (d.title || 'Untitled') + '"? This cannot be undone.')) return;
          delete decks[d.id]; flushSave(); showHome();
        }
      };
      card.onkeydown = e => { if (e.key === 'Enter') openDeck(d); };
    });
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
        h += `<div class="field"><label>Time limit</label><select class="input" id="pTime">${[5, 10, 15, 20, 30, 45, 60, 90].map(t => `<option value="${t}" ${s.time === t ? 'selected' : ''}>${t} seconds</option>`).join('')}</select></div>
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
        h += `<p class="hint">Top 10 with animated bars, then a crown and confetti for the winner. Each quiz question also shows its own leaderboard after the answer.</p>`;
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
      <div style="margin-top:10px;text-align:right"><button class="btn primary" id="bAdd" disabled>Add questions</button></div>`);
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

  function openTypePicker() {
    const m = modal(`<h3>Add a slide</h3><div class="type-grid">${Object.entries(TYPE_META).map(([t, x]) => `<button class="type-card" data-t="${t}"><span class="t-ic t-${t}">${icon(t)}</span><b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div>
      <button class="link-btn" id="tBulk" style="margin-top:16px">${icon('paste')} Paste many quiz questions at once</button>`);
    m.querySelector('#tBulk').onclick = () => { m.remove(); openBulk(); };
    m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      deck.slides.splice(sel + 1, 0, newSlide(b.dataset.t)); sel++; save(); renderAll(); m.remove();
      setTimeout(() => { const q = $('#pQ'); if (q) { q.focus(); q.select(); } }, 50);
    });
  }

  $('#btnDecks').onclick = () => showHome();
  $('#btnHome').onclick = () => showHome();
  $('#hBlank').onclick = () => openDeck(blankDeck(), () => setTimeout(() => { const q = $('#pQ'); if (q) q.focus(); }, 60));
  $('#hPaste').onclick = () => {
    const d = { id: uid(), title: 'My quiz', settings: { askNames: true, theme: 'light' }, updated: Date.now(), slides: [newSlide('lobby')] };
    openDeck(d, () => openBulk());
  };
  $('#hImportFile').onchange = e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; };
  const oldDecksModal = () => {
    const list = Object.values(decks).sort((a, b) => b.updated - a.updated);
    const m = modal(`<h3>My presentations</h3>
      <div class="deck-list">${list.map(d => `<div class="deck-item" data-id="${d.id}"><div class="meta"><b>${esc(d.title)}</b><small>${d.slides.length} slides · edited ${new Date(d.updated).toLocaleString()}</small></div>${d.id === deck.id ? '<span class="progress-mini">Open</span>' : ''}<button class="ibtn danger" data-del="${d.id}" title="Delete">${icon('trash')}</button></div>`).join('')}</div>
      <div class="row" style="margin-top:16px;flex-wrap:wrap">
        <button class="btn primary" id="mQuiz">${icon('quiz')} New quiz</button>
        <button class="btn" id="mNew">${icon('plus')} New blank</button>
        <button class="btn" id="mExport">${icon('download')} Export .json</button>
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
    deck.slides.splice(sel + 1, 0, newSlide(b.dataset.q)); sel++; panelTab = 'edit'; save(); renderAll();
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
  socket.on('host:reactions', counts => {
    const layer = $('#reactions');
    let budget = 14;
    Object.entries(counts).forEach(([k, n]) => {
      for (let i = 0; i < Math.min(n, 6) && budget > 0; i++, budget--) {
        const e = document.createElement('div');
        e.className = 'reaction';
        e.textContent = EMO[k] || '✨';
        e.style.left = (70 + Math.random() * 27) + '%';
        e.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
        e.style.setProperty('--rot', (Math.random() * 50 - 25) + 'deg');
        e.style.animationDelay = (Math.random() * 0.4) + 's';
        layer.appendChild(e);
        setTimeout(() => e.remove(), 4000);
      }
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
    socket.emit('host:end');
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
