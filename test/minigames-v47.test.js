'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 48600 + Math.floor(Math.random() * 300);
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
  send(x) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(x)); }
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
  async close() { if (!this.ws || this.ws.readyState >= WebSocket.CLOSING) return; this.ws.close(); await sleep(40); }
}

async function health() {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try { const r = await fetch(`${HTTP}/health`); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  throw new Error('server start timeout');
}

async function create(name = 'Host') {
  const c = await new Client().open(); c.send({ t: 'create', name });
  const joined = await c.wait((m) => m.t === 'joined');
  const state = await c.state((s) => s.phase === 'lobby');
  return { c, joined, state };
}
async function join(code, name = 'Gast') {
  const c = await new Client().open(); c.send({ t: 'join', code, name });
  const joined = await c.wait((m) => m.t === 'joined');
  await c.state((s) => s.phase === 'lobby');
  return { c, joined };
}
async function onlyCategory(host, state, keep) {
  let s = state;
  for (const cat of [...s.selectedCats]) {
    if (cat === keep) continue;
    host.send({ t: 'toggleCat', cat });
    s = await host.state((x) => Array.isArray(x.selectedCats) && !x.selectedCats.includes(cat));
  }
  assert.deepEqual(s.selectedCats, [keep]);
  return s;
}
async function onlyMini(host, state, keep) {
  let s = state;
  for (const mini of [...s.selectedMiniTypes]) {
    if (mini === keep) continue;
    host.send({ t: 'toggleMini', mini });
    s = await host.state((x) => Array.isArray(x.selectedMiniTypes) && !x.selectedMiniTypes.includes(mini));
  }
  assert.deepEqual(s.selectedMiniTypes, [keep]);
  return s;
}

async function roomWithGuest(prefix) {
  const made = await create(prefix + 'Host');
  const guest = await join(made.joined.code, prefix + 'Gast');
  const state = await made.c.state((s) => s.phase === 'lobby' && s.players.filter((p) => p.connected).length === 2);
  return { host: made.c, hostJoin: made.joined, guest: guest.c, guestJoin: guest.joined, state };
}

async function cleanup(...clients) { for (const c of clients) if (c) await c.close(); }

test.before(async () => {
  child = spawn(process.execPath, ['server-v3.js'], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = ''; child.stderr.on('data', (d) => { stderr += String(d); });
  child.once('exit', (code) => { if (code && stderr) process.stderr.write(stderr); });
  const h = await health();
  assert.equal(h.version, '4.7.0');
  assert.equal(h.minigameSelection, true);
  assert.equal(h.pong, true);
  assert.equal(h.blackjack, true);
  assert.equal(h.blindTimer, true);
  assert.equal(h.allDrawRanking, true);
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(180); });

test('lobby exposes eight selectable minigames and first minigame is guaranteed drawing', async () => {
  const { host, guest, state } = await roomWithGuest('Draw');
  assert.deepEqual(state.selectedMiniTypes, ['zeichnen', 'allemalen', 'reaktion', 'taps', 'farbfolge', 'zeitgefuehl', 'pong', 'blackjack']);
  for (const key of state.selectedMiniTypes) assert.equal(typeof state.miniTypes[key], 'string');
  let s = await onlyCategory(host, state, 'minigame');
  host.send({ t: 'start' });
  const q = await host.state((x) => x.phase === 'question' && x.current?.type === 'minigame');
  await guest.state((x) => x.phase === 'question' && x.current?.type === 'minigame');
  assert.equal(q.current.miniType, 'zeichnen');
  assert.ok(q.current.isDrawer === true || q.current.isDrawer === false);
  host.send({ t: 'end' });
  await host.state((x) => x.phase === 'end');
  await cleanup(host, guest);
});

test('individual minigame selection can isolate Blackjack and both players can finish', async () => {
  const { host, guest, state } = await roomWithGuest('BJ');
  let s = await onlyCategory(host, state, 'minigame');
  s = await onlyMini(host, s, 'blackjack');
  host.send({ t: 'start' });
  const hq = await host.state((x) => x.phase === 'question' && x.current?.miniType === 'blackjack');
  const gq = await guest.state((x) => x.phase === 'question' && x.current?.miniType === 'blackjack');
  assert.ok(Array.isArray(hq.current.blackjack.hand) && hq.current.blackjack.hand.length >= 2);
  assert.ok(Array.isArray(gq.current.blackjack.hand) && gq.current.blackjack.hand.length >= 2);
  if (!hq.current.blackjack.done) host.send({ t: 'blackjackStand' });
  if (!gq.current.blackjack.done) guest.send({ t: 'blackjackStand' });
  if (hq.current.blackjack.done && gq.current.blackjack.done) host.send({ t: 'blackjackStand' });
  const result = await host.state((x) => x.phase === 'results' && x.result?.miniType === 'blackjack', 8000);
  assert.equal(result.result.miniRows.length, 2);
  await cleanup(host, guest);
});

test('Zeitgefühl uses a random hidden target and server-measured start/stop', async () => {
  const { host, guest, state } = await roomWithGuest('Timer');
  let s = await onlyCategory(host, state, 'minigame');
  s = await onlyMini(host, s, 'zeitgefuehl');
  host.send({ t: 'start' });
  const hq = await host.state((x) => x.phase === 'question' && x.current?.miniType === 'zeitgefuehl');
  const gq = await guest.state((x) => x.phase === 'question' && x.current?.miniType === 'zeitgefuehl');
  assert.equal(hq.current.timerTargetMs, gq.current.timerTargetMs);
  assert.ok(hq.current.timerTargetMs >= 2000 && hq.current.timerTargetMs <= 10000);
  assert.equal(hq.current.timerTargetMs % 1000, 0);
  assert.equal(hq.current.timerStarted, false);
  assert.equal(hq.current.elapsed, undefined);

  host.send({ t: 'miniTimerStart' });
  guest.send({ t: 'miniTimerStart' });
  await host.state((x) => x.phase === 'question' && x.current?.timerStarted);
  await guest.state((x) => x.phase === 'question' && x.current?.timerStarted);
  host.send({ t: 'miniTimerStop' });
  guest.send({ t: 'miniTimerStop' });
  const result = await host.state((x) => x.phase === 'results' && x.result?.miniType === 'zeitgefuehl');
  assert.equal(result.result.answer, `${hq.current.timerTargetMs / 1000} Sekunden`);
  assert.equal(result.result.miniRows.length, 2);
  assert.ok(result.result.miniRows.every((row) => /s · [−+]\d+\.\d{2} s$/.test(row.label)));
  await cleanup(host, guest);
});

test('Alle malen gives same prompt, enters ranking, and finishes after all rankings', async () => {
  const { host, hostJoin, guest, guestJoin, state } = await roomWithGuest('Paint');
  let s = await onlyCategory(host, state, 'minigame');
  s = await onlyMini(host, s, 'allemalen');
  host.send({ t: 'start' });
  const hq = await host.state((x) => x.phase === 'question' && x.current?.miniType === 'allemalen' && x.current.miniStage === 'draw');
  const gq = await guest.state((x) => x.phase === 'question' && x.current?.miniType === 'allemalen' && x.current.miniStage === 'draw');
  assert.equal(hq.current.prompt, gq.current.prompt);
  assert.ok(hq.current.prompt.length > 1);
  host.send({ t: 'allDrawStroke', s: [.1, .1, .8, .8, 1] });
  guest.send({ t: 'allDrawStroke', s: [.2, .8, .8, .2, 2] });
  host.send({ t: 'allDrawDone' });
  guest.send({ t: 'allDrawDone' });
  const hr = await host.state((x) => x.phase === 'question' && x.current?.miniType === 'allemalen' && x.current.miniStage === 'rank');
  const gr = await guest.state((x) => x.phase === 'question' && x.current?.miniType === 'allemalen' && x.current.miniStage === 'rank');
  assert.equal(hr.current.drawings.length, 2);
  assert.equal(gr.current.drawings.length, 2);
  assert.equal(hr.current.drawings.filter((d) => d.own).length, 1);
  host.send({ t: 'allDrawRank', order: [guestJoin.id] });
  guest.send({ t: 'allDrawRank', order: [hostJoin.id] });
  const result = await host.state((x) => x.phase === 'results' && x.result?.miniType === 'allemalen', 8000);
  assert.equal(result.result.miniRows.length, 2);
  assert.match(result.result.lines.join(' '), /gerankt|Unentschieden/);
  await cleanup(host, guest);
});

test('Pong assigns exactly two opponents and accepts independent paddle movement', async () => {
  const { host, guest, state } = await roomWithGuest('Pong');
  let s = await onlyCategory(host, state, 'minigame');
  s = await onlyMini(host, s, 'pong');
  host.send({ t: 'start' });
  const hq = await host.state((x) => x.phase === 'question' && x.current?.miniType === 'pong');
  const gq = await guest.state((x) => x.phase === 'question' && x.current?.miniType === 'pong');
  assert.ok(['left', 'right'].includes(hq.current.pong.youSide));
  assert.ok(['left', 'right'].includes(gq.current.pong.youSide));
  assert.notEqual(hq.current.pong.youSide, gq.current.pong.youSide);
  host.send({ t: 'pongMove', y: .2 });
  guest.send({ t: 'pongMove', y: .8 });
  const moved = await host.state((x) => x.phase === 'question' && x.current?.miniType === 'pong' && Math.abs(Number(x.current.pong.paddles[hq.current.pong.youSide]) - .2) < .03, 5000);
  assert.ok(moved.current.pong.score.left >= 0 && moved.current.pong.score.right >= 0);
  host.send({ t: 'end' });
  await host.state((x) => x.phase === 'end');
  await cleanup(host, guest);
});

test('generated mobile UI contains colored memory buttons and all new minigame controls', async () => {
  const html = await (await fetch(`${HTTP}/`)).text();
  assert.match(html, /memory-btn\[data-mc="0"\]/);
  assert.match(html, /toggleMini/);
  assert.match(html, /allDrawRank/);
  assert.match(html, /pongCanvas/);
  assert.match(html, /blackjackHit/);
  assert.match(html, /blindTimerAction/);
  assert.match(html, /Zeitgefühl/);
  assert.match(html, /laufende Zeit bleibt komplett unsichtbar/);
});
