'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

// Hotfix wrapper: v4.7.2 already bridges the Tap-Battle timer with the
// Alle-malen ranking timer. Reuse that bridge before applying the v5.1
// YouTube/Zeitgefühl/Logo frontend patches.
const basePath = path.join(__dirname, 'frontend-youtube-v51.js');
let src = fs.readFileSync(basePath, 'utf8');
const needle = "const tuneBase = require('./frontend-draw-timing-v47');";
const replacement = "const tuneBase = require('./frontend-draw-timing-v472');";
if (!src.includes(needle)) throw new Error('v5.1.2 Frontend-Hotfix fehlt: draw timer bridge');
src = src.replace(needle, replacement);

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
module.exports = runtime.exports;
