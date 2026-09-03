(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle||null;
  if(!G)throw new Error('V10 sinking requires V8ShipGrid');

  const MAX_PHYSICAL_ROLL=.84;
  const IMMERSION_START=.38;
  const CAPSIZE_DANGER=.56;
  const CAPSIZE_LOCK=.84;
  const LIST_START=.21;
  const LOCK_DELAY=1.15;
  const OUTER_TYPES=new Set(['deck','hull']);
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function key(gx,gy){return gx+','+gy;}
  function transverseLocal(ship,p){return ship.kind==='player'?p.x:p.y;}
  function transverseHalf(ship){return Math.max(1,(ship.kind==='player'?ship.gridWidth:ship.gridHeight)*(ship.cellSize||8)*.5);}

  function isOuter(ship,cell){if(!ship||!cell||!ship.cellMap)return false;for(const [dx,dy] of DIRS)if(!ship.cellMap[key(cell.gx+dx,cell.gy+dy)])return true;return false;}

  function rebuildCandidates(ship){
    const list=[];
    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.detachedGone||!OUTER_TYPES.has(cell.type)||!isOuter(ship,cell))continue;
      const p=typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,cell):{x:(cell.gx+.5-ship.gridWidth/2)*(ship.cellSize||8),y:(cell.gy+.5-ship.gridHeight/2)*(ship.cellSize||8)};
      list.push({cell,transverse:transverseLocal(ship,p),local:p});
    }
    ship.__v100ImmersionCandidates=list;ship.__v100ImmersionTopologyRevision=Number(ship.__v99TopologyRevision)||0;return list;
  }

  function prepareShip(ship){
    if(!ship)return ship;
    if(!Array.isArray(ship.__v100ImmersionCandidates))ship.__v100ImmersionCandidates=[];
    if(!Number.isFinite(ship.__v100ImmersionTopologyRevision))ship.__v100ImmersionTopologyRevision=-1;
    if(!Number.isFinite(ship.__v100CapsizeTimer))ship.__v100CapsizeTimer=0;
    if(!Number.isFinite(ship.__v100PhysicalRoll))ship.__v100PhysicalRoll=Number(ship.__v99Roll)||0;
    if(!Number.isFinite(ship.__v100ImmersionFxT))ship.__v100ImmersionFxT=0;
    if(!Number.isFinite(ship.__v100SubmergedOpeningCount))ship.__v100SubmergedOpeningCount=0;
    if(!Number.isFinite(ship.__v101ImmersionSeverity))ship.__v101ImmersionSeverity=0;
    if(ship.__v100ImmersionTopologyRevision!==(Number(ship.__v99TopologyRevision)||0))rebuildCandidates(ship);
    return ship;
  }

  function capsizeStage(ship){
    const a=Math.abs(Number(ship&&ship.__v100PhysicalRoll)||Number(ship&&ship.__v99Roll)||0);
    if(a>=CAPSIZE_LOCK-.001)return 'locked';if(a>=CAPSIZE_DANGER)return 'capsizing';if(a>=IMMERSION_START)return 'danger';if(a>=LIST_START)return 'listing';return 'stable';
  }

  function handlingMultiplier(ship){const stage=capsizeStage(ship);if(stage==='locked')return .12;if(stage==='capsizing')return .28;if(stage==='danger')return .55;if(stage==='listing')return .78;return 1;}

  function damageReadiness(cell){
    const hpRatio=clamp((Number(cell.hp)||0)/Math.max(1,Number(cell.maxHp)||1),0,1);
    return Math.max(1-hpRatio,Number(cell.crackDepth)||0,Number(cell.fracture)||0,(Number(cell.fatigue)||0)*.75);
  }

  function addImmersionFx(state,ship,item){
    if(!state||!state.fx||!item||!item.cell)return;
    const p=typeof G.cellCenterWorld==='function'?G.cellCenterWorld(ship,item.cell):{x:ship.x,y:ship.y};
    state.fx.push({k:'foam',x:p.x,y:p.y,t:0,dur:.55,r:7},{k:'waterRing',x:p.x,y:p.y,t:0,dur:.62,r:12});
    if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);
  }

  function updateImmersion(state,ship,dt){
    if(!ship||ship.state==='gone'||ship.state==='wrecked'||!(dt>0))return 0;
    prepareShip(ship);const comps=ship.__v99Compartments||[];
    for(const comp of comps){comp.submergedOpenings=0;comp.__v100ImmersionSide=0;comp.__v101ImmersionSeverity=0;}

    const roll=Number(ship.__v99Roll)||0,absRoll=Math.abs(roll),sideSign=Math.sign(roll)||1,half=transverseHalf(ship);
    let count=0,first=null,totalSeverity=0;
    if(absRoll>=IMMERSION_START*.82){
      for(const item of ship.__v100ImmersionCandidates){
        const cell=item.cell;if(!cell||!cell.alive||cell.detachedGone)continue;
        const side=clamp(item.transverse/half,-1,1);if(side*sideSign<.22)continue;
        const weakness=damageReadiness(cell);if(weakness<.18)continue;
        const sideDepth=Math.max(0,side*sideSign-.18),angleDepth=Math.max(0,(absRoll-IMMERSION_START*.82)/Math.max(.01,MAX_PHYSICAL_ROLL-IMMERSION_START*.82));
        const sinkDepth=clamp((Number(ship.__v99SinkOffset)||0)/18,0,.65),immersion=sideDepth*.62+angleDepth*.72+sinkDepth*.35;
        const threshold=.56+(1-weakness)*.34;if(immersion<threshold)continue;
        const C=root.V99Compartments||null,idx=C&&typeof C.compartmentIndex==='function'?C.compartmentIndex(ship,cell):0,comp=comps[idx];if(!comp)continue;
        const severity=clamp((immersion-threshold)*1.8+weakness*.55+angleDepth*.35,.08,1.8);
        comp.submergedOpenings++;comp.__v100ImmersionSide=sideSign;comp.__v101ImmersionSeverity+=severity;
        totalSeverity+=severity;count++;if(!first)first=item;
      }
    }
    ship.__v100SubmergedOpeningCount=count;ship.__v101ImmersionSeverity=totalSeverity;

    const sideDanger=comps.reduce((m,c)=>Math.max(m,Number(c.water)||0),0),flooded=clamp(Number(ship.floodLevel)||0,0,1);
    let physical=Number(ship.__v100PhysicalRoll)||roll;const response=1-Math.exp(-dt*4.2);physical+=(roll-physical)*response;
    if(Math.abs(physical)>=CAPSIZE_DANGER&&sideDanger>.48){
      const sign=Math.sign(physical)||sideSign,runaway=(.045+Math.max(0,sideDanger-.48)*.17+count*.003+totalSeverity*.0028+flooded*.035)*dt;physical+=sign*runaway;
    }
    if(totalSeverity>.45&&absRoll>=IMMERSION_START)physical+=(Math.sign(physical)||sideSign)*Math.min(.042,totalSeverity*.0045)*dt;
    physical=clamp(physical,-MAX_PHYSICAL_ROLL,MAX_PHYSICAL_ROLL);
    if(Math.abs(physical)>.815&&sideDanger>.68)physical=Math.sign(physical)*MAX_PHYSICAL_ROLL;
    ship.__v100PhysicalRoll=physical;ship.__v99Roll=physical;ship.__v97FloodRoll=physical;ship.__v100CapsizeStage=capsizeStage(ship);ship.__v100HandlingMultiplier=handlingMultiplier(ship);
    ship.__v100CapsizeTimer=ship.__v100CapsizeStage==='locked'?ship.__v100CapsizeTimer+dt:Math.max(0,ship.__v100CapsizeTimer-dt*.65);
    if(ship.side==='enemy'&&Number.isFinite(ship.speed))ship.speed*=ship.__v100HandlingMultiplier;
    ship.__v100ImmersionFxT-=dt;if(count>0&&first&&ship.__v100ImmersionFxT<=0){addImmersionFx(state,ship,first);ship.__v100ImmersionFxT=.24;}
    if(ship.__v100CapsizeTimer>=LOCK_DELAY){const Buoy=root.V99Buoyancy||null;if(Buoy&&typeof Buoy.forcePhysicalSink==='function')Buoy.forcePhysicalSink(state,ship,'capsize');}
    return count;
  }

  if(B&&typeof B.update==='function'&&!B.__v100SinkingWrapped){
    B.__v100SinkingWrapped=true;const originalUpdate=B.update;
    B.update=function(state,dt){originalUpdate(state,dt);if(!state||!(dt>0))return;updateImmersion(state,state.player,dt);for(const ship of state.enemies||[])updateImmersion(state,ship,dt);};
  }

  root.V100Sinking={MAX_PHYSICAL_ROLL,IMMERSION_START,CAPSIZE_DANGER,CAPSIZE_LOCK,LIST_START,LOCK_DELAY,prepareShip,rebuildCandidates,updateImmersion,capsizeStage,handlingMultiplier};
})(typeof globalThis!=='undefined'?globalThis:this);
