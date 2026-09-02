'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 46200 + Math.floor(Math.random() * 500);
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let child;

class Client {
  constructor() { this.q = []; this.waiters = []; }
  async open() {
    this.ws = new WebSocket(WS);
    await new Promise((resolve, reject) => { this.ws.once('open', resolve); this.ws.once('error', reject); });
    this.ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      const i = this.waiters.findIndex((w) => { try { return w.p(m); } catch { return false; } });
      if (i >= 0) { const w = this.waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(m); }
      else this.q.push(m);
    });
    return this;
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  wait(p, timeout = 6000) {
    const i = this.q.findIndex((m) => { try { return p(m); } catch { return false; } });
    if (i >= 0) return Promise.resolve(this.q.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = { p, resolve, timer: null };
      w.timer = setTimeout(() => { const j = this.waiters.indexOf(w); if (j >= 0) this.waiters.splice(j, 1); reject(new Error('ws timeout')); }, timeout);
      this.waiters.push(w);
    });
  }
  state(p = () => true, timeout = 6000) { return this.wait((m) => m.t === 'state' && p(m.s), timeout).then((m) => m.s); }
  close() { try { this.ws.close(); } catch {} }
}

async function health() {
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    try { const r = await fetch(`${HTTP}/health`); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  throw new Error('server start timeout');
}

async function isolate(host, state, keep) {
  let s = state;
  for (const cat of [...s.selectedCats]) {
    if (cat === keep) continue;
    host.send({ t: 'toggleCat', cat });
    s = await host.state((x) => !x.selectedCats.includes(cat));
  }
  return s;
}

test.before(async () => {
  child = spawn(process.execPath, ['server-v3.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const h = await health();
  assert.equal(h.version, '4.7.0');
  assert.equal(h.inviteLinks, true);
  assert.equal(h.masterTransfer, true);
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(150); });

test('browser contains shareable room-link UI and URL prefill support', async () => {
  const html = await (await fetch(`${HTTP}/?room=ABCDE`)).text();
  assert.match(html, /inviteCodeFromUrl/);
  assert.match(html, /URLSearchParams/);
  assert.match(html, /\?room=/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /navigator\.clipboard/);
});

test('master can be handed to another connected player after a round', async () => {
  const host = await new Client().open();
  host.send({ t: 'create', name: 'OldMaster' });
  const room = await host.wait((m) => m.t === 'joined');
  let hs = await host.state((s) => s.phase === 'lobby');

  const guest = await new Client().open();
  guest.send({ t: 'join', code: room.code, name: 'NewMaster' });
  const gj = await guest.wait((m) => m.t === 'joined');
  await guest.state((s) => s.phase === 'lobby');
  hs = await host.state((s) => s.players.filter((p) => p.connected).length === 2);

  hs = await isolate(host, hs, 'nie');
  host.send({ t: 'start' });
  await host.state((s) => s.phase === 'question' && s.current?.type === 'nie');
  await guest.state((s) => s.phase === 'question' && s.current?.type === 'nie');
  host.send({ t: 'answer', v: 'nein' });
  guest.send({ t: 'answer', v: 'nein' });
  await host.state((s) => s.phase === 'results');
  await guest.state((s) => s.phase === 'results');

  host.send({ t: 'host', id: gj.id });
  const hostView = await host.state((s) => s.phase === 'results' && s.hostId === gj.id);
  const guestView = await guest.state((s) => s.phase === 'results' && s.hostId === gj.id);
  assert.equal(hostView.hostId, gj.id);
  assert.equal(guestView.you, gj.id);

  guest.send({ t: 'end' });
  await guest.state((s) => s.phase === 'end' && s.hostId === gj.id);
  host.close(); guest.close();
});
