/* V5.3 平滑贴舷：保持船头朝左，靠近后减速并平滑侧移，真实接触后才锁舷 */
function shipsTouchPlayerV53(e){
  if(!e||!e.slot||e.state==='sink'||e.gone)return false;
  const ty=slotTargetY(e),c=enemyCollider(e);
  const verticalOK=Math.abs(e.y-ty)<=Math.max(20,c.ry*.20);
  const enemyLeft=e.x-c.rx,playerRight=playerHullRightX(ty);
  return verticalOK&&enemyLeft<=playerRight+PLAYER_COLLIDER.skin+3;
}
shipsTouchPlayer=shipsTouchPlayerV53;

slotBlocked=function(key,except){
  return g.enemies.some(e=>e!==except&&e.state!=='sink'&&!e.gone&&
    (e.state==='turning'||e.state==='closing'||e.state==='smoothClosing'||e.state==='docked')&&
    (e.slot==='both'||e.slot===key));
};

boardingMode=function(){
  return deckCombat()||g.enemies.some(e=>e.state==='docked'&&e.contact&&shipsTouchPlayer(e));
};

function smoothBerthingStep(e,dt){
  if(!e||e.t.role==='ranged'||e.state==='sink'||e.gone||!e.slot)return false;
  e.rot=0;e.turnT=0;e.contact=false;
  const ty=slotTargetY(e),targetX=dockCX(e);
  const gap=Math.max(0,e.x-targetX);
  // 越接近旗舰越慢，但始终继续向前，不做瞬移。
  const forwardFactor=clamp(gap/380,0.16,0.72);
  const forwardSpeed=e.t.sp*forwardFactor*SPD;
  e.x=Math.max(targetX,e.x-forwardSpeed*dt);
  // 纵向靠舷速度做上限，避免突然横移到接舷点。
  const lateralSpeed=Math.max(46,e.t.sp*.58)*SPD;
  e.y+=clamp(ty-e.y,-lateralSpeed*dt,lateralSpeed*dt);
  constrainEnemyOutsidePlayer(e);
  if(shipsTouchPlayer(e)){
    e.x=dockCX(e);e.y=ty;e.state='docked';e.contact=true;e.deployT=.45;
    g.warnT=3.5;if(typeof sfx!=='undefined'&&sfx.alarm)sfx.alarm();
    return true;
  }
  e.state='closing';
  return false;
}

const _updateV53=update;
update=function(dt){
  // 旧版 turning/closing 交给 V5.3 的平滑贴舷推进，避免 90° 突然转向。
  for(const e of g.enemies){
    if(e.t.role!=='ranged'&&(e.state==='turning'||e.state==='closing')){
      e.state='smoothClosing';e.rot=0;e.turnT=0;
    }
  }
  _updateV53(dt);
  // approach 在旧逻辑里可能刚刚分配接舷位并进入 turning；本帧直接接管。
  for(const e of g.enemies){
    if(e.t.role==='ranged'||e.state==='sink'||e.gone)continue;
    if(e.state==='turning'||e.state==='smoothClosing'){
      e.state='closing';smoothBerthingStep(e,dt);
    }else if(e.state==='closing'){
      smoothBerthingStep(e,dt);
    }
    if(e.state!=='sink')e.rot=0;
  }
  resolveEnemyShipCollisions();
};
