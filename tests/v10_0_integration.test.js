const assert=require('assert'),fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
for(const t of [
  'V10.0 · 连续船体断裂与真实沉没系统',
  '35_v100_fracture.js?v=10.0.0',
  '38_v100_bending.js?v=10.0.0',
  '39_v100_breach_visual.js?v=10.0.0',
  '40_v100_sinking.js?v=10.0.0',
  '43_v100_chunk_physics.js?v=10.0.0'
]) assert(index.includes(t),t);
console.log('V10 integration contract passed');
