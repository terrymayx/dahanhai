'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path='js/v8/37_v99_compartments.js';
assert.ok(fs.existsSync(path),'V9.9 compartment module should exist');
const root={V8ShipGrid:{CELL_WEIGHT:{hull:1,deck:1,beam:3,core:3},cellCenterLocal(ship,c){return{x:(c.gx+.5-ship.gridWidth/2)*ship.cellSize,y:(c.gy+.5-ship.gridHeight/2)*ship.cellSize};},integrity(){return 1;}}};
const context={globalThis:root,console,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
const C=root.V99Compartments;assert.ok(C,'V99Compartments should be exported');
for(const [kind,count] of [['sloop',4],['gunship',5],['manowar',6],['player',8]]){
  const ship={kind,gridWidth:8,gridHeight:8,cellSize:8,cells:[],cellMap:Object.create(null)};
  for(let gy=0;gy<8;gy++)for(let gx=0;gx<8;gx++){const c={gx,gy,type:'hull',alive:true,hp:36,maxHp:36,weight:1};ship.cells.push(c);ship.cellMap[gx+','+gy]=c;}
  C.prepareShip(ship);assert.strictEqual(ship.__v99Compartments.length,count,kind+' should use the expected compartment count');
}
const ship={kind:'gunship',gridWidth:3,gridHeight:3,cellSize:8,cells:[],cellMap:Object.create(null),__v96DamageRevision:1};
for(let gy=0;gy<3;gy++)for(let gx=0;gx<3;gx++){const c={gx,gy,type:(gx===1&&gy===1)?'beam':'hull',alive:true,hp:36,maxHp:36,weight:1};ship.cells.push(c);ship.cellMap[gx+','+gy]=c;}
C.prepareShip(ship);
const internal=ship.cellMap['1,1'];internal.alive=false;internal.hp=0;
assert.strictEqual(C.isOpenWaterBreach(ship,internal),false,'an isolated destroyed internal beam must not leak seawater');
const edge=ship.cellMap['0,1'];edge.alive=false;edge.hp=0;ship.__v96DamageRevision++;
assert.strictEqual(C.isOpenWaterBreach(ship,edge),true,'a destroyed exterior hull cell should connect to open water');
C.refreshBreaches(ship);
assert.ok(ship.__v99OpenBreaches.includes(edge),'open-water breach should be registered');
assert.ok(!ship.__v99OpenBreaches.includes(internal),'internal damage should stay out of breach list');
console.log('V9.9 open-water compartment regression passed');
