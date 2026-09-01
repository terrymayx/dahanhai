function deployBoarder(e){
  const useUpper=e.slot==='upper'||(e.slot==='both'&&e.deployed%2===0),slot=useUpper?SLOTS.upper:SLOTS.lower;
  const r=Math.random();let method=r<.58?'plank':r<.82?'swing':'climb';
  const band=e.deployed%2?'#d93636':'#3a3f4a',hp=e.type==='manowar'?52:42;
  if(method==='plank'){
    g.boarders.push({ship:e,hp,max:hp,band,x:e.x-70*e.s,y:slot.plankY+rand(-14,14),i:0,atkT:rand(.3,.7),anim:0,method,state:'plank',wp:[{x:612,y:slot.plankY},{x:565,y:slot.plankY+rand(-45,45)}]});
    splashFx(640,slot.plankY,.5);
  }else if(method==='swing'){
    const anchor={x:e.x-35*e.s,y:e.y+(useUpper?-145:145)*e.s},to={x:565,y:slot.plankY+rand(-70,70)};
    g.boarders.push({ship:e,hp,max:hp,band,x:anchor.x,y:anchor.y+40,atkT:rand(.3,.7),anim:0,method,state:'swing',swingT:0,dur:.9,anchor,from:{x:anchor.x,y:anchor.y+40},to});
  }else{
    g.boarders.push({ship:e,hp,max:hp,band,x:615,y:slot.plankY+(useUpper?65:-65),atkT:rand(.3,.7),anim:0,method,state:'climb',climbT:0,to:{x:566,y:slot.plankY+rand(-35,35)}});
  }
}
function updateBoarder(b,dt){
  if(b.state==='plank'){
    const wp=b.wp[b.i];if(!wp){b.state='fight';return;}const d=dist(b.x,b.y,wp.x,wp.y);
    if(d<10)b.i++;else{b.x+=(wp.x-b.x)/d*82*SPD*dt;b.y+=(wp.y-b.y)/d*82*SPD*dt;}return;
  }
  if(b.state==='swing'){
    b.swingT+=dt;const p=clamp(b.swingT/b.dur,0,1),q=1-p,cx=(b.anchor.x+b.to.x)/2-20,cy=Math.min(b.anchor.y,b.to.y)-115;
    b.x=q*q*b.from.x+2*q*p*cx+p*p*b.to.x;b.y=q*q*b.from.y+2*q*p*cy+p*p*b.to.y;
    if(p>=1)b.state='fight';return;
  }
  if(b.state==='climb'){
    b.climbT+=dt;const p=clamp(b.climbT/.75,0,1);b.x=615+(b.to.x-615)*p;b.y=b.y+(b.to.y-b.y)*Math.min(1,dt*5);
    if(p>=1)b.state='fight';return;
  }
  let tgt=null,best=1e9;for(const c of g.crew)if(c.alive){const d=dist(b.x,b.y,c.x,c.y);if(d<best){best=d;tgt=c;}}
  if(tgt){
    if(best>46){b.x+=(tgt.x-b.x)/best*64*SPD*dt;b.y+=(tgt.y-b.y)/best*64*SPD*dt;}
    else{b.atkT-=dt;if(b.atkT<=0){b.atkT=.95;b.anim=.3;tgt.hp-=7;tgt.flash=.25;slashFx((b.x+tgt.x)/2,(b.y+tgt.y)/2);sfx.slash();if(tgt.hp<=0){tgt.alive=false;tgt.hp=0;sfx.die();g.texts.push({x:tgt.x,y:tgt.y-40,str:tgt.id==='captain'?'船长倒下了！':'船员倒下了…',t:1.2,color:'#ff8a7e',size:22});}}}
  }else{
    const sx=430,sy=620,d=dist(b.x,b.y,sx,sy);if(d>60){b.x+=(sx-b.x)/d*62*SPD*dt;b.y+=(sy-b.y)/d*62*SPD*dt;}
    else{b.atkT-=dt;if(b.atkT<=0){b.atkT=1.1;b.anim=.3;damagePlayer(7,b.x,b.y);slashFx(b.x-30,b.y);sfx.slash();}}
  }
}
function moveCaptain(c,tgt,dt){
  if(!tgt){c.x+=(c.homeX-c.x)*Math.min(1,dt*2.5);c.y+=(c.homeY-c.y)*Math.min(1,dt*2.5);return;}
  const d=dist(c.x,c.y,tgt.x,tgt.y);if(d>c.rg&&d<250){c.x+=(tgt.x-c.x)/d*82*dt;c.y+=(tgt.y-c.y)/d*82*dt;}
}
function update(dt){
  g.time+=dt;g.scroll+=60*dt;
  for(const f of g.foam){f.y+=f.vy*dt;f.x+=f.vx*dt;f.life-=dt;}g.foam=g.foam.filter(f=>f.life>0);g.foamT-=dt;
  if(g.foamT<=0){g.foamT=.14;g.foam.push({x:430+rand(-24,24),y:878,vx:rand(-26,26),vy:rand(46,80),r:rand(4,9),life:2.2,max:2.2});}
  g.shake=Math.max(0,g.shake-14*dt);g.hurtT=Math.max(0,g.hurtT-dt);g.warnT=Math.max(0,g.warnT-dt);g.wavePopT=Math.max(0,g.wavePopT-dt);g.hintT=Math.max(0,g.hintT-dt);g.rallyT=Math.max(0,g.rallyT-dt);g.targetT=Math.max(0,g.targetT-dt);
  for(const s of g.sk)s.cd=Math.max(0,s.cd-dt);
  if(g.spawnQueue.length){g.spawnT-=dt;if(g.spawnT<=0){const q=g.spawnQueue.shift();spawnEnemy(q.type);g.spawnT=g.spawnQueue.length?g.spawnQueue[0].delay:0;}}

  for(const e of g.enemies){
    e.flash=Math.max(0,e.flash-dt);if(e.state==='sink'){e.sinkT+=dt;continue;}
    if(e.t.role==='ranged'){
      if(e.state==='approach'){e.x=Math.max(e.rangeX,e.x-e.t.sp*SPD*dt);e.y+=(e.rangeY-e.y)*Math.min(1,dt*.65);if(e.x<=e.rangeX+1)e.state='ranged';}
      else if(e.state==='ranged'){e.x+=(e.rangeX-e.x)*Math.min(1,dt*.8);e.y+=(e.rangeY+Math.sin(g.time*.7+e.ph)*65-e.y)*Math.min(1,dt*.7);}
      if((e.state==='approach'||e.state==='ranged')&&e.x<1750){e.shootT-=dt*SPD;if(e.shootT<=0){e.shootT=rand(3.2,4.6);e.flash=.2;const mx=e.x-243*e.s,my=e.y-56*e.s,tx=430+rand(-45,45),ty=560+rand(-190,190),d=dist(mx,my,tx,ty);g.eballs.push({x:mx,y:my,vx:(tx-mx)/d*350,vy:(ty-my)/d*350,life:4});g.fx.push({k:'flash',x:mx-14,y:my,t:0,dur:.2,s:.8});sfx.fire();}}
      continue;
    }
    if(e.state==='approach'||e.state==='hold'){
      const waitX=1040+120*e.s;if(e.x>waitX){e.x=Math.max(waitX,e.x-e.t.sp*SPD*dt);e.state='approach';}
      else{const slot=chooseDockSlot(e);if(slot){e.slot=slot;e.state='turning';e.turnT=0;}else{e.state='hold';e.y+=Math.sin(g.time+e.ph)*6*dt;}}
    }else if(e.state==='turning'){
      e.turnT=Math.min(1,e.turnT+dt/.9);e.rot=e.turnT*Math.PI/2;const ty=SLOTS[e.slot].y;e.x+=(dockCX(e)-e.x)*Math.min(1,dt*3);e.y+=(ty-e.y)*Math.min(1,dt*3);
      if(e.turnT>=1){e.state='docked';e.deployT=.45;g.warnT=3.5;sfx.alarm();}
    }else if(e.state==='docked'){
      if(e.deployed<e.t.pir){e.deployT-=dt*SPD;if(e.deployT<=0){e.deployT=e.type==='manowar'?.72:.95;e.deployed++;deployBoarder(e);}}
      else if(!g.boarders.some(b=>b.ship===e&&b.hp>0)){e.clearT+=dt;if(e.clearT>1.0)e.state='retreat';}else e.clearT=0;
    }else if(e.state==='retreat'){
      e.rot=Math.max(0,e.rot-dt*1.5);e.x+=e.t.sp*.9*dt;e.y+=(560-e.y)*Math.min(1,dt*.35);if(e.x>2180)e.gone=true;
    }
  }
  g.enemies=g.enemies.filter(e=>!e.gone&&!(e.state==='sink'&&e.sinkT>1.35));

  g.cannonT-=dt*(g.rallyT>0?1.6:1)*(g.crew[3].alive?1.22:1);if(g.cannonT<=0){if(passiveCannon())g.cannonT=2.25;else g.cannonT=.5;}
  for(const b of g.balls){b.x+=b.vx*SPD*dt;b.y+=b.vy*SPD*dt;b.life-=dt;for(const e of g.enemies){if(e.state==='sink')continue;if(inShip(e,b.x,b.y)){damageEnemy(e,b.dmg,b.x,b.y);b.dead=true;break;}}if(b.x>2120||b.x<0||b.y<0||b.y>H||b.life<=0){b.dead=true;if(b.x>1900)splashFx(Math.min(2010,b.x),clamp(b.y,50,H-50),1);}}
  g.balls=g.balls.filter(b=>!b.dead);
  for(const b of g.eballs){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.x<=615){b.dead=true;if(Math.abs(b.y-560)<=290){damagePlayer(rand(5,8),560,b.y);boomFx(600,b.y,.8);}else splashFx(600,b.y,1);}if(b.life<=0)b.dead=true;}g.eballs=g.eballs.filter(b=>!b.dead);
  for(const a of g.arrows){a.x+=a.vx*dt;a.y+=a.vy*dt;for(const e of g.enemies){if(e.state==='sink')continue;if(inShip(e,a.x,a.y)){damageEnemy(e,a.dmg,a.x,a.y);sparkFx(a.x,a.y,.7);a.dead=true;break;}}if(a.x>2100||a.x<0||a.y<0||a.y>H)a.dead=true;}g.arrows=g.arrows.filter(a=>!a.dead);
  if(g.rain){g.rain.t+=dt;if(g.rain.t>.9)g.rain=null;else{g.rain.next-=dt;if(g.rain.next<=0&&g.rain.dropped<12){g.rain.next=.07;g.rain.dropped++;const ox=g.rain.x+rand(-230,230),oy=g.rain.y+rand(-130,130);g.fx.push({k:'stick',x:ox,y:oy,t:0,dur:.9});for(const e of g.enemies){if(e.state==='sink')continue;if(inShip(e,ox,oy)){damageEnemy(e,6,ox,oy);break;}}}}}

  for(const b of g.boarders)updateBoarder(b,dt);g.boarders=g.boarders.filter(b=>b.hp>0);
  const drumAlive=g.crew[3].alive,rate=(g.rallyT>0?2:1)*(drumAlive?1.3:1);
  for(const c of g.crew){
    c.anim=Math.max(0,c.anim-dt);c.flash=Math.max(0,c.flash-dt);if(!c.alive)continue;if(!g.boarders.length&&c.hp<c.max)c.hp=Math.min(c.max,c.hp+2*dt);
    let tgt=[...g.boarders].filter(b=>b.hp>0).sort((a,b)=>((a.state==='swing'&&c.id==='archer')?-500:0)-((b.state==='swing'&&c.id==='archer')?-500:0)+dist(c.x,c.y,a.x,a.y)-dist(c.x,c.y,b.x,b.y))[0]||null;
    if(c.id==='captain')moveCaptain(c,tgt,dt);
    const best=tgt?dist(c.x,c.y,tgt.x,tgt.y):1e9;
    if(tgt&&best<=c.rg){c.atkT-=dt*rate;if(c.atkT<=0){c.atkT=c.itv;c.anim=.3;const ang=Math.atan2(tgt.y-c.y,tgt.x-c.x);if(c.id==='captain'){damageBoarder(tgt,c.dmg,tgt.x,tgt.y);slashFx(tgt.x,tgt.y,ang);sfx.slash();}else if(c.id==='archer'){g.fx.push({k:'line',x:c.x,y:c.y,x2:tgt.x,y2:tgt.y,t:0,dur:.15});damageBoarder(tgt,c.dmg,tgt.x,tgt.y);sparkFx(tgt.x,tgt.y,.6);sfx.arrow();}else if(c.id==='gunner'){g.fx.push({k:'bomb',x:c.x,y:c.y,x2:tgt.x,y2:tgt.y,t:0,dur:.5});for(const b2 of g.boarders)if(b2.hp>0&&dist(tgt.x,tgt.y,b2.x,b2.y)<c.aoe){damageBoarder(b2,c.dmg,b2.x,b2.y);sparkFx(b2.x,b2.y,.8);}sfx.boom();}else{damageBoarder(tgt,c.dmg,tgt.x,tgt.y);sparkFx(tgt.x,tgt.y,.5);}}}
    else if(c.id==='archer'&&!g.boarders.length){const t=targetForFire();if(t){c.atkT-=dt*rate;if(c.atkT<=0){c.atkT=c.itv;c.anim=.3;const d=dist(c.x,c.y,t.x,t.y);g.arrows.push({x:c.x+30,y:c.y-6,vx:(t.x-c.x)/d*950,vy:(t.y-c.y)/d*950,dmg:c.dmg});sfx.arrow();}}}
  }

  if(!g.spawnQueue.length&&!g.enemies.length&&!g.boarders.length){if(g.breakT<=0)g.breakT=2.0;g.breakT-=dt;if(g.breakT<=0){if(g.wave>=WAVE_TOTAL){g.state='win';sfx.win();}else startWave(g.wave+1);}}else g.breakT=0;
}
