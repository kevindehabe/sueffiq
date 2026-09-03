'use strict';

const base = require('./more-base');
const party = require('./party-extra');
const adult = require('./adult-extra');

const out = {};
for (const key of new Set([...Object.keys(base), ...Object.keys(party), ...Object.keys(adult)])) {
  const a = Array.isArray(base[key]) ? base[key] : [];
  const b = Array.isArray(party[key]) ? party[key] : [];
  const c = Array.isArray(adult[key]) ? adult[key] : [];
  out[key] = [...a, ...b, ...c];
}

module.exports = out;
