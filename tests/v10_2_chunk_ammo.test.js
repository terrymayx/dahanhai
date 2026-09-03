const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const ctx={console,Math};ctx.globalThis=ctx;
ctx.V8ShipGrid={};ctx.V8Battle=null;
vm.createContext(ctx);
for(const f of ['js/v8/34_v102_ammo.js','js/v8/43_v101_chunk_damage.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const D=ctx.V101ChunkDamage;
assert(D,'chunk damage module must load');
function fresh(){return {id:'c',x:0,y:0,phase:'float',mass:10,cellSize:8,cells:Array.from({length:5},(_,i)=>({x:i*8,y:0,type:'hull',weight:2}))};}
function loss(ammoType){const c=fresh(),state={structuralChunks:[c]};D.prepareChunk(c);const before=c.durability;const impact={power:20};if(ammoType!==undefined)impact.ammoType=ammoType;D.damageChunk(state,c,20,impact);return before-c.durability;}
const standard=loss(undefined),solid=loss('solid'),chain=loss('chain'),explosive=loss('explosive');
assert(Math.abs(standard-20)<1e-9,'collision/legacy calls without ammo must remain scale 1');
assert(Math.abs(solid-23)<1e-9,'solid should deal 1.15x chunk damage');
assert(Math.abs(chain-12)<1e-9,'chain should deal 0.60x chunk damage');
assert(Math.abs(explosive-21)<1e-9,'explosive should deal 1.05x chunk damage');
assert(solid>explosive&&explosive>chain,'chunk ammo roles must be clearly ordered');
console.log('V10.2 structural chunk ammo tests passed');
