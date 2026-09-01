/* V6.7：我方增援 4 名近战水手；敌方远程炮击彻底关闭。 */

/* V6.7 CREW + NO ENEMY RANGED FIRE START */
const V67_SAILORS=[
  {id:'sailor1',x:352,y:470,hp:105,rg:82,dmg:18,itv:.92,band:'#516b78'},
  {id:'sailor2',x:520,y:472,hp:105,rg:82,dmg:18,itv:.92,band:'#6b604d'},
  {id:'sailor3',x:340,y:640,hp:110,rg:82,dmg:19,itv:.96,band:'#4f6970'},
  {id:'sailor4',x:520,y:792,hp:110,rg:82,dmg:19,itv:.96,band:'#72584a'},
];

function isV67Sailor(c){return !!(c&&c.id&&c.id.startsWith('sailor'));}
function makeV67CrewState(c){
  return {...c,max:c.hp,alive:true,atkT:rand(0,.5),anim:0,flash:0,homeX:c.x,homeY:c.y};
}

for(const s of V67_SAILORS){
  if(!CREW_DEF.some(c=>c.id===s.id))CREW_DEF.push({...s});
}
if(g&&Array.isArray(g.crew)){
  for(const s of V67_SAILORS)if(!g.crew.some(c=>c.id===s.id))g.crew.push(makeV67CrewState(s));
}

/* 炮舰仍保留航位 AI 与战场占位，但不再被标记为可开火单位。 */
TYPES.gunship.shoot=false;

/* 从敌方炮弹数组入口直接禁止生成；每次 update 前后重装，防止旧逻辑 filter() 换掉数组。 */
function suppressEnemyRangedFire(state){
  if(!state||!Array.isArray(state.eballs))return state;
  state.eballs.length=0;
  state.eballs.push=function(){return this.length;};
  return state;
}
suppressEnemyRangedFire(g);

const _newGameV67=newGame;
newGame=function(){
  const state=_newGameV67();
  suppressEnemyRangedFire(state);
  return state;
};

const _updateV67NoEnemyRanged=update;
update=function(dt){
  suppressEnemyRangedFire(g);
  _updateV67NoEnemyRanged(dt);
  suppressEnemyRangedFire(g);
};

/* V6.6 甲板 AI 对新增水手明确采用近战拦截距离。 */
const _crewCombatProfileV67=crewCombatProfile;
crewCombatProfile=function(c){
  if(isV67Sailor(c))return {min:18,preferred:36,speed:88};
  return _crewCombatProfileV67(c);
};

/* 新水手使用独立近战外观，不再落入旧版鼓手默认造型。 */
const _drawCrewV67=drawCrew;
drawCrew=function(c){
  if(!isV67Sailor(c)||!c.alive)return _drawCrewV67(c);
  const lunge=c.anim>0?c.anim/.3:0;
  const n=Number(c.id.slice(-1))||1;
  const body=n%2?'#536f7a':'#78654e';
  const band=n%2?'#2f4c58':'#5e4737';
  figureBody(c.x,c.y,body);
  ctx.save();ctx.translate(c.x+13,c.y+1);ctx.rotate(-.7+lunge*1.35);
  ctx.strokeStyle='#d8dde3';ctx.lineWidth=5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(18,-7,27,6);ctx.stroke();
  ctx.fillStyle='#d9a213';circle(0,0,4);ctx.fill();ctx.restore();
  figureHead(c.x,c.y,'band',band);
  if(c.flash>0){ctx.fillStyle='rgba(255,60,40,'+(c.flash*1.6)+')';circle(c.x,c.y-4,22);ctx.fill();}
  if(g.rallyT>0){ctx.strokeStyle='rgba(255,204,51,'+(0.4+0.3*Math.sin(g.time*8))+')';ctx.lineWidth=3;circle(c.x,c.y-4,30);ctx.stroke();}
};

/* HUD 旧头像映射只认识 4 个职业；绘制状态卡时临时给水手一个兼容头像角色，逻辑 ID 随后立即恢复。 */
if(typeof drawHUD==='function'){
  const _drawHUDV67=drawHUD;
  drawHUD=function(){
    const changed=[];
    for(const c of g.crew)if(isV67Sailor(c)){changed.push([c,c.id]);c.id='captain';}
    try{return _drawHUDV67();}
    finally{for(const [c,id] of changed)c.id=id;}
  };
}

/* V6.7 战斗菜单。 */
if(typeof drawMenu==='function'){
  drawMenu=function(){
    overlay();txt('大 航 海 时 代',960,280,110,'#ffffff','#5f3a17',14);txt('V6.7 · 甲板增援',960,365,38,'#ffd23e','#5f3a17',6);
    const lines=['👥 我方船员由 4 人增加到 8 人，新增 4 名近战水手',
      '⚔️ 新水手会主动分散拦截登船海盗并参与围攻',
      '🚫 敌方炮舰保留航行与战场占位，但彻底停止远程开火',
      '💥 敌方不再生成炮弹，旗舰不会再承受敌方远程炮击',
      '🪝 V6.3～V6.6 的智能接舷、登船队列与近战 AI 全部保留'];
    lines.forEach((l,i)=>txt(l,960,445+i*48,25,'#e8f4fb','#0e3a52',5));
    bigButton(BTN_START,'开始连续海战！');txt('8 人甲板防线 · 敌方仅靠接舷海盗造成伤害',960,835,20,'#9cc4d8',null,0);
  };
}
/* V6.7 CREW + NO ENEMY RANGED FIRE END */
