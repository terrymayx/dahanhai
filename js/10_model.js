/* ================= 数据 ================= */
const TYPES={
  sloop  :{s:0.42,hull:'#8a3b2e',deck:'#a97a55',hp:48 ,sp:118,pir:3,gold:65 ,role:'board', shoot:false,name:'突击艇',colL:190,colB:112},
  gunship:{s:0.56,hull:'#3f4450',deck:'#7d6a55',hp:105,sp:62 ,pir:0,gold:120,role:'ranged',shoot:true ,name:'炮舰',colL:205,colB:122},
  manowar:{s:0.68,hull:'#2e7d4f',deck:'#7fa06a',hp:230,sp:42 ,pir:7,gold:220,role:'heavy', shoot:false,name:'巨舰',colL:225,colB:136},
};
const WAVES=[
  ['sloop','gunship','sloop'],
  ['gunship','sloop','sloop','gunship'],
  ['sloop','gunship','manowar','sloop'],
  ['gunship','sloop','manowar','gunship','sloop'],
  ['sloop','gunship','sloop','manowar','gunship','sloop'],
  ['manowar','gunship','sloop','gunship','sloop','manowar'],
];
const WAVE_TOTAL=WAVES.length;
const CREW_DEF=[
  {id:'captain',x:470,y:706,hp:135,rg:100,dmg:27,itv:0.90,band:'#3a3f4a'},
  {id:'archer' ,x:452,y:362,hp:90 ,rg:455,dmg:13,itv:1.05},
  {id:'gunner' ,x:502,y:612,hp:100,rg:135,dmg:17,itv:1.10,aoe:105},
  {id:'drummer',x:372,y:772,hp:80 ,rg:75 ,dmg:7 ,itv:1.00},
];
const SK=[
  {slot:0,x:1700,y:880,r:62,crew:'gunner',cd:0},
  {slot:1,x:1576,y:838,r:44,crew:'archer',cd:0},
  {slot:2,x:1576,y:980,r:44,crew:'captain',cd:0},
];
const PLAYER_COLLIDER={cx:430,cy:560,rx:172,ry:310,skin:7};
const BTN_PAUSE={x:1856,y:62,r:32};
const BTN_START={x:810,y:648,w:300,h:88};
const BTN_AGAIN ={x:810,y:660,w:300,h:88};
const BTN_RESUME={x:760,y:540,w:400,h:84};
const BTN_RESTART={x:760,y:650,w:400,h:84};

/* ================= 状态 ================= */
let g=null;
function newGame(){
  return {
    state:'menu',time:0,scroll:0,gold:0,kills:0,
    wave:0,wavePopT:0,breakT:0,spawnQueue:[],spawnT:0,
    enemies:[],balls:[],eballs:[],arrows:[],rain:null,boarders:[],
    fx:[],smoke:[],texts:[],foam:[],
    shake:0,hurtT:0,warnT:0,hintT:0,rallyT:0,targetT:0,cannonT:1.4,
    player:{hp:120,max:120},focus:null,
    crew:CREW_DEF.map(c=>({...c,max:c.hp,alive:true,atkT:rand(0,.5),anim:0,flash:0,homeX:c.x,homeY:c.y})),
    sk:SK.map(s=>({...s})),foamT:0,
  };
}
g=newGame();window.G=g;

/* ================= 波次与生成 ================= */
function startWave(n){
  g.wave=n;
  g.spawnQueue=WAVES[n-1].map((t,i)=>({type:t,delay:i===0?0.45:rand(1.15,2.25)*(FAST?0.45:1)}));
  g.spawnT=.45;g.wavePopT=2.2;
  if(n===1)g.hintT=11;
}
function spawnEnemy(type){
  const t=TYPES[type];
  const e={type,t,s:t.s,x:2070,y:rand(250,870),hp:t.hp,max:t.hp,state:'approach',rot:0,
    deployed:0,deployT:0,shootT:rand(2.4,4),flash:0,ph:rand(0,6.28),sinkT:0,clearT:0,contact:false,
    contactX:null,contactY:null,contactNormalX:1,contactNormalY:0,
    rangeX:rand(1260,1510),rangeY:rand(300,820),gone:false};
  g.enemies.push(e);
}
function inShip(e,x,y){
  const hx=200*e.s,hy=145*e.s;
  return Math.abs(x-e.x)<hx&&Math.abs(y-e.y)<hy;
}

/* ================= 船体碰撞层 ================= */
function playerHullRightX(y){
  const ny=(y-PLAYER_COLLIDER.cy)/PLAYER_COLLIDER.ry;
  if(Math.abs(ny)>=1)return PLAYER_COLLIDER.cx;
  return PLAYER_COLLIDER.cx+PLAYER_COLLIDER.rx*Math.sqrt(Math.max(0,1-ny*ny));
}
function enemyCollider(e){
  return {rx:(e.t.colL||200)*e.s,ry:(e.t.colB||120)*e.s};
}
function enemyCollisionRadius(e){
  const c=enemyCollider(e);
  return Math.max(c.rx,c.ry);
}
function clampContactY(y,enemyRy=0){
  const pad=Math.min(70,Math.max(16,enemyRy*.20));
  return clamp(y,PLAYER_COLLIDER.cy-PLAYER_COLLIDER.ry+pad,
                 PLAYER_COLLIDER.cy+PLAYER_COLLIDER.ry-pad);
}
function contactPointForEnemy(e){
  const c=enemyCollider(e);
  const y=clampContactY(e.y,c.ry);
  const x=playerHullRightX(y);
  const nx=Math.max(1e-6,(x-PLAYER_COLLIDER.cx)/(PLAYER_COLLIDER.rx*PLAYER_COLLIDER.rx));
  const ny=(y-PLAYER_COLLIDER.cy)/(PLAYER_COLLIDER.ry*PLAYER_COLLIDER.ry);
  const mag=Math.hypot(nx,ny)||1;
  return {x,y,normalX:nx/mag,normalY:ny/mag};
}
function enemyBowX(e){return e.x-enemyCollider(e).rx;}
function shipsTouchPlayer(e){
  if(!e||e.state==='sink'||e.gone)return false;
  const p=contactPointForEnemy(e);
  const c=enemyCollider(e);
  const verticalOverlap=Math.abs(e.y-p.y)<=Math.max(24,c.ry*.72);
  return verticalOverlap&&enemyBowX(e)<=p.x+PLAYER_COLLIDER.skin+3;
}
function lockEnemyContact(e){
  if(!shipsTouchPlayer(e))return false;
  const p=contactPointForEnemy(e),c=enemyCollider(e);
  const targetX=p.x+c.rx-PLAYER_COLLIDER.skin;
  for(const o of g.enemies){
    if(o===e||o.gone||o.state==='sink'||o.state!=='docked'||!o.contact)continue;
    const oc=enemyCollider(o);
    const overlapX=Math.abs(targetX-o.x)<c.rx+oc.rx;
    const overlapY=Math.abs(p.y-o.y)<c.ry+oc.ry+6;
    if(overlapX&&overlapY)return false;
  }
  e.x=targetX;
  e.contact=true;e.contactX=p.x;e.contactY=p.y;
  e.contactNormalX=p.normalX;e.contactNormalY=p.normalY;
  return true;
}
function clearEnemyContact(e){
  e.contact=false;e.contactX=null;e.contactY=null;
  e.contactNormalX=1;e.contactNormalY=0;
}
function constrainEnemyOutsidePlayer(e){
  if(!e||e.state==='sink'||e.gone||e.t.role==='ranged'||e.state==='docked')return;
  const c=enemyCollider(e),p=contactPointForEnemy(e);
  const minX=p.x+c.rx-PLAYER_COLLIDER.skin;
  if(e.x<minX)e.x=minX;
}
function resolveEnemyShipCollisions(){
  const a=g.enemies.filter(e=>e.state!=='sink'&&!e.gone);
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){
    const A=a[i],B=a[j],ca=enemyCollider(A),cb=enemyCollider(B);
    const dx=B.x-A.x,dy=B.y-A.y;
    const ox=ca.rx+cb.rx-Math.abs(dx),oy=ca.ry+cb.ry-Math.abs(dy);
    if(ox<=0||oy<=0)continue;
    const staticA=A.state==='docked'&&A.contact,staticB=B.state==='docked'&&B.contact;
    if(staticA&&staticB)continue;
    if(ox<oy){
      const dir=dx>=0?1:-1;
      if(staticA)B.x+=dir*ox;
      else if(staticB)A.x-=dir*ox;
      else{A.x-=dir*ox*.5;B.x+=dir*ox*.5;}
    }else{
      const dir=dy>=0?1:-1;
      if(staticA)B.y+=dir*oy;
      else if(staticB)A.y-=dir*oy;
      else{A.y-=dir*oy*.5;B.y+=dir*oy*.5;}
    }
  }
  for(const e of a)constrainEnemyOutsidePlayer(e);
}

function deckCombat(){return g.boarders.some(b=>b.hp>0);}
function boardingMode(){return deckCombat()||g.enemies.some(e=>e.state==='closing'||(e.state==='docked'&&e.contact));}
function targetForFire(){
  if(g.focus&&g.focus.state!=='sink'&&!g.focus.gone)return g.focus;
  return [...g.enemies].filter(e=>e.state!=='sink'&&!e.gone).sort((a,b)=>{
    const pa=(a.type==='gunship'?a.x-90:a.x)-(a.state==='docked'?180:0);
    const pb=(b.type==='gunship'?b.x-90:b.x)-(b.state==='docked'?180:0);
    return pa-pb;
  })[0];
}
