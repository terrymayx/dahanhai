const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const G=ctx.V8ShipGrid,B=ctx.V8Battle;

function cell(gx,gy,type){
  const hp=type==='beam'?48:28;
  return {gx,gy,type,material:type,hp,maxHp:hp,alive:true,weight:type==='beam'?3:1,flash:0,critical:type==='beam',system:type==='beam'?'structure':null};
}
const cells=[cell(1,1,'beam'),cell(1,2,'hull'),cell(5,5,'hull'),cell(6,5,'deck'),cell(6,6,'hull')];
const cellMap=Object.create(null);for(const c of cells)cellMap[c.gx+','+c.gy]=c;
const ship={id:'synthetic',kind:'gunship',side:'enemy',x:300,y:300,rotation:0,gridWidth:8,gridHeight:8,cellSize:16,cells,cellMap,totalWeight:7,state:'active'};
const detached=cells.slice(2);
const comps=G.detachDisconnectedComponents(ship);
assert(comps.some(c=>c.length===3),'three disconnected cells become one component');
assert(detached.every(c=>!c.alive),'detached original cells are removed from ship');

const state=B.newGame();
state.debrisClusters=[];
B.createDebrisClusters(state,ship,comps);
assert.strictEqual(state.debrisClusters.length,1,'multi-cell component creates one cluster');
const cluster=state.debrisClusters[0];
assert.strictEqual(cluster.cells.length,3,'cluster preserves all component cells');
assert(new Set(cluster.cells.map(c=>c.x+','+c.y)).size===3,'cluster preserves relative cell layout');
const y0=cluster.y,r0=cluster.rotation;
B.updateDebrisClusters(state,.5);
assert(state.debrisClusters.length===1,'cluster remains alive during early debris motion');
assert(cluster.y!==y0||cluster.rotation!==r0,'cluster moves or rotates as a whole');
let sawSink=cluster.phase==='sink'||cluster.sinkProgress>0;
for(let i=0;i<24&&!sawSink;i++){
  B.updateDebrisClusters(state,.25);
  sawSink=cluster.phase==='sink'||cluster.sinkProgress>0;
}
assert(sawSink,'cluster eventually enters sinking phase');
for(let i=0;i<24&&state.debrisClusters.length;i++)B.updateDebrisClusters(state,.25);
assert.strictEqual(state.debrisClusters.length,0,'expired cluster is removed');
console.log('V8.2 debris cluster compatibility tests passed');
