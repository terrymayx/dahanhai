(function(root){
  'use strict';
  const C=root.V8Config,B=root.V8Battle;
  if(!C||!B)throw new Error('V8 config and battle must load before combat tuning');

  const PLAYER_FIRE_INTERVAL=1.35;
  const PLAYER_SALVO_COUNT=2;
  const PLAYER_SALVO_GAP=.28;

  C.PLAYER_FIRE_INTERVAL=PLAYER_FIRE_INTERVAL;

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

  const originalNewGame=B.newGame;
  B.newGame=function(){
    const state=originalNewGame();
    state.playerFireT=.8;
    state.shake=0;
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

    // Camera shake is intentionally disabled. Ship recoil/roll and hit-stop remain.
    state.shake=0;
  };

  B.CALM_FIRE={PLAYER_FIRE_INTERVAL,PLAYER_SALVO_COUNT,PLAYER_SALVO_GAP,enemyTuning};
})(typeof globalThis!=='undefined'?globalThis:this);
