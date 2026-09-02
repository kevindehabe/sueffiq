'use strict';

const tuneBase = require('./frontend-minigames-v471');

module.exports = function tuneDrawTiming(html) {
  html = tuneBase(html);
  const oldTimer = "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>'; }";
  const oldTimerCompact = "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>'; }".replace('; }',';}');
  const replacement = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>'; }".replace('; }',';}');
  if (html.includes(oldTimer)) return html.replace(oldTimer, replacement);
  if (html.includes(oldTimerCompact)) return html.replace(oldTimerCompact, replacement);
  throw new Error('v4.7 Zeichen-Timer-Patch fehlt: timerHtml');
};
