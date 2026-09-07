(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const C={
  clamp,
  wrap,
  guardApproachStage(distance){
    const d=Math.max(0,Number(distance)||0);
    return d>330?'ranged':d>170?'closing':'align';
  },
  guardApproachSpeed(type,distance){
    const base={skiff:102,support:88,medium:78,large:62}[type]||82;
    const stage=this.guardApproachStage(distance);
    return base*(stage==='ranged'?1:stage==='closing'?.72:.44);
  },
  crewMotionOffset(id,time,role='shooter'){
    const phase=(Number(id)||0)*1.61803398875, t=Math.max(0,Number(time)||0);
    const amp=role==='melee'?3.6:role==='enemy'?2.5:2.9;
    return{x:Math.sin(t*1.55+phase)*amp,y:Math.cos(t*1.23+phase*.73)*amp*.7};
  },
  inArc(angle, dx, dy) { const d=Math.hypot(dx,dy);return d>0 && Math.abs((Math.cos(angle)*dx+Math.sin(angle)*dy)/d)<0.72; },
  segmentHit(ax,ay,bx,by,x,y,r) { return this.segmentCircleFirst(ax,ay,bx,by,x,y,r)!==null; },
  segmentCircleFirst(ax,ay,bx,by,cx,cy,r){
    const dx=bx-ax,dy=by-ay,fx=ax-cx,fy=ay-cy;
    const A=dx*dx+dy*dy;
    if(A<1e-12)return Math.hypot(fx,fy)<=r?0:null;
    const B=2*(fx*dx+fy*dy),CC=fx*fx+fy*fy-r*r;
    let disc=B*B-4*A*CC;
    if(disc<0)return null;
    disc=Math.sqrt(disc);
    const t1=(-B-disc)/(2*A),t2=(-B+disc)/(2*A);
    if(t1>=0&&t1<=1)return t1;
    if(t2>=0&&t2<=1)return t2;
    return null;
  },
  segmentAABBFirst(ax,ay,bx,by,minx,miny,maxx,maxy){
    const dx=bx-ax,dy=by-ay;let t0=0,t1=1;
    const clip=(p,q)=>{if(Math.abs(p)<1e-12)return q>=0;const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r;}else{if(r<t0)return false;if(r<t1)t1=r;}return true;};
    if(!clip(-dx,ax-minx))return null;
    if(!clip(dx,maxx-ax))return null;
    if(!clip(-dy,ay-miny))return null;
    if(!clip(dy,maxy-ay))return null;
    return t0>=0&&t0<=1?t0:null;
  },
  pointInPolygon(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];const cross=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi||1e-9)+xi);if(cross)inside=!inside;}return inside;},
  segmentPolygonHit(ax,ay,bx,by,poly){
    if(this.pointInPolygon(ax,ay,poly))return 0;
    let best=null;const rx=bx-ax,ry=by-ay;
    for(let i=0;i<poly.length;i++){
      const c=poly[i],d=poly[(i+1)%poly.length],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;
      if(Math.abs(den)<1e-9)continue;
      const qx=c[0]-ax,qy=c[1]-ay,t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
      if(t>=0&&t<=1&&u>=0&&u<=1&&(best===null||t<best))best=t;
    }
    if(best===null&&this.pointInPolygon(bx,by,poly))return 1;
    return best;
  },
  broadsideSide(angle,dx,dy,maxRange=720,minRange=70,halfArcDeg=62){
    const d=Math.hypot(dx,dy);if(d<minRange||d>maxRange)return null;
    const c=Math.cos(angle),s=Math.sin(angle);
    const lx=c*dx+s*dy,ly=-s*dx+c*dy;
    const side=ly<0?'upper':'lower';
    const sideAngle=Math.atan2(Math.abs(lx),Math.abs(ly)||1e-9);
    return sideAngle<=halfArcDeg*Math.PI/180?side:null;
  },
  predictIntercept(shooter,target,speed=410,maxTime=2){
    const svx=shooter.vx||0,svy=shooter.vy||0,tvx=target.vx||0,tvy=target.vy||0;
    const rx=target.x-shooter.x,ry=target.y-shooter.y,vx=tvx-svx,vy=tvy-svy;
    const A=vx*vx+vy*vy-speed*speed,B=2*(rx*vx+ry*vy),CC=rx*rx+ry*ry;
    let t=null;
    if(Math.abs(A)<1e-8){if(Math.abs(B)>1e-8){const q=-CC/B;if(q>0)t=q;}}
    else{const disc=B*B-4*A*CC;if(disc>=0){const q=Math.sqrt(disc),a=(-B-q)/(2*A),b=(-B+q)/(2*A);for(const v of[a,b])if(v>0&&(t===null||v<t))t=v;}}
    if(t===null||!Number.isFinite(t))t=Math.hypot(rx,ry)/Math.max(1,speed);
    t=clamp(t,.05,maxTime);
    return{x:target.x+tvx*t,y:target.y+tvy*t,t};
  },
  sectionGunCount(hp){return hp>55?2:hp>0?1:0;},
  sideGunCount(sideSections){return this.sectionGunCount(sideSections.front||0)+this.sectionGunCount(sideSections.rear||0);},
  mergeBreach(breaches,hit){
    const list=breaches||[],x=hit.x||0,y=hit.y||0,damage=Math.max(1,hit.damage||1),waterline=!!hit.waterline;
    let b=list.find(q=>Math.hypot(q.x-x,q.y-y)<(q.r||7)+16);
    if(b){
      b.r=clamp((b.r||7)+damage*.12,7,38);
      b.severity=(b.severity||1)+damage*.055;
      b.waterline=b.waterline||waterline;
      if(hit.patched===false)b.patched=false;
    }else{
      list.push({x,y,r:clamp(6+damage*.12,7,20),severity:1+damage*.03,waterline,patched:false});
    }
    return list;
  },
  leakRate(breaches){return (breaches||[]).reduce((n,b)=>n+(b.waterline&&!b.patched?Math.pow((b.r||7)/10,1.25)*(b.severity||1):0),0);},
  patchBreaches(breaches,count=1){
    const open=(breaches||[]).filter(b=>b.waterline&&!b.patched).sort((a,b)=>(b.r||0)-(a.r||0));
    for(let i=0;i<Math.min(count,open.length);i++)open[i].patched=true;
    return breaches;
  },
  rotateToward(current,target,maxDelta){const d=wrap(target-current);return current+clamp(d,-maxDelta,maxDelta);},
  addSuppression(value,amount){return clamp((value||0)+Math.max(0,amount||0),0,1);},
  decaySuppression(value,dt,rate=.18){return clamp((value||0)-Math.max(0,dt||0)*rate,0,1);},
  reloadProgress(dt,baseRate=1,suppression=0){return Math.max(0,dt||0)*Math.max(0,baseRate||0)/(1+.25*clamp(suppression||0,0,1));},
  lightDamage(kind){return kind==='musket'?10:3;},
  repair(hp,max,cooldown) {return cooldown>0?hp:Math.min(max,hp+100);},
  resolve(x,y,cx,cy,r) {let dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);if(d>=r)return{x,y};if(!d){dx=1;dy=0;d=1;}return{x:cx+dx/d*r,y:cy+dy/d*r};},
  connectionOpenAllowed(openCount,maxOpen=2){return (openCount||0)<Math.max(1,maxOpen||2);},
  boardingAdvance(progress,dt,duration=2){return clamp((progress||0)+Math.max(0,dt||0)/Math.max(.01,duration||2),0,1);},
  reserveStep(from,to,speed,dt){const dx=(to.x||0)-(from.x||0),dy=(to.y||0)-(from.y||0),d=Math.hypot(dx,dy),step=Math.max(0,speed||0)*Math.max(0,dt||0);if(d<=step||d<1e-9)return{x:to.x||0,y:to.y||0,arrived:true};return{x:(from.x||0)+dx/d*step,y:(from.y||0)+dy/d*step,arrived:false};},
  shieldMultiplier(relativeAngle){const c=Math.cos(relativeAngle||0);return c>0.35?.42:c<-.35?1.2:.78;},
  boardingQueueSlots(size=0){return size>=1?2:1;}
};
root.Combat=C;
if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(globalThis);
