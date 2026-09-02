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
.party-rule-round-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0 10px}.party-rule-round-head .chip:first-child{color:var(--accent);border-color:rgba(184,255,74,.28)}
.party-rule-round-card{overflow:hidden;text-align:center;border-color:rgba(184,255,74,.24);background:radial-gradient(circle at 50% 0,rgba(184,255,74,.12),transparent 52%),var(--panel)}
.party-rule-round-icon{font-size:48px;line-height:1;margin:4px 0 10px}.party-rule-round-label{color:var(--accent);font-size:11px;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}.party-rule-round-card h2{margin:8px 0 7px;font-size:25px}.party-rule-round-text{margin:14px 0 18px;padding:18px 14px;border-radius:16px;background:#16101e;border:1px solid rgba(255,255,255,.09);font-size:19px;font-weight:950;line-height:1.35;color:var(--text)}
.party-rule-progress{margin:4px 0 12px;color:var(--muted);font-size:12px;font-weight:850}.party-rule-seen-list{display:grid;gap:7px;margin:0 0 14px;text-align:left}.party-rule-seen-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:12px;background:rgba(255,255,255,.035);font-size:12px;font-weight:850}.party-rule-seen-state{color:var(--muted)}.party-rule-seen-row.seen .party-rule-seen-state{color:var(--accent)}
.party-rule-wait{padding:12px;border-radius:13px;background:rgba(143,92,255,.08);color:var(--muted);font-size:12px;font-weight:850;line-height:1.4}.party-rule-ready{color:var(--accent)}
@media(max-width:430px){.photo-wrap{aspect-ratio:3/4!important;max-height:58vh!important}.party-rule-chip{font-size:9.5px}.party-rule-ended{font-size:10px}.party-rule-round-text{font-size:17px;padding:16px 12px}}
</style>`, 'Regeln/Bild/Home-CSS');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
var partyRuleLastRules=[],partyRuleEndTimer=null,partyRulesInitialized=false;
function activePartyRules(s){return s&&Array.isArray(s.activeRules)?s.activeRules.slice(-2):[];}
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
function partyRuleRoundHtml(){
  var r=state&&state.ruleRound;if(!r)return topHtml()+'<div class="card waiting">Regelrunde wird vorbereitet …</div>';
  var out=topHtml()+'<div class="party-rule-round-head"><span class="chip">📌 Eigene Regelrunde</span><span class="chip">vor Runde <strong>'+Number(r.startRound||state.round+1)+'</strong></span></div>';
  out+='<div class="card party-rule-round-card"><div class="party-rule-round-icon">📜</div><div class="party-rule-round-label">Neue Regel</div><h2>Alle einmal lesen</h2><div class="party-rule-round-text">'+esc(r.text||'')+'</div>';
  out+='<div class="party-rule-progress">'+Number(r.seenCount||0)+' / '+Number(r.total||0)+' haben die Regel gesehen</div><div class="party-rule-seen-list">';
  var players=Array.isArray(r.players)?r.players:[];for(var i=0;i<players.length;i++){var p=players[i];out+='<div class="party-rule-seen-row '+(p.seen?'seen':'')+'"><span>'+esc(p.name||'Spieler')+(p.id===state.hostId?' 👑':'')+'</span><span class="party-rule-seen-state">'+(p.seen?'✓ gesehen':'noch offen')+'</span></div>';}
  out+='</div>';
  if(!r.youSeen)out+='<button id="partyRuleSeen" class="btn primary">✓ Regel gesehen</button>';
  else if(r.isHost&&r.allSeen)out+='<button id="partyRuleContinue" class="btn primary">Weiter zur Runde</button><div class="party-rule-wait party-rule-ready" style="margin-top:9px">Alle sind bereit. Mit Weiter wird die Regel oben angepinnt.</div>';
  else if(r.isHost)out+='<div class="party-rule-wait">Du hast bestätigt. Warte noch, bis alle anderen die Regel gesehen haben.</div>';
  else out+='<div class="party-rule-wait">Bestätigt ✓ Der Host startet gleich die normale Runde.</div>';
  return out+'</div>';
}
function bindPartyRuleRound(){
  var seen=document.getElementById('partyRuleSeen');if(seen)seen.onclick=function(){seen.disabled=true;seen.textContent='Wird bestätigt …';send({t:'ruleSeen'});};
  var next=document.getElementById('partyRuleContinue');if(next)next.onclick=function(){next.disabled=true;next.textContent='Runde wird gestartet …';send({t:'ruleContinue'});};
}
function renderPartyRuleRound(){clearInterval(timerLoop);root.innerHTML=partyRuleRoundHtml();bindPartyRuleRound();bindPartyHome();}
function updatePartyRuleDock(){
  var s=state,d=document.getElementById('partyRuleDock');
  if(!s||!joined||s.phase==='lobby'||s.phase==='end'){if(d)d.style.display='none';document.body.style.paddingTop='';partyRuleLastRules=[];partyRulesInitialized=false;bindPartyHome();return;}
  var rules=activePartyRules(s),ended=[];
  if(partyRulesInitialized){for(var e=0;e<partyRuleLastRules.length;e++){var stillActive=false;for(var a=0;a<rules.length;a++)if(rules[a].id===partyRuleLastRules[e].id)stillActive=true;if(!stillActive)ended.push(partyRuleLastRules[e].text);}}
  partyRuleLastRules=rules.slice();partyRulesInitialized=true;
  if(!rules.length){if(d)d.style.display='none';document.body.style.paddingTop='';if(ended.length)showPartyRuleEnded(ended);bindPartyHome();return;}
  d=ensurePartyRuleDock();var out='<div class="party-rule-row"><span class="party-rule-title">📌 Regeln</span>';
  for(var i=0;i<rules.length;i++)out+='<span class="party-rule-chip">'+esc(rules[i].text||'')+'</span>';
  out+='</div>';d.innerHTML=out;d.style.display='block';
  requestAnimationFrame(function(){document.body.style.paddingTop=Math.ceil(d.getBoundingClientRect().height)+'px';if(ended.length)showPartyRuleEnded(ended);});
  bindPartyHome();
}
var partyV49Render=render;
render=function(){if(state&&state.phase==='rule'){renderPartyRuleRound();updatePartyRuleDock();return;}partyV49Render();updatePartyRuleDock();};
window.addEventListener('resize',function(){if(document.getElementById('partyRuleDock'))updatePartyRuleDock();});
`;
  html = replaceOnce(html, anchor, extension + '\n' + anchor, 'Zufällige-Regeln/Home-Runtime');
  return html;
};
