'use strict';
const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const label=fs.readFileSync('js/v8/46_v952_hud_label.js','utf8');

assert.ok(html.includes('V9.8 · 重炮装甲与破坏反馈系统'),'index title should identify V9.8');
assert.ok(html.includes('34_v98_armor.js?v=9.8.0'),'V9.8 armor module should be loaded');
assert.ok(html.includes('42_v98_heavy_feedback.js?v=9.8.0'),'V9.8 heavy feedback module should be loaded');
assert.ok(!html.includes('?v=9.7.6'),'all runtime cache busters should be upgraded to 9.8.0');
assert.ok(html.indexOf('34_v98_armor.js')<html.indexOf('37_fire_damage.js'),'armor should be available before battle-time fire/update execution');
assert.ok(html.indexOf('40_v97_flood_pose.js')<html.indexOf('42_v98_heavy_feedback.js'),'heavy feedback should wrap the final flood-aware ship pose');
assert.ok(html.indexOf('42_v98_heavy_feedback.js')<html.indexOf('41_render_v9.js'),'heavy feedback should be installed before V9 draw loop is used');
assert.ok(label.includes('V9.8 · 重炮装甲与破坏反馈系统'),'HUD version label should identify V9.8');

console.log('V9.8 integration regression passed');
