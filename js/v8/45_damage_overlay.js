(function(root){
  'use strict';
  const C=root.V8Config,G=root.V8ShipGrid,R=root.V8Render;
  if(!C||!G||!R)throw new Error('V8.5.1 damage overlay requires config, grid and renderer');

  const originalDraw=R.draw;

  function shipsOf(state){return state?[state.player,...(state.enemies||[])].filter(Boolean):[];}

  function worldTransform(ctx,canvas){
    const iw=canvas.clientWidth||root.innerWidth||C.W,ih=canvas.clientHeight||root.innerHeight||C.H;
    const dpr=Math.min(root.devicePixelRatio||1,2),scale=Math.min(iw/C.W,ih/C.H);
    const ox=(iw-C.W*scale)/2,oy=(ih-C.H*scale)/2;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(ox,oy);ctx.scale(scale,scale);
  }

  function drawCrack(ctx,x,y,s,stage,seed){
    const k=(seed%5)*.7;
    ctx.strokeStyle=stage==='critical'?'rgba(28,17,13,.96)':'rgba(74,42,26,.78)';
    ctx.lineWidth=stage==='critical'?2.15:1.35;
    ctx.beginPath();
    ctx.moveTo(x-s*.31,y-s*(.22-k*.02));
    ctx.lineTo(x-s*.03,y-s*.02);
    ctx.lineTo(x+s*.20,y+s*.23);
    ctx.moveTo(x-s*.03,y-s*.02);
    ctx.lineTo(x+s*.27,y-s*.20);
    if(stage==='critical'){
      ctx.moveTo(x+s*.02,y+s*.04);ctx.lineTo(x-s*.24,y+s*.29);
    }
    ctx.stroke();
    if(stage==='critical'){
      ctx.fillStyle='rgba(31,22,19,.48)';ctx.beginPath();
      ctx.moveTo(x+s*.48,y-s*.48);ctx.lineTo(x+s*.15,y-s*.48);ctx.lineTo(x+s*.48,y-s*.15);ctx.closePath();ctx.fill();
    }
  }

  function drawShipDamage(ctx,ship,state){
    if(!ship||ship.state==='gone')return;
    const pose=R.shipVisualPose(ship,state),s=ship.cellSize;
    ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.rotation);ctx.globalAlpha=pose.alpha;
    for(const cell of ship.cells||[]){
      if(!cell.alive)continue;
      const stage=G.damageStage?G.damageStage(cell):'intact';
      if(stage==='intact'||stage==='destroyed')continue;
      const p=G.cellCenterLocal(ship,cell);
      if(stage==='critical'){
        ctx.fillStyle='rgba(18,14,12,.14)';ctx.fillRect(p.x-s*.45,p.y-s*.45,s*.9,s*.9);
      }
      drawCrack(ctx,p.x,p.y,s,stage,cell.gx*17+cell.gy*31);
    }
    ctx.restore();ctx.globalAlpha=1;
  }

  function drawHudOverlay(ctx,state){
    ctx.fillStyle='rgba(5,30,48,.90)';ctx.fillRect(26,24,650,112);
    ctx.font='700 27px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#fff';
    ctx.fillText('V8.5.1 · 船体损伤与破甲',50,55);
    ctx.font='700 21px "Microsoft YaHei",sans-serif';ctx.fillStyle='#dff7ff';
    ctx.fillText(`我方结构 ${Math.round(G.integrity(state.player)*100)}%`,50,96);
    ctx.textAlign='right';ctx.fillStyle='#ffd65a';ctx.fillText(`击沉 ${state.kills}   金币 ${state.gold}`,650,96);

    ctx.fillStyle='rgba(7,37,53,.78)';ctx.fillRect(700,18,1000,52);
    ctx.font='700 21px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f3fbff';
    ctx.fillText('先打裂外壳 → 破甲穿透 → 主梁断裂 → 结构崩解',1200,44);
    ctx.fillStyle='rgba(7,37,53,.76)';ctx.fillRect(360,C.H-68,1200,42);
    ctx.font='700 19px "Microsoft YaHei",sans-serif';ctx.fillStyle='#e9f8ff';
    ctx.fillText('方块有独立耐久 · 完整装甲先吸收炮击 · 破甲后才能继续穿透 · 无镜头/船体受击抖动',960,C.H-47);
  }

  function drawDamageOverlay(state){
    if(typeof document==='undefined'||!state)return;
    const canvas=document.getElementById('cv');if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.save();worldTransform(ctx,canvas);
    for(const ship of shipsOf(state))drawShipDamage(ctx,ship,state);
    drawHudOverlay(ctx,state);
    ctx.restore();
  }

  R.draw=function(state){
    originalDraw(state);
    drawDamageOverlay(state);
  };

  R.drawDamageOverlay=drawDamageOverlay;
})(typeof globalThis!=='undefined'?globalThis:this);
