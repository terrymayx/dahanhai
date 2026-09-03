(function(root){
  'use strict';
  const R=root.V8Render,C=root.V8Config;
  if(!R||typeof R.draw!=='function')return;
  root.DHH=root.DHH||{};
  if(R.__v104BoardingRenderInstalled)return;

  const oldDraw=R.draw;
  let buffer=null,bctx=null;

  function clamp(v,a,b){return v<a?a:v>b?b:v;}
  function active(state){return !!(state&&state.boarding&&state.boarding.active);}
  function getCanvas(){return root.document&&root.document.getElementById?root.document.getElementById('cv'):null;}
  function viewport(canvas){
    const iw=root.innerWidth||C&&C.W||1280,ih=root.innerHeight||C&&C.H||720,dpr=canvas&&canvas.width?canvas.width/Math.max(1,iw):1;
    const W=C&&C.W||1920,H=C&&C.H||1080,scale=Math.min(iw/W,ih/H),ox=(iw-W*scale)/2,oy=(ih-H*scale)/2;
    return{iw,ih,dpr,W,H,scale,ox,oy};
  }
  function worldScreen(v,x,y){return{x:v.ox+x*v.scale,y:v.oy+y*v.scale};}
  function focusPoint(state){
    const c=state&&state.boarding&&state.boarding.captain;
    return c&&c.hp>0?{x:c.x,y:c.y}:{x:state.player.x,y:state.player.y};
  }
  function cameraPoint(v,state,blend,x,y){
    const f=worldScreen(v,focusPoint(state).x,focusPoint(state).y),p=worldScreen(v,x,y),z=1+blend*.34;
    return{x:v.iw*.5+(p.x-f.x)*z,y:v.ih*.5+(p.y-f.y)*z,z};
  }

  function ensureBuffer(canvas){
    if(!root.document||!canvas)return null;
    if(!buffer){buffer=root.document.createElement('canvas');bctx=buffer.getContext('2d');}
    if(buffer.width!==canvas.width||buffer.height!==canvas.height){buffer.width=canvas.width;buffer.height=canvas.height;}
    return buffer;
  }
  function applyCamera(canvas,state,blend){
    if(!(blend>.01)||!ensureBuffer(canvas))return;
    const ctx=canvas.getContext('2d'),v=viewport(canvas),f=worldScreen(v,focusPoint(state).x,focusPoint(state).y),z=1+blend*.34;
    bctx.setTransform(1,0,0,1,0,0);bctx.clearRect(0,0,buffer.width,buffer.height);bctx.drawImage(canvas,0,0);
    const cx=f.x*v.dpr,cy=f.y*v.dpr,sw=canvas.width/z,sh=canvas.height/z;
    const sx=clamp(cx-sw*.5,0,Math.max(0,canvas.width-sw)),sy=clamp(cy-sh*.5,0,Math.max(0,canvas.height-sh));
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(buffer,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  }

  function drawUnit(ctx,v,state,blend,u){
    if(!u||u.hp<=0||u.state==='dead'||u.state==='overboard')return;
    const p=cameraPoint(v,state,blend,u.x,u.y),r=u.role==='captain'?9:7;
    ctx.save();ctx.translate(p.x,p.y);
    if(u.state==='boardingJump')ctx.translate(0,-Math.sin(clamp((u.jumpT||0)/(u.jumpDur||.34),0,1)*Math.PI)*7);
    ctx.fillStyle=u.team==='enemy'?'#9b3028':u.role==='captain'?'#f2c14e':'#3d7fc4';ctx.strokeStyle='#18222b';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,-r*.55,r*.48,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillRect(-r*.5,-r*.1,r,r*1.25);ctx.strokeRect(-r*.5,-r*.1,r,r*1.25);
    const fx=Number(u.faceX)||1,fy=Number(u.faceY)||0;ctx.strokeStyle='#ece5d3';ctx.lineWidth=u.role==='captain'?3:2;ctx.beginPath();ctx.moveTo(fx*r*.2,fy*r*.2);ctx.lineTo(fx*r*1.55,fy*r*1.55);ctx.stroke();
    if(u.hitT>0){ctx.globalAlpha=clamp(u.hitT/.1,0,1);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*1.25,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function drawBoardingLines(ctx,v,state,blend){
    const b=state.boarding,e=(state.enemies||[]).find(x=>x&&x.id===b.enemyShipId),contact=b.contact;
    if(!e)return;
    const a=contact&&contact.player?contact.player:{x:state.player.x,y:state.player.y},z=contact&&contact.enemy?contact.enemy:{x:e.x,y:e.y};
    const p=cameraPoint(v,state,blend,a.x,a.y),q=cameraPoint(v,state,blend,z.x,z.y);
    ctx.save();ctx.strokeStyle='rgba(78,52,29,.9)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    ctx.strokeStyle='rgba(226,190,124,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-7);ctx.lineTo(q.x,q.y-7);ctx.moveTo(p.x,p.y+7);ctx.lineTo(q.x,q.y+7);ctx.stroke();ctx.restore();
  }
  function drawHud(ctx,v,state){
    const b=state.boarding,c=b.captain,enemyRemaining=(b.boarders||[]).filter(u=>u&&u.hp>0&&!['dead','overboard'].includes(u.state)).length+(b.pendingSpawns||0),allies=(b.allies||[]).filter(u=>u&&u.hp>0&&u.state!=='dead').length;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='rgba(12,23,31,.78)';ctx.beginPath();ctx.roundRect(v.iw*.5-190,18,380,80,16);ctx.fill();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 23px "Microsoft YaHei",sans-serif';ctx.fillStyle='#ffe08a';ctx.fillText('甲板守卫战',v.iw*.5,40);
    ctx.font='700 16px "Microsoft YaHei",sans-serif';ctx.fillStyle='#fff';ctx.fillText('船长 HP '+Math.ceil(c?c.hp:0)+' / '+(c?c.maxHp:140)+'   敌人剩余 '+enemyRemaining+' / '+(b.enemyTotal||0)+'   水手 '+allies,v.iw*.5,72);
    ctx.restore();
  }
  function drawMobileHints(ctx,v,state){
    if(!active(state))return;ctx.save();ctx.globalAlpha=.42;ctx.strokeStyle='#fff';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(92,v.ih-88,54,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(v.iw-86,v.ih-88,50,0,Math.PI*2);ctx.stroke();
    ctx.font='700 16px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('移动',92,v.ih-82);ctx.fillText('攻击',v.iw-86,v.ih-82);ctx.restore();
  }

  R.draw=function(state){
    oldDraw(state);
    const canvas=getCanvas();if(!canvas||!state)return;
    const target=active(state)?1:0,prev=Number(state.__v104CameraBlend)||0;
    state.__v104CameraBlend=prev+(target-prev)*(target?.16:.09);
    const blend=clamp(state.__v104CameraBlend,0,1);
    if(blend>.01)applyCamera(canvas,state,blend);
    if(!active(state))return;
    const v=viewport(canvas),ctx=canvas.getContext('2d');ctx.setTransform(v.dpr,0,0,v.dpr,0,0);
    drawBoardingLines(ctx,v,state,blend);
    const b=state.boarding;
    for(const u of b.allies||[])drawUnit(ctx,v,state,blend,u);
    for(const u of b.boarders||[])drawUnit(ctx,v,state,blend,u);
    drawUnit(ctx,v,state,blend,b.captain);
    drawHud(ctx,v,state);drawMobileHints(ctx,v,state);
  };

  R.__v104BoardingRenderInstalled=true;
  root.DHH.V104BoardingRender={installed:true,drawUnit,enemyRemaining:function(state){const b=state&&state.boarding;return b?(b.boarders||[]).filter(u=>u&&u.hp>0).length+(b.pendingSpawns||0):0;},boardingJump:true,captain:true};
})(typeof globalThis!=='undefined'?globalThis:this);
