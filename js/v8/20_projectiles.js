(function(root){
  'use strict';
  const Grid=root.V8ShipGrid;
  if(!Grid)throw new Error('V8ShipGrid must load before V8Projectile');

  const PEN_COST=Grid.MATERIAL_RESISTANCE;

  function computeArcHeight(side,distance,variation){
    distance=Math.max(0,distance||0);
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
    const damage=opts.damage||24;
    const p={
      x:opts.x,y:opts.y,vx:opts.vx||0,vy:opts.vy||0,
      damage,attackPower:opts.attackPower==null?damage:opts.attackPower,side,life:opts.life||3,
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

  function firstPhysicalHit(ship,x0,y0,x1,y1){
    if(!ship||ship.state==='gone')return null;
    const a=Grid.worldToLocal(ship,x0,y0),b=Grid.worldToLocal(ship,x1,y1);
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    const step=Math.max(1.25,(ship.cellSize||8)*.22);
    const samples=Math.max(1,Math.ceil(len/step));
    let lastKey='';
    for(let i=0;i<=samples;i++){
      const t=i/samples,lx=a.x+dx*t,ly=a.y+dy*t;
      const g=Grid.localToGrid(ship,lx,ly),k=g.gx+','+g.gy;
      if(k===lastKey)continue;
      lastKey=k;
      const cell=ship.cellMap&&ship.cellMap[k];
      if(cell&&cell.alive&&!cell.detachedGone){
        return {ship,cell,t,worldX:x0+(x1-x0)*t,worldY:y0+(y1-y0)*t};
      }
    }
    return null;
  }

  function reflectProjectile(p,normal){
    normal=normal||{x:0,y:0};
    let nx=Number(normal.x)||0,ny=Number(normal.y)||0;
    const nd=Math.hypot(nx,ny)||1;nx/=nd;ny/=nd;
    const dot=p.vx*nx+p.vy*ny;
    let rvx=p.vx-2*dot*nx,rvy=p.vy-2*dot*ny;
    if(!Number.isFinite(rvx)||!Number.isFinite(rvy)||(!rvx&&!rvy)){rvx=-p.vx;rvy=-p.vy;}
    p.vx=rvx*.55;p.vy=rvy*.55;
    p.damage=Math.max(.1,(Number(p.damage)||0)*.45);
    p.attackPower=Math.max(.1,(Number(p.attackPower)||Number(p.damage)||0)*.45);
    p.__v99Ricocheted=true;
    p.life=Math.min(p.life,.9);
    const speed=Math.hypot(p.vx,p.vy)||1;
    p.x+=p.vx/speed*2.2;p.y+=p.vy/speed*2.2;
  }

  function updateAll(state,dt){
    const out=[];
    for(const p of state.projectiles){
      if(p.dead)continue;
      const x0=p.x,y0=p.y;
      updateArc(p,dt);
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      updateTrail(p,dt);

      let bestHit=null;
      for(const ship of targetsFor(state,p)){
        const hit=firstPhysicalHit(ship,x0,y0,p.x,p.y);
        if(!hit)continue;
        const hk=(ship.id||ship.kind)+':'+hit.cell.gx+','+hit.cell.gy;
        if(p.hitCells[hk])continue;
        if(!bestHit||hit.t<bestHit.t)bestHit=hit;
      }

      if(bestHit){
        const best=bestHit.ship,bestCell=bestHit.cell;
        p.didHit=true;
        const hitPos={x:bestHit.worldX,y:bestHit.worldY};
        p.x=hitPos.x;p.y=hitPos.y;

        const Material=root.V99Material||null;
        const Armor=root.V98Armor||null;
        const attackPower=Math.max(0,Number(p.attackPower)||Number(p.damage)||0);
        let impact;
        if(Material&&typeof Material.resolveDirect==='function'){
          impact=Material.resolveDirect(best,bestCell,p);
          Material.applyImpactState(best,bestCell,impact);
        }else{
          impact=Armor&&typeof Armor.resolveDirectHit==='function'
            ?Armor.resolveDirectHit(best,bestCell,attackPower)
            :{armor:0,ratio:999,grade:'heavy',effectiveDamage:p.damage};
        }

        p.impactArmor=Number(impact.effectiveArmor)||Number(impact.armor)||0;
        p.impactArmorBase=Number(impact.armorMax)||Number(impact.armor)||0;
        p.impactRatio=impact.ratio;
        p.impactGrade=impact.grade;
        p.impactCos=impact.impactCos;
        p.impactAngle=impact.impactAngle;
        p.effectiveDamage=impact.effectiveDamage;

        const directDamage=impact.ricochet?Math.max(.1,impact.effectiveDamage*.25):impact.effectiveDamage;
        const res=Grid.damageCell(best,bestCell,directDamage);
        const hk=(best.id||best.kind)+':'+bestCell.gx+','+bestCell.gy;
        p.hitCells[hk]=true;
        if(typeof state.onCellHit==='function')state.onCellHit(best,bestCell,hitPos,res,p);
        if(res.destroyed&&typeof state.onCellDestroyed==='function')state.onCellDestroyed(best,bestCell,hitPos,p);

        const Structure=root.V99Structure||null;
        if(Structure&&typeof Structure.queueLocalSolve==='function')Structure.queueLocalSolve(best,bestCell);
        const Fracture=root.V100Fracture||null;
        if(Fracture&&typeof Fracture.seedImpact==='function')Fracture.seedImpact(best,bestCell,{vx:p.vx,vy:p.vy,power:p.attackPower||p.damage,grade:p.impactGrade});
        const Branches=root.V101CrackBranches||null;
        if(Branches&&typeof Branches.registerImpact==='function')Branches.registerImpact(best,bestCell,{vx:p.vx,vy:p.vy,power:p.attackPower||p.damage,grade:p.impactGrade});

        const ratio=Grid.integrity(best);
        const threshold=best.side==='player'?.24:.34;
        if(ratio<=threshold&&typeof state.onShipCritical==='function')state.onShipCritical(best,ratio,p);

        if(impact.ricochet){
          reflectProjectile(p,impact.normal);
        }else{
          // Hard rule: one cannonball = one foremost physical layer.
          p.dead=true;
        }
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

  root.V8Projectile={PEN_COST,computeArcHeight,spawn,estimateFlightTime,updateArc,updateTrail,firstPhysicalHit,reflectProjectile,updateAll};
})(typeof globalThis!=='undefined'?globalThis:this);
