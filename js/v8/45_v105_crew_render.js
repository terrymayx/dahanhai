(function(root){
  'use strict';

  const R=root.V8Render,C=root.V8Config;
  if(!R||typeof R.draw!=='function')return;
  root.DHH=root.DHH||{};if(R.__v105CrewRenderInstalled)return;
  const oldDraw=R.draw,MAX_VISIBLE_CREW=45;

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function getCanvas(){return root.document&&root.document.getElementById?root.document.getElementById('cv'):null;}
  function viewport(canvas){const iw=root.innerWidth||C&&C.W||1280,ih=root.innerHeight||C&&C.H||720,dpr=canvas&&canvas.width?canvas.width/Math.max(1,iw):1,W=C&&C.W||1920,H=C&&C.H||1080,scale=Math.min(iw/W,ih/H),ox=(iw-W*scale)/2,oy=(ih-H*scale)/2;return{iw,ih,dpr,W,H,scale,ox,oy};}
  function worldScreen(v,x,y){return{x:v.ox+x*v.scale,y:v.oy+y*v.scale};}
  function focusPoint(state){const c=state&&state.boarding&&state.boarding.captain;return c&&c.hp>0?{x:c.x,y:c.y}:{x:state.player.x,y:state.player.y};}
  function cameraPoint(v,state,x,y){
    const blend=clamp(Number(state&&state.__v104CameraBlend)||0,0,1);if(!(blend>.01))return worldScreen(v,x,y);
    const f=worldScreen(v,focusPoint(state).x,focusPoint(state).y),p=worldScreen(v,x,y),z=1+blend*.34;return{x:v.iw*.5+(p.x-f.x)*z,y:v.ih*.5+(p.y-f.y)*z,z};
  }
  function crewColor(c){
    if(c.ownerShipId==='player'){
      if(c.role==='captain')return'#f2c14e';if(c.role==='gunner')return'#315f91';if(c.role==='helmsman')return'#4fa9ae';return'#4f86c6';
    }
    if(c.combatClass==='eliteCaptain')return'#7f1d2d';if(c.combatClass==='archer')return'#a45d2a';if(c.combatClass==='swordsman')return'#a6342b';if(c.role==='gunner')return'#74423b';return'#8b5144';
  }
  function roleMark(c){if(c.role==='captain')return'▲';if(c.role==='gunner')return'●';if(c.role==='helmsman')return'◆';if(c.combatClass==='archer')return'⌁';if(c.combatClass==='eliteCaptain')return'★';return'';}
  function visibleCrew(state){
    const all=[];for(const ship of [state.player,...(state.enemies||[])].filter(Boolean))for(const crew of ship.crew||[]){if(crew.alive||Number(crew.deadT)<3.4)all.push(crew);}
    all.sort((a,b)=>(a.y||0)-(b.y||0));return all.slice(0,MAX_VISIBLE_CREW);
  }
  function drawCrew(ctx,v,state,crew){
    if(!crew)return;const deathFade=crew.alive?1:clamp(1-(Number(crew.deadT)||0)/3.4,0,1);if(deathFade<=0)return;
    const p=cameraPoint(v,state,crew.x,crew.y),captain=crew.role==='captain',elite=crew.combatClass==='eliteCaptain',archer=crew.combatClass==='archer',r=captain||elite?8.5:6.6;
    ctx.save();ctx.globalAlpha=deathFade;ctx.translate(p.x,p.y);
    if(crew.state==='boardingJump'){const q=clamp((Number(crew.jumpT)||0)/(Number(crew.jumpDur)||.34),0,1);ctx.translate(0,-Math.sin(q*Math.PI)*8);}
    if(!crew.alive){ctx.rotate(-1.12);ctx.scale(1,.72);}
    ctx.fillStyle=crewColor(crew);ctx.strokeStyle='#17212a';ctx.lineWidth=1.8;
    ctx.beginPath();ctx.arc(0,-r*.58,r*.46,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillRect(-r*.48,-r*.08,r*.96,r*1.18);ctx.strokeRect(-r*.48,-r*.08,r*.96,r*1.18);
    const mark=roleMark(crew);if(mark){ctx.fillStyle='#fff7dc';ctx.font='700 '+Math.max(7,r*.92)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(mark,0,r*.35);}
    const fx=Number(crew.faceX)||1,fy=Number(crew.faceY)||0;
    if(archer){ctx.strokeStyle='#ead7a5';ctx.beginPath();ctx.arc(fx*r*.7,fy*r*.7,r*.75,-1.1,1.1);ctx.stroke();}
    else if(crew.combatClass==='swordsman'||elite||captain||crew.state==='v105Fight'){ctx.strokeStyle='#ece5d3';ctx.lineWidth=captain||elite?2.6:1.8;ctx.beginPath();ctx.moveTo(fx*r*.25,fy*r*.25);ctx.lineTo(fx*r*1.5,fy*r*1.5);ctx.stroke();}
    if(crew.hitT>0&&crew.alive){ctx.globalAlpha=clamp(crew.hitT/.12,0,1);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.2,0,Math.PI*2);ctx.stroke();}
    if(crew.state==='heavyWindup'){ctx.globalAlpha=.85;ctx.strokeStyle='#ffd166';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*1.7,0,Math.PI*2);ctx.stroke();}
    if(crew.blockT>0){ctx.strokeStyle='#d8edf2';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(fx*r*1.2-fy*7,fy*r*1.2+fx*7);ctx.lineTo(fx*r*1.2+fy*7,fy*r*1.2-fx*7);ctx.stroke();}
    ctx.restore();
  }
  function drawCombatFx(ctx,v,state){
    for(const fx of state.fx||[]){if(!fx||!String(fx.k||'').startsWith('v105'))continue;const p=cameraPoint(v,state,fx.x,fx.y),age=clamp((Number(fx.t)||0)/(Number(fx.dur)||.2),0,1);ctx.save();ctx.globalAlpha=1-age;
      if(fx.k==='v105Arrow'){const q=cameraPoint(v,state,fx.tx,fx.ty);ctx.strokeStyle='#ead7a5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+(q.x-p.x)*age,p.y+(q.y-p.y)*age);ctx.lineTo(p.x+(q.x-p.x)*age-(q.x-p.x)*.08,p.y+(q.y-p.y)*age-(q.y-p.y)*.08);ctx.stroke();}
      else{ctx.strokeStyle=fx.k==='v105Block'?'#d8edf2':fx.k==='v105HeavyWindup'?'#ffd166':'#fff0c2';ctx.lineWidth=fx.k.includes('Heavy')?4:2.5;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(8,(Number(fx.r)||20)*(.65+age*.55)),-.9,1.15);ctx.stroke();}
      ctx.restore();
    }
  }
  function counts(ship){const list=ship&&ship.crew||[],alive=list.filter(c=>c.alive&&c.hp>0);return{all:alive.length,total:list.length,captain:alive.filter(c=>c.role==='captain').length,gunner:alive.filter(c=>c.role==='gunner').length,sailor:alive.filter(c=>c.role==='sailor'&&!c.combatClass).length,helmsman:alive.filter(c=>c.role==='helmsman').length};}
  function drawHud(ctx,v,state){
    const c=counts(state.player),Posts=root.V105CrewPosts||(root.DHH&&root.DHH.V105CrewPosts),summary=Posts&&typeof Posts.staffingSummary==='function'?Posts.staffingSummary(state.player):null;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='rgba(9,22,31,.72)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(18,18,360,68,13);else ctx.rect(18,18,360,68);ctx.fill();ctx.fillStyle='#f7edd7';ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='700 15px "Microsoft YaHei",sans-serif';ctx.fillText('船员 '+c.all+'/'+c.total+' · 炮手 '+c.gunner+'/4 · 水手 '+c.sailor+'/5 · 舵手 '+c.helmsman+'/1',34,41);
    let warning='';if(summary){const missing=summary.gunGroups.filter(g=>g.multiplier<1);if(missing.length)warning=missing.map(g=>g.id+' '+(g.multiplier>0?'补员':'缺员')).join(' · ');}
    ctx.font='13px "Microsoft YaHei",sans-serif';ctx.fillStyle=warning?'#ffcf7a':'#a9d5df';ctx.fillText(warning||'甲板船员在岗',34,67);ctx.restore();
    if(state.boarding&&state.boarding.active){const b=state.boarding,remaining=(b.boarders||[]).filter(x=>x&&x.alive&&x.hp>0).length+(b.__v105BoardingQueue||[]).filter(x=>x&&x.alive).length;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='rgba(12,23,31,.82)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(v.iw*.5-190,18,380,80,16);else ctx.rect(v.iw*.5-190,18,380,80);ctx.fill();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 23px "Microsoft YaHei",sans-serif';ctx.fillStyle='#ffe08a';ctx.fillText('甲板守卫战',v.iw*.5,40);ctx.font='700 16px "Microsoft YaHei",sans-serif';ctx.fillStyle='#fff';ctx.fillText('船长 HP '+Math.ceil(b.captain?b.captain.hp:0)+'   敌人剩余 '+remaining+'   我方船员 '+c.all,v.iw*.5,72);ctx.restore();}
  }

  R.draw=function(state){oldDraw(state);const canvas=getCanvas();if(!canvas||!state||!state.player)return;const v=viewport(canvas),ctx=canvas.getContext('2d');ctx.setTransform(v.dpr,0,0,v.dpr,0,0);for(const crew of visibleCrew(state))drawCrew(ctx,v,state,crew);drawCombatFx(ctx,v,state);drawHud(ctx,v,state);};

  R.__v105CrewRenderInstalled=true;
  const api={installed:true,MAX_VISIBLE_CREW,visibleCrew,drawCrew,drawHud,counts,deathFade:true,captain:true,gunner:true,sailor:true,helmsman:true,swordsman:true,archer:true,eliteCaptain:true,labels:['船员','炮手','水手','舵手']};
  root.V105CrewRender=api;root.DHH.V105CrewRender=api;
})(typeof globalThis!=='undefined'?globalThis:this);
