'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path='js/v8/40_v99_buoyancy.js';
assert.ok(fs.existsSync(path),'V9.9 buoyancy module should exist');
const root={V8ShipGrid:{CELL_WEIGHT:{hull:1,deck:1,beam:3,core:3},cellCenterLocal(ship,c){return{x:(c.gx+.5-ship.gridWidth/2)*ship.cellSize,y:(c.gy+.5-ship.gridHeight/2)*ship.cellSize};},integrity(){return .9;}},V8Battle:{}};
const context={globalThis:root,console,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
const B=root.V99Buoyancy;assert.ok(B,'V99Buoyancy should be exported');
const ship={kind:'player',side:'player',state:'active',gridWidth:4,gridHeight:8,cellSize:8,cells:[],__v99Compartments:[
  {centerLocal:{x:-12,y:-20},capacityWeight:10,water:0,breachWeight:0},
  {centerLocal:{x:12,y:-20},capacityWeight:10,water:.85,breachWeight:2},
  {centerLocal:{x:-12,y:20},capacityWeight:10,water:0,breachWeight:0},
  {centerLocal:{x:12,y:20},capacityWeight:10,water:.65,breachWeight:1}
]};
for(let gy=0;gy<8;gy++)for(let gx=0;gx<4;gx++)ship.cells.push({gx,gy,type:'hull',alive:true,weight:1,hp:36,maxHp:36});
B.prepareShip(ship);
const targets=B.computeTargets(ship);
assert.ok(targets.roll>0,'more water on starboard/right side should create right roll');
assert.ok(Math.abs(targets.trim)>0,'uneven fore/aft flooding should create trim');
assert.ok(targets.buoyancyRatio<1,'flood water should reduce effective buoyancy ratio');
const state={state:'play',player:ship,enemies:[]};
ship.__v99BuoyancyRatio=.1;
B.updateShip(state,ship,.016);
assert.strictEqual(state.state,'play','one short frame of poor buoyancy must not instantly sink the ship');
assert.ok(ship.__v99SinkTimer<.1,'sinking should require sustained failure time');
console.log('V9.9 buoyancy and sinking-gate regression passed');
