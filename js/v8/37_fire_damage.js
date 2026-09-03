(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.6 fire damage requires grid and battle');

  const DECK_HP_MULT=4;
  const FIRE_CHANCE={deck:.24,hull:.16};
  const FIRE_DPS=4.8;
  const originalCreateTemplateShip=G.createTemplateShip;
  const originalDamageCell=G.damageCell;

  function prepareShip(ship){
    if(!ship)return ship;
    if(!ship.__v96BurningCells)ship.__v96BurningCells=[];
    if(ship.__v94FirePrepared)return ship;
    ship.__v94FirePrepared=true;
    for(const cell of ship.cells||[]){
      cell.burning=false;cell.fireAge=0;cell.fireDamage=0;
      if(cell.type==='deck'){cell.maxHp*=DECK_HP_MULT;cell.hp=cell.maxHp;}
    }
    return ship;
  }

  G.createTemplateShip=function(kind,side,x,y){return prepareShip(originalCreateTemplateShip(kind,side,x,y));};

  function addBurningCell(ship,cell){
    if(!ship||!cell)return;
    if(!ship.__v96BurningCells)ship.__v96BurningCells=[];
    if(!ship.__v96BurningCells.includes(cell))ship.__v96BurningCells.push(cell);
  }

  function maybeIgnite(ship,cell,damage,fireScale){
    if(!cell||!cell.alive||cell.burning)return false;
    const chance=FIRE_CHANCE[cell.type]||0;
    if(!chance||damage<3)return false;
    const severity=Math.min(1.65,Math.max(.65,damage/16));
    fireScale=Math.max(0,Number.isFinite(Number(fireScale))?Number(fireScale):1);
    if(Math.random()<Math.min(.98,chance*severity*fireScale)){
      cell.burning=true;cell.fireAge=0;cell.fireDamage=0;addBurningCell(ship,cell);
      return true;
    }
    return false;
  }

  function damageCellWithFireScale(ship,cell,damage,fireScale){
    const res=originalDamageCell(ship,cell,damage);
    if(res&&res.hit&&cell&&cell.alive)maybeIgnite(ship,cell,damage,fireScale==null?1:fireScale);
    return res;
  }

  G.damageCell=function(ship,cell,damage){return damageCellWithFireScale(ship,cell,damage,1);};

  function allShips(state){return state?[state.player,...(state.enemies||[])].filter(Boolean):[];}

  function destroyByFire(state,ship,cell){
    cell.burning=false;cell.fireDamage=0;
    const pos=G.cellCenterWorld(ship,cell);
    if(state&&state.fx){
      state.fx.push({k:'structureBreak',x:pos.x,y:pos.y,t:0,dur:.42,r:22});
      state.fx.push({k:'waterSplash',x:pos.x,y:pos.y,t:0,dur:.38,r:15});
      state.fx.push({k:'waterRing',x:pos.x,y:pos.y,t:0,dur:.58,r:16});
    }
    if(state&&typeof state.onCellDestroyed==='function'){
      try{state.onCellDestroyed(ship,cell,pos,{side:'fire',damage:FIRE_DPS,fire:true});}catch(e){}
    }
  }

  // V9.6: iterate only cells that are actually on fire instead of every physical
  // cell on every frame. Dead/extinguished entries are compacted out immediately.
  function updateFire(state,dt){
    if(!state||!(dt>0))return;
    for(const ship of allShips(state)){
      if(!ship||ship.state==='gone')continue;
      prepareShip(ship);
      const list=ship.__v96BurningCells||[];
      if(!list.length)continue;
      const keep=[];
      for(const cell of list){
        if(!cell||!cell.alive||!cell.burning){if(cell)cell.burning=false;continue;}
        cell.fireAge=(cell.fireAge||0)+dt;
        cell.fireDamage=(cell.fireDamage||0)+FIRE_DPS*dt;
        if(cell.fireDamage>=1){
          const tick=Math.floor(cell.fireDamage);cell.fireDamage-=tick;
          // Fire DOT deliberately bypasses armor/ammo scaling and only consumes cell HP.
          const res=originalDamageCell(ship,cell,tick);
          if(res&&res.destroyed){destroyByFire(state,ship,cell);continue;}
        }
        if(cell.alive&&cell.burning)keep.push(cell);
      }
      ship.__v96BurningCells=keep;
    }
  }

  const originalUpdate=B.update;
  B.update=function(state,dt){originalUpdate(state,dt);updateFire(state,dt);};

  root.V94FireDamage={prepareShip,maybeIgnite,damageCellWithFireScale,updateFire,DECK_HP_MULT,FIRE_CHANCE,FIRE_DPS};
})(typeof globalThis!=='undefined'?globalThis:this);
