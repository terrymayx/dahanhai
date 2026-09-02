const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js','js/v8/35_combat_tuning.js','js/v8/36_damage_model.js','js/v8/37_component_stress.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const B=ctx.V8Battle,S=ctx.V8ComponentStress;
const state=B.newGame();state.spawnT=999;state.playerFireT=999;
const ship=B.spawnEnemy(state,'gunship',{x:900,y:520,stopX:900});
const cannons=ship.cells.filter(c=>c.type==='cannon');
const mast=ship.cells.find(c=>c.type==='mast');
const rudder=ship.cells.find(c=>c.type==='rudder');
assert(cannons.length>0&&mast&&rudder,'gunship must have tested functional parts');

for(const c of cannons)c.hp=c.maxHp*.5;
mast.hp=mast.maxHp*.5;
rudder.hp=rudder.maxHp*.5;
S.refreshShip(ship);
B.recomputeShipSystems(ship);

const expectedSpeed=B.ENEMY.gunship.speed*(.75+.25*.5)*(.55+.45*.5);
assert(Math.abs(ship.speed-expectedSpeed)<1e-9,'mast/rudder partial HP must continuously reduce speed');
assert(Math.abs(ship.cannonEfficiency-(.45+.55*.5))<1e-9,'partial cannon HP must continuously reduce cannon efficiency');
assert.strictEqual(ship.rudderAlive,true,'partial rudder damage must not count as destroyed');
assert.strictEqual(ship.mastAlive,true,'partial mast damage must not count as destroyed');

ship.shotT=10;
const before=ship.shotT;
B.update(state,.05);
const elapsed=before-ship.shotT;
assert(Math.abs(elapsed-.05*ship.cannonEfficiency)<1e-6,'enemy shot countdown must advance at cannonEfficiency rate');
assert.strictEqual(state.shake,0,'progressive component damage must not restore camera shake');

for(const c of cannons){c.hp=0;c.alive=false;}
S.refreshShip(ship);B.recomputeShipSystems(ship);
assert.strictEqual(ship.cannonEfficiency,0,'all cannon positions destroyed must produce zero cannon efficiency');
const frozen=ship.shotT=5;
B.update(state,.05);
assert.strictEqual(ship.shotT,frozen,'destroyed cannons must stop the enemy fire countdown');

console.log('V8.6 progressive system tests passed');
