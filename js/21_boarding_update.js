/* V6.4 BOARDING QUEUE START */
function boardingChannelCount(e){return e&&e.type==='manowar'?2:1;}
function boardingChannelOffset(e,channel){
  if(boardingChannelCount(e)===1)return 0;
  return channel===0?-34:34;
}
function boardingChannelBusy(e,channel){
  return g.boarders.some(b=>b.hp>0&&b.ship===e&&b.boardingChannel===channel&&b.state!=='fight');
}
function chooseBoardingChannel(e){
  const count=boardingChannelCount(e);
  for(let channel=0;channel<count;channel++)if(!boardingChannelBusy(e,channel))return channel;
  return -1;
}
/* V6.4 BOARDING QUEUE END */

function deployBoarder(e){
  if(!e||e.state!=='docked'||!e.contact||
     !Number.isFinite(e.contactX)||!Number.isFinite(e.contactY)||
     !shipsTouchPlayer(e))return false;
  const channel=chooseBoardingChannel(e);if(channel<0)return false;
  const ec=enemyCollider(e),laneOffset=boardingChannelOffset(e,channel);
  const laneY=clampContactY(e.contactY+laneOffset,ec.ry);
  const laneContactX=playerHullRightX(laneY);
  const bowX=enemyBowX(e)+18;
  const entryX=Math.min(580,laneContactX-18);
  const entryY=laneY;
  const r=Math.random();let method=r<.58?'plank':r<.82?'swing':'climb';
  const band=e.deployed%2?'#d93636':'#3a3f4a',hp=e.type==='manowar'?52:42;
  if(method==='plank'){
    const landing={x:entryX,y:entryY+rand(-26,26)};
    g.boarders.push({ship:e,hp,max:hp,band,x:bowX,y:e.y+laneOffset+rand(-10,10),i:0,atkT:rand(.3,.7),anim:0,
      boardingChannel:channel,boardingLaneY:laneY,method:'plank',state:'plank',
      wp:[{x:laneContactX+12,y:laneY},{x:landing.x,y:landing.y}]});
    splashFx(laneContactX,laneY,.5);
  }else if(method==='swing'){
    const anchor={x:bowX+10,y:e.y+laneOffset+rand(-18,18)};
    const to={x:entryX,y:entryY+rand(-42,42)};
    g.boarders.push({ship:e,hp,max:hp,band,x:anchor.x,y:anchor.y+28,atkT:rand(.3,.7),anim:0,
      boardingChannel:channel,boardingLaneY:laneY,method:'swing',state:'swing',swingT:0,dur:.9,anchor,from:{x:anchor.x,y:anchor.y+28},to});
  }else{
    const to={x:entryX,y:entryY+rand(-28,28)};
    g.boarders.push({ship:e,hp,max:hp,band,x:bowX,y:e.y+laneOffset+rand(-16,16),atkT:rand(.3,.7),anim:0,
      boardingChannel:channel,boardingLaneY:laneY,method:'climb',state:'climb',climbT:0,to});
  }
  return true;
}
function updateBoarder(b,dt){
  if(b.state==='plank'){
    const wp=b.wp[b.i];if(!wp){b.state='fight';b.boardingChannel=null;return;}const d=dist(b.x,b.y,wp.x,wp.y);
    if(d<10)b.i++;else{b.x+=(wp.x-b.x)/d*82*SPD*dt;b.y+=(wp.y-b.y)/d*82*SPD*dt;}return;
  }
  if(b.state==='swing'){
    b.swingT+=dt;const p=clamp(b.swingT/b.dur,0,1),q=1-p,cx=(b.anchor.x+b.to.x)/2-20,cy=Math.min(b.anchor.y,b.to.y)-115;
    b.x=q*q*b.from.x+2*q*p*cx+p*p*b.to.x;b.y=q*q*b.from.y+2*q*p*cy+p*p*b.to.y;
    if(p>=1){b.state='fight';b.boardingChannel=null;}return;
  }
  if(b.state==='climb'){
    b.climbT+=dt;const p=clamp(b.climbT/.75,0,1);b.x=b.x+(b.to.x-b.x)*Math.min(1,dt*5);b.y=b.y+(b.to.y-b.y)*Math.min(1,dt*5);
    if(p>=1){b.state='fight';b.boardingChannel=null;}return;
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
    e.flash=Math.max(0,e.flash-dt);
    if(e.state==='sink'){if(e.contact)clearEnemyContact(e);e.sinkT+=dt;continue;}
    e.rot=0;
    if(e.t.role==='ranged'){
      const ai=enemyAIProfile(e);
      e.rangeRepathT=Math.max(0,(e.rangeRepathT||0)-dt);
      if(e.rangeRepathT<=0){
        if(gunshipLaneBlocked(e,e.rangeY))assignGunshipLane(e,true);
        else e.rangeRepathT=ai.rangeRepath;
      }
      if(e.state==='approach'){
        e.x=Math.max(e.rangeX,e.x-e.t.sp*SPD*dt);
        e.y+=(e.rangeY-e.y)*Math.min(1,dt*.8);
        if(e.x<=e.rangeX+1)e.state='ranged';
      }else if(e.state==='ranged'){
        e.x+=(e.rangeX-e.x)*Math.min(1,dt*.8);
        e.y+=(e.rangeY+Math.sin(g.time*.7+e.ph)*24-e.y)*Math.min(1,dt*.8);
      }
      if((e.state==='approach'||e.state==='ranged')&&e.x<1750){e.shootT-=dt*SPD;if(e.shootT<=0){e.shootT=rand(3.2,4.6);e.flash=.2;const mx=e.x-243*e.s,my=e.y-56*e.s,tx=430+rand(-45,45),ty=560+rand(-190,190),d=dist(mx,my,tx,ty);g.eballs.push({x:mx,y:my,vx:(tx-mx)/d*350,vy:(ty-my)/d*350,life:4});g.fx.push({k:'flash',x:mx-14,y:my,t:0,dur:.2,s:.8});sfx.fire();}}
      continue;
    }
    if(e.state==='approach'||e.state==='hold'){
      const p=contactPointForEnemy(e),c=enemyCollider(e);
      const enterX=p.x+c.rx+470;
      e.x-=e.t.sp*SPD*dt;
      if(e.x<=enterX){
        e.state='closing';e.berthRepathT=0;e.berthWaitT=0;e.berthStallT=0;e.berthLastX=e.x;
        assignBerthingTarget(e,true);
      }
    }else if(e.state==='closing'){
      const ai=enemyAIProfile(e);
      e.berthRepathT=Math.max(0,(e.berthRepathT||0)-dt);
      if(Number.isFinite(e.targetContactY)){
        if(e.berthRepathT<=0){
          if(berthingTargetBlocked(e,e.targetContactY))assignBerthingTarget(e,true);
          else e.berthRepathT=ai.repath;
        }
      }else if(e.berthRepathT<=0)assignBerthingTarget(e,true);

      if(!Number.isFinite(e.targetContactY)){
        e.berthWaitT=(e.berthWaitT||0)+dt;
        const c=enemyCollider(e),p=contactPointForEnemy(e);
        const waitX=p.x+c.rx+(e.type==='manowar'?290:215);
        const waitSpeed=Math.max(10,e.t.sp*ai.waitSpeed)*SPD;
        if(e.x>waitX)e.x=Math.max(waitX,e.x-waitSpeed*dt);
        continue;
      }

      e.berthWaitT=0;
      const ty=e.targetContactY,c=enemyCollider(e);
      const lateralSpeed=Math.max(36,e.t.sp*ai.lateral)*SPD;
      e.y=clamp(e.y+clamp(ty-e.y,-lateralSpeed*dt,lateralSpeed*dt),245,875);

      const p=contactPointAtY(e,ty);
      const targetX=p.x+c.rx-PLAYER_COLLIDER.skin;
      const gap=Math.max(0,e.x-targetX);
      const aligned=Math.abs(e.y-ty)<=Math.max(10,c.ry*.22);
      const forwardFactor=(aligned?1:.55)*ai.forward;
      const speed=Math.max(24,e.t.sp*clamp(gap/360,.28,.72))*SPD*forwardFactor;
      e.x=Math.max(targetX,e.x-speed*dt);
      constrainEnemyOutsidePlayer(e);

      if(aligned&&lockEnemyContact(e)){
        e.state='docked';e.deployT=.18;e.clearT=0;
        g.warnT=3.5;sfx.alarm();
      }
    }else if(e.state==='docked'){
      e.rot=0;
      if(!e.contact||!Number.isFinite(e.contactX)||!Number.isFinite(e.contactY)){
        clearEnemyContact(e);e.state='closing';assignBerthingTarget(e,true);continue;
      }
      const c=enemyCollider(e);
      e.x=e.contactX+c.rx-PLAYER_COLLIDER.skin;
      e.y+=(e.contactY-e.y)*Math.min(1,dt*4);

      if(e.deployed<e.t.pir){
        e.deployT-=dt*SPD;
        if(e.deployT<=0){
          if(deployBoarder(e)){
            e.deployed++;
            e.deployT=e.type==='manowar'&&chooseBoardingChannel(e)>=0?.16:.12;
          }else e.deployT=.12;
        }
      }else if(!g.boarders.some(b=>b.ship===e&&b.hp>0)){
        e.clearT+=dt;
        if(e.clearT>1.0){clearEnemyContact(e);e.state='retreat';}
      }else e.clearT=0;
    }else if(e.state==='retreat'){
      clearEnemyContact(e);e.rot=0;
      e.x+=e.t.sp*.9*dt;
      if(e.x>2180)e.gone=true;
    }
  }

  resolveEnemyShipCollisions();
  for(const e of g.enemies){
    if(e.state!=='closing'||!Number.isFinite(e.targetContactY))continue;
    const p=contactPointAtY(e,e.targetContactY),c=enemyCollider(e);
    const gap=Math.max(0,e.x-(p.x+c.rx-PLAYER_COLLIDER.skin));
    if(Number.isFinite(e.berthLastX)&&gap>45&&Math.abs(e.x-e.berthLastX)<.08)e.berthStallT=(e.berthStallT||0)+dt;
    else e.berthStallT=Math.max(0,(e.berthStallT||0)-dt*.5);
    e.berthLastX=e.x;
    const stallLimit=Math.max(.55,enemyAIProfile(e).repath*1.4);
    if(e.berthStallT>stallLimit){e.berthStallT=0;assignBerthingTarget(e,true);}
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