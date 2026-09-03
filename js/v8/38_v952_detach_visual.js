(function(root){
  'use strict';

  const G=root.V8ShipGrid,V=root.V9VectorShip;
  if(!G||!V||typeof V.drawShipLocal!=='function')throw new Error('V9.7 cached hull requires grid and vector ship');

  const baseDrawShipLocal=V.drawShipLocal;
  const caches=new WeakMap();

  function createCanvas(w,h){
    let canvas=null;
    if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(w,h);
    else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;}
    return canvas;
  }
  function seed(gx,gy){let n=((gx|0)*73856093)^((gy|0)*19349663)^0x7f4a7c15;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;}
  function rnd(s,i){let n=(s+Math.imul(i+1,0x9e3779b1))>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967295;}

  function getCache(ship){
    const p=V.hullProfile(ship),pad=48;
    const w=Math.ceil((p.orientation==='vertical'?p.beam:p.length)+pad*2);
    const h=Math.ceil((p.orientation==='vertical'?p.length:p.beam)+pad*2);
    let s=caches.get(ship);
    if(s&&s.w===w&&s.h===h)return s;
    const canvas=createCanvas(w,h),fullMask=createCanvas(w,h);
    if(!canvas||!fullMask)return null;
    s={canvas,ctx:canvas.getContext('2d'),fullMask,fullMaskCtx:fullMask.getContext('2d'),w,h,revision:-1,ready:false,fullMaskReady:false,rebuilds:0};
    caches.set(ship,s);return s;
  }

  // Build the physical envelope only once from the ORIGINAL grid. The vector hull
  // stays smooth, while the envelope still prevents art from extending far beyond
  // real collision support. Dynamic damage is subtracted separately below.
  function buildFullPhysicalMask(s,ship){
    if(s.fullMaskReady)return;
    const m=s.fullMaskCtx,cs=ship.cellSize||8;
    m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,s.w,s.h);
    m.save();m.translate(s.w/2,s.h/2);m.fillStyle='#000';m.beginPath();
    const radius=cs*1.18;
    for(const cell of ship.cells||[]){
      const p=G.cellCenterLocal(ship,cell);
      m.moveTo(p.x+radius,p.y);m.arc(p.x,p.y,radius,0,Math.PI*2);
    }
    m.fill();m.restore();s.fullMaskReady=true;
  }

  function traceDamageCut(ctx,ship,cell){
    const cs=ship.cellSize||8,p=G.cellCenterLocal(ship,cell),s=seed(cell.gx,cell.gy),count=8;
    const cx=p.x+(rnd(s,1)-.5)*cs*.18,cy=p.y+(rnd(s,2)-.5)*cs*.18;
    const base=cs*(cell.detachedGone?1.32:1.16);
    ctx.beginPath();
    for(let i=0;i<count;i++){
      const a=Math.PI*2*i/count+(rnd(s,20+i)-.5)*.22;
      const r=base*(.78+rnd(s,40+i)*.38);
      const x=cx+Math.cos(a)*r*(.90+rnd(s,70+i)*.20);
      const y=cy+Math.sin(a)*r*(.86+rnd(s,90+i)*.24);
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  function eraseDestroyedSupport(ctx,ship){
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';
    for(const cell of ship.cells||[]){
      if(cell.alive&&!cell.detachedGone)continue;
      traceDamageCut(ctx,ship,cell);ctx.fill();
    }
    ctx.restore();
  }

  function rebuild(ship,state,s){
    const c=s.ctx;
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,s.w,s.h);
    c.save();c.translate(s.w/2,s.h/2);
    const drawn=baseDrawShipLocal(c,ship,state);
    c.restore();
    if(drawn===false)return false;

    buildFullPhysicalMask(s,ship);
    c.save();c.globalCompositeOperation='destination-in';c.drawImage(s.fullMask,0,0);c.restore();

    c.save();c.translate(s.w/2,s.h/2);eraseDestroyedSupport(c,ship);c.restore();

    // Elevated pieces are valid only while their component cells are alive.
    c.save();c.translate(s.w/2,s.h/2);
    if(typeof V.drawMastsAndSails==='function')V.drawMastsAndSails(c,ship);
    if(typeof V.drawCannons==='function')V.drawCannons(c,ship);
    c.restore();

    s.revision=ship.__v96DamageRevision||0;s.ready=true;s.rebuilds++;
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
  root.V96CachedHull={active:true,version:'9.7',caches,getCache,rebuild};
})(typeof globalThis!=='undefined'?globalThis:this);