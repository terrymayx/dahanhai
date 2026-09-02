(function(root){
  'use strict';

  const SPECS={
    player:{gridWidth:20,gridHeight:34,cellSize:16,base:'#a66b32',deck:'#d7a45f',rotation:0},
    sloop:{gridWidth:18,gridHeight:8,cellSize:16,base:'#8a3b2e',deck:'#b07155',rotation:0},
    gunship:{gridWidth:22,gridHeight:10,cellSize:16,base:'#3f4450',deck:'#7d6a55',rotation:0},
    manowar:{gridWidth:28,gridHeight:12,cellSize:16,base:'#2e7d4f',deck:'#7fa06a',rotation:0},
  };
  const CELL_HP={hull:28,deck:20,core:42,mast:24,cannon:26,powder:18};
  const CELL_WEIGHT={hull:1,deck:1,core:2,mast:1,cannon:1,powder:1};

  function key(gx,gy){return gx+','+gy;}

  function enemyMask(gx,gy,w,h){
    const nx=(gx+.5)/w;
    const halfMax=h/2-.35;
    const bulge=Math.sin(Math.PI*nx);
    const half=.7+bulge*(halfMax-.7);
    const dy=Math.abs((gy+.5)-h/2);
    return dy<=half;
  }

  function playerMask(gx,gy,w,h){
    const ny=(gy+.5)/h;
    const bulge=Math.sin(Math.PI*ny);
    const stern=.18*Math.sin(Math.PI*Math.min(1,ny/.28));
    const half=2.1+bulge*(w/2-2.2)+stern;
    const dx=Math.abs((gx+.5)-w/2);
    return dx<=half;
  }

  function buildOccupancy(kind,w,h){
    const set=new Set();
    for(let gy=0;gy<h;gy++)for(let gx=0;gx<w;gx++){
      const yes=kind==='player'?playerMask(gx,gy,w,h):enemyMask(gx,gy,w,h);
      if(yes)set.add(key(gx,gy));
    }
    return set;
  }

  function isOuter(occ,gx,gy){
    return !occ.has(key(gx-1,gy))||!occ.has(key(gx+1,gy))||
           !occ.has(key(gx,gy-1))||!occ.has(key(gx,gy+1));
  }

  function typeFor(kind,gx,gy,w,h,occ){
    if(isOuter(occ,gx,gy))return 'hull';
    const cx=Math.abs((gx+.5)-w/2),cy=Math.abs((gy+.5)-h/2);
    if(cx<=1.2&&cy<=Math.max(1.2,h*.10))return 'core';
    return 'deck';
  }

  function createTemplateShip(kind,side,x,y){
    const spec=SPECS[kind];
    if(!spec)throw new Error('Unknown V8 ship kind: '+kind);
    const occ=buildOccupancy(kind,spec.gridWidth,spec.gridHeight);
    const cells=[];
    const cellMap=Object.create(null);
    let totalWeight=0;
    for(let gy=0;gy<spec.gridHeight;gy++)for(let gx=0;gx<spec.gridWidth;gx++){
      if(!occ.has(key(gx,gy)))continue;
      const type=typeFor(kind,gx,gy,spec.gridWidth,spec.gridHeight,occ);
      const hp=CELL_HP[type]||20,weight=CELL_WEIGHT[type]||1;
      const cell={gx,gy,type,hp,maxHp:hp,alive:true,weight,flash:0};
      cells.push(cell);cellMap[key(gx,gy)]=cell;totalWeight+=weight;
    }
    return {
      id:null,kind,side:side||'enemy',x:x||0,y:y||0,rotation:spec.rotation||0,
      gridWidth:spec.gridWidth,gridHeight:spec.gridHeight,cellSize:spec.cellSize,
      cells,cellMap,totalWeight,baseColor:spec.base,deckColor:spec.deck,
      state:'active',sinkT:0,speed:0,fireT:0,shotT:0,focus:false,ph:Math.random()*6.28,
    };
  }

  function worldToLocal(ship,x,y){
    const dx=x-ship.x,dy=y-ship.y;
    const c=Math.cos(-ship.rotation),s=Math.sin(-ship.rotation);
    return {x:dx*c-dy*s,y:dx*s+dy*c};
  }

  function localToWorld(ship,x,y){
    const c=Math.cos(ship.rotation),s=Math.sin(ship.rotation);
    return {x:ship.x+x*c-y*s,y:ship.y+x*s+y*c};
  }

  function localToGrid(ship,lx,ly){
    return {
      gx:Math.floor(lx/ship.cellSize+ship.gridWidth/2),
      gy:Math.floor(ly/ship.cellSize+ship.gridHeight/2)
    };
  }

  function cellCenterLocal(ship,cell){
    return {
      x:(cell.gx+.5-ship.gridWidth/2)*ship.cellSize,
      y:(cell.gy+.5-ship.gridHeight/2)*ship.cellSize,
    };
  }

  function cellCenterWorld(ship,cell){
    const p=cellCenterLocal(ship,cell);return localToWorld(ship,p.x,p.y);
  }

  function damageCell(ship,cell,damage){
    if(!ship||!cell||!cell.alive||damage<=0)return {hit:false,destroyed:false};
    cell.hp=Math.max(0,cell.hp-damage);cell.flash=.12;
    const destroyed=cell.hp<=0;
    if(destroyed)cell.alive=false;
    return {hit:true,destroyed,cell};
  }

  function integrity(ship){
    if(!ship||!ship.totalWeight)return 0;
    let aliveWeight=0;
    for(const c of ship.cells)if(c.alive)aliveWeight+=c.weight||1;
    return aliveWeight/ship.totalWeight;
  }

  function firstCellAlongSegment(ship,x0,y0,x1,y1){
    if(!ship||ship.state==='gone')return null;
    const a=worldToLocal(ship,x0,y0),b=worldToLocal(ship,x1,y1);
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    const step=Math.max(2,ship.cellSize/3);
    const n=Math.max(1,Math.ceil(len/step));
    let lastKey='';
    for(let i=0;i<=n;i++){
      const t=i/n,lx=a.x+dx*t,ly=a.y+dy*t;
      const g=localToGrid(ship,lx,ly),k=key(g.gx,g.gy);
      if(k===lastKey)continue;lastKey=k;
      const cell=ship.cellMap[k];
      if(cell&&cell.alive)return cell;
    }
    return null;
  }

  function pointHitsLiveCell(ship,x,y){
    const p=worldToLocal(ship,x,y),g=localToGrid(ship,p.x,p.y);
    const cell=ship.cellMap[key(g.gx,g.gy)];
    return cell&&cell.alive?cell:null;
  }

  root.V8ShipGrid={
    SPECS,CELL_HP,CELL_WEIGHT,createTemplateShip,worldToLocal,localToWorld,
    localToGrid,cellCenterLocal,cellCenterWorld,damageCell,integrity,
    firstCellAlongSegment,pointHitsLiveCell
  };
})(typeof globalThis!=='undefined'?globalThis:this);
