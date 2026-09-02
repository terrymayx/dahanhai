const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const v70Path='js/27_v70_deck_horde.js';
assert(fs.existsSync(v70Path),'V7.0 deck-horde layer must exist');
const v70=read(v70Path);

assert.match(index,/V7\.0/,'page must publish V7.0');
assert.match(index,/js\/27_v70_deck_horde\.js/,'index must load V7.0 layer');
assert.ok(index.indexOf('js/26_v69_side_retreat.js')<index.indexOf('js/27_v70_deck_horde.js'),'V7.0 must load after V6.9 transport cleanup');
assert.ok(index.indexOf('js/27_v70_deck_horde.js')<index.indexOf('js/60_input_loop.js'),'V7.0 must load before input/main loop');
assert.match(v70,/const\s+V70_MAX_ACTIVE_BOARDERS\s*=\s*40\b/,'active boarder hard cap must be 40');
assert.match(v70,/const\s+V70_MAX_DOWNED\s*=\s*10\b/,'downed visual hard cap must be 10');
for(const fn of [
  'v70LaneForY','ensureV70Lane','v70ActiveBoarderCount','v70RefreshFrameCache',
  'chooseV70BoarderTarget','chooseV70CrewTarget','applyV70Impact','queueV70Death',
  'queueV70Downed','dropV70Overboard','flushV70PendingDeaths','updateV70Downed','drawV70Downed'
]) assert(new RegExp(`function\\s+${fn}`).test(v70),`${fn} missing`);
assert.match(v70,/deployBoarder\s*=\s*function/,'deployment cap wrapper missing');
assert.match(v70,/enterBoarderFight\s*=\s*function/,'fight-entry lane wrapper missing');
assert.match(v70,/damageBoarder\s*=\s*function/,'damage feedback wrapper missing');
assert.match(v70,/new\s+V68SpatialHash\s*\(/,'V7.0 must reuse V6.8 spatial hash infrastructure');
assert.doesNotMatch(v70,/for\s*\([^)]*g\.boarders[^)]*\)\s*for\s*\([^)]*g\.boarders/,'V7.0 must not add all-pairs pirate crowd loops');
assert.doesNotMatch(v70,/drawPirate\s*\(\s*\{\s*\.\.\./,'downed drawing must not allocate temporary spread objects per frame');

class HashStub{
  clear(){}
  insertPoint(){}
  queryAABBInto(out){out.clear();return out;}
}
let deployCalls=0,poolReleased=0,overboardFx=0;
const g={boarders:[],v70Downed:[],crew:[],enemies:[],state:'playing',wave:1,nextWaveIn:15};
const math=Object.create(Math);math.random=()=>0;
const ctx={
  console,Math:math,g,
  DECK_COMBAT_BOUNDS:{minX:300,maxX:590,minY:285,maxY:835},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),
  isV67Sailor:c=>!!(c&&/^sailor/.test(c.id||'')),
  V68SpatialHash:HashStub,
  deployBoarder:()=>{deployCalls++;return true;},
  enterBoarderFight:b=>{b.state='fight';b.boardingChannel=null;},
  chooseBoarderCrewTarget:()=>null,
  chooseCrewCombatTarget:()=>null,
  crewCombatProfile:c=>c.id==='archer'?{min:150,preferred:205,speed:78}:{min:18,preferred:34,speed:90},
  moveCrewCombat:()=>{},
  damageBoarder:(b,d)=>{if(!b||b.hp<=0)return;b.hp-=d;if(b.hp<=0){b.hp=0;b.rewarded=true;}},
  updateBoarder:()=>{},
  boarderPool:{release:b=>{poolReleased++;for(const k of Object.keys(b))delete b[k];}},
  emitPirateOverboard:()=>{overboardFx++;},
  splashFx:()=>{},
  drawPirate:()=>{},
  drawBoardingRoutes:()=>{},
  drawMenu:()=>{},
  overlay:()=>{},txt:()=>{},bigButton:()=>{},BTN_START:{},
  figureBody:()=>{},figureHead:()=>{},
  ctx:{save:()=>{},restore:()=>{},translate:()=>{},rotate:()=>{},globalAlpha:1},
  update:dt=>{
    if(ctx.hitTarget){
      ctx.damageBoarder(ctx.hitTarget,ctx.hitDamage,ctx.hitTarget.x,ctx.hitTarget.y);
      ctx.wasPresentDuringInner=ctx.g.boarders.includes(ctx.hitTarget);
    }
  }
};
vm.createContext(ctx);
vm.runInContext(v70,ctx);

assert.equal(ctx.v70LaneForY(350),0,'upper lane mapping');
assert.equal(ctx.v70LaneForY(560),1,'middle lane mapping');
assert.equal(ctx.v70LaneForY(780),2,'lower lane mapping');
const stable={y:360,boardingLaneY:360};
assert.equal(ctx.ensureV70Lane(stable),0);
stable.y=780;
assert.equal(ctx.ensureV70Lane(stable),0,'assault lane must stay stable after assignment');

ctx.g.boarders=Array.from({length:39},(_,i)=>({hp:10,state:'fight',assaultLane:i%3,targetCrewId:null,x:500,y:380+(i%3)*180}));
ctx.g.v70Downed=[{state:'downed'}];
assert.equal(ctx.v70ActiveBoarderCount(),40,'active count must include downed bodies');
deployCalls=0;
assert.equal(ctx.deployBoarder({}),false,'deployment must wait at 40 active pirates');
assert.equal(deployCalls,0,'cap wrapper must not call old deployment at hard cap');
ctx.g.v70Downed.length=0;ctx.g.boarders.pop();
assert.equal(ctx.deployBoarder({}),true,'deployment must resume below cap');
assert.equal(deployCalls,1,'below cap wrapper must delegate to existing guarded deployment');

const captain={id:'captain',x:505,y:560,alive:true};
const sailor1={id:'sailor1',x:500,y:380,alive:true};
const sailor2={id:'sailor2',x:500,y:740,alive:true};
const sailor3={id:'sailor3',x:500,y:410,alive:true};
const sailor4={id:'sailor4',x:500,y:710,alive:true};
const gunner={id:'gunner',x:450,y:610,alive:true};
const archer={id:'archer',x:535,y:360,alive:true};
const drummer={id:'drummer',x:390,y:760,alive:true};
ctx.g.crew=[captain,sailor1,sailor2,sailor3,sailor4,gunner,archer,drummer];
ctx.g.boarders=[];ctx.g.v70Downed=[];
ctx.v70RefreshFrameCache();
const upperPirate={x:545,y:360,hp:40,state:'fight',assaultLane:0,targetCrewId:null};
ctx.g.boarders=[upperPirate];ctx.v70RefreshFrameCache();
assert.match(ctx.chooseV70BoarderTarget(upperPirate).id,/^(captain|sailor)/,'before breakthrough pirate must prefer front line over closer backliner');
upperPirate.x=440;upperPirate.targetCrewId=null;ctx.v70RefreshFrameCache();
assert.equal(ctx.chooseV70BoarderTarget(upperPirate).id,'archer','after breakthrough a close backliner may be targeted');

const upperTarget={x:520,y:360,hp:20,state:'fight',assaultLane:0,targetCrewId:null};
const lowerTarget={x:505,y:720,hp:20,state:'fight',assaultLane:2,targetCrewId:null};
ctx.g.boarders=[upperTarget,lowerTarget];
for(let i=0;i<7;i++)ctx.g.boarders.push({x:530,y:350+i*4,hp:20,state:'fight',assaultLane:0,targetCrewId:null});
ctx.v70RefreshFrameCache();
assert.equal(ctx.v70DesiredFrontLane(sailor2),0,'front sailor must reinforce the highest-pressure lane');
assert.equal(ctx.chooseV70CrewTarget(sailor2).assaultLane,0,'front sailor target selection must follow pressure lane');

// Lethal damage during the wrapped old update must stay in g.boarders until old/V6.8 update finishes.
poolReleased=0;overboardFx=0;
const lethal={x:500,y:560,hp:20,max:20,state:'fight',assaultLane:1,band:'#333'};
ctx.g.boarders=[lethal];ctx.g.v70Downed=[];ctx.hitTarget=lethal;ctx.hitDamage=30;ctx.wasPresentDuringInner=false;
ctx.update(.016);
assert.equal(ctx.wasPresentDuringInner,true,'death must not splice boarder while inner update/V6.8 snapshot is active');
assert.equal(ctx.g.boarders.includes(lethal),false,'death must detach after inner update returns');
assert.equal(ctx.g.v70Downed.length,1,'deterministic death should become downed body');
assert.equal(poolReleased,0,'downed body must not be released before its timer expires');
ctx.hitTarget=null;ctx.updateV70Downed(1);
assert.equal(ctx.g.v70Downed.length,0,'expired downed body must be removed');
assert.equal(poolReleased,1,'expired downed body must be returned to boarder pool exactly once');

// Heavy nonlethal hit near deck edge should queue an overboard kill and release after inner update.
poolReleased=0;overboardFx=0;
const edge={x:588,y:560,hp:100,max:100,state:'fight',assaultLane:1,band:'#333'};
ctx.g.boarders=[edge];ctx.g.v70Downed=[];ctx.hitTarget=edge;ctx.hitDamage=30;
ctx.update(.016);
assert.equal(ctx.g.boarders.includes(edge),false,'knockback beyond deck must remove pirate after update');
assert.equal(overboardFx,1,'overboard knockback must emit falling/splash feedback');
assert.equal(poolReleased,1,'overboard pirate must return to pool exactly once');
ctx.hitTarget=null;

// Downed hard cap is 10 and oldest body is released when the 11th enters.
poolReleased=0;ctx.g.boarders=[];ctx.g.v70Downed=[];
for(let i=0;i<11;i++){
  const b={x:450,y:500,hp:0,max:20,state:'fight',band:'#333'};ctx.g.boarders.push(b);ctx.queueV70Downed(b);
}
assert.equal(ctx.g.v70Downed.length,10,'downed bodies must be capped at 10');
assert.equal(poolReleased,1,'11th downed body must evict and release the oldest one');

const v69=read('js/25_v69_endless_waves.js');
const v68=read('js/24_v68_feedback_perf.js');
const scene=read('js/40_scene.js');
assert.match(v69,/const\s+V69_WAVE_INTERVAL\s*=\s*15\b/,'15-second endless waves must remain');
assert.match(v68,/!shipsTouchPlayer\(e\)\)return false/,'V6.8 pooled deployBoarder must retain physical-contact guard');
assert.match(scene,/const p=clamp\(f\.t\/f\.dur,0,1\);/,'sink FX clamp regression must remain');
console.log('PASS: V7.0 deck horde regression');
