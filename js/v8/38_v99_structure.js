(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V9.9 structure requires V8ShipGrid');

  const LOCAL_RADIUS=9;
  const MAX_OVERLOAD_NODES=12;
  const LARGE_CHUNK_RATIO=.10;
  const MAX_GLOBAL_CHUNKS=18;
  const STRUCTURAL_TYPES=new Set(['hull','deck','beam','core']);
  const BASE_CAPACITY={deck:1.0,hull:1.4,beam:3.4,core:4.2};
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function key(gx,gy){return gx+','+gy;}
  function cellWeight(c){return (G.CELL_WEIGHT&&G.CELL_WEIGHT[c&&c.type])||c&&c.weight||1;}
  function markBendingDirty(ship,reason){const B=root.V100Bending||null;if(B&&typeof B.markDirty==='function')B.markDirty(ship,reason);}

  function prepareShip(ship){
    if(!ship)return ship;
    if(!Array.isArray(ship.structuralChunks))ship.structuralChunks=[];
    if(!Array.isArray(ship.__v99StructureQueue))ship.__v99StructureQueue=[];
    return ship;
  }

  function structuralCapacityFor(cell){
    if(!cell)return 0;
    const base=BASE_CAPACITY[cell.type]||1;
    const hpRatio=clamp((Number(cell.hp)||0)/Math.max(1,Number(cell.maxHp)||1),0,1);
    const fracture=clamp(Number(cell.fracture)||0,0,1);
    const fatigue=clamp(Number(cell.fatigue)||0,0,1);
    return base*Math.max(.08,hpRatio)*Math.max(.18,1-fracture*.55)*Math.max(.25,1-fatigue*.35);
  }

  function localCells(ship,center,radius){
    radius=radius==null?LOCAL_RADIUS:radius;
    const out=[];
    if(!ship||!center||!ship.cellMap)return out;
    const minX=Math.max(0,center.gx-radius),maxX=Math.min((ship.gridWidth||0)-1,center.gx+radius);
    const minY=Math.max(0,center.gy-radius),maxY=Math.min((ship.gridHeight||0)-1,center.gy+radius);
    for(let gy=minY;gy<=maxY;gy++)for(let gx=minX;gx<=maxX;gx++){
      const c=ship.cellMap[key(gx,gy)];
      if(c&&c.alive&&!c.detachedGone)out.push(c);
    }
    return out;
  }

  function structuralNeighbors(ship,cell){
    let n=0;
    for(const [dx,dy] of DIRS){
      const c=ship.cellMap&&ship.cellMap[key(cell.gx+dx,cell.gy+dy)];
      if(c&&c.alive&&!c.detachedGone&&STRUCTURAL_TYPES.has(c.type))n++;
    }
    return n;
  }

  function estimateStress(ship,node,region){
    let load=0;
    const reach=5;
    for(const c of region){
      const d=Math.abs(c.gx-node.gx)+Math.abs(c.gy-node.gy);
      if(d>reach)continue;
      load+=cellWeight(c)*(1-d/(reach+1));
    }
    const supports=structuralNeighbors(ship,node);
    const edgePenalty=supports<=1?1.55:supports===2?1.20:1;
    const hpRatio=clamp((Number(node.hp)||0)/Math.max(1,Number(node.maxHp)||1),0,1);
    const weakness=1+(1-hpRatio)*1.5+(Number(node.fracture)||0)*1.25+(Number(node.fatigue)||0)*.75;
    return load/Math.max(1,4.2+supports*2.4)*edgePenalty*weakness;
  }

  function solveLocal(ship,center){
    if(!ship||!center||ship.state==='gone')return [];
    prepareShip(ship);
    const M=root.V99Material||null;
    const region=localCells(ship,center,LOCAL_RADIUS);
    const candidates=[];
    for(const cell of region){
      if(!STRUCTURAL_TYPES.has(cell.type))continue;
      if(M&&typeof M.prepareCell==='function')M.prepareCell(ship,cell);
      const capacity=structuralCapacityFor(cell);
      const stress=estimateStress(ship,cell,region);
      cell.structuralCapacity=capacity;
      cell.structuralStress=stress;
      const ratio=capacity>0?stress/capacity:99;
      if(ratio>1)candidates.push({cell,ratio,stress,capacity});
    }
    candidates.sort((a,b)=>b.ratio-a.ratio);
    const processed=[];
    for(const item of candidates.slice(0,MAX_OVERLOAD_NODES)){
      const c=item.cell,over=Math.max(0,item.ratio-1);
      c.fatigue=clamp((Number(c.fatigue)||0)+Math.min(.13,.025+over*.04),0,1);
      c.fracture=clamp((Number(c.fracture)||0)+Math.min(.11,.012+over*.035),0,1);
      let destroyed=false;
      if(item.ratio>1.35&&c.alive){
        const damage=Math.min(8,1.2+(item.ratio-1.35)*4.5);
        const res=G.damageCell(ship,c,damage);
        destroyed=!!(res&&res.destroyed);
        if(destroyed)ship.__v96NeedsStructuralCleanup=true;
      }
      processed.push({cell:c,ratio:item.ratio,destroyed});
    }
    if(processed.length){
      ship.__v99MaterialRevision=(ship.__v99MaterialRevision||0)+1;
      markBendingDirty(ship,'local-stress');
    }
    return processed;
  }

  function queueLocalSolve(ship,cell){
    if(!ship||!cell)return;
    prepareShip(ship);
    const k=key(cell.gx,cell.gy);
    if(ship.__v99StructureQueue.some(x=>x.key===k))return;
    ship.__v99StructureQueue.push({key:k,gx:cell.gx,gy:cell.gy});
    if(ship.__v99StructureQueue.length>8)ship.__v99StructureQueue.splice(0,ship.__v99StructureQueue.length-8);
  }

  function processQueue(ship){
    if(!ship||!ship.__v99StructureQueue||!ship.__v99StructureQueue.length)return [];
    const item=ship.__v99StructureQueue.shift();
    const center=(ship.cellMap&&ship.cellMap[item.key])||{gx:item.gx,gy:item.gy};
    return solveLocal(ship,center);
  }

  function applyPowderFatigue(ship,cell){
    if(!ship||!cell)return;
    const M=root.V99Material||null;
    let queued=0,changed=0;
    for(const target of localCells(ship,cell,3)){
      if(!STRUCTURAL_TYPES.has(target.type))continue;
      const d=Math.hypot(target.gx-cell.gx,target.gy-cell.gy);
      if(d>3.05)continue;
      const power=Math.max(.25,2.4-d*.58);
      if(M&&typeof M.addBlastFatigue==='function')M.addBlastFatigue(ship,target,power);
      else{
        target.fracture=clamp((Number(target.fracture)||0)+power*.055,0,1);
        target.fatigue=clamp((Number(target.fatigue)||0)+power*.045,0,1);
      }
      changed++;
      if(queued<3){queueLocalSolve(ship,target);queued++;}
    }
    if(changed)markBendingDirty(ship,'powder-fatigue');
  }

  function massOf(cells){let m=0;for(const c of cells||[])m+=cellWeight(c);return m;}

  function localCenter(ship,comp){
    let x=0,y=0,w=0;
    for(const c of comp||[]){
      const cw=cellWeight(c),p=typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,c):{x:(c.gx+.5-(ship.gridWidth||0)/2)*(ship.cellSize||8),y:(c.gy+.5-(ship.gridHeight||0)/2)*(ship.cellSize||8)};
      x+=p.x*cw;y+=p.y*cw;w+=cw;
    }
    return{x:w?x/w:0,y:w?y/w:0};
  }

  function localToWorld(ship,p){
    if(typeof G.localToWorld==='function')return G.localToWorld(ship,p.x,p.y);
    const r=Number(ship.rotation)||0,c=Math.cos(r),s=Math.sin(r);
    return{x:(ship.x||0)+p.x*c-p.y*s,y:(ship.y||0)+p.x*s+p.y*c};
  }

  function createChunk(ship,comp,sourceMass){
    const center=localCenter(ship,comp),world=localToWorld(ship,center),mass=massOf(comp);
    const cells=(comp||[]).map(c=>{
      const p=typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,c):{x:(c.gx+.5-(ship.gridWidth||0)/2)*(ship.cellSize||8),y:(c.gy+.5-(ship.gridHeight||0)/2)*(ship.cellSize||8)};
      return{x:p.x-center.x,y:p.y-center.y,type:c.type,weight:cellWeight(c),fracture:Number(c.fracture)||0};
    });
    const ph=ship.physics||{};
    const chunk={
      id:(ship.id||ship.kind||'ship')+'-chunk-'+Date.now()+'-'+Math.floor(Math.random()*9999),
      sourceShipId:ship.id||null,x:world.x,y:world.y,rotation:Number(ship.rotation)||0,
      vx:(ship.side==='enemy'?-(ship.speed||0)*.18:0)+(ph.impulseX||0)*3,
      vy:(ph.impulseY||0)*3-8,angularVelocity:(Math.random()-.5)*.8,
      mass,sourceMass,cellSize:ship.cellSize||8,cells,water:0,
      buoyancy:Math.max(.18,1-(comp||[]).filter(c=>!c.alive).length/Math.max(1,(comp||[]).length)),
      age:0,sinkProgress:0,phase:'float',baseColor:ship.baseColor,deckColor:ship.deckColor,__v99Globalized:false
    };
    ship.structuralChunks.push(chunk);
    markBendingDirty(ship,'large-chunk');
    return chunk;
  }

  function classifyDetached(ship,components){
    prepareShip(ship);
    const sourceMass=Math.max(1,massOf((ship.cells||[]).filter(c=>!c.detachedGone)));
    const large=[],small=[];
    for(const comp of components||[]){
      if(!comp||!comp.length)continue;
      const ratio=massOf(comp)/sourceMass;
      if(ratio>=LARGE_CHUNK_RATIO){large.push(createChunk(ship,comp,sourceMass));}
      else small.push(comp);
    }
    return{large,small};
  }

  function updateChunk(chunk,dt){
    chunk.age=(chunk.age||0)+dt;
    const frames=dt*60;
    const drag=Math.pow(.965,frames);
    chunk.vx=(chunk.vx||0)*drag;chunk.vy=(chunk.vy||0)*drag;
    chunk.angularVelocity=(chunk.angularVelocity||0)*Math.pow(.975,frames);
    const buoyancy=clamp(Number(chunk.buoyancy)||0,0,1)*(1-clamp(Number(chunk.water)||0,0,1));
    chunk.water=clamp((chunk.water||0)+dt*(.018+.026*(1-buoyancy)),0,1);
    const netSink=Math.max(-10,32*(.58-buoyancy)+24*chunk.water);
    chunk.vy+=netSink*dt;
    chunk.x+=chunk.vx*dt;chunk.y+=chunk.vy*dt;chunk.rotation+=(chunk.angularVelocity||0)*dt;
    chunk.sinkProgress=clamp((chunk.water-.42)/.58,0,1);
    if(chunk.sinkProgress>.98||chunk.age>18)chunk.phase='gone';
  }

  function updateChunks(state,dt){
    if(!state)return;
    if(!Array.isArray(state.structuralChunks))state.structuralChunks=[];
    const ships=[state.player,...(state.enemies||[])];
    for(const ship of ships){
      if(!ship)continue;prepareShip(ship);processQueue(ship);
      for(const chunk of ship.structuralChunks){if(!chunk.__v99Globalized){chunk.__v99Globalized=true;state.structuralChunks.push(chunk);}}
    }
    if(state.structuralChunks.length>MAX_GLOBAL_CHUNKS)state.structuralChunks.splice(0,state.structuralChunks.length-MAX_GLOBAL_CHUNKS);
    for(const chunk of state.structuralChunks)updateChunk(chunk,dt);
    state.structuralChunks=state.structuralChunks.filter(c=>c.phase!=='gone');
  }

  const B=root.V8Battle;
  if(B&&!B.__v99StructureWrapped){
    B.__v99StructureWrapped=true;
    const originalNewGame=typeof B.newGame==='function'?B.newGame:null;
    const originalUpdate=typeof B.update==='function'?B.update:null;
    if(originalNewGame)B.newGame=function(){
      const state=originalNewGame();
      const originalDestroyed=state&&state.onCellDestroyed;
      if(state)state.onCellDestroyed=function(ship,cell,pos,p){
        if(typeof originalDestroyed==='function')originalDestroyed(ship,cell,pos,p);
        if(cell&&cell.type==='powder')applyPowderFatigue(ship,cell);
      };
      return state;
    };
    if(originalUpdate)B.update=function(state,dt){originalUpdate(state,dt);if(state&&dt>0)updateChunks(state,dt);};
  }

  root.V99Structure={LOCAL_RADIUS,MAX_OVERLOAD_NODES,LARGE_CHUNK_RATIO,MAX_GLOBAL_CHUNKS,prepareShip,structuralCapacityFor,localCells,solveLocal,queueLocalSolve,processQueue,applyPowderFatigue,classifyDetached,updateChunk,updateChunks};
})(typeof globalThis!=='undefined'?globalThis:this);
