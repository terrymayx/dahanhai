const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('js/v8/40_render.js','utf8');
for(const token of ["cell.type==='beam'","cell.type==='powder'","cell.type==='rudder'","cell.type==='mast'","cell.type==='cannon'"]){
  assert(src.includes(token),`renderer must distinguish ${token}`);
}
assert(src.includes('debrisClusters'),'renderer must draw whole debris clusters');
assert(src.includes("f.k==='powderBlast'"),'renderer must draw powder blast');
for(const label of ['主梁','火药舱','舵机','桅杆','炮位']) assert(src.includes(label),`aim UI must include ${label}`);
assert(/V8\.\d+/.test(src),'HUD must identify the active V8 release');
console.log('V8.2 render contract tests passed');