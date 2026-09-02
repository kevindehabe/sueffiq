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

  html = html.replace(
    'Zwei Spieler, erstes Team auf 3 Punkte gewinnt. Zieh deinen Schläger direkt auf dem Feld.',
    'Zwei Spieler. Ein Punkt entscheidet. Zieh deinen Schläger direkt auf dem Feld.'
  );

  html = mustReplace(html, '</style>', `
.rating-draw-card{display:grid;gap:9px;padding:10px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
.rating-draw-card .rank-mini-canvas{width:100%;aspect-ratio:1;background:#fff;border-radius:12px;display:block}
.rating-caption{text-align:center;font-size:12px;font-weight:900;color:var(--muted)}
.rating-buttons{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.rating-btn{height:46px;border:1px solid var(--line);border-radius:11px;background:#21162c;color:#6d6079;font-size:25px;font-weight:1000;line-height:1}
.rating-btn.selected{background:rgba(184,255,74,.13);border-color:var(--accent);color:var(--accent);transform:translateY(-1px)}
.rating-btn:disabled{opacity:.72}.rating-hint{text-align:center;color:var(--muted);font-size:11px;font-weight:800;margin:2px 0 8px}.rating-local-status{text-align:center;font-size:12px;font-weight:900;color:var(--accent)}
.rgb-tools{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;padding:4px 0}.rgb-preset{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.28);padding:0;box-shadow:0 2px 8px rgba(0,0,0,.18)}.rgb-preset.active{outline:3px solid #fff;outline-offset:2px}.rgb-picker-wrap{width:42px;height:42px;border-radius:50%;padding:3px;background:conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);display:grid;place-items:center;box-shadow:0 2px 10px rgba(0,0,0,.22)}.rgb-picker{width:32px;height:32px;border:0;padding:0;border-radius:50%;overflow:hidden;background:transparent}.rgb-picker::-webkit-color-swatch-wrapper{padding:0}.rgb-picker::-webkit-color-swatch{border:2px solid #fff;border-radius:50%}.rgb-label{width:100%;text-align:center;color:var(--muted);font-size:10px;font-weight:850}.draw-eraser{height:38px;padding:0 12px;border-radius:12px;border:1px solid var(--line);background:#f7f7f7;color:#21162c;font-size:11px;font-weight:950;box-shadow:0 2px 8px rgba(0,0,0,.18)}.draw-eraser.active{outline:3px solid var(--accent);outline-offset:2px}
</style>`, 'Rating-und-RGB-Styles');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
var allDrawRatings={},allDrawRatingKey='',allDrawAutoSent=false;

function strokeCssColor(value){
  if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))return value;
  var colors=['#171717','#8f5cff','#78b92f','#ff5f74'];return colors[Number(value)||0]||colors[0];
}
paintStroke=function(s){if(!drawCtx||!drawCanvas||!s||s.length<5)return;var color=strokeCssColor(s[4]);drawCtx.strokeStyle=color;drawCtx.lineWidth=color==='#ffffff'?Math.max(14,drawCanvas.width*.035):Math.max(4,drawCanvas.width*.012);drawCtx.lineCap='round';drawCtx.lineJoin='round';drawCtx.beginPath();drawCtx.moveTo(Number(s[0])*drawCanvas.width,Number(s[1])*drawCanvas.height);drawCtx.lineTo(Number(s[2])*drawCanvas.width,Number(s[3])*drawCanvas.height);drawCtx.stroke();};
paintOn=function(canvas,ctx,s){if(!canvas||!ctx||!s||s.length<5)return;var color=strokeCssColor(s[4]);ctx.strokeStyle=color;ctx.lineWidth=color==='#ffffff'?Math.max(12,canvas.width*.035):Math.max(3,canvas.width*.012);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(Number(s[0])*canvas.width,Number(s[1])*canvas.height);ctx.lineTo(Number(s[2])*canvas.width,Number(s[3])*canvas.height);ctx.stroke();};

function rgbPaletteHtml(){
  var colors=['#171717','#ffffff','#ff3b30','#ff9500','#ffcc00','#34c759','#00c7be','#0a84ff','#5856d6','#af52de','#ff2d55','#8e5a2b'];
  var out='<div class="rgb-tools"><div class="rgb-label">Farbe oder Radierer wählen</div>';
  for(var i=0;i<colors.length;i++)out+='<button type="button" class="rgb-preset" data-rgb="'+colors[i]+'" style="background:'+colors[i]+'" aria-label="Farbe '+colors[i]+'"></button>';
  out+='<label class="rgb-picker-wrap" title="Eigene Farbe"><input id="drawRgbPicker" class="rgb-picker" type="color" value="#171717" aria-label="Eigene Farbe wählen"></label><button type="button" id="drawEraser" class="draw-eraser" aria-label="Radierer">⌫ Radierer</button></div>';
  return out;
}
function injectRgbPalette(out){return out.replace('<div class="draw-tools">',rgbPaletteHtml()+'<div class="draw-tools">');}
function setupRgbPicker(){
  var presets=document.querySelectorAll('.rgb-preset'),picker=document.getElementById('drawRgbPicker'),eraser=document.getElementById('drawEraser');
  function choose(color,button){drawColor=String(color||'#171717').toLowerCase();for(var i=0;i<presets.length;i++)presets[i].classList.toggle('active',presets[i]===button);if(eraser)eraser.classList.toggle('active',button===eraser);if(picker&&/^#[0-9a-f]{6}$/i.test(drawColor))picker.value=drawColor;}
  for(var i=0;i<presets.length;i++)presets[i].onclick=function(){choose(this.getAttribute('data-rgb'),this);};
  if(picker){picker.oninput=function(){choose(this.value,null);};picker.onchange=function(){choose(this.value,null);};}
  if(eraser)eraser.onclick=function(){choose('#ffffff',eraser);};
}

var rgbBaseDrawMiniHtml=drawMiniHtml;
drawMiniHtml=function(cur){var out=rgbBaseDrawMiniHtml(cur);return cur&&cur.isDrawer?injectRgbPalette(out):out;};
var rgbBaseSetupCanvas=setupCanvas;
setupCanvas=function(){rgbBaseSetupCanvas();var cur=state&&state.current;if(cur&&cur.type==='minigame'&&cur.miniType==='zeichnen'&&cur.isDrawer)setupRgbPicker();};

var drawRatingBaseHtml=allDrawMiniHtml;
allDrawMiniHtml=function(cur){
  if(!cur||cur.miniStage!=='rank')return injectRgbPalette(drawRatingBaseHtml(cur));
  var drawings=cur.drawings||[],others=drawings.filter(function(d){return !d.own;}),ids=others.map(function(d){return d.id;});
  var key=String(state&&state.round||0)+':'+ids.slice().sort().join(',');
  if(allDrawRatingKey!==key){allDrawRatingKey=key;allDrawRatings={};allDrawAutoSent=false;}
  var doneCount=ids.filter(function(id){return Number(allDrawRatings[id])>=1&&Number(allDrawRatings[id])<=5;}).length;
  var out='<div class="mini-shell"><div class="mini-banner"><div class="mini-title">🎨 Alle malen · Bewertung</div><div class="mini-sub">Gib jeder fremden Zeichnung 1 bis 5 Sterne. Sobald du alle bewertet hast, wird automatisch gespeichert.</div></div><div class="rating-hint">1 ★ = eher wild · 5 ★ = Meisterwerk</div><div class="rank-draw-list">';
  for(var i=0;i<others.length;i++){
    var d=others[i],id=d.id,chosen=Number(allDrawRatings[id]||0);
    out+='<div class="rating-draw-card"><canvas class="rank-mini-canvas" data-rank-canvas="'+esc(id)+'"></canvas><div class="rating-caption">Deine Bewertung</div><div class="rating-buttons">';
    for(var n=1;n<=5;n++)out+='<button type="button" class="rating-btn '+(chosen>=n?'selected':'')+'" data-rate-id="'+esc(id)+'" data-rate="'+n+'" '+(cur.rankSubmitted?'disabled':'')+'>★</button>';
    out+='</div></div>';
  }
  out+='</div><div id="ratingLocalStatus" class="rating-local-status">'+(cur.rankSubmitted?'Bewertungen gespeichert ✓':doneCount+' / '+ids.length+' Zeichnungen bewertet')+'</div><div id="allDrawGlobalStatus" class="all-draw-status">'+Number(cur.rankFinished||0)+' / '+Number(cur.rankTotal||0)+' Spieler fertig</div></div>';
  return out;
};

setupAllDrawRanking=function(cur){
  var drawings=cur.drawings||[],others=drawings.filter(function(d){return !d.own;}),ids=others.map(function(d){return d.id;}),canvases=document.querySelectorAll('[data-rank-canvas]');
  for(var i=0;i<canvases.length;i++){var id=canvases[i].getAttribute('data-rank-canvas'),d=drawings.find(function(x){return x.id===id;});if(d)prepCanvas(canvases[i],d.strokes||[]);}
  function refresh(){
    var buttons=document.querySelectorAll('.rating-btn');
    for(var b=0;b<buttons.length;b++){var id=buttons[b].getAttribute('data-rate-id'),n=Number(buttons[b].getAttribute('data-rate'));buttons[b].classList.toggle('selected',Number(allDrawRatings[id])>=n);buttons[b].disabled=!!cur.rankSubmitted||allDrawAutoSent;}
    var complete=ids.length>0&&ids.every(function(id){return Number(allDrawRatings[id])>=1&&Number(allDrawRatings[id])<=5;}),count=ids.filter(function(id){return Number(allDrawRatings[id])>=1&&Number(allDrawRatings[id])<=5;}).length,status=document.getElementById('ratingLocalStatus');
    if(status)status.textContent=cur.rankSubmitted?'Bewertungen gespeichert ✓':allDrawAutoSent?'Bewertungen werden gespeichert …':count+' / '+ids.length+' Zeichnungen bewertet';
    if(complete&&!cur.rankSubmitted&&!allDrawAutoSent){var ratings={};for(var i=0;i<ids.length;i++)ratings[ids[i]]=Number(allDrawRatings[ids[i]]);allDrawAutoSent=true;if(status)status.textContent='Bewertungen werden gespeichert …';for(var j=0;j<buttons.length;j++)buttons[j].disabled=true;send({t:'allDrawRank',ratings:ratings});}
  }
  var buttons=document.querySelectorAll('.rating-btn');
  for(var b=0;b<buttons.length;b++)buttons[b].onclick=function(){if(cur.rankSubmitted||allDrawAutoSent)return;allDrawRatings[this.getAttribute('data-rate-id')]=Number(this.getAttribute('data-rate'));refresh();};
  refresh();
};

var rgbBaseSetupAllDraw=setupAllDraw;
setupAllDraw=function(){rgbBaseSetupAllDraw();var cur=state&&state.current;if(cur&&cur.type==='minigame'&&cur.miniType==='allemalen'&&cur.miniStage!=='rank')setupRgbPicker();};

var ratingBasePatchRound=patchRound;
patchRound=function(cur){ratingBasePatchRound(cur);if(cur&&cur.type==='minigame'&&cur.miniType==='allemalen'&&cur.miniStage==='rank'){var g=document.getElementById('allDrawGlobalStatus');if(g)g.textContent=Number(cur.rankFinished||0)+' / '+Number(cur.rankTotal||0)+' Spieler fertig';if(cur.rankSubmitted){var s=document.getElementById('ratingLocalStatus');if(s)s.textContent='Bewertungen gespeichert ✓';var b=document.querySelectorAll('.rating-btn');for(var i=0;i<b.length;i++)b[i].disabled=true;}}};
`;

  html = mustReplace(html, anchor, extension + '\n' + anchor, 'Sterne-RGB-Zeichnen');
  return html;
};
