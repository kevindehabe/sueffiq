'use strict';

const tuneBase = require('./frontend-minigames-v471');

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.7 Zeichen-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

module.exports = function tuneDrawTiming(html) {
  html = tuneBase(html);

  const oldTimer = "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>'; }";
  const oldTimerCompact = "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>'; }".replace('; }',';}');
  const replacement = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>'; }".replace('; }',';}');
  if (html.includes(oldTimer)) html = html.replace(oldTimer, replacement);
  else if (html.includes(oldTimerCompact)) html = html.replace(oldTimerCompact, replacement);
  else throw new Error('v4.7 Zeichen-Timer-Patch fehlt: timerHtml');

  html = mustReplace(html, '</style>', `
.rating-draw-card{display:grid;gap:9px;padding:10px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
.rating-draw-card .rank-mini-canvas{width:100%;aspect-ratio:1;background:#fff;border-radius:12px;display:block}
.rating-caption{text-align:center;font-size:12px;font-weight:900;color:var(--muted)}
.rating-buttons{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.rating-btn{height:44px;border:1px solid var(--line);border-radius:11px;background:#21162c;color:var(--text);font-size:16px;font-weight:1000}
.rating-btn.selected{background:var(--accent);border-color:var(--accent);color:#11170a;transform:translateY(-1px)}
.rating-btn:disabled{opacity:.6}.rating-hint{text-align:center;color:var(--muted);font-size:11px;font-weight:800;margin:2px 0 8px}
</style>`, 'Rating-Styles');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
var allDrawRatings={},allDrawRatingKey='';
var drawRatingBaseHtml=allDrawMiniHtml;
allDrawMiniHtml=function(cur){
  if(!cur||cur.miniStage!=='rank')return drawRatingBaseHtml(cur);
  var drawings=cur.drawings||[],others=drawings.filter(function(d){return !d.own;}),ids=others.map(function(d){return d.id;});
  var key=String(state&&state.round||0)+':'+ids.slice().sort().join(',');
  if(allDrawRatingKey!==key){allDrawRatingKey=key;allDrawRatings={};}
  var out='<div class="mini-shell"><div class="mini-banner"><div class="mini-title">🎨 Alle malen · Bewertung</div><div class="mini-sub">Bewerte jede andere Zeichnung von 1 bis 5. Deine eigene Zeichnung ist ausgeschlossen.</div></div><div class="rating-hint">1 = eher wild · 5 = Meisterwerk</div><div class="rank-draw-list">';
  for(var i=0;i<others.length;i++){
    var d=others[i],id=d.id,chosen=Number(allDrawRatings[id]||0);
    out+='<div class="rating-draw-card"><canvas class="rank-mini-canvas" data-rank-canvas="'+esc(id)+'"></canvas><div class="rating-caption">Deine Bewertung</div><div class="rating-buttons">';
    for(var n=1;n<=5;n++)out+='<button class="rating-btn '+(chosen===n?'selected':'')+'" data-rate-id="'+esc(id)+'" data-rate="'+n+'" '+(cur.rankSubmitted?'disabled':'')+'>'+n+'</button>';
    out+='</div></div>';
  }
  var complete=ids.length>0&&ids.every(function(id){return Number(allDrawRatings[id])>=1&&Number(allDrawRatings[id])<=5;});
  out+='</div><button id="rankSubmit" class="btn primary" '+((cur.rankSubmitted||!complete)?'disabled':'')+'>'+(cur.rankSubmitted?'Bewertungen gespeichert ✓':'Bewertungen abgeben')+'</button><div class="all-draw-status">'+Number(cur.rankFinished||0)+' / '+Number(cur.rankTotal||0)+' Bewertungen fertig</div></div>';
  return out;
};

setupAllDrawRanking=function(cur){
  var drawings=cur.drawings||[],others=drawings.filter(function(d){return !d.own;}),ids=others.map(function(d){return d.id;}),canvases=document.querySelectorAll('[data-rank-canvas]');
  for(var i=0;i<canvases.length;i++){var id=canvases[i].getAttribute('data-rank-canvas'),d=drawings.find(function(x){return x.id===id;});if(d)prepCanvas(canvases[i],d.strokes||[]);}
  function refresh(){
    var buttons=document.querySelectorAll('.rating-btn');
    for(var b=0;b<buttons.length;b++){var id=buttons[b].getAttribute('data-rate-id'),n=Number(buttons[b].getAttribute('data-rate'));buttons[b].classList.toggle('selected',Number(allDrawRatings[id])===n);buttons[b].disabled=!!cur.rankSubmitted;}
    var submit=document.getElementById('rankSubmit'),complete=ids.length>0&&ids.every(function(id){return Number(allDrawRatings[id])>=1&&Number(allDrawRatings[id])<=5;});
    if(submit)submit.disabled=!!cur.rankSubmitted||!complete;
  }
  var buttons=document.querySelectorAll('.rating-btn');
  for(var b=0;b<buttons.length;b++)buttons[b].onclick=function(){if(cur.rankSubmitted)return;allDrawRatings[this.getAttribute('data-rate-id')]=Number(this.getAttribute('data-rate'));refresh();};
  var submit=document.getElementById('rankSubmit');
  if(submit&&!cur.rankSubmitted)submit.onclick=function(){var ratings={};for(var i=0;i<ids.length;i++){var id=ids[i],n=Number(allDrawRatings[id]);if(n<1||n>5)return;ratings[id]=n;}submit.disabled=true;submit.textContent='Bewertungen gespeichert ✓';send({t:'allDrawRank',ratings:ratings});};
  refresh();
};
`;

  html = mustReplace(html, anchor, extension + '\n' + anchor, '1-bis-5-Zeichenbewertung');
  return html;
};
