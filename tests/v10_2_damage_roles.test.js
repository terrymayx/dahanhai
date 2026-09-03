const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;
ctx.V98Armor={armorFor:()=>100,multiplierFor:r=>r<.6?.28:r<1?.55:r<1.5?.92:1.05};
vm.createContext(ctx);
for(const f of ['js/v8/34_v102_ammo.js','js/v8/34_v99_material.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const A=ctx.V102Ammo,M=ctx.V99Material;
assert(A&&M,'ammo and material modules must load');
assert(A.directDamageScale('solid','beam')>A.directDamageScale('standard','beam'),'solid should favor beams');
assert(A.directDamageScale('chain','mast')>A.directDamageScale('solid','mast'),'chain should dominate mast damage');
assert(A.directDamageScale('chain','hull')<A.directDamageScale('solid','hull'),'chain should be weak against hull');
assert(A.directDamageScale('explosive','deck')>A.directDamageScale('chain','deck'),'explosive should be stronger than chain against deck');

function fixture(type){
  const cell={gx:0,gy:0,type,material:type,hp:60,maxHp:60,alive:true,weight:1};
  const ship={rotation:0,cellMap:{'0,0':cell},cells:[cell]};
  return {ship,cell};
}
const s=fixture('hull'),c=fixture('hull');
const solid=M.resolveDirect(s.ship,s.cell,{vx:900,vy:0,damage:80,attackPower:80,ammoType:'solid'});
const chain=M.resolveDirect(c.ship,c.cell,{vx:900,vy:0,damage:80,attackPower:80,ammoType:'chain'});
assert(solid.ratio>chain.ratio,'solid ammo must have a higher armor penetration ratio than chain ammo at the same base attack');
assert.strictEqual(solid.rawAttackPower,80,'material result should preserve common base attack for HUD/debugging');
assert.strictEqual(solid.attackPower,104,'solid effective armor attack should apply 1.30x without changing base stat');
console.log('V10.2 ammo damage-role tests passed');
