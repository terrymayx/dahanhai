(function(root){
  'use strict';

  const Grid=root.V8ShipGrid,Vector=root.V9VectorShip;
  if(!Grid||!Vector||typeof Vector.drawShipLocal!=='function')throw new Error('V9.1 burning damage requires V8ShipGrid and V9VectorShip');

  const originalDrawShipLocal=Vector.drawShipLocal;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function seed(gx,gy){let n=((gx|0)*73856093)^((gy|0)*19349663)^0x5bd1e995;n=(n^(n>>>13))*1274126177;return (n^(n>>>16))>>>0;}
  function rnd(s,i){let n=(s+i*2654435761)>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967295;}

  function flame(ctx,x,y,w,h,sway,outer){
    ctx.beginPath();
    ctx.moveTo(x,y+h*.45);
    ctx.quadraticCurveTo(x-w*.62+sway,y+h*.08,x+sway*.25,y-h*.82);
    ctx.quadraticCurveTo(x+w*.62+sway,y+h*.08,x,y+h*.45);
    ctx.closePath();
    ctx.fillStyle=outer;
    ctx.fill();
  }

  function drawBurningDestroyedCells(ctx,ship,state){
    if(!ctx||!ship)return;
    const t=(state&&Number.isFinite(state.time))?state.time:0;
    const cs=ship.cellSize||16;

    for(const cell of ship.cells||[]){
      if(cell.alive)continue;
      const p=Grid.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy);

      // burned wood replaces the old transparent hole
      ctx.save();
      const rot=(rnd(s,1)-.5)*.5;
      ctx.translate(p.x,p.y);ctx.rotate(rot);
      ctx.fillStyle='rgba(31,23,20,.96)';
      ctx.beginPath();ctx.roundRect(-cs*.49,-cs*.45,cs*.98,cs*.90,cs*.16);ctx.fill();
      ctx.fillStyle='rgba(82,43,27,.72)';
      ctx.beginPath();ctx.ellipse(0,cs*.04,cs*.34,cs*.22,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(14,12,12,.88)';ctx.lineWidth=Math.max(1,cs*.08);
      ctx.beginPath();ctx.moveTo(-cs*.34,-cs*.18);ctx.lineTo(-cs*.05,0);ctx.lineTo(cs*.28,cs*.18);ctx.moveTo(-cs*.08,0);ctx.lineTo(cs*.25,-cs*.22);ctx.stroke();
      ctx.restore();

      // glowing embers
      const glow=.28+.16*Math.sin(t*5.4+rnd(s,2)*6.28);
      ctx.save();ctx.globalAlpha=clamp(glow,.12,.55);ctx.fillStyle='#ff7a22';
      ctx.beginPath();ctx.ellipse(p.x,p.y+cs*.08,cs*.23,cs*.12,0,0,Math.PI*2);ctx.fill();ctx.restore();

      // animated flame tongues
      const count=2+Math.floor(rnd(s,3)*2);
      for(let i=0;i<count;i++){
        const phase=t*(7.0+i*.7)+rnd(s,10+i)*6.28;
        const ox=(i-(count-1)/2)*cs*.18+(rnd(s,20+i)-.5)*cs*.10;
        const baseY=p.y-cs*.05;
        const flicker=.82+.22*Math.sin(phase);
        const h=cs*(.48+rnd(s,30+i)*.34)*flicker;
        const w=cs*(.18+rnd(s,40+i)*.10);
        const sway=Math.sin(phase*.92)*cs*.055;
        ctx.save();ctx.globalAlpha=.82+.12*Math.sin(phase*.8);
        flame(ctx,p.x+ox,baseY,w,h,sway,'#ff6a1a');
        flame(ctx,p.x+ox,baseY+cs*.04,w*.56,h*.56,sway*.45,'#ffd35f');
        ctx.restore();
      }

      // light smoke, kept subtle for mobile performance
      for(let i=0;i<2;i++){
        const phase=t*(1.25+i*.18)+rnd(s,60+i)*6.28;
        const rise=(t*.24+i*.46+rnd(s,70+i))%1;
        const sx=p.x+(rnd(s,80+i)-.5)*cs*.26+Math.sin(phase)*cs*.06;
        const sy=p.y-cs*(.48+rise*.85);
        const r=cs*(.13+rise*.13);
        ctx.save();ctx.globalAlpha=(1-rise)*.18;ctx.fillStyle='#303238';ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
  }

  Vector.drawShipLocal=function(ctx,ship,state){
    const drawn=originalDrawShipLocal(ctx,ship,state);
    if(drawn!==false)drawBurningDestroyedCells(ctx,ship,state);
    return drawn;
  };

  Vector.drawBurningDestroyedCells=drawBurningDestroyedCells;
  root.V8DestroyedCellCleanup={active:false,reason:'replaced-by-burning-damage'};
})(typeof globalThis!=='undefined'?globalThis:this);
