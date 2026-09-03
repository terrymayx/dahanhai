const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const math=Object.create(Math);math.random=()=>0.30;
const ctx={console,Math:math};ctx.globalThis=ctx;
ctx.V8ShipGrid={
  createTemplateShip:()=>({cells:[]}),
  damageCell:(ship,cell,damage)=>{cell.hp=Math.max(0,(cell.hp||20)-damage);if(cell.hp<=0)cell.alive=false;return{hit:true,destroyed:!cell.alive};},
  cellCenterWorld:()=>({x:0,y:0})
};
ctx.V8Battle={newGame:()=>({fx:[],combatEvents:[]}),update:()=>{}};
vm.createContext(ctx);
for(const f of ['js/v8/34_v102_ammo.js','js/v8/32_v954_impact_explosion.js','js/v8/37_fire_damage.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const E=ctx.V954ImpactExplosion,F=ctx.V94FireDamage;
assert(E&&F,'impact explosion and fire modules must load');
const base={side:'player',attackPower:72,damage:72};
const solid=E.ammoScales(Object.assign({},base,{ammoType:'solid'}));
const standard=E.ammoScales(Object.assign({},base,{ammoType:'standard'}));
const explosive=E.ammoScales(Object.assign({},base,{ammoType:'explosive'}));
assert(solid.blastRadiusScale<standard.blastRadiusScale,'solid shot must reduce blast radius');
assert(explosive.blastRadiusScale>standard.blastRadiusScale,'explosive shot must enlarge blast radius');
assert(explosive.splashDamageScale>standard.splashDamageScale,'explosive shot must increase splash damage');
assert(explosive.fractureScale>standard.fractureScale,'explosive shot must increase fracture');
assert(explosive.fatigueScale>standard.fatigueScale,'explosive shot must increase fatigue');
const scaled=E.scaleSplashResult({effectiveDamage:10,fractureGain:.10,fatigueGain:.08},Object.assign({},base,{ammoType:'explosive'}));
assert(Math.abs(scaled.effectiveDamage-11.5)<1e-9,'explosive splash damage should apply 1.15x');
assert(Math.abs(scaled.fractureGain-.16)<1e-9,'explosive fracture gain should apply 1.60x');
assert(Math.abs(scaled.fatigueGain-.14)<1e-9,'explosive fatigue gain should apply 1.75x');

const normalDeck={type:'deck',alive:true,burning:false,hp:20};
const explosiveDeck={type:'deck',alive:true,burning:false,hp:20};
assert.strictEqual(F.maybeIgnite({},normalDeck,16,1),false,'base deck fire chance should stay below deterministic 0.30 roll');
assert.strictEqual(F.maybeIgnite({},explosiveDeck,16,1.85),true,'explosive fire scale should raise the same hit above deterministic 0.30 roll');
console.log('V10.2 explosive effect tests passed');
