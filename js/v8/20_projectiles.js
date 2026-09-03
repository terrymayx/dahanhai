(function(root){
  'use strict';
  const Grid=root.V8ShipGrid;
  if(!Grid)throw new Error('V8ShipGrid must load before V8Projectile');

  const PEN_COST=Grid.MATERIAL_RESISTANCE;

  function computeArcHeight(side,distance,variation){
    distance=Math.max(0,distance||0);
    // V9.5.2: naval cannonballs fly almost flat. Keep only a small visual arc.
    const base=side==='player'
      ? Math.max(12,Math.min(28,10+distance*.012))
      : Math.max(8,Math.min(20,7+distance*.009));
    return Math.max(0,base+(variation||0)*.18);
  }

  function estimateFlightTime(state,p){
    const speed=Math.hypot(p.vx,p.vy)||1;
    let target=null,tx=null,ty=null;
    if(p.side==='player'){
      const enemies=(state.enemies||[]).filter(s=>s.state==='active');
      if(state.aim)target=enemies.find(s=>s.id===state.aim.shipId)||null;
      if(!target)target=enemies[0]||null;
      if(target&&state.aim&&state.aim.shipId===target.id&&Number.isFinite(state.aim.lx)&&Number.isFinite(state.aim.ly)){
        const a=Grid.localToWorld(target,state.aim.lx,state.aim.ly);tx=a.x;ty=a.y;
      }
    }else target=state.player&&state.player.state==='active'?state.player:null;
    if(target){
      if(tx==null){tx=target.x;ty=target.y;}
      return Math.max(.28,Math.min(2.2,Math.hypot(tx-p.x,ty-p.y)/speed));
    }
    return p.side==='player'?.78:1.2;
  }

  function spawn(state,opts){
    const side=opts.side||'player';
    const base={x:opts.x,y:opts.y,vx:opts.vx||0,vy:opts.vy||0,side};
    const flightTime=Math.max(.08,opts.flightTime==null?estimateFlightTime(state,base):opts.flightTime);
    const speed=Math.hypot(base.vx,base.vy)||1;
    const distance=speed*flightTime;
    const arcHeight=Math.max(0,opts.arcHeight==null?computeArcHeight(side,distance,opts.arcVariation||0):Math.min(opts.arcHeight,side==='player'?32:22));
    const gravity=arcHeight>0?8*arcHeight/(flightTime*flightTime):0;
    const initialVz=arcHeight>0?4*arcHeight/flightTime:0;
    const p={
      x:opts.x,y:opts.y,vx:opts.vx||0,vy:opts.vy||0,
      damage:opts.damage||24,side,life:opts.life||3,
      radius:opts.radius||5,dead:false,
      penetration:opts.penetration==null?(side==='player'?78:0):opts.penetration,
      hitCells:Object.create(null),didHit:false,splashDone:false,
      z:0,prevZ:0,vz:initialVz,initialVz,gravity,arcHeight,flightTime,arcAge:0,
      trail:[],trailT:0
    };
    state.projectiles.push(p);return p;
  }

  function targetsFor(state,p){
    if(p.side==='player')return (state.enemies||[]).filter(s=>s.state==='active');
    return state.player&&state.player.state==='active'?[state.player]:[];
  }

  function updateArc(p,dt){
    p.prevZ=p.z||0;
    if(!(p.arcHeight>0&&p.flightTime>0)){p.z=0;p.vz=0;return;}
    p.arcAge=Math.min(p.flightTime,(p.arcAge||0)+dt);
    const t=p.arcAge;
    p.z=Math.max(0,p.initialVz*t-.5*p.gravity*t*t);
    p.vz=p.initialVz-p.gravity*t;
  }

  function updateTrail(p,dt){
    if(!p.trail)p.trail=[];
    for(const t of p.trail)t.t=(t.t||0)+dt;
    p.trail=p.trail.filter(t=>t.t<t.dur);
    p.trailT=(p.trailT||0)-dt;
    if(p.trailT<=0){
      p.trail.push({x:p.x,y:p.y,z:p.z||0,t:0,dur:.28});
      if(p.trail.length>8)p.trail.splice(0,p.trail.length-8);
      p.trailT+=.05;
    }
  }

  function updateAll(state,dt){
    const out=[];
    for(const p of state.projectiles){
      if(p.dead)continue;
      const x0=p.x,y0=p.y;
      updateArc(p,dt);
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      updateTrail(p,dt);
      let best=null,bestCell=null,bestD=Infinity;
      for(const ship of targetsFor(state,p)){
        const cell=Grid.firstCellAlongSegment(ship,x0,y0,p.x,p.y);
        if(!cell)continue;
        const hk=(ship.id||ship.kind)+':'+cell.gx+','+cell.gy;
        if(p.hitCells[hk])continue;
        const w=Grid.cellCenterWorld(ship,cell);
        const d=Math.hypot(w.x-x0,w.y-y0);
        if(d<bestD){best=ship;bestCell=cell;bestD=d;}
      }
      if(best&&bestCell){
        p.didHit=true;
        const hitPos=Grid.cellCenterWorld(best,bestCell);
        const res=Grid.damageCell(best,bestCell,p.damage);
        const hk=(best.id||best.kind)+':'+bestCell.gx+','+bestCell.gy;
        p.hitCells[hk]=true;
        if(typeof state.onCellHit==='function')state.onCellHit(best,bestCell,hitPos,res,p);
        if(res.destroyed&&typeof state.onCellDestroyed==='function')state.onCellDestroyed(best,bestCell,hitPos,p);
        const ratio=Grid.integrity(best);
        const threshold=best.side==='player'?.24:.34;
        if(ratio<=threshold&&typeof state.onShipCritical==='function')state.onShipCritical(best,ratio,p);

        if(p.side==='player'){
          if(!res.destroyed){
            p.dead=true;
          }else{
            const material=bestCell.material||bestCell.type;
            p.penetration-=PEN_COST[material]||28;
            if(p.penetration>0){
              const ps=Math.hypot(p.vx,p.vy)||1,ux=p.vx/ps,uy=p.vy/ps;
              p.x=hitPos.x+ux*best.cellSize*.62;
              p.y=hitPos.y+uy*best.cellSize*.62;
            }else p.dead=true;
          }
        }else p.dead=true;
      }
      if(!p.dead&&!p.didHit&&!p.splashDone&&p.arcHeight>0&&p.arcAge>=p.flightTime){
        p.splashDone=true;
        if(typeof state.onProjectileSplash==='function')state.onProjectileSplash(p,{x:p.x,y:p.y});
        p.dead=true;
      }
      if(!p.dead&&p.life>0&&p.x>-300&&p.x<2300&&p.y>-300&&p.y<1400)out.push(p);
    }
    state.projectiles=out;
  }

  root.V8Projectile={PEN_COST,computeArcHeight,spawn,estimateFlightTime,updateArc,updateTrail,updateAll};
})(typeof globalThis!=='undefined'?globalThis:this);
