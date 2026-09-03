(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V9.6 performance grid requires V8ShipGrid');

  // V9.6: return to the proven 8px physical grid. Visual smoothness is handled
  // by cached vector/damage masks instead of multiplying physics cells.
  const specs=G.SPECS||{};
  const targets={
    player:{gridWidth:40,gridHeight:68,cellSize:8},
    sloop:{gridWidth:36,gridHeight:16,cellSize:8},
    gunship:{gridWidth:44,gridHeight:20,cellSize:8},
    manowar:{gridWidth:56,gridHeight:24,cellSize:8}
  };
  for(const kind of Object.keys(targets)){
    if(!specs[kind])continue;
    specs[kind].gridWidth=targets[kind].gridWidth;
    specs[kind].gridHeight=targets[kind].gridHeight;
    specs[kind].cellSize=targets[kind].cellSize;
  }

  const hp=G.CELL_HP||{};
  Object.assign(hp,{hull:36,deck:20,beam:60,core:60,powder:20,rudder:30,mast:30,cannon:30});

  const resistance=G.MATERIAL_RESISTANCE||{};
  Object.assign(resistance,{hull:42,deck:30,beam:64,core:64,powder:22,rudder:34,mast:34,cannon:34});

  root.V94FineGrid={active:true,version:'9.6.0',mode:'8px-physics-cached-visuals',targets,cellHp:hp,materialResistance:resistance};
})(typeof globalThis!=='undefined'?globalThis:this);
