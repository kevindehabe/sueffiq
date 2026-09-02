'use strict';

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.9 Frontend-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

const baseTimer = "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
const tapTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
const drawTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
const combinedTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";

function applyStableDrawChain(html) {
  const miniPath = require.resolve('./frontend-minigames-v471');
  const drawPath = require.resolve('./frontend-draw-timing-v47');
  const tuneMinis = require(miniPath);
  html = tuneMinis(html);

  // The individual Tap Battle layer already changed timerHtml. Restore just this
  // one function so the drawing/rating layer can apply its own patch once.
  if (html.includes(tapTimer)) html = html.replace(tapTimer, baseTimer);

  const miniEntry = require.cache[miniPath];
  const previousMiniExport = miniEntry.exports;
  try {
    miniEntry.exports = (value) => value;
    delete require.cache[drawPath];
    const tuneDraw = require(drawPath);
    html = tuneDraw(html);
  } finally {
    miniEntry.exports = previousMiniExport;
    delete require.cache[drawPath];
  }

  if (html.includes(drawTimer)) html = html.replace(drawTimer, combinedTimer);
  else if (!html.includes(combinedTimer)) throw new Error('v4.9 Frontend-Patch fehlt: kombinierter Minigame-Timer');
  return html;
}

function applyITunesWithoutReplayingBase(html) {
  const timerPath = require.resolve('./frontend-draw-timing-v472');
  const itunesPath = require.resolve('./frontend-itunes-v48');
  require(timerPath);
  const timerEntry = require.cache[timerPath];
  const previousTimerExport = timerEntry.exports;
  try {
    timerEntry.exports = (value) => value;
    delete require.cache[itunesPath];
    const tuneITunes = require(itunesPath);
    return tuneITunes(html);
  } finally {
    timerEntry.exports = previousTimerExport;
    delete require.cache[itunesPath];
  }
}

module.exports = function tunePartyV49(html) {
  html = applyStableDrawChain(html);
  html = applyITunesWithoutReplayingBase(html);

  html = replaceOnce(html, '</style>', `
/* Portrait-safe image guessing: never crop heads/faces out of the source image. */
.photo-wrap{aspect-ratio:3/4!important;display:grid!important;place-items:center!important;background:#09060e!important;max-height:min(64vh,620px)!important}
.photo{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center center!important;transform:none!important;background:#09060e!important}
.blur0,.blur1,.blur2,.blur3,.blur4{transform:none!important}

/* Persistent game rules live outside #app so rerenders never move them. */
.party-rule-dock{position:fixed;top:0;left:0;right:0;z-index:10050;padding:calc(env(safe-area-inset-top,0px) + 6px) 8px 7px;background:rgba(12,8,17,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.11);box-shadow:0 7px 24px rgba(0,0,0,.25)}
.party-rule-row{display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.party-rule-row::-webkit-scrollbar{display:none}
.party-rule-title{flex:0 0 auto;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.party-rule-chip{flex:0 0 auto;max-width:78vw;padding:7px 9px;border-radius:999px;background:#20172a;border:1px solid rgba(184,255,74,.18);font-size:10px;font-weight:850;white-space:nowrap;color:var(--text)}
.party-event{margin-top:6px;padding:7px 9px;border-radius:11px;border:1px solid rgba(255,157,69,.24);background:rgba(255,157,69,.08);font-size:10px;font-weight:900;line-height:1.3;color:#ffd0a5}
@media(max-width:430px){.photo-wrap{aspect-ratio:3/4!important;max-height:58vh!important}.party-rule-chip{font-size:9.5px}.party-event{font-size:9.5px}}
</style>`, 'Regeln/Events/Bild-CSS');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
var PARTY_RULES=[
  'Vornamen verboten – wer einen sagt, nimmt 1 Schluck.',
  'Keine Fragen stellen – Fragezeichen im Satz = 1 Schluck.',
  'Getränk nur mit der linken Hand halten.',
  'Nicht fluchen – wer flucht, nimmt 1 Schluck.',
  '„Ja“ und „Nein“ sind verboten.',
  'Nicht mit dem Finger auf andere zeigen.',
  'Der Master wird nur noch „Eure Hoheit“ genannt.',
  'Das Wort „trinken“ ist verboten.',
  'Beim Anstoßen muss Blickkontakt gehalten werden.',
  'Wer sein Handy für etwas anderes als SüffIQ benutzt, nimmt 1 Schluck.',
  'Niemand darf „ich“ als erstes Wort eines Satzes benutzen.',
  'Wer eine aktive Regel erklären muss, nimmt selbst 1 Schluck.'
];
var PARTY_EVENTS=[
  'Alle nehmen 1 Schluck. Kurz, schmerzlos, weiter geht’s.',
  'Wasser-Event: Alle trinken jetzt einmal Wasser.',
  'Platztausch: Alle wechseln ihren Sitzplatz.',
  'Hände hoch! Die letzte Person mit beiden Händen oben nimmt 1 Schluck.',
  'Schere, Stein, Papier mit der Person links. Verlierer: 1 Schluck.',
  'Reimrunde: Der Master nennt ein Wort. Erster Patzer nimmt 1 Schluck.',
  'Freeze: Der Master darf einmal in dieser Runde „FREEZE“ rufen. Wer zuletzt stillhält, nimmt 1 Schluck.',
  'Cheers: Alle stoßen an. Wer den Einsatz verpasst, nimmt 1 Schluck.',
  'Stille Minute: Bis jemand antwortet, darf niemand den Namen eines Mitspielers sagen.',
  'Buddy-Event: Such dir für diese Runde einen Partner. Wenn einer eine Strafe bekommt, nimmt der andere maximal 1 mit.'
];
function partyHash(text){var h=2166136261>>>0,s=String(text||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function partyRuleIndex(code,start,used){var idx=partyHash(String(code)+'|regel|'+start)%PARTY_RULES.length;for(var n=0;n<PARTY_RULES.length;n++){var j=(idx+n)%PARTY_RULES.length;if(used.indexOf(j)<0)return j;}return idx;}
function activePartyRules(s){
  var r=Number(s&&s.round||0);if(r<1)return[];var starts=[],first=1;
  for(var x=first;x<=r;x+=3)if(r-x<=5)starts.push(x);
  var used=[],out=[];for(var i=0;i<starts.length;i++){var idx=partyRuleIndex(s.code,starts[i],used);used.push(idx);out.push(PARTY_RULES[idx]);}
  return out.slice(-2);
}
function currentPartyEvent(s){
  var r=Number(s&&s.round||0);if(r<3||((r-3)%4)!==0||s.phase!=='question')return'';
  return PARTY_EVENTS[partyHash(String(s.code)+'|event|'+r)%PARTY_EVENTS.length];
}
function ensurePartyRuleDock(){var d=document.getElementById('partyRuleDock');if(d)return d;d=document.createElement('div');d.id='partyRuleDock';d.className='party-rule-dock';d.setAttribute('aria-live','polite');document.body.appendChild(d);return d;}
function updatePartyRuleDock(){
  var s=state,d=document.getElementById('partyRuleDock');
  if(!s||!joined||s.phase==='lobby'||s.phase==='end'||Number(s.round||0)<1){if(d)d.style.display='none';document.body.style.paddingTop='';return;}
  d=ensurePartyRuleDock();var rules=activePartyRules(s),event=currentPartyEvent(s),out='<div class="party-rule-row"><span class="party-rule-title">📌 Regeln</span>';
  for(var i=0;i<rules.length;i++)out+='<span class="party-rule-chip">'+esc(rules[i])+'</span>';
  out+='</div>';if(event)out+='<div class="party-event">⚡ EVENT · '+esc(event)+'</div>';d.innerHTML=out;d.style.display='block';
  requestAnimationFrame(function(){document.body.style.paddingTop=Math.ceil(d.getBoundingClientRect().height)+'px';});
}
var partyV49Render=render;
render=function(){partyV49Render();updatePartyRuleDock();};
window.addEventListener('resize',function(){if(document.getElementById('partyRuleDock'))updatePartyRuleDock();});
`;
  html = replaceOnce(html, anchor, extension + '\n' + anchor, 'Regeln-und-Events-Runtime');
  return html;
};
