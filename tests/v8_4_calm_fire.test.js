const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js','js/v8/35_combat_tuning.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const C=ctx.V8Config,B=ctx.V8Battle;

assert(C.PLAYER_FIRE_INTERVAL>=1.25,'player firing cycle must be slower than V8.4');
for(const kind of ['sloop','gunship','manowar']){
  assert(B.ENEMY[kind].fireMin>=2.8,`${kind} enemy cannon frequency must be reduced`);
}

const state=B.newGame();state.spawnT=999;state.playerFireT=999;
const enemy=B.spawnEnemy(state,'gunship',{x:1280,y:560});
B.startPlayerSalvo(state,enemy);
B.update(state,.01);
assert.strictEqual(state.shotIndex,1,'reduced salvo still starts with one shell');
for(let i=0;i<30;i++)B.update(state,.05);
assert.strictEqual(state.shotIndex,2,'one player salvo must now fire exactly two shells');
assert.strictEqual(state.salvo,null,'two-shell salvo must finish cleanly');

const feedback=B.newGame();
B.emitCombatEvent(feedback,'impact_medium',{x:10,y:10});
B.emitCombatEvent(feedback,'powder_blast',{x:10,y:10});
assert.strictEqual(feedback.shake,0,'combat feedback must not create camera shake');
assert(feedback.hitStop>0,'hit-stop may remain even when camera shake is disabled');

const html=fs.readFileSync('index.html','utf8');
for(const f of ['00_v8_base.js','10_ship_grid.js','20_projectiles.js','30_battle.js','35_combat_tuning.js','40_render.js','50_input_loop.js']){
  assert(html.includes(`js/v8/${f}?v=8.4.2`),`${f} must use V8.4.2 cache key`);
}
console.log('V8.4.2 calm fire tests passed');
