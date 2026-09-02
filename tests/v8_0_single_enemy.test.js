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
assert.strictEqual(B.activeEnemies(state).length,2,'first spawn should create exactly one enemy pair');

state.spawnT=0;
B.update(state,.05);
assert.strictEqual(B.activeEnemies(state).length,2,'while the pair is alive, no extra enemies may spawn');

let active=B.activeEnemies(state);
active[0].state='sink';active[0].sinkT=0;
state.spawnT=0;
B.update(state,.05);
assert.strictEqual(B.activeEnemies(state).length,1,'one surviving partner must block replacement spawning');

active=B.activeEnemies(state);
active[0].state='sink';active[0].sinkT=0;
state.spawnT=0;
B.update(state,.05);
assert.strictEqual(B.activeEnemies(state).length,2,'after both enemies sink, the next pair may spawn');

console.log('V8 paired-enemy spawn regression passed');
