(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle||null;
  if(!G)throw new Error('V9.9 buoyancy requires V8ShipGrid');

  const MAX_ROLL=.22;
  const MAX_TRIM=.16;
  const SINK_RATIO=.38;
  const SINK_DELAY=2.25;
  const CAPSIZE_DELAY=1.75;
  const STRUCTURAL_DELAY=1.15;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function weightOf(c){return (G.CELL_WEIGHT&&G.CELL_WEIGHT[c&&c.type])||c&&c.weight||1;}
  function centerLocal(ship,c){return typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,c):{x:(c.gx+.5-ship.gridWidth/2)*(ship.cellSize||8),y:(c.gy+.5-ship.gridHeight/2)*(ship.cellSize||8)};}

  function prepareShip(ship){
    if(!ship)return ship;
    if(!Number.isFinite(ship.__v99MassRevision))ship.__v99MassRevision=-1;
    if(!Number.isFinite(ship.__v99DryMass))ship.__v99DryMass=0;
    if(!ship.__v99DryCenter)ship.__v99DryCenter={x:0,y:0};
    if(!Number.isFinite(ship.__v99Roll))ship.__v99Roll=Number(ship.__v97FloodRoll)||0;
    if(!Number.isFinite(ship.__v99Trim))ship.__v99Trim=0;
    if(!Number.isFinite(ship.__v99SinkOffset))ship.__v99SinkOffset=Number(ship.__v97FloodSinkOffset)||0;
    if(!Number.isFinite(ship.__v99BuoyancyRatio))ship.__v99BuoyancyRatio=1;
    if(!Number.isFinite(ship.__v99SinkTimer))ship.__v99SinkTimer=0;
    if(!Number.isFinite(ship.__v99CapsizeTimer))ship.__v99CapsizeTimer=0;
    if(!Number.isFinite(ship.__v99StructureFailTimer))ship.__v99StructureFailTimer=0;
    return ship;
  }

  function recomputeMass(ship){
    prepareShip(ship);
    const revision=Number(ship.__v99TopologyRevision)||0;
    if(ship.__v99MassRevision===revision&&ship.__v99DryMass>0)return{mass:ship.__v99DryMass,center:ship.__v99DryCenter};
    let mass=0,mx=0,my=0;
    for(const c of ship.cells||[]){
      if(!c.alive||c.detachedGone)continue;
      const w=weightOf(c),p=centerLocal(ship,c);mass+=w;mx+=p.x*w;my+=p.y*w;
    }
    ship.__v99DryMass=Math.max(.001,mass);
    ship.__v99DryCenter={x:mass?mx/mass:0,y:mass?my/mass:0};
    ship.__v99MassRevision=revision;
    return{mass:ship.__v99DryMass,center:ship.__v99DryCenter};
  }

  function computeTargets(ship){
    prepareShip(ship);
    const dry=recomputeMass(ship),comps=ship.__v99Compartments||[];
    let waterMass=0,wmx=0,wmy=0,buoyancy=0,bx=0,by=0,capacity=0;
    for(const comp of comps){
      const cap=Math.max(.001,Number(comp.capacityWeight)||0),water=clamp(Number(comp.water)||0,0,1),p=comp.centerLocal||{x:0,y:0};
      const wm=cap*water*.72;waterMass+=wm;wmx+=p.x*wm;wmy+=p.y*wm;
      const b=cap*(1-water);buoyancy+=b;bx+=p.x*b;by+=p.y*b;capacity+=cap;
    }
    const totalMass=dry.mass+waterMass;
    const com={x:(dry.center.x*dry.mass+wmx)/Math.max(.001,totalMass),y:(dry.center.y*dry.mass+wmy)/Math.max(.001,totalMass)};
    const cob={x:buoyancy>0?bx/buoyancy:0,y:buoyancy>0?by/buoyancy:0};
    const buoyancyRatio=capacity>0?clamp(buoyancy/capacity,0,1):1;
    const transverseHalf=Math.max(1,(ship.kind==='player'?ship.gridWidth:ship.gridHeight)*(ship.cellSize||8)*.5);
    const longitudinalHalf=Math.max(1,(ship.kind==='player'?ship.gridHeight:ship.gridWidth)*(ship.cellSize||8)*.5);
    const transverseDelta=ship.kind==='player'?(com.x-cob.x):(com.y-cob.y);
    const longitudinalDelta=ship.kind==='player'?(com.y-cob.y):(com.x-cob.x);
    const roll=clamp(transverseDelta/transverseHalf*.30,-MAX_ROLL,MAX_ROLL);
    const trim=clamp(longitudinalDelta/longitudinalHalf*.22,-MAX_TRIM,MAX_TRIM);
    const sinkOffset=Math.max(0,(1-buoyancyRatio)*(1-buoyancyRatio)*22+Math.abs(trim)*18);
    return{centerOfMass:com,centerOfBuoyancy:cob,buoyancyRatio,roll,trim,sinkOffset,totalMass,waterMass};
  }

  function sideFloodDanger(ship){
    let max=0;
    for(const c of ship.__v99Compartments||[])max=Math.max(max,Number(c.water)||0);
    return max;
  }

  function forcePhysicalSink(state,ship,reason){
    if(!state||!ship||ship.__v99PhysicallySunk)return;
    ship.__v99PhysicallySunk=reason||'buoyancy';
    const legacy=root.V97Flooding;
    if(legacy&&typeof legacy.forceFloodSink==='function'){legacy.forceFloodSink(state,ship);return;}
    if(ship.side==='player'){
      state.state='lose';ship.state='wrecked';state.focus=null;state.aim=null;state.salvo=null;
    }else if(ship.state==='active'){
      ship.state='sink';ship.sinkT=0;state.gold=(state.gold||0)+(ship.gold||0);state.kills=(state.kills||0)+1;
    }
  }

  function updateShip(state,ship,dt){
    if(!ship||ship.state==='gone'||ship.state==='wrecked'||!(dt>0))return;
    prepareShip(ship);
    const target=computeTargets(ship);
    ship.__v99BuoyancyRatio=target.buoyancyRatio;
    const response=1-Math.exp(-dt*3.4);
    ship.__v99Roll+=(target.roll-ship.__v99Roll)*response;
    ship.__v99Trim+=(target.trim-ship.__v99Trim)*response;
    ship.__v99SinkOffset+=(target.sinkOffset-ship.__v99SinkOffset)*(1-Math.exp(-dt*2.4));
    ship.__v97FloodRoll=ship.__v99Roll;
    ship.__v97FloodSinkOffset=ship.__v99SinkOffset;

    const integrity=typeof G.integrity==='function'?G.integrity(ship):1;
    const poorBuoyancy=target.buoyancyRatio<SINK_RATIO;
    const capsize=Math.abs(target.roll)>.20&&sideFloodDanger(ship)>.66;
    const structuralFailure=integrity<.18&&((ship.structuralChunks&&ship.structuralChunks.length>0)||(ship.__v99TopologyRevision||0)>8);
    ship.__v99SinkTimer=poorBuoyancy?ship.__v99SinkTimer+dt:Math.max(0,ship.__v99SinkTimer-dt*.8);
    ship.__v99CapsizeTimer=capsize?ship.__v99CapsizeTimer+dt:Math.max(0,ship.__v99CapsizeTimer-dt);
    ship.__v99StructureFailTimer=structuralFailure?ship.__v99StructureFailTimer+dt:Math.max(0,ship.__v99StructureFailTimer-dt);

    if(ship.__v99SinkTimer>=SINK_DELAY)forcePhysicalSink(state,ship,'buoyancy');
    else if(ship.__v99CapsizeTimer>=CAPSIZE_DELAY)forcePhysicalSink(state,ship,'capsize');
    else if(ship.__v99StructureFailTimer>=STRUCTURAL_DELAY)forcePhysicalSink(state,ship,'structure');
  }

  if(B&&typeof B.update==='function'&&!B.__v99BuoyancyWrapped){
    B.__v99BuoyancyWrapped=true;
    const originalUpdate=B.update;
    B.update=function(state,dt){
      originalUpdate(state,dt);
      if(!state||!(dt>0))return;
      updateShip(state,state.player,dt);
      for(const ship of state.enemies||[])updateShip(state,ship,dt);
    };
  }

  root.V99Buoyancy={MAX_ROLL,MAX_TRIM,SINK_RATIO,SINK_DELAY,CAPSIZE_DELAY,STRUCTURAL_DELAY,prepareShip,recomputeMass,computeTargets,updateShip,forcePhysicalSink};
})(typeof globalThis!=='undefined'?globalThis:this);
