(function(root){
  'use strict';
  const G=root.V8ShipGrid,B=root.V8Battle||null;
  if(!G)throw new Error('V8ShipGrid must load before V8.5 damage/flooding');

  const LEAK_RATE=.07;

  function damageStage(cell){
    if(!cell||cell.alive===false||!(cell.hp>0))return 'destroyed';
    const max=Math.max(1,cell.maxHp||cell.hp||1);
    const ratio=cell.hp/max;
    if(ratio>.75)return 'intact';
    if(ratio>.50)return 'cracked';
    return 'critical';
  }

  function ensureFlooding(ship){
    if(!ship)return null;
    if(!Array.isArray(ship.leaks))ship.leaks=[];
    if(!Number.isFinite(ship.flooding))ship.flooding=0;
    if(!Number.isFinite(ship.draft))ship.draft=0;
    return ship;
  }

  function isWaterlineHull(ship,cell){
    if(!ship||!cell||cell.type!=='hull')return false;
    if(ship.kind==='player'){
      const p=(cell.gy+.5)/Math.max(1,ship.gridHeight);
      return p>=.18&&p<=.82;
    }
    const p=(cell.gx+.5)/Math.max(1,ship.gridWidth);
    return p>=.18&&p<=.82;
  }

  function leakKey(cell){return cell.gx+','+cell.gy;}

  function hasLiveNeighbor(ship,cell){
    for(const [gx,gy] of [[cell.gx-1,cell.gy],[cell.gx+1,cell.gy],[cell.gx,cell.gy-1],[cell.gx,cell.gy+1]]){
      const n=ship.cellMap[gx+','+gy];
      if(n&&n.alive)return true;
    }
    return false;
  }

  function addLeak(ship,cell){
    ensureFlooding(ship);
    if(!isWaterlineHull(ship,cell))return null;
    const key=leakKey(cell),existing=ship.leaks.find(l=>l.key===key);
    if(existing)return existing;
    const local=G.cellCenterLocal(ship,cell);
    const leak={key,gx:cell.gx,gy:cell.gy,lx:local.x,ly:local.y,rate:LEAK_RATE,phase:Math.random()*Math.PI*2};
    ship.leaks.push(leak);
    return leak;
  }

  function syncLeaks(ship){
    ensureFlooding(ship);
    if(!ship||!ship.cells)return ship&&ship.leaks;
    for(const cell of ship.cells){
      if(cell.alive||cell.type!=='hull'||!isWaterlineHull(ship,cell))continue;
      if(hasLiveNeighbor(ship,cell))addLeak(ship,cell);
    }
    return ship.leaks;
  }

  function sinkFromFlooding(state,ship){
    if(!state||!ship||ship.state!=='active')return;
    if(ship.side==='player'){
      state.state='lose';ship.state='wrecked';state.focus=null;state.aim=null;state.salvo=null;
      if(state.fx)state.fx.push({k:'boom',x:ship.x,y:ship.y,t:0,dur:.75});
      return;
    }
    ship.state='sink';ship.sinkT=0;
    state.gold=(state.gold||0)+(ship.gold||0);state.kills=(state.kills||0)+1;
    if(state.aim&&state.aim.shipId===ship.id)state.aim=null;
    if(state.salvo&&state.salvo.targetId===ship.id)state.salvo=null;
    if(state.focus===ship&&B&&typeof B.setFocus==='function')B.setFocus(state,B.targetForPlayer(state));
    if(state.fx)state.fx.push({k:'boom',x:ship.x,y:ship.y,t:0,dur:.75});
  }

  function updateFlooding(state,ship,dt){
    ensureFlooding(ship);
    if(!ship||ship.state!=='active'||!(dt>0))return ship&&ship.flooding;
    const totalRate=ship.leaks.reduce((sum,l)=>sum+(l.rate||LEAK_RATE),0);
    if(totalRate>0)ship.flooding=Math.min(1,ship.flooding+totalRate*dt);
    ship.draft=Math.max(0,Math.min(1,Math.pow(ship.flooding,0.82)));
    if(ship.side==='enemy'&&B&&typeof B.recomputeShipSystems==='function'){
      B.recomputeShipSystems(ship);
      const floodMult=Math.max(.25,1-ship.flooding*.55);
      ship.speed*=floodMult;
    }
    if(ship.flooding>=1)sinkFromFlooding(state,ship);
    return ship.flooding;
  }

  function installBattleHooks(){
    if(!B||B.__v85FloodingInstalled)return;
    B.__v85FloodingInstalled=true;

    const originalNewGame=B.newGame;
    B.newGame=function(){
      const state=originalNewGame();
      ensureFlooding(state.player);
      const originalDestroyed=state.onCellDestroyed;
      state.onCellDestroyed=function(ship,cell,pos,p){
        const before=(state.debrisClusters||[]).length;
        if(typeof originalDestroyed==='function')originalDestroyed(ship,cell,pos,p);
        // V8.4.2 deliberately removed all camera shake. Some legacy battle
        // callbacks still write a shake value internally, so erase it here
        // immediately rather than waiting for the next tuning/update frame.
        state.shake=0;
        syncLeaks(ship);
        if((cell.type==='beam'||cell.type==='core')&&(state.debrisClusters||[]).length>before){
          let detached=0;
          for(let i=before;i<state.debrisClusters.length;i++)detached+=(state.debrisClusters[i].cells||[]).length;
          state.fx.push({k:'structureRupture',x:pos.x,y:pos.y,t:0,dur:.55,r:44+Math.min(100,detached*5)});
        }
      };
      return state;
    };

    const originalSpawnEnemy=B.spawnEnemy;
    B.spawnEnemy=function(state,kind,opts){
      const ship=originalSpawnEnemy(state,kind,opts);ensureFlooding(ship);return ship;
    };

    const originalUpdate=B.update;
    B.update=function(state,dt){
      if(state&&state.state==='playing'&&!state.paused&&!(state.hitStop>0)){
        const step=Math.min(.05,Math.max(0,dt||0));
        syncLeaks(state.player);updateFlooding(state,state.player,step);
        for(const ship of state.enemies||[]){syncLeaks(ship);updateFlooding(state,ship,step);}
      }
      originalUpdate(state,dt);
      if(state){
        state.shake=0;
        syncLeaks(state.player);
        for(const ship of state.enemies||[])syncLeaks(ship);
      }
    };
  }

  G.damageStage=damageStage;
  root.V8DamageFlooding={LEAK_RATE,damageStage,ensureFlooding,isWaterlineHull,addLeak,syncLeaks,updateFlooding,sinkFromFlooding};
  installBattleHooks();
})(typeof globalThis!=='undefined'?globalThis:this);
