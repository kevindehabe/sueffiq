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

// YouTube bleibt die Songquelle. Zeitgefühl bleibt ein Minigame; Logo-Raten wird als normale Kategorie ergänzt.
src = replaceRequired(src, './frontend-draw-timing-v47', './frontend-youtube-v51', 'v5.1 Frontend');

const minigameImportOld = `const { DRAW_PROMPTS, MINI_TYPES, randomSequence, reactionResults, tapResults, memoryResults } = require('./minigames');`;
const minigameImportNew = `const { DRAW_PROMPTS, MINI_TYPES, randomSequence, reactionResults, tapResults, memoryResults, blindTimerResults, gentleRankSips } = require('./minigames');
const { pickLogoPrompt, matchLogoGuess, logoImageUrl } = require('./logos');`;
const miniLabelsOld = `const MINI_LABELS = { zeichnen: 'Zeichnen & Raten', allemallen: 'Alle malen', allemalen: 'Alle malen', reaktion: 'Reaktionstest', taps: 'Tap Battle', farbfolge: 'Farbfolge merken', pong: 'Pong', blackjack: 'Blackjack' };`;
const miniLabelsNew = `const MINI_LABELS = { zeichnen: 'Zeichnen & Raten', allemallen: 'Alle malen', allemalen: 'Alle malen', reaktion: 'Reaktionstest', taps: 'Tap Battle', farbfolge: 'Farbfolge merken', zeitgefuehl: 'Zeitgefühl', logo: 'Erkenne das Logo', pong: 'Pong', blackjack: 'Blackjack' };`;

const miniAnsweredOld = `      else if (cur.miniType === 'taps') answered = !!cur.tapDone?.[id];
      else if (cur.miniType === 'allemalen') answered = cur.miniStage === 'rank' ? !!cur.rankVotes?.[id] : !!cur.allDrawDone?.[id];`;
const miniAnsweredNew = `      else if (cur.miniType === 'taps') answered = !!cur.tapDone?.[id];
      else if (cur.miniType === 'zeitgefuehl') answered = !!cur.timerResults?.[id];
      else if (cur.miniType === 'logo') answered = !!cur.logoCorrect?.[id];
      else if (cur.miniType === 'allemalen') answered = cur.miniStage === 'rank' ? !!cur.rankVotes?.[id] : !!cur.allDrawDone?.[id];`;

const miniPublicOld = `    if (cur.miniType === 'farbfolge') { base.sequence = cur.sequence; base.showAt = cur.showAt; base.inputAt = cur.inputAt; }`;
const miniPublicNew = `    if (cur.miniType === 'farbfolge') { base.sequence = cur.sequence; base.showAt = cur.showAt; base.inputAt = cur.inputAt; }
    if (cur.miniType === 'zeitgefuehl') {
      base.timerTargetMs = cur.timerTargetMs;
      base.timerStarted = !!cur.timerStarts?.[forId];
      base.timerDone = !!cur.timerResults?.[forId];
      base.timerFinished = connectedIds(room).filter((id) => !!cur.timerResults?.[id]).length;
      base.timerTotal = connectedIds(room).length;
    }
    if (cur.miniType === 'logo') {
      base.logoImage = logoImageUrl(cur.logo);
      base.logoSolved = !!cur.logoCorrect?.[forId];
      base.logoSolvedCount = connectedIds(room).filter((id) => !!cur.logoCorrect?.[id]).length;
      base.logoTotal = connectedIds(room).length;
      base.guessFeed = (cur.guessFeed || []).slice(-20);
      base.yourStatus = cur.logoCorrect?.[forId] ? { status: 'correct' } : cur.logoNear?.[forId] ? { status: 'near' } : null;
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
    }
    if (cur.miniType === 'logo') {
      result.answer = cur.logo?.name || 'Logo';
      const rows = ids.map((id) => ({ id, elapsed: Number(cur.logoCorrect?.[id] || 0) }))
        .sort((a, b) => (a.elapsed || Infinity) - (b.elapsed || Infinity) || a.id.localeCompare(b.id));
      if (reason !== 'broken') {
        const valid = rows.filter((row) => row.elapsed > 0);
        const ranked = gentleRankSips(valid.map((row) => ({ id: row.id, value: row.elapsed })));
        rows.forEach((row) => { sipMap[row.id] = row.elapsed > 0 ? (ranked[row.id] || 0) : 2; });
        result.miniRows = rows.map((row) => ({ name: displayName(room, row.id), label: row.elapsed > 0 ? (row.elapsed / 1000).toFixed(2) + ' s' : 'nicht erkannt' }));
        result.lines.push('Schnell erkannt = trocken. Wer länger braucht, sammelt bis zu zwei Schlücke.');
      } else {
        result.miniRows = [];
        result.lines.push('Das Logo konnte nicht geladen werden. Runde ohne Strafe übersprungen.');
      }
    }`;

const allAnsweredTimerOld = `    if (cur.miniType === 'taps') return ids.every((id) => !!cur.tapDone?.[id]);
    if (cur.miniType === 'allemalen') {`;
const allAnsweredTimerNew = `    if (cur.miniType === 'taps') return ids.every((id) => !!cur.tapDone?.[id]);
    if (cur.miniType === 'zeitgefuehl') return ids.every((id) => !!cur.timerResults?.[id]);
    if (cur.miniType === 'logo') return ids.every((id) => !!cur.logoCorrect?.[id]);
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
    if (cur.miniType === 'logo') {
      total = 25;
      cur.text = 'Erkenne das Logo.';
      cur.logo = pickLogoPrompt(room);
      cur.logoStartedAt = now;
      cur.logoCorrect = {};
      cur.logoAttempts = {};
      cur.logoNear = {};
      cur.guessFeed = [];
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
    if (msg.t === 'miniLogoGuess' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'logo') {
      const cur = room.current;
      if (cur.logoCorrect?.[me]) return;
      const guess = String(msg.v || '').trim().slice(0, 64);
      if (guess.length < 1) return;
      cur.logoAttempts[me] = clamp(Number(cur.logoAttempts[me] || 0) + 1, 0, 50);
      const match = matchLogoGuess(cur.logo, guess);
      if (match.status === 'correct') {
        cur.logoCorrect[me] = clamp(Date.now() - Number(cur.logoStartedAt || Date.now()), 1, 60000);
        cur.logoNear[me] = false;
        send(room.players[me].ws, { t: 'guessFeedback', status: 'correct', m: 'Richtig! Dein Tipp bleibt geheim.' });
      } else if (match.status === 'near') {
        cur.logoNear[me] = true;
        send(room.players[me].ws, { t: 'guessFeedback', status: 'near', m: 'Sehr nah dran – bleibt privat.' });
      } else {
        cur.logoNear[me] = false;
        cur.guessFeed.push({ name: displayName(room, me), guess });
        if (cur.guessFeed.length > 40) cur.guessFeed.shift();
        send(room.players[me].ws, { t: 'guessFeedback', status: 'wrong', m: 'Falsch – dieser Tipp ist für alle sichtbar.' });
      }
      if (allAnswered(room)) finishRound(room, 'complete'); else broadcast(room);
      return;
    }
    if (msg.t === 'miniLogoBroken' && isHost && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'logo') {
      finishRound(room, 'broken');
      return;
    }
    if (msg.t === 'miniReact' && room.phase === 'question' && room.current?.type === 'minigame' && room.current.miniType === 'reaktion') {`;

// Logo-Raten als normale Kategorie neben Person, Bild und Song.
const logoPoolOld = `Q.minigame = ['arcade'];`;
const logoPoolNew = `Q.minigame = ['arcade'];
Q.logo = ['logo'];`;
const logoCategoryOld = `  minigame: 'Minigames',
};`;
const logoCategoryNew = `  minigame: 'Minigames',
  logo: 'Erkenne das Logo',
};`;
const logoDeckOld = `    deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group, 'minigame', 'minigame', 'minigame']`;
const logoDeckNew = `    deck = ['schaetz', 'trivia', 'person', 'bild', 'song', 'logo', social, social, 'oder', 'oder', adult, adult, group, group, 'minigame', 'minigame', 'minigame']`;
const logoWeightsOld = `    const customWeights = { schaetz: 5, minigame: 5, wahl: 3, trivia: 3, song: 3, person: 2, bild: 2, nie: 2, mehrheit: 2, skala: 2, oder: 2, wahrheit: 2, pflicht: 2 };`;
const logoWeightsNew = `    const customWeights = { minigame: 5, wahl: 5, nie: 5, wahrheit: 5, pflicht: 5, oder: 4, mehrheit: 4, skala: 4, schaetz: 3, trivia: 3, song: 3, person: 2, bild: 2, logo: 2 };`;
const logoAnsweredOld = `    else if (cur.type === 'song') answered = !!cur.songCorrect?.[id];`;
const logoAnsweredNew = `    else if (cur.type === 'song') answered = !!cur.songCorrect?.[id];
    else if (cur.type === 'logo') answered = !!cur.logoCorrect?.[id];`;
const logoPublicOld = `  if (cur.type === 'wahrheit' || cur.type === 'pflicht') base.isTarget = cur.target === forId;`;
const logoPublicNew = `  if (cur.type === 'logo') {
    base.logoImage = logoImageUrl(cur.logo);
    base.guessFeed = (cur.guessFeed || []).slice(-20);
    base.yourStatus = cur.logoCorrect?.[forId] ? { status: 'correct' } : cur.logoNear?.[forId] ? { status: 'near' } : null;
    base.logoSolvedCount = connectedIds(room).filter((id) => !!cur.logoCorrect?.[id]).length;
    base.logoTotal = connectedIds(room).length;
    base.isHost = forId === room.hostId;
  }
  if (cur.type === 'wahrheit' || cur.type === 'pflicht') base.isTarget = cur.target === forId;`;
const logoAllAnsweredOld = `  if (cur.type === 'wahrheit' || cur.type === 'pflicht') return cur.answers[cur.target] !== undefined;`;
const logoAllAnsweredNew = `  if (cur.type === 'logo') return ids.every((id) => !!cur.logoCorrect?.[id]);
  if (cur.type === 'wahrheit' || cur.type === 'pflicht') return cur.answers[cur.target] !== undefined;`;
const logoStartOld = `  cur.deadline = (type === 'minigame' && cur.miniType === 'taps') ? null : Date.now() + total * 1000;`;
const logoStartNew = `  if (type === 'logo') {
    total = 25; cur.total = total; cur.text = 'Erkenne das Logo.'; cur.logo = pickLogoPrompt(room); cur.logoStartedAt = Date.now();
    cur.logoCorrect = {}; cur.logoNear = {}; cur.logoAttempts = {}; cur.guessFeed = [];
  }
  cur.deadline = (type === 'minigame' && cur.miniType === 'taps') ? null : Date.now() + total * 1000;`;
const logoGuessGuardOld = `  const cur = room.current; if (!cur || room.phase !== 'question' || !['person', 'bild', 'song'].includes(cur.type)) return;`;
const logoGuessGuardNew = `  const cur = room.current; if (!cur || room.phase !== 'question' || !['person', 'bild', 'song', 'logo'].includes(cur.type)) return;`;
const logoGuessBranchOld = `  } else {
    if (cur.personCorrect[me]) return;`;
const logoGuessBranchNew = `  } else if (cur.type === 'logo') {
    if (cur.logoCorrect?.[me]) return;
    const guess = String(rawGuess || '').trim().slice(0, 64); if (guess.length < 1) return;
    cur.logoAttempts[me] = clamp(Number(cur.logoAttempts[me] || 0) + 1, 0, 50);
    const match = matchLogoGuess(cur.logo, guess);
    if (match.status === 'correct') {
      cur.logoCorrect[me] = clamp(Date.now() - Number(cur.logoStartedAt || Date.now()), 1, 60000); cur.logoNear[me] = false;
      send(room.players[me].ws, { t: 'guessFeedback', status: 'correct', m: 'Richtig! Dein Tipp bleibt geheim.' });
    } else if (match.status === 'near') {
      cur.logoNear[me] = true; send(room.players[me].ws, { t: 'guessFeedback', status: 'near', m: 'Sehr nah dran – bleibt privat.' });
    } else {
      cur.logoNear[me] = false; cur.guessFeed.push({ name: displayName(room, me), guess }); if (cur.guessFeed.length > 40) cur.guessFeed.shift();
      send(room.players[me].ws, { t: 'guessFeedback', status: 'wrong', m: 'Falsch – dieser Tipp ist für alle sichtbar.' });
    }
  } else {
    if (cur.personCorrect[me]) return;`;
const logoFinishOld = `  if (cur.type === 'nie') {`;
const logoFinishNew = `  if (cur.type === 'logo') {
    result.answer = cur.logo?.name || 'Logo'; result.guesses = (cur.guessFeed || []).slice();
    const rows = ids.map((id) => ({ id, elapsed: Number(cur.logoCorrect?.[id] || 0) }))
      .sort((a, b) => (a.elapsed || Infinity) - (b.elapsed || Infinity) || a.id.localeCompare(b.id));
    if (reason !== 'broken') {
      const valid = rows.filter((row) => row.elapsed > 0);
      const ranked = gentleRankSips(valid.map((row) => ({ id: row.id, value: row.elapsed })));
      rows.forEach((row) => { sipMap[row.id] = row.elapsed > 0 ? (ranked[row.id] || 0) : 2; });
      result.miniRows = rows.map((row) => ({ name: displayName(room, row.id), label: row.elapsed > 0 ? (row.elapsed / 1000).toFixed(2) + ' s' : 'nicht erkannt' }));
      result.lines.push('Schnell erkannt = trocken. Wer länger braucht, sammelt bis zu zwei Schlücke.');
    } else result.lines.push('Das Logo konnte nicht geladen werden. Runde ohne Strafe übersprungen.');
  }
  if (cur.type === 'nie') {`;
const logoTimeoutOld = `  if (reason === 'timeout' && !['person', 'bild', 'song', 'wahrheit', 'pflicht'].includes(cur.type)) {`;
const logoTimeoutNew = `  if (reason === 'timeout' && !['person', 'bild', 'song', 'logo', 'wahrheit', 'pflicht'].includes(cur.type)) {`;
const logoBrokenOld = `    if (msg.t === 'songBroken' && isHost && room.phase === 'question' && room.current?.type === 'song') return finishRound(room, 'broken');`;
const logoBrokenNew = `    if (msg.t === 'songBroken' && isHost && room.phase === 'question' && room.current?.type === 'song') return finishRound(room, 'broken');
    if (msg.t === 'logoBroken' && isHost && room.phase === 'question' && room.current?.type === 'logo') return finishRound(room, 'broken');`;

const healthOld = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true })); return; }";
const healthNew = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, blindTimer: true, logoGame: true, logoCategory: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true, songSource: 'youtube', youtubePlayback: true, ruleRounds: false })); return; }";

const v51BasePatches = [
  basePatchSource(minigameImportOld, minigameImportNew, 'v5.1 Minigame-Helper'),
  basePatchSource(miniLabelsOld, miniLabelsNew, 'v5.1 Minigame-Labels'),
  basePatchSource(miniAnsweredOld, miniAnsweredNew, 'v5.1 beantwortet'),
  basePatchSource(miniPublicOld, miniPublicNew, 'v5.1 Public State'),
  basePatchSource(memoryResultOld, memoryResultNew, 'v5.1 Ergebnisse'),
  basePatchSource(allAnsweredTimerOld, allAnsweredTimerNew, 'v5.1 Abschluss'),
  basePatchSource(startTimerOld, startTimerNew, 'v5.1 Start'),
  basePatchSource(timerHandlerOld, timerHandlerNew, 'v5.1 Nachrichten'),
  basePatchSource(logoPoolOld, logoPoolNew, 'Logo-Fragenpool'),
  basePatchSource(logoCategoryOld, logoCategoryNew, 'Logo-Kategorie'),
  basePatchSource(logoDeckOld, logoDeckNew, 'Logo-Standardmix'),
  basePatchSource(logoWeightsOld, logoWeightsNew, 'Logo-Gewichtung'),
  basePatchSource(logoAnsweredOld, logoAnsweredNew, 'Logo-beantwortet'),
  basePatchSource(logoPublicOld, logoPublicNew, 'Logo-Public-State'),
  basePatchSource(logoAllAnsweredOld, logoAllAnsweredNew, 'Logo-Abschluss'),
  basePatchSource(logoStartOld, logoStartNew, 'Logo-Rundenstart'),
  basePatchSource(logoGuessGuardOld, logoGuessGuardNew, 'Logo-Guess-Guard'),
  basePatchSource(logoGuessBranchOld, logoGuessBranchNew, 'Logo-Raten'),
  basePatchSource(logoFinishOld, logoFinishNew, 'Logo-Ergebnis'),
  basePatchSource(logoTimeoutOld, logoTimeoutNew, 'Logo-Timeout'),
  basePatchSource(logoBrokenOld, logoBrokenNew, 'Logo-Ueberspringen'),
  basePatchSource(healthOld, healthNew, 'Health Flags'),
].join('\n');

// server-v471 erzeugt server-v461 dynamisch. Die v5.1-Patches müssen deshalb
// in dessen Base-Patch-Liste eingeschleust werden, bevor der finale Server kompiliert.
const compileAnchor = "const runtime = new Module(basePath, module.parent || module);\nruntime.filename = basePath;";
const generatorPatch = [
  `const v51ExtraSource = ${JSON.stringify(v51BasePatches)};`,
  "const v51Marker = \"const runtimeAnchor = 'const runtime = new Module(basePath, module.parent || module);';\";",
  "src = replaceRequired(src, v51Marker, v51ExtraSource + '\\n\\n' + v51Marker, 'inject v5.1 base patches');",
].join('\n');
src = replaceRequired(src, compileAnchor, generatorPatch + '\n\n' + compileAnchor, 'v5.1 Generator-Patch');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
