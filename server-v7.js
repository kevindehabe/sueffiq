'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;

const PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.SUEFFIQ_INTERNAL_PORT || 31337);
const baseHtmlPath = path.join(__dirname, 'public', 'v4.html');
const baseCorePath = path.join(__dirname, 'server-v4.js');
const runtimeCorePath = path.join(__dirname, `.server-v43-runtime-${process.pid}.js`);

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

function buildRuntimeCore() {
  let core = fs.readFileSync(baseCorePath, 'utf8');

  core = replaceRequired(
    core,
    "const extraQ = require('./extras');",
    "const extraQ = require('./extras');\nconst moreQ = require('./more');",
    'moreQ import'
  );
  core = replaceRequired(
    core,
    "for (const key of new Set([...Object.keys(baseQ), ...Object.keys(extraQ)])) {\n  const a = Array.isArray(baseQ[key]) ? baseQ[key] : [];\n  const b = Array.isArray(extraQ[key]) ? extraQ[key] : [];\n  Q[key] = [...a, ...b];\n}",
    "for (const key of new Set([...Object.keys(baseQ), ...Object.keys(extraQ), ...Object.keys(moreQ)])) {\n  const a = Array.isArray(baseQ[key]) ? baseQ[key] : [];\n  const b = Array.isArray(extraQ[key]) ? extraQ[key] : [];\n  const c = Array.isArray(moreQ[key]) ? moreQ[key] : [];\n  Q[key] = [...a, ...b, ...c];\n}",
    'moreQ merge'
  );

  core = replaceRequired(
    core,
    "function songPlayers(room) { return connectedIds(room).filter((id) => id !== room.hostId); }",
    "function songPlayers(room) { return connectedIds(room); }",
    'host song participant'
  );
  core = replaceRequired(
    core,
    "else if (cur.type === 'song') answered = id === room.hostId || !!cur.songCorrect?.[id];",
    "else if (cur.type === 'song') answered = !!cur.songCorrect?.[id];",
    'song answered'
  );
  core = replaceRequired(
    core,
    "    if (me === room.hostId || cur.songCorrect[me]) return;",
    "    if (cur.songCorrect[me]) return;",
    'host may guess'
  );
  core = replaceRequired(
    core,
    "    result.answer = `${cur.song.title} – ${cur.song.artist}`;",
    "    result.answer = `${cur.song.title} – ${cur.song.artist}`;\n    result.videoId = cur.song.videoId;",
    'song result video'
  );

  core = replaceRequired(
    core,
    "    if (base.isHost) {\n      base.videoId = cur.song.videoId;\n      base.startSeconds = cur.song.start || 0;\n    }",
    "    base.videoId = cur.song.videoId;\n    base.startSeconds = cur.song.start || 0;",
    'song id for all players'
  );

  core = replaceRequired(
    core,
    "  if (type === 'song' && connectedIds(room).length < 2) type = nextCategory(room);",
    "  // Songrunden sind auch solo erlaubt.",
    'solo songs'
  );

  core = replaceRequired(
    core,
    "  if (type === 'schaetz') { const q = pick(room, type); cur.text = q.q; cur.answer = q.a; cur.unit = q.unit; }",
    "  if (type === 'schaetz') { const q = pick(room, type); cur.text = q.unit ? `${q.q} (Antwort in ${q.unit})` : q.q; cur.answer = q.a; cur.unit = q.unit; }",
    'estimate units'
  );

  core = replaceRequired(
    core,
    "  pflicht: 35, person: 45, bild: 45, song: 55, mehrheit: 30, skala: 30,",
    "  pflicht: 35, person: 45, bild: 30, song: 55, mehrheit: 30, skala: 30,",
    'image round duration'
  );

  core = replaceRequired(
    core,
    "  if (cur.type === 'bild') {\n    const step = Math.floor((sec * 1000) / 5);",
    "  if (cur.type === 'bild') {\n    const step = 4000;",
    'image sharpen speed'
  );

  core = replaceRequired(
    core,
`function buildDeck(room) {
  let deck = [];
  for (const cat of CATEGORY_ORDER) {
    if (!Array.isArray(Q[cat]) || !Q[cat].length) continue;
    for (let i = 0; i < (WEIGHTS[cat] || 1); i += 1) deck.push(cat);
  }
  deck = shuffle(deck);
  for (let i = 1; i < deck.length; i += 1) {
    if (deck[i] !== deck[i - 1]) continue;
    const swap = deck.findIndex((x, j) => j > i && x !== deck[i - 1]);
    if (swap > i) [deck[i], deck[swap]] = [deck[swap], deck[i]];
  }
  room.deck = deck;
}`,
`function buildDeck(room) {
  if (room.socialFlip === undefined) room.socialFlip = Math.random() < 0.5;
  if (room.adultFlip === undefined) room.adultFlip = Math.random() < 0.5;
  if (room.groupFlip === undefined) room.groupFlip = Math.random() < 0.5;

  const social = room.socialFlip ? 'nie' : 'wahl';
  const adult = room.adultFlip ? 'wahrheit' : 'pflicht';
  const group = room.groupFlip ? 'mehrheit' : 'skala';
  room.socialFlip = !room.socialFlip;
  room.adultFlip = !room.adultFlip;
  room.groupFlip = !room.groupFlip;

  let deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group]
    .filter((cat) => Array.isArray(Q[cat]) && Q[cat].length);
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
}`,
    '10 round deck'
  );

  core = replaceRequired(
    core,
    "    if (msg.t === 'songStage') return setSongStage(room, me, msg.v);",
    "    if (msg.t === 'songPlay' && isHost && room.phase === 'question' && room.current?.type === 'song') {\n      const payload = { t: 'songPlay', at: Date.now() + 1200, videoId: room.current.song.videoId, startSeconds: room.current.song.start || 0 };\n      for (const id of connectedIds(room)) send(room.players[id].ws, payload);\n      return;\n    }\n    if (msg.t === 'songStage') return setSongStage(room, me, msg.v);",
    'synchronized song start'
  );

  core = core.replace(/version: '4\.0\.0'/g, "version: '4.3.0'");
  core = core.replace(/SüffIQ\/4\.0/g, 'SueffIQ/4.3');
  core = core.replace('SüffIQ v4 läuft', 'SüffIQ v4.3 core läuft');

  fs.writeFileSync(runtimeCorePath, core, 'utf8');
}

buildRuntimeCore();

const child = spawn(process.execPath, [runtimeCorePath], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (code !== 0 && signal !== 'SIGTERM') console.error(`SüffIQ core exited (${code ?? signal})`);
});

function patchedHtml() {
  let html = fs.readFileSync(baseHtmlPath, 'utf8');

  html = html.replace('SüffIQ v4.0', 'SüffIQ v4.3');
  html = html.replace(
    '</style>',
    '.yt-stealth{position:fixed;left:-10000px;top:0;width:240px;height:240px;overflow:hidden;pointer-events:none;opacity:.01}.song-play{font-size:20px;padding:19px 16px}.yt-reveal{margin-top:14px}.yt-reveal iframe{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:14px}.mix-note{margin-top:8px;color:var(--muted);font-size:11px;text-align:center}</style>'
  );

  html = replaceRequired(
    html,
    "var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false;",
    "var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false,pendingSync=null,syncTimer=null;",
    'frontend song vars'
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
    'frontend song sync message'
  );

  html = replaceRequired(
    html,
    "  var load=document.getElementById('loadYT');if(load)load.onclick=function(){ensureYTApi(state.current);};\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};\n  a=document.querySelectorAll('.snippet');for(i=0;i<a.length;i++)a[i].onclick=function(){playSnippet(Number(this.getAttribute('data-stage')));};",
    "  var play=document.getElementById('songPlay');if(play)play.onclick=playSongButton;\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};",
    'frontend single play button'
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
    'song active cleanup'
  );

  html = replaceRequired(
    html,
    "  bind();tick();timerLoop=setInterval(tick,250);",
    "  bind();if(songActive&&!ytPlayer)setTimeout(function(){if(state&&state.current&&state.current.type==='song')ensureYTApi(state.current);},0);tick();timerLoop=setInterval(tick,250);",
    'preload song all devices'
  );

  html = html.replace(
    '<div class="footer">Automatischer Mix · keine Einstellungen · 18+</div>',
    '<div class="footer">Automatischer Mix · keine Einstellungen · 18+</div><div class="mix-note">10-Runden-Mix: Schätzen 2× · Quiz · Person · Bild · Song · Social · Entweder/Oder · 18+ · Gruppe</div>'
  );

  return html;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, version: '4.3.0', mix: '10-round-variety', syncedSongs: true, continuousSongs: true, imageStepSeconds: 4 }));
    return;
  }
  if (req.url === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('User-agent: *\nDisallow:\n');
    return;
  }
  if (req.url !== '/' && req.url !== '/index.html' && req.url !== '/v4.html') {
    res.writeHead(302, { location: '/' }); res.end(); return;
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, no-store, must-revalidate',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  res.end(patchedHtml());
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (client) => {
    const upstream = new WebSocket(`ws://127.0.0.1:${INTERNAL_PORT}`);
    const queue = [];

    client.on('message', (data, isBinary) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
      else queue.push([data, isBinary]);
    });
    upstream.on('open', () => {
      for (const [data, isBinary] of queue.splice(0)) upstream.send(data, { binary: isBinary });
    });
    upstream.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
    });

    const closeBoth = () => {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) client.close();
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close();
    };
    client.on('close', () => { if (upstream.readyState === WebSocket.OPEN) upstream.close(); });
    upstream.on('close', () => { if (client.readyState === WebSocket.OPEN) client.close(); });
    upstream.on('error', closeBoth);
    client.on('error', closeBoth);
  });
});

function shutdown() {
  try { child.kill('SIGTERM'); } catch {}
  try { fs.unlinkSync(runtimeCorePath); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SüffIQ v4.3 shell läuft auf http://localhost:${PORT} (core ${INTERNAL_PORT})`);
});
