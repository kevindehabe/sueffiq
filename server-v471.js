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
// Legacy order payloads are converted internally so older integration tests/clients can still finish a round.
src = replaceRequired(
  src,
  "if (msg.t === 'allDrawRank' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'rank') { const cur = room.current; if (cur.rankVotes[me]) return; const expected = cur.allDrawPlayers.filter((id) => id !== me && room.players[id]?.connected); const order = Array.isArray(msg.order) ? msg.order.map(String) : []; if (order.length !== expected.length || new Set(order).size !== order.length || order.some((id) => !expected.includes(id))) return; cur.rankVotes[me] = order; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }",
  "if (msg.t === 'allDrawRank' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'allemalen' && room.current.miniStage === 'rank') { const cur = room.current; if (cur.rankVotes[me]) return; const expected = cur.allDrawPlayers.filter((id) => id !== me && room.players[id]?.connected); let ratings = msg.ratings && typeof msg.ratings === 'object' && !Array.isArray(msg.ratings) ? msg.ratings : null; if (!ratings && Array.isArray(msg.order)) { const order = msg.order.map(String); if (order.length !== expected.length || new Set(order).size !== order.length || order.some((id) => !expected.includes(id))) return; ratings = {}; order.forEach((id, index) => { ratings[id] = Math.max(1, 5 - index); }); } if (!ratings) return; const keys = Object.keys(ratings); if (keys.length !== expected.length || keys.some((id) => !expected.includes(id))) return; const clean = {}; for (const id of expected) { const n = Math.round(Number(ratings[id])); if (!Number.isFinite(n) || n < 1 || n > 5) return; clean[id] = n; } cur.rankVotes[me] = clean; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); return; }",
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
src = replaceRequired(
  src,
  "label: row.score + ' Ranking-Punkte'",
  "label: row.score + ' Punkte'",
  'Alle-malen-Punktelabel'
);

// Fix live drawing sync: v4.6 called sendExcept(), but that helper does not exist in the production core.
// Send each stroke/clear directly to every other connected socket instead.
src = replaceRequired(
  src,
  "room.current.strokes.push(s); if (room.current.strokes.length > 1200) room.current.strokes.shift(); sendExcept(room, me, { t: 'drawStroke', stroke: s }); return;",
  "room.current.strokes.push(s); if (room.current.strokes.length > 1200) room.current.strokes.shift(); for (const id of room.order) { if (id === me) continue; const p = room.players[id]; if (p?.connected) send(p.ws, { t: 'drawStroke', stroke: s }); } return;",
  'Zeichnen-Live-Striche'
);
src = replaceRequired(
  src,
  "if (msg.t === 'drawClear' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeichnen' && room.current.drawerId === me) { room.current.strokes = []; sendExcept(room, me, { t: 'drawClear' }); return; }",
  "if (msg.t === 'drawClear' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeichnen' && room.current.drawerId === me) { room.current.strokes = []; for (const id of room.order) { if (id === me) continue; const p = room.players[id]; if (p?.connected) send(p.ws, { t: 'drawClear' }); } return; }",
  'Zeichnen-Live-Loeschen'
);

// Allow a full RGB/HEX color in the fifth stroke field. Keep old numeric palette strokes compatible.
const numericStroke = "const s = Array.isArray(msg.s) ? msg.s.slice(0, 5).map(Number) : null; if (!s || s.length !== 5 || s.some((n) => !Number.isFinite(n))) return;";
const rgbStroke = "const rawStroke = Array.isArray(msg.s) ? msg.s.slice(0, 5) : null; if (!rawStroke || rawStroke.length !== 5) return; const coords = rawStroke.slice(0, 4).map(Number); if (coords.some((n) => !Number.isFinite(n))) return; const rawColor = rawStroke[4]; const color = typeof rawColor === 'string' && /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor.toLowerCase() : clamp(Math.round(Number(rawColor) || 0), 0, 3); const s = [coords[0], coords[1], coords[2], coords[3], color];";
src = replaceRequired(src, numericStroke, rgbStroke, 'RGB Zeichnen');
src = replaceRequired(src, numericStroke, rgbStroke, 'RGB Alle-malen');
const oldClampStroke = "for (let i = 0; i < 4; i += 1) s[i] = clamp(s[i], 0, 1); s[4] = clamp(Math.round(s[4]), 0, 3);";
const newClampStroke = "for (let i = 0; i < 4; i += 1) s[i] = clamp(s[i], 0, 1);";
src = replaceRequired(src, oldClampStroke, newClampStroke, 'RGB Farbwert Zeichnen');
src = replaceRequired(src, oldClampStroke, newClampStroke, 'RGB Farbwert Alle-malen');

// Pong: one point wins and the ball is substantially faster/smoother.
src = replaceRequired(
  src,
  "const dir = direction || (Math.random() < .5 ? -1 : 1); cur.pongBall = { x: .5, y: .5, vx: dir * .012, vy: (Math.random() - .5) * .012 }; cur.pongPauseUntil = Date.now() + 850;",
  "const dir = direction || (Math.random() < .5 ? -1 : 1); cur.pongBall = { x: .5, y: .5, vx: dir * .026, vy: (Math.random() - .5) * .022 }; cur.pongPauseUntil = Date.now() + 350;",
  'Pong Startgeschwindigkeit'
);
src = replaceRequired(
  src,
  "if (room.players[left]?.connected) cur.pongScore.left = 3; else if (room.players[right]?.connected) cur.pongScore.right = 3;",
  "if (room.players[left]?.connected) cur.pongScore.left = 1; else if (room.players[right]?.connected) cur.pongScore.right = 1;",
  'Pong Disconnect Punkt'
);
src = replaceRequired(
  src,
  "if (b.vx < 0 && b.x <= .075 && b.x >= .025 && lh) { b.x = .075; b.vx = Math.min(.024, Math.abs(b.vx) * 1.055); b.vy += (b.y - Number(cur.pongPaddles.left || .5)) * .035; }",
  "if (b.vx < 0 && b.x <= .075 && b.x >= .025 && lh) { b.x = .075; b.vx = Math.min(.045, Math.abs(b.vx) * 1.08); b.vy += (b.y - Number(cur.pongPaddles.left || .5)) * .05; }",
  'Pong linker Schlaeger'
);
src = replaceRequired(
  src,
  "if (b.vx > 0 && b.x >= .925 && b.x <= .975 && rh) { b.x = .925; b.vx = -Math.min(.024, Math.abs(b.vx) * 1.055); b.vy += (b.y - Number(cur.pongPaddles.right || .5)) * .035; }",
  "if (b.vx > 0 && b.x >= .925 && b.x <= .975 && rh) { b.x = .925; b.vx = -Math.min(.045, Math.abs(b.vx) * 1.08); b.vy += (b.y - Number(cur.pongPaddles.right || .5)) * .05; }",
  'Pong rechter Schlaeger'
);
src = replaceRequired(
  src,
  "if (b.x < -.03) { cur.pongScore.right += 1; if (cur.pongScore.right >= 3) return finishRound(room, 'complete'); resetPongBall(cur, -1); }",
  "if (b.x < -.03) { cur.pongScore.right += 1; if (cur.pongScore.right >= 1) return finishRound(room, 'complete'); resetPongBall(cur, -1); }",
  'Pong Sieg rechts'
);
src = replaceRequired(
  src,
  "if (b.x > 1.03) { cur.pongScore.left += 1; if (cur.pongScore.left >= 3) return finishRound(room, 'complete'); resetPongBall(cur, 1); }",
  "if (b.x > 1.03) { cur.pongScore.left += 1; if (cur.pongScore.left >= 1) return finishRound(room, 'complete'); resetPongBall(cur, 1); }",
  'Pong Sieg links'
);
src = replaceRequired(src, "broadcast(room); setTimeout(tick, 55).unref?.();", "broadcast(room); setTimeout(tick, 40).unref?.();", 'Pong Tickrate');
src = replaceRequired(src, "setTimeout(tick, 250).unref?.();", "setTimeout(tick, 150).unref?.();", 'Pong Start');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
