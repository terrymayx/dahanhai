(function(root){
  'use strict';

  const B=root.V8Battle,P=root.V8Projectile,G=root.V8ShipGrid;
  if(!B||!P||!G||typeof B.newGame!=='function'||typeof P.spawn!=='function')throw new Error('V9.7.5 adaptive player attack requires battle, projectile and grid modules');

  const BASE_ATTACK=72;
  const MIN_ATTACK=54;
  const MAX_ATTACK=150;
  const SHIP_SCALE={sloop:.90,gunship:1.06,manowar:1.30};
  const originalNewGame=B.newGame;
  const originalSpawn=P.spawn;

  function clampAttack(v){
    v=Math.round(Number(v));
    if(!Number.isFinite(v))v=BASE_ATTACK;
    return Math.max(MIN_ATTACK,Math.min(MAX_ATTACK,v));
  }

  function prepareState(state){
    if(!state)return state;
    if(typeof state.playerAttackAuto!=='boolean')state.playerAttackAuto=true;
    if(!Number.isFinite(state.playerShellAttack))state.playerShellAttack=BASE_ATTACK;
    state.playerShellAttack=clampAttack(state.playerShellAttack);
    return state;
  }

  function resolveTarget(state){
    if(!state)return null;
    if(state.focus&&state.focus.state==='active')return state.focus;
    if(typeof B.targetForPlayer==='function'){
      try{return B.targetForPlayer(state)||null;}catch(e){}
    }
    let best=null,bx=Infinity;
    for(const e of state.enemies||[]){if(e&&e.state==='active'&&e.x<bx){best=e;bx=e.x;}}
    return best;
  }

  function computeAutoAttack(state,target){
    prepareState(state);
    target=target||resolveTarget(state);
    if(!target)return BASE_ATTACK;

    const kindScale=SHIP_SCALE[target.kind]||1;
    const integrity=Math.max(0,Math.min(1,G.integrity(target)));
    const flood=Math.max(0,Math.min(1,target.floodLevel||0));

    // Healthy targets receive slightly heavier fire. As a ship is already badly
    // damaged or flooded, firepower eases back to avoid wasteful overkill.
    const integrityScale=.88+integrity*.22;
    const floodScale=1-Math.min(.14,flood*.14);

    // Long fights gradually raise player firepower without abrupt jumps.
    const progress=Math.min(.28,(state.kills||0)*.012+Math.min(.16,(state.time||0)/300*.16));
    const progressScale=1+progress;

    return clampAttack(BASE_ATTACK*kindScale*integrityScale*floodScale*progressScale);
  }

  function getAttack(state,target){
    prepareState(state);
    if(state&&state.playerAttackAuto){
      const attack=computeAutoAttack(state,target);
      state.playerShellAttack=attack;
      state.__v975AutoTarget=target||resolveTarget(state);
      return attack;
    }
    return state?clampAttack(state.playerShellAttack):BASE_ATTACK;
  }

  function setAttack(state,value){
    if(!state)return BASE_ATTACK;
    prepareState(state);
    state.playerAttackAuto=false;
    state.playerShellAttack=clampAttack(value);
    return state.playerShellAttack;
  }

  function addAttack(state,amount){
    return setAttack(state,getAttack(state)+(Number(amount)||0));
  }

  function setAuto(state,enabled){
    if(!state)return false;
    prepareState(state);
    state.playerAttackAuto=enabled!==false;
    if(state.playerAttackAuto)state.playerShellAttack=computeAutoAttack(state);
    return state.playerAttackAuto;
  }

  function isAuto(state){prepareState(state);return !!(state&&state.playerAttackAuto);}

  B.newGame=function(){
    const state=prepareState(originalNewGame());
    state.playerAttackAuto=true;
    state.playerShellAttack=computeAutoAttack(state);
    return state;
  };

  // Each player shell recalculates attack against the current target at launch,
  // so damage and the V9.7.4 blast radius automatically adapt together.
  P.spawn=function(state,opts){
    opts=opts||{};
    if(opts.side==='player'){
      const target=resolveTarget(state);
      const attack=getAttack(state,target);
      opts=Object.assign({},opts,{damage:attack,attackPower:attack,autoAttack:!!(state&&state.playerAttackAuto)});
    }
    return originalSpawn(state,opts);
  };

  root.V972PlayerAttack={
    BASE_ATTACK,MIN_ATTACK,MAX_ATTACK,SHIP_SCALE,
    prepareState,resolveTarget,computeAutoAttack,getAttack,setAttack,addAttack,setAuto,isAuto
  };
})(typeof globalThis!=='undefined'?globalThis:this);
