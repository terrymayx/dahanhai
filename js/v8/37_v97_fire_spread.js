(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.7 fire spread requires grid and battle');

  const originalUpdate=B.update;
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
  const MAX_FIRE_POINTS=10;
  const STEP=.42;

  function key(gx,gy){return gx+','+gy;}
  function isWood(cell){return cell&&(cell.type==='deck'||cell.type==='hull'||cell.type==='mast'||cell.type==='beam'||cell.type==='core');}
  function neighbors(ship,cell){
    const out=[];
    for(const [dx,dy] of DIRS){const n=ship.cellMap&&ship.cellMap[key(cell.gx+dx,cell.gy+dy)];if(n)out.push(n);}
    return out;
  }
  function nearOpenWater(ship,cell){for(const n of neighbors(ship,cell))if(n&&!n.alive&&!n.detachedGone)return true;return false;}
  function igniteCell(cell){
    if(!cell||!cell.alive||cell.burning||!isWood(cell))return false;
    cell.burning=true;cell.fireAge=0;cell.fireDamage=0;return true;
  }

  function updateShipFireSpread(state,ship,dt){
    if(!ship||ship.state!=='active')return;
    ship.__v97FireSpreadT=(ship.__v97FireSpreadT||0)+dt;
    if(ship.__v97FireSpreadT<STEP)return;
    ship.__v97FireSpreadT%=STEP;

    let burning=(ship.__v96BurningCells||[]).filter(c=>c&&c.alive&&c.burning&&!c.detachedGone);
    if(!burning.length){ship.__v96BurningCells=[];return;}
    const flood=Math.max(0,Math.min(1,ship.floodLevel||0));
    const survivors=[];

    for(const cell of burning){
      const wetBonus=nearOpenWater(ship,cell)?.13:0;
      const extinguishChance=Math.max(0,(flood-.12)*.20)+wetBonus*flood;
      if(extinguishChance>0&&Math.random()<extinguishChance){
        cell.burning=false;cell.fireDamage=0;
        if(state&&state.fx&&Math.random()<.45){const p=G.cellCenterWorld(ship,cell);state.fx.push({k:'foam',x:p.x,y:p.y,t:0,dur:.45,r:6});}
      }else survivors.push(cell);
    }
    burning=survivors;

    let fireCount=burning.length,created=0;
    const newFires=[];
    if(fireCount<MAX_FIRE_POINTS){
      for(const source of burning){
        if(created>=2||fireCount>=MAX_FIRE_POINTS)break;
        if((source.fireAge||0)<2.2)continue;
        const candidates=neighbors(ship,source).filter(c=>c.alive&&!c.burning&&!c.detachedGone&&isWood(c));
        if(!candidates.length)continue;
        const target=candidates[Math.floor(Math.random()*candidates.length)];
        const spreadChance=.075*(1-flood*.72);
        if(Math.random()<spreadChance&&igniteCell(target)){newFires.push(target);created++;fireCount++;}
      }
    }

    ship.__v96BurningCells=[...burning,...newFires].filter((c,i,a)=>c&&c.alive&&c.burning&&!c.detachedGone&&a.indexOf(c)===i).slice(0,MAX_FIRE_POINTS);
  }

  B.update=function(state,dt){
    originalUpdate(state,dt);
    if(!state||!(dt>0))return;
    updateShipFireSpread(state,state.player,dt);
    for(const ship of state.enemies||[])updateShipFireSpread(state,ship,dt);
  };

  root.V97FireSpread={ignite:igniteCell,updateShipFireSpread,MAX_FIRE_POINTS,STEP};
})(typeof globalThis!=='undefined'?globalThis:this);