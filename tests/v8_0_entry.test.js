const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
assert(/V8\.0/.test(index),'index title must identify V8.0');
const scripts=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
assert(scripts.length>=6,'V8 index loads the V8 modules');
assert(scripts.every(s=>s.startsWith('js/v8/')),'V8 index must not load legacy V7 scripts');
const expected=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js'];
for(const name of expected)assert(scripts.some(s=>s.includes(name)),`V8 index must load ${name}`);
assert(!index.includes('21_boarding_update.js'),'V8-A must not load legacy boarding system');
assert(!index.includes('31_v73_proximity_boarding.js'),'V8-A must not load V7 proximity wrapper');

assert(fs.existsSync('legacy_v7.html'),'legacy V7 page must be preserved');
const legacy=fs.readFileSync('legacy_v7.html','utf8');
assert(legacy.includes('V7.3'),'legacy page keeps V7.3 title');
assert(legacy.includes('js/31_v73_proximity_boarding.js?v=7.3.2'),'legacy page keeps strict 50px V7.3 boarding logic');
assert(legacy.includes('js/60_input_loop.js'),'legacy page remains runnable');

assert(fs.existsSync('js/v8/50_input_loop.js'),'V8 input loop must exist');
const loop=fs.readFileSync('js/v8/50_input_loop.js','utf8');
assert(/requestAnimationFrame/.test(loop),'V8 has a browser frame loop');
assert(/setFocus/.test(loop),'V8 input can focus a target');
assert(/screenToWorld/.test(loop),'pointer input maps through virtual coordinates');
console.log('V8.0 entry tests passed');
