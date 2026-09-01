/* V6.9：无限运兵船潮。无关卡、15 秒固定来一波、所有敌舰接舷运兵、弓箭手持续自动射击。 */

/* V6.9 ENDLESS TROOP WAVES START */
const V69_WAVE_INTERVAL=15;

/* 三种敌舰全部转为运兵接舷舰。保留外观、体型、速度和耐久差异。 */
Object.assign(TYPES.sloop,{pir:3,role:'board',shoot:false,name:'突击运兵艇'});
Object.assign(TYPES.gunship,{pir:5,role:'board',shoot:false,name:'中型运兵舰'});
Object.assign(TYPES.manowar,{pir:8,role:'heavy',shoot:false,name:'巨型运兵舰'});

function v69WaveShipCount(wave){
  return Math.min(10,3+Math.floor((wave-1)/2));
}
function v69WaveTypes(wave){
  const count=v69WaveShipCount(wave),out=[];
  for(let i=0;i<count;i++){
    if(wave>=4&&(i+wave)%5===0)out.push('manowar');
    else if(wave>=2&&(i+wave)%3===0)out.push('gunship');
    else out.push('sloop');
  }
  return out;
}
function initV69State(state){
  if(!state)return state;
  state.endlessWaves=true;
  state.wave=0;
  state.waveClock=0;
  state.nextWaveIn=V69_WAVE_INTERVAL;
  state.v69ArcherT=.18;
  state.breakT=0;
  state.spawnQueue=[];
  state.spawnT=0;
  return state;
}

const _newGameV69=newGame;
newGame=function(){
  return initV69State(_newGameV69());
};
initV69State(g);

function startV69Wave(wave){
  wave=Math.max(1,Math.floor(wave||1));
  g.wave=wave;
  g.wavePopT=2.2;
  const types=v69WaveTypes(wave);
  for(let i=0;i<types.length;i++){
    const before=g.enemies.length;
    spawnEnemy(types[i]);
    const e=g.enemies[g.enemies.length-1];
    if(g.enemies.length>before&&e){
      e.x=2070+i*74+rand(-18,18);
      e.y=clamp(e.y+((i%2)?28:-28),250,870);
      e.v69Wave=wave;
    }
  }
  g.warnT=Math.max(g.warnT,.8);
  g.texts.push({x:960,y:285,str:'第 '+wave+' 波来袭！',t:1.3,color:'#ffd23e',size:38});
  return types.length;
}

/* 输入层仍调用 startWave(1)。后续波次只由 15 秒战斗时钟触发，绝不因清场提前。 */
startWave=function(n){
  if(g.wave===0&&Math.max(1,n||1)===1){
    g.waveClock=0;g.nextWaveIn=V69_WAVE_INTERVAL;
    return startV69Wave(1);
  }
  return false;
};

function nearestV69(list,x,y){
  let best=null,bestD=Infinity;
  for(const o of list){
    const d=dist(x,y,o.x,o.y);
    if(d<bestD){best=o;bestD=d;}
  }
  return best;
}
function chooseV69ArcherTarget(){
  const archer=g.crew.find(c=>c.id==='archer'&&c.alive);
  if(!archer)return null;

  const fight=g.boarders.filter(b=>b.hp>0&&b.state==='fight');
  if(fight.length)return {kind:'boarder',target:nearestV69(fight,archer.x,archer.y)};

  const transit=g.boarders.filter(b=>b.hp>0&&(b.state==='plank'||b.state==='swing'||b.state==='climb'));
  if(transit.length)return {kind:'boarder',target:nearestV69(transit,archer.x,archer.y)};

  const ships=g.enemies.filter(e=>e.state!=='sink'&&!e.gone);
  if(ships.length)return {kind:'ship',target:nearestV69(ships,archer.x,archer.y)};
  return null;
}
function fireV69Archer(){
  const archer=g.crew.find(c=>c.id==='archer'&&c.alive),pick=chooseV69ArcherTarget();
  if(!archer||!pick||!pick.target)return false;
  const t=pick.target;
  archer.anim=.3;
  if(pick.kind==='boarder'){
    g.fx.push({k:'line',x:archer.x,y:archer.y,x2:t.x,y2:t.y,t:0,dur:.15});
    damageBoarder(t,archer.dmg,t.x,t.y);sparkFx(t.x,t.y,.6);sfx.arrow();
    return true;
  }
  const d=dist(archer.x,archer.y,t.x,t.y)||1;
  g.arrows.push({x:archer.x+30,y:archer.y-6,vx:(t.x-archer.x)/d*950,vy:(t.y-archer.y)/d*950,dmg:archer.dmg});
  sfx.arrow();return true;
}

const _updateV69=update;
update=function(dt){
  const archer=g.crew.find(c=>c.id==='archer');
  let oldArcherAtk=null;
  if(archer&&archer.alive){
    /* 禁用旧更新循环自己的弓箭攻击，只保留 V6.6 的站位移动。 */
    oldArcherAtk=archer.atkT;
    archer.atkT=9999;
  }

  /* 阻止旧“清空 -> 下一波/胜利”逻辑提前推进；真正推进只看 15 秒时钟。 */
  if(!g.spawnQueue.length&&!g.enemies.length&&!g.boarders.length)g.breakT=999;
  _updateV69(dt);

  if(archer&&oldArcherAtk!==null)archer.atkT=oldArcherAtk;
  if(g.state==='win')g.state='playing';

  g.waveClock=(g.waveClock||0)+dt;
  while(g.waveClock>=V69_WAVE_INTERVAL){
    g.waveClock-=V69_WAVE_INTERVAL;
    startV69Wave(Math.max(1,g.wave+1));
  }
  g.nextWaveIn=Math.max(0,V69_WAVE_INTERVAL-g.waveClock);

  const liveArcher=g.crew.find(c=>c.id==='archer'&&c.alive);
  if(liveArcher){
    const drum=g.crew.find(c=>c.id==='drummer'&&c.alive);
    const rate=(g.rallyT>0?2:1)*(drum?1.3:1);
    g.v69ArcherT=(g.v69ArcherT??.18)-dt*rate;
    if(g.v69ArcherT<=0){
      if(fireV69Archer())g.v69ArcherT=Math.max(.28,liveArcher.itv);
      else g.v69ArcherT=.12;
    }
  }else g.v69ArcherT=.18;
};

/* 用 V6.9 波次倒计时覆盖旧的“第 N/6 波”区域。 */
const _drawHUDV69=drawHUD;
drawHUD=function(){
  _drawHUDV69();
  if(g.state==='menu')return;
  const sec=Math.max(0,g.nextWaveIn??V69_WAVE_INTERVAL).toFixed(1);
  if(!boardingMode()){
    woodPanel(770,24,420,76,14);
    txt('第 '+Math.max(1,g.wave)+' 波 · 下一波 '+sec+'s',980,73,29,'#4a2c10');
  }else{
    woodPanel(1260,30,230,64,14);
    txt('波 '+Math.max(1,g.wave)+' · '+sec+'s',1375,72,24,'#4a2c10');
  }
};

/* V6.9 菜单文案。 */
drawMenu=function(){
  overlay();
  txt('大 航 海 时 代',960,270,106,'#ffffff','#5f3a17',14);
  txt('V6.9 · 无限运兵船潮',960,355,38,'#ffd23e','#5f3a17',6);
  const lines=[
    '🚢 所有敌舰都是运兵接舷舰：3 / 5 / 8 名海盗',
    '⏱️ 没有关卡，固定每 15 秒进入下一波，上一波没打完也继续来',
    '🏹 弓箭手持续自动射击：甲板海盗 → 登船海盗 → 最近敌舰',
    '🌊 波数无限增长；每 2 波增加 1 艘，单波最多 10 艘',
    '🔥 V6.8 木屑、破洞、起火、落海、断板和船潮性能优化全部保留'
  ];
  lines.forEach((l,i)=>txt(l,960,435+i*48,25,'#e8f4fb','#0e3a52',5));
  bigButton(BTN_START,'开始无限船潮！');
  txt('15 秒一波 · 全员接舷 · 无限生存',960,835,21,'#9cc4d8',null,0);
};
/* V6.9 ENDLESS TROOP WAVES END */
