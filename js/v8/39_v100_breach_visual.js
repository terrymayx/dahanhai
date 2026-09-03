(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V10 breach visual requires V8ShipGrid');

  const caches=new WeakMap();
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const MAX_POINTS=30;

  function key(gx,gy){return gx+','+gy;}
  function revisionKey(ship){return `${Number(ship.__v99TopologyRevision)||0}:${Number(ship.__v99MaterialRevision)||0}:${Number(ship.__v100CrackRevision)||0}`;}
  function relevant(cell){return cell&&!cell.detachedGone&&((!cell.alive)||(cell.alive&&(Number(cell.crackDepth)||0)>.72));}

  function buildRegions(ship){
    const cells=(ship&&ship.cells||[]).filter(relevant),map=new Map(cells.map(c=>[key(c.gx,c.gy),c])),seen=new Set(),regions=[];
    for(const start of cells){
      const sk=key(start.gx,start.gy);if(seen.has(sk))continue;
      const q=[start],group=[];seen.add(sk);
      while(q.length){
        const c=q.pop();group.push(c);
        for(const [dx,dy] of DIRS){const k=key(c.gx+dx,c.gy+dy),n=map.get(k);if(n&&!seen.has(k)){seen.add(k);q.push(n);}}
      }
      regions.push({cells:group,hasDead:group.some(c=>!c.alive),maxCrack:group.reduce((m,c)=>Math.max(m,Number(c.crackDepth)||0),0)});
    }
    return regions;
  }

  function traceRegion(ship,region){
    const cs=ship.cellSize||8,raw=[];
    let cx=0,cy=0;
    for(const cell of region.cells){const p=G.cellCenterLocal(ship,cell);cx+=p.x;cy+=p.y;}
    cx/=Math.max(1,region.cells.length);cy/=Math.max(1,region.cells.length);
    for(const cell of region.cells){
      const p=G.cellCenterLocal(ship,cell),r=cs*(cell.alive?.62:1.02);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,noise=1+Math.sin((cell.gx*13+cell.gy*7+i)*1.73)*.10;
        raw.push({x:p.x+Math.cos(a)*r*noise,y:p.y+Math.sin(a)*r*(.88+noise*.12)});
      }
    }
    raw.sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
    const stride=Math.max(1,Math.ceil(raw.length/MAX_POINTS)),points=[];
    for(let i=0;i<raw.length;i+=stride)points.push(raw[i]);
    if(points.length<4&&raw.length)points.push(...raw.slice(points.length,4));
    return {points,center:{x:cx,y:cy},hasDead:region.hasDead,maxCrack:region.maxCrack,cells:region.cells};
  }

  function ensure(ship){
    if(!ship)return {revision:'',regions:[]};
    const rev=revisionKey(ship),existing=caches.get(ship);
    if(existing&&existing.revision===rev)return existing;
    const regions=buildRegions(ship).map(r=>traceRegion(ship,r)).filter(r=>r.points.length>=3);
    const cache={revision:rev,regions};
    caches.set(ship,cache);ship.__v100BreachVisual=cache;
    return cache;
  }

  function smoothPath(ctx,points){
    if(!points||points.length<3)return;
    const n=points.length,p0=points[0];ctx.beginPath();ctx.moveTo(p0.x,p0.y);
    for(let i=0;i<n;i++){
      const a=points[i],b=points[(i+1)%n],c=points[(i+2)%n];
      const m1={x:(a.x+b.x)/2,y:(a.y+b.y)/2},m2={x:(b.x+c.x)/2,y:(b.y+c.y)/2};
      if(i===0)ctx.quadraticCurveTo(a.x,a.y,m1.x,m1.y);
      ctx.bezierCurveTo(b.x,b.y,b.x,b.y,m2.x,m2.y);
    }
    ctx.closePath();
  }

  function drawCrackTears(ctx,region,ship){
    const cs=ship.cellSize||8,center=region.center;
    ctx.save();ctx.strokeStyle='rgba(57,30,20,.90)';ctx.lineWidth=Math.max(1,cs*.17);ctx.lineCap='round';
    const limit=Math.min(10,region.cells.length);
    for(let i=0;i<limit;i++){
      const cell=region.cells[(i*3)%region.cells.length],depth=Math.max(Number(cell.crackDepth)||0,Number(cell.fracture)||0);
      if(depth<.25&&!region.hasDead)continue;
      const p=G.cellCenterLocal(ship,cell),dx=Number(cell.crackDirX)||((p.x-center.x)||1),dy=Number(cell.crackDirY)||((p.y-center.y)||0),d=Math.hypot(dx,dy)||1,len=cs*(.55+depth*1.25);
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+dx/d*len*.45+dy/d*cs*.18,p.y+dy/d*len*.45-dx/d*cs*.18,p.x+dx/d*len,p.y+dy/d*len);ctx.stroke();
    }
    ctx.restore();
  }

  function draw(ctx,ship){
    if(!ctx||!ship)return;
    const cache=ensure(ship),cs=ship.cellSize||8;
    for(const region of cache.regions){
      if(region.hasDead){
        ctx.save();smoothPath(ctx,region.points);ctx.fillStyle='rgba(28,112,157,.96)';ctx.fill();
        smoothPath(ctx,region.points);ctx.strokeStyle='rgba(52,27,17,.92)';ctx.lineWidth=Math.max(2,cs*.25);ctx.stroke();
        // Torn timber tips extend from the merged opening rather than exposing cell squares.
        ctx.strokeStyle='rgba(105,59,34,.88)';ctx.lineWidth=Math.max(1.2,cs*.16);
        for(let i=0;i<region.points.length;i+=Math.max(2,Math.floor(region.points.length/7))){const p=region.points[i],dx=p.x-region.center.x,dy=p.y-region.center.y,d=Math.hypot(dx,dy)||1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+dx/d*cs*.62,p.y+dy/d*cs*.62);ctx.stroke();}
        ctx.restore();
      }
      drawCrackTears(ctx,region,ship);
    }
  }

  root.V100BreachVisual={MAX_POINTS,buildRegions,traceRegion,ensure,draw,revisionKey,caches};
})(typeof globalThis!=='undefined'?globalThis:this);
