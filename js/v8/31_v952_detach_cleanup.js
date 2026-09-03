(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.5.5 detach cleanup requires grid and battle');

  const originalDetach=G.detachDisconnectedComponents;
  const originalUpdate=B.update;
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

  function key(gx,gy){return gx+','+gy;}

  function markDetached(components){
    for(const comp of components||[]){
      for(const cell of comp||[]){
        cell.alive=false;
        cell.hp=0;
        cell.burning=false;
        cell.detachedGone=true;
      }
    }
    return components||[];
  }

  G.detachDisconnectedComponents=function(ship){
    return markDetached(originalDetach(ship));
  };

  function liveCells(ship){
    return (ship&&ship.cells||[]).filter(c=>c.alive&&!c.detachedGone);
  }

  function anchorCell(ship,cells){
    if(!cells.length)return null;
    const cx=(ship.gridWidth-1)/2,cy=(ship.gridHeight-1)/2;
    const structural=cells.filter(c=>c.type==='beam'||c.type==='core');
    const pool=structural.length?structural:cells;
    let best=pool[0],bestD=Infinity;
    for(const c of pool){
      const d=(c.gx-cx)*(c.gx-cx)+(c.gy-cy)*(c.gy-cy);
      if(d<bestD){bestD=d;best=c;}
    }
    return best;
  }

  function adjacentLive(ship,cell){
    const out=[];
    for(const [dx,dy] of DIRS){
      const n=ship.cellMap&&ship.cellMap[key(cell.gx+dx,cell.gy+dy)];
      if(n&&n.alive&&!n.detachedGone)out.push(n);
    }
    return out;
  }

  function hasDestroyedNeighbor(ship,cell,radius){
    radius=radius||1;
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      if(Math.abs(dx)+Math.abs(dy)>radius)continue;
      const n=ship.cellMap&&ship.cellMap[key(cell.gx+dx,cell.gy+dy)];
      if(n&&!n.alive&&!n.detachedGone)return true;
    }
    return false;
  }

  function findBridges(ship,cells){
    const byKey=new Map(cells.map(c=>[key(c.gx,c.gy),c]));
    const disc=new Map(),low=new Map(),parent=new Map(),bridges=[];
    let time=0;

    function dfs(c){
      const ck=key(c.gx,c.gy);
      disc.set(ck,++time);low.set(ck,time);
      for(const n of adjacentLive(ship,c)){
        const nk=key(n.gx,n.gy);
        if(!byKey.has(nk))continue;
        if(!disc.has(nk)){
          parent.set(nk,ck);dfs(n);
          low.set(ck,Math.min(low.get(ck),low.get(nk)));
          if(low.get(nk)>disc.get(ck))bridges.push([c,n]);
        }else if(parent.get(ck)!==nk){
          low.set(ck,Math.min(low.get(ck),disc.get(nk)));
        }
      }
    }

    for(const c of cells){const ck=key(c.gx,c.gy);if(!disc.has(ck))dfs(c);}
    return bridges;
  }

  function componentWithoutBridge(ship,start,a,b){
    const ak=key(a.gx,a.gy),bk=key(b.gx,b.gy),seen=new Set(),q=[start],out=[];
    seen.add(key(start.gx,start.gy));
    for(let i=0;i<q.length;i++){
      const c=q[i];out.push(c);const ck=key(c.gx,c.gy);
      for(const n of adjacentLive(ship,c)){
        const nk=key(n.gx,n.gy);
        if((ck===ak&&nk===bk)||(ck===bk&&nk===ak))continue;
        if(seen.has(nk))continue;
        seen.add(nk);q.push(n);
      }
    }
    return out;
  }

  function collapseWeakNecks(ship){
    if(!ship||ship.state==='gone')return [];
    const collapsed=[];
    let safety=0;

    while(safety++<12){
      const cells=liveCells(ship);
      if(cells.length<8)break;
      const anchor=anchorCell(ship,cells);if(!anchor)break;
      const anchorKey=key(anchor.gx,anchor.gy),bridges=findBridges(ship,cells);
      let removed=false;

      for(const [a,b] of bridges){
        if(!(hasDestroyedNeighbor(ship,a,2)||hasDestroyedNeighbor(ship,b,2)))continue;

        const sideA=componentWithoutBridge(ship,a,a,b);
        const sideAKeys=new Set(sideA.map(c=>key(c.gx,c.gy)));
        const detachedSide=sideAKeys.has(anchorKey)?componentWithoutBridge(ship,b,a,b):sideA;
        const total=cells.length;

        // Ignore harmless single tips. Collapse a meaningful lobe when its only support
        // is a one-cell bridge created next to recent destruction.
        if(detachedSide.length<3)continue;
        if(detachedSide.length>Math.max(4,Math.floor(total*.48)))continue;

        markDetached([detachedSide]);
        collapsed.push(detachedSide);
        removed=true;
        break;
      }
      if(!removed)break;
    }
    return collapsed;
  }

  function cleanupShip(ship){
    if(!ship||ship.state==='gone')return [];
    const out=[];
    out.push(...G.detachDisconnectedComponents(ship));
    out.push(...collapseWeakNecks(ship));
    return out;
  }

  B.update=function(state,dt){
    originalUpdate(state,dt);
    if(!state)return;
    cleanupShip(state.player);
    for(const ship of state.enemies||[])cleanupShip(ship);
  };

  root.V952DetachCleanup={cleanupShip,markDetached,collapseWeakNecks,findBridges};
})(typeof globalThis!=='undefined'?globalThis:this);
