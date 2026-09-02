'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const PORT = 50300 + Math.floor(Math.random() * 300);
const HTTP = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let child;
async function waitHealth(){const end=Date.now()+15000;while(Date.now()<end){try{const r=await fetch(`${HTTP}/health`);if(r.ok)return r.json();}catch{}await sleep(100);}throw new Error('server start timeout');}
test.before(async()=>{child=spawn(process.execPath,['server-v3.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(PORT),CI:'true'},stdio:['ignore','ignore','pipe']});const h=await waitHealth();assert.equal(h.ok,true);assert.equal(h.version,'4.7.0');assert.equal(h.songSource,'itunes');assert.equal(h.youtubePlayback,false);});
test.after(async()=>{if(child&&!child.killed)child.kill('SIGTERM');await sleep(150);});

test('generated inline browser scripts are syntactically valid and keep minigame runtime helpers',async()=>{const html=await(await fetch(`${HTTP}/`)).text();const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m)=>m[1]).filter((s)=>s.trim());assert.ok(scripts.length>0);scripts.forEach((source,index)=>assert.doesNotThrow(()=>new vm.Script(source,{filename:`generated-inline-${index}.js`}),`inline script ${index} must parse`));assert.match(html,/function isMiniRound\(cur\)/);assert.match(html,/function resetMiniLocal\(\)/);assert.ok(html.indexOf('function resetMiniLocal()')<html.indexOf('var v47ResetMiniLocal=resetMiniLocal'),'base minigame reset helper must exist before the v4.7 wrapper');});

test('song audio is mounted persistently and has a mobile playback fallback',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/ITUNES_SILENCE/);assert.match(html,/primeITunesAudio/);assert.match(html,/prepareITunesSong/);assert.match(html,/id='sueffiqSongAudio'/);assert.match(html,/document\.body\.appendChild\(itunesAudio\)/);assert.match(html,/id=\"itunesEnable\"/);assert.match(html,/Jetzt Ton starten/);assert.match(html,/songStartedAt/);assert.match(html,/iTunes-Preview/);assert.doesNotMatch(html,/id=\"lobbySound\"/);assert.doesNotMatch(html,/globalYTPlayer/);assert.doesNotMatch(html,/https:\/\/www\.youtube\.com\/iframe_api/);const health=await(await fetch(`${HTTP}/health`)).json();assert.equal(health.songProxy,true);});

test('person images are uncropped and activated rules stay fixed above the game',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/object-fit:contain!important/);assert.match(html,/object-position:center center!important/);assert.match(html,/\.party-rule-dock\{position:fixed;top:0;left:0;right:0/);assert.match(html,/id='partyRuleDock'/);assert.match(html,/activePartyRules/);assert.match(html,/s&&Array\.isArray\(s\.activeRules\)/);});

test('rules have a dedicated seen/continue round and visibly announce expiry',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/partyRuleRoundHtml/);assert.match(html,/Eigene Regelrunde/);assert.match(html,/id=\"partyRuleSeen\"/);assert.match(html,/id=\"partyRuleContinue\"/);assert.match(html,/Mit Weiter wird die Regel oben angepinnt/);assert.match(html,/showPartyRuleEnded/);assert.match(html,/Regel aufgehoben/);assert.match(html,/zählt ab jetzt nicht mehr/);assert.match(html,/party-rule-ended/);assert.doesNotMatch(html,/PARTY_EVENTS=\[/);assert.doesNotMatch(html,/currentPartyEvent/);assert.doesNotMatch(html,/⚡ EVENT/);});
