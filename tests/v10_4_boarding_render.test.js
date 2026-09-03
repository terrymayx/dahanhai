'use strict';
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('js/v8/45_v104_boarding_render.js','utf8');
assert.ok(src.includes('甲板守卫战'));
assert.ok(src.includes('__v104CameraBlend'));
assert.ok(src.includes('boardingJump'));
assert.ok(src.includes('captain'));
assert.ok(src.includes('enemyRemaining'));
console.log('V10.4 boarding render: PASS');
