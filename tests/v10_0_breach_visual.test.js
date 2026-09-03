const assert=require('assert'),fs=require('fs');
assert(fs.existsSync('js/v8/39_v100_breach_visual.js'),'V10 breach visual module should exist');
const s=fs.readFileSync('js/v8/39_v100_breach_visual.js','utf8');
for(const t of [
  'function buildRegions',
  'function exposedEdges',
  'function chainEdges',
  'function traceOuterBoundary',
  'function traceRegion',
  'function simplifyBoundary',
  'function smoothPath',
  '__v100BreachVisual',
  '__v100CrackRevision',
  'quadraticCurveTo',
  'MAX_POINTS'
])assert(s.includes(t),t);
assert(s.includes('revisionKey(ship)'),'breach contours must be cached by physical/material/crack revisions');
assert(s.includes('loops.sort'),'breach visual must select a continuous outer contour instead of angle-sorting cell centers');
assert(!s.includes('fillRect('),'breach visuals must not use block cells');
console.log('V10 boundary-traced breach visual contract passed');
