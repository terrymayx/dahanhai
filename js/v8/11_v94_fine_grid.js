(function(root){
  'use strict';

  const G=root.V8ShipGrid;
  if(!G)throw new Error('V9.5.7 fine grid requires V8ShipGrid');

  // V9.5.7: refine the hidden physical grid again. Keep almost the same overall
  // ship dimensions while reducing cell size from 8px to 6px. This raises grid
  // density by about 1.78x versus V9.4 and greatly reduces visible stair-stepping
  // when the vector hull is clipped to live physical support.
  const specs=G.SPECS||{};
  const targets={
    player:{gridWidth:53,gridHeight:91,cellSize:6},
    sloop:{gridWidth:48,gridHeight:21,cellSize:6},
    gunship:{gridWidth:59,gridHeight:27,cellSize:6},
    manowar:{gridWidth:75,gridHeight:32,cellSize:6}
  };
  for(const kind of Object.keys(targets)){
    if(!specs[kind])continue;
    specs[kind].gridWidth=targets[kind].gridWidth;
    specs[kind].gridHeight=targets[kind].gridHeight;
    specs[kind].cellSize=targets[kind].cellSize;
  }

  // Keep the high per-cell durability introduced by V9.4. More, smaller cells
  // make damage look finer without making each tiny piece paper-thin.
  const hp=G.CELL_HP||{};
  Object.assign(hp,{hull:36,deck:20,beam:60,core:60,powder:20,rudder:30,mast:30,cannon:30});

  const resistance=G.MATERIAL_RESISTANCE||{};
  Object.assign(resistance,{hull:42,deck:30,beam:64,core:64,powder:22,rudder:34,mast:34,cannon:34});

  root.V94FineGrid={active:true,version:'9.5.7',targets,cellHp:hp,materialResistance:resistance};
})(typeof globalThis!=='undefined'?globalThis:this);
