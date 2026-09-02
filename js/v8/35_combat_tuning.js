(function(root){
  'use strict';
  const C=root.V8Config,B=root.V8Battle,G=root.V8ShipGrid;
  if(!C||!B||!G)throw new Error('V8 config, grid and battle must load before combat tuning');

  const PLAYER_FIRE_INTERVAL=1.35;
  const PLAYER_SALVO_COUNT=2;
  const PLAYER_SALVO_GAP=.28;
  const CELL_DURABILITY={
    hull:60,
    deck:48,
    beam:96,
    core:96,
    powder:36,
    rudder:52,
    mast:56,
    cannon:56
  };

  C.PLAYER_FIRE_INTERVAL=PLAYER_FIRE_INTERVAL;
  Object.assign(G.CELL_HP,CELL_DURABILITY);

  const enemyTuning={
    sloop:{fireMin:3.6,fireMax:4.6},
    gunship:{fireMin:3.2,fireMax:4.2},
    manowar:{fireMin:3.6,fireMax:4.8}
  };
  for(const kind of Object.keys(enemyTuning)){
    if(!B.ENEMY[kind])continue;
    B.ENEMY[kind].fireMin=enemyTuning[kind].fireMin;
    B.ENEMY[kind].fireMax=enemyTuning[kind].fireMax;
  }

  function clearAttackMotion(ship){
    if(!ship||!ship.physics)return;
    const ph=ship.physics;
    ph.impulseX=0;
    ph.impulseY=0;
    ph.angularVelocity=0;
    ph.offsetX=0;
    ph.offsetY=0;
    ph.roll=0;
  }

  function clearAllShipAttackMotion(state){
    if(!state)return;
    clearAttackMotion(state.player);
    for(const ship of state.enemies||[])clearAttackMotion(ship);
  }

  const originalNewGame=B.newGame;
  B.newGame=function(){
    const state=originalNewGame();
    state.playerFireT=.8;
    state.shake=0;
    clearAllShipAttackMotion(state);
    return state;
  };

  const originalStartPlayerSalvo=B.startPlayerSalvo;
  B.startPlayerSalvo=function(state,target){
    const started=originalStartPlayerSalvo(state,target);
    if(started&&state&&state.salvo){
      state.salvo.remaining=Math.min(state.salvo.remaining,PLAYER_SALVO_COUNT);
      state.salvo.calmGapArmed=false;
    }
    return started;
  };

  const originalEmitCombatEvent=B.emitCombatEvent;
  B.emitCombatEvent=function(state,type,payload){
    const level=originalEmitCombatEvent(state,type,payload);
    if(state)state.shake=0;
    return level;
  };

  const originalUpdate=B.update;
  B.update=function(state,dt){
    clearAllShipAttackMotion(state);
    if(state&&state.salvo&&state.salvo.remaining>PLAYER_SALVO_COUNT){
      state.salvo.remaining=PLAYER_SALVO_COUNT;
    }
    originalUpdate(state,dt);
    if(!state)return;

    if(state.salvo){
      const fired=state.salvo.index||0;
      const desiredRemaining=Math.max(0,PLAYER_SALVO_COUNT-fired);
      if(state.salvo.remaining>desiredRemaining)state.salvo.remaining=desiredRemaining;
      if(fired===1&&!state.salvo.calmGapArmed){
        state.salvo.t=Math.max(state.salvo.t,PLAYER_SALVO_GAP);
        state.salvo.calmGapArmed=true;
      }
    }

    // Camera shake and ship hit recoil are intentionally disabled.
    // Natural renderer bobbing, debris motion and hit-stop remain.
    state.shake=0;
    clearAllShipAttackMotion(state);
  };

  B.CALM_FIRE={PLAYER_FIRE_INTERVAL,PLAYER_SALVO_COUNT,PLAYER_SALVO_GAP,enemyTuning,CELL_DURABILITY};
  B.clearAttackMotion=clearAttackMotion;
})(typeof globalThis!=='undefined'?globalThis:this);
