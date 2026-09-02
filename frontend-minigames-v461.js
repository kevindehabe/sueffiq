'use strict';

const tuneBase = require('./frontend-minigames-v46b');

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Tap-Frontend-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

module.exports = function tuneIndividualTapBattle(html) {
  html = tuneBase(html);

  html = mustReplace(
    html,
    'reactionSent=false,reactionOutcome=null,tapStarting=false,tapLocal=0',
    'reactionSent=false,reactionOutcome=null,tapStarting=false,tapUiTimer=null,tapLocal=0',
    'tap ui timer global'
  );
  html = mustReplace(
    html,
    'reactionSent=false;reactionOutcome=null;tapStarting=false;tapLocal=0;tapPending=0;if(tapFlushTimer){clearInterval(tapFlushTimer);tapFlushTimer=null;}',
    'reactionSent=false;reactionOutcome=null;tapStarting=false;if(tapUiTimer){clearInterval(tapUiTimer);tapUiTimer=null;}tapLocal=0;tapPending=0;if(tapFlushTimer){clearInterval(tapFlushTimer);tapFlushTimer=null;}',
    'tap ui timer reset'
  );

  html = mustReplace(
    html,
    'Der erste Tap startet für alle einen kurzen Countdown. Danach laufen exakt sieben Sekunden.',
    'Jeder startet seinen eigenen Countdown. Danach hast du exakt sieben Sekunden zum Tappen.',
    'tap intro'
  );

  // Keep the base round timer unchanged here. frontend-draw-timing-v472 combines
  // the Tap-Battle and Alle-malen timer rules in one place, avoiding patch-order conflicts.
  html = mustReplace(
    html,
    "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}",
    "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}",
    'defer global tap timer'
  );

  html = mustReplace(
    html,
    "function setupTapBattle(){var cur=state&&state.current,pad=document.getElementById('tapPad'),count=document.getElementById('tapCount'),label=document.getElementById('tapLabel');if(!isMiniRound(cur)||cur.miniType!=='taps'||!pad)return;if(count)count.textContent=String(tapLocal);if(cur.startAt&&cur.endAt){tapStarting=false;if(!tapFlushTimer)tapFlushTimer=setInterval(flushTaps,220);}function update(){var now=Date.now(),start=Number(cur.startAt||0),end=Number(cur.endAt||0);if(!start||!end){pad.disabled=!!tapStarting;pad.className='tap-pad';pad.textContent=tapStarting?'STARTET …':'STARTEN';if(label)label.textContent=tapStarting?'Countdown wird synchronisiert':'Erster Tap startet für alle';return;}if(now<start){pad.disabled=true;pad.className='tap-pad';pad.textContent=Math.max(1,Math.ceil((start-now)/1000));if(label)label.textContent='Bereit machen';return;}if(now>=end){flushTaps();pad.disabled=true;pad.className='tap-pad';pad.textContent='STOPP';if(label)label.textContent='Finger überlebt?';if(tapFlushTimer){clearInterval(tapFlushTimer);tapFlushTimer=null;}return;}pad.disabled=false;pad.className='tap-pad live';pad.textContent='TAPPEN!';if(label)label.textContent=Math.max(0,(end-now)/1000).toFixed(1)+' s';}update();var timer=setInterval(function(){if(!document.getElementById('tapPad')){clearInterval(timer);return;}update();},80);pad.onpointerdown=function(e){e.preventDefault();var now=Date.now(),start=Number(cur.startAt||0),end=Number(cur.endAt||0);if(!start||!end){if(!tapStarting){tapStarting=true;send({t:'miniTapStart'});update();}return;}if(now<start||now>=end)return;tapLocal++;tapPending++;if(count)count.textContent=String(tapLocal);};}",
    "function setupTapBattle(){var cur=state&&state.current,pad=document.getElementById('tapPad'),count=document.getElementById('tapCount'),label=document.getElementById('tapLabel');if(!isMiniRound(cur)||cur.miniType!=='taps'||!pad)return;if(count)count.textContent=String(tapLocal);if(tapUiTimer){clearInterval(tapUiTimer);tapUiTimer=null;}if(cur.startAt&&cur.endAt&&!cur.tapDone){tapStarting=false;if(!tapFlushTimer)tapFlushTimer=setInterval(flushTaps,220);}function update(){var now=Date.now(),start=Number(cur.startAt||0),end=Number(cur.endAt||0),done=!!cur.tapDone,finished=Number(cur.tapFinished||0),total=Number(cur.tapTotal||0);if(done){flushTaps();pad.disabled=true;pad.className='tap-pad';pad.textContent='FERTIG ✓';if(label)label.textContent='Warte auf die anderen · '+finished+'/'+total+' fertig';if(tapFlushTimer){clearInterval(tapFlushTimer);tapFlushTimer=null;}return;}if(!start||!end){pad.disabled=!!tapStarting;pad.className='tap-pad';pad.textContent=tapStarting?'STARTET …':'STARTEN';if(label)label.textContent=tapStarting?'Dein Countdown wird gestartet':'Starte, wenn du bereit bist';return;}if(now<start){pad.disabled=true;pad.className='tap-pad';pad.textContent=Math.max(1,Math.ceil((start-now)/1000));if(label)label.textContent='Dein Countdown';return;}if(now>=end){flushTaps();pad.disabled=true;pad.className='tap-pad';pad.textContent='FERTIG';if(label)label.textContent='Ergebnis wird gespeichert …';if(tapFlushTimer){clearInterval(tapFlushTimer);tapFlushTimer=null;}return;}pad.disabled=false;pad.className='tap-pad live';pad.textContent='TAPPEN!';if(label)label.textContent=Math.max(0,(end-now)/1000).toFixed(1)+' s';}update();tapUiTimer=setInterval(function(){if(!document.getElementById('tapPad')){clearInterval(tapUiTimer);tapUiTimer=null;return;}update();},60);pad.onpointerdown=function(e){e.preventDefault();var now=Date.now(),start=Number(cur.startAt||0),end=Number(cur.endAt||0);if(cur.tapDone)return;if(!start||!end){if(!tapStarting){tapStarting=true;send({t:'miniTapStart'});update();}return;}if(now<start||now>=end)return;tapLocal++;tapPending++;if(count)count.textContent=String(tapLocal);};}",
    'individual tap setup'
  );

  html = mustReplace(
    html,
    "function patchRound(cur){\n  var e;",
    "function patchRound(cur){\n  var e;\n  if(cur.type==='minigame'&&cur.miniType==='taps')setupTapBattle();",
    'refresh personal tap state'
  );

  return html;
};
