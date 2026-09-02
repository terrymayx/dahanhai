(function(root){
  'use strict';
  const C=root.V8Config,U=root.V8Util,Grid=root.V8ShipGrid;
  if(!C||!U||!Grid)throw new Error('V8 core must load before renderer');

  let canvas=null,ctx=null,scale=1,ox=0,oy=0,dpr=1,seaGrad=null;
  const COMPONENT_LABELS={beam:'主梁',core:'主梁',powder:'火药舱',rudder:'舵机',mast:'桅杆',cannon:'炮位'};

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

  function drawWake(ship){
    if(ship.side==='player'){
      ctx.fillStyle='rgba(255,255,255,.24)';ctx.beginPath();ctx.moveTo(ship.x-90,ship.y+265);ctx.lineTo(ship.x-125,C.H);ctx.lineTo(ship.x+125,C.H);ctx.lineTo(ship.x+90,ship.y+265);ctx.closePath();ctx.fill();
    }else if(ship.state==='active'){
      const b=shipBounds(ship);ctx.fillStyle='rgba(255,255,255,.20)';ctx.beginPath();ctx.moveTo(ship.x+b.w*.45,ship.y-28);ctx.lineTo(ship.x+b.w*.45+150,ship.y-55);ctx.lineTo(ship.x+b.w*.45+150,ship.y-8);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(ship.x+b.w*.45,ship.y+28);ctx.lineTo(ship.x+b.w*.45+150,ship.y+55);ctx.lineTo(ship.x+b.w*.45+150,ship.y+8);ctx.closePath();ctx.fill();
    }
  }

  function drawShip(ship){
    if(!ship)return;
    drawWake(ship);
    const sink=ship.state==='sink',sinkP=sink?Math.min(1,ship.sinkT/1.6):0;
    ctx.save();ctx.translate(ship.x,ship.y+sinkP*48);ctx.rotate(ship.rotation+(sink?sinkP*.45:0));
    ctx.globalAlpha=sink?Math.max(0,1-sinkP*.85):1;
    for(const cell of ship.cells){if(!cell.alive)continue;drawCell(ship,cell);}
    ctx.restore();ctx.globalAlpha=1;
    if(ship.focus&&ship.state==='active'){
      const b=shipBounds(ship);ctx.save();ctx.strokeStyle='#ffd43b';ctx.lineWidth=3;ctx.setLineDash([12,9]);ctx.beginPath();ctx.ellipse(ship.x,ship.y,b.w*.58,b.h*.78,ship.rotation,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }
    if(ship.side==='enemy'&&ship.state==='active'){
      const pct=Math.round(Grid.integrity(ship)*100);text(`结构 ${pct}%`,ship.x,ship.y-ship.gridHeight*ship.cellSize*.72-18,21,'#fff','#173047',4);
    }
  }

  function drawDebrisClusters(state){
    for(const cluster of state.debrisClusters||[]){
      const sp=Math.max(0,Math.min(1,cluster.sinkProgress||0));
      if(sp>.38){
        ctx.save();ctx.globalAlpha=Math.max(0,.48-sp*.35);ctx.strokeStyle='#d8f7ff';ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(cluster.x,cluster.y+10,28+sp*54,8+sp*10,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
      ctx.save();ctx.translate(cluster.x,cluster.y);ctx.rotate(cluster.rotation||0);ctx.globalAlpha=Math.max(0,1-sp*.82);
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

  function drawProjectiles(state){
    for(const p of state.projectiles){
      ctx.fillStyle=p.side==='player'?'#242a31':'#6b2424';ctx.beginPath();ctx.arc(p.x,p.y,p.radius||5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,244,197,.65)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x,p.y);ctx.stroke();
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
    const a=state.aim;
    const p=Number.isFinite(a.lx)&&Number.isFinite(a.ly)?Grid.localToWorld(ship,a.lx,a.ly):{x:a.x,y:a.y};
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
      }else if(f.k==='hit'){
        ctx.globalAlpha=1-p;ctx.fillStyle='#ffd85a';ctx.beginPath();ctx.arc(f.x,f.y,5+p*18,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      }else if(f.k==='impactBurst'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1-p;ctx.strokeStyle='#ffd45f';ctx.lineWidth=5*(1-p)+1;ctx.beginPath();ctx.arc(0,0,(f.r||34)*(.35+p),0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='structureBreak'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=Math.max(0,1-p);ctx.fillStyle='rgba(255,142,45,.35)';ctx.beginPath();ctx.arc(0,0,(f.r||60)*(.24+p*.78),0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffe08a';ctx.lineWidth=8*(1-p)+2;ctx.beginPath();ctx.arc(0,0,(f.r||60)*(.18+p),0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='powderBlast'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=Math.max(0,1-p);
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
    text('V8.2 · 部位破坏与连锁毁伤',50,55,27,'#fff',null,0,'left');
    text(`我方结构 ${Math.round(Grid.integrity(state.player)*100)}%`,50,96,23,'#dff7ff',null,0,'left');
    text(`击沉 ${state.kills}   金币 ${state.gold}`,650,96,22,'#ffd65a','#173047',3,'right');
    text('击穿外壳 → 瞄准主梁 / 火药舱 / 舵机 / 桅杆 / 炮位',C.W/2,42,23,'#ffffff','#17435a',4);
    text('火药舱会连锁爆炸 · 打断主结构会整块脱落并沉入海里',C.W/2,C.H-38,21,'#e9f8ff','#17435a',4);

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
    drawShip(state.player);for(const e of state.enemies)drawShip(e);
    drawDebrisClusters(state);drawProjectiles(state);drawFx(state);drawAim(state);
    ctx.restore();
    drawHud(state);
  }

  root.V8Render={init,resize,draw,drawShip,drawDebrisClusters,drawAim,screenToWorld,shipBounds};
})(typeof globalThis!=='undefined'?globalThis:this);
