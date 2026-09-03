(function(root){
  'use strict';

  const G=root.V8ShipGrid,V=root.V9VectorShip;
  if(!G||!V||typeof V.drawShipLocal!=='function')throw new Error('V9.5.2 detach visual requires grid and vector ship');

  const originalDrawShipLocal=V.drawShipLocal;
  const cache=new WeakMap();

  function makeLayer(ship){
    const p=V.hullProfile(ship),pad=40;
    const w=Math.ceil((p.orientation==='vertical'?p.beam:p.length)+pad*2);
    const h=Math.ceil((p.orientation==='vertical'?p.length:p.beam)+pad*2);
    let s=cache.get(ship);
    if(s&&s.w===w&&s.h===h)return s;
    let canvas=null;
    if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(w,h);
    else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;}
    if(!canvas)return null;
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    s={canvas,ctx:canvas.getContext('2d'),w,h};cache.set(ship,s);return s;
  }

  function eraseDetached(ctx,ship){
    const cs=ship.cellSize||8,overlap=Math.max(1,cs*.16);
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';
    for(const cell of ship.cells||[]){
      if(!cell.detachedGone)continue;
      const p=G.cellCenterLocal(ship,cell),half=cs*.5+overlap;
      ctx.fillRect(p.x-half,p.y-half,half*2,half*2);
    }
    ctx.restore();
  }

  V.drawShipLocal=function(targetCtx,ship,state){
    const s=makeLayer(ship);
    if(!s)return originalDrawShipLocal(targetCtx,ship,state);
    const c=s.ctx;c.clearRect(0,0,s.w,s.h);c.save();c.translate(s.w/2,s.h/2);
    const drawn=originalDrawShipLocal(c,ship,state);
    if(drawn!==false)eraseDetached(c,ship);
    c.restore();
    targetCtx.drawImage(s.canvas,-s.w/2,-s.h/2);
    return drawn;
  };

  V.eraseDetachedFragments=eraseDetached;
})(typeof globalThis!=='undefined'?globalThis:this);
