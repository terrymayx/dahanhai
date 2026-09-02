const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('大航海时代 V8.5.1 · 船体损伤与破甲'),'page title must identify V8.5.1');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','40_render.js','45_damage_overlay.js','50_input_loop.js']){
  assert(html.includes(`js/v8/${f}?v=8.5.1`),`${f} must load with V8.5.1 cache key`);
}
assert(!html.includes('36_damage_flooding.js'),'V8.5.1 entry must not load removed flooding module');
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');
for(const token of ['damageStage','V8.5.1 · 船体损伤与破甲','先打裂外壳 → 破甲穿透 → 主梁断裂 → 结构崩解'])assert(overlay.includes(token),`V8.5.1 overlay must keep ${token}`);
for(const token of ['进水','漏水','ship.leaks','ship.draft','ship.flooding','drawLeak','applyDraft'])assert(!overlay.includes(token),`V8.5.1 overlay must remove ${token}`);
console.log('V8.5 render/entry compatibility tests passed');
