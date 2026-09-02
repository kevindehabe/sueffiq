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

  const helpers = `
function shareInviteLink(){if(!state||!state.code)return;var url=location.origin+'/?room='+state.code,text='Komm in meine SüffIQ-Lobby · Code '+state.code;if(navigator.share){navigator.share({title:'SüffIQ',text:text,url:url}).catch(function(){});return;}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){toast('Einladungslink kopiert ✓');}).catch(function(){toast(url);});return;}toast(url);}
function setupShareMasterUI(){
  if(!state)return;
  if(state.phase==='lobby'){
    var code=document.querySelector('.big-code');var card=code&&code.parentElement;
    if(card&&!document.getElementById('shareInvite')){var box=document.createElement('div');box.className='invite-box';box.innerHTML='<div class="invite-link">'+esc(location.origin+'/?room='+state.code)+'</div><button id="shareInvite" class="btn secondary share-btn">Einladen</button>';card.appendChild(box);var share=document.getElementById('shareInvite');if(share)share.onclick=shareInviteLink;}
  }
  if(state.you===state.hostId&&(state.phase==='results'||state.phase==='end')){
    var rows=document.querySelectorAll('.presence-row');for(var i=0;i<rows.length&&i<state.players.length;i++){var p=state.players[i];if(!p.connected||p.id===state.you||rows[i].querySelector('.master-btn'))continue;var b=document.createElement('button');b.className='master-btn';b.textContent='Master geben';b.setAttribute('data-master',p.id);b.onclick=function(){send({t:'host',id:this.getAttribute('data-master')});};rows[i].appendChild(b);}
  }
}
`;

  html = mustReplace(html, 'function bind(){', helpers + '\nfunction bind(){', 'share helpers');
  html = mustReplace(html, '  bindMiniGame();\n}', '  bindMiniGame();setupShareMasterUI();\n}', 'share/master setup');
  return html;
};
