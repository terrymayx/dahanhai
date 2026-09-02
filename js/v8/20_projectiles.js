(function(root){
  'use strict';
  const Grid=root.V8ShipGrid;
  if(!Grid)throw new Error('V8ShipGrid must load before V8Projectile');

  function spawn(state,opts){
    const p={
      x:opts.x,y:opts.y,vx:opts.vx||0,vy:opts.vy||0,
      damage:opts.damage||24,side:opts.side||'player',life:opts.life||3,
      radius:opts.radius||5,dead:false
    };
    state.projectiles.push(p);return p;
  }

  function targetsFor(state,p){
    if(p.side==='player')return (state.enemies||[]).filter(s=>s.state==='active');
    return state.player&&state.player.state==='active'?[state.player]:[];
  }

  function updateAll(state,dt){
    const out=[];
    for(const p of state.projectiles){
      if(p.dead)continue;
      const x0=p.x,y0=p.y;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      let best=null,bestCell=null,bestD=Infinity;
      for(const ship of targetsFor(state,p)){
        const cell=Grid.firstCellAlongSegment(ship,x0,y0,p.x,p.y);
        if(!cell)continue;
        const w=Grid.cellCenterWorld(ship,cell);
        const d=Math.hypot(w.x-x0,w.y-y0);
        if(d<bestD){best=ship;bestCell=cell;bestD=d;}
      }
      if(best&&bestCell){
        const hitPos=Grid.cellCenterWorld(best,bestCell);
        const res=Grid.damageCell(best,bestCell,p.damage);
        p.dead=true;
        if(typeof state.onCellHit==='function')state.onCellHit(best,bestCell,hitPos,res,p);
        if(res.destroyed&&typeof state.onCellDestroyed==='function')state.onCellDestroyed(best,bestCell,hitPos,p);
        const ratio=Grid.integrity(best);
        const threshold=best.side==='player'?.24:.34;
        if(ratio<=threshold&&typeof state.onShipCritical==='function')state.onShipCritical(best,ratio,p);
      }
      if(!p.dead&&p.life>0&&p.x>-300&&p.x<2300&&p.y>-300&&p.y<1400)out.push(p);
    }
    state.projectiles=out;
  }

  root.V8Projectile={spawn,updateAll};
})(typeof globalThis!=='undefined'?globalThis:this);
