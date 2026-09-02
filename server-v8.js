'use strict';

// SüffIQ v4.4 bootstrap: extends the v4.3 production shell with lobby category selection.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const sourcePath = path.join(__dirname, 'server-v7.js');
const runtimePath = path.join(__dirname, '.server-v7-category-runtime.js');

let source = fs.readFileSync(sourcePath, 'utf8');

function replaceRequired(text, needle, replacement, label) {
  if (!text.includes(needle)) throw new Error(`v4.4 patch fehlt: ${label}`);
  return text.replace(needle, replacement);
}

const coreInjection = String.raw`
  // v4.4: Kategorien werden pro Lobby vom Host gewählt.
  core = replaceRequired(
    core,
    "    code: makeCode(), hostId: null, players: {}, order: [], phase: 'lobby', round: 0,\n    current: null, lastResult: null, used: {}, deck: [], lastCat: null, timers: [], createdAt: Date.now(),",
    "    code: makeCode(), hostId: null, players: {}, order: [], phase: 'lobby', round: 0,\n    current: null, lastResult: null, used: {}, deck: [], lastCat: null, timers: [], createdAt: Date.now(), selectedCats: [...CATEGORY_ORDER],",
    'selected categories room state'
  );

  core = replaceRequired(
    core,
    "    code: room.code, hostId: room.hostId, you: forId, cats: CATS, phase: room.phase, round: room.round, now: Date.now(),",
    "    code: room.code, hostId: room.hostId, you: forId, cats: CATS, selectedCats: room.selectedCats || [...CATEGORY_ORDER], phase: room.phase, round: room.round, now: Date.now(),",
    'selected categories public state'
  );

  core = replaceRequired(core, "  wahl: 'Wahl',", "  wahl: 'Wer würde eher',", 'wahl label');

  core = replaceRequired(
    core,
    "  let deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group]\n    .filter((cat) => Array.isArray(Q[cat]) && Q[cat].length);",
    "  const selected = (Array.isArray(room.selectedCats) && room.selectedCats.length ? room.selectedCats : CATEGORY_ORDER)\n    .filter((cat) => CATEGORY_ORDER.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);\n  let deck;\n  if (selected.length === CATEGORY_ORDER.length) {\n    deck = ['schaetz', 'schaetz', 'trivia', 'person', 'bild', 'song', social, 'oder', adult, group]\n      .filter((cat) => selected.includes(cat) && Array.isArray(Q[cat]) && Q[cat].length);\n  } else {\n    deck = [...selected];\n    const target = Math.max(10, selected.length);\n    const customWeights = { schaetz: 5, wahl: 3, trivia: 3, song: 3, person: 2, bild: 2, nie: 2, mehrheit: 2, skala: 2, oder: 2, wahrheit: 2, pflicht: 2 };\n    const bag = [];\n    for (const cat of selected) for (let i = 0; i < (customWeights[cat] || 1); i += 1) bag.push(cat);\n    while (deck.length < target && bag.length) deck.push(rand(bag));\n  }\n  deck = shuffle(deck);",
    'custom category deck'
  );

  core = replaceRequired(
    core,
    "    const isHost = room.hostId === me;\n    if (msg.t === 'start' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {",
    "    const isHost = room.hostId === me;\n    if (msg.t === 'toggleCat' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {\n      const cat = String(msg.cat || '');\n      if (!CATEGORY_ORDER.includes(cat) || !Array.isArray(Q[cat]) || !Q[cat].length) return;\n      const selected = Array.isArray(room.selectedCats) && room.selectedCats.length ? [...room.selectedCats] : [...CATEGORY_ORDER];\n      const idx = selected.indexOf(cat);\n      if (idx >= 0) {\n        if (selected.length <= 1) return error('Mindestens eine Kategorie muss aktiv bleiben.');\n        selected.splice(idx, 1);\n      } else selected.push(cat);\n      room.selectedCats = CATEGORY_ORDER.filter((x) => selected.includes(x));\n      room.deck = []; room.lastCat = null;\n      return broadcast(room);\n    }\n    if (msg.t === 'allCats' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {\n      room.selectedCats = [...CATEGORY_ORDER]; room.deck = []; room.lastCat = null; return broadcast(room);\n    }\n    if (msg.t === 'start' && isHost && (room.phase === 'lobby' || room.phase === 'end')) {",
    'category websocket controls'
  );
`;

source = replaceRequired(
  source,
  "  core = core.replace(/version: '4\\.0\\.0'/g, \"version: '4.3.0'\");",
  coreInjection + "\n  core = core.replace(/version: '4\\.0\\.0'/g, \"version: '4.4.0'\");",
  'inject core category patches'
);

const frontendInjection = String.raw`
  // v4.4: Kategorieauswahl in der Lobby.
  html = html.replace(
    '</style>',
    '.cat-tools{display:flex;gap:8px;margin-bottom:9px}.cat-tools .mini{flex:1}.cat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cat-toggle,.cat-view{min-height:46px;border-radius:13px;padding:10px 11px;border:1px solid var(--line);background:#15101e;color:#8d8298;font-weight:850;font-size:12px;text-align:left}.cat-toggle{cursor:pointer}.cat-toggle.active,.cat-view.active{color:#11170a;background:var(--accent);border-color:var(--accent)}.cat-view{opacity:.85}.cat-help{color:var(--muted);font-size:11px;line-height:1.4;margin:8px 1px 12px}@media(max-width:380px){.cat-grid{grid-template-columns:1fr}}</style>'
  );

  html = html.replace(
    /function lobbyHtml\(\)\{[\s\S]*?\n\}\nfunction targetName/,
    "function categoryPickerHtml(){\n  var selected=state.selectedCats||Object.keys(state.cats||{}),host=state.you===state.hostId,out='';\n  if(host)out+='<div class=\\\"cat-tools\\\"><button id=\\\"allCats\\\" class=\\\"mini\\\">Alle auswählen</button><span class=\\\"mini\\\" style=\\\"text-align:center\\\">'+selected.length+' aktiv</span></div>';\n  out+='<div class=\\\"cat-grid\\\">';\n  for(var key in state.cats){var active=selected.indexOf(key)>=0,cls=host?'cat-toggle':'cat-view';out+='<button '+(host?'':'disabled')+' class=\\\"'+cls+(active?' active':'')+'\\\" data-cat=\\\"'+esc(key)+'\\\">'+(active?'✓ ':'')+esc(state.cats[key])+'</button>';}\n  out+='</div><div class=\\\"cat-help\\\">'+(host?'Tippe Kategorien an oder aus. Mindestens eine bleibt aktiv.':'Der Host hat diese Kategorien für die Runde ausgewählt.')+'</div>';\n  return out;\n}\nfunction lobbyHtml(){\n  var host=state.you===state.hostId;\n  var controls=host?'<div class=\\\"grid2\\\"><button id=\\\"start\\\" class=\\\"btn primary\\\">Spiel starten</button><button id=\\\"leaveLobby\\\" class=\\\"btn ghost\\\">Lobby verlassen</button></div>':'<div class=\\\"waiting\\\">Der Host startet das Spiel.</div><button id=\\\"leaveLobby\\\" class=\\\"btn ghost\\\">Lobby verlassen</button>';\n  return topHtml()+'<div class=\\\"card center\\\"><div class=\\\"meta\\\">Spielcode</div><div class=\\\"big-code\\\">'+esc(state.code)+'</div><div class=\\\"note\\\">Mitspieler öffnen dieselbe Seite und geben diesen Code ein.</div></div><div class=\\\"section\\\">Kategorien</div>'+categoryPickerHtml()+'<div class=\\\"section\\\">Spieler</div>'+playersHtml()+'<div style=\\\"height:12px\\\"></div>'+controls+'<div class=\\\"footer\\\">Eigener Kategorienmix · 18+</div>';\n}\nfunction targetName"
  );

  html = html.replace(
    "  var leave=document.getElementById('leaveLobby');if(leave)leave.onclick=function(){send({t:'leave'});clearJoin();state=null;feedback=null;render();};",
    "  var leave=document.getElementById('leaveLobby');if(leave)leave.onclick=function(){send({t:'leave'});clearJoin();state=null;feedback=null;render();};\n  var allCats=document.getElementById('allCats');if(allCats)allCats.onclick=function(){send({t:'allCats'});};\n  var catBtns=document.querySelectorAll('.cat-toggle');for(i=0;i<catBtns.length;i++)catBtns[i].onclick=function(){send({t:'toggleCat',cat:this.getAttribute('data-cat')});};"
  );
`;

source = replaceRequired(
  source,
  "  return html;\n}\n\nconst server = http.createServer",
  frontendInjection + "\n  return html;\n}\n\nconst server = http.createServer",
  'inject lobby category frontend'
);

source = source.replace(/4\.3\.0/g, '4.4.0').replace(/v4\.3/g, 'v4.4').replace(/SueffIQ\/4\.3/g, 'SueffIQ/4.4');
fs.writeFileSync(runtimePath, source, 'utf8');

const child = spawn(process.execPath, [runtimePath], { env: process.env, stdio: 'inherit' });
child.on('exit', (code) => {
  try { fs.unlinkSync(runtimePath); } catch {}
  process.exit(code == null ? 0 : code);
});

function shutdown(signal) {
  try { child.kill(signal); } catch {}
  setTimeout(() => process.exit(0), 1800).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
