'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const basePath = path.join(__dirname, 'server-v471.js');
let src = fs.readFileSync(basePath, 'utf8');

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v5.1 Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}
function basePatchSource(needle, replacement, label) {
  return `extra.push(basePatch(${JSON.stringify(needle)}, ${JSON.stringify(replacement)}, ${JSON.stringify(label)}));`;
}

// YouTube bleibt die Songquelle. Nur Zeitgefühl kommt als zusätzlicher Server-Patch dazu.
src = replaceRequired(src, './frontend-draw-timing-v47', './frontend-youtube-v51', 'v5.1 Frontend');

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
    if (cur.miniType === 'zeitgefuehl') {
      base.timerTargetMs = cur.timerTargetMs;
      base.timerStarted = !!cur.timerStarts?.[forId];
      base.timerDone = !!cur.timerResults?.[forId];
      base.timerFinished = connectedIds(room).filter((id) => !!cur.timerResults?.[id]).length;
      base.timerTotal = connectedIds(room).length;
    }`;

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
      result.miniRows = out.ranked.map((row) => ({
        name: displayName(room, row.id),
        label: Number.isFinite(row.delta)
          ? (row.elapsed / 1000).toFixed(2) + ' s · ' + (row.elapsed >= cur.timerTargetMs ? '+' : '−') + (row.delta / 1000).toFixed(2) + ' s'
          : 'nicht gestoppt'
      }));
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
    if (cur.miniType === 'zeitgefuehl') {
      total = 30;
      cur.timerTargetMs = (2 + Math.floor(Math.random() * 9)) * 1000;
      cur.text = 'Stoppe den unsichtbaren Timer möglichst genau.';
      cur.timerStarts = {};
      cur.timerResults = {};
    }
    if (cur.miniType === 'pong') {`;

const timerHandlerOld = `    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {`;
const timerHandlerNew = `    if (msg.t === 'miniTimerStart' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeitgefuehl') {
      const cur = room.current;
      if (cur.timerStarts[me] || cur.timerResults[me]) return;
      cur.timerStarts[me] = Date.now();
      broadcast(room);
      return;
    }
    if (msg.t === 'miniTimerStop' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'zeitgefuehl') {
      const cur = room.current;
      const started = Number(cur.timerStarts[me] || 0);
      if (!started || cur.timerResults[me]) return;
      cur.timerResults[me] = { elapsed: clamp(Date.now() - started, 0, 60000) };
      if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room);
      return;
    }
    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {`;

const healthOld = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true })); return; }";
const healthNew = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, blindTimer: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true, songSource: 'youtube', youtubePlayback: true, ruleRounds: false })); return; }";

const v51BasePatches = [
  basePatchSource(minigameImportOld, minigameImportNew, 'Zeitgefühl Ergebnis-Helper'),
  basePatchSource(miniLabelsOld, miniLabelsNew, 'Zeitgefühl Label'),
  basePatchSource(miniAnsweredOld, miniAnsweredNew, 'Zeitgefühl beantwortet'),
  basePatchSource(miniPublicOld, miniPublicNew, 'Zeitgefühl Public State'),
  basePatchSource(memoryResultOld, memoryResultNew, 'Zeitgefühl Ergebnis'),
  basePatchSource(allAnsweredTimerOld, allAnsweredTimerNew, 'Zeitgefühl Abschluss'),
  basePatchSource(startTimerOld, startTimerNew, 'Zeitgefühl Start'),
  basePatchSource(timerHandlerOld, timerHandlerNew, 'Zeitgefühl Nachrichten'),
  basePatchSource(healthOld, healthNew, 'Health Flags'),
].join('\n');

// server-v471 erzeugt server-v461 dynamisch. Die Zeitgefühl-Patches müssen deshalb
// in dessen Base-Patch-Liste eingeschleust werden, bevor der finale Server kompiliert.
const compileAnchor = "const runtime = new Module(basePath, module.parent || module);\nruntime.filename = basePath;";
const generatorPatch = [
  `const v51ExtraSource = ${JSON.stringify(v51BasePatches)};`,
  "const v51Marker = \"const runtimeAnchor = 'const runtime = new Module(basePath, module.parent || module);';\";",
  "src = replaceRequired(src, v51Marker, v51ExtraSource + '\\n\\n' + v51Marker, 'inject v5.1 Zeitgefühl base patches');",
].join('\n');
src = replaceRequired(src, compileAnchor, generatorPatch + '\n\n' + compileAnchor, 'v5.1 Generator-Patch');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
