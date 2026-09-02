'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.6 server patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

const basePath = path.join(__dirname, 'server-base-v45.js');
let src = fs.readFileSync(basePath, 'utf8');

src = replaceRequired(
  src,
  "const hardenFrontend = require('./frontend-v45');\nconst pwaHandler = require('./pwa-v45');",
  "const hardenFrontend = require('./frontend-v45');\nconst addMinigameFrontend = require('./frontend-minigames-v46b');\nconst addShareFrontend = require('./frontend-share-v46');\nconst pwaHandler = require('./pwa-v45');\nconst { DRAW_PROMPTS, MINI_TYPES, randomSequence, reactionResults, tapResults, memoryResults } = require('./minigames');",
  'imports'
);

src = replaceRequired(src, "const VERSION = '4.5.0';", "const VERSION = '4.6.0';", 'version');
src = replaceRequired(src, "result.lines.push('Schnell erkannt = trocken oder ein Schluck; nicht erkannt = drei.');", "result.lines.push('Je schneller erkannt, desto weniger Schlücke; nicht erkannt = drei.');", 'song result wording');
src = replaceRequired(src, 'Q.song = songs;', "Q.song = songs;\nQ.minigame = ['arcade'];", 'minigame pool');

src = replaceRequired(src, "  skala: 'Skala',\n};", "  skala: 'Skala',\n  minigame: 'Minigames',\n};", 'category');
src = replaceRequired(src, "  pflicht: 35, person: 45, bild: 30, song: 55, mehrheit: 30, skala: 30,\n};", "  pflicht: 35, person: 45, bild: 30, song: 55, mehrheit: 30, skala: 30, minigame: 30,\n};", 'round seconds');
src = replaceRequired(src, "    selectedCats: [...CATEGORY_ORDER], socialFlip: undefined, adultFlip: undefined, groupFlip: undefined,\n  };", "    selectedCats: [...CATEGORY_ORDER], socialFlip: undefined, adultFlip: undefined, groupFlip: undefined,\n    miniQueue: [], lastMini: null, lastDrawer: null,\n  };", 'room minigame state');

src = replaceRequired(src, "    deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group]\n      .filter((cat) => selected.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);", "    deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group, 'minigame', 'minigame']\n      .filter((cat) => selected.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);", 'default minigame frequency');
src = replaceRequired(src, "    const customWeights = { schaetz: 5, wahl: 3, trivia: 3, song: 3, person: 2, bild: 2, nie: 2, mehrheit: 2, skala: 2, oder: 2, wahrheit: 2, pflicht: 2 };", "    const customWeights = { schaetz: 5, minigame: 5, wahl: 3, trivia: 3, song: 3, person: 2, bild: 2, nie: 2, mehrheit: 2, skala: 2, oder: 2, wahrheit: 2, pflicht: 2 };", 'custom minigame weight');

const miniHelpers = `const MINI_LABELS = { zeichnen: 'Zeichnen & Raten', reaktion: 'Reaktionstest', taps: 'Tap Battle', farbfolge: 'Farbfolge merken' };
function nextMiniType(room) {
  const allowed = connectedIds(room).length >= 2 ? MINI_TYPES : MINI_TYPES.filter((x) => x !== 'zeichnen');
  if (!room.miniQueue.length || room.miniQueue.some((x) => !allowed.includes(x))) {
    room.miniQueue = shuffle(allowed);
    if (room.miniQueue.length > 1 && room.miniQueue[0] === room.lastMini) [room.miniQueue[0], room.miniQueue[1]] = [room.miniQueue[1], room.miniQueue[0]];
  }
  const type = room.miniQueue.shift(); room.lastMini = type; return type;
}
function miniLabel(type) { return MINI_LABELS[type] || 'Minigame'; }
function pickDrawPrompt(room) {
  if (!room.used.drawprompt) room.used.drawprompt = new Set();
  if (room.used.drawprompt.size >= DRAW_PROMPTS.length) room.used.drawprompt.clear();
  const free = DRAW_PROMPTS.map((_, i) => i).filter((i) => !room.used.drawprompt.has(i));
  const index = rand(free); room.used.drawprompt.add(index); return DRAW_PROMPTS[index];
}
function matchDrawGuess(prompt, rawGuess) {
  const target = normalizeText(prompt); const guess = normalizeText(rawGuess);
  if (guess.length < 2) return { status: 'wrong' };
  if (guess === target) return { status: 'correct' };
  const score = similarity(target, guess);
  if (score >= 0.72 || (guess.length >= 4 && target.length >= 4 && (target.startsWith(guess) || guess.startsWith(target)))) return { status: 'near' };
  return { status: 'wrong' };
}
function chooseDrawer(room) {
  const ids = connectedIds(room); if (!ids.length) return null;
  if (!room.lastDrawer || !ids.includes(room.lastDrawer)) return ids[0];
  const idx = ids.indexOf(room.lastDrawer); return ids[(idx + 1) % ids.length];
}
`;
src = replaceRequired(src, 'function pick(room, cat) {', miniHelpers + '\nfunction pick(room, cat) {', 'minigame helpers');

src = replaceRequired(src, "    else if (cur.type === 'song') answered = !!cur.songCorrect?.[id];\n    else if (cur.type === 'wahrheit' || cur.type === 'pflicht')", "    else if (cur.type === 'song') answered = !!cur.songCorrect?.[id];\n    else if (cur.type === 'minigame') {\n      if (cur.miniType === 'zeichnen') answered = id === cur.drawerId || !!cur.miniCorrect?.[id];\n      else if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') answered = cur.answers?.[id] !== undefined;\n      else answered = false;\n    }\n    else if (cur.type === 'wahrheit' || cur.type === 'pflicht')", 'minigame answered state');
src = replaceRequired(src, "  const base = { type: cur.type, label: CATS[cur.type], text: cur.text, options: cur.options, target: cur.target, deadline: cur.deadline, total: cur.total };", "  const base = { type: cur.type, label: cur.type === 'minigame' ? miniLabel(cur.miniType) : CATS[cur.type], text: cur.text, options: cur.options, target: cur.target, deadline: cur.deadline, total: cur.total };", 'public minigame label');
src = replaceRequired(src, "  if (cur.type === 'wahrheit' || cur.type === 'pflicht') base.isTarget = cur.target === forId;", `  if (cur.type === 'minigame') {
    base.miniType = cur.miniType;
    if (cur.miniType === 'zeichnen') {
      base.drawerId = cur.drawerId; base.drawerName = displayName(room, cur.drawerId); base.isDrawer = forId === cur.drawerId;
      base.prompt = base.isDrawer ? cur.prompt : null; base.strokes = cur.strokes.slice(-1200); base.guessFeed = cur.guessFeed.slice(-20);
      base.yourStatus = cur.miniCorrect[forId] ? { status: 'correct' } : cur.miniNear[forId] ? { status: 'near' } : null;
    }
    if (cur.miniType === 'reaktion') base.goAt = cur.goAt;
    if (cur.miniType === 'taps') { base.startAt = cur.startAt; base.endAt = cur.endAt; }
    if (cur.miniType === 'farbfolge') { base.sequence = cur.sequence; base.showAt = cur.showAt; base.inputAt = cur.inputAt; }
  }
  if (cur.type === 'wahrheit' || cur.type === 'pflicht') base.isTarget = cur.target === forId;`, 'public minigame fields');

const minigameFinish = `  if (cur.type === 'minigame') {
    result.label = miniLabel(cur.miniType);
    if (cur.miniType === 'zeichnen') {
      result.answer = cur.prompt;
      const guessers = ids.filter((id) => id !== cur.drawerId);
      const solved = guessers.filter((id) => cur.miniCorrect[id]).sort((a, b) => cur.miniCorrect[a] - cur.miniCorrect[b]);
      const missed = guessers.filter((id) => !cur.miniCorrect[id]);
      solved.forEach((id, index) => { sipMap[id] = index === 0 ? 0 : 1; }); missed.forEach((id) => { sipMap[id] = 2; });
      result.miniRows = solved.map((id) => ({ name: displayName(room, id), label: (cur.miniCorrect[id] / 1000).toFixed(1) + ' s' })).concat(missed.map((id) => ({ name: displayName(room, id), label: 'nicht erraten' })));
      result.lines.push(guessers.length ? solved.length + ' von ' + guessers.length + ' haben die Zeichnung erkannt.' : 'Solo-Test: Zeichnen braucht mindestens zwei Spieler.');
    }
    if (cur.miniType === 'reaktion') {
      const input = {}; ids.forEach((id) => { input[id] = cur.answers[id] || { falseStart: true, ms: 0 }; });
      const out = reactionResults(input); Object.assign(sipMap, out.sips);
      result.miniRows = out.ranked.map((row) => ({ name: displayName(room, row.id), label: row.falseStart ? 'Fehlstart' : Math.round(row.value) + ' ms' }));
      result.lines.push('Schnellste Reaktion gewinnt. Fehlstart kostet zwei Schlücke.');
    }
    if (cur.miniType === 'taps') {
      const counts = {}; ids.forEach((id) => { counts[id] = Number(cur.tapCounts[id] || 0); });
      const out = tapResults(counts); Object.assign(sipMap, out.sips);
      result.miniRows = out.ranked.map((row) => ({ name: displayName(room, row.id), label: row.value + ' Taps' }));
      result.lines.push('Mehr Taps = besser. Die schnellsten Finger bleiben trocken.');
    }
    if (cur.miniType === 'farbfolge') {
      const scores = {}; ids.forEach((id) => { scores[id] = cur.answers[id] || { score: 0, ms: 999999 }; });
      const out = memoryResults(scores, cur.sequence.length); Object.assign(sipMap, out.sips);
      result.miniRows = out.ranked.map((row) => ({ name: displayName(room, row.id), label: row.value + '/' + cur.sequence.length + ' richtig' }));
      result.lines.push('Wer sich die komplette Farbfolge merkt, bleibt trocken.');
    }
    result.drinkers = giveSips(room, sipMap); room.lastResult = result; room.phase = 'results'; broadcast(room); return;
  }
`;
src = replaceRequired(src, "  const sipMap = {};\n  if (cur.type === 'nie') {", '  const sipMap = {};\n' + minigameFinish + "  if (cur.type === 'nie') {", 'minigame finish');

src = replaceRequired(src, "  if (cur.type === 'wahrheit' || cur.type === 'pflicht') return cur.answers[cur.target] !== undefined;", `  if (cur.type === 'minigame') {
    if (cur.miniType === 'zeichnen') { const guessers = ids.filter((id) => id !== cur.drawerId); return guessers.length > 0 && guessers.every((id) => !!cur.miniCorrect[id]); }
    if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') return ids.every((id) => cur.answers[id] !== undefined);
    return false;
  }
  if (cur.type === 'wahrheit' || cur.type === 'pflicht') return cur.answers[cur.target] !== undefined;`, 'all answered minigames');

src = replaceRequired(src, "  const type = nextCategory(room); const total = ROUND_SECONDS[type] || 30;\n  const cur = { type, label: CATS[type], answers: {}, total, deadline: Date.now() + total * 1000 };", "  const type = nextCategory(room); let total = ROUND_SECONDS[type] || 30;\n  const cur = { type, label: CATS[type], answers: {}, total, deadline: Date.now() + total * 1000 };", 'mutable total');
src = replaceRequired(src, "  if (type === 'song') { cur.text = 'Welcher Song läuft?'; cur.song = pick(room, 'song'); cur.songStage = 0; cur.songStartedAt = null; cur.guessFeed = []; cur.songCorrect = {}; cur.songNear = {}; }\n  cur.deadline = Date.now() + total * 1000;", `  if (type === 'song') { cur.text = 'Welcher Song läuft?'; cur.song = pick(room, 'song'); cur.songStage = 0; cur.songStartedAt = null; cur.guessFeed = []; cur.songCorrect = {}; cur.songNear = {}; }
  if (type === 'minigame') {
    cur.miniType = nextMiniType(room); cur.label = miniLabel(cur.miniType); const now = Date.now();
    if (cur.miniType === 'zeichnen') { total = 45; cur.text = 'Zeichnen & Raten'; cur.drawerId = chooseDrawer(room); room.lastDrawer = cur.drawerId; cur.prompt = pickDrawPrompt(room); cur.startedAt = now; cur.strokes = []; cur.guessFeed = []; cur.miniCorrect = {}; cur.miniNear = {}; }
    if (cur.miniType === 'reaktion') { total = 9; cur.text = 'Tippe erst, wenn die Fläche grün wird!'; cur.goAt = now + 1900 + Math.floor(Math.random() * 2600); }
    if (cur.miniType === 'taps') { total = 11; cur.text = 'Wer tippt in 7 Sekunden am häufigsten?'; cur.startAt = now + 1500; cur.endAt = cur.startAt + 7000; cur.tapCounts = {}; }
    if (cur.miniType === 'farbfolge') { total = 15; cur.text = 'Merke dir die Farbfolge.'; cur.sequence = randomSequence(6); cur.showAt = now + 900; cur.inputAt = cur.showAt + cur.sequence.length * 760 + 650; }
    cur.total = total;
  }
  cur.deadline = Date.now() + total * 1000;`, 'start minigames');
src = replaceRequired(src, "  const cur = room.current; if (!cur || room.phase !== 'question' || ['person', 'bild', 'song'].includes(cur.type)) return;", "  const cur = room.current; if (!cur || room.phase !== 'question' || ['person', 'bild', 'song', 'minigame'].includes(cur.type)) return;", 'generic answer excludes minigame');
src = replaceRequired(src, "    if (msg.t === 'host' && isHost && room.phase === 'lobby' && room.players[msg.id]?.connected) { room.hostId = msg.id; return broadcast(room); }", "    if (msg.t === 'host' && isHost && ['lobby', 'results', 'end'].includes(room.phase) && room.players[msg.id]?.connected) { room.hostId = msg.id; return broadcast(room); }", 'master transfer phases');

const miniHandlers = `    if (msg.t === 'miniGuess' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeichnen') {
      const cur = room.current; if (me === cur.drawerId || cur.miniCorrect[me]) return;
      const guess = String(msg.v || '').trim().slice(0, 48); if (guess.length < 2) return;
      const match = matchDrawGuess(cur.prompt, guess); const elapsed = Math.max(1, Date.now() - cur.startedAt);
      if (match.status === 'correct') { cur.miniCorrect[me] = elapsed; cur.miniNear[me] = false; send(room.players[me].ws, { t: 'guessFeedback', status: 'correct', m: 'Richtig! Dein Tipp bleibt geheim.' }); }
      else if (match.status === 'near') { cur.miniNear[me] = true; send(room.players[me].ws, { t: 'guessFeedback', status: 'near', m: 'Sehr nah dran – bleibt privat.' }); }
      else { cur.miniNear[me] = false; const row = { name: displayName(room, me), guess }; cur.guessFeed.push(row); if (cur.guessFeed.length > 40) cur.guessFeed.shift(); for (const id of connectedIds(room)) send(room.players[id].ws, { t: 'drawGuess', ...row }); }
      if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return;
    }
    if (msg.t === 'drawStroke' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeichnen' && room.current.drawerId === me) {
      const s = Array.isArray(msg.s) ? msg.s.slice(0, 5).map(Number) : null; if (!s || s.length !== 5 || s.some((n) => !Number.isFinite(n))) return;
      for (let i = 0; i < 4; i += 1) s[i] = clamp(s[i], 0, 1); s[4] = clamp(Math.round(s[4]), 0, 3);
      room.current.strokes.push(s); if (room.current.strokes.length > 1200) room.current.strokes.shift(); sendExcept(room, me, { t: 'drawStroke', stroke: s }); return;
    }
    if (msg.t === 'drawClear' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeichnen' && room.current.drawerId === me) { room.current.strokes = []; sendExcept(room, me, { t: 'drawClear' }); return; }
    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {
      const cur = room.current; if (cur.answers[me] !== undefined) return; const now = Date.now(); cur.answers[me] = { falseStart: now < cur.goAt, ms: Math.max(0, now - cur.goAt) };
      if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return;
    }
    if (msg.t === 'miniTap' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {
      const cur = room.current; const now = Date.now(); if (now < cur.startAt || now > cur.endAt + 500) return; const n = clamp(Math.round(Number(msg.n) || 0), 0, 30); if (!n) return; cur.tapCounts[me] = clamp((cur.tapCounts[me] || 0) + n, 0, 500); return;
    }
    if (msg.t === 'miniMemory' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'farbfolge') {
      const cur = room.current; if (cur.answers[me] !== undefined || Date.now() < cur.inputAt - 150) return; const seq = Array.isArray(msg.seq) ? msg.seq.slice(0, cur.sequence.length).map(Number) : [];
      let score = 0; for (let i = 0; i < cur.sequence.length; i += 1) { if (Number(seq[i]) !== Number(cur.sequence[i])) break; score += 1; }
      cur.answers[me] = { score, ms: Math.max(0, Date.now() - cur.inputAt) }; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return;
    }
`;
src = replaceRequired(src, "    if (msg.t === 'personGuess' || msg.t === 'guess') return guessCurrent(room, me, msg.v);\n    if (msg.t === 'songPlay'", "    if (msg.t === 'personGuess' || msg.t === 'guess') return guessCurrent(room, me, msg.v);\n" + miniHandlers + "    if (msg.t === 'songPlay'", 'minigame websocket handlers');
src = replaceRequired(src, '  html = hardenFrontend(html); return html;', '  html = hardenFrontend(html); html = addMinigameFrontend(html); html = addShareFrontend(html); return html;', 'frontend modules');
src = replaceRequired(src, "imageStepSeconds: 4, maxSipsPerRound: 3 })); return; }", "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, inviteLinks: true, masterTransfer: true })); return; }", 'health flags');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
