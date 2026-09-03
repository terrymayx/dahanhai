(function(root){
  'use strict';

  const Posts=root.V105CrewPosts||(root.DHH&&root.DHH.V105CrewPosts);
  if(!Posts)throw new Error('V10.5 staffing bridge requires crew posts');
  root.DHH=root.DHH||{};
  const V=root.V103Broadside||null;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function turnScale(ship){
    if(!ship)return 1;
    try{Posts.refreshStaffing(ship);}catch(e){}
    return clamp(typeof Posts.steeringScale==='function'?Posts.steeringScale(ship):1,.35,1);
  }
  function reloadScaleForGroup(ship,groupId){
    if(!ship)return 1;
    try{Posts.refreshStaffing(ship);}catch(e){}
    const group=Posts.gunGroups(ship).find(g=>g.id===groupId);return group?clamp(Number(group.multiplier)||0,0,1):1;
  }
  function reloadScaleForGun(ship,gunId){
    if(!ship)return 1;
    try{Posts.refreshStaffing(ship);}catch(e){}
    const group=Posts.groupForGun(ship,gunId);return group?clamp(Number(group.multiplier)||0,0,1):1;
  }
  function firefightingScale(ship){return Posts.firefightingScale(ship);}
  function pruneSalvo(ship,salvo){
    if(!ship||!salvo||!Array.isArray(salvo.gunIds))return salvo;
    salvo.gunIds=salvo.gunIds.filter(id=>reloadScaleForGun(ship,id)>0);
    if(Number(salvo.index)>salvo.gunIds.length)salvo.index=salvo.gunIds.length;
    return salvo;
  }
  function angleDelta(a,b){
    let d=(b||0)-(a||0);while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;
  }
  function installBroadside(){
    if(!V||V.__v105StaffingInstalled)return false;
    V.__v105StaffingInstalled=true;
    const oldUpdateBattle=V.updateBattle,oldStart=V.startPlayerBroadside,oldEnemy=V.fireEnemyBroadside,oldPlayerSalvo=V.updatePlayerSalvo,oldEnemySalvo=V.updateEnemySalvo;

    V.updateBattle=function(state,dt){
      if(!state)return oldUpdateBattle&&oldUpdateBattle(state,dt);
      const ships=[state.player,...(state.enemies||[])].filter(Boolean),before=new Map();
      for(const ship of ships){
        try{Posts.assignPosts(ship);Posts.refreshStaffing(ship);}catch(e){}
        const guns=[];for(const side of ['port','starboard'])for(const gun of ship.__v103Battery&&ship.__v103Battery[side]&&ship.__v103Battery[side].guns||[])guns.push({gun,reload:Number(gun.reload)||0});
        before.set(ship,{rotation:Number(ship.rotation)||0,guns});
        if(ship.__v103Salvo)pruneSalvo(ship,ship.__v103Salvo);
      }
      if(state.salvo&&state.salvo.v103&&state.player)pruneSalvo(state.player,state.salvo);
      const out=oldUpdateBattle&&oldUpdateBattle(state,dt);
      for(const ship of ships){
        const snap=before.get(ship);if(!snap)continue;
        const crewScale=turnScale(ship),rudderBase=ship.rudderAlive===false?.35:1,effective=Math.min(crewScale,rudderBase),ratio=rudderBase>0?effective/rudderBase:1;
        const d=angleDelta(snap.rotation,Number(ship.rotation)||0);ship.rotation=snap.rotation+d*ratio;
        for(const entry of snap.guns){
          const gun=entry.gun,beforeReload=entry.reload,after=Number(gun.reload)||0;
          if(after<beforeReload){const dec=beforeReload-after,m=reloadScaleForGun(ship,gun.id);gun.reload=Math.max(0,beforeReload-dec*m);}
        }
      }
      return out;
    };
    V.startPlayerBroadside=function(state,target){const ok=oldStart&&oldStart(state,target);if(ok&&state&&state.player&&state.salvo)pruneSalvo(state.player,state.salvo);if(ok&&state.salvo&&!state.salvo.gunIds.length){state.salvo=null;return false;}return !!ok;};
    V.fireEnemyBroadside=function(state,ship){const ok=oldEnemy&&oldEnemy(state,ship);if(ok&&ship&&ship.__v103Salvo)pruneSalvo(ship,ship.__v103Salvo);if(ok&&ship.__v103Salvo&&!ship.__v103Salvo.gunIds.length){ship.__v103Salvo=null;return false;}return !!ok;};
    V.updatePlayerSalvo=function(state,dt){if(state&&state.salvo&&state.player)pruneSalvo(state.player,state.salvo);return oldPlayerSalvo&&oldPlayerSalvo(state,dt);};
    V.updateEnemySalvo=function(state,ship,dt){if(ship&&ship.__v103Salvo)pruneSalvo(ship,ship.__v103Salvo);return oldEnemySalvo&&oldEnemySalvo(state,ship,dt);};
    return true;
  }

  const api={turnScale,reloadScaleForGroup,reloadScaleForGun,firefightingScale,pruneSalvo,installBroadside};
  root.V105StaffingBridge=api;root.DHH.V105StaffingBridge=api;
  installBroadside();
})(typeof globalThis!=='undefined'?globalThis:this);
