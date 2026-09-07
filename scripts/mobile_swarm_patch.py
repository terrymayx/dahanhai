from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
html_path = ROOT / 'index.html'
guard_path = ROOT / 'guard.js'
css_path = ROOT / 'style.css'
readme_path = ROOT / 'README_操作说明.txt'

# Keep the current deck-guard build, but mark the new 10x crowd version.
html = html_path.read_text(encoding='utf-8')
html = re.sub(r'<meta name="build"[^>]*>\s*', '', html)
html = html.replace('</head>', '<meta name="build" content="deck-guard-mass-crew-10x-2026-09-07">\n</head>')
html_path.write_text(html, encoding='utf-8')

guard = guard_path.read_text(encoding='utf-8')

# Core crowd budgets. 12 visible player combatants in the previous build -> 120 here.
guard = re.sub(
    r"const PLAYER_X=920, PLAYER_Y=1060, PLAYER_SCALE=1\.75, AUTO_SPEED=105, VOLLEY_RELOAD=12, MAX_OPEN=2, MAX_ACTIVE_SHIPS=5, SWARM_TOTAL=14(?:, [^;]+)?;",
    "const PLAYER_X=920, PLAYER_Y=1060, PLAYER_SCALE=1.75, AUTO_SPEED=105, VOLLEY_RELOAD=12, MAX_OPEN=2, MAX_ACTIVE_SHIPS=5, SWARM_TOTAL=14, ALLIED_SHOOTERS=60, ALLIED_DEFENDERS=60, ACTIVE_BOARDER_CAP=220, DECK_PRESSURE_LIMIT=140;",
    guard,
    count=1,
)

# 60 ranged crew: keeps roughly the old 4 bow : 2 musket ratio, spread across the readable deck.
shooters = """const SHOOTERS=Array.from({length:ALLIED_SHOOTERS},(_,i)=>{\n const cols=12,row=Math.floor(i/cols),col=i%cols;\n return{kind:i%3===2?'musket':'bow',x:-132+col*20.5+(row%2?5:0),y:-34+row*17};\n});"""
guard, changed = re.subn(r'const SHOOTERS=\[.*?\n\];(?=\nconst WAVES=)', shooters, guard, count=1, flags=re.S)
if changed != 1 and 'const SHOOTERS=Array.from({length:ALLIED_SHOOTERS}' not in guard:
    raise SystemExit('SHOOTERS patch did not match exactly once')

# Enemy ship headcounts are exactly 10x the previous visible+routed combat roster.
ship_cfg = """const SHIP_CFG={
 skiff:{name:'快速运兵艇',hp:165,speed:155,crew:30,boarders:40,connectHp:72,size:.72,range:500},
 support:{name:'远程掩护艇',hp:170,speed:125,crew:50,boarders:20,connectHp:70,size:.78,range:590,support:true},
 medium:{name:'中型运兵船',hp:330,speed:112,crew:50,boarders:80,connectHp:115,size:.9,range:560},
 large:{name:'大型登船舰',hp:540,speed:88,crew:70,boarders:140,connectHp:125,size:1.08,range:600,connections:2}
};"""
guard, changed = re.subn(r'const SHIP_CFG=\{.*?\n\};(?=\nlet width)', ship_cfg, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('SHIP_CFG patch did not match exactly once')

# Spread 60 defenders: 20 fixed upper, 20 fixed lower, 20 mobile reserve.
player_block = """function makeDefender(i,side,reserve=false){const group=reserve?i-40:side==='lower'?i-20:i;let x,y;if(reserve){x=-86+(group%10)*18;y=Math.floor(group/10)===0?-15:15;}else{x=-96+(group%10)*20;const row=Math.floor(group/10);y=(side==='upper'?-1:1)*(45-row*12);}return{id:'pD'+i,team:'player',kind:'melee',lx:x,ly:y,x,y,hp:72,maxHp:72,alive:true,down:false,reserve,zone:reserve?'center':side,targetZone:reserve?'center':side,cd:.2+(i%10)*.045,action:'idle',timer:0,facing:0,role:'melee',rescue:0};}
function playerShip(){const p={id:0,team:'player',x:PLAYER_X,y:PLAYER_Y,a:0,hp:520,maxHp:520,water:0,sail:100,sink:0,dead:false,gunHp:{upper:150,lower:150},gunMax:150,breaches:[],recoil:{upper:0,lower:0}};p.shooters=Array.from({length:ALLIED_SHOOTERS},(_,i)=>makeShooter(i));p.defenders=[...Array.from({length:20},(_,i)=>makeDefender(i,'upper')),...Array.from({length:20},(_,i)=>makeDefender(i+20,'lower')),...Array.from({length:20},(_,i)=>makeDefender(i+40,'center',true))];return p;}"""
guard, changed = re.subn(r'function makeDefender\(.*?\nfunction playerShip\(\)\{.*?return p;\}', player_block, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('player crew patch did not match exactly once')

# Enemy deck crew uses a compact grid instead of stacking dozens of people on one point.
enemy_crew = """function enemyCrew(ship,i){const kind=i%3===2?'musket':'bow',cols=10,row=Math.floor(i/cols),col=i%cols;return{id:`e${ship.id}c${i}`,team:'enemy',kind,hp:kind==='musket'?28:24,maxHp:kind==='musket'?28:24,alive:true,cd:.18+(i%9)*.055,lx:-82+col*18+(row%2?4:0),ly:clamp(-32+row*10,-34,34),facing:Math.PI,action:'idle',timer:0,recoil:0};}"""
guard, changed = re.subn(r'function enemyCrew\(ship,i\)\{.*?\}', enemy_crew, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('enemyCrew patch did not match exactly once')

# Keep readable unit roles at larger counts: shields lead, breakers are interleaved, assaults fill the wave.
roster = """function roster(type,n){const arr=[];for(let i=0;i<n;i++){let kind='assault';if(type==='large'){if(i<28)kind='shield';else if(i%7===0)kind='breaker';}else if(type==='medium'){if(i<12)kind='shield';else if(i%6===0)kind='breaker';}else if(type==='skiff'){if(i<8)kind='shield';else if(i%9===0)kind='breaker';}else if(type==='support'){if(i<4)kind='shield';else if(i%5===0)kind='breaker';}arr.push(kind);}return arr;}"""
guard, changed = re.subn(r'function roster\(type,n\)\{.*?return arr;\}', roster, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('roster patch did not match exactly once')

# Slightly stagger boarder spawn points so 8-12 simultaneous bridge lanes remain visually readable.
boarder = """function makeBoarder(ship,conn,kind,index){const sign=ship.side==='upper'?-1:1,lane=((index%8)-3.5)*4.5;const start=worldLocal(ship,-38+(index%6)*11+conn.offset*.35,-sign*(48+lane*.22));return{id:nextUnitId++,team:'enemy',kind,shipId:ship.id,connectionId:conn.id,state:'enemyDeck',x:start.x,y:start.y,z:30,lx:0,ly:0,hp:kind==='shield'?92:kind==='breaker'?62:55,maxHp:kind==='shield'?92:kind==='breaker'?62:55,cd:rand(.2,.6),facing:Math.PI,progress:0,dead:false,fall:false,prep:0,targetFacility:null,hitFlash:0};}"""
guard, changed = re.subn(r'function makeBoarder\(ship,conn,kind,index\)\{.*?\}', boarder, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('makeBoarder patch did not match exactly once')

# Larger crowds should not stall later waves at the old 10-person threshold.
guard = guard.replace('deckEnemyCount()<=10&&state.openEntrances<MAX_OPEN', 'deckEnemyCount()<=DECK_PRESSURE_LIMIT&&state.openEntrances<MAX_OPEN')

# Entry throughput scales up, but total simultaneous active boarders is capped for mobile safety.
boarding_fn = """function updateConnectionBoarding(ship,conn,dt){if(conn.broken||!conn.open)return;conn.spawnCd-=dt;const activeBoarders=state.boarders.reduce((n,b)=>n+(!b.dead&&(b.state==='enemyDeck'||b.state==='crossing'||b.state==='deck')?1:0),0);if(activeBoarders>=ACTIVE_BOARDER_CAP){conn.spawnCd=Math.max(conn.spawnCd,.12);return;}const lanes=ship.type==='large'?12:8;const inTransit=state.boarders.filter(b=>!b.dead&&b.connectionId===conn.id&&(b.state==='enemyDeck'||b.state==='crossing')).length;if(conn.spawnCd<=0&&ship.remaining>0&&inTransit<lanes){const kind=ship.boarderRoster[ship.launched]||'assault',b=makeBoarder(ship,conn,kind,ship.launched);state.boarders.push(b);ship.launched++;ship.remaining--;conn.spawnCd=ship.type==='large'?.11:.14;}}"""
guard, changed = re.subn(r'function updateConnectionBoarding\(ship,conn,dt\)\{.*?\n\}', boarding_fn, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('updateConnectionBoarding patch did not match exactly once')

# Large ships open their second bridge only after the first wave is visibly established.
guard = guard.replace("ship.launched>=4&&C.connectionOpenAllowed", "ship.launched>=28&&C.connectionOpenAllowed")

# More visible enemy shooters need a denser but still bounded stream of fire.
guard = guard.replace("ship.fireCd=rand(1.35,2.3);enemyLightFire(ship);", "ship.fireCd=rand(.22,.38);enemyLightFire(ship);")
guard = re.sub(r'fireCd:\.8\+rand\(0,\.8\)', 'fireCd:.18+rand(0,.45)', guard)

# O(n) target scans replace repeated array sorts. This matters once hundreds of units are on deck.
nearest_def = """function nearestDefender(u){let best=null,bd=Infinity;for(const d of state.player.defenders){if(!d.alive||d.down)continue;const dx=d.lx-u.lx,dy=d.ly-u.ly,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=d;}}return best;}"""
guard, changed = re.subn(r'function nearestDefender\(u\)\{.*?\}', nearest_def, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('nearestDefender patch did not match exactly once')

nearest_target = """function nearestPlayerTarget(from){const deck=state.boarders.filter(b=>!b.dead&&(b.state==='crossing'||b.state==='deck'));if(state.targetBoarderId){const m=deck.find(b=>b.id===state.targetBoarderId);if(m)return m;}let best=null,bd=Infinity;for(const b of deck){const dx=b.x-from.x,dy=b.y-from.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=b;}}if(best)return best;for(const s of state.enemies)if(!s.removed&&!s.sinking)for(const c of s.crew)if(c.alive){const p=worldLocal(s,c.lx,c.ly),dx=p.x-from.x,dy=p.y-from.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best={ship:s,crew:c,x:p.x,y:p.y,z:36,remote:true};}}return best;}"""
guard, changed = re.subn(r'function nearestPlayerTarget\(from\)\{.*?\}', nearest_target, guard, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('nearestPlayerTarget patch did not match exactly once')

# Defender targeting also avoids sorting the full enemy array 60 times per frame.
old_def_line = "const enemies=state.boarders.filter(u=>!u.dead&&u.state==='deck').sort((a,b)=>Math.hypot(a.lx-d.lx,a.ly-d.ly)-Math.hypot(b.lx-d.lx,b.ly-d.ly));const u=(state.targetBoarderId&&enemies.find(e=>e.id===state.targetBoarderId))||enemies[0];"
new_def_line = "let u=null,bd=Infinity;if(state.targetBoarderId)u=state.boarders.find(e=>e.id===state.targetBoarderId&&!e.dead&&e.state==='deck')||null;if(!u){for(const e of state.boarders){if(e.dead||e.state!=='deck')continue;const dx=e.lx-d.lx,dy=e.ly-d.ly,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;u=e;}}}"
if old_def_line in guard:
    guard = guard.replace(old_def_line, new_def_line)
elif new_def_line not in guard:
    raise SystemExit('updateDefenders targeting patch did not match')

# UI copy must match the new reserve size.
guard = guard.replace('只移动2名预备近战', '只移动20名预备近战')
guard = guard.replace('调动2名预备近战', '调动20名预备近战')
guard = guard.replace('点击上舷／中央／下舷调动2名预备近战', '点击上舷／中央／下舷调动20名预备近战')

guard_path.write_text(guard, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
if '/* mass-crew-10x */' not in css:
    css += r'''

/* mass-crew-10x */
@media (orientation:landscape) and (max-width:1100px), (orientation:landscape) and (max-height:540px){
  .enemy-live{display:inline-flex;align-items:center;gap:2px}
  .ship-card{background:#062f3bb8}
  #toast{pointer-events:none}
}
'''
css_path.write_text(css, encoding='utf-8')

if readme_path.exists():
    text = readme_path.read_text(encoding='utf-8')
    if '【10倍人海守船版】' not in text:
        text += '\n\n【10倍人海守船版】\n- 我方可见战斗船员从12人提升到120人：60名射手 + 60名近战（含20名预备队）。\n- 敌方各船甲板/登船人员按原配置至少10倍：小艇30远程+40登船，中船50+80，大船70+140。\n- 同时活跃登船人员设220上限；每个入口8条轻量通行槽，大船12条，保持人海感同时控制手机成本。\n- 仍只允许最多2个主要登船入口，重炮、预备队调度和守入口仍然决定战局。\n'
        readme_path.write_text(text, encoding='utf-8')

print('patched 10x mass-crew deck guard demo')
