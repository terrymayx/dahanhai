const assert=require('assert'),fs=require('fs');
assert(fs.existsSync('js/v8/39_v100_breach_visual.js'),'V10 breach visual module should exist');
const s=fs.readFileSync('js/v8/39_v100_breach_visual.js','utf8');
for(const t of ['function buildRegions','function traceRegion','__v100BreachVisual','__v100CrackRevision','bezierCurveTo','quadraticCurveTo'])assert(s.includes(t),t);
assert(!s.includes('fillRect('),'breach visuals must not use block cells');
console.log('V10 breach visual contract passed');
