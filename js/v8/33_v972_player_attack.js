(function(root){
  'use strict';

  const B=root.V8Battle,P=root.V8Projectile;
  if(!B||!P||typeof B.newGame!=='function'||typeof P.spawn!=='function')throw new Error('V9.7.2 player attack requires battle and projectile modules');

  const BASE_ATTACK=24;
  const MIN_ATTACK=1;
  const MAX_ATTACK=999;
  const originalNewGame=B.newGame;
  const originalSpawn=P.spawn;

  function clampAttack(v){
    v=Math.round(Number(v));
    if(!Number.isFinite(v))v=BASE_ATTACK;
    return Math.max(MIN_ATTACK,Math.min(MAX_ATTACK,v));
  }

  function prepareState(state){
    if(!state)return state;
    if(!Number.isFinite(state.playerShellAttack))state.playerShellAttack=BASE_ATTACK;
    state.playerShellAttack=clampAttack(state.playerShellAttack);
    return state;
  }

  function getAttack(state){
    prepareState(state);
    return state?state.playerShellAttack:BASE_ATTACK;
  }

  function setAttack(state,value){
    if(!state)return BASE_ATTACK;
    state.playerShellAttack=clampAttack(value);
    return state.playerShellAttack;
  }

  function addAttack(state,amount){
    return setAttack(state,getAttack(state)+(Number(amount)||0));
  }

  B.newGame=function(){
    return prepareState(originalNewGame());
  };

  // All player shells read the live attack stat when they are spawned. Existing
  // firing code can keep its old default damage value; this layer becomes the
  // single source of truth and makes later upgrades/equipment easy to add.
  P.spawn=function(state,opts){
    opts=opts||{};
    if(opts.side==='player'){
      const attack=getAttack(state);
      opts=Object.assign({},opts,{damage:attack,attackPower:attack});
    }
    return originalSpawn(state,opts);
  };

  root.V972PlayerAttack={
    BASE_ATTACK,MIN_ATTACK,MAX_ATTACK,prepareState,getAttack,setAttack,addAttack
  };
})(typeof globalThis!=='undefined'?globalThis:this);
