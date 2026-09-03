(function(root){
  'use strict';

  const B=root.V8Battle,V104=root.V104Boarding||(root.DHH&&root.DHH.V104Boarding);
  if(!B||!V104)return;
  root.DHH=root.DHH||{};
  if(B.__v104BridgeInstalled)return;

  const oldUpdate=B.update;
  const FIRE_HOLD=999;

  function isBoardingActor(e){
    return !!(e&&(
      e.__v104SuppressBroadside||
      e.__v104BoardingMode==='boardingApproach'||
      e.__v104BoardingMode==='boardingLocked'
    ));
  }

  function suppressBoardingBroadside(state){
    for(const e of state&&state.enemies||[]){
      if(!isBoardingActor(e))continue;
      e.__v104SuppressBroadside=true;
      e.__v103Salvo=null;
      e.__v103FireT=Math.max(Number(e.__v103FireT)||0,FIRE_HOLD);
      e.shotT=Math.max(Number(e.shotT)||0,FIRE_HOLD);
    }
  }

  function snapshotLocked(state){
    const out=[];
    if(!(state&&state.boarding&&state.boarding.active))return out;
    const id=state.boarding.enemyShipId;
    for(const e of state.enemies||[]){
      if(e&&e.id===id)out.push({e,x:e.x,y:e.y,rotation:e.rotation,speed:e.speed});
    }
    return out;
  }

  function restoreLocked(state,snaps){
    if(!(state&&state.boarding&&state.boarding.active))return;
    for(const s of snaps||[]){
      const e=s.e;if(!e||e.state!=='active')continue;
      const p=state.player,dx=(s.x-p.x),dy=(s.y-p.y),d=Math.hypot(dx,dy)||1;
      const hold=Math.max(0,Math.min(4,d-18));
      e.x=s.x+(dx/d)*hold*.02;
      e.y=s.y+(dy/d)*hold*.02;
      e.rotation=s.rotation;
      e.speed=Math.min(Number(e.speed)||0,8);
      e.__v104SuppressBroadside=true;
      e.__v103Salvo=null;
    }
  }

  B.update=function(state,dt){
    if(!state)return typeof oldUpdate==='function'?oldUpdate(state,dt):undefined;
    dt=Math.min(.05,Math.max(0,Number(dt)||0));

    V104.ensureState(state);
    suppressBoardingBroadside(state);
    const locked=snapshotLocked(state);

    if(typeof oldUpdate==='function')oldUpdate(state,dt);

    // V10.3 still owns normal naval combat. V10.4 takes over only the chosen
    // boardingApproach/boardingLocked ship after the legacy/naval update.
    V104.preUpdate(state,dt);
    suppressBoardingBroadside(state);
    restoreLocked(state,locked);

    if(state.paused||state.state!=='playing')return;
    V104.update(state,dt);
    suppressBoardingBroadside(state);
  };

  B.__v104BoardingLegacyUpdate=oldUpdate;
  B.__v104BridgeInstalled=true;
  root.DHH.V104BoardingBridge={
    installed:true,
    suppressBoardingBroadside,
    isBoardingActor
  };
})(typeof globalThis!=='undefined'?globalThis:this);
