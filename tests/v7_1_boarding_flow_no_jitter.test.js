const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const v71Path='js/28_v71_boarding_flow.js';
assert(fs.existsSync(v71Path),'V7.1 boarding-flow layer must exist');
const v71=read(v71Path);

assert.match(index,/V7\.1/,'page must publish V7.1');
assert.match(index,/js\/28_v71_boarding_flow\.js/,'index must load V7.1 layer');
assert.ok(index.indexOf('js/27_v70_deck_horde.js')<index.indexOf('js/28_v71_boarding_flow.js'),'V7.1 must load after V7.0');
assert.ok(index.indexOf('js/28_v71_boarding_flow.js')<index.indexOf('js/60_input_loop.js'),'V7.1 must load before main loop');

for(const fn of ['v71PickAlternateBerthingY','v71ResetJamTracking','v71TrackClosingProgress','v71UpdateBoardingFlow']){
  assert(new RegExp(`function\\s+${fn}`).test(v71),`${fn} missing`);
}
assert.match(v71,/const\s+V71_JAM_TIMEOUT\s*=\s*0\.65\b/,'jam timeout must be 0.65s');
assert.match(v71,/const\s+V71_PROGRESS_EPS\s*=\s*8\b/,'meaningful progress threshold must be 8px');
assert.match(v71,/applyV70Impact\s*=\s*function/,'V7.1 must replace V7.0 micro-jitter impact');
assert.doesNotMatch(v71,/v70HitStun\s*=\s*Math\.max/,'V7.1 must not add hit-stun jitter');
assert.match(v71,/g\.shake\s*=\s*0/,'V7.1 must disable whole-screen attack shake');

// VM-test the jam tracker without the browser.
const g={enemies:[],shake:5};
const ctx={
  console,Math,g,
  PLAYER_COLLIDER:{skin:7},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),
  enemyCollider:e=>({rx:e.rx||80,ry:e.ry||50}),
  contactPointAtY:(e,y)=>({x:600,y}),
  berthingCandidateYs:e=>[380,470,560,650,740],
  berthingTargetBlocked:(e,y)=>y===560,
  berthingScanStep:()=>40,
  assignBerthingTarget:e=>{e.targetContactY=560;return 560;},
  clearEnemyContact:()=>{},
  v70NearestLivingCrew:b=>({id:'captain',x:470,y:560,alive:true}),
  queueV70Death:(b,k)=>{b.v70DeathPending=k;return true;},
  DECK_COMBAT_BOUNDS:{minX:300,maxX:590,minY:285,maxY:835},
  applyV70Impact:()=>{},
  update:()=>{},
  drawMenu:()=>{},overlay:()=>{},txt:()=>{},bigButton:()=>{},BTN_START:{},
};
vm.createContext(ctx);vm.runInContext(v71,ctx);

const e={state:'closing',gone:false,targetContactY:560,x:800,y:560,rx:80,ry:50,berthRepathT:.4};
ctx.g.enemies=[e];
ctx.v71ResetJamTracking(e);
// Simulate collision jitter: x changes every frame, but gap never improves by the required 8px.
for(const x of [798,802,797,801,799,803,798,802]){
  e.x=x;
  ctx.v71TrackClosingProgress(e,.1);
}
assert.notEqual(e.targetContactY,560,'collision jitter must force a different berth or queue hold');
assert.ok(e.targetContactY===null||e.targetContactY===380||e.targetContactY===470||e.targetContactY===650||e.targetContactY===740,'replan must use a real alternate Y or wait');

// Ordinary hits should no longer nudge/stun pirates.
const b={x:520,y:560,hp:40,state:'fight'};
const before={x:b.x,y:b.y};
ctx.applyV70Impact(b,13);
assert.equal(b.x,before.x,'ordinary hit must not move pirate X');
assert.equal(b.y,before.y,'ordinary hit must not move pirate Y');
assert.ok(!(b.v70HitStun>0),'ordinary hit must not add hit-stun');

// Heavy hits keep the intentional one-shot knockback/overboard behavior.
const heavy={x:588,y:560,hp:40,state:'fight'};
ctx.applyV70Impact(heavy,30);
assert.ok(heavy.x!==588||heavy.v70DeathPending==='overboard','heavy hit should still knock back or throw overboard');

ctx.g.shake=9;ctx.update(.016);assert.equal(ctx.g.shake,0,'V7.1 update wrapper must zero screen shake before render');

const v68=read('js/24_v68_feedback_perf.js');
const v69=read('js/25_v69_endless_waves.js');
const scene=read('js/40_scene.js');
assert.match(v68,/!shipsTouchPlayer\(e\)\)return false/,'physical-contact boarding guard must remain');
assert.match(v69,/const\s+V69_WAVE_INTERVAL\s*=\s*15\b/,'15-second wave interval must remain');
assert.match(scene,/const p=clamp\(f\.t\/f\.dur,0,1\);/,'sink FX clamp must remain');

console.log('PASS: V7.1 boarding flow + no attack jitter regression');
