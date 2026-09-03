(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.7.1 flooding requires grid and battle');

  const LEAK_PER_WEIGHT=.00042;
  const MAX_LEAK_RATE=.018;
  const FLOOD_SPEED_LOSS=.52;
  const LEAK_TYPES={hull:1.00,deck:.32,beam:.58,core:.58};
  const originalDamageCell=G.damageCell;
  const originalNewGame=B.newGame;
  const originalSpawnEnemy=B.spawnEnemy;
  const originalUpdate=B.update;

  function v99Active(){return !!root.V99Compartments;}
  function clamp01(v){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0));}

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
    // V9.9 decides whether a destroyed cell actually connects to open water.
    if(res&&res.destroyed&&!v99Active())registerBreach(ship,cell);
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
      keep.push(cell);
      const w=cell.__v97LeakWeight||LEAK_TYPES[cell.type]||0;
      if(!(w>0))continue;
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

  function floodCeiling(ship){
    const integrity=clamp01(G.integrity(ship));
    const damage=1-integrity;
    const count=ship.__v97LeakCount||0;
    const weight=ship.__v97LeakWeight||0;
    const containment=clamp01(damage/.45);
    let ceiling=.18+.82*Math.pow(containment,.80);
    const breachBonus=Math.min(.24,Math.max(0,count-4)*.012+Math.max(0,weight-8)*.006);
    ceiling=Math.min(1,ceiling+breachBonus);
    return ceiling;
  }

  function floodRateFor(ship){
    const weight=ship.__v97LeakWeight||0;
    const count=ship.__v97LeakCount||0;
    if(!(weight>0)||count<=0)return 0;
    const integrity=clamp01(G.integrity(ship));
    const damage=1-integrity;
    const flood=clamp01(ship.floodLevel||0);
    const structureFactor=.34+damage*1.85;
    const countFactor=.68+Math.min(.62,Math.sqrt(count)*.105);
    const pressureFactor=.88+flood*.34;
    return Math.min(MAX_LEAK_RATE,weight*LEAK_PER_WEIGHT*structureFactor*countFactor*pressureFactor);
  }

  function floodSpeedMultiplier(ship){
    const f=clamp01(ship&&ship.floodLevel||0);
    const effective=Math.max(0,(f-.18)/.82);
    return Math.max(.40,1-effective*FLOOD_SPEED_LOSS);
  }

  function canFloodSink(ship){
    const integrity=clamp01(G.integrity(ship));
    const count=ship.__v97LeakCount||0;
    const weight=ship.__v97LeakWeight||0;
    return integrity<=.62||count>=24||weight>=22;
  }

  function forceFloodSink(state,ship){
    if(!state||!ship||ship.__v97FloodSunk)return;
    ship.__v97FloodSunk=true;
    if(ship.side==='player'){
      if(state.state!=='lose'){state.state='lose';ship.state='wrecked';state.focus=null;state.aim=null;state.salvo=null;}
      return;
    }
    if(ship.state!=='active')return;
    const wasFocused=state.focus===ship;
    ship.state='sink';ship.sinkT=0;state.gold+=ship.gold||0;state.kills++;
    if(state.aim&&state.aim.shipId===ship.id)state.aim=null;
    const next=(typeof B.targetForPlayer==='function')?B.targetForPlayer(state):null;
    if(wasFocused&&typeof B.setFocus==='function')B.setFocus(state,next);
    if(state.salvo&&state.salvo.targetId===ship.id){if(next)state.salvo.targetId=next.id;else state.salvo=null;}
    if(state.fx){state.fx.push({k:'waterSplash',x:ship.x,y:ship.y,t:0,dur:.7,r:58});state.fx.push({k:'waterRing',x:ship.x,y:ship.y,t:0,dur:1.0,r:72});}
  }

  function updateFloodShip(state,ship,dt){
    if(!ship||ship.state==='gone'||ship.state==='wrecked')return;
    prepareShip(ship);refreshLeaks(ship);
    const ceiling=floodCeiling(ship);ship.floodCeiling=ceiling;
    const rate=floodRateFor(ship);ship.leakRate=rate;
    if(rate>0&&ship.state==='active'&&(ship.floodLevel||0)<ceiling){
      const room=Math.max(0,ceiling-(ship.floodLevel||0));
      const ceilingEase=Math.min(1,.22+room/.20);
      ship.floodLevel=Math.min(ceiling,(ship.floodLevel||0)+rate*ceilingEase*dt);
    }
    const flood=clamp01(ship.floodLevel||0);
    const transverseHalf=Math.max(1,(ship.kind==='player'?ship.gridWidth:ship.gridHeight)*ship.cellSize*.5);
    const side=Math.max(-1,Math.min(1,(ship.__v97LeakSide||0)/transverseHalf));
    const visibleFlood=Math.max(0,(flood-.10)/.90);
    ship.__v97FloodRoll=side*visibleFlood*.034;
    ship.__v97FloodSinkOffset=visibleFlood*visibleFlood*7;
    ship.floodSpeedMultiplier=floodSpeedMultiplier(ship);
    if(ship.side==='enemy'&&ship.state==='active'){
      const base=ship.baseSpeed||ship.speed||0;
      const mast=Number.isFinite(ship.mastEfficiency)?ship.mastEfficiency:(ship.mastAlive===false ? .75 : 1);
      const rudder=Number.isFinite(ship.rudderEfficiency)?ship.rudderEfficiency:(ship.rudderAlive===false ? .55 : 1);
      if(base>0)ship.speed=Math.max(base*.24,base*mast*rudder*ship.floodSpeedMultiplier);
    }
    if(flood>=.985&&canFloodSink(ship))forceFloodSink(state,ship);
  }

  B.newGame=function(){
    const state=originalNewGame();prepareShip(state.player);for(const ship of state.enemies||[])prepareShip(ship);return state;
  };
  B.spawnEnemy=function(state,kind,opts){return prepareShip(originalSpawnEnemy(state,kind,opts));};

  B.update=function(state,dt){
    originalUpdate(state,dt);
    if(!state||!(dt>0)||v99Active())return;
    updateFloodShip(state,state.player,dt);
    for(const ship of state.enemies||[])updateFloodShip(state,ship,dt);
  };

  root.V97Flooding={prepareShip,registerBreach,refreshLeaks,updateFloodShip,floodSpeedMultiplier,floodCeiling,floodRateFor,canFloodSink,forceFloodSink,LEAK_TYPES,LEAK_PER_WEIGHT,MAX_LEAK_RATE};
})(typeof globalThis!=='undefined'?globalThis:this);
