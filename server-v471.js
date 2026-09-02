'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const basePath = path.join(__dirname, 'server-v461.js');
let src = fs.readFileSync(basePath, 'utf8');

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.7.1 Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

src = replaceRequired(
  src,
  "const addMinigameFrontend = require('./frontend-minigames-v47');",
  "const addMinigameFrontend = require('./frontend-draw-timing-v47');",
  'Frontend-Modul'
);

// Both drawing modes get exactly 45 seconds for drawing.
src = replaceRequired(
  src,
  "if (cur.miniType === 'allemalen') { total = 40;",
  "if (cur.miniType === 'allemalen') { total = 45;",
  'Alle-malen-Zeichenzeit'
);
src = replaceRequired(
  src,
  "cur.miniStage === 'draw') beginAllDrawRank(room); }, 40000);",
  "cur.miniStage === 'draw') beginAllDrawRank(room); }, 45000);",
  'Alle-malen-Zeichentimer'
);

// Ranking starts after the drawing phase and has no timer. It ends when everyone has voted.
src = replaceRequired(
  src,
  "clearTimers(room); cur.miniStage = 'rank'; cur.rankVotes = {}; cur.total = 30; cur.deadline = Date.now() + 30000;\n  const round = room.round; addTimer(room, () => { if (room.phase === 'question' && room.round === round && room.current === cur) finishRound(room, 'timeout'); }, 30250); broadcast(room);",
  "clearTimers(room); cur.miniStage = 'rank'; cur.rankVotes = {}; cur.total = 0; cur.deadline = null;\n  broadcast(room);",
  'Alle-malen-Ranking-ohne-Timer'
);

// Each player rates every other drawing from 1 to 5. The own drawing cannot be rated.
src = replaceRequired(
  src,
  "if (msg.t === 'allDrawRank' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'rank') { const cur = room.current; if (cur.rankVotes[me]) return; const expected = cur.allDrawPlayers.filter((id) => id !== me && room.players[id]?.connected); const order = Array.isArray(msg.order) ? msg.order.map(String) : []; if (order.length !== expected.length || new Set(order).size !== order.length || order.some((id) => !expected.includes(id))) return; cur.rankVotes[me] = order; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }",
  "if (msg.t === 'allDrawRank' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'rank') { const cur = room.current; if (cur.rankVotes[me]) return; const expected = cur.allDrawPlayers.filter((id) => id !== me && room.players[id]?.connected); const ratings = msg.ratings && typeof msg.ratings === 'object' && !Array.isArray(msg.ratings) ? msg.ratings : null; if (!ratings) return; const keys = Object.keys(ratings); if (keys.length !== expected.length || keys.some((id) => !expected.includes(id))) return; const clean = {}; for (const id of expected) { const n = Math.round(Number(ratings[id])); if (!Number.isFinite(n) || n < 1 || n > 5) return; clean[id] = n; } cur.rankVotes[me] = clean; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }",
  'Alle-malen-1-bis-5-Bewertung'
);

// Ranking value is the total number of rating points received from the group.
src = replaceRequired(
  src,
  "for (const order of Object.values(cur.rankVotes || {})) if (Array.isArray(order)) order.forEach((id, index) => { if (scores[id] !== undefined) scores[id] += Math.max(1, order.length - index); });",
  "for (const ratings of Object.values(cur.rankVotes || {})) if (ratings && typeof ratings === 'object' && !Array.isArray(ratings)) for (const [id, value] of Object.entries(ratings)) { if (scores[id] !== undefined) scores[id] += clamp(Math.round(Number(value) || 0), 1, 5); }",
  'Alle-malen-Gesamtpunkte'
);
src = replaceRequired(
  src,
  "result.lines.push(max === min ? 'Unentschieden – alle Zeichnungen bleiben trocken.' : 'Die Gruppe hat gerankt: oben trocken, unten höchstens zwei Schlücke.');",
  "result.lines.push(max === min ? 'Unentschieden – alle Zeichnungen haben gleich viele Punkte.' : 'Bewertung 1–5: Die Gesamtpunktzahl bestimmt das Ranking.');",
  'Alle-malen-Ergebnistext'
);

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
