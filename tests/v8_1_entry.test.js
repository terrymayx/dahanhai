const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(index),'homepage must identify an active V8-derived release');
const scripts=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
const expected=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js'];
const versions=[];
for(const name of expected){
  const src=scripts.find(s=>s.includes(name));
  assert(src,`homepage must load ${name}`);
  const m=src.match(/\?v=([0-9]+\.[0-9]+\.[0-9]+)/);
  assert(m,`${name} must force-load the active code instead of stale cached code`);
  versions.push(m[1]);
}
assert(versions.every(v=>v===versions[0]),'V8-derived core scripts must share one active cache key');
assert(!index.includes('21_boarding_update.js'),'core battle must remain independent of legacy boarding');
console.log('V8.1 entry compatibility test passed');
