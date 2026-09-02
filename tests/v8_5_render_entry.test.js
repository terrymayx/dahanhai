const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(/大航海时代 V(?:8\.6|9\.0)/.test(html),'page title must identify an active V8.6+ build');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','37_component_stress.js','40_render.js','45_damage_overlay.js','50_input_loop.js']){
  assert(new RegExp(`js/v8/${f.replace('.','\\.')}\\?v=(?:8\\.6\\.0|9\\.0\\.0)`).test(html),`${f} must load with the active V8.6+ cache key`);
}
assert(!html.includes('36_damage_flooding.js'),'current entry must not load removed flooding module');
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');
for(const token of ['damageStage','主梁断裂'])assert(overlay.includes(token),`damage overlay must preserve ${token}`);
assert(/V(?:8\.6|9\.0)/.test(overlay),'damage overlay must identify the active build');
for(const token of ['进水','漏水','ship.leaks','ship.draft','ship.flooding','drawLeak','applyDraft'])assert(!overlay.includes(token),`damage overlay must remove ${token}`);
console.log('V8.5 render/entry compatibility tests passed');
