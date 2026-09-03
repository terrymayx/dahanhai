const assert=require('assert'),fs=require('fs');
assert(fs.existsSync('js/v8/43_v100_chunk_physics.js'),'V10 chunk physics module should exist');
const s=fs.readFileSync('js/v8/43_v100_chunk_physics.js','utf8');
for(const t of ['MAX_PAIRS=24','function resolveCollisions','function explodeChunk','powderCount','fireAge','breachRate','structuralChunks'])assert(s.includes(t),t);
const base=fs.readFileSync('js/v8/38_v99_structure.js','utf8');
for(const t of ['powderCount','burning','radius','breachRate'])assert(base.includes(t),`chunk creation should preserve ${t}`);
console.log('V10 chunk physics contract passed');
