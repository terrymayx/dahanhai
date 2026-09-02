(function(root){
  'use strict';
  const Battle=root.V8Battle,Render=root.V8Render,Grid=root.V8ShipGrid,C=root.V8Config;
  if(!Battle||!Render||!Grid||!C)throw new Error('V8 battle/render modules must load before input loop');

  const canvas=document.getElementById('cv');
  Render.init(canvas);
  let state=Battle.newGame();root.V8=state;
  let last=performance.now();

  function restart(){state=Battle.newGame();root.V8=state;last=performance.now();}

  function pickEnemy(p){
    for(let i=state.enemies.length-1;i>=0;i--){
      const e=state.enemies[i];if(e.state!=='active')continue;
      if(Grid.pointHitsLiveCell(e,p.x,p.y))return e;
      const l=Grid.worldToLocal(e,p.x,p.y);
      if(Math.abs(l.x)<=e.gridWidth*e.cellSize*.52&&Math.abs(l.y)<=e.gridHeight*e.cellSize*.62)return e;
    }
    return null;
  }

  function onPointer(ev){
    ev.preventDefault();
    const p=Render.screenToWorld(ev.clientX,ev.clientY);
    if(p.x>C.W-145&&p.x<C.W-10&&p.y<110){state.paused=!state.paused;return;}
    if(state.state==='lose'){
      if(p.x>C.W/2-190&&p.x<C.W/2+190&&p.y>C.H/2&&p.y<C.H/2+130)restart();
      return;
    }
    Battle.setFocus(state,pickEnemy(p));
  }

  canvas.addEventListener('pointerdown',onPointer,{passive:false});

  function frame(now){
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    Battle.update(state,dt);Render.draw(state);requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  root.V8Restart=restart;
})(typeof globalThis!=='undefined'?globalThis:this);
