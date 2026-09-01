/* V6.9：运兵舰卸兵完成后，从接舷位置所在的上/下侧撤离。 */
const V69_SIDE_RETREAT_MARGIN=220;

function v69TroopsAboard(e){
  if(!e||e.state!=='docked'||!e.t||e.deployed<e.t.pir)return false;
  const live=g.boarders.filter(b=>b.ship===e&&b.hp>0);
  return live.length>0&&live.every(b=>b.state==='fight');
}

function beginV69SideRetreat(e,force=false){
  if(!e||e.state==='sink'||e.gone)return false;
  if(!force&&!v69TroopsAboard(e))return false;
  const sideY=Number.isFinite(e.contactY)?e.contactY:e.y;
  clearEnemyContact(e);
  e.state='retreatSide';
  e.retreatSide=sideY<PLAYER_COLLIDER.cy?-1:1;
  e.retreatSpeed=Math.max(90,e.t.sp*1.35)*SPD;
  e.rot=0;
  return true;
}

function updateV69SideRetreat(e,dt){
  if(!e||e.state!=='retreatSide'||e.gone)return false;
  const dir=e.retreatSide<0?-1:1;
  const speed=Number.isFinite(e.retreatSpeed)?e.retreatSpeed:Math.max(90,e.t.sp*1.35)*SPD;
  e.rot=0;
  e.y+=dir*speed*dt;
  if((dir<0&&e.y<-V69_SIDE_RETREAT_MARGIN)||(dir>0&&e.y>H+V69_SIDE_RETREAT_MARGIN))e.gone=true;
  return true;
}

const _updateV69SideRetreat=update;
update=function(dt){
  _updateV69SideRetreat(dt);
  for(const e of g.enemies){
    /* 最后一名活着的海盗真正进入甲板 fight 后，母船立即解锁离帮。 */
    if(e.state==='docked'&&v69TroopsAboard(e))beginV69SideRetreat(e);
    /* 如果海盗在登船途中全部阵亡，旧逻辑可能进入 retreat；也统一改成上下撤退。 */
    else if(e.state==='retreat')beginV69SideRetreat(e,true);
    if(e.state==='retreatSide')updateV69SideRetreat(e,dt);
  }
};
