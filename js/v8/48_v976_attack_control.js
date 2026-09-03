(function(root){
  'use strict';

  const A=root.V972PlayerAttack;
  if(!A||typeof document==='undefined')return;

  const STORAGE_ATTACK='dahanhai.playerAttack';
  const STORAGE_AUTO='dahanhai.playerAttackAuto';
  const DEFAULT_ATTACK=A.BASE_ATTACK||72;
  const MIN=A.MIN_ATTACK||24;
  const MAX=A.MAX_ATTACK||240;
  let lastState=null;

  function readNumber(key,fallback){
    try{
      const v=Number(localStorage.getItem(key));
      return Number.isFinite(v)?v:fallback;
    }catch(e){return fallback;}
  }
  function readBool(key,fallback){
    try{
      const v=localStorage.getItem(key);
      if(v==='1')return true;if(v==='0')return false;
    }catch(e){}
    return fallback;
  }
  function savePrefs(state){
    if(!state)return;
    try{
      localStorage.setItem(STORAGE_ATTACK,String(Math.round(state.playerShellAttack||DEFAULT_ATTACK)));
      localStorage.setItem(STORAGE_AUTO,state.playerAttackAuto?'1':'0');
    }catch(e){}
  }

  const style=document.createElement('style');
  style.textContent=`
#attackPowerControl{position:fixed;left:18px;top:145px;z-index:8;display:flex;align-items:center;gap:6px;padding:7px 9px;border-radius:12px;background:rgba(5,30,48,.88);border:1px solid rgba(150,225,255,.35);box-shadow:0 2px 10px rgba(0,0,0,.22);font-family:"Microsoft YaHei",sans-serif;color:#fff;user-select:none;-webkit-user-select:none;}
#attackPowerControl .ap-title{font-weight:700;font-size:14px;color:#ffd65a;margin-right:2px;}
#attackPowerControl button{height:32px;min-width:42px;padding:0 9px;border:0;border-radius:8px;background:#285f7d;color:#fff;font-weight:700;font-size:14px;cursor:pointer;touch-action:manipulation;}
#attackPowerControl button:active{transform:translateY(1px);}
#attackPowerControl button.ap-apply{background:#d88a2a;color:#fff8e8;}
#attackPowerControl button.ap-auto.active{background:#2c9a68;}
#attackPowerControl input{width:70px;height:32px;box-sizing:border-box;border:1px solid rgba(255,255,255,.35);border-radius:8px;background:rgba(255,255,255,.96);color:#193247;text-align:center;font-size:16px;font-weight:700;outline:none;}
#attackPowerControl .ap-range{font-size:11px;opacity:.62;white-space:nowrap;}
@media (max-width:900px){#attackPowerControl{left:8px;top:118px;gap:4px;padding:5px 6px;transform:scale(.90);transform-origin:left top;}#attackPowerControl .ap-range{display:none;}}
`;
  document.head.appendChild(style);

  const panel=document.createElement('div');
  panel.id='attackPowerControl';
  panel.innerHTML=`
    <span class="ap-title">炮攻</span>
    <button type="button" data-delta="-10">-10</button>
    <input id="attackPowerInput" type="number" min="${MIN}" max="${MAX}" step="1" inputmode="numeric" value="${DEFAULT_ATTACK}">
    <button type="button" data-delta="10">+10</button>
    <button type="button" class="ap-apply">应用</button>
    <button type="button" class="ap-auto">AUTO</button>
    <span class="ap-range">${MIN}–${MAX}</span>
  `;
  document.body.appendChild(panel);

  const input=panel.querySelector('#attackPowerInput');
  const applyBtn=panel.querySelector('.ap-apply');
  const autoBtn=panel.querySelector('.ap-auto');

  function state(){return root.V8||null;}
  function applyManual(value){
    const s=state();if(!s)return;
    const attack=A.setAttack(s,value);
    input.value=String(attack);
    autoBtn.classList.remove('active');
    autoBtn.textContent='AUTO';
    savePrefs(s);
  }
  function toggleAuto(){
    const s=state();if(!s)return;
    const enabled=!A.isAuto(s);
    A.setAuto(s,enabled);
    autoBtn.classList.toggle('active',enabled);
    autoBtn.textContent=enabled?'AUTO✓':'AUTO';
    input.value=String(A.getAttack(s));
    savePrefs(s);
  }
  function applyStoredToNewState(s){
    if(!s)return;
    const savedAttack=readNumber(STORAGE_ATTACK,DEFAULT_ATTACK);
    const savedAuto=readBool(STORAGE_AUTO,false);
    if(savedAuto)A.setAuto(s,true);else A.setAttack(s,savedAttack);
    input.value=String(A.getAttack(s));
    autoBtn.classList.toggle('active',A.isAuto(s));
    autoBtn.textContent=A.isAuto(s)?'AUTO✓':'AUTO';
  }

  panel.addEventListener('pointerdown',function(ev){ev.stopPropagation();});
  panel.addEventListener('click',function(ev){
    ev.stopPropagation();
    const btn=ev.target.closest('button');if(!btn)return;
    if(btn===applyBtn){applyManual(input.value);return;}
    if(btn===autoBtn){toggleAuto();return;}
    if(btn.hasAttribute('data-delta')){
      const s=state();if(!s)return;
      const current=A.isAuto(s)?A.getAttack(s):Number(input.value||s.playerShellAttack||DEFAULT_ATTACK);
      applyManual(current+Number(btn.getAttribute('data-delta')||0));
    }
  });
  input.addEventListener('pointerdown',function(ev){ev.stopPropagation();});
  input.addEventListener('keydown',function(ev){
    if(ev.key==='Enter'){ev.preventDefault();applyManual(input.value);input.blur();}
  });
  input.addEventListener('change',function(){applyManual(input.value);});

  function sync(){
    const s=state();if(!s)return;
    if(s!==lastState){lastState=s;applyStoredToNewState(s);return;}
    const auto=A.isAuto(s);
    if(auto){input.value=String(A.getAttack(s));}
    autoBtn.classList.toggle('active',auto);
    autoBtn.textContent=auto?'AUTO✓':'AUTO';
  }
  sync();
  setInterval(sync,180);

  root.V976AttackControl={applyManual,toggleAuto,sync};
})(typeof globalThis!=='undefined'?globalThis:this);
