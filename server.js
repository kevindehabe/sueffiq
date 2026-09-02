'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const Q = require('./questions');
const {
  voteSipMap,
  estimateResults,
  binaryMinority,
  majorityResults,
  scaleResults,
  matchPersonGuess,
} = require('./logic');

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CATS = {
  nie: 'Ich hab noch nie',
  wahl: 'Wahl',
  schaetz: 'Schätzfrage',
  oder: 'Entweder oder',
  trivia: 'Quiz',
  wahrheit: 'Wahrheit',
  pflicht: 'Pflicht',
  person: 'Errate die Person',
  mehrheit: 'Mehrheit',
  skala: 'Skala',
};

const CATEGORY_ORDER = Object.keys(CATS);
const WEIGHTS = {
  nie: 3,
  wahl: 3,
  schaetz: 3,
  oder: 2,
  trivia: 3,
  wahrheit: 2,
  pflicht: 2,
  person: 3,
  mehrheit: 2,
  skala: 2,
};

const ROUND_SECONDS = {
  nie: 30,
  wahl: 30,
  schaetz: 35,
  oder: 30,
  trivia: 30,
  wahrheit: 35,
  pflicht: 35,
  person: 45,
  mehrheit: 30,
  skala: 30,
};

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const uid = () => Math.random().toString(36).slice(2, 11);

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name, fallback = 'Spieler') {
  const value = String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 18);
  return value || fallback;
}

function createRoom() {
  const room = {
    code: makeCode(),
    hostId: null,
    players: {},
    order: [],
    phase: 'lobby',
    round: 0,
    current: null,
    lastResult: null,
    used: {},
    deck: [],
    lastCat: null,
    timers: [],
    createdAt: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

function connectedIds(room) {
  return room.order.filter((id) => room.players[id] && room.players[id].connected);
}

function displayName(room, id) {
  return room.players[id] ? room.players[id].name : 'Unbekannt';
}

function buildDeck(room) {
  let deck = [];
  for (const cat of CATEGORY_ORDER) {
    for (let i = 0; i < (WEIGHTS[cat] || 1); i += 1) deck.push(cat);
  }
  deck = shuffle(deck);
  for (let i = 1; i < deck.length; i += 1) {
    if (deck[i] !== deck[i - 1]) continue;
    const swap = deck.findIndex((x, j) => j > i && x !== deck[i - 1]);
    if (swap > i) [deck[i], deck[swap]] = [deck[swap], deck[i]];
  }
  room.deck = deck;
}

function nextCategory(room) {
  if (!room.deck.length) buildDeck(room);
  let cat = room.deck.shift();
  if (cat === room.lastCat && room.deck.length) {
    room.deck.push(cat);
    cat = room.deck.shift();
  }
  room.lastCat = cat;
  return cat;
}

function pick(room, cat) {
  const pool = Q[cat];
  if (!Array.isArray(pool) || !pool.length) throw new Error(`Leerer Fragenpool: ${cat}`);
  if (!room.used[cat]) room.used[cat] = new Set();
  if (room.used[cat].size >= pool.length) room.used[cat].clear();
  const free = pool.map((_, i) => i).filter((i) => !room.used[cat].has(i));
  const index = rand(free);
  room.used[cat].add(index);
  return pool[index];
}

function clearTimers(room) {
  for (const timer of room.timers) clearTimeout(timer);
  room.timers = [];
}

function addTimer(room, fn, ms) {
  const timer = setTimeout(fn, ms);
  room.timers.push(timer);
  return timer;
}

function playerPublic(room, id) {
  const p = room.players[id];
  const current = room.current;
  let answered = false;
  if (current) {
    if (current.type === 'person') answered = !!current.personCorrect?.[id];
    else if (current.type === 'wahrheit' || current.type === 'pflicht') answered = id === current.target && current.answers[id] !== undefined;
    else answered = current.answers[id] !== undefined;
  }
  return {
    id,
    name: p.name,
    drinks: p.drinks,
    connected: p.connected,
    answered,
  };
}

function currentPublic(room, forId) {
  const cur = room.current;
  if (!cur) return null;
  const base = {
    type: cur.type,
    label: CATS[cur.type],
    text: cur.text,
    options: cur.options,
    target: cur.target,
    deadline: cur.deadline,
    total: cur.total,
  };

  if (cur.type === 'person') {
    base.hints = cur.person.hints.slice(0, cur.hintIndex + 1);
    base.hintIndex = cur.hintIndex;
    base.hintCount = cur.person.hints.length;
    base.guessFeed = cur.guessFeed.slice(-20);
    base.yourStatus = cur.personCorrect[forId]
      ? { status: 'correct', hint: cur.personCorrect[forId] }
      : cur.personNear[forId]
        ? { status: 'near' }
        : null;
  }

  if (cur.type === 'wahrheit' || cur.type === 'pflicht') {
    base.isTarget = cur.target === forId;
  }

  return base;
}

function publicState(room, forId) {
  return {
    code: room.code,
    hostId: room.hostId,
    you: forId,
    cats: CATS,
    phase: room.phase,
    round: room.round,
    now: Date.now(),
    players: room.order.filter((id) => room.players[id]).map((id) => playerPublic(room, id)),
    current: currentPublic(room, forId),
    result: room.phase === 'results' ? room.lastResult : null,
  };
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function broadcast(room) {
  for (const id of room.order) {
    const p = room.players[id];
    if (p?.connected) send(p.ws, { t: 'state', s: publicState(room, id) });
  }
}

function giveSips(room, sipMap) {
  const drinkers = [];
  for (const [id, raw] of Object.entries(sipMap || {})) {
    const player = room.players[id];
    const n = clamp(Math.round(Number(raw) || 0), 0, 5);
    if (!player || n <= 0) continue;
    player.drinks += n;
    drinkers.push({ id, name: player.name, n });
  }
  return drinkers.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

function finishRound(room, reason = 'complete') {
  if (room.phase !== 'question' || !room.current) return;
  clearTimers(room);
  const cur = room.current;
  const ids = connectedIds(room);
  const answeredIds = Object.keys(cur.answers || {});
  const result = {
    type: cur.type,
    label: CATS[cur.type],
    text: cur.text,
    reason,
    lines: [],
    drinkers: [],
  };
  const sipMap = {};

  if (cur.type === 'nie') {
    const yes = answeredIds.filter((id) => cur.answers[id] === 'ja');
    if (yes.length) {
      const rarity = clamp(Math.ceil((1 - yes.length / Math.max(1, answeredIds.length)) * 3), 1, 3);
      yes.forEach((id) => { sipMap[id] = rarity; });
      result.lines.push(`${yes.length} von ${answeredIds.length} haben's getan.`);
    } else {
      result.lines.push('Niemand hat’s getan. Heute alle unschuldig.');
    }
  }

  if (cur.type === 'wahl') {
    const out = voteSipMap(cur.answers, 5);
    Object.assign(sipMap, out.sips);
    result.votes = Object.entries(out.counts)
      .filter(([id]) => room.players[id])
      .map(([id, n]) => ({ name: displayName(room, id), n }))
      .sort((a, b) => b.n - a.n);
    result.lines.push('Jede Stimme zählt als ein Schluck – maximal fünf.');
  }

  if (cur.type === 'schaetz') {
    const rows = estimateResults(cur.answers, cur.answer, 5);
    rows.forEach((row) => { sipMap[row.id] = row.sips; });
    result.answer = cur.answer;
    result.unit = cur.unit;
    result.guesses = rows.map((row) => ({
      id: row.id,
      name: displayName(room, row.id),
      guess: row.guess,
      diff: row.diff,
      sips: row.sips,
    }));
    const best = rows.filter((r) => r.sips === 0);
    if (best.length) result.lines.push(`Am nächsten: ${best.map((r) => displayName(room, r.id)).join(', ')} – trocken.`);
  }

  if (cur.type === 'oder') {
    const out = binaryMinority(cur.answers, 3);
    Object.assign(sipMap, out.sipsByPlayer);
    result.votes = cur.options.map((name, i) => ({ name, n: out.counts[String(i)] || 0 }));
    result.lines.push(Object.keys(out.sipsByPlayer).length ? 'Die Minderheit trinkt – je klarer die Mehrheit, desto mehr.' : 'Gleichstand: niemand trinkt.');
  }

  if (cur.type === 'trivia') {
    const correct = answeredIds.filter((id) => Number(cur.answers[id]) === cur.correct);
    const wrong = answeredIds.filter((id) => Number(cur.answers[id]) !== cur.correct);
    const penalty = wrong.length ? clamp(Math.ceil((correct.length / Math.max(1, answeredIds.length)) * 3), 1, 3) : 0;
    wrong.forEach((id) => { sipMap[id] = penalty; });
    result.answer = cur.options[cur.correct];
    result.votes = cur.options.map((name, i) => ({ name, n: answeredIds.filter((id) => Number(cur.answers[id]) === i).length }));
    result.lines.push(correct.length === answeredIds.length && answeredIds.length ? 'Alle richtig. Streberrunde.' : `${correct.length} von ${answeredIds.length} richtig.`);
  }

  if (cur.type === 'wahrheit' || cur.type === 'pflicht') {
    const choice = cur.answers[cur.target];
    const penalty = reason === 'timeout' ? 4 : 3;
    if (choice !== 'done') sipMap[cur.target] = penalty;
    result.target = displayName(room, cur.target);
    result.lines.push(choice === 'done' ? `${result.target} zieht durch.` : `${result.target} trinkt lieber.`);
  }

  if (cur.type === 'person') {
    result.answer = cur.person.name;
    result.guesses = cur.guessFeed.slice();
    for (const id of ids) {
      const solvedHint = cur.personCorrect[id];
      sipMap[id] = solvedHint ? clamp(solvedHint - 1, 0, 4) : 5;
    }
    result.lines.push('Früh erkannt = trocken. Mit jedem weiteren Hinweis steigt die mögliche Strafe.');
  }

  if (cur.type === 'mehrheit') {
    const out = majorityResults(cur.answers, 5);
    Object.assign(sipMap, out.sipsByPlayer);
    result.votes = cur.options.map((name, i) => ({ name, n: out.counts[String(i)] || 0 }));
    result.lines.push(out.winners.length > 1 ? 'Mehrheits-Gleichstand – die Top-Antworten bleiben trocken.' : 'Je weiter deine Antwort hinter der Mehrheit liegt, desto mehr Schlücke.');
  }

  if (cur.type === 'skala') {
    const out = scaleResults(cur.answers, 5);
    out.rows.forEach((row) => { sipMap[row.id] = row.sips; });
    result.median = out.median;
    result.scale = out.rows.map((row) => ({ id: row.id, name: displayName(room, row.id), value: row.value, sips: row.sips }));
    result.lines.push(`Gruppenmitte: ${Number.isInteger(out.median) ? out.median : out.median.toFixed(1)}. Je weiter weg, desto mehr Schlücke.`);
  }

  if (reason === 'timeout' && cur.type !== 'person' && cur.type !== 'wahrheit' && cur.type !== 'pflicht') {
    const late = ids.filter((id) => cur.answers[id] === undefined);
    late.forEach((id) => { sipMap[id] = Math.max(sipMap[id] || 0, 1); });
    if (late.length) result.lines.push(`Zu langsam: ${late.map((id) => displayName(room, id)).join(', ')}.`);
  }

  result.drinkers = giveSips(room, sipMap);
  room.lastResult = result;
  room.phase = 'results';
  broadcast(room);
}

function allAnswered(room) {
  const cur = room.current;
  if (!cur) return false;
  const ids = connectedIds(room);
  if (!ids.length) return false;
  if (cur.type === 'wahrheit' || cur.type === 'pflicht') return cur.answers[cur.target] !== undefined;
  if (cur.type === 'person') return ids.every((id) => !!cur.personCorrect[id]);
  return ids.every((id) => cur.answers[id] !== undefined);
}

function scheduleRound(room) {
  const cur = room.current;
  const round = room.round;
  const sec = cur.total;

  if (cur.type === 'person') {
    const step = Math.floor((sec * 1000) / cur.person.hints.length);
    for (let hint = 1; hint < cur.person.hints.length; hint += 1) {
      addTimer(room, () => {
        if (room.phase !== 'question' || room.round !== round || room.current.type !== 'person') return;
        room.current.hintIndex = Math.max(room.current.hintIndex, hint);
        broadcast(room);
      }, step * hint);
    }
  }

  addTimer(room, () => {
    if (room.phase === 'question' && room.round === round) finishRound(room, 'timeout');
  }, sec * 1000 + 250);
}

function startRound(room) {
  clearTimers(room);
  room.phase = 'question';
  room.round += 1;
  const type = nextCategory(room);
  const total = ROUND_SECONDS[type] || 30;
  const cur = {
    type,
    label: CATS[type],
    answers: {},
    total,
    deadline: Date.now() + total * 1000,
  };

  if (type === 'nie' || type === 'wahl' || type === 'skala') cur.text = pick(room, type);
  if (type === 'schaetz') {
    const q = pick(room, type);
    cur.text = q.q;
    cur.answer = q.a;
    cur.unit = q.unit;
  }
  if (type === 'oder') {
    cur.text = 'Entweder oder?';
    cur.options = pick(room, type);
  }
  if (type === 'trivia') {
    const q = pick(room, type);
    cur.text = q.q;
    cur.options = q.o;
    cur.correct = q.c;
  }
  if (type === 'mehrheit') {
    const q = pick(room, type);
    cur.text = q.q;
    cur.options = q.o;
  }
  if (type === 'wahrheit' || type === 'pflicht') {
    cur.target = rand(connectedIds(room));
    cur.text = pick(room, type);
  }
  if (type === 'person') {
    cur.text = 'Wer ist die gesuchte Person?';
    cur.person = pick(room, type);
    cur.hintIndex = 0;
    cur.guessFeed = [];
    cur.personCorrect = {};
    cur.personNear = {};
  }

  room.current = cur;
  scheduleRound(room);
  broadcast(room);
}

function answerCurrent(room, me, value) {
  const cur = room.current;
  if (!cur || room.phase !== 'question' || cur.type === 'person') return;

  if (cur.type === 'nie') cur.answers[me] = value === 'ja' ? 'ja' : 'nein';
  else if (cur.type === 'wahl') {
    if (!room.players[value]) return;
    cur.answers[me] = value;
  } else if (cur.type === 'schaetz') {
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || Math.abs(n) > 1e12) return;
    cur.answers[me] = n;
  } else if (cur.type === 'oder') {
    const i = Number(value);
    if (![0, 1].includes(i)) return;
    cur.answers[me] = i;
  } else if (cur.type === 'trivia' || cur.type === 'mehrheit') {
    const i = Number(value);
    if (!Number.isInteger(i) || i < 0 || i >= cur.options.length) return;
    cur.answers[me] = i;
  } else if (cur.type === 'skala') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 10) return;
    cur.answers[me] = n;
  } else if (cur.type === 'wahrheit' || cur.type === 'pflicht') {
    if (me !== cur.target) return;
    cur.answers[me] = value === 'done' ? 'done' : 'drink';
  } else return;

  if (allAnswered(room)) finishRound(room, 'complete');
  else broadcast(room);
}

function personGuess(room, me, rawGuess) {
  const cur = room.current;
  if (!cur || room.phase !== 'question' || cur.type !== 'person' || cur.personCorrect[me]) return;
  const guess = String(rawGuess || '').trim().slice(0, 40);
  if (guess.length < 2) return;
  const match = matchPersonGuess(cur.person, guess);

  if (match.status === 'correct') {
    cur.personCorrect[me] = cur.hintIndex + 1;
    cur.personNear[me] = false;
    send(room.players[me].ws, { t: 'personFeedback', status: 'correct', m: 'Richtig! Dein Tipp bleibt für die anderen geheim.' });
  } else if (match.status === 'near') {
    cur.personNear[me] = true;
    send(room.players[me].ws, { t: 'personFeedback', status: 'near', m: 'Nah dran – der Tipp wird nicht angezeigt.' });
  } else {
    cur.personNear[me] = false;
    cur.guessFeed.push({ name: displayName(room, me), guess, hint: cur.hintIndex + 1 });
    if (cur.guessFeed.length > 40) cur.guessFeed.shift();
    send(room.players[me].ws, { t: 'personFeedback', status: 'wrong', m: 'Nicht richtig – dieser Tipp ist für alle sichtbar.' });
  }

  if (allAnswered(room)) finishRound(room, 'complete');
  else broadcast(room);
}

const indexFile = path.join(__dirname, 'public', 'index.html');
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, version: '2.0.0' }));
    return;
  }
  if (req.url !== '/' && req.url !== '/index.html') {
    res.writeHead(302, { location: '/' });
    res.end();
    return;
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  fs.createReadStream(indexFile).pipe(res);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let room = null;
  let me = null;
  const error = (m) => send(ws, { t: 'error', m });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.t === 'ping') return send(ws, { t: 'pong' });

    if (msg.t === 'create') {
      room = createRoom();
      me = uid();
      room.players[me] = { name: cleanName(msg.name, 'Host'), drinks: 0, connected: true, ws };
      room.order.push(me);
      room.hostId = me;
      send(ws, { t: 'joined', code: room.code, id: me });
      return broadcast(room);
    }

    if (msg.t === 'join') {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      const target = rooms.get(code);
      if (!target) return error('Diesen Spielcode gibt es nicht.');
      room = target;
      me = uid();
      room.players[me] = { name: cleanName(msg.name), drinks: 0, connected: true, ws };
      room.order.push(me);
      send(ws, { t: 'joined', code: room.code, id: me });
      return broadcast(room);
    }

    if (msg.t === 'rejoin') {
      const target = rooms.get(String(msg.code || '').toUpperCase());
      if (!target || !target.players[msg.id]) return send(ws, { t: 'reset' });
      room = target;
      me = msg.id;
      room.players[me].connected = true;
      room.players[me].ws = ws;
      send(ws, { t: 'joined', code: room.code, id: me });
      return broadcast(room);
    }

    if (!room || !me || !room.players[me]) return;
    const isHost = room.hostId === me;

    if (msg.t === 'start' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {
      if (!connectedIds(room).length) return error('Niemand ist im Raum.');
      return startRound(room);
    }
    if (msg.t === 'next' && isHost && room.phase === 'results') return startRound(room);
    if (msg.t === 'end' && isHost) {
      clearTimers(room);
      room.phase = 'end';
      room.current = null;
      return broadcast(room);
    }
    if (msg.t === 'host' && isHost && room.players[msg.id]?.connected) {
      room.hostId = msg.id;
      return broadcast(room);
    }
    if (msg.t === 'answer') return answerCurrent(room, me, msg.v);
    if (msg.t === 'personGuess') return personGuess(room, me, msg.v);
  });

  ws.on('close', () => {
    if (!room || !me || !room.players[me]) return;
    room.players[me].connected = false;
    room.players[me].ws = null;

    if (room.hostId === me) {
      const next = connectedIds(room)[0];
      if (next) room.hostId = next;
    }

    if (room.phase === 'question' && allAnswered(room)) finishRound(room, 'complete');
    else broadcast(room);

    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      if (!connectedIds(room).length) {
        clearTimers(room);
        rooms.delete(room.code);
      }
    }, 30 * 60 * 1000);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`SüffIQ v2 läuft auf http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`Im WLAN: http://${ip}:${PORT}`));
});
