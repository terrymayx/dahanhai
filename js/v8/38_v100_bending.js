(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V10 bending requires V8ShipGrid');

  const SECTION_COUNT=12;
  const BEND_FATIGUE_RATIO=.85;
  const BEND_CRACK_RATIO=1;
  const BEND_BREAK_RATIO=1.20;
  const BEND_SNAP_RATIO=1.55;
  const BREAK_DELAY=.72;
  const STRUCTURAL_TYPES=new Set(['hull','deck','beam','core']);

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function weightOf(c){return (G.CELL_WEIGHT&&G.CELL_WEIGHT[c&&c.type])||c&&c.weight||1;}
  function longitudinalCoord(ship,cell){return ship&&ship.kind==='player'?cell.gy:cell.gx;}
  function longitudinalSize(ship){return Math.max(1,ship&&ship.kind==='player'?ship.gridHeight:ship.gridWidth);}
  function sectionFor(ship,cell){return clamp(Math.floor(longitudinalCoord(ship,cell)/longitudinalSize(ship)*SECTION_COUNT),0,SECTION_COUNT-1);}

  function prepareShip(ship){
    if(!ship)return ship;
    if(!Array.isArray(ship.__v100BendingSections))ship.__v100BendingSections=[];
    if(!Number.isFinite(ship.__v100BendingRevision))ship.__v100BendingRevision=-1;
    if(!Number.isFinite(ship.__v100BendingWaterSignature))ship.__v100BendingWaterSignature=-1;
    if(!Number.isFinite(ship.__v100MaxBendingRatio))ship.__v100MaxBendingRatio=0;
    if(ship.__v100BendingDirty==null)ship.__v100BendingDirty=true;
    return ship;
  }

  function waterSignature(ship){
    let s=0,i=1;
    for(const c of ship&&ship.__v99Compartments||[]){s+=Math.round((Number(c.water)||0)*20)*i;i+=3;}
    return s;
  }

  function markDirty(ship,reason){
    if(!ship)return;
    prepareShip(ship);
    ship.__v100BendingDirty=true;
    ship.__v100BendingDirtyReason=reason||'event';
  }

  function currentCapacity(cell){
    const S=root.V99Structure||null;
    if(S&&typeof S.structuralCapacityFor==='function')return S.structuralCapacityFor(cell);
    const hp=clamp((Number(cell.hp)||0)/Math.max(1,Number(cell.maxHp)||1),0,1);
    return (cell.type==='core'?4.2:cell.type==='beam'?3.4:cell.type==='hull'?1.4:1)*Math.max(.08,hp);
  }

  function healthyCapacity(cell){
    return cell.type==='core'?4.2:cell.type==='beam'?3.4:cell.type==='hull'?1.4:1;
  }

  function rebuildSections(ship){
    prepareShip(ship);
    const size=longitudinalSize(ship),sections=[];
    for(let i=0;i<SECTION_COUNT;i++)sections.push({index:i,start:i/SECTION_COUNT*size,end:(i+1)/SECTION_COUNT*size,mass:0,massLeft:0,massRight:0,leverLeft:0,leverRight:0,waterMoment:0,buoyancySupport:0,capacity:0,healthyCapacity:0,ratio:0,overloadTime:0,members:[],crackSeed:null});

    let totalMass=0;
    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.detachedGone)continue;
      const idx=sectionFor(ship,cell),sec=sections[idx],w=weightOf(cell);
      sec.mass+=w;totalMass+=w;
      if(STRUCTURAL_TYPES.has(cell.type)){
        sec.members.push(cell);
        sec.capacity+=currentCapacity(cell);
        sec.healthyCapacity+=healthyCapacity(cell);
        if(!sec.crackSeed||((cell.crackDepth||0)+(cell.fatigue||0))>((sec.crackSeed.crackDepth||0)+(sec.crackSeed.fatigue||0)))sec.crackSeed=cell;
      }
    }

    const prefixMass=new Array(SECTION_COUNT+1).fill(0);
    for(let i=0;i<SECTION_COUNT;i++)prefixMass[i+1]=prefixMass[i]+sections[i].mass;
    for(let i=0;i<SECTION_COUNT;i++){
      const sec=sections[i],center=i+.5;
      sec.massLeft=prefixMass[i];sec.massRight=totalMass-prefixMass[i+1];
      let ll=0,rr=0;
      for(let j=0;j<i;j++)ll+=sections[j].mass*(center-(j+.5));
      for(let j=i+1;j<SECTION_COUNT;j++)rr+=sections[j].mass*((j+.5)-center);
      sec.leverLeft=ll/Math.max(1,SECTION_COUNT);sec.leverRight=rr/Math.max(1,SECTION_COUNT);
    }

    let totalCompCap=0;
    for(const comp of ship.__v99Compartments||[])totalCompCap+=Math.max(0,Number(comp.capacityWeight)||0);
    for(const comp of ship.__v99Compartments||[]){
      const p=comp.centerLocal||{x:0,y:0};
      const localLong=ship.kind==='player'?p.y:p.x;
      const normalized=(localLong/(size*(ship.cellSize||8))+.5);
      const idx=clamp(Math.floor(normalized*SECTION_COUNT),0,SECTION_COUNT-1),sec=sections[idx];
      const cap=Math.max(0,Number(comp.capacityWeight)||0),water=clamp(Number(comp.water)||0,0,1);
      sec.waterMoment+=cap*water/Math.max(1,totalCompCap);
      sec.buoyancySupport+=cap*(1-water)/Math.max(1,totalCompCap);
    }

    for(const sec of sections){
      const span=1-Math.abs((sec.index+.5)-SECTION_COUNT/2)/(SECTION_COUNT/2);
      const asym=Math.abs(sec.leverLeft-sec.leverRight)/Math.max(1,totalMass);
      const capacityRatio=sec.healthyCapacity>0?clamp(sec.capacity/sec.healthyCapacity,.06,1):.08;
      const crackWeak=sec.members.length?sec.members.reduce((s,c)=>s+(c.crackDepth||0)*.5+(c.fracture||0)*.3+(c.fatigue||0)*.2,0)/sec.members.length:0;
      const demand=.28+span*.20+asym*.42+sec.waterMoment*.95+Math.max(0,.05-sec.buoyancySupport)*1.2;
      sec.ratio=demand/Math.max(.07,capacityRatio*(1-crackWeak*.42));
    }

    const old=ship.__v100BendingSections||[];
    for(let i=0;i<sections.length;i++)sections[i].overloadTime=old[i]&&Number(old[i].overloadTime)||0;
    ship.__v100BendingSections=sections;
    ship.__v100BendingRevision=Number(ship.__v99TopologyRevision)||0;
    ship.__v100BendingMaterialRevision=Number(ship.__v99MaterialRevision)||0;
    ship.__v100BendingCrackRevision=Number(ship.__v100CrackRevision)||0;
    ship.__v100BendingWaterSignature=waterSignature(ship);
    ship.__v100BendingDirty=false;
    ship.__v100BendingDirtyReason='';
    return sections;
  }

  function needsRebuild(ship){
    prepareShip(ship);
    return ship.__v100BendingDirty||
      ship.__v100BendingRevision!==(Number(ship.__v99TopologyRevision)||0)||
      ship.__v100BendingMaterialRevision!==(Number(ship.__v99MaterialRevision)||0)||
      ship.__v100BendingCrackRevision!==(Number(ship.__v100CrackRevision)||0)||
      ship.__v100BendingWaterSignature!==waterSignature(ship)||
      ship.__v100BendingSections.length!==SECTION_COUNT;
  }

  function forceSectionBreak(ship,sectionIndex){
    if(!ship||ship.state==='gone')return [];
    const sections=needsRebuild(ship)?rebuildSections(ship):ship.__v100BendingSections;
    const sec=sections[clamp(sectionIndex|0,0,SECTION_COUNT-1)];if(!sec)return [];
    const targets=sec.members.filter(c=>c.alive&&!c.detachedGone).sort((a,b)=>((b.crackDepth||0)+(b.fatigue||0)+(b.fracture||0))-((a.crackDepth||0)+(a.fatigue||0)+(a.fracture||0)));
    const broken=[];
    const maxTargets=Math.max(2,Math.min(8,Math.ceil(targets.length*.55)));
    for(const cell of targets.slice(0,maxTargets)){
      const remaining=Math.max(0,Number(cell.hp)||0);
      const damage=Math.max(4,remaining*(cell.type==='beam'||cell.type==='core'?.72:.58));
      const res=G.damageCell(ship,cell,damage);
      if(res&&res.destroyed)broken.push(cell);
    }
    if(broken.length){ship.__v96NeedsStructuralCleanup=true;ship.__v100BendingBreakSection=sec.index;markDirty(ship,'section-break');}
    return broken;
  }

  function evaluate(ship,dt){
    if(!ship||ship.state==='gone'||!(dt>0))return [];
    const sections=needsRebuild(ship)?rebuildSections(ship):ship.__v100BendingSections;
    const F=root.V100Fracture||null;
    let maxRatio=0;const changed=[];
    for(const sec of sections){
      const ratio=Number(sec.ratio)||0;maxRatio=Math.max(maxRatio,ratio);
      if(ratio>BEND_FATIGUE_RATIO&&sec.members.length){
        const weak=sec.members.slice().sort((a,b)=>((b.crackDepth||0)+(b.fatigue||0))-((a.crackDepth||0)+(a.fatigue||0))).slice(0,2);
        for(const cell of weak){cell.fatigue=clamp((cell.fatigue||0)+Math.min(.0025,(ratio-BEND_FATIGUE_RATIO)*.0018),0,1);changed.push(cell);}
      }
      if(ratio>BEND_CRACK_RATIO&&F&&sec.crackSeed&&typeof F.seedImpact==='function'&&sec.__crackCooldown<=0){
        F.seedImpact(ship,sec.crackSeed,{vx:0,vy:0,power:24+(ratio-1)*80,grade:ratio>BEND_BREAK_RATIO?'heavy':'penetrated'});
        sec.__crackCooldown=.7;
      }
      sec.__crackCooldown=Math.max(0,(sec.__crackCooldown||0)-dt);
      sec.overloadTime=ratio>BEND_BREAK_RATIO?(sec.overloadTime||0)+dt:Math.max(0,(sec.overloadTime||0)-dt*.8);
      if(ratio>BEND_SNAP_RATIO||sec.overloadTime>=BREAK_DELAY){forceSectionBreak(ship,sec.index);sec.overloadTime=0;break;}
    }
    ship.__v100MaxBendingRatio=maxRatio;
    return changed;
  }

  const B=root.V8Battle||null;
  if(B&&typeof B.update==='function'&&!B.__v100BendingWrapped){
    B.__v100BendingWrapped=true;
    const originalUpdate=B.update;
    B.update=function(state,dt){
      originalUpdate(state,dt);
      if(!state||!(dt>0))return;
      evaluate(state.player,dt);
      for(const ship of state.enemies||[])evaluate(ship,dt);
    };
  }

  root.V100Bending={SECTION_COUNT,BEND_FATIGUE_RATIO,BEND_CRACK_RATIO,BEND_BREAK_RATIO,BEND_SNAP_RATIO,BREAK_DELAY,prepareShip,markDirty,rebuildSections,evaluate,forceSectionBreak};
})(typeof globalThis!=='undefined'?globalThis:this);
