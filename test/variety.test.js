'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 42000 + Math.floor(Math.random() * 1000);
const INTERNAL_PORT = PORT + 2000;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}`;
let child;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class C {
  constructor() { this.q = []; this.waiters = []; this.ws = null; }
  async open() {
    this.ws = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => { this.ws.once('open', resolve); this.ws.once('error', reject); });
    this.ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      const i = this.waiters.findIndex((w) => { try { return w.p(m); } catch { return false; } });
      if (i >= 0) { const w = this.waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(m); }
      else this.q.push(m);
    });
    return this;
  }
  send(x) { this.ws.send(JSON.stringify(x)); }
  wait(p, timeout = 5000) {
    const i = this.q.findIndex((m) => { try { return p(m); } catch { return false; } });
    if (i >= 0) return Promise.resolve(this.q.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = { p, resolve, timer: null };
      w.timer = setTimeout(() => { const j = this.waiters.indexOf(w); if (j >= 0) this.waiters.splice(j, 1); reject(new Error('ws timeout')); }, timeout);
      this.waiters.push(w);
    });
  }
  state(p = () => true, timeout = 5000) { return this.wait((m) => m.t === 'state' && p(m.s), timeout).then((m) => m.s); }
  async close() { if (!this.ws || this.ws.readyState >= 2) return; this.ws.close(); await sleep(40); }
}

async function waitHealth() {
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) return r.json(); } catch {}
    await sleep(120);
  }
  throw new Error('server did not start');
}

async function createRoom(name = 'Host') {
  const host = await new C().open();
  host.send({ t: 'create', name });
  const joined = await host.wait((m) => m.t === 'joined');
  const state = await host.state((s) => s.phase === 'lobby');
  return { host, joined, state };
}

async function joinRoom(code, name) {
  const c = await new C().open();
  c.send({ t: 'join', code, name });
  const joined = await c.wait((m) => m.t === 'joined');
  await c.state((s) => s.phase === 'lobby');
  return { c, joined };
}

async function isolate(host, state, keep) {
  let s = state;
  for (const cat of Object.keys(s.cats).filter((x) => x !== keep)) {
    host.send({ t: 'toggleCat', cat });
    s = await host.state((n) => Array.isArray(n.selectedCats) && !n.selectedCats.includes(cat));
  }
  assert.deepEqual(s.selectedCats, [keep]);
  return s;
}

test.before(async () => {
  child = spawn(process.execPath, ['server-v3.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), SUEFFIQ_INTERNAL_PORT: String(INTERNAL_PORT) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => { err += String(d); });
  child.once('exit', (code) => { if (code && err) process.stderr.write(err); });
  const h = await waitHealth();
  assert.equal(h.ok, true);
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(200); });

test('no-repeat estimates, synchronized song event and 16-player fanout', async () => {
  // 15 estimate rounds must not repeat a card while the pool still has unused cards.
  {
    const { host, state } = await createRoom('NoRepeat');
    await isolate(host, state, 'schaetz');
    const seen = new Set();
    host.send({ t: 'start' });
    for (let round = 0; round < 15; round += 1) {
      const q = await host.state((s) => s.phase === 'question' && s.current && s.current.type === 'schaetz');
      assert.ok(!seen.has(q.current.text), `estimate repeated before pool exhaustion: ${q.current.text}`);
      seen.add(q.current.text);
      assert.match(q.current.text, /Antwort in /);
      host.send({ t: 'answer', v: String(round + 1) });
      await host.state((s) => s.phase === 'results');
      if (round < 14) host.send({ t: 'next' });
    }
    assert.equal(seen.size, 15);
    await host.close();
  }

  // The host's single play action must fan out one identical future timestamp and song to every device.
  {
    const { host, joined, state } = await createRoom('DJ');
    const guest = await joinRoom(joined.code, 'Listener');
    await host.state((s) => s.players.filter((p) => p.connected).length === 2);
    await isolate(host, state, 'song');
    host.send({ t: 'start' });
    await host.state((s) => s.phase === 'question' && s.current && s.current.type === 'song');
    await guest.c.state((s) => s.phase === 'question' && s.current && s.current.type === 'song');
    const before = Date.now();
    host.send({ t: 'songPlay' });
    const [a, b] = await Promise.all([
      host.wait((m) => m.t === 'songPlay'),
      guest.c.wait((m) => m.t === 'songPlay'),
    ]);
    assert.equal(a.videoId, b.videoId);
    assert.equal(a.startSeconds, b.startSeconds);
    assert.equal(a.at, b.at);
    assert.ok(a.at >= before + 800 && a.at <= Date.now() + 2500, `unexpected sync timestamp ${a.at}`);
    host.send({ t: 'end' });
    await host.close(); await guest.c.close();
  }

  // Party-size smoke test: 16 concurrent players receive state and can finish a round together.
  {
    const { host, joined, state } = await createRoom('LoadHost');
    const guests = [];
    for (let i = 0; i < 15; i += 1) guests.push(await joinRoom(joined.code, `P${i + 1}`));
    await host.state((s) => s.players.filter((p) => p.connected).length === 16, 8000);
    await isolate(host, state, 'nie');
    host.send({ t: 'start' });
    await host.state((s) => s.phase === 'question' && s.current && s.current.type === 'nie');
    host.send({ t: 'answer', v: 'nein' });
    for (const g of guests) g.c.send({ t: 'answer', v: 'nein' });
    const result = await host.state((s) => s.phase === 'results', 8000);
    assert.equal(result.players.filter((p) => p.connected).length, 16);
    await host.close();
    for (const g of guests) await g.c.close();
  }
});
