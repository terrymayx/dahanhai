const fs=require('fs');
const assert=require('assert');

const vectorPath='js/v8/38_vector_ship.js';
const cachePath='js/v8/38_v952_detach_visual.js';
const breachPath='js/v8/39_v100_breach_visual.js';
assert(fs.existsSync(vectorPath),'V9 vector ship module must exist');
assert(fs.existsSync(cachePath),'cached hull renderer must exist');
assert(fs.existsSync(breachPath),'continuous breach renderer must exist');

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
for(const token of ['V100BreachVisual','buildRegions','traceOuterBoundary','traceRegion','revisionKey','__v100CrackRevision','quadraticCurveTo'])
  assert(breach.includes(token),`continuous breach renderer must include ${token}`);
assert(!breach.includes('fillRect('),'continuous breach renderer must not draw square damage cells');
assert(!breach.includes('strokeRect('),'continuous breach renderer must not expose square damage borders');

console.log('Cached vector + continuous breach visual contract passed');
