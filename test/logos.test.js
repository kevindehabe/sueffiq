'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LOGO_PROMPTS, matchLogoGuess, logoImageUrl, normalizeLogoText } = require('../logos');

test('logo pool is large, unique and uses icon CDN URLs', () => {
  assert.ok(LOGO_PROMPTS.length >= 40);
  assert.equal(new Set(LOGO_PROMPTS.map((x) => x.id)).size, LOGO_PROMPTS.length);
  assert.equal(new Set(LOGO_PROMPTS.map((x) => x.slug)).size, LOGO_PROMPTS.length);
  for (const item of LOGO_PROMPTS) {
    assert.match(logoImageUrl(item), /^https:\/\/cdn\.simpleicons\.org\/[a-z0-9]+$/);
    assert.ok(item.name && item.slug && item.id);
  }
});

test('logo guesses accept aliases but do not reveal answers in normalization', () => {
  const vw = LOGO_PROMPTS.find((x) => x.name === 'Volkswagen');
  const mc = LOGO_PROMPTS.find((x) => x.name === "McDonald's");
  assert.equal(matchLogoGuess(vw, 'VW').status, 'correct');
  assert.equal(matchLogoGuess(mc, 'Mäcces').status, 'correct');
  assert.equal(matchLogoGuess(vw, 'Volkwagen').status, 'near');
  assert.equal(matchLogoGuess(vw, 'Nike').status, 'wrong');
  assert.equal(normalizeLogoText('Mercedes-Benz'), 'mercedesbenz');
});
