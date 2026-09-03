(function(root){
  'use strict';

  const G=root.V8ShipGrid,V=root.V9VectorShip;
  if(!G||!V||typeof V.drawShipLocal!=='function')throw new Error('V9.5.6 live support visual requires grid and vector ship');

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

  // V9.5.6: the visible hull/deck is allowed to exist ONLY where a live physical
  // grid cell supports it. This removes curved vector-shell remnants that used to
  // hang in mid-air after the real collision grid had already been destroyed.
  // Small overlapping rounded support pads preserve a smooth silhouette while
  // keeping drawing and collision topology tied to the same live cells.
  function applyLiveSupportMask(ctx,ship){
    const cs=ship.cellSize||8;
    const live=(ship.cells||[]).filter(c=>c.alive&&!c.detachedGone);
    if(!live.length){ctx.clearRect(-5000,-5000,10000,10000);return;}

    ctx.save();
    ctx.globalCompositeOperation='destination-in';
    ctx.fillStyle='#000';
    ctx.beginPath();
    for(const cell of live){
      const p=G.cellCenterLocal(ship,cell);
      const half=cs*.68;
      const radius=Math.max(1,cs*.34);
      ctx.roundRect(p.x-half,p.y-half,half*2,half*2,radius);
    }
    // One fill operation means all support pads form a union. Repeated
    // destination-in fills would intersect the pads and erase the whole ship.
    ctx.fill();
    ctx.restore();
  }

  function redrawAboveHullDetails(ctx,ship){
    // The support mask intentionally clips the broad vector shell. Repaint mast/
    // sail and tiny weapon details afterwards so valid live components can extend
    // slightly beyond one cell without recreating unsupported hull material.
    if(typeof V.drawMastsAndSails==='function')V.drawMastsAndSails(ctx,ship);
    if(typeof V.drawCannons==='function')V.drawCannons(ctx,ship);
    if(typeof V.drawDamageMarks==='function')V.drawDamageMarks(ctx,ship);
  }

  V.drawShipLocal=function(targetCtx,ship,state){
    const s=makeLayer(ship);
    if(!s)return originalDrawShipLocal(targetCtx,ship,state);
    const c=s.ctx;c.clearRect(0,0,s.w,s.h);c.save();c.translate(s.w/2,s.h/2);
    const drawn=originalDrawShipLocal(c,ship,state);
    if(drawn!==false){
      applyLiveSupportMask(c,ship);
      redrawAboveHullDetails(c,ship);
    }
    c.restore();
    targetCtx.drawImage(s.canvas,-s.w/2,-s.h/2);
    return drawn;
  };

  V.applyLiveSupportMask=applyLiveSupportMask;
  V.eraseDetachedFragments=function(ctx,ship){applyLiveSupportMask(ctx,ship);};
})(typeof globalThis!=='undefined'?globalThis:this);
