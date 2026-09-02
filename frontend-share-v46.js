'use strict';

function mustReplace(html, needle, replacement, label) {
  if (!html.includes(needle)) throw new Error(`Share-Frontend-Patch fehlt: ${label}`);
  return html.replace(needle, replacement);
}

module.exports = function addShareFrontend(html) {
  html = mustReplace(
    html,
    '</style>',
    '.invite-box{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.invite-link{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--line);border-radius:12px;padding:11px 12px;color:var(--muted);font-size:11px;background:#100b18}.share-btn{width:auto!important;min-width:112px}.master-btn{border:1px solid rgba(184,255,74,.25);background:rgba(184,255,74,.06);color:var(--accent);border-radius:9px;padding:6px 8px;font-size:10px;font-weight:900}.presence-actions{display:flex;align-items:center;gap:7px}@media(max-width:430px){.invite-box{grid-template-columns:1fr}.share-btn{width:100%!important}}</style>',
    'share css'
  );

  html = mustReplace(
    html,
    "function bindLanding(){\n  document.getElementById('create').onclick=function(){",
    "function inviteCodeFromUrl(){try{return String(new URLSearchParams(location.search).get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);}catch(e){return '';}}\nfunction bindLanding(){\n  var invited=inviteCodeFromUrl(),codeEl=document.getElementById('code');if(invited.length===5&&codeEl){codeEl.value=invited;var nameEl=document.getElementById('name');if(nameEl)nameEl.focus();}\n  document.getElementById('create').onclick=function(){",
    'invite prefill'
  );

  html = mustReplace(
    html,
    '<div class=\\\"note\\\">Mitspieler öffnen dieselbe Seite und geben diesen Code ein.</div></div><div class=\\\"section\\\">Kategorien</div>',
    '<div class=\\\"note\\\">Mitspieler können den Code eingeben oder direkt deinen Einladungslink öffnen.</div><div class=\\\"invite-box\\\"><div id=\\\"inviteLink\\\" class=\\\"invite-link\\\">'+esc(location.origin+'/?room='+state.code)+'</div><button id=\\\"shareInvite\\\" class=\\\"btn secondary share-btn\\\">Einladen</button></div></div><div class=\\\"section\\\">Kategorien</div>',
    'lobby invite button'
  );

  html = mustReplace(
    html,
    "function presenceHtml(){var out='<div class=\"presence\">',i,p;for(i=0;i<state.players.length;i++){p=state.players[i];out+='<div class=\"presence-row\"><span class=\"presence-name\">'+esc(p.name)+(p.id===state.hostId?' 👑':'')+'</span><span class=\"presence-state '+(p.connected?'online':'offline')+'\"><span class=\"presence-dot\"></span>'+(p.connected?'noch dabei':'verbindung weg')+'</span></div>';}return out+'</div>';}",
    "function presenceHtml(){var out='<div class=\"presence\">',i,p,master=state.you===state.hostId;for(i=0;i<state.players.length;i++){p=state.players[i];out+='<div class=\"presence-row\"><span class=\"presence-name\">'+esc(p.name)+(p.id===state.hostId?' 👑':'')+'</span><span class=\"presence-actions\"><span class=\"presence-state '+(p.connected?'online':'offline')+'\"><span class=\"presence-dot\"></span>'+(p.connected?'noch dabei':'verbindung weg')+'</span>'+(master&&p.connected&&p.id!==state.you?'<button class=\"master-btn\" data-master=\"'+esc(p.id)+'\">Master geben</button>':'')+'</span></div>';}return out+'</div>';}"
  );

  html = mustReplace(
    html,
    "  var allCats=document.getElementById('allCats');if(allCats)allCats.onclick=function(){send({t:'allCats'});};",
    "  var shareInvite=document.getElementById('shareInvite');if(shareInvite)shareInvite.onclick=function(){var url=location.origin+'/?room='+state.code,text='Komm in meine SüffIQ-Lobby · Code '+state.code;if(navigator.share){navigator.share({title:'SüffIQ',text:text,url:url}).catch(function(){});}else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){toast('Einladungslink kopiert ✓');}).catch(function(){toast(url);});}else{toast(url);}};\n  var masterBtns=document.querySelectorAll('.master-btn');for(i=0;i<masterBtns.length;i++)masterBtns[i].onclick=function(){send({t:'host',id:this.getAttribute('data-master')});};\n  var allCats=document.getElementById('allCats');if(allCats)allCats.onclick=function(){send({t:'allCats'});};",
    'share/master bind'
  );

  return html;
};
