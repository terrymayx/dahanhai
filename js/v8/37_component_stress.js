(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  const B=root.V8Battle||null;
  if(!G)throw new Error('V8ShipGrid must load before V8.6 component stress');

  const SYSTEM_TYPES={
    cannon:['cannon'],
    mast:['mast'],
    rudder:['rudder'],
    beam:['beam','core'],
    powder:['powder']
  };

  function clamp01(v){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0));}

  function componentRatio(cell){
    if(!cell||cell.alive===false||!(cell.hp>0))return 0;
    return clamp01(cell.hp/Math.max(1,cell.maxHp||cell.hp||1));
  }

  function componentStage(cell){
    const ratio=componentRatio(cell);
    if(ratio<=0)return 'destroyed';
    if(ratio>.66)return 'healthy';
    if(ratio>.33)return 'damaged';
    return 'critical';
  }

  function ratioFor(ship,types){
    let hp=0,max=0;
    const set=new Set(types);
    for(const cell of (ship&&ship.cells)||[]){
      if(!set.has(cell.type))continue;
      const cellMax=Math.max(1,cell.maxHp||cell.hp||1);
      max+=cellMax;
      if(cell.alive!==false&&cell.hp>0)hp+=Math.min(cellMax,cell.hp);
    }
    return max>0?clamp01(hp/max):1;
  }

  function shipSystemRatios(ship){
    return {
      cannon:ratioFor(ship,SYSTEM_TYPES.cannon),
      mast:ratioFor(ship,SYSTEM_TYPES.mast),
      rudder:ratioFor(ship,SYSTEM_TYPES.rudder),
      beam:ratioFor(ship,SYSTEM_TYPES.beam),
      powder:ratioFor(ship,SYSTEM_TYPES.powder)
    };
  }

  function structureStressStage(stress){
    stress=clamp01(stress);
    if(stress<.34)return 'stable';
    if(stress<=.66)return 'strained';
    return 'critical';
  }

  function powderDangerFor(ship){
    let danger=0;
    for(const cell of (ship&&ship.cells)||[]){
      if(cell.type!=='powder'||cell.alive===false)continue;
      const stage=componentStage(cell);
      if(stage==='critical')danger=Math.max(danger,1);
      else if(stage==='damaged')danger=Math.max(danger,.5);
    }
    return danger;
  }

  function cellStress(ship,cell){
    if(!ship||!cell||cell.alive===false)return 0;
    let stress=0;
    for(const beam of ship.cells||[]){
      if((beam.type!=='beam'&&beam.type!=='core')||beam.alive===false)continue;
      const ratio=componentRatio(beam);
      if(ratio>=.66)continue;
      const dist=Math.abs((beam.gx||0)-(cell.gx||0))+Math.abs((beam.gy||0)-(cell.gy||0));
      const distanceFactor=Math.max(0,1-dist/5);
      stress=Math.max(stress,(1-ratio)*distanceFactor);
    }
    return clamp01(stress);
  }

  function refreshShip(ship){
    if(!ship)return ship;
    const ratios=shipSystemRatios(ship);
    ship.systemRatios=ratios;
    ship.beamIntegrity=ratios.beam;
    ship.structureStress=clamp01(1-ratios.beam);
    ship.structureStressStage=structureStressStage(ship.structureStress);
    ship.cannonEfficiency=ratios.cannon<=0?0:.45+.55*ratios.cannon;
    ship.mastEfficiency=.75+.25*ratios.mast;
    ship.rudderEfficiency=.55+.45*ratios.rudder;
    ship.rudderCritical=ratios.rudder<.33;
    ship.powderDanger=powderDangerFor(ship);
    for(const cell of ship.cells||[])cell.stress=cellStress(ship,cell);
    return ship;
  }

  const api={
    SYSTEM_TYPES,componentRatio,componentStage,shipSystemRatios,structureStressStage,
    powderDangerFor,cellStress,refreshShip
  };
  root.V8ComponentStress=api;

  // Battle hooks are added in later V8.6 tasks; keep the pure model usable in tests.
  if(B)api.battle=B;
})(typeof globalThis!=='undefined'?globalThis:this);
