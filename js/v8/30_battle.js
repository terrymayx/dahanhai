(function(root){
  'use strict';
  const C=root.V8Config,U=root.V8Util,G=root.V8ShipGrid,P=root.V8Projectile;
  if(!C||!U||!G||!P)throw new Error('V8 base, grid and projectile modules must load before battle');

  const ENEMY={
    sloop:{speed:94,fireMin:2.4,fireMax:3.3,gold:55},
    gunship:{speed:60,fireMin:1.8,fireMax:2.7,gold:105},
    manowar:{speed:40,fireMin:2.2,fireMax:3.0,gold:190},
  };
  const SALVO_COUNT=4,SALVO_GAP=.11,SALVO_ARCS=[158,174,188,166],SALVO_ARC_VARIATION=[-10,4,12,-4];
  const SHIP_MASS={sloop:.75,gunship:1,manowar:1.35,player:1.45};

  function ensureShipPhysics(ship){
    if(!ship)return null;
    if(!ship.physics){
      ship.physics={
        impulseX:0,impulseY:0,angularVelocity:0,offsetX:0,offsetY:0,roll:0,
        bobPhase:Number.isFinite(ship.ph)?ship.ph:Math.random()*Math.PI*2,
        mass:SHIP_MASS[ship.kind]||1,damping:.86
      };
    }else{
      if(!Number.isFinite(ship.physics.mass))ship.physics.mass=SHIP_MASS[ship.kind]||1;
      if(!Number.isFinite(ship.physics.damping))ship.physics.damping=.86;
    }
    return ship.physics;
  }

  function applyHitImpulse(ship,cell,pos,projectile,scale){
    if(!ship||!cell||!pos||!projectile)return ship&&ship.physics;
    const ph=ensureShipPhysics(ship),speed=Math.hypot(projectile.vx||0,projectile.vy||0)||1;
    const ux=(projectile.vx||0)/speed,uy=(projectile.vy||0)/speed;
    const material=cell.material||cell.type;
    const base=(G.IMPACT_FORCE&&G.IMPACT_FORCE[material])||3.2;
    const force=base*(scale==null?1:scale)/Math.max(.45,ph.mass||1);
    ph.impulseX=Math.max(-18,Math.min(18,ph.impulseX+ux*force));
    ph.impulseY=Math.max(-18,Math.min(18,ph.impulseY+uy*force));
    const local=G.worldToLocal(ship,pos.x,pos.y);
    const leverScale=Math.max(ship.gridWidth,ship.gridHeight)*ship.cellSize*.5||1;
    const torque=(local.x*uy-local.y*ux)/leverScale;
    ph.angularVelocity=Math.max(-.18,Math.min(.18,ph.angularVelocity+torque*force*.035));
    const signed=(torque===0?(uy||ux*.25):torque);
    ph.roll=Math.max(-.087,Math.min(.087,ph.roll+signed*force*.004+Math.sign(signed||1)*force*.0007));
    return ph;
  }

  function updateShipPhysics(ship,dt){
    if(!ship||dt<=0)return ship&&ship.physics;
    const ph=ensureShipPhysics(ship),frames=dt*60;
    ph.offsetX+=ph.impulseX*dt*13;
    ph.offsetY+=ph.impulseY*dt*13;
    ph.offsetX=Math.max(-14,Math.min(14,ph.offsetX));
    ph.offsetY=Math.max(-14,Math.min(14,ph.offsetY));
    ph.roll+=ph.angularVelocity*dt;
    ph.roll=Math.max(-.087,Math.min(.087,ph.roll));
    const impulseDamp=Math.pow(ph.damping||.86,frames);
    const offsetSpring=Math.pow(.91,frames);
    const angularDamp=Math.pow(.84,frames);
    const rollSpring=Math.pow(.90,frames);
    ph.impulseX*=impulseDamp;ph.impulseY*=impulseDamp;
    ph.offsetX*=offsetSpring;ph.offsetY*=offsetSpring;
    ph.angularVelocity*=angularDamp;ph.roll*=rollSpring;
    if(Math.abs(ph.impulseX)<.002)ph.impulseX=0;
    if(Math.abs(ph.impulseY)<.002)ph.impulseY=0;
    if(Math.abs(ph.offsetX)<.002)ph.offsetX=0;
    if(Math.abs(ph.offsetY)<.002)ph.offsetY=0;
    if(Math.abs(ph.angularVelocity)<.00002)ph.angularVelocity=0;
    if(Math.abs(ph.roll)<.00002)ph.roll=0;
    return ph;
  }

  function addSplinters(state,x,y,count,power){
    power=power||1;
    for(let i=0;i<count;i++)state.fx.push({
      k:'splinter',x,y,
      vx:U.rand(-120,120)*power,vy:U.rand(-130,70)*power,
      t:0,dur:U.rand(.35,.72),r:U.rand(3,7)*Math.min(1.35,power)
    });
  }

  function addWaterSplashFx(state,x,y,size){
    size=size||1;
    state.fx.push({k:'waterSplash',x,y,t:0,dur:.42,r:22*size});
    state.fx.push({k:'waterRing',x,y,t:0,dur:.72,r:24*size});
    const n=Math.max(2,Math.min(4,Math.round(3*size)));
    for(let i=0;i<n;i++)state.fx.push({k:'foam',x:x+U.rand(-12,12)*size,y:y+U.rand(-7,7)*size,t:0,dur:U.rand(.38,.7),r:U.rand(4,8)*size});
    if(state.fx.length>260)state.fx.splice(0,state.fx.length-260);
  }

  function createDebrisClusters(state,ship,components){
    if(!state.debrisClusters)state.debrisClusters=[];
    for(const comp of components||[]){
      if(!comp||!comp.length)continue;
      if(comp.length<2){
        const c=comp[0],w=G.cellCenterWorld(ship,c);
        state.fx.push({
          k:'debris',x:w.x,y:w.y,vx:U.rand(-130,150),vy:U.rand(-160,55),
          vr:U.rand(-5,5),rot:ship.rotation,t:0,dur:U.rand(.65,1.05),r:ship.cellSize*.78,
          cellType:c.type,side:ship.side
        });
        continue;
      }
      const points=comp.map(c=>({cell:c,p:G.cellCenterLocal(ship,c)}));
      let cx=0,cy=0;
      for(const item of points){cx+=item.p.x;cy+=item.p.y;}
      cx/=points.length;cy/=points.length;
      const world=G.localToWorld(ship,cx,cy);
      state.debrisClusters.push({
        x:world.x,y:world.y,vx:U.rand(-45,70),vy:U.rand(-55,-5),
        rotation:ship.rotation,angularVelocity:U.rand(-1.4,1.4),
        age:0,life:U.rand(2.2,3.0),sinkProgress:0,cellSize:ship.cellSize,
        side:ship.side,baseColor:ship.baseColor||'#714128',deckColor:ship.deckColor||'#b07155',
        cells:points.map(item=>({x:item.p.x-cx,y:item.p.y-cy,type:item.cell.type}))
      });
    }
    return state.debrisClusters;
  }

  function updateDebrisClusters(state,dt){
    if(!state.debrisClusters)return;
    for(const cluster of state.debrisClusters){
      cluster.age=(cluster.age||0)+dt;
      cluster.sinkProgress=Math.min(1,cluster.age/cluster.life);
      cluster.x+=cluster.vx*dt;
      cluster.vy+=24*dt;
      cluster.y+=cluster.vy*dt+34*cluster.sinkProgress*dt;
      cluster.rotation+=cluster.angularVelocity*dt;
    }
    state.debrisClusters=state.debrisClusters.filter(c=>c.age<c.life&&c.sinkProgress<1);
  }

  function recomputeShipSystems(ship){
    if(!ship||!ship.cells)return ship;
    const alive=t=>ship.cells.some(c=>c.alive&&c.type===t);
    ship.rudderAlive=alive('rudder');
    ship.mastAlive=alive('mast');
    ship.cannonsAlive=ship.cells.filter(c=>c.alive&&c.type==='cannon').length;
    if(ship.side==='enemy'){
      const base=(ENEMY[ship.kind]||ENEMY.sloop).speed;
      ship.baseSpeed=base;
      let mult=1;
      if(!ship.rudderAlive)mult*=.55;
      if(!ship.mastAlive)mult*=.75;
      ship.speed=Math.max(base*.3,base*mult);
    }
    ensureShipPhysics(ship);
    return ship;
  }

  function triggerPowderBlast(state,ship,cell,chain){
    chain=chain||{triggered:new Set()};
    if(!chain.triggered)chain.triggered=new Set();
    const id=(ship.id||ship.kind)+':'+cell.gx+','+cell.gy;
    if(chain.triggered.has(id))return {chain,destroyed:[]};
    chain.triggered.add(id);
    const center=G.cellCenterWorld(ship,cell);
    state.fx.push({k:'powderBlast',x:center.x,y:center.y,t:0,dur:.62,r:96});
    state.shake=Math.max(state.shake||0,12);
    state.hitStop=Math.max(state.hitStop||0,.07);
    addSplinters(state,center.x,center.y,24,1.8);

    const destroyed=[];
    for(const target of ship.cells){
      if(!target.alive)continue;
      const dx=target.gx-cell.gx,dy=target.gy-cell.gy,d=Math.hypot(dx,dy);
      if(d>2.01)continue;
      const damage=d<=1.05?38:20;
      const res=G.damageCell(ship,target,damage);
      if(res.destroyed){
        destroyed.push(target);
        const p=G.cellCenterWorld(ship,target);
        addSplinters(state,p.x,p.y,4,1.15);
        if(target.type==='powder'){
          const nested=triggerPowderBlast(state,ship,target,chain);
          if(nested&&nested.destroyed)destroyed.push(...nested.destroyed);
        }
      }
    }
    recomputeShipSystems(ship);
    return {chain,destroyed};
  }

  function emitDetachedFeedback(state,ship,pos,detached,lost){
    if(detached.length||lost>=8){
      state.fx.push({k:'structureBreak',x:pos.x,y:pos.y,t:0,dur:.52,r:44+Math.min(90,lost*6)});
      addSplinters(state,pos.x,pos.y,Math.min(30,12+detached.length*2),1.65);
      state.shake=Math.max(state.shake||0,9);
      state.hitStop=Math.max(state.hitStop||0,.07);
    }else if(lost>=3){
      state.fx.push({k:'impactBurst',x:pos.x,posY:pos.y,y:pos.y,t:0,dur:.34,r:30+lost*4});
      addSplinters(state,pos.x,pos.y,Math.min(20,8+lost*2),1.25);
      state.shake=Math.max(state.shake||0,4);
    }
  }

  function applyComponentDestroyed(state,ship,cell,pos,chain){
    if(!state||!ship||!cell)return chain||{triggered:new Set()};
    chain=chain||{triggered:new Set()};
    if(!chain.triggered)chain.triggered=new Set();
    let blastDestroyed=[];
    if(cell.type==='powder'){
      const blast=triggerPowderBlast(state,ship,cell,chain);
      blastDestroyed=blast.destroyed||[];
    }else if(cell.critical||cell.system){
      recomputeShipSystems(ship);
    }
    addSplinters(state,pos.x,pos.y,6,1);
    const components=G.detachDisconnectedComponents(ship);
    createDebrisClusters(state,ship,components);
    const detached=[];for(const comp of components)detached.push(...comp);
    recomputeShipSystems(ship);
    const lost=1+blastDestroyed.length+detached.length;
    emitDetachedFeedback(state,ship,pos,detached,lost);
    evaluateShip(state,ship);
    return chain;
  }

  function decorateState(state){
    state.onCellHit=function(ship,cell,pos,res,p){
      applyHitImpulse(ship,cell,pos,p);
      state.fx.push({k:'hit',x:pos.x,y:pos.y,t:0,dur:.18,side:p.side});
      state.texts.push({x:pos.x,y:pos.y-18,text:'-'+p.damage,t:.65});
      evaluateShip(state,ship);
    };
    state.onCellDestroyed=function(ship,cell,pos){
      applyComponentDestroyed(state,ship,cell,pos,{triggered:new Set()});
    };
    state.onShipCritical=function(ship){evaluateShip(state,ship);};
    state.onProjectileSplash=function(p,pos){addWaterSplashFx(state,pos.x,pos.y,.82);};
    return state;
  }

  function newGame(){
    const player=G.createTemplateShip('player','player',C.PLAYER_X,C.PLAYER_Y);
    player.id='player';player.criticalThreshold=.24;recomputeShipSystems(player);ensureShipPhysics(player);
    const state={
      state:'playing',time:0,player,enemies:[],projectiles:[],fx:[],texts:[],debrisClusters:[],
      focus:null,aim:null,salvo:null,gold:0,kills:0,wave:1,spawnT:.6,playerFireT:.15,shotIndex:0,nextEnemyId:1,
      shake:0,hitStop:0,paused:false
    };
    return decorateState(state);
  }

  function spawnEnemy(state,kind,opts){
    opts=opts||{};kind=kind||'sloop';
    const e=G.createTemplateShip(kind,'enemy',opts.x==null?2080:opts.x,opts.y==null?U.rand(250,850):opts.y);
    const spec=ENEMY[kind]||ENEMY.sloop;
    e.id='e'+state.nextEnemyId++;e.gold=spec.gold;e.criticalThreshold=.34;
    e.shotT=U.rand(spec.fireMin,spec.fireMax);recomputeShipSystems(e);ensureShipPhysics(e);
    if(Number.isFinite(opts.stopX))e.stopX=opts.stopX;
    state.enemies.push(e);return e;
  }

  function partnerKind(state,lead){
    if(lead==='manowar')return 'gunship';
    if(lead==='gunship')return state.time>30?'manowar':'sloop';
    return 'gunship';
  }

  function spawnEnemyPair(state,kind,opts){
    opts=opts||{};kind=kind||'sloop';
    const x=opts.x==null?2080:opts.x;
    const centerY=opts.centerY==null?550:opts.centerY;
    const gap=opts.gap==null?250:opts.gap;
    const xStagger=opts.xStagger==null?110:opts.xStagger;
    const kinds=opts.kinds||[kind,partnerKind(state,kind)];
    const a=spawnEnemy(state,kinds[0],{x:x+xStagger/2,y:centerY-gap/2,stopX:920+xStagger/2});
    const b=spawnEnemy(state,kinds[1],{x:x-xStagger/2,y:centerY+gap/2,stopX:920-xStagger/2});
    const formationSpeed=Math.min(a.speed,b.speed);
    a.formationSpeed=formationSpeed;b.formationSpeed=formationSpeed;
    b.shotT=a.shotT+.55;
    return [a,b];
  }

  function activeEnemies(state){return state.enemies.filter(e=>e.state==='active');}

  function nearestActiveTarget(state){
    let best=null,bestX=Infinity;
    for(const e of activeEnemies(state))if(e.x<bestX){best=e;bestX=e.x;}
    return best;
  }

  function targetForPlayer(state){
    if(state.focus&&state.focus.state==='active')return state.focus;
    return nearestActiveTarget(state);
  }

  function aimVelocity(x,y,tx,ty,speed){
    const dx=tx-x,dy=ty-y,d=Math.hypot(dx,dy)||1;
    return {vx:dx/d*speed,vy:dy/d*speed};
  }

  function setAim(state,ship,worldX,worldY){
    if(!state)return null;
    if(!ship||ship.state!=='active')return state.aim=null;
    const local=G.worldToLocal(ship,worldX,worldY),grid=G.localToGrid(ship,local.x,local.y);
    state.aim={shipId:ship.id,gx:grid.gx,gy:grid.gy,lx:local.x,ly:local.y,x:worldX,y:worldY};
    return state.aim;
  }

  function currentAimPoint(state,target){
    const aim=state.aim&&target&&state.aim.shipId===target.id?state.aim:null;
    if(!aim)return target?{x:target.x,y:target.y}:null;
    if(Number.isFinite(aim.lx)&&Number.isFinite(aim.ly))return G.localToWorld(target,aim.lx,aim.ly);
    return {x:aim.x,y:aim.y};
  }

  function firePlayer(state,target,volleyIndex){
    if(!target)return;
    const ys=[430,560,690],y=ys[state.shotIndex++%ys.length];
    const x=610,aim=currentAimPoint(state,target);
    const speed=900,distance=Math.hypot(aim.x-x,aim.y-y),v=aimVelocity(x,y,aim.x,aim.y,speed);
    const flightTime=distance/speed;
    const variation=Number.isInteger(volleyIndex)?SALVO_ARC_VARIATION[volleyIndex%SALVO_ARC_VARIATION.length]:0;
    const arcHeight=P.computeArcHeight('player',distance,variation);
    P.spawn(state,{x,y,vx:v.vx,vy:v.vy,damage:24,side:'player',life:3,penetration:78,arcHeight,flightTime});
    state.fx.push({k:'muzzle',x:x+8,y,t:0,dur:.16});
  }

  function startPlayerSalvo(state,target){
    if(!state||state.salvo||!target||target.state!=='active')return false;
    state.salvo={targetId:target.id,index:0,remaining:SALVO_COUNT,t:0};
    return true;
  }

  function updatePlayerSalvo(state,dt){
    const salvo=state.salvo;if(!salvo)return;
    salvo.t-=dt;
    if(salvo.t>0)return;
    let target=state.enemies.find(e=>e.id===salvo.targetId&&e.state==='active');
    if(!target)target=targetForPlayer(state);
    if(!target){state.salvo=null;return;}
    salvo.targetId=target.id;
    firePlayer(state,target,salvo.index);
    salvo.index++;salvo.remaining--;
    if(salvo.remaining<=0){state.salvo=null;return;}
    salvo.t+=SALVO_GAP;
  }

  function randomAliveCell(ship){
    const alive=ship.cells.filter(c=>c.alive);
    if(!alive.length)return null;
    return alive[Math.floor(Math.random()*alive.length)];
  }

  function fireEnemy(state,e){
    if(e&&e.cannonsAlive===0)return;
    const cell=randomAliveCell(state.player);if(!cell)return;
    const target=G.cellCenterWorld(state.player,cell);
    const x=e.x-e.gridWidth*e.cellSize*.45,y=e.y;
    const speed=620,distance=Math.hypot(target.x-x,target.y-y),v=aimVelocity(x,y,target.x,target.y,speed);
    const flightTime=distance/speed;
    const arcHeight=P.computeArcHeight('enemy',distance,0);
    P.spawn(state,{x,y,vx:v.vx,vy:v.vy,damage:18,side:'enemy',life:4,arcHeight,flightTime});
    state.fx.push({k:'muzzle',x,y,t:0,dur:.16});
  }

  function evaluateShip(state,ship){
    if(!ship)return 0;
    const ratio=G.integrity(ship);
    if(ship.side==='player'){
      if(ratio<=.24&&state.state!=='lose'){
        state.state='lose';ship.state='wrecked';state.focus=null;state.aim=null;state.salvo=null;
      }
      return ratio;
    }
    if(ratio<=.34&&ship.state==='active'){
      const wasFocused=state.focus===ship;
      ship.state='sink';ship.sinkT=0;state.gold+=ship.gold||0;state.kills++;
      if(state.aim&&state.aim.shipId===ship.id)state.aim=null;
      if(wasFocused)setFocus(state,nearestActiveTarget(state));
      if(state.salvo&&state.salvo.targetId===ship.id){
        const next=targetForPlayer(state);
        if(next)state.salvo.targetId=next.id;else state.salvo=null;
      }
      state.fx.push({k:'boom',x:ship.x,y:ship.y,t:0,dur:.75});
      state.shake=Math.max(state.shake||0,7);
    }
    return ratio;
  }

  function chooseSpawnKind(state){
    const r=Math.random();
    if(state.time>35&&r>.78)return 'manowar';
    if(state.time>12&&r>.48)return 'gunship';
    return 'sloop';
  }

  function updateCells(state,dt){
    const ships=[state.player,...state.enemies];
    for(const ship of ships)for(const c of ship.cells)if(c.flash>0)c.flash=Math.max(0,c.flash-dt);
  }

  function updateFx(state,dt){
    for(const f of state.fx){
      f.t+=dt;
      if(f.k==='splinter'||f.k==='debris'){
        f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=190*dt;
        if(f.k==='debris')f.rot=(f.rot||0)+(f.vr||0)*dt;
      }
    }
    state.fx=state.fx.filter(f=>f.t<f.dur);
    for(const t of state.texts){t.t-=dt;t.y-=18*dt;}
    state.texts=state.texts.filter(t=>t.t>0);
    state.shake=Math.max(0,(state.shake||0)-dt*20);
  }

  function update(state,dt){
    if(!state||state.paused||state.state!=='playing')return;
    dt=Math.min(.05,Math.max(0,dt));
    if(state.hitStop>0){
      state.hitStop=Math.max(0,state.hitStop-dt);
      updateCells(state,dt);updateFx(state,dt);
      return;
    }
    state.time+=dt;
    updateShipPhysics(state.player,dt);
    for(const ship of state.enemies)updateShipPhysics(ship,dt);

    state.spawnT-=dt;
    if(state.spawnT<=0&&activeEnemies(state).length===0){
      spawnEnemyPair(state,chooseSpawnKind(state));
      state.spawnT=C.ENEMY_SPAWN_INTERVAL*Math.max(.62,1-state.time/160);
    }

    for(const e of state.enemies){
      if(e.state==='sink'){
        e.sinkT+=dt;e.y+=24*dt;e.rotation+=.18*dt;continue;
      }
      if(e.state!=='active')continue;
      const stopX=Number.isFinite(e.stopX)?e.stopX:920;
      const moveSpeed=Number.isFinite(e.formationSpeed)?Math.min(e.speed,e.formationSpeed):e.speed;
      if(e.x>stopX)e.x=Math.max(stopX,e.x-moveSpeed*dt);
      else e.x=stopX;
      if(e.rudderAlive===false)e.rotation+=Math.sin(state.time*3+(e.ph||0))*.0025;
      e.shotT-=dt;
      if(e.x<1450&&e.shotT<=0){
        fireEnemy(state,e);
        const spec=ENEMY[e.kind]||ENEMY.sloop;e.shotT=U.rand(spec.fireMin,spec.fireMax);
      }
    }

    state.playerFireT-=dt;
    if(state.playerFireT<=0&&!state.salvo){
      const target=targetForPlayer(state);if(target)startPlayerSalvo(state,target);
      state.playerFireT=C.PLAYER_FIRE_INTERVAL;
    }
    updatePlayerSalvo(state,dt);

    P.updateAll(state,dt);
    updateCells(state,dt);updateFx(state,dt);updateDebrisClusters(state,dt);
    state.enemies=state.enemies.filter(e=>e.state!=='sink'||e.sinkT<1.6);
  }

  function setFocus(state,ship){
    if(state.focus)state.focus.focus=false;
    state.focus=ship&&ship.state==='active'?ship:null;
    if(state.focus)state.focus.focus=true;
  }

  root.V8Battle={
    ENEMY,newGame,spawnEnemy,spawnEnemyPair,activeEnemies,targetForPlayer,firePlayer,startPlayerSalvo,updatePlayerSalvo,fireEnemy,evaluateShip,update,setFocus,setAim,currentAimPoint,
    triggerPowderBlast,applyComponentDestroyed,recomputeShipSystems,createDebrisClusters,updateDebrisClusters,
    ensureShipPhysics,applyHitImpulse,updateShipPhysics,addWaterSplashFx
  };
})(typeof globalThis!=='undefined'?globalThis:this);
