(function(root){
  'use strict';

  const B=root.V8Battle||null;
  const MAX_STRUCTURAL_CHUNKS=18;
  const MIN_SPLIT_CELLS=10;
  const MIN_CHILD_CELLS=4;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function prepareChunk(chunk){
    if(!chunk)return chunk;
    const cells=chunk.cells||[],mass=Math.max(.5,Number(chunk.mass)||cells.reduce((s,c)=>s+(Number(c.weight)||1),0)||1);
    if(!Number.isFinite(chunk.hitRadius))chunk.hitRadius=Math.max(18,Number(chunk.radius)||Math.sqrt(Math.max(1,cells.length))*(chunk.cellSize||8)*.72);
    if(!Number.isFinite(chunk.maxDurability))chunk.maxDurability=Math.max(18,mass*7.5+cells.length*2.2);
    if(!Number.isFinite(chunk.durability))chunk.durability=chunk.maxDurability;
    if(!Number.isFinite(chunk.fractureStrength))chunk.fractureStrength=0;
    if(!Number.isFinite(chunk.__v101HitFlash))chunk.__v101HitFlash=0;
    return chunk;
  }

  function segmentCircle(x0,y0,x1,y1,cx,cy,r){
    const dx=x1-x0,dy=y1-y0,l2=dx*dx+dy*dy;
    let t=l2>0?((cx-x0)*dx+(cy-y0)*dy)/l2:0;t=clamp(t,0,1);
    const x=x0+dx*t,y=y0+dy*t,d=Math.hypot(x-cx,y-cy);
    return d<=r?{t,x,y,d}:null;
  }

  function hitTestSegment(state,x0,y0,x1,y1){
    let best=null;
    for(const chunk of state&&state.structuralChunks||[]){
      if(!chunk||chunk.phase==='gone')continue;prepareChunk(chunk);
      const hit=segmentCircle(x0,y0,x1,y1,Number(chunk.x)||0,Number(chunk.y)||0,chunk.hitRadius);
      if(hit&&(!best||hit.t<best.t))best={chunk,t:hit.t,x:hit.x,y:hit.y};
    }
    return best;
  }

  function recenterCells(cells){
    if(!cells.length)return {cells:[],cx:0,cy:0};
    let sx=0,sy=0,sw=0;
    for(const c of cells){const w=Math.max(.1,Number(c.weight)||1);sx+=(Number(c.x)||0)*w;sy+=(Number(c.y)||0)*w;sw+=w;}
    const cx=sx/Math.max(.001,sw),cy=sy/Math.max(.001,sw);
    return {cx,cy,cells:cells.map(c=>Object.assign({},c,{x:(Number(c.x)||0)-cx,y:(Number(c.y)||0)-cy}))};
  }

  function childFrom(parent,cells,offset,index){
    const r=recenterCells(cells),rot=Number(parent.rotation)||0,co=Math.cos(rot),si=Math.sin(rot);
    const wx=(Number(parent.x)||0)+r.cx*co-r.cy*si,wy=(Number(parent.y)||0)+r.cx*si+r.cy*co;
    const mass=r.cells.reduce((s,c)=>s+(Number(c.weight)||1),0),powder=r.cells.filter(c=>c.type==='powder').length,burning=r.cells.some(c=>c.burning)||!!parent.burning;
    const child={
      id:(parent.id||'chunk')+'-split-'+Date.now()+'-'+index,x:wx,y:wy,rotation:rot,
      vx:(Number(parent.vx)||0)+(index?1:-1)*(10+Math.min(22,parent.hitRadius*.12)),vy:(Number(parent.vy)||0)-3-index*2,
      angularVelocity:(Number(parent.angularVelocity)||0)+(index?1:-1)*.28,mass,sourceMass:parent.sourceMass,cellSize:parent.cellSize||8,cells:r.cells,
      water:clamp(Number(parent.water)||0,0,1),radius:Math.max(14,Math.sqrt(Math.max(1,r.cells.length))*(parent.cellSize||8)*.76),
      buoyancy:clamp((Number(parent.buoyancy)||.55)*.92,.08,1),breachRate:Math.min(.09,(Number(parent.breachRate)||.012)+.012),
      burning,fireAge:Number(parent.fireAge)||0,powderCount:powder,exploded:false,age:0,sinkProgress:Number(parent.sinkProgress)||0,phase:'float',
      baseColor:parent.baseColor,deckColor:parent.deckColor,__v99Globalized:true
    };
    prepareChunk(child);child.durability=child.maxDurability*.72;child.fractureStrength=.18;return child;
  }

  function recycleChunks(state,needed){
    const list=state&&state.structuralChunks||[];
    while(list.length+needed>MAX_STRUCTURAL_CHUNKS){
      let idx=-1,best=-Infinity;
      for(let i=0;i<list.length;i++){
        const c=list[i];if(!c||c.phase==='gone')continue;
        const score=(Number(c.sinkProgress)||0)*5+(Number(c.age)||0)*.035- Math.max(0,Number(c.mass)||0)*.012;
        if(score>best){best=score;idx=i;}
      }
      if(idx<0)break;list[idx].phase='gone';list.splice(idx,1);
    }
  }

  function splitChunk(state,chunk){
    if(!state||!chunk||chunk.phase==='gone')return [];
    prepareChunk(chunk);const cells=chunk.cells||[];if(cells.length<MIN_SPLIT_CELLS)return [];
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const c of cells){minX=Math.min(minX,c.x||0);maxX=Math.max(maxX,c.x||0);minY=Math.min(minY,c.y||0);maxY=Math.max(maxY,c.y||0);}
    const useX=(maxX-minX)>=(maxY-minY),sorted=cells.slice().sort((a,b)=>(useX?(a.x||0)-(b.x||0):(a.y||0)-(b.y||0)));
    const cut=Math.floor(sorted.length/2),a=sorted.slice(0,cut),b=sorted.slice(cut);
    if(a.length<MIN_CHILD_CELLS||b.length<MIN_CHILD_CELLS)return [];
    recycleChunks(state,1);
    const children=[childFrom(chunk,a,0,0),childFrom(chunk,b,0,1)];
    const idx=(state.structuralChunks||[]).indexOf(chunk);chunk.phase='gone';
    if(idx>=0)state.structuralChunks.splice(idx,1,...children);else state.structuralChunks.push(...children);
    recycleChunks(state,0);return children;
  }

  function damageChunk(state,chunk,damage,impact){
    if(!chunk||chunk.phase==='gone')return {destroyed:false,split:false};
    prepareChunk(chunk);damage=Math.max(0,Number(damage)||0);impact=impact||{};
    const power=Math.max(damage,Number(impact.power)||0),old=chunk.durability;
    chunk.durability=Math.max(0,old-damage);
    chunk.fractureStrength=clamp((chunk.fractureStrength||0)+Math.sqrt(power)/85+damage/Math.max(1,chunk.maxDurability)*.45,0,1.5);
    chunk.breachRate=Math.min(.10,(Number(chunk.breachRate)||.012)+damage/Math.max(1,chunk.maxDurability)*.018);
    chunk.__v101HitFlash=.18;
    if(Number.isFinite(impact.vx)||Number.isFinite(impact.vy)){
      const d=Math.hypot(Number(impact.vx)||0,Number(impact.vy)||0)||1,imp=Math.min(42,5+power*.09)/Math.max(.7,Number(chunk.mass)||1);
      chunk.vx=(Number(chunk.vx)||0)+(Number(impact.vx)||0)/d*imp;chunk.vy=(Number(chunk.vy)||0)+(Number(impact.vy)||0)/d*imp;
    }
    let children=[];
    if((chunk.durability<=0||chunk.fractureStrength>=.92)&&(chunk.cells||[]).length>=MIN_SPLIT_CELLS)children=splitChunk(state,chunk);
    else if(chunk.durability<=0){chunk.phase='gone';}
    return {destroyed:chunk.phase==='gone',split:children.length>0,children,durability:chunk.durability};
  }

  function update(state,dt){
    if(!state||!(dt>0))return;
    for(const chunk of state.structuralChunks||[]){prepareChunk(chunk);chunk.__v101HitFlash=Math.max(0,(chunk.__v101HitFlash||0)-dt);}
    recycleChunks(state,0);
  }

  if(B&&typeof B.update==='function'&&!B.__v101ChunkDamageWrapped){
    B.__v101ChunkDamageWrapped=true;const originalUpdate=B.update;
    B.update=function(state,dt){originalUpdate(state,dt);if(state&&dt>0)update(state,dt);};
  }

  root.V101ChunkDamage={MAX_STRUCTURAL_CHUNKS,MIN_SPLIT_CELLS,prepareChunk,hitTestSegment,damageChunk,splitChunk,recycleChunks,update};
})(typeof globalThis!=='undefined'?globalThis:this);
