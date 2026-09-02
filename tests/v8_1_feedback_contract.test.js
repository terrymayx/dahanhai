const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const G=ctx.V8ShipGrid,B=ctx.V8Battle;
const state=B.newGame();
const ship=B.spawnEnemy(state,'sloop',{x:900,y:500});
let run=null;
for(let gy=0;gy<ship.gridHeight&&!run;gy++){
  const xs=ship.cells.filter(c=>c.gy===gy).map(c=>c.gx).sort((a,b)=>a-b);
  for(let i=0;i<=xs.length-5;i++)if(xs[i+4]-xs[i]===4){run=xs.slice(i,i+5).map(gx=>ship.cellMap[gx+','+gy]);break;}
}
assert(run&&run.length===5,'test needs a five-cell structural strip');
for(const c of ship.cells){c.alive=false;c.hp=0;}
for(const c of run){c.alive=true;c.hp=c.maxHp;}
const bridge=run[2];bridge.alive=false;bridge.hp=0;
const pos=G.cellCenterWorld(ship,bridge);
state.onCellDestroyed(ship,bridge,pos,{side:'player',damage:24});
assert(state.hitStop>0&&state.hitStop<=.07,'structure break must create a short hit-stop');
assert(state.shake>=9,'structure break must create strong screen shake');
assert(state.fx.some(f=>f.k==='structureBreak'),'structure break FX must be emitted');
const debrisCells=state.fx.filter(f=>f.k==='debris').length+(state.debrisClusters||[]).reduce((n,c)=>n+(c.cells||[]).length,0);
assert(debrisCells>=2,'detached cells must remain visibly represented as debris or clusters');
assert(ship.cells.filter(c=>c.alive).length===2,'disconnected side must be removed from the logical ship');

const render=fs.readFileSync('js/v8/40_render.js','utf8');
assert(render.includes('V8.'),'HUD must identify the active V8 version');
assert(render.includes("f.k==='structureBreak'")||render.includes('structureBreak'),'renderer must draw structural break FX');
assert(render.includes("f.k==='debris'")||render.includes('debrisClusters'),'renderer must draw detached structure');
assert(render.includes('state.aim'),'renderer must draw the local click aim marker');
console.log('V8.1 feedback contract test passed');
