/* V7.0：甲板人潮近战。三路包围、8 人动态防线、击退/倒地/落水、40 人活跃上限。 */

/* V7.0 DECK HORDE HELPERS START */
const V70_MAX_ACTIVE_BOARDERS=40;
const V70_MAX_DOWNED=10;
const V70_LANE_Y=[380,560,740];
const V70_CREW_IDS=['captain','sailor1','sailor2','sailor3','sailor4','gunner','archer','drummer'];
const v70Pressure=[0,0,0];
const v70TargetLoads={captain:0,sailor1:0,sailor2:0,sailor3:0,sailor4:0,gunner:0,archer:0,drummer:0};

function v70LaneForY(y){return y<470?0:y>650?2:1;}
function ensureV70Lane(b){
  if(!Number.isFinite(b.assaultLane))b.assaultLane=v70LaneForY(Number.isFinite(b.boardingLaneY)?b.boardingLaneY:b.y);
  return b.assaultLane;
}
function ensureV70State(state=g){if(!Array.isArray(state.v70Downed))state.v70Downed=[];return state.v70Downed;}
function v70ActiveBoarderCount(){
  let n=ensureV70State().length;
  for(const b of g.boarders)if(!b.v70DeathPending&&b.hp>0&&(b.state==='plank'||b.state==='swing'||b.state==='climb'||b.state==='fight'))n++;
  return n;
}
function isV70FrontCrew(c){return !!c&&(c.id==='captain'||isV67Sailor(c));}
function setV70BoarderTarget(b,c){
  const old=b.targetCrewId;
  if(old&&v70TargetLoads[old]>0)v70TargetLoads[old]--;
  b.targetCrewId=c?c.id:null;
  if(c&&v70TargetLoads[c.id]!==undefined)v70TargetLoads[c.id]++;
  return c;
}
function chooseV70BoarderTarget(b){
  const lane=ensureV70Lane(b),laneY=V70_LANE_Y[lane],broken=b.x<455;
  let best=null,bestScore=Infinity;
  for(const c of g.crew){
    if(!c.alive)continue;
    const front=isV70FrontCrew(c);
    let score=dist(b.x,b.y,c.x,c.y)+Math.abs(c.y-laneY)*.45+(v70TargetLoads[c.id]||0)*72;
    if(!broken)score+=front?-150:125;
    else score+=front?70:-35;
    if(score<bestScore){best=c;bestScore=score;}
  }
  return setV70BoarderTarget(b,best);
}
function v70DesiredFrontLane(c){
  const home={captain:1,sailor1:0,sailor2:2,sailor3:0,sailor4:2}[c.id]??1;
  let max=0;if(v70Pressure[1]>v70Pressure[max])max=1;if(v70Pressure[2]>v70Pressure[max])max=2;
  return v70Pressure[max]>=v70Pressure[home]+3?max:home;
}
function chooseV70CrewTarget(c){
  const front=isV70FrontCrew(c),desired=front?v70DesiredFrontLane(c):1;
  let best=null,bestScore=Infinity;
  for(const b of g.boarders){
    if(b.v70DeathPending||b.hp<=0||b.state!=='fight')continue;
    let score=dist(c.x,c.y,b.x,b.y);
    if(front)score+=Math.abs(ensureV70Lane(b)-desired)*240;
    if(c.id==='gunner')score-=v70LocalClusterCount(b,105)*34;
    if(score<bestScore){best=b;bestScore=score;}
  }
  return best;
}
function v70NearestLivingCrew(b){
  let best=null,bestD=Infinity;
  for(const c of g.crew)if(c.alive){const d=dist(b.x,b.y,c.x,c.y);if(d<bestD){best=c;bestD=d;}}
  return best;
}
function queueV70Death(b,kind){
  if(!b||b.v70DeathPending)return false;
  b.v70DeathPending=kind||'downed';v70PendingDeaths.push(b);
  if(!v70InsideUpdate)flushV70PendingDeaths();
  return true;
}
function applyV70Impact(b,d){
  if(!b||b.hp<=0||b.v70DeathPending)return false;
  const src=v70NearestLivingCrew(b),heavy=d>=27||!!(src&&src.id==='gunner'&&d>=17);
  b.v70HitStun=Math.max(b.v70HitStun||0,heavy?.12:.07);
  let dx=src?b.x-src.x:1,dy=src?b.y-src.y:0,len=Math.hypot(dx,dy)||1;
  if(heavy){
    const push=clamp(25+(d-27)*1.35,25,55);b.x+=dx/len*push;b.y+=dy/len*push;
    if(b.x<DECK_COMBAT_BOUNDS.minX||b.x>DECK_COMBAT_BOUNDS.maxX||b.y<DECK_COMBAT_BOUNDS.minY||b.y>DECK_COMBAT_BOUNDS.maxY)queueV70Death(b,'overboard');
  }else{
    const push=clamp(4+d*.22,5,10);b.x+=dx/len*push;b.y+=dy/len*push;
    b.x=clamp(b.x,DECK_COMBAT_BOUNDS.minX,DECK_COMBAT_BOUNDS.maxX);b.y=clamp(b.y,DECK_COMBAT_BOUNDS.minY,DECK_COMBAT_BOUNDS.maxY);
  }
  return true;
}
function detachV70Boarder(b){const i=g.boarders.indexOf(b);if(i>=0)g.boarders.splice(i,1);}
function releaseV70Boarder(b){
  if(typeof boarderPool!=='undefined'&&boarderPool&&typeof boarderPool.release==='function')boarderPool.release(b);
}
function queueV70Downed(b){
  const a=ensureV70State();detachV70Boarder(b);b.ship=null;b.boardingChannel=null;b.state='downed';b.v70DeathPending=null;b.v70DownT=.5+Math.random()*.3;
  while(a.length>=V70_MAX_DOWNED)releaseV70Boarder(a.shift());
  a.push(b);return true;
}
function dropV70Overboard(b){
  if(!b)return false;
  if(b.hp>0&&typeof _damageBoarderV70==='function')_damageBoarderV70(b,b.hp,b.x,b.y);
  detachV70Boarder(b);b.ship=null;b.boardingChannel=null;b.v70DeathPending=null;
  if(typeof emitPirateOverboard==='function')emitPirateOverboard(b);else if(typeof splashFx==='function')splashFx(b.x,b.y,.7);
  releaseV70Boarder(b);return true;
}
function flushV70PendingDeaths(){
  for(let i=0;i<v70PendingDeaths.length;i++){
    const b=v70PendingDeaths[i],kind=b.v70DeathPending;
    if(!kind)continue;
    if(kind==='overboard')dropV70Overboard(b);else queueV70Downed(b);
  }
  v70PendingDeaths.length=0;
}
function updateV70Downed(dt){
  const a=ensureV70State();let w=0;
  for(let i=0;i<a.length;i++){
    const b=a[i];b.v70DownT-=dt;
    if(b.v70DownT<=0){releaseV70Boarder(b);continue;}
    a[w++]=b;
  }
  a.length=w;
}
function drawV70Downed(){
  const a=ensureV70State();
  for(let i=0;i<a.length;i++){
    const b=a[i];ctx.save();ctx.translate(b.x,b.y);ctx.rotate(1.35);ctx.globalAlpha=clamp(b.v70DownT/.22,0,1);
    figureBody(0,0,'#f2f2f2','#3a3f4a');figureHead(0,0,'band',b.band||'#3a3f4a');ctx.restore();
  }
  ctx.globalAlpha=1;
}
/* V7.0 DECK HORDE HELPERS END */

const v70FightGrid=new V68SpatialHash(96);
const v70Near=new Set();
const v70PendingDeaths=[];
let v70InsideUpdate=false;

function v70RefreshFrameCache(){
  v70Pressure[0]=v70Pressure[1]=v70Pressure[2]=0;
  for(const id of V70_CREW_IDS)v70TargetLoads[id]=0;
  v70FightGrid.clear();
  for(const b of g.boarders){
    if(b.v70DeathPending||b.hp<=0)continue;
    if(b.state==='plank'||b.state==='swing'||b.state==='climb'||b.state==='fight')v70Pressure[ensureV70Lane(b)]++;
    if(b.state==='fight'){
      v70FightGrid.insertPoint(b,b.x,b.y);
      if(b.targetCrewId&&v70TargetLoads[b.targetCrewId]!==undefined)v70TargetLoads[b.targetCrewId]++;
    }
  }
}
function v70LocalClusterCount(b,r=105){
  let n=0;v70FightGrid.queryAABBInto(v70Near,b.x-r,b.y-r,b.x+r,b.y+r);
  for(const o of v70Near)if(o.hp>0&&!o.v70DeathPending&&o.state==='fight'&&dist(b.x,b.y,o.x,o.y)<=r)n++;
  return n;
}
function rebalanceV70LaneOnEntry(b){
  const lane=ensureV70Lane(b);let alt=lane;
  if(lane===0)alt=1;
  else if(lane===2)alt=1;
  else alt=v70Pressure[0]<=v70Pressure[2]?0:2;
  if(v70Pressure[lane]>=v70Pressure[alt]+4)b.assaultLane=alt;
  return b.assaultLane;
}

/* 40 人硬上限只在旧 deployBoarder 之前拦截；真实接触和通道守卫仍由旧实现决定。 */
const _deployBoarderV70=deployBoarder;
deployBoarder=function(e){
  if(v70ActiveBoarderCount()>=V70_MAX_ACTIVE_BOARDERS)return false;
  return _deployBoarderV70(e);
};

/* 海盗只有真正进入 fight 后才最终确定/微调进攻路。 */
const _enterBoarderFightV70=enterBoarderFight;
enterBoarderFight=function(b){_enterBoarderFightV70(b);rebalanceV70LaneOnEntry(b);};

const _chooseBoarderCrewTargetV70=chooseBoarderCrewTarget;
chooseBoarderCrewTarget=function(b){
  const current=g.crew.find(c=>c.alive&&c.id===b.targetCrewId),broken=b.x<455;
  if(current&&((!broken&&isV70FrontCrew(current))||(broken&&!isV70FrontCrew(current))))return current;
  return chooseV70BoarderTarget(b)||_chooseBoarderCrewTargetV70(b);
};

const _chooseCrewCombatTargetV70=chooseCrewCombatTarget;
chooseCrewCombatTarget=function(c){return chooseV70CrewTarget(c)||_chooseCrewCombatTargetV70(c);};

const _crewCombatProfileV70=crewCombatProfile;
crewCombatProfile=function(c){
  if(c&&c.id==='drummer')return {min:145,preferred:185,speed:76};
  return _crewCombatProfileV70(c);
};

const _moveCrewCombatV70=moveCrewCombat;
moveCrewCombat=function(c,tgt,dt){
  if(isV70FrontCrew(c)&&!tgt){
    const lane=v70DesiredFrontLane(c),tx=500,ty=V70_LANE_Y[lane],d=dist(c.x,c.y,tx,ty),speed=c.id==='captain'?90:88;
    if(d>2){const step=Math.min(d,speed*.7*dt);c.x+=(tx-c.x)/d*step;c.y+=(ty-c.y)/d*step;}
    c.x=clamp(c.x,DECK_COMBAT_BOUNDS.minX,DECK_COMBAT_BOUNDS.maxX);c.y=clamp(c.y,DECK_COMBAT_BOUNDS.minY,DECK_COMBAT_BOUNDS.maxY);return;
  }
  return _moveCrewCombatV70(c,tgt,dt);
};

/* 保留旧奖励/金币逻辑，只在其后追加 hit-stun / 击退 / 死亡表现。 */
const _damageBoarderV70=damageBoarder;
damageBoarder=function(b,d,x,y){
  if(!b||b.hp<=0||b.v70DeathPending)return;
  const before=b.hp;_damageBoarderV70(b,d,x,y);
  if(before>0&&b.hp<=0){queueV70Death(b,Math.random()<.7?'downed':'overboard');return;}
  applyV70Impact(b,d);
};

const _updateBoarderV70=updateBoarder;
updateBoarder=function(b,dt){
  if(b.v70DeathPending)return;
  if((b.v70HitStun||0)>0){b.v70HitStun=Math.max(0,b.v70HitStun-dt);return;}
  return _updateBoarderV70(b,dt);
};

const _drawBoardingRoutesV70=drawBoardingRoutes;
drawBoardingRoutes=function(){_drawBoardingRoutesV70();drawV70Downed();};

ensureV70State();
if(typeof newGame==='function'){
  const _newGameV70=newGame;
  newGame=function(){const state=_newGameV70();state.v70Downed=[];v70PendingDeaths.length=0;return state;};
}

/* V7 位于 V6.8/V6.9 外层：先建缓存，再让旧 update 完整执行，最后才处理死亡清理，避免对象池双重回收。 */
const _updateV70=update;
update=function(dt){
  v70RefreshFrameCache();v70InsideUpdate=true;
  try{_updateV70(dt);}finally{v70InsideUpdate=false;}
  flushV70PendingDeaths();updateV70Downed(dt);
};

/* V7.0 菜单；V6.9 的 15 秒波次 HUD 继续由原层绘制。 */
drawMenu=function(){
  overlay();
  txt('大 航 海 时 代',960,270,106,'#ffffff','#5f3a17',14);
  txt('V7.0 · 甲板人潮近战',960,355,38,'#ffd23e','#5f3a17',6);
  const lines=[
    '🏴‍☠️ 海盗分成上 / 中 / 下三路压上甲板，并优先突破前排防线',
    '🛡️ 船长 + 4 名水手组成动态前排，哪一路压力大就自动补位',
    '💥 重击会击退海盗，边缘击退可直接打落水；阵亡会短暂倒地',
    '👥 活跃海盗硬上限 40 名、倒地上限 10 个，继续使用 V6.8 对象池与空间哈希',
    '⏱️ V6.9 无限船潮继续保持固定 15 秒一波，运兵舰卸兵后原地消失'
  ];
  lines.forEach((l,i)=>txt(l,960,435+i*48,25,'#e8f4fb','#0e3a52',5));
  bigButton(BTN_START,'开始甲板船潮！');
  txt('三路包围 · 8 人防线 · 击退 / 倒地 / 落水',960,835,21,'#9cc4d8',null,0);
};
