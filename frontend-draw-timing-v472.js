'use strict';

const tuneDrawTiming = require('./frontend-draw-timing-v47');

function applyPortraitSafeImages(html) {
  const css = `
/* Keep person/image guessing sources fully visible instead of cropping faces. */
.photo-wrap{aspect-ratio:3/4!important;display:grid!important;place-items:center!important;background:#09060e!important;max-height:min(64vh,620px)!important}
.photo{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center center!important;transform:none!important;background:#09060e!important}
.blur0,.blur1,.blur2,.blur3,.blur4{transform:none!important}
@media(max-width:430px){.photo-wrap{aspect-ratio:3/4!important;max-height:58vh!important}}
`;
  if (html.includes('object-fit:contain!important') && html.includes('object-position:center center!important')) return html;
  if (!html.includes('</style>')) throw new Error('v4.7.2 Bild-Patch fehlt: style anchor');
  return html.replace('</style>', css + '</style>');
}

module.exports = function tuneCombinedTimers(html) {
  const drawTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";
  const combinedTimer = "function timerHtml(){if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='taps')return '';if(state&&state.current&&state.current.type==='minigame'&&state.current.miniType==='allemalen'&&state.current.miniStage==='rank')return '';return '<div class=\"timer-label\"><span>Runde '+state.round+'</span><span id=\"secs\">–</span></div><div class=\"timer\"><div id=\"bar\"></div></div>';}";

  // v4.7 now preserves Tap Battle while adding the drawing-ranking condition.
  // This bridge only supplies the Tap condition as a fallback when an older
  // base HTML reaches it without that condition.
  html = tuneDrawTiming(html);
  if (html.includes(combinedTimer)) return applyPortraitSafeImages(html);
  if (html.includes(drawTimer)) return applyPortraitSafeImages(html.replace(drawTimer, combinedTimer));
  throw new Error('v4.7.2 Timer-Brücke fehlt: kombinierter Timer');
};
