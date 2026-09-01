/* ================= 战斗逻辑 ================= */
function damageEnemy(e,d,x,y){
  if(!e||e.state==='sink')return;
  e.hp-=d;g.texts.push({x:x??e.x,y:(y??e.y)-60*e.s,str:'-'+Math.round(d),t:.85,color:'#ffd23e',size:26});
  if(e.hp<=0){
    e.hp=0;e.state='sink';e.sinkT=0;g.gold+=e.t.gold;g.kills++;
    if(g.focus===e)g.focus=null;
    g.texts.push({x:e.x,y:e.y-40,str:'+'+e.t.gold,t:1.1,color:'#ffcc33',size:30,coin:true});
    sfx.boom();sfx.coin();boomFx(e.x,e.y,1.4*e.s);splashFx(e.x+120*e.s,e.y,1.6);
    for(const b of g.boarders){
      if(b.ship!==e)continue;
      if(b.state==='fight'){b.ship=null;continue;}
      b.hp=0;splashFx(b.x,b.y,.7);g.texts.push({x:b.x,y:b.y-20,str:'落海！',t:.7,color:'#e8f4fb',size:20});
    }
  }
}
function damagePlayer(d,x,y){
  g.player.hp-=d;g.hurtT=.4;g.shake=Math.max(g.shake,5);
  g.texts.push({x:x??500,y:y??180,str:'-'+Math.round(d),t:.8,color:'#ff6a5e',size:28});
  if(g.player.hp<=0){g.player.hp=0;g.state='lose';sfx.lose();}
}
function damageBoarder(b,d,x,y){
  if(!b||b.hp<=0)return;
  b.hp-=d;g.texts.push({x:x??b.x,y:(y??b.y)-28,str:'-'+Math.round(d),t:.65,color:'#ffffff',size:20});
  if(b.hp<=0&&!b.rewarded){b.hp=0;b.rewarded=true;g.gold+=15;sfx.die();sfx.coin();g.texts.push({x:b.x,y:b.y-46,str:'+15',t:.9,color:'#ffcc33',size:22,coin:true});}
}
function boomFx(x,y,s){
  g.fx.push({k:'boom',x,y,t:0,dur:.55,s:s||1});
  for(let i=0;i<6;i++)g.smoke.push({x:x+rand(-14,14),y:y+rand(-14,14),vx:rand(-30,30),vy:rand(-46,-12),r:rand(8,16)*s,life:rand(.7,1.2),max:1.2});
  g.shake=Math.max(g.shake,4*(s||1));
}
function splashFx(x,y,s){g.fx.push({k:'splash',x,y,t:0,dur:.6,s:s||1});}
function sparkFx(x,y,s){g.fx.push({k:'spark',x,y,t:0,dur:.28,s:s||1});}
function slashFx(x,y,a){g.fx.push({k:'slash',x,y,t:0,dur:.25,a:a||0});}
function launchBall(x,y,t,dmg,spd=760,spread=0){
  let tx=t?t.x:2050,ty=t?t.y:y,dx=tx-x,dy=ty-y,l=dist(x,y,tx,ty)||1;
  g.balls.push({x,y,vx:dx/l*spd,vy:dy/l*spd+rand(-spread,spread),dmg,life:3});
}
function passiveCannon(){
  const gunner=g.crew.find(c=>c.id==='gunner');if(!gunner||!gunner.alive||deckCombat())return false;
  const t=targetForFire();if(!t)return false;
  const ys=[430,560,690],y=ys.sort((a,b)=>Math.abs(a-t.y)-Math.abs(b-t.y))[0];
  launchBall(662,y,t,13,780,8);g.fx.push({k:'flash',x:672,y,t:0,dur:.2,s:.82});sfx.fire();return true;
}
function skillSpec(i){
  const board=deckCombat();
  if(i===0)return board?{key:'powder',name:'火药桶',max:5.5}:{key:'broadside',name:'齐射',max:4.0};
  if(i===1)return board?{key:'quick',name:'速射',max:5.0}:{key:'rain',name:'箭雨',max:8.0};
  return board?{key:'slash',name:'挥砍',max:5.5}:{key:'rally',name:'号令',max:12};
}
function castSkill(i){
  const s=g.sk[i],crew=g.crew.find(c=>c.id===s.crew),spec=skillSpec(i);
  if(g.state!=='playing'||s.cd>0||!crew.alive){tone(180,120,.12,'square',.06);return;}
  if(spec.key==='broadside'){
    const all=[...g.enemies].filter(e=>e.state!=='sink'&&!e.gone).sort((a,b)=>(a===g.focus?-1:0)-(b===g.focus?-1:0)||a.x-b.x);
    if(!all.length){tone(180,120,.12,'square',.06);return;}
    const ys=[430,560,690];for(let k=0;k<3;k++){const t=all[k%all.length];launchBall(662,ys[k],t,18,820,10);g.fx.push({k:'flash',x:672,y:ys[k],t:0,dur:.22,s:1});}
    for(let j=0;j<8;j++)g.smoke.push({x:690,y:560+rand(-140,140),vx:rand(20,70),vy:rand(-30,6),r:rand(9,15),life:rand(.5,.9),max:.9});
    sfx.fire();g.shake=Math.max(g.shake,5);
  }else if(spec.key==='powder'){
    const t=[...g.boarders].filter(b=>b.hp>0).sort((a,b)=>dist(crew.x,crew.y,a.x,a.y)-dist(crew.x,crew.y,b.x,b.y))[0];
    if(!t){tone(180,120,.12,'square',.06);return;}
    g.fx.push({k:'bomb',x:crew.x,y:crew.y,x2:t.x,y2:t.y,t:0,dur:.55});
    for(const b of g.boarders)if(b.hp>0&&dist(t.x,t.y,b.x,b.y)<125){damageBoarder(b,38,b.x,b.y);b.x+=36;}
    boomFx(t.x,t.y,1.05);sfx.boom();
  }else if(spec.key==='rain'){
    const t=targetForFire();if(!t){tone(180,120,.12,'square',.06);return;}
    g.rain={x:t.x,y:t.y,t:0,next:0,dropped:0};sfx.arrow();
  }else if(spec.key==='quick'){
    const ts=[...g.boarders].filter(b=>b.hp>0).sort((a,b)=>((a.state==='swing'||a.state==='climb')?-1000:0)-((b.state==='swing'||b.state==='climb')?-1000:0)+dist(crew.x,crew.y,a.x,a.y)-dist(crew.x,crew.y,b.x,b.y)).slice(0,4);
    if(!ts.length){tone(180,120,.12,'square',.06);return;}
    for(const b of ts){g.fx.push({k:'line',x:crew.x,y:crew.y,x2:b.x,y2:b.y,t:0,dur:.18});damageBoarder(b,24,b.x,b.y);sparkFx(b.x,b.y,.7);}sfx.arrow();
  }else if(spec.key==='rally'){
    g.rallyT=5;for(const c of g.crew)if(c.alive){c.hp=Math.min(c.max,c.hp+22);g.fx.push({k:'ring',x:c.x,y:c.y,t:0,dur:.6,s:1});}
    g.player.hp=Math.min(g.player.max,g.player.hp+12);g.texts.push({x:430,y:180,str:'号令！全体振奋',t:1.2,color:'#ffcc33',size:34});sfx.cast();
  }else if(spec.key==='slash'){
    const ts=[...g.boarders].filter(b=>b.hp>0).sort((a,b)=>dist(crew.x,crew.y,a.x,a.y)-dist(crew.x,crew.y,b.x,b.y)).slice(0,4);
    if(!ts.length){tone(180,120,.12,'square',.06);return;}
    for(const b of ts){slashFx(b.x,b.y,Math.atan2(b.y-crew.y,b.x-crew.x));damageBoarder(b,34,b.x,b.y);b.x+=30;}
    crew.anim=.3;sfx.slash();g.shake=Math.max(g.shake,3);
  }
  s.cd=spec.max;
}
