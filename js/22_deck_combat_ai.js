/* V6.6 甲板近战 AI：分散围攻、角色站位、远程后撤、炮手保持爆弹距离。 */

/* V6.6 DECK COMBAT AI START */
const DECK_COMBAT_BOUNDS={minX:300,maxX:590,minY:285,maxY:835};

function crewCombatProfile(c){
  const id=c&&c.id;
  if(id==='archer') return {min:150,preferred:205,speed:78};
  if(id==='gunner') return {min:92,preferred:122,speed:68};
  if(id==='drummer')return {min:46,preferred:68,speed:72};
  return {min:18,preferred:34,speed:90};
}
function clampDeckPoint(p){
  return {x:clamp(p.x,DECK_COMBAT_BOUNDS.minX,DECK_COMBAT_BOUNDS.maxX),
          y:clamp(p.y,DECK_COMBAT_BOUNDS.minY,DECK_COMBAT_BOUNDS.maxY)};
}
function enterBoarderFight(b){
  b.state='fight';b.boardingChannel=null;b.targetCrewId=null;
  if(!Number.isFinite(b.fightSlot)){
    const used=new Set(g.boarders.filter(o=>o!==b&&o.hp>0&&o.state==='fight'&&Number.isFinite(o.fightSlot)).map(o=>o.fightSlot));
    let slot=0;while(slot<12&&used.has(slot))slot++;
    b.fightSlot=slot<12?slot:(g.boarders.indexOf(b)%12+12)%12;
  }
}
function boarderAttackPoint(b,tgt){
  const slot=Number.isFinite(b.fightSlot)?b.fightSlot:0;
  const ring=Math.floor(slot/8),ang=(slot%8)*Math.PI/4+(ring?Math.PI/8:0),r=38+ring*12;
  return clampDeckPoint({x:tgt.x+Math.cos(ang)*r,y:tgt.y+Math.sin(ang)*r});
}
function boarderTargetLoad(crewId,except){
  return g.boarders.filter(o=>o!==except&&o.hp>0&&o.state==='fight'&&o.targetCrewId===crewId).length;
}
function chooseBoarderCrewTarget(b){
  const current=g.crew.find(c=>c.alive&&c.id===b.targetCrewId);
  if(current)return current;
  let best=null,bestScore=Infinity;
  for(const c of g.crew){
    if(!c.alive)continue;
    const score=dist(b.x,b.y,c.x,c.y)+boarderTargetLoad(c.id,b)*76;
    if(score<bestScore){best=c;bestScore=score;}
  }
  b.targetCrewId=best?best.id:null;
  return best;
}
function deckFightBoarders(){return g.boarders.filter(b=>b.hp>0&&b.state==='fight');}
function boarderClusterCount(target,r=105){
  let n=0;for(const b of deckFightBoarders())if(dist(target.x,target.y,b.x,b.y)<=r)n++;return n;
}
function chooseCrewCombatTarget(c){
  let best=null,bestScore=Infinity;
  for(const b of deckFightBoarders()){
    let score=dist(c.x,c.y,b.x,b.y);
    if(c.id==='gunner')score-=boarderClusterCount(b,105)*34;
    if(score<bestScore){best=b;bestScore=score;}
  }
  return best;
}
function moveCrewCombat(c,tgt,dt){
  const p=crewCombatProfile(c);
  if(!tgt){
    const hx=Number.isFinite(c.homeX)?c.homeX:c.x,hy=Number.isFinite(c.homeY)?c.homeY:c.y;
    const d=dist(c.x,c.y,hx,hy);
    if(d>2){const step=Math.min(d,p.speed*.65*dt);c.x+=(hx-c.x)/d*step;c.y+=(hy-c.y)/d*step;}
  }else{
    const d=Math.max(.001,dist(c.x,c.y,tgt.x,tgt.y));
    const ux=(tgt.x-c.x)/d,uy=(tgt.y-c.y)/d;
    if(d<p.min){const step=Math.min(p.speed*dt,p.min-d+8);c.x-=ux*step;c.y-=uy*step;}
    else if(d>p.preferred+12){const step=Math.min(p.speed*dt,d-p.preferred);c.x+=ux*step;c.y+=uy*step;}
  }
  const q=clampDeckPoint(c);c.x=q.x;c.y=q.y;
}
function separateDeckFighters(){
  const a=deckFightBoarders(),minD=28;
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){
    const A=a[i],B=a[j];let dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy);
    if(d>=minD)continue;
    if(d<.001){dx=(j&1)?1:-1;dy=(j&2)?1:-1;d=Math.hypot(dx,dy);}
    const push=(minD-d)/2,ux=dx/d,uy=dy/d;
    A.x-=ux*push;A.y-=uy*push;B.x+=ux*push;B.y+=uy*push;
    let q=clampDeckPoint(A);A.x=q.x;A.y=q.y;q=clampDeckPoint(B);B.x=q.x;B.y=q.y;
  }
}
function separateCrewFormation(){
  const a=g.crew.filter(c=>c.alive),minD=34;
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){
    const A=a[i],B=a[j];let dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy);
    if(d>=minD)continue;
    if(d<.001){dx=(j&1)?1:-1;dy=(j&2)?1:-1;d=Math.hypot(dx,dy);}
    const push=(minD-d)/2,ux=dx/d,uy=dy/d;
    A.x-=ux*push;A.y-=uy*push;B.x+=ux*push;B.y+=uy*push;
    let q=clampDeckPoint(A);A.x=q.x;A.y=q.y;q=clampDeckPoint(B);B.x=q.x;B.y=q.y;
  }
}
/* V6.6 DECK COMBAT AI END */

/* 接管海盗甲板行为：过板流程保持 V6.4，仅替换进入甲板后的战斗移动与目标分配。 */
updateBoarder=function(b,dt){
  if(b.state==='plank'){
    const wp=b.wp[b.i];
    if(!wp){enterBoarderFight(b);return;}
    const d=dist(b.x,b.y,wp.x,wp.y);
    if(d<10)b.i++;else{b.x+=(wp.x-b.x)/d*82*SPD*dt;b.y+=(wp.y-b.y)/d*82*SPD*dt;}
    return;
  }
  if(b.state==='swing'){
    b.swingT+=dt;const p=clamp(b.swingT/b.dur,0,1),q=1-p,cx=(b.anchor.x+b.to.x)/2-20,cy=Math.min(b.anchor.y,b.to.y)-115;
    b.x=q*q*b.from.x+2*q*p*cx+p*p*b.to.x;b.y=q*q*b.from.y+2*q*p*cy+p*p*b.to.y;
    if(p>=1)enterBoarderFight(b);return;
  }
  if(b.state==='climb'){
    b.climbT+=dt;const p=clamp(b.climbT/.75,0,1);b.x=b.x+(b.to.x-b.x)*Math.min(1,dt*5);b.y=b.y+(b.to.y-b.y)*Math.min(1,dt*5);
    if(p>=1)enterBoarderFight(b);return;
  }

  const tgt=chooseBoarderCrewTarget(b);
  if(tgt){
    const attack=boarderAttackPoint(b,tgt),pd=dist(b.x,b.y,attack.x,attack.y),td=dist(b.x,b.y,tgt.x,tgt.y);
    if(pd>11&&td>42){b.x+=(attack.x-b.x)/pd*64*SPD*dt;b.y+=(attack.y-b.y)/pd*64*SPD*dt;}
    if(td<=58){
      b.atkT-=dt;
      if(b.atkT<=0){
        b.atkT=.95;b.anim=.3;tgt.hp-=7;tgt.flash=.25;slashFx((b.x+tgt.x)/2,(b.y+tgt.y)/2);sfx.slash();
        if(tgt.hp<=0){tgt.alive=false;tgt.hp=0;b.targetCrewId=null;sfx.die();g.texts.push({x:tgt.x,y:tgt.y-40,str:tgt.id==='captain'?'船长倒下了！':'船员倒下了…',t:1.2,color:'#ff8a7e',size:22});}
      }
    }
  }else{
    b.targetCrewId=null;
    const sx=430,sy=620,d=dist(b.x,b.y,sx,sy);
    if(d>60){b.x+=(sx-b.x)/d*62*SPD*dt;b.y+=(sy-b.y)/d*62*SPD*dt;}
    else{b.atkT-=dt;if(b.atkT<=0){b.atkT=1.1;b.anim=.3;damagePlayer(7,b.x,b.y);slashFx(b.x-30,b.y);sfx.slash();}}
  }
};

/* 船长由原更新循环调用；只追已经真正进入甲板 fight 的海盗。 */
moveCaptain=function(c,tgt,dt){
  const fightTgt=tgt&&tgt.hp>0&&tgt.state==='fight'?tgt:chooseCrewCombatTarget(c);
  moveCrewCombat(c,fightTgt,dt);
};

/* 让弓箭手 / 炮手 / 鼓手也参与站位，同时每帧做局部分离。 */
const _updateDeckCombatV66=update;
update=function(dt){
  if(g&&g.crew){
    for(const c of g.crew){
      if(!c.alive||c.id==='captain')continue;
      const tgt=chooseCrewCombatTarget(c);
      moveCrewCombat(c,tgt,dt);
    }
    separateCrewFormation();
  }

  _updateDeckCombatV66(dt);

  if(g){
    separateDeckFighters();
    separateCrewFormation();
  }
};
