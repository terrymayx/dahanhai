/* ================= HUD ================= */
function drawHUD(){
  woodPanel(30,30,250,64,14);coinIcon(72,62,1);txt(''+g.gold,110,44,34,'#4a2c10',null,0,'left');
  const warn=boardingMode();
  if(warn){
    ctx.fillStyle='#6e1f1f';ctx.beginPath();ctx.moveTo(690,42);ctx.lineTo(662,60);ctx.lineTo(690,78);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(1230,42);ctx.lineTo(1258,60);ctx.lineTo(1230,78);ctx.closePath();ctx.fill();
    rr(690,26,540,68,16);ctx.fillStyle='#a83232';ctx.fill();ctx.strokeStyle='#6e1f1f';ctx.lineWidth=5;ctx.stroke();rr(702,36,516,48,10);ctx.fillStyle='#c04848';ctx.fill();drawSkull(740,60,1.1);
    const docked=g.enemies.filter(e=>e.state==='docked'&&e.contact).length;txt('接舷战！'+docked+' 艘贴帮 · '+g.boarders.length+' 名海盗',980,70,32,'#ffffff','#5a1818',5);
  }else{
    woodPanel(790,30,340,64,14);const remain=g.enemies.length+g.spawnQueue.length+g.boarders.length;txt('第 '+Math.max(1,g.wave)+'/'+WAVE_TOTAL+' 波 · 剩余 '+remain,960,72,30,'#4a2c10');
  }
  circle(BTN_PAUSE.x,BTN_PAUSE.y,BTN_PAUSE.r);ctx.fillStyle='#8a5a2b';ctx.fill();ctx.strokeStyle='#5f3a17';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#ffffff';ctx.fillRect(BTN_PAUSE.x-13,BTN_PAUSE.y-12,8,24);ctx.fillRect(BTN_PAUSE.x+5,BTN_PAUSE.y-12,8,24);
  hpBar(350,182,230,28,g.player.hp/g.player.max,'#5a2020');txt('我方旗舰',598,206,24,'#ffffff','#3a2c1a',4,'left');
  for(let i=0;i<g.sk.length;i++){
    const s=g.sk[i],crew=g.crew.find(c=>c.id===s.crew),spec=skillSpec(i),R=s.r;
    if(s.cd<=0&&crew.alive){ctx.globalAlpha=.25+.15*Math.sin(g.time*6);circle(s.x,s.y,R+10);ctx.fillStyle='#ffd94d';ctx.fill();ctx.globalAlpha=1;}
    circle(s.x,s.y,R+10);ctx.fillStyle='rgba(95,58,23,.5)';ctx.fill();circle(s.x,s.y,R);ctx.fillStyle=crew.alive?'#8a5a2b':'#5a5a5a';ctx.fill();ctx.strokeStyle='#3f2a12';ctx.lineWidth=5;ctx.stroke();circle(s.x,s.y,R-12);ctx.fillStyle=crew.alive?'#f3e3bd':'#bdbdbd';ctx.fill();
    ctx.save();if(!crew.alive)ctx.globalAlpha=.45;
    if(spec.key==='broadside'){drawCannon(s.x-R*.62,s.y+4,R/118,false);}
    else if(spec.key==='powder'){circle(s.x,s.y+2,R*.25);ctx.fillStyle='#2b2f35';ctx.fill();ctx.strokeStyle='#111318';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#4a4f57';ctx.fillRect(s.x-5,s.y-R*.42,10,9);ctx.save();ctx.translate(s.x+R*.28,s.y-R*.42);ctx.scale(R/55,R/55);ctx.fillStyle='#ffd23e';ctx.fill(SPARK);ctx.restore();}
    else if(spec.key==='rain'||spec.key==='quick'){ctx.save();ctx.translate(s.x+2,s.y);ctx.rotate(-.3);ctx.strokeStyle='#7a4a21';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-8,-16);ctx.quadraticCurveTo(14,0,-8,16);ctx.stroke();ctx.strokeStyle='#e8e0c8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,-16);ctx.lineTo(-2,0);ctx.lineTo(-8,16);ctx.stroke();ctx.strokeStyle='#8a6a3a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(18,0);ctx.stroke();ctx.fillStyle='#5a4a3a';ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(12,-4);ctx.lineTo(12,4);ctx.closePath();ctx.fill();ctx.restore();}
    else if(spec.key==='slash'){ctx.strokeStyle='#dfe3ea';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.arc(s.x,s.y,20,-1.3,1.2);ctx.stroke();ctx.fillStyle='#d9a213';circle(s.x-16,s.y+14,4);ctx.fill();}
    else{ctx.strokeStyle='#5f3a17';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s.x-2,s.y-18);ctx.lineTo(s.x-2,s.y+18);ctx.stroke();ctx.fillStyle='#e05548';ctx.beginPath();ctx.moveTo(s.x-2,s.y-18);ctx.lineTo(s.x+24,s.y-10);ctx.lineTo(s.x-2,s.y-2);ctx.closePath();ctx.fill();ctx.save();ctx.translate(s.x+10,s.y-10);ctx.scale(.8,.8);ctx.fillStyle='#ffcc33';ctx.fill(SPARK);ctx.restore();}
    ctx.restore();
    if(s.cd>0){const frac=clamp(s.cd/spec.max,0,1);ctx.fillStyle='rgba(20,35,55,.55)';ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.arc(s.x,s.y,R,-Math.PI/2,-Math.PI/2+Math.PI*2*frac);ctx.closePath();ctx.fill();txt(Math.ceil(s.cd),s.x,s.y+10,30,'#ffffff','#2a3a4a',4);}
    if(!crew.alive)txt('阵亡',s.x,s.y+8,22,'#ff8a7e','#5a1818',4);txt(spec.name,s.x,s.y+R+30,R>50?26:20,'#ffffff','#3a2c1a',5);
  }
  for(let i=0;i<g.crew.length;i++){
    const c=g.crew[i],x=40+i*102,y=1002;rr(x,y,92,62,10);ctx.fillStyle='#8a5a2b';ctx.fill();ctx.strokeStyle=c.alive?'#5f3a17':'#7a2020';ctx.lineWidth=3;ctx.stroke();rr(x+4,y+4,84,54,8);ctx.fillStyle='#c98d4e';ctx.fill();ctx.globalAlpha=c.alive?1:.5;circle(x+30,y+28,18);ctx.fillStyle=c.alive?'#ffd9a6':'#b8b8b8';ctx.fill();ctx.strokeStyle='#d9a06a';ctx.lineWidth=2;ctx.stroke();const hatC={captain:'#22315c',archer:'#3f7d3a',gunner:'#e05548',drummer:'#3a6ac8'}[c.id];ctx.fillStyle=hatC;ctx.beginPath();ctx.arc(x+30,y+28,18,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();ctx.fillStyle='#3a2c1a';circle(x+26,y+30,1.8);ctx.fill();circle(x+34,y+30,1.8);ctx.fill();ctx.globalAlpha=1;const pct=c.hp/c.max;rr(x+54,y+22,30,10,4);ctx.fillStyle='#5a2020';ctx.fill();if(pct>0){rr(x+54,y+22,30*clamp(pct,0,1),10,4);ctx.fillStyle=pct>.5?'#5ad46a':pct>.25?'#ffcc33':'#f2544d';ctx.fill();}if(!c.alive)txt('✝',x+30,y+36,24,'#7a2020',null,0);
  }
  if(g.hintT>0){ctx.globalAlpha=Math.min(1,g.hintT);txt('点敌船可集火 · 技能会随“远程 / 接舷”自动切换 · 1 / 2 / 3',960,1002,28,'#ffffff','#0e3a52',6);ctx.globalAlpha=1;}
  if(g.wavePopT>0){ctx.globalAlpha=Math.min(1,g.wavePopT);txt('第 '+g.wave+' 波',960,210,54,'#ffd23e','#5f3a17',8);ctx.globalAlpha=1;}
}

/* ================= 覆盖层 ================= */
function bigButton(b,label,sub){
  rr(b.x,b.y,b.w,b.h,18); ctx.fillStyle='#8a5a2b'; ctx.fill(); ctx.strokeStyle='#5f3a17'; ctx.lineWidth=5; ctx.stroke();
  rr(b.x+8,b.y+8,b.w-16,b.h-16,12); ctx.fillStyle='#c98d4e'; ctx.fill();
  txt(label,b.x+b.w/2,b.y+b.h/2+12,38,'#4a2c10');
  if(sub) txt(sub,b.x+b.w/2,b.y+b.h+34,20,'#cfe8f5','#0e3a52',4);
}
function overlay(){ ctx.fillStyle='rgba(6,20,32,.74)'; ctx.fillRect(0,0,W,H); }
function drawMenu(){
  overlay();txt('大 航 海 时 代',960,280,110,'#ffffff','#5f3a17',14);txt('V6.4 · 登船队列系统',960,365,38,'#ffd23e','#5f3a17',6);
  const lines=['🏴‍☠️ 炮舰远程开火；突击艇与巨舰使用智能自由接舷',
    '⚓ 普通接舷船 1 条登船通道；巨舰拥有 2 条独立通道',
    '🪝 前一名海盗未进入甲板前，同一通道会排队等待，不再叠人',
    '⚔️ 巨舰双通道可并行登船；母船沉没会中断尚未完成的登船',
    '🎯 点击敌船可集火；同一组三个技能会随远程 / 接舷战切换'];
  lines.forEach((l,i)=>txt(l,960,445+i*48,25,'#e8f4fb','#0e3a52',5));bigButton(BTN_START,'开始连续海战！');txt('智能接舷 + 登船队列 · 鼠标 / 触摸 · 横屏体验最佳',960,835,20,'#9cc4d8',null,0);
}

function drawEnd(win){
  overlay();
  if(win){ txt('胜 利 ！',960,330,100,'#ffd23e','#5f3a17',12);
    txt('海盗舰队已被全歼，海域恢复平静～',960,410,32,'#ffffff','#0e3a52',5); }
  else{ txt('旗舰沉没…',960,330,100,'#ff8a7e','#5a1818',12);
    txt('别灰心，重整旗鼓再来一次！',960,410,32,'#ffffff','#0e3a52',5); }
  txt('击沉 '+g.kills+' 艘 · 掠得金币 '+g.gold,960,500,40,'#ffcc33','#5f3a17',6);
  bigButton(BTN_AGAIN,win?'再来一局':'重整旗鼓');
}
function drawPause(){
  overlay();
  txt('暂 停',960,380,84,'#ffffff','#5f3a17',10);
  bigButton(BTN_RESUME,'继续战斗');
  bigButton(BTN_RESTART,'重新开始');
  txt('键盘 P 继续 · R 重开',960,790,22,'#9cc4d8',null,0);
}