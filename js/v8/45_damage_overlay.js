(function(root){
  'use strict';
  const C=root.V8Config,G=root.V8ShipGrid,R=root.V8Render,S=root.V8ComponentStress||null;
  if(!C||!G||!R)throw new Error('V9 damage overlay requires config, grid and renderer');

  const originalDraw=R.draw;
  const TYPE_LABEL={hull:'船壳',deck:'甲板',beam:'主梁',core:'主梁',powder:'火药舱',rudder:'舵机',mast:'桅杆',cannon:'炮位'};
  const STAGE_LABEL={healthy:'完整',damaged:'受损',critical:'危急',destroyed:'已毁'};

  function shipsOf(state){return state?[state.player,...(state.enemies||[])].filter(Boolean):[];}
  function worldTransform(ctx,canvas){const iw=canvas.clientWidth||root.innerWidth||C.W,ih=canvas.clientHeight||root.innerHeight||C.H;const dpr=Math.min(root.devicePixelRatio||1,2),scale=Math.min(iw/C.W,ih/C.H);const ox=(iw-C.W*scale)/2,oy=(ih-C.H*scale)/2;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(ox,oy);ctx.scale(scale,scale);}
  function componentStage(cell){if(S&&typeof S.componentStage==='function')return S.componentStage(cell);const stage=G.damageStage?G.damageStage(cell):'intact';if(stage==='destroyed')return 'destroyed';if(stage==='critical')return 'critical';if(stage==='cracked')return 'damaged';return 'healthy';}
  function resolveAimCell(state){if(!state||!state.aim)return null;const aim=state.aim,ship=shipsOf(state).find(s=>s.id===aim.shipId);if(!ship)return null;const key=aim.gx+','+aim.gy,cell=(ship.cellMap&&ship.cellMap[key])||(ship.cells||[]).find(c=>c.gx===aim.gx&&c.gy===aim.gy);return cell?{ship,cell}:null;}
  function formatAimInfo(ship,cell){
    if(!ship||!cell)return {primary:'',detail:''};const type=TYPE_LABEL[cell.type]||'结构',stage=componentStage(cell),hp=Math.max(0,Math.round(cell.hp||0)),max=Math.max(1,Math.round(cell.maxHp||cell.hp||1));
    const primary=`${type} ${hp} / ${max} · ${STAGE_LABEL[stage]||'完整'}`;let detail='';
    if(cell.type==='cannon')detail=`炮效 ${Math.round((Number.isFinite(ship.cannonEfficiency)?ship.cannonEfficiency:1)*100)}%`;
    else if(cell.type==='mast')detail=`帆效 ${Math.round((Number.isFinite(ship.mastEfficiency)?ship.mastEfficiency:1)*100)}%`;
    else if(cell.type==='rudder')detail=`舵效 ${Math.round((Number.isFinite(ship.rudderEfficiency)?ship.rudderEfficiency:1)*100)}%`;
    else if(cell.type==='beam'||cell.type==='core')detail=`结构应力 ${Math.round((ship.structureStress||0)*100)}%`;
    else if(cell.type==='powder'&&(stage==='critical'||(ship.powderDanger||0)>=1))detail='危险';
    return {primary,detail,stage,type};
  }
  function drawCrack(ctx,x,y,s,stage,seed){
    const k=(seed%5)*.7;ctx.strokeStyle=stage==='critical'?'rgba(28,17,13,.96)':'rgba(74,42,26,.78)';ctx.lineWidth=stage==='critical'?2.15:1.35;ctx.beginPath();ctx.moveTo(x-s*.31,y-s*(.22-k*.02));ctx.lineTo(x-s*.03,y-s*.02);ctx.lineTo(x+s*.20,y+s*.23);ctx.moveTo(x-s*.03,y-s*.02);ctx.lineTo(x+s*.27,y-s*.20);if(stage==='critical'){ctx.moveTo(x+s*.02,y+s*.04);ctx.lineTo(x-s*.24,y+s*.29);}ctx.stroke();
    if(stage==='critical'){ctx.fillStyle='rgba(31,22,19,.30)';ctx.beginPath();ctx.ellipse(x+s*.10,y-s*.04,s*.30,s*.20,(seed%9)*.11,0,Math.PI*2);ctx.fill();}
  }
  function drawStress(ctx,x,y,s,stress,seed){if(!(stress>.08))return;const a=Math.min(.72,.12+stress*.58),j=(seed%7-3)*.04;ctx.strokeStyle=`rgba(91,38,28,${a})`;ctx.lineWidth=1+stress*1.4;ctx.beginPath();ctx.moveTo(x-s*.34,y+s*j);ctx.lineTo(x-s*.06,y-s*.16);ctx.lineTo(x+s*.32,y+s*.18);ctx.stroke();}
  function drawShipDamage(ctx,ship,state){if(!ship||ship.state==='gone')return;const pose=R.shipVisualPose(ship,state),s=ship.cellSize;ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.rotation);ctx.globalAlpha=pose.alpha;for(const cell of ship.cells||[]){if(!cell.alive)continue;const damageStage=G.damageStage?G.damageStage(cell):'intact',p=G.cellCenterLocal(ship,cell),seed=cell.gx*17+cell.gy*31;if(damageStage!=='intact'&&damageStage!=='destroyed')drawCrack(ctx,p.x,p.y,s,damageStage,seed);drawStress(ctx,p.x,p.y,s,cell.stress||0,seed);}ctx.restore();ctx.globalAlpha=1;}
  function drawStressRuptures(ctx,state){for(const f of state.fx||[]){if(f.k!=='stressRupture')continue;const p=Math.max(0,Math.min(1,(f.t||0)/(f.dur||.58))),r=(f.r||52)*(0.35+p*.8);ctx.globalAlpha=(1-p)*.85;ctx.strokeStyle='rgba(82,37,27,.9)';ctx.lineWidth=3*(1-p*.45);ctx.beginPath();ctx.arc(f.x,f.y,r,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(f.x-r*.55,f.y+r*.08);ctx.lineTo(f.x-r*.1,f.y-r*.18);ctx.lineTo(f.x+r*.52,f.y+r*.12);ctx.stroke();}ctx.globalAlpha=1;}
  function drawAimInfo(ctx,state){const resolved=resolveAimCell(state);if(!resolved)return;const {ship,cell}=resolved,info=formatAimInfo(ship,cell),world=G.cellCenterWorld(ship,cell),x=Math.max(170,Math.min(C.W-170,world.x)),y=Math.max(120,world.y-58),width=info.detail?300:270,height=info.detail?58:38;ctx.fillStyle='rgba(7,30,43,.88)';ctx.beginPath();ctx.roundRect(x-width/2,y-height/2,width,height,10);ctx.fill();ctx.strokeStyle=info.stage==='critical'?'rgba(255,185,84,.95)':'rgba(222,245,255,.65)';ctx.lineWidth=1.5;ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 17px "Microsoft YaHei",sans-serif';ctx.fillStyle='#f5fbff';ctx.fillText(info.primary,x,y-(info.detail?10:0));if(info.detail){ctx.font='700 14px "Microsoft YaHei",sans-serif';ctx.fillStyle=info.detail==='危险'?'#ffd06a':'#bfe9ff';ctx.fillText(info.detail,x,y+14);}}
  function drawHudOverlay(ctx,state){
    ctx.fillStyle='rgba(5,30,48,.90)';ctx.beginPath();ctx.roundRect(26,24,650,112,18);ctx.fill();ctx.font='700 27px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText('V9.0 · 矢量船体重构',50,55);ctx.font='700 21px "Microsoft YaHei",sans-serif';ctx.fillStyle='#dff7ff';ctx.fillText(`我方结构 ${Math.round(G.integrity(state.player)*100)}%`,50,96);ctx.textAlign='right';ctx.fillStyle='#ffd65a';ctx.fillText(`击沉 ${state.kills}   金币 ${state.gold}`,650,96);
    ctx.fillStyle='rgba(7,37,53,.78)';ctx.beginPath();ctx.roundRect(700,18,1000,52,14);ctx.fill();ctx.font='700 21px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f3fbff';ctx.fillText('连续船壳 → 局部裂纹 → 不规则破洞 → 主梁断裂',1200,44);
    ctx.fillStyle='rgba(7,37,53,.76)';ctx.beginPath();ctx.roundRect(310,C.H-68,1300,42,12);ctx.fill();ctx.font='700 19px "Microsoft YaHei",sans-serif';ctx.fillStyle='#e9f8ff';ctx.fillText('底层仍是独立格耐久与破甲穿透 · 视觉不显示网格 · 无镜头/船体受击抖动',960,C.H-47);
  }
  function drawDamageOverlay(state){if(typeof document==='undefined'||!state)return;const canvas=document.getElementById('cv');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.save();worldTransform(ctx,canvas);for(const ship of shipsOf(state))drawShipDamage(ctx,ship,state);drawStressRuptures(ctx,state);drawAimInfo(ctx,state);drawHudOverlay(ctx,state);ctx.restore();}
  R.draw=function(state){originalDraw(state);drawDamageOverlay(state);};R.drawDamageOverlay=drawDamageOverlay;R.resolveAimCell=resolveAimCell;R.formatAimInfo=formatAimInfo;
})(typeof globalThis!=='undefined'?globalThis:this);
