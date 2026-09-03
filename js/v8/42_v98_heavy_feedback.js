(function(root){
  'use strict';

  const B=root.V8Battle,R=root.V8Render;
  const MAX_EXTRA_FX=4;
  const KICK_DECAY=5.8;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  function addFx(state,fx,budget){
    if(!state||!Array.isArray(state.fx)||budget.count>=MAX_EXTRA_FX)return;
    state.fx.push(fx);budget.count++;
    if(state.fx.length>390)state.fx.splice(0,state.fx.length-390);
  }

  function onImpact(state,ship,cell,pos,projectile,summary){
    if(!state||!ship||!cell||!pos||!projectile)return;
    summary=summary||{};
    const attack=Math.max(1,Number(projectile.attackPower)||Number(projectile.damage)||24);
    const power=clamp(attack/24,1,8);
    const radiusScale=clamp(Number(summary.radiusScale)||1,1,3.2);
    const destroyed=clamp(Number(summary.destroyed)||0,0,40);
    const grade=projectile.impactGrade||summary.impactGrade||'penetrated';
    const budget={count:0};

    // Short ship kick is visual only; it never changes collision coordinates.
    const kick=clamp(.14+power*.045+destroyed*.006,0,.72);
    ship.__v98ImpactKick=Math.max(ship.__v98ImpactKick||0,kick);
    ship.__v98ImpactKickPhase=((cell.gx||0)*.73+(cell.gy||0)*1.17)%6.283;

    if(grade==='heavy'){
      addFx(state,{k:'impactBurst',x:pos.x,y:pos.y,t:0,dur:.20,r:28+power*6+radiusScale*7},budget);
      addFx(state,{k:'boom',x:pos.x,y:pos.y,t:0,dur:.24,r:24+power*5},budget);
    }

    if((cell.type==='beam'||cell.type==='core')&&(grade==='heavy'||destroyed>=3)){
      addFx(state,{k:'structureRupture',x:pos.x,y:pos.y,t:0,dur:.54,r:48+Math.min(92,destroyed*3+power*7)},budget);
    }

    if(cell.type==='powder'&&(grade==='penetrated'||grade==='heavy')){
      addFx(state,{k:'boom',x:pos.x,y:pos.y,t:0,dur:.34,r:42+power*7},budget);
    }
  }

  function decayShip(ship,dt){
    if(!ship||!(ship.__v98ImpactKick>0))return;
    ship.__v98ImpactKick=Math.max(0,ship.__v98ImpactKick-Math.max(0,dt||0)*KICK_DECAY);
  }

  if(B&&typeof B.update==='function'){
    const originalUpdate=B.update;
    B.update=function(state,dt){
      originalUpdate(state,dt);
      if(!state)return;
      decayShip(state.player,dt);
      for(const ship of state.enemies||[])decayShip(ship,dt);
    };
  }

  if(R&&typeof R.shipVisualPose==='function'){
    const originalPose=R.shipVisualPose;
    R.shipVisualPose=function(ship,state){
      const pose=originalPose(ship,state);
      const kick=ship&&ship.__v98ImpactKick||0;
      if(kick>0){
        const t=state&&Number.isFinite(state.time)?state.time:0;
        const phase=ship.__v98ImpactKickPhase||0;
        const wave=Math.sin(t*52+phase);
        pose.rotation+=wave*kick*.024;
        pose.x+=Math.cos((ship.rotation||0)+Math.PI/2)*wave*kick*2.6;
        pose.y+=Math.sin((ship.rotation||0)+Math.PI/2)*wave*kick*2.6;
      }
      return pose;
    };
  }

  root.V98HeavyFeedback={MAX_EXTRA_FX,KICK_DECAY,onImpact,decayShip};
})(typeof globalThis!=='undefined'?globalThis:this);
