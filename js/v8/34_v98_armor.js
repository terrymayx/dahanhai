(function(root){
  'use strict';

  const BASE_ARMOR={powder:20,mast:24,deck:28,rudder:34,cannon:36,hull:42,beam:58,core:64};
  const SHIP_MULT={player:1,sloop:.85,gunship:1.08,manowar:1.28};
  const GRADE_LABELS={graze:'擦伤',resisted:'受阻',penetrated:'穿透',heavy:'重度穿透'};

  function finite(v,fallback){v=Number(v);return Number.isFinite(v)?v:fallback;}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  function armorFor(ship,cell){
    const type=cell&&cell.type||'hull';
    const base=finite(BASE_ARMOR[type],BASE_ARMOR.hull);
    const mult=finite(SHIP_MULT[ship&&ship.kind],1);
    return Math.max(1,base*mult);
  }

  function gradeFor(ratio){
    ratio=finite(ratio,0);
    if(ratio<.60)return 'graze';
    if(ratio<1)return 'resisted';
    if(ratio<1.50)return 'penetrated';
    return 'heavy';
  }

  function multiplierFor(ratio){
    ratio=Math.max(0,finite(ratio,0));
    if(ratio<.60)return .20+clamp(ratio/.60,0,1)*.15;
    if(ratio<1)return .40+clamp((ratio-.60)/.40,0,1)*.30;
    if(ratio<1.50)return .80+clamp((ratio-1)/.50,0,1)*.25;
    return Math.min(1.35,1.05+(ratio-1.50)*.18);
  }

  function resolve(ship,cell,rawDamage,attackPower){
    const armor=armorFor(ship,cell);
    const attack=Math.max(0,finite(attackPower,rawDamage));
    const raw=Math.max(0,finite(rawDamage,attack));
    const ratio=attack/armor;
    const grade=gradeFor(ratio);
    const multiplier=multiplierFor(ratio);
    const effectiveDamage=raw<=0?0:Math.max(.1,raw*multiplier);
    return {armor,ratio,grade,multiplier,effectiveDamage,rawDamage:raw,attackPower:attack};
  }

  function resolveDirectHit(ship,cell,attackPower){
    const attack=Math.max(0,finite(attackPower,0));
    return resolve(ship,cell,attack,attack);
  }

  function resolveSplashHit(ship,cell,rawDamage,attackPower){
    return resolve(ship,cell,rawDamage,attackPower);
  }

  function gradeLabel(grade){return GRADE_LABELS[grade]||String(grade||'');}

  root.V98Armor={
    BASE_ARMOR,SHIP_MULT,GRADE_LABELS,
    armorFor,gradeFor,multiplierFor,resolveDirectHit,resolveSplashHit,gradeLabel
  };
})(typeof globalThis!=='undefined'?globalThis:this);
