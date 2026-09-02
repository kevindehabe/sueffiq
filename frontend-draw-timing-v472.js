'use strict';

const tuneDrawTiming = require('./frontend-draw-timing-v47');

module.exports = function tuneCombinedTimers(html) {
  const drawTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
  const combinedTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";

  // v4.7 now preserves Tap Battle while adding the drawing-ranking condition.
  // This bridge only supplies the Tap condition as a fallback when an older
  // base HTML reaches it without that condition.
  html = tuneDrawTiming(html);
  if (html.includes(combinedTimer)) return html;
  if (html.includes(drawTimer)) return html.replace(drawTimer, combinedTimer);
  throw new Error('v4.7.2 Timer-Brücke fehlt: kombinierter Timer');
};
