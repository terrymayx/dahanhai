const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');

assert(/<title>大航海时代 V(?:8\.6|9\.0)/.test(html),'current page title must identify an active V8.6+ battle entry');
assert(html.includes('37_component_stress.js'),'current entry must preserve the V8.6 component stress subsystem');
const scripts=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','37_component_stress.js','40_render.js','45_damage_overlay.js','50_input_loop.js'];
for(const f of scripts)assert(new RegExp(`js/v8/${f.replace('.','\\.')}\\?v=(?:8\\.6\\.0|9\\.0\\.0)`).test(html),`${f} must load with the active V8.6+ cache key`);
assert(html.indexOf('36_damage_model.js')<html.indexOf('37_component_stress.js'),'damage model must load before component stress');
assert(html.indexOf('37_component_stress.js')<html.indexOf('40_render.js'),'component stress must load before renderer/overlay');
for(const forbidden of ['36_damage_flooding.js','leaks','flooding','draft','进水'])assert(!html.includes(forbidden),`current entry must remain flooding-free: ${forbidden}`);
assert(fs.existsSync('legacy_v7.html'),'legacy V7 page must remain available');
console.log('V8.6 entry compatibility tests passed');
