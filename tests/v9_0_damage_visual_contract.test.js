const fs=require('fs');
const assert=require('assert');

const vectorPath='js/v8/38_vector_ship.js';
const cachePath='js/v8/38_v952_detach_visual.js';
const breachPath='js/v8/39_v100_breach_visual.js';
assert(fs.existsSync(vectorPath),'V9 vector ship module must exist');
assert(fs.existsSync(cachePath),'cached hull renderer must exist');
assert(fs.existsSync(breachPath),'V10 merged breach renderer must exist');

const src=fs.readFileSync(vectorPath,'utf8');
for(const token of [
  'function drawShipLocal',
  'function drawDebrisClusterLocal',
  'bezierCurveTo',
  'quadraticCurveTo',
  'ellipse(',
  'drawMastsAndSails',
  'drawCannons',
  'drawPlanks',
  'drawDamageMarks'
]) assert(src.includes(token),`vector visual module must include ${token}`);
assert(!src.includes('fillRect('),'V9 vector ship module must not construct ship visuals from filled square cells');
assert(!src.includes('strokeRect('),'V9 vector ship module must not expose square cell borders');

const cache=fs.readFileSync(cachePath,'utf8');
for(const token of ['V96CachedHull','buildFullPhysicalMask','traceDamageCut','fullMask','__v96DamageRevision'])
  assert(cache.includes(token),`cached hull renderer must include ${token}`);

const breach=fs.readFileSync(breachPath,'utf8');
for(const token of ['V100BreachVisual','buildRegions','traceRegion','__v100CrackRevision','bezierCurveTo','quadraticCurveTo'])
  assert(breach.includes(token),`merged breach renderer must include ${token}`);
assert(!breach.includes('fillRect('),'merged breach renderer must not draw square damage cells');

console.log('V9/V10 cached damage visual contract passed');
