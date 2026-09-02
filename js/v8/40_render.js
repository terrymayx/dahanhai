(function(root){
  'use strict';
  const C=root.V8Config,U=root.V8Util,Grid=root.V8ShipGrid;
  if(!C||!U||!Grid)throw new Error('V8 core must load before renderer');

  let canvas=null,ctx=null,scale=1,ox=0,oy=0,dpr=1,seaGrad=null;
  const COMPONENT_LABELS={beam:'主梁',core:'主梁',powder:'火药舱',rudder:'舵机',mast:'桅杆',cannon:'炮位'};
  const SHIP_MOTION={
    sloop:{bobAmp:3.5,bobFreq:2.05,rollAmp:.017,rollFreq:1.42,wake:.78},
    gunship:{bobAmp:2.8,bobFreq:1.65,rollAmp:.014,rollFreq:1.20,wake:1},
    manowar:{bobAmp:2.2,bobFreq:1.20,rollAmp:.010,rollFreq:.92,wake:1.28},
    player:{bobAmp:2.1,bobFreq:1.12,rollAmp:.010,rollFreq:.88,wake:1.35}
  };

  function init(cv){
    canvas=cv;ctx=cv.getContext('2d');resize();
    if(typeof addEventListener==='function')addEventListener('resize',resize);
  }

  function resize(){
    if(!canvas)return;
    const iw=(typeof innerWidth==='number'?innerWidth:C.W),ih=(typeof innerHeight==='number'?innerHeight:C.H);
    dpr=Math.min((typeof devicePixelRatio==='number'?devicePixelRatio:1)||1,2);
    canvas.width=Math.max(1,Math.floor(iw*dpr));canvas.height=Math.max(1,Math.floor(ih*dpr));
    canvas.style.width=iw+'px';canvas.style.height=ih+'px';
    scale=Math.min(iw/C.W,ih/C.H);ox=(iw-C.W*scale)/2;oy=(ih-C.H*scale)/2;seaGrad=null;
  }

  function screenToWorld(clientX,clientY){return{x:(clientX-ox)/scale,y:(clientY-oy)/scale};}

  function beginWorld(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
    ctx.translate(ox,oy);ctx.scale(scale,scale);
  }

  function drawSea(state){
    if(!seaGrad){seaGrad=ctx.createLinearGradient(0,0,C.W*.3,C.H);seaGrad.addColorStop(0,'#58c8ee');seaGrad.addColorStop(1,'#287fc2');}
    ctx.fillStyle=seaGrad;ctx.fillRect(0,0,C.W,C.H);
    ctx.globalAlpha=.18;ctx.fillStyle='#b7efff';
    for(let i=0;i<17;i++){
      const x=(i*197+state.time*22)%2100-90,y=(120+i*113)%980;
      ctx.beginPath();ctx.ellipse(x,y,70+(i%3)*22,16+(i%2)*6,0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function tint(hex,factor){
    const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    return `rgb(${Math.max(0,Math.min(255,Math.round(r*factor)))},${Math.max(0,Math.min(255,Math.round(g*factor)))},${Math.max(0,Math.min(255,Math.round(b*factor)))})`;
  }

  function cellColor(ship,cell){
    if(cell.type==='beam'||cell.type==='core')return '#9b7934';
    if(cell.type==='powder')return '#8b302d';
    if(cell.type==='rudder')return '#b56f3e';
    if(cell.type==='mast')return '#5d3924';
    if(cell.type==='cannon')return '#3d454d';
    if(cell.type==='deck')return ship.deckColor;
    return ship.baseColor;
  }

  function debrisCellColor(cluster,cell){
    if(cell.type==='beam'||cell.type==='core')return '#9b7934';
    if(cell.type==='powder')return '#8b302d';
    if(cell.type==='rudder')return '#b56f3e';
    if(cell.type==='mast')return '#5d3924';
    if(cell.type==='cannon')return '#3d454d';
    if(cell.type==='deck')return cluster.deckColor||'#b07155';
    return cluster.baseColor||'#714128';
  }

  function drawCell(ship,cell){
    if(!cell.alive)return;
    const p=Grid.cellCenterLocal(ship,cell),s=ship.cellSize;
    let base=cellColor(ship,cell),ratio=cell.hp/cell.maxHp;
    if(ratio<=.5)base=tint(base,.64);
    ctx.fillStyle=base;
    ctx.fillRect(p.x-s/2+.8,p.y-s/2+.8,s-1.6,s-1.6);
    ctx.strokeStyle='rgba(52,35,25,.48)';ctx.lineWidth=1.3;
    ctx.strokeRect(p.x-s/2+.8,p.y-s/2+.8,s-1.6,s-1.6);
    if(ratio<1){
      ctx.strokeStyle=ratio<=.5?'rgba(34,20,14,.9)':'rgba(82,49,27,.65)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(p.x-s*.28,p.y-s*.24);ctx.lineTo(p.x+s*.04,p.y);ctx.lineTo(p.x-s*.08,p.y+s*.28);ctx.stroke();
    }
    if(cell.flash>0){ctx.globalAlpha=Math.min(1,cell.flash*7);ctx.fillStyle='#fff3bd';ctx.fillRect(p.x-s/2+1,p.y-s/2+1,s-2,s-2);ctx.globalAlpha=1;}
  }

  function shipBounds(ship){
    const w=ship.gridWidth*ship.cellSize,h=ship.gridHeight*ship.cellSize;
    return{w,h,r:Math.hypot(w,h)/2};
  }

  function shipVisualPose(ship,state){
    state=state||{time:0};
    const ph=ship.physics||{},cfg=SHIP_MOTION[ship.kind]||SHIP_MOTION.gunship;
    const active=ship.state==='active',phase=ph.bobPhase||0;
    const bobY=active?Math.sin((state.time||0)*cfg.bobFreq+phase)*cfg.bobAmp:0;
    const bobRoll=active?Math.sin((state.time||0)*cfg.rollFreq+phase*.7)*cfg.rollAmp:0;
    const sink=ship.state==='sink',sinkP=sink?Math.min(1,ship.sinkT/1.6):0;
    return{
      x:ship.x+(ph.offsetX||0),
      y:ship.y+(ph.offsetY||0)+bobY+sinkP*48,
      rotation:ship.rotation+(ph.roll||0)+bobRoll+(sink?sinkP*.45:0),
      alpha:sink?Math.max(0,1-sinkP*.85):1,
      sinkP
    };
  }

  function drawWake(ship,state){
    const cfg=SHIP_MOTION[ship.kind]||SHIP_MOTION.gunship,ph=ship.physics||{};
    const cx=ship.x+(ph.offsetX||0)*.35,cy=ship.y+(ph.offsetY||0)*.25;
    const speedRatio=ship.side==='player'?1:Math.max(.24,Math.min(1.12,(ship.speed||0)/(ship.baseSpeed||ship.speed||1)));
    const wakeScale=cfg.wake*(.55+speedRatio*.45),alpha=.12+.13*speedRatio;
    if(ship.side==='player'){
      const width=92*wakeScale,length=Math.min(C.H-cy,250+95*wakeScale);
      ctx.fillStyle=`rgba(255,255,255,${alpha})`;ctx.beginPath();
      ctx.moveTo(cx-width*.72,cy+240);ctx.lineTo(cx-width,C.H);ctx.lineTo(cx+width,C.H);ctx.lineTo(cx+width*.72,cy+240);ctx.closePath();ctx.fill();
      ctx.globalAlpha=.36;ctx.strokeStyle='#eafaff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-width*.62,cy+230);ctx.lineTo(cx-width*.82,cy+Math.max(245,length));ctx.moveTo(cx+width*.62,cy+230);ctx.lineTo(cx+width*.82,cy+Math.max(245,length));ctx.stroke();ctx.globalAlpha=1;
    }else if(ship.state==='active'){
      const b=shipBounds(ship),half=20+18*wakeScale,len=105+72*wakeScale;
      ctx.fillStyle=`rgba(255,255,255,${alpha})`;
      ctx.beginPath();ctx.moveTo(cx+b.w*.45,cy-half*.62);ctx.lineTo(cx+b.w*.45+len,cy-half*1.42);ctx.lineTo(cx+b.w*.45+len,cy-half*.22);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(cx+b.w*.45,cy+half*.62);ctx.lineTo(cx+b.w*.45+len,cy+half*1.42);ctx.lineTo(cx+b.w*.45+len,cy+half*.22);ctx.closePath();ctx.fill();
    }
  }

  function drawShip(ship,state){
    if(!ship)return;
    drawWake(ship,state);
    const pose=shipVisualPose(ship,state);
    ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.rotation);ctx.globalAlpha=pose.alpha;
    for(const cell of ship.cells){if(!cell.alive)continue;drawCell(ship,cell);}
    ctx.restore();ctx.globalAlpha=1;
    if(ship.focus&&ship.state==='active'){
      const b=shipBounds(ship);ctx.save();ctx.strokeStyle='#ffd43b';ctx.lineWidth=4;ctx.setLineDash([12,9]);ctx.beginPath();ctx.ellipse(pose.x,pose.y,b.w*.60,b.h*.82,pose.rotation,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
      text('锁定目标',pose.x,pose.y-b.h*.92-34,20,'#ffe37a','#532b18',4);
    }
    if(ship.side==='enemy'&&ship.state==='active'){
      const pct=Math.round(Grid.integrity(ship)*100);text(`结构 ${pct}%`,pose.x,pose.y-ship.gridHeight*ship.cellSize*.72-18,21,'#fff','#173047',4);
    }
  }

  function drawDebrisClusters(state){
    for(const cluster of state.debrisClusters||[]){
      const sp=Math.max(0,Math.min(1,cluster.sinkProgress||0));
      const floatBob=cluster.phase==='float'?Math.sin((cluster.age||0)*4.2+(cluster.bobPhase||0))*3:0;
      const drawY=cluster.y+floatBob+sp*7;
      if(cluster.phase==='float'||cluster.phase==='sink'){
        ctx.save();ctx.globalAlpha=Math.max(.08,.32-sp*.20);ctx.strokeStyle='#d8f7ff';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.ellipse(cluster.x,drawY+8,25+(cluster.cells||[]).length*.9,7+(cluster.cells||[]).length*.15,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
      ctx.save();ctx.translate(cluster.x,drawY);ctx.rotate(cluster.rotation||0);ctx.globalAlpha=Math.max(0,1-sp*.86);
      const s=cluster.cellSize||16;
      for(const cell of cluster.cells||[]){
        ctx.fillStyle=debrisCellColor(cluster,cell);
        ctx.fillRect(cell.x-s/2+.8,cell.y-s/2+.8,s-1.6,s-1.6);
        ctx.strokeStyle='rgba(45,27,18,.65)';ctx.lineWidth=1.2;
        ctx.strokeRect(cell.x-s/2+.8,cell.y-s/2+.8,s-1.6,s-1.6);
      }
      ctx.restore();ctx.globalAlpha=1;
    }
  }

  function text(s,x,y,size,fill,stroke,lw,align){
    ctx.font=`700 ${size}px "Microsoft YaHei","PingFang SC",sans-serif`;ctx.textAlign=align||'center';ctx.textBaseline='middle';
    if(stroke){ctx.lineWidth=lw||3;ctx.strokeStyle=stroke;ctx.strokeText(s,x,y);}ctx.fillStyle=fill;ctx.fillText(s,x,y);
  }

  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

  function drawProjectileTrail(p){
    for(const t of p.trail||[]){
      const life=Math.max(0,1-(t.t||0)/(t.dur||.28));
      ctx.save();ctx.globalAlpha=.24*life;ctx.fillStyle='#e7e2d4';ctx.beginPath();
      ctx.arc(t.x,t.y-(t.z||0),2.2+(1-life)*4.2,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }

  function drawProjectiles(state){
    for(const p of state.projectiles){
      drawProjectileTrail(p);
      const z=p.z||0,drawY=p.y-z,falling=(p.vz||0)<0;
      const projectileShadow=Math.max(.08,.28-Math.min(.2,z/900));
      ctx.save();ctx.globalAlpha=projectileShadow;ctx.fillStyle='#102b39';ctx.beginPath();
      ctx.ellipse(p.x,p.y+3,7+Math.min(10,z*.035),3.2+Math.min(4,z*.012),0,0,Math.PI*2);ctx.fill();ctx.restore();

      const trailFactor=falling?.012:.027;
      ctx.strokeStyle=falling?'rgba(255,239,177,.72)':'rgba(255,244,197,.50)';ctx.lineWidth=falling?2.4:3.2;ctx.beginPath();
      ctx.moveTo(p.x-p.vx*trailFactor,p.y-p.vy*trailFactor-(p.prevZ||0));ctx.lineTo(p.x,drawY);ctx.stroke();
      const size=(p.radius||5)*(1+Math.min(.28,z/650))*(falling?1.10:1);
      ctx.fillStyle=p.side==='player'?'#242a31':'#6b2424';ctx.beginPath();ctx.arc(p.x,drawY,size,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=falling?'rgba(255,244,190,.62)':'rgba(255,255,255,.30)';ctx.lineWidth=falling?1.8:1.2;ctx.beginPath();ctx.arc(p.x-1.5,drawY-1.5,size*.55,Math.PI*1.05,Math.PI*1.72);ctx.stroke();
    }
  }

  function aimComponent(ship,a){
    if(!ship||!a)return null;
    let best=null,bestD=Infinity;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const c=ship.cellMap[(a.gx+dx)+','+(a.gy+dy)];
      if(!c||!c.alive||!COMPONENT_LABELS[c.type])continue;
      const d=dx*dx+dy*dy;
      if(d<bestD){bestD=d;best=c;}
    }
    return best;
  }

  function drawAim(state){
    if(!state.aim)return;
    const ship=(state.enemies||[]).find(e=>e.id===state.aim.shipId&&e.state==='active');
    if(!ship)return;
    const a=state.aim,local={x:a.lx,y:a.ly},pose=shipVisualPose(ship,state);
    let p;
    if(Number.isFinite(local.x)&&Number.isFinite(local.y)){
      const c=Math.cos(pose.rotation),s=Math.sin(pose.rotation);
      p={x:pose.x+local.x*c-local.y*s,y:pose.y+local.x*s+local.y*c};
    }else p={x:a.x,y:a.y};
    const pulse=1+Math.sin((state.time||0)*8)*.08;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);
    ctx.strokeStyle='#ffd43b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#ff6b35';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-34,0);ctx.lineTo(-10,0);ctx.moveTo(34,0);ctx.lineTo(10,0);ctx.moveTo(0,-34);ctx.lineTo(0,-10);ctx.moveTo(0,34);ctx.lineTo(0,10);ctx.stroke();
    ctx.restore();
    const component=aimComponent(ship,a);
    if(component)text(COMPONENT_LABELS[component.type],p.x,p.y-52,20,'#ffe37a','#532b18',4);
  }

  function drawFx(state){
    for(const f of state.fx){
      const p=Math.min(1,f.t/f.dur);
      if(f.k==='splinter'){
        ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.t*8);ctx.globalAlpha=1-p;ctx.fillStyle='#7b4b28';ctx.fillRect(-f.r,-f.r*.45,f.r*2,f.r*.9);ctx.restore();
      }else if(f.k==='debris'){
        ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot||0);ctx.globalAlpha=Math.max(0,1-p);ctx.fillStyle=f.cellType==='deck'?'#b07155':'#714128';ctx.fillRect(-f.r/2,-f.r/2,f.r,f.r);ctx.strokeStyle='rgba(45,27,18,.7)';ctx.lineWidth=1.5;ctx.strokeRect(-f.r/2,-f.r/2,f.r,f.r);ctx.restore();
      }else if(f.k==='waterSplash'){
        const r=f.r||22;ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=Math.max(0,1-p);
        ctx.fillStyle='rgba(231,250,255,.82)';ctx.beginPath();ctx.ellipse(0,3,r*(.55+p*.55),r*(.16+p*.13),0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(245,253,255,.88)';ctx.beginPath();ctx.moveTo(-r*.22,2);ctx.quadraticCurveTo(-r*.10,-r*(.55+p*.85),0,-r*(.72+p*.65));ctx.quadraticCurveTo(r*.13,-r*(.48+p*.50),r*.24,2);ctx.closePath();ctx.fill();ctx.restore();
      }else if(f.k==='waterRing'){
        const r=(f.r||24)*(.55+p*1.65);ctx.save();ctx.globalAlpha=(1-p)*.62;ctx.strokeStyle='#dff9ff';ctx.lineWidth=3*(1-p)+.8;ctx.beginPath();ctx.ellipse(f.x,f.y,r,r*.30,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='foam'){
        ctx.save();ctx.globalAlpha=(1-p)*.56;ctx.fillStyle='#eefcff';ctx.beginPath();ctx.ellipse(f.x,f.y,(f.r||5)*(1+p*.8),(f.r||5)*(.45+p*.18),0,0,Math.PI*2);ctx.fill();ctx.restore();
      }else if(f.k==='hit'){
        ctx.globalAlpha=1-p;ctx.fillStyle='#ffd85a';ctx.beginPath();ctx.arc(f.x,f.y,5+p*18,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      }else if(f.k==='impactBurst'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1-p;ctx.strokeStyle='#ffd45f';ctx.lineWidth=5*(1-p)+1;ctx.beginPath();ctx.arc(0,0,(f.r||34)*(.35+p),0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='structureBreak'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=Math.max(0,1-p);ctx.fillStyle='rgba(255,142,45,.35)';ctx.beginPath();ctx.arc(0,0,(f.r||60)*(.24+p*.78),0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffe08a';ctx.lineWidth=8*(1-p)+2;ctx.beginPath();ctx.arc(0,0,(f.r||60)*(.18+p),0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='powderBlast'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=Math.max(0,1-p);
        ctx.fillStyle='rgba(70,45,38,.25)';ctx.beginPath();ctx.arc(0,-12,(f.r||96)*(.35+p*.94),0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,91,31,.72)';ctx.beginPath();ctx.arc(0,0,(f.r||96)*(.20+p*.78),0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ffd65a';ctx.beginPath();ctx.arc(0,0,(f.r||96)*(.12+p*.38),0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#fff0a6';ctx.lineWidth=10*(1-p)+2;ctx.beginPath();ctx.arc(0,0,(f.r||96)*(.25+p*.88),0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='boom'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1-p;ctx.fillStyle='#ff8d2d';ctx.beginPath();ctx.arc(0,0,35+p*80,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd95a';ctx.beginPath();ctx.arc(0,0,20+p*45,0,Math.PI*2);ctx.fill();ctx.restore();ctx.globalAlpha=1;
      }else if(f.k==='muzzle'){
        ctx.globalAlpha=1-p;ctx.fillStyle='#fff1a8';ctx.beginPath();ctx.arc(f.x,f.y,8+p*20,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      }
    }
    ctx.globalAlpha=1;
    for(const t of state.texts)text(t.text,t.x,t.y,20,'#ffe65c','#52331d',3);
  }

  function drawHud(state){
    ctx.fillStyle='rgba(5,30,48,.72)';roundRect(26,24,650,112,18);ctx.fill();
    text('V8.4 · 物理质感重构',50,55,27,'#fff',null,0,'left');
    text(`我方结构 ${Math.round(Grid.integrity(state.player)*100)}%`,50,96,23,'#dff7ff',null,0,'left');
    text(`击沉 ${state.kills}   金币 ${state.gold}`,650,96,22,'#ffd65a','#173047',3,'right');
    text('重炮有惯性 · 舰体会横摇 · 大块残骸先漂浮再进水下沉',C.W/2,42,23,'#ffffff','#17435a',4);
    text('远射弧线更高 · 落弹水花与烟迹 · 重击/爆炸按等级反馈',C.W/2,C.H-38,21,'#e9f8ff','#17435a',4);

    ctx.fillStyle='rgba(5,30,48,.68)';roundRect(C.W-118,25,88,60,14);ctx.fill();text(state.paused?'▶':'Ⅱ',C.W-74,55,28,'#fff');
    if(state.state==='lose'){
      ctx.fillStyle='rgba(4,17,28,.72)';ctx.fillRect(0,0,C.W,C.H);text('旗舰结构崩溃',C.W/2,C.H/2-65,58,'#ffdf86','#442014',6);
      ctx.fillStyle='#f4b942';roundRect(C.W/2-160,C.H/2+20,320,82,18);ctx.fill();text('重新开始',C.W/2,C.H/2+61,30,'#2b2417');
    }
  }

  function draw(state){
    if(!ctx||!state)return;
    beginWorld();drawSea(state);
    const shake=state.shake||0,sx=shake?U.rand(-shake,shake):0,sy=shake?U.rand(-shake,shake):0;
    ctx.save();ctx.translate(sx,sy);
    drawShip(state.player,state);for(const e of state.enemies)drawShip(e,state);
    drawDebrisClusters(state);drawProjectiles(state);drawFx(state);drawAim(state);
    ctx.restore();
    drawHud(state);
  }

  root.V8Render={init,resize,draw,drawShip,drawDebrisClusters,drawAim,screenToWorld,shipBounds,shipVisualPose};
})(typeof globalThis!=='undefined'?globalThis:this);
