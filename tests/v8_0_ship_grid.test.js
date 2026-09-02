const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const src=fs.readFileSync('js/v8/10_ship_grid.js','utf8');
const ctx={console,Math};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'10_ship_grid.js'});
const G=ctx.V8ShipGrid;
assert(G,'V8ShipGrid must be exported on globalThis');

const expected={
  player:[20,34],
  sloop:[18,8],
  gunship:[22,10],
  manowar:[28,12],
};
for(const [kind,[w,h]] of Object.entries(expected)){
  const ship=G.createTemplateShip(kind,kind==='player'?'player':'enemy',1000,500);
  assert.strictEqual(ship.gridWidth,w,`${kind} grid width`);
  assert.strictEqual(ship.gridHeight,h,`${kind} grid height`);
  assert(ship.cells.length>50,`${kind} should have meaningful occupied cells`);
  assert(ship.cells.every(c=>!('node' in c)&&!('sprite' in c)),`${kind} cells must be pure data`);
  assert.strictEqual(G.integrity(ship),1,`${kind} starts at full integrity`);
}

const ship=G.createTemplateShip('gunship','enemy',1000,500);
const first=G.firstCellAlongSegment(ship,650,500,1350,500);
assert(first&&first.alive,'segment through hull must hit first live cell');
const before=ship.cells.filter(c=>c.alive).length;
G.damageCell(ship,first,999);
assert.strictEqual(first.alive,false,'destroyed cell must become non-live');
assert.strictEqual(ship.cells.filter(c=>c.alive).length,before-1,'exactly one cell disappears');
assert(G.integrity(ship)<1,'destroying a structural cell lowers integrity');

const second=G.firstCellAlongSegment(ship,650,500,1350,500);
assert(second&&second!==first,'the next shot enters through the newly exposed cell, not the dead cell');

const local=G.worldToLocal(ship,ship.x,ship.y);
assert(Math.abs(local.x)<1e-6&&Math.abs(local.y)<1e-6,'ship center maps to local origin');

console.log('V8.0 ShipGrid tests passed');
