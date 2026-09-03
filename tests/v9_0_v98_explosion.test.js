'use strict';
const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('js/v8/32_v954_impact_explosion.js','utf8');

assert.ok(!src.includes('for(const cell of ship.cells||[])'),'V9.8 blast must not scan every ship cell');
assert.ok(src.includes('ship.cellMap'),'V9.8 blast should use direct cellMap lookup');
assert.ok(src.includes('scanRadius'),'V9.8 blast should bound work by local scan radius');
assert.ok(src.includes('resolveSplashHit'),'each blast candidate should resolve armor before damageCell');
assert.ok(src.includes('effectiveDamage'),'blast should apply armor-adjusted effective damage');
assert.ok(src.includes('blastRadiusScale'),'attack power must still scale blast radius');

console.log('V9.8 local blast regression passed');
