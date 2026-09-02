(function(root){
  'use strict';

  // V9.1.0: destroyed cells are no longer erased. The vector ship renderer
  // keeps the damaged hull visible and renders charred burning areas instead.
  // This compatibility shim remains so the existing script order stays stable.
  root.V8DestroyedCellCleanup={
    active:false,
    reason:'destroyed-cells-render-as-burning-damage'
  };
})(typeof globalThis!=='undefined'?globalThis:this);
