const assert = require('assert');
const fs = require('fs');
const path = require('path');
const C = require('../combat.js');

assert.strictEqual(typeof C.guardApproachSpeed, 'function', 'guardApproachSpeed should exist');
assert.strictEqual(typeof C.guardApproachStage, 'function', 'guardApproachStage should exist');
assert.strictEqual(typeof C.crewMotionOffset, 'function', 'crewMotionOffset should exist');

const farSkiff = C.guardApproachSpeed('skiff', 900);
const farMedium = C.guardApproachSpeed('medium', 900);
const farLarge = C.guardApproachSpeed('large', 900);
assert(farSkiff < 125, 'skiff should approach more slowly than the old rush speed');
assert(farMedium < farSkiff, 'medium ship should approach slower than skiff');
assert(farLarge < farMedium, 'large ship should approach slowest');

assert.strictEqual(C.guardApproachStage(900), 'ranged');
assert.strictEqual(C.guardApproachStage(430), 'ranged');
assert.strictEqual(C.guardApproachStage(260), 'closing');
assert.strictEqual(C.guardApproachStage(150), 'align');

const near = C.guardApproachSpeed('skiff', 180);
assert(near < farSkiff, 'ships should slow down before docking');

const a = C.crewMotionOffset(7, 1.25, 'shooter');
const b = C.crewMotionOffset(7, 1.75, 'shooter');
assert(Number.isFinite(a.x) && Number.isFinite(a.y));
assert(Math.abs(a.x) <= 5 && Math.abs(a.y) <= 5, 'crew motion must remain a small deck-local movement');
assert(a.x !== b.x || a.y !== b.y, 'crew should visibly move over time');

const guard = fs.readFileSync(path.join(__dirname, '..', 'guard.js'), 'utf8');
assert(guard.includes('C.guardApproachSpeed(ship.type,d)'), 'active enemy approach should use paced speed helper');
assert(guard.includes('ship.approachStage=C.guardApproachStage(d)'), 'active enemy ships should expose approach stage');
assert(guard.includes('function updateEnemyCrewMotion('), 'enemy deck crew should update visible local movement');
assert(guard.includes('C.crewMotionOffset('), 'crew motion helper should drive deck-local movement');
assert(guard.includes("approachStage==='ranged'"), 'ranged combat stage should be explicit before docking');
assert(!guard.includes('d=Math.hypot(dx,dy)||1,v=ship.cfg.speed'), 'old full-speed rush approach should be removed');

console.log('deck guard approach/crew-motion tests passed');
