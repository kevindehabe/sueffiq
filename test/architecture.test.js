'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('production stays one process without child servers or temp runtimes', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const compat = fs.readFileSync(path.join(root, 'server-v3.js'), 'utf8');
  const entry = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const audioExtension = fs.readFileSync(path.join(root, 'server-v471.js'), 'utf8');
  const tapExtension = fs.readFileSync(path.join(root, 'server-v461.js'), 'utf8');
  const extension = fs.readFileSync(path.join(root, 'server-v46.js'), 'utf8');
  const core = fs.readFileSync(path.join(root, 'server-base-v45.js'), 'utf8');
  const production = `${entry}\n${audioExtension}\n${tapExtension}\n${extension}\n${core}`;

  assert.equal(pkg.main, 'server.js');
  assert.equal(pkg.scripts.start, 'node server.js');
  assert.match(compat, /require\('\.\/server'\)/);
  assert.match(entry, /require\('\.\/server-v471'\)/);
  assert.match(audioExtension, /server-v461/);
  assert.doesNotMatch(production, /child_process|\bspawn\s*\(|SUEFFIQ_INTERNAL_PORT|\.server-v\d+-runtime|31337/i);
  assert.match(core, /new WebSocketServer\(\{ server/);
});
