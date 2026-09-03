(function(root){
  'use strict';

  const Crew=root.V105Crew||(root.DHH&&root.DHH.V105Crew),G=root.V8ShipGrid,V104=root.V104Boarding||(root.DHH&&root.DHH.V104Boarding);
  if(!Crew||!G||!V104)throw new Error('V10.5 crew AI requires crew, grid and V10.4 boarding');
  root.DHH=root.DHH||{};
  const NAVAL_STEP=.20,BOARDING_STEP=.10,ARCHER_MIN=52,ARCHER_MAX=92,ELITE_WINDUP=.60;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function norm(x,y){const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d,d};}
  function alive(c){return Crew.aliveCrewMember(c);}
  function fightReady(c){return alive(c)&&(c.state==='fight'||c.state==='v105Fight'||c.state==='heavyWindup'||c.state==='blocking');}
  function defenders(state){const b=state&&state.boarding;return b?[b.captain,...(b.allies||[])].filter(alive):[];}
  function boarders(state){const b=state&&state.boarding;return b?(b.boarders||[]).filter(alive):[];}
  function nearest(from,list){let best=null,bd=Infinity;for(const c of list||[]){if(!alive(c))continue;const d=Math.hypot(c.x-from.x,c.y-from.y);if(d<bd){bd=d;best=c;}}return best?{unit:best,d:bd}:null;}
  function pushFx(state,fx){if(!state||!state.fx)return;state.fx.push(fx);if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);}
  function cellValid(ship,x,y){
    if(!ship)return false;const l=G.worldToLocal(ship,x,y),g=G.localToGrid(ship,l.x,l.y),c=ship.cellMap&&ship.cellMap[g.gx+','+g.gy];
    return !!(c&&c.alive&&!c.detachedGone&&c.type!=='hull');
  }
  function nearestShipPoint(ship,x,y){
    let best=null,bd=Infinity;for(const c of ship&&ship.cells||[]){if(!c||!c.alive||c.detachedGone||c.type==='hull')continue;const p=G.cellCenterWorld(ship,c),d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);if(d<bd){bd=d;best=p;}}
    return best;
  }
  function moveOnShip(ship,u,dx,dy,dt){
    if(!ship||!u||!(dt>0))return false;const n=norm(dx,dy);if(n.d<.5)return false;u.faceX=n.x;u.faceY=n.y;
    const nx=u.x+n.x*u.speed*dt,ny=u.y+n.y*u.speed*dt;
    if(cellValid(ship,nx,ny)){u.x=nx;u.y=ny;return true;}
    const near=nearestShipPoint(ship,nx,ny);if(near&&Math.hypot(near.x-nx,near.y-ny)<=(ship.cellSize||16)*1.55){u.x=near.x;u.y=near.y;return true;}return false;
  }
  function moveOnPlayerDeck(state,u,dx,dy,dt){
    if(!state||!state.player||!u)return false;const n=norm(dx,dy);if(n.d<.5)return false;u.faceX=n.x;u.faceY=n.y;
    const nx=u.x+n.x*u.speed*dt,ny=u.y+n.y*u.speed*dt,l=G.worldToLocal(state.player,nx,ny),g=G.localToGrid(state.player,l.x,l.y);
    if(V104.isWalkable(state,g.gx,g.gy)){u.x=nx;u.y=ny;return true;}
    const near=V104.nearestWalkable(state,nx,ny);if(near&&Math.hypot(near.x-nx,near.y-ny)<=(state.player.cellSize||16)*1.55){u.x=near.x;u.y=near.y;return true;}return false;
  }
  function knockback(state,target,from,power){
    if(!target||!alive(target))return false;const n=norm(target.x-from.x,target.y-from.y),dist=Math.max(3,Number(power)||10);
    for(let t=1;t>=.35;t-=.2)if(moveOnPlayerDeck(state,target,n.x,n.y,dist/Math.max(1,target.speed)*t))return true;return false;
  }
  function blockedByElite(target,attacker){
    if(!target||target.combatClass!=='eliteCaptain'||!(target.blockT>0)||!attacker)return false;
    const to=norm(attacker.x-target.x,attacker.y-target.y),fx=Number(target.faceX)||-1,fy=Number(target.faceY)||0;return to.x*fx+to.y*fy>.15;
  }
  function strike(state,attacker,target,damage,kind,knock){
    if(!alive(attacker)||!alive(target))return false;let dealt=damage;
    if(blockedByElite(target,attacker)){dealt*=.3;pushFx(state,{k:'v105Block',x:target.x,y:target.y,t:0,dur:.16,r:16});}
    Crew.damageCrew(target,dealt,{kind:kind||'melee',attackerId:attacker.id});target.hitT=.12;
    if(knock&&alive(target))knockback(state,target,attacker,knock);
    return true;
  }
  function captainTarget(state,captain){
    let best=null,bd=Infinity;for(const e of boarders(state)){if(!fightReady(e)||e.currentShipId!==state.player.id)continue;const d=Math.hypot(e.x-captain.x,e.y-captain.y);if(d<=captain.attackRange&&d<bd){bd=d;best=e;}}
    return best?{unit:best,d:bd}:null;
  }
  function updateCaptainBoarding(state,dt){
    const b=state&&state.boarding,c=b&&b.captain;if(!b||!b.active||!alive(c))return false;
    c.comboTimer=Math.max(0,(Number(c.comboTimer)||0)-dt);if(c.comboTimer<=0)c.comboStep=0;
    if((Number(c.attackTimer)||0)>0)return false;
    const found=captainTarget(state,c);if(!found)return false;
    const t=found.unit,n=norm(t.x-c.x,t.y-c.y);c.faceX=n.x;c.faceY=n.y;
    const step=(Number(c.comboStep)||0)%3,third=step===2,damage=c.damage*(third?1.65:1);
    strike(state,c,t,damage,third?'captainHeavy':'captainSlash',third?18:0);
    c.comboStep=(step+1)%3;c.comboTimer=.95;c.attackTimer=c.attackCd*(third?1.18:1);
    pushFx(state,{k:third?'v105HeavySlash':'v105Slash',x:c.x+n.x*15,y:c.y+n.y*15,faceX:n.x,faceY:n.y,t:0,dur:third?.22:.15,r:third?30:23});
    return true;
  }
  function targetForEnemy(state,u){
    const b=state&&state.boarding;if(!b)return null;
    if((u.combatClass==='archer'||u.combatClass==='eliteCaptain')&&alive(b.captain))return{unit:b.captain,d:Math.hypot(b.captain.x-u.x,b.captain.y-u.y)};
    return nearest(u,defenders(state));
  }
  function basicMelee(state,u,target,allowChase,dt){
    if(!target||!alive(target))return false;const n=norm(target.x-u.x,target.y-u.y);u.faceX=n.x;u.faceY=n.y;
    if(n.d<=u.attackRange){if((Number(u.attackTimer)||0)<=0){strike(state,u,target,u.damage,'melee',0);u.attackTimer=u.attackCd;pushFx(state,{k:'v105Slash',x:u.x+n.x*10,y:u.y+n.y*10,faceX:n.x,faceY:n.y,t:0,dur:.13,r:18});}return true;}
    if(allowChase)moveOnPlayerDeck(state,u,target.x-u.x,target.y-u.y,dt);return false;
  }
  function updateSwordsman(state,u,dt){const f=targetForEnemy(state,u);if(f)basicMelee(state,u,f.unit,true,dt);}
  function updateArcher(state,u,dt){
    const found=targetForEnemy(state,u);if(!found)return;if(u.currentShipId!==state.player.id)return;
    const t=found.unit,n=norm(t.x-u.x,t.y-u.y);u.faceX=n.x;u.faceY=n.y;
    if(found.d<ARCHER_MIN){if(!moveOnPlayerDeck(state,u,-n.x,-n.y,dt))basicMelee(state,u,t,false,dt);return;}
    if(found.d>ARCHER_MAX){moveOnPlayerDeck(state,u,n.x,n.y,dt);return;}
    if((Number(u.attackTimer)||0)<=0){Crew.damageCrew(t,u.damage,{kind:'arrow',attackerId:u.id});u.attackTimer=u.attackCd;pushFx(state,{k:'v105Arrow',x:u.x,y:u.y,tx:t.x,ty:t.y,t:0,dur:.22,r:3});}
  }
  function updateElite(state,u,dt){
    const found=targetForEnemy(state,u);if(!found)return;const t=found.unit,n=norm(t.x-u.x,t.y-u.y);u.faceX=n.x;u.faceY=n.y;
    u.blockT=Math.max(0,(Number(u.blockT)||0)-dt);u.blockCooldown=Math.max(0,(Number(u.blockCooldown)||0)-dt);u.heavyTimer=Math.max(0,(Number(u.heavyTimer)||0)-dt);
    if(u.state==='heavyWindup'){
      u.heavyWindup=Math.max(0,(Number(u.heavyWindup)||ELITE_WINDUP)-dt);
      if(u.heavyWindup<=0){if(Math.hypot(t.x-u.x,t.y-u.y)<=u.attackRange+9)strike(state,u,t,u.damage*1.8,'eliteHeavy',24);u.state='v105Fight';u.heavyTimer=2.2;u.attackTimer=u.attackCd;pushFx(state,{k:'v105HeavySlash',x:u.x+n.x*13,y:u.y+n.y*13,faceX:n.x,faceY:n.y,t:0,dur:.24,r:31});}return;
    }
    if(found.d<=u.attackRange+7&&u.heavyTimer<=0){u.state='heavyWindup';u.heavyWindup=ELITE_WINDUP;pushFx(state,{k:'v105HeavyWindup',x:u.x,y:u.y,t:0,dur:ELITE_WINDUP,r:24});return;}
    if(found.d<=u.attackRange+5&&u.blockCooldown<=0){u.blockT=.32;u.blockCooldown=2.0;}
    basicMelee(state,u,t,true,dt);
  }
  function updateEnemyClass(state,u,dt){
    if(!u||!alive(u)||!state||!state.boarding||!state.boarding.active)return;
    if(!['fight','v105Fight','heavyWindup','blocking'].includes(u.state))return;
    if(u.combatClass==='archer')updateArcher(state,u,dt);
    else if(u.combatClass==='eliteCaptain')updateElite(state,u,dt);
    else updateSwordsman(state,u,dt);
  }
  function updateDefender(state,u,dt){
    if(!u||!alive(u)||u.role==='captain')return;const found=nearest(u,boarders(state).filter(fightReady));if(!found)return;
    let guard=999;if(u.role==='gunner')guard=58;else if(u.role==='helmsman')guard=48;
    if(found.d>guard)return;basicMelee(state,u,found.unit,true,dt);
  }
  function postPoint(ship,u){
    if(!ship||!u)return null;const Posts=root.V105CrewPosts||(root.DHH&&root.DHH.V105CrewPosts),V=root.V103Broadside||null;
    if(u.role==='helmsman'){const cell=(ship.cells||[]).find(c=>c.alive&&c.type==='rudder');if(cell)return G.cellCenterWorld(ship,cell);}
    if(u.role==='gunner'&&Posts){const group=Posts.gunGroups(ship).find(g=>g.assignedCrewId===u.id||g.replacementCrewId===u.id);if(group&&group.gunIds.length&&V&&typeof V.findGun==='function'){const gun=V.findGun(ship,group.gunIds[0]);if(gun&&gun.cell)return G.cellCenterWorld(ship,gun.cell);}}
    if(!Number.isFinite(u.homeX)){u.homeX=u.x;u.homeY=u.y;}return{x:u.homeX,y:u.homeY};
  }
  function nearestBurning(ship,u){let best=null,bd=Infinity;for(const cell of ship&&ship.__v96BurningCells||[]){if(!cell||!cell.alive||!cell.burning)continue;const p=G.cellCenterWorld(ship,cell),d=Math.hypot(p.x-u.x,p.y-u.y);if(d<bd){bd=d;best={cell,p,d};}}return best;}
  function updateNavalShipCrew(state,ship,dt){
    if(!ship||ship.state!=='active')return;const b=state.boarding,locked=b&&b.active&&b.enemyShipId===ship.id;
    for(const u of ship.crew||[]){
      if(!alive(u)||u.currentShipId!==ship.id||locked&&u.boardingEligible)continue;
      if(u.dangerT>0){const fire=nearestBurning(ship,u);if(fire){const n=norm(u.x-fire.p.x,u.y-fire.p.y);moveOnShip(ship,u,n.x,n.y,dt);u.task='evade';continue;}}
      const target=postPoint(ship,u);if(!target)continue;
      if(u.role==='sailor'&&!u.combatClass){
        if(!Number.isFinite(u.patrolT))u.patrolT=.2+(Math.abs((u.id||'').length%7))*.08;u.patrolT-=dt;
        if(u.patrolT<=0){u.patrolT=.8+((u.id||'').length%5)*.12;u.patrolX=target.x+(((u.id||'').length%3)-1)*(ship.cellSize||16)*1.2;u.patrolY=target.y+((((u.id||'').charCodeAt(0)||1)%3)-1)*(ship.cellSize||16)*1.2;}
        moveOnShip(ship,u,(u.patrolX||target.x)-u.x,(u.patrolY||target.y)-u.y,dt);u.task='patrol';
      }else{moveOnShip(ship,u,target.x-u.x,target.y-u.y,dt);u.task=u.role==='gunner'?'gunPost':u.role==='helmsman'?'helm':'command';}
    }
  }
  function updateFirefighting(state,dt){
    const Posts=root.V105CrewPosts||(root.DHH&&root.DHH.V105CrewPosts);if(!Posts)return;
    for(const ship of [state.player,...(state.enemies||[])].filter(Boolean)){
      const burning=(ship.__v96BurningCells||[]).filter(c=>c&&c.alive&&c.burning&&!c.detachedGone);if(!burning.length)continue;
      const sailors=(ship.crew||[]).filter(c=>alive(c)&&c.role==='sailor'&&!c.combatClass&&c.currentShipId===ship.id);if(!sailors.length)continue;
      let pair=null,bd=Infinity;for(const s of sailors)for(const cell of burning){const p=G.cellCenterWorld(ship,cell),d=Math.hypot(p.x-s.x,p.y-s.y);if(d<bd){bd=d;pair={s,cell,p,d};}}
      if(!pair)continue;pair.s.task='firefighting';
      if(pair.d>(ship.cellSize||16)*1.8)moveOnShip(ship,pair.s,pair.p.x-pair.s.x,pair.p.y-pair.s.y,dt);
      else{pair.cell.__v105Extinguish=(Number(pair.cell.__v105Extinguish)||0)+dt*Posts.firefightingScale(ship);if(pair.cell.__v105Extinguish>=1.8){pair.cell.burning=false;pair.cell.fireDamage=0;pair.cell.__v105Extinguish=0;pushFx(state,{k:'foam',x:pair.p.x,y:pair.p.y,t:0,dur:.45,r:8});}}
    }
  }
  function tickBoardingTimers(state,dt){
    const b=state.boarding;if(!b)return;for(const u of [b.captain,...(b.allies||[]),...(b.boarders||[])] .filter(Boolean)){u.attackTimer=Math.max(0,(Number(u.attackTimer)||0)-dt);u.stunT=Math.max(0,(Number(u.stunT)||0)-dt);}
  }
  function updateBoarding(state,dt){
    tickBoardingTimers(state,dt);updateCaptainBoarding(state,dt);
    for(const u of state.boarding.allies||[])updateDefender(state,u,dt);
    for(const u of state.boarding.boarders||[])updateEnemyClass(state,u,dt);
  }
  function update(state,dt){
    if(!state||!(dt>0))return;
    state.__v105NavalAIT=(Number(state.__v105NavalAIT)||0)+dt;state.__v105BoardAIT=(Number(state.__v105BoardAIT)||0)+dt;
    if(state.__v105NavalAIT>=NAVAL_STEP){const step=state.__v105NavalAIT;state.__v105NavalAIT%=NAVAL_STEP;for(const ship of [state.player,...(state.enemies||[])].filter(Boolean))if(!(state.boarding&&state.boarding.active&&ship===state.player))updateNavalShipCrew(state,ship,step);updateFirefighting(state,step);}
    if(state.boarding&&state.boarding.active&&state.__v105BoardAIT>=BOARDING_STEP){const step=Math.min(.25,state.__v105BoardAIT);state.__v105BoardAIT%=BOARDING_STEP;updateBoarding(state,step);}
  }

  const api={NAVAL_STEP,BOARDING_STEP,ARCHER_MIN,ARCHER_MAX,ELITE_WINDUP,updateCaptainBoarding,updateEnemyClass,updateSwordsman,updateArcher,updateElite,updateDefender,updateNavalShipCrew,updateFirefighting,updateBoarding,moveOnPlayerDeck,moveOnShip,strike,update};
  root.V105CrewAI=api;root.DHH.V105CrewAI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
