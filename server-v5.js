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

const child = spawn(process.execPath, [path.join(__dirname, 'server-v4.js')], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (code !== 0 && signal !== 'SIGTERM') {
    console.error(`SüffIQ core exited (${code ?? signal})`);
  }
});

function patchedHtml() {
  let html = fs.readFileSync(baseHtmlPath, 'utf8');

  html = html.replace('SüffIQ v4.0', 'SüffIQ v4.1');
  html = html.replace(
    '</style>',
    '.yt-stealth{position:fixed;left:-10000px;top:0;width:240px;height:240px;overflow:hidden;pointer-events:none;opacity:.01}.song-play{font-size:20px;padding:19px 16px}.yt-reveal{margin-top:14px}.yt-reveal iframe{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:14px}</style>'
  );

  html = html.replace(
    "var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false;",
    "var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false,pendingPlayStage=null,songPlayCount=0,songRound=0;"
  );

  html = html.replace(
    /function songHostHtml\(cur\)\{[\s\S]*?\n\}\nfunction songPlayerHtml/,
    `function songHostHtml(cur){
  return '<div id="songHostPanel"><div class="dj"><div class="dj-title">🎵 Errate den Song</div><div class="meta">Kein Titel, kein Cover, kein Video vor der Auflösung. Tippe auf Play und hör nur den Ausschnitt.</div></div>'+ '<button id="songPlay" class="btn primary song-play">▶ Song abspielen</button>'+ '<div id="ytStealth" class="yt-stealth" aria-hidden="true"><div id="ytPlayer"></div></div>'+ '<button id="songBroken" class="btn ghost" style="margin-top:10px">Song funktioniert nicht · Runde überspringen</button></div>';
}
function songPlayerHtml`
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
          if(pendingPlayStage!==null){var s=pendingPlayStage;pendingPlayStage=null;playSnippet(s);}
        },
        onError:function(){ytPlayerReady=false;pendingPlayStage=null;toast('Dieser Song kann hier nicht abgespielt werden.');}
      }
    });
  }catch(e){toast('Song konnte nicht geladen werden.');}
}
function playSnippet(stage){
  var cur=state&&state.current;if(!cur||cur.type!=='song'||!cur.isHost)return;
  if(!ytPlayer||!ytPlayerReady){pendingPlayStage=stage;ensureYTApi(cur);return;}
  var lengths=cur.songSnippets||[1,3,7,12],seconds=lengths[stage]||1,start=Number(cur.startSeconds||0);
  send({t:'songStage',v:stage});
  try{
    ytPlayer.loadVideoById({videoId:cur.videoId,startSeconds:start,endSeconds:start+seconds});
    if(ytPlayer.unMute)ytPlayer.unMute();
  }catch(e){toast('Ausschnitt konnte nicht gestartet werden.');}
}
function playSongButton(){
  var cur=state&&state.current;if(!cur||cur.type!=='song'||!cur.isHost)return;
  if(songRound!==state.round){songRound=state.round;songPlayCount=0;}
  var stage=Math.min(songPlayCount,3);
  songPlayCount=Math.min(songPlayCount+1,3);
  if(!ytPlayer||!ytPlayerReady){pendingPlayStage=stage;ensureYTApi(cur);return;}
  playSnippet(stage);
}
function bind(){`
  );

  html = html.replace(
    "  var load=document.getElementById('loadYT');if(load)load.onclick=function(){ensureYTApi(state.current);};\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};\n  a=document.querySelectorAll('.snippet');for(i=0;i<a.length;i++)a[i].onclick=function(){playSnippet(Number(this.getAttribute('data-stage')));};",
    "  var play=document.getElementById('songPlay');if(play)play.onclick=playSongButton;\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};"
  );

  html = html.replace(
    "  if(r.votes&&r.votes.length){",
    "  if(r.type==='song'&&state.current&&state.current.isHost&&state.current.videoId)out+='<div class=\"yt-reveal\"><iframe src=\"https://www.youtube.com/embed/'+esc(state.current.videoId)+'?autoplay=1&playsinline=1&rel=0\" title=\"Musikvideo\" allow=\"autoplay; encrypted-media; picture-in-picture\" allowfullscreen></iframe></div>';\n  if(r.votes&&r.votes.length){"
  );

  html = html.replace(
    "  bind();tick();timerLoop=setInterval(tick,250);",
    "  bind();if(songHost&&!ytPlayer)setTimeout(function(){if(state&&state.current&&state.current.type==='song'&&state.current.isHost)ensureYTApi(state.current);},0);tick();timerLoop=setInterval(tick,250);"
  );

  return html;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, version: '4.1.0', core: '4.0.0' }));
    return;
  }
  if (req.url === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('User-agent: *\nDisallow:\n');
    return;
  }
  if (req.url !== '/' && req.url !== '/index.html' && req.url !== '/v4.html') {
    res.writeHead(302, { location: '/' });
    res.end();
    return;
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
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SüffIQ v4.1 shell läuft auf http://localhost:${PORT} (core ${INTERNAL_PORT})`);
});
