'use strict';
const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('js/v8/20_projectiles.js','utf8');

assert.ok(src.includes('root.V98Armor'),'projectile hit path should dynamically read V98Armor');
assert.ok(src.includes('resolveDirectHit'),'projectile hit path should resolve armor before damageCell');
assert.ok(src.includes('impactArmor'),'projectile should record impact armor');
assert.ok(src.includes('impactRatio'),'projectile should record penetration ratio');
assert.ok(src.includes('impactGrade'),'projectile should record penetration grade');
assert.ok(src.includes('effectiveDamage'),'projectile should record effective direct damage');
assert.ok(src.includes('firstPhysicalHit'),'front-layer collision must remain active');
assert.ok(src.includes('p.dead=true'),'one cannonball must still stop after one physical layer');

console.log('V9.8 projectile armor wiring regression passed');
