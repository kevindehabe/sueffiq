'use strict';

module.exports = function hardenFrontend(html) {
  html = html.replace(
    '<meta name="theme-color" content="#0d0914">',
    '<meta name="theme-color" content="#0d0914"><meta name="application-name" content="SüffIQ"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="SüffIQ"><meta name="format-detection" content="telephone=no"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.svg">'
  );

  html = html.replace(
    '</style>',
    'button,.btn,.answer,.mini,.cat-toggle{touch-action:manipulation}body{overscroll-behavior-y:contain;-webkit-tap-highlight-color:transparent}</style>'
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

  // Let late reconnects learn the canonical song timestamp and join the already running song.
  html = html.replace(
    'var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false,pendingSync=null,syncTimer=null;',
    'var ytPlayer=null,ytApiReady=!!(window.YT&&window.YT.Player),ytPlayerReady=false,pendingSong=null,ytScriptLoading=false,pendingSync=null,syncTimer=null,lastSongSyncKey=null;'
  );
  html = html.replace(
    "function playSyncedSong(m){\n  var cur=state&&state.current;if(!cur||cur.type!=='song')return;\n  if(!ytPlayer||!ytPlayerReady){pendingSync=m;ensureYTApi(cur);return;}",
    "function playSyncedSong(m){\n  var cur=state&&state.current;if(!cur||cur.type!=='song')return;\n  var syncKey=String(state.round)+':'+String(Number(m.at||0));\n  if(lastSongSyncKey===syncKey)return;\n  if(!ytPlayer||!ytPlayerReady){pendingSync=m;ensureYTApi(cur);return;}\n  lastSongSyncKey=syncKey;"
  );
  html = html.replace(
    "  bind();if(songActive&&!ytPlayer)setTimeout(function(){if(state&&state.current&&state.current.type==='song')ensureYTApi(state.current);},0);tick();timerLoop=setInterval(tick,250);",
    "  bind();if(songActive){if(!ytPlayer)setTimeout(function(){if(state&&state.current&&state.current.type==='song')ensureYTApi(state.current);},0);if(state.current.songStartedAt)setTimeout(function(){if(state&&state.current&&state.current.type==='song')playSyncedSong({at:state.current.songStartedAt,videoId:state.current.videoId,startSeconds:state.current.startSeconds||0});},0);}tick();timerLoop=setInterval(tick,250);"
  );

  // Game Over is also a useful pre-game lobby for the next match: change categories without creating a new code.
  const oldEnd = "function endHtml(){var host=state.you===state.hostId;return topHtml()+'<div class=\"hero\"><div class=\"eyebrow\">Feierabend</div><h1 style=\"font-size:52px\">Game <span>Over</span></h1><p class=\"subtitle\">Gewonnen hat offiziell niemand. Einer hat nur weniger getrunken.</p></div>'+scoreboardHtml()+'<div style=\"height:12px\"></div>'+(host?'<button id=\"restart\" class=\"btn primary\">Nochmal</button>':'');}";
  const newEnd = "function endHtml(){var host=state.you===state.hostId;var actions=host?'<button id=\"restart\" class=\"btn primary\">Nochmal mit dieser Auswahl</button>':'<div class=\"waiting\">Der Host startet das nächste Spiel.</div>';return topHtml()+'<div class=\"hero\"><div class=\"eyebrow\">Feierabend</div><h1 style=\"font-size:52px\">Game <span>Over</span></h1><p class=\"subtitle\">Gewonnen hat offiziell niemand. Einer hat nur weniger getrunken.</p></div>'+scoreboardHtml()+'<div class=\"section\">Kategorien fürs nächste Spiel</div>'+categoryPickerHtml()+'<div style=\"height:12px\"></div>'+actions+'<div style=\"height:9px\"></div><button id=\"leaveLobby\" class=\"btn ghost\">Lobby verlassen</button>';}";
  if (html.includes(oldEnd)) html = html.replace(oldEnd, newEnd);

  html = html.replace(
    '</body>',
    '<script>if(\'serviceWorker\' in navigator){window.addEventListener(\'load\',function(){navigator.serviceWorker.register(\'/sw.js\').catch(function(){});});}</script></body>'
  );

  return html;
};
