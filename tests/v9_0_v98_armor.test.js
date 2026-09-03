'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const armorPath='js/v8/34_v98_armor.js';
assert.ok(fs.existsSync(armorPath),'V9.8 armor module should exist');

const root={};
const context={globalThis:root,console};
vm.createContext(context);
vm.runInContext(fs.readFileSync(armorPath,'utf8'),context,{filename:armorPath});
const A=root.V98Armor;
assert.ok(A,'V98Armor should be exported');

const sloop={kind:'sloop'};
const gunship={kind:'gunship'};
const manowar={kind:'manowar'};
const hull={type:'hull'};
const deck={type:'deck'};
const beam={type:'beam'};
const powder={type:'powder'};

assert.ok(A.armorFor(sloop,hull)<A.armorFor(gunship,hull),'gunship hull should be tougher than sloop hull');
assert.ok(A.armorFor(gunship,hull)<A.armorFor(manowar,hull),'manowar hull should be toughest');
assert.ok(A.armorFor(manowar,beam)>A.armorFor(manowar,hull),'beam should be more armored than hull');
assert.ok(A.armorFor(manowar,hull)>A.armorFor(manowar,deck),'hull should be more armored than deck');
assert.ok(A.armorFor(manowar,powder)<A.armorFor(manowar,deck),'powder compartment should be a weak point');

const heavy=A.resolveDirectHit(sloop,hull,72);
assert.strictEqual(heavy.grade,'heavy','72 attack should heavily penetrate a sloop hull');
assert.ok(heavy.effectiveDamage>72,'heavy penetration should amplify direct damage');

const blocked=A.resolveDirectHit(manowar,beam,72);
assert.ok(blocked.grade==='resisted'||blocked.grade==='penetrated','72 attack should be near the manowar beam threshold');
assert.ok(blocked.effectiveDamage<72,'manowar beam should reduce a 72 attack direct hit');

const splash=A.resolveSplashHit(manowar,hull,36,72);
assert.ok(splash.effectiveDamage>0&&splash.effectiveDamage<36,'armor should reduce splash damage on manowar hull at 72 attack');
assert.strictEqual(A.gradeLabel('graze'),'擦伤');
assert.strictEqual(A.gradeLabel('resisted'),'受阻');
assert.strictEqual(A.gradeLabel('penetrated'),'穿透');
assert.strictEqual(A.gradeLabel('heavy'),'重度穿透');

console.log('V9.8 armor model regression passed');
