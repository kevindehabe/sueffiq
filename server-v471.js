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

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
