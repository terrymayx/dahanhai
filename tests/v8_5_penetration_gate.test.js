const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/10_ship_grid.js','js/v8/20_projectiles.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const P=ctx.V8Projectile;
function ship(hp){
  const cell={gx:0,gy:0,type:'hull',material:'hull',hp,maxHp:60,alive:true,weight:1,flash:0};
  return {id:'e1',kind:'sloop',side:'enemy',x:100,y:100,rotation:0,gridWidth:1,gridHeight:1,cellSize:20,cells:[cell],cellMap:{'0,0':cell},totalWeight:1,state:'active'};
}
function stateWith(target){return {player:null,enemies:[target],projectiles:[],onCellHit(){},onCellDestroyed(){},onShipCritical(){}};}
let target=ship(60),state=stateWith(target);
P.spawn(state,{x:45,y:100,vx:600,vy:0,damage:24,side:'player',life:2,penetration:78,arcHeight:0,flightTime:.2});
P.updateAll(state,.1);
assert.strictEqual(target.cells[0].alive,true,'first hit must only damage durable hull');
assert.strictEqual(state.projectiles.length,0,'non-destroying armor hit must stop the shell');

target=ship(20);state=stateWith(target);
P.spawn(state,{x:45,y:100,vx:600,vy:0,damage:24,side:'player',life:2,penetration:78,arcHeight:0,flightTime:.2});
P.updateAll(state,.1);
assert.strictEqual(target.cells[0].alive,false,'low-HP hull must be breached');
assert.strictEqual(state.projectiles.length,0,'the shell that creates a breach must still stop at the first physical layer');

// A later shell may travel through an already-open gap because the front physical cell is gone.
P.spawn(state,{x:45,y:100,vx:600,vy:0,damage:24,side:'player',life:2,penetration:78,arcHeight:0,flightTime:.2});
P.updateAll(state,.1);
assert.strictEqual(state.projectiles.length,1,'a later shell may continue through a previously opened gap');
console.log('V8.5 one-shell-one-layer penetration gate tests passed');
