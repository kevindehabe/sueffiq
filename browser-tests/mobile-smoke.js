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

async function keepOnly(page, keep) {
  const active = await page.locator('.cat-toggle.active').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-cat')));
  for (const cat of active) {
    if (cat === keep) continue;
    await page.locator(`button[data-cat="${cat}"]`).click();
    await page.waitForTimeout(30);
  }
  await page.locator(`button[data-cat="${keep}"].active`).waitFor();
  assert.equal(await page.locator('.cat-toggle.active').count(), 1);
}

async function assertOfflineShell(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('#create').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('service workers unsupported');
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('service worker did not take control')), 5000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 5000 });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.locator('#create').waitFor({ state: 'visible' });
  assert.match(await page.locator('body').textContent(), /Spiel erstellen/);
  await assertNoHorizontalOverflow(page, 'Chromium offline PWA shell');
  await context.setOffline(false);
  await context.close();
}

async function runBrowser(browserType, name) {
  const browser = await browserType.launch({ headless: true });
  try {
    if (name.includes('Chromium')) await assertOfflineShell(browser);

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
    assert.equal(await host.locator('.cat-toggle').count(), 13, `${name}: expected 13 category buttons`);
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
    await guest.locator('.pname', { hasText: 'MobileHost' }).waitFor({ state: 'visible' });
    assert.equal(await guest.locator('.cat-view').count(), 13, `${name}: guest should see 13 read-only categories`);
    await assertNoHorizontalOverflow(guest, `${name} guest lobby`);

    // Select only estimates from the UI. Re-render after every toggle is intentional.
    await keepOnly(host, 'schaetz');
    await guest.locator('button[data-cat="schaetz"].active').waitFor();

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

    await host.locator('#end').click();
    await host.getByText('Game Over', { exact: false }).waitFor({ state: 'visible' });
    await guest.getByText('Game Over', { exact: false }).waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(host, `${name} game over`);

    // New room solely to verify the lobby leave button on a narrow phone.
    const leaveContext = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    const leavePage = await leaveContext.newPage();
    await leavePage.goto(URL, { waitUntil: 'domcontentloaded' });
    await leavePage.locator('#name').fill('LeaveTest');
    await leavePage.locator('#create').click();
    await leavePage.locator('#leaveLobby').waitFor({ state: 'visible' });
    await leavePage.locator('#leaveLobby').click();
    await leavePage.locator('#create').waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(leavePage, `${name} post-leave landing`);

    // Rendering untrusted player names must stay text, never become HTML.
    const xssContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const xss = await xssContext.newPage();
    await xss.goto(URL, { waitUntil: 'domcontentloaded' });
    await xss.locator('#name').fill('<img src=x>');
    await xss.locator('#create').click();
    await xss.locator('.pname').waitFor({ state: 'visible' });
    assert.equal(await xss.locator('.pname img').count(), 0, `${name}: player name became executable HTML`);
    assert.match(await xss.locator('.pname').textContent(), /<img src=x>/);

    // Critical iPhone regression: automatic person hints must not replace/focus-away the guess input.
    // WebKit is the meaningful Safari approximation; run it there to keep CI duration reasonable.
    if (name.includes('WebKit')) {
      await keepOnly(xss, 'person');
      await xss.locator('#start').click();
      await xss.locator('#guessInput').waitFor({ state: 'visible' });
      const initialHints = await xss.locator('.hint').count();
      await xss.locator('#guessInput').focus();
      assert.equal(await xss.evaluate(() => document.activeElement && document.activeElement.id), 'guessInput');

      // Wrong guesses are public but must also be escaped.
      await xss.locator('#guessInput').fill('<img src=x>');
      await xss.locator('#guessForm').evaluate((form) => form.requestSubmit());
      await xss.locator('#guessFeed').waitFor({ state: 'visible' });
      assert.equal(await xss.locator('#guessFeed img').count(), 0, `${name}: guess feed became executable HTML`);
      await xss.locator('#guessInput').focus();

      await xss.waitForFunction((n) => document.querySelectorAll('.hint').length > n, initialHints, { timeout: 15000 });
      assert.equal(await xss.evaluate(() => document.activeElement && document.activeElement.id), 'guessInput', `${name}: keyboard focus was lost when a hint arrived`);
      await assertNoHorizontalOverflow(xss, `${name} person guess`);
    }

    // Very short landscape viewport should still not create horizontal scrolling.
    await xss.setViewportSize({ width: 844, height: 390 });
    await assertNoHorizontalOverflow(xss, `${name} landscape`);

    await xssContext.close();
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
