(function(root){
  'use strict';
  const R=root.V8Render,C=root.V8Config;
  if(!R||!C||typeof R.draw!=='function'||typeof document==='undefined')return;
  if(R.__v103MuzzleSmokeInstalled)return;

  const oldDraw=R.draw;

  function canvasForRender(){return document.getElementById('cv')||document.querySelector('canvas');}
  function setupWorld(ctx,cv){
    const iw=cv.clientWidth||((typeof innerWidth==='number'&&innerWidth)||C.W),ih=cv.clientHeight||((typeof innerHeight==='number'&&innerHeight)||C.H);
    const dpr=Math.max(1,cv.width/Math.max(1,iw)),scale=Math.min(iw/C.W,ih/C.H),ox=(iw-C.W*scale)/2,oy=(ih-C.H*scale)/2;
    ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*ox,dpr*oy);
  }
  function drawPuff(ctx,x,y,rx,ry,alpha,rotation){
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='rgba(235,242,238,.92)';ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation||0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawSmoke(state){
    const cv=canvasForRender();if(!cv||!state)return;
    const ctx=cv.getContext('2d');if(!ctx)return;
    ctx.save();setupWorld(ctx,cv);
    for(const f of state.fx||[]){
      if(f.k==='muzzleSmoke'){
        const p=Math.max(0,Math.min(1,(Number(f.t)||0)/(Number(f.dur)||.58))),fade=(1-p)*(1-p),nx=Number(f.nx)||0,ny=Number(f.ny)||0,base=Number(f.r)||18;
        const drift=9+p*28,cx=(Number(f.x)||0)+nx*drift,cy=(Number(f.y)||0)+ny*drift;
        drawPuff(ctx,cx,cy,base*(.55+p*.85),base*(.30+p*.48),.34*fade,Math.atan2(ny,nx));
        drawPuff(ctx,cx-nx*8-ny*5,cy-ny*8+nx*5,base*(.38+p*.60),base*(.25+p*.35),.26*fade,0);
        drawPuff(ctx,cx-nx*14+ny*4,cy-ny*14-nx*4,base*(.30+p*.45),base*(.20+p*.28),.20*fade,0);
      }
    }
    ctx.restore();
  }

  R.draw=function(state){oldDraw(state);drawSmoke(state);};
  R.__v103MuzzleSmokeInstalled=true;
  root.V103MuzzleSmoke={drawSmoke};
})(typeof globalThis!=='undefined'?globalThis:this);
