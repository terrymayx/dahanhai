/* ================= 输入 ================= */
function toLogical(ev){
  const r=cv.getBoundingClientRect();
  return {x:((ev.clientX-r.left)-vx)/vs, y:((ev.clientY-r.top)-vy)/vs};
}
function inBtn(p,b){ return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h; }
cv.addEventListener('pointerdown',ev=>{
  ev.preventDefault(); ac();
  const p=toLogical(ev);
  if(g.state==='menu'){ if(inBtn(p,BTN_START)){ g.state='playing'; startWave(1); sfx.cast(); } return; }
  if(g.state==='win'||g.state==='lose'){ if(inBtn(p,BTN_AGAIN)){ g=newGame(); g.state='playing'; startWave(1); window.G=g; sfx.cast(); } return; }
  if(g.state==='pause'){
    if(inBtn(p,BTN_RESUME)) g.state='playing';
    else if(inBtn(p,BTN_RESTART)){ g=newGame(); g.state='playing'; startWave(1); window.G=g; }
    return;
  }
  if(dist(p.x,p.y,BTN_PAUSE.x,BTN_PAUSE.y)<=BTN_PAUSE.r+8){ g.state='pause'; return; }
  for(let i=0;i<g.sk.length;i++){
    const s=g.sk[i];
    if(dist(p.x,p.y,s.x,s.y)<=s.r+14){ castSkill(i); return; }
  }
  for(let i=g.enemies.length-1;i>=0;i--){ const e=g.enemies[i];
    if(e.state!=='sink'&&inShip(e,p.x,p.y)){ g.focus=e;g.targetT=1.2;g.texts.push({x:e.x,y:e.y-70*e.s,str:'集火：'+e.t.name,t:1,color:'#ffd23e',size:24});return; }
  }
  g.focus=null;
});
addEventListener('keydown',ev=>{
  if(ev.key==='1') castSkill(0);
  else if(ev.key==='2') castSkill(1);
  else if(ev.key==='3') castSkill(2);
  else if(ev.key==='p'||ev.key==='P'){
    if(g.state==='playing') g.state='pause'; else if(g.state==='pause') g.state='playing'; }
  else if((ev.key==='r'||ev.key==='R')&&(g.state==='win'||g.state==='lose'||g.state==='pause')){
    g=newGame(); g.state='playing'; startWave(1); window.G=g; }
});

/* ================= 主循环 ================= */
let last=performance.now();
function loop(now){
  const dt=clamp((now-last)/1000,0,.05); last=now;
  if(g.state==='playing') update(dt);
  else { g.time+=dt; g.scroll+=30*dt; }
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle='#0b1e2e'; ctx.fillRect(0,0,innerWidth,innerHeight);
  const shx=g.shake?rand(-g.shake,g.shake):0, shy=g.shake?rand(-g.shake,g.shake):0;
  ctx.translate(vx+shx*vs,vy+shy*vs); ctx.scale(vs,vs);
  drawSea();
  for(const e of g.enemies){
    if(e.state==='docked'&&e.contact)drawDockedGear(e);
  }
  for(const e of g.enemies) drawEnemyShip(e);
  drawPlayerShip();
  drawFocus();
  for(const b of g.balls){ ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(b.x-b.vx*.04,b.y-b.vy*.04);ctx.lineTo(b.x,b.y);ctx.stroke();circle(b.x,b.y,12);ctx.fillStyle='#2b2f35';ctx.fill();ctx.strokeStyle='#111318';ctx.lineWidth=3;ctx.stroke(); }
  for(const b of g.eballs){ ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-b.vx*.04,b.y-b.vy*.04);ctx.lineTo(b.x,b.y);ctx.stroke();circle(b.x,b.y,10);ctx.fillStyle='#2b2f35';ctx.fill();ctx.strokeStyle='#111318';ctx.lineWidth=3;ctx.stroke(); }
  for(const a of g.arrows){ ctx.strokeStyle='#8a6a3a';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x-a.vx*.03,a.y-a.vy*.03);ctx.lineTo(a.x,a.y);ctx.stroke(); }
  drawBoardingRoutes();
  for(const b of g.boarders) drawPirate(b);
  const rdt=g.state==='playing'?dt:0;
  drawFxAll(rdt);
  for(const t of g.texts){ t.t-=dt; t.y-=34*dt;
    ctx.globalAlpha=clamp(t.t*2,0,1);
    if(t.coin) coinIcon(t.x-34,t.y-8,.6);
    txt(t.str,t.x,t.y,t.size,t.color,'#3a2c1a',4);
    ctx.globalAlpha=1; }
  g.texts=g.texts.filter(t=>t.t>0);
  drawHUD();
  if(g.state==='menu') drawMenu();
  else if(g.state==='pause') drawPause();
  else if(g.state==='win') drawEnd(true);
  else if(g.state==='lose') drawEnd(false);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
