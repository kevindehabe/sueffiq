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

// Keep all v4.7 drawing/minigame fixes, but put the iTunes frontend at the end of that chain.
src = replaceRequired(src, './frontend-draw-timing-v47', './frontend-itunes-v48', 'iTunes frontend');

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

function scheduleRound(room) {`;

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
    base.previewUrl = cur.previewUrl || null;
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
      const payload = { t: 'songPlay', at, previewUrl: room.current.previewUrl, artworkUrl: room.current.artworkUrl || '', videoId: room.current.song.videoId, startSeconds: 0 };
      for (const id of connectedIds(room)) send(room.players[id].ws, payload); return broadcast(room);
    }`;

const songResultOld = "    result.answer = `${cur.song.title} – ${cur.song.artist}`; result.videoId = cur.song.videoId; result.guesses = cur.guessFeed.slice();";
const songResultNew = "    result.answer = `${cur.song.title} – ${cur.song.artist}`; result.artworkUrl = cur.artworkUrl || ''; result.guesses = cur.guessFeed.slice();";

const healthOld = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true })); return; }";
const healthNew = "imageStepSeconds: 4, maxSipsPerRound: 3, minigames: MINI_TYPES, minigameSelection: true, pong: true, blackjack: true, allDrawRanking: true, inviteLinks: true, masterTransfer: true, songSource: 'itunes', youtubePlayback: false })); return; }";

const v48BasePatches = [
  basePatchSource('function scheduleRound(room) {', previewHelper, 'iTunes preview resolver'),
  basePatchSource(publicSongOld, publicSongNew, 'public iTunes preview'),
  basePatchSource(songStartOld, songStartNew, 'resolve iTunes preview before song round'),
  basePatchSource(songPlayOld, songPlayNew, 'synchronized iTunes song play'),
  basePatchSource(songResultOld, songResultNew, 'iTunes result artwork'),
  basePatchSource(healthOld, healthNew, 'iTunes health flags'),
].join('\n');

// server-v471 compiles server-v461. Insert extra base patches into server-v461 before it compiles server-v46.
const compileAnchor = "const runtime = new Module(basePath, module.parent || module);";
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
