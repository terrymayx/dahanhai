const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const path='js/31_v73_proximity_boarding.js';
assert(fs.existsSync(path),'V7.3 proximity-boarding layer must exist');
const v73=read(path);

assert.match(index,/V7\.3/,'page must publish V7.3');
assert.match(index,/js\/31_v73_proximity_boarding\.js/,'index must load V7.3 layer');
assert.ok(index.indexOf('js/29_v72_no_magnetic_docking.js')<index.indexOf('js/31_v73_proximity_boarding.js'),'V7.3 must load after V7.2');
assert.ok(index.indexOf('js/31_v73_proximity_boarding.js')<index.indexOf('js/60_input_loop.js'),'V7.3 must load before main loop');
assert.match(v73,/const\s+V73_BOARDING_RANGE\s*=\s*320\b/,'nearby boarding range must be 320px');
for(const fn of ['v73ProximityGap','v73CanBoardFromProximity','v73DeployBoarder','v73UpdateProximityBoarding']){
  assert(new RegExp(`function\\s+${fn}`).test(v73),`${fn} missing`);
}
assert.match(v73,/lockEnemyContact\s*=\s*function\s*\([^)]*\)\s*\{\s*return false;?\s*\}/,'V7.3 must disable docking as a requirement');
assert.doesNotMatch(v73,/chooseBoardingChannel\s*\(/,'V7.3 boarding must not consume contact channels');
assert.doesNotMatch(v73,/state\s*!==\s*['"]docked['"]/,'V7.3 deployer must not require docked state');
assert.doesNotMatch(v73,/shipsTouchPlayer\s*\(/,'V7.3 deployer must not require physical hull contact');

let removed=0;
const g={enemies:[],boarders:[],focus:null,shake:0};
const math=Object.create(Math);math.random=()=>0;
const ctx={
  console,Math:math,g,
  PLAYER_COLLIDER:{skin:7},SPD:1,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  rand:(a,b)=>(a+b)/2,
  enemyCollider:e=>({rx:e.rx||80,ry:e.ry||50}),
  contactPointForEnemy:e=>({x:600,y:e.y,normalX:1,normalY:0}),
  playerHullRightX:()=>600,
  enemyBowX:e=>e.x-(e.rx||80),
  takePooledObject:()=>({}),boarderPool:{},
  v70ActiveBoarderCount:()=>ctx.g.boarders.filter(b=>b.hp>0).length,
  V70_MAX_ACTIVE_BOARDERS:40,
  lockEnemyContact:()=>true,
  removeV69TransportShip:(e,force)=>{removed++;e.gone=true;const i=ctx.g.enemies.indexOf(e);if(i>=0)ctx.g.enemies.splice(i,1);for(const b of ctx.g.boarders)if(b.ship===e&&b.state==='fight')b.ship=null;return true;},
  update:()=>{},
  drawMenu:()=>{},overlay:()=>{},txt:()=>{},bigButton:()=>{},BTN_START:{},
};
vm.createContext(ctx);vm.runInContext(v73,ctx);

// targetX = 600 + 80 - 7 = 673. Two ships at the same Y are both near enough,
// even though neither is docked/contacted and they would visually crowd each other.
const a={type:'sloop',t:{pir:1},state:'closing',gone:false,x:900,y:540,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false}; // gap 227
const b={type:'sloop',t:{pir:1},state:'closing',gone:false,x:930,y:550,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false}; // gap 257
ctx.g.enemies=[a,b];
assert.equal(ctx.v73CanBoardFromProximity(a),true,'near ship must be allowed to board without contact');
assert.equal(ctx.v73CanBoardFromProximity(b),true,'second crowded near ship must also be allowed');
assert.equal(ctx.lockEnemyContact(a),false,'V7.3 must never require docking');
ctx.v73UpdateProximityBoarding(.30);
assert.equal(a.deployed,1,'first near ship should deploy a pirate');
assert.equal(b.deployed,1,'second near ship should deploy independently despite crowding');
assert.equal(ctx.g.boarders.length,2,'both near ships should create boarders in same update');
assert.ok(ctx.g.boarders.every(x=>x.state==='swing'||x.state==='climb'),'proximity boarding should use jump/rope transit, not a contact plank');
assert.ok(ctx.g.boarders.every(x=>x.boardingChannel===null),'proximity boarders must not occupy boarding channels');

// Far ships must still travel closer before unloading.
const far={type:'sloop',t:{pir:1},state:'closing',gone:false,x:1040,y:560,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false}; // gap 367
ctx.g.enemies.push(far);
assert.equal(ctx.v73CanBoardFromProximity(far),false,'ship outside 320px range must not unload yet');
ctx.v73UpdateProximityBoarding(.30);
assert.equal(far.deployed,0,'far ship must keep approaching');

// Once all pirates have actually reached fight, the old instant-disappear behavior remains.
for(const pirate of ctx.g.boarders)pirate.state='fight';
ctx.v73UpdateProximityBoarding(.30);
assert.equal(removed,2,'finished nearby transports should disappear after unloading');
assert.equal(ctx.g.enemies.includes(a),false);
assert.equal(ctx.g.enemies.includes(b),false);

// 40-active-pirate safety cap must remain.
ctx.g.boarders=Array.from({length:40},()=>({hp:40,state:'fight'}));
const capped={type:'sloop',t:{pir:1},state:'closing',gone:false,x:900,y:560,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false};
ctx.g.enemies=[capped];
ctx.v73UpdateProximityBoarding(.30);
assert.equal(capped.deployed,0,'40 active pirates must pause new proximity deployment');

const v69=read('js/25_v69_endless_waves.js');
const v71=read('js/28_v71_boarding_flow.js');
assert.match(v69,/const\s+V69_WAVE_INTERVAL\s*=\s*15\b/,'15-second endless waves must remain');
assert.match(v71,/g\.shake\s*=\s*0/,'no-attack-jitter rule must remain');
console.log('PASS: V7.3 proximity boarding without docking/contact');
