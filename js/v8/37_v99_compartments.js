(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G)throw new Error('V9.9 compartments requires V8ShipGrid');

  const COMPARTMENT_COUNT={sloop:4,gunship:5,manowar:6,player:8};
  const BREACH_WEIGHT={hull:1,deck:.34,beam:.56,core:.60};
  const MAX_OPEN_SEARCH=14;
  const BASE_LEAK=.0024;
  const SUBMERGED_LEAK_RATE=.00105;
  const TRANSFER_RATE=.075;
  const FLOW_STEP=.14;
  const MAX_FLOW_STEPS=2;
  const ELIGIBLE=new Set(['hull','deck','beam','core']);
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

  function clamp01(v){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0));}
  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function key(gx,gy){return gx+','+gy;}
  function weightOf(c){return (G.CELL_WEIGHT&&G.CELL_WEIGHT[c&&c.type])||c&&c.weight||1;}
  function countFor(ship){return COMPARTMENT_COUNT[ship&&ship.kind]||5;}
  function longitudinalCoord(ship,cell){return ship.kind==='player'?cell.gy:cell.gx;}
  function longitudinalSize(ship){return ship.kind==='player'?ship.gridHeight:ship.gridWidth;}
  function transverseHalf(ship){return Math.max(1,(ship.kind==='player'?ship.gridWidth:ship.gridHeight)*(ship.cellSize||8)*.5);}

  function compartmentIndex(ship,cell){
    const count=countFor(ship),size=Math.max(1,longitudinalSize(ship));
    return Math.max(0,Math.min(count-1,Math.floor(longitudinalCoord(ship,cell)/size*count)));
  }

  function newCompartment(i,old){
    old=old||{};
    return {
      index:i,water:clamp01(old.water||0),capacityWeight:0,breachWeight:0,
      centerLocal:{x:0,y:0},breachCenterLocal:{x:0,y:0},breachCount:0,
      inflowRate:0,transferIn:0,transferOut:0,
      submergedOpenings:Math.max(0,Number(old.submergedOpenings)||0),
      waterSide:clamp(Number(old.waterSide)||0,-1,1),
      __v101ImmersionSeverity:Math.max(0,Number(old.__v101ImmersionSeverity)||0)
    };
  }

  function prepareShip(ship){
    if(!ship)return ship;
    const count=countFor(ship);
    if(!Array.isArray(ship.__v99BreachCandidates))ship.__v99BreachCandidates=[];
    if(!Array.isArray(ship.__v99OpenBreaches))ship.__v99OpenBreaches=[];
    if(!Number.isFinite(ship.__v101FlowAccumulator))ship.__v101FlowAccumulator=0;
    for(const c of ship.cells||[])c.__v99WasPhysical=true;
    if(!Array.isArray(ship.__v99Compartments)||ship.__v99Compartments.length!==count){
      const previous=ship.__v99Compartments||[],comps=[];
      for(let i=0;i<count;i++)comps.push(newCompartment(i,previous[i]));
      for(const cell of ship.cells||[]){
        const i=compartmentIndex(ship,cell),comp=comps[i],w=weightOf(cell);
        const p=typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,cell):{x:(cell.gx+.5-ship.gridWidth/2)*(ship.cellSize||8),y:(cell.gy+.5-ship.gridHeight/2)*(ship.cellSize||8)};
        comp.capacityWeight+=w;comp.centerLocal.x+=p.x*w;comp.centerLocal.y+=p.y*w;
      }
      for(const comp of comps){const w=Math.max(.001,comp.capacityWeight);comp.centerLocal.x/=w;comp.centerLocal.y/=w;}
      ship.__v99Compartments=comps;ship.__v99TransferLinks=[];ship.__v99CompartmentRevision=-1;
    }else{
      for(const comp of ship.__v99Compartments){
        if(!Number.isFinite(comp.inflowRate))comp.inflowRate=0;
        if(!Number.isFinite(comp.transferIn))comp.transferIn=0;
        if(!Number.isFinite(comp.transferOut))comp.transferOut=0;
        if(!Number.isFinite(comp.submergedOpenings))comp.submergedOpenings=0;
        if(!Number.isFinite(comp.waterSide))comp.waterSide=0;
        if(!Number.isFinite(comp.__v101ImmersionSeverity))comp.__v101ImmersionSeverity=0;
      }
    }
    if(!Number.isFinite(ship.__v99LastTopologyRevision))ship.__v99LastTopologyRevision=-1;
    if(!Number.isFinite(ship.floodLevel))ship.floodLevel=0;
    if(!Number.isFinite(ship.leakRate))ship.leakRate=0;
    return ship;
  }

  function directExteriorOpening(ship,cell){
    if(!ship||!cell||cell.alive||cell.detachedGone)return false;
    for(const [dx,dy] of DIRS){if(!(ship.cellMap&&ship.cellMap[key(cell.gx+dx,cell.gy+dy)]))return true;}
    return false;
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
        const b=compartmentIndex(ship,n);if(a===b)continue;
        links.add(Math.min(a,b)+':'+Math.max(a,b));
      }
    }
    ship.__v99TransferLinks=[...links].map(s=>s.split(':').map(Number));
  }

  function refreshBreaches(ship){
    prepareShip(ship);
    const topology=Number(ship.__v99TopologyRevision)||0;
    if(ship.__v99LastTopologyRevision===topology&&ship.__v99CompartmentRevision===topology)return ship.__v99OpenBreaches;
    const open=[];
    for(const c of ship.cells||[]){
      if(c.alive||c.detachedGone||!ELIGIBLE.has(c.type))continue;
      c.__v99OpenWater=isOpenWaterBreach(ship,c);c.__v99DirectExterior=directExteriorOpening(ship,c);
      if(c.__v99OpenWater&&c.__v99DirectExterior)open.push(c);
    }
    ship.__v99OpenBreaches=open;
    for(const comp of ship.__v99Compartments){comp.breachWeight=0;comp.breachCount=0;comp.breachCenterLocal={x:0,y:0};}
    for(const c of open){
      const comp=ship.__v99Compartments[compartmentIndex(ship,c)],w=BREACH_WEIGHT[c.type]||0;if(!(w>0))continue;
      const p=typeof G.cellCenterLocal==='function'?G.cellCenterLocal(ship,c):{x:(c.gx+.5-ship.gridWidth/2)*(ship.cellSize||8),y:(c.gy+.5-ship.gridHeight/2)*(ship.cellSize||8)};
      comp.breachWeight+=w;comp.breachCount++;comp.breachCenterLocal.x+=p.x*w;comp.breachCenterLocal.y+=p.y*w;
    }
    for(const comp of ship.__v99Compartments){if(comp.breachWeight>0){comp.breachCenterLocal.x/=comp.breachWeight;comp.breachCenterLocal.y/=comp.breachWeight;}}
    buildTransferLinks(ship);ship.__v99LastTopologyRevision=topology;ship.__v99CompartmentRevision=topology;return open;
  }

  function transferWater(ship,dt){
    const comps=ship.__v99Compartments||[];
    for(const comp of comps){comp.transferIn=0;comp.transferOut=0;}
    const trim=clamp(Number(ship.__v99Trim)||0,-.8,.8);
    for(const pair of ship.__v99TransferLinks||[]){
      const a=comps[pair[0]],b=comps[pair[1]];if(!a||!b)continue;
      const pa=ship.kind==='player'?(a.centerLocal&&a.centerLocal.y||0):(a.centerLocal&&a.centerLocal.x||0);
      const pb=ship.kind==='player'?(b.centerLocal&&b.centerLocal.y||0):(b.centerLocal&&b.centerLocal.x||0);
      const gravityBias=Math.sign(pb-pa)*trim*.12,diff=(a.water-b.water)-gravityBias;if(Math.abs(diff)<.002)continue;
      const amount=Math.min(Math.abs(diff)*.5,TRANSFER_RATE*dt*(1+Math.min(.35,Math.abs(trim))));if(!(amount>0))continue;
      const from=diff>0?a:b,to=diff>0?b:a,flow=Math.min(amount,from.water,1-to.water);if(!(flow>0))continue;
      from.water=clamp01(from.water-flow);to.water=clamp01(to.water+flow);from.transferOut+=flow/dt;to.transferIn+=flow/dt;
      to.waterSide=clamp((from.waterSide||0)*.35+(to.waterSide||0)*.65,-1,1);
    }
  }

  function stepTransferWater(ship,dt){
    ship.__v101FlowAccumulator=Math.min(FLOW_STEP*3,(ship.__v101FlowAccumulator||0)+dt);
    let steps=0;
    while(ship.__v101FlowAccumulator>=FLOW_STEP&&steps<MAX_FLOW_STEPS){transferWater(ship,FLOW_STEP);ship.__v101FlowAccumulator-=FLOW_STEP;steps++;}
    if(!steps)for(const comp of ship.__v99Compartments||[]){comp.transferIn=0;comp.transferOut=0;}
  }

  function updateShip(state,ship,dt){
    if(!ship||ship.state==='gone'||ship.state==='wrecked'||!(dt>0))return;
    prepareShip(ship);refreshBreaches(ship);
    let totalRate=0,totalCap=0,weightedWater=0;const half=transverseHalf(ship);
    for(const comp of ship.__v99Compartments){
      const pressure=.88+comp.water*.45;
      const transverse=ship.kind==='player'?comp.breachCenterLocal.x:comp.breachCenterLocal.y;
      const exposure=comp.breachWeight>0?.92+Math.min(.22,Math.abs(transverse)/half*.22):0;
      const directRate=comp.breachWeight*BASE_LEAK*pressure*exposure;
      const openings=Math.max(0,Number(comp.submergedOpenings)||0),severity=Math.max(0,Number(comp.__v101ImmersionSeverity)||0);
      const immersedRate=SUBMERGED_LEAK_RATE*(openings*.55+severity*.75)*(1+comp.water*.30);
      const rate=directRate+immersedRate;comp.inflowRate=rate;
      if(rate>0&&ship.state==='active'){
        const oldWater=comp.water;comp.water=clamp01(comp.water+rate*dt);
        if(comp.water>oldWater){
          let side=0;if(comp.breachWeight>0)side=clamp(transverse/half,-1,1);else if(openings>0)side=clamp(Number(comp.__v100ImmersionSide)||0,-1,1);
          const blend=Math.min(.35,(comp.water-oldWater)/Math.max(.001,comp.water)*2.5);comp.waterSide=clamp((comp.waterSide||0)*(1-blend)+side*blend,-1,1);
        }
      }
      totalRate+=rate*comp.capacityWeight;
    }
    stepTransferWater(ship,dt);
    for(const comp of ship.__v99Compartments){totalCap+=comp.capacityWeight;weightedWater+=comp.water*comp.capacityWeight;}
    ship.floodLevel=totalCap>0?clamp01(weightedWater/totalCap):0;ship.leakRate=totalCap>0?totalRate/totalCap:0;
    ship.__v97LeakCount=ship.__v99OpenBreaches.length+ship.__v99Compartments.reduce((s,c)=>s+(c.submergedOpenings||0),0);
    ship.__v97LeakWeight=ship.__v99Compartments.reduce((s,c)=>s+c.breachWeight,0);
    ship.floodSpeedMultiplier=Math.max(.38,1-Math.max(0,(ship.floodLevel-.08)/.92)*.56);
    if(ship.side==='enemy'){
      if(!Number.isFinite(ship.__v99DrySpeed))ship.__v99DrySpeed=ship.baseSpeed||ship.speed||0;
      const base=ship.baseSpeed||ship.__v99DrySpeed||0,mast=Number.isFinite(ship.mastEfficiency)?ship.mastEfficiency:(ship.mastAlive===false?.75:1),rudder=Number.isFinite(ship.rudderEfficiency)?ship.rudderEfficiency:(ship.rudderAlive===false?.55:1);
      if(base>0)ship.speed=Math.max(base*.22,base*mast*rudder*ship.floodSpeedMultiplier);
    }
  }

  const originalDamageCell=G.damageCell;
  G.damageCell=function(ship,cell,damage){const res=originalDamageCell(ship,cell,damage);if(res&&res.destroyed&&ship&&cell){prepareShip(ship);ship.__v99BreachCandidates.push(cell);}return res;};

  if(B&&!B.__v99CompartmentsWrapped){
    B.__v99CompartmentsWrapped=true;
    const originalNewGame=typeof B.newGame==='function'?B.newGame:null,originalSpawn=typeof B.spawnEnemy==='function'?B.spawnEnemy:null,originalUpdate=typeof B.update==='function'?B.update:null;
    if(originalNewGame)B.newGame=function(){const state=originalNewGame();prepareShip(state.player);for(const s of state.enemies||[])prepareShip(s);return state;};
    if(originalSpawn)B.spawnEnemy=function(state,kind,opts){return prepareShip(originalSpawn(state,kind,opts));};
    if(originalUpdate)B.update=function(state,dt){originalUpdate(state,dt);if(!state||!(dt>0))return;updateShip(state,state.player,dt);for(const s of state.enemies||[])updateShip(state,s,dt);};
  }

  root.V99Compartments={COMPARTMENT_COUNT,BREACH_WEIGHT,MAX_OPEN_SEARCH,BASE_LEAK,SUBMERGED_LEAK_RATE,TRANSFER_RATE,FLOW_STEP,prepareShip,compartmentIndex,directExteriorOpening,isOpenWaterBreach,refreshBreaches,buildTransferLinks,transferWater,stepTransferWater,updateShip};
})(typeof globalThis!=='undefined'?globalThis:this);
