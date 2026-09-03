(function(root){
  'use strict';

  const G=root.V8ShipGrid,B=root.V8Battle;
  if(!G||!B)throw new Error('V9.6 detach cleanup requires grid and battle');

  const originalDetach=G.detachDisconnectedComponents;
  const originalDamageCell=G.damageCell;
  const originalUpdate=B.update;
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

  function key(gx,gy){return gx+','+gy;}
  function markBendingDirty(ship,reason){const M=root.V100Bending||null;if(M&&typeof M.markDirty==='function')M.markDirty(ship,reason);}
  function markDirty(ship){
    if(!ship)return;
    ship.__v96VisualDirty=true;
    ship.__v96DamageRevision=(ship.__v96DamageRevision||0)+1;
  }

  function markDetached(components,ship){
    let changed=false;
    for(const comp of components||[]){
      for(const cell of comp||[]){
        if(cell.detachedGone)continue;
        cell.alive=false;cell.hp=0;cell.burning=false;cell.detachedGone=true;changed=true;
      }
    }
    if(changed){
      markDirty(ship);
      ship.__v99TopologyRevision=(ship.__v99TopologyRevision||0)+1;
      markBendingDirty(ship,'detach');
    }
    return components||[];
  }

  function classifyV99(ship,components){
    const S=root.V99Structure||null;
    if(!S||typeof S.classifyDetached!=='function')return{large:[],small:components||[]};
    try{return S.classifyDetached(ship,components||[]);}catch(e){return{large:[],small:components||[]};}
  }

  G.detachDisconnectedComponents=function(ship){
    const components=originalDetach(ship);
    const classified=classifyV99(ship,components);
    markDetached(components,ship);
    return classified.small;
  };

  function liveCells(ship){return (ship&&ship.cells||[]).filter(c=>c.alive&&!c.detachedGone);}
  function anchorCell(ship,cells){
    if(!cells.length)return null;
    const cx=(ship.gridWidth-1)/2,cy=(ship.gridHeight-1)/2;
    const structural=cells.filter(c=>c.type==='beam'||c.type==='core');
    const pool=structural.length?structural:cells;
    let best=pool[0],bestD=Infinity;
    for(const c of pool){const d=(c.gx-cx)*(c.gx-cx)+(c.gy-cy)*(c.gy-cy);if(d<bestD){bestD=d;best=c;}}
    return best;
  }
  function adjacentLive(ship,cell){
    const out=[];
    for(const [dx,dy] of DIRS){const n=ship.cellMap&&ship.cellMap[key(cell.gx+dx,cell.gy+dy)];if(n&&n.alive&&!n.detachedGone)out.push(n);}
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
    const disc=new Map(),low=new Map(),parent=new Map(),bridges=[];let time=0;
    function dfs(c){
      const ck=key(c.gx,c.gy);disc.set(ck,++time);low.set(ck,time);
      for(const n of adjacentLive(ship,c)){
        const nk=key(n.gx,n.gy);if(!byKey.has(nk))continue;
        if(!disc.has(nk)){parent.set(nk,ck);dfs(n);low.set(ck,Math.min(low.get(ck),low.get(nk)));if(low.get(nk)>disc.get(ck))bridges.push([c,n]);}
        else if(parent.get(ck)!==nk)low.set(ck,Math.min(low.get(ck),disc.get(nk)));
      }
    }
    for(const c of cells){const ck=key(c.gx,c.gy);if(!disc.has(ck))dfs(c);}return bridges;
  }
  function componentWithoutBridge(ship,start,a,b){
    const ak=key(a.gx,a.gy),bk=key(b.gx,b.gy),seen=new Set(),q=[start],out=[];seen.add(key(start.gx,start.gy));
    for(let i=0;i<q.length;i++){
      const c=q[i];out.push(c);const ck=key(c.gx,c.gy);
      for(const n of adjacentLive(ship,c)){const nk=key(n.gx,n.gy);if((ck===ak&&nk===bk)||(ck===bk&&nk===ak)||seen.has(nk))continue;seen.add(nk);q.push(n);}
    }
    return out;
  }
  function collapseWeakNecks(ship){
    if(!ship||ship.state==='gone')return [];
    const collapsed=[];let safety=0;
    while(safety++<10){
      const cells=liveCells(ship);if(cells.length<8)break;
      const anchor=anchorCell(ship,cells);if(!anchor)break;
      const anchorKey=key(anchor.gx,anchor.gy),bridges=findBridges(ship,cells);let removed=false;
      for(const [a,b] of bridges){
        if(!(hasDestroyedNeighbor(ship,a,2)||hasDestroyedNeighbor(ship,b,2)))continue;
        const sideA=componentWithoutBridge(ship,a,a,b),sideAKeys=new Set(sideA.map(c=>key(c.gx,c.gy)));
        const detachedSide=sideAKeys.has(anchorKey)?componentWithoutBridge(ship,b,a,b):sideA;
        const total=cells.length;
        if(detachedSide.length<3||detachedSide.length>Math.max(4,Math.floor(total*.48)))continue;
        const classified=classifyV99(ship,[detachedSide]);
        markDetached([detachedSide],ship);
        if(!classified.large.length)collapsed.push(detachedSide);
        removed=true;break;
      }
      if(!removed)break;
    }
    return collapsed;
  }
  function cleanupShip(ship){
    if(!ship||ship.state==='gone')return [];
    const out=[];out.push(...G.detachDisconnectedComponents(ship));out.push(...collapseWeakNecks(ship));return out;
  }

  G.damageCell=function(ship,cell,damage){
    const res=originalDamageCell(ship,cell,damage);
    if(res&&res.hit)markDirty(ship);
    if(res&&res.destroyed&&ship){
      ship.__v96NeedsStructuralCleanup=true;
      ship.__v99TopologyRevision=(ship.__v99TopologyRevision||0)+1;
      markBendingDirty(ship,'cell-destroyed');
    }
    return res;
  };

  B.update=function(state,dt){
    originalUpdate(state,dt);
    if(!state)return;
    const ships=[state.player,...(state.enemies||[])];
    for(const ship of ships){
      if(!ship||!ship.__v96NeedsStructuralCleanup)continue;
      ship.__v96NeedsStructuralCleanup=false;
      cleanupShip(ship);
    }
  };

  root.V952DetachCleanup={cleanupShip,markDetached,collapseWeakNecks,findBridges,markDirty,classifyV99};
})(typeof globalThis!=='undefined'?globalThis:this);
