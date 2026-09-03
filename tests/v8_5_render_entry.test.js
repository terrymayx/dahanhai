const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(html),'page title must identify an active V8.5+ derived build');
const versions=[];
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','37_component_stress.js','40_render.js','45_damage_overlay.js','50_input_loop.js']){
  const m=html.match(new RegExp(`js/v8/${f.replace('.','\\.')}\\?v=([0-9]+\\.[0-9]+\\.[0-9]+)`));
  assert(m,`${f} must load with the active cache key`);versions.push(m[1]);
}
assert(versions.every(v=>v===versions[0]),'V8.5-derived core modules must share the active cache key');
assert(!html.includes('36_damage_flooding.js'),'removed V8.5 experimental flooding module must stay unloaded');
const overlay=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');
for(const token of ['damageStage','主梁断裂'])assert(overlay.includes(token),`damage overlay must preserve ${token}`);
console.log('V8.5 render/entry compatibility tests passed');
