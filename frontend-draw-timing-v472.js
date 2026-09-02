'use strict';

const tuneDrawTiming = require('./frontend-draw-timing-v47');

module.exports = function tuneCombinedTimers(html) {
  const baseTimer = "function timerHtml(){return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
  const tapTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
  const drawTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
  const combinedTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";

  // v4.6.1 already hid the global timer for Tap Battle. Temporarily restore the
  // original timer so the existing drawing patch can apply its rank behavior.
  if (html.includes(tapTimer)) html = html.replace(tapTimer, baseTimer);

  html = tuneDrawTiming(html);

  // Preserve both behaviors in the final generated client.
  if (!html.includes(drawTimer)) throw new Error('v4.7.2 Timer-Brücke fehlt: Zeichen-Timer');
  return html.replace(drawTimer, combinedTimer);
};
