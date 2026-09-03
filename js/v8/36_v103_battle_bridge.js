(function(root){
  'use strict';
  const B=root.V8Battle,V=root.V103Broadside,C=root.V8Config;
  if(!B||!V)return;
  if(B.__v103BridgeInstalled)return;

  const oldUpdate=B.update;
  const oldStartPlayerSalvo=B.startPlayerSalvo;
  const oldUpdatePlayerSalvo=B.updatePlayerSalvo;
  const oldFireEnemy=B.fireEnemy;

  function activeTarget(state){
    if(!state)return null;
    if(typeof B.targetForPlayer==='function')return B.targetForPlayer(state);
    return (state.enemies||[]).find(e=>e&&e.state==='active')||null;
  }

  function suppressLegacyTimers(state){
    if(!state)return;
    state.playerFireT=999;
    for(const e of state.enemies||[])if(e&&e.state==='active')e.shotT=999;
  }

  function restoreV103Salvo(state,salvo){
    if(!state)return;
    if(salvo)state.salvo=salvo;
  }

  function updatePlayerFire(state,dt){
    if(!state||!state.player||state.player.state!=='active')return;
    if(!Number.isFinite(state.__v103PlayerFireT))state.__v103PlayerFireT=.15;
    state.__v103PlayerFireT-=dt;
    if(state.salvo||state.__v103PlayerFireT>0)return;
    const target=activeTarget(state);
    if(!target){state.__v103PlayerFireT=.15;return;}
    const fired=V.startPlayerBroadside(state,target);
    state.__v103PlayerFireT=fired?Math.max(.3,Number(C&&C.PLAYER_FIRE_INTERVAL)||1.1):.12;
  }

  function updateEnemyFire(state,e,dt){
    if(!e||e.state!=='active')return;
    if(!Number.isFinite(e.__v103FireT))e.__v103FireT=.35+Math.random()*.45;
    e.__v103FireT-=dt;
    if(e.__v103FireT>0||e.__v103Salvo||e.x>=1450)return;
    const fired=V.fireEnemyBroadside(state,e);
    e.__v103FireT=fired?.24:.18;
  }

  B.update=function(state,dt){
    if(!state)return oldUpdate&&oldUpdate(state,dt);
    const v103Salvo=state.salvo&&state.salvo.v103?state.salvo:null;
    if(v103Salvo)state.salvo=null;
    suppressLegacyTimers(state);
    if(typeof oldUpdate==='function')oldUpdate(state,dt);
    suppressLegacyTimers(state);
    restoreV103Salvo(state,v103Salvo);
    if(state.paused||state.state!=='playing')return;
    dt=Math.min(.05,Math.max(0,Number(dt)||0));
    V.updateBattle(state,dt);
    if(state.salvo&&state.salvo.v103)V.updatePlayerSalvo(state,dt);
    updatePlayerFire(state,dt);
    for(const e of state.enemies||[])updateEnemyFire(state,e,dt);
  };

  B.startPlayerSalvo=function(state,target){return V.startPlayerBroadside(state,target);};
  B.updatePlayerSalvo=function(state,dt){return V.updatePlayerSalvo(state,dt);};
  B.fireEnemy=function(state,e){return V.fireEnemyBroadside(state,e);};
  B.__v103Legacy={update:oldUpdate,startPlayerSalvo:oldStartPlayerSalvo,updatePlayerSalvo:oldUpdatePlayerSalvo,fireEnemy:oldFireEnemy};
  B.__v103BridgeInstalled=true;
})(typeof globalThis!=='undefined'?globalThis:this);
