'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

function patch(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.6.1 Tap-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

const basePath = path.join(__dirname, 'server-v46.js');
let src = fs.readFileSync(basePath, 'utf8');

src = patch(src, "const VERSION = '4.6.0';", "const VERSION = '4.6.1';", 'version');
src = patch(src,
  "const addMinigameFrontend = require('./frontend-minigames-v46b');",
  "const addMinigameFrontend = require('./frontend-minigames-v461');",
  'frontend module');

src = patch(src,
  "      else if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') answered = cur.answers?.[id] !== undefined;\n      else answered = false;",
  "      else if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') answered = cur.answers?.[id] !== undefined;\n      else if (cur.miniType === 'taps') answered = !!cur.tapDone?.[id];\n      else answered = false;",
  'tap answered status');

src = patch(src,
  "    if (cur.miniType === 'taps') { base.startAt = cur.startAt || null; base.endAt = cur.endAt || null; }",
  "    if (cur.miniType === 'taps') { base.startAt = cur.tapStarts?.[forId] || null; base.endAt = cur.tapEnds?.[forId] || null; base.tapDone = !!cur.tapDone?.[forId]; base.tapFinished = connectedIds(room).filter((id) => !!cur.tapDone?.[id]).length; base.tapTotal = connectedIds(room).length; }",
  'personal tap state');

src = patch(src,
  "    if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') return ids.every((id) => cur.answers[id] !== undefined);\n    return false;",
  "    if (cur.miniType === 'reaktion' || cur.miniType === 'farbfolge') return ids.every((id) => cur.answers[id] !== undefined);\n    if (cur.miniType === 'taps') return ids.every((id) => !!cur.tapDone?.[id]);\n    return false;",
  'tap completion state');

src = patch(src,
  "    if (cur.miniType === 'taps') { total = 14; cur.text = 'Erster Tap startet für alle den Countdown. Danach laufen 7 Sekunden.'; cur.startAt = null; cur.endAt = null; cur.tapCounts = {}; }",
  "    if (cur.miniType === 'taps') { total = 0; cur.text = 'Starte, wenn du bereit bist. Nach deinem eigenen Countdown hast du 7 Sekunden.'; cur.tapStarts = {}; cur.tapEnds = {}; cur.tapDone = {}; cur.tapCounts = {}; }",
  'tap round initialization');

src = patch(src,
  "    cur.total = total;\n  }\n  cur.deadline = Date.now() + total * 1000;",
  "    cur.total = total;\n  }\n  cur.deadline = (type === 'minigame' && cur.miniType === 'taps') ? null : Date.now() + total * 1000;",
  'tap round has no deadline');

src = patch(src,
  "    if (msg.t === 'miniTapStart' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {\n      const cur = room.current; if (cur.startAt || cur.endAt) return; const now = Date.now(); const round = room.round; cur.startAt = now + 1200; cur.endAt = cur.startAt + 7000; cur.total = 9; cur.deadline = cur.endAt + 500; clearTimers(room); addTimer(room, () => { if (room.phase === 'question' && room.round === round && room.current === cur) finishRound(room, 'timeout'); }, Math.max(250, cur.endAt - Date.now() + 250)); broadcast(room); return;\n    }",
  "    if (msg.t === 'miniTapStart' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {\n      const cur = room.current; if (cur.tapStarts?.[me] || cur.tapDone?.[me]) return; const now = Date.now(); const round = room.round; const startAt = now + 3000; const endAt = startAt + 7000; cur.tapStarts[me] = startAt; cur.tapEnds[me] = endAt; broadcast(room); addTimer(room, () => { if (room.phase !== 'question' || room.round !== round || room.current !== cur) return; cur.tapDone[me] = true; if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room); }, Math.max(250, endAt - Date.now() + 550)); return;\n    }",
  'individual tap start');

src = patch(src,
  "    if (msg.t === 'miniTap' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {\n      const cur = room.current; const now = Date.now(); if (!cur.startAt || !cur.endAt || now < cur.startAt || now > cur.endAt + 500) return; const n = clamp(Math.round(Number(msg.n) || 0), 0, 30); if (!n) return; cur.tapCounts[me] = clamp((cur.tapCounts[me] || 0) + n, 0, 500); return;\n    }",
  "    if (msg.t === 'miniTap' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'taps') {\n      const cur = room.current; const now = Date.now(); const startAt = cur.tapStarts?.[me]; const endAt = cur.tapEnds?.[me]; if (!startAt || !endAt || cur.tapDone?.[me] || now < startAt || now > endAt + 500) return; const n = clamp(Math.round(Number(msg.n) || 0), 0, 30); if (!n) return; cur.tapCounts[me] = clamp((cur.tapCounts[me] || 0) + n, 0, 500); return;\n    }",
  'personal tap counting');

const scheduleAnchor = "src = replaceRequired(src, \"  const cur = room.current; if (!cur || room.phase !== 'question' || ['person', 'bild', 'song'].includes(cur.type)) return;\"";
const schedulePatch = "src = replaceRequired(src, \"  addTimer(room, () => { if (room.phase === 'question' && room.round === round) finishRound(room, 'timeout'); }, sec * 1000 + 250);\", \"  if (!(cur.type === 'minigame' && cur.miniType === 'taps')) addTimer(room, () => { if (room.phase === 'question' && room.round === round) finishRound(room, 'timeout'); }, sec * 1000 + 250);\", 'tap battle no global timeout');\n";
src = patch(src, scheduleAnchor, schedulePatch + scheduleAnchor, 'inject no-timeout patch');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
