(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.5.2 detach cleanup requires grid and battle');

  const originalDetach=G.detachDisconnectedComponents;
  const originalUpdate=B.update;

  function markDetached(components){
    for(const comp of components||[]){
      for(const cell of comp||[]){
        cell.alive=false;
        cell.hp=0;
        cell.burning=false;
        cell.detachedGone=true;
      }
    }
    return components||[];
  }

  G.detachDisconnectedComponents=function(ship){
    return markDetached(originalDetach(ship));
  };

  function cleanupShip(ship){
    if(!ship||ship.state==='gone')return [];
    return G.detachDisconnectedComponents(ship);
  }

  B.update=function(state,dt){
    originalUpdate(state,dt);
    if(!state)return;
    cleanupShip(state.player);
    for(const ship of state.enemies||[])cleanupShip(ship);
  };

  root.V952DetachCleanup={cleanupShip,markDetached};
})(typeof globalThis!=='undefined'?globalThis:this);
