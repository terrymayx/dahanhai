(function(root){
  'use strict';

  const C=root.V8Config,U=root.V8Util,Grid=root.V8ShipGrid,Base=root.V8Render,Vector=root.V9VectorShip;
  if(!C||!U||!Grid||!Base||!Vector)throw new Error('V9 renderer requires V8 core renderer and V9 vector ship');

  let canvas=null,ctx=null,scale=1,ox=0,oy=0,dpr=1,seaGrad=null;
  const LABELS={hull:'船壳',deck:'甲板',beam:'主梁',core:'主梁',powder:'火药舱',rudder:'舵机',mast:'桅杆',cannon:'炮位'};

  function init(cv){canvas=cv;ctx=cv.getContext('2d');resize();if(typeof addEventListener==='function')addEventListener('resize',resize);}
  function resize(){
    if(!canvas)return;
    const iw=(typeof innerWidth==='number'?innerWidth:C.W),ih=(typeof innerHeight==='number'?innerHeight:C.H);
    dpr=Math.min((typeof devicePixelRatio==='number'?devicePixelRatio:1)||1,2);
    canvas.width=Math.max(1,Math.floor(iw*dpr));canvas.height=Math.max(1,Math.floor(ih*dpr));canvas.style.width=iw+'px';canvas.style.height=ih+'px';
    scale=Math.min(iw/C.W,ih/C.H);ox=(iw-C.W*scale)/2;oy=(ih-C.H*scale)/2;seaGrad=null;
  }
  function screenToWorld(clientX,clientY){return{x:(clientX-ox)/scale,y:(clientY-oy)/scale};}
  function shipVisualPose(ship,state){return Base.shipVisualPose(ship,state);}
  function shipBounds(ship){return Base.shipBounds(ship);}
  function beginWorld(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);ctx.translate(ox,oy);ctx.scale(scale,scale);}

  function text(s,x,y,size,fill,stroke,lw,align){ctx.font=`700 ${size}px "Microsoft YaHei","PingFang SC",sans-serif`;ctx.textAlign=align||'center';ctx.textBaseline='middle';if(stroke){ctx.lineWidth=lw||3;ctx.strokeStyle=stroke;ctx.strokeText(s,x,y);}ctx.fillStyle=fill;ctx.fillText(s,x,y);}
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

  function drawSea(state){
    if(!seaGrad){seaGrad=ctx.createLinearGradient(0,0,C.W*.28,C.H);seaGrad.addColorStop(0,'#63cbed');seaGrad.addColorStop(.58,'#389dcc');seaGrad.addColorStop(1,'#236fa7');}
    ctx.fillStyle=seaGrad;ctx.fillRect(0,0,C.W,C.H);
    ctx.save();ctx.globalAlpha=.18;ctx.strokeStyle='#d9f7ff';ctx.lineWidth=2;
    for(let i=0;i<18;i++){const x=(i*181+state.time*24)%2100-90,y=(92+i*119)%1010;ctx.beginPath();ctx.ellipse(x,y,48+(i%4)*18,8+(i%3)*2,0,0,Math.PI);ctx.stroke();}
    ctx.restore();
  }

  function drawWake(ship,state){
    if(!ship||ship.state==='gone')return;
    const pose=shipVisualPose(ship,state),p=Vector.hullProfile(ship),speedRatio=ship.side==='player'?1:Math.max(.24,Math.min(1,(ship.speed||0)/(ship.baseSpeed||ship.speed||1)));
    ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.rotation);ctx.globalAlpha=.18+.10*speedRatio;ctx.strokeStyle='#f4fdff';ctx.lineWidth=3;
    if(p.orientation==='horizontal'){
      const stern=p.halfLength*.92;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(stern,side*p.halfBeam*.56);ctx.quadraticCurveTo(stern+70,side*p.halfBeam*.82,stern+145,side*p.halfBeam*1.18);ctx.stroke();}
    }else{
      const stern=p.halfLength*.92;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*p.halfBeam*.56,stern);ctx.quadraticCurveTo(side*p.halfBeam*.82,stern+70,side*p.halfBeam*1.18,stern+150);ctx.stroke();}
    }
    ctx.restore();
  }

  function drawShip(ship,state){
    if(!ship)return;drawWake(ship,state);
    const pose=shipVisualPose(ship,state);ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.rotation);ctx.globalAlpha=pose.alpha;
    Vector.drawShipLocal(ctx,ship,state);
    ctx.restore();ctx.globalAlpha=1;
    const p=Vector.hullProfile(ship);
    if(ship.focus&&ship.state==='active'){
      ctx.save();ctx.strokeStyle='#ffd43b';ctx.lineWidth=3.5;ctx.setLineDash([12,9]);ctx.beginPath();
      if(p.orientation==='horizontal')ctx.ellipse(pose.x,pose.y,p.halfLength*1.10,p.halfBeam*1.38,pose.rotation,0,Math.PI*2);else ctx.ellipse(pose.x,pose.y,p.halfBeam*1.38,p.halfLength*1.10,pose.rotation,0,Math.PI*2);
      ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }
    if(ship.side==='enemy'&&ship.state==='active')text(`结构 ${Math.round(Grid.integrity(ship)*100)}%`,pose.x,pose.y-p.halfBeam-40,20,'#fff','#173047',4);
  }

  function drawDebrisClusters(state){
    for(const cluster of state.debrisClusters||[]){
      const sp=Math.max(0,Math.min(1,cluster.sinkProgress||0)),floatBob=cluster.phase==='float'?Math.sin((cluster.age||0)*4.1+(cluster.bobPhase||0))*3:0,drawY=cluster.y+floatBob+sp*7;
      if(cluster.phase==='float'||cluster.phase==='sink'){ctx.save();ctx.globalAlpha=Math.max(.08,.30-sp*.18);ctx.strokeStyle='#e8fbff';ctx.lineWidth=2.3;ctx.beginPath();ctx.ellipse(cluster.x,drawY+8,24+(cluster.cells||[]).length*.85,6+(cluster.cells||[]).length*.14,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      ctx.save();ctx.translate(cluster.x,drawY);ctx.rotate(cluster.rotation||0);ctx.globalAlpha=Math.max(0,1-sp*.86);Vector.drawDebrisClusterLocal(ctx,cluster);ctx.restore();
    }
    ctx.globalAlpha=1;
  }

  function drawStructuralChunks(state){
    for(const chunk of state.structuralChunks||[]){
      if(!chunk||chunk.phase==='gone')continue;
      const sp=Math.max(0,Math.min(1,chunk.sinkProgress||0));
      const bob=Math.sin((chunk.age||0)*2.3+(chunk.mass||1)*.17)*(1-sp)*2.2;
      const drawY=(chunk.y||0)+bob+sp*18;
      const cells=chunk.cells||[],extent=Math.max(28,Math.min(130,22+Math.sqrt(cells.length)*12));
      ctx.save();ctx.globalAlpha=Math.max(.06,.38-sp*.22);ctx.strokeStyle='#e8fbff';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(chunk.x,drawY+8,extent,Math.max(7,extent*.24),0,0,Math.PI*2);ctx.stroke();ctx.restore();
      ctx.save();ctx.translate(chunk.x,drawY);ctx.rotate(chunk.rotation||0);ctx.globalAlpha=Math.max(.05,1-sp*.88);
      if(typeof Vector.drawDebrisClusterLocal==='function')Vector.drawDebrisClusterLocal(ctx,chunk);
      else{
        const s=chunk.cellSize||8;
        for(const cell of cells){ctx.fillStyle=cell.type==='deck'?(chunk.deckColor||'#b07155'):(chunk.baseColor||'#714128');ctx.fillRect(cell.x-s/2,cell.y-s/2,s,s);}
      }
      ctx.restore();ctx.globalAlpha=1;
    }
  }

  function drawProjectiles(state){
    for(const p of state.projectiles||[]){
      for(const t of p.trail||[]){const life=Math.max(0,1-(t.t||0)/(t.dur||.28));ctx.save();ctx.globalAlpha=.20*life;ctx.fillStyle='#eee7d7';ctx.beginPath();ctx.arc(t.x,t.y-(t.z||0),2+(1-life)*3.5,0,Math.PI*2);ctx.fill();ctx.restore();}
      const z=p.z||0,drawY=p.y-z,falling=(p.vz||0)<0;ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#123040';ctx.beginPath();ctx.ellipse(p.x,p.y+3,7+Math.min(10,z*.035),3+Math.min(4,z*.012),0,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.strokeStyle=falling?'rgba(255,237,174,.78)':'rgba(255,247,205,.48)';ctx.lineWidth=falling?2.4:3;ctx.beginPath();ctx.moveTo(p.x-p.vx*(falling?.012:.025),p.y-p.vy*(falling?.012:.025)-(p.prevZ||0));ctx.lineTo(p.x,drawY);ctx.stroke();
      ctx.fillStyle=p.side==='player'?'#252a30':'#722b27';ctx.beginPath();ctx.arc(p.x,drawY,(p.radius||5)*(falling?1.1:1),0,Math.PI*2);ctx.fill();
    }
  }

  function drawFx(state){
    for(const f of state.fx||[]){
      const p=Math.min(1,(f.t||0)/(f.dur||1));
      if(f.k==='splinter'||f.k==='debris'){
        ctx.save();ctx.translate(f.x,f.y);ctx.rotate((f.rot||0)+f.t*3);ctx.globalAlpha=1-p;ctx.fillStyle='#81502f';ctx.beginPath();ctx.moveTo(-7,-2);ctx.lineTo(8,-4);ctx.lineTo(11,2);ctx.lineTo(-6,4);ctx.closePath();ctx.fill();ctx.restore();
      }else if(f.k==='waterSplash'){
        const r=f.r||22;ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1-p;ctx.fillStyle='rgba(239,252,255,.82)';ctx.beginPath();ctx.ellipse(0,3,r*(.55+p*.55),r*(.16+p*.13),0,0,Math.PI*2);ctx.fill();ctx.restore();
      }else if(f.k==='waterRing'){
        const r=(f.r||24)*(.55+p*1.65);ctx.save();ctx.globalAlpha=(1-p)*.62;ctx.strokeStyle='#e3fbff';ctx.lineWidth=2.6;ctx.beginPath();ctx.ellipse(f.x,f.y,r,r*.30,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='foam'){
        ctx.save();ctx.globalAlpha=(1-p)*.55;ctx.fillStyle='#f1fcff';ctx.beginPath();ctx.ellipse(f.x,f.y,(f.r||5)*(1+p*.8),(f.r||5)*(.45+p*.18),0,0,Math.PI*2);ctx.fill();ctx.restore();
      }else if(f.k==='hit'||f.k==='impactBurst'){
        ctx.save();ctx.globalAlpha=1-p;ctx.strokeStyle='#ffd75e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,7+p*(f.r||30),0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='structureBreak'||f.k==='structureRupture'||f.k==='stressRupture'){
        ctx.save();ctx.globalAlpha=1-p;ctx.strokeStyle='rgba(74,38,24,.92)';ctx.lineWidth=5*(1-p)+1;ctx.beginPath();ctx.arc(f.x,f.y,(f.r||55)*(.25+p),0,Math.PI*2);ctx.stroke();ctx.restore();
      }else if(f.k==='powderBlast'||f.k==='boom'){
        ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1-p;ctx.fillStyle='rgba(255,98,32,.72)';ctx.beginPath();ctx.arc(0,0,(f.r||70)*(.18+p*.78),0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd65a';ctx.beginPath();ctx.arc(0,0,(f.r||70)*(.10+p*.38),0,Math.PI*2);ctx.fill();ctx.restore();
      }else if(f.k==='muzzle'){
        ctx.save();ctx.globalAlpha=1-p;ctx.fillStyle='#fff0a5';ctx.beginPath();ctx.arc(f.x,f.y,8+p*18,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
    for(const t of state.texts||[])text(t.text,t.x,t.y,20,'#ffe65c','#52331d',3);
  }

  function aimCell(ship,a){if(!ship||!a)return null;return ship.cellMap[a.gx+','+a.gy]||null;}
  function drawAim(state){
    if(!state.aim)return;const ship=(state.enemies||[]).find(e=>e.id===state.aim.shipId&&e.state==='active');if(!ship)return;
    const a=state.aim,pose=shipVisualPose(ship,state),c=Math.cos(pose.rotation),s=Math.sin(pose.rotation),lx=Number.isFinite(a.lx)?a.lx:0,ly=Number.isFinite(a.ly)?a.ly:0,p={x:pose.x+lx*c-ly*s,y:pose.y+lx*s+ly*c};
    ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle='#ffd43b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ff6b35';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(-34,0);ctx.lineTo(-10,0);ctx.moveTo(34,0);ctx.lineTo(10,0);ctx.moveTo(0,-34);ctx.lineTo(0,-10);ctx.moveTo(0,34);ctx.lineTo(0,10);ctx.stroke();ctx.restore();
    const cell=aimCell(ship,a);if(cell&&cell.alive){const stage=root.V8ComponentStress&&root.V8ComponentStress.componentStage?root.V8ComponentStress.componentStage(cell):(cell.hp/cell.maxHp>.66?'healthy':cell.hp/cell.maxHp>.33?'damaged':'critical');const cn=stage==='healthy'?'完整':stage==='damaged'?'受损':'危急';text(`${LABELS[cell.type]||'船体'} ${Math.ceil(cell.hp)} / ${cell.maxHp} · ${cn}`,p.x,p.y-48,18,'#fff1a8','#4b2d1c',4);}
  }

  function drawHud(state){
    ctx.fillStyle='rgba(5,28,44,.76)';roundRect(28,24,560,96,18);ctx.fill();text('V9.0 · 矢量船体重构',50,52,27,'#fff',null,0,'left');text(`我方结构 ${Math.round(Grid.integrity(state.player)*100)}%`,50,91,21,'#dff7ff',null,0,'left');text(`击沉 ${state.kills}   金币 ${state.gold}`,560,91,20,'#ffd65a','#173047',3,'right');
    ctx.fillStyle='rgba(5,30,48,.68)';roundRect(C.W-118,25,88,60,14);ctx.fill();text(state.paused?'▶':'Ⅱ',C.W-74,55,28,'#fff');
    if(state.state==='lose'){ctx.fillStyle='rgba(4,17,28,.72)';ctx.fillRect(0,0,C.W,C.H);text('旗舰结构崩溃',C.W/2,C.H/2-65,58,'#ffdf86','#442014',6);ctx.fillStyle='#f4b942';roundRect(C.W/2-160,C.H/2+20,320,82,18);ctx.fill();text('重新开始',C.W/2,C.H/2+61,30,'#2b2417');}
  }

  function draw(state){
    if(!ctx||!state)return;beginWorld();drawSea(state);drawShip(state.player,state);for(const ship of state.enemies||[])drawShip(ship,state);drawDebrisClusters(state);drawStructuralChunks(state);drawProjectiles(state);drawFx(state);drawAim(state);drawHud(state);
  }

  root.V8Render={init,resize,draw,drawShip,drawDebrisClusters,drawStructuralChunks,drawAim,screenToWorld,shipBounds,shipVisualPose};
})(typeof globalThis!=='undefined'?globalThis:this);
