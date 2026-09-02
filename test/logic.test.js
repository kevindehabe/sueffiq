'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeText,
  matchPersonGuess,
  voteSipMap,
  estimateResults,
  binaryMinority,
  majorityResults,
  scaleResults,
} = require('../logic');

test('normalizeText tolerates accents and punctuation', () => {
  assert.equal(normalizeText('  Céline!  '), 'celine');
});

test('person guess accepts first or last name', () => {
  const person = { name: 'Cristiano Ronaldo', aliases: ['CR7'] };
  assert.equal(matchPersonGuess(person, 'Cristiano').status, 'correct');
  assert.equal(matchPersonGuess(person, 'Ronaldo').status, 'correct');
  assert.equal(matchPersonGuess(person, 'CR7').status, 'correct');
});

test('person guess marks typo as near and unrelated guess as wrong', () => {
  const person = { name: 'Cristiano Ronaldo', aliases: ['CR7'] };
  assert.equal(matchPersonGuess(person, 'Ronaldoo').status, 'near');
  assert.equal(matchPersonGuess(person, 'Messi').status, 'wrong');
});

test('wahl gives one sip per vote capped at five', () => {
  const votes = { a: 'x', b: 'x', c: 'x', d: 'x', e: 'x', f: 'x', g: 'y' };
  assert.deepEqual(voteSipMap(votes).sips, { x: 5, y: 1 });
});

test('estimate ties for closest stay dry and farther guesses get more sips', () => {
  const rows = estimateResults({ a: 99, b: 101, c: 120, d: 180 }, 100);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.sips]));
  assert.equal(byId.a, 0);
  assert.equal(byId.b, 0);
  assert.ok(byId.d > byId.c);
});

test('binary tie stays dry', () => {
  const out = binaryMinority({ a: 0, b: 0, c: 1, d: 1 });
  assert.deepEqual(out.sipsByPlayer, {});
});

test('majority punishes less popular choices by vote gap', () => {
  const out = majorityResults({ a: 0, b: 0, c: 0, d: 1, e: 2 });
  assert.equal(out.sipsByPlayer.a, undefined);
  assert.equal(out.sipsByPlayer.d, 2);
  assert.equal(out.sipsByPlayer.e, 2);
});

test('scale keeps values around the median dry', () => {
  const out = scaleResults({ a: 1, b: 5, c: 5, d: 9 });
  const byId = Object.fromEntries(out.rows.map((r) => [r.id, r.sips]));
  assert.equal(out.median, 5);
  assert.equal(byId.b, 0);
  assert.equal(byId.c, 0);
  assert.ok(byId.a > 0);
  assert.ok(byId.d > 0);
});
