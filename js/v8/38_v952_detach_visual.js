(function(root){
  'use strict';

  const G=root.V8ShipGrid,V=root.V9VectorShip;
  if(!G||!V||typeof V.drawShipLocal!=='function')throw new Error('V9.6 cached support visual requires grid and vector ship');

  const baseDrawShipLocal=V.drawShipLocal;
  const caches=new WeakMap();

  function createCanvas(w,h){
    let canvas=null;
    if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(w,h);
    else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;}
    return canvas;
  }

  function getCache(ship){
    const p=V.hullProfile(ship),pad=46;
    const w=Math.ceil((p.orientation==='vertical'?p.beam:p.length)+pad*2);
    const h=Math.ceil((p.orientation==='vertical'?p.length:p.beam)+pad*2);
    let s=caches.get(ship);
    if(s&&s.w===w&&s.h===h)return s;
    const canvas=createCanvas(w,h),mask=createCanvas(w,h);
    if(!canvas||!mask)return null;
    s={canvas,ctx:canvas.getContext('2d'),mask,maskCtx:mask.getContext('2d'),w,h,revision:-1,ready:false,rebuilds:0};
    caches.set(ship,s);return s;
  }

  function buildSmoothSupportMask(s,ship){
    const m=s.maskCtx,cs=ship.cellSize||8;
    m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,s.w,s.h);
    m.save();m.translate(s.w/2,s.h/2);
    m.fillStyle='#000';
    // A large overlapping circular footprint produces a soft continuous envelope,
    // while still disappearing wherever the physical cells are actually gone.
    m.beginPath();
    const radius=cs*.96;
    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.detachedGone)continue;
      const p=G.cellCenterLocal(ship,cell);
      m.moveTo(p.x+radius,p.y);m.arc(p.x,p.y,radius,0,Math.PI*2);
    }
    m.fill();
    m.restore();
  }

  function rebuild(ship,state,s){
    const c=s.ctx;
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,s.w,s.h);
    c.save();c.translate(s.w/2,s.h/2);
    const drawn=baseDrawShipLocal(c,ship,state);
    c.restore();
    if(drawn===false)return false;

    buildSmoothSupportMask(s,ship);
    c.save();c.globalCompositeOperation='destination-in';c.drawImage(s.mask,0,0);c.restore();

    // Small elevated components may legally extend beyond the hull envelope.
    c.save();c.translate(s.w/2,s.h/2);
    if(typeof V.drawMastsAndSails==='function')V.drawMastsAndSails(c,ship);
    if(typeof V.drawCannons==='function')V.drawCannons(c,ship);
    c.restore();

    s.revision=ship.__v96DamageRevision||0;
    s.ready=true;s.rebuilds++;
    ship.__v96VisualDirty=false;
    return true;
  }

  V.drawShipLocal=function(targetCtx,ship,state){
    const s=getCache(ship);
    if(!s)return baseDrawShipLocal(targetCtx,ship,state);
    const revision=ship.__v96DamageRevision||0;
    if(!s.ready||ship.__v96VisualDirty||s.revision!==revision){
      if(rebuild(ship,state,s)===false)return false;
    }
    targetCtx.drawImage(s.canvas,-s.w/2,-s.h/2);
    return true;
  };

  V.markVisualDirty=function(ship){if(ship){ship.__v96VisualDirty=true;ship.__v96DamageRevision=(ship.__v96DamageRevision||0)+1;}};
  V.eraseDetachedFragments=function(ctx,ship){V.markVisualDirty(ship);};
  V.getVisualCacheStats=function(ship){const s=caches.get(ship);return s?{ready:s.ready,revision:s.revision,rebuilds:s.rebuilds,w:s.w,h:s.h}:null;};
  root.V96CachedHull={active:true,caches,getCache,rebuild};
})(typeof globalThis!=='undefined'?globalThis:this);
