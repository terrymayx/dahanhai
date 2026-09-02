(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  const B=root.V8Battle||null;
  if(!G)throw new Error('V8ShipGrid must load before V8.6 component stress');

  const SYSTEM_TYPES={
    cannon:['cannon'],
    mast:['mast'],
    rudder:['rudder'],
    beam:['beam','core'],
    powder:['powder']
  };

  function clamp01(v){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0));}

  function componentRatio(cell){
    if(!cell||cell.alive===false||!(cell.hp>0))return 0;
    return clamp01(cell.hp/Math.max(1,cell.maxHp||cell.hp||1));
  }

  function componentStage(cell){
    const ratio=componentRatio(cell);
    if(ratio<=0)return 'destroyed';
    if(ratio>.66)return 'healthy';
    if(ratio>.33)return 'damaged';
    return 'critical';
  }

  function ratioFor(ship,types){
    let hp=0,max=0;
    const set=new Set(types);
    for(const cell of (ship&&ship.cells)||[]){
      if(!set.has(cell.type))continue;
      const cellMax=Math.max(1,cell.maxHp||cell.hp||1);
      max+=cellMax;
      if(cell.alive!==false&&cell.hp>0)hp+=Math.min(cellMax,cell.hp);
    }
    return max>0?clamp01(hp/max):1;
  }

  function shipSystemRatios(ship){
    return {
      cannon:ratioFor(ship,SYSTEM_TYPES.cannon),
      mast:ratioFor(ship,SYSTEM_TYPES.mast),
      rudder:ratioFor(ship,SYSTEM_TYPES.rudder),
      beam:ratioFor(ship,SYSTEM_TYPES.beam),
      powder:ratioFor(ship,SYSTEM_TYPES.powder)
    };
  }

  function structureStressStage(stress){
    stress=clamp01(stress);
    if(stress<.34)return 'stable';
    if(stress<=.66)return 'strained';
    return 'critical';
  }

  function powderDangerFor(ship){
    let danger=0;
    for(const cell of (ship&&ship.cells)||[]){
      if(cell.type!=='powder'||cell.alive===false)continue;
      const stage=componentStage(cell);
      if(stage==='critical')danger=Math.max(danger,1);
      else if(stage==='damaged')danger=Math.max(danger,.5);
    }
    return danger;
  }

  function cellStress(ship,cell){
    if(!ship||!cell||cell.alive===false)return 0;
    let stress=0;
    for(const beam of ship.cells||[]){
      if((beam.type!=='beam'&&beam.type!=='core')||beam.alive===false)continue;
      const ratio=componentRatio(beam);
      if(ratio>=.66)continue;
      const dist=Math.abs((beam.gx||0)-(cell.gx||0))+Math.abs((beam.gy||0)-(cell.gy||0));
      const distanceFactor=Math.max(0,1-dist/5);
      stress=Math.max(stress,(1-ratio)*distanceFactor);
    }
    return clamp01(stress);
  }

  function refreshShip(ship){
    if(!ship)return ship;
    const ratios=shipSystemRatios(ship);
    ship.systemRatios=ratios;
    ship.beamIntegrity=ratios.beam;
    ship.structureStress=clamp01(1-ratios.beam);
    ship.structureStressStage=structureStressStage(ship.structureStress);
    ship.cannonEfficiency=ratios.cannon<=0?0:.45+.55*ratios.cannon;
    ship.mastEfficiency=.75+.25*ratios.mast;
    ship.rudderEfficiency=.55+.45*ratios.rudder;
    ship.rudderCritical=ratios.rudder<.33;
    ship.powderDanger=powderDangerFor(ship);
    for(const cell of ship.cells||[])cell.stress=cellStress(ship,cell);
    return ship;
  }

  function applyProgressiveSystems(ship){
    if(!ship)return ship;
    refreshShip(ship);
    ship.rudderAlive=ship.systemRatios.rudder>0;
    ship.mastAlive=ship.systemRatios.mast>0;
    ship.cannonsAlive=(ship.cells||[]).filter(c=>c.alive&&c.type==='cannon').length;
    if(B&&ship.side==='enemy'){
      const spec=(B.ENEMY&&B.ENEMY[ship.kind])||(B.ENEMY&&B.ENEMY.sloop);
      if(spec){
        ship.baseSpeed=spec.speed;
        ship.speed=spec.speed*ship.mastEfficiency*ship.rudderEfficiency;
      }
    }
    return ship;
  }

  function refreshStateShips(state){
    if(!state)return;
    applyProgressiveSystems(state.player);
    for(const ship of state.enemies||[])applyProgressiveSystems(ship);
  }

  function clearAttackMotion(ship){
    if(B&&typeof B.clearAttackMotion==='function')B.clearAttackMotion(ship);
  }

  function installBattleHooks(){
    if(!B||B.__v86ComponentStressInstalled)return;
    B.__v86ComponentStressInstalled=true;

    const originalRecompute=B.recomputeShipSystems;
    B.recomputeShipSystems=function(ship){
      if(typeof originalRecompute==='function')originalRecompute(ship);
      return applyProgressiveSystems(ship);
    };

    const originalSpawnEnemy=B.spawnEnemy;
    B.spawnEnemy=function(state,kind,opts){
      const ship=originalSpawnEnemy(state,kind,opts);
      return applyProgressiveSystems(ship);
    };

    const originalNewGame=B.newGame;
    B.newGame=function(){
      const state=originalNewGame();
      refreshStateShips(state);
      const originalHit=state.onCellHit;
      state.onCellHit=function(ship,cell,pos,res,p){
        if(typeof originalHit==='function')originalHit(ship,cell,pos,res,p);
        applyProgressiveSystems(ship);clearAttackMotion(ship);state.shake=0;
      };
      const originalDestroyed=state.onCellDestroyed;
      state.onCellDestroyed=function(ship,cell,pos,p){
        if(typeof originalDestroyed==='function')originalDestroyed(ship,cell,pos,p);
        applyProgressiveSystems(ship);clearAttackMotion(ship);state.shake=0;
      };
      return state;
    };

    const originalUpdate=B.update;
    B.update=function(state,dt){
      const active=state&&state.state==='playing'&&!state.paused&&!(state.hitStop>0);
      const step=Math.min(.05,Math.max(0,dt||0));
      if(active){
        refreshStateShips(state);
        for(const ship of state.enemies||[]){
          if(ship.state!=='active'||!Number.isFinite(ship.shotT))continue;
          ship.shotT+=step*(1-ship.cannonEfficiency);
        }
      }
      originalUpdate(state,dt);
      if(state){
        refreshStateShips(state);
        state.shake=0;
        clearAttackMotion(state.player);
        for(const ship of state.enemies||[])clearAttackMotion(ship);
      }
    };
  }

  const api={
    SYSTEM_TYPES,componentRatio,componentStage,shipSystemRatios,structureStressStage,
    powderDangerFor,cellStress,refreshShip,applyProgressiveSystems,refreshStateShips
  };
  root.V8ComponentStress=api;
  installBattleHooks();
})(typeof globalThis!=='undefined'?globalThis:this);
