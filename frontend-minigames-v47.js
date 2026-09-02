'use strict';

const tuneBase = require('./frontend-minigames-v461');

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`v4.7 Frontend-Patch fehlt: ${label}`);
  return source.replace(needle, replacement);
}

module.exports = function tuneV47(html) {
  html = tuneBase(html);

  // v4.6 used data-mc in the markup, but data-c in the CSS. Fix the real selector bug.
  html = html
    .replace(/\.memory-btn\[data-c="0"\]/g, '.memory-btn[data-mc="0"]')
    .replace(/\.memory-btn\[data-c="1"\]/g, '.memory-btn[data-mc="1"]')
    .replace(/\.memory-btn\[data-c="2"\]/g, '.memory-btn[data-mc="2"]')
    .replace(/\.memory-btn\[data-c="3"\]/g, '.memory-btn[data-mc="3"]');

  html = mustReplace(html, '</style>', `
.mini-subpick{margin-top:10px;padding:11px;border:1px solid rgba(143,92,255,.25);border-radius:15px;background:rgba(143,92,255,.055)}
.mini-subpick-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:950;font-size:13px;margin-bottom:8px}.mini-subgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.mini-toggle,.mini-view{min-height:42px;border-radius:12px;border:1px solid var(--line);padding:8px 9px;background:#171020;color:var(--muted);font-size:12px;font-weight:900;text-align:left}.mini-toggle.active,.mini-view.active{background:rgba(184,255,74,.11);border-color:var(--accent);color:var(--accent)}
.memory-btn[data-mc="0"]{background:#8f5cff!important;color:#fff!important}.memory-btn[data-mc="1"]{background:#b8ff4a!important;color:#10160a!important}.memory-btn[data-mc="2"]{background:#ff9d45!important;color:#241100!important}.memory-btn[data-mc="3"]{background:#4aa8ff!important;color:#061421!important}.memory-btn:disabled{opacity:.58!important;filter:saturate(.9)}
.all-draw-status{text-align:center;color:var(--muted);font-size:12px;font-weight:850}.rank-draw-list{display:grid;gap:10px}.rank-draw-card{display:grid;grid-template-columns:34px 1fr 44px;align-items:center;gap:8px;padding:8px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}.rank-number{font-size:20px;font-weight:1000;text-align:center;color:var(--accent)}.rank-mini-canvas{width:100%;aspect-ratio:1;background:#fff;border-radius:12px;display:block}.rank-controls{display:grid;gap:5px}.rank-controls button{height:36px;border:1px solid var(--line);border-radius:10px;background:#241831;color:var(--text);font-weight:950}
.pong-wrap{display:grid;gap:9px}.pong-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:12px;font-weight:900}.pong-score{font-size:24px;color:var(--accent);font-weight:1000}.pong-canvas{display:block;width:100%;aspect-ratio:1.55;background:#100b17;border:1px solid var(--line);border-radius:18px;touch-action:none}.pong-role{text-align:center;color:var(--muted);font-size:12px;font-weight:850}
.bj-table{display:grid;gap:12px}.bj-row{display:grid;gap:7px}.bj-title{font-size:12px;color:var(--muted);font-weight:900}.bj-cards{display:flex;gap:7px;flex-wrap:wrap}.bj-card{width:54px;height:72px;border-radius:10px;background:#fff;color:#111;display:grid;place-items:center;font-size:20px;font-weight:1000;border:1px solid #ddd;box-shadow:0 5px 15px rgba(0,0,0,.18)}.bj-card.red{color:#c52e44}.bj-card.hidden{background:linear-gradient(135deg,#6f44d8,#2b174f);color:#fff}.bj-total{font-size:20px;font-weight:1000;color:var(--accent)}.bj-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:380px){.mini-subgrid{grid-template-columns:1fr}.rank-draw-card{grid-template-columns:30px 1fr 40px}}
</style>`, 'v4.7 styles');

  const anchor = "try{joined=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){joined=null;}";
  const extension = String.raw`
var allDrawOrder=[],pongMoveAt=0;

var v47CategoryPickerHtml=categoryPickerHtml;
categoryPickerHtml=function(){
  var out=v47CategoryPickerHtml();
  if(!state||!state.cats||!state.cats.minigame)return out;
  var activeCats=state.selectedCats||[],types=state.miniTypes||{},keys=['zeichnen','allemalen','reaktion','taps','farbfolge','pong','blackjack'].filter(function(k){return !!types[k];}),selected=state.selectedMiniTypes||keys,host=state.you===state.hostId;
  if(activeCats.indexOf('minigame')<0||!keys.length)return out;
  var sub='<div class="mini-subpick"><div class="mini-subpick-title"><span>🎮 Minigames einzeln</span>'+(host?'<button id="allMinis" class="mini">Alle</button>':'')+'</div><div class="mini-subgrid">';
  for(var i=0;i<keys.length;i++){var k=keys[i],on=selected.indexOf(k)>=0,label=types[k]||k;sub+=host?'<button class="mini-toggle '+(on?'active':'')+'" data-mini="'+esc(k)+'">'+esc(label)+'</button>':'<div class="mini-view '+(on?'active':'')+'">'+esc(label)+'</div>';}
  return out+sub+'</div></div>';
};

var v47Bind=bind;
bind=function(){
  v47Bind();
  var a=document.querySelectorAll('.mini-toggle');for(var i=0;i<a.length;i++)a[i].onclick=function(){send({t:'toggleMini',mini:this.getAttribute('data-mini')});};
  var all=document.getElementById('allMinis');if(all)all.onclick=function(){send({t:'allMinis'});};
};

var v47ResetMiniLocal=resetMiniLocal;
resetMiniLocal=function(){v47ResetMiniLocal();allDrawOrder=[];pongMoveAt=0;};

var v47CanPatch=canPatch;
canPatch=function(prev,next){
  if(prev&&next&&prev.current&&next.current&&prev.current.type==='minigame'&&next.current.type==='minigame'){
    if(prev.current.miniType!==next.current.miniType)return false;
    if(next.current.miniType==='allemalen'&&prev.current.miniStage!==next.current.miniStage)return false;
    if(next.current.miniType==='blackjack')return false;
  }
  return v47CanPatch(prev,next);
};

function allDrawMiniHtml(cur){
  if(cur.miniStage==='rank'){
    var drawings=cur.drawings||[],others=drawings.filter(function(d){return !d.own;});
    var valid=others.map(function(d){return d.id;});
    if(!allDrawOrder.length||allDrawOrder.length!==valid.length||allDrawOrder.some(function(id){return valid.indexOf(id)<0;}))allDrawOrder=valid.slice();
    var out='<div class="mini-shell"><div class="mini-banner"><div class="mini-title">🎨 Alle malen · Ranking</div><div class="mini-sub">Ordne die Zeichnungen von gut nach schlecht. Deine eigene Zeichnung ist aus deinem Voting raus.</div></div><div class="rank-draw-list">';
    for(var i=0;i<allDrawOrder.length;i++){var id=allDrawOrder[i],d=others.find(function(x){return x.id===id;});if(!d)continue;out+='<div class="rank-draw-card" data-rank-id="'+esc(id)+'"><div class="rank-number">#'+(i+1)+'</div><canvas class="rank-mini-canvas" data-rank-canvas="'+esc(id)+'"></canvas><div class="rank-controls"><button data-rank-up="'+esc(id)+'">↑</button><button data-rank-down="'+esc(id)+'">↓</button></div></div>';}
    out+='</div><button id="rankSubmit" class="btn primary" '+(cur.rankSubmitted?'disabled':'')+'>'+(cur.rankSubmitted?'Ranking gespeichert ✓':'Ranking abgeben')+'</button><div class="all-draw-status">'+Number(cur.rankFinished||0)+' / '+Number(cur.rankTotal||0)+' Rankings fertig</div></div>';return out;
  }
  return '<div class="mini-shell"><div class="mini-banner"><div class="mini-title">🎨 Alle malen</div><div class="mini-sub">Alle bekommen dasselbe Wort. Zeichne es auf deinem Handy – danach bewertet ihr euch gegenseitig.</div></div><div class="draw-secret">'+esc(cur.prompt||'…')+'</div><canvas id="drawCanvas" class="draw-canvas"></canvas><div class="draw-tools"><button class="draw-color active" data-c="0"></button><button class="draw-color" data-c="1"></button><button class="draw-color" data-c="2"></button><button class="draw-color" data-c="3"></button><button id="allDrawClear" class="draw-clear">Löschen</button></div><button id="allDrawDone" class="btn primary" '+(cur.drawDone?'disabled':'')+'>'+(cur.drawDone?'Fertig ✓':'Zeichnung fertig')+'</button><div id="allDrawStatus" class="all-draw-status">'+Number(cur.drawFinished||0)+' / '+Number(cur.drawTotal||0)+' fertig</div></div>';
}

function pongMiniHtml(cur){var p=cur.pong||{},role=p.youSide==='left'?'Du spielst links':p.youSide==='right'?'Du spielst rechts':'Du schaust zu';return '<div class="mini-shell pong-wrap"><div class="mini-banner"><div class="mini-title">🏓 Pong</div><div class="mini-sub">Zwei Spieler, erstes Team auf 3 Punkte gewinnt. Zieh deinen Schläger direkt auf dem Feld.</div></div><div class="pong-head"><span>'+esc(p.leftName||'Links')+'</span><span id="pongScore" class="pong-score">'+Number((p.score||{}).left||0)+' : '+Number((p.score||{}).right||0)+'</span><span>'+esc(p.rightName||'Rechts')+'</span></div><canvas id="pongCanvas" class="pong-canvas"></canvas><div class="pong-role">'+role+'</div></div>';}

function bjCardHtml(c){if(!c||c.hidden)return '<div class="bj-card hidden">?</div>';var red=c.s==='♥'||c.s==='♦';return '<div class="bj-card '+(red?'red':'')+'">'+esc(String(c.r||''))+esc(String(c.s||''))+'</div>';}
function blackjackMiniHtml(cur){var b=cur.blackjack||{},hand=b.hand||[],dealer=b.dealer||[],out='<div class="mini-shell"><div class="mini-banner"><div class="mini-title">🃏 Blackjack</div><div class="mini-sub">Kein Einsatz, nur Party-Punkte: näher an 21 als der Dealer. Über 21 = Bust.</div></div><div class="bj-table"><div class="bj-row"><div class="bj-title">Dealer</div><div class="bj-cards">';for(var i=0;i<dealer.length;i++)out+=bjCardHtml(dealer[i]);out+='</div></div><div class="bj-row"><div class="bj-title">Deine Hand</div><div class="bj-cards">';for(var j=0;j<hand.length;j++)out+=bjCardHtml(hand[j]);out+='</div><div class="bj-total">'+Number(b.value||0)+'</div></div>'+(b.done?'<div class="waiting">Gespeichert – warte auf die anderen.</div>':'<div class="bj-actions"><button id="bjHit" class="btn secondary">Karte</button><button id="bjStand" class="btn primary">Stehen</button></div>')+'</div></div>';return out;}

var v47MiniBody=miniBody;
miniBody=function(cur){if(cur.miniType==='allemalen')return allDrawMiniHtml(cur);if(cur.miniType==='pong')return pongMiniHtml(cur);if(cur.miniType==='blackjack')return blackjackMiniHtml(cur);return v47MiniBody(cur);};

function paintOn(canvas,ctx,s){if(!canvas||!ctx||!s||s.length<5)return;var colors=['#171717','#8f5cff','#78b92f','#ff5f74'];ctx.strokeStyle=colors[Number(s[4])||0]||colors[0];ctx.lineWidth=Math.max(3,canvas.width*.012);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(Number(s[0])*canvas.width,Number(s[1])*canvas.height);ctx.lineTo(Number(s[2])*canvas.width,Number(s[3])*canvas.height);ctx.stroke();}
function prepCanvas(canvas,strokes){var r=canvas.getBoundingClientRect(),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));canvas.width=Math.max(220,Math.round(r.width*dpr));canvas.height=canvas.width;var ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);for(var i=0;i<(strokes||[]).length;i++)paintOn(canvas,ctx,strokes[i]);return ctx;}

function setupAllDraw(){var cur=state&&state.current;if(!cur||cur.miniType!=='allemalen')return;if(cur.miniStage==='rank'){setupAllDrawRanking(cur);return;}drawCanvas=document.getElementById('drawCanvas');if(!drawCanvas)return;drawCtx=prepCanvas(drawCanvas,cur.strokes||[]);var colors=document.querySelectorAll('.draw-color');for(var i=0;i<colors.length;i++)colors[i].onclick=function(){if(cur.drawDone)return;drawColor=Number(this.getAttribute('data-c'))||0;for(var j=0;j<colors.length;j++)colors[j].classList.toggle('active',colors[j]===this);};var clear=document.getElementById('allDrawClear');if(clear)clear.onclick=function(){if(cur.drawDone)return;clearDrawCanvas();send({t:'allDrawClear'});};var done=document.getElementById('allDrawDone');if(done)done.onclick=function(){done.disabled=true;done.textContent='Fertig ✓';send({t:'allDrawDone'});};if(cur.drawDone)return;function pos(e){var r=drawCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}drawCanvas.onpointerdown=function(e){e.preventDefault();try{drawCanvas.setPointerCapture(e.pointerId);}catch(x){}drawLast=pos(e);};drawCanvas.onpointermove=function(e){if(!drawLast)return;e.preventDefault();var p=pos(e),s=[drawLast.x,drawLast.y,p.x,p.y,drawColor];paintStroke(s);var now=Date.now();if(now-drawLastSent>=45){send({t:'allDrawStroke',s:s});drawLastSent=now;}drawLast=p;};drawCanvas.onpointerup=drawCanvas.onpointercancel=function(){drawLast=null;};}
function setupAllDrawRanking(cur){var drawings=cur.drawings||[],canvases=document.querySelectorAll('[data-rank-canvas]');for(var i=0;i<canvases.length;i++){var id=canvases[i].getAttribute('data-rank-canvas'),d=drawings.find(function(x){return x.id===id;});if(d)prepCanvas(canvases[i],d.strokes||[]);}var ups=document.querySelectorAll('[data-rank-up]');for(var u=0;u<ups.length;u++)ups[u].onclick=function(){var id=this.getAttribute('data-rank-up'),idx=allDrawOrder.indexOf(id);if(idx>0){var t=allDrawOrder[idx-1];allDrawOrder[idx-1]=id;allDrawOrder[idx]=t;render();}};var downs=document.querySelectorAll('[data-rank-down]');for(var d=0;d<downs.length;d++)downs[d].onclick=function(){var id=this.getAttribute('data-rank-down'),idx=allDrawOrder.indexOf(id);if(idx>=0&&idx<allDrawOrder.length-1){var t=allDrawOrder[idx+1];allDrawOrder[idx+1]=id;allDrawOrder[idx]=t;render();}};var submit=document.getElementById('rankSubmit');if(submit&&!cur.rankSubmitted)submit.onclick=function(){submit.disabled=true;submit.textContent='Ranking gespeichert ✓';send({t:'allDrawRank',order:allDrawOrder.slice()});};}

function renderPong(cur){var canvas=document.getElementById('pongCanvas'),p=cur&&cur.pong;if(!canvas||!p)return;var r=canvas.getBoundingClientRect(),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));canvas.width=Math.max(300,Math.round(r.width*dpr));canvas.height=Math.round(canvas.width/1.55);var ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.fillStyle='#100b17';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);var pads=p.paddles||{},ph=h*.25,pw=Math.max(8,w*.018);ctx.fillStyle='#fff';ctx.fillRect(w*.045,(Number(pads.left||.5)*h)-ph/2,pw,ph);ctx.fillRect(w*.955-pw,(Number(pads.right||.5)*h)-ph/2,pw,ph);var b=p.ball||{x:.5,y:.5};ctx.fillStyle='#b8ff4a';ctx.beginPath();ctx.arc(Number(b.x||.5)*w,Number(b.y||.5)*h,Math.max(6,w*.018),0,Math.PI*2);ctx.fill();var score=document.getElementById('pongScore');if(score)score.textContent=Number((p.score||{}).left||0)+' : '+Number((p.score||{}).right||0);}
function setupPong(){var cur=state&&state.current,p=cur&&cur.pong,canvas=document.getElementById('pongCanvas');if(!p||!canvas)return;renderPong(cur);if(!p.youSide)return;function move(e){e.preventDefault();var now=Date.now();if(now-pongMoveAt<32)return;pongMoveAt=now;var r=canvas.getBoundingClientRect(),y=Math.max(.12,Math.min(.88,(e.clientY-r.top)/r.height));send({t:'pongMove',y:y});}canvas.onpointerdown=function(e){try{canvas.setPointerCapture(e.pointerId);}catch(x){}move(e);};canvas.onpointermove=function(e){if(e.buttons||e.pressure>0)move(e);};}
function setupBlackjack(){var cur=state&&state.current;if(!cur||cur.miniType!=='blackjack')return;var hit=document.getElementById('bjHit'),stand=document.getElementById('bjStand');if(hit)hit.onclick=function(){send({t:'blackjackHit'});};if(stand)stand.onclick=function(){send({t:'blackjackStand'});};}

var v47BindMiniGame=bindMiniGame;
bindMiniGame=function(){v47BindMiniGame();var cur=state&&state.current;if(!cur||cur.type!=='minigame')return;if(cur.miniType==='allemalen')setupAllDraw();if(cur.miniType==='pong')setupPong();if(cur.miniType==='blackjack')setupBlackjack();};

var v47PatchRound=patchRound;
patchRound=function(cur){v47PatchRound(cur);if(cur&&cur.type==='minigame'&&cur.miniType==='pong')renderPong(cur);if(cur&&cur.type==='minigame'&&cur.miniType==='allemalen'){var s=document.getElementById('allDrawStatus');if(s)s.textContent=Number(cur.drawFinished||0)+' / '+Number(cur.drawTotal||0)+' fertig';var rs=document.getElementById('rankSubmit');if(rs&&cur.rankSubmitted){rs.disabled=true;rs.textContent='Ranking gespeichert ✓';}}};
`;

  html = mustReplace(html, anchor, extension + '\n' + anchor, 'v4.7 runtime extension');
  return html;
};
