'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const PORT = 47000 + Math.floor(Math.random() * 500);
const INTERNAL_PORT = PORT + 1200;
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealth() {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    try { const r = await fetch(`${URL}/health`); if (r.ok) return; } catch {}
    await sleep(120);
  }
  throw new Error('SüffIQ did not become healthy');
}

async function assertNoHorizontalOverflow(page, label) {
  const dims = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(dims.scrollWidth <= dims.width + 2, `${label}: horizontal overflow ${dims.scrollWidth}px > ${dims.width}px`);
}

async function runBrowser(browserType, name) {
  const browser = await browserType.launch({ headless: true });
  try {
    const hostContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const host = await hostContext.newPage();
    await host.goto(URL, { waitUntil: 'domcontentloaded' });
    await host.locator('#name').waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(host, `${name} landing`);

    // Create room and validate mobile lobby/category picker.
    await host.locator('#name').fill('MobileHost');
    await host.locator('#create').click();
    await host.locator('.big-code').waitFor({ state: 'visible' });
    const code = (await host.locator('.big-code').textContent()).trim();
    assert.match(code, /^[A-Z2-9]{5}$/);
    assert.equal(await host.locator('.cat-toggle').count(), 12, `${name}: expected 12 category buttons`);
    await assertNoHorizontalOverflow(host, `${name} host lobby`);

    // Second phone joins and receives the same room state.
    const guestContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const guest = await guestContext.newPage();
    await guest.goto(URL, { waitUntil: 'domcontentloaded' });
    await guest.locator('#name').fill('MobileGast');
    await guest.locator('#code').fill(code);
    await guest.locator('#join').click();
    await guest.locator('.big-code').waitFor({ state: 'visible' });
    await guest.getByText('MobileHost', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await guest.locator('.cat-view').count(), 12, `${name}: guest should see 12 read-only categories`);
    await assertNoHorizontalOverflow(guest, `${name} guest lobby`);

    // Select only estimates from the UI. Re-render after every toggle is intentional.
    const categories = ['nie','wahl','oder','trivia','wahrheit','pflicht','person','bild','song','mehrheit','skala'];
    for (const cat of categories) {
      const button = host.locator(`button[data-cat="${cat}"]`);
      await button.click();
      await host.waitForTimeout(35);
    }
    await host.locator('button[data-cat="schaetz"].active').waitFor();
    await guest.locator('button[data-cat="schaetz"].active').waitFor();
    assert.equal(await host.locator('.cat-toggle.active').count(), 1);

    await host.locator('#start').click();
    await host.locator('#estimateInput').waitFor({ state: 'visible' });
    await guest.locator('#estimateInput').waitFor({ state: 'visible' });
    const question = await host.locator('.question').textContent();
    assert.match(question, /Antwort in /);
    await assertNoHorizontalOverflow(host, `${name} estimate round`);

    await host.locator('#estimateInput').fill('10');
    await host.locator('#estimate').evaluate((form) => form.requestSubmit());
    await guest.locator('#estimateInput').fill('20');
    await guest.locator('#estimate').evaluate((form) => form.requestSubmit());
    await host.getByText('Nächste Runde', { exact: true }).waitFor({ state: 'visible' });

    // Leave from a fresh lobby flow; explicit leave must return to the landing screen.
    await host.locator('#end').click();
    await host.getByText('Game Over', { exact: false }).waitFor({ state: 'visible' });
    await guest.getByText('Game Over', { exact: false }).waitFor({ state: 'visible' });

    // New room solely to verify the lobby leave button on a phone.
    const leaveContext = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    const leavePage = await leaveContext.newPage();
    await leavePage.goto(URL, { waitUntil: 'domcontentloaded' });
    await leavePage.locator('#name').fill('LeaveTest');
    await leavePage.locator('#create').click();
    await leavePage.locator('#leaveLobby').waitFor({ state: 'visible' });
    await leavePage.locator('#leaveLobby').click();
    await leavePage.locator('#create').waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(leavePage, `${name} post-leave landing`);

    await leaveContext.close();
    await guestContext.close();
    await hostContext.close();
  } finally {
    await browser.close();
  }
}

(async () => {
  const child = spawn(process.execPath, ['server-v3.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), SUEFFIQ_INTERNAL_PORT: String(INTERNAL_PORT) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += String(d); });
  try {
    await waitHealth();
    await runBrowser(chromium, 'Chromium mobile');
    await runBrowser(webkit, 'WebKit mobile');
    console.log('Mobile browser smoke tests passed in Chromium and WebKit.');
  } catch (err) {
    if (stderr) process.stderr.write(stderr);
    throw err;
  } finally {
    child.kill('SIGTERM');
    await sleep(200);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
