(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle||null;
  if(!G)throw new Error('V10.1 progressive break requires V8ShipGrid');

  const WARNING_RATIO=1.0;
  const YIELD_RATIO=1.20;
  const TEAR_RATIO=1.35;
  const SNAP_RATIO=1.55;
  const YIELD_HOLD=.25;
  const TEAR_HOLD=.55;
  const MIN_TEAR_DELAY=.60;
  const MAX_TEAR_DELAY=2.0;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function prepareShip(ship){
    if(!ship)return ship;
    const count=(root.V100Bending&&root.V100Bending.SECTION_COUNT)||12;
    if(!Array.isArray(ship.__v101BreakSections)||ship.__v101BreakSections.length!==count){
      ship.__v101BreakSections=[];
      for(let i=0;i<count;i++)ship.__v101BreakSections.push({index:i,stage:'stable',yieldTime:0,tearTime:0,fxT:0,separated:false});
    }
    if(!Number.isFinite(ship.__v101CriticalSection))ship.__v101CriticalSection=-1;
    if(!Number.isFinite(ship.__v101CriticalRatio))ship.__v101CriticalRatio=0;
    if(typeof ship.__v101BreakStage!=='string')ship.__v101BreakStage='stable';
    if(!ship.__v101BendVisual)ship.__v101BendVisual={amount:0,angle:0,section:-1,stage:'stable'};
    return ship;
  }

  function regionName(index,count){
    if(!(index>=0))return '无';
    const t=(index+.5)/Math.max(1,count);
    if(t<.34)return '船尾';
    if(t>.66)return '船头';
    return '船腰';
  }

  function sectionWorld(ship,sec){
    if(sec&&sec.crackSeed&&typeof G.cellCenterWorld==='function')return G.cellCenterWorld(ship,sec.crackSeed);
    let x=0,y=0,n=0;
    for(const c of sec&&sec.members||[]){
      if(!c||c.detachedGone)continue;
      const p=typeof G.cellCenterWorld==='function'?G.cellCenterWorld(ship,c):{x:ship.x,y:ship.y};x+=p.x;y+=p.y;n++;
      if(n>=8)break;
    }
    return n?{x:x/n,y:y/n}:{x:ship.x,y:ship.y};
  }

  function tearDelay(ratio){
    return clamp(MAX_TEAR_DELAY-(Math.max(0,ratio-TEAR_RATIO))*2.6,MIN_TEAR_DELAY,MAX_TEAR_DELAY);
  }

  function stageFor(state,ratio){
    if(state.separated)return 'separated';
    if(state.tearTime>0&&(ratio>=TEAR_RATIO||state.yieldTime>=TEAR_HOLD))return 'tearing';
    if(ratio>=YIELD_RATIO&&state.yieldTime>=YIELD_HOLD*.35)return 'yielding';
    if(ratio>=WARNING_RATIO)return 'warning';
    return 'stable';
  }

  function addTearFx(state,ship,sec,sectionState,ratio){
    if(!state||!state.fx||!sec||sectionState.fxT>0)return;
    const pos=sectionWorld(ship,sec),stage=sectionState.stage;
    if(stage==='yielding'||stage==='tearing'){
      state.fx.push({k:'structureRupture',x:pos.x,y:pos.y,t:0,dur:.34,r:stage==='tearing'?45:26});
      const count=stage==='tearing'?4:2;
      for(let i=0;i<count;i++)state.fx.push({k:'splinter',x:pos.x,y:pos.y,vx:(Math.random()-.5)*(90+ratio*45),vy:-35-Math.random()*80,t:0,dur:.42+Math.random()*.28,r:2.5+Math.random()*3,rot:Math.random()*Math.PI*2,vr:(Math.random()-.5)*8});
      if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);
      sectionState.fxT=stage==='tearing'?.16:.32;
    }
  }

  function updateSection(state,ship,sec,sectionState,dt){
    const ratio=Math.max(0,Number(sec&&sec.ratio)||0);
    sectionState.fxT=Math.max(0,(sectionState.fxT||0)-dt);
    sectionState.yieldTime=ratio>=YIELD_RATIO?(sectionState.yieldTime||0)+dt:Math.max(0,(sectionState.yieldTime||0)-dt*1.4);
    const tearingCondition=ratio>=TEAR_RATIO||sectionState.yieldTime>=TEAR_HOLD;
    sectionState.tearTime=tearingCondition?(sectionState.tearTime||0)+dt:Math.max(0,(sectionState.tearTime||0)-dt*.9);
    sectionState.stage=stageFor(sectionState,ratio);
    addTearFx(state,ship,sec,sectionState,ratio);

    if(!sectionState.separated&&sectionState.stage==='tearing'){
      const delay=ratio>=SNAP_RATIO?MIN_TEAR_DELAY:tearDelay(ratio);
      if(sectionState.tearTime>=delay){
        const Bend=root.V100Bending||null;
        if(Bend&&typeof Bend.forceSectionBreak==='function')Bend.forceSectionBreak(ship,sec.index);
        sectionState.separated=true;sectionState.stage='separated';
      }
    }
    return ratio;
  }

  function evaluate(state,ship,dt){
    if(!ship||ship.state==='gone'||!(dt>0))return null;
    prepareShip(ship);
    const Bend=root.V100Bending||null;
    let sections=ship.__v100BendingSections||[];
    if(Bend&&typeof Bend.rebuildSections==='function'&&(!sections.length||ship.__v100BendingDirty))sections=Bend.rebuildSections(ship);
    if(!sections.length)return null;

    let critical=-1,maxRatio=0;
    for(let i=0;i<sections.length;i++){
      const ratio=updateSection(state,ship,sections[i],ship.__v101BreakSections[i],dt);
      if(ratio>maxRatio){maxRatio=ratio;critical=i;}
    }
    const criticalState=critical>=0?ship.__v101BreakSections[critical]:null;
    const stage=criticalState?criticalState.stage:'stable';
    const amount=stage==='tearing'?clamp(.42+(criticalState.tearTime||0)*.28,.42,1):stage==='yielding'?.24:stage==='warning'?.08:0;
    const sign=(critical%2===0?1:-1);
    ship.__v101CriticalSection=critical;
    ship.__v101CriticalRatio=maxRatio;
    ship.__v101BreakStage=stage;
    ship.__v101CriticalRegion=regionName(critical,sections.length);
    ship.__v101BendVisual={amount,angle:sign*amount*.028,section:critical,stage};
    return {section:critical,ratio:maxRatio,stage,region:ship.__v101CriticalRegion};
  }

  if(B&&typeof B.update==='function'&&!B.__v101ProgressiveBreakWrapped){
    B.__v101ProgressiveBreakWrapped=true;
    const originalUpdate=B.update;
    B.update=function(state,dt){
      originalUpdate(state,dt);if(!state||!(dt>0))return;
      evaluate(state,state.player,dt);for(const ship of state.enemies||[])evaluate(state,ship,dt);
    };
  }

  root.V101ProgressiveBreak={WARNING_RATIO,YIELD_RATIO,TEAR_RATIO,SNAP_RATIO,YIELD_HOLD,TEAR_HOLD,MIN_TEAR_DELAY,MAX_TEAR_DELAY,prepareShip,regionName,tearDelay,evaluate};
})(typeof globalThis!=='undefined'?globalThis:this);
