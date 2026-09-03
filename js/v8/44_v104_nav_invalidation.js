(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  const V104=root.V104Boarding||(root.DHH&&root.DHH.V104Boarding);
  if(!G||!V104||typeof G.damageCell!=='function'||G.__v104NavInvalidationInstalled)return;

  const oldDamageCell=G.damageCell;
  G.damageCell=function(ship,cell,damage){
    const wasAlive=!!(cell&&cell.alive);
    const result=oldDamageCell.apply(this,arguments);
    if(wasAlive&&result&&result.destroyed&&ship&&typeof V104.markStructureDirty==='function'){
      V104.markStructureDirty(ship);
    }
    return result;
  };

  G.__v104NavInvalidationInstalled=true;
})(typeof globalThis!=='undefined'?globalThis:this);
