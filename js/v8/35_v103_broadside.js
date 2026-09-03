(function(root){
  'use strict';

  const G=root.V8ShipGrid,P=root.V8Projectile,B=root.V8Battle;
  if(!G||!P||!B)throw new Error('V10.3 broadside requires grid, projectile and battle modules');

  const DEG=Math.PI/180;
  const COUNT_BY_KIND={player:7,sloop:3,gunship:5,manowar:7};
  const RELOAD_BY_KIND={player:1.85,sloop:2.45,gunship:2.75,manowar:3.15};
  const ENEMY_TURN_DEG={sloop:32,gunship:25,manowar:18};
  const PLAYER_TURN_DEG=38;
  const RUDDER_TURN_SCALE=.35;
  const SALVO_GAP=.085;
  const FULL_ARC_DEG=22,GUN_ARC_DEG=38,HARD_ARC_DEG=46;

  function clamp(v,a,b){return v<a?a:v>b?b:v;}
  function wrapAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
  function orientation(ship){return ship&&ship.kind==='player'?'vertical':'horizontal';}
  function cellLocal(ship,cell){
    if(G.cellCenterLocal)return G.cellCenterLocal(ship,cell);
    return{x:(cell.gx+.5-ship.gridWidth/2)*ship.cellSize,y:(cell.gy+.5-ship.gridHeight/2)*ship.cellSize};
  }
  function toLocal(ship,p){
    if(G.worldToLocal)return G.worldToLocal(ship,p.x,p.y);
    const dx=p.x-ship.x,dy=p.y-ship.y,c=Math.cos(-(ship.rotation||0)),s=Math.sin(-(ship.rotation||0));
    return{x:dx*c-dy*s,y:dx*s+dy*c};
  }
  function toWorld(ship,p){
    if(G.localToWorld)return G.localToWorld(ship,p.x,p.y);
    const c=Math.cos(ship.rotation||0),s=Math.sin(ship.rotation||0);
    return{x:ship.x+p.x*c-p.y*s,y:ship.y+p.x*s+p.y*c};
  }
  function gunCount(ship){return COUNT_BY_KIND[ship&&ship.kind]||3;}
  function reloadMax(ship){return RELOAD_BY_KIND[ship&&ship.kind]||2.75;}
  function axisHalf(ship){return orientation(ship)==='vertical'?ship.gridHeight*ship.cellSize*.5:ship.gridWidth*ship.cellSize*.5;}
  function lateralHalf(ship){return orientation(ship)==='vertical'?ship.gridWidth*ship.cellSize*.5:ship.gridHeight*ship.cellSize*.5;}
  function axialOf(ship,p){return orientation(ship)==='vertical'?p.y:p.x;}
  function lateralOf(ship,p){return orientation(ship)==='vertical'?p.x:p.y;}

  function promoteCannon(cell){
    if(!cell)return cell;
    const hp=G.CELL_HP&&G.CELL_HP.cannon||30,weight=G.CELL_WEIGHT&&G.CELL_WEIGHT.cannon||1;
    if(cell.type!=='cannon'){
      cell.type='cannon';cell.material='cannon';cell.maxHp=hp;cell.hp=hp;cell.weight=weight;
    }else{
      cell.material='cannon';cell.maxHp=Number(cell.maxHp)||hp;cell.hp=Math.min(cell.maxHp,Math.max(0,Number(cell.hp)||cell.maxHp));cell.weight=Number(cell.weight)||weight;
    }
    cell.critical=true;cell.system='cannon';
    return cell;
  }

  function candidateCells(ship,side){
    const sign=side==='starboard'?1:-1,halfA=axisHalf(ship),out=[];
    for(const cell of ship.cells||[]){
      if(!cell||!cell.alive||!(cell.type==='deck'||cell.type==='cannon'))continue;
      const p=cellLocal(ship,cell),ax=axialOf(ship,p),lat=lateralOf(ship,p);
      if(Math.abs(ax)>halfA*.52)continue;
      if(sign*lat<=0)continue;
      out.push({cell,p,ax,lat});
    }
    return out;
  }

  function selectMounts(ship,side,count,used){
    const sign=side==='starboard'?1:-1,halfA=axisHalf(ship),halfL=lateralHalf(ship),pool=candidateCells(ship,side),chosen=[];
    for(let i=0;i<count;i++){
      const target=count===1?0:(-halfA*.48+(halfA*.96)*(i/(count-1)));
      let best=null,bestScore=Infinity;
      for(const item of pool){
        if(used.has(item.cell))continue;
        const sideDepth=Math.max(0,halfL-sign*item.lat),score=Math.abs(item.ax-target)*4+sideDepth;
        if(score<bestScore){bestScore=score;best=item;}
      }
      if(!best)continue;
      used.add(best.cell);chosen.push(best);
    }
    return chosen;
  }

  function muzzleFor(ship,side,item){
    const sign=side==='starboard'?1:-1,outer=lateralHalf(ship)+5;
    return orientation(ship)==='vertical'?{x:sign*outer,y:item.ax}:{x:item.ax,y:sign*outer};
  }

  function buildSide(ship,side,count,used){
    const mounts=selectMounts(ship,side,count,used),guns=[];
    for(let i=0;i<mounts.length;i++){
      const item=mounts[i],cell=promoteCannon(item.cell),spread=mounts.length<=1?0:(-12+24*(i/(mounts.length-1)));
      guns.push({
        id:side+'-'+i,side,cell,axial:item.ax,muzzleLocal:muzzleFor(ship,side,item),arcOffset:spread*DEG,arcOffsetDeg:spread,
        reload:0,reloadMax:reloadMax(ship),lastShot:-999
      });
    }
    return{guns};
  }

  function ensureBattery(ship){
    if(!ship)return null;
    if(ship.__v103Battery)return ship.__v103Battery;
    const used=new Set(),count=gunCount(ship);
    ship.__v103Battery={port:buildSide(ship,'port',count,used),starboard:buildSide(ship,'starboard',count,used)};
    return ship.__v103Battery;
  }
  function batteryFor(ship){return ensureBattery(ship);}
  function liveGuns(ship,side){
    const b=ensureBattery(ship),groups=side?[b&&b[side]]:[b&&b.port,b&&b.starboard],out=[];
    for(const group of groups)for(const gun of group&&group.guns||[])if(gun.cell&&gun.cell.alive&&gun.cell.type==='cannon')out.push(gun);
    return out;
  }
  function findGun(ship,id){for(const side of ['port','starboard'])for(const gun of liveGuns(ship,side))if(gun.id===id)return gun;return null;}

  function sideForTarget(ship,targetPoint){
    const p=toLocal(ship,targetPoint),lat=orientation(ship)==='vertical'?p.x:p.y;
    return lat>=0?'starboard':'port';
  }
  function localNormalAngle(ship,side){
    if(orientation(ship)==='vertical')return side==='starboard'?0:Math.PI;
    return side==='starboard'?Math.PI/2:-Math.PI/2;
  }
  function sideNormalWorld(ship,side){
    const a=(ship.rotation||0)+localNormalAngle(ship,side);return{x:Math.cos(a),y:Math.sin(a),angle:a};
  }
  function bearingError(ship,side,targetPoint){
    const n=sideNormalWorld(ship,side),dx=targetPoint.x-ship.x,dy=targetPoint.y-ship.y,d=Math.hypot(dx,dy)||1,tx=dx/d,ty=dy/d;
    return Math.atan2(n.x*ty-n.y*tx,n.x*tx+n.y*ty);
  }
  function gunsThatCanBear(ship,side,targetPoint){
    const errorDeg=bearingError(ship,side,targetPoint)/DEG;
    if(Math.abs(errorDeg)>HARD_ARC_DEG)return [];
    return liveGuns(ship,side).filter(gun=>gun.reload<=0&&Math.abs(errorDeg-gun.arcOffsetDeg)<=GUN_ARC_DEG);
  }
  function updateReloads(ship,dt){
    const b=ensureBattery(ship);if(!b)return;
    for(const side of ['port','starboard'])for(const gun of b[side].guns)gun.reload=Math.max(0,(Number(gun.reload)||0)-dt);
  }

  function currentAimPoint(state,target){
    if(B&&typeof B.currentAimPoint==='function'){try{return B.currentAimPoint(state,target)||{x:target.x,y:target.y};}catch(e){}}
    return{x:target.x,y:target.y};
  }
  function aimVelocity(x,y,tx,ty,speed){const dx=tx-x,dy=ty-y,d=Math.hypot(dx,dy)||1;return{vx:dx/d*speed,vy:dy/d*speed};}
  function emitGunFx(state,ship,side,muzzle){
    if(!state.fx)state.fx=[];
    const n=sideNormalWorld(ship,side);
    state.fx.push({k:'muzzle',x:muzzle.x,y:muzzle.y,t:0,dur:.16});
    state.fx.push({k:'muzzleSmoke',x:muzzle.x,y:muzzle.y,nx:n.x,ny:n.y,t:0,dur:.58,r:18});
    if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);
  }
  function applyRecoil(ship,side,gun){
    if(!ship)return;
    const ph=B&&typeof B.ensureShipPhysics==='function'?B.ensureShipPhysics(ship):(ship.physics||(ship.physics={impulseX:0,impulseY:0,angularVelocity:0,offsetX:0,offsetY:0,roll:0,mass:1,damping:.86}));
    const n=sideNormalWorld(ship,side),mass=Math.max(.6,Number(ph.mass)||1),kick=.55/mass;
    ph.impulseX=clamp((ph.impulseX||0)-n.x*kick,-18,18);ph.impulseY=clamp((ph.impulseY||0)-n.y*kick,-18,18);
    const lever=axisHalf(ship)||1,torque=clamp((Number(gun&&gun.axial)||0)/lever,-1,1);
    ph.angularVelocity=clamp((ph.angularVelocity||0)-torque*kick*.006,-.18,.18);
  }
  function firePlayerGun(state,target,gun,side){
    if(!gun||!gun.cell||!gun.cell.alive||gun.reload>0||!target||target.state!=='active')return false;
    const muzzle=toWorld(state.player,gun.muzzleLocal),aim=currentAimPoint(state,target),speed=900,distance=Math.hypot(aim.x-muzzle.x,aim.y-muzzle.y),v=aimVelocity(muzzle.x,muzzle.y,aim.x,aim.y,speed),flightTime=distance/speed,arcHeight=P.computeArcHeight?P.computeArcHeight('player',distance,0):0;
    P.spawn(state,{x:muzzle.x,y:muzzle.y,vx:v.vx,vy:v.vy,damage:24,side:'player',life:3,penetration:78,arcHeight,flightTime});
    emitGunFx(state,state.player,side,muzzle);applyRecoil(state.player,side,gun);gun.reload=gun.reloadMax;gun.lastShot=state.time||0;return true;
  }

  function startPlayerBroadside(state,target){
    if(!state||state.salvo||!state.player||!target||target.state!=='active')return false;
    ensureBattery(state.player);const point=currentAimPoint(state,target),side=sideForTarget(state.player,point),guns=gunsThatCanBear(state.player,side,point).sort((a,b)=>a.axial-b.axial);
    state.__v103LastBearing={side,count:guns.length,error:bearingError(state.player,side,point)};
    if(!guns.length)return false;
    state.salvo={v103:true,type:'player',targetId:target.id,side,gunIds:guns.map(g=>g.id),index:0,t:0};return true;
  }
  function updatePlayerSalvo(state,dt){
    const salvo=state&&state.salvo;if(!salvo||!salvo.v103||salvo.type!=='player')return false;
    salvo.t-=dt;if(salvo.t>0)return true;
    const target=(state.enemies||[]).find(e=>e.id===salvo.targetId&&e.state==='active');if(!target){state.salvo=null;return false;}
    let fired=false;
    while(salvo.index<salvo.gunIds.length&&!fired){
      const gun=findGun(state.player,salvo.gunIds[salvo.index++]);
      if(gun&&gun.cell.alive)fired=firePlayerGun(state,target,gun,salvo.side);
    }
    if(salvo.index>=salvo.gunIds.length){state.salvo=null;return fired;}
    salvo.t+=SALVO_GAP;return true;
  }

  function desiredBroadside(ship,targetPoint){
    const targetAngle=Math.atan2(targetPoint.y-ship.y,targetPoint.x-ship.x),choices=[];
    for(const side of ['port','starboard']){
      const heading=wrapAngle(targetAngle-localNormalAngle(ship,side)),diff=wrapAngle(heading-(ship.rotation||0));choices.push({side,heading,diff});
    }
    choices.sort((a,b)=>Math.abs(a.diff)-Math.abs(b.diff));return choices[0];
  }
  function updateEnemyHeading(state,ship,dt){
    if(!state||!ship||ship.state!=='active'||!state.player||state.player.state!=='active')return;
    ensureBattery(ship);if(Number(ship.x)>1500)return;
    const desired=desiredBroadside(ship,{x:state.player.x,y:state.player.y}),rudder=ship.rudderAlive===false?RUDDER_TURN_SCALE:1,rate=(ENEMY_TURN_DEG[ship.kind]||24)*DEG*rudder,maxStep=rate*dt,diff=wrapAngle(desired.heading-(ship.rotation||0));
    ship.rotation=wrapAngle((ship.rotation||0)+clamp(diff,-maxStep,maxStep));ship.__v103PreferredSide=desired.side;
  }
  function updatePlayerHeading(state,dt){
    const ship=state&&state.player;if(!ship)return;ensureBattery(ship);
    const input=clamp(Number(state.__v103TurnInput)||0,-1,1);if(!input)return;
    const rudder=ship.rudderAlive===false?RUDDER_TURN_SCALE:1;ship.rotation=wrapAngle((ship.rotation||0)+input*PLAYER_TURN_DEG*DEG*rudder*dt);
  }
  function randomAliveCell(ship){const alive=(ship&&ship.cells||[]).filter(c=>c&&c.alive&&!c.detachedGone);return alive.length?alive[Math.floor(Math.random()*alive.length)]:null;}
  function fireEnemyGun(state,ship,gun,side){
    if(!gun||!gun.cell||!gun.cell.alive||gun.reload>0||!state.player||state.player.state!=='active')return false;
    const cell=randomAliveCell(state.player);if(!cell)return false;
    const target=G.cellCenterWorld?G.cellCenterWorld(state.player,cell):{x:state.player.x,y:state.player.y},muzzle=toWorld(ship,gun.muzzleLocal),speed=620,distance=Math.hypot(target.x-muzzle.x,target.y-muzzle.y),v=aimVelocity(muzzle.x,muzzle.y,target.x,target.y,speed),flightTime=distance/speed,arcHeight=P.computeArcHeight?P.computeArcHeight('enemy',distance,0):0;
    P.spawn(state,{x:muzzle.x,y:muzzle.y,vx:v.vx,vy:v.vy,damage:18,side:'enemy',ammoType:'standard',life:4,arcHeight,flightTime});
    emitGunFx(state,ship,side,muzzle);applyRecoil(ship,side,gun);gun.reload=gun.reloadMax;gun.lastShot=state.time||0;return true;
  }
  function fireEnemyBroadside(state,ship){
    if(!state||!ship||ship.state!=='active'||ship.__v103Salvo||!state.player)return false;
    ensureBattery(ship);const point={x:state.player.x,y:state.player.y},side=sideForTarget(ship,point),guns=gunsThatCanBear(ship,side,point).sort((a,b)=>a.axial-b.axial);
    ship.__v103LastBearing={side,count:guns.length,error:bearingError(ship,side,point)};if(!guns.length)return false;
    ship.__v103Salvo={side,gunIds:guns.map(g=>g.id),index:0,t:0};return true;
  }
  function updateEnemySalvo(state,ship,dt){
    const salvo=ship&&ship.__v103Salvo;if(!salvo)return;
    salvo.t-=dt;if(salvo.t>0)return;
    let fired=false;
    while(salvo.index<salvo.gunIds.length&&!fired){const gun=findGun(ship,salvo.gunIds[salvo.index++]);if(gun&&gun.cell.alive)fired=fireEnemyGun(state,ship,gun,salvo.side);}
    if(salvo.index>=salvo.gunIds.length){ship.__v103Salvo=null;return;}
    salvo.t+=SALVO_GAP+.015;
  }

  function updateBattle(state,dt){
    if(!state)return;updatePlayerHeading(state,dt);if(state.player)updateReloads(state.player,dt);
    for(const ship of state.enemies||[]){if(!ship||ship.state!=='active')continue;ensureBattery(ship);updateReloads(ship,dt);updateEnemyHeading(state,ship,dt);updateEnemySalvo(state,ship,dt);}
  }
  function batteryStatus(state,target){
    const ship=state&&state.player;if(!ship)return{port:{live:0,total:0},starboard:{live:0,total:0},side:null,ready:0,error:0};
    const b=ensureBattery(ship),port=liveGuns(ship,'port').length,starboard=liveGuns(ship,'starboard').length,totalP=b.port.guns.length,totalS=b.starboard.guns.length;
    let side=null,ready=0,error=0;if(target){const point=currentAimPoint(state,target);side=sideForTarget(ship,point);ready=gunsThatCanBear(ship,side,point).length;error=bearingError(ship,side,point);}
    return{port:{live:port,total:totalP},starboard:{live:starboard,total:totalS},side,ready,error};
  }

  root.V103Broadside={
    COUNT_BY_KIND,RELOAD_BY_KIND,ENEMY_TURN_DEG,PLAYER_TURN_DEG,RUDDER_TURN_SCALE,SALVO_GAP,FULL_ARC_DEG,GUN_ARC_DEG,HARD_ARC_DEG,
    wrapAngle,ensureBattery,batteryFor,liveGuns,findGun,sideForTarget,sideNormalWorld,bearingError,gunsThatCanBear,updateReloads,
    startPlayerBroadside,updatePlayerSalvo,fireEnemyBroadside,updateEnemyHeading,updateEnemySalvo,updatePlayerHeading,updateBattle,batteryStatus,
    emitGunFx,applyRecoil
  };
})(typeof globalThis!=='undefined'?globalThis:this);
