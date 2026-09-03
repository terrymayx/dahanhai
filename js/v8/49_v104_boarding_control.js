(function(root){
  'use strict';
  root.DHH=root.DHH||{};
  const keys=Object.create(null);
  let attackPulse=false,pointerId=null,joyStart=null,joyNow=null;
  const MOVE_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'];

  function state(){return root.V8||null;}
  function boardingActive(st){return !!(st&&st.boarding&&st.boarding.active);}
  function normalize(x,y){const d=Math.hypot(x,y);return d>1?{x:x/d,y:y/d}:{x,y};}
  function sample(st){
    st=st||state();if(!boardingActive(st))return null;
    let x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
    let y=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
    if(joyStart&&joyNow){x+=(joyNow.x-joyStart.x)/55;y+=(joyNow.y-joyStart.y)/55;}
    const n=normalize(x,y);
    st.__v104CaptainInput={x:n.x,y:n.y,attack:attackPulse||!!keys.Space};
    attackPulse=false;return st.__v104CaptainInput;
  }
  function keyDown(ev){
    if(MOVE_KEYS.includes(ev.code)||ev.code==='Space'){keys[ev.code]=true;if(boardingActive(state())){ev.preventDefault();if(ev.code==='Space')attackPulse=true;}}
  }
  function keyUp(ev){if(MOVE_KEYS.includes(ev.code)||ev.code==='Space'){keys[ev.code]=false;if(boardingActive(state()))ev.preventDefault();}}
  function zone(ev){const w=root.innerWidth||1280,h=root.innerHeight||720;return{x:ev.clientX,y:ev.clientY,w,h};}
  function pointerDown(ev){
    const st=state();if(!boardingActive(st))return;
    const p=zone(ev);ev.preventDefault();
    if(p.x>p.w*.68){attackPulse=true;return;}
    if(p.x<p.w*.48&&p.y>p.h*.48){pointerId=ev.pointerId;joyStart={x:p.x,y:p.y};joyNow={x:p.x,y:p.y};}
    else attackPulse=true;
  }
  function pointerMove(ev){if(pointerId!==ev.pointerId||!joyStart)return;joyNow={x:ev.clientX,y:ev.clientY};ev.preventDefault();}
  function pointerUp(ev){if(pointerId===ev.pointerId){pointerId=null;joyStart=null;joyNow=null;if(boardingActive(state()))ev.preventDefault();}}

  if(root.addEventListener){root.addEventListener('keydown',keyDown,{passive:false});root.addEventListener('keyup',keyUp,{passive:false});}
  const canvas=root.document&&root.document.getElementById?root.document.getElementById('cv'):null;
  if(canvas){canvas.addEventListener('pointerdown',pointerDown,{passive:false});canvas.addEventListener('pointermove',pointerMove,{passive:false});canvas.addEventListener('pointerup',pointerUp,{passive:false});canvas.addEventListener('pointercancel',pointerUp,{passive:false});}

  const api={sample,boardingActive,keyDown,keyUp,pointerDown,pointerMove,pointerUp,getJoystick:function(){return joyStart&&joyNow?{start:joyStart,now:joyNow}:null;}};
  root.DHH.V104BoardingControl=api;
})(typeof globalThis!=='undefined'?globalThis:this);
