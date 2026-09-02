const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');
assert(html.includes('大航海时代 V9.0 · 矢量船体重构'),'page title must be V9.0');
assert(html.includes('js/v8/38_vector_ship.js?v=9.0.0'),'entry must load V9 vector ship module');
assert(html.indexOf('38_vector_ship.js')<html.indexOf('40_render.js'),'vector ship module must load before renderer');
for(const file of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','40_render.js','45_damage_overlay.js','50_input_loop.js']){
  assert(html.includes(`${file}?v=9.0.0`),`${file} must use V9 cache key`);
}
assert(overlay.includes('V9.0 · 矢量船体重构'),'HUD must show V9.0');
console.log('V9.0 entry contract passed');
