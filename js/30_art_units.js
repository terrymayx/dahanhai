/* ================= 美术：部件 ================= */
function drawCannon(x,y,s,flip){
  ctx.save(); ctx.translate(x,y); ctx.scale(flip?-s:s,s);
  rr(-8,-16,66,32,9); ctx.fillStyle='#7a4a21'; ctx.fill(); ctx.strokeStyle='#5f3a17'; ctx.lineWidth=3; ctx.stroke();
  circle(20,0,3); ctx.fillStyle='#5f3a17'; ctx.fill();
  circle(40,10,6); ctx.strokeStyle='#b98c4f'; ctx.stroke();
  rr(52,-11,112,22,11); ctx.fillStyle='#454b54'; ctx.fill(); ctx.strokeStyle='#2b2f35'; ctx.stroke();
  rr(146,-15,18,30,5); ctx.fillStyle='#343941'; ctx.fill(); ctx.strokeStyle='#2b2f35'; ctx.lineWidth=2; ctx.stroke();
  circle(4,0,14); ctx.fillStyle='#343941'; ctx.fill(); ctx.lineWidth=3; ctx.stroke();
  ctx.restore();
}
function drawSkull(x,y,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle='#f4f4f4'; circle(0,-1,8); ctx.fill(); rr(-5,4,10,6,2); ctx.fill();
  ctx.fillStyle='#26262c'; circle(-3.2,-1.5,2.2); ctx.fill(); circle(3.2,-1.5,2.2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-1.2,2.4); ctx.lineTo(0,4.6); ctx.lineTo(1.2,2.4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function woodPanel(x,y,w,h,r){
  rr(x,y,w,h,r); ctx.fillStyle='#8a5a2b'; ctx.fill(); ctx.strokeStyle='#5f3a17'; ctx.lineWidth=4; ctx.stroke();
  rr(x+8,y+8,w-16,h-16,Math.max(4,r-6)); ctx.fillStyle='#c98d4e'; ctx.fill();
}
function coinIcon(x,y,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  circle(0,0,20); ctx.fillStyle='#ffcc33'; ctx.fill(); ctx.strokeStyle='#d9a213'; ctx.lineWidth=4; ctx.stroke();
  circle(0,0,12); ctx.strokeStyle='#e8b825'; ctx.lineWidth=3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,11,-2.2,-1.2); ctx.strokeStyle='#fff3c4'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.stroke();
  ctx.restore();
}
function hpBar(x,y,w,h,pct,bg){
  rr(x-4,y-4,w+8,h+8,8); ctx.fillStyle='#3a2c1a'; ctx.fill(); ctx.strokeStyle='#241a0e'; ctx.lineWidth=3; ctx.stroke();
  rr(x,y,w,h,6); ctx.fillStyle=bg||'#5a2020'; ctx.fill();
  const ww=Math.max(0,w*clamp(pct,0,1));
  if(ww>2){ rr(x,y,ww,h,6);
    ctx.fillStyle=pct>.5?'#5ad46a':pct>.25?'#ffcc33':'#f2544d'; ctx.fill(); }
}
function figureBody(x,y,bodyFill,stripe){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle='rgba(0,40,60,.22)'; circle(0,11,15,11); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,9,15,11,0,0,Math.PI*2);
  ctx.fillStyle=bodyFill; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=2; ctx.stroke();
  if(stripe){ ctx.save(); ctx.beginPath(); ctx.ellipse(0,9,15,11,0,0,Math.PI*2); ctx.clip();
    ctx.strokeStyle=stripe; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(-15,4); ctx.lineTo(15,4); ctx.moveTo(-15,12); ctx.lineTo(15,12); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
function figureHead(x,y,hat,hatColor){
  ctx.save(); ctx.translate(x,y);
  if(hat==='hood'||hat==='band') { circle(0,-8,17); ctx.fillStyle=hatColor; ctx.fill(); }
  circle(0,-6,15); ctx.fillStyle='#ffd9a6'; ctx.fill(); ctx.strokeStyle='#d9a06a'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#3a2c1a'; circle(-5,-7,2); ctx.fill(); circle(5,-7,2); ctx.fill();
  ctx.strokeStyle='#3a2c1a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,-3,5,0.3,Math.PI-0.3); ctx.stroke();
  if(hat==='cap'){ ctx.beginPath(); ctx.ellipse(0,-19,24,6,0,0,Math.PI*2); ctx.fillStyle='#16203c'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16,-19); ctx.quadraticCurveTo(0,-41,16,-19); ctx.quadraticCurveTo(0,-27,-16,-19);
    ctx.closePath(); ctx.fillStyle='#22315c'; ctx.fill(); ctx.strokeStyle='#16203c'; ctx.stroke();
    ctx.fillStyle='#f2f2f2'; ctx.beginPath(); ctx.moveTo(14,-25); ctx.quadraticCurveTo(24,-33,28,-27);
    ctx.quadraticCurveTo(20,-25,16,-21); ctx.closePath(); ctx.fill(); }
  else if(hat==='hood'){ ctx.strokeStyle=hatColor; ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(0,-6,16,-.5,Math.PI+.5); ctx.stroke(); }
  else if(hat==='band'){ ctx.fillStyle=hatColor; ctx.beginPath(); ctx.arc(0,-8,15,Math.PI,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14,-14); ctx.lineTo(25,-19); ctx.lineTo(23,-11); ctx.closePath(); ctx.fill(); }
  else if(hat==='cap2'){ ctx.fillStyle=hatColor; ctx.beginPath(); ctx.arc(0,-8,15,Math.PI,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-15,-9,30,4); }
  ctx.restore();
}
function drawCrew(c){
  ctx.save(); ctx.translate(c.x,c.y);
  if(!c.alive){
    ctx.globalAlpha=.85; ctx.rotate(1.35);
    ctx.beginPath(); ctx.ellipse(0,0,15,11,0,0,Math.PI*2); ctx.fillStyle='#9a9a9a'; ctx.fill();
    circle(12,-2,13); ctx.fillStyle='#e8cfa8'; ctx.fill(); ctx.restore(); return;
  }
  ctx.restore();
  const lunge=c.anim>0?c.anim/.3:0;
  if(c.id==='captain'){
    figureBody(c.x,c.y,'#2c4a8a');
    ctx.fillStyle='#ffcc33'; circle(c.x-4,c.y+9,2); ctx.fill(); circle(c.x+5,c.y+9,2); ctx.fill();
    const a=-0.9+lunge*1.5;
    ctx.save(); ctx.translate(c.x+14,c.y+2); ctx.rotate(a);
    ctx.strokeStyle='#c9cdd6'; ctx.lineWidth=6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(20,-6,28,8); ctx.stroke();
    ctx.fillStyle='#d9a213'; circle(0,0,5); ctx.fill(); ctx.restore();
    figureHead(c.x,c.y,'cap');
  }else if(c.id==='archer'){
    figureBody(c.x,c.y,'#3f7d3a');
    ctx.save(); ctx.translate(c.x+22,c.y-6); ctx.rotate(-.25);
    ctx.strokeStyle='#7a4a21'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,-24); ctx.quadraticCurveTo(22,0,0,24); ctx.stroke();
    ctx.strokeStyle='#e8e0c8'; ctx.lineWidth=2;
    const pull=lunge>0?2:10;
    ctx.beginPath(); ctx.moveTo(0,-24); ctx.lineTo(-pull,0); ctx.lineTo(0,24); ctx.stroke();
    if(lunge<=0){ ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(-pull,0); ctx.lineTo(40-pull,0); ctx.stroke();
      ctx.fillStyle='#5a4a3a'; ctx.beginPath(); ctx.moveTo(42-pull,0); ctx.lineTo(32-pull,-5); ctx.lineTo(32-pull,5); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    figureHead(c.x,c.y,'hood','#2a5426');
    rr(c.x-22,c.y+2,10,20,4); ctx.fillStyle='#8a5a2b'; ctx.fill(); ctx.strokeStyle='#5f3a17'; ctx.lineWidth=2; ctx.stroke();
  }else if(c.id==='gunner'){
    figureBody(c.x,c.y,'#f2f2f2','#e05548');
    const bx=c.x+14+lunge*10, by=c.y-8-lunge*8;
    ctx.strokeStyle='#f2f2f2'; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(c.x+6,c.y+4); ctx.lineTo(bx,by); ctx.stroke();
    circle(bx+8,by+4,9); ctx.fillStyle='#2b2f35'; ctx.fill();
    ctx.fillStyle='#4a4f57'; ctx.fillRect(bx+4,by-9,8,6);
    if(lunge>0){ ctx.save(); ctx.translate(bx+15,by-16); ctx.scale(1.1,1.1);
      ctx.fillStyle='#ffd23e'; ctx.fill(SPARK); ctx.restore(); }
    figureHead(c.x,c.y,'band','#e05548');
    ctx.fillStyle='rgba(90,90,90,.5)'; circle(c.x+9,c.y-4,3); ctx.fill();
  }else{
    figureBody(c.x,c.y,'#e0a23e');
    const beat=g.boarders.length?Math.abs(Math.sin(g.time*10)):Math.abs(Math.sin(g.time*4));
    ctx.fillStyle='#e05548'; circle(c.x+22,c.y+12,13); ctx.fill();
    ctx.strokeStyle='#a83a30'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='#e8d5a8'; circle(c.x+22,c.y+12,7); ctx.fill();
    ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=3.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(c.x+10,c.y-2+beat*4); ctx.lineTo(c.x+18,c.y+6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x+34,c.y-2+(1-beat)*4); ctx.lineTo(c.x+26,c.y+6); ctx.stroke();
    figureHead(c.x,c.y,'cap2','#3a6ac8');
  }
  if(c.flash>0){ ctx.fillStyle='rgba(255,60,40,'+(c.flash*1.6)+')'; circle(c.x,c.y-4,22); ctx.fill(); }
  if(g.rallyT>0){ ctx.strokeStyle='rgba(255,204,51,'+(0.4+0.3*Math.sin(g.time*8))+')'; ctx.lineWidth=3;
    circle(c.x,c.y-4,30); ctx.stroke(); }
}
function drawPirate(b){
  const x=b.x,y=b.y,lunge=b.anim>0?b.anim/.3:0;
  figureBody(x,y,'#f2f2f2','#3a3f4a');
  ctx.save(); ctx.translate(x+14,y-2); ctx.rotate(.6-lunge*1.2);
  ctx.strokeStyle='#c9cdd6'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(16,-8,22,6); ctx.stroke(); ctx.restore();
  figureHead(x,y,'band',b.band);
  if(b.hp<b.max){ hpBar(x-18,y-38,36,6,b.hp/b.max); }
}
