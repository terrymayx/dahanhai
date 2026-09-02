/* V7.2：零吸附接舷。敌船必须自己航行到真实接触阈值，锁定时不再修改船体 X。 */
const V72_LOCK_GAP=2;

function v72DockingGap(e){
  if(!e)return Infinity;
  const p=contactPointForEnemy(e),c=enemyCollider(e);
  const targetX=p.x+c.rx-PLAYER_COLLIDER.skin;
  return e.x-targetX;
}
function v72PhysicalContactReady(e){
  if(!e||e.state==='sink'||e.gone||!shipsTouchPlayer(e))return false;
  const gap=v72DockingGap(e);
  return Number.isFinite(gap)&&gap<=V72_LOCK_GAP;
}

/* 覆盖旧 lock：旧版在 shipsTouchPlayer() 刚成立时会 e.x=targetX，视觉上像被磁吸过去。
   V7.2 只有剩余间隙 <=2px 才锁定，并且锁定函数本身绝不修改 e.x。 */
lockEnemyContact=function(e){
  if(!v72PhysicalContactReady(e))return false;
  const p=contactPointForEnemy(e),c=enemyCollider(e);
  const currentX=e.x;
  for(const o of g.enemies){
    if(o===e||o.gone||o.state==='sink'||o.state!=='docked'||!o.contact)continue;
    const oc=enemyCollider(o);
    const overlapX=Math.abs(currentX-o.x)<c.rx+oc.rx;
    const overlapY=Math.abs(p.y-o.y)<c.ry+oc.ry+6;
    if(overlapX&&overlapY)return false;
  }
  e.contact=true;e.contactX=p.x;e.contactY=p.y;e.targetContactY=p.y;
  e.contactNormalX=p.normalX;e.contactNormalY=p.normalY;
  e.berthWaitT=0;e.berthStallT=0;e.berthLastX=e.x;
  return true;
};

drawMenu=function(){
  overlay();
  txt('大 航 海 时 代',960,270,106,'#ffffff','#5f3a17',14);
  txt('V7.2 · 零吸附接舷',960,355,38,'#ffd23e','#5f3a17',6);
  const lines=[
    '🚢 敌船靠近旗舰时不再被自动拉到船舷，必须靠自身航行完成最后一段距离',
    '🪝 只有与船舷剩余距离 ≤ 2px 时才锁定接舷，锁定过程不再修改船体位置',
    '↔️ V7.1 拥堵改道继续保留：没位置就换接触点或外侧等待，不硬挤',
    '⚔️ 真实接触后才允许放海盗；甲板三路人潮、40 人上限与无攻击抖动继续保留',
    '⏱️ 无限运兵船潮继续固定 15 秒一波，卸兵完成后母船原地消失'
  ];
  lines.forEach((l,i)=>txt(l,960,435+i*48,25,'#e8f4fb','#0e3a52',5));
  bigButton(BTN_START,'开始甲板船潮！');
  txt('无磁吸 · 真实贴舷 · 拥堵自动改道',960,835,21,'#9cc4d8',null,0);
};
