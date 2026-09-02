(function(root){
  'use strict';
  const G=root.V8ShipGrid,B=root.V8Battle||null;
  if(!G)throw new Error('V8ShipGrid must load before V8.5.1 damage model');

  function damageStage(cell){
    if(!cell||cell.alive===false||!(cell.hp>0))return 'destroyed';
    const max=Math.max(1,cell.maxHp||cell.hp||1);
    const ratio=cell.hp/max;
    if(ratio>.75)return 'intact';
    if(ratio>.50)return 'cracked';
    return 'critical';
  }

  function installBattleHooks(){
    if(!B||B.__v851DamageModelInstalled)return;
    B.__v851DamageModelInstalled=true;

    const originalNewGame=B.newGame;
    B.newGame=function(){
      const state=originalNewGame();
      const originalDestroyed=state.onCellDestroyed;
      state.onCellDestroyed=function(ship,cell,pos,p){
        const before=(state.debrisClusters||[]).length;
        if(typeof originalDestroyed==='function')originalDestroyed(ship,cell,pos,p);
        state.shake=0;
        if((cell.type==='beam'||cell.type==='core')&&(state.debrisClusters||[]).length>before){
          let detached=0;
          for(let i=before;i<state.debrisClusters.length;i++)detached+=(state.debrisClusters[i].cells||[]).length;
          if(state.fx)state.fx.push({k:'structureRupture',x:pos.x,y:pos.y,t:0,dur:.55,r:44+Math.min(100,detached*5)});
        }
      };
      return state;
    };

    const originalUpdate=B.update;
    B.update=function(state,dt){
      originalUpdate(state,dt);
      if(state)state.shake=0;
    };
  }

  G.damageStage=damageStage;
  root.V8DamageModel={damageStage};
  installBattleHooks();
})(typeof globalThis!=='undefined'?globalThis:this);
