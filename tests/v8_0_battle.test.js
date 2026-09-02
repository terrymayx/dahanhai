const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;
vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const B=ctx.V8Battle,G=ctx.V8ShipGrid;
assert(B&&G,'V8 battle and grid modules must exist');
const state=B.newGame();
assert(state.player&&state.player.kind==='player','new game has a grid flagship');
assert(state.player.cells.length>100,'flagship is composed of many cells');
assert(Array.isArray(state.enemies)&&Array.isArray(state.projectiles),'battle arrays exist');

const e=B.spawnEnemy(state,'sloop',{x:1500,y:500});
assert(e&&e.kind==='sloop'&&e.cells.length>50,'spawned enemy is a grid ship');
assert(state.enemies.includes(e),'spawned enemy enters battle state');

for(const c of e.cells){c.alive=false;c.hp=0;}
e.cells[0].alive=true;e.cells[0].hp=e.cells[0].maxHp;
B.evaluateShip(state,e);
assert.strictEqual(e.state,'sink','enemy below 34% structural integrity sinks');

for(const c of state.player.cells){c.alive=false;c.hp=0;}
state.player.cells[0].alive=true;state.player.cells[0].hp=state.player.cells[0].maxHp;
B.evaluateShip(state,state.player);
assert.strictEqual(state.state,'lose','player below 24% structural integrity loses');

const live=B.newGame();
const target=B.spawnEnemy(live,'sloop',{x:1100,y:560});
live.state='playing';live.playerFireT=0;
B.update(live,.1);
assert(live.projectiles.some(p=>p.side==='player'),'player auto-fire creates a cell-damage projectile');

console.log('V8.0 battle tests passed');
