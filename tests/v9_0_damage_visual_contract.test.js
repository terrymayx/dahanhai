const fs=require('fs');
const assert=require('assert');

const path='js/v8/38_vector_ship.js';
assert(fs.existsSync(path),'V9.0 vector ship module must exist');
const src=fs.readFileSync(path,'utf8');

for(const token of [
  'function drawShipLocal',
  'function drawDebrisClusterLocal',
  "globalCompositeOperation='destination-out'",
  'function traceOrganicHole',
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

console.log('V9.0 damage visual contract passed');
