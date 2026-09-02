/* V7.1：接舷疏堵 + 取消攻击抖动。保留真实接触登船、V7.0 三路甲板战与重击落水。 */
const V71_JAM_TIMEOUT=0.65;
const V71_PROGRESS_EPS=8;

function v71BerthGap(e,y=e&&e.targetContactY){
  if(!e||!Number.isFinite(y))return Infinity;
  const p=contactPointAtY(e,y),c=enemyCollider(e);
  return Math.max(0,e.x-(p.x+c.rx-PLAYER_COLLIDER.skin));
}
function v71PickAlternateBerthingY(e,avoidY){
  if(!e)return null;
  const c=enemyCollider(e),skip=Math.max(berthingScanStep(e)*.72,c.ry*.38);
  let best=null,bestScore=Infinity;
  for(const y of berthingCandidateYs(e)){
    if(Number.isFinite(avoidY)&&Math.abs(y-avoidY)<skip)continue;
    if(berthingTargetBlocked(e,y))continue;
    const score=Math.abs(y-e.y);
    if(score<bestScore){best=y;bestScore=score;}
  }
  return best;
}
function v71ResetJamTracking(e){
  if(!e)return;
  e.v71TrackedY=Number.isFinite(e.targetContactY)?e.targetContactY:null;
  e.v71BestGap=Number.isFinite(e.targetContactY)?v71BerthGap(e,e.targetContactY):null;
  e.v71JamT=0;
}
function v71TrackClosingProgress(e,dt){
  if(!e||e.state!=='closing'||e.gone||!Number.isFinite(e.targetContactY)){
    if(e){e.v71TrackedY=null;e.v71BestGap=null;e.v71JamT=0;}
    return false;
  }
  if(e.v71TrackedY!==e.targetContactY||!Number.isFinite(e.v71BestGap))v71ResetJamTracking(e);
  const gap=v71BerthGap(e,e.targetContactY);
  if(gap<=36){e.v71BestGap=Math.min(e.v71BestGap,gap);e.v71JamT=0;return false;}

  if(e.v71BestGap-gap>=V71_PROGRESS_EPS){
    e.v71BestGap=gap;e.v71JamT=0;return false;
  }
  e.v71JamT=(e.v71JamT||0)+dt;
  if(e.v71JamT<V71_JAM_TIMEOUT)return false;

  const blockedY=e.targetContactY,alt=v71PickAlternateBerthingY(e,blockedY);
  if(Number.isFinite(alt)){
    e.targetContactY=alt;
    e.berthRepathT=Math.max(.28,(typeof enemyAIProfile==='function'?enemyAIProfile(e).repath*.55:.32));
  }else{
    /* 没有空接舷位时先退回原 closing 等待逻辑，不继续把船体压进拥堵区。 */
    e.targetContactY=null;
    e.berthRepathT=.30;
    e.berthWaitT=0;
  }
  v71ResetJamTracking(e);
  return true;
}
function v71UpdateBoardingFlow(dt){
  for(const e of g.enemies){
    if(e.state==='closing'&&Number.isFinite(e.targetContactY))v71TrackClosingProgress(e,dt);
    else if(e.v71TrackedY!==undefined){e.v71TrackedY=null;e.v71BestGap=null;e.v71JamT=0;}
  }
}

/* 取消 V7.0 普通受击的 5~10px 微后顿和 hit-stun，避免近战单位来回抖。
   重击仍是一次性明确击退，并继续支持把海盗打落水。 */
applyV70Impact=function(b,d){
  if(!b||b.hp<=0||b.v70DeathPending)return false;
  b.v70HitStun=0;
  const src=v70NearestLivingCrew(b),heavy=d>=27||!!(src&&src.id==='gunner'&&d>=17);
  if(!heavy)return true;
  let dx=src?b.x-src.x:1,dy=src?b.y-src.y:0,len=Math.hypot(dx,dy)||1;
  const push=clamp(25+(d-27)*1.35,25,55);
  b.x+=dx/len*push;b.y+=dy/len*push;
  if(b.x<DECK_COMBAT_BOUNDS.minX||b.x>DECK_COMBAT_BOUNDS.maxX||b.y<DECK_COMBAT_BOUNDS.minY||b.y>DECK_COMBAT_BOUNDS.maxY){
    queueV70Death(b,'overboard');
  }else{
    b.x=clamp(b.x,DECK_COMBAT_BOUNDS.minX,DECK_COMBAT_BOUNDS.maxX);
    b.y=clamp(b.y,DECK_COMBAT_BOUNDS.minY,DECK_COMBAT_BOUNDS.maxY);
  }
  return true;
};

/* V7.1 位于 V7.0 外层：老 update 完整执行后再做拥堵进度判断；渲染前强制清零全屏 shake。 */
const _updateV71=update;
update=function(dt){
  _updateV71(dt);
  v71UpdateBoardingFlow(dt);
  g.shake=0;
};

/* 进入新局也不要继承任何屏幕抖动。 */
if(typeof newGame==='function'){
  const _newGameV71=newGame;
  newGame=function(){const state=_newGameV71();state.shake=0;return state;};
}

drawMenu=function(){
  overlay();
  txt('大 航 海 时 代',960,270,106,'#ffffff','#5f3a17',14);
  txt('V7.1 · 接舷疏堵',960,355,38,'#ffd23e','#5f3a17',6);
  const lines=[
    '🪝 接舷舰如果被其他船推挤、实际没有前进，会自动换一个真实接触位置',
    '↔️ 连续 0.65 秒无有效进展就改道；没有空位时先外侧等待，不再硬挤旗舰',
    '⚔️ 普通攻击取消微后顿与 hit-stun，甲板近战不再来回抖动',
    '📷 全屏攻击震动已经关闭；重击的大幅击退与打落水继续保留',
    '⏱️ V6.9 的 15 秒无限运兵船潮、V7.0 三路甲板战与 40 人上限全部保留'
  ];
  lines.forEach((l,i)=>txt(l,960,435+i*48,25,'#e8f4fb','#0e3a52',5));
  bigButton(BTN_START,'开始甲板船潮！');
  txt('接舷改道 · 无拥堵硬挤 · 无攻击抖动',960,835,21,'#9cc4d8',null,0);
};
