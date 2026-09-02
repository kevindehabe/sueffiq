'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const songs = require('../songs');
const base = require('../questions');
const extra = require('../extras');
const more = require('../more');

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
