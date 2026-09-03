const fs=require('fs'),assert=require('assert'),vm=require('vm');
const path='js/v8/35_v103_broadside.js';
assert(fs.existsSync(path),'V10.3 broadside module must exist');
const src=fs.readFileSync(path,'utf8');
const G={
  CELL_HP:{deck:20,cannon:30},CELL_WEIGHT:{deck:1,cannon:1},MATERIAL_RESISTANCE:{cannon:34},
  cellCenterLocal:(ship,c)=>({x:(c.gx+.5-ship.gridWidth/2)*ship.cellSize,y:(c.gy+.5-ship.gridHeight/2)*ship.cellSize}),
  localToWorld:(ship,x,y)=>({x:ship.x+x,y:ship.y+y})
};
const root={V8ShipGrid:G,V8Projectile:{spawn(){}},V8Battle:{},V102Ammo:{}};root.globalThis=root;
vm.runInNewContext(src,root,{filename:path});
const V=root.V103Broadside;assert(V,'V103Broadside export missing');
assert.deepStrictEqual(JSON.parse(JSON.stringify(V.COUNT_BY_KIND)),{player:7,sloop:3,gunship:5,manowar:7});
function fakeShip(kind){
 const w=kind==='player'?40:44,h=kind==='player'?68:20,cells=[];
 for(let gy=0;gy<h;gy++)for(let gx=0;gx<w;gx++)cells.push({gx,gy,type:'deck',material:'deck',hp:20,maxHp:20,alive:true,weight:1,critical:false,system:null});
 return {kind,side:kind==='player'?'player':'enemy',x:0,y:0,rotation:0,gridWidth:w,gridHeight:h,cellSize:8,cells,cellMap:Object.fromEntries(cells.map(c=>[c.gx+','+c.gy,c]))};
}
const ship=fakeShip('player'),battery=V.ensureBattery(ship);
assert.strictEqual(battery.port.guns.length,7,'player port must have 7 guns');
assert.strictEqual(battery.starboard.guns.length,7,'player starboard must have 7 guns');
const all=[...battery.port.guns,...battery.starboard.guns];
assert.strictEqual(new Set(all.map(g=>g.cell)).size,14,'each gun must bind a unique real cell');
for(const gun of all){assert(gun.cell&&gun.cell.alive,'gun must bind live cell');assert.strictEqual(gun.cell.type,'cannon');assert.strictEqual(gun.cell.system,'cannon');assert.strictEqual(gun.cell.critical,true);assert.strictEqual(gun.cell.maxHp,30);assert(gun.muzzleLocal&&Number.isFinite(gun.muzzleLocal.x)&&Number.isFinite(gun.muzzleLocal.y));}
console.log('V10.3 battery contract passed');
