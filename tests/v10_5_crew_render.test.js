'use strict';
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('js/v8/45_v105_crew_render.js','utf8');
for(const token of ['crew','captain','gunner','sailor','helmsman','swordsman','archer','eliteCaptain','船员','炮手','水手','舵手'])assert.ok(src.includes(token),token+' missing');
assert.ok(src.includes('V105CrewRender'));
assert.ok(src.includes('deathFade')||src.includes('deadT'));
console.log('V10.5 crew render: PASS');
