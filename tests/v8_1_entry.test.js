const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
assert(index.includes('V8.1'),'homepage must identify V8.1');
const scripts=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
const expected=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js'];
for(const name of expected){
  const src=scripts.find(s=>s.includes(name));
  assert(src,`homepage must load ${name}`);
  assert(src.includes('?v=8.1.0'),`${name} must force-load the V8.1 code instead of cached V8.0`);
}
assert(!index.includes('21_boarding_update.js'),'V8.1 must remain independent of legacy boarding');
console.log('V8.1 entry test passed');
