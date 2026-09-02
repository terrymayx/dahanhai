const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('大航海时代 V8.5 · 船体损伤与进水'),'page title must identify V8.5');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_flooding.js','40_render.js','45_damage_overlay.js','50_input_loop.js']){
  assert(html.includes(`js/v8/${f}?v=8.5.0`),`${f} must load with V8.5.0 cache key`);
}
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');
for(const token of ['damageStage','ship.leaks','ship.draft','进水','V8.5 · 船体损伤与进水'])assert(overlay.includes(token),`V8.5 overlay must consume/render ${token}`);
console.log('V8.5 render/entry tests passed');
