const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const G=ctx.V8ShipGrid,P=ctx.V8Projectile;

function horizontalRun(ship,min=4){
  for(let gy=0;gy<ship.gridHeight;gy++){
    const cells=ship.cells.filter(c=>c.gy===gy).sort((a,b)=>a.gx-b.gx);
    for(let i=0;i<=cells.length-min;i++)if(cells[i+min-1].gx-cells[i].gx===min-1)return cells.slice(i,i+min);
  }
  throw new Error('no horizontal run');
}

const enemy=G.createTemplateShip('sloop','enemy',600,300);enemy.id='enemy';
const run=horizontalRun(enemy,4);
run[0].hp=Math.min(run[0].hp,20);
const a=G.cellCenterWorld(enemy,run[0]);
const state={enemies:[enemy],player:null,projectiles:[]};
const innerBefore=run[1].hp;
P.spawn(state,{x:a.x-20,y:a.y,vx:520,vy:0,damage:24,side:'player',life:2,penetration:78});
for(let i=0;i<12;i++)P.updateAll(state,.05);
assert.strictEqual(run[0].alive,false,'first weakened armor cell must be breached');
assert.strictEqual(state.projectiles.length,0,'the shell that creates the breach must stop at the first physical layer');
assert.strictEqual(run[1].hp,innerBefore,'the same shell must not damage an inner cell behind the breached front layer');

// A later shell may enter through the already-open gap and hit the next live layer.
const secondBefore=run[1].hp;
P.spawn(state,{x:a.x-20,y:a.y,vx:520,vy:0,damage:24,side:'player',life:2,penetration:78});
for(let i=0;i<12;i++)P.updateAll(state,.05);
assert(run[1].hp<secondBefore||!run[1].alive,'a later shell may hit the next live layer through an existing breach');

const player=G.createTemplateShip('sloop','player',600,500);player.id='player';
const row2=horizontalRun(player,4),p0=G.cellCenterWorld(player,row2[0]);
row2[0].hp=Math.min(row2[0].hp,16);
const innerPlayerBefore=row2[1].hp;
const state2={enemies:[],player,projectiles:[]};
P.spawn(state2,{x:p0.x-20,y:p0.y,vx:520,vy:0,damage:18,side:'enemy',life:2,penetration:78});
for(let i=0;i<12;i++)P.updateAll(state2,.05);
assert.strictEqual(row2[0].alive,false,'enemy shell may breach the first weakened player cell');
assert.strictEqual(state2.projectiles.length,0,'enemy shell must also stop after one physical layer');
assert.strictEqual(row2[1].hp,innerPlayerBefore,'enemy shell must not damage a second layer in the same impact');
console.log('V8.1 one-shell-one-layer penetration compatibility test passed');
