(function(root){
  'use strict';

  const Grid=root.V8ShipGrid,Vector=root.V9VectorShip;
  if(!Grid||!Vector||typeof Vector.drawShipLocal!=='function')throw new Error('V9.0.1 cleanup requires V8ShipGrid and V9VectorShip');

  const originalDrawShipLocal=Vector.drawShipLocal;

  function clearDestroyedCells(ctx,ship){
    if(!ctx||!ship)return;
    const size=(ship.cellSize||16)*1.08;
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.fillStyle='#000';
    for(const cell of ship.cells||[]){
      if(cell.alive)continue;
      const p=Grid.cellCenterLocal(ship,cell);
      ctx.fillRect(p.x-size*.5,p.y-size*.5,size,size);
    }
    ctx.restore();
  }

  Vector.drawShipLocal=function(ctx,ship,state){
    const drawn=originalDrawShipLocal(ctx,ship,state);
    if(drawn!==false)clearDestroyedCells(ctx,ship);
    return drawn;
  };

  Vector.clearDestroyedCells=clearDestroyedCells;
})(typeof globalThis!=='undefined'?globalThis:this);
