from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
html_path = ROOT / 'index.html'
guard_path = ROOT / 'guard.js'
readme_path = ROOT / 'README_操作说明.txt'


def replace_section(text, start_marker, end_marker, replacement):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'missing start marker: {start_marker}')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'missing end marker: {end_marker}')
    return text[:start] + replacement.rstrip() + '\n' + text[end:]


html = html_path.read_text(encoding='utf-8')
html = re.sub(r'<meta name="build"[^>]*>\s*', '', html)
html = html.replace('</head>', '<meta name="build" content="deck-guard-ranged-approach-2026-09-07">\n</head>')
html_path.write_text(html, encoding='utf-8')

guard = guard_path.read_text(encoding='utf-8')
if 'ALLIED_SHOOTERS=60' not in guard or 'ALLIED_DEFENDERS=60' not in guard:
    raise SystemExit('expected 10x mass-crew source before ranged-approach migration')

ship_cfg = """const SHIP_CFG={
 skiff:{name:'快速运兵艇',hp:165,speed:102,crew:30,boarders:40,connectHp:72,size:.72,range:780},
 support:{name:'远程掩护艇',hp:170,speed:88,crew:50,boarders:20,connectHp:70,size:.78,range:920,support:true},
 medium:{name:'中型运兵船',hp:330,speed:78,crew:50,boarders:80,connectHp:115,size:.9,range:850},
 large:{name:'大型登船舰',hp:540,speed:62,crew:70,boarders:140,connectHp:125,size:1.08,range:900,connections:2}
};
const LIGHT_RANGE={bow:720,musket:820};"""
guard = replace_section(guard, 'const SHIP_CFG=', 'let width=', ship_cfg)

# Give all player melee crew stable homes; their visible movement is a small local patrol around those homes.
player_block = """function makeDefender(i,side,reserve=false){
 const group=reserve?i-40:side==='lower'?i-20:i;let x,y;
 if(reserve){x=-86+(group%10)*18;y=Math.floor(group/10)===0?-15:15;}
 else{x=-96+(group%10)*20;const row=Math.floor(group/10);y=(side==='upper'?-1:1)*(45-row*12);}
 return{id:'pD'+i,team:'player',kind:'melee',lx:x,ly:y,homeLx:x,homeLy:y,motionId:i,x,y,hp:72,maxHp:72,alive:true,down:false,reserve,zone:reserve?'center':side,targetZone:reserve?'center':side,cd:.2+(i%10)*.045,action:'idle',timer:0,facing:0,role:'melee',rescue:0};
}
function playerShip(){
 const p={id:0,team:'player',x:PLAYER_X,y:PLAYER_Y,a:0,hp:520,maxHp:520,water:0,sail:100,sink:0,dead:false,gunHp:{upper:150,lower:150},gunMax:150,breaches:[],recoil:{upper:0,lower:0}};
 p.shooters=Array.from({length:ALLIED_SHOOTERS},(_,i)=>makeShooter(i));
 p.defenders=[...Array.from({length:20},(_,i)=>makeDefender(i,'upper')),...Array.from({length:20},(_,i)=>makeDefender(i+20,'lower')),...Array.from({length:20},(_,i)=>makeDefender(i+40,'center',true))];
 return p;
}"""
guard = replace_section(guard, 'function makeDefender(', 'function enemyCrew(', player_block)

guard = guard.replace(
    "function makeShooter(i){const b=SHOOTERS[i];return{id:'pS'+i,team:'player',kind:b.kind,lx:b.x,ly:b.y,homeLx:b.x,homeLy:b.y,x:b.x,y:b.y,hp:b.kind==='musket'?38:31,maxHp:b.kind==='musket'?38:31,alive:true,cd:.15+i*(b.kind==='bow'?.21:.37),action:'idle',timer:0,facing:0,recoil:0,role:'shooter'};}",
    "function makeShooter(i){const b=SHOOTERS[i];return{id:'pS'+i,team:'player',kind:b.kind,lx:b.x,ly:b.y,homeLx:b.x,homeLy:b.y,motionId:i,x:b.x,y:b.y,hp:b.kind==='musket'?38:31,maxHp:b.kind==='musket'?38:31,alive:true,cd:.15+i*(b.kind==='bow'?.21:.37),action:'idle',timer:0,facing:0,recoil:0,role:'shooter'};}"
)
if 'motionId:i' not in guard:
    raise SystemExit('player shooter motion patch failed')

enemy_crew = """function enemyCrew(ship,i){
 const kind=i%3===2?'musket':'bow',cols=10,row=Math.floor(i/cols),col=i%cols;
 const lx=-82+col*18+(row%2?4:0),ly=clamp(-32+row*10,-34,34);
 return{id:`e${ship.id}c${i}`,team:'enemy',kind,hp:kind==='musket'?28:24,maxHp:kind==='musket'?28:24,alive:true,cd:.18+(i%9)*.055,lx,ly,homeLx:lx,homeLy:ly,motionId:i,facing:Math.PI,action:'idle',timer:0,recoil:0};
}"""
guard = replace_section(guard, 'function enemyCrew(', 'function roster(', enemy_crew)

# Spawn farther away so the approach is readable and supports a real ranged-combat window.
guard = re.sub(
    r"function makeEnemy\(type,side,spawnOffset=0\)\{const cfg=SHIP_CFG\[type\],sign=side==='upper'\?-1:1,x=PLAYER_X\+980\+spawnOffset,y=PLAYER_Y\+sign\*390;const ship=\{",
    "function makeEnemy(type,side,spawnOffset=0){const cfg=SHIP_CFG[type],sign=side==='upper'?-1:1,x=PLAYER_X+1180+spawnOffset,y=PLAYER_Y+sign*410;const ship={",
    guard,
    count=1,
)
guard = guard.replace("side,phase:'approach',phaseTime:0,", "side,phase:'approach',approachStage:'ranged',phaseTime:0,")
if "approachStage:'ranged'" not in guard:
    raise SystemExit('enemy approach stage patch failed')

approach_fn = """function updateEnemyShip(ship,dt){
 if(ship.removed)return;
 if(ship.sinking){ship.sinkTimer+=dt;ship.sink=clamp(ship.sinkTimer/3.5,0,1);ship.x-=35*dt;if(Math.random()<dt*8)splash(ship.x+rand(-60,60),ship.y+rand(-28,28));if(ship.sink>=1){ship.removed=true;state.metrics.shipsSunk++;}return;}
 ship.tagTime=Math.max(0,ship.tagTime-dt);ship.fireCd-=dt;const sign=ship.side==='upper'?-1:1;
 updateEnemyCrewMotion(ship,dt);
 if(ship.phase==='approach'){
  const tx=PLAYER_X+120+(ship.type==='support'?240:0),ty=PLAYER_Y+sign*(ship.type==='support'?305:210);
  const dx=tx-ship.x,dy=ty-ship.y,d=Math.hypot(dx,dy)||1;
  ship.approachStage=C.guardApproachStage(d);
  const v=C.guardApproachSpeed(ship.type,d);
  ship.x+=dx/d*v*dt;ship.y+=dy/d*v*dt;
  ship.a=C.rotateToward(ship.a,0,dt*.72);
  if(d<58){ship.phase=ship.cfg.support?'support':'align';ship.phaseTime=0;}
 }
 else if(ship.phase==='align'){
  ship.approachStage='align';ship.phaseTime+=dt;
  ship.x+=(PLAYER_X+80-ship.x)*dt*.42;ship.y+=(PLAYER_Y+sign*210-ship.y)*dt*.4;
  if(ship.phaseTime>1.65){const possible=ship.connections.find(c=>!c.broken&&c.phase==='idle');if(possible&&C.connectionOpenAllowed(openCount(possible),MAX_OPEN)){possible.phase='building';ship.phase='connect';ship.phaseTime=0;toast(ship.cfg.name+' 开始建立'+(ship.side==='upper'?'上舷':'下舷')+'连接',1.7);}else ship.phase='waiting';}
 }
 else if(ship.phase==='waiting'){ship.approachStage='waiting';ship.x+=Math.sin(state.time*.8+ship.id)*5*dt;ship.y+=(PLAYER_Y+sign*285-ship.y)*dt*.32;if(C.connectionOpenAllowed(openCount(),MAX_OPEN)){ship.phase='align';ship.phaseTime=0;}}
 else if(ship.phase==='connect'||ship.phase==='boarding'){
  ship.approachStage='alongside';ship.x+=(PLAYER_X+80-ship.x)*dt*.5;ship.y+=(PLAYER_Y+sign*210-ship.y)*dt*.5;let any=false;
  for(const c of ship.connections){if(c.broken)continue;if(c.phase==='building'){c.progress=C.boardingAdvance(c.progress,dt,2.25+(ship.type==='large'?0.6:0));if(c.progress>=1){c.phase='open';c.open=true;state.openEntrances=openCount();ship.phase='boarding';c.spawnCd=.25;toast('跳板已架好 · '+(ship.side==='upper'?'上舷':'下舷')+'开始登船',1.5);}any=true;}else if(c.open){any=true;updateConnectionBoarding(ship,c,dt);}}
  if(ship.phase==='boarding'&&ship.type==='large'&&ship.connections.length>1){const second=ship.connections[1];if(!second.broken&&second.phase==='idle'&&ship.launched>=28&&C.connectionOpenAllowed(openCount(),MAX_OPEN)){second.phase='building';second.progress=0;toast('大型登船舰准备第二处连接',1.4);}}
  if(!any||ship.remaining<=0&&ship.connections.every(c=>c.crossing.length===0)){for(const c of ship.connections){if(!c.broken){c.open=false;c.phase='idle';c.progress=0;}}ship.phase='withdraw';ship.phaseTime=0;}
 }
 else if(ship.phase==='support'){ship.approachStage='ranged';ship.x+=(PLAYER_X+300-ship.x)*dt*.22;ship.y+=(PLAYER_Y+sign*300-ship.y)*dt*.22;if(ship.hp<ship.maxHp*.45)ship.phase='withdraw';}
 else if(ship.phase==='withdraw'){ship.approachStage='withdraw';ship.phaseTime+=dt;ship.x+=125*dt;ship.y+=sign*24*dt;if(ship.x>PLAYER_X+1250)ship.removed=true;}
 const range=Math.hypot(ship.x-PLAYER_X,ship.y-PLAYER_Y);
 if(!ship.sinking&&ship.phase!=='withdraw'&&ship.fireCd<=0&&range<ship.cfg.range){const rangedCadence=ship.approachStage==='ranged'?rand(.26,.46):rand(.3,.52);ship.fireCd=rangedCadence;enemyLightFire(ship);}
}"""
guard = replace_section(guard, 'function updateEnemyShip(', 'function updateConnectionBoarding(', approach_fn)

# Enemy deck crew now walk subtly around their posts, turn toward the player, and visibly animate when firing.
enemy_fire = """function updateEnemyCrewMotion(ship,dt){
 for(const c of ship.crew){if(!c.alive)continue;c.recoil=Math.max(0,(c.recoil||0)-dt);if(c.timer>0){c.timer-=dt;if(c.timer<=0)c.action='idle';}
  const off=C.crewMotionOffset(c.motionId,state.time,'enemy'),goal={x:c.homeLx+off.x,y:c.homeLy+off.y};
  const mv=C.reserveStep({x:c.lx,y:c.ly},goal,c.action==='fire'?8:14,dt);c.lx=mv.x;c.ly=mv.y;
  if(c.action!=='fire'){const from=worldLocal(ship,c.lx,c.ly);c.facing=Math.atan2(PLAYER_Y-from.y,PLAYER_X-from.x);}
 }
}
function enemyLightFire(ship){const crew=ship.crew.filter(c=>c.alive);if(!crew.length)return;const c=crew[Math.floor(Math.random()*crew.length)],from=worldLocal(ship,c.lx,c.ly),targets=[...state.player.shooters,...state.player.defenders].filter(u=>u.alive&&!u.down);if(!targets.length)return;let t=null,bd=Infinity;for(const u of targets){const dd=threatDistance(ship,u);if(dd<bd){bd=dd;t=u;}}if(!t)return;const to=worldLocal(state.player,t.lx,t.ly);c.facing=Math.atan2(to.y-from.y,to.x-from.x);c.action='fire';c.timer=c.kind==='musket'?.22:.16;c.recoil=c.kind==='musket'?.18:.08;spawnLight(c.kind,from,to,true,{ship,crew:c,target:t});}"""
guard = replace_section(guard, 'function enemyLightFire(', 'function threatDistance(', enemy_fire)

shooters_fn = """function updateShooters(dt){for(const s of state.player.shooters){if(!s.alive)continue;const closeThreat=state.boarders.find(b=>!b.dead&&b.state==='deck'&&Math.hypot(b.lx-s.lx,b.ly-s.ly)<34);const off=C.crewMotionOffset(s.motionId,state.time,'shooter'),idlePost={x:s.homeLx+off.x,y:s.homeLy+off.y};if(closeThreat){const retreat={x:Math.max(-145,s.homeLx-30),y:clamp(s.homeLy*.55,-28,28)},mv=C.reserveStep({x:s.lx,y:s.ly},retreat,36,dt);s.lx=mv.x;s.ly=mv.y;}else if(Math.hypot(s.lx-idlePost.x,s.ly-idlePost.y)>.6){const mv=C.reserveStep({x:s.lx,y:s.ly},idlePost,18,dt);s.lx=mv.x;s.ly=mv.y;}s.cd-=dt;s.recoil=Math.max(0,s.recoil-dt);if(s.action!=='idle'){s.timer-=dt;if(s.timer<=0){if(s.action==='aim'){const from=worldLocal(state.player,s.lx,s.ly),t=nearestPlayerTarget(from),range=LIGHT_RANGE[s.kind]||700;if(t&&Math.hypot(t.x-from.x,t.y-from.y)<range&&!blockedLight(from,t)){s.facing=Math.atan2(t.y-from.y,t.x-from.x);spawnLight(s.kind,from,{x:t.x,y:t.y,z:t.z||30},false,{target:t,shooter:s});s.action='fire';s.timer=s.kind==='bow'?.14:.16;s.recoil=s.kind==='musket'?.16:0;}else{s.action='idle';s.cd=.2;}}else{s.action='idle';s.cd=s.kind==='bow'?rand(.85,1.3):rand(1.75,2.55);}}continue;}if(s.cd<=0){const from=worldLocal(state.player,s.lx,s.ly),near=nearestPlayerTarget(from),range=LIGHT_RANGE[s.kind]||700;if(near&&Math.hypot(near.x-from.x,near.y-from.y)<range){const localThreat=state.boarders.some(b=>!b.dead&&b.state==='deck'&&Math.hypot(b.lx-s.lx,b.ly-s.ly)<30);if(localThreat){s.cd=.55;continue;}s.action='aim';s.timer=s.kind==='bow'?.25:.31;}else s.cd=.22;}}
}"""
guard = replace_section(guard, 'function updateShooters(', 'function blockedLight(', shooters_fn)

# Every melee defender has a real local patrol target. The 20 reserve crew form a visible 5x4 reinforcement block instead of one point.
defenders_fn = """function defenderPost(d){
 const off=C.crewMotionOffset(d.motionId,state.time,'melee');
 if(!d.reserve)return{x:d.homeLx+off.x*.32,y:d.homeLy+off.y*.32};
 const idx=Math.max(0,d.motionId-40),col=idx%5,row=Math.floor(idx/5),base=DEF_ZONES[d.targetZone]||DEF_ZONES.center;
 const sx=(col-2)*11,sy=(row-1.5)*8;
 return{x:base.x+sx+off.x*.2,y:clamp(base.y+sy+off.y*.2,-51,51)};
}
function updateDefenders(dt){for(const d of state.player.defenders){if(d.down){d.rescue+=dt;if(d.rescue>8&&safeAround(d)){d.down=false;d.alive=true;d.hp=Math.max(28,d.maxHp*.42);d.rescue=0;floatText(...Object.values(worldLocal(state.player,d.lx,d.ly)),'救起','#9fe4b7',12);}continue;}if(!d.alive)continue;d.cd=Math.max(0,d.cd-dt);if(d.action==='hit'||d.action==='attack'){d.timer-=dt;if(d.timer<=0)d.action='idle';}
  const targetPos=defenderPost(d);let close=null,closeD=Infinity;for(const e of state.boarders){if(e.dead||e.state!=='deck')continue;const dd=Math.hypot(e.lx-d.lx,e.ly-d.ly);if(dd<closeD){closeD=dd;close=e;}}
  let u=closeD<31?close:null;
  if(!u&&state.targetBoarderId){const manual=state.boarders.find(e=>e.id===state.targetBoarderId&&!e.dead&&e.state==='deck')||null;if(manual&&Math.hypot(manual.lx-d.lx,manual.ly-d.ly)<48)u=manual;}
  if(!u&&closeD<48)u=close;
  if(u&&Math.hypot(u.lx-d.lx,u.ly-d.ly)<29){d.facing=Math.atan2(u.ly-d.ly,u.lx-d.lx);if(d.cd<=0){u.hp=Math.max(0,u.hp-16);u.prep=0;d.cd=.68;d.action='attack';d.timer=.18;floatText(u.x,u.y,16,'#dff0cf',10,'melee'+u.id);if(u.hp<=0){u.dead=true;u.state='dead';state.metrics.boardersKilled++;}}}
  else{const mv=C.reserveStep({x:d.lx,y:d.ly},targetPos,d.reserve?52:18,dt);d.lx=mv.x;d.ly=mv.y;}
 }
}"""
guard = replace_section(guard, 'function updateDefenders(', 'function safeAround(', defenders_fn)

# Draw enemy deck crew with visible facing/weapon motion rather than static dots only.
draw_enemy = """function drawEnemyCrew(ship){for(const c of ship.crew){const p=worldLocal(ship,c.lx,c.ly),q=project(p.x,p.y,31),sz=4.2*scale*(ship.cfg?.size||1);ctx.fillStyle=c.alive?'#c84d43':'#5b3b35';ctx.beginPath();ctx.arc(q.x,q.y,sz,0,TAU);ctx.fill();if(c.alive){const len=c.kind==='musket'?16:12,end=project(p.x+Math.cos(c.facing)*len,p.y+Math.sin(c.facing)*len,32);ctx.strokeStyle=c.kind==='musket'?'#2b3033':'#70442a';ctx.lineWidth=(c.kind==='musket'?2.2:1.5)*scale;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(end.x,end.y);ctx.stroke();if(c.action==='fire'&&c.kind==='musket'){ctx.fillStyle='#ffd27a';ctx.beginPath();ctx.arc(end.x,end.y,2.4*scale,0,TAU);ctx.fill();}}}}"""
guard = replace_section(guard, 'function drawEnemyCrew(', 'function drawDeckObstacles(', draw_enemy)

# Small UI copy update: the player should understand that incoming ships fight before docking.
guard = guard.replace('射手拦截 → 靠舷登船 → 调动预备队 → 重炮断援', '远程交火 → 敌船逼近 → 靠舷登船 → 调兵守甲板 → 重炮断援')
guard = guard.replace('持续航行 · 守住上下船舷，重炮留给关键增援', '持续航行 · 先远程交火，敌船会逐步逼近再靠舷')

guard_path.write_text(guard, encoding='utf-8')

if readme_path.exists():
    text = readme_path.read_text(encoding='utf-8')
    marker='【远程交火接近版】'
    if marker not in text:
        text += '\n\n'+marker+'\n- 敌船从更远处出现，按小艇/中船/大船不同速度逐步逼近，不再高速冲到船边。\n- 接近分为远程交火、减速闭合、靠舷调整三个阶段；通常在靠舷前会有数秒持续箭火与火枪战。\n- 我方60名射手、60名近战及敌舰远程船员都有轻量甲板移动；预备队到达防区后形成分散队形。\n- 敌舰靠舷后继续保持相对位置，跳板和登船流程保持原规则。\n'
        readme_path.write_text(text, encoding='utf-8')

print('patched paced ranged approach and moving deck crew')
