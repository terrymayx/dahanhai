/* V5.5 自动开炮开关：默认关闭；关闭时只允许手动“齐射” */
const BTN_AUTO_CANNON={x:1515,y:30,w:270,h:64};

if(g.autoCannon==null)g.autoCannon=false;

const _newGameAutoCannon=newGame;
newGame=function(){
  const state=_newGameAutoCannon();
  state.autoCannon=false;
  return state;
};

const _passiveCannonToggle=passiveCannon;
passiveCannon=function(){
  if(!g.autoCannon)return false;
  return _passiveCannonToggle();
};

const _drawHUDAutoCannon=drawHUD;
drawHUD=function(){
  _drawHUDAutoCannon();
  if(g.state==='menu')return;
  rr(BTN_AUTO_CANNON.x,BTN_AUTO_CANNON.y,BTN_AUTO_CANNON.w,BTN_AUTO_CANNON.h,14);
  ctx.fillStyle=g.autoCannon?'#527c3d':'#6f4f38';ctx.fill();
  ctx.strokeStyle=g.autoCannon?'#2f5727':'#4b3528';ctx.lineWidth=4;ctx.stroke();
  circle(BTN_AUTO_CANNON.x+34,BTN_AUTO_CANNON.y+32,12);
  ctx.fillStyle=g.autoCannon?'#9ee36d':'#d6b89e';ctx.fill();
  ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();
  txt('自动开炮：'+(g.autoCannon?'开':'关'),BTN_AUTO_CANNON.x+152,BTN_AUTO_CANNON.y+43,25,'#ffffff','#3a2c1a',4);
};

function autoCannonPoint(ev){
  const r=cv.getBoundingClientRect();
  return {x:((ev.clientX-r.left)-vx)/vs,y:((ev.clientY-r.top)-vy)/vs};
}
function autoCannonButtonHit(p){
  return p.x>=BTN_AUTO_CANNON.x&&p.x<=BTN_AUTO_CANNON.x+BTN_AUTO_CANNON.w&&
         p.y>=BTN_AUTO_CANNON.y&&p.y<=BTN_AUTO_CANNON.y+BTN_AUTO_CANNON.h;
}
cv.addEventListener('pointerdown',ev=>{
  if(g.state!=='playing')return;
  const p=autoCannonPoint(ev);
  if(!autoCannonButtonHit(p))return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  g.autoCannon=!g.autoCannon;
  g.cannonT=g.autoCannon?.18:1.4;
  g.texts.push({x:1650,y:125,str:'自动开炮 '+(g.autoCannon?'开启':'关闭'),t:1.0,color:g.autoCannon?'#b8f08e':'#f2d0b5',size:24});
  sfx.cast();
},true);
