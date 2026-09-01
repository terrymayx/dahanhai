/* ================= 场景绘制 ================= */
let seaGrad=null;
function drawSea(){
  if(!seaGrad){ seaGrad=ctx.createLinearGradient(0,0,W*.25,H);
    seaGrad.addColorStop(0,'#54c3ea'); seaGrad.addColorStop(1,'#2a8bcb'); }
  ctx.fillStyle=seaGrad; ctx.fillRect(0,0,W,H);
  const blobs=[[300,180,240,80,.2],[1500,150,220,70,.18],[900,330,260,90,.16],[500,950,240,80,.16],[1700,460,220,80,.15]];
  for(const b of blobs){ ctx.fillStyle='rgba(143,220,247,'+b[4]+')';
    ctx.beginPath(); ctx.ellipse(b[0],b[1],b[2],b[3],0,0,Math.PI*2); ctx.fill(); }
  const sw=[[140,120,1.2,0,.5],[330,80,.8,1.7,.4],[640,140,1.1,0,.45],[900,70,.9,3.5,.4],[1090,150,1.15,0,.45],
    [1330,90,.8,2.8,.4],[120,540,1.1,1.4,.45],[90,880,1.25,0,.5],[700,470,1,3.1,.4],[770,890,1.2,0,.5],
    [1010,690,.9,2.1,.4],[930,1010,1.1,0,.45],[1240,880,1.2,.5,.45],[1680,780,1,0,.45],[1860,620,.9,1.6,.4],[520,700,.85,3.8,.4]];
  ctx.strokeStyle='#ffffff'; ctx.lineCap='round';
  for(let i=0;i<sw.length;i++){ const s=sw[i];
    const y=((s[1]+g.scroll*0.55)%(H+160))-80;
    ctx.save(); ctx.translate(s[0],y); ctx.rotate(s[3]); ctx.scale(s[2],s[2]);
    ctx.globalAlpha=s[4]; ctx.lineWidth=6; ctx.stroke(SWIRL); ctx.restore(); }
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(255,255,255,.25)';
  const dots=[[240,300],[420,140],[760,240],[1020,420],[1440,330],[1800,260],[180,700],[620,600],[860,820],[1180,960],[1560,920],[1880,880]];
  for(let i=0;i<dots.length;i++){ const d=dots[i];
    const y=((d[1]+g.scroll*0.55)%(H+120))-60; circle(d[0],y,3); ctx.fill(); }
}
function drawWake(){
  ctx.fillStyle='rgba(255,255,255,.26)';
  ctx.beginPath(); ctx.moveTo(380,870); ctx.bezierCurveTo(350,940,330,1010,320,1080);
  ctx.lineTo(540,1080); ctx.bezierCurveTo(530,1010,510,940,480,870); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.32)';
  ctx.beginPath(); ctx.moveTo(400,872); ctx.bezierCurveTo(382,940,372,1005,368,1080);
  ctx.lineTo(498,1080); ctx.bezierCurveTo(492,1005,482,940,462,872); ctx.closePath(); ctx.fill();
  for(const f of g.foam){ ctx.fillStyle='rgba(255,255,255,'+(0.8*f.life/f.max)+')'; circle(f.x,f.y,f.r); ctx.fill(); }
}
function drawPlayerShip(){
  drawWake();
  // 船体
  ctx.fillStyle='#8a5a2b'; ctx.strokeStyle='#5f3a17'; ctx.lineWidth=7; ctx.fill(P_HULL); ctx.stroke(P_HULL);
  ctx.fillStyle='#d9a05f'; ctx.strokeStyle='#b5793a'; ctx.lineWidth=5; ctx.fill(P_DECK); ctx.stroke(P_DECK);
  ctx.save(); ctx.clip(P_DECK); ctx.strokeStyle='#c08b4d'; ctx.lineWidth=4; ctx.globalAlpha=.9;
  ctx.beginPath();
  for(const x of [322,358,394,430,466,502,538]){ ctx.moveTo(x,270); ctx.lineTo(x,850); }
  ctx.moveTo(300,380); ctx.lineTo(560,380); ctx.moveTo(300,740); ctx.lineTo(560,740); ctx.stroke();
  ctx.restore();
  // 艉楼舵轮
  rr(330,776,200,68,18); ctx.fillStyle='#c8924f'; ctx.fill(); ctx.strokeStyle='#a06a32'; ctx.lineWidth=4; ctx.stroke();
  ctx.save(); ctx.translate(430,810);
  circle(0,0,24); ctx.fillStyle='#7a4a21'; ctx.fill(); ctx.strokeStyle='#5f3a17'; ctx.lineWidth=4; ctx.stroke();
  ctx.lineWidth=4; ctx.beginPath();
  for(const a of [0,Math.PI/2,Math.PI/4,3*Math.PI/4]){ ctx.moveTo(-Math.cos(a)*24,-Math.sin(a)*24); ctx.lineTo(Math.cos(a)*24,Math.sin(a)*24); }
  ctx.stroke(); circle(0,0,7); ctx.fillStyle='#5f3a17'; ctx.fill(); ctx.restore();
  // 桅杆卷帆
  rr(416,318,28,112,13); ctx.fillStyle='#ecd9a9'; ctx.fill(); ctx.strokeStyle='#b99c62'; ctx.lineWidth=3; ctx.stroke();
  ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=3; ctx.beginPath();
  for(const y of [348,378,408]){ ctx.moveTo(416,y); ctx.lineTo(444,y); } ctx.stroke();
  circle(430,306,14); ctx.fillStyle='#8a5a2b'; ctx.fill(); ctx.strokeStyle='#5f3a17'; ctx.lineWidth=4; ctx.stroke();
  circle(392,330,13); ctx.strokeStyle='#b98c4f'; ctx.lineWidth=6; ctx.stroke();
  // 舱盖木桶
  rr(396,478,68,54,6); ctx.fillStyle='#b5793a'; ctx.fill(); ctx.strokeStyle='#8a5a2b'; ctx.lineWidth=4; ctx.stroke();
  ctx.strokeStyle='#8a5a2b'; ctx.lineWidth=3; ctx.beginPath();
  ctx.moveTo(419,478); ctx.lineTo(419,532); ctx.moveTo(442,478); ctx.lineTo(442,532);
  ctx.moveTo(396,505); ctx.lineTo(464,505); ctx.stroke();
  for(const p of [[350,468],[358,506]]){ circle(p[0],p[1],13); ctx.fillStyle='#a86a33'; ctx.fill();
    ctx.strokeStyle='#7a4a21'; ctx.lineWidth=3; ctx.stroke(); circle(p[0],p[1],5); ctx.fillStyle='#7a4a21'; ctx.fill(); }
  // 炮位
  ctx.fillStyle='#4a3020';
  ctx.fillRect(580,418,20,28); ctx.fillRect(588,546,22,28); ctx.fillRect(580,676,20,28);
  drawCannon(498,430,1); drawCannon(498,560,1); drawCannon(498,690,1);
  // 船头旗与破浪
  const fw=Math.sin(g.time*3)*4;
  ctx.fillStyle='#e05548'; ctx.strokeStyle='#a83a30'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(430,242); ctx.lineTo(398+fw,262); ctx.lineTo(430,272); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(418,248); ctx.lineTo(400,218); ctx.moveTo(442,248); ctx.lineTo(460,218); ctx.stroke();
  // 船员
  for(const c of g.crew) drawCrew(c);
}
function drawEnemyShip(e){
  const s=e.s;
  // 航迹（转向靠帮后淡出）
  const wakeA=Math.max(0,1-e.rot/(Math.PI/2));
  if(wakeA>0){
    ctx.globalAlpha=wakeA;
    ctx.fillStyle='rgba(255,255,255,.26)';
    ctx.beginPath(); ctx.moveTo(e.x+232*s,e.y-92*s); ctx.lineTo(e.x+470*s,e.y-150*s); ctx.lineTo(e.x+470*s,e.y-20*s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(e.x+232*s,e.y+92*s); ctx.lineTo(e.x+470*s,e.y+150*s); ctx.lineTo(e.x+470*s,e.y+20*s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
  }
  ctx.save();
  const sink=e.state==='sink';
  ctx.translate(e.x, e.y+(sink?e.sinkT*36:0));
  ctx.rotate(Math.sin(g.time*1.7+e.ph)*.025+(sink?e.sinkT*.5:0)+e.rot);
  ctx.scale(s,s);
  if(sink) ctx.globalAlpha=Math.max(0,1-e.sinkT/1.2);
  ctx.fillStyle=e.t.hull; ctx.strokeStyle='#23262e'; ctx.lineWidth=6; ctx.fill(E_HULL); ctx.stroke(E_HULL);
  ctx.fillStyle=e.t.deck; ctx.strokeStyle='rgba(0,0,0,.33)'; ctx.lineWidth=3; ctx.fill(E_DECK); ctx.stroke(E_DECK);
  ctx.save(); ctx.clip(E_DECK); ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.lineWidth=4; ctx.beginPath();
  for(const y of [-52,0,52]){ ctx.moveTo(-215,y); ctx.lineTo(205,y); } ctx.stroke(); ctx.restore();
  if(e.type==='manowar'){ // 鲨鱼齿
    ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath();
    ctx.moveTo(-185,-44); ctx.lineTo(-214,-30); ctx.lineTo(-185,-18); ctx.closePath();
    ctx.moveTo(-192,-8); ctx.lineTo(-222,2); ctx.lineTo(-192,12); ctx.closePath();
    ctx.moveTo(-185,32); ctx.lineTo(-212,46); ctx.lineTo(-185,56); ctx.closePath(); ctx.fill(); }
  // 卷帆+骷髅
  rr(-95,-16,190,32,15); ctx.fillStyle='#26262c'; ctx.fill(); ctx.strokeStyle='#101014'; ctx.lineWidth=3; ctx.stroke();
  ctx.beginPath(); for(const x of [-55,0,55]){ ctx.moveTo(x,-16); ctx.lineTo(x,16);} ctx.stroke();
  drawSkull(-45,0,1.05);
  circle(0,0,11); ctx.fillStyle='#5a4326'; ctx.fill(); ctx.strokeStyle='#3a2a16'; ctx.lineWidth=3; ctx.stroke();
  // 旗
  circle(212,0,6); ctx.fillStyle='#2a2a2a'; ctx.fill();
  ctx.fillStyle='#16161c'; ctx.strokeStyle='#000'; ctx.lineWidth=2;
  const fw=Math.sin(g.time*3+e.ph)*5;
  ctx.beginPath(); ctx.moveTo(216,-16); ctx.bezierCurveTo(244,-28,270,-24+fw,288,-10);
  ctx.lineTo(288,24); ctx.bezierCurveTo(264,12,240,10,216,22); ctx.closePath(); ctx.fill(); ctx.stroke();
  drawSkull(252,4,.85);
  // 舷炮（靠帮后收起）
  if(e.t.shoot&&e.rot<0.6){ drawCannon(-95,-62,.9,true);
    if(e.flash>0){ ctx.save(); ctx.translate(-95-178*.9,-62); ctx.scale(.8,.8);
      ctx.fillStyle='#ff9a2e'; ctx.fill(SPARK); ctx.fillStyle='#ffd23e'; ctx.scale(.5,.5); ctx.fill(SPARK); ctx.restore(); } }
  // 船上剩余海盗
  const slots=[[-40,-70],[30,72],[-90,40],[40,-20]];
  const rem=e.t.pir-e.deployed;
  for(let i=0;i<rem&&i<4;i++){ const p=slots[i];
    figureBody(p[0],p[1],'#f2f2f2','#3a3f4a');
    figureHead(p[0],p[1],'band',i%2?'#3a3f4a':'#d93636'); }
  ctx.restore();
  // 血条
  if(!sink){
    const rf=e.rot/(Math.PI/2);
    const topOff=(152+(235-152)*rf)*s;
    const w=Math.max(110,200*s), bx=e.x-w/2, by=e.y-topOff-46;
    hpBar(bx,by,w,22,e.hp/e.max);
  }
}
function drawDockedGear(e){
  const x2=e.x-152*e.s+8;
  const ys=e.slot==='both'?[SLOTS.upper.plankY,SLOTS.lower.plankY]:[e.slot==='upper'?SLOTS.upper.plankY:SLOTS.lower.plankY];
  for(const py of ys){
    const sway=Math.sin(g.time*2+py)*2;ctx.save();ctx.translate((600+x2)/2,py+sway*.3);ctx.rotate(py===SLOTS.upper.plankY?-.05:.06);
    const len=x2-600+18;rr(-len/2,-13,len,26,6);ctx.fillStyle='#b5793a';ctx.fill();ctx.strokeStyle='#7a4a21';ctx.lineWidth=4;ctx.stroke();
    ctx.strokeStyle='#8a5a2b';ctx.lineWidth=3;ctx.beginPath();for(const sx of [-len/2+24,-len/2+48,0,len/2-48,len/2-24]){ctx.moveTo(sx,-13);ctx.lineTo(sx,13);}ctx.stroke();
    ctx.strokeStyle='#e8d5a8';ctx.lineWidth=3;circle(-len/2+7,0,7);ctx.stroke();circle(len/2-7,0,7);ctx.stroke();ctx.restore();
    const slot=py===SLOTS.upper.plankY?SLOTS.upper:SLOTS.lower,originY=e.y+(py===SLOTS.upper.plankY?-145:145)*e.s;
    ctx.strokeStyle='#b98c4f';ctx.lineWidth=5;const sway2=Math.sin(g.time*2+py)*4;ctx.beginPath();ctx.moveTo(e.x-40*e.s,originY);ctx.quadraticCurveTo(690,slot.hookY+sway2,618,slot.hookY);ctx.stroke();
    ctx.strokeStyle='#6a6a72';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(618,slot.hookY);ctx.quadraticCurveTo(604,slot.hookY+4,604,slot.hookY+14);ctx.stroke();
  }
}
function drawBoardingRoutes(){
  for(const b of g.boarders){
    if(b.state==='swing'){
      ctx.strokeStyle='#b98c4f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(b.anchor.x,b.anchor.y);ctx.lineTo(b.x,b.y-8);ctx.stroke();
      ctx.fillStyle='rgba(0,45,65,.18)';ctx.beginPath();ctx.ellipse(b.to.x,b.to.y+32,24,8,0,0,Math.PI*2);ctx.fill();
    }else if(b.state==='climb'){
      ctx.strokeStyle='#b98c4f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(618,b.y-70);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
  }
}
function drawFocus(){
  const e=g.focus;if(!e||e.state==='sink'||e.gone)return;ctx.save();ctx.strokeStyle='#ffd23e';ctx.lineWidth=4;ctx.setLineDash([10,10]);ctx.beginPath();ctx.ellipse(e.x,e.y,Math.max(90,225*e.s),Math.max(65,155*e.s),e.rot,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);txt('集火',e.x,e.y-185*e.s,22,'#ffd23e','#5f3a17',4);ctx.restore();
}

function drawFxAll(dt){
  for(const f of g.fx){
    f.t+=dt; const p=clamp(f.t/f.dur,0,1);
    if(f.k==='boom'){
      ctx.globalAlpha=1-p;
      ctx.save(); ctx.translate(f.x,f.y); ctx.scale(f.s*(0.7+p*.8),f.s*(0.7+p*.8));
      ctx.fillStyle='#ff9a2e'; ctx.fill(SPARK); ctx.rotate(.6); ctx.scale(1.3,1.3);
      ctx.fillStyle='#ffd23e'; ctx.fill(SPARK); ctx.rotate(.6);
      ctx.fillStyle='#ffffff'; ctx.scale(.45,.45); ctx.fill(SPARK); ctx.restore();
      if(p>.3){ ctx.strokeStyle='rgba(255,255,255,'+(0.5*(1-p))+')'; ctx.lineWidth=4;
        circle(f.x,f.y,70*f.s*p); ctx.stroke(); }
    }else if(f.k==='flash'){
      ctx.globalAlpha=1-p;
      ctx.save(); ctx.translate(f.x,f.y); ctx.scale(f.s*(1-p*.4),f.s*(1-p*.4));
      ctx.fillStyle='#ff9a2e'; ctx.fill(SPARK); ctx.rotate(.5); ctx.scale(.55,.55);
      ctx.fillStyle='#ffd23e'; ctx.fill(SPARK); ctx.rotate(.5); ctx.scale(.5,.5);
      ctx.fillStyle='#ffffff'; ctx.fill(SPARK); ctx.restore();
    }else if(f.k==='splash'){
      ctx.globalAlpha=(1-p)*.85; ctx.strokeStyle='#ffffff'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.ellipse(f.x,f.y,44*f.s*p,16*f.s*p,0,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#ffffff';
      for(let i=0;i<5;i++){ const a=i/5*Math.PI*2;
        circle(f.x+Math.cos(a)*40*f.s*p,f.y+Math.sin(a)*14*f.s*p-18*p*f.s,4*(1-p)); ctx.fill(); }
    }else if(f.k==='spark'){
      ctx.globalAlpha=1-p;
      ctx.save(); ctx.translate(f.x,f.y-f.s*4); ctx.scale(f.s*(1.1+p),f.s*(1.1+p));
      ctx.fillStyle='#ffd23e'; ctx.fill(SPARK); ctx.rotate(.78); ctx.scale(.55,.55);
      ctx.fillStyle='#ffffff'; ctx.fill(SPARK); ctx.restore();
    }else if(f.k==='slash'){
      ctx.globalAlpha=1-p; ctx.strokeStyle='#ffffff'; ctx.lineWidth=5; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(f.x,f.y,24+26*p,f.a-1+p*1.4,f.a+1+p*1.4); ctx.stroke();
    }else if(f.k==='ring'){
      ctx.globalAlpha=1-p; ctx.strokeStyle='#ffcc33'; ctx.lineWidth=4;
      circle(f.x,f.y-4,16+40*p); ctx.stroke();
    }else if(f.k==='line'){
      ctx.globalAlpha=1-p; ctx.strokeStyle='#e8e0c8'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x2,f.y2); ctx.stroke();
    }else if(f.k==='stick'){
      const fall=Math.min(1,p*2.4);
      ctx.globalAlpha=1;
      ctx.fillStyle='rgba(0,30,50,.2)'; ctx.beginPath(); ctx.ellipse(f.x,f.y,10*fall,4*fall,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=3; ctx.lineCap='round';
      const ay=f.y-160*(1-fall);
      ctx.beginPath(); ctx.moveTo(f.x-14,ay-8); ctx.lineTo(f.x,f.y-2); ctx.stroke();
      if(fall>=1){ ctx.fillStyle='#5a4a3a'; ctx.beginPath();
        ctx.moveTo(f.x+3,f.y); ctx.lineTo(f.x-4,f.y-8); ctx.lineTo(f.x+6,f.y-6); ctx.closePath(); ctx.fill(); }
    }else if(f.k==='bomb'){
      const ix=clamp(p*2,0,1);
      const bxp=f.x+(f.x2-f.x)*ix, byp=f.y+(f.y2-f.y)*ix-Math.sin(ix*Math.PI)*90;
      ctx.globalAlpha=1; circle(bxp,byp,9); ctx.fillStyle='#2b2f35'; ctx.fill();
      ctx.save(); ctx.translate(bxp+8,byp-12); ctx.scale(.8,.8); ctx.fillStyle='#ffd23e'; ctx.fill(SPARK); ctx.restore();
      if(p>=.5&&!f.hit){ f.hit=true; sparkFx(f.x2,f.y2,1.2); }
    }
    ctx.globalAlpha=1;
  }
  g.fx=g.fx.filter(f=>f.t<f.dur);
  for(const s of g.smoke){ s.life-=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.r+=6*dt;
    ctx.globalAlpha=Math.max(0,.75*s.life/s.max);
    ctx.fillStyle='#ffffff'; circle(s.x,s.y,s.r); ctx.fill(); }
  ctx.globalAlpha=1;
  g.smoke=g.smoke.filter(s=>s.life>0);
}
