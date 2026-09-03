'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 45000 + Math.floor(Math.random() * 700);
const INTERNAL_PORT = PORT + 1500;
let child;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor() { this.q = []; this.waiters = []; }
  async open() {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
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
  wait(p, timeout = 7000) {
    const i = this.q.findIndex((m) => { try { return p(m); } catch { return false; } });
    if (i >= 0) return Promise.resolve(this.q.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = { p, resolve, timer: null };
      w.timer = setTimeout(() => { const j = this.waiters.indexOf(w); if (j >= 0) this.waiters.splice(j, 1); reject(new Error('ws timeout')); }, timeout);
      this.waiters.push(w);
    });
  }
  state(p = () => true, timeout = 7000) { return this.wait((m) => m.t === 'state' && p(m.s), timeout).then((m) => m.s); }
  close() { try { this.ws.close(); } catch {} }
}

async function health() {
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/health`); if (r.ok) return r.json(); } catch {}
    await sleep(120);
  }
  throw new Error('server start timeout');
}

async function setOnly(host, state, wanted) {
  let s = state;
  const selected = new Set(s.selectedCats);
  if (!selected.has(wanted)) {
    host.send({ t: 'toggleCat', cat: wanted });
    s = await host.state((n) => n.selectedCats.includes(wanted));
  }
  for (const cat of [...s.selectedCats]) {
    if (cat === wanted) continue;
    host.send({ t: 'toggleCat', cat });
    s = await host.state((n) => !n.selectedCats.includes(cat));
  }
  assert.deepEqual(s.selectedCats, [wanted]);
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
  const h = await health(); assert.equal(h.ok, true);
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(150); });

test('every selectable category can be scheduled', async () => {
  const host = await new Client().open();
  host.send({ t: 'create', name: 'CategorySmoke' });
  await host.wait((m) => m.t === 'joined');
  let s = await host.state((x) => x.phase === 'lobby');
  const categories = Object.keys(s.cats);
  assert.equal(categories.length, 14);
  assert.ok(categories.includes('minigame'));
  assert.equal(s.cats.logo, 'Erkenne das Logo');

  for (const cat of categories) {
    s = await setOnly(host, s, cat);
    host.send({ t: 'start' });
    if (cat === 'bild') {
      s = await host.state((x) => (x.phase === 'question' && x.current && x.current.type === 'bild') || (x.phase === 'results' && x.result && x.result.type === 'bild'), 22000);
    } else {
      s = await host.state((x) => x.phase === 'question' && x.current && x.current.type === cat, 8000);
    }
    if (s.phase !== 'end') {
      host.send({ t: 'end' });
      s = await host.state((x) => x.phase === 'end');
    }
  }
  host.close();
});
