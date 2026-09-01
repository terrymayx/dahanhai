/* ================= 关卡系统 ================= */
const LEVEL_TOTAL=10;
function levelHpScale(level){return 1+Math.max(0,level-1)*0.15;}
function levelBoarderScale(level){return 1+Math.max(0,level-1)*0.10;}
function levelSpawnDelayScale(level){return Math.max(0.55,1-Math.max(0,level-1)*0.05);}
function levelExtraEnemies(level){return Math.floor(Math.max(0,level-1)/2);}

const _newGameLevel=newGame;
newGame=function(){
  const state=_newGameLevel();
  state.level=1;state.levelPopT=0;state.levelsCleared=0;
  return state;
};
if(g.level==null){g.level=1;g.levelPopT=0;g.levelsCleared=0;}

const _startWaveLevel=startWave;
startWave=function(n){
  _startWaveLevel(n);
  const pace=levelSpawnDelayScale(g.level);
  g.spawnT*=pace;
  for(const q of g.spawnQueue)q.delay*=pace;
  const extra=levelExtraEnemies(g.level);
  if(extra>0){
    const pool=g.level>=7?['gunship','sloop','manowar']:g.level>=4?['sloop','gunship','manowar']:['sloop','gunship'];
    for(let i=0;i<extra;i++){
      const type=pool[(g.wave+i+g.level)%pool.length];
      g.spawnQueue.push({type,delay:rand(0.7,1.4)*pace});
    }
  }
};

const _spawnEnemyLevel=spawnEnemy;
spawnEnemy=function(type){
  const before=g.enemies.length;
  _spawnEnemyLevel(type);
  const e=g.enemies[g.enemies.length-1];
  if(g.enemies.length>before&&e){
    const scale=levelHpScale(g.level);
    e.hp=Math.round(e.hp*scale);e.max=e.hp;
  }
};

const _deployBoarderLevel=deployBoarder;
deployBoarder=function(e){
  const before=g.boarders.length;
  const deployed=_deployBoarderLevel(e);
  if(!deployed)return false;
  const scale=levelBoarderScale(g.level);
  for(let i=before;i<g.boarders.length;i++){
    g.boarders[i].hp=Math.round(g.boarders[i].hp*scale);
    g.boarders[i].max=g.boarders[i].hp;
  }
  return true;
};

function prepareNextLevel(){
  g.level++;
  g.levelsCleared=g.level-1;
  g.levelPopT=3.2;
  g.wave=0;g.breakT=0;g.focus=null;
  g.player.hp=Math.min(g.player.max,g.player.hp+Math.round(g.player.max*0.4));
  for(const c of g.crew){c.alive=true;c.hp=Math.max(Math.round(c.max*0.7),c.hp);c.x=c.homeX;c.y=c.homeY;c.flash=0;c.anim=0;}
  for(const s of g.sk)s.cd=0;
  g.boarders.length=0;g.eballs.length=0;
  g.state='playing';
  startWave(1);
  g.texts.push({x:960,y:310,str:'第 '+g.level+' 关 开始！',t:2.0,color:'#ffd23e',size:42});
}

const _updateLevel=update;
update=function(dt){
  g.levelPopT=Math.max(0,(g.levelPopT||0)-dt);
  _updateLevel(dt);
  if(g.state==='win'&&g.level<LEVEL_TOTAL)prepareNextLevel();
};

const _drawHUDLevel=drawHUD;
drawHUD=function(){
  _drawHUDLevel();
  if(g.state!=='menu'){
    woodPanel(300,30,220,64,14);
    txt('第 '+g.level+'/'+LEVEL_TOTAL+' 关',410,72,29,'#4a2c10');
    if(g.levelPopT>0){
      const a=Math.min(1,g.levelPopT);
      ctx.globalAlpha=a;
      txt('第 '+g.level+' 关',960,150,46,'#ffd23e','#5f3a17',7);
      ctx.globalAlpha=1;
    }
  }
};

const _drawMenuLevel=drawMenu;
drawMenu=function(){
  _drawMenuLevel();
  txt('共 '+LEVEL_TOTAL+' 关 · 每关 '+WAVE_TOTAL+' 波 · 后续关卡敌军逐渐强化',960,875,21,'#d7f3ff','#0e3a52',4);
};

const _drawEndLevel=drawEnd;
drawEnd=function(win){
  _drawEndLevel(win);
  if(win)txt('已通关 '+LEVEL_TOTAL+' 关 · 共 '+(LEVEL_TOTAL*WAVE_TOTAL)+' 波',960,555,26,'#d7f3ff','#0e3a52',5);
  else txt('止步第 '+g.level+' 关 · 第 '+Math.max(1,g.wave)+' 波',960,555,26,'#d7f3ff','#0e3a52',5);
};
