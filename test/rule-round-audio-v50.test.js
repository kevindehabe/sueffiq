'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 50800 + Math.floor(Math.random() * 250);
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let child;

class Client {
  constructor() { this.ws = null; this.queue = []; this.waiters = []; }
  async open() {
    this.ws = new WebSocket(WS);
    await new Promise((resolve, reject) => { this.ws.once('open', resolve); this.ws.once('error', reject); });
    this.ws.on('message', (raw) => {
      const message = JSON.parse(String(raw));
      const index = this.waiters.findIndex((waiter) => { try { return waiter.predicate(message); } catch { return false; } });
      if (index < 0) this.queue.push(message);
      else { const waiter = this.waiters.splice(index, 1)[0]; clearTimeout(waiter.timer); waiter.resolve(message); }
    });
    return this;
  }
  send(payload) { this.ws.send(JSON.stringify(payload)); }
  wait(predicate, timeout = 7000) {
    const index = this.queue.findIndex((message) => { try { return predicate(message); } catch { return false; } });
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => { const at = this.waiters.indexOf(waiter); if (at >= 0) this.waiters.splice(at, 1); reject(new Error('websocket timeout')); }, timeout);
      this.waiters.push(waiter);
    });
  }
  state(predicate = () => true, timeout = 7000) { return this.wait((message) => message.t === 'state' && predicate(message.s), timeout).then((message) => message.s); }
  async close() { if (this.ws && this.ws.readyState < WebSocket.CLOSING) this.ws.close(); await sleep(40); }
}

async function waitHealth() {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    try { const response = await fetch(`${HTTP}/health`); if (response.ok) return response.json(); } catch {}
    await sleep(100);
  }
  throw new Error('server start timeout');
}

async function onlyCategory(host, state, wanted) {
  let current = state;
  for (const category of [...current.selectedCats]) {
    if (category === wanted) continue;
    host.send({ t: 'toggleCat', cat: category });
    current = await host.state((next) => !next.selectedCats.includes(category));
  }
  assert.deepEqual(current.selectedCats, [wanted]);
  return current;
}

test.before(async () => {
  child = spawn(process.execPath, ['server-v3.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), CI: 'true', SUEFFIQ_FORCE_RULES: 'true' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (data) => { stderr += String(data); });
  child.once('exit', (code) => { if (code && stderr) process.stderr.write(stderr); });
  const health = await waitHealth();
  assert.equal(health.ok, true);
  assert.equal(health.ruleRounds, true);
  assert.equal(health.songProxy, true);
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(150); });

test('everyone acknowledges a standalone rule round before the host continues', async () => {
  const host = await new Client().open();
  host.send({ t: 'create', name: 'Host' });
  const hostJoined = await host.wait((message) => message.t === 'joined');
  let hostState = await host.state((state) => state.phase === 'lobby');

  const guest = await new Client().open();
  guest.send({ t: 'join', code: hostJoined.code, name: 'Gast' });
  await guest.wait((message) => message.t === 'joined');
  await guest.state((state) => state.phase === 'lobby' && state.players.filter((player) => player.connected).length === 2);
  hostState = await host.state((state) => state.phase === 'lobby' && state.players.filter((player) => player.connected).length === 2);
  hostState = await onlyCategory(host, hostState, 'schaetz');

  host.send({ t: 'start' });
  const hostRule = await host.state((state) => state.phase === 'rule');
  const guestRule = await guest.state((state) => state.phase === 'rule');
  assert.equal(hostRule.round, 0);
  assert.equal(hostRule.current, null);
  assert.equal(hostRule.activeRules.length, 0);
  assert.equal(hostRule.ruleRound.total, 2);
  assert.equal(hostRule.ruleRound.allSeen, false);
  assert.equal(guestRule.ruleRound.id, hostRule.ruleRound.id);
  host.send({ t: 'ruleContinue' });
  const blocked = await host.wait((message) => message.t === 'error');
  assert.match(blocked.m, /alle die Regel gesehen/);

  guest.send({ t: 'ruleSeen' });
  await guest.state((state) => state.phase === 'rule' && state.ruleRound.youSeen && state.ruleRound.seenCount === 1);
  await host.state((state) => state.phase === 'rule' && state.ruleRound.seenCount === 1);

  host.send({ t: 'ruleSeen' });
  const readyHost = await host.state((state) => state.phase === 'rule' && state.ruleRound.allSeen);
  await guest.state((state) => state.phase === 'rule' && state.ruleRound.allSeen);
  assert.equal(readyHost.ruleRound.seenCount, 2);

  host.send({ t: 'ruleContinue' });
  const questionHost = await host.state((state) => state.phase === 'question' && state.current?.type === 'schaetz');
  const questionGuest = await guest.state((state) => state.phase === 'question' && state.current?.type === 'schaetz');
  assert.equal(questionHost.round, 1);
  assert.equal(questionHost.ruleRound, null);
  assert.equal(questionHost.activeRules.length, 1);
  assert.equal(questionHost.activeRules[0].id, hostRule.ruleRound.id);
  assert.equal(questionHost.activeRules[0].text, hostRule.ruleRound.text);
  assert.equal(questionHost.activeRules[0].expiresRound - questionHost.activeRules[0].startRound + 1, 10);
  assert.deepEqual(questionGuest.activeRules, questionHost.activeRules);

  host.send({ t: 'answer', v: '1' });
  guest.send({ t: 'answer', v: '2' });
  const result = await host.state((state) => state.phase === 'results');
  assert.equal(result.activeRules.length, 1);

  await host.close();
  await guest.close();
});

test('song rounds expose a same-origin playable preview and synchronize that URL', async () => {
  const host = await new Client().open();
  host.send({ t: 'create', name: 'DJ' });
  const joined = await host.wait((message) => message.t === 'joined');
  let state = await host.state((next) => next.phase === 'lobby');
  state = await onlyCategory(host, state, 'song');

  host.send({ t: 'start' });
  await host.state((next) => next.phase === 'rule');
  host.send({ t: 'ruleSeen' });
  await host.state((next) => next.phase === 'rule' && next.ruleRound.allSeen);
  host.send({ t: 'ruleContinue' });
  const song = await host.state((next) => next.phase === 'question' && next.current?.type === 'song');
  assert.equal(song.code, joined.code);
  assert.match(song.current.previewUrl, new RegExp(`^/api/song-preview/${joined.code}/1$`));

  const preview = await fetch(`${HTTP}${song.current.previewUrl}`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-type') || '', /^audio\/wav/);
  assert.ok((await preview.arrayBuffer()).byteLength > 20);

  host.send({ t: 'songPlay' });
  const play = await host.wait((message) => message.t === 'songPlay');
  assert.equal(play.previewUrl, song.current.previewUrl);
  assert.ok(play.at > Date.now());
  const playing = await host.state((next) => next.phase === 'question' && Number(next.current?.songStartedAt) === play.at);
  assert.equal(playing.current.previewUrl, song.current.previewUrl);

  await host.close();
});
