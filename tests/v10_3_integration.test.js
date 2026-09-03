const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('V10.3 · 真实舷炮齐射系统'),'entry title should be V10.3 real broadside');
const versions=[...html.matchAll(/<script src="[^"]+\?v=([^"]+)"/g)].map(m=>m[1]);assert(versions.length>10,'expected core scripts');assert(new Set(versions).size===1&&versions[0]==='10.3.0','all runtime scripts must use cache key 10.3.0');
for(const file of ['35_v103_broadside.js','49_v103_broadside_control.js'])assert(html.includes(file),`entry must load ${file}`);
assert(html.indexOf('30_battle.js')<html.indexOf('35_v103_broadside.js'),'broadside must load after battle');
assert(html.indexOf('34_v102_ammo.js')<html.indexOf('35_v103_broadside.js'),'broadside must load after V10.2 ammo');
assert(html.indexOf('50_input_loop.js')<html.indexOf('49_v103_broadside_control.js'),'broadside controls must load after input loop');
console.log('V10.3 integration contract passed');
