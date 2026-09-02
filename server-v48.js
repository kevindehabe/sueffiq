'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const basePath = path.join(__dirname, 'server-v471.js');
let src = fs.readFileSync(basePath, 'utf8');

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.8 iTunes-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}
function basePatchSource(needle, replacement, label) {
  return `extra.push(basePatch(${JSON.stringify(needle)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)}));`;
}

// Keep all v4.7 drawing/minigame fixes, then add party rules, audio and the blind timer game.
src = replaceRequired(src, './frontend-draw-timing-v47', './frontend-blind-timer-v50', 'v5.0 frontend');

const previewHelper = `const songPreviewCache = new Map();
async function findSongPreview(song) {
  const key = normalizeText(song.artist) + '|' + normalizeText(song.title);
  if (process.env.SUEFFIQ_STUB_PREVIEW) return { url: process.env.SUEFFIQ_STUB_PREVIEW, artworkUrl: '' };
  if (process.env.CI === 'true') return { url: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==', artworkUrl: '' };
  if (songPreviewCache.has(key)) return songPreviewCache.get(key);
  const params = new URLSearchParams({ term: song.artist + ' ' + song.title, entity: 'song', country: 'DE', limit: '8' });
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const response = await fetch('https://itunes.apple.com/search?' + params.toString(), { signal: ctrl.signal, headers: { 'user-agent': 'SueffIQ/' + VERSION } });
    if (!response.ok) return null;
    const data = await response.json();
    const wantedTitle = normalizeText(song.title); const wantedArtist = normalizeText(String(song.artist || '').split(/\\s+(?:feat\\.?|ft\\.?)\\s+|\\s*&\\s*|\\s+x\\s+/i)[0]);
    const candidates = (data.results || []).filter((x) => x && x.previewUrl).map((x) => {
      const title = normalizeText(x.trackName || ''); const artist = normalizeText(x.artistName || '');
      const score = similarity(title, wantedTitle) * 3 + similarity(artist, wantedArtist) * 2 + (title === wantedTitle ? 2 : 0) + (artist === wantedArtist ? 1 : 0);
      return { x, score };
    }).sort((a, b) => b.score - a.score);
    const hit = candidates[0]?.x; if (!hit) return null;
    const artworkUrl = String(hit.artworkUrl100 || hit.artworkUrl60 || '').replace(/100x100bb/i, '600x600bb').replace(/60x60bb/i, '600x600bb');
    const out = { url: String(hit.previewUrl), artworkUrl, trackName: hit.trackName || '', artistName: hit.artistName || '' };
    songPreviewCache.set(key, out); return out;
  } catch (e) { return null; }
  finally { clearTimeout(timer); }
}

function songPreviewPath(room) {
  return room && room.current && room.current.previewUrl ? '/api/song-preview/' + room.code + '/' + room.round : null;
}
function inlineAudio(value) {
  const match = /^data:(audio\\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(String(value || ''));
  if (!match) return null;
  try { return { type: match[1], body: Buffer.from(match[2], 'base64') }; } catch { return null; }
}
async function serveSongPreview(req, res, pathName) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) { res.writeHead(405, { allow: 'GET, HEAD' }); res.end(); return; }
  const match = /^\\/api\\/song-preview\\/([A-Z0-9]{5})\\/(\\d+)$/.exec(pathName);
  const room = match ? rooms.get(match[1]) : null;
  const round = match ? Number(match[2]) : -1;
  const sourceValue = room && room.round === round && room.current && room.current.type === 'song' ? room.current.previewUrl : null;
  if (!sourceValue) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end('Song nicht mehr verfügbar.'); return; }
  const embedded = inlineAudio(sourceValue);
  if (embedded) {
    res.writeHead(200, { 'content-type': embedded.type, 'content-length': embedded.body.length, 'cache-control': 'private, max-age=300', 'accept-ranges': 'bytes', 'x-content-type-options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else res.end(embedded.body); return;
  }
  let source;
  try { source = new URL(sourceValue); } catch { source = null; }
  const host = source && source.hostname.toLowerCase();
  const trusted = source && source.protocol === 'https:' && (host === 'apple.com' || host.endsWith('.apple.com') || host === 'mzstatic.com' || host.endsWith('.mzstatic.com'));
  if (!trusted) { res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end('Ungültige Audioquelle.'); return; }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const headers = { 'user-agent': 'SueffIQ/' + VERSION }; if (req.headers.range) headers.range = req.headers.range;
    const upstream = await fetch(source, { signal: ctrl.signal, headers });
    if (!upstream.ok && upstream.status !== 206) { res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end('Audioquelle nicht erreichbar.'); return; }
    const responseHeaders = { 'content-type': upstream.headers.get('content-type') || 'audio/mp4', 'cache-control': 'private, max-age=300', 'accept-ranges': upstream.headers.get('accept-ranges') || 'bytes', 'x-content-type-options': 'nosniff' };
    for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) { const value = upstream.headers.get(name); if (value) responseHeaders[name] = value; }
    res.writeHead(upstream.status === 206 ? 206 : 200, responseHeaders);
    if (req.method === 'HEAD' || !upstream.body) { res.end(); return; }
    for await (const chunk of upstream.body) { if (res.destroyed) break; res.write(Buffer.from(chunk)); }
    if (!res.writableEnded && !res.destroyed) res.end();
  } catch {
    if (!res.headersSent) { res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end('Audio konnte nicht geladen werden.'); }
    else if (!res.destroyed) res.destroy();
  } finally { clearTimeout(timer); }
}

function scheduleRound(room) {`;

const partyRulesHelper = `const PARTY_RULES = [
  'Ja und Nein sind verboten. Erwischt? 1 Schluck.',
  'Glas nur mit links. Rechte Hand am Getränk = 1 Schluck.',
  'Vornamen sind tabu. Nennt euch Chef, Legende oder Problemfall.',
  'Der Roundmaster heißt ab jetzt nur noch Eure Hoheit.',
  'Wer Digga sagt, nimmt 1 Schluck. Viel Erfolg.',
  'Fragen sind verboten. Wer eine stellt, beantwortet sie mit 1 Schluck.',
  'Das Wort ich ist verboten. Ego-Pause.',
  'Vor jedem Schluck muss Auf die Wissenschaft gesagt werden.',
  'Mit dem Finger auf jemanden zeigen = selber 1 Schluck.',
  'Wer außerhalb von SüffIQ am Handy hängt, nimmt 1 Schluck.',
  'Beim Anstoßen kein Blickkontakt? 1 Schluck wegen Respektlosigkeit.',
  'Wer über jemanden lacht, der trinken muss, trinkt solidarisch mit.',
  'Das Wort trinken ist verboten. Umschreibungen ausdrücklich erwünscht.',
  'Jeder Satz muss mit Bro oder Bruder enden. Vergessen = 1 Schluck.',
  'Wer flucht, nimmt 1 Schluck. Ja, auch scheiße zählt.',
  'Wer eine aktive Regel erklärt, nimmt für die unnötige Pressekonferenz 1 Schluck.',
];
const PARTY_RULE_MAX_ROUNDS = 10;
const PARTY_RULE_CHANCE = 28;
function partyHash(text) { let h = 2166136261 >>> 0; for (const char of String(text || '')) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function partyRuleStarts(code, round) {
  if (process.env.SUEFFIQ_FORCE_RULES === 'true') return true;
  if (process.env.SUEFFIQ_DISABLE_RULES === 'true' || process.env.NODE_TEST_CONTEXT) return false;
  return partyHash(String(code) + '|regel-start|' + round) % 100 < PARTY_RULE_CHANCE;
}
function prunePartyRules(room, upcomingRound) {
  room.activeRules = (room.activeRules || []).filter((rule) => upcomingRound <= Number(rule.expiresRound || 0));
}
function nextPartyRule(room, upcomingRound) {
  if ((room.activeRules || []).length >= 2 || !partyRuleStarts(room.code, upcomingRound)) return null;
  let used = new Set(room.usedPartyRules || []); if (used.size >= PARTY_RULES.length) { room.usedPartyRules = []; used = new Set(); }
  const first = partyHash(room.code + '|regel|' + upcomingRound) % PARTY_RULES.length; let index = first;
  for (let offset = 0; offset < PARTY_RULES.length; offset += 1) { const candidate = (first + offset) % PARTY_RULES.length; if (!used.has(candidate)) { index = candidate; break; } }
  room.usedPartyRules.push(index);
  return { id: room.code + '-' + upcomingRound + '-' + index, text: PARTY_RULES[index], startRound: upcomingRound, expiresRound: upcomingRound + PARTY_RULE_MAX_ROUNDS - 1, seen: {} };
}
function publicPartyRule(room, forId) {
  const rule = room.ruleRound; if (!rule) return null; const ids = connectedIds(room);
  const players = ids.map((id) => ({ id, name: displayName(room, id), seen: !!rule.seen[id] }));
  return { id: rule.id, text: rule.text, startRound: rule.startRound, youSeen: !!rule.seen[forId], isHost: room.hostId === forId, seenCount: players.filter((player) => player.seen).length, total: players.length, allSeen: players.length > 0 && players.every((player) => player.seen), players };
}
function activatePartyRule(room) {
  const rule = room.ruleRound; if (!rule) return;
  room.activeRules = [...(room.activeRules || []), { id: rule.id, text: rule.text, startRound: rule.startRound, expiresRound: rule.expiresRound }].slice(-2);
  room.ruleRound = null;
}

function buildDeck(room) {`;

const songStartOld = "  if (type === 'song') { cur.text = 'Welcher Song läuft?'; cur.song = pick(room, 'song'); cur.songStage = 0; cur.songStartedAt = null; cur.guessFeed = []; cur.songCorrect = {}; cur.songNear = {}; }";
const songStartNew = `  if (type === 'song') {
    cur.text = 'Welcher Song läuft?'; cur.songStage = 0; cur.songStartedAt = null; cur.guessFeed = []; cur.songCorrect = {}; cur.songNear = {};
    let chosen = null;
    for (let attempt = 0; attempt < 6 && !chosen; attempt += 1) {
      const candidate = pick(room, 'song');
      try { const preview = await findSongPreview(candidate); if (preview?.url) chosen = { song: candidate, preview }; } catch {}
    }
    if (!chosen) {
      room.current = null; room.phase = 'results'; room.lastResult = { type: 'song', label: CATS.song, text: 'Songrunde übersprungen', lines: ['iTunes hatte für die gezogenen Songs gerade keine abspielbare Vorschau.'], drinkers: [] }; broadcast(room); return;
    }
    cur.song = chosen.song; cur.previewUrl = chosen.preview.url; cur.artworkUrl = chosen.preview.artworkUrl || '';
  }`;

const publicSongOld = `    base.videoId = cur.song.videoId;
    base.startSeconds = cur.song.start || 0;
    base.songStartedAt = cur.songStartedAt || null;`;
const publicSongNew = `    base.videoId = cur.song.videoId;
    base.startSeconds = 0;
    base.previewUrl = songPreviewPath(room);
    base.artworkUrl = cur.artworkUrl || null;
    base.songStartedAt = cur.songStartedAt || null;`;

const songPlayOld = `    if (msg.t === 'songPlay' && isHost && room.phase === 'question' && room.current?.type === 'song') {
      if (room.current.songStartedAt) return; const at = Date.now() + 1200; room.current.songStartedAt = at;
      const payload = { t: 'songPlay', at, videoId: room.current.song.videoId, startSeconds: room.current.song.start || 0 };
      for (const id of connectedIds(room)) send(room.players[id].ws, payload); return broadcast(room);
    }`;
const songPlayNew = `    if (msg.t === 'songPlay' && isHost && room.phase === 'question' && room.current?.type === 'song') {
      if (room.current.songStartedAt) return; if (!room.current.previewUrl) return finishRound(room, 'broken');
      const at = Date.now() + 1600; room.current.songStartedAt = at;
      const payload = { t: 'songPlay', at, previewUrl: songPreviewPath(room), artworkUrl: room.current.artworkUrl || '', videoId: room.current.song.videoId, startSeconds: 0 };
      for (const id of connectedIds(room)) send(room.players[id].ws, payload); return broadcast(room);
    }`;

const songResultOld = "    result.answer = `${cur.song.title} – ${cur.song.artist}`; result.videoId = cur.song.videoId; result.guesses = cur.guessFeed.slice();";
const songResultNew = "    result.answer = `${cur.song.title} – ${cur.song.artist}`; result.artworkUrl = cur.artworkUrl || ''; result.guesses = cur.guessFeed.slice();";

const healthOld = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true })); return; }";
const healthNew = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, blindTimer: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true, songSource: 'itunes', songProxy: true, youtubePlayback: false, ruleRounds: true })); return; }";

const roomRulesOld = `    selectedMiniTypes: [...MINI_TYPES], miniDrawGuaranteed: true, pongCursor: 0,
  };`;
const roomRulesNew = `    selectedMiniTypes: [...MINI_TYPES], miniDrawGuaranteed: true, pongCursor: 0,
    activeRules: [], ruleRound: null, usedPartyRules: [],
  };`;
const publicStateOld = `    selectedCats: room.selectedCats || [...CATEGORY_ORDER], selectedMiniTypes: room.selectedMiniTypes || [...MINI_TYPES], phase: room.phase, round: room.round, now: Date.now(),`;
const publicStateNew = `    selectedCats: room.selectedCats || [...CATEGORY_ORDER], selectedMiniTypes: room.selectedMiniTypes || [...MINI_TYPES], phase: room.phase, round: room.round, now: Date.now(),
    activeRules: (room.activeRules || []).map((rule) => ({ id: rule.id, text: rule.text, startRound: rule.startRound, expiresRound: rule.expiresRound })), ruleRound: publicPartyRule(room, forId),`;
const startRoundOld = `async function startRound(room) {
  clearTimers(room); room.phase = 'loading'; room.round += 1;`;
const startRoundNew = `async function startRound(room) {
  clearTimers(room); const upcomingRound = room.round + 1; prunePartyRules(room, upcomingRound);
  const nextRule = nextPartyRule(room, upcomingRound);
  if (nextRule) { room.ruleRound = nextRule; room.current = null; room.phase = 'rule'; broadcast(room); return; }
  return startQuestionRound(room);
}
async function startQuestionRound(room) {
  room.ruleRound = null; clearTimers(room); room.phase = 'loading'; room.round += 1;`;
const answerHandlerOld = `    if (msg.t === 'answer') return answerCurrent(room, me, msg.v);`;
const answerHandlerNew = `    if (msg.t === 'ruleSeen' && room.phase === 'rule' && room.ruleRound) { room.ruleRound.seen[me] = true; return broadcast(room); }
    if (msg.t === 'ruleContinue' && isHost && room.phase === 'rule' && room.ruleRound) {
      const ids = connectedIds(room); if (!ids.length || !ids.every((id) => !!room.ruleRound.seen[id])) return error('Erst müssen alle die Regel gesehen haben.');
      activatePartyRule(room); startQuestionRound(room).catch(() => error('Runde konnte nicht gestartet werden.')); return;
    }
    if (msg.t === 'answer') return answerCurrent(room, me, msg.v);`;
const endHandlerOld = `    if (msg.t === 'end' && isHost) { clearTimers(room); room.phase = 'end'; room.current = null; return broadcast(room); }`;
const endHandlerNew = `    if (msg.t === 'end' && isHost) { clearTimers(room); room.phase = 'end'; room.current = null; room.ruleRound = null; return broadcast(room); }`;
const httpStartOld = `const server = http.createServer((req, res) => {
  if (pwaHandler(req, res)) return;
  const url = String(req.url || '').split('?')[0];`;
const httpStartNew = `const server = http.createServer((req, res) => {
  const url = String(req.url || '').split('?')[0];
  if (url.startsWith('/api/song-preview/')) { serveSongPreview(req, res, url).catch(() => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); if (!res.writableEnded) res.end('Audio konnte nicht geladen werden.'); }); return; }
  if (pwaHandler(req, res)) return;`;
const minigameImportOld = `const { DRAW_PROMPTS, MINI_TYPES, randomSequence, reactionResults, tapResults, memoryResults } = require('./minigames');`;
const minigameImportNew = `const { DRAW_PROMPTS, MINI_TYPES, randomSequence, reactionResults, tapResults, memoryResults, blindTimerResults } = require('./minigames');`;
const miniLabelsOld = `const MINI_LABELS = { zeichnen: 'Zeichnen & Raten', allemallen: 'Alle malen', allemalen: 'Alle malen', reaktion: 'Reaktionstest', taps: 'Tap Battle', farbfolge: 'Farbfolge merken', pong: 'Pong', blackjack: 'Blackjack' };`;
const miniLabelsNew = `const MINI_LABELS = { zeichnen: 'Zeichnen & Raten', allemallen: 'Alle malen', allemalen: 'Alle malen', reaktion: 'Reaktionstest', taps: 'Tap Battle', farbfolge: 'Farbfolge merken', zeitgefuehl: 'Zeitgefühl', pong: 'Pong', blackjack: 'Blackjack' };`;
const miniAnsweredOld = `      else if (cur.miniType === 'taps') answered = !!cur.tapDone?.[id];
      else if (cur.miniType === 'allemalen') answered = cur.miniStage === 'rank' ? !!cur.rankVotes?.[id] : !!cur.allDrawDone?.[id];`;
const miniAnsweredNew = `      else if (cur.miniType === 'taps') answered = !!cur.tapDone?.[id];
      else if (cur.miniType === 'zeitgefuehl') answered = !!cur.timerResults?.[id];
      else if (cur.miniType === 'allemalen') answered = cur.miniStage === 'rank' ? !!cur.rankVotes?.[id] : !!cur.allDrawDone?.[id];`;
const miniPublicOld = `    if (cur.miniType === 'farbfolge') { base.sequence = cur.sequence; base.showAt = cur.showAt; base.inputAt = cur.inputAt; }`;
const miniPublicNew = `    if (cur.miniType === 'farbfolge') { base.sequence = cur.sequence; base.showAt = cur.showAt; base.inputAt = cur.inputAt; }
    if (cur.miniType === 'zeitgefuehl') { base.timerTargetMs = cur.timerTargetMs; base.timerStarted = !!cur.timerStarts?.[forId]; base.timerDone = !!cur.timerResults?.[forId]; base.timerFinished = connectedIds(room).filter((id) => !!cur.timerResults?.[id]).length; base.timerTotal = connectedIds(room).length; }`;
const memoryResultOld = `    if (cur.miniType === 'farbfolge') {
      const scores = {}; ids.forEach((id) => { scores[id] = cur.answers[id] || { score: 0, ms: 999999 }; });
      const out = memoryResults(scores, cur.sequence.length); Object.assign(sipMap, out.sips);
      result.miniRows = out.ranked.map((row) => ({ name: displayName(room, row.id), label: row.value + '/' + cur.sequence.length + ' richtig' }));
      result.lines.push('Wer sich die komplette Farbfolge merkt, bleibt trocken.');
    }`;
const memoryResultNew = `${memoryResultOld}
    if (cur.miniType === 'zeitgefuehl') {
      const timings = {}; ids.forEach((id) => { timings[id] = cur.timerResults[id] || { elapsed: null }; });
      const out = blindTimerResults(timings, cur.timerTargetMs); Object.assign(sipMap, out.sips);
      result.answer = (cur.timerTargetMs / 1000).toFixed(0) + ' Sekunden';
      result.miniRows = out.ranked.map((row) => ({ name: displayName(room, row.id), label: Number.isFinite(row.delta) ? (row.elapsed / 1000).toFixed(2) + ' s · ' + (row.elapsed >= cur.timerTargetMs ? '+' : '−') + (row.delta / 1000).toFixed(2) + ' s' : 'nicht gestoppt' }));
      result.lines.push('Wer die zufällige Zielzeit am genauesten trifft, bleibt trocken.');
    }`;
const allAnsweredTimerOld = `    if (cur.miniType === 'taps') return ids.every((id) => !!cur.tapDone?.[id]);
    if (cur.miniType === 'allemalen') {`;
const allAnsweredTimerNew = `    if (cur.miniType === 'taps') return ids.every((id) => !!cur.tapDone?.[id]);
    if (cur.miniType === 'zeitgefuehl') return ids.every((id) => !!cur.timerResults?.[id]);
    if (cur.miniType === 'allemalen') {`;
const startTimerOld = `    if (cur.miniType === 'farbfolge') { total = 15; cur.text = 'Merke dir die Farbfolge.'; cur.sequence = randomSequence(6); cur.showAt = now + 900; cur.inputAt = cur.showAt + cur.sequence.length * 760 + 650; }
    if (cur.miniType === 'pong') {`;
const startTimerNew = `    if (cur.miniType === 'farbfolge') { total = 15; cur.text = 'Merke dir die Farbfolge.'; cur.sequence = randomSequence(6); cur.showAt = now + 900; cur.inputAt = cur.showAt + cur.sequence.length * 760 + 650; }
    if (cur.miniType === 'zeitgefuehl') { total = 30; cur.timerTargetMs = (2 + Math.floor(Math.random() * 9)) * 1000; cur.text = 'Stoppe den unsichtbaren Timer möglichst genau.'; cur.timerStarts = {}; cur.timerResults = {}; }
    if (cur.miniType === 'pong') {`;
const timerHandlerOld = `    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {`;
const timerHandlerNew = `    if (msg.t === 'miniTimerStart' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeitgefuehl') { const cur = room.current; if (cur.timerStarts[me] || cur.timerResults[me]) return; cur.timerStarts[me] = Date.now(); broadcast(room); return; }
    if (msg.t === 'miniTimerStop' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeitgefuehl') { const cur = room.current; const started = Number(cur.timerStarts[me] || 0); if (!started || cur.timerResults[me]) return; cur.timerResults[me] = { elapsed: clamp(Date.now() - started, 0, 60000) }; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }
    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {`;

const v48BasePatches = [
  basePatchSource(minigameImportOld, minigameImportNew, 'blind timer result helper import'),
  basePatchSource(miniLabelsOld, miniLabelsNew, 'blind timer label'),
  basePatchSource(roomRulesOld, roomRulesNew, 'server-managed party rule room state'),
  basePatchSource('function buildDeck(room) {', partyRulesHelper, 'party rule helpers'),
  basePatchSource('function scheduleRound(room) {', previewHelper, 'iTunes preview resolver'),
  basePatchSource(publicSongOld, publicSongNew, 'public iTunes preview'),
  basePatchSource(songStartOld, songStartNew, 'resolve iTunes preview before song round'),
  basePatchSource(songPlayOld, songPlayNew, 'synchronized iTunes song play'),
  basePatchSource(songResultOld, songResultNew, 'iTunes result artwork'),
  basePatchSource(publicStateOld, publicStateNew, 'public party rule state'),
  basePatchSource(startRoundOld, startRoundNew, 'party rule interstitial round'),
  basePatchSource(answerHandlerOld, answerHandlerNew, 'party rule acknowledgements'),
  basePatchSource(endHandlerOld, endHandlerNew, 'clear pending party rule'),
  basePatchSource(httpStartOld, httpStartNew, 'same-origin song preview proxy'),
  basePatchSource(miniAnsweredOld, miniAnsweredNew, 'blind timer answered state'),
  basePatchSource(miniPublicOld, miniPublicNew, 'public blind timer state'),
  basePatchSource(memoryResultOld, memoryResultNew, 'blind timer results'),
  basePatchSource(allAnsweredTimerOld, allAnsweredTimerNew, 'blind timer completion'),
  basePatchSource(startTimerOld, startTimerNew, 'start blind timer'),
  basePatchSource(timerHandlerOld, timerHandlerNew, 'blind timer messages'),
  basePatchSource(healthOld, healthNew, 'iTunes health flags'),
].join('\n');

// server-v471 compiles server-v461. Insert extra base patches into server-v461 before it compiles server-v46.
// Include the following runtime.filename line in the anchor so a quoted marker string cannot be matched accidentally.
const compileAnchor = "const runtime = new Module(basePath, module.parent || module);\nruntime.filename = basePath;";
const generatorPatch = [
  `const v48ExtraSource = ${JSON.stringify(v48BasePatches)};`,
  "const v48Marker = \"const runtimeAnchor = 'const runtime = new Module(basePath, module.parent || module);';\";",
  "src = replaceRequired(src, v48Marker, v48ExtraSource + '\\n\\n' + v48Marker, 'inject v4.8 iTunes base patches');",
].join('\n');
src = replaceRequired(src, compileAnchor, generatorPatch + '\n\n' + compileAnchor, 'v4.8 generator patch');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
