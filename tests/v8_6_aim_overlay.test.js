const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const source=fs.readFileSync('js/v8/45_damage_overlay.js','utf8');
for(const forbidden of ['进水','flooding','ship.leaks','ship.draft'])assert(!source.includes(forbidden),`V8.6 overlay must remain flooding-free: ${forbidden}`);
for(const token of ['cell.stress','stressRupture','formatAimInfo','resolveAimCell'])assert(source.includes(token),`V8.6 overlay must include ${token}`);

const ctx={console,Math};ctx.globalThis=ctx;
ctx.V8Config={W:1920,H:1080};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/v8/10_ship_grid.js','utf8'),ctx,{filename:'grid'});
vm.runInContext(fs.readFileSync('js/v8/37_component_stress.js','utf8'),ctx,{filename:'stress'});
ctx.V8Render={draw(){},shipVisualPose(ship){return {x:ship.x||0,y:ship.y||0,rotation:ship.rotation||0,alpha:1};}};
vm.runInContext(source,ctx,{filename:'overlay'});
const R=ctx.V8Render,S=ctx.V8ComponentStress;
assert.strictEqual(typeof R.resolveAimCell,'function');
assert.strictEqual(typeof R.formatAimInfo,'function');

const beam={gx:2,gy:1,type:'beam',material:'beam',hp:52,maxHp:96,alive:true};
const ship={id:'enemy-1',kind:'gunship',side:'enemy',x:900,y:500,rotation:0,gridWidth:5,gridHeight:3,cellSize:16,cells:[beam],cellMap:{'2,1':beam},structureStress:.48,cannonEfficiency:.72,mastEfficiency:.81,rudderEfficiency:.65,powderDanger:1};
const state={player:null,enemies:[ship],aim:{shipId:'enemy-1',gx:2,gy:1}};
const resolved=R.resolveAimCell(state);
assert(resolved&&resolved.ship===ship&&resolved.cell===beam,'aim must resolve the exact current cell');
let info=R.formatAimInfo(ship,beam);
assert.strictEqual(info.primary,'主梁 52 / 96 · 受损');
assert.strictEqual(info.detail,'结构应力 48%');

const cannon={type:'cannon',hp:30,maxHp:56,alive:true};
info=R.formatAimInfo(ship,cannon);assert.strictEqual(info.detail,'炮效 72%');
const mast={type:'mast',hp:30,maxHp:56,alive:true};
info=R.formatAimInfo(ship,mast);assert.strictEqual(info.detail,'帆效 81%');
const rudder={type:'rudder',hp:20,maxHp:52,alive:true};
info=R.formatAimInfo(ship,rudder);assert.strictEqual(info.detail,'舵效 65%');
const powder={type:'powder',hp:10,maxHp:36,alive:true};
assert.strictEqual(S.componentStage(powder),'critical');
info=R.formatAimInfo(ship,powder);assert.strictEqual(info.detail,'危险');

console.log('V8.6 aim overlay tests passed');
