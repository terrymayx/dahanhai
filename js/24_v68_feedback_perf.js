/* V6.8：战斗反馈 + 性能层。保留 V6.3～V6.7 战斗规则，只增强视觉反馈与热点循环。 */

/* V6.8 BATTLE FEEDBACK + PERFORMANCE START */
const V68_LIMITS={fx:72,smoke:96,texts:52,foam:64,particles:150};

class V68Pool{
  constructor(limit=64){this.limit=limit;this.items=[];}
  take(){return this.items.pop()||null;}
  release(obj){
    if(!obj||this.items.length>=this.limit)return;
    for(const k of Object.keys(obj))delete obj[k];
    this.items.push(obj);
  }
}
const enemyPool=new V68Pool(32);
const boarderPool=new V68Pool(96);
const ballPool=new V68Pool(72);
const particlePool=new V68Pool(180);

function resetPooledObject(obj){for(const k of Object.keys(obj))delete obj[k];return obj;}
function takePooledObject(pool){return resetPooledObject(pool.take()||{});}
function adoptPooledObject(pool,fresh){
  const reused=pool.take();
  if(!reused)return fresh;
  resetPooledObject(reused);Object.assign(reused,fresh);return reused;
}

class V68SpatialHash{
  constructor(cell=160){this.cell=cell;this.map=new Map();}
  clear(){this.map.clear();}
  key(ix,iy){return ix+','+iy;}
  putCell(obj,ix,iy){
    const k=this.key(ix,iy);let a=this.map.get(k);
    if(!a){a=[];this.map.set(k,a);}a.push(obj);
  }
  insertPoint(obj,x,y){this.putCell(obj,Math.floor(x/this.cell),Math.floor(y/this.cell));}
  insertAABB(obj,minX,minY,maxX,maxY){
    const x0=Math.floor(minX/this.cell),x1=Math.floor(maxX/this.cell),y0=Math.floor(minY/this.cell),y1=Math.floor(maxY/this.cell);
    for(let ix=x0;ix<=x1;ix++)for(let iy=y0;iy<=y1;iy++)this.putCell(obj,ix,iy);
  }
  queryAABBInto(out,minX,minY,maxX,maxY){
    out.clear();
    const x0=Math.floor(minX/this.cell),x1=Math.floor(maxX/this.cell),y0=Math.floor(minY/this.cell),y1=Math.floor(maxY/this.cell);
    for(let ix=x0;ix<=x1;ix++)for(let iy=y0;iy<=y1;iy++){
      const a=this.map.get(this.key(ix,iy));if(a)for(const o of a)out.add(o);
    }
    return out;
  }
  queryAABB(minX,minY,maxX,maxY){return this.queryAABBInto(new Set(),minX,minY,maxX,maxY);}
}
const v68EnemyGrid=new V68SpatialHash(260),v68PirateGrid=new V68SpatialHash(52);
const v68EnemyBuffer=[],v68PirateBuffer=[],v68BeforeEnemies=[],v68BeforeBoarders=[],v68BeforeBalls=[],v68TransitBuffer=[];
const v68EnemyIndex=new Map(),v68PirateIndex=new Map(),v68Near=new Set();
let v68FrameStamp=0;

function ensureV68State(state){
  if(!state)return null;
  if(!state.v68)state.v68={particles:[],fireT:0};
  if(!Array.isArray(state.v68.particles))state.v68.particles=[];
  return state.v68;
}
ensureV68State(g);

function capVisualArray(arr,max){if(arr&&arr.length>max)arr.splice(0,arr.length-max);}
function trimV68Visuals(){
  if(!g)return;
  capVisualArray(g.fx,V68_LIMITS.fx);capVisualArray(g.smoke,V68_LIMITS.smoke);capVisualArray(g.texts,V68_LIMITS.texts);capVisualArray(g.foam,V68_LIMITS.foam);
  const s=ensureV68State(g);while(s.particles.length>V68_LIMITS.particles)particlePool.release(s.particles.pop());
}
function allocV68Particle(kind){
  const s=ensureV68State(g);if(!s)return null;
  let p=null;
  if(s.particles.length>=V68_LIMITS.particles)p=resetPooledObject(s.particles.pop());
  else p=takePooledObject(particlePool);
  p.k=kind;s.particles.push(p);return p;
}
function pushV68Particle(data){
  const p=allocV68Particle(data.k);if(!p)return null;
  for(const k of Object.keys(data))if(k!=='k')p[k]=data[k];return p;
}

function emitWoodImpact(x,y,power=1){
  const n=Math.min(13,Math.max(5,Math.round(6+power*3)));
  for(let i=0;i<n;i++){
    const p=allocV68Particle('wood');p.x=x;p.y=y;p.vx=rand(-135,135)*power;p.vy=rand(-150,-35)*power;p.rot=rand(0,6.28);p.vr=rand(-7,7);p.w=rand(5,11);p.h=rand(2,5);p.life=rand(.38,.72);p.max=.72;
  }
  const ring=allocV68Particle('impact');ring.x=x;ring.y=y;ring.r=12+power*7;ring.life=.20;ring.max=.20;
  g.shake=Math.max(g.shake,Math.min(7,2.2+power*2));
}
function ensureEnemyDamage(e){if(!e.v68Damage)e.v68Damage={holes:[],damageLevel:0,fireLevel:0,smokeT:0};return e.v68Damage;}
function addHullHole(e,hitX,hitY){
  if(!e)return;const d=ensureEnemyDamage(e);if(d.holes.length>=4)return;
  const s=Math.max(.2,e.s||1),lx=clamp(((hitX??e.x)-e.x)/s,-150,155),ly=clamp(((hitY??e.y)-e.y)/s,-72,72);
  if(d.holes.some(h=>Math.hypot(h.x-lx,h.y-ly)<34))return;d.holes.push({x:lx,y:ly,r:rand(9,15)});
}
function updateHullDamageState(e){
  if(!e)return;const d=ensureEnemyDamage(e),ratio=e.max>0?clamp(e.hp/e.max,0,1):0;
  d.damageLevel=ratio<=.20?3:ratio<=.48?2:ratio<=.75?1:0;d.fireLevel=ratio<=.20?2:ratio<=.42?1:0;
}
function emitPirateOverboard(b){
  if(!b)return;const p=allocV68Particle('pirateFall');p.x=b.x;p.y=b.y;p.vx=rand(-70,25);p.vy=rand(-95,-35);p.rot=rand(-.4,.4);p.vr=rand(-4,4);p.life=.95;p.max=.95;p.band=b.band||'#3a3f4a';
}
function emitBrokenPlanks(e,contactX,contactY){
  if(!e||!Number.isFinite(contactX)||!Number.isFinite(contactY))return;const count=e.type==='manowar'?4:2;
  for(let i=0;i<count;i++){
    const p=allocV68Particle('plank');p.x=contactX+rand(-6,16);p.y=contactY+rand(-34,34);p.vx=rand(-55,75);p.vy=rand(-35,70);p.rot=rand(-.5,.5);p.vr=rand(-3.5,3.5);p.w=rand(38,62);p.h=rand(7,11);p.life=1.25;p.max=1.25;
  }
  const s=allocV68Particle('splash');s.x=contactX;s.y=contactY;s.r=28;s.life=.55;s.max=.55;
}

const _damageEnemyV68=damageEnemy;
damageEnemy=function(e,d,x,y){
  if(!e||e.state==='sink')return _damageEnemyV68(e,d,x,y);
  const docked=e.state==='docked'&&e.contact,cx=e.contactX,cy=e.contactY;v68TransitBuffer.length=0;
  for(const b of g.boarders)if(b.ship===e&&b.hp>0&&b.state!=='fight')v68TransitBuffer.push(b);
  const hx=Number.isFinite(x)?x:e.x-enemyCollider(e).rx*.55,hy=Number.isFinite(y)?y:e.y;
  _damageEnemyV68(e,d,x,y);emitWoodImpact(hx,hy,clamp((Number(d)||10)/16,.65,1.65));
  if((Number(d)||0)>=9)addHullHole(e,hx,hy);updateHullDamageState(e);
  if(e.state==='sink'){
    emitWoodImpact(e.x,e.y,1.8);if(docked)emitBrokenPlanks(e,cx,cy);
    for(const b of v68TransitBuffer)if(b.hp<=0)emitPirateOverboard(b);
  }
};

/* 真正对象池：不再先创建临时核心对象，而是直接从池对象逐字段重置。 */
spawnEnemy=function(type){
  const t=TYPES[type],naturalRangeY=rand(300,820),e=takePooledObject(enemyPool);
  e.type=type;e.t=t;e.s=t.s;e.x=2070;e.y=rand(250,870);e.hp=t.hp;e.max=t.hp;e.state='approach';e.rot=0;
  e.deployed=0;e.deployT=0;e.shootT=rand(2.4,4);e.flash=0;e.ph=rand(0,6.28);e.sinkT=0;e.clearT=0;e.contact=false;
  e.contactX=null;e.contactY=null;e.contactNormalX=1;e.contactNormalY=0;e.targetContactY=null;e.berthRepathT=0;e.berthWaitT=0;e.berthStallT=0;e.berthLastX=null;
  e.rangeX=rand(1260,1510);e.rangeY=naturalRangeY;e.naturalRangeY=naturalRangeY;e.rangeRepathT=0;e.gone=false;g.enemies.push(e);
  if(t.role==='ranged')assignGunshipLane(e,true);
};

deployBoarder=function(e){
  if(!e||e.state!=='docked'||!e.contact||!Number.isFinite(e.contactX)||!Number.isFinite(e.contactY)||!shipsTouchPlayer(e))return false;
  const channel=chooseBoardingChannel(e);if(channel<0)return false;
  const ec=enemyCollider(e),laneOffset=boardingChannelOffset(e,channel),laneY=clampContactY(e.contactY+laneOffset,ec.ry),laneContactX=playerHullRightX(laneY);
  const bowX=enemyBowX(e)+18,entryX=Math.min(580,laneContactX-18),entryY=laneY,r=Math.random();let method=r<.58?'plank':r<.82?'swing':'climb';
  const band=e.deployed%2?'#d93636':'#3a3f4a',hp=e.type==='manowar'?52:42,b=takePooledObject(boarderPool);
  b.ship=e;b.hp=hp;b.max=hp;b.band=band;b.atkT=rand(.3,.7);b.anim=0;b.boardingChannel=channel;b.boardingLaneY=laneY;b.method=method;
  if(method==='plank'){
    const landingX=entryX,landingY=entryY+rand(-26,26);b.x=bowX;b.y=e.y+laneOffset+rand(-10,10);b.i=0;b.state='plank';b.wp=[{x:laneContactX+12,y:laneY},{x:landingX,y:landingY}];splashFx(laneContactX,laneY,.5);
  }else if(method==='swing'){
    const ax=bowX+10,ay=e.y+laneOffset+rand(-18,18),toX=entryX,toY=entryY+rand(-42,42);b.x=ax;b.y=ay+28;b.state='swing';b.swingT=0;b.dur=.9;b.anchor={x:ax,y:ay};b.from={x:ax,y:ay+28};b.to={x:toX,y:toY};
  }else{
    b.x=bowX;b.y=e.y+laneOffset+rand(-16,16);b.state='climb';b.climbT=0;b.to={x:entryX,y:entryY+rand(-28,28)};
  }
  g.boarders.push(b);return true;
};

launchBall=function(x,y,t,dmg,spd=760,spread=0){
  const tx=t?t.x:2050,ty=t?t.y:y,dx=tx-x,dy=ty-y,l=dist(x,y,tx,ty)||1,b=takePooledObject(ballPool);
  b.x=x;b.y=y;b.vx=dx/l*spd;b.vy=dy/l*spd+rand(-spread,spread);b.dmg=dmg;b.life=3;g.balls.push(b);
};

function fillLiveBuffer(src,out,predicate){out.length=0;for(const o of src)if(!predicate||predicate(o))out.push(o);return out;}
function snapshotBuffer(src,out){out.length=src.length;for(let i=0;i<src.length;i++)out[i]=src[i];}
function recycleSnapshot(before,after,pool,stamp){
  for(const o of after)o._v68LiveStamp=stamp;
  for(const o of before)if(o._v68LiveStamp!==stamp)pool.release(o);
}

/* 敌船碰撞由 O(n²) 全量比较改为 AABB 空间哈希候选比较，缓冲区每帧复用。 */
resolveEnemyShipCollisions=function(){
  const a=fillLiveBuffer(g.enemies,v68EnemyBuffer,e=>e.state!=='sink'&&!e.gone);v68EnemyGrid.clear();v68EnemyIndex.clear();
  for(let i=0;i<a.length;i++){const e=a[i],c=enemyCollider(e);v68EnemyIndex.set(e,i);v68EnemyGrid.insertAABB(e,e.x-c.rx,e.y-c.ry,e.x+c.rx,e.y+c.ry);}
  for(let i=0;i<a.length;i++){
    const A=a[i],ca=enemyCollider(A),near=v68EnemyGrid.queryAABBInto(v68Near,A.x-ca.rx,A.y-ca.ry,A.x+ca.rx,A.y+ca.ry);
    for(const B of near){
      const j=v68EnemyIndex.get(B);if(j===undefined||j<=i)continue;
      const cb=enemyCollider(B),dx=B.x-A.x,dy=B.y-A.y,ox=ca.rx+cb.rx-Math.abs(dx),oy=ca.ry+cb.ry-Math.abs(dy);if(ox<=0||oy<=0)continue;
      const staticA=A.state==='docked'&&A.contact,staticB=B.state==='docked'&&B.contact;if(staticA&&staticB)continue;
      if(ox<oy){const dir=dx>=0?1:-1;if(staticA)B.x+=dir*ox;else if(staticB)A.x-=dir*ox;else{A.x-=dir*ox*.5;B.x+=dir*ox*.5;}}
      else{const dir=dy>=0?1:-1;if(staticA)B.y+=dir*oy;else if(staticB)A.y-=dir*oy;else{A.y-=dir*oy*.5;B.y+=dir*oy*.5;}}
    }
  }
  for(const e of a)constrainEnemyOutsidePlayer(e);
};

/* 甲板海盗分离同样改为空间哈希，只比较邻近单位。 */
separateDeckFighters=function(){
  const a=fillLiveBuffer(g.boarders,v68PirateBuffer,b=>b.hp>0&&b.state==='fight'),minD=28;v68PirateGrid.clear();v68PirateIndex.clear();
  for(let i=0;i<a.length;i++){v68PirateIndex.set(a[i],i);v68PirateGrid.insertPoint(a[i],a[i].x,a[i].y);}
  for(let i=0;i<a.length;i++){
    const A=a[i],near=v68PirateGrid.queryAABBInto(v68Near,A.x-minD,A.y-minD,A.x+minD,A.y+minD);
    for(const B of near){
      const j=v68PirateIndex.get(B);if(j===undefined||j<=i)continue;let dx=B.x-A.x,dy=B.y-A.y,dd=Math.hypot(dx,dy);if(dd>=minD)continue;
      if(dd<.001){dx=(j&1)?1:-1;dy=(j&2)?1:-1;dd=Math.hypot(dx,dy);}const push=(minD-dd)/2,ux=dx/dd,uy=dy/dd;
      A.x-=ux*push;A.y-=uy*push;B.x+=ux*push;B.y+=uy*push;let q=clampDeckPoint(A);A.x=q.x;A.y=q.y;q=clampDeckPoint(B);B.x=q.x;B.y=q.y;
    }
  }
};

function updateV68Particles(dt){
  const a=ensureV68State(g).particles;let w=0;
  for(let i=0;i<a.length;i++){
    const p=a[i];p.life-=dt;if(p.life<=0){particlePool.release(p);continue;}
    if(p.k==='wood'||p.k==='pirateFall'||p.k==='plank'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=115*dt;p.rot+=(p.vr||0)*dt;}
    else if(p.k==='smoke'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=8*dt;}else if(p.k==='ember'){p.x+=p.vx*dt;p.y+=p.vy*dt;}
    a[w++]=p;
  }
  a.length=w;
}
function updateV68Fire(dt){
  const state=ensureV68State(g);state.fireT-=dt;if(state.fireT>0)return;state.fireT=.11;
  for(const e of g.enemies){
    if(e.state==='sink'||!e.v68Damage||e.v68Damage.fireLevel<=0)continue;
    const d=e.v68Damage,h=d.holes[0]||{x:-15,y:0},wx=e.x+h.x*e.s,wy=e.y+h.y*e.s;
    const sm=allocV68Particle('smoke');sm.x=wx+rand(-8,8);sm.y=wy-10;sm.vx=rand(-11,11);sm.vy=rand(-38,-20);sm.r=rand(8,13)*(d.fireLevel===2?1.25:1);sm.life=rand(.55,.9);sm.max=.9;
    if(Math.random()<.55){const em=allocV68Particle('ember');em.x=wx+rand(-12,12);em.y=wy;em.vx=rand(-20,20);em.vy=rand(-62,-30);em.r=rand(2,4);em.life=rand(.28,.55);em.max=.55;}
  }
}

const _updateV68=update;
update=function(dt){
  snapshotBuffer(g.enemies,v68BeforeEnemies);snapshotBuffer(g.boarders,v68BeforeBoarders);snapshotBuffer(g.balls,v68BeforeBalls);
  _updateV68(dt);const stamp=++v68FrameStamp;
  recycleSnapshot(v68BeforeEnemies,g.enemies,enemyPool,stamp);recycleSnapshot(v68BeforeBoarders,g.boarders,boarderPool,stamp);recycleSnapshot(v68BeforeBalls,g.balls,ballPool,stamp);
  updateV68Particles(dt);updateV68Fire(dt);trimV68Visuals();
};

function drawV68EnemyDamage(e){
  const d=e&&e.v68Damage;if(!d||(!d.damageLevel&&!d.holes.length&&!d.fireLevel))return;const sink=e.state==='sink';
  ctx.save();ctx.translate(e.x,e.y+(sink?e.sinkT*36:0));ctx.rotate(Math.sin(g.time*1.7+e.ph)*.025+(sink?e.sinkT*.5:0)+e.rot);ctx.scale(e.s,e.s);
  if(sink)ctx.globalAlpha=Math.max(0,1-e.sinkT/1.2);
  if(d.damageLevel>0){ctx.globalAlpha*=.10*d.damageLevel;ctx.fillStyle='#1b1814';ctx.fill(E_HULL);ctx.globalAlpha=sink?Math.max(0,1-e.sinkT/1.2):1;}
  for(const h of d.holes){
    ctx.save();ctx.translate(h.x,h.y);ctx.rotate(-.25);ctx.fillStyle='rgba(22,18,14,.92)';ctx.beginPath();ctx.ellipse(0,0,h.r*1.25,h.r*.72,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(63,38,20,.9)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-h.r*1.7,-h.r*.3);ctx.lineTo(-h.r*.7,0);ctx.lineTo(-h.r*1.45,h.r*.8);ctx.moveTo(h.r*1.5,-h.r*.6);ctx.lineTo(h.r*.65,0);ctx.lineTo(h.r*1.35,h.r*.7);ctx.stroke();ctx.restore();
  }
  if(d.fireLevel>0){const h=d.holes[0]||{x:-18,y:0},pulse=.86+.16*Math.sin(g.time*12+e.ph),sz=(d.fireLevel===2?24:17)*pulse;ctx.fillStyle='rgba(255,86,32,.90)';circle(h.x,h.y-8,sz);ctx.fill();ctx.fillStyle='rgba(255,198,45,.95)';circle(h.x+2,h.y-12,sz*.58);ctx.fill();}
  ctx.restore();
}
function drawV68TransientEffects(){
  const s=ensureV68State(g);
  for(const p of s.particles){
    const alpha=clamp(p.life/(p.max||p.life||1),0,1);ctx.save();ctx.globalAlpha=alpha;
    if(p.k==='wood'){ctx.translate(p.x,p.y);ctx.rotate(p.rot||0);ctx.fillStyle='#9a6131';ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);}
    else if(p.k==='impact'){ctx.strokeStyle='rgba(255,232,175,.9)';ctx.lineWidth=3;circle(p.x,p.y,Math.max(1,p.r*(1-alpha*.35)));ctx.stroke();}
    else if(p.k==='pirateFall'){ctx.translate(p.x,p.y);ctx.rotate(p.rot||0);ctx.fillStyle='#f2f2f2';ctx.beginPath();ctx.ellipse(0,5,10,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd9a6';circle(7,-3,8);ctx.fill();ctx.strokeStyle=p.band;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-8,1);ctx.lineTo(10,10);ctx.stroke();const q=1-alpha;ctx.globalAlpha=alpha*.7;ctx.strokeStyle='#e8f4fb';ctx.lineWidth=3;circle(0,24,8+q*30);ctx.stroke();}
    else if(p.k==='plank'){ctx.translate(p.x,p.y);ctx.rotate(p.rot||0);ctx.fillStyle='#b5793a';ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.strokeStyle='#6d431f';ctx.lineWidth=2;ctx.strokeRect(-p.w/2,-p.h/2,p.w,p.h);}
    else if(p.k==='splash'){ctx.strokeStyle='rgba(235,250,255,.9)';ctx.lineWidth=4;circle(p.x,p.y,Math.max(2,p.r*(1-alpha*.55)));ctx.stroke();}
    else if(p.k==='smoke'){ctx.fillStyle='rgba(47,48,50,.55)';circle(p.x,p.y,Math.max(1,p.r));ctx.fill();}
    else if(p.k==='ember'){ctx.fillStyle='#ffb52b';circle(p.x,p.y,Math.max(1,p.r));ctx.fill();}
    ctx.restore();
  }ctx.globalAlpha=1;
}

const _drawEnemyShipV68=drawEnemyShip;drawEnemyShip=function(e){_drawEnemyShipV68(e);drawV68EnemyDamage(e);};
const _drawFxAllV68=drawFxAll;drawFxAll=function(dt){_drawFxAllV68(dt);drawV68TransientEffects();};
const _newGameV68=newGame;newGame=function(){const state=_newGameV68();ensureV68State(state);return state;};

if(typeof drawMenu==='function'){
  drawMenu=function(){
    overlay();txt('大 航 海 时 代',960,270,106,'#ffffff','#5f3a17',14);txt('V6.8 · 战斗冲击与性能',960,354,37,'#ffd23e','#5f3a17',6);
    const lines=['💥 炮击命中会喷出木屑并留下破洞，低血量敌船出现焦黑与起火','🌊 接舷船沉没时，过板海盗落水、跳板断裂并漂散','🧱 敌船碰撞与甲板海盗分离改为空间哈希，只处理附近单位','♻️ 敌船、海盗、我方炮弹直接从对象池复用，降低船潮中的频繁分配','⚡ 特效、烟雾、文字、浪花与 V6.8 粒子都有硬上限，避免无限堆积'];
    lines.forEach((l,i)=>txt(l,960,430+i*48,24,'#e8f4fb','#0e3a52',5));bigButton(BTN_START,'开始高强度海战！');txt('V6.3～V6.7 战斗规则全部保留 · V6.8 专注反馈与流畅度',960,826,20,'#9cc4d8',null,0);
  };
}
/* V6.8 BATTLE FEEDBACK + PERFORMANCE END */
