const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const G=ctx.V8ShipGrid;
assert(G,'V8ShipGrid exists');
assert.strictEqual(typeof G.detachDisconnected,'function','V8.1 must expose detachDisconnected');

const ship=G.createTemplateShip('sloop','enemy',0,0);
const original=ship.cells.slice();
let run=null;
for(let gy=0;gy<ship.gridHeight&&!run;gy++){
  const xs=original.filter(c=>c.gy===gy).map(c=>c.gx).sort((a,b)=>a-b);
  for(let i=0;i<=xs.length-5;i++){
    if(xs[i+4]-xs[i]===4){run=xs.slice(i,i+5).map(gx=>ship.cellMap[gx+','+gy]);break;}
  }
}
assert(run&&run.length===5,'test template must contain a 5-cell horizontal run');
for(const c of ship.cells){c.alive=false;c.hp=0;}
for(const c of run){c.alive=true;c.hp=c.maxHp;}
run[2].alive=false;run[2].hp=0;
const detached=G.detachDisconnected(ship);
assert.strictEqual(detached.length,2,'one 2-cell side of the severed strip must detach');
assert(detached.every(c=>c.alive===false),'detached cells are removed from logical hull');
assert.strictEqual(ship.cells.filter(c=>c.alive).length,2,'only the main connected side remains alive');
console.log('V8.1 structure break test passed');
