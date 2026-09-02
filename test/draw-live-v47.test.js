'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 49300 + Math.floor(Math.random() * 250);
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
      if (i >= 0) { const w = this.waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(m); } else this.q.push(m);
    });
    return this;
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
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
  async close() { if (this.ws && this.ws.readyState < WebSocket.CLOSING) this.ws.close(); await sleep(30); }
}

async function health() {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try { const r = await fetch(`${HTTP}/health`); if (r.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error('server start timeout');
}

async function onlyCategory(host, state, keep) {
  let s = state;
  for (const cat of [...s.selectedCats]) {
    if (cat === keep) continue;
    host.send({ t: 'toggleCat', cat });
    s = await host.state((x) => !x.selectedCats.includes(cat));
  }
  return s;
}

async function onlyMini(host, state, keep) {
  let s = state;
  for (const mini of [...s.selectedMiniTypes]) {
    if (mini === keep) continue;
    host.send({ t: 'toggleMini', mini });
    s = await host.state((x) => !x.selectedMiniTypes.includes(mini));
  }
  return s;
}

test.before(async () => {
  child = spawn(process.execPath, ['server-v3.js'], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  await health();
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(120); });

test('Zeichnen & Raten streams RGB strokes and clear events live to the other player', async () => {
  const host = await new Client().open();
  host.send({ t: 'create', name: 'Host' });
  const hj = await host.wait((m) => m.t === 'joined');
  let hs = await host.state((s) => s.phase === 'lobby');

  const guest = await new Client().open();
  guest.send({ t: 'join', code: hj.code, name: 'Gast' });
  await guest.wait((m) => m.t === 'joined');
  await guest.state((s) => s.phase === 'lobby');
  hs = await host.state((s) => s.phase === 'lobby' && s.players.filter((p) => p.connected).length === 2);

  hs = await onlyCategory(host, hs, 'minigame');
  hs = await onlyMini(host, hs, 'zeichnen');
  host.send({ t: 'start' });

  const hq = await host.state((s) => s.phase === 'question' && s.current?.miniType === 'zeichnen');
  const gq = await guest.state((s) => s.phase === 'question' && s.current?.miniType === 'zeichnen');
  const drawer = hq.current.isDrawer ? host : guest;
  const viewer = hq.current.isDrawer ? guest : host;
  assert.notEqual(hq.current.isDrawer, gq.current.isDrawer);

  const stroke = [.1, .2, .8, .7, '#12abef'];
  drawer.send({ t: 'drawStroke', s: stroke });
  const live = await viewer.wait((m) => m.t === 'drawStroke', 4000);
  assert.deepEqual(live.stroke, stroke);

  const eraseStroke = [.2, .3, .6, .5, '#ffffff'];
  drawer.send({ t: 'drawStroke', s: eraseStroke });
  const erased = await viewer.wait((m) => m.t === 'drawStroke', 4000);
  assert.deepEqual(erased.stroke, eraseStroke);

  drawer.send({ t: 'drawClear' });
  const cleared = await viewer.wait((m) => m.t === 'drawClear', 4000);
  assert.equal(cleared.t, 'drawClear');

  host.send({ t: 'end' });
  await host.state((s) => s.phase === 'end');
  await host.close();
  await guest.close();
});

test('generated UI contains RGB picker, star ratings and one-point Pong copy', async () => {
  const html = await (await fetch(`${HTTP}/`)).text();
  assert.match(html, /drawRgbPicker/);
  assert.match(html, /id=\"drawEraser\"/);
  assert.match(html, /⌫ Radierer/);
  assert.match(html, /color==='#ffffff'/);
  assert.match(html, /rating-btn/);
  assert.match(html, /automatisch gespeichert|automatisch gespeichert|automatisch gespeichert/i);
  assert.match(html, /Ein Punkt entscheidet/);
});
