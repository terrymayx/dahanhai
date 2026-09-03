(function(root){
  'use strict';
  const C=root.V8Config,R=root.V8Render,V=root.V9VectorShip,G=root.V8ShipGrid,A=root.V972PlayerAttack||null,E=root.V954ImpactExplosion||null,Armor=root.V98Armor||null,Material=root.V99Material||null,Sinking=root.V100Sinking||null;
  if(!C||!R||!V||!G||typeof R.draw!=='function')return;
  const originalDraw=R.draw;

  function worldTransform(ctx,canvas){const iw=canvas.clientWidth||root.innerWidth||C.W,ih=canvas.clientHeight||root.innerHeight||C.H,dpr=Math.min(root.devicePixelRatio||1,2),scale=Math.min(iw/C.W,ih/C.H),ox=(iw-C.W*scale)/2,oy=(ih-C.H*scale)/2;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(ox,oy);ctx.scale(scale,scale);}
  function badge(ctx,text,x,y){ctx.font='700 15px "Microsoft YaHei",sans-serif';const w=Math.max(86,ctx.measureText(text).width+20);ctx.fillStyle='rgba(5,35,52,.84)';ctx.beginPath();ctx.roundRect(x-w/2,y-14,w,28,8);ctx.fill();ctx.strokeStyle='rgba(145,225,255,.55)';ctx.lineWidth=1;ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#d9f7ff';ctx.fillText(text,x,y);}
  function activeTarget(state){if(state&&state.focus&&state.focus.state==='active')return state.focus;if(A&&typeof A.resolveTarget==='function')return A.resolveTarget(state);return null;}
  function playerAmmoType(state){const Ammo=root.V102Ammo||null;if(Ammo&&typeof Ammo.normalizePlayerType==='function')return Ammo.normalizePlayerType(state&&state.playerAmmoType);const t=state&&state.playerAmmoType;return t==='chain'||t==='explosive'||t==='solid'?t:'solid';}
  function ammoLabel(state){const type=playerAmmoType(state),Ammo=root.V102Ammo||null;if(Ammo&&typeof Ammo.labelFor==='function')return Ammo.labelFor(type);return type==='chain'?'链弹':type==='explosive'?'爆裂弹':'实心弹';}

  function targetPreviewCell(state,target){
    if(!target)return null;const aim=state&&state.aim;
    if(aim&&aim.shipId===target.id&&Number.isFinite(aim.lx)&&Number.isFinite(aim.ly)){const g=G.localToGrid(target,aim.lx,aim.ly),aimed=target.cellMap&&target.cellMap[g.gx+','+g.gy];if(aimed&&aimed.alive&&!aimed.detachedGone)return aimed;}
    for(const cell of target.cells||[])if(cell.alive&&!cell.detachedGone&&cell.type==='hull')return cell;for(const cell of target.cells||[])if(cell.alive&&!cell.detachedGone)return cell;return {type:'hull',gx:0,gy:0};
  }

  function gradeColor(grade){if(grade==='ricochet')return '#d7e0e7';if(grade==='heavy')return '#ff9f57';if(grade==='penetrated')return '#ffe17a';if(grade==='resisted')return '#bfeaff';return '#d7e0e7';}
  function previewProjectile(state,target,cell,attack){const player=state&&state.player;let tx=target&&target.x||0,ty=target&&target.y||0;if(cell&&typeof G.cellCenterWorld==='function'){try{const p=G.cellCenterWorld(target,cell);tx=p.x;ty=p.y;}catch(e){}}const px=player&&Number.isFinite(player.x)?player.x:tx-1,py=player&&Number.isFinite(player.y)?player.y:ty;let vx=tx-px,vy=ty-py;const d=Math.hypot(vx,vy)||1;vx=vx/d*900;vy=vy/d*900;return{vx,vy,damage:attack,attackPower:attack,ammoType:playerAmmoType(state),__v99Ricocheted:false};}

  function targetArmorPreview(state,target,cell,attack){
    if(Material&&typeof Material.resolveDirect==='function'){if(typeof Material.prepareCell==='function')Material.prepareCell(target,cell);const result=Material.resolveDirect(target,cell,previewProjectile(state,target,cell,attack));return{grade:result.grade,label:typeof Material.gradeLabel==='function'?Material.gradeLabel(result.grade):result.grade,current:Number.isFinite(cell.armorHp)?cell.armorHp:result.armorNow,max:Number.isFinite(cell.armorMax)?cell.armorMax:result.armorMax,impactAngle:result.impactAngle||0,effectiveArmor:result.effectiveArmor||0};}
    if(Armor&&typeof Armor.resolveDirectHit==='function'){const result=Armor.resolveDirectHit(target,cell,attack);return{grade:result.grade,label:typeof Armor.gradeLabel==='function'?Armor.gradeLabel(result.grade):result.grade,current:result.armor,max:result.armor,impactAngle:0,effectiveArmor:result.armor};}return null;
  }

  function tacticalHint(state,target,cell){
    if(!target)return '';
    const cells=(target.cells||[]).filter(c=>c&&c.alive&&!c.detachedGone);
    const heavilyDamaged=c=>{
      const hpRatio=Number.isFinite(c.maxHp)&&c.maxHp>0?(Number(c.hp)||0)/c.maxHp:1;
      const armorRatio=Number.isFinite(c.armorMax)&&c.armorMax>0?(Number(c.armorHp)||0)/c.armorMax:1;
      return (Number(c.fracture)||0)>=.55||(Number(c.fatigue)||0)>=.55||hpRatio<=.48||armorRatio<=.35;
    };
    if((cell&&heavilyDamaged(cell))||cells.filter(heavilyDamaged).length>=Math.max(2,Math.ceil(cells.length*.16)))return '建议：爆裂弹扩大破坏';
    const liveMasts=cells.filter(c=>c.type==='mast');
    if(liveMasts.length&&liveMasts.some(c=>(Number(c.hp)||0)>=Math.max(1,(Number(c.maxHp)||1)*.45)))return '建议：链弹打桅杆';
    if(cell&&['hull','beam','core'].includes(cell.type)){
      const armorRatio=Number.isFinite(cell.armorMax)&&cell.armorMax>0?(Number(cell.armorHp)||0)/cell.armorMax:1;
      if(armorRatio>=.55)return '建议：实心弹破甲';
    }
    return '';
  }

  function compartmentSummary(ship){const comps=ship&&ship.__v99Compartments||[];if(!comps.length)return '舱水 --';const values=comps.map(c=>Math.round(Math.max(0,Math.min(1,Number(c.water)||0))*100));return `舱水 ${values.join(' | ')}%`;}
  function capsizeLabel(ship){const stage=Sinking&&typeof Sinking.capsizeStage==='function'?Sinking.capsizeStage(ship):(ship&&ship.__v100CapsizeStage||'stable');return stage==='locked'?'翻覆':stage==='capsizing'?'正在翻覆':stage==='danger'?'危险':stage==='listing'?'侧倾':'稳定';}
  function breakStageLabel(stage){return stage==='separated'?'已断裂':stage==='tearing'?'撕裂':stage==='yielding'?'弯曲':stage==='warning'?'预警':'稳定';}
  function structuralSummary(ship){
    const ratio=Math.max(0,Number(ship&&ship.__v101CriticalRatio)||Number(ship&&ship.__v100MaxBendingRatio)||0),region=ship&&ship.__v101CriticalRegion||'--',stage=breakStageLabel(ship&&ship.__v101BreakStage||'stable');
    return `船体应力 ${Math.round(ratio*100)}% · 危险区 ${region} · 阶段 ${stage}`;
  }
  function physicalSummary(ship){const roll=Number(ship&&ship.__v100PhysicalRoll)||Number(ship&&ship.__v99Roll)||0,deg=Math.abs(roll)*180/Math.PI;return `横倾 ${deg.toFixed(1)}° · ${capsizeLabel(ship)} · 浸水强度 ${(Number(ship&&ship.__v101ImmersionSeverity)||0).toFixed(2)}`;}

  function drawStatus(state){
    if(typeof document==='undefined'||!state)return;const canvas=document.getElementById('cv');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.save();worldTransform(ctx,canvas);
    const attack=A&&typeof A.getAttack==='function'?A.getAttack(state):Math.round(state.playerShellAttack||72),auto=A&&typeof A.isAuto==='function'?A.isAuto(state):!!state.playerAttackAuto,ammoType=playerAmmoType(state),radiusScale=E&&typeof E.blastRadiusScale==='function'?E.blastRadiusScale({side:'player',attackPower:attack,damage:attack,ammoType}):1;
    const pf=Math.round(Math.max(0,Math.min(1,state.player&&state.player.floodLevel||0))*100),leaks=(state.player&&state.player.__v97LeakCount)||0;ctx.font='700 17px "Microsoft YaHei",sans-serif';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle='#ffd65a';ctx.fillText(`炮攻 ${attack} ${auto?'AUTO':'手动'} · 弹药 ${ammoLabel(state)} · 爆幅 ${radiusScale.toFixed(1)}×`,250,96);

    const target=activeTarget(state);
    if(target){
      const cell=targetPreviewCell(state,target),preview=cell&&targetArmorPreview(state,target,cell,attack);
      if(preview){ctx.fillStyle=gradeColor(preview.grade);ctx.font='700 15px "Microsoft YaHei",sans-serif';ctx.fillText(`局部装甲 ${Math.round(preview.current)}/${Math.round(preview.max)} · 入射角 ${Math.round(preview.impactAngle)}° · 等效装甲 ${Math.round(preview.effectiveArmor)} · 预计 ${preview.label}`,250,120);}
      ctx.font='700 14px "Microsoft YaHei",sans-serif';ctx.fillStyle=(Number(target.__v101CriticalRatio)||0)>=1.35?'#ffad73':'#bfeaff';ctx.fillText(structuralSummary(target),250,143);
      ctx.fillStyle='#bfeaff';ctx.fillText(compartmentSummary(target),250,164);
      ctx.fillStyle=Math.abs(Number(target.__v100PhysicalRoll)||Number(target.__v99Roll)||0)>=.56?'#ffb36b':'#dff7ff';ctx.fillText(physicalSummary(target),250,185);
      const hint=tacticalHint(state,target,cell);if(hint){ctx.fillStyle='#ffe78a';ctx.font='700 13px "Microsoft YaHei",sans-serif';ctx.fillText(hint,250,205);}
    }

    ctx.textAlign='right';ctx.font='700 17px "Microsoft YaHei",sans-serif';ctx.fillStyle=pf>=70?'#ffd08a':pf>=35?'#bfeaff':'#dff7ff';ctx.fillText(`进水 ${pf}%${leaks?` · 外海破口 ${leaks}`:''}`,650,96);
    for(const ship of state.enemies||[]){if(!ship||ship.state!=='active')continue;const flood=Math.max(0,Math.min(1,ship.floodLevel||0));if(flood<.015)continue;const pose=R.shipVisualPose(ship,state),p=V.hullProfile(ship),y=pose.y+(p.orientation==='horizontal'?p.halfBeam+27:p.halfLength+27);badge(ctx,`进水 ${Math.round(flood*100)}%`,pose.x,y);}
    ctx.restore();
  }

  R.draw=function(state){originalDraw(state);drawStatus(state);};
  root.V97StatusOverlay={drawStatus,targetPreviewCell,activeTarget,playerAmmoType,ammoLabel,tacticalHint,targetArmorPreview,previewProjectile,compartmentSummary,structuralSummary,physicalSummary,breakStageLabel};
})(typeof globalThis!=='undefined'?globalThis:this);
