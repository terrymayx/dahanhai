const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/v8/10_ship_grid.js','utf8'),ctx);
const G=ctx.V8ShipGrid;
for(const kind of ['sloop','gunship','manowar']){
  const ship=G.createTemplateShip(kind,'enemy',1000,500);
  const types=new Set(ship.cells.map(c=>c.type));
  for(const t of ['beam','powder','rudder','mast','cannon']) assert(types.has(t),`${kind} must contain ${t}`);
  const powders=ship.cells.filter(c=>c.type==='powder');
  assert(powders.length>=1,'powder exists');
  assert(powders.every(c=>{const k=(x,y)=>ship.cellMap[x+','+y];return k(c.gx-1,c.gy)&&k(c.gx+1,c.gy)&&k(c.gx,c.gy-1)&&k(c.gx,c.gy+1);}), 'powder must be internal');
  assert(ship.cells.every(c=>!('node' in c)&&!('sprite' in c)),'cells remain pure data');
}
assert(G.MATERIAL_RESISTANCE.hull===34);
assert(G.MATERIAL_RESISTANCE.deck===24);
assert(G.MATERIAL_RESISTANCE.beam===52);
assert(G.MATERIAL_RESISTANCE.powder===20);
assert(G.MATERIAL_RESISTANCE.rudder===28);
assert(G.MATERIAL_RESISTANCE.mast===30);
assert(G.MATERIAL_RESISTANCE.cannon===30);
console.log('V8.2 component template tests passed');