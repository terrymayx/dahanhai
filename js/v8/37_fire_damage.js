(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.3 fire damage requires grid and battle');

  const DECK_HP_MULT=3;
  const FIRE_CHANCE={deck:.28,hull:.18};
  const FIRE_DPS=5.5;
  const originalCreateTemplateShip=G.createTemplateShip;
  const originalDamageCell=G.damageCell;

  function prepareShip(ship){
    if(!ship||ship.__v93FirePrepared)return ship;
    ship.__v93FirePrepared=true;
    for(const cell of ship.cells||[]){
      cell.burning=false;
      cell.fireAge=0;
      cell.fireDamage=0;
      if(cell.type==='deck'){
        cell.maxHp*=DECK_HP_MULT;
        cell.hp=cell.maxHp;
      }
    }
    return ship;
  }

  G.createTemplateShip=function(kind,side,x,y){
    return prepareShip(originalCreateTemplateShip(kind,side,x,y));
  };

  function maybeIgnite(cell,damage){
    if(!cell||!cell.alive||cell.burning)return false;
    const chance=FIRE_CHANCE[cell.type]||0;
    if(!chance||damage<3)return false;
    const severity=Math.min(1.65,Math.max(.65,damage/16));
    if(Math.random()<chance*severity){
      cell.burning=true;
      cell.fireAge=0;
      cell.fireDamage=0;
      return true;
    }
    return false;
  }

  G.damageCell=function(ship,cell,damage){
    const res=originalDamageCell(ship,cell,damage);
    if(res&&res.hit&&cell&&cell.alive)maybeIgnite(cell,damage);
    return res;
  };

  function allShips(state){
    if(!state)return [];
    return [state.player,...(state.enemies||[])].filter(Boolean);
  }

  function destroyByFire(state,ship,cell){
    cell.burning=false;
    cell.fireDamage=0;
    const pos=G.cellCenterWorld(ship,cell);
    if(state&&state.fx){
      state.fx.push({k:'structureBreak',x:pos.x,y:pos.y,t:0,dur:.42,r:26});
      state.fx.push({k:'waterSplash',x:pos.x,y:pos.y,t:0,dur:.38,r:18});
      state.fx.push({k:'waterRing',x:pos.x,y:pos.y,t:0,dur:.58,r:19});
    }
    if(state&&typeof state.onCellDestroyed==='function'){
      try{state.onCellDestroyed(ship,cell,pos,{side:'fire',damage:FIRE_DPS,fire:true});}catch(e){}
    }
  }

  function updateFire(state,dt){
    if(!state||!(dt>0))return;
    for(const ship of allShips(state)){
      if(!ship||ship.state==='gone')continue;
      prepareShip(ship);
      for(const cell of ship.cells||[]){
        if(!cell.alive){cell.burning=false;continue;}
        if(!cell.burning)continue;
        cell.fireAge=(cell.fireAge||0)+dt;
        cell.fireDamage=(cell.fireDamage||0)+FIRE_DPS*dt;
        if(cell.fireDamage<1)continue;
        const tick=Math.floor(cell.fireDamage);
        cell.fireDamage-=tick;
        const res=originalDamageCell(ship,cell,tick);
        if(res&&res.destroyed)destroyByFire(state,ship,cell);
      }
    }
  }

  const originalUpdate=B.update;
  B.update=function(state,dt){
    originalUpdate(state,dt);
    updateFire(state,dt);
  };

  root.V93FireDamage={prepareShip,maybeIgnite,updateFire,DECK_HP_MULT,FIRE_CHANCE,FIRE_DPS};
})(typeof globalThis!=='undefined'?globalThis:this);
