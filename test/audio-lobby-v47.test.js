'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const PORT = 50300 + Math.floor(Math.random() * 300);
const HTTP = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let child;
async function waitHealth(){const end=Date.now()+15000;while(Date.now()<end){try{const r=await fetch(`${HTTP}/health`);if(r.ok)return r.json();}catch{}await sleep(100);}throw new Error('server start timeout');}
test.before(async()=>{child=spawn(process.execPath,['server-v3.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(PORT)},stdio:['ignore','ignore','pipe']});const h=await waitHealth();assert.equal(h.ok,true);assert.equal(h.version,'4.7.0');});
test.after(async()=>{if(child&&!child.killed)child.kill('SIGTERM');await sleep(150);});
test('song audio is primed once from the lobby and uses a persistent YouTube player',async()=>{const html=await(await fetch(`${HTTP}/`)).text();assert.match(html,/id=\"lobbySound\"/);assert.match(html,/Spielton aktivieren/);assert.match(html,/globalYTPlayer/);assert.match(html,/prepareLobbyAudio/);assert.doesNotMatch(html,/songAudioUnlocked=false;lastSongSyncKey=null;resetMiniLocal/);});
