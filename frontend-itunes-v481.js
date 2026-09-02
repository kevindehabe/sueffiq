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
.itunes-enable{margin:0 0 10px}.itunes-enable.ready{color:var(--accent);border-color:rgba(184,255,74,.28);background:rgba(184,255,74,.06)}
.itunes-art{display:grid;place-items:center;margin:12px auto 2px}.itunes-art img{width:min(220px,65vw);aspect-ratio:1;object-fit:cover;border-radius:18px;border:1px solid var(--line)}
</style>`, 'iTunes styles');

  // Replace the complete host/player song UI using stable function markers,
  // not assumptions about whitespace inserted by older frontend layers.
  const songUi = `function songHostHtml(cur){
  return '<div id="songHostPanel"><div class="dj"><div class="dj-title">🎵 Errate den Song</div><div class="meta">iTunes-Preview · ein Knopf startet denselben Ausschnitt auf allen Handys gleichzeitig.</div></div><div id="itunesSongStatus" class="itunes-song-status">Song wird vorgeladen …</div><button id="itunesEnable" class="btn secondary itunes-enable">🔊 Ton aktivieren</button><button id="songPlay" class="btn primary song-play">▶ Song starten</button><div style="height:10px"></div>'+guessHtml(cur,'Songtitel eingeben …')+'<button id="songBroken" class="btn ghost" style="margin-top:10px">Song funktioniert nicht · Runde überspringen</button></div>';
}
function songPlayerHtml(cur){
  return '<div class="song-stage">🎵 iTunes-Preview</div><div id="itunesSongStatus" class="itunes-song-status">Song wird vorgeladen … Der Master startet für alle.</div><button id="itunesEnable" class="btn secondary itunes-enable">🔊 Ton aktivieren</button>'+guessHtml(cur,'Songtitel eingeben …');
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
var itunesAudio=null,itunesAudioPrimed=false,itunesAudioPriming=null,itunesLoadedUrl='',itunesSyncTimer=null,itunesNeedsTap=false,serverClockOffset=0,lastSongSyncKey=null,itunesLastStartAt=0,itunesLastUrl='';
function getITunesAudio(){
  if(itunesAudio)return itunesAudio;
  itunesAudio=document.createElement('audio');itunesAudio.id='sueffiqSongAudio';itunesAudio.preload='auto';itunesAudio.setAttribute('playsinline','');itunesAudio.setAttribute('webkit-playsinline','');itunesAudio.setAttribute('aria-hidden','true');itunesAudio.volume=1;
  itunesAudio.style.position='fixed';itunesAudio.style.width='1px';itunesAudio.style.height='1px';itunesAudio.style.opacity='0';itunesAudio.style.pointerEvents='none';itunesAudio.style.left='-10px';itunesAudio.style.bottom='0';document.body.appendChild(itunesAudio);
  return itunesAudio;
}
function updateITunesStatus(text,ready){var e=document.getElementById('itunesSongStatus');if(!e)return;e.textContent=text||'';e.className='itunes-song-status'+(ready?' ready':'');}
function updateITunesButton(){var b=document.getElementById('itunesEnable');if(!b)return;if(itunesNeedsTap){b.textContent='▶ Jetzt Ton starten';b.className='btn primary itunes-enable';}else if(itunesAudioPrimed){b.textContent='✓ Ton aktiviert';b.className='btn secondary itunes-enable ready';}else{b.textContent='🔊 Ton aktivieren';b.className='btn secondary itunes-enable';}}
function absoluteITunesUrl(value){try{return new URL(String(value||''),location.href).href;}catch(e){return String(value||'');}}
function primeITunesAudio(){
  if(itunesAudioPrimed){updateITunesButton();return Promise.resolve(true);}
  if(itunesAudioPriming)return itunesAudioPriming;
  var a=getITunesAudio(),previous=itunesLoadedUrl||a.getAttribute('src')||'';
  try{
    a.src=ITUNES_SILENCE;a.volume=.01;
    itunesAudioPriming=Promise.resolve(a.play()).then(function(){itunesAudioPrimed=true;try{a.pause();a.currentTime=0;a.volume=1;}catch(e){}if(previous){a.src=previous;try{a.load();}catch(e){}}else{try{a.removeAttribute('src');a.load();}catch(e){}}itunesAudioPriming=null;updateITunesButton();return true;}).catch(function(){itunesAudioPriming=null;try{a.pause();a.volume=1;}catch(e){}updateITunesButton();return false;});
  }catch(e){itunesAudioPriming=Promise.resolve(false);setTimeout(function(){itunesAudioPriming=null;updateITunesButton();},0);}
  return itunesAudioPriming;
}
function prepareITunesSong(cur){
  if(!cur||cur.type!=='song'||!cur.previewUrl)return;
  var a=getITunesAudio(),url=absoluteITunesUrl(cur.previewUrl);if(!url)return;
  if(itunesLoadedUrl!==url){itunesLoadedUrl=url;try{a.pause();a.src=url;a.preload='auto';a.load();}catch(e){}}
  var ready=function(){updateITunesStatus(cur.isHost?'✓ Song bereit · du startest für alle':'✓ Song bereit · warte auf den Master',true);};
  if(a.readyState>=2)ready();else{updateITunesStatus('Song wird vorgeladen …',false);a.oncanplay=ready;a.oncanplaythrough=ready;a.onerror=function(){updateITunesStatus('Song konnte noch nicht geladen werden · Ton erneut aktivieren',false);};}
  updateITunesButton();
}
function stopITunesAudio(){if(itunesSyncTimer){clearTimeout(itunesSyncTimer);itunesSyncTimer=null;}try{if(itunesAudio)itunesAudio.pause();}catch(e){}lastSongSyncKey=null;itunesNeedsTap=false;itunesLastStartAt=0;itunesLastUrl='';updateITunesButton();}
function markITunesBlocked(){var first=!itunesNeedsTap;itunesNeedsTap=true;updateITunesStatus('Ton wartet auf deine Freigabe.',false);updateITunesButton();if(first)toast('Tippe auf „Jetzt Ton starten“, damit der Song hörbar wird.');}
function seekITunesAudio(a,startAt){var nowServer=Date.now()+Number(serverClockOffset||0),late=Math.max(0,(nowServer-Number(startAt||nowServer))/1000);if(late>0&&late<29){try{a.currentTime=late;}catch(e){}}return late;}
function startITunesAudio(url,startAt){
  var a=getITunesAudio(),target=absoluteITunesUrl(url);if(!target)return;
  if(itunesLoadedUrl!==target){itunesLoadedUrl=target;try{a.src=target;a.load();}catch(e){}}
  if(a.readyState>=1)seekITunesAudio(a,startAt);else a.addEventListener('loadedmetadata',function(){seekITunesAudio(a,startAt);},{once:true});
  var p;try{a.volume=1;p=a.play();}catch(e){markITunesBlocked();return;}
  if(p&&p.then)p.then(function(){itunesNeedsTap=false;itunesAudioPrimed=true;updateITunesStatus('▶ Song läuft',true);updateITunesButton();}).catch(markITunesBlocked);else{itunesNeedsTap=false;itunesAudioPrimed=true;updateITunesStatus('▶ Song läuft',true);updateITunesButton();}
}
function resumeBlockedITunes(){var cur=state&&state.current;if(!cur||cur.type!=='song')return;var url=itunesLastUrl||cur.previewUrl,startAt=itunesLastStartAt||cur.songStartedAt;if(!url||!startAt)return;itunesNeedsTap=false;startITunesAudio(url,startAt);}
function activateITunesAudio(){var cur=state&&state.current;if(cur&&cur.type==='song'&&cur.songStartedAt){itunesLastUrl=cur.previewUrl;itunesLastStartAt=Number(cur.songStartedAt);itunesNeedsTap=true;resumeBlockedITunes();return;}primeITunesAudio();}
function playSyncedITunes(m,force){
  var cur=state&&state.current;if(!cur||cur.type!=='song')return;
  var url=absoluteITunesUrl(m.previewUrl||cur.previewUrl||'');if(!url){toast('Für diesen Song wurde keine iTunes-Vorschau gefunden.');return;}
  var syncKey=String(state.round)+':'+String(Number(m.at||0));if(lastSongSyncKey===syncKey&&!force)return;lastSongSyncKey=syncKey;
  itunesLastStartAt=Number(m.at||cur.songStartedAt||0);itunesLastUrl=url;
  prepareITunesSong({type:'song',previewUrl:url,isHost:cur.isHost});
  var a=getITunesAudio();if(itunesSyncTimer){clearTimeout(itunesSyncTimer);itunesSyncTimer=null;}
  var serverNow=Date.now()+Number(serverClockOffset||0),delay=Math.max(0,Number(m.at||serverNow)-serverNow);
  itunesSyncTimer=setTimeout(function(){
    if(!state||!state.current||state.current.type!=='song')return;
    startITunesAudio(url,Number(m.at||itunesLastStartAt));
  },delay);
}

// Redirect every legacy song entry point to the persistent HTML5 audio player.
ensureYTApi=function(cur){prepareITunesSong(cur);};
createYTPlayer=function(cur){prepareITunesSong(cur);};
cleanupYouTube=function(){stopITunesAudio();};
playSyncedSong=function(m,force){playSyncedITunes(m,force);};
playSongButton=function(){var cur=state&&state.current;if(!cur||cur.type!=='song'||!cur.isHost)return;primeITunesAudio().then(function(){prepareITunesSong(cur);send({t:'songPlay'});});};

// Creating/joining primes audio; the song card also keeps an explicit mobile
// fallback button for browsers that revoke autoplay permission later.
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
  if(state&&state.phase==='question'&&state.current&&state.current.type==='song'){
    prepareITunesSong(state.current);var enable=document.getElementById('itunesEnable');if(enable)enable.onclick=activateITunesAudio;
    if(state.current.songStartedAt)playSyncedITunes({at:state.current.songStartedAt,previewUrl:state.current.previewUrl},false);
  }else if(itunesLastStartAt||itunesNeedsTap){stopITunesAudio();}
};
function handleITunesGesture(e){if(e&&e.target&&e.target.id==='itunesEnable')return;if(itunesNeedsTap)resumeBlockedITunes();else if(!itunesAudioPrimed)primeITunesAudio();}
document.addEventListener('pointerdown',handleITunesGesture,{capture:true});
document.addEventListener('touchstart',handleITunesGesture,{capture:true,passive:true});
`;

  html = mustReplace(html, anchor, extension + '\n' + anchor, 'iTunes audio runtime');
  return html;
};
