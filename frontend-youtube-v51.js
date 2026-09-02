'use strict';

const tuneBase = require('./frontend-draw-timing-v472');

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v5.1 Frontend-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}
function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`v5.1 Frontend-Patch fehlt: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

module.exports = function tuneYouTubeTimerV51(html) {
  html = tuneBase(html);

  // Zeitgefühl und Logo-Raten in der Minigame-Auswahl anbieten. Nur beim Zeitgefühl
  // bleibt der normale Rundentimer komplett unsichtbar.
  html = mustReplace(
    html,
    "keys=['zeichnen','allemalen','reaktion','taps','farbfolge','pong','blackjack']",
    "keys=['zeichnen','allemalen','reaktion','taps','farbfolge','zeitgefuehl','logo','pong','blackjack']",
    'v5.1 Minigame-Auswahl'
  );
  html = mustReplace(
    html,
    "if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';",
    "if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='zeitgefuehl')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';",
    'Zeitgefühl ohne sichtbaren Rundentimer'
  );

  // Der alte sichtbare „Spielton aktivieren“-Block in der Lobby wird nicht mehr gerendert.
  html = replaceRange(
    html,
    'var v471LobbyHtml=lobbyHtml;',
    'var v471Bind=bind;',
    "var v471LobbyHtml=lobbyHtml;lobbyHtml=function(){return v471LobbyHtml();};\n",
    'sichtbaren Lobby-Soundblock entfernen'
  );

  // YouTube schon auf der Startseite im Hintergrund vorbereiten. Die Freigabe erfolgt
  // dann unauffällig mit dem ohnehin nötigen Tippen auf „Spiel erstellen/beitreten“.
  html = mustReplace(
    html,
    "function prepareLobbyAudio(){if(!state||state.phase!=='lobby'||(state.selectedCats||[]).indexOf('song')<0)return;ensureGlobalYTSlot();ensureYTApi(AUDIO_WARMUP);updateLobbySoundButton();}",
    "function prepareLobbyAudio(){ensureGlobalYTSlot();ensureYTApi(AUDIO_WARMUP);updateLobbySoundButton();}",
    'YouTube auf Landing vorladen'
  );

  html = mustReplace(html, '</style>', `
.blind-timer-shell{display:grid;gap:14px;text-align:center}.blind-timer-target{display:grid;gap:2px;margin:2px auto 0;padding:12px 18px;border-radius:16px;background:rgba(184,255,74,.08);border:1px solid rgba(184,255,74,.22)}.blind-timer-target span{color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.blind-timer-target strong{color:var(--accent);font-size:31px;line-height:1.05}
.blind-timer-face{width:min(220px,58vw);aspect-ratio:1;margin:2px auto;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,rgba(143,92,255,.13),rgba(17,11,25,.96) 68%);border:2px solid rgba(143,92,255,.3);box-shadow:inset 0 0 0 9px rgba(255,255,255,.018),0 14px 40px rgba(0,0,0,.28)}.blind-timer-face span{font-size:52px;font-weight:1000;color:#d8caff}.blind-timer-face.running{border-color:rgba(184,255,74,.42);box-shadow:inset 0 0 0 9px rgba(184,255,74,.025),0 14px 40px rgba(0,0,0,.28)}.blind-timer-face.running span{color:var(--accent)}
.blind-timer-hint{min-height:34px;color:var(--muted);font-size:12px;font-weight:850;line-height:1.4}.blind-timer-stop{background:var(--danger)!important;color:#fff!important}.blind-timer-done{padding:14px;border-radius:14px;background:rgba(87,227,154,.08);border:1px solid rgba(87,227,154,.18);color:#91e9b8;font-size:13px;font-weight:900}
.logo-game-shell{display:grid;gap:12px}.logo-card{width:min(300px,78vw);aspect-ratio:1.18;margin:2px auto;padding:30px;border-radius:24px;background:#fff;border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;box-shadow:0 16px 44px rgba(0,0,0,.3)}.logo-card img{display:block;max-width:82%;max-height:82%;width:auto;height:auto;object-fit:contain;user-select:none;-webkit-user-drag:none}.logo-load-error{color:#8c2140;font-weight:950;text-align:center;line-height:1.3}.logo-guess-form{display:grid;grid-template-columns:1fr auto;gap:8px}.logo-guess-input{min-width:0;height:50px;border-radius:14px;border:1px solid var(--line);background:#171020;color:var(--text);padding:0 14px;font-size:16px;font-weight:850;outline:none}.logo-guess-input:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(184,255,74,.09)}.logo-submit{min-width:92px}.logo-progress{text-align:center;color:var(--muted);font-size:12px;font-weight:850}.logo-solved{padding:14px;border-radius:14px;background:rgba(87,227,154,.08);border:1px solid rgba(87,227,154,.18);color:#91e9b8;font-size:13px;font-weight:950;text-align:center}.logo-skip{margin-top:0!important;font-size:12px!important}
@media(max-width:380px){.logo-card{padding:24px}.logo-guess-form{grid-template-columns:1fr}.logo-submit{width:100%}}
</style>`, 'v5.1 Minigame-Styles');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
function silentUnlockGameAudio(){
  if(typeof prepareLobbyAudio==='function')prepareLobbyAudio();
  if(songAudioUnlocked||!ytPlayer||!ytPlayerReady)return;
  try{
    if(persistentSongVideoId!==AUDIO_WARMUP.videoId){ytPlayer.cueVideoById({videoId:AUDIO_WARMUP.videoId,startSeconds:0});persistentSongVideoId=AUDIO_WARMUP.videoId;}
    if(ytPlayer.unMute)ytPlayer.unMute();if(ytPlayer.setVolume)ytPlayer.setVolume(1);if(ytPlayer.seekTo)ytPlayer.seekTo(0,true);if(ytPlayer.playVideo)ytPlayer.playVideo();songAudioUnlocked=true;
    setTimeout(function(){try{if(ytPlayer&&ytPlayer.pauseVideo)ytPlayer.pauseVideo();if(ytPlayer&&ytPlayer.setVolume)ytPlayer.setVolume(100);}catch(e){}},180);
  }catch(e){}
}
var v51BindLanding=bindLanding;
bindLanding=function(){
  v51BindLanding();
  try{prepareLobbyAudio();}catch(e){}
  var c=document.getElementById('create'),j=document.getElementById('join');
  function hook(b){if(!b)return;var old=b.onclick;b.onpointerdown=function(){silentUnlockGameAudio();};b.onclick=function(e){silentUnlockGameAudio();return old&&old.call(this,e);};}
  hook(c);hook(j);
};

function blindTimerMiniHtml(cur){
  var target=Math.max(2,Math.round(Number(cur.timerTargetMs||3000)/1000));
  var finished=Number(cur.timerFinished||0),total=Number(cur.timerTotal||0);
  var out='<div class="mini-shell blind-timer-shell"><div class="mini-banner"><div class="mini-title">⏱️ Zeitgefühl</div><div class="mini-sub">Starte den Timer selbst und stoppe möglichst genau. Während er läuft siehst du keine Zeit.</div></div><div class="blind-timer-target"><span>Zielzeit</span><strong>'+target+' Sekunden</strong></div>';
  if(cur.timerDone){
    out+='<div class="blind-timer-face"><span>✓</span></div><div class="blind-timer-done">Zeit gespeichert · Ergebnis bleibt bis zur Auswertung geheim.<br>'+finished+' / '+total+' fertig</div>';
  }else if(cur.timerStarted){
    out+='<div class="blind-timer-face running"><span>?</span></div><div class="blind-timer-hint">Der Timer läuft. Zähle im Kopf und stoppe bei '+target+' Sekunden.</div><button type="button" id="blindTimerAction" class="btn blind-timer-stop" data-action="stop">STOPP</button>';
  }else{
    out+='<div class="blind-timer-face"><span>?</span></div><div class="blind-timer-hint">Keine Uhr, kein Balken, kein Countdown. Nur dein Zeitgefühl zählt.</div><button type="button" id="blindTimerAction" class="btn primary" data-action="start">START</button>';
  }
  return out+'</div>';
}
function setupBlindTimer(){
  var cur=state&&state.current,button=document.getElementById('blindTimerAction');
  if(!cur||cur.type!=='minigame'||cur.miniType!=='zeitgefuehl'||!button)return;
  button.onclick=function(){var action=button.getAttribute('data-action');button.disabled=true;button.textContent=action==='start'?'LÄUFT …':'GESPEICHERT …';send({t:action==='start'?'miniTimerStart':'miniTimerStop'});};
}

function logoMiniHtml(cur){
  var solved=!!cur.logoSolved,done=Number(cur.logoSolvedCount||0),total=Number(cur.logoTotal||0),host=state&&state.you===state.hostId;
  var out='<div class="mini-shell logo-game-shell"><div class="mini-banner"><div class="mini-title">🧩 Erkenne das Logo</div><div class="mini-sub">Nur das Zeichen zählt – der Markenname ist im Bild nicht eingeblendet. Tippe die Marke ein.</div></div>';
  out+='<div class="logo-card"><img id="logoGameImage" src="'+esc(cur.logoImage||'')+'" alt="Logo" draggable="false"><div id="logoLoadError" class="logo-load-error" hidden>Logo konnte nicht geladen werden.</div></div>';
  if(solved)out+='<div class="logo-solved">Richtig erkannt ✓<br>Warte auf die anderen.</div>';
  else out+='<form id="logoGuessForm" class="logo-guess-form"><input id="logoGuessInput" class="logo-guess-input" maxlength="64" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Welche Marke ist das?"><button class="btn primary logo-submit" type="submit">Raten</button></form>';
  out+='<div class="logo-progress">'+done+' / '+total+' erkannt</div>';
  if(host)out+='<button type="button" id="logoBroken" class="btn ghost logo-skip">Logo lädt nicht · Runde überspringen</button>';
  return out+'</div>';
}
function setupLogoGame(){
  var cur=state&&state.current;if(!cur||cur.type!=='minigame'||cur.miniType!=='logo')return;
  var img=document.getElementById('logoGameImage'),err=document.getElementById('logoLoadError');
  if(img)img.onerror=function(){img.style.display='none';if(err)err.hidden=false;};
  var form=document.getElementById('logoGuessForm'),input=document.getElementById('logoGuessInput');
  if(form&&input){form.onsubmit=function(e){e.preventDefault();var v=String(input.value||'').trim();if(!v)return;send({t:'miniLogoGuess',v:v});input.value='';setTimeout(function(){try{input.focus();}catch(x){}},20);};setTimeout(function(){try{input.focus();}catch(e){}},80);}
  var broken=document.getElementById('logoBroken');if(broken)broken.onclick=function(){broken.disabled=true;send({t:'miniLogoBroken'});};
}

// Die beiden v5.1-Minispiele direkt in die Minigame-Ansicht hängen, damit keine
// generische Textkarte statt der eigentlichen Interaktion erscheint.
var v51QuestionBody=questionBody;
questionBody=function(cur){if(cur&&cur.type==='minigame'&&cur.miniType==='zeitgefuehl')return blindTimerMiniHtml(cur);if(cur&&cur.type==='minigame'&&cur.miniType==='logo')return logoMiniHtml(cur);return v51QuestionBody(cur);};
var v51MiniBody=miniBody;
miniBody=function(cur){if(cur&&cur.miniType==='zeitgefuehl')return blindTimerMiniHtml(cur);if(cur&&cur.miniType==='logo')return logoMiniHtml(cur);return v51MiniBody(cur);};
var v51Bind=bind;
bind=function(){v51Bind();setupBlindTimer();setupLogoGame();};
var v51CanPatch=canPatch;
canPatch=function(prev,next){if(next&&next.current&&next.current.type==='minigame'&&(next.current.miniType==='zeitgefuehl'||next.current.miniType==='logo'))return false;return v51CanPatch(prev,next);};
`;
  html = mustReplace(html, anchor, extension + '\n' + anchor, 'v5.1 Minigames + versteckte YouTube-Freigabe');
  return html;
};
