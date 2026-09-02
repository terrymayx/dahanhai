(function(root){
  'use strict';

  const Grid=root.V8ShipGrid,Vector=root.V9VectorShip;
  if(!Grid||!Vector||typeof Vector.drawShipLocal!=='function')throw new Error('V9.3 fire rendering requires grid and vector ship');

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

  function drawDestroyedWater(ctx,ship,state){
    const cs=ship.cellSize||16,t=(state&&Number.isFinite(state.time))?state.time:0;
    for(const cell of ship.cells||[]){
      if(cell.alive)continue;
      const p=Grid.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy);
      ctx.save();ctx.fillStyle='rgba(48,151,194,.96)';
      ctx.beginPath();ctx.roundRect(p.x-cs*.53,p.y-cs*.53,cs*1.06,cs*1.06,cs*.12);ctx.fill();
      ctx.strokeStyle='rgba(215,248,255,.32)';ctx.lineWidth=1.2;
      const wobble=Math.sin(t*2.2+rnd(s,2)*6.28)*cs*.05;
      ctx.beginPath();ctx.ellipse(p.x+wobble,p.y,cs*.32,cs*.10,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }

  Vector.drawShipLocal=function(ctx,ship,state){
    const drawn=originalDrawShipLocal(ctx,ship,state);
    if(drawn!==false){drawDestroyedWater(ctx,ship,state);drawBurning(ctx,ship,state);}
    return drawn;
  };

  Vector.drawActiveFire=drawBurning;
  Vector.drawDestroyedWater=drawDestroyedWater;
  root.V8DestroyedCellCleanup={active:true,reason:'V9.3-dead-cells-show-water-active-cells-can-burn'};
})(typeof globalThis!=='undefined'?globalThis:this);
