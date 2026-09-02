const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/v8/10_ship_grid.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('js/v8/20_projectiles.js','utf8'),ctx);
const G=ctx.V8ShipGrid,P=ctx.V8Projectile;
assert(G.MATERIAL_RESISTANCE.beam>G.MATERIAL_RESISTANCE.hull);
assert(G.MATERIAL_RESISTANCE.hull>G.MATERIAL_RESISTANCE.deck);
assert.strictEqual(P.PEN_COST,G.MATERIAL_RESISTANCE,'projectiles must use Grid material table');

function playerBreaches(type){
  const ship=G.createTemplateShip('gunship','enemy',1000,500);ship.id='t';
  const first=G.firstCellAlongSegment(ship,620,500,1350,500);assert(first);
  first.type=type;first.material=type;first.maxHp=999;first.hp=1;
  const state={projectiles:[],enemies:[ship],player:null};
  P.spawn(state,{x:620,y:500,vx:1200,vy:0,damage:1,side:'player',life:2,penetration:60});
  P.updateAll(state,.34);
  assert.strictEqual(first.alive,false,`${type} sample must be breached so V8.5 can continue penetration`);
  return state.projectiles[0]||null;
}
const deck=playerBreaches('deck');
assert(deck,'breached deck with 60 penetration should continue');
assert.strictEqual(deck.penetration,60-G.MATERIAL_RESISTANCE.deck);
const beam=playerBreaches('beam');
assert(beam,'breached beam still has penetration after material cost');
assert.strictEqual(beam.penetration,60-G.MATERIAL_RESISTANCE.beam);

const player=G.createTemplateShip('player','player',1000,500);player.id='player';
const enemyFirst=G.firstCellAlongSegment(player,620,500,1350,500);assert(enemyFirst);
enemyFirst.type='deck';enemyFirst.material='deck';enemyFirst.hp=enemyFirst.maxHp=999;
const enemyState={projectiles:[],enemies:[],player};
P.spawn(enemyState,{x:620,y:500,vx:1200,vy:0,damage:1,side:'enemy',life:2,penetration:60});
P.updateAll(enemyState,.34);
assert.strictEqual(enemyState.projectiles.length,0,'enemy projectile must stop after one cell');
console.log('V8.2 material penetration compatibility tests passed');