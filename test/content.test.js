'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const songs = require('../songs');
const base = require('../questions');
const extra = require('../extras');
const more = require('../more');
const adult = require('../adult-extra');

function merged(key) {
  return [base[key], extra[key], more[key]].flatMap((x) => Array.isArray(x) ? x : []);
}

test('party song pool is large and structurally valid', () => {
  assert.ok(songs.length >= 100, `expected at least 100 songs, got ${songs.length}`);
  const titles = new Set();
  const ids = new Set();
  for (const song of songs) {
    assert.equal(typeof song.title, 'string');
    assert.ok(song.title.trim().length >= 2);
    assert.equal(typeof song.artist, 'string');
    assert.ok(song.artist.trim().length >= 2);
    assert.match(song.videoId, /^[A-Za-z0-9_-]{11}$/);
    assert.ok(Number.isFinite(song.start) && song.start >= 0, `${song.title}: invalid start`);
    const titleKey = song.title.trim().toLowerCase();
    assert.ok(!titles.has(titleKey), `duplicate song title: ${song.title}`);
    assert.ok(!ids.has(song.videoId), `duplicate YouTube id: ${song.videoId}`);
    titles.add(titleKey);
    ids.add(song.videoId);
  }
});

test('Wer würde eher has enough variety', () => {
  const pool = merged('wahl');
  assert.ok(pool.length >= 120, `expected at least 120 Wer würde eher cards, got ${pool.length}`);
  const normalized = pool.map((x) => String(x).trim().toLowerCase());
  const unique = new Set(normalized);
  assert.ok(unique.size / normalized.length >= 0.95, `too many duplicate Wer würde eher cards: ${unique.size}/${normalized.length}`);
});

test('all selectable question categories have content', () => {
  const categories = ['nie','wahl','schaetz','oder','trivia','wahrheit','pflicht','person','bild','mehrheit','skala'];
  for (const key of categories) {
    const pool = merged(key);
    assert.ok(pool.length >= 20, `${key} has only ${pool.length} items`);
  }
});

test('estimate questions have numeric answers and units where useful', () => {
  for (const q of merged('schaetz')) {
    assert.equal(typeof q.q, 'string');
    assert.ok(Number.isFinite(q.a), `invalid estimate answer: ${q.q}`);
    assert.equal(typeof q.unit, 'string', `missing unit: ${q.q}`);
    assert.ok(q.unit.trim().length > 0, `empty unit: ${q.q}`);
  }
});

test('18+ party expansion is large, varied and structurally valid', () => {
  const minimums = { nie: 60, wahl: 60, wahrheit: 50, pflicht: 45, oder: 35, mehrheit: 30, skala: 30 };
  let total = 0;
  for (const [key, minimum] of Object.entries(minimums)) {
    const pool = adult[key];
    assert.ok(Array.isArray(pool), `missing adult category: ${key}`);
    assert.ok(pool.length >= minimum, `${key} has only ${pool.length} new 18+ cards`);
    assert.equal(new Set(pool.map((item) => JSON.stringify(item).trim().toLowerCase())).size, pool.length, `${key} contains duplicates`);
    total += pool.length;
  }
  assert.ok(total >= 300, `expected at least 300 new 18+ cards, got ${total}`);
  for (const pair of adult.oder) assert.ok(Array.isArray(pair) && pair.length === 2 && pair.every((x) => typeof x === 'string' && x.length > 2));
  for (const card of adult.mehrheit) assert.ok(card && typeof card.q === 'string' && Array.isArray(card.o) && card.o.length === 4);
  assert.ok(adult.nie.every((x) => typeof x === 'string'));
  assert.ok(adult.wahl.every((x) => typeof x === 'string'));
  assert.ok(adult.wahrheit.every((x) => typeof x === 'string'));
  assert.ok(adult.pflicht.every((x) => typeof x === 'string'));
  assert.ok(adult.skala.every((x) => typeof x === 'string'));
});
