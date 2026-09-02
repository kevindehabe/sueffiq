'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

// frontend-v45 inserts presenceHtml() between resultDetails() and resultsHtml().
// Keep the tested minigame frontend implementation, but anchor its result-ranking
// addition immediately before presenceHtml instead of the older resultsHtml anchor.
const basePath = path.join(__dirname, 'frontend-minigames-v46base.js');
let src = fs.readFileSync(basePath, 'utf8');
const matches = src.match(/function resultsHtml\(\)\{"/g) || [];
if (matches.length !== 2) throw new Error(`Unerwartete Minigame-Result-Anker: ${matches.length}`);
src = src.replace(/function resultsHtml\(\)\{"/g, 'function presenceHtml(){"');

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
module.exports = runtime.exports;
