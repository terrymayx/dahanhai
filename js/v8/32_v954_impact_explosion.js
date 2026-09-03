(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.5.4 impact explosion requires grid and battle');

  const RADIUS_CELLS=4.6;
  const MAX_SPLASH_DAMAGE=12;
  const MIN_SPLASH_DAMAGE=1;

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

  function addImpactFx(state,pos,cell,seed){
    if(!state||!state.fx)return;
    const cs=16;
    // Several overlapping blast lobes make the explosion silhouette irregular.
    const lobes=4+Math.floor(rnd(seed,1)*3);
    for(let i=0;i<lobes;i++){
      const a=rnd(seed,10+i)*Math.PI*2;
      const d=(4+rnd(seed,20+i)*18);
      state.fx.push({
        k:'boom',
        x:pos.x+Math.cos(a)*d,
        y:pos.y+Math.sin(a)*d,
        t:0,
        dur:.28+rnd(seed,30+i)*.18,
        r:22+rnd(seed,40+i)*24
      });
    }
    state.fx.push({k:'impactBurst',x:pos.x,y:pos.y,t:0,dur:.34,r:38+rnd(seed,55)*18});

    // Wood splinters spray outward from the impact point.
    const count=16+Math.floor(rnd(seed,60)*10);
    for(let i=0;i<count;i++){
      const a=rnd(seed,70+i)*Math.PI*2;
      const speed=90+rnd(seed,100+i)*210;
      state.fx.push({
        k:'splinter',x:pos.x,y:pos.y,
        vx:Math.cos(a)*speed,
        vy:Math.sin(a)*speed-(35+rnd(seed,130+i)*85),
        t:0,dur:.42+rnd(seed,160+i)*.50,
        r:2.5+rnd(seed,190+i)*4.5,
        rot:rnd(seed,220+i)*Math.PI*2,
        vr:(rnd(seed,250+i)-.5)*10
      });
    }
    if(state.fx.length>320)state.fx.splice(0,state.fx.length-320);
  }

  function applyIrregularSplash(state,ship,impactCell,projectile,seed){
    if(!ship||!impactCell)return [];
    const affected=[];
    const baseRadius=RADIUS_CELLS*(.88+rnd(seed,2)*.24);
    const stretchX=.78+rnd(seed,3)*.48;
    const stretchY=.78+rnd(seed,4)*.48;

    for(const cell of ship.cells||[]){
      if(!cell.alive||cell.detachedGone||cell===impactCell)continue;
      const dx=(cell.gx-impactCell.gx)/stretchX;
      const dy=(cell.gy-impactCell.gy)/stretchY;
      const dist=Math.hypot(dx,dy);
      if(dist>baseRadius+.8)continue;

      const s=hash(cell.gx,cell.gy,seed&0xffff);
      const angle=Math.atan2(dy,dx);
      const wave=.86+.18*Math.sin(angle*3.0+rnd(seed,5)*6.28)+.12*Math.sin(angle*5.0+rnd(seed,6)*6.28);
      const localRadius=baseRadius*wave*(.88+rnd(s,1)*.24);
      if(dist>localRadius)continue;

      // Random gaps keep the blast footprint from becoming a perfect filled circle.
      const normalized=dist/Math.max(.01,localRadius);
      const hitChance=.96-normalized*.22;
      if(rnd(s,2)>hitChance)continue;

      const falloff=Math.max(.10,1-normalized);
      const jitter=.62+rnd(s,3)*.72;
      const damage=Math.max(MIN_SPLASH_DAMAGE,Math.round(MAX_SPLASH_DAMAGE*falloff*jitter));
      if(!(damage>0))continue;

      const res=G.damageCell(ship,cell,damage);
      affected.push({cell,damage,destroyed:!!(res&&res.destroyed)});

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
        addImpactFx(state,pos,cell,seed);
        const affected=applyIrregularSplash(state,ship,cell,p,seed);
        if(state.combatEvents){
          state.combatEvents.push({type:'impact_explosion',payload:{x:pos.x,y:pos.y,shipId:ship.id,affected:affected.length},time:state.time||0});
          if(state.combatEvents.length>32)state.combatEvents.splice(0,state.combatEvents.length-32);
        }
      };
      return state;
    };
  }

  root.V954ImpactExplosion={applyIrregularSplash,addImpactFx,RADIUS_CELLS,MAX_SPLASH_DAMAGE};
  install();
})(typeof globalThis!=='undefined'?globalThis:this);
