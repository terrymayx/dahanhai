/* V6.9：运兵舰完成卸兵后原地立即消失；已登上甲板的海盗继续战斗。 */

function v69TroopsUnloaded(e){
  if(!e||e.state!=='docked'||!e.t||e.deployed<e.t.pir)return false;
  return !g.boarders.some(b=>b.ship===e&&b.hp>0&&b.state!=='fight');
}

function removeV69TransportShip(e,force=false){
  if(!e||e.state==='sink'||e.gone)return false;
  if(!force&&!v69TroopsUnloaded(e))return false;

  /* 海盗已经进入独立甲板战斗，不再保留对母船对象的引用。 */
  for(const b of g.boarders){
    if(b.ship===e&&b.hp>0&&b.state==='fight')b.ship=null;
  }

  if(g.focus===e)g.focus=null;
  clearEnemyContact(e);
  e.gone=true;

  /* 本帧直接从绘制数组移除，实现原地瞬间消失，而不是等下一帧过滤。 */
  const i=g.enemies.indexOf(e);
  if(i>=0)g.enemies.splice(i,1);

  /* V6.8 的快照回收发生在本层之前，因此这里主动归还敌船对象池。 */
  if(typeof enemyPool!=='undefined'&&enemyPool&&typeof enemyPool.release==='function')enemyPool.release(e);
  return true;
}

const _updateV69TransportCleanup=update;
update=function(dt){
  _updateV69TransportCleanup(dt);
  for(let i=g.enemies.length-1;i>=0;i--){
    const e=g.enemies[i];
    if(e.state==='docked'&&v69TroopsUnloaded(e))removeV69TransportShip(e);
    /* 兼容旧核心偶尔进入 retreat 的分支：不移动，直接清除。 */
    else if(e.state==='retreat')removeV69TransportShip(e,true);
  }
};
