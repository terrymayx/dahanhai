const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/v8/00_v8_base.js','js/v8/10_ship_grid.js','js/v8/20_projectiles.js','js/v8/30_battle.js','js/v8/35_combat_tuning.js','js/v8/36_damage_model.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const B=ctx.V8Battle;
const state=B.newGame();state.spawnT=999;state.playerFireT=999;
function deck(gx){return {gx,gy:0,type:'deck',material:'deck',hp:48,maxHp:48,alive:true,weight:1,flash:0,critical:false,system:null};}
const cells=[deck(0),deck(1),{gx:2,gy:0,type:'beam',material:'beam',hp:0,maxHp:96,alive:false,weight:3,flash:0,critical:true,system:'structure'},deck(3),deck(4),deck(5)];
const ship={id:'beam-test',kind:'gunship',side:'enemy',x:900,y:500,rotation:0,gridWidth:6,gridHeight:1,cellSize:16,cells,cellMap:Object.create(null),totalWeight:8,baseColor:'#555',deckColor:'#987',state:'active',speed:60,baseSpeed:60,shotT:99,ph:0,gold:0};
for(const c of cells)ship.cellMap[c.gx+',0']=c;
state.enemies=[ship];
const beam=cells[2];
state.onCellDestroyed(ship,beam,{x:900,y:500},{side:'player',vx:900,vy:0,damage:24});
assert(state.debrisClusters.some(c=>(c.cells||[]).length>=2),'beam break must create a multi-cell coherent debris cluster when structure disconnects');
assert(state.fx.some(f=>f.k==='structureRupture'),'damage model must keep local structure rupture feedback for beam-driven detachment');
assert.strictEqual(state.shake,0,'beam rupture must not restore camera shake');
console.log('V8.5 beam break compatibility tests passed');
