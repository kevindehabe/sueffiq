'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

function patch(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.7 Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}
function basePatch(needle, replacement, label) {
  return `src = replaceRequired(src, ${JSON.stringify(needle)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)});`;
}

const basePath = path.join(__dirname, 'server-v46.js');
let src = fs.readFileSync(basePath, 'utf8');

// Keep the one-process v4.6 extension architecture, but make v4.7 the public build.
src = patch(src, "const VERSION = '4.6.0';", "const VERSION = '4.7.0';", 'version');
src = patch(src,
  "const addMinigameFrontend = require('./frontend-minigames-v46b');",
  "const addMinigameFrontend = require('./frontend-minigames-v47');",
  'frontend module');

const extra = [];

extra.push(basePatch(
`    selectedCats: [...CATEGORY_ORDER], socialFlip: undefined, adultFlip: undefined, groupFlip: undefined,
    miniQueue: [], lastMini: null, lastDrawer: null, miniDrawTurn: true,
  };`,
`    selectedCats: [...CATEGORY_ORDER], socialFlip: undefined, adultFlip: undefined, groupFlip: undefined,
    miniQueue: [], lastMini: null, lastDrawer: null, miniDrawTurn: true,
    selectedMiniTypes: [...MINI_TYPES], miniDrawGuaranteed: true, pongCursor: 0,
  };`,
'v47 room minigame selection'));

extra.push(basePatch(
"    deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group, 'minigame', 'minigame']\n      .filter((cat) => selected.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);",
"    deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group, 'minigame', 'minigame', 'minigame']\n      .filter((cat) => selected.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);",
'v47 default minigame frequency'));

extra.push(basePatch(
`  deck = shuffle(deck);
  if (selected.length === CATEGORY_ORDER.length && selected.includes('minigame') && connectedIds(room).length >= 2) {
    const firstMini = deck.findIndex((cat) => cat === 'minigame');
    if (firstMini > 6) [deck[firstMini], deck[4]] = [deck[4], deck[firstMini]];
    const miniSlots = deck.map((cat, i) => cat === 'minigame' ? i : -1).filter((i) => i >= 0);
    const lateMini = miniSlots.find((i) => i > 9);
    if (lateMini !== undefined) [deck[lateMini], deck[8]] = [deck[8], deck[lateMini]];
  }`,
`  deck = shuffle(deck);
  if (selected.includes('minigame') && connectedIds(room).length >= 2) {
    const minis = deck.filter((cat) => cat === 'minigame');
    const rest = deck.filter((cat) => cat !== 'minigame');
    const positions = [2, 6, 9];
    deck = rest;
    minis.forEach((cat, i) => deck.splice(Math.min(positions[i] ?? deck.length, deck.length), 0, cat));
  }`,
'v47 guaranteed early minigames'));

extra.push(basePatch(
"const MINI_LABELS = { zeichnen: 'Zeichnen & Raten', reaktion: 'Reaktionstest', taps: 'Tap Battle', farbfolge: 'Farbfolge merken' };",
"const MINI_LABELS = { zeichnen: 'Zeichnen & Raten', allemallen: 'Alle malen', allemalen: 'Alle malen', reaktion: 'Reaktionstest', taps: 'Tap Battle', farbfolge: 'Farbfolge merken', pong: 'Pong', blackjack: 'Blackjack' };",
'v47 minigame labels'));

extra.push(basePatch(
`function nextMiniType(room) {
  const multiplayer = connectedIds(room).length >= 2;
  if (multiplayer && room.miniDrawTurn !== false) {
    room.miniDrawTurn = false; room.lastMini = 'zeichnen'; return 'zeichnen';
  }
  const allowed = MINI_TYPES.filter((x) => x !== 'zeichnen');
  if (!room.miniQueue.length || room.miniQueue.some((x) => !allowed.includes(x))) {
    room.miniQueue = shuffle(allowed);
    if (room.miniQueue.length > 1 && room.miniQueue[0] === room.lastMini) [room.miniQueue[0], room.miniQueue[1]] = [room.miniQueue[1], room.miniQueue[0]];
  }
  const type = room.miniQueue.shift(); room.lastMini = type; if (multiplayer) room.miniDrawTurn = true; return type;
}`,
`function availableMiniTypes(room) {
  const chosen = Array.isArray(room.selectedMiniTypes) && room.selectedMiniTypes.length ? room.selectedMiniTypes : MINI_TYPES;
  const count = connectedIds(room).length;
  return chosen.filter((type) => MINI_TYPES.includes(type) && (count >= 2 || !['zeichnen', 'allemalen', 'pong'].includes(type)));
}
function nextMiniType(room) {
  const allowed = availableMiniTypes(room);
  if (!allowed.length) return 'reaktion';
  if (room.miniDrawGuaranteed && allowed.includes('zeichnen')) {
    room.miniDrawGuaranteed = false; room.lastMini = 'zeichnen'; return 'zeichnen';
  }
  if (!room.miniQueue.length || room.miniQueue.some((x) => !allowed.includes(x))) {
    room.miniQueue = shuffle(allowed);
    if (room.miniQueue.length > 1 && room.miniQueue[0] === room.lastMini) [room.miniQueue[0], room.miniQueue[1]] = [room.miniQueue[1], room.miniQueue[0]];
  }
  const type = room.miniQueue.shift(); room.lastMini = type; return type;
}`,
'v47 selected minigame rotation'));

extra.push(basePatch(
"function miniLabel(type) { return MINI_LABELS[type] || 'Minigame'; }",
`function choosePongPlayers(room) {
  const ids = connectedIds(room); if (ids.length < 2) return ids;
  const start = Number(room.pongCursor || 0) % ids.length;
  const pair = [ids[start], ids[(start + 1) % ids.length]];
  room.pongCursor = (start + 2) % ids.length; return pair;
}
function blackjackDeck() {
  const suits = ['♠', '♥', '♦', '♣']; const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']; const deck = [];
  for (let shoe = 0; shoe < 6; shoe += 1) for (const s of suits) for (const r of ranks) deck.push({ r, s });
  return shuffle(deck);
}
function blackjackValue(hand) {
  let total = 0; let aces = 0;
  for (const card of hand || []) { if (card.r === 'A') { total += 11; aces += 1; } else if (['K','Q','J'].includes(card.r)) total += 10; else total += Number(card.r) || 0; }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}
function beginAllDrawRank(room) {
  const cur = room.current; if (!cur || room.phase !== 'question' || cur.type !== 'minigame' || cur.miniType !== 'allemalen' || cur.miniStage === 'rank') return;
  clearTimers(room); cur.miniStage = 'rank'; cur.rankVotes = {}; cur.total = 30; cur.deadline = Date.now() + 30000;
  const round = room.round; addTimer(room, () => { if (room.phase === 'question' && room.round === round && room.current === cur) finishRound(room, 'timeout'); }, 30250); broadcast(room);
}
function resetPongBall(cur, direction) {
  const dir = direction || (Math.random() < .5 ? -1 : 1); cur.pongBall = { x: .5, y: .5, vx: dir * .012, vy: (Math.random() - .5) * .012 }; cur.pongPauseUntil = Date.now() + 850;
}
function startPongLoop(room, round) {
  const tick = () => {
    const cur = room.current; if (!cur || room.phase !== 'question' || room.round !== round || cur.type !== 'minigame' || cur.miniType !== 'pong') return;
    const pair = cur.pongPlayers || []; const left = pair[0]; const right = pair[1];
    if (!room.players[left]?.connected || !room.players[right]?.connected) {
      if (room.players[left]?.connected) cur.pongScore.left = 3; else if (room.players[right]?.connected) cur.pongScore.right = 3;
      return finishRound(room, 'complete');
    }
    if (Date.now() >= Number(cur.pongPauseUntil || 0)) {
      const b = cur.pongBall; b.x += b.vx; b.y += b.vy;
      if (b.y <= .035) { b.y = .035; b.vy = Math.abs(b.vy); } if (b.y >= .965) { b.y = .965; b.vy = -Math.abs(b.vy); }
      const lh = Math.abs(b.y - Number(cur.pongPaddles.left || .5)) <= .145; const rh = Math.abs(b.y - Number(cur.pongPaddles.right || .5)) <= .145;
      if (b.vx < 0 && b.x <= .075 && b.x >= .025 && lh) { b.x = .075; b.vx = Math.min(.024, Math.abs(b.vx) * 1.055); b.vy += (b.y - Number(cur.pongPaddles.left || .5)) * .035; }
      if (b.vx > 0 && b.x >= .925 && b.x <= .975 && rh) { b.x = .925; b.vx = -Math.min(.024, Math.abs(b.vx) * 1.055); b.vy += (b.y - Number(cur.pongPaddles.right || .5)) * .035; }
      if (b.x < -.03) { cur.pongScore.right += 1; if (cur.pongScore.right >= 3) return finishRound(room, 'complete'); resetPongBall(cur, -1); }
      if (b.x > 1.03) { cur.pongScore.left += 1; if (cur.pongScore.left >= 3) return finishRound(room, 'complete'); resetPongBall(cur, 1); }
    }
    broadcast(room); setTimeout(tick, 55).unref?.();
  };
  setTimeout(tick, 250).unref?.();
}
function miniLabel(type) { return MINI_LABELS[type] || 'Minigame'; }`,
'v47 game helpers'));

extra.push(basePatch(
`    else if (cur.type === 'minigame') {
      if (cur.miniType === 'zeichnen') answered = id === cur.drawerId || !!cur.miniCorrect?.[id];
      else if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') answered = cur.answers?.[id] !== undefined;
      else answered = false;
    }`,
`    else if (cur.type === 'minigame') {
      if (cur.miniType === 'zeichnen') answered = id === cur.drawerId || !!cur.miniCorrect?.[id];
      else if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') answered = cur.answers?.[id] !== undefined;
      else if (cur.miniType === 'taps') answered = !!cur.tapDone?.[id];
      else if (cur.miniType === 'allemalen') answered = cur.miniStage === 'rank' ? !!cur.rankVotes?.[id] : !!cur.allDrawDone?.[id];
      else if (cur.miniType === 'blackjack') answered = !!cur.bjDone?.[id];
      else if (cur.miniType === 'pong') answered = !cur.pongPlayers?.includes(id);
      else answered = false;
    }`,
'v47 answered states'));

extra.push(basePatch(
"    if (cur.miniType === 'taps') { base.startAt = cur.startAt || null; base.endAt = cur.endAt || null; }",
`    if (cur.miniType === 'taps') { base.startAt = cur.tapStarts?.[forId] || null; base.endAt = cur.tapEnds?.[forId] || null; base.tapDone = !!cur.tapDone?.[forId]; base.tapFinished = connectedIds(room).filter((id) => !!cur.tapDone?.[id]).length; base.tapTotal = connectedIds(room).length; }
    if (cur.miniType === 'allemalen') {
      const active = cur.allDrawPlayers.filter((id) => room.players[id]?.connected);
      base.miniStage = cur.miniStage; base.prompt = cur.prompt; base.drawDone = !!cur.allDrawDone?.[forId]; base.drawFinished = active.filter((id) => !!cur.allDrawDone?.[id]).length; base.drawTotal = active.length;
      if (cur.miniStage === 'draw') base.strokes = cur.allDrawStrokes?.[forId] || [];
      else { base.drawings = cur.allDrawPlayers.filter((id) => room.players[id]).map((id) => ({ id, own: id === forId, strokes: cur.allDrawStrokes[id] || [] })); base.rankSubmitted = !!cur.rankVotes?.[forId]; base.rankFinished = active.filter((id) => !!cur.rankVotes?.[id]).length; base.rankTotal = active.length; }
    }
    if (cur.miniType === 'pong') { const pair = cur.pongPlayers || []; base.pong = { leftId: pair[0] || null, rightId: pair[1] || null, leftName: displayName(room, pair[0]), rightName: displayName(room, pair[1]), youSide: forId === pair[0] ? 'left' : forId === pair[1] ? 'right' : null, paddles: cur.pongPaddles, ball: cur.pongBall, score: cur.pongScore }; }
    if (cur.miniType === 'blackjack') { const hand = cur.bjHands?.[forId] || []; base.blackjack = { hand, value: blackjackValue(hand), done: !!cur.bjDone?.[forId], dealer: [cur.bjDealer?.[0] || null, { hidden: true }] }; }`,
'v47 public game states'));

extra.push(basePatch(
`  if (cur.type === 'minigame') {
    if (cur.miniType === 'zeichnen') { const guessers = ids.filter((id) => id !== cur.drawerId); return guessers.length > 0 && guessers.every((id) => !!cur.miniCorrect[id]); }
    if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') return ids.every((id) => cur.answers[id] !== undefined);
    return false;
  }`,
`  if (cur.type === 'minigame') {
    if (cur.miniType === 'zeichnen') { const guessers = ids.filter((id) => id !== cur.drawerId); return guessers.length > 0 && guessers.every((id) => !!cur.miniCorrect[id]); }
    if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') return ids.every((id) => cur.answers[id] !== undefined);
    if (cur.miniType === 'taps') return ids.every((id) => !!cur.tapDone?.[id]);
    if (cur.miniType === 'allemalen') { if (cur.miniStage !== 'rank') return false; const active = cur.allDrawPlayers.filter((id) => room.players[id]?.connected); return active.length > 0 && active.every((id) => !!cur.rankVotes?.[id]); }
    if (cur.miniType === 'blackjack') return ids.every((id) => !!cur.bjDone?.[id]);
    return false;
  }`,
'v47 all answered'));

extra.push(basePatch(
`  if (type === 'minigame') {
    cur.miniType = nextMiniType(room); cur.label = miniLabel(cur.miniType); const now = Date.now();
    if (cur.miniType === 'zeichnen') { total = 45; cur.text = 'Zeichnen & Raten'; cur.drawerId = chooseDrawer(room); room.lastDrawer = cur.drawerId; cur.prompt = pickDrawPrompt(room); cur.startedAt = now; cur.strokes = []; cur.guessFeed = []; cur.miniCorrect = {}; cur.miniNear = {}; }
    if (cur.miniType === 'reaktion') { total = 9; cur.text = 'Tippe erst, wenn die Fläche grün wird!'; cur.goAt = now + 1900 + Math.floor(Math.random() * 2600); cur.lastFalseStartAt = 0; }
    if (cur.miniType === 'taps') { total = 14; cur.text = 'Erster Tap startet für alle den Countdown. Danach laufen 7 Sekunden.'; cur.startAt = null; cur.endAt = null; cur.tapCounts = {}; }
    if (cur.miniType === 'farbfolge') { total = 15; cur.text = 'Merke dir die Farbfolge.'; cur.sequence = randomSequence(6); cur.showAt = now + 900; cur.inputAt = cur.showAt + cur.sequence.length * 760 + 650; }
    cur.total = total;
  }
  cur.deadline = Date.now() + total * 1000;`,
`  if (type === 'minigame') {
    cur.miniType = nextMiniType(room); cur.label = miniLabel(cur.miniType); const now = Date.now();
    if (cur.miniType === 'zeichnen') { total = 45; cur.text = 'Zeichnen & Raten'; cur.drawerId = chooseDrawer(room); room.lastDrawer = cur.drawerId; cur.prompt = pickDrawPrompt(room); cur.startedAt = now; cur.strokes = []; cur.guessFeed = []; cur.miniCorrect = {}; cur.miniNear = {}; }
    if (cur.miniType === 'allemalen') { total = 40; cur.text = 'Alle malen dasselbe Wort.'; cur.prompt = pickDrawPrompt(room); cur.miniStage = 'draw'; cur.allDrawPlayers = connectedIds(room); cur.allDrawStrokes = {}; cur.allDrawDone = {}; cur.rankVotes = {}; cur.allDrawPlayers.forEach((id) => { cur.allDrawStrokes[id] = []; }); }
    if (cur.miniType === 'reaktion') { total = 9; cur.text = 'Tippe erst, wenn die Fläche grün wird!'; cur.goAt = now + 1900 + Math.floor(Math.random() * 2600); cur.lastFalseStartAt = 0; }
    if (cur.miniType === 'taps') { total = 0; cur.text = 'Starte, wenn du bereit bist. Nach deinem eigenen Countdown hast du 7 Sekunden.'; cur.tapStarts = {}; cur.tapEnds = {}; cur.tapDone = {}; cur.tapCounts = {}; }
    if (cur.miniType === 'farbfolge') { total = 15; cur.text = 'Merke dir die Farbfolge.'; cur.sequence = randomSequence(6); cur.showAt = now + 900; cur.inputAt = cur.showAt + cur.sequence.length * 760 + 650; }
    if (cur.miniType === 'pong') { total = 45; cur.text = 'Pong – zwei Spieler gegeneinander.'; cur.pongPlayers = choosePongPlayers(room); cur.pongPaddles = { left: .5, right: .5 }; cur.pongScore = { left: 0, right: 0 }; resetPongBall(cur); }
    if (cur.miniType === 'blackjack') { total = 45; cur.text = 'Blackjack – näher an 21 als der Dealer.'; cur.bjPlayers = connectedIds(room); cur.bjDeck = blackjackDeck(); cur.bjHands = {}; cur.bjDone = {}; cur.bjDealer = [cur.bjDeck.pop(), cur.bjDeck.pop()]; cur.bjPlayers.forEach((id) => { cur.bjHands[id] = [cur.bjDeck.pop(), cur.bjDeck.pop()]; if (blackjackValue(cur.bjHands[id]) >= 21) cur.bjDone[id] = true; }); }
    cur.total = total;
  }
  cur.deadline = (type === 'minigame' && cur.miniType === 'taps') ? null : Date.now() + total * 1000;`,
'v47 start minigames'));

extra.push(basePatch(
"  addTimer(room, () => { if (room.phase === 'question' && room.round === round) finishRound(room, 'timeout'); }, sec * 1000 + 250);",
`  if (cur.type === 'minigame' && cur.miniType === 'allemalen') addTimer(room, () => { if (room.phase === 'question' && room.round === round && room.current === cur && cur.miniStage === 'draw') beginAllDrawRank(room); }, 40000);
  if (cur.type === 'minigame' && cur.miniType === 'pong') startPongLoop(room, round);
  if (!(cur.type === 'minigame' && ['taps', 'allemalen'].includes(cur.miniType))) addTimer(room, () => { if (room.phase === 'question' && room.round === round) finishRound(room, 'timeout'); }, sec * 1000 + 250);`,
'v47 minigame scheduling'));

extra.push(basePatch(
"    result.label = miniLabel(cur.miniType);",
"    result.label = miniLabel(cur.miniType); result.miniType = cur.miniType;",
'v47 result mini type'));

extra.push(basePatch(
`    result.drinkers = giveSips(room, sipMap); room.lastResult = result; room.phase = 'results'; broadcast(room); return;`,
`    if (cur.miniType === 'allemalen') {
      const players = cur.allDrawPlayers.filter((id) => room.players[id]); const scores = {}; players.forEach((id) => { scores[id] = 0; });
      for (const order of Object.values(cur.rankVotes || {})) if (Array.isArray(order)) order.forEach((id, index) => { if (scores[id] !== undefined) scores[id] += Math.max(1, order.length - index); });
      const rows = players.map((id) => ({ id, score: scores[id] || 0 })).sort((a, b) => b.score - a.score || displayName(room, a.id).localeCompare(displayName(room, b.id)));
      const values = rows.map((r) => r.score); const max = values.length ? Math.max(...values) : 0; const min = values.length ? Math.min(...values) : 0;
      rows.forEach((row) => { const p = max === min ? 0 : (max - row.score) / Math.max(1, max - min); sipMap[row.id] = p < .34 ? 0 : p < .75 ? 1 : 2; });
      result.answer = cur.prompt; result.miniRows = rows.map((row) => ({ name: displayName(room, row.id), label: row.score + ' Ranking-Punkte' })); result.drawings = rows.map((row) => ({ name: displayName(room, row.id), score: row.score, strokes: cur.allDrawStrokes[row.id] || [] }));
      result.lines.push(max === min ? 'Unentschieden – alle Zeichnungen bleiben trocken.' : 'Die Gruppe hat gerankt: oben trocken, unten höchstens zwei Schlücke.');
    }
    if (cur.miniType === 'pong') {
      const pair = cur.pongPlayers || []; const l = Number(cur.pongScore?.left || 0); const r = Number(cur.pongScore?.right || 0); result.miniRows = [{ name: displayName(room, pair[0]), label: l + ' Punkte' }, { name: displayName(room, pair[1]), label: r + ' Punkte' }];
      if (l !== r) { const loser = l < r ? pair[0] : pair[1]; sipMap[loser] = Math.max(l, r) >= 3 && Math.min(l, r) === 0 ? 2 : 1; result.lines.push(displayName(room, l > r ? pair[0] : pair[1]) + ' gewinnt ' + l + ':' + r + '.'); } else result.lines.push('Pong endet unentschieden – niemand trinkt.');
    }
    if (cur.miniType === 'blackjack') {
      while (blackjackValue(cur.bjDealer) < 17 && cur.bjDeck.length) cur.bjDealer.push(cur.bjDeck.pop()); const dealer = blackjackValue(cur.bjDealer); const dealerBust = dealer > 21;
      result.answer = 'Dealer: ' + dealer; result.miniRows = [];
      for (const id of cur.bjPlayers.filter((pid) => room.players[pid])) { const value = blackjackValue(cur.bjHands[id]); let label; if (value > 21) { sipMap[id] = 2; label = value + ' · Bust'; } else if (dealerBust || value > dealer) { sipMap[id] = 0; label = value + ' · gewonnen'; } else if (value === dealer) { sipMap[id] = 0; label = value + ' · Push'; } else { sipMap[id] = 1; label = value + ' · verloren'; } result.miniRows.push({ name: displayName(room, id), label }); }
      result.lines.push('Dealer hat ' + dealer + (dealerBust ? ' und ist Bust.' : '.'));
    }
    result.drinkers = giveSips(room, sipMap); room.lastResult = result; room.phase = 'results'; broadcast(room); return;`,
'v47 extra minigame results'));

extra.push(basePatch(
`    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {`,
`    if (msg.t === 'allDrawStroke' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'draw') {
      const cur = room.current; if (!cur.allDrawPlayers.includes(me) || cur.allDrawDone[me]) return; const s = Array.isArray(msg.s) ? msg.s.slice(0, 5).map(Number) : null; if (!s || s.length !== 5 || s.some((n) => !Number.isFinite(n))) return;
      for (let i = 0; i < 4; i += 1) s[i] = clamp(s[i], 0, 1); s[4] = clamp(Math.round(s[4]), 0, 3); const strokes = cur.allDrawStrokes[me] || (cur.allDrawStrokes[me] = []); strokes.push(s); if (strokes.length > 900) strokes.shift(); return;
    }
    if (msg.t === 'allDrawClear' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'draw') { if (!room.current.allDrawDone[me]) room.current.allDrawStrokes[me] = []; return; }
    if (msg.t === 'allDrawDone' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'draw') { const cur = room.current; if (!cur.allDrawPlayers.includes(me)) return; cur.allDrawDone[me] = true; const active = cur.allDrawPlayers.filter((id) => room.players[id]?.connected); if (active.length && active.every((id) => !!cur.allDrawDone[id])) beginAllDrawRank(room); else broadcast(room); return; }
    if (msg.t === 'allDrawRank' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'rank') { const cur = room.current; if (cur.rankVotes[me]) return; const expected = cur.allDrawPlayers.filter((id) => id !== me && room.players[id]?.connected); const order = Array.isArray(msg.order) ? msg.order.map(String) : []; if (order.length !== expected.length || new Set(order).size !== order.length || order.some((id) => !expected.includes(id))) return; cur.rankVotes[me] = order; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }
    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {`,
'v47 all draw handlers'));

extra.push(basePatch(
`    if (msg.t === 'miniTapStart' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {
      const cur = room.current; if (cur.startAt || cur.endAt) return; const now = Date.now(); const round = room.round; cur.startAt = now + 1200; cur.endAt = cur.startAt + 7000; cur.total = 9; cur.deadline = cur.endAt + 500; clearTimers(room); addTimer(room, () => { if (room.phase === 'question' && room.round === round && room.current === cur) finishRound(room, 'timeout'); }, Math.max(250, cur.endAt - Date.now() + 250)); broadcast(room); return;
    }`,
`    if (msg.t === 'miniTapStart' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {
      const cur = room.current; if (cur.tapStarts?.[me] || cur.tapDone?.[me]) return; const now = Date.now(); const round = room.round; const startAt = now + 3000; const endAt = startAt + 7000; cur.tapStarts[me] = startAt; cur.tapEnds[me] = endAt; broadcast(room);
      addTimer(room, () => { if (room.phase !== 'question' || room.round !== round || room.current !== cur) return; cur.tapDone[me] = true; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); }, Math.max(250, endAt - Date.now() + 550)); return;
    }`,
'v47 personal tap start'));

extra.push(basePatch(
`    if (msg.t === 'miniTap' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {
      const cur = room.current; const now = Date.now(); if (!cur.startAt || !cur.endAt || now < cur.startAt || now > cur.endAt + 500) return; const n = clamp(Math.round(Number(msg.n) || 0), 0, 30); if (!n) return; cur.tapCounts[me] = clamp((cur.tapCounts[me] || 0) + n, 0, 500); return;
    }`,
`    if (msg.t === 'miniTap' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {
      const cur = room.current; const now = Date.now(); const startAt = cur.tapStarts?.[me]; const endAt = cur.tapEnds?.[me]; if (!startAt || !endAt || cur.tapDone?.[me] || now < startAt || now > endAt + 500) return; const n = clamp(Math.round(Number(msg.n) || 0), 0, 30); if (!n) return; cur.tapCounts[me] = clamp((cur.tapCounts[me] || 0) + n, 0, 500); return;
    }`,
'v47 personal tap count'));

extra.push(basePatch(
`    if (msg.t === 'miniMemory' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'farbfolge') {`,
`    if (msg.t === 'pongMove' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'pong') { const cur = room.current; const side = me === cur.pongPlayers?.[0] ? 'left' : me === cur.pongPlayers?.[1] ? 'right' : null; if (!side) return; const y = Number(msg.y); if (!Number.isFinite(y)) return; cur.pongPaddles[side] = clamp(y, .12, .88); return; }
    if (msg.t === 'blackjackHit' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'blackjack') { const cur = room.current; if (!cur.bjHands[me] || cur.bjDone[me]) return; if (cur.bjDeck.length) cur.bjHands[me].push(cur.bjDeck.pop()); if (blackjackValue(cur.bjHands[me]) >= 21) cur.bjDone[me] = true; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }
    if (msg.t === 'blackjackStand' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'blackjack') { const cur = room.current; if (!cur.bjHands[me] || cur.bjDone[me]) return; cur.bjDone[me] = true; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }
    if (msg.t === 'miniMemory' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'farbfolge') {`,
'v47 pong and blackjack handlers'));

extra.push(basePatch(
`    code: room.code, hostId: room.hostId, you: forId, cats: CATS,
    selectedCats: room.selectedCats || [...CATEGORY_ORDER], phase: room.phase, round: room.round, now: Date.now(),`,
`    code: room.code, hostId: room.hostId, you: forId, cats: CATS, miniTypes: MINI_LABELS,
    selectedCats: room.selectedCats || [...CATEGORY_ORDER], selectedMiniTypes: room.selectedMiniTypes || [...MINI_TYPES], phase: room.phase, round: room.round, now: Date.now(),`,
'v47 public mini selection'));

extra.push(basePatch(
`    if (msg.t === 'allCats' && isHost && (room.phase === 'lobby' || room.phase === 'end')) { room.selectedCats = [...CATEGORY_ORDER]; room.deck = []; room.lastCat = null; return broadcast(room); }`,
`    if (msg.t === 'allCats' && isHost && (room.phase === 'lobby' || room.phase === 'end')) { room.selectedCats = [...CATEGORY_ORDER]; room.deck = []; room.lastCat = null; return broadcast(room); }
    if (msg.t === 'toggleMini' && isHost && (room.phase === 'lobby' || room.phase === 'end')) { const type = String(msg.mini || ''); if (!MINI_TYPES.includes(type)) return; const selected = Array.isArray(room.selectedMiniTypes) && room.selectedMiniTypes.length ? [...room.selectedMiniTypes] : [...MINI_TYPES]; const idx = selected.indexOf(type); if (idx >= 0) { if (selected.length <= 1) return error('Mindestens ein Minigame muss aktiv bleiben.'); selected.splice(idx, 1); } else selected.push(type); room.selectedMiniTypes = MINI_TYPES.filter((x) => selected.includes(x)); room.miniQueue = []; room.miniDrawGuaranteed = true; room.deck = []; return broadcast(room); }
    if (msg.t === 'allMinis' && isHost && (room.phase === 'lobby' || room.phase === 'end')) { room.selectedMiniTypes = [...MINI_TYPES]; room.miniQueue = []; room.miniDrawGuaranteed = true; room.deck = []; return broadcast(room); }`,
'v47 mini selection messages'));

extra.push(basePatch(
`      if (oldRoom.phase === 'question' && ['wahrheit', 'pflicht'].includes(oldRoom.current?.type) && oldRoom.current.target === oldId) { oldRoom.current.target = rand(connectedIds(oldRoom)); oldRoom.current.answers = {}; return broadcast(oldRoom); }
      if (oldRoom.phase === 'question' && allAnswered(oldRoom)) finishRound(oldRoom, 'complete'); else broadcast(oldRoom); return;`,
`      if (oldRoom.phase === 'question' && ['wahrheit', 'pflicht'].includes(oldRoom.current?.type) && oldRoom.current.target === oldId) { oldRoom.current.target = rand(connectedIds(oldRoom)); oldRoom.current.answers = {}; return broadcast(oldRoom); }
      if (oldRoom.phase === 'question' && oldRoom.current?.type === 'minigame' && oldRoom.current.miniType === 'allemalen' && oldRoom.current.miniStage === 'draw') { const active = oldRoom.current.allDrawPlayers.filter((id) => oldRoom.players[id]?.connected); if (active.length && active.every((id) => !!oldRoom.current.allDrawDone[id])) { beginAllDrawRank(oldRoom); return; } }
      if (oldRoom.phase === 'question' && allAnswered(oldRoom)) finishRound(oldRoom, 'complete'); else broadcast(oldRoom); return;`,
'v47 leave during all draw'));

extra.push(basePatch(
"imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, inviteLinks: true, masterTransfer: true })); return; }",
"imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true })); return; }",
'v47 health flags'));

const runtimeAnchor = 'const runtime = new Module(basePath, module.parent || module);';
src = patch(src, runtimeAnchor, extra.join('\n') + '\n\n' + runtimeAnchor, 'inject v4.7 base patches');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
