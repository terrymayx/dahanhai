(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.9 impact explosion requires grid and battle');

  const RADIUS_CELLS=4.6;
  const MAX_SPLASH_DAMAGE=12;
  const MIN_SPLASH_DAMAGE=1;
  const BASE_PLAYER_ATTACK=24;
  const MAX_PLAYER_POWER_SCALE=8;
  const MAX_RADIUS_SCALE=3.2;
  const MAX_COMBINED_RADIUS_SCALE=4.2;

  function hash(a,b,c){
    let n=((a|0)*73856093)^((b|0)*19349663)^((c|0)*83492791)^0x9e3779b9;
    n=Math.imul(n^(n>>>13),1274126177);
    return (n^(n>>>16))>>>0;
  }
  function rnd(seed,i){
    let n=(seed+Math.imul(i+1,0x9e3779b1))>>>0;
    n^=n<<13;n^=n>>>17;n^=n<<5;
    return (n>>>0)/4294967295;
  }
  function profileFor(projectile){
    const Ammo=root.V102Ammo||null;
    return Ammo&&typeof Ammo.profileFor==='function'?Ammo.profileFor(projectile&&projectile.ammoType):null;
  }

  function playerPowerScale(projectile){
    if(!projectile||projectile.side!=='player')return 1;
    const raw=(Number(projectile.attackPower)||Number(projectile.damage)||BASE_PLAYER_ATTACK)/BASE_PLAYER_ATTACK;
    return Math.max(1,Math.min(MAX_PLAYER_POWER_SCALE,raw));
  }

  function baseBlastRadiusScale(projectile){
    const power=playerPowerScale(projectile);
    if(power<=1)return 1;
    return Math.min(MAX_RADIUS_SCALE,1+Math.sqrt(power-1)*.80);
  }

  function ammoScales(projectile){
    const profile=profileFor(projectile)||{};
    const baseRadius=baseBlastRadiusScale(projectile);
    return {
      armorAttackScale:Number.isFinite(profile.armorAttackScale)?profile.armorAttackScale:1,
      blastRadiusScale:Math.max(.15,Math.min(MAX_COMBINED_RADIUS_SCALE,baseRadius*(Number.isFinite(profile.blastRadiusScale)?profile.blastRadiusScale:1))),
      splashDamageScale:Number.isFinite(profile.splashDamageScale)?profile.splashDamageScale:1,
      fractureScale:Number.isFinite(profile.fractureScale)?profile.fractureScale:1,
      fatigueScale:Number.isFinite(profile.fatigueScale)?profile.fatigueScale:1,
      fireScale:Number.isFinite(profile.fireScale)?profile.fireScale:1
    };
  }

  function blastRadiusScale(projectile){return ammoScales(projectile).blastRadiusScale;}
  function scaleSplashResult(result,projectile){
    result=result||{};
    const scales=ammoScales(projectile);
    return Object.assign({},result,{
      effectiveDamage:Math.max(.1,(Number(result.effectiveDamage)||0)*scales.splashDamageScale),
      fractureGain:Math.max(0,(Number(result.fractureGain)||0)*scales.fractureScale),
      fatigueGain:Math.max(0,(Number(result.fatigueGain)||0)*scales.fatigueScale)
    });
  }

  function addImpactFx(state,pos,cell,seed,powerScale,radiusScale,projectile){
    if(!state||!state.fx)return;
    powerScale=Math.max(1,Math.min(MAX_PLAYER_POWER_SCALE,Number(powerScale)||1));
    radiusScale=Math.max(.25,Math.min(MAX_COMBINED_RADIUS_SCALE,Number(radiusScale)||1));
    const visualScale=Math.max(.55,1+(radiusScale-1)*.38);
    const lobes=Math.max(2,Math.min(12,4+Math.floor(rnd(seed,1)*3)+Math.floor((radiusScale-1)*2.3)));
    for(let i=0;i<lobes;i++){
      const a=rnd(seed,10+i)*Math.PI*2;
      const d=(4+rnd(seed,20+i)*18)*visualScale;
      state.fx.push({k:'boom',x:pos.x+Math.cos(a)*d,y:pos.y+Math.sin(a)*d,t:0,dur:(.28+rnd(seed,30+i)*.18)*Math.min(1.48,visualScale),r:(22+rnd(seed,40+i)*24)*visualScale});
    }
    state.fx.push({k:'impactBurst',x:pos.x,y:pos.y,t:0,dur:.36,r:(38+rnd(seed,55)*18)*visualScale});
    const count=Math.max(6,Math.min(56,16+Math.floor(rnd(seed,60)*10)+Math.floor((powerScale-1)*5)+Math.floor((radiusScale-1)*5)));
    for(let i=0;i<count;i++){
      const a=rnd(seed,70+i)*Math.PI*2;
      const speed=(90+rnd(seed,100+i)*210)*(1+(powerScale-1)*.10+(radiusScale-1)*.09);
      state.fx.push({k:'splinter',x:pos.x,y:pos.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-(35+rnd(seed,130+i)*85),t:0,dur:.42+rnd(seed,160+i)*.50,r:(2.5+rnd(seed,190+i)*4.5)*Math.min(1.55,visualScale),rot:rnd(seed,220+i)*Math.PI*2,vr:(rnd(seed,250+i)-.5)*10});
    }
    // Chain shot uses existing bounded splinter FX to suggest the sideways chain/rope sweep; no new renderer path is required.
    if(projectile&&projectile.ammoType==='chain'&&cell&&(cell.type==='mast'||cell.type==='rudder'||cell.type==='cannon')){
      const vx=Number(projectile.vx)||1,vy=Number(projectile.vy)||0,d=Math.hypot(vx,vy)||1,nx=-vy/d,ny=vx/d;
      for(let i=0;i<8;i++){
        const side=i<4?-1:1,speed=80+rnd(seed,300+i)*120;
        state.fx.push({k:'splinter',x:pos.x+nx*side*(4+i%4)*2,y:pos.y+ny*side*(4+i%4)*2,vx:nx*side*speed+(vx/d)*25,vy:ny*side*speed+(vy/d)*25,t:0,dur:.32+rnd(seed,330+i)*.28,r:2+rnd(seed,350+i)*3,rot:rnd(seed,370+i)*Math.PI*2,vr:(rnd(seed,390+i)-.5)*9});
      }
    }
    if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);
  }

  function localCandidates(ship,impactCell,scanRadius){
    const out=[];
    if(!ship||!impactCell||!ship.cellMap)return out;
    const minX=Math.max(0,impactCell.gx-scanRadius),maxX=Math.min((ship.gridWidth||0)-1,impactCell.gx+scanRadius);
    const minY=Math.max(0,impactCell.gy-scanRadius),maxY=Math.min((ship.gridHeight||0)-1,impactCell.gy+scanRadius);
    for(let gy=minY;gy<=maxY;gy++)for(let gx=minX;gx<=maxX;gx++){const cell=ship.cellMap[gx+','+gy];if(cell)out.push(cell);}
    return out;
  }

  function applyIrregularSplash(state,ship,impactCell,projectile,seed){
    if(!ship||!impactCell)return [];
    const affected=[];
    const powerScale=playerPowerScale(projectile),scales=ammoScales(projectile),radiusScale=scales.blastRadiusScale;
    const baseRadius=RADIUS_CELLS*radiusScale*(.90+rnd(seed,2)*.22);
    const stretchX=.74+rnd(seed,3)*.56,stretchY=.74+rnd(seed,4)*.56;
    const scanRadius=Math.min(34,Math.ceil(baseRadius*1.55+2));
    const candidates=localCandidates(ship,impactCell,scanRadius);
    const Material=root.V99Material||null,Armor=root.V98Armor||null,Structure=root.V99Structure||null,Fracture=root.V100Fracture||null,Branches=root.V101CrackBranches||null,Fire=root.V94FireDamage||null;
    let structureQueued=0,fractureSeeded=0,branchSeeded=0;

    for(const cell of candidates){
      if(!cell.alive||cell.detachedGone||cell===impactCell)continue;
      const dx=(cell.gx-impactCell.gx)/stretchX,dy=(cell.gy-impactCell.gy)/stretchY,dist=Math.hypot(dx,dy);
      if(dist>baseRadius+.9)continue;
      const s=hash(cell.gx,cell.gy,seed&0xffff),angle=Math.atan2(dy,dx);
      const wave=.84+.20*Math.sin(angle*3.0+rnd(seed,5)*6.28)+.14*Math.sin(angle*5.0+rnd(seed,6)*6.28)+.07*Math.sin(angle*7.0+rnd(seed,7)*6.28);
      const localRadius=baseRadius*wave*(.88+rnd(s,1)*.25);
      if(dist>localRadius)continue;
      const normalized=dist/Math.max(.01,localRadius);
      const hitChance=Math.min(.995,.965-normalized*.15+(powerScale-1)*.012);
      if(rnd(s,2)>hitChance)continue;
      const falloff=Math.max(.18,Math.pow(Math.max(0,1-normalized),.78)),jitter=.62+rnd(s,3)*.72;
      const minDamage=Math.max(1,Math.round(MIN_SPLASH_DAMAGE*powerScale));
      const rawDamage=Math.max(minDamage,Math.round(MAX_SPLASH_DAMAGE*powerScale*falloff*jitter));
      if(!(rawDamage>0))continue;

      const baseAttack=Number(projectile&&projectile.attackPower)||Number(projectile&&projectile.damage)||BASE_PLAYER_ATTACK;
      const attackPower=baseAttack*scales.armorAttackScale;
      let splash;
      if(Material&&typeof Material.resolveSplash==='function'){
        splash=scaleSplashResult(Material.resolveSplash(ship,cell,rawDamage,attackPower),projectile);
        Material.applyImpactState(ship,cell,splash);
      }else{
        splash=Armor&&typeof Armor.resolveSplashHit==='function'?Armor.resolveSplashHit(ship,cell,rawDamage,attackPower):{armor:0,ratio:999,grade:'heavy',effectiveDamage:rawDamage,fractureGain:0,fatigueGain:0};
        splash=scaleSplashResult(splash,projectile);
      }
      const effectiveDamage=splash.effectiveDamage;
      if(!(effectiveDamage>0))continue;

      const res=Fire&&typeof Fire.damageCellWithFireScale==='function'?Fire.damageCellWithFireScale(ship,cell,effectiveDamage,scales.fireScale):G.damageCell(ship,cell,effectiveDamage);
      affected.push({cell,rawDamage,effectiveDamage,armor:splash.effectiveArmor||splash.armor,ratio:splash.ratio,grade:splash.grade,destroyed:!!(res&&res.destroyed),normalized});
      if(Structure&&structureQueued<4&&(cell.type==='hull'||cell.type==='deck'||cell.type==='beam'||cell.type==='core')&&(res&&res.destroyed||splash.grade==='heavy')){
        Structure.queueLocalSolve(ship,cell);structureQueued++;
      }
      if(Fracture&&fractureSeeded<6&&typeof Fracture.seedImpact==='function'&&(cell.type==='hull'||cell.type==='deck'||cell.type==='beam'||cell.type==='core')){
        const radial=Math.hypot(dx,dy)||1,fracturePower=baseAttack*falloff*.55*Math.min(2,scales.fractureScale);
        Fracture.seedImpact(ship,cell,{vx:dx/radial,vy:dy/radial,power:fracturePower,grade:splash.grade});
        if(Branches&&branchSeeded<4&&typeof Branches.registerImpact==='function'){
          Branches.registerImpact(ship,cell,{vx:dx/radial,vy:dy/radial,power:fracturePower,grade:splash.grade});
          branchSeeded++;
        }
        fractureSeeded++;
      }
      if(res&&res.destroyed&&state&&typeof state.onCellDestroyed==='function'){
        const p=G.cellCenterWorld(ship,cell);
        try{state.onCellDestroyed(ship,cell,p,{side:'blast',damage:effectiveDamage,sourceProjectile:projectile,explosion:true});}catch(e){}
      }
    }
    return affected;
  }

  function install(){
    if(B.__v954ImpactExplosionInstalled)return;
    B.__v954ImpactExplosionInstalled=true;
    const originalNewGame=B.newGame;
    B.newGame=function(){
      const state=originalNewGame();
      const originalHit=state.onCellHit;
      state.onCellHit=function(ship,cell,pos,res,p){
        if(typeof originalHit==='function')originalHit(ship,cell,pos,res,p);
        if(!ship||!cell||!pos||!p||p.__v954Exploded)return;
        p.__v954Exploded=true;
        const timeSeed=Math.floor((state.time||0)*1000),seed=hash(cell.gx,cell.gy,timeSeed+(p.side==='player'?17:31));
        const powerScale=playerPowerScale(p),scales=ammoScales(p),radiusScale=scales.blastRadiusScale;
        addImpactFx(state,pos,cell,seed,powerScale,radiusScale,p);
        const affected=applyIrregularSplash(state,ship,cell,p,seed);
        let destroyed=0;for(const a of affected)if(a.destroyed)destroyed++;
        const summary={affected:affected.length,destroyed,powerScale,radiusScale,ammoType:p.ammoType||'standard',impactGrade:p.impactGrade||null,impactRatio:p.impactRatio||0,impactArmor:p.impactArmor||0};
        const feedback=root.V98HeavyFeedback||null;
        if(feedback&&typeof feedback.onImpact==='function'){try{feedback.onImpact(state,ship,cell,pos,p,summary);}catch(e){}}
        if(state.combatEvents){state.combatEvents.push({type:'impact_explosion',payload:{x:pos.x,y:pos.y,shipId:ship.id,...summary},time:state.time||0});if(state.combatEvents.length>32)state.combatEvents.splice(0,state.combatEvents.length-32);}
      };
      return state;
    };
  }

  root.V954ImpactExplosion={applyIrregularSplash,addImpactFx,localCandidates,playerPowerScale,baseBlastRadiusScale,ammoScales,scaleSplashResult,blastRadiusScale,RADIUS_CELLS,MAX_SPLASH_DAMAGE,BASE_PLAYER_ATTACK,MAX_PLAYER_POWER_SCALE,MAX_RADIUS_SCALE,MAX_COMBINED_RADIUS_SCALE};
  install();
})(typeof globalThis!=='undefined'?globalThis:this);
