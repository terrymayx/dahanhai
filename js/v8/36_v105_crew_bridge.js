(function(root){
  'use strict';

  const Crew=root.V105Crew||(root.DHH&&root.DHH.V105Crew),V104=root.V104Boarding||(root.DHH&&root.DHH.V104Boarding);
  if(!Crew||!V104)throw new Error('V10.5 crew bridge requires crew and V10.4 boarding');
  root.DHH=root.DHH||{};
  const G=root.V8ShipGrid,B=root.V8Battle||null;

  function alive(c){return Crew.aliveCrewMember(c);}
  function enemyFor(state){return V104.enemyFor(state);}
  function boardingCandidates(enemy){return Crew.aliveCrew(enemy,c=>c.boardingEligible&&c.currentShipId===c.ownerShipId);}
  function boardingPoints(state,enemy){
    const points=typeof V104.findBoardingPoints==='function'?V104.findBoardingPoints(state,enemy):[];
    if(points.length)return points;
    return[{x:state.player.x,y:state.player.y,gx:0,gy:0}];
  }
  function edgeSource(enemy,index){
    const c=(enemy&&enemy.crew||[]).filter(alive)[index%Math.max(1,(enemy&&enemy.crew||[]).filter(alive).length)];
    if(c)return{x:c.x,y:c.y};
    return{x:enemy.x,y:enemy.y};
  }
  function prepareBoarder(state,enemy,c,index,points){
    const target=points[index%points.length],src={x:c.x,y:c.y};
    c.team='enemy';c.currentShipId=state.player.id;c.task='boarding';c.targetId=null;
    c.fromX=src.x;c.fromY=src.y;c.toX=target.x;c.toY=target.y;c.entryPointId=(target.gx==null?'p'+index:target.gx+','+target.gy);
    c.state='waiting';c.spawnDelay=index*.18;c.jumpT=0;c.jumpDur=.34;c.landT=0;c.faceX=-1;c.faceY=0;
    return c;
  }
  function persistentDefenders(state){
    Crew.prepareShip(state.player);
    const captain=(state.player.crew||[]).find(c=>c.role==='captain')||null;
    if(captain){captain.team='player';captain.currentShipId=state.player.id;if(alive(captain)&&captain.state!=='dead')captain.state='v105Fight';}
    const allies=(state.player.crew||[]).filter(c=>c!==captain&&alive(c));
    for(const c of allies){c.team='player';c.currentShipId=state.player.id;c.state='v105Fight';}
    return{captain,allies};
  }
  function launchWave(state,enemy,selected){
    const b=V104.ensureState(state),points=boardingPoints(state,enemy),base=b.boarders||[],start=base.length;
    const wave=selected.map((c,i)=>prepareBoarder(state,enemy,c,i,points));
    b.boarders=base.concat(wave);b.pendingSpawns=wave.length;b.phase='boardingWave';b.waveStarted=true;b.__v105WaveIndex=(b.__v105WaveIndex||0)+1;
    return wave;
  }
  function mapPersistentBoarders(state,enemy){
    const b=V104.ensureState(state);enemy=enemy||enemyFor(state);
    if(!b||!b.active||!enemy)return[];
    Crew.prepareBattle(state);const defenders=persistentDefenders(state);b.captain=defenders.captain;b.allies=defenders.allies;b.boarders=[];
    const all=boardingCandidates(enemy),first=all.slice(0,Math.min(5,all.length)),rest=all.slice(first.length);
    b.__v105Persistent=true;b.__v105BoardingQueue=rest;b.__v105WaveIndex=0;b.enemyTotal=all.length;b.pendingSpawns=0;b.waveStarted=true;
    launchWave(state,enemy,first);
    return b.boarders;
  }
  function currentLiving(b){return (b.boarders||[]).filter(c=>alive(c)&&!['dead','overboard'].includes(c.state));}
  function guardQueuedOutcome(state){
    const b=state&&state.boarding;if(!b||!b.active||!b.__v105Persistent)return;
    if((b.__v105BoardingQueue||[]).length&&currentLiving(b).length===0)b.pendingSpawns=Math.max(1,Number(b.pendingSpawns)||0);
  }
  function launchQueuedWave(state){
    const b=state&&state.boarding;if(!b||!b.active||!b.__v105Persistent)return[];
    const queue=b.__v105BoardingQueue||[];if(!queue.length||currentLiving(b).length)return[];
    const enemy=enemyFor(state);if(!enemy||enemy.state!=='active'){b.__v105BoardingQueue=[];b.pendingSpawns=0;return[];}
    const next=queue.splice(0,Math.min(5,queue.length));b.pendingSpawns=0;return launchWave(state,enemy,next);
  }
  function normalizePersistentStates(state){
    const b=state&&state.boarding;if(!b||!b.__v105Persistent)return;
    if(b.captain&&alive(b.captain)&&b.captain.state==='fight')b.captain.state='v105Fight';
    for(const c of b.allies||[])if(alive(c)&&c.state==='fight')c.state='v105Fight';
    for(const c of b.boarders||[])if(alive(c)&&c.state==='fight')c.state='v105Fight';
  }
  function synchronizeDeaths(state){
    for(const ship of [state&&state.player,...(state&&state.enemies||[])].filter(Boolean))for(const c of ship.crew||[]){if(c.alive&&c.hp<=0)Crew.killCrew(c,{kind:'combat'});}
  }
  function releaseRetreatedCrew(state){
    const b=state&&state.boarding;if(!b||b.active||!b.__v105Persistent)return;
    for(const ship of state.enemies||[])for(const c of ship.crew||[]){
      if(c.ownerShipId!==ship.id)continue;
      if(alive(c)&&c.currentShipId!==c.ownerShipId){c.currentShipId=c.ownerShipId;c.state='idle';c.task='idle';c.x=ship.x;c.y=ship.y;}
      else if(!alive(c)&&c.currentShipId!==c.ownerShipId&&(Number(c.deadT)||0)>3)c.currentShipId=c.ownerShipId;
    }
  }
  function prepareState(state){
    Crew.prepareBattle(state);
    const V103=root.V103Broadside||null,Posts=root.V105CrewPosts||(root.DHH&&root.DHH.V105CrewPosts);
    for(const ship of [state.player,...(state.enemies||[])].filter(Boolean)){
      if(V103&&typeof V103.ensureBattery==='function')try{V103.ensureBattery(ship);}catch(e){}
      if(Posts&&typeof Posts.assignPosts==='function')try{Posts.assignPosts(ship);}catch(e){}
    }
    if(!Array.isArray(state.crewEvents))state.crewEvents=[];
    return state;
  }
  function wrapHitHandler(state){
    if(!state||state.__v105HitWrapped)return;state.__v105HitWrapped=true;
    const old=state.onCellHit;
    state.onCellHit=function(ship,cell,pos,res,p){
      if(typeof old==='function')old(ship,cell,pos,res,p);
      const Damage=root.V105CrewDamage||(root.DHH&&root.DHH.V105CrewDamage);if(Damage&&typeof Damage.directImpact==='function')Damage.directImpact(state,ship,pos,p);
    };
  }
  function updateSystems(state,dt){
    if(!state)return;prepareState(state);wrapHitHandler(state);synchronizeDeaths(state);
    const b=state.boarding;
    if(b&&b.active&&!b.__v105Persistent)mapPersistentBoarders(state,enemyFor(state));
    normalizePersistentStates(state);launchQueuedWave(state);normalizePersistentStates(state);synchronizeDeaths(state);
    const AI=root.V105CrewAI||(root.DHH&&root.DHH.V105CrewAI),Damage=root.V105CrewDamage||(root.DHH&&root.DHH.V105CrewDamage),Posts=root.V105CrewPosts||(root.DHH&&root.DHH.V105CrewPosts);
    if(Damage&&typeof Damage.update==='function')Damage.update(state,dt);
    if(AI&&typeof AI.update==='function')AI.update(state,dt);
    Crew.tickVisualTimers(state,dt);
    if(Posts)for(const ship of [state.player,...(state.enemies||[])].filter(Boolean))try{Posts.refreshStaffing(ship);}catch(e){}
    synchronizeDeaths(state);releaseRetreatedCrew(state);
  }
  function installBattle(){
    if(!B||B.__v105CrewBridgeInstalled)return false;B.__v105CrewBridgeInstalled=true;
    const oldNewGame=B.newGame,oldUpdate=B.update;
    if(typeof oldNewGame==='function')B.newGame=function(){const state=oldNewGame.apply(this,arguments);prepareState(state);wrapHitHandler(state);return state;};
    B.update=function(state,dt){
      if(!state)return typeof oldUpdate==='function'?oldUpdate(state,dt):undefined;
      prepareState(state);wrapHitHandler(state);guardQueuedOutcome(state);
      const out=typeof oldUpdate==='function'?oldUpdate(state,dt):undefined;
      if(state.paused)return out;updateSystems(state,Math.min(.05,Math.max(0,Number(dt)||0)));return out;
    };
    return true;
  }

  const api={prepareState,persistentDefenders,boardingCandidates,mapPersistentBoarders,launchQueuedWave,guardQueuedOutcome,normalizePersistentStates,synchronizeDeaths,releaseRetreatedCrew,updateSystems,installBattle};
  root.V105CrewBridge=api;root.DHH.V105CrewBridge=api;installBattle();
})(typeof globalThis!=='undefined'?globalThis:this);
