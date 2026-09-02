const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const src=fs.readFileSync('js/v8/10_ship_grid.js','utf8');
const ctx={console,Math};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'10_ship_grid.js'});
const G=ctx.V8ShipGrid;
assert(G,'V8ShipGrid must be exported on globalThis');

const expected={
  player:[20,34],
  sloop:[18,8],
  gunship:[22,10],
  manowar:[28,12],
};
for(const [kind,[w,h]] of Object.entries(expected)){
  const ship=G.createTemplateShip(kind,kind==='player'?'player':'enemy',1000,500);
  assert.strictEqual(ship.gridWidth,w,`${kind} grid width`);
  assert.strictEqual(ship.gridHeight,h,`${kind} grid height`);
  assert(ship.cells.length>50,`${kind} should have meaningful occupied cells`);
  assert(ship.cells.every(c=>!('node' in c)&&!('sprite' in c)),`${kind} cells must be pure data`);
  assert.strictEqual(G.integrity(ship),1,`${kind} starts at full integrity`);
}

const ship=G.createTemplateShip('gunship','enemy',1000,500);
const first=G.firstCellAlongSegment(ship,650,500,1350,500);
assert(first&&first.alive,'segment through hull must hit first live cell');
const before=ship.cells.filter(c=>c.alive).length;
G.damageCell(ship,first,999);
assert.strictEqual(first.alive,false,'destroyed cell must become non-live');
assert.strictEqual(ship.cells.filter(c=>c.alive).length,before-1,'exactly one cell disappears');
assert(G.integrity(ship)<1,'destroying a structural cell lowers integrity');

const second=G.firstCellAlongSegment(ship,650,500,1350,500);
assert(second&&second!==first,'the next shot enters through the newly exposed cell, not the dead cell');

const local=G.worldToLocal(ship,ship.x,ship.y);
assert(Math.abs(local.x)<1e-6&&Math.abs(local.y)<1e-6,'ship center maps to local origin');

const projectileSrc=fs.readFileSync('js/v8/20_projectiles.js','utf8');
vm.runInContext(projectileSrc,ctx,{filename:'20_projectiles.js'});
const P=ctx.V8Projectile;
assert(P,'V8Projectile must be exported on globalThis');
const target=G.createTemplateShip('gunship','enemy',1000,500);
const hpBefore=new Map(target.cells.map(c=>[`${c.gx},${c.gy}`,c.hp]));
const state={projectiles:[],enemies:[target],player:null};
P.spawn(state,{x:620,y:500,vx:1200,vy:0,damage:24,side:'player',life:2});
P.updateAll(state,.5);
const changed=target.cells.filter(c=>c.hp!==hpBefore.get(`${c.gx},${c.gy}`));
assert.strictEqual(changed.length,1,'one collision step damages the first live cell in its path');
assert.strictEqual(changed[0].maxHp-changed[0].hp,24,'projectile damage is applied to that first cell');
assert.strictEqual(state.projectiles.length,1,'V8.1 player projectile remains active while penetration is left');
assert(state.projectiles[0].penetration<78,'first-cell impact consumes penetration power');

console.log('V8 ShipGrid + first-hit projectile tests passed');
