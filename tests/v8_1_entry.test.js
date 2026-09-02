const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
assert(index.includes('V8.'),'homepage must identify the active V8 version');
const scripts=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
const expected=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js'];
for(const name of expected){
  const src=scripts.find(s=>s.includes(name));
  assert(src,`homepage must load ${name}`);
  assert(/\?v=8\.\d+\.\d+/.test(src),`${name} must force-load the active V8 code instead of stale cached code`);
}
assert(!index.includes('21_boarding_update.js'),'V8 core must remain independent of legacy boarding');
console.log('V8.1 entry compatibility test passed');
