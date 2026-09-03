'use strict';
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('js/v8/49_v104_boarding_control.js','utf8');
assert.ok(src.includes('KeyW')&&src.includes('KeyA')&&src.includes('KeyS')&&src.includes('KeyD'));
assert.ok(src.includes('Space'));
assert.ok(src.includes('__v104CaptainInput'));
assert.ok(src.includes('boarding.active'));
console.log('V10.4 boarding control: PASS');
