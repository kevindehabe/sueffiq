'use strict';

const base = require('./more-base');
const party = require('./party-extra');

const out = {};
for (const key of new Set([...Object.keys(base), ...Object.keys(party)])) {
  const a = Array.isArray(base[key]) ? base[key] : [];
  const b = Array.isArray(party[key]) ? party[key] : [];
  out[key] = [...a, ...b];
}

module.exports = out;
