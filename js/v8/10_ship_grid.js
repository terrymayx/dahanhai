(function(root){
  'use strict';

  const SPECS={
    player:{gridWidth:20,gridHeight:34,cellSize:16,base:'#a66b32',deck:'#d7a45f',rotation:0},
    sloop:{gridWidth:18,gridHeight:8,cellSize:16,base:'#8a3b2e',deck:'#b07155',rotation:0},
    gunship:{gridWidth:22,gridHeight:10,cellSize:16,base:'#3f4450',deck:'#7d6a55',rotation:0},
    manowar:{gridWidth:28,gridHeight:12,cellSize:16,base:'#2e7d4f',deck:'#7fa06a',rotation:0},
  };
  const CELL_HP={hull:28,deck:20,beam:48,core:48,powder:18,rudder:24,mast:26,cannon:26};
  const CELL_WEIGHT={hull:1,deck:1,beam:3,core:3,powder:1,rudder:1,mast:1,cannon:1};
  const MATERIAL_RESISTANCE={hull:34,deck:24,beam:52,core:52,powder:20,rudder:28,mast:30,cannon:30};
  const CRITICAL_TYPES=new Set(['beam','powder','rudder','mast','cannon']);

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

  function nearestInternal(cells,targetX,targetY,exclude){
    let best=null,bestD=Infinity;
    for(const c of cells){
      if(c.type!=='deck'&&c.type!=='beam')continue;
      if(exclude&&exclude.has(key(c.gx,c.gy)))continue;
      const d=(c.gx-targetX)*(c.gx-targetX)+(c.gy-targetY)*(c.gy-targetY);
      if(d<bestD){bestD=d;best=c;}
    }
    return best;
  }

  function setType(cell,type){
    if(!cell)return;
    cell.type=type;
    cell.material=type==='core'?'beam':type;
    cell.maxHp=CELL_HP[type]||20;
    cell.hp=cell.maxHp;
    cell.weight=CELL_WEIGHT[type]||1;
    cell.critical=CRITICAL_TYPES.has(type);
    cell.system=type==='beam'||type==='core'?'structure':(cell.critical?type:null);
  }

  function assignFunctionalTypes(kind,w,h,cells){
    const internal=cells.filter(c=>c.type==='deck');
    if(!internal.length)return;
    const used=new Set();
    const horizontal=kind!=='player';
    const centerX=(w-1)/2,centerY=(h-1)/2;

    if(horizontal){
      const beamY=Math.floor(centerY);
      for(const c of internal){
        if(c.gy===beamY&&c.gx>=Math.floor(w*.28)&&c.gx<=Math.ceil(w*.72)){
          setType(c,'beam');used.add(key(c.gx,c.gy));
        }
      }
      const placements=[
        ['powder',w*.64,centerY],
        ['rudder',w*.82,centerY],
        ['mast',w*.50,centerY],
        ['cannon',w*.48,h*.30],
        ['cannon',w*.48,h*.70],
      ];
      for(const [type,x,y] of placements){
        const c=nearestInternal(cells,x,y,used);
        if(c){setType(c,type);used.add(key(c.gx,c.gy));}
      }
    }else{
      const beamX=Math.floor(centerX);
      for(const c of internal){
        if(c.gx===beamX&&c.gy>=Math.floor(h*.28)&&c.gy<=Math.ceil(h*.72)){
          setType(c,'beam');used.add(key(c.gx,c.gy));
        }
      }
      const placements=[
        ['powder',centerX,h*.64],
        ['rudder',centerX,h*.82],
        ['mast',centerX,h*.50],
        ['cannon',w*.30,h*.48],
        ['cannon',w*.70,h*.48],
      ];
      for(const [type,x,y] of placements){
        const c=nearestInternal(cells,x,y,used);
        if(c){setType(c,type);used.add(key(c.gx,c.gy));}
      }
    }
  }

  function createTemplateShip(kind,side,x,y){
    const spec=SPECS[kind];
    if(!spec)throw new Error('Unknown V8 ship kind: '+kind);
    const occ=buildOccupancy(kind,spec.gridWidth,spec.gridHeight);
    const cells=[];
    const cellMap=Object.create(null);
    for(let gy=0;gy<spec.gridHeight;gy++)for(let gx=0;gx<spec.gridWidth;gx++){
      if(!occ.has(key(gx,gy)))continue;
      const type=isOuter(occ,gx,gy)?'hull':'deck';
      const cell={gx,gy,type,material:type,hp:CELL_HP[type],maxHp:CELL_HP[type],alive:true,weight:CELL_WEIGHT[type],flash:0,critical:false,system:null};
      cells.push(cell);cellMap[key(gx,gy)]=cell;
    }
    assignFunctionalTypes(kind,spec.gridWidth,spec.gridHeight,cells);
    let totalWeight=0;
    for(const c of cells)totalWeight+=c.weight||1;
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

  function connectedComponents(ship){
    const seen=new Set(),out=[];
    if(!ship||!ship.cells)return out;
    for(const cell of ship.cells){
      const startKey=key(cell.gx,cell.gy);
      if(!cell.alive||seen.has(startKey))continue;
      const q=[cell],comp=[];seen.add(startKey);
      for(let i=0;i<q.length;i++){
        const cur=q[i];comp.push(cur);
        for(const [gx,gy] of [[cur.gx-1,cur.gy],[cur.gx+1,cur.gy],[cur.gx,cur.gy-1],[cur.gx,cur.gy+1]]){
          const k=key(gx,gy),n=ship.cellMap[k];
          if(n&&n.alive&&!seen.has(k)){seen.add(k);q.push(n);}
        }
      }
      out.push(comp);
    }
    return out;
  }

  function mainConnectedKeys(ship){
    const live=ship&&ship.cells?ship.cells.filter(c=>c.alive):[];
    const seen=new Set();
    if(!live.length)return seen;
    const cx=(ship.gridWidth-1)/2,cy=(ship.gridHeight-1)/2;
    const structural=live.filter(c=>c.type==='beam'||c.type==='core');
    let best=(structural.length?structural:live)[0],bestD=Infinity;
    for(const c of (structural.length?structural:live)){
      const d=(c.gx-cx)*(c.gx-cx)+(c.gy-cy)*(c.gy-cy);
      if(d<bestD){bestD=d;best=c;}
    }
    const q=[best];seen.add(key(best.gx,best.gy));
    for(let qi=0;qi<q.length;qi++){
      const c=q[qi];
      for(const [gx,gy] of [[c.gx-1,c.gy],[c.gx+1,c.gy],[c.gx,c.gy-1],[c.gx,c.gy+1]]){
        const k=key(gx,gy);
        if(seen.has(k))continue;
        const next=ship.cellMap[k];
        if(!next||!next.alive)continue;
        seen.add(k);q.push(next);
      }
    }
    return seen;
  }

  function detachDisconnected(ship){
    const keep=mainConnectedKeys(ship),detached=[];
    if(!ship||!ship.cells)return detached;
    for(const c of ship.cells){
      if(!c.alive||keep.has(key(c.gx,c.gy)))continue;
      c.alive=false;c.hp=0;detached.push(c);
    }
    return detached;
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
    SPECS,CELL_HP,CELL_WEIGHT,MATERIAL_RESISTANCE,createTemplateShip,worldToLocal,localToWorld,
    localToGrid,cellCenterLocal,cellCenterWorld,damageCell,integrity,connectedComponents,
    mainConnectedKeys,detachDisconnected,firstCellAlongSegment,pointHitsLiveCell
  };
})(typeof globalThis!=='undefined'?globalThis:this);
