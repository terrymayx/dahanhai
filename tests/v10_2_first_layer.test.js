const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/34_v102_ammo.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const P=ctx.V8Projectile;

function makeShip(){
  const a={gx:0,gy:0,type:'hull',material:'hull',hp:10,maxHp:60,alive:true,weight:1,flash:0};
  const b={gx:1,gy:0,type:'hull',material:'hull',hp:60,maxHp:60,alive:true,weight:1,flash:0};
  return {id:'e1',kind:'sloop',side:'enemy',x:100,y:100,rotation:0,gridWidth:2,gridHeight:1,cellSize:20,cells:[a,b],cellMap:{'0,0':a,'1,0':b},totalWeight:2,state:'active'};
}
function stateFor(ship){return {player:null,enemies:[ship],projectiles:[],onCellHit(){},onCellDestroyed(){},onShipCritical(){}};}
for(const ammoType of ['solid','chain','explosive']){
  const ship=makeShip(),state=stateFor(ship);
  P.spawn(state,{x:50,y:100,vx:400,vy:0,damage:40,attackPower:40,side:'player',life:2,arcHeight:0,flightTime:.2,ammoType});
  P.updateAll(state,.2);
  assert.strictEqual(ship.cells[0].alive,false,`${ammoType} should be able to breach the weak front layer`);
  assert.strictEqual(ship.cells[1].hp,60,`${ammoType} must not damage the second live layer in the same shot`);
  assert.strictEqual(state.projectiles.length,0,`${ammoType} projectile must stop after consuming the front physical hit`);

  P.spawn(state,{x:50,y:100,vx:400,vy:0,damage:40,attackPower:40,side:'player',life:2,arcHeight:0,flightTime:.2,ammoType});
  P.updateAll(state,.2);
  assert(ship.cells[1].hp<60,`${ammoType} later projectile may pass through the already-open breach`);
}
console.log('V10.2 one-shell-one-layer tests passed');
