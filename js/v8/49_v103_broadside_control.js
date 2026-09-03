(function(root){
  'use strict';
  const V=root.V103Broadside;
  if(!V||typeof document==='undefined')return;

  const keys=new Set();
  let pointerTurn=0;

  const style=document.createElement('style');
  style.textContent=`
#broadsideControl{position:fixed;left:18px;bottom:18px;z-index:8;display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:13px;background:rgba(5,30,48,.88);border:1px solid rgba(150,225,255,.35);box-shadow:0 2px 10px rgba(0,0,0,.24);font-family:"Microsoft YaHei",sans-serif;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none;}
#broadsideControl button{height:38px;min-width:90px;padding:0 12px;border:1px solid rgba(255,255,255,.2);border-radius:9px;background:#285f7d;color:#fff;font-weight:800;font-size:14px;cursor:pointer;touch-action:none;}
#broadsideControl button.active{background:#c87924;border-color:rgba(255,225,150,.72);}
#broadsideControl .v103-info{min-width:258px;line-height:1.35;font-size:13px;color:#dff6ff;white-space:nowrap;}
#broadsideControl .v103-info b{color:#ffd65a;}
@media (max-width:900px){#broadsideControl{left:8px;bottom:8px;gap:5px;padding:6px 7px;transform:scale(.88);transform-origin:left bottom;}#broadsideControl button{height:35px;min-width:82px;padding:0 8px;font-size:13px;}#broadsideControl .v103-info{min-width:235px;font-size:12px;}}
`;
  document.head.appendChild(style);

  const panel=document.createElement('div');
  panel.id='broadsideControl';
  panel.innerHTML=`
    <button type="button" data-turn="-1">↶ 左转</button>
    <div class="v103-info"><b>舷炮</b>　<span data-battery>左舷 -- · 右舷 --</span><br><span data-bearing>当前射界：--</span></div>
    <button type="button" data-turn="1">右转 ↷</button>
  `;
  document.body.appendChild(panel);
  const leftBtn=panel.querySelector('[data-turn="-1"]'),rightBtn=panel.querySelector('[data-turn="1"]'),batteryText=panel.querySelector('[data-battery]'),bearingText=panel.querySelector('[data-bearing]');

  function state(){return root.V8||null;}
  function keyTurn(){
    const left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');
    return (right?1:0)-(left?1:0);
  }
  function applyTurn(){
    const s=state();if(!s)return 0;
    const turn=pointerTurn||keyTurn();
    s.__v103TurnInput=turn;
    leftBtn.classList.toggle('active',turn<0);rightBtn.classList.toggle('active',turn>0);
    return turn;
  }
  function setPointerTurn(v){pointerTurn=v;applyTurn();}
  function clearPointerTurn(){pointerTurn=0;applyTurn();}

  for(const btn of [leftBtn,rightBtn]){
    btn.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();if(btn.setPointerCapture)try{btn.setPointerCapture(ev.pointerId);}catch(e){}setPointerTurn(Number(btn.dataset.turn)||0);});
    btn.addEventListener('pointerup',ev=>{ev.preventDefault();ev.stopPropagation();clearPointerTurn();});
    btn.addEventListener('pointercancel',ev=>{ev.stopPropagation();clearPointerTurn();});
    btn.addEventListener('pointerleave',ev=>{if(ev.buttons===0)clearPointerTurn();});
    btn.addEventListener('click',ev=>ev.stopPropagation());
  }
  panel.addEventListener('pointerdown',ev=>ev.stopPropagation());
  window.addEventListener('pointerup',clearPointerTurn,{passive:true});
  window.addEventListener('blur',()=>{keys.clear();pointerTurn=0;applyTurn();});
  window.addEventListener('keydown',ev=>{
    if(['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(ev.code)){keys.add(ev.code);applyTurn();if(ev.code.startsWith('Arrow'))ev.preventDefault();}
  });
  window.addEventListener('keyup',ev=>{
    if(['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(ev.code)){keys.delete(ev.code);applyTurn();if(ev.code.startsWith('Arrow'))ev.preventDefault();}
  });

  function targetFor(s){return s&&s.focus&&s.focus.state==='active'?s.focus:(root.V8Battle&&root.V8Battle.targetForPlayer?root.V8Battle.targetForPlayer(s):null);}
  function sync(){
    const s=state();if(!s||!s.player)return;
    applyTurn();
    const target=targetFor(s),status=V.batteryStatus(s,target);
    batteryText.textContent=`左舷 ${status.port.live}/${status.port.total} · 右舷 ${status.starboard.live}/${status.starboard.total}`;
    if(!target)bearingText.textContent='当前射界：--';
    else if(status.ready>0)bearingText.textContent=`当前射界：${status.side==='port'?'左舷':'右舷'} ${status.ready} 门可射`;
    else bearingText.textContent='当前射界：无 · 请转舵';
  }

  sync();setInterval(sync,120);
  root.V103BroadsideControl={sync,applyTurn,setPointerTurn,clearPointerTurn};
})(typeof globalThis!=='undefined'?globalThis:this);
