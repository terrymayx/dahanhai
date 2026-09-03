(function(root){
  'use strict';

  const Grid=root.V8ShipGrid,Vector=root.V9VectorShip;
  if(!Grid||!Vector||typeof Vector.drawShipLocal!=='function')throw new Error('V9.5.1 irregular breach rendering requires grid and vector ship');

  const originalDrawShipLocal=Vector.drawShipLocal;

  function seed(gx,gy){let n=((gx|0)*73856093)^((gy|0)*19349663)^0x6d2b79f5;n=(n^(n>>>13))*1274126177;return (n^(n>>>16))>>>0;}
  function rnd(s,i){let n=(s+i*2654435761)>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967295;}
  function key(gx,gy){return gx+','+gy;}

  function flame(ctx,x,y,w,h,sway,color){
    ctx.beginPath();ctx.moveTo(x,y+h*.45);
    ctx.quadraticCurveTo(x-w*.62+sway,y+h*.08,x+sway*.25,y-h*.82);
    ctx.quadraticCurveTo(x+w*.62+sway,y+h*.08,x,y+h*.45);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }

  function burningClusters(ship){
    const cells=(ship.cells||[]).filter(c=>c.alive&&c.burning);
    if(!cells.length)return [];
    const map=new Map(cells.map(c=>[key(c.gx,c.gy),c])),seen=new Set(),out=[];
    for(const start of cells){
      const sk=key(start.gx,start.gy);if(seen.has(sk))continue;
      const q=[start],cluster=[];seen.add(sk);
      while(q.length){
        const c=q.pop();cluster.push(c);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nk=key(c.gx+dx,c.gy+dy),n=map.get(nk);
          if(n&&!seen.has(nk)){seen.add(nk);q.push(n);}
        }
      }
      out.push(cluster);
    }
    return out;
  }

  function centerOf(ship,cells){
    let x=0,y=0;
    for(const c of cells){const p=Grid.cellCenterLocal(ship,c);x+=p.x;y+=p.y;}
    return{x:x/cells.length,y:y/cells.length};
  }

  function drawBurning(ctx,ship,state){
    const t=(state&&Number.isFinite(state.time))?state.time:0,cs=ship.cellSize||16;
    const clusters=burningClusters(ship);
    for(let ci=0;ci<clusters.length;ci++){
      const cells=clusters[ci],center=centerOf(ship,cells),bs=seed(cells[0].gx+ci*13,cells[0].gy-ci*7);
      for(const cell of cells){
        const p=Grid.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy);
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate((rnd(s,1)-.5)*.25);
        ctx.fillStyle='rgba(28,19,15,.46)';ctx.beginPath();ctx.ellipse(0,0,cs*.43,cs*.31,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(25,15,11,.60)';ctx.lineWidth=Math.max(1,cs*.05);ctx.beginPath();ctx.moveTo(-cs*.26,-cs*.12);ctx.lineTo(0,0);ctx.lineTo(cs*.24,cs*.16);ctx.stroke();ctx.restore();
      }
      const fireCount=Math.min(5,1+Math.ceil(Math.sqrt(cells.length)));
      const radius=cs*(.18+Math.min(1.25,Math.sqrt(cells.length)*.26));
      for(let i=0;i<fireCount;i++){
        const phase=t*(6.3+i*.4)+rnd(bs,10+i)*6.28;
        const a=i/fireCount*Math.PI*2+rnd(bs,20+i)*.8,dist=radius*(.18+rnd(bs,30+i)*.70);
        const x=center.x+Math.cos(a)*dist,y=center.y+Math.sin(a)*dist*.50;
        const h=cs*(.62+.13*Math.min(5,cells.length)+rnd(bs,40+i)*.26)*(.82+.20*Math.sin(phase));
        const w=cs*(.23+rnd(bs,50+i)*.10),sway=Math.sin(phase*.9)*cs*.07;
        ctx.save();ctx.globalAlpha=.88+.08*Math.sin(phase*.7);
        flame(ctx,x,y,w,h,sway,'#ff6519');flame(ctx,x,y+cs*.05,w*.55,h*.55,sway*.42,'#ffd05a');ctx.restore();
      }
      const smokeCount=Math.min(4,1+Math.ceil(cells.length/3));
      for(let i=0;i<smokeCount;i++){
        const rise=(t*.18+i*.31+rnd(bs,70+i))%1;
        const sx=center.x+(rnd(bs,80+i)-.5)*radius*1.2+Math.sin(t*1.1+i)*cs*.08;
        const sy=center.y-cs*(.48+rise*(1.0+.1*cells.length));
        ctx.save();ctx.globalAlpha=(1-rise)*.16;ctx.fillStyle='#303238';ctx.beginPath();ctx.arc(sx,sy,cs*(.15+rise*.18),0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
  }

  function traceIrregularBreach(ctx,ship,cell,scale){
    const cs=ship.cellSize||16,p=Grid.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy),count=7;
    const cx=p.x+(rnd(s,1)-.5)*cs*.14,cy=p.y+(rnd(s,2)-.5)*cs*.14;
    const base=cs*(scale||.72);
    ctx.beginPath();
    for(let i=0;i<count;i++){
      const a=Math.PI*2*i/count+(rnd(s,20+i)-.5)*.18;
      const r=base*(.68+rnd(s,40+i)*.38);
      const stretchX=.90+rnd(s,70+i)*.24,stretchY=.82+rnd(s,90+i)*.28;
      const x=cx+Math.cos(a)*r*stretchX,y=cy+Math.sin(a)*r*stretchY;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  function drawExposedCharredEdges(ctx,ship,dead){
    const cs=ship.cellSize||16;
    const map=ship.cellMap||Object.create(null);
    ctx.save();
    ctx.strokeStyle='rgba(46,25,17,.80)';
    ctx.lineWidth=Math.max(1.0,cs*.14);
    ctx.lineCap='round';ctx.lineJoin='round';

    for(const cell of dead){
      const p=Grid.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy),h=cs*.50;
      const edges=[
        {dx:-1,dy:0,x1:p.x-h,y1:p.y-h,x2:p.x-h,y2:p.y+h},
        {dx: 1,dy:0,x1:p.x+h,y1:p.y-h,x2:p.x+h,y2:p.y+h},
        {dx:0,dy:-1,x1:p.x-h,y1:p.y-h,x2:p.x+h,y2:p.y-h},
        {dx:0,dy: 1,x1:p.x-h,y1:p.y+h,x2:p.x+h,y2:p.y+h}
      ];
      for(let ei=0;ei<edges.length;ei++){
        const e=edges[ei],n=map[key(cell.gx+e.dx,cell.gy+e.dy)];
        // Draw only where destroyed water meets surviving ship material.
        // Missing neighbor means outside the ship silhouette, so no internal rim is needed.
        if(!n||!n.alive)continue;
        const j1=(rnd(s,120+ei)-.5)*cs*.18,j2=(rnd(s,140+ei)-.5)*cs*.18;
        ctx.beginPath();
        if(e.dx){
          ctx.moveTo(e.x1+j1,e.y1+cs*.08);
          ctx.lineTo(e.x2+j2,e.y2-cs*.08);
        }else{
          ctx.moveTo(e.x1+cs*.08,e.y1+j1);
          ctx.lineTo(e.x2-cs*.08,e.y2+j2);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawDestroyedWater(ctx,ship,state){
    const cs=ship.cellSize||16,t=(state&&Number.isFinite(state.time))?state.time:0;
    const dead=(ship.cells||[]).filter(c=>!c.alive);
    if(!dead.length)return;

    // Water fill only. No per-cell closed outline at all.
    // Strong overlap hides the logical fine grid and makes adjacent cells merge visually.
    ctx.save();
    ctx.fillStyle='rgba(43,145,191,.98)';
    for(const cell of dead){traceIrregularBreach(ctx,ship,cell,.90);ctx.fill();}
    ctx.restore();

    // Charred wood appears only on live/dead contact edges, never around each dead cell.
    drawExposedCharredEdges(ctx,ship,dead);

    // Sparse shimmer inside water, intentionally not one mark per cell.
    ctx.save();ctx.strokeStyle='rgba(220,249,255,.28)';ctx.lineWidth=Math.max(.75,cs*.085);
    let i=0;
    for(const cell of dead){
      if((i++%5)!==0)continue;
      const p=Grid.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy);
      const wobble=Math.sin(t*2.1+rnd(s,5)*6.28)*cs*.08;
      ctx.beginPath();ctx.ellipse(p.x+wobble,p.y+(rnd(s,6)-.5)*cs*.16,cs*.28,cs*.065,(rnd(s,7)-.5)*.35,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }

  Vector.drawShipLocal=function(ctx,ship,state){
    const drawn=originalDrawShipLocal(ctx,ship,state);
    if(drawn!==false){drawDestroyedWater(ctx,ship,state);drawBurning(ctx,ship,state);}
    return drawn;
  };

  Vector.drawActiveFire=drawBurning;
  Vector.drawDestroyedWater=drawDestroyedWater;
  Vector.traceIrregularBreach=traceIrregularBreach;
  root.V8DestroyedCellCleanup={active:true,reason:'V9.5.1-no-closed-dead-cell-rims-only-live-dead-edge-char'};
})(typeof globalThis!=='undefined'?globalThis:this);
