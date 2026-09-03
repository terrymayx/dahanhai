const assert=require('assert'),fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(index),'active title must expose a valid current release');
const required=['35_v100_fracture.js','38_v100_bending.js','39_v100_breach_visual.js','40_v100_sinking.js','43_v100_chunk_physics.js'];
const cacheKeys=[];
for(const file of required){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const m=index.match(new RegExp(escaped+'\\?v=([^"<]+)'));
  assert(m,`current entry must keep V10 core module ${file}`);
  cacheKeys.push(m[1]);
}
assert(cacheKeys.every(k=>k===cacheKeys[0]),'V10 core modules must share the current release cache key');
assert(/^\d+\.\d+\.\d+$/.test(cacheKeys[0]),'current cache key must be semantic x.y.z');
const idx=n=>index.indexOf(n);
assert(idx('35_v100_fracture.js')<idx('35_v101_crack_branches.js'),'V10 fracture foundation must load before V10.1 crack branches');
assert(idx('38_v99_structure.js')<idx('38_v100_bending.js'),'bending must load after V9.9 structure');
assert(idx('38_v100_bending.js')<idx('38_v101_progressive_break.js'),'V10 bending must load before V10.1 progressive break');
assert(idx('39_v100_breach_visual.js')<idx('45_damage_overlay.js'),'continuous breach visual must be available before damage overlay');
assert(idx('40_v99_buoyancy.js')<idx('40_v100_sinking.js'),'V10 sinking must load after V9.9 buoyancy');
assert(idx('43_v100_chunk_physics.js')<idx('43_v101_chunk_damage.js'),'V10 chunk physics foundation must load before V10.1 chunk damage');
console.log('V10 integration compatibility contract passed');
