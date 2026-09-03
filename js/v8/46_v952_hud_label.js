(function(root){
  'use strict';
  const C=root.V8Config,R=root.V8Render;
  if(!C||!R||typeof R.draw!=='function')return;
  const originalDraw=R.draw;
  R.draw=function(state){
    originalDraw(state);
    if(typeof document==='undefined')return;
    const canvas=document.getElementById('cv');if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const iw=canvas.clientWidth||root.innerWidth||C.W,ih=canvas.clientHeight||root.innerHeight||C.H;
    const dpr=Math.min(root.devicePixelRatio||1,2),scale=Math.min(iw/C.W,ih/C.H),ox=(iw-C.W*scale)/2,oy=(ih-C.H*scale)/2;
    ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(ox,oy);ctx.scale(scale,scale);
    ctx.fillStyle='rgba(5,30,48,.94)';ctx.fillRect(42,37,900,38);
    ctx.font='700 27px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#fff';
    ctx.fillText('V10.4 · 甲板守卫战',50,55);
    ctx.restore();
  };
})(typeof globalThis!=='undefined'?globalThis:this);
