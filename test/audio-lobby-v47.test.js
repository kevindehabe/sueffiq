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
test.before(async()=>{child=spawn(process.execPath,['server-v3.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(PORT),CI:'true'},stdio:['ignore','ignore','pipe']});const h=await waitHealth();assert.equal(h.ok,true);assert.equal(h.version,'4.7.0');assert.equal(h.songSource,'youtube');assert.equal(h.youtubePlayback,true);assert.equal(h.ruleRounds,false);});
test.after(async()=>{if(child&&!child.killed)child.kill('SIGTERM');await sleep(150);});

test('generated inline browser scripts are syntactically valid and keep minigame runtime helpers',async()=>{const html=await(await fetch(`${HTTP}/`)).text();const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m)=>m[1]).filter((s)=>s.trim());assert.ok(scripts.length>0);scripts.forEach((source,index)=>assert.doesNotThrow(()=>new vm.Script(source,{filename:`generated-inline-${index}.js`}),`inline script ${index} must parse`));assert.match(html,/function isMiniRound\(cur\)/);assert.match(html,/function resetMiniLocal\(\)/);assert.ok(html.indexOf('function resetMiniLocal()')<html.indexOf('var v47ResetMiniLocal=resetMiniLocal'),'base minigame reset helper must exist before the v4.7 wrapper');});

test('YouTube audio is prepared persistently and unlocked through create/join without a visible lobby sound button',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/globalYTPlayer/);assert.match(html,/https:\/\/www\.youtube\.com\/iframe_api/);assert.match(html,/silentUnlockGameAudio/);assert.match(html,/v51BindLanding/);assert.match(html,/hook\(c\);hook\(j\)/);assert.match(html,/songStartedAt/);assert.match(html,/playSyncedSong/);assert.doesNotMatch(html,/id=\"lobbySound\"/);assert.doesNotMatch(html,/ITUNES_SILENCE/);assert.doesNotMatch(html,/iTunes-Preview/);const health=await(await fetch(`${HTTP}/health`)).json();assert.equal(health.songSource,'youtube');assert.equal(health.youtubePlayback,true);});

test('person images remain uncropped while old party-rule UI is absent',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/object-fit:contain!important/);assert.match(html,/object-position:center center!important/);assert.doesNotMatch(html,/id=['\"]partyRuleDock['\"]/);assert.doesNotMatch(html,/partyRuleRoundHtml/);assert.doesNotMatch(html,/Eigene Regelrunde/);assert.doesNotMatch(html,/partyRuleSeen/);assert.doesNotMatch(html,/partyRuleContinue/);});

test('Zeitgefühl and logo guessing are present as interactive minigames',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/blindTimerAction/);assert.match(html,/miniTimerStart/);assert.match(html,/miniTimerStop/);assert.match(html,/logoGuessInput/);assert.match(html,/miniLogoGuess/);assert.match(html,/Erkenne das Logo/);assert.match(html,/Während er läuft siehst du keine Zeit/);});
