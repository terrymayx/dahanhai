const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;
vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const P=ctx.V8Projectile,B=ctx.V8Battle;
assert.strictEqual(typeof P.computeArcHeight,'function','V8.4 must expose adaptive arc height');
assert(P.computeArcHeight('player',1400)>P.computeArcHeight('player',300),'far player shots must arc higher than close shots');
assert(P.computeArcHeight('player',900)>P.computeArcHeight('enemy',900),'player heavy cannon arc must remain higher than enemy fire');

const state=B.newGame();
state.enemies=[];
const p=P.spawn(state,{x:100,y:100,vx:300,vy:0,side:'player',flightTime:.5,arcHeight:P.computeArcHeight('player',600),life:2});
for(let i=0;i<40;i++)P.updateAll(state,.025);
assert(Array.isArray(p.trail),'projectile must own lightweight trail samples');
assert(p.trail.length<=8,'one projectile trail must stay capped at 8 samples');
assert(state.fx.some(f=>f.k==='waterSplash'),'missed arc completion must create water splash');
assert(state.fx.some(f=>f.k==='waterRing'),'missed arc completion must create water ring');
assert(state.fx.some(f=>f.k==='foam'),'missed arc completion must create foam');
assert(!state.projectiles.includes(p),'missed projectile must be removed after splash');
console.log('V8.4 ballistic feel tests passed');
