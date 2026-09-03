'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const armorPath='js/v8/34_v98_armor.js';
const materialPath='js/v8/34_v99_material.js';
assert.ok(fs.existsSync(armorPath),'V9.8 armor module should exist');
assert.ok(fs.existsSync(materialPath),'V9.9 material module should exist');

const root={};
const context={globalThis:root,console};
vm.createContext(context);
vm.runInContext(fs.readFileSync(armorPath,'utf8'),context,{filename:armorPath});
vm.runInContext(fs.readFileSync(materialPath,'utf8'),context,{filename:materialPath});
const M=root.V99Material;
assert.ok(M,'V99Material should be exported');

const ship={kind:'gunship',gridWidth:3,gridHeight:3,cellSize:8,cellMap:Object.create(null)};
for(let gy=0;gy<3;gy++)for(let gx=0;gx<3;gx++){
  if(gx===0&&gy===1)continue;
  ship.cellMap[gx+','+gy]={gx,gy,type:'hull',alive:true,hp:36,maxHp:36};
}
const cell={gx:0,gy:1,type:'hull',alive:true,hp:36,maxHp:36};
ship.cellMap['0,1']=cell;
M.prepareCell(ship,cell);
const initial=cell.armorHp;
const headOn=M.resolveDirect(ship,cell,{vx:900,vy:0,damage:72,attackPower:72});
assert.ok(headOn.impactCos>.9,'head-on shot should have near-normal incidence');
M.applyImpactState(ship,cell,headOn);
assert.ok(cell.armorHp<initial,'a direct impact should wear local armor');
const afterFirst=cell.armorHp;
const second=M.resolveDirect(ship,cell,{vx:900,vy:0,damage:72,attackPower:72});
M.applyImpactState(ship,cell,second);
assert.ok(cell.armorHp<afterFirst,'repeated hits should continue weakening the same local armor');
assert.ok(cell.fatigue>0&&cell.fracture>0,'repeated heavy impacts should accumulate fatigue and fracture');

const fresh={gx:0,gy:1,type:'hull',alive:true,hp:36,maxHp:36};
ship.cellMap['0,1']=fresh;
M.prepareCell(ship,fresh);
const straight=M.resolveDirect(ship,fresh,{vx:900,vy:0,damage:48,attackPower:48});
const shallow=M.resolveDirect(ship,fresh,{vx:5,vy:900,damage:24,attackPower:24});
assert.ok(shallow.effectiveArmor>straight.effectiveArmor,'shallow incidence should increase effective armor');
assert.ok(shallow.ricochet,'low-power shallow shot should be a ricochet candidate');
assert.strictEqual(M.gradeLabel('ricochet'),'跳弹');

console.log('V9.9 material fatigue and angle regression passed');
