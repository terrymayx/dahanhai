(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle||null;
  if(!G)throw new Error('V10 chunk physics requires V8ShipGrid');

  const MAX_PAIRS=24;
  const POWDER_FIRE_DELAY=2.5;
  const EXPLOSION_RADIUS=92;
  const MAX_LOCAL_DAMAGE_CELLS=42;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function prepareChunk(chunk){
    if(!chunk)return chunk;
    if(!Number.isFinite(chunk.radius))chunk.radius=Math.max(18,Math.sqrt((chunk.cells||[]).length)*(chunk.cellSize||8)*.7);
    if(!Number.isFinite(chunk.breachRate))chunk.breachRate=.012;
    if(!Number.isFinite(chunk.powderCount))chunk.powderCount=(chunk.cells||[]).filter(c=>c.type==='powder').length;
    if(!Number.isFinite(chunk.fireAge))chunk.fireAge=0;
    if(chunk.burning==null)chunk.burning=(chunk.cells||[]).some(c=>c.burning);
    if(chunk.exploded==null)chunk.exploded=false;
    if(!Number.isFinite(chunk.__v100FireFxT))chunk.__v100FireFxT=0;
    return chunk;
  }

  function impulsePair(a,b,nx,ny,penetration){
    const ma=Math.max(.25,Number(a.mass)||1),mb=Math.max(.25,Number(b.mass)||1);
    const rvx=(b.vx||0)-(a.vx||0),rvy=(b.vy||0)-(a.vy||0),along=rvx*nx+rvy*ny;
    const impulse=Math.max(0,-along*.42+penetration*2.1)/(1/ma+1/mb);
    a.vx=(a.vx||0)-nx*impulse/ma;a.vy=(a.vy||0)-ny*impulse/ma;
    b.vx=(b.vx||0)+nx*impulse/mb;b.vy=(b.vy||0)+ny*impulse/mb;
    a.angularVelocity=(a.angularVelocity||0)-ny*impulse/ma*.004;
    b.angularVelocity=(b.angularVelocity||0)+nx*impulse/mb*.004;
  }

  function resolveCollisions(state){
    const chunks=(state&&state.structuralChunks||[]).filter(c=>c&&c.phase!=='gone').map(prepareChunk),pairs=[];
    for(let i=0;i<chunks.length;i++)for(let j=i+1;j<chunks.length;j++){
      const a=chunks[i],b=chunks[j],dx=(b.x||0)-(a.x||0),dy=(b.y||0)-(a.y||0),d=Math.hypot(dx,dy),limit=(a.radius||0)+(b.radius||0);
      if(d<limit*1.15)pairs.push({kind:'chunk',a,b,d,limit,dx,dy});
    }
    const ships=[state&&state.player,...(state&&state.enemies||[])].filter(s=>s&&s.state==='active');
    for(const chunk of chunks)for(const ship of ships){
      const sr=Math.max(24,Math.min(180,Math.hypot((ship.gridWidth||0)*(ship.cellSize||8),(ship.gridHeight||0)*(ship.cellSize||8))*.34));
      const dx=(ship.x||0)-(chunk.x||0),dy=(ship.y||0)-(chunk.y||0),d=Math.hypot(dx,dy),limit=(chunk.radius||0)+sr;
      if(d<limit*1.04)pairs.push({kind:'ship',a:chunk,b:ship,d,limit,dx,dy});
    }
    pairs.sort((a,b)=>(a.d-a.limit)-(b.d-b.limit));
    let processed=0;
    for(const pair of pairs.slice(0,MAX_PAIRS)){
      const d=Math.max(.001,pair.d),nx=pair.dx/d,ny=pair.dy/d,penetration=Math.max(0,pair.limit-d);
      if(!(penetration>0))continue;
      if(pair.kind==='chunk')impulsePair(pair.a,pair.b,nx,ny,penetration);
      else{
        const chunk=pair.a,ship=pair.b,m=Math.max(.25,chunk.mass||1),bounce=Math.min(55,penetration*1.8+Math.hypot(chunk.vx||0,chunk.vy||0)*.25);
        chunk.vx=(chunk.vx||0)-nx*bounce;chunk.vy=(chunk.vy||0)-ny*bounce;
        if(ship.physics){ship.physics.impulseX=(ship.physics.impulseX||0)+nx*bounce*m*.025;ship.physics.impulseY=(ship.physics.impulseY||0)+ny*bounce*m*.025;}
        const ChunkDamage=root.V101ChunkDamage||null;
        if(ChunkDamage&&typeof ChunkDamage.onShipCollision==='function')ChunkDamage.onShipCollision(state,chunk,ship,{nx,ny,penetration,bounce});
      }
      processed++;
    }
    return processed;
  }

  function localExplosionDamage(state,chunk){
    const ships=[state&&state.player,...(state&&state.enemies||[])].filter(s=>s&&s.state==='active'&&s.cellMap);
    let damaged=0;
    for(const ship of ships){
      const dx=(ship.x||0)-(chunk.x||0),dy=(ship.y||0)-(chunk.y||0);
      const shipRadius=Math.max(40,Math.hypot((ship.gridWidth||0)*(ship.cellSize||8),(ship.gridHeight||0)*(ship.cellSize||8))*.35);
      if(Math.hypot(dx,dy)>EXPLOSION_RADIUS+shipRadius)continue;
      const local=typeof G.worldToLocal==='function'?G.worldToLocal(ship,chunk.x,chunk.y):{x:0,y:0};
      const center=typeof G.localToGrid==='function'?G.localToGrid(ship,local.x,local.y):{gx:Math.floor(ship.gridWidth/2),gy:Math.floor(ship.gridHeight/2)};
      const radius=Math.max(3,Math.ceil(EXPLOSION_RADIUS/(ship.cellSize||8)));
      for(let gy=Math.max(0,center.gy-radius);gy<=Math.min((ship.gridHeight||0)-1,center.gy+radius);gy++){
        for(let gx=Math.max(0,center.gx-radius);gx<=Math.min((ship.gridWidth||0)-1,center.gx+radius);gx++){
          if(damaged>=MAX_LOCAL_DAMAGE_CELLS)return damaged;
          const cell=ship.cellMap[gx+','+gy];if(!cell||!cell.alive||cell.detachedGone)continue;
          const p=typeof G.cellCenterWorld==='function'?G.cellCenterWorld(ship,cell):{x:ship.x,y:ship.y};
          const dist=Math.hypot(p.x-chunk.x,p.y-chunk.y);if(dist>EXPLOSION_RADIUS)continue;
          const damage=Math.max(1,Math.round(30*(1-dist/EXPLOSION_RADIUS)));
          const res=G.damageCell(ship,cell,damage);damaged++;
          const F=root.V100Fracture||null;
          if(F&&typeof F.seedImpact==='function'&&damaged<=8)F.seedImpact(ship,cell,{vx:p.x-chunk.x,vy:p.y-chunk.y,power:70*(1-dist/EXPLOSION_RADIUS),grade:'heavy'});
          const S=root.V99Structure||null;if(S&&res&&res.destroyed&&typeof S.queueLocalSolve==='function')S.queueLocalSolve(ship,cell);
        }
      }
    }
    return damaged;
  }

  function explodeChunk(state,chunk){
    if(!state||!chunk||chunk.exploded)return false;
    prepareChunk(chunk);chunk.exploded=true;chunk.burning=false;chunk.breachRate=Math.min(.08,(chunk.breachRate||0)+.028);chunk.buoyancy=Math.max(.08,(chunk.buoyancy||.5)*.55);
    if(state.fx){
      state.fx.push({k:'powderBlast',x:chunk.x,y:chunk.y,t:0,dur:.62,r:82+Math.min(55,chunk.powderCount*8)});
      state.fx.push({k:'structureRupture',x:chunk.x,y:chunk.y,t:0,dur:.55,r:64});
      if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);
    }
    for(const other of state.structuralChunks||[]){
      if(!other||other===chunk||other.phase==='gone')continue;prepareChunk(other);
      const dx=(other.x||0)-(chunk.x||0),dy=(other.y||0)-(chunk.y||0),d=Math.hypot(dx,dy)||1;if(d>EXPLOSION_RADIUS*1.5)continue;
      const force=(1-d/(EXPLOSION_RADIUS*1.5))*115;
      other.vx=(other.vx||0)+dx/d*force;other.vy=(other.vy||0)+dy/d*force;
    }
    localExplosionDamage(state,chunk);
    return true;
  }

  function updateChunkFire(state,chunk,dt){
    prepareChunk(chunk);
    if(chunk.burning&&chunk.water<.78){
      chunk.fireAge+=dt;
      chunk.__v100FireFxT-=dt;
      if(state.fx&&chunk.__v100FireFxT<=0){
        state.fx.push({k:'boom',x:chunk.x+(Math.random()-.5)*(chunk.radius||20)*.45,y:chunk.y+(Math.random()-.5)*(chunk.radius||20)*.25,t:0,dur:.22,r:10+Math.min(12,chunk.powderCount*2)});
        if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);
        chunk.__v100FireFxT=.20;
      }
      if(chunk.powderCount>0&&chunk.fireAge>=POWDER_FIRE_DELAY&&!chunk.exploded)explodeChunk(state,chunk);
    }else if(chunk.water>=.78){chunk.burning=false;chunk.fireAge=Math.max(0,chunk.fireAge-dt*2);}
  }

  function update(state,dt){
    if(!state||!(dt>0))return;
    for(const chunk of state.structuralChunks||[])if(chunk&&chunk.phase!=='gone')updateChunkFire(state,chunk,dt);
    resolveCollisions(state);
  }

  if(B&&typeof B.update==='function'&&!B.__v100ChunkPhysicsWrapped){
    B.__v100ChunkPhysicsWrapped=true;
    const originalUpdate=B.update;
    B.update=function(state,dt){originalUpdate(state,dt);if(state&&dt>0)update(state,dt);};
  }

  root.V100ChunkPhysics={MAX_PAIRS,POWDER_FIRE_DELAY,EXPLOSION_RADIUS,prepareChunk,resolveCollisions,explodeChunk,update};
})(typeof globalThis!=='undefined'?globalThis:this);
