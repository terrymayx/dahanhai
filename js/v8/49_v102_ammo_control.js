(function(root){
  'use strict';

  const Ammo=root.V102Ammo;
  if(!Ammo||typeof document==='undefined')return;

  const STORAGE='dahanhai.playerAmmoType';
  let lastState=null;

  const style=document.createElement('style');
  style.textContent=`
#ammoTypeControl{position:fixed;left:18px;top:194px;z-index:8;display:flex;align-items:center;gap:6px;padding:7px 9px;border-radius:12px;background:rgba(5,30,48,.88);border:1px solid rgba(150,225,255,.35);box-shadow:0 2px 10px rgba(0,0,0,.22);font-family:"Microsoft YaHei",sans-serif;color:#fff;user-select:none;-webkit-user-select:none;}
#ammoTypeControl .ammo-title{font-weight:700;font-size:14px;color:#ffd65a;margin-right:2px;}
#ammoTypeControl button{height:32px;min-width:78px;padding:0 10px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#285f7d;color:#fff;font-weight:700;font-size:14px;cursor:pointer;touch-action:manipulation;}
#ammoTypeControl button:active{transform:translateY(1px);}
#ammoTypeControl button.active{background:#d88a2a;color:#fff8e8;border-color:rgba(255,226,155,.72);box-shadow:0 0 0 1px rgba(255,216,120,.18) inset;}
@media (max-width:900px){#ammoTypeControl{left:8px;top:160px;gap:4px;padding:5px 6px;transform:scale(.88);transform-origin:left top;}#ammoTypeControl button{min-width:70px;padding:0 7px;font-size:13px;}}
`;
  document.head.appendChild(style);

  const panel=document.createElement('div');
  panel.id='ammoTypeControl';
  panel.innerHTML=`
    <span class="ammo-title">弹药</span>
    <button type="button" data-ammo="solid">● 实心弹</button>
    <button type="button" data-ammo="chain">⛓ 链弹</button>
    <button type="button" data-ammo="explosive">✹ 爆裂弹</button>
  `;
  document.body.appendChild(panel);
  const buttons=[...panel.querySelectorAll('[data-ammo]')];

  function state(){return root.V8||null;}
  function readStored(fallback){
    try{
      const raw=localStorage.getItem(STORAGE);
      return raw===null||raw===''?Ammo.normalizePlayerType(fallback):Ammo.normalizePlayerType(raw);
    }catch(e){return Ammo.normalizePlayerType(fallback);}
  }
  function save(type){try{localStorage.setItem(STORAGE,type);}catch(e){}}
  function syncButtons(type){
    type=Ammo.normalizePlayerType(type);
    for(const btn of buttons)btn.classList.toggle('active',btn.getAttribute('data-ammo')===type);
    return type;
  }
  function setAmmo(type){
    const s=state();if(!s)return Ammo.normalizePlayerType(type);
    type=Ammo.normalizePlayerType(type);
    s.playerAmmoType=type;
    syncButtons(type);
    save(type);
    return type;
  }
  function applyStoredToNewState(s){
    if(!s)return 'solid';
    const type=readStored(s.playerAmmoType||'solid');
    s.playerAmmoType=type;
    syncButtons(type);
    return type;
  }
  function sync(){
    const s=state();if(!s)return;
    if(s!==lastState){lastState=s;applyStoredToNewState(s);return;}
    const type=Ammo.normalizePlayerType(s.playerAmmoType);
    if(type!==s.playerAmmoType)s.playerAmmoType=type;
    syncButtons(type);
  }

  panel.addEventListener('pointerdown',function(ev){ev.stopPropagation();});
  panel.addEventListener('click',function(ev){
    ev.stopPropagation();
    const btn=ev.target.closest('[data-ammo]');
    if(!btn)return;
    setAmmo(btn.getAttribute('data-ammo'));
  });

  sync();
  setInterval(sync,180);
  root.V102AmmoControl={STORAGE,setAmmo,sync,applyStoredToNewState,syncButtons};
})(typeof globalThis!=='undefined'?globalThis:this);
