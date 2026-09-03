(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V10 breach visual requires V8ShipGrid');

  const caches=new WeakMap();
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const ORTHO=[[0,-1],[1,0],[0,1],[-1,0]];
  const MAX_POINTS=42;

  function key(gx,gy){return gx+','+gy;}
  function pointKey(p){return p.x.toFixed(2)+','+p.y.toFixed(2);}
  function revisionKey(ship){return `${Number(ship.__v99TopologyRevision)||0}:${Number(ship.__v99MaterialRevision)||0}:${Number(ship.__v100CrackRevision)||0}:${Number(ship.__v101BurnEdgeRevision)||0}`;}
  function relevant(cell){return cell&&!cell.detachedGone&&((!cell.alive)||(cell.alive&&(Number(cell.crackDepth)||0)>.72));}

  function buildRegions(ship){
    const cells=(ship&&ship.cells||[]).filter(relevant),map=new Map(cells.map(c=>[key(c.gx,c.gy),c])),seen=new Set(),regions=[];
    for(const start of cells){
      const sk=key(start.gx,start.gy);if(seen.has(sk))continue;
      const q=[start],group=[];seen.add(sk);
      while(q.length){
        const c=q.pop();group.push(c);
        for(const [dx,dy] of DIRS){const nk=key(c.gx+dx,c.gy+dy),n=map.get(nk);if(n&&!seen.has(nk)){seen.add(nk);q.push(n);}}
      }
      regions.push({cells:group,hasDead:group.some(c=>!c.alive),maxCrack:group.reduce((m,c)=>Math.max(m,Number(c.crackDepth)||0),0),burn:group.some(c=>!!(c.burning||c.charred||c.burned))});
    }
    return regions;
  }

  function exposedEdges(ship,region){
    const cs=ship.cellSize||8,set=new Set(region.cells.map(c=>key(c.gx,c.gy))),edges=[];
    for(const cell of region.cells){
      const p=G.cellCenterLocal(ship,cell),h=cs*.52,x0=p.x-h,x1=p.x+h,y0=p.y-h,y1=p.y+h;
      if(!set.has(key(cell.gx,cell.gy-1)))edges.push({a:{x:x0,y:y0},b:{x:x1,y:y0}});
      if(!set.has(key(cell.gx+1,cell.gy)))edges.push({a:{x:x1,y:y0},b:{x:x1,y:y1}});
      if(!set.has(key(cell.gx,cell.gy+1)))edges.push({a:{x:x1,y:y1},b:{x:x0,y:y1}});
      if(!set.has(key(cell.gx-1,cell.gy)))edges.push({a:{x:x0,y:y1},b:{x:x0,y:y0}});
    }
    return edges;
  }

  function chainEdges(edges){
    const byStart=new Map(),unused=new Set(edges.map((_,i)=>i));
    for(let i=0;i<edges.length;i++){const k=pointKey(edges[i].a);if(!byStart.has(k))byStart.set(k,[]);byStart.get(k).push(i);}
    const loops=[];
    while(unused.size){
      const first=unused.values().next().value,start=edges[first].a;let idx=first,guard=0;const loop=[start];
      while(idx!=null&&guard++<edges.length+4){
        if(!unused.has(idx))break;unused.delete(idx);const edge=edges[idx];loop.push(edge.b);
        if(pointKey(edge.b)===pointKey(start))break;
        const next=(byStart.get(pointKey(edge.b))||[]).find(i=>unused.has(i));idx=next==null?null:next;
      }
      if(loop.length>=4)loops.push(loop);
    }
    return loops;
  }

  function simplifyBoundary(points){
    if(!points||points.length<4)return points||[];
    const closed=pointKey(points[0])===pointKey(points[points.length-1]),src=closed?points.slice(0,-1):points.slice(),out=[];
    for(let i=0;i<src.length;i++){
      const a=src[(i-1+src.length)%src.length],b=src[i],c=src[(i+1)%src.length];
      const abx=b.x-a.x,aby=b.y-a.y,bcx=c.x-b.x,bcy=c.y-b.y,cross=abx*bcy-aby*bcx;
      if(Math.abs(cross)<.05&&(abx*bcx+aby*bcy)>=0)continue;
      out.push(b);
    }
    if(out.length>MAX_POINTS){const stride=Math.ceil(out.length/MAX_POINTS);return out.filter((_,i)=>i%stride===0);}
    return out;
  }

  function polygonArea(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p.x*q.y-q.x*p.y;}return Math.abs(a)*.5;}

  function traceOuterBoundary(ship,region){
    const loops=chainEdges(exposedEdges(ship,region));if(!loops.length)return [];
    loops.sort((a,b)=>polygonArea(b)-polygonArea(a));return simplifyBoundary(loops[0]);
  }

  function traceRegion(ship,region){
    const points=traceOuterBoundary(ship,region);let cx=0,cy=0;
    for(const cell of region.cells){const p=G.cellCenterLocal(ship,cell);cx+=p.x;cy+=p.y;}
    cx/=Math.max(1,region.cells.length);cy/=Math.max(1,region.cells.length);
    return {points,center:{x:cx,y:cy},hasDead:region.hasDead,maxCrack:region.maxCrack,cells:region.cells,burn:region.burn};
  }

  function ensure(ship){
    if(!ship)return {revision:'',regions:[]};
    const rev=revisionKey(ship),existing=caches.get(ship);if(existing&&existing.revision===rev)return existing;
    const regions=buildRegions(ship).map(r=>traceRegion(ship,r)).filter(r=>r.points.length>=3),cache={revision:rev,regions};
    caches.set(ship,cache);ship.__v100BreachVisual=cache;return cache;
  }

  function smoothPath(ctx,points){
    if(!points||points.length<3)return;
    const n=points.length,firstMid={x:(points[n-1].x+points[0].x)/2,y:(points[n-1].y+points[0].y)/2};
    ctx.beginPath();ctx.moveTo(firstMid.x,firstMid.y);
    for(let i=0;i<n;i++){const p=points[i],q=points[(i+1)%n],mid={x:(p.x+q.x)/2,y:(p.y+q.y)/2};ctx.quadraticCurveTo(p.x,p.y,mid.x,mid.y);}ctx.closePath();
  }

  function drawCrackTears(ctx,region,ship){
    const cs=ship.cellSize||8,center=region.center;ctx.save();ctx.strokeStyle=region.burn?'rgba(39,23,18,.96)':'rgba(57,30,20,.90)';ctx.lineWidth=Math.max(1,cs*.17);ctx.lineCap='round';
    const limit=Math.min(12,region.cells.length);
    for(let i=0;i<limit;i++){
      const cell=region.cells[(i*3)%region.cells.length],depth=Math.max(Number(cell.crackDepth)||0,Number(cell.fracture)||0);if(depth<.25&&!region.hasDead)continue;
      const p=G.cellCenterLocal(ship,cell),dx=Number(cell.crackDirX)||((p.x-center.x)||1),dy=Number(cell.crackDirY)||((p.y-center.y)||0),d=Math.hypot(dx,dy)||1,len=cs*(.55+depth*1.25);
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+dx/d*len*.45+dy/d*cs*.18,p.y+dy/d*len*.45-dx/d*cs*.18,p.x+dx/d*len,p.y+dy/d*len);ctx.stroke();
    }
    ctx.restore();
  }

  function drawTimberSpikes(ctx,region,ship){
    const cs=ship.cellSize||8,points=region.points,step=Math.max(2,Math.ceil(points.length/8));ctx.save();ctx.strokeStyle=region.burn?'rgba(54,33,24,.98)':'rgba(105,59,34,.90)';ctx.lineWidth=Math.max(1.2,cs*.16);
    for(let i=0;i<points.length;i+=step){const p=points[i],dx=p.x-region.center.x,dy=p.y-region.center.y,d=Math.hypot(dx,dy)||1,jitter=.42+((i*17)%7)/18;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+dx/d*cs*jitter,p.y+dy/d*cs*jitter);ctx.stroke();}
    ctx.restore();
  }

  function draw(ctx,ship){
    if(!ctx||!ship)return;const cache=ensure(ship),cs=ship.cellSize||8;
    for(const region of cache.regions){
      if(region.hasDead){
        ctx.save();smoothPath(ctx,region.points);ctx.fillStyle='rgba(28,112,157,.96)';ctx.fill();
        smoothPath(ctx,region.points);ctx.strokeStyle=region.burn?'rgba(34,24,21,.98)':'rgba(52,27,17,.92)';ctx.lineWidth=Math.max(2,cs*(region.burn?.34:.25));ctx.stroke();ctx.restore();drawTimberSpikes(ctx,region,ship);
      }
      drawCrackTears(ctx,region,ship);
    }
  }

  root.V100BreachVisual={MAX_POINTS,buildRegions,traceOuterBoundary,traceRegion,ensure,draw,revisionKey,caches};
})(typeof globalThis!=='undefined'?globalThis:this);
