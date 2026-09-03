'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LOGO_PROMPTS, matchLogoGuess, logoImageUrl, normalizeLogoText } = require('../logos');

test('logo pool is large, unique and uses CDN or embedded symbol URLs', () => {
  assert.ok(LOGO_PROMPTS.length >= 120);
  assert.equal(new Set(LOGO_PROMPTS.map((x) => x.id)).size, LOGO_PROMPTS.length);
  assert.equal(new Set(LOGO_PROMPTS.map((x) => x.slug)).size, LOGO_PROMPTS.length);
  for (const item of LOGO_PROMPTS) {
    const url = logoImageUrl(item);
    if (item.asset) {
      assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/);
      const svg = decodeURIComponent(url.slice(url.indexOf(',') + 1));
      assert.match(svg, /^<svg/);
      assert.doesNotMatch(svg, new RegExp(item.name.replace(/[^a-z0-9]/gi, ''), 'i'));
    } else {
      assert.match(url, /^https:\/\/cdn\.simpleicons\.org\/[a-z0-9]+$/);
    }
    assert.ok(item.name && item.slug && item.id);
  }
  for (const name of ['Pornhub', 'xHamster', 'Brazzers', 'OnlyFans']) {
    assert.ok(LOGO_PROMPTS.some((item) => item.name === name), `missing requested logo: ${name}`);
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
