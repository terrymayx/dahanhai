(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.7.4 impact explosion requires grid and battle');

  const RADIUS_CELLS=4.6;
  const MAX_SPLASH_DAMAGE=12;
  const MIN_SPLASH_DAMAGE=1;
  const BASE_PLAYER_ATTACK=24;
  const MAX_PLAYER_POWER_SCALE=8;
  const MAX_RADIUS_SCALE=3.2;

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

  function playerPowerScale(projectile){
    if(!projectile||projectile.side!=='player')return 1;
    const raw=(Number(projectile.attackPower)||Number(projectile.damage)||BASE_PLAYER_ATTACK)/BASE_PLAYER_ATTACK;
    return Math.max(1,Math.min(MAX_PLAYER_POWER_SCALE,raw));
  }

  // Range grows with attack power, but with diminishing returns so future upgrades
  // do not instantly cover the whole ship. 24 attack = 1x radius, 72 attack ~= 2.13x.
  function blastRadiusScale(projectile){
    const power=playerPowerScale(projectile);
    if(power<=1)return 1;
    return Math.min(MAX_RADIUS_SCALE,1+Math.sqrt(power-1)*.80);
  }

  function addImpactFx(state,pos,cell,seed,powerScale,radiusScale){
    if(!state||!state.fx)return;
    powerScale=Math.max(1,Math.min(MAX_PLAYER_POWER_SCALE,Number(powerScale)||1));
    radiusScale=Math.max(1,Math.min(MAX_RADIUS_SCALE,Number(radiusScale)||1));
    const visualScale=1+(radiusScale-1)*.38;
    const lobes=Math.min(10,4+Math.floor(rnd(seed,1)*3)+Math.floor((radiusScale-1)*2.3));
    for(let i=0;i<lobes;i++){
      const a=rnd(seed,10+i)*Math.PI*2;
      const d=(4+rnd(seed,20+i)*18)*visualScale;
      state.fx.push({
        k:'boom',
        x:pos.x+Math.cos(a)*d,
        y:pos.y+Math.sin(a)*d,
        t:0,
        dur:(.28+rnd(seed,30+i)*.18)*Math.min(1.38,visualScale),
        r:(22+rnd(seed,40+i)*24)*visualScale
      });
    }
    state.fx.push({k:'impactBurst',x:pos.x,y:pos.y,t:0,dur:.36,r:(38+rnd(seed,55)*18)*visualScale});

    const count=Math.min(52,16+Math.floor(rnd(seed,60)*10)+Math.floor((powerScale-1)*5)+Math.floor((radiusScale-1)*5));
    for(let i=0;i<count;i++){
      const a=rnd(seed,70+i)*Math.PI*2;
      const speed=(90+rnd(seed,100+i)*210)*(1+(powerScale-1)*.10+(radiusScale-1)*.09);
      state.fx.push({
        k:'splinter',x:pos.x,y:pos.y,
        vx:Math.cos(a)*speed,
        vy:Math.sin(a)*speed-(35+rnd(seed,130+i)*85),
        t:0,dur:.42+rnd(seed,160+i)*.50,
        r:(2.5+rnd(seed,190+i)*4.5)*Math.min(1.55,visualScale),
        rot:rnd(seed,220+i)*Math.PI*2,
        vr:(rnd(seed,250+i)-.5)*10
      });
    }
    if(state.fx.length>380)state.fx.splice(0,state.fx.length-380);
  }

  function applyIrregularSplash(state,ship,impactCell,projectile,seed){
    if(!ship||!impactCell)return [];
    const affected=[];
    const powerScale=playerPowerScale(projectile);
    const radiusScale=blastRadiusScale(projectile);
    const baseRadius=RADIUS_CELLS*radiusScale*(.90+rnd(seed,2)*.22);
    const stretchX=.74+rnd(seed,3)*.56;
    const stretchY=.74+rnd(seed,4)*.56;

    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.detachedGone||cell===impactCell)continue;
      const dx=(cell.gx-impactCell.gx)/stretchX;
      const dy=(cell.gy-impactCell.gy)/stretchY;
      const dist=Math.hypot(dx,dy);
      if(dist>baseRadius+.9)continue;

      const s=hash(cell.gx,cell.gy,seed&0xffff);
      const angle=Math.atan2(dy,dx);
      // Multiple waves create a jagged, non-circular blast footprint.
      const wave=.84+.20*Math.sin(angle*3.0+rnd(seed,5)*6.28)+.14*Math.sin(angle*5.0+rnd(seed,6)*6.28)+.07*Math.sin(angle*7.0+rnd(seed,7)*6.28);
      const localRadius=baseRadius*wave*(.88+rnd(s,1)*.25);
      if(dist>localRadius)continue;

      const normalized=dist/Math.max(.01,localRadius);
      // Higher-powered blasts leave fewer untouched gaps in the affected region.
      const hitChance=Math.min(.995,.965-normalized*.15+(powerScale-1)*.012);
      if(rnd(s,2)>hitChance)continue;

      // Range and damage both scale. Edge cells still take meaningful damage so a
      // larger blast creates a visibly larger damaged zone rather than a faint ring.
      const falloff=Math.max(.18,Math.pow(Math.max(0,1-normalized),.78));
      const jitter=.62+rnd(s,3)*.72;
      const minDamage=Math.max(1,Math.round(MIN_SPLASH_DAMAGE*powerScale));
      const damage=Math.max(minDamage,Math.round(MAX_SPLASH_DAMAGE*powerScale*falloff*jitter));
      if(!(damage>0))continue;

      const res=G.damageCell(ship,cell,damage);
      affected.push({cell,damage,destroyed:!!(res&&res.destroyed),normalized});

      if(res&&res.destroyed&&state&&typeof state.onCellDestroyed==='function'){
        const p=G.cellCenterWorld(ship,cell);
        try{state.onCellDestroyed(ship,cell,p,{side:'blast',damage,sourceProjectile:projectile,explosion:true});}catch(e){}
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
        const timeSeed=Math.floor((state.time||0)*1000);
        const seed=hash(cell.gx,cell.gy,timeSeed+(p.side==='player'?17:31));
        const powerScale=playerPowerScale(p);
        const radiusScale=blastRadiusScale(p);
        addImpactFx(state,pos,cell,seed,powerScale,radiusScale);
        const affected=applyIrregularSplash(state,ship,cell,p,seed);
        if(state.combatEvents){
          state.combatEvents.push({type:'impact_explosion',payload:{x:pos.x,y:pos.y,shipId:ship.id,affected:affected.length,powerScale,radiusScale},time:state.time||0});
          if(state.combatEvents.length>32)state.combatEvents.splice(0,state.combatEvents.length-32);
        }
      };
      return state;
    };
  }

  root.V954ImpactExplosion={
    applyIrregularSplash,addImpactFx,playerPowerScale,blastRadiusScale,
    RADIUS_CELLS,MAX_SPLASH_DAMAGE,BASE_PLAYER_ATTACK,MAX_PLAYER_POWER_SCALE,MAX_RADIUS_SCALE
  };
  install();
})(typeof globalThis!=='undefined'?globalThis:this);