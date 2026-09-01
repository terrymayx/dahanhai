/* V5.7 贴舷不停顿修复：敌船持续前进到真实接触，接触后立刻显示搭板/抓钩 */

/*
 * V5.4 的碰撞夹位会按敌船“当前 y”把船头提前挡在旗舰外侧。
 * 当敌船还在向上/下舷平滑对齐时，这会造成明显的“停在半路”。
 * closing 状态允许最多 30px 的船体缓冲重叠，让船头真正贴到目标接舷点；
 * 其他状态仍使用原来的物理碰撞约束。
 */
const _constrainEnemyOutsidePlayerV57=constrainEnemyOutsidePlayer;
constrainEnemyOutsidePlayer=function(e){
  if(e&&e.state==='closing'&&e.slot&&e.t.role!=='ranged'&&e.state!=='sink'&&!e.gone){
    const c=enemyCollider(e);
    const dy=Math.abs(e.y-PLAYER_COLLIDER.cy);
    if(dy<=PLAYER_COLLIDER.ry+c.ry*.5){
      const hullLimit=playerHullRightX(e.y)+c.rx-PLAYER_COLLIDER.skin;
      const finalLimit=dockCX(e);
      const minX=Math.max(finalLimit,hullLimit-30);
      if(e.x<minX)e.x=minX;
    }
    return;
  }
  return _constrainEnemyOutsidePlayerV57(e);
};

/* closing 最后阶段保持可见的最低前进速度，不再以 12% 的速度慢到像静止。 */
const _updateBerthingV57=update;
update=function(dt){
  const beforeX=new Map();
  for(const e of g.enemies){
    if(e.state==='closing'&&e.t.role!=='ranged'&&!e.gone)beforeX.set(e,e.x);
  }

  _updateBerthingV57(dt);

  let movedExtra=false;
  for(const e of g.enemies){
    if(e.state!=='closing'||e.t.role==='ranged'||e.gone||e.state==='sink'||!e.slot)continue;
    if(!beforeX.has(e))continue;

    const oldX=beforeX.get(e);
    const moved=Math.max(0,oldX-e.x);
    const minForwardSpeed=Math.max(24,e.t.sp*.34)*SPD;
    const minStep=minForwardSpeed*dt;
    const targetX=dockCX(e);

    if(moved<minStep&&e.x>targetX){
      e.x=Math.max(targetX,e.x-(minStep-moved));
      constrainEnemyOutsidePlayer(e);
      movedExtra=true;
    }

    if(shipsTouchPlayer(e)){
      e.x=dockCX(e);
      e.y=slotTargetY(e);
      e.state='docked';
      e.contact=true;
      e.deployT=.18;
      g.warnT=3.5;
      if(typeof sfx!=='undefined'&&sfx.alarm)sfx.alarm();
    }
  }

  if(movedExtra)resolveEnemyShipCollisions();
};

/*
 * 旧主循环仍要求 rot>0.9 才画跳板，但现在敌船永远 rot=0。
 * 改为在绘制旗舰之前，直接为真实 docked/contact 的敌船绘制船头搭板。
 */
function drawBowDockedGearV57(e){
  if(!e||e.state!=='docked'||!e.contact||!shipsTouchPlayer(e))return;
  const bowX=enemyBowX(e);
  const enemyDeckX=bowX+Math.max(46,72*e.s);
  const ys=e.slot==='both'?[SLOTS.upper.plankY,SLOTS.lower.plankY]:[
    e.slot==='upper'?SLOTS.upper.plankY:SLOTS.lower.plankY
  ];

  for(const py of ys){
    const playerDeckX=562;
    const y1=py;
    const y2=e.y+clamp(py-e.y,-38,38);
    const dx=enemyDeckX-playerDeckX;
    const dy=y2-y1;
    const len=Math.max(38,Math.hypot(dx,dy));
    const ang=Math.atan2(dy,dx);
    const mx=(playerDeckX+enemyDeckX)/2;
    const my=(y1+y2)/2;

    ctx.save();
    ctx.translate(mx,my);
    ctx.rotate(ang);
    rr(-len/2,-12,len,24,5);
    ctx.fillStyle='#b5793a';ctx.fill();
    ctx.strokeStyle='#7a4a21';ctx.lineWidth=4;ctx.stroke();
    ctx.strokeStyle='#8a5a2b';ctx.lineWidth=2;
    ctx.beginPath();
    for(let x=-len/2+18;x<len/2-8;x+=22){ctx.moveTo(x,-11);ctx.lineTo(x,11);}
    ctx.stroke();
    ctx.restore();

    const slot=py===SLOTS.upper.plankY?SLOTS.upper:SLOTS.lower;
    const ropeStartY=e.y+clamp(slot.hookY-e.y,-30,30);
    ctx.strokeStyle='#b98c4f';ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(enemyDeckX+10,ropeStartY);
    ctx.quadraticCurveTo((enemyDeckX+610)/2,slot.hookY-12,610,slot.hookY);
    ctx.stroke();
  }
}

const _drawPlayerShipBerthingV57=drawPlayerShip;
drawPlayerShip=function(){
  for(const e of g.enemies)drawBowDockedGearV57(e);
  _drawPlayerShipBerthingV57();
};
