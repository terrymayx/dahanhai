(function(root){
  'use strict';

  const G=root.V8ShipGrid,V=root.V9VectorShip;
  if(!G||!V||typeof V.drawShipLocal!=='function')throw new Error('V9.5.2 breach/fire rendering requires grid and vector ship');

  const originalDrawShipLocal=V.drawShipLocal;
  function key(gx,gy){return gx+','+gy;}
  function seed(gx,gy){let n=((gx|0)*73856093)^((gy|0)*19349663)^0x6d2b79f5;n=(n^(n>>>13))*1274126177;return (n^(n>>>16))>>>0;}
  function rnd(s,i){let n=(s+i*2654435761)>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967295;}

  function flame(ctx,x,y,w,h,sway,color){ctx.beginPath();ctx.moveTo(x,y+h*.45);ctx.quadraticCurveTo(x-w*.62+sway,y+h*.08,x+sway*.25,y-h*.82);ctx.quadraticCurveTo(x+w*.62+sway,y+h*.08,x,y+h*.45);ctx.closePath();ctx.fillStyle=color;ctx.fill();}

  function clusters(ship,predicate){
    const cells=(ship.cells||[]).filter(predicate);if(!cells.length)return [];
    const map=new Map(cells.map(c=>[key(c.gx,c.gy),c])),seen=new Set(),out=[];
    for(const start of cells){const sk=key(start.gx,start.gy);if(seen.has(sk))continue;const q=[start],comp=[];seen.add(sk);while(q.length){const c=q.pop();comp.push(c);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nk=key(c.gx+dx,c.gy+dy),n=map.get(nk);if(n&&!seen.has(nk)){seen.add(nk);q.push(n);}}}out.push(comp);}return out;
  }
  function centerOf(ship,cells){let x=0,y=0;for(const c of cells){const p=G.cellCenterLocal(ship,c);x+=p.x;y+=p.y;}return{x:x/cells.length,y:y/cells.length};}

  function drawBurning(ctx,ship,state){
    const t=(state&&Number.isFinite(state.time))?state.time:0,cs=ship.cellSize||8;
    const groups=clusters(ship,c=>c.alive&&c.burning);
    for(let gi=0;gi<groups.length;gi++){
      const cells=groups[gi],center=centerOf(ship,cells),bs=seed(cells[0].gx+gi*13,cells[0].gy-gi*7);
      for(const cell of cells){const p=G.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy);ctx.save();ctx.translate(p.x,p.y);ctx.rotate((rnd(s,1)-.5)*.25);ctx.fillStyle='rgba(28,19,15,.46)';ctx.beginPath();ctx.ellipse(0,0,cs*.43,cs*.31,0,0,Math.PI*2);ctx.fill();ctx.restore();}
      const fireCount=Math.min(5,1+Math.ceil(Math.sqrt(cells.length))),radius=cs*(.18+Math.min(1.25,Math.sqrt(cells.length)*.26));
      for(let i=0;i<fireCount;i++){const phase=t*(6.3+i*.4)+rnd(bs,10+i)*6.28,a=i/fireCount*Math.PI*2+rnd(bs,20+i)*.8,dist=radius*(.18+rnd(bs,30+i)*.70),x=center.x+Math.cos(a)*dist,y=center.y+Math.sin(a)*dist*.50,h=cs*(.62+.13*Math.min(5,cells.length)+rnd(bs,40+i)*.26)*(.82+.20*Math.sin(phase)),w=cs*(.23+rnd(bs,50+i)*.10),sway=Math.sin(phase*.9)*cs*.07;ctx.save();ctx.globalAlpha=.88+.08*Math.sin(phase*.7);flame(ctx,x,y,w,h,sway,'#ff6519');flame(ctx,x,y+cs*.05,w*.55,h*.55,sway*.42,'#ffd05a');ctx.restore();}
    }
  }

  function traceBreach(ctx,ship,cell,scale){const cs=ship.cellSize||8,p=G.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy),count=7,cx=p.x+(rnd(s,1)-.5)*cs*.14,cy=p.y+(rnd(s,2)-.5)*cs*.14,base=cs*(scale||.9);ctx.beginPath();for(let i=0;i<count;i++){const a=Math.PI*2*i/count+(rnd(s,20+i)-.5)*.18,r=base*(.68+rnd(s,40+i)*.38),x=cx+Math.cos(a)*r*(.90+rnd(s,70+i)*.24),y=cy+Math.sin(a)*r*(.82+rnd(s,90+i)*.28);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();}

  function drawEdges(ctx,ship,dead){const cs=ship.cellSize||8,map=ship.cellMap||Object.create(null);ctx.save();ctx.strokeStyle='rgba(46,25,17,.80)';ctx.lineWidth=Math.max(1,cs*.14);ctx.lineCap='round';for(const cell of dead){const p=G.cellCenterLocal(ship,cell),h=cs*.5,s=seed(cell.gx,cell.gy),edges=[[-1,0,p.x-h,p.y-h,p.x-h,p.y+h],[1,0,p.x+h,p.y-h,p.x+h,p.y+h],[0,-1,p.x-h,p.y-h,p.x+h,p.y-h],[0,1,p.x-h,p.y+h,p.x+h,p.y+h]];for(let ei=0;ei<edges.length;ei++){const e=edges[ei],n=map[key(cell.gx+e[0],cell.gy+e[1])];if(!n||!n.alive)continue;const j=(rnd(s,120+ei)-.5)*cs*.14;ctx.beginPath();if(e[0]){ctx.moveTo(e[2]+j,e[3]+cs*.10);ctx.lineTo(e[4]-j,e[5]-cs*.10);}else{ctx.moveTo(e[2]+cs*.10,e[3]+j);ctx.lineTo(e[4]-cs*.10,e[5]-j);}ctx.stroke();}}ctx.restore();}

  function drawDestroyedWater(ctx,ship,state){
    const dead=(ship.cells||[]).filter(c=>!c.alive&&!c.detachedGone);if(!dead.length)return;
    ctx.save();ctx.fillStyle='rgba(43,145,191,.98)';for(const cell of dead){traceBreach(ctx,ship,cell,.90);ctx.fill();}ctx.restore();
    drawEdges(ctx,ship,dead);
  }

  V.drawShipLocal=function(ctx,ship,state){const drawn=originalDrawShipLocal(ctx,ship,state);if(drawn!==false){drawDestroyedWater(ctx,ship,state);drawBurning(ctx,ship,state);}return drawn;};
  V.drawActiveFire=drawBurning;V.drawDestroyedWater=drawDestroyedWater;V.traceIrregularBreach=traceBreach;
  root.V8DestroyedCellCleanup={active:true,reason:'V9.5.2-detached-fragments-hidden-from-breach-overlay'};
})(typeof globalThis!=='undefined'?globalThis:this);
