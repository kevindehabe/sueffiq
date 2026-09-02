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

function applyITunes(html) {
  const tuneITunes = require('./frontend-itunes-v481');
  return tuneITunes(html);
}

module.exports = function tunePartyV49(html) {
  html = applyStableDrawChain(html);
  html = applyITunes(html);

  html = replaceOnce(html, '</style>', `
/* Portrait-safe image guessing: never crop heads/faces out of the source image. */
.photo-wrap{aspect-ratio:3/4!important;display:grid!important;place-items:center!important;background:#09060e!important;max-height:min(64vh,620px)!important}
.photo{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center center!important;transform:none!important;background:#09060e!important}
.blur0,.blur1,.blur2,.blur3,.blur4{transform:none!important}

/* The SüffIQ logo is the universal home button. */
.brand{cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
.brand:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:12px}

/* Persistent game rules live outside #app so rerenders never move them. */
.party-rule-dock{position:fixed;top:0;left:0;right:0;z-index:10050;padding:calc(env(safe-area-inset-top,0px) + 6px) 8px 7px;background:rgba(12,8,17,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.11);box-shadow:0 7px 24px rgba(0,0,0,.25)}
.party-rule-row{display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.party-rule-row::-webkit-scrollbar{display:none}
.party-rule-title{flex:0 0 auto;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.party-rule-chip{flex:0 0 auto;max-width:78vw;padding:7px 9px;border-radius:999px;background:#20172a;border:1px solid rgba(184,255,74,.18);font-size:10px;font-weight:850;white-space:nowrap;color:var(--text)}
.party-rule-ended{position:fixed;left:10px;right:10px;z-index:10070;padding:11px 12px;border-radius:14px;background:rgba(63,18,24,.97);border:1px solid rgba(255,95,108,.48);box-shadow:0 10px 30px rgba(0,0,0,.38);font-size:11px;font-weight:850;line-height:1.35;color:#ffd9dc;transform:translateY(-8px);opacity:0;transition:opacity .18s ease,transform .18s ease;pointer-events:none}.party-rule-ended.show{opacity:1;transform:translateY(0)}.party-rule-ended b{display:block;margin-bottom:3px;color:#ff7884;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
@media(max-width:430px){.photo-wrap{aspect-ratio:3/4!important;max-height:58vh!important}.party-rule-chip{font-size:9.5px}.party-rule-ended{font-size:10px}}
</style>`, 'Regeln/Bild/Home-CSS');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
var PARTY_RULES=[
  'Ja und Nein sind verboten. Erwischt? 1 Schluck.',
  'Glas nur mit links. Rechte Hand am Getränk = 1 Schluck.',
  'Vornamen sind tabu. Nennt euch Chef, Legende oder Problemfall.',
  'Der Roundmaster heißt ab jetzt nur noch Eure Hoheit.',
  'Wer Digga sagt, nimmt 1 Schluck. Viel Erfolg.',
  'Fragen sind verboten. Wer eine stellt, beantwortet sie mit 1 Schluck.',
  'Das Wort ich ist verboten. Ego-Pause.',
  'Vor jedem Schluck muss Auf die Wissenschaft gesagt werden.',
  'Mit dem Finger auf jemanden zeigen = selber 1 Schluck.',
  'Wer außerhalb von SüffIQ am Handy hängt, nimmt 1 Schluck.',
  'Beim Anstoßen kein Blickkontakt? 1 Schluck wegen Respektlosigkeit.',
  'Wer über jemanden lacht, der trinken muss, trinkt solidarisch mit.',
  'Das Wort trinken ist verboten. Umschreibungen ausdrücklich erwünscht.',
  'Jeder Satz muss mit Bro oder Bruder enden. Vergessen = 1 Schluck.',
  'Wer flucht, nimmt 1 Schluck. Ja, auch scheiße zählt.',
  'Wer eine aktive Regel erklärt, nimmt für die unnötige Pressekonferenz 1 Schluck.'
];
var PARTY_RULE_MAX_ROUNDS=10;
var PARTY_RULE_CHANCE=28;
var partyRuleLastRound=0,partyRuleLastRules=[],partyRuleEndTimer=null;
function partyHash(text){var h=2166136261>>>0,s=String(text||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function partyRuleStarts(code,round){
  return (partyHash(String(code)+'|regel-start|'+round)%100)<PARTY_RULE_CHANCE;
}
function partyRuleIndex(code,start,used){var idx=partyHash(String(code)+'|regel|'+start)%PARTY_RULES.length;for(var n=0;n<PARTY_RULES.length;n++){var j=(idx+n)%PARTY_RULES.length;if(used.indexOf(j)<0)return j;}return idx;}
function activePartyRules(s){
  var r=Number(s&&s.round||0);if(r<1)return[];
  var first=Math.max(1,r-PARTY_RULE_MAX_ROUNDS+1),starts=[];
  for(var x=first;x<=r;x++)if(partyRuleStarts(s.code,x))starts.push(x);
  var used=[],out=[];for(var i=0;i<starts.length;i++){var idx=partyRuleIndex(s.code,starts[i],used);used.push(idx);out.push(PARTY_RULES[idx]);}
  return out.slice(-2);
}
function ensurePartyRuleDock(){var d=document.getElementById('partyRuleDock');if(d)return d;d=document.createElement('div');d.id='partyRuleDock';d.className='party-rule-dock';d.setAttribute('aria-live','polite');document.body.appendChild(d);return d;}
function showPartyRuleEnded(rules){
  if(!rules||!rules.length)return;
  var n=document.getElementById('partyRuleEnded');if(!n){n=document.createElement('div');n.id='partyRuleEnded';n.className='party-rule-ended';n.setAttribute('role','status');document.body.appendChild(n);}
  var text=rules.length===1?rules[0]:rules.join(' · ');n.innerHTML='<b>🚫 Regel aufgehoben</b>'+esc(text)+' – zählt ab jetzt nicht mehr.';
  var dock=document.getElementById('partyRuleDock');if(dock&&dock.style.display!=='none')n.style.top=(Math.ceil(dock.getBoundingClientRect().height)+8)+'px';else n.style.top='calc(env(safe-area-inset-top,0px) + 10px)';
  n.classList.add('show');clearTimeout(partyRuleEndTimer);partyRuleEndTimer=setTimeout(function(){n.classList.remove('show');},5200);
}
function partyGoHome(){
  try{if(state&&joined)send({t:'leave'});}catch(e){}
  try{if(typeof cleanupYouTube==='function')cleanupYouTube();}catch(e){}
  try{clearJoin();}catch(e){joined=null;try{localStorage.removeItem(KEY);}catch(ignore){}}
  state=null;feedback=null;
  try{history.replaceState(null,'',location.pathname);}catch(e){}
  render();
}
function bindPartyHome(){
  var b=document.querySelector('.brand');if(!b)return;
  b.setAttribute('role','button');b.setAttribute('tabindex','0');b.setAttribute('aria-label','Zur Startseite');
  b.onclick=partyGoHome;
  b.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();partyGoHome();}};
}
function updatePartyRuleDock(){
  var s=state,d=document.getElementById('partyRuleDock');
  if(!s||!joined||s.phase==='lobby'||s.phase==='end'||Number(s.round||0)<1){if(d)d.style.display='none';document.body.style.paddingTop='';partyRuleLastRound=Number(s&&s.round||0);partyRuleLastRules=[];bindPartyHome();return;}
  var round=Number(s.round||0),rules=activePartyRules(s),ended=[];
  if(partyRuleLastRound>0&&round!==partyRuleLastRound){for(var e=0;e<partyRuleLastRules.length;e++)if(rules.indexOf(partyRuleLastRules[e])<0)ended.push(partyRuleLastRules[e]);}
  partyRuleLastRound=round;partyRuleLastRules=rules.slice();
  if(!rules.length){if(d)d.style.display='none';document.body.style.paddingTop='';if(ended.length)showPartyRuleEnded(ended);bindPartyHome();return;}
  d=ensurePartyRuleDock();var out='<div class="party-rule-row"><span class="party-rule-title">📌 Regeln</span>';
  for(var i=0;i<rules.length;i++)out+='<span class="party-rule-chip">'+esc(rules[i])+'</span>';
  out+='</div>';d.innerHTML=out;d.style.display='block';
  requestAnimationFrame(function(){document.body.style.paddingTop=Math.ceil(d.getBoundingClientRect().height)+'px';if(ended.length)showPartyRuleEnded(ended);});
  bindPartyHome();
}
var partyV49Render=render;
render=function(){partyV49Render();updatePartyRuleDock();};
window.addEventListener('resize',function(){if(document.getElementById('partyRuleDock'))updatePartyRuleDock();});
`;
  html = replaceOnce(html, anchor, extension + '\n' + anchor, 'Zufällige-Regeln/Home-Runtime');
  return html;
};
