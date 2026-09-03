'use strict';
const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');

assert.ok(html.includes('34_v98_armor.js?v='),'armor module should be loaded with the active cache key');
assert.ok(html.includes('42_v98_heavy_feedback.js?v='),'heavy feedback module should be loaded with the active cache key');
assert.ok(html.indexOf('34_v98_armor.js')<html.indexOf('37_fire_damage.js'),'armor should be available before battle-time fire/update execution');
assert.ok(html.indexOf('40_v97_flood_pose.js')<html.indexOf('42_v98_heavy_feedback.js'),'heavy feedback should wrap the final flood-aware ship pose');
assert.ok(html.indexOf('42_v98_heavy_feedback.js')<html.indexOf('41_render_v9.js'),'heavy feedback should be installed before V9 draw loop is used');

const armorKey=(html.match(/34_v98_armor\.js\?v=([^"<]+)/)||[])[1];
const feedbackKey=(html.match(/42_v98_heavy_feedback\.js\?v=([^"<]+)/)||[])[1];
assert.ok(/^\d+\.\d+\.\d+$/.test(armorKey||''),'armor cache key should be semantic');
assert.strictEqual(feedbackKey,armorKey,'V9.8 subsystems should share the active cache key');

console.log('V9.8 integration regression passed');
