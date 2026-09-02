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
assert.strictEqual(B.activeEnemies(state).length,1,'first spawn should create exactly one active enemy');

state.spawnT=0;
B.update(state,.05);
assert.strictEqual(B.activeEnemies(state).length,1,'while one enemy is alive, no second enemy may spawn');

const first=B.activeEnemies(state)[0];
first.state='sink';
first.sinkT=0;
state.spawnT=0;
B.update(state,.05);
assert.strictEqual(B.activeEnemies(state).length,1,'after the current enemy sinks, the next enemy may spawn');

console.log('V8.0 single-enemy tests passed');
