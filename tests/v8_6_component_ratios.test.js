const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

assert(fs.existsSync('js/v8/37_component_stress.js'),'V8.6 component stress module must exist');

const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/10_ship_grid.js','js/v8/37_component_stress.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const S=ctx.V8ComponentStress;
assert(S,'V8ComponentStress must be exported');

const sample={alive:true,hp:67,maxHp:100};
assert.strictEqual(S.componentStage(sample),'healthy');
sample.hp=66;assert.strictEqual(S.componentStage(sample),'damaged');
sample.hp=34;assert.strictEqual(S.componentStage(sample),'damaged');
sample.hp=33;assert.strictEqual(S.componentStage(sample),'critical');
sample.hp=0;sample.alive=false;assert.strictEqual(S.componentStage(sample),'destroyed');

function c(type,hp,maxHp,alive=true,gx=0,gy=0){return {type,material:type,hp,maxHp,alive,gx,gy,stress:0};}
const ship={kind:'gunship',side:'enemy',cells:[
  c('cannon',56,56,true,0,0),c('cannon',28,56,true,1,0),
  c('mast',14,56,true,2,0),c('rudder',26,52,true,3,0),
  c('beam',96,96,true,4,0),c('beam',0,96,false,5,0),
  c('powder',10,36,true,6,0),c('hull',60,60,true,7,0)
]};
const ratios=S.shipSystemRatios(ship);
assert(Math.abs(ratios.cannon-.75)<1e-9,'cannon ratio must aggregate remaining HP');
assert(Math.abs(ratios.mast-.25)<1e-9,'mast ratio must aggregate remaining HP');
assert(Math.abs(ratios.rudder-.5)<1e-9,'rudder ratio must aggregate remaining HP');
assert(Math.abs(ratios.beam-.5)<1e-9,'beam ratio must include destroyed beam as zero HP');
assert(Math.abs(ratios.powder-(10/36))<1e-9,'powder ratio must aggregate remaining HP');

S.refreshShip(ship);
assert(Math.abs(ship.beamIntegrity-.5)<1e-9);
assert(Math.abs(ship.structureStress-.5)<1e-9);
assert.strictEqual(ship.structureStressStage,'strained');
assert(Math.abs(ship.cannonEfficiency-.8625)<1e-9);
assert(Math.abs(ship.mastEfficiency-.8125)<1e-9);
assert(Math.abs(ship.rudderEfficiency-.775)<1e-9);
assert.strictEqual(ship.powderDanger,1,'critical powder must expose danger=1 without exploding');

console.log('V8.6 component ratio tests passed');
