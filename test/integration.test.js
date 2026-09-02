'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const PORT = 39000 + Math.floor(Math.random() * 1000);
const INTERNAL_PORT = PORT + 2000;
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
let child;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  const deadline = Date.now() + 12000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${HTTP}/health`);
      if (res.ok) return res.json();
    } catch (e) { lastError = e; }
    await sleep(150);
  }
  throw lastError || new Error('server did not become healthy');
}

class Client {
  constructor() {
    this.ws = null;
    this.queue = [];
    this.waiters = [];
  }
  async open() {
    this.ws = new WebSocket(WS);
    await new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      const idx = this.waiters.findIndex((w) => {
        try { return w.predicate(msg); } catch { return false; }
      });
      if (idx >= 0) {
        const w = this.waiters.splice(idx, 1)[0];
        clearTimeout(w.timer);
        w.resolve(msg);
      } else this.queue.push(msg);
    });
    return this;
  }
  send(payload) { this.ws.send(JSON.stringify(payload)); }
  waitFor(predicate, timeout = 4000) {
    const idx = this.queue.findIndex((msg) => {
      try { return predicate(msg); } catch { return false; }
    });
    if (idx >= 0) return Promise.resolve(this.queue.splice(idx, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const i = this.waiters.indexOf(waiter);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error('timed out waiting for websocket message'));
      }, timeout);
      this.waiters.push(waiter);
    });
  }
  state(predicate = () => true, timeout = 4000) {
    return this.waitFor((m) => m.t === 'state' && predicate(m.s), timeout).then((m) => m.s);
  }
  async close() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      this.ws.once('close', resolve);
      this.ws.close();
      setTimeout(resolve, 500).unref();
    });
  }
}

test.before(async () => {
  child = spawn(process.execPath, ['server-v3.js'], {
    cwd: require('node:path').join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), SUEFFIQ_INTERNAL_PORT: String(INTERNAL_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += String(d); });
  child.once('exit', (code) => {
    if (code && stderr) process.stderr.write(stderr);
  });
  const health = await waitForServer();
  assert.equal(health.ok, true);
});

test.after(async () => {
  if (child && !child.killed) child.kill('SIGTERM');
  await sleep(250);
});

test('HTTP shell is mobile-ready and health endpoint works', async () => {
  const health = await (await fetch(`${HTTP}/health`)).json();
  assert.equal(health.ok, true);
  assert.match(String(health.version), /^4\./);

  const html = await (await fetch(`${HTTP}/`)).text();
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /SüffIQ/);
  assert.match(html, /Kategorien/);
});

test('lobby supports category selection, play, rejoin, host transfer and leave', async () => {
  const host = await new Client().open();
  host.send({ t: 'create', name: 'Host' });
  const hostJoined = await host.waitFor((m) => m.t === 'joined');
  let hostState = await host.state((s) => s.phase === 'lobby');
  assert.equal(hostState.you, hostJoined.id);
  assert.equal(hostState.hostId, hostJoined.id);
  assert.ok(Array.isArray(hostState.selectedCats));
  assert.ok(hostState.selectedCats.includes('song'));
  assert.ok(hostState.selectedCats.includes('schaetz'));

  const guest = await new Client().open();
  guest.send({ t: 'join', name: 'Gast', code: hostJoined.code });
  const guestJoined = await guest.waitFor((m) => m.t === 'joined');
  await guest.state((s) => s.phase === 'lobby' && s.players.filter((p) => p.connected).length === 2);
  hostState = await host.state((s) => s.players.filter((p) => p.connected).length === 2);

  const allCats = Object.keys(hostState.cats);
  for (const cat of allCats.filter((x) => x !== 'schaetz')) {
    host.send({ t: 'toggleCat', cat });
    hostState = await host.state((s) => Array.isArray(s.selectedCats) && !s.selectedCats.includes(cat));
  }
  assert.deepEqual(hostState.selectedCats, ['schaetz']);

  host.send({ t: 'toggleCat', cat: 'schaetz' });
  const minError = await host.waitFor((m) => m.t === 'error');
  assert.match(minError.m, /Mindestens eine Kategorie/);

  host.send({ t: 'start' });
  const qHost = await host.state((s) => s.phase === 'question' && s.current && s.current.type === 'schaetz', 7000);
  await guest.state((s) => s.phase === 'question' && s.current && s.current.type === 'schaetz', 7000);
  assert.match(qHost.current.text, /Antwort in /);

  host.send({ t: 'answer', v: '1' });
  guest.send({ t: 'answer', v: '2' });
  await host.state((s) => s.phase === 'results');
  await guest.state((s) => s.phase === 'results');

  host.send({ t: 'end' });
  await host.state((s) => s.phase === 'end');
  guest.queue = [];

  host.send({ t: 'allCats' });
  hostState = await host.state((s) => s.phase === 'end' && s.selectedCats.length === Object.keys(s.cats).length);
  assert.equal(hostState.selectedCats.length, allCats.length);

  // Rejoin after a real socket disconnect.
  await guest.close();
  await host.state((s) => s.players.some((p) => p.id === guestJoined.id && !p.connected));
  const guest2 = await new Client().open();
  guest2.send({ t: 'rejoin', code: hostJoined.code, id: guestJoined.id });
  await guest2.waitFor((m) => m.t === 'joined' && m.id === guestJoined.id);
  await guest2.state((s) => s.players.some((p) => p.id === guestJoined.id && p.connected));
  await host.state((s) => s.players.some((p) => p.id === guestJoined.id && p.connected));

  // Host transfer is deliberately a lobby-only action, so use a fresh room.
  await host.close();
  await guest2.close();

  const a = await new Client().open();
  a.send({ t: 'create', name: 'A' });
  const aJoin = await a.waitFor((m) => m.t === 'joined');
  await a.state((s) => s.phase === 'lobby');
  const b = await new Client().open();
  b.send({ t: 'join', name: 'B', code: aJoin.code });
  const bJoin = await b.waitFor((m) => m.t === 'joined');
  await b.state((s) => s.phase === 'lobby');
  await a.state((s) => s.players.filter((p) => p.connected).length === 2);

  a.send({ t: 'host', id: bJoin.id });
  await a.state((s) => s.hostId === bJoin.id);
  await b.state((s) => s.hostId === bJoin.id);

  b.send({ t: 'leave' });
  await b.waitFor((m) => m.t === 'reset');
  const aAfterLeave = await a.state((s) => s.hostId === aJoin.id);
  assert.equal(aAfterLeave.hostId, aJoin.id);

  await a.close();
  await b.close();
});
