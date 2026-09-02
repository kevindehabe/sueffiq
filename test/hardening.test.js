'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');
const songs = require('../songs');

const PORT = 48000 + Math.floor(Math.random() * 500);
const INTERNAL_PORT = PORT + 1000;
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
let child;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  send(x) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(x)); }
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
  async close() { if (!this.ws || this.ws.readyState >= 2) return; this.ws.close(); await sleep(50); }
}

async function waitHealth() {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    try { const r = await fetch(`${HTTP}/health`); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  throw new Error('server start timeout');
}

async function create(name) {
  const c = await new Client().open(); c.send({ t: 'create', name });
  const joined = await c.wait((m) => m.t === 'joined');
  const state = await c.state((s) => s.phase === 'lobby');
  return { c, joined, state };
}

async function join(code, name) {
  const c = await new Client().open(); c.send({ t: 'join', code, name });
  const joined = await c.wait((m) => m.t === 'joined');
  await c.state((s) => s.phase === 'lobby');
  return { c, joined };
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
    env: { ...process.env, PORT: String(PORT), SUEFFIQ_INTERNAL_PORT: String(INTERNAL_PORT) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += String(d); });
  child.once('exit', (code) => { if (code && stderr) process.stderr.write(stderr); });
  const h = await waitHealth();
  assert.equal(h.ok, true);
  assert.equal(h.version, '4.6.1');
});

test.after(async () => { if (child && !child.killed) child.kill('SIGTERM'); await sleep(200); });

test('PWA endpoints and standalone metadata are present', async () => {
  const manifestRes = await fetch(`${HTTP}/manifest.webmanifest`);
  assert.equal(manifestRes.status, 200);
  const manifest = await manifestRes.json();
  assert.equal(manifest.name, 'SüffIQ');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');

  const swRes = await fetch(`${HTTP}/sw.js`);
  assert.equal(swRes.status, 200);
  assert.match(await swRes.text(), /addEventListener\('fetch'/);

  const iconRes = await fetch(`${HTTP}/icon.svg`);
  assert.equal(iconRes.status, 200);
  assert.match(await iconRes.text(), /<svg/);

  const html = await (await fetch(`${HTTP}/`)).text();
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /serviceWorker\.register/);
  assert.match(html, /inviteCodeFromUrl/);
  assert.match(html, /shareInvite/);
  assert.match(html, /master-btn/);
});

test('rejoin replacing a still-open socket does not mark the new connection offline', async () => {
  const { c: host, joined: room } = await create('ReconnectHost');
  const oldGuest = await join(room.code, 'ReconnectGuest');
  await host.state((s) => s.players.filter((p) => p.connected).length === 2);

  const replacement = await new Client().open();
  replacement.send({ t: 'rejoin', code: room.code, id: oldGuest.joined.id });
  await replacement.wait((m) => m.t === 'joined' && m.id === oldGuest.joined.id);
  await replacement.state((s) => s.players.some((p) => p.id === oldGuest.joined.id && p.connected));

  await sleep(250);
  host.send({ t: 'allCats' });
  const check = await host.state((s) => s.phase === 'lobby');
  const guest = check.players.find((p) => p.id === oldGuest.joined.id);
  assert.ok(guest && guest.connected, 'replacement connection was incorrectly marked offline');

  await host.close(); await oldGuest.c.close(); await replacement.close();
});

test('continuous song scoring is based on elapsed listening time', async () => {
  const { c: host, joined: room, state } = await create('SongHost');
  const guest = await join(room.code, 'SongGuest');
  await host.state((s) => s.players.filter((p) => p.connected).length === 2);
  await isolate(host, state, 'song');

  host.send({ t: 'start' });
  const q = await host.state((s) => s.phase === 'question' && s.current && s.current.type === 'song');
  await guest.c.state((s) => s.phase === 'question' && s.current && s.current.type === 'song');
  const song = songs.find((x) => x.videoId === q.current.videoId);
  assert.ok(song, `could not resolve song ${q.current.videoId}`);

  host.send({ t: 'songPlay' });
  const sync = await host.wait((m) => m.t === 'songPlay');
  await guest.c.wait((m) => m.t === 'songPlay' && m.at === sync.at);
  const target = sync.at + 6200;
  if (Date.now() < target) await sleep(target - Date.now());

  host.send({ t: 'guess', v: song.title });
  guest.c.send({ t: 'guess', v: song.title });
  const result = await host.state((s) => s.phase === 'results', 7000);
  assert.match(result.result.lines.join(' '), /Schnell erkannt|Je schneller/);
  assert.equal(result.result.drinkers.length, 2);
  for (const d of result.result.drinkers) assert.equal(d.n, 1, `${d.name} should get 1 sip after about 6 seconds`);

  await host.close(); await guest.c.close();
});
