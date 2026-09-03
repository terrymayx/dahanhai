(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle||null;
  if(!G)throw new Error('V10.1 crack branches require V8ShipGrid');

  const MAX_ACTIVE_BRANCHES=32;
  const BRANCH_TICK=.18;
  const MAX_NODES_PER_BRANCH=18;
  const NEIGHBORS8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const STRUCTURAL_TYPES=new Set(['hull','deck','beam','core']);
  let nextBranchId=1;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function key(gx,gy){return gx+','+gy;}
  function normalize(x,y){const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};}
  function cellAt(ship,gx,gy){return ship&&ship.cellMap&&ship.cellMap[key(gx,gy)]||null;}
  function isStructural(cell){return !!(cell&&cell.alive&&!cell.detachedGone&&STRUCTURAL_TYPES.has(cell.type));}

  function prepareShip(ship){
    if(!ship)return ship;
    if(!Array.isArray(ship.__v101CrackBranches))ship.__v101CrackBranches=[];
    if(!Number.isFinite(ship.__v101CrackTick))ship.__v101CrackTick=0;
    return ship;
  }

  function branchDirection(ship,cell,impact){
    impact=impact||{};
    const existing=normalize(Number(cell&&cell.crackDirX)||0,Number(cell&&cell.crackDirY)||0);
    const iv=normalize(Number(impact.vx)||Number(impact.dirX)||0,Number(impact.vy)||Number(impact.dirY)||0);
    const longitudinal=ship&&ship.kind==='player'?{x:0,y:1}:{x:1,y:0};
    const transverse={x:-longitudinal.y,y:longitudinal.x};
    let materialAxis;
    if(cell&&(cell.type==='beam'||cell.type==='core'))materialAxis=longitudinal;
    else materialAxis=Math.abs(existing.x)+Math.abs(existing.y)>.15?existing:longitudinal;
    const tear={x:-iv.y,y:iv.x};
    return normalize(materialAxis.x*.62+tear.x*.25+existing.x*.13,materialAxis.y*.62+tear.y*.25+existing.y*.13);
  }

  function findMergeBranch(ship,cell,dir){
    for(const branch of ship.__v101CrackBranches||[]){
      if(!branch||branch.done)continue;
      const end=branch.end||{};
      if(Math.hypot((end.gx||0)-cell.gx,(end.gy||0)-cell.gy)>2.2)continue;
      const align=Math.abs((branch.dirX||0)*dir.x+(branch.dirY||0)*dir.y);
      if(align>.72)return branch;
    }
    return null;
  }

  function trimBranches(ship){
    const list=ship.__v101CrackBranches||[];
    if(list.length<=MAX_ACTIVE_BRANCHES)return;
    list.sort((a,b)=>(b.strength||0)-(a.strength||0)||(a.age||0)-(b.age||0));
    list.length=MAX_ACTIVE_BRANCHES;
  }

  function registerImpact(ship,cell,impact){
    if(!ship||!isStructural(cell))return null;
    prepareShip(ship);impact=impact||{};
    const power=Math.max(0,Number(impact.power)||0),grade=impact.grade||'';
    const meaningful=grade==='heavy'||grade==='penetrated'||(Number(cell.crackDepth)||0)>.22||power>=52;
    if(!meaningful)return null;
    const dir=branchDirection(ship,cell,impact);
    let branch=findMergeBranch(ship,cell,dir);
    const gain=clamp(.10+Math.sqrt(power)/45+(grade==='heavy'?.22:grade==='penetrated'?.12:0),.10,.68);
    if(branch){
      branch.strength=clamp((branch.strength||0)+gain*.48,0,1.6);
      branch.dirX=normalize((branch.dirX||0)*.65+dir.x*.35,(branch.dirY||0)*.65+dir.y*.35).x;
      branch.dirY=normalize((branch.dirX||0)*.65+dir.x*.35,(branch.dirY||0)*.65+dir.y*.35).y;
      branch.tick=Math.min(branch.tick||0,.04);
      return branch;
    }
    branch={
      id:nextBranchId++,start:{gx:cell.gx,gy:cell.gy},end:{gx:cell.gx,gy:cell.gy},
      dirX:dir.x,dirY:dir.y,strength:gain,age:0,tick:0,nodes:[key(cell.gx,cell.gy)],branchUsed:false,done:false
    };
    ship.__v101CrackBranches.push(branch);trimBranches(ship);return branch;
  }

  function endpointScore(ship,branch,from,cell){
    if(!isStructural(cell))return -Infinity;
    const step=normalize(cell.gx-from.gx,cell.gy-from.gy);
    const alignment=step.x*(branch.dirX||0)+step.y*(branch.dirY||0);
    const hpRatio=clamp((Number(cell.hp)||0)/Math.max(1,Number(cell.maxHp)||1),0,1);
    const weakness=(1-hpRatio)*.82+(Number(cell.fatigue)||0)*.80+(Number(cell.fracture)||0)*.94+(Number(cell.crackDepth)||0)*1.05;
    const typeBias=(cell.type==='beam'||cell.type==='core')?.18:cell.type==='hull'?.10:.03;
    const revisit=branch.nodes.includes(key(cell.gx,cell.gy))?-2.5:0;
    return alignment*1.35+weakness+typeBias+revisit;
  }

  function extendBranch(ship,branch){
    if(!ship||!branch||branch.done)return null;
    const from=cellAt(ship,branch.end.gx,branch.end.gy);
    if(!isStructural(from)){branch.done=true;return null;}
    let best=null,bestScore=-Infinity;
    for(const [dx,dy] of NEIGHBORS8){
      const cell=cellAt(ship,from.gx+dx,from.gy+dy);if(!isStructural(cell))continue;
      const s=endpointScore(ship,branch,from,cell);
      if(s>bestScore){bestScore=s;best=cell;}
    }
    if(!best||bestScore<.18){branch.done=true;return null;}

    const step=normalize(best.gx-from.gx,best.gy-from.gy);
    const dir=normalize((branch.dirX||0)*.78+step.x*.22,(branch.dirY||0)*.78+step.y*.22);
    branch.dirX=dir.x;branch.dirY=dir.y;branch.end={gx:best.gx,gy:best.gy};branch.nodes.push(key(best.gx,best.gy));
    branch.strength=Math.max(.05,(branch.strength||0)*.94);
    if(branch.nodes.length>=MAX_NODES_PER_BRANCH)branch.done=true;

    best.crackDepth=clamp((Number(best.crackDepth)||0)+.035+branch.strength*.055,0,1);
    best.crackDirX=dir.x;best.crackDirY=dir.y;best.crackRevision=(Number(best.crackRevision)||0)+1;
    ship.__v100CrackRevision=(Number(ship.__v100CrackRevision)||0)+1;

    const Structure=root.V99Structure||null;
    if(Structure&&typeof Structure.queueLocalSolve==='function'&&(best.crackDepth>.48||(best.fatigue||0)>.55))Structure.queueLocalSolve(ship,best);
    return best;
  }

  function updateShip(ship,dt){
    if(!ship||ship.state==='gone'||!(dt>0))return [];
    prepareShip(ship);const changed=[];
    for(const branch of ship.__v101CrackBranches){branch.age=(branch.age||0)+dt;branch.tick=(branch.tick||0)-dt;}
    let budget=1;
    for(const branch of ship.__v101CrackBranches){
      if(budget<=0)break;
      if(branch.done||branch.tick>0)continue;
      const cell=extendBranch(ship,branch);branch.tick=BRANCH_TICK+(branch.id%3)*.012;
      if(cell){changed.push(cell);budget--;}
    }
    ship.__v101CrackBranches=ship.__v101CrackBranches.filter(b=>!b.done||b.age<2.5);
    trimBranches(ship);return changed;
  }

  function activeBranches(ship){prepareShip(ship);return ship.__v101CrackBranches.filter(b=>!b.done);}

  if(B&&typeof B.update==='function'&&!B.__v101CrackBranchesWrapped){
    B.__v101CrackBranchesWrapped=true;
    const originalUpdate=B.update;
    B.update=function(state,dt){
      originalUpdate(state,dt);if(!state||!(dt>0))return;
      updateShip(state.player,dt);for(const ship of state.enemies||[])updateShip(ship,dt);
    };
  }

  root.V101CrackBranches={MAX_ACTIVE_BRANCHES,BRANCH_TICK,MAX_NODES_PER_BRANCH,NEIGHBORS8,prepareShip,registerImpact,extendBranch,updateShip,activeBranches};
})(typeof globalThis!=='undefined'?globalThis:this);
