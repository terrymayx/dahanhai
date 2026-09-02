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

function oneHit(type,side){
  const ship=G.createTemplateShip('gunship','enemy',1000,500);ship.id='t';
  const first=G.firstCellAlongSegment(ship,620,500,1350,500);assert(first);
  first.type=type;first.material=type;first.hp=first.maxHp=999;
  const state={projectiles:[],enemies:[ship],player:null};
  P.spawn(state,{x:620,y:500,vx:1200,vy:0,damage:1,side:side||'player',life:2,penetration:60});
  P.updateAll(state,.34);
  return state.projectiles[0]||null;
}
const deck=oneHit('deck','player');
assert(deck,'deck hit with 60 penetration should survive');
assert.strictEqual(deck.penetration,60-G.MATERIAL_RESISTANCE.deck);
const beam=oneHit('beam','player');
assert(beam,'beam hit still has 8 penetration after one hit');
assert.strictEqual(beam.penetration,60-G.MATERIAL_RESISTANCE.beam);
const enemy=oneHit('deck','enemy');
assert.strictEqual(enemy,null,'enemy projectile must stop after one cell');
console.log('V8.2 material penetration tests passed');