'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomSequence, reactionResults, tapResults, memoryResults, blindTimerResults } = require('../minigames');

test('random color sequence uses four colors and requested length', () => {
  const seq = randomSequence(12);
  assert.equal(seq.length, 12);
  assert.ok(seq.every((x) => Number.isInteger(x) && x >= 0 && x <= 3));
});

test('reaction ranks fastest valid tap first and penalizes false starts', () => {
  const out = reactionResults({ a: { ms: 210 }, b: { ms: 330 }, c: { falseStart: true, ms: 0 } });
  assert.equal(out.ranked[0].id, 'a');
  assert.equal(out.sips.a, 0);
  assert.equal(out.sips.c, 2);
});

test('tap battle ranks highest count first with gentle penalties', () => {
  const out = tapResults({ a: 81, b: 53, c: 24 });
  assert.deepEqual(out.ranked.map((x) => x.id), ['a', 'b', 'c']);
  assert.equal(out.sips.a, 0);
  assert.ok(out.sips.c <= 2);
});

test('memory rewards full sequence and keeps penalties at two or less', () => {
  const out = memoryResults({ a: { score: 6, ms: 900 }, b: { score: 4, ms: 600 }, c: { score: 1, ms: 300 } }, 6);
  assert.equal(out.ranked[0].id, 'a');
  assert.equal(out.sips.a, 0);
  assert.equal(out.sips.b, 1);
  assert.equal(out.sips.c, 2);
});

test('blind timer ranks the smallest distance from the hidden target first', () => {
  const out = blindTimerResults({ a: { elapsed: 2985 }, b: { elapsed: 3470 }, c: { elapsed: 1810 } }, 3000);
  assert.deepEqual(out.ranked.map((row) => row.id), ['a', 'b', 'c']);
  assert.equal(out.ranked[0].delta, 15);
  assert.equal(out.sips.a, 0);
  assert.equal(out.sips.c, 2);
});
