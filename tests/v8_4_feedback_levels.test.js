const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;
vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js']){
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
}
const B=ctx.V8Battle;
assert.strictEqual(typeof B.feedbackLevelFor,'function','V8.4 must expose feedbackLevelFor');
assert.strictEqual(typeof B.emitCombatEvent,'function','V8.4 must expose emitCombatEvent');
assert.strictEqual(B.feedbackLevelFor({type:'deck'},{destroyed:false}),'light');
assert.strictEqual(B.feedbackLevelFor({type:'hull'},{destroyed:true}),'medium');
assert.strictEqual(B.feedbackLevelFor({type:'beam'},{destroyed:true}),'heavy');
assert.strictEqual(B.feedbackLevelFor({type:'powder'},{destroyed:true},'powder_blast'),'critical');

const s=B.newGame();
B.emitCombatEvent(s,'impact_medium',{x:10,y:10});
const mediumShake=s.shake,mediumStop=s.hitStop;
assert(mediumShake>=3&&mediumShake<=5,'medium shake must stay in V8.4 range');
assert(mediumStop>=.025&&mediumStop<=.04,'medium hit-stop must stay in V8.4 range');
B.emitCombatEvent(s,'powder_blast',{x:10,y:10});
assert(s.shake>mediumShake,'critical must shake more than medium');
assert(s.hitStop>mediumStop,'critical must stop longer than medium');
assert(s.shake<=12,'shake must never exceed V8.4 critical cap');
assert(s.hitStop<=.075,'hit-stop must never exceed V8.4 cap');
console.log('V8.4 feedback level tests passed');
