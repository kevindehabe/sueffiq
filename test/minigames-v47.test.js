'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = 50300 + Math.floor(Math.random() * 400);
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let child;

class C {
  constructor() { this.ws = null; this.q = []; this.w = []; }
  async open() { this.ws = new WebSocket(WS); await new Promise((r, j) => { this.ws.once('open', r); this.ws.once('error', j); }); this.ws.on('message', (raw) => { const m = JSON.parse(String(raw)); const i = this.w.findIndex((x) => { try { return x.p(m); } catch { return false; } }); if (i < 0) this.q.push(m); else { const x = this.w.splice(i, 1)[0]; clearTimeout(x.timer); x.r(m); } }); return this; }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(p, ms = 7000) { const i = this.q.findIndex((m) => { try { return p(m); } catch { return false; } }); if (i >= 0) return Promise.resolve(this.q.splice(i, 1)[0]); return new Promise((r, j) => { const x = { p, r, timer: null }; x.timer = setTimeout(() => { const k = this.w.indexOf(x); if (k >= 0) this.w.splice(k, 1); j(new Error('timeout')); }, ms); this.w.push(x); }); }
  state(p = () => true, ms = 7000) { return this.wait((m) => m.t === 'state' && p(m.s), ms).then((m) => m.s); }
  async close() { if (this.ws && this.ws.readyState < WebSocket.CLOSING) this.ws.close(); await sleep(40); }
}

async function waitHealth() { for (let i = 0; i < 100; i++) { try { const r = await fetch(`${HTTP}/health`); if (r.ok) return r.json(); } catch {} await sleep(100); } throw new Error('server did not start'); }
async function roomWithGuest(name = 'Host') {
  const host = await new C().open(); host.send({ t: 'create', name }); const hj = await host.wait((m) => m.t === 'joined'); let hs = await host.state((s) => s.phase === 'lobby');
  const guest = await new C().open(); guest.send({ t: 'join', code: hj.code, name: 'Guest' }); const gj = await guest.wait((m) => m.t === 'joined'); await guest.state((s) => s.phase === 'lobby' && s.players.filter((p) => p.connected).length === 2); hs = await host.state((s) => s.phase === 'lobby' && s.players.filter((p) => p.connected).length === 2); return { host, hostJoin: hj, guest, guestJoin: gj, state: hs };
}
async function onlyCategory(host, state, wanted) { let s = state; for (const cat of [...s.selectedCats]) { if (cat === wanted) continue; host.send({ t: 'toggleCat', cat }); s = await host.state((x) => !x.selectedCats.includes(cat)); } return s; }
async function onlyMini(host, state, wanted) { let s = state; for (const mini of [...s.selectedMiniTypes]) { if (mini === wanted) continue; host.send({ t: 'toggleMini', mini }); s = await host.state((x) => !x.selectedMiniTypes.includes(mini)); } assert.deepEqual(s.selectedMiniTypes, [wanted]); return s; }
async function cleanup(...clients) { for (const c of clients) await c.close(); }

test.before(async () => {
  child = spawn(process.execPath, ['server-v3.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(PORT), CI: 'true' }, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', (d) => { stderr += String(d); }); child.once('exit', (code) => { if (code && stderr) process.stderr.write(stderr); });
  const h = await waitHealth();
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
  assert.match(html, /Während er läuft siehst du keine Zeit/);
});
