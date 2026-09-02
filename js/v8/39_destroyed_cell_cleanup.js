(function(root){
  'use strict';

  const Grid=root.V8ShipGrid,Vector=root.V9VectorShip;
  if(!Grid||!Vector||typeof Vector.drawShipLocal!=='function')throw new Error('V9.2 continuous burning requires V8ShipGrid and V9VectorShip');

  const originalDrawShipLocal=Vector.drawShipLocal;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function seed(gx,gy){let n=((gx|0)*73856093)^((gy|0)*19349663)^0x5bd1e995;n=(n^(n>>>13))*1274126177;return (n^(n>>>16))>>>0;}
  function rnd(s,i){let n=(s+i*2654435761)>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967295;}
  function key(gx,gy){return gx+','+gy;}

  function flame(ctx,x,y,w,h,sway,color){
    ctx.beginPath();
    ctx.moveTo(x,y+h*.45);
    ctx.quadraticCurveTo(x-w*.62+sway,y+h*.08,x+sway*.25,y-h*.82);
    ctx.quadraticCurveTo(x+w*.62+sway,y+h*.08,x,y+h*.45);
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
  }

  function destroyedClusters(ship){
    const dead=(ship.cells||[]).filter(c=>!c.alive);
    if(!dead.length)return [];
    const byKey=new Map(dead.map(c=>[key(c.gx,c.gy),c]));
    const seen=new Set(),clusters=[];
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(const start of dead){
      const sk=key(start.gx,start.gy);if(seen.has(sk))continue;
      const q=[start],cells=[];seen.add(sk);
      while(q.length){
        const c=q.pop();cells.push(c);
        for(const d of dirs){
          const nk=key(c.gx+d[0],c.gy+d[1]),n=byKey.get(nk);
          if(n&&!seen.has(nk)){seen.add(nk);q.push(n);}
        }
      }
      clusters.push(cells);
    }
    return clusters;
  }

  function drawScorchCells(ctx,ship,cells,t){
    const cs=ship.cellSize||16;
    for(const cell of cells){
      const p=Grid.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate((rnd(s,1)-.5)*.35);
      // Overlay only: original wood remains visible underneath.
      ctx.fillStyle='rgba(24,18,16,.68)';
      ctx.beginPath();ctx.ellipse(0,0,cs*(.46+rnd(s,2)*.08),cs*(.34+rnd(s,3)*.10),0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(94,46,25,.34)';
      ctx.beginPath();ctx.ellipse(cs*(rnd(s,4)-.5)*.08,cs*.05,cs*.30,cs*.18,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(22,15,13,.72)';ctx.lineWidth=Math.max(1,cs*.055);
      ctx.beginPath();ctx.moveTo(-cs*.30,-cs*.16);ctx.lineTo(-cs*.05,0);ctx.lineTo(cs*.26,cs*.17);ctx.moveTo(-cs*.05,0);ctx.lineTo(cs*.20,-cs*.21);ctx.stroke();
      const glow=.16+.10*Math.sin(t*4.8+rnd(s,5)*6.28);
      ctx.globalAlpha=clamp(glow,.08,.28);ctx.fillStyle='#ff6b1e';ctx.beginPath();ctx.ellipse(0,cs*.08,cs*.21,cs*.10,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }

  function clusterCenter(ship,cells){
    let x=0,y=0;
    for(const c of cells){const p=Grid.cellCenterLocal(ship,c);x+=p.x;y+=p.y;}
    return{x:x/cells.length,y:y/cells.length};
  }

  function drawClusterFire(ctx,ship,cells,state,clusterIndex){
    const t=(state&&Number.isFinite(state.time))?state.time:0,cs=ship.cellSize||16;
    const center=clusterCenter(ship,cells),baseSeed=seed(cells[0].gx+clusterIndex*17,cells[0].gy-clusterIndex*11);
    const fireCount=Math.min(5,1+Math.ceil(Math.sqrt(cells.length)));
    const radius=cs*(.30+Math.min(1.5,Math.sqrt(cells.length)*.28));

    for(let i=0;i<fireCount;i++){
      const phase=t*(6.4+i*.45)+rnd(baseSeed,10+i)*6.28;
      const a=(i/fireCount)*Math.PI*2+rnd(baseSeed,20+i)*.9;
      const dist=radius*(.25+rnd(baseSeed,30+i)*.65);
      const x=center.x+Math.cos(a)*dist,y=center.y+Math.sin(a)*dist*.55;
      const flicker=.82+.22*Math.sin(phase);
      const h=cs*(.58+.18*Math.min(4,cells.length)+rnd(baseSeed,40+i)*.28)*flicker;
      const w=cs*(.24+rnd(baseSeed,50+i)*.12);
      const sway=Math.sin(phase*.92)*cs*.07;
      ctx.save();ctx.globalAlpha=.84+.10*Math.sin(phase*.8);
      flame(ctx,x,y,w,h,sway,'#ff6519');
      flame(ctx,x,y+cs*.05,w*.54,h*.55,sway*.42,'#ffd05a');
      ctx.restore();
    }

    const smokeCount=Math.min(5,2+Math.ceil(cells.length/4));
    for(let i=0;i<smokeCount;i++){
      const rise=(t*.20+i*.27+rnd(baseSeed,70+i))%1;
      const phase=t*(1.1+i*.13)+rnd(baseSeed,80+i)*6.28;
      const sx=center.x+(rnd(baseSeed,90+i)-.5)*radius*1.3+Math.sin(phase)*cs*.10;
      const sy=center.y-cs*(.45+rise*(1.1+.12*Math.min(6,cells.length)));
      const r=cs*(.16+rise*.18+Math.min(.18,cells.length*.012));
      ctx.save();ctx.globalAlpha=(1-rise)*.16;ctx.fillStyle='#303238';ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }

  function drawContinuousBurning(ctx,ship,state){
    if(!ctx||!ship)return;
    const t=(state&&Number.isFinite(state.time))?state.time:0;
    const clusters=destroyedClusters(ship);
    for(let i=0;i<clusters.length;i++){
      drawScorchCells(ctx,ship,clusters[i],t);
      drawClusterFire(ctx,ship,clusters[i],state,i);
    }
  }

  Vector.drawShipLocal=function(ctx,ship,state){
    const drawn=originalDrawShipLocal(ctx,ship,state);
    if(drawn!==false)drawContinuousBurning(ctx,ship,state);
    return drawn;
  };

  Vector.drawBurningDestroyedCells=drawContinuousBurning;
  Vector.destroyedClusters=destroyedClusters;
  root.V8DestroyedCellCleanup={active:false,reason:'V9.2-overlay-fire-preserves-original-hull'};
})(typeof globalThis!=='undefined'?globalThis:this);
