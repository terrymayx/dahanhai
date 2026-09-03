(function(root){
  'use strict';
  const C=root.V8Config,R=root.V8Render,V=root.V9VectorShip,A=root.V972PlayerAttack||null;
  if(!C||!R||!V||typeof R.draw!=='function')return;
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

  function drawStatus(state){
    if(typeof document==='undefined'||!state)return;
    const canvas=document.getElementById('cv');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.save();worldTransform(ctx,canvas);

    const attack=A&&typeof A.getAttack==='function'?A.getAttack(state):Math.round(state.playerShellAttack||24);
    const pf=Math.round(Math.max(0,Math.min(1,state.player&&state.player.floodLevel||0))*100);
    const leaks=(state.player&&state.player.__v97LeakCount)||0;
    ctx.font='700 17px "Microsoft YaHei",sans-serif';ctx.textBaseline='middle';

    ctx.textAlign='left';ctx.fillStyle='#ffd65a';
    ctx.fillText(`炮攻 ${attack}`,250,96);

    ctx.textAlign='right';ctx.fillStyle=pf>=70?'#ffd08a':pf>=35?'#bfeaff':'#dff7ff';
    ctx.fillText(`进水 ${pf}%${leaks?` · 漏点 ${leaks}`:''}`,650,96);

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
  root.V97StatusOverlay={drawStatus};
})(typeof globalThis!=='undefined'?globalThis:this);
