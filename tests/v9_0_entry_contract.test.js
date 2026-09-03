const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');

assert(/<title>大航海时代 V\d+(?:\.\d+)?/.test(html),'page title must expose a valid game version');
assert(html.includes('js/v8/38_vector_ship.js?v='),'entry must load the vector ship module');
assert(html.indexOf('38_vector_ship.js')<html.indexOf('40_render.js'),'vector ship module must load before renderer');

const required=['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','36_damage_model.js','40_render.js','45_damage_overlay.js','50_input_loop.js'];
const keys=[];
for(const file of required){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=html.match(new RegExp(escaped+'\\?v=([^"<]+)'));
  assert(match,`${file} must be loaded with a cache key`);
  keys.push(match[1]);
}
assert(keys.every(k=>k===keys[0]),'core scripts must share one cache key');
assert(/^\d+\.\d+\.\d+$/.test(keys[0]),'cache key must use semantic x.y.z form');
assert(html.includes('js/v8/45_damage_overlay.js?v='),'damage overlay must still load');
console.log('Entry contract passed');
