const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;
vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const B=ctx.V8Battle;
assert(B,'V8 battle module must exist');

const state=B.newGame();
state.spawnT=0;
B.update(state,.05);
let active=B.activeEnemies(state);
assert.strictEqual(active.length,2,'a spawn cycle must create exactly two active enemy ships');
assert(Math.abs(active[0].x-active[1].x)<=160,'paired enemy ships must remain in one coherent formation');
assert(Math.abs(active[0].y-active[1].y)>=220,'paired enemy ships must be visibly separated vertically');

active[0].state='sink';active[0].sinkT=0;
state.spawnT=0;
B.update(state,.05);
active=B.activeEnemies(state);
assert.strictEqual(active.length,1,'sinking only one ship must not replace it while its pair remains active');

active[0].state='sink';active[0].sinkT=0;
state.spawnT=0;
B.update(state,.05);
active=B.activeEnemies(state);
assert.strictEqual(active.length,2,'after both ships sink, the next pair may spawn together');

console.log('V8.2 two-enemy pair tests passed');
