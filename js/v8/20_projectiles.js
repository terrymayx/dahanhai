(function(root){
  'use strict';
  const Grid=root.V8ShipGrid;
  if(!Grid)throw new Error('V8ShipGrid must load before V8Projectile');

  const PEN_COST=Grid.MATERIAL_RESISTANCE;

  function spawn(state,opts){
    const side=opts.side||'player';
    const flightTime=Math.max(.08,opts.flightTime||0);
    const arcHeight=Math.max(0,opts.arcHeight||0);
    const gravity=arcHeight>0?8*arcHeight/(flightTime*flightTime):0;
    const initialVz=arcHeight>0?4*arcHeight/flightTime:0;
    const p={
      x:opts.x,y:opts.y,vx:opts.vx||0,vy:opts.vy||0,
      damage:opts.damage||24,side,life:opts.life||3,
      radius:opts.radius||5,dead:false,
      penetration:opts.penetration==null?(side==='player'?78:0):opts.penetration,
      hitCells:Object.create(null),
      z:0,prevZ:0,vz:initialVz,initialVz,gravity,arcHeight,flightTime,arcAge:0
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

  function updateAll(state,dt){
    const out=[];
    for(const p of state.projectiles){
      if(p.dead)continue;
      const x0=p.x,y0=p.y;
      updateArc(p,dt);
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
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
          const material=bestCell.material||bestCell.type;
          p.penetration-=PEN_COST[material]||28;
          if(p.penetration>0){
            const speed=Math.hypot(p.vx,p.vy)||1,ux=p.vx/speed,uy=p.vy/speed;
            p.x=hitPos.x+ux*best.cellSize*.62;
            p.y=hitPos.y+uy*best.cellSize*.62;
          }else p.dead=true;
        }else p.dead=true;
      }
      if(!p.dead&&p.life>0&&p.x>-300&&p.x<2300&&p.y>-300&&p.y<1400)out.push(p);
    }
    state.projectiles=out;
  }

  root.V8Projectile={PEN_COST,spawn,updateArc,updateAll};
})(typeof globalThis!=='undefined'?globalThis:this);
