(function(root){
  'use strict';
  const C=root.V8Config,G=root.V8ShipGrid,R=root.V8Render,S=root.V8ComponentStress||null;
  if(!C||!G||!R)throw new Error('V9.9 damage overlay requires config, grid and renderer');

  const originalDraw=R.draw;
  const TYPE_LABEL={hull:'船壳',deck:'甲板',beam:'主梁',core:'主梁',powder:'火药舱',rudder:'舵机',mast:'桅杆',cannon:'炮位'};
  const STAGE_LABEL={healthy:'完整',damaged:'受损',critical:'危急',destroyed:'已毁'};

  function shipsOf(state){return state?[state.player,...(state.enemies||[])].filter(Boolean):[];}
  function worldTransform(ctx,canvas){const iw=canvas.clientWidth||root.innerWidth||C.W,ih=canvas.clientHeight||root.innerHeight||C.H;const dpr=Math.min(root.devicePixelRatio||1,2),scale=Math.min(iw/C.W,ih/C.H);const ox=(iw-C.W*scale)/2,oy=(ih-C.H*scale)/2;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(ox,oy);ctx.scale(scale,scale);}
  function componentStage(cell){if(S&&typeof S.componentStage==='function')return S.componentStage(cell);const stage=G.damageStage?G.damageStage(cell):'intact';if(stage==='destroyed')return 'destroyed';if(stage==='critical')return 'critical';if(stage==='cracked')return 'damaged';return 'healthy';}
  function resolveAimCell(state){if(!state||!state.aim)return null;const aim=state.aim,ship=shipsOf(state).find(s=>s.id===aim.shipId);if(!ship)return null;const k=aim.gx+','+aim.gy,cell=(ship.cellMap&&ship.cellMap[k])||(ship.cells||[]).find(c=>c.gx===aim.gx&&c.gy===aim.gy);return cell?{ship,cell}:null;}

  function formatAimInfo(ship,cell){
    if(!ship||!cell)return {primary:'',detail:''};
    const type=TYPE_LABEL[cell.type]||'结构',stage=componentStage(cell),hp=Math.max(0,Math.round(cell.hp||0)),max=Math.max(1,Math.round(cell.maxHp||cell.hp||1));
    const fire=cell.burning?' · 燃烧':'';const primary=`${type} ${hp} / ${max} · ${STAGE_LABEL[stage]||'完整'}${fire}`;
    let detail='';
    if(cell.type==='cannon')detail=`炮效 ${Math.round((Number.isFinite(ship.cannonEfficiency)?ship.cannonEfficiency:1)*100)}%`;
    else if(cell.type==='mast')detail=`帆效 ${Math.round((Number.isFinite(ship.mastEfficiency)?ship.mastEfficiency:1)*100)}%`;
    else if(cell.type==='rudder')detail=`舵效 ${Math.round((Number.isFinite(ship.rudderEfficiency)?ship.rudderEfficiency:1)*100)}%`;
    else if(cell.type==='beam'||cell.type==='core')detail=`局部应力 ${Math.round((Number(cell.structuralStress)||0)*100)}%`;
    else if(cell.type==='powder'&&(stage==='critical'||(ship.powderDanger||0)>=1))detail='危险';
    if(Number.isFinite(cell.armorMax)){
      const armor=Math.max(0,Math.round(cell.armorHp||0)),armorMax=Math.max(1,Math.round(cell.armorMax||1)),fracture=Math.round(Math.max(0,Math.min(1,cell.fracture||0))*100);
      const material=`装甲 ${armor}/${armorMax} · 裂纹 ${fracture}%`;
      detail=detail?detail+' · '+material:material;
    }
    return {primary,detail,stage,type};
  }

  function materialCache(ship){
    if(!ship)return[];
    const revision=(ship.__v96DamageRevision||0)+':' +(ship.__v99MaterialRevision||0)+':' +(ship.__v99TopologyRevision||0);
    if(ship.__v99MaterialVisualCache&&ship.__v99MaterialVisualCache.revision===revision)return ship.__v99MaterialVisualCache.items;
    const items=[];
    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.detachedGone)continue;
      const fracture=Math.max(0,Math.min(1,Number(cell.fracture)||0)),armorMax=Number(cell.armorMax)||0,armorHp=Number(cell.armorHp);
      const wear=armorMax>0&&Number.isFinite(armorHp)?1-Math.max(0,Math.min(1,armorHp/armorMax)):0;
      const severity=Math.max(fracture,wear*.82);
      if(severity<.16)continue;
      items.push({cell,severity});
    }
    items.sort((a,b)=>b.severity-a.severity);
    const limited=items.slice(0,72);
    ship.__v99MaterialVisualCache={revision,items:limited};
    return limited;
  }

  function drawMaterialWear(ctx,state){
    for(const ship of shipsOf(state)){
      for(const item of materialCache(ship)){
        const p=G.cellCenterWorld(ship,item.cell),s=Math.max(3,(ship.cellSize||8)*(.42+item.severity*.42));
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate((item.cell.gx*1.71+item.cell.gy*.93)%2.4-.8);ctx.globalAlpha=.28+.50*item.severity;
        ctx.strokeStyle=item.severity>.62?'rgba(55,27,20,.92)':'rgba(92,54,35,.78)';ctx.lineWidth=1.2+item.severity*1.8;ctx.beginPath();ctx.moveTo(-s,0);ctx.lineTo(-s*.18,-s*.45);ctx.lineTo(s*.20,s*.18);ctx.lineTo(s,.05);ctx.stroke();
        if(item.severity>.48){ctx.globalAlpha=.12+.24*item.severity;ctx.fillStyle='rgba(44,24,18,.88)';ctx.beginPath();ctx.ellipse(0,0,s*.8,s*.32,0,0,Math.PI*2);ctx.fill();}
        ctx.restore();
      }
    }
  }

  function drawStressRuptures(ctx,state){for(const f of state.fx||[]){if(f.k!=='stressRupture')continue;const p=Math.max(0,Math.min(1,(f.t||0)/(f.dur||.58))),r=(f.r||52)*(0.35+p*.8);ctx.globalAlpha=(1-p)*.85;ctx.strokeStyle='rgba(82,37,27,.9)';ctx.lineWidth=3*(1-p*.45);ctx.beginPath();ctx.arc(f.x,f.y,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}}
  function drawAimInfo(ctx,state){
    const resolved=resolveAimCell(state);if(!resolved)return;
    const {ship,cell}=resolved,info=formatAimInfo(ship,cell),world=G.cellCenterWorld(ship,cell),x=Math.max(190,Math.min(C.W-190,world.x)),y=Math.max(130,world.y-64),width=info.detail?430:300,height=info.detail?60:38;
    ctx.fillStyle='rgba(7,30,43,.88)';ctx.beginPath();ctx.roundRect(x-width/2,y-height/2,width,height,10);ctx.fill();
    ctx.strokeStyle=cell.burning?'rgba(255,126,46,.95)':info.stage==='critical'?'rgba(255,185,84,.95)':'rgba(222,245,255,.65)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 17px "Microsoft YaHei",sans-serif';ctx.fillStyle='#f5fbff';ctx.fillText(info.primary,x,y-(info.detail?10:0));
    if(info.detail){ctx.font='700 14px "Microsoft YaHei",sans-serif';ctx.fillStyle=info.detail==='危险'?'#ffd06a':'#bfe9ff';ctx.fillText(info.detail,x,y+14);}
  }
  function drawHudOverlay(ctx,state){
    ctx.fillStyle='rgba(5,30,48,.90)';ctx.beginPath();ctx.roundRect(26,24,650,112,18);ctx.fill();ctx.font='700 27px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText('V9.9 · 真实结构破坏',50,55);
    ctx.font='700 21px "Microsoft YaHei",sans-serif';ctx.fillStyle='#dff7ff';ctx.fillText(`我方结构 ${Math.round(G.integrity(state.player)*100)}%`,50,96);ctx.textAlign='right';ctx.fillStyle='#ffd65a';ctx.fillText(`击沉 ${state.kills}   金币 ${state.gold}`,650,96);
    ctx.fillStyle='rgba(7,37,53,.78)';ctx.beginPath();ctx.roundRect(700,18,1000,52,14);ctx.fill();ctx.font='700 21px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f3fbff';ctx.fillText('8px物理格 · 局部承重 · 外海连通舱室 · 重心/浮力中心',1200,44);
  }
  function drawDamageOverlay(state){if(typeof document==='undefined'||!state)return;const canvas=document.getElementById('cv');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.save();worldTransform(ctx,canvas);drawMaterialWear(ctx,state);drawStressRuptures(ctx,state);drawAimInfo(ctx,state);drawHudOverlay(ctx,state);ctx.restore();}
  R.draw=function(state){originalDraw(state);drawDamageOverlay(state);};R.drawDamageOverlay=drawDamageOverlay;R.resolveAimCell=resolveAimCell;R.formatAimInfo=formatAimInfo;
})(typeof globalThis!=='undefined'?globalThis:this);
