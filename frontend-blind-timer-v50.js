'use strict';

const tuneBase = require('./frontend-party-v49');

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Zeitgefühl-Frontend-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

module.exports = function tuneBlindTimerV50(html) {
  html = tuneBase(html);

  html = mustReplace(
    html,
    "keys=['zeichnen','allemalen','reaktion','taps','farbfolge','pong','blackjack']",
    "keys=['zeichnen','allemalen','reaktion','taps','farbfolge','zeitgefuehl','pong','blackjack']",
    'Minigame-Auswahl'
  );
  html = mustReplace(
    html,
    "if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';",
    "if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='zeitgefuehl')return '';",
    'globalen Timer ausblenden'
  );

  html = mustReplace(html, '</style>', `
.blind-timer-shell{display:grid;gap:13px;text-align:center}.blind-timer-target{display:grid;gap:2px;margin:2px auto 0;padding:12px 18px;border-radius:16px;background:rgba(184,255,74,.08);border:1px solid rgba(184,255,74,.22)}.blind-timer-target span{color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.blind-timer-target strong{color:var(--accent);font-size:31px;line-height:1.05}
.blind-timer-face{width:min(220px,58vw);aspect-ratio:1;margin:2px auto;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,rgba(143,92,255,.13),rgba(17,11,25,.96) 68%);border:2px solid rgba(143,92,255,.3);box-shadow:inset 0 0 0 9px rgba(255,255,255,.018),0 14px 40px rgba(0,0,0,.28)}.blind-timer-face span{font-size:52px;font-weight:1000;color:#d8caff}.blind-timer-face.running{border-color:rgba(184,255,74,.42);box-shadow:inset 0 0 0 9px rgba(184,255,74,.025),0 14px 40px rgba(0,0,0,.28)}.blind-timer-face.running span{color:var(--accent)}
.blind-timer-hint{min-height:34px;color:var(--muted);font-size:12px;font-weight:850;line-height:1.4}.blind-timer-stop{background:var(--danger);color:#fff}.blind-timer-done{padding:14px;border-radius:14px;background:rgba(87,227,154,.08);border:1px solid rgba(87,227,154,.18);color:#91e9b8;font-size:13px;font-weight:900}
</style>`, 'Zeitgefühl-Styles');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
function blindTimerMiniHtml(cur){
  var target=Math.max(2,Math.round(Number(cur.timerTargetMs||3000)/1000)),finished=Number(cur.timerFinished||0),total=Number(cur.timerTotal||0),out='<div class="mini-shell blind-timer-shell"><div class="mini-banner"><div class="mini-title">⏱️ Zeitgefühl</div><div class="mini-sub">Starte selbst und stoppe nach Gefühl. Die laufende Zeit bleibt komplett unsichtbar.</div></div><div class="blind-timer-target"><span>Zielzeit</span><strong>'+target+' Sekunden</strong></div>';
  if(cur.timerDone)out+='<div class="blind-timer-face"><span>✓</span></div><div class="blind-timer-done">Zeit gespeichert · Ergebnis bleibt bis zur Auswertung geheim.<br>'+finished+' / '+total+' fertig</div>';
  else if(cur.timerStarted)out+='<div class="blind-timer-face running"><span>?</span></div><div class="blind-timer-hint">Der Timer läuft. Zähle im Kopf und stoppe bei '+target+' Sekunden.</div><button id="blindTimerAction" class="btn blind-timer-stop" data-action="stop">STOPP</button>';
  else out+='<div class="blind-timer-face"><span>?</span></div><div class="blind-timer-hint">Keine Uhr, kein Balken, kein Countdown. Nur dein Zeitgefühl zählt.</div><button id="blindTimerAction" class="btn primary" data-action="start">START</button>';
  return out+'</div>';
}
function setupBlindTimer(){var cur=state&&state.current,button=document.getElementById('blindTimerAction');if(!cur||cur.miniType!=='zeitgefuehl'||!button)return;button.onclick=function(){var action=button.getAttribute('data-action');button.disabled=true;button.textContent=action==='start'?'LÄUFT …':'GESPEICHERT …';send({t:action==='start'?'miniTimerStart':'miniTimerStop'});};}

var blindTimerBaseMiniBody=miniBody;
miniBody=function(cur){if(cur&&cur.miniType==='zeitgefuehl')return blindTimerMiniHtml(cur);return blindTimerBaseMiniBody(cur);};
var blindTimerBaseBindMiniGame=bindMiniGame;
bindMiniGame=function(){blindTimerBaseBindMiniGame();var cur=state&&state.current;if(cur&&cur.type==='minigame'&&cur.miniType==='zeitgefuehl')setupBlindTimer();};
var blindTimerBaseCanPatch=canPatch;
canPatch=function(prev,next){if(next&&next.current&&next.current.type==='minigame'&&next.current.miniType==='zeitgefuehl')return false;return blindTimerBaseCanPatch(prev,next);};
`;
  html = mustReplace(html, anchor, extension + '\n' + anchor, 'Zeitgefühl-Runtime');
  return html;
};
