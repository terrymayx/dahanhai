(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V10.1 compartment water visual requires V8ShipGrid');

  const WATER_QUANT=.02;
  const POSE_QUANT=.035;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function revision(ship){
    const waters=(ship&&ship.__v99Compartments||[]).map(c=>Math.round(clamp(Number(c.water)||0,0,1)/WATER_QUANT)).join(',');
    const roll=Math.round((Number(ship&&ship.__v99Roll)||0)/POSE_QUANT),trim=Math.round((Number(ship&&ship.__v99Trim)||0)/POSE_QUANT);
    return `${Number(ship&&ship.__v99TopologyRevision)||0}:${waters}:${roll}:${trim}`;
  }

  function build(ship){
    if(!ship)return {revision:'',bands:[]};
    const rev=revision(ship),comps=ship.__v99Compartments||[],bands=[];
    const cs=ship.cellSize||8,player=ship.kind==='player';
    const longSize=Math.max(cs,(player?ship.gridHeight:ship.gridWidth)*cs),transSize=Math.max(cs,(player?ship.gridWidth:ship.gridHeight)*cs),count=Math.max(1,comps.length);
    const seg=longSize/count,roll=clamp(Number(ship.__v99Roll)||0,-.9,.9),trim=clamp(Number(ship.__v99Trim)||0,-.9,.9);
    for(let i=0;i<comps.length;i++){
      const comp=comps[i],water=clamp(Number(comp.water)||0,0,1);if(water<.015)continue;
      const longCenter=-longSize/2+(i+.5)*seg,side=clamp(Number(comp.waterSide)||0,-1,1);
      const lowSideShift=(side*.16+Math.sign(roll)*Math.abs(roll)*.12)*transSize;
      const thickness=transSize*(.09+.62*Math.sqrt(water));
      const slope=clamp(roll*.35+trim*.12,-.28,.28);
      if(player)bands.push({x:-thickness/2+lowSideShift,y:longCenter-seg*.43,w:thickness,h:seg*.86,water,slope,side});
      else bands.push({x:longCenter-seg*.43,y:-thickness/2+lowSideShift,w:seg*.86,h:thickness,water,slope,side});
    }
    const cache={revision:rev,bands};ship.__v101WaterVisual=cache;return cache;
  }

  function ensure(ship){
    if(!ship)return {revision:'',bands:[]};
    const rev=revision(ship),cache=ship.__v101WaterVisual;
    return cache&&cache.revision===rev?cache:build(ship);
  }

  function draw(ctx,ship){
    if(!ctx||!ship)return;
    const cache=ensure(ship),player=ship.kind==='player';
    for(const band of cache.bands){
      ctx.save();
      ctx.globalAlpha=.12+.23*band.water;
      ctx.fillStyle='rgba(45,160,210,.78)';
      ctx.fillRect(band.x,band.y,band.w,band.h);
      ctx.globalAlpha=.24+.30*band.water;
      ctx.strokeStyle='rgba(203,244,255,.90)';ctx.lineWidth=1.3;
      ctx.beginPath();
      if(player){
        const y=band.y+band.h*(1-band.water*.55);ctx.moveTo(band.x,y-band.slope*band.w*.5);ctx.lineTo(band.x+band.w,y+band.slope*band.w*.5);
      }else{
        const y=band.y+band.h*(1-band.water*.55);ctx.moveTo(band.x,y-band.slope*band.w*.5);ctx.lineTo(band.x+band.w,y+band.slope*band.w*.5);
      }
      ctx.stroke();ctx.restore();
    }
  }

  root.V101CompartmentWaterVisual={WATER_QUANT,POSE_QUANT,revision,build,ensure,draw};
})(typeof globalThis!=='undefined'?globalThis:this);
