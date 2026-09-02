(function(root){
  'use strict';
  const C=root.V8Config,U=root.V8Util,G=root.V8ShipGrid,P=root.V8Projectile;
  if(!C||!U||!G||!P)throw new Error('V8 base, grid and projectile modules must load before battle');

  const ENEMY={
    sloop:{speed:94,fireMin:2.4,fireMax:3.3,gold:55},
    gunship:{speed:60,fireMin:1.8,fireMax:2.7,gold:105},
    manowar:{speed:40,fireMin:2.2,fireMax:3.0,gold:190},
  };

  function addSplinters(state,x,y,count,power){
    power=power||1;
    for(let i=0;i<count;i++)state.fx.push({
      k:'splinter',x,y,
      vx:U.rand(-120,120)*power,vy:U.rand(-130,70)*power,
      t:0,dur:U.rand(.35,.72),r:U.rand(3,7)*Math.min(1.35,power)
    });
  }

  function decorateState(state){
    state.onCellHit=function(ship,cell,pos,res,p){
      state.fx.push({k:'hit',x:pos.x,y:pos.y,t:0,dur:.18,side:p.side});
      state.texts.push({x:pos.x,y:pos.y-18,text:'-'+p.damage,t:.65});
      evaluateShip(state,ship);
    };
    state.onCellDestroyed=function(ship,cell,pos){
      addSplinters(state,pos.x,pos.y,6,1);
      const detached=G.detachDisconnected(ship);
      const lost=1+detached.length;
      if(detached.length){
        for(const c of detached){
          const w=G.cellCenterWorld(ship,c);
          state.fx.push({
            k:'debris',x:w.x,y:w.y,vx:U.rand(-130,150),vy:U.rand(-160,55),
            vr:U.rand(-5,5),rot:ship.rotation,t:0,dur:U.rand(.65,1.05),r:ship.cellSize*.78,
            cellType:c.type,side:ship.side
          });
        }
      }
      if(detached.length||lost>=8){
        state.fx.push({k:'structureBreak',x:pos.x,y:pos.y,t:0,dur:.52,r:44+Math.min(90,lost*6)});
        addSplinters(state,pos.x,pos.y,Math.min(30,12+detached.length*2),1.65);
        state.shake=Math.max(state.shake,9);
        state.hitStop=Math.max(state.hitStop,.07);
      }else if(lost>=3){
        state.fx.push({k:'impactBurst',x:pos.x,y:pos.y,t:0,dur:.34,r:30+lost*4});
        addSplinters(state,pos.x,pos.y,Math.min(20,8+lost*2),1.25);
        state.shake=Math.max(state.shake,4);
      }
      evaluateShip(state,ship);
    };
    state.onShipCritical=function(ship){evaluateShip(state,ship);};
    return state;
  }

  function newGame(){
    const player=G.createTemplateShip('player','player',C.PLAYER_X,C.PLAYER_Y);
    player.id='player';player.criticalThreshold=.24;
    const state={
      state:'playing',time:0,player,enemies:[],projectiles:[],fx:[],texts:[],
      focus:null,aim:null,gold:0,kills:0,wave:1,spawnT:.6,playerFireT:.15,shotIndex:0,nextEnemyId:1,
      shake:0,hitStop:0,paused:false
    };
    return decorateState(state);
  }

  function spawnEnemy(state,kind,opts){
    opts=opts||{};kind=kind||'sloop';
    const e=G.createTemplateShip(kind,'enemy',opts.x==null?2080:opts.x,opts.y==null?U.rand(250,850):opts.y);
    const spec=ENEMY[kind]||ENEMY.sloop;
    e.id='e'+state.nextEnemyId++;e.speed=spec.speed;e.gold=spec.gold;e.criticalThreshold=.34;
    e.shotT=U.rand(spec.fireMin,spec.fireMax);
    state.enemies.push(e);return e;
  }

  function activeEnemies(state){return state.enemies.filter(e=>e.state==='active');}

  function targetForPlayer(state){
    if(state.focus&&state.focus.state==='active')return state.focus;
    let best=null,bestX=Infinity;
    for(const e of activeEnemies(state))if(e.x<bestX){best=e;bestX=e.x;}
    return best;
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

  function firePlayer(state,target){
    if(!target)return;
    const ys=[430,560,690],y=ys[state.shotIndex++%ys.length];
    const x=610,aim=currentAimPoint(state,target);
    const v=aimVelocity(x,y,aim.x,aim.y,900);
    P.spawn(state,{x,y,vx:v.vx,vy:v.vy,damage:24,side:'player',life:3,penetration:78});
    state.fx.push({k:'muzzle',x:x+8,y,t:0,dur:.16});
  }

  function randomAliveCell(ship){
    const alive=ship.cells.filter(c=>c.alive);
    if(!alive.length)return null;
    return alive[Math.floor(Math.random()*alive.length)];
  }

  function fireEnemy(state,e){
    const cell=randomAliveCell(state.player);if(!cell)return;
    const target=G.cellCenterWorld(state.player,cell);
    const x=e.x-e.gridWidth*e.cellSize*.45,y=e.y;
    const v=aimVelocity(x,y,target.x,target.y,620);
    P.spawn(state,{x,y,vx:v.vx,vy:v.vy,damage:18,side:'enemy',life:4});
    state.fx.push({k:'muzzle',x,y,t:0,dur:.16});
  }

  function evaluateShip(state,ship){
    if(!ship)return 0;
    const ratio=G.integrity(ship);
    if(ship.side==='player'){
      if(ratio<=.24&&state.state!=='lose'){
        state.state='lose';ship.state='wrecked';state.focus=null;state.aim=null;
      }
      return ratio;
    }
    if(ratio<=.34&&ship.state==='active'){
      ship.state='sink';ship.sinkT=0;state.gold+=ship.gold||0;state.kills++;
      if(state.focus===ship)state.focus=null;
      if(state.aim&&state.aim.shipId===ship.id)state.aim=null;
      state.fx.push({k:'boom',x:ship.x,y:ship.y,t:0,dur:.75});
      state.shake=Math.max(state.shake,7);
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

    state.spawnT-=dt;
    if(state.spawnT<=0&&activeEnemies(state).length<1){
      spawnEnemy(state,chooseSpawnKind(state));
      state.spawnT=C.ENEMY_SPAWN_INTERVAL*Math.max(.62,1-state.time/160);
    }

    for(const e of state.enemies){
      if(e.state==='sink'){
        e.sinkT+=dt;e.y+=24*dt;e.rotation+=.18*dt;continue;
      }
      if(e.state!=='active')continue;
      if(e.x>920)e.x-=e.speed*dt;
      else e.x=920;
      e.shotT-=dt;
      if(e.x<1450&&e.shotT<=0){
        fireEnemy(state,e);
        const spec=ENEMY[e.kind]||ENEMY.sloop;e.shotT=U.rand(spec.fireMin,spec.fireMax);
      }
    }

    state.playerFireT-=dt;
    if(state.playerFireT<=0){
      const target=targetForPlayer(state);if(target)firePlayer(state,target);
      state.playerFireT=C.PLAYER_FIRE_INTERVAL;
    }

    P.updateAll(state,dt);
    updateCells(state,dt);updateFx(state,dt);
    state.enemies=state.enemies.filter(e=>e.state!=='sink'||e.sinkT<1.6);
  }

  function setFocus(state,ship){
    if(state.focus)state.focus.focus=false;
    state.focus=ship&&ship.state==='active'?ship:null;
    if(state.focus)state.focus.focus=true;
  }

  root.V8Battle={ENEMY,newGame,spawnEnemy,activeEnemies,targetForPlayer,firePlayer,fireEnemy,evaluateShip,update,setFocus,setAim,currentAimPoint};
})(typeof globalThis!=='undefined'?globalThis:this);
