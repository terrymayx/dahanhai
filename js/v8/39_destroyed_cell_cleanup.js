(function(root){
  'use strict';

  // V9.0.2: destroyed cells are now erased directly inside the ship's
  // offscreen surface by V9VectorShip.cutDestroyedCells().
  // Keeping this file as a compatibility shim avoids clearing the already
  // rendered sea/background on the main canvas.
  root.V8DestroyedCellCleanup={
    active:false,
    reason:'handled-inside-vector-ship-surface'
  };
})(typeof globalThis!=='undefined'?globalThis:this);
