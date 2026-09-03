const fs=require('fs');
const assert=require('assert');
const render=fs.readFileSync('js/v8/40_render.js','utf8');
const html=fs.readFileSync('index.html','utf8');
for(const token of ['ship.physics','bobPhase','offsetX','offsetY','roll','p.trail','p.vz',"f.k==='waterSplash'","f.k==='waterRing'","f.k==='foam'","cluster.phase==='float'"]){
  assert(render.includes(token),`V8.4 renderer must consume ${token}`);
}
assert(render.includes('V8.4 · 物理质感重构'),'underlying V8.4 renderer contract must remain present');
assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(html),'page title must identify an active V8.4-derived entry');
const versions=[];
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','40_render.js','50_input_loop.js']){
  const m=html.match(new RegExp(`js/v8/${f.replace('.','\\.')}\\?v=([0-9]+\\.[0-9]+\\.[0-9]+)`));
  assert(m,`${f} must remain loaded by the active entry with a cache key`);versions.push(m[1]);
}
assert(versions.every(v=>v===versions[0]),'V8.4-derived core scripts must share the active cache key');
assert(!html.includes('31_v73_proximity_boarding.js'),'current entry must not load legacy boarding');
assert(fs.existsSync('legacy_v7.html'),'legacy V7 page must remain available');
console.log('V8.4 renderer compatibility tests passed');
