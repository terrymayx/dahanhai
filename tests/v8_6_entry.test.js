const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');

assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(html),'current page title must identify an active V8.6-derived battle entry');
assert(html.includes('37_component_stress.js'),'current entry must preserve the V8.6 component stress subsystem');
const scripts=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','37_component_stress.js','40_render.js','45_damage_overlay.js','50_input_loop.js'];
const versions=[];
for(const f of scripts){
  const m=html.match(new RegExp(`js/v8/${f.replace('.','\\.')}\\?v=([0-9]+\\.[0-9]+\\.[0-9]+)`));
  assert(m,`${f} must load with the active cache key`);versions.push(m[1]);
}
assert(versions.every(v=>v===versions[0]),'V8.6-derived core modules must share one active cache key');
assert(html.indexOf('36_damage_model.js')<html.indexOf('37_component_stress.js'),'damage model must load before component stress');
assert(html.indexOf('37_component_stress.js')<html.indexOf('40_render.js'),'component stress must load before renderer/overlay');
assert(!html.includes('36_damage_flooding.js'),'removed V8.6 experimental flooding module must stay unloaded');
assert(fs.existsSync('legacy_v7.html'),'legacy V7 page must remain available');
console.log('V8.6 entry compatibility tests passed');
