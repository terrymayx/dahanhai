(function(root){
  'use strict';

  const Crew=root.V105Crew||(root.DHH&&root.DHH.V105Crew);
  if(!Crew)throw new Error('V10.5 crew posts requires V105Crew');
  root.DHH=root.DHH||{};

  function alive(c){return Crew.aliveCrewMember(c);}
  function getBroadside(){return root.V103Broadside||null;}
  function ensureBattery(ship){
    const V=getBroadside();
    if(V&&typeof V.ensureBattery==='function'){try{return V.ensureBattery(ship);}catch(e){}}
    return ship&&ship.__v103Battery||null;
  }
  function gunEntries(ship){
    const battery=ensureBattery(ship),out=[];
    if(battery){
      for(const side of ['port','starboard'])for(const gun of battery[side]&&battery[side].guns||[])out.push({side,gun});
      return out;
    }
    let i=0;
    for(const cell of ship&&ship.cells||[])if(cell&&cell.alive&&cell.type==='cannon')out.push({side:(i++%2?'starboard':'port'),gun:{id:'cell-'+cell.gx+'-'+cell.gy,cell,axial:i}});
    return out;
  }
  function buildGroups(ship){
    const entries=gunEntries(ship),groups=[
      {id:'port-fore',side:'port',half:'fore',gunIds:[]},
      {id:'port-aft',side:'port',half:'aft',gunIds:[]},
      {id:'starboard-fore',side:'starboard',half:'fore',gunIds:[]},
      {id:'starboard-aft',side:'starboard',half:'aft',gunIds:[]}
    ];
    for(const item of entries){
      const half=(Number(item.gun.axial)||0)<0?'fore':'aft',group=groups.find(g=>g.side===item.side&&g.half===half);
      if(group)group.gunIds.push(item.gun.id);
    }
    const gunners=(ship.crew||[]).filter(c=>c.role==='gunner');
    for(let i=0;i<groups.length;i++){
      const group=groups[i],gunner=gunners[i]||null;
      group.assignedCrewId=gunner&&gunner.id||null;group.replacementCrewId=null;group.multiplier=gunner&&alive(gunner)?1:0;group.disabled=group.multiplier<=0;
      if(gunner)gunner.assignedPost=group.id;
    }
    ship.__v105GunGroups=groups;
    return groups;
  }
  function gunGroups(ship){return ship&&ship.__v105GunGroups||buildGroups(ship);}
  function crewById(ship,id){return (ship&&ship.crew||[]).find(c=>c.id===id)||null;}
  function availableSailors(ship,used){
    used=used||new Set();
    return (ship&&ship.crew||[]).filter(c=>alive(c)&&c.role==='sailor'&&!c.combatClass&&c.currentShipId===c.ownerShipId&&!used.has(c.id));
  }
  function refreshStaffing(ship){
    if(!ship)return null;
    Crew.prepareShip(ship);const groups=gunGroups(ship),used=new Set();
    for(const group of groups){
      const primary=crewById(ship,group.assignedCrewId);
      group.replacementCrewId=null;
      if(primary&&alive(primary)&&primary.currentShipId===ship.id){group.multiplier=1;group.disabled=false;continue;}
      const replacement=availableSailors(ship,used)[0]||null;
      if(replacement){used.add(replacement.id);group.replacementCrewId=replacement.id;group.multiplier=.65;group.disabled=false;replacement.task='gunnerReplacement';replacement.assignedPost=group.id;}
      else{group.multiplier=0;group.disabled=true;}
    }
    const helm=(ship.crew||[]).find(c=>c.role==='helmsman'),helmAlive=helm&&alive(helm)&&helm.currentShipId===ship.id;
    ship.__v105HelmReplacementCrewId=null;
    if(!helmAlive){
      const replacement=availableSailors(ship,used)[0]||null;
      if(replacement){used.add(replacement.id);ship.__v105HelmReplacementCrewId=replacement.id;replacement.task='helmsmanReplacement';replacement.assignedPost='helm';}
    }
    ship.__v105StaffingUsed=used;
    return staffingSummary(ship);
  }
  function assignPosts(ship){
    if(!ship)return[];
    Crew.prepareShip(ship);buildGroups(ship);
    const helm=(ship.crew||[]).find(c=>c.role==='helmsman');if(helm)helm.assignedPost='helm';
    const captain=(ship.crew||[]).find(c=>c.role==='captain');if(captain)captain.assignedPost='command';
    refreshStaffing(ship);return ship.__v105GunGroups;
  }
  function aliveSailorCount(ship){return (ship&&ship.crew||[]).filter(c=>alive(c)&&c.role==='sailor'&&!c.combatClass).length;}
  function baseSailorCount(ship){return Math.max(1,(ship&&ship.crew||[]).filter(c=>c.role==='sailor'&&!c.combatClass).length||1);}
  function firefightingScale(ship){
    const base=baseSailorCount(ship),n=aliveSailorCount(ship);
    return Math.max(.2,Math.min(1,.35+.65*(n/base)));
  }
  function steeringScale(ship){
    if(!ship)return 1;
    const helm=(ship.crew||[]).find(c=>c.role==='helmsman');
    if(helm&&alive(helm)&&helm.currentShipId===ship.id)return 1;
    return ship.__v105HelmReplacementCrewId?.7:.35;
  }
  function groupForGun(ship,gunId){return gunGroups(ship).find(g=>g.gunIds.includes(gunId))||null;}
  function staffingSummary(ship){
    const groups=gunGroups(ship).map(g=>({id:g.id,side:g.side,half:g.half,gunIds:g.gunIds.slice(),assignedCrewId:g.assignedCrewId,replacementCrewId:g.replacementCrewId,multiplier:g.multiplier,disabled:g.disabled}));
    return{gunGroups:groups,aliveSailors:aliveSailorCount(ship),steeringScale:steeringScale(ship),firefightingScale:firefightingScale(ship)};
  }

  const api={assignPosts,gunGroups,refreshStaffing,staffingSummary,firefightingScale,steeringScale,groupForGun,gunEntries};
  root.V105CrewPosts=api;root.DHH.V105CrewPosts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
