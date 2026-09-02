'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

// Production hotfix wrapper: keep the v5.1 server gameplay, but point its
// generated frontend at the timer-bridge wrapper so the app can boot again.
const basePath = path.join(__dirname, 'server-v51.js');
let src = fs.readFileSync(basePath, 'utf8');
const needle = "./frontend-youtube-v51";
const replacement = "./frontend-youtube-v512";
if (!src.includes(needle)) throw new Error('v5.1.2 Server-Hotfix fehlt: frontend target');
src = src.replace(needle, replacement);

const runtime = new Module(basePath, module.parent || module);
runtime.filename = basePath;
runtime.paths = module.paths;
runtime._compile(src, basePath);
