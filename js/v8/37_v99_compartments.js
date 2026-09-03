(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G)throw new Error('V9.9 compartments requires V8ShipGrid');

  const COMPARTMENT_COUNT={sloop:4,gunship:5,manowar:6,player:8};
  const BREACH_WEIGHT={hull:1,deck:.34,beam:.56,core:.60};
  const MAX_OPEN_SEARCH=14;
  const BASE_LEAK=.0024;
  const TRANSFER_RATE=.075;
  const ELIGIBLE=new Set(['hull','deck','beam','core']);
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

  function clamp01(v){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0));}
  function key(gx,gy){return gx+','+gy;}
  function weightOf(c){return (G.CELL_WEIGHT&&G.CELL_WEIGHT[c&&c.type])||c&&c.weight||1;}
  function countFor(ship){return COMPARTMENT_COUNT[ship&&ship.kind]||5;}
  function longitudinalCoord(ship,cell){return ship.kind==='player'?cell.gy:cell.gx;}
  function longitudinalSize(ship){return ship.kind==='player'?ship.gridHeight:ship.gridWidth;}

  function compartmentIndex(ship,cell){
    const count=countFor(ship),size=Math.max(1,longitudinalSize(ship));
    return Math.max(0,Math.min(count-1,Math.floor(longitudinalCoord(ship,cell)/size*count)));
  }

  function prepareShip(ship){
    if(!ship)return ship;
    const count=countFor(ship);
    if(!Array.isArray(ship.__v99BreachCandidates))ship.__v99BreachCandidates=[];
    if(!Array.isArray(ship.__v99OpenBreaches))ship.__v99OpenBreaches=[];
    for(const c of ship.cells||[])c.__v99WasPhysical=true;
    if(!Array.isArray(ship.__v99Compartments)||ship.__v99Compartments.length!==count){
      const previous=ship.__v99Compartments||[];
      const comps=[];
      for(let i=0;i<count;i++)comps.push({index:i,water:clamp01(previous[i]&&previous[i].water||0),capacityWeight:0,breachWeight:0,centerLocal:{x:0,y:0},breachCenterLocal:{x:0,y:0},breachCount:0});
      for(const cell of ship.cells||[]){
        const i=compartmentIndex(ship,cell),comp=comps[i],w=weightOf(cell);
        const p=typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,cell):{x:(cell.gx+.5-ship.gridWidth/2)*(ship.cellSize||8),y:(cell.gy+.5-ship.gridHeight/2)*(ship.cellSize||8)};
        comp.capacityWeight+=w;comp.centerLocal.x+=p.x*w;comp.centerLocal.y+=p.y*w;
      }
      for(const comp of comps){
        const w=Math.max(.001,comp.capacityWeight);comp.centerLocal.x/=w;comp.centerLocal.y/=w;
      }
      ship.__v99Compartments=comps;
      ship.__v99TransferLinks=[];
      ship.__v99CompartmentRevision=-1;
    }
    if(!Number.isFinite(ship.__v99LastTopologyRevision))ship.__v99LastTopologyRevision=-1;
    if(!Number.isFinite(ship.floodLevel))ship.floodLevel=0;
    if(!Number.isFinite(ship.leakRate))ship.leakRate=0;
    return ship;
  }

  function isOpenWaterBreach(ship,start){
    if(!ship||!start||start.alive||start.detachedGone||!ELIGIBLE.has(start.type))return false;
    const q=[start],seen=new Set([key(start.gx,start.gy)]),sx=start.gx,sy=start.gy;
    for(let qi=0;qi<q.length;qi++){
      const c=q[qi];
      for(const [dx,dy] of DIRS){
        const gx=c.gx+dx,gy=c.gy+dy;
        if(Math.abs(gx-sx)>MAX_OPEN_SEARCH||Math.abs(gy-sy)>MAX_OPEN_SEARCH)continue;
        const k=key(gx,gy),n=ship.cellMap&&ship.cellMap[k];
        if(!n)return true;
        if(seen.has(k)||n.alive||n.detachedGone)continue;
        seen.add(k);q.push(n);
      }
    }
    return false;
  }

  function buildTransferLinks(ship){
    const links=new Set();
    for(const c of ship.cells||[]){
      if(c.alive||c.detachedGone)continue;
      const a=compartmentIndex(ship,c);
      for(const [dx,dy] of DIRS){
        const n=ship.cellMap&&ship.cellMap[key(c.gx+dx,c.gy+dy)];
        if(!n||n.alive||n.detachedGone)continue;
        const b=compartmentIndex(ship,n);
        if(a===b)continue;
        links.add(Math.min(a,b)+':'+Math.max(a,b));
      }
    }
    ship.__v99TransferLinks=[...links].map(s=>s.split(':').map(Number));
  }

  function refreshBreaches(ship){
    prepareShip(ship);
    const topology=Number(ship.__v99TopologyRevision)||0;
    if(ship.__v99LastTopologyRevision===topology&&ship.__v99CompartmentRevision===topology)return ship.__v99OpenBreaches;

    // Topology changes only when a cell truly reaches zero HP, so this full pass
    // is event-driven rather than per-frame. It also catches fire damage paths
    // that may bypass the outer V9.9 damage wrapper.
    const open=[];
    for(const c of ship.cells||[]){
      if(c.alive||c.detachedGone||!ELIGIBLE.has(c.type))continue;
      c.__v99OpenWater=isOpenWaterBreach(ship,c);
      if(c.__v99OpenWater)open.push(c);
    }
    ship.__v99OpenBreaches=open;
    for(const comp of ship.__v99Compartments){comp.breachWeight=0;comp.breachCount=0;comp.breachCenterLocal={x:0,y:0};}
    for(const c of open){
      const comp=ship.__v99Compartments[compartmentIndex(ship,c)],w=BREACH_WEIGHT[c.type]||0;
      if(!(w>0))continue;
      const p=typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,c):{x:(c.gx+.5-ship.gridWidth/2)*(ship.cellSize||8),y:(c.gy+.5-ship.gridHeight/2)*(ship.cellSize||8)};
      comp.breachWeight+=w;comp.breachCount++;
      comp.breachCenterLocal.x+=p.x*w;comp.breachCenterLocal.y+=p.y*w;
    }
    for(const comp of ship.__v99Compartments){
      if(comp.breachWeight>0){comp.breachCenterLocal.x/=comp.breachWeight;comp.breachCenterLocal.y/=comp.breachWeight;}
    }
    buildTransferLinks(ship);
    ship.__v99LastTopologyRevision=topology;
    ship.__v99CompartmentRevision=topology;
    return open;
  }

  function transferWater(ship,dt){
    const comps=ship.__v99Compartments||[];
    for(const pair of ship.__v99TransferLinks||[]){
      const a=comps[pair[0]],b=comps[pair[1]];if(!a||!b)continue;
      const diff=a.water-b.water;if(Math.abs(diff)<.002)continue;
      const flow=Math.sign(diff)*Math.min(Math.abs(diff)*.5,TRANSFER_RATE*dt);
      a.water=clamp01(a.water-flow);b.water=clamp01(b.water+flow);
    }
  }

  function updateShip(state,ship,dt){
    if(!ship||ship.state==='gone'||ship.state==='wrecked'||!(dt>0))return;
    prepareShip(ship);refreshBreaches(ship);
    let totalRate=0,totalCap=0,weightedWater=0;
    for(const comp of ship.__v99Compartments){
      const pressure=.88+comp.water*.45;
      const sideExtent=Math.max(1,(ship.kind==='player'?ship.gridWidth:ship.gridHeight)*(ship.cellSize||8)*.5);
      const transverse=ship.kind==='player'?comp.breachCenterLocal.x:comp.breachCenterLocal.y;
      const exposure=comp.breachWeight>0?.92+Math.min(.22,Math.abs(transverse)/sideExtent*.22):0;
      const rate=comp.breachWeight*BASE_LEAK*pressure*exposure;
      if(rate>0&&ship.state==='active')comp.water=clamp01(comp.water+rate*dt);
      totalRate+=rate*comp.capacityWeight;
    }
    transferWater(ship,dt);
    for(const comp of ship.__v99Compartments){totalCap+=comp.capacityWeight;weightedWater+=comp.water*comp.capacityWeight;}
    ship.floodLevel=totalCap>0?clamp01(weightedWater/totalCap):0;
    ship.leakRate=totalCap>0?totalRate/totalCap:0;
    ship.__v97LeakCount=ship.__v99OpenBreaches.length;
    ship.__v97LeakWeight=ship.__v99Compartments.reduce((s,c)=>s+c.breachWeight,0);
    ship.floodSpeedMultiplier=Math.max(.38,1-Math.max(0,(ship.floodLevel-.08)/.92)*.56);

    if(ship.side==='enemy'){
      if(!Number.isFinite(ship.__v99DrySpeed))ship.__v99DrySpeed=ship.baseSpeed||ship.speed||0;
      const base=ship.baseSpeed||ship.__v99DrySpeed||0;
      const mast=Number.isFinite(ship.mastEfficiency)?ship.mastEfficiency:(ship.mastAlive===false ? .75 : 1);
      const rudder=Number.isFinite(ship.rudderEfficiency)?ship.rudderEfficiency:(ship.rudderAlive===false ? .55 : 1);
      if(base>0)ship.speed=Math.max(base*.22,base*mast*rudder*ship.floodSpeedMultiplier);
    }
  }

  const originalDamageCell=G.damageCell;
  G.damageCell=function(ship,cell,damage){
    const res=originalDamageCell(ship,cell,damage);
    if(res&&res.destroyed&&ship&&cell){prepareShip(ship);ship.__v99BreachCandidates.push(cell);}
    return res;
  };

  if(B&&!B.__v99CompartmentsWrapped){
    B.__v99CompartmentsWrapped=true;
    const originalNewGame=typeof B.newGame==='function'?B.newGame:null;
    const originalSpawn=typeof B.spawnEnemy==='function'?B.spawnEnemy:null;
    const originalUpdate=typeof B.update==='function'?B.update:null;
    if(originalNewGame)B.newGame=function(){const state=originalNewGame();prepareShip(state.player);for(const s of state.enemies||[])prepareShip(s);return state;};
    if(originalSpawn)B.spawnEnemy=function(state,kind,opts){return prepareShip(originalSpawn(state,kind,opts));};
    if(originalUpdate)B.update=function(state,dt){originalUpdate(state,dt);if(!state||!(dt>0))return;updateShip(state,state.player,dt);for(const s of state.enemies||[])updateShip(state,s,dt);};
  }

  root.V99Compartments={COMPARTMENT_COUNT,BREACH_WEIGHT,MAX_OPEN_SEARCH,BASE_LEAK,TRANSFER_RATE,prepareShip,compartmentIndex,isOpenWaterBreach,refreshBreaches,buildTransferLinks,updateShip};
})(typeof globalThis!=='undefined'?globalThis:this);
