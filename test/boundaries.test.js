'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 49500 + Math.floor(Math.random() * 300);
const INTERNAL_PORT = PORT + 600;
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let child;

class Client {
  constructor() { this.q = []; this.waiters = []; this.ws = null; }
  async open() {
    this.ws = new WebSocket(WS);
    await new Promise((resolve, reject) => { this.ws.once('open', resolve); this.ws.once('error', reject); });
    this.ws.on('message', (raw) => {
      let m; try { m = JSON.parse(String(raw)); } catch { return; }
      const i = this.waiters.findIndex((w) => { try { return w.p(m); } catch { return false; } });
      if (i >= 0) { const w = this.waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(m); }
      else this.q.push(m);
    });
    return this;
  }
  send(x) { this.ws.send(JSON.stringify(x)); }
  raw(x) { this.ws.send(x); }
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
  async close() {
    if (!this.ws || this.ws.readyState >= WebSocket.CLOSING) return;
    this.ws.close();
    await sleep(25);
  }
}

async function waitHealth() {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try { const r = await fetch(`${HTTP}/health`); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  throw new Error('server start timeout');
}

async function create(name = 'Host') {
  const c = await new Client().open();
  c.send({ t: 'create', name });
  const joined = await c.wait((m) => m.t === 'joined');
  const state = await c.state((s) => s.phase === 'lobby');
  return { c, joined, state };
}

async function join(code, name) {
  const c = await new Client().open();
  c.send({ t: 'join', code, name });
  const joined = await c.wait((m) => m.t === 'joined');
  await c.state((s) => s.phase === 'lobby');
  return { c, joined };
}

async function isolate(host, state, keep) {
  let s = state;
  for (const cat of [...s.selectedCats]) {
    if (cat === keep) continue;
    host.send({ t: 'toggleCat', cat });
    s = await host.state((x) => Array.isArray(x.selectedCats) && !x.selectedCats.includes(cat));
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
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += String(d); });
  child.once('exit', (code) => { if (code && stderr) process.stderr.write(stderr); });
  const h = await waitHealth();
  assert.equal(h.ok, true);
  assert.equal(h.version, '4.5.0');
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(200); });

test('one socket cannot create or join a second room', async () => {
  const { c, joined } = await create('SingleSession');
  c.send({ t: 'create', name: 'LeakedRoom' });
  assert.match((await c.wait((m) => m.t === 'error')).m, /bereits in einer Lobby/);

  c.send({ t: 'join', code: joined.code, name: 'Duplicate' });
  assert.match((await c.wait((m) => m.t === 'error')).m, /bereits in einer Lobby/);

  c.send({ t: 'allCats' });
  const s = await c.state((x) => x.code === joined.code);
  assert.equal(s.code, joined.code);
  await c.close();
});

test('explicit leave removes the player and invalidates rejoin', async () => {
  const { c: host, joined: room } = await create('LeaveHost');
  const guest = await join(room.code, 'LeaveGuest');
  await host.state((s) => s.players.filter((p) => p.connected).length === 2);

  guest.c.send({ t: 'leave' });
  await guest.c.wait((m) => m.t === 'reset');
  const after = await host.state((s) => !s.players.some((p) => p.id === guest.joined.id));
  assert.ok(!after.players.some((p) => p.id === guest.joined.id));

  const retry = await new Client().open();
  retry.send({ t: 'rejoin', code: room.code, id: guest.joined.id });
  await retry.wait((m) => m.t === 'reset');

  await retry.close(); await guest.c.close(); await host.close();
});

test('truth target leaving mid-round is immediately retargeted', async () => {
  const { c: host, joined: room, state } = await create('TruthHost');
  const g1 = await join(room.code, 'TruthA');
  const g2 = await join(room.code, 'TruthB');
  await host.state((s) => s.players.filter((p) => p.connected).length === 3);
  await isolate(host, state, 'wahrheit');

  host.send({ t: 'start' });
  const q = await host.state((s) => s.phase === 'question' && s.current?.type === 'wahrheit');
  const clients = new Map([[room.id, host], [g1.joined.id, g1.c], [g2.joined.id, g2.c]]);
  const leavingId = q.current.target;
  const leaving = clients.get(leavingId);
  assert.ok(leaving, 'truth target did not map to a connected client');

  leaving.send({ t: 'leave' });
  await leaving.wait((m) => m.t === 'reset');
  clients.delete(leavingId);
  const observer = [...clients.values()][0];
  const after = await observer.state((s) => s.phase === 'question' && s.current?.type === 'wahrheit' && s.current.target !== leavingId);
  assert.ok(clients.has(after.current.target), 'truth round was not retargeted to a remaining player');
  assert.ok(!after.players.some((p) => p.id === leavingId), 'leaving target still exists in room state');

  clients.get(after.current.target).send({ t: 'answer', v: 'done' });
  await observer.state((s) => s.phase === 'results');

  for (const c of clients.values()) await c.close();
});

test('host network loss during a question transfers control and allows rejoin', async () => {
  const { c: host, joined: room, state } = await create('DropHost');
  const guest = await join(room.code, 'DropGuest');
  await host.state((s) => s.players.filter((p) => p.connected).length === 2);
  await isolate(host, state, 'schaetz');

  host.send({ t: 'start' });
  await guest.c.state((s) => s.phase === 'question' && s.current?.type === 'schaetz');
  await host.close();

  const transferred = await guest.c.state((s) => s.phase === 'question' && s.hostId === guest.joined.id && s.players.some((p) => p.id === room.id && !p.connected));
  assert.equal(transferred.hostId, guest.joined.id);
  guest.c.send({ t: 'answer', v: '1' });
  await guest.c.state((s) => s.phase === 'results');

  const returning = await new Client().open();
  returning.send({ t: 'rejoin', code: room.code, id: room.id });
  await returning.wait((m) => m.t === 'joined' && m.id === room.id);
  const rejoined = await returning.state((s) => s.phase === 'results' && s.players.some((p) => p.id === room.id && p.connected));
  assert.equal(rejoined.hostId, guest.joined.id, 'rejoining old host should not steal host control back');

  await returning.close(); await guest.c.close();
});

test('30 connected players can complete a full round and player 31 is rejected', async () => {
  const { c: host, joined: room, state } = await create('CapacityHost');
  const guests = [];
  for (let i = 1; i < 30; i += 1) guests.push(await join(room.code, `P${i}`));
  const full = await host.state((s) => s.players.filter((p) => p.connected).length === 30, 8000);
  assert.equal(full.players.filter((p) => p.connected).length, 30);

  const overflow = await new Client().open();
  overflow.send({ t: 'join', code: room.code, name: 'P30' });
  const err = await overflow.wait((m) => m.t === 'error');
  assert.match(err.m, /Lobby ist voll|max\. 30/);

  await isolate(host, state, 'oder');
  host.send({ t: 'start' });
  await host.state((s) => s.phase === 'question' && s.current?.type === 'oder');
  for (const g of guests) await g.c.state((s) => s.phase === 'question' && s.current?.type === 'oder');

  host.send({ t: 'answer', v: 0 });
  for (const g of guests) g.c.send({ t: 'answer', v: 0 });
  const result = await host.state((s) => s.phase === 'results', 10000);
  assert.equal(result.players.filter((p) => p.connected).length, 30);

  await overflow.close();
  for (const g of guests.reverse()) await g.c.close();
  await host.close();
});

test('malformed and oversized websocket messages are ignored without killing the connection', async () => {
  const c = await new Client().open();
  c.raw('{ definitely-not-json');
  c.raw('x'.repeat(9000));
  c.send({ t: 'ping' });
  await c.wait((m) => m.t === 'pong');

  c.send({ t: 'create', name: 'StillAlive' });
  await c.wait((m) => m.t === 'joined');
  const s = await c.state((x) => x.phase === 'lobby');
  assert.equal(s.players.filter((p) => p.connected).length, 1);
  await c.close();
});
