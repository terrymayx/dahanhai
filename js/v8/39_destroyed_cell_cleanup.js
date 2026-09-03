(function(root){
  'use strict';

  const G=root.V8ShipGrid,V=root.V9VectorShip;
  if(!G||!V||typeof V.drawShipLocal!=='function')throw new Error('V9.7 cached breach/fire rendering requires grid and vector ship');

  const baseDrawShipLocal=V.drawShipLocal;
  const overlayCaches=new WeakMap();
  function key(gx,gy){return gx+','+gy;}
  function seed(gx,gy){let n=((gx|0)*73856093)^((gy|0)*19349663)^0x6d2b79f5;n=(n^(n>>>13))*1274126177;return (n^(n>>>16))>>>0;}
  function rnd(s,i){let n=(s+i*2654435761)>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967295;}

  function createCanvas(w,h){
    if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);
    if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    return null;
  }
  function getOverlay(ship){
    const p=V.hullProfile(ship),pad=48,w=Math.ceil((p.orientation==='vertical'?p.beam:p.length)+pad*2),h=Math.ceil((p.orientation==='vertical'?p.length:p.beam)+pad*2);
    let s=overlayCaches.get(ship);if(s&&s.w===w&&s.h===h)return s;
    const canvas=createCanvas(w,h);if(!canvas)return null;
    s={canvas,ctx:canvas.getContext('2d'),w,h,revision:-1,ready:false,rebuilds:0};overlayCaches.set(ship,s);return s;
  }

  function flame(ctx,x,y,w,h,sway,color){ctx.beginPath();ctx.moveTo(x,y+h*.45);ctx.quadraticCurveTo(x-w*.62+sway,y+h*.08,x+sway*.25,y-h*.82);ctx.quadraticCurveTo(x+w*.62+sway,y+h*.08,x,y+h*.45);ctx.closePath();ctx.fillStyle=color;ctx.fill();}

  function clustersFromCells(cells){
    if(!cells||!cells.length)return [];
    const map=new Map(cells.map(c=>[key(c.gx,c.gy),c])),seen=new Set(),out=[];
    for(const start of cells){
      const sk=key(start.gx,start.gy);if(seen.has(sk))continue;
      const q=[start],comp=[];seen.add(sk);
      while(q.length){
        const c=q.pop();comp.push(c);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nk=key(c.gx+dx,c.gy+dy),n=map.get(nk);if(n&&!seen.has(nk)){seen.add(nk);q.push(n);}}
      }
      out.push(comp);
    }
    return out;
  }
  function centerOf(ship,cells){let x=0,y=0;for(const c of cells){const p=G.cellCenterLocal(ship,c);x+=p.x;y+=p.y;}return{x:x/cells.length,y:y/cells.length};}

  function drawBurning(ctx,ship,state){
    const active=(ship.__v96BurningCells||[]).filter(c=>c&&c.alive&&c.burning&&!c.detachedGone);
    if(!active.length)return;
    const t=(state&&Number.isFinite(state.time))?state.time:0,cs=ship.cellSize||8,groups=clustersFromCells(active);
    for(let gi=0;gi<groups.length;gi++){
      const cells=groups[gi],center=centerOf(ship,cells),bs=seed(cells[0].gx+gi*13,cells[0].gy-gi*7);
      const fireCount=Math.min(5,1+Math.ceil(Math.sqrt(cells.length))),radius=cs*(.18+Math.min(1.25,Math.sqrt(cells.length)*.26));
      for(let i=0;i<fireCount;i++){
        const phase=t*(6.3+i*.4)+rnd(bs,10+i)*6.28,a=i/fireCount*Math.PI*2+rnd(bs,20+i)*.8,dist=radius*(.18+rnd(bs,30+i)*.70);
        const x=center.x+Math.cos(a)*dist,y=center.y+Math.sin(a)*dist*.50,h=cs*(.62+.13*Math.min(5,cells.length)+rnd(bs,40+i)*.26)*(.82+.20*Math.sin(phase)),w=cs*(.23+rnd(bs,50+i)*.10),sway=Math.sin(phase*.9)*cs*.07;
        ctx.save();ctx.globalAlpha=.88+.08*Math.sin(phase*.7);flame(ctx,x,y,w,h,sway,'#ff6519');flame(ctx,x,y+cs*.05,w*.55,h*.55,sway*.42,'#ffd05a');ctx.restore();
      }
    }
  }

  function traceBreach(ctx,ship,cell,scale){
    const cs=ship.cellSize||8,p=G.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy),count=8,cx=p.x+(rnd(s,1)-.5)*cs*.20,cy=p.y+(rnd(s,2)-.5)*cs*.20,base=cs*(scale||1.04);
    ctx.beginPath();for(let i=0;i<count;i++){const a=Math.PI*2*i/count+(rnd(s,20+i)-.5)*.24,r=base*(.72+rnd(s,40+i)*.42),x=cx+Math.cos(a)*r*(.88+rnd(s,70+i)*.26),y=cy+Math.sin(a)*r*(.82+rnd(s,90+i)*.32);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();
  }
  function drawEdges(ctx,ship,dead){
    const cs=ship.cellSize||8,map=ship.cellMap||Object.create(null);ctx.save();ctx.strokeStyle='rgba(46,25,17,.72)';ctx.lineWidth=Math.max(1,cs*.13);ctx.lineCap='round';
    for(const cell of dead){
      const p=G.cellCenterLocal(ship,cell),h=cs*.5,s=seed(cell.gx,cell.gy),edges=[[-1,0,p.x-h,p.y-h,p.x-h,p.y+h],[1,0,p.x+h,p.y-h,p.x+h,p.y+h],[0,-1,p.x-h,p.y-h,p.x+h,p.y-h],[0,1,p.x-h,p.y+h,p.x+h,p.y+h]];
      for(let ei=0;ei<edges.length;ei++){const e=edges[ei],n=map[key(cell.gx+e[0],cell.gy+e[1])];if(!n||!n.alive||n.detachedGone)continue;const j=(rnd(s,120+ei)-.5)*cs*.18;ctx.beginPath();if(e[0]){ctx.moveTo(e[2]+j,e[3]+cs*.10);ctx.lineTo(e[4]-j,e[5]-cs*.10);}else{ctx.moveTo(e[2]+cs*.10,e[3]+j);ctx.lineTo(e[4]-cs*.10,e[5]-j);}ctx.stroke();}
    }
    ctx.restore();
  }

  function rebuildOverlay(ship,s){
    const c=s.ctx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,s.w,s.h);c.save();c.translate(s.w/2,s.h/2);
    const source=(ship.__v97BreachCells&&ship.__v97BreachCells.length)?ship.__v97BreachCells:(ship.cells||[]);
    const dead=source.filter(x=>x&&!x.alive&&!x.detachedGone);
    if(dead.length){
      c.fillStyle='rgba(43,145,191,.98)';for(const cell of dead){traceBreach(c,ship,cell,1.07);c.fill();}
      drawEdges(c,ship,dead);
    }
    c.restore();s.revision=ship.__v96DamageRevision||0;s.ready=true;s.rebuilds++;
  }

  V.drawShipLocal=function(ctx,ship,state){
    const drawn=baseDrawShipLocal(ctx,ship,state);if(drawn===false)return false;
    const s=getOverlay(ship),revision=ship.__v96DamageRevision||0;
    if(s){if(!s.ready||s.revision!==revision)rebuildOverlay(ship,s);ctx.drawImage(s.canvas,-s.w/2,-s.h/2);}
    drawBurning(ctx,ship,state);
    return true;
  };

  V.drawActiveFire=drawBurning;V.traceIrregularBreach=traceBreach;
  V.getDamageOverlayCacheStats=function(ship){const s=overlayCaches.get(ship);return s?{revision:s.revision,rebuilds:s.rebuilds}:null;};
  root.V8DestroyedCellCleanup={active:true,reason:'V9.7-registered-breach-cache-dynamic-fire'};
})(typeof globalThis!=='undefined'?globalThis:this);