const assert=require('assert'),fs=require('fs');
const c=fs.readFileSync('js/v8/37_v99_compartments.js','utf8');
for(const t of ['inflowRate','transferIn','transferOut','submergedOpenings'])assert(c.includes(t),t);
assert(fs.existsSync('js/v8/40_v100_sinking.js'),'V10 sinking module should exist');
const s=fs.readFileSync('js/v8/40_v100_sinking.js','utf8');
for(const t of ['MAX_PHYSICAL_ROLL=.84','IMMERSION_START=.38','CAPSIZE_DANGER=.56','CAPSIZE_LOCK=.84','function updateImmersion','submergedOpenings','function capsizeStage'])assert(s.includes(t),t);
const b=fs.readFileSync('js/v8/40_v99_buoyancy.js','utf8');
assert(b.includes('const MAX_ROLL=.62'),'V9.9 buoyancy roll target should expand to .62');
console.log('V10 flooding and capsize contract passed');
