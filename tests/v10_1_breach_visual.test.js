const fs=require('fs');
const assert=require('assert');
const path='js/v8/39_v100_breach_visual.js';
const src=fs.readFileSync(path,'utf8');
assert(src.includes('traceOuterBoundary'),'breach visual should trace exposed outer boundary edges');
assert(src.includes('revisionKey'),'breach visual must remain revision cached');
assert(src.includes('burn'),'breach visual should support burned edge treatment');
console.log('V10.1 breach visual contract passed');
