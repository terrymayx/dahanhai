'use strict';
const fs=require('fs');
const assert=require('assert');
const control=fs.readFileSync('js/v8/48_v976_attack_control.js','utf8');
const hud=fs.readFileSync('js/v8/47_v97_status_overlay.js','utf8');

assert.ok(control.includes('type="range"'),'attack control should include a range slider');
assert.ok(control.includes('attackPowerSlider'),'attack slider should have a stable id');
assert.ok(control.includes("addEventListener('input'"),'slider should update attack immediately');
assert.ok(hud.includes('root.V98Armor'),'status overlay should read the V9.8 armor model');
assert.ok(hud.includes('装甲'),'target preview should show armor');
assert.ok(hud.includes('预计'),'target preview should show expected penetration grade');
assert.ok(hud.includes('gradeLabel'),'target preview should use armor grade labels');

console.log('V9.8 attack slider and armor HUD regression passed');
