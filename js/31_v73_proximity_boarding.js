/* V7.3：近距离直接登船。敌舰只要进入旗舰附近即可持续放海盗，不再需要接舷锁、船舷槽位或跳板。 */
const V73_BOARDING_RANGE=50;
const V73_DEPLOY_INTERVAL=.28;
const V73_RANGE_HYSTERESIS=70;

function v73ProximityGap(e){
  if(!e)return Infinity;
  const p=contactPointForEnemy(e),c=enemyCollider(e);
  return Math.max(0,e.x-(p.x+c.rx-PLAYER_COLLIDER.skin));
}
function v73CanBoardFromProximity(e){
  if(!e||e.gone||e.state==='sink'||!e.t)return false;
  if(!(e.state==='approach'||e.state==='hold'||e.state==='closing'||e.state==='docked'))return false;
  const range=V73_BOARDING_RANGE+(e.v73Boarding?V73_RANGE_HYSTERESIS:0);
  return v73ProximityGap(e)<=range;
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
      /* 进入近距离登船区后不再争抢船舷位置，停在外围附近持续放人。 */
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
    }else if(e.v73Boarding&&v73ProximityGap(e)>V73_BOARDING_RANGE+V73_RANGE_HYSTERESIS){
      e.v73Boarding=false;
    }

    if(v73TransportFinished(e)&&typeof removeV69TransportShip==='function'){
      removeV69TransportShip(e,true);
    }
  }
}

/* V7.3 彻底取消接舷锁：旧航行层仍负责靠近和船体碰撞，但能否放海盗只看距离。 */
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
    '🏴‍☠️ 敌船不再需要贴船舷或抢接舷位置，只要靠近旗舰就能开始放海盗',
    '🌊 靠近范围为 50px；多艘敌船即使互相挤在一起，也能同时持续输送海盗',
    '🪢 海盗改用荡索 / 攀绳直接进入甲板，不再生成接舷跳板，也不占登船通道',
    '👥 V7.0 的甲板活跃海盗 40 人上限继续保留，达到上限后附近敌船自动等待',
    '⏱️ 15 秒无限波、8 人防线、弓箭手持续射击、敌船卸兵后原地消失全部保留'
  ];
  lines.forEach((l,i)=>txt(l,960,435+i*48,25,'#e8f4fb','#0e3a52',5));
  bigButton(BTN_START,'开始甲板船潮！');
  txt('无需接舷 · 50px 内登船 · 多船同时输送',960,835,21,'#9cc4d8',null,0);
};
