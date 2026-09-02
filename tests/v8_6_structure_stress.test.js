const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js','js/v8/35_combat_tuning.js','js/v8/36_damage_model.js','js/v8/37_component_stress.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const S=ctx.V8ComponentStress;
assert.strictEqual(typeof S.applyStressRupture,'function','V8.6 must expose applyStressRupture');

function c(gx,gy,type,hp,maxHp,alive=true){return {gx,gy,type,material:type,hp,maxHp,alive,weight:type==='beam'?3:1,flash:0,critical:type==='beam',system:type==='beam'?'structure':null};}
const cells=[
  c(0,0,'hull',60,60),c(0,1,'deck',48,48),
  c(1,0,'deck',4,48),
  c(2,0,'deck',48,48),c(2,1,'beam',96,96),
  c(1,1,'beam',0,96,false)
];
const ship={id:'stress-test',kind:'gunship',side:'enemy',x:900,y:500,rotation:0,gridWidth:5,gridHeight:3,cellSize:16,cells,cellMap:Object.create(null),totalWeight:10,baseColor:'#555',deckColor:'#987',state:'active',speed:60,baseSpeed:60,physics:{impulseX:0,impulseY:0,angularVelocity:0,offsetX:0,offsetY:0,roll:0}};
for(const cell of cells)ship.cellMap[cell.gx+','+cell.gy]=cell;
const source=cells[5],connector=cells[2],healthy=cells[3];
const state={fx:[],debrisClusters:[],combatEvents:[],shake:0,hitStop:0,time:0};
S.refreshShip(ship);
assert(ship.structureStress>=.34,'fixture must start in strained structure state');
const healthyBefore=healthy.hp;
const result=S.applyStressRupture(state,ship,source,{x:900,y:500});
assert(connector.alive===false,'already-critical connector may fail under stress rupture');
assert(healthy.alive===true&&healthy.hp>0,'healthy neighbor must never be one-shot by stress rupture');
assert(healthy.hp<healthyBefore,'healthy neighbor may take bounded stress damage');
assert(result.components.length>0,'stress failure of connector must create a newly disconnected component');
assert(state.debrisClusters.some(cl=>(cl.cells||[]).length>=2),'newly disconnected multi-cell piece must become a coherent debris cluster');
assert(state.fx.some(f=>f.k==='stressRupture'),'stress rupture must have local visual feedback');
assert.strictEqual(state.shake,0,'stress rupture must not create camera shake');
for(const k of ['impulseX','impulseY','angularVelocity','offsetX','offsetY','roll'])assert.strictEqual(ship.physics[k],0,'stress rupture must not create ship recoil');
console.log('V8.6 structure stress tests passed');
