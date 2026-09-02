'use strict';

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`iTunes-v4.8.1-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

function replaceFunctionRange(html, startMarker, endMarker, replacement, label) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`iTunes-v4.8.1-Patch fehlt: ${label}`);
  return html.slice(0, start) + replacement + html.slice(end);
}

module.exports = function tuneITunes481(html) {
  // Remove the old visible YouTube lobby-unlock extension while preserving the
  // drawing/rating extension that was added afterwards.
  const legacyAudioStart = html.indexOf('var AUDIO_WARMUP=');
  const drawingExtensionStart = html.indexOf('var allDrawRatings=');
  if (legacyAudioStart >= 0 && drawingExtensionStart > legacyAudioStart) {
    html = html.slice(0, legacyAudioStart) + html.slice(drawingExtensionStart);
  }

  html = mustReplace(html, '</style>', `
.itunes-song-status{margin:10px 0 12px;padding:10px 12px;border:1px solid rgba(143,92,255,.22);border-radius:13px;background:rgba(143,92,255,.055);color:var(--muted);font-size:12px;font-weight:800;text-align:center}
.itunes-song-status.ready{color:#91e9b8;border-color:rgba(87,227,154,.22);background:rgba(87,227,154,.055)}
.itunes-art{display:grid;place-items:center;margin:12px auto 2px}.itunes-art img{width:min(220px,65vw);aspect-ratio:1;object-fit:cover;border-radius:18px;border:1px solid var(--line)}
</style>`, 'iTunes styles');

  // Replace the complete host/player song UI using stable function markers,
  // not assumptions about whitespace inserted by older frontend layers.
  const songUi = `function songHostHtml(cur){
  return '<div id="songHostPanel"><div class="dj"><div class="dj-title">🎵 Errate den Song</div><div class="meta">iTunes-Preview · ein Knopf startet denselben Ausschnitt auf allen Handys gleichzeitig.</div></div><div id="itunesSongStatus" class="itunes-song-status">Song wird vorgeladen …</div><button id="songPlay" class="btn primary song-play">▶ Song starten</button><div style="height:10px"></div>'+guessHtml(cur,'Songtitel eingeben …')+'<button id="songBroken" class="btn ghost" style="margin-top:10px">Song funktioniert nicht · Runde überspringen</button></div>';
}
function songPlayerHtml(cur){
  return '<div class="song-stage">🎵 iTunes-Preview</div><div id="itunesSongStatus" class="itunes-song-status">Song wird vorgeladen … Der Master startet für alle.</div>'+guessHtml(cur,'Songtitel eingeben …');
}
`;
  // Minigame helpers are injected between songPlayerHtml() and questionBody().
  // Ending the replacement at questionBody() used to delete those helpers and
  // made the whole client crash on load (`resetMiniLocal is not defined`).
  const songUiEnd = html.includes('function isMiniRound(cur){')
    ? 'function isMiniRound(cur){'
    : 'function questionBody(cur){';
  html = replaceFunctionRange(html, 'function songHostHtml(cur){', songUiEnd, songUi, 'song UI');

  // Result page: show artwork rather than embedding a YouTube video.
  html = html.replace(
    /\s*if\(r\.type==='song'&&r\.videoId\)out\+='[^\n]*\n?/g,
    "\n  if(r.type==='song'&&r.artworkUrl)out+='<div class=\"itunes-art\"><img src=\"'+esc(r.artworkUrl)+'\" alt=\"Albumcover\"></div>';\n"
  );

  // Make sure dormant legacy functions cannot load YouTube even if an old call
  // path is accidentally reached. They are overridden below by HTML5 audio.
  html = html.replace(/https:\/\/www\.youtube\.com\/iframe_api/g, 'about:blank');
  html = html.replace(/https:\/\/www\.youtube-nocookie\.com/g, 'about:blank');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
var ITUNES_SILENCE='data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';
var itunesAudio=null,itunesAudioPrimed=false,itunesLoadedUrl='',itunesSyncTimer=null,itunesNeedsTap=false,serverClockOffset=0,lastSongSyncKey=null;
function getITunesAudio(){
  if(itunesAudio)return itunesAudio;
  itunesAudio=new Audio();itunesAudio.preload='auto';itunesAudio.setAttribute('playsinline','');itunesAudio.setAttribute('webkit-playsinline','');itunesAudio.volume=1;
  return itunesAudio;
}
function updateITunesStatus(text,ready){var e=document.getElementById('itunesSongStatus');if(!e)return;e.textContent=text||'';e.className='itunes-song-status'+(ready?' ready':'');}
function primeITunesAudio(){
  if(itunesAudioPrimed)return;
  var a=getITunesAudio();
  try{
    var previous=a.src;a.src=ITUNES_SILENCE;a.volume=.01;
    var p=a.play();
    if(p&&p.then)p.then(function(){itunesAudioPrimed=true;try{a.pause();a.currentTime=0;a.volume=1;}catch(e){}if(previous){a.src=previous;try{a.load();}catch(e){}}}).catch(function(){});
    else{itunesAudioPrimed=true;try{a.pause();a.volume=1;}catch(e){}}
  }catch(e){}
}
function prepareITunesSong(cur){
  if(!cur||cur.type!=='song'||!cur.previewUrl)return;
  var a=getITunesAudio(),url=String(cur.previewUrl||'');if(!url)return;
  if(itunesLoadedUrl!==url){itunesLoadedUrl=url;try{a.pause();a.src=url;a.preload='auto';a.load();}catch(e){}}
  var ready=function(){updateITunesStatus(cur.isHost?'✓ Song bereit · du startest für alle':'✓ Song bereit · warte auf den Master',true);};
  if(a.readyState>=2)ready();else{updateITunesStatus('Song wird vorgeladen …',false);a.oncanplay=ready;a.oncanplaythrough=ready;}
}
function stopITunesAudio(){if(itunesSyncTimer){clearTimeout(itunesSyncTimer);itunesSyncTimer=null;}try{if(itunesAudio)itunesAudio.pause();}catch(e){}lastSongSyncKey=null;}
function resumeBlockedITunes(){if(!itunesNeedsTap||!itunesAudio)return;itunesNeedsTap=false;var p;try{p=itunesAudio.play();}catch(e){return;}if(p&&p.catch)p.catch(function(){itunesNeedsTap=true;});}
function playSyncedITunes(m,force){
  var cur=state&&state.current;if(!cur||cur.type!=='song')return;
  var url=String(m.previewUrl||cur.previewUrl||'');if(!url){toast('Für diesen Song wurde keine iTunes-Vorschau gefunden.');return;}
  var syncKey=String(state.round)+':'+String(Number(m.at||0));if(lastSongSyncKey===syncKey&&!force)return;lastSongSyncKey=syncKey;
  prepareITunesSong({type:'song',previewUrl:url,isHost:cur.isHost});
  var a=getITunesAudio();if(itunesSyncTimer){clearTimeout(itunesSyncTimer);itunesSyncTimer=null;}
  var serverNow=Date.now()+Number(serverClockOffset||0),delay=Math.max(0,Number(m.at||serverNow)-serverNow);
  itunesSyncTimer=setTimeout(function(){
    if(!state||!state.current||state.current.type!=='song')return;
    var nowServer=Date.now()+Number(serverClockOffset||0),late=Math.max(0,(nowServer-Number(m.at||nowServer))/1000);
    try{if(itunesLoadedUrl!==url){a.src=url;itunesLoadedUrl=url;}if(late>0&&late<29)a.currentTime=late;a.volume=1;var p=a.play();if(p&&p.catch)p.catch(function(){itunesNeedsTap=true;toast('Tippe einmal auf den Bildschirm, dann läuft der Song weiter.');});updateITunesStatus('▶ Song läuft',true);}catch(e){itunesNeedsTap=true;toast('Tippe einmal auf den Bildschirm, dann läuft der Song weiter.');}
  },delay);
}

// Redirect every legacy song entry point to the persistent HTML5 audio player.
ensureYTApi=function(cur){prepareITunesSong(cur);};
createYTPlayer=function(cur){prepareITunesSong(cur);};
cleanupYouTube=function(){stopITunesAudio();};
playSyncedSong=function(m,force){playSyncedITunes(m,force);};
playSongButton=function(){var cur=state&&state.current;if(!cur||cur.type!=='song'||!cur.isHost)return;primeITunesAudio();prepareITunesSong(cur);send({t:'songPlay'});};

// Creating/joining the room is the user gesture that primes audio. No separate
// visible sound-activation button is needed in normal play.
var itunesBindLanding=bindLanding;
bindLanding=function(){
  itunesBindLanding();
  var c=document.getElementById('create'),j=document.getElementById('join');
  if(c){var oc=c.onclick;c.onclick=function(e){primeITunesAudio();return oc&&oc.call(this,e);};}
  if(j){var oj=j.onclick;j.onclick=function(e){primeITunesAudio();return oj&&oj.call(this,e);};}
};
var itunesRender=render;
render=function(){
  if(state&&state.now)serverClockOffset=Number(state.now)-Date.now();
  itunesRender();
  if(state&&state.phase==='question'&&state.current&&state.current.type==='song')prepareITunesSong(state.current);
};
document.addEventListener('pointerdown',function(){primeITunesAudio();resumeBlockedITunes();},{capture:true});
document.addEventListener('touchstart',function(){primeITunesAudio();resumeBlockedITunes();},{capture:true,passive:true});
`;

  html = mustReplace(html, anchor, extension + '\n' + anchor, 'iTunes audio runtime');
  return html;
};
