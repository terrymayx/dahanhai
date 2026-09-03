const fs=require('fs'),assert=require('assert'),vm=require('vm');
const path='js/v8/35_v103_broadside.js';assert(fs.existsSync(path),'V10.3 broadside module must exist');
const src=fs.readFileSync(path,'utf8');
const G={CELL_HP:{deck:20,cannon:30},CELL_WEIGHT:{deck:1,cannon:1},MATERIAL_RESISTANCE:{cannon:34},cellCenterLocal:(s,c)=>({x:(c.gx+.5-s.gridWidth/2)*s.cellSize,y:(c.gy+.5-s.gridHeight/2)*s.cellSize}),localToWorld:(s,x,y)=>{const c=Math.cos(s.rotation||0),q=Math.sin(s.rotation||0);return{x:s.x+x*c-y*q,y:s.y+x*q+y*c};}};
const root={V8ShipGrid:G,V8Projectile:{spawn(){}},V8Battle:{},V102Ammo:{}};root.globalThis=root;vm.runInNewContext(src,root,{filename:path});
const V=root.V103Broadside;assert.strictEqual(V.FULL_ARC_DEG,22);assert.strictEqual(V.GUN_ARC_DEG,38);assert.strictEqual(V.HARD_ARC_DEG,46);
function ship(){const w=40,h=68,cells=[];for(let gy=0;gy<h;gy++)for(let gx=0;gx<w;gx++)cells.push({gx,gy,type:'deck',material:'deck',hp:20,maxHp:20,alive:true,weight:1});return{kind:'player',side:'player',x:0,y:0,rotation:0,gridWidth:w,gridHeight:h,cellSize:8,cells,cellMap:Object.fromEntries(cells.map(c=>[c.gx+','+c.gy,c]))};}
const s=ship();V.ensureBattery(s);
const full=V.gunsThatCanBear(s,'starboard',{x:500,y:0});assert.strictEqual(full.length,7,'0deg broadside should use all guns');
const a40=40*Math.PI/180,partial=V.gunsThatCanBear(s,'starboard',{x:500*Math.cos(a40),y:500*Math.sin(a40)});assert(partial.length>0&&partial.length<7,'edge arc should expose only part of battery');
const a50=50*Math.PI/180,none=V.gunsThatCanBear(s,'starboard',{x:500*Math.cos(a50),y:500*Math.sin(a50)});assert.strictEqual(none.length,0,'beyond 46deg must not fire');
const gun=V.batteryFor(s).starboard.guns[0];gun.reload=1;V.updateReloads(s,.25);assert(Math.abs(gun.reload-.75)<1e-9);V.updateReloads(s,2);assert.strictEqual(gun.reload,0);
console.log('V10.3 arc/reload contract passed');
