(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V10.4 boarding requires ship grid');
  root.DHH=root.DHH||{};

  const CONTACT_GAP=30;
  const APPROACH_RANGE=560;
  const CAPTAIN={hp:140,speed:95,damage:28,attackRange:26,attackCd:.48};
  const ALLY={hp:65,speed:70,damage:11,attackRange:21,attackCd:.75};
  const BOARDER={
    sloop:{min:4,max:6,hp:48,speed:65,damage:9,attackCd:.86},
    gunship:{min:7,max:9,hp:56,speed:68,damage:11,attackCd:.82},
    manowar:{min:10,max:14,hp:64,speed:70,damage:13,attackCd:.78}
  };
  const WALKABLE=new Set(['deck','cannon','beam','core','rudder','mast','powder']);

  function clamp(v,a,b){return v<a?a:v>b?b:v;}
  function norm(x,y){const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d,d};}
  function key(gx,gy){return gx+','+gy;}
  function aliveUnit(u){return !!u&&u.hp>0&&!['dead','overboard'].includes(u.state);}
  function randInt(a,b){return a+Math.floor(Math.random()*(b-a+1));}

  function ensureState(state){
    if(!state)return null;
    if(!state.boarding){
      state.boarding={
        active:false,result:null,enemyShipId:null,phase:'navalCombat',captain:null,allies:[],boarders:[],
        enemyTotal:0,pendingSpawns:0,waveStarted:false,navCache:null,navCacheRevision:-1,contact:null,
        retreatT:0,startedAt:0
      };
    }
    if(!Array.isArray(state.boarding.allies))state.boarding.allies=[];
    if(!Array.isArray(state.boarding.boarders))state.boarding.boarders=[];
    return state.boarding;
  }

  function isBoarding(state){return !!(state&&state.boarding&&state.boarding.active);}
  function enemyFor(state){
    const b=ensureState(state);if(!b||!b.enemyShipId)return null;
    return (state.enemies||[]).find(e=>e&&e.id===b.enemyShipId)||null;
  }

  function markStructureDirty(ship){
    if(!ship)return 0;
    ship.__v104NavRevision=(Number(ship.__v104NavRevision)||0)+1;
    return ship.__v104NavRevision;
  }

  function mainKeys(ship){
    try{return typeof G.mainConnectedKeys==='function'?G.mainConnectedKeys(ship):null;}catch(e){return null;}
  }
  function canWalkCell(ship,cell,main){
    if(!cell||!cell.alive||cell.detachedGone||!WALKABLE.has(cell.type))return false;
    if(main&&main.size&&!main.has(key(cell.gx,cell.gy)))return false;
    return true;
  }
  function buildWalkable(state){
    const b=ensureState(state),ship=state&&state.player;
    if(!ship)return{nodes:[],byKey:Object.create(null),revision:0};
    const revision=Number(ship.__v104NavRevision)||0;
    if(b.navCache&&b.navCacheRevision===revision)return b.navCache;
    const main=mainKeys(ship),nodes=[],byKey=Object.create(null);
    for(const cell of ship.cells||[]){
      if(!canWalkCell(ship,cell,main))continue;
      const p=G.cellCenterWorld(ship,cell),node={gx:cell.gx,gy:cell.gy,x:p.x,y:p.y,cell};
      nodes.push(node);byKey[key(cell.gx,cell.gy)]=node;
    }
    b.navCache={nodes,byKey,revision};b.navCacheRevision=revision;
    return b.navCache;
  }
  function isWalkable(state,gx,gy){return !!buildWalkable(state).byKey[key(gx,gy)];}
  function nearestWalkable(state,x,y){
    const nav=buildWalkable(state);let best=null,bestD=Infinity;
    for(const n of nav.nodes){const dx=n.x-x,dy=n.y-y,d=dx*dx+dy*dy;if(d<bestD){bestD=d;best=n;}}
    return best;
  }
  function neighbors(state,node){
    if(!node)return[];const map=buildWalkable(state).byKey,out=[];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=map[key(node.gx+dx,node.gy+dy)];if(n)out.push(n);}
    return out;
  }
  function pointWalkable(state,x,y){
    const ship=state.player,l=G.worldToLocal(ship,x,y),g=G.localToGrid(ship,l.x,l.y);
    return buildWalkable(state).byKey[key(g.gx,g.gy)]||null;
  }
  function projectMove(state,u,nx,ny){
    const hit=pointWalkable(state,nx,ny);
    if(hit){u.x=nx;u.y=ny;return true;}
    const near=nearestWalkable(state,nx,ny);
    if(!near)return false;
    const d=Math.hypot(near.x-nx,near.y-ny);
    if(d<=state.player.cellSize*1.45){u.x=near.x;u.y=near.y;return true;}
    return false;
  }

  function edgeCells(ship,maxCount){
    const arr=[];
    for(const c of ship&&ship.cells||[]){
      if(!c||!c.alive||c.detachedGone)continue;
      let outer=false;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=ship.cellMap&&ship.cellMap[key(c.gx+dx,c.gy+dy)];if(!n||!n.alive){outer=true;break;}}
      if(outer)arr.push(c);
    }
    if(arr.length<=maxCount)return arr;
    const out=[],step=arr.length/maxCount;for(let i=0;i<maxCount;i++)out.push(arr[Math.floor(i*step)]);return out;
  }
  function contactCandidateRadius(a,b){
    const ar=Math.hypot(a.gridWidth*a.cellSize,a.gridHeight*a.cellSize)*.5;
    const br=Math.hypot(b.gridWidth*b.cellSize,b.gridHeight*b.cellSize)*.5;
    return ar+br+55;
  }
  function sampledLiveEdgeDistance(a,b){
    const aa=edgeCells(a,36),bb=edgeCells(b,28);let best=Infinity,bestPair=null;
    for(const ca of aa){const pa=G.cellCenterWorld(a,ca);for(const cb of bb){const pb=G.cellCenterWorld(b,cb),d=Math.hypot(pa.x-pb.x,pa.y-pb.y);if(d<best){best=d;bestPair={player:pa,enemy:pb,playerCell:ca,enemyCell:cb};}}}
    return{distance:best,pair:bestPair};
  }
  function tryContact(state,enemy){
    if(!state||!state.player||!enemy||enemy.state!=='active'||isBoarding(state))return false;
    if(Math.hypot(enemy.x-state.player.x,enemy.y-state.player.y)>contactCandidateRadius(state.player,enemy))return false;
    const hit=sampledLiveEdgeDistance(state.player,enemy);
    if(hit.distance>CONTACT_GAP)return false;
    ensureState(state).contact=hit.pair;return hit.pair||true;
  }

  function startApproach(state,enemy){
    const b=ensureState(state);if(!b||b.active||!enemy||enemy.state!=='active')return false;
    for(const e of state.enemies||[])if(e&&e!==enemy&&e.__v104BoardingMode==='boardingApproach')e.__v104BoardingMode='navalCombat';
    enemy.__v104BoardingMode='boardingApproach';enemy.__v104BoardingTarget='player';b.phase='boardingApproach';return true;
  }

  function unitAtNode(node,team,role,cfg,id){
    return{id,team,role,x:node.x,y:node.y,hp:cfg.hp,maxHp:cfg.hp,speed:cfg.speed,damage:cfg.damage,
      attackRange:cfg.attackRange||21,attackCd:cfg.attackCd,attackTimer:0,state:'fight',faceX:team==='enemy'?-1:1,faceY:0,hitT:0};
  }
  function centralNodes(state,count){
    const nav=buildWalkable(state),p=state.player,arr=nav.nodes.slice();
    arr.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));return arr.slice(0,Math.max(1,count));
  }
  function spawnDefenders(state){
    const b=ensureState(state),nodes=centralNodes(state,8);if(!nodes.length)return b;
    if(!b.captain)b.captain=unitAtNode(nodes[0],'player','captain',CAPTAIN,'captain');
    if(!b.allies.length){
      const count=clamp(5,4,6);for(let i=0;i<count;i++){const n=nodes[(i+1)%nodes.length]||nodes[0];b.allies.push(unitAtNode(n,'player','sailor',ALLY,'ally-'+i));}
    }
    return b;
  }

  function findBoardingPoints(state,enemy){
    const nav=buildWalkable(state);if(!nav.nodes.length)return[];
    const ex=enemy?enemy.x:state.player.x+1,ey=enemy?enemy.y:state.player.y;
    const arr=nav.nodes.slice().sort((a,b)=>Math.hypot(a.x-ex,a.y-ey)-Math.hypot(b.x-ex,b.y-ey));
    const out=[];
    for(const n of arr){if(out.every(o=>Math.hypot(o.x-n.x,o.y-n.y)>=state.player.cellSize*2.2)){out.push(n);if(out.length>=3)break;}}
    if(out.length<2&&arr.length>1)out.push(arr[Math.min(arr.length-1,Math.floor(arr.length*.25))]);
    return out;
  }
  function spawnBoardingWave(state,enemy){
    const b=ensureState(state);if(!b.active||b.waveStarted)return b.boarders;
    enemy=enemy||enemyFor(state);if(!enemy)return[];
    const cfg=BOARDER[enemy.kind]||BOARDER.sloop,total=randInt(cfg.min,cfg.max),points=findBoardingPoints(state,enemy);
    b.enemyTotal=total;b.pendingSpawns=total;b.waveStarted=true;b.phase='boardingWave';
    for(let i=0;i<total;i++){
      const target=points[i%Math.max(1,points.length)]||nearestWalkable(state,state.player.x,state.player.y);if(!target)break;
      const src=G.cellCenterWorld(enemy,edgeCells(enemy,24)[i%Math.max(1,edgeCells(enemy,24).length)]||enemy.cells[0]);
      const u=unitAtNode(target,'enemy','boarder',Object.assign({attackRange:21},cfg),'boarder-'+i);
      u.x=src.x;u.y=src.y;u.fromX=src.x;u.fromY=src.y;u.toX=target.x;u.toY=target.y;u.entryPointId=key(target.gx,target.gy);
      u.state='waiting';u.spawnDelay=i*.16;u.jumpT=0;u.jumpDur=.34;u.landT=0;
      b.boarders.push(u);
    }
    return b.boarders;
  }

  function beginBoarding(state,enemy){
    const b=ensureState(state);if(!state||!state.player||!enemy||enemy.state!=='active')return false;
    if(b.active&&b.enemyShipId!==enemy.id)return false;
    b.active=true;b.result=null;b.enemyShipId=enemy.id;b.phase='boardingLocked';b.startedAt=state.time||0;b.waveStarted=false;b.enemyTotal=0;b.pendingSpawns=0;b.boarders=[];b.contact=b.contact||sampledLiveEdgeDistance(state.player,enemy).pair;
    enemy.__v104BoardingMode='boardingLocked';enemy.__v104SuppressBroadside=true;enemy.speed=Math.min(Number(enemy.speed)||0,10);
    spawnDefenders(state);return true;
  }

  function endBoarding(state,result){
    const b=ensureState(state),enemy=enemyFor(state);b.active=false;b.result=result||'defended';b.phase='boardingRetreat';b.retreatT=1.25;b.pendingSpawns=0;
    if(enemy){enemy.__v104SuppressBroadside=false;enemy.__v104BoardingMode='boardingRetreat';enemy.__v104BoardingRetreatT=1.25;enemy.__v103Salvo=null;}
    return b.result;
  }

  function setCaptainInput(state,input){
    if(!state)return;const x=Number(input&&input.x)||0,y=Number(input&&input.y)||0,n=norm(x,y);
    state.__v104CaptainInput={x:n.d>1?n.x:x,y:n.d>1?n.y:y,attack:!!(input&&input.attack)};
  }
  function moveUnitToward(state,u,tx,ty,dt){
    const n=norm(tx-u.x,ty-u.y);if(n.d<1)return false;u.faceX=n.x;u.faceY=n.y;return projectMove(state,u,u.x+n.x*u.speed*dt,u.y+n.y*u.speed*dt);
  }
  function moveCaptain(state,dt,input){
    const b=ensureState(state),c=b.captain;if(!b.active||!c||!aliveUnit(c))return;
    input=input||state.__v104CaptainInput||{x:0,y:0};const n=norm(Number(input.x)||0,Number(input.y)||0);
    if(n.d>.05){c.faceX=n.x;c.faceY=n.y;projectMove(state,c,c.x+n.x*c.speed*dt,c.y+n.y*c.speed*dt);}
    if(input.attack)captainAttack(state);
  }

  function damageUnit(u,damage){if(!aliveUnit(u)||!(damage>0))return false;u.hp=Math.max(0,u.hp-damage);u.hitT=.1;if(u.hp<=0)u.state='dead';return true;}
  function captainAttack(state){
    const b=ensureState(state),c=b.captain;if(!b.active||!aliveUnit(c)||c.attackTimer>0)return 0;c.attackTimer=c.attackCd;
    const fx=Number(c.faceX)||1,fy=Number(c.faceY)||0,candidates=[];
    for(const e of b.boarders){if(!aliveUnit(e)||e.state!=='fight')continue;const dx=e.x-c.x,dy=e.y-c.y,d=Math.hypot(dx,dy)||1,dot=(dx/d)*fx+(dy/d)*fy;if(d<=c.attackRange&&dot>=-.05)candidates.push({e,d,dot});}
    candidates.sort((a,z)=>z.dot-a.dot||a.d-z.d);let hits=0;
    for(const item of candidates.slice(0,2)){damageUnit(item.e,c.damage);hits++;}
    if(hits&&state.fx){state.fx.push({k:'v104Slash',x:c.x+fx*14,y:c.y+fy*14,t:0,dur:.16,r:24});if(state.fx.length>320)state.fx.splice(0,state.fx.length-320);}
    return hits;
  }

  function nearestAlive(from,list){let best=null,bd=Infinity;for(const u of list){if(!aliveUnit(u)||u.state!=='fight')continue;const d=Math.hypot(u.x-from.x,u.y-from.y);if(d<bd){bd=d;best=u;}}return best?{unit:best,d:bd}:null;}
  function aiTick(state,u,targets,dt){
    if(!aliveUnit(u)||u.state!=='fight')return;u.attackTimer=Math.max(0,(u.attackTimer||0)-dt);const found=nearestAlive(u,targets);if(!found)return;
    const t=found.unit,n=norm(t.x-u.x,t.y-u.y);u.faceX=n.x;u.faceY=n.y;
    if(found.d<=u.attackRange){if(u.attackTimer<=0){damageUnit(t,u.damage);u.attackTimer=u.attackCd;}}else moveUnitToward(state,u,t.x,t.y,dt);
  }
  function updateAlliedAI(state,dt){
    const b=ensureState(state);for(const a of b.allies)aiTick(state,a,b.boarders,dt);
  }
  function updateBoarders(state,dt){
    const b=ensureState(state),targets=[b.captain,...b.allies];
    for(const u of b.boarders){
      if(!aliveUnit(u))continue;
      if(u.state==='waiting'){
        u.spawnDelay-=dt;if(u.spawnDelay<=0){u.state='boardingJump';u.jumpT=0;b.pendingSpawns=Math.max(0,b.pendingSpawns-1);}continue;
      }
      if(u.state==='boardingJump'){
        u.jumpT+=dt;const p=clamp(u.jumpT/u.jumpDur,0,1),arc=Math.sin(p*Math.PI)*18;u.x=u.fromX+(u.toX-u.fromX)*p;u.y=u.fromY+(u.toY-u.fromY)*p-arc;
        if(p>=1){const land=nearestWalkable(state,u.toX,u.toY);if(!land){u.state='overboard';u.hp=0;}else{u.x=land.x;u.y=land.y;u.state='land';u.landT=.12;}}continue;
      }
      if(u.state==='land'){u.landT-=dt;if(u.landT<=0)u.state='fight';continue;}
      aiTick(state,u,targets,dt);
    }
  }
  function resolveMelee(state,dt){
    const b=ensureState(state);if(!b.active)return;moveCaptain(state,dt,state.__v104CaptainInput);updateAlliedAI(state,dt);updateBoarders(state,dt);
  }

  function burningNearUnit(state,u){
    if(!state||!state.player||!u)return false;const ship=state.player,l=G.worldToLocal(ship,u.x,u.y),g=G.localToGrid(ship,l.x,l.y);
    for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const c=ship.cellMap&&ship.cellMap[key(g.gx+dx,g.gy+dy)];if(c&&c.alive&&c.burning)return true;}
    return false;
  }
  function applyEnvironmentDamage(state,dt){
    const b=ensureState(state),units=[b.captain,...b.allies,...b.boarders];for(const u of units)if(aliveUnit(u)&&burningNearUnit(state,u))damageUnit(u,7.5*dt);
  }
  function checkBoardingOutcome(state){
    const b=ensureState(state);if(!b.active)return b.result;
    if(!b.captain||b.captain.hp<=0){if(b.captain)b.captain.state='dead';state.state='lose';b.result='captainDown';b.active=false;const e=enemyFor(state);if(e)e.__v104SuppressBroadside=false;return b.result;}
    const living=b.boarders.some(aliveUnit);if(b.waveStarted&&!living&&b.pendingSpawns<=0)return endBoarding(state,'defended');
    return null;
  }

  function updateApproach(state,enemy,dt){
    if(!state||!state.player||!enemy||enemy.state!=='active')return false;
    const p=state.player,dx=p.x-enemy.x,dy=p.y-enemy.y,n=norm(dx,dy),speed=Math.max(34,Math.min(78,Number(enemy.speed)||60));
    enemy.x+=n.x*speed*dt;enemy.y+=n.y*speed*dt*.82;
    const desired=Math.atan2(dy,dx),diff=Math.atan2(Math.sin(desired-(enemy.rotation||0)),Math.cos(desired-(enemy.rotation||0))),step=Math.min(Math.abs(diff),1.05*dt);enemy.rotation=(enemy.rotation||0)+Math.sign(diff)*step;
    const hit=tryContact(state,enemy);if(hit){beginBoarding(state,enemy);return true;}return false;
  }
  function chooseApproacher(state){
    const b=ensureState(state);if(b.active)return null;
    const existing=(state.enemies||[]).find(e=>e&&e.state==='active'&&e.__v104BoardingMode==='boardingApproach');if(existing)return existing;
    let best=null,bd=Infinity;for(const e of state.enemies||[]){if(!e||e.state!=='active'||e.__v104BoardingMode==='boardingRetreat')continue;const d=Math.hypot(e.x-state.player.x,e.y-state.player.y);if(d<APPROACH_RANGE&&d<bd){bd=d;best=e;}}
    if(best)startApproach(state,best);return best;
  }
  function preUpdate(state,dt){
    const b=ensureState(state);if(!state||!state.player)return;
    if(b.active){const e=enemyFor(state);if(e){e.__v104SuppressBroadside=true;e.__v104BoardingMode='boardingLocked';}return;}
    for(const e of state.enemies||[]){if(e&&e.__v104BoardingMode==='boardingRetreat'){e.__v104BoardingRetreatT=Math.max(0,(e.__v104BoardingRetreatT||0)-dt);if(e.__v104BoardingRetreatT<=0)e.__v104BoardingMode='navalCombat';}}
    const e=chooseApproacher(state);if(e)updateApproach(state,e,dt);
  }

  function update(state,dt){
    const b=ensureState(state);if(!b)return;
    if(b.active){
      if(!b.waveStarted){const e=enemyFor(state);if(e)spawnBoardingWave(state,e);}
      for(const u of [b.captain,...b.allies,...b.boarders])if(u){u.attackTimer=Math.max(0,(u.attackTimer||0)-dt);u.hitT=Math.max(0,(u.hitT||0)-dt);}
      resolveMelee(state,dt);applyEnvironmentDamage(state,dt);checkBoardingOutcome(state);
    }
  }

  const api={
    CONTACT_GAP,APPROACH_RANGE,CAPTAIN,ALLY,BOARDER,ensureState,isBoarding,enemyFor,markStructureDirty,buildWalkable,isWalkable,nearestWalkable,neighbors,
    contactCandidateRadius,sampledLiveEdgeDistance,tryContact,startApproach,beginBoarding,endBoarding,spawnDefenders,setCaptainInput,moveCaptain,captainAttack,
    findBoardingPoints,spawnBoardingWave,updateBoarders,updateAlliedAI,resolveMelee,applyEnvironmentDamage,checkBoardingOutcome,updateApproach,chooseApproacher,preUpdate,update
  };
  root.V104Boarding=api;root.DHH.V104Boarding=api;
})(typeof globalThis!=='undefined'?globalThis:this);
