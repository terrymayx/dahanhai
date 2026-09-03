(function(root){
  'use strict';

  const A=root.V98Armor;
  if(!A)throw new Error('V9.9 material requires V98Armor');

  const MATERIAL_WEAR={deck:.28,powder:.34,mast:.30,rudder:.24,cannon:.22,hull:.18,beam:.12,core:.10};
  const STRUCTURAL_BASE={deck:1.0,hull:1.4,beam:3.4,core:4.2,powder:.8,mast:.9,rudder:1,cannon:1};
  const GRADE_LABELS={ricochet:'跳弹',graze:'擦伤',resisted:'受阻',penetrated:'穿透',heavy:'重度穿透'};

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a));}
  function key(gx,gy){return gx+','+gy;}
  function norm(x,y){const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};}

  function prepareCell(ship,cell){
    if(!cell)return cell;
    if(!Number.isFinite(cell.armorMax))cell.armorMax=Math.max(1,A.armorFor(ship,cell));
    if(!Number.isFinite(cell.armorHp))cell.armorHp=cell.armorMax;
    if(!Number.isFinite(cell.fracture))cell.fracture=0;
    if(!Number.isFinite(cell.fatigue))cell.fatigue=0;
    if(!Number.isFinite(cell.structuralCapacity))cell.structuralCapacity=STRUCTURAL_BASE[cell.type]||1;
    if(!Number.isFinite(cell.structuralStress))cell.structuralStress=0;
    return cell;
  }

  function prepareShip(ship){
    if(!ship||!ship.cells)return ship;
    if(!Number.isFinite(ship.__v99MaterialRevision))ship.__v99MaterialRevision=0;
    for(const cell of ship.cells)prepareCell(ship,cell);
    return ship;
  }

  function surfaceNormal(ship,cell){
    if(!ship||!cell)return{x:0,y:0};
    const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
    let nx=0,ny=0,exposed=0;
    for(const [dx,dy] of dirs){
      const n=ship.cellMap&&ship.cellMap[key(cell.gx+dx,cell.gy+dy)];
      if(!n||!n.alive||n.detachedGone){nx+=dx;ny+=dy;exposed++;}
    }
    if(!exposed||(!nx&&!ny))return{x:0,y:0};
    return norm(nx,ny);
  }

  function currentArmor(ship,cell){
    prepareCell(ship,cell);
    const hpRatio=clamp(cell.armorHp/cell.armorMax,0,1);
    const materialIntegrity=(1-cell.fracture*.28)*(1-cell.fatigue*.18);
    return Math.max(1,cell.armorMax*(.10+.90*hpRatio)*Math.max(.35,materialIntegrity));
  }

  function gradeFor(ratio){
    if(ratio<.60)return 'graze';
    if(ratio<1)return 'resisted';
    if(ratio<1.50)return 'penetrated';
    return 'heavy';
  }

  function damageMultiplier(ratio){
    if(typeof A.multiplierFor==='function')return A.multiplierFor(ratio);
    if(ratio<.6)return .28;
    if(ratio<1)return .55;
    if(ratio<1.5)return .92;
    return Math.min(1.35,1.05+(ratio-1.5)*.18);
  }

  function projectileLocalVelocity(ship,projectile){
    const vx=Number(projectile&&projectile.vx)||0,vy=Number(projectile&&projectile.vy)||0;
    const r=-(Number(ship&&ship.rotation)||0),c=Math.cos(r),s=Math.sin(r);
    return{x:vx*c-vy*s,y:vx*s+vy*c};
  }

  function resolveDirect(ship,cell,projectile){
    prepareCell(ship,cell);
    projectile=projectile||{};
    const localV=projectileLocalVelocity(ship,projectile),speed=Math.hypot(localV.x,localV.y)||1;
    const v={x:localV.x/speed,y:localV.y/speed};
    let normal=surfaceNormal(ship,cell);
    if(!normal.x&&!normal.y)normal={x:-v.x,y:-v.y};
    const impactCos=clamp(Math.abs((-v.x)*normal.x+(-v.y)*normal.y),0,1);
    const impactAngle=Math.acos(clamp(impactCos,-1,1))*180/Math.PI;
    const armorNow=currentArmor(ship,cell);
    const effectiveArmor=armorNow/Math.max(.35,impactCos);
    const attack=Math.max(0,Number(projectile.attackPower)||Number(projectile.damage)||0);
    const raw=Math.max(0,Number(projectile.damage)||attack);
    const ratio=effectiveArmor>0?attack/effectiveArmor:99;
    const ricochet=!projectile.__v99Ricocheted&&impactCos<.28&&attack<effectiveArmor*1.10;
    const grade=ricochet?'ricochet':gradeFor(ratio);
    const multiplier=ricochet?.16:damageMultiplier(ratio);
    const effectiveDamage=Math.max(.1,raw*multiplier);
    const materialFactor=MATERIAL_WEAR[cell.type]||.18;
    const impactFactor=.18+.82*impactCos;
    const gradeBoost=grade==='heavy'?1.24:grade==='penetrated'?1.08:grade==='ricochet'?.32:.72;
    const armorLoss=Math.min(cell.armorHp,attack*impactFactor*materialFactor*gradeBoost);
    const fractureGain=clamp((Math.max(0,ratio-.55)*.075)+(grade==='heavy'?.10:grade==='penetrated'?.045:grade==='ricochet'?.01:.018),0,.22);
    const fatigueGain=clamp(.018+Math.min(2.5,ratio)*.035+(grade==='heavy'?.04:0),.01,.15);
    return {armorMax:cell.armorMax,armorHp:cell.armorHp,armorNow,normal,impactCos,impactAngle,effectiveArmor,ratio,grade,ricochet,multiplier,effectiveDamage,armorLoss,fractureGain,fatigueGain,attackPower:attack,rawDamage:raw};
  }

  function resolveSplash(ship,cell,rawDamage,attackPower){
    prepareCell(ship,cell);
    const armorNow=currentArmor(ship,cell);
    const attack=Math.max(0,Number(attackPower)||Number(rawDamage)||0);
    const raw=Math.max(0,Number(rawDamage)||0);
    const effectiveArmor=Math.max(1,armorNow*.88);
    const ratio=effectiveArmor>0?attack/effectiveArmor:99;
    const grade=gradeFor(ratio);
    const multiplier=damageMultiplier(ratio)*.92;
    const effectiveDamage=Math.max(.1,raw*multiplier);
    const wear=(MATERIAL_WEAR[cell.type]||.18)*.36;
    const armorLoss=Math.min(cell.armorHp,attack*wear*(grade==='heavy'?1.18:grade==='penetrated'?1:.72));
    const fractureGain=clamp(.008+Math.max(0,ratio-.7)*.035,0,.09);
    const fatigueGain=clamp(.012+Math.min(2,ratio)*.018,0,.07);
    return {armorMax:cell.armorMax,armorHp:cell.armorHp,armorNow,effectiveArmor,ratio,grade,ricochet:false,multiplier,effectiveDamage,armorLoss,fractureGain,fatigueGain,attackPower:attack,rawDamage:raw,impactCos:1,impactAngle:0,normal:{x:0,y:0}};
  }

  function applyImpactState(ship,cell,result){
    if(!cell||!result)return cell;
    prepareCell(ship,cell);
    cell.armorHp=Math.max(0,cell.armorHp-(result.armorLoss||0));
    cell.fracture=clamp(cell.fracture+(result.fractureGain||0),0,1);
    cell.fatigue=clamp(cell.fatigue+(result.fatigueGain||0),0,1);
    cell.__v99LastImpact=result;
    if(ship&&ship.cellMap){
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;
        const n=ship.cellMap[key(cell.gx+dx,cell.gy+dy)];
        if(!n||!n.alive||n.detachedGone)continue;
        prepareCell(ship,n);
        const scale=(Math.abs(dx)+Math.abs(dy)===1)?.16:.08;
        n.fatigue=clamp(n.fatigue+(result.fatigueGain||0)*scale,0,1);
      }
      ship.__v99MaterialRevision=(ship.__v99MaterialRevision||0)+1;
    }
    return cell;
  }

  function addBlastFatigue(ship,cell,power){
    if(!cell)return;
    prepareCell(ship,cell);
    power=clamp(Number(power)||0,0,4);
    cell.fracture=clamp(cell.fracture+power*.055,0,1);
    cell.fatigue=clamp(cell.fatigue+power*.045,0,1);
    if(ship)ship.__v99MaterialRevision=(ship.__v99MaterialRevision||0)+1;
  }

  function gradeLabel(grade){return GRADE_LABELS[grade]||String(grade||'');}

  root.V99Material={MATERIAL_WEAR,STRUCTURAL_BASE,GRADE_LABELS,prepareCell,prepareShip,surfaceNormal,currentArmor,projectileLocalVelocity,resolveDirect,resolveSplash,applyImpactState,addBlastFatigue,gradeLabel};
})(typeof globalThis!=='undefined'?globalThis:this);
