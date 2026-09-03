'use strict';
const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('V9.9 · 真实船体结构与浮力破坏系统'),'index should advertise V9.9');
assert.ok(html.includes('?v=9.9.0'),'V9.9 scripts should use the 9.9.0 cache key');
for(const file of ['34_v99_material.js','37_v99_compartments.js','38_v99_structure.js','40_v99_buoyancy.js']){
  assert.ok(html.includes(file),'index should load '+file);
}
const idx=n=>html.indexOf(n);
assert.ok(idx('34_v99_material.js')>idx('34_v98_armor.js'),'V99 material should load after V98 armor');
assert.ok(idx('37_v99_compartments.js')>idx('37_v97_flooding.js'),'V99 compartments should load after flooding compatibility wrapper');
assert.ok(idx('40_v99_buoyancy.js')>idx('37_v99_compartments.js'),'buoyancy should load after compartments');
assert.ok(idx('41_render_v9.js')>idx('40_v99_buoyancy.js'),'renderer should load after buoyancy module');
console.log('V9.9 integration regression passed');
