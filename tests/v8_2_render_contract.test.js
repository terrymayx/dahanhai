const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('js/v8/40_render.js','utf8');
for(const token of ["cell.type==='beam'","cell.type==='powder'","cell.type==='rudder'","cell.type==='mast'","cell.type==='cannon'"]){
  assert(src.includes(token),`renderer must distinguish ${token}`);
}
assert(src.includes('debrisClusters'),'renderer must draw whole debris clusters');
assert(src.includes("f.k==='powderBlast'"),'renderer must draw powder blast');
for(const label of ['主梁','火药舱','舵机','桅杆','炮位']) assert(src.includes(label),`aim UI must include ${label}`);
assert(src.includes('V8.2 · 部位破坏与连锁毁伤'),'HUD must identify V8.2');
console.log('V8.2 render contract tests passed');