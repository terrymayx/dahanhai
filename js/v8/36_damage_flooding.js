(function(root){
  'use strict';
  const G=root.V8ShipGrid;
  if(!G)throw new Error('V8ShipGrid must load before V8.5 damage/flooding');

  function damageStage(cell){
    if(!cell||cell.alive===false||!(cell.hp>0))return 'destroyed';
    const max=Math.max(1,cell.maxHp||cell.hp||1);
    const ratio=cell.hp/max;
    if(ratio>.75)return 'intact';
    if(ratio>.50)return 'cracked';
    return 'critical';
  }

  G.damageStage=damageStage;
  root.V8DamageFlooding={damageStage};
})(typeof globalThis!=='undefined'?globalThis:this);
