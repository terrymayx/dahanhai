const fs=require('fs');
const assert=require('assert');
const render=fs.readFileSync('js/v8/40_render.js','utf8');
const battle=fs.readFileSync('js/v8/30_battle.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert(/V8\.\d+/.test(render),'renderer HUD must identify the active V8 release');
assert(render.includes('锁定目标'),'renderer must keep a clear locked-target label');
assert(/SALVO_COUNT\s*=\s*4/.test(battle),'V8.3 four-shot salvo behavior must remain active');
assert(battle.includes('spawnEnemyPair'),'V8.3 paired formation behavior must remain active');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js']){
  assert(html.includes(`js/v8/${f}?v=`),`${f} must remain cache-busted on the active V8 release`);
}
console.log('V8.3 render/entry compatibility tests passed');
