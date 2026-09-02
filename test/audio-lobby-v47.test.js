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

test('generated inline browser scripts are syntactically valid',async()=>{const html=await(await fetch(`${HTTP}/`)).text();const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m)=>m[1]).filter((s)=>s.trim());assert.ok(scripts.length>0);scripts.forEach((source,index)=>assert.doesNotThrow(()=>new vm.Script(source,{filename:`generated-inline-${index}.js`}),`inline script ${index} must parse`));});

test('song audio uses a persistent HTML5 audio element and no visible sound activation button',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/ITUNES_SILENCE/);assert.match(html,/primeITunesAudio/);assert.match(html,/prepareITunesSong/);assert.match(html,/previewUrl/);assert.match(html,/iTunes-Preview/);assert.doesNotMatch(html,/id=\"lobbySound\"/);assert.doesNotMatch(html,/Spielton aktivieren/);assert.doesNotMatch(html,/globalYTPlayer/);assert.doesNotMatch(html,/https:\/\/www\.youtube\.com\/iframe_api/);});

test('person images are shown uncropped and rules stay fixed above the game',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/object-fit:contain!important/);assert.match(html,/object-position:center center!important/);assert.match(html,/\.party-rule-dock\{position:fixed;top:0;left:0;right:0/);assert.match(html,/id='partyRuleDock'/);assert.match(html,/PARTY_RULES=\[/);assert.match(html,/activePartyRules/);});

test('rules start pseudo-randomly, expire after at most ten rounds and visibly announce when they stop counting',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/PARTY_RULE_MAX_ROUNDS=10/);assert.match(html,/PARTY_RULE_CHANCE=28/);assert.match(html,/partyRuleStarts/);assert.match(html,/regel-start/);assert.match(html,/r-PARTY_RULE_MAX_ROUNDS\+1/);assert.match(html,/showPartyRuleEnded/);assert.match(html,/Regel aufgehoben/);assert.match(html,/zählt ab jetzt nicht mehr/);assert.match(html,/party-rule-ended/);assert.doesNotMatch(html,/PARTY_EVENTS=\[/);assert.doesNotMatch(html,/currentPartyEvent/);assert.doesNotMatch(html,/⚡ EVENT/);assert.doesNotMatch(html,/x\+=3/);});
