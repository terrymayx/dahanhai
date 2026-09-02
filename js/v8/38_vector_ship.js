(function(root){
  'use strict';

  const Grid=root.V8ShipGrid;
  if(!Grid)throw new Error('V8ShipGrid must load before V9.0 vector ship renderer');

  const FULLNESS={player:.90,sloop:.68,gunship:.80,manowar:.93};
  const BOW_TAPER={player:.18,sloop:.12,gunship:.15,manowar:.18};
  const STERN_TAPER={player:.62,sloop:.55,gunship:.62,manowar:.70};
  const surfaces=new WeakMap();

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function hullProfile(ship){
    const rawW=ship.gridWidth*ship.cellSize,rawH=ship.gridHeight*ship.cellSize;
    const vertical=ship.kind==='player',fullness=FULLNESS[ship.kind]||.8;
    const length=(vertical?rawH:rawW)*.98,beam=(vertical?rawW:rawH)*(.78+.16*fullness);
    return {orientation:vertical?'vertical':'horizontal',length,beam,fullness,bowTaper:BOW_TAPER[ship.kind]||.15,sternTaper:STERN_TAPER[ship.kind]||.62,halfLength:length*.5,halfBeam:beam*.5};
  }

  function traceHorizontalHull(ctx,p){
    const L=p.halfLength,B=p.halfBeam,bow=-L,stern=L;
    const bowNeck=B*clamp(.18+p.bowTaper*.28,.18,.30),sternNeck=B*clamp(.46+p.sternTaper*.28,.50,.70);
    ctx.beginPath();ctx.moveTo(bow,0);
    ctx.bezierCurveTo(bow+L*.10,-bowNeck,bow+L*.34,-B*.98,bow+L*.72,-B);
    ctx.bezierCurveTo(bow+L*1.10,-B,bow+L*1.68,-B*.90,stern,-sternNeck);
    ctx.quadraticCurveTo(stern+B*.20,0,stern,sternNeck);
    ctx.bezierCurveTo(bow+L*1.68,B*.90,bow+L*1.10,B,bow+L*.72,B);
    ctx.bezierCurveTo(bow+L*.34,B*.98,bow+L*.10,bowNeck,bow,0);ctx.closePath();
  }
  function traceVerticalHull(ctx,p){
    const L=p.halfLength,B=p.halfBeam,bow=-L,stern=L;
    const bowNeck=B*clamp(.18+p.bowTaper*.28,.18,.30),sternNeck=B*clamp(.48+p.sternTaper*.25,.52,.72);
    ctx.beginPath();ctx.moveTo(0,bow);
    ctx.bezierCurveTo(-bowNeck,bow+L*.10,-B*.98,bow+L*.34,-B,bow+L*.72);
    ctx.bezierCurveTo(-B,bow+L*1.10,-B*.90,bow+L*1.68,-sternNeck,stern);
    ctx.quadraticCurveTo(0,stern+B*.20,sternNeck,stern);
    ctx.bezierCurveTo(B*.90,bow+L*1.68,B,bow+L*1.10,B,bow+L*.72);
    ctx.bezierCurveTo(B*.98,bow+L*.34,bowNeck,bow+L*.10,0,bow);ctx.closePath();
  }
  function traceHullPath(ctx,ship){const p=hullProfile(ship);p.orientation==='vertical'?traceVerticalHull(ctx,p):traceHorizontalHull(ctx,p);return p;}
  function traceDeckPath(ctx,ship){
    const p=hullProfile(ship),q=Object.assign({},p,{halfLength:p.halfLength*.88,halfBeam:p.halfBeam*.78});
    q.orientation==='vertical'?traceVerticalHull(ctx,q):traceHorizontalHull(ctx,q);return q;
  }

  function damageSeed(gx,gy){let n=((gx|0)*73856093)^((gy|0)*19349663)^0x9e3779b9;n=(n^(n>>>13))*1274126177;return (n^(n>>>16))>>>0;}
  function seeded(seed,i){let n=(seed+i*2654435761)>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967295;}
  function traceOrganicHole(ctx,ship,cell,scale){
    const p=Grid.cellCenterLocal(ship,cell),seed=damageSeed(cell.gx,cell.gy),count=9,base=ship.cellSize*(scale||.72);
    ctx.beginPath();
    for(let i=0;i<count;i++){
      const a=Math.PI*2*i/count,r=base*(.62+seeded(seed,i)*.46),x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  function colorFor(ship){return ship.side==='player'?'#9b5d2d':ship.baseColor||'#74462e';}
  function deckFor(ship){return ship.deckColor||'#c99555';}
  function makeSurface(ship){
    const p=hullProfile(ship),pad=30,w=Math.ceil((p.orientation==='vertical'?p.beam:p.length)+pad*2),h=Math.ceil((p.orientation==='vertical'?p.length:p.beam)+pad*2);
    let s=surfaces.get(ship);
    if(s&&s.w===w&&s.h===h)return s;
    let canvas=null;
    if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(w,h);
    else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;}
    if(!canvas)return null;
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    s={canvas,ctx:canvas.getContext('2d'),w,h};surfaces.set(ship,s);return s;
  }

  function drawPlanks(ctx,ship){
    const p=hullProfile(ship);ctx.save();traceDeckPath(ctx,ship);ctx.clip();ctx.strokeStyle='rgba(91,55,31,.34)';ctx.lineWidth=1.4;
    const span=p.orientation==='vertical'?p.beam:p.length,across=p.orientation==='vertical'?p.length:p.beam;
    for(let d=-across*.48;d<=across*.48;d+=15){ctx.beginPath();if(p.orientation==='vertical'){ctx.moveTo(-span*.48,d);ctx.lineTo(span*.48,d);}else{ctx.moveTo(d,-span*.48);ctx.lineTo(d,span*.48);}ctx.stroke();}
    ctx.restore();
  }

  function drawBowStern(ctx,ship){
    const p=hullProfile(ship),L=p.halfLength,B=p.halfBeam;
    ctx.strokeStyle='rgba(70,39,22,.72)';ctx.lineWidth=3;
    ctx.beginPath();
    if(p.orientation==='vertical'){
      ctx.moveTo(-B*.52,-L*.46);ctx.quadraticCurveTo(0,-L*.68,B*.52,-L*.46);
      ctx.moveTo(-B*.62,L*.48);ctx.quadraticCurveTo(0,L*.28,B*.62,L*.48);
    }else{
      ctx.moveTo(-L*.46,-B*.52);ctx.quadraticCurveTo(-L*.68,0,-L*.46,B*.52);
      ctx.moveTo(L*.48,-B*.62);ctx.quadraticCurveTo(L*.28,0,L*.48,B*.62);
    }
    ctx.stroke();
  }

  function drawMastsAndSails(ctx,ship){
    const p=hullProfile(ship);
    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.type!=='mast')continue;
      const q=Grid.cellCenterLocal(ship,cell);
      ctx.save();ctx.translate(q.x,q.y);
      ctx.fillStyle='rgba(245,226,174,.72)';ctx.beginPath();
      if(p.orientation==='vertical')ctx.ellipse(0,0,ship.cellSize*2.25,ship.cellSize*.50,0,0,Math.PI*2);else ctx.ellipse(0,0,ship.cellSize*.50,ship.cellSize*2.25,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#51331f';ctx.lineWidth=3;ctx.beginPath();
      if(p.orientation==='vertical'){ctx.moveTo(-ship.cellSize*2.5,0);ctx.lineTo(ship.cellSize*2.5,0);}else{ctx.moveTo(0,-ship.cellSize*2.5);ctx.lineTo(0,ship.cellSize*2.5);}ctx.stroke();
      ctx.fillStyle='#4c2d1b';ctx.beginPath();ctx.arc(0,0,ship.cellSize*.28,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }

  function drawCannons(ctx,ship){
    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.type!=='cannon')continue;
      const q=Grid.cellCenterLocal(ship,cell);ctx.fillStyle='#273038';ctx.beginPath();ctx.arc(q.x,q.y,ship.cellSize*.24,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#111a20';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(q.x-ship.cellSize*.36,q.y);ctx.lineTo(q.x+ship.cellSize*.36,q.y);ctx.stroke();
    }
  }

  function drawDamageMarks(ctx,ship){
    for(const cell of ship.cells||[]){
      if(!cell.alive||!(cell.hp<cell.maxHp))continue;
      const q=Grid.cellCenterLocal(ship,cell),ratio=Math.max(0,cell.hp/Math.max(1,cell.maxHp)),s=ship.cellSize;
      ctx.fillStyle=ratio<=.33?'rgba(29,20,16,.42)':'rgba(62,40,27,.22)';ctx.beginPath();ctx.ellipse(q.x,q.y,s*(ratio<=.33?.48:.33),s*(ratio<=.33?.34:.22),damageSeed(cell.gx,cell.gy)%9*.17,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=ratio<=.33?'rgba(28,16,12,.96)':'rgba(75,43,25,.76)';ctx.lineWidth=ratio<=.33?2.2:1.5;ctx.beginPath();ctx.moveTo(q.x-s*.28,q.y-s*.16);ctx.lineTo(q.x,q.y);ctx.lineTo(q.x+s*.24,q.y+s*.20);ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+s*.20,q.y-s*.24);ctx.stroke();
      if(cell.flash>0){ctx.globalAlpha=Math.min(.8,cell.flash*6);ctx.fillStyle='#fff1b5';ctx.beginPath();ctx.ellipse(q.x,q.y,s*.48,s*.34,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    }
  }

  function cutDestroyedCells(ctx,ship){
    ctx.save();ctx.globalCompositeOperation='destination-out';
    for(const cell of ship.cells||[]){if(cell.alive)continue;traceOrganicHole(ctx,ship,cell,cell.type==='hull'?.78:.62);ctx.fillStyle='rgba(0,0,0,1)';ctx.fill();}
    ctx.restore();
    ctx.save();ctx.strokeStyle='rgba(47,26,17,.82)';ctx.lineWidth=2.1;
    for(const cell of ship.cells||[]){if(cell.alive)continue;traceOrganicHole(ctx,ship,cell,cell.type==='hull'?.80:.64);ctx.stroke();}
    ctx.restore();
  }

  function renderSurface(ship,state){
    const s=makeSurface(ship);if(!s)return null;const ctx=s.ctx;ctx.clearRect(0,0,s.w,s.h);ctx.save();ctx.translate(s.w/2,s.h/2);
    traceHullPath(ctx,ship);ctx.fillStyle='#4c2e20';ctx.fill();ctx.strokeStyle='#2d1d17';ctx.lineWidth=5;ctx.stroke();
    traceDeckPath(ctx,ship);ctx.fillStyle=deckFor(ship);ctx.fill();ctx.strokeStyle=colorFor(ship);ctx.lineWidth=8;ctx.stroke();
    drawPlanks(ctx,ship);drawBowStern(ctx,ship);drawMastsAndSails(ctx,ship);drawCannons(ctx,ship);drawDamageMarks(ctx,ship);cutDestroyedCells(ctx,ship);
    ctx.restore();return s;
  }

  function drawShipLocal(targetCtx,ship,state){const s=renderSurface(ship,state);if(!s)return false;targetCtx.drawImage(s.canvas,-s.w/2,-s.h/2);return true;}

  function drawDebrisClusterLocal(ctx,cluster){
    const s=cluster.cellSize||16;
    for(const cell of cluster.cells||[]){
      const seed=damageSeed(Math.round(cell.x/s),Math.round(cell.y/s)),a=(seed%7-3)*.055,len=s*(.70+seeded(seed,1)*.55),wid=s*(.24+seeded(seed,2)*.22);
      ctx.save();ctx.translate(cell.x,cell.y);ctx.rotate(a);ctx.fillStyle=cell.type==='cannon'?'#303840':(cell.type==='beam'||cell.type==='core'?'#8b682f':cluster.deckColor||cluster.baseColor||'#7a4a2e');
      ctx.beginPath();ctx.moveTo(-len*.52,-wid*.35);ctx.lineTo(len*.44,-wid*.50);ctx.lineTo(len*.54,wid*.24);ctx.lineTo(-len*.40,wid*.52);ctx.quadraticCurveTo(-len*.58,0,-len*.52,-wid*.35);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(45,27,18,.70)';ctx.lineWidth=1.4;ctx.stroke();ctx.restore();
    }
  }

  root.V9VectorShip={hullProfile,traceHullPath,traceDeckPath,damageSeed,traceOrganicHole,drawShipLocal,drawDebrisClusterLocal,drawPlanks,drawMastsAndSails,drawCannons,drawDamageMarks};
})(typeof globalThis!=='undefined'?globalThis:this);
