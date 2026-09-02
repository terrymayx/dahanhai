const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const path='js/31_v73_proximity_boarding.js';
assert(fs.existsSync(path),'V7.3 proximity-boarding layer must exist');
const v73=read(path);

assert.match(index,/V7\.3/,'page must publish V7.3');
assert.match(index,/js\/31_v73_proximity_boarding\.js\?v=7\.3\.2/,'page must cache-bust the strict-distance V7.3 script');
assert.ok(index.indexOf('js/29_v72_no_magnetic_docking.js')<index.indexOf('js/31_v73_proximity_boarding.js'),'V7.3 must load after V7.2');
assert.ok(index.indexOf('js/31_v73_proximity_boarding.js')<index.indexOf('js/60_input_loop.js'),'V7.3 must load before main loop');
assert.match(v73,/const\s+V73_BOARDING_RANGE\s*=\s*50\b/,'nearby boarding range must be exactly 50px');
assert.doesNotMatch(v73,/V73_RANGE_HYSTERESIS/,'strict 50px boarding must not retain hysteresis');
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
const PLAYER_COLLIDER={cx:430,cy:560,rx:172,ry:310,skin:7};
const enemyCollider=e=>({rx:e.rx||80,ry:e.ry||50});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const playerHullRightX=y=>{
  const ny=(y-PLAYER_COLLIDER.cy)/PLAYER_COLLIDER.ry;
  if(Math.abs(ny)>=1)return PLAYER_COLLIDER.cx;
  return PLAYER_COLLIDER.cx+PLAYER_COLLIDER.rx*Math.sqrt(Math.max(0,1-ny*ny));
};
const contactPointForEnemy=e=>{
  const c=enemyCollider(e),pad=Math.min(70,Math.max(16,c.ry*.20));
  const cy=clamp(e.y,PLAYER_COLLIDER.cy-PLAYER_COLLIDER.ry+pad,PLAYER_COLLIDER.cy+PLAYER_COLLIDER.ry-pad);
  return {x:playerHullRightX(cy),y:cy,normalX:1,normalY:0};
};
const ctx={
  console,Math:math,g,PLAYER_COLLIDER,SPD:1,clamp,
  rand:(a,b)=>(a+b)/2,
  enemyCollider,contactPointForEnemy,playerHullRightX,
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

// On the centerline the surface gap is exact: player right radius 172 + enemy left radius 80 - skin 7.
const a={type:'sloop',t:{pir:1},state:'closing',gone:false,x:705,y:560,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false}; // 30px surface gap
const b={type:'sloop',t:{pir:1},state:'closing',gone:false,x:725,y:560,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false}; // 50px surface gap
ctx.g.enemies=[a,b];
assert.equal(ctx.v73CanBoardFromProximity(a),true,'ship inside 50px must be allowed to board without contact');
assert.equal(ctx.v73CanBoardFromProximity(b),true,'ship exactly at 50px must be allowed');
assert.equal(ctx.lockEnemyContact(a),false,'V7.3 must never require docking');
ctx.v73UpdateProximityBoarding(.30);
assert.equal(a.deployed,1,'first near ship should deploy a pirate');
assert.equal(b.deployed,1,'second near ship should deploy independently despite crowding');
assert.equal(ctx.g.boarders.length,2,'both near ships should create boarders in same update');
assert.ok(ctx.g.boarders.every(x=>x.state==='swing'||x.state==='climb'),'proximity boarding should use jump/rope transit, not a contact plank');
assert.ok(ctx.g.boarders.every(x=>x.boardingChannel===null),'proximity boarders must not occupy boarding channels');

// 51px must stop immediately, even if the ship had already entered boarding range before.
const far={type:'sloop',t:{pir:1},state:'closing',gone:false,x:726,y:560,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false,v73Boarding:true}; // 51px
ctx.g.enemies.push(far);
assert.equal(ctx.v73CanBoardFromProximity(far),false,'ship at 51px must not unload even after previously boarding');
ctx.v73UpdateProximityBoarding(.30);
assert.equal(far.deployed,0,'51px ship must keep approaching');
assert.equal(far.v73Boarding,false,'boarding flag must clear immediately outside 50px');

// Regression for the visual bug: old X-only math says this diagonal ship is ~49px away,
// but the real 2D hull-surface distance is over 50px, so it must not unload.
const diagonal={type:'sloop',t:{pir:1},state:'closing',gone:false,x:607,y:250,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false};
assert.ok(ctx.v73ProximityGap(diagonal)>50,'diagonal gap must use true 2D hull distance');
assert.equal(ctx.v73CanBoardFromProximity(diagonal),false,'visually distant diagonal ship must not board early');

// Once all pirates have actually reached fight, the old instant-disappear behavior remains.
for(const pirate of ctx.g.boarders)pirate.state='fight';
ctx.v73UpdateProximityBoarding(.30);
assert.equal(removed,2,'finished nearby transports should disappear after unloading');
assert.equal(ctx.g.enemies.includes(a),false);
assert.equal(ctx.g.enemies.includes(b),false);

// 40-active-pirate safety cap must remain.
ctx.g.boarders=Array.from({length:40},()=>({hp:40,state:'fight'}));
const capped={type:'sloop',t:{pir:1},state:'closing',gone:false,x:705,y:560,rx:80,ry:50,deployed:0,v73DeployT:0,contact:false};
ctx.g.enemies=[capped];
ctx.v73UpdateProximityBoarding(.30);
assert.equal(capped.deployed,0,'40 active pirates must pause new proximity deployment');

const v69=read('js/25_v69_endless_waves.js');
const v71=read('js/28_v71_boarding_flow.js');
assert.match(v69,/const\s+V69_WAVE_INTERVAL\s*=\s*15\b/,'15-second endless waves must remain');
assert.match(v71,/g\.shake\s*=\s*0/,'no-attack-jitter rule must remain');
console.log('PASS: V7.3 strict 2D 50px proximity boarding without docking/contact');
