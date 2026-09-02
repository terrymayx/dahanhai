const fs=require('fs');
const assert=require('assert');
const render=fs.readFileSync('js/v8/40_render.js','utf8');
const html=fs.readFileSync('index.html','utf8');
for(const token of ['ship.physics','bobPhase','offsetX','offsetY','roll','p.trail','p.vz',"f.k==='waterSplash'","f.k==='waterRing'","f.k==='foam'","cluster.phase==='float'"]){
  assert(render.includes(token),`V8.4 renderer must consume ${token}`);
}
assert(render.includes('V8.4 · 物理质感重构'),'HUD must identify V8.4');
assert(html.includes('大航海时代 V8.4 · 物理质感重构'),'page title must identify V8.4');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js']){
  assert(html.includes(`js/v8/${f}?v=8.4.0`),`${f} must use V8.4.0 cache key`);
}
assert(!html.includes('31_v73_proximity_boarding.js'),'V8.4 entry must not load legacy boarding');
assert(fs.existsSync('legacy_v7.html'),'legacy V7 page must remain available');
console.log('V8.4 render/entry tests passed');
