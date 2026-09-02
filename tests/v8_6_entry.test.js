const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');

assert(html.includes('大航海时代 V8.6 · 部件损伤与结构应力'),'page title must identify V8.6');
assert(html.includes('V8.6 · 部件损伤与结构应力'),'orientation/HUD-facing entry label must identify V8.6');
const scripts=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','37_component_stress.js','40_render.js','45_damage_overlay.js','50_input_loop.js'];
for(const f of scripts)assert(html.includes(`js/v8/${f}?v=8.6.0`),`${f} must load with V8.6.0 cache key`);
assert(html.indexOf('36_damage_model.js')<html.indexOf('37_component_stress.js'),'damage model must load before component stress');
assert(html.indexOf('37_component_stress.js')<html.indexOf('40_render.js'),'component stress must load before renderer/overlay');
for(const forbidden of ['36_damage_flooding.js','leaks','flooding','draft','进水'])assert(!html.includes(forbidden),`V8.6 entry must remain flooding-free: ${forbidden}`);
assert(fs.existsSync('legacy_v7.html'),'legacy V7 page must remain available');
console.log('V8.6 entry tests passed');
