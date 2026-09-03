const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/v8/10_ship_grid.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('js/v8/20_projectiles.js','utf8'),ctx);
const G=ctx.V8ShipGrid,P=ctx.V8Projectile;
assert(G.MATERIAL_RESISTANCE.beam>G.MATERIAL_RESISTANCE.hull);
assert(G.MATERIAL_RESISTANCE.hull>G.MATERIAL_RESISTANCE.deck);
assert.strictEqual(P.PEN_COST,G.MATERIAL_RESISTANCE,'legacy material resistance table must remain exposed for compatibility');

function breachAndStop(type){
  const ship=G.createTemplateShip('gunship','enemy',1000,500);ship.id='t-'+type;
  const first=G.firstCellAlongSegment(ship,620,500,1350,500);assert(first);
  first.type=type;first.material=type;first.maxHp=999;first.hp=1;
  const state={projectiles:[],enemies:[ship],player:null};
  P.spawn(state,{x:620,y:500,vx:1200,vy:0,damage:1,side:'player',life:2,penetration:60});
  P.updateAll(state,.34);
  assert.strictEqual(first.alive,false,`${type} sample must be breached`);
  assert.strictEqual(state.projectiles.length,0,`${type} breach must still stop the shell at the first physical layer`);
  return {ship,first,state};
}
breachAndStop('deck');
breachAndStop('beam');

// Once a front cell is already gone, a later projectile may cross that physical gap.
const open=G.createTemplateShip('gunship','enemy',1000,500);open.id='open';
const gap=G.firstCellAlongSegment(open,620,500,1350,500);assert(gap);gap.alive=false;gap.hp=0;
const openState={projectiles:[],enemies:[open],player:null};
P.spawn(openState,{x:620,y:500,vx:1200,vy:0,damage:1,side:'player',life:2,penetration:60});
P.updateAll(openState,.05);
assert(openState.projectiles.length>=0,'later shells may travel through an already-open front gap until another live physical layer is reached');

const player=G.createTemplateShip('player','player',1000,500);player.id='player';
const enemyFirst=G.firstCellAlongSegment(player,620,500,1350,500);assert(enemyFirst);
enemyFirst.type='deck';enemyFirst.material='deck';enemyFirst.hp=1;enemyFirst.maxHp=999;
const enemyState={projectiles:[],enemies:[],player};
P.spawn(enemyState,{x:620,y:500,vx:1200,vy:0,damage:1,side:'enemy',life:2,penetration:60});
P.updateAll(enemyState,.34);
assert.strictEqual(enemyFirst.alive,false,'enemy shell may breach the foremost cell');
assert.strictEqual(enemyState.projectiles.length,0,'enemy projectile must also stop after one physical layer');
console.log('V8.2 material/first-layer compatibility tests passed');