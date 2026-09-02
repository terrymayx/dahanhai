/* V7.3：近距离直接登船。敌舰只要进入旗舰附近即可持续放海盗，不再需要接舷锁、船舷槽位或跳板。 */
const V73_BOARDING_RANGE=50;
const V73_DEPLOY_INTERVAL=.28;

function v73RadiusAlong(rx,ry,ux,uy){
  if(!(rx>0)||!(ry>0))return 0;
  const den=(ux*ux)/(rx*rx)+(uy*uy)/(ry*ry);
  return den>0?1/Math.sqrt(den):0;
}
function v73ProximityGap(e){
  if(!e)return Infinity;
  const c=enemyCollider(e);
  const dx=e.x-PLAYER_COLLIDER.cx,dy=e.y-PLAYER_COLLIDER.cy;
  const centerDist=Math.hypot(dx,dy);
  if(centerDist<=1e-6)return 0;
  const ux=dx/centerDist,uy=dy/centerDist;
  const playerR=v73RadiusAlong(PLAYER_COLLIDER.rx,PLAYER_COLLIDER.ry,ux,uy);
  const enemyR=v73RadiusAlong(c.rx,c.ry,ux,uy);
  /* 使用二维船体表面距离；skin 仅保留原碰撞层的容差，不允许 X 轴单独触发登船。 */
  return Math.max(0,centerDist-playerR-enemyR+PLAYER_COLLIDER.skin);
}
function v73CanBoardFromProximity(e){
  if(!e||e.gone||e.state==='sink'||!e.t)return false;
  if(!(e.state==='approach'||e.state==='hold'||e.state==='closing'||e.state==='docked'))return false;
  return v73ProximityGap(e)<=V73_BOARDING_RANGE;
}
function v73TakeBoarder(){
  if(typeof takePooledObject==='function'&&typeof boarderPool!=='undefined')return takePooledObject(boarderPool);
  return {};
}
function v73DeployBoarder(e){
  if(!v73CanBoardFromProximity(e)||e.deployed>=e.t.pir)return false;
  if(typeof v70ActiveBoarderCount==='function'&&v70ActiveBoarderCount()>=V70_MAX_ACTIVE_BOARDERS)return false;

  const c=enemyCollider(e),laneY=clamp(e.y,315,805),deckX=Math.min(580,playerHullRightX(laneY)-18);
  const bowX=enemyBowX(e)+18,gap=v73ProximityGap(e),band=e.deployed%2?'#d93636':'#3a3f4a';
  const hp=e.type==='manowar'?52:42,b=v73TakeBoarder(),r=Math.random();
  b.ship=e;b.hp=hp;b.max=hp;b.band=band;b.atkT=rand(.3,.7);b.anim=0;
  b.boardingChannel=null;b.boardingLaneY=laneY;b.assaultLane=undefined;

  if(r<.72){
    const ax=bowX,ay=e.y+rand(-22,22),toX=deckX,toY=laneY+rand(-42,42);
    b.x=ax;b.y=ay+24;b.method='swing';b.state='swing';b.swingT=0;
    b.dur=clamp(.66+gap/720,.72,1.12);b.anchor={x:ax,y:ay};b.from={x:ax,y:ay+24};b.to={x:toX,y:toY};
  }else{
    b.x=bowX;b.y=e.y+rand(-18,18);b.method='climb';b.state='climb';b.climbT=0;b.to={x:deckX,y:laneY+rand(-30,30)};
  }
  g.boarders.push(b);return true;
}
function v73TransportFinished(e){
  if(!e||!e.t||e.deployed<e.t.pir)return false;
  for(const b of g.boarders)if(b.ship===e&&b.hp>0&&b.state!=='fight')return false;
  return true;
}
function v73UpdateProximityBoarding(dt){
  for(let i=g.enemies.length-1;i>=0;i--){
    const e=g.enemies[i];if(!e||e.gone||e.state==='sink')continue;
    const near=v73CanBoardFromProximity(e);
    if(near){
      e.v73Boarding=true;
      /* 进入 50px 区域后不再争抢船舷位置；一旦离开 50px，本帧立即停止放人。 */
      if(e.contact&&typeof clearEnemyContact==='function')clearEnemyContact(e);
      if(e.state==='docked')e.state='closing';
      e.targetContactY=null;e.berthRepathT=Math.max(e.berthRepathT||0,.7);e.berthWaitT=0;
      e.v73DeployT=(e.v73DeployT??0)-dt*(typeof SPD==='number'?SPD:1);
      if(e.deployed<e.t.pir&&e.v73DeployT<=0){
        if(v73DeployBoarder(e)){
          e.deployed++;
          e.v73DeployT=e.type==='manowar'?.22:V73_DEPLOY_INTERVAL;
        }else e.v73DeployT=.08;
      }
    }else{
      e.v73Boarding=false;
    }

    if(v73TransportFinished(e)&&typeof removeV69TransportShip==='function'){
      removeV69TransportShip(e,true);
    }
  }
}

/* V7.3 彻底取消接舷锁：旧航行层仍负责靠近和船体碰撞，但能否放海盗只看严格二维距离。 */
lockEnemyContact=function(){return false;};

const _updateV73=update;
update=function(dt){
  _updateV73(dt);
  v73UpdateProximityBoarding(dt);
  g.shake=0;
};

drawMenu=function(){
  overlay();
  txt('大 航 海 时 代',960,270,106,'#ffffff','#5f3a17',14);
  txt('V7.3 · 近距离直接登船',960,355,38,'#ffd23e','#5f3a17',6);
  const lines=[
    '🏴‍☠️ 敌船不再需要贴船舷或抢接舷位置，只要真正靠近旗舰就能开始放海盗',
    '🌊 使用二维船体表面距离：严格 50px 内才放人，51px 立即停止，不再有额外滞回距离',
    '🪢 海盗改用荡索 / 攀绳直接进入甲板，不再生成接舷跳板，也不占登船通道',
    '👥 V7.0 的甲板活跃海盗 40 人上限继续保留，达到上限后附近敌船自动等待',
    '⏱️ 15 秒无限波、8 人防线、弓箭手持续射击、敌船卸兵后原地消失全部保留'
  ];
  lines.forEach((l,i)=>txt(l,960,435+i*48,25,'#e8f4fb','#0e3a52',5));
  bigButton(BTN_START,'开始甲板船潮！');
  txt('无需接舷 · 二维船体距离 ≤50px 才登船',960,835,21,'#9cc4d8',null,0);
};
