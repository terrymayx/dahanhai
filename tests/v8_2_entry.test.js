const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(html),'page title must identify an active V8-derived release');
const versions=[];
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','40_render.js','50_input_loop.js']){
  const m=html.match(new RegExp(`js/v8/${f.replace('.','\\.')}\\?v=([0-9]+\\.[0-9]+\\.[0-9]+)`));
  assert(m,`${f} must remain cache-versioned`);versions.push(m[1]);
}
assert.strictEqual(new Set(versions).size,1,'all V8 core scripts must share one cache version');
assert(!html.includes('31_v73_proximity_boarding.js'),'active entry must not load legacy boarding');
assert(fs.existsSync('legacy_v7.html'),'legacy V7 page remains available');
console.log('V8.2 entry regression tests passed');
