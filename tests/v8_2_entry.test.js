const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('V8.2 · 部位破坏与连锁毁伤'),'page title must be V8.2');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js']){
  assert(html.includes(`js/v8/${f}?v=8.2.1`),`${f} must use V8.2.1 cache key`);
}
assert(!html.includes('31_v73_proximity_boarding.js'),'V8 entry must not load legacy boarding');
assert(fs.existsSync('legacy_v7.html'),'legacy V7 page remains available');
console.log('V8.2 entry tests passed');