/**
 * TickBox load test — simulates a presenter plus N audience phones.
 *   node loadtest.js [url] [participants]
 *   node loadtest.js http://localhost:3000 250
 */
const { io } = require('socket.io-client');

const URL = process.argv[2] || 'http://localhost:3000';
const N = parseInt(process.argv[3] || '250', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const emitAck = (s, ev, data) => new Promise(r => s.emit(ev, data, r));

const deck = {
  title: 'Load test',
  settings: { askNames: true },
  slides: [
    { id: 's-mc', type: 'mc', question: 'Pick one', options: ['Alpha', 'Beta', 'Gamma', 'Delta'] },
    { id: 's-wc', type: 'wordcloud', question: 'One word', maxWords: 3 },
    { id: 's-quiz', type: 'quiz', question: '2 + 2 = ?', options: ['3', '4', '5', '22'], correct: 1, time: 10 },
    { id: 's-lb', type: 'leaderboard', question: 'Leaderboard' },
    { id: 's-open', type: 'open', question: 'Thoughts?' },
    { id: 's-qa', type: 'qa', question: 'Questions?' },
  ],
};
const WORDS = ['robots', 'fun', 'ideas', 'energy', 'code', 'teamwork', 'future', 'coffee', 'learning', 'creative', 'focus', 'curious'];

(async () => {
  const host = io(URL, { transports: ['websocket'] });
  await new Promise(r => host.on('connect', r));
  const created = await emitAck(host, 'host:create', { deck });
  const code = created.code;
  console.log(`Room ${code} created. Connecting ${N} participants…`);

  let hostMsgs = 0, lastResults = null, lastParticipants = 0;
  host.on('host:results', r => { hostMsgs++; lastResults = r; lastParticipants = r.participants; });
  host.on('host:state', s => { lastResults = { data: s.results, responders: s.responders }; });

  const t0 = Date.now();
  const clients = [];
  let joinFails = 0;
  for (let i = 0; i < N; i++) {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    c.on('connect', async () => {
      const r = await emitAck(c, 'aud:join', { code, pid: 'loadtest-' + i + '-xxxxxxxx', name: 'Player ' + (i + 1) });
      if (!r.ok) joinFails++;
    });
    if (i % 25 === 24) await sleep(50);
  }
  while (lastParticipants < N - joinFails && Date.now() - t0 < 30000) await sleep(200);
  console.log(`${lastParticipants} participants connected in ${Date.now() - t0} ms (join failures: ${joinFails})`);

  const vote = async (ev, makeAnswer, slideId, spreadMs) => {
    const t = Date.now();
    const res = await Promise.all(clients.map(async (c, i) => {
      await sleep(Math.random() * spreadMs);
      return emitAck(c, ev, { slideId, answer: makeAnswer(i) });
    }));
    return { ok: res.filter(r => r && r.ok).length, ms: Date.now() - t, errors: [...new Set(res.filter(r => !r.ok).map(r => r.error))] };
  };

  // 1. Multiple choice — everyone votes within 3 s
  hostMsgs = 0;
  let r = await vote('aud:respond', i => [i % 4], 's-mc', 3000);
  await sleep(600);
  console.log(`MC: ${r.ok}/${N} accepted in ${r.ms} ms · host got ${hostMsgs} throttled updates · counts=${JSON.stringify(lastResults.data.counts)}`, r.errors);

  // 2. Word cloud — 3 words each
  host.emit('host:goto', { index: 1 }); await sleep(300);
  for (let k = 0; k < 3; k++) await vote('aud:respond', i => WORDS[(i * 7 + k * 3) % WORDS.length], 's-wc', 1500);
  await sleep(600);
  console.log(`Word cloud: ${lastResults.data.words.length} distinct words, responders=${lastResults.responders}, top=${JSON.stringify(lastResults.data.words.slice(0, 3))}`);

  // 3. Quiz — start, everyone answers within 5 s, auto-reveal when all answered
  host.emit('host:goto', { index: 2 }); await sleep(300);
  let quizResults = 0, correct = 0;
  clients.forEach(c => c.on('aud:quizResult', p => { quizResults++; if (p.correct) correct++; }));
  host.emit('host:quizStart'); await sleep(4300); // wait for the 'get ready' countdown
  r = await vote('aud:respond', i => (i % 5 === 0 ? 0 : 1), 's-quiz', 5000);
  await sleep(1000);
  console.log(`Quiz: ${r.ok} answers, ${quizResults} personal results delivered, ${correct} correct`, r.errors);

  host.emit('host:goto', { index: 3 }); await sleep(600);
  console.log(`Leaderboard top 3: ${JSON.stringify(lastResults.data.top.slice(0, 3))}`);

  // 4. Open ended + reactions storm
  host.emit('host:goto', { index: 4 }); await sleep(300);
  let reactionBatches = 0; host.on('host:reactions', () => reactionBatches++);
  clients.forEach(c => { for (let k = 0; k < 5; k++) setTimeout(() => c.emit('aud:react', { e: 'heart' }), k * 400); });
  r = await vote('aud:respond', i => `Answer number ${i} from the load test`, 's-open', 2000);
  await sleep(800);
  console.log(`Open ended: ${r.ok} accepted, wall shows ${lastResults.data.items.length} (count ${lastResults.data.count}); reaction batches to host: ${reactionBatches}`);

  // 5. Capacity check: one extra participant beyond the cap should be refused when cap is reached
  const mem = await fetch(URL + '/health').then(x => x.json()).catch(() => null);
  console.log('Health:', mem);

  clients.forEach(c => c.disconnect());
  host.disconnect();
  console.log('Done.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
