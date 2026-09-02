const fs=require('fs');
const assert=require('assert');
const render=fs.readFileSync('js/v8/40_render.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert(render.includes('V8.3'),'renderer HUD must identify the V8.3 release');
assert(render.includes('锁定目标'),'renderer must show a clear locked-target label');
assert(render.includes('4 发')||render.includes('4发'),'renderer must explain the four-shot salvo');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js']){
  assert(html.includes(`js/v8/${f}?v=8.3.0`),`${f} must use V8.3.0 cache key`);
}
console.log('V8.3 render/entry tests passed');
