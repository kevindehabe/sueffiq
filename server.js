'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const baseQ = require('./questions');
const extraQ = require('./extras');
const moreQ = require('./more');
const songs = require('./songs');
const hardenFrontend = require('./frontend-v45');
const pwaHandler = require('./pwa-v45');
const {
  normalizeText,
  similarity,
  voteSipMap,
  estimateResults,
  binaryMinority,
  majorityResults,
  scaleResults,
  matchPersonGuess,
} = require('./logic');

const VERSION = '4.5.0';
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const wikiCache = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SONG_SNIPPETS = [1, 3, 7, 12]; // Legacy public fields; scoring is elapsed-time based.

const Q = {};
for (const key of new Set([...Object.keys(baseQ), ...Object.keys(extraQ), ...Object.keys(moreQ)])) {
  const a = Array.isArray(baseQ[key]) ? baseQ[key] : [];
  const b = Array.isArray(extraQ[key]) ? extraQ[key] : [];
  const c = Array.isArray(moreQ[key]) ? moreQ[key] : [];
  Q[key] = [...a, ...b, ...c];
}
Q.song = songs;

const CATS = {
  nie: 'Ich hab noch nie',
  wahl: 'Wer würde eher',
  schaetz: 'Schätzfrage',
  oder: 'Entweder oder',
  trivia: '4-Antwort-Quiz',
  wahrheit: 'Wahrheit 18+',
  pflicht: 'Pflicht',
  person: 'Errate die Person',
  bild: 'Wer ist das?',
  song: 'Errate den Song',
  mehrheit: 'Mehrheit',
  skala: 'Skala',
};
const CATEGORY_ORDER = Object.keys(CATS);
const ROUND_SECONDS = {
  nie: 30, wahl: 30, schaetz: 35, oder: 30, trivia: 30, wahrheit: 35,
  pflicht: 35, person: 45, bild: 30, song: 55, mehrheit: 30, skala: 30,
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
  do { code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function cleanName(name, fallback = 'Spieler') {
  const value = String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 18);
  return value || fallback;
}
function createRoom() {
  const room = {
    code: makeCode(), hostId: null, players: {}, order: [], phase: 'lobby', round: 0,
    current: null, lastResult: null, used: {}, deck: [], lastCat: null, timers: [], createdAt: Date.now(),
    selectedCats: [...CATEGORY_ORDER], socialFlip: undefined, adultFlip: undefined, groupFlip: undefined,
  };
  rooms.set(room.code, room);
  return room;
}
function connectedIds(room) { return room.order.filter((id) => room.players[id] && room.players[id].connected); }
function songPlayers(room) { return connectedIds(room); }
function displayName(room, id) { return room.players[id] ? room.players[id].name : 'Unbekannt'; }

function buildDeck(room) {
  if (room.socialFlip === undefined) room.socialFlip = Math.random() < 0.5;
  if (room.adultFlip === undefined) room.adultFlip = Math.random() < 0.5;
  if (room.groupFlip === undefined) room.groupFlip = Math.random() < 0.5;

  const social = room.socialFlip ? 'nie' : 'wahl';
  const adult = room.adultFlip ? 'wahrheit' : 'pflicht';
  const group = room.groupFlip ? 'mehrheit' : 'skala';
  room.socialFlip = !room.socialFlip;
  room.adultFlip = !room.adultFlip;
  room.groupFlip = !room.groupFlip;

  const selected = (Array.isArray(room.selectedCats) && room.selectedCats.length ? room.selectedCats : CATEGORY_ORDER)
    .filter((cat) => CATEGORY_ORDER.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);

  let deck;
  if (selected.length === CATEGORY_ORDER.length) {
    deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group]
      .filter((cat) => selected.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);
  } else {
    deck = [...selected];
    const target = Math.max(10, selected.length);
    const customWeights = { schaetz: 5, wahl: 3, trivia: 3, song: 3, person: 2, bild: 2, nie: 2, mehrheit: 2, skala: 2, oder: 2, wahrheit: 2, pflicht: 2 };
    const bag = [];
    for (const cat of selected) for (let i = 0; i < (customWeights[cat] || 1); i += 1) bag.push(cat);
    while (deck.length < target && bag.length) deck.push(rand(bag));
  }

  deck = shuffle(deck);
  if (deck.length > 1 && deck[0] === room.lastCat) {
    const swap = deck.findIndex((x) => x !== room.lastCat);
    if (swap > 0) [deck[0], deck[swap]] = [deck[swap], deck[0]];
  }
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
  if (cat === room.lastCat && room.deck.length) { room.deck.push(cat); cat = room.deck.shift(); }
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
function clearTimers(room) { for (const timer of room.timers) clearTimeout(timer); room.timers = []; }
function addTimer(room, fn, ms) { const timer = setTimeout(fn, ms); room.timers.push(timer); return timer; }
function send(ws, payload) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload)); }

function playerPublic(room, id) {
  const p = room.players[id];
  const cur = room.current;
  let answered = false;
  if (cur) {
    if (cur.type === 'person' || cur.type === 'bild') answered = !!cur.personCorrect?.[id];
    else if (cur.type === 'song') answered = !!cur.songCorrect?.[id];
    else if (cur.type === 'wahrheit' || cur.type === 'pflicht') answered = id === cur.target && cur.answers[id] !== undefined;
    else answered = cur.answers[id] !== undefined;
  }
  return { id, name: p.name, drinks: p.drinks, connected: p.connected, answered };
}
function currentPublic(room, forId) {
  const cur = room.current;
  if (!cur) return null;
  const base = {
    type: cur.type, label: CATS[cur.type], text: cur.text, options: cur.options,
    target: cur.target, deadline: cur.deadline, total: cur.total,
  };
  if (cur.type === 'person' || cur.type === 'bild') {
    base.guessFeed = cur.guessFeed.slice(-20);
    base.yourStatus = cur.personCorrect[forId]
      ? { status: 'correct', hint: cur.personCorrect[forId] }
      : cur.personNear[forId] ? { status: 'near' } : null;
  }
  if (cur.type === 'person') {
    base.hints = cur.person.hints.slice(0, cur.hintIndex + 1);
    base.hintIndex = cur.hintIndex;
    base.hintCount = cur.person.hints.length;
  }
  if (cur.type === 'bild') {
    base.imageUrl = cur.imageUrl;
    base.imageSource = cur.imageSource;
    base.blurStep = cur.blurStep;
    base.blurSteps = 5;
  }
  if (cur.type === 'song') {
    base.isHost = forId === room.hostId;
    base.songStage = cur.songStage;
    base.songSnippets = SONG_SNIPPETS;
    base.guessFeed = cur.guessFeed.slice(-20);
    base.yourStatus = cur.songCorrect[forId]
      ? { status: 'correct', hint: cur.songCorrect[forId] }
      : cur.songNear[forId] ? { status: 'near' } : null;
    base.videoId = cur.song.videoId;
    base.startSeconds = cur.song.start || 0;
    base.songStartedAt = cur.songStartedAt || null;
  }
  if (cur.type === 'wahrheit' || cur.type === 'pflicht') base.isTarget = cur.target === forId;
  return base;
}
function publicState(room, forId) {
  return {
    code: room.code, hostId: room.hostId, you: forId, cats: CATS,
    selectedCats: room.selectedCats || [...CATEGORY_ORDER], phase: room.phase, round: room.round, now: Date.now(),
    players: room.order.filter((id) => room.players[id]).map((id) => playerPublic(room, id)),
    current: currentPublic(room, forId), result: room.phase === 'results' ? room.lastResult : null, version: VERSION,
  };
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

function matchSongGuess(song, rawGuess) {
  const guess = normalizeText(rawGuess);
  if (guess.length < 2) return { status: 'wrong' };
  const titles = [song.title, ...(song.aliases || [])].map(normalizeText).filter(Boolean);
  const artistFull = normalizeText(song.artist);
  const artistParts = String(song.artist || '')
    .split(/\s+(?:feat\.?|ft\.?)\s+|\s*&\s*|\s+x\s+/i)
    .map(normalizeText).filter(Boolean);
  for (const title of titles) {
    if (guess === title) return { status: 'correct' };
    if (guess.length >= 5 && (guess.includes(title) || title.includes(guess)) && Math.min(guess.length, title.length) / Math.max(guess.length, title.length) >= 0.7) return { status: 'correct' };
    if (similarity(guess, title) >= 0.84) return { status: 'correct' };
  }
  if (artistFull && (guess === artistFull || similarity(guess, artistFull) >= 0.84)) return { status: 'artist' };
  if (artistParts.some((artist) => guess === artist || similarity(guess, artist) >= 0.88)) return { status: 'artist' };
  const best = Math.max(...titles.map((title) => similarity(guess, title)), 0);
  return best >= 0.68 ? { status: 'near' } : { status: 'wrong' };
}

function finishRound(room, reason = 'complete') {
  if (room.phase !== 'question' || !room.current) return;
  clearTimers(room);
  const cur = room.current;
  const ids = connectedIds(room);
  const answeredIds = Object.keys(cur.answers || {});
  const result = { type: cur.type, label: CATS[cur.type], text: cur.text, reason, lines: [], drinkers: [] };
  const sipMap = {};

  if (cur.type === 'nie') {
    const yes = answeredIds.filter((id) => cur.answers[id] === 'ja');
    if (yes.length) {
      const rarity = clamp(Math.ceil((1 - yes.length / Math.max(1, answeredIds.length)) * 3), 1, 3);
      yes.forEach((id) => { sipMap[id] = rarity; });
      result.lines.push(`${yes.length} von ${answeredIds.length} haben's getan.`);
    } else result.lines.push('Niemand gibt es zu. Sehr verdächtig.');
  }
  if (cur.type === 'wahl') {
    const out = voteSipMap(cur.answers, 5);
    Object.assign(sipMap, out.sips);
    result.votes = Object.entries(out.counts).filter(([id]) => room.players[id]).map(([id, n]) => ({ name: displayName(room, id), n })).sort((a, b) => b.n - a.n);
    result.lines.push('Jede Stimme zählt als ein Schluck – maximal fünf.');
  }
  if (cur.type === 'schaetz') {
    const rows = estimateResults(cur.answers, cur.answer, 5);
    rows.forEach((row) => { sipMap[row.id] = row.sips; });
    result.answer = cur.answer;
    result.unit = cur.unit;
    result.guesses = rows.map((row) => ({ id: row.id, name: displayName(room, row.id), guess: row.guess, diff: row.diff, sips: row.sips }));
    const best = rows.filter((r) => r.sips === 0);
    if (best.length) result.lines.push(`Am nächsten: ${best.map((r) => displayName(room, r.id)).join(', ')} – trocken.`);
  }
  if (cur.type === 'oder') {
    const out = binaryMinority(cur.answers, 3);
    Object.assign(sipMap, out.sipsByPlayer);
    result.votes = cur.options.map((name, i) => ({ name, n: out.counts[String(i)] || 0 }));
    result.lines.push(Object.keys(out.sipsByPlayer).length ? 'Die Minderheit trinkt.' : 'Gleichstand: niemand trinkt.');
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
  if (cur.type === 'person' || cur.type === 'bild') {
    result.answer = cur.person.name;
    result.guesses = cur.guessFeed.slice();
    if (cur.type === 'bild') { result.imageUrl = cur.imageUrl; result.imageSource = cur.imageSource; }
    for (const id of ids) {
      const solvedAt = cur.personCorrect[id];
      sipMap[id] = solvedAt ? clamp(solvedAt - 1, 0, 4) : 5;
    }
    result.lines.push(cur.type === 'bild' ? 'Je früher trotz Unschärfe erkannt, desto besser.' : 'Früh erkannt = trocken. Mit jedem weiteren Hinweis steigt die Strafe.');
  }
  if (cur.type === 'song') {
    result.answer = `${cur.song.title} – ${cur.song.artist}`;
    result.videoId = cur.song.videoId;
    result.guesses = cur.guessFeed.slice();
    const participants = songPlayers(room);
    if (reason !== 'broken') {
      for (const id of participants) {
        const solvedAt = cur.songCorrect[id];
        sipMap[id] = solvedAt ? clamp(solvedAt - 1, 0, 4) : 5;
      }
      const solved = participants.filter((id) => cur.songCorrect[id]).length;
      result.lines.push(`${solved} von ${participants.length} haben den Song erkannt.`);
      result.lines.push('Je schneller der Song erkannt wurde, desto weniger Schlücke.');
    } else result.lines.push('Der Song konnte nicht abgespielt werden. Runde ohne Strafe übersprungen.');
  }
  if (cur.type === 'mehrheit') {
    const out = majorityResults(cur.answers, 5);
    Object.assign(sipMap, out.sipsByPlayer);
    result.votes = cur.options.map((name, i) => ({ name, n: out.counts[String(i)] || 0 }));
    result.lines.push(out.winners.length > 1 ? 'Mehrheits-Gleichstand – die Top-Antworten bleiben trocken.' : 'Je weiter hinter der Mehrheit, desto mehr Schlücke.');
  }
  if (cur.type === 'skala') {
    const out = scaleResults(cur.answers, 5);
    out.rows.forEach((row) => { sipMap[row.id] = row.sips; });
    result.median = out.median;
    result.scale = out.rows.map((row) => ({ id: row.id, name: displayName(room, row.id), value: row.value, sips: row.sips }));
    result.lines.push(`Gruppenmitte: ${Number.isInteger(out.median) ? out.median : out.median.toFixed(1)}.`);
  }
  if (reason === 'timeout' && !['person', 'bild', 'song', 'wahrheit', 'pflicht'].includes(cur.type)) {
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
  if (cur.type === 'person' || cur.type === 'bild') return ids.every((id) => !!cur.personCorrect[id]);
  if (cur.type === 'song') {
    const participants = songPlayers(room);
    return participants.length > 0 && participants.every((id) => !!cur.songCorrect[id]);
  }
  return ids.every((id) => cur.answers[id] !== undefined);
}

async function resolveWikiImage(person) {
  const key = `${person.lang || 'de'}:${person.page}`;
  if (wikiCache.has(key)) return wikiCache.get(key);
  const lang = person.lang || 'de';
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(person.page)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const response = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': `SueffIQ/${VERSION} (https://github.com/kevindehabe/sueffiq)` } });
    if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
    const data = await response.json();
    const imageUrl = data.thumbnail?.source || data.originalimage?.source;
    if (!imageUrl) throw new Error('Kein Bild');
    const out = { imageUrl, source: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${person.page}` };
    wikiCache.set(key, out);
    return out;
  } finally { clearTimeout(timer); }
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
  if (cur.type === 'bild') {
    const step = 4000;
    for (let i = 1; i < 5; i += 1) {
      addTimer(room, () => {
        if (room.phase !== 'question' || room.round !== round || room.current.type !== 'bild') return;
        room.current.blurStep = Math.max(room.current.blurStep, i);
        broadcast(room);
      }, step * i);
    }
  }
  addTimer(room, () => {
    if (room.phase === 'question' && room.round === round) finishRound(room, 'timeout');
  }, sec * 1000 + 250);
}

async function startRound(room) {
  clearTimers(room);
  room.phase = 'loading';
  room.round += 1;
  const type = nextCategory(room);
  const total = ROUND_SECONDS[type] || 30;
  const cur = { type, label: CATS[type], answers: {}, total, deadline: Date.now() + total * 1000 };

  if (type === 'nie' || type === 'wahl' || type === 'skala') cur.text = pick(room, type);
  if (type === 'schaetz') { const q = pick(room, type); cur.text = q.unit ? `${q.q} (Antwort in ${q.unit})` : q.q; cur.answer = q.a; cur.unit = q.unit; }
  if (type === 'oder') { cur.text = 'Entweder oder?'; cur.options = pick(room, type); }
  if (type === 'trivia') { const q = pick(room, type); cur.text = q.q; cur.options = q.o; cur.correct = q.c; }
  if (type === 'mehrheit') { const q = pick(room, type); cur.text = q.q; cur.options = q.o; }
  if (type === 'wahrheit' || type === 'pflicht') { cur.target = rand(connectedIds(room)); cur.text = pick(room, type); }
  if (type === 'person') {
    cur.text = 'Wer ist die gesuchte Person?';
    cur.person = pick(room, type); cur.hintIndex = 0; cur.guessFeed = []; cur.personCorrect = {}; cur.personNear = {};
  }
  if (type === 'bild') {
    cur.text = 'Wer ist das? Das Bild wird immer schärfer.';
    cur.guessFeed = []; cur.personCorrect = {}; cur.personNear = {}; cur.blurStep = 0;
    let person = null; let resolved = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      person = pick(room, type);
      try { resolved = await resolveWikiImage(person); break; } catch {}
    }
    if (!resolved) {
      room.round -= 1; room.deck.unshift('person'); room.phase = 'results';
      room.lastResult = { type: 'bild', label: CATS.bild, text: 'Bildrunde übersprungen', lines: ['Wikipedia war gerade nicht erreichbar. Die nächste Runde kann normal weitergehen.'], drinkers: [] };
      broadcast(room); return;
    }
    cur.person = person; cur.imageUrl = resolved.imageUrl; cur.imageSource = resolved.source;
  }
  if (type === 'song') {
    cur.text = 'Welcher Song läuft?';
    cur.song = pick(room, 'song');
    cur.songStage = 0;
    cur.songStartedAt = null;
    cur.guessFeed = [];
    cur.songCorrect = {};
    cur.songNear = {};
  }

  cur.deadline = Date.now() + total * 1000;
  room.current = cur;
  room.phase = 'question';
  scheduleRound(room);
  broadcast(room);
}

function answerCurrent(room, me, value) {
  const cur = room.current;
  if (!cur || room.phase !== 'question' || ['person', 'bild', 'song'].includes(cur.type)) return;
  if (cur.type === 'nie') cur.answers[me] = value === 'ja' ? 'ja' : 'nein';
  else if (cur.type === 'wahl') { if (!room.players[value]) return; cur.answers[me] = value; }
  else if (cur.type === 'schaetz') { const n = Number(String(value).replace(',', '.')); if (!Number.isFinite(n) || Math.abs(n) > 1e12) return; cur.answers[me] = n; }
  else if (cur.type === 'oder') { const i = Number(value); if (![0, 1].includes(i)) return; cur.answers[me] = i; }
  else if (cur.type === 'trivia' || cur.type === 'mehrheit') { const i = Number(value); if (!Number.isInteger(i) || i < 0 || i >= cur.options.length) return; cur.answers[me] = i; }
  else if (cur.type === 'skala') { const n = Number(value); if (!Number.isInteger(n) || n < 1 || n > 10) return; cur.answers[me] = n; }
  else if (cur.type === 'wahrheit' || cur.type === 'pflicht') { if (me !== cur.target) return; cur.answers[me] = value === 'done' ? 'done' : 'drink'; }
  else return;
  if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room);
}

function guessCurrent(room, me, rawGuess) {
  const cur = room.current;
  if (!cur || room.phase !== 'question' || !['person', 'bild', 'song'].includes(cur.type)) return;
  if (cur.type === 'song') {
    if (cur.songCorrect[me]) return;
    const guess = String(rawGuess || '').trim().slice(0, 64);
    if (guess.length < 2) return;
    const match = matchSongGuess(cur.song, guess);
    const elapsedMs = cur.songStartedAt ? Math.max(0, Date.now() - cur.songStartedAt) : 0;
    const stage = elapsedMs <= 5000 ? 1 : elapsedMs <= 12000 ? 2 : elapsedMs <= 22000 ? 3 : elapsedMs <= 35000 ? 4 : 5;
    if (match.status === 'correct') {
      cur.songCorrect[me] = stage; cur.songNear[me] = false;
      send(room.players[me].ws, { t: 'guessFeedback', status: 'correct', m: 'Richtig! Dein Tipp bleibt geheim.' });
    } else if (match.status === 'artist') {
      cur.songNear[me] = true;
      send(room.players[me].ws, { t: 'guessFeedback', status: 'near', m: 'Interpret stimmt – jetzt fehlt noch der Songtitel.' });
    } else if (match.status === 'near') {
      cur.songNear[me] = true;
      send(room.players[me].ws, { t: 'guessFeedback', status: 'near', m: 'Sehr nah dran – bleibt privat.' });
    } else {
      cur.songNear[me] = false;
      cur.guessFeed.push({ name: displayName(room, me), guess, hint: stage });
      if (cur.guessFeed.length > 40) cur.guessFeed.shift();
      send(room.players[me].ws, { t: 'guessFeedback', status: 'wrong', m: 'Falsch – dieser Tipp ist für alle sichtbar.' });
    }
  } else {
    if (cur.personCorrect[me]) return;
    const guess = String(rawGuess || '').trim().slice(0, 48);
    if (guess.length < 2) return;
    const match = matchPersonGuess(cur.person, guess);
    const stage = cur.type === 'person' ? cur.hintIndex + 1 : cur.blurStep + 1;
    if (match.status === 'correct') {
      cur.personCorrect[me] = stage; cur.personNear[me] = false;
      send(room.players[me].ws, { t: 'guessFeedback', status: 'correct', m: 'Richtig! Dein Tipp bleibt geheim.' });
    } else if (match.status === 'near') {
      cur.personNear[me] = true;
      send(room.players[me].ws, { t: 'guessFeedback', status: 'near', m: 'Sehr nah dran – bleibt privat.' });
    } else {
      cur.personNear[me] = false;
      cur.guessFeed.push({ name: displayName(room, me), guess, hint: stage });
      if (cur.guessFeed.length > 40) cur.guessFeed.shift();
      send(room.players[me].ws, { t: 'guessFeedback', status: 'wrong', m: 'Falsch – dieser Tipp ist für alle sichtbar.' });
    }
  }
  if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room);
}

function setSongStage(room, me, value) {
  const cur = room.current;
  if (!cur || room.phase !== 'question' || cur.type !== 'song' || room.hostId !== me) return;
  const stage = clamp(Number(value) || 0, 0, SONG_SNIPPETS.length - 1);
  cur.songStage = Math.max(cur.songStage, stage);
  broadcast(room);
}

function retargetTruthOrDare(room, oldId) {
  if (room.phase !== 'question' || !['wahrheit', 'pflicht'].includes(room.current?.type) || room.current.target !== oldId) return false;
  const ids = connectedIds(room);
  if (!ids.length) return false;
  room.current.target = rand(ids);
  room.current.answers = {};
  broadcast(room);
  return true;
}
function leaveRoom(room, me) {
  if (!room || !room.players[me]) return;
  room.players[me].connected = false;
  room.players[me].ws = null;
  if (room.hostId === me) room.hostId = connectedIds(room)[0] || null;
  if (retargetTruthOrDare(room, me)) return;
  if (room.phase === 'question' && allAnswered(room)) finishRound(room, 'complete');
  else broadcast(room);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Frontend-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}
function buildHtml() {
  let html = fs.readFileSync(path.join(__dirname, 'public', 'v4.html'), 'utf8');
  html = html.replace('SüffIQ v4.0', `SüffIQ v${VERSION}`);
  html = html.replace(
    '</style>',
    '.yt-stealth{position:fixed;left:-10000px;top:0;width:240px;height:240px;overflow:hidden;pointer-events:none;opacity:.01}.song-play{font-size:20px;padding:19px 16px}.yt-reveal{margin-top:14px}.yt-reveal iframe{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:14px}.mix-note{margin-top:8px;color:var(--muted);font-size:11px;text-align:center}</style>'
  );
  html = replaceRequired(
    html,
    "var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false;",
    "var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false,pendingSync=null,syncTimer=null;",
    'song vars'
  );
  html = html.replace(
    /function songHostHtml\(cur\)\{[\s\S]*?\n\}\nfunction songPlayerHtml\(cur\)\{[\s\S]*?\n\}/,
    `function songHostHtml(cur){
  return '<div id="songHostPanel"><div class="dj"><div class="dj-title">🎵 Errate den Song</div><div class="meta">Ein Play-Knopf startet denselben Song auf allen Geräten. Der Song läuft anschließend am Stück.</div></div>'+ '<button id="songPlay" class="btn primary song-play">▶ Song starten</button>'+ '<div class="yt-stealth" aria-hidden="true"><div id="ytPlayer"></div></div>'+ '<div style="height:10px"></div>'+guessHtml(cur,'Songtitel eingeben …')+'<button id="songBroken" class="btn ghost" style="margin-top:10px">Song funktioniert nicht · Runde überspringen</button></div>';
}
function songPlayerHtml(cur){
  return '<div class="song-stage">🎵 Songrunde</div><div class="note" style="margin-bottom:12px">Sobald der Host auf Play drückt, startet der Song auch auf diesem Gerät.</div><div class="yt-stealth" aria-hidden="true"><div id="ytPlayer"></div></div>'+guessHtml(cur,'Songtitel eingeben …');
}`
  );
  html = html.replace(
    /function createYTPlayer\(cur\)\{[\s\S]*?\n\}\nfunction playSnippet\(stage\)\{[\s\S]*?\n\}\nfunction bind\(\)\{/,
    `function createYTPlayer(cur){
  if(!document.getElementById('ytPlayer')||ytPlayer)return;
  try{
    ytPlayer=new YT.Player('ytPlayer',{
      height:'240',width:'240',videoId:cur.videoId,
      host:'https://www.youtube-nocookie.com',
      playerVars:{controls:0,playsinline:1,autoplay:0,rel:0,origin:location.origin},
      events:{
        onReady:function(){
          ytPlayerReady=true;
          try{ytPlayer.cueVideoById({videoId:cur.videoId,startSeconds:Number(cur.startSeconds||0)});}catch(e){}
          if(pendingSync){var p=pendingSync;pendingSync=null;playSyncedSong(p);}
        },
        onError:function(){ytPlayerReady=false;toast('Dieser Song kann hier nicht abgespielt werden.');}
      }
    });
  }catch(e){toast('Song konnte nicht geladen werden.');}
}
function playSyncedSong(m){
  var cur=state&&state.current;if(!cur||cur.type!=='song')return;
  if(!ytPlayer||!ytPlayerReady){pendingSync=m;ensureYTApi(cur);return;}
  if(syncTimer){clearTimeout(syncTimer);syncTimer=null;}
  var delay=Math.max(0,Number(m.at||Date.now())-Date.now());
  syncTimer=setTimeout(function(){
    if(!state||!state.current||state.current.type!=='song')return;
    var late=Math.max(0,(Date.now()-Number(m.at||Date.now()))/1000);
    var start=Number(m.startSeconds||0)+late;
    try{
      if(ytPlayer.unMute)ytPlayer.unMute();
      if(ytPlayer.setVolume)ytPlayer.setVolume(100);
      if(ytPlayer.seekTo)ytPlayer.seekTo(start,true);
      if(ytPlayer.playVideo)ytPlayer.playVideo();
    }catch(e){toast('Song konnte auf diesem Gerät nicht gestartet werden.');}
  },delay);
}
function playSongButton(){
  var cur=state&&state.current;if(!cur||cur.type!=='song'||!cur.isHost)return;
  send({t:'songPlay'});
}
function bind(){`
  );
  html = replaceRequired(
    html,
    "    if(m.t==='error'){toast(m.m||'Fehler');return;}\n    if(m.t==='guessFeedback'||m.t==='personFeedback'){",
    "    if(m.t==='error'){toast(m.m||'Fehler');return;}\n    if(m.t==='songPlay'){playSyncedSong(m);return;}\n    if(m.t==='guessFeedback'||m.t==='personFeedback'){",
    'song sync message'
  );
  html = replaceRequired(
    html,
    "  var load=document.getElementById('loadYT');if(load)load.onclick=function(){ensureYTApi(state.current);};\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};\n  a=document.querySelectorAll('.snippet');for(i=0;i<a.length;i++)a[i].onclick=function(){playSnippet(Number(this.getAttribute('data-stage')));};",
    "  var play=document.getElementById('songPlay');if(play)play.onclick=playSongButton;\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};",
    'single song button'
  );
  html = replaceRequired(
    html,
    "  if(r.votes&&r.votes.length){",
    "  if(r.type==='song'&&r.videoId)out+='<div class=\"yt-reveal\"><iframe src=\"https://www.youtube.com/embed/'+esc(r.videoId)+'?autoplay=1&playsinline=1&rel=0\" title=\"Musikvideo\" allow=\"autoplay; encrypted-media; picture-in-picture\" allowfullscreen></iframe></div>';\n  if(r.votes&&r.votes.length){",
    'result video'
  );
  html = replaceRequired(
    html,
    "  var songHost=state&&state.phase==='question'&&state.current&&state.current.type==='song'&&state.current.isHost;\n  if(!songHost&&ytPlayer)cleanupYouTube();",
    "  var songActive=state&&state.phase==='question'&&state.current&&state.current.type==='song';\n  if(!songActive&&ytPlayer)cleanupYouTube();",
    'song cleanup'
  );
  html = replaceRequired(
    html,
    "  bind();tick();timerLoop=setInterval(tick,250);",
    "  bind();if(songActive&&!ytPlayer)setTimeout(function(){if(state&&state.current&&state.current.type==='song')ensureYTApi(state.current);},0);tick();timerLoop=setInterval(tick,250);",
    'song preload'
  );
  html = html.replace(
    '<div class="footer">Automatischer Mix · keine Einstellungen · 18+</div>',
    '<div class="footer">Automatischer Mix · 18+</div><div class="mix-note">10-Runden-Mix: Schätzen 2× · Quiz · Person · Bild · Song · Social · Entweder/Oder · 18+ · Gruppe</div>'
  );

  html = html.replace(
    '</style>',
    '.cat-tools{display:flex;gap:8px;margin-bottom:9px}.cat-tools .mini{flex:1}.cat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cat-toggle,.cat-view{min-height:46px;border-radius:13px;padding:10px 11px;border:1px solid var(--line);background:#15101e;color:#8d8298;font-weight:850;font-size:12px;text-align:left}.cat-toggle{cursor:pointer}.cat-toggle.active,.cat-view.active{color:#11170a;background:var(--accent);border-color:var(--accent)}.cat-view{opacity:.85}.cat-help{color:var(--muted);font-size:11px;line-height:1.4;margin:8px 1px 12px}@media(max-width:380px){.cat-grid{grid-template-columns:1fr}}</style>'
  );
  html = html.replace(
    /function lobbyHtml\(\)\{[\s\S]*?\n\}\nfunction targetName/,
    "function categoryPickerHtml(){\n  var selected=state.selectedCats||Object.keys(state.cats||{}),host=state.you===state.hostId,out='';\n  if(host)out+='<div class=\\\"cat-tools\\\"><button id=\\\"allCats\\\" class=\\\"mini\\\">Alle auswählen</button><span class=\\\"mini\\\" style=\\\"text-align:center\\\">'+selected.length+' aktiv</span></div>';\n  out+='<div class=\\\"cat-grid\\\">';\n  for(var key in state.cats){var active=selected.indexOf(key)>=0,cls=host?'cat-toggle':'cat-view';out+='<button '+(host?'':'disabled')+' class=\\\"'+cls+(active?' active':'')+'\\\" data-cat=\\\"'+esc(key)+'\\\">'+(active?'✓ ':'')+esc(state.cats[key])+'</button>';}\n  out+='</div><div class=\\\"cat-help\\\">'+(host?'Tippe Kategorien an oder aus. Mindestens eine bleibt aktiv.':'Der Host hat diese Kategorien für die Runde ausgewählt.')+'</div>';\n  return out;\n}\nfunction lobbyHtml(){\n  var host=state.you===state.hostId;\n  var controls=host?'<div class=\\\"grid2\\\"><button id=\\\"start\\\" class=\\\"btn primary\\\">Spiel starten</button><button id=\\\"leaveLobby\\\" class=\\\"btn ghost\\\">Lobby verlassen</button></div>':'<div class=\\\"waiting\\\">Der Host startet das Spiel.</div><button id=\\\"leaveLobby\\\" class=\\\"btn ghost\\\">Lobby verlassen</button>';\n  return topHtml()+'<div class=\\\"card center\\\"><div class=\\\"meta\\\">Spielcode</div><div class=\\\"big-code\\\">'+esc(state.code)+'</div><div class=\\\"note\\\">Mitspieler öffnen dieselbe Seite und geben diesen Code ein.</div></div><div class=\\\"section\\\">Kategorien</div>'+categoryPickerHtml()+'<div class=\\\"section\\\">Spieler</div>'+playersHtml()+'<div style=\\\"height:12px\\\"></div>'+controls+'<div class=\\\"footer\\\">Eigener Kategorienmix · 18+</div>';\n}\nfunction targetName"
  );
  html = html.replace(
    "  var leave=document.getElementById('leaveLobby');if(leave)leave.onclick=function(){send({t:'leave'});clearJoin();state=null;feedback=null;render();};",
    "  var leave=document.getElementById('leaveLobby');if(leave)leave.onclick=function(){send({t:'leave'});clearJoin();state=null;feedback=null;render();};\n  var allCats=document.getElementById('allCats');if(allCats)allCats.onclick=function(){send({t:'allCats'});};\n  var catBtns=document.querySelectorAll('.cat-toggle');for(i=0;i<catBtns.length;i++)catBtns[i].onclick=function(){send({t:'toggleCat',cat:this.getAttribute('data-cat')});};"
  );

  html = hardenFrontend(html);
  return html;
}

const APP_HTML = buildHtml();
const server = http.createServer((req, res) => {
  if (pwaHandler(req, res)) return;
  const url = String(req.url || '').split('?')[0];
  if (url === '/health' || url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, version: VERSION, productionServer: true, mix: '10-round-variety', syncedSongs: true, continuousSongs: true, imageStepSeconds: 4 }));
    return;
  }
  if (url === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('User-agent: *\nDisallow:\n');
    return;
  }
  if (url !== '/' && url !== '/index.html' && url !== '/v4.html') {
    res.writeHead(302, { location: '/' }); res.end(); return;
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, no-store, must-revalidate',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  res.end(APP_HTML);
});

const wss = new WebSocketServer({ server, maxPayload: 8192 });
wss.on('connection', (ws) => {
  let room = null; let me = null;
  let msgWindowAt = Date.now(); let msgCount = 0;
  const error = (m) => send(ws, { t: 'error', m });

  ws.on('message', (raw) => {
    if (raw.length > 8192) return;
    const now = Date.now();
    if (now - msgWindowAt > 10000) { msgWindowAt = now; msgCount = 0; }
    msgCount += 1;
    if (msgCount > 200) return;
    let msg; try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg.t === 'ping') return send(ws, { t: 'pong' });

    if (msg.t === 'create') {
      if (room || me) return error('Du bist bereits in einer Lobby.');
      room = createRoom(); me = uid();
      room.players[me] = { name: cleanName(msg.name, 'Host'), drinks: 0, connected: true, ws };
      room.order.push(me); room.hostId = me;
      send(ws, { t: 'joined', code: room.code, id: me });
      return broadcast(room);
    }
    if (msg.t === 'join') {
      if (room || me) return error('Du bist bereits in einer Lobby.');
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      const target = rooms.get(code);
      if (!target) return error('Diesen Spielcode gibt es nicht.');
      if (connectedIds(target).length >= 30) return error('Diese Lobby ist voll (max. 30 Spieler).');
      room = target; me = uid();
      room.players[me] = { name: cleanName(msg.name), drinks: 0, connected: true, ws };
      room.order.push(me);
      send(ws, { t: 'joined', code: room.code, id: me });
      return broadcast(room);
    }
    if (msg.t === 'rejoin') {
      if (room || me) return error('Du bist bereits in einer Lobby.');
      const target = rooms.get(String(msg.code || '').toUpperCase());
      if (!target || !target.players[msg.id]) return send(ws, { t: 'reset' });
      room = target; me = msg.id;
      const previousWs = room.players[me].ws;
      room.players[me].connected = true; room.players[me].ws = ws;
      if (previousWs && previousWs !== ws && previousWs.readyState === 1) { try { previousWs.close(4001, 'rejoined'); } catch {} }
      send(ws, { t: 'joined', code: room.code, id: me });
      return broadcast(room);
    }

    if (!room || !me || !room.players[me]) return;
    const isHost = room.hostId === me;

    if (msg.t === 'toggleCat' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {
      const cat = String(msg.cat || '');
      if (!CATEGORY_ORDER.includes(cat) || !Array.isArray(Q[cat]) || !Q[cat].length) return;
      const selected = Array.isArray(room.selectedCats) && room.selectedCats.length ? [...room.selectedCats] : [...CATEGORY_ORDER];
      const idx = selected.indexOf(cat);
      if (idx >= 0) {
        if (selected.length <= 1) return error('Mindestens eine Kategorie muss aktiv bleiben.');
        selected.splice(idx, 1);
      } else selected.push(cat);
      room.selectedCats = CATEGORY_ORDER.filter((x) => selected.includes(x));
      room.deck = []; room.lastCat = null;
      return broadcast(room);
    }
    if (msg.t === 'allCats' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {
      room.selectedCats = [...CATEGORY_ORDER]; room.deck = []; room.lastCat = null;
      return broadcast(room);
    }
    if (msg.t === 'start' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {
      if (!connectedIds(room).length) return error('Niemand ist im Raum.');
      startRound(room).catch(() => error('Runde konnte nicht gestartet werden.'));
      return;
    }
    if (msg.t === 'next' && isHost && room.phase === 'results') {
      startRound(room).catch(() => error('Runde konnte nicht gestartet werden.'));
      return;
    }
    if (msg.t === 'end' && isHost) {
      clearTimers(room); room.phase = 'end'; room.current = null;
      return broadcast(room);
    }
    if (msg.t === 'host' && isHost && room.phase === 'lobby' && room.players[msg.id]?.connected) {
      room.hostId = msg.id;
      return broadcast(room);
    }
    if (msg.t === 'leave') {
      const oldRoom = room; const oldId = me; const wasHost = oldRoom.hostId === oldId;
      send(ws, { t: 'reset' });
      delete oldRoom.players[oldId];
      oldRoom.order = oldRoom.order.filter((id) => id !== oldId);
      if (wasHost) oldRoom.hostId = connectedIds(oldRoom)[0] || null;
      room = null; me = null;
      if (!connectedIds(oldRoom).length) { clearTimers(oldRoom); rooms.delete(oldRoom.code); return; }
      if (oldRoom.phase === 'question' && ['wahrheit', 'pflicht'].includes(oldRoom.current?.type) && oldRoom.current.target === oldId) {
        oldRoom.current.target = rand(connectedIds(oldRoom));
        oldRoom.current.answers = {};
        return broadcast(oldRoom);
      }
      if (oldRoom.phase === 'question' && allAnswered(oldRoom)) finishRound(oldRoom, 'complete');
      else broadcast(oldRoom);
      return;
    }
    if (msg.t === 'answer') return answerCurrent(room, me, msg.v);
    if (msg.t === 'personGuess' || msg.t === 'guess') return guessCurrent(room, me, msg.v);
    if (msg.t === 'songPlay' && isHost && room.phase === 'question' && room.current?.type === 'song') {
      if (room.current.songStartedAt) return;
      const at = Date.now() + 1200;
      room.current.songStartedAt = at;
      const payload = { t: 'songPlay', at, videoId: room.current.song.videoId, startSeconds: room.current.song.start || 0 };
      for (const id of connectedIds(room)) send(room.players[id].ws, payload);
      return broadcast(room);
    }
    if (msg.t === 'songStage') return setSongStage(room, me, msg.v);
    if (msg.t === 'songBroken' && isHost && room.phase === 'question' && room.current?.type === 'song') return finishRound(room, 'broken');
  });

  ws.on('close', () => {
    if (!room || !me || !room.players[me]) return;
    if (room.players[me].ws !== ws) return;
    const oldRoom = room;
    leaveRoom(oldRoom, me);
    setTimeout(() => {
      if (!rooms.has(oldRoom.code)) return;
      if (!connectedIds(oldRoom).length) { clearTimers(oldRoom); rooms.delete(oldRoom.code); }
    }, 30 * 60 * 1000).unref?.();
  });
});

function shutdown() {
  for (const room of rooms.values()) clearTimers(room);
  wss.close(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`SüffIQ v${VERSION} läuft auf http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`Im WLAN: http://${ip}:${PORT}`));
});
