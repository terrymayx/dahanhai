const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const path='js/29_v72_no_magnetic_docking.js';
assert(fs.existsSync(path),'V7.2 no-magnetic-docking layer must exist');
const v72=read(path);
const v72Code=v72.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

assert.match(index,/V7\.2/,'page must publish V7.2');
assert.match(index,/js\/29_v72_no_magnetic_docking\.js/,'index must load V7.2 layer');
assert.ok(index.indexOf('js/28_v71_boarding_flow.js')<index.indexOf('js/29_v72_no_magnetic_docking.js'),'V7.2 must load after V7.1');
assert.ok(index.indexOf('js/29_v72_no_magnetic_docking.js')<index.indexOf('js/60_input_loop.js'),'V7.2 must load before main loop');
assert.match(v72,/const\s+V72_LOCK_GAP\s*=\s*2\b/,'V7.2 lock gap must be 2px');
assert.match(v72,/function\s+v72DockingGap/,'v72DockingGap missing');
assert.match(v72,/function\s+v72PhysicalContactReady/,'v72PhysicalContactReady missing');
assert.doesNotMatch(v72Code,/e\.x\s*=\s*targetX/,'V7.2 lock must never snap enemy X to the rail');

const g={enemies:[]};
const ctx={
  console,Math,g,
  PLAYER_COLLIDER:{skin:7},
  enemyCollider:e=>({rx:e.rx||80,ry:e.ry||50}),
  contactPointForEnemy:e=>({x:600,y:e.y,normalX:1,normalY:0}),
  shipsTouchPlayer:()=>true,
  lockEnemyContact:()=>{throw new Error('old magnetic lock must be replaced');},
  update:()=>{},
  drawMenu:()=>{},overlay:()=>{},txt:()=>{},bigButton:()=>{},BTN_START:{},
};
vm.createContext(ctx);vm.runInContext(v72,ctx);

// targetX = 600 + 80 - 7 = 673. 11px gap is visibly separated and must NOT auto-latch.
const far={state:'closing',gone:false,x:684,y:560,rx:80,ry:50,contact:false};
ctx.g.enemies=[far];
assert.equal(ctx.v72DockingGap(far),11,'test setup must have 11px gap');
assert.equal(ctx.lockEnemyContact(far),false,'enemy with visible gap must not auto-latch');
assert.equal(far.x,684,'failed latch must not move enemy X');
assert.equal(far.contact,false,'failed latch must not create contact');

// Only a true near-zero contact may lock, and locking itself must preserve the physical position.
const touch={state:'closing',gone:false,x:674.5,y:560,rx:80,ry:50,contact:false,berthWaitT:1,berthStallT:1,berthLastX:700};
ctx.g.enemies=[touch];
assert.equal(ctx.v72PhysicalContactReady(touch),true,'1.5px gap should count as physical contact');
assert.equal(ctx.lockEnemyContact(touch),true,'near-zero physical contact should lock');
assert.equal(touch.x,674.5,'successful lock must not snap enemy X');
assert.equal(touch.contact,true,'successful lock must create contact');
assert.equal(touch.contactX,600,'contact must remain anchored to the real player hull');

const v68=read('js/24_v68_feedback_perf.js');
const v69=read('js/25_v69_endless_waves.js');
const v71=read('js/28_v71_boarding_flow.js');
assert.match(v68,/!shipsTouchPlayer\(e\)\)return false/,'physical-contact boarding guard must remain');
assert.match(v69,/const\s+V69_WAVE_INTERVAL\s*=\s*15\b/,'15-second wave interval must remain');
assert.match(v71,/g\.shake\s*=\s*0/,'no-attack-jitter rule must remain');

console.log('PASS: V7.2 no magnetic docking regression');
