(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V10.5 crew requires ship grid');
  root.DHH=root.DHH||{};

  const ROLE_CONFIG={
    captain:{hp:140,speed:95,damage:28,attackRange:26,attackCd:.48},
    gunner:{hp:58,speed:66,damage:8,attackRange:20,attackCd:.82},
    sailor:{hp:65,speed:70,damage:11,attackRange:21,attackCd:.75},
    helmsman:{hp:82,speed:62,damage:9,attackRange:20,attackCd:.82},
    swordsman:{hp:56,speed:69,damage:11,attackRange:21,attackCd:.78},
    archer:{hp:42,speed:68,damage:9,attackRange:95,attackCd:1.05},
    eliteCaptain:{hp:150,speed:70,damage:18,attackRange:24,attackCd:.72}
  };
  const WALK_TYPES=new Set(['deck','cannon','beam','core','rudder','mast','powder']);
  const ENEMY_LAYOUT={
    sloop:{eliteCaptain:1,swordsman:2,archer:1,gunner:1,sailor:1},
    gunship:{eliteCaptain:1,swordsman:3,archer:2,gunner:2,sailor:2},
    manowar:{eliteCaptain:1,swordsman:5,archer:3,gunner:3,sailor:3}
  };

  function aliveCrewMember(c){return !!(c&&c.alive&&c.hp>0&&c.state!=='dead'&&c.state!=='overboard');}
  function candidateCells(ship){
    const cells=(ship&&ship.cells||[]).filter(c=>c&&c.alive&&!c.detachedGone&&WALK_TYPES.has(c.type));
    if(cells.length)return cells;
    return (ship&&ship.cells||[]).filter(c=>c&&c.alive&&!c.detachedGone);
  }
  function pointFor(ship,index,total,preference){
    const cells=candidateCells(ship);
    if(!cells.length)return{x:Number(ship&&ship.x)||0,y:Number(ship&&ship.y)||0};
    const cx=(ship.gridWidth-1)/2,cy=(ship.gridHeight-1)/2;
    const ranked=cells.slice().sort((a,b)=>{
      function score(c){
        const dx=c.gx-cx,dy=c.gy-cy;
        if(preference==='stern')return Math.abs(dx)*2+Math.abs(c.gy-(ship.gridHeight*.78));
        if(preference==='center')return dx*dx+dy*dy;
        return Math.abs(dx)+Math.abs(dy)*.55;
      }
      return score(a)-score(b);
    });
    const spread=Math.max(1,Math.floor(ranked.length/Math.max(2,total||1)));
    const cell=ranked[Math.min(ranked.length-1,(index*spread)%ranked.length)]||ranked[0];
    return typeof G.cellCenterWorld==='function'?G.cellCenterWorld(ship,cell):{x:ship.x,y:ship.y};
  }
  function makeCrew(ship,id,role,combatClass,point,boardingEligible){
    const cfg=ROLE_CONFIG[combatClass||role]||ROLE_CONFIG.sailor;
    return{
      id,ownerShipId:ship.id,currentShipId:ship.id,role,combatClass:combatClass||null,
      hp:cfg.hp,maxHp:cfg.hp,speed:cfg.speed,damage:cfg.damage,attackRange:cfg.attackRange,attackCd:cfg.attackCd,
      x:point.x,y:point.y,assignedPost:null,state:'idle',alive:true,targetId:null,task:'idle',attackTimer:0,hitT:0,
      wounded:false,deadT:0,faceX:ship.side==='player'?1:-1,faceY:0,boardingEligible:!!boardingEligible,
      comboStep:0,comboTimer:0,heavyTimer:0,heavyWindup:0,blockT:0
    };
  }
  function pushCrew(out,ship,role,combatClass,count,prefix,boardingEligible,preference){
    const total=Math.max(1,count);
    for(let i=0;i<count;i++)out.push(makeCrew(ship,(ship.id||ship.kind)+'-'+prefix+'-'+i,role,combatClass,pointFor(ship,out.length,total+out.length,preference),boardingEligible));
  }
  function buildPlayerCrew(ship){
    const out=[];
    pushCrew(out,ship,'captain',null,1,'captain',false,'center');
    pushCrew(out,ship,'gunner',null,4,'gunner',false,'center');
    pushCrew(out,ship,'sailor',null,5,'sailor',false,'center');
    pushCrew(out,ship,'helmsman',null,1,'helmsman',false,'stern');
    return out;
  }
  function buildEnemyCrew(ship){
    const layout=ENEMY_LAYOUT[ship.kind]||ENEMY_LAYOUT.sloop,out=[];
    pushCrew(out,ship,'captain','eliteCaptain',layout.eliteCaptain,'elite',true,'center');
    pushCrew(out,ship,'sailor','swordsman',layout.swordsman,'sword',true,'center');
    pushCrew(out,ship,'sailor','archer',layout.archer,'archer',true,'center');
    pushCrew(out,ship,'gunner',null,layout.gunner,'gunner',false,'center');
    pushCrew(out,ship,'sailor',null,layout.sailor,'sailor',false,'center');
    return out;
  }
  function prepareShip(ship){
    if(!ship)return[];
    if(Array.isArray(ship.crew)&&ship.__v105CrewPrepared)return ship.crew;
    if(!ship.id)ship.id=ship.side==='player'?'player':(ship.kind+'-'+Math.floor(Math.random()*1000000));
    if(!Array.isArray(ship.crew))ship.crew=ship.side==='player'?buildPlayerCrew(ship):buildEnemyCrew(ship);
    ship.__v105CrewPrepared=true;
    return ship.crew;
  }
  function prepareBattle(state){
    if(!state)return state;
    if(state.player)prepareShip(state.player);
    for(const ship of state.enemies||[])prepareShip(ship);
    return state;
  }
  function crewForShip(ship){return prepareShip(ship);}
  function aliveCrew(ship,predicate){return crewForShip(ship).filter(c=>aliveCrewMember(c)&&(!predicate||predicate(c)));}
  function killCrew(crew,source){
    if(!crew||!crew.alive)return false;
    crew.hp=0;crew.alive=false;crew.state='dead';crew.wounded=true;crew.deadT=0;crew.targetId=null;crew.task='dead';crew.deathSource=source||null;
    return true;
  }
  function damageCrew(crew,damage,source){
    damage=Number(damage)||0;
    if(!aliveCrewMember(crew)||!(damage>0))return false;
    crew.hp=Math.max(0,crew.hp-damage);crew.hitT=Math.max(Number(crew.hitT)||0,.12);crew.wounded=crew.hp<crew.maxHp*.45;
    if(crew.hp<=0)killCrew(crew,source);
    else crew.lastDamageSource=source||null;
    return true;
  }
  function canOccupyShip(crew,ship,boarding){
    if(!crew||!ship||!aliveCrewMember(crew))return false;
    if(crew.ownerShipId===ship.id)return true;
    if(ship.side!=='player'||!crew.boardingEligible)return false;
    return !!(boarding&&boarding.active&&boarding.enemyShipId===crew.ownerShipId);
  }
  function resetCurrentShip(crew){if(crew)crew.currentShipId=crew.ownerShipId;return crew;}
  function tickVisualTimers(state,dt){
    if(!state||!(dt>0))return;
    const ships=[state.player,...(state.enemies||[])].filter(Boolean);
    for(const ship of ships)for(const c of ship.crew||[]){
      c.hitT=Math.max(0,(Number(c.hitT)||0)-dt);
      if(!c.alive)c.deadT=(Number(c.deadT)||0)+dt;
    }
  }

  const api={ROLE_CONFIG,ENEMY_LAYOUT,prepareBattle,prepareShip,crewForShip,aliveCrew,aliveCrewMember,damageCrew,killCrew,canOccupyShip,resetCurrentShip,tickVisualTimers};
  root.V105Crew=api;root.DHH.V105Crew=api;
})(typeof globalThis!=='undefined'?globalThis:this);
