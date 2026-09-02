(function(root){
  'use strict';

  const Grid=root.V8ShipGrid;
  if(!Grid)throw new Error('V8ShipGrid must load before V9.0 vector ship renderer');

  const FULLNESS={player:.90,sloop:.68,gunship:.80,manowar:.93};
  const BOW_TAPER={player:.18,sloop:.12,gunship:.15,manowar:.18};
  const STERN_TAPER={player:.62,sloop:.55,gunship:.62,manowar:.70};

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  function hullProfile(ship){
    const rawW=ship.gridWidth*ship.cellSize;
    const rawH=ship.gridHeight*ship.cellSize;
    const vertical=ship.kind==='player';
    const fullness=FULLNESS[ship.kind]||.8;
    const length=(vertical?rawH:rawW)*.98;
    const beam=(vertical?rawW:rawH)*(.78+.16*fullness);
    return {
      orientation:vertical?'vertical':'horizontal',
      length,beam,fullness,
      bowTaper:BOW_TAPER[ship.kind]||.15,
      sternTaper:STERN_TAPER[ship.kind]||.62,
      halfLength:length*.5,
      halfBeam:beam*.5
    };
  }

  function traceHorizontalHull(ctx,p){
    const L=p.halfLength,B=p.halfBeam;
    const bow=-L,stern=L;
    const bowNeck=B*clamp(.18+p.bowTaper*.28,.18,.30);
    const sternNeck=B*clamp(.46+p.sternTaper*.28,.50,.70);
    ctx.beginPath();
    ctx.moveTo(bow,0);
    ctx.bezierCurveTo(bow+L*.10,-bowNeck,bow+L*.34,-B*.98,bow+L*.72,-B);
    ctx.bezierCurveTo(bow+L*1.10,-B,bow+L*1.68,-B*.90,stern,-sternNeck);
    ctx.quadraticCurveTo(stern+B*.20,0,stern,sternNeck);
    ctx.bezierCurveTo(bow+L*1.68,B*.90,bow+L*1.10,B,bow+L*.72,B);
    ctx.bezierCurveTo(bow+L*.34,B*.98,bow+L*.10,bowNeck,bow,0);
    ctx.closePath();
  }

  function traceVerticalHull(ctx,p){
    const L=p.halfLength,B=p.halfBeam;
    const bow=-L,stern=L;
    const bowNeck=B*clamp(.18+p.bowTaper*.28,.18,.30);
    const sternNeck=B*clamp(.48+p.sternTaper*.25,.52,.72);
    ctx.beginPath();
    ctx.moveTo(0,bow);
    ctx.bezierCurveTo(-bowNeck,bow+L*.10,-B*.98,bow+L*.34,-B,bow+L*.72);
    ctx.bezierCurveTo(-B,bow+L*1.10,-B*.90,bow+L*1.68,-sternNeck,stern);
    ctx.quadraticCurveTo(0,stern+B*.20,sternNeck,stern);
    ctx.bezierCurveTo(B*.90,bow+L*1.68,B,bow+L*1.10,B,bow+L*.72);
    ctx.bezierCurveTo(B*.98,bow+L*.34,bowNeck,bow+L*.10,0,bow);
    ctx.closePath();
  }

  function traceHullPath(ctx,ship){
    const p=hullProfile(ship);
    if(p.orientation==='vertical')traceVerticalHull(ctx,p);else traceHorizontalHull(ctx,p);
    return p;
  }

  function traceDeckPath(ctx,ship){
    const p=hullProfile(ship),scale=.78;
    const q=Object.assign({},p,{halfLength:p.halfLength*.88,halfBeam:p.halfBeam*scale});
    if(q.orientation==='vertical')traceVerticalHull(ctx,q);else traceHorizontalHull(ctx,q);
    return q;
  }

  function damageSeed(gx,gy){
    let n=((gx|0)*73856093)^((gy|0)*19349663)^0x9e3779b9;
    n=(n^(n>>>13))*1274126177;
    return (n^(n>>>16))>>>0;
  }

  root.V9VectorShip={hullProfile,traceHullPath,traceDeckPath,damageSeed};
})(typeof globalThis!=='undefined'?globalThis:this);
