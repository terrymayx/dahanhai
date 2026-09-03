const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(index),'index title must identify an active V8-derived release');
const scripts=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
assert(scripts.length>=6,'active index loads the V8-derived modules');
assert(scripts.every(s=>s.startsWith('js/v8/')),'active index must not load legacy V7 scripts');
const expected=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js'];
for(const name of expected)assert(scripts.some(s=>s.includes(name)),`active index must load ${name}`);
const cacheKeys=expected.map(name=>{const src=scripts.find(s=>s.includes(name));return (src&&src.match(/\?v=([0-9]+\.[0-9]+\.[0-9]+)/)||[])[1];});
assert(cacheKeys.every(Boolean),'V8-derived core scripts must remain cache-versioned');
assert(cacheKeys.every(k=>k===cacheKeys[0]),'V8-derived core scripts must share one active cache key');
assert(!index.includes('21_boarding_update.js'),'active battle must not load legacy boarding system');
assert(!index.includes('31_v73_proximity_boarding.js'),'active battle must not load V7 proximity wrapper');

assert(fs.existsSync('legacy_v7.html'),'legacy V7 page must be preserved');
const legacy=fs.readFileSync('legacy_v7.html','utf8');
assert(legacy.includes('V7.3'),'legacy page keeps V7.3 title');
assert(legacy.includes('js/31_v73_proximity_boarding.js?v=7.3.2'),'legacy page keeps strict 50px V7.3 boarding logic');
assert(legacy.includes('js/60_input_loop.js'),'legacy page remains runnable');

assert(fs.existsSync('js/v8/50_input_loop.js'),'V8-derived input loop must exist');
const loop=fs.readFileSync('js/v8/50_input_loop.js','utf8');
assert(/requestAnimationFrame/.test(loop),'battle has a browser frame loop');
assert(/setFocus/.test(loop),'battle input can focus a target');
assert(/screenToWorld/.test(loop),'pointer input maps through virtual coordinates');
console.log('V8 entry compatibility tests passed');
