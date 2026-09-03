(function(root){
  'use strict';

  const Crew=root.V105Crew||(root.DHH&&root.DHH.V105Crew);
  if(!Crew)throw new Error('V10.5 crew damage requires V105Crew');
  root.DHH=root.DHH||{};

  const MAX_HAZARD_EVENTS=20;
  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function activeOnShip(c,ship){return Crew.aliveCrewMember(c)&&ship&&c.currentShipId===ship.id;}
  function damageNear(state,ship,pos,damage,radius,source){
    if(!ship||!pos||!(damage>0)||!(radius>0))return[];
    Crew.prepareShip(ship);const hits=[];
    for(const c of ship.crew||[]){
      if(!activeOnShip(c,ship))continue;
      const d=Math.hypot((c.x||0)-pos.x,(c.y||0)-pos.y);if(d>radius)continue;
      const falloff=.35+.65*(1-d/radius),amount=Math.max(.5,damage*falloff);
      if(Crew.damageCrew(c,amount,source)){hits.push({crew:c,damage:amount,distance:d});c.dangerT=.7;}
    }
    if(hits.length&&state&&state.crewEvents){
      state.crewEvents.push({type:'crew_damage',shipId:ship.id,x:pos.x,y:pos.y,count:hits.length,source:source&&source.kind||'hazard',time:state.time||0});
      if(state.crewEvents.length>32)state.crewEvents.splice(0,state.crewEvents.length-32);
    }
    return hits;
  }
  function directImpact(state,ship,pos,projectile){
    if(!ship||!pos||!projectile)return[];
    const damage=Math.max(2,(Number(projectile.damage)||Number(projectile.attackPower)||12)*.72);
    const radius=Math.max(12,(ship.cellSize||16)*1.25);
    const hits=damageNear(state,ship,pos,damage,radius,{kind:'projectile',ammoType:projectile.ammoType||'standard',side:projectile.side});
    const profile=root.V102Ammo&&typeof root.V102Ammo.profileFor==='function'?root.V102Ammo.profileFor(projectile.ammoType):null;
    const blastScale=profile&&Number.isFinite(profile.blastRadiusScale)?profile.blastRadiusScale:1;
    if((projectile.ammoType==='explosive'||blastScale>1.15))damageNear(state,ship,pos,damage*.72,radius*2.8*blastScale,{kind:'blast',ammoType:projectile.ammoType||'standard'});
    return hits;
  }
  function updateFireHazards(state,dt){
    if(!state||!(dt>0))return 0;let hits=0;
    const ships=[state.player,...(state.enemies||[])].filter(Boolean);
    for(const ship of ships){
      const burning=(ship.__v96BurningCells||[]).filter(c=>c&&c.alive&&c.burning&&!c.detachedGone);if(!burning.length)continue;
      for(const crew of ship.crew||[]){
        if(!activeOnShip(crew,ship))continue;
        let nearest=Infinity;
        for(const cell of burning){const p=root.V8ShipGrid&&root.V8ShipGrid.cellCenterWorld?root.V8ShipGrid.cellCenterWorld(ship,cell):null;if(!p)continue;nearest=Math.min(nearest,Math.hypot(crew.x-p.x,crew.y-p.y));}
        if(nearest<=(ship.cellSize||16)*1.35){Crew.damageCrew(crew,5.2*dt,{kind:'fire'});crew.dangerT=.8;hits++;}
      }
    }
    return hits;
  }
  function updateFxHazards(state){
    if(!state||!Array.isArray(state.fx))return 0;let events=0;
    for(const fx of state.fx){
      if(events>=MAX_HAZARD_EVENTS)break;if(!fx||fx.__v105CrewApplied)continue;
      let damage=0,radius=0,kind='';
      if(fx.k==='powderBlast'){damage=42;radius=Math.max(70,Number(fx.r)||82);kind='powder';}
      else if(fx.k==='structureRupture'){damage=18;radius=Math.max(42,Number(fx.r)||64);kind='chunk';}
      else continue;
      fx.__v105CrewApplied=true;events++;
      for(const ship of [state.player,...(state.enemies||[])].filter(Boolean))damageNear(state,ship,{x:fx.x,y:fx.y},damage,radius,{kind});
    }
    return events;
  }
  function hazardReaction(crew,dt){if(!crew)return;crew.dangerT=Math.max(0,(Number(crew.dangerT)||0)-(Number(dt)||0));}
  function update(state,dt){
    if(!state||!(dt>0))return;
    updateFireHazards(state,dt);updateFxHazards(state);
    for(const ship of [state.player,...(state.enemies||[])].filter(Boolean))for(const c of ship.crew||[])hazardReaction(c,dt);
  }

  const api={damageNear,directImpact,updateFireHazards,updateFxHazards,hazardReaction,update,MAX_HAZARD_EVENTS};
  root.V105CrewDamage=api;root.DHH.V105CrewDamage=api;
})(typeof globalThis!=='undefined'?globalThis:this);
