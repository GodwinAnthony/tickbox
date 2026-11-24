/**
 * TickBox — free, self-hosted live polling & quiz platform.
 * Express serves the pages, Socket.IO carries the live traffic.
 * All session data lives in memory (no database needed).
 */
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '300', 10);
const ROOM_IDLE_MS = 8 * 60 * 60 * 1000; // rooms are removed after 8 idle hours
const HOST_FLUSH_MS = 200;               // presenter screen refresh rate
const AUD_FLUSH_MS = 1000;               // phone result refresh rate
const QUIZ_READY_MS = 4000;              // 'get ready' countdown before quiz answers appear

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e6,
  perMessageDeflate: false,
  pingInterval: 20000,
  pingTimeout: 25000,
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

app.get('/api/qr', async (req, res) => {
  try {
    const text = String(req.query.text || '').slice(0, 400);
    const svg = await QRCode.toString(text, {
      type: 'svg', margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#17132B', light: '#FFFFFF' },
    });
    res.set('Cache-Control', 'public, max-age=86400').type('image/svg+xml').send(svg);
  } catch (e) {
    res.status(400).send('bad qr');
  }
});

app.get('/api/room/:code', (req, res) => {
  const room = rooms.get(String(req.params.code));
  if (!room || room.ended) return res.status(404).json({ ok: false });
  res.json({ ok: true, title: room.deck.title, askNames: needsNames(room) });
});

app.get('/api/export/:code', (req, res) => {
  const room = rooms.get(String(req.params.code));
  if (!room || req.query.token !== room.hostToken) return res.status(403).send('Not allowed');
  const rows = [['Slide #', 'Type', 'Question', 'Participant', 'Response', 'Quiz points']];
  room.deck.slides.forEach((s, i) => {
    const resp = room.responses[s.id];
    if (s.type === 'qa') {
      (room.qa[s.id] || []).forEach(q => rows.push([i + 1, s.type, s.question, nameOf(room, q.pid), q.text + ` (${q.votes.size} upvotes)`, '']));
      return;
    }
    if (!resp) return;
    for (const [pid, val] of resp) {
      const pts = room.quizPoints[s.id] ? (room.quizPoints[s.id].get(pid) || 0) : '';
      rows.push([i + 1, s.type, s.question, nameOf(room, pid), describeAnswer(s, val), pts]);
    }
  });
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  res.set('Content-Disposition', `attachment; filename="tickbox-${room.code}.csv"`).type('text/csv').send('﻿' + csv);
});

app.get('/join/:code', (req, res) => res.redirect('/join?code=' + encodeURIComponent(req.params.code)));

/* ------------------------------------------------------------------ */
/* Deck sanitising                                                     */
/* ------------------------------------------------------------------ */
const TYPES = ['mc', 'wordcloud', 'open', 'scale', 'ranking', 'quiz', 'qa', 'leaderboard', 'lobby', 'content'];
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').slice(0, max);
const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

function sanitizeDeck(d) {
  d = d && typeof d === 'object' ? d : {};
  const out = {
    title: str(d.title || 'Untitled presentation', 120),
    settings: {
      askNames: !!(d.settings && d.settings.askNames),
      theme: ['light', 'white', 'dark', 'midnight'].includes(d.settings && d.settings.theme) ? d.settings.theme : 'light',
    },
    slides: [],
  };
  const seen = new Set();
  (Array.isArray(d.slides) ? d.slides.slice(0, 60) : []).forEach(s => {
    if (!s || !TYPES.includes(s.type)) return;
    let id = str(s.id, 64) || crypto.randomUUID();
    if (seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    const o = { id, type: s.type, question: str(s.question, 300), body: str(s.body, 800) };
    const opts = (Array.isArray(s.options) ? s.options : []).slice(0, 10).map(x => str(x, 120)).filter(x => x.trim());
    switch (s.type) {
      case 'mc':
        o.options = opts.length ? opts : ['Option 1', 'Option 2'];
        o.multiple = !!s.multiple;
        break;
      case 'quiz':
        o.options = opts.length >= 2 ? opts.slice(0, 6) : ['Answer A', 'Answer B'];
        o.correct = clampInt(s.correct, 0, o.options.length - 1, 0);
        o.time = clampInt(s.time, 5, 120, 20);
        break;
      case 'ranking':
        o.options = opts.length >= 2 ? opts : ['Item 1', 'Item 2'];
        break;
      case 'scale': {
        const st = (Array.isArray(s.statements) ? s.statements : []).slice(0, 8).map(x => str(x, 120)).filter(x => x.trim());
        o.statements = st.length ? st : ['Statement'];
        o.max = clampInt(s.max, 3, 10, 5);
        o.minLabel = str(s.minLabel || 'Strongly disagree', 40);
        o.maxLabel = str(s.maxLabel || 'Strongly agree', 40);
        break;
      }
      case 'wordcloud':
        o.maxWords = clampInt(s.maxWords, 1, 5, 3);
        break;
      case 'open':
        o.maxPerPerson = clampInt(s.maxPerPerson, 1, 10, 1);
        break;
    }
    out.slides.push(o);
  });
  if (!out.slides.length) out.slides.push({ id: crypto.randomUUID(), type: 'content', question: out.title, body: '' });
  return out;
}

function needsNames(room) {
  return room.deck.settings.askNames || room.deck.slides.some(s => ['quiz', 'leaderboard', 'lobby'].includes(s.type));
}

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */
const rooms = new Map();

function newCode() {
  let c;
  do { c = String(crypto.randomInt(100000, 1000000)); } while (rooms.has(c));
  return c;
}

function createRoom(deck) {
  const room = {
    code: newCode(),
    hostToken: crypto.randomBytes(18).toString('hex'),
    deck,
    index: 0,
    slideState: {},       // slideId -> { open, startedAt, endsAt, revealed }
    responses: {},        // slideId -> Map(pid -> value)
    quizPoints: {},       // slideId -> Map(pid -> points)
    qa: {},               // slideId -> [{ id, text, pid, votes:Set, answered, t }]
    hidden: {},           // slideId -> Set(item ids) hidden by presenter
    participants: new Map(), // pid -> { name, sockets:Set, joinedAt, lastReact }
    guestNo: 0,
    showOnPhones: false,
    hideResults: false,
    ended: false,
    createdAt: Date.now(),
    lastActive: Date.now(),
    dirtyHost: true,
    dirtyAud: false,
    lastAudFlush: 0,
    reactions: {},
    quizTimer: null,
    quizGoTimer: null,
    boards: {},           // slideId -> leaderboard snapshot taken at reveal
    lastPrevRank: new Map(),
    lastGain: new Map(),
  };
  deck.slides.forEach(s => { room.slideState[s.id] = { open: true }; });
  rooms.set(room.code, room);
  return room;
}

const currentSlide = room => room.deck.slides[room.index];
const connectedCount = room => { let n = 0; for (const p of room.participants.values()) if (p.sockets.size) n++; return n; };
const nameOf = (room, pid) => (room.participants.get(pid) || {}).name || 'Guest';

function describeAnswer(s, v) {
  switch (s.type) {
    case 'mc': return v.map(i => s.options[i]).join(' | ');
    case 'quiz': return s.options[v] + (v === s.correct ? ' (correct)' : ' (wrong)');
    case 'ranking': return v.map((i, r) => `${r + 1}. ${s.options[i]}`).join(' | ');
    case 'scale': return v.map((n, i) => `${s.statements[i]}: ${n}`).join(' | ');
    case 'wordcloud': return v.join(', ');
    case 'open': return v.map(x => x.text).join(' | ');
    default: return JSON.stringify(v);
  }
}

/* ------------------------------------------------------------------ */
/* Answer validation                                                   */
/* ------------------------------------------------------------------ */
const cleanWord = w => str(w, 40).replace(/\s+/g, ' ').trim();

function validateAnswer(slide, ans, prev, st) {
  switch (slide.type) {
    case 'mc': {
      if (prev) return { error: 'You have already voted' };
      let arr = (Array.isArray(ans) ? ans : [ans]).map(Number)
        .filter(n => Number.isInteger(n) && n >= 0 && n < slide.options.length);
      arr = [...new Set(arr)];
      if (!arr.length) return { error: 'Pick an option' };
      if (!slide.multiple) arr = arr.slice(0, 1);
      return { value: arr };
    }
    case 'quiz': {
      if (prev !== undefined) return { error: 'Answer already locked in' };
      if (!st.startedAt) return { error: 'The question has not started yet' };
      if (Date.now() < st.startedAt - 250) return { error: 'Wait for the answers to appear!' };
      if (st.revealed || Date.now() > st.endsAt + 600) return { error: 'Time is up!' };
      const n = Number(ans);
      if (!Number.isInteger(n) || n < 0 || n >= slide.options.length) return { error: 'Pick an answer' };
      return { value: n };
    }
    case 'wordcloud': {
      const have = prev || [];
      if (have.length >= slide.maxWords) return { error: 'You have used all your words' };
      const words = (Array.isArray(ans) ? ans : [ans]).map(cleanWord).filter(Boolean);
      if (!words.length) return { error: 'Type a word' };
      return { value: have.concat(words).slice(0, slide.maxWords) };
    }
    case 'open': {
      const have = prev || [];
      if (have.length >= slide.maxPerPerson) return { error: 'You have already answered' };
      const text = str(ans, 280).trim();
      if (!text) return { error: 'Write something first' };
      return { value: have.concat([{ id: crypto.randomBytes(5).toString('hex'), text, t: Date.now() }]) };
    }
    case 'scale': {
      if (prev) return { error: 'You have already answered' };
      if (!Array.isArray(ans) || ans.length !== slide.statements.length) return { error: 'Rate every statement' };
      const v = ans.map(Number);
      if (v.some(n => !Number.isInteger(n) || n < 1 || n > slide.max)) return { error: 'Invalid rating' };
      return { value: v };
    }
    case 'ranking': {
      if (prev) return { error: 'You have already answered' };
      const n = slide.options.length;
      if (!Array.isArray(ans) || ans.length !== n) return { error: 'Rank every item' };
      const v = ans.map(Number);
      if (new Set(v).size !== n || v.some(x => !Number.isInteger(x) || x < 0 || x >= n)) return { error: 'Invalid ranking' };
      return { value: v };
    }
    default:
      return { error: 'This slide does not take answers' };
  }
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */
function totalScores(room) {
  const tot = new Map();
  for (const m of Object.values(room.quizPoints)) for (const [pid, p] of m) tot.set(pid, (tot.get(pid) || 0) + p);
  return tot;
}

function computeResults(room, slide, forAudience = false) {
  const resp = room.responses[slide.id] || new Map();
  const st = room.slideState[slide.id];
  const total = resp.size;
  switch (slide.type) {
    case 'mc': {
      const counts = slide.options.map(() => 0);
      for (const v of resp.values()) v.forEach(i => counts[i]++);
      return { counts, total };
    }
    case 'quiz': {
      const counts = slide.options.map(() => 0);
      for (const v of resp.values()) counts[v]++;
      const now = Date.now();
      const out = {
        counts, total, started: !!st.startedAt, revealed: !!st.revealed,
        readyIn: st.startedAt ? Math.max(0, st.startedAt - now) : null,
        remaining: st.endsAt ? Math.max(0, st.endsAt - now) : null,
        players: connectedCount(room),
      };
      if (st.revealed) out.correct = slide.correct;
      if (st.showBoard) out.board = room.boards[slide.id] || [];
      return out;
    }
    case 'wordcloud': {
      const map = new Map();
      for (const v of resp.values()) for (const w of v) {
        const k = w.toLowerCase();
        const e = map.get(k);
        if (e) e.c++; else map.set(k, { w, c: 1, o: map.size });
      }
      const hidden = room.hidden[slide.id];
      const words = [...map.entries()].filter(([k]) => !hidden || !hidden.has(k))
        .map(([k, e]) => [e.w, e.c, e.o, k]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).slice(0, 90)
        .map(([w, c, , k]) => [w, c, k]);
      return { words, total };
    }
    case 'open': {
      const hidden = room.hidden[slide.id];
      const items = [];
      for (const [pid, v] of resp) for (const it of v) {
        if (hidden && hidden.has(it.id)) continue;
        items.push({ id: it.id, text: it.text, t: it.t, name: room.deck.settings.askNames ? nameOf(room, pid) : '' });
      }
      items.sort((a, b) => b.t - a.t);
      return { items: items.slice(0, forAudience ? 30 : 120), count: items.length, total };
    }
    case 'scale': {
      const stats = slide.statements.map(() => ({ sum: 0, n: 0, dist: Array(slide.max).fill(0) }));
      for (const v of resp.values()) v.forEach((x, i) => { stats[i].sum += x; stats[i].n++; stats[i].dist[x - 1]++; });
      return { stats: stats.map(s => ({ avg: s.n ? s.sum / s.n : null, dist: s.dist })), total };
    }
    case 'ranking': {
      const n = slide.options.length;
      const pts = Array(n).fill(0);
      for (const v of resp.values()) v.forEach((opt, rank) => { pts[opt] += n - rank; });
      const order = pts.map((p, i) => ({ i, p })).sort((a, b) => b.p - a.p || a.i - b.i);
      return { order, max: total * n, total };
    }
    case 'qa': {
      const items = (room.qa[slide.id] || [])
        .filter(q => !(room.hidden[slide.id] && room.hidden[slide.id].has(q.id)))
        .map(q => ({ id: q.id, text: q.text, votes: q.votes.size, answered: q.answered, t: q.t, name: room.deck.settings.askNames ? nameOf(room, q.pid) : '' }))
        .sort((a, b) => (a.answered - b.answered) || (b.votes - a.votes) || (a.t - b.t));
      return { items: items.slice(0, 80), total: items.length };
    }
    case 'leaderboard': {
      const top = boardData(room, room.lastPrevRank, room.lastGain);
      return { top, total: totalScores(room).size };
    }
    case 'lobby': {
      const names = [];
      for (const [pid, p] of room.participants) if (p.sockets.size) names.push({ id: shortId(pid), name: p.name, t: p.joinedAt });
      names.sort((a, b) => b.t - a.t);
      return { names: names.slice(0, 120), total: names.length };
    }
    default:
      return { total: 0 };
  }
}

const shortId = pid => crypto.createHash('sha1').update(pid).digest('hex').slice(0, 10);

function rankMap(tot) {
  const ranked = [...tot.entries()].sort((a, b) => b[1] - a[1]);
  return new Map(ranked.map(([pid], i) => [pid, i + 1]));
}

function boardData(room, prevRank, gain, limit = 10) {
  const tot = totalScores(room);
  return [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([pid, s], i) => ({
    id: shortId(pid), name: nameOf(room, pid), score: s,
    gain: gain ? (gain.get(pid) || 0) : 0,
    move: prevRank && prevRank.has(pid) ? prevRank.get(pid) - (i + 1) : null,
  }));
}

function respondersCount(room, slide) {
  if (slide.type === 'qa') return (room.qa[slide.id] || []).length;
  return (room.responses[slide.id] || new Map()).size;
}

/* ------------------------------------------------------------------ */
/* State payloads                                                      */
/* ------------------------------------------------------------------ */
function publicSlide(room, slide) {
  const st = room.slideState[slide.id];
  const s = { ...slide };
  if (slide.type === 'quiz' && !st.revealed) delete s.correct;
  return s;
}

function audState(room) {
  const slide = currentSlide(room);
  const st = room.slideState[slide.id];
  return {
    code: room.code,
    title: room.deck.title,
    index: room.index,
    total: room.deck.slides.length,
    slide: publicSlide(room, slide),
    open: st.open && !room.ended,
    quiz: slide.type === 'quiz' ? {
      started: !!st.startedAt, revealed: !!st.revealed, showBoard: !!st.showBoard,
      readyIn: st.startedAt ? Math.max(0, st.startedAt - Date.now()) : null,
      remaining: st.endsAt ? Math.max(0, st.endsAt - Date.now()) : null,
    } : null,
    showOnPhones: room.showOnPhones,
    ended: room.ended,
  };
}

function hostSnapshot(room) {
  const slide = currentSlide(room);
  return {
    code: room.code,
    deck: room.deck,
    index: room.index,
    slideState: room.slideState,
    showOnPhones: room.showOnPhones,
    hideResults: room.hideResults,
    participants: connectedCount(room),
    responders: respondersCount(room, slide),
    results: computeResults(room, slide),
    ended: room.ended,
  };
}

function myAnswers(room, pid) {
  const out = {};
  for (const [sid, m] of Object.entries(room.responses)) if (m.has(pid)) out[sid] = m.get(pid);
  const votes = {};
  for (const [sid, list] of Object.entries(room.qa)) votes[sid] = list.filter(q => q.votes.has(pid)).map(q => q.id);
  return { answers: out, qaVotes: votes };
}

function broadcastState(room) {
  io.to('aud:' + room.code).emit('aud:state', audState(room));
  io.to('host:' + room.code).emit('host:state', hostSnapshot(room));
  room.dirtyAud = true;
}

/* ------------------------------------------------------------------ */
/* Quiz timing                                                         */
/* ------------------------------------------------------------------ */
function startQuiz(room) {
  const slide = currentSlide(room);
  if (slide.type !== 'quiz') return;
  const st = room.slideState[slide.id];
  if (st.startedAt && !st.revealed) return;
  room.responses[slide.id] = new Map();
  room.quizPoints[slide.id] = new Map();
  room.quizAnswerTimes = room.quizAnswerTimes || {};
  room.quizAnswerTimes[slide.id] = new Map();
  st.startedAt = Date.now() + QUIZ_READY_MS;   // answers appear after the countdown; points are timed from here
  st.endsAt = st.startedAt + slide.time * 1000;
  st.revealed = false;
  st.showBoard = false;
  st.open = true;
  clearTimeout(room.quizTimer); clearTimeout(room.quizGoTimer);
  room.quizGoTimer = setTimeout(() => broadcastState(room), QUIZ_READY_MS);
  room.quizTimer = setTimeout(() => revealQuiz(room, slide.id), QUIZ_READY_MS + slide.time * 1000 + 300);
  broadcastState(room);
}

function revealQuiz(room, slideId) {
  const slide = room.deck.slides.find(s => s.id === slideId);
  const st = room.slideState[slideId];
  if (!slide || !st || st.revealed || !st.startedAt) return;
  clearTimeout(room.quizTimer); clearTimeout(room.quizGoTimer);
  st.revealed = true;
  st.open = false;
  st.endsAt = Math.min(st.endsAt, Date.now());
  const resp = room.responses[slideId] || new Map();
  const times = (room.quizAnswerTimes && room.quizAnswerTimes[slideId]) || new Map();
  room.quizPoints[slideId] = new Map();
  const prevRank = rankMap(totalScores(room));
  const pts = room.quizPoints[slideId];
  const dur = slide.time * 1000;
  for (const [pid, ans] of resp) {
    if (ans === slide.correct) {
      const used = Math.min(dur, Math.max(0, (times.get(pid) || st.startedAt) - st.startedAt));
      pts.set(pid, Math.round(1000 - 500 * (used / dur)));
    } else pts.set(pid, 0);
  }
  const tot = totalScores(room);
  const ranked = [...tot.entries()].sort((a, b) => b[1] - a[1]);
  const rankOf = new Map(ranked.map(([pid], i) => [pid, i + 1]));
  room.lastPrevRank = prevRank;
  room.lastGain = pts;
  room.boards[slideId] = boardData(room, prevRank, pts);
  broadcastState(room);
  for (const [pid, p] of room.participants) {
    const answered = resp.has(pid);
    const payload = {
      slideId,
      answered,
      correct: answered && resp.get(pid) === slide.correct,
      points: pts.get(pid) || 0,
      total: tot.get(pid) || 0,
      rank: rankOf.get(pid) || null,
      move: prevRank.has(pid) && rankOf.has(pid) ? prevRank.get(pid) - rankOf.get(pid) : null,
      of: ranked.length,
    };
    for (const sid of p.sockets) io.to(sid).emit('aud:quizResult', payload);
  }
}

/* ------------------------------------------------------------------ */
/* Sockets                                                             */
/* ------------------------------------------------------------------ */
function hostRoom(socket) {
  const room = socket.data.hostCode && rooms.get(socket.data.hostCode);
  if (room) room.lastActive = Date.now();
  return room;
}

io.on('connection', socket => {
  /* ---------- presenter ---------- */
  socket.on('host:create', (payload, cb) => {
    if (typeof cb !== 'function') return;
    const deck = sanitizeDeck(payload && payload.deck);
    const room = createRoom(deck);
    socket.join('host:' + room.code);
    socket.data.hostCode = room.code;
    cb({ ok: true, code: room.code, hostToken: room.hostToken, snapshot: hostSnapshot(room) });
  });

  socket.on('host:resume', (payload, cb) => {
    if (typeof cb !== 'function') return;
    const room = rooms.get(String(payload && payload.code));
    if (!room || room.hostToken !== (payload && payload.hostToken) || room.ended) return cb({ ok: false });
    socket.join('host:' + room.code);
    socket.data.hostCode = room.code;
    room.lastActive = Date.now();
    cb({ ok: true, snapshot: hostSnapshot(room) });
  });

  socket.on('host:goto', p => {
    const room = hostRoom(socket); if (!room) return;
    const i = clampInt(p && p.index, 0, room.deck.slides.length - 1, room.index);
    if (i === room.index) return;
    room.index = i;
    broadcastState(room);
  });

  socket.on('host:setOpen', p => {
    const room = hostRoom(socket); if (!room) return;
    room.slideState[currentSlide(room).id].open = !!(p && p.open);
    broadcastState(room);
  });

  socket.on('host:phones', p => {
    const room = hostRoom(socket); if (!room) return;
    room.showOnPhones = !!(p && p.show);
    broadcastState(room);
  });

  socket.on('host:hideResults', p => {
    const room = hostRoom(socket); if (!room) return;
    room.hideResults = !!(p && p.hide);
    io.to('host:' + room.code).emit('host:state', hostSnapshot(room));
  });

  socket.on('host:quizStart', () => { const room = hostRoom(socket); if (room) startQuiz(room); });
  socket.on('host:quizReveal', () => { const room = hostRoom(socket); if (room) revealQuiz(room, currentSlide(room).id); });
  socket.on('host:quizBoard', p => {
    const room = hostRoom(socket); if (!room) return;
    const slide = currentSlide(room), st = room.slideState[slide.id];
    if (slide.type !== 'quiz' || !st.revealed) return;
    st.showBoard = p ? !!p.show : true;
    broadcastState(room);
  });

  socket.on('host:reset', () => {
    const room = hostRoom(socket); if (!room) return;
    const slide = currentSlide(room);
    delete room.responses[slide.id];
    delete room.quizPoints[slide.id];
    delete room.hidden[slide.id];
    room.qa[slide.id] = [];
    room.slideState[slide.id] = { open: true };
    if (slide.type === 'quiz') { clearTimeout(room.quizTimer); clearTimeout(room.quizGoTimer); delete room.boards[slide.id]; }
    broadcastState(room);
    io.to('aud:' + room.code).emit('aud:reset', { slideId: slide.id });
  });

  socket.on('host:hide', p => {
    const room = hostRoom(socket); if (!room || !p) return;
    const slide = currentSlide(room);
    (room.hidden[slide.id] = room.hidden[slide.id] || new Set()).add(str(p.id, 80));
    room.dirtyHost = room.dirtyAud = true;
  });

  socket.on('host:qaAnswered', p => {
    const room = hostRoom(socket); if (!room || !p) return;
    const list = room.qa[currentSlide(room).id] || [];
    const q = list.find(x => x.id === p.id);
    if (q) { q.answered = !!p.answered; room.dirtyHost = room.dirtyAud = true; }
  });

  socket.on('host:end', () => {
    const room = hostRoom(socket); if (!room) return;
    room.ended = true;
    clearTimeout(room.quizTimer);
    broadcastState(room);
  });

  /* ---------- audience ---------- */
  socket.on('aud:join', (p, cb) => {
    if (typeof cb !== 'function') return;
    const room = rooms.get(String(p && p.code));
    if (!room || room.ended) return cb({ ok: false, error: 'No live presentation with that code.' });
    let pid = str(p.pid, 64);
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(pid)) pid = crypto.randomUUID();
    let part = room.participants.get(pid);
    if (!part) {
      if (connectedCount(room) >= MAX_PARTICIPANTS) return cb({ ok: false, error: 'This session is full.' });
      const nm = str(p.name, 30).trim();
      part = { name: nm || `Guest ${++room.guestNo}`, sockets: new Set(), joinedAt: Date.now(), lastReact: 0, lastQa: 0 };
      room.participants.set(pid, part);
    } else if (p.name && str(p.name, 30).trim()) {
      part.name = str(p.name, 30).trim();
    }
    part.sockets.add(socket.id);
    socket.data.code = room.code;
    socket.data.pid = pid;
    socket.join('aud:' + room.code);
    room.dirtyHost = true;
    if (currentSlide(room).type === 'lobby') room.dirtyAud = true;
    const mine = myAnswers(room, pid);
    const slide = currentSlide(room);
    cb({
      ok: true, pid, name: part.name, state: audState(room), ...mine,
      results: (room.showOnPhones || slide.type === 'qa') ? { slideId: slide.id, data: computeResults(room, slide, true) } : null,
    });
  });

  function audCtx() {
    const room = rooms.get(socket.data.code);
    const pid = socket.data.pid;
    if (!room || !pid || !room.participants.has(pid)) return null;
    return { room, pid, part: room.participants.get(pid) };
  }

  socket.on('aud:respond', (p, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const ctx = audCtx(); if (!ctx) return cb({ ok: false, error: 'Not connected' });
    const { room, pid } = ctx;
    if (room.ended) return cb({ ok: false, error: 'The presentation has ended' });
    const slide = currentSlide(room);
    if (!p || p.slideId !== slide.id) return cb({ ok: false, error: 'The presenter has moved on' });
    const st = room.slideState[slide.id];
    if (!st.open && slide.type !== 'quiz') return cb({ ok: false, error: 'Voting is closed' });
    const map = room.responses[slide.id] = room.responses[slide.id] || new Map();
    const res = validateAnswer(slide, p.answer, map.get(pid), st);
    if (res.error) return cb({ ok: false, error: res.error });
    map.set(pid, res.value);
    if (slide.type === 'quiz') room.quizAnswerTimes[slide.id].set(pid, Date.now());
    room.dirtyHost = room.dirtyAud = true;
    room.lastActive = Date.now();
    cb({ ok: true, value: res.value });
    if (slide.type === 'quiz' && map.size >= connectedCount(room)) revealQuiz(room, slide.id);
  });

  socket.on('aud:react', p => {
    const ctx = audCtx(); if (!ctx) return;
    const now = Date.now();
    if (now - ctx.part.lastReact < 350) return;
    ctx.part.lastReact = now;
    const e = ['heart', 'like', 'laugh', 'wow', 'clap'].includes(p && p.e) ? p.e : null;
    if (!e) return;
    ctx.room.reactions[e] = (ctx.room.reactions[e] || 0) + 1;
  });

  socket.on('aud:qaAsk', (p, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const ctx = audCtx(); if (!ctx) return cb({ ok: false });
    const { room, pid, part } = ctx;
    const slide = currentSlide(room);
    if (slide.type !== 'qa' || !p || p.slideId !== slide.id) return cb({ ok: false, error: 'Q&A is not open' });
    if (!room.slideState[slide.id].open) return cb({ ok: false, error: 'Q&A is closed' });
    const text = str(p.text, 240).trim();
    if (!text) return cb({ ok: false, error: 'Type a question' });
    if (Date.now() - part.lastQa < 5000) return cb({ ok: false, error: 'Please wait a few seconds' });
    part.lastQa = Date.now();
    const list = room.qa[slide.id] = room.qa[slide.id] || [];
    if (list.length >= 500) return cb({ ok: false, error: 'Question limit reached' });
    const q = { id: crypto.randomBytes(5).toString('hex'), text, pid, votes: new Set([pid]), answered: false, t: Date.now() };
    list.push(q);
    room.dirtyHost = room.dirtyAud = true;
    cb({ ok: true, id: q.id });
  });

  socket.on('aud:qaVote', p => {
    const ctx = audCtx(); if (!ctx || !p) return;
    const slide = currentSlide(ctx.room);
    if (slide.type !== 'qa') return;
    const q = (ctx.room.qa[slide.id] || []).find(x => x.id === p.id);
    if (!q) return;
    if (p.up) q.votes.add(ctx.pid); else q.votes.delete(ctx.pid);
    ctx.room.dirtyHost = ctx.room.dirtyAud = true;
  });

  socket.on('disconnect', () => {
    const room = socket.data.code && rooms.get(socket.data.code);
    if (room && socket.data.pid) {
      const part = room.participants.get(socket.data.pid);
      if (part) part.sockets.delete(socket.id);
      room.dirtyHost = true;
    }
  });
});

/* ------------------------------------------------------------------ */
/* Throttled broadcasting — keeps 250+ voters smooth                   */
/* ------------------------------------------------------------------ */
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const slide = currentSlide(room);
    if (room.dirtyHost) {
      room.dirtyHost = false;
      io.to('host:' + room.code).emit('host:results', {
        slideId: slide.id,
        data: computeResults(room, slide),
        participants: connectedCount(room),
        responders: respondersCount(room, slide),
      });
    }
    const keys = Object.keys(room.reactions);
    if (keys.length) {
      io.to('host:' + room.code).emit('host:reactions', room.reactions);
      room.reactions = {};
    }
    if (room.dirtyAud && now - room.lastAudFlush >= AUD_FLUSH_MS) {
      room.dirtyAud = false;
      room.lastAudFlush = now;
      if (room.showOnPhones || slide.type === 'qa') {
        io.to('aud:' + room.code).emit('aud:results', { slideId: slide.id, data: computeResults(room, slide, true) });
      }
    }
  }
}, HOST_FLUSH_MS);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActive > ROOM_IDLE_MS || (room.ended && now - room.lastActive > 30 * 60 * 1000)) {
      clearTimeout(room.quizTimer);
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000);

server.listen(PORT, () => console.log(`TickBox running on http://localhost:${PORT} (max ${MAX_PARTICIPANTS} participants per session)`));
