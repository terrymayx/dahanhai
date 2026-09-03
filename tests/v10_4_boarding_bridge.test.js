'use strict';
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('js/v8/36_v104_boarding_bridge.js','utf8');
assert.ok(src.includes('__v104SuppressBroadside'));
assert.ok(src.includes('boardingApproach'));
assert.ok(src.includes('V104Boarding'));
assert.ok(src.includes('B.update=function'));
console.log('V10.4 boarding bridge: PASS');
