(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V10 fracture requires V8ShipGrid');

  const MAX_RADIUS=10;
  const MAX_PROPAGATION_NODES=18;
  const STRUCTURAL_TYPES=new Set(['hull','deck','beam','core']);
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function key(gx,gy){return gx+','+gy;}
  function normalize(x,y){const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};}

  function prepareCell(ship,cell){
    if(!cell)return cell;
    if(!Number.isFinite(cell.crackDepth))cell.crackDepth=0;
    if(!Number.isFinite(cell.crackDirX))cell.crackDirX=0;
    if(!Number.isFinite(cell.crackDirY))cell.crackDirY=0;
    if(!Number.isFinite(cell.crackRevision))cell.crackRevision=0;
    return cell;
  }

  function prepareShip(ship){
    if(!ship)return ship;
    if(!Array.isArray(ship.__v100CrackQueue))ship.__v100CrackQueue=[];
    if(!Number.isFinite(ship.__v100CrackRevision))ship.__v100CrackRevision=0;
    return ship;
  }

  function score(cell){
    if(!cell)return 0;
    return (Number(cell.crackDepth)||0)*1.6+(Number(cell.fracture)||0)+(Number(cell.fatigue)||0)*.75+(Number(cell.structuralStress)||0)*.35;
  }

  function queue(ship,cell,options){
    if(!ship||!cell)return;
    prepareShip(ship);prepareCell(ship,cell);
    const item={gx:cell.gx,gy:cell.gy,options:options||{}};
    const k=key(cell.gx,cell.gy);
    if(ship.__v100CrackQueue.some(x=>key(x.gx,x.gy)===k))return;
    ship.__v100CrackQueue.push(item);
    if(ship.__v100CrackQueue.length>8)ship.__v100CrackQueue.splice(0,ship.__v100CrackQueue.length-8);
  }

  function seedImpact(ship,cell,impact){
    if(!ship||!cell||!cell.alive||cell.detachedGone)return null;
    prepareShip(ship);prepareCell(ship,cell);
    impact=impact||{};
    const dir=normalize(Number(impact.vx)||0,Number(impact.vy)||0);
    const power=Math.max(0,Number(impact.power)||0);
    const grade=impact.grade||'';
    const gradeBoost=grade==='heavy'?.15:grade==='penetrated'?.09:grade==='ricochet'?.018:.045;
    const depthGain=clamp(.018+Math.sqrt(power)/95+gradeBoost,.018,.24);
    cell.crackDepth=clamp(cell.crackDepth+depthGain,0,1);
    const tear=normalize(-dir.y,dir.x),blend=.68;
    const mixed=normalize((cell.crackDirX||0)*(1-blend)+tear.x*blend,(cell.crackDirY||0)*(1-blend)+tear.y*blend);
    cell.crackDirX=mixed.x;cell.crackDirY=mixed.y;
    cell.crackRevision++;
    ship.__v100CrackRevision++;
    queue(ship,cell,{power,dirX:dir.x,dirY:dir.y,grade});
    return {depthGain,score:score(cell)};
  }

  function candidateScore(origin,cell,dir){
    prepareCell(null,cell);
    const dx=cell.gx-origin.gx,dy=cell.gy-origin.gy,d=Math.hypot(dx,dy)||1;
    const nd={x:dx/d,y:dy/d};
    const crackDir=normalize(origin.crackDirX||-dir.y,origin.crackDirY||dir.x);
    const alignment=Math.abs(nd.x*crackDir.x+nd.y*crackDir.y);
    const hpRatio=clamp((Number(cell.hp)||0)/Math.max(1,Number(cell.maxHp)||1),0,1);
    const typeBoost=(cell.type==='beam'||cell.type==='core')?.24:cell.type==='hull'?.13:.04;
    return alignment*.9+(1-hpRatio)*.65+(cell.fatigue||0)*.6+(cell.fracture||0)*.7+typeBoost-d*.025;
  }

  function propagate(ship,origin,options){
    if(!ship||!origin||!ship.cellMap)return [];
    prepareShip(ship);prepareCell(ship,origin);options=options||{};
    const power=Math.max(0,Number(options.power)||0);
    const dir=normalize(Number(options.dirX)||0,Number(options.dirY)||0);
    const radius=Math.min(MAX_RADIUS,Math.max(2,Math.round(3+Math.sqrt(power)/5.5)));
    const pool=[];
    for(let gy=Math.max(0,origin.gy-radius);gy<=Math.min((ship.gridHeight||0)-1,origin.gy+radius);gy++){
      for(let gx=Math.max(0,origin.gx-radius);gx<=Math.min((ship.gridWidth||0)-1,origin.gx+radius);gx++){
        const cell=ship.cellMap[key(gx,gy)];
        if(!cell||cell===origin||!cell.alive||cell.detachedGone||!STRUCTURAL_TYPES.has(cell.type))continue;
        const dist=Math.hypot(gx-origin.gx,gy-origin.gy);if(dist>radius)continue;
        pool.push({cell,dist,priority:candidateScore(origin,cell,dir)});
      }
    }
    pool.sort((a,b)=>b.priority-a.priority||a.dist-b.dist);
    const changed=[];
    const Structure=root.V99Structure||null;
    let damageBudget=4;
    for(const item of pool.slice(0,MAX_PROPAGATION_NODES)){
      const c=item.cell;prepareCell(ship,c);
      const attenuation=Math.max(.08,1-item.dist/(radius+1));
      const gain=clamp((origin.crackDepth||0)*attenuation*(.11+Math.sqrt(power)*.0025),.004,.095);
      if(gain<=.0045&&item.priority<.25)continue;
      c.crackDepth=clamp(c.crackDepth+gain,0,1);
      const from=normalize(c.gx-origin.gx,c.gy-origin.gy);
      const mixed=normalize((c.crackDirX||0)*.45+from.x*.55,(c.crackDirY||0)*.45+from.y*.55);
      c.crackDirX=mixed.x;c.crackDirY=mixed.y;c.crackRevision++;
      ship.__v100CrackRevision++;
      const s=score(c);
      if(Structure&&s>1.55&&typeof Structure.queueLocalSolve==='function')Structure.queueLocalSolve(ship,c);
      if(s>2.6&&damageBudget>0&&typeof G.damageCell==='function'){
        const dmg=Math.min(damageBudget,Math.max(.6,(s-2.6)*1.8));
        damageBudget-=dmg;G.damageCell(ship,c,dmg);
      }
      changed.push(c);
    }
    return changed;
  }

  function processShip(ship){
    if(!ship||!ship.__v100CrackQueue||!ship.__v100CrackQueue.length)return [];
    // V10.1 replaces the broad radius-pool propagation with endpoint-only branches.
    // Keep seedImpact as the material crack seed, but discard queued V100 spreading once V101 is active.
    if(root.V101CrackBranches){ship.__v100CrackQueue.length=0;return [];}
    const item=ship.__v100CrackQueue.shift(),cell=ship.cellMap&&ship.cellMap[key(item.gx,item.gy)];
    if(!cell||!cell.alive||cell.detachedGone)return [];
    return propagate(ship,cell,item.options||{});
  }

  const B=root.V8Battle||null;
  if(B&&typeof B.update==='function'&&!B.__v100FractureWrapped){
    B.__v100FractureWrapped=true;
    const originalUpdate=B.update;
    B.update=function(state,dt){
      originalUpdate(state,dt);
      if(!state||!(dt>0))return;
      processShip(state.player);
      for(const ship of state.enemies||[])processShip(ship);
    };
  }

  root.V100Fracture={MAX_RADIUS,MAX_PROPAGATION_NODES,prepareCell,prepareShip,score,queue,seedImpact,propagate,processShip};
})(typeof globalThis!=='undefined'?globalThis:this);
