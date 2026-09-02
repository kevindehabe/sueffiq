'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('production uses one server process without runtime server chaining', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const compat = fs.readFileSync(path.join(root, 'server-v3.js'), 'utf8');
  const prod = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

  assert.equal(pkg.main, 'server.js');
  assert.equal(pkg.scripts.start, 'node server.js');
  assert.match(compat, /require\('\.\/server'\)/);
  assert.doesNotMatch(compat, /server-v[478]/);
  assert.doesNotMatch(prod, /child_process|\bspawn\s*\(|SUEFFIQ_INTERNAL_PORT|\.server-v\d/i);
  assert.match(prod, /new WebSocketServer\(\{ server/);
});
