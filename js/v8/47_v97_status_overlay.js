(function(root){
  'use strict';
  const C=root.V8Config,R=root.V8Render,V=root.V9VectorShip,G=root.V8ShipGrid,A=root.V972PlayerAttack||null,E=root.V954ImpactExplosion||null,Armor=root.V98Armor||null,Material=root.V99Material||null;
  if(!C||!R||!V||!G||typeof R.draw!=='function')return;
  const originalDraw=R.draw;

  function worldTransform(ctx,canvas){
    const iw=canvas.clientWidth||root.innerWidth||C.W,ih=canvas.clientHeight||root.innerHeight||C.H;
    const dpr=Math.min(root.devicePixelRatio||1,2),scale=Math.min(iw/C.W,ih/C.H),ox=(iw-C.W*scale)/2,oy=(ih-C.H*scale)/2;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(ox,oy);ctx.scale(scale,scale);
  }
  function badge(ctx,text,x,y){
    ctx.font='700 15px "Microsoft YaHei",sans-serif';const w=Math.max(86,ctx.measureText(text).width+20);
    ctx.fillStyle='rgba(5,35,52,.84)';ctx.beginPath();ctx.roundRect(x-w/2,y-14,w,28,8);ctx.fill();
    ctx.strokeStyle='rgba(145,225,255,.55)';ctx.lineWidth=1;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#d9f7ff';ctx.fillText(text,x,y);
  }

  function activeTarget(state){
    if(state&&state.focus&&state.focus.state==='active')return state.focus;
    if(A&&typeof A.resolveTarget==='function')return A.resolveTarget(state);
    return null;
  }

  function targetPreviewCell(state,target){
    if(!target)return null;
    const aim=state&&state.aim;
    if(aim&&aim.shipId===target.id&&Number.isFinite(aim.lx)&&Number.isFinite(aim.ly)){
      const g=G.localToGrid(target,aim.lx,aim.ly);
      const aimed=target.cellMap&&target.cellMap[g.gx+','+g.gy];
      if(aimed&&aimed.alive&&!aimed.detachedGone)return aimed;
    }
    for(const cell of target.cells||[])if(cell.alive&&!cell.detachedGone&&cell.type==='hull')return cell;
    for(const cell of target.cells||[])if(cell.alive&&!cell.detachedGone)return cell;
    return {type:'hull',gx:0,gy:0};
  }

  function gradeColor(grade){
    if(grade==='ricochet')return '#d7e0e7';
    if(grade==='heavy')return '#ff9f57';
    if(grade==='penetrated')return '#ffe17a';
    if(grade==='resisted')return '#bfeaff';
    return '#d7e0e7';
  }

  function previewProjectile(state,target,cell,attack){
    const player=state&&state.player;
    let tx=target&&target.x||0,ty=target&&target.y||0;
    if(cell&&typeof G.cellCenterWorld==='function'){
      try{const p=G.cellCenterWorld(target,cell);tx=p.x;ty=p.y;}catch(e){}
    }
    const px=player&&Number.isFinite(player.x)?player.x:tx-1,py=player&&Number.isFinite(player.y)?player.y:ty;
    let vx=tx-px,vy=ty-py;
    const d=Math.hypot(vx,vy)||1;vx=vx/d*900;vy=vy/d*900;
    return{vx,vy,damage:attack,attackPower:attack,__v99Ricocheted:false};
  }

  function targetArmorPreview(state,target,cell,attack){
    if(Material&&typeof Material.resolveDirect==='function'){
      if(typeof Material.prepareCell==='function')Material.prepareCell(target,cell);
      const result=Material.resolveDirect(target,cell,previewProjectile(state,target,cell,attack));
      return{
        grade:result.grade,
        label:typeof Material.gradeLabel==='function'?Material.gradeLabel(result.grade):result.grade,
        current:Number.isFinite(cell.armorHp)?cell.armorHp:result.armorNow,
        max:Number.isFinite(cell.armorMax)?cell.armorMax:result.armorMax,
        impactAngle:result.impactAngle||0,
        effectiveArmor:result.effectiveArmor||0
      };
    }
    if(Armor&&typeof Armor.resolveDirectHit==='function'){
      const result=Armor.resolveDirectHit(target,cell,attack);
      return{grade:result.grade,label:typeof Armor.gradeLabel==='function'?Armor.gradeLabel(result.grade):result.grade,current:result.armor,max:result.armor,impactAngle:0,effectiveArmor:result.armor};
    }
    return null;
  }

  function drawStatus(state){
    if(typeof document==='undefined'||!state)return;
    const canvas=document.getElementById('cv');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.save();worldTransform(ctx,canvas);

    const attack=A&&typeof A.getAttack==='function'?A.getAttack(state):Math.round(state.playerShellAttack||72);
    const auto=A&&typeof A.isAuto==='function'?A.isAuto(state):!!state.playerAttackAuto;
    const radiusScale=E&&typeof E.blastRadiusScale==='function'?E.blastRadiusScale({side:'player',attackPower:attack,damage:attack}):1;
    const pf=Math.round(Math.max(0,Math.min(1,state.player&&state.player.floodLevel||0))*100);
    const leaks=(state.player&&state.player.__v97LeakCount)||0;
    ctx.font='700 17px "Microsoft YaHei",sans-serif';ctx.textBaseline='middle';

    ctx.textAlign='left';ctx.fillStyle='#ffd65a';
    ctx.fillText(`炮攻 ${attack} ${auto?'AUTO':'手动'} · 爆幅 ${radiusScale.toFixed(1)}×`,250,96);

    const target=activeTarget(state);
    if(target){
      const cell=targetPreviewCell(state,target);
      const preview=cell&&targetArmorPreview(state,target,cell,attack);
      if(preview){
        ctx.fillStyle=gradeColor(preview.grade);
        ctx.font='700 15px "Microsoft YaHei",sans-serif';
        ctx.fillText(`局部装甲 ${Math.round(preview.current)}/${Math.round(preview.max)} · 入射角 ${Math.round(preview.impactAngle)}° · 等效装甲 ${Math.round(preview.effectiveArmor)} · 预计 ${preview.label}`,250,120);
      }
    }

    ctx.textAlign='right';ctx.font='700 17px "Microsoft YaHei",sans-serif';ctx.fillStyle=pf>=70?'#ffd08a':pf>=35?'#bfeaff':'#dff7ff';
    ctx.fillText(`进水 ${pf}%${leaks?` · 外海破口 ${leaks}`:''}`,650,96);

    for(const ship of state.enemies||[]){
      if(!ship||ship.state!=='active')continue;
      const flood=Math.max(0,Math.min(1,ship.floodLevel||0));if(flood<.015)continue;
      const pose=R.shipVisualPose(ship,state),p=V.hullProfile(ship);
      const y=pose.y+(p.orientation==='horizontal'?p.halfBeam+27:p.halfLength+27);
      badge(ctx,`进水 ${Math.round(flood*100)}%`,pose.x,y);
    }
    ctx.restore();
  }

  R.draw=function(state){originalDraw(state);drawStatus(state);};
  root.V97StatusOverlay={drawStatus,targetPreviewCell,activeTarget,targetArmorPreview,previewProjectile};
})(typeof globalThis!=='undefined'?globalThis:this);
