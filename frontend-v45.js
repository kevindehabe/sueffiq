'use strict';

module.exports = function hardenFrontend(html) {
  html = html.replace(
    '<meta name="theme-color" content="#0d0914">',
    '<meta name="theme-color" content="#0d0914"><meta name="application-name" content="SüffIQ"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="SüffIQ"><meta name="format-detection" content="telephone=no"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.svg">'
  );

  html = html.replace(
    '</style>',
    'button,.btn,.answer,.mini,.cat-toggle{touch-action:manipulation}body{overscroll-behavior-y:contain;-webkit-tap-highlight-color:transparent}.answer.selected,.scale button.selected,#unlockSong.selected{background:var(--accent)!important;color:#11170a!important;border-color:var(--accent)!important}.input.submitted{border-color:var(--accent);box-shadow:0 0 0 3px rgba(184,255,74,.08)}.presence{display:grid;gap:8px}.presence-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.025)}.presence-name{font-weight:850}.presence-state{font-size:11px;font-weight:900}.presence-state.online{color:var(--ok)}.presence-state.offline{color:var(--muted)}.presence-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:currentColor}</style>'
  );

  html = html.replace(
    '<input id="name" class="input" maxlength="18" placeholder="Dein Name">',
    '<input id="name" class="input" maxlength="18" autocomplete="nickname" autocapitalize="words" enterkeyhint="next" placeholder="Dein Name">'
  );
  html = html.replace(
    '<input id="code" class="input code" maxlength="5" placeholder="ABCDE">',
    '<input id="code" class="input code" maxlength="5" autocomplete="off" autocapitalize="characters" enterkeyhint="go" placeholder="ABCDE">'
  );
  html = html.replace(
    'id="guessInput" class="input" maxlength="64" autocomplete="off"',
    'id="guessInput" class="input" maxlength="64" autocomplete="off" autocapitalize="words" enterkeyhint="send"'
  );

  // Keep ordinary answer controls mounted during the same round. This preserves the iPhone keyboard
  // and text fields when another player submits an answer, instead of rebuilding the whole question DOM.
  html = html.replace(
    "var KEY='sueffiq-v4',ws=null,state=null,joined=null,feedback=null,retry=null,timerLoop=null;",
    "var KEY='sueffiq-v4',ws=null,state=null,joined=null,feedback=null,retry=null,timerLoop=null,pendingEntry=null,selectedChoice=null,selectedChoiceRound=0;"
  );
  html = html.replace(
    "function canPatch(prev,next){\n  return !!(prev&&next&&prev.phase==='question'&&next.phase==='question'&&prev.current&&next.current&&prev.round===next.round&&prev.current.type===next.current.type&&isGuessType(next.current.type)&&(!(next.current.yourStatus&&next.current.yourStatus.status==='correct'))&&(next.current.type==='song'?(next.current.isHost?document.getElementById('songHostPanel'):document.getElementById('guessForm')):document.getElementById('guessForm')));\n}",
    "function canPatch(prev,next){\n  return !!(prev&&next&&prev.phase==='question'&&next.phase==='question'&&prev.current&&next.current&&prev.round===next.round&&prev.current.type===next.current.type&&prev.hostId===next.hostId&&prev.current.target===next.current.target&&document.getElementById('answeredRow'));\n}"
  );
  html = html.replace(
    "      if(m.status!=='correct'&&updateFeedbackBox())return;\n      render();return;",
    "      if(updateFeedbackBox())return;\n      render();return;"
  );
  html = html.replace(
    "      if(prev&&m.s&&prev.round!==m.s.round)feedback=null;",
    "      if(prev&&m.s&&prev.round!==m.s.round){feedback=null;selectedChoice=null;selectedChoiceRound=0;songAudioUnlocked=false;lastSongSyncKey=null;}"
  );

  // A fast tap can happen before the WebSocket is OPEN, especially after a Render cold start.
  html = html.replace(
    "function send(o){if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));}",
    "function send(o){if(ws&&ws.readyState===1){ws.send(JSON.stringify(o));return true;}if(o&&(o.t==='create'||o.t==='join')){pendingEntry=o;connection.className='connection show';connection.textContent='Verbindung wird hergestellt …';}return false;}"
  );
  html = html.replace(
    "  ws.onopen=function(){connection.className='connection';if(joined)send({t:'rejoin',code:joined.code,id:joined.id});};",
    "  ws.onopen=function(){connection.className='connection';connection.textContent='Verbindung wird wiederhergestellt …';if(pendingEntry){var entry=pendingEntry;pendingEntry=null;send(entry);}else if(joined)send({t:'rejoin',code:joined.code,id:joined.id});};"
  );
  html = html.replace(
    "    if(m.t==='joined'){saveJoin({code:m.code,id:m.id});return;}",
    "    if(m.t==='joined'){pendingEntry=null;saveJoin({code:m.code,id:m.id});return;}"
  );
  html = html.replace(
    "    if(m.t==='reset'){cleanupYouTube();clearJoin();state=null;feedback=null;render();return;}",
    "    if(m.t==='reset'){pendingEntry=null;cleanupYouTube();clearJoin();state=null;feedback=null;selectedChoice=null;selectedChoiceRound=0;render();return;}"
  );

  // Remove the undocumented YT.Player host option. It can break player creation on mobile browsers.
  html = html.replace(",host:'https://www.youtube-nocookie.com'", '');

  // Safari/iOS requires a user gesture before audible media may be controlled later by a remote event.
  // Every guest can prime the already hidden player once; the host's Play tap primes the host automatically.
  html = html.replace(
    'var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false,pendingSync=null,syncTimer=null;',
    'var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false,pendingSync=null,syncTimer=null,lastSongSyncKey=null,songAudioUnlocked=false;'
  );
  html = html.replace(
    'Sobald der Host auf Play drückt, startet der Song auch auf diesem Gerät.</div><div class="yt-stealth"',
    'Tippe einmal auf <b>Ton aktivieren</b>. Danach startet nur noch der Host den Song für alle gleichzeitig.</div><button id="unlockSong" class="btn secondary" disabled>🔊 Ton wird geladen …</button><div style="height:10px"></div><div class="yt-stealth"'
  );
  html = html.replace(
    '<button id="songPlay" class="btn primary song-play">▶ Song starten</button>',
    '<button id="songPlay" class="btn primary song-play" disabled>▶ Song wird geladen …</button>'
  );
  html = html.replace(
    "onReady:function(){ytPlayerReady=true;try{ytPlayer.cueVideoById({videoId:cur.videoId,startSeconds:Number(cur.startSeconds||0)});}",
    "onReady:function(){ytPlayerReady=true;var pb=document.getElementById('songPlay');if(pb){pb.disabled=false;pb.textContent='▶ Song starten';}var ub=document.getElementById('unlockSong');if(ub){ub.disabled=false;ub.textContent=songAudioUnlocked?'✓ Ton aktiviert':'🔊 Ton aktivieren';}try{ytPlayer.cueVideoById({videoId:cur.videoId,startSeconds:Number(cur.startSeconds||0)});}"
  );
  html = html.replace(
    "function playSyncedSong(m){\n  var cur=state&&state.current;if(!cur||cur.type!=='song')return;\n  if(!ytPlayer||!ytPlayerReady){pendingSync=m;ensureYTApi(cur);return;}",
    "function playSyncedSong(m,force){\n  var cur=state&&state.current;if(!cur||cur.type!=='song')return;\n  var syncKey=String(state.round)+':'+String(Number(m.at||0));\n  if(lastSongSyncKey===syncKey&&!force)return;\n  if(!ytPlayer||!ytPlayerReady){pendingSync=m;ensureYTApi(cur);return;}\n  lastSongSyncKey=syncKey;"
  );
  html = html.replace(
    "function playSongButton(){var cur=state&&state.current;if(!cur||cur.type!=='song'||!cur.isHost)return;send({t:'songPlay'});}",
    "function unlockSongAudio(after){var cur=state&&state.current;if(!cur||cur.type!=='song')return false;if(!ytPlayer||!ytPlayerReady){toast('Song wird noch geladen …');ensureYTApi(cur);return false;}try{if(ytPlayer.unMute)ytPlayer.unMute();if(ytPlayer.setVolume)ytPlayer.setVolume(100);if(ytPlayer.playVideo)ytPlayer.playVideo();if(ytPlayer.pauseVideo)ytPlayer.pauseVideo();songAudioUnlocked=true;var ub=document.getElementById('unlockSong');if(ub){ub.classList.add('selected');ub.textContent='✓ Ton aktiviert';}if(cur.songStartedAt){lastSongSyncKey=null;playSyncedSong({at:cur.songStartedAt,videoId:cur.videoId,startSeconds:cur.startSeconds||0},true);}if(after)after();return true;}catch(e){toast('Ton konnte nicht aktiviert werden.');return false;}}\nfunction playSongButton(){var cur=state&&state.current;if(!cur||cur.type!=='song'||!cur.isHost)return;unlockSongAudio(function(){send({t:'songPlay'});});}"
  );
  html = html.replace(
    "  var play=document.getElementById('songPlay');if(play)play.onclick=playSongButton;\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};",
    "  var play=document.getElementById('songPlay');if(play){play.disabled=!ytPlayerReady;play.onclick=playSongButton;}\n  var unlock=document.getElementById('unlockSong');if(unlock){unlock.disabled=!ytPlayerReady;unlock.onclick=function(){unlockSongAudio();};if(songAudioUnlocked){unlock.classList.add('selected');unlock.textContent='✓ Ton aktiviert';}}\n  var broken=document.getElementById('songBroken');if(broken)broken.onclick=function(){send({t:'songBroken'});};"
  );
  html = html.replace(
    "  bind();if(songActive&&!ytPlayer)setTimeout(function(){if(state&&state.current&&state.current.type==='song')ensureYTApi(state.current);},0);tick();timerLoop=setInterval(tick,250);",
    "  bind();if(songActive){if(!ytPlayer)setTimeout(function(){if(state&&state.current&&state.current.type==='song')ensureYTApi(state.current);},0);if(state.current.songStartedAt)setTimeout(function(){if(state&&state.current&&state.current.type==='song')playSyncedSong({at:state.current.songStartedAt,videoId:state.current.videoId,startSeconds:state.current.startSeconds||0});},0);}tick();timerLoop=setInterval(tick,250);"
  );

  // Green local selection feedback. Because same-round state updates are patched in place, the mark stays visible.
  html = html.replace(
    "  for(i=0;i<a.length;i++)a[i].onclick=function(){send({t:'answer',v:this.getAttribute('data-v')});};",
    "  for(i=0;i<a.length;i++)a[i].onclick=function(){var v=this.getAttribute('data-v');selectedChoice=String(v);selectedChoiceRound=state?state.round:0;var all=document.querySelectorAll('[data-v]');for(var j=0;j<all.length;j++)all[j].classList.toggle('selected',all[j].getAttribute('data-v')===selectedChoice);send({t:'answer',v:v});};"
  );
  html = html.replace(
    "  f=document.getElementById('estimate');if(f)f.onsubmit=function(e){e.preventDefault();var v=document.getElementById('estimateInput').value.trim();if(v)send({t:'answer',v:v});};",
    "  f=document.getElementById('estimate');if(f)f.onsubmit=function(e){e.preventDefault();var input=document.getElementById('estimateInput'),v=input.value.trim();if(v){selectedChoice=v;selectedChoiceRound=state?state.round:0;input.classList.add('submitted');send({t:'answer',v:v});input.focus();}};"
  );

  // Show after every round who is still connected and who has closed/backgrounded the app long enough to disconnect.
  html = html.replace(
    'function resultsHtml(){',
    "function presenceHtml(){var out='<div class=\"presence\">',i,p;for(i=0;i<state.players.length;i++){p=state.players[i];out+='<div class=\"presence-row\"><span class=\"presence-name\">'+esc(p.name)+(p.id===state.hostId?' 👑':'')+'</span><span class=\"presence-state '+(p.connected?'online':'offline')+'\"><span class=\"presence-dot\"></span>'+(p.connected?'noch dabei':'verbindung weg')+'</span></div>';}return out+'</div>';}\nfunction resultsHtml(){"
  );
  html = html.replace(
    "out+='</div><div class=\"section\">Zwischenstand</div>'+scoreboardHtml()+'<div style=\"height:12px\"></div>'",
    "out+='</div><div class=\"section\">Zwischenstand</div>'+scoreboardHtml()+'<div class=\"section\">Noch dabei?</div>'+presenceHtml()+'<div style=\"height:12px\"></div>'"
  );

  // Game Over is also a useful pre-game lobby for the next match: change categories without creating a new code.
  const oldEnd = "function endHtml(){var host=state.you===state.hostId;return topHtml()+'<div class=\"hero\"><div class=\"eyebrow\">Feierabend</div><h1 style=\"font-size:52px\">Game <span>Over</span></h1><p class=\"subtitle\">Gewonnen hat offiziell niemand. Einer hat nur weniger getrunken.</p></div>'+scoreboardHtml()+'<div style=\"height:12px\"></div>'+(host?'<button id=\"restart\" class=\"btn primary\">Nochmal</button>':'');}";
  const newEnd = "function endHtml(){var host=state.you===state.hostId;var actions=host?'<button id=\"restart\" class=\"btn primary\">Nochmal mit dieser Auswahl</button>':'<div class=\"waiting\">Der Host startet das nächste Spiel.</div>';return topHtml()+'<div class=\"hero\"><div class=\"eyebrow\">Feierabend</div><h1 style=\"font-size:52px\">Game <span>Over</span></h1><p class=\"subtitle\">Gewonnen hat offiziell niemand. Einer hat nur weniger getrunken.</p></div>'+scoreboardHtml()+'<div class=\"section\">Noch dabei?</div>'+presenceHtml()+'<div class=\"section\">Kategorien fürs nächste Spiel</div>'+categoryPickerHtml()+'<div style=\"height:12px\"></div>'+actions+'<div style=\"height:9px\"></div><button id=\"leaveLobby\" class=\"btn ghost\">Lobby verlassen</button>'; }";
  if (html.includes(oldEnd)) html = html.replace(oldEnd, newEnd);

  html = html.replace(
    '</body>',
    '<script>if(\'serviceWorker\' in navigator){window.addEventListener(\'load\',function(){navigator.serviceWorker.register(\'/sw.js\').catch(function(){});});}</script></body>'
  );

  return html;
};
