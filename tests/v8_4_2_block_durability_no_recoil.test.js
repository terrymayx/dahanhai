const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js','js/v8/35_combat_tuning.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const G=ctx.V8ShipGrid,B=ctx.V8Battle;

const ship=G.createTemplateShip('gunship','enemy',1280,560);
const hull=ship.cells.find(c=>c.type==='hull');
const deck=ship.cells.find(c=>c.type==='deck');
const beam=ship.cells.find(c=>c.type==='beam');
const powder=ship.cells.find(c=>c.type==='powder');
assert(hull&&deck&&beam&&powder,'test ship must expose hull/deck/beam/powder cells');
assert(hull.maxHp>=60,'hull block must survive two 24-damage hits');
assert(deck.maxHp>=48,'deck block must require two 24-damage hits');
assert(beam.maxHp>=90,'beam block must be substantially tougher than ordinary blocks');
assert(powder.maxHp>24,'powder block must not disappear from a single normal cannonball');
let r=G.damageCell(ship,hull,24);assert.strictEqual(r.destroyed,false,'first hit must not destroy hull block');
r=G.damageCell(ship,hull,24);assert.strictEqual(r.destroyed,false,'second hit must not destroy hull block');
r=G.damageCell(ship,hull,24);assert.strictEqual(r.destroyed,true,'third normal hit should be enough for hull block');

const state=B.newGame();state.spawnT=999;state.playerFireT=999;
const enemy=B.spawnEnemy(state,'gunship',{x:1280,y:560});
const target=enemy.cells.find(c=>c.type==='hull');
const pos=G.cellCenterWorld(enemy,target);
state.onCellHit(enemy,target,pos,{destroyed:false},{vx:-900,vy:120,damage:24,side:'player'});
B.update(state,.016);
const ph=enemy.physics;
for(const k of ['impulseX','impulseY','angularVelocity','offsetX','offsetY','roll']){
  assert(Math.abs(ph[k]||0)<1e-9,`ship attack recoil ${k} must remain zero`);
}
assert(Number.isFinite(ph.bobPhase),'natural sea bob phase may remain');
console.log('V8.4.2 block durability/no recoil tests passed');
