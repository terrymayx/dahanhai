(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.7 flooding requires grid and battle');

  const LEAK_PER_WEIGHT=.00145;
  const MAX_LEAK_RATE=.055;
  const FLOOD_SPEED_LOSS=.58;
  const LEAK_TYPES={hull:1.35,deck:.72,beam:.92,core:.92};
  const originalDamageCell=G.damageCell;
  const originalNewGame=B.newGame;
  const originalSpawnEnemy=B.spawnEnemy;
  const originalUpdate=B.update;

  function prepareShip(ship){
    if(!ship)return ship;
    if(!Array.isArray(ship.__v97LeakCells))ship.__v97LeakCells=[];
    if(!Array.isArray(ship.__v97BreachCells))ship.__v97BreachCells=[];
    if(!Number.isFinite(ship.floodLevel))ship.floodLevel=0;
    if(!Number.isFinite(ship.leakRate))ship.leakRate=0;
    if(!Number.isFinite(ship.__v97LeakRevision))ship.__v97LeakRevision=-1;
    if(!Number.isFinite(ship.__v97FloodRoll))ship.__v97FloodRoll=0;
    return ship;
  }

  function registerBreach(ship,cell){
    if(!ship||!cell)return;
    prepareShip(ship);
    if(!cell.__v97BreachRegistered){cell.__v97BreachRegistered=true;ship.__v97BreachCells.push(cell);}
    const weight=LEAK_TYPES[cell.type]||0;
    if(weight&&!cell.__v97LeakRegistered){cell.__v97LeakRegistered=true;cell.__v97LeakWeight=weight;ship.__v97LeakCells.push(cell);}
    ship.__v97LeakRevision=-1;
  }

  G.damageCell=function(ship,cell,damage){
    const res=originalDamageCell(ship,cell,damage);
    if(res&&res.destroyed)registerBreach(ship,cell);
    return res;
  };

  function refreshLeaks(ship){
    prepareShip(ship);
    const revision=ship.__v96DamageRevision||0;
    if(ship.__v97LeakRevision===revision)return;
    let weight=0,sideMoment=0,count=0;
    const keep=[];
    for(const cell of ship.__v97LeakCells||[]){
      if(!cell||cell.alive||cell.detachedGone)continue;
      keep.push(cell);const w=cell.__v97LeakWeight||LEAK_TYPES[cell.type]||0;if(!(w>0))continue;
      weight+=w;count++;
      const p=G.cellCenterLocal(ship,cell);
      const transverse=ship.kind==='player'?p.x:p.y;
      sideMoment+=transverse*w;
    }
    ship.__v97LeakCells=keep;
    ship.__v97LeakWeight=weight;
    ship.__v97LeakCount=count;
    ship.__v97LeakSide=weight>0?sideMoment/weight:0;
    ship.__v97LeakRevision=revision;
  }

  function floodSpeedMultiplier(ship){
    const f=Math.max(0,Math.min(1,ship&&ship.floodLevel||0));
    return Math.max(.34,1-f*FLOOD_SPEED_LOSS);
  }

  function forceFloodSink(state,ship){
    if(!state||!ship||ship.__v97FloodSunk)return;
    ship.__v97FloodSunk=true;
    if(ship.side==='player'){
      if(state.state!=='lose'){
        state.state='lose';ship.state='wrecked';state.focus=null;state.aim=null;state.salvo=null;
      }
      return;
    }
    if(ship.state!=='active')return;
    const wasFocused=state.focus===ship;
    ship.state='sink';ship.sinkT=0;state.gold+=ship.gold||0;state.kills++;
    if(state.aim&&state.aim.shipId===ship.id)state.aim=null;
    if(wasFocused&&typeof B.setFocus==='function')B.setFocus(state,null);
    if(state.salvo&&state.salvo.targetId===ship.id)state.salvo=null;
    if(state.fx){
      state.fx.push({k:'waterSplash',x:ship.x,y:ship.y,t:0,dur:.7,r:58});
      state.fx.push({k:'waterRing',x:ship.x,y:ship.y,t:0,dur:1.0,r:72});
    }
  }

  function updateFloodShip(state,ship,dt){
    if(!ship||ship.state==='gone'||ship.state==='wrecked')return;
    prepareShip(ship);refreshLeaks(ship);
    const weight=ship.__v97LeakWeight||0;
    if(weight>0&&ship.state==='active'){
      const rate=Math.min(MAX_LEAK_RATE,weight*LEAK_PER_WEIGHT*(1+(ship.floodLevel||0)*.65));
      ship.leakRate=rate;
      ship.floodLevel=Math.min(1,(ship.floodLevel||0)+rate*dt);
    }else ship.leakRate=0;

    const flood=Math.max(0,Math.min(1,ship.floodLevel||0));
    const transverseHalf=Math.max(1,(ship.kind==='player'?ship.gridWidth:ship.gridHeight)*ship.cellSize*.5);
    const side=Math.max(-1,Math.min(1,(ship.__v97LeakSide||0)/transverseHalf));
    ship.__v97FloodRoll=side*flood*.040;
    ship.__v97FloodSinkOffset=flood*flood*8;
    ship.floodSpeedMultiplier=floodSpeedMultiplier(ship);

    if(ship.side==='enemy'&&ship.state==='active'){
      const base=ship.baseSpeed||ship.speed||0;
      const mast=Number.isFinite(ship.mastEfficiency)?ship.mastEfficiency:(ship.mastAlive===false?.75:1);
      const rudder=Number.isFinite(ship.rudderEfficiency)?ship.rudderEfficiency:(ship.rudderAlive===false?.55:1);
      if(base>0)ship.speed=Math.max(base*.22,base*mast*rudder*ship.floodSpeedMultiplier);
    }

    if(flood>=.985)forceFloodSink(state,ship);
  }

  B.newGame=function(){
    const state=originalNewGame();
    prepareShip(state.player);for(const ship of state.enemies||[])prepareShip(ship);
    return state;
  };
  B.spawnEnemy=function(state,kind,opts){return prepareShip(originalSpawnEnemy(state,kind,opts));};

  B.update=function(state,dt){
    originalUpdate(state,dt);
    if(!state||!(dt>0))return;
    updateFloodShip(state,state.player,dt);
    for(const ship of state.enemies||[])updateFloodShip(state,ship,dt);
  };

  root.V97Flooding={prepareShip,registerBreach,refreshLeaks,updateFloodShip,floodSpeedMultiplier,forceFloodSink,LEAK_TYPES,LEAK_PER_WEIGHT,MAX_LEAK_RATE};
})(typeof globalThis!=='undefined'?globalThis:this);